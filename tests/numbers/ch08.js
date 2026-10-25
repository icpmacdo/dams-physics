/* Chapter 8's own number keys (book/SPEC.md E). The fill and crest arithmetic works from the raise
 * figure's own geometry (R in app-core.js @fig-raise: a 20 m starter, four 12 m raises, an 8 m crest,
 * 2H:1V faces), and each definition checks itself against raiseDam() where the figure prints the
 * same number, so a change to the figure fails here instead of leaving the prose behind.
 * The rate-of-rise mine is illustrative: its inputs are the named constants below, and the prose
 * says "illustrative". The 2.5 m a year is the upper end of the rule of thumb in SANCOLD (2020), §4.6. */
'use strict';
const num = v => +v;
// the illustrative mine of ex-raising-rate
const TPD = 50000;      // tonnes of dry tailings a day
const RHO_D = 1.4;      // t/m³, dry density of the settled deposit (illustrative)
const AREA = 2;         // km², area of the deposit's surface
const LIMIT = 2.5;      // m a year, upper end of SANCOLD's 2–2½ m rule of thumb for upstream dams

const R = X => X.C.R;
const at = (key, t, X) => X.C.raiseDam(key, X.C.stateAt(t));
// a dam section h tall with the figure's crest and 2:1 faces: a crest band c·h and two triangles s·h²/2
const trap = (h, X) => R(X).c * h + R(X).s * h * h;
const dyke = X => at('up', 3, X).fillA - at('up', 1.5, X).fillA;           // one upstream dyke
const wedge = X => at('centre', 10, X).tailA / R(X).n;                       // one centreline wedge on the beach
const same = (a, b, what) => { if (Math.abs(a - b) > 1e-6) throw new Error(`${what}: ${a} against the figure's ${b}`); return a; };
const top = X => R(X).h0 + R(X).n * R(X).dh;                                 // 68 m
// fill per metre of dam for a dam h tall, raised continuously at the figure's rates
const fillUp = (h, X) => trap(R(X).h0, X) + (h - R(X).h0) * dyke(X) / R(X).dh;
const fillCl = (h, X) => R(X).s / 2 * h * h + R(X).c * h + R(X).s / 2 * R(X).h0 ** 2 + (h - R(X).h0) * wedge(X) / R(X).dh;
const m3day = (a) => num(a.tpd) / num(a.rho);
const mm3yr = (a) => m3day(a) * 365 / 1e6;

module.exports = {
  // ---- the figure's geometry (givens)
  'ch08.h0-m': { doc: 'starter dam height, m', f: (a, X) => R(X).h0 },
  'ch08.dh-m': { doc: 'height of each raise, m', f: (a, X) => R(X).dh },
  'ch08.crest-m': { doc: 'crest width, m', f: (a, X) => R(X).c },
  'ch08.top-m': { doc: 'height after four raises, m', f: (a, X) => top(X) },
  'ch08.raised-m': { doc: 'height added by the four raises, m', f: (a, X) => top(X) - R(X).h0 },

  // ---- ex-raising-fill: the fill bill
  'ch08.a-m2': { args: { h: '68' }, doc: 'section of a dam h tall with an 8 m crest and 2:1 faces, m² (m³ per metre of dam); checked against the figure at 12, 20 and 68 m',
    f: (a, X) => {
      const h = num(a.h), v = trap(h, X);
      if (h === R(X).h0) same(v, at('up', 1.5, X).fillA, 'starter');
      if (h === R(X).dh) same(v, dyke(X), 'one dyke');
      if (h === top(X)) same(v, at('down', 10, X).fillA, 'downstream dam');
      return v;
    } },
  'ch08.a-up-m2': { args: { h: '34' }, doc: 'upstream dam h tall, raised continuously: starter + one dyke per 12 m, m²', f: (a, X) => { if (num(a.h) === top(X)) same(fillUp(top(X), X), at('up', 10, X).fillA, 'upstream dam'); return fillUp(num(a.h), X); } },
  'ch08.a-cl-m2': { args: { h: '34' }, doc: 'centreline dam h tall, raised continuously: h² + 8h + 20² + one wedge per 12 m, m²', f: (a, X) => { if (num(a.h) === top(X)) same(fillCl(top(X), X), at('centre', 10, X).fillA, 'centreline dam'); return fillCl(num(a.h), X); } },
  'ch08.wedge-m2': { doc: 'one centreline raise’s upstream wedge on the beach, m² (½ × 24 × 12)', f: (a, X) => same(wedge(X), 0.5 * R(X).s * R(X).dh * R(X).dh, 'wedge') },
  'ch08.half-starter-m2': { doc: 'the starter’s upstream triangle, m² (½ × 20 × 40)', f: (a, X) => R(X).s / 2 * R(X).h0 ** 2 },
  'ch08.last-down-m2': { doc: 'the last downstream raise alone, m² (A(68) − A(56))', f: (a, X) => same(trap(top(X), X) - trap(top(X) - R(X).dh, X), at('down', 10, X).fillA - at('down', 7.5, X).fillA, 'last downstream raise') },
  'ch08.last-dykes': { doc: 'the last downstream raise, in upstream dykes', f: (a, X) => (trap(top(X), X) - trap(top(X) - R(X).dh, X)) / dyke(X) },
  'ch08.double-factor': { doc: 'downstream fill at 68 m ÷ at 34 m', f: (a, X) => trap(top(X), X) / trap(top(X) / 2, X) },
  'ch08.ratio-up': { doc: 'upstream fill at 68 m ÷ at 34 m', f: (a, X) => fillUp(top(X), X) / fillUp(top(X) / 2, X) },
  'ch08.ratio-cl': { doc: 'centreline fill at 68 m ÷ at 34 m', f: (a, X) => fillCl(top(X), X) / fillCl(top(X) / 2, X) },
  'ch08.down-up': { doc: 'downstream fill ÷ upstream fill at 68 m', f: (a, X) => at('down', 10, X).fillA / at('up', 10, X).fillA },
  'ch08.base-w-m': { args: { h: '62' }, doc: 'base width of a dam h tall with an 8 m crest and 2:1 faces, m (= dA/dh)', f: (a, X) => R(X).c + 2 * R(X).s * num(a.h) },
  'ch08.mid-last-m': { doc: 'height halfway up the last raise, m', f: (a, X) => top(X) - R(X).dh / 2 },

  // ---- ex-raising-crest: where the crest goes, and what it stands on
  'ch08.up-step-m': { doc: 'upstream crest step per raise, m (2 × 12 + 4)', f: (a, X) => same(R(X).s * R(X).dh + R(X).c / 2, -at('up', 10, X).shift / R(X).n, 'upstream step') },
  'ch08.up-walk-m': { doc: 'how far the upstream crest walks toward the pond over four raises, m', f: (a, X) => -at('up', 10, X).shift },
  'ch08.half-crest-m': { doc: 'half the crest width, m', f: (a, X) => R(X).c / 2 },
  'ch08.starter-reach-m': { doc: 'from the starter’s crest centre to its upstream toe, m (2 × 20 + 4)', f: (a, X) => R(X).s * R(X).h0 + R(X).c / 2 },
  'ch08.beyond-m': { doc: 'how far the final upstream crest stands beyond the starter’s upstream toe, m', f: (a, X) => -at('up', 10, X).shift - (R(X).s * R(X).h0 + R(X).c / 2) },
  'ch08.toe-walk-m': { doc: 'how far the downstream dam’s toe moves out over the four raises, m (4 m per metre of rise)', f: (a, X) => 2 * R(X).s * (top(X) - R(X).h0) },
  'ch08.up-tail-m2': { doc: 'upstream fill resting on tailings, m² (four dykes)', f: (a, X) => same(R(X).n * dyke(X), at('up', 10, X).tailA, 'upstream on tailings') },
  'ch08.cl-tail-m2': { doc: 'centreline fill resting on the beach, m² (four wedges)', f: (a, X) => at('centre', 10, X).tailA },
  'ch08.up-share': { doc: 'share of the upstream fill on tailings, as a fraction', f: (a, X) => at('up', 10, X).tailA / at('up', 10, X).fillA },
  'ch08.cl-share': { doc: 'share of the centreline fill on the beach, as a fraction', f: (a, X) => at('centre', 10, X).tailA / at('centre', 10, X).fillA },

  // ---- ex-raising-rate: how fast the deposit rises (illustrative mine)
  'ch08.tpd': { args: { tpd: String(TPD) }, doc: 'tonnes of dry tailings a day (illustrative)', f: a => num(a.tpd) },
  'ch08.m3-day': { args: { tpd: String(TPD), rho: String(RHO_D) }, doc: 'volume of settled tailings a day, m³', f: a => m3day(a) },
  'ch08.mm3-yr': { args: { tpd: String(TPD), rho: String(RHO_D) }, doc: 'volume a year, millions of m³', f: a => mm3yr(a) },
  'ch08.rise-m-yr': { args: { tpd: String(TPD), rho: String(RHO_D), area: String(AREA) }, doc: 'rate of rise over a deposit of the given area (km²), m a year', f: a => mm3yr(a) / num(a.area) },
  'ch08.raise-years': { args: { tpd: String(TPD), rho: String(RHO_D), area: String(AREA) }, doc: 'years between 12 m raises at that rate', f: (a, X) => R(X).dh / (mm3yr(a) / num(a.area)) },
  'ch08.raise-months': { args: { tpd: String(TPD), rho: String(RHO_D), area: String(AREA) }, doc: 'months between 12 m raises at that rate', f: (a, X) => 12 * R(X).dh / (mm3yr(a) / num(a.area)) },
  'ch08.area-km2': { args: { tpd: String(TPD), rho: String(RHO_D), rate: String(LIMIT) }, doc: 'area that keeps the rise to the given rate, km²', f: a => mm3yr(a) / num(a.rate) }
};
