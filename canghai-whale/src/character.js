import * as THREE from 'three';
import { std } from './materials.js';
import { makeCanvas, clamp, lerp, damp, smoothstep } from './util.js';

// palette (sRGB hex)
const C = {
  skin: 0xffe2d2, skinShade: 0xf6c9b6,
  hairRoot: 0x2f4fe0, hairMid: 0x4d6bfe, hairTip: 0x9fe3ff,
  blue: 0x4d6bfe, navy: 0x1c2c86, white: 0xf5f7fc, cyan: 0x7fd6ff,
  tailTop: 0x3552e6, tailBelly: 0xf2f6ff, shoe: 0x1c2c86,
};

function mat(color, o = {}) {
  return std(Object.assign({ color, roughness: 0.6, metalness: 0 }, o));
}

function colorize(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    fn(c, p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// --------------------------------------------------------------------------------------------- face texture
function drawFace(expr) {
  const W = 1024, H = 512;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#ffe2d2';
  g.fillRect(0, 0, W, H);
  // soft shading under the fringe and at the jaw
  let grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0.0, 'rgba(240,190,170,0.55)');
  grd.addColorStop(0.3, 'rgba(240,190,170,0.0)');
  grd.addColorStop(0.75, 'rgba(240,190,170,0.0)');
  grd.addColorStop(1.0, 'rgba(236,180,160,0.5)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  const cx = W * 0.25;                 // +z (front) of a three.js sphere sits at u = 0.25
  const ey = H * 0.535;                // eye line (v grows upward on the sphere, canvas y grows downward)
  const sep = 66;
  // blush
  for (const s of [-1, 1]) {
    grd = g.createRadialGradient(cx + s * 84, ey + 52, 2, cx + s * 84, ey + 52, 40);
    grd.addColorStop(0, 'rgba(255,120,130,0.5)');
    grd.addColorStop(1, 'rgba(255,120,130,0)');
    g.fillStyle = grd;
    g.fillRect(cx + s * 84 - 44, ey + 8, 88, 88);
  }
  for (const s of [-1, 1]) {
    const x = cx + s * sep;
    g.save();
    g.translate(x, ey);
    if (expr === 'closed' || expr === 'joy') {
      g.strokeStyle = '#1b2a66';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath();
      if (expr === 'joy') { g.moveTo(-30, 12); g.quadraticCurveTo(0, -26, 30, 12); }   // ^ ^
      else { g.moveTo(-32, 0); g.quadraticCurveTo(0, 20, 32, 0); }
      g.stroke();
    } else {
      const open = expr === 'half' ? 0.45 : 1;
      const ew = 38, eh = 52 * open;
      // sclera
      g.beginPath(); g.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2); g.closePath();
      g.save(); g.clip();
      g.fillStyle = '#ffffff'; g.fillRect(-60, -60, 120, 120);
      // iris
      grd = g.createLinearGradient(0, -40, 0, 44);
      grd.addColorStop(0, '#12247a'); grd.addColorStop(0.45, '#3d5df2'); grd.addColorStop(1, '#8fe0ff');
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(0, 4, 31, 44, 0, 0, Math.PI * 2); g.fill();
      // pupil
      g.fillStyle = '#0a1446';
      g.beginPath(); g.ellipse(0, 3, 12, 20, 0, 0, Math.PI * 2); g.fill();
      // lower glow ring
      g.strokeStyle = 'rgba(190,240,255,0.9)'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(0, 10, 18, 24, 0, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      // highlights
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(-11 * s * -1, -18, 9, 12, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(10 * s * -1, 20, 4.5, 5.5, 0, 0, Math.PI * 2); g.fill();
      // shadow of the upper lid
      grd = g.createLinearGradient(0, -eh, 0, -eh + 26);
      grd.addColorStop(0, 'rgba(20,30,90,0.55)'); grd.addColorStop(1, 'rgba(20,30,90,0)');
      g.fillStyle = grd; g.fillRect(-60, -eh, 120, 30);
      g.restore();
      // lashes
      g.strokeStyle = '#141f55'; g.lineCap = 'round';
      g.lineWidth = 9;
      g.beginPath(); g.moveTo(-ew - 3, -eh * 0.35); g.quadraticCurveTo(0, -eh - 12, ew + 4, -eh * 0.3); g.stroke();
      g.lineWidth = 6;
      g.beginPath(); g.moveTo(s * (ew + 2), -eh * 0.36); g.lineTo(s * (ew + 13), -eh * 0.62); g.stroke();
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(40,50,110,0.7)';
      g.beginPath(); g.moveTo(-ew * 0.7, eh * 0.78); g.quadraticCurveTo(0, eh + 5, ew * 0.7, eh * 0.78); g.stroke();
    }
    g.restore();
    // brow
    g.strokeStyle = '#2b47c8'; g.lineWidth = 4.5; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - s * 30, ey - 76 + (expr === 'joy' ? -6 : 0));
    g.quadraticCurveTo(x, ey - 90 + (expr === 'joy' ? -6 : 0), x + s * 32, ey - 72 + (expr === 'joy' ? -4 : 0));
    g.stroke();
  }
  // nose + mouth
  g.fillStyle = 'rgba(225,150,135,0.8)';
  g.beginPath(); g.ellipse(cx, ey + 50, 3, 2.2, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#b4504f'; g.lineWidth = 4; g.lineCap = 'round';
  if (expr === 'joy') {
    g.fillStyle = '#c9575a';
    g.beginPath(); g.moveTo(cx - 20, ey + 76); g.quadraticCurveTo(cx, ey + 112, cx + 20, ey + 76); g.closePath(); g.fill();
    g.fillStyle = '#ffb3b0';
    g.beginPath(); g.ellipse(cx, ey + 95, 9, 5, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.beginPath(); g.moveTo(cx - 13, ey + 80); g.quadraticCurveTo(cx - 6, ey + 88, cx, ey + 81); g.quadraticCurveTo(cx + 6, ey + 88, cx + 13, ey + 80); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// --------------------------------------------------------------------------------------------- the girl
export class WhaleGirl {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'whaleGirl';
    this.j = {};                     // joints by name
    this.cur = {};                   // current euler per joint
    this.phase = 0;
    this.time = 0;
    this.blinkT = 2;
    this.expr = 'open';
    this.landSquash = 0;
    this.hairLag = new THREE.Vector3();
    this._build();
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  _joint(name, parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.name = name;
    parent.add(g);
    this.j[name] = g;
    this.cur[name] = new THREE.Euler();
    return g;
  }

  _build() {
    const J = (n, p, x, y, z) => this._joint(n, p, x, y, z);
    const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    const skin = mat(C.skin, { roughness: 0.52 });
    const white = mat(C.white, { roughness: 0.82 });
    const blue = mat(C.blue, { roughness: 0.7 });
    const navy = mat(C.navy, { roughness: 0.6 });
    const cyan = mat(C.cyan, { roughness: 0.5 });
    const hairM = std({ vertexColors: true, roughness: 0.34, metalness: 0.08 });
    const tailM = std({ vertexColors: true, roughness: 0.26, metalness: 0.0 });

    const body = J('body', this.root, 0, 0, 0);          // whole-body offset (bob / squash)
    const hips = J('hips', body, 0, 0.86, 0);
    const spine = J('spine', hips, 0, 0.07, 0);
    const chest = J('chest', spine, 0, 0.13, 0);
    const neck = J('neck', chest, 0, 0.19, 0);
    const head = J('head', neck, 0, 0.045, 0);
    head.scale.setScalar(1.13);

    // ---- torso
    const hipsG = new THREE.SphereGeometry(1, 20, 14);
    add(hips, hipsG, navy, 0, -0.01, 0).scale.set(0.112, 0.085, 0.092);
    add(spine, new THREE.SphereGeometry(1, 20, 14), white, 0, 0.03, 0).scale.set(0.094, 0.1, 0.074);
    add(chest, new THREE.SphereGeometry(1, 22, 16), white, 0, 0.065, 0.004).scale.set(0.118, 0.125, 0.088);
    add(chest, new THREE.SphereGeometry(1, 16, 12), white, 0, 0.075, 0.05).scale.set(0.085, 0.06, 0.05);
    add(neck, new THREE.CylinderGeometry(0.03, 0.034, 0.09, 12), skin, 0, 0.0, 0);
    // sailor collar: back flap, shoulder yoke and a cyan ribbon
    const flap = add(chest, new THREE.BoxGeometry(0.21, 0.13, 0.012), navy, 0, 0.115, -0.083);
    flap.rotation.x = 0.12;
    add(chest, new THREE.TorusGeometry(0.062, 0.02, 8, 20), navy, 0, 0.175, 0.0).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      const lap = add(chest, new THREE.BoxGeometry(0.05, 0.14, 0.012), navy, s * 0.04, 0.115, 0.078);
      lap.rotation.set(-0.35, 0, s * 0.42);
      const bow = add(chest, new THREE.ConeGeometry(0.03, 0.075, 10), cyan, s * 0.036, 0.062, 0.098);
      bow.rotation.z = s * 1.25;
      bow.scale.z = 0.45;
      const tailR = add(chest, new THREE.BoxGeometry(0.022, 0.085, 0.006), cyan, s * 0.017, 0.012, 0.098);
      tailR.rotation.z = s * 0.2;
    }
    add(chest, new THREE.SphereGeometry(0.016, 10, 8), cyan, 0, 0.062, 0.102);

    // ---- skirt (pleated)
    const skirt = J('skirt', hips, 0, 0.05, 0);
    {
      const seg = 48, rows = 7;
      const pos = [], idx = [];
      for (let r = 0; r <= rows; r++) {
        const t = r / rows;
        for (let s = 0; s <= seg; s++) {
          const a = (s / seg) * Math.PI * 2;
          const pleat = 1 + 0.07 * t * Math.cos(a * 16);
          const rad = lerp(0.098, 0.215, Math.pow(t, 0.85)) * pleat;
          pos.push(Math.cos(a) * rad, -t * 0.25, Math.sin(a) * rad * 0.9);
        }
      }
      for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) {
        const a = r * (seg + 1) + s, b = a + seg + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      colorize(g, (c, x, y) => { if (y < -0.205 && y > -0.235) c.set(C.white); else c.set(C.blue); });
      const sm = std({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
      add(skirt, g, sm);
      add(skirt, new THREE.TorusGeometry(0.094, 0.014, 8, 24), white, 0, 0.0, 0).rotation.x = Math.PI / 2;
    }

    // ---- legs
    for (const [sfx, s] of [['L', 1], ['R', -1]]) {
      const thigh = J('thigh' + sfx, hips, s * 0.07, -0.05, 0);
      add(thigh, new THREE.SphereGeometry(0.058, 14, 10), skin, 0, -0.01, 0);
      add(thigh, new THREE.CylinderGeometry(0.058, 0.045, 0.39, 16), skin, 0, -0.2, 0);
      add(thigh, new THREE.CylinderGeometry(0.0535, 0.0465, 0.18, 16), white, 0, -0.312, 0);        // sock top
      add(thigh, new THREE.TorusGeometry(0.0545, 0.0065, 6, 20), blue, 0, -0.235, 0).rotation.x = Math.PI / 2;
      const shin = J('shin' + sfx, thigh, 0, -0.4, 0);
      add(shin, new THREE.SphereGeometry(0.0468, 14, 10), white, 0, 0, 0);
      add(shin, new THREE.CylinderGeometry(0.0465, 0.031, 0.35, 16), white, 0, -0.185, 0);
      const foot = J('foot' + sfx, shin, 0, -0.38, 0);
      add(foot, new THREE.SphereGeometry(0.034, 12, 8), navy, 0, 0.0, 0);
      const shoe = add(foot, new THREE.SphereGeometry(1, 16, 10), navy, 0, -0.012, 0.04);
      shoe.scale.set(0.043, 0.034, 0.092);
      const sole = add(foot, new THREE.SphereGeometry(1, 16, 8), white, 0, -0.034, 0.04);
      sole.scale.set(0.044, 0.012, 0.094);
    }

    // ---- arms
    for (const [sfx, s] of [['L', 1], ['R', -1]]) {
      const arm = J('arm' + sfx, chest, s * 0.128, 0.135, 0);
      add(arm, new THREE.SphereGeometry(0.052, 14, 10), white, s * 0.006, -0.012, 0).scale.set(1, 0.95, 1);   // puff sleeve
      add(arm, new THREE.CapsuleGeometry(0.029, 0.19, 5, 12), skin, 0, -0.13, 0);
      const fore = J('fore' + sfx, arm, 0, -0.25, 0);
      add(fore, new THREE.SphereGeometry(0.0295, 10, 8), skin, 0, 0, 0);
      add(fore, new THREE.CapsuleGeometry(0.026, 0.18, 5, 12), skin, 0, -0.11, 0);
      add(fore, new THREE.CylinderGeometry(0.033, 0.036, 0.05, 12), blue, 0, -0.2, 0);                    // cuff
      add(fore, new THREE.TorusGeometry(0.036, 0.005, 6, 14), white, 0, -0.225, 0).rotation.x = Math.PI / 2;
      const hand = J('hand' + sfx, fore, 0, -0.245, 0);
      add(hand, new THREE.SphereGeometry(1, 12, 10), skin, 0, -0.03, 0).scale.set(0.027, 0.038, 0.02);
      add(hand, new THREE.SphereGeometry(1, 8, 6), skin, s * -0.0, -0.025, 0.022).scale.set(0.011, 0.024, 0.011);
    }

    // ---- head
    {
      const hg = new THREE.SphereGeometry(0.125, 40, 28);
      const p = hg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (y < 0) {
          const k = Math.pow(-y / 0.125, 1.6);
          x *= 1 - 0.3 * k;                    // tapered jaw
          z *= 1 - 0.14 * k;
          if (z > 0) z += 0.012 * k * (1 - Math.abs(x) / 0.125);   // small chin
        }
        y *= 1.04;
        p.setXYZ(i, x, y, z);
      }
      hg.computeVertexNormals();
      this.faceTex = { open: drawFace('open'), half: drawFace('half'), closed: drawFace('closed'), joy: drawFace('joy') };
      this.faceMat = std({ map: this.faceTex.open, roughness: 0.5, metalness: 0 });
      add(head, hg, this.faceMat, 0, 0.115, 0);
    }
    const hc = new THREE.Color();
    const hairGrad = (c, y, y0, y1) => {
      const t = clamp((y - y0) / (y1 - y0), 0, 1);     // 0 = tips, 1 = roots
      if (t > 0.5) c.set(C.hairMid).lerp(hc.set(C.hairRoot), (t - 0.5) * 2);
      else c.set(C.hairTip).lerp(hc.set(C.hairMid), t * 2);
    };
    // hair cap: a slightly larger shell, opened over the face
    {
      const g = new THREE.SphereGeometry(0.1335, 36, 24);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const f = clamp(z / 0.1335, -1, 1);
        const limit = lerp(-0.105, 0.06, smoothstep(-0.35, 0.75, f)) + 0.03 * Math.pow(Math.abs(x) / 0.1335, 2) * (f > 0 ? -1.2 : 0);
        if (y < limit) { y = limit; const k = 0.985; x *= k; z *= k; }
        p.setXYZ(i, x, y * 1.05, z - 0.004);
      }
      g.computeVertexNormals();
      colorize(g, (c, x, y) => hairGrad(c, y, -0.3, 0.1));
      add(head, g, hairM, 0, 0.118, 0);
    }
    // a flattened spike of hair from p0 (root) to p1 (tip); `n` is the direction it is flattened along
    const spike = (parent, p0, p1, w, th, c0, c1, n) => {
      const axis = new THREE.Vector3().subVectors(p1, p0);
      const len = axis.length();
      axis.normalize();
      const g = new THREE.ConeGeometry(1, len, 9, 3);
      g.translate(0, len / 2, 0);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const t = pa.getY(i) / len;
        const bulge = 0.75 + 0.5 * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * (1 - t * 0.35);
        pa.setX(i, pa.getX(i) * w * bulge);
        pa.setZ(i, pa.getZ(i) * th * bulge);
      }
      g.computeVertexNormals();
      const ca = new THREE.Color(c0), cb = new THREE.Color(c1);
      colorize(g, (c, x, y) => c.copy(ca).lerp(cb, clamp(y / len, 0, 1)));
      const m = new THREE.Mesh(g, hairM);
      const zAxis = new THREE.Vector3().copy(n).addScaledVector(axis, -n.dot(axis)).normalize();
      const xAxis = new THREE.Vector3().crossVectors(axis, zAxis).normalize();
      m.matrix.makeBasis(xAxis, axis, zAxis).setPosition(p0);
      m.matrixAutoUpdate = false;
      parent.add(m);
      return m;
    };
    const HC = new THREE.Vector3(0, 0.118, 0);      // head centre in head-joint space
    const onHead = (az, polar, r) => new THREE.Vector3(Math.sin(az) * Math.sin(polar) * r, Math.cos(polar) * r * 1.04, Math.cos(az) * Math.sin(polar) * r).add(HC);
    // fringe: overlapping pointed locks ending just above the eyes
    const fr = [[-0.92, 0.058, 1.3], [-0.62, 0.062, 1.2], [-0.34, 0.06, 1.13], [-0.1, 0.05, 1.06], [0.12, 0.055, 1.1], [0.38, 0.06, 1.16], [0.66, 0.062, 1.22], [0.95, 0.056, 1.32]];
    for (const [az, w, pol] of fr) {
      const p0 = onHead(az * 0.9, 0.52, 0.132), p1 = onHead(az * 1.02 + 0.05, pol, 0.139);
      spike(head, p0, p1, w * 0.62, 0.016, C.hairRoot, C.hairMid, onHead(az, 0.9, 1).sub(HC));
    }
    // side locks framing the face
    for (const s of [-1, 1]) {
      const nm = 'side' + (s > 0 ? 'L' : 'R');
      const sl = J(nm, head, s * 0.108, 0.165, 0.058);
      spike(sl, new THREE.Vector3(0, 0.03, 0), new THREE.Vector3(s * 0.012, -0.27, 0.012), 0.034, 0.02, C.hairMid, C.hairTip, new THREE.Vector3(s, 0, 0.4));
    }
    // volume behind the neck so the back hair never looks hollow
    {
      const g = new THREE.SphereGeometry(1, 20, 14);
      g.scale(0.118, 0.17, 0.062);
      colorize(g, (c, x, y) => hairGrad(c, y, -0.42, 0.12));
      add(head, g, hairM, 0, 0.02, -0.078);
    }
    // long back hair: seven overlapping strands of four segments each
    this.strands = [];
    const SEG = 4, SL = 0.152, NS = 7;
    for (let k = 0; k < NS; k++) {
      const a = (k - (NS - 1) / 2) * 0.33;
      let parent = head;
      const chain = [];
      for (let i = 0; i < SEG; i++) {
        const jn = J(`hair${k}_${i}`, parent, i === 0 ? Math.sin(a) * 0.108 : 0, i === 0 ? 0.07 : -SL, i === 0 ? -Math.cos(a) * 0.108 : 0);
        const wf = (q) => lerp(0.07, 0.022, Math.pow(q / SEG, 1.25)) * (1 - Math.abs(a) * 0.1);
        const w0 = wf(i), w1 = i === SEG - 1 ? 0.004 : wf(i + 1);
        const L = SL;
        const g = new THREE.CylinderGeometry(w0, w1, L, 12, 3, false);
        g.translate(0, -L / 2, 0);
        const pa = g.attributes.position;
        const flat = (y) => lerp(0.42, 0.3, clamp((i + -y / L) / SEG, 0, 1));
        for (let q = 0; q < pa.count; q++) pa.setZ(q, pa.getZ(q) * flat(pa.getY(q)));
        g.computeVertexNormals();
        const yTop = 1 - i / SEG, yBot = 1 - (i + 1) / SEG;
        colorize(g, (c, px, py) => hairGrad(c, lerp(yBot, yTop, clamp(1 + py / SL, 0, 1)), 0.0, 1.12));
        if (i > 0) {
          const sg = new THREE.SphereGeometry(w0, 12, 8);
          sg.scale(1, 0.6, flat(0));
          colorize(sg, (c) => hairGrad(c, yTop, 0.0, 1.12));
          add(jn, sg, hairM).rotation.y = -a;
        }
        const m = add(jn, g, hairM);
        m.rotation.y = -a;
        chain.push(jn);
        parent = jn;
      }
      this.strands.push({ chain, a });
    }
    // ahoge
    {
      const a0 = J('ahoge0', head, 0, 0.246, 0.012);
      spike(a0, new THREE.Vector3(0, -0.005, 0), new THREE.Vector3(0, 0.075, 0), 0.013, 0.009, C.hairMid, C.hairMid, new THREE.Vector3(0, 0, 1));
      const a1 = J('ahoge1', a0, 0, 0.07, 0);
      spike(a1, new THREE.Vector3(0, -0.006, 0), new THREE.Vector3(0, 0.09, 0), 0.012, 0.008, C.hairMid, C.hairTip, new THREE.Vector3(0, 0, 1));
    }
    // whale head-fins: little flippers swept out and back
    for (const s of [-1, 1]) {
      const f = J('fin' + (s > 0 ? 'L' : 'R'), head, s * 0.098, 0.205, -0.035);
      const g = new THREE.SphereGeometry(1, 16, 10);
      g.scale(0.03, 0.07, 0.011);
      g.translate(0, 0.06, 0);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const t = clamp(pa.getY(i) / 0.13, 0, 1);
        pa.setZ(i, pa.getZ(i) - t * t * 0.03);          // swept back
        pa.setX(i, pa.getX(i) * (1 - 0.35 * t));
      }
      g.computeVertexNormals();
      colorize(g, (c, x, y, z, nx, ny, nz) => { if (nz > 0.25) c.set(C.cyan); else c.set(C.hairRoot); });
      add(f, g, hairM);
    }

    // ---- whale tail
    const TN = 8;
    this.tail = [];
    let tp = hips;
    for (let i = 0; i < TN; i++) {
      const len = 0.125;
      const jn = J('tail' + i, tp, 0, i === 0 ? 0.03 : -len, i === 0 ? -0.06 : 0);
      const r0 = lerp(0.082, 0.024, Math.pow(i / TN, 0.8)), r1 = lerp(0.082, 0.024, Math.pow((i + 1) / TN, 0.8));
      const g = new THREE.CylinderGeometry(r0, r1, len, 14, 1, true);
      g.translate(0, -len / 2, 0);
      const cb = new THREE.Color(C.tailBelly), ct = new THREE.Color(C.tailTop);
      colorize(g, (c, x, y, z, nx, ny, nz) => c.copy(ct).lerp(cb, smoothstep(0.15, 0.6, nz)));
      add(jn, g, tailM);
      const sg = new THREE.SphereGeometry(r0, 14, 10);
      colorize(sg, (c, x, y, z, nx, ny, nz) => c.copy(ct).lerp(cb, smoothstep(0.15, 0.6, nz)));
      add(jn, sg, tailM);
      this.tail.push(jn);
      tp = jn;
    }
    // flukes
    {
      const fl = J('fluke', tp, 0, -0.125, 0);
      for (const s of [-1, 1]) {
        const g = new THREE.SphereGeometry(1, 16, 10);
        g.scale(0.19, 0.1, 0.02);
        g.translate(s * 0.15, -0.05, 0);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i) * s;            // 0 at the root, grows outward
          p.setY(i, p.getY(i) - Math.max(0, x) * 0.55);
          p.setZ(i, p.getZ(i) * (1 - 0.5 * clamp(x / 0.34, 0, 1)));
        }
        g.computeVertexNormals();
        const cb = new THREE.Color(C.tailBelly), ct = new THREE.Color(C.tailTop);
        colorize(g, (c, x, y, z, nx, ny, nz) => c.copy(ct).lerp(cb, smoothstep(0.3, 0.8, nz)));
        add(fl, g, tailM);
      }
    }
    // rest pose of the tail (points back and down, tip curling up)
    this.tailRest = [1.0, 0.1, 0.13, 0.16, 0.18, 0.18, 0.16, 0.12];
  }

  // ------------------------------------------------------------------------------------------- animation
  /**
   * s: { mode:'ground'|'air'|'climb'|'swing'|'zip', speed, vy, moveX (strafe), run (0..1), climbX, climbY,
   *      ropeDir: Vector3 in character-local space (swing), turn }
   */
  update(dt, s) {
    this.time += dt;
    const t = this.time;
    const P = {};
    const set = (n, x = 0, y = 0, z = 0) => { P[n] = [x, y, z]; };
    const run = s.run || 0;
    let bodyY = 0, bodyPitch = 0;
    let rate = 14;

    // defaults (relaxed stand)
    set('hips'); set('spine'); set('chest'); set('neck'); set('head');
    set('armL', 0.05, 0, 0.13); set('armR', 0.05, 0, -0.13);
    set('foreL', -0.18); set('foreR', -0.18); set('handL'); set('handR');
    set('thighL', 0, 0, 0.03); set('thighR', 0, 0, -0.03); set('shinL'); set('shinR'); set('footL'); set('footR');
    set('skirt');

    if (s.mode === 'ground') {
      if (s.speed > 0.25) {
        const stride = lerp(1.25, 3.3, run);
        this.phase += (s.speed * dt * Math.PI * 2) / stride;
        const ph = this.phase;
        const A = lerp(0.42, 1.02, run), B = lerp(0.75, 1.75, run);
        const sn = Math.sin(ph), cs = Math.cos(ph);
        set('thighL', -sn * A - 0.12 * run, 0, 0.03); set('thighR', sn * A - 0.12 * run, 0, -0.03);
        set('shinL', 0.12 + B * Math.max(0, cs)); set('shinR', 0.12 + B * Math.max(0, -cs));
        set('footL', -0.25 * Math.max(0, sn) + 0.3 * Math.max(0, cs)); set('footR', -0.25 * Math.max(0, -sn) + 0.3 * Math.max(0, -cs));
        const Aa = lerp(0.4, 1.05, run);
        set('armL', sn * Aa + 0.1 * run, 0, 0.12 + 0.1 * run); set('armR', -sn * Aa + 0.1 * run, 0, -0.12 - 0.1 * run);
        set('foreL', -lerp(0.3, 1.45, run) - 0.25 * Math.max(0, sn)); set('foreR', -lerp(0.3, 1.45, run) - 0.25 * Math.max(0, -sn));
        set('hips', 0, sn * 0.1, 0); set('spine', lerp(0.02, 0.16, run), -sn * 0.08, 0);
        set('chest', lerp(0.02, 0.1, run), -sn * 0.12, 0); set('head', -lerp(0.02, 0.2, run), sn * 0.06, 0);
        bodyY = Math.cos(ph * 2) * lerp(0.012, 0.035, run) - 0.02 * run;
        bodyPitch = lerp(0.0, 0.12, run);
        set('skirt', -0.06 * run, 0, 0);
      } else {
        const b = Math.sin(t * 1.7);
        set('chest', 0.015 * b, 0, 0); set('head', -0.02 * b + 0.03, Math.sin(t * 0.5) * 0.12, 0);
        set('armL', 0.04, 0, 0.14 + 0.01 * b); set('armR', 0.04, 0, -0.14 - 0.01 * b);
        set('thighL', -0.04, 0, 0.05); set('thighR', 0.03, 0, -0.05); set('shinR', 0.05);
        bodyY = b * 0.004;
        rate = 8;
      }
    } else if (s.mode === 'air') {
      const up = clamp(s.vy / 9, -1, 1);
      if (up > 0) {
        set('thighL', -0.95 * up - 0.15, 0, 0.06); set('shinL', 1.5 * up + 0.2);
        set('thighR', 0.3, 0, -0.06); set('shinR', 0.55);
        set('armL', -0.4, 0, 0.5); set('armR', -2.5 * up - 0.3, 0, -0.35); set('foreL', -0.5); set('foreR', -0.25);
        set('spine', -0.08); set('head', -0.15);
      } else {
        const f = clamp(-s.vy / 22, 0, 1);
        const w = Math.sin(t * 9) * 0.12 * f;
        set('armL', -0.5 - 0.5 * f, 0, 1.0 + 0.5 * f + w); set('armR', -0.5 - 0.5 * f, 0, -1.0 - 0.5 * f + w);
        set('foreL', -0.35); set('foreR', -0.35);
        set('thighL', -0.5 + 0.2 * f, 0, 0.22 + 0.1 * f); set('thighR', 0.15 + 0.25 * f, 0, -0.22 - 0.1 * f);
        set('shinL', 0.8 - 0.3 * f + w); set('shinR', 0.7 + 0.2 * f - w);
        set('spine', 0.1 * f); set('head', -0.1 + 0.25 * f);
        bodyPitch = 0.35 * f * clamp(s.speed / 12, 0, 1);
      }
      rate = 11;
    } else if (s.mode === 'climb') {
      this.phase += (Math.hypot(s.climbX || 0, s.climbY || 0) * dt * Math.PI * 2) / 1.5;
      const ph = this.phase, sn = Math.sin(ph), cs = Math.cos(ph);
      set('armL', -2.55 - 0.45 * sn, 0, 0.45); set('armR', -2.55 + 0.45 * sn, 0, -0.45);
      set('foreL', -0.25 - 0.55 * Math.max(0, -sn)); set('foreR', -0.25 - 0.55 * Math.max(0, sn));
      set('thighL', -1.15 + 0.5 * sn, 0, 0.62); set('thighR', -1.15 - 0.5 * sn, 0, -0.62);
      set('shinL', 1.75 - 0.55 * sn); set('shinR', 1.75 + 0.55 * sn);
      set('footL', -0.5); set('footR', -0.5);
      set('spine', -0.12, 0, sn * 0.08); set('chest', -0.1, 0, -sn * 0.06); set('head', -0.45, (s.climbX || 0) * -0.35, 0);
      set('hips', 0.1, 0, -sn * 0.08);
      rate = 16;
    } else if (s.mode === 'swing' || s.mode === 'zip') {
      // legs trail behind / kick forward with the pendulum, one knee tucked
      const k = clamp(s.swingPhase || 0, -1, 1);      // -1 = back-swing, +1 = forward apex
      set('thighL', -0.95 + 0.5 * k, 0, 0.1); set('shinL', 1.55 - 0.4 * k);
      set('thighR', 0.45 - 0.75 * k, 0, -0.08); set('shinR', 0.35 + 0.3 * (1 - k));
      set('footL', 0.45); set('footR', 0.55);
      set('armL', 0.7 - 0.5 * k, 0, 0.75); set('foreL', -0.5);
      set('spine', -0.1 + 0.12 * k); set('chest', -0.1); set('head', -0.25, 0, 0);
      if (s.mode === 'zip') {
        set('armL', -2.9, 0, 0.2); set('foreL', -0.05);
        set('thighL', 0.25, 0, 0.05); set('shinL', 0.25); set('thighR', 0.1, 0, -0.05); set('shinR', 0.5);
      }
      rate = 13;
    }

    // one hand follows the rope
    let ropeArm = null;
    if ((s.mode === 'swing' || s.mode === 'zip') && s.ropeDir) {
      const d = s.ropeDir;                           // character-local unit vector towards the anchor
      // the arm hangs along -y; find the rotation taking -y onto d (in chest space ≈ root space)
      const q = _q.setFromUnitVectors(_down, d);
      _e.setFromQuaternion(q, 'XYZ');
      ropeArm = [_e.x, _e.y, _e.z];
      set('foreR', -0.08); set('handR', 0, 0, 0);
    }

    // landing squash
    this.landSquash = damp(this.landSquash, 0, 9, dt);
    bodyY -= this.landSquash * 0.2;
    if (this.landSquash > 0.02) {
      const q = this.landSquash;
      P.thighL[0] -= 0.9 * q; P.thighR[0] -= 0.9 * q; P.shinL[0] += 1.6 * q; P.shinR[0] += 1.6 * q;
      P.footL[0] -= 0.5 * q; P.footR[0] -= 0.5 * q; P.spine[0] += 0.4 * q;
    }

    // blend current -> target
    const k = 1 - Math.exp(-rate * dt);
    for (const n in P) {
      const c = this.cur[n], g = this.j[n], p = P[n];
      c.x += (p[0] - c.x) * k; c.y += (p[1] - c.y) * k; c.z += (p[2] - c.z) * k;
      g.rotation.set(c.x, c.y, c.z);
    }
    if (ropeArm) {
      const c = this.cur.armR, g = this.j.armR;
      const kk = 1 - Math.exp(-22 * dt);
      c.x += (ropeArm[0] - c.x) * kk; c.y += (ropeArm[1] - c.y) * kk; c.z += (ropeArm[2] - c.z) * kk;
      g.rotation.set(c.x, c.y, c.z);
    }
    const b = this.j.body;
    b.position.y = damp(b.position.y, bodyY, 18, dt);
    b.rotation.x = damp(b.rotation.x, bodyPitch, 8, dt);

    // ---- secondary motion: hair, ahoge, fins, tail
    const fwd = clamp((s.localVz || 0) / 14, -1.2, 1.4);     // forward speed in body space
    const side = clamp((s.localVx || 0) / 10, -1, 1);
    const vert = clamp((s.vy || 0) / 16, -1.4, 1.4);
    this.hairLag.x = damp(this.hairLag.x, side, 5, dt);
    this.hairLag.y = damp(this.hairLag.y, vert, 5, dt);
    this.hairLag.z = damp(this.hairLag.z, fwd, 5, dt);
    const hl = this.hairLag;
    for (const st of this.strands) {
      for (let i = 0; i < st.chain.length; i++) {
        const w = Math.sin(t * 2.2 + i * 0.9 + st.a * 3) * 0.035 * (i + 1);
        // positive x swings the strand backwards (it hangs along -y)
        const rx = (i === 0 ? 0.2 : 0.0) + hl.z * (0.24 + 0.1 * i) - hl.y * (0.2 + 0.1 * i) * (i === 0 ? 0.6 : 1) + w;
        const rz = st.a * (i === 0 ? 0.14 : 0.02) + hl.x * (0.18 + 0.06 * i) + w * 0.5;
        st.chain[i].rotation.set(clamp(rx, -0.5, 1.5), 0, rz);
      }
    }
    for (const sgn of [1, -1]) {
      const sl = this.j[sgn > 0 ? 'sideL' : 'sideR'];
      sl.rotation.set(0.05 + hl.z * 0.35 - hl.y * 0.3, 0, sgn * (0.06 + Math.max(0, -hl.y) * 0.3) + hl.x * 0.25);
    }
    const bounce = Math.sin(t * 7) * 0.05 * clamp(s.speed / 6, 0, 1.5);
    this.j.ahoge0.rotation.set(-0.25 + hl.z * 0.6 + bounce - hl.y * 0.5, 0, hl.x * 0.5);
    this.j.ahoge1.rotation.set(0.9 + hl.z * 0.5 + bounce * 2 - hl.y * 0.6, 0, hl.x * 0.4);
    const flap = Math.sin(t * 3.1) * 0.07 + clamp(s.speed / 20, 0, 1) * 0.5 - hl.y * 0.35;
    this.j.finL.rotation.set(-0.55 - flap * 0.3, 0, -1.05 - flap * 0.6);
    this.j.finR.rotation.set(-0.55 - flap * 0.3, 0, 1.05 + flap * 0.6);

    // tail: whale-style vertical undulation, stronger with speed
    const amp = 0.05 + 0.16 * clamp(s.speed / 14, 0, 1);
    const freq = 2.2 + 5.5 * clamp(s.speed / 14, 0, 1);
    for (let i = 0; i < this.tail.length; i++) {
      const w = Math.sin(t * freq - i * 0.75) * amp * (0.4 + i * 0.16);
      let rx = this.tailRest[i] + w;
      if (i > 0) rx += -hl.y * 0.13 + hl.z * 0.02;
      else rx += clamp(-hl.y * 0.35, -0.6, 0.5) + (s.mode === 'climb' ? 0.25 : 0);
      const rz = Math.sin(t * 1.3 - i * 0.5) * 0.045 + hl.x * 0.12;
      this.tail[i].rotation.set(rx, 0, rz);
    }

    // ---- face
    this.blinkT -= dt;
    let expr = 'open';
    if (s.joy) expr = 'joy';
    else if (this.blinkT < 0.07) expr = 'closed';
    else if (this.blinkT < 0.12) expr = 'half';
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3.5;
    if (expr !== this.expr) {
      this.expr = expr;
      this.faceMat.map = this.faceTex[expr];
    }
  }

  land(strength) {
    this.landSquash = Math.max(this.landSquash, clamp(strength, 0, 1));
  }

  handWorld(target) {
    return this.j.handR.getWorldPosition(target);
  }
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _down = new THREE.Vector3(0, -1, 0);
