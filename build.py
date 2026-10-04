#!/usr/bin/env python3
"""Assemble the page from src/.

- docs/index.html  standalone page (open it directly, or serve it with GitHub Pages)
- index.html       body-only version used for the claude.ai artifact (git-ignored)
- app.bundle.js    the combined script, for `node --check` (git-ignored)
"""
import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
read = lambda n: (src / n).read_text()
fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800'
         '&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400&display=swap">')
app = "(() => {\n'use strict';\n" + read('app-core.js') + read('app-zones.js') + read('app-seep.js') + "\n})();\n"
body = (
    '<title>Dams in Section</title>\n' + fonts + '\n<style>\n' + read('styles.css') + '\n</style>\n'
    + read('body.html')
    + '\n<script id="seep-src">\n' + read('seepage-solver.js') + '\n</script>\n'
    + '<script>\n' + app + '</script>\n'
)
(root / 'index.html').write_text(body)
(root / 'app.bundle.js').write_text(app)
preview = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
           '<style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>'
           '</head><body>\n' + body + '</body></html>')
(root / 'docs').mkdir(exist_ok=True)
(root / 'docs' / 'index.html').write_text(preview)
print('index.html', len(body), 'bytes')

# ---- Dams Academy (academy/ -> docs/academy/): the multi-page teaching site.
# Static files copied as they are, plus the shared solver and the shared colour tokens.
import shutil
css = read('styles.css')
tokens = css[:css.index('* { box-sizing')].split('*/', 1)[1].strip()  # drop the layout comment
acad_src, acad_out = root / 'academy', root / 'docs' / 'academy'
if acad_out.exists():
    shutil.rmtree(acad_out)
shutil.copytree(acad_src, acad_out)
shutil.copy(src / 'seepage-solver.js', acad_out / 'js' / 'seepage-solver.js')
out_css = acad_out / 'styles.css'
out_css.write_text(out_css.read_text().replace('/* @tokens */', tokens))
(root / 'docs' / '.nojekyll').write_text('')  # GitHub Pages: serve docs/ as-is, no Jekyll pass
print('docs/academy/', sum(p.stat().st_size for p in acad_out.rglob('*') if p.is_file()), 'bytes')
