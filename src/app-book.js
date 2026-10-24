/* ===================== The book's own runtime (book/SPEC.md F) ===================== */
/* Everything here reads the page the build wrote: the units (section[data-label]), #book-data, the
   figures. Nothing here changes a figure's maths or an element id that the source gives.
     runningHead   the sticky bar: the unit in view ("4 · Grip"), a progress hairline
     contents      the Contents dialog (every unit, figure and film), opened from the bar
     anchors       a ¶ link on every numbered section heading
     notes         sidenote and margin-note marks become buttons with aria-expanded on narrow screens
     labelScale    each drawing learns its scale (--s), so its labels can keep a readable size
     expand        plates open full screen, turned to landscape on an upright phone
     setFigure     "Set the figure" buttons in worked examples and questions
     embedView     the academy's framed view of the old steps */

const BOOK_UNITS = 'section.chapter, section.prologue, section.epilogue, section.part-opener, section.front, section.back';

/* ---------------------------------------------------------------- links to figures behind a predict box */
/* A figure named in a predict box's data-unlocks stays hidden until the reader answers. A link to it (a
   cross-reference in the prose, the Contents, a #hash on load) would otherwise go nowhere, so it goes to
   the question instead, with a note saying why. The Contents dialog and "Set the figure" use the same
   route. */
function hiddenHost(t) { for (let e = t; e && e !== document.body; e = e.parentElement) if (e.hidden) return e; return null; }
function unlockerOf(host) {
  return $$('.predict[data-unlocks]').find(p => p.dataset.unlocks.split(',').map(s => s.trim()).filter(Boolean)
    .some(sel => { try { return host.matches(sel); } catch (e) { return false; } })) || null;
}
function sendToPredict(pr, behavior) {
  pr.scrollIntoView({ behavior: behavior || 'auto', block: 'center' });
  let n = pr.querySelector('.set-fig-first');
  if (!n) { n = document.createElement('p'); n.className = 'set-fig-first'; n.setAttribute('role', 'status'); n.textContent = 'Answer this first: the figure opens when you do.'; pr.appendChild(n); }
  const first = pr.querySelector('.predict-opts button'); if (first) first.focus({ preventScroll: true });
}
/* go to an element, by way of its predict box when it is still hidden; returns false if nothing was done */
function goToTarget(t) {
  const host = hiddenHost(t);
  if (!host) return false;
  const pr = unlockerOf(host);
  if (pr && !pr.classList.contains('is-done')) { sendToPredict(pr); return true; }
  // no box to answer (a film without its video, an answered reveal): where the block would have been, that
  // is the visible element after it, or failing that before it, or its nearest visible ancestor
  let v = null;
  for (let s = host.nextElementSibling; s && !v; s = s.nextElementSibling) if (!hiddenHost(s)) v = s;
  for (let s = host.previousElementSibling; s && !v; s = s.previousElementSibling) if (!hiddenHost(s)) v = s;
  if (!v) { v = host.parentElement; while (v && hiddenHost(v)) v = v.parentElement; }
  if (v) v.scrollIntoView({ behavior: 'auto', block: v === host.previousElementSibling ? 'end' : 'start' });
  return !!v;
}
(function hiddenLinks() {
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.closest('dialog')) return;
    const t = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!t || !hiddenHost(t)) return;   // a visible target: the browser's own jump
    e.preventDefault();
    if (goToTarget(t)) history.replaceState(null, '', a.getAttribute('href'));
  });
  const atLoad = () => { const id = decodeURIComponent(location.hash.slice(1)); const t = id && document.getElementById(id); if (t && hiddenHost(t)) goToTarget(t); };
  if (document.readyState === 'complete') atLoad(); else window.addEventListener('load', atLoad);
})();
const NARROW = window.matchMedia ? matchMedia('(max-width: 1099px)') : { matches: false, addEventListener() {} };

/* the short name of a unit for the running head: "4 · Grip", "Prologue · 4 August 2014", "Part II · Two kinds of dam" */
function unitShort(sec) {
  const D = bookData();
  if (sec.classList.contains('part-opener')) { const r = D.refs[sec.id]; return r ? { n: r.label, t: r.title } : null; }
  const u = D.units.find(x => x.id === sec.id);
  if (!u) return null;
  if (u.kind === 'chapter') return { n: String(u.n), t: u.title };
  if (u.kind === 'prologue') return { n: 'Prologue', t: u.title };
  if (u.kind === 'epilogue') return { n: 'Epilogue', t: u.title };
  if (sec.id === 'cover') return null;
  return { n: '', t: u.title };
}

/* ---------------------------------------------------------------- the running head */
(function runningHead() {
  const head = $('#runhead'), where = $('#rh-where'), bar = $('#rh-bar');
  if (!head || !where) return;
  const secs = $$(BOOK_UNITS).filter(s => s.id);
  let current = null, ticking = false;
  function update() {
    ticking = false;
    const line = (head.getBoundingClientRect().bottom || 0) + window.innerHeight * 0.25;
    let best = null;
    for (const s of secs) { if (s.offsetParent === null) continue; if (s.getBoundingClientRect().top <= line) best = s; else break; }
    if (best !== current) {
      current = best;
      const u = best && unitShort(best);
      head.classList.toggle('in-unit', !!u);
      head.dataset.unit = best ? best.id : '';
      if (u) {
        where.hidden = false;
        where.href = '#' + best.id;
        where.textContent = '';
        const mini = best.querySelector('header.opener svg.mini');
        if (mini) { const m = mini.cloneNode(true); m.removeAttribute('role'); m.removeAttribute('aria-label'); m.setAttribute('aria-hidden', 'true'); where.appendChild(m); }
        if (u.n) { const b = document.createElement('b'); b.textContent = u.n; where.append(b, ' · '); }
        const t = document.createElement('span'); t.textContent = u.t; where.appendChild(t);
        where.setAttribute('aria-label', 'You are reading ' + (u.n && /^\d+$/.test(u.n) ? 'Chapter ' + u.n + ', ' : u.n ? u.n + ', ' : '') + u.t);
      } else where.hidden = true;
      document.dispatchEvent(new CustomEvent('book:unit', { detail: { id: best ? best.id : null } }));
    }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.setProperty('--p', max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)).toFixed(4) : '0');
  }
  // one update per frame; the timer covers a page that paints no frames (a background tab, a headless run)
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { if (ticking) update(); }); setTimeout(() => { if (ticking) update(); }, 150); } };
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req);
  window.addEventListener('load', req);
  update();
  window.bookCurrentUnit = () => current && current.id;
})();

/* ---------------------------------------------------------------- the Contents dialog */
(function contents() {
  const btn = $('#rh-toc');
  if (!btn || typeof HTMLDialogElement !== 'function') return;
  const D = bookData();
  const dlg = document.createElement('dialog');
  dlg.className = 'toc-dialog'; dlg.id = 'toc-dialog'; dlg.setAttribute('aria-labelledby', 'toc-dialog-h');
  const head = document.createElement('div'); head.className = 'tocd-head';
  const h = document.createElement('h2'); h.id = 'toc-dialog-h'; h.textContent = 'Contents';
  const x = document.createElement('button'); x.type = 'button'; x.className = 'btn'; x.textContent = 'Close';
  x.addEventListener('click', () => dlg.close());
  head.append(h, x);
  const body = document.createElement('div'); body.className = 'tocd-body';
  dlg.append(head, body);

  const partOf = id => { const sec = document.getElementById(id); let p = sec; while (p && (p = p.previousElementSibling)) if (p.classList.contains('part-opener')) return p.id; return null; };
  const figsOf = id => Object.entries(D.refs).filter(([k, r]) => r.unit === id && (r.kind === 'fig' || r.kind === 'film' || r.kind === 'table') && document.getElementById(k));
  let list = null, lastPart = undefined;
  function group(label, href) {
    const p = document.createElement('p'); p.className = 'tocd-part';
    if (href) { const a = document.createElement('a'); a.href = href; a.textContent = label; a.style.color = 'inherit'; a.style.textDecoration = 'none'; p.appendChild(a); } else p.textContent = label;
    body.appendChild(p);
    list = document.createElement('ol'); list.className = 'tocd-list'; body.appendChild(list);
  }
  for (const u of D.units) {
    if (u.id === 'cover' || !document.getElementById(u.id)) continue;
    const part = u.kind === 'chapter' ? u.part : (u.kind === 'front' ? 'front' : u.kind === 'back' ? 'back' : u.kind);
    if (part !== lastPart) {
      lastPart = part;
      if (u.kind === 'chapter') { const r = D.refs[part]; group(r ? r.label + ' · ' + r.title : '', '#' + part); }
      else if (u.kind === 'front') group('Front matter');
      else if (u.kind === 'back') group('At the back');
      else group(u.kind === 'prologue' ? 'Prologue' : 'Epilogue');
    }
    const li = document.createElement('li'); li.dataset.unit = u.id;
    const a = document.createElement('a'); a.className = 'tocd-u'; a.href = '#' + u.id;
    const b = document.createElement('b'); b.textContent = u.kind === 'chapter' ? u.n : '';
    const s = document.createElement('span'); s.textContent = u.title;
    a.append(b, s); li.appendChild(a);
    const fl = figsOf(u.id);
    if (fl.length) {
      const ul = document.createElement('ul'); ul.className = 'tocd-figs';
      for (const [k, r] of fl) {
        const l = document.createElement('li'), fa = document.createElement('a'), fb = document.createElement('b');
        // a film that names its own answer (the last one) goes by its safe title here, as in the Contents
        const t = r.kind === 'film' && D.films[k] && D.films[k].safeTitle ? D.films[k].safeTitle : r.title;
        fa.href = '#' + k; fb.textContent = r.label; fa.append(fb, ' ' + (t || ''));
        l.appendChild(fa); ul.appendChild(l);
      }
      li.appendChild(ul);
    }
    list.appendChild(li);
  }
  void partOf;
  document.body.appendChild(dlg);

  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-controls', 'toc-dialog');
  btn.setAttribute('aria-expanded', 'false');
  function open() {
    const cur = window.bookCurrentUnit && window.bookCurrentUnit();
    $$('li[data-unit]', dlg).forEach(li => { if (li.dataset.unit === cur) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current'); });
    document.documentElement.classList.add('dialog-open');
    dlg.showModal();
    btn.setAttribute('aria-expanded', 'true');
    const here = $('li[aria-current] > .tocd-u', dlg);
    if (here) { here.focus(); here.scrollIntoView({ block: 'center' }); } else x.focus();
  }
  btn.addEventListener('click', e => { e.preventDefault(); open(); });
  btn.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); open(); } });
  dlg.addEventListener('close', () => { document.documentElement.classList.remove('dialog-open'); btn.setAttribute('aria-expanded', 'false'); if (!dlg.dataset.go) btn.focus(); delete dlg.dataset.go; });
  dlg.addEventListener('click', e => {
    if (e.target === dlg) { dlg.close(); return; } // the backdrop
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    dlg.dataset.go = '1';
    dlg.close();
    const t = document.getElementById(a.getAttribute('href').slice(1));
    if (t) {
      history.replaceState(null, '', a.getAttribute('href'));
      if (goToTarget(t)) return;   // still behind its predict box: the box, with focus on its first answer
      t.scrollIntoView({ behavior: 'auto', block: 'start' });
      if (!t.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SECTION)$/.test(t.tagName)) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }
  });
})();

/* ---------------------------------------------------------------- ¶ anchors on numbered sections */
(function anchors() {
  $$('section h3[id]').forEach(h => {
    if (!h.querySelector('.secno') || h.querySelector('.h-anchor')) return;
    const a = document.createElement('a');
    a.className = 'h-anchor'; a.href = '#' + h.id; a.textContent = '¶';
    a.setAttribute('aria-label', 'Link to ' + (bookData().refs[h.id] ? bookData().refs[h.id].label : 'this section'));
    h.insertBefore(a, h.firstChild);
  });
})();

/* ---------------------------------------------------------------- sidenotes and margin notes */
/* The markup works without JavaScript (a label for a hidden checkbox). Here each mark becomes a real
   button: on narrow screens it opens and closes its note and says so (aria-expanded); on wide screens
   the note already sits in the margin, so the mark only points at it and stays out of the tab order. */
(function notes() {
  const marks = $$('label.sn-ref, label.mn-ref');
  if (!marks.length) return;
  const pairs = [];
  marks.forEach((lab, i) => {
    const box = document.getElementById(lab.htmlFor);
    const note = box && box.nextElementSibling;
    if (!box || !note || !/\b(sidenote|marginnote)\b/.test(note.className)) return;
    if (!note.id) note.id = (box.id || 'note-' + i) + '-text';
    const b = document.createElement('button');
    b.type = 'button'; b.className = lab.className; b.setAttribute('aria-controls', note.id);
    const kind = { history: 'History', curious: 'For the curious', units: 'Units', source: 'Source' }[note.dataset.kind] || 'Note';
    b.dataset.kind = kind;
    lab.replaceWith(b);
    // keep the mark on the line of the word it belongs to: wrap that word and the mark in a no-wrap span
    const prev = b.previousSibling, w = prev && prev.nodeType === 3 && prev.data.match(/\S+$/);
    if (w) {
      prev.data = prev.data.slice(0, prev.data.length - w[0].length);
      const glue = document.createElement('span'); glue.className = 'sn-glue';
      b.before(glue); glue.append(document.createTextNode(w[0]), b);
    }
    b.addEventListener('click', () => {
      if (NARROW.matches) { box.checked = !box.checked; b.setAttribute('aria-expanded', box.checked ? 'true' : 'false'); }
      else { note.classList.add('is-flash'); setTimeout(() => note.classList.remove('is-flash'), 1200); }
    });
    pairs.push({ b, box, note, kind, sn: b.classList.contains('sn-ref') });
  });
  // the number CSS shows is a counter; give each button the same number in words
  const counts = new Map();
  pairs.forEach(p => {
    if (!p.sn) return;
    const sec = p.b.closest(BOOK_UNITS);
    const n = (counts.get(sec) || 0) + 1; counts.set(sec, n);
    p.n = n;
  });
  function mode() {
    pairs.forEach(p => {
      const label = (p.sn ? 'Note ' + p.n + ', ' : '') + p.kind;
      if (NARROW.matches) {
        p.b.removeAttribute('tabindex'); p.b.removeAttribute('aria-hidden');
        p.b.setAttribute('aria-expanded', p.box.checked ? 'true' : 'false');
        p.b.setAttribute('aria-label', label);
      } else {
        // wide: the note is visible beside its line and read in order, so the mark is decoration
        p.b.removeAttribute('aria-expanded'); p.b.setAttribute('tabindex', '-1'); p.b.setAttribute('aria-hidden', 'true');
        p.b.removeAttribute('aria-label');
      }
    });
  }
  mode();
  NARROW.addEventListener ? NARROW.addEventListener('change', mode) : NARROW.addListener(mode);
})();

/* ---------------------------------------------------------------- drawing scale for label sizes */
/* --s = rendered width ÷ viewBox width. styles-book.css keeps each label at least 11 px on a phone
   (within a cap, so a dense drawing at thumbnail size doesn't collide with itself); Expand lifts the cap. */
(function labelScale() {
  const svgs = $$('svg.dwg').filter(s => s.viewBox && s.viewBox.baseVal && s.viewBox.baseVal.width);
  // the layout width, not the box on screen: a plate turned a quarter turn (Expand) keeps its own width
  function one(s, w) {
    w = w || s.clientWidth || s.getBoundingClientRect().width;
    if (w > 0) s.style.setProperty('--s', (w / s.viewBox.baseVal.width).toFixed(3));
  }
  if (window.ResizeObserver) { const ro = new ResizeObserver(es => es.forEach(e => one(e.target, e.contentRect.width))); svgs.forEach(s => ro.observe(s)); }
  else { svgs.forEach(one); window.addEventListener('resize', () => svgs.forEach(one)); }
})();

/* ---------------------------------------------------------------- Expand: plates full screen */
/* Every wide plate with a drawing gets an Expand button on a narrow screen (How to read promises it).
   The figure itself moves into a full-screen dialog, controls and all, so nothing is copied and every
   id stays unique; closing puts it back. On a phone held upright the dialog turns a quarter turn, so
   the drawing lies along the long side of the screen: hold the phone sideways to read it. */
(function expand() {
  if (typeof HTMLDialogElement !== 'function') return;
  // every plate that reaches past the text column and holds a drawing: the six instruments, the
  // interactive figures, the static plates and the case files (not films, not tables)
  const plates = $$('figure.wide[id], figure.full[id]').filter(f => !f.classList.contains('film') && !f.classList.contains('table') && f.querySelector('svg.dwg, canvas'));
  if (!plates.length) return;
  const PORTRAIT = matchMedia('(orientation: portrait) and (max-width: 899px)');
  const dlg = document.createElement('dialog');
  dlg.className = 'plate-dialog'; dlg.id = 'plate-dialog'; dlg.setAttribute('aria-labelledby', 'plate-dialog-t');
  dlg.innerHTML = '<div class="plate-frame"><div class="plate-bar"><p id="plate-dialog-t"></p><span class="plate-hint">Hold your phone sideways</span><button type="button" class="btn">Close</button></div><div class="plate-scroll"></div></div>';
  document.body.appendChild(dlg);
  const title = $('#plate-dialog-t', dlg), scroller = $('.plate-scroll', dlg), closeBtn = $('.plate-bar .btn', dlg);
  let open = null; // { fig, slot, btn }
  const ICON = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M8.5,1.5 h4 v4 M12.5,1.5 l-4.5,4.5 M5.5,12.5 h-4 v-4 M1.5,12.5 l4.5,-4.5"/></svg>';

  function relayout() { window.dispatchEvent(new Event('resize')); }
  function show(fig, btn) {
    if (open) hide();
    const slot = document.createElement('div');
    slot.className = 'plate-slot';
    const back = document.createElement('button'); back.type = 'button'; back.className = 'btn'; back.textContent = 'Bring it back';
    slot.append((bookData().refs[fig.id] ? ref(fig.id) : 'This figure') + ' is open full screen. ', back);
    back.addEventListener('click', hide);
    fig.before(slot);
    scroller.appendChild(fig);
    title.textContent = (bookData().refs[fig.id] ? ref(fig.id) + ' · ' + (bookData().refs[fig.id].title || '') : '');
    dlg.classList.toggle('turn', PORTRAIT.matches);
    open = { fig, slot, btn };
    dlg.showModal();
    document.documentElement.classList.add('dialog-open');
    scroller.scrollTop = 0;
    closeBtn.focus();
    relayout(); setTimeout(relayout, 60);
  }
  function hide() {
    if (!open) return;
    const { fig, slot, btn } = open;
    open = null;
    slot.replaceWith(fig);
    if (dlg.open) dlg.close();
    document.documentElement.classList.remove('dialog-open');
    relayout(); setTimeout(relayout, 60);
    fig.scrollIntoView({ block: 'start', behavior: 'auto' });
    btn.focus({ preventScroll: true });
  }
  closeBtn.addEventListener('click', hide);
  dlg.addEventListener('cancel', e => { e.preventDefault(); hide(); });
  const onTurn = () => { if (open) { dlg.classList.toggle('turn', PORTRAIT.matches); relayout(); } };
  PORTRAIT.addEventListener ? PORTRAIT.addEventListener('change', onTurn) : PORTRAIT.addListener(onTurn);

  plates.forEach(fig => {
    const top = $('.sheet-top', fig);
    if (!top) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fig-expand'; b.innerHTML = ICON + '<span>Expand</span>';
    b.setAttribute('aria-label', 'Expand ' + (bookData().refs[fig.id] ? ref(fig.id) : 'this figure') + ' to full screen');
    b.addEventListener('click', () => show(fig, b));
    top.appendChild(b);   // in the title strip, on every figure: over the drawing it hid the toe and the seepage face
  });
  window.bookExpand = { show: id => { const f = document.getElementById(id); const b = f && $('.fig-expand', f); if (b) show(f, b); }, hide };
})();

/* ===================== The book: "Set the figure" buttons ===================== */
/* A worked example or a question can carry <button class="set-fig" data-set='{…}'> (book/SPEC.md
   F.6). Pressing it sets the named figure's controls in order, presses any buttons it lists,
   scrolls to the figure, marks the controls it changed for a moment, and offers a way back. The JSON:
     { "fig": "fig-block", "set": { "bk-a": 25, "dc-mat": "silt", "zn-tabs": "2", "bd-presets": "cored" },
       "click": ["#bd-test"] }
   A range input gets its value (clamped to its range and step) and an input and a change event, as a
   drag would; a select or checkbox gets its value and a change event; any other control id names a
   group (a .seg, zn-tabs, bd-tabs, bd-presets, bd-palette, gr-exps …) and gets a click on the button
   whose data-v, data-i, data-m, data-p or data-exp matches, unless it is already pressed. A figure
   still hidden behind an unanswered predict box sends the reader to the question first.
   tests/test-book.js checks every data-set against the page's controls; tests/test-setfig.js presses
   one for every figure in headless Chrome. */
const SET_ATTRS = ['data-v', 'data-i', 'data-m', 'data-p', 'data-exp'];
function setControl(id, val) {
  const el = document.getElementById(id);
  if (!el) return { ok: false, why: 'no control #' + id };
  if (el.tagName === 'INPUT' && el.type === 'range') {
    if (el.disabled) return { ok: false, why: '#' + id + ' is locked' };
    const min = +(el.min || 0), max = +(el.max || 100), step = el.step === 'any' ? 0 : +(el.step || 1);
    let v = Math.min(max, Math.max(min, +val));
    if (step) v = min + Math.round((v - min) / step) * step;
    const legal = Math.abs(v - +val) < 1e-9;
    el.value = String(+v.toFixed(6));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: legal, why: legal ? '' : '#' + id + ': ' + val + ' is outside its range or step', hl: el.closest('.range') || el };
  }
  if (el.tagName === 'INPUT' && el.type === 'checkbox') {
    el.checked = !!val && val !== 'false'; el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, hl: el.closest('label') || el };
  }
  if (el.tagName === 'SELECT' || (el.tagName === 'INPUT')) {
    el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: el.value === String(val), hl: el };
  }
  const s = String(val).replace(/"/g, '\\"');
  let b = null;
  for (const a of SET_ATTRS) { b = el.querySelector('[' + a + '="' + s + '"]'); if (b) break; }
  if (!b) return { ok: false, why: '#' + id + ' has no button for "' + val + '"' };
  if (b.disabled) return { ok: false, why: '#' + id + ' "' + val + '" is locked' };
  const on = b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-selected') === 'true';
  if (!on || id === 'bd-presets' || b.hasAttribute('data-exp')) b.click();
  return { ok: true, hl: b };
}
function setFigure(spec) {
  const fig = document.getElementById(spec.fig);
  if (!fig) return { ok: false, errors: ['no figure #' + spec.fig] };
  if (fig.hidden) return { ok: false, locked: true, errors: ['#' + spec.fig + ' is hidden until its predict box is answered'] };
  const errors = [], hls = [];
  for (const [k, v] of Object.entries(spec.set || {})) {
    const r = setControl(k, v);
    if (!r.ok) errors.push(r.why);
    if (r.hl) hls.push(r.hl);
  }
  for (const sel of spec.click || []) {
    const b = fig.querySelector(sel);
    if (b && !b.disabled) { b.click(); hls.push(b); } else errors.push('no ' + sel + ' in #' + spec.fig);
  }
  return { ok: !errors.length, errors, hls };
}
(function setFigureButtons() {
  let pill = null, hlTimer = 0;
  function back(btn) {
    if (pill) pill.remove();
    const owner = btn.closest('section.we[id], li.q[id], [id]');
    pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'btn back-pill';
    pill.textContent = '↑ Back to ' + (owner && bookData().refs[owner.id] ? ref(owner.id) : 'the text');
    pill.addEventListener('click', () => {
      btn.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
      btn.focus({ preventScroll: true });
      pill.remove(); pill = null;
    });
    document.body.appendChild(pill);
  }
  function glow(fig, els) {
    clearTimeout(hlTimer);
    $$('.set-hl').forEach(e => e.classList.remove('set-hl'));
    els.forEach(e => e.classList.add('set-hl'));
    fig.classList.add('set-target');
    hlTimer = setTimeout(() => { els.forEach(e => e.classList.remove('set-hl')); fig.classList.remove('set-target'); }, RM ? 3000 : 2400);
  }
  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('button.set-fig');
    if (!btn) return;
    let spec;
    try { spec = JSON.parse(btn.dataset.set); } catch (err) { console.error('set-fig: bad JSON', err); return; }
    const fig = document.getElementById(spec.fig);
    if (!fig) { console.error('set-fig: no figure #' + spec.fig); return; }
    if (fig.hidden) {
      const pr = unlockerOf(fig);
      if (pr) { sendToPredict(pr, RM ? 'auto' : 'smooth'); return; }
    }
    const r = setFigure(spec);
    r.errors.forEach(m => console.error('set-fig: ' + m));
    fig.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
    if (!fig.hasAttribute('tabindex')) fig.setAttribute('tabindex', '-1');
    fig.focus({ preventScroll: true });
    glow(fig, r.hls || []);
    back(btn);
  });
  window.bookSetFigure = setFigure; // for tests/test-setfig.js
})();

/* ===================== Embedded view for the academy (?embed=<old step id>) ===================== */
/* The academy's reading lessons (docs/academy) load this page in a frame as ../index.html?embed=types
   and hide every section.chapter but #types. The steps are chapters now, and some steps' material is
   spread over two or three chapters, so the page shows the chapters that hold an old step's material
   and takes them out of the academy's selector (class chapter → chapter-embedded). Anything else
   (cover, contents, part openers, back matter) is hidden. */
(function embedView() {
  const want = new URLSearchParams(location.search).get('embed');
  if (!want) return;
  const STEPS = {
    beach: ['ch-beach'], pressure: ['ch-depth'], flow: ['ch-head'], strength: ['ch-grip', 'ch-trapped'],
    types: ['ch-two-dams'], raising: ['ch-raising'], zones: ['ch-zones', 'ch-erosion'],
    seepage: ['ch-concrete', 'ch-seepage', 'ch-erosion'], build: ['ch-slope', 'ch-build']
  };
  let ids = STEPS[want];
  if (!ids) {
    const el = document.getElementById(want), sec = el && el.closest('section.chapter, section.prologue, section.epilogue');
    ids = sec ? [sec.id] : [];
  }
  if (!ids.length) return;
  document.documentElement.classList.add('book-embed');
  ids.forEach(id => {
    const s = document.getElementById(id);
    if (!s) return;
    s.classList.add('embed-show');
    if (s.classList.contains('chapter')) { s.classList.remove('chapter'); s.classList.add('chapter-embedded'); }
  });
})();
