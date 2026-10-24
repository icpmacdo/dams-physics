/* Chapter 2's own number keys (book/SPEC.md E). Everything here is arithmetic on the numbers the
 * figures use (γw = 9.81 kN/m³ from the stress column, concrete at 23.5 kN/m³ and the 48 m base of the
 * Chapter 7 section from app-seep.js, the seepage lab's 20.4 m reservoir), plus a few literature values
 * written out below as named constants with their sources. */
'use strict';
const num = v => +v;
// literature constants (each carries a Source note where the page prints it)
const P_ATM = 101.325;   // kPa, sea-level pressure of the U.S. Standard Atmosphere, 1976
const RHO_AIR = 1.225;   // kg/m³, sea-level air density, same source
const RHO_HG = 13.595;   // relative density of mercury at 0 °C (the standard atmosphere is defined as 760 mm of it)
const REV_H = 175;       // m, height of Revelstoke Dam (BC Hydro, 2013 news release)
const REV_B = 126;       // m, its thickness at the base (BC Hydro, 2016 presentation)
// the chapter's own illustrative inputs
const SLOT_W = 2, SLOT_H = 50; // m, the slot of the opening question
const DAM7_H = 60;             // m, height of the Chapter 7 section (damPts in app-seep.js tops out at 60)
const SLOPE_N = 2;             // our dam's upstream face, 2H:1V

const gw = X => X.G.COL.GW;                         // 9.81 kN/m³
const F = (H, X) => X.G.depthCalc(H, 0).F;          // kN per metre, the figure's own push
const k8 = X => X.S.B / DAM7_H;                     // base width ÷ height of the Chapter 7 dam: 0.8
const wCoef = X => 0.5 * k8(X) * X.S.gc;            // weight above depth z = wCoef · z², kN per metre
const fCoef = X => 0.5 * gw(X);                     // push above depth z = fCoef · z²
const res = X => 0.85 * 24;                         // the seepage lab's reservoir, as lab.res-m

module.exports = {
  // ---- a tonne on every square metre
  'ch02.kn-kg': { doc: 'mass whose weight is one kilonewton, kg', f: (a, X) => 1000 / gw(X) },
  'ch02.tonnes-m2': { args: { h: '30' }, doc: 'pressure at depth h as tonnes of weight on each square metre', f: (a, X) => X.G.depthCalc(50, num(a.h)).p / gw(X) },
  'ch02.atm-m': { doc: 'height of water whose pressure equals the standard atmosphere, m', f: (a, X) => P_ATM / gw(X) },
  'ch02.atm-hg-cm': { doc: 'height of mercury whose pressure equals the standard atmosphere, cm', f: (a, X) => P_ATM / (RHO_HG * gw(X)) * 100 },
  'ch02.abs-kpa': { args: { h: '30' }, doc: 'absolute pressure at depth h (gauge + standard atmosphere), kPa', f: (a, X) => X.G.depthCalc(50, num(a.h)).p + P_ATM },
  'ch02.air-kpa': { args: { h: '30' }, doc: 'pressure change over h metres of sea-level air, kPa', f: (a, X) => RHO_AIR * 9.81 * num(a.h) / 1000 },
  'ch02.air-ratio': { doc: 'water (1,000 kg/m³) ÷ sea-level air density', f: () => 1000 / RHO_AIR },

  // ---- the push, and how it grows
  'ch02.tonnes': { args: { H: '50' }, doc: 'push per metre of dam as tonnes of weight, unrounded (½·H² for water)', f: (a, X) => F(num(a.H), X) / gw(X) },
  'ch02.F-ratio': { args: { a: '100', b: '50' }, doc: 'push at depth a ÷ push at depth b', f: (a, X) => F(num(a.a), X) / F(num(a.b), X) },
  'ch02.bottom-half-pct': { doc: 'share of the push carried by the bottom half of the face, % (1 − (1/2)²)', f: (a, X) => 100 * (1 - F(50, X) / F(100, X)) },
  'ch02.bottom-half-kn': { args: { H: '50' }, doc: 'push on the bottom half of a face holding H metres of water, kN per metre', f: (a, X) => F(num(a.H), X) - F(num(a.H) / 2, X) },
  'ch02.bottom-pct': { doc: 'share of the push carried by the bottom third of the face, % (1 − (2/3)²)', f: (a, X) => 100 * (1 - F(100 * 2 / 3, X) / F(100, X)) },
  'ch02.M-ratio': { args: { a: '100', b: '50' }, doc: 'tipping moment at depth a ÷ at depth b', f: (a, X) => (F(num(a.a), X) * num(a.a)) / (F(num(a.b), X) * num(a.b)) },
  'ch02.slot-tonnes': { doc: 'the water in the slot, tonnes per metre of dam (2 m × 50 m × 1 t/m³)', f: () => SLOT_W * SLOT_H * 1 },
  'ch02.slot-floor-m2': { doc: 'the slot’s floor under each metre of dam, m² (2 m × 1 m)', f: () => SLOT_W * 1 },
  'ch02.slot-face-m2': { doc: 'the dam’s wet face on each metre of dam, m² (50 m × 1 m)', f: () => SLOT_H * 1 },
  'ch02.face-avg-t-m2': { doc: 'average pressure on the 50 m face, as tonnes on each square metre (half the pressure at the foot)', f: (a, X) => X.G.depthCalc(SLOT_H, SLOT_H).p / gw(X) / 2 },
  'ch02.slot-ratio': { doc: 'the slot’s push ÷ the slot’s own weight', f: (a, X) => F(SLOT_H, X) / gw(X) / (SLOT_W * SLOT_H) },

  // ---- why a gravity dam is a triangle (a section 0.8z wide at depth z, as the Chapter 7 dam)
  'ch02.tri-k': { doc: 'base width ÷ height of the Chapter 7 section', f: (a, X) => k8(X) },
  'ch02.tri-w-coef': { doc: 'weight of concrete above depth z, ÷ z², kN per metre', f: (a, X) => wCoef(X) },
  'ch02.tri-f-coef': { doc: 'push of water above depth z, ÷ z², kN per metre', f: (a, X) => fCoef(X) },
  'ch02.tri-ratio': { doc: 'weight above any level ÷ push above it', f: (a, X) => wCoef(X) / fCoef(X) },
  'ch02.tri-w-kn': { args: { z: '30' }, doc: 'weight of the triangle above depth z, kN per metre', f: (a, X) => wCoef(X) * num(a.z) ** 2 },
  'ch02.tri-f-kn': { args: { z: '30' }, doc: 'push above depth z, kN per metre', f: (a, X) => fCoef(X) * num(a.z) ** 2 },
  'ch02.tri-mw-coef': { doc: 'weight × its lever arm about the toe (⅔ of the width), ÷ z³', f: (a, X) => wCoef(X) * (2 / 3) * k8(X) },
  'ch02.tri-mf-coef': { doc: 'push × its lever arm (z/3), ÷ z³', f: (a, X) => fCoef(X) / 3 },
  'ch02.tri-tip-ratio': { doc: 'resisting moment ÷ tipping moment at any level of the triangle', f: (a, X) => (wCoef(X) * (2 / 3) * k8(X)) / (fCoef(X) / 3) },
  'ch02.tri-area-m2': { args: { z: '50' }, doc: 'area of the triangle down to depth z, m² per metre', f: (a, X) => 0.5 * k8(X) * num(a.z) ** 2 },
  'ch02.rect-b-m': { args: { z: '50' }, doc: 'width of a rectangle holding the same concrete as the triangle to depth z', f: (a, X) => 0.5 * k8(X) * num(a.z) },
  'ch02.rect-ratio': { args: { z: '10', b: '20' }, doc: 'weight ÷ push above depth z for a wall b metres thick', f: (a, X) => num(a.b) * num(a.z) * X.S.gc / F(num(a.z), X) },
  'ch02.rect-tip': { args: { z: '50', b: '20' }, doc: 'resisting ÷ tipping moment at depth z for a wall b metres thick', f: (a, X) => (num(a.b) * num(a.z) * X.S.gc * num(a.b) / 2) / (F(num(a.z), X) * num(a.z) / 3) },
  'ch02.rev-ratio': { doc: 'Revelstoke Dam: base thickness ÷ height', f: () => REV_B / REV_H },

  // ---- water on a sloping face: our dam, 2H:1V upstream, the lab's reservoir
  'ch02.slope-run-m': { doc: 'horizontal run of the wet face, m', f: (a, X) => SLOPE_N * res(X) },
  'ch02.slope-h-kn': { doc: 'horizontal push on the face, kN per metre', f: (a, X) => F(res(X), X) },
  'ch02.slope-v-kn': { doc: 'vertical push: the weight of water standing on the face, kN per metre', f: (a, X) => 0.5 * SLOPE_N * res(X) * res(X) * gw(X) },
  'ch02.slope-ratio': { doc: 'vertical ÷ horizontal push on the face', f: (a, X) => (0.5 * SLOPE_N * res(X) * res(X) * gw(X)) / F(res(X), X) },
  'ch02.slope-wedge-m2': { doc: 'the wedge of water standing on the face, m³ per metre of dam', f: (a, X) => 0.5 * SLOPE_N * res(X) * res(X) },
  'ch02.slope-tan': { doc: 'across ÷ down: the tangent of the whole push’s angle from the vertical', f: (a, X) => F(res(X), X) / (0.5 * SLOPE_N * res(X) * res(X) * gw(X)) },
  'ch02.slope-r-kn': { doc: 'the whole push on the face, kN per metre', f: (a, X) => Math.hypot(F(res(X), X), 0.5 * SLOPE_N * res(X) * res(X) * gw(X)) },
  'ch02.slope-r-deg': { doc: 'angle of the whole push from the vertical', f: (a, X) => Math.atan(F(res(X), X) / (0.5 * SLOPE_N * res(X) * res(X) * gw(X))) / X.deg },
  'ch02.slope-deg': { doc: 'angle of a 2H:1V face from the horizontal', f: (a, X) => Math.atan(1 / SLOPE_N) / X.deg }
};
