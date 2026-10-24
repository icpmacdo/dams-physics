
/* ===================== The book: "Set the figure" buttons ===================== */
/* A worked example or a question can carry <button class="set-fig" data-set='{…}'> (book/SPEC.md
   F.6). Pressing it sets the named figure's controls in order, presses any buttons it lists,
   scrolls to the figure and offers a way back. The JSON:
     { "fig": "fig-block", "set": { "bk-a": 25, "dc-mat": "silt", "zn-tabs": "2", "bd-presets": "cored" },
       "click": ["#bd-test"] }
   A range input gets its value and an input and a change event; a .seg group, zn-tabs, bd-tabs and
   bd-presets get a click on the button whose data-v, data-i, data-m or data-p matches. A figure still
   hidden behind an unanswered predict box sends the reader to the question first.
   tests/test-book.js checks every data-set against the page's controls. */
(function setFigure() {
  const KEY = { 'zn-tabs': 'data-i', 'bd-tabs': 'data-m', 'bd-presets': 'data-p' };
  let pill = null;

  function setOne(id, val) {
    const el = document.getElementById(id);
    if (!el) { console.error('set-fig: no control #' + id); return; }
    if (el.tagName === 'INPUT') {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const attr = KEY[id] || 'data-v';
    const b = el.querySelector('[' + attr + '="' + String(val).replace(/"/g, '\\"') + '"]');
    if (!b) { console.error('set-fig: #' + id + ' has no ' + attr + '="' + val + '"'); return; }
    const on = b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-selected') === 'true';
    if (!on || id === 'bd-presets') b.click();
  }

  function back(btn) {
    if (pill) pill.remove();
    const owner = btn.closest('section.we[id], li.q[id], [id]');
    pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'btn back-pill';
    pill.textContent = 'Back to ' + (owner && bookData().refs[owner.id] ? ref(owner.id) : 'the text');
    pill.addEventListener('click', () => {
      btn.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
      btn.focus({ preventScroll: true });
      pill.remove(); pill = null;
    });
    document.body.appendChild(pill);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('button.set-fig');
    if (!btn) return;
    let spec;
    try { spec = JSON.parse(btn.dataset.set); } catch (err) { console.error('set-fig: bad JSON', err); return; }
    const fig = document.getElementById(spec.fig);
    if (!fig) { console.error('set-fig: no figure #' + spec.fig); return; }
    if (fig.hidden) {
      const pr = document.querySelector('.predict[data-unlocks="#' + spec.fig + '"]');
      if (pr) {
        pr.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
        let n = pr.querySelector('.set-fig-first');
        if (!n) { n = document.createElement('p'); n.className = 'set-fig-first'; n.textContent = 'Answer this first: the figure opens when you do.'; pr.appendChild(n); }
        return;
      }
    }
    for (const [k, v] of Object.entries(spec.set || {})) setOne(k, v);
    for (const sel of spec.click || []) { const b = fig.querySelector(sel); if (b) b.click(); else console.error('set-fig: no ' + sel + ' in #' + spec.fig); }
    fig.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
    if (!fig.hasAttribute('tabindex')) fig.setAttribute('tabindex', '-1');
    fig.focus({ preventScroll: true });
    back(btn);
  });
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
