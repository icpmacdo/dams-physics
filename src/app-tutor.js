
/* ===================== Tutor: "Why did that happen?" ===================== */
/* Each interactive figure registers a describe() with tutorRegister (app-core). A button on the figure
   opens a panel that sends Claude the figure's live state and the reader's question, and streams back a
   plain-language explanation. It uses the artifact's `sample` capability, on the reader's own Claude
   account, so it only appears where the viewer supports it (not in the standalone docs/ page). */
(function tutor() {
  if (!window.claude || typeof window.claude.use !== 'function') return;

  const RULES = [
    'You are the tutor inside "Dams in Section", an interactive course that teaches how dams stand and fail to a curious adult with no engineering background.',
    'The course builds everything from one idea: soil is strong because its grains press on each other, and water pressure in the pores pushes them apart and steals that strength (effective stress = total stress − pore water pressure). Its steps, in order: 1 The beach (dry, damp and saturated sand). 2 Pressure grows with depth. 3 Water moves through ground (permeability, head, Darcy). 4 Water pressure steals strength (effective stress, suction, loose vs dense grains, liquefaction). 5 Hydroelectric vs tailings dams. 6 Raising tailings dams: upstream, downstream, centreline. 7 Dam zones (core, filters, shells, drains). 8 Seepage paths, piping and uplift. 9 Build your own dam (seepage solver + slope stability).',
    'How to answer: explain what the reader is seeing in the figure, using the live state below, the numbers it shows, and the cause-and-effect chain behind them. Connect it back to water pressure and grain contact when it fits. Use plain words, and when you use a technical term, say what it means in a few words. Use an everyday comparison if it helps. Be accurate; if the figure simplifies something, say so briefly. Don\'t invent numbers that aren\'t in the state. Keep it under about 160 words unless the reader asks for more. Write short paragraphs of plain text: no headings, no tables, no bullet lists unless steps are needed, **bold** at most for one or two key words. Canadian spelling. End with one short suggestion of something to try next in the figure when that would help.'
  ].join('\n\n');

  const STARTERS = ['Why did that happen?', 'What should I try next?', 'Where does this matter in a real dam?'];
  let sample = null, ctl = null, turns = [], ctx = null, busy = false;

  /* ---------- panel ---------- */
  const panel = document.createElement('aside');
  panel.className = 'tutor';
  panel.id = 'tutor';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Tutor');
  panel.innerHTML =
    '<div class="tutor-head"><div><span class="tutor-kicker">Ask the tutor</span><b class="tutor-fig"></b></div>' +
    '<button class="btn tutor-x" type="button" id="tutor-close" aria-label="Close tutor">Close</button></div>' +
    '<div class="tutor-log" aria-live="polite"></div>' +
    '<div class="tutor-starters"></div>' +
    '<form class="tutor-form" id="tutor-form"><label class="sr" for="tutor-q">Your question</label>' +
    '<input id="tutor-q" type="text" autocomplete="off" placeholder="Ask about this figure…">' +
    '<button class="btn primary" type="submit" id="tutor-send">Ask</button>' +
    '<button class="btn" type="button" id="tutor-stop" hidden>Stop</button></form>' +
    '<p class="tutor-note">Answers come from Claude on your own account and see only this figure\'s current settings. Check anything important against the text.</p>';
  document.body.appendChild(panel);
  const logEl = panel.querySelector('.tutor-log'), figEl = panel.querySelector('.tutor-fig');
  const startersEl = panel.querySelector('.tutor-starters'), form = panel.querySelector('#tutor-form');
  const qIn = panel.querySelector('#tutor-q'), sendBtn = panel.querySelector('#tutor-send'), stopBtn = panel.querySelector('#tutor-stop');
  STARTERS.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = s;
    b.addEventListener('click', () => ask(s));
    startersEl.appendChild(b);
  });
  panel.querySelector('#tutor-close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });
  stopBtn.addEventListener('click', () => ctl && ctl.abort());
  form.addEventListener('submit', e => { e.preventDefault(); const q = qIn.value.trim(); if (q) { qIn.value = ''; ask(q); } });

  function close() { panel.hidden = true; if (ctl) ctl.abort(); if (ctx && ctx.btn) ctx.btn.focus(); }

  function open(id, btn) {
    const reg = tutorFigs.get(id);
    if (!reg) return;
    if (!ctx || ctx.id !== id) { turns = []; logEl.textContent = ''; }
    ctx = { id, reg, btn };
    figEl.textContent = reg.title;
    panel.hidden = false;
    startersEl.hidden = turns.length > 0;
    qIn.focus({ preventScroll: true });
  }

  /* light formatting: paragraphs and **bold**, built with text nodes only */
  function render(el, text) {
    el.textContent = '';
    text.split(/\n{2,}/).forEach(par => {
      const p = document.createElement('p');
      par.split(/(\*\*[^*]+\*\*)/).forEach(bit => {
        if (/^\*\*[^*]+\*\*$/.test(bit)) { const b = document.createElement('b'); b.textContent = bit.slice(2, -2); p.appendChild(b); }
        else p.appendChild(document.createTextNode(bit));
      });
      el.appendChild(p);
    });
  }
  function bubble(cls, text) {
    const d = document.createElement('div');
    d.className = 'tutor-msg ' + cls;
    if (text != null) render(d, text);
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
    return d;
  }
  function figureText(id) { // the caption and nearby text of the figure, so Claude reads what the reader reads
    const el = document.getElementById(id);
    if (!el) return '';
    const sec = el.closest('section');
    const head = sec && sec.querySelector('h2');
    const cap = Array.from(el.querySelectorAll('.caption, figcaption, .things, p')).map(n => n.textContent.replace(/\s+/g, ' ').trim()).join(' ');
    return ((head ? 'Section: ' + head.textContent.trim() + '\n' : '') + cap).slice(0, 2500);
  }
  function errCopy(code) {
    if (code === 'rate_limited') return 'Too many questions at once. Wait a moment, then ask again.';
    if (code === 'session_expired') return 'Sign in to Claude again, then ask again.';
    if (code === 'refused') return 'The tutor couldn\'t answer that one. Try asking it a different way.';
    if (code === 'empty_completion') return 'No answer came back. Try a simpler question.';
    return 'The answer was interrupted. Ask again to retry.';
  }

  async function ask(q) {
    if (busy || !sample || !ctx) return;
    let state = '';
    try { state = String(ctx.reg.describe() || ''); if (!ctx.reg.auto && lastAction.has(ctx.id)) state += '\nLast thing the reader did: ' + lastAction.get(ctx.id); } catch (e) { state = '(state unavailable)'; }
    bubble('you', q);
    startersEl.hidden = true;
    const out = bubble('claude');
    out.classList.add('thinking'); out.textContent = 'Thinking…';
    const msg = 'Figure: ' + ctx.reg.title + '\n\nWhat the figure shows right now:\n' + state +
      '\n\nText around the figure:\n' + figureText(ctx.id) + '\n\nThe reader asks: ' + q;
    turns.push({ role: 'user', content: msg });
    if (turns.length > 9) turns = turns.slice(-9);
    while (turns.length && turns[0].role !== 'user') turns.shift();
    busy = true; sendBtn.disabled = true; stopBtn.hidden = false;
    ctl = new AbortController();
    try {
      const r = await sample([{ role: 'user', content: RULES }].concat(turns), {
        cache: false, signal: ctl.signal,
        onText: ({ text }) => { out.classList.remove('thinking'); render(out, text); logEl.scrollTop = logEl.scrollHeight; }
      });
      turns.push({ role: 'assistant', content: r.text });
      if (r.truncated) bubble('note', 'The answer was cut short. Ask for less at a time.');
    } catch (e) {
      out.classList.remove('thinking');
      const code = e && e.code;
      if (e && e.text) { render(out, e.text); turns.push({ role: 'assistant', content: e.text }); } else out.remove();
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') {
        hideAll(); bubble('note', 'The tutor isn\'t available here. Everything else on the page still works.');
      } else if (code !== 'cancelled') bubble('note', errCopy(code));
      if (!(e && e.text)) turns.pop(); // drop the unanswered question so the chat stays user/assistant
    } finally {
      busy = false; sendBtn.disabled = false; stopBtn.hidden = true; ctl = null;
    }
  }

  /* ---------- per-figure buttons ---------- */
  const buttons = [];
  function hideAll() { buttons.forEach(b => (b.hidden = true)); }
  /* Figures without their own describe() get one read from their controls and readouts. */
  const lastAction = new Map();
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('figure.sheet button');
    if (b && !b.classList.contains('tutor-ask')) lastAction.set(b.closest('figure.sheet').id, 'pressed "' + b.textContent.trim() + '"');
  }, true);
  document.addEventListener('change', e => {
    const r = e.target.closest && e.target.closest('figure.sheet input[type="range"]');
    if (r) { const l = r.closest('.range') && r.closest('.range').querySelector('label'); lastAction.set(r.closest('figure.sheet').id, 'moved the ' + (l ? l.textContent.trim() : 'slider') + ' slider'); }
  }, true);
  const clean = el => el.textContent.replace(/\s+/g, ' ').trim();
  function domState(el) {
    const lines = [];
    el.querySelectorAll('.seg').forEach(g => {
      const on = g.querySelector('[aria-pressed="true"]');
      const lab = g.closest('.ctl') && g.closest('.ctl').querySelector(':scope > span');
      if (on) lines.push((lab ? clean(lab) : 'Option') + ': ' + clean(on));
    });
    el.querySelectorAll('.range').forEach(r => {
      const l = r.querySelector('label'), o = r.querySelector('output');
      if (l && o) lines.push(clean(l) + ': ' + clean(o));
    });
    el.querySelectorAll('.stage-label').forEach(s => lines.push('Stage: ' + clean(s)));
    el.querySelectorAll('.ro').forEach(ro => {
      const k = ro.querySelector('span'), v = ro.querySelector('b'), sm = ro.querySelector('small');
      if (k && v) lines.push(clean(k) + ': ' + clean(v) + (sm && clean(sm) ? ' (' + clean(sm) + ')' : ''));
    });
    const sel = el.querySelector('.chip[aria-pressed="true"], .chip.on');
    if (sel) lines.push('Selected: ' + clean(sel));
    if (lastAction.has(el.id)) lines.push('Last thing the reader did: ' + lastAction.get(el.id));
    return lines.join('\n') || '(no live settings)';
  }
  function addButtons() {
    document.querySelectorAll('figure.sheet[id]').forEach(el => {
      if (tutorFigs.has(el.id)) return;
      const no = el.querySelector('.figno');
      tutorRegister(el.id, { title: no ? clean(no) : el.id, describe: () => domState(el), auto: true });
    });
    tutorFigs.forEach((reg, id) => {
      const el = document.getElementById(id);
      if (!el || el.querySelector('.tutor-ask')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn tutor-ask'; b.id = 'ask-' + id;
      b.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6,0.8 a5.2,5.2 0 1 1 -3.9,8.6 L0.6,11.2 L1.3,8.1 A5.2,5.2 0 0 1 6,0.8 z"/></svg><span>Why did that happen?</span>';
      b.addEventListener('click', () => open(id, b));
      const top = el.querySelector('.sheet-top');
      (top || el).appendChild(b);
      buttons.push(b);
    });
  }

  window.claude.use('sample').then(s => {
    if (!s) return;
    sample = s;
    addButtons();
  }, () => {});
})();
