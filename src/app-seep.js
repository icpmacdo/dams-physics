/* ===================== Fig 5: seepage paths ===================== */
(function figPaths() {
  const F = fig($('#fig-paths'));
  const svg = $('#svg-paths');
  const g = E('g', null, svg);
  // reservoir
  E('polygon', { class: 'water', points: P([[0, 88], [176, 88], [150, 210], [0, 210]]) }, g);
  E('path', { class: 'water-line', d: 'M0,88 L176,88' }, g);
  waterSymbol(g, 60, 88);
  // foundation
  E('polygon', { points: P([[0, 210], [720, 210], [720, 250], [0, 250]]), fill: 'url(#p-alluv)', class: 'edge' }, g);
  E('polygon', { points: P([[0, 250], [720, 250], [720, 340], [0, 340]]), fill: 'url(#p-bedrock)', class: 'edge' }, g);
  for (const j of ['M20,262 L120,300 L170,292', 'M240,330 L300,280 L340,300', 'M420,268 L470,320', 'M560,300 L640,262 L700,288', 'M90,330 L160,316']) E('path', { d: j, style: 'stroke:var(--ink);stroke-width:1.1;fill:none;opacity:.55' }, g);
  // dam
  E('polygon', { points: P([[150, 210], [330, 70], [370, 70], [570, 210]]), fill: 'url(#p-rock)', class: 'edge' }, g);
  E('polygon', { points: P([[333, 74], [367, 74], [400, 210], [300, 210]]), fill: 'url(#p-clay)', class: 'edge-l' }, g);
  E('polygon', { points: P([[300, 210], [400, 210], [368, 232], [332, 232]]), fill: 'url(#p-clay)', class: 'edge-l' }, g);
  E('polygon', { points: P([[367, 74], [374, 74], [407, 210], [400, 210]]), fill: 'url(#p-filter)', class: 'edge-l' }, g);
  E('polygon', { points: P([[400, 204], [548, 204], [556, 210], [400, 210]]), fill: 'url(#p-filter)', class: 'edge-l' }, g);
  E('polygon', { points: P([[530, 210], [570, 210], [548, 194]]), fill: 'url(#p-drain)', class: 'edge-l' }, g);
  E('rect', { x: 346, y: 250, width: 8, height: 64, fill: 'url(#p-grout)' }, g);
  // outlet conduit + intake tower
  E('rect', { x: 120, y: 120, width: 18, height: 90, fill: 'url(#p-conc)', class: 'edge' }, g);
  E('rect', { x: 136, y: 197, width: 444, height: 9, fill: 'url(#p-conc)', class: 'edge' }, g);
  E('rect', { x: 139, y: 199.5, width: 438, height: 4, style: 'fill:var(--sheet)' }, g);
  // sand boil
  E('path', { d: 'M598,210 Q606,200 614,210 z', style: 'fill:var(--m-alluv);stroke:var(--ink);stroke-width:1' }, g);
  // paths
  const paths = [
    { n: 1, d: 'M168,150 C230,150 300,140 336,150 C356,158 368,176 388,196 C400,206 430,207 470,207 L536,206', v: 16 },
    { n: 2, d: 'M70,212 C150,232 260,244 350,244 C440,244 548,236 606,206', v: 26 },
    { n: 3, d: 'M100,214 C140,262 250,306 330,322 C364,328 404,320 452,292 C520,254 610,240 650,212', v: 22 },
    { n: 4, d: 'M140,195.5 L578,195.5 L600,195.5', v: 34 }
  ];
  const dots = [];
  for (const p of paths) {
    const el = E('path', { d: p.d, class: 'flowline', style: 'stroke-dasharray:3 3;opacity:.6' }, g);
    p.el = el; p.L = el.getTotalLength();
    for (let i = 0; i < 9; i++) dots.push({ p, s: (i / 9) * p.L, e: E('circle', { r: 2.3, class: 'particle' }, g) });
  }
  const tagPos = { 1: [172, 136], 2: [60, 230], 3: [96, 280], 4: [104, 186] };
  for (const k in tagPos) { const [x, y] = tagPos[k]; E('circle', { cx: x, cy: y, r: 9, style: 'fill:var(--sheet);stroke:var(--water);stroke-width:1.6' }, g); T(g, x, y + 4, k, 'lbl', { 'text-anchor': 'middle', style: 'font-weight:500;fill:var(--water)' }); }
  // labels
  T(g, 350, 120, 'Core', 'lbl halo', { 'text-anchor': 'middle' });
  T(g, 250, 180, 'Shell', 'lbl-s halo', { 'text-anchor': 'middle' });
  leader(g, 388, 140, 430, 120); T(g, 434, 118, 'Chimney filter', 'lbl-s halo');
  leader(g, 350, 230, 300, 262); T(g, 298, 268, 'Partial cutoff', 'lbl-s halo', { 'text-anchor': 'end' });
  leader(g, 354, 300, 400, 306); T(g, 404, 310, 'Grout curtain', 'lbl-s halo');
  T(g, 700, 232, 'Alluvium', 'lbl-s halo', { 'text-anchor': 'end' });
  T(g, 700, 334, 'Jointed rock', 'lbl-s halo', { 'text-anchor': 'end' });
  T(g, 129, 112, 'Intake', 'lbl-s halo', { 'text-anchor': 'middle' });
  T(g, 470, 192, 'Outlet conduit', 'lbl-s halo', { 'text-anchor': 'middle' });
  leader(g, 606, 202, 630, 178); T(g, 634, 176, 'Sand boil', 'lbl-s lbl-acc halo');
  leader(g, 548, 200, 590, 150); T(g, 594, 148, 'Toe drain', 'lbl-s halo');
  // plan view
  const pv = $('#svg-plan');
  const q = E('g', null, pv);
  T(q, 10, 18, 'PLAN', 'lbl-s', { style: 'letter-spacing:.1em' });
  E('path', { d: 'M282,14 l0,22 M276,24 l6,-10 l6,10', class: 'ink-s', style: 'stroke-width:1.2' }, q); T(q, 282, 50, 'N', 'lbl-s', { 'text-anchor': 'middle' });
  // contours: valley running top→bottom, centred x=150
  const contour = (k, side) => { const off = 34 + k * 26; const pts = []; for (let y = 0; y <= 340; y += 20) pts.push([150 + side * (off + 6 * Math.sin(y / 50 + k)), y]); return pts; };
  // reservoir: above dam axis, between contour 3s
  const resL = contour(3, -1).filter(p => p[1] <= 150), resR = contour(3, 1).filter(p => p[1] <= 150);
  E('polygon', { class: 'water', points: P(resL.concat(resR.slice().reverse())) }, q);
  for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) E('path', { d: smoothD(contour(k, sd)), style: 'stroke:var(--ink-3);stroke-width:0.8;fill:none' }, q);
  E('path', { d: 'M150,160 L150,340', style: 'stroke:var(--water);stroke-width:2;fill:none' }, q);
  // dam footprint
  E('path', { d: smoothD([[32, 150], [90, 156], [150, 158], [210, 156], [268, 150]]) + ' L268,188 ' + smoothD([[268, 188], [210, 194], [150, 196], [90, 194], [32, 188]]).replace('M', 'L') + ' z', fill: 'url(#p-rock)', class: 'edge' }, q);
  E('path', { d: smoothD([[34, 170], [150, 177], [266, 170]]), style: 'stroke:var(--ink);stroke-width:0.8;stroke-dasharray:6 3;fill:none' }, q);
  T(q, 150, 100, 'Reservoir', 'lbl-s halo', { 'text-anchor': 'middle' });
  T(q, 150, 180, 'Dam', 'lbl-b halo', { 'text-anchor': 'middle' });
  T(q, 158, 300, 'River', 'lbl-s halo');
  T(q, 30, 250, 'Abutment', 'lbl-s halo');
  const ab = [
    { d: 'M78,120 C34,140 10,176 22,206 C30,226 52,236 76,248', v: 18 },
    { d: 'M222,120 C266,140 290,176 278,206 C270,226 248,236 224,248', v: 18 }
  ];
  for (const p of ab) {
    const el = E('path', { d: p.d, class: 'flowline', style: 'stroke-dasharray:3 3;opacity:.6' }, q);
    p.el = el; p.L = el.getTotalLength();
    for (let i = 0; i < 6; i++) dots.push({ p, s: (i / 6) * p.L, e: E('circle', { r: 2.2, class: 'particle' }, q) });
  }
  E('circle', { cx: 56, cy: 124, r: 9, style: 'fill:var(--sheet);stroke:var(--water);stroke-width:1.6' }, q); T(q, 56, 128, '5', 'lbl', { 'text-anchor': 'middle', style: 'font-weight:500;fill:var(--water)' });
  function place() { for (const d of dots) { const pt = d.p.el.getPointAtLength(d.s); d.e.setAttribute('cx', pt.x.toFixed(1)); d.e.setAttribute('cy', pt.y.toFixed(1)); } }
  place();
  F.ticks.push((t, dt) => { if (RM) return; for (const d of dots) { d.s = (d.s + d.p.v * dt) % d.p.L; } place(); });
})();

/* ===================== Fig 6: seepage lab ===================== */
(function figLab() {
  const F = fig($('#fig-lab'));
  const svg = $('#svg-lab');
  const G = { x0: -80, x1: 90, z0: -15, z1: 24 };
  const M = mapper({ x0: G.x0, x1: G.x1, z0: G.z0, z1: G.z1, X0: 10, X1: 990, Y0: 34, Y1: 34 + (G.z1 - G.z0) * (980 / 170) });
  const dam = [[-51, 0], [51, 0], [3, 24], [-3, 24]];
  const wcore = z => 1.5 + 0.4 * (23 - z);
  const defs = E('defs', null, svg);
  const clip = E('clipPath', { id: 'lab-clip' }, defs);
  E('polygon', { points: M.P(dam) }, clip);
  E('rect', { x: M.X(G.x0), y: M.Z(0), width: M.X(G.x1) - M.X(G.x0), height: M.Z(G.z0) - M.Z(0) }, clip);
  const L = () => E('g', null, svg);
  const gRes = L(), gMat = L(), gImg = L(), gEq = L(), gFl = L(), gPh = L(), gMark = L(), gPart = L(), gLbl = L();
  const img = E('image', { x: M.X(G.x0), y: M.Z(G.z1), width: M.X(G.x1) - M.X(G.x0), height: M.Z(G.z0) - M.Z(G.z1), preserveAspectRatio: 'none', 'clip-path': 'url(#lab-clip)', opacity: 0.82 }, gImg);
  const state = { damType: 'homogeneous', drain: 'none', cutoff: 'none', foundation: 'pervious', reservoir: 0.85 };
  const segs = {
    damType: segGroup($('#lab-dam'), v => { state.damType = v; request(); }),
    drain: segGroup($('#lab-drain'), v => { state.drain = v; request(); }),
    cutoff: segGroup($('#lab-cut'), v => { state.cutoff = v; request(); }),
    foundation: segGroup($('#lab-found'), v => { state.foundation = v; request(); })
  };
  void segs;
  const resEl = $('#lab-res');
  resEl.addEventListener('input', () => { state.reservoir = +resEl.value / 100; $('#lab-res-o').textContent = n1(state.reservoir * 24) + ' m'; request(); });
  const statusEl = $('#lab-status');

  function drawMaterials() {
    gRes.textContent = ''; gMat.textContent = ''; gLbl.textContent = '';
    const Hw = state.reservoir * 24;
    const xu = z => -51 + 2 * z;
    E('polygon', { class: 'water', points: M.P([[G.x0, Hw], [xu(Hw), Hw], [-51, 0], [G.x0, 0]]) }, gRes);
    E('path', { class: 'water-line', d: M.D([[G.x0, Hw], [xu(Hw), Hw]]) }, gRes);
    waterSymbol(gRes, M.X(-70), M.Z(Hw));
    E('path', { class: 'water-line', d: M.D([[51, 0], [G.x1, 0]]), style: 'stroke-dasharray:4 3' }, gRes);
    E('rect', { x: M.X(G.x0), y: M.Z(0), width: M.X(G.x1) - M.X(G.x0), height: M.Z(G.z0) - M.Z(0), fill: state.foundation === 'pervious' ? 'url(#p-alluv)' : 'url(#p-clay)', class: 'edge' }, gMat);
    if (state.damType === 'homogeneous') E('polygon', { points: M.P(dam), fill: 'url(#p-fill)', class: 'edge' }, gMat);
    else {
      E('polygon', { points: M.P(dam), fill: 'url(#p-rock)', class: 'edge' }, gMat);
      E('polygon', { points: M.P([[-wcore(0), 0], [wcore(0), 0], [1.5, 23], [-1.5, 23]]), fill: 'url(#p-clay)', class: 'edge-l' }, gMat);
    }
    const drains = [];
    if (state.drain === 'toe') drains.push(clipConvex(band(() => 39, () => 400, 0, 4), dam));
    if (state.drain === 'chimney') {
      const cl = state.damType === 'homogeneous' ? (() => 4) : wcore, cr = state.damType === 'homogeneous' ? (() => 6) : (z => wcore(z) + 2);
      drains.push(clipConvex(band(cl, cr, 0, 20), dam));
      drains.push(clipConvex(band(() => cl(0), () => 400, 0, 2), dam));
    }
    drains.forEach(d => E('polygon', { points: M.P(d), fill: 'url(#p-drain)', class: 'edge-l' }, gMat));
    if (state.cutoff !== 'none') {
      const zb = state.cutoff === 'full' ? -15 : -7.5;
      E('rect', { x: M.X(-1), y: M.Z(0), width: M.X(1) - M.X(-1), height: M.Z(zb) - M.Z(0), class: 'ink' }, gMat);
      T(gLbl, M.X(1) + 6, M.Z(zb) + (state.cutoff === 'full' ? -6 : 12), 'Cutoff wall', 'lbl-s halo');
    }
    T(gLbl, M.X(-77), M.Z(-13), state.foundation === 'pervious' ? 'Sand & gravel · k = 10⁻⁵ m/s' : 'Clay · k = 5×10⁻⁸ m/s', 'lbl-s halo');
    T(gLbl, M.X(G.x1) - 4, M.Z(0) - 6, 'Tailwater at ground', 'lbl-s halo', { 'text-anchor': 'end' });
    T(gLbl, M.X(-62), M.Z(Hw) + 16, 'Reservoir', 'lbl-s halo', { 'text-anchor': 'middle' });
    const kd = state.damType === 'homogeneous' ? 'Fill · k = 10⁻⁷ m/s' : 'Core 10⁻⁹ · rockfill 10⁻⁴ m/s';
    T(gLbl, M.X(0), M.Z(24) - 8, kd, 'lbl-s halo', { 'text-anchor': 'middle' });
  }

  // ---- worker ----
  let worker = null, reqId = 0, pending = null, last = null;
  const cache = new Map();
  try {
    const src = $('#seep-src').textContent;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = e => {
      if (e.data.id !== reqId) return;
      if (!e.data.result) { statusEl.textContent = 'The solver hit an error on this case.'; console.error(e.data.error); return; }
      const r = e.data.result; cache.set(keyOf(r.params || pending), r); receive(r);
    };
    worker.onerror = () => { worker = null; request(); };
  } catch (err) { worker = null; }
  const keyOf = p => [p.damType, p.drain, p.cutoff, p.foundation, (+p.reservoir).toFixed(2)].join('|');
  let timer = 0;
  function request() {
    drawMaterials();
    const p = Object.assign({}, state);
    const k = keyOf(p);
    if (cache.has(k)) { receive(cache.get(k)); return; }
    statusEl.textContent = 'Solving…';
    clearTimeout(timer);
    timer = setTimeout(() => {
      pending = p; reqId++;
      if (worker) worker.postMessage({ id: reqId, params: p });
      else if (window.SeepageSolver) { const r = window.SeepageSolver.solveSeepage(p); cache.set(k, r); receive(r); }
      else statusEl.textContent = 'Solver unavailable in this browser.';
    }, 60);
  }

  // ---- rendering a result ----
  const cvs = document.createElement('canvas');
  let flows = [];
  function ramp(t, lo, hi) { return [lerp(lo[0], hi[0], t), lerp(lo[1], hi[1], t), lerp(lo[2], hi[2], t)]; }
  function paintField(r) {
    const SC = 4, nx = r.nx, nz = r.nz;
    cvs.width = nx * SC; cvs.height = nz * SC;
    const c2 = cvs.getContext('2d'), im = c2.createImageData(cvs.width, cvs.height);
    const lo = rgba(cssVar('--ramp-lo')), hi = rgba(cssVar('--ramp-hi'));
    const hAt = (i, j) => { i = clamp(i, 0, nx - 1); j = clamp(j, 0, nz - 1); return r.h[i * nz + j]; };
    for (let py = 0; py < cvs.height; py++) {
      const zc = (nz - (py + 0.5) / SC) - 0.5; // cell-centre index space
      for (let px = 0; px < cvs.width; px++) {
        const xc = (px + 0.5) / SC - 0.5;
        const i0 = Math.floor(xc), j0 = Math.floor(zc), fx = xc - i0, fz = zc - j0;
        let s = 0, w = 0;
        const acc = (i, j, wt) => { const v = hAt(i, j); if (v === v && wt > 0) { s += v * wt; w += wt; } };
        acc(i0, j0, (1 - fx) * (1 - fz)); acc(i0 + 1, j0, fx * (1 - fz)); acc(i0, j0 + 1, (1 - fx) * fz); acc(i0 + 1, j0 + 1, fx * fz);
        const o = (py * cvs.width + px) * 4;
        if (w < 0.2) { im.data[o + 3] = 0; continue; }
        const h = s / w;
        const zWorld = r.z0 + (zc + 0.5) * r.dx;
        const ci = clamp(Math.round(xc), 0, nx - 1), cj = clamp(Math.round(zc), 0, nz - 1), ty = r.type[ci * nz + cj];
        if (h - zWorld < -0.02 || ty === 3) { im.data[o + 3] = 0; continue; }
        const col = ramp(clamp(h / r.Hw, 0, 1), lo, hi);
        im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = 235;
      }
    }
    c2.putImageData(im, 0, 0);
    img.setAttribute('href', cvs.toDataURL());
  }
  function fmtQ(q) { // m3/s per m -> L/day per m
    const L = q * 86400 * 1000;
    if (L >= 100) return fmt(L, 0);
    if (L >= 1) return L.toFixed(1);
    if (L >= 0.01) return L.toFixed(2);
    return L.toExponential(1);
  }
  function receive(r) {
    if (keyOf(r.params || state) !== keyOf(state)) return;
    last = r;
    statusEl.textContent = r.stats ? `Solved in ${Math.round(r.stats.ms)} ms · ${r.stats.iterations} iterations` : '';
    paintField(r);
    gEq.textContent = ''; gFl.textContent = ''; gPh.textContent = ''; gMark.textContent = '';
    for (const eq of r.equipotentials || []) {
      for (const ln of eq.lines) {
        if (ln.length < 2) continue;
        E('path', { d: D(ln.map(M.pt)), class: 'equip' }, gEq);
      }
      const longest = eq.lines.slice().sort((a, b) => b.length - a.length)[0];
      if (longest && longest.length > 6 && (Math.round(eq.frac * 10) % 2 === 1)) {
        const mid = longest[Math.floor(longest.length / 2)];
        const [mx, my] = M.pt(mid);
        T(gEq, mx + 3, my - 3, Math.round(eq.frac * 100) + '%', 'lbl-s halo');
      }
    }
    flows = [];
    const all = (r.flowlines || []).filter(f => f.pts && f.pts.length > 1);
    const speeds = []; all.forEach(f => f.pts.forEach(p => { if (p[3] > 0) speeds.push(p[3]); }));
    speeds.sort((a, b) => a - b);
    const vref = speeds.length ? speeds[Math.floor(speeds.length / 2)] : 1e-6;
    for (const f of all) {
      E('path', { d: D(f.pts.map(M.pt)), class: 'flowline' }, gFl);
      const tau = [0];
      for (let i = 1; i < f.pts.length; i++) {
        const a = f.pts[i - 1], b = f.pts[i];
        const ds = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const v = Math.max(1e-12, (a[3] + b[3]) / 2);
        const vd = clamp(5 * Math.pow(v / vref, 0.33), 0.9, 30);
        tau.push(tau[i - 1] + ds / vd);
      }
      flows.push({ pts: f.pts, tau, T: tau[tau.length - 1], parts: [0, 1, 2, 3] });
    }
    gPart.textContent = '';
    flows.forEach(fl => { fl.parts = fl.parts.map(() => E('circle', { r: 2.1, class: 'particle' }, gPart)); });
    // phreatic
    if (r.phreatic && r.phreatic.length > 1) {
      E('path', { d: D(r.phreatic.map(M.pt)), class: 'phreatic', style: 'stroke-width:2.4' }, gPh);
      const mid = r.phreatic[Math.floor(r.phreatic.length * 0.42)];
      const [mx, my] = M.pt(mid);
      T(gPh, mx, my - 7, 'Phreatic surface', 'lbl-s lbl-w halo', { 'text-anchor': 'middle' });
    }
    // seepage face
    const sf = r.seepageFace;
    if (sf && sf.present && sf.topZ > 0.3) {
      const a = [51 - 2 * Math.max(0, sf.bottomZ), Math.max(0, sf.bottomZ)], b = [51 - 2 * sf.topZ, sf.topZ];
      E('path', { d: M.D([a, b]), style: 'stroke:var(--accent);stroke-width:5;stroke-linecap:round;fill:none;opacity:.9' }, gMark);
      const [bx, by] = M.pt(b);
      leader(gMark, bx + 4, by - 2, bx + 30, by - 26); T(gMark, bx + 32, by - 28, 'Seepage face: wet slope', 'lbl-s lbl-acc halo');
    }
    // exit gradient marker
    const ex = r.exit;
    if (ex && isFinite(ex.fs) && Math.max(ex.groundMax || 0, ex.faceMax || 0) > 0.02) {
      const gx = ex.governing === 'face' ? ex.faceX : ex.groundX, gz = ex.governing === 'face' ? ex.faceZ : 0;
      const [px, py] = M.pt([gx, gz]);
      const imax = Math.max(ex.groundMax || 0, ex.faceMax || 0);
      const col = ex.fs >= 3 ? 'var(--ok)' : ex.fs >= 1.5 ? 'var(--warn)' : 'var(--bad)';
      flows.pulse = E('circle', { cx: px, cy: py, r: 7, style: `fill:none;stroke:${col};stroke-width:2` }, gMark);
      E('circle', { cx: px, cy: py, r: 2.5, style: `fill:${col}` }, gMark);
      T(gMark, px + 10, py + 16, 'max exit i = ' + imax.toFixed(2), 'lbl-s halo', { style: `fill:${col}` });
    }
    // readouts
    const q = r.q || {};
    const tot = q.inflowTotal || 0;
    $('#lab-q').textContent = fmtQ(tot) + ' L/day';
    $('#lab-q2').textContent = 'per metre of dam · ' + fmtQ(tot) + ' m³/day per km';
    const outs = [['Drains', q.outDrain || 0], ['Ground', q.outTailwater || 0], ['Slope face', q.outSeepageFace || 0]];
    const osum = outs.reduce((a, o) => a + o[1], 0) || 1;
    outs.sort((a, b) => b[1] - a[1]);
    $('#lab-split').textContent = outs[0][0] + ' ' + Math.round(100 * outs[0][1] / osum) + '%';
    $('#lab-split2').textContent = outs.slice(1).map(o => o[0].toLowerCase() + ' ' + Math.round(100 * o[1] / osum) + '%').join(' · ');
    const imax = ex ? Math.max(ex.groundMax || 0, ex.faceMax || 0) : 0;
    $('#lab-i').textContent = imax > 0.005 ? imax.toFixed(2) : '≈ 0';
    $('#lab-i2').textContent = ex && imax > 0.005 ? (ex.governing === 'face' ? 'on the downstream slope' : 'at the ground beyond the toe') : 'all exits are filtered drains';
    const fs = ex && isFinite(ex.fs) ? ex.fs : Infinity;
    const fsEl = $('#lab-fs');
    if (!isFinite(fs) || fs > 50) { fsEl.innerHTML = '> 50 <span class="pill ok">Safe</span>'; }
    else {
      const cls = fs >= 3 ? 'ok' : fs >= 1.5 ? 'warn' : 'bad', word = fs >= 3 ? 'Adequate' : fs >= 1.5 ? 'Marginal' : 'Piping risk';
      fsEl.innerHTML = fs.toFixed(1) + ` <span class="pill ${cls}">${word}</span>`;
    }
    if (sf && sf.present && sf.topZ > 0.3) { $('#lab-ph').textContent = 'Breaks out'; $('#lab-ph2').textContent = 'on the downstream slope up to ' + n1(sf.topZ) + ' m'; }
    else { $('#lab-ph').textContent = 'Contained'; $('#lab-ph2').textContent = state.drain === 'none' ? 'exits at the toe' : 'captured by the drain'; }
  }
  function placeParticles(time) {
    for (const fl of flows) {
      if (!fl.T) continue;
      fl.parts.forEach((c, k) => {
        const tt = ((time + k * fl.T / fl.parts.length) % fl.T + fl.T) % fl.T;
        let i = 1; while (i < fl.tau.length - 1 && fl.tau[i] < tt) i++;
        const a = fl.pts[i - 1], b = fl.pts[i], u = (tt - fl.tau[i - 1]) / ((fl.tau[i] - fl.tau[i - 1]) || 1);
        c.setAttribute('cx', M.X(lerp(a[0], b[0], u)).toFixed(1)); c.setAttribute('cy', M.Z(lerp(a[1], b[1], u)).toFixed(1));
      });
    }
  }
  onTheme(() => { if (last) paintField(last); });
  F.ticks.push(t => {
    if (RM) return;
    placeParticles(t);
    if (flows.pulse) flows.pulse.setAttribute('r', (7 + 3 * Math.sin(t * 4)).toFixed(1));
  });
  request();
  if (RM) setTimeout(() => placeParticles(1.3), 1500);
  // precompute neighbours of the default in the background
  setTimeout(() => {
    if (!worker) return;
    const pre = [{ drain: 'chimney' }, { cutoff: 'full' }, { drain: 'toe' }, { damType: 'cored' }];
    const bg = new Worker(URL.createObjectURL(new Blob([$('#seep-src').textContent], { type: 'text/javascript' })));
    let i = 0;
    const next = () => { if (i >= pre.length) { bg.terminate(); return; } const p = Object.assign({}, state, pre[i++]); if (cache.has(keyOf(p))) return next(); bg.postMessage({ id: -i, params: p }); };
    bg.onmessage = e => { const r = e.data.result; if (r) cache.set(keyOf(r.params), r); next(); };
    next();
  }, 2500);
})();

/* ===================== Fig 7: piping ===================== */
(function figPipe() {
  const F = fig($('#fig-pipe'));
  const svg = $('#svg-pipe');
  const g = E('g', null, svg);
  const GY = 220;
  const resG = E('g', null, g);
  const resPoly = E('polygon', { class: 'water' }, resG);
  const resLine = E('path', { class: 'water-line' }, resG);
  E('polygon', { points: P([[0, GY], [1000, GY], [1000, 300], [0, 300]]), fill: 'url(#p-alluv)', class: 'edge' }, g);
  E('polygon', { points: P([[0, 300], [1000, 300], [1000, 330], [0, 330]]), fill: 'url(#p-bedrock)', class: 'edge' }, g);
  T(g, 990, 292, 'Sand foundation', 'lbl-s halo', { 'text-anchor': 'end' });
  const floodPoly = E('polygon', { class: 'water', opacity: 0 }, g);
  const damPoly = E('polygon', { fill: 'url(#p-fill)', class: 'edge' }, g);
  const pipeG = E('g', null, g);
  const pipe = E('path', { style: 'fill:var(--ink);opacity:.85' }, pipeG);
  const pipeWater = E('path', { style: 'fill:none;stroke:var(--water);stroke-width:2;stroke-dasharray:4 5' }, pipeG);
  const cone = E('path', { style: 'fill:var(--m-alluv);stroke:var(--ink);stroke-width:1' }, g);
  const filterG = E('g', null, g);
  E('polygon', { points: P([[690, GY], [820, GY], [820, GY - 7], [690, GY - 7]]), fill: 'url(#p-filter)', class: 'edge-l' }, filterG);
  E('polygon', { points: P([[694, GY - 7], [816, GY - 7], [800, GY - 22], [712, GY - 22]]), fill: 'url(#p-rock)', class: 'edge-l' }, filterG);
  T(filterG, 755, GY - 30, 'Filter + berm', 'lbl-s halo', { 'text-anchor': 'middle' });
  const flowG = E('g', null, g);
  const flowPaths = ['M120,224 C280,262 600,268 742,222', 'M160,224 C300,250 560,252 730,222', 'M60,226 C260,290 640,292 760,222', 'M200,223 C330,238 540,240 720,222'];
  const fls = flowPaths.map(d => { const e = E('path', { d, class: 'flowline', style: 'stroke-dasharray:3 4' }, flowG); return { e, L: e.getTotalLength() }; });
  const wdots = [], sdots = [];
  fls.forEach(f => { for (let i = 0; i < 6; i++) wdots.push({ f, s: rnd() * f.L, e: E('circle', { r: 2.2, class: 'particle' }, g) }); });
  for (let i = 0; i < 26; i++) sdots.push({ e: E('circle', { r: 1.8, style: 'fill:var(--m-trans);stroke:var(--ink);stroke-width:.6' }, g), u: rnd(), vy: 0, x: 0, y: 0, a: 0 });
  const labG = E('g', null, g);
  T(labG, 80, 90, 'Reservoir', 'lbl-s halo');
  T(labG, 455, 150, 'Embankment', 'lbl-b halo', { 'text-anchor': 'middle' });
  const exitLbl = T(labG, 742, 250, '', 'lbl-s lbl-acc halo', { 'text-anchor': 'middle' });
  const tipLbl = T(labG, 0, 0, '', 'lbl-s lbl-acc halo', { 'text-anchor': 'middle' });
  const filt = segGroup($('#pp-filter'), v => { hasFilter = v === '1'; filterG.style.display = hasFilter ? '' : 'none'; render(player.t); });
  void filt;
  let hasFilter = false; filterG.style.display = 'none';
  const intact = [[230, GY], [330, 155], [430, 90], [455, 90], [480, 90], [590, 155], [700, GY]];
  const sag = [[230, GY], [330, 155], [430, 92], [455, 120], [480, 92], [590, 155], [700, GY]];
  const breach = [[230, GY], [330, 155], [392, 122], [455, GY - 2], [518, 122], [590, 155], [700, GY]];
  const names = ['1 · Steady seepage under the dam', '2 · Sand boil: the exit gradient lifts the sand', '3 · A pipe erodes backward under the dam', '4 · The pipe reaches the reservoir; flow and erosion accelerate', '5 · The pipe enlarges until the roof collapses', '6 · Breach'];
  let speed = 1, vis = {};
  function render(t) {
    const p = hasFilter ? Math.min(t, 1) : t;
    const boil = hasFilter ? 0 : clamp(p - 1, 0, 1);
    const grow = clamp(p - 2, 0, 1);
    const enl = clamp(p - 3, 0, 1);
    const col = clamp((p - 4) / 0.6, 0, 1), br = clamp((p - 4.55) / 0.45, 0, 1);
    // dam shape
    const shape = intact.map((q, i) => { const a = [lerp(q[0], sag[i][0], col), lerp(q[1], sag[i][1], col)]; return [lerp(a[0], breach[i][0], ease(br)), lerp(a[1], breach[i][1], ease(br))]; });
    damPoly.setAttribute('points', P(shape));
    // reservoir level
    const lvl = lerp(105, 182, ease(br));
    const xu = y => 230 + (GY - y) * (100 / 65);
    resPoly.setAttribute('points', P([[0, lvl], [xu(lvl), lvl], [230, GY], [0, GY]]));
    resLine.setAttribute('d', `M0,${lvl} L${xu(lvl)},${lvl}`);
    // flood downstream
    floodPoly.setAttribute('opacity', br > 0 ? 1 : 0);
    floodPoly.setAttribute('points', P([[520, GY], [520 + 470 * ease(br), GY], [520 + 380 * ease(br), GY - 10 * br], [560, GY - 30 * br]]));
    // pipe
    const tip = lerp(742, 232, ease(grow));
    const th = grow > 0 ? lerp(3, 7, grow) + 16 * ease(enl) : 0;
    if (grow > 0) {
      const top = GY + 1 - th * 0.75, bot = GY + 1 + th * 0.25;
      let d = `M${tip},${GY + 1}`;
      for (let x = tip; x <= 742; x += 18) d += ` L${x.toFixed(1)},${(top + Math.sin(x / 9) * 0.8).toFixed(1)}`;
      d += ` L742,${GY - 1} L742,${bot}`;
      for (let x = 742; x >= tip; x -= 18) d += ` L${x.toFixed(1)},${(bot + Math.cos(x / 7) * 0.8).toFixed(1)}`;
      pipe.setAttribute('d', d + 'z');
      pipeWater.setAttribute('d', `M${tip},${GY + 1 - th * 0.25} L742,${GY + 1 - th * 0.25}`);
      pipeWater.style.strokeWidth = (1.2 + th * 0.12).toFixed(1);
    } else { pipe.setAttribute('d', ''); pipeWater.setAttribute('d', ''); }
    pipeG.style.opacity = br > 0.6 ? 0 : 1;
    // boil cone
    const ch = 10 * boil + 6 * enl;
    cone.setAttribute('d', ch > 0.1 ? `M${742 - 14 - ch},${GY} Q742,${GY - ch * 1.6} ${742 + 14 + ch},${GY} z` : '');
    exitLbl.textContent = hasFilter ? 'Clear water out; no sand moves' : boil > 0.2 ? (grow > 0 ? 'Sand carried out' : 'Sand boil') : '';
    exitLbl.setAttribute('y', hasFilter ? GY + 22 : GY + 22);
    if (grow > 0 && grow < 1) { tipLbl.textContent = 'pipe tip'; tipLbl.setAttribute('x', tip); tipLbl.setAttribute('y', GY + 24); } else tipLbl.textContent = '';
    speed = 1 + 3 * enl + 2 * grow;
    vis = { p, boil, grow, enl, br, tip, th };
    $('#pp-stage').textContent = hasFilter ? (t >= 1 ? 'Filter holds: clear seepage, no erosion' : names[0]) : names[Math.min(5, Math.floor(p + 1e-6))];
    flowG.style.opacity = br > 0.3 ? 0 : 1;
  }
  const player = Player({ max: 5, dur: 16, btn: $('#pp-play'), slider: $('#pp-t'), onUpdate: render, cap: () => (hasFilter ? 1.6 : 5) });
  render(0);
  F.onFirst = () => { if (!RM) player.play(); };
  function placeDots(dt) {
    const v = vis;
    wdots.forEach(d => {
      d.s = (d.s + 40 * speed * dt) % d.f.L;
      const pt = d.f.e.getPointAtLength(d.s);
      d.e.setAttribute('cx', pt.x.toFixed(1)); d.e.setAttribute('cy', pt.y.toFixed(1));
      d.e.style.opacity = v.br > 0.3 ? 0 : 1;
    });
    sdots.forEach(sd => {
      const show = !hasFilter && v.boil > 0.15 && v.br < 0.6;
      if (!show) { sd.e.style.opacity = 0; return; }
      sd.u += dt * (0.5 + 1.5 * (v.grow > 0 ? 1 : 0) + 2 * v.enl);
      if (sd.u >= 1) { sd.u -= 1; sd.a = (rnd() - 0.5) * 1.4; }
      let x, y;
      if (v.grow > 0 && sd.u < 0.6) { const f = sd.u / 0.6; x = lerp(v.tip, 742, f); y = GY + 1 - v.th * 0.3 + Math.sin(sd.u * 40) * 0.6; }
      else { const f = v.grow > 0 ? (sd.u - 0.6) / 0.4 : sd.u; x = 742 + sd.a * 30 * f; y = GY - 2 - 34 * f * (1 - f) * 2 * (0.6 + v.boil * 0.4); }
      sd.e.setAttribute('cx', x.toFixed(1)); sd.e.setAttribute('cy', y.toFixed(1)); sd.e.style.opacity = 1;
    });
  }
  placeDots(0.016);
  F.ticks.push((t, dt) => { player.tick(dt); if (!RM) placeDots(dt); });
})();

/* ===================== Fig 8: uplift ===================== */
(function figUplift() {
  const F = fig($('#fig-uplift'));
  const svg = $('#svg-uplift');
  const M = uniformMapper(-110, 160, -38, 68, 1000, 20, 10, 380);
  svg.setAttribute('viewBox', `0 0 1000 ${Math.round(M.H)}`);
  const g = E('g', null, svg);
  const B = 48, TW = 5, XD = 6, gw = 9.81, gc = 23.5;
  const damPts = [[0, 0], [0, 60], [8, 60], [8, 50], [48, 0]];
  const W = gc * polyArea(damPts);
  const xW = (480 * 4 + 1000 * (8 + 40 / 3)) / 1480;
  const res = E('g', null, g);
  E('polygon', { points: M.P([[-110, 0], [160, 0], [160, -38], [-110, -38]]), fill: 'url(#p-bedrock)', class: 'edge' }, g);
  E('polygon', { class: 'water', points: M.P([[44, TW], [160, TW], [160, 0], [48, 0]]) }, g);
  E('path', { class: 'water-line', d: M.D([[44, TW], [160, TW]]) }, g);
  waterSymbol(g, M.X(120), M.Z(TW));
  const upl = E('g', null, g);
  E('polygon', { points: M.P(damPts), fill: 'url(#p-conc)', class: 'edge' }, g);
  E('polygon', { points: M.P([[5, 3.5], [8.5, 3.5], [8.5, 7.5], [5, 7.5]]), class: 'void' }, g);
  E('polygon', { points: M.P([[4.6, 3.5], [6.0, 3.5], [-1.6, -30], [-3.2, -30]]), fill: 'url(#p-grout)' }, g);
  const drainLine = E('path', { d: M.D([[7.3, 3.5], [7.3, -22]]), style: 'stroke-width:2.2;fill:none' }, g);
  const drainX = E('path', { style: 'stroke:var(--bad);stroke-width:2;fill:none' }, g);
  const forces = E('g', null, g);
  const lbls = E('g', null, g);
  T(lbls, M.X(-100), M.Z(-33), 'Rock foundation', 'lbl-s halo');
  leader(lbls, M.X(-2.5), M.Z(-24), M.X(-22), M.Z(-24)); T(lbls, M.X(-23), M.Z(-24) + 4, 'Grout curtain', 'lbl-s halo', { 'text-anchor': 'end' });
  const drainLbl = T(lbls, M.X(9), M.Z(-31), 'Drains', 'lbl-s halo');
  const hwEl = $('#up-hw');
  let drains = true, HW = 57, uDrain = TW + (HW - TW) / 3, shownUD = uDrain, anim = null;
  segGroup($('#up-drains'), v => { drains = v === '1'; go(); });
  hwEl.addEventListener('input', () => { HW = +hwEl.value; $('#up-hw-o').textContent = HW.toFixed(1) + ' m'; go(true); });
  function target() { return drains ? TW + (HW - TW) / 3 : TW + (HW - TW) * (1 - XD / B); }
  function go(instant) {
    const to = target();
    if (instant || RM) { shownUD = to; anim = null; draw(); }
    else anim = { from: shownUD, to, t: 0 };
  }
  function calc(ud) {
    const prof = [[0, HW], [XD, ud], [B, TW]];
    let U = 0, MU_toe = 0;
    for (let i = 0; i < 2; i++) {
      const [x1, h1] = prof[i], [x2, h2] = prof[i + 1], L = x2 - x1;
      const f = gw * (h1 + h2) / 2 * L;
      const xc = x1 + (L / 3) * (h1 + 2 * h2) / (h1 + h2);
      U += f; MU_toe += f * (B - xc);
    }
    const Hup = 0.5 * gw * HW * HW, Htw = 0.5 * gw * TW * TW, H = Hup - Htw;
    const FS = (W - U) * 1.0 / H;
    const Mnet = W * (B - xW) + Htw * TW / 3 - Hup * HW / 3 - MU_toe;
    const V = W - U, xR = B - Mnet / V;
    return { U, H, FS, xR, Hup, prof };
  }
  function draw() {
    const c = calc(shownUD);
    res.textContent = ''; upl.textContent = ''; forces.textContent = '';
    E('polygon', { class: 'water', points: M.P([[-110, HW], [0, HW], [0, 0], [-110, 0]]) }, res);
    E('path', { class: 'water-line', d: M.D([[-110, HW], [0, HW]]) }, res);
    waterSymbol(res, M.X(-90), M.Z(HW));
    // water pressure triangle on the face
    const kp = 0.42;
    E('polygon', { points: M.P([[0, HW], [0, 0], [-kp * HW, 0]]), style: 'fill:var(--accent-soft);stroke:var(--accent);stroke-width:1' }, res);
    for (let z = HW - 8; z > 1; z -= 8) { const len = kp * (HW - z); if (len < 2.5) continue; E('path', { d: M.D([[-len, z], [-0.6, z]]), style: 'stroke:var(--accent);stroke-width:1;fill:none', 'marker-end': 'url(#arr-acc)' }, res); }
    T(res, M.X(-kp * HW) - 4, M.Z(4), 'ρgh = ' + Math.round(gw * HW) + ' kPa', 'lbl-s lbl-acc halo', { 'text-anchor': 'end' });
    // uplift diagram under the base (head in m scaled)
    const ku = 0.5;
    const uplPts = M.P([[0, 0], [0, -ku * HW], [XD, -ku * shownUD], [B, -ku * TW], [B, 0]]);
    E('polygon', { points: uplPts, style: 'fill:var(--sheet);opacity:.85' }, upl);
    E('polygon', { points: uplPts, style: 'fill:var(--accent-soft);stroke:var(--accent);stroke-width:1.2' }, upl);
    for (let x = 2; x < B; x += 4) {
      const hd = x <= XD ? lerp(HW, shownUD, x / XD) : lerp(shownUD, TW, (x - XD) / (B - XD));
      if (hd * ku < 1.6) continue;
      E('path', { d: M.D([[x, -ku * hd], [x, -0.4]]), style: 'stroke:var(--accent);stroke-width:1;fill:none', 'marker-end': 'url(#arr-acc)' }, upl);
    }
    T(upl, M.X(0) - 4, M.Z(-ku * HW) + 4, Math.round(HW) + ' m', 'lbl-s lbl-acc halo', { 'text-anchor': 'end' });
    if (drains || anim) T(upl, M.X(XD) + 5, M.Z(-ku * shownUD) + 13, n1(shownUD) + ' m', 'lbl-s lbl-acc halo');
    T(upl, M.X(B) + 4, M.Z(-ku * TW) + 4, TW + ' m', 'lbl-s lbl-acc halo');
    leader(upl, M.X(44), M.Z(-1.5), M.X(58), M.Z(-9));
    T(upl, M.X(58) + 3, M.Z(-9) + 4, 'Uplift pressure, in metres of head', 'lbl-s lbl-acc halo');
    // forces (MN per m, scaled)
    const kf = 0.75;
    const arrow = (x1, z1, x2, z2, cls) => E('path', { d: M.D([[x1, z1], [x2, z2]]), style: `stroke:${cls};stroke-width:3;fill:none`, 'marker-end': cls === 'var(--accent)' ? 'url(#arr-acc)' : 'url(#arr)' }, forces);
    const Wl = kf * W / 1000, Hl = kf * c.H / 1000, Ul = kf * c.U / 1000;
    arrow(xW, 34, xW, 34 - Wl, 'var(--ink)');
    T(forces, M.X(xW) + 8, M.Z(34 - Wl / 2), 'W ' + n1(W / 1000) + ' MN', 'lbl halo');
    arrow(-Hl - 4, HW / 3, -1.2, HW / 3, 'var(--ink)');
    T(forces, M.X(-Hl - 4), M.Z(HW / 3) - 9, 'H ' + n1(c.H / 1000) + ' MN', 'lbl halo');
    // middle third + resultant
    E('path', { d: M.D([[16, 1.4], [32, 1.4]]), style: 'stroke:var(--ink);stroke-width:1;fill:none', 'marker-start': 'url(#arr)', 'marker-end': 'url(#arr)' }, forces);
    T(forces, M.X(24), M.Z(1.4) - 6, 'middle third', 'lbl-s halo', { 'text-anchor': 'middle' });
    const inMid = c.xR >= 16 && c.xR <= 32;
    const [rx, ry] = M.pt([clamp(c.xR, -5, 60), 0]);
    E('path', { d: `M${rx},${ry} l-6,10 h12 z`, style: `fill:${inMid ? 'var(--ok)' : 'var(--bad)'}` }, forces);
    // U arrow pushing up on the base
    const xa = 30, ha = lerp(shownUD, TW, (xa - XD) / (B - XD));
    arrow(xa, -ku * ha - Ul - 1, xa, -0.5, 'var(--accent)');
    T(forces, M.X(xa) + 7, M.Z(-ku * ha - Ul - 1) + 4, 'U ' + n1(c.U / 1000) + ' MN', 'lbl lbl-acc halo');
    // drains style
    drainLine.style.stroke = drains ? 'var(--water)' : 'var(--ink-3)';
    drainLine.style.strokeDasharray = drains ? '4 3' : '2 3';
    const [dx, dy] = M.pt([7.3, -12]);
    drainX.setAttribute('d', drains ? '' : `M${dx - 6},${dy - 6} l12,12 M${dx + 6},${dy - 6} l-12,12`);
    drainLbl.textContent = drains ? 'Drains' : 'Drains clogged';
    // readouts
    $('#up-W').textContent = n1(W / 1000) + ' MN/m';
    $('#up-H').textContent = n1(c.H / 1000) + ' MN/m';
    $('#up-U').textContent = n1(c.U / 1000) + ' MN/m';
    $('#up-U2').textContent = Math.round(100 * c.U / W) + '% of the weight';
    const fsCls = c.FS >= 1.5 ? 'ok' : c.FS >= 1 ? 'warn' : 'bad', fsW = c.FS >= 1.5 ? 'Meets 1.5' : c.FS >= 1 ? 'Below 1.5' : 'Slides';
    $('#up-FS').innerHTML = c.FS.toFixed(2) + ` <span class="pill ${fsCls}">${fsW}</span>`;
    $('#up-R').innerHTML = (c.xR / B).toFixed(2) + ' B ' + `<span class="pill ${inMid ? 'ok' : 'bad'}">${inMid ? 'Middle third' : 'Heel in tension'}</span>`;
    $('#up-R2').textContent = 'from the heel; middle third is 0.33–0.67 B';
  }
  go(true);
  F.ticks.push((t, dt) => {
    if (!anim) return;
    anim.t = Math.min(1, anim.t + dt / 0.8);
    shownUD = lerp(anim.from, anim.to, ease(anim.t));
    draw();
    if (anim.t >= 1) anim = null;
  });
})();
