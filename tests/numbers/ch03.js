/* Chapter 3's own number keys (book/SPEC.md E). Everything here is arithmetic on the numbers the
 * figures use: the race's permeabilities and gap fractions (MATS in app-ground.js @fig-race), Darcy's
 * pipe (@fig-darcy), γw = 9.81 kN/m³ and the soaked sand's 20 kN/m³ (@fig-column). The few inputs no
 * code holds are named below and called "illustrative" in the prose. */
'use strict';
const num = v => +v;
// the chapter's own illustrative inputs
const LAKE = 8;           // m, depth of the still lake in fig-head-straws, panel A
const DATUM = 20;         // m, the datum sits this far below the lake's surface
const BEACH_I = 0.05;     // the water table in the beach falls 1 m over 20 m of beach (illustrative)
const BEACH_RUN = 20;     // m of beach the water has to cross (illustrative)
const CORE_T = 5;         // m, thickness of the clay core in ex-head-core (illustrative)
const CORE_H = 30;        // m, head across it, taken over its whole 30 m height (illustrative)

const gw = X => X.G.COL.GW;
const M = (X, m) => X.G.MATS[m];
const darcySt = (o, X) => Object.assign({}, X.G.DARCY0, o);
const qOf = (o, X) => X.G.darcyReadouts(darcySt(o, X)).q;   // m³/s per m² of pipe
const YEAR = 86400 * 365.25;
// a drop crossing L metres of material m under gradient i: n·L ÷ (k·i), in s
const cross = (X, m, L, i) => M(X, m).n * L / (M(X, m).k * i);
const core = (a, X) => {
  const t = num(a.t), i = CORE_H / t, flux = M(X, 'clay').k * i;
  return { i, flux, v: flux / M(X, 'clay').n, s: t / (flux / M(X, 'clay').n), q: flux * CORE_H };
};

module.exports = {
  // ---- fig-head-straws, panel A: the still lake and its three straws (depths below the surface)
  'ch03.z-m': { args: { d: '4' }, doc: 'elevation of a straw tip d m below the lake surface, above the datum', f: a => DATUM - num(a.d) },
  'ch03.ph-m': { args: { d: '4' }, doc: 'pressure head at that tip: u ÷ γw, which in still water is the depth', f: (a, X) => X.G.depthCalc(50, num(a.d)).p / gw(X) },
  'ch03.h-m': { args: { d: '4' }, doc: 'total head z + u/γw at that tip', f: (a, X) => DATUM - num(a.d) + X.G.depthCalc(50, num(a.d)).p / gw(X) },
  'ch03.lake-m': { doc: 'depth of the lake in panel A', f: () => LAKE },
  'ch03.datum-m': { doc: 'depth of the datum below the lake surface', f: () => DATUM },

  // ---- Darcy's pipe as the figure opens (ex-head-darcy)
  'ch03.tank-m': { args: { side: 'l' }, doc: 'fig-darcy on load: left tank (l), right tank (r), pipe length (L), m', f: (a, X) => ({ l: X.G.DARCY0.hl, r: X.G.DARCY0.hr, L: X.G.DARCY0.L })[a.side] },
  'ch03.q-ls': { doc: 'flow per m² at the defaults, L/s', f: (a, X) => qOf({}, X) * 1000 },
  'ch03.cross-s': { doc: 'seconds for a drop to cross the pipe at the defaults', f: (a, X) => X.G.DARCY0.L / (qOf({}, X) / M(X, 'sand').n) },
  'ch03.v-mms': { doc: 'speed of that drop, mm/s', f: (a, X) => qOf({}, X) / M(X, 'sand').n * 1000 },
  'ch03.v-mh': { doc: 'speed of that drop, m per hour', f: (a, X) => qOf({}, X) / M(X, 'sand').n * 3600 },

  // ---- why the speed of the water drops out of head
  'ch03.velocity-head-m': { doc: 'v²/2g for the drop in Darcy’s pipe at the figure’s defaults, m', f: (a, X) => (qOf({}, X) / M(X, 'sand').n) ** 2 / (2 * gw(X)) },

  // ---- back to the beach (illustrative gradient, the figures’ sand)
  'ch03.beach-i': { doc: 'illustrative gradient of the water table in the beach', f: () => BEACH_I },
  'ch03.beach-run-m': { doc: 'illustrative width of beach the water crosses, m', f: () => BEACH_RUN },
  'ch03.beach-flux-ms': { doc: 'k·i for the figures’ sand at the beach gradient, m/s', f: (a, X) => M(X, 'sand').k * BEACH_I },
  'ch03.beach-v-ms': { doc: 'speed of a drop in the beach, k·i ÷ n, m/s', f: (a, X) => M(X, 'sand').k * BEACH_I / M(X, 'sand').n },
  'ch03.beach-cm-h': { doc: 'the same, cm per hour', f: (a, X) => M(X, 'sand').k * BEACH_I / M(X, 'sand').n * 3600 * 100 },
  'ch03.beach-days': { doc: 'days for a drop to cross the illustrative width of beach', f: (a, X) => BEACH_RUN / (M(X, 'sand').k * BEACH_I / M(X, 'sand').n) / 86400 },

  // ---- the race
  'ch03.k-ratio': { doc: 'gravel’s permeability ÷ clay’s', f: (a, X) => M(X, 'gravel').k / M(X, 'clay').k },
  'ch03.race-s': { args: { mat: 'sand' }, doc: 'race time n·L/(k·i) for 1 m at gradient 1, s (as race.t-s, for the worked lines)', f: (a, X) => cross(X, a.mat, 1, 1) },
  'ch03.time-ratio': { doc: 'clay’s race time ÷ gravel’s', f: (a, X) => cross(X, 'clay', 1, 1) / cross(X, 'gravel', 1, 1) },
  'ch03.silt-2m-days': { doc: 'days for a drop to cross 2 m of the figures’ silt at gradient 1', f: (a, X) => cross(X, 'silt', 2, 1) / 86400 },
  'ch03.silt-2m-s': { doc: 'the same, s', f: (a, X) => cross(X, 'silt', 2, 1) },

  // ---- the plug as resistances in series (fig-darcy, sand, plug in the middle fifth of a 2 m pipe)
  'ch03.plug-m': { doc: 'length of the clay plug, m', f: (a, X) => (X.G.DARCY_PLUG[1] - X.G.DARCY_PLUG[0]) * X.G.DARCY0.L },
  'ch03.sand-m': { doc: 'length of the sand on either side of the plug, together, m', f: (a, X) => (1 - (X.G.DARCY_PLUG[1] - X.G.DARCY_PLUG[0])) * X.G.DARCY0.L },
  'ch03.r-total-s': { args: { mat: 'sand' }, doc: 'sum of the two resistances L/k with the plug in a pipe of mat, s', f: (a, X) => { const Lp = (X.G.DARCY_PLUG[1] - X.G.DARCY_PLUG[0]) * X.G.DARCY0.L; return (X.G.DARCY0.L - Lp) / M(X, a.mat).k + Lp / M(X, 'clay').k; } },
  'ch03.silt-share': { doc: 'the plug’s share of the head in a silt pipe, as a fraction (4.0 × 10⁸ ÷ 4.16 × 10⁸)', f: (a, X) => X.G.darcyReadouts(darcySt({ plug: true, mat: 'silt' }, X)).share },
  'ch03.keff-ms': { doc: 'the pipe’s whole length ÷ its total resistance: its k as a whole, m/s', f: (a, X) => X.G.darcyKEff(darcySt({ plug: true }, X)) },
  'ch03.plug-q-ms': { doc: 'flow per m² with the plug, m/s', f: (a, X) => qOf({ plug: true }, X) },
  'ch03.plug-dh-m': { doc: 'head lost across the plug, m', f: (a, X) => { const s = darcySt({ plug: true }, X); return X.G.darcyHeadAt(s, X.G.DARCY_PLUG[0]) - X.G.darcyHeadAt(s, X.G.DARCY_PLUG[1]); } },
  'ch03.sand-dh-mm': { doc: 'head lost in all the sand together, mm', f: (a, X) => { const s = darcySt({ plug: true }, X); return (s.hl - s.hr - (X.G.darcyHeadAt(s, X.G.DARCY_PLUG[0]) - X.G.darcyHeadAt(s, X.G.DARCY_PLUG[1]))) * 1000; } },
  'ch03.r-silt-s': { doc: 'resistance L/k of the 1.6 m of silt, s', f: (a, X) => 1.6 / M(X, 'silt').k },
  'ch03.plug-q-ratio': { args: { hr: '1.8' }, doc: 'plugged flow with the right tank at 0.60 m ÷ with it at hr', f: (a, X) => qOf({ plug: true }, X) / qOf({ plug: true, hr: num(a.hr) }, X) },

  // ---- a real core (illustrative: 5 m thick, 30 m of head, the figures’ clay)
  'ch03.core-t-m': { args: { t: '5' }, doc: 'core thickness, m', f: a => num(a.t) },
  'ch03.core-h-m': { doc: 'head across the core, m', f: () => CORE_H },
  'ch03.core-i': { args: { t: '5' }, doc: 'gradient across the core', f: (a, X) => core(a, X).i },
  'ch03.core-flux-ms': { args: { t: '5' }, doc: 'flow per m² through the core, k·i, m/s', f: (a, X) => core(a, X).flux },
  'ch03.core-v-ms': { args: { t: '5' }, doc: 'speed of a drop in the core, k·i ÷ n, m/s', f: (a, X) => core(a, X).v },
  'ch03.core-s': { args: { t: '5' }, doc: 'seconds for a drop to cross the core', f: (a, X) => core(a, X).s },
  'ch03.core-years': { args: { t: '5' }, doc: 'years for a drop to cross the core', f: (a, X) => core(a, X).s / YEAR },
  'ch03.core-q-m3s': { args: { t: '5' }, doc: 'flow through a strip of core 30 m tall and 1 m long, m³/s', f: (a, X) => core(a, X).q },
  'ch03.core-q-ls': { args: { t: '5' }, doc: 'the same, L/s', f: (a, X) => core(a, X).q * 1000 },
  'ch03.core-lday': { args: { t: '5' }, doc: 'the same, litres a day per metre of dam', f: (a, X) => core(a, X).q * 1000 * 86400 },

  // ---- seepage force against the soaked sand's weight (fig-column's unit weights)
  'ch03.j-kn': { args: { i: '1' }, doc: 'seepage force i·γw on a cubic metre of soil, kN', f: (a, X) => num(a.i) * gw(X) },
  'ch03.float-ratio': { doc: 'seepage force at gradient 1 ÷ the soaked sand’s buoyant weight', f: (a, X) => gw(X) / (X.G.COL.GS - gw(X)) },
  'ch03.i-float': { doc: 'gradient at which the upward seepage force equals the soaked sand’s buoyant weight, γ′ ÷ γw', f: (a, X) => (X.G.COL.GS - gw(X)) / gw(X) },
  'ch03.float-pct': { doc: 'seepage force at gradient 1 as a share of the soaked sand’s buoyant weight, %', f: (a, X) => 100 * gw(X) / (X.G.COL.GS - gw(X)) }
};
