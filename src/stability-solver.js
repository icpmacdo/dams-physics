/*
 * stability-solver.js
 *
 * Limit-equilibrium slope stability for a 2D section (per metre of dam length), in
 * effective stress: shear strength on a slip surface  s = c' + (sigma_n - u) tan(phi').
 *
 * - Bishop's simplified method on circular slip surfaces (moment equilibrium about the
 *   centre, vertical force equilibrium per slice, interslice shear neglected), with an
 *   entry-exit-radius grid search and a local pattern search for the minimum FoS.
 * - Spencer's method (full force and moment equilibrium, interslice forces at a constant
 *   inclination theta) for non-circular surfaces: a three-part "sliding block" whose base
 *   runs along a weak foundation layer. Spencer is also run on the critical circle as a
 *   cross-check (on circles it agrees closely with Bishop).
 * - Pore pressures come from a seepage solution: u = gamma_w * psi where psi > 0; suction
 *   (psi < 0) is ignored, the usual conservative practice. Unit weights: moist above the
 *   phreatic surface, saturated below.
 * - Tension cut-off: a slice base never carries negative effective normal force.
 * - Slip surfaces must be at least `minDepth` deep (default 1.5 m): thinner skins are
 *   surface ravelling, not a slide of the dam.
 *
 * Frame: internally the slope always descends towards +x (the mass slides to the right).
 * analyzeDam() mirrors the upstream slope into this frame and back.
 *
 * API (Node `require`, or a classic script / worker defining self.StabilitySolver):
 *   analyze(model, search)           generic; see makeModel docs below
 *   bishop(slices), spencer(slices)  factor of safety of one discretised surface
 *   circleSlices(model, xa, xb, R)   slices of a circle through two surface points
 *   polySlices(model, pts)           slices of a polyline slip surface (pts left -> right)
 *   analyzeDam(seepResult, spec)     dam coupling: pore pressures from SeepageSolver
 * Worker protocol (when loaded after seepage-solver.js in the same worker):
 *   { id, kind: 'build', seep: params, stab: spec, budgetMs } -> { id, seep, stab }
 * No dependencies, no DOM, ES2019.
 */
(function () {
  'use strict';

  const GAMMA_W = 9.81;
  const DEG = Math.PI / 180;
  const M_ALPHA_MIN = 0.2;   // Bishop/Spencer slice-base denominator floor (Whitman & Bailey 1967)
  const N_SLICES = 40;

  function nowMs() {
    return (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
      ? performance.now() : Date.now();
  }

  // ------------------------------------------------------------------ geometry
  // surface: [[x, z], ...] with x strictly increasing. Outside the range: flat.
  function surfZ(surf, x) {
    const n = surf.length;
    if (x <= surf[0][0]) return surf[0][1];
    if (x >= surf[n - 1][0]) return surf[n - 1][1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (surf[m][0] <= x) lo = m; else hi = m; }
    const a = surf[lo], b = surf[hi], t = (x - a[0]) / (b[0] - a[0] || 1);
    return a[1] + (b[1] - a[1]) * t;
  }

  // ------------------------------------------------------------------ slices
  // model = {
  //   surface, zBottom, materials: [{ c (kPa), phi (deg), gm, gs (kN/m3) }],
  //   matAt(x, z) -> material index of the soil at a point,
  //   uAt(x, z)   -> pore pressure (kPa, >= 0),
  //   gammaAt(x, z) -> unit weight (kN/m3)   (used when colWeight is absent)
  //   colWeight(x, zb, zt) -> integral of gamma dz over a vertical (kN/m2)  (optional fast path)
  //   minDepth (m, default 1.5)
  // }
  function columnWeight(model, x, zb, zt) {
    if (zt <= zb) return 0;
    if (model.colWeight) return model.colWeight(x, zb, zt);
    const n = Math.max(2, Math.ceil((zt - zb) / 0.25)), dz = (zt - zb) / n;
    let s = 0;
    for (let k = 0; k < n; k++) s += model.gammaAt(x, zb + (k + 0.5) * dz);
    return s * dz;
  }

  // Build slices of a slip surface z = base(x) between surface points xa < xb.
  // breaks: x positions of kinks in the base (slices are distributed per segment).
  // Returns null for an inadmissible surface (outside the model, too thin, or one that
  // comes back out of the ground between its ends).
  function buildSlices(model, base, xa, xb, breaks, n) {
    n = n || N_SLICES;
    const xs = [xa].concat((breaks || []).filter(x => x > xa + 1e-6 && x < xb - 1e-6), [xb]);
    const L = xb - xa;
    if (!(L > 0.5)) return null;
    const out = [];
    let maxDepth = 0;
    const minDepth = model.minDepth == null ? 1.5 : model.minDepth;
    for (let s = 0; s < xs.length - 1; s++) {
      const x0 = xs[s], x1 = xs[s + 1];
      const ns = Math.max(2, Math.round(n * (x1 - x0) / L));
      const b = (x1 - x0) / ns;
      for (let k = 0; k < ns; k++) {
        const xl = x0 + k * b, xr = xl + b, xm = xl + 0.5 * b;
        const zl = base(xl), zr = base(xr), zb = base(xm);
        if (!(zb === zb) || zb < model.zBottom - 1e-6) return null;
        const zt = surfZ(model.surface, xm);
        const hgt = zt - zb;
        if (hgt < -0.05) return null; // surface re-emerges inside the slip: inadmissible
        if (hgt > maxDepth) maxDepth = hgt;
        const alpha = Math.atan2(zl - zr, b);  // > 0 where the base descends in the direction of sliding
        const zs = zb + Math.min(0.05, Math.max(0, hgt) * 0.5);
        const mi = model.matAt(xm, zs), m = model.materials[mi];
        out.push({
          x: xm, b, zb, zt, alpha, l: b / Math.cos(alpha),
          W: b * columnWeight(model, xm, zb, Math.max(zb, zt)),
          u: Math.max(0, model.uAt(xm, zb)), c: m.c, tphi: Math.tan(m.phi * DEG), mat: mi
        });
      }
    }
    if (maxDepth < minDepth) return null;
    out.maxDepth = maxDepth;
    return out;
  }

  // Circle through surface points A (xa) and B (xb) with radius R, centre above the chord.
  function circleOf(model, xa, xb, R) {
    const za = surfZ(model.surface, xa), zb = surfZ(model.surface, xb);
    const dx = xb - xa, dz = zb - za, d = Math.hypot(dx, dz);
    if (!(R > d / 2)) return null;
    const hh = Math.sqrt(R * R - d * d / 4);
    let nx = -dz / d, nz = dx / d;          // unit normal of AB
    if (nz < 0) { nx = -nx; nz = -nz; }     // pointing up
    const xc = (xa + xb) / 2 + nx * hh, zc = (za + zb) / 2 + nz * hh;
    if (!(zc > Math.max(za, zb))) return null; // both ends must lie below the centre
    return { xc, zc, R, xa, za, xb, zb };
  }
  function circleSlices(model, xa, xb, R, n) {
    const C = circleOf(model, xa, xb, R);
    if (!C) return null;
    const base = x => { const q = C.R * C.R - (x - C.xc) * (x - C.xc); return C.zc - Math.sqrt(q > 0 ? q : 0); };
    const sl = buildSlices(model, base, xa, xb, null, n);
    if (sl) sl.circle = C;
    return sl;
  }
  // polyline slip surface, pts left -> right, ends on (or above) the surface
  function polySlices(model, pts, n) {
    const base = x => {
      if (x <= pts[0][0]) return pts[0][1];
      for (let k = 1; k < pts.length; k++) if (x <= pts[k][0]) {
        const a = pts[k - 1], b = pts[k], t = (x - a[0]) / (b[0] - a[0] || 1);
        return a[1] + (b[1] - a[1]) * t;
      }
      return pts[pts.length - 1][1];
    };
    const sl = buildSlices(model, base, pts[0][0], pts[pts.length - 1][0], pts.slice(1, -1).map(p => p[0]), n);
    if (sl) sl.poly = pts;
    return sl;
  }

  // ------------------------------------------------------------------ Bishop simplified
  // F = sum[(c'b + (W - u b) tan phi') / m_alpha] / sum W sin(alpha),
  // m_alpha = cos(alpha) + sin(alpha) tan(phi') / F; written per slice with the effective
  // normal force N' = (W - u b - c' b tan(alpha) / F) / m_alpha, clipped at zero.
  function bishop(sl, opt) {
    const noU = opt && opt.noPore;
    let den = 0;
    for (const s of sl) den += s.W * Math.sin(s.alpha);
    if (!(den > 1e-9)) return { F: Infinity, converged: true, iterations: 0 };
    let F = 1.5, it = 0, conv = false;
    for (it = 1; it <= 100; it++) {
      let num = 0;
      for (const s of sl) {
        const sa = Math.sin(s.alpha), ca = Math.cos(s.alpha), ta = sa / ca;
        let ma = ca + sa * s.tphi / F;
        if (ma < M_ALPHA_MIN) ma = M_ALPHA_MIN;
        const u = noU ? 0 : s.u;
        let Np = (s.W - u * s.b - s.c * s.b * ta / F) / ma;
        if (Np < 0) Np = 0;
        num += s.c * s.l + Np * s.tphi;
      }
      const Fn = num / den;
      if (!(Fn > 0) || !isFinite(Fn)) { F = Fn; break; }
      if (Math.abs(Fn - F) < 1e-6 * Math.max(1, F)) { F = Fn; conv = true; break; }
      F = Fn;
    }
    return { F, converged: conv, iterations: it };
  }

  // ------------------------------------------------------------------ Spencer
  // Net interslice force on slice i, Q_i = Z_left - Z_right, inclined at theta:
  //   Q = [(c'l + tan(phi')(W cos(a) - U)) / F - W sin(a)] / [cos(a + theta) + tan(phi') sin(a + theta) / F]
  // Force equilibrium: sum Q = 0. Moment equilibrium (Q acts through the base midpoint):
  //   sum Q (x sin(theta) - z cos(theta)) = 0.
  function spencerSums(sl, F, th, xr, zr) {
    let sf = 0, sm = 0;
    const st = Math.sin(th), ct = Math.cos(th);
    for (const s of sl) {
      const sa = Math.sin(s.alpha), ca = Math.cos(s.alpha);
      const U = s.u * s.l;
      let nEff = s.W * ca - U; if (nEff < 0) nEff = 0;
      let den = Math.cos(s.alpha + th) + s.tphi * Math.sin(s.alpha + th) / F;
      if (den < M_ALPHA_MIN) den = M_ALPHA_MIN;
      const Q = ((s.c * s.l + s.tphi * nEff) / F - s.W * sa) / den;
      sf += Q;
      sm += Q * ((s.x - xr) * st - (s.zb - zr) * ct);
    }
    return [sf, sm];
  }
  // Root of a scalar function by geometric bracketing around x0 (x > 0 if pos) and
  // the Illinois variant of regula falsi.
  function bracketRoot(fn, x0, step, pos, lo, hi) {
    let a = x0, fa = fn(a);
    if (!(fa === fa)) return NaN;
    if (Math.abs(fa) < 1e-10) return a;
    let b = NaN, fb = NaN, found = false;
    for (let k = 1; k <= 24 && !found; k++) {
      for (const sgn of [1, -1]) {
        const x = pos ? x0 * Math.pow(step, sgn * k) : x0 + sgn * k * step;
        if (x < lo || x > hi) continue;
        const fx = fn(x);
        if (!(fx === fx)) continue;
        // nearest neighbour already evaluated on the same side
        const xp = pos ? x0 * Math.pow(step, sgn * (k - 1)) : x0 + sgn * (k - 1) * step;
        const fp = k === 1 ? fa : fn(xp);
        if ((fx <= 0) !== (fp <= 0)) { a = xp; fa = fp; b = x; fb = fx; found = true; break; }
      }
    }
    if (!found) return NaN;
    let side = 0;
    for (let it = 0; it < 60; it++) {
      const m = (a * fb - b * fa) / (fb - fa);
      const fm = fn(m);
      if (!(fm === fm)) return NaN;
      if (Math.abs(b - a) < 1e-7 * Math.max(1, Math.abs(m)) || Math.abs(fm) < 1e-12) return m;
      if ((fm <= 0) === (fb <= 0)) { b = m; fb = fm; if (side === -1) fa /= 2; side = -1; }
      else { a = m; fa = fm; if (side === 1) fb /= 2; side = 1; }
    }
    return (a * fb - b * fa) / (fb - fa);
  }
  function spencer(sl) {
    let xr = 0, zr = 0, wt = 0, scale = 0;
    for (const s of sl) { xr += s.x * s.b; zr += s.zb * s.b; wt += s.b; scale += s.W; }
    xr /= wt; zr /= wt; scale = 1 / Math.max(1e-9, scale);
    // For each theta, F from force equilibrium; then theta from the moment residual at
    // that F. (Solving F separately from the moment equation is ill-posed for planar
    // surfaces, where theta = -alpha satisfies moment equilibrium for every F.)
    let Fguess = 1.5;
    const Ff = th => bracketRoot(F => spencerSums(sl, F, th, xr, zr)[0] * scale, Fguess, 1.25, true, 0.02, 100);
    let lastF = NaN;
    const mres = th => {
      const F = Ff(th);
      if (!(F === F)) return NaN;
      Fguess = F; lastF = F;
      return spencerSums(sl, F, th, xr, zr)[1] * scale;
    };
    const th = bracketRoot(mres, 0, 5 * DEG, false, -60 * DEG, 60 * DEG);
    if (!(th === th)) return { F: NaN, theta: NaN, converged: false };
    const F = Ff(th), m = F === F ? spencerSums(sl, F, th, xr, zr) : [NaN, NaN];
    void lastF;
    return { F, theta: th / DEG, converged: Math.abs(m[1] * scale) < 1e-6 && Math.abs(m[0] * scale) < 1e-6 };
  }

  // ------------------------------------------------------------------ search
  function linspace(a, b, n) { const o = []; for (let k = 0; k < n; k++) o.push(n === 1 ? a : a + (b - a) * k / (n - 1)); return o; }
  const R_FACTORS = [1.02, 1.08, 1.18, 1.32, 1.5, 1.8, 2.3, 3, 4.2, 6];

  // search = {
  //   entry: [x1, x2], exit: [x1, x2]   ranges for the circle's ends on the surface
  //   nEntry, nExit (default 14, 14)
  //   layer: { z, entryMin, exitMax } optional: also try sliding blocks along z
  //   budgetMs (default 3000)
  // }
  function analyze(model, search) {
    const t0 = nowMs();
    const budget = search.budgetMs || 3000;
    const nE = search.nEntry || 14, nX = search.nExit || 14;
    let tried = 0, timedOut = false;
    const evalCircle = (xa, xb, rf) => {
      tried++;
      if (!(xb - xa > 2)) return null;
      const za = surfZ(model.surface, xa), zb = surfZ(model.surface, xb);
      const R = rf * 0.5 * Math.hypot(xb - xa, zb - za);
      const sl = circleSlices(model, xa, xb, R);
      if (!sl) return null;
      const r = bishop(sl);
      if (!(r.F > 0) || !isFinite(r.F)) return null;
      return { F: r.F, xa, xb, rf, R, sl };
    };
    let best = null;
    const keep = [];
    for (const xa of linspace(search.entry[0], search.entry[1], nE)) {
      for (const xb of linspace(search.exit[0], search.exit[1], nX)) {
        for (const rf of R_FACTORS) {
          const r = evalCircle(xa, xb, rf);
          if (r) { keep.push(r); if (!best || r.F < best.F) best = r; }
        }
      }
      if (nowMs() - t0 > budget * 0.5) { timedOut = true; break; }
    }
    // local pattern search from the best few distinct starts
    keep.sort((p, q) => p.F - q.F);
    const starts = [];
    for (const k of keep) {
      if (starts.length >= 4) break;
      if (starts.every(s => Math.abs(s.xa - k.xa) + Math.abs(s.xb - k.xb) > 4)) starts.push(k);
    }
    const span = Math.max(1, search.exit[1] - search.entry[0]);
    for (const st of starts) {
      let cur = st, dA = span / (nE * 2), dB = span / (nX * 2), dR = 0.15;
      for (let pass = 0; pass < 6 && !timedOut; pass++) {
        let improved = true, guard = 0;
        while (improved && guard++ < 30) {
          improved = false;
          for (const [a, b, r] of [[dA, 0, 0], [-dA, 0, 0], [0, dB, 0], [0, -dB, 0], [0, 0, dR], [0, 0, -dR], [dA, dB, 0], [-dA, -dB, 0]]) {
            const xa = Math.max(search.entry[0], Math.min(search.entry[1], cur.xa + a));
            const xb = Math.max(search.exit[0], Math.min(search.exit[1], cur.xb + b));
            const rf = Math.max(1.005, cur.rf * (1 + r));
            const c = evalCircle(xa, xb, rf);
            if (c && c.F < cur.F - 1e-7) { cur = c; improved = true; }
          }
          if (nowMs() - t0 > budget) { timedOut = true; break; }
        }
        dA /= 2; dB /= 2; dR /= 2;
      }
      if (!best || cur.F < best.F) best = cur;
    }
    const out = { tried, timedOut, circle: null, block: null, critical: null, fos: NaN, method: '' };
    if (best) {
      const sp = spencer(best.sl);
      out.circle = { fos: best.F, spencerFos: sp.F, spencerTheta: sp.theta, R: best.R, xc: best.sl.circle.xc, zc: best.sl.circle.zc, sl: best.sl };
    }
    // non-circular sliding blocks along a weak layer (Spencer)
    if (search.layer && !timedOut) {
      const z = search.layer.z;
      const lo = search.layer.entryMin, hi = search.layer.exitMax;
      let bb = null;
      const evalBlock = (xA, xB, a1, a2) => {
        tried++;
        if (!(xB > xA + 1)) return null;
        const p = blockPoly(model, xA, xB, z, a1, a2, lo, hi);
        if (!p) return null;
        const sl = polySlices(model, p, 48);
        if (!sl) return null;
        const r = spencer(sl);
        if (!(r.F > 0) || !isFinite(r.F)) return null;
        return { F: r.F, theta: r.theta, xA, xB, a1, a2, sl, pts: p };
      };
      for (const xA of linspace(lo + 4, hi - 10, 10)) for (const xB of linspace(xA + 4, hi - 2, 8)) for (const a1 of [45, 55, 65]) for (const a2 of [25, 35, 45]) {
        const r = evalBlock(xA, xB, a1, a2);
        if (r && (!bb || r.F < bb.F)) bb = r;
        if (nowMs() - t0 > budget) { timedOut = true; break; }
      }
      if (bb && !timedOut) {
        let dA = (hi - lo) / 20, dB = dA, dd = 5;
        for (let pass = 0; pass < 4; pass++) {
          let improved = true, guard = 0;
          while (improved && guard++ < 20) {
            improved = false;
            for (const [a, b, c, d] of [[dA, 0, 0, 0], [-dA, 0, 0, 0], [0, dB, 0, 0], [0, -dB, 0, 0], [0, 0, dd, 0], [0, 0, -dd, 0], [0, 0, 0, dd], [0, 0, 0, -dd]]) {
              const r = evalBlock(bb.xA + a, bb.xB + b, Math.min(75, Math.max(35, bb.a1 + c)), Math.min(55, Math.max(15, bb.a2 + d)));
              if (r && r.F < bb.F - 1e-7) { bb = r; improved = true; }
            }
            if (nowMs() - t0 > budget) { timedOut = true; break; }
          }
          dA /= 2; dB /= 2; dd /= 2;
        }
      }
      if (bb) out.block = { fos: bb.F, theta: bb.theta, pts: bb.pts, sl: bb.sl };
    }
    const cands = [];
    if (out.circle) cands.push({ kind: 'circle', fos: out.circle.fos, sl: out.circle.sl, method: 'Bishop simplified' });
    if (out.block) cands.push({ kind: 'block', fos: out.block.fos, sl: out.block.sl, method: 'Spencer (sliding block)' });
    cands.sort((p, q) => p.fos - q.fos);
    if (cands.length) {
      const c = cands[0];
      out.fos = c.fos; out.method = c.method;
      out.critical = describe(model, c.kind, c.sl, c.kind === 'circle' ? out.circle : out.block);
    }
    out.timedOut = timedOut;
    out.ms = nowMs() - t0;
    return out;
  }

  // three-part block: active side up-left at a1 degrees from (xA, z), base along z,
  // passive side up-right at a2 degrees from (xB, z). Returns the polyline or null.
  function blockPoly(model, xA, xB, z, a1, a2, lo, hi) {
    const s = model.surface;
    if (surfZ(s, xA) - z < 0.5 || surfZ(s, xB) - z < 0.5) return null;
    const t1 = Math.tan(a1 * DEG), t2 = Math.tan(a2 * DEG);
    const f1 = x => z + (xA - x) * t1 - surfZ(s, x), f2 = x => z + (x - xB) * t2 - surfZ(s, x);
    const root = (f, a, b) => {
      let fa = f(a), fb = f(b);
      if ((fa <= 0) === (fb <= 0)) return NaN;
      for (let k = 0; k < 60; k++) { const m = 0.5 * (a + b), fm = f(m); if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else { b = m; } }
      return 0.5 * (a + b);
    };
    const xa = root(f1, xA, xA - 200), xb = root(f2, xB, xB + 200);
    if (!(xa === xa) || !(xb === xb) || xa < lo || xb > hi) return null;
    return [[xa, surfZ(s, xa)], [xA, z], [xB, z], [xb, surfZ(s, xb)]];
  }

  // summary of a critical surface for drawing and for plain-language explanations
  function describe(model, kind, sl, info) {
    let sumW = 0, sumUb = 0, lenWet = 0, len = 0, uMax = 0, area = 0;
    const byMat = new Map();
    for (const s of sl) {
      sumW += s.W; sumUb += s.u * s.b; len += s.l; if (s.u > 0.5) lenWet += s.l;
      if (s.u > uMax) uMax = s.u;
      area += s.b * Math.max(0, s.zt - s.zb);
      byMat.set(s.mat, (byMat.get(s.mat) || 0) + s.l);
    }
    const dry = bishop(sl, { noPore: true });
    const mats = Array.from(byMat.entries()).sort((p, q) => q[1] - p[1]).map(([m, l]) => ({ mat: m, frac: l / len }));
    const pts = kind === 'circle'
      ? sl.map(s => [s.x, s.zb])
      : info.pts.slice();
    if (kind === 'circle') { const C = sl.circle; pts.unshift([C.xa, C.za]); pts.push([C.xb, C.zb]); }
    return {
      kind, pts,
      entry: pts[0], exit: pts[pts.length - 1],
      xc: kind === 'circle' ? sl.circle.xc : NaN, zc: kind === 'circle' ? sl.circle.zc : NaN, R: kind === 'circle' ? sl.circle.R : NaN,
      ru: sumW > 0 ? sumUb / sumW : 0,          // share of the slices' weight carried by pore water at the base
      wetFrac: len > 0 ? lenWet / len : 0,       // share of the slip surface below the water table
      uMax, area, length: len, depth: sl.maxDepth,
      fosNoWater: dry.F,                         // same surface, same weights, no pore pressure
      materials: mats,
      slices: sl.map(s => ({ x: s.x, zb: s.zb, zt: s.zt, u: s.u, W: s.W, b: s.b, mat: s.mat }))
    };
  }

  // ------------------------------------------------------------------ dam coupling
  // spec = {
  //   geom: { crestZ, crestX0, crestX1, upToeX, downSlope, downToeX }
  //   materials: [{ c, phi, gm, gs, k }]    dam materials, indexed like custom.materials
  //   foundation: { c, phi, gm, gs, k },  layer: { zTop, zBottom, c, phi, gm, gs, k } | null
  //   sides: ['downstream', 'upstream']     upstream = rapid drawdown to ground level
  //   minDepth, budgetMs
  // }
  // Materials with k >= 1e-5 m/s drain freely during a drawdown; less permeable ones keep
  // their pore pressure minus the weight of water removed above them (Bishop 1954, B = 1).
  function analyzeDam(seep, spec) {
    const t0 = nowMs();
    const nx = seep.nx, nz = seep.nz, x0 = seep.x0, z0 = seep.z0, dx = seep.dx;
    const g = spec.geom, Hw = seep.Hw;
    const mats = spec.materials.slice();
    const iF = mats.length; mats.push(spec.foundation);
    const iL = spec.layer ? mats.length : -1; if (spec.layer) mats.push(spec.layer);
    const surfW = [[x0, 0], [g.upToeX, 0], [g.crestX0, g.crestZ], [g.crestX1, g.crestZ], [g.downToeX, 0], [x0 + nx * dx, 0]];
    const isSoil = t => t === 1 || t === 3 || t === 4;
    // material index of every cell (air -1); stair-step air cells under the true surface
    // take the material of the soil below
    const cm = new Int16Array(nx * nz).fill(-1);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const c = i * nz + j, t = seep.type[c], z = z0 + (j + 0.5) * dx;
      if (!isSoil(t)) continue;
      const m = seep.mat[c];
      if (m >= 10) cm[c] = m - 10;
      else cm[c] = spec.layer && z < spec.layer.zTop && z > spec.layer.zBottom ? iL : iF;
    }
    const sideOut = {};
    for (const side of spec.sides || ['downstream']) {
      const up = side === 'upstream';
      // pore pressure head and saturation per cell for this case
      const psi = new Float64Array(nx * nz).fill(NaN), sat = new Uint8Array(nx * nz);
      for (let c = 0; c < nx * nz; c++) {
        if (cm[c] < 0) continue;
        const t = seep.type[c];
        let p = seep.psi[c];
        if (t === 4 || !(p === p)) continue; // cutoff wall: interpolated from neighbours
        const j = c % nz, i = (c - j) / nz, z = z0 + (j + 0.5) * dx, x = x0 + (i + 0.5) * dx;
        let s = p >= 0;
        if (up) {
          const m = mats[cm[c]];
          if (m.k >= 1e-5 || t === 3) { p = -z; s = p >= 0; }    // drains to the new level (ground)
          else { const zs = surfZ(surfW, x); p = p - Math.max(0, Hw - zs); }
        }
        psi[c] = p; sat[c] = s ? 1 : 0;
      }
      // unit weight per cell, then cumulative column integrals for O(1) slice weights
      const gam = new Float64Array(nx * nz);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const c = i * nz + j;
        let src = c;
        if (cm[c] < 0) {
          // air cell straddling the true surface: soil below it fills its lower part
          const z = z0 + j * dx, x = x0 + (i + 0.5) * dx;
          if (j > 0 && cm[c - 1] >= 0 && surfZ(surfW, x) > z + 1e-9) src = c - 1; else continue;
        }
        const m = mats[cm[src]];
        gam[c] = sat[src] || seep.type[src] === 4 ? m.gs : m.gm; // (cutoff wall: below the water table)
      }
      const G = new Float64Array(nx * (nz + 1));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) G[i * (nz + 1) + j + 1] = G[i * (nz + 1) + j] + gam[i * nz + j] * dx;
      const gcum = (i, z) => {
        let f = (z - z0) / dx;
        if (f <= 0) return 0;
        if (f >= nz) return G[i * (nz + 1) + nz];
        const j = Math.floor(f), t = f - j;
        return G[i * (nz + 1) + j] + t * (G[i * (nz + 1) + j + 1] - G[i * (nz + 1) + j]);
      };
      const W = x => (up ? -x : x); // model frame -> world
      const col = xw => Math.max(0, Math.min(nx - 1, Math.floor((xw - x0) / dx)));
      const psiAt = (xw, z) => {
        const fx = (xw - x0) / dx - 0.5, fz = (z - z0) / dx - 0.5;
        const i0 = Math.floor(fx), j0 = Math.floor(fz), tx = fx - i0, tz = fz - j0;
        let s = 0, w = 0;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          const i = i0 + a, j = j0 + b;
          if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
          const v = psi[i * nz + j];
          if (!(v === v)) continue;
          const wt = (a ? tx : 1 - tx) * (b ? tz : 1 - tz);
          s += v * wt; w += wt;
        }
        return w > 1e-9 ? s / w : 0;
      };
      const matAtW = (xw, z) => {
        const i = col(xw);
        let j = Math.max(0, Math.min(nz - 1, Math.floor((z - z0) / dx)));
        while (j > 0 && cm[i * nz + j] < 0) j--;
        const m = cm[i * nz + j];
        return m < 0 ? iF : m;
      };
      const surf = up ? surfW.map(p => [-p[0], p[1]]).reverse() : surfW;
      const model = {
        surface: surf, zBottom: z0 + 0.05, materials: mats, minDepth: spec.minDepth == null ? 1.5 : spec.minDepth,
        matAt: (x, z) => matAtW(W(x), z),
        uAt: (x, z) => GAMMA_W * Math.max(0, psiAt(W(x), z)),
        colWeight: (x, zb, zt) => { const i = col(W(x)); return gcum(i, zt) - gcum(i, zb); }
      };
      // search ranges in the model frame: entry on the crest or upper slope, exit on the
      // lower slope or the ground beyond the toe
      const crestA = up ? -g.crestX1 : g.crestX0, crestB = up ? -g.crestX0 : g.crestX1;
      const toe = up ? -g.upToeX : g.downToeX;
      const run = toe - crestB, far = up ? -x0 : x0 + nx * dx;
      const search = {
        entry: [crestA, crestB + 0.6 * run], exit: [crestB + 0.35 * run, Math.min(toe + 0.9 * g.crestZ, far - 6)],
        budgetMs: spec.budgetMs || 3000
      };
      if (spec.layer) search.layer = { z: 0.5 * (spec.layer.zTop + spec.layer.zBottom), entryMin: crestA - 0.5 * run, exitMax: far - 3 };
      const r = analyze(model, search);
      // back to world coordinates
      const crit = r.critical;
      if (crit && up) {
        crit.pts = crit.pts.map(p => [-p[0], p[1]]);
        crit.entry = crit.pts[0]; crit.exit = crit.pts[crit.pts.length - 1];
        crit.xc = -crit.xc;
        crit.slices.forEach(s => { s.x = -s.x; });
      }
      sideOut[side] = {
        side, fos: r.fos, method: r.method, critical: crit,
        circleFos: r.circle ? r.circle.fos : NaN, spencerOnCircle: r.circle ? r.circle.spencerFos : NaN,
        blockFos: r.block ? r.block.fos : NaN,
        tried: r.tried, timedOut: r.timedOut, ms: r.ms,
        drawdown: up
      };
      // pressure head after the drawdown, for drawing (NaN outside the soil)
      if (up) sideOut[side].psi = Float32Array.from(psi);
    }
    sideOut.ms = nowMs() - t0;
    sideOut.materials = mats.length;
    return sideOut;
  }

  // ------------------------------------------------------------------ "Build your own dam"
  // Typical (not design) values. k: saturated hydraulic conductivity; alpha: Gardner
  // unsaturated parameter for the seepage model; c', phi': effective strength; gm / gs:
  // unit weight above / below the phreatic surface.
  const BUILD = {
    materials: [
      { key: 'fill', k: 1e-7, alpha: 0.25, c: 10, phi: 32, gm: 19, gs: 20.5 },
      { key: 'clay', k: 1e-9, alpha: 0.25, c: 8, phi: 26, gm: 19, gs: 20 },
      { key: 'rock', k: 1e-4, alpha: 0.1, c: 0, phi: 42, gm: 20, gs: 22 },
      { key: 'filter', k: 1e-3, alpha: 0.2, drain: true, c: 0, phi: 36, gm: 18.5, gs: 21 },
      { key: 'tsand', k: 1e-5, alpha: 0.15, c: 0, phi: 33, gm: 17.5, gs: 19.5 }
    ],
    foundations: {
      gravel: { k: 1e-5, alpha: 0.25, c: 0, phi: 36, gm: 19, gs: 21 },
      clay: { k: 5e-8, alpha: 0.25, c: 10, phi: 28, gm: 19, gs: 20 },
      weak: { k: 5e-8, alpha: 0.25, c: 10, phi: 28, gm: 19, gs: 20,
        layer: { zTop: -4, zBottom: -6, k: 1e-9, alpha: 0.25, c: 0, phi: 19, gm: 18, gs: 18.5 } }
    },
    slopes: [1.5, 2, 2.5, 3],
    minDepth: 2,
    // starting zonings: material index for a dam cell centred at (x, z), downstream slope s
    presets: {
      homogeneous: () => 0,
      cored: (x, z) => (inCore(x, z) ? 1 : 2),
      filtered: (x, z) => (inCore(x, z) ? 1 : x > 0 && ((z <= 20 && x <= coreW(z) + 2) || z <= 2) ? 3 : 2),
      drained: (x, z) => ((z <= 20 && x >= 4 && x <= 6) || (z <= 2 && x >= 4) ? 3 : 0),
      leaky: () => 2,
      tailings: () => 4
    }
  };
  // Missions: start design, settings the reader may not change, pass conditions
  // (maxQ L/day per metre, minPipe = safety against piping, minFoS = downstream slope,
  //  maxClay m3 per metre, minTsand = share of the dam in tailings sand)
  BUILD.missions = [
    { id: 'dry', start: { preset: 'homogeneous', slope: 2, foundation: 'clay', cutoff: 'none', reservoir: 0.85 }, lock: ['slope', 'reservoir'], goals: { minFoS: 1.5, minPipe: 3 } },
    { id: 'hold', start: { preset: 'leaky', slope: 2, foundation: 'gravel', cutoff: 'none', reservoir: 0.85 }, lock: ['foundation', 'reservoir'], goals: { maxQ: 100, minPipe: 3, minFoS: 1.5, maxClay: 350 } },
    { id: 'polley', start: { preset: 'cored', slope: 2, foundation: 'weak', cutoff: 'none', reservoir: 0.85 }, lock: ['foundation', 'reservoir'], goals: { minFoS: 1.5 } },
    { id: 'tailings', start: { preset: 'tailings', slope: 2, foundation: 'clay', cutoff: 'none', reservoir: 0.85 }, lock: ['foundation', 'reservoir'], goals: { minFoS: 1.5, minPipe: 3, minTsand: 0.7 } }
  ];
  // the numbers the page shows and the missions check
  function designMetrics(seep, stab) {
    const L = v => v * 86400e3;
    let clay = 0, tsand = 0, dam = 0;
    for (let c = 0; c < seep.mat.length; c++) {
      const m = seep.mat[c];
      if (m < 10) continue;
      dam++;
      const key = BUILD.materials[m - 10] && BUILD.materials[m - 10].key;
      if (key === 'clay') clay++; else if (key === 'tsand') tsand++;
    }
    const ex = seep.exit, d = stab.downstream || {}, u = stab.upstream || {};
    return {
      qLday: L(seep.q.inflowTotal), qDrainLday: L(seep.q.outDrain), qFaceLday: L(seep.q.outSeepageFace), qGroundLday: L(seep.q.outTailwater),
      iExit: Math.max(ex.groundMax || 0, ex.faceMax || 0), exitWhere: ex.governing, pipe: ex.fs,
      seepageFaceTop: seep.seepageFace.present ? seep.seepageFace.topZ : 0,
      fos: d.fos, fosMethod: d.method, fosUp: u.fos,
      clay, tsandFrac: dam ? tsand / dam : 0, damCells: dam,
      converged: !!seep.stats.converged, balance: seep.q.balanceError
    };
  }
  function missionCheck(mission, m) {
    const g = mission.goals, out = [];
    if (g.maxQ != null) out.push({ key: 'q', ok: m.qLday <= g.maxQ });
    if (g.minPipe != null) out.push({ key: 'pipe', ok: m.pipe >= g.minPipe });
    if (g.minFoS != null) out.push({ key: 'fos', ok: m.fos >= g.minFoS });
    if (g.maxClay != null) out.push({ key: 'clay', ok: m.clay <= g.maxClay });
    if (g.minTsand != null) out.push({ key: 'tsand', ok: m.tsandFrac >= g.minTsand });
    return { ok: out.every(c => c.ok), checks: out };
  }
  function coreW(z) { return 1.5 + 0.4 * (23 - z); }
  function inCore(x, z) { return z <= 23 && Math.abs(x) <= coreW(z); }
  // full-grid cell array for a preset (grid of the seepage solver: 170 x 39, x0 -80, z0 -15)
  function presetCells(name, slope, grid) {
    grid = grid || { nx: 170, nz: 39, x0: -80, z0: -15 };
    const f = BUILD.presets[name] || BUILD.presets.homogeneous, s = slope || 2;
    const cells = new Uint8Array(grid.nx * grid.nz);
    for (let i = 0; i < grid.nx; i++) for (let j = 0; j < grid.nz; j++) {
      const x = grid.x0 + i + 0.5, z = grid.z0 + j + 0.5;
      cells[i * grid.nz + j] = z >= 0 ? f(x, z, s) : 0;
    }
    return cells;
  }
  // design = { cells (material index per grid cell), slope, foundation: 'gravel'|'clay'|'weak',
  //            cutoff: 'none'|'partial'|'full', reservoir (0.4 .. 0.95) }
  function buildRequest(d) {
    const F = BUILD.foundations[d.foundation] || BUILD.foundations.clay;
    const s = d.slope || 2;
    return {
      seep: {
        reservoir: d.reservoir, cutoff: d.cutoff || 'none',
        custom: { materials: BUILD.materials, cells: d.cells, downSlope: s, foundation: { k: F.k, alpha: F.alpha }, layers: F.layer ? [F.layer] : [] }
      },
      stab: {
        geom: { crestZ: 24, crestX0: -3, crestX1: 3, upToeX: -51, downSlope: s, downToeX: 3 + 24 * s },
        materials: BUILD.materials, foundation: F, layer: F.layer || null,
        sides: ['downstream', 'upstream'], minDepth: BUILD.minDepth, budgetMs: 2000
      }
    };
  }
  // Node / main thread: seepage then stability (seep = the SeepageSolver module)
  function runDesign(d, seepSolver) {
    const q = buildRequest(d);
    const seep = seepSolver.solveSeepage(q.seep);
    return { seep, stab: analyzeDam(seep, q.stab) };
  }

  // ------------------------------------------------------------------ exports
  const api = { analyze, analyzeDam, bishop, spencer, circleSlices, polySlices, surfZ, GAMMA_W, BUILD, buildRequest, runDesign, presetCells, designMetrics, missionCheck };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (typeof self !== 'undefined') {
    self.StabilitySolver = api;
  }
  // Worker: seepage then stability in one message (seepage-solver.js is loaded first in
  // the same worker and defines self.SeepageSolver; this handler replaces its own).
  if (typeof self !== 'undefined' && typeof self.postMessage === 'function' &&
      typeof window === 'undefined' && typeof module === 'undefined') {
    self.onmessage = function (e) {
      const d = (e && e.data) || {};
      const msg = { id: d.id };
      try {
        if (d.kind === 'build') {
          const t0 = nowMs();
          const seep = self.SeepageSolver.solveSeepage(d.seep || {});
          const stab = analyzeDam(seep, d.stab || {});
          delete seep.equipotentials;
          msg.seep = seep; msg.stab = stab; msg.ms = nowMs() - t0;
          const tr = [seep.h.buffer, seep.psi.buffer, seep.type.buffer, seep.mat.buffer];
          if (stab.upstream && stab.upstream.psi) tr.push(stab.upstream.psi.buffer);
          self.postMessage(msg, tr);
          return;
        }
        if (self.SeepageSolver) { msg.result = self.SeepageSolver.solveSeepage(d.params || {}); self.postMessage(msg); return; }
        msg.error = 'unknown request';
      } catch (err) { msg.error = String((err && err.message) || err); }
      self.postMessage(msg);
    };
  }
})();
