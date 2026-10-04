// Dams Academy shell: hash router and pages (home, learn, lessons, lab, teach, glossary,
// model notes).

import { MODULES, LESSONS, PLANNED, GLOSSARY, CLASSIC, allLessonIds } from './course.js';
import { SEEPAGE_3D, DEFAULT_CHALLENGE, challengeMet } from './lesson-seepage3d.js';
import { mountPlayer } from './player.js';
import { mountReading } from './reading.js';
import { Stage, preloadViewer } from './stage.js';
import { designControl, reservoirControl, instruments } from './controls.js';
import { solve, summarize, LABELS, normalize } from './solver-client.js';
import { drawSection } from './section-canvas.js';
import * as store from './store.js';
import { decodeAssignment, assignmentLink, newAssignmentId, buildReport, download, slug } from './assign.js';
import { h, append, icon, toast, Scope, fmtQ, fmtFS } from './ui.js';

const INTERACTIVE = { 'seepage-3d': SEEPAGE_3D };
const main = document.getElementById('main');
let cleanup = null;

// ------------------------------------------------------------------ theme
const THEME_KEY = 'dams-academy:theme';
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (e) { /* ignore */ }
document.getElementById('themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
});

// ------------------------------------------------------------------ router
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs || '') };
}

const PAGES = { '': pageHome, learn: pageLearn, course: pageLearn, progress: pageLearn, lesson: pageLesson, lab: pageLab, teach: pageTeach, glossary: pageGlossary, model: pageModel };

function route() {
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  delete document.body.dataset.mode;
  const { parts, query } = parseHash();
  const page = parts[0] || '';
  const navKey = page === 'course' || page === 'progress' || page === 'lesson' ? 'learn' : page === 'model' ? 'glossary' : page;
  document.querySelectorAll('[data-nav]').forEach(a => {
    const on = a.dataset.nav === navKey;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.body.dataset.page = page || 'home';
  main.innerHTML = '';
  cleanup = (PAGES[page] || pageNotFound)(parts.slice(1), query) || null;
  window.scrollTo(0, 0);
  const h1 = main.querySelector('h1, .lbar-title strong');
  document.title = (h1 && page ? h1.textContent + ' · ' : '') + 'Dams Academy';
  if (page === 'progress') document.getElementById('your-progress')?.scrollIntoView();
  main.focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);

// ------------------------------------------------------------------ helpers
const statusOf = id => (store.getState().lessons[id] || {}).status || 'new';
const STATUS_TEXT = { new: 'Not started', started: 'In progress', done: 'Complete' };

function courseProgress() {
  const ids = allLessonIds();
  const done = ids.filter(id => statusOf(id) === 'done').length;
  return { done, total: ids.length, pct: Math.round((done / ids.length) * 100) };
}

function statusIcon(id) {
  const s = statusOf(id);
  return h('span', { class: 'st-ico st-' + s, title: STATUS_TEXT[s], 'aria-label': STATUS_TEXT[s] }, s === 'done' ? icon('check') : null);
}

function footer() {
  return h('footer', { class: 'foot' },
    h('div', { class: 'foot-links' },
      h('a', { href: '#/model' }, 'How the model works'),
      h('a', { href: '#/glossary' }, 'Glossary'),
      h('a', { href: CLASSIC }, 'Classic explainer ↗'),
      h('a', { href: 'https://ian-macdonald.me/' }, 'By Ian MacDonald')),
    h('p', {}, 'Drawings and models are simplified. Permeabilities, slopes and zone dimensions are typical textbook values, not design values. Progress is stored in this browser only.'));
}

function continueTarget() {
  const S = store.getState();
  const last = S.lastLesson;
  if (last && LESSONS[last] && statusOf(last) !== 'done') return last;
  return allLessonIds().find(id => statusOf(id) !== 'done') || null;
}

function stepLabel(id) {
  const L = store.getState().lessons[id];
  if (!L || LESSONS[id].kind !== 'interactive') return null;
  const st = INTERACTIVE[id].steps[L.step || 0];
  return st ? `Step ${(L.step || 0) + 1} of ${INTERACTIVE[id].steps.length}: ${st.title}` : null;
}

// ------------------------------------------------------------------ home
function pageHome() {
  const prog = courseProgress();
  const cont = continueTarget();
  const started = Object.keys(store.getState().lessons).length > 0;
  const stageHost = h('div', { class: 'hero-stage' });
  const hero = h('section', { class: 'hero' },
    h('div', { class: 'hero-copy' },
      h('p', { class: 'eyebrow' }, 'Dam engineering, taught on a live model'),
      h('h1', {}, 'See how dams ', h('span', { class: 'cut' }, 'leak'), ', and how engineers stop them.'),
      h('p', { class: 'lede' }, 'Short, hands-on lessons on a 3D dam backed by a real seepage solver. Predict what a design change will do, test it on the model, then see why.'),
      h('div', { class: 'cta' },
        h('a', { class: 'btn big', href: '#/lesson/' + (started && cont ? cont : 'seepage-3d') }, started && cont ? 'Continue learning' : 'Start the 3D lesson', icon('next')),
        h('a', { class: 'btn ghost big', href: '#/learn' }, 'Browse the course')),
      h('p', { class: 'hero-meta' }, started ? `${prog.done} of ${prog.total} lessons complete` : 'Free · no sign-up · 30 minutes for the core lesson')),
    h('a', { class: 'hero-visual', href: '#/lesson/seepage-3d', 'aria-label': 'Open the 3D seepage lesson' }, stageHost,
      h('span', { class: 'hero-caption' }, h('b', {}, 'Solved live'), ' clay core, chimney drain, full cutoff')));

  const how = h('section', { class: 'how' },
    h('h2', { class: 'section-title' }, 'How a lesson works'),
    h('ol', { class: 'how-steps' },
      howStep('predict', 'Predict', 'Commit to an answer before you touch anything. What happens to the seepage if you add a drain?'),
      howStep('flask', 'Test it', 'Make the change on the model. The solver recomputes the flow and the numbers update beside the control.'),
      howStep('bulb', 'See why', 'Compare your prediction with the result, then read the explanation. Most people get at least one wrong.')));

  const mods = h('section', { class: 'home-course' },
    h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'The course'), h('a', { href: '#/learn', class: 'more' }, 'All lessons', icon('next'))),
    h('div', { class: 'mod-cards' }, MODULES.map((m, i) => h('a', { class: 'mod-card', href: '#/learn' },
      h('span', { class: 'mod-n' }, `Module ${i + 1}`), h('strong', {}, m.title), h('span', { class: 'mod-blurb' }, m.blurb),
      h('span', { class: 'mod-ls' }, m.lessons.map(id => h('span', { class: 'mod-l' }, statusIcon(id), LESSONS[id].title)))))));

  const bands = h('section', { class: 'bands' },
    h('div', { class: 'band' }, h('span', { class: 'eyebrow' }, 'For instructors'), h('h3', {}, 'Set a design brief with one link'),
      h('p', {}, 'Choose the site and the targets, share the link, and collect completion reports. Includes presenter mode and teacher notes for each step.'),
      h('a', { class: 'btn ghost', href: '#/teach' }, 'Instructor tools')),
    h('div', { class: 'band' }, h('span', { class: 'eyebrow' }, 'The original'), h('h3', {}, 'Dams in Section'),
      h('p', {}, 'The single-page set of animated drawings this site is built on is unchanged. The reading lessons embed its sheets.'),
      h('a', { class: 'btn ghost', href: CLASSIC }, 'Open the classic explainer ↗')));

  main.append(h('div', { class: 'page home' }, hero, how, mods, bands, footer()));

  const stage = new Stage(stageHost, { showcase: true, params: { damType: 'cored', drain: 'chimney', cutoff: 'full', foundation: 'pervious', reservoir: 0.85 }, mode: 'head', layers: { phreatic: true, particles: true, labels: false } });
  return () => stage.dispose();
}
function howStep(ic, t, p) {
  return h('li', {}, h('span', { class: 'how-ico' }, icon(ic)), h('strong', {}, t), h('p', {}, p));
}

// ------------------------------------------------------------------ learn (course + progress)
function pageLearn() {
  const S = store.getState();
  const prog = courseProgress();
  const cont = continueTarget();

  const head = h('header', { class: 'page-head' },
    h('p', { class: 'eyebrow' }, 'Learn'),
    h('h1', {}, 'Dams: water, waste and seepage'),
    h('p', { class: 'lede' }, 'Three modules. Reading lessons walk through a sheet of the classic explainer with a short check; the core lesson is a guided experiment on the 3D model.'),
    h('div', { class: 'meter' }, h('div', { class: 'progressbar', role: 'progressbar', 'aria-valuenow': prog.pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Course progress' }, h('i', { style: { width: prog.pct + '%' } })),
      h('span', {}, `${prog.done} of ${prog.total} lessons complete`)));

  const contCard = cont && Object.keys(S.lessons).length ? h('a', { class: 'continue', href: '#/lesson/' + cont },
    h('span', { class: 'eyebrow' }, statusOf(cont) === 'new' ? 'Up next' : 'Continue where you left off'),
    h('strong', {}, LESSONS[cont].title),
    h('span', { class: 'muted' }, stepLabel(cont) || LESSONS[cont].summary),
    h('span', { class: 'btn' }, statusOf(cont) === 'new' ? 'Start' : 'Continue', icon('next'))) : null;

  const modules = MODULES.map((m, i) => h('section', { class: 'module' },
    h('div', { class: 'module-head' }, h('span', { class: 'mod-n' }, `Module ${i + 1}`), h('h2', {}, m.title), h('p', {}, m.blurb)),
    h('div', { class: 'lrows' }, m.lessons.map(lessonRow))));

  const planned = h('section', { class: 'module planned' },
    h('div', { class: 'module-head' }, h('span', { class: 'mod-n' }, 'In development'), h('h2', {}, 'Coming next'), h('p', {}, 'Planned lessons on the same engine. Each needs its own model and solver checks before it ships.')),
    h('div', { class: 'planned-grid' }, PLANNED.map(p => h('div', { class: 'planned-item' }, h('strong', {}, p.title), h('span', {}, p.note)))));

  main.append(h('div', { class: 'page' }, head, contCard, modules, planned, progressSection(), footer()));
  // warm up the 3D viewer so lessons open quickly
  (window.requestIdleCallback || setTimeout)(preloadViewer);
  // thumbnail for the core lesson
  const thumb = main.querySelector('canvas.lrow-thumb');
  if (thumb) solve({ damType: 'homogeneous', drain: 'chimney', cutoff: 'none', foundation: 'tight', reservoir: 0.85 }).then(r => drawSection(thumb, r, { mode: 'head', scale: 4 })).catch(() => {});
}

function lessonRow(id) {
  const L = LESSONS[id], st = store.getState().lessons[id], s = statusOf(id);
  const score = st && st.quiz ? `${st.quiz.score}/${st.quiz.total}` : null;
  return h('a', { class: `lrow st-${s}${L.core ? ' core' : ''}`, href: '#/lesson/' + id },
    statusIcon(id),
    h('span', { class: 'lrow-main' },
      h('span', { class: 'lrow-kind' }, L.core ? [icon('cube'), '3D interactive'] : [icon('book'), `Reading · ${L.sheet}`], ` · ${L.mins} min`),
      h('strong', {}, L.title),
      h('span', { class: 'lrow-sum' }, L.summary),
      L.core && s === 'started' && stepLabel(id) ? h('span', { class: 'lrow-step' }, stepLabel(id)) : null),
    L.core ? h('canvas', { class: 'lrow-thumb', 'aria-hidden': 'true' }) : null,
    h('span', { class: 'lrow-end' }, score ? h('span', { class: 'chip-score', title: 'Check score' }, score) : null,
      h('span', { class: 'lrow-cta' }, s === 'done' ? 'Review' : s === 'started' ? 'Continue' : 'Start', icon('next'))));
}

function progressSection() {
  const S = store.getState();
  const all = Object.values(S.lessons);
  const preds = all.flatMap(L => Object.values(L.predictions || {}));
  const quizzes = all.filter(L => L.quiz);
  const minutes = Math.round(all.reduce((a, L) => a + (L.timeMs || 0), 0) / 60000);
  const nameIn = h('input', { type: 'text', value: S.learner.name, placeholder: 'Your name', 'aria-label': 'Your name', onchange: e => { store.setLearnerName(e.target.value); toast('Name saved'); } });
  const fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try { store.importJSON(await f.text()); toast('Progress restored'); route(); } catch (err) { toast(err.message); }
  } });
  return h('section', { class: 'progress-sec', id: 'your-progress' },
    h('h2', { class: 'section-title' }, 'Your progress'),
    h('dl', { class: 'stats wide' },
      h('div', {}, h('dt', {}, 'Lessons complete'), h('dd', {}, `${courseProgress().done}/${courseProgress().total}`)),
      h('div', {}, h('dt', {}, 'Predictions right'), h('dd', {}, preds.length ? `${preds.filter(p => p.correct).length}/${preds.length}` : '–')),
      h('div', {}, h('dt', {}, 'Check average'), h('dd', {}, quizzes.length ? `${Math.round((quizzes.reduce((a, L) => a + L.quiz.score / L.quiz.total, 0) / quizzes.length) * 100)}%` : '–')),
      h('div', {}, h('dt', {}, 'Time learning'), h('dd', {}, minutes ? `${minutes} min` : '–'))),
    h('div', { class: 'data-row' },
      h('label', { class: 'field' }, h('span', {}, 'Name on reports'), nameIn),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => {
          store.setLearnerName(nameIn.value);
          const r = buildReport('seepage-3d', SEEPAGE_3D, null);
          r.course = allLessonIds().map(id => ({ id, status: statusOf(id), quiz: (S.lessons[id] || {}).quiz || null }));
          download(`dams-academy-report-${slug(S.learner.name)}.json`, JSON.stringify(r, null, 2));
        } }, 'Download report'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => download('dams-academy-progress.json', store.exportJSON()) }, 'Back up'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => fileIn.click() }, 'Restore'), fileIn,
        h('button', { class: 'btn ghost danger', type: 'button', onclick: () => { if (confirm('Erase all progress in this browser?')) { store.resetAll(); route(); } } }, 'Erase'))),
    h('p', { class: 'muted small' }, 'Progress lives in this browser only. Back it up to move it to another device.'));
}

// ------------------------------------------------------------------ lessons
function pageLesson(parts, query) {
  const meta = LESSONS[parts[0]];
  if (!meta) return pageNotFound();
  if (meta.kind === 'interactive') {
    const raw = query.get('a');
    const assignment = raw ? decodeAssignment(raw) : null;
    if (raw && !assignment) toast('That assignment link is damaged. Opening the lesson without it.');
    const step = query.get('step') ? Math.max(0, +query.get('step') - 1) : null;
    return mountPlayer(main, INTERACTIVE[meta.id], { assignment, step });
  }
  return mountReading(main, meta);
}

// ------------------------------------------------------------------ lab
function pageLab() {
  const scope = new Scope();
  const stageHost = h('div', { class: 'lab-stage' });
  const panel = h('aside', { class: 'lab-panel' });
  const tabsHost = h('section', { class: 'lab-tabs' });
  main.append(h('div', { class: 'page wide lab' },
    h('header', { class: 'page-head compact' },
      h('div', {}, h('p', { class: 'eyebrow' }, 'Lab'), h('h1', {}, 'Seepage lab'),
        h('p', { class: 'lede' }, 'Every control unlocked. Pin a design to compare against it, or sweep the whole design space.'))),
    h('div', { class: 'lab-main' }, stageHost, panel),
    tabsHost, footer()));

  const stage = new Stage(stageHost, { params: { damType: 'homogeneous', drain: 'none', cutoff: 'none', foundation: 'tight', reservoir: 0.85 }, mode: 'head' });
  let reference = null;   // pinned design used for the deltas
  let counted = false;
  scope.add(stage.on('solved', d => { if (d.user && !counted) { store.bumpLabRuns(); counted = true; } }));

  const refNote = h('p', { class: 'muted small ref-note' });
  const inst = instruments(stage, ['q', 'fs', 'iExit', 'sf', 'split'], scope, () => reference && reference.s);
  panel.append(
    h('h2', { class: 'panel-title' }, 'Design'),
    h('div', { class: 'ctls' }, ['damType', 'drain', 'cutoff', 'foundation'].map(k => designControl(stage, k, scope)), reservoirControl(stage, scope)),
    h('h2', { class: 'panel-title' }, 'Results'), inst, refNote,
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => pin() }, 'Pin for comparison'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { store.saveScenario(Object.assign({ at: new Date().toISOString() }, stage.params)); renderSaved(); toast('Design saved'); } }, 'Save')));
  const syncRef = () => { refNote.textContent = reference ? `Changes are shown against the pinned design: ${shortLabel(reference.p)}.` : 'Pin a design to see how changes compare with it.'; };
  syncRef();

  // tabs
  const tabs = [['compare', 'Compare'], ['sweep', 'Design-space sweep'], ['saved', 'Saved designs']];
  const tabBtns = {}, tabPanels = {};
  const tabList = h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, t]) => (tabBtns[k] = h('button', { type: 'button', role: 'tab', id: 'tab-' + k, 'aria-controls': 'tp-' + k, onclick: () => showTab(k) }, t))));
  tabs.forEach(([k]) => { tabPanels[k] = h('div', { class: 'tabpanel', role: 'tabpanel', id: 'tp-' + k, 'aria-labelledby': 'tab-' + k }); });
  tabsHost.append(tabList, ...Object.values(tabPanels));
  const showTab = k => { for (const [key] of tabs) { tabBtns[key].setAttribute('aria-selected', String(key === k)); tabPanels[key].hidden = key !== k; } };
  showTab('compare');

  const pins = [];
  const shortLabel = p => `${p.damType === 'cored' ? 'clay core' : 'homogeneous'}, ${p.drain} drain, ${p.cutoff} cutoff, ${p.foundation === 'pervious' ? 'sand & gravel' : 'tight rock'}, ${Math.round(p.reservoir * 100)}%`;
  function pin() {
    if (!stage.sum) return;
    reference = { p: Object.assign({}, stage.params), s: stage.sum };
    pins.push(reference);
    syncRef(); inst.update(); renderPins(); showTab('compare');
    toast('Pinned. Changes now compare against it.');
  }
  function renderPins() {
    const P = tabPanels.compare;
    P.innerHTML = '';
    if (!pins.length) { P.append(h('p', { class: 'empty' }, 'No designs pinned yet. Set up a design and press “Pin for comparison”.')); return; }
    const minQ = Math.min(...pins.map(x => x.s.qTotal));
    P.append(h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, ['Design', 'Seepage L/day/m', 'Exit i', 'Safety vs heave', 'Seepage face', ''].map(t => h('th', {}, t)))),
      h('tbody', {}, pins.map((x, i) => h('tr', { class: x === reference ? 'ref' : '' },
        h('td', {}, shortLabel(x.p), x === reference ? h('span', { class: 'chip-score' }, 'reference') : null),
        h('td', { class: 'num' + (x.s.qTotal === minQ && pins.length > 1 ? ' best' : '') }, fmtQ(x.s.qTotal)),
        h('td', { class: 'num' }, x.s.iExit.toFixed(2)),
        h('td', { class: 'num tone-' + (x.s.fs >= 3 ? 'ok' : x.s.fs >= 1.5 ? 'warn' : 'bad') }, fmtFS(x.s.fs)),
        h('td', {}, x.s.seepageFace ? `${x.s.seepageFaceTop.toFixed(0)} m` : 'none'),
        h('td', { class: 'acts' },
          h('button', { class: 'linkbtn', type: 'button', onclick: () => stage.set(x.p, { user: true }) }, 'Load'),
          h('button', { class: 'linkbtn', type: 'button', onclick: () => { reference = x; syncRef(); inst.update(); renderPins(); } }, 'Use as reference'),
          h('button', { class: 'linkbtn', type: 'button', onclick: () => { pins.splice(i, 1); if (reference === x) reference = null; syncRef(); inst.update(); renderPins(); } }, 'Remove'))))))));
  }
  renderPins();

  let sweepRows = [], sortKey = 'qTotal', sortDir = 1;
  const sweepBody = h('div');
  tabPanels.sweep.append(
    h('div', { class: 'sweep-head' },
      h('p', {}, 'Solves all 36 combinations of section, drain, cutoff and foundation at the current reservoir level. Rows that meet the default design brief (≤ 50 L/day/m, safety ≥ 3, no seepage face) are marked.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => sweep() }, 'Run sweep'), h('button', { class: 'btn ghost', type: 'button', onclick: () => exportSweep() }, 'Export CSV'))),
    sweepBody);
  async function sweep() {
    const res = stage.params.reservoir;
    sweepBody.innerHTML = '';
    const bar = h('div', { class: 'progressbar' }, h('i', { style: { width: '0%' } }));
    sweepBody.append(bar);
    const combos = [];
    for (const damType of ['homogeneous', 'cored']) for (const drain of ['none', 'toe', 'chimney']) for (const cutoff of ['none', 'partial', 'full']) for (const foundation of ['pervious', 'tight'])
      combos.push({ damType, drain, cutoff, foundation, reservoir: res });
    sweepRows = [];
    for (let i = 0; i < combos.length; i++) {
      const r = await solve(combos[i]);
      sweepRows.push({ p: normalize(combos[i]), s: summarize(r) });
      bar.firstChild.style.width = `${Math.round(((i + 1) / combos.length) * 100)}%`;
    }
    renderSweep();
  }
  function renderSweep() {
    const rows = sweepRows.slice().sort((a, b) => sortDir * ((a.s[sortKey] ?? 0) - (b.s[sortKey] ?? 0)));
    const th = (k, t) => h('th', { class: 'sortable' + (sortKey === k ? ' on' : ''), 'aria-sort': sortKey === k ? (sortDir > 0 ? 'ascending' : 'descending') : 'none' },
      h('button', { type: 'button', onclick: () => { sortDir = sortKey === k ? -sortDir : 1; sortKey = k; renderSweep(); } }, t, sortKey === k ? (sortDir > 0 ? ' ↑' : ' ↓') : ''));
    const maxQ = Math.max(...rows.map(r => r.s.qTotal));
    sweepBody.innerHTML = '';
    sweepBody.append(h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Section'), h('th', {}, 'Drain'), h('th', {}, 'Cutoff'), h('th', {}, 'Foundation'), th('qTotal', 'Seepage L/day/m'), th('iExit', 'Exit i'), th('fs', 'Safety'), h('th', {}, 'Brief'), h('th', {}, ''))),
      h('tbody', {}, rows.map(r => {
        const ok = challengeMet(DEFAULT_CHALLENGE, r.s).ok;
        return h('tr', { class: ok ? 'meets' : '' },
          h('td', {}, r.p.damType === 'cored' ? 'Clay core' : 'Homogeneous'), h('td', {}, r.p.drain), h('td', {}, r.p.cutoff), h('td', {}, r.p.foundation === 'pervious' ? 'sand & gravel' : 'tight rock'),
          h('td', { class: 'num' }, h('span', { class: 'qbar', style: { '--w': `${(Math.log10(1 + r.s.qTotal) / Math.log10(1 + maxQ)) * 100}%` } }), fmtQ(r.s.qTotal)),
          h('td', { class: 'num' }, r.s.iExit.toFixed(2)),
          h('td', { class: 'num tone-' + (r.s.fs >= 3 ? 'ok' : r.s.fs >= 1.5 ? 'warn' : 'bad') }, fmtFS(r.s.fs)),
          h('td', {}, ok ? (r.p.foundation === 'pervious' ? '✓' : '✓*') : ''),
          h('td', {}, h('button', { class: 'linkbtn', type: 'button', onclick: () => { stage.set(r.p, { user: true }); stageHost.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 'Load')));
      })))),
      h('p', { class: 'muted small' }, '✓ meets the default brief. ✓* meets the numbers on a tight-rock site rather than the brief’s sand-and-gravel site. Seepage bars use a log scale.'));
  }
  function exportSweep() {
    if (!sweepRows.length) { toast('Run the sweep first'); return; }
    const head = 'damType,drain,cutoff,foundation,reservoir,seepage_L_per_day_per_m,drain_L,tailwater_L,seepage_face_L,max_exit_gradient,fs_heave,seepage_face_top_m';
    const lines = sweepRows.map(r => [r.p.damType, r.p.drain, r.p.cutoff, r.p.foundation, r.p.reservoir, r.s.qTotal.toFixed(3), r.s.qDrain.toFixed(3), r.s.qTail.toFixed(3), r.s.qFace.toFixed(3), r.s.iExit.toFixed(4), isFinite(r.s.fs) ? r.s.fs.toFixed(3) : 'inf', r.s.seepageFace ? r.s.seepageFaceTop : ''].join(','));
    download(`seepage-sweep-${Math.round(sweepRows[0].p.reservoir * 100)}.csv`, [head, ...lines].join('\n'), 'text/csv');
  }

  function renderSaved() {
    const P = tabPanels.saved, list = store.getState().lab.saved;
    P.innerHTML = '';
    if (!list.length) { P.append(h('p', { class: 'empty' }, 'Nothing saved yet. Saved designs stay in this browser.')); return; }
    P.append(h('ul', { class: 'saved' }, list.map((p, i) => h('li', {}, h('span', {}, shortLabel(p)),
      h('span', { class: 'acts' }, h('button', { class: 'linkbtn', type: 'button', onclick: () => stage.set(p, { user: true }) }, 'Load'),
        h('button', { class: 'linkbtn', type: 'button', onclick: () => { store.deleteScenario(i); renderSaved(); } }, 'Delete'))))));
  }
  renderSaved();
  return () => { scope.dispose(); stage.dispose(); };
}

// ------------------------------------------------------------------ teach
function pageTeach() {
  const f = {
    title: h('input', { type: 'text', value: 'Seepage design brief', 'aria-label': 'Assignment title' }),
    teacher: h('input', { type: 'text', placeholder: 'e.g. Dr Rivera, CIVE 340', 'aria-label': 'Set by' }),
    note: h('textarea', { rows: 3, placeholder: 'Shown to students at the start of the lesson and in the design challenge', 'aria-label': 'Instructions' }),
    foundation: h('select', { 'aria-label': 'Foundation' }, h('option', { value: 'pervious' }, 'Sand and gravel (pervious)'), h('option', { value: 'tight' }, 'Tight rock')),
    reservoir: h('input', { type: 'number', min: 40, max: 95, step: 5, value: 85, 'aria-label': 'Reservoir level, percent of dam height' }),
    maxQ: h('input', { type: 'number', min: 0.5, step: 0.5, value: 50, 'aria-label': 'Maximum seepage' }),
    minFS: h('input', { type: 'number', min: 1, step: 0.5, value: 3, 'aria-label': 'Minimum safety factor against heave' }),
    noSF: h('input', { type: 'checkbox', checked: true })
  };
  const out = h('div', { class: 'assign-out' });
  const check = h('div', { class: 'assign-check' });
  let id = newAssignmentId();
  const read = () => ({
    v: 1, id, lesson: 'seepage-3d', title: f.title.value.trim() || 'Assignment', teacher: f.teacher.value.trim(), note: f.note.value.trim(),
    challenge: { foundation: f.foundation.value, reservoir: Math.min(0.95, Math.max(0.4, Math.round(+f.reservoir.value / 5) * 5 / 100)), maxQ: Math.max(0.1, +f.maxQ.value || 50), minFS: Math.max(1, +f.minFS.value || 3), noSeepageFace: f.noSF.checked }
  });
  let checkSeq = 0, debounce = null;
  function update() {
    const a = read();
    const link = assignmentLink(a);
    out.innerHTML = '';
    const linkIn = h('input', { type: 'text', readonly: true, value: link, class: 'mono', 'aria-label': 'Assignment link', onfocus: e => e.target.select() });
    out.append(
      h('div', { class: 'brief-preview' },
        h('span', { class: 'eyebrow' }, `Assignment ${a.id}`), h('strong', {}, a.title), a.teacher ? h('span', { class: 'muted' }, a.teacher) : null,
        h('ul', {}, h('li', {}, `${LABELS.foundation[a.challenge.foundation]}, reservoir at ${Math.round(a.challenge.reservoir * 100)}%`),
          h('li', {}, `Seepage ≤ ${a.challenge.maxQ} L/day per m`), h('li', {}, `Safety vs heave ≥ ${a.challenge.minFS}`), a.challenge.noSeepageFace ? h('li', {}, 'No seepage face') : null)),
      linkIn,
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch (e) { linkIn.select(); toast('Press Ctrl/Cmd+C to copy'); } } }, 'Copy link'),
        h('a', { class: 'btn ghost', href: link, target: '_blank', rel: 'noopener' }, 'Preview as a student ↗'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { id = newAssignmentId(); update(); } }, 'New ID')));
    clearTimeout(debounce);
    debounce = setTimeout(() => feasibility(a), 250);
  }
  async function feasibility(a) {
    const my = ++checkSeq;
    check.className = 'assign-check';
    check.textContent = 'Checking which designs meet this brief…';
    const ok = [];
    for (const damType of ['homogeneous', 'cored']) for (const drain of ['none', 'toe', 'chimney']) for (const cutoff of ['none', 'partial', 'full']) {
      const r = await solve({ damType, drain, cutoff, foundation: a.challenge.foundation, reservoir: a.challenge.reservoir });
      if (my !== checkSeq) return;
      if (challengeMet(a.challenge, summarize(r)).ok) ok.push(`${damType === 'cored' ? 'clay core' : 'homogeneous'} + ${drain} drain + ${cutoff} cutoff`);
    }
    check.innerHTML = '';
    check.className = 'assign-check ' + (ok.length ? 'ok' : 'bad');
    append(check, ok.length
      ? [h('strong', {}, `${ok.length} of 18 designs meet this brief.`), h('span', {}, ` ${ok.slice(0, 4).join('; ')}${ok.length > 4 ? '; …' : ''}`)]
      : [h('strong', {}, 'No design meets this brief.'), h('span', {}, ' Loosen a target, or students cannot finish the challenge.')]);
  }
  Object.values(f).forEach(el => el.addEventListener('input', update));
  const field = (label, el, hint) => h('label', { class: 'field' }, h('span', {}, label), el, hint ? h('small', {}, hint) : null);

  // report review
  const reviewBody = h('div');
  const drop = h('label', { class: 'drop' },
    h('input', { type: 'file', accept: 'application/json', multiple: true, onchange: e => review([...e.target.files]) }),
    h('strong', {}, 'Drop student reports here'), h('span', {}, 'or click to choose .json files'));
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); review([...e.dataTransfer.files]); });
  let reviewed = [];
  async function review(files) {
    for (const file of files) {
      try {
        const r = JSON.parse(await file.text());
        if (r.kind !== 'dams-academy-report') throw new Error('not a report');
        reviewed.push(r);
      } catch (e) { toast(`${file.name}: not a Dams Academy report`); }
    }
    renderReview();
  }
  function renderReview() {
    reviewBody.innerHTML = '';
    if (!reviewed.length) return;
    reviewBody.append(h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, ['Learner', 'Assignment', 'Status', 'Checkpoint', 'Predictions', 'Brief', 'Final design', 'Time'].map(t => h('th', {}, t)))),
      h('tbody', {}, reviewed.map(r => h('tr', {},
        h('td', {}, r.learner || '(no name)'),
        h('td', { class: 'mono' }, r.assignment ? r.assignment.id || r.assignment.title : '–'),
        h('td', {}, r.status),
        h('td', { class: 'num' }, r.quiz ? `${r.quiz.score} / ${r.quiz.total}` : '–'),
        h('td', { class: 'num' }, r.predictions ? `${r.predictions.correct} / ${r.predictions.total}` : '–'),
        h('td', {}, r.challenge && r.challenge.met ? `met (${r.challenge.attempts} tried)` : 'not met'),
        h('td', { class: 'small' }, r.challenge && r.challenge.design ? `${r.challenge.design.damType}, ${r.challenge.design.drain} drain, ${r.challenge.design.cutoff} cutoff` : '–'),
        h('td', { class: 'num' }, `${r.minutes} min`)))))),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => {
          const head = 'learner,assignment,status,quiz_score,quiz_total,predictions_correct,predictions_total,brief_met,attempts,dam,drain,cutoff,minutes,completed_at';
          const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
          const lines = reviewed.map(r => [q(r.learner), q(r.assignment && r.assignment.id), r.status, r.quiz ? r.quiz.score : '', r.quiz ? r.quiz.total : '', r.predictions ? r.predictions.correct : '', r.predictions ? r.predictions.total : '',
            r.challenge && r.challenge.met ? 'yes' : 'no', r.challenge ? r.challenge.attempts : '', r.challenge && r.challenge.design ? r.challenge.design.damType : '', r.challenge && r.challenge.design ? r.challenge.design.drain : '', r.challenge && r.challenge.design ? r.challenge.design.cutoff : '', r.minutes, q(r.completedAt)].join(','));
          download('dams-academy-gradebook.csv', [head, ...lines].join('\n'), 'text/csv');
        } }, 'Export gradebook CSV'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { reviewed = []; renderReview(); } }, 'Clear')),
      h('p', { class: 'muted small' }, 'Reports come from each student’s browser and are not tamper-proof. Use them for formative feedback, not high-stakes grading.'));
  }

  const notes = SEEPAGE_3D.steps.map((s, i) => h('li', {}, h('a', { href: `#/lesson/seepage-3d?step=${i + 1}` }, s.title), h('p', {}, s.notes || '')));

  main.append(h('div', { class: 'page' },
    h('header', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Instructors'), h('h1', {}, 'Teach with Dams Academy'),
      h('p', { class: 'lede' }, 'No accounts and no server. Set a design brief, share one link, and collect the reports students download at the end.')),
    h('div', { class: 'teach-steps' },
      h('section', { class: 'card' }, h('span', { class: 'step-n' }, '1'), h('h2', {}, 'Write the brief'),
        h('div', { class: 'form' },
          field('Title', f.title), field('Set by', f.teacher), field('Instructions', f.note),
          h('fieldset', { class: 'brief-fields' }, h('legend', {}, 'Design challenge'),
            field('Site', f.foundation), field('Reservoir level, % of height', f.reservoir, '40–95, in steps of 5'),
            field('Max seepage, L/day per m', f.maxQ), field('Min safety vs heave', f.minFS),
            h('label', { class: 'check' }, f.noSF, h('span', {}, 'No seepage face allowed')))),
        check),
      h('section', { class: 'card' }, h('span', { class: 'step-n' }, '2'), h('h2', {}, 'Share the link'),
        h('p', { class: 'muted small' }, 'The brief travels inside the link. Everyone who opens it gets the same lesson and challenge.'), out),
      h('section', { class: 'card' }, h('span', { class: 'step-n' }, '3'), h('h2', {}, 'Collect reports'),
        h('p', { class: 'muted small' }, 'Students download a report at the end of the lesson. Drop a batch here to tabulate them. Nothing is uploaded.'), drop, reviewBody)),
    h('section', { class: 'card' }, h('h2', {}, 'In the lecture room'),
      h('p', {}, 'In a lesson, open the ', h('strong', {}, '⋯'), ' menu for ', h('strong', {}, 'Presenter mode'), ' (larger type) and ', h('strong', {}, 'Teacher notes'), ' (discussion prompts under each step). The arrow keys move between steps, and each step can be linked directly:'),
      h('ol', { class: 'notes-list' }, notes)),
    footer()));
  update();
}

// ------------------------------------------------------------------ glossary
function pageGlossary() {
  const q = h('input', { type: 'search', placeholder: 'Search terms', 'aria-label': 'Search the glossary' });
  const list = h('dl', { class: 'glossary' });
  const render = () => {
    const s = q.value.trim().toLowerCase();
    list.innerHTML = '';
    GLOSSARY.filter(([t, d]) => !s || t.toLowerCase().includes(s) || d.toLowerCase().includes(s)).forEach(([t, d, l]) =>
      list.append(h('div', { class: 'gterm' }, h('dt', {}, t), h('dd', {}, d), h('dd', { class: 'gsrc' }, h('a', { href: '#/lesson/' + l }, LESSONS[l].title, icon('next'))))));
    if (!list.children.length) list.append(h('p', { class: 'empty' }, 'No matching terms.'));
  };
  q.addEventListener('input', render);
  render();
  main.append(h('div', { class: 'page narrow' },
    h('header', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Reference'), h('h1', {}, 'Glossary'), h('p', { class: 'lede' }, 'The terms the lessons use, with the lesson where each one comes up.'), q),
    list,
    h('p', { class: 'muted' }, 'How the model behind the lessons works: ', h('a', { href: '#/model' }, 'model notes'), '.'),
    footer()));
}

// ------------------------------------------------------------------ model notes
function pageModel() {
  main.append(h('div', { class: 'page narrow' },
    h('header', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Reference'), h('h1', {}, 'How the model works'),
      h('p', { class: 'lede' }, 'What is solved, what is drawn, and where the model stops being right.')),
    h('article', { class: 'prose doc', html: `
<h2>The solver</h2>
<p>Every number in the lessons comes from <code>seepage-solver.js</code>, the same solver as the classic explainer’s seepage lab. It solves steady 2D saturated–unsaturated seepage,</p>
<p class="eq">∇·( K · k<sub>r</sub>(ψ) · ∇h ) = 0,&nbsp;&nbsp; h = z + ψ</p>
<p>on a 1 m finite-volume grid (170 × 39 cells) through a 24 m embankment with 2H:1V slopes and its foundation. Relative conductivity follows Gardner’s exponential model above the phreatic surface. The nonlinear system is solved with Picard iterations and then damped Newton, with direct banded linear solves, so conductivity contrasts from 10⁻⁴ to 10⁻⁹ m/s are no problem. Seepage faces and drains are one-way boundaries, found by an active-set iteration. Flow lines are traced with Pollock’s method.</p>
<table class="data"><thead><tr><th>Material</th><th>K (m/s)</th></tr></thead><tbody>
<tr><td>Rockfill shell</td><td class="num">1 × 10⁻⁴</td></tr><tr><td>Sand and gravel foundation</td><td class="num">1 × 10⁻⁵</td></tr>
<tr><td>Homogeneous fill</td><td class="num">1 × 10⁻⁷</td></tr><tr><td>Tight foundation</td><td class="num">5 × 10⁻⁸</td></tr>
<tr><td>Clay core</td><td class="num">1 × 10⁻⁹</td></tr></tbody></table>
<h2>The 3D view</h2>
<p>The solver computes flow <em>per metre of dam length</em>, the plane-flow assumption used for long dams. The 3D model shows that section on the cut face and carries the phreatic surface and flow particles along the valley floor. Near the abutments real flow is three-dimensional. That path is not modelled, and the phreatic sheet simply stops where the valley walls rise above it.</p>
<p>Particle speeds on screen scale with the square root of the true seepage velocity, so slow paths stay visible. Real velocities span several orders of magnitude.</p>
<h2>Readouts</h2>
<ul>
<li><strong>Seepage</strong>: total inflow from the reservoir, in litres per day per metre of dam, split between the drain, the ground beyond the toe and the seepage face.</li>
<li><strong>Exit gradient</strong>: the steepest gradient where water leaves the soil, on the ground surface or on the seepage face. Values right at the toe depend on grid size, so read them as indicative.</li>
<li><strong>Safety vs heave</strong>: critical gradient (1.0) ÷ exit gradient.</li>
</ul>
<h2>Validation</h2>
<p><code>node tests/test-seepage.js</code> runs all 36 design combinations plus reservoir sweeps and checks mass balance and physical sanity: drains lower the phreatic surface, full cutoffs cut foundation flow, flow rises with head. <code>node tests/test-academy.js</code> checks that every claim in the lesson text matches the solver.</p>
<h2>Not modelled</h2>
<ul><li>Anisotropy, layering inside the fill, and transient effects (filling, rapid drawdown).</li><li>Filter compatibility and internal erosion: a drain here never clogs.</li><li>Slope stability, settlement and earthquakes.</li><li>3D flow around the abutments.</li></ul>
<p class="muted">Typical textbook values, not design values. For design, use site investigation data and qualified engineering judgement.</p>
<h2>Roadmap</h2>
<p>The lessons run on a general engine: steps with a scene, a prediction, inline controls, live-checked tasks, explanations, briefs and quizzes. Planned lessons:</p>
<ul>${PLANNED.map(p => `<li><strong>${p.title}</strong>: ${p.note}</li>`).join('')}</ul>` }),
    footer()));
}

function pageNotFound() {
  main.append(h('div', { class: 'page narrow' }, h('h1', {}, 'Page not found'), h('p', {}, h('a', { href: '#/' }, 'Back to the start'))));
}

route();
