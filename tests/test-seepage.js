/* Test harness for src/seepage-solver.js
 * Runs all 36 combinations at reservoir 0.85 plus homogeneous/none/none/pervious at
 * 0.5 and 0.95, prints one row per run and checks the physical sanity expectations.
 * Checks 8-12 cover the custom mode (reader-painted zones, downstream slope, layers). */
'use strict';
const path = require('path');
const { solveSeepage, GEOM } = require(path.join(__dirname, '..', 'src', 'seepage-solver.js'));

const L_DAY = 1000 * 86400; // m^3/s per m  ->  L/day per m
const fmtE = v => (isFinite(v) ? v.toExponential(2) : String(v));
const fmtF = (v, d = 2) => (isFinite(v) ? v.toFixed(d) : String(v));
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

// elevation of the top of the saturated zone (psi = 0) in the column through x,
// scanning upward from the foundation top through dam cells (soil or drain)
function satTop(r, x) {
  const i = Math.round(x - r.x0 - 0.5);
  let prevZ = -0.5, prevPsi = r.psi[i * r.nz + 14];
  if (!(prevPsi >= 0)) return -0.5;
  for (let j = 15; j < r.nz; j++) {
    const c = i * r.nz + j, t = r.type[c];
    if (t !== 1 && t !== 3) break;
    const z = r.z0 + 0.5 + j, p = r.psi[c];
    if (p < 0) return prevZ + prevPsi / (prevPsi - p) * (z - prevZ);
    prevZ = z; prevPsi = p;
  }
  return prevZ;
}
function headAt(r, x, z) {
  const i = Math.round(x - r.x0 - 0.5), j = Math.round(z - r.z0 - 0.5);
  return r.h[i * r.nz + j];
}

const runs = [];
const cases = [];
for (const damType of ['homogeneous', 'cored'])
  for (const drain of ['none', 'toe', 'chimney'])
    for (const cutoff of ['none', 'partial', 'full'])
      for (const foundation of ['pervious', 'tight'])
        cases.push({ damType, drain, cutoff, foundation, reservoir: 0.85 });
cases.push({ damType: 'homogeneous', drain: 'none', cutoff: 'none', foundation: 'pervious', reservoir: 0.5 });
cases.push({ damType: 'homogeneous', drain: 'none', cutoff: 'none', foundation: 'pervious', reservoir: 0.95 });

// warm-up (JIT) so the first row's timing is representative
solveSeepage({ damType: 'homogeneous', drain: 'none', cutoff: 'none', foundation: 'tight', reservoir: 0.85 });

const header = [pad('dam', 5), pad('drain', 8), pad('cutoff', 8), pad('fdn', 9), lpad('res', 5), lpad('it', 4), lpad('P+N', 6), lpad('conv', 5), lpad('ms', 6),
  lpad('Qin m3/s/m', 11), lpad('L/day/m', 9), lpad('inDam', 9), lpad('inFloor', 9), lpad('outDrain', 9), lpad('outTail', 9), lpad('outFace', 9), lpad('balErr', 8),
  lpad('SF', 3), lpad('topZ', 5), lpad('iGround', 8), lpad('iFace', 7), lpad('FS', 7), lpad('phrPts', 6), lpad('flow d/f', 9), lpad('exits', 0)].join(' ');
console.log(header);
const cpu0 = process.cpuUsage();
for (const p of cases) {
  const r = solveSeepage(p);
  runs.push({ p, r });
  const q = r.q, ex = r.exit, sf = r.seepageFace, st = r.stats;
  const nd = r.flowlines.filter(f => f.group === 'dam').length, nf = r.flowlines.filter(f => f.group === 'foundation').length;
  const exits = {};
  r.flowlines.forEach(f => { exits[f.exit] = (exits[f.exit] || 0) + 1; });
  console.log([pad(p.damType.slice(0, 5), 5), pad(p.drain, 8), pad(p.cutoff, 8), pad(p.foundation, 9), lpad(p.reservoir.toFixed(2), 5),
    lpad(st.iterations, 4), lpad(st.picardIterations + '+' + st.newtonIterations, 6), lpad(st.converged ? 'yes' : 'NO', 5), lpad(st.ms.toFixed(0), 6),
    lpad(fmtE(q.inflowTotal), 11), lpad(fmtF(q.inflowTotal * L_DAY, 1), 9), lpad(fmtE(q.inflowDamFace), 9), lpad(fmtE(q.inflowFloor), 9),
    lpad(fmtE(q.outDrain), 9), lpad(fmtE(q.outTailwater), 9), lpad(fmtE(q.outSeepageFace), 9), lpad(fmtE(q.balanceError), 8),
    lpad(sf.present ? 'Y' : '-', 3), lpad(sf.present ? fmtF(sf.topZ, 1) : '-', 5), lpad(fmtF(ex.groundMax, 3), 8), lpad(fmtF(ex.faceMax, 3), 7), lpad(fmtF(ex.fs, 2), 7),
    lpad(r.phreatic.length, 6), lpad(nd + '/' + nf, 9), Object.entries(exits).map(([k, v]) => k + ':' + v).join(',')].join(' '));
}
const cpu = process.cpuUsage(cpu0);
const ms = runs.map(x => x.r.stats.ms);
console.log('\nTiming: wall mean %s ms, median %s ms, max %s ms; CPU (user) mean %s ms/run',
  (ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(0), ms.slice().sort((a, b) => a - b)[ms.length >> 1].toFixed(0),
  Math.max(...ms).toFixed(0), (cpu.user / 1000 / runs.length).toFixed(0));

// ------------------------------------------------------------------ sanity checks
const get = (damType, drain, cutoff, foundation, reservoir = 0.85) =>
  runs.find(x => x.p.damType === damType && x.p.drain === drain && x.p.cutoff === cutoff && x.p.foundation === foundation && x.p.reservoir === reservoir).r;
const results = [];
function check(name, ok, detail) { results.push({ name, ok, detail }); }

// 1. Homogeneous, no drain: phreatic line breaks out on the downstream face.
//    Strict on the tight (relatively impervious) foundation. On the pervious foundation
//    (K = 100 x fill) the foundation itself drains the downstream half of the dam, so the
//    breakout is expected to be low or absent; reported with the foundation head under
//    the toe as evidence.
{
  const lines = [];
  let ok = true;
  for (const cutoff of ['none', 'partial', 'full']) for (const foundation of ['tight', 'pervious']) {
    const r = get('homogeneous', 'none', cutoff, foundation);
    const fdnHeadToe = headAt(r, 45.5, -0.5), fdnHead20 = headAt(r, 20.5, -0.5);
    if (foundation === 'tight') {
      const good = r.seepageFace.present && r.seepageFace.topZ >= 3;
      if (!good) ok = false;
      lines.push(`${cutoff}/${foundation}: present=${r.seepageFace.present} topZ=${fmtF(r.seepageFace.topZ, 1)} ${good ? 'ok' : 'FAIL'}`);
    } else {
      lines.push(`${cutoff}/${foundation} (info): present=${r.seepageFace.present} topZ=${fmtF(r.seepageFace.topZ, 1)}; foundation head at x=20.5: ${fmtF(fdnHead20, 2)} m, at x=45.5: ${fmtF(fdnHeadToe, 2)} m (underdrain effect)`);
    }
  }
  check('1 homogeneous/none: seepage face on downstream face with topZ >= 3 m (tight foundation); pervious reported', ok, lines.join('; '));
}
// 2. Homogeneous + chimney: no downstream seepage face; phreatic surface drops into the chimney
{
  const lines = [];
  let ok = true;
  for (const cutoff of ['none', 'partial', 'full']) for (const foundation of ['pervious', 'tight']) {
    const r = get('homogeneous', 'chimney', cutoff, foundation);
    // max saturated-top elevation downstream of the chimney (x = 8 .. 48)
    let maxTop = -Infinity;
    for (let x = 8.5; x <= 47.5; x += 1) maxTop = Math.max(maxTop, satTop(r, x));
    const upTop = satTop(r, 0.5);
    const lastX = r.phreatic.length ? r.phreatic[r.phreatic.length - 1][0] : NaN;
    const good = !r.seepageFace.present && maxTop <= 2.0 && lastX <= 6.5;
    if (!good) ok = false;
    lines.push(`${cutoff}/${foundation}: SF=${r.seepageFace.present} satTop(x=0.5)=${fmtF(upTop, 1)} max satTop d/s of chimney=${fmtF(maxTop, 2)} phreatic ends x=${fmtF(lastX, 1)}`);
  }
  check('2 homogeneous/chimney: no downstream seepage face, phreatic line ends in chimney, fill d/s dry above blanket', ok, lines.join('; '));
}
// 3. Homogeneous + toe drain: seepage face absent or much lower than without a drain
{
  const lines = [];
  let ok = true;
  for (const cutoff of ['none', 'partial', 'full']) for (const foundation of ['pervious', 'tight']) {
    const a = get('homogeneous', 'none', cutoff, foundation), b = get('homogeneous', 'toe', cutoff, foundation);
    const good = !b.seepageFace.present || b.seepageFace.topZ < a.seepageFace.topZ - 1;
    if (!good) ok = false;
    lines.push(`${cutoff}/${foundation}: none topZ=${fmtF(a.seepageFace.topZ, 1)} toe SF=${b.seepageFace.present}${b.seepageFace.present ? ' topZ=' + fmtF(b.seepageFace.topZ, 1) : ''}`);
  }
  check('3 homogeneous/toe: seepage face absent or much lower than with no drain', ok, lines.join('; '));
}
// 4. Pervious foundation: seepage drops none -> partial -> full; groundMax drops a lot with full
{
  const lines = [];
  let ok = true;
  for (const damType of ['homogeneous', 'cored']) for (const drain of ['none', 'toe', 'chimney']) {
    const n = get(damType, drain, 'none', 'pervious'), pa = get(damType, drain, 'partial', 'pervious'), f = get(damType, drain, 'full', 'pervious');
    const mono = n.q.inflowTotal > pa.q.inflowTotal && pa.q.inflowTotal > f.q.inflowTotal;
    const gdrop = f.exit.groundMax < 0.5 * n.exit.groundMax;
    if (!mono || !gdrop) ok = false;
    lines.push(`${damType}/${drain}: Q ${fmtE(n.q.inflowTotal)} > ${fmtE(pa.q.inflowTotal)} > ${fmtE(f.q.inflowTotal)} ${mono ? 'ok' : 'FAIL'}; iGround ${fmtF(n.exit.groundMax, 3)} -> ${fmtF(f.exit.groundMax, 4)} ${gdrop ? 'ok' : 'FAIL'}`);
  }
  check('4 pervious foundation: Q(none) > Q(partial) > Q(full) and groundMax(full) < 0.5 groundMax(none)', ok, lines.join('; '));
}
// 5. Cored dam: head drop concentrated across the core
{
  const lines = [];
  let ok = true;
  for (const drain of ['none', 'toe', 'chimney']) for (const cutoff of ['none', 'partial', 'full']) for (const foundation of ['pervious', 'tight']) {
    const r = get('cored', drain, cutoff, foundation);
    // x = -9.5: upstream shell (dam surface at z = 20.75 > Hw); x = +15.5: downstream shell
    const up = satTop(r, -9.5), dn = satTop(r, 15.5);
    const drop = (up - dn) / r.Hw;
    const good = up >= 0.9 * r.Hw && dn <= 0.3 * r.Hw && drop >= 0.65;
    if (!good) ok = false;
    lines.push(`${drain}/${cutoff}/${foundation}: phreatic u/s of core ${fmtF(up, 1)} m, d/s ${fmtF(dn, 1)} m (Hw ${fmtF(r.Hw, 1)}; drop ${fmtF(drop * 100, 0)}% Hw)`);
  }
  check('5 cored: phreatic >= 0.9 Hw just upstream of core (x=-9.5), <= 0.3 Hw downstream (x=+15.5), drop >= 65% Hw', ok, lines.join('; '));
}
// 6. Mass balance < 1% and convergence in all runs
{
  const bad = runs.filter(x => !(x.r.q.balanceError < 0.01) || !x.r.stats.converged);
  const maxBal = Math.max(...runs.map(x => x.r.q.balanceError));
  check('6 all runs converge with balanceError < 1%', bad.length === 0, `max balanceError = ${fmtE(maxBal)}; failing runs: ${bad.length}`);
}
// 7. Higher reservoir -> more seepage
{
  const a = get('homogeneous', 'none', 'none', 'pervious', 0.5), b = get('homogeneous', 'none', 'none', 'pervious', 0.85), c = get('homogeneous', 'none', 'none', 'pervious', 0.95);
  const ok = a.q.inflowTotal < b.q.inflowTotal && b.q.inflowTotal < c.q.inflowTotal;
  check('7 higher reservoir -> more seepage (homogeneous/none/none/pervious)', ok,
    `Q(0.50)=${fmtE(a.q.inflowTotal)} < Q(0.85)=${fmtE(b.q.inflowTotal)} < Q(0.95)=${fmtE(c.q.inflowTotal)}`);
}

// ------------------------------------------------------------------ custom mode
// (params.custom: the reader's own zones, downstream slope and foundation layers)
const NC = GEOM.nx * GEOM.nz;
const CMATS = [{ k: 1e-7, alpha: 0.25 }, { k: 1e-9, alpha: 0.25 }, { k: 1e-4, alpha: 0.1 }, { k: 1e-3, alpha: 0.1, drain: true }];
// custom cells that copy a preset dam: fill 0, core 1, shell 2, drain 3
function cellsLike(r) {
  const cells = new Uint8Array(NC);
  for (let c = 0; c < NC; c++) cells[c] = r.type[c] === 3 ? 3 : r.mat[c] === 3 ? 1 : r.mat[c] === 4 ? 2 : 0;
  return cells;
}
// 8. custom cells that reproduce a preset give the same answer
{
  const lines = [];
  let ok = true;
  for (const [damType, drain, cutoff, foundation] of [['cored', 'none', 'none', 'tight'], ['cored', 'chimney', 'none', 'pervious'], ['homogeneous', 'toe', 'partial', 'pervious'], ['cored', 'none', 'full', 'pervious']]) {
    const a = get(damType, drain, cutoff, foundation);
    const b = solveSeepage({ cutoff, foundation, reservoir: 0.85, custom: { materials: CMATS, cells: cellsLike(a) } });
    let dh = 0;
    for (let c = 0; c < NC; c++) if (a.psi[c] >= 0) dh = Math.max(dh, Math.abs(a.h[c] - b.h[c]));
    const dq = Math.abs(b.q.inflowTotal / a.q.inflowTotal - 1), dfs = Math.abs(b.exit.fs / a.exit.fs - 1);
    const good = b.stats.converged && dq < 1e-4 && dh < 0.02 && dfs < 1e-3;
    if (!good) ok = false;
    lines.push(`${damType}/${drain}/${cutoff}/${foundation}: dQ ${fmtE(dq)}, max dh (saturated) ${fmtE(dh)} m, dFS ${fmtE(dfs)}`);
  }
  check('8 custom cells copying a preset reproduce it (Q within 1e-4, saturated heads within 2 cm)', ok, lines.join('; '));
}
// 9. mass balance and convergence of custom designs, incl. other slopes and a weak layer
const customRuns = [];
{
  const homog = new Uint8Array(NC), drained = new Uint8Array(NC), blob = new Uint8Array(NC);
  for (let i = 0; i < GEOM.nx; i++) for (let j = 0; j < GEOM.nz; j++) {
    const x = GEOM.x0 + i + 0.5, z = GEOM.z0 + j + 0.5, c = i * GEOM.nz + j;
    drained[c] = (z <= 20 && x >= 4 && x <= 6) || (z <= 2 && x >= 4) ? 3 : 0;
    blob[c] = Math.hypot(x - 15, z - 10) < 4 ? 3 : 0; // a drain pocket with no outlet
  }
  const layer = [{ zTop: -4, zBottom: -6, k: 1e-9 }];
  for (const [name, cells, s, extra] of [['homogeneous 2:1', homog, 2, {}], ['homogeneous 1.5:1', homog, 1.5, {}], ['homogeneous 3:1', homog, 3, {}],
    ['drained 2:1', drained, 2, {}], ['drained 3:1', drained, 3, {}], ['homogeneous + weak layer', homog, 2, { layers: layer }], ['isolated drain pocket', blob, 2, {}]]) {
    const r = solveSeepage({ foundation: 'tight', reservoir: 0.85, custom: Object.assign({ materials: CMATS, cells, downSlope: s }, extra) });
    customRuns.push({ name, r, s });
  }
  const bad = customRuns.filter(x => !x.r.stats.converged || !(x.r.q.balanceError < 0.01));
  check('9 custom designs converge with balanceError < 1%', bad.length === 0,
    customRuns.map(x => `${x.name}: ${x.r.stats.converged ? 'conv' : 'NOT conv'} bal ${fmtE(x.r.q.balanceError)} ${x.r.stats.ms.toFixed(0)} ms`).join('; '));
}
// 10. a drain lowers the phreatic surface in the downstream half
{
  const h = customRuns.find(x => x.name === 'homogeneous 2:1').r, d = customRuns.find(x => x.name === 'drained 2:1').r;
  const th = satTop(h, 20.5), td = satTop(d, 20.5);
  check('10 custom: chimney + blanket drain lowers the saturated zone at x = 20.5 and removes the seepage face', td < th - 3 && !d.seepageFace.present && h.seepageFace.present,
    `saturated to ${fmtF(th, 1)} m without, ${fmtF(td, 1)} m with; seepage face ${h.seepageFace.present} -> ${d.seepageFace.present}`);
}
// 11. downstream slope: toe position, and a steeper slope breaks out higher
{
  const r15 = customRuns.find(x => x.name === 'homogeneous 1.5:1').r, r3 = customRuns.find(x => x.name === 'homogeneous 3:1').r;
  const ok = r15.custom.downToeX === 39 && r3.custom.downToeX === 75 && r15.seepageFace.present && r3.seepageFace.present;
  check('11 custom: downstream toe at 3 + 24 s (s = 1.5 -> 39 m, s = 3 -> 75 m), seepage faces found on both', ok,
    `toe ${r15.custom.downToeX} / ${r3.custom.downToeX}; face tops ${fmtF(r15.seepageFace.topZ, 1)} / ${fmtF(r3.seepageFace.topZ, 1)} m`);
}
// 12. a drain pocket with no outlet is modelled as permeable soil, not as a sink
{
  const b = customRuns.find(x => x.name === 'isolated drain pocket').r, h = customRuns.find(x => x.name === 'homogeneous 2:1').r;
  const ok = b.custom.freeDrainCells === 0 && b.custom.soilDrainCells > 0 && b.q.outDrain === 0 && Math.abs(b.q.inflowTotal / h.q.inflowTotal - 1) < 0.5;
  check('12 custom: an isolated drain pocket is permeable soil (no drain outflow, seepage changes modestly)', ok,
    `free ${b.custom.freeDrainCells}, soil ${b.custom.soilDrainCells}, Q ${fmtE(b.q.inflowTotal)} vs ${fmtE(h.q.inflowTotal)}`);
}

// extra diagnostics: unsaturated share of horizontal dam flow, flow-line exits
{
  const shares = runs.map(x => x.r.stats.unsatShare);
  const hom = runs.filter(x => x.p.damType === 'homogeneous' && x.p.drain !== 'chimney');
  const maxShare = Math.max(...hom.map(x => Math.max(x.r.stats.unsatShare['x-20'], x.r.stats.unsatShare['x0'])));
  console.log('\nDiagnostic: max share of horizontal dam flow through unsaturated faces at x=-20/0 (homogeneous, no chimney): ' + (maxShare * 100).toFixed(2) + '%');
  void shares;
}

console.log('\nSanity checks:');
for (const c of results) console.log(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.name}\n         ${c.detail}`);
const nPass = results.filter(c => c.ok).length;
console.log(`\n${nPass}/${results.length} sanity checks pass`);
void GEOM;
process.exitCode = nPass === results.length ? 0 : 1;
