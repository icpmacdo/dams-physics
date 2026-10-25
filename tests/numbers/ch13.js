/* Chapter 13's own number keys (book/SPEC.md E). Workbench runs come from X.bench (the same solvers the
 * page runs); a few designs that no preset gives (the tailings mission's answer, a thin clay core) are
 * built here cell by cell, as tests/test-stability.js builds them. Numbers from the literature that the
 * chapter does arithmetic with are named constants below, each with its source; the chapter carries the
 * same Source notes. */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', '..', 'src');
const { solveSeepage } = require(path.join(SRC, 'seepage-solver.js'));

// ---- literature constants (Source notes in the chapter)
const SU_RATIO = 0.24;    // polley2015, Table 5.3.1 (p. 49): average peak undrained strength ratio of the Upper GLU, all DSS tests
const SU_SOFT = 0.13;     // polley2015, p. 98: after strain weakening "perhaps 0.13"
const DESIGN_PHI = 28;    // polley2015, p. 69: the peak effective-stress friction angle the 2011 design checks gave the GLU
const PANEL_H = 40;       // polley2015, p. 75: "almost 40 m" high at the breach
const USBR_FRAC = 1 / 3;  // usbr1987, p. 190: seepage reaches "roughly one-third the depth of the reservoir pool"

const BENCH = { preset: 'homogeneous', slope: '2', found: 'clay', cut: 'none', res: '0.85', uprock: 'none' };
const run = (a, X) => X.bench(a);
const fos = (X, d) => X.bench(d || {}).m.fos;
const tan = d => Math.tan(d * Math.PI / 180);

// the stability solver's clay-core outline (the 'cored' preset): read from the code, not copied
const ST_SRC = fs.readFileSync(path.join(SRC, 'stability-solver.js'), 'utf8');
const CORE_W = (() => { const m = ST_SRC.match(/function coreW\(z\) \{ return ([^;]+); \}/); if (!m) throw new Error('coreW not found in stability-solver.js'); return new Function('z', 'return ' + m[1] + ';'); })();
const CORE_TOP = (() => { const m = ST_SRC.match(/function inCore\(x, z\) \{ return z <= (\d+(?:\.\d+)?) &&/); if (!m) throw new Error('inCore not found'); return +m[1]; })();

// designs no preset gives
const custom = new Map();
function design(name, X) {
  if (custom.has(name)) return custom.get(name);
  const ST = X.ST;
  let cells, slope = 2, found = 'clay', cut = 'none';
  if (name === 'tailings') {           // the tailings mission's answer: the drained preset at 2.5:1, every fill cell tailings sand
    slope = 2.5; cells = ST.presetCells('drained', slope);
    const ts = ST.BUILD.materials.findIndex(m => m.key === 'tsand');
    for (let q = 0; q < cells.length; q++) if (cells[q] === 0) cells[q] = ts;
  } else if (name === 'thin') {        // all rockfill, a clay wall 2 m wide up the middle to the core's top, full cutoff, on gravel
    cells = ST.presetCells('leaky', slope); found = 'gravel'; cut = 'full';
    const clay = ST.BUILD.materials.findIndex(m => m.key === 'clay');
    for (let i = 0; i < 170; i++) for (let j = 15; j < 39; j++) { const x = -80 + i + 0.5, z = -15 + j + 0.5; if (Math.abs(x) < 1 && z <= CORE_TOP) cells[i * 39 + j] = clay; }
  } else if (name === 'skin') {        // a 5 m skin of rockfill on the upstream face of the dam of fill (as test-stability.js paints it)
    cells = ST.presetCells('homogeneous', slope);
    const rock = ST.BUILD.materials.findIndex(m => m.key === 'rock'), upFace = z => -3 - 2 * (24 - z);
    for (let i = 0; i < 170; i++) for (let j = 15; j < 39; j++) { const x = -80 + i + 0.5, z = -15 + j + 0.5; if (x < upFace(z) + 5) cells[i * 39 + j] = rock; }
  } else throw new Error('no design ' + name);
  const r = ST.runDesign({ cells, slope, foundation: found, cutoff: cut, reservoir: 0.85 }, { solveSeepage });
  const out = { r, m: ST.designMetrics(r.seep, r.stab) };
  custom.set(name, out);
  return out;
}

// cost against safety: the three fixes of pr-build, as cubic metres changed and factor of safety gained
const FIX = { s25: { slope: 2.5 }, s3: { slope: 3 }, drain: { preset: 'drained' } };
const gain = (fix, X) => fos(X, FIX[fix]) - fos(X);
const changed = (fix, X) => fix === 'drain'
  ? (() => { const s = X.bench(FIX.drain).seep; let n = 0; for (let i = 0; i < s.mat.length; i++) if (s.mat[i] >= 10 && X.ST.BUILD.materials[s.mat[i] - 10].key === 'filter') n++; return n; })()
  : X.bench(FIX[fix]).m.damCells - X.bench({}).m.damCells;
const per100 = (fix, X) => 100 * gain(fix, X) / changed(fix, X);

module.exports = {
  // ---- the weak layer of mission 5
  'ch13.tan': { args: { a: '19' }, doc: 'tan of an angle in degrees', f: a => tan(+a.a) },
  'ch13.layer-phi-deg': { doc: 'the weak layer’s friction angle, degrees', f: (a, X) => X.ST.BUILD.foundations.weak.layer.phi },
  'ch13.layer-c-kpa': { doc: 'the weak layer’s cohesion, kPa', f: (a, X) => X.ST.BUILD.foundations.weak.layer.c },
  'ch13.found-phi-deg': { doc: 'the clay foundation’s friction angle, degrees', f: (a, X) => X.ST.BUILD.foundations.clay.phi },
  'ch13.found-c-kpa': { doc: 'the clay foundation’s cohesion, kPa', f: (a, X) => X.ST.BUILD.foundations.clay.c },
  'ch13.layer-frac': { doc: 'the weak layer’s friction (tan φ′) as a fraction of the clay foundation’s', f: (a, X) => tan(X.ST.BUILD.foundations.weak.layer.phi) / tan(X.ST.BUILD.foundations.clay.phi) },
  'ch13.layer-cut-pct': { doc: 'how much less friction the layer has for the same press, %', f: (a, X) => 100 * (1 - tan(X.ST.BUILD.foundations.weak.layer.phi) / tan(X.ST.BUILD.foundations.clay.phi)) },
  'ch13.layer-share': { args: { edge: 'top' }, doc: 'depth of the weak layer’s top (or bottom) below the ground, as a share of the dam’s height', f: (a, X) => {
    const L = X.ST.BUILD.foundations.weak.layer, h = X.ST.buildRequest({ slope: 2, foundation: 'weak' }).stab.geom.crestZ;
    return -(a.edge === 'bottom' ? L.zBottom : L.zTop) / h; } },
  'ch13.layer-depth-m': { args: { edge: 'top' }, doc: 'depth of the weak layer’s top or bottom below the ground, m', f: (a, X) => -(a.edge === 'bottom' ? X.ST.BUILD.foundations.weak.layer.zBottom : X.ST.BUILD.foundations.weak.layer.zTop) },
  'ch13.panel-share': { args: { d: '8' }, doc: 'a depth below the original ground as a share of the panel’s 40 m dam (literature inputs)', f: a => +a.d / PANEL_H },
  'ch13.circle-fos': { args: BENCH, doc: 'the weakest circle alone (Bishop), downstream', f: (a, X) => run(a, X).stab.downstream.circleFos },

  // ---- drained against undrained (the panel's numbers)
  'ch13.ud-frac': { doc: 'the Upper GLU’s average undrained strength ratio over the design’s drained tan 28°', f: () => SU_RATIO / tan(DESIGN_PHI) },
  'ch13.tau-kpa': { args: { line: 'd', s: '600' }, doc: 'strength at effective stress s on a level surface: d drained (tan 28°), w the workbench stand-in (tan of its layer angle), u undrained (0.24 s), r after strain weakening (0.13 s)', f: (a, X) => {
    const s = +a.s;
    if (a.line === 'd') return s * tan(DESIGN_PHI);
    if (a.line === 'w') return s * tan(X.ST.BUILD.foundations.weak.layer.phi);
    if (a.line === 'u') return s * SU_RATIO;
    if (a.line === 'r') return s * SU_SOFT;
    throw new Error('no line ' + a.line); } },

  // ---- the one-third rule
  'ch13.third-m': { args: { r: '0.85' }, doc: 'one third of the reservoir depth (USBR’s rule of thumb), m', f: a => 24 * +a.r * USBR_FRAC },
  'ch13.face-ratio': { args: { r: '0.85' }, doc: 'the solver’s breakout height over the reservoir depth', f: (a, X) => X.bench({ res: a.r }).m.seepageFaceTop / (24 * +a.r) },

  // ---- cost against safety
  'ch13.gain': { args: { fix: 's25' }, doc: 'factor of safety gained by a fix, over the homogeneous dam’s', f: (a, X) => gain(a.fix, X) },
  'ch13.changed-m3': { args: { fix: 's25' }, doc: 'cubic metres of the section a fix adds (s25, s3) or swaps for filter sand (drain), per metre of dam', f: (a, X) => changed(a.fix, X) },
  'ch13.per100': { args: { fix: 's25' }, doc: 'factor of safety gained per 100 m³ changed', f: (a, X) => per100(a.fix, X) },
  'ch13.step-m3': { doc: 'fill added going from 2.5:1 to 3:1, m³ per metre', f: (a, X) => X.bench(FIX.s3).m.damCells - X.bench(FIX.s25).m.damCells },
  'ch13.step-gain': { doc: 'factor of safety gained going from 2.5:1 to 3:1', f: (a, X) => fos(X, FIX.s3) - fos(X, FIX.s25) },
  'ch13.per100-step': { doc: 'that second step’s gain per 100 m³', f: (a, X) => 100 * (fos(X, FIX.s3) - fos(X, FIX.s25)) / (X.bench(FIX.s3).m.damCells - X.bench(FIX.s25).m.damCells) },
  'ch13.per100-ratio': { doc: 'the drain’s gain per 100 m³ over the 2.5:1 slope’s', f: (a, X) => per100('drain', X) / per100('s25', X) },
  'ch13.drain-leak-ratio': { doc: 'the drained dam’s leak over the homogeneous dam’s', f: (a, X) => X.bench(FIX.drain).m.qLday / X.bench({}).m.qLday },

  // ---- hold the water
  'ch13.split-pct': { args: Object.assign({ way: 'through' }, BENCH), doc: 'share of the leak passing through the dam (way=through) or under it (way=under), across the line under the crest, %', f: (a, X) => {
    const q = run(a, X).seep.q, t = Math.max(0, q.passThroughDam), u = Math.max(0, q.passUnderDam);
    return 100 * (a.way === 'under' ? u : t) / (t + u); } },
  'ch13.core-frac': { doc: 'leak of the cored dam over the all-rockfill dam, both on sand and gravel', f: (a, X) => X.bench({ preset: 'cored', found: 'gravel' }).m.qLday / X.bench({ preset: 'leaky', found: 'gravel' }).m.qLday },
  'ch13.cut-frac': { doc: 'leak with a full cutoff over the leak without, cored dam on sand and gravel', f: (a, X) => X.bench({ preset: 'cored', found: 'gravel', cut: 'full' }).m.qLday / X.bench({ preset: 'cored', found: 'gravel' }).m.qLday },
  'ch13.cut-under-pct': { doc: 'share of the cored dam’s leak that the cutoff stopped, %', f: (a, X) => 100 * (1 - X.bench({ preset: 'cored', found: 'gravel', cut: 'full' }).m.qLday / X.bench({ preset: 'cored', found: 'gravel' }).m.qLday) },
  'ch13.core-w-m': { args: { z: '0' }, doc: 'width of the cored preset’s clay core at height z, m (from coreW in the solver)', f: a => 2 * CORE_W(+a.z) },
  'ch13.core-half-m': { args: { z: '0' }, doc: 'half-width of the core at height z, m', f: a => CORE_W(+a.z) },
  'ch13.core-h-m': { doc: 'height of the core’s top above the base, m', f: () => CORE_TOP },
  'ch13.core-mean-m': { doc: 'mean width of the core (a trapezoid), m', f: () => (2 * CORE_W(0) + 2 * CORE_W(CORE_TOP)) / 2 },
  'ch13.core-m3': { doc: 'area of the core’s smooth outline, m³ per metre of dam', f: () => (2 * CORE_W(0) + 2 * CORE_W(CORE_TOP)) / 2 * CORE_TOP },

  // ---- designs no preset gives
  'ch13.tail-q-lday': { doc: 'the tailings mission’s answer: leak, L/day per metre', f: (a, X) => design('tailings', X).m.qLday },
  'ch13.tail-fos': { doc: 'the tailings mission’s answer: downstream factor of safety', f: (a, X) => design('tailings', X).m.fos },
  'ch13.tail-pct': { doc: 'the tailings mission’s answer: share of the dam in tailings sand, %', f: (a, X) => 100 * design('tailings', X).m.tsandFrac },
  'ch13.skin-fos-up': { doc: 'the dam of fill with a 5 m skin of rockfill on its upstream face: upstream factor of safety after a fast drawdown', f: (a, X) => design('skin', X).m.fosUp },
  'ch13.goal-pct': { args: { mission: 'tailings' }, doc: 'a mission’s minimum share of tailings sand, %', f: (a, X) => 100 * X.ST.BUILD.missions.find(m => m.id === a.mission).goals.minTsand },
  'ch13.thin-q-lday': { doc: 'a 2 m clay wall in rockfill with a full cutoff, on gravel: leak, L/day per metre', f: (a, X) => design('thin', X).m.qLday },
  'ch13.thin-clay-m3': { doc: 'the same design: clay used, m³ per metre', f: (a, X) => design('thin', X).m.clay },
  'ch13.thin-fos': { doc: 'the same design: downstream factor of safety', f: (a, X) => design('thin', X).m.fos },
  'ch13.thin-i': { doc: 'average gradient across the 2 m wall: the reservoir depth over its width', f: (a, X) => 24 * X.BENCH0.res / 2 }
};
