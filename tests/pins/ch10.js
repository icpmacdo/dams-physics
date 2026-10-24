module.exports = {
  says: [
    // fig-lab: flow lines are equal-flux only within each set
    ['Within each set, each neighbouring pair carries the same flow', 'seepage lab paragraph'],
    ['switch the foundation to Clay to see a face about 8 m high', 'fig-lab caption']
  ],
  never: [
    ['Flow lines are spaced so that each neighbouring pair carries the same flow, as in', 'seepage lab paragraph'],
    ['in orange', 'fig-lab caption (the seepage face is drawn in the brick-red accent)']
  ],
  markup: [
    [/id="svg-paths"[^>]*aria-label="[^"]*along four of the five paths[^"]*The fifth, around the ends of the dam through the abutments, is in the plan view beside it\./,
      'fig-paths section label names four of the five paths and points to the plan']
  ]
};
