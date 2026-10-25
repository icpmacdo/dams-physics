/* Chapter 9, Every zone has one job: the chapter's own number keys (book/SPEC.md E.4).
 *
 * Code-backed keys read the seepage solver (X.seep), the workbench's materials (X.ST.BUILD) and the
 * slopes of fig-zones' earth–rockfill section (src/app-zones.js). The compaction test, the curve in
 * fig-zones-proctor and the question's field test are ILLUSTRATIVE: their inputs are the named
 * constants below, and the prose says "illustrative". Bennett's dimensions are the Expert Engineering
 * Panel's (2012, p. 1–2), in feet, converted here. */
'use strict';
const fs = require('fs'), path = require('path');

// ---- illustrative compaction numbers (ex-zones-compaction, fig-zones-proctor, q-zones-field)
const GS = 2.65;          // specific gravity of the grains (Chapter 5's typical sand)
const TEST = { gamma: 20.6, w: 0.12 };   // the field test: bulk unit weight, kN/m³, and water content
const GDMAX = 19.0, WOPT = 12;           // the laboratory (Proctor) curve's peak, kN/m³ and %
const Q2 = { gamma: 21.0, w: 0.14, gdmax: 18.9 };   // the end-of-chapter question
// the drawn compaction curve: water content (%) → dry unit weight (kN/m³), joined smoothly in the figure
const CURVE = { 7: 17.55, 8: 17.95, 9: 18.35, 10: 18.70, 11: 18.93, 12: 19.00, 13: 18.88, 14: 18.60, 15: 18.22, 16: 17.80, 17: 17.40 };

// fig-zones' earth–rockfill section: its upstream and downstream slopes, read from the drawing code
function znSlopes() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app-zones.js'), 'utf8');
  const m = src.match(/usF = z => -6 - ([\d.]+) \* \(H - z\), dsF = z => 6 \+ ([\d.]+) \* \(H - z\)/);
  if (!m) throw new Error('fig-zones earth–rockfill slopes not found in app-zones.js');
  return { up: +m[1], down: +m[2] };
}
const rock = X => X.ST.BUILD.materials.find(m => m.key === 'rock');
const gw = X => X.G.COL.GW;

// the lab's cored dam on the clay foundation (fig-lab: Clay core + shells, Clay foundation)
const CORED = { damType: 'cored', foundation: 'tight' };
// the water level in the downstream shell, just behind the core: the highest point of the phreatic
// surface between the core's foot (half-width 10.7 m at the ground, so x ≥ 11) and x = 30, well short
// of the toe (x = 50), where the line climbs to the top of the 1 m seepage face
function coreDs(X) {
  const r = X.seep(CORED);
  return Math.max(...r.phreatic.filter(p => p[0] >= 11 && p[0] <= 30).map(p => p[1]));
}
const CORE_MID_Z = 10;
// the lab's permeabilities, read from the solver's source (they are not exported)
function labK(name) {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'seepage-solver.js'), 'utf8');
  const m = src.match(new RegExp('\\b' + name + ' = ([0-9.e-]+)'));
  if (!m) throw new Error(name + ' not found in seepage-solver.js');
  return +m[1];
}    // the height at which the hand estimate takes the core's width
const coreHalf = z => 1.5 + 0.4 * (23 - z);   // seepage-solver.js coreHalfWidth (core top at z = 23)

module.exports = {
  // ---- Bennett Dam, from the panel's feet (cold open)
  'ch09.bennett-h-m': { doc: 'Bennett Dam: 600 ft high, in metres', f: () => 600 * 0.3048 },
  'ch09.bennett-l-km': { doc: 'Bennett Dam: 6,700 ft long, in km', f: () => 6700 * 0.3048 / 1000 },
  'ch09.bennett-fill-mm3': { doc: 'Bennett Dam: 57.5 million cubic yards of fill, in million m³', f: () => 57.5 * 0.9144 ** 3 },

  // ---- ex-zones-core: the plug inside our dam (the lab's cored dam on the clay foundation)
  'ch09.core-ds-m': { doc: 'height of the water in the downstream shell just behind the core, m', f: (a, X) => coreDs(X) },
  'ch09.core-dh-m': { doc: 'head the core takes: reservoir depth less the water behind it, m', f: (a, X) => X.seep(CORED).Hw - coreDs(X) },
  'ch09.core-share-pct': { doc: 'share of the head the core takes, %', f: (a, X) => 100 * (X.seep(CORED).Hw - coreDs(X)) / X.seep(CORED).Hw },
  'ch09.k-fill': { doc: 'the lab’s single fill, m/s', f: () => labK('K_FILL') },
  'ch09.k-core': { doc: 'the lab’s clay core, m/s', f: () => labK('K_CORE') },
  'ch09.k-shell': { doc: 'the lab’s sand-and-gravel shells, m/s', f: () => labK('K_SHELL') },
  'ch09.core-top-w-m': { doc: 'width of the lab’s core at its top (z = 23), m', f: () => 2 * coreHalf(23) },
  'ch09.core-base-w-m': { doc: 'width of the lab’s core at the ground, m', f: () => 2 * coreHalf(0) },
  'ch09.core-share': { doc: 'share of the head the core takes, as a fraction', f: (a, X) => (X.seep(CORED).Hw - coreDs(X)) / X.seep(CORED).Hw },
  'ch09.core-w-m': { doc: 'width of the core at mid-height (10 m up), m', f: () => 2 * coreHalf(CORE_MID_Z) },
  'ch09.core-i': { doc: 'average gradient across the core at mid-height', f: (a, X) => (X.seep(CORED).Hw - coreDs(X)) / (2 * coreHalf(CORE_MID_Z)) },
  'ch09.core-wet-m': { doc: 'wet height of the core taken for the hand estimate, m (the reservoir depth, rounded)', f: () => 20 },
  'ch09.core-hand-lday': { doc: 'hand estimate of the flow through the core, k·i·(wet height), L/day per metre', f: (a, X) => 1e-9 * ((X.seep(CORED).Hw - coreDs(X)) / (2 * coreHalf(CORE_MID_Z))) * 20 * 86400 * 1000 },
  'ch09.core-k-ratio': { doc: 'shell permeability ÷ core permeability in the lab (10⁻⁴ ÷ 10⁻⁹)', f: () => 1e-4 / 1e-9 },

  // ---- ex-zones-shell: the soaked upstream shell and the dry downstream one (workbench rockfill)
  'ch09.gprime-rock': { doc: 'buoyant unit weight of rockfill, saturated less water, kN/m³', f: (a, X) => rock(X).gs - gw(X) },
  'ch09.sv-up-kpa': { args: { z: '20' }, doc: 'grain press z m down in the soaked upstream shell, kPa', f: (a, X) => (rock(X).gs - gw(X)) * +a.z },
  'ch09.sv-down-kpa': { args: { z: '20' }, doc: 'grain press z m down in the dry downstream shell (moist unit weight, no water pressure), kPa', f: (a, X) => rock(X).gm * +a.z },
  'ch09.press-pct': { doc: 'soaked press as a percentage of the dry press', f: (a, X) => 100 * (rock(X).gs - gw(X)) / rock(X).gm },
  'ch09.press-ratio': { doc: 'soaked press ÷ dry press at the same depth', f: (a, X) => (rock(X).gs - gw(X)) / rock(X).gm },
  'ch09.tan-phi-rock': { doc: 'tan of rockfill’s friction angle', f: (a, X) => Math.tan(rock(X).phi * X.deg) },
  'ch09.zn-up-slope': { doc: 'fig-zones earth–rockfill: upstream slope, across for one up', f: () => znSlopes().up },
  'ch09.zn-down-slope': { doc: 'fig-zones earth–rockfill: downstream slope, across for one up', f: () => znSlopes().down },
  'ch09.fs-up-still': { doc: 'long straight upstream face of rockfill under still water: tan φ′ ÷ tan β', f: (a, X) => Math.tan(rock(X).phi * X.deg) * znSlopes().up },
  'ch09.fs-down-dry': { doc: 'long straight downstream face of dry rockfill: tan φ′ ÷ tan β', f: (a, X) => Math.tan(rock(X).phi * X.deg) * znSlopes().down },
  'ch09.fs-up-trapped': { doc: 'upstream face with the water trapped and seeping out parallel to it: × γ′/γsat', f: (a, X) => Math.tan(rock(X).phi * X.deg) * znSlopes().up * (rock(X).gs - gw(X)) / rock(X).gs },

  // ---- ex-zones-compaction (illustrative) and fig-zones-proctor
  'ch09.test-gamma': { doc: 'illustrative field test: bulk unit weight, kN/m³', f: () => TEST.gamma },
  'ch09.test-w-pct': { doc: 'illustrative field test: water content, %', f: () => 100 * TEST.w },
  'ch09.gd': { doc: 'dry unit weight of the field test, γ/(1 + w), kN/m³', f: () => TEST.gamma / (1 + TEST.w) },
  'ch09.gdmax': { doc: 'illustrative laboratory maximum dry unit weight, kN/m³', f: () => GDMAX },
  'ch09.wopt-pct': { doc: 'illustrative optimum water content, %', f: () => WOPT },
  'ch09.rc-pct': { doc: 'relative compaction of the field test, %', f: () => 100 * TEST.gamma / (1 + TEST.w) / GDMAX },
  'ch09.rc': { doc: 'relative compaction of the field test, as a fraction', f: () => TEST.gamma / (1 + TEST.w) / GDMAX },
  'ch09.gs': { doc: 'specific gravity of the grains', f: () => GS },
  'ch09.e-ratio': { doc: 'Gs·γw ÷ γd for the field test (1 + e)', f: (a, X) => GS * gw(X) / (TEST.gamma / (1 + TEST.w)) },
  'ch09.e': { doc: 'void ratio of the field test', f: (a, X) => GS * gw(X) / (TEST.gamma / (1 + TEST.w)) - 1 },
  'ch09.n': { doc: 'gap fraction (porosity) of the field test, e/(1 + e)', f: (a, X) => { const e = GS * gw(X) / (TEST.gamma / (1 + TEST.w)) - 1; return e / (1 + e); } },
  'ch09.sr': { doc: 'share of the gaps full of water, w·Gs/e', f: (a, X) => TEST.w * GS / (GS * gw(X) / (TEST.gamma / (1 + TEST.w)) - 1) },
  'ch09.zav': { args: { w: '12' }, doc: 'zero-air-voids dry unit weight at water content w %, Gs·γw/(1 + w·Gs), kN/m³', f: (a, X) => GS * gw(X) / (1 + +a.w / 100 * GS) },
  'ch09.curve': { args: { w: '12' }, doc: 'the illustrative compaction curve drawn in fig-zones-proctor, kN/m³', f: a => { const v = CURVE[+a.w]; if (v == null) throw new Error('no curve point at w = ' + a.w); return v; } },
  'ch09.spec98': { doc: '98% of the illustrative maximum (the line drawn for Bennett’s core specification), kN/m³', f: () => 0.98 * GDMAX },

  // ---- q-zones-field (illustrative)
  'ch09.q2-gamma': { doc: 'question: bulk unit weight, kN/m³', f: () => Q2.gamma },
  'ch09.q2-w-pct': { doc: 'question: water content, %', f: () => 100 * Q2.w },
  'ch09.q2-gdmax': { doc: 'question: Proctor maximum, kN/m³', f: () => Q2.gdmax },
  'ch09.gd2': { doc: 'question: dry unit weight, kN/m³', f: () => Q2.gamma / (1 + Q2.w) },
  'ch09.rc2': { doc: 'question: relative compaction, as a fraction', f: () => Q2.gamma / (1 + Q2.w) / Q2.gdmax },
  'ch09.rc2-pct': { doc: 'question: relative compaction, %', f: () => 100 * Q2.gamma / (1 + Q2.w) / Q2.gdmax }
};
