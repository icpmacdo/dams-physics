/* The Prologue's own number keys (book/SPEC.md E). Literature numbers carry Source notes; the only
 * arithmetic the Prologue does on them is the illustrative "spread a metre deep" area, from the Chief
 * Inspector of Mines' (2015, p. 13) range of 21 to 25 million m³ released. */
'use strict';
const VOL_LO_M3 = 21e6, VOL_HI_M3 = 25e6; // Chief Inspector of Mines (2015), p. 13
const DEPTH_M = 1;                         // illustrative: spread one metre deep
const FS_PERIMETER = 1.7;                  // Review Panel (2015), p. 64: the calculated factor of safety

module.exports = {
  'pro.spread-km2': { args: { v: 'lo' }, doc: 'area the release would cover one metre deep, km²', f: a => (a.v === 'hi' ? VOL_HI_M3 : VOL_LO_M3) / DEPTH_M / 1e6 },
  'pro.fs-spare-pct': { doc: 'strength to spare at a factor of safety of 1.7, %', f: () => 100 * (FS_PERIMETER - 1) }
};
