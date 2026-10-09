#!/usr/bin/env python3
"""Assemble the page from src/.

- docs/index.html    the course as a guided chapter, standalone (open it directly, or serve it with GitHub Pages)
- index.html         body-only version of the chapter, used for the claude.ai artifact (git-ignored)
- app.bundle.js      the chapter's combined script, for `node --check` (git-ignored)
- docs/classic.html  the original single long page, which the Dams Academy reading lessons embed

chapter.html and body.html pull in other markup files with <!-- @include name.html --> lines.
Figures live in src/figs/ and are shared by both pages.
Optional parts that don't exist yet are skipped, so the page always builds.
"""
import pathlib, re
import os
root = pathlib.Path(__file__).parent
out = pathlib.Path(os.environ.get('OUT', root))  # OUT=/some/dir builds elsewhere (parallel work)
src = root / 'src'
def read(n):
    f = src / n
    return f.read_text() if f.exists() else ''
CSS = ['styles.css', 'styles-ground.css', 'styles-grains.css', 'styles-build.css', 'styles-tutor.css']
APP = ['app-core.js', 'app-glossary.js', 'app-ground.js', 'app-grains.js', 'app-zones.js', 'app-seep.js', 'app-build.js', 'app-tutor.js']
CHAPTER_CSS = ['styles-chapter.css']
CHAPTER_APP = ['app-pager.js']
WORKERS = [('seep-src', 'seepage-solver.js'), ('stab-src', 'stability-solver.js')]
fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400..700;1,400'
         '&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400&display=swap">')
def page(body_file, css, app_files):
    """Assemble one page: styles, markup (with includes), solver sources, then the script."""
    app = "(() => {\n'use strict';\n" + ''.join(read(n) for n in app_files) + "\n})();\n"
    markup = read(body_file)
    for _ in range(4):  # includes may nest
        markup = re.sub(r'<!-- @include ([\w./-]+) -->', lambda m: read(m.group(1)), markup)
    body = (
        '<title>Dams in Section</title>\n' + fonts + '\n<style>\n' + '\n'.join(read(n) for n in css) + '\n</style>\n'
        + markup
        + ''.join(f'\n<script id="{i}">\n{read(n)}\n</script>\n' for i, n in WORKERS if read(n))
        + '<script>\n' + app + '</script>\n'
    )
    return body, app
def standalone(body):
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
            '<style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>'
            '</head><body>\n' + body + '</body></html>')

(out / 'docs').mkdir(parents=True, exist_ok=True)
# The course: a guided chapter, one page at a time (chapter.html + its parts).
body, app = page('chapter.html', CSS + CHAPTER_CSS, APP + CHAPTER_APP)
(out / 'index.html').write_text(body)
(out / 'app.bundle.js').write_text(app)
(out / 'docs' / 'index.html').write_text(standalone(body))
print('index.html', len(body), 'bytes')
# The original single long page, kept because the Dams Academy reading lessons embed its sheets.
body, _ = page('body.html', CSS, APP)
(out / 'docs' / 'classic.html').write_text(standalone(body))
print('docs/classic.html', len(body), 'bytes')

# ---- Dams Academy (academy/ -> docs/academy/): the multi-page teaching site.
# Static files copied as they are, plus the shared solver and the shared colour tokens.
import shutil
css = read('styles.css')
tokens = css[:css.index('* { box-sizing')].split('*/', 1)[1].strip()  # drop the layout comment
acad_src, acad_out = root / 'academy', out / 'docs' / 'academy'
if acad_out.exists():
    shutil.rmtree(acad_out)
shutil.copytree(acad_src, acad_out)
shutil.copy(src / 'seepage-solver.js', acad_out / 'js' / 'seepage-solver.js')
out_css = acad_out / 'styles.css'
out_css.write_text(out_css.read_text().replace('/* @tokens */', tokens))
(out / 'docs' / '.nojekyll').write_text('')  # GitHub Pages: serve docs/ as-is, no Jekyll pass
print('docs/academy/', sum(p.stat().st_size for p in acad_out.rglob('*') if p.is_file()), 'bytes')
