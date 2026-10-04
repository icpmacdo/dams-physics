/* ===================== shared utilities ===================== */
const NS = 'http://www.w3.org/2000/svg';
const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function E(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function T(parent, x, y, str, cls, extra) {
  const t = E('text', Object.assign({ x: x, y: y, class: cls || 'lbl' }, extra || {}), parent);
  t.textContent = str;
  return t;
}
const n1 = v => (Math.round(v * 10) / 10).toFixed(1);
const P = pts => pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
const D = pts => pts.length ? 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') : '';
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const fmt = (v, d) => v.toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });

function mapper(o) {
  const kx = (o.X1 - o.X0) / (o.x1 - o.x0), kz = (o.Y1 - o.Y0) / (o.z1 - o.z0);
  const X = x => o.X0 + (x - o.x0) * kx;
  const Z = z => o.Y1 - (z - o.z0) * kz;
  const pt = q => [X(q[0]), Z(q[1])];
  return { X, Z, kx, kz, pt, P: pts => P(pts.map(pt)), D: pts => D(pts.map(pt)), o };
}
function uniformMapper(x0, x1, z0, z1, W, padX, padY, Hmax) {
  let s = (W - 2 * padX) / (x1 - x0);
  if (Hmax && (z1 - z0) * s + 2 * padY > Hmax) s = (Hmax - 2 * padY) / (z1 - z0);
  const w = (x1 - x0) * s, h = (z1 - z0) * s;
  const X0 = (W - w) / 2;
  const m = mapper({ x0, x1, z0, z1, X0, X1: X0 + w, Y0: padY, Y1: padY + h });
  m.H = h + 2 * padY; m.s = s;
  return m;
}
function smoothD(pts) { // Catmull-Rom → cubic Bézier, pts in svg coords
  if (pts.length < 3) return D(pts);
  let d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += 'C' + c1[0].toFixed(1) + ',' + c1[1].toFixed(1) + ' ' + c2[0].toFixed(1) + ',' + c2[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
  }
  return d;
}
function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; }
  return Math.abs(a) / 2;
}
function clipHalf(poly, inside, cross) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = inside(a), ib = inside(b);
    if (ia) { out.push(a); if (!ib) out.push(cross(a, b)); }
    else if (ib) out.push(cross(a, b));
  }
  return out;
}
const clipBelow = (poly, zmax) => clipHalf(poly, p => p[1] <= zmax, (a, b) => { const t = (zmax - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, zmax]; });
const clipLeftOf = (poly, xmax) => clipHalf(poly, p => p[0] <= xmax, (a, b) => { const t = (xmax - a[0]) / (b[0] - a[0]); return [xmax, a[1] + (b[1] - a[1]) * t]; });
function clipConvex(subject, clip) {
  let s = 0;
  for (let i = 0; i < clip.length; i++) { const a = clip[i], b = clip[(i + 1) % clip.length]; s += a[0] * b[1] - b[0] * a[1]; }
  const sg = s > 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const cr = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    out = clipHalf(out, p => sg * cr(p) >= -1e-9, (p, q) => { const d1 = cr(p), d2 = cr(q), t = d1 / (d1 - d2); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; });
  }
  return out;
}
const band = (fL, fR, z1, z2) => [[fL(z1), z1], [fR(z1), z1], [fR(z2), z2], [fL(z2), z2]];
function pointAlong(pts, cum, s) { // pts polyline, cum cumulative lengths
  if (s <= 0) return pts[0];
  const L = cum[cum.length - 1];
  if (s >= L) return pts[pts.length - 1];
  let i = 1; while (cum[i] < s) i++;
  const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)];
}
function cumLen(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; }
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/* colour helpers for canvas */
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const _cc = document.createElement('canvas').getContext('2d');
function rgba(str) {
  _cc.fillStyle = '#000'; _cc.fillStyle = str || '#000';
  const s = _cc.fillStyle;
  if (s[0] === '#') return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
  const m = s.match(/[\d.]+/g).map(Number);
  return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1];
}
const themeFns = [];
function onTheme(fn) { themeFns.push(fn); }
function fireTheme() { themeFns.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener ? mq.addEventListener('change', fireTheme) : mq.addListener(fireTheme); }
new MutationObserver(fireTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* figure registry, visibility, one animation loop */
const figs = [];
const io = new IntersectionObserver(es => {
  for (const e of es) {
    const f = figs.find(g => g.el === e.target);
    if (!f) continue;
    f.visible = e.isIntersecting;
    if (e.isIntersecting && !f.seen) { f.seen = true; if (f.onFirst) f.onFirst(); }
  }
}, { rootMargin: '60px' });
function fig(el) { const f = { el, visible: false, seen: false, ticks: [], onFirst: null }; figs.push(f); io.observe(el); return f; }
let lastNow = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
  const t = now / 1000;
  for (const f of figs) if (f.visible) for (const fn of f.ticks) { try { fn(t, dt); } catch (e) { console.error(e); } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* timeline player: play/pause button + range slider */
const ICON_PLAY = 'M2,1 L11,6 L2,11 z', ICON_PAUSE = 'M2,1 h3 v10 h-3 z M7,1 h3 v10 h-3 z';
function Player(o) {
  const max = o.max, btn = o.btn, slider = o.slider;
  let t = +slider.value, playing = false;
  const path = btn.querySelector('path'), lab = btn.querySelector('span');
  function label() {
    path.setAttribute('d', playing ? ICON_PAUSE : ICON_PLAY);
    lab.textContent = playing ? 'Pause' : (t >= max - 1e-3 ? (o.replayText || 'Replay') : (o.playText || 'Play'));
  }
  function set(v, fromSlider) { t = clamp(v, 0, max); if (!fromSlider) slider.value = t; o.onUpdate(t); label(); }
  function play() { if (t >= max - 1e-3) set(0); playing = true; label(); if (o.onPlay) o.onPlay(); }
  function pause() { playing = false; label(); }
  btn.addEventListener('click', () => (playing ? pause() : play()));
  slider.addEventListener('input', () => { pause(); if (o.onScrub) o.onScrub(); set(+slider.value, true); });
  const api = {
    tick(dt) { if (!playing) return; let nt = t + dt * max / o.dur; if (o.cap != null && nt >= o.cap()) { nt = o.cap(); playing = false; } if (nt >= max) { nt = max; playing = false; } set(nt); },
    set, play, pause, label,
    get t() { return t; }, get playing() { return playing; }
  };
  label();
  return api;
}
function segGroup(el, onChange) {
  const btns = $$('button', el);
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    onChange(b.dataset.v);
  }));
  return { get value() { const b = btns.find(x => x.getAttribute('aria-pressed') === 'true'); return b ? b.dataset.v : null; } };
}
function waterSymbol(g, x, y) { // ▽ water-level symbol with two ticks beneath
  E('path', { d: `M${x - 5},${y - 9} L${x + 5},${y - 9} L${x},${y - 2} z`, style: 'fill:none;stroke:var(--water);stroke-width:1.2' }, g);
  E('path', { d: `M${x - 6},${y + 3} h12 M${x - 3.5},${y + 6} h7`, style: 'stroke:var(--water);stroke-width:1' }, g);
}
function leader(g, x1, y1, x2, y2) { return E('path', { d: `M${x1},${y1} L${x2},${y2}`, class: 'lead' }, g); }

/* index bar: highlight the section in view */
(function indexBar() {
  const links = $$('.indexbar nav a');
  const secs = links.map(a => $(a.getAttribute('href')));
  const so = new IntersectionObserver(() => {
    let best = -1;
    secs.forEach((s, i) => { const r = s.getBoundingClientRect(); if (r.top < window.innerHeight * 0.4) best = i; });
    links.forEach((a, i) => a.classList.toggle('on', i === best));
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  secs.forEach(s => so.observe(s));
})();

/* ===================== Fig 1: hydro + tailings ===================== */
(function figTypes() {
  const F = fig($('#fig-types'));

  /* ---------- hydro ---------- */
  const svg = $('#svg-hydro');
  const g = E('g', null, svg);
  const BASE = 270, TWY = 262;
  const water = E('path', { class: 'water' }, g);
  const surf = E('path', { class: 'water-line' }, g);
  E('polygon', { class: 'water', points: P([[340, TWY], [560, TWY], [560, 284], [350, 270], [340, 270]]) }, g);
  const twl = E('path', { class: 'water-line', d: `M440,${TWY} L560,${TWY}` }, g);
  E('polygon', { points: P([[0, 262], [190, 270], [350, 270], [560, 284], [560, 340], [0, 340]]), fill: 'url(#p-bedrock)', class: 'edge' }, g);
  // grout curtain + drain under the heel
  E('rect', { x: 205, y: 270, width: 4, height: 48, fill: 'url(#p-grout)' }, g);
  // pressure diagram (behind dam edge)
  const pres = E('g', null, g);
  const presPoly = E('polygon', { style: 'fill:var(--accent-soft);stroke:var(--accent);stroke-width:1' }, pres);
  const presArrows = E('g', null, pres);
  const presLbl = T(pres, 0, 0, 'p = ρgh', 'lbl lbl-acc halo', { 'text-anchor': 'end' });
  const presLbl2 = T(pres, 0, 0, '', 'lbl-s halo', { 'text-anchor': 'end' });
  // dam
  E('polygon', { points: P([[200, 270], [200, 70], [224, 70], [224, 100], [348, 270]]), fill: 'url(#p-conc)', class: 'edge' }, g);
  E('rect', { x: 210, y: 252, width: 12, height: 10, class: 'void' }, g); // gallery
  // intake + penstock
  E('rect', { x: 191, y: 194, width: 9, height: 22, style: 'fill:var(--sheet);stroke:var(--ink);stroke-width:1' }, g);
  for (let i = 0; i < 4; i++) E('line', { x1: 193 + i * 2, y1: 195, x2: 193 + i * 2, y2: 215, style: 'stroke:var(--ink-2);stroke-width:0.7' }, g);
  const pen = 'M200,205 C236,212 268,230 300,240 S346,252 372,253';
  E('path', { d: pen, style: 'stroke:var(--ink);stroke-width:11;fill:none;stroke-linecap:round' }, g);
  E('path', { d: pen, style: 'stroke:var(--water-fill);stroke-width:8;fill:none' }, g);
  const penFlow = E('path', { d: pen, style: 'stroke:var(--water);stroke-width:2.4;fill:none;stroke-dasharray:5 9;stroke-linecap:round' }, g);
  // powerhouse
  E('path', { d: 'M352,206 L432,206 L432,272 L352,272 z', style: 'fill:var(--sheet);stroke:var(--ink);stroke-width:1.2' }, g);
  E('path', { d: 'M348,206 L436,206 L436,200 L348,200 z', class: 'ink' }, g);
  E('rect', { x: 371, y: 214, width: 26, height: 16, style: 'fill:var(--m-conc);stroke:var(--ink);stroke-width:1' }, g);
  E('line', { x1: 384, y1: 230, x2: 384, y2: 241, style: 'stroke:var(--ink);stroke-width:2' }, g);
  E('circle', { cx: 384, cy: 253, r: 13, style: 'fill:var(--water-fill);stroke:var(--ink);stroke-width:1.2' }, g);
  const runner = E('g', null, g);
  for (let i = 0; i < 6; i++) E('path', { d: 'M384,250 Q389,246 393,250', transform: `rotate(${i * 60},384,253)`, style: 'stroke:var(--ink);stroke-width:1.6;fill:none' }, runner);
  E('circle', { cx: 384, cy: 253, r: 2.4, class: 'ink' }, runner);
  const dt = 'M384,265 Q392,272 444,266';
  E('path', { d: dt, style: 'stroke:var(--ink);stroke-width:9;fill:none' }, g);
  E('path', { d: dt, style: 'stroke:var(--water-fill);stroke-width:6;fill:none' }, g);
  const dtFlow = E('path', { d: dt, style: 'stroke:var(--water);stroke-width:2;fill:none;stroke-dasharray:4 8' }, g);
  // transmission
  E('path', { d: 'M520,282 L528,160 L536,282 M522,250 L534,250 M523,220 L533,220 M525,190 L531,190 M514,170 L542,170', style: 'stroke:var(--ink-2);stroke-width:1.1;fill:none' }, g);
  const wire = 'M392,214 L392,200 Q460,150 514,170 Q540,180 560,166';
  E('path', { d: wire, style: 'stroke:var(--ink-2);stroke-width:0.8;fill:none' }, g);
  const wireFlow = E('path', { d: wire, style: 'stroke:var(--accent);stroke-width:2.2;fill:none;stroke-dasharray:2 16;stroke-linecap:round' }, g);
  // dimension H
  const dimG = E('g', null, g);
  const dimLine = E('path', { class: 'dim', 'marker-start': 'url(#arr)', 'marker-end': 'url(#arr)' }, dimG);
  const extUp = E('path', { class: 'dim', style: 'stroke-dasharray:3 3' }, dimG);
  E('path', { class: 'dim', d: `M440,${TWY} L470,${TWY}`, style: 'stroke-dasharray:3 3' }, dimG);
  const dimLbl = T(dimG, 470, 0, '', 'lbl-b halo');
  const wsym = E('g', null, g);
  waterSymbol(g, 500, TWY);
  // labels
  T(g, 262, 150, 'Gravity dam', 'lbl-b halo', { 'text-anchor': 'middle' });
  T(g, 272, 166, 'mass concrete', 'lbl-s halo', { 'text-anchor': 'middle' });
  leader(g, 191, 200, 154, 184); T(g, 152, 182, 'Intake', 'lbl halo', { 'text-anchor': 'end' });
  T(g, 300, 228, 'Penstock', 'lbl-s halo', { transform: 'rotate(20,300,228)' });
  T(g, 392, 194, 'Powerhouse', 'lbl halo', { 'text-anchor': 'middle' });
  leader(g, 397, 222, 440, 226); T(g, 444, 229, 'Generator', 'lbl-s halo');
  leader(g, 397, 253, 440, 244); T(g, 444, 246, 'Turbine', 'lbl-s halo');
  T(g, 470, 256, 'Tailrace', 'lbl-s halo');
  leader(g, 216, 262, 240, 300); T(g, 243, 304, 'Drainage gallery', 'lbl-s halo');
  T(g, 214, 330, 'Grout curtain', 'lbl-s halo');
  T(g, 30, 300, 'Bedrock', 'lbl-s halo');

  const lvl = $('#hy-level'), flow = $('#hy-flow');
  let wl = 92, Q = 150, phase = 0, runAng = 0;
  const parts = [];
  for (let i = 0; i < 14; i++) parts.push({ x: rnd() * 180 + 10, y: 0, e: E('circle', { r: 1.6, class: 'particle', opacity: 0.8 }, g), sx: 0, sy: 0 });
  function hydroUpdate() {
    wl = lerp(150, 78, +lvl.value / 100); Q = +flow.value;
    const H = (TWY - wl) * 0.5, depth = (BASE - wl) * 0.5;
    const pMPa = 9.81 * depth / 1000, Fmn = 0.5 * 9.81 * depth * depth / 1000;
    const Pmw = 0.9 * 9.81 * Q * H / 1000;
    $('#hy-level-o').textContent = 'H = ' + Math.round(H) + ' m';
    $('#hy-flow-o').textContent = Q + ' m³/s';
    $('#hy-P').textContent = fmt(Pmw) + ' MW';
    $('#hy-p').textContent = pMPa.toFixed(2) + ' MPa';
    $('#hy-F').textContent = 'Water load ' + Math.round(Fmn) + ' MN per metre of dam';
    const kp = 0.42, w = kp * (268 - wl);
    presPoly.setAttribute('points', P([[200, wl], [200, 268], [200 - w, 268]]));
    presArrows.textContent = '';
    for (let y = wl + 22; y < 266; y += 22) {
      const len = kp * (y - wl);
      if (len < 6) continue;
      E('path', { d: `M${200 - len},${y} L198,${y}`, style: 'stroke:var(--accent);stroke-width:1;fill:none', 'marker-end': 'url(#arr-acc)' }, presArrows);
    }
    presLbl.setAttribute('x', 200 - w - 6); presLbl.setAttribute('y', 252);
    presLbl2.setAttribute('x', 200 - w - 6); presLbl2.setAttribute('y', 265); presLbl2.textContent = pMPa.toFixed(2) + ' MPa at heel';
    dimLine.setAttribute('d', `M462,${wl + 1} L462,${TWY - 1}`);
    extUp.setAttribute('d', `M226,${wl} L470,${wl}`);
    dimLbl.setAttribute('y', (wl + TWY) / 2 + 4); dimLbl.setAttribute('x', 468);
    dimLbl.textContent = 'H = ' + Math.round(H) + ' m';
    wsym.textContent = ''; waterSymbol(wsym, 110, wl);
    drawWater(0);
  }
  function drawWater(t) {
    const top = [];
    for (let x = 0; x <= 200; x += 8) top.push([x, wl + (RM ? 0 : 1.2 * Math.sin(x / 13 + t * 1.7))]);
    water.setAttribute('d', D(top) + 'L200,270 L190,270 L0,262 z');
    surf.setAttribute('d', D(top));
  }
  lvl.addEventListener('input', hydroUpdate); flow.addEventListener('input', hydroUpdate);
  hydroUpdate();
  // respawn particles inside reservoir
  function spawn(p) { p.x = 10 + rnd() * 170; p.y = lerp(wl + 14, 252, rnd()); }
  parts.forEach(spawn);
  let off1 = 0, off2 = 0, off3 = 0;
  F.ticks.push((t, dt) => {
    if (RM) return;
    drawWater(t);
    const sp = Q / 150;
    off1 -= dt * 40 * sp; off2 -= dt * 30 * sp; off3 -= dt * 30 * (Q * (TWY - wl)) / (150 * 170);
    penFlow.style.strokeDashoffset = off1; dtFlow.style.strokeDashoffset = off2; wireFlow.style.strokeDashoffset = off3;
    runAng = (runAng + dt * 260 * sp) % 360;
    runner.setAttribute('transform', `rotate(${runAng.toFixed(1)},384,253)`);
    for (const p of parts) {
      const dx = 196 - p.x, dy = 205 - p.y, d = Math.hypot(dx, dy);
      const v = (8 + 900 / (d + 20)) * sp;
      p.x += dx / d * v * dt; p.y += dy / d * v * dt;
      if (d < 6 || p.y < wl + 4) spawn(p);
      p.e.setAttribute('cx', p.x.toFixed(1)); p.e.setAttribute('cy', p.y.toFixed(1));
    }
  });

  /* ---------- tailings ---------- */
  const s2 = $('#svg-tail');
  const defs = E('defs', null, s2);
  const lg = E('linearGradient', { id: 'g-beach', gradientUnits: 'userSpaceOnUse', x1: 130, y1: 0, x2: 400, y2: 0 }, defs);
  E('stop', { offset: '0', style: 'stop-color:var(--m-slime)' }, lg);
  E('stop', { offset: '0.45', style: 'stop-color:var(--m-slime)' }, lg);
  E('stop', { offset: '1', style: 'stop-color:var(--m-tsand)' }, lg);
  const h = E('g', null, s2);
  const beach = [[400, 133], [265, 150], [200, 160], [60, 166], [36, 166]];
  E('polygon', { points: P([[0, 166], [60, 166], [200, 160], [265, 150], [406, 132], [406, 300], [0, 300]]), fill: 'url(#g-beach)' }, h);
  for (const d of [20, 40, 60, 80]) E('path', { d: D([[40, 166 + d], [200, 160 + d], [265, 150 + d], [406, 132 + d]]), class: 'tx', style: 'stroke-dasharray:4 4' }, h);
  E('polygon', { class: 'water', points: P([[25, 150], [265, 150], [200, 160], [60, 166], [36, 166]]) }, h);
  E('path', { class: 'water-line', d: 'M25,150 L265,150' }, h);
  waterSymbol(h, 110, 150);
  E('polygon', { points: P([[0, 110], [95, 262], [560, 272], [560, 340], [0, 340]]), fill: 'url(#p-bedrock)', class: 'edge' }, h);
  E('polygon', { points: P([[366, 266], [408, 128], [432, 128], [548, 272]]), fill: 'url(#p-fill)', class: 'edge' }, h);
  // lift lines (staged raises)
  const usx = y => 366 + (266 - y) * (42 / 138), dsx = y => 432 + (y - 128) * (116 / 144);
  for (const y of [176, 222]) E('path', { d: `M${usx(y)},${y} L${dsx(y)},${y}`, class: 'ink-s', style: 'stroke-width:0.8;stroke-dasharray:5 3' }, h);
  E('path', { d: 'M384,266 L404,222 L424,222 L476,268', class: 'ink-s', style: 'stroke-width:0.9;stroke-dasharray:2 2' }, h);
  E('polygon', { points: P([[428, 262], [540, 271], [540, 267], [428, 258]]), fill: 'url(#p-drain)', class: 'edge-l' }, h);
  // phreatic
  E('path', { d: 'M265,150 C330,156 386,196 416,232 S452,260 482,262', class: 'phreatic' }, h);
  // pipelines
  E('path', { d: 'M560,122 L404,122 L402,128', style: 'stroke:var(--ink);stroke-width:3.4;fill:none;stroke-linejoin:round' }, h);
  const slurry = E('path', { d: 'M560,122 L404,122 L402,128', style: 'stroke:var(--m-tsand);stroke-width:1.6;fill:none;stroke-dasharray:4 5' }, h);
  const spout = E('path', { d: 'M402,128 Q399,130 398,134', style: 'stroke:var(--m-slime);stroke-width:2.2;fill:none;stroke-dasharray:2 2' }, h);
  const recl = 'M168,149 L262,149 Q330,132 400,110 L560,104';
  E('path', { d: recl, style: 'stroke:var(--ink-2);stroke-width:2.6;fill:none' }, h);
  const reclFlow = E('path', { d: recl, style: 'stroke:var(--water);stroke-width:1.4;fill:none;stroke-dasharray:4 6' }, h);
  E('polygon', { points: P([[132, 148], [170, 148], [166, 154], [136, 154]]), class: 'ink' }, h);
  E('rect', { x: 141, y: 140, width: 15, height: 8, style: 'fill:var(--sheet);stroke:var(--ink);stroke-width:1' }, h);
  // labels
  T(h, 552, 98, 'Reclaim water → mill', 'lbl-s halo', { 'text-anchor': 'end' });
  T(h, 552, 136, 'Slurry from mill', 'lbl-s halo', { 'text-anchor': 'end' });
  leader(h, 403, 127, 380, 108); T(h, 377, 104, 'Spigots', 'lbl halo', { 'text-anchor': 'end' });
  T(h, 330, 132, 'Beach', 'lbl halo', { 'text-anchor': 'middle', transform: 'rotate(-7,330,132)' });
  T(h, 150, 132, 'Reclaim barge', 'lbl-s halo', { 'text-anchor': 'middle' });
  T(h, 60, 142, 'Pond', 'lbl halo', { 'text-anchor': 'middle' });
  T(h, 300, 196, 'Sands', 'lbl-s halo', { 'text-anchor': 'middle' });
  T(h, 170, 205, 'Slimes (fines)', 'lbl-s halo', { 'text-anchor': 'middle' });
  T(h, 470, 200, 'Embankment', 'lbl-b halo', { 'text-anchor': 'middle' });
  T(h, 478, 214, 'raised in stages', 'lbl-s halo', { 'text-anchor': 'middle' });
  T(h, 428, 252, 'Starter dam', 'lbl-s halo', { 'text-anchor': 'middle' });
  T(h, 348, 182, 'Phreatic surface', 'lbl-s lbl-w halo', { transform: 'rotate(30,348,182)' });
  leader(h, 500, 268, 506, 296); T(h, 506, 306, 'Underdrain', 'lbl-s halo', { 'text-anchor': 'middle' });
  // grains
  const bc = cumLen(beach), BL = bc[bc.length - 1];
  const grains = [];
  const gG = E('g', null, h);
  function spawnGrain(gr, stagger) {
    const r = rnd();
    gr.type = r < 0.38 ? 0 : r < 0.68 ? 1 : 2;
    gr.s = 0; gr.age = stagger ? -rnd() * 5 : 0; gr.state = 'roll';
    gr.stop = gr.type === 0 ? lerp(4, 42, rnd()) : gr.type === 1 ? lerp(35, 115, rnd()) : lerp(170, 360, rnd());
    gr.r = [2.3, 1.6, 1.0][gr.type];
    gr.e.setAttribute('r', gr.r);
    gr.e.style.fill = gr.type === 2 ? 'var(--ink-2)' : 'var(--ink)';
    gr.op = 1; gr.settle = 0;
  }
  for (let i = 0; i < 46; i++) { const gr = { e: E('circle', null, gG) }; spawnGrain(gr, true); grains.push(gr); }
  function placeGrains(dt) {
    for (const gr of grains) {
      gr.age += dt;
      if (gr.age < 0) { gr.e.setAttribute('opacity', 0); continue; }
      const p = pointAlong(beach, bc, gr.s);
      const inPond = p[0] < 265;
      if (gr.state === 'roll') {
        const v = inPond ? 14 : (gr.type === 0 ? 34 : 42);
        gr.s += v * dt;
        if (inPond) gr.settle = Math.min(1, gr.settle + dt * 0.12);
        if (gr.s >= gr.stop) { gr.s = gr.stop; gr.state = 'rest'; gr.restT = 0; }
      } else {
        gr.restT += dt; gr.op = Math.max(0, 1 - gr.restT / 2.5);
        if (gr.op <= 0) spawnGrain(gr, false);
      }
      const q = pointAlong(beach, bc, gr.s);
      const yy = q[0] < 265 ? lerp(150 + 2, q[1] - gr.r, gr.settle) : q[1] - gr.r;
      gr.e.setAttribute('cx', q[0].toFixed(1)); gr.e.setAttribute('cy', yy.toFixed(1)); gr.e.setAttribute('opacity', gr.op.toFixed(2));
    }
  }
  placeGrains(3);
  let o1 = 0, o2 = 0, o3 = 0;
  F.ticks.push((t, dt) => {
    if (RM) return;
    o1 -= dt * 30; o2 -= dt * 20; o3 -= dt * 18;
    slurry.style.strokeDashoffset = -o1; spout.style.strokeDashoffset = o2; reclFlow.style.strokeDashoffset = o3;
    placeGrains(dt);
  });
})();

/* ===================== Fig 2: raising methods ===================== */
(function figRaise() {
  const F = fig($('#fig-raise'));
  const R = { h0: 20, dh: 12, n: 4, s: 2, c: 8, X0: 260, b: 0.08, Lb: 100, b2: 0.01 };
  const zk = k => R.h0 + R.dh * k;
  const M = mapper({ x0: 0, x1: 580, z0: -12, z1: 84, X0: 10, X1: 990, Y0: 6, Y1: 246 });
  const starter = [[260, 0], [348, 0], [308, 20], [300, 20]];
  // per-method geometry
  const up = { faces: [300], dykes: [] };
  for (let k = 1; k <= 4; k++) {
    const xd = up.faces[k - 1] + 4, z0 = zk(k - 1), z1 = zk(k);
    up.dykes.push({ k, xd, poly: [[xd - 56, z0], [xd, z0], [xd - 24, z1], [xd - 32, z1]], base: [xd - 56, xd - 0.5 - 4], z0, z1 });
    up.faces.push(xd - 32);
  }
  const dnRaise = k => { const a = zk(k - 1), b = zk(k); return [[260 + 2 * a, a], [260 + 2 * b, b], [268 + 2 * b, b], [268 + 4 * b, 0], [268 + 4 * a, 0], [268 + 2 * a, a]]; };
  const clRaise = k => { const a = zk(k - 1), b = zk(k); return [[276, a], [300, b], [308, b], [308 + 2 * b, 0], [308 + 2 * a, 0], [308, a], [300, a]]; };

  const methods = [
    { key: 'up', name: 'Upstream', note: 'Crest moves toward the pond' },
    { key: 'down', name: 'Downstream', note: 'Crest moves away from the pond' },
    { key: 'centre', name: 'Centreline', note: 'Crest rises vertically' }
  ];
  const host = $('#rs-panels');
  for (const m of methods) {
    const wrap = document.createElement('div'); wrap.className = 'raise-panel';
    wrap.innerHTML = `<div class="raise-head"><h4>${m.name} <span class="scale-note" style="margin-left:8px">${m.note}</span></h4><div class="raise-stats"><span>Fill <b data-k="fill">–</b> m³/m</span><span>Crest shift <b data-k="shift">–</b></span><span>On tailings <b data-k="ontail">–</b></span><span class="pill neutral" data-k="pill">–</span></div></div>`;
    const svg = E('svg', { class: 'dwg', viewBox: '0 0 1000 252', role: 'img', 'aria-label': `${m.name} method: staged cross-section of the dam and tailings` }, null);
    const sw = document.createElement('div'); sw.className = 'svgwrap'; sw.appendChild(svg); wrap.appendChild(sw);
    host.appendChild(wrap);
    m.svg = svg; m.wrap = wrap;
    m.root = E('g', null, svg);
    const L = n => E('g', null, m.root);
    m.gTail = L(); m.gOld = L(); m.gPond = L(); m.gDam = L(); m.gLobe = L(); m.gDyk = L(); m.gZones = L(); m.gAcc = L(); m.gSat = L(); m.gPh = L(); m.gCrest = L(); m.gGround = L(); m.gLbl = L();
    E('polygon', { points: M.P([[0, 95], [95, 0], [580, 0], [580, -12], [0, -12]]), fill: 'url(#p-alluv)', class: 'edge' }, m.gGround);
    T(m.gLbl, M.X(560), M.Z(-7), 'Foundation', 'lbl-s halo', { 'text-anchor': 'end' });
  }

  function stateAt(t) {
    const p = Math.min(9, Math.floor(t)), f = t >= 10 ? 1 : t - p;
    let built = 0, partialK = 0, partialTop = 0, zt = 0, zDam = 0, starterTop = 20;
    if (p === 0) { starterTop = 20 * f; zDam = starterTop; zt = 0; }
    else if (p % 2 === 1) { built = (p - 1) / 2; zDam = zk(built); const prev = built === 0 ? 0 : zk(built - 1); zt = lerp(prev, zk(built), f); }
    else { built = p / 2 - 1; partialK = p / 2; partialTop = zk(partialK - 1) + R.dh * f; zDam = partialTop; zt = zk(partialK - 1); }
    return { p, f, built, partialK, partialTop, zt, zDam, starterTop };
  }
  function stageText(t) {
    if (t >= 10 - 1e-3) return 'Raise 4 complete · 68 m';
    const p = Math.floor(t), k = Math.floor(p / 2);
    if (p === 0) return 'Starter dam · placing fill';
    if (p === 1) return 'Starter dam · depositing tailings';
    return `Raise ${k} · ` + (p % 2 === 0 ? 'placing fill' : 'depositing tailings');
  }
  function faceX(m, S, zt) { // x of the tailings face at level zt
    if (m.key === 'down') return 260 + 2 * zt;
    if (m.key === 'centre') { if (zt <= 20) return 260 + 2 * zt; const k = Math.min(4, Math.ceil((zt - 20) / 12 - 1e-9)); return 276 + 2 * (zt - zk(k - 1)); }
    if (zt <= 20) return 260 + 2 * zt;
    const k = Math.min(4, Math.ceil((zt - 20) / 12 - 1e-9));
    return up.dykes[k - 1].poly[0][0] + 2 * (zt - zk(k - 1));
  }
  function render(m, t, fail) {
    const S = stateAt(t);
    [m.gOld, m.gTail, m.gPond, m.gSat, m.gDam, m.gLobe, m.gDyk, m.gZones, m.gAcc, m.gPh, m.gCrest].forEach(g => (g.textContent = ''));
    const ff = m.key === 'up' ? fail : 0;
    // --- dam polygons ---
    const dam = [];
    const st = S.p === 0 ? clipBelow(starter, S.starterTop) : starter;
    if (st.length) dam.push({ poly: st, kind: 'starter' });
    const nRaise = S.built + (S.partialK ? 1 : 0);
    for (let k = 1; k <= nRaise; k++) {
      let poly = m.key === 'up' ? up.dykes[k - 1].poly : m.key === 'down' ? dnRaise(k) : clRaise(k);
      if (k === S.partialK) poly = clipBelow(poly, S.partialTop);
      if (poly.length) dam.push({ poly, kind: 'raise', k });
    }
    // --- tailings ---
    const zt = S.zt;
    let xf = 0, zp = 0, xw = 0;
    if (zt > 0.05) {
      xf = faceX(m, S, zt);
      const top = [];
      const x2 = Math.max(0, xf - R.Lb), zb2 = zt - R.b * R.Lb;
      top.push([0, zb2 - R.b2 * x2]);
      if (xf - R.Lb > 0) top.push([x2, zb2]);
      if (ff > 0) {
        // dykes slide away: tailings surface relaxes from the intact envelope to a slump that runs out over the starter
        const xs = Math.max(x2 + 1, xf - 150), zs = zt - R.b * (xf - xs);
        for (let i = 1; i <= 24; i++) {
          const x = lerp(xs, 300, i / 24);
          const z0 = x <= xf ? zt - R.b * (xf - x) : lerp(zt, 20, (x - xf) / (300 - xf));
          const u = (x - xs) / (300 - xs), sm = u * u * (3 - 2 * u);
          const z1 = lerp(zs, 21, sm) - 6 * Math.sin(Math.PI * u);
          top.push([x, lerp(z0, z1, ff)]);
        }
      } else top.push([xf, zt]);
      const poly = top.concat([[top[top.length - 1][0], -1], [0, -1]]);
      E('polygon', { points: M.P(poly), fill: ff > 0 ? 'url(#p-liq)' : 'url(#p-tsand)' }, m.gTail);
      if (m.key === 'up' && ff === 0) {
        for (let k = 1; k <= nRaise; k++) {
          const dk = up.dykes[k - 1];
          E('polygon', { points: M.P([[dk.poly[0][0], -1], [dk.xd, -1], [dk.xd, dk.z0], [dk.poly[0][0], dk.z0]]), fill: 'url(#p-tsand)' }, m.gTail);
        }
      }
      // old beach surfaces
      const doneDeposits = S.p % 2 === 1 ? S.built : S.built + (S.partialK ? 1 : 0);
      for (let j = 0; j < (ff > 0 ? 0 : doneDeposits); j++) {
        const zj = zk(j), xj = faceX(m, S, zj);
        if (zj >= zt - 0.5) continue;
        E('path', { d: M.D([[0, zj - R.b * R.Lb - R.b2 * Math.max(0, xj - R.Lb)], [Math.max(0, xj - R.Lb), zj - R.b * R.Lb], [xj, zj]]), class: 'tx', style: 'stroke-dasharray:5 4;stroke-width:1' }, m.gOld);
      }
      // pond
      zp = zt - 0.75 * R.b * R.Lb - ff * 5; xw = xf - 0.75 * R.Lb;
      if (zp > 0) {
        const pond = [[0, zp], [xw, zp], [x2, zb2], [0, zb2 - R.b2 * x2]];
        if (pond[2][1] < zp) { E('polygon', { points: M.P(pond), class: 'water' }, m.gPond); E('path', { d: M.D([[0, zp], [xw, zp]]), class: 'water-line' }, m.gPond); }
      }
      // phreatic surface
      if (zt > 4 && ff < 0.99) {
        let xe, ze;
        if (m.key === 'up') { xe = 318; ze = 1; }
        else if (m.key === 'down') { ze = Math.max(1, (xw + 30 - 267.5) / 2); xe = 267.5 + 2 * ze; }
        else { xe = 306.5; ze = Math.max(1, 0.25 * zp); }
        if (xe > xw + 2) {
          const ph = [];
          for (let i = 0; i <= 24; i++) { const x = lerp(xw, xe, i / 24); ph.push([x, ze + (zp - ze) * Math.sqrt(Math.max(0, (xe - x) / (xe - xw)))]); }
          const sat = [[0, zp]].concat(ph, [[xe, 0], [0, 0]]);
          E('polygon', { points: M.P(sat), fill: 'url(#p-sat)', opacity: (1 - ff).toFixed(2) }, m.gSat);
          E('path', { d: smoothD(ph.map(M.pt)), class: 'phreatic', opacity: (1 - ff).toFixed(2) }, m.gPh);
          if (m.key === 'centre') E('path', { d: M.D([[xe, ze], [xe, 1]]), class: 'phreatic', opacity: (1 - ff).toFixed(2) }, m.gPh);
        }
      }
    }
    // --- draw dam fills ---
    let fillA = 0, tailA = 0;
    for (const d of dam) {
      const a = polyArea(d.poly); fillA += a;
      const target = (m.key === 'up' && d.kind === 'raise') ? m.gDyk : m.gDam;
      E('polygon', { points: M.P(d.poly), fill: 'url(#p-fill)', class: 'edge' }, target);
      if (d.kind === 'raise' && m.key === 'up') {
        tailA += a;
        const dk = up.dykes[d.k - 1];
        E('path', { d: M.D([[dk.poly[0][0] + 0.5, dk.z0], [dk.xd - 4.5, dk.z0]]), class: 'acc-line' }, m.gDyk);
      }
      if (d.kind === 'raise' && m.key === 'centre') {
        const wedge = clipLeftOf(d.poly, 300);
        if (wedge.length) tailA += polyArea(wedge);
        E('path', { d: M.D([[276.5, zk(d.k - 1)], [299.5, zk(d.k - 1)]]), class: 'acc-line' }, m.gAcc);
      }
    }
    // internal zones
    const zD = S.zDam;
    if (zD > 1) {
      if (m.key === 'up') {
        E('polygon', { points: M.P(clipBelow([[304, 0], [340, 0], [340, 2], [304, 2]], zD)), fill: 'url(#p-drain)', class: 'edge-l' }, m.gZones);
      } else if (m.key === 'down') {
        const zz = Math.max(0, zD - 2);
        E('polygon', { points: M.P([[260, 0], [266, 0], [266 + 2 * zz, zz], [260 + 2 * zz, zz]]), fill: 'url(#p-clay)', class: 'edge-l' }, m.gZones);
        E('polygon', { points: M.P([[266, 0], [269, 0], [269 + 2 * zz, zz], [266 + 2 * zz, zz]]), fill: 'url(#p-drain)', class: 'edge-l' }, m.gZones);
        const toe = 268 + 4 * zD;
        E('polygon', { points: M.P([[269, 0], [toe - 10, 0], [toe - 13, 1.6], [269, 1.6]]), fill: 'url(#p-drain)', class: 'edge-l' }, m.gZones);
      } else {
        const zz = Math.max(0, zD - 2);
        E('polygon', { points: M.P([[305, 0], [308, 0], [308, zz], [305, zz]]), fill: 'url(#p-drain)', class: 'edge-l' }, m.gZones);
        const toe = 308 + 2 * zD;
        E('polygon', { points: M.P([[308, 0], [toe - 8, 0], [toe - 11, 1.6], [308, 1.6]]), fill: 'url(#p-drain)', class: 'edge-l' }, m.gZones);
      }
    }
    // failure lobe + dyke slide
    if (ff > 0) {
      const Lb = 40 + 205 * ff;
      const lobe = [[298, 20 - 4 * ff], [326, 13 * ff + 6], [348 + 0.3 * Lb, 3 + 4 * ff], [Math.min(578, 348 + Lb), 0], [300, 0]];
      E('polygon', { points: M.P(lobe), fill: 'url(#p-liq)', class: 'edge-l', opacity: Math.min(1, ff * 3).toFixed(2) }, m.gLobe);
      const piv = M.pt([300, 20]);
      m.gDyk.setAttribute('transform', `translate(${(M.kx * 74 * ff).toFixed(1)},${(M.kz * 26 * ff).toFixed(1)}) rotate(${(11 * ff).toFixed(2)},${piv[0].toFixed(1)},${piv[1].toFixed(1)})`);
      m.gDyk.setAttribute('opacity', (1 - 0.6 * ff).toFixed(2));
    } else { m.gDyk.removeAttribute('transform'); m.gDyk.removeAttribute('opacity'); }
    // crest path
    const crests = [];
    if (S.p > 0 || S.f > 0.99) crests.push([304, 20]);
    for (let k = 1; k <= S.built + (S.partialK && S.f > 0.99 ? 1 : 0); k++) {
      const cx = m.key === 'up' ? up.faces[k] + 4 : m.key === 'down' ? 264 + 2 * zk(k) : 304;
      crests.push([cx, zk(k)]);
    }
    if (crests.length > 1) E('path', { d: M.D(crests), class: 'crest-path', opacity: (1 - ff).toFixed(2) }, m.gCrest);
    crests.forEach(c => E('circle', { cx: M.X(c[0]), cy: M.Z(c[1]) - 6, r: 2.6, class: 'crest-dot', opacity: (1 - ff).toFixed(2) }, m.gCrest));
    if (crests.length) {
      const c = crests[crests.length - 1];
      E('path', { d: `M${M.X(c[0]) - 5},${M.Z(c[1]) - 16} h10 l-5,7 z`, class: 'crest-dot', opacity: (1 - ff).toFixed(2) }, m.gCrest);
    }
    // labels
    m.gLbl.querySelectorAll('.dyn').forEach(e => e.remove());
    const lab = (x, z, s, c, a) => T(m.gLbl, M.X(x), M.Z(z), s, (c || 'lbl-s') + ' halo dyn', { 'text-anchor': a || 'middle' });
    if (S.p > 0) lab(304, 7, 'Starter', 'lbl-s');
    if (zt > 12 && xf > 140) lab(Math.max(150, xf - 60), zt - 13, 'Tailings', 'lbl-s');
    if (zp > 8) lab(Math.max(40, xw - 40), zp + 3, 'Pond', 'lbl-s lbl-w');
    if (ff > 0.6) lab(470, 14, 'Liquefied tailings flow', 'lbl lbl-acc');
    // stats
    const shift = crests.length ? crests[crests.length - 1][0] - 304 : 0;
    const q = k => m.wrap.querySelector(`[data-k="${k}"]`);
    q('fill').textContent = fmt(fillA);
    q('shift').textContent = (shift > 0.5 ? '+' : shift < -0.5 ? '−' : '') + Math.abs(Math.round(shift)) + ' m';
    q('ontail').textContent = fillA ? Math.round(100 * tailA / fillA) + '%' : '0%';
  }
  function setPills(stateName) {
    for (const m of methods) {
      const p = m.wrap.querySelector('[data-k="pill"]');
      let cls = 'neutral', txt = '';
      if (stateName === 'quake') { cls = 'warn'; txt = 'Shaking'; }
      else if (stateName === 'after') {
        if (m.key === 'up') { cls = 'bad'; txt = 'Flow failure'; } else { cls = 'ok'; txt = 'Holds'; }
      } else {
        txt = m.key === 'up' ? 'Raises on tailings' : m.key === 'down' ? 'Raises on fill' : 'Partly on beach';
        cls = m.key === 'up' ? 'warn' : m.key === 'down' ? 'ok' : 'neutral';
      }
      p.className = 'pill ' + cls; p.textContent = txt;
    }
  }
  let fail = 0, quake = null;
  const stageEl = $('#rs-stage'), shakeBtn = $('#rs-shake'), resetBtn = $('#rs-reset');
  function renderAll(t) { methods.forEach(m => render(m, t, fail)); stageEl.textContent = stageText(t); }
  function clearQuake() {
    if (!quake && fail === 0) return;
    quake = null; fail = 0; methods.forEach(m => m.root.removeAttribute('transform'));
    resetBtn.hidden = true; shakeBtn.disabled = false; setPills('normal');
  }
  const player = Player({ max: 10, dur: 14, btn: $('#rs-play'), slider: $('#rs-t'), onUpdate: renderAll, onScrub: clearQuake, onPlay: () => { clearQuake(); } });
  shakeBtn.addEventListener('click', () => {
    player.pause(); fail = 0; player.set(10);
    quake = { t0: performance.now() / 1000 };
    shakeBtn.disabled = true; setPills('quake');
    if (RM) { quake = null; fail = 1; renderAll(10); setPills('after'); resetBtn.hidden = false; }
  });
  resetBtn.addEventListener('click', () => { clearQuake(); renderAll(player.t); });
  setPills('normal');
  renderAll(10);
  F.onFirst = () => { if (!RM) { player.set(0); player.play(); } };
  F.ticks.push((t, dt) => {
    player.tick(dt);
    if (quake) {
      const el = t - quake.t0;
      if (el < 2.6) {
        const amp = 7 * Math.sin(Math.PI * Math.min(1, el / 2.6)) ;
        const off = amp * Math.sin(2 * Math.PI * 5.5 * el);
        methods.forEach(m => m.root.setAttribute('transform', `translate(${off.toFixed(2)},0)`));
      } else {
        methods.forEach(m => m.root.removeAttribute('transform'));
        if (!quake.after) { quake.after = true; setPills('after'); }
        fail = ease(clamp((el - 2.6) / 2.4, 0, 1));
        render(methods[0], 10, fail);
        if (fail >= 1) { quake = null; resetBtn.hidden = false; }
      }
    }
  });
})();
