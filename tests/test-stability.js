/* Tests for src/stability-solver.js
 *
 * 1. Closed-form checks: planar (Culmann) wedge, infinite slope dry and with seepage
 *    parallel to the slope, Taylor's stability number for a vertical cut in clay.
 * 2. A published benchmark (ACADS 1(a), from memory: see the note at that check).
 * 3. Bishop vs Spencer on circles.
 * 4. Monotonic sanity checks, on simple slopes and on the coupled dam model.
 * 5. "Build your own dam": every mission's start design fails it, the intended fix
 *    passes, and the obvious wrong fixes fail.
 * 6. Robustness: random paintings converge, give finite factors of safety, and finish
 *    within the page's time budget. */
'use strict';
const path = require('path');
const ST = require(path.join(__dirname, '..', 'src', 'stability-solver.js'));
const SS = require(path.join(__dirname, '..', 'src', 'seepage-solver.js'));

let passes = 0, fails = 0;
function check(name, ok, detail) {
  if (ok) passes++; else fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
}
const DEG = Math.PI / 180, GW = ST.GAMMA_W;
const f3 = v => (isFinite(v) ? v.toFixed(3) : String(v));
const rel = (a, b) => Math.abs(a / b - 1);
// one-material model with closed-form pore pressure and unit weight functions
const model = (surface, mat, opt) => Object.assign({
  surface, zBottom: -60, materials: [mat], matAt: () => 0, uAt: () => 0, gammaAt: () => mat.gm, minDepth: 0.3
}, opt || {});

// ---------------------------------------------------------------- 1. closed form
{
  // planar wedge through the toe of a 10 m, 2H:1V slope, plane at 20 degrees
  const surf = [[-40, 10], [0, 10], [20, 0], [60, 0]];
  const psi = 20 * DEG, xa = 20 - 10 / Math.tan(psi);
  const m0 = model(surf, { c: 0, phi: 30, gm: 20, gs: 20 });
  const sl0 = ST.polySlices(m0, [[xa, 10], [20, 0]], 60);
  const exact0 = Math.tan(30 * DEG) / Math.tan(psi);
  const sp0 = ST.spencer(sl0).F;
  check('Culmann wedge, c\' = 0: Spencer = tan(phi)/tan(psi)', rel(sp0, exact0) < 1e-6, `${f3(sp0)} vs ${f3(exact0)}`);
  const m1 = model(surf, { c: 10, phi: 25, gm: 20, gs: 20 });
  const sl1 = ST.polySlices(m1, [[xa, 10], [20, 0]], 60);
  const W = 20 * (0.5 * -xa * 10), Lp = Math.hypot(20 - xa, 10);
  const exact1 = (10 * Lp + W * Math.cos(psi) * Math.tan(25 * DEG)) / (W * Math.sin(psi));
  const sp1 = ST.spencer(sl1).F;
  check('Culmann wedge with cohesion: Spencer = (c\'L + W cos psi tan phi) / (W sin psi), within 0.1%', rel(sp1, exact1) < 1e-3, `${f3(sp1)} vs ${f3(exact1)}`);
}
{
  // infinite slope, tan(beta) = 0.5, phi' = 30, c' = 0: a slab 1 m deep and 190 m long.
  // The short end wedges add a little resistance (passive wedge at the toe ~ depth^2),
  // so the slab's FoS sits slightly above the infinite-slope value and approaches it as
  // the slab gets thinner.
  const tb = 0.5, beta = Math.atan(tb), surf = [[-50, 100], [0, 100], [200, 0], [300, 0]];
  const sz = x => ST.surfZ(surf, x);
  const slab = d => { const p = [[4, sz(4)], [5, sz(5) - d]]; for (let x = 20; x <= 180; x += 20) p.push([x, sz(x) - d]); p.push([195, sz(195) - d], [196, sz(196)]); return p; };
  const dryM = model(surf, { c: 0, phi: 30, gm: 20, gs: 20 });
  const wetM = model(surf, { c: 0, phi: 30, gm: 20, gs: 20 }, { uAt: (x, z) => GW * (sz(x) - z) * Math.cos(beta) ** 2 });
  const dry = ST.spencer(ST.polySlices(dryM, slab(1), 120)).F, dryHalf = ST.spencer(ST.polySlices(dryM, slab(0.5), 120)).F;
  const wet = ST.spencer(ST.polySlices(wetM, slab(1), 120)).F;
  const eDry = Math.tan(30 * DEG) / tb, eWet = (20 - GW) / 20 * eDry;
  check('infinite slope, dry: FoS within 2.5% of tan(phi)/tan(beta), above it (end wedges)', dry >= eDry && rel(dry, eDry) < 0.025, `${f3(dry)} vs ${f3(eDry)}`);
  check('infinite slope, dry: thinner slab is closer to the infinite-slope value', rel(dryHalf, eDry) < rel(dry, eDry), `${f3(dryHalf)} (0.5 m) vs ${f3(dry)} (1 m)`);
  check('infinite slope, seepage parallel to slope: within 2.5% of (gamma\'/gamma_sat) tan(phi)/tan(beta)', rel(wet, eWet) < 0.025, `${f3(wet)} vs ${f3(eWet)}`);
  check('infinite slope: wet/dry ratio = gamma\'/gamma_sat within 0.5%', rel(wet / dry, (20 - GW) / 20) < 0.005, `${(wet / dry).toFixed(4)} vs ${((20 - GW) / 20).toFixed(4)}`);
}
{
  // Taylor (1937/1948): critical height of a vertical cut in phi = 0 clay on a toe circle,
  // H_c = 3.83 c / gamma. Bishop with phi = 0 is exact moment equilibrium of the circle.
  const m = model([[-60, 10], [0, 10], [0.001, 0], [80, 0]], { c: 20, phi: 0, gm: 20, gs: 20 });
  const r = ST.analyze(m, { entry: [-25, -0.3], exit: [0.01, 20] });
  const Ns = r.fos * 20 * 10 / 20;
  check('Taylor vertical cut, phi = 0: stability number gamma H F / c = 3.83 within 1%', rel(Ns, 3.83) < 0.01, `Ns = ${Ns.toFixed(3)}`);
}

// ---------------------------------------------------------------- 2. benchmark
{
  // ACADS slope stability survey (Giam & Donald 1989), example 1(a): homogeneous 2H:1V
  // slope 10 m high, firm base 5 m below the toe, c' = 3 kPa, phi' = 19.6 deg,
  // gamma = 20 kN/m3, no pore pressure. Referee FoS 1.00. Reproduced from memory: the
  // geometry and the referee value are as I recall them, so the tolerance is +-4%.
  const m = model([[-30, 10], [0, 10], [20, 0], [50, 0]], { c: 3, phi: 19.6, gm: 20, gs: 20 }, { zBottom: -5 });
  const r = ST.analyze(m, { entry: [-25, 8], exit: [10, 45] });
  check('ACADS 1(a): Bishop minimum within 4% of the referee 1.00', Math.abs(r.fos - 1) < 0.04, `Bishop ${f3(r.fos)}, Spencer on the same circle ${f3(r.circle.spencerFos)}`);
  check('ACADS 1(a): Spencer within 2% of Bishop on the critical circle', rel(r.circle.spencerFos, r.fos) < 0.02);
  // more pore pressure -> lower FoS (pore pressure ratio ru = u / (gamma * depth))
  const fr = ru => ST.analyze(Object.assign({}, m, { uAt: (x, z) => ru * 20 * Math.max(0, ST.surfZ(m.surface, x) - z) }), { entry: [-25, 8], exit: [10, 45] }).fos;
  const F0 = r.fos, F2 = fr(0.2), F4 = fr(0.4);
  check('more pore pressure -> lower FoS (ru 0, 0.2, 0.4)', F0 > F2 && F2 > F4, `${f3(F0)} > ${f3(F2)} > ${f3(F4)}`);
  // Bishop & Morgenstern (1960): F is very nearly linear in ru, F = m - n ru
  const lin = Math.abs((F0 - F2) - (F2 - F4)) / (F0 - F4);
  check('FoS is close to linear in ru (Bishop & Morgenstern 1960)', lin < 0.1, `curvature ${(lin * 100).toFixed(1)}% of the drop`);
  // flatter slope -> higher FoS
  const fs = cot => ST.analyze(model([[-40, 10], [0, 10], [10 * cot, 0], [10 * cot + 40, 0]], { c: 3, phi: 19.6, gm: 20, gs: 20 }, { zBottom: -5 }), { entry: [-30, 10 * cot * 0.5], exit: [10 * cot * 0.5, 10 * cot + 30] }).fos;
  const s15 = fs(1.5), s2 = fs(2), s3 = fs(3);
  check('flatter slope -> higher FoS (1.5, 2, 3 H:1V)', s15 < s2 && s2 < s3, `${f3(s15)} < ${f3(s2)} < ${f3(s3)}`);
}

// ---------------------------------------------------------------- 3/4. coupled dam model
const design = (preset, o) => {
  const d = Object.assign({ slope: 2, foundation: 'clay', cutoff: 'none', reservoir: 0.85 }, o || {});
  d.cells = d.cells || ST.presetCells(preset, d.slope);
  const t0 = Date.now();
  const r = ST.runDesign(d, SS);
  r.m = ST.designMetrics(r.seep, r.stab);
  r.ms = Date.now() - t0;
  return r;
};
{
  const base = design('homogeneous');
  const dn = base.stab.downstream;
  check('dam: seepage converges and stability returns a finite FoS', base.seep.stats.converged && isFinite(dn.fos) && dn.fos > 0, `FoS ${f3(dn.fos)} (${dn.method})`);
  check('dam: Spencer agrees with Bishop within 3% on the critical circle', rel(dn.spencerOnCircle, dn.circleFos) < 0.03, `${f3(dn.spencerOnCircle)} vs ${f3(dn.circleFos)}`);
  check('dam: pore pressure lowers the FoS on the critical circle (with water < without)', dn.critical.fosNoWater > dn.fos + 0.2, `${f3(dn.fos)} with water, ${f3(dn.critical.fosNoWater)} without`);
  const lo = design('homogeneous', { reservoir: 0.5 }), hi = design('homogeneous', { reservoir: 0.95 });
  check('dam: higher reservoir -> lower downstream FoS', lo.m.fos > base.m.fos && base.m.fos > hi.m.fos, `${f3(lo.m.fos)} > ${f3(base.m.fos)} > ${f3(hi.m.fos)}`);
  const s15 = design('homogeneous', { slope: 1.5 }), s25 = design('homogeneous', { slope: 2.5 }), s3 = design('homogeneous', { slope: 3 });
  check('dam: flatter downstream slope -> higher FoS', s15.m.fos < base.m.fos && base.m.fos < s25.m.fos && s25.m.fos < s3.m.fos, [s15, base, s25, s3].map(r => f3(r.m.fos)).join(' < '));
  const dr = design('drained');
  check('dam: chimney + blanket drain -> higher FoS and lower pore pressure on the slip surface', dr.m.fos > base.m.fos + 0.3 && dr.stab.downstream.critical.ru < base.stab.downstream.critical.ru, `FoS ${f3(base.m.fos)} -> ${f3(dr.m.fos)}, ru ${base.stab.downstream.critical.ru.toFixed(2)} -> ${dr.stab.downstream.critical.ru.toFixed(2)}`);
  const weak = design('cored', { foundation: 'weak' }), strong = design('cored');
  check('dam: weak foundation layer -> lower FoS, and the sliding block along the layer governs', weak.m.fos < strong.m.fos - 0.2 && weak.stab.downstream.critical.kind === 'block', `${f3(strong.m.fos)} -> ${f3(weak.m.fos)} (${weak.stab.downstream.method})`);
  const cr = weak.stab.downstream.critical, L = ST.BUILD.foundations.weak.layer;
  const onLayer = cr.pts.some((p, k) => k > 0 && Math.abs(p[1] - cr.pts[k - 1][1]) < 1e-9 && p[1] < L.zTop && p[1] > L.zBottom);
  check('dam: the critical block runs along the weak layer', onLayer);
  check('dam: rapid drawdown is worse for the upstream slope of a homogeneous dam than for a rockfill one', base.m.fosUp < design('leaky').m.fosUp, `${f3(base.m.fosUp)} vs ${f3(design('leaky').m.fosUp)}`);
  check('dam: filter drain exits do not count as unfiltered exits (drained dam piping safety > 50)', dr.m.pipe > 50, f3(dr.m.pipe));
  const slow = [base, lo, hi, s15, s25, s3, dr, weak, strong].map(r => r.ms);
  check('dam: each design solves in under 3 s (Node)', Math.max(...slow) < 3000, `max ${Math.max(...slow)} ms`);
}

// ---------------------------------------------------------------- 5. missions
{
  const M = id => ST.BUILD.missions.find(m => m.id === id);
  const run = (id, o) => { const m = M(id); const r = design(o.preset || m.start.preset, Object.assign({}, m.start, o)); return { r, c: ST.missionCheck(m, r.m) }; };
  const td = s => { const c = ST.presetCells('drained', s); for (let q = 0; q < c.length; q++) if (c[q] === 0) c[q] = 4; return c; };
  for (const m of ST.BUILD.missions) {
    const st = run(m.id, {});
    check(`mission ${m.id}: start design does not pass`, !st.c.ok, `FoS ${f3(st.r.m.fos)}, pipe ${f3(st.r.m.pipe)}, Q ${st.r.m.qLday.toFixed(0)} L/day/m`);
  }
  const t = [
    ['dry', { preset: 'drained' }, true, 'chimney + blanket drain'],
    ['dry', { preset: 'cored' }, true, 'clay core + rockfill shells'],
    ['dry', { preset: 'homogeneous', cutoff: 'full' }, false, 'a cutoff alone'],
    ['hold', { preset: 'cored', cutoff: 'full' }, true, 'core + full cutoff'],
    ['hold', { preset: 'cored', cutoff: 'partial' }, false, 'core + half cutoff'],
    ['hold', { preset: 'homogeneous', cutoff: 'full' }, false, 'fill + full cutoff (fill leaks more than a core)'],
    ['polley', { slope: 3 }, true, '3:1 downstream slope'],
    ['polley', { slope: 2.5 }, false, '2.5:1 is not enough'],
    ['polley', { preset: 'filtered' }, false, 'drains alone do not fix the weak layer'],
    ['tailings', { slope: 2.5, cells: td(2.5) }, true, 'tailings sand + drain + 2.5:1'],
    ['tailings', { slope: 3 }, false, 'flatter but still saturated'],
    ['tailings', { cells: td(2) }, false, 'drain at 2:1 (sand too steep)']
  ];
  for (const [id, o, want, why] of t) {
    const x = run(id, o);
    check(`mission ${id}: ${why} ${want ? 'passes' : 'fails'}`, x.c.ok === want, `FoS ${f3(x.r.m.fos)}, pipe ${f3(x.r.m.pipe)}, Q ${x.r.m.qLday.toFixed(0)}, clay ${x.r.m.clay} m3/m, tailings ${(x.r.m.tsandFrac * 100).toFixed(0)}%`);
  }
}

// ---------------------------------------------------------------- 6. robustness
{
  let seed = 2024;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const N = 40;
  let bad = [], worst = 0;
  for (let n = 0; n < N; n++) {
    const slope = ST.BUILD.slopes[Math.floor(rnd() * 4)];
    const cells = new Uint8Array(170 * 39).fill(Math.floor(rnd() * 5));
    for (let b = Math.floor(rnd() * 30); b > 0; b--) {
      const m = Math.floor(rnd() * 5), cx = -50 + rnd() * (60 + 24 * slope), cz = rnd() * 24, r = 1 + rnd() * 6, vert = rnd() < 0.3;
      for (let i = 0; i < 170; i++) for (let j = 15; j < 39; j++) {
        const x = -80 + i + 0.5, z = -15 + j + 0.5;
        if (vert ? Math.abs(x - cx) < r / 2 : Math.hypot(x - cx, z - cz) < r) cells[i * 39 + j] = m;
      }
    }
    const d = { cells, slope, foundation: ['gravel', 'clay', 'weak'][Math.floor(rnd() * 3)], cutoff: ['none', 'partial', 'full'][Math.floor(rnd() * 3)], reservoir: 0.4 + rnd() * 0.55 };
    const t0 = Date.now();
    let r;
    try { r = ST.runDesign(d, SS); } catch (e) { bad.push(`#${n} threw ${e.message}`); continue; }
    const ms = Date.now() - t0; worst = Math.max(worst, ms);
    if (!r.seep.stats.converged || r.seep.q.balanceError > 1e-3) bad.push(`#${n} seepage not converged (balance ${r.seep.q.balanceError.toExponential(1)})`);
    if (!(r.stab.downstream.fos > 0 && isFinite(r.stab.downstream.fos)) || !(r.stab.upstream.fos > 0)) bad.push(`#${n} FoS ${r.stab.downstream.fos} / ${r.stab.upstream.fos}`);
  }
  check(`robustness: ${N} random paintings converge with finite FoS`, bad.length === 0, bad.join('; ') || 'all good');
  check('robustness: worst case under 6 s (the page gives the worker 15 s)', worst < 6000, `worst ${worst} ms`);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exitCode = fails ? 1 : 0;
