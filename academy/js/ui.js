// Small DOM helpers and formatters shared by every page.

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

// append children, skipping null/false/undefined (native append would print them)
export function append(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

// Collects unsubscribe functions so a re-rendered block can drop its listeners.
export class Scope {
  constructor() { this.fns = []; }
  add(fn) { if (typeof fn === 'function') this.fns.push(fn); return fn; }
  dispose() { this.fns.splice(0).forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
}

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const fmtQ = v => (v >= 1000 ? Math.round(v).toLocaleString('en') : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
export const fmtFS = v => (!isFinite(v) || v > 999 ? '> 999' : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
export const pct = v => `${Math.round(v * 100)}%`;

export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// Popover anchored to a button: toggles on click, closes on outside click or Escape.
export function popover(button, panel) {
  const wrap = h('div', { class: 'pop-wrap' }, button, panel);
  panel.hidden = true;
  panel.classList.add('pop');
  button.setAttribute('aria-expanded', 'false');
  const close = () => { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); };
  const open = () => { panel.hidden = false; button.setAttribute('aria-expanded', 'true'); };
  button.addEventListener('click', e => { e.stopPropagation(); panel.hidden ? open() : close(); });
  const outside = e => { if (!wrap.contains(e.target)) close(); };
  const esc = e => { if (e.key === 'Escape' && !panel.hidden) { close(); button.focus(); } };
  document.addEventListener('click', outside);
  document.addEventListener('keydown', esc);
  wrap.dispose = () => { document.removeEventListener('click', outside); document.removeEventListener('keydown', esc); };
  wrap.close = close;
  return wrap;
}

// Smoothly bring an element into view inside its scroll container.
export function reveal(el) {
  if (!el) return;
  requestAnimationFrame(() => el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' }));
}

export const icons = {
  back: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 5.5 9 9m0-9-9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  layers: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 3 7 4-7 4-7-4 7-4Zm-7 7 7 4 7-4M3 13l7 4 7-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  expand: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 8V3.5H8M12 3.5h4.5V8M16.5 12v4.5H12M8 16.5H3.5V12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  more: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4.5" cy="10" r="1.6" fill="currentColor"/><circle cx="10" cy="10" r="1.6" fill="currentColor"/><circle cx="15.5" cy="10" r="1.6" fill="currentColor"/></svg>',
  reset: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  predict: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9V12m0 2.4v.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  flask: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3h4M8.5 3v5L4 16a1 1 0 0 0 .9 1.5h10.2A1 1 0 0 0 16 16l-4.5-8V3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6.2 12.5h7.6" stroke="currentColor" stroke-width="1.4"/></svg>',
  bulb: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 14.5h5M8 17h4M10 3a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.5v11l9-5.5-9-5.5Z" fill="currentColor"/></svg>',
  book: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4.5c2.5-1 5-1 7 .5 2-1.5 4.5-1.5 7-.5v11c-2.5-1-5-1-7 .5-2-1.5-4.5-1.5-7-.5v-11ZM10 5v11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  cube: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2.5 6.5 3.7v7.6L10 17.5l-6.5-3.7V6.2L10 2.5Zm0 0v0M3.5 6.2 10 10l6.5-3.8M10 10v7.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  target: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="1" fill="currentColor"/></svg>'
};

export function icon(name, cls = 'ico') {
  const s = h('span', { class: cls, 'aria-hidden': 'true', html: icons[name] || '' });
  return s;
}
