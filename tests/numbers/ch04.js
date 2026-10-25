/* Chapter 4's own number keys (book/SPEC.md E). The block and the column come from fig-block's and
 * fig-column's pure blocks in app-ground.js (BLOCK, blockForces, COL, columnReadouts); the beach face
 * uses the unit weights fig-beach holds (G_SAT, G_W) and its 34°. The grain values in the critical-
 * gradient example (Gs, e) are illustrative typical values for quartz sand, named here and called
 * "typical" in the prose; they are the ones Chapter 11 uses. */
'use strict';
const PHI = X => X.G.BLOCK.PHI;                       // 34°, in radians, as the block holds it
const TAN = X => Math.tan(PHI(X));                    // tan 34°
const GS = 2.65, E = 0.65;                            // grains' specific gravity, void ratio: illustrative
const deg = (X, t) => Math.atan(t) / X.deg;
const gprime = X => X.G.G_SAT - X.G.G_W;              // buoyant unit weight of the soaked sand, kN/m³
const gratio = X => gprime(X) / X.G.G_SAT;            // γ′/γsat
const col = (X, wt) => X.G.columnReadouts(+wt);
const ang = (X, b) => b === 'drain' ? Math.atan(X.G.beachShapes(240, 241, 2).tanDrain) : +b * X.deg;
const dryE = X => X.G.COL.GD * X.G.COL.ZB;            // σ′ at 10 m with the water table below the column

module.exports = {
  // ---- trigonometry the block's lines print (ex-grip-block)
  'ch04.cos': { doc: 'cos of an angle in degrees', args: { a: 25 }, f: ({ a }, X) => Math.cos(+a * X.deg) },
  'ch04.sin': { doc: 'sin of an angle in degrees', args: { a: 25 }, f: ({ a }, X) => Math.sin(+a * X.deg) },
  'ch04.tan': { doc: 'tan of an angle in degrees', args: { a: 25 }, f: ({ a }, X) => Math.tan(+a * X.deg) },
  // ---- the block (ex-grip-block, questions)
  'ch04.fs-dry': { doc: 'dry block: FS = tan 34° ÷ tan a', args: { a: 25 }, f: ({ a }, X) => TAN(X) / Math.tan(+a * X.deg) },
  'ch04.ne-slide-kn': { doc: 'press left over at which the block slides: pull ÷ tan 34°, kN', args: { a: 25 }, f: ({ a }, X) => X.G.blockForces(+a, 0).Fn / TAN(X) },
  'ch04.slide-frac': { doc: 'share of the press the water must carry to slide the block (block.slide-pct ÷ 100)', args: { a: 25 }, f: ({ a }, X) => { const f = X.G.blockForces(+a, 0); return (f.N - f.Fn / TAN(X)) / f.N; } },
  'ch04.shortcut-pct': { doc: '1 − tan a ÷ tan 34°, in percent: the same share by the shortcut', args: { a: 25 }, f: ({ a }, X) => 100 * (1 - Math.tan(+a * X.deg) / TAN(X)) },
  'ch04.shortcut-frac': { doc: '1 − tan a ÷ tan 34°', args: { a: 25 }, f: ({ a }, X) => 1 - Math.tan(+a * X.deg) / TAN(X) },
  'ch04.fs-at': { doc: 'the block’s FS at ramp a with cushion pressure u, as fig-block computes it', args: { a: 25, u: 0 }, f: ({ a, u }, X) => X.G.blockForces(+a, +u).fs },
  // ---- the column (ex-grip-column, check, questions)
  'ch04.dry-e-kpa': { doc: 'σ′ at 10 m with the water table below the column: 18 × 10, kPa', f: (a, X) => dryE(X) },
  'ch04.flood-left-frac': { doc: 'flooded σ′ ÷ the dry column’s σ′ at 10 m', f: (a, X) => col(X, 0).eB / dryE(X) },
  'ch04.flood-loss-pct': { doc: 'share of the dry column’s σ′ at 10 m lost when flooded to the surface, %', f: (a, X) => 100 * (1 - col(X, 0).eB / dryE(X)) },
  'ch04.soaked-m': { doc: 'metres of the column below a water table wt metres down', args: { wt: 4 }, f: ({ wt }, X) => X.G.COL.ZB - +wt },
  'ch04.damp-kpa': { doc: 'weight of the damp sand above a water table wt metres down, kPa', args: { wt: 4 }, f: ({ wt }, X) => X.G.COL.GD * +wt },
  'ch04.soaked-kpa': { doc: 'weight of the soaked sand below it, kPa', args: { wt: 4 }, f: ({ wt }, X) => X.G.COL.GS * (X.G.COL.ZB - +wt) },
  'ch04.lake-kpa': { doc: 'pressure of d metres of still water, kPa (γw × d)', args: { d: 3 }, f: ({ d }, X) => X.G.COL.GW * +d },
  'ch04.u-depth-m': { doc: 'depth of water above the column’s foot with d metres of lake on top', args: { d: 3 }, f: ({ d }, X) => X.G.COL.ZB + +d },
  // ---- the strength line (ex-grip-envelope, fig-grip-envelope)
  'ch04.tau-kpa': { doc: 'strength τ = σ′ tan 34° at the column’s foot, water table wt m down (wt=dry: below the column), kPa', args: { wt: 4 },
    f: ({ wt }, X) => (wt === 'dry' ? dryE(X) : col(X, wt).eB) * TAN(X) },
  // ---- the critical gradient (ex-grip-ic, questions)
  'ch04.ic': { doc: 'critical gradient from the stress column’s unit weights: (γsat − γw) ÷ γw', f: (a, X) => (X.G.COL.GS - X.G.COL.GW) / X.G.COL.GW },
  'ch04.gs': { doc: 'specific gravity of quartz grains, illustrative', f: () => GS },
  'ch04.e': { doc: 'void ratio of a typical medium-dense sand, illustrative', f: () => E },
  'ch04.gs-e': { doc: 'Gs + e', f: () => GS + E },
  'ch04.gs-1': { doc: 'Gs − 1', f: () => GS - 1 },
  'ch04.one-e': { doc: '1 + e', f: () => 1 + E },
  'ch04.gsat-ge': { doc: 'saturated unit weight from Gs and e: (Gs + e) ÷ (1 + e) × γw, kN/m³', f: (a, X) => (GS + E) / (1 + E) * X.G.COL.GW },
  'ch04.ic-ge': { doc: 'critical gradient from Gs and e: (Gs − 1) ÷ (1 + e)', f: () => (GS - 1) / (1 + E) },
  'ch04.drag-kn': { doc: 'upward drag of water flowing up at gradient i, kN per m³ (i × γw)', args: { i: 0.6 }, f: ({ i }, X) => +i * X.G.COL.GW },
  'ch04.up-left-kn': { doc: 'what is left of the soaked sand’s buoyant weight with water flowing up at gradient i, kN per m³', args: { i: 0.6 }, f: ({ i }, X) => (X.G.COL.GS - X.G.COL.GW) - +i * X.G.COL.GW },
  'ch04.up-left-frac': { doc: 'that as a fraction of the buoyant weight', args: { i: 0.6 }, f: ({ i }, X) => 1 - +i * X.G.COL.GW / (X.G.COL.GS - X.G.COL.GW) },
  'ch04.up-left-pct': { doc: 'that as a share of the buoyant weight, %', args: { i: 0.6 }, f: ({ i }, X) => 100 * (1 - +i * X.G.COL.GW / (X.G.COL.GS - X.G.COL.GW)) },
  // ---- the beach face (ex-grip-face, fig-grip-face, questions)
  'ch04.gratio': { doc: 'γ′ ÷ γsat for fig-beach’s soaked sand', f: (a, X) => gratio(X) },
  'ch04.face-loss-deg': { doc: 'degrees the seeping face loses against the dry 34°', f: (a, X) => PHI(X) / X.deg - deg(X, X.G.beachShapes(240, 241, 2).tanDrain) },
  'ch04.tan-face': { doc: 'tan of the steepest face with water seeping out parallel to it: (γ′/γsat) tan φ′; gsat in kN/m³', args: { phi: 34, gsat: 20 },
    f: ({ phi, gsat }, X) => (+gsat - X.G.G_W) / +gsat * Math.tan(+phi * X.deg) },
  'ch04.face-deg': { doc: 'steepest face of φ′ sand with water seeping out parallel to it, degrees', args: { phi: 34, gsat: 20 },
    f: ({ phi, gsat }, X) => deg(X, (+gsat - X.G.G_W) / +gsat * Math.tan(+phi * X.deg)) },
  'ch04.gratio-at': { doc: 'γ′ ÷ γsat for a soaked sand of unit weight gsat', args: { gsat: 20 }, f: ({ gsat }, X) => (+gsat - X.G.G_W) / +gsat },
  // forces on 1 m³ of the face at the draining face's angle (b=drain) or at b degrees
  'ch04.press-kn': { doc: 'press into the face of 1 m³ of soaked sand, kN (γ′ cos b)', args: { b: 'drain' }, f: ({ b }, X) => gprime(X) * Math.cos(ang(X, b)) },
  'ch04.fric-kn': { doc: 'friction that press makes, kN (γ′ cos b tan 34°)', args: { b: 'drain' }, f: ({ b }, X) => gprime(X) * Math.cos(ang(X, b)) * TAN(X) },
  'ch04.pull-kn': { doc: 'pull down the face of 1 m³ of soaked sand in water, kN (γ′ sin b)', args: { b: 'drain' }, f: ({ b }, X) => gprime(X) * Math.sin(ang(X, b)) },
  'ch04.seep-drag-kn': { doc: 'drag of water seeping parallel to the face, kN per m³ (γw sin b)', args: { b: 'drain' }, f: ({ b }, X) => X.G.G_W * Math.sin(ang(X, b)) },
  'ch04.drag-share-pct': { doc: 'the seeping water’s share of the pull down the face: γw ÷ γsat, %', f: (a, X) => 100 * X.G.G_W / X.G.G_SAT }
};
