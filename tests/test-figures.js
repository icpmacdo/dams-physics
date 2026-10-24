/* Pins the numbers the course figures compute, so a later edit cannot change them silently.
 * Loads the pure code between the @fig-*-begin / @fig-*-end markers in src/app-core.js,
 * src/app-ground.js and src/app-seep.js (the same way test-grains.js loads the grain sandbox)
 * and checks, for each figure:
 *   - the state the JS starts in matches the controls in the page markup (src/*.html)
 *   - the readouts the page shows before the JS runs match what the JS writes on load
 *   - the values on load, and a few other states, to the precision the page shows them
 * Figures: 1.1 beach, 2.1 pressure with depth, 3.1 permeability race, 3.2 Darcy, 4.1 block
 * on a ramp, 4.2 stress column, 5.1 hydro readouts, 6.1 raising methods, 8.2 piping readout
 * (on the seepage solver's results), 8.3 stage names, 8.4 uplift and sliding.
 * When a fix changes one of these numbers on purpose, update its pin here in the same commit.
 * Run: node tests/test-figures.js   (about a second, five seepage solves included) */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const read = n => fs.readFileSync(path.join(SRC, n), 'utf8');
const { solveSeepage } = require(path.join(SRC, 'seepage-solver.js'));

let fails = 0, passes = 0;
function check(ok, msg) { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (ok) passes++; else fails++; }
const show = v => (typeof v === 'string' ? JSON.stringify(v) : String(v));
function same(actual, expected, label) { check(actual === expected, `${label}: ${show(actual)}` + (actual === expected ? '' : `, expected ${show(expected)}`)); }
function near(actual, expected, tol, label) { check(Math.abs(actual - expected) <= tol, `${label}: ${actual}` + (Math.abs(actual - expected) <= tol ? '' : `, expected ${expected} ± ${tol}`)); }

// ---- the code under test
function block(src, file, name) {
  const a = `/* @fig-${name}-begin */`, b = `/* @fig-${name}-end */`;
  const i = src.indexOf(a), j = src.indexOf(b);
  if (i < 0 || j < i || src.indexOf(a, i + 1) >= 0) throw new Error(`markers @fig-${name} missing or repeated in ${file}`);
  return src.slice(i + a.length, j);
}
const core = read('app-core.js'), ground = read('app-ground.js'), seep = read('app-seep.js');
const UTIL = block(core, 'app-core.js', 'util'); // n1, fmt, clamp, lerp, polyArea, clipBelow, ...
const load = (code, names) => new Function(UTIL + '\nconst deg = Math.PI / 180;\n' + code + `\nreturn { ${names.join(', ')} };`)();
const G = load(['beach', 'depth', 'race', 'darcy', 'block', 'column'].map(n => block(ground, 'app-ground.js', n)).join('\n'),
  ['BEACH0', 'PACK0', 'JIG0', 'beachShapes', 'beachJiggle', 'depthCalc', 'MATS', 'fmtDur', 'raceTime', 'raceReadouts', 'DARCY0', 'DARCY_PLUG', 'darcyKEff', 'darcyHeadAt', 'flowRate', 'darcyReadouts',
    'BLOCK', 'blockForces', 'blockReadouts', 'COL', 'columnStress', 'columnReadouts']);
const C = load(block(core, 'app-core.js', 'hydro') + block(core, 'app-core.js', 'raise'), ['hydroCalc', 'R', 'stateAt', 'stageText', 'raiseDam']);
const S = load(block(seep, 'app-seep.js', 'lab') + block(seep, 'app-seep.js', 'pipe') + block(seep, 'app-seep.js', 'uplift'),
  ['LAB0', 'labFmtQ', 'labPiping', 'names', 'B', 'TW', 'W', 'HW0', 'upliftDrainHead', 'upliftCalc', 'upliftReadouts']);

// ---- the page markup, assembled as build.py does
let html = read('body.html');
for (let k = 0; k < 4; k++) html = html.replace(/<!-- @include ([\w.-]+) -->/g, (_, n) => (fs.existsSync(path.join(SRC, n)) ? read(n) : ''));
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
function staticText(id) { // text of an element with no child elements
  const m = html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`));
  if (!m) throw new Error(`no element #${id} with plain text in src/*.html`);
  return decode(m[1]);
}
function inputValue(id) {
  const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
  if (!tag) throw new Error(`no input #${id} in src/*.html`);
  return +tag[0].match(/value="([^"]*)"/)[1];
}
function pressed(id) { // data-v of the pressed button in a segmented control
  const m = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</div>`));
  const b = m && m[1].match(/data-v="([^"]*)" aria-pressed="true"/);
  if (!b) throw new Error(`no pressed button in #${id}`);
  return b[1];
}
function staticMatches(pairs, fig) { // [id, the text the JS writes on load]
  for (const [id, js] of pairs) same(staticText(id), js, `${fig} #${id} in the markup matches the JS on load`);
}

const t0 = Date.now();

console.log('\nFig. 1.1 · the beach');
{
  const st = G.BEACH0, b = G.beachShapes(240, 241, 2);
  same(pressed('bc-state'), st, 'state on load matches the pressed button');
  same(pressed('bc-pack'), G.PACK0, 'packing on load matches the pressed button');
  same(html.match(/id="bc-state"[^>]*>([\s\S]*?)<\/div>/)[1].match(/data-v="(\w+)"/g).map(m => m.slice(8, -1)).join(' / '), 'dry / damp / under / drain', 'the four states offered');
  staticMatches([['bc-slope', b.SLOPE[st][0]], ['bc-slope2', b.SLOPE[st][1]], ['bc-gap', b.GAP[st][0]], ['bc-gap2', b.GAP[st][1]], ['bc-zoom-note', b.ZN[st]], ['bc-jig', G.JIG0[0]], ['bc-jig2', G.JIG0[1]]], 'Fig. 1.1');
  same(['dry', 'damp', 'under', 'drain', 'flat'].map(k => b.SLOPE[k][0]).join(' / '), '34° / 90° / about 34° / about 19° / about 0°', 'steepest slope dry / damp / under still water / draining / jiggled loose');
  // the physics behind the two wet states (infinite slope, no cohesion)
  near(Math.atan(b.TAN.under) / (Math.PI / 180), 34, 1e-9, 'under still water: buoyancy cancels top and bottom, so φ′ (degrees)');
  near(b.tanDrain, (20 - 9.81) / 20 * Math.tan(34 * Math.PI / 180), 1e-12, 'draining: tan β = (γ′/γsat)·tan φ′');
  same(b.tanDrain.toFixed(3) + ' / ' + (Math.atan(b.tanDrain) / (Math.PI / 180)).toFixed(1) + '°', '0.344 / 19.0°', 'draining face: tan β / β');
  same(b.ANG.dry + ' / ' + b.ANG.under + ' / ' + b.ANG.drain, '34° / ≈34° / ≈19°', 'angle labels on the drawing');
  const area = p => p.reduce((s, h) => s + h * 2, 0);
  same(b.A, 14316, 'sand in the heap (px², the damp castle)');
  for (const k of ['dry', 'under', 'drain', 'flat']) near(area(b.PROF[k]), b.A, 1e-4 * b.A, `${k} heap holds the same sand (within 0.01%)`);
  const top = k => Math.max(...b.PROF[k]);
  // the draining heap is 70.1 px tall (it was 70.2 at a rounded 19°): H = √(A·tan β)
  same(['damp', 'dry', 'under', 'drain', 'flat'].map(k => top(k).toFixed(1)).join(' / '), '146.0 / 98.3 / 98.3 / 70.1 / 35.4', 'heap height in px, damp / dry / under water / draining / jiggled (5 px per cm)');
  near(top('drain'), Math.sqrt(b.A * b.tanDrain), 1e-9, 'conserved area: H = √(A·tan β) for the draining heap');
  near(Math.atan((b.PROF.dry[120] - b.PROF.dry[130]) / 20) / (Math.PI / 180), 34, 1e-9, 'dry cone side slope (degrees)');
  near(Math.atan((b.PROF.drain[120] - b.PROF.drain[130]) / 20) / (Math.PI / 180), 18.97, 0.005, 'draining cone side slope (degrees)');
  // a jiggle: loose wet sand flows flat, dense wet sand holds, dry and damp sand keep their shape
  const jg = (m, p) => { const j = G.beachJiggle(m, p); return j.key + ' (' + j.jig[0] + ')'; };
  same(['dry', 'damp', 'under', 'drain'].map(m => jg(m, 'loose')).join(' / '), 'dry (Barely changed) / damp (Held) / flat (Flowed) / flat (Flowed)', 'jiggle, packed loose: dry / damp / under water / draining');
  same(['dry', 'damp', 'under', 'drain'].map(m => jg(m, 'dense')).join(' / '), 'dry (Barely changed) / damp (Held) / under (Held) / drain (Held)', 'jiggle, packed dense: dry / damp / under water / draining');
  for (const k of ['dry', 'damp', 'under', 'drain', 'flat']) check(b.SLOPE[k] && b.GAP[k] && b.CAP[k] && b.ZN[k], `every readout has words for the ${k} shape`);
}

console.log('\nFig. 2.1 · pressure with depth');
{
  const H = inputValue('dp-H'), h = inputValue('dp-h'), c = G.depthCalc(H, h);
  same(H + ' / ' + h, '50 / 30', 'sliders on load: depth / sensor depth (m)');
  staticMatches([['dp-H-o', c.txt.H], ['dp-h-o', c.txt.h], ['dp-p', c.txt.p], ['dp-p2', c.txt.p2], ['dp-pb', c.txt.pb], ['dp-pb2', c.txt.pb2], ['dp-F', c.txt.F], ['dp-F2', c.txt.F2]], 'Fig. 2.1');
  same([c.txt.p, c.txt.pb, c.txt.F, c.txt.F2, c.txt.chart].join(' | '), '294 kPa | 491 kPa | 12.3 MN | as heavy as 1,250 tonnes | 12 MN at 50 m', 'on load (H 50 m, sensor 30 m)');
  const at = (H, h) => { const c = G.depthCalc(H, h); return [c.txt.p, c.txt.pb, c.txt.F, c.txt.F2, c.txt.chart, c.txt.tri].join(' | '); };
  same(at(100, 50), '491 kPa | 981 kPa | 49.0 MN | as heavy as 5,000 tonnes | 49 MN at 100 m | 981 kPa', 'H 100 m, sensor 50 m');
  same(at(20, 10), '98 kPa | 196 kPa | 1.96 MN | as heavy as 200 tonnes | 2.0 MN at 20 m | ', 'H 20 m, sensor 10 m');
  same(at(5, 0), '0 kPa | 49 kPa | 123 kN | as heavy as 13 tonnes | 0.1 MN at 5 m | ', 'H 5 m, sensor at the surface');
  near(G.depthCalc(100, 0).F / G.depthCalc(50, 0).F, 4, 1e-12, 'double the depth, four times the push');
}

console.log('\nFig. 3.1 · the permeability race');
{
  const mats = ['gravel', 'sand', 'silt', 'clay'].map(k => Object.assign({ t: G.raceTime(G.MATS[k]) }, G.MATS[k]));
  same(mats.map(m => G.fmtDur(m.t)).join(' / '), '30 s / 58 min / 46 days / 11 years', 'time to cross 1 m: gravel / sand / silt / clay');
  same(Math.round(mats[3].t / mats[0].t / 1e6), 12, 'clay at the scale where gravel\'s time is 1 mm (km)');
  const v0 = inputValue('rc-t'), r0 = G.raceReadouts(v0, mats);
  same(v0, 0, 'clock on load');
  staticMatches([['rc-t-o', r0.t], ['rc-clock', r0.t], ['rc-clock2', r0.clock2], ['rc-done', r0.done1], ['rc-done2', r0.done2]], 'Fig. 3.1');
  const at = v => { const r = G.raceReadouts(v, mats); return [r.t, r.clock2, r.done1, r.done2].join(' | '); };
  same(at(4), '2.8 h | clock is running 3,162× faster | Gravel, Sand | 2 of four', 'clock at 10⁴ s');
  same(at(7), '17 weeks | clock is running 3,162,278× faster | Gravel, Sand, Silt | 3 of four', 'clock at 10⁷ s');
  same(at(9), '32 years | clock is running 316,227,766× faster | All four | clay took 11 years', 'clock at the end');
}

console.log('\nFig. 3.2 · Darcy\'s experiment');
{
  const st = G.DARCY0, ro = G.darcyReadouts(st);
  same(pressed('dc-mat') + ' / ' + (pressed('dc-plug') === '1') + ' / ' + inputValue('dc-hl') + ' / ' + inputValue('dc-hr') + ' / ' + inputValue('dc-L'),
    st.mat + ' / ' + st.plug + ' / ' + st.hl + ' / ' + st.hr + ' / ' + st.L, 'state on load matches the controls (material / plug / left / right / length)');
  staticMatches([['dc-hl-o', ro.hl], ['dc-hr-o', ro.hr], ['dc-L-o', ro.L], ['dc-dh', ro.dhTxt], ['dc-dh2', ro.dh2], ['dc-i', ro.iTxt], ['dc-i2', ro.i2], ['dc-q', ro.qTxt], ['dc-q2', ro.q2], ['dc-share', ro.shareTxt], ['dc-share2', ro.share2]], 'Fig. 3.2');
  const at = o => { const r = G.darcyReadouts(Object.assign({}, st, o)); return [r.dhTxt, r.iTxt, r.qTxt, r.shareTxt].join(' | '); };
  same(at({}), '1.40 m | 0.70 | 4.2 L/min | –', 'on load: sand, no plug');
  same(at({ mat: 'gravel' }), '1.40 m | 0.70 | 7.0 L/s | –', 'gravel');
  same(at({ mat: 'silt' }), '1.40 m | 0.70 | 6.0 L/day | –', 'silt');
  same(at({ plug: true }), '1.40 m | 0.70 | 110 L/year | 99.9960%', 'sand with the clay plug');
  same(at({ mat: 'gravel', plug: true }), '1.40 m | 0.70 | 110 L/year | 100.0000%', 'gravel with the clay plug');
  same(at({ mat: 'silt', plug: true }), '1.40 m | 0.70 | 106 L/year | 96.15%', 'silt with the clay plug');
  same(at({ hl: 0.6, hr: 2, L: 4 }), '1.40 m | 0.35 | 2.1 L/min | –', 'tanks swapped, pipe 4 m');
  const r = G.darcyReadouts(Object.assign({}, st, { hl: 1, hr: 1 }));
  same([r.dh2, r.qTxt, r.shareTxt].join(' | '), 'levels equal | 0 | –', 'levels equal');
  const p = Object.assign({}, st, { plug: true });
  same([0, 0.4, 0.6, 1].map(f => G.darcyHeadAt(p, f).toFixed(4)).join(' / '), '2.0000 / 2.0000 / 0.6000 / 0.6000', 'head along the plugged sand pipe (m) at 0, 40, 60, 100% of the length');
}

console.log('\nFig. 4.1 · block on a ramp');
{
  same(inputValue('bk-a') + ' / ' + inputValue('bk-u'), G.BLOCK.a + ' / ' + G.BLOCK.u, 'state on load matches the sliders (angle / pressure)');
  const ro = G.blockReadouts(G.BLOCK.a, G.BLOCK.u);
  staticMatches([['bk-a-o', ro.a], ['bk-u-o', ro.u], ['bk-N', ro.N], ['bk-U', ro.U], ['bk-Ne', ro.Ne], ['bk-Fa', ro.Fa], ['bk-Fn', ro.Fn], ['bk-fs', ro.fs]], 'Fig. 4.1');
  const at = (a, u) => { const r = G.blockReadouts(a, u); return [r.N, r.U, r.Ne, r.Fa, r.Fn, r.fs, r.holds ? 'holds' : 'slides', r.pill].join(' | '); };
  same(at(25, 0), '18.1 kN | 0.0 kN | 18.1 kN | 12.2 kN | 8.5 kN | 1.45 | holds | ok', 'on load: 25°, dry cushion');
  const f = G.blockForces(25, 0), uSlide = f.N - f.Fn / Math.tan(G.BLOCK.PHI);
  same(uSlide.toFixed(1), '5.6', 'at 25° it slides above this cushion pressure (kPa)');
  same(Math.round(100 * uSlide / f.N) + '%', '31%', 'share of the press the water carries then');
  same(at(25, 5.5), '18.1 kN | 5.5 kN | 12.6 kN | 8.5 kN | 8.5 kN | 1.01 | holds | warn', '25°, 5.5 kPa (the last slider step that holds)');
  same(at(25, 6), '18.1 kN | 6.0 kN | 12.1 kN | 8.2 kN | 8.5 kN | 0.97 | slides | bad', '25°, 6 kPa');
  same(at(10, 20), '19.7 kN | 19.7 kN | 0.0 kN | 0.0 kN | 3.5 kN | 0.00 | slides | bad', '10° with 20 kPa: even 10° is too steep');
  same(at(0, 0).split(' | ').slice(5).join(' | '), '∞ | holds | ok', 'flat ramp');
  same(at(5, 0).split(' | ')[5] + ' / ' + at(3, 0).split(' | ')[5], '7.71 / > 10', 'gentle ramps, 5° / 3°');
  same(at(33, 0).split(' | ')[6] + ' / ' + at(35, 0).split(' | ')[6], 'holds / slides', 'dry block either side of the 34° friction angle');
}

console.log('\nFig. 4.2 · stresses in a sand column');
{
  const wt = -inputValue('gc-wt'), ro = G.columnReadouts(wt);
  same(wt, 4, 'water table on load (m down)');
  staticMatches([['gc-wt-o', ro.wt], ['gc-s', ro.s], ['gc-u', ro.u], ['gc-u2', ro.u2], ['gc-e', ro.e], ['gc-str', ro.str]], 'Fig. 4.2');
  const at = w => { const r = G.columnReadouts(w); return [r.wt, r.s, r.u, r.e, r.str, r.u2].join(' | '); };
  same(at(4), '4.0 m down | 192 kPa | 59 kPa | 133 kPa | 74% | water 6.0 m above this point', 'water table 4 m down (on load)');
  same(at(10), 'below the column | 180 kPa | 0 kPa | 180 kPa | 100% | no water at 10 m', 'water table at the foot');
  same(at(0), 'at the ground | 200 kPa | 98 kPa | 102 kPa | 57% | water 10.0 m above this point', 'water table at the ground');
  same(at(-3), '3.0 m above ground | 229 kPa | 128 kPa | 102 kPa | 57% | water 13.0 m above this point', 'flooded 3 m');
  near(G.columnReadouts(-3).eB, G.columnReadouts(0).eB, 1e-9, 'flood water on top leaves the effective stress unchanged');
  same(G.columnStress(4, 4).map(v => v.toFixed(1)).join(' / '), '72.0 / 0.0', 'σ / u at the water table, 4 m down (kPa)');
}

console.log('\nFig. 5.1 · hydro dam readouts');
{
  const lv = inputValue('hy-level'), Q = inputValue('hy-flow'), c = C.hydroCalc(lv, Q);
  same(lv + ' / ' + Q, '80 / 150', 'sliders on load: level / turbine flow');
  staticMatches([['hy-level-o', c.txt.level], ['hy-flow-o', c.txt.flow], ['hy-P', c.txt.P], ['hy-p', c.txt.p], ['hy-F', c.txt.F]], 'Fig. 5.1');
  const at = (lv, Q) => { const c = C.hydroCalc(lv, Q); return [c.txt.level, c.txt.P, c.txt.p, c.txt.F].join(' | '); };
  same(at(80, 150), 'H = 85 m | 112 MW | 0.87 MPa | Water load 39 MN per metre of dam', 'on load');
  same(at(100, 300), 'H = 92 m | 244 MW | 0.94 MPa | Water load 45 MN per metre of dam', 'full reservoir, full flow');
  same(at(0, 10), 'H = 56 m | 5 MW | 0.59 MPa | Water load 18 MN per metre of dam', 'lowest level, least flow');
}

console.log('\nFig. 6.1 · raising methods');
{
  const t0 = inputValue('rs-t');
  same(t0, 10, 'stage on load');
  staticMatches([['rs-stage', C.stageText(t0)]], 'Fig. 6.1');
  const at = (t, key) => { const d = C.raiseDam(key, C.stateAt(t)); return [d.txt.fill, d.txt.shift, d.txt.ontail].join(' | '); };
  same(at(10, 'up'), '2,496 | −112 m | 62%', 'upstream, finished: fill m³/m | crest shift | on tailings');
  same(at(10, 'down'), '9,792 | +96 m | 0%', 'downstream, finished');
  same(at(10, 'centre'), '6,144 | 0 m | 9%', 'centreline, finished');
  same(['up', 'down', 'centre'].map(k => at(0.5, k)).join(' / '), '680 | 0 m | 0% / 680 | 0 m | 0% / 680 | 0 m | 0%', 'starter dam half built');
  same(['up', 'down', 'centre'].map(k => at(4.5, k)).join(' / '), '1,608 | −28 m | 40% / 4,104 | +24 m | 0% / 2,856 | 0 m | 9%', 'raise 2 half placed');
  same([0.5, 1.5, 4.5, 7.2, 10].map(C.stageText).join(' / '), 'Starter dam · placing fill / Starter dam · depositing tailings / Raise 2 · placing fill / Raise 3 · depositing tailings / Raise 4 complete · 68 m', 'stage names');
}

console.log('\nFig. 8.2 · seepage lab: piping readout');
{
  const s0 = S.LAB0;
  same(pressed('lab-dam') + ' / ' + pressed('lab-drain') + ' / ' + pressed('lab-cut') + ' / ' + pressed('lab-found') + ' / ' + inputValue('lab-res') / 100,
    [s0.damType, s0.drain, s0.cutoff, s0.foundation, s0.reservoir].join(' / '), 'state on load matches the controls');
  same(staticText('lab-res-o'), (Math.round(s0.reservoir * 24 * 10) / 10).toFixed(1) + ' m', 'Fig. 8.2 #lab-res-o in the markup matches the reservoir on load');
  const at = o => {
    const r = solveSeepage(Object.assign({}, s0, o)), p = S.labPiping(r.exit);
    return [S.labFmtQ(r.q.inflowTotal) + ' L/day', p.i, p.i2, p.fs.toFixed(2), p.fsTxt, p.word, p.cls].join(' | ');
  };
  same(at({}), '2,366 L/day | 0.79 | on the downstream slope | 1.27 | 1.3 | Piping risk | bad', 'on load');
  // 1.47 shows as "1.5" next to "Piping risk": flagged in the book plan (pedagogy fix list item 7); update this pin when that is fixed
  same(at({ cutoff: 'partial' }), '2,160 L/day | 0.68 | on the downstream slope | 1.47 | 1.5 | Piping risk | bad', 'half-depth cutoff');
  same(at({ cutoff: 'full' }), '166 L/day | 0.04 | at the ground beyond the toe | 22.47 | 22.5 | Adequate | ok', 'full cutoff');
  same(at({ drain: 'toe' }), '2,647 L/day | 0.08 | at the ground beyond the toe | 12.84 | 12.8 | Adequate | ok', 'toe drain');
  same(at({ drain: 'chimney' }), '4,052 L/day | ≈ 0 | all exits are filtered drains | 342.89 | > 50 | Safe | ok', 'chimney and blanket drain');
  same([S.labPiping(null).fsTxt, S.labPiping({ fs: 2, groundMax: 0.5 }).word, S.labPiping({ fs: 0.9, faceMax: 1.11, governing: 'face' }).i2].join(' / '),
    '> 50 / Marginal / on the downstream slope', 'no exit / marginal band / exit on the slope');
}

console.log('\nFig. 8.3 · piping stages');
same(inputValue('pp-t'), 0, 'progress on load');
staticMatches([['pp-stage', S.names[0]]], 'Fig. 8.3');

console.log('\nFig. 8.4 · uplift and sliding');
{
  same(inputValue('up-hw'), S.HW0, 'reservoir on load matches the slider');
  same(pressed('up-drains'), '1', 'drains working on load');
  same(staticText('up-hw-o'), S.HW0.toFixed(1) + ' m', 'Fig. 8.4 #up-hw-o in the markup matches the reservoir on load');
  same((S.W / 1000).toFixed(2), '34.78', 'weight W (MN/m)');
  const at = (drains, HW) => { const c = S.upliftCalc(HW, S.upliftDrainHead(drains, HW)), r = S.upliftReadouts(c); return { c, r, s: [r.W, r.H, r.U, r.U2, r.FS, r.fsW, r.R, r.rW].join(' | ') }; };
  const d = at(true, S.HW0), k = at(false, S.HW0);
  same([S.upliftDrainHead(true, 57), S.upliftDrainHead(false, 57)].map(v => v.toFixed(2)).join(' / '), '22.33 / 50.50', 'head at the drain line, working / clogged (m)');
  same([(d.c.U / 1000).toFixed(2), (k.c.U / 1000).toFixed(2), (d.c.H / 1000).toFixed(2)].join(' / '), '7.97 / 14.60 / 15.81', 'U working / U clogged / H (MN/m)');
  same([d.c.FS, k.c.FS].map(v => v.toFixed(3)).join(' / '), '1.696 / 1.276', 'sliding safety, working / clogged');
  same([d.c.xR / S.B, k.c.xR / S.B].map(v => v.toFixed(3)).join(' / '), '0.556 / 0.616', 'resultant from the heel, working / clogged (× B)');
  same(d.s, '34.8 MN/m | 15.8 MN/m | 8.0 MN/m | 23% of the weight | 1.70 | Meets 1.5 | 0.56 B | Middle third', 'on load: 57 m, drains working');
  same(k.s, '34.8 MN/m | 15.8 MN/m | 14.6 MN/m | 42% of the weight | 1.28 | Below 1.5 | 0.62 B | Middle third', '57 m, drains clogged');
  same(at(true, 59).s, '34.8 MN/m | 17.0 MN/m | 8.2 MN/m | 24% of the weight | 1.57 | Meets 1.5 | 0.58 B | Middle third', '59 m, drains working');
  same(at(false, 30).s, '34.8 MN/m | 4.3 MN/m | 8.2 MN/m | 24% of the weight | 6.18 | Meets 1.5 | 0.35 B | Middle third', '30 m, drains clogged');
  near(k.c.U / d.c.U, 1.83, 0.005, 'clogging the drains nearly doubles the uplift (ratio)');
}

console.log('\nFacts the text states (errata fixes)');
{
  const plain = decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  const says = (str, label) => check(plain.includes(str), `${label}: says "${str}"`);
  const never = (str, label) => check(!plain.includes(str), `${label}: no longer says "${str}"`);
  const gsrc = read('app-glossary.js');
  const GL = new Function(gsrc.slice(gsrc.indexOf('const GLOSSARY'), gsrc.indexOf('\n};', gsrc.indexOf('const GLOSSARY')) + 3) + '\nreturn GLOSSARY;')();
  const usedTerms = new Set([...html.matchAll(/data-term="([\w-]+)"/g)].map(m => m[1]));
  const missing = [...usedTerms].filter(t => !GL[t]);
  check(!missing.length, `glossary has an entry for all ${usedTerms.size} marked terms` + (missing.length ? ', missing ' + missing.join(', ') : ''));
  // Foster, Fell & Spannagle (2000), Table 3: 124 failures to 1986; piping 46.9%, overtopping 34.2%,
  // with spillways and gates 48.4%; after 1950, 54.2% against 40.7%
  says('about as many failures as overtopping: 47% against 48% once spillway and gate failures are counted with overtopping', 'Step 8, Foster et al.');
  says('more than overtopping alone (34%), and since 1950 internal erosion has led, 54% against 41%', 'Step 8, Foster et al.');
  never('nearly half of the failures whose cause was known', 'Step 8, Foster et al.');
  check(/internal erosion/i.test(GL.piping[1]) && !!GL['internal-erosion'], 'glossary: piping points to internal erosion, which has its own entry');
  // Step 3 opens with head, not pressure
  says('from where its head is high to where it is low', 'Step 3, first paragraph');
  never('from where it is pushed hard to where it is pushed less', 'Step 3, first paragraph');
  // only the downstream shell is kept dry; the upstream one is soaked by the reservoir
  never('shells on either side fairly dry', 'Step 7');
  never('Low water pressure in the outer zones', 'Step 4 ideas card');
  says('That leaves the downstream shell fairly dry', 'Step 7');
  says('The upstream shell stays soaked', 'Step 4 ideas card');
  // Fig 6.1: centreline puts some fill on the beach, as its own readout shows
  never('In the other two, every raise rests on compacted', 'Fig. 6.1 caption');
  says('Centreline raises put only a small upstream wedge on the beach (' + C.raiseDam('centre', C.stateAt(10)).txt.ontail + ' of the fill here)', 'Fig. 6.1 caption quotes the centreline readout');
}

console.log(`\n${fails ? fails + ' check(s) FAILED' : 'all ' + passes + ' checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fails ? 1 : 0);
