/* Figure-namespace number keys (book/SPEC.md Appendix 4). Each returns what the figure's own code
 * computes, in the units its name says. Arguments default to the figure's state on load; they
 * arrive as strings. tests/test-book.js checks every <span data-n="key"> on the page against these,
 * and checks the defaults against the values Appendix 4 records. */
'use strict';
const num = v => +v;
const beach = X => X.G.beachShapes(240, 241, 2);
const coneH = (X, t) => Math.sqrt(beach(X).A * t) / 5; // cm (5 px per cm)
const darcySt = (a, X) => Object.assign({}, X.G.DARCY0, { mat: a.mat, plug: a.plug === '1' || a.plug === 'true', hl: +a.hl, hr: +a.hr, L: +a.L });
const DARCY = { mat: 'sand', plug: '0', hl: '2', hr: '0.6', L: '2' };
const raceT = (a, X) => X.G.raceTime(X.G.MATS[a.mat]); // s to cross 1 m at gradient 1
const COLARG = { wt: '4' };
const hydro = (a, X) => X.C.hydroCalc(+a.level, +a.Q);
const raise = (a, X) => X.C.raiseDam(a.method, X.C.stateAt(+a.t));
const LAB = { dam: 'homogeneous', drain: 'none', cut: 'none', found: 'pervious', res: '0.85' };
const lab = (a, X) => X.seep({ damType: a.dam, drain: a.drain, cutoff: a.cut, foundation: a.found, reservoir: +a.res });
const UP = { hw: '57', drains: '1' };
const upl = (a, X) => X.S.upliftCalc(+a.hw, X.S.upliftDrainHead(a.drains === '1', +a.hw));
const BENCH = { preset: 'homogeneous', slope: '2', found: 'clay', cut: 'none', res: '0.85', uprock: 'none' };
const bench = (a, X) => X.bench({ preset: a.preset, slope: a.slope, found: a.found, cut: a.cut, res: a.res, uprock: a.uprock });
const slice = (a, X) => bench(a, X).crit.slices[+a.i];
const mat = (a, X) => X.ST.BUILD.materials.find(m => m.key === a.mat);
const SLICE = Object.assign({ i: '12' }, BENCH);

module.exports = {
  // ---- constants the code uses
  'const.gw': { doc: 'unit weight of water, kN/m³', f: (a, X) => X.G.COL.GW },
  'const.gconc': { doc: 'unit weight of concrete in fig-uplift, kN/m³', f: (a, X) => X.S.gc },

  // ---- fig-beach
  'beach.repose-deg': { doc: 'the dry heap’s angle', f: (a, X) => Math.atan(beach(X).TAN.dry) / X.deg },
  'beach.gsat': { doc: 'soaked sand, kN/m³', f: (a, X) => X.G.G_SAT },
  'beach.gprime': { doc: 'buoyant unit weight of the soaked sand, kN/m³', f: (a, X) => X.G.G_SAT - X.G.G_W },
  'beach.tan-drain': { doc: '(γ′/γsat)·tan 34°', f: (a, X) => beach(X).tanDrain },
  'beach.drain-deg': { doc: 'the draining face’s angle', f: (a, X) => Math.atan(beach(X).tanDrain) / X.deg },
  'beach.area-cm2': { doc: 'the castle’s section area (5 px per cm)', f: (a, X) => beach(X).A / 25 },
  'beach.cone-h-cm': { doc: 'height of a 34° cone holding the same sand', f: (a, X) => coneH(X, beach(X).tan34) },
  'beach.cone-base-cm': { doc: 'base width of that cone', f: (a, X) => 2 * coneH(X, beach(X).tan34) / beach(X).tan34 },

  // ---- fig-depth
  'depth.p-kpa': { args: { h: '30' }, doc: 'pressure at depth h, kPa', f: (a, X) => X.G.depthCalc(50, num(a.h)).p },
  'depth.pb-kpa': { args: { H: '50' }, doc: 'pressure at the foot, kPa', f: (a, X) => X.G.depthCalc(num(a.H), 0).pb },
  'depth.pb-mpa': { args: { H: '50' }, doc: 'pressure at the foot, MPa', f: (a, X) => X.G.depthCalc(num(a.H), 0).pb / 1000 },
  'depth.F-kn': { args: { H: '50' }, doc: 'push per metre of dam, kN', f: (a, X) => X.G.depthCalc(num(a.H), 0).F },
  'depth.F-mn': { args: { H: '50' }, doc: 'push per metre of dam, MN', f: (a, X) => X.G.depthCalc(num(a.H), 0).F / 1000 },
  'depth.tonnes': { args: { H: '50' }, doc: 'the readout’s "as heavy as" (rounded as the figure rounds it)', f: (a, X) => { const F = X.G.depthCalc(num(a.H), 0).F, s = F > 2000 ? 10 : 1; return Math.round(F / 9.81 / s) * s; } },
  'depth.arm-m': { args: { H: '50' }, doc: 'height of the push above the foot, H/3', f: a => num(a.H) / 3 },
  'depth.moment-mnm': { args: { H: '50' }, doc: 'tipping moment about the foot, MN·m per metre', f: (a, X) => X.G.depthCalc(num(a.H), 0).F * num(a.H) / 3 / 1000 },

  // ---- fig-race
  'race.k': { args: { mat: 'sand' }, doc: 'permeability, m/s', f: (a, X) => X.G.MATS[a.mat].k },
  'race.n': { args: { mat: 'sand' }, doc: 'gap fraction', f: (a, X) => X.G.MATS[a.mat].n },
  'race.t-s': { args: { mat: 'sand' }, doc: 'time to cross 1 m at gradient 1, s', f: raceT },
  'race.t-min': { args: { mat: 'sand' }, doc: 'the same, minutes', f: (a, X) => raceT(a, X) / 60 },
  'race.t-day': { args: { mat: 'sand' }, doc: 'the same, days', f: (a, X) => raceT(a, X) / 86400 },
  'race.t-yr': { args: { mat: 'sand' }, doc: 'the same, years of 365.25 days', f: (a, X) => raceT(a, X) / 86400 / 365.25 },
  'race.bar-km': { doc: 'clay’s bar in km if gravel’s time were 1 mm', f: (a, X) => X.G.raceTime(X.G.MATS.clay) / X.G.raceTime(X.G.MATS.gravel) / 1e6 },

  // ---- fig-darcy
  'darcy.dh-m': { args: DARCY, doc: 'head difference, m', f: (a, X) => Math.abs(X.G.darcyReadouts(darcySt(a, X)).dh) },
  'darcy.i': { args: DARCY, doc: 'average gradient', f: (a, X) => X.G.darcyReadouts(darcySt(a, X)).i },
  'darcy.q-ms': { args: DARCY, doc: 'flow per m², m/s', f: (a, X) => X.G.darcyReadouts(darcySt(a, X)).q },
  'darcy.q-lmin': { args: DARCY, doc: 'flow per m², L/min', f: (a, X) => X.G.darcyReadouts(darcySt(a, X)).q * 1000 * 60 },
  'darcy.q-lday': { args: DARCY, doc: 'flow per m², L/day', f: (a, X) => X.G.darcyReadouts(darcySt(a, X)).q * 1000 * 86400 },
  'darcy.q-lyr': { args: DARCY, doc: 'flow per m², L/year', f: (a, X) => X.G.darcyReadouts(darcySt(a, X)).q * 1000 * 86400 * 365.25 },
  'darcy.v-ms': { args: DARCY, doc: 'speed of a drop: flow ÷ gap fraction, m/s', f: (a, X) => X.G.darcyReadouts(darcySt(a, X)).q / X.G.MATS[a.mat].n },
  'darcy.cross-h': { args: DARCY, doc: 'hours for a drop to cross the pipe', f: (a, X) => +a.L / (X.G.darcyReadouts(darcySt(a, X)).q / X.G.MATS[a.mat].n) / 3600 },
  'darcy.share-pct': { args: Object.assign({}, DARCY, { plug: '1' }), doc: 'share of the head lost in the plug, %', f: (a, X) => 100 * X.G.darcyReadouts(darcySt(a, X)).share },
  'darcy.r-sand-s': { args: DARCY, doc: 'resistance L/k of the soil part of the pipe, s', f: (a, X) => (1 - (X.G.DARCY_PLUG[1] - X.G.DARCY_PLUG[0])) * +a.L / X.G.MATS[a.mat].k },
  'darcy.r-clay-s': { args: DARCY, doc: 'resistance L/k of the clay plug, s', f: (a, X) => (X.G.DARCY_PLUG[1] - X.G.DARCY_PLUG[0]) * +a.L / X.G.MATS.clay.k },
  'darcy.ratio-noplug': { args: DARCY, doc: 'flow without the plug ÷ flow with it', f: (a, X) => X.G.darcyKEff(darcySt(Object.assign({}, a, { plug: '0' }), X)) / X.G.darcyKEff(darcySt(Object.assign({}, a, { plug: '1' }), X)) },

  // ---- fig-block
  'block.W-kn': { doc: 'the block’s weight, kN', f: (a, X) => X.G.BLOCK.W },
  'block.phi-deg': { doc: 'its friction angle', f: (a, X) => X.G.BLOCK.PHI / X.deg },
  'block.tanphi': { doc: 'tan of the friction angle', f: (a, X) => Math.tan(X.G.BLOCK.PHI) },
  'block.a-deg': { doc: 'the ramp on load', f: (a, X) => X.G.BLOCK.a },
  'block.N-kn': { args: { a: '25', u: '0' }, doc: 'press into the ramp, kN', f: (a, X) => X.G.blockForces(+a.a, +a.u).N },
  'block.U-kn': { args: { a: '25', u: '0' }, doc: 'cushion force, kN', f: (a, X) => X.G.blockForces(+a.a, +a.u).U },
  'block.Ne-kn': { args: { a: '25', u: '0' }, doc: 'press left, kN', f: (a, X) => X.G.blockForces(+a.a, +a.u).Ne },
  'block.Fa-kn': { args: { a: '25', u: '0' }, doc: 'friction available, kN', f: (a, X) => X.G.blockForces(+a.a, +a.u).Fa },
  'block.Fn-kn': { args: { a: '25', u: '0' }, doc: 'pull down the ramp, kN', f: (a, X) => X.G.blockForces(+a.a, +a.u).Fn },
  'block.fs': { args: { a: '25', u: '0' }, doc: 'factor of safety', f: (a, X) => X.G.blockForces(+a.a, +a.u).fs },
  'block.u-slide-kpa': { args: { a: '25' }, doc: 'cushion pressure at which it slides, kPa', f: (a, X) => { const f = X.G.blockForces(+a.a, 0); return f.N - f.Fn / Math.tan(X.G.BLOCK.PHI); } },
  'block.slide-pct': { args: { a: '25' }, doc: 'that pressure as a share of the press, %', f: (a, X) => { const f = X.G.blockForces(+a.a, 0); return 100 * (f.N - f.Fn / Math.tan(X.G.BLOCK.PHI)) / f.N; } },

  // ---- fig-column (wt: metres of the water table below ground; negative above)
  'column.s-kpa': { args: COLARG, doc: 'total stress at 10 m, kPa', f: (a, X) => X.G.columnReadouts(+a.wt).sB },
  'column.u-kpa': { args: COLARG, doc: 'pore pressure at 10 m, kPa', f: (a, X) => X.G.columnReadouts(+a.wt).uB },
  'column.e-kpa': { args: COLARG, doc: 'effective stress at 10 m, kPa', f: (a, X) => X.G.columnReadouts(+a.wt).eB },
  'column.str-pct': { args: COLARG, doc: 'strength left, % of the dry column’s', f: (a, X) => { const { ZB, GD } = X.G.COL; return 100 * X.G.columnReadouts(+a.wt).eB / (GD * ZB); } },
  'column.gd-kn': { doc: 'damp sand, kN/m³', f: (a, X) => X.G.COL.GD },
  'column.gs-kn': { doc: 'soaked sand, kN/m³', f: (a, X) => X.G.COL.GS },

  // ---- fig-types, the hydro panel
  'hydro.H-m': { args: { level: '80', Q: '150' }, doc: 'head to the tailwater, m', f: (a, X) => hydro(a, X).H },
  'hydro.depth-m': { args: { level: '80', Q: '150' }, doc: 'water depth at the heel, m', f: (a, X) => hydro(a, X).depth },
  'hydro.p-mpa': { args: { level: '80', Q: '150' }, doc: 'pressure at the heel, MPa', f: (a, X) => hydro(a, X).pMPa },
  'hydro.F-mn': { args: { level: '80', Q: '150' }, doc: 'water load per metre, MN', f: (a, X) => hydro(a, X).Fmn },
  'hydro.P-mw': { args: { level: '80', Q: '150' }, doc: 'power, MW', f: (a, X) => hydro(a, X).Pmw },
  'hydro.arm-m': { args: { level: '80', Q: '150' }, doc: 'height of the load above the heel, m', f: (a, X) => hydro(a, X).depth / 3 },
  'hydro.q-for-mw': { args: { P: '200', level: '100' }, doc: 'turbine flow for P megawatts, m³/s', f: (a, X) => +a.P * 1000 / (0.9 * 9.81 * X.C.hydroCalc(+a.level, 1).H) },

  // ---- fig-raise (method up, centre, down; t the stage slider)
  'raise.fill-m2': { args: { method: 'up', t: '10' }, doc: 'fill per metre of dam, m³', f: (a, X) => raise(a, X).fillA },
  'raise.shift-m': { args: { method: 'up', t: '10' }, doc: 'crest shift, m', f: (a, X) => raise(a, X).shift },
  'raise.ontail-pct': { args: { method: 'up', t: '10' }, doc: 'share of the fill resting on tailings, %', f: (a, X) => { const d = raise(a, X); return d.fillA ? 100 * d.tailA / d.fillA : 0; } },
  'raise.starter-m2': { doc: 'the starter dam, m³ per metre (stage 1.5: starter built, nothing raised)', f: (a, X) => X.C.raiseDam('up', X.C.stateAt(1.5)).fillA },
  'raise.dyke-m2': { doc: 'one upstream dyke, m³ per metre (stage 3 less stage 1.5)', f: (a, X) => X.C.raiseDam('up', X.C.stateAt(3)).fillA - X.C.raiseDam('up', X.C.stateAt(1.5)).fillA },

  // ---- fig-lab
  'lab.q-lday': { args: LAB, doc: 'seepage, L/day per metre', f: (a, X) => lab(a, X).q.inflowTotal * 86400 * 1000 },
  'lab.i-exit': { args: LAB, doc: 'largest unfiltered exit gradient', f: (a, X) => X.S.labPiping(lab(a, X).exit).imax },
  'lab.fs': { args: LAB, doc: 'safety against piping', f: (a, X) => X.S.labPiping(lab(a, X).exit).fs },
  'lab.face-m': { args: LAB, doc: 'height of the seepage face, m', f: (a, X) => lab(a, X).seepageFace.topZ },
  'lab.face-pct': { args: LAB, doc: 'share of the flow leaving through the face, %', f: (a, X) => { const r = lab(a, X); return 100 * r.q.outSeepageFace / r.q.inflowTotal; } },
  'lab.floor-lday': { args: LAB, doc: 'flow entering through the reservoir floor, L/day per metre', f: (a, X) => lab(a, X).q.inflowFloor * 86400 * 1000 },
  'lab.damface-lday': { args: LAB, doc: 'flow entering through the upstream face, L/day per metre', f: (a, X) => lab(a, X).q.inflowDamFace * 86400 * 1000 },
  'lab.res-m': { args: { res: '0.85' }, doc: 'reservoir depth, m', f: a => +a.res * 24 },
  'lab.tube-ratio': { doc: 'flow per foundation tube ÷ flow per dam tube, on load', f: (a, X) => { const r = X.seep({}), nd = r.flowlines.filter(f => f.group === 'dam').length, nf = r.flowlines.filter(f => f.group === 'foundation').length; return (r.q.inflowFloor / (nf + 1)) / (r.q.inflowDamFace / (nd + 1)); } },

  // ---- fig-uplift
  'uplift.area-m2': { doc: 'the section’s area, m²', f: (a, X) => X.S.W / X.S.gc },
  'uplift.W-mn': { doc: 'weight per metre, MN', f: (a, X) => X.S.W / 1000 },
  'uplift.F-mn': { args: { hw: '57' }, doc: 'push net of tailwater, MN per metre', f: (a, X) => X.S.upliftCalc(+a.hw, X.S.upliftDrainHead(true, +a.hw)).H / 1000 },
  'uplift.ud-m': { args: UP, doc: 'head at the drain line, m', f: (a, X) => X.S.upliftDrainHead(a.drains === '1', +a.hw) },
  'uplift.U-mn': { args: UP, doc: 'uplift per metre, MN', f: (a, X) => upl(a, X).U / 1000 },
  'uplift.U-pct': { args: UP, doc: 'uplift as a share of the weight, %', f: (a, X) => 100 * upl(a, X).U / X.S.W },
  'uplift.fs': { args: UP, doc: 'sliding safety, (W − U)·tan 45° / F', f: (a, X) => upl(a, X).FS },
  'uplift.xr': { args: UP, doc: 'resultant from the heel, × B', f: (a, X) => upl(a, X).xR / X.S.B },
  'uplift.fs-phi': { args: Object.assign({ phi: '45' }, UP), doc: 'sliding safety with friction angle phi', f: (a, X) => upl(a, X).FS * Math.tan(+a.phi * X.deg) },
  'uplift.hw-cross': { args: { drains: '0', target: '1.5' }, doc: 'reservoir level where the sliding safety crosses target, m', f: (a, X) => {
    let lo = 30, hi = 59; const fs = hw => upl({ hw: String(hw), drains: a.drains }, X).FS - +a.target;
    if (fs(lo) * fs(hi) > 0) return NaN;
    for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (fs(lo) * fs(m) <= 0) hi = m; else lo = m; }
    return (lo + hi) / 2; } },

  // ---- fig-build, the workbench
  'bench.q-lday': { args: BENCH, doc: 'seepage, L/day per metre', f: (a, X) => bench(a, X).m.qLday },
  'bench.pipe': { args: BENCH, doc: 'safety against piping', f: (a, X) => bench(a, X).m.pipe },
  'bench.fos': { args: BENCH, doc: 'downstream slope factor of safety, full reservoir', f: (a, X) => bench(a, X).m.fos },
  'bench.fos-up': { args: BENCH, doc: 'upstream slope factor of safety, reservoir emptied fast', f: (a, X) => bench(a, X).m.fosUp },
  'bench.clay-m3': { args: BENCH, doc: 'clay used, m³ per metre (cells)', f: (a, X) => bench(a, X).m.clay },
  'bench.cells': { args: BENCH, doc: 'cells in the dam', f: (a, X) => bench(a, X).m.damCells },
  'bench.drain-cells': { args: BENCH, doc: 'cells of filter and drain sand in the dam', f: (a, X) => { const s = bench(a, X).seep; let n = 0; for (let i = 0; i < s.mat.length; i++) if (s.mat[i] >= 10 && X.ST.BUILD.materials[s.mat[i] - 10].key === 'filter') n++; return n; } },
  'bench.face-m': { args: BENCH, doc: 'top of the seepage face, m', f: (a, X) => bench(a, X).m.seepageFaceTop },
  'bench.ru': { args: BENCH, doc: 'share of the slices’ weight the water carries on the critical surface (r_u)', f: (a, X) => bench(a, X).crit.ru },
  'bench.fos-nowater': { args: BENCH, doc: 'the critical surface with no water pressure', f: (a, X) => bench(a, X).crit.fosNoWater },
  'bench.tried': { args: BENCH, doc: 'slip surfaces tried downstream', f: (a, X) => bench(a, X).stab.downstream.tried },
  'bench.crit-xc': { args: BENCH, doc: 'centre of the critical downstream circle, x from the dam’s centre line, m', f: (a, X) => bench(a, X).crit.xc },
  'bench.crit-zc': { args: BENCH, doc: 'its centre’s height above the original ground, m', f: (a, X) => bench(a, X).crit.zc },
  'bench.crit-r-m': { args: BENCH, doc: 'its radius, m', f: (a, X) => bench(a, X).crit.R },
  'bench.crit-entry-x': { args: BENCH, doc: 'where it leaves the crest or upper slope, x, m', f: (a, X) => bench(a, X).crit.entry[0] },
  'bench.crit-exit-x': { args: BENCH, doc: 'where it comes out at or beyond the toe, x, m', f: (a, X) => bench(a, X).crit.exit[0] },
  'bench.crit-depth-m': { args: BENCH, doc: 'its greatest depth below the surface, m', f: (a, X) => bench(a, X).crit.depth },
  'bench.slices-n': { args: BENCH, doc: 'number of slices on the critical surface', f: (a, X) => bench(a, X).crit.slices.length },
  'bench.slice-x': { args: SLICE, doc: 'x of slice i’s centre, m', f: (a, X) => slice(a, X).x },
  'bench.slice-zb': { args: SLICE, doc: 'height of slice i’s base at its centre, m', f: (a, X) => slice(a, X).zb },
  'bench.slice-zt': { args: SLICE, doc: 'height of the ground surface over slice i, m', f: (a, X) => slice(a, X).zt },
  'bench.slice-b': { args: SLICE, doc: 'width of slice i of the critical circle, m', f: (a, X) => slice(a, X).b },
  'bench.slice-w-kn': { args: SLICE, doc: 'its weight, kN per metre', f: (a, X) => slice(a, X).W },
  'bench.slice-u-kpa': { args: SLICE, doc: 'water pressure at its base, kPa', f: (a, X) => slice(a, X).u },
  'bench.slice-alpha-deg': { args: SLICE, doc: 'inclination of its base (the circle’s tangent at its centre)', f: (a, X) => { const c = bench(a, X).crit, s = c.slices[+a.i]; return Math.asin((c.xc - s.x) / c.R) / X.deg; } },
  'bench.goal': { args: { mission: 'dry', goal: 'minFoS' }, doc: 'a mission’s target (goal: maxQ, minPipe, minFoS, minFoSUp, maxClay, minTsand; minTsand as a fraction)', f: (a, X) => {
    const m = X.ST.BUILD.missions.find(q => q.id === a.mission), k = m && Object.keys(m.goals).find(g => g.toLowerCase() === String(a.goal).toLowerCase());
    return k ? m.goals[k] : NaN; } },
  'bench.min-depth-m': { doc: 'shallowest slip the check counts, m', f: (a, X) => X.ST.BUILD.minDepth },
  'bench.mat-phi': { args: { mat: 'fill' }, doc: 'friction angle, degrees', f: (a, X) => mat(a, X).phi },
  'bench.mat-c': { args: { mat: 'fill' }, doc: 'cohesion, kPa', f: (a, X) => mat(a, X).c },
  'bench.mat-gs': { args: { mat: 'fill' }, doc: 'saturated unit weight, kN/m³', f: (a, X) => mat(a, X).gs },
  'bench.mat-gm': { args: { mat: 'fill' }, doc: 'moist unit weight, kN/m³', f: (a, X) => mat(a, X).gm },
  'bench.mat-k': { args: { mat: 'fill' }, doc: 'permeability, m/s', f: (a, X) => mat(a, X).k },

  // ---- fig-grains, the sandbox's model parameters (its outputs are trends only: SPEC 0.3.15)
  'grains.cav-kpa': { doc: 'the lowest water pressure the model allows before the water cavitates, model kPa* (negative)', f: (a, X) => -X.grains().uCav },
  'grains.mu': { doc: 'contact friction coefficient between grains', f: (a, X) => X.grains().mu }
};
