/* ===================== Step 4 sandbox: grains, water and effective stress ===================== */
/* A 2D discrete element model (soft discs, spring-dashpot contacts, Coulomb friction, rolling
 * resistance) coupled to a coarse grid of pore-water pressure. Nothing about the outcome is
 * scripted: pore pressure comes only from the change in pore volume the grains cause, and the
 * effective stress shown is read from the contact forces. tests/test-grains.js runs this same
 * code (it extracts the block between the two sim markers) and checks the physics numerically. */
(function grainsFig() {

/* @grains-sim-begin */
function grainsSim(o) {
  o = o || {};
  const N = o.N || 400;
  let sd = (o.seed || 11) >>> 0;
  const rand = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const W = o.W || Math.round(Math.sqrt(N * 1.16));      // box width (grain diameters)
  const HS = 0.85 * W;                                     // nominal sample height
  const HB = Math.round(HS + 7);                           // drawn box height
  const FW = Math.round((o.bench || 0.55) * W);                          // bench beyond the right wall
  const XEND = W + FW;                                     // far end stop
  const RMIN = 0.35, RMAX = 0.65, RG = 0.4, SG = 0.7;      // grain radii; glued-disc radius, spacing

  const prm = {
    kn: 12000, kt: 6000, zeta: 0.5, zetaT: 0.3, mu: 0.5, muR: 0.12, krF: 0.25, muW: 0.3, muSide: 0,
    g: 1, buoy: 1 / 2.65, cap: 12, capGap: 0.07,
    dragDry: 0.3, dragPour: 0.6, dragPourDense: 0.3, dragPrep: 0.6, gPour: 3, capPour: 15, muPour: 0.9, muRPour: 0.4, dragSat: 0.8, rotDrag: 0.5,
    K: 20000, uCav: 100, h: 3, tauFast: 0.001, tauSlow: 4, tauLeak: 0.001,
    houseB: 6, houseH: 4, houseQ: 8, platenDamp: 6, houseSolid: true, houseDrains: true, houseRotDamp: 2, phiFree: 0.5,
  };
  if (o.prm) Object.assign(prm, o.prm);
  const dt = o.dt || 0.0008;

  /* ---------- particles: free grains, then base, platen and house discs (glued) ---------- */
  const NBASE = Math.ceil((XEND + 12) / SG) + 1;
  const NPLAT = Math.round(W / SG);
  const HBN = Math.ceil(prm.houseB / 0.6) + 1, HSN = Math.ceil(prm.houseH / 0.6);
  const NHOUSE = HBN + 2 * HSN;
  const B0 = N, P0 = N + NBASE, H0 = N + NBASE + NPLAT, PT = H0 + NHOUSE;
  const x = new Float64Array(PT), y = new Float64Array(PT), vx = new Float64Array(PT), vy = new Float64Array(PT);
  const w = new Float64Array(PT), fx = new Float64Array(PT), fy = new Float64Array(PT), tq = new Float64Array(PT);
  const r = new Float64Array(PT), m = new Float64Array(PT), im = new Float64Array(PT), ii = new Float64Array(PT);
  const lx = new Float64Array(PT), ly = new Float64Array(PT);
  const kind = new Uint8Array(PT);      // 0 free, 1 base, 2 platen, 3 house
  const area = new Float64Array(N);
  let solidA = 0;
  for (let i = 0; i < N; i++) {
    r[i] = RMIN + (RMAX - RMIN) * rand();
    m[i] = Math.PI * r[i] * r[i]; im[i] = 1 / m[i]; ii[i] = 2 / (m[i] * r[i] * r[i]);
    area[i] = m[i]; solidA += area[i];
  }
  for (let k = 0; k < NBASE; k++) { const i = B0 + k; kind[i] = 1; r[i] = RG; x[i] = -12 + k * SG; y[i] = 0; }
  for (let k = 0; k < NPLAT; k++) { const i = P0 + k; kind[i] = 2; r[i] = RG; lx[i] = (k + 0.5) * W / NPLAT; ly[i] = 0; }
  {
    const B = prm.houseB, Hh = prm.houseH; let i = H0;
    for (let k = 0; k < HBN; k++, i++) { kind[i] = 3; r[i] = 0.35; lx[i] = -B / 2 + k * B / (HBN - 1); ly[i] = -Hh / 2; }
    for (let k = 1; k <= HSN; k++) for (const sx of [-1, 1]) { kind[i] = 3; r[i] = 0.35; lx[i] = sx * B / 2; ly[i] = -Hh / 2 + k * Hh / HSN; i++; }
  }
  // glued area that pokes into the sample (half discs along base and platen), per unit width
  const GLUE_IN = Math.PI * RG * RG / 2 / SG;

  /* ---------- scene state ---------- */
  const S = {
    t: 0, steps: 0, phase: 'idle', pack: 'dense',
    water: 'dry', drain: 'open', top: 'none', wallR: true,
    load: 40, loadNow: 0,
    gamma: 0, gdot: 0, shear: 'none', shearRate: 0.03, cycAmp: 0.025, cycT: 4.5, cycT0: 0, cycN: 0, gammaStop: 0,
    py: HB, pvy: 0, pmass: 2 * W,                          // platen (y of its line)
    hx: W / 2, hy: HB, hth: 0, hvx: 0, hvy: 0, hw: 0, hmass: prm.houseQ * prm.houseB / prm.g, hI: 0,
    pourSteps: 0,
  };
  S.hI = S.hmass * (prm.houseB * prm.houseB + prm.houseH * prm.houseH) / 12;
  const active = new Uint8Array(PT);

  /* ---------- contact history: per-particle slots for partners with higher index ---------- */
  const CS = 10;
  const sJ = new Int32Array(PT * CS).fill(-1), sStamp = new Int32Array(PT * CS).fill(-9);
  const sXi = new Float64Array(PT * CS), sMr = new Float64Array(PT * CS);
  const wXi = new Float64Array(N * 4); const wStamp = new Int32Array(N * 4).fill(-9);
  // contacts of the latest step, for drawing and stress averaging
  let NC = 0; const cI = new Int32Array(PT * 6), cJ = new Int32Array(PT * 6), cF = new Float32Array(PT * 6), cB = new Uint8Array(PT * 6);

  /* ---------- neighbour grid ---------- */
  const CELL = 2 * RMAX + 0.12;
  const GX0 = -14, GY0 = -2, GNX = Math.ceil((XEND + 16 - GX0) / CELL), GNY = Math.ceil((2.6 * HB - GY0) / CELL);
  const cStart = new Int32Array(GNX * GNY + 1), cList = new Int32Array(PT), pCell = new Int32Array(PT);
  const cCount = new Int32Array(GNX * GNY);

  /* ---------- pore-water grid ---------- */
  const h = prm.h;
  const UX0 = -Math.ceil(0.4 * HB / h) * h, UNX = Math.ceil((W + 0.4 * HB - UX0) / h) + 1, UNY = Math.ceil((HB + 2) / h) + 1;
  const UN = UNX * UNY;
  const uS = new Float64Array(UN), uAd = new Float64Array(UN), uVp = new Float64Array(UN), uVprev = new Float64Array(UN);
  const uC = new Float64Array(UN), u = new Float64Array(UN), uG = new Float64Array(UN), uTmp = new Float64Array(UN), uB = new Float64Array(UN);
  const uSH = new Float64Array(UN), uAct = new Uint8Array(UN), uWas = new Uint8Array(UN), uLeak = new Float64Array(UN), uA = new Float64Array(UN);
  const C_TYP = 0.18 * h * h / prm.K, C_MIN = 0.08 * h * h / prm.K;
  const NSUB = 12;
  // sample points filling the house, for its share of the pore-volume bookkeeping
  const HPS = 0.5, HPNX = Math.round(prm.houseB / HPS), HPNY = Math.round(prm.houseH / HPS), HPN = HPNX * HPNY, HPA = HPS * HPS;
  const hpx = new Float64Array(HPN), hpy = new Float64Array(HPN), hpWX = new Float64Array(HPN), hpWY = new Float64Array(HPN), hU = new Float64Array(3);
  for (let a = 0; a < HPNX; a++) for (let b = 0; b < HPNY; b++) { hpx[a * HPNY + b] = -prm.houseB / 2 + (a + 0.5) * HPS; hpy[a * HPNY + b] = -prm.houseH / 2 + (b + 0.5) * HPS; }
  function Gt(q) { if (q <= -1) return 0; if (q < 0) return 0.5 * (q + 1) * (q + 1); if (q < 1) return 1 - 0.5 * (1 - q) * (1 - q); return 1; }
  const tentInt = (xc, a, b) => (b <= a ? 0 : h * (Gt((b - xc) / h) - Gt((a - xc) / h)));
  const poreOn = () => S.water === 'sat' && S.wallR && S.phase === 'run';

  /* ---------- measurement accumulators ---------- */
  const acc = { n: 0, pfy: 0, pfx: 0, pfu: 0, syy: 0, sxy: 0, sxx: 0 };
  let WIN = { x0: 0.3 * W, x1: 0.7 * W, y0: 0.25 * HS, y1: 0.6 * HS };
  let poreIdle = true;

  /* ===== setup ===== */
  function placeGrains() {
    let xc = 0, yc = 0.75, row = 0, rowStart = 0;
    const rows = [];
    for (let i = 0; i < N; i++) {
      const ri = r[i];
      if (xc + 2 * ri > W - 0.03) { rows.push([rowStart, i]); rowStart = i; xc = 0; yc += 1.38; row++; }
      x[i] = xc + ri + 0.03; xc = x[i] + ri + 0.03 + 0.12 * rand();
      y[i] = yc + 0.65 + (rand() - 0.5) * 0.06;
      vx[i] = (rand() - 0.5) * 0.4; vy[i] = -0.3 * rand(); w[i] = 0;
      active[i] = 1;
    }
    // spread the last, partial row across the box so the poured surface ends up level
    const n = N - rowStart;
    if (n > 0) for (let k = 0; k < n; k++) x[rowStart + k] = (k + 0.5) * W / n;
    // mirror alternate rows so no side of the box is systematically denser
    for (const [a, b] of rows) if (rand() < 0.5) for (let i = a; i < b; i++) x[i] = W - x[i];
  }
  function resetHistory() { sJ.fill(-1); sStamp.fill(-9); wStamp.fill(-9); }
  function pour(pack, top) {
    S.pendingTop = top || 'none';
    S.pack = pack; S.phase = 'pour'; S.pourSteps = 0; S.top = 'none'; S.wallR = true;
    S.gamma = 0; S.gdot = 0; S.shear = 'none';
    resetHistory(); placeGrains();
    for (let i = B0; i < PT; i++) active[i] = kind[i] === 1 ? 1 : 0;
    u.fill(0); uG.fill(0); uWas.fill(0);
  }
  function kinetic() { let s = 0; for (let i = 0; i < N; i++) s += vx[i] * vx[i] + vy[i] * vy[i]; return s / N; }
  function surfaceAt(x0, x1) { let top = 0; for (let i = 0; i < N; i++) if (x[i] > x0 && x[i] < x1 && x[i] < W + 2 && y[i] + r[i] > top) top = y[i] + r[i]; return top; }
  function sampleTop() { return surfaceAt(-1, W + 1); }
  // level of the sand surface: median of the highest grain top in each 2-grain-wide column
  function surfaceLevel() {
    const nb = Math.max(1, Math.floor(W / 2)), tops = new Float64Array(nb);
    for (let i = 0; i < N; i++) {
      if (x[i] < 0 || x[i] >= W) continue;
      const b = Math.min(nb - 1, Math.floor(x[i] / W * nb)), t = y[i] + r[i];
      if (t > tops[b]) tops[b] = t;
    }
    const s = Array.from(tops).sort((a, b) => a - b);
    return s[nb >> 1];
  }
  function setTop(top) {
    S.top = top;
    for (let i = P0; i < PT; i++) active[i] = 0;
    if (top === 'platen') {
      for (let i = P0; i < H0; i++) active[i] = 1;
      S.py = sampleTop() + RG + 0.05; S.pvy = 0; S.loadNow = 0;
    } else if (top === 'house') {
      for (let i = H0; i < PT; i++) active[i] = 1;
      S.hx = W / 2; S.hth = 0; S.hvx = 0; S.hvy = 0; S.hw = 0;
      S.hy = surfaceAt(W / 2 - prm.houseB / 2 - 0.5, W / 2 + prm.houseB / 2 + 0.5) + prm.houseH / 2 + 0.35 + 0.15;
    }
    for (let k = P0 * CS; k < PT * CS; k++) { sJ[k] = -1; sStamp[k] = -9; }
    syncGlued();
  }
  function syncGlued() {
    if (S.top === 'platen') {
      const xo = S.gamma * S.py, vxo = S.gdot * S.py + S.gamma * S.pvy;
      for (let i = P0; i < H0; i++) { x[i] = xo + lx[i]; y[i] = S.py; vx[i] = vxo; vy[i] = S.pvy; w[i] = 0; }
    } else if (S.top === 'house') {
      const c = Math.cos(S.hth), s = Math.sin(S.hth);
      for (let i = H0; i < PT; i++) {
        const ax = c * lx[i] - s * ly[i], ay = s * lx[i] + c * ly[i];
        x[i] = S.hx + ax; y[i] = S.hy + ay; vx[i] = S.hvx - S.hw * ay; vy[i] = S.hvy + S.hw * ax; w[i] = S.hw;
      }
    }
  }

  /* ===== one time step ===== */
  function step() {
    S.t += dt; S.steps++;
    const stamp = S.steps;
    const pouring = S.phase === 'pour';     // deposition settings apply only while grains rain in
    const dense = S.pack === 'dense';
    const mu = pouring ? (dense ? 0 : prm.muPour) : prm.mu;
    const muR = pouring ? (dense ? 0 : prm.muRPour) : prm.muR;
    const muW = pouring ? (dense ? 0 : prm.muW) : prm.muW;
    const muSide = pouring ? (dense ? 0 : prm.muW) : prm.muSide;   // side walls: smooth, like a lubricated membrane
    const capF = pouring ? (dense ? 0 : prm.capPour) : (S.water === 'damp' ? prm.cap : 0);
    const sat = S.water === 'sat' && !pouring;
    const gEff = prm.g * (sat ? 1 - prm.buoy : 1) * (pouring ? prm.gPour : 1);
    const prepping = S.phase === 'cure' || S.phase === 'place';
    const drag = pouring ? (dense ? prm.dragPourDense : prm.dragPour) : prepping ? prm.dragPrep : sat ? prm.dragSat : prm.dragDry;
    const rng = capF > 0 ? prm.capGap : 0;
    const kn = prm.kn, kt = prm.kt;

    // shear kinematics: side walls x = gamma*y (left) and W + gamma*y (right)
    if (S.shear === 'mono') {
      S.gdot = S.shearRate;
      if (S.gamma + S.gdot * dt >= S.gammaStop) { S.gdot = (S.gammaStop - S.gamma) / dt; S.shear = 'none'; }
    } else if (S.shear === 'cyclic') {
      const ph = (S.t - S.cycT0) / S.cycT;
      if (ph >= S.cycN) { S.gdot = (0 - S.gamma) / dt; S.shear = 'none'; }
      else S.gdot = S.cycAmp * 2 * Math.PI / S.cycT * Math.cos(2 * Math.PI * ph);
    } else S.gdot = 0;
    S.gamma += S.gdot * dt;
    const gam = S.gamma, gd = S.gdot, sN = Math.sqrt(1 + gam * gam);
    syncGlued();

    // neighbour grid (counting sort)
    cCount.fill(0);
    for (let i = 0; i < PT; i++) {
      if (!active[i]) { pCell[i] = -1; continue; }
      let cx = Math.floor((x[i] - GX0) / CELL), cy = Math.floor((y[i] - GY0) / CELL);
      cx = cx < 0 ? 0 : cx >= GNX ? GNX - 1 : cx; cy = cy < 0 ? 0 : cy >= GNY ? GNY - 1 : cy;
      const c = cy * GNX + cx; pCell[i] = c; cCount[c]++;
    }
    let sum = 0;
    for (let c = 0; c < GNX * GNY; c++) { cStart[c] = sum; sum += cCount[c]; cCount[c] = cStart[c]; }
    cStart[GNX * GNY] = sum;
    for (let i = 0; i < PT; i++) if (pCell[i] >= 0) cList[cCount[pCell[i]]++] = i;

    // body forces
    for (let i = 0; i < PT; i++) { fx[i] = 0; fy[i] = 0; tq[i] = 0; }
    for (let i = 0; i < N; i++) {
      const inBox = x[i] < W + gam * y[i] + 1;
      const va = S.wallR && inBox ? gd * y[i] : 0;
      fx[i] = -drag * m[i] * (vx[i] - va);
      fy[i] = -m[i] * gEff - drag * m[i] * vy[i];
      tq[i] = -prm.rotDrag * m[i] * r[i] * r[i] * w[i] * 0.5;
    }

    // pair contacts
    NC = 0;
    const wx0 = WIN.x0, wx1 = WIN.x1, wy0 = WIN.y0, wy1 = WIN.y1;
    let syy = 0, sxy = 0, sxx = 0;
    for (let cy = 0; cy < GNY; cy++) for (let cx = 0; cx < GNX; cx++) {
      const c = cy * GNX + cx, a0 = cStart[c], a1 = cStart[c + 1];
      if (a0 === a1) continue;
      for (let nb = 0; nb < 5; nb++) {
        let ox, oy;
        if (nb === 0) { ox = 0; oy = 0; } else if (nb === 1) { ox = 1; oy = 0; } else if (nb === 2) { ox = -1; oy = 1; } else if (nb === 3) { ox = 0; oy = 1; } else { ox = 1; oy = 1; }
        const qx = cx + ox, qy = cy + oy;
        if (qx < 0 || qx >= GNX || qy >= GNY) continue;
        const d = qy * GNX + qx, b0 = cStart[d], b1 = cStart[d + 1];
        for (let p = a0; p < a1; p++) {
          const pi = cList[p];
          for (let q = (nb === 0 ? p + 1 : b0); q < b1; q++) {
            const pj = cList[q];
            if (kind[pi] && kind[pj]) continue;
            let i = pi, j = pj; if (j < i) { i = pj; j = pi; }
            const dx = x[j] - x[i], dy = y[j] - y[i], R = r[i] + r[j];
            const d2 = dx * dx + dy * dy, lim = R + rng;
            if (d2 >= lim * lim) continue;
            const dist = Math.sqrt(d2), nx = dx / dist, ny = dy / dist, gap = dist - R;
            // find this pair's slot
            const base = i * CS; let sl = -1, free = -1;
            for (let k = 0; k < CS; k++) {
              const sk = base + k;
              if (sStamp[sk] >= stamp - 1) { if (sJ[sk] === j) { sl = sk; break; } }
              else if (free < 0) free = sk;
            }
            const Reff = r[i] * r[j] / R;
            if (gap >= 0) {
              // only a liquid bridge (if this pair was touching before)
              if (sl < 0 || capF <= 0) continue;
              sStamp[sl] = stamp; sXi[sl] = 0; sMr[sl] = 0;
              const fc = capF * 2 * Reff * (1 - gap / prm.capGap);
              fx[i] += fc * nx; fy[i] += fc * ny; fx[j] -= fc * nx; fy[j] -= fc * ny;
              if (NC < cI.length) { cI[NC] = i; cJ[NC] = j; cF[NC] = 0; cB[NC] = 1; NC++; }
              continue;
            }
            if (sl < 0) { if (free < 0) continue; sl = free; sJ[sl] = j; sXi[sl] = 0; sMr[sl] = 0; }
            sStamp[sl] = stamp;
            const delta = -gap;
            const meff = 1 / (im[i] + im[j]);
            const rvx = vx[i] - vx[j], rvy = vy[i] - vy[j];
            const vn = rvx * nx + rvy * ny;
            const tx = -ny, ty = nx;
            const vt = rvx * tx + rvy * ty + w[i] * r[i] + w[j] * r[j];
            let fn = kn * delta + 2 * prm.zeta * Math.sqrt(meff * kn) * vn;
            if (fn < 0) fn = 0;
            const fc = capF > 0 ? capF * 2 * Reff : 0;
            const flim = mu * (fn + fc);
            let xi = sXi[sl] + vt * dt;
            let ft = -kt * xi - 2 * prm.zetaT * Math.sqrt(meff * kt) * vt;
            if (ft > flim) { ft = flim; xi = -flim / kt; } else if (ft < -flim) { ft = -flim; xi = flim / kt; }
            sXi[sl] = xi;
            // rolling resistance (elastic-plastic spring on relative rotation)
            let Mr = 0;
            if (muR > 0) {
              const kr = prm.krF * kn * Reff * Reff;
              const Ie = (ii[i] + ii[j]) > 0 ? 1 / (ii[i] + ii[j]) : 0;
              const wr = w[i] - w[j];
              Mr = sMr[sl] - kr * wr * dt;
              const Mlim = muR * Reff * fn;
              if (Mr > Mlim) Mr = Mlim; else if (Mr < -Mlim) Mr = -Mlim;
              sMr[sl] = Mr;
              Mr -= 2 * 0.3 * Math.sqrt(Ie * kr) * wr;
            }
            const fnet = fn - fc;                       // capillary pulls the pair together
            const Fx = -fnet * nx + ft * tx, Fy = -fnet * ny + ft * ty;   // force on i
            fx[i] += Fx; fy[i] += Fy; fx[j] -= Fx; fy[j] -= Fy;
            tq[i] += r[i] * ft + Mr; tq[j] += r[j] * ft - Mr;
            if (NC < cI.length) { cI[NC] = i; cJ[NC] = j; cF[NC] = fn; cB[NC] = fc > 0 ? 1 : 0; NC++; }
            // Love-Weber stress in the measuring window (contact point inside it)
            const px = x[i] + nx * (r[i] - delta / 2), py = y[i] + ny * (r[i] - delta / 2);
            if (px > wx0 && px < wx1 && py > wy0 && py < wy1 && !kind[i] && !kind[j]) {
              // force on j is -F, branch from i to j is (dx,dy); compression positive
              syy += -Fy * dy; sxy += -Fx * dy; sxx += -Fx * dx;
            }
          }
        }
      }
    }

    // walls (free grains only): left, right, floor, far end
    for (let i = 0; i < N; i++) {
      const ri = r[i], xi_ = x[i], yi = y[i];
      if (yi < HB * 2.5) {
        wallC(i, 0, 1 / sN, -gam / sN, (xi_ - gam * yi) / sN, gd * yi, 0, muSide, stamp);
        if (S.wallR) wallC(i, 1, -1 / sN, gam / sN, (W + gam * yi - xi_) / sN, gd * yi, 0, muSide, stamp);
      }
      if (yi < ri) wallC(i, 2, 0, 1, yi, 0, 0, muW, stamp);
      if (XEND - xi_ < ri) wallC(i, 3, -1, 0, XEND - xi_, 0, 0, muW, stamp);
    }

    // pore water
    let pfu = 0;
    if (poreOn()) { poreIdle = false; pfu = poreStep(gam, sN); }
    else if (!poreIdle) { u.fill(0); uG.fill(0); uWas.fill(0); poreIdle = true; }

    // integrate free grains (symplectic Euler / leapfrog)
    for (let i = 0; i < N; i++) {
      vx[i] += fx[i] * im[i] * dt; vy[i] += fy[i] * im[i] * dt; w[i] += tq[i] * ii[i] * dt;
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;
    }

    // platen: vertical dynamics under the applied load, horizontal position follows the shear
    if (S.top === 'platen') {
      let Fy = 0, Fx = 0;
      for (let i = P0; i < H0; i++) { Fy += fy[i]; Fx += fx[i]; }
      S.loadNow += (S.load - S.loadNow) * Math.min(1, dt / 0.4);
      const Fapp = -S.loadNow * W;
      const a = (Fy + pfu + Fapp - prm.platenDamp * S.pmass * S.pvy) / S.pmass;
      S.pvy += a * dt; S.py += S.pvy * dt;
      acc.pfy += Fy; acc.pfx += Fx; acc.pfu += pfu;
    } else if (S.top === 'house') {
      let Fx = 0, Fy = 0, T = 0;
      for (let i = H0; i < PT; i++) { Fx += fx[i]; Fy += fy[i]; T += (x[i] - S.hx) * fy[i] - (y[i] - S.hy) * fx[i] + tq[i]; }
      if (poreOn()) { Fx += hU[0]; Fy += hU[1]; T += hU[2]; }
      Fy -= S.hmass * prm.g;
      const dmp = 0.3;
      S.hvx += (Fx / S.hmass - dmp * S.hvx) * dt; S.hvy += (Fy / S.hmass - dmp * S.hvy) * dt; S.hw += (T / S.hI - prm.houseRotDamp * S.hw) * dt;
      if (S.phase !== 'run') { S.hw = 0; S.hth = 0; S.hvx = 0; }   // set it down level
      S.hx += S.hvx * dt; S.hy += S.hvy * dt; S.hth += S.hw * dt;
    }
    acc.syy += syy; acc.sxy += sxy; acc.sxx += sxx; acc.n++;

    // preparation phases: pour (deposit) -> cure (as-placed, cohesion of the pour released) -> place (top added) -> run
    if (S.phase !== 'run') {
      S.pourSteps++;
      const n = S.pourSteps;
      if (n % 100 === 0) {
        const ke = kinetic(), still = ke < 1e-4;
        if (S.phase === 'pour' && ((n > 2500 && ke < 3e-3) || n > 40000)) {
          S.phase = 'cure'; S.pourSteps = 0; resetHistory();
          for (let i = 0; i < N; i++) { vx[i] = 0; vy[i] = 0; w[i] = 0; }
        } else if (S.phase === 'cure' && ((n > 1500 && still) || n > 30000)) {
          S.phase = 'place'; S.pourSteps = 0;
          if (S.onCured) S.onCured(snapshot());
          setTop(S.pendingTop || 'none');
        } else if (S.phase === 'place' && n > 1200 && still && Math.abs(S.pvy) < 2e-3 && Math.abs(S.hvy) < 2e-3 || S.phase === 'place' && n > 30000) {
          S.phase = 'run'; S.pourSteps = 0;
        }
      }
    }
  }

  function wallC(i, wi, nx, ny, dist, vwx, vwy, muW, stamp) {
    const ri = r[i];
    if (dist >= ri) return;
    const k = i * 4 + wi;
    if (wStamp[k] < stamp - 1) wXi[k] = 0;
    wStamp[k] = stamp;
    const delta = ri - dist, kn = prm.kn, kt = prm.kt;
    const rvx = vx[i] - vwx, rvy = vy[i] - vwy;
    const vn = -(rvx * nx + rvy * ny);
    const tx = -ny, ty = nx;
    const vt = rvx * tx + rvy * ty - w[i] * ri;
    let fn = kn * delta + 2 * prm.zeta * Math.sqrt(m[i] * kn) * vn; if (fn < 0) fn = 0;
    let xi = wXi[k] + vt * dt;
    let ft = -kt * xi - 2 * prm.zetaT * Math.sqrt(m[i] * kt) * vt;
    const flim = muW * fn;
    if (ft > flim) { ft = flim; xi = -flim / kt; } else if (ft < -flim) { ft = -flim; xi = flim / kt; }
    wXi[k] = xi;
    fx[i] += fn * nx + ft * tx; fy[i] += fn * ny + ft * ty; tq[i] += -ri * ft;
  }

  /* ===== pore water: volume change -> pressure, Darcy flow between nodes, drainage ===== */
  function poreStep(gam, sN) {
    const K = prm.K;
    const ytop = S.top === 'platen' ? S.py : HB + 1;
    // solids scattered to nodes (bilinear)
    uS.fill(0);
    const ymax = (UNY - 1) * h, xmax = UX0 + (UNX - 1) * h;
    for (let i = 0; i < N; i++) {
      const X = x[i], Y = y[i];
      if (Y < 0 || Y >= ymax || X < UX0 || X >= xmax) continue;
      const fxg = (X - UX0) / h, fyg = Y / h, ix = fxg | 0, iy = fyg | 0, tx = fxg - ix, ty = fyg - iy;
      const n0 = iy * UNX + ix, A = area[i];
      uS[n0] += A * (1 - tx) * (1 - ty); uS[n0 + 1] += A * tx * (1 - ty);
      uS[n0 + UNX] += A * (1 - tx) * ty; uS[n0 + UNX + 1] += A * tx * ty;
    }
    // the house's volume, from a grid of points that moves and turns with it. It never counts as
    // pore space that drains to the open water above; prm.houseSolid also puts it in the volume balance.
    const house = S.top === 'house';
    uSH.fill(0);
    if (house) {
      const c = Math.cos(S.hth), sn = Math.sin(S.hth), tgt = uSH;
      for (let k = 0; k < HPN; k++) {
        const X = S.hx + c * hpx[k] - sn * hpy[k], Y = S.hy + sn * hpx[k] + c * hpy[k];
        hpWX[k] = X; hpWY[k] = Y;
        if (Y < 0 || Y >= ymax || X < UX0 || X >= xmax) continue;
        const fxg = (X - UX0) / h, fyg = Y / h, ix = fxg | 0, iy = fyg | 0, tx = fxg - ix, ty = fyg - iy;
        const n0 = iy * UNX + ix;
        tgt[n0] += HPA * (1 - tx) * (1 - ty); tgt[n0 + 1] += HPA * tx * (1 - ty);
        tgt[n0 + UNX] += HPA * (1 - tx) * ty; tgt[n0 + UNX + 1] += HPA * tx * ty;
      }
    }
    // domain coverage of each node's tent (parallelogram below the top, minus the house)
    uAd.fill(0); uB.fill(0);
    const dz = 2 * h / NSUB;
    for (let jy = 0; jy < UNY; jy++) {
      const yj = jy * h, row = jy * UNX;
      for (let k = 0; k < NSUB; k++) {
        let a = yj - h + k * dz, b = a + dz;
        if (a < 0) a = 0; if (b > ytop) b = ytop;
        if (b <= a) continue;
        const ym = 0.5 * (a + b), wy = (1 - Math.abs(ym - yj) / h) * (b - a);
        const xl = gam * ym, xr = W + gam * ym;
        const i0 = Math.max(0, Math.floor((xl - h - UX0) / h)), i1 = Math.min(UNX - 1, Math.ceil((xr + h - UX0) / h));
        for (let ix = i0; ix <= i1; ix++) {
          const xc = UX0 + ix * h;
          uAd[row + ix] += wy * tentInt(xc, xl, xr);
        }
      }
      if (S.top === 'platen' && Math.abs(ytop - yj) < h) {
        const wy = 1 - Math.abs(ytop - yj) / h, xl = gam * ytop, xr = W + gam * ytop;
        for (let ix = 0; ix < UNX; ix++) uB[row + ix] = wy * tentInt(UX0 + ix * h, xl, xr);
      }
    }
    // pore volume change -> pressure change (fluid stiffness K)
    const h2 = h * h;
    for (let n = 0; n < UN; n++) {
      const act = uAd[n] > 0.002 * h2;
      uA[n] = Math.min(1, uAd[n] / h2);
      const vp = uAd[n] - uS[n] - (prm.houseSolid ? uSH[n] : 0);
      uC[n] = Math.max(vp, C_MIN * K) / K;
      if (!act) { uAct[n] = 0; u[n] = 0; uWas[n] = 0; continue; }
      uAct[n] = 1;
      if (!uWas[n]) { uVprev[n] = vp; uWas[n] = 1; }
      u[n] -= (vp - uVprev[n]) / uC[n];
      uVprev[n] = vp;
    }
    // Darcy flow between neighbouring nodes (explicit, sub-cycled for stability)
    const sealed = S.drain === 'shut';
    const tau = S.top !== 'platen' && sealed ? prm.tauSlow : prm.tauFast;
    const kp = C_TYP / tau;
    let worst = 0;
    for (let n = 0; n < UN; n++) if (uAct[n]) { const v = 4 * kp / uC[n]; if (v > worst) worst = v; }
    const nsub = Math.max(1, Math.ceil(worst * dt / 0.4)), ds = dt / nsub;
    for (let s = 0; s < nsub; s++) {
      for (let jy = 0; jy < UNY; jy++) for (let ix = 0; ix < UNX; ix++) {
        const n = jy * UNX + ix;
        if (!uAct[n]) { uTmp[n] = 0; continue; }
        let q = 0;
        if (ix > 0 && uAct[n - 1]) q += kp * Math.max(uA[n], uA[n - 1]) * (u[n - 1] - u[n]);
        if (ix < UNX - 1 && uAct[n + 1]) q += kp * Math.max(uA[n], uA[n + 1]) * (u[n + 1] - u[n]);
        if (jy > 0 && uAct[n - UNX]) q += kp * Math.max(uA[n], uA[n - UNX]) * (u[n - UNX] - u[n]);
        if (jy < UNY - 1 && uAct[n + UNX]) q += kp * Math.max(uA[n], uA[n + UNX]) * (u[n + UNX] - u[n]);
        uTmp[n] = u[n] + ds * q / uC[n];
      }
      for (let n = 0; n < UN; n++) u[n] = uTmp[n];
    }
    // drainage: through a porous platen when the valve is open, or into free water above the sand
    for (let n = 0; n < UN; n++) {
      if (!uAct[n]) continue;
      let rate = 0;
      if (S.top === 'platen') { if (!sealed) rate = uB[n] / h / prm.tauLeak; }
      else {
        const phi = (uS[n] + (prm.houseDrains ? 0 : uSH[n])) / Math.max(uAd[n], 1e-9);
        rate = Math.max(0, Math.min(1, 1 - phi / prm.phiFree)) / prm.tauLeak;
      }
      if (rate > 0) u[n] /= 1 + dt * rate;
      if (u[n] < -prm.uCav) u[n] = -prm.uCav;     // water can't be pulled harder than this: it cavitates
    }
    // ghost values just outside the wetted region (zero-gradient), so the walls, platen and house
    // don't create a false pressure drop at the boundary
    for (let n = 0; n < UN; n++) {
      if (uAct[n]) { uG[n] = u[n]; continue; }
      const ix = n % UNX, jy = (n - ix) / UNX; let s2 = 0, c2 = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const qx = ix + ox, qy = jy + oy;
        if (qx < 0 || qy < 0 || qx >= UNX || qy >= UNY) continue;
        const q = qy * UNX + qx; if (uAct[q]) { s2 += u[q]; c2++; }
      }
      uG[n] = c2 ? s2 / c2 : 0;
    }
    // forces on grains: -A grad(u), consistent with the bilinear scatter above
    for (let i = 0; i < N; i++) {
      const X = x[i], Y = y[i];
      if (Y < 0 || Y >= ymax || X < UX0 || X >= xmax) continue;
      const fxg = (X - UX0) / h, fyg = Y / h, ix = fxg | 0, iy = fyg | 0, tx = fxg - ix, ty = fyg - iy;
      const n0 = iy * UNX + ix;
      const u00 = uG[n0], u10 = uG[n0 + 1], u01 = uG[n0 + UNX], u11 = uG[n0 + UNX + 1];
      const gxu = ((u10 - u00) * (1 - ty) + (u11 - u01) * ty) / h;
      const gyu = ((u01 - u00) * (1 - tx) + (u11 - u10) * tx) / h;
      fx[i] -= area[i] * gxu; fy[i] -= area[i] * gyu;
    }
    // the same pressure-gradient force on the house's volume
    hU[0] = 0; hU[1] = 0; hU[2] = 0;
    if (house && prm.houseSolid) for (let k = 0; k < HPN; k++) {
      const X = hpWX[k], Y = hpWY[k];
      if (Y < 0 || Y >= ymax || X < UX0 || X >= xmax) continue;
      const fxg = (X - UX0) / h, fyg = Y / h, ix = fxg | 0, iy = fyg | 0, tx = fxg - ix, ty = fyg - iy;
      const n0 = iy * UNX + ix;
      const u00 = uG[n0], u10 = uG[n0 + 1], u01 = uG[n0 + UNX], u11 = uG[n0 + UNX + 1];
      const Fx = -HPA * ((u10 - u00) * (1 - ty) + (u11 - u01) * ty) / h;
      const Fy = -HPA * ((u01 - u00) * (1 - tx) + (u11 - u10) * tx) / h;
      hU[0] += Fx; hU[1] += Fy; hU[2] += (X - S.hx) * Fy - (Y - S.hy) * Fx;
    }
    // pressure on the platen
    let F = 0;
    if (S.top === 'platen') for (let n = 0; n < UN; n++) F += u[n] * uB[n];
    return F;
  }
  function uAt(X, Y) {
    const fxg = (X - UX0) / h, fyg = Y / h;
    if (fyg < 0 || fxg < 0 || fyg >= UNY - 1 || fxg >= UNX - 1) return 0;
    const ix = fxg | 0, iy = fyg | 0, tx = fxg - ix, ty = fyg - iy, n0 = iy * UNX + ix;
    return uG[n0] * (1 - tx) * (1 - ty) + uG[n0 + 1] * tx * (1 - ty) + uG[n0 + UNX] * (1 - tx) * ty + uG[n0 + UNX + 1] * tx * ty;
  }
  /* ===== measurements ===== */
  function measure() {
    const n = Math.max(1, acc.n);
    const out = { t: S.t, phase: S.phase, top: S.top, ke: kinetic(), gamma: S.gamma };
    if (S.top === 'platen') {
      out.sigma = S.loadNow;
      out.sigEff = acc.pfy / n / W;
      out.u = acc.pfu / n / W;
      out.tau = -acc.pfx / n / W;
      out.height = S.py;
      out.e = (W * (S.py - 2 * GLUE_IN) - solidA) / solidA;
      const Aw = (WIN.x1 - WIN.x0) * (WIN.y1 - WIN.y0);
      out.lwYY = acc.syy / n / Aw; out.lwXY = acc.sxy / n / Aw; out.lwXX = acc.sxx / n / Aw;
      out.tauCore = Math.abs(out.lwXY); out.mob = out.lwYY > 0.05 ? out.tauCore / out.lwYY : 0;
    } else {
      const Aw = (WIN.x1 - WIN.x0) * (WIN.y1 - WIN.y0);
      out.sigEff = acc.syy / n / Aw;
      out.tau = acc.sxy / n / Aw;
      out.tauCore = Math.abs(out.tau); out.mob = out.sigEff > 0.05 ? out.tauCore / out.sigEff : 0;
      out.u = poreOn() ? uAt((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2) : 0;
      out.sigma = out.sigEff + out.u;
      // void ratio in the window, with a smooth weight so grains crossing its edge don't make it jump
      let sw = 0, sa = 0;
      const cx = (WIN.x0 + WIN.x1) / 2, cy = (WIN.y0 + WIN.y1) / 2, hx = (WIN.x1 - WIN.x0) / 2 + 1, hy = (WIN.y1 - WIN.y0) / 2 + 1;
      for (let i = 0; i < N; i++) {
        const ax = Math.abs(x[i] - cx) / hx, ay = Math.abs(y[i] - cy) / hy;
        if (ax < 1 && ay < 1) sa += area[i] * (1 - ax) * (1 - ay);
      }
      sw = hx * hy;   // integral of the tent weight over its support
      out.e = sa > 0 ? (sw - sa) / sa : NaN;
      out.height = sampleTop();
      if (S.top === 'house') { out.houseY = S.hy; out.houseTilt = S.hth * 180 / Math.PI; }
    }
    acc.n = 0; acc.pfy = 0; acc.pfx = 0; acc.pfu = 0; acc.syy = 0; acc.sxy = 0; acc.sxx = 0;
    return out;
  }

  /* ===== cache a settled packing so presets can restart instantly ===== */
  function snapshot() {
    return { x: x.slice(0, N), y: y.slice(0, N), w: w.slice(0, N), pack: S.pack, damp: S.water === 'damp' };
  }
  function restore(sn, top) {
    S.pendingTop = top || 'none';
    x.set(sn.x); y.set(sn.y); w.set(sn.w);
    for (let i = 0; i < N; i++) { vx[i] = 0; vy[i] = 0; active[i] = 1; }
    resetHistory(); S.pack = sn.pack; S.top = 'none'; S.wallR = true;
    S.gamma = 0; S.gdot = 0; S.shear = 'none';
    for (let i = P0; i < PT; i++) active[i] = 0;
    u.fill(0); uG.fill(0); uWas.fill(0);
    S.phase = 'place'; S.pourSteps = 0; setTop(S.pendingTop);
  }

  return {
    N, PT, W, HS, HB, FW, XEND, RG, B0, P0, H0, prm, S, dt,
    x, y, r, w, kind, active, u: uG, uAct, UX0, UNX, UNY, h,
    get NC() { return NC; }, cI, cJ, cF, cB,
    pour, step, measure, setTop, snapshot, restore, sampleTop, surfaceLevel, uAt, kinetic,
    setWindow(o2) { WIN = o2; }, get win() { return WIN; },
    shear(mode, a, b) {
      if (mode === 'mono') { S.shear = 'mono'; S.shearRate = a || 0.03; S.gammaStop = S.gamma + (b || 0.3); }
      else if (mode === 'cyclic') { S.shear = 'cyclic'; S.cycAmp = a || 0.025; S.cycN = b || 8; S.cycT0 = S.t; S.gamma = 0; }
      else { S.shear = 'none'; }
    },
    removeWall() { S.wallR = false; S.gamma = 0; S.shear = 'none'; },
    place(top) { S.phase = 'place'; S.pourSteps = 0; S.pendingTop = top; S.gamma = 0; S.shear = 'none'; setTop(top); },
    spilled() { let c = 0; for (let i = 0; i < N; i++) if (x[i] > W + 0.6) c++; return c; },
    runout() { let mx = W; for (let i = 0; i < N; i++) if (x[i] + r[i] > mx) mx = x[i] + r[i]; return mx - W; },
  };
}
/* @grains-sim-end */

if (typeof document === 'undefined' || !document.getElementById('fig-grains')) return;

/* ===================== the figure ===================== */
const root = $('#fig-grains');
const F = fig(root);
const cv = $('#cv-grains'), ctx = cv.getContext('2d');
const ccv = $('#cv-grains-chart'), cctx = ccv.getContext('2d');
const small = Math.min(window.innerWidth || 1200, screen.width || 1200) < 640;
const sim = grainsSim({ N: small ? 250 : 420, seed: 11, bench: small ? 0.35 : 0.55 });
const S = sim.S, W = sim.W, HB = sim.HB;
const STRESS = 'kPa*';
const VX0 = -2.4, VX1 = sim.XEND + 0.9, VY0 = -1.6, VY1 = HB + 2.6;
const cache = {};                     // settled packings, so experiments restart instantly
S.onCured = sn => { cache[sn.pack + (sn.damp ? '-damp' : '')] = sn; };

/* ---------- colours (re-read on theme change) ---------- */
let C = {};
function colors() {
  const g = n => cssVar(n);
  C = { sheet: g('--sheet'), paper: g('--paper'), ink: g('--ink'), ink2: g('--ink-2'), ink3: g('--ink-3'), rule: g('--rule'),
    water: g('--water'), tint: g('--water-tint'), wfill: g('--water-fill'), accent: g('--accent'), bad: g('--bad'),
    s1: g('--m-tsand'), s2: g('--m-filter'), s3: g('--m-trans'), rock: g('--m-rock'), conc: g('--m-conc'), roof: g('--m-clay'),
    mono: g('--f-mono') || 'monospace' };
  C.wRGB = rgba(C.water); C.aRGB = rgba(C.accent);
}
colors();
onTheme(() => { colors(); draw(); drawChart(); });

/* ---------- canvas sizing ---------- */
let SC = 10, CW = 600, CH = 400, DPR = 1;
function resize() {
  const wrap = cv.parentElement;
  CW = Math.max(280, wrap.clientWidth);
  SC = CW / (VX1 - VX0); CH = Math.round((VY1 - VY0) * SC);
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
  cv.style.height = CH + 'px';
  const cw = ccv.parentElement.clientWidth;
  ccv.width = Math.round(cw * DPR); ccv.height = Math.round(120 * DPR); ccv.style.height = '120px';
  draw(); drawChart();
}
const X = v => (v - VX0) * SC, Y = v => (VY1 - v) * SC;
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(cv.parentElement);
else window.addEventListener('resize', resize);

/* ---------- u field as a small image, scaled up smoothly ---------- */
const ucv = document.createElement('canvas'); ucv.width = sim.UNX; ucv.height = sim.UNY;
const uctx = ucv.getContext('2d'); const uimg = uctx.createImageData(sim.UNX, sim.UNY);

/* ---------- drawing ---------- */
function boxPath(top) { // parallelogram interior of the box up to height `top`
  const g = S.gamma;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(S.wallR ? W : sim.XEND), Y(0));
  if (S.wallR) ctx.lineTo(X(W + g * top), Y(top)); else ctx.lineTo(X(sim.XEND), Y(top));
  ctx.lineTo(X(g * top), Y(top)); ctx.closePath();
}
function draw() {
  if (!CW) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = C.sheet; ctx.fillRect(0, 0, CW, CH);
  const g = S.gamma, sat = S.water === 'sat';
  const sandTop = sim.surfaceLevel();
  // water: standing water fills the box; excess pore pressure tints it darker (suction in orange)
  if (sat) {
    const wl = S.top === 'platen' ? S.py : Math.min(HB - 0.3, sandTop + 0.9);
    ctx.save(); boxPath(wl); ctx.fillStyle = C.tint; ctx.fill();
    ctx.clip();
    const ref = Math.max(8, S.top === 'platen' ? S.load : 12);
    const d = uimg.data;
    for (let n = 0; n < sim.UNX * sim.UNY; n++) {
      const ix = n % sim.UNX, jy = (n - ix) / sim.UNX, p = ((sim.UNY - 1 - jy) * sim.UNX + ix) * 4;
      const v = sim.u[n] / ref, a = Math.min(1, Math.abs(v)) * (v >= 0 ? 0.7 : 0.45);
      const c = v >= 0 ? C.wRGB : C.aRGB;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = Math.round(a * 255);
    }
    uctx.putImageData(uimg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const h = sim.h;
    ctx.drawImage(ucv, X(sim.UX0 - h / 2), Y((sim.UNY - 1) * h + h / 2), sim.UNX * h * SC, sim.UNY * h * SC);
    ctx.restore();
    // water surface mark
    if (S.top !== 'platen') {
      ctx.strokeStyle = C.water; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X(g * wl) + 2, Y(wl)); ctx.lineTo(X((S.wallR ? W : sim.XEND) + g * wl) - 2, Y(wl)); ctx.stroke();
      const sx = X(W * 0.12 + g * wl), sy = Y(wl);
      ctx.beginPath(); ctx.moveTo(sx - 5, sy - 9); ctx.lineTo(sx + 5, sy - 9); ctx.lineTo(sx, sy - 2); ctx.closePath(); ctx.stroke();
    }
  }
  // grains, three sand tones
  const N = sim.N, x = sim.x, y = sim.y, r = sim.r;
  const tones = [C.s1, C.s2, C.s3];
  for (let t = 0; t < 3; t++) {
    ctx.beginPath();
    for (let i = t; i < N; i += 3) { const px = X(x[i]), py = Y(y[i]); ctx.moveTo(px + r[i] * SC, py); ctx.arc(px, py, r[i] * SC, 0, 6.2832); }
    ctx.fillStyle = tones[t]; ctx.fill();
    ctx.lineWidth = Math.max(0.5, SC * 0.035); ctx.strokeStyle = C.ink3; ctx.stroke();
  }
  // base, platen and house discs
  ctx.beginPath();
  for (let i = sim.B0; i < sim.PT; i++) {
    if (!sim.active[i] || sim.kind[i] === 3) continue;
    const px = X(x[i]), py = Y(y[i]); if (px < -20 || px > CW + 20) continue;
    ctx.moveTo(px + r[i] * SC, py); ctx.arc(px, py, r[i] * SC, 0, 6.2832);
  }
  ctx.fillStyle = C.rock; ctx.fill(); ctx.lineWidth = Math.max(0.5, SC * 0.04); ctx.strokeStyle = C.ink2; ctx.stroke();
  // liquid bridges (damp)
  const NC = sim.NC, cI = sim.cI, cJ = sim.cJ, cF = sim.cF, cB = sim.cB;
  if (S.water === 'damp') {
    ctx.beginPath();
    for (let k = 0; k < NC; k++) {
      if (!cB[k]) continue;
      const i = cI[k], j = cJ[k];
      const dx = x[j] - x[i], dy = y[j] - y[i], d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
      const cx = x[i] + nx * r[i], cy = y[i] + ny * r[i];
      const tx = -ny * 0.16, ty = nx * 0.16;
      ctx.moveTo(X(cx - tx), Y(cy - ty)); ctx.lineTo(X(cx + tx), Y(cy + ty));
    }
    ctx.strokeStyle = C.water; ctx.lineWidth = Math.max(1.5, SC * 0.16); ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
  }
  // force chains: line width and darkness grow with the contact's normal force (fixed scale, so fading shows)
  const FREF = 90, WMAX = Math.max(2.2, SC * 0.36);
  const BK = 7, paths = [];
  for (let b = 0; b < BK; b++) paths.push([]);
  for (let k = 0; k < NC; k++) {
    const f = cF[k]; if (f <= 0.6) continue;
    const q = Math.min(1, f / FREF);
    paths[Math.min(BK - 1, Math.floor(Math.sqrt(q) * BK))].push(k);
  }
  ctx.strokeStyle = C.ink; ctx.lineCap = 'round';
  for (let b = 0; b < BK; b++) {
    if (!paths[b].length) continue;
    ctx.beginPath();
    for (const k of paths[b]) {
      const i = cI[k], j = cJ[k];
      let x1 = x[i], y1 = y[i], x2 = x[j], y2 = y[j];
      if (sim.kind[i]) { const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1; x1 = x2 - dx / d * r[j] * 1.5; y1 = y2 - dy / d * r[j] * 1.5; }
      ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2));
    }
    const q = (b + 1) / BK;
    ctx.lineWidth = Math.max(0.7, WMAX * q * q); ctx.globalAlpha = 0.35 + 0.6 * q; ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  // box: floor, walls
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(-2), Y(-0.42)); ctx.lineTo(X(sim.XEND + 0.4), Y(-0.42)); ctx.stroke();
  ctx.lineWidth = 0.8; ctx.strokeStyle = C.ink3; ctx.beginPath();
  for (let xx = -2; xx < sim.XEND + 0.4; xx += 1.2) { ctx.moveTo(X(xx), Y(-0.42)); ctx.lineTo(X(xx - 0.9), Y(-1.3)); }
  ctx.stroke();
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, SC * 0.22); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X(-0.12), Y(-0.4)); ctx.lineTo(X(g * HB - 0.12), Y(HB)); ctx.stroke();
  if (S.wallR) { ctx.beginPath(); ctx.moveTo(X(W + 0.12), Y(-0.4)); ctx.lineTo(X(W + g * HB + 0.12), Y(HB)); ctx.stroke(); }
  else { ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.strokeStyle = C.ink3; ctx.beginPath(); ctx.moveTo(X(W + 0.12), Y(0)); ctx.lineTo(X(W + 0.12), Y(HB)); ctx.stroke(); ctx.setLineDash([]); }
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, SC * 0.22);
  ctx.beginPath(); ctx.moveTo(X(sim.XEND + 0.12), Y(-0.4)); ctx.lineTo(X(sim.XEND + 0.12), Y(3)); ctx.stroke();
  ctx.lineCap = 'butt';
  // platen and its load
  ctx.font = `500 ${Math.max(10, Math.min(13, SC * 0.5))}px ${C.mono}`;
  if (S.top === 'platen') {
    const py = S.py, x0 = g * py;
    ctx.fillStyle = C.rock; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
    ctx.fillRect(X(x0), Y(py + 1.1), W * SC, 1.1 * SC); ctx.strokeRect(X(x0), Y(py + 1.1), W * SC, 1.1 * SC);
    const narr = Math.max(3, Math.round(W / 4)), aw = sat ? W - 2.6 : W;
    ctx.beginPath();
    for (let k = 0; k < narr; k++) {
      const ax = X(x0 + (k + 0.5) * aw / narr), ay0 = Y(py + 3.2), ay1 = Y(py + 1.25);
      ctx.moveTo(ax, ay0); ctx.lineTo(ax, ay1); ctx.moveTo(ax - 4, ay1 - 6); ctx.lineTo(ax, ay1); ctx.lineTo(ax + 4, ay1 - 6);
    }
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = C.accent; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`Load ${Math.round(S.load)} ${STRESS}`, X(x0), Y(py + 3.4));
    // drainage valve on the platen
    if (sat) {
      const vx_ = X(x0 + W - 1.0), vy0 = Y(py + 1.1), vy1 = Y(py + 3.0);
      ctx.strokeStyle = C.water; ctx.lineWidth = Math.max(2, SC * 0.18);
      ctx.beginPath(); ctx.moveTo(vx_, vy0); ctx.lineTo(vx_, vy1); ctx.stroke();
      const vy = (vy0 + vy1) / 2, vs = Math.max(4, SC * 0.35);
      ctx.beginPath(); ctx.moveTo(vx_ - vs, vy - vs); ctx.lineTo(vx_ + vs, vy + vs); ctx.lineTo(vx_ + vs, vy - vs); ctx.lineTo(vx_ - vs, vy + vs); ctx.closePath();
      ctx.fillStyle = S.drain === 'shut' ? C.ink : C.sheet; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = C.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(S.drain === 'shut' ? 'drain shut' : 'drain open', vx_ - vs - 4, vy);
    }
  }
  // house
  if (S.top === 'house') {
    const B = sim.prm.houseB, Hh = sim.prm.houseH;
    ctx.save(); ctx.translate(X(S.hx), Y(S.hy)); ctx.rotate(-S.hth);
    ctx.fillStyle = C.conc; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.3;
    ctx.fillRect(-B / 2 * SC, -Hh / 2 * SC, B * SC, Hh * SC); ctx.strokeRect(-B / 2 * SC, -Hh / 2 * SC, B * SC, Hh * SC);
    ctx.beginPath(); ctx.moveTo(-B / 2 * SC - 0.4 * SC, -Hh / 2 * SC); ctx.lineTo(0, -Hh / 2 * SC - 2.2 * SC); ctx.lineTo(B / 2 * SC + 0.4 * SC, -Hh / 2 * SC); ctx.closePath();
    ctx.fillStyle = C.roof; ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.sheet; ctx.lineWidth = 1;
    for (const wx of [-0.3, 0.12]) { ctx.fillRect(wx * B * SC, -0.15 * Hh * SC, 0.18 * B * SC, 0.25 * Hh * SC); ctx.strokeRect(wx * B * SC, -0.15 * Hh * SC, 0.18 * B * SC, 0.25 * Hh * SC); }
    ctx.fillStyle = C.ink2; ctx.fillRect(-0.06 * B * SC, 0.15 * Hh * SC, 0.12 * B * SC, 0.35 * Hh * SC);
    ctx.restore();
    // where it started
    if (S.houseY0 != null) {
      const yb = S.houseY0 - Hh / 2;
      ctx.setLineDash([3, 3]); ctx.strokeStyle = C.accent; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(S.hx - B / 2 - 1.5), Y(yb)); ctx.lineTo(X(S.hx + B / 2 + 1.5), Y(yb)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.accent; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('start', X(S.hx + B / 2 + 1.6), Y(yb) + 5);
    }
  }
  // measuring window (open top only)
  if (S.top !== 'platen' && S.wallR) {
    const wn = sim.win;
    ctx.setLineDash([4, 3]); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1;
    ctx.strokeRect(X(wn.x0 + g * (wn.y0 + wn.y1) / 2), Y(wn.y1), (wn.x1 - wn.x0) * SC, (wn.y1 - wn.y0) * SC); ctx.setLineDash([]);
  }
  // shaking / shearing marks
  if (S.shear !== 'none') {
    const yA = HB + 0.9, xm = g * HB + W / 2;
    ctx.strokeStyle = C.accent; ctx.fillStyle = C.accent; ctx.lineWidth = 1.6;
    const L = 2.2, dir = S.shear === 'cyclic' ? Math.sign(S.gdot || 1) : 1;
    ctx.beginPath(); ctx.moveTo(X(xm - L), Y(yA)); ctx.lineTo(X(xm + L), Y(yA)); ctx.stroke();
    const tipx = X(xm + dir * L), tipy = Y(yA);
    ctx.beginPath(); ctx.moveTo(tipx, tipy); ctx.lineTo(tipx - dir * 7, tipy - 4); ctx.lineTo(tipx - dir * 7, tipy + 4); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(S.shear === 'cyclic' ? 'shaking' : `shear ${Math.round(g * 100)}%`, X(xm + L) + 8, Y(yA));
  }
  // status
  const st = statusText();
  if (st) {
    ctx.fillStyle = C.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(st, X(VX1) - 6, 6);
  }
}
function statusText() {
  if (S.phase === 'pour') return 'Pouring sand…';
  if (S.phase === 'cure') return 'Settling…';
  if (S.phase === 'place') return S.top === 'platen' ? 'Applying the load…' : S.top === 'house' ? 'House settling…' : 'Settling…';
  if (paused) return RM ? 'Paused (reduced motion): press Run or Step' : 'Paused';
  return '';
}

/* ---------- chart: sigma' and u over time ---------- */
const hist = []; const HMAX = 400; let histT = 0;
function pushHist(m) {
  hist.push({ t: S.t, s: m.sigEff, u: m.u, tot: m.sigma });
  if (hist.length > HMAX) hist.shift();
}
function drawChart() {
  const w = ccv.width / DPR, h = ccv.height / DPR;
  if (!w) return;
  cctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cctx.fillStyle = C.sheet; cctx.fillRect(0, 0, w, h);
  const L = 44, R = 10, T = 14, Bm = 20;
  let ymax = 10, ymin = 0;
  for (const p of hist) { ymax = Math.max(ymax, p.s, p.u, p.tot); ymin = Math.min(ymin, p.u); }
  ymax = Math.ceil(ymax / 10) * 10; ymin = Math.floor(ymin / 10) * 10;
  const t1 = hist.length ? hist[hist.length - 1].t : 1, t0 = Math.max(0, t1 - 60);
  const px = t => L + (t - t0) / Math.max(1e-6, t1 - t0 || 60) * (w - L - R);
  const py = v => T + (ymax - v) / (ymax - ymin) * (h - T - Bm);
  cctx.font = `10px ${C.mono}`; cctx.fillStyle = C.ink3; cctx.strokeStyle = C.rule; cctx.lineWidth = 1;
  cctx.textAlign = 'right'; cctx.textBaseline = 'middle';
  const stepV = (ymax - ymin) > 100 ? 50 : (ymax - ymin) > 40 ? 20 : 10;
  for (let v = ymin; v <= ymax + 1e-6; v += stepV) { cctx.beginPath(); cctx.moveTo(L, py(v)); cctx.lineTo(w - R, py(v)); cctx.stroke(); cctx.fillText(String(v), L - 6, py(v)); }
  cctx.textAlign = 'left'; cctx.textBaseline = 'top'; cctx.fillText(STRESS, 2, 0);
  cctx.textBaseline = 'bottom'; cctx.fillText('time →', L, h);
  const line = (key, col, wd, dash) => {
    cctx.beginPath(); let first = true;
    for (const p of hist) { if (p.t < t0) continue; const X_ = px(p.t), Y_ = py(p[key]); if (first) { cctx.moveTo(X_, Y_); first = false; } else cctx.lineTo(X_, Y_); }
    cctx.strokeStyle = col; cctx.lineWidth = wd; cctx.setLineDash(dash || []); cctx.stroke(); cctx.setLineDash([]);
  };
  line('tot', C.ink3, 1.2, [4, 3]); line('u', C.water, 2); line('s', C.ink, 2);
  // legend
  cctx.textBaseline = 'top'; cctx.textAlign = 'right';
  const lg = [['σ′ grains', C.ink], ['u water', C.water], ['σ total', C.ink3]];
  let lx = w - R;
  for (const [t, c] of lg) { const tw = cctx.measureText(t).width; cctx.fillStyle = c; cctx.fillText(t, lx, 0); cctx.fillRect(lx - tw - 14, 6, 10, 2); lx -= tw + 26; }
}

/* ---------- readouts ---------- */
const ro = { s: $('#gr-sig'), u: $('#gr-u'), se: $('#gr-se'), e: $('#gr-e'), tau: $('#gr-tau'), tau2: $('#gr-tau2'), sub: $('#gr-se2'), eLab: $('#gr-e2') };
let disp = null;
function updateReadouts(m) {
  const k = disp ? 0.25 : 1;
  if (!disp) disp = Object.assign({}, m);
  for (const key of ['sigma', 'u', 'sigEff', 'e', 'tauCore', 'mob']) if (isFinite(m[key])) disp[key] += (m[key] - disp[key]) * k;
  const f0 = v => (isFinite(v) ? (Math.abs(v) < 0.5 ? '0' : Math.round(v).toString()) : '–');
  ro.s.textContent = f0(disp.sigma) + ' ' + STRESS;
  ro.u.textContent = f0(disp.u) + ' ' + STRESS;
  ro.se.textContent = f0(disp.sigEff) + ' ' + STRESS;
  ro.e.textContent = isFinite(disp.e) ? disp.e.toFixed(2) : '–';
  ro.tau.textContent = f0(disp.tauCore) + ' ' + STRESS;
  ro.tau2.textContent = 'τ/σ′ = ' + (disp.mob ? disp.mob.toFixed(2) : '–') + (peakMob ? ' · peak ' + peakMob.toFixed(2) : '');
  ro.sub.textContent = S.top === 'platen' ? 'platen force from grain contacts' : 'grain contacts in the dashed box';
  ro.eLab.textContent = S.top === 'house' && S.houseY0 != null ? `house sank ${Math.max(0, S.houseY0 - S.hy).toFixed(1)} grain widths` : (S.pack === 'dense' ? 'packed dense' : 'packed loose') + ' · 2D discs';
}

/* ---------- controls ---------- */
const segs = {};
function setSeg(id, v) { $$('#' + id + ' button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v ? 'true' : 'false')); }
const btnShear = $('#gr-shear'), btnShake = $('#gr-shake'), btnWall = $('#gr-wall'), btnRun = $('#gr-run'), btnStep = $('#gr-step');
const load = $('#gr-load'), loadO = $('#gr-load-o'), hint = $('#gr-hint'), result = $('#gr-result');
let paused = RM, exp = null, last = null, peakMob = 0, act = null;

function syncUI() {
  setSeg('gr-pack', S.pack); setSeg('gr-water', S.water); setSeg('gr-drain', S.drain);
  setSeg('gr-top', S.top === 'none' ? 'none' : S.top);
  $$('#gr-drain button').forEach(b => { b.disabled = S.water !== 'sat'; });
  const busy = S.phase !== 'run';
  btnShear.disabled = busy || S.top !== 'platen' || !S.wallR || S.shear === 'cyclic';
  btnShear.title = S.top !== 'platen' ? 'Shearing needs the platen on top' : '';
  btnWall.title = S.wallR && S.top !== 'none' ? 'Take the platen or house off first' : '';
  btnShake.disabled = busy || !S.wallR || S.shear === 'mono';
  btnWall.disabled = busy || (S.wallR && S.top !== 'none');
  btnShear.querySelector('span').textContent = S.shear === 'mono' ? 'Stop shearing' : 'Shear';
  btnShake.querySelector('span').textContent = S.shear === 'cyclic' ? 'Stop shaking' : 'Shake';
  btnWall.querySelector('span').textContent = S.wallR ? 'Remove side wall' : 'Refill the box';
  btnRun.querySelector('span').textContent = paused ? 'Run' : 'Pause';
  btnRun.querySelector('path').setAttribute('d', paused ? ICON_PLAY : ICON_PAUSE);
  load.disabled = S.top !== 'platen';
  loadO.textContent = Math.round(S.load) + ' ' + STRESS;
}

function setWindow() {
  const B = sim.prm.houseB;
  if (S.top === 'platen') { const H = S.py; sim.setWindow({ x0: 0.18 * W, x1: 0.82 * W, y0: 0.22 * H, y1: 0.72 * H }); }
  else if (S.top === 'house') sim.setWindow({ x0: W / 2 - B / 2, x1: W / 2 + B / 2, y0: 0.3 * sim.HS, y1: 0.62 * sim.HS });
  else sim.setWindow({ x0: 0.25 * W, x1: 0.75 * W, y0: 0.3 * sim.HS, y1: 0.62 * sim.HS });
}
// prepare a fresh sample: from the cache when we have this packing, otherwise pour it
function prepare(pack, top) {
  const key = pack + (S.water === 'damp' ? '-damp' : '');
  S.houseY0 = null; peakMob = 0; act = null; hist.length = 0; disp = null;
  if (cache[key]) sim.restore(cache[key], top); else sim.pour(pack, top);
  S.pack = pack;
  setWindow(); syncUI();
}
segGroup($('#gr-pack'), v => { exp = null; prepare(v, S.phase === 'run' ? S.top : (S.pendingTop || S.top)); say(''); });
segGroup($('#gr-water'), v => { S.water = v; syncUI(); });   // bridges form or dry out in place
segGroup($('#gr-drain'), v => { S.drain = v; syncUI(); });
segGroup($('#gr-top'), v => {
  if (S.phase !== 'run') { syncUI(); return; }
  if (!S.wallR) { prepare(S.pack, v); return; }
  S.houseY0 = null; sim.place(v); setWindow(); syncUI();
});
load.addEventListener('input', () => { S.load = +load.value; syncUI(); });
btnShear.addEventListener('click', () => {
  if (S.shear === 'mono') { sim.shear('none'); finishAct(); }
  else startAct('shear');
  syncUI();
});
btnShake.addEventListener('click', () => {
  if (S.shear === 'cyclic') { sim.shear('none'); finishAct(); }
  else startAct('shake');
  syncUI();
});
btnWall.addEventListener('click', () => {
  if (S.wallR) startAct('wall'); else { prepare(S.pack, 'none'); }
  syncUI();
});
btnRun.addEventListener('click', () => { paused = !paused; syncUI(); draw(); });
btnStep.addEventListener('click', () => { paused = true; advance(1.0, 1e9); frameUpdate(); syncUI(); });

/* ---------- actions and their measured outcome ---------- */
function snapM() { const m = sim.measure(); return m; }
function startAct(kind) {
  const m0 = disp || lastM || snapM();
  act = { kind, t0: S.t, m0: Object.assign({}, m0), h0: kind === 'wall' ? 0 : (S.top === 'platen' ? S.py : sim.sampleTop()), uMax: m0.u, uMin: m0.u, sMin: m0.sigEff, sMax: m0.sigEff, mobPeak: 0, tail: 0, exp: exp && exp.id };
  peakMob = 0;
  if (S.top === 'house') S.houseY0 = S.hy;
  if (kind === 'shear') sim.shear('mono', 0.025, 0.3);
  else if (kind === 'shake') sim.shear('cyclic', 0.02, 8);
  else if (kind === 'wall') sim.removeWall();
}
function trackAct(m) {
  if (!act) return;
  act.uMax = Math.max(act.uMax, m.u); act.uMin = Math.min(act.uMin, m.u);
  act.sMin = Math.min(act.sMin, m.sigEff); act.sMax = Math.max(act.sMax, m.sigEff);
  if (act.kind === 'shear' && S.t - act.t0 > 0.4) { act.mobPeak = Math.max(act.mobPeak, m.mob); peakMob = act.mobPeak; }
  const done = act.kind === 'wall' ? S.t - act.t0 > 14 : S.shear === 'none';
  if (done) { act.tail += 1; if (act.tail > (act.kind === 'shake' ? 40 : 2)) finishAct(); }
}
function buildOutcome(a, m) {
  const out = { kind: a.kind, exp: a.exp, pack: S.pack, water: S.water, drain: S.drain, top: S.top, load: S.load };
  out.s0 = a.m0.sigEff; out.s1 = m.sigEff; out.sMin = a.sMin; out.sMax = a.sMax; out.u0 = a.m0.u; out.u1 = m.u; out.uMax = a.uMax; out.uMin = a.uMin;
  out.e0 = a.m0.e; out.e1 = m.e;
  if (a.kind === 'shear') {
    out.dV = (S.py - a.h0) / a.h0 * 100; out.mobPeak = a.mobPeak; out.mobEnd = m.mob; out.tauEnd = m.tauCore;
  } else if (a.kind === 'shake') {
    out.dV = S.top === 'platen' ? (S.py - a.h0) / a.h0 * 100 : NaN;
    if (S.top === 'house' && S.houseY0 != null) { out.sink = S.houseY0 - S.hy; out.tilt = S.hth * 180 / Math.PI; }
  } else if (a.kind === 'wall') { out.spilled = sim.spilled(); out.runout = sim.runout(); }
  return out;
}
function finishAct() {
  if (!act) return;
  const a = act; act = null;
  last = buildOutcome(a, disp || lastM);
  showResult(last);
  syncUI();
}
const p1 = v => (v > 0 ? '+' : '') + v.toFixed(1);
function outcomeText(o) {
  if (!o) return '';
  const st = `${o.pack} sand, ${o.water === 'sat' ? 'saturated, drain ' + o.drain : o.water}`;
  if (o.kind === 'wall') return o.spilled < 4 ? `Side wall removed (${st}): the cut face stood. ${o.spilled} grains fell.` : `Side wall removed (${st}): the face collapsed. ${o.spilled} grains ran out, up to ${o.runout.toFixed(0)} grain widths from the box.`;
  if (o.kind === 'shear') return `Sheared ${st} under ${Math.round(o.load)} ${STRESS}: volume ${p1(o.dV)}% (${o.dV > 0.3 ? 'it dilated' : o.dV < -0.3 ? 'it compacted' : 'almost no change'}); peak τ/σ′ ${o.mobPeak.toFixed(2)}, at the end ${o.mobEnd.toFixed(2)}; shear stress at the end ${Math.round(o.tauEnd)} ${STRESS}; water pressure ${Math.round(o.u0)} → ${Math.round(o.u1)} ${STRESS}${o.uMin < -3 ? ' (suction)' : ''}${o.uMin <= 2 - sim.prm.uCav ? ', down to the limit where water cavitates, after which a little swelling got through' : ''}; σ′ ${Math.round(o.s0)} → ${Math.round(o.s1)} ${STRESS}.`;
  if (o.kind === 'shake') {
    let t = `Shaken, ${st}: grain stress σ′ ${Math.round(o.s0)} → ${Math.round(o.s1)} ${STRESS}; water pressure ${Math.round(o.u0)} → ${Math.round(o.u1)} ${STRESS}`;
    if (o.u1 > 0.5) t += ` (the grain stress before shaking was ${Math.round(o.s0)})`;
    if (isFinite(o.dV)) t += `; volume ${p1(o.dV)}%`;
    if (o.sink != null) t += `; house sank ${o.sink.toFixed(1)} grain widths and tilted ${Math.abs(o.tilt).toFixed(0)}°`;
    return t + '.';
  }
  return '';
}
function showResult(o) { result.textContent = o ? 'Measured: ' + outcomeText(o) : ''; result.hidden = !o; }

/* ---------- experiments ---------- */
const EXPS = {
  castle: { pack: 'dense', water: 'damp', top: 'none', go: 'wall', hint: 'Damp sand. Tiny bridges of water between grains pull them together. Watch the cut face when the wall comes away.', next: ['Now try it dry', 'castle-dry'] },
  'castle-dry': { pack: 'dense', water: 'dry', top: 'none', go: 'wall', hint: 'The same sand, dry. Nothing holds the grains together except friction.', next: ['Damp again', 'castle'] },
  shear: { pack: 'dense', water: 'dry', top: 'platen', load: 40, go: 'shear', hint: 'Dense sand under a fixed load, sheared sideways. Watch the platen: the grains have to climb over each other to move.', next: ['Now loose sand', 'shear-loose'] },
  'shear-loose': { pack: 'loose', water: 'dry', top: 'platen', load: 40, go: 'shear', hint: 'Loose sand, same load, same shear. The grains fall into the gaps as they move.', next: ['Dense again', 'shear'] },
  liq: { pack: 'loose', water: 'sat', drain: 'shut', top: 'house', go: 'shake', hint: 'Loose sand full of water, a house on top, and the water can’t get out in time. Watch the water pressure (blue) and the force chains under the house.', next: ['Same, dense sand', 'liq-dense'] },
  'liq-dense': { pack: 'dense', water: 'sat', drain: 'shut', top: 'house', go: 'shake', hint: 'Dense sand, same water, same shaking.', next: ['Loose again', 'liq'] },
  suction: { pack: 'dense', water: 'sat', drain: 'shut', top: 'platen', load: 40, go: 'shear', hint: 'Dense sand full of water, drain shut, sheared. Dense sand wants to swell, but the water can’t get in. Watch u go below zero.', next: ['Same with the drain open', 'suction-open'] },
  'suction-open': { pack: 'dense', water: 'sat', drain: 'open', top: 'platen', load: 40, go: 'shear', hint: 'The same dense sand with the drain open. Water flows in as it swells, so there is no suction.', next: ['Drain shut again', 'suction'] },
};
function runExp(id) {
  const e = EXPS[id]; if (!e) return;
  exp = { id, e, started: false }; last = null;
  sim.shear('none');
  S.water = e.water; if (e.drain) S.drain = e.drain; if (e.load) { S.load = e.load; load.value = e.load; }
  prepare(e.pack, e.top);
  say(e.hint, e.next);
  showResult(null);
  if (RM && paused) { /* reduced motion: set up, then wait for Run or Step */ }
  syncUI();
}
function say(text, next) {
  hint.textContent = (text || '') + (text && RM && paused ? ' Press Run or Step to start.' : '');
  if (next) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn gr-next'; b.textContent = next[0];
    b.addEventListener('click', () => runExp(next[1])); hint.appendChild(document.createTextNode(' ')); hint.appendChild(b);
  }
}
$$('#fig-grains [data-exp]').forEach(b => b.addEventListener('click', () => runExp(b.dataset.exp)));
function expTick() {
  if (!exp || exp.started || S.phase !== 'run') return;
  if (exp.wait == null) exp.wait = S.t + 0.6;
  if (S.t < exp.wait) return;
  exp.started = true; startAct(exp.e.go); syncUI();
}

/* ---------- stepping: as many sim steps as fit in a frame budget ---------- */
let perStep = 0.08, lastM = null;
const BUDGET = small ? 6 : 8;
function advance(simTime, budgetMs) {
  const n = Math.max(1, Math.round(simTime / sim.dt));
  const t0 = performance.now();
  let k = 0;
  for (; k < n; k++) {
    sim.step();
    if ((k & 15) === 15) { if (performance.now() - t0 > budgetMs) { k++; break; } }
  }
  const el = performance.now() - t0;
  perStep = perStep * 0.8 + 0.2 * el / Math.max(1, k);
  return k;
}
let chartTick = 0, wasPhase = '';
function frameUpdate() {
  const m = sim.measure(); lastM = m;
  updateReadouts(m); trackAct(disp); expTick();
  if (S.phase === 'run' && S.t - histT > 0.15) { histT = S.t; pushHist(disp); }
  if (S.phase !== wasPhase) { wasPhase = S.phase; if (S.phase === 'run') setWindow(); syncUI(); }
  draw();
  if (++chartTick % 3 === 0) drawChart();
}
F.ticks.push((t, dt) => {
  if (!paused) {
    // about 100 steps (0.08 model time units) a frame while experiments run; faster while preparing
    const steps = Math.max(8, Math.min(S.phase === 'run' ? 100 : 240, Math.floor(BUDGET / Math.max(0.01, perStep))));
    advance(steps * sim.dt, BUDGET * 1.5);
    frameUpdate();
  } else if (S.phase !== 'run') {
    // reduced motion: still finish preparing the sample, without animating it
    advance(400 * sim.dt, BUDGET * 2);
    if (S.phase === 'run') frameUpdate(); else if (++chartTick % 10 === 0) { draw(); }
  }
});
F.onFirst = () => { resize(); };
// settle the opening sample in idle moments before the reader scrolls here, so the first frame they see is a loaded box
function idlePrep() {
  if (F.visible || S.phase === 'run') { if (S.phase === 'run') frameUpdate(); return; }
  advance(300 * sim.dt, 6);
  setTimeout(idlePrep, 40);
}
setTimeout(idlePrep, 800);

/* ---------- start: dense sand under the platen, force chains showing ---------- */
S.water = 'dry'; S.load = 40;
prepare('dense', 'platen');
resize(); syncUI();
say('Pick an experiment above, or set things up yourself below.');

/* ---------- test hook (only with ?grains-debug in the URL) ---------- */
if (/grains-debug/.test(location.search)) window.grainsDebug = {
  sim, runExp, startAct,
  ff(simTime) { // fast-forward, measuring as the live page would
    const n = Math.round(simTime / sim.dt);
    for (let k = 0; k < n; k += 100) { advance(100 * sim.dt, 1e9); frameUpdate(); }
  },
};

/* ---------- tutor ---------- */
const tutorSpec = {
  title: 'Grain-scale sandbox (effective stress)',
  describe: () => {
    const m = disp || lastM || {};
    const top = S.top === 'platen' ? `a platen pressing down with ${Math.round(S.load)} ${STRESS}` : S.top === 'house' ? 'a heavy model house on the surface' : 'nothing on top';
    const water = S.water === 'sat' ? `saturated, drain ${S.drain}` : S.water;
    const lines = [
      `2D discrete-element model, ${sim.N} sand discs in a box with ${top}${S.wallR ? '' : ' (right wall removed)'}. Packing: ${S.pack}. Water: ${water}. Stresses are in scaled model units (${STRESS}).`,
      `Phase: ${S.phase}${S.shear !== 'none' ? ', currently ' + (S.shear === 'cyclic' ? 'shaking' : 'shearing at ' + Math.round(S.gamma * 100) + '% strain') : ''}.`,
      `Now: total stress ${n1(m.sigma || 0)}, water pressure u ${n1(m.u || 0)}, grain (effective) stress σ′ ${n1(m.sigEff || 0)} (measured from contact forces), void ratio ${isFinite(m.e) ? m.e.toFixed(3) : '–'}, shear stress ratio τ/σ′ ${m.mob ? m.mob.toFixed(2) : '–'}.`,
    ];
    if (exp) lines.push(`Last experiment chosen: "${exp.id}". ${exp.e.hint}`);
    if (act) lines.push(`In progress (${(S.t - act.t0).toFixed(1)} model time units so far): ` + outcomeText(buildOutcome(act, m)));
    else if (last) lines.push('Last measured outcome: ' + outcomeText(last));
    return lines.join('\n');
  }
};
if (typeof tutorRegister === 'function') tutorRegister('fig-grains', tutorSpec);
if (window.grainsDebug) window.grainsDebug.describe = tutorSpec.describe;
})();

