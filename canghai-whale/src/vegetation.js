import * as THREE from 'three';
import { mulberry32, makeCanvas, lerp } from './util.js';
import { leafMaterial, barkMaterial } from './materials.js';
import { MB } from './geo.js';

// ------------------------------------------------------------------ textures
function leafTexture() {
  const S = 512, H = S / 2;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const rnd = mulberry32(77);
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const ox = cx * H + H / 2, oy = cy * H + H / 2;
      const n = 120;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6) * H * 0.43;
        const x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r * 0.92;
        const size = 13 + rnd() * 13;
        const l = Math.round(120 + rnd() * 120);
        g.save();
        g.translate(x, y);
        g.rotate(rnd() * Math.PI * 2);
        const grd = g.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
        grd.addColorStop(0, `rgb(${l},${l},${Math.round(l * 0.92)})`);
        grd.addColorStop(1, `rgb(${Math.round(l * 0.72)},${Math.round(l * 0.75)},${Math.round(l * 0.66)})`);
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(-size, 0);
        g.quadraticCurveTo(0, -size * 0.62, size, 0);
        g.quadraticCurveTo(0, size * 0.62, -size, 0);
        g.fill();
        g.strokeStyle = `rgba(255,255,255,0.35)`;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(-size, 0); g.lineTo(size, 0); g.stroke();
        g.restore();
      }
    }
  }
  // an opaque swatch for the inner canopy mass
  g.fillStyle = 'rgb(150,152,140)';
  g.fillRect(0, 0, 14, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function frondTexture() {
  const W = 256, Hh = 512;
  const c = makeCanvas(W, Hh);
  const g = c.getContext('2d');
  const rnd = mulberry32(99);
  g.lineCap = 'round';
  // rachis
  g.strokeStyle = 'rgb(205,200,150)';
  g.lineWidth = 7;
  g.beginPath(); g.moveTo(W / 2, Hh); g.lineTo(W / 2, 8); g.stroke();
  // leaflets
  for (let i = 0; i < 74; i++) {
    const t = i / 73;                       // 0 base .. 1 tip
    const y = Hh - 14 - t * (Hh - 30);
    const len = (W * 0.5 - 6) * Math.sin(Math.PI * Math.pow(t, 0.75) * 0.94 + 0.12) * (0.86 + 0.14 * rnd());
    for (const s of [-1, 1]) {
      const l = Math.round(150 + rnd() * 90);
      g.strokeStyle = `rgb(${Math.round(l * 0.92)},${l},${Math.round(l * 0.8)})`;
      g.lineWidth = 3.2 + rnd() * 1.8;
      g.beginPath();
      g.moveTo(W / 2, y);
      g.quadraticCurveTo(W / 2 + s * len * 0.6, y - len * 0.42, W / 2 + s * len, y - len * 0.3 + rnd() * 8);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ geometry helpers
function tube(mb, p0, r0, p1, r1, seg, col) {
  const ax = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const len = ax.length();
  if (len < 1e-4) return;
  ax.multiplyScalar(1 / len);
  const u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(ax.x) > 0.9) u.set(0, 0, 1);
  const a = new THREE.Vector3().crossVectors(ax, u).normalize();
  const b = new THREE.Vector3().crossVectors(ax, a).normalize();
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
    const n0 = [a.x * Math.cos(t0) + b.x * Math.sin(t0), a.y * Math.cos(t0) + b.y * Math.sin(t0), a.z * Math.cos(t0) + b.z * Math.sin(t0)];
    const n1 = [a.x * Math.cos(t1) + b.x * Math.sin(t1), a.y * Math.cos(t1) + b.y * Math.sin(t1), a.z * Math.cos(t1) + b.z * Math.sin(t1)];
    const q00 = [p0[0] + n0[0] * r0, p0[1] + n0[1] * r0, p0[2] + n0[2] * r0];
    const q01 = [p1[0] + n0[0] * r1, p1[1] + n0[1] * r1, p1[2] + n0[2] * r1];
    const q10 = [p0[0] + n1[0] * r0, p0[1] + n1[1] * r0, p0[2] + n1[2] * r0];
    const q11 = [p1[0] + n1[0] * r1, p1[1] + n1[1] * r1, p1[2] + n1[2] * r1];
    // wound so the outside faces outward for either handedness of (a, b)
    const flip = new THREE.Vector3().crossVectors(a, b).dot(ax) < 0;
    const U0 = i / seg, U1 = (i + 1) / seg;
    if (!flip) {
      mb.vert(q00, n0, U0, 0, col); mb.vert(q01, n0, U0, 1, col); mb.vert(q11, n1, U1, 1, col);
      mb.vert(q00, n0, U0, 0, col); mb.vert(q11, n1, U1, 1, col); mb.vert(q10, n1, U1, 0, col);
    } else {
      mb.vert(q00, n0, U0, 0, col); mb.vert(q11, n1, U1, 1, col); mb.vert(q01, n0, U0, 1, col);
      mb.vert(q00, n0, U0, 0, col); mb.vert(q10, n1, U1, 0, col); mb.vert(q11, n1, U1, 1, col);
    }
  }
}

function canopyLobe(mb, rnd, c, r, cards, size, colFn) {
  const v = new THREE.Vector3(), nOut = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (let i = 0; i < cards; i++) {
    // random direction, biased away from the underside
    do { v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01 || v.y / v.length() < -0.42);
    v.normalize();
    const rho = 0.52 + 0.48 * Math.sqrt(rnd());
    const px = c[0] + v.x * r[0] * rho, py = c[1] + v.y * r[1] * rho, pz = c[2] + v.z * r[2] * rho;
    nOut.copy(v);
    tmp.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
    t.crossVectors(nOut, tmp).normalize();
    b.crossVectors(nOut, t).normalize();
    const tilt = (rnd() - 0.5) * 1.9;
    b.multiplyScalar(Math.cos(tilt)).addScaledVector(nOut, Math.sin(tilt)).normalize();
    const s = size * (0.9 + 0.5 * rnd());
    const cell = Math.floor(rnd() * 4);
    const u0 = (cell % 2) * 0.5, v0 = Math.floor(cell / 2) * 0.5;
    const col = colFn(v.y * rho, rnd);
    const corner = (su, sv) => {
      const x = px + t.x * s * su + b.x * s * sv, y = py + t.y * s * su + b.y * s * sv, z = pz + t.z * s * su + b.z * s * sv;
      // "puffy" normal: from the lobe centre through the vertex, biased upward
      tmp.set((x - c[0]) / r[0], (y - c[1]) / r[1] + 0.35, (z - c[2]) / r[2]).normalize();
      return { p: [x, y, z], n: [tmp.x, tmp.y, tmp.z], u: u0 + (su * 0.5 + 0.5) * 0.5, v: v0 + (sv * 0.5 + 0.5) * 0.5 };
    };
    const A = corner(-1, -1), B = corner(1, -1), C = corner(1, 1), D = corner(-1, 1);
    for (const q of [A, B, C, A, C, D]) mb.vert(q.p, q.n, q.u, q.v, col);
  }
  // inner mass so the crown never looks hollow
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const pa = ico.attributes.position;
  const dark = colFn(-0.3, rnd).map((x) => x * 0.8);
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    mb.vert([c[0] + x * r[0] * 0.5, c[1] + y * r[1] * 0.5, c[2] + z * r[2] * 0.5], [x, y, z], 0.012, 0.988, dark);
  }
  ico.dispose();
}

// ------------------------------------------------------------------ species
function makeSpecies(leafTex, frondTex) {
  const species = [];
  const green = (base) => (h, rnd) => {
    const k = lerp(0.62, 1.12, (h + 1) * 0.5) * (0.82 + 0.3 * rnd());
    return [base[0] * k * (0.9 + 0.2 * rnd()), base[1] * k, base[2] * k * (0.85 + 0.3 * rnd())];
  };
  const leafMat = leafMaterial(leafTex, { base: 2.5, amp: 1.0, key: 'leaf' });
  const bark = barkMaterial(0x57493d);
  const barkGrey = barkMaterial(0x8b8478);

  // 0 — banyan / ficus: wide, heavy crown on a short stout trunk
  {
    const rnd = mulberry32(1);
    const trunk = new MB(), leaves = new MB();
    tube(trunk, [0, 0, 0], 0.62, [0, 1.2, 0], 0.42, 9, [1, 1, 1]);
    tube(trunk, [0, 1.2, 0], 0.42, [0.1, 3.4, 0], 0.34, 9, [1, 1, 1]);
    const lobes = [[0, 8.2, 0, 4.6, 3.2, 4.6, 40], [3.0, 6.9, 1.2, 3.4, 2.5, 3.4, 20], [-2.6, 7.0, -1.8, 3.5, 2.6, 3.5, 20], [-0.6, 6.8, 3.0, 3.2, 2.4, 3.2, 17], [0.8, 7.2, -3.0, 3.1, 2.4, 3.1, 17]];
    for (const l of lobes) {
      tube(trunk, [0.1, 3.2, 0], 0.26, [l[0] * 0.75, l[1] - l[4] * 0.55, l[2] * 0.75], 0.1, 6, [1, 1, 1]);
      canopyLobe(leaves, rnd, [l[0], l[1], l[2]], [l[3], l[4], l[5]], l[6], 1.75, green([0.26, 0.42, 0.13]));
    }
    species.push({ trunk, leaves, leafMat, bark, r: 0.55, h: 11.4, cr: 6.2, cy: 7.6 });
  }
  // 1 — medium broadleaf street tree
  {
    const rnd = mulberry32(2);
    const trunk = new MB(), leaves = new MB();
    tube(trunk, [0, 0, 0], 0.3, [0, 3.6, 0], 0.18, 8, [1, 1, 1]);
    const lobes = [[0, 6.6, 0, 3.0, 2.7, 3.0, 40], [1.5, 5.6, 0.6, 2.1, 1.8, 2.1, 16], [-1.3, 5.7, -0.9, 2.1, 1.8, 2.1, 16]];
    for (const l of lobes) {
      tube(trunk, [0, 3.4, 0], 0.15, [l[0] * 0.7, l[1] - l[4] * 0.5, l[2] * 0.7], 0.06, 5, [1, 1, 1]);
      canopyLobe(leaves, rnd, [l[0], l[1], l[2]], [l[3], l[4], l[5]], l[6], 1.35, green([0.3, 0.47, 0.14]));
    }
    species.push({ trunk, leaves, leafMat, bark, r: 0.28, h: 9.3, cr: 3.6, cy: 6.2 });
  }
  // 2 — royal palm
  {
    const rnd = mulberry32(3);
    const trunk = new MB(), leaves = new MB();
    tube(trunk, [0, 0, 0], 0.36, [0, 1.0, 0], 0.27, 10, [1, 1, 1]);
    tube(trunk, [0, 1.0, 0], 0.27, [0, 6.0, 0], 0.24, 10, [1, 1, 1]);
    tube(trunk, [0, 6.0, 0], 0.24, [0, 9.6, 0], 0.2, 10, [1, 1, 1]);
    tube(trunk, [0, 9.6, 0], 0.22, [0, 11.2, 0], 0.15, 10, [0.42, 0.75, 0.3]);     // green crownshaft
    const nF = 15;
    for (let i = 0; i < nF; i++) {
      const az = (i / nF) * Math.PI * 2 + rnd() * 0.35;
      const lift = 0.15 + rnd() * 0.95;         // initial elevation of the frond
      const L = 3.9 + rnd() * 1.1, W = 1.25;
      const seg = 6;
      const dir = [Math.cos(az), Math.sin(az)];
      const side = [-dir[1], dir[0]];
      let px = 0, py = 11.0, pz = 0, el = lift;
      let prev = null;
      for (let s = 0; s <= seg; s++) {
        const t = s / seg;
        const wHalf = W * 0.5;
        const up = [-Math.sin(el) * dir[0], Math.cos(el), -Math.sin(el) * dir[1]];
        const droop = 0.18;       // leaflets hang slightly: shallow inverted V
        const l = [px + side[0] * wHalf, py - droop * wHalf, pz + side[1] * wHalf];
        const r = [px - side[0] * wHalf, py - droop * wHalf, pz - side[1] * wHalf];
        const c = [px, py, pz];
        const k = lerp(1.0, 0.72, t) * (0.85 + 0.3 * rnd());
        const col = [0.3 * k, 0.5 * k, 0.15 * k];
        const cur = { l, r, c, up, t };
        if (prev) {
          const quad = (a, b, c2, d, ua, ub) => {
            const P = [a, b, c2, a, c2, d];
            const UV = [[ua, 1 - prev.t], [ub, 1 - prev.t], [ub, 1 - cur.t], [ua, 1 - prev.t], [ub, 1 - cur.t], [ua, 1 - cur.t]];
            const N = [prev.up, prev.up, cur.up, prev.up, cur.up, cur.up];
            for (let q = 0; q < 6; q++) leaves.vert(P[q], N[q], UV[q][0], UV[q][1], col);
          };
          quad(prev.l, prev.c, cur.c, cur.l, 0, 0.5);
          quad(prev.c, prev.r, cur.r, cur.c, 0.5, 1);
        }
        prev = cur;
        const step = L / seg;
        px += Math.cos(el) * dir[0] * step; py += Math.sin(el) * step; pz += Math.cos(el) * dir[1] * step;
        el -= 0.3 + 0.16 * t + (lift < 0.5 ? 0.06 : 0);
      }
    }
    const frondMat = leafMaterial(frondTex, { base: 9.5, amp: 2.2, key: 'frond' });
    species.push({ trunk, leaves, leafMat: frondMat, bark: barkGrey, r: 0.3, h: 13.5, cr: 3.6, cy: 11.0 });
  }
  // 3 — bougainvillea / bauhinia: small flowering tree
  {
    const rnd = mulberry32(4);
    const trunk = new MB(), leaves = new MB();
    tube(trunk, [0, 0, 0], 0.18, [0.1, 2.3, 0], 0.11, 7, [1, 1, 1]);
    const leafCol = green([0.28, 0.44, 0.14]);
    const mixCol = (h, r) => (r() < 0.5 ? [0.95 * (0.75 + 0.4 * r()), 0.16 + 0.12 * r(), 0.48 + 0.2 * r()] : leafCol(h, r));
    const lobes = [[0, 3.9, 0, 2.2, 1.7, 2.2, 34], [1.1, 3.3, 0.5, 1.4, 1.2, 1.4, 12], [-1.0, 3.4, -0.6, 1.4, 1.2, 1.4, 12]];
    for (const l of lobes) {
      tube(trunk, [0.1, 2.2, 0], 0.09, [l[0] * 0.7, l[1] - l[4] * 0.5, l[2] * 0.7], 0.04, 5, [1, 1, 1]);
      canopyLobe(leaves, rnd, [l[0], l[1], l[2]], [l[3], l[4], l[5]], l[6], 1.0, mixCol);
    }
    species.push({ trunk, leaves, leafMat, bark, r: 0.16, h: 5.6, cr: 2.6, cy: 3.8 });
  }
  // 4 — lychee: dense dark dome, the signature tree of the campus
  {
    const rnd = mulberry32(5);
    const trunk = new MB(), leaves = new MB();
    tube(trunk, [0, 0, 0], 0.4, [0, 1.9, 0], 0.27, 8, [1, 1, 1]);
    const lobes = [[0, 4.6, 0, 3.7, 2.6, 3.7, 52], [1.6, 3.9, 1.0, 2.4, 1.8, 2.4, 18], [-1.5, 3.9, -1.1, 2.4, 1.8, 2.4, 18]];
    for (const l of lobes) {
      tube(trunk, [0, 1.8, 0], 0.2, [l[0] * 0.7, l[1] - l[4] * 0.5, l[2] * 0.7], 0.07, 5, [1, 1, 1]);
      canopyLobe(leaves, rnd, [l[0], l[1], l[2]], [l[3], l[4], l[5]], l[6], 1.5, green([0.17, 0.32, 0.1]));
    }
    species.push({ trunk, leaves, leafMat, bark, r: 0.34, h: 7.2, cr: 4.2, cy: 4.4 });
  }
  return species;
}

// ------------------------------------------------------------------ public
export function buildVegetation(scene, data, q) {
  const species = makeSpecies(leafTexture(), frondTexture());
  const group = new THREE.Group();
  group.name = 'vegetation';
  const CELL = 220;
  const buckets = new Map();
  const trees = [];
  const rnd = mulberry32(2026);
  for (let i = 0; i < data.trees.length; i++) {
    const [x, z, ty, sc, rot] = data.trees[i];
    if (rnd() > q.treeFraction) continue;
    const sp = species[ty];
    trees.push({ x, z, r: sp.r * sc + 0.05, h: sp.h * sc, cr: sp.cr * sc, cy: sp.cy * sc });
    const key = `${ty}|${Math.floor(x / CELL)}|${Math.floor(z / CELL)}`;
    let b = buckets.get(key);
    if (!b) { b = { ty, list: [] }; buckets.set(key, b); }
    b.list.push([x, z, sc, rot]);
  }
  const geoCache = species.map((s, si) => {
    const full = shuffledLeaves(s.leaves, si === 2 ? 12 : 6, 1000 + si);
    const lod = (frac) => {
      const g = new THREE.BufferGeometry();
      for (const k in full.attributes) g.setAttribute(k, full.attributes[k]);
      const n = Math.floor((full.attributes.position.count * frac) / 6) * 6;
      g.setDrawRange(0, n);
      g.boundingSphere = full.boundingSphere;
      g.boundingBox = full.boundingBox;
      return g;
    };
    return { trunk: s.trunk.geometry(), leaves: [full, lod(si === 2 ? 0.6 : 0.42), lod(si === 2 ? 0.34 : 0.2)] };
  });
  const chunks = [];
  const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), col = new THREE.Color();
  const yAxis = new THREE.Vector3(0, 1, 0);
  for (const b of buckets.values()) {
    const sp = species[b.ty], geo = geoCache[b.ty];
    const n = b.list.length;
    const trunk = new THREE.InstancedMesh(geo.trunk, sp.bark, n);
    const leaves = new THREE.InstancedMesh(geo.leaves[0], sp.leafMat, n);
    let cx = 0, cz = 0;
    for (const t of b.list) { cx += t[0]; cz += t[1]; }
    chunks.push({ trunk, leaves, geo: geo.leaves, x: cx / n, z: cz / n, lod: 0 });
    for (let i = 0; i < n; i++) {
      const [x, z, sc, rot] = b.list[i];
      pos.set(x, 0, z);
      quat.setFromAxisAngle(yAxis, rot);
      scl.set(sc, sc * (0.92 + 0.16 * rnd()), sc);
      m4.compose(pos, quat, scl);
      trunk.setMatrixAt(i, m4);
      leaves.setMatrixAt(i, m4);
      const k = 0.82 + 0.36 * rnd();
      col.setRGB(k * (0.92 + 0.16 * rnd()), k, k * (0.9 + 0.2 * rnd()));
      leaves.setColorAt(i, col);
    }
    trunk.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    trunk.computeBoundingSphere();
    leaves.computeBoundingSphere();
    trunk.castShadow = q.treeShadows;
    leaves.castShadow = q.treeShadows;
    trunk.receiveShadow = true;
    leaves.receiveShadow = true;
    leaves.customDepthMaterial = sp.leafMat.userData.depth;
    group.add(trunk, leaves);
  }
  scene.add(group);

  // spatial hash for trunk collisions and web anchors
  const GC = 16;
  const grid = new Map();
  for (const t of trees) {
    const k = `${Math.floor(t.x / GC)}|${Math.floor(t.z / GC)}`;
    let a = grid.get(k);
    if (!a) { a = []; grid.set(k, a); }
    a.push(t);
  }
  const near = (x, z, radius, out) => {
    out.length = 0;
    const x0 = Math.floor((x - radius) / GC), x1 = Math.floor((x + radius) / GC);
    const z0 = Math.floor((z - radius) / GC), z1 = Math.floor((z + radius) / GC);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const a = grid.get(`${i}|${j}`);
      if (a) for (const t of a) out.push(t);
    }
    return out;
  };
  // level of detail: distant groves draw a fraction of their leaf cards and stop casting shadows
  const update = (cam) => {
    for (const c of chunks) {
      const d = Math.hypot(c.x - cam.x, c.z - cam.z) - 120;
      const lod = d < q.treeLod0 ? 0 : d < q.treeLod1 ? 1 : 2;
      if (lod !== c.lod) {
        c.lod = lod;
        c.leaves.geometry = c.geo[lod];
        const sh = q.treeShadows && lod < 2;
        c.leaves.castShadow = sh;
        c.trunk.castShadow = sh && lod < 1;
        c.trunk.visible = lod < 2 || d < q.treeLod1 * 1.6;
      }
    }
  };
  return { group, trees, near, update };
}

/** interleave the triangles (in blocks of `quadVerts` vertices) so every prefix samples the whole crown */
function shuffledLeaves(mb, blockTris, seed) {
  void blockTris;
  const g = mb.geometry();
  const n = g.attributes.position.count;
  const quads = Math.floor(n / 6);
  const order = [];
  for (let i = 0; i < quads; i++) order.push(i);
  const rnd = mulberry32(seed);
  for (let i = quads - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  for (const name in g.attributes) {
    const a = g.attributes[name];
    const src = a.array, dst = new Float32Array(src.length), sz = a.itemSize * 6;
    for (let i = 0; i < quads; i++) dst.set(src.subarray(order[i] * sz, order[i] * sz + sz), i * sz);
    if (quads * sz < src.length) dst.set(src.subarray(quads * sz), quads * sz);
    g.setAttribute(name, new THREE.BufferAttribute(dst, a.itemSize));
  }
  return g;
}
