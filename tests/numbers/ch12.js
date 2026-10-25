/* Chapter 12's own number keys (book/SPEC.md E). Everything here is computed from the workbench's
 * solver (X.bench, the homogeneous dam on clay unless an argument says otherwise) or from its
 * material table; nothing is typed in.
 *
 * The hand calculation of slice 13 (Example ex-slope-slice) is keyed twice: the "hand" keys redo each
 * printed line from the givens rounded as the page prints them (so a reader with a calculator gets
 * exactly the printed result), and the "-exact" keys are the solver's own values, carried to every
 * digit, which the example's Check quotes. */
'use strict';

const r = (v, d) => { const p = 10 ** d; return Math.sign(v) * Math.round(Math.abs(v) * p + 1e-9) / p; };

// the materials the solver uses on a slice's base: the dam's, then the foundation's
function matOf(X, found, i) {
  const M = X.ST.BUILD.materials;
  return i < M.length ? M[i] : X.ST.BUILD.foundations[found || 'clay'];
}
// the critical circle's slices with the solver's own base angle (the chord of the circle across the
// slice, as stability-solver.js buildSlices computes it), length and strength
function slices(X, d) {
  const b = X.bench(d || {}), c = b.crit;
  const base = x => c.zc - Math.sqrt(c.R * c.R - (x - c.xc) * (x - c.xc));
  return c.slices.map(s => {
    const alpha = Math.atan2(base(s.x - s.b / 2) - base(s.x + s.b / 2), s.b), m = matOf(X, (d || {}).found, s.mat);
    return Object.assign({}, s, { alpha, l: s.b / Math.cos(alpha), c: m.c, tphi: Math.tan(m.phi * X.deg) });
  });
}
// one Bishop pass: the factor of safety the slices return when FS = F is used on the right-hand side
function bishopPass(sl, F) {
  let num = 0, den = 0;
  for (const s of sl) {
    const sa = Math.sin(s.alpha), ca = Math.cos(s.alpha);
    den += s.W * sa;
    let ma = ca + sa * s.tphi / F; if (ma < 0.2) ma = 0.2;
    let Np = (s.W - s.u * s.b - s.c * s.b * Math.tan(s.alpha) / F) / ma; if (Np < 0) Np = 0;
    num += s.c * s.l + Np * s.tphi;
  }
  return { num, den, F: num / den };
}
// slice 13 (index 12), the solver's own numbers
function s13(X) {
  const s = slices(X)[12], F = X.bench({}).m.fos;
  const sa = Math.sin(s.alpha), ca = Math.cos(s.alpha), ta = Math.tan(s.alpha);
  const ma = ca + sa * s.tphi / F, Np = (s.W - s.u * s.b - s.c * s.b * ta / F) / ma;
  return { s, F, sa, ca, ta, ma, Np, grip: s.c * s.l + Np * s.tphi, pull: s.W * sa };
}
// the hand calculation: the givens rounded as printed, each line from the printed lines before it
function hand(X) {
  const e = s13(X);
  const g = { b: r(e.s.b, 3), W: r(e.s.W, 1), u: r(e.s.u, 2), sa: r(e.sa, 4), ca: r(e.ca, 4), ta: r(e.ta, 4), tp: r(e.s.tphi, 4), F: r(e.F, 3), c: e.s.c };
  const h = {};
  h.ub = g.u * g.b;
  h.wub = g.W - r(h.ub, 1);
  h.ct = g.c * g.b * g.ta / g.F;
  h.ma = g.ca + g.sa * g.tp / g.F;
  h.nn = r(h.wub, 1) - r(h.ct, 2);
  h.N = r(h.nn, 1) / r(h.ma, 4);
  h.l = g.b / g.ca;
  h.grip = g.c * r(h.l, 3) + r(h.N, 1) * g.tp;
  h.pull = g.W * g.sa;
  h.ratio = r(h.grip, 1) / r(h.pull, 1);
  // the ordinary method of slices on the same slice (question q-slope-oms)
  h.wcos = g.W * g.ca;
  h.ul = g.u * r(h.l, 3);
  h.oN = r(h.wcos, 1) - r(h.ul, 1);
  h.oGrip = g.c * r(h.l, 3) + r(h.oN, 1) * g.tp;
  return h;
}
const tsandG = X => (X.ST.BUILD.materials.find(m => m.key === 'tsand').gs - 9.81) / X.ST.BUILD.materials.find(m => m.key === 'tsand').gs;
const tan = (deg, X) => Math.tan(deg * X.deg);
const phiOf = (key, X) => X.ST.BUILD.materials.find(m => m.key === key).phi;

module.exports = {
  // ---- the fixes offered in pr-build, as shares of the homogeneous dam's section
  'ch12.fill-25-pct': { doc: 'extra fill for a 2.5:1 downstream slope, % of the 2:1 section', f: (a, X) => 100 * (X.bench({ slope: 2.5 }).m.damCells / X.bench({}).m.damCells - 1) },
  'ch12.fill-3-pct': { doc: 'extra fill for a 3:1 downstream slope, % of the 2:1 section', f: (a, X) => 100 * (X.bench({ slope: 3 }).m.damCells / X.bench({}).m.damCells - 1) },
  'ch12.drain-pct': { doc: 'the drained preset’s filter sand, % of the section', f: (a, X) => {
    const r0 = X.bench({ preset: 'drained' }), s = r0.seep; let n = 0;
    for (let i = 0; i < s.mat.length; i++) if (s.mat[i] >= 10 && X.ST.BUILD.materials[s.mat[i] - 10].key === 'filter') n++;
    return 100 * n / r0.m.damCells; } },
  'ch12.cells-ratio': { args: { slope: '2.5' }, doc: 'cells of the dam at this downstream slope ÷ cells at 2:1', f: (a, X) => X.bench({ slope: +a.slope }).m.damCells / X.bench({}).m.damCells },
  'ch12.drain-frac': { doc: 'the drained preset’s filter cells ÷ the dam’s cells', f: (a, X) => {
    const r0 = X.bench({ preset: 'drained' }), s = r0.seep; let n = 0;
    for (let i = 0; i < s.mat.length; i++) if (s.mat[i] >= 10 && X.ST.BUILD.materials[s.mat[i] - 10].key === 'filter') n++;
    return n / r0.m.damCells; } },
  'ch12.leak-ratio': { doc: 'the drained dam’s leak ÷ the homogeneous dam’s', f: (a, X) => X.bench({ preset: 'drained' }).m.qLday / X.bench({}).m.qLday },
  'ch12.cut-drop-pct': { doc: 'how much a full cutoff cuts the homogeneous dam’s leak on clay, %', f: (a, X) => 100 * (1 - X.bench({ cut: 'full' }).m.qLday / X.bench({}).m.qLday) },

  // ---- the long (infinite) slope, Example ex-slope-infinite and its question
  'ch12.tan-phi-mat': { args: { mat: 'tsand' }, doc: 'tan φ′ of a workbench material', f: (a, X) => tan(phiOf(a.mat, X), X) },
  'ch12.gsub-tsand': { doc: 'tailings sand’s buoyant unit weight, γsat − γw, kN/m³', f: (a, X) => X.ST.BUILD.materials.find(m => m.key === 'tsand').gs - 9.81 },
  'ch12.gratio': { doc: 'γ′/γsat for the tailings sand', f: (a, X) => tsandG(X) },
  'ch12.inf-dry': { args: { n: '2' }, doc: 'long dry slope of tailings sand at n:1, FS = tan φ′ × n', f: (a, X) => tan(phiOf('tsand', X), X) * +a.n },
  'ch12.inf-seep': { args: { n: '2' }, doc: 'the same with water seeping out parallel to the face, × γ′/γsat', f: (a, X) => tan(phiOf('tsand', X), X) * +a.n * tsandG(X) },
  'ch12.inf-rock': { args: { n: '2' }, doc: 'long dry slope of rockfill at n:1', f: (a, X) => tan(phiOf('rock', X), X) * +a.n },
  'ch12.inf-dry-n15': { doc: 'how flat a long dry slope of tailings sand must be for FS = 1.5: across per 1 up', f: (a, X) => 1.5 / tan(phiOf('tsand', X), X) },
  'ch12.seep-n15': { doc: 'the same with water seeping out of the face', f: (a, X) => 1.5 / (tan(phiOf('tsand', X), X) * tsandG(X)) },
  'ch12.seep-n': { doc: 'the flattest seeping face of tailings sand that just stands: across per 1 up at FS = 1', f: (a, X) => 1 / (tan(phiOf('tsand', X), X) * tsandG(X)) },

  // ---- slice 13 of the critical circle (index 12), by hand: Example ex-slope-slice
  'ch12.sin-a': { doc: 'sin α of slice 13 (the solver’s chord angle)', f: (a, X) => s13(X).sa },
  'ch12.cos-a': { doc: 'cos α of slice 13', f: (a, X) => s13(X).ca },
  'ch12.tan-a': { doc: 'tan α of slice 13', f: (a, X) => s13(X).ta },
  'ch12.tan-phi': { doc: 'tan φ′ of the fill (32°)', f: (a, X) => tan(phiOf('fill', X), X) },
  'ch12.ub': { doc: 'hand: u·b of slice 13, kN per metre', f: (a, X) => hand(X).ub },
  'ch12.w-ub': { doc: 'hand: W − u·b, kN', f: (a, X) => hand(X).wub },
  'ch12.c-term': { doc: 'hand: c′·b·tan α ÷ FS, kN', f: (a, X) => hand(X).ct },
  'ch12.m-alpha': { doc: 'hand: m_α = cos α + sin α tan φ′ ÷ FS', f: (a, X) => hand(X).ma },
  'ch12.n-num': { doc: 'hand: W − u·b − c′·b·tan α ÷ FS, kN', f: (a, X) => hand(X).nn },
  'ch12.n-eff': { doc: 'hand: N′, the grains’ press on the base, kN', f: (a, X) => hand(X).N },
  'ch12.l-m': { doc: 'hand: length of the slice’s base, m', f: (a, X) => hand(X).l },
  'ch12.grip': { doc: 'hand: grip on the base, c′·l + N′ tan φ′, kN', f: (a, X) => hand(X).grip },
  'ch12.pull': { doc: 'hand: pull down the base, W sin α, kN', f: (a, X) => hand(X).pull },
  'ch12.slice-ratio': { doc: 'hand: slice 13’s grip ÷ its pull', f: (a, X) => hand(X).ratio },
  'ch12.n-eff-exact': { doc: 'the solver’s N′ for slice 13, every digit carried, kN', f: (a, X) => s13(X).Np },
  'ch12.grip-exact': { doc: 'the solver’s grip for slice 13, kN', f: (a, X) => s13(X).grip },
  'ch12.pull-exact': { doc: 'the solver’s pull for slice 13, kN', f: (a, X) => s13(X).pull },
  'ch12.sum-grip': { doc: 'grip summed over the 40 slices at the converged FS, kN per metre', f: (a, X) => bishopPass(slices(X), X.bench({}).m.fos).num },
  'ch12.sum-pull': { doc: 'pull summed over the 40 slices, kN per metre', f: (a, X) => bishopPass(slices(X), X.bench({}).m.fos).den },
  'ch12.spare-pct': { doc: 'how far the homogeneous dam’s downstream score is above 1, %', f: (a, X) => 100 * (X.bench({}).m.fos - 1) },
  'ch12.exit-beyond-m': { doc: 'how far beyond the downstream toe (x = 51 m) the critical circle comes out, m', f: (a, X) => X.bench({}).crit.exit[0] - (3 + 24 * 2) },
  'ch12.up-exit-beyond-m': { doc: 'how far beyond the upstream toe (x = −51 m) the critical upstream circle comes out, m', f: (a, X) => -51 - X.bench({}).up.critical.exit[0] },
  'ch12.up-slices': { doc: 'slices whose base slopes up toward the toe (α < 0)', f: (a, X) => slices(X).filter(s => s.alpha < 0).length },
  'ch12.iter': { args: { k: '1' }, doc: 'Bishop’s loop started at FS = 1.5, as the solver starts it: the value after k passes', f: (a, X) => {
    const sl = slices(X); let F = 1.5; for (let k = 0; k < +a.k; k++) F = bishopPass(sl, F).F; return F; } },
  'ch12.oms': { doc: 'the ordinary (Fellenius) method of slices on the same circle: N′ = W cos α − u·l, no loop', f: (a, X) => {
    let num = 0, den = 0;
    for (const s of slices(X)) { den += s.W * Math.sin(s.alpha); const Np = Math.max(0, s.W * Math.cos(s.alpha) - s.u * s.l); num += s.c * s.l + Np * s.tphi; }
    return num / den; } },
  'ch12.oms-wcos': { doc: 'hand, ordinary method: W cos α of slice 13, kN', f: (a, X) => hand(X).wcos },
  'ch12.oms-ul': { doc: 'hand, ordinary method: u·l of slice 13, kN', f: (a, X) => hand(X).ul },
  'ch12.oms-n': { doc: 'hand, ordinary method: N′ of slice 13, kN', f: (a, X) => hand(X).oN },
  'ch12.oms-grip': { doc: 'hand, ordinary method: grip of slice 13, kN', f: (a, X) => hand(X).oGrip },

  // ---- what the water costs: Example ex-slope-dry
  'ch12.sum-w': { doc: 'the 40 slices’ weight, kN per metre', f: (a, X) => slices(X).reduce((t, s) => t + s.W, 0) },
  'ch12.sum-ub': { doc: 'the water’s push up on their bases, Σ u·b, kN per metre', f: (a, X) => slices(X).reduce((t, s) => t + s.u * s.b, 0) },
  'ch12.nowater-ratio': { doc: 'the same circle with no water pressure ÷ with it', f: (a, X) => X.bench({}).crit.fosNoWater / X.bench({}).m.fos },
  'ch12.nowater-pct': { doc: 'the same, as a gain in %', f: (a, X) => 100 * (X.bench({}).crit.fosNoWater / X.bench({}).m.fos - 1) },

  // ---- emptying the reservoir: Example ex-slope-drawdown
  'ch12.up-ru': { args: { preset: 'homogeneous' }, doc: 'r_u on the critical upstream circle after a fast drawdown', f: (a, X) => X.bench({ preset: a.preset }).up.critical.ru },
  'ch12.up-nowater': { args: { preset: 'homogeneous' }, doc: 'the critical upstream circle with no water pressure', f: (a, X) => X.bench({ preset: a.preset }).up.critical.fosNoWater },
  'ch12.up-depth-m': { args: { preset: 'homogeneous', found: 'clay' }, doc: 'greatest depth of the critical upstream surface, m', f: (a, X) => X.bench({ preset: a.preset, found: a.found }).up.critical.depth },
  'ch12.res-kpa': { doc: 'the water pressure a full reservoir puts on the foot of the upstream face, kPa', f: (a, X) => 9.81 * 0.85 * 24 }
};
