/* Checks the Dams Academy lesson content against the solver:
 * - lesson structure: one correct option per prediction, quiz answers in range, every
 *   predict step has a task, control/instrument keys exist
 * - every claim in the seepage lesson text (directions and rough magnitudes)
 * - the default design brief is solvable, and only by the intended designs
 * - assignment links round-trip */
'use strict';
const path = require('path');
const { solveSeepage } = require(path.join(__dirname, '..', 'src', 'seepage-solver.js'));

let fails = 0, passes = 0;
function check(name, ok, detail) {
  if (ok) passes++; else fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
}
const Lday = v => v * 1000 * 86400;
const run = p => {
  const r = solveSeepage(Object.assign({ damType: 'homogeneous', drain: 'none', cutoff: 'none', foundation: 'tight', reservoir: 0.85 }, p));
  const q = r.q;
  return {
    q: Lday(q.inflowTotal), face: Lday(q.outSeepageFace), tail: Lday(q.outTailwater), drain: Lday(q.outDrain),
    fs: r.exit.fs, i: Math.max(r.exit.groundMax, r.exit.faceMax),
    sf: r.seepageFace.present ? r.seepageFace.topZ : null, conv: r.stats ? r.stats.converged : true
  };
};

(async () => {
  const dir = path.join(__dirname, '..', 'academy', 'js');
  const { SEEPAGE_3D, DEFAULT_CHALLENGE, challengeMet } = await import(path.join(dir, 'lesson-seepage3d.js'));
  const course = await import(path.join(dir, 'course.js'));
  const { encodeAssignment, decodeAssignment } = await import(path.join(dir, 'assign.js'));

  // ---- lesson structure
  const CONTROL_KEYS = ['damType', 'drain', 'cutoff', 'foundation', 'reservoir', 'mode', 'view', 'layers'];
  const METRIC_KEYS = ['q', 'fs', 'iExit', 'sf', 'split'];
  const ids = new Set();
  for (const s of SEEPAGE_3D.steps) {
    check(`step ${s.id}: unique id`, !ids.has(s.id)); ids.add(s.id);
    if (s.predict) {
      check(`step ${s.id}: exactly one correct prediction`, s.predict.options.filter(o => o.correct).length === 1);
      check(`step ${s.id}: prediction has a task to test it`, !!s.task && !!s.explain);
    }
    (s.controls || []).forEach(k => check(`step ${s.id}: control "${k}" exists`, CONTROL_KEYS.includes(k)));
    (s.instruments || []).forEach(k => check(`step ${s.id}: instrument "${k}" exists`, METRIC_KEYS.includes(k)));
    if (s.task) check(`step ${s.id}: task has a control or uses the stage`, (s.controls || []).length > 0);
    if (s.quiz) s.quiz.forEach((q, k) => check(`step ${s.id}: quiz ${k + 1} answer in range`, q.answer >= 0 && q.answer < q.options.length && !!q.explain));
  }
  for (const L of Object.values(course.LESSONS)) {
    if (L.check) L.check.forEach((q, k) => check(`${L.id}: check ${k + 1} answer in range`, q.answer >= 0 && q.answer < q.options.length && !!q.explain));
    if (L.kind === 'reading') check(`${L.id}: links to a classic sheet`, /#(types|raising|zones|seepage)$/.test(L.href));
  }
  for (const id of course.allLessonIds()) check(`course lesson ${id} defined`, !!course.LESSONS[id]);
  check('every lesson is in the course order', Object.keys(course.LESSONS).every(id => course.allLessonIds().includes(id)));
  for (const [t, , l] of course.GLOSSARY) check(`glossary "${t}" links to a lesson`, !!course.LESSONS[l]);

  // ---- tasks pass only after the experiment (scene state must not already satisfy them)
  const stepById = id => SEEPAGE_3D.steps.find(s => s.id === id);
  const sceneCtx = s => ({
    params: Object.assign({ damType: 'homogeneous', drain: 'none', cutoff: 'none', foundation: 'tight', reservoir: 0.85 }, (s.scene || {}).params),
    mode: (s.scene || {}).mode || 'materials', layers: Object.assign({ phreatic: true, particles: true, labels: true }, (s.scene || {}).layers),
    interacted: false, viewChanged: false, tried: {}, challenge: DEFAULT_CHALLENGE
  });
  for (const s of SEEPAGE_3D.steps.filter(s => s.task && !s.challenge)) {
    let pre = true;
    try { pre = !!s.task.check(Object.assign(sceneCtx(s), { sum: { qTotal: 1e9, fs: 0, seepageFace: true } })); } catch (e) { pre = false; }
    check(`step ${s.id}: task is not already done when the step opens`, !pre);
  }

  // ---- claims in the lesson text
  const base = run({});
  check('base case converges', base.conv);
  check('phreatic: seepage face about 8 m up', base.sf != null && Math.abs(base.sf - 8) <= 1, `top ${base.sf}`);
  const faceShare = base.face / (base.face + base.tail + base.drain);
  check('phreatic: about two-thirds leaves at the seepage face', faceShare > 0.58 && faceShare < 0.75, (faceShare * 100).toFixed(0) + '%');

  const r60 = run({ reservoir: 0.6 }), r95 = run({ reservoir: 0.95 });
  check('reservoir: water ~60% deeper', Math.abs(0.95 / 0.6 - 1.6) < 0.05);
  check('reservoir: seepage more than doubles', r95.q / r60.q > 2, `${r60.q.toFixed(1)} -> ${r95.q.toFixed(1)}, x${(r95.q / r60.q).toFixed(2)}`);
  check('reservoir: roughly the square of the head', Math.abs(r95.q / r60.q - Math.pow(0.95 / 0.6, 2)) < 0.4, `ratio ${(r95.q / r60.q).toFixed(2)} vs ${Math.pow(0.95 / 0.6, 2).toFixed(2)}`);
  check('reservoir: seepage face climbs', r95.sf > r60.sf, `${r60.sf} -> ${r95.sf} m`);

  const chim = run({ drain: 'chimney' }), toe = run({ drain: 'toe' });
  check('drain: chimney more than doubles seepage', chim.q / base.q > 2, `${base.q.toFixed(1)} -> ${chim.q.toFixed(1)}`);
  check('drain: seepage face disappears', chim.sf == null);
  check('drain: safety vs heave rises sharply', chim.fs > 20 * base.fs, `${base.fs.toFixed(2)} -> ${chim.fs.toFixed(0)}`);
  check('drain: toe drain also removes the seepage face', toe.sf == null);

  const perv = run({ foundation: 'pervious' });
  check('foundation: more than fiftyfold', perv.q / base.q > 50, `x${(perv.q / base.q).toFixed(0)}`);
  check('foundation: nearly all goes under the dam', perv.tail / perv.q > 0.95, ((perv.tail / perv.q) * 100).toFixed(1) + '%');
  check('foundation: exit gradient near 0.8, safety about 1.3', Math.abs(perv.i - 0.8) < 0.05 && Math.abs(perv.fs - 1.3) < 0.08, `i ${perv.i.toFixed(3)}, FS ${perv.fs.toFixed(2)}`);

  const part = run({ foundation: 'pervious', cutoff: 'partial' }), full = run({ foundation: 'pervious', cutoff: 'full' });
  check('cutoff: partial reduces seepage by less than 10%', 1 - part.q / perv.q < 0.1, `${((1 - part.q / perv.q) * 100).toFixed(1)}%`);
  check('cutoff: full cuts it by more than 90%', 1 - full.q / perv.q > 0.9, `${perv.q.toFixed(0)} -> ${full.q.toFixed(0)}`);

  // ---- default brief: solvable, and only by a clay core with a full cutoff
  const passing = [];
  for (const damType of ['homogeneous', 'cored']) for (const drain of ['none', 'toe', 'chimney']) for (const cutoff of ['none', 'partial', 'full']) {
    const r = solveSeepage({ damType, drain, cutoff, foundation: DEFAULT_CHALLENGE.foundation, reservoir: DEFAULT_CHALLENGE.reservoir });
    const sum = { qTotal: Lday(r.q.inflowTotal), fs: r.exit.fs, seepageFace: r.seepageFace.present };
    if (challengeMet(DEFAULT_CHALLENGE, sum).ok) passing.push(`${damType}/${drain}/${cutoff}`);
  }
  check('default brief is solvable', passing.length > 0, passing.join(', '));
  check('default brief needs a clay core and a full cutoff', passing.every(p => p.startsWith('cored/') && p.endsWith('/full')));
  // the clay-core reasoning in the challenge explanation only holds on sand and gravel:
  // on tight rock a homogeneous dam with a toe drain meets the default targets
  const tightToe = run({ drain: 'toe' });
  check('tight rock: homogeneous + toe drain meets the default targets', challengeMet(DEFAULT_CHALLENGE, { qTotal: tightToe.q, fs: tightToe.fs, seepageFace: tightToe.sf != null }).ok, `${tightToe.q.toFixed(1)} L/day per m, FS ${tightToe.fs.toFixed(2)}`);
  const chStep = SEEPAGE_3D.steps.find(s => s.challenge);
  const exTight = chStep.explain({ challenge: Object.assign({}, DEFAULT_CHALLENGE, { foundation: 'tight' }) });
  const exPerv = chStep.explain({ challenge: DEFAULT_CHALLENGE });
  check('challenge explanation: clay-core reasoning only on sand and gravel', /clay core/.test(exPerv) && !/clay core/.test(exTight));
  // the steepest exit on sand and gravel is the seepage face at the toe, as the text says
  const pervFull = solveSeepage({ damType: 'homogeneous', drain: 'none', cutoff: 'none', foundation: 'pervious', reservoir: 0.85 });
  check('foundation: steepest exit is the seepage face at the toe', pervFull.exit.governing === 'face' && pervFull.seepageFace.present && pervFull.seepageFace.bottomZ <= 0.5, `face ${pervFull.exit.faceMax.toFixed(2)} vs ground ${pervFull.exit.groundMax.toFixed(2)}`);
  check('cutoff: partial cutoff reaches half-way down the 15 m foundation', (() => {
    const r = solveSeepage({ damType: 'homogeneous', drain: 'none', cutoff: 'partial', foundation: 'pervious', reservoir: 0.85 });
    let zmin = Infinity; for (let i = 0; i < r.nx; i++) for (let j = 0; j < r.nz; j++) if (r.type[i * r.nz + j] === 4) zmin = Math.min(zmin, r.z0 + j);
    return Math.abs(zmin - -8) <= 0.51 && r.z0 === -15;
  })());
  check('challenge scene does not already meet the brief', !challengeMet(DEFAULT_CHALLENGE, (() => { const r = run({ foundation: 'pervious' }); return { qTotal: r.q, fs: r.fs, seepageFace: r.sf != null }; })()).ok);

  // ---- assignment links round-trip (including non-ASCII text)
  const a = { v: 1, id: 'AB12CD', lesson: 'seepage-3d', title: 'Brief — Ø 24 m dam', teacher: 'Dr Ñ', note: 'Use the “clay core”.', challenge: { foundation: 'tight', reservoir: 0.7, maxQ: 20, minFS: 4, noSeepageFace: false } };
  const back = decodeAssignment(encodeAssignment(a));
  check('assignment round-trips', back && back.title === a.title && back.teacher === a.teacher && back.note === a.note && back.challenge.maxQ === 20 && back.challenge.foundation === 'tight');
  check('damaged assignment link is rejected', decodeAssignment('not-a-link!!') === null);

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
