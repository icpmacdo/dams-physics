/* Chapter 1's own number keys (book/SPEC.md E). The castle and heap come from fig-beach's pure block
 * (app-ground.js @fig-beach: beachShapes, 5 px per cm); slopes are plain trigonometry; the unit weight
 * of damp sand is an illustrative round number, named here and called "illustrative" in the prose. */
'use strict';
const beach = X => X.G.beachShapes(240, 241, 2);
const CM = 5;                       // the figure draws 5 px per cm
const G_DAMP = 18;                  // kN/m³, damp sand, illustrative
const deg = (X, t) => Math.atan(t) / X.deg;
const coneH = X => Math.sqrt(beach(X).A * beach(X).tan34) / CM;              // cm, the dry heap's height
const castleH = X => Math.max(...beach(X).PROF.damp) / CM;                    // cm
// the area is summed over upright strips 2 px (0.4 cm) wide, so the castle's width, as the area counts it, is its number of strips × 0.4 cm
const DX = 2;
const castleW = X => beach(X).PROF.damp.filter(h => h > 0).length * DX / CM;   // cm
const castleTop = X => Math.max(...beach(X).PROF.damp);
const notchW = X => beach(X).PROF.damp.filter(h => h > 0 && h < castleTop(X)).length / 2 * DX / CM; // cm, one notch
const notchD = X => (castleTop(X) - Math.min(...beach(X).PROF.damp.filter(h => h > 0))) / CM;         // cm

module.exports = {
  // ---- the castle and the dry heap (ex-beach-castle)
  'ch01.castle-w-cm': { doc: 'width of the damp castle in fig-beach, as its area counts it (strips × 0.4 cm)', f: (a, X) => castleW(X) },
  'ch01.notch-w-cm': { doc: 'width of one notch between the castle’s battlements, cm', f: (a, X) => notchW(X) },
  'ch01.notch-d-cm': { doc: 'depth of the notches between the battlements, cm', f: (a, X) => notchD(X) },
  'ch01.castle-h-cm': { doc: 'height of the damp castle in fig-beach', f: (a, X) => castleH(X) },
  'ch01.tan-repose': { doc: 'tan 34°, the dry heap’s slope as the code holds it', f: (a, X) => beach(X).tan34 },
  'ch01.a-tan-cm2': { doc: 'A·tan 34° for the castle’s section, cm²', f: (a, X) => beach(X).A / (CM * CM) * beach(X).tan34 },
  'ch01.cone-half-cm': { doc: 'half the dry heap’s base, H ÷ tan 34°', f: (a, X) => coneH(X) / beach(X).tan34 },
  'ch01.cone-area-cm2': { doc: 'check: ½ × base × height of the dry heap, cm²', f: (a, X) => 0.5 * (2 * coneH(X) / beach(X).tan34) * coneH(X) },
  'ch01.cone-h-ratio': { doc: 'dry heap height ÷ castle height', f: (a, X) => coneH(X) / castleH(X) },
  'ch01.cone-w-ratio': { doc: 'dry heap base ÷ castle width', f: (a, X) => (2 * coneH(X) / beach(X).tan34) / castleW(X) },
  'ch01.drain-h-cm': { doc: 'height of the heap with water draining out of its faces, same sand', f: (a, X) => Math.sqrt(beach(X).A * beach(X).tanDrain) / CM },
  // ---- slopes as numbers (ex-beach-slope, check yourself, questions)
  'ch01.tan-slope': { doc: 'tan β of an H:1 slope, 1 ÷ H', args: { h: 2 }, f: ({ h }) => 1 / +h },
  'ch01.slope-deg': { doc: 'angle of an H:1 slope, degrees', args: { h: 2 }, f: ({ h }, X) => deg(X, 1 / +h) },
  'ch01.repose-ratio': { doc: 'the dry heap’s 34° written as H:1', f: (a, X) => 1 / beach(X).tan34 },
  'ch01.drain-ratio': { doc: 'the draining face’s angle written as H:1', f: (a, X) => 1 / beach(X).tanDrain },
  'ch01.grade-deg': { doc: 'angle of a road grade given in percent', args: { pct: 10 }, f: ({ pct }, X) => deg(X, +pct / 100) },
  'ch01.funnel-tan': { doc: 'tan β of a heap h high on a base d across: 2h ÷ d', args: { h: 6, d: 18 }, f: ({ h, d }) => 2 * +h / +d },
  'ch01.funnel-deg': { doc: 'angle of that heap', args: { h: 6, d: 18 }, f: ({ h, d }, X) => deg(X, 2 * +h / +d) },
  // ---- the castle and the tower (q-beach-tower), illustrative unit weight
  'ch01.gamma-damp': { doc: 'unit weight of damp sand, kN/m³, illustrative', f: () => G_DAMP },
  'ch01.gamma-damp-t': { doc: 'tonnes whose weight is 18 kN (÷ 9.81, γw as the code holds it)', f: (a, X) => G_DAMP / X.G.G_W },
  'ch01.base-kpa': { doc: 'press at the foot of a damp-sand wall h metres tall, kN/m²', args: { h: 0.3 }, f: ({ h }) => G_DAMP * +h }
};
