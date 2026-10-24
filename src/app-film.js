/* ===================== Films ===================== */
/* Each film block (book/SPEC.md F.13) gets:
   - a poster in the book's own type over the film's first frame: number, title, part, length, the
     film's question and a real Play button; pressing it hands over to the browser's own player;
   - segment playback: build.py writes data-start and data-end from src/book.json. The player starts
     at the segment's start and pauses at its end with an end card, which offers to keep watching
     (the rest of the file) or says where the next part plays. Depth, not size is split between two
     chapters; two other films stop before a closing question the reader has already answered;
   - chapter marks and transcript paragraphs (button[data-t]) that seek the film and play, and the
     mark for the passage now playing is shown as current.
   A film whose files are missing (the claude.ai copy of the page ships without docs/video/) hides
   itself rather than showing a dead player; the small poster image is the probe, since
   preload="none" fetches nothing from the video until play. Starting one film pauses any other. */
(function films() {
  const clock = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const vids = [...document.querySelectorAll('figure.film video')];

  vids.forEach(v => {
    const fig = v.closest('figure');
    let stage = v.parentElement;
    if (!stage.classList.contains('film-stage')) { stage = el('div', 'film-stage'); v.before(stage); stage.appendChild(v); }

    // the probe, and pause-the-others
    const probe = new Image();
    probe.onerror = () => { fig.hidden = true; };
    probe.src = v.getAttribute('poster');
    v.querySelector('source')?.addEventListener('error', () => { fig.hidden = true; });
    v.addEventListener('play', () => vids.forEach(o => { if (o !== v && !o.paused) o.pause(); }));

    // the segment: [start, end) of the file; "open" once the reader asks to keep watching past the end
    const meta = bookData().films[fig.id] || {};
    const start = parseFloat(fig.dataset.start) || 0;
    const fileEnd = meta.duration || Infinity;
    let end = Number.isFinite(parseFloat(fig.dataset.end)) ? parseFloat(fig.dataset.end) : fileEnd;
    const cut = end < fileEnd - 0.05;          // stops before the file ends
    let open = false;                          // the reader chose to watch on
    const lo = () => (open ? 0 : start), hi = () => (open ? fileEnd : end);

    /* ---- the poster ---- */
    const no = fig.querySelector('.figno b'), figno = fig.querySelector('.figno'), len = fig.querySelector('.scale-note');
    const partEl = fig.querySelector('.film-part');
    const title = figno ? [...figno.childNodes].filter(n => n !== no && n !== partEl).map(n => n.textContent).join('').replace(/^[\s·]+/, '').trim() : '';
    const poster = el('div', 'film-poster');
    poster.appendChild(el('span', 'fp-k', no ? no.textContent : 'Film'));
    poster.appendChild(el('span', 'fp-t', title));
    const m = el('span', 'fp-m');
    if (partEl) m.appendChild(el('span', null, partEl.textContent));
    if (len && len.textContent.trim()) m.appendChild(el('span', null, len.textContent.replace(/\s*·\s*captions\s*$/, '').trim()));
    poster.appendChild(m);
    if (fig.dataset.question) poster.appendChild(el('span', 'fp-q', fig.dataset.question));
    const play = el('button', 'fp-play', 'Play');
    play.type = 'button';
    play.setAttribute('aria-label', 'Play ' + (no ? no.textContent + ', ' : '') + title + (partEl ? ', ' + partEl.textContent : ''));
    poster.appendChild(play);
    stage.appendChild(poster);
    const go = () => { v.play().catch(() => {}); v.focus({ preventScroll: true }); };
    play.addEventListener('click', e => { e.stopPropagation(); go(); });
    poster.addEventListener('click', go);   // the whole frame plays too; the button is the keyboard's way in
    const started = () => { poster.hidden = true; v.classList.add('playing'); };
    v.addEventListener('play', started);
    v.addEventListener('seeking', started);

    /* ---- the end card ---- */
    let card = null;
    function endCard() {
      if (card) { card.hidden = false; card.querySelector('button')?.focus({ preventScroll: true }); return; }
      card = el('div', 'film-endcard');
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', 'End of this part of the film');
      const films = bookData().films;
      const next = Object.keys(films).find(k => k !== fig.id && films[k].film === meta.film && films[k].start >= end - 0.5);
      card.appendChild(el('p', 'fe-k', meta.part ? 'End of ' + meta.part : 'This chapter stops here'));
      const p = el('p', 'fe-t');
      if (next) {
        const a = el('a', null, ref(next));
        a.href = '#' + next;
        const part = films[next].part;
        p.append((part ? part[0].toUpperCase() + part.slice(1) : 'The rest of the film') + ' is ', a, ', in ' + ref(films[next].unit) + '.');
      } else {
        if (meta.tail) p.innerHTML = meta.tail;  // build-time markup from book.json: text and links to the book's own ids
        else p.textContent = 'The film goes on from here.';
      }
      card.appendChild(p);
      const row = el('p', 'fe-row');
      const more = el('button', 'btn fe-more', next ? 'Keep watching here' : 'Watch the rest');
      more.type = 'button';
      more.addEventListener('click', () => { open = true; card.hidden = true; v.play().catch(() => {}); });
      const again = el('button', 'btn fe-again', 'Watch again');
      again.type = 'button';
      again.addEventListener('click', () => { card.hidden = true; v.currentTime = start; v.play().catch(() => {}); });
      row.append(more, again);
      card.appendChild(row);
      stage.appendChild(card);
      more.focus({ preventScroll: true });
    }
    const hideCard = () => { if (card) card.hidden = true; };

    /* ---- segment playback ---- */
    let timer = 0;
    function stopAtEnd() {
      clearTimeout(timer);
      if (open || !cut || v.paused) return;
      const left = (end - v.currentTime) / (v.playbackRate || 1);
      if (left <= 0.04) { v.pause(); v.currentTime = end; endCard(); return; }
      // timeupdate comes only every quarter second or so: aim a timer at the end for a clean stop
      if (left < 1.2) timer = setTimeout(stopAtEnd, Math.max(10, left * 1000 - 20));
    }
    v.addEventListener('timeupdate', stopAtEnd);
    v.addEventListener('play', () => {
      const t = v.currentTime;
      if (t < lo() - 0.25 || t >= hi() - 0.05) v.currentTime = t >= hi() - 0.05 && !open ? start : Math.max(lo(), Math.min(t, hi()));
      hideCard();
      stopAtEnd();
    });
    v.addEventListener('pause', () => clearTimeout(timer));
    v.addEventListener('loadedmetadata', () => { if (v.currentTime < lo() - 0.25) v.currentTime = lo(); });
    v.addEventListener('seeked', () => {
      if (v.currentTime < lo() - 0.25) v.currentTime = lo();
      else if (v.currentTime > hi()) v.currentTime = hi();
      if (v.currentTime < hi() - 0.05) hideCard();
      stopAtEnd();
    });

    /* ---- chapter marks and transcript: seek and play ---- */
    const seekers = [...fig.querySelectorAll('.film-marks button[data-t], .film-transcript button[data-t]')];
    seekers.forEach(b => b.addEventListener('click', () => {
      const t = parseFloat(b.dataset.t) || 0;
      if (t < start - 0.01 || t >= end) open = true;   // a time outside the segment is a request to watch on
      hideCard();
      v.currentTime = Math.max(lo(), Math.min(t, hi()));
      v.play().catch(() => {});
      const r = stage.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) stage.scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' });
    }));
    // the mark and the transcript paragraph for what is playing now
    const marks = [...fig.querySelectorAll('.film-marks button[data-t]')].map(b => [parseFloat(b.dataset.t), b.closest('li')]);
    const paras = [...fig.querySelectorAll('.film-transcript button[data-t]')].map(b => [parseFloat(b.dataset.t), b.closest('p')]);
    function mark(list, attr) {
      const t = v.currentTime;
      let cur = null;
      for (const [s, li] of list) if (s <= t + 0.3) cur = li;
      for (const [, li] of list) { if (li === cur) li.setAttribute(attr, 'true'); else li.removeAttribute(attr); }
    }
    v.addEventListener('timeupdate', () => { if (v.classList.contains('playing')) { mark(marks, 'aria-current'); mark(paras, 'data-now'); } });

    // the timestamps in the transcript read as times to a screen reader as well
    fig.querySelectorAll('.film-transcript button[data-t]').forEach(b => { if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', 'Play from ' + clock(+b.dataset.t)); });
  });
})();
