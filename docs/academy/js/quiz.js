// One question at a time, with feedback straight after each answer, then a results screen
// with a review. Used by the checkpoint in interactive lessons and by reading lessons.

import { h, icon } from './ui.js';

export function mountQuiz(host, questions, { previous = null, onFinish = () => {}, title = 'Check your understanding' } = {}) {
  let idx = 0, picked = null, checked = false;
  let answers = [];
  const root = h('div', { class: 'quiz' });
  host.append(root);

  function dots() {
    return h('div', { class: 'qdots', 'aria-hidden': 'true' }, questions.map((q, i) => {
      const a = answers[i];
      const cls = i === idx && !(i < answers.length) ? 'cur' : a == null ? '' : a === q.answer ? 'ok' : 'bad';
      return h('i', { class: cls });
    }));
  }

  function renderQuestion() {
    const q = questions[idx];
    picked = null; checked = false;
    root.innerHTML = '';
    const opts = q.options.map((o, j) => {
      const input = h('input', { type: 'radio', name: 'qopt', value: j, onchange: () => { picked = j; checkBtn.disabled = false; } });
      return h('label', { class: 'qopt' }, input, h('span', { class: 'qletter' }, String.fromCharCode(65 + j)), h('span', { class: 'qtext' }, o));
    });
    const feedback = h('div', { class: 'qfeedback', 'aria-live': 'polite' });
    const checkBtn = h('button', { type: 'button', class: 'btn', disabled: true, onclick: () => {
      if (!checked) {
        if (picked == null) return;
        checked = true;
        answers[idx] = picked;
        const right = picked === q.answer;
        opts.forEach((l, j) => {
          l.querySelector('input').disabled = true;
          if (j === q.answer) l.classList.add('right');
          else if (j === picked) l.classList.add('wrong');
        });
        feedback.append(h('p', { class: 'verdict ' + (right ? 'ok' : 'bad') }, icon(right ? 'check' : 'cross'), right ? 'Correct.' : 'Not quite.'), h('p', {}, q.explain));
        checkBtn.textContent = idx < questions.length - 1 ? 'Next question' : 'See results';
        root.querySelector('.qdots').replaceWith(dots());
        checkBtn.focus();
      } else if (idx < questions.length - 1) {
        idx++;
        renderQuestion();
        root.querySelector('legend').focus();
      } else {
        finish();
      }
    } }, 'Check answer');
    root.append(
      h('div', { class: 'qhead' }, h('span', { class: 'qcount' }, `Question ${idx + 1} of ${questions.length}`), dots()),
      h('fieldset', { class: 'qset' }, h('legend', { tabindex: '-1' }, q.q), opts),
      feedback,
      h('div', { class: 'qactions' }, checkBtn));
  }

  function finish() {
    const score = answers.filter((a, i) => a === questions[i].answer).length;
    const result = { score, total: questions.length, answers: answers.slice(), attempts: ((previous && previous.attempts) || 0) + 1, at: new Date().toISOString() };
    previous = result;
    onFinish(result);
    renderResult(result);
  }

  function renderResult(res) {
    root.innerHTML = '';
    const ratio = res.score / res.total;
    const msg = ratio === 1 ? 'Every answer right.' : ratio >= 0.6 ? 'Good work. Review the ones you missed below.' : 'Worth another look. Review the explanations, then try again.';
    root.append(
      h('div', { class: 'qresult' },
        h('div', { class: 'qscore' }, h('b', {}, String(res.score)), h('span', {}, `/ ${res.total}`)),
        h('div', {}, h('p', { class: 'qmsg' }, msg), res.attempts > 1 ? h('p', { class: 'muted small' }, `Attempt ${res.attempts}`) : null)),
      h('div', { class: 'qreview' }, questions.map((q, i) => {
        const a = res.answers[i], ok = a === q.answer;
        return h('details', { class: 'qrev ' + (ok ? 'ok' : 'bad') },
          h('summary', {}, icon(ok ? 'check' : 'cross'), h('span', {}, q.q)),
          h('p', {}, h('span', { class: 'muted' }, 'Your answer: '), a != null ? q.options[a] : '—'),
          ok ? null : h('p', {}, h('span', { class: 'muted' }, 'Correct: '), q.options[q.answer]),
          h('p', { class: 'muted' }, q.explain));
      })),
      h('div', { class: 'qactions' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => { idx = 0; answers = []; renderQuestion(); } }, 'Retake')));
  }

  if (previous) { answers = previous.answers.slice(); renderResult(previous); }
  else renderQuestion();
  return root;
}
