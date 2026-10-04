// Learner progress, kept in this browser only (localStorage). Every read and write is
// guarded: storage can be missing or blocked, and the app must still work without it.

const KEY = 'dams-academy:v1';
const listeners = new Set();

function blank() {
  return { version: 1, learner: { name: '' }, lessons: {}, lab: { runs: 0, saved: [] }, lastLesson: null };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw);
    return s && s.version === 1 ? Object.assign(blank(), s) : blank();
  } catch (e) {
    return blank();
  }
}

let state = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
}

export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function lesson(id) {
  if (!state.lessons[id]) {
    state.lessons[id] = { status: 'new', step: 0, stepsDone: [], predictions: {}, quiz: null, timeMs: 0, startedAt: null, completedAt: null, challenge: null };
  }
  return state.lessons[id];
}

export function touchLesson(id) {
  const L = lesson(id);
  if (L.status === 'new') { L.status = 'started'; L.startedAt = new Date().toISOString(); }
  state.lastLesson = id;
  save();
  return L;
}

export function updateLesson(id, patch) {
  Object.assign(lesson(id), patch);
  save();
}

export function markStep(id, stepId, stepIndex) {
  const L = lesson(id);
  if (!L.stepsDone.includes(stepId)) L.stepsDone.push(stepId);
  if (typeof stepIndex === 'number') L.step = stepIndex;
  save();
}

export function completeLesson(id) {
  const L = lesson(id);
  if (L.status !== 'done') { L.status = 'done'; L.completedAt = new Date().toISOString(); }
  save();
}

export function addTime(id, ms) {
  if (!(ms > 0)) return;
  lesson(id).timeMs += Math.min(ms, 30 * 60 * 1000);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export function setLearnerName(name) { state.learner.name = String(name || '').slice(0, 80); save(); }

export function bumpLabRuns() { state.lab.runs++; save(); }
export function saveScenario(sc) { state.lab.saved.unshift(sc); state.lab.saved = state.lab.saved.slice(0, 24); save(); }
export function deleteScenario(i) { state.lab.saved.splice(i, 1); save(); }

export function resetAll() { state = blank(); save(); }
export function resetLesson(id) { delete state.lessons[id]; save(); }

export function exportJSON() { return JSON.stringify(state, null, 2); }
export function importJSON(text) {
  const s = JSON.parse(text);
  if (!s || s.version !== 1 || typeof s.lessons !== 'object') throw new Error('Not a Dams Academy progress file');
  state = Object.assign(blank(), s);
  save();
}
