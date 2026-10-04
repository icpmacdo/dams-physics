// Draws one solver result as a cross-section image (materials, total head or pressure
// head, with the phreatic line, equipotentials, flow lines and seepage face on top).
// The 3D viewer uses the canvas as the texture of the cut face; the lab also shows it flat.

const T_AIR = 0, T_SOIL = 1, T_WATER = 2, T_DRAIN = 3, T_CUTOFF = 4, T_TAIL = 5;
const M_FOUND = 1, M_FILL = 2, M_CORE = 3, M_SHELL = 4;

export const DAM = { crestZ: 24, crestX0: -3, crestX1: 3, upToeX: -51, downToeX: 51 };
export const upFaceX = z => DAM.upToeX + 2 * z;
export const downFaceX = z => DAM.downToeX - 2 * z;

export function cssColor(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).trim() || '#888';
}

function parseColor(c) {
  const ctx = parseColor.ctx || (parseColor.ctx = document.createElement('canvas').getContext('2d'));
  ctx.fillStyle = '#000'; ctx.fillStyle = c;
  const v = ctx.fillStyle;
  if (v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 255];
  const m = v.match(/[\d.]+/g).map(Number);
  return [m[0], m[1], m[2], m.length > 3 ? Math.round(m[3] * 255) : 255];
}
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t), 255];

export function palette() {
  const n = ['--m-alluv', '--m-bedrock', '--m-fill', '--m-clay', '--m-rock', '--m-drain', '--m-conc', '--water-fill',
    '--ramp-lo', '--ramp-hi', '--accent', '--water', '--ink', '--ink-2', '--ink-3', '--bad', '--sheet', '--paper', '--m-tsand'];
  const P = {};
  n.forEach(k => { P[k] = cssColor(k); });
  return P;
}

// cell colour for each display mode
function cellColors(r, mode, P) {
  const N = r.nx * r.nz, out = new Uint8ClampedArray(N * 4);
  const C = {};
  for (const k in P) C[k] = parseColor(P[k]);
  const fdn = r.params.foundation === 'tight' ? C['--m-bedrock'] : C['--m-alluv'];
  const Hw = r.Hw;
  const suctionLo = mix(C['--m-tsand'], C['--sheet'], 0.35);
  for (let c = 0; c < N; c++) {
    const t = r.type[c], m = r.mat[c];
    let col = null;
    if (t === T_AIR) col = null;
    else if (t === T_WATER || t === T_TAIL) col = C['--water-fill'];
    else if (mode === 'materials') {
      if (t === T_DRAIN) col = C['--m-drain'];
      else if (t === T_CUTOFF) col = C['--m-conc'];
      else if (m === M_FOUND) col = fdn;
      else if (m === M_CORE) col = C['--m-clay'];
      else if (m === M_SHELL) col = C['--m-rock'];
      else col = C['--m-fill'];
    } else if (t === T_CUTOFF) {
      col = C['--m-conc'];
    } else if (mode === 'head') {
      const f = Math.min(1, Math.max(0, r.h[c] / Hw));
      col = mix(C['--ramp-lo'], C['--ramp-hi'], f);
    } else { // pressure head
      const psi = r.psi[c];
      col = psi >= 0
        ? mix(C['--ramp-lo'], C['--ramp-hi'], Math.min(1, psi / 30))
        : mix(C['--ramp-lo'], suctionLo, Math.min(1, -psi / 6));
    }
    if (col) { out[c * 4] = col[0]; out[c * 4 + 1] = col[1]; out[c * 4 + 2] = col[2]; out[c * 4 + 3] = 255; }
  }
  // fill air cells that sit inside the true (sloping) outline with a neighbour's colour,
  // so the stair-stepped grid does not leave notches once clipped to the outline
  for (let pass = 0; pass < 2; pass++) {
    const src = out.slice();
    for (let i = 0; i < r.nx; i++) for (let j = 0; j < r.nz; j++) {
      const c = i * r.nz + j;
      if (src[c * 4 + 3]) continue;
      const nb = [c - 1, c - r.nz, c + r.nz, c + 1].filter(k => k >= 0 && k < N && src[k * 4 + 3]);
      if (nb.length) { const k = nb[0]; out.set(src.subarray(k * 4, k * 4 + 4), c * 4); }
    }
  }
  return out;
}

export function drawSection(canvas, r, opts = {}) {
  const mode = opts.mode || 'materials';
  const S = opts.scale || 8;
  const P = opts.palette || palette();
  const W = r.nx * S, H = r.nz * S;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  const z1 = r.z0 + r.nz * r.dx;
  const X = x => (x - r.x0) * S, Z = z => (z1 - z) * S;

  ctx.clearRect(0, 0, W, H);

  // grid image: column i = x, row j = z (flip so z increases upward)
  const small = document.createElement('canvas');
  small.width = r.nx; small.height = r.nz;
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(r.nx, r.nz);
  const cols = cellColors(r, mode, P);
  for (let i = 0; i < r.nx; i++) for (let j = 0; j < r.nz; j++) {
    const c = i * r.nz + j, o = ((r.nz - 1 - j) * r.nx + i) * 4;
    img.data[o] = cols[c * 4]; img.data[o + 1] = cols[c * 4 + 1]; img.data[o + 2] = cols[c * 4 + 2]; img.data[o + 3] = cols[c * 4 + 3];
  }
  sctx.putImageData(img, 0, 0);

  // clip to foundation + dam + reservoir + tailwater outline
  const Hw = r.Hw;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, Z(0), W, Z(r.z0) - Z(0));
  ctx.moveTo(X(DAM.upToeX), Z(0)); ctx.lineTo(X(DAM.crestX0), Z(DAM.crestZ)); ctx.lineTo(X(DAM.crestX1), Z(DAM.crestZ)); ctx.lineTo(X(DAM.downToeX), Z(0)); ctx.closePath();
  ctx.moveTo(X(r.x0), Z(0)); ctx.lineTo(X(r.x0), Z(Hw)); ctx.lineTo(X(upFaceX(Hw)), Z(Hw)); ctx.lineTo(X(DAM.upToeX), Z(0)); ctx.closePath();
  ctx.clip('nonzero');
  ctx.imageSmoothingEnabled = mode !== 'materials';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, W, H);
  ctx.restore();

  // tailwater cells (outside the clip region)
  ctx.fillStyle = P['--water-fill'];
  for (let i = 0; i < r.nx; i++) for (let j = 0; j < r.nz; j++) {
    if (r.type[i * r.nz + j] === T_TAIL) ctx.fillRect(i * S, (r.nz - 1 - j) * S, S, S);
  }

  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const poly = (pts, close) => {
    ctx.beginPath();
    pts.forEach((p, k) => (k ? ctx.lineTo(X(p[0]), Z(p[1])) : ctx.moveTo(X(p[0]), Z(p[1]))));
    if (close) ctx.closePath();
  };

  // outlines
  ctx.strokeStyle = P['--ink']; ctx.lineWidth = Math.max(1, S * 0.18);
  poly([[DAM.upToeX, 0], [DAM.crestX0, DAM.crestZ], [DAM.crestX1, DAM.crestZ], [DAM.downToeX, 0]]); ctx.stroke();
  ctx.globalAlpha = 0.6;
  poly([[r.x0, 0], [DAM.upToeX, 0]]); ctx.stroke();
  poly([[DAM.downToeX, 0], [r.x0 + r.nx, 0]]); ctx.stroke();
  ctx.globalAlpha = 1;

  // equipotentials
  if (opts.equipotentials !== false && mode !== 'materials') {
    ctx.strokeStyle = P['--ink']; ctx.globalAlpha = 0.45; ctx.lineWidth = Math.max(1, S * 0.12);
    ctx.setLineDash([S * 0.6, S * 0.5]);
    for (const e of r.equipotentials) for (const L of e.lines) { poly(L); ctx.stroke(); }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  // flow lines
  if (opts.flowlines !== false) {
    ctx.strokeStyle = P['--accent']; ctx.lineWidth = Math.max(1, S * 0.16); ctx.globalAlpha = 0.85;
    for (const f of r.flowlines) {
      if (f.pts.length < 2) continue;
      poly(f.pts); ctx.stroke();
      const m = Math.floor(f.pts.length * 0.55), a = f.pts[Math.max(0, m - 1)], b = f.pts[Math.min(f.pts.length - 1, m + 1)];
      const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]), px = X(f.pts[m][0]), pz = Z(f.pts[m][1]), s = S * 0.9;
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(ang) * s, pz + Math.sin(ang) * s);
      ctx.lineTo(px + Math.cos(ang + 2.5) * s, pz + Math.sin(ang + 2.5) * s);
      ctx.lineTo(px + Math.cos(ang - 2.5) * s, pz + Math.sin(ang - 2.5) * s);
      ctx.closePath(); ctx.fillStyle = P['--accent']; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // phreatic line
  if (r.phreatic.length > 1) {
    ctx.strokeStyle = P['--sheet']; ctx.lineWidth = S * 0.6; poly(r.phreatic); ctx.stroke();
    ctx.strokeStyle = P['--water']; ctx.lineWidth = S * 0.32; poly(r.phreatic); ctx.stroke();
  }
  // reservoir surface
  ctx.strokeStyle = P['--water']; ctx.lineWidth = S * 0.25;
  poly([[r.x0, Hw], [upFaceX(Hw), Hw]]); ctx.stroke();

  // seepage face
  if (r.seepageFace.present) {
    const a = r.seepageFace.bottomZ, b = r.seepageFace.topZ;
    ctx.strokeStyle = P['--bad']; ctx.lineWidth = S * 0.7;
    poly([[downFaceX(a), a], [downFaceX(b), b]]); ctx.stroke();
  }

  // elevation scale at the downstream end (where there is open air above the ground)
  if (opts.scaleBar) {
    const xs = r.x0 + r.nx - 4;
    ctx.strokeStyle = P['--ink']; ctx.fillStyle = P['--ink']; ctx.globalAlpha = 0.75;
    ctx.lineWidth = Math.max(1, S * 0.16);
    poly([[xs, 0], [xs, 20]]); ctx.stroke();
    ctx.font = `500 ${Math.round(S * 1.7)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let z = 0; z <= 20; z += 5) {
      const len = z % 10 === 0 ? 1.4 : 0.8;
      poly([[xs - len, z], [xs, z]]); ctx.stroke();
      if (z % 10 === 0) ctx.fillText(`${z} m`, X(xs - 1.9), Z(z));
    }
    ctx.globalAlpha = 1;
  }
  return canvas;
}

// small legend description for the current mode
export function legendFor(mode) {
  if (mode === 'head') return { title: 'Total head h', lo: '0', hi: 'reservoir level', ramp: ['--ramp-lo', '--ramp-hi'] };
  if (mode === 'pressure') return { title: 'Pressure head ψ', lo: 'suction', hi: '+30 m', ramp: ['--m-tsand', '--ramp-lo', '--ramp-hi'] };
  return null;
}
