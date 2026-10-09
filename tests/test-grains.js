/* Numerical checks for the grain sandbox (src/app-grains.js, Fig. 4.3 of Step 4).
 * Extracts the pure simulation between the @grains-sim markers and runs each emergent
 * behaviour the figure promises, then checks it actually emerges:
 *   1 dense + drained shear dilates, loose + drained shear compacts
 *   2 loose + undrained cyclic shear: u climbs toward the total stress, sigma' collapses
 *   3 dense + undrained shear: suction (u < 0) and sigma' rises
 *   4 damp vertical cut stands, dry one collapses
 *   5 house on loose saturated sand sinks more when shaken undrained than on dense sand
 * Run: node tests/test-grains.js   (about a minute) */
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app-grains.js'), 'utf8');
const a = src.indexOf('/* @grains-sim-begin */'), b = src.indexOf('/* @grains-sim-end */');
const grainsSim = new Function(src.slice(a, b) + '\nreturn grainsSim;')();
const f = (v, d = 2) => (isFinite(v) ? v.toFixed(d) : String(v));
const N = +(process.env.GRAINS_N || 420), SEED = +(process.env.GRAINS_SEED || 11);
let fails = 0;
function check(ok, msg) { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails++; }

function prep(pack, o) {
  const sim = grainsSim({ N, seed: SEED });
  sim.S.water = o.water || 'dry'; sim.S.drain = 'open'; sim.S.load = o.load || 40;
  sim.pour(pack, o.top || 'platen');
  while (sim.S.phase !== 'run') sim.step();
  sim.S.drain = o.drain || 'open';
  const W = sim.W;
  if (o.top === 'house') sim.setWindow({ x0: W / 2 - 3, x1: W / 2 + 3, y0: 0.3 * sim.HS, y1: 0.62 * sim.HS });
  else if (o.top === 'none') sim.setWindow({ x0: 0.25 * W, x1: 0.75 * W, y0: 0.3 * sim.HS, y1: 0.62 * sim.HS });
  else sim.setWindow({ x0: 0.18 * W, x1: 0.82 * W, y0: 0.22 * sim.S.py, y1: 0.72 * sim.S.py });
  for (let k = 0; k < 600; k++) sim.step();
  sim.measure(); for (let k = 0; k < 300; k++) sim.step();
  return sim;
}
function run(sim, steps, every, fn) { for (let k = 1; k <= steps; k++) { sim.step(); if (k % every === 0) fn(sim.measure(), k); } }

function shear(pack, water, drain) {
  const sim = prep(pack, { water, drain });
  const m0 = sim.measure(), H0 = sim.S.py;
  sim.shear('mono', 0.025, 0.3);   // same rate as the figure
  let peak = 0, uMin = 0, uMax = 0, mob = [], last;
  while (sim.S.shear !== 'none') { sim.step(); if (sim.S.steps % 400 === 0) { const m = sim.measure(); last = m; if (sim.S.gamma > 0.02) { peak = Math.max(peak, m.mob); mob.push(m.mob); } uMin = Math.min(uMin, m.u); uMax = Math.max(uMax, m.u); } }
  const tail = mob.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const r = { dV: (sim.S.py - H0) / H0 * 100, e0: m0.e, e1: last.e, s0: m0.sigEff, s1: last.sigEff, peak, end: tail, uMin, uMax, u1: last.u };
  console.log(`${pack} ${water} drain ${drain}: e ${f(r.e0, 3)} -> ${f(r.e1, 3)}, volume ${f(r.dV)}%, tau/s' peak ${f(r.peak)} end ${f(r.end)}, u min ${f(r.uMin, 1)} end ${f(r.u1, 1)}, s' ${f(r.s0, 1)} -> ${f(r.s1, 1)}`);
  return r;
}
function cyclic(pack, drain, amp = 0.02, ncyc = 6) { // the figure shakes at 2%, 8 cycles
  const sim = prep(pack, { water: 'sat', drain });
  const m0 = sim.measure(), H0 = sim.S.py;
  sim.shear('cyclic', amp, ncyc);
  const per = Math.round(sim.S.cycT / sim.dt);
  let uMax = -1e9, sMin = 1e9, rows = [], NC0 = 0, fc0 = 0, fc1 = 0;
  for (let k = 0; k < sim.NC; k++) fc0 += sim.cF[k];
  while (sim.S.shear !== 'none') { sim.step(); if (sim.S.steps % (per / 2 | 0) === 0) { const m = sim.measure(); uMax = Math.max(uMax, m.u); sMin = Math.min(sMin, m.sigEff); rows.push(`${f(m.u, 0)}/${f(m.sigEff, 0)}`); } }
  for (let k = 0; k < sim.NC; k++) fc1 += sim.cF[k];
  const r = { uMax, sMin, s0: m0.sigEff, sigma: m0.sigma, dV: (sim.S.py - H0) / H0 * 100, fc: fc1 / fc0 };
  console.log(`${pack} saturated drain ${drain}, cyclic ${amp * 100}% x${ncyc}: u/s' every half cycle: ${rows.join(' ')}; volume ${f(r.dV)}%; total contact force now ${f(r.fc * 100, 0)}% of start`);
  return r;
}
function castle(water) {
  const sim = grainsSim({ N, seed: SEED });
  sim.S.water = water; sim.pour('dense', 'none');
  while (sim.S.phase !== 'run') sim.step();
  for (let k = 0; k < 600; k++) sim.step();
  sim.removeWall();
  for (let k = 0; k < 15000; k++) sim.step();
  const r = { spilled: sim.spilled(), runout: sim.runout() };
  console.log(`sandcastle ${water}: ${r.spilled} grains fell out, run-out ${f(r.runout, 1)} grain widths`);
  return r;
}
function house(pack, water, drain) {
  const sim = prep(pack, { water, drain, top: 'house' });
  const m0 = sim.measure(), y0 = sim.S.hy;
  sim.shear('cyclic', 0.02, 8);
  let uMax = 0, sMin = 1e9;
  const per = Math.round(sim.S.cycT / sim.dt);
  for (let k = 0; k < 9 * per; k++) { sim.step(); if (k % 500 === 0) { const m = sim.measure(); uMax = Math.max(uMax, m.u); sMin = Math.min(sMin, m.sigEff); } }
  const r = { sink: y0 - sim.S.hy, tilt: sim.S.hth * 180 / Math.PI, uMax, sMin, s0: m0.sigEff };
  console.log(`house on ${pack} ${water}${water === 'sat' ? ' drain ' + drain : ''}: sank ${f(r.sink)} grain widths, tilt ${f(r.tilt, 1)} deg; under it s' ${f(r.s0, 1)} -> min ${f(r.sMin, 1)}, u max ${f(r.uMax, 1)}`);
  return r;
}

const t0 = Date.now();
console.log(`grain sandbox checks, N = ${N}, seed = ${SEED}`);
console.log('\n1. Drained shear');
const d = shear('dense', 'dry', 'open'), l = shear('loose', 'dry', 'open');
check(d.dV > 1.5, `dense sample dilates (volume ${f(d.dV)}% > +1.5%)`);
check(l.dV < -0.5, `loose sample compacts (volume ${f(l.dV)}% < -0.5%)`);
check(d.peak > d.end + 0.05, `dense: peak strength then softer (peak ${f(d.peak)} > end ${f(d.end)} + 0.05)`);
check(d.peak > l.peak, `dense peak tau/s' above loose (${f(d.peak)} > ${f(l.peak)})`);

console.log('\n2. Undrained cyclic shear (liquefaction)');
const lc = cyclic('loose', 'shut'), dc = cyclic('dense', 'shut'), ld = cyclic('loose', 'open', 0.02, 3);
check(lc.uMax > 0.85 * lc.sigma, `loose, drain shut: u climbs to ${f(lc.uMax, 1)} (> 85% of total ${f(lc.sigma, 1)})`);
check(lc.sMin < 0.1 * lc.s0, `loose, drain shut: s' falls to ${f(lc.sMin, 1)} (< 10% of ${f(lc.s0, 1)})`);
check(lc.fc < 0.25, `loose, drain shut: force chains fade (total contact force ${f(lc.fc * 100, 0)}% of start)`);
check(dc.sMin > 0.25 * dc.s0, `dense, drain shut: keeps s' ${f(dc.sMin, 1)} (> 25% of ${f(dc.s0, 1)})`);
check(ld.dV < -0.5 && ld.uMax < 0.25 * ld.sigma, `loose, drain open: compacts (${f(ld.dV)}%) instead, u stays low (${f(ld.uMax, 1)})`);

console.log('\n3. Undrained shear of dense sand (suction)');
const ds = shear('dense', 'sat', 'shut');
check(ds.uMin < -10, `u goes below zero (min ${f(ds.uMin, 1)})`);
check(ds.s1 > 1.5 * ds.s0, `s' rises (${f(ds.s0, 1)} -> ${f(ds.s1, 1)})`);
check(Math.abs(ds.dV) < 0.5 * d.dV, `volume change ${f(ds.dV)}% well below the drained ${f(d.dV)}% (it grows a little only once the water cavitates at -100)`);

console.log('\n4. Sandcastle');
const cd = castle('damp'), cy = castle('dry');
check(cd.spilled < 6, `damp cut stands (${cd.spilled} grains fell)`);
check(cy.spilled > 25, `dry cut collapses (${cy.spilled} grains fell)`);

console.log('\n5. House on shaken ground');
const hl = house('loose', 'sat', 'shut'), hd = house('dense', 'sat', 'shut');
check(hl.sMin < 0.2 * hl.s0, `loose saturated: grain stress under the house collapses (${f(hl.s0, 1)} -> ${f(hl.sMin, 1)})`);
check(hl.sink > 2 * Math.max(0.2, hd.sink), `house sinks more on loose saturated sand (${f(hl.sink)}) than on dense (${f(hd.sink)})`);

console.log(`\n${fails ? fails + ' check(s) FAILED' : 'all checks passed'} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(fails ? 1 : 0);
