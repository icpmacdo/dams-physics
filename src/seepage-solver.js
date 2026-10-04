/*
 * seepage-solver.js
 *
 * Steady-state 2D (vertical section, per metre of dam length) saturated–unsaturated
 * groundwater seepage through an embankment dam and its foundation.
 *
 *   div( K(x,z) · kr(psi) · grad h ) = 0,   h = total head,  psi = h − z
 *
 * - Cell-centred finite volumes on a uniform 1 m × 1 m grid. Face conductance =
 *   harmonic mean of the two saturated K's × kr of the UPSTREAM cell (the standard
 *   monotone choice for unsaturated flow).
 * - kr(psi): Gardner exponential exp(psi/alpha) with a C1-smoothed air entry and an
 *   additive floor KR_MIN = 1e-6 (alpha = 0.25 m fine soils, 0.1 m coarse shell);
 *   kr = 1 for psi >= 0. See kr() below.
 * - Nonlinear solve: Picard iterations (SPD system, envelope Cholesky) with an
 *   alpha-continuation start, then Newton with pseudo-transient continuation
 *   (non-symmetric Jacobian, envelope LU). Every linear solve is DIRECT, in z-fastest
 *   order over the active cells (index = i*nz + j, envelope width <= nz), so the
 *   1e-4 … 1e-15 m/s conductance contrasts are no problem.
 * - Seepage faces and drains are unilateral (one-way) boundaries: every dam-cell face
 *   exposed to air, and every soil face touching a drain cell, is held at atmospheric
 *   pressure AT THE FACE (h = face elevation, half-cell conductance 2K) while water flows
 *   out, and is closed (no flow) otherwise. An active-set iteration on these faces is
 *   converged jointly with the nonlinear iteration.
 * - Upstream stair-step faces that lie below the reservoir level are reservoir faces.
 *
 * Result fields: see solveSeepage(). Outflow is reported per boundary type; flow lines
 * are traced with Pollock's semi-analytic method on the face fluxes.
 *
 * Works in Node (`require`) and as a Web Worker script (postMessage protocol
 * { id, params } -> { id, result }). No dependencies, no DOM, ES2019.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ constants
  const NX = 170, NZ = 39, NCELL = NX * NZ;
  const X0 = -80, Z0 = -15, DX = 1;
  const CREST_Z = 24, UP_TOE_X = -51, DOWN_TOE_X = 51;
  const CORE_TOP_Z = 23;

  const T_AIR = 0, T_SOIL = 1, T_WATER = 2, T_DRAIN = 3, T_CUTOFF = 4, T_TAIL = 5;
  const M_NONE = 0, M_FOUND = 1, M_FILL = 2, M_CORE = 3, M_SHELL = 4;

  const K_PERVIOUS = 1e-5, K_TIGHT = 5e-8, K_FILL = 1e-7, K_CORE = 1e-9, K_SHELL = 1e-4;

  // unsaturated relative conductivity (see kr()): Gardner alpha per material, floor
  const ALPHA_BY_MAT = [0.25, 0.25, 0.25, 0.25, 0.1];
  const KR_MIN = 1e-6;

  const POROSITY = 0.3;
  const I_CRIT = 1.0;

  // boundary-face kinds
  // (B_DRAIN and B_SEEP are one-way: open only while water flows OUT of the soil)
  const B_AIR = 0, B_WATER = 1, B_DRAIN = 2, B_TAIL = 3, B_SEEP = 4;

  // iteration controls
  const MAX_IT = 200;
  const TOL_H = 1e-5;          // m, Newton step (max head correction) at convergence
  const DMAX = 2;              // m, per-cell cap on a Newton head correction
  const DTAU0 = 1, DTAU_MIN = 1e-3, DTAU_MAX = 1e12, DTAU_CONV = 1e3; // pseudo-transient
  const PTC_GROW = 10, PTC_REJECT = 2;
  const UP_HYST = 0.01;        // m, upstream-switch hysteresis in the Newton phase
  const PICARD_MAX = 20, PICARD_MAX_WARM = 4;
  const DTAU_STALL = 0.01, NEWTON_PATIENCE = 15, PICARD_RETRY = 8; // Newton stall guard       // Picard iterations (after the alpha continuation) before Newton
  const SWITCH_TOL = 0.05;     // m, switch to Newton once the Picard change drops below this
  const ALPHA_START = 8;       // alpha continuation: start with alpha * 8 ...
  const ALPHA_DECAY = 0.6;     // ... and shrink by this factor each iteration down to 1
  const TIME_BUDGET_MS = 2500; // safety stop only (reported as not converged); typical 30-150 ms

  const EPS = 1e-9;

  const GEOM = {
    x0: X0, x1: X0 + NX * DX, z0: Z0, z1: Z0 + NZ * DX, dx: DX, nx: NX, nz: NZ,
    groundZ: 0,
    dam: {
      crestZ: CREST_Z, crestX0: -3, crestX1: 3, upToeX: UP_TOE_X, downToeX: DOWN_TOE_X,
      slopeH: 2, // 2H:1V both faces
      polygon: [[UP_TOE_X, 0], [-3, CREST_Z], [3, CREST_Z], [DOWN_TOE_X, 0]]
    },
    // core (damType 'cored'): dam cells with z <= topZ and |x| <= halfWidthTop + widening*(topZ - z)
    core: { topZ: CORE_TOP_Z, halfWidthTop: 1.5, widening: 0.4, halfWidthAtGround: 10.7 },
    k: { foundationPervious: K_PERVIOUS, foundationTight: K_TIGHT, fill: K_FILL, core: K_CORE, shell: K_SHELL },
    drains: {
      toe: { xMin: 39, zMax: 4 },
      chimney: { zMax: 20, homogeneousX: [4, 6], coredWidth: 2 },
      blanket: { zMax: 2 }
    },
    cutoff: { halfWidth: 1, partialBottomZ: -7.5, fullBottomZ: Z0 },
    reservoir: { fullLevel: CREST_Z, min: 0.4, max: 0.95, default: 0.85 }, // Hw = reservoir * fullLevel
    tailwater: { level: 0, xMin: DOWN_TOE_X },
    porosity: POROSITY,
    criticalGradient: I_CRIT,
    // kr = 1 (psi>=0); KR_MIN + (1-KR_MIN)*exp(-psi^2/(2 a^2)) (-a<=psi<0); KR_MIN + (1-KR_MIN)*exp(psi/a + 1/2) (psi<-a)
    unsaturated: { alpha: { foundation: 0.25, fill: 0.25, core: 0.25, shell: 0.1 }, krMin: KR_MIN },
    types: { air: T_AIR, soil: T_SOIL, water: T_WATER, drain: T_DRAIN, cutoff: T_CUTOFF, tailwater: T_TAIL },
    mats: { none: M_NONE, foundation: M_FOUND, fill: M_FILL, core: M_CORE, shell: M_SHELL }
  };

  // ------------------------------------------------------------------ geometry helpers
  function cellX(i) { return X0 + 0.5 * DX + i * DX; }
  function cellZ(j) { return Z0 + 0.5 * DX + j * DX; }
  function upFaceX(z) { return UP_TOE_X + 2 * z; }
  function downFaceX(z) { return DOWN_TOE_X - 2 * z; }
  function inDam(x, z) { return z >= 0 && z <= CREST_Z && x >= upFaceX(z) && x <= downFaceX(z); }
  function coreHalfWidth(z) { return 1.5 + 0.4 * (CORE_TOP_Z - z); }

  function nowMs() {
    return (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
      ? performance.now() : Date.now();
  }

  function normalizeParams(params) {
    const pick = (v, list, def) => (list.indexOf(v) >= 0 ? v : def);
    let r = Number(params.reservoir);
    if (!isFinite(r)) r = 0.85;
    // the specified range is 0.4 - 0.95; above 0.95 the water would overtop the core (z = 23)
    r = Math.min(0.95, Math.max(0.05, r));
    return {
      damType: pick(params.damType, ['homogeneous', 'cored'], 'homogeneous'),
      drain: pick(params.drain, ['none', 'toe', 'chimney'], 'none'),
      cutoff: pick(params.cutoff, ['none', 'partial', 'full'], 'none'),
      foundation: pick(params.foundation, ['pervious', 'tight'], 'pervious'),
      reservoir: r
    };
  }

  function isDrainCell(p, cored, x, z) {
    if (p.drain === 'toe') return x >= 39 - EPS && z <= 4 + EPS;
    if (p.drain === 'chimney') {
      if (cored) {
        // called only for non-core cells, so x > w(z) already holds on the downstream side
        if (x <= 0) return false;
        if (z <= 20 + EPS && x <= coreHalfWidth(z) + 2 + EPS) return true; // chimney
        return z <= 2 + EPS;                                                // blanket to the toe
      }
      if (z <= 20 + EPS && x >= 4 - EPS && x <= 6 + EPS) return true;     // chimney
      return z <= 2 + EPS && x >= 4 - EPS;                                 // blanket to the toe
    }
    return false;
  }

  // ------------------------------------------------------------------ model setup
  function buildModel(p) {
    const cored = p.damType === 'cored';
    const Kfound = p.foundation === 'tight' ? K_TIGHT : K_PERVIOUS;
    const Hw = p.reservoir * CREST_Z;
    const type = new Uint8Array(NCELL), mat = new Uint8Array(NCELL);

    for (let i = 0; i < NX; i++) {
      const x = cellX(i);
      for (let j = 0; j < NZ; j++) {
        const z = cellZ(j), c = i * NZ + j;
        if (z < 0) {
          mat[c] = M_FOUND; type[c] = T_SOIL;
          if (p.cutoff !== 'none' && Math.abs(x) <= 1 + EPS && (p.cutoff === 'full' || z >= -7.5 - EPS)) type[c] = T_CUTOFF;
        } else if (inDam(x, z)) {
          let m = M_FILL;
          if (cored) m = (z <= CORE_TOP_Z + EPS && Math.abs(x) <= coreHalfWidth(z) + EPS) ? M_CORE : M_SHELL;
          mat[c] = m; type[c] = T_SOIL;
          if (m !== M_CORE && isDrainCell(p, cored, x, z)) type[c] = T_DRAIN;
        } else if (z < Hw && x < upFaceX(z)) {
          type[c] = T_WATER;
        } else if (Math.abs(z - 0.5) < EPS && x > DOWN_TOE_X) {
          type[c] = T_TAIL;
        }
      }
    }

    // ---- unknown numbering (active soil cells), z-fastest
    const id = new Int32Array(NCELL).fill(-1);
    let nU = 0;
    for (let c = 0; c < NCELL; c++) if (type[c] === T_SOIL) id[c] = nU++;
    const ucell = new Int32Array(nU), ux = new Float64Array(nU), uz = new Float64Array(nU);
    const uK = new Float64Array(nU), uAlpha = new Float64Array(nU), umat = new Uint8Array(nU);
    for (let c = 0; c < NCELL; c++) {
      const a = id[c];
      if (a < 0) continue;
      const i = (c / NZ) | 0, j = c - i * NZ;
      ucell[a] = c; ux[a] = cellX(i); uz[a] = cellZ(j); umat[a] = mat[c];
      uK[a] = mat[c] === M_FOUND ? Kfound : mat[c] === M_CORE ? K_CORE : mat[c] === M_SHELL ? K_SHELL : K_FILL;
      uAlpha[a] = ALPHA_BY_MAT[mat[c]];
    }

    // ---- faces
    const fa = [], fb = [], fzf = [], fdir = [], fgrid = [];
    const ba = [], bkind = [], bh = [], bdir = [], bgrid = [], bsign = [];
    function addBoundary(a, nbType, dir, sign, grid, zInterface, nbCell) {
      let kind, head;
      if (nbType === T_AIR) {
        // Stair-step artefact on the upstream face: an "air" cell (centre above Hw)
        // whose shared face with the dam lies below Hw is in reality submerged, so the
        // face is a reservoir face, not a seepage-face candidate.
        const ni = (nbCell / NZ) | 0, nj = nbCell - ni * NZ;
        if (zInterface < Hw && cellX(ni) < upFaceX(cellZ(nj))) { kind = B_WATER; head = Hw; }
        // dam face exposed to air: potential seepage face, atmospheric (psi = 0) at the
        // exposed face itself (not at the cell centre, which for a top face lies 0.5 m lower)
        else if (umat[a] !== M_FOUND) { kind = B_SEEP; head = zInterface; }
        else { kind = B_AIR; head = 0; }
      }
      else if (nbType === T_WATER) { kind = B_WATER; head = Hw; }
      else if (nbType === T_DRAIN) { kind = B_DRAIN; head = zInterface; } // psi = 0 at the soil/drain interface
      else if (nbType === T_TAIL) { kind = B_TAIL; head = 0; }
      else return; // cutoff: no flow
      ba.push(a); bkind.push(kind); bh.push(head); bdir.push(dir); bsign.push(sign); bgrid.push(grid);
    }
    for (let a = 0; a < nU; a++) {
      const c = ucell[a], i = (c / NZ) | 0, j = c - i * NZ, z = uz[a];
      // east
      if (i + 1 < NX) {
        const nb = c + NZ;
        if (type[nb] === T_SOIL) { fa.push(a); fb.push(id[nb]); fzf.push(z); fdir.push(0); fgrid.push((i + 1) * NZ + j); }
        else addBoundary(a, type[nb], 0, 1, (i + 1) * NZ + j, z, nb);
      }
      // west
      if (i - 1 >= 0) {
        const nb = c - NZ;
        if (type[nb] !== T_SOIL) addBoundary(a, type[nb], 0, -1, i * NZ + j, z, nb);
      }
      // north
      if (j + 1 < NZ) {
        const nb = c + 1;
        if (type[nb] === T_SOIL) { fa.push(a); fb.push(id[nb]); fzf.push(z + 0.5); fdir.push(1); fgrid.push(i * (NZ + 1) + j + 1); }
        else addBoundary(a, type[nb], 1, 1, i * (NZ + 1) + j + 1, z + 0.5, nb);
      }
      // south
      if (j - 1 >= 0) {
        const nb = c - 1;
        if (type[nb] !== T_SOIL) addBoundary(a, type[nb], 1, -1, i * (NZ + 1) + j, z - 0.5, nb);
      }
    }
    const nF = fa.length, nB = ba.length;
    const M = {
      p, cored, Hw, type, mat, id, nU, ucell, ux, uz, uK, uAlpha, umat,
      nF, fa: Int32Array.from(fa), fb: Int32Array.from(fb), fzf: Float64Array.from(fzf),
      fdir: Uint8Array.from(fdir), fgrid: Int32Array.from(fgrid),
      nB, ba: Int32Array.from(ba), bkind: Uint8Array.from(bkind), bh: Float64Array.from(bh),
      bdir: Uint8Array.from(bdir), bsign: Int8Array.from(bsign), bgrid: Int32Array.from(bgrid)
    };

    // ---- one-way faces (drain and seepage faces), controlled by the active-set iteration
    const ow = [];
    for (let g = 0; g < nB; g++) if (M.bkind[g] === B_DRAIN || M.bkind[g] === B_SEEP) ow.push(g);
    M.oneWay = Int32Array.from(ow);

    // ---- envelope (skyline) structure of the SPD system
    const first = new Int32Array(nU);
    for (let a = 0; a < nU; a++) first[a] = a;
    for (let f = 0; f < nF; f++) { const a = M.fa[f], b = M.fb[f]; if (a < first[b]) first[b] = a; }
    const ptr = new Int32Array(nU + 1);
    for (let a = 0; a < nU; a++) ptr[a + 1] = ptr[a] + (a - first[a] + 1);
    M.first = first; M.ptr = ptr; M.envSize = ptr[nU];
    // saturated face conductances: harmonic mean for internal faces; half-cell coupling
    // (2 K) to fixed-head neighbours, whose interface is at psi >= 0 (kr = 1)
    M.Kh = new Float64Array(nF);
    for (let f = 0; f < nF; f++) { const ka = uK[M.fa[f]], kb = uK[M.fb[f]]; M.Kh[f] = 2 * ka * kb / (ka + kb); }
    M.Cb = new Float64Array(nB);
    for (let g = 0; g < nB; g++) M.Cb[g] = M.bkind[g] === B_AIR ? 0 : 2 * uK[M.ba[g]];
    // position of the (b, a) entry of each internal face, and of each diagonal
    M.fpos = new Int32Array(nF);
    for (let f = 0; f < nF; f++) { const a = M.fa[f], b = M.fb[f]; M.fpos[f] = ptr[b] + (a - first[b]); }
    M.dpos = new Int32Array(nU);
    for (let a = 0; a < nU; a++) M.dpos[a] = ptr[a + 1] - 1;
    return M;
  }

  // ------------------------------------------------------------------ linear algebra
  // In-place envelope (skyline) Cholesky A = L L^T for the SPD Picard matrix. Row r stores
  // columns first[r]..r; fill-in stays inside this envelope, whose width is at most nz
  // in the z-fastest ordering.
  function choleskyEnvelope(val, ptr, first, n) {
    for (let r = 0; r < n; r++) {
      const fr = first[r], pr = ptr[r] - fr;
      for (let c = fr; c < r; c++) {
        const fc = first[c], pc = ptr[c] - fc;
        const k0 = fr > fc ? fr : fc;
        let s = val[pr + c];
        for (let k = k0; k < c; k++) s -= val[pr + k] * val[pc + k];
        val[pr + c] = s / val[pc + c];
      }
      let d = val[pr + r];
      for (let k = fr; k < r; k++) { const v = val[pr + k]; d -= v * v; }
      val[pr + r] = Math.sqrt(d > 0 ? d : 1e-300);
    }
  }
  function solveEnvelope(val, ptr, first, n, b, x) {
    for (let r = 0; r < n; r++) {
      const fr = first[r], pr = ptr[r] - fr;
      let s = b[r];
      for (let k = fr; k < r; k++) s -= val[pr + k] * x[k];
      x[r] = s / val[pr + r];
    }
    for (let r = n - 1; r >= 0; r--) {
      const fr = first[r], pr = ptr[r] - fr;
      const xr = x[r] / val[pr + r];
      x[r] = xr;
      for (let k = fr; k < r; k++) x[k] -= val[pr + k] * xr;
    }
  }

  // In-place envelope (skyline) LU without pivoting, A = L U with unit-diagonal L.
  // Row r of L occupies columns first[r]..r-1 and column r of U rows first[r]..r of the
  // same index range (the sparsity pattern is symmetric). With upstream-weighted kr the
  // Newton Jacobian has non-positive off-diagonals and zero column sums from internal
  // faces (plus positive Dirichlet terms on the diagonal), i.e. it is column diagonally
  // dominant, for which Gaussian elimination without pivoting is stable. Conductance
  // contrasts of 1e10 and more are handled exactly (direct method, no iteration).
  function luEnvelope(L, U, ptr, first, n) {
    for (let r = 0; r < n; r++) {
      const fr = first[r], pr = ptr[r] - fr;
      for (let c = fr; c < r; c++) {
        const fc = first[c], pc = ptr[c] - fc;
        const k0 = fr > fc ? fr : fc;
        let sl = L[pr + c], su = U[pr + c];
        for (let k = k0; k < c; k++) { sl -= L[pr + k] * U[pc + k]; su -= L[pc + k] * U[pr + k]; }
        L[pr + c] = sl / U[pc + c];
        U[pr + c] = su;
      }
      let d = U[pr + r];
      for (let k = fr; k < r; k++) d -= L[pr + k] * U[pr + k];
      U[pr + r] = d;
    }
  }
  function luSolve(L, U, ptr, first, n, b, x) {
    for (let r = 0; r < n; r++) {           // L y = b
      const fr = first[r], pr = ptr[r] - fr;
      let s = b[r];
      for (let k = fr; k < r; k++) s -= L[pr + k] * x[k];
      x[r] = s;
    }
    for (let r = n - 1; r >= 0; r--) {      // U x = y (U stored by columns)
      const fr = first[r], pr = ptr[r] - fr;
      const xr = x[r] / U[pr + r];
      x[r] = xr;
      for (let k = fr; k < r; k++) x[k] -= U[pr + k] * xr;
    }
  }

  // ------------------------------------------------------------------ discretisation
  // Relative conductivity: Gardner exponential with a C1-smoothed air entry and an
  // additive floor (smooth everywhere, so Newton sees no kinks):
  //   kr = 1                                               psi >= 0
  //   kr = KR_MIN + (1-KR_MIN) exp(-psi^2 / (2 alpha^2))     -alpha <= psi < 0
  //   kr = KR_MIN + (1-KR_MIN) exp(psi/alpha + 1/2)         psi < -alpha
  // krD receives dkr/dpsi.
  let krD = 0;
  function kr(psi, al) {
    if (psi >= 0) { krD = 0; return 1; }
    let phi, dphi;
    if (psi > -al) { phi = -psi * psi / (2 * al); dphi = -psi / al; }
    else { phi = psi + 0.5 * al; dphi = 1; }
    const e = (1 - KR_MIN) * Math.exp(phi / al);
    krD = e * dphi / al;
    return KR_MIN + e;
  }

  // Internal-face conductance C = harmonic(K_a, K_b) * kr(psi_up), with kr taken from
  // the upstream cell (higher head). E = dC/dh_up for the Newton Jacobian.
  // hyst > 0: the upstream cell only switches once the head difference exceeds hyst
  // (faces with |dh| < hyst carry negligible flow either way); this removes the
  // Jacobian chatter of upstream switching in near-hydrostatic unsaturated zones.
  function computeFaces(M, h, alphaMul, Cf, Ef, upA, hyst) {
    const fa = M.fa, fb = M.fb, Kh = M.Kh, uz = M.uz, uAlpha = M.uAlpha;
    for (let f = 0, nF = M.nF; f < nF; f++) {
      const a = fa[f], b = fb[f], dh = h[a] - h[b];
      const ua = hyst > 0 ? (dh > hyst ? true : dh < -hyst ? false : upA[f] === 1) : dh >= 0;
      const up = ua ? a : b;
      upA[f] = ua ? 1 : 0;
      const psi = h[up] - uz[up];
      let r = 1, d = 0;
      if (psi < 0) { r = kr(psi, uAlpha[up] * alphaMul); d = krD; }
      Cf[f] = Kh[f] * r;
      if (Ef) Ef[f] = Kh[f] * d;
    }
  }

  // Residual = net OUTflow of each cell (m^2/s per metre width).
  function residual(M, S, h, R) {
    const fa = M.fa, fb = M.fb, Cf = S.Cf, Cb = M.Cb, open = S.open;
    R.fill(0);
    for (let f = 0, nF = M.nF; f < nF; f++) {
      const a = fa[f], b = fb[f], F = Cf[f] * (h[a] - h[b]);
      R[a] += F; R[b] -= F;
    }
    const ba = M.ba, bh = M.bh;
    for (let g = 0, nB = M.nB; g < nB; g++) {
      if (!open[g]) continue;
      const a = ba[g];
      R[a] += Cb[g] * (h[a] - bh[g]);
    }
  }

  // Current (kr-dependent) conductance sum of each cell: the pseudo-transient capacity.
  function currentWeights(M, S, W) {
    const fa = M.fa, fb = M.fb, Cf = S.Cf, Cb = M.Cb, open = S.open;
    W.fill(0);
    for (let f = 0, nF = M.nF; f < nF; f++) { W[fa[f]] += Cf[f]; W[fb[f]] += Cf[f]; }
    for (let g = 0, nB = M.nB; g < nB; g++) {
      if (!open[g]) continue;
      W[M.ba[g]] += Cb[g];
    }
  }
  // Merit for step control: plain sum of squared cell flux imbalances (m^2/s)^2.
  // (Weighting by conductance was tried: saturated weights hide the shell's trickle
  // imbalances, current weights over-weight cells on the kr floor.)
  function merit(R) {
    let s = 0;
    for (let a = 0, n = R.length; a < n; a++) { const r = R[a] * 1e8; s += r * r; }
    return s;
  }

  function assembleJacobian(M, S, h) {
    const L = S.L, U = S.U, Cf = S.Cf, Ef = S.Ef, upA = S.upA, open = S.open;
    const fa = M.fa, fb = M.fb, fpos = M.fpos, dpos = M.dpos;
    L.fill(0); U.fill(0);
    for (let f = 0, nF = M.nF; f < nF; f++) {
      const a = fa[f], b = fb[f], C = Cf[f], dh = h[a] - h[b];
      let dFa, dFb; // derivatives of the a->b flux w.r.t. h_a and h_b
      if (upA[f]) { dFa = C + Ef[f] * dh; dFb = -C; }
      else { dFa = C; dFb = -C + Ef[f] * dh; }
      U[dpos[a]] += dFa; U[fpos[f]] += dFb;   // J_aa, J_ab
      U[dpos[b]] -= dFb; L[fpos[f]] -= dFa;   // J_bb, J_ba
    }
    const ba = M.ba, Cb = M.Cb;
    for (let g = 0, nB = M.nB; g < nB; g++) {
      if (!open[g]) continue;
      U[dpos[ba[g]]] += Cb[g];
    }
  }

  // Symmetric Picard matrix (conductances frozen at the current heads) into S.L.
  function assemblePicard(M, S, h, rhs) {
    const val = S.L, Cf = S.Cf, Cb = M.Cb, open = S.open;
    const fa = M.fa, fb = M.fb, fpos = M.fpos, dpos = M.dpos;
    val.fill(0); rhs.fill(0);
    for (let f = 0, nF = M.nF; f < nF; f++) {
      const C = Cf[f];
      val[dpos[fa[f]]] += C; val[dpos[fb[f]]] += C; val[fpos[f]] -= C;
    }
    const ba = M.ba, bh = M.bh;
    for (let g = 0, nB = M.nB; g < nB; g++) {
      if (!open[g]) continue;
      const a = ba[g];
      val[dpos[a]] += Cb[g];
      rhs[a] += Cb[g] * bh[g];
    }
  }

  function initialGuess(M, warm, h) {
    const Hw = M.Hw;
    for (let a = 0; a < M.nU; a++) {
      let v = NaN;
      if (warm && warm.length === NCELL) v = Number(warm[M.ucell[a]]);
      if (!isFinite(v)) {
        const x = M.ux[a];
        let f = (DOWN_TOE_X - x) / (DOWN_TOE_X - UP_TOE_X);
        if (M.cored && M.umat[a] !== M_FOUND) {
          // cored dam: the core carries almost all of the head drop
          const w = coreHalfWidth(Math.max(0, Math.min(CORE_TOP_Z, M.uz[a])));
          f = x < -w ? 1 : x > w ? 0.02 : 0.5 - 0.5 * x / w;
        }
        v = Hw * Math.min(1, Math.max(0, f));
      }
      h[a] = Math.min(Math.max(v, -1), Hw);
    }
  }

  // Active-set update for the one-way faces (drain and seepage faces): a face is open
  // while the cell head exceeds the face elevation (outflow), closed otherwise (no flow,
  // so water can never flow from a drain or from the air into the soil). Returns #changes.
  function updateActiveSets(M, S, h) {
    const open = S.open, ow = M.oneWay, ba = M.ba, bh = M.bh;
    let changes = 0;
    for (let k = 0; k < ow.length; k++) {
      const g = ow[k], d = h[ba[g]] - bh[g];
      if (open[g]) { if (d < -1e-6) { open[g] = 0; changes++; } }
      else if (d > 1e-6) { open[g] = 1; changes++; }
    }
    return changes;
  }

  // ------------------------------------------------------------------ main solve
  // params: { damType: 'homogeneous'|'cored', drain: 'none'|'toe'|'chimney',
  //           cutoff: 'none'|'partial'|'full', foundation: 'pervious'|'tight',
  //           reservoir: 0.4..0.95 (clamped to [0.05, 0.95]), warmStart?: previous result.h }
  // returns { params, Hw, nx, nz, x0, z0, dx,
  //   h, psi            Float64Array(nx*nz), index i*nz + j; NaN for air and cutoff cells
  //                     (reservoir cells: h = Hw; tailwater cells: h = 0; drains: h = z)
  //   type, mat         Uint8Array(nx*nz) (codes in GEOM.types / GEOM.mats)
  //   phreatic          [[x,z],...] psi = 0 in the dam, upstream -> downstream
  //   equipotentials    [{frac, level, lines: [[[x,z],...],...]}], frac = 0.1..0.9
  //   flowlines         [{group, seedFrac, pts: [[x,z,tSeconds,speed],...], exit}]
  //   q                 m^3/s per metre: inflowTotal, inflowDamFace, inflowFloor,
  //                     outDrain, outTailwater, outSeepageFace, balanceError
  //   exit              {groundMax, groundX, faceMax, faceX, faceZ, governing, fs}
  //   seepageFace       {present, topZ, bottomZ, faces} (downstream face, drains excluded)
  //   stats             {iterations, converged, ms, ...diagnostics} }
  function solveSeepage(params) {
    const t0 = nowMs();
    params = params || {};
    const p = normalizeParams(params);
    const M = buildModel(p);
    const nU = M.nU;
    const S = {
      L: new Float64Array(M.envSize), U: new Float64Array(M.envSize),
      Cf: new Float64Array(M.nF), Ef: new Float64Array(M.nF), upA: new Uint8Array(M.nF), Cb: M.Cb,
      open: new Uint8Array(M.nB)
    };
    const open = S.open;
    const h = new Float64Array(nU), dlt = new Float64Array(nU);
    const R = new Float64Array(nU), rhs = new Float64Array(nU);
    const warm = params.warmStart && params.warmStart.length === NCELL ? params.warmStart : null;
    initialGuess(M, warm, h);
    for (let g = 0; g < M.nB; g++) {
      const kind = M.bkind[g];
      open[g] = kind === B_WATER || kind === B_TAIL ? 1 : kind === B_AIR ? 0 : (h[M.ba[g]] > M.bh[g] ? 1 : 0);
    }

    // Phase 1 (Picard, SPD Cholesky): robust global placement of the saturated zone,
    //   started with an alpha-continuation (smoother kr) on a cold start.
    // Phase 2 (damped Newton, envelope LU): fast, reliable final convergence, also where
    //   Picard stalls (gravity drainage through unsaturated coarse shell).
    let alphaMul = warm ? 1 : ALPHA_START;
    let mode = 0; // 0 = Picard, 1 = Newton
    let omega = 0.7, prevDh = Infinity, picardIts = 0, newtonIts = 0;
    let picardLeft = 0, restarts = 0, phiBest = Infinity, sinceBest = 0;
    let dtau = DTAU0, phiPrev = Infinity, rejects = 0;
    const hSave = new Float64Array(nU), openSave = new Uint8Array(M.nB);
    const upSave = new Uint8Array(M.nF);
    const Wc = new Float64Array(nU);
    let it = 0, converged = false, step = Infinity, changes = 0, prevChanges = 0;

    for (it = 1; it <= MAX_IT; it++) {
      computeFaces(M, h, alphaMul, S.Cf, S.Ef, S.upA, mode === 1 ? UP_HYST : 0);
      let maxd = 0, phi0 = NaN;

      if (mode === 0) {
        assemblePicard(M, S, h, rhs);
        choleskyEnvelope(S.L, M.ptr, M.first, nU);
        solveEnvelope(S.L, M.ptr, M.first, nU, rhs, dlt);
        for (let a = 0; a < nU; a++) { const d = Math.abs(dlt[a] - h[a]); if (d > maxd) maxd = d; }
        for (let a = 0; a < nU; a++) h[a] += omega * (dlt[a] - h[a]);
        picardIts++;
      } else {
        residual(M, S, h, R);
        phi0 = merit(R);
        // pseudo-transient continuation: grow the pseudo time step while the residual
        // falls (-> pure Newton, quadratic convergence); reject a step that makes the
        // residual clearly worse (restore heads and active sets) and shrink the step.
        if (phiPrev < Infinity) {
          // (a step that also changed the active sets changed the residual function
          // itself, so its merit is not comparable: accept it)
          if (phi0 > PTC_REJECT * phiPrev && dtau > DTAU_MIN && prevChanges === 0) {
            h.set(hSave); open.set(openSave); S.upA.set(upSave);
            computeFaces(M, h, alphaMul, S.Cf, S.Ef, S.upA, UP_HYST);
            residual(M, S, h, R);
            phi0 = merit(R);
            dtau = Math.max(DTAU_MIN, dtau * 0.2);
            rejects++;
          } else if (phi0 < phiPrev) {
            const ratio = phiPrev / (phi0 > 1e-300 ? phi0 : 1e-300);
            dtau = Math.min(DTAU_MAX, dtau * Math.min(PTC_GROW, Math.max(2, ratio)));
          } else {
            dtau = Math.max(DTAU_MIN, dtau * 0.5);
          }
        }
        phiPrev = phi0;
        hSave.set(h); openSave.set(open); upSave.set(S.upA);
        assembleJacobian(M, S, h);
        currentWeights(M, S, Wc);
        const inv = 1 / dtau;
        for (let a = 0; a < nU; a++) S.U[M.dpos[a]] += Wc[a] * inv;
        luEnvelope(S.L, S.U, M.ptr, M.first, nU);
        for (let a = 0; a < nU; a++) rhs[a] = -R[a];
        luSolve(S.L, S.U, M.ptr, M.first, nU, rhs, dlt);
        for (let a = 0; a < nU; a++) {
          let d = dlt[a];
          if (d > DMAX) d = DMAX; else if (d < -DMAX) d = -DMAX; // safety clip
          const ad = d < 0 ? -d : d;
          if (ad > maxd) maxd = ad;
          h[a] += d;
        }
        newtonIts++;
      }
      step = maxd;
      prevChanges = changes = updateActiveSets(M, S, h);

      if (alphaMul > 1) { alphaMul = Math.max(1, alphaMul * ALPHA_DECAY); continue; }
      if (mode === 1) {
        if (maxd < TOL_H && changes === 0) {
          if (dtau >= DTAU_CONV) { converged = true; break; }
          // tiny step but still damped: verify with an (almost) undamped Newton step
          dtau = DTAU_MAX;
        }
        // stall guard: if Newton makes no headway (pseudo-time step collapsed, or no new
        // best residual for a while), go back to a few damped Picard sweeps and restart
        if (phi0 < phiBest * 0.9) { phiBest = phi0; sinceBest = 0; } else sinceBest++;
        if (dtau <= DTAU_STALL || sinceBest >= NEWTON_PATIENCE) {
          mode = 0; picardLeft = PICARD_RETRY; omega = 0.5; prevDh = Infinity; restarts++;
        }
      } else {
        if (maxd > prevDh) omega = Math.max(0.3, omega * 0.7); else omega = Math.min(1, omega * 1.1);
        prevDh = maxd;
        if (picardLeft > 0) picardLeft--;
        // (a warm start is usually close already: only a short Picard phase before Newton)
        const pmax = warm && restarts === 0 ? PICARD_MAX_WARM : PICARD_MAX;
        if (picardLeft === 0 && (maxd < SWITCH_TOL || picardIts >= pmax)) {
          mode = 1; dtau = DTAU0; phiPrev = Infinity; phiBest = Infinity; sinceBest = 0;
        }
      }
      if (nowMs() - t0 > TIME_BUDGET_MS) break;
    }
    if (it > MAX_IT) it = MAX_IT;

    computeFaces(M, h, 1, S.Cf, S.Ef, S.upA, mode === 1 ? UP_HYST : 0);
    residual(M, S, h, R);
    let maxRes = 0;
    for (let a = 0; a < nU; a++) { const r = Math.abs(R[a]); if (r > maxRes) maxRes = r; }

    const out = postProcess(M, S, h, p);
    out.stats = {
      iterations: it, converged, ms: 0,
      picardIterations: picardIts, newtonIterations: newtonIts, restarts,
      lastStep: step, maxCellImbalance: maxRes, rejectedSteps: rejects, unknowns: nU,
      openSeepageFaces: countOpen(M, open, B_SEEP),
      unsatShare: out._unsatShare
    };
    delete out._unsatShare;
    out.stats.ms = nowMs() - t0;
    return out;
  }

  function countOpen(M, open, kind) { let n = 0; for (let g = 0; g < M.nB; g++) if (M.bkind[g] === kind && open[g]) n++; return n; }

  // ------------------------------------------------------------------ post-processing
  function postProcess(M, S, hU, p) {
    const Hw = M.Hw, type = M.type, mat = M.mat, open = S.open;
    const Cf = S.Cf, Cb = S.Cb;

    // ---- grid fields
    const h = new Float64Array(NCELL), psi = new Float64Array(NCELL);
    for (let c = 0; c < NCELL; c++) {
      const i = (c / NZ) | 0, j = c - i * NZ, z = cellZ(j);
      const t = type[c];
      let v = NaN;
      if (t === T_SOIL) v = hU[M.id[c]];
      else if (t === T_WATER) v = Hw;
      else if (t === T_DRAIN) v = z;
      else if (t === T_TAIL) v = 0;
      h[c] = v; psi[c] = v - z;
    }
    // ---- face fluxes at the converged heads (used for tracing and budgets)
    const FX = new Float64Array((NX + 1) * NZ), FZ = new Float64Array(NX * (NZ + 1));
    for (let f = 0; f < M.nF; f++) {
      const q = Cf[f] * (hU[M.fa[f]] - hU[M.fb[f]]);
      if (M.fdir[f] === 0) FX[M.fgrid[f]] = q; else FZ[M.fgrid[f]] = q;
    }
    for (let g = 0; g < M.nB; g++) {
      if (!open[g]) continue;
      const qout = Cb[g] * (hU[M.ba[g]] - M.bh[g]);
      if (M.bdir[g] === 0) FX[M.bgrid[g]] = M.bsign[g] * qout; else FZ[M.bgrid[g]] = M.bsign[g] * qout;
    }

    // ---- water budget (conductances evaluated at the final heads, so any imbalance is
    //      the remaining nonlinear residual of the cells)
    let inDam = 0, inFloor = 0, outDrain = 0, outTail = 0, outFace = 0;
    for (let g = 0; g < M.nB; g++) {
      if (!open[g]) continue;
      const kind = M.bkind[g], a = M.ba[g], qout = Cb[g] * (hU[a] - M.bh[g]);
      if (kind === B_WATER) { if (M.umat[a] === M_FOUND) inFloor -= qout; else inDam -= qout; }
      else if (kind === B_DRAIN) outDrain += qout;
      else if (kind === B_TAIL) outTail += qout;
      else if (kind === B_SEEP) outFace += qout;
    }
    const inflowTotal = inDam + inFloor;
    const outflowTotal = outDrain + outTail + outFace;
    const q = {
      inflowTotal, inflowDamFace: inDam, inflowFloor: inFloor,
      outDrain, outTailwater: outTail, outSeepageFace: outFace,
      balanceError: inflowTotal > 0 ? Math.abs(inflowTotal - outflowTotal) / inflowTotal : 0
    };

    // ---- exit gradients: head drop over the half cell to the outflow boundary
    //      (tailwater ground surface at z = 0, or the exposed face of a seepage face)
    let groundMax = 0, groundX = NaN;
    for (let g = 0; g < M.nB; g++) {
      if (M.bkind[g] !== B_TAIL) continue;
      const a = M.ba[g];
      if (M.ux[a] <= DOWN_TOE_X) continue;
      const grad = hU[a] / 0.5;
      if (isNaN(groundX) || grad > groundMax) { groundMax = Math.max(0, grad); groundX = M.ux[a]; }
    }
    let faceMax = 0, faceX = NaN, faceZ = NaN, sfTop = -Infinity, sfBot = Infinity, sfCount = 0;
    for (let g = 0; g < M.nB; g++) {
      if (M.bkind[g] !== B_SEEP || !open[g]) continue;
      const a = M.ba[g];
      if (M.ux[a] <= 0) continue; // downstream face only (drains are separate boundaries)
      const side = M.bdir[g] === 0;
      const fx = side ? M.ux[a] + 0.5 * M.bsign[g] : M.ux[a];
      const fz = M.bh[g]; // face elevation (centre elevation for side faces)
      const grad = (hU[a] - M.bh[g]) / 0.5;
      if (grad > faceMax) { faceMax = grad; faceX = fx; faceZ = fz; }
      sfCount++;
      // extent along the face: a side face spans z_c +- 0.5, a top face sits at z_c + 0.5
      const top = M.uz[a] + 0.5, bot = side ? M.uz[a] - 0.5 : M.uz[a] + 0.5;
      if (top > sfTop) sfTop = top;
      if (bot < sfBot) sfBot = bot;
    }
    const gmax = Math.max(groundMax, faceMax);
    const exit = {
      groundMax, groundX, faceMax, faceX, faceZ,
      governing: faceMax > groundMax ? 'face' : 'ground',
      fs: gmax > 1e-9 ? I_CRIT / gmax : Infinity
    };
    const seepageFace = sfCount > 0
      ? { present: true, topZ: sfTop, bottomZ: Math.max(0, sfBot), faces: sfCount }
      : { present: false, topZ: NaN, bottomZ: NaN, faces: 0 };

    // ---- phreatic line: psi = 0 contour through dam cells (+ reservoir water)
    const V = new Float64Array(NCELL);
    for (let c = 0; c < NCELL; c++) {
      const t = type[c];
      V[c] = (t === T_SOIL && mat[c] !== M_FOUND) || t === T_WATER ? psi[c] : NaN;
    }
    let lines = contourLines(V, 0);
    let phreatic = [];
    let best = -1;
    for (const L of lines) { const len = polyLength(L); if (len > best) { best = len; phreatic = L; } }
    if (phreatic.length > 1) {
      if (phreatic[0][0] > phreatic[phreatic.length - 1][0]) phreatic.reverse();
      // start at the reservoir waterline on the upstream face
      const ux0 = upFaceX(Hw);
      if (Math.hypot(phreatic[0][0] - ux0, phreatic[0][1] - Hw) < 3) phreatic.unshift([ux0, Hw]);
      // finish at the exit point (top of the seepage face) on the downstream face
      const last = phreatic[phreatic.length - 1];
      if (seepageFace.present) {
        const ex = downFaceX(seepageFace.topZ), ez = seepageFace.topZ;
        if (ex > last[0] && last[1] >= ez - 1 && Math.hypot(ex - last[0], ez - last[1]) < 6) phreatic.push([ex, ez]);
      }
    }

    // ---- equipotentials (saturated active cells + reservoir water)
    for (let c = 0; c < NCELL; c++) {
      const t = type[c];
      V[c] = (t === T_SOIL && psi[c] >= -0.25) || t === T_WATER ? h[c] : NaN;
    }
    const equipotentials = [];
    for (let k = 1; k <= 9; k++) {
      const frac = k / 10, level = frac * Hw;
      const ls = contourLines(V, level).filter(L => L.length >= 2);
      equipotentials.push({ frac, level, lines: ls });
    }

    // ---- flow lines
    const flowlines = traceFlowLines(M, FX, FZ);

    // ---- diagnostic: share of the horizontal dam flow crossing x = -20, 0, 20 that passes
    //      between two unsaturated cells (i.e. above the phreatic surface)
    const unsatShare = {};
    for (const xs of [-20, 0, 20]) {
      const i = Math.round(xs - X0); // face at x = xs between columns i-1 and i
      let tot = 0, uns = 0;
      for (let j = 0; j < NZ; j++) {
        const z = cellZ(j);
        if (z < 0) continue;
        const qf = Math.abs(FX[i * NZ + j]);
        tot += qf;
        const ca = (i - 1) * NZ + j, cb = i * NZ + j;
        if (type[ca] === T_SOIL && type[cb] === T_SOIL && psi[ca] < 0 && psi[cb] < 0) uns += qf;
      }
      unsatShare['x' + xs] = tot > 0 ? uns / tot : 0;
    }

    return {
      params: p, Hw,
      nx: NX, nz: NZ, x0: X0, z0: Z0, dx: DX,
      h, psi, type: type, mat: mat,
      phreatic, equipotentials, flowlines,
      q, exit, seepageFace,
      _unsatShare: unsatShare
    };
  }

  function polyLength(L) {
    let s = 0;
    for (let k = 1; k < L.length; k++) s += Math.hypot(L[k][0] - L[k - 1][0], L[k][1] - L[k - 1][1]);
    return s;
  }

  // ------------------------------------------------------------------ contouring
  // Marching squares on the dual grid (corners = cell centres). V = NaN marks invalid
  // corners; squares touching an invalid corner are skipped. Segments are joined
  // into polylines through shared edge keys.
  function contourLines(V, level) {
    const nKeys = 2 * NCELL;
    const px = new Float64Array(nKeys), pz = new Float64Array(nKeys);
    const link0 = new Int32Array(nKeys).fill(-1), link1 = new Int32Array(nKeys).fill(-1);
    const segA = [], segB = [];
    const hKey = (i, j) => 2 * (i * NZ + j);     // edge (i,j)-(i+1,j)
    const vKey = (i, j) => 2 * (i * NZ + j) + 1; // edge (i,j)-(i,j+1)
    function edgePoint(e, i, j, v00, v10, v11, v01) {
      // edges: 0 bottom, 1 right, 2 top, 3 left
      let key, x, z, t;
      const xi = cellX(i), zj = cellZ(j);
      if (e === 0) { key = hKey(i, j); t = (level - v00) / (v10 - v00); x = xi + t; z = zj; }
      else if (e === 1) { key = vKey(i + 1, j); t = (level - v10) / (v11 - v10); x = xi + 1; z = zj + t; }
      else if (e === 2) { key = hKey(i, j + 1); t = (level - v01) / (v11 - v01); x = xi + t; z = zj + 1; }
      else { key = vKey(i, j); t = (level - v00) / (v01 - v00); x = xi; z = zj + t; }
      px[key] = x; pz[key] = z;
      return key;
    }
    function addSeg(k0, k1) {
      const s = segA.length;
      segA.push(k0); segB.push(k1);
      if (link0[k0] < 0) link0[k0] = s; else link1[k0] = s;
      if (link0[k1] < 0) link0[k1] = s; else link1[k1] = s;
    }
    const TABLE = [null, [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], null, [[0, 2]], [[3, 2]],
      [[2, 3]], [[0, 2]], null, [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], null];
    for (let i = 0; i < NX - 1; i++) {
      for (let j = 0; j < NZ - 1; j++) {
        const v00 = V[i * NZ + j], v10 = V[(i + 1) * NZ + j], v11 = V[(i + 1) * NZ + j + 1], v01 = V[i * NZ + j + 1];
        if (v00 !== v00 || v10 !== v10 || v11 !== v11 || v01 !== v01) continue; // NaN
        const idx = (v00 >= level ? 1 : 0) | (v10 >= level ? 2 : 0) | (v11 >= level ? 4 : 0) | (v01 >= level ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        let segs = TABLE[idx];
        if (idx === 5 || idx === 10) {
          const centreHigh = 0.25 * (v00 + v10 + v11 + v01) >= level;
          if (idx === 5) segs = centreHigh ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
          else segs = centreHigh ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]];
        }
        for (const sg of segs) {
          addSeg(edgePoint(sg[0], i, j, v00, v10, v11, v01), edgePoint(sg[1], i, j, v00, v10, v11, v01));
        }
      }
    }
    const nSeg = segA.length, used = new Uint8Array(nSeg), lines = [];
    function nextSeg(key) {
      const s0 = link0[key], s1 = link1[key];
      if (s0 >= 0 && !used[s0]) return s0;
      if (s1 >= 0 && !used[s1]) return s1;
      return -1;
    }
    for (let s = 0; s < nSeg; s++) {
      if (used[s]) continue;
      used[s] = 1;
      const fwd = [segA[s], segB[s]];
      let cur = segB[s];
      for (;;) {
        const n = nextSeg(cur); if (n < 0) break;
        used[n] = 1; cur = segA[n] === cur ? segB[n] : segA[n]; fwd.push(cur);
        if (cur === fwd[0]) break;
      }
      const back = [];
      if (fwd[fwd.length - 1] !== fwd[0]) {
        cur = segA[s];
        for (;;) {
          const n = nextSeg(cur); if (n < 0) break;
          used[n] = 1; cur = segA[n] === cur ? segB[n] : segA[n]; back.push(cur);
        }
      }
      const keys = back.reverse().concat(fwd);
      const L = [];
      for (const k of keys) {
        const x = px[k], z = pz[k];
        const prev = L[L.length - 1];
        if (!prev || Math.abs(prev[0] - x) > 1e-9 || Math.abs(prev[1] - z) > 1e-9) L.push([x, z]);
      }
      lines.push(L);
    }
    return lines;
  }

  // ------------------------------------------------------------------ flow lines (Pollock)
  function traceFlowLines(M, FX, FZ) {
    // inflow faces from the reservoir
    const dam = [], fnd = [];
    for (let g = 0; g < M.nB; g++) {
      if (M.bkind[g] !== B_WATER) continue;
      const a = M.ba[g];
      const qout = M.bdir[g] === 0 ? M.bsign[g] * FX[M.bgrid[g]] : M.bsign[g] * FZ[M.bgrid[g]];
      const qin = -qout;
      if (!(qin > 0)) continue;
      const x = M.ux[a], z = M.uz[a];
      // face geometry: start point (upstream end in the group's ordering) and direction
      let face;
      if (M.bdir[g] === 1) face = { x0: x + 0.5, z0: z + 0.5 * M.bsign[g], dxs: -1, dzs: 0, xm: x, zm: z + 0.5 * M.bsign[g] };
      else face = { x0: x + 0.5 * M.bsign[g], z0: z + 0.5, dxs: 0, dzs: -1, xm: x + 0.5 * M.bsign[g], zm: z };
      face.q = qin; face.a = a;
      if (M.umat[a] === M_FOUND) fnd.push(face); else dam.push(face);
    }
    dam.sort((A, B) => (2 * B.xm + B.zm) - (2 * A.xm + A.zm)); // top -> bottom along the upstream face
    fnd.sort((A, B) => B.xm - A.xm);                          // from the upstream toe leftwards
    const lines = [];
    seedGroup(dam, 4, 'dam');
    seedGroup(fnd, 5, 'foundation');
    return lines;

    function seedGroup(faces, nSeeds, group) {
      let total = 0;
      for (const f of faces) total += f.q;
      if (!(total > 0)) return;
      let k = 0, cum = 0;
      for (let s = 1; s <= nSeeds; s++) {
        const target = total * s / (nSeeds + 1);
        while (k < faces.length - 1 && cum + faces[k].q < target) { cum += faces[k].q; k++; }
        const f = faces[k];
        const frac = Math.min(1, Math.max(0, (target - cum) / f.q));
        const x = f.x0 + f.dxs * frac, z = f.z0 + f.dzs * frac;
        const c = M.ucell[f.a], i = (c / NZ) | 0, j = c - i * NZ;
        const r = tracePollock(M, FX, FZ, x, z, i, j);
        lines.push({ group, seedFrac: s / (nSeeds + 1), pts: r.pts, exit: r.exit });
      }
    }
  }

  function exitTime(p, vp, v1, v2, a) {
    if (vp > 0) {
      if (!(v2 > 0)) return Infinity;
      if (a === 0) return (1 - p) / vp;
      const t = Math.log1p((v2 - vp) / vp) / a;
      return t >= 0 ? t : 0;
    }
    if (vp < 0) {
      if (!(v1 < 0)) return Infinity;
      if (a === 0) return -p / vp;
      const t = Math.log1p((v1 - vp) / vp) / a;
      return t >= 0 ? t : 0;
    }
    return Infinity;
  }
  function advance(p, vp, a, t) {
    return p + vp * (a === 0 ? t : Math.expm1(a * t) / a);
  }

  function tracePollock(M, FX, FZ, x0, z0, i, j) {
    const n = POROSITY, type = M.type;
    let lx = Math.min(1, Math.max(0, x0 - (X0 + i * DX)));
    let lz = Math.min(1, Math.max(0, z0 - (Z0 + j * DX)));
    let t = 0, exit = 'other';
    const pts = [];
    {
      const vx1 = FX[i * NZ + j] / n, vx2 = FX[(i + 1) * NZ + j] / n;
      const vz1 = FZ[i * (NZ + 1) + j] / n, vz2 = FZ[i * (NZ + 1) + j + 1] / n;
      const vx = vx1 + (vx2 - vx1) * lx, vz = vz1 + (vz2 - vz1) * lz;
      pts.push([x0, z0, 0, Math.sqrt(vx * vx + vz * vz)]);
    }
    let lastX = x0, lastZ = z0, pend = null;
    const MAX_CELLS = 5000, MAX_PTS = 8000, SPACING = 0.3;
    for (let step = 0; step < MAX_CELLS && pts.length < MAX_PTS; step++) {
      const vx1 = FX[i * NZ + j] / n, vx2 = FX[(i + 1) * NZ + j] / n;
      const vz1 = FZ[i * (NZ + 1) + j] / n, vz2 = FZ[i * (NZ + 1) + j + 1] / n;
      const ax = vx2 - vx1, az = vz2 - vz1;
      const vxp = vx1 + ax * lx, vzp = vz1 + az * lz;
      const tx = exitTime(lx, vxp, vx1, vx2, ax), tz = exitTime(lz, vzp, vz1, vz2, az);
      const dt = tx < tz ? tx : tz;
      if (!(dt < Infinity)) { exit = 'other'; break; } // stagnation point
      let ex, ez, di = 0, dj = 0;
      if (tx <= tz) { ex = vxp > 0 ? 1 : 0; di = vxp > 0 ? 1 : -1; ez = Math.min(1, Math.max(0, advance(lz, vzp, az, dt))); }
      else { ez = vzp > 0 ? 1 : 0; dj = vzp > 0 ? 1 : -1; ex = Math.min(1, Math.max(0, advance(lx, vxp, ax, dt))); }
      // sample the analytic path finely, keep points ~SPACING apart
      const chord = Math.hypot(ex - lx, ez - lz);
      const nsub = Math.max(2, Math.ceil(chord / 0.08));
      for (let k = 1; k <= nsub; k++) {
        const tk = dt * k / nsub;
        const px = k === nsub ? ex : Math.min(1, Math.max(0, advance(lx, vxp, ax, tk)));
        const pz = k === nsub ? ez : Math.min(1, Math.max(0, advance(lz, vzp, az, tk)));
        const X = X0 + i * DX + px, Z = Z0 + j * DX + pz;
        if (Math.hypot(X - lastX, Z - lastZ) < SPACING) { pend = [X, Z, t + tk, px, pz, vx1, ax, vz1, az]; continue; }
        const vx = vx1 + ax * px, vz = vz1 + az * pz;
        pts.push([X, Z, t + tk, Math.sqrt(vx * vx + vz * vz)]);
        lastX = X; lastZ = Z; pend = null;
      }
      t += dt;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || ni >= NX || nj < 0 || nj >= NZ) { exit = 'other'; break; }
      const nc = ni * NZ + nj, tt = type[nc];
      if (tt === T_SOIL) {
        i = ni; j = nj;
        lx = di === 1 ? 0 : di === -1 ? 1 : ex;
        lz = dj === 1 ? 0 : dj === -1 ? 1 : ez;
        continue;
      }
      exit = tt === T_DRAIN ? 'drain' : tt === T_TAIL ? 'tailwater' : tt === T_AIR ? 'seepageFace' : 'other';
      break;
    }
    // always finish exactly at the end point (replacing a too-close previous point)
    if (pend) {
      const vx = pend[5] + pend[6] * pend[3], vz = pend[7] + pend[8] * pend[4];
      const end = [pend[0], pend[1], pend[2], Math.sqrt(vx * vx + vz * vz)];
      if (pts.length > 1 && Math.hypot(end[0] - lastX, end[1] - lastZ) < 0.1) pts[pts.length - 1] = end; else pts.push(end);
    }
    return { pts, exit };
  }

  // ------------------------------------------------------------------ exports
  const api = { solveSeepage, GEOM };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (typeof self !== 'undefined') {
    self.SeepageSolver = api;
  }
  if (typeof self !== 'undefined' && typeof self.postMessage === 'function' &&
      typeof window === 'undefined' && typeof module === 'undefined') {
    self.onmessage = function (e) {
      const d = (e && e.data) || {};
      let result = null, error;
      try { result = solveSeepage(d.params || {}); }
      catch (err) { error = String((err && err.stack) || err); }
      const msg = { id: d.id, result };
      if (error) msg.error = error;
      const transfer = result ? [result.h.buffer, result.psi.buffer, result.type.buffer, result.mat.buffer] : [];
      self.postMessage(msg, transfer);
    };
  }
})();
