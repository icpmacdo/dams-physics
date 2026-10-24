/* Chapter 12's own number keys (book/SPEC.md E). The fixes offered in pr-build, as shares of the
 * homogeneous dam's section. */
'use strict';
module.exports = {
  'ch12.fill-25-pct': { doc: 'extra fill for a 2.5:1 downstream slope, % of the 2:1 section', f: (a, X) => 100 * (X.bench({ slope: 2.5 }).m.damCells / X.bench({}).m.damCells - 1) },
  'ch12.fill-3-pct': { doc: 'extra fill for a 3:1 downstream slope, % of the 2:1 section', f: (a, X) => 100 * (X.bench({ slope: 3 }).m.damCells / X.bench({}).m.damCells - 1) },
  'ch12.drain-pct': { doc: 'the drained preset’s filter sand, % of the section', f: (a, X) => {
    const r = X.bench({ preset: 'drained' }), s = r.seep; let n = 0;
    for (let i = 0; i < s.mat.length; i++) if (s.mat[i] >= 10 && X.ST.BUILD.materials[s.mat[i] - 10].key === 'filter') n++;
    return 100 * n / r.m.damCells; } }
};
