/* Chapter 7's own number keys (book/SPEC.md E). Everything here is arithmetic on what fig-uplift's
 * pure block in app-seep.js computes (X.S: W, B, TW, gc, gw, upliftDrainHead, upliftCalc), so the
 * worked examples print exactly the figure's numbers. Two things the block does not export are
 * recovered from what it does:
 *   - the drain line's distance from the heel, from the straight-line head it gives with the drains
 *     clogged (TW + (HW − TW)·(1 − XD/B), so XD = 6 m);
 *   - where the weight acts, and where the resultant would cross the base with no water under the
 *     dam, from upliftCalc's resultant and its own uplift profile (the moments it sums).
 * The level-by-level check of Lévy's condition (the After note of the film) needs the section's
 * shape above any level; that is written out below from damPts in app-seep.js and checked against
 * the block's weight, so a change to the section fails here instead of drifting. */
'use strict';
const num = v => +v;
const UP = { hw: '57', drains: '1' };
const isOn = a => a.drains === '1';

const ud = (a, X) => X.S.upliftDrainHead(isOn(a), num(a.hw));            // head at the drain line, m
const calc = (a, X) => X.S.upliftCalc(num(a.hw), ud(a, X));                // { U, H, FS, xR, Hup, prof }
const xd = X => X.S.B * (1 - (X.S.upliftDrainHead(false, 57) - X.S.TW) / (57 - X.S.TW)); // 6 m
// the head diagram under the base, split at the drain line: [heel→drains, drains→toe], m of head × m
function segs(a, X) {
  const h1 = num(a.hw), h2 = ud(a, X), h3 = X.S.TW, x = xd(X), B = X.S.B;
  return [{ mean: (h1 + h2) / 2, len: x }, { mean: (h2 + h3) / 2, len: B - x }];
}
// moment of the uplift about the toe, summed exactly as upliftCalc sums it
function upMomentToe(r, X) {
  let m = 0;
  for (let i = 0; i < 2; i++) {
    const [x1, h1] = r.prof[i], [x2, h2] = r.prof[i + 1], L = x2 - x1, f = X.S.gw * (h1 + h2) / 2 * L;
    m += f * (X.S.B - (x1 + (L / 3) * (h1 + 2 * h2) / (h1 + h2)));
  }
  return m;
}
// where the resultant of the weight and the water's push alone (no uplift) crosses the base, m from the heel
function x0(a, X) {
  const r = calc(a, X), W = X.S.W, B = X.S.B;
  const Mtoe = (W - r.U) * (B - r.xR) + upMomentToe(r, X);   // W·(B − xW) + Htw·TW/3 − Hup·HW/3
  return B - Mtoe / W;
}
const fTw = X => 0.5 * X.S.gw * X.S.TW * X.S.TW;               // the tailwater's push, kN
const fUp = (hw, X) => 0.5 * X.S.gw * hw * hw;                  // the reservoir's push, kN
const pushMoment = (a, X) => fUp(num(a.hw), X) * num(a.hw) / 3 - fTw(X) * X.S.TW / 3; // about the base, kN·m
const heel = (V, x, B) => V / B * (4 - 6 * x / B);             // Eq. (heel): straight-line base pressure

// the section's shape (damPts in app-seep.js): an 8 m column 60 m tall, and a triangle from the
// column's downstream side at 50 m down to the toe 48 m from the heel
const DAM_H = 60, CREST_W = 8, KNEE = 50;
const widthAt = (z, X) => z >= KNEE ? CREST_W : CREST_W + (X.S.B - CREST_W) * (KNEE - z) / KNEE;
function above(z, X) { // area (m² per m) and centroid (m from the upstream face) of the section above level z
  const rect = CREST_W * (DAM_H - z), w = widthAt(z, X);
  const tri = z < KNEE ? 0.5 * (w - CREST_W) * (KNEE - z) : 0;
  const A = rect + tri, xg = (rect * CREST_W / 2 + tri * (CREST_W + (w - CREST_W) / 3)) / A;
  if (Math.abs(above0(X) - X.S.W / X.S.gc) > 1e-9) throw new Error('the Chapter 7 section in ch07.js no longer matches damPts in app-seep.js');
  return { A, xg };
}
function above0(X) { return CREST_W * DAM_H + 0.5 * (X.S.B - CREST_W) * KNEE; }
// Lévy's condition at level z (reservoir at hw, no water inside the joint): pressure at the upstream
// end of the joint from the weight above and the water's push above, against the water's pressure there
function levy(z, hw, X) {
  const { A, xg } = above(z, X), V = X.S.gc * A, d = hw - z, F = 0.5 * X.S.gw * d * d, B = widthAt(z, X);
  const x = xg + F * (d / 3) / V;
  return { V, B, x, heel: heel(V, x, B), water: X.S.gw * d, A, xg, F };
}

module.exports = {
  // ---- the section and its loads (ex-concrete-clogged and the opening sums)
  'ch07.h-m': { doc: 'height of the section, m (damPts)', f: () => DAM_H },
  'ch07.crest-m': { doc: 'width of the crest column, m (damPts)', f: () => CREST_W },
  'ch07.tri-h-m': { doc: 'height of the triangle leaning on the column, m (damPts)', f: (a, X) => { above(0, X); return KNEE; } },
  'ch07.tri-b-m': { doc: 'base of that triangle, m (damPts)', f: (a, X) => X.S.B - CREST_W },
  'ch07.b-m': { doc: 'base width B, m', f: (a, X) => X.S.B },
  'ch07.tw-m': { doc: 'tailwater depth, m', f: (a, X) => X.S.TW },
  'ch07.hw-m': { doc: 'reservoir depth on load, m', f: (a, X) => X.S.HW0 },
  'ch07.xd-m': { doc: 'the drain line’s distance from the heel, m', f: (a, X) => xd(X) },
  'ch07.base-ratio': { doc: 'base width ÷ height', f: (a, X) => X.S.B / DAM_H },
  'ch07.w-kn': { doc: 'weight per metre, kN', f: (a, X) => X.S.W },
  'ch07.fup-kn': { args: { hw: '57' }, doc: 'push of the reservoir on the upstream face, kN per metre', f: (a, X) => fUp(num(a.hw), X) },
  'ch07.ftw-kn': { doc: 'push of the tailwater back on the dam, kN per metre', f: (a, X) => fTw(X) },
  'ch07.f-kn': { args: { hw: '57' }, doc: 'push net of tailwater, kN per metre (the figure’s F)', f: (a, X) => X.S.upliftCalc(num(a.hw), X.S.upliftDrainHead(true, num(a.hw))).H },
  'ch07.depth2-m2': { args: { hw: '57' }, doc: 'hw² − TW², m²', f: (a, X) => num(a.hw) ** 2 - X.S.TW ** 2 },
  'ch07.w-over-f': { args: { hw: '57' }, doc: 'weight ÷ net push; also the factor of safety with no water under the dam at tan φ = 1', f: (a, X) => X.S.W / X.S.upliftCalc(num(a.hw), X.S.upliftDrainHead(true, num(a.hw))).H },
  'ch07.p-kpa': { args: { h: '57' }, doc: 'water pressure h metres below the surface, kPa', f: (a, X) => X.S.gw * num(a.h) },

  // ---- uplift, both states (ex-concrete-clogged, ex-concrete-full)
  'ch07.diff-m': { args: { hw: '57' }, doc: 'reservoir head above tailwater, m', f: (a, X) => num(a.hw) - X.S.TW },
  'ch07.mean-m': { args: { hw: '57' }, doc: 'mean head under the base with no drains, m', f: (a, X) => (num(a.hw) + X.S.TW) / 2 },
  'ch07.seg-mean-m': { args: Object.assign({ seg: '1' }, UP), doc: 'mean head over one part of the base (1 heel→drains, 2 drains→toe), m', f: (a, X) => segs(a, X)[num(a.seg) - 1].mean },
  'ch07.seg-len-m': { args: { seg: '1' }, doc: 'length of that part of the base, m', f: (a, X) => segs(UP, X)[num(a.seg) - 1].len },
  'ch07.seg-m2': { args: Object.assign({ seg: '1' }, UP), doc: 'area of that part of the head diagram, m of head × m', f: (a, X) => { const s = segs(a, X)[num(a.seg) - 1]; return s.mean * s.len; } },
  'ch07.uarea-m2': { args: UP, doc: 'area of the whole head diagram under the base, m of head × m', f: (a, X) => calc(a, X).U / X.S.gw },
  'ch07.u-kn': { args: UP, doc: 'uplift per metre, kN', f: (a, X) => calc(a, X).U },
  'ch07.v-kn': { args: UP, doc: 'weight less uplift, the press left on the rock, kN per metre', f: (a, X) => X.S.W - calc(a, X).U },
  'ch07.v-mn': { args: UP, doc: 'the same in MN per metre; with tan φ = 1 it is also the rock’s grip', f: (a, X) => (X.S.W - calc(a, X).U) / 1000 },
  'ch07.drop-m': { args: { hw: '57' }, doc: 'how much working drains lower the head at the drain line, m', f: (a, X) => X.S.upliftDrainHead(false, num(a.hw)) - X.S.upliftDrainHead(true, num(a.hw)) },
  'ch07.u-share': { args: UP, doc: 'uplift ÷ weight', f: (a, X) => calc(a, X).U / X.S.W },
  'ch07.u-ratio': { args: { hw: '57' }, doc: 'uplift with the drains clogged ÷ with them working', f: (a, X) => calc({ hw: a.hw, drains: '0' }, X).U / calc({ hw: a.hw, drains: '1' }, X).U },
  'ch07.hmean-m': { doc: 'the section’s mean height over its base (area ÷ B), m', f: (a, X) => X.S.W / X.S.gc / X.S.B },
  'ch07.wmean-kpa': { doc: 'the weight spread over the base, W ÷ B, kPa', f: (a, X) => X.S.W / X.S.B },
  'ch07.umean-kpa': { args: { hw: '57' }, doc: 'mean water pressure under the base with no drains, kPa', f: (a, X) => X.S.gw * (num(a.hw) + X.S.TW) / 2 },

  // ---- the sliding check against the reservoir level
  'ch07.dfdh-kn': { args: { hw: '57' }, doc: 'extra push for one more metre of reservoir, about γw·hw, kN per metre', f: (a, X) => X.S.gw * num(a.hw) },
  // W − U = target·F written out for the clogged state: target·(γw/2)·h² + (γw·B/2)·h − (W − (γw·B/2)·TW + target·(γw/2)·TW²) = 0
  'ch07.fcoef': { doc: 'γw/2, the push per square metre of depth², kN', f: (a, X) => X.S.gw / 2 },
  'ch07.qa': { args: { target: '1.5' }, doc: 'target × γw/2, the h² coefficient', f: (a, X) => num(a.target) * X.S.gw / 2 },
  'ch07.qc': { args: { target: '1.5' }, doc: 'the constant term, kN', f: (a, X) => X.S.W - X.S.gw * X.S.B / 2 * X.S.TW + num(a.target) * fTw(X) },
  'ch07.qroot-m': { args: { target: '1.5' }, doc: 'positive root of that quadratic, m (agrees with uplift.hw-cross)', f: (a, X) => { const A = num(a.target) * X.S.gw / 2, Bq = X.S.gw * X.S.B / 2, Cq = X.S.W - Bq * X.S.TW + num(a.target) * fTw(X); return (-Bq + Math.sqrt(Bq * Bq + 4 * A * Cq)) / (2 * A); } },
  'ch07.dudh-kn': { doc: 'extra uplift for one more metre of reservoir with no drains, γw·B/2, kN per metre', f: (a, X) => X.S.gw * X.S.B / 2 },

  // ---- how hard concrete grips rock (ex-concrete-phi)
  'ch07.tan': { args: { deg: '35' }, doc: 'tangent of an angle in degrees', f: a => Math.tan(num(a.deg) * Math.PI / 180) },
  'ch07.tan-slide': { args: UP, doc: 'tan φ at which the dam would slide (FS = 1)', f: (a, X) => 1 / calc(a, X).FS },
  'ch07.phi-slide-deg': { args: UP, doc: 'friction angle at which the dam would slide, degrees', f: (a, X) => Math.atan(1 / calc(a, X).FS) / X.deg },
  // US Army Corps of Engineers' drain effectiveness E (EM 1110-2-2200, 3-3.d(1)(c)): the drain-line
  // head is tailwater plus (1 − E) of what the straight line gives there
  'ch07.ud-e-m': { args: { e: '50' }, doc: 'drain-line head with drain effectiveness e %, m', f: (a, X) => X.S.TW + (1 - num(a.e) / 100) * (X.S.upliftDrainHead(false, 57) - X.S.TW) },
  'ch07.e-usbr-pct': { doc: 'the drain effectiveness the one-third rule amounts to at full reservoir, % of the straight-line head above tailwater at the drain line', f: (a, X) => { const s = X.S.upliftDrainHead(false, 57), d = X.S.upliftDrainHead(true, 57); return 100 * (s - d) / (s - X.S.TW); } },
  'ch07.fs-e': { args: { e: '50' }, doc: 'sliding factor of safety with drain effectiveness e %, full reservoir', f: (a, X) => X.S.upliftCalc(57, X.S.TW + (1 - num(a.e) / 100) * (X.S.upliftDrainHead(false, 57) - X.S.TW)).FS },

  // ---- the middle third and Lévy's condition at the base (ex-concrete-third)
  'ch07.third-b-m': { args: { k: '1' }, doc: 'k thirds of the base, m from the heel', f: (a, X) => num(a.k) * X.S.B / 3 },
  'ch07.xr-m': { args: UP, doc: 'where the resultant (with uplift) crosses the base, m from the heel', f: (a, X) => calc(a, X).xR },
  'ch07.xw-m': { args: { hw: '57' }, doc: 'where the weight acts, m from the heel', f: (a, X) => x0(a, X) - pushMoment(a, X) / X.S.W },
  'ch07.mom-knm': { args: { hw: '57' }, doc: 'moment of the net push about the base, kN·m per metre', f: (a, X) => pushMoment(a, X) },
  'ch07.mup-knm': { args: { hw: '57' }, doc: 'moment of the reservoir’s push about the base, kN·m per metre', f: (a, X) => fUp(num(a.hw), X) * num(a.hw) / 3 },
  'ch07.mtw-knm': { doc: 'moment of the tailwater’s push about the base, kN·m per metre', f: (a, X) => fTw(X) * X.S.TW / 3 },
  'ch07.shift-m': { args: { hw: '57' }, doc: 'how far downstream of the weight the push moves the resultant, m', f: (a, X) => pushMoment(a, X) / X.S.W },
  'ch07.x0-m': { args: { hw: '57' }, doc: 'where weight and push alone (no uplift) cross the base, m from the heel', f: (a, X) => x0(a, X) },
  'ch07.heel-term': { args: { hw: '57' }, doc: '6·x/B for that resultant', f: (a, X) => 6 * x0(a, X) / X.S.B },
  'ch07.heel-factor': { args: { hw: '57' }, doc: '4 − 6·x/B for that resultant', f: (a, X) => 4 - 6 * x0(a, X) / X.S.B },
  'ch07.heel-kpa': { args: { hw: '57' }, doc: 'pressure of the concrete on the rock at the heel, no water inside the joint, kPa', f: (a, X) => heel(X.S.W, x0(a, X), X.S.B) },
  'ch07.vb-kpa': { args: UP, doc: 'the press left, (W − U) ÷ B, kPa', f: (a, X) => (X.S.W - calc(a, X).U) / X.S.B },
  'ch07.heel-u-kpa': { args: UP, doc: 'heel pressure from the resultant with uplift: (W − U)/B · (4 − 6·xR/B), kPa', f: (a, X) => { const r = calc(a, X); return heel(X.S.W - r.U, r.xR, X.S.B); } },
  'ch07.levy-ratio': { args: { hw: '57' }, doc: 'that heel pressure ÷ the reservoir’s pressure at the heel', f: (a, X) => heel(X.S.W, x0(a, X), X.S.B) / (X.S.gw * num(a.hw)) },

  // ---- Lévy's condition higher up (the film's After note): z m above the base
  'ch07.levy-heel-kpa': { args: { z: '30', hw: '57' }, doc: 'pressure at the upstream end of the joint z m up, kPa', f: (a, X) => levy(num(a.z), num(a.hw), X).heel },
  'ch07.levy-water-kpa': { args: { z: '30', hw: '57' }, doc: 'the water’s pressure there, kPa', f: (a, X) => levy(num(a.z), num(a.hw), X).water },
  'ch07.levy-z-ratio': { args: { z: '30', hw: '57' }, doc: 'the one ÷ the other', f: (a, X) => { const l = levy(num(a.z), num(a.hw), X); return l.heel / l.water; } },
  // the smallest margin anywhere from 1 m up to just below the water line, every 0.1 m (the base is
  // checked in ex-concrete-third with the tailwater included; this scan leaves the tailwater out above it)
  'ch07.levy-min-up': { args: { hw: '57' }, doc: 'smallest heel ÷ water ratio from 1 m above the base to the water line', f: (a, X) => {
    let m = Infinity; for (let z = 1; z < num(a.hw) - 0.05; z += 0.1) { const l = levy(z, num(a.hw), X); m = Math.min(m, l.heel / l.water); } return m; } }
};
