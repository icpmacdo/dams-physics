/* The films in a real browser (book/SPEC.md F.13): plays segments of the real video files in headless
 * Chrome, in real time, and checks that
 *   - the poster shows the film's number, length and question, and its Play button starts the film;
 *   - a segment stops at its end time (Depth, not size at 191 s; The same sand, three ways at 524.5 s),
 *     with an end card that says where the film continues or what the rest holds;
 *   - "Keep watching" and "Watch the rest" play on past the cut, and "Watch again" starts it over;
 *   - part two starts at its own start and holds a seek before it there;
 *   - a chapter mark and a transcript paragraph seek the film and play, and the mark now playing is current;
 *   - starting one film pauses another, and a whole film plays to its end with no end card.
 * Takes about 40 s (the films really play). Needs Google Chrome, Node 22 or later (for WebSocket)
 * and the video files in docs/video/; without any of them the test says so and exits 0.
 *   node tests/test-films.js            CHROME=/path/to/chrome node tests/test-films.js */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { execFileSync, spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const VIDEO = path.join(ROOT, 'docs', 'video');
const t0 = Date.now();
let passes = 0, fails = 0;
function check(ok, msg) { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (ok) passes++; else fails++; }

const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => fs.existsSync(p));
if (!CHROME) { console.log('skipped: no Chrome found (set CHROME=/path/to/chrome)'); process.exit(0); }
if (typeof WebSocket !== 'function') { console.log('skipped: this Node has no WebSocket (needs Node 22 or later)'); process.exit(0); }
if (!fs.existsSync(path.join(VIDEO, 'depth-not-size.mp4'))) { console.log('skipped: no films in docs/video/'); process.exit(0); }

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dams-films-'));
execFileSync('python3', [path.join(ROOT, 'build.py')], { cwd: ROOT, env: Object.assign({}, process.env, { OUT: out, DRAFT: '' }), stdio: ['ignore', 'pipe', 'pipe'] });
const docs = path.join(out, 'docs');

/* the probe runs in a wrapper page, against the book in a same-origin iframe; it writes its results into #out */
const PROBE = String(function probe() {
  const f = document.getElementById('f');
  const log = [];
  const say = (ok, m) => log.push([!!ok, m]);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await wait(50); } return false; };
  // where a seek lands: the time at the first timeupdate after the 'seeked' that follows act() (a fixed real-time
  // wait after a seek let a slow load drift the reading, so the test failed now and then)
  const landing = (v, act, ms = 8000) => new Promise(res => {
    const t0 = setTimeout(() => res(NaN), ms);
    v.addEventListener('seeked', () => v.addEventListener('timeupdate', () => { clearTimeout(t0); res(v.currentTime); }, { once: true }), { once: true });
    act();
  });
  f.addEventListener('load', async () => {
    const w = f.contentWindow, d = w.document;
    const errs = [];
    const ce = w.console.error.bind(w.console);
    w.console.error = (...a) => { errs.push(a.map(String).join(' ')); ce(...a); };
    await wait(1200);
    try {
      // part one: the poster, Play, then the stop at 191 s
      const fig = d.getElementById('film-depth-not-size'), v = fig.querySelector('video');
      const poster = fig.querySelector('.film-poster');
      // the question is in the markup for the poster, but the Before you watch box above asks it, so the poster hides it
      const fq = poster && poster.querySelector('.fp-q');
      say(poster && !poster.hidden && /Film 2\.1/.test(poster.textContent) && /3 min 11 s/.test(poster.textContent) && fq && /what share does the bottom half of the face carry/.test(fq.textContent) && w.getComputedStyle(fq).display === 'none',
        'part one: the poster shows the number and the segment\'s length; its question stays with Before you watch');
      say(poster && poster.querySelector('button.fp-play'), 'part one: the poster has a real Play button');
      poster.querySelector('button.fp-play').click();
      say(await until(() => !v.paused && v.currentTime > 0.1, 10000), 'part one: Play starts the film');
      say(poster.hidden, 'part one: the poster gives way to the browser\'s own player');
      let furthest = 0;
      const track = () => { if (!v.paused) furthest = Math.max(furthest, v.currentTime); };
      v.addEventListener('timeupdate', track);
      const tick = setInterval(track, 20);
      v.currentTime = 187.5;
      await until(() => v.paused, 10000);
      clearInterval(tick);
      v.removeEventListener('timeupdate', track);
      say(v.paused && Math.abs(v.currentTime - 191) < 0.15, `part one: stops at its end, 191 s (at ${v.currentTime.toFixed(3)} s)`);
      say(furthest > 190 && furthest < 191.15, `part one: never plays on past 191 s while it plays (furthest ${furthest.toFixed(3)} s)`);
      const card = fig.querySelector('.film-endcard');
      say(card && !card.hidden && /End of part one/.test(card.textContent) && /Part two is Film 7\.1, in Chapter 7/.test(card.textContent) && card.querySelector('a[href="#film-depth-not-size-2"]'),
        'part one: the end card says where part two plays, with a link to it');
      card.querySelector('.fe-more').click();
      say(await until(() => !v.paused && v.currentTime > 191.6 && card.hidden, 8000), `part one: "Keep watching here" plays on past the cut (at ${v.currentTime.toFixed(2)} s)`);
      v.pause();
      // a chapter mark seeks and plays, and is marked current
      const mk = [...fig.querySelectorAll('.film-marks button')].find(b => b.textContent === '2:05');
      const at = await landing(v, () => mk.click());
      const playing = await until(() => !v.paused, 8000);
      say(playing && at >= 125.5 && at <= 128.6, `the 2:05 chapter mark seeks there and plays (lands at ${at.toFixed(2)} s)`);
      say(mk.closest('li').getAttribute('aria-current') === 'true', 'the mark now playing is marked current');
      // part two starts at its own start, and starting it pauses part one
      const fig2 = d.getElementById('film-depth-not-size-2'), v2 = fig2.querySelector('video');
      fig2.querySelector('button.fp-play').click();
      say(await until(() => !v2.paused && v2.currentTime > 191, 10000), `part two: Play starts at 191 s (at ${v2.currentTime.toFixed(2)} s)`);
      say(v.paused, 'starting part two pauses part one');
      v2.currentTime = 100;
      await until(() => v2.currentTime >= 190.9, 8000);
      say(v2.currentTime >= 190.9, `part two: a seek before its start is held at its start (at ${v2.currentTime.toFixed(2)} s)`);
      v2.pause();
      // The same sand, three ways: stops at 524.5 s with a note on what the rest holds
      const fig3 = d.getElementById('film-same-sand'), v3 = fig3.querySelector('video');
      fig3.querySelector('button.fp-play').click();
      await until(() => !v3.paused, 10000);
      v3.currentTime = 521;
      await until(() => v3.paused, 9000);
      say(v3.paused && Math.abs(v3.currentTime - 524.5) < 0.15, `same sand: stops at 524.5 s (at ${v3.currentTime.toFixed(3)} s)`);
      const c3 = fig3.querySelector('.film-endcard');
      say(c3 && /This chapter stops here/.test(c3.textContent) && /last 23 seconds ask the lake-or-slot question, which you answered in Chapter 2/.test(c3.textContent) && c3.querySelector('a[href="#ch-depth"]'),
        'same sand: the end card says what the last 23 seconds hold, with a link');
      const again = await landing(v3, () => c3.querySelector('.fe-again').click());
      await until(() => !v3.paused, 8000);
      say(!v3.paused && again < 3, `same sand: "Watch again" starts it over (at ${v3.currentTime.toFixed(2)} s)`);
      v3.currentTime = 523;
      await until(() => v3.paused, 7000);
      fig3.querySelector('.film-endcard .fe-more').click();
      say(await until(() => !v3.paused && v3.currentTime > 525, 8000), `same sand: "Watch the rest" plays past the cut (at ${v3.currentTime.toFixed(2)} s)`);
      v3.pause();
      // a transcript paragraph seeks
      const tr = fig3.querySelector('.film-transcript');
      tr.open = true;
      const tb = [...tr.querySelectorAll('button.tr-t')][3];
      const tat = await landing(v3, () => tb.click());
      await until(() => !v3.paused, 8000);
      say(!v3.paused && tat - +tb.dataset.t > -0.1 && tat - +tb.dataset.t < 2, `a transcript paragraph seeks to its time, ${tb.textContent} (lands at ${tat.toFixed(2)} s)`);
      v3.pause();
      // a whole film: no end card
      const fig4 = d.getElementById('film-every-dam-leaks'), v4 = fig4.querySelector('video');
      fig4.querySelector('button.fp-play').click();
      await until(() => !v4.paused, 10000);
      v4.currentTime = 361;
      await until(() => v4.ended || v4.paused, 7000);
      say(v4.ended && !fig4.querySelector('.film-endcard'), 'a whole film plays to its end with no end card');
      say(!errs.length, 'nothing logged an error' + (errs.length ? ': ' + errs.join(' | ') : ''));
    } catch (e) { say(false, 'the probe crashed: ' + e.stack); }
    const o = document.getElementById('out');
    o.textContent = JSON.stringify(log);
    o.dataset.done = '1';
  });
});
fs.writeFileSync(path.join(docs, 'films-probe.html'), `<!doctype html><meta charset="utf-8"><body><iframe id="f" src="index.html" style="width:1300px;height:900px;border:0"></iframe><pre id="out"></pre><script>(${PROBE})();</script></body>`);

// a static server with Range requests (the player seeks by byte range): the page from the build, the films from docs/video
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/video/') ? path.join(VIDEO, path.basename(u)) : path.join(docs, path.normalize(u === '/' ? 'index.html' : u));
  if (!f.startsWith(VIDEO) && !f.startsWith(docs) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f)] || 'application/octet-stream';
  const r = req.headers.range && req.headers.range.match(/bytes=(\d*)-(\d*)/);
  if (r) {
    const a = r[1] ? +r[1] : 0, b = r[2] ? Math.min(+r[2], size - 1) : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
    fs.createReadStream(f, { start: a, end: b }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(f).pipe(res);
});

function finish(code) {
  server.close();
  try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) { /* leave it */ }
  console.log(fails ? `\n${fails} check(s) FAILED in ${((Date.now() - t0) / 1000).toFixed(0)} s` : `\nall ${passes} checks passed in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(code);
}

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dams-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + ud, '--autoplay-policy=no-user-gesture-required',
    '--window-size=1400,1000', '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const kill = setTimeout(() => { check(false, 'the probe finished within 3 minutes'); chrome.kill(); finish(1); }, 180000);
  let buf = '', started = false;
  chrome.stderr.on('data', async chunk => {
    buf += chunk;
    const m = buf.match(/DevTools listening on (ws:\S+)/);
    if (!m || started) return;
    started = true;
    const list = await (await fetch(`http://127.0.0.1:${new URL(m[1]).port}/json/list`)).json();
    const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
    let id = 0;
    const pend = {};
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
    ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.id && pend[msg.id]) pend[msg.id](msg.result); };
    ws.onopen = async () => {
      console.log('\nFilms, played in Chrome');
      await send('Page.enable');
      await send('Page.navigate', { url: `http://127.0.0.1:${port}/films-probe.html` });
      for (;;) {
        await new Promise(r => setTimeout(r, 1000));
        const r = await send('Runtime.evaluate', { expression: "(function(){var o=document.getElementById('out');return o&&o.dataset.done?o.textContent:''})()", returnByValue: true });
        const v = r && r.result && r.result.value;
        if (!v) continue;
        for (const [ok, msg] of JSON.parse(v)) check(ok, msg);
        break;
      }
      clearTimeout(kill);
      chrome.kill();
      try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) { /* leave it */ }
      finish(fails ? 1 : 0);
    };
  });
});
