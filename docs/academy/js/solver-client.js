// Runs src/seepage-solver.js (copied next to this file by build.py) in a Web Worker,
// with a small result cache. If workers are unavailable (e.g. opened from file://),
// the solver is loaded as a plain script and run on the main thread instead.

const SOLVER_URL = new URL('./seepage-solver.js', import.meta.url).href;
const cache = new Map();
const CACHE_MAX = 40;
let worker = null, workerBroken = false, nextId = 1;
const pending = new Map();
let inlinePromise = null;

export const DEFAULTS = { damType: 'homogeneous', drain: 'none', cutoff: 'none', foundation: 'pervious', reservoir: 0.85 };

export function normalize(p) {
  const q = Object.assign({}, DEFAULTS, p || {});
  q.reservoir = Math.round(Math.min(0.95, Math.max(0.4, Number(q.reservoir) || 0.85)) * 100) / 100;
  return { damType: q.damType, drain: q.drain, cutoff: q.cutoff, foundation: q.foundation, reservoir: q.reservoir };
}
export const keyOf = p => { const q = normalize(p); return [q.damType, q.drain, q.cutoff, q.foundation, q.reservoir.toFixed(2)].join('|'); };

function getWorker() {
  if (worker || workerBroken) return worker;
  try {
    worker = new Worker(SOLVER_URL);
    worker.onmessage = e => {
      const { id, result, error } = e.data || {};
      const job = pending.get(id);
      if (!job) return;
      pending.delete(id);
      error ? job.reject(new Error(error)) : job.resolve(result);
    };
    worker.onerror = () => {
      workerBroken = true; worker = null;
      const jobs = [...pending.values()]; pending.clear();
      jobs.forEach(j => runInline(j.params).then(j.resolve, j.reject));
    };
  } catch (e) {
    workerBroken = true; worker = null;
  }
  return worker;
}

function loadInline() {
  if (!inlinePromise) {
    inlinePromise = new Promise((resolve, reject) => {
      if (window.SeepageSolver) return resolve(window.SeepageSolver);
      const s = document.createElement('script');
      s.src = SOLVER_URL;
      s.onload = () => resolve(window.SeepageSolver);
      s.onerror = () => reject(new Error('Could not load the seepage solver'));
      document.head.appendChild(s);
    });
  }
  return inlinePromise;
}
async function runInline(params) {
  const api = await loadInline();
  await new Promise(r => setTimeout(r, 0));
  return api.solveSeepage(params);
}

export function solve(params) {
  const p = normalize(params);
  const k = keyOf(p);
  if (cache.has(k)) {
    const v = cache.get(k); cache.delete(k); cache.set(k, v);
    return v;
  }
  const w = getWorker();
  const promise = w
    ? new Promise((resolve, reject) => { const id = nextId++; pending.set(id, { resolve, reject, params: p }); w.postMessage({ id, params: p }); })
    : runInline(p);
  cache.set(k, promise);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  promise.catch(() => cache.delete(k));
  return promise;
}

// Engineering summary of a result, in the units the lessons use.
export function summarize(r) {
  const Lday = v => v * 1000 * 86400;
  const q = r.q;
  return {
    qTotal: Lday(q.inflowTotal),           // L/day per metre of dam
    qDrain: Lday(q.outDrain),
    qFace: Lday(q.outSeepageFace),
    qTail: Lday(q.outTailwater),
    qFloor: Lday(q.inflowFloor),
    iExit: Math.max(r.exit.groundMax, r.exit.faceMax),
    fs: r.exit.fs,
    governing: r.exit.governing,
    seepageFace: r.seepageFace.present,
    seepageFaceTop: r.seepageFace.present ? r.seepageFace.topZ : null,
    head: r.Hw,
    converged: r.stats ? r.stats.converged : true
  };
}

export const LABELS = {
  damType: { homogeneous: 'Homogeneous earthfill', cored: 'Clay core with rockfill shells' },
  drain: { none: 'No drain', toe: 'Toe drain', chimney: 'Chimney and blanket drain' },
  cutoff: { none: 'No cutoff', partial: 'Partial cutoff', full: 'Full cutoff' },
  foundation: { pervious: 'Sand and gravel', tight: 'Tight rock' }
};

// One readable description of a design, e.g. "Clay core with rockfill shells, no drain, full cutoff"
export function designLabel(p, { foundation = false, reservoir = false } = {}) {
  const parts = [LABELS.damType[p.damType], LABELS.drain[p.drain].toLowerCase(), LABELS.cutoff[p.cutoff].toLowerCase()];
  if (foundation) parts.push(`on ${LABELS.foundation[p.foundation].toLowerCase()}`);
  if (reservoir) parts.push(`reservoir ${Math.round(p.reservoir * 100)}%`);
  return parts.join(', ');
}
