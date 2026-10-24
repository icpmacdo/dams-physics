/* Checks the book as a book (book/SPEC.md sections D, E, G.4 and I):
 *   - every <span data-n="key"> shows exactly what the code computes, at the precision shown
 *     (definitions in tests/numbers/*.js), and the figure keys still give Appendix 4's values;
 *   - no dangling reference, no duplicate id, no internal link to a missing id;
 *   - every unit in src/book.json is on the page, in order; every old #anchor and every old id
 *     still lands where it should;
 *   - every film segment sits inside its file (durations from book.json against the VTT captions), cuts
 *     fall between spoken lines, marks sit inside their segment at a spoken line, the transcript holds
 *     exactly the segment's cues, and the Contents lists all seven films with their running times;
 *   - no typed figure or chapter number in a script string, and every ref('…') names a real target;
 *   - every "Set the figure" button names controls and values that exist;
 *   - no visible placeholder text; nothing before Chapter 13 gives Mount Polley's cause away;
 *   - the build refuses a dangling reference, a duplicate id, a typed number and a misplaced film mark.
 * Run: node tests/test-book.js   (a few seconds: one build, a handful of solver runs) */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const { book, plainText, decode, ROOT } = require('./lib/book.js');
const N = require('./numbers/_lib.js');
const SRC = path.join(ROOT, 'src');

let fails = 0, passes = 0;
function check(ok, msg) { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (ok) passes++; else fails++; }
const t0 = Date.now();
const { html, data } = book();
const B = JSON.parse(fs.readFileSync(path.join(SRC, 'book.json'), 'utf8'));

// ---------------------------------------------------------------- the number manifest
console.log('\nNumbers on the page (tests/numbers/*.js)');
const { defs } = N.loadDefs();
const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
const supInt = s => (s[0] === '⁻' ? -1 : 1) * +[...s.replace('⁻', '')].map(c => SUP[c]).join('');
// the shown text → { value, decimals, scale } (scale: the value is compared after × 10^-scale)
function parseShown(t) {
  t = t.trim().replace(/−/g, '-');
  let m = t.match(/^(-?[\d.,]+) × 10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
  if (m) { const mant = m[1].replace(/,/g, ''); return { value: +mant, decimals: (mant.split('.')[1] || '').length, scale: supInt(m[2]) }; }
  m = t.match(/^10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
  if (m) return { value: 1, decimals: 0, scale: supInt(m[1]) };
  m = t.match(/^(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(%?)$/);
  if (m) { const s = m[1].replace(/,/g, ''); return { value: +s, decimals: (s.split('.')[1] || '').length, scale: 0, pct: !!m[2] }; }
  return null;
}
const roundHalfAway = (v, d) => { const f = Math.pow(10, d); return Math.sign(v) * Math.round(Math.abs(v) * f + 1e-9) / f; };
const roundSig = (v, s) => { if (v === 0) return 0; const d = s - 1 - Math.floor(Math.log10(Math.abs(v))); return d >= 0 ? roundHalfAway(v, d) : Math.sign(v) * Math.round(Math.abs(v) / Math.pow(10, -d)) * Math.pow(10, -d); };
const spans = [...html.matchAll(/<(span|tspan)\b([^>]*\bdata-n="([^"]*)"[^>]*)>([^<]*)</g)].map(m => {
  const sig = m[2].match(/\bdata-n-sig="(\d+)"/);
  return { key: decode(m[3]), text: decode(m[4]), sig: sig ? +sig[1] : null };
});
check(spans.length > 0, `the page has ${spans.length} keyed numbers`);
for (const s of spans) {
  let v;
  try { v = N.evaluate(defs, s.key); } catch (e) { check(false, `${s.key}: ${e.message}`); continue; }
  const shown = parseShown(s.text);
  if (!shown) { check(false, `${s.key}: "${s.text}" is not a number`); continue; }
  const x = v / Math.pow(10, shown.scale);
  const r = s.sig ? roundSig(x, s.sig) : roundHalfAway(x, shown.decimals);
  const ok = Math.abs(r - shown.value) < 1e-9 * Math.max(1, Math.abs(shown.value));
  check(ok, `${s.key} shows "${s.text}"` + (ok ? '' : `, but the code gives ${+v.toPrecision(6)} (→ ${r})`));
}
// every definition runs at its defaults and gives a finite number
{
  const bad = [];
  for (const k of Object.keys(defs)) { try { N.evaluate(defs, k); } catch (e) { bad.push(k + ': ' + e.message); } }
  check(!bad.length, `all ${Object.keys(defs).length} number definitions give a finite number at their defaults` + (bad.length ? ': ' + bad.join('; ') : ''));
}
// the figure keys at their defaults: the values book/SPEC.md Appendix 4 records (the figures' numbers, pinned)
{
  const A4 = {
    'const.gw': 9.81, 'const.gconc': 23.5, 'beach.repose-deg': 34, 'beach.gsat': 20, 'beach.gprime': 10.19, 'beach.tan-drain': 0.3437,
    'beach.drain-deg': 18.97, 'beach.area-cm2': 572.6, 'beach.cone-h-cm': 19.65, 'beach.cone-base-cm': 58.27,
    'depth.p-kpa': 294.3, 'depth.pb-kpa': 490.5, 'depth.F-kn': 12262.5, 'depth.F-mn': 12.26, 'depth.tonnes': 1250, 'depth.arm-m': 16.67, 'depth.moment-mnm': 204.4,
    'race.t-s@mat=gravel': 30, 'race.t-min@mat=sand': 58.3, 'race.t-day@mat=silt': 46.3, 'race.t-yr@mat=clay': 11.09,
    'darcy.dh-m': 1.40, 'darcy.i': 0.70, 'darcy.q-lmin': 4.2, 'darcy.cross-h': 2.78, 'darcy.share-pct': 99.996, 'darcy.share-pct@mat=silt': 96.15,
    'darcy.r-sand-s': 16000, 'darcy.r-clay-s': 4.0e8, 'darcy.ratio-noplug': [20000, 4],
    'block.W-kn': 20, 'block.phi-deg': 34, 'block.a-deg': 25, 'block.N-kn': 18.13, 'block.Fa-kn': 12.23, 'block.Fn-kn': 8.45, 'block.fs': 1.446,
    'block.u-slide-kpa': 5.595, 'block.slide-pct': 30.87, 'block.u-slide-kpa@a=10': 14.55, 'block.u-slide-kpa@a=30': 2.495, 'block.slide-pct@a=30': 14.4,
    'column.s-kpa': 192, 'column.u-kpa': 58.86, 'column.e-kpa': 133.14, 'column.str-pct': 74,
    'hydro.H-m': 84.8, 'hydro.depth-m': 88.8, 'hydro.p-mpa': 0.871, 'hydro.F-mn': 38.68, 'hydro.P-mw': 112.3, 'hydro.arm-m': 29.6, 'hydro.q-for-mw': 246.2,
    'raise.fill-m2@method=up': 2496, 'raise.shift-m@method=up': -112, 'raise.ontail-pct@method=up': 62,
    'raise.fill-m2@method=centre': 6144, 'raise.shift-m@method=centre': 0, 'raise.ontail-pct@method=centre': 9,
    'raise.fill-m2@method=down': 9792, 'raise.shift-m@method=down': 96, 'raise.ontail-pct@method=down': 0, 'raise.starter-m2': 960, 'raise.dyke-m2': 384,
    'lab.q-lday': 2366, 'lab.i-exit': 0.79, 'lab.fs': 1.273, 'lab.face-m': 2, 'lab.face-pct': 1, 'lab.floor-lday': 2145, 'lab.damface-lday': 221, 'lab.res-m': 20.4, 'lab.tube-ratio': 8,
    'uplift.area-m2': 1480, 'uplift.W-mn': 34.78, 'uplift.F-mn': 15.81, 'uplift.ud-m': 22.33, 'uplift.U-mn': 7.97, 'uplift.U-pct': 23, 'uplift.fs': 1.696, 'uplift.xr': 0.556,
    'uplift.ud-m@drains=0': 50.5, 'uplift.U-mn@drains=0': 14.60, 'uplift.U-pct@drains=0': 42, 'uplift.fs@drains=0': 1.276, 'uplift.xr@drains=0': 0.616,
    'uplift.fs-phi@phi=35': 1.187, 'uplift.hw-cross': 53.6,
    'bench.q-lday': 44.37, 'bench.pipe': 1.368, 'bench.fos': 1.116, 'bench.fos-up': 0.940, 'bench.clay-m3': 0, 'bench.cells': 1296, 'bench.face-m': 8, 'bench.ru': 0.353, 'bench.fos-nowater': 1.741,
    'bench.slice-b': 1.359, 'bench.slice-w-kn': 319.0, 'bench.slice-u-kpa': 76.4, 'bench.slice-alpha-deg': 31.9,
    'bench.mat-phi': 32, 'bench.mat-c': 10, 'bench.mat-gs': 20.5, 'bench.mat-gm': 19, 'bench.mat-phi@mat=clay': 26, 'bench.mat-c@mat=clay': 8,
    'bench.mat-phi@mat=rock': 42, 'bench.mat-gs@mat=rock': 22, 'bench.mat-phi@mat=filter': 36, 'bench.mat-phi@mat=tsand': 33, 'bench.mat-gs@mat=tsand': 19.5
  };
  const off = [];
  for (const [k, w] of Object.entries(A4)) { // a value, or [value, significant figures]
    let v; try { v = N.evaluate(defs, k); } catch (e) { off.push(k + ': ' + e.message); continue; }
    const want = Array.isArray(w) ? w[0] : w, d = (String(want).split('.')[1] || '').length;
    const got = Array.isArray(w) ? roundSig(v, w[1]) : want >= 1e6 ? roundSig(v, 2) : roundHalfAway(v, d);
    if (Math.abs(got - want) > 1e-9 * Math.max(1, Math.abs(want))) off.push(`${k} = ${+v.toPrecision(6)}, Appendix 4 says ${want}`);
  }
  check(!off.length, `the ${Object.keys(A4).length} figure keys give Appendix 4's values at the figures' states on load` + (off.length ? ': ' + off.join('; ') : ''));
  const tried = N.evaluate(defs, 'bench.tried');
  check(tried > 2000 && tried < 3000, `bench.tried: the slope check tries more than two thousand surfaces (${tried})`);
}

// ---------------------------------------------------------------- worked lines reproduce (book/SPEC.md F.6)
// Every chain of printed numbers and operators that ends "= result" in a worked step, a Check, a What it
// means, an answer or a Try answer must give that result from the digits printed on the line, rounded to
// the decimals the result shows (a result in MN or MPa is read as thousands of kN or kPa).
// ("5.01 ÷ 1.635 = 3.07" failed: it gives 3.064.)
{
  const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|[½⅓⅔¼¾]`;
  const TERM = String.raw`(?:${NUM})(?:²|³)?`;
  const CHAIN = new RegExp(String.raw`(?<![\d.,²³½⅓⅔¼¾A-Za-z/(])(${TERM}(?:\s*[×÷+−]\s*${TERM})+)\s*=\s*(${NUM})(?![\d²³]|[.,]\d|\s*[×÷+−]\s*\d|\s*[zHx][²³]?(?![\w·]))(\s*M(?:N|Pa))?`, 'g');
  const FR = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4 };
  const val = t => { const m = /^(.*?)(²|³)?$/.exec(t.trim()); const v = FR[m[1]] !== undefined ? FR[m[1]] : +m[1].replace(/,/g, ''); return m[2] === '²' ? v * v : m[2] === '³' ? v * v * v : v; };
  function evalChain(expr) {
    const toks = expr.split(/\s*([×÷+−])\s*/);
    let terms = [], cur = val(toks[0]);
    for (let i = 1; i < toks.length; i += 2) {
      const op = toks[i], v = val(toks[i + 1]);
      if (op === '×') cur *= v; else if (op === '÷') cur /= v;
      else { terms.push(cur); terms.push(op); cur = v; }
    }
    terms.push(cur);
    let r = terms[0];
    for (let i = 1; i < terms.length; i += 2) r = terms[i] === '+' ? r + terms[i + 1] : r - terms[i + 1];
    return r;
  }
  // the inner markup of every element with one of these classes, nested tags and all
  function inner(cls) {
    const out = [];
    for (const m of html.matchAll(new RegExp(String.raw`<(span|p|div|li|details)\b[^>]*class="(?:[^"]* )?(?:${cls})(?: [^"]*)?"[^>]*>`, 'g'))) {
      const tag = m[1], re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
      re.lastIndex = m.index + m[0].length;
      let depth = 1, k;
      while (depth && (k = re.exec(html))) depth += k[1] ? -1 : 1;
      if (k) out.push(html.slice(m.index + m[0].length, k.index));
    }
    return out;
  }
  const blocks = inner('we-eq|we-check|we-means|we-ans|q-answer|try-ans|film-after|check');
  const bad = [];
  let n = 0;
  for (const b of blocks) {
    const text = plainText(b).replace(/\s+/g, ' ');
    for (const m of text.matchAll(CHAIN)) {
      const ops = m[1].match(/[×÷]/g);
      if (!ops) continue;   // sums and differences of rounded parts are left to the reader
      n++;
      const got = evalChain(m[1]) / (m[3] ? 1000 : 1), shown = +m[2].replace(/,/g, ''), d = (m[2].split('.')[1] || '').length;
      const tol = 0.5 * 10 ** -d * (1 + 1e-9) + 1e-12;
      if (Math.abs(got - shown) > tol) bad.push(`"${m[0].trim()}" gives ${+got.toPrecision(7)}`);
    }
  }
  check(n > 20 && !bad.length, `${n} printed products and quotients in worked lines reproduce from their printed digits` + (bad.length ? ': ' + bad.join('; ') : ''));
}

// ---------------------------------------------------------------- references and ids
console.log('\nReferences and ids');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => decode(m[1]));
const idSet = new Set(ids);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
check(!dup.length, `no id is used twice (${ids.length} ids)` + (dup.length ? ': ' + [...new Set(dup)].join(', ') : ''));
const refEls = [...html.matchAll(/<(\w+)\b[^>]*\bdata-ref="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/g)];
const dangling = refEls.filter(m => /^\s*\?\s*$/.test(m[3]) || m[2].split(',').some(id => !idSet.has(id.trim())));
check(refEls.length > 0 && !dangling.length, `all ${refEls.length} cross-references resolve` + (dangling.length ? ': ' + dangling.map(m => m[2]).join(', ') : ''));
const links = [...html.matchAll(/\shref="#([^"]+)"/g)].map(m => decode(m[1]));
const broken = [...new Set(links.filter(id => !idSet.has(id)))];
check(!broken.length, `all ${links.length} links inside the page land on an id` + (broken.length ? ': ' + broken.join(', ') : ''));
for (const [id, r] of Object.entries(data.refs)) if (!idSet.has(id)) check(false, `book-data names #${id}, which is not on the page`);
check(Object.values(data.refs).every(r => r.label && r.unit), `every numbered target has a label and a unit (${Object.keys(data.refs).length})`);
// no typed numbers left in the page's prose: every figure label the reader sees came from the build
const typed = (plainText(html).match(/\b(?:Fig\.|Film|Table|Example|Eq\.|Chapter) \d+(?:\.\d+)?/g) || []);
const labels = new Set(Object.values(data.refs).map(r => r.label));
const unknownLabels = [...new Set(typed.filter(t => !labels.has(t) && !/^Chapter \d+$/.test(t)))];
check(!unknownLabels.length, 'every "Fig. n.n" the reader sees is the number of a real figure' + (unknownLabels.length ? ': ' + unknownLabels.join(', ') : ''));

// ---------------------------------------------------------------- the units, in order
console.log('\nUnits and anchors');
const units = [...B.front.map(u => ['front', u]), ['prologue', B.prologue], ...B.parts.flatMap(p => p.chapters.map(c => ['chapter', c])), ['epilogue', B.epilogue], ...B.back.map(u => ['back', u])];
for (const [, u] of units) check(fs.existsSync(path.join(ROOT, u.file)), `${u.id}: ${u.file} exists`);
const chapters = B.parts.flatMap(p => p.chapters);
check(chapters.map(c => c.n).join() === chapters.map((c, i) => i + 1).join(), `chapters are numbered 1 to ${chapters.length} in order`);
const pos = id => html.search(new RegExp(`<section class="[^"]*"[^>]* id="${id}"|<section[^>]* id="${id}"`));
const chPos = chapters.map(c => pos(c.id));
check(chPos.every(p => p >= 0), 'every chapter is on the page');
check(chPos.every((p, i) => i === 0 || p > chPos[i - 1]), 'the chapters appear in book.json order');
check(B.parts.every(p => pos(p.id) >= 0 && pos(p.id) < pos(p.chapters[0].id)), 'each part opener comes before its first chapter');
const present = units.filter(([, u]) => pos(u.id) >= 0).map(([, u]) => pos(u.id));
check(present.every((p, i) => i === 0 || p > present[i - 1]), 'front matter, chapters and back matter are in book.json order');
check(data.units.filter(u => u.kind === 'chapter').map(u => u.label).join('|') === chapters.map(c => B.unitWord + ' ' + c.n).join('|'), 'book-data lists every chapter as "Chapter n"');
// the old anchors land where they should (book/SPEC.md B.3)
const unitOf = id => {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return null;
  let best = null, at = -1;
  for (const [, u] of units) { const p = pos(u.id); if (p >= 0 && p <= i && p > at) { at = p; best = u.id; } }
  return best;
};
const ANCHORS = { top: 'cover', beach: 'ch-beach', pressure: 'ch-depth', flow: 'ch-head', strength: 'ch-grip', types: 'ch-two-dams', raising: 'ch-raising',
  zones: 'ch-zones', seepage: 'ch-seepage', build: 'ch-build', cases: 'case-files', glossary: 'glossary', 'glossary-list': 'glossary' };
for (const [a, u] of Object.entries(ANCHORS)) check(unitOf(a) === u, `#${a} lands in #${u}` + (unitOf(a) === u ? '' : ` (it is in ${unitOf(a)})`));
const FIGS = { 'fig-beach': 'ch-beach', 'fig-depth': 'ch-depth', 'film-depth-not-size': 'ch-depth', 'fig-darcy': 'ch-head', 'pr-clay': 'ch-head', 'fig-race': 'ch-head',
  'pr-cushion': 'ch-grip', 'fig-block': 'ch-grip', 'fig-column': 'ch-grip', 'pr-grains-house': 'ch-trapped', 'fig-grains': 'ch-trapped', 'film-same-sand': 'ch-trapped',
  'fig-types': 'ch-two-dams', 'fig-uplift': 'ch-concrete', 'film-depth-not-size-2': 'ch-concrete', 'fig-raise': 'ch-raising', 'film-never-finished': 'ch-raising',
  'fig-zones': 'ch-zones', 'film-wall-of-dirt': 'ch-zones', 'fig-paths': 'ch-seepage', 'fig-lab': 'ch-seepage', 'fig-pipe': 'ch-erosion', 'fig-filter': 'ch-erosion',
  'film-sand-that-boils': 'ch-erosion', 'pr-build': 'ch-slope', 'film-every-dam-leaks': 'ch-slope', 'fig-build': 'ch-build', 'film-layer-nobody-found': 'ch-build' };
const wrong = Object.entries(FIGS).filter(([f, u]) => unitOf(f) !== u).map(([f, u]) => `${f} in ${unitOf(f)}, not ${u}`);
check(!wrong.length, `every figure, predict box and film sits in its chapter (${Object.keys(FIGS).length}, book/SPEC.md C)` + (wrong.length ? ': ' + wrong.join('; ') : ''));
// the academy's reading lessons frame the page as ../index.html?embed=<old step id>; app-book.js maps each
// old step to the chapters that now hold its material
{
  const src = fs.readFileSync(path.join(SRC, 'app-book.js'), 'utf8');
  const STEPS = new Function('return ' + src.slice(src.indexOf('const STEPS = ') + 14, src.indexOf('};', src.indexOf('const STEPS = ')) + 1))();
  const chIds = new Set(chapters.map(c => c.id));
  const badSteps = Object.entries(STEPS).filter(([, v]) => !v.length || v.some(id => !chIds.has(id))).map(([k]) => k);
  check(!badSteps.length, 'every old step in the embedded view maps to chapters of the book' + (badSteps.length ? ': ' + badSteps.join(', ') : ''));
  const course = fs.readFileSync(path.join(ROOT, 'academy', 'js', 'course.js'), 'utf8');
  const embeds = [...course.matchAll(/href: CLASSIC \+ '#([\w-]+)'/g)].map(m => m[1]);
  check(embeds.length > 0 && embeds.every(id => STEPS[id] && idSet.has(id)), `the academy's reading lessons (${embeds.join(', ')}) have an embedded view and an anchor`);
}
const OLD = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ids-before-book.json'), 'utf8')).ids;
const lost = OLD.filter(id => !idSet.has(id));
check(!lost.length, `all ${OLD.length} ids of the nine-step page are still on the page` + (lost.length ? ': lost ' + lost.join(', ') : ''));

// ---------------------------------------------------------------- films
console.log('\nFilms');
const vttEnd = file => {
  const t = fs.readFileSync(path.join(ROOT, 'docs', file), 'utf8');
  let end = 0;
  for (const m of t.matchAll(/-->\s*(\d+):(\d\d):(\d\d\.\d+)/g)) end = Math.max(end, +m[1] * 3600 + +m[2] * 60 + +m[3]);
  return end;
};
for (const [k, F] of Object.entries(B.films)) {
  const end = vttEnd(F.vtt);
  check(end <= F.duration + 0.5 && F.duration - end < 30, `${k}: the stored length ${F.duration} s fits its captions (last cue ends at ${end.toFixed(2)} s)`);
}
for (const [, u] of units) for (const s of u.films || []) {
  const F = B.films[s.film], end = s.end == null ? F.duration : s.end;
  check(F && s.start >= 0 && s.start < end && end <= F.duration, `${s.id}: ${s.start}–${end} s sits inside ${s.film} (${F.duration} s)`);
  const m = html.match(new RegExp(`<figure[^>]*id="${s.id}"[^>]*>`));
  check(!!m && new RegExp(`data-start="${s.start}"`).test(m[0]) && new RegExp(`data-end="${+end.toFixed(4)}"`).test(m[0]), `${s.id}: the page plays the same segment`);
}
check((html.match(/class="film-transcript-text"/g) || []).length === Object.keys(data.films).length, 'every film block has its transcript');

// the film treatment (book/SPEC.md F.13): each block, its marks, its transcript, its end card
const parseVtt = file => [...fs.readFileSync(path.join(ROOT, 'docs', file), 'utf8').split(/\n\s*\n/)].map(b => {
  const m = b.match(/(\d+):(\d\d):(\d\d\.\d+)\s*-->\s*(\d+):(\d\d):(\d\d\.\d+)/);
  if (!m) return null;
  const t0 = +m[1] * 3600 + +m[2] * 60 + +m[3], t1 = +m[4] * 3600 + +m[5] * 60 + +m[6];
  return [t0, t1, decode(b.slice(b.indexOf(m[0]) + m[0].length).trim().split('\n').map(l => l.trim()).filter(Boolean).join(' ').replace(/<[^>]+>/g, ''))];
}).filter(Boolean);
const clockOf = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const lenOf = sec => { sec = Math.round(sec); const m = Math.floor(sec / 60), s = sec % 60; return m ? (s ? `${m} min ${s} s` : `${m} min`) : `${s} s`; };
const segs = [];
for (const [, u] of units) for (const s of u.films || []) segs.push(Object.assign({}, s, { end: s.end == null ? B.films[s.film].duration : s.end, unit: u.id }));
for (const s of segs) {
  const F = B.films[s.film], cues = parseVtt(F.vtt);
  const i = html.indexOf(`id="${s.id}"`), blk = i < 0 ? '' : html.slice(html.lastIndexOf('<figure', i), html.indexOf('</figure>', i));
  const tag = (blk.match(/^<figure[^>]*>/) || [''])[0];
  check(!/class="[^"]*\bsheet\b/.test(tag), `${s.id}: a film block, not a sheet (no tutor button)`);
  check(new RegExp(`data-question="[^"]{12,}"`).test(tag), `${s.id}: the poster has its one-line question`);
  check(/class="film-before"[\s\S]*?Before you watch[\s\S]*?<p>[^<]{40,}/.test(blk), `${s.id}: a "Before you watch" question`);
  // folded away until the reader opens it, since it starts with the answer to the question before the film
  check(/<details class="film-after"><summary>After you watch[^<]*<\/summary><p>[\s\S]{80,}?<\/p><\/details>/.test(blk), `${s.id}: an "After you watch" note, folded in a <details>`);
  check(blk.includes(`data-gen="film-len">${lenOf(s.end - s.start)} · captions<`), `${s.id}: shows the segment's length, ${lenOf(s.end - s.start)}`);
  check(/<video[^>]*preload="none"/.test(blk) && /<track kind="captions"/.test(blk), `${s.id}: preload="none", with captions`);
  // the cut: at a pause in the narration, and a cut before the file's end has narration after it
  const straddles = b => cues.some(([a, z]) => a < b - 0.01 && z > b + 0.01);
  check(!(s.start > 0 && straddles(s.start)) && !(s.end < F.duration - 0.01 && straddles(s.end)), `${s.id}: its cuts (${s.start}–${s.end.toFixed(2)} s) fall between spoken lines`);
  if (s.end < F.duration - 0.01) check(cues.some(c => c[0] >= s.end), `${s.id}: something is spoken after its end at ${s.end} s, so the cut leaves it out`);
  // chapter marks
  const marks = [...blk.matchAll(/<li><button type="button" data-t="([\d.]+)">([^<]*)<\/button>/g)].map(m => [+m[1], m[2]]);
  check(marks.length >= 4 && marks.length <= 8, `${s.id}: ${marks.length} chapter marks (4–8)`);
  const badMarks = marks.filter(([t, l]) => !(t >= s.start && t < s.end) || l !== clockOf(t) || !cues.some(c => Math.abs(c[0] - t) <= 1.5));
  check(!badMarks.length, `${s.id}: every mark sits inside the segment, at a spoken line, labelled with its time` + (badMarks.length ? ': ' + badMarks.map(m => m.join(' ')).join(', ') : ''));
  check(marks.every((m, k) => !k || m[0] > marks[k - 1][0]), `${s.id}: the marks run in order`);
  // the transcript: every cue inside the segment, in order, and nothing from outside it
  const paras = [...blk.matchAll(/<p><button type="button" class="tr-t" data-t="([\d.]+)"[^>]*>([^<]*)<\/button> ([^<]*)<\/p>/g)].map(m => [+m[1], m[2], decode(m[3])]);
  const inside = cues.filter(c => c[0] >= s.start - 0.05 && c[0] < s.end);
  const want = inside.map(c => c[2]).join(' '), got = paras.map(p => p[2]).join(' ');
  check(paras.length > 3 && got === want, `${s.id}: the transcript holds all ${inside.length} cues of the segment in ${paras.length} paragraphs, and nothing else`);
  check(paras.every(([t, l], k) => t >= s.start - 0.11 && t < s.end && l === clockOf(t) && (!k || t > paras[k - 1][0])), `${s.id}: each paragraph is stamped with a time inside the segment, in order`);
  check(paras.every(p => p[2].length <= 900), `${s.id}: no paragraph runs past 900 characters (longest ${Math.max(...paras.map(p => p[2].length))})`);
  // the end card: a segment that stops early either continues elsewhere or says what it leaves out
  const D = data.films[s.id];
  const next = segs.find(o => o !== s && o.film === s.film && o.start >= s.end - 0.5);
  if (s.end < F.duration - 0.01) check(!!next || (D && /<a href="#[\w-]+">/.test(D.tail || '')), `${s.id}: stops ${lenOf(F.duration - s.end)} early, and its end card says ` + (next ? `where it continues (${next.id})` : 'what the rest holds'));
  else check(!(D && D.tail), `${s.id}: plays to the end, so it has no tail note`);
}
{
  const list = (html.match(/<ol class="toc-film-list">([\s\S]*?)<\/ol>/) || [, ''])[1];
  const rows = [...list.matchAll(/<li>[\s\S]*?<span class="tf-t">([^<]*)<\/span>[\s\S]*?<span class="tf-l">([^<]*)<\/span><\/li>/g)].map(m => [decode(m[1]), m[2]]);
  const films = Object.values(B.films);
  const total = films.reduce((a, F) => a + F.duration, 0);
  check(rows.length === films.length && films.every(F => rows.some(([t, l]) => t === (F.safeTitle || F.title) && l === lenOf(F.duration))), `the Contents lists all ${films.length} films with their running times`);
  check(new RegExp(`films, ${Math.round(total / 60)} minutes in all`).test(html) && Math.round(total / 60) === 58, `the Contents gives the films' total: ${Math.round(total / 60)} minutes (${total.toFixed(1)} s)`);
}

// ---------------------------------------------------------------- scripts
console.log('\nScripts');
// string literals in a script, comments left out
function strings(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2) + 2; if (i < 2) break; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') { s += src[j + 1]; j += 2; continue; } if (c !== '`' && src[j] === '\n') break; s += src[j++]; }
      out.push(s); i = j + 1; continue;
    }
    if (c === '/' && /[=(,:;!&|?{}\[\n]\s*$/.test(src.slice(Math.max(0, i - 12), i))) { // a regex literal: skip it
      let j = i + 1;
      while (j < src.length && src[j] !== '/' && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
      i = j + 1; continue;
    }
    i++;
  }
  return out;
}
const scripts = fs.readdirSync(SRC).filter(f => /^app-.*\.js$/.test(f)).map(f => [f, fs.readFileSync(path.join(SRC, f), 'utf8')]);
if (fs.existsSync(path.join(SRC, 'fig'))) for (const f of fs.readdirSync(path.join(SRC, 'fig')).filter(f => /\.js$/.test(f))) scripts.push(['fig/' + f, fs.readFileSync(path.join(SRC, 'fig', f), 'utf8')]);
const TYPED = /\b(Fig|Figs|Example|Eq|Film|Table)\.? ?\d|\bStep \d|\bChapter \d/;
for (const [f, src] of scripts) {
  const hits = strings(src).filter(s => TYPED.test(s));
  check(!hits.length, `${f}: no typed figure, film, step or chapter number in a string` + (hits.length ? ': ' + hits.map(s => JSON.stringify(s.slice(0, 60))).join(', ') : ''));
  const refs = [...src.matchAll(/\bref\('([^']+)'/g)].map(m => m[1]).filter(id => !data.refs[id]);
  check(!refs.length, `${f}: every ref('…') names a numbered target` + (refs.length ? ': ' + refs.join(', ') : ''));
}

// ---------------------------------------------------------------- Set the figure (book/SPEC.md F.6)
console.log('\nSet the figure');
{
  const ST = require(path.join(SRC, 'stability-solver.js'));
  const btns = [...html.matchAll(/<button\b[^>]*class="[^"]*\bset-fig\b[^"]*"[^>]*>/g)].map(m => m[0]);
  const problems = [];
  for (const b of btns) {
    const raw = (b.match(/data-set='([^']*)'/) || b.match(/data-set="([^"]*)"/) || [])[1];
    let spec;
    try { spec = JSON.parse(decode(raw || '')); } catch (e) { problems.push('bad JSON: ' + raw); continue; }
    if (!idSet.has(spec.fig) || !/^fig-/.test(spec.fig)) { problems.push(`no figure #${spec.fig}`); continue; }
    for (const [ctl, v] of Object.entries(spec.set || {})) {
      const tag = (html.match(new RegExp(`<input[^>]*id="${ctl}"[^>]*>`)) || [])[0];
      if (tag) {
        const at = a => { const m = tag.match(new RegExp(`\\b${a}="([^"]*)"`)); return m ? +m[1] : null; };
        const min = at('min'), max = at('max'), step = at('step') || 1;
        if (!(+v >= min && +v <= max) || Math.abs(Math.round((+v - min) / step) * step + min - +v) > 1e-9) problems.push(`#${ctl} = ${v} is off its slider (${min}–${max}, step ${step})`);
      } else if (ctl === 'zn-tabs') { if (!['0', '1', '2', '3'].includes(String(v))) problems.push(`zn-tabs has no tab ${v}`); }
      else if (ctl === 'bd-presets') { if (!ST.BUILD.presets[v]) problems.push(`bd-presets has no preset ${v}`); }
      else if (ctl === 'bd-palette') { if (!(+v >= 0 && +v < ST.BUILD.materials.length && Number.isInteger(+v))) problems.push(`bd-palette has no material ${v}`); }
      else {
        const box = html.match(new RegExp(`id="${ctl}"[^>]*>([\\s\\S]*?)</div>`));
        const esc = String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!box || !new RegExp(`(?:data-v|data-i|data-m|data-p|data-exp)="${esc}"`).test(box[1])) problems.push(`#${ctl} has no button for "${v}"`);
      }
    }
  }
  check(!problems.length, `all ${btns.length} Set-the-figure buttons name real controls and legal values` + (problems.length ? ': ' + problems.join('; ') : ''));
}

// ---------------------------------------------------------------- what the reader must not see
console.log('\nPlaceholders and the Polley guard');
const visible = plainText(html);
const stubs = visible.match(/\bTODO\b|\bTBD\b|\bFIXME\b|lorem ipsum|\[placeholder\]|data-stub/gi);
check(!stubs, 'no placeholder text on the page' + (stubs ? ': ' + stubs.join(', ') : ''));
check(!/data-stub/.test(html), 'no element marked data-stub reaches the page');
{
  const before = html.slice(0, pos('ch-build'));
  const WORDS = /\b(layer|layers|clay|foundation|undrained|glacial|lacustrine|glaciolacustrine|GLU|seam|slid|slide|sliding|borehole)\b/i;
  const blocks = [...before.matchAll(/<(p|li|tr|dd|dt|figcaption|h2|h3|h4|blockquote|summary)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(m => plainText(m[2]));
  const leaks = blocks.filter(t => /Polley/.test(t) && WORDS.test(t));
  check(!leaks.length, 'nothing before Chapter 13 names Mount Polley next to its cause' + (leaks.length ? ': ' + leaks.map(t => t.slice(0, 80)).join(' | ') : ''));
  check(!/glaciolacustrine|glacial[- ]lake clay|\bGLU\b|layer nobody found/i.test(plainText(before)), 'no glaciolacustrine clay, and the last film only by its safe title, before Chapter 13');
  // scripts: a string that names Polley must not give the cause away (app-build's missions run inside Chapter 13 and are exempt)
  const js = scripts.filter(([f]) => f !== 'app-build.js').flatMap(([f, src]) => strings(src).filter(s => /Polley/.test(s) && WORDS.test(s)).map(s => f + ': ' + s.slice(0, 70)));
  check(!js.length, 'no script string outside the workbench gives Mount Polley\'s cause away' + (js.length ? ': ' + js.join(' | ') : ''));
}

// ---------------------------------------------------------------- the build refuses broken books
console.log('\nLayout and furniture (book/SPEC.md F)');
{
  // the running section: one symbol per layer in the page's defs, each opener stacked to its chapter's layer
  const mini = B.mini.map(m => m.n);
  check(mini.every(n => new RegExp(`<symbol id="mini-L${n}"`).test(html)), `the running section has a symbol for each of its ${mini.length} layers`);
  const chapters = B.parts.flatMap(p => p.chapters);
  const bad = [];
  for (const c of [B.prologue, ...chapters, B.epilogue]) {
    const sec = (html.match(new RegExp(`<section class="[^"]*" id="${c.id}"[\\s\\S]*?</header>`)) || [])[0];
    if (!sec) continue; // a unit still marked data-stub
    const m = sec.match(/<svg class="mini"[^>]*data-mini="(\d+)">([\s\S]*?)<\/svg>/);
    if (!m) { bad.push(c.id + ': no miniature'); continue; }
    const uses = [...m[2].matchAll(/href="#mini-L(\d+)"/g)].map(u => +u[1]).sort((a, b) => a - b);
    if (+m[1] !== c.mini || uses.join() !== [...Array(c.mini + 1).keys()].join()) bad.push(`${c.id}: miniature shows layers ${uses.join(',')}, book.json says 0–${c.mini}`);
    if (c.n && !new RegExp(`<p class="ch-num" aria-hidden="true">${c.n}</p>`).test(sec)) bad.push(`${c.id}: no chapter numeral ${c.n}`);
  }
  check(!bad.length, 'every opener has its numeral and the running section at its own layer' + (bad.length ? ': ' + bad.join('; ') : ''));
  check(/<header class="runhead" id="runhead">/.test(html) && /id="rh-toc" href="#contents"/.test(html) && !/class="indexbar"/.test(html), 'the running head replaces the old index bar; its Contents link works without JavaScript');
  const instruments = ['fig-grains', 'fig-raise', 'fig-zones', 'fig-lab', 'fig-uplift', 'fig-build'];
  check(instruments.every(id => new RegExp(`<figure class="[^"]*\\bfull\\b[^"]*"[^>]*id="${id}"`).test(html)), 'the six big instruments are full-width plates');
  // every section heading in a chapter has an id, so it is numbered and can be linked
  const h3 = [];
  for (const c of chapters) {
    const body = (html.match(new RegExp(`<section class="chapter" id="${c.id}"[\\s\\S]*?(?=<section class="(?:chapter|part-opener|epilogue|back)")`)) || [''])[0];
    for (const m of body.matchAll(/<h3(\s[^>]*)?>/g)) if (!/\bid="s-[a-z0-9-]+"/.test(m[1] || '') && !/<figure/.test(body.slice(Math.max(0, m.index - 4000), m.index).split('</figure>').pop())) h3.push(c.id + ': ' + m[0]);
  }
  check(!h3.length, 'every chapter section heading has an id s-<slug>-<word>' + (h3.length ? ': ' + h3.join('; ') : ''));
  // notes: a label for the checkbox right after it, then the note; kinds as SPEC F.3 defines them
  const notes = [...html.matchAll(/<label\b([^>]*)><\/label>\s*<input type="checkbox" id="([^"]+)" class="margin-toggle">\s*<span class="(sidenote|marginnote)"([^>]*)>/g)];
  const marks = (html.match(/class="(?:sn-ref|mn-ref)"/g) || []).length;
  const nbad = notes.filter(m => {
    const lab = m[1], kind = (m[4].match(/data-kind="([^"]+)"/) || [])[1];
    const ok = new RegExp(`for="${m[2]}"`).test(lab) && (m[3] === 'sidenote' ? /\bsn-ref\b/.test(lab) && ['history', 'curious', 'units'].includes(kind) : /\bmn-ref\b/.test(lab) && ['source', 'units'].includes(kind));
    return !ok;
  }).map(m => m[2]);
  check(notes.length === marks && !nbad.length, `all ${marks} note marks are well formed (label, checkbox, note of a known kind)` + (nbad.length || notes.length !== marks ? ': ' + (nbad.join(', ') || (marks - notes.length) + ' unmatched') : ''));
  const notesOff = [...html.matchAll(/<span class="(?:sidenote|marginnote)"[^>]*>([\s\S]*?)<\/span>(?![^<]*<\/span>)/g)].filter(m => /<(p|div|ul|ol|figure)\b/.test(m[1]));
  check(!notesOff.length, 'notes hold inline markup only');
  // italics at every weight, so the title's bold italic is real, not synthesized
  const page = fs.readFileSync(path.join(book().out, 'docs', 'index.html'), 'utf8');
  check(/Source\+Serif\+4:ital,opsz,wght@0,8\.\.60,400\.\.700;1,8\.\.60,400\.\.700/.test(page), 'Source Serif 4 italics load at 400–700');
  // both pages run in standards mode: in quirks mode ids match case-insensitively, and #dp-h finds #dp-H
  const rootPage = fs.readFileSync(path.join(book().out, 'index.html'), 'utf8');
  check(/^<!doctype html>/i.test(page) && /^<!doctype html>/i.test(rootPage), 'docs/index.html and the root index.html both start with <!doctype html>');
  // the shipped page carries no source comments, and stays inside its weight budget
  const gz = require('zlib').gzipSync(page).length;
  check(!/<!--/.test(page.replace(/<script[\s\S]*?<\/script>/g, '')) && !/\/\*/.test((page.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1]), 'no HTML or CSS comments are shipped to readers');
  check(gz < 450 * 1024, `docs/index.html is ${(gz / 1024).toFixed(0)} kB gzipped, under the 450 kB budget (${(page.length / 1024).toFixed(0)} kB raw)`);
  // every SVG path in the markup is well formed: each command has a whole number of argument sets
  // (Chrome stops drawing a path at the first bad number and logs an error)
  const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  const badPaths = [];
  for (const m of html.matchAll(/<path\b[^>]*?\sd="([^"]*)"/g)) {
    const d = m[1].trim();
    if (!d) continue;
    const parts = d.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    const bad = !/^[mM]/.test(d) || /[^mlhvcsqtazMLHVCSQTAZ0-9eE.,+\-\s]/.test(d) || parts.some(p => {
      const k = ARITY[p[0].toLowerCase()], n = (p.slice(1).match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []).length;
      return k === undefined || (k === 0 ? n !== 0 : n === 0 || n % k !== 0);
    });
    if (bad) badPaths.push(d.slice(0, 60));
  }
  check(!badPaths.length, 'every <path d> in the markup is well formed' + (badPaths.length ? ': ' + badPaths.join(' | ') : ''));
  check(/<meta name="description"/.test(page) && /<meta name="theme-color"/.test(page), 'the page has a description and a theme colour');
}

console.log('\nThe build refuses');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dams-bad-'));
  try {
    fs.cpSync(path.join(ROOT, 'src'), path.join(tmp, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'docs', 'video'), { recursive: true });
    for (const f of fs.readdirSync(path.join(ROOT, 'docs', 'video')).filter(f => /\.vtt$/.test(f))) fs.copyFileSync(path.join(ROOT, 'docs', 'video', f), path.join(tmp, 'docs', 'video', f));
    const tryBuild = (file, from, to) => {
      const p = path.join(tmp, 'src', 'book', file), orig = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p, orig.replace(from, to));
      let out = '';
      try {
        execFileSync('python3', ['-c', `import sys; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'tools'))}); import bookbuild; r, e, w = bookbuild.assemble(${JSON.stringify(tmp)}); print('\\n'.join(e)); sys.exit(1 if e else 0)`], { encoding: 'utf8' });
      } catch (e) { out = String(e.stdout || ''); }
      fs.writeFileSync(p, orig);
      return out;
    };
    const a = tryBuild('ch01-beach.html', 'The slope a dry heap settles at', 'See <a data-ref="fig-nowhere"></a>. The slope a dry heap settles at');
    check(/no element #fig-nowhere/.test(a), 'a reference to an id that does not exist');
    const b = tryBuild('ch02-depth.html', '<div class="col">', '<div class="col"><p id="fig-beach">x</p>');
    check(/duplicate id "fig-beach"/.test(b), 'a duplicate id');
    const c = tryBuild('ch03-head.html', 'Water in the ground is rarely still.', 'As Fig. 2.1 shows, water in the ground is rarely still.');
    check(/typed number "Fig\. 2"/.test(c), 'a typed figure number in the prose');
    const d = tryBuild('ch04-grip.html', 'Friction comes from pressing', 'Step 3: friction comes from pressing');
    check(/chapters, not steps/.test(d), 'a "Step" in a chapter file');
    const e = tryBuild('ch06-two-dams.html', 'It was not a liquefaction of the tailings.', 'It slid on a clay layer in its foundation.');
    check(/Polley guard/.test(e), 'Mount Polley\'s cause before Chapter 13');
    const f = tryBuild('ch04-grip.html', 'Friction comes from pressing</h3>', 'Friction comes from pressing</h3><p>Grains grip.<label for="mn-grip-t" class="mn-ref"></label><input type="checkbox" id="mn-grip-t" class="margin-toggle"><span class="marginnote" data-kind="source">Horn and Deere (1962), Table 2.</span> Wet or dry, Table 2 says.</p>');
    check(/typed number "Table 2" in "Wet or dry/.test(f) && !/Horn and Deere/.test(f), 'a typed number in the prose, but not a source\'s own table cited in a Source note');
    const g = tryBuild('ch02-depth.html', '<button type="button" data-t="160.8">2:40</button>', '<button type="button" data-t="200.0">3:20</button>');
    check(/chapter mark at 200\.0 s is outside its segment/.test(g), 'a film\'s chapter mark outside its segment');
    const h = tryBuild('ch02-depth.html', '<button type="button" data-t="100.3">1:40</button>', '<button type="button" data-t="98">1:38</button>');
    check(/chapter mark at 98 s is not at a spoken line/.test(h), 'a film\'s chapter mark that is not at a spoken line');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

console.log(`\n${fails ? fails + ' check(s) FAILED' : 'all ' + passes + ' checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fails ? 1 : 0);
