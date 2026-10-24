/* Checks the book as a book (book/SPEC.md sections D, E, G.4 and I):
 *   - every <span data-n="key"> shows exactly what the code computes, at the precision shown
 *     (definitions in tests/numbers/*.js), and the figure keys still give Appendix 4's values;
 *   - no dangling reference, no duplicate id, no internal link to a missing id;
 *   - every unit in src/book.json is on the page, in order; every old #anchor and every old id
 *     still lands where it should;
 *   - every film segment sits inside its file (durations from book.json against the VTT captions);
 *   - no typed figure or chapter number in a script string, and every ref('…') names a real target;
 *   - every "Set the figure" button names controls and values that exist;
 *   - no visible placeholder text; nothing before Chapter 13 gives Mount Polley's cause away;
 *   - the build refuses a dangling reference, a duplicate id and a typed number.
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
      else {
        const box = html.match(new RegExp(`id="${ctl}"[^>]*>([\\s\\S]*?)</div>`));
        const attr = ctl === 'bd-tabs' ? 'data-m' : 'data-v';
        if (!box || !new RegExp(`${attr}="${String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(box[1])) problems.push(`#${ctl} has no ${attr}="${v}"`);
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
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

console.log(`\n${fails ? fails + ' check(s) FAILED' : 'all ' + passes + ' checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fails ? 1 : 0);
