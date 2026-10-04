// Lesson player for interactive lessons.
//
// Layout: a slim lesson bar (exit, title, step progress, menu) over a full-bleed 3D stage,
// with the narrative panel floating on the left (stacked below the model on phones).
// Each step runs predict -> try it -> explain: the prediction is committed first, then the
// one control the step needs appears inline with live readouts, and doing the experiment
// reveals what happened and why.

import { Stage } from './stage.js';
import { controlFor, instruments } from './controls.js';
import { mountQuiz } from './quiz.js';
import { DEFAULT_CHALLENGE } from './lesson-seepage3d.js';
import * as store from './store.js';
import { buildReport, download, slug } from './assign.js';
import { LABELS, designLabel } from './solver-client.js';
import { h, icon, popover, reveal, Scope, fmtQ, fmtFS } from './ui.js';

const pickSum = s => (s ? { qTotal: s.qTotal, qDrain: s.qDrain, qTail: s.qTail, qFace: s.qFace, fs: s.fs, iExit: s.iExit, seepageFace: s.seepageFace, seepageFaceTop: s.seepageFaceTop } : null);

export function mountPlayer(main, def, opts = {}) {
  const assignment = opts.assignment || null;
  const challenge = assignment ? assignment.challenge : DEFAULT_CHALLENGE;
  const L0 = store.touchLesson(def.id);
  // a finished lesson reopens at the start (for review); an unfinished one where it was left
  let idx = Math.max(0, Math.min(opts.step != null ? opts.step : L0.status === 'done' ? 0 : L0.step || 0, def.steps.length - 1));
  let notesOn = false;
  let baseline = null, token = 0;
  let attempts = new Set();
  const scope = new Scope();       // listeners owned by the current step card
  const life = new Scope();        // listeners owned by the player

  document.body.dataset.mode = 'lesson';
  main.innerHTML = '';

  // ---- lesson bar
  const segs = def.steps.map((s, i) => h('li', {}, h('button', { type: 'button', title: `${i + 1}. ${s.title}`, 'aria-label': `Step ${i + 1}: ${s.title}`, onclick: () => go(i) })));
  const presentBtn = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: () => {
    const on = presentBtn.getAttribute('aria-pressed') !== 'true';
    presentBtn.setAttribute('aria-pressed', String(on));
    document.body.classList.toggle('present', on);
  } }, 'Presenter mode');
  const notesBtn = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: () => {
    notesOn = !notesOn;
    notesBtn.setAttribute('aria-pressed', String(notesOn));
    renderCard();
  } }, 'Teacher notes');
  const menuPanel = h('div', { class: 'menu-panel' },
    h('div', { class: 'chips' }, presentBtn, notesBtn),
    h('hr'),
    h('button', { type: 'button', class: 'menu-item', onclick: () => { if (confirm('Restart this lesson? Your predictions and answers for it will be cleared.')) { store.resetLesson(def.id); store.touchLesson(def.id); menu.close(); go(0, true); } } }, 'Restart lesson'),
    h('p', { class: 'menu-hint' }, 'Arrow keys move between steps.'));
  const menuBtn = h('button', { type: 'button', class: 'tool-btn icon-only', 'aria-label': 'Lesson options', title: 'Lesson options' }, icon('more'));
  const menu = popover(menuBtn, menuPanel);
  life.add(menu.dispose);
  const bar = h('header', { class: 'lbar' },
    h('a', { class: 'lbar-exit', href: '#/', title: 'All lessons' }, '← ', h('span', {}, 'Lessons')),
    h('div', { class: 'lbar-title' }, assignment ? h('span', {}, `Assignment · ${assignment.title}`) : null, h('h1', {}, def.title)),
    h('ol', { class: 'lbar-steps', 'aria-label': 'Lesson steps' }, segs),
    menu);

  // ---- body: stage + panel
  const stageHost = h('div', { class: 'lstage' });
  const kicker = h('p', { class: 'lp-kicker' });
  const title = h('h2', { class: 'lp-title', tabindex: '-1' });
  const content = h('div', { class: 'lp-content' });
  const scroll = h('div', { class: 'lp-scroll' }, h('header', { class: 'lp-head' }, kicker, title), content);
  const backBtn = h('button', { type: 'button', class: 'btn', onclick: () => go(idx - 1) }, '← Back');
  const nextBtn = h('button', { type: 'button', class: 'btn', onclick: () => (idx === def.steps.length - 1 ? (location.hash = '#/') : go(idx + 1)) });
  const foot = h('footer', { class: 'lp-foot' }, backBtn, nextBtn);
  const panel = h('section', { class: 'lpanel', 'aria-label': 'Lesson step' }, scroll, foot);
  const lbody = h('div', { class: 'lbody' }, stageHost, panel);
  const root = h('div', { class: 'lesson' }, bar, lbody);
  main.append(root);

  const stage = new Stage(stageHost, { params: (def.steps[idx].scene || {}).params, fullscreenTarget: root });

  // keep the model centred in the part of the stage the panel doesn't cover
  const fitInset = () => {
    const sr = stageHost.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    const overlaps = pr.top < sr.bottom - 40 && pr.bottom > sr.top + 40 && pr.left < sr.left + sr.width / 2;
    stage.setInset(overlaps ? Math.max(0, pr.right - sr.left + 12) : 0);
  };
  const ro = new ResizeObserver(fitInset);
  ro.observe(lbody); ro.observe(panel);
  life.add(() => ro.disconnect());

  // live checks
  for (const ev of ['solved', 'mode', 'layer', 'view', 'interact']) life.add(stage.on(ev, d => {
    if (ev === 'solved' && d.user && def.steps[idx].challenge) attempts.add([d.params.damType, d.params.drain, d.params.cutoff].join('/'));
    evaluate();
  }));

  // time on task
  let last = performance.now();
  const tick = setInterval(() => { if (!document.hidden) store.addTime(def.id, performance.now() - last); last = performance.now(); }, 15000);
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  life.add(() => { clearInterval(tick); store.addTime(def.id, performance.now() - last); document.removeEventListener('visibilitychange', onVis); });

  const onKey = e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable], [role=radiogroup], .pop')) return;
    if (e.key === 'ArrowRight') { go(idx + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(idx - 1); e.preventDefault(); }
  };
  document.addEventListener('keydown', onKey);
  life.add(() => document.removeEventListener('keydown', onKey));

  // ---- step state
  const lessonState = () => store.lesson(def.id);
  const isDone = step => lessonState().stepsDone.includes(step.id);
  function phaseOf(step) {
    if (step.quiz || step.summary || !step.task) return 'static';
    if (step.predict && !lessonState().predictions[step.id]) return 'predict';
    return isDone(step) ? 'done' : 'try';
  }

  function ctx() {
    return {
      params: stage.params, sum: stage.sum, mode: stage.mode, layers: stage.layers, view: stage.view,
      interacted: stage.interacted, viewChanged: stage.viewChanged, tried: stage.tried, challenge
    };
  }

  function go(i, force) {
    if (i < 0 || i >= def.steps.length || (i === idx && !force)) return;
    idx = i;
    store.updateLesson(def.id, { step: idx });
    enterStep();
  }

  function enterStep() {
    const step = def.steps[idx];
    const my = ++token;
    baseline = null;
    attempts = new Set();
    const scene = Object.assign({}, step.scene || {});
    if (step.challenge) scene.params = Object.assign({}, scene.params, { foundation: challenge.foundation, reservoir: challenge.reservoir });
    if (step.summary) { store.markStep(def.id, step.id); store.completeLesson(def.id); }
    stage.applyScene(scene).then(sum => {
      if (my !== token) return;
      baseline = pickSum(sum || stage.sum);
      if (instEl) instEl.update();
      evaluate();
    });
    renderBar();
    renderCard();
    scroll.scrollTop = 0;
    if (window.matchMedia('(max-width: 860px)').matches) root.scrollIntoView({ block: 'start' });
    title.focus({ preventScroll: true });
  }

  function renderBar() {
    const done = new Set(lessonState().stepsDone);
    segs.forEach((li, i) => {
      li.className = (i === idx ? 'cur ' : '') + (done.has(def.steps[i].id) ? 'done' : '');
      li.firstChild.setAttribute('aria-current', i === idx ? 'step' : 'false');
    });
  }

  // ---- card
  let tryEl = null, taskEl = null, explainEl = null, followEl = null, briefEl = null, instEl = null;

  function renderCard() {
    scope.dispose();
    const step = def.steps[idx];
    const phase = phaseOf(step);
    content.innerHTML = '';
    tryEl = taskEl = explainEl = followEl = briefEl = instEl = null;
    kicker.textContent = `Step ${idx + 1} of ${def.steps.length}`;
    title.textContent = step.title;

    if (assignment && assignment.note && (idx === 0 || step.challenge)) {
      content.append(h('aside', { class: 'blk blk-assign' }, h('strong', {}, assignment.title), assignment.teacher ? h('span', {}, ` · ${assignment.teacher}`) : null, h('p', {}, assignment.note)));
    }
    if (step.body) content.append(h('div', { class: 'prose', html: step.body }));
    if (step.predict) content.append(renderPredict(step, phase));
    if (phase === 'try' || phase === 'done') content.append(renderTry(step));
    if (phase === 'done') content.append(renderExplain(step));
    if (step.quiz) content.append(renderQuiz(step));
    if (step.summary) content.append(renderSummary());
    if (notesOn && step.notes) content.append(h('aside', { class: 'blk blk-notes' }, h('strong', {}, 'Teacher notes'), h('p', {}, step.notes)));
    renderFoot();
    evaluate();
  }

  function renderPredict(step, phase) {
    const P = step.predict, ans = lessonState().predictions[step.id];
    if (phase === 'predict') {
      return h('div', { class: 'blk blk-predict' },
        h('div', { class: 'blk-tag' }, 'Predict'),
        h('p', { class: 'blk-q' }, P.q),
        h('div', { class: 'choices' }, P.options.map((o, i) => h('button', { type: 'button', class: 'choice', onclick: () => {
          const L = lessonState();
          L.predictions[step.id] = { choice: i, correct: !!o.correct, at: new Date().toISOString() };
          store.updateLesson(def.id, {});
          renderCard();
          if (tryEl) { reveal(tryEl); tryEl.querySelector('.blk-tag').focus({ preventScroll: true }); }
        } }, h('span', { class: 'letter' }, String.fromCharCode(65 + i)), h('span', {}, o.t)))));
    }
    const o = P.options[ans.choice];
    return h('div', { class: 'blk blk-predicted' },
      h('span', { class: 'blk-tag' }, 'Your prediction'),
      h('p', {}, h('span', { class: 'letter' }, String.fromCharCode(65 + ans.choice)), h('span', {}, o ? o.t : '')));
  }

  function renderTry(step) {
    const kids = [h('div', { class: 'blk-tag', tabindex: '-1' }, step.challenge ? 'Brief' : 'Try it')];
    if (step.challenge) { briefEl = h('div', { class: 'brief' }); kids.push(briefEl); }
    taskEl = h('p', { class: 'task' });
    if (!step.challenge) kids.push(taskEl);
    const ctrls = (step.controls || []).map(k => controlFor(stage, k, scope)).filter(Boolean);
    if (ctrls.length) kids.push(h('div', { class: 'ctls' }, ctrls));
    if (step.instruments && step.instruments.length) {
      instEl = instruments(stage, step.instruments, scope, () => baseline);
      kids.push(instEl);
    }
    if (step.challenge) kids.push(taskEl);
    tryEl = h('div', { class: 'blk blk-try' }, kids);
    return tryEl;
  }

  function renderExplain(step) {
    const ans = step.predict ? lessonState().predictions[step.id] : null;
    const kids = [h('div', { class: 'blk-tag' }, step.challenge ? 'Brief met' : 'Result')];
    if (ans) {
      const right = step.predict.options.findIndex(o => o.correct);
      kids.push(h('p', { class: 'verdict ' + (ans.correct ? 'ok' : 'bad') },
        ans.correct ? `Correct: ${step.predict.options[right].t.toLowerCase()}.` : `Incorrect. The answer is ${String.fromCharCode(65 + right)}: ${step.predict.options[right].t.toLowerCase()}.`));
    }
    if (step.challenge) {
      const ch = lessonState().challenge;
      if (ch && ch.design) kids.push(h('p', { class: 'muted small' }, `Your design: ${designLabel(ch.design).toLowerCase()}.`));
    }
    const explain = typeof step.explain === 'function' ? step.explain({ challenge }) : step.explain;
    if (explain) kids.push(h('div', { class: 'prose', html: explain }));
    if (step.followUp) { followEl = h('p', { class: 'task follow' }); kids.push(h('div', { class: 'follow-wrap' }, h('span', { class: 'follow-tag' }, 'Also try'), followEl)); }
    explainEl = h('div', { class: 'blk blk-explain' }, kids);
    return explainEl;
  }

  function renderQuiz(step) {
    const wrap = h('div', { class: 'blk blk-quiz' });
    mountQuiz(wrap, step.quiz, {
      previous: lessonState().quiz,
      onFinish: res => { store.updateLesson(def.id, { quiz: res }); store.markStep(def.id, step.id); renderBar(); renderFoot(); }
    });
    return wrap;
  }

  function renderSummary() {
    const L = lessonState();
    const preds = Object.values(L.predictions);
    const facts = [
      `${preds.filter(p => p.correct).length} of ${preds.length} predictions right`,
      L.quiz ? `quiz ${L.quiz.score} of ${L.quiz.total}` : 'quiz not taken',
      L.challenge && L.challenge.met ? `brief met after ${L.challenge.attempts} design${L.challenge.attempts === 1 ? '' : 's'}` : 'brief not met',
      `${Math.max(1, Math.round(L.timeMs / 60000))} min`
    ];
    const name = h('input', { type: 'text', placeholder: 'Your name', value: store.getState().learner.name, 'aria-label': 'Your name, for the report', onchange: e => store.setLearnerName(e.target.value) });
    return h('div', { class: 'blk blk-summary' },
      h('div', { class: 'blk-tag' }, 'Your record'),
      h('p', {}, facts.join(' · ') + '.'),
      h('div', { class: 'report' },
        h('label', { class: 'field' }, h('span', {}, 'Name on report'), name),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => {
            store.setLearnerName(name.value);
            const r = buildReport(def.id, def, assignment);
            download(`dams-academy-${def.id}-${slug(r.learner)}.json`, JSON.stringify(r, null, 2));
          } }, 'Download report'),
          h('button', { type: 'button', class: 'btn', onclick: () => { const url = stage.snapshot(); if (!url) return; const a = document.createElement('a'); a.href = url; a.download = 'dam-model.png'; a.click(); } }, 'Save image'))),
      h('ul', { class: 'next-links' },
        h('li', {}, h('a', { href: '#/lab' }, 'Seepage lab'), ': all design options, and all 36 combinations solved at once.'),
        h('li', {}, h('a', { href: '../index.html#seepage' }, 'Sheet 4 of Dams in Section'), ': piping, uplift under a gravity dam, and the full list of defences.')));
  }

  function renderFoot() {
    const step = def.steps[idx];
    const phase = phaseOf(step);
    const ready = phase === 'static' ? (!step.quiz || isDone(step)) : phase === 'done';
    backBtn.disabled = idx === 0;
    const last = idx === def.steps.length - 1;
    nextBtn.innerHTML = '';
    nextBtn.append(last ? 'Finish' : ready ? 'Next →' : 'Skip →');
    nextBtn.className = 'btn' + (ready ? ' primary' : '');
  }

  function evaluate() {
    const step = def.steps[idx];
    const c = ctx();
    if (briefEl) renderBrief(c);
    if (!step.task || !taskEl) return;
    // checks wait for the step's own scene to be solved, so a stale result never passes
    let ok = false;
    try { ok = !!(baseline && c.sum && step.task.check(c)); } catch (e) { ok = false; }
    if (ok && !isDone(step)) {
      const L = lessonState();
      L.observed = L.observed || {};
      L.observed[step.id] = { base: baseline, cur: pickSum(c.sum) };
      if (step.challenge) L.challenge = { met: true, design: Object.assign({}, c.params), qTotal: c.sum.qTotal, fs: c.sum.fs, attempts: Math.max(1, attempts.size), at: new Date().toISOString() };
      store.markStep(def.id, step.id);
      renderBar();
      renderFoot();
      tryEl.after(renderExplain(step));
      reveal(explainEl);
    }
    const shown = ok || isDone(step);
    taskEl.className = 'task' + (shown ? ' done' : '');
    taskEl.innerHTML = '';
    taskEl.append(icon(shown ? 'check' : 'next', 'task-ico'), h('span', {}, step.task.text));
    if (!shown && step.task.nudge) {
      let n = null;
      try { n = baseline ? step.task.nudge(c) : null; } catch (e) { n = null; }
      if (n) taskEl.append(h('span', { class: 'nudge' }, n));
    }
    if (followEl && step.followUp) {
      let f = followEl.classList.contains('done');
      try { f = f || !!step.followUp.check(c); } catch (e) { /* keep */ }
      followEl.className = 'task follow' + (f ? ' done' : '');
      followEl.innerHTML = '';
      followEl.append(icon(f ? 'check' : 'next', 'task-ico'), h('span', {}, step.followUp.text));
    }
  }

  function renderBrief(c) {
    const s = baseline ? c.sum : null;   // don't grade a stale result from the previous step
    const row = (label, ok, val) => h('li', { class: ok == null ? '' : ok ? 'ok' : 'bad' }, icon(ok === false ? 'cross' : 'check', 'mk'), h('span', {}, label), h('b', {}, val));
    briefEl.innerHTML = '';
    briefEl.append(
      h('p', { class: 'brief-site' }, `${LABELS.foundation[challenge.foundation]} · reservoir at ${Math.round(challenge.reservoir * 100)}% (${(challenge.reservoir * 24).toFixed(1)} m)`),
      h('ul', { class: 'targets' },
        row(`Seepage ≤ ${challenge.maxQ} L/day per m`, s ? s.qTotal <= challenge.maxQ : null, s ? fmtQ(s.qTotal) : '–'),
        row(`Exit safety factor ≥ ${challenge.minFS}`, s ? s.fs >= challenge.minFS : null, s ? fmtFS(s.fs) : '–'),
        challenge.noSeepageFace ? row('No seepage face', s ? !s.seepageFace : null, s ? (s.seepageFace ? `${s.seepageFaceTop.toFixed(0)} m` : 'none') : '–') : null),
      h('p', { class: 'muted small' }, `Designs tried: ${attempts.size}`));
  }

  enterStep();

  return () => {
    token++;
    scope.dispose();
    life.dispose();
    stage.dispose();
    document.body.classList.remove('present');
    delete document.body.dataset.mode;
  };
}
