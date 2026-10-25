/* Chapter 6's own number keys (book/SPEC.md E). The hydro numbers are arithmetic on the hydro panel of
 * fig-types (app-core.js @fig-hydro: hydroCalc, η = 0.90, 9.81 kN/m³, svg y at 2 px per metre). The beach,
 * spillway and pond numbers are illustrative: their inputs are the named constants below, and the prose
 * calls them illustrative where it uses them. */
'use strict';
const num = v => +v;
// ---- illustrative inputs (the prose says "illustrative" where each is used)
const D_SAND = 0.1, D_SLIME = 0.01;  // mm: a fine-sand grain and a slime (silt-sized) grain
const K_SLIMES = 1e-8;               // m/s: slimes, ten times slower than the silt (10⁻⁷) of Chapter 3's race
const N_GAP = 0.4;                   // gap fraction for both, round (the race's silt has 0.40)
const WEIR_C = 2.0;                  // m^½/s: a spillway crest coefficient between Design of Small Dams' 1.70 and 2.21
const WEIR_L = 50;                   // m of spillway crest
const LVL_SPILL = 25, LVL_FLOOD = 28, LVL_CREST = 30; // m above the base: spillway crest (normal level), design-flood level, dam crest
const DAM_CREST_W = 8, DAM_SLOPE = 2; // the drawn embankment: crest width (m) and slopes (H:V)
const POND_A = 2e6, POND_V = 3e6;    // m², m³: a tailings pond and the volume its design flood brings
const C_BROAD_FT = 3.087;            // ft^½/s: Design of Small Dams (1987), §9.12(a), the broad-crested weir's theoretical coefficient
const C_OGEE_FT = 4.0;               // ft^½/s: the same, §9.12(d), unretarded flow over a high ogee weir
const FT = 0.3048;                   // m in a foot (exact)

const hyd = (a, X) => X.C.hydroCalc(num(a.level), num(a.Q));
const gw = X => X.G.COL.GW; // 9.81
const weirQ = h => WEIR_C * WEIR_L * Math.pow(h, 1.5);
const tsandK = X => X.ST.BUILD.materials.find(m => m.key === 'tsand').k;
const H_DES = LVL_FLOOD - LVL_SPILL;
const HQ = { level: '80', Q: '150' };

module.exports = {
  // ---- the hydro panel, worked by hand
  'ch06.eta': { doc: 'turbine–generator efficiency the hydro panel uses (P ÷ (γw·Q·H))', f: (a, X) => { const c = hyd(HQ, X); return c.Pmw * 1000 / (gw(X) * 150 * c.H); } },
  'ch06.kj-m3': { args: { level: '80' }, doc: 'energy a cubic metre of water gives up falling the head H, kJ (γw·H)', f: (a, X) => gw(X) * hyd({ level: a.level, Q: '150' }, X).H },
  'ch06.kw-gross': { args: Object.assign({}, HQ), doc: 'γw·Q·H before losses, kW', f: (a, X) => gw(X) * num(a.Q) * hyd(a, X).H },
  'ch06.kw': { args: Object.assign({}, HQ), doc: 'the panel’s power in kW', f: (a, X) => hyd(a, X).Pmw * 1000 },
  'ch06.kw-per-q': { args: { level: '100' }, doc: 'power per m³/s of turbine flow, η·γw·H, kW', f: (a, X) => hyd({ level: a.level, Q: '1' }, X).Pmw * 1000 },
  'ch06.tw-m': { doc: 'depth of the tailwater over the base, m (heel depth − H)', f: (a, X) => { const c = hyd(HQ, X); return c.depth - c.H; } },
  'ch06.heel-kpa': { args: Object.assign({}, HQ), doc: 'pressure at the heel, kPa', f: (a, X) => hyd(a, X).pMPa * 1000 },
  'ch06.heel-kn': { args: Object.assign({}, HQ), doc: 'water load on each metre of dam, kN', f: (a, X) => hyd(a, X).Fmn * 1000 },
  'ch06.p-h-kpa': { args: Object.assign({}, HQ), doc: 'γw·H, the pressure the head H would give, kPa', f: (a, X) => gw(X) * hyd(a, X).H },
  'ch06.f-h-kn': { args: Object.assign({}, HQ), doc: '½·γw·H², the load the head H would give, kN per metre', f: (a, X) => 0.5 * gw(X) * hyd(a, X).H ** 2 },
  'ch06.tw-kpa': { doc: 'pressure of the 4 m of water between the tailwater and the heel, kPa', f: (a, X) => { const c = hyd(HQ, X); return gw(X) * (c.depth - c.H); } },
  'ch06.under-pct': { doc: 'how far short the load from H falls, %', f: (a, X) => { const c = hyd(HQ, X); return 100 * (1 - (c.H / c.depth) ** 2); } },
  'ch06.power-factor': { doc: 'power at the highest level ÷ at the lowest, at 150 m³/s', f: (a, X) => hyd({ level: '100', Q: '150' }, X).Pmw / hyd({ level: '0', Q: '150' }, X).Pmw },
  'ch06.load-factor': { doc: 'water load at the highest level ÷ at the lowest', f: (a, X) => hyd({ level: '100', Q: '150' }, X).Fmn / hyd({ level: '0', Q: '150' }, X).Fmn },
  'ch06.depth-ratio': { doc: 'heel depth at the highest level ÷ at the lowest', f: (a, X) => hyd({ level: '100', Q: '150' }, X).depth / hyd({ level: '0', Q: '150' }, X).depth },

  // ---- why the beach sorts (illustrative grains and slimes)
  'ch06.d-sand-mm': { doc: 'illustrative fine-sand grain, mm', f: () => D_SAND },
  'ch06.d-slime-mm': { doc: 'illustrative slime grain, mm', f: () => D_SLIME },
  'ch06.d-ratio': { doc: 'sand grain ÷ slime grain diameter', f: () => D_SAND / D_SLIME },
  'ch06.settle-ratio': { doc: 'settling speed ratio, (d ratio)² (Stokes)', f: () => (D_SAND / D_SLIME) ** 2 },
  'ch06.k-slimes': { doc: 'illustrative permeability of slimes, m/s', f: () => K_SLIMES },
  'ch06.k-ratio': { doc: 'tailings sand (workbench) ÷ slimes permeability', f: (a, X) => tsandK(X) / K_SLIMES },
  'ch06.n': { doc: 'illustrative gap fraction of both', f: () => N_GAP },
  'ch06.t-sand-s': { doc: 'time for water to cross 1 m of tailings sand at gradient 1, s (n ÷ k)', f: (a, X) => N_GAP / tsandK(X) },
  'ch06.t-sand-h': { doc: 'the same, hours', f: (a, X) => N_GAP / tsandK(X) / 3600 },
  'ch06.t-slimes-s': { doc: 'time for water to cross 1 m of slimes at gradient 1, s', f: () => N_GAP / K_SLIMES },
  'ch06.t-slimes-day': { doc: 'the same, days', f: () => N_GAP / K_SLIMES / 86400 },
  'ch06.t-slimes-yr': { doc: 'the same, years of 365.25 days', f: () => N_GAP / K_SLIMES / 86400 / 365.25 },

  // ---- the spillway (illustrative)
  'ch06.weir-c': { doc: 'illustrative crest coefficient, m^½/s', f: () => WEIR_C },
  'ch06.weir-l': { doc: 'illustrative crest length, m', f: () => WEIR_L },
  'ch06.weir-h': { doc: 'illustrative flood rise over the spillway crest, m', f: () => H_DES },
  'ch06.root-h': { args: { h: '3' }, doc: '√h', f: a => Math.sqrt(num(a.h)) },
  'ch06.h15': { args: { h: '3' }, doc: 'h^1.5 = h·√h', f: a => Math.pow(num(a.h), 1.5) },
  'ch06.weir-q': { args: { h: '3' }, doc: 'flow over the illustrative spillway, m³/s (C·L·h^1.5)', f: a => weirQ(num(a.h)) },
  'ch06.weir-q-per-m': { args: { h: '3' }, doc: 'flow over each metre of the illustrative crest, m³/s (C·h^1.5)', f: a => weirQ(num(a.h)) / WEIR_L },
  'ch06.weir-h2': { doc: 'rise that passes twice the design flow, m', f: () => H_DES * Math.pow(2, 2 / 3) },
  'ch06.weir-h2-ratio': { doc: '2^(2/3): how much higher the rise for twice the flow', f: () => Math.pow(2, 2 / 3) },
  'ch06.weir-h15-2': { doc: 'h^1.5 for twice the design flow (2 × 3^1.5)', f: () => 2 * Math.pow(H_DES, 1.5) },
  'ch06.weir-q2': { doc: 'twice the design flow, m³/s', f: () => 2 * weirQ(H_DES) },
  'ch06.fb-left-m': { doc: 'what is left of the freeboard when twice the design flow passes, m', f: () => LVL_CREST - LVL_SPILL - H_DES * Math.pow(2, 2 / 3) },
  'ch06.h-110': { doc: 'rise over the crest for a flood 10% above the design flow, m (h ∝ Q^⅔)', f: () => H_DES * Math.pow(1.1, 2 / 3) },
  'ch06.h-110-pct': { doc: 'how much higher that rise is, %', f: () => 100 * (Math.pow(1.1, 2 / 3) - 1) },
  'ch06.r-110': { doc: '1.1^(2/3): the rise for a flood 10% above the design flow, as a multiple of the design rise', f: () => Math.pow(1.1, 2 / 3) },
  'ch06.fb-110': { doc: 'freeboard left in that flood, m', f: () => LVL_CREST - LVL_SPILL - H_DES * Math.pow(1.1, 2 / 3) },
  'ch06.lvl-flood2': { doc: 'lake level when twice the design flow passes, m', f: () => LVL_SPILL + H_DES * Math.pow(2, 2 / 3) },
  'ch06.lvl-spill': { doc: 'spillway crest = normal level, m above the base', f: () => LVL_SPILL },
  'ch06.lvl-flood': { doc: 'design-flood level, m', f: () => LVL_FLOOD },
  'ch06.lvl-crest': { doc: 'dam crest, m', f: () => LVL_CREST },
  'ch06.fb-min': { doc: 'freeboard at the design flood (crest − flood level), m', f: () => LVL_CREST - LVL_FLOOD },
  'ch06.fb-norm': { doc: 'freeboard at the normal level (crest − normal level), m', f: () => LVL_CREST - LVL_SPILL },
  'ch06.dam-base-m': { doc: 'base width of the drawn embankment, m (crest + 2 × slope × height)', f: () => DAM_CREST_W + 2 * DAM_SLOPE * LVL_CREST },
  'ch06.dam-crest-w': { doc: 'crest width of the drawn embankment, m', f: () => DAM_CREST_W },
  'ch06.c-broad-si': { doc: 'Design of Small Dams’ broad-crested coefficient 3.087 ft^½/s, in m^½/s', f: () => C_BROAD_FT * Math.sqrt(FT) },
  'ch06.c-broad-theory': { doc: 'broad-crested weir from critical flow, (2/3)^1.5·√g, m^½/s', f: (a, X) => Math.pow(2 / 3, 1.5) * Math.sqrt(gw(X)) },
  'ch06.c-ogee-si': { doc: 'Design of Small Dams’ high ogee crest, 4.0 ft^½/s, in m^½/s', f: () => C_OGEE_FT * Math.sqrt(FT) },

  // ---- a tailings pond with no spillway (illustrative)
  'ch06.pond-a-km2': { doc: 'illustrative pond area, km²', f: () => POND_A / 1e6 },
  'ch06.pond-v-mm3': { doc: 'illustrative design-flood volume, million m³', f: () => POND_V / 1e6 },
  'ch06.pond-rise-m': { doc: 'rise of the pond if it stores the flood, m', f: () => POND_V / POND_A }
};
