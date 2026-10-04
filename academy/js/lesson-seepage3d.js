// The core interactive lesson, written as predict -> try -> explain steps.
//
// Step fields
//   scene        model state applied when the step opens (params, mode, layers, view, labels)
//   predict      question answered before the experiment (exactly one option is correct)
//   controls     inline controls shown in the step: design keys, 'reservoir', 'mode', 'view', 'layers'
//   instruments  readouts shown next to the controls, with change from the step's starting state
//   task         what to do on the model; checked live. Doing it reveals `explain`.
//                `nudge` names the near miss when the learner does something close to the task.
//   explain      HTML, or a function of { challenge } returning HTML
//   followUp     optional extra experiment shown after the explanation (does not gate progress)
//   notes        teacher notes (shown from the lesson menu)
//
// The quantitative claims in the text are checked against the solver in tests/test-academy.js.

export const DEFAULT_CHALLENGE = { foundation: 'pervious', reservoir: 0.85, maxQ: 50, minFS: 3, noSeepageFace: true };

const fmtQ = v => (v >= 100 ? Math.round(v).toLocaleString('en') : v.toFixed(1));

export function challengeMet(c, sum) {
  const fails = [];
  if (!(sum.qTotal <= c.maxQ)) fails.push(`seepage ${fmtQ(sum.qTotal)} > ${c.maxQ} L/day per m`);
  if (!(sum.fs >= c.minFS)) fails.push(`exit safety factor ${sum.fs.toFixed(2)} < ${c.minFS}`);
  if (c.noSeepageFace && sum.seepageFace) fails.push('water breaks out on the downstream slope');
  return { ok: fails.length === 0, fails };
}

const base = { damType: 'homogeneous', drain: 'none', cutoff: 'none', foundation: 'tight', reservoir: 0.85 };
const allOn = { phreatic: true, particles: true, labels: true };

export const SEEPAGE_3D = {
  id: 'seepage-3d',
  title: 'Seepage in 3D',
  steps: [
    {
      id: 'orient', title: 'The model',
      body: `<p>A 24 m embankment holds back a reservoir. The model is cut at right angles to the crest, so the cut face shows the dam's cross-section.</p>
<p>Everything on the <strong>cut face</strong> is computed, not drawn. A seepage solver works out how water moves through the dam and the ground beneath it, and recomputes whenever you change the design.</p>`,
      scene: {
        params: base, view: 'iso', mode: 'materials', layers: { phreatic: false, particles: false, labels: true },
        labels: [
          { text: 'Reservoir', at: [-66, 22, 'cut'] },
          { text: 'Crest · 24 m', at: [0, 25.5, 'cut'] },
          { text: 'Cut face', at: [-30, 6, 'cut'] },
          { text: 'Foundation', at: [70, -6, 'cut'] }
        ]
      },
      controls: ['view'],
      task: { text: 'Drag the model to orbit it, or pick a camera view.', check: c => c.interacted || c.viewChanged },
      explain: `<p>The dam is 102 m wide at the base, with 2H:1V slopes. Every result in this lesson is read off the cut face.</p>`,
      notes: 'Ask the class which side the water is on before anyone touches the model. Point out the cut face: everything on it is computed, not drawn.'
    },
    {
      id: 'read', title: 'Read the cut face',
      body: `<p>Total head is the level water would rise to in a standpipe pushed into the soil at that point. Water flows from high total head to low.</p>`,
      scene: { params: base, view: 'section', mode: 'materials', layers: { phreatic: false, particles: false, labels: false } },
      controls: ['mode'],
      task: { text: 'Colour the cut face by total head.', check: c => c.mode === 'head', nudge: c => (c.mode === 'pressure' ? 'That is pressure head. Pick Total head.' : null) },
      explain: `<ul class="keylist">
  <li><span class="key k-eq"></span><span><strong>Dashed lines</strong> join points of equal total head, every 10% of the reservoir head.</span></li>
  <li><span class="key k-flow"></span><span><strong>Orange lines</strong> are flow lines. They cross the dashed lines at right angles.</span></li>
  <li><span class="key k-phr"></span><span><strong>The blue line</strong> marks the phreatic surface, the top of the saturated zone.</span></li>
</ul>
<p>Try <em>Pressure head</em> too: above the phreatic surface the pore water is in suction.</p>`,
      notes: 'Flow lines cross equipotentials at right angles in isotropic soil. Ask why the equipotentials crowd together near the downstream toe.'
    },
    {
      id: 'phreatic', title: 'Where the water comes out',
      body: `<p>Below the phreatic surface the soil is saturated. This dam has no drain, so the water in it has to find its own way out.</p>`,
      scene: { params: base, view: 'iso', mode: 'head', layers: { phreatic: false, particles: false, labels: false } },
      predict: {
        q: 'Where does the phreatic surface reach the air?',
        options: [
          { t: 'It stays inside the dam and drains down into the foundation' },
          { t: 'On the downstream slope, a few metres above the toe', correct: true },
          { t: 'At the crest' }
        ]
      },
      controls: ['layers'],
      instruments: ['sf', 'split'],
      task: { text: 'Turn on the phreatic surface.', check: c => c.layers.phreatic },
      explain: `<p>The surface breaks out on the downstream slope, about 8 m up. That wet strip (red) is a <strong>seepage face</strong>. About two-thirds of the flow leaves there; the water softens the slope and can make it slough.</p>`,
      followUp: { text: 'Turn on flow particles and watch where the water goes.', check: c => c.layers.particles },
      notes: 'The seepage face is a one-way boundary: water can leave, but nothing flows back in. The solver finds its extent as part of the solution.'
    },
    {
      id: 'reservoir', title: 'Fill the reservoir',
      body: `<p>The reservoir is at 60% of the dam height. Over a wet season it rises toward the crest.</p>`,
      scene: { params: Object.assign({}, base, { reservoir: 0.6 }), view: 'iso', mode: 'head', layers: allOn },
      predict: {
        q: 'Raise the water from 60% to 95% of the dam height. What happens to the seepage?',
        options: [
          { t: 'About the same, since the dam has not changed' },
          { t: 'Up about 60%, in step with the water depth' },
          { t: 'More than double', correct: true }
        ]
      },
      controls: ['reservoir'],
      instruments: ['q', 'sf'],
      task: { text: 'Raise the reservoir to 95%.', check: c => c.params.reservoir >= 0.945, nudge: c => (c.tried.reservoir && c.params.reservoir < 0.945 ? 'Drag the slider to 95%.' : null) },
      explain: `<p>The water is only about 60% deeper, but the seepage more than doubles. Two things grow at once: the head driving the flow, and the height of saturated soil it flows through. For a homogeneous dam on tight rock, seepage rises roughly with the <em>square</em> of the head. The seepage face climbs the slope too.</p>`,
      notes: 'Square-law growth with head is the Dupuit result for a homogeneous embankment on an impervious base, visible here in a full saturated–unsaturated solution.'
    },
    {
      id: 'drain', title: 'Add a drain',
      body: `<p>A <strong>chimney drain</strong> is a band of clean sand and gravel inside the downstream half, joined to a blanket drain along the base. Water reaching it runs out freely.</p>`,
      scene: { params: base, view: 'iso', mode: 'head', layers: allOn },
      predict: {
        q: 'Fit a chimney drain. What happens to the total seepage through the dam?',
        options: [
          { t: 'It falls, because the drain intercepts the water' },
          { t: 'It rises', correct: true },
          { t: 'It stays the same' }
        ]
      },
      controls: ['drain'],
      instruments: ['q', 'sf', 'fs'],
      task: { text: 'Fit a chimney drain.', check: c => c.params.drain === 'chimney', nudge: c => (c.params.drain === 'toe' ? 'That is a toe drain. Pick Chimney.' : null) },
      explain: `<p>Seepage goes <em>up</em>, more than doubling. The drain sits at atmospheric pressure, so water heading for it has a shorter, steeper path. The drain controls where the water goes: the phreatic surface dives into the chimney, the seepage face disappears and the downstream slope stays dry.</p>`,
      followUp: { text: 'Compare it with a toe drain.', check: c => c.tried.drain && c.tried.drain.has('toe') },
      notes: 'Take a show of hands before anyone fits the drain. Here the drain more than doubles the seepage in exchange for control of the phreatic surface. Water collected by a filtered drain carries no soil with it.'
    },
    {
      id: 'foundation', title: 'Under the dam',
      body: `<p>So far the dam has stood on tight rock. Many dams stand on river sand and gravel instead, about a hundred times more permeable than the fill.</p>`,
      scene: { params: base, view: 'iso', mode: 'head', layers: allOn },
      predict: {
        q: 'Swap the tight rock for sand and gravel. By roughly how much does the seepage change?',
        options: [
          { t: 'Hardly at all, since the dam is unchanged' },
          { t: 'About double' },
          { t: 'About fifty times', correct: true }
        ]
      },
      controls: ['foundation'],
      instruments: ['q', 'split', 'fs'],
      task: { text: 'Switch the foundation to sand and gravel.', check: c => c.params.foundation === 'pervious' },
      explain: `<p>Seepage jumps more than fiftyfold, and nearly all of it now goes <em>under</em> the dam and comes up beyond the toe. The steepest exit gradient, at the toe, reaches about 0.8 against a critical value of 1.0, and the exit safety factor drops to about 1.3.</p>`,
      notes: 'This is seepage path 2 in Dams in Section: under the dam through sand and gravel, rising beyond the toe, where it can boil sand.'
    },
    {
      id: 'cutoff', title: 'Cut it off',
      body: `<p>A <strong>cutoff</strong> is a low-permeability wall under the dam: a clay-filled trench, slurry wall or grout curtain. The partial cutoff here reaches half-way down the 15 m of sand and gravel.</p>`,
      scene: { params: Object.assign({}, base, { foundation: 'pervious' }), view: 'section', mode: 'head', layers: allOn },
      predict: {
        q: 'Add a partial cutoff. How much does it reduce the seepage?',
        options: [
          { t: 'About half' },
          { t: 'Less than 10%', correct: true },
          { t: 'About 90%' }
        ]
      },
      controls: ['cutoff'],
      instruments: ['q', 'fs'],
      task: { text: 'Add a partial cutoff.', check: c => c.params.cutoff === 'partial', nudge: c => (c.params.cutoff === 'full' ? 'That is a full cutoff. Pick Partial first.' : null) },
      explain: `<p>The water flows under the bottom of the wall, through the sand and gravel below it. A cutoff only works when it reaches tight material.</p>`,
      followUp: { text: 'Now try a full cutoff.', check: c => c.params.cutoff === 'full' },
      notes: 'Real cutoffs leak through joints and windows. The model treats a full cutoff as continuous, which is the best case.'
    },
    {
      id: 'challenge', title: 'Design challenge', challenge: true,
      body: `<p>The foundation and reservoir level are fixed. Choose the dam section, drain and cutoff.</p>`,
      scene: { params: { damType: 'homogeneous', drain: 'none', cutoff: 'none' }, view: 'iso', mode: 'head', layers: allOn },
      controls: ['damType', 'drain', 'cutoff'],
      instruments: ['q', 'fs', 'sf'],
      task: { text: 'Meet every target in the brief.', check: c => challengeMet(c.challenge, c.sum).ok },
      explain: ({ challenge }) => (challenge.foundation === 'pervious'
        ? `<p>On sand and gravel the foundation carries most of the seepage, so the cutoff has to reach tight material, and the clay core keeps the dam itself tight. Would you fit a filtered drain even where the numbers do not need one?</p>`
        : `<p>Would you fit a filtered drain even where the numbers do not need one?</p>`),
      notes: 'For the default brief (sand and gravel, 85%, at most 50 L/day per m, exit safety factor at least 3, no seepage face), a clay core with a full cutoff passes with any drain, at about 2 L/day per m. A homogeneous dam cannot pass: even with a full cutoff it leaks about 170 L/day per m.'
    },
    {
      id: 'check', title: 'Quiz',
      scene: { layers: allOn },
      quiz: [
        { q: 'Adding a chimney drain to the homogeneous dam made the total seepage…',
          options: ['Fall, because the drain blocked flow', 'Rise, because water heading for the drain has a shorter, steeper path', 'Stay the same'], answer: 1,
          explain: 'Drains increase seepage but take control of it. The phreatic surface is pulled down and the downstream slope stays dry.' },
        { q: 'On a sand-and-gravel foundation, why did a partial cutoff do so little?',
          options: ['The cutoff material was too permeable', 'Water flowed under the bottom of the wall through the sand and gravel below it', 'The reservoir was too high'], answer: 1,
          explain: 'The wall is only a short detour; the sand and gravel below it still carries almost all the flow.' },
        { q: 'The exit gradient is 0.5 and the critical gradient is 1.0. What is the exit safety factor, and is it enough at an unfiltered exit?',
          options: ['0.5, failing', '2.0, below the usual target of about 3', '2.0, comfortably safe'], answer: 1,
          explain: 'Exit safety factor = i_c / i_exit = 1.0 / 0.5 = 2.0. Designers usually want 3 or more at an unfiltered exit, so add a filter, a berm or a cutoff.' },
        { q: 'What is a seepage face?',
          options: ['The upstream slope below the water line', 'Where the phreatic surface meets the downstream slope and water leaks out', 'The face of the cutoff wall'], answer: 1,
          explain: 'It forms when nothing intercepts the phreatic surface before it reaches the downstream slope.' },
        { q: 'The model shows the same seepage section all along the valley floor. Why?',
          options: ['The solver is 2D: it computes flow per metre of dam, which holds away from the abutments', 'Seepage never varies along a dam', 'It is a rendering shortcut with no physical basis'], answer: 0,
          explain: 'This is the plane-flow assumption, standard for long dams. Flow around the abutments is three-dimensional and is not modelled here.' }
      ],
      notes: 'There is no built-in pass mark. The report records the score and every answer.'
    },
    {
      id: 'wrap', title: 'Summary', summary: true,
      scene: { layers: allOn },
      body: `<ul class="recap">
  <li><strong>Water flows from high to low total head.</strong> Equipotentials and flow lines make a flow net; the phreatic surface is the top of the saturated zone.</li>
  <li><strong>Seepage outpaces the water level.</strong> For a homogeneous dam it grows roughly with the square of the head.</li>
  <li><strong>A drain raises the seepage and keeps the slope dry.</strong> The chimney drain more than doubled the flow and removed the seepage face.</li>
  <li><strong>The foundation can dominate.</strong> Sand and gravel can carry fifty times the flow of the dam itself.</li>
  <li><strong>Cutoffs must be complete.</strong> A partial cutoff cuts the seepage by less than 10%.</li>
</ul>`,
      notes: 'Have students download their report and hand it in. You can tabulate a batch of reports on the Teach page.'
    }
  ]
};
