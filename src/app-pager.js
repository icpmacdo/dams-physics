
/* ===================== The chapter: one page at a time ===================== */
/* Each <section class="pg" id="…"> in #book is one page; the address (#id) says which is showing.
   The live figures are each built once, in #figstore. A page asks for one with a slot:

     <div class="figslot" data-fig="fig-lab"
          data-do="#lab-dam/homogeneous; #lab-res:=85; #bd-test"
          data-show="#lab-drain" data-hide=".readouts" data-title="…" data-caption="keep"></div>

   When the page is shown, the figure moves into the slot and the actions in data-do run in order:
   "#id/v" presses the button with data-v="v" inside #id, "#id:=v" sets an input and fires its
   input event, "!name" sends the figure an event of that name (a figure may listen for it),
   anything else is a selector to click. Every control is then hidden except those
   named in data-show ("*" keeps them all), plus anything in data-hide. The figure's own caption
   is hidden unless data-caption="keep", because the page's text says what to look at. */
(function pager() {
  const book = $('#book'), store = $('#figstore');
  if (!book || !store) return;
  const pages = $$('section.pg', book);
  const CONTROLS = '.ctl, .range, .controls > .btn, .gr-exps, .tabs, .bd-mission, .bd-matinfo';
  const STATUS = '.solving, .build-step';

  // number the pages and give each its part label
  const parts = [];
  pages.forEach((p, i) => {
    p.hidden = true;
    p.dataset.n = i;
    const part = p.closest('.part');
    p._part = part ? part.dataset.title : '';
    if (part && parts[parts.length - 1] !== part) parts.push(part);
    const h = $('h2', p);
    p._title = p.dataset.short || (h ? h.textContent.trim() : '');
    if (h) h.tabIndex = -1;
    if (p.classList.contains('pg-front') || p.classList.contains('pg-back')) return;
    const k = document.createElement('p');
    k.className = 'pg-kicker';
    k.textContent = (p._part ? p._part + ' · ' : '') + 'Page ' + pageNo(p);
    p.insertBefore(k, p.firstChild);
  });
  function pageNo(p) { return pages.filter(q => !q.classList.contains('pg-front') && !q.classList.contains('pg-back')).indexOf(p) + 1; }
  const body = pages.filter(q => !q.classList.contains('pg-front') && !q.classList.contains('pg-back'));

  // contents: every part and page, generated from the pages themselves
  const toc = $('#bk-toc');
  if (toc) {
    let cur = null, ol = null;
    body.forEach(p => {
      if (p._part !== cur) {
        cur = p._part;
        const li = document.createElement('li'); li.className = 'toc-part';
        const h = document.createElement('p'); h.textContent = cur; li.appendChild(h);
        ol = document.createElement('ol'); li.appendChild(ol); toc.appendChild(li);
      }
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = '#' + p.id;
      const n = document.createElement('span'); n.textContent = pageNo(p);
      a.append(n, document.createTextNode(p._title));
      li.appendChild(a); ol.appendChild(li);
    });
    $$('.pg-back', book).forEach(p => {
      const li = document.createElement('li'); li.className = 'toc-back';
      const a = document.createElement('a'); a.href = '#' + p.id; a.textContent = p._title;
      li.appendChild(a); toc.appendChild(li);
    });
  }

  // cross-references fill in their own page numbers: <a class="pgref" href="#core"></a>
  $$('a.pgref', book).forEach(a => {
    const p = pages.find(q => q.id === a.getAttribute('href').slice(1));
    a.textContent = p && pageNo(p) ? pageNo(p) : '?';
  });

  // glossary entries point at the page where each term is first defined
  $$('#glossary-list a[href^="#gl-"]').forEach(a => {
    const el = document.getElementById(a.getAttribute('href').slice(1)), p = el && el.closest('section.pg');
    if (p && pageNo(p)) a.textContent = 'First met on page ' + pageNo(p);
  });

  // ---- figures
  function setInput(el, v) {
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function act(a, f) {
    let m;
    if ((m = a.match(/^!([\w-]+)$/))) return f.dispatchEvent(new CustomEvent(m[1]));
    if ((m = a.match(/^(#[\w-]+)\s*:=\s*(.*)$/))) return setInput($(m[1]), m[2]);
    if ((m = a.match(/^(#[\w-]+)\/([\w.-]+)$/))) { const b = $(`${m[1]} [data-v="${m[2]}"]`); if (b) b.click(); return; }
    const el = $(a); if (el) el.click();
  }
  const list = s => (s || '').split(/[;,]/).map(x => x.trim()).filter(Boolean);
  function mount(slot) {
    const f = document.getElementById(slot.dataset.fig);
    if (!f) return;
    f.hidden = false; // some figures start hidden in the long page, until a prediction is made
    slot.appendChild(f);
    // figure title: drop the old figure number; a page can give its own title
    const no = $('.figno', f);
    if (no && !no.dataset.pg) {
      no.dataset.pg = '1';
      const b = no.firstElementChild;
      if (b && b.tagName === 'B') { const t = b.nextSibling; b.remove(); if (t && t.nodeType === 3) t.textContent = t.textContent.replace(/^\s*·\s*/, ''); }
      const orig = document.createElement('span'); orig.className = 'fig-orig';
      while (no.firstChild) orig.appendChild(no.firstChild);
      const alt = document.createElement('span'); alt.className = 'fig-alt';
      no.append(orig, alt);
    }
    if (no) {
      $('.fig-alt', no).textContent = slot.dataset.title || '';
      no.classList.toggle('has-alt', !!slot.dataset.title);
    }
    // state first, with every control showing, then hide what this page doesn't use
    $$('.pg-off', f).forEach(el => el.classList.remove('pg-off'));
    list(slot.dataset.do).forEach(a => act(a, f));
    const show = list(slot.dataset.show);
    if (show.indexOf('*') < 0) {
      $$(CONTROLS, f).forEach(el => { if (!show.some(s => el.matches(s) || el.querySelector(s))) el.classList.add('pg-off'); });
    }
    list(slot.dataset.hide).forEach(s => $$(s, f).forEach(el => el.classList.add('pg-off')));
    const cap = $('figcaption', f);
    if (cap && slot.dataset.caption !== 'keep') cap.classList.add('pg-off');
    $$('.controls', f).forEach(row => {
      const live = [...row.children].some(c => !c.classList.contains('pg-off') && !c.matches(STATUS));
      row.classList.toggle('pg-off', !live);
    });
    // labels and canvases that measure themselves do it when they can be seen
    requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); document.dispatchEvent(new CustomEvent('predict')); });
  }

  // ---- navigation
  const bar = $('#bk-bar'), where = $('#bk-where'), count = $('#bk-count');
  const prevA = $('#bk-prev'), nextA = $('#bk-next');
  let current = null;
  function show(p, focus) {
    if (!p) return;
    if (current !== p) {
      if (current) current.hidden = true;
      p.hidden = false;
      current = p;
      $$('.figslot', p).forEach(mount);
    }
    const i = pages.indexOf(p), n = pageNo(p);
    if (where) where.textContent = p._part || '';
    if (count) count.textContent = n ? `Page ${n} of ${body.length}` : '';
    if (bar) bar.style.width = (n ? (100 * n / body.length) : (p.classList.contains('pg-back') ? 100 : 0)) + '%';
    const prev = pages[i - 1], next = pages[i + 1];
    link(prevA, prev, 'Back');
    link(nextA, next, i === 0 ? 'Start reading' : 'Next');
    document.documentElement.classList.toggle('on-front', i === 0);
    try { localStorage.setItem('dams-page', p.id); } catch (e) { /* storage may be off */ }
    if (focus) { window.scrollTo(0, 0); const h = $('h2', p); if (h) h.focus({ preventScroll: true }); }
  }
  function link(a, p, word) {
    if (!a) return;
    a.hidden = !p;
    if (!p) return;
    a.href = '#' + p.id;
    $('.bk-word', a).textContent = word;
    $('.bk-title', a).textContent = p._title;
  }
  // an address can name a page, or anything inside one (a figure, a glossary term)
  function route(focus) {
    const id = decodeURIComponent(location.hash.slice(1));
    let p = id && pages.find(q => q.id === id), target = null;
    if (!p && id) {
      const el = document.getElementById(id);
      if (el && el.closest('#figstore, .figslot')) {
        const slot = $(`.figslot[data-fig="${el.closest('figure').id}"]`);
        p = slot && slot.closest('section.pg');
      } else if (el) { p = el.closest('section.pg'); target = el; }
    }
    show(p || pages[0], focus && !target);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
  }
  window.addEventListener('hashchange', () => route(true));
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (e.target.closest && e.target.closest('input, textarea, select, svg, canvas, [contenteditable], .seg, .tabs, .tutor-panel')) return;
    const a = e.key === 'ArrowRight' ? nextA : prevA;
    if (a && !a.hidden) { e.preventDefault(); location.hash = a.getAttribute('href'); }
  });

  // the front page offers to carry on where the reader stopped
  const resume = $('#bk-resume');
  let saved = null;
  try { saved = localStorage.getItem('dams-page'); } catch (e) { /* storage may be off */ }
  const sp = saved && pages.find(q => q.id === saved && pageNo(q));
  if (resume && sp && pages.indexOf(sp) > 1) {
    resume.hidden = false;
    const a = $('a', resume); a.href = '#' + sp.id; a.textContent = `Carry on at page ${pageNo(sp)}: ${sp._title}`;
  }
  route(false);
})();
