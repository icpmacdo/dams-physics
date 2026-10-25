/* Chapter 11's own number keys (book/SPEC.md E).
 *
 * - The tube (fig-erosion-tube) and the critical gradient: a typical quartz sand, grains 2.65 times as
 *   heavy as water and 0.65 m³ of gap per m³ of grain (the same sand as Chapter 4's second route),
 *   with the unit weight of water the code uses (const.gw). Illustrative: no figure holds this sand.
 * - The exit (ex-erosion-exit): the seepage lab's own exit gradients (lab.*) and the critical gradient
 *   its solver divides by (criticalGradient in src/seepage-solver.js).
 * - The pipe (ex-erosion-pipe): an illustrative head budget on the lab dam's own geometry (its
 *   reservoir depth and its base, read from GEOM), not a model of erosion.
 * - The filter (ex-erosion-filter, fig-erosion-grading, the questions): an illustrative base sand
 *   and filter, with the agencies' factor of 4 (FEMA 2011, Table 5-2 and p. 84) and the effective
 *   opening of a graded filter, about 0.11 × D15 (FEMA 2011, pp. 275–276, after Sherard et al.).
 * - Unit conversions for the two case plates (feet and cubic feet a second, as the sources give them). */
'use strict';
const path = require('path');
const { GEOM } = require(path.join(__dirname, '..', '..', 'src', 'seepage-solver.js'));

// the tube's sand (illustrative, typical quartz sand)
const SAND = { gs: 2.65, e: 0.65 };
const ic = a => (+a.gs - 1) / (1 + +a.e);
// the lab dam
const HW = res => +res * GEOM.dam.crestZ;                  // reservoir depth, m (as lab.res-m)
const PATH = GEOM.dam.downToeX - GEOM.dam.upToeX;          // 102 m along the base, toe to toe
const exitI = X => X.S.labPiping(X.seep({}).exit).imax;     // the lab's exit gradient on load
const icLab = () => GEOM.criticalGradient;                 // the critical gradient the lab divides by (I_CRIT)
// the filter (illustrative base sand and filter; Terzaghi's factor of 4 both ways)
const BASE = { d15: 0.20, d50: 0.30, d85: 0.45 };
const FILTER = { d15: 1.2, d85: 4.0 };
const K4 = 4;
const OPEN = 0.11;                                          // effective opening ÷ D15 of a graded filter
const Q2 = { d15: 0.15, d85: 0.6 };                         // the question's base
// three equal spheres touching: the largest sphere that fits through the gap between them
const GAP3 = 2 / Math.sqrt(3) - 1;
const FT = 0.3048;

module.exports = {
  // ---- the critical gradient
  'ch11.gs': { doc: 'specific gravity of the tube’s quartz grains', f: () => SAND.gs },
  'ch11.e': { args: { e: String(SAND.e) }, doc: 'void ratio of the tube’s sand', f: a => +a.e },
  'ch11.gs-1': { doc: 'G_s − 1 for the tube’s sand', f: () => SAND.gs - 1 },
  'ch11.one-e': { args: { e: String(SAND.e) }, doc: '1 + e for the tube’s sand', f: a => 1 + +a.e },
  'ch11.ic': { args: { e: String(SAND.e) }, doc: 'critical gradient (G_s − 1)/(1 + e)', f: a => ic({ gs: SAND.gs, e: a.e }) },
  'ch11.gsat': { doc: 'saturated unit weight of the tube’s sand, kN/m³', f: (a, X) => (SAND.gs + SAND.e) / (1 + SAND.e) * X.G.COL.GW },
  'ch11.gprime': { doc: 'buoyant unit weight of the tube’s sand, kN/m³', f: (a, X) => (SAND.gs - 1) / (1 + SAND.e) * X.G.COL.GW },
  'ch11.drag-kn': { args: { i: '0.5' }, doc: 'upward drag on each m³ of grains at gradient i, kN', f: (a, X) => +a.i * X.G.COL.GW },
  'ch11.left-kn': { args: { i: '0.5' }, doc: 'press left between the grains of each m³ at upward gradient i, kN', f: (a, X) => Math.max(0, (SAND.gs - 1) / (1 + SAND.e) * X.G.COL.GW - +a.i * X.G.COL.GW) },
  'ch11.left-pct': { args: { i: '0.5' }, doc: 'share of the grains’ press left at upward gradient i, %', f: a => 100 * Math.max(0, 1 - +a.i / ic(SAND)) },
  'ch11.dh-m': { args: { i: '0.5' }, doc: 'how far the tank stands above the sand’s top water for gradient i through 1 m of sand, m', f: a => +a.i * 1 },

  // ---- the exit (the lab on load, sand and gravel, no drain, no cutoff, 85%)
  'ch11.ic-lab': { doc: 'the critical gradient the seepage lab divides by', f: (a, X) => icLab(X) },
  'ch11.i-max': { args: { fs: '4' }, doc: 'largest exit gradient that gives a safety of fs against heave, with the lab’s i_c', f: (a, X) => icLab(X) / +a.fs },
  'ch11.cut-factor': { args: { fs: '4' }, doc: 'factor the lab’s exit gradient must fall by to reach fs', f: (a, X) => exitI(X) / (icLab(X) / +a.fs) },
  'ch11.toe-left-pct': { doc: 'share of the grains’ press left at the lab’s toe, 1 − i_exit / i_c, %', f: (a, X) => 100 * (1 - exitI(X) / icLab(X)) },

  // ---- the pipe (illustrative head budget on the lab dam)
  'ch11.head-m': { doc: 'head across the lab dam: the reservoir depth at 85%, m', f: () => HW(0.85) },
  'ch11.path-m': { args: { eaten: '0' }, doc: 'path left along the base once a pipe has eaten back eaten m', f: a => PATH - +a.eaten },
  'ch11.i-avg': { args: { eaten: '0' }, doc: 'average gradient over the path left, head ÷ path', f: a => HW(0.85) / (PATH - +a.eaten) },
  'ch11.crowd': { doc: 'the lab’s exit gradient ÷ the average gradient under the intact dam', f: (a, X) => exitI(X) / (HW(0.85) / PATH) },
  'ch11.tip': { args: { eaten: '50' }, doc: 'illustrative gradient at a pipe’s tip: the average over the path left × the crowding at the toe', f: (a, X) => HW(0.85) / (PATH - +a.eaten) * exitI(X) / (HW(0.85) / PATH) },
  'ch11.eaten-at-1': { doc: 'how far a pipe must eat back before the average gradient alone reaches 1, m', f: () => PATH - HW(0.85) },

  // ---- the filter (illustrative)
  'ch11.b-d15': { doc: 'base sand D15, mm', f: () => BASE.d15 },
  'ch11.b-d85': { doc: 'base sand D85, mm', f: () => BASE.d85 },
  'ch11.b-d50': { doc: 'base sand D50, mm (the curve drawn in fig-erosion-grading)', f: () => BASE.d50 },
  'ch11.k4': { doc: 'Terzaghi’s factor, both rules', f: () => K4 },
  'ch11.d15f-max': { doc: 'retention: largest filter D15, 4 × D85 of the base, mm', f: () => K4 * BASE.d85 },
  'ch11.d15f-min': { doc: 'permeability: smallest filter D15, 4 × D15 of the base, mm', f: () => K4 * BASE.d15 },
  'ch11.band-ratio': { doc: 'largest ÷ smallest allowed filter D15', f: () => BASE.d85 / BASE.d15 },
  'ch11.d15f': { doc: 'the filter chosen: D15, mm', f: () => FILTER.d15 },
  'ch11.f-d85': { doc: 'the filter chosen: D85, mm', f: () => FILTER.d85 },
  'ch11.open-frac': { doc: 'effective opening of a graded filter ÷ its D15', f: () => OPEN },
  'ch11.open-mm': { args: { d15: String(FILTER.d15) }, doc: 'effective opening of a filter with this D15, mm', f: a => OPEN * +a.d15 },
  'ch11.open-ratio': { doc: 'the chosen filter’s opening ÷ the base’s D85', f: () => OPEN * FILTER.d15 / BASE.d85 },
  'ch11.open-ratio-max': { doc: 'opening ÷ D85 for a filter at the retention limit, 0.11 × 4', f: () => OPEN * K4 },
  'ch11.d-ratio': { doc: 'filter D15 ÷ base D15', f: () => FILTER.d15 / BASE.d15 },
  'ch11.k-ratio': { doc: 'how many times more easily the filter passes water, (D15 ratio)²', f: () => (FILTER.d15 / BASE.d15) ** 2 },
  'ch11.k-ratio-min': { doc: 'the least that ratio can be under the permeability rule, 4²', f: () => K4 ** 2 },
  'ch11.gap3': { doc: 'largest sphere through the gap between three equal touching spheres ÷ their diameter', f: () => GAP3 },
  'ch11.rock-d15': { doc: 'illustrative rockfill D15, mm', f: () => 30 },
  'ch11.rock-open': { doc: 'its effective opening, mm', f: () => OPEN * 30 },
  'ch11.rock-open-ratio': { doc: 'its opening ÷ the base sand’s D85', f: () => OPEN * 30 / BASE.d85 },
  'ch11.q2-min': { doc: 'question: smallest filter D15 for the base with D15 0.15 mm, mm', f: () => K4 * Q2.d15 },
  'ch11.q2-max': { doc: 'question: largest filter D15 for the base with D85 0.6 mm, mm', f: () => K4 * Q2.d85 },
  'ch11.q2-d15': { doc: 'question base D15, mm', f: () => Q2.d15 },
  'ch11.q2-d85': { doc: 'question base D85, mm', f: () => Q2.d85 },

  // ---- unit conversions for the case plates
  'ch11.ft-m': { args: { ft: '1' }, doc: 'feet to metres', f: a => +a.ft * FT },
  'ch11.cfs-m3s': { args: { q: '1' }, doc: 'cubic feet a second to cubic metres a second', f: a => +a.q * FT ** 3 }
};
