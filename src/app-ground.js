
/* ===================== Groundwork: Steps 1–4 ===================== */

/* Predict widget (declarative, used by every part of the page).
   <div class="predict" data-answer="b" [data-unlocks="#id, #id2"]>
     <p class="predict-q">…</p> [anything else, e.g. a small drawing]
     <div class="predict-opts"><button data-v="a">…</button>…</div>
     <div class="predict-reveal" hidden>…explanation…</div>
   </div>
   On a choice (or "Skip"), the options lock, the chosen one is marked, the answer is marked,
   a one-line verdict is added to the top of the reveal, the reveal opens, and every element
   named in data-unlocks is un-hidden. Fires a bubbling 'predict' event with
   detail { id, choice, answer, correct }. Call groundPredictInit(root) for markup added later. */
function groundPredictInit(root) {
  $$('.predict', root).forEach(el => {
    if (el.dataset.ready) return;
    el.dataset.ready = '1';
    const optsBox = $('.predict-opts', el);
    const reveal = $('.predict-reveal', el);
    if (!optsBox) return;
    const answer = el.dataset.answer;
    const opts = $$('button', optsBox);
    const text = new Map();
    opts.forEach((b, i) => {
      b.type = 'button';
      text.set(b, b.textContent.trim());
      const key = document.createElement('span');
      key.className = 'predict-key'; key.setAttribute('aria-hidden', 'true');
      key.textContent = String.fromCharCode(65 + i);
      const lab = document.createElement('span');
      lab.className = 'predict-txt';
      while (b.firstChild) lab.appendChild(b.firstChild);
      b.append(key, lab);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => settle(b));
    });
    optsBox.setAttribute('role', 'group');
    const q = $('.predict-q', el);
    if (q) { if (!q.id) q.id = (el.id || 'pr-' + Math.random().toString(36).slice(2, 8)) + '-q'; optsBox.setAttribute('aria-labelledby', q.id); }
    const foot = document.createElement('div');
    foot.className = 'predict-foot';
    const hint = document.createElement('span');
    hint.textContent = 'Make a guess, then see.';
    const skip = document.createElement('button');
    skip.type = 'button'; skip.className = 'predict-skip'; skip.textContent = 'Skip, just show me';
    skip.addEventListener('click', () => settle(null));
    foot.append(hint, skip);
    optsBox.after(foot);
    if (reveal) reveal.setAttribute('aria-live', 'polite');
    const ansBtn = opts.find(b => b.dataset.v === answer);
    function settle(choice) {
      if (el.classList.contains('is-done')) return;
      const correct = !!choice && choice === ansBtn;
      el.classList.add('is-done', correct ? 'is-right' : choice ? 'is-wrong' : 'is-skipped');
      opts.forEach(b => {
        b.setAttribute('aria-disabled', 'true');
        b.setAttribute('aria-pressed', b === choice ? 'true' : 'false');
        b.classList.toggle('is-chosen', b === choice);
        b.classList.toggle('is-answer', b === ansBtn);
      });
      foot.remove();
      if (reveal) {
        const v = document.createElement('p');
        v.className = 'predict-verdict';
        const letter = ansBtn ? String.fromCharCode(65 + opts.indexOf(ansBtn)) : '';
        const ansTxt = ansBtn ? text.get(ansBtn).replace(/[.]$/, '') : '';
        v.textContent = correct ? 'Your guess was right.' : (choice ? 'Not this time. The answer is ' : 'The answer is ') + (correct ? '' : letter + ': ' + ansTxt + '.');
        reveal.prepend(v);
        reveal.hidden = false;
      }
      (el.dataset.unlocks || '').split(',').map(s => s.trim()).filter(Boolean).forEach(sel => {
        $$(sel).forEach(t => { t.hidden = false; t.classList.remove('predict-locked'); t.classList.add('predict-unlocked'); });
      });
      el.dispatchEvent(new CustomEvent('predict', { bubbles: true, detail: { id: el.id, choice: choice ? choice.dataset.v : null, answer, correct } }));
    }
  });
}

(function ground() {
  // run after every other part has built its markup (all scripts run at the end of the body)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => groundPredictInit());
  else setTimeout(() => groundPredictInit(), 0);

  const setTxt = (id, s) => { const e = document.getElementById(id); if (e && e.textContent !== s) e.textContent = s; };
  const deg = Math.PI / 180;
  function svgXY(svg, ev) {
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }
  // drag helper: a handle element; onMove gets svg coords
  function dragHandle(svg, handle, onMove) {
    handle.style.cursor = 'ns-resize';
    handle.style.touchAction = 'none';
    handle.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      handle.setPointerCapture(ev.pointerId);
      const mv = e => onMove(svgXY(svg, e));
      const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); };
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
      onMove(svgXY(svg, ev));
    });
  }
  function arrow(g, x1, y1, x2, y2, style, marker) {
    return E('path', { d: `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`, style, 'marker-end': `url(#${marker})` }, g);
  }
  function setArrow(p, x1, y1, x2, y2) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    p.setAttribute('d', `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`);
    p.style.display = len < 3 ? 'none' : '';
  }
  function pattern(defs, id, w, h, fillVar, dots) {
    const p = E('pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse' }, defs);
    E('rect', { width: w, height: h, style: `fill:var(${fillVar})` }, p);
    for (const d of dots) E('circle', { class: d[3] || 'txf', cx: d[0], cy: d[1], r: d[2] }, p);
    return p;
  }

  /* ===================== Fig 1.1 · the beach ===================== */
  (function figBeach() {
    const el = $('#fig-beach'); if (!el) return;
    const F = fig(el);
    const svg = $('#svg-beach');
    const GY = 214, CX = 240, NC = 241, DX = 2; // ground line, centre, columns every 2 px from x=0
    const defs = E('defs', null, svg);
    pattern(defs, 'gp-damp', 7, 7, '--m-trans', [[2, 2, 0.7], [5.5, 5, 0.7]]);
    const clip = E('clipPath', { id: 'gb-clip' }, defs);
    const clipPath = E('path', null, clip);
    // the beach under the heap
    const gRoot = E('g', null, svg);
    E('rect', { x: -20, y: GY, width: 520, height: 40, fill: 'url(#p-cyclone)' }, gRoot); // overhang hidden by svg overflow
    const groundWet = E('rect', { x: -20, y: GY, width: 520, height: 40, class: 'sat', opacity: 0 }, gRoot);
    E('path', { d: `M-20,${GY} H500`, class: 'edge' }, gRoot);
    const puddle = E('rect', { x: -20, y: GY - 5, width: 520, height: 5, class: 'water', opacity: 0 }, gRoot);
    // flag (behind the sand, so a sunk flag disappears into it)
    const flag = E('g', null, gRoot);
    E('path', { d: 'M0,0 V-44', style: 'stroke:var(--ink);stroke-width:1.6' }, flag);
    E('path', { d: 'M0,-44 L20,-38 L0,-31 z', style: 'fill:var(--accent)' }, flag);
    // sand heap: dry colour, damp colour cross-fading on top, water tint, wet shine
    const sandDry = E('path', { fill: 'url(#p-cyclone)' }, gRoot);
    const sandDamp = E('path', { fill: 'url(#gp-damp)' }, gRoot);
    const wet = E('rect', { x: 0, y: 0, width: 480, height: GY, class: 'sat', 'clip-path': 'url(#gb-clip)', opacity: 0 }, gRoot);
    const outline = E('path', { class: 'edge', style: 'fill:none' }, gRoot);
    const shine = E('path', { class: 'water-line', opacity: 0 }, gRoot);
    // angle marker
    const gAng = E('g', null, gRoot);
    const angArc = E('path', { style: 'stroke:var(--accent);stroke-width:1.4;fill:none' }, gAng);
    const angTxt = T(gAng, 0, 0, '', 'lbl lbl-acc halo');
    const caption = T(gRoot, 16, 26, '', 'lbl-b');
    const sub = T(gRoot, 16, 44, '', 'lbl-s');
    // scale bar: 5 px per cm
    E('path', { d: `M452,${GY - 150} v150 M447,${GY - 150} h10 M447,${GY} h10`, class: 'dim' }, gRoot);
    T(gRoot, 446, GY - 72, '30 cm', 'lbl-s halo', { 'text-anchor': 'end' });

    const xs = Array.from({ length: NC }, (_, i) => i * DX);
    const tan34 = Math.tan(34 * deg), tanSat = Math.tan(19 * deg);
    const damp = xs.map(x => { const d = Math.abs(x - CX); if (d > 50) return 0; return (d > 12 && d < 30) ? 128 : 146; });
    const A = damp.reduce((s, h) => s + h * DX, 0);
    const cone = (tn) => { const H = Math.sqrt(A * tn / 1); /* area of a cone section = H²/tan */ return xs.map(x => Math.max(0, H - Math.abs(x - CX) * tn)); };
    const dry = cone(tan34), sat = cone(tanSat);
    const flat = (() => { const raw = xs.map(x => { const d = Math.abs(x - CX); return clamp((214 - d) / 24, 0, 1); }); const s = raw.reduce((a, h) => a + h * DX, 0); return raw.map(h => h * A / s); })();
    const PROF = { dry, damp, sat, flat };
    const SLOPE = { dry: ['34°', 'the angle of repose'], damp: ['90°', 'a vertical wall'], sat: ['about 19°', 'while it is left alone'], flat: ['about 0°', 'it flowed flat'] };
    const GAP = { dry: ['Air', 'nothing holds the grains together'], damp: ['Air + water', 'rings of water where grains touch'], sat: ['Water', 'every gap is full'], flat: ['Water', 'the grains are floating apart'] };
    const CAP = { dry: ['Dry sand', 'pours into a cone'], damp: ['Damp sand', 'stands in a vertical wall'], sat: ['Saturated sand', 'slumps to a low mound'], flat: ['Saturated, jiggled', 'flows like a liquid, and the flag sinks'] };

    let mode = 'damp', key = 'damp', shakeT = 0, lastEvent = 'Reader is looking at damp sand.';
    const cur = damp.slice();
    let wetO = 0, dampO = 1, sink = 0, tilt = 0, settle = 1;
    const seg = segGroup($('#bc-state'), v => { mode = v; key = v; lastEvent = 'Reader switched to ' + (v === 'sat' ? 'saturated' : v) + ' sand.'; if (RM) snap(); update(); });
    void seg;
    $('#bc-jiggle').addEventListener('click', () => {
      shakeT = 1.4;
      if (mode === 'sat') { key = 'flat'; lastEvent = 'Reader jiggled the saturated heap: it flowed flat and the flag sank.'; }
      else lastEvent = 'Reader jiggled the ' + mode + ' heap: it kept its shape (' + (mode === 'dry' ? '34° slope' : 'vertical walls') + ').';
      if (RM) { shakeT = 0; snap(); }
      update();
    });
    function targets() {
      return { wet: (key === 'sat' || key === 'flat') ? 1 : 0, damp: key === 'dry' ? 0 : 1, sink: key === 'flat' ? 26 : 0, tilt: key === 'flat' ? 22 : 0 };
    }
    function snap() { const t = targets(), p = PROF[key]; for (let i = 0; i < NC; i++) cur[i] = p[i]; wetO = t.wet; dampO = t.damp; sink = t.sink; tilt = t.tilt; draw(0); }
    function update() {
      setTxt('bc-slope', SLOPE[key][0]); setTxt('bc-slope2', SLOPE[key][1]);
      setTxt('bc-gap', GAP[key][0]); setTxt('bc-gap2', GAP[key][1]);
      caption.textContent = CAP[key][0]; sub.textContent = CAP[key][1];
      drawZoom();
    }
    function draw(dx) {
      let d = `M-20,${GY} L0,${GY}`;
      for (let i = 0; i < NC; i++) d += `L${xs[i]},${(GY - cur[i]).toFixed(1)}`;
      d += `L500,${GY} Z`;
      sandDry.setAttribute('d', d); sandDamp.setAttribute('d', d); clipPath.setAttribute('d', d); outline.setAttribute('d', d);
      let top = 'M';
      for (let i = 0; i < NC; i++) if (cur[i] > 0.5) top += `${xs[i]},${(GY - cur[i]).toFixed(1)}L`;
      shine.setAttribute('d', top.length > 2 ? top.slice(0, -1) : '');
      sandDamp.setAttribute('opacity', dampO.toFixed(2));
      wet.setAttribute('opacity', wetO.toFixed(2)); shine.setAttribute('opacity', (wetO * 0.8).toFixed(2));
      groundWet.setAttribute('opacity', wetO.toFixed(2)); puddle.setAttribute('opacity', wetO.toFixed(2));
      const ci = Math.round(CX / DX), hTop = cur[ci];
      flag.setAttribute('transform', `translate(${CX + 3},${(GY - hTop + sink).toFixed(1)}) rotate(${tilt.toFixed(1)})`);
      gRoot.setAttribute('transform', dx ? `translate(${dx.toFixed(2)},0)` : '');
      // angle marker once the shape has settled
      gAng.style.opacity = settle > 0.97 ? 1 : 0;
      if (key === 'dry' || key === 'sat') {
        const tn = key === 'dry' ? tan34 : tanSat, H = PROF[key][ci], x0 = CX - H / tn, r = 34;
        const a = Math.atan(tn);
        angArc.setAttribute('d', `M${x0 + r},${GY} A${r},${r} 0 0 0 ${(x0 + r * Math.cos(a)).toFixed(1)},${(GY - r * Math.sin(a)).toFixed(1)}`);
        angTxt.setAttribute('x', (x0 + r + 6).toFixed(1)); angTxt.setAttribute('y', GY - 6); angTxt.setAttribute('text-anchor', 'start');
        angTxt.textContent = key === 'dry' ? '34°' : '≈19°';
      } else if (key === 'damp') {
        const x0 = CX - 51;
        angArc.setAttribute('d', `M${x0 - 12},${GY} h-0 M${x0 - 12},${GY} v-12 h12`);
        angTxt.setAttribute('x', x0 - 16); angTxt.setAttribute('y', GY - 16); angTxt.setAttribute('text-anchor', 'end');
        angTxt.textContent = '90°';
      } else { angArc.setAttribute('d', ''); angTxt.textContent = ''; }
    }
    // close-up of seven grains
    const zs = $('#svg-beach-zoom');
    const zclip = E('clipPath', { id: 'gb-zclip' }, E('defs', null, zs));
    E('rect', { x: 0, y: 0, width: 220, height: 150, rx: 6 }, zclip);
    const zg = E('g', { 'clip-path': 'url(#gb-zclip)' }, zs);
    const zbg = E('rect', { x: 0, y: 0, width: 220, height: 150, style: 'fill:var(--sheet)' }, zg);
    const zwater = E('rect', { x: 0, y: 0, width: 220, height: 150, class: 'water', opacity: 0 }, zg);
    const zbr = E('g', null, zg);
    const R = 24, S = 48.4;
    const C = [];
    for (let r = -1; r <= 2; r++) for (let c = -1; c <= 4; c++) C.push([12 + c * S + (r % 2 ? S / 2 : 0), 28 + r * S * 0.866]);
    for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
      const d = Math.hypot(C[i][0] - C[j][0], C[i][1] - C[j][1]);
      if (d < S + 1) { // a water ring (meniscus) where two grains touch
        const ux = (C[j][0] - C[i][0]) / d, uy = (C[j][1] - C[i][1]) / d, al = 38 * deg;
        const L = (x, y) => [C[i][0] + ux * x - uy * y, C[i][1] + uy * x + ux * y];
        const a = R * Math.cos(al), b = R * Math.sin(al), m = d / 2;
        const p = [L(a, b), L(m, b * 0.42), L(d - a, b), L(d - a, -b), L(m, -b * 0.42), L(a, -b)];
        E('path', { d: `M${p[0]}Q${p[1]} ${p[2]}L${p[3]}Q${p[4]} ${p[5]}Z`, class: 'water' }, zbr);
      }
    }
    for (const c of C) E('circle', { cx: c[0], cy: c[1], r: R, style: 'fill:var(--m-tsand);stroke:var(--ink-2);stroke-width:1' }, zg);
    E('rect', { x: 0.5, y: 0.5, width: 219, height: 149, rx: 6, style: 'fill:none;stroke:var(--rule)' }, zs);
    const ZN = { dry: 'Close-up: the gaps hold only air. Each grain rests on its neighbours.', damp: 'Close-up: a little water gathers in rings where the grains touch.', sat: 'Close-up: water fills every gap between the grains.', flat: 'Close-up: water fills every gap, and the grains barely press on each other.' };
    function drawZoom() {
      zbr.style.opacity = key === 'damp' ? 1 : 0;
      zwater.setAttribute('opacity', key === 'sat' || key === 'flat' ? 1 : 0);
      setTxt('bc-zoom-note', ZN[key]);
      void zbg;
    }
    update(); draw(0);
    F.ticks.push((t, dt) => {
      const p = PROF[key], tg = targets();
      const rate = key === 'flat' ? 1.6 : 3.2;
      const k = Math.min(1, dt * rate);
      let err = 0;
      for (let i = 0; i < NC; i++) err = Math.max(err, Math.abs(p[i] - cur[i]));
      if (key === 'sat' || key === 'flat') { // wet sand slumps and spreads: a little diffusion makes it flow
        const it = Math.round(clamp(err, 0, 40) / 4);
        for (let r = 0; r < it; r++) for (let i = 1; i < NC - 1; i++) cur[i] += 0.12 * (cur[i - 1] + cur[i + 1] - 2 * cur[i]);
      }
      err = 0;
      for (let i = 0; i < NC; i++) { cur[i] += (p[i] - cur[i]) * k; err = Math.max(err, Math.abs(p[i] - cur[i])); }
      wetO += (tg.wet - wetO) * Math.min(1, dt * 4); dampO += (tg.damp - dampO) * Math.min(1, dt * 4);
      sink += (tg.sink - sink) * k; tilt += (tg.tilt - tilt) * k;
      settle = err < 1.5 ? 1 : 0;
      let dx = 0;
      if (shakeT > 0) { shakeT = Math.max(0, shakeT - dt); dx = 3.2 * Math.sin(t * 52) * Math.min(1, shakeT / 0.4); }
      if (err > 0.05 || dx || shakeT > 0 || Math.abs(tg.wet - wetO) > 0.005) draw(dx);
    });
    tutorRegister('fig-beach', {
      title: 'The same sand, three ways (Fig. 1.1)',
      describe: () => [
        'Sand state: ' + CAP[key][0] + ' (' + CAP[key][1] + ').',
        'Steepest slope it holds: ' + SLOPE[key][0] + ', ' + SLOPE[key][1] + '.',
        'In the gaps between grains: ' + GAP[key][0] + ', ' + GAP[key][1] + '.',
        lastEvent
      ].join('\n')
    });
  })();

  /* ===================== Fig 2.1 · pressure with depth ===================== */
  (function figDepth() {
    const el = $('#fig-depth'); if (!el) return;
    fig(el);
    const svg = $('#svg-depth');
    const B = 350, K = 3, FX = 330, XL = 12; // bed, px per metre, dam face x, left edge
    const g = E('g', null, svg);
    const water = E('rect', { x: XL, width: FX - XL, class: 'water' }, g);
    const surf = E('path', { class: 'water-line' }, g);
    const wsym = E('g', null, g);
    E('polygon', { points: P([[FX, B - 106 * K], [FX + 22, B - 106 * K], [FX + 22, B - 86 * K], [470, B], [FX, B]]), style: 'fill:var(--m-conc)', class: 'edge' }, g);
    T(g, FX + 40, B - 150, 'Dam', 'lbl-b halo');
    E('rect', { x: 0, y: B, width: 480, height: 40, fill: 'url(#p-bedrock)', class: 'edge' }, g);
    // depth ruler
    const ruler = E('g', null, g);
    // pressure triangle
    const tri = E('polygon', { style: 'fill:var(--accent-soft);stroke:var(--accent);stroke-width:1' }, g);
    const arrows = E('g', null, g);
    const hot = arrow(g, 0, 0, 0, 0, 'stroke:var(--accent);stroke-width:2.6;fill:none', 'arr-acc');
    const triLbl = T(g, 0, 0, '', 'lbl-s lbl-acc halo', { 'text-anchor': 'end' });
    // sensor on a cable
    const SX = 92;
    const cable = E('path', { style: 'stroke:var(--ink);stroke-width:1;fill:none' }, g);
    const sensor = E('g', null, g);
    E('rect', { x: -7, y: -9, width: 14, height: 18, rx: 3, style: 'fill:var(--sheet);stroke:var(--ink);stroke-width:1.4' }, sensor);
    E('circle', { cx: 0, cy: 3, r: 2.4, style: 'fill:var(--accent)' }, sensor);
    const hit = E('circle', { r: 22, style: 'fill:transparent' }, sensor);
    const sL1 = T(g, 0, 0, '', 'lbl halo'), sL2 = T(g, 0, 0, '', 'lbl lbl-acc halo');
    const HEl = $('#dp-H'), hEl = $('#dp-h');
    let H = +HEl.value, h = +hEl.value;
    function render() {
      const ys = B - H * K;
      water.setAttribute('y', ys); water.setAttribute('height', H * K);
      surf.setAttribute('d', `M${XL},${ys} H${FX}`);
      wsym.textContent = ''; waterSymbol(wsym, 200, ys);
      ruler.textContent = '';
      for (let d = 10; d <= H; d += 10) {
        const y = ys + d * K;
        E('path', { d: `M${XL},${y} h7`, style: 'stroke:var(--water);stroke-width:1' }, ruler);
        if (d % 20 === 0 || H <= 40) T(ruler, XL + 10, y + 3.5, d + ' m', 'lbl-s lbl-w');
      }
      const kp = 1.9; // px of arrow per metre of depth
      tri.setAttribute('points', P([[FX, ys], [FX, B], [FX - kp * H, B]]));
      arrows.textContent = '';
      for (let d = 10; d < H; d += 10) {
        const y = ys + d * K, len = kp * d;
        if (len > 8) arrow(arrows, FX - len, y, FX - 2, y, 'stroke:var(--accent);stroke-width:0.9;fill:none;opacity:.7', 'arr-acc');
      }
      triLbl.setAttribute('x', FX - kp * H - 4); triLbl.setAttribute('y', B - 6);
      triLbl.textContent = H >= 25 ? fmt(9.81 * H) + ' kPa' : '';
      const y = ys + h * K;
      setArrow(hot, FX - kp * h, y, FX - 2, y);
      cable.setAttribute('d', `M${SX},${ys - 10} V${y - 9}`);
      sensor.setAttribute('transform', `translate(${SX},${y})`);
      const p = 9.81 * h;
      sL1.setAttribute('x', SX + 14); sL1.setAttribute('y', y - 2); sL1.textContent = 'h = ' + n1(h) + ' m';
      sL2.setAttribute('x', SX + 14); sL2.setAttribute('y', y + 12); sL2.textContent = 'p = ' + fmt(p) + ' kPa';
      const F = 0.5 * 9.81 * H * H; // kN per m
      setTxt('dp-H-o', H + ' m'); setTxt('dp-h-o', n1(h) + ' m');
      setTxt('dp-p', fmt(p) + ' kPa'); setTxt('dp-p2', '9.81 × ' + n1(h) + ' m');
      setTxt('dp-pb', fmt(9.81 * H) + ' kPa'); setTxt('dp-pb2', '9.81 × ' + H + ' m');
      setTxt('dp-F', (F >= 1000 ? (F / 1000).toFixed(F >= 10000 ? 1 : 2) + ' MN' : fmt(F) + ' kN'));
      setTxt('dp-F2', 'as heavy as ' + fmt(Math.round(F / 9.81 / (F > 2000 ? 10 : 1)) * (F > 2000 ? 10 : 1)) + ' tonnes');
      chart();
    }
    HEl.addEventListener('input', () => { H = +HEl.value; hEl.max = H; h = Math.min(h, H); hEl.value = h; render(); });
    hEl.addEventListener('input', () => { h = +hEl.value; render(); });
    dragHandle(svg, hit, ([, y]) => { h = clamp(Math.round(((y - (B - H * K)) / K) * 2) / 2, 0, H); hEl.value = h; render(); });
    // chart: push against depth
    const cs = $('#svg-depth-chart');
    const cx0 = 46, cx1 = 290, cy0 = 164, cy1 = 18;
    const X = d => cx0 + (cx1 - cx0) * d / 100, Y = f => cy0 - (cy0 - cy1) * f / 50;
    const cg = E('g', null, cs);
    for (let f = 0; f <= 50; f += 10) { E('path', { d: `M${cx0},${Y(f)} H${cx1}`, style: 'stroke:var(--rule);stroke-width:0.7' }, cg); T(cg, cx0 - 6, Y(f) + 3.5, f, 'lbl-s', { 'text-anchor': 'end' }); }
    for (let d = 0; d <= 100; d += 25) T(cg, X(d), cy0 + 15, d, 'lbl-s', { 'text-anchor': 'middle' });
    T(cg, (cx0 + cx1) / 2, cy0 + 31, 'water depth H (m)', 'lbl-s', { 'text-anchor': 'middle' });
    T(cg, cx0 - 6, 9, 'push (MN per metre of dam)', 'lbl-s');
    const pts = []; for (let d = 0; d <= 100; d += 2) pts.push([X(d), Y(0.5 * 9.81 * d * d / 1000)]);
    E('path', { d: D(pts), style: 'stroke:var(--ink);stroke-width:1.6;fill:none' }, cg);
    const guide = E('path', { style: 'stroke:var(--ink-3);stroke-width:0.9;stroke-dasharray:3 3;fill:none' }, cg);
    const halfDot = E('circle', { r: 3.5, style: 'fill:var(--sheet);stroke:var(--ink-2);stroke-width:1.4' }, cg);
    const dot = E('circle', { r: 4.5, style: 'fill:var(--accent)' }, cg);
    const cLbl = T(cg, 0, 0, '', 'lbl lbl-acc halo'), hLbl = T(cg, 0, 0, '', 'lbl-s halo');
    function chart() {
      const f = 0.5 * 9.81 * H * H / 1000, fh = f / 4;
      dot.setAttribute('cx', X(H)); dot.setAttribute('cy', Y(f));
      halfDot.setAttribute('cx', X(H / 2)); halfDot.setAttribute('cy', Y(fh));
      guide.setAttribute('d', `M${X(H)},${cy0} V${Y(f)} H${cx0} M${X(H / 2)},${cy0} V${Y(fh)} H${cx0}`);
      const left = X(H) > 150; // label above-left of the dot, where the curve leaves room
      cLbl.setAttribute('x', X(H) + (left ? -9 : 9)); cLbl.setAttribute('y', Y(f) - (left ? 4 : 10)); cLbl.setAttribute('text-anchor', left ? 'end' : 'start');
      cLbl.textContent = (f < 10 ? f.toFixed(1) : Math.round(f)) + ' MN at ' + H + ' m';
      hLbl.setAttribute('x', X(H / 2) + 8); hLbl.setAttribute('y', Y(fh) + 14);
      hLbl.textContent = 'half the depth: ¼ the push';
      hLbl.style.display = H >= 30 ? '' : 'none';
    }
    render();
    tutorRegister('fig-depth', {
      title: 'Water pressure on a dam face (Fig. 2.1)',
      describe: () => {
        const F = 0.5 * 9.81 * H * H / 1000;
        return ['Water depth at the dam H = ' + H + ' m. Sensor at depth h = ' + n1(h) + ' m.',
          'Pressure at the sensor: 9.81 × ' + n1(h) + ' = ' + fmt(9.81 * h) + ' kPa. At the foot of the dam: ' + fmt(9.81 * H) + ' kPa.',
          'Total push on each metre of dam: ½ × 9.81 × H² = ' + F.toFixed(1) + ' MN (half this depth would give ' + (F / 4).toFixed(1) + ' MN).'].join('\n');
      }
    });
  })();

  /* ===================== Fig 3.1 · the permeability race ===================== */
  const MATS = {
    gravel: { name: 'Gravel', k: 1e-2, n: 0.30, kTxt: '10⁻² m/s', pat: 'p-drain' },
    sand: { name: 'Sand', k: 1e-4, n: 0.35, kTxt: '10⁻⁴ m/s', pat: 'p-filter' },
    silt: { name: 'Silt', k: 1e-7, n: 0.40, kTxt: '10⁻⁷ m/s', pat: 'p-slime' },
    clay: { name: 'Clay', k: 1e-9, n: 0.35, kTxt: '10⁻⁹ m/s', pat: 'p-clay' }
  };
  function fmtDur(s) {
    if (s < 1) return '0 s';
    if (s < 90) return Math.round(s) + ' s';
    if (s < 3600) return Math.round(s / 60) + ' min';
    if (s < 86400 * 1.5) { const h = s / 3600; return (h < 10 ? h.toFixed(1) : Math.round(h)) + ' h'; }
    if (s < 86400 * 60) return Math.round(s / 86400) + ' days';
    if (s < 86400 * 365) return Math.round(s / 86400 / 7) + ' weeks';
    const y = s / 86400 / 365.25; return (y < 10 ? y.toFixed(1) : Math.round(y)) + ' years';
  }
  (function figRace() {
    const el = $('#fig-race'); if (!el) return;
    const F = fig(el);
    const svg = $('#svg-race');
    const g = E('g', null, svg);
    const keys = ['gravel', 'sand', 'silt', 'clay'];
    const CW = 84, X0s = [20, 134, 248, 362], YT = 58, CH = 210;
    const cols = keys.map((k, i) => {
      const m = MATS[k], x = X0s[i];
      m.t = m.n * 1 / (m.k * 1); // seconds to cross 1 m at gradient 1
      E('rect', { x, y: YT - 26, width: CW, height: 26, class: 'water' }, g);
      E('path', { d: `M${x},${YT - 26} h${CW}`, class: 'water-line' }, g);
      E('rect', { x, y: YT, width: CW, height: CH, fill: `url(#${m.pat})` }, g);
      const wetR = E('rect', { x, y: YT, width: CW, height: 0, class: 'sat', style: 'opacity:.9' }, g);
      const front = E('path', { style: 'stroke:var(--water);stroke-width:2;fill:none' }, g);
      E('rect', { x, y: YT - 26, width: CW, height: CH + 26, class: 'edge', style: 'fill:none' }, g);
      E('path', { d: `M${x},${YT + CH} h${CW}`, style: 'stroke:var(--ink);stroke-width:1;stroke-dasharray:3 2' }, g);
      const drip = E('circle', { cx: x + CW / 2, cy: YT + CH + 8, r: 3, class: 'particle', opacity: 0 }, g);
      T(g, x + CW / 2, YT + CH + 26, m.name, 'lbl-b', { 'text-anchor': 'middle' });
      T(g, x + CW / 2, YT + CH + 40, m.kTxt, 'lbl-s', { 'text-anchor': 'middle' });
      const tl = T(g, x + CW / 2, YT + CH + 54, '…', 'lbl lbl-acc', { 'text-anchor': 'middle' });
      return { k, m, x, wetR, front, drip, tl };
    });
    T(g, 14, 18, '1 m of each, head difference 1 m across it', 'lbl-s');
    // log time axis
    const AX0 = 26, AX1 = 456, AY = 360;
    const LX = lt => AX0 + (AX1 - AX0) * lt / 9;
    E('path', { d: `M${AX0},${AY} H${AX1}`, style: 'stroke:var(--ink);stroke-width:1' }, g);
    const ticks = [[0, '1 s'], [Math.log10(60), '1 min'], [Math.log10(3600), '1 h'], [Math.log10(86400), '1 day'], [Math.log10(86400 * 30.4), '1 month'], [Math.log10(86400 * 365.25), '1 yr']];
    for (const [lt, s] of ticks) { E('path', { d: `M${LX(lt)},${AY} v5`, style: 'stroke:var(--ink);stroke-width:1' }, g); T(g, LX(lt), AY + 17, s, 'lbl-s', { 'text-anchor': 'middle' }); }
    T(g, AX0, AY + 34, 'time (log scale: each step is ×10)', 'lbl-s');
    const marks = cols.map(c => {
      const x = LX(Math.log10(c.m.t));
      const gm = E('g', { opacity: 0.35 }, g);
      E('circle', { cx: x, cy: AY, r: 4, style: 'fill:var(--water)' }, gm);
      T(gm, x, AY - 9, c.m.name, 'lbl-s', { 'text-anchor': 'middle' });
      return gm;
    });
    const cursor = E('path', { style: 'stroke:var(--accent);stroke-width:2' }, g);
    let lt = 0;
    const timeOf = v => v <= 0 ? 0 : Math.pow(10, v);
    function render(v) {
      lt = v;
      const s = timeOf(v);
      let done = 0;
      cols.forEach((c, i) => {
        const f = clamp(s / c.m.t, 0, 1);
        const y = YT + CH * f;
        c.wetR.setAttribute('height', (CH * f).toFixed(1));
        c.front.setAttribute('d', f > 0.002 && f < 1 ? `M${c.x},${y.toFixed(1)} h${CW}` : '');
        c.drip.setAttribute('opacity', f >= 1 ? 1 : 0);
        c.tl.textContent = f >= 1 ? fmtDur(c.m.t) : '…';
        marks[i].setAttribute('opacity', f >= 1 ? 1 : 0.3);
        if (f >= 1) done++;
      });
      cursor.setAttribute('d', `M${LX(v)},${AY - 6} v12`);
      const t = fmtDur(s);
      setTxt('rc-t-o', t); setTxt('rc-clock', t);
      setTxt('rc-clock2', v <= 0 ? 'press start' : 'clock is running ' + fmt(Math.pow(10, Math.max(0, v - 0.5))) + '× faster');
      setTxt('rc-done', done === 0 ? 'None' : done === 4 ? 'All four' : cols.slice(0, done).map(c => c.m.name).join(', '));
      setTxt('rc-done2', done === 4 ? 'clay took ' + fmtDur(cols[3].m.t) : done + ' of four');
    }
    const player = Player({ max: 9, dur: 10, btn: $('#rc-play'), slider: $('#rc-t'), onUpdate: render, playText: 'Start the race', replayText: 'Run again' });
    render(0);
    F.ticks.push((t, dt) => player.tick(dt));
    F.onFirst = () => { if (RM) player.set(9); };
    tutorRegister('fig-race', {
      title: 'Permeability race through 1 m of gravel, sand, silt and clay (Fig. 3.1)',
      describe: () => {
        const s = timeOf(lt);
        return ['Clock (log scale): ' + fmtDur(s) + ' elapsed.',
          'Crossing times for 1 m at a gradient of 1 (time = porosity × length ÷ (k × gradient)): ' + cols.map(c => c.m.name + ' (k ' + c.m.k.toExponential(0) + ' m/s) ' + fmtDur(c.m.t)).join('; ') + '.',
          'Through so far: ' + (cols.filter(c => s >= c.m.t).map(c => c.m.name).join(', ') || 'none') + '.'].join('\n');
      }
    });
  })();

  /* ===================== Fig 3.2 · Darcy's experiment ===================== */
  (function figDarcy() {
    const el = $('#fig-darcy'); if (!el) return;
    const F = fig(el);
    const svg = $('#svg-darcy');
    const YC = 222, PH = 30, KV = 70, TW = 58, XL0 = 14, PX = 80, YB = 246, YTOP = 36; // pipe centre, pipe height, px per m head, tank width
    const st = { mat: 'sand', plug: false, hl: 2, hr: 0.6, L: 2 };
    const g = E('g', null, svg);
    const gT = E('g', null, g), gP = E('g', null, g), gPart = E('g', null, g), gTube = E('g', null, g), gTop = E('g', null, g);
    const yOf = hh => YC - KV * hh;
    // tanks (left fixed, right moves with pipe length)
    function tank(gg) {
      const o = { g: E('g', null, gg) };
      o.w = E('rect', { class: 'water' }, o.g);
      o.wl = E('path', { class: 'water-line' }, o.g);
      o.box = E('path', { style: 'stroke:var(--ink);stroke-width:1.6;fill:none' }, o.g);
      o.hit = E('rect', { style: 'fill:transparent' }, o.g);
      o.lbl = T(o.g, 0, 0, '', 'lbl lbl-w halo', { 'text-anchor': 'middle' });
      return o;
    }
    const tL = tank(gT), tR = tank(gT);
    const pipeFill = E('rect', { y: YC - PH / 2, height: PH }, gP);
    const plugFill = E('rect', { y: YC - PH / 2, height: PH, fill: 'url(#p-clay)' }, gP);
    const pipeEdge = E('path', { style: 'stroke:var(--ink);stroke-width:1.6;fill:none' }, gP);
    const plugEdge = E('path', { style: 'stroke:var(--ink-2);stroke-width:1;fill:none' }, gP);
    const datum = E('path', { style: 'stroke:var(--ink-3);stroke-width:0.8;stroke-dasharray:2 3' }, gTop);
    const datumL = T(gTop, 0, 0, 'datum', 'lbl-s halo');
    const hgl = E('path', { style: 'stroke:var(--water);stroke-width:1.3;stroke-dasharray:5 3;fill:none' }, gTop);
    const hglL = T(gTop, 0, 0, 'head', 'lbl-s lbl-w halo');
    const lenDim = E('path', { class: 'dim' }, gTop);
    const lenL = T(gTop, 0, 0, '', 'lbl-s halo', { 'text-anchor': 'middle' });
    const flowL = T(gTop, 0, 0, '', 'lbl-s halo', { 'text-anchor': 'middle' });
    const tubesAt = [0.12, 0.3, 0.5, 0.7, 0.88];
    const tubes = tubesAt.map(f => ({ f, w: E('rect', { class: 'water', width: 6 }, gTube), box: E('path', { style: 'stroke:var(--ink-2);stroke-width:1;fill:none' }, gTube) }));
    const parts = Array.from({ length: 14 }, (_, i) => ({ s: (i + 0.5) / 14, yo: ((i * 7) % 5 - 2) * 4.5, e: E('circle', { r: 2.2, class: 'particle' }, gPart) }));
    const P0 = 14 + TW; // pipe start x
    const PL = () => PX * st.L; // pipe px length
    const plugA = 0.4, plugB = 0.6;
    function kEff() { const k = MATS[st.mat].k; if (!st.plug) return k; return 1 / ((1 - (plugB - plugA)) / k + (plugB - plugA) / MATS.clay.k); }
    function headAt(f) { // linear head drop along each piece, the same flow through all
      const dh = st.hl - st.hr;
      if (!st.plug) return st.hl - dh * f;
      const k = MATS[st.mat].k, kc = MATS.clay.k, Lp = plugB - plugA;
      const rs = (1 - Lp) / k, rc = Lp / kc, tot = rs + rc;
      const lossSand = dh * (1 - Lp) / k / tot / (1 - Lp), lossClay = dh * Lp / kc / tot / Lp; // head loss per unit fraction
      if (f <= plugA) return st.hl - lossSand * f;
      if (f <= plugB) return st.hl - lossSand * plugA - lossClay * (f - plugA);
      return st.hl - lossSand * plugA - lossClay * Lp - lossSand * (f - plugB);
    }
    function drawTank(o, x, hh, side) {
      const y = yOf(hh);
      o.w.setAttribute('x', x); o.w.setAttribute('width', TW); o.w.setAttribute('y', y); o.w.setAttribute('height', YB - y);
      o.wl.setAttribute('d', `M${x},${y} h${TW}`);
      const inner = side < 0 ? x + TW : x; // wall facing the pipe has an opening
      o.box.setAttribute('d', side < 0
        ? `M${x},${YTOP} V${YB} H${inner} V${YC + PH / 2} M${inner},${YC - PH / 2} V${YTOP}`
        : `M${x + TW},${YTOP} V${YB} H${inner} V${YC + PH / 2} M${inner},${YC - PH / 2} V${YTOP}`);
      o.hit.setAttribute('x', x); o.hit.setAttribute('width', TW); o.hit.setAttribute('y', y - 14); o.hit.setAttribute('height', 28);
      o.lbl.setAttribute('x', x + TW / 2); o.lbl.setAttribute('y', y - 6); o.lbl.textContent = hh.toFixed(2) + ' m';
    }
    function render() {
      const x1 = P0 + PL();
      drawTank(tL, XL0, st.hl, -1); drawTank(tR, x1, st.hr, 1);
      pipeFill.setAttribute('x', P0); pipeFill.setAttribute('width', PL()); pipeFill.setAttribute('fill', `url(#${MATS[st.mat].pat})`);
      plugFill.setAttribute('x', P0 + PL() * plugA); plugFill.setAttribute('width', PL() * (plugB - plugA)); plugFill.style.display = st.plug ? '' : 'none';
      plugEdge.setAttribute('d', st.plug ? `M${P0 + PL() * plugA},${YC - PH / 2} v${PH} M${P0 + PL() * plugB},${YC - PH / 2} v${PH}` : '');
      pipeEdge.setAttribute('d', `M${P0},${YC - PH / 2} H${x1} M${P0},${YC + PH / 2} H${x1}`);
      datum.setAttribute('d', `M${XL0 - 4},${YC} H${x1 + TW + 4}`);
      datumL.setAttribute('x', x1 + TW + 6 > 440 ? XL0 : x1 + TW + 6); datumL.setAttribute('y', x1 + TW + 6 > 440 ? YC + 26 : YC + 4);
      datumL.style.display = 'none';
      // head line: tank, along the pipe, tank
      const pts = [[XL0 + TW, yOf(st.hl)]];
      const fs = st.plug ? [0, plugA, plugB, 1] : [0, 1];
      for (const f of fs) pts.push([P0 + PL() * f, yOf(headAt(f))]);
      pts.push([x1, yOf(st.hr)]);
      hgl.setAttribute('d', D(pts));
      const mid = st.plug ? [P0 + PL() * 0.5, yOf(headAt(0.5))] : [P0 + PL() * 0.5, yOf(headAt(0.5))];
      hglL.setAttribute('x', mid[0] + 8); hglL.setAttribute('y', mid[1] - 6);
      for (const tb of tubes) {
        const x = P0 + PL() * tb.f - 3, hh = headAt(tb.f), y = yOf(hh);
        tb.w.setAttribute('x', x); tb.w.setAttribute('y', y); tb.w.setAttribute('height', Math.max(0, YC - PH / 2 - y));
        tb.box.setAttribute('d', `M${x},${YC - PH / 2} V${YTOP + 6} M${x + 6},${YC - PH / 2} V${YTOP + 6}`);
      }
      lenDim.setAttribute('d', `M${P0},${YB + 12} H${x1} M${P0},${YB + 7} v10 M${x1},${YB + 7} v10`);
      lenL.setAttribute('x', (P0 + x1) / 2); lenL.setAttribute('y', YB + 26); lenL.textContent = 'L = ' + st.L.toFixed(1) + ' m';
      const dh = st.hl - st.hr, i = Math.abs(dh) / st.L, q = kEff() * i; // m³/s per m²
      flowL.setAttribute('x', (P0 + x1) / 2); flowL.setAttribute('y', YC + PH / 2 + 12);
      flowL.textContent = Math.abs(dh) < 0.005 ? 'no flow' : dh > 0 ? 'flow →' : '← flow';
      setTxt('dc-hl-o', st.hl.toFixed(2) + ' m'); setTxt('dc-hr-o', st.hr.toFixed(2) + ' m'); setTxt('dc-L-o', st.L.toFixed(1) + ' m');
      setTxt('dc-dh', Math.abs(dh).toFixed(2) + ' m'); setTxt('dc-dh2', Math.abs(dh) < 0.005 ? 'levels equal' : dh > 0 ? 'left is higher' : 'right is higher');
      setTxt('dc-i', i.toFixed(2)); setTxt('dc-i2', st.plug ? 'average along the pipe' : 'head lost per metre');
      setTxt('dc-q', rate(q)); setTxt('dc-q2', 'through each m² of pipe');
      if (st.plug && Math.abs(dh) > 0.005) {
        const lossClay = (headAt(plugA) - headAt(plugB)) / dh;
        setTxt('dc-share', (lossClay * 100).toFixed(lossClay > 0.9999 ? 4 : 2) + '%'); setTxt('dc-share2', 'plug is 20% of the length');
      } else { setTxt('dc-share', '–'); setTxt('dc-share2', st.plug ? 'no head difference' : 'no plug'); }
    }
    function rate(q) { // m³/s per m² → readable
      const L = q * 1000;
      if (L === 0) return '0';
      if (L >= 1) return L.toFixed(L < 10 ? 1 : 0) + ' L/s';
      if (L * 60 >= 1) return (L * 60).toFixed(L * 60 < 10 ? 1 : 0) + ' L/min';
      if (L * 3600 >= 1) return (L * 3600).toFixed(L * 3600 < 10 ? 1 : 0) + ' L/h';
      if (L * 86400 >= 1) return (L * 86400).toFixed(L * 86400 < 10 ? 1 : 0) + ' L/day';
      const y = L * 86400 * 365.25;
      return (y >= 1 ? y.toFixed(y < 10 ? 1 : 0) : y.toPrecision(1)) + ' L/year';
    }
    segGroup($('#dc-mat'), v => { st.mat = v; render(); });
    segGroup($('#dc-plug'), v => { st.plug = v === '1'; render(); });
    const hlEl = $('#dc-hl'), hrEl = $('#dc-hr'), LEl = $('#dc-L');
    hlEl.addEventListener('input', () => { st.hl = +hlEl.value; render(); });
    hrEl.addEventListener('input', () => { st.hr = +hrEl.value; render(); });
    LEl.addEventListener('input', () => { st.L = +LEl.value; render(); });
    const fromY = y => clamp(Math.round((YC - y) / KV * 20) / 20, 0.2, 2.4);
    dragHandle(svg, tL.hit, ([, y]) => { st.hl = fromY(y); hlEl.value = st.hl; render(); });
    dragHandle(svg, tR.hit, ([, y]) => { st.hr = fromY(y); hrEl.value = st.hr; render(); });
    function placeParts() {
      for (const p of parts) { p.e.setAttribute('cx', (P0 + PL() * p.s).toFixed(1)); p.e.setAttribute('cy', (YC + p.yo).toFixed(1)); }
    }
    render(); placeParts();
    F.ticks.push((t, dt) => {
      if (RM) return;
      const dh = st.hl - st.hr, v = kEff() * Math.abs(dh) / st.L;
      if (v <= 0) return;
      const vis = clamp(8 * (Math.log10(v) + 9.6), 0.6, 70) * Math.sign(dh); // px/s, compressed
      for (const p of parts) { p.s += vis * dt / PL(); if (p.s > 1) p.s -= 1; if (p.s < 0) p.s += 1; }
      placeParts();
    });
    tutorRegister('fig-darcy', {
      title: "Darcy's experiment: a soil-filled pipe between two tanks (Fig. 3.2)",
      describe: () => {
        const dh = st.hl - st.hr, i = Math.abs(dh) / st.L;
        const lines = ['Pipe material: ' + MATS[st.mat].name + ' (k = ' + MATS[st.mat].k.toExponential(0) + ' m/s)' + (st.plug ? ', with a clay plug (k = 1e-9 m/s) in the middle 20% of the length.' : ', no plug.'),
          'Left tank head ' + st.hl.toFixed(2) + ' m, right tank ' + st.hr.toFixed(2) + ' m, pipe length ' + st.L.toFixed(1) + ' m: gradient i = ' + i.toFixed(2) + '.',
          'Flow q = k·i·A = ' + rate(kEff() * i) + ' per m² of pipe, ' + (Math.abs(dh) < 0.005 ? 'none' : dh > 0 ? 'left to right' : 'right to left') + '.'];
        if (st.plug && Math.abs(dh) > 0.005) lines.push('The clay plug takes ' + ((headAt(plugA) - headAt(plugB)) / dh * 100).toFixed(3) + '% of the head drop; the piezometers in the ' + st.mat + ' read almost the same as the tank beside them.');
        return lines.join('\n');
      }
    });
  })();

  /* ===================== Fig 4.1 · block on a ramp with a water cushion ===================== */
  (function figBlock() {
    const el = $('#fig-block'); if (!el) return;
    const F = fig(el);
    const svg = $('#svg-block');
    const O = [24, 292], LR = 380, BW = 92, BH = 62, W = 20, PHI = 34 * deg, KF = 4; // pivot, ramp length, block size, weight kN, px per kN
    const S0 = 215, SMIN = 58;
    const st = { a: 25, u: 0, s: S0, v: 0, sliding: false, moved: false };
    const g = E('g', null, svg);
    E('path', { d: `M0,${O[1]} H480`, class: 'edge' }, g);
    E('rect', { x: 0, y: O[1], width: 480, height: 30, fill: 'url(#p-alluv)' }, g);
    const ramp = E('polygon', { fill: 'url(#p-conc)', class: 'edge' }, g);
    const angArc = E('path', { style: 'stroke:var(--ink-2);stroke-width:1;fill:none' }, g);
    const angT = T(g, 0, 0, '', 'lbl-s halo');
    const blk = E('g', null, g);
    E('rect', { x: -BW / 2, y: -BH, width: BW, height: BH, fill: 'url(#p-fill)', class: 'edge' }, blk);
    const cush = E('rect', { x: -BW / 2 + 9, y: -7, width: BW - 18, height: 7, class: 'water' }, blk);
    E('rect', { x: -BW / 2 + 9, y: -7, width: BW - 18, height: 7, style: 'fill:none;stroke:var(--water);stroke-width:1' }, blk);
    const aW = arrow(g, 0, 0, 0, 0, 'stroke:var(--ink);stroke-width:2;fill:none', 'arr');
    const aPull = arrow(g, 0, 0, 0, 0, 'stroke:var(--ink-2);stroke-width:2;fill:none;stroke-dasharray:4 2', 'arr');
    const aFr = arrow(g, 0, 0, 0, 0, 'stroke:var(--accent);stroke-width:2.6;fill:none', 'arr-acc');
    const aU = arrow(g, 0, 0, 0, 0, 'stroke:var(--water);stroke-width:2.6;fill:none', 'arr-w');
    const lW = T(g, 0, 0, 'weight', 'lbl-s halo'), lPull = T(g, 0, 0, 'pull down the ramp', 'lbl-s halo', { 'text-anchor': 'end' });
    const lFr = T(g, 0, 0, 'friction available', 'lbl-s lbl-acc halo'), lU = T(g, 0, 0, 'water pushes up', 'lbl-s lbl-w halo', { 'text-anchor': 'end' });
    const status = T(g, 16, 26, '', 'lbl-b');
    const status2 = T(g, 16, 44, '', 'lbl-s');
    const aEl = $('#bk-a'), uEl = $('#bk-u'), resetBtn = $('#bk-reset');
    let last = 'Reader opened the figure.';
    function forces() {
      const th = st.a * deg;
      const N = W * Math.cos(th), U = Math.min(st.u * 1, N), Ne = Math.max(0, N - st.u), Fa = Ne * Math.tan(PHI), Fn = W * Math.sin(th);
      const fs = Fn < 1e-6 ? Infinity : Fa / Fn;
      return { th, N, U, Ne, Fa, Fn, fs };
    }
    function render() {
      const f = forces(), th = f.th, c = Math.cos(th), s = Math.sin(th);
      const t = [c, -s], n = [-s, -c];
      const E2 = [O[0] + LR * c, O[1] - LR * s];
      ramp.setAttribute('points', P([O, E2, [E2[0], O[1]]]));
      const r = 46;
      angArc.setAttribute('d', `M${O[0] + r},${O[1]} A${r},${r} 0 0 0 ${(O[0] + r * c).toFixed(1)},${(O[1] - r * s).toFixed(1)}`);
      angT.setAttribute('x', O[0] + r + 5); angT.setAttribute('y', O[1] - 5); angT.textContent = st.a + '°';
      const b = [O[0] + st.s * t[0], O[1] + st.s * t[1]];
      blk.setAttribute('transform', `translate(${b[0].toFixed(1)},${b[1].toFixed(1)}) rotate(${(-st.a).toFixed(2)})`);
      cush.setAttribute('opacity', (0.25 + 0.75 * clamp(st.u / 20, 0, 1)).toFixed(2));
      const cc = [b[0] + n[0] * BH / 2, b[1] + n[1] * BH / 2];
      setArrow(aW, cc[0], cc[1], cc[0], cc[1] + KF * W);
      lW.setAttribute('x', cc[0] + 6); lW.setAttribute('y', cc[1] + KF * W - 4);
      // the pull of gravity along the slope, drawn from the downhill face of the block
      const pb = [b[0] - t[0] * (BW / 2 + 3) + n[0] * BH * 0.55, b[1] - t[1] * (BW / 2 + 3) + n[1] * BH * 0.55];
      setArrow(aPull, pb[0], pb[1], pb[0] - t[0] * KF * f.Fn, pb[1] - t[1] * KF * f.Fn);
      lPull.setAttribute('x', Math.max(pb[0] - t[0] * KF * f.Fn - 4, (lPull.getComputedTextLength ? lPull.getComputedTextLength() : 0) + 4)); lPull.setAttribute('y', pb[1] - t[1] * KF * f.Fn - 8);
      lPull.style.display = f.Fn * KF > 14 ? '' : 'none';
      // friction acts along the base, up the ramp, drawn from the front corner of the block
      const fb = [b[0] + t[0] * (BW / 2 + 4) + n[0] * 3, b[1] + t[1] * (BW / 2 + 4) + n[1] * 3];
      setArrow(aFr, fb[0], fb[1], fb[0] + t[0] * KF * f.Fa, fb[1] + t[1] * KF * f.Fa);
      lFr.setAttribute('x', fb[0] + t[0] * KF * f.Fa + 6); lFr.setAttribute('y', fb[1] + t[1] * KF * f.Fa + 4);
      lFr.style.display = f.Fa * KF > 6 ? '' : 'none';
      // water pressure: arrow rising out of the ramp into the cushion
      const ub = [b[0] - t[0] * 24, b[1] - t[1] * 24];
      const uLen = KF * f.U;
      setArrow(aU, ub[0] - n[0] * (uLen + 4), ub[1] - n[1] * (uLen + 4), ub[0] - n[0] * 3, ub[1] - n[1] * 3);
      lU.setAttribute('x', ub[0] - n[0] * (uLen + 4) - 6); lU.setAttribute('y', ub[1] - n[1] * (uLen + 4) + 12);
      lU.style.display = f.U > 0.3 ? '' : 'none';
      // readouts
      setTxt('bk-a-o', st.a + '°'); setTxt('bk-u-o', n1(st.u) + ' kPa');
      setTxt('bk-N', n1(f.N) + ' kN'); setTxt('bk-U', n1(f.U) + ' kN'); setTxt('bk-Ne', n1(f.Ne) + ' kN');
      setTxt('bk-Fa', n1(f.Fa) + ' kN'); setTxt('bk-Fn', n1(f.Fn) + ' kN');
      const fsEl = $('#bk-fs');
      const fsTxt = f.fs === Infinity ? '∞' : f.fs > 9.9 ? '> 10' : f.fs.toFixed(2);
      const holds = f.fs >= 1;
      fsEl.innerHTML = '';
      fsEl.append(fsTxt + ' ');
      const pill = document.createElement('span'); pill.className = 'pill ' + (holds ? (f.fs < 1.25 ? 'warn' : 'ok') : 'bad'); pill.textContent = holds ? 'holds' : 'slides';
      fsEl.append(pill);
      const mx = 16;
      $('#bk-bar-a').style.width = clamp(f.Fa / mx * 100, 0, 100) + '%';
      $('#bk-bar-n').style.width = clamp(f.Fn / mx * 100, 0, 100) + '%';
      status.textContent = st.sliding ? 'Sliding' : holds ? 'Holding' : 'Slid to the bottom';
      status2.textContent = st.sliding || !holds ? 'friction available < pull down the ramp' : f.Ne < 0.05 ? 'the water carries the whole press' : 'friction available ≥ pull down the ramp';
      resetBtn.hidden = !st.moved;
    }
    function changed() {
      const f = forces();
      if (f.fs < 1 && st.s > SMIN) { if (!st.sliding) { st.sliding = true; st.v = 0; st.moved = true; last = 'The block started to slide at ' + st.a + '° with ' + n1(st.u) + ' kPa of water pressure (factor of safety ' + f.fs.toFixed(2) + ').'; } }
      else if (f.fs >= 1 && st.sliding) { st.sliding = false; st.v = 0; last = 'The block stopped: factor of safety back to ' + f.fs.toFixed(2) + '.'; }
      if (RM && st.sliding) { st.s = SMIN; st.sliding = false; }
      render();
    }
    aEl.addEventListener('input', () => { st.a = +aEl.value; changed(); });
    uEl.addEventListener('input', () => { st.u = +uEl.value; changed(); });
    resetBtn.addEventListener('click', () => { st.s = S0; st.v = 0; st.moved = false; st.sliding = false; last = 'Reader put the block back at the top.'; changed(); });
    render();
    document.addEventListener('predict', () => requestAnimationFrame(render)); // labels measure once visible
    F.ticks.push((t, dt) => {
      if (!st.sliding) return;
      const f = forces();
      const acc = 9.81 * (f.Fn - f.Fa) / W * 60; // px/s², scaled for the screen
      st.v += Math.max(acc, 30) * dt;
      st.s -= st.v * dt;
      if (st.s <= SMIN) { st.s = SMIN; st.sliding = false; st.v = 0; last += ' It slid to the bottom of the ramp.'; }
      render();
    });
    tutorRegister('fig-block', {
      title: 'Block on a ramp with a water cushion (Fig. 4.1)',
      describe: () => {
        const f = forces();
        return ['Ramp angle ' + st.a + '°, water pressure in the cushion ' + n1(st.u) + ' kPa (cushion area 1 m²). Block weight 20 kN, friction angle 34°.',
          'Block presses on the ramp with ' + n1(f.N) + ' kN; water carries ' + n1(f.U) + ' kN; press left over ' + n1(f.Ne) + ' kN.',
          'Friction available ' + n1(f.Fa) + ' kN vs needed ' + n1(f.Fn) + ' kN: factor of safety ' + (f.fs === Infinity ? 'infinite' : f.fs.toFixed(2)) + (f.fs >= 1 ? ' (holds).' : ' (slides).'),
          last].join('\n');
      }
    });
  })();

  /* ===================== Fig 4.2 · total, pore and effective stress in a column ===================== */
  (function figColumn() {
    const el = $('#fig-column'); if (!el) return;
    fig(el);
    const svg = $('#svg-column');
    const GY = 92, KZ = 25, ZB = 10, CX0 = 30, CX1 = 100, AX0 = 150, AX1 = 462, SMAX = 240, GD = 18, GS = 20, GW = 9.81;
    const yz = z => GY + KZ * z; // z = depth below ground (negative above)
    const xs = s => AX0 + (AX1 - AX0) * s / SMAX;
    const defs = E('defs', null, svg);
    pattern(defs, 'gp-sat', 7, 7, '--m-trans', [[2, 2, 0.7], [5.5, 5, 0.7]]);
    const g = E('g', null, svg);
    // grid + axes
    for (let s = 0; s <= 200; s += 50) {
      E('path', { d: `M${xs(s)},${yz(-3)} V${yz(ZB)}`, style: 'stroke:var(--rule);stroke-width:0.7' }, g);
      T(g, xs(s), yz(ZB) + 16, s, 'lbl-s', { 'text-anchor': 'middle' });
    }
    T(g, AX1, yz(ZB) + 32, 'stress (kPa)', 'lbl-s', { 'text-anchor': 'end' });
    for (let z = 0; z <= ZB; z += 2) { E('path', { d: `M${AX0 - 4},${yz(z)} H${AX0}`, style: 'stroke:var(--ink);stroke-width:1' }, g); T(g, AX0 - 7, yz(z) + 3.5, z + ' m', 'lbl-s', { 'text-anchor': 'end' }); }
    T(g, AX0 - 7, yz(-3) + 3.5, '+3 m', 'lbl-s', { 'text-anchor': 'end' });
    E('path', { d: `M${AX0},${yz(-3)} V${yz(ZB)}`, style: 'stroke:var(--ink);stroke-width:1' }, g);
    E('path', { d: `M${AX0},${yz(0)} H${AX1}`, style: 'stroke:var(--ink-3);stroke-width:0.8;stroke-dasharray:2 3' }, g);
    T(g, AX1, yz(0) - 4, 'ground', 'lbl-s', { 'text-anchor': 'end' });
    // the column
    const flood = E('rect', { x: CX0, width: CX1 - CX0, class: 'water' }, g);
    const dryS = E('rect', { x: CX0, width: CX1 - CX0, fill: 'url(#p-cyclone)' }, g);
    const satS = E('rect', { x: CX0, width: CX1 - CX0, fill: 'url(#gp-sat)' }, g);
    const satT = E('rect', { x: CX0, width: CX1 - CX0, class: 'sat' }, g);
    E('rect', { x: CX0, y: yz(0), width: CX1 - CX0, height: KZ * ZB, class: 'edge', style: 'fill:none' }, g);
    E('rect', { x: CX0 - 6, y: yz(ZB), width: CX1 - CX0 + 12, height: 8, fill: 'url(#p-bedrock)', class: 'edge' }, g);
    const wtLine = E('path', { class: 'water-line' }, g);
    const wsym = E('g', null, g);
    const wtLbl = T(g, 0, 0, 'water table', 'lbl-s lbl-w halo', { 'text-anchor': 'middle' });
    const hit = E('rect', { x: CX0 - 10, width: CX1 - CX0 + 20, height: 30, style: 'fill:transparent' }, g);
    // three lines
    const lTot = E('path', { style: 'stroke:var(--ink);stroke-width:1.6;fill:none' }, g);
    const lU = E('path', { style: 'stroke:var(--water);stroke-width:2.2;fill:none' }, g);
    const lEff = E('path', { style: 'stroke:var(--accent);stroke-width:3.2;fill:none;stroke-linejoin:round' }, g);
    const effFill = E('path', { style: 'fill:var(--accent-soft)' }, g);
    g.insertBefore(effFill, lTot);
    const vT = T(g, 0, 0, '', 'lbl-s halo'), vU = T(g, 0, 0, '', 'lbl-s lbl-w halo'), vE = T(g, 0, 0, '', 'lbl-s lbl-acc halo');
    const wtEl = $('#gc-wt');
    let wt = -(+wtEl.value); // depth of water table below ground (negative = above)
    function stress(z) {
      const top = Math.min(0, wt);
      if (z < top) return [0, 0];
      let s;
      if (z < 0) s = GW * (z - wt); // in the flood water
      else { s = GW * Math.max(0, -wt); const zd = clamp(wt, 0, ZB); s += GD * Math.min(z, zd) + GS * Math.max(0, z - zd); }
      const u = GW * Math.max(0, z - wt);
      return [s, u];
    }
    function render() {
      const top = Math.min(0, wt), ywt = yz(wt);
      flood.setAttribute('y', yz(top)); flood.setAttribute('height', Math.max(0, yz(0) - yz(top)));
      const zw = clamp(wt, 0, ZB);
      dryS.setAttribute('y', yz(0)); dryS.setAttribute('height', KZ * zw);
      satS.setAttribute('y', yz(zw)); satS.setAttribute('height', KZ * (ZB - zw));
      satT.setAttribute('y', yz(zw)); satT.setAttribute('height', KZ * (ZB - zw));
      wtLine.setAttribute('d', wt < ZB ? `M${CX0},${ywt} H${CX1}` : '');
      wsym.textContent = ''; if (wt < ZB) waterSymbol(wsym, (CX0 + CX1) / 2, ywt);
      wtLbl.setAttribute('x', (CX0 + CX1) / 2); wtLbl.setAttribute('y', ywt - 14);
      wtLbl.textContent = wt <= 0 ? 'water level' : 'water table';
      wtLbl.style.display = wt >= ZB - 0.1 ? 'none' : '';
      hit.setAttribute('y', ywt - 15);
      const zs = [top]; for (let z = Math.ceil(top * 4) / 4; z <= ZB + 1e-9; z += 0.25) zs.push(z);
      if (wt > top && wt < ZB) zs.push(wt);
      zs.sort((a, b) => a - b);
      const S = zs.map(z => [z].concat(stress(z)));
      lTot.setAttribute('d', D(S.map(r => [xs(r[1]), yz(r[0])])));
      lU.setAttribute('d', D(S.map(r => [xs(r[2]), yz(r[0])])));
      const eff = S.filter(r => r[0] >= 0).map(r => [xs(r[1] - r[2]), yz(r[0])]);
      lEff.setAttribute('d', D(eff));
      // shade the effective stress: between u and total
      const up = S.map(r => [xs(r[2]), yz(r[0])]), tp = S.map(r => [xs(r[1]), yz(r[0])]).reverse();
      effFill.setAttribute('d', D(up.concat(tp)) + 'Z');
      const [sB, uB] = stress(ZB), eB = sB - uB;
      const by = yz(ZB) - 6;
      vT.setAttribute('x', xs(sB) + 5); vT.setAttribute('y', by - 8); vT.textContent = 'σ ' + fmt(sB);
      vU.setAttribute('x', xs(uB) + 5); vU.setAttribute('y', by + (Math.abs(xs(uB) - xs(eB)) < 40 ? 12 : -8)); vU.textContent = uB > 0.5 ? 'u ' + fmt(uB) : '';
      vE.setAttribute('x', xs(eB) - 5); vE.setAttribute('y', by - 22); vE.setAttribute('text-anchor', 'end'); vE.textContent = 'σ′ ' + fmt(eB);
      setTxt('gc-s', fmt(sB) + ' kPa'); setTxt('gc-u', fmt(uB) + ' kPa'); setTxt('gc-e', fmt(eB) + ' kPa');
      setTxt('gc-str', Math.round(eB / (GD * ZB) * 100) + '%');
      setTxt('gc-wt-o', wt >= ZB ? 'below the column' : wt > 0.01 ? n1(wt) + ' m down' : wt > -0.01 ? 'at the ground' : n1(-wt) + ' m above ground');
      setTxt('gc-u2', uB > 0.5 ? 'water ' + n1(ZB - wt) + ' m above this point' : 'no water at 10 m');
    }
    wtEl.addEventListener('input', () => { wt = -(+wtEl.value); render(); });
    dragHandle(svg, hit, ([, y]) => { const v = clamp(Math.round(-((y - GY) / KZ) * 4) / 4, -10, 3); wtEl.value = v; wt = -v; render(); });
    render();
    tutorRegister('fig-column', {
      title: 'Total, pore and effective stress in a 10 m sand column (Fig. 4.2)',
      describe: () => {
        const [sB, uB] = stress(ZB);
        return ['Water table: ' + (wt >= ZB ? 'below the column (dry)' : wt > 0 ? n1(wt) + ' m below ground' : n1(-wt) + ' m above ground (flooded)') + '. Unit weights 18 kN/m³ above it, 20 below, water 9.81.',
          'At 10 m depth: total stress ' + fmt(sB) + ' kPa, pore pressure ' + fmt(uB) + ' kPa, effective stress ' + fmt(sB - uB) + ' kPa.',
          'Strength there is ' + Math.round((sB - uB) / 180 * 100) + '% of the dry value (strength follows effective stress).'].join('\n');
      }
    });
  })();
})();
