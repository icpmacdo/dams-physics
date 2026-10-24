// Foster, Fell & Spannagle (2000), Table 3: 124 failures to 1986; piping 46.9%, overtopping 34.2%,
// with spillways and gates 48.4%. The post-1950 column (54.2% against 40.7%) doesn't say whether it
// counts dams built or failures since 1950, so the page leaves it out.
// USBR DS-13 ch. 8 §8.2.2.2: these are factors of safety against heave at an exit (2.0–2.5 may do with
// good data), "not a factor of safety against the initiation of internal erosion".
module.exports = {
  says: [
    ['about as many failures as overtopping: 47% against 48% once spillway and gate failures are counted with overtopping', 'piping, Foster et al.'],
    ['That is more than overtopping alone (34%). Some failures', 'piping, Foster et al.'],
    ['at least 3 at an unfiltered exit of an existing dam, and 4 for a new dam or a repair, or about 2 to 2.5 where the soil and the water pressures are well measured', 'heave formula (USBR DS-13 ch. 8)'],
    ['It flags sand boils, not every kind of internal erosion', 'heave formula'],
    ['Schematic · hours to decades compressed', 'fig-pipe scale note']
  ],
  never: [
    ['since 1950 internal erosion has led', 'piping, Foster et al.'],
    ['nearly half of the failures whose cause was known', 'piping, Foster et al.'],
    ['3 or more', 'heave formula and the Pipes card']
  ]
};
