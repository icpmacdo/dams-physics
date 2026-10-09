
/* ===================== Glossary: hover / tap definitions ===================== */
/* Mark a term in the text with <span class="gl" data-term="key">term</span>. Hovering, focusing or
   tapping it shows the plain-language definition below. The glossary list at the end of the page
   (#glossary-list) is generated from the same table, each entry linked to where the term first appears. */
const GLOSSARY = {
  'pore-pressure': ['Pore water pressure', 'The pressure of the water in the gaps between soil grains. Written u. Below the water table it is about 9.8 kPa per metre of depth.'],
  'effective-stress': ['Effective stress', 'The part of the load that the grains carry by pressing on each other: total stress minus pore water pressure (σ′ = σ − u). Soil strength depends on it, so more water pressure means less strength.'],
  'total-stress': ['Total stress', 'The full weight pressing down at a depth: soil, water and anything on top, per square metre. Written σ.'],
  'suction': ['Suction', 'Pore water pressure below atmospheric, in soil that is damp but not saturated. Tiny curved water films between grains pull them together. It is why a sandcastle wall stands.'],
  'permeability': ['Permeability', 'How easily water flows through a soil, measured as hydraulic conductivity k in m/s. It ranges from about 10⁻² m/s for gravel to 10⁻⁹ m/s for compacted clay.'],
  'hydraulic-head': ['Hydraulic head', 'The height water would rise to in a thin tube pushed into the ground at that point. Water always flows from higher head to lower head.'],
  'piezometer': ['Piezometer', 'An instrument that measures water pressure at a point in the ground or in a dam. The simplest is an open tube: the water level in it shows the head.'],
  'phreatic-surface': ['Phreatic surface', 'The water table inside a dam: the surface where the water pressure is zero. Below it the soil is saturated; above it the soil is damp or dry.'],
  'darcy': ['Darcy’s law', 'Flow through soil is proportional to how easily the soil passes water and how steeply the head drops: q = k · i · A.'],
  'hydraulic-gradient': ['Hydraulic gradient', 'How steeply the head drops along the water’s path: head lost per metre travelled (i = Δh / L). Flow is proportional to it, and steeper gradients push loose grains harder.'],
  'angle-of-repose': ['Angle of repose', 'The steepest slope a heap of loose, dry grains settles at. About 34° for most sand.'],
  'water-table': ['Water table', 'The level below which every gap between soil grains is full of water. Dig a hole and water settles at this level.'],
  'liquefaction': ['Liquefaction', 'When loose, saturated soil is sheared or shaken, the grains try to pack tighter, the water can’t escape fast enough, and the water pressure rises until the grains barely touch. The soil flows like a heavy liquid.'],
  'static-liquefaction': ['Static liquefaction', 'Liquefaction with no earthquake: triggered by a rising water level, a small slip, creep, or extra load on loose saturated soil.'],
  'contractive': ['Contractive', 'Describes loose soil that packs tighter when sheared. If the water can’t drain, its pressure rises and the soil weakens.'],
  'dilative': ['Dilative', 'Describes dense soil that has to spread apart to shear, because the grains must climb over each other. If saturated, its water pressure drops and it gets stronger.'],
  'drained': ['Drained', 'Loading slow enough, or soil open enough, that water can flow in or out and the water pressure stays at its normal level.'],
  'undrained': ['Undrained', 'Loading too fast for the water to escape, so the soil can’t change volume and the water pressure changes instead.'],
  'friction-angle': ['Friction angle', 'The steepest slope at which one surface can rest on another without sliding, written φ. Strength = effective stress × tan φ. About 30–40° for sand.'],
  'factor-of-safety': ['Factor of safety', 'The strength available divided by the strength needed to stay put. Below 1 the slope or block moves. Dams are typically designed for about 1.5.'],
  'slip-surface': ['Slip surface', 'The surface along which a slope would slide if it failed. Stability checks search for the one with the lowest factor of safety.'],
  'core': ['Core', 'The low-permeability heart of an embankment dam, usually compacted clay. It takes most of the water’s head loss.'],
  'filter': ['Filter', 'A layer of carefully graded sand that lets water out but stops soil grains from being carried with it.'],
  'shell': ['Shell', 'The outer zones of an embankment, usually rockfill or gravel. They give the dam its weight and stability and drain freely.'],
  'drain': ['Drain', 'A zone of free-draining sand or gravel that collects seepage and keeps the water pressure low where the dam needs its strength.'],
  'seepage': ['Seepage', 'Water flowing slowly through or under a dam. Every dam seeps; what matters is where the water goes and what it carries.'],
  'seepage-face': ['Seepage face', 'The stretch of a slope where water comes out into the open. It softens the soil there.'],
  'piping': ['Piping', 'Erosion in which seepage carries grains out at an exit, and a pipe-like channel works backward toward the reservoir.'],
  'exit-gradient': ['Exit gradient', 'The hydraulic gradient where seepage leaves the ground. If it pushes upward hard enough to lift the grains (about 1.0), the sand boils.'],
  'critical-gradient': ['Critical gradient', 'The upward gradient at which flowing water carries the full weight of the grains, about 1.0 for sand. Effective stress becomes zero and the sand boils.'],
  'uplift': ['Uplift', 'Water pressure under a concrete dam pushing it upward, which cancels part of its weight.'],
  'tailings': ['Tailings', 'The waste left after a mill extracts metal from ore: rock ground finer than flour, pumped out as a slurry with water.'],
  'beach': ['Beach', 'The gently sloping deposit of tailings sand between the dam crest and the pond.'],
  'upstream-raise': ['Upstream raise', 'Raising a tailings dam by building each new dyke on the tailings beach, so the crest steps toward the pond.'],
  'hydrostatic': ['Hydrostatic pressure', 'The pressure in still water, p = ρgh: it depends only on depth, about 9.8 kPa per metre.']
};

(function glossary() {
  const tip = document.createElement('div');
  tip.className = 'gl-tip'; tip.id = 'gl-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  let cur = null, hideT = 0;
  function show(el) {
    const g = GLOSSARY[el.dataset.term];
    if (!g) return;
    clearTimeout(hideT);
    cur = el;
    tip.innerHTML = '';
    const b = document.createElement('b'); b.textContent = g[0];
    const p = document.createElement('span'); p.textContent = g[1];
    tip.append(b, p);
    tip.hidden = false;
    const r = el.getBoundingClientRect(), tw = Math.min(320, window.innerWidth - 32);
    tip.style.width = tw + 'px';
    const left = clamp(r.left + r.width / 2 - tw / 2, 16, window.innerWidth - tw - 16);
    const th = tip.offsetHeight;
    const below = r.bottom + 8 + th < window.innerHeight;
    tip.style.left = left + 'px';
    tip.style.top = (below ? r.bottom + 8 : r.top - th - 8) + 'px';
    el.setAttribute('aria-describedby', 'gl-tip');
  }
  function hide(now) {
    clearTimeout(hideT);
    hideT = setTimeout(() => { tip.hidden = true; if (cur) cur.removeAttribute('aria-describedby'); cur = null; }, now ? 0 : 120);
  }
  function wire(root) {
    $$('.gl[data-term]', root).forEach(el => {
      if (el.dataset.glWired) return;
      el.dataset.glWired = '1';
      if (!GLOSSARY[el.dataset.term]) { el.classList.add('gl-missing'); return; }
      el.tabIndex = 0;
      el.addEventListener('mouseenter', () => show(el));
      el.addEventListener('mouseleave', () => hide());
      el.addEventListener('focus', () => show(el));
      el.addEventListener('blur', () => hide());
      el.addEventListener('click', e => { e.preventDefault(); cur === el && !tip.hidden ? hide(true) : show(el); });
    });
  }
  wire(document);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(true); });
  window.addEventListener('scroll', () => { if (!tip.hidden) hide(true); }, { passive: true });

  // the glossary list: every term, alphabetical, linked to its first appearance
  const list = $('#glossary-list');
  if (list) {
    const first = {};
    $$('.gl[data-term]').forEach((el, i) => {
      const k = el.dataset.term;
      if (first[k]) return;
      if (!el.id) el.id = 'gl-' + k;
      const sec = el.closest('section[id]');
      const no = sec && sec.querySelector('.sheetno');
      first[k] = { id: el.id, where: no ? no.textContent.trim() : '' };
    });
    Object.keys(GLOSSARY).sort((a, b) => GLOSSARY[a][0].localeCompare(GLOSSARY[b][0])).forEach(k => {
      const g = GLOSSARY[k];
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = g[0];
      dd.textContent = g[1] + ' ';
      if (first[k]) {
        const a = document.createElement('a');
        a.href = '#' + first[k].id; a.textContent = first[k].where ? 'First met in ' + first[k].where : 'First use';
        dd.appendChild(a);
      }
      list.append(dt, dd);
    });
  }
})();
