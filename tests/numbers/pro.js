/* The Prologue's own number keys (book/SPEC.md E). Literature numbers carry Source notes; the only
 * arithmetic the Prologue does on them is the illustrative "spread a metre deep" area, from the Chief
 * Inspector of Mines' (2015, p. 13) range of 21 to 25 million m³ released. */
'use strict';
const VOL_LO_M3 = 21e6, VOL_HI_M3 = 25e6; // Chief Inspector of Mines (2015), p. 13
const DEPTH_M = 1;                         // illustrative: spread one metre deep
const FS_PERIMETER = 1.7;                  // Review Panel (2015), p. 64: the calculated factor of safety
// Fig. P.1 (wide drawing), traced from the panel's Fig. 5.4.9(b), p. 70: the answers to its two Try items,
// measured on the drawing in its own units. The scale bar is 69 units for 20 m.
const P1 = { scale: 69 / 20, heel: [222.1, 162.9], toe: [489.1, 166.7], crestDown: [300.1, 31.8] };

module.exports = {
  'pro.spread-km2': { args: { v: 'lo' }, doc: 'area the release would cover one metre deep, km²', f: a => (a.v === 'hi' ? VOL_HI_M3 : VOL_LO_M3) / DEPTH_M / 1e6 },
  'pro.base-m': { doc: 'Fig. P.1: the embankment along the original ground, from its upstream edge to the toe, m', f: () => (P1.toe[0] - P1.heel[0]) / P1.scale },
  'pro.ds-slope': { doc: 'Fig. P.1: the downstream face, crest edge to toe, as across ÷ up', f: () => (P1.toe[0] - P1.crestDown[0]) / (P1.toe[1] - P1.crestDown[1]) },
  'pro.fs-spare-pct': { doc: 'strength to spare at a factor of safety of 1.7, %', f: () => 100 * (FS_PERIMETER - 1) }
};
