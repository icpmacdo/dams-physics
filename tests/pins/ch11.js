// Foster, Fell & Spannagle (2000), Table 3: 124 failures to 1986; piping 46.9%, overtopping 34.2%,
// with spillways and gates 48.4%. The post-1950 column (54.2% against 40.7%) doesn't say whether it
// counts dams built or failures since 1950, so the page leaves it out.
// USBR DS-13 ch. 8 §8.2.2.2: these are factors of safety against heave at an exit (2.0–2.5 may do with
// good data), "not a factor of safety against the initiation of internal erosion".
// Teton's toll: eleven in the Bureau of Reclamation's count (Stene 1996, p. 1), fourteen associated with
// the failure "directly or indirectly" by the review panel (p. 1-1).
// A graded filter's effective opening is about 0.11 × D15 (FEMA 2011, pp. 275–276), not a fifth; the
// filter holds the core because its coarse grains bridge the filter's openings, not because every pore
// is smaller than every grain. (The old wordings are quoted on the Errata page, so they are not pinned
// as `never` here; the `says` pins hold the corrected ones.)
module.exports = {
  says: [
    ['about as many failures as overtopping: 47% against 48% once spillway and gate failures are counted with overtopping', 'piping, Foster et al.'],
    ['That is more than overtopping alone (34%). Some failures', 'piping, Foster et al.'],
    ['at least 3 at an unfiltered exit of an existing dam, and 4 for a new dam or a repair, or about 2 to 2.5 where the soil and the water pressures are well measured', 'heave margin (USBR DS-13 ch. 8)'],
    ['flags sand boils, not every kind of internal erosion', 'heave margin'],
    ['is not a factor of safety against the initiation of internal erosion', 'heave margin, the standard\'s own words'],
    ['Schematic · hours to decades compressed', 'fig-pipe scale note'],
    ['Eleven people died in the flood, by the count of the Bureau of Reclamation', 'Teton toll (Stene 1996)'],
    ['associated fourteen deaths with it, directly or indirectly', 'Teton toll (review panel)'],
    ['acts like a sieve whose openings are about 0.11 times its 15% size', 'filter opening (FEMA 2011)'],
    ['those stop at the face, and the finer grains pile up behind them', 'fig-filter caption: the grains bridge'],
    ['so the two come out about level', 'the film\'s overtopping line, set straight']
  ],
  never: [
    ['since 1950 internal erosion has led', 'piping, Foster et al.'],
    ['nearly half of the failures whose cause was known', 'piping, Foster et al.'],
    ['3 or more', 'heave margin and the Pipes card']
  ]
};
