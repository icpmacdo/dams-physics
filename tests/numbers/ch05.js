/* Chapter 5's own number keys (book/SPEC.md E). Arithmetic on the numbers the figures use (the stress
 * column's damp sand at 18 kN/m³ and γw = 9.81, the dry heap's 34°, fig-race's permeabilities, the
 * workbench's clay at 26°), plus literature values and the chapter's illustrative stiffnesses, written
 * out below as named constants. Each literature value carries a Source note where the page prints it. */
'use strict';
const num = v => +v;
// literature constants
const C_DAMP = 0.6;     // kPa, apparent cohesion of damp sand at its plateau (Richefeu, El Youssoufi & Radjaï 2006)
const N_CUT = 3.83;     // stability number of a vertical cut, γH·tan(45° − φ/2)/c (Salençon 2024, p. 273)
const SU_RATIO = 0.22;  // s_u ÷ σ′p for soft clays (Mesri 1989)
// the chapter's illustrative inputs (the prose says "illustrative")
const CASTLE_H = 0.3;   // m, the castle of fig-beach, "about 30 cm tall"
const M = { sand: 20000, clay: 10000 }; // kPa, stiffness against squeezing (constrained modulus)
const SIGMA_CLAY = 150; // kPa, the clay example's effective stress
const DAY = 86400, YEAR = 365.25 * DAY;

const gw = X => X.G.COL.GW;                                  // 9.81
const gd = X => X.G.COL.GD;                                  // 18, damp sand
const phi = X => Math.atan(X.G.beachShapes(240, 241, 2).TAN.dry); // 34° in radians, the dry heap
const tanCut = X => Math.tan(Math.PI / 4 + phi(X) / 2);      // tan 62°
const cv = (soil, X) => X.G.MATS[soil].k * M[soil] / gw(X);  // m²/s
const tClay = (L, X) => L * L / cv('clay', X);               // s
const tanClay = X => Math.tan(X.ST.BUILD.materials.find(m => m.key === 'clay').phi * X.deg);

module.exports = {
  // ---- the castle: suction, apparent cohesion, the tallest wall
  'ch05.gamma-damp': { doc: 'unit weight of damp sand in the stress column, kN/m³', f: (a, X) => gd(X) },
  'ch05.castle-kpa': { doc: 'press at the foot of a 0.3 m damp castle, kPa', f: (a, X) => gd(X) * CASTLE_H },
  'ch05.base-kpa': { args: { h: '30' }, doc: 'press at the foot of a damp wall h metres tall, kPa', f: (a, X) => gd(X) * num(a.h) },
  'ch05.s-equiv-kpa': { doc: 'suction that would give the measured apparent cohesion, c ÷ tan 34°, kPa', f: (a, X) => C_DAMP / Math.tan(phi(X)) },
  'ch05.s-equiv-cm': { doc: 'that suction as a height of damp sand, cm', f: (a, X) => C_DAMP / Math.tan(phi(X)) / gd(X) * 100 },
  'ch05.tan-cut': { doc: 'tan(45° + 34°/2)', f: (a, X) => tanCut(X) },
  'ch05.cut-m': { doc: 'tallest vertical wall of damp sand, 3.83·(c/γ)·tan(45° + φ′/2), m', f: (a, X) => N_CUT * C_DAMP / gd(X) * tanCut(X) },
  'ch05.cut-k': { doc: '3.83 × tan 62°', f: (a, X) => N_CUT * tanCut(X) },
  'ch05.c-30m-kpa': { args: { h: '30' }, doc: 'cohesion a vertical wall h metres tall would need, kPa', f: (a, X) => gd(X) * num(a.h) / (N_CUT * tanCut(X)) },
  'ch05.c-ratio': { doc: 'that cohesion for 30 m ÷ the measured 0.6 kPa', f: (a, X) => gd(X) * 30 / (N_CUT * tanCut(X)) / C_DAMP },

  // ---- drainage time, t ≈ L²/c_v, with c_v = k·M/γw
  'ch05.mg-m': { args: { soil: 'sand' }, doc: 'stiffness M ÷ γw, metres of water', f: (a, X) => M[a.soil] / gw(X) },
  'ch05.cv-sand': { doc: 'coefficient of consolidation of the illustrative sand, m²/s', f: (a, X) => cv('sand', X) },
  'ch05.cv-clay': { doc: 'coefficient of consolidation of the illustrative clay, m²/s', f: (a, X) => cv('clay', X) },
  'ch05.cv-clay-day': { doc: 'the same, m² a day', f: (a, X) => cv('clay', X) * DAY },
  'ch05.t-sand-s': { args: { L: '2' }, doc: 'drainage time of L metres of sand, s', f: (a, X) => num(a.L) ** 2 / cv('sand', X) },
  'ch05.t-sand-min': { args: { L: '10' }, doc: 'the same, minutes', f: (a, X) => num(a.L) ** 2 / cv('sand', X) / 60 },
  'ch05.t-clay-day': { args: { L: '2' }, doc: 'drainage time of L metres of clay, days', f: (a, X) => tClay(num(a.L), X) / DAY },
  'ch05.t-clay-yr': { args: { L: '10' }, doc: 'the same, years of 365.25 days', f: (a, X) => tClay(num(a.L), X) / YEAR },

  // ---- clay, slow and fast
  'ch05.tan-clay': { doc: 'tan of the workbench clay’s friction angle (26°)', f: (a, X) => tanClay(X) },
  'ch05.tau-slow-kpa': { doc: 'drained grip of the example clay, σ′·tan φ′, kPa', f: (a, X) => SIGMA_CLAY * tanClay(X) },
  'ch05.su-kpa': { doc: 'undrained strength of the example clay, 0.22·σ′, kPa', f: () => SU_RATIO * SIGMA_CLAY },
  'ch05.su-ratio': { doc: 'undrained ÷ drained grip of the example clay', f: (a, X) => SU_RATIO * SIGMA_CLAY / (SIGMA_CLAY * tanClay(X)) },
  'ch05.su-sigma-kpa': { doc: 'the press that would give s_u by the drained rule, s_u ÷ tan φ′, kPa', f: (a, X) => SU_RATIO * SIGMA_CLAY / tanClay(X) }
};
