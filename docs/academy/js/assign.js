// Assignments and completion reports. There is no server: an assignment is encoded into
// the lesson link, and a learner's completion report is a JSON file they hand in. The
// instructor drops a batch of reports onto the Teach page to tabulate them.

import { DEFAULT_CHALLENGE } from './lesson-seepage3d.js';
import { getState, lesson as lessonState } from './store.js';

const b64u = {
  enc: s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))
};

export function encodeAssignment(a) { return b64u.enc(JSON.stringify(a)); }

export function decodeAssignment(s) {
  try {
    const a = JSON.parse(b64u.dec(s));
    if (!a || a.v !== 1) return null;
    a.challenge = Object.assign({}, DEFAULT_CHALLENGE, a.challenge || {});
    a.title = String(a.title || 'Assignment').slice(0, 120);
    a.note = String(a.note || '').slice(0, 1200);
    a.teacher = String(a.teacher || '').slice(0, 80);
    a.id = String(a.id || '').slice(0, 40);
    return a;
  } catch (e) {
    return null;
  }
}

export function assignmentLink(a) {
  const base = location.href.split('#')[0];
  return `${base}#/lesson/${a.lesson}?a=${encodeAssignment(a)}`;
}

export function newAssignmentId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function buildReport(lessonId, lessonDef, assignment) {
  const L = lessonState(lessonId);
  const preds = Object.values(L.predictions || {});
  return {
    kind: 'dams-academy-report', v: 1,
    learner: getState().learner.name || '',
    lesson: lessonId,
    lessonTitle: lessonDef ? lessonDef.title : lessonId,
    assignment: assignment ? { id: assignment.id, title: assignment.title, challenge: assignment.challenge } : null,
    status: L.status,
    startedAt: L.startedAt, completedAt: L.completedAt,
    minutes: Math.round(L.timeMs / 60000),
    steps: { done: L.stepsDone.length, total: lessonDef && lessonDef.steps ? lessonDef.steps.length : null },
    predictions: { correct: preds.filter(p => p.correct).length, total: preds.length, detail: L.predictions },
    quiz: L.quiz,
    challenge: L.challenge,
    generatedAt: new Date().toISOString(),
    note: 'Self-reported from the learner’s browser; not tamper-proof.'
  };
}

export function download(name, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function slug(s) { return String(s || 'learner').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'learner'; }
