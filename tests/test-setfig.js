/* "Set the figure" in a real browser (book/SPEC.md F.6): for every interactive figure on the page, and
 * for every control in it, presses a <button class="set-fig"> the way a reader would and checks that
 * the control took the value, that nothing logged an error, that the figure is scrolled into view and
 * marked, and that a "Back to …" pill appeared. Figures behind a predict box must send the reader to
 * the question first. Also checks the book's runtime: the running head names the unit in view, the
 * Contents dialog opens, closes on Escape and gives focus back, and Expand moves a plate into the
 * full-screen dialog and back without losing it.
 *
 * Needs Google Chrome (headless). Without it the test says so and exits 0.
 *   node tests/test-setfig.js            CHROME=/path/to/chrome node tests/test-setfig.js */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { execFileSync, execFile } = require('child_process');
const ROOT = path.join(__dirname, '..');
const t0 = Date.now();
let passes = 0, fails = 0;
function check(ok, msg) { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (ok) passes++; else fails++; }

const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => fs.existsSync(p));
if (!CHROME) { console.log('skipped: no Chrome found (set CHROME=/path/to/chrome)'); process.exit(0); }

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dams-setfig-'));
execFileSync('python3', [path.join(ROOT, 'build.py')], { cwd: ROOT, env: Object.assign({}, process.env, { OUT: out, DRAFT: '' }), stdio: ['ignore', 'pipe', 'pipe'] });
const docs = path.join(out, 'docs');

/* the probe runs in the wrapper page, against the book in an iframe from the same origin */
const PROBE = String(function probe() {
  const f = document.getElementById('f');
  const res = { checks: [], log: [] };
  const say = (ok, msg) => res.checks.push([!!ok, msg]);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  f.addEventListener('load', async () => {
    const w = f.contentWindow, d = w.document;
    const errors = [];
    const ce = w.console.error.bind(w.console);
    w.console.error = (...a) => { errors.push(a.map(String).join(' ')); ce(...a); };
    await wait(1500);
    d.documentElement.style.scrollBehavior = 'auto';
    const host = d.createElement('section'); host.className = 'col'; host.id = 'setfig-probe';
    d.querySelector('#ch-beach').appendChild(host);
    // took (optional) is read the moment the button has done its work: a playing figure may move on after
    let tookNow = true;
    const press = async (spec, took) => {
      const b = d.createElement('button'); b.type = 'button'; b.className = 'set-fig'; b.dataset.set = JSON.stringify(spec);
      host.appendChild(b); errors.length = 0; b.click(); tookNow = took ? took() : true; await wait(350); b.remove();
      return errors.slice();
    };
    const inView = el => { const r = el.getBoundingClientRect(); return r.top < w.innerHeight && r.bottom > 0; };
    // every control a figure has: [control id, a legal value that differs from now, a check that it took]
    function controls(fig) {
      const list = [];
      fig.querySelectorAll('input[type=range][id]').forEach(r => {
        if (r.disabled) return;
        const min = +(r.min || 0), max = +(r.max || 100), step = +(r.step || 1);
        const n = Math.round((max - min) / step);
        let k = Math.round(n * 0.3); if (Math.abs(min + k * step - +r.value) < 1e-9) k = Math.round(n * 0.6);
        const v = +(min + k * step).toFixed(6);
        list.push([r.id, v, () => Math.abs(+r.value - v) < 1e-9]);
      });
      fig.querySelectorAll('.seg[id], [role=tablist][id], #bd-presets, #bd-palette, #gr-exps').forEach(g => {
        const attr = ['data-v', 'data-i', 'data-m', 'data-p', 'data-exp'].find(a => g.querySelector('[' + a + ']'));
        if (!attr) return;
        const on = b => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-selected') === 'true';
        const pick = [...g.querySelectorAll('[' + attr + ']')].find(b => !on(b) && !b.disabled);
        if (!pick) return;
        const v = pick.getAttribute(attr);
        const stateful = pick.hasAttribute('aria-pressed') || pick.hasAttribute('aria-selected');
        list.push([g.id, v, () => !stateful || on(g.querySelector('[' + attr + '="' + v + '"]'))]);
      });
      // a mission tab locks other controls, so the tab rows go last
      return list.sort((a, b) => (d.getElementById(a[0]).getAttribute('role') === 'tablist') - (d.getElementById(b[0]).getAttribute('role') === 'tablist'));
    }
    // a cross-reference in the prose to a figure still behind its predict box goes to the box
    {
      const xr = [...d.querySelectorAll('a[href="#fig-block"]')].find(a => !a.closest('dialog, nav#toc') && a.closest('#ch-concrete, #ch-trapped, #ch-erosion'));
      const pr = d.getElementById('pr-cushion');
      if (xr) { w.scrollTo(0, 0); xr.click(); await wait(300); }
      say(xr && d.getElementById('fig-block').hidden && inView(pr) && pr.querySelector('.set-fig-first') && d.activeElement === pr.querySelector('.predict-opts button'),
        'a prose link to fig-block, still hidden, brings its predict box pr-cushion into view and focuses its first answer');
      // the page has no figure links into the void: every in-page link to a hidden element names one a predict box unlocks
      const dead = [...d.querySelectorAll('a[href^="#"]')].map(a => d.getElementById(a.getAttribute('href').slice(1))).filter(t => t && t.closest('[hidden]') && !t.closest('[hidden]').matches('figure[id]'));
      say(!dead.length, 'no in-page link points into a hidden block other than a figure (predict-locked, or a film without its video)' + (dead.length ? ': ' + dead.slice(0, 5).map(t => t.id).join(', ') : ''));
      // the page in numbers: elements after the scripts ran (a ceiling, so later chapters can't grow it silently)
      const nodes = d.getElementsByTagName('*').length;
      res.log.push('elements on the page after load: ' + nodes);
      say(nodes < 25000, 'the page holds ' + nodes + ' elements after load, under the 25,000 ceiling');
    }
    const figs = [...d.querySelectorAll('figure.sheet[id]')].filter(x => !x.classList.contains('film'));
    res.figs = figs.map(x => x.id);
    for (const fig of figs) {
      if (fig.hidden) {
        const pr = d.querySelector('.predict[data-unlocks="#' + fig.id + '"]');
        await press({ fig: fig.id, set: {} });
        say(pr && pr.querySelector('.set-fig-first') && inView(pr), fig.id + ': hidden behind a predict box, so the button sends the reader to the question');
        const opt = pr && pr.querySelector('.predict-opts button');
        if (opt) opt.click();
        await wait(400);
        say(!fig.hidden, fig.id + ': answering the predict box opens the figure');
      }
      const ctl = controls(fig);
      if (!ctl.length) {
        const e = await press({ fig: fig.id });
        say(!e.length && inView(fig) && fig.classList.contains('set-target'), fig.id + ': no controls; the button scrolls to the figure and marks it' + (e.length ? ' (' + e.join('; ') + ')' : ''));
        continue;
      }
      for (const [id, v, took] of ctl) {
        // a mission tab locks controls; set it last and on its own
        const e = await press({ fig: fig.id, set: { [id]: v } }, took);
        const pill = d.querySelector('.back-pill');
        const hl = fig.querySelector('.set-hl');
        const why = [tookNow ? '' : 'did not take', e.length ? 'errors: ' + e.join('; ') : '', inView(fig) ? '' : 'not scrolled into view',
          fig.classList.contains('set-target') ? '' : 'figure not marked', hl ? '' : 'nothing highlighted', pill && /^↑ Back to /.test(pill.textContent) ? '' : 'no back pill'].filter(Boolean);
        say(!why.length, fig.id + ' · ' + id + ' = ' + JSON.stringify(v) + (why.length ? ' (' + why.join(', ') + ')' : ''));
      }
    }
    // buttons pressed afterwards, and an illegal value reported rather than set silently
    let e = await press({ fig: 'fig-beach', set: { 'bc-state': 'dry' }, click: ['#bc-jiggle'] });
    say(!e.length, 'fig-beach: "click" presses #bc-jiggle after setting the state');
    const r = w.bookSetFigure({ fig: 'fig-block', set: { 'bk-a': 46 } });
    say(!r.ok && /outside/.test(r.errors.join()) && d.getElementById('bk-a').value === '45', 'an out-of-range value is clamped and reported');
    const r2 = w.bookSetFigure({ fig: 'fig-lab', set: { 'lab-dam': 'no-such' } });
    say(!r2.ok && /no button/.test(r2.errors.join()), 'an unknown button value is reported');
    // the back pill returns to the button that was pressed
    const b = d.createElement('button'); b.type = 'button'; b.className = 'set-fig'; b.dataset.set = JSON.stringify({ fig: 'fig-lab', set: { 'lab-res': 60 } });
    host.appendChild(b); b.click(); await wait(300);
    d.querySelector('.back-pill').click(); await wait(300);
    say(d.activeElement === b && !d.querySelector('.back-pill'), 'the back pill returns focus to the button and goes away');
    // the running head names the unit in view
    d.getElementById('ch-grip').scrollIntoView(); w.dispatchEvent(new Event('scroll')); await wait(600);
    const where = d.getElementById('rh-where');
    say(!where.hidden && /^4\s·\sGrip$/.test(where.textContent.trim()), 'running head reads "4 · Grip" in Chapter 4: ' + JSON.stringify(where.textContent.trim()));
    // the Contents dialog
    const toc = d.getElementById('rh-toc'), dlg = d.getElementById('toc-dialog');
    toc.focus(); toc.click(); await wait(200);
    say(dlg && dlg.open && dlg.querySelector('li[aria-current] a') === d.activeElement, 'Contents opens as a dialog with the current chapter marked and focused');
    say(toc.getAttribute('aria-expanded') === 'true', 'the Contents button says it is expanded');
    dlg.dispatchEvent(new Event('cancel', { cancelable: true })); dlg.close(); await wait(100);
    say(!dlg.open && d.activeElement === toc, 'closing Contents gives focus back to the button');
    const units = [...dlg.querySelectorAll('li[data-unit]')].map(li => li.dataset.unit);
    say(['ch-beach', 'ch-grip', 'ch-build'].every(u => units.includes(u)), 'Contents lists the chapters (' + units.length + ' units)');
    // Expand moves a plate into the dialog and back
    if (w.bookExpand) {
      w.bookExpand.show('fig-lab'); await wait(200);
      const pd = d.getElementById('plate-dialog');
      say(pd.open && pd.contains(d.getElementById('fig-lab')) && d.querySelectorAll('#fig-lab').length === 1, 'Expand opens fig-lab full screen, the one and only copy');
      w.bookExpand.hide(); await wait(200);
      say(!pd.open && d.getElementById('fig-lab').closest('#ch-seepage') && !d.querySelector('.plate-slot'), 'closing Expand puts fig-lab back in its chapter');
    }
    // on a phone: the page never scrolls sideways, no drawing reaches past its own plate, and every
    // wide plate with a drawing has an Expand button (How to read promises one)
    for (const width of [390, 360]) {
      f.style.width = width + 'px'; w.dispatchEvent(new Event('resize')); await wait(700);
      const de = d.documentElement;
      const past = [...d.querySelectorAll('body *')].filter(el => { if (el.closest('dialog')) return false; const r = el.getBoundingClientRect(); return r.width && r.right > de.clientWidth + 0.5; });
      const deepest = past.filter(el => !past.some(o => o !== el && el.contains(o)));
      say(de.scrollWidth <= de.clientWidth, `at ${width} px the page does not scroll sideways (scrollWidth ${de.scrollWidth}, width ${de.clientWidth})` +
        (deepest.length ? ': ' + deepest.slice(0, 4).map(el => el.tagName.toLowerCase() + (el.closest('[id]') ? '@' + el.closest('[id]').id : '')).join(', ') : ''));
      if (width !== 390) continue;
      const stray = [];
      d.querySelectorAll('svg.dwg').forEach(svg => {
        const sr = svg.getBoundingClientRect();
        if (!sr.width || svg.closest('[hidden], dialog')) return;
        if (w.getComputedStyle(svg).overflow !== 'visible') return;
        svg.querySelectorAll('polygon, path, rect, line, polyline, circle, ellipse').forEach(el => {
          if (el.closest('defs, pattern, marker, symbol, clipPath, mask, [clip-path]')) return;
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > sr.right + 16 || r.left < sr.left - 16)) stray.push((svg.closest('figure[id], .predict[id], [id]') || {}).id + ' ' + el.tagName + ' ' + Math.round(r.left - sr.left) + '…' + Math.round(r.right - sr.left) + ' of ' + Math.round(sr.width));
        });
      });
      say(!stray.length, 'at 390 px no shape in a drawing reaches more than 16 px outside its own drawing' + (stray.length ? ': ' + stray.slice(0, 5).join('; ') : ''));
      const plates = [...d.querySelectorAll('figure.wide[id], figure.full[id]')].filter(fg => !fg.classList.contains('film') && !fg.classList.contains('table') && fg.querySelector('svg.dwg, canvas'));
      const noBtn = plates.filter(fg => { const b = fg.querySelector('.fig-expand'); return !b || !b.getClientRects().length; }).filter(fg => !fg.hidden);
      say(plates.length > 10 && !noBtn.length, `at 390 px every wide plate with a drawing shows an Expand button (${plates.length} plates)` + (noBtn.length ? ': missing on ' + noBtn.map(x => x.id).join(', ') : ''));
    }
    {
      const pd = d.getElementById('plate-dialog');
      w.bookExpand.show('fig-depth-sloping'); await wait(300);
      const svg = pd.querySelector('#fig-depth-sloping svg.dwg');
      const long = svg ? Math.max(svg.getBoundingClientRect().width, svg.getBoundingClientRect().height) : 0;   // the dialog may be turned a quarter turn
      say(pd.open && long > 400, 'Expand opens the static plate fig-depth-sloping full screen, its drawing ' + Math.round(long) + ' px along its long side');
      w.bookExpand.hide(); await wait(200);
      say(!pd.open && d.getElementById('fig-depth-sloping').closest('#ch-depth'), 'closing Expand puts fig-depth-sloping back');
      f.style.width = '1280px'; w.dispatchEvent(new Event('resize')); await wait(300);
    }
    res.done = true;
    document.getElementById('out').textContent = JSON.stringify(res);
  });
});
fs.writeFileSync(path.join(docs, 'setfig-probe.html'),
  '<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="out">not run</pre><iframe id="f" src="index.html" style="width:1280px;height:900px;border:0"></iframe><script>(' + PROBE + ')();</script></body></html>');

const server = http.createServer((req, res) => {
  const p = path.join(docs, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!p.startsWith(docs) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(p)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(p).pipe(res);
});
server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dams-chrome-'));
  execFile(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + ud, '--window-size=1300,950',
    '--virtual-time-budget=90000', '--force-prefers-reduced-motion', '--dump-dom', `http://127.0.0.1:${port}/setfig-probe.html`], { maxBuffer: 64 << 20, timeout: 240000 }, (err, stdout) => {
    server.close();
    try { fs.rmSync(ud, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); } catch (e) { /* leave it */ }
    const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(stdout || '');
    let res = null;
    try { res = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')); } catch (e) { /* below */ }
    if (!res || !res.done) { check(false, 'the probe ran to the end in Chrome' + (err ? ': ' + err.message : '')); }
    else {
      console.log('figures: ' + res.figs.join(', '));
      res.log.forEach(l => console.log('  · ' + l));
      res.checks.forEach(([ok, msg]) => check(ok, msg));
      check(res.figs.length >= 15, 'probed ' + res.figs.length + ' interactive figures');
    }
    console.log(`\n${fails ? fails + ' check(s) FAILED' : 'all ' + passes + ' checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    process.exit(fails ? 1 : 0);
  });
});
