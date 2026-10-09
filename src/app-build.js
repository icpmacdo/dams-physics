/* ===================== Step 9: build your own dam ===================== */
/* The reader paints the dam's zones cell by cell (1 m grid of the seepage solver), picks the
   foundation, cutoff, downstream slope and reservoir, and presses Test. A worker runs the seepage
   solver in custom mode and then the slope stability solver (stability-solver.js) on its pore
   pressures. Missions are defined in StabilitySolver.BUILD.missions (checked in tests). */
(function figBuild() {
  const root = $('#fig-build');
  if (!root) return;
  const F = fig(root);
  const API = window.StabilitySolver;
  const statusEl = $('#bd-status');
  if (!API || !API.BUILD) { statusEl.textContent = 'The stability solver did not load, so this figure cannot run.'; return; }
  const B = API.BUILD;
  const NX = 170, NZ = 39, GX0 = -80, GZ0 = -15, NC = NX * NZ;
  const CREST = 24, UPTOE = -51;
  const MAT = [
    { key: 'fill', name: 'General fill', pat: 'p-fill', note: 'Compacted earth. Passes water slowly and has a little stickiness (cohesion).' },
    { key: 'clay', name: 'Clay core', pat: 'p-clay', note: 'Almost watertight, so it holds back the head. Weaker than the other materials.' },
    { key: 'rock', name: 'Rockfill shell', pat: 'p-rock', note: 'Heavy, strong and coarse. Water runs straight through it.' },
    { key: 'filter', name: 'Sand filter / drain', pat: 'p-drain', note: 'Lets water out but holds soil back. A patch joined to the toe at the base of the dam drains freely.' },
    { key: 'tsand', name: 'Cycloned tailings sand', pat: 'p-cyclone', note: 'The coarse part of mine waste, so it is free. No cohesion, and it drains only moderately.' }
  ];
  MAT.forEach((m, i) => Object.assign(m, B.materials[i]));
  const FOUND = { gravel: 'Sand & gravel', clay: 'Clay', weak: 'Clay with a weak clay layer 4–6 m down' };
  const PRESETS = [
    { id: 'homogeneous', name: 'Homogeneous fill' },
    { id: 'cored', name: 'Clay core + rockfill' },
    { id: 'filtered', name: 'Core + chimney filter' },
    { id: 'drained', name: 'Fill + drain' },
    { id: 'leaky', name: 'Leaky' },
    { id: 'steep', name: 'Steep and wet', base: 'homogeneous', set: { slope: 1.5, reservoir: 0.95 } },
    { id: 'tailings', name: 'Tailings sand' }
  ];
  const MISSION_TEXT = {
    dry: {
      title: 'Dry the slope',
      brief: 'This dam is all compacted fill on clay. Water breaks out 8 m up its downstream slope and its factor of safety is 1.12. Keep the 2:1 slope and the reservoir where they are, and get the factor of safety to 1.5 with a piping safety of 3 or more.',
      hints: ['Test it first and follow the dashed line: the water stays high right through the dam and comes out on the downstream slope.',
        'The fill is strong enough when it is dry. Give the water a way out before it reaches the downstream half.',
        'Paint a strip of sand filter about 2 m wide, standing up just downstream of the crest, and join its foot to a 2 m layer of filter along the base out to the toe. A clay core with rockfill shells also works.'],
      done: 'The drain catches the water before it reaches the downstream slope, so the grains there press on each other with their full weight. Same soil, same slope, much more grip.'
    },
    hold: {
      title: 'Hold the water',
      brief: 'This rockfill dam on sand and gravel leaks like a sieve. Cut the seepage to 100 L/day per metre or less, keep the piping safety at 3 or more and the factor of safety at 1.5, and use no more than 350 m³ of clay per metre of dam.',
      hints: ['Follow the flow lines: water goes through the rockfill and also under the dam through the gravel.',
        'Rockfill needs a watertight heart. Clay passes water about a hundred thousand times more slowly than rockfill.',
        'Paint a clay core up the middle, wide at the base and narrow at the top, then close the path underneath with a full cutoff.'],
      done: 'The core takes the head through the dam and the cutoff closes the path through the gravel. The water has no quick way past, so the seepage falls from tens of thousands of litres a day per metre to a few.'
    },
    polley: {
      title: 'Mount Polley',
      brief: 'In 2014 the Mount Polley tailings dam in British Columbia slid on a weak clay layer in its foundation and released about 25 million m³ of water and tailings. The investigation found the design had not allowed for that layer, and a steep downstream slope made it worse. This dam sits on a similar layer 4 m down. Get the factor of safety to 1.5, checked on blocks sliding along the layer as well as on circles.',
      hints: ['Test it. The critical surface is not a circle: it is a block sliding along the weak layer.',
        'Drains barely help here. The layer is weak because of what it is, and it lies sealed in clay below the dam.',
        'Weight pressing down on the layer beyond the toe holds the block back. Flatten the downstream slope.'],
      done: 'The flatter slope puts more weight on the layer beyond the old toe, and the block has a longer stretch of layer to slide along. Flatter slopes and toe buttresses of extra fill are the usual fix for a weak foundation.'
    },
    tailings: {
      title: 'Tailings on a budget',
      brief: 'Mines build tailings dams from their own waste because it costs nothing. Make at least 70% of this dam from cycloned tailings sand, and get the factor of safety to 1.5 with a piping safety of 3 or more.',
      hints: ['Tailings sand has no cohesion. Even dry, a slope of loose grains stands only up to its friction angle, and wet it stands much less.',
        'Keep it dry first: a drain inside the sand lowers the water level.',
        'A chimney and blanket drain plus a 2.5:1 downstream slope does it.'],
      done: 'Dry, gently sloped sand holds. Downstream-raised tailings dams use drains and flat downstream slopes for this reason. One thing this sandbox cannot show: loose saturated tailings sand can liquefy (Step 4), so real ones are also compacted.'
    }
  };
  const GOAL_TEXT = {
    q: g => `Seepage ≤ ${g.maxQ} L/day per metre`, pipe: g => `Safety vs piping ≥ ${g.minPipe}`, fos: g => `Factor of safety ≥ ${g.minFoS}`,
    clay: g => `Clay ≤ ${g.maxClay} m³ per metre`, tsand: g => `Tailings sand ≥ ${Math.round(g.minTsand * 100)}% of the dam`
  };
  const LIVE_GOALS = { clay: true, tsand: true }; // checked while painting, before any test

  // ---------------------------------------------------------------- state
  const st = { cells: new Uint8Array(NC), slope: 2, foundation: 'clay', cutoff: 'none', reservoir: 0.85, mat: 3, brush: 3, side: 'downstream', touch: 'paint', mission: 'free' };
  let version = 0;            // bumps on every design change
  let result = null;          // { version, seep, stab, m, design }
  let tested = false;         // first test done: later changes retest automatically
  let hintsShown = 0;
  const undo = [];
  const toe = s => 3 + s * CREST;
  const downFace = (z, s) => toe(s) - s * z;
  const inDam = (x, z, s) => z >= 0 && z <= CREST && x >= UPTOE + 2 * z && x <= downFace(z, s);
  const cx = i => GX0 + i + 0.5, cz = j => GZ0 + j + 0.5;
  function applyPreset(id) {
    const P = PRESETS.find(p => p.id === id) || PRESETS[0];
    if (P.set) Object.assign(st, P.set);
    const cells = API.presetCells(P.base || P.id, 3); // fill the widest outline, then use what fits
    st.cells.set(cells);
  }
  // slope change: cells that come inside the new outline copy the nearest painted cell to their left
  function reslope(oldS, newS) {
    for (let j = 15; j < NZ; j++) {
      const z = cz(j);
      let last = -1;
      for (let i = 0; i < NX; i++) {
        const x = cx(i), c = i * NZ + j;
        if (inDam(x, z, oldS)) last = st.cells[c];
        else if (last >= 0 && inDam(x, z, newS)) st.cells[c] = last;
      }
    }
  }
  function damCellCount() { let n = 0; for (let i = 0; i < NX; i++) for (let j = 15; j < NZ; j++) if (inDam(cx(i), cz(j), st.slope)) n++; return n; }
  function liveCounts() {
    let clay = 0, tsand = 0, dam = 0, drain = 0;
    for (let i = 0; i < NX; i++) for (let j = 15; j < NZ; j++) {
      if (!inDam(cx(i), cz(j), st.slope)) continue;
      const m = st.cells[i * NZ + j]; dam++;
      if (m === 1) clay++; else if (m === 4) tsand++; else if (m === 3) drain++;
    }
    return { clay, tsand, dam, drain, tsandFrac: dam ? tsand / dam : 0 };
  }

  // ---------------------------------------------------------------- drawing
  const svg = $('#svg-build');
  const G = { x0: -62, x1: 90, z0: -15, z1: 27 };
  const W = 1000, kx = 980 / (G.x1 - G.x0);
  const M = mapper({ x0: G.x0, x1: G.x1, z0: G.z0, z1: G.z1, X0: 10, X1: 990, Y0: 22, Y1: 22 + (G.z1 - G.z0) * kx });
  const defs = E('defs', null, svg);
  const winClip = E('clipPath', { id: 'bd-win' }, defs);
  E('rect', { x: M.X(G.x0), y: 0, width: M.X(G.x1) - M.X(G.x0), height: 312 }, winClip);
  const damClip = E('clipPath', { id: 'bd-damclip' }, defs);
  const damClipPoly = E('polygon', null, damClip);
  const soilClip = E('clipPath', { id: 'bd-soilclip' }, defs);
  const soilClipPoly = E('polygon', null, soilClip);
  E('rect', { x: M.X(G.x0), y: M.Z(0), width: M.X(G.x1) - M.X(G.x0), height: M.Z(G.z0) - M.Z(0) }, soilClip);
  const top = E('g', { 'clip-path': 'url(#bd-win)' }, svg);
  const L = () => E('g', null, top);
  const gRes = L(), gFdn = L(), gCells = E('g', { 'clip-path': 'url(#bd-damclip)' }, top), gOut = L(), gImg = L(), gFl = L(), gPh = L(), gMass = L(), gSlip = L(), gMark = L(), gPart = L(), gLbl = L(), gCur = L();
  const fieldImg = E('image', { x: M.X(GX0), y: M.Z(GZ0 + NZ), width: M.X(GX0 + NX) - M.X(GX0), height: M.Z(GZ0) - M.Z(GZ0 + NZ), preserveAspectRatio: 'none', 'clip-path': 'url(#bd-soilclip)' }, gImg);
  const cursor = E('rect', { class: 'bd-cursor' }, gCur);
  cursor.style.visibility = 'hidden';
  const outlineOf = s => [[UPTOE, 0], [-3, CREST], [3, CREST], [toe(s), 0]];
  function surfW(x, s) { // ground surface (world)
    if (x <= UPTOE || x >= toe(s)) return 0;
    if (x < -3) return (x - UPTOE) / 2;
    if (x <= 3) return CREST;
    return (toe(s) - x) / s;
  }
  function drawStatic() {
    gRes.textContent = ''; gFdn.textContent = ''; gOut.textContent = ''; gLbl.textContent = '';
    const s = st.slope, Hw = st.reservoir * CREST;
    const up = result && st.side === 'upstream' && !stale();
    damClipPoly.setAttribute('points', M.P(outlineOf(s)));
    soilClipPoly.setAttribute('points', M.P(outlineOf(s)));
    // reservoir (emptied in the drawdown view)
    if (up) {
      E('path', { class: 'water-line', d: M.D([[G.x0, Hw], [UPTOE + 2 * Hw, Hw]]), style: 'stroke-dasharray:3 4;opacity:.7' }, gRes);
      T(gLbl, M.X(-60), M.Z(Hw) - 6, 'Level before the drawdown', 'lbl-s lbl-w halo');
    } else {
      E('polygon', { class: 'water', points: M.P([[G.x0, Hw], [UPTOE + 2 * Hw, Hw], [UPTOE, 0], [G.x0, 0]]) }, gRes);
      E('path', { class: 'water-line', d: M.D([[G.x0, Hw], [UPTOE + 2 * Hw, Hw]]) }, gRes);
      waterSymbol(gRes, M.X(-56), M.Z(Hw));
      T(gLbl, M.X(-58), M.Z(Hw) + 16, 'Reservoir ' + n1(Hw) + ' m', 'lbl-s lbl-w halo');
    }
    E('path', { class: 'water-line', d: M.D([[toe(s), 0], [G.x1, 0]]), style: 'stroke-dasharray:4 3' }, gRes);
    // foundation
    const fpat = st.foundation === 'gravel' ? 'url(#p-alluv)' : 'url(#p-clay)';
    E('rect', { x: M.X(G.x0), y: M.Z(0), width: M.X(G.x1) - M.X(G.x0), height: M.Z(G.z0) - M.Z(0), fill: fpat, class: 'edge' }, gFdn);
    if (st.foundation === 'weak') {
      E('rect', { x: M.X(G.x0), y: M.Z(-4), width: M.X(G.x1) - M.X(G.x0), height: M.Z(-6) - M.Z(-4), fill: 'url(#p-slime)', class: 'edge-l' }, gFdn);
      T(gLbl, M.X(G.x1) - 6, M.Z(-6) + 12, 'Weak clay layer · φ′ 19°', 'lbl-s halo', { 'text-anchor': 'end' });
    }
    if (st.cutoff !== 'none') {
      const zb = st.cutoff === 'full' ? -15 : -8;
      E('rect', { x: M.X(-1), y: M.Z(0), width: M.X(1) - M.X(-1), height: M.Z(zb) - M.Z(0), class: 'ink' }, gFdn);
      T(gLbl, M.X(1.5) + 3, M.Z(zb) + (st.cutoff === 'full' ? -5 : 11), 'Cutoff', 'lbl-s halo');
    }
    T(gLbl, M.X(G.x0) + 6, M.Z(-13), FOUND[st.foundation] + ' foundation', 'lbl-s halo');
    E('polygon', { points: M.P(outlineOf(s)), class: 'edge', style: 'fill:none' }, gOut);
    T(gLbl, M.X(-4), M.Z(CREST) - 6, 'Crest 24 m', 'lbl-s halo', { 'text-anchor': 'end' });
    T(gLbl, M.X(toe(s)) + 4, M.Z(0) - 14, 'Toe', 'lbl-s halo');
    T(gLbl, M.X(toe(s) - 0.55 * s * CREST), M.Z(0.55 * CREST) - 6, s + ':1', 'lbl-s halo', { transform: `rotate(${(Math.atan(1 / s) * 180 / Math.PI).toFixed(1)},${M.X(toe(s) - 0.55 * s * CREST).toFixed(1)},${(M.Z(0.55 * CREST) - 6).toFixed(1)})` });
  }
  function drawCells() {
    gCells.textContent = '';
    const s = st.slope;
    for (let j = 15; j < NZ; j++) {
      const z = cz(j);
      if (z > CREST) break;
      let i = 0;
      const runs = [];
      while (i < NX) {
        if (!inDam(cx(i), z, s)) { i++; continue; }
        const m = st.cells[i * NZ + j];
        let k = i;
        while (k + 1 < NX && inDam(cx(k + 1), z, s) && st.cells[(k + 1) * NZ + j] === m) k++;
        runs.push([i, k, m]); i = k + 1;
      }
      runs.forEach((r, n) => {
        const xa = GX0 + r[0] - (n === 0 ? 1.5 : 0), xb = GX0 + r[1] + 1 + (n === runs.length - 1 ? 1.5 : 0);
        const za = z - 0.5, zb = z + 0.5 + (z + 0.5 >= CREST - 0.01 ? 0.6 : 0);
        E('rect', { x: M.X(xa).toFixed(1), y: M.Z(zb).toFixed(1), width: (M.X(xb) - M.X(xa)).toFixed(1), height: (M.Z(za) - M.Z(zb) + 0.3).toFixed(1), fill: `url(#${MAT[r[2]].pat})` }, gCells);
      });
    }
  }

  // ---------------------------------------------------------------- palette, presets, controls
  const palEl = $('#bd-palette');
  MAT.forEach((m, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.i = i; b.setAttribute('aria-pressed', i === st.mat ? 'true' : 'false');
    b.innerHTML = `<svg class="bd-sw" viewBox="0 0 22 16" aria-hidden="true"><rect width="22" height="16" fill="url(#${m.pat})"/></svg><span>${m.name}</span>`;
    b.addEventListener('click', () => { st.mat = i; $$('button', palEl).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); matInfo(); });
    palEl.appendChild(b);
  });
  const sup = n => String(n).replace(/-/g, '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
  const kTxt = k => { const e = Math.floor(Math.log10(k) + 1e-9), mnt = k / Math.pow(10, e); return (Math.abs(mnt - 1) < 0.01 ? '' : mnt.toFixed(0) + '×') + '10' + sup(e) + ' m/s'; };
  function matInfo() {
    const m = MAT[st.mat];
    $('#bd-matinfo').innerHTML = `<b>${m.name}</b> · k = ${kTxt(m.k)} · φ′ = ${m.phi}° · c′ = ${m.c} kPa · ${m.gs} kN/m³ saturated. ${m.note}`;
  }
  const preEl = $('#bd-presets');
  PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn bd-pre'; b.textContent = p.name; b.dataset.p = p.id;
    b.addEventListener('click', () => {
      pushUndo();
      const lockS = locked('slope'), lockR = locked('reservoir'), keep = { slope: st.slope, reservoir: st.reservoir };
      applyPreset(p.id);
      if (lockS) st.slope = keep.slope;
      if (lockR) st.reservoir = keep.reservoir;
      syncControls(); changed();
    });
    preEl.appendChild(b);
  });
  const segs = {
    brush: segGroup($('#bd-brush'), v => { st.brush = +v; }),
    touch: segGroup($('#bd-touch'), v => { st.touch = v; svg.classList.toggle('bd-pan', v === 'pan'); }),
    foundation: segGroup($('#bd-found'), v => { st.foundation = v; changed(); }),
    cutoff: segGroup($('#bd-cut'), v => { st.cutoff = v; changed(); }),
    slope: segGroup($('#bd-slope'), v => { const o = st.slope; st.slope = +v; reslope(o, st.slope); changed(); }),
    side: segGroup($('#bd-side'), v => { st.side = v; drawStatic(); if (result) render(); })
  };
  void segs;
  const resEl = $('#bd-res');
  resEl.addEventListener('input', () => { st.reservoir = +resEl.value / 100; $('#bd-res-o').textContent = n1(st.reservoir * CREST) + ' m'; changed(); });
  function setSeg(id, v) { $$('button', $(id)).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === String(v) ? 'true' : 'false')); }
  function syncControls() {
    setSeg('#bd-found', st.foundation); setSeg('#bd-cut', st.cutoff); setSeg('#bd-slope', st.slope);
    resEl.value = Math.round(st.reservoir * 100); $('#bd-res-o').textContent = n1(st.reservoir * CREST) + ' m';
    $$('#bd-slope button').forEach(b => { b.disabled = locked('slope'); });
    $$('#bd-found button').forEach(b => { b.disabled = locked('foundation'); });
    resEl.disabled = locked('reservoir');
  }
  const missionDef = () => (st.mission === 'free' ? null : B.missions.find(m => m.id === st.mission));
  const locked = k => { const m = missionDef(); return !!(m && m.lock.indexOf(k) >= 0); };

  // ---------------------------------------------------------------- painting
  let painting = false, lastPt = null;
  function toWorld(ev) {
    const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return [G.x0 + (q.x - M.X(G.x0)) / M.kx, G.z0 + (M.Z(G.z0) - q.y) / M.kz];
  }
  function paintAt(x, z) {
    const r = (st.brush - 1) / 2, ic = Math.floor(x - GX0), jc = Math.floor(z - GZ0);
    let n = 0;
    for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      const i = ic + di, j = jc + dj;
      if (i < 0 || i >= NX || j < 15 || j >= NZ || !inDam(cx(i), cz(j), st.slope)) continue;
      const c = i * NZ + j;
      if (st.cells[c] !== st.mat) { st.cells[c] = st.mat; n++; }
    }
    return n;
  }
  function showCursor(x, z) {
    const r = (st.brush - 1) / 2, ic = Math.floor(x - GX0), jc = Math.floor(z - GZ0);
    const xa = GX0 + ic - r, za = GZ0 + jc - r;
    cursor.setAttribute('x', M.X(xa)); cursor.setAttribute('y', M.Z(za + st.brush));
    cursor.setAttribute('width', M.X(xa + st.brush) - M.X(xa)); cursor.setAttribute('height', M.Z(za) - M.Z(za + st.brush));
    cursor.style.visibility = z > -0.5 && z < CREST + 1 ? 'visible' : 'hidden';
    cursorPos = [x, z];
  }
  let cursorPos = [10, 12], strokeDirty = false;
  svg.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'touch' && st.touch === 'pan') return;
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    ev.preventDefault();
    try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    painting = true; pushUndo(); strokeDirty = false;
    const p = toWorld(ev); lastPt = p; showCursor(p[0], p[1]);
    if (paintAt(p[0], p[1])) { strokeDirty = true; drawCells(); }
  });
  svg.addEventListener('pointermove', ev => {
    const p = toWorld(ev);
    if (ev.pointerType !== 'touch' || painting) showCursor(p[0], p[1]);
    if (!painting) return;
    const d = Math.hypot(p[0] - lastPt[0], p[1] - lastPt[1]), n = Math.max(1, Math.ceil(d / 0.5));
    let any = 0;
    for (let k = 1; k <= n; k++) any += paintAt(lerp(lastPt[0], p[0], k / n), lerp(lastPt[1], p[1], k / n));
    lastPt = p;
    if (any) { strokeDirty = true; drawCells(); updateMission(); }
  });
  const endStroke = () => {
    if (!painting) return;
    painting = false;
    if (strokeDirty) changed(); else undo.pop();
    $('#bd-undo').disabled = !undo.length;
  };
  svg.addEventListener('pointerup', endStroke);
  svg.addEventListener('pointercancel', endStroke);
  svg.addEventListener('pointerleave', ev => { if (!painting && ev.pointerType === 'mouse') cursor.style.visibility = 'hidden'; });
  svg.addEventListener('keydown', ev => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key];
    if (step) {
      ev.preventDefault();
      showCursor(clamp(cursorPos[0] + step[0], UPTOE, toe(st.slope)), clamp(cursorPos[1] + step[1], 0.5, CREST - 0.5));
      if (ev.shiftKey) { if (paintAt(cursorPos[0], cursorPos[1])) { drawCells(); changed(); } }
    } else if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault(); pushUndo();
      if (paintAt(cursorPos[0], cursorPos[1])) { drawCells(); changed(); } else undo.pop();
    }
  });
  svg.addEventListener('focus', () => showCursor(cursorPos[0], cursorPos[1]));
  svg.addEventListener('blur', () => { cursor.style.visibility = 'hidden'; });
  function pushUndo() {
    undo.push({ cells: st.cells.slice(), slope: st.slope, reservoir: st.reservoir });
    if (undo.length > 40) undo.shift();
    $('#bd-undo').disabled = false;
  }
  $('#bd-undo').addEventListener('click', () => {
    const u = undo.pop();
    if (!u) return;
    st.cells.set(u.cells);
    if (!locked('slope')) st.slope = u.slope;
    if (!locked('reservoir')) st.reservoir = u.reservoir;
    $('#bd-undo').disabled = !undo.length;
    syncControls(); changed();
  });

  // ---------------------------------------------------------------- solving (worker + watchdog)
  let worker = null, workerFailed = false, inFlight = null, queued = false, reqId = 0, watchdog = 0, retestTimer = 0;
  function makeWorker() {
    if (worker || workerFailed) return worker;
    try {
      const a = $('#seep-src'), b = $('#stab-src');
      if (!a || !b) throw new Error('solver sources missing');
      worker = new Worker(URL.createObjectURL(new Blob([a.textContent + '\n;\n' + b.textContent], { type: 'text/javascript' })));
      worker.onmessage = e => onMessage(e.data || {});
      worker.onerror = () => { workerFailed = true; killWorker(); if (inFlight) { const d = inFlight.design; inFlight = null; runInline(d); } };
    } catch (e) { workerFailed = true; worker = null; }
    return worker;
  }
  function killWorker() { if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } } worker = null; }
  function snapshot() { return { cells: st.cells.slice(), slope: st.slope, foundation: st.foundation, cutoff: st.cutoff, reservoir: st.reservoir, version }; }
  function test() {
    clearTimeout(retestTimer);
    if (inFlight) { queued = true; return; }
    const d = snapshot();
    statusEl.textContent = tested ? 'Retesting…' : 'Testing: seepage, then stability…';
    $('#bd-test').disabled = true;
    const w = makeWorker();
    if (!w) { runInline(d); return; }
    const q = API.buildRequest(d);
    inFlight = { id: ++reqId, design: d, t0: performance.now() };
    w.postMessage({ id: inFlight.id, kind: 'build', seep: q.seep, stab: q.stab });
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      killWorker(); inFlight = null; queued = false; $('#bd-test').disabled = false;
      statusEl.textContent = 'The solver took too long on this design and was stopped. Try removing very small pockets of material, then test again.';
    }, 15000);
  }
  function runInline(d) {
    inFlight = { id: ++reqId, design: d, t0: performance.now() };
    setTimeout(() => {
      try {
        const r = API.runDesign(d, window.SeepageSolver);
        onMessage({ id: inFlight.id, seep: r.seep, stab: r.stab });
      } catch (err) { onMessage({ id: inFlight.id, error: String(err && err.message || err) }); }
    }, 30);
  }
  function onMessage(msg) {
    if (!inFlight || msg.id !== inFlight.id) return;
    clearTimeout(watchdog);
    const job = inFlight; inFlight = null;
    $('#bd-test').disabled = false;
    if (msg.error || !msg.seep) {
      statusEl.textContent = 'The solver could not handle this design (' + (msg.error || 'no result') + '). Try a simpler zoning.';
      return;
    }
    const m = API.designMetrics(msg.seep, msg.stab);
    result = { version: job.design.version, design: job.design, seep: msg.seep, stab: msg.stab, m, ms: performance.now() - job.t0 };
    tested = true;
    const s = msg.seep.stats;
    statusEl.textContent = (s.converged ? 'Tested in ' + (result.ms / 1000).toFixed(1) + ' s' : 'The seepage solution did not fully settle; numbers are approximate') +
      (s.alphaFloor ? ' · smoothed the unsaturated zone to converge' : '') + (msg.stab.downstream && msg.stab.downstream.timedOut ? ' · slip search cut short' : '');
    drawStatic(); render();
    if (queued) { queued = false; if (version !== job.design.version) test(); }
  }
  $('#bd-test').addEventListener('click', test);
  const stale = () => !result || result.version !== version;
  function changed() {
    version++;
    drawStatic(); drawCells(); updateMission();
    root.classList.toggle('bd-is-stale', stale() && !!result);
    if (result) { clearResultDrawing(); readoutsStale(); }
    if (tested) { clearTimeout(retestTimer); retestTimer = setTimeout(test, 700); statusEl.textContent = 'Changed. Retesting shortly…'; }
  }

  // ---------------------------------------------------------------- result drawing
  const fieldCv = document.createElement('canvas');
  let flows = [];
  function clearResultDrawing() {
    [gFl, gPh, gMass, gSlip, gMark, gPart].forEach(g => (g.textContent = ''));
    fieldImg.removeAttribute('href'); flows = [];
  }
  function paintField(psi, type) {
    const SC = 4;
    fieldCv.width = NX * SC; fieldCv.height = NZ * SC;
    const c2 = fieldCv.getContext('2d'), im = c2.createImageData(fieldCv.width, fieldCv.height);
    const col = rgba(cssVar('--water'));
    const val = (i, j) => { i = clamp(i, 0, NX - 1); j = clamp(j, 0, NZ - 1); const c = i * NZ + j, t = type[c]; return t === 1 || t === 3 ? psi[c] : NaN; };
    for (let py = 0; py < fieldCv.height; py++) {
      const zc = (NZ - (py + 0.5) / SC) - 0.5;
      for (let px = 0; px < fieldCv.width; px++) {
        const xc = (px + 0.5) / SC - 0.5;
        const i0 = Math.floor(xc), j0 = Math.floor(zc), fx = xc - i0, fz = zc - j0;
        let s = 0, w = 0;
        const acc = (i, j, wt) => { const v = val(i, j); if (v === v && wt > 0) { s += v * wt; w += wt; } };
        acc(i0, j0, (1 - fx) * (1 - fz)); acc(i0 + 1, j0, fx * (1 - fz)); acc(i0, j0 + 1, (1 - fx) * fz); acc(i0 + 1, j0 + 1, fx * fz);
        const o = (py * fieldCv.width + px) * 4;
        if (w < 0.2) { im.data[o + 3] = 0; continue; }
        const p = s / w;
        if (p < 0) { im.data[o + 3] = 0; continue; }
        const a = 0.05 + 0.5 * clamp(p / 36, 0, 1);
        im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = Math.round(255 * a);
      }
    }
    c2.putImageData(im, 0, 0);
    fieldImg.setAttribute('href', fieldCv.toDataURL());
  }
  const sideRes = () => (result ? result.stab[st.side] : null);
  function fosClass(f, side) { const ok = side === 'upstream' ? 1.2 : 1.5, warn = side === 'upstream' ? 1.0 : 1.2; return f >= ok ? 'ok' : f >= warn ? 'warn' : 'bad'; }
  function render() {
    if (!result) return;
    clearResultDrawing();
    const seep = result.seep, d = result.design, s = d.slope, up = st.side === 'upstream';
    const sr = sideRes();
    paintField(up && sr && sr.psi ? sr.psi : seep.psi, seep.type);
    if (!up) {
      // flow lines + particles
      const all = (seep.flowlines || []).filter(f => f.pts && f.pts.length > 1);
      const speeds = []; all.forEach(f => f.pts.forEach(p => { if (p[3] > 0) speeds.push(p[3]); }));
      speeds.sort((a, b) => a - b);
      const vref = speeds.length ? speeds[Math.floor(speeds.length / 2)] : 1e-6;
      for (const f of all) {
        E('path', { d: D(f.pts.map(M.pt)), class: 'flowline' }, gFl);
        const tau = [0];
        for (let i = 1; i < f.pts.length; i++) {
          const a = f.pts[i - 1], b = f.pts[i];
          const v = Math.max(1e-12, (a[3] + b[3]) / 2);
          tau.push(tau[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]) / clamp(5 * Math.pow(v / vref, 0.33), 0.9, 30));
        }
        flows.push({ pts: f.pts, tau, T: tau[tau.length - 1], parts: [0, 1, 2].map(() => E('circle', { r: 2, class: 'particle' }, gPart)) });
      }
      if (seep.phreatic && seep.phreatic.length > 1) E('path', { d: D(seep.phreatic.map(M.pt)), class: 'phreatic', style: 'stroke-width:2.2' }, gPh);
      const sf = seep.seepageFace;
      if (sf && sf.present && sf.topZ > 0.3) {
        const a = [downFace(Math.max(0, sf.bottomZ), s), Math.max(0, sf.bottomZ)], b = [downFace(sf.topZ, s), sf.topZ];
        E('path', { d: M.D([a, b]), style: 'stroke:var(--accent);stroke-width:5;stroke-linecap:round;fill:none;opacity:.9' }, gMark);
        const [bx, by] = M.pt(b);
        leader(gMark, bx + 4, by - 2, bx + 24, by - 18); T(gMark, bx + 26, by - 20, 'Water breaks out: ' + n1(sf.topZ) + ' m up', 'lbl-s lbl-acc halo');
      }
      const ex = seep.exit, imax = result.m.iExit;
      if (ex && isFinite(ex.fs) && imax > 0.02) {
        const gx = ex.governing === 'face' ? ex.faceX : ex.groundX, gz = ex.governing === 'face' ? ex.faceZ : 0;
        const [px, py] = M.pt([gx, gz]);
        const cls = ex.fs >= 3 ? 'ok' : ex.fs >= 1.5 ? 'warn' : 'bad';
        flows.pulse = E('circle', { cx: px, cy: py, r: 7, class: 'bd-exit ' + cls }, gMark);
        E('circle', { cx: px, cy: py, r: 2.5, class: 'bd-exit-dot ' + cls }, gMark);
        T(gMark, px + 10, py + 17, 'exit gradient ' + imax.toFixed(2), 'lbl-s halo bd-t-' + cls);
      }
    }
    // critical slip surface
    if (sr && sr.critical) {
      const cr = sr.critical, cls = fosClass(sr.fos, st.side);
      const pts = cr.pts;
      const xa = pts[0][0], xb = pts[pts.length - 1][0];
      const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
      const surf = [];
      const corners = [UPTOE, -3, 3, toe(s)].filter(x => x > lo && x < hi);
      const xs = [hi].concat(corners.sort((p, q) => q - p), [lo]);
      xs.forEach(x => surf.push([x, surfW(x, s)]));
      const ring = (xa < xb ? pts : pts.slice().reverse()).concat(surf);
      E('polygon', { points: M.P(ring), class: 'bd-mass ' + cls }, gMass);
      E('path', { d: D(pts.map(M.pt)), class: 'bd-slip ' + cls }, gSlip);
      // pore pressure on the slip surface, as the height it would push water up a tube
      cr.slices.forEach((sl, k) => {
        if (k % 2 || sl.u < 1) return;
        const hgt = sl.u / API.GAMMA_W;
        E('path', { d: M.D([[sl.x, sl.zb], [sl.x, sl.zb + hgt]]), class: 'bd-ubar' }, gSlip);
      });
      // label
      const mid = pts[Math.floor(pts.length * (up ? 0.6 : 0.4))];
      const [lx, ly] = M.pt([mid[0], mid[1]]);
      const txt = 'FoS ' + sr.fos.toFixed(2);
      const g = E('g', { class: 'bd-tag ' + cls }, gSlip);
      E('rect', { x: lx - 31, y: ly + 8, width: 62, height: 18, rx: 3 }, g);
      T(g, lx, ly + 21, txt, 'lbl', { 'text-anchor': 'middle' });
      // direction of sliding
      const ent = up ? pts[pts.length - 1] : pts[0];
      const [ax, ay] = M.pt(ent);
      E('path', { d: `M${ax},${ay - 10} l${up ? -16 : 16},10`, class: 'bd-arrow ' + cls, 'marker-end': 'url(#arr-acc)' }, gSlip);
    }
    readouts();
    updateMission();
  }
  function placeParticles(time) {
    for (const fl of flows) {
      if (!fl.T || !fl.parts) continue;
      fl.parts.forEach((c, k) => {
        const tt = ((time + k * fl.T / fl.parts.length) % fl.T + fl.T) % fl.T;
        let i = 1; while (i < fl.tau.length - 1 && fl.tau[i] < tt) i++;
        const a = fl.pts[i - 1], b = fl.pts[i], u = (tt - fl.tau[i - 1]) / ((fl.tau[i] - fl.tau[i - 1]) || 1);
        c.setAttribute('cx', M.X(lerp(a[0], b[0], u)).toFixed(1)); c.setAttribute('cy', M.Z(lerp(a[1], b[1], u)).toFixed(1));
      });
    }
  }
  F.ticks.push(t => {
    if (RM) return;
    placeParticles(t);
    if (flows.pulse) flows.pulse.setAttribute('r', (7 + 3 * Math.sin(t * 4)).toFixed(1));
  });
  onTheme(() => { if (result && !stale()) render(); });

  // ---------------------------------------------------------------- readouts and verdict
  const fmtL = L => (L >= 100 ? fmt(L, 0) : L >= 1 ? L.toFixed(1) : L >= 0.01 ? L.toFixed(2) : '< 0.01');
  const pill = (cls, txt) => `<span class="pill ${cls}">${txt}</span>`;
  const leakClass = q => (q <= 1000 ? 'ok' : q <= 10000 ? 'warn' : 'bad');
  const pipeClass = f => (f >= 3 ? 'ok' : f >= 1.5 ? 'warn' : 'bad');
  function readoutsStale() {
    $('#bd-readouts').classList.add('bd-stale');
    $('#bd-verdict').classList.add('bd-stale');
  }
  function readouts() {
    const m = result.m, seep = result.seep, sr = sideRes();
    $('#bd-readouts').classList.remove('bd-stale'); $('#bd-verdict').classList.remove('bd-stale');
    root.classList.remove('bd-is-stale');
    $('#bd-q').innerHTML = fmtL(m.qLday) + ' L/day ' + pill(leakClass(m.qLday), leakClass(m.qLday) === 'ok' ? 'Low' : leakClass(m.qLday) === 'warn' ? 'High' : 'Very high');
    const outs = [['drains', m.qDrainLday], ['slope face', m.qFaceLday], ['ground beyond the toe', m.qGroundLday]].sort((a, b) => b[1] - a[1]);
    const osum = outs.reduce((a, o) => a + o[1], 0) || 1;
    $('#bd-q2').textContent = 'per metre · ' + Math.round(100 * outs[0][1] / osum) + '% leaves via the ' + outs[0][0];
    $('#bd-i').textContent = m.iExit > 0.005 ? m.iExit.toFixed(2) : '≈ 0';
    $('#bd-i2').textContent = m.iExit > 0.005 ? (m.exitWhere === 'face' ? 'on the downstream slope' : 'at the ground beyond the toe') : 'every exit is filtered';
    const pf = m.pipe;
    $('#bd-pipe').innerHTML = (!isFinite(pf) || pf > 50 ? '> 50' : pf.toFixed(1)) + ' ' + pill(pipeClass(pf), pf >= 3 ? 'Adequate' : pf >= 1.5 ? 'Marginal' : 'Piping risk');
    if (sr && isFinite(sr.fos)) {
      const c = fosClass(sr.fos, st.side);
      $('#bd-fos').innerHTML = sr.fos.toFixed(2) + ' ' + pill(c, c === 'ok' ? 'Stable' : c === 'warn' ? 'Low margin' : sr.fos < 1 ? 'Slides' : 'Likely slides');
      $('#bd-fos2').textContent = (st.side === 'upstream' ? 'upstream, after a fast drawdown · ' : 'downstream, full reservoir · ') + (sr.critical.kind === 'block' ? 'block along the layer' : 'circle, Bishop');
    } else { $('#bd-fos').textContent = '–'; $('#bd-fos2').textContent = 'no slip surface found'; }
    const sf = seep.seepageFace;
    const midX = (3 + toe(result.design.slope)) / 2;
    const wl = waterHeightAt(seep, midX);
    if (sf.present && sf.topZ > 0.3) { $('#bd-ph').textContent = 'Breaks out'; $('#bd-ph2').textContent = n1(sf.topZ) + ' m up the downstream slope'; }
    else { $('#bd-ph').textContent = n1(Math.max(0, wl)) + ' m'; $('#bd-ph2').textContent = 'water level above the base, under the middle of the downstream slope'; }
    $('#bd-clay').textContent = fmt(m.clay);
    $('#bd-clay2').textContent = 'm³ per metre · tailings sand ' + Math.round(m.tsandFrac * 100) + '%';
    verdict();
  }
  // height of the saturated zone above the base of the dam at x (scan the column upward)
  function waterHeightAt(seep, x) {
    const i = Math.round(x - GX0 - 0.5);
    let prevZ = -0.5, prevPsi = seep.psi[i * NZ + 14];
    if (!(prevPsi >= 0)) return 0;
    for (let j = 15; j < NZ; j++) {
      const c = i * NZ + j, t = seep.type[c];
      if (t !== 1 && t !== 3) break;
      const z = cz(j), p = seep.psi[c];
      if (p < 0) return prevZ + prevPsi / (prevPsi - p) * (z - prevZ);
      prevZ = z; prevPsi = p;
    }
    return prevZ;
  }
  const matName = k => (k < MAT.length ? MAT[k].name.toLowerCase() : k === MAT.length ? 'the foundation' : 'the weak clay layer');
  function surfaceMaterials(cr) { return cr.materials.filter(x => x.frac >= 0.12).slice(0, 3).map(x => matName(x.mat)); }
  const andList = a => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  function verdict() {
    const m = result.m, seep = result.seep, sr = sideRes(), up = st.side === 'upstream';
    const rows = [], tips = [];
    // leakage
    const lc = leakClass(m.qLday);
    const under = seep.q.inflowFloor / Math.max(1e-30, seep.q.inflowTotal);
    let leakTxt = `${fmtL(m.qLday)} L/day per metre, about ${fmt(m.qLday, m.qLday < 10 ? 1 : 0)} m³ a day for each kilometre of dam. ` +
      (under > 0.6 ? `Most of it (${Math.round(under * 100)}%) enters through the reservoir floor and passes under the dam.` : `Most of it passes through the dam itself.`);
    if (lc !== 'ok') tips.push(under > 0.6 ? 'Water is going under the dam: a full cutoff closes that path.' : 'Water is going through the dam: a clay core slows it the most.');
    rows.push(['Leaks', lc, lc === 'ok' ? 'Low' : lc === 'warn' ? 'High' : 'Very high', leakTxt]);
    // piping
    const pc = pipeClass(m.pipe);
    let pipeTxt;
    if (m.iExit <= 0.005) pipeTxt = 'All the water leaves through filter or drain material, which lets water out but holds soil back.';
    else {
      const where = m.exitWhere === 'face' ? 'out of the downstream slope' : 'up out of the ground beyond the toe';
      pipeTxt = `Water comes ${where} with a gradient of ${m.iExit.toFixed(2)}: it pushes on the grains there with ${Math.round(m.iExit * 100)}% of the force that would lift them (sand boils at about 1.0). Safety ${!isFinite(m.pipe) || m.pipe > 50 ? 'over 50' : m.pipe.toFixed(1)}.`;
      if (pc !== 'ok') tips.push(m.exitWhere === 'face' ? 'Cover the exit: paint sand filter on the lower downstream slope, or lower the water with a drain.' : 'The water rises at the toe: a cutoff makes its path longer and gentler, and filter at the toe holds the sand down.');
    }
    rows.push(['Pipes', pc, pc === 'ok' ? 'Safe' : pc === 'warn' ? 'Marginal' : 'Risk', pipeTxt]);
    // sliding
    let slideTxt = 'No admissible slip surface was found.', sc = 'neutral', sword = '–';
    if (sr && sr.critical && isFinite(sr.fos)) {
      const cr = sr.critical, f = sr.fos;
      sc = fosClass(f, st.side);
      const target = up ? 1.2 : 1.5;
      sword = sc === 'ok' ? 'Stable' : sc === 'warn' ? 'Low margin' : f < 1 ? 'Slides' : 'Likely';
      const where = cr.kind === 'block' ? 'a block that slides along the weak clay layer' : `a curved surface through ${andList(surfaceMaterials(cr))}, ${n1(cr.depth)} m deep at most`;
      const state = f < 1 ? 'it would slide' : f < (up ? 1.0 : 1.2) ? 'it would likely slide, with almost no margin' : f < target ? `it stands, but below the usual ${target}` : 'it holds with a sensible margin';
      slideTxt = `The weakest slip surface is ${where}. Its factor of safety is ${f.toFixed(2)}: ${state}.`;
      if (cr.ru > 0.08) {
        slideTxt += ` Water pressure on that surface carries ${Math.round(cr.ru * 100)}% of the weight of the soil above it, so the grains press together with only ${Math.round((1 - cr.ru) * 100)}% of their weight and friction drops with it. Without that water pressure the same surface would have a factor of safety of ${cr.fosNoWater.toFixed(2)}.`;
      } else slideTxt += ' Very little water pressure acts on it, so the grip comes from the full weight of the grains.';
      if (sc !== 'ok') {
        if (cr.kind === 'block') tips.push('The slide runs along the weak layer, which painting can\'t strengthen. Flatten the downstream slope so more weight bears on the layer beyond the toe.');
        else if (up) tips.push('After a fast drawdown the water trapped in clay and fill pushes the upstream slope out. Free-draining rockfill on the upstream face drains as the reservoir falls.');
        else if (cr.ru > 0.15) tips.push('Try a drain: a strip of sand filter inside the downstream half, joined to a layer along the base out to the toe, lets the water out before it reaches the slope.');
        else tips.push('The water is not the main problem here: the slope is too steep for this material. Flatten it, or use stronger rockfill in the downstream shell.');
      }
    }
    rows.push([up ? 'Slides (upstream)' : 'Slides', sc, sword, slideTxt]);
    // headline
    const worst = rows.map(r => r[1]).includes('bad') ? 'bad' : rows.map(r => r[1]).includes('warn') ? 'warn' : 'ok';
    const fails = rows.filter(r => r[1] === 'bad').map(r => r[0].toLowerCase().replace(' (upstream)', ''));
    const head = worst === 'ok' ? 'Your dam holds.' : worst === 'warn' ? 'Your dam stands, with too little margin somewhere.' : 'Your dam fails: it ' + andList(fails.map(x => x === 'leaks' ? 'leaks too much' : x === 'pipes' ? 'risks piping' : 'slides')) + '.';
    let html = `<p class="bd-head ${worst}">${head}</p><div class="bd-rows">`;
    rows.forEach(r => { html += `<div class="bd-row"><div class="bd-k">${r[0]} ${pill(r[1], r[2])}</div><p>${r[3]}</p></div>`; });
    html += '</div>';
    if (tips.length) html += `<div class="bd-tip"><b>What to try</b><ul>${tips.slice(0, 2).map(t => '<li>' + t + '</li>').join('')}</ul></div>`;
    if (!result.seep.stats.converged) html += '<p class="note">The seepage iteration stopped before it fully settled, so treat these numbers as approximate.</p>';
    $('#bd-verdict').innerHTML = html;
  }

  // ---------------------------------------------------------------- missions
  const tabs = $$('#bd-tabs button');
  const missionEl = $('#bd-mission');
  let done = {};
  try { done = JSON.parse(localStorage.getItem('dams-build-missions') || '{}') || {}; } catch (e) { done = {}; }
  tabs.forEach(t => t.addEventListener('click', () => selectMission(t.dataset.m)));
  function selectMission(id) {
    st.mission = id; hintsShown = 0;
    tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.m === id ? 'true' : 'false'));
    const m = missionDef();
    if (m) {
      pushUndo();
      Object.assign(st, { slope: m.start.slope, foundation: m.start.foundation, cutoff: m.start.cutoff, reservoir: m.start.reservoir });
      applyPreset(m.start.preset);
      st.slope = m.start.slope; st.reservoir = m.start.reservoir;
    }
    syncControls(); changed();
  }
  function updateMission() {
    const m = missionDef();
    tabs.forEach(t => t.classList.toggle('bd-done', !!done[t.dataset.m]));
    if (!m) {
      missionEl.innerHTML = '<p class="bd-brief">Paint anything you like and test it. Pick a mission above for a brief with targets to hit.</p>';
      return;
    }
    const T = MISSION_TEXT[m.id];
    const fresh = result && !stale();
    const live = liveCounts();
    const mm = fresh ? result.m : null;
    const check = fresh ? API.missionCheck(m, mm) : null;
    const items = Object.keys(GOAL_TEXT).filter(k => {
      const g = m.goals;
      return (k === 'q' && g.maxQ != null) || (k === 'pipe' && g.minPipe != null) || (k === 'fos' && g.minFoS != null) || (k === 'clay' && g.maxClay != null) || (k === 'tsand' && g.minTsand != null);
    }).map(k => {
      let state = 'pending', now = '';
      if (LIVE_GOALS[k]) {
        const v = k === 'clay' ? live.clay : live.tsandFrac;
        const ok = k === 'clay' ? v <= m.goals.maxClay : v >= m.goals.minTsand;
        state = ok ? 'ok' : 'bad'; now = k === 'clay' ? `now ${fmt(v)}` : `now ${Math.round(v * 100)}%`;
      } else if (check) {
        const c = check.checks.find(x => x.key === k);
        state = c.ok ? 'ok' : 'bad';
        now = k === 'q' ? `now ${fmtL(mm.qLday)}` : k === 'pipe' ? `now ${!isFinite(mm.pipe) || mm.pipe > 50 ? '> 50' : mm.pipe.toFixed(1)}` : `now ${mm.fos.toFixed(2)}`;
      } else now = 'test to check';
      const mark = state === 'ok' ? '✓' : state === 'bad' ? '✗' : '·';
      return `<li class="bd-g ${state}"><span class="bd-mark" aria-hidden="true">${mark}</span>${GOAL_TEXT[k](m.goals)} <small>${now}</small></li>`;
    });
    const passed = check && check.ok;
    if (passed && !done[m.id]) { done[m.id] = true; try { localStorage.setItem('dams-build-missions', JSON.stringify(done)); } catch (e) { /* private mode */ } }
    tabs.forEach(t => t.classList.toggle('bd-done', !!done[t.dataset.m]));
    const lockTxt = m.lock.filter(k => k !== 'reservoir').map(k => k === 'slope' ? 'the slope' : 'the foundation');
    let html = `<p class="bd-brief"><b>${T.title}.</b> ${T.brief}</p><ul class="bd-goals">${items.join('')}</ul>`;
    html += `<p class="bd-locks note">Fixed in this mission: ${andList(lockTxt.concat(['the reservoir level']))}.</p>`;
    if (passed) html += `<p class="bd-success">${pill('ok', 'Mission complete')} ${T.done}</p>`;
    else {
      for (let k = 0; k < hintsShown; k++) html += `<p class="bd-hint"><b>Hint ${k + 1}.</b> ${T.hints[k]}</p>`;
      html += '<div class="controls">' + (hintsShown < T.hints.length ? `<button class="btn" type="button" id="bd-hintbtn">${hintsShown ? 'Another hint' : 'Hint'}</button>` : '') + '<button class="btn" type="button" id="bd-restart">Start the mission again</button></div>';
    }
    missionEl.innerHTML = html;
    const hb = $('#bd-hintbtn'); if (hb) hb.addEventListener('click', () => { hintsShown++; updateMission(); const nb = $('#bd-hintbtn'); (nb || $('#bd-restart')).focus(); });
    const rb = $('#bd-restart'); if (rb) rb.addEventListener('click', () => selectMission(m.id));
  }

  // ---------------------------------------------------------------- tutor
  function zoneSentence() {
    const regions = [['upstream part', x => x < -8], ['middle (under the crest)', x => x >= -8 && x <= 8], ['downstream part', x => x > 8]];
    const parts = regions.map(([name, f]) => {
      const cnt = new Array(MAT.length).fill(0); let n = 0;
      for (let i = 0; i < NX; i++) for (let j = 15; j < NZ; j++) { const x = cx(i); if (!inDam(x, cz(j), st.slope) || !f(x)) continue; cnt[st.cells[i * NZ + j]]++; n++; }
      const list = cnt.map((c, k) => [k, c / (n || 1)]).filter(e => e[1] >= 0.1).sort((a, b) => b[1] - a[1]).map(e => `${MAT[e[0]].name.toLowerCase()} ${Math.round(e[1] * 100)}%`);
      return `${name}: ${list.join(', ') || 'empty'}`;
    });
    const lc = liveCounts();
    let drain = lc.drain ? ` Sand filter/drain cells: ${lc.drain} m².` : ' No drain material.';
    if (result && !stale() && result.seep.custom) {
      const c = result.seep.custom;
      if (lc.drain) drain += ` ${c.freeDrainCells} m² of it is joined to the toe at the base and drains freely; ${c.soilDrainCells} m² has no free outlet and acts as permeable soil.`;
    }
    return 'Zones (share of each part of the dam): ' + parts.join('; ') + '.' + drain;
  }
  tutorRegister('fig-build', {
    title: 'Build your own dam',
    describe: () => {
      const lines = [];
      const m = missionDef();
      lines.push(m ? `Mission: ${MISSION_TEXT[m.id].title}. ${MISSION_TEXT[m.id].brief}` : 'Free build (no mission).');
      lines.push(zoneSentence());
      lines.push(`Settings: foundation ${FOUND[st.foundation].toLowerCase()}; cutoff ${st.cutoff === 'none' ? 'none' : st.cutoff === 'partial' ? 'half depth' : 'full depth'}; downstream slope ${st.slope}:1 (upstream fixed at 2:1); reservoir ${n1(st.reservoir * CREST)} m of the 24 m dam height. Clay used ${liveCounts().clay} m³ per metre.`);
      if (!result) { lines.push('The reader has not tested this design yet.'); return lines.join('\n'); }
      if (stale()) lines.push('The design has changed since the last test; the results below are for the previous version.');
      const r = result.m, d = result.stab.downstream, u = result.stab.upstream, seep = result.seep;
      lines.push(`Seepage ${fmtL(r.qLday)} L/day per metre (drains ${fmtL(r.qDrainLday)}, slope face ${fmtL(r.qFaceLday)}, ground beyond toe ${fmtL(r.qGroundLday)}). Max exit gradient ${r.iExit.toFixed(2)} ${r.iExit > 0.005 ? (r.exitWhere === 'face' ? 'on the downstream slope' : 'at the ground beyond the toe') : '(all exits filtered)'}; safety against piping ${!isFinite(r.pipe) || r.pipe > 50 ? 'over 50' : r.pipe.toFixed(2)}. ${seep.seepageFace.present ? 'Water breaks out on the downstream slope up to ' + n1(seep.seepageFace.topZ) + ' m.' : 'The water stays inside the dam (no seepage face).'}`);
      const sl = (x, name) => {
        if (!x || !x.critical) return `${name}: no slip surface found.`;
        const c = x.critical;
        return `${name}: factor of safety ${x.fos.toFixed(2)} (${x.method}), ${c.kind === 'block' ? 'a block sliding along the weak clay layer' : 'circle through ' + andList(surfaceMaterials(c)) + ', up to ' + n1(c.depth) + ' m deep, from x = ' + n1(c.entry[0]) + ' m to ' + n1(c.exit[0]) + ' m'}; water pressure carries ${Math.round(c.ru * 100)}% of the slices' weight on that surface; without water pressure the same surface would have FoS ${c.fosNoWater.toFixed(2)}.`;
      };
      lines.push(sl(d, 'Downstream slope, full reservoir, steady seepage') + ' ' + sl(u, 'Upstream slope after a rapid drawdown to empty'));
      const verdictEl = $('.bd-head', root);
      if (verdictEl) lines.push('Verdict shown: ' + verdictEl.textContent + (m ? (API.missionCheck(m, r).ok ? ' Mission passed.' : ' Mission not yet passed.') : ''));
      return lines.join('\n');
    }
  });

  // ---------------------------------------------------------------- start
  applyPreset('homogeneous');
  matInfo(); syncControls(); drawStatic(); drawCells(); updateMission();
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) root.classList.add('bd-coarse');
  // phones: open with the downstream half of the dam in view
  let userScrolled = false;
  const wrap = $('#bd-wrap');
  const frame = () => { if (!userScrolled && wrap.scrollWidth > wrap.clientWidth + 10) wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) * 0.7; };
  wrap.addEventListener('scroll', () => { if (wrap.scrollLeft > 0 && Math.abs(wrap.scrollLeft - (wrap.scrollWidth - wrap.clientWidth) * 0.7) > 2) userScrolled = true; });
  F.onFirst = frame;
  requestAnimationFrame(frame); setTimeout(frame, 400);
  window.addEventListener('resize', frame);
  // test harness: ?bd=preset:drained,mission:dry,side:upstream,test  (with #build to scroll there)
  const qa = (location.search.match(/[?&]bd=([^&]+)/) || [])[1];
  if (qa) {
    const o = {}; decodeURIComponent(qa).split(',').forEach(kv => { const p = kv.split(':'); o[p[0]] = p[1] == null ? true : p[1]; });
    if (o.mission) selectMission(o.mission);
    if (o.preset) { applyPreset(o.preset); }
    if (o.slope) { const old = st.slope; st.slope = +o.slope; reslope(old, st.slope); }
    if (o.found) st.foundation = o.found;
    if (o.cutoff) st.cutoff = o.cutoff;
    if (o.side) { st.side = o.side; setSeg('#bd-side', o.side); }
    syncControls(); changed();
    if (o.test) setTimeout(test, 200);
    const go = () => { document.documentElement.style.scrollBehavior = 'auto'; (o.at === 'fig' ? root : $('#build')).scrollIntoView(); };
    setTimeout(go, 50); setTimeout(go, 3000);
  }
})();
