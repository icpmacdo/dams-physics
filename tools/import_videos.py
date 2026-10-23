#!/usr/bin/env python3
"""Copy the seven Dams in Section films into docs/video/ for GitHub Pages.

For each episode: the titled Day (light) landscape cut as <slug>.mp4, a WebVTT caption file
built from the episode's captions.json, and a poster frame from the title card.

The films are made in the vibes repo (engine/concepts/dams/<nn>-<slug>/). The titled cut is the
explainer with a 4.5 s title card cross-faded 0.4 s into its start, so captions shift by 4.1 s.

    python3 tools/import_videos.py [path/to/engine/concepts/dams]
"""
import json, pathlib, subprocess, sys

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path.home() / 'code/vibes/engine/concepts/dams')
OUT = pathlib.Path(__file__).resolve().parent.parent / 'docs' / 'video'
OFFSET = 4.1          # title card 4.5 s minus the 0.4 s cross-fade
MAX_CUE = 84          # characters per cue: two lines of about 42

def ts(t):
    h, rem = divmod(max(t, 0), 3600)
    m, s = divmod(rem, 60)
    return f'{int(h):02d}:{int(m):02d}:{s:06.3f}'

def cues(cap):
    """Split each spoken line into cues of at most MAX_CUE characters, timed by its words."""
    words = cap['words']
    out = []
    for line in cap['lines']:
        ws = [w for w in words if line['start'] - 0.05 <= w[0] < line['end']]
        if not ws:
            out.append((line['start'], line['end'], line['text']))
            continue
        # The line text carries the punctuation; take words from it in order, timed by ws.
        tokens = line['text'].split()
        times = [w[0] for w in ws][:len(tokens)]
        times += [times[-1]] * (len(tokens) - len(times))
        # Even cues: n pieces of about equal length, cut at the word nearest each share.
        n = -(-len(line['text']) // MAX_CUE)
        ends, run, share = [], 0, len(line['text']) / n
        for i, tok in enumerate(tokens):
            run += len(tok) + 1
            if len(ends) < n - 1 and run >= share * (len(ends) + 1) and i < len(tokens) - 1:
                ends.append(i + 1)
        bounds = [0] + ends + [len(tokens)]
        for k in range(len(bounds) - 1):
            a, b = bounds[k], bounds[k + 1]
            end = times[b] if b < len(tokens) else line['end']
            out.append((times[a], end, ' '.join(tokens[a:b])))
    return out

def wrap(text):
    if len(text) <= 42:
        return text
    mid = len(text) // 2
    cut = min((i for i, c in enumerate(text) if c == ' '), key=lambda i: abs(i - mid))
    return text[:cut] + '\n' + text[cut + 1:]

OUT.mkdir(parents=True, exist_ok=True)
for ep in sorted(p for p in SRC.iterdir() if p.is_dir() and p.name[:2].isdigit()):
    slug = ep.name[3:]
    video = ep / 'out' / 'titled-manim-clean-light.mp4'
    # Same streams, index moved to the front so playback starts before the whole file arrives.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(video), '-c', 'copy', '-movflags', '+faststart',
                    str(OUT / f'{slug}.mp4')], check=True)
    cap = json.loads((ep / 'captions.json').read_text())
    vtt = ['WEBVTT', '']
    for a, b, text in cues(cap):
        vtt += [f'{ts(a + OFFSET)} --> {ts(b + OFFSET)}', wrap(text), '']
    (OUT / f'{slug}.vtt').write_text('\n'.join(vtt))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '2', '-i', str(video), '-frames:v', '1',
                    '-vf', 'scale=1280:-2', '-q:v', '4', str(OUT / f'{slug}.jpg')], check=True)
    print(f'{slug}: {(OUT / f"{slug}.mp4").stat().st_size / 2**20:.1f} MB, {(len(vtt) - 2) // 3} cues')
