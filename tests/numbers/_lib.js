/* The shared context for number definitions (book/SPEC.md E.4).
 *
 * X.G  app-ground's pure blocks (beach, depth, race, darcy, block, column)
 * X.C  app-core's hydro and raise blocks
 * X.S  app-seep's lab, pipe and uplift blocks
 * X.U  app-core's util block (n1, fmt, polyArea, …)
 * X.seep(opts)    the seepage solver, cached per argument set
 * X.bench(design) a workbench run: { seep, stab, m (designMetrics), crit (downstream critical surface), up }
 *                 design = { preset, slope, found, cut, res, uprock } with the workbench's defaults
 * X.ST            the stability solver module (BUILD.materials, presetCells, …)
 * X.grains()      the grain sandbox's parameters (prm) as the page builds it (app-grains.js @grains-sim)
 * X.deg           π/180
 *
 * load(), evaluate(key) and parseKey() are what tests/test-book.js uses. */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', '..', 'src');
const read = n => fs.readFileSync(path.join(SRC, n), 'utf8');
const { solveSeepage } = require(path.join(SRC, 'seepage-solver.js'));
const ST = require(path.join(SRC, 'stability-solver.js'));

function block(src, file, name) {
  const a = `/* @fig-${name}-begin */`, b = `/* @fig-${name}-end */`;
  const i = src.indexOf(a), j = src.indexOf(b);
  if (i < 0 || j < i) throw new Error(`markers @fig-${name} missing in ${file}`);
  return src.slice(i + a.length, j);
}
const core = read('app-core.js'), ground = read('app-ground.js'), seep = read('app-seep.js');
const UTIL = block(core, 'app-core.js', 'util');
const load = (code, names) => new Function(UTIL + '\nconst deg = Math.PI / 180;\n' + code + `\nreturn { ${names.join(', ')} };`)();

const G = load(['beach', 'depth', 'race', 'darcy', 'block', 'column'].map(n => block(ground, 'app-ground.js', n)).join('\n'),
  ['BEACH0', 'PACK0', 'G_SAT', 'G_W', 'beachShapes', 'beachJiggle', 'depthCalc', 'MATS', 'fmtDur', 'raceTime', 'DARCY0', 'DARCY_PLUG', 'darcyKEff', 'darcyHeadAt', 'darcyReadouts',
    'BLOCK', 'blockForces', 'blockReadouts', 'COL', 'columnStress', 'columnReadouts']);
const C = load(block(core, 'app-core.js', 'hydro') + block(core, 'app-core.js', 'raise'), ['hydroCalc', 'R', 'stateAt', 'stageText', 'raiseDam']);
const S = load(block(seep, 'app-seep.js', 'lab') + block(seep, 'app-seep.js', 'pipe') + block(seep, 'app-seep.js', 'uplift'),
  ['LAB0', 'labFmtQ', 'labPiping', 'names', 'B', 'TW', 'W', 'gc', 'gw', 'HW0', 'upliftDrainHead', 'upliftCalc', 'upliftReadouts']);
const U = load('', ['n1', 'fmt', 'clamp', 'lerp', 'polyArea']);

const seepCache = new Map();
function seepRun(opts) {
  const o = Object.assign({}, S.LAB0, opts), k = JSON.stringify(o);
  if (!seepCache.has(k)) seepCache.set(k, solveSeepage(o));
  return seepCache.get(k);
}
const benchCache = new Map();
// uprock: rockfill painted over every dam cell upstream of x = uprock (m from the dam's centre line;
// the crest runs from -3 to 3), as the "Empty it fast" mission's fix; 'none' paints nothing
const BENCH0 = { preset: 'homogeneous', slope: 2, found: 'clay', cut: 'none', res: 0.85, uprock: 'none' };
function benchCells(o) {
  const c = ST.presetCells(o.preset, o.slope);
  if (o.uprock !== 'none' && o.uprock != null) {
    const xb = +o.uprock, rock = ST.BUILD.materials.findIndex(m => m.key === 'rock');
    for (let i = 0; i < 170; i++) for (let j = 15; j < 39; j++) if (-80 + i + 0.5 < xb) c[i * 39 + j] = rock;
  }
  return c;
}
function bench(d) {
  const o = Object.assign({}, BENCH0, d);
  o.slope = +o.slope; o.res = +o.res; if (o.uprock == null) o.uprock = 'none';
  const k = JSON.stringify(o);
  if (!benchCache.has(k)) {
    const r = ST.runDesign({ cells: benchCells(o), slope: o.slope, foundation: o.found, cutoff: o.cut, reservoir: o.res }, { solveSeepage });
    benchCache.set(k, { seep: r.seep, stab: r.stab, m: ST.designMetrics(r.seep, r.stab), crit: r.stab.downstream && r.stab.downstream.critical, up: r.stab.upstream });
  }
  return benchCache.get(k);
}

// the grain sandbox: its pure simulation block, built as the page builds it, for its parameters
let grainsPrm = null;
function grains() {
  if (!grainsPrm) {
    const src = read('app-grains.js'), a = src.indexOf('/* @grains-sim-begin */'), b = src.indexOf('/* @grains-sim-end */');
    if (a < 0 || b < a) throw new Error('markers @grains-sim missing in app-grains.js');
    const grainsSim = new Function(src.slice(a, b) + '\nreturn grainsSim;')();
    grainsPrm = grainsSim({ N: 420, seed: 11, bench: 0.55 }).prm;
  }
  return grainsPrm;
}

const X = { G, C, S, U, ST, seep: seepRun, bench, BENCH0, grains, deg: Math.PI / 180 };

// ---- keys: ns.name@a=1,b=x
const KEY = /^([a-z][a-z0-9-]*)\.([a-z][a-z0-9-]*)(?:@((?:[a-z][a-z0-9]*=[-+.0-9a-z]+)(?:,[a-z][a-z0-9]*=[-+.0-9a-z]+)*))?$/i;
function parseKey(key) {
  const m = key.match(KEY);
  if (!m) return null;
  const args = {};
  if (m[3]) for (const p of m[3].split(',')) { const [a, v] = p.split('='); args[a] = v; }
  return { ns: m[1], name: m[1] + '.' + m[2], args };
}

// every definition file in this directory: figs.js and the per-unit files
function loadDefs() {
  const defs = {}, owner = {};
  for (const f of fs.readdirSync(__dirname).filter(f => /\.js$/.test(f) && f !== '_lib.js').sort()) {
    const D = require(path.join(__dirname, f)), unit = f.replace(/\.js$/, '');
    for (const k of Object.keys(D)) {
      if (defs[k]) throw new Error(`number key ${k} is defined twice (${owner[k]} and ${f})`);
      defs[k] = D[k]; owner[k] = f;
      const ns = k.split('.')[0];
      if (unit !== 'figs' && ns !== unit) throw new Error(`${f} defines ${k}, outside its own namespace "${unit}"`);
    }
  }
  return { defs, owner };
}

function evaluate(defs, key) {
  const p = parseKey(key);
  if (!p) throw new Error(`"${key}" is not a key (ns.name@arg=value,…)`);
  const d = defs[p.name];
  if (!d) throw new Error(`no definition for ${p.name}`);
  for (const a of Object.keys(p.args)) if (!d.args || !(a in d.args)) throw new Error(`${p.name} takes no argument "${a}"`);
  const args = Object.assign({}, d.args || {}, p.args);
  const v = d.f(args, X);
  if (typeof v !== 'number' || !isFinite(v)) throw new Error(`${key} gives ${v}`);
  return v;
}

module.exports = { X, parseKey, loadDefs, evaluate };
