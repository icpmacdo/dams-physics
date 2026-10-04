// The 3D model: an embankment dam across a valley, drawn as a block diagram cut open at
// Z = cut. The cut face carries the 2D seepage solution; the phreatic surface and the flow
// particles are carried along the valley floor (the plane-flow assumption the solver makes:
// flow per metre of dam, valid away from the abutments).
//
// Axes: three.js X = solver x (upstream -> downstream), Y = elevation, Z = along the dam axis.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { drawSection, palette, DAM, upFaceX, downFaceX } from './section-canvas.js';

const X0 = -80, X1 = 90, ZB = -15;      // block extent across the valley (x) and its base
const HALF = 62;                          // block extends +-HALF along the dam axis
const FLOOR_HALF = 34;                    // flat valley floor +-FLOOR_HALF; abutments rise beyond
const GROUND_MAX = 34;                    // abutments top out 10 m above the crest
const NPH = 120;                          // phreatic surface: samples along the line
const NZROW = 124;                        // ... and rows along the axis (1 m apart)

// ground elevation across the valley (z = position along the dam axis)
export function groundAt(z) {
  const a = Math.abs(z) - FLOOR_HALF;
  if (a <= 0) return 0;
  return Math.min(GROUND_MAX, 0.9 * a + 0.012 * a * a);
}
// |z| at which the abutment reaches elevation e
function zForGround(e) { return FLOOR_HALF + (-0.9 + Math.sqrt(0.81 + 0.048 * e)) / 0.024; }

const VIEWS = {
  iso: [[124, 68, 200], [16, 1, -12]],
  section: [[6, 8, 214], [6, 3, 0]],
  aerial: [[160, 200, 135], [2, -2, -14]]
};
const LEGACY = { upstream: 'aerial', downstream: 'iso', plan: 'aerial' };

const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function resample(L, n) {
  const cum = [0];
  for (let i = 1; i < L.length; i++) cum.push(cum[i - 1] + Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]));
  const tot = cum[cum.length - 1] || 1, out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const s = (k / (n - 1)) * tot;
    while (j < L.length - 1 && cum[j] < s) j++;
    const a = L[j - 1], b = L[j], f = Math.min(1, Math.max(0, (s - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1)));
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

export class DamViewer {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = opts;
    this.showcase = !!opts.showcase;
    this.mode = opts.mode || 'materials';
    this.cut = 0;
    this.inset = 0;
    this.layers = { phreatic: true, particles: true, labels: true };
    this.result = null;
    this.particles = [];
    this.listeners = {};
    this.interacted = false;
    this.anims = [];
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const canvas = document.createElement('canvas');
    canvas.className = 'viewer-canvas';
    host.appendChild(canvas);
    this.canvas = canvas;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
      host.classList.add('no-webgl');
      this.failed = true;
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.localClippingEnabled = true;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 1, 3000);
    const controls = new OrbitControls(this.camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 40;
    controls.maxDistance = 520;
    controls.target.set(0, 4, 0);
    controls.addEventListener('start', () => {
      this.tween = null;
      if (!this.interacted) { this.interacted = true; this.emit('interact'); }
    });
    if (this.showcase) { controls.enabled = false; canvas.style.pointerEvents = 'none'; }
    this.controls = controls;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(-70, 130, 110);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdfe9f2, 0.45);
    fill.position.set(120, 40, -60);
    this.scene.add(fill);

    // everything is cut at Z = cut (the block diagram is open toward the viewer)
    this.clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

    this.buildStatic();

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'viewer-labels';
    host.appendChild(this.labelLayer);
    this.labels = [];

    this.resize = this.resize.bind(this);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(host);
    this.resize();
    this.setView(opts.view || 'iso', true);

    this.themeObs = new MutationObserver(() => this.applyTheme());
    this.themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.mq = window.matchMedia('(prefers-color-scheme: dark)');
    this.mqFn = () => this.applyTheme();
    this.mq.addEventListener('change', this.mqFn);

    this.clock = new THREE.Clock();
    this.time = 0;
    this.running = true;
    const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }

  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); return () => { this.listeners[ev] = this.listeners[ev].filter(f => f !== fn); }; }
  emit(ev, data) { (this.listeners[ev] || []).forEach(fn => fn(data)); }

  mat(color, extra = {}) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.94, metalness: 0, clippingPlanes: [this.clip], side: THREE.DoubleSide }, extra));
  }
  line(color, opacity) {
    return new THREE.LineBasicMaterial({ color, transparent: true, opacity, clippingPlanes: [this.clip] });
  }

  // simple tween registry: fn(t in 0..1) called every frame for `ms`
  animate(key, ms, fn, done) {
    this.anims = this.anims.filter(a => a.key !== key);
    if (this.reduceMotion || ms <= 0) { fn(1); if (done) done(); return; }
    this.anims.push({ key, t: 0, ms, fn, done });
  }

  buildStatic() {
    const P = palette();
    this.P = P;
    const g = new THREE.Group();
    this.scene.add(g);

    // terrain heightfield over the block (height depends on z only)
    const tGeo = new THREE.PlaneGeometry(X1 - X0, 2 * HALF, 1, 180);
    tGeo.rotateX(-Math.PI / 2);
    tGeo.translate((X0 + X1) / 2, 0, 0);
    const pos = tGeo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setY(k, groundAt(pos.getZ(k)));
    tGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.count * 3), 3));
    tGeo.computeVertexNormals();
    this.terrainMat = this.mat(0xffffff, { vertexColors: true });
    this.terrain = new THREE.Mesh(tGeo, this.terrainMat);
    g.add(this.terrain);

    // block sides: x = X0 and x = X1 walls (top follows the ground), back wall, base
    const wall = x => {
      const n = 120, verts = [], idx = [];
      for (let k = 0; k <= n; k++) {
        const z = -HALF + (2 * HALF * k) / n;
        verts.push(x, ZB, z, x, groundAt(z), z);
      }
      for (let k = 0; k < n; k++) { const o = 2 * k; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    };
    this.wallMat = this.mat(P['--m-bedrock']);
    g.add(new THREE.Mesh(wall(X0), this.wallMat), new THREE.Mesh(wall(X1), this.wallMat));
    const back = new THREE.PlaneGeometry(X1 - X0, GROUND_MAX - ZB);
    back.translate((X0 + X1) / 2, (GROUND_MAX + ZB) / 2, -HALF);
    g.add(new THREE.Mesh(back, this.wallMat));
    const base = new THREE.PlaneGeometry(X1 - X0, 2 * HALF);
    base.rotateX(Math.PI / 2);
    base.translate((X0 + X1) / 2, ZB, 0);
    g.add(new THREE.Mesh(base, this.wallMat));

    // dam body: the trapezoid section extruded along the axis (buried in the abutments)
    const shape = new THREE.Shape();
    shape.moveTo(DAM.upToeX, -0.02);
    shape.lineTo(DAM.crestX0, DAM.crestZ);
    shape.lineTo(DAM.crestX1, DAM.crestZ);
    shape.lineTo(DAM.downToeX, -0.02);
    shape.closePath();
    // (stops 1 m short of the block ends so its end caps never coincide with the back wall)
    const damGeo = new THREE.ExtrudeGeometry(shape, { depth: 2 * HALF - 2, bevelEnabled: false, steps: 1 });
    damGeo.translate(0, 0, -HALF + 1);
    // transparent so it can turn to x-ray when the phreatic surface inside is shown
    this.damMat = this.mat(P['--m-fill'], { transparent: true, opacity: 1, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    this.dam = new THREE.Mesh(damGeo, this.damMat);
    this.dam.renderOrder = 3;
    g.add(this.dam);

    // crest road
    const roadGeo = new THREE.BoxGeometry(5.4, 0.35, 2 * HALF - 2);
    roadGeo.translate(0, DAM.crestZ + 0.18, 0);
    this.roadMat = this.mat(0x5d6669);
    g.add(new THREE.Mesh(roadGeo, this.roadMat));

    // drafting lines: dam edges, block outline, abutment contours
    this.edgeMat = this.line(P['--ink'], 0.55);
    const damEdges = [
      [DAM.upToeX, 0], [DAM.crestX0, DAM.crestZ], [DAM.crestX1, DAM.crestZ], [DAM.downToeX, 0]
    ];
    const edgeVerts = [];
    for (const [x, y] of damEdges) {
      // run each edge along the axis, but only where it is above the ground
      const zEnd = y <= 0.01 ? FLOOR_HALF : zForGround(y);
      edgeVerts.push(x, y + 0.03, -zEnd, x, y + 0.03, zEnd);
    }
    const outline = [];
    const n = 120;
    for (const x of [X0, X1]) {
      for (let k = 0; k < n; k++) {
        const z0 = -HALF + (2 * HALF * k) / n, z1 = -HALF + (2 * HALF * (k + 1)) / n;
        outline.push(x, groundAt(z0), z0, x, groundAt(z1), z1);
      }
      outline.push(x, ZB, -HALF, x, ZB, HALF, x, ZB, -HALF, x, GROUND_MAX, -HALF);
    }
    outline.push(X0, ZB, -HALF, X1, ZB, -HALF, X0, GROUND_MAX, -HALF, X1, GROUND_MAX, -HALF);
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts.concat(outline), 3));
    g.add(new THREE.LineSegments(eGeo, this.edgeMat));

    this.contourMat = this.line(P['--ink-2'], 0.42);
    const cVerts = [];
    for (let e = 5; e < GROUND_MAX; e += 5) {
      const zc = zForGround(e);
      for (const s of [-1, 1]) cVerts.push(X0, e + 0.06, s * zc, X1, e + 0.06, s * zc);
    }
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.Float32BufferAttribute(cVerts, 3));
    g.add(new THREE.LineSegments(cGeo, this.contourMat));

    // reservoir slab (rebuilt when the level changes)
    this.waterMat = new THREE.MeshStandardMaterial({ color: P['--water'], transparent: true, opacity: 0.5, roughness: 0.2, metalness: 0.05, clippingPlanes: [this.clip], side: THREE.DoubleSide, depthWrite: false });
    this.water = new THREE.Mesh(new THREE.BufferGeometry(), this.waterMat);
    this.water.renderOrder = 4;
    g.add(this.water);

    // cut face: current section and the previous one (fades out on change)
    this.secCanvas = [document.createElement('canvas'), document.createElement('canvas')];
    this.secTex = this.secCanvas.map(c => {
      c.width = 170 * 8; c.height = 39 * 8;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    });
    const secGeo = new THREE.PlaneGeometry(X1 - X0, 24 - ZB);
    secGeo.translate((X0 + X1) / 2, (24 + ZB) / 2, 0);
    this.secMat = this.secTex.map((t, i) => new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, alphaTest: 0.02, depthWrite: i === 0, opacity: 1 }));
    this.section = new THREE.Mesh(secGeo, this.secMat[0]);
    this.sectionPrev = new THREE.Mesh(secGeo, this.secMat[1]);
    this.section.renderOrder = 1;
    this.sectionPrev.renderOrder = 1.5;
    this.sectionPrev.visible = false;
    g.add(this.section, this.sectionPrev);

    // phreatic surface: fixed topology, positions updated in place (so it can morph)
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NPH * (NZROW + 1) * 3), 3));
    const pIdx = [];
    for (let k = 0; k < NZROW; k++) for (let i = 0; i < NPH - 1; i++) {
      const a = k * NPH + i, b = a + 1, c = a + NPH, d = c + 1;
      pIdx.push(a, b, c, b, d, c);
    }
    pGeo.setIndex(pIdx);
    this.phreaticMat = new THREE.MeshStandardMaterial({ color: P['--water'], transparent: true, opacity: 0.55, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: [this.clip] });
    this.phreatic = new THREE.Mesh(pGeo, this.phreaticMat);
    this.phreatic.renderOrder = 2;
    this.phreatic.visible = false;
    g.add(this.phreatic);
    this.phreaticEdgeMat = new THREE.LineBasicMaterial({ color: P['--water'], transparent: true, opacity: 0.9, clippingPlanes: [this.clip] });
    const peGeo = new THREE.BufferGeometry();
    peGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NPH * 3), 3));
    this.phreaticEdge = new THREE.Line(peGeo, this.phreaticEdgeMat);
    this.phreaticEdge.renderOrder = 2;
    this.phreaticEdge.visible = false;
    g.add(this.phreaticEdge);

    // seepage-face strip on the downstream slope
    this.sfMat = new THREE.MeshBasicMaterial({ color: P['--bad'], transparent: true, opacity: 0.38, side: THREE.DoubleSide, clippingPlanes: [this.clip], depthWrite: false });
    this.sf = new THREE.Mesh(new THREE.BufferGeometry(), this.sfMat);
    this.sf.renderOrder = 5;
    g.add(this.sf);

    // flow particles (round sprites)
    const dot = document.createElement('canvas');
    dot.width = dot.height = 32;
    const dc = dot.getContext('2d');
    const grd = dc.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    dc.fillStyle = grd; dc.fillRect(0, 0, 32, 32);
    this.dotTex = new THREE.CanvasTexture(dot);
    this.ptGeo = new THREE.BufferGeometry();
    this.ptMat = new THREE.PointsMaterial({ color: P['--accent'], size: 1.7, map: this.dotTex, sizeAttenuation: true, transparent: true, opacity: 0.95, depthTest: false, alphaTest: 0.05 });
    this.points = new THREE.Points(this.ptGeo, this.ptMat);
    this.points.renderOrder = 6;
    g.add(this.points);

    this.colorTerrain();
    this.updateCut();
  }

  colorTerrain() {
    const geo = this.terrain.geometry, pos = geo.attributes.position, col = geo.attributes.color;
    const floor = new THREE.Color(this.P['--m-alluv']), rock = new THREE.Color(this.P['--m-bedrock']), c = new THREE.Color();
    const high = rock.clone().lerp(new THREE.Color(this.P['--sheet']), 0.28);
    for (let k = 0; k < pos.count; k++) {
      const e = pos.getY(k);
      c.copy(floor).lerp(rock, Math.min(1, e / 5));
      if (e > 5) c.lerp(high, Math.min(1, (e - 5) / (GROUND_MAX - 5)));
      col.setXYZ(k, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  applyTheme() {
    if (this.failed) return;
    const P = palette();
    this.P = P;
    this.colorTerrain();
    this.wallMat.color.set(P['--m-bedrock']);
    this.damMat.color.set(this.result && this.result.params.damType === 'cored' ? P['--m-rock'] : P['--m-fill']);
    this.waterMat.color.set(P['--water']);
    this.phreaticMat.color.set(P['--water']);
    this.phreaticEdgeMat.color.set(P['--water']);
    this.sfMat.color.set(P['--bad']);
    this.ptMat.color.set(P['--accent']);
    this.edgeMat.color.set(P['--ink']);
    this.contourMat.color.set(P['--ink-2']);
    if (this.result) this.redrawSection(false);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.result) this.redrawSection(true);
  }

  redrawSection(fade) {
    if (this.failed || !this.result) return;
    const [cur, prev] = this.secCanvas;
    if (fade && !this.reduceMotion) {
      const pc = prev.getContext('2d');
      pc.clearRect(0, 0, prev.width, prev.height);
      pc.drawImage(cur, 0, 0);
      this.secTex[1].needsUpdate = true;
      this.sectionPrev.visible = true;
      this.secMat[1].opacity = 1;
      this.animate('section', 450, t => { this.secMat[1].opacity = 1 - ease(t); }, () => { this.sectionPrev.visible = false; });
    }
    drawSection(cur, this.result, { mode: this.mode, scale: 8, palette: this.P, scaleBar: true });
    this.secTex[0].needsUpdate = true;
  }

  setResult(r) {
    const prev = this.result;
    this.result = r;
    if (this.failed) return;
    this.damMat.color.set(r.params.damType === 'cored' ? this.P['--m-rock'] : this.P['--m-fill']);
    this.redrawSection(!!prev);
    this.buildWater(r, prev);
    this.buildPhreatic(r, !!prev);
    this.buildSeepageFace(r);
    this.buildParticles(r);
    this.updateCut();
  }

  // reservoir slab from the upstream end of the block to the dam face; level tweens
  buildWater(r, prev) {
    const to = r.Hw, from = prev ? prev.Hw : to;
    const make = Hw => {
      const shape = new THREE.Shape();
      shape.moveTo(X0 + 0.05, 0.02);
      shape.lineTo(DAM.upToeX, 0.02);
      shape.lineTo(upFaceX(Hw), Hw);
      shape.lineTo(X0 + 0.05, Hw);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 2 * HALF - 0.1, bevelEnabled: false });
      geo.translate(0, 0, -HALF + 0.05);
      this.water.geometry.dispose();
      this.water.geometry = geo;
    };
    if (Math.abs(to - from) < 0.01) { make(to); return; }
    this.animate('water', 500, t => make(from + (to - from) * ease(t)));
  }

  buildPhreatic(r, morph) {
    const L = r.phreatic;
    if (!L || L.length < 2) {
      this.phreaticPts = null;
      this.phreatic.visible = this.phreaticEdge.visible = false;
      return;
    }
    const target = resample(L, NPH);
    const from = this.phreaticPts;
    this.phreaticPts = target;
    this.phreatic.visible = this.phreaticEdge.visible = this.layers.phreatic;
    if (!morph || !from) { this.writePhreatic(target); return; }
    const tmp = target.map(p => p.slice());
    this.animate('phreatic', 550, t => {
      const e = ease(t);
      for (let i = 0; i < NPH; i++) { tmp[i][0] = from[i][0] + (target[i][0] - from[i][0]) * e; tmp[i][1] = from[i][1] + (target[i][1] - from[i][1]) * e; }
      this.writePhreatic(tmp);
    });
  }

  writePhreatic(pts) {
    const pos = this.phreatic.geometry.attributes.position;
    for (let k = 0; k <= NZROW; k++) {
      const z = -HALF + (2 * HALF * k) / NZROW, gz = groundAt(z);
      // where the abutment rises above the phreatic line, end the row exactly at the
      // crossing point (later samples collapse onto it), so the sheet's edge is smooth
      let cut = -1, xc = 0;
      if (gz > 0) {
        for (let i = 0; i < NPH; i++) {
          if (pts[i][1] <= gz) {
            cut = i;
            if (i === 0) xc = pts[0][0];
            else { const a = pts[i - 1], b = pts[i], f = (a[1] - gz) / ((a[1] - b[1]) || 1); xc = a[0] + (b[0] - a[0]) * f; }
            break;
          }
        }
      }
      for (let i = 0; i < NPH; i++) {
        if (cut >= 0 && i >= cut) pos.setXYZ(k * NPH + i, xc, gz + 0.05, z);
        else pos.setXYZ(k * NPH + i, pts[i][0], pts[i][1] + 0.05, z);
      }
    }
    pos.needsUpdate = true;
    this.phreatic.geometry.computeVertexNormals();
    this.phreatic.geometry.computeBoundingSphere();
    const ep = this.phreaticEdge.geometry.attributes.position;
    for (let i = 0; i < NPH; i++) ep.setXYZ(i, pts[i][0], pts[i][1] + 0.06, this.cut - 0.05);
    ep.needsUpdate = true;
    this.phreaticEdge.geometry.computeBoundingSphere();
  }

  buildSeepageFace(r) {
    const geo = new THREE.BufferGeometry();
    if (r.seepageFace.present) {
      const a = r.seepageFace.bottomZ, b = r.seepageFace.topZ, off = 0.15;
      const verts = [], idx = [], nz = 40;
      for (let k = 0; k <= nz; k++) {
        const zz = -FLOOR_HALF + (2 * FLOOR_HALF * k) / nz;
        verts.push(downFaceX(a) + off, a + off, zz, downFaceX(b) + off, b + off, zz);
      }
      for (let k = 0; k < nz; k++) { const o = 2 * k; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
    }
    this.sf.geometry.dispose();
    this.sf.geometry = geo;
    this.sf.visible = this.layers.phreatic;
  }

  // particles ride the solver's flow lines; each line is copied to several axis positions
  buildParticles(r) {
    const lines = [];
    for (const f of r.flowlines) {
      if (f.pts.length < 2) continue;
      const pts = f.pts, cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      lines.push({ pts, cum, len: cum[cum.length - 1] });
    }
    const all = lines.flatMap(l => l.pts.map(p => p[3] || 0)).filter(v => v > 0).sort((a, b) => a - b);
    const gmed = all.length ? all[all.length >> 1] : 1;
    this.flow = { lines, gmed };
    const parts = [];
    const lanes = [-26, -13, -1.5];
    lines.forEach((l, li) => {
      const per = Math.max(3, Math.round(l.len / 8));
      for (const lane of lanes) for (let k = 0; k < per; k++) {
        parts.push({ li, s: (k / per) * l.len + Math.random() * 2, z: lane + (Math.random() - 0.5) * 7, seg: 1 });
      }
    });
    this.particles = parts;
    this.ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(parts.length * 3), 3));
    this.stepParticles(0);
  }

  stepParticles(dt) {
    if (!this.flow || !this.particles.length) return;
    const pos = this.ptGeo.attributes.position;
    const { lines, gmed } = this.flow;
    for (let n = 0; n < this.particles.length; n++) {
      const p = this.particles[n], l = lines[p.li];
      let i = p.seg;
      if (i >= l.cum.length || l.cum[i - 1] > p.s) i = 1;
      while (i < l.cum.length - 1 && l.cum[i] < p.s) i++;
      p.seg = i;
      const a = l.pts[i - 1], b = l.pts[i];
      const seg = l.cum[i] - l.cum[i - 1] || 1, t = Math.min(1, Math.max(0, (p.s - l.cum[i - 1]) / seg));
      const v = a[3] > 0 ? a[3] : gmed;
      // on-screen speed ~ sqrt of the true speed (real speeds span several decades)
      p.s += 6 * Math.min(5, Math.max(0.15, Math.sqrt(v / gmed))) * dt;
      if (p.s >= l.len) { p.s = Math.random() * 2; p.seg = 1; }
      const vis = p.z <= this.cut;
      pos.setXYZ(n, a[0] + (b[0] - a[0]) * t, vis ? a[1] + (b[1] - a[1]) * t : -999, p.z);
    }
    pos.needsUpdate = true;
  }

  setCut(z) {
    this.cut = Math.max(-FLOOR_HALF + 4, Math.min(FLOOR_HALF - 4, z));
    this.updateCut();
    if (this.phreaticPts) this.writePhreatic(this.phreaticPts);
    this.stepParticles(0);
  }

  setLayer(key, on) {
    this.layers[key] = on;
    if (this.failed) return;
    if (key === 'phreatic') { this.phreatic.visible = this.phreaticEdge.visible = on && !!this.phreaticPts; this.sf.visible = on; this.setXray(on); }
    if (key === 'particles') this.points.visible = on;
    if (key === 'labels') this.labelLayer.hidden = !on;
  }

  // see-through dam, so the saturated zone inside it is visible
  setXray(on) {
    const to = on ? 0.5 : 1, from = this.damMat.opacity;
    this.damMat.depthWrite = !on;
    this.animate('xray', 350, t => { this.damMat.opacity = from + (to - from) * ease(t); });
  }

  updateCut() {
    if (this.failed) return;
    this.clip.constant = this.cut;
    this.section.position.z = this.cut;
    this.sectionPrev.position.z = this.cut + 0.03;
  }

  // shift the projection centre so the model sits in the part of the canvas not covered
  // by a panel on the left (px)
  setInset(px) {
    if (this.inset === px) return;
    this.inset = px;
    this.resize();
  }

  setView(name, instant) {
    name = LEGACY[name] || name;
    const v = VIEWS[name] || VIEWS.iso;
    this.lastView = name;
    const vis = this.visibleAspect || 1.5;
    const k = vis < 0.8 ? 1.3 : vis < 1.15 ? 1.15 : vis > 2 ? 0.8 : 1;   // closer in wide, short stages
    const tgt = v[1].slice();
    const c = v[0].map((x, i) => tgt[i] + (x - tgt[i]) * k);
    c[2] += this.cut; tgt[2] += this.cut;
    if (instant || this.reduceMotion) {
      this.camera.position.set(...c);
      this.controls.target.set(...tgt);
      this.controls.update();
      this.tween = null;
      return;
    }
    this.tween = { from: this.camera.position.clone(), to: new THREE.Vector3(...c), tf: this.controls.target.clone(), tt: new THREE.Vector3(...tgt), t: 0 };
  }

  setLabels(list) {
    this.labelLayer.innerHTML = '';
    this.labels = (list || []).map(l => {
      const el = document.createElement('div');
      el.className = 'vlabel' + (l.tone ? ' tone-' + l.tone : '');
      el.textContent = l.text;
      this.labelLayer.appendChild(el);
      return { el, pos: new THREE.Vector3(l.at[0], l.at[1], l.at[2] === 'cut' ? 0 : l.at[2]), atCut: l.at[2] === 'cut' };
    });
  }

  placeLabels() {
    if (!this.labels.length || this.labelLayer.hidden) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      v.copy(l.pos);
      if (l.atCut) v.z = this.cut;
      v.project(this.camera);
      const x = ((v.x + 1) / 2) * w, y = ((1 - v.y) / 2) * h;
      const hidden = v.z > 1 || x < this.inset + 10 || x > w - 10 || y < 10 || y > h - 10;
      l.el.style.visibility = hidden ? 'hidden' : 'visible';
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  resize() {
    if (this.failed) return;
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    const inset = this.inset > 0 && w - this.inset > 280 ? this.inset : 0;
    this.visibleAspect = (w - inset) / h;
    this.camera.fov = this.visibleAspect < 0.9 ? 50 : 36;
    if (inset) {
      this.camera.aspect = (w + inset) / h;
      this.camera.setViewOffset(w + inset, h, 0, 0, w, h);
    } else {
      this.camera.aspect = w / h;
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
    const band = this.visibleAspect < 0.8 ? 0 : this.visibleAspect < 1.15 ? 1 : this.visibleAspect > 2 ? 3 : 2;
    if (this.band !== undefined && band !== this.band && !this.interacted) this.setView(this.lastView || 'iso', true);
    this.band = band;
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    if (this.anims.length) {
      for (const a of this.anims.slice()) {
        a.t = Math.min(1, a.t + (dt * 1000) / a.ms);
        a.fn(a.t);
        if (a.t >= 1) { this.anims.splice(this.anims.indexOf(a), 1); if (a.done) a.done(); }
      }
    }
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / 0.9);
      const e = ease(tw.t);
      this.camera.position.lerpVectors(tw.from, tw.to, e);
      this.controls.target.lerpVectors(tw.tf, tw.tt, e);
      if (tw.t >= 1) this.tween = null;
    }
    if (this.showcase && !this.reduceMotion) {
      // slow sway around the iso view
      const v = VIEWS.iso, tgt = new THREE.Vector3(...v[1]);
      const off = new THREE.Vector3(...v[0]).sub(tgt).multiplyScalar(0.8);   // a little closer than the lesson view
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.22 * Math.sin(this.time * 0.18));
      this.camera.position.copy(tgt).add(off);
      this.camera.lookAt(tgt);
    } else {
      this.controls.update();
    }
    if (this.layers.particles && !this.reduceMotion) this.stepParticles(dt);
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL('image/png');
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.failed) return;
    this.ro.disconnect();
    this.themeObs.disconnect();
    this.mq.removeEventListener('change', this.mqFn);
    this.controls.dispose();
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.secTex.forEach(t => t.dispose());
    this.dotTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();   // release the GL context now; pages come and go in this app
  }
}
