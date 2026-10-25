/* Chapter 10's own number keys (book/SPEC.md E). Most are arithmetic on what the seepage lab's
 * solver uses (its geometry and permeabilities, read from GEOM in src/seepage-solver.js) or returns
 * (X.seep, the same cached runs the lab keys use). The flow net of fig-seepage-net is illustrative:
 * its inputs are written below as named constants, and the prose says "illustrative". */
'use strict';
const path = require('path');
const { GEOM } = require(path.join(__dirname, '..', '..', 'src', 'seepage-solver.js'));

const DAY = 86400, L_M3 = 1000;
const LAB = { dam: 'homogeneous', drain: 'none', cut: 'none', found: 'pervious', res: '0.85' };
const lab = (a, X) => X.seep({ damType: a.dam, drain: a.drain, cutoff: a.cut, foundation: a.found, reservoir: +a.res });
const qLday = (a, X) => lab(a, X).q.inflowTotal * DAY * L_M3;
const q0 = X => qLday(LAB, X);                                   // the lab on load, 2,366 L/day per metre
const BASE = GEOM.dam.downToeX - GEOM.dam.upToeX;                // 102 m, the dam's base
const T = GEOM.groundZ - GEOM.z0;                                // 15 m of foundation
const HW = a => +a.res * GEOM.dam.crestZ;                        // reservoir depth, m (as lab.res-m)

// ---- fig-seepage-net: an illustrative weir, computed offline (a Laplace solve on a 5 cm grid) and
// drawn to scale. The net closes with 4 channels and 12 drops; its smallest square, at the exit beside
// the weir's downstream face, is 1.4 m deep along that face.
const NET = { k: 1e-4, H: 10, Nf: 4, Nd: 12, exit: 1.4, B: 13, e: 2, T: 10 };

// ---- the clay-foundation dam by hand (Dupuit, with Casagrande's 0.3m entry correction)
const SLOPE = GEOM.dam.slopeH;                                   // 2H:1V
const dup = a => {
  const h = HW(a), run = SLOPE * h;                              // horizontal run of the wetted upstream face
  const corr = 0.3 * run;                                        // Casagrande (1937), p. 151: about 0.3m
  const xWater = GEOM.dam.upToeX + run;                          // where the reservoir meets the face (−10.2)
  const d = corr + (GEOM.dam.downToeX - xWater);                 // entry point to the downstream toe
  return { h, run, corr, d };
};
const alpha = Math.atan(1 / SLOPE);

// ---- a 90° V-notch weir: Cone's formula, Q = 2.49 h^2.48 in ft³/s and ft (USBR Water Measurement
// Manual, eq. 7-6), converted to m³/s and metres
const FT = 0.3048;
const CONE_C = 2.49 * FT ** 3 / FT ** 2.48;                      // 1.342
const WEIR_DAM_M = 400;                                          // illustrative: a dam 400 m long

// ---- question: a sheet-pile wall (illustrative): a net of 4 channels and 8 drops, 6 m of head, k = 2 × 10⁻⁵ m/s
const SP = { k: 2e-5, H: 6, Nf: 4, Nd: 8 };

module.exports = {
  // ---- the lab's own inputs
  'ch10.base-m': { doc: 'the lab dam’s base, upstream toe to downstream toe, m', f: () => BASE },
  'ch10.crest-m': { doc: 'height of the lab dam’s crest above the ground, m', f: () => GEOM.dam.crestZ - GEOM.groundZ },
  'ch10.half-base-m': { doc: 'half the dam’s base, centre line to a toe, m', f: () => BASE / 2 },
  'ch10.found-m': { doc: 'depth of the lab’s foundation layer, m', f: () => T },
  'ch10.k-found': { doc: 'the lab’s sand-and-gravel foundation, m/s', f: () => GEOM.k.foundationPervious },
  'ch10.k-tight': { doc: 'the lab’s clay foundation, m/s', f: () => GEOM.k.foundationTight },
  'ch10.k-fill': { doc: 'the homogeneous dam’s fill, m/s', f: () => GEOM.k.fill },
  'ch10.k-core': { doc: 'the cored dam’s core, m/s', f: () => GEOM.k.core },
  'ch10.k-shell': { doc: 'the cored dam’s shells, m/s', f: () => GEOM.k.shell },
  'ch10.k-shell-ratio': { doc: 'shell permeability ÷ the gravel foundation’s', f: () => GEOM.k.shell / GEOM.k.foundationPervious },
  'ch10.k-fill-ratio': { doc: 'gravel foundation permeability ÷ the fill’s', f: () => GEOM.k.foundationPervious / GEOM.k.fill },
  'ch10.k-fill-lday': { doc: 'the fill’s k turned into litres a day: the flow through 1 m² at gradient 1', f: () => GEOM.k.fill * DAY * L_M3 },
  'ch10.k-tight-lday': { doc: 'the clay foundation’s k turned into litres a day', f: () => GEOM.k.foundationTight * DAY * L_M3 },
  'ch10.k-tight-ratio': { doc: 'fill permeability ÷ the clay foundation’s', f: () => GEOM.k.fill / GEOM.k.foundationTight },

  // ---- the flow net (illustrative)
  'ch10.net-k': { doc: 'the sand under the weir, m/s', f: () => NET.k },
  'ch10.net-h': { doc: 'head across the weir, m', f: () => NET.H },
  'ch10.net-nf': { doc: 'flow channels', f: () => NET.Nf },
  'ch10.net-nd': { doc: 'head drops', f: () => NET.Nd },
  'ch10.net-shape': { doc: 'shape factor Nf/Nd', f: () => NET.Nf / NET.Nd },
  'ch10.net-dh': { doc: 'head lost in each drop, m', f: () => NET.H / NET.Nd },
  'ch10.net-dq': { doc: 'flow in each channel, m³/s per metre (k × Δh for a square)', f: () => NET.k * NET.H / NET.Nd },
  'ch10.net-q': { doc: 'flow under the weir, m³/s per metre', f: () => NET.k * NET.H * NET.Nf / NET.Nd },
  'ch10.net-q-day': { doc: 'flow under the weir, m³ per day per metre', f: () => NET.k * NET.H * NET.Nf / NET.Nd * DAY },
  'ch10.net-exit-m': { doc: 'depth of the smallest exit square along the weir’s downstream face, m (measured)', f: () => NET.exit },
  'ch10.net-i': { doc: 'exit gradient: the last drop over the exit square', f: () => NET.H / NET.Nd / NET.exit },
  'ch10.net-b-m': { doc: 'weir base width, m', f: () => NET.B },
  'ch10.net-e-m': { doc: 'how far the weir is sunk into the sand, m', f: () => NET.e },
  'ch10.net-t-m': { doc: 'depth of sand under the weir, m', f: () => NET.T },
  'ch10.net-q10': { doc: 'the same weir on sand ten times as permeable, m³/s per metre', f: () => 10 * NET.k * NET.H * NET.Nf / NET.Nd },

  // ---- the lab's default by hand
  'ch10.hand-i': { args: { res: '0.85' }, doc: 'average gradient under the dam: reservoir depth ÷ base', f: a => HW(a) / BASE },
  'ch10.hand-qms': { args: { res: '0.85' }, doc: 'Darcy under the dam, m³/s per metre', f: a => GEOM.k.foundationPervious * HW(a) / BASE * T },
  'ch10.hand-lday': { args: { res: '0.85' }, doc: 'Darcy under the dam, L/day per metre', f: a => GEOM.k.foundationPervious * HW(a) / BASE * T * DAY * L_M3 },
  'ch10.hand-ratio': { doc: 'hand estimate ÷ the solver’s leak', f: (a, X) => GEOM.k.foundationPervious * HW(LAB) / BASE * T * DAY * L_M3 / q0(X) },
  'ch10.hand-err-pct': { doc: 'hand estimate above the solver’s, %', f: (a, X) => 100 * (GEOM.k.foundationPervious * HW(LAB) / BASE * T * DAY * L_M3 / q0(X) - 1) },
  'ch10.under-pct': { args: LAB, doc: 'share of the leak crossing the dam’s centre line under the dam, %', f: (a, X) => { const r = lab(a, X); return 100 * r.q.passUnderDam / r.q.inflowTotal; } },
  'ch10.per-km-ls': { args: LAB, doc: 'the leak of a kilometre of dam, L/s', f: (a, X) => qLday(a, X) * 1000 / DAY },
  'ch10.per-km-m3': { args: LAB, doc: 'the leak of a kilometre of dam, m³/day', f: (a, X) => qLday(a, X) * 1000 / L_M3 },

  // ---- the core that leaks more
  'ch10.core-base-m': { doc: 'width of the lab core’s base, m', f: () => 2 * GEOM.core.halfWidthAtGround },
  'ch10.core-toe-m': { doc: 'from the core’s downstream edge at the ground to the downstream toe, m', f: () => GEOM.dam.downToeX - GEOM.core.halfWidthAtGround },
  'ch10.path-ratio': { doc: 'the dam’s base ÷ the core’s base', f: () => BASE / (2 * GEOM.core.halfWidthAtGround) },
  'ch10.core-ratio': { doc: 'cored leak ÷ homogeneous leak (both on gravel, no drain, no cutoff)', f: (a, X) => qLday(Object.assign({}, LAB, { dam: 'cored' }), X) / q0(X) },
  'ch10.head-m': { args: Object.assign({ x: '-12', z: '-0.5' }, LAB), doc: 'total head the solver finds in the cell at (x, z), m', f: (a, X) => { const r = lab(a, X); const i = Math.floor(+a.x - r.x0), j = Math.floor(+a.z - r.z0); return r.h[i * r.nz + j]; } },
  'ch10.head-pct': { args: Object.assign({ x: '-12', z: '-0.5' }, LAB), doc: 'that head as a share of the reservoir depth, %', f: (a, X) => { const r = lab(a, X); const i = Math.floor(+a.x - r.x0), j = Math.floor(+a.z - r.z0); return 100 * r.h[i * r.nz + j] / r.Hw; } },
  'ch10.cut-ratio': { args: { dam: 'cored' }, doc: 'leak without a cutoff ÷ leak with a full cutoff', f: (a, X) => qLday(Object.assign({}, LAB, { dam: a.dam }), X) / qLday(Object.assign({}, LAB, { dam: a.dam, cut: 'full' }), X) },

  // ---- drains
  'ch10.drain-pct': { args: { drain: 'chimney' }, doc: 'change in the leak when the drain is added, %', f: (a, X) => 100 * (qLday(Object.assign({}, LAB, { drain: a.drain }), X) / q0(X) - 1) },
  'ch10.drain-ratio': { args: { drain: 'chimney' }, doc: 'leak with the drain ÷ without', f: (a, X) => qLday(Object.assign({}, LAB, { drain: a.drain }), X) / q0(X) },
  'ch10.chim-x-m': { doc: 'where the chimney and its blanket begin, m downstream of the centre line', f: () => GEOM.drains.chimney.homogeneousX[0] },
  'ch10.chim-path-m': { doc: 'upstream toe to the start of the blanket drain, m', f: () => GEOM.drains.chimney.homogeneousX[0] - GEOM.dam.upToeX },
  'ch10.chim-path-ratio': { doc: 'the dam’s base ÷ the path to the blanket', f: () => BASE / (GEOM.drains.chimney.homogeneousX[0] - GEOM.dam.upToeX) },

  // ---- half and full cutoffs
  'ch10.half-depth-m': { doc: 'depth of the half cutoff, m', f: () => GEOM.groundZ - GEOM.cutoff.partialBottomZ },
  'ch10.half-path-m': { doc: 'the base plus down and up the half cutoff, m', f: () => BASE + 2 * (GEOM.groundZ - GEOM.cutoff.partialBottomZ) },
  'ch10.half-add-m': { doc: 'what the half cutoff adds to the path, down one side and up the other, m', f: () => 2 * (GEOM.groundZ - GEOM.cutoff.partialBottomZ) },
  'ch10.half-pred-pct': { doc: 'cut in the leak Darcy predicts from the longer path, %', f: () => 100 * (1 - BASE / (BASE + 2 * (GEOM.groundZ - GEOM.cutoff.partialBottomZ))) },
  'ch10.half-cut-pct': { doc: 'cut in the leak the lab finds with the half cutoff, %', f: (a, X) => 100 * (1 - qLday(Object.assign({}, LAB, { cut: 'partial' }), X) / q0(X)) },

  // ---- the reservoir
  'ch10.res-ratio-h': { args: { a: '0.95', b: '0.6' }, doc: 'reservoir depth at a ÷ at b', f: a => +a.a / +a.b },
  'ch10.res-ratio-q': { args: { a: '0.95', b: '0.6' }, doc: 'leak at reservoir a ÷ at b', f: (a, X) => qLday(Object.assign({}, LAB, { res: a.a }), X) / qLday(Object.assign({}, LAB, { res: a.b }), X) },

  // ---- the clay foundation: through and under
  'ch10.thru-lday': { args: LAB, doc: 'flow crossing the dam’s centre line inside the dam, L/day per metre', f: (a, X) => lab(a, X).q.passThroughDam * DAY * L_M3 },
  'ch10.under-lday': { args: LAB, doc: 'flow crossing the dam’s centre line under the dam, L/day per metre', f: (a, X) => lab(a, X).q.passUnderDam * DAY * L_M3 },
  'ch10.dup-run-m': { args: { res: '0.85' }, doc: 'horizontal run of the wetted upstream face, m', f: a => dup(a).run },
  'ch10.dup-corr-m': { args: { res: '0.85' }, doc: 'Casagrande’s entry correction, 0.3 × the run, m', f: a => dup(a).corr },
  'ch10.dup-xw-m': { args: { res: '0.85' }, doc: 'where the reservoir meets the upstream face, m upstream of the centre line', f: a => -(GEOM.dam.upToeX + dup(a).run) },
  'ch10.dup-d-m': { args: { res: '0.85' }, doc: 'entry point to the downstream toe, m', f: a => dup(a).d },
  'ch10.dup-2d-m': { args: { res: '0.85' }, doc: 'twice that, m', f: a => 2 * dup(a).d },
  'ch10.dup-h2': { args: { res: '0.85' }, doc: 'reservoir depth squared, m²', f: a => dup(a).h ** 2 },
  'ch10.dup-hd': { args: { res: '0.85' }, doc: 'h² ÷ 2d, m', f: a => dup(a).h ** 2 / (2 * dup(a).d) },
  'ch10.dup-qms': { args: { res: '0.85' }, doc: 'Dupuit’s flow through the fill, m³/s per metre', f: a => GEOM.k.fill * dup(a).h ** 2 / (2 * dup(a).d) },
  'ch10.dup-lday': { args: { res: '0.85' }, doc: 'Dupuit’s flow through the fill, L/day per metre', f: a => GEOM.k.fill * dup(a).h ** 2 / (2 * dup(a).d) * DAY * L_M3 },
  'ch10.casa-lday': { args: { res: '0.85' }, doc: 'Casagrande’s basic-parabola flow k(√(d² + h²) − d), L/day per metre', f: a => { const { h, d } = dup(a); return GEOM.k.fill * (Math.hypot(d, h) - d) * DAY * L_M3; } },
  'ch10.tight-under-lday': { args: { res: '0.85' }, doc: 'Darcy straight under the dam through the clay foundation, L/day per metre', f: a => GEOM.k.foundationTight * HW(a) / BASE * T * DAY * L_M3 },
  'ch10.tight-sum-lday': { args: { res: '0.85' }, doc: 'the two hand flows added, L/day per metre', f: a => GEOM.k.fill * dup(a).h ** 2 / (2 * dup(a).d) * DAY * L_M3 + GEOM.k.foundationTight * HW(a) / BASE * T * DAY * L_M3 },
  'ch10.tight-err-pct': { doc: 'hand sum below the solver’s leak, %', f: (a, X) => { const hand = GEOM.k.fill * dup(LAB).h ** 2 / (2 * dup(LAB).d) * DAY * L_M3 + GEOM.k.foundationTight * HW(LAB) / BASE * T * DAY * L_M3; return 100 * (1 - hand / qLday(Object.assign({}, LAB, { found: 'tight' }), X)); } },
  'ch10.casa-a-m': { args: { res: '0.85' }, doc: 'Casagrande’s length of the seepage face up the downstream slope, m', f: a => { const { h, d } = dup(a); return Math.hypot(d, h) - Math.sqrt(d * d - (h / Math.tan(alpha)) ** 2); } },
  'ch10.casa-face-m': { args: { res: '0.85' }, doc: 'its height, m', f: a => { const { h, d } = dup(a); return (Math.hypot(d, h) - Math.sqrt(d * d - (h / Math.tan(alpha)) ** 2)) * Math.sin(alpha); } },
  'ch10.third-m': { args: { res: '0.85' }, doc: 'a third of the reservoir depth, m (USBR rule of thumb)', f: a => HW(a) / 3 },

  // ---- a V-notch weir on the toe (illustrative)
  'ch10.cone-c': { doc: 'Cone’s coefficient in metric units', f: () => CONE_C },
  'ch10.weir-dam-m': { doc: 'length of the illustrative dam, m', f: () => WEIR_DAM_M },
  'ch10.weir-ls': { args: LAB, doc: 'that dam’s leak, L/s', f: (a, X) => qLday(a, X) * WEIR_DAM_M / DAY },
  'ch10.weir-m3s': { args: LAB, doc: 'that dam’s leak, m³/s', f: (a, X) => qLday(a, X) * WEIR_DAM_M / DAY / L_M3 },
  'ch10.weir-h-cm': { args: LAB, doc: 'head over a 90° V-notch passing it, cm', f: (a, X) => 100 * (qLday(a, X) * WEIR_DAM_M / DAY / L_M3 / CONE_C) ** (1 / 2.48) },
  'ch10.weir-yr-m3': { args: LAB, doc: 'that dam’s leak in a year, m³', f: (a, X) => qLday(a, X) * WEIR_DAM_M * 365 / L_M3 },

  // ---- question: toe drain or chimney on the clay foundation
  'ch10.choice-diff-lday': { doc: 'chimney leak minus toe-drain leak on the clay foundation, L/day per metre', f: (a, X) => qLday(Object.assign({}, LAB, { found: 'tight', drain: 'chimney' }), X) - qLday(Object.assign({}, LAB, { found: 'tight', drain: 'toe' }), X) },

  // ---- question: the sheet-pile wall (illustrative)
  'ch10.q1-k': { doc: 'the sand beside the sheet piles, m/s', f: () => SP.k },
  'ch10.q1-q': { doc: 'flow under the wall, m³/s per metre', f: () => SP.k * SP.H * SP.Nf / SP.Nd },
  'ch10.q1-day': { doc: 'flow under the wall, m³ a day per metre', f: () => SP.k * SP.H * SP.Nf / SP.Nd * DAY },
  'ch10.q1-dh': { doc: 'head lost in each drop, m', f: () => SP.H / SP.Nd }
};
