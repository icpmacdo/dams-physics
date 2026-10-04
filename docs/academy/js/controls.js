// Controls and readouts bound to a Stage. Lessons place one or two of these inline, right
// where the step asks for them; the lab uses the full set. Every widget registers its
// listeners in a Scope so the owner can drop them when it re-renders.

import { h, fmtQ, fmtFS } from './ui.js';

export const DESIGN = {
  damType: { title: 'Dam section', options: [['homogeneous', 'Homogeneous', 'Earthfill throughout'], ['cored', 'Clay core', 'Clay core with rockfill shells']] },
  drain: { title: 'Drain', options: [['none', 'None', ''], ['toe', 'Toe drain', 'Gravel drain at the downstream toe'], ['chimney', 'Chimney', 'Chimney drain joined to a blanket drain along the base']] },
  cutoff: { title: 'Cutoff', options: [['none', 'None', ''], ['partial', 'Partial', 'Wall half-way down the 15 m foundation'], ['full', 'Full', 'Wall through the full 15 m foundation']] },
  foundation: { title: 'Foundation', options: [['tight', 'Tight rock', 'Low-permeability foundation'], ['pervious', 'Sand and gravel', 'About 100 times more permeable than the fill']] }
};

// Segmented radio group with arrow-key navigation.
export function segmented(options, value, onPick, label, cls = '') {
  const btns = options.map(([v, t, title]) => h('button', {
    type: 'button', role: 'radio', 'data-v': v, title: title || null, 'aria-checked': String(v === value), tabindex: v === value ? '0' : '-1',
    onclick: () => onPick(v)
  }, t));
  const group = h('div', { class: 'seg ' + cls, role: 'radiogroup', 'aria-label': label }, btns);
  group.addEventListener('keydown', e => {
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    let j = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % btns.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + btns.length) % btns.length;
    if (j == null) return;
    e.preventDefault(); e.stopPropagation();
    btns[j].focus();
    onPick(btns[j].dataset.v);
  });
  group.setValue = v => btns.forEach(b => {
    const on = b.dataset.v === v;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  return group;
}

export function designControl(stage, key, scope, { showTitle = true } = {}) {
  const d = DESIGN[key];
  const seg = segmented(d.options, stage.params[key], v => stage.set({ [key]: v }, { user: true }), d.title, 'seg-fill');
  const desc = h('div', { class: 'ctl-desc' });
  const sync = () => {
    seg.setValue(stage.params[key]);
    const o = d.options.find(o => o[0] === stage.params[key]);
    desc.textContent = o ? o[2] : '';
  };
  scope.add(stage.on('params', sync));
  sync();
  return h('div', { class: 'ctl', 'data-key': key }, showTitle ? h('div', { class: 'ctl-title' }, d.title) : null, seg, desc);
}

export function reservoirControl(stage, scope) {
  const out = h('output', { class: 'ctl-val' });
  const input = h('input', {
    type: 'range', min: 0.4, max: 0.95, step: 0.05, value: stage.params.reservoir, 'aria-label': 'Reservoir level, as a fraction of the dam height',
    oninput: e => stage.set({ reservoir: +e.target.value }, { user: true })
  });
  const sync = () => {
    input.value = stage.params.reservoir;
    out.textContent = `${Math.round(stage.params.reservoir * 100)}% · ${(stage.params.reservoir * 24).toFixed(1)} m of water`;
    input.style.setProperty('--fill', `${((stage.params.reservoir - 0.4) / 0.55) * 100}%`);
  };
  scope.add(stage.on('params', sync));
  sync();
  return h('div', { class: 'ctl', 'data-key': 'reservoir' },
    h('div', { class: 'ctl-title' }, 'Reservoir level', out), input,
    h('div', { class: 'ctl-scale' }, h('span', {}, '40%'), h('span', {}, '95%')));
}

export function modeControl(stage, scope) {
  const seg = segmented([['materials', 'Materials'], ['head', 'Total head'], ['pressure', 'Pressure head']], stage.mode, v => stage.setMode(v, { user: true }), 'Cut face shows', 'seg-fill');
  scope.add(stage.on('mode', () => seg.setValue(stage.mode)));
  return h('div', { class: 'ctl' }, h('div', { class: 'ctl-title' }, 'Cut face shows'), seg);
}

export function viewControl(stage, scope) {
  const seg = segmented([['iso', 'Oblique'], ['section', 'Section'], ['aerial', 'Aerial']], stage.view, v => stage.setView(v, { user: true }), 'Camera view', 'seg-fill');
  scope.add(stage.on('view', () => seg.setValue(stage.view)));
  return h('div', { class: 'ctl' }, h('div', { class: 'ctl-title' }, 'Camera'), seg);
}

export function layerControl(stage, keys, scope) {
  const names = { phreatic: 'Phreatic surface', particles: 'Flow particles', labels: 'Labels' };
  const chips = keys.map(k => {
    const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!!stage.layers[k]), onclick: () => stage.setLayer(k, b.getAttribute('aria-pressed') !== 'true', { user: true }) }, names[k]);
    scope.add(stage.on('layer', ev => { if (ev.key === k) b.setAttribute('aria-pressed', String(ev.on)); }));
    return b;
  });
  return h('div', { class: 'ctl' }, h('div', { class: 'ctl-title' }, 'Show'), h('div', { class: 'chips' }, chips));
}

export function controlFor(stage, key, scope) {
  if (DESIGN[key]) return designControl(stage, key, scope);
  if (key === 'reservoir') return reservoirControl(stage, scope);
  if (key === 'mode') return modeControl(stage, scope);
  if (key === 'view') return viewControl(stage, scope);
  if (key === 'layers') return layerControl(stage, ['phreatic', 'particles'], scope);
  return null;
}

// ---- instruments ---------------------------------------------------------------
export const METRICS = {
  q: { label: 'Seepage', unit: 'L/day per m', get: s => s.qTotal, fmt: fmtQ, tip: 'Water entering from the reservoir, per metre length of dam.' },
  fs: { label: 'Exit safety factor', unit: 'target 3 or more', get: s => s.fs, fmt: fmtFS, tone: v => (v >= 3 ? 'ok' : v >= 1.5 ? 'warn' : 'bad'), tip: 'Critical gradient (1.0) divided by the steepest exit gradient.' },
  iExit: { label: 'Exit gradient', unit: 'critical ≈ 1.0', get: s => s.iExit, fmt: v => v.toFixed(2), tone: v => (v < 1 / 3 ? 'ok' : v < 1 / 1.5 ? 'warn' : 'bad'), tip: 'Steepest hydraulic gradient where water leaves the soil.' },
  sf: { label: 'Seepage face', unit: 'on the downstream slope', get: s => (s.seepageFace ? s.seepageFaceTop : 0), fmt: v => (v > 0 ? `${v.toFixed(0)} m high` : 'None'), tone: v => (v > 0 ? 'bad' : 'ok'), tip: 'Height of the wet breakout on the downstream slope.' }
};

function deltaText(key, base, cur) {
  const m = METRICS[key];
  const b = m.get(base), c = m.get(cur);
  if (key === 'sf') return b === c ? null : `was ${m.fmt(b).replace(' high', '')}`;
  if (key === 'fs' || key === 'iExit') return Math.abs(c - b) < 0.005 * Math.max(1, Math.abs(b)) ? null : `was ${m.fmt(b)}`;
  if (!(b > 0)) return null;
  const r = c / b;
  if (Math.abs(r - 1) < 0.005) return null;
  if (r >= 1.995) return `×${r < 10 ? r.toFixed(1) : Math.round(r).toLocaleString('en')}  (was ${fmtQ(b)})`;
  if (r <= 0.5) return `÷${1 / r < 10 ? (1 / r).toFixed(1) : Math.round(1 / r).toLocaleString('en')}  (was ${fmtQ(b)})`;
  return `${r > 1 ? '▲' : '▼'} ${Math.round(Math.abs(r - 1) * 100)}%  (was ${fmtQ(b)})`;
}

export function instruments(stage, keys, scope, getBaseline = () => null) {
  const cards = {};
  const wrap = h('div', { class: 'insts', 'aria-live': 'polite' });
  for (const k of keys) {
    if (k === 'split') {
      const bar = h('div', { class: 'split' }), leg = h('div', { class: 'split-legend' });
      cards.split = { bar, leg };
      wrap.append(h('div', { class: 'inst inst-split' }, h('div', { class: 'inst-label' }, 'Where the water leaves'), bar, leg));
      continue;
    }
    const m = METRICS[k];
    const v = h('b', {}, '–'), d = h('div', { class: 'inst-delta' });
    const el = h('div', { class: 'inst', title: m.tip }, h('div', { class: 'inst-label' }, m.label), h('div', { class: 'inst-value' }, v), h('div', { class: 'inst-unit' }, m.unit), d);
    cards[k] = { el, v, d };
    wrap.append(el);
  }
  const update = () => {
    const s = stage.sum;
    if (!s) return;
    const base = getBaseline();
    for (const k of keys) {
      if (k === 'split') { renderSplit(cards.split, s); continue; }
      const m = METRICS[k], c = cards[k], val = m.get(s);
      c.v.textContent = m.fmt(val);
      c.el.dataset.tone = m.tone ? m.tone(val) : '';
      const dt = base ? deltaText(k, base, s) : null;
      c.d.textContent = dt || '';
      c.el.classList.toggle('changed', !!dt);
    }
  };
  scope.add(stage.on('solved', update));
  update();
  wrap.update = update;
  return wrap;
}

function renderSplit(c, s) {
  const parts = [['Drain', s.qDrain, '--m-drain'], ['Ground beyond the toe', s.qTail, '--water'], ['Seepage face', s.qFace, '--bad']];
  const tot = parts.reduce((a, p) => a + p[1], 0) || 1;
  c.bar.innerHTML = '';
  c.leg.innerHTML = '';
  for (const [t, v, col] of parts) {
    const f = v / tot;
    if (f > 0.004) c.bar.append(h('i', { style: { flex: String(f), background: `var(${col})` }, title: `${t}: ${fmtQ(v)} L/day per m` }));
    c.leg.append(h('span', { class: 'sw' + (f <= 0.004 ? ' dim' : '') }, h('i', { style: { background: `var(${col})` } }), `${t} `, h('b', {}, `${Math.round(f * 100)}%`)));
  }
}
