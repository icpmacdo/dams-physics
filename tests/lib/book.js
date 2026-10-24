/* The built book, for the tests: runs `OUT=<tmp>/dams-book-<pid> python3 build.py` once per test
 * process and returns { html, data, out }: html is the assembled, numbered body markup (exactly what
 * goes inside the page) and data the #book-data block (refs, units, films, glossaryExtra).
 * plainText(html) is the page's text with tags dropped, the way the text pins read it. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let cache = null;

function book() {
  if (cache) return cache;
  const out = path.join(os.tmpdir(), 'dams-book-' + process.pid);
  fs.mkdirSync(out, { recursive: true });
  try {
    execFileSync('python3', [path.join(ROOT, 'build.py')], { cwd: ROOT, env: Object.assign({}, process.env, { OUT: out, DRAFT: '' }), stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    process.stderr.write(String(e.stderr || e.message));
    throw new Error('python3 build.py failed');
  }
  const html = fs.readFileSync(path.join(out, 'build', 'book.html'), 'utf8');
  const data = JSON.parse(fs.readFileSync(path.join(out, 'build', 'book-data.json'), 'utf8'));
  process.on('exit', () => { try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) { /* leave it */ } });
  cache = { html, data, out, root: ROOT };
  return cache;
}

const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, '\u00a0').replace(/&amp;/g, '&');
// a keyed number (<span data-n="…">1.45</span>) reads as its digits, so a pin can quote "FS 1.45 here"
function plainText(html) {
  return decode(html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ')
    .replace(/<span data-n="[^"]*"(?: data-n-sig="\d+")?>([^<]*)<\/span>/g, '$1')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
}

module.exports = { book, plainText, decode, ROOT };
