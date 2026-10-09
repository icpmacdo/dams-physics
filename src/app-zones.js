/* ===================== Fig 3: dam zones ===================== */
(function figZones() {
  const F = fig($('#fig-zones'));
  const svg = $('#svg-zones');
  const FAR = 600;

  /* ---------- zone libraries ---------- */
  function earthRock() {
    const H = 60;
    const usF = z => -6 - 2.2 * (H - z), dsF = z => 6 + 1.9 * (H - z);
    const dam = [[usF(0), 0], [dsF(0), 0], [dsF(H), H], [usF(H), H]];
    const wc = z => 2 + 0.31 * (57 - z);
    const Z = (fL, fR, z1, z2) => clipConvex(band(fL, fR, z1, z2), dam);
    const w0 = wc(0);
    return {
      key: 'er', tab: 'Earth–rockfill', title: 'Zoned earth–rockfill dam with central clay core', scale: 'Drawn to scale · 60 m high · 2.2H:1V and 1.9H:1V slopes',
      bounds: [-175, 150, -48, 74], level: 55, levelBase: 0,
      water: [[-175, 55], [usF(55), 55], [usF(0), 0], [-175, 0]],
      tail: [[dsF(2), 2], [150, 2], [150, 0], [dsF(0), 0]],
      line: { pts: [[usF(55), 55], [-2.6, 55], [0.5, 50], [3.5, 42], [6.5, 33], [9.5, 24], [12.5, 15], [15.5, 8], [18.5, 4], [21, 2.2], [27, 1.4], [60, 1.1], [100, 0.9], [118, 0.6]], label: 'Phreatic surface', at: [40, 5] },
      zones: [
        { id: 'BR', name: 'Bedrock', fill: 'p-bedrock', parts: [{ poly: [[-175, -12], [150, -12], [150, -48], [-175, -48]], mark: [-150, -34] }], step: -1,
          info: { mat: 'Jointed rock, weathered near the surface, tighter with depth.', k: '10⁻⁵ to 10⁻⁸ m/s, controlled by open joints rather than the rock itself', job: 'Carries the dam. Its joints are the deep seepage path the grout curtain is there to close.', risk: 'Open or clay-filled joints can carry water, and wash soil into them, under the core.' } },
        { id: 'AL', name: 'Alluvium', fill: 'p-alluv', parts: [{ poly: [[-175, 0], [150, 0], [150, -12], [-175, -12]], mark: [-150, -6] }], step: -1,
          info: { mat: 'River sand and gravel left in the valley floor.', k: '10⁻³ to 10⁻⁵ m/s', job: 'Supports the shells. Too permeable to leave under the core, so the cutoff trench cuts through it.', risk: 'Left in place under the core, it would carry most of the seepage, and could pipe at the toe.' } },
        { id: 'GC', name: 'Grout curtain', fill: 'p-grout', parts: [{ poly: band(() => -1.6, () => 1.6, -42, -12), mark: [14, -30], anchor: [1.6, -30] }], step: 1, mode: 'drill',
          info: { mat: 'Cement grout injected under pressure through lines of drill holes, typically 1.5–3 m apart, closed in by split spacing.', k: 'Brings jointed rock down toward 10⁻⁷ m/s', job: 'Seals open joints in the rock below the core so water can\'t short-circuit underneath.', risk: 'Gaps between holes or poor closure leave windows; curtains are checked with water-pressure (Lugeon) tests.' } },
        { id: '1T', name: 'Cutoff trench', fill: 'p-clay', parts: [{ poly: [[-w0, 0], [w0, 0], [8, -12], [-8, -12]], mark: [-36, -24], anchor: [-6, -8] }], step: 0,
          info: { mat: 'Core material compacted in a trench excavated through the alluvium to rock.', k: '≈10⁻⁹ m/s', job: 'Extends the core down to rock so water can\'t simply pass under the dam through the gravel.', risk: 'A poorly cleaned rock contact or open joints at the trench base let core soil erode into the rock (Teton Dam, 1976).' } },
        { id: '3U', name: 'Upstream shell', fill: 'p-rock', parts: [{ poly: Z(() => -FAR, z => -wc(z) - 7, 0, H), mark: [-70, 22], dx: -52 }], step: 2,
          info: { mat: 'Rockfill or sand and gravel, compacted in 1–2 m lifts.', k: '10⁻¹ to 10⁻³ m/s', job: 'Weight and stability. Saturated by the reservoir, it confines the core.', risk: 'If it drains slowly when the reservoir is lowered quickly, trapped pore pressure can slide the upstream slope (rapid drawdown).' } },
        { id: '4', name: 'Riprap', fill: 'p-riprap', parts: [{ poly: Z(z => usF(z) - 3, z => usF(z) + 4.5, 8, H), mark: [-128, 30], anchor: [usF(26) + 1, 26], dx: -70 }], step: 3,
          info: { mat: 'Large, durable quarried rock, 0.5–1.5 m, over a gravel bedding layer.', k: 'Free-draining', job: 'Armours the upstream face against waves, ice and wind set-up.', risk: 'Undersized or weathering rock lets waves pluck out the shell beneath, oversteepening the face.' } },
        { id: '2B', name: 'Transition', fill: 'p-trans', parts: [
          { poly: Z(z => -wc(z) - 7, z => -wc(z) - 3, 0, 57), mark: [-38, 66], anchor: [-wc(46) - 5, 46], dx: -34 },
          { poly: Z(z => wc(z) + 3, z => wc(z) + 7, 0, 57), mark: [38, 66], anchor: [wc(46) + 5, 46], dx: 34 }], step: 2,
          info: { mat: 'Sandy gravel or crushed rock, typically 3–5 m wide.', k: '≈10⁻³ m/s', job: 'Steps the grain size up from the sand filter to the rockfill, so the filter can\'t wash into the rockfill voids. Also eases the stiffness change between core and shell.', risk: 'Without it, the filter sand itself erodes into the rockfill and the core is left unprotected.' } },
        { id: '2A', name: 'Fine filter', fill: 'p-filter', parts: [
          { poly: Z(z => -wc(z) - 3, z => -wc(z), 0, 57), mark: [-20, 70], anchor: [-wc(52) - 1.5, 52], dx: -18 },
          { poly: Z(z => wc(z), z => wc(z) + 3, 0, 57), mark: [20, 70], anchor: [wc(52) + 1.5, 52], dx: 18 }], step: 2,
          info: { mat: 'Processed clean sand, graded to the core: D15 of the filter ≤ 4–5 × D85 of the core.', k: '≈10⁻⁵ m/s, 10 000 × the core', job: 'Lets water out of the core while keeping every core grain in. The downstream filter is also the chimney drain.', risk: 'This is the zone that stops internal erosion. A cracked core with no filter behind it can pipe and fail in hours.' } },
        { id: '1', name: 'Core', fill: 'p-clay', parts: [{ poly: Z(z => -wc(z), z => wc(z), 0, 57), mark: [0, 28] }], step: 2,
          info: { mat: 'Clay or glacial till, compacted slightly wet of optimum moisture so it deforms without cracking.', k: '≈10⁻⁹ m/s', job: 'The watertight barrier. Almost all of the reservoir head is lost across it.', risk: 'Hydraulic fracture, settlement cracks or a wet seam open a concentrated leak. The filters decide whether a leak becomes a failure.' } },
        { id: '3D', name: 'Downstream shell', fill: 'p-rock', parts: [{ poly: Z(z => wc(z) + 7, () => FAR, 0, H), mark: [60, 22], dx: 52 }], step: 2,
          info: { mat: 'Rockfill, compacted in 1–2 m lifts.', k: '10⁻¹ to 10⁻³ m/s', job: 'Supports the core against the water load and stays drained, so it is strong. Free drainage lets it stand at a steeper slope than a homogeneous fill could.', risk: 'If drains or the blanket clog, the shell saturates and loses much of its margin against sliding.' } },
        { id: 'BF', name: 'Filter blanket', fill: 'p-filter', parts: [{ poly: Z(() => w0 + 7, () => FAR, 0, 1.6), mark: [78, -6], anchor: [70, 0.8], dx: 52, dy: -4 }], step: 2,
          info: { mat: 'Sand filter spread over the alluvium before the downstream shell is placed.', k: '≈10⁻⁵ m/s', job: 'Lets foundation seepage rise into the free-draining shell without carrying alluvium sand with it.', risk: 'Without it, rising seepage can carry foundation sand into the rockfill voids, undermining the toe.' } },
        { id: 'TD', name: 'Toe drain', fill: 'p-drain', parts: [{ poly: Z(() => dsF(0) - 22, () => FAR, 0, 6), mark: [132, 12], anchor: [112, 2.5], dx: 66 }], step: 2,
          info: { mat: 'Coarse gravel around a perforated collector pipe, wrapped in filter.', k: 'Free-draining', job: 'Collects all seepage at the toe and leads it to a measuring weir.', risk: 'Flow that rises at a constant reservoir level, or turns cloudy, is an early warning that soil is moving.' } },
        { id: 'CR', name: 'Crest', fill: 'p-fill', parts: [{ poly: Z(z => -wc(z) - 7, z => wc(z) + 7, 57, H), mark: [0, 70], anchor: [0, 58.6], dy: 9 }], step: 3,
          info: { mat: 'Road base over a capping layer that protects the top of the core from drying and frost.', k: '–', job: 'Access, plus freeboard above the maximum flood level and camber (extra height) for long-term settlement.', risk: 'Too little freeboard means overtopping, the most common cause of embankment failure along with internal erosion.' } }
      ],
      steps: [
        { label: 'Strip the foundation; excavate the cutoff trench to rock and backfill it with core', zones: ['1T'], mode: 'rise' },
        { label: 'Drill and grout the curtain beneath the trench', zones: ['GC'], mode: 'drill' },
        { label: 'Core, filters, transitions and shells rise together in compacted lifts', zones: ['1', '2A', '2B', '3U', '3D', 'BF', 'TD'], mode: 'rise' },
        { label: 'Top out the crest; armour the upstream face with riprap', zones: ['CR', '4'], mode: 'rise' },
        { label: 'First filling: the reservoir rises', water: true },
        { label: 'Seepage reaches steady state; the phreatic surface forms in the core', line: true }
      ]
    };
  }

  function cfrd() {
    const uf = z => -6.8 - 1.4 * (58 - z), df = z => 6.8 + 1.4 * (58 - z);
    const dam = [[uf(0), 0], [df(0), 0], [df(58), 58], [uf(58), 58]];
    const Z = (fL, fR, z1, z2) => clipConvex(band(fL, fR, z1, z2), dam);
    const b3c = z => 30 - (30 / 58) * z;
    return {
      key: 'cf', tab: 'Concrete-face rockfill', title: 'Concrete-face rockfill dam (CFRD)', scale: 'Drawn to scale · 58 m rockfill + parapet · slab thickness ×2.5',
      bounds: [-130, 110, -46, 76], level: 56, levelBase: 0,
      water: [[-130, 56], [uf(56), 56], [uf(0), 0], [-130, 0]],
      tail: [[df(1.5), 1.5], [110, 1.5], [110, 0], [df(0), 0]],
      line: { pts: [[-84, 1.2], [-40, 1.0], [0, 0.9], [50, 0.8], [86, 0.5]], label: 'Phreatic surface stays at the base', at: [10, 4] },
      zones: [
        { id: 'BR', name: 'Bedrock', fill: 'p-bedrock', parts: [{ poly: [[-130, 0], [110, 0], [110, -46], [-130, -46]], mark: [-115, -30] }], step: -1,
          info: { mat: 'Sound rock. Under the plinth it is excavated to fresh, unweathered rock; under the rockfill, weathered rock can often stay.', k: 'Joint-controlled', job: 'Founds the plinth, the one place the water barrier meets the ground.', risk: 'Erodible seams under the plinth are treated with dental concrete and filters.' } },
        { id: 'GC', name: 'Grout curtain', fill: 'p-grout', parts: [{ poly: band(() => -90.6, () => -87.6, -42, -3), mark: [-70, -28], anchor: [-87.6, -28] }], step: 1, mode: 'drill',
          info: { mat: 'Cement grout injected through holes drilled from the plinth.', k: 'Rock brought toward 10⁻⁷ m/s', job: 'Extends the face slab\'s water barrier down into the rock.', risk: 'Seepage through ungrouted rock bypasses the slab entirely.' } },
        { id: '3B', name: 'Main rockfill', fill: 'p-rock', parts: [{ poly: Z(z => uf(z) + 10.8, b3c, 0, 58), mark: [-18, 24] }], step: 2,
          info: { mat: 'Hard, durable quarried rock, compacted in about 1 m lifts by heavy vibratory rollers, usually with water added.', k: 'Free-draining, 10⁻¹ m/s and up', job: 'Carries the water load transmitted by the face slab. Its stiffness controls how far the slab deflects.', risk: 'Soft or poorly compacted rockfill settles, deflecting and cracking the slab.' } },
        { id: '3C', name: 'Downstream rockfill', fill: 'p-rock', parts: [{ poly: Z(b3c, () => FAR, 0, 58), mark: [44, 18], dx: 20 }], step: 2,
          info: { mat: 'Rockfill of lower quality or larger size, in thicker lifts (1.5–2 m).', k: 'Free-draining', job: 'Stability for the downstream slope; it carries less of the water load than 3B.', risk: 'Weak or degradable rock settles over decades, especially if wetted.' } },
        { id: '3A', name: 'Transition rockfill', fill: 'p-trans', parts: [{ poly: Z(z => uf(z) + 5.8, z => uf(z) + 10.8, 0, 58), mark: [-24, 70], anchor: [uf(46) + 8.3, 46], dx: -12 }], step: 2,
          info: { mat: 'Smaller rockfill, compacted in thin lifts (0.4–0.5 m).', k: '≈10⁻² m/s', job: 'A filter step between the fine cushion and the coarse main rockfill.', risk: 'Without it, the cushion can migrate into the main rockfill voids, leaving the slab unsupported.' } },
        { id: '2B', name: 'Cushion', fill: 'p-filter', parts: [{ poly: Z(z => uf(z) + 1.8, z => uf(z) + 5.8, 0, 58), mark: [-40, 66], anchor: [uf(42) + 3.8, 42], dx: -21 }], step: 2,
          info: { mat: 'Crushed, well-graded rock with sand and some fines, compacted on the slope.', k: '10⁻⁴ to 10⁻⁵ m/s, semi-pervious', job: 'A smooth, firm bed for the slab. If the slab cracks, it limits the leak.', risk: 'Too pervious and a slab crack leaks heavily; too fine and it can erode.' } },
        { id: '2A', name: 'Special fine transition', fill: 'p-filter', parts: [{ poly: [[-87.6, 0.2], [-80, -0.5], [-73, -0.5], [-79.5, 5.2], [-84.6, 2.3]], mark: [-60, -12], anchor: [-79, 1.5], dx: -12 }], step: 2,
          info: { mat: 'Fine, well-graded sandy gravel placed under the perimetric joint.', k: '≈10⁻⁵ m/s', job: 'If the perimetric joint opens, silt washed in from 1A is caught here and seals the leak.', risk: 'The perimetric joint carries the largest movements in the dam; this zone is its backup.' } },
        { id: 'F', name: 'Face slab', fill: 'p-conc', parts: [{ poly: Z(z => uf(z) - 0.5, z => uf(z) + 1.8, 0.3, 56.6), mark: [-58, 46], anchor: [uf(36) + 0.9, 36], dx: -16 }], step: 3, mode: 'rise',
          info: { mat: 'Reinforced concrete, about 0.3 m plus 0.002–0.003 × depth, slip-formed up the slope in vertical strips 12–18 m wide.', k: 'Concrete ≈10⁻¹⁰ m/s; leakage is through cracks and joints', job: 'The only water barrier. Copper and PVC waterstops seal the joints between strips.', risk: 'Rockfill settlement cracks the slab or opens joints. Leakage of hundreds of litres per second has been recorded at large CFRDs.' } },
        { id: 'P', name: 'Plinth', fill: 'p-conc', parts: [{ poly: [[-96, -3], [-80, -3], [-80, -0.6], [-87.6, 0.2], [-96, 0]], mark: [-108, -10], anchor: [-92, -1.5], dx: -16, dy: -3 }], step: 0,
          info: { mat: 'Reinforced concrete toe slab anchored to sound rock around the whole upstream perimeter.', k: '–', job: 'Connects the face slab to the foundation through the perimetric joint; the grout curtain is drilled from it.', risk: 'Founded on poor rock, it can let water under the barrier.' } },
        { id: '1A', name: 'Impervious fill', fill: 'p-clay', parts: [{ poly: [[-87.6, 0], [-68.4, 14], [-74.4, 14], [-95, 0]], mark: [-112, 24], anchor: [-80, 6], dx: -20 }], step: 4, mode: 'fade',
          info: { mat: 'Silt or silty fine sand placed against the lower slab.', k: '≈10⁻⁷ m/s', job: 'Self-healing: if a crack opens in the slab or perimetric joint, water carries silt into it and plugs it.', risk: 'Not a barrier on its own, only a sealant for defects.' } },
        { id: '1B', name: 'Random fill', fill: 'p-fill', parts: [{ poly: [[-95, 0], [-74.4, 14], [-68.4, 14], [-62.8, 18], [-71, 18], [-107, 0]], mark: [-122, 8], anchor: [-92, 6], dx: -24 }], step: 4, mode: 'fade',
          info: { mat: 'Whatever local fill is to hand.', k: 'Variable', job: 'Holds the 1A silt in place on the slope.', risk: 'Low consequence.' } },
        { id: 'PW', name: 'Parapet wall', fill: 'p-conc', parts: [{ poly: [[-7.4, 56.4], [-1, 56.4], [-1, 57.4], [-5.8, 57.4], [-5.8, 63.2], [-7.4, 63.2]], mark: [10, 72], anchor: [-6.6, 62], dx: -30, dy: 6 }], step: 4, mode: 'fade',
          info: { mat: 'Reinforced concrete L-shaped wall, 4–6 m high.', k: '–', job: 'Adds freeboard on top of the rockfill crest far more cheaply than raising the whole embankment.', risk: 'Must be watertight at its joint with the slab.' } }
      ],
      steps: [
        { label: 'Excavate to sound rock and cast the plinth', zones: ['P'], mode: 'rise' },
        { label: 'Drill and grout the curtain from the plinth', zones: ['GC'], mode: 'drill' },
        { label: 'Rockfill placed and rolled in lifts, finest zones upstream', zones: ['2A', '2B', '3A', '3B', '3C'], mode: 'rise' },
        { label: 'Face slab slip-formed up the slope in strips', zones: ['F'], mode: 'rise' },
        { label: 'Parapet wall; silt and random fill placed over the perimetric joint', zones: ['PW', '1A', '1B'], mode: 'fade' },
        { label: 'First filling: the reservoir rises against the slab', water: true },
        { label: 'Seepage through joints drains straight through the rockfill', line: true }
      ]
    };
  }

  function gravity() {
    const dam = [[0, 0], [0, 60], [8, 60], [8, 50], [48, 0]];
    const inner = [[3, 0], [45, 0], [5.5, 47.5], [5.5, 57], [3, 57]];
    return {
      key: 'gr', tab: 'Concrete gravity', title: 'Concrete gravity dam, non-overflow section', scale: 'Drawn to scale · 60 m high · downstream face 0.8H:1V',
      bounds: [-110, 140, -42, 70], level: 57, levelBase: 0, noExplode: true, maxH: 440,
      water: [[-110, 57], [0, 57], [0, 0], [-110, 0]],
      tail: [[44, 5], [140, 5], [140, 0], [48, 0]],
      line: { pts: [[-24, 0], [-16, -9], [-6, -17], [3, -20], [7.3, -16]], label: 'Seepage drawn to the drains', at: [-36, -16], arrow: true },
      zones: [
        { id: 'BR', name: 'Bedrock', fill: 'p-bedrock', parts: [{ poly: [[-110, 0], [140, 0], [140, -42], [-110, -42]], mark: [-90, -30] }], step: -1,
          info: { mat: 'Sound rock, excavated to a firm, clean surface.', k: 'Joint-controlled', job: 'Carries the dam\'s weight and its shear resistance at the base contact.', risk: 'Weak seams parallel to the base are the classic sliding plane.' } },
        { id: 'CG', name: 'Consolidation grouting', fill: 'p-grout', parts: [{ poly: [[0, 0], [48, 0], [48, -6], [0, -6]], mark: [70, -4], anchor: [46, -3] }], step: 0, mode: 'drill',
          info: { mat: 'A grid of shallow holes (5–15 m) grouted at low pressure.', k: '–', job: 'Stiffens and tightens the blast-damaged rock directly under the dam.', risk: 'Open, loosened rock under the heel invites seepage and uplift.' } },
        { id: 'EX', name: 'Exterior concrete', fill: 'p-conc', parts: [{ poly: dam, hole: inner, mark: [-24, 66], anchor: [1.5, 52] }], step: 1,
          info: { mat: 'A richer, air-entrained mix on the faces.', k: '≈10⁻¹¹ m/s', job: 'Resists freeze–thaw and weathering; waterstops across contraction joints sit in this zone near the upstream face.', risk: 'Deterioration of the face lets water into lift joints.' } },
        { id: 'IN', name: 'Interior mass concrete', fill: 'p-conc', parts: [{ poly: inner, mark: [20, 20] }], step: 1,
          info: { mat: 'Lean mass concrete with little cement (or roller-compacted concrete), placed in lifts of 1.5–2.3 m and blocks 15–20 m long.', k: '≈10⁻¹¹ m/s', job: 'Weight. A gravity dam resists the water by mass and friction alone.', risk: 'Heat of hydration: big pours get hot and crack as they cool, so cement is kept low and pours are sometimes pre-cooled.' } },
        { id: 'DD', name: 'Formed drains', fill: 'water', parts: [{ poly: [[5.7, 7.5], [6.4, 7.5], [6.4, 58], [5.7, 58]], mark: [26, 64], anchor: [6.1, 40] }], step: 1,
          info: { mat: 'Vertical holes formed in the concrete every 3 m or so, close behind the upstream face.', k: '–', job: 'Intercept water seeping through lift joints and lead it to the gallery.', risk: 'Without them, seepage pressure builds up on lift joints inside the dam.' } },
        { id: 'GA', name: 'Gallery', fill: 'void', parts: [{ poly: [[5, 3.5], [8.5, 3.5], [8.5, 7.5], [5, 7.5]], mark: [-24, 16], anchor: [5, 5.5] }], step: 1,
          info: { mat: 'A walk-in tunnel along the dam, just above the foundation near the heel.', k: '–', job: 'Where the curtain and drains are drilled from, seepage is measured, and instruments are read. Drains can be redrilled from here.', risk: 'Losing access to the gallery means losing the ability to maintain the drains.' } },
        { id: 'GC', name: 'Grout curtain', fill: 'p-grout', parts: [{ poly: [[4.6, 3.5], [6.0, 3.5], [-1.6, -36], [-3.2, -36]], mark: [-26, -30], anchor: [-2, -28] }], step: 2, mode: 'drill',
          info: { mat: 'Deep grouted holes drilled from the gallery, angled slightly upstream to cross more joints.', k: 'Rock brought toward 10⁻⁷ m/s', job: 'Reduces the seepage reaching the drains.', risk: 'Curtains degrade with time; they reduce flow but are not relied on to cut uplift.' } },
        { id: 'FD', name: 'Foundation drains', fill: 'water', parts: [{ poly: [[7.0, 3.5], [7.7, 3.5], [7.7, -24], [7.0, -24]], mark: [24, -18], anchor: [7.7, -16] }], step: 2, mode: 'drill',
          info: { mat: 'Open holes, about 75 mm diameter at 3 m spacing, drilled from the gallery behind the curtain.', k: '–', job: 'Relieve water pressure under the base, cutting uplift sharply. See Fig. 8.', risk: 'They clog with calcite and fines; clogged drains let uplift climb back toward full reservoir pressure.' } }
      ],
      steps: [
        { label: 'Excavate to sound rock; consolidation-grout the blasted surface', zones: ['CG'], mode: 'drill' },
        { label: 'Concrete placed in lifts and blocks; gallery and drains formed in', zones: ['IN', 'EX', 'GA', 'DD'], mode: 'rise' },
        { label: 'Grout curtain and foundation drains drilled from the gallery', zones: ['GC', 'FD'], mode: 'drill' },
        { label: 'First filling: the reservoir rises', water: true },
        { label: 'Seepage under the base is drawn into the drains', line: true }
      ]
    };
  }

  function tailings() {
    const saw = [[-5, 50], [-17.75, 41.5], [-5, 41.5], [-17.75, 33], [-5, 33], [-17.75, 24.5], [-5, 24.5], [-17.75, 16], [-5, 16]];
    const cs = [[45, 0], [180, 0], [5, 50]].concat(saw, [[5, 16]]);
    const beachTop = x => 49.5 - 0.03 * (-5 - x);
    const bs = [[-100, 0], [-45, 0], [-5, 16], [-17.75, 16], [-5, 24.5], [-17.75, 24.5], [-5, 33], [-17.75, 33], [-5, 41.5], [-17.75, 41.5], [-5.75, 49.5], [-40, beachTop(-40)], [-70, beachTop(-70)]];
    return {
      key: 'tl', tab: 'Tailings (centreline)', title: 'Centreline tailings dam built of cycloned sand', scale: 'Drawn to scale · 50 m high · 3.5H:1V downstream slope',
      bounds: [-140, 205, -15, 64], level: 47.3, levelBase: 42,
      water: [[-140, 47.3], [-78, 47.3], [-140, 42.35]],
      line: { pts: [[-78, 47.3], [-55, 45], [-35, 40], [-20, 33], [-8, 24], [2, 15], [7.5, 10], [7.5, 2]], label: 'Phreatic surface', at: [-40, 31] },
      extras: 'cyclone',
      zones: [
        { id: 'FN', name: 'Foundation', fill: 'p-alluv', parts: [{ poly: [[-140, 0], [205, 0], [205, -15], [-140, -15]], mark: [-122, -8] }], step: -1,
          info: { mat: 'Glacial till over rock in this example.', k: '10⁻⁶ to 10⁻⁸ m/s', job: 'Supports a dam that spreads very wide, so its strength matters over a large area.', risk: 'A weak clay layer in the foundation caused the Mount Polley failure (2014).' } },
        { id: 'SL', name: 'Slimes', fill: 'p-slime', parts: [{ poly: [[-140, 0], [-100, 0], [-70, beachTop(-70)], [-78, 47.3], [-140, 42.35]], mark: [-118, 22], dx: -40 }], step: 1,
          info: { mat: 'The fines: silt- and clay-size rock flour that settles slowly near the pond.', k: '10⁻⁷ to 10⁻⁹ m/s', job: 'None, structurally. It is the stored product.', risk: 'Very weak, slow to consolidate, often loose and saturated. If the pond creeps toward the dam, slimes end up under the raises.' } },
        { id: 'BS', name: 'Beach sands', fill: 'p-tsand', parts: [{ poly: bs, mark: [-48, 26], dx: -22 }], step: 1,
          info: { mat: 'The coarse fraction of the tailings, which settles first near the spigots.', k: '10⁻⁵ to 10⁻⁶ m/s', job: 'A long, wide, drained beach keeps the pond, and the phreatic surface, away from the dam. Each raise\'s upstream edge rests on it.', risk: 'If it stays loose and saturated it is contractive: the material that liquefies.' } },
        { id: 'SD', name: 'Starter dam', fill: 'p-fill', parts: [{ poly: [[-45, 0], [45, 0], [5, 16], [-5, 16]], mark: [-22, 6] }], step: 0,
          info: { mat: 'Compacted earthfill or rockfill from borrow, built before the mill starts.', k: 'Varies; often a low-permeability upstream zone', job: 'Holds the first one to three years of tailings, until the beach is wide enough to start raising.', risk: 'Becomes the toe of the final structure, so it must be designed for the full height.' } },
        { id: 'CS', name: 'Cycloned sand', fill: 'p-cyclone', parts: [{ poly: cs, mark: [70, 18], dx: 34 }], step: 1,
          info: { mat: 'Tailings split by hydrocyclones: the coarse underflow is spread on the downstream slope and compacted; the fine overflow goes to the impoundment.', k: '10⁻⁴ to 10⁻⁵ m/s', job: 'Builds the dam out of the waste it holds, raised continuously through the mine\'s life.', risk: 'It has to be compacted dense (dilative). Loose cycloned sand that saturates can liquefy like any loose tailings.' } },
        { id: 'CD', name: 'Chimney drain', fill: 'p-drain', parts: [{ poly: [[6, 1.5], [9, 1.5], [9, 47], [6, 47]], mark: [44, 56], anchor: [8.6, 42], dy: 8 }], step: 1,
          info: { mat: 'Sand and gravel drain, raised with each lift close behind the centreline.', k: '10⁻³ m/s', job: 'Intercepts seepage from the impoundment and keeps the downstream shell unsaturated, so it can\'t liquefy.', risk: 'A clogged or discontinuous chimney lets the phreatic surface rise into the shell.' } },
        { id: 'BD', name: 'Blanket and finger drains', fill: 'p-drain', parts: [{ poly: [[6, 0], [165, 0], [165, 1.5], [6, 1.5]], mark: [118, -9], anchor: [110, 0.8], dy: -5 }], step: 0,
          info: { mat: 'Gravel blanket and gravel-filled trenches with perforated pipes, on the foundation.', k: '10⁻² to 10⁻³ m/s', job: 'Carries water from the chimney and the foundation out to the toe.', risk: 'They are buried under the dam forever and can never be replaced; if they fail, pore pressure rises everywhere above.' } },
        { id: 'TD', name: 'Toe drain', fill: 'p-rock', parts: [{ poly: [[150, 0], [180, 0], [159, 6], [152, 6]], mark: [174, 14], anchor: [160, 3], dx: 30 }], step: 2, mode: 'fade',
          info: { mat: 'Rockfill berm at the downstream toe.', k: 'Free-draining', job: 'Lets drain water out freely and buttresses the toe.', risk: 'Seepage breaking out above the toe drain means the phreatic surface is higher than designed.' } },
        { id: 'SC', name: 'Seepage collection pond', fill: 'water', parts: [{ poly: [[186, 0], [200, 0], [198, -3], [188, -3]], mark: [194, 10], anchor: [193, -1], dx: 30 }], step: 2, mode: 'fade',
          info: { mat: 'Lined pond with a pump-back system, often with a cutoff and interception wells.', k: '–', job: 'Catches seepage before it reaches streams and groundwater. Tailings water can carry dissolved metals, sulfate or process chemicals.', risk: 'Monitored for both quantity and chemistry; a change in either is a warning.' } }
      ],
      steps: [
        { label: 'Starter dam and underdrains built from borrow before milling starts', zones: ['SD', 'BD'], mode: 'rise' },
        { label: 'Year after year: cycloned sand raises the dam as tailings fill behind it', zones: ['CS', 'CD', 'BS', 'SL'], mode: 'rise' },
        { label: 'Toe drain and seepage collection pond', zones: ['TD', 'SC'], mode: 'fade' },
        { label: 'Supernatant pond sits on the slimes, far from the crest', water: true },
        { label: 'Seepage through the beach is captured by the chimney drain', line: true }
      ]
    };
  }

  const LIB = [earthRock(), cfrd(), gravity(), tailings()];
  let cur = null, M = null, sel = null, exploded = false, build = null, buildT = null;
  const tabsEl = $('#zn-tabs'), chipsEl = $('#zn-chips'), infoEl = $('#zn-info'), stepEl = $('#zn-step');
  const explodeBtn = $('#zn-explode'), buildBtn = $('#zn-build');
  LIB.forEach((d, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = d.tab; b.dataset.i = i;
    b.addEventListener('click', () => show(i, true));
    tabsEl.appendChild(b);
  });
  tabsEl.addEventListener('keydown', e => {
    const bs = $$('button', tabsEl), i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const j = (i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length; bs[j].focus(); show(j, true); e.preventDefault(); }
  });

  function fillOf(f) { return f === 'void' ? 'var(--sheet)' : f === 'water' ? 'var(--water-fill)' : `url(#${f})`; }
  function xRangeAt(polys, z) {
    let lo = Infinity, hi = -Infinity;
    for (const p of polys) for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      if ((a[1] - z) * (b[1] - z) <= 0 && a[1] !== b[1]) { const x = a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]); lo = Math.min(lo, x); hi = Math.max(hi, x); }
    }
    return [lo, hi];
  }
  let els = {};
  function show(i, user) {
    cur = LIB[i];
    $$('button', tabsEl).forEach((b, j) => { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
    $('#zn-title').textContent = cur.title; $('#zn-scale').textContent = cur.scale;
    const [x0, x1, z0, z1] = cur.bounds;
    M = uniformMapper(x0, x1, z0, z1, 1000, 10, 10, cur.maxH || 520);
    svg.setAttribute('viewBox', `0 0 1000 ${Math.round(M.H)}`);
    svg.textContent = '';
    const defs = E('defs', null, svg);
    const gW = E('g', null, svg), gZ = E('g', null, svg), gL = E('g', null, svg), gM = E('g', null, svg);
    els = { zones: {}, clips: {}, defs, gW, gL };
    // water
    const wclip = E('clipPath', { id: 'zc-water' }, defs); els.wrect = E('rect', { x: 0, width: 1000, y: 0, height: M.H }, wclip);
    els.water = E('g', { 'clip-path': 'url(#zc-water)' }, gW);
    E('polygon', { points: M.P(cur.water), class: 'water' }, els.water);
    const wl = cur.water.filter(p => Math.abs(p[1] - cur.level) < 0.01);
    if (wl.length >= 2) E('path', { d: M.D(wl), class: 'water-line' }, els.water);
    const wx = M.X(cur.water[0][0]) + 40; waterSymbol(els.water, wx, M.Z(cur.level));
    if (cur.tail) E('polygon', { points: M.P(cur.tail), class: 'water' }, gW);
    // zones
    for (const z of cur.zones) {
      const clip = E('clipPath', { id: 'zc-' + cur.key + z.id }, defs);
      const rect = E('rect', { x: 0, width: 1000, y: 0, height: M.H }, clip);
      els.clips[z.id] = rect;
      const parts = [];
      for (const pt of z.parts) {
        const outer = E('g', { class: 'zgroup' }, z.step < 0 ? gW : gZ);
        const g = E('g', { class: 'zone', 'data-id': z.id }, outer);
        const inner = E('g', { 'clip-path': `url(#zc-${cur.key}${z.id})` }, g);
        let shape;
        if (pt.hole) shape = E('path', { d: M.D(pt.poly) + 'z' + M.D(pt.hole) + 'z', 'fill-rule': 'evenodd', class: 'zshape edge-l', style: `fill:${fillOf(z.fill)}` }, inner);
        else shape = E('polygon', { points: M.P(pt.poly), class: 'zshape edge-l', style: `fill:${fillOf(z.fill)}` }, inner);
        if (pt.mark) {
          const mk = E('g', { class: 'marker' }, g);
          const [mx, my] = M.pt(pt.mark);
          if (pt.anchor) { const [ax, ay] = M.pt(pt.anchor); E('path', { d: `M${mx},${my} L${ax},${ay}`, class: 'lead' }, mk); E('circle', { cx: ax, cy: ay, r: 1.8, class: 'ink' }, mk); }
          const w = Math.max(18, z.id.length * 7 + 8);
          E('rect', { x: mx - w / 2, y: my - 8, width: w, height: 16, rx: 3 }, mk);
          T(mk, mx, my + 0.5, z.id, '');
        }
        g.addEventListener('click', () => select(z.id));
        parts.push({ outer, g, pt, inner });
      }
      els.zones[z.id] = { z, parts };
    }
    // line (phreatic / seepage)
    if (cur.line) {
      els.line = E('path', { d: smoothD(cur.line.pts.map(M.pt)), class: 'phreatic', 'marker-end': cur.line.arrow ? 'url(#arr-w)' : null }, gL);
      const [lx, ly] = M.pt(cur.line.at);
      els.lineLbl = T(gL, lx, ly, cur.line.label, 'lbl-s lbl-w halo');
      els.lineLen = els.line.getTotalLength ? els.line.getTotalLength() : 1000;
    }
    if (cur.extras === 'cyclone') {
      const [cx, cy] = M.pt([0, 50]);
      const cg = E('g', null, gL);
      E('path', { d: `M${cx - 5},${cy - 22} h10 l-3,10 h-4 z`, style: 'fill:var(--m-conc);stroke:var(--ink);stroke-width:1' }, cg);
      E('path', { d: `M${cx + 2},${cy - 12} Q${cx + 26},${cy - 10} ${cx + 44},${cy + 4}`, class: 'lead', 'marker-end': 'url(#arr)' }, cg);
      E('path', { d: `M${cx - 4},${cy - 18} Q${cx - 30},${cy - 22} ${cx - 52},${cy - 6}`, class: 'lead', 'marker-end': 'url(#arr)' }, cg);
      T(cg, cx + 28, cy - 16, 'underflow: sand', 'lbl-s halo');
      T(cg, cx - 34, cy - 26, 'overflow: fines', 'lbl-s halo', { 'text-anchor': 'end' });
      T(cg, cx, cy - 28, 'Cyclones', 'lbl-s halo', { 'text-anchor': 'middle' });
      els.extra = cg;
    }
    if (cur.key === 'gr') { // uplift hint
      T(gL, M.X(-60), M.Z(60), 'Reservoir', 'lbl-s halo', { 'text-anchor': 'middle' });
    } else {
      T(gL, M.X(cur.bounds[0]) + 40, M.Z(cur.level) + (cur.key === 'tl' ? -14 : 22), cur.key === 'tl' ? 'Pond' : 'Reservoir', 'lbl-s halo');
    }
    // chips
    chipsEl.textContent = '';
    for (const z of cur.zones) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.id = z.id; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<span class="sw"><svg width="22" height="16" aria-hidden="true"><rect width="22" height="16" style="fill:${fillOf(z.fill)}"/></svg></span><span><b style="font-weight:500">${z.id}</b> ${z.name}</span>`;
      b.addEventListener('click', () => select(z.id));
      chipsEl.appendChild(b);
    }
    explodeBtn.disabled = !!cur.noExplode;
    if (cur.noExplode) setExplode(false); else setExplode(exploded);
    const first = cur.zones.find(z => z.step === 2 || z.step === 1) || cur.zones[0];
    const preferred = { er: '1', cf: 'F', gr: 'FD', tl: 'CD' }[cur.key];
    select(cur.zones.some(z => z.id === preferred) ? preferred : first.id);
    stopBuild(); setBuild(null);
    stepEl.textContent = '';
    if (user && !RM) startBuild();
  }
  function select(id) {
    sel = id;
    for (const k in els.zones) {
      const on = k === id;
      els.zones[k].parts.forEach(p => { p.g.classList.toggle('sel', on); p.g.classList.toggle('dimmed', !on && !!id && hoverDim); });
    }
    $$('.chip', chipsEl).forEach(c => c.setAttribute('aria-pressed', c.dataset.id === id ? 'true' : 'false'));
    const z = els.zones[id].z;
    infoEl.innerHTML = `<h4><span class="code">${z.id}</span>${z.name}</h4><dl><dt>Material</dt><dd>${z.info.mat}</dd><dt>Permeability</dt><dd>${z.info.k}</dd><dt>Job</dt><dd>${z.info.job}</dd><dt>If it fails</dt><dd>${z.info.risk}</dd></dl>`;
  }
  const hoverDim = false;
  function setExplode(on) {
    exploded = on && !cur.noExplode;
    explodeBtn.setAttribute('aria-pressed', exploded ? 'true' : 'false');
    explodeBtn.textContent = exploded ? 'Assemble' : 'Explode';
    for (const k in els.zones) for (const p of els.zones[k].parts) {
      const dx = exploded ? (p.pt.dx || 0) * M.s : 0, dy = exploded ? -(p.pt.dy || 0) * M.s : 0;
      p.outer.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
    }
    const fade = exploded ? '0' : '1';
    els.water.style.opacity = fade; if (els.line) { els.line.style.opacity = fade; els.lineLbl.style.opacity = fade; }
    if (els.extra) els.extra.style.opacity = fade;
    els.water.style.transition = 'opacity .4s';
  }
  explodeBtn.addEventListener('click', () => setExplode(!exploded));
  // build animation
  function setBuild(b) {
    const steps = cur.steps, n = steps.length;
    const full = b == null || b >= n;
    for (const k in els.zones) {
      const z = els.zones[k].z, rect = els.clips[k];
      const si = z.step;
      if (full || si < 0) { rect.setAttribute('y', 0); rect.setAttribute('height', M.H); els.zones[k].parts.forEach(p => p.inner.style.opacity = 1); continue; }
      const st = steps[si] || {};
      const r = clamp(b - si, 0, 1);
      const mode = z.mode || st.mode || 'rise';
      const polys = cur.zones.filter(q => q.step === si).flatMap(q => q.parts.map(p => p.poly));
      let zlo = Infinity, zhi = -Infinity; polys.forEach(p => p.forEach(q => { zlo = Math.min(zlo, q[1]); zhi = Math.max(zhi, q[1]); }));
      if (mode === 'rise') { const zc = lerp(zlo, zhi, r); const y = M.Z(zc); rect.setAttribute('y', y); rect.setAttribute('height', Math.max(0, M.H - y)); els.zones[k].parts.forEach(p => p.inner.style.opacity = 1); }
      else if (mode === 'drill') { const zc = lerp(zhi, zlo, r); rect.setAttribute('y', 0); rect.setAttribute('height', Math.max(0, M.Z(zc))); els.zones[k].parts.forEach(p => p.inner.style.opacity = 1); }
      else { rect.setAttribute('y', 0); rect.setAttribute('height', M.H); els.zones[k].parts.forEach(p => p.inner.style.opacity = r); }
      els.zones[k].parts.forEach(p => { const mk = p.g.querySelector('.marker'); if (mk) mk.style.opacity = r > 0.95 ? 1 : 0; });
    }
    if (full) for (const k in els.zones) els.zones[k].parts.forEach(p => { const mk = p.g.querySelector('.marker'); if (mk) mk.style.opacity = 1; });
    // water + line
    const wi = steps.findIndex(s => s.water), li = steps.findIndex(s => s.line);
    const rw = full ? 1 : clamp(b - wi, 0, 1);
    const zw = lerp(cur.levelBase - 0.5, cur.level + 2, rw);
    const yw = rw <= 0 ? M.H : M.Z(zw);
    els.wrect.setAttribute('y', yw); els.wrect.setAttribute('height', Math.max(0, M.H - yw));
    if (els.line) {
      const rl = full ? 1 : clamp(b - li, 0, 1);
      els.line.style.strokeDasharray = rl >= 1 ? '' : `${els.lineLen} ${els.lineLen}`;
      els.line.style.strokeDashoffset = rl >= 1 ? '' : (els.lineLen * (1 - rl)).toFixed(1);
      if (rl >= 1) els.line.style.strokeDasharray = '';
      els.lineLbl.style.opacity = rl >= 1 ? (exploded ? 0 : 1) : 0;
    }
    if (els.extra) els.extra.style.opacity = full || b > 1 ? (exploded ? 0 : 1) : 0;
    if (!full) {
      const si = Math.min(n - 1, Math.floor(b));
      stepEl.innerHTML = `<b>Step ${si + 1} of ${n}</b> · ${steps[si].label}`;
    }
  }
  function startBuild() {
    if (exploded) setExplode(false);
    build = { t: 0 }; buildT = null;
    buildBtn.querySelector('span').textContent = 'Building…';
    setBuild(0);
  }
  function stopBuild() { build = null; buildBtn.querySelector('span').textContent = 'Build'; }
  buildBtn.addEventListener('click', () => { if (build) { stopBuild(); setBuild(null); stepEl.textContent = ''; } else startBuild(); });
  F.ticks.push((t, dt) => {
    if (!build) return;
    build.t += dt / 1.6;
    if (build.t >= cur.steps.length) { const last = cur.steps[cur.steps.length - 1].label; stopBuild(); setBuild(null); stepEl.innerHTML = `<b>Complete</b> · ${last}`; return; }
    setBuild(build.t);
  });
  show(0, false);
  F.onFirst = () => { if (!RM) startBuild(); };
})();

/* ===================== Fig 4: filter vs rockfill ===================== */
(function figFilter() {
  const cv = $('#cv-filter'), ctx = cv.getContext('2d');
  const F = fig($('#fig-filter'));
  const W = cv.width, H = cv.height, PW = 530, GAP = 40;
  let C = {};
  function colors() {
    C = { clay: cssVar('--m-clay'), rock: cssVar('--m-rock'), filter: cssVar('--m-filter'), ink: cssVar('--ink'), ink2: cssVar('--ink-2'), ink3: cssVar('--ink-3'), water: cssVar('--water'), sheet: cssVar('--sheet'), bad: cssVar('--bad'), ok: cssVar('--ok'), accent: cssVar('--accent') };
  }
  colors(); onTheme(() => { colors(); draw(); });
  const IF = 150; // interface x within panel
  function pack(rmin, rmax, n, tries) {
    const g = [];
    for (let k = 0; k < tries && g.length < n; k++) {
      const r = lerp(rmin, rmax, rnd()), x = IF + r + rnd() * (PW - IF - r), y = 34 + r * 0.3 + rnd() * (H - 54 - r * 0.6);
      if (g.every(q => Math.hypot(q.x - x, q.y - y) > q.r + r + 1.5)) g.push({ x, y, r });
    }
    return g;
  }
  seed = 21;
  const panels = [
    { ox: 0, grains: pack(22, 34, 40, 4000), kind: 'rock', lost: 0, fines: [], cake: new Array(70).fill(0) },
    { ox: PW + GAP, grains: pack(5.5, 8, 900, 30000), kind: 'filter', lost: 0, fines: [], cake: new Array(70).fill(0) }
  ];
  const coreGrains = [];
  for (let i = 0; i < 520; i++) coreGrains.push({ x: 8 + rnd() * (IF - 14), y: 34 + rnd() * (H - 54), r: 1.4 + rnd() * 1.6 });
  function spawnFine(pn, f) {
    f.x = IF - 6 - rnd() * 30; f.y = 38 + rnd() * (H - 62); f.r = 1.6 + rnd() * 1.2; f.vx = 46 + rnd() * 30; f.state = 'move'; f.t = 0;
  }
  panels.forEach(pn => { for (let i = 0; i < 36; i++) { const f = {}; spawnFine(pn, f); f.x -= rnd() * 120; pn.fines.push(f); } });
  const streaks = [];
  for (let i = 0; i < 26; i++) streaks.push({ x: rnd() * PW, y: 36 + rnd() * (H - 60), v: 70 + rnd() * 50 });
  function stepPanel(pn, dt) {
    for (const f of pn.fines) {
      if (f.state === 'stuck') continue;
      f.x += f.vx * dt;
      if (f.x < IF - 2) continue;
      if (pn.kind === 'filter') {
        const bin = clamp(Math.floor((f.y - 34) / ((H - 54) / pn.cake.length)), 0, pn.cake.length - 1);
        const stopX = IF + 2 - pn.cake[bin] * 3.2;
        if (f.x >= stopX) { f.x = stopX; f.state = 'stuck'; pn.cake[bin] = Math.min(9, pn.cake[bin] + 1); }
        continue;
      }
      for (const g of pn.grains) {
        const dx = f.x - g.x, dy = f.y - g.y, d = Math.hypot(dx, dy), m = g.r + f.r;
        if (d < m) { const k = m / Math.max(d, 0.01); f.x = g.x + dx * k; f.y = g.y + (Math.abs(dy) < 0.3 ? (rnd() < 0.5 ? -0.3 : 0.3) : dy) * k; }
      }
      f.y = clamp(f.y, 34, H - 22);
      if (f.x > PW - 4) { pn.lost++; spawnFine(pn, f); }
    }
    if (pn.kind === 'filter' && pn.fines.every(f => f.state === 'stuck')) {
      // reset slowly so the animation keeps cycling
      pn.hold = (pn.hold || 0) + dt;
      if (pn.hold > 2.5) { pn.hold = 0; pn.cake.fill(0); pn.fines.forEach(f => { spawnFine(pn, f); f.x -= rnd() * 120; }); }
    }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.sheet; ctx.fillRect(0, 0, W, H);
    for (const pn of panels) {
      ctx.save(); ctx.translate(pn.ox, 0);
      ctx.beginPath(); ctx.rect(0, 26, PW, H - 44); ctx.clip();
      // core block
      ctx.fillStyle = C.clay; ctx.globalAlpha = 0.35; ctx.fillRect(0, 26, IF, H - 44); ctx.globalAlpha = 1;
      ctx.fillStyle = C.clay; for (const g of coreGrains) { ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 7); ctx.fill(); }
      // water streaks
      ctx.strokeStyle = C.water; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2;
      for (const s of streaks) { ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 14, s.y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // grains
      ctx.fillStyle = pn.kind === 'rock' ? C.rock : C.filter; ctx.strokeStyle = C.ink2; ctx.lineWidth = 0.8;
      for (const g of pn.grains) { ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 7); ctx.fill(); ctx.stroke(); }
      // fines
      ctx.fillStyle = C.clay; ctx.strokeStyle = C.ink; ctx.lineWidth = 0.6;
      for (const f of pn.fines) { if (f.x < IF - 40) continue; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      // labels
      ctx.save(); ctx.translate(pn.ox, 0);
      ctx.fillStyle = C.ink; ctx.font = '600 15px "Source Sans 3", "Helvetica Neue", sans-serif';
      ctx.fillText(pn.kind === 'rock' ? 'Core against rockfill' : 'Core against a sand filter', 0, 17);
      ctx.font = '12px "Source Sans 3", "Helvetica Neue", sans-serif'; ctx.fillStyle = C.ink2;
      ctx.fillText('Core', 8, H - 6);
      ctx.fillText(pn.kind === 'rock' ? 'Rockfill: voids ≫ core grains' : 'Filter: pores < core grains', IF + 6, H - 6);
      ctx.textAlign = 'right';
      if (pn.kind === 'rock') { ctx.fillStyle = C.bad; ctx.fillText('Core grains lost: ' + pn.lost, PW, 17); }
      else { ctx.fillStyle = C.ok; ctx.fillText('Core grains lost: 0', PW, 17); }
      ctx.restore();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(pn.ox + IF, 26); ctx.lineTo(pn.ox + IF, H - 18); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  for (let i = 0; i < 90; i++) { panels.forEach(pn => stepPanel(pn, 1 / 30)); }
  panels[0].lost = 0;
  draw();
  F.ticks.push((t, dt) => {
    if (RM) return;
    for (const s of streaks) { s.x += s.v * dt; if (s.x > PW) s.x = -14; }
    panels.forEach(pn => stepPanel(pn, dt));
    draw();
  });
})();
