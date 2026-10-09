/* Checks the guided chapter (src/chapter.html and src/chapter/*.html) for broken wiring:
 * - every page has a unique id and a heading
 * - every figure a page asks for exists, and every #id its slot names is in that figure
 * - every link inside the chapter lands on a page or on something in one
 * - every term defined with <dfn data-term> is in the glossary, once; every glossary term is defined
 * - nothing is hidden behind a hover or a guess: no .gl terms and no .predict boxes
 * - every question ends its page and the next page opens with the answer */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
let passes = 0, fails = 0;
function check(name, ok, detail) {
  if (ok) passes++; else fails++;
  if (!ok || process.env.VERBOSE) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
}
const read = n => fs.readFileSync(path.join(SRC, n), 'utf8');
const expand = t => { for (let i = 0; i < 4; i++) t = t.replace(/<!-- @include ([\w./-]+) -->/g, (m, n) => (fs.existsSync(path.join(SRC, n)) ? read(n) : '')); return t; };
const html = expand(read('chapter.html'));
const book = html.slice(html.indexOf('<main class="book"'), html.indexOf('</main>'));

// pages
const pages = [...book.matchAll(/<section class="pg([^"]*)" id="([\w-]+)"[^>]*>([\s\S]*?)<\/section>/g)].map(m => ({ cls: m[1], id: m[2], body: m[3] }));
const ids = new Set();
pages.forEach(p => {
  check(`page ${p.id}: unique id`, !ids.has(p.id)); ids.add(p.id);
  check(`page ${p.id}: has a heading`, /<h2[\s>]/.test(p.body));
  check(`page ${p.id}: at most one figure`, (p.body.match(/class="figslot"|<figure /g) || []).length <= 1);
});
const content = pages.filter(p => !/pg-(front|back)/.test(p.cls));
check('the chapter has between 40 and 50 numbered pages', content.length >= 40 && content.length <= 50, content.length + ' pages');

// figures and the ids each slot names
const figs = {};
fs.readdirSync(path.join(SRC, 'figs')).filter(f => /^fig-.*\.html$/.test(f)).forEach(f => { figs[f.replace('.html', '')] = read('figs/' + f); });
const GENERATED = { 'fig-zones': ['zn-tabs'], 'fig-build': ['bd-tabs', 'bd-presets'] }; // buttons made by script inside these
pages.forEach(p => {
  for (const m of p.body.matchAll(/<div class="figslot"([^>]*)>/g)) {
    const a = {}; for (const kv of m[1].matchAll(/data-([\w-]+)="([^"]*)"/g)) a[kv[1]] = kv[2];
    const f = figs[a.fig];
    check(`page ${p.id}: figure ${a.fig} exists`, !!f);
    if (!f) continue;
    check(`page ${p.id}: ${a.fig} is in the figure store`, html.includes(`@include figs/${a.fig}.html`) || html.includes(`id="${a.fig}"`));
    const named = [a.do, a.show, a.hide].join(' ').match(/#[\w-]+/g) || [];
    named.forEach(id => check(`page ${p.id}: ${id} is in ${a.fig}`, f.includes(`id="${id.slice(1)}"`) || (GENERATED[a.fig] || []).includes(id.slice(1))));
    (a.do || '').split(';').map(s => s.trim()).filter(Boolean).forEach(s => {
      const seg = s.match(/^#([\w-]+)\/([\w.-]+)$/);
      if (seg) {
        const block = f.slice(f.indexOf(`id="${seg[1]}"`), f.indexOf('</div>', f.indexOf(`id="${seg[1]}"`)));
        check(`page ${p.id}: ${seg[1]} has a button for ${seg[2]}`, block.includes(`data-v="${seg[2]}"`));
      }
    });
  }
});

// links
const allIds = new Set([...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
for (const m of book.matchAll(/href="#([\w-]*)"/g)) {
  if (!m[1]) continue;
  check(`link #${m[1]} lands somewhere`, ids.has(m[1]) || allIds.has(m[1]));
}
for (const m of book.matchAll(/<a class="pgref" href="#([\w-]+)">/g)) check(`page reference #${m[1]} names a numbered page`, content.some(p => p.id === m[1]));

// glossary
const gsrc = read('app-glossary.js');
const terms = new Set([...gsrc.slice(gsrc.indexOf('const GLOSSARY'), gsrc.indexOf('};')).matchAll(/^\s*'([\w-]+)':/gm)].map(m => m[1]));
const defined = [...book.matchAll(/<dfn data-term="([\w-]+)">/g)].map(m => m[1]);
const seen = new Set();
defined.forEach(t => {
  check(`term ${t} is in the glossary`, terms.has(t));
  check(`term ${t} is defined once`, !seen.has(t)); seen.add(t);
});
terms.forEach(t => check(`glossary term ${t} is defined in the chapter`, seen.has(t)));

// nothing hidden
check('no hover-only terms (.gl) in the chapter', !/class="gl"/.test(book));
check('no hidden-answer boxes (.predict) in the chapter', !/class="predict/.test(book));

// questions and answers
pages.forEach((p, i) => {
  if (!p.body.includes('class="question"')) return;
  const after = p.body.slice(p.body.indexOf('class="question"'));
  check(`page ${p.id}: the question is the last thing on the page`, !/<(p|div)[^>]*>/.test(after.slice(after.lastIndexOf('</div>'))) && !/class="figslot"/.test(after));
  const next = pages[i + 1];
  check(`page ${p.id}: the next page opens with the answer`, !!next && /^\s*<h2[^>]*>[^<]*<\/h2>\s*<div class="answer">/.test(next.body));
});

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
