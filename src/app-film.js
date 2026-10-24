
/* ===================== Films ===================== */
/* A film whose files are missing (the claude.ai copy of the page ships without docs/video/) hides
   itself rather than showing a dead player; the small poster is the probe, since preload="none"
   fetches nothing from the video until play. Starting one film pauses any other.
   A film block may play only a segment of its file: build.py writes data-start and data-end from
   src/book.json (Depth, not size is split between two chapters). The player starts at the segment's
   start, stops at its end with a short note, and a press of play after the end starts it again. */
(function films() {
  /* a poster in the book's own type over the film's first frame: number, title, part, length, Play */
  function poster(fig, v) {
    let stage = v.parentElement;
    if (!stage.classList.contains('film-stage')) { stage = document.createElement('div'); stage.className = 'film-stage'; v.before(stage); stage.appendChild(v); }
    const no = fig.querySelector('.figno b'), figno = fig.querySelector('.figno'), len = fig.querySelector('.scale-note');
    const part = fig.querySelector('.film-part');
    const title = figno ? [...figno.childNodes].filter(n => n !== no && n !== part).map(n => n.textContent).join('').replace(/^[\s·]+/, '').trim() : '';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'film-poster';
    const k = document.createElement('span'); k.className = 'fp-k'; k.textContent = no ? no.textContent : 'Film';
    const t = document.createElement('span'); t.className = 'fp-t'; t.textContent = title;
    const m = document.createElement('span'); m.className = 'fp-m';
    if (part) { const a = document.createElement('span'); a.textContent = part.textContent; m.appendChild(a); }
    if (len && len.textContent.trim()) { const a = document.createElement('span'); a.textContent = len.textContent.trim(); m.appendChild(a); }
    const pl = document.createElement('span'); pl.className = 'fp-play'; pl.textContent = 'Play';
    b.append(k, t, m, pl);
    b.setAttribute('aria-label', 'Play ' + (no ? no.textContent + ', ' : '') + title + (part ? ', ' + part.textContent : ''));
    stage.appendChild(b);
    b.addEventListener('click', () => { v.play().catch(() => {}); v.focus({ preventScroll: true }); });
    const hide = () => { b.hidden = true; v.classList.add('playing'); };
    v.addEventListener('play', hide);
    v.addEventListener('seeking', hide);
  }
  const vids = [...document.querySelectorAll('figure.film video')];
  vids.forEach(v => {
    const fig = v.closest('figure');
    const probe = new Image();
    probe.onerror = () => { fig.hidden = true; };
    probe.src = v.getAttribute('poster');
    v.querySelector('source')?.addEventListener('error', () => { fig.hidden = true; });
    v.addEventListener('play', () => vids.forEach(o => { if (o !== v && !o.paused) o.pause(); }));
    poster(fig, v);
    // chapter marks (SPEC F.13): <button data-t="118"> seeks the film and plays from there
    fig.querySelectorAll('.film-marks button[data-t]').forEach(b => b.addEventListener('click', () => {
      const t = parseFloat(b.dataset.t) || 0;
      v.currentTime = t; v.play().catch(() => {});
    }));

    const start = parseFloat(fig.dataset.start) || 0, end = parseFloat(fig.dataset.end);
    const meta = bookData().films[fig.id];
    if (!meta || !Number.isFinite(end) || (start <= 0 && end >= meta.duration - 0.01)) return; // the whole file: nothing to do
    let note = null;
    function endNote() {
      if (note) { note.hidden = false; return; }
      note = document.createElement('p');
      note.className = 'film-end';
      // a later segment of the same film elsewhere in the book: say where it continues
      const next = Object.keys(bookData().films).find(k => k !== fig.id && bookData().films[k].film === meta.film && bookData().films[k].start >= end - 0.5);
      if (next) {
        const u = bookData().films[next].unit, a = document.createElement('a');
        a.href = '#' + next; a.textContent = ref(u);
        const part = bookData().films[next].part;
        note.append((part ? part[0].toUpperCase() + part.slice(1) : 'The film') + ' continues in ', a, '.');
      } else note.textContent = 'End of this film’s segment.';
      v.after(note);
    }
    const inSeg = t => t >= start - 0.25 && t < end - 0.05;
    v.addEventListener('play', () => {
      if (!inSeg(v.currentTime)) v.currentTime = start;
      if (note) note.hidden = true;
    });
    v.addEventListener('loadedmetadata', () => { if (v.currentTime < start - 0.25) v.currentTime = start; });
    v.addEventListener('timeupdate', () => {
      if (v.currentTime >= end - 0.05 && !v.paused) { v.pause(); v.currentTime = end; endNote(); }
    });
    v.addEventListener('seeked', () => {
      if (v.currentTime < start - 0.25) v.currentTime = start;
      else if (v.currentTime > end) v.currentTime = end;
    });
  });
})();
