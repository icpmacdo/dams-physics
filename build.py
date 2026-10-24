#!/usr/bin/env python3
"""Assemble the page from src/.

- docs/index.html        standalone page (open it directly, or serve it with GitHub Pages)
- index.html             body-only version used for the claude.ai artifact (git-ignored)
- app.bundle.js          the combined script, for `node --check` (git-ignored)
- build/book.html        the assembled, numbered body markup, for the tests (git-ignored)
- build/book-data.json   the data block the page's scripts read, for the tests (git-ignored)

The book is assembled from src/book.json and src/book/*.html by tools/bookbuild.py (see
book/SPEC.md section A.2): src/body.html is the shell, and its <!-- @book --> line becomes the
front matter, the Prologue, the parts and chapters, the Epilogue and the back matter, numbered
and cross-referenced. Every error is reported at once and nothing is written if there is one.

OUT=/some/dir python3 build.py builds into another directory (parallel work).
DRAFT=1 python3 build.py lets references to ids a unit has planned (newIds) but not written yet
build as "?", with a warning.
"""
import json, os, pathlib, re, sys
root = pathlib.Path(__file__).parent
sys.path.insert(0, str(root / 'tools'))
import bookbuild  # noqa: E402

out = pathlib.Path(os.environ.get('OUT', root))  # OUT=/some/dir builds elsewhere (parallel work)
draft = os.environ.get('DRAFT', '') not in ('', '0')
src = root / 'src'
def read(n):
    f = src / n
    return f.read_text() if f.exists() else ''
fig = sorted((src / 'fig').glob('*.js')) if (src / 'fig').is_dir() else []
figcss = sorted((src / 'fig').glob('*.css')) if (src / 'fig').is_dir() else []
CSS = ['styles.css', 'styles-ground.css', 'styles-grains.css', 'styles-build.css', 'styles-tutor.css', 'styles-book.css'] + ['fig/' + p.name for p in figcss]
APP = (['app-core.js', 'app-glossary.js', 'app-ground.js', 'app-grains.js', 'app-zones.js', 'app-seep.js', 'app-build.js']
       + ['fig/' + p.name for p in fig] + ['app-book.js', 'app-tutor.js', 'app-film.js'])
WORKERS = [('seep-src', 'seepage-solver.js'), ('stab-src', 'stability-solver.js')]
fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400..700;1,400'
         '&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&display=swap">')

res, errors, warnings = bookbuild.assemble(root, draft)
for w in warnings:
    print('warning:', w, file=sys.stderr)
if errors:
    for e in errors:
        print('error:', e, file=sys.stderr)
    print('build failed: %d error(s); nothing written' % len(errors), file=sys.stderr)
    sys.exit(1)
markup, data = res

app = "(() => {\n'use strict';\n" + ''.join(read(n) for n in APP) + "\n})();\n"


def strip_css_comments(css):
    """/* … */ out of the shipped CSS (strings are left alone); the sources keep them"""
    out, i, n = [], 0, len(css)
    while i < n:
        c = css[i]
        if c in '"\'':
            j = i + 1
            while j < n and css[j] != c:
                j += 2 if css[j] == '\\' else 1
            out.append(css[i:j + 1]); i = j + 1
        elif css.startswith('/*', i):
            j = css.find('*/', i + 2)
            i = n if j < 0 else j + 2
        else:
            out.append(c); i += 1
    return re.sub(r'\n\s*\n+', '\n', ''.join(out))


def strip_html_comments(html):
    """<!-- … --> out of the shipped markup (none of them is read at run time); build/book.html keeps them"""
    return re.sub(r'<!--(?!\[).*?-->', '', html, flags=re.S)

data_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
body = (
    '<title>Dams in Section</title>\n' + fonts + '\n<style>\n' + strip_css_comments('\n'.join(read(n) for n in CSS)) + '\n</style>\n'
    + strip_html_comments(markup)
    + '\n<script id="book-data" type="application/json">' + data_json.replace('</', '<\\/') + '</script>\n'
    + ''.join(f'\n<script id="{i}">\n{read(n)}\n</script>\n' for i, n in WORKERS if read(n))
    + '<script>\n' + app + '</script>\n'
)
(out / 'build').mkdir(parents=True, exist_ok=True)
(out / 'build' / 'book.html').write_text(markup)
(out / 'build' / 'book-data.json').write_text(json.dumps(data, ensure_ascii=False, indent=1))
# the root page is the body only (the claude.ai artifact wraps it in a document), but opened on its own it
# must not fall into quirks mode, where ids match case-insensitively and #dp-h finds #dp-H
(out / 'index.html').write_text('<!doctype html>\n' + body)
(out / 'app.bundle.js').write_text(app)
data_desc = (json.loads((src / 'book.json').read_text()).get('subtitle', '') + '. An interactive book on how dams stand and fail, with simulations you can run in the page.').replace('"', '&quot;')
preview = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
           '<meta name="description" content="' + data_desc + '">'
           '<meta name="theme-color" content="#f6f1e7" media="(prefers-color-scheme: light)">'
           '<meta name="theme-color" content="#1b1714" media="(prefers-color-scheme: dark)">'
           '<style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>'
           '</head><body>\n' + body + '</body></html>')
(out / 'docs').mkdir(parents=True, exist_ok=True)
(out / 'docs' / 'index.html').write_text(preview)
print('index.html', len(body), 'bytes')

# ---- Dams Academy (academy/ -> docs/academy/): the multi-page teaching site.
# Static files copied as they are, plus the shared solver and the shared colour tokens.
import shutil
css = read('styles.css')
tokens = css[:css.index('* { box-sizing')].split('*/', 1)[1].strip()  # drop the layout comment
acad_src, acad_out = root / 'academy', out / 'docs' / 'academy'
if acad_out.exists():
    shutil.rmtree(acad_out)
shutil.copytree(acad_src, acad_out)
shutil.copy(src / 'seepage-solver.js', acad_out / 'js' / 'seepage-solver.js')
out_css = acad_out / 'styles.css'
out_css.write_text(out_css.read_text().replace('/* @tokens */', tokens))
(out / 'docs' / '.nojekyll').write_text('')  # GitHub Pages: serve docs/ as-is, no Jekyll pass
print('docs/academy/', sum(p.stat().st_size for p in acad_out.rglob('*') if p.is_file()), 'bytes')
