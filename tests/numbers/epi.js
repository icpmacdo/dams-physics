/* The Epilogue's own number keys (book/SPEC.md E).
 *
 * Example E.1 (ex-epilogue-ru) is illustrative: what a rise in the piezometers along our dam's critical slip
 * circle costs its factor of safety. It uses the straight line of Bishop and Morgenstern (1960),
 * FS ≈ FS₀ − n·r_u, through the two points Chapter 12 gives for the workbench's homogeneous dam on clay
 * (the critical circle with its water, and the same circle with none), and checks the line against the
 * solver's own Bishop sum on that circle with every slice's water pressure raised by the same amount.
 *
 * The slices are rebuilt from the critical circle exactly as the solver builds them (stability-solver.js
 * buildSlices: base inclination from the chord of each slice, l = b / cos α, c′ and tan φ′ from the material
 * under the slice's base), and the rebuilt sum reproduces the solver's 1.116 and 1.741.
 *
 * Testalinden: the reservoir held about 29 acre-feet at the top of the crest (ASDSO case study); an
 * acre-foot is 43,560 cubic feet, 1,233.48 m³. Mount Polley released 21 to 25 million m³ (Chief Inspector of
 * Mines 2015, p. 13). */
'use strict';
const ACRE_FT_M3 = 43560 * 0.3048 ** 3;   // 1,233.48 m³
const TESTA_ACRE_FT = 29;                 // ASDSO case study: reservoir volume at the top of the crest
const POLLEY_LO_M3 = 21e6;                // Chief Inspector of Mines (2015), p. 13
const DRU = 0.1;                          // the example's step in r_u
const BENCH = { preset: 'homogeneous', slope: '2', found: 'clay', cut: 'none', res: '0.85' };
const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;   // a number as the page prints it

function design(a) { return { preset: a.preset, slope: +a.slope, found: a.found, cut: a.cut, res: +a.res }; }
// the critical downstream circle's slices, rebuilt with everything Bishop's sum needs
function slices(a, X) {
  const d = design(a), c = X.bench(d).crit, F = X.ST.BUILD.foundations[d.found];
  const mats = X.ST.BUILD.materials.slice(); mats.push(F); if (F.layer) mats.push(F.layer);
  const base = x => c.zc - Math.sqrt(c.R * c.R - (x - c.xc) * (x - c.xc));
  return c.slices.map(s => {
    const al = Math.atan2(base(s.x - s.b / 2) - base(s.x + s.b / 2), s.b), m = mats[s.mat];
    return { x: s.x, b: s.b, W: s.W, u: s.u, alpha: al, l: s.b / Math.cos(al), c: m.c, tphi: Math.tan(m.phi * X.deg), mat: s.mat };
  });
}
const sumWb = (a, X) => { let w = 0, b = 0; for (const s of slices(a, X)) { w += s.W; b += s.b; } return w / b; };
// Bishop's factor of safety on the same circle with every slice's water pressure raised by du kPa
const fsRaised = (a, X, du) => X.ST.bishop(slices(a, X).map(s => Object.assign({}, s, { u: s.u + du }))).F;
const nLine = (a, X) => { const m = X.bench(design(a)); return (m.crit.fosNoWater - m.m.fos) / m.crit.ru; };

module.exports = {
  'epi.fs-drop': { args: BENCH, doc: 'what the water costs the critical circle: FS with no water pressure − FS with it', f: (a, X) => { const m = X.bench(design(a)); return m.crit.fosNoWater - m.m.fos; } },
  'epi.n': { args: BENCH, doc: 'slope of the straight line FS = FS₀ − n·r_u through the circle with and without its water', f: (a, X) => nLine(a, X) },
  'epi.dfs': { args: BENCH, doc: 'factor of safety lost for a rise of 0.1 in r_u, n × 0.1', f: (a, X) => nLine(a, X) * DRU },
  'epi.wb-kpa': { args: BENCH, doc: 'the slices’ weight per square metre of base, ΣW ÷ Σb, on the critical circle, kPa', f: (a, X) => sumWb(a, X) },
  'epi.du-kpa': { args: BENCH, doc: 'rise in water pressure that adds 0.1 to r_u: 0.1 × ΣW/Σb, kPa', f: (a, X) => DRU * r(sumWb(a, X), 1) },
  'epi.rise-m': { args: BENCH, doc: 'that rise as metres of water in a piezometer, Δu ÷ 9.81', f: (a, X) => r(DRU * r(sumWb(a, X), 1), 2) / X.G.G_W },
  'epi.fs-line': { args: BENCH, doc: 'the straight line’s prediction after the rise: FS − n × 0.1', f: (a, X) => X.bench(design(a)).m.fos - nLine(a, X) * DRU },
  'epi.fs-rise': { args: BENCH, doc: 'Bishop’s sum on the same circle with every slice’s water pressure raised by the Δu above', f: (a, X) => fsRaised(a, X, r(DRU * r(sumWb(a, X), 1), 2)) },
  'epi.rebuilt': { args: BENCH, doc: 'Bishop’s sum on the rebuilt slices with no change (must equal bench.fos)', f: (a, X) => fsRaised(a, X, 0) },

  // Question: an alarm level for the drained dam (Fill + drain), using the straight line, then the full sum
  'epi.alarm-dfs': { doc: 'the drained dam’s margin above 1.5', f: (a, X) => r(X.bench({ preset: 'drained' }).m.fos, 3) - 1.5 },
  'epi.alarm-dru': { doc: 'that margin as r_u, with the homogeneous dam’s n: 0.128 ÷ 1.77', f: (a, X) => r(r(X.bench({ preset: 'drained' }).m.fos, 3) - 1.5, 3) / r(nLine(BENCH, X), 2) },
  'epi.alarm-du': { doc: 'as water pressure, × the drained circle’s ΣW/Σb, kPa', f: (a, X) => r(r(r(X.bench({ preset: 'drained' }).m.fos, 3) - 1.5, 3) / r(nLine(BENCH, X), 2), 4) * r(sumWb(Object.assign({}, BENCH, { preset: 'drained' }), X), 1) },
  'epi.alarm-m': { doc: 'as metres of water in a piezometer', f: (a, X) => { const du = r(r(r(X.bench({ preset: 'drained' }).m.fos, 3) - 1.5, 3) / r(nLine(BENCH, X), 2), 4) * r(sumWb(Object.assign({}, BENCH, { preset: 'drained' }), X), 1); return r(du, 2) / X.G.G_W; } },
  'epi.alarm-m-full': { doc: 'the rise that takes the drained dam’s circle to 1.5 in Bishop’s full sum (bisection), m', f: (a, X) => {
    const A = Object.assign({}, BENCH, { preset: 'drained' }), g = h => fsRaised(A, X, h * X.G.G_W) - 1.5;
    let lo = 0, hi = 3; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m; } return (lo + hi) / 2; } },

  // Fig. E.2: the drained dam's instruments, read from the solver
  'epi.head-a-m': { doc: 'head at piezometer A’s tip (the cell from x = −8 to −7 m, z = 4 to 5 m) in the drained dam, m above the base', f: (a, X) => {
    const s = X.bench({ preset: 'drained' }).seep, i = Math.floor((-7.5 - s.x0) / s.dx), j = Math.floor((4.5 - s.z0) / s.dx); return s.h[i * s.nz + j]; } },
  'epi.ph-a-m': { doc: 'the water level inside the drained dam above piezometer A (x = −7.5 m), m above the base', f: (a, X) => {
    const ph = X.bench({ preset: 'drained' }).seep.phreatic; for (let k = 1; k < ph.length; k++) if (ph[k][0] >= -7.5) { const p = ph[k - 1], q = ph[k]; return p[1] + (q[1] - p[1]) * (-7.5 - p[0]) / (q[0] - p[0]); } return NaN; } },
  'epi.incl-depth-m': { args: { x: '34' }, doc: 'depth of the drained dam’s critical slip below the downstream slope at the inclinometer, m', f: (a, X) => {
    const c = X.bench({ preset: 'drained' }).crit, x = +a.x; return (24 - (x - 3) / 2) - (c.zc - Math.sqrt(c.R * c.R - (x - c.xc) * (x - c.xc))); } },

  'epi.crest-m': { doc: 'our dam’s height in the workbench, m', f: (a, X) => X.ST.buildRequest({ cells: [], slope: 2, foundation: 'clay', reservoir: 0.85 }).stab.geom.crestZ },
  'epi.res-m3': { doc: 'Testalinden’s reservoir full to the crest, 29 acre-feet in m³', f: () => TESTA_ACRE_FT * ACRE_FT_M3 },
  'epi.polley-ratio': { doc: 'Mount Polley’s lowest estimate of the release ÷ Testalinden’s full reservoir', f: () => POLLEY_LO_M3 / (TESTA_ACRE_FT * ACRE_FT_M3) }
};
