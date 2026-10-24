/* The front matter's own number keys (book/SPEC.md E): Plate 0's dam, the toolkit's answers and
 * How to read this book. Plate 0 draws "our dam", the section the seepage lab and the workbench share,
 * so its dimensions come from the stability solver's geometry and the seepage solver's grid. */
'use strict';
const fs = require('fs'), path = require('path');
const geom = X => X.ST.buildRequest({ cells: new Uint8Array(1), slope: 2, foundation: 'clay' }).stab.geom;
const BOOK = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'book.json'), 'utf8'));

module.exports = {
  // ---- Plate 0: our dam
  'front.dam-h-m': { doc: 'height of our dam, crest above the original ground, m', f: (a, X) => geom(X).crestZ },
  'front.crest-w-m': { doc: 'width of its crest, m', f: (a, X) => geom(X).crestX1 - geom(X).crestX0 },
  'front.base-m': { doc: 'heel to toe, m', f: (a, X) => geom(X).downToeX - geom(X).upToeX },
  'front.slope-up': { doc: 'upstream face, horizontal per vertical', f: (a, X) => (geom(X).crestX0 - geom(X).upToeX) / geom(X).crestZ },
  'front.slope-down': { doc: 'downstream face, horizontal per vertical', f: (a, X) => geom(X).downSlope },
  'front.freeboard-m': { doc: 'crest above the reservoir in the seepage lab on load, m', f: (a, X) => geom(X).crestZ - X.seep({}).Hw },
  'front.found-m': { doc: 'depth of foundation the seepage model includes, m', f: (a, X) => -X.seep({}).z0 },
  'front.face-m': { doc: 'height on the downstream face where the phreatic surface comes out, m', f: (a, X) => X.seep({}).seepageFace.topZ },
  'front.area-m2': { doc: 'area of the section: two triangles and a rectangle, m² per metre of dam', f: (a, X) => { const g = geom(X); return 0.5 * (g.crestX0 - g.upToeX) * g.crestZ + (g.crestX1 - g.crestX0) * g.crestZ + 0.5 * (g.downToeX - g.crestX1) * g.crestZ; } },
  'front.area-tri-m2': { doc: 'area of one sloping triangle of the section, m²', f: (a, X) => { const g = geom(X); return 0.5 * (g.crestX0 - g.upToeX) * g.crestZ; } },
  'front.area-rect-m2': { doc: 'area of the rectangle under the crest, m²', f: (a, X) => { const g = geom(X); return (g.crestX1 - g.crestX0) * g.crestZ; } },
  'front.tri-run-m': { doc: 'horizontal run of one face, m', f: (a, X) => { const g = geom(X); return g.crestX0 - g.upToeX; } },

  // ---- the toolkit
  'front.k-ratio': { doc: 'rockfill ÷ clay permeability in the workbench', f: (a, X) => {
    const m = k => X.ST.BUILD.materials.find(v => v.key === k).k; return m('rock') / m('clay'); } },
  'front.k-rock': { doc: 'the workbench rockfill’s permeability, m/s', f: (a, X) => X.ST.BUILD.materials.find(v => v.key === 'rock').k },
  'front.k-clay': { doc: 'the workbench clay’s permeability, m/s', f: (a, X) => X.ST.BUILD.materials.find(v => v.key === 'clay').k },
  'front.tan-slope2': { doc: 'tangent of a 2H:1V face', f: (a, X) => 1 / geom(X).downSlope },
  'front.tan-slope2-deg': { doc: 'angle of a 2H:1V face, degrees', f: (a, X) => Math.atan(1 / geom(X).downSlope) / X.deg },
  'front.weight-100kg-kn': { doc: 'weight of 100 kg, kN, with the book’s g', f: (a, X) => 100 * X.G.COL.GW / 1000 },
  'front.weight-100kg-n': { doc: 'weight of 100 kg, N', f: (a, X) => 100 * X.G.COL.GW },
  'front.g': { doc: 'gravity the book uses, m/s² (γw ÷ 1 t/m³)', f: (a, X) => X.G.COL.GW },
  'front.log-mid': { doc: 'the point halfway between 10⁻⁶ and 10⁻⁴ on a log axis', f: () => Math.sqrt(1e-6 * 1e-4) },
  'front.k-sand': { doc: 'k from Darcy’s pipe on load: flow per m² ÷ gradient, m/s', f: (a, X) => {
    const r = X.G.darcyReadouts(Object.assign({}, X.G.DARCY0, { mat: 'sand', plug: false, hl: 2, hr: 0.6, L: 2 })); return r.q / r.i; } },
  'front.sand-gaps-pct': { doc: 'the gap fraction of sand in the race, %', f: (a, X) => 100 * X.G.MATS.sand.n },

  // ---- How to read this book
  'front.films-min': { doc: 'running time of all the films, minutes', f: () => Object.values(BOOK().films).reduce((s, v) => s + v.duration, 0) / 60 }
};
