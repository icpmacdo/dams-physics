// Course catalogue: the lessons in order, the quizzes for reading lessons, and the glossary.
// Reading lessons embed a sheet of Dams in Section (../index.html) and end with a short quiz.

export const CLASSIC = '../index.html';

const ORDER = ['types', 'zones', 'raising', 'seepage-paths', 'seepage-3d'];

export const LESSONS = {
  types: {
    id: 'types', kind: 'reading', title: 'Two dams, two jobs', mins: 10, sheet: 'Step 5', href: CLASSIC + '#types',
    summary: 'A hydroelectric dam stores water as energy. A tailings dam stores mine waste permanently. Both resist water pressure and seepage; their design lives and failure modes differ.',
    objectives: [
      'Estimate water pressure at depth with p = ρgh.',
      'Contrast how hydro and tailings dams are built, loaded and regulated.',
      'Explain why loose, saturated tailings can liquefy.'
    ],
    check: [
      { q: 'Roughly what is the water pressure at the foot of a 100 m deep reservoir?',
        options: ['About 0.1 MPa', 'About 1 MPa', 'About 10 MPa'], answer: 1,
        explain: 'p = ρgh ≈ 1000 × 9.81 × 100 ≈ 0.98 MPa, about 9.8 kPa per metre of depth.' },
      { q: 'Which statement about tailings dams is true?',
        options: ['They are built to full height before the impoundment fills', 'They are raised in stages for the life of the mine', 'They can be decommissioned and removed once the mine closes'], answer: 1,
        explain: 'Tailings arrive every day, so the dam grows with them, often for decades, and must stay stable in perpetuity after closure.' },
      { q: 'What makes loose, saturated tailings liquefy?',
        options: ['Sheared grains try to pack tighter, pore pressure rises and contact forces drop toward zero', 'Seepage washes the fine grains out', 'The grains crush under the weight above'], answer: 0,
        explain: 'Loose grains contract when sheared; the pore water cannot escape fast enough, so effective stress collapses and the deposit flows.' }
    ]
  },
  zones: {
    id: 'zones', kind: 'reading', title: 'Dam zones', mins: 12, sheet: 'Step 7', href: CLASSIC + '#zones',
    summary: 'Large embankments are zoned: tight in the middle, progressively coarser and freer-draining toward the faces. In most embankments the filter is the most important zone.',
    objectives: [
      'Name the job of each zone: hold water back, let water out without soil, or supply weight.',
      'Apply Terzaghi’s filter retention and permeability rules.',
      'Compare earth–rockfill, concrete-face, gravity and cycloned-sand sections.'
    ],
    check: [
      { q: 'What does a filter zone do?',
        options: ['Stops all water from passing', 'Lets water pass but stops soil grains from being carried out', 'Adds weight to the downstream slope'], answer: 1,
        explain: 'Its pores are smaller than the larger core grains, which lodge at the interface and hold back the finer grains behind them. Water still passes.' },
      { q: 'Terzaghi’s retention rule for a filter is…',
        options: ['D15 filter ≤ 4–5 × D85 soil', 'D85 filter ≥ 10 × D15 soil', 'D50 filter = D50 soil'], answer: 0,
        explain: 'Retention: D15(filter) ≤ 4–5 × D85(soil). Permeability: D15(filter) ≥ 4–5 × D15(soil).' },
      { q: 'Reading a zoned section from the centre outward, the materials get…',
        options: ['Finer and tighter', 'Coarser and more free-draining', 'Uniform throughout'], answer: 1,
        explain: 'A tight core in the middle, then filters and transitions, then rockfill shells and riprap at the faces.' }
    ]
  },
  raising: {
    id: 'raising', kind: 'reading', title: 'Upstream, downstream, centreline', mins: 12, sheet: 'Step 6', href: CLASSIC + '#raising',
    summary: 'The direction each raise moves gives the method its name, and decides what the raise is founded on.',
    objectives: [
      'Sketch the three raising methods from the same starter dam.',
      'Explain why upstream raises are vulnerable to liquefaction.',
      'Trade off fill volume, footprint and seismic performance.'
    ],
    check: [
      { q: 'In an upstream-raised tailings dam, each raise is founded on…',
        options: ['Compacted fill and natural ground', 'The tailings beach', 'Bedrock'], answer: 1,
        explain: 'The crest steps toward the pond, so each small dyke sits on loose, saturated tailings that can liquefy.' },
      { q: 'Which method needs the most fill?',
        options: ['Upstream', 'Centreline', 'Downstream'], answer: 2,
        explain: 'Downstream raises are built over the previous downstream slope; the section grows with the square of the height.' },
      { q: 'Which method keeps the crest in the same place as the dam rises?',
        options: ['Centreline', 'Upstream', 'Downstream'], answer: 0,
        explain: 'The centreline crest rises vertically, so pipelines and roads do not move, and a chimney drain can be raised with every lift.' }
    ]
  },
  'seepage-paths': {
    id: 'seepage-paths', kind: 'reading', title: 'Seepage paths', mins: 15, sheet: 'Step 8', href: CLASSIC + '#seepage',
    summary: 'Darcy’s law, the five routes water takes past a dam, piping from a toe boil, and uplift under a concrete dam.',
    objectives: [
      'Use Darcy’s law, q = k·i·A, with k from gravel (10⁻² m/s) to compacted clay (10⁻⁹ m/s).',
      'List the five main seepage paths.',
      'Explain the critical gradient and how backward erosion piping starts.'
    ],
    check: [
      { q: 'Hydraulic conductivity of compacted clay is about…',
        options: ['10⁻² m/s', '10⁻⁴ m/s', '10⁻⁹ m/s'], answer: 2,
        explain: 'Gravel ≈ 10⁻², clean sand ≈ 10⁻⁴, silt ≈ 10⁻⁷, compacted clay ≈ 10⁻⁹ m/s. That range is why zoning works.' },
      { q: 'The critical gradient for sand boiling is roughly…',
        options: ['0.1', '1.0', '10'], answer: 1,
        explain: 'i_c = (Gs − 1)/(1 + e) ≈ (2.65 − 1)/(1 + 0.65) ≈ 1.0.' },
      { q: 'Why do drains under a gravity dam matter?',
        options: ['They reduce uplift, which otherwise cancels part of the dam’s weight', 'They stop water reaching the foundation', 'They lower the reservoir in a flood'], answer: 0,
        explain: 'Weight resists sliding; uplift subtracts from it. Clogged drains can nearly double the uplift force.' }
    ]
  },
  'seepage-3d': {
    id: 'seepage-3d', kind: 'interactive', core: true, title: 'Seepage in 3D', mins: 30,
    summary: 'Five predictions on a 24 m embankment, then a design brief and a five-question quiz.'
  }
};

export function allLessonIds() { return ORDER.slice(); }

export const GLOSSARY = [
  ['Phreatic surface', 'The surface where pore-water pressure is zero. Below it the soil is saturated; above it, pore water is in suction.', 'seepage-3d'],
  ['Seepage face', 'The stretch of a slope where the phreatic surface meets the air and water leaks out. On a downstream slope it softens the soil and can cause sloughing.', 'seepage-3d'],
  ['Total head (h)', 'Elevation plus pressure head, h = z + ψ. Water flows from high total head to low total head.', 'seepage-3d'],
  ['Pressure head (ψ)', 'Pore-water pressure expressed as a height of water, ψ = u / (ρg). Negative above the phreatic surface (suction).', 'seepage-3d'],
  ['Equipotential', 'A line of equal total head. In isotropic soil, flow lines cross equipotentials at right angles.', 'seepage-3d'],
  ['Flow line', 'The path a particle of water follows. Pairs of flow lines bound a flow tube carrying a fixed share of the flow.', 'seepage-3d'],
  ['Flow net', 'The grid of flow lines and equipotentials for a seepage problem; the traditional hand method for estimating seepage and gradients.', 'seepage-paths'],
  ['Hydraulic conductivity (k, K)', 'How easily water moves through a soil, in m/s. Ranges from about 10⁻² (gravel) to 10⁻⁹ (compacted clay).', 'seepage-paths'],
  ['Hydraulic gradient (i)', 'Head lost per metre of flow path, i = Δh / L. Darcy’s law: q = k · i · A.', 'seepage-paths'],
  ['Exit gradient', 'The hydraulic gradient where seepage leaves the soil: on the ground beyond the toe, or on a seepage face. Steep exit gradients drive heave and piping.', 'seepage-3d'],
  ['Critical gradient (i_c)', 'The upward gradient at which water carries the full buoyant weight of the soil: i_c = (Gs − 1)/(1 + e) ≈ 1.0.', 'seepage-paths'],
  ['Exit safety factor', 'The critical gradient divided by the steepest exit gradient, i_c / i_exit. Designers look for 3 or more at an unfiltered exit.', 'seepage-3d'],
  ['Piping', 'Internal erosion in which a pipe-like channel forms and works backward from the exit toward the reservoir.', 'seepage-paths'],
  ['Chimney drain', 'A vertical or inclined drain of sand and gravel inside the downstream part of the dam, usually joined to a blanket drain along the base. It intercepts seepage and keeps the downstream slope dry.', 'seepage-3d'],
  ['Toe drain', 'A drain at the downstream toe that collects seepage and lowers the exit point of the phreatic surface.', 'seepage-3d'],
  ['Cutoff', 'A low-permeability barrier (trench, slurry wall, grout curtain) under the dam that blocks flow through a sand-and-gravel foundation. In the 3D lesson a partial cutoff cuts seepage by less than 10%, a full one by more than 90%.', 'seepage-3d'],
  ['Core', 'The low-permeability central zone of an embankment, usually compacted clay, that carries most of the head loss.', 'zones'],
  ['Filter', 'A graded sand zone that lets water pass but stops soil grains from being carried out.', 'zones'],
  ['Upstream raise', 'A tailings-dam raise that steps toward the pond and is founded on the tailings beach.', 'raising'],
  ['Liquefaction', 'Loss of strength in loose saturated soil when pore pressure rises and grain contact forces drop toward zero.', 'types']
];
