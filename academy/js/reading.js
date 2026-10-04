// Reading lessons: the sheet from the classic explainer, embedded in the page (only that
// sheet is shown), with objectives and a one-question-at-a-time check alongside.

import { LESSONS, CLASSIC, allLessonIds } from './course.js';
import { mountQuiz } from './quiz.js';
import * as store from './store.js';
import { h, icon } from './ui.js';

export function mountReading(main, L) {
  store.touchLesson(L.id);
  document.body.dataset.mode = 'lesson';
  const ids = allLessonIds();
  const nextId = ids[ids.indexOf(L.id) + 1];
  const sheetId = L.href.split('#')[1];

  const frame = h('iframe', { class: 'rd-frame', title: `${L.sheet}: ${L.title}`, src: `${CLASSIC}?embed=${sheetId}`, loading: 'eager' });
  const status = h('p', { class: 'rd-status muted small' });
  const after = h('div', { class: 'rd-after' });
  const quizHost = h('div');

  const bar = h('header', { class: 'lbar' },
    h('a', { class: 'lbar-exit', href: '#/learn', title: 'Back to Learn' }, icon('back'), h('span', {}, 'Learn')),
    h('div', { class: 'lbar-title' }, h('span', {}, `Reading · ${L.sheet}`), h('strong', {}, L.title)),
    h('span', { class: 'lbar-fill' }),
    h('a', { class: 'tool-btn', href: L.href, target: '_blank', rel: 'noopener' }, h('span', { class: 'tool-txt' }, 'Open full page'), ' ↗'));

  const side = h('aside', { class: 'rd-side' },
    h('p', { class: 'lp-kicker' }, `${L.sheet} · ${L.mins} min`),
    h('h1', { class: 'rd-title' }, L.title),
    h('p', { class: 'rd-summary' }, L.summary),
    h('details', { class: 'rd-obj', open: true }, h('summary', {}, 'By the end you can'), h('ul', {}, L.objectives.map(o => h('li', {}, o)))),
    h('div', { class: 'blk blk-quiz' }, h('div', { class: 'blk-tag' }, icon('check'), 'Check your understanding'), quizHost),
    after, status);

  const root = h('div', { class: 'lesson reading' }, bar, h('div', { class: 'rd-body' }, h('div', { class: 'rd-pane' }, frame), side));
  main.innerHTML = '';
  main.append(root);

  const renderAfter = () => {
    const st = store.lesson(L.id);
    after.innerHTML = '';
    if (st.status !== 'done') return;
    after.append(h('div', { class: 'blk blk-explain' },
      h('div', { class: 'blk-tag' }, icon('check'), 'Lesson complete'),
      nextId ? h('a', { class: 'btn', href: '#/lesson/' + nextId }, `Next: ${LESSONS[nextId].title}`, icon('next')) : h('a', { class: 'btn', href: '#/learn' }, 'Back to Learn')));
  };
  mountQuiz(quizHost, L.check, {
    previous: store.lesson(L.id).quiz,
    onFinish: res => { store.updateLesson(L.id, { quiz: res }); store.completeLesson(L.id); renderAfter(); }
  });
  renderAfter();

  // show only this sheet inside the frame, and keep its theme in step with ours
  let innerRO = null;
  const syncTheme = () => {
    try {
      const d = frame.contentDocument;
      if (!d) return;
      const t = document.documentElement.getAttribute('data-theme');
      if (t) d.documentElement.setAttribute('data-theme', t); else d.documentElement.removeAttribute('data-theme');
    } catch (e) { /* cross-origin: leave as is */ }
  };
  const stacked = () => window.matchMedia('(max-width: 900px)').matches;
  const fitHeight = () => {
    try {
      if (!stacked()) { frame.style.height = ''; return; }
      const d = frame.contentDocument;
      frame.style.height = `${d.documentElement.scrollHeight}px`;
    } catch (e) { /* ignore */ }
  };
  frame.addEventListener('load', () => {
    try {
      const d = frame.contentDocument;
      const css = d.createElement('style');
      css.textContent = `.indexbar, .masthead, section.chapter:not(#${sheetId}) { display: none !important; }
section.chapter#${sheetId} { margin-top: 0 !important; border-top: 0 !important; padding-top: 20px !important; }
html { scroll-padding-top: 0 !important; } .page { padding-bottom: 40px !important; }`;
      d.head.appendChild(css);
      syncTheme();
      frame.contentWindow.scrollTo(0, 0);
      fitHeight();
      const RO = frame.contentWindow.ResizeObserver;
      if (RO) { innerRO = new RO(fitHeight); innerRO.observe(d.body); }
    } catch (e) {
      status.textContent = 'Showing the full explainer: this browser kept the sheet from being trimmed.';
    }
  });
  const themeObs = new MutationObserver(syncTheme);
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', fitHeight);

  return () => {
    themeObs.disconnect();
    if (innerRO) innerRO.disconnect();
    window.removeEventListener('resize', fitHeight);
    delete document.body.dataset.mode;
  };
}
