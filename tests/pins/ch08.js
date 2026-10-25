// Coquitlam: the backup dam was completed in 2007 and BC Hydro declared the C$65M upgrade complete in Oct 2008
// (Renewable Energy World, 16 Oct 2008; BC Hydro release, 3 Oct 2008); the new dam is "mostly founded on dense
// glacial deposits" (Yan, Sy & Thavaraj, "Seismic Deformation Analyses of the New Coquitlam Dam", ASCE GSP 181, 2008,
// doi:10.1061/40975(318)180). Hydraulic fill: Water Power, 13 Feb 2001.
// Chile: DS 86/1970 (LeyChile idNorma 193450) applies to dams with people at a dangerous distance downstream (Art. 44)
// and lets sand be added only outward over the crest (Art. 30); DS 248 (signed 29 Dec 2006, Diario Oficial
// 11 Apr 2007; idNorma 259901), Art. 14(h): "Se prohíbe la utilización del método aguas arriba."
// Brazil: Lei 14.066 of 30 Sep 2020 adds Art. 2-A to Lei 12.334 (ban and definition; deadline 25 Feb 2022).
// Brumadinho (Feijão Dam I): 10 upstream raises over 37 years to 86 m, last raise 2013, deposition ceased July 2016
// (Robertson et al. 2019, pp. i and 16).
module.exports = {
  says: [
    ['Coquitlam Dam · 1913, backed up by a new dam in 2007', 'Coquitlam case'],
    ['The new dam was finished in 2007, and BC Hydro declared the whole seismic upgrade complete in 2008.', 'Coquitlam case'],
    ['barred in Chile since 1970, at first only where people live within reach downstream and under its 2007 rules everywhere', 'upstream column of the comparison table'],
    ['Schematic · vertical scale ×1.5 · beach and pond not to scale', 'fig-raise scale note (the 8% beach is schematic)'],
    ['real beaches slope about 1% where the slurry comes out and flatten toward the pond', 'fig-raise caption: the drawn beach is steeper than real ones'],
    ['Its last raise was built in 2013, and tailings stopped arriving in July 2016.', 'Brumadinho: raising had stopped years before'],
    ['which translates as "the use of the upstream method is prohibited', 'Chile DS 248 wording (Art. 14(h))'],
    ['Mount Polley, in British Columbia, was designed to be raised this way.', 'Polley clue (G.4): modified centreline, nothing more']
  ],
  never: [
    [' buttressed', 'Coquitlam case (sources call it a backup dam; Polley\'s "unbuttressed" slope is fine)'],
    ['In the other two, every raise rests on compacted', 'fig-raise caption']
  ]
};
