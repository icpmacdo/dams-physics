module.exports = {
  says: [
    // fig-lab: flow lines are equal-flux only within each set
    ['Within each set, each neighbouring pair carries the same flow', 'seepage lab paragraph'],
    ['switch the foundation to Clay to see a face about 8 m high', 'fig-lab caption'],
    // the Polley clue (book/SPEC.md G.4), checked against the panel's section 4.3.3
    ["Mount Polley's seepage was not what failed it", 'Polley clue'],
    // the flow net counts only when every cell is square; the lab's lines are not a square net
    ['so compare line spacing only within a set', 'seepage lab paragraph: the two sets differ']
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
