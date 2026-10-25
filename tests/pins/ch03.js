module.exports = {
  says: [
    ['from where its head is high to where it is low', 'head, not pressure'],
    ['So pressure alone does not decide where water goes', 'the still lake refutes flow from high pressure to low'],
    ['hundreds to thousands of times smaller than a grain of sand', 'clay flakes'],
    ['takes almost the whole drop in head, from the reservoir level down to the downstream side', 'the core takes the head'],
    ['Flow per m² q/A', 'fig-darcy readout: the flow through each m² is q/A, not the q of the formula'],
    ['as if it were dyed', 'fig-race follows a drop through soaked soil, not a wetting front'],
    ['pushes on the grains it passes, in the direction it flows', 'seepage force acts along the flow']
  ],
  never: [
    ['from where it is pushed hard to where it is pushed less', 'head, not pressure']
  ],
  markup: [
    [/id="svg-race"[^>]*aria-label="[^"]*already soaked[^"]*as if it were dyed/, 'fig-race description: a dyed drop through soaked soil, not a wetting front']
  ]
};
