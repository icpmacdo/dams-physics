// Stage: the 3D model plus its on-canvas tools (camera views, layers, fullscreen, legend),
// driven by the solver. Lessons and the lab both build on it. Design changes come from
// outside (inline lesson controls or the lab panel) through set().
//
// The 3D viewer (and three.js) is loaded on demand, so pages render straight away. Until it
// arrives the stage shows a loading state; if WebGL or the module is unavailable it falls back
// to the 2D cross-section, which carries the same solved field.

import { solve, summarize, normalize, DEFAULTS } from './solver-client.js';
import { drawSection } from './section-canvas.js';
import { h, append, icon, popover, reduceMotion } from './ui.js';

const VIEW_BTNS = [['iso', 'Oblique'], ['section', 'Section'], ['aerial', 'Aerial']];
const MODES = [['materials', 'Materials'], ['head', 'Total head'], ['pressure', 'Pressure head']];
const LAYERS = [['phreatic', 'Phreatic surface'], ['particles', 'Flow particles'], ['labels', 'Labels']];

let viewerModule = null;
const loadViewer = () => viewerModule || (viewerModule = import('./viewer3d.js'));
export const preloadViewer = () => { loadViewer().catch(() => {}); };

export class Stage {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = opts;
    this.params = normalize(opts.params || DEFAULTS);
    this.mode = opts.mode || 'materials';
    this.layers = Object.assign({ phreatic: true, particles: true, labels: true }, opts.layers || {});
    this.view = opts.view || 'iso';
    this.labelList = [];
    this.insetPx = 0;
    this.cutZ = 0;
    this.tried = {};
    this.viewChanged = false;
    this.listeners = {};
    this.seq = 0;
    this.result = null;
    this.sum = null;
    this.viewer = null;
    this.build();
    this.ready = this.solveNow(false);
  }

  on(ev, fn) {
    (this.listeners[ev] = this.listeners[ev] || []).push(fn);
    return () => { this.listeners[ev] = (this.listeners[ev] || []).filter(f => f !== fn); };
  }
  emit(ev, d) { (this.listeners[ev] || []).slice().forEach(fn => fn(d)); }

  get interacted() { return !!(this.viewer && this.viewer.interacted); }

  build() {
    const root = h('div', { class: 'stage' + (this.opts.showcase ? ' showcase' : '') });
    this.root = root;
    this.vp = h('div', { class: 'stage-viewport', role: 'img', 'aria-label': 'Interactive 3D model of an embankment dam across a valley, cut open to show the solved seepage field' });
    this.loading = h('div', { class: 'stage-loading' }, h('span', { class: 'spin' }), 'Loading the 3D model');
    this.vp.append(this.loading);
    root.append(this.vp);
    this.host.append(root);
    loadViewer().then(m => this.attachViewer(m), err => {
      console.error(err);
      this.fallback('The 3D view could not load. Showing the cross-section instead.');
    });
    if (this.opts.showcase) return;

    // ---- tools (top right)
    this.viewBtns = VIEW_BTNS.map(([k, t]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === this.view), 'data-view': k, onclick: () => this.setView(k, { user: true }) }, t));
    const viewSeg = h('div', { class: 'seg seg-glass', role: 'radiogroup', 'aria-label': 'Camera view' }, this.viewBtns);

    this.modeBtns = MODES.map(([k, t]) => h('button', { type: 'button', role: 'radio', 'data-mode': k, onclick: () => this.setMode(k, { user: true }) }, t));
    this.layerBtns = {};
    const layerChips = LAYERS.map(([k, t]) => {
      const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!!this.layers[k]), onclick: () => this.setLayer(k, !this.layers[k], { user: true }) }, t);
      this.layerBtns[k] = b;
      return b;
    });
    this.cutInput = h('input', { type: 'range', min: -28, max: 28, step: 1, value: 0, 'aria-label': 'Cut position along the dam', oninput: e => this.setCut(+e.target.value) });
    const panel = h('div', { class: 'layers-panel', role: 'dialog', 'aria-label': 'Display layers' },
      h('div', { class: 'pp-label' }, 'Cut face shows'),
      h('div', { class: 'seg seg-fill', role: 'radiogroup', 'aria-label': 'Cut face shows' }, this.modeBtns),
      h('div', { class: 'pp-label' }, 'Show'), h('div', { class: 'chips' }, layerChips),
      h('div', { class: 'pp-label' }, 'Cut position'), h('div', { class: 'cut-row' }, h('span', {}, 'Back'), this.cutInput, h('span', {}, 'Front')));
    const layersBtn = h('button', { type: 'button', class: 'tool-btn', title: 'Display options' }, 'Display');
    this.layersPop = popover(layersBtn, panel);
    const fsBtn = h('button', { type: 'button', class: 'tool-btn icon-only', title: 'Full screen', 'aria-label': 'Full screen', onclick: () => this.toggleFullscreen() }, icon('expand'));
    const tools = h('div', { class: 'stage-tools' }, viewSeg, this.layersPop, this.canFullscreen() ? fsBtn : null);

    this.legend = h('div', { class: 'stage-legend', 'aria-hidden': 'true' });
    this.busy = h('div', { class: 'stage-busy', role: 'status' }, h('span', { class: 'spin' }), 'Solving');
    const touch = window.matchMedia('(pointer: coarse)').matches;
    this.hint = h('div', { class: 'stage-hint gone' }, touch ? 'Drag to orbit · pinch to zoom · two fingers to pan' : 'Drag to orbit · scroll to zoom · right-drag to pan');
    append(root, [tools, this.legend, this.busy, this.hint]);
    this.syncTools();
  }

  attachViewer({ DamViewer }) {
    if (this.disposed) return;
    const v = new DamViewer(this.vp, { showcase: this.opts.showcase, mode: this.mode, view: this.view });
    if (v.failed) { this.fallback('3D view unavailable in this browser (WebGL did not start). Showing the cross-section instead.'); return; }
    this.loading.remove();
    this.viewer = v;
    v.on('interact', () => { this.hideHint(); this.emit('interact'); });
    for (const [k, on] of Object.entries(this.layers)) v.setLayer(k, on);
    if (this.insetPx) v.setInset(this.insetPx);
    if (this.cutZ) v.setCut(this.cutZ);
    v.setLabels(this.labelList);
    if (this.result) v.setResult(this.result);
    if (this.hint && !this.viewChanged) {
      this.hint.classList.remove('gone');
      this.hintTimer = setTimeout(() => this.hideHint(), 9000);
    }
    this.emit('viewer');
  }

  fallback(msg) {
    if (this.disposed || this.flat) return;
    this.loading.remove();
    if (this.hint) this.hint.remove();
    this.hint = null;
    this.root.classList.add('flat');
    this.flat = h('canvas', { class: 'flat-section', 'aria-label': 'Cross-section of the solved seepage field' });
    this.vp.append(h('div', { class: 'flat-wrap' }, this.flat, h('p', { class: 'flat-note' }, msg)));
    this.drawFlat();
  }

  canFullscreen() {
    const el = this.opts.fullscreenTarget || this.root;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  }
  toggleFullscreen() {
    const el = this.opts.fullscreenTarget || this.root;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  }

  hideHint() { if (this.hint) this.hint.classList.add('gone'); clearTimeout(this.hintTimer); }

  syncTools() {
    if (this.opts.showcase || !this.modeBtns) return;
    this.modeBtns.forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === this.mode)));
    this.viewBtns.forEach(b => b.setAttribute('aria-checked', String(b.dataset.view === this.view)));
    for (const k in this.layerBtns) this.layerBtns[k].setAttribute('aria-pressed', String(!!this.layers[k]));
    this.renderLegend();
  }

  // ---- state changes ---------------------------------------------------------
  set(patch, { user = false } = {}) {
    const next = normalize(Object.assign({}, this.params, patch));
    const changed = Object.keys(next).filter(k => next[k] !== this.params[k]);
    if (!changed.length) return this.ready;
    this.params = next;
    if (user) for (const k of changed) (this.tried[k] = this.tried[k] || new Set()).add(next[k]);
    this.emit('params', { params: this.params, user, changed });
    this.renderLegend();
    this.ready = this.solveNow(user);
    return this.ready;
  }

  setMode(m, { user = false } = {}) {
    if (m === this.mode) return;
    this.mode = m;
    if (this.viewer) this.viewer.setMode(m); else this.drawFlat();
    this.syncTools();
    this.emit('mode', { mode: m, user });
  }

  setLayer(k, on, { user = false } = {}) {
    if (this.layers[k] === on) return;
    this.layers[k] = on;
    if (this.viewer) this.viewer.setLayer(k, on);
    this.syncTools();
    this.emit('layer', { key: k, on, user });
  }

  setView(v, { user = false, instant = false } = {}) {
    this.view = v;
    if (user) { this.viewChanged = true; this.hideHint(); }
    if (this.viewer) this.viewer.setView(v, instant);
    this.syncTools();
    this.emit('view', { view: v, user });
  }

  setLabels(list) { this.labelList = list || []; if (this.viewer) this.viewer.setLabels(this.labelList); }
  setInset(px) {
    this.insetPx = px;
    const w = this.root.clientWidth;
    const eff = px > 0 && w - px > 280 ? px : 0;   // same rule as the viewer
    this.root.style.setProperty('--inset', `${eff}px`);
    if (this.viewer) this.viewer.setInset(px);
  }
  setCut(z) { this.cutZ = z; if (this.viewer) this.viewer.setCut(z); if (this.cutInput) this.cutInput.value = z; }

  // apply a whole scene at once (lesson step entry). Resolves once the scene is solved.
  applyScene(s = {}) {
    if (s.mode) this.setMode(s.mode);
    if (s.layers) for (const [k, on] of Object.entries(s.layers)) this.setLayer(k, on);
    if (s.view) this.setView(s.view);
    this.setLabels(s.labels || []);
    this.tried = {};
    this.viewChanged = false;
    if (this.viewer) this.viewer.interacted = false;
    return s.params ? this.set(s.params) : this.ready;
  }

  // ---- solving -----------------------------------------------------------------
  async solveNow(user) {
    const my = ++this.seq;
    const t = setTimeout(() => this.root.classList.add('solving'), 160);
    try {
      const r = await solve(this.params);
      if (my !== this.seq) return this.sum;
      this.result = r;
      this.sum = summarize(r);
      if (this.viewer) this.viewer.setResult(r); else this.drawFlat();
      this.emit('solved', { sum: this.sum, params: this.params, user });
      return this.sum;
    } catch (e) {
      console.error(e);
      this.emit('error', e);
      return null;
    } finally {
      clearTimeout(t);
      if (my === this.seq) this.root.classList.remove('solving');
    }
  }

  drawFlat() { if (this.flat && this.result) drawSection(this.flat, this.result, { mode: this.mode, scale: 6, scaleBar: true }); }

  renderLegend() {
    if (!this.legend) return;
    const p = this.params;
    const sw = (c, t) => h('span', { class: 'sw' }, h('i', { style: { background: `var(${c})` } }), t);
    const ln = (cls, t) => h('span', { class: 'sw' }, h('i', { class: 'ln ' + cls }), t);
    this.legend.innerHTML = '';
    if (this.mode === 'materials') {
      append(this.legend, [
        h('span', { class: 'lg-title' }, 'Cut face'),
        p.damType === 'cored' ? [sw('--m-clay', 'Clay core'), sw('--m-rock', 'Rockfill')] : sw('--m-fill', 'Earthfill'),
        p.drain !== 'none' ? sw('--m-drain', 'Drain') : null,
        p.cutoff !== 'none' ? sw('--m-conc', 'Cutoff') : null,
        p.foundation === 'pervious' ? sw('--m-alluv', 'Sand and gravel') : sw('--m-bedrock', 'Tight rock'),
        sw('--water-fill', 'Water'),
        ln('ln-flow', 'Flow line'), ln('ln-phr', 'Phreatic surface')]);
    } else {
      const head = this.mode === 'head';
      const ramp = head ? 'linear-gradient(90deg, var(--ramp-lo), var(--ramp-hi))' : 'linear-gradient(90deg, var(--m-tsand), var(--ramp-lo) 30%, var(--ramp-hi))';
      append(this.legend, [
        h('span', { class: 'lg-title' }, head ? 'Total head' : 'Pressure head'),
        h('span', { class: 'lg-ramp' }, h('small', {}, head ? '0' : 'suction'), h('i', { style: { background: ramp } }), h('small', {}, head ? 'reservoir' : '+30 m')),
        ln('ln-eq', 'Equipotential'), ln('ln-flow', 'Flow line'), ln('ln-phr', 'Phreatic surface')]);
    }
  }

  snapshot() {
    if (this.viewer) return this.viewer.snapshot();
    return this.flat ? this.flat.toDataURL('image/png') : null;
  }

  dispose() {
    this.disposed = true;
    this.seq++;
    clearTimeout(this.hintTimer);
    if (this.layersPop) this.layersPop.dispose();
    if (this.viewer) this.viewer.dispose();
    this.root.remove();
    this.listeners = {};
  }
}

export { reduceMotion };
