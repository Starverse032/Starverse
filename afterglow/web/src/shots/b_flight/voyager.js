// b_flight/voyager.js — Voyager 1 for long take B (S07-a … S07-d).
// The model is v_voyager's (v1.3 S32): 3.66 m high-gain antenna (64 segments, ribs, subreflector on a
// tripod, feed), decagonal bus (crinkled gold MLI, black blankets, silver louvers), RTG truss with three
// finned cylinders, science boom with the scan platform, the 13 m magnetometer astromast, the PRA/PWS
// whips, the golden record. Changes for v2:
//   · body frame = world frame (dish axis +Z = towards the Earth, the way the real craft flies):
//     RTG boom to −X, science boom to +X, the magnetometer boom hangs down (−Y) so that it leaves the
//     frame at the bottom both in the front view (S07-a) and in the back view (S07-c);
//   · light: the sun is fixed in the world (yaw +125°, elevation +30°): no more "sun drawn at R";
//   · the three tiers of the screenplay: a faint cool fill (dark side 6–12 / 255, never black), the hard
//     weak sun on the lit faces (40–70), and a Fresnel rim term (3–4 px edges ≥ 40) — two rims: the
//     sun's (cold white) and, in S07-a, the warm one of the words still flowing beyond the craft;
//   · the golden record's glint is drawn by the caller (screen-space sprite at recordWorld()).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = h => new THREE.Color(s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255));
const Yax = new THREE.Vector3(0, 1, 0);

function rod(a, b, r, seg = 6, r2 = r) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r2, r, L, seg, 1, false);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Yax, d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
function boxAt(c, sx, sy, sz, dir = new THREE.Vector3(0, 0, 1), roll = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (roll) g.rotateZ(roll);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()));
  g.translate(c.x, c.y, c.z);
  return g;
}
const merge = gs => mergeGeometries(gs.map(g => (g.index ? g.toNonIndexed() : g)));
function truss(a, b, rad, rl, rb, bay) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize();
  const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? Yax : new THREE.Vector3(1, 0, 0)).normalize();
  const w = new THREE.Vector3().crossVectors(d, u);
  const corner = (k, s) => a.clone().addScaledVector(d, s).addScaledVector(u, rad * Math.cos(k * 2.0944)).addScaledVector(w, rad * Math.sin(k * 2.0944));
  const gs = [];
  for (let k = 0; k < 3; k++) gs.push(rod(corner(k, 0), corner(k, L), rl, 5));
  const n = Math.max(1, Math.round(L / bay));
  for (let i = 0; i < n; i++) {
    const s0 = L * i / n, s1 = L * (i + 1) / n;
    for (let k = 0; k < 3; k++) gs.push(rod(corner(k, s0), corner((k + 1) % 3, s1), rb, 4));
  }
  return merge(gs);
}

// shared rim / fill uniforms, injected into every standard material
export const RIM = {
  uRimDir1: { value: new THREE.Vector3(0, 0, 1) }, uRimCol1: { value: new THREE.Vector3() },
  uRimDir2: { value: new THREE.Vector3(0, 0, 1) }, uRimCol2: { value: new THREE.Vector3() },
  uRimPow: { value: 2.2 }, uFill: { value: new THREE.Vector3() },
};
function withRim(mat) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, RIM);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform vec3 uRimDir1, uRimCol1, uRimDir2, uRimCol2, uFill; uniform float uRimPow;\nvoid main() {`)
      .replace('#include <opaque_fragment>', /* glsl */ `
        {
          // view-space normal (front-facing) and direction to the eye
          vec3 Nv = normalize(normal), Vv = normalize(vViewPosition);
          float nv = clamp(dot(Nv, Vv), 0.0, 1.0);
          float fres = pow(1.0 - nv, uRimPow);
          vec3 alb = diffuseColor.rgb + 0.35 * (1.0 - diffuseColor.rgb) * metalnessFactor;
          // rim 1: the sun (cold white), only on edges that turn towards it
          outgoingLight += uRimCol1 * fres * smoothstep(-0.05, 0.45, dot(Nv, uRimDir1)) * (0.35 + 0.65 * alb);
          // rim 2: the words beyond the craft (amber), edges that turn away from the lens towards them
          outgoingLight += uRimCol2 * fres * smoothstep(-0.10, 0.55, dot(Nv, uRimDir2)) * (0.4 + 0.6 * alb);
          // fill: faint scattered starlight — the dark side is never black
          outgoingLight += uFill * alb * (0.55 + 0.45 * nv);
        }
        #include <opaque_fragment>`);
  };
  return mat;
}

export async function createVoyager(ctx, { attitude = new THREE.Quaternion(), recordToward = null } = {}) {
  const { renderer, kit } = ctx;

  const crinkleH = kit.bake(renderer, {
    w: 1024, h: 1024, frag: /* glsl */ `
      void main(){
        vec2 p = vUv * vec2(9.0, 7.0);
        float h = 0.55 * ridged(vec3(p * vec2(1.0, 0.55), 1.3), 4) + 0.35 * ridged(vec3(p.yx * vec2(1.6, 0.7) + 4.0, 7.1), 4)
                + 0.18 * fbm(vec3(p * 3.0, 2.0), 3);
        gl_FragColor = vec4(h, h, h, 1.0);
      }` });
  const crinkle = kit.bake(renderer, {
    w: 1024, h: 1024, uniforms: { tex: { value: crinkleH } }, frag: /* glsl */ `
      uniform sampler2D tex;
      void main(){
        float e = 1.0 / 1024.0;
        float hx = texture2D(tex, vUv + vec2(e, 0.0)).r - texture2D(tex, vUv - vec2(e, 0.0)).r;
        float hy = texture2D(tex, vUv + vec2(0.0, e)).r - texture2D(tex, vUv - vec2(0.0, e)).r;
        vec3 n = normalize(vec3(-hx * 9.0, -hy * 9.0, 1.0));
        gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
      }` });
  crinkle.wrapS = crinkle.wrapT = THREE.RepeatWrapping;
  const louverN = kit.bake(renderer, {
    w: 256, h: 256, frag: /* glsl */ `
      void main(){ float x = fract(vUv.y * 8.0); float s = sin(x * 6.2831853);
        vec3 n = normalize(vec3(0.0, s * 0.9, 1.0)); gl_FragColor = vec4(n * 0.5 + 0.5, 1.0); }` });
  const dishMap = kit.bake(renderer, {
    w: 1024, h: 512, float: false, frag: /* glsl */ `
      void main(){
        float u = vUv.x * 16.0, v = vUv.y;
        float seam = 1.0 - 0.12 * smoothstep(0.94, 0.99, abs(fract(u) - 0.5) * 2.0);
        float ring = 1.0 - 0.08 * (1.0 - smoothstep(0.0, 0.006, abs(v - 0.42))) - 0.08 * (1.0 - smoothstep(0.0, 0.005, abs(v - 0.78)));
        float paint = 0.96 + 0.06 * fbm(vec3(vUv * vec2(24.0, 10.0), 3.0), 4);
        gl_FragColor = vec4(vec3(clamp(seam * ring * paint, 0.0, 1.0)), 1.0);
      }` });
  dishMap.colorSpace = THREE.NoColorSpace;

  const S = (o) => withRim(new THREE.MeshStandardMaterial(o));
  const M = {
    dishFront: S({ color: lin(0xE9E6DF), map: dishMap, roughness: 0.62, metalness: 0.0, side: THREE.BackSide }),
    dishBack: S({ color: lin(0xB9B6B0), roughness: 0.7, metalness: 0.0 }),
    sub: S({ color: lin(0xDAD7D0), roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide }),
    white: S({ color: lin(0xDAD7D0), roughness: 0.6, metalness: 0.0 }),
    struct: S({ color: lin(0xB0AEAA), roughness: 0.45, metalness: 0.35 }),
    dark: S({ color: lin(0x3C3D40), roughness: 0.55, metalness: 0.1 }),
    black: S({ color: lin(0x26262A), roughness: 0.32, metalness: 0.0, normalMap: crinkle, normalScale: new THREE.Vector2(0.6, 0.6) }),
    gold: S({ color: lin(0xD9A44E), roughness: 0.25, metalness: 0.75, normalMap: crinkle, normalScale: new THREE.Vector2(1.6, 1.6) }),
    silver: S({ color: lin(0xD0D2D6), roughness: 0.25, metalness: 1.0, normalMap: louverN, normalScale: new THREE.Vector2(1, 1) }),
    rtg: S({ color: lin(0x7A7570), roughness: 0.5, metalness: 0.3 }),
    lens: S({ color: lin(0x050506), roughness: 0.15, metalness: 0.0 }),
    record: S({ color: lin(0xE8B04A), roughness: 0.38, metalness: 1.0 }),
  };

  const body = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; body.add(m); return m; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---- high-gain antenna (bowl opens towards +Z) -------------------------------------------------------
  const DR = 1.83, FOC = 1.25, Z_DISH = 0.12;
  const zPar = r => Z_DISH + r * r / (4 * FOC);
  {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const r = DR * Math.pow(i / 40, 0.85); pts.push(new THREE.Vector2(Math.max(r, 0.001), zPar(r))); }
    const lathe = new THREE.LatheGeometry(pts, 96);
    lathe.rotateX(Math.PI / 2);
    add(lathe, M.dishFront);
    add(lathe, M.dishBack);
    const rim = new THREE.TorusGeometry(DR, 0.05, 10, 192); rim.translate(0, 0, zPar(DR));
    add(rim, M.white);
    const ribs = [];
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, c = Math.cos(a), s = Math.sin(a);
      for (let i = 0; i < 6; i++) {
        const r0 = 0.25 + (DR - 0.3) * i / 6, r1 = 0.25 + (DR - 0.3) * (i + 1) / 6;
        ribs.push(rod(V(c * r0, s * r0, zPar(r0) - 0.05), V(c * r1, s * r1, zPar(r1) - 0.045), 0.022, 4));
      }
    }
    ribs.push(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 20).rotateX(Math.PI / 2).translate(0, 0, Z_DISH - 0.04));
    add(merge(ribs), M.struct);
    const zs = Z_DISH + FOC * 0.86;
    const sub = new THREE.SphereGeometry(0.62, 32, 6, 0, Math.PI * 2, 0, 0.42);
    sub.rotateX(-Math.PI / 2); sub.translate(0, 0, zs + 0.6);
    add(sub, M.sub);
    const tri = [];
    for (let k = 0; k < 3; k++) { const a = k * 2.0944 + 0.5; tri.push(rod(V(Math.cos(a) * 1.25, Math.sin(a) * 1.25, zPar(1.25) + 0.02), V(Math.cos(a) * 0.22, Math.sin(a) * 0.22, zs - 0.03), 0.02, 5)); }
    add(merge(tri), M.white);
    add(new THREE.CylinderGeometry(0.06, 0.13, 0.42, 16).rotateX(Math.PI / 2).translate(0, 0, Z_DISH + 0.2), M.white);
  }

  // ---- bus ---------------------------------------------------------------------------------------------
  const BR = 0.9, BZ0 = -0.52, BZ1 = -0.05, BZC = (BZ0 + BZ1) / 2, BH = BZ1 - BZ0;
  const faceN = k => { const a = (k + 0.5) * Math.PI / 5; return V(Math.cos(a), Math.sin(a), 0); };
  const apo = BR * Math.cos(Math.PI / 10), faceW = 2 * BR * Math.sin(Math.PI / 10);
  add(new THREE.CylinderGeometry(BR * 0.995, BR * 0.995, BH, 10, 1, false).rotateX(Math.PI / 2).rotateZ(Math.PI / 10).translate(0, 0, BZC), M.dark);
  // the record faces +X (towards the lens as it overtakes the craft on its right, f3456)
  // the record goes on the panel that faces the lens as it overtakes the craft (f3456): recordToward is
  // that direction in the body frame (the caller knows the path)
  let recordFace = 0;
  if (recordToward) { let best = -2; for (let k = 0; k < 10; k++) { const d = faceN(k).dot(recordToward); if (d > best) { best = d; recordFace = k; } } }
  const panelKinds = ['gold', 'black', 'gold', 'louver', 'black', 'gold', 'black', 'gold', 'louver', 'black'];
  for (let k = 0; k < 10; k++) {
    const n = faceN(k), c = n.clone().multiplyScalar(apo + 0.004).add(V(0, 0, BZC));
    const kind = panelKinds[k] === 'louver' && k !== recordFace ? 'louver' : panelKinds[k];
    const g = new THREE.PlaneGeometry(faceW * 0.97, BH * 0.94);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(V(0, 0, 1), n), V(0, 0, 1), n));
    g.translate(c.x, c.y, c.z);
    if (kind === 'louver') {
      add(g, M.dark);
      const sl = [];
      for (let i = 0; i < 8; i++) { const z = BZ0 + 0.06 + i * (BH - 0.12) / 7.0;
        const p = n.clone().multiplyScalar(apo + 0.02).add(V(0, 0, z));
        const b = new THREE.BoxGeometry(faceW * 0.8, 0.045, 0.006);
        b.rotateX(0.5);
        b.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(V(0, 0, 1), n), V(0, 0, 1), n));
        b.translate(p.x, p.y, p.z); sl.push(b); }
      add(merge(sl), M.silver);
    } else add(g, kind === 'gold' ? M.gold : M.black);
  }
  add(new THREE.CircleGeometry(BR * 0.97, 10).translate(0, 0, BZ1 + 0.003), M.black);
  add(new THREE.CircleGeometry(BR * 0.97, 10).rotateX(Math.PI).translate(0, 0, BZ0 - 0.003), M.gold);
  const recN = faceN(recordFace), recC = recN.clone().multiplyScalar(apo + 0.018).add(V(0, 0, BZC + 0.02));
  {
    const basisM = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(V(0, 0, 1), recN), V(0, 0, 1), recN);
    const disc = new THREE.CylinderGeometry(0.15, 0.15, 0.012, 48).rotateX(Math.PI / 2);
    disc.applyMatrix4(basisM); disc.translate(recC.x, recC.y, recC.z); add(disc, M.record);
    const ring = new THREE.TorusGeometry(0.155, 0.008, 6, 48);
    ring.applyMatrix4(basisM); ring.translate(recC.x, recC.y, recC.z); add(ring, M.struct);
  }

  // ---- RTG boom (to −X, a little up and back) -----------------------------------------------------------
  const rDir = V(-1, 0.14, -0.2).normalize();
  const rA = V(-0.86, 0.12, BZC), rB = rA.clone().addScaledVector(rDir, 2.7);
  add(truss(rA, rB, 0.075, 0.016, 0.009, 0.32), M.struct);
  {
    const d = rDir, fins = [], cans = [];
    for (let k = 0; k < 3; k++) {
      const s0 = 1.1 + k * 0.6, c = rA.clone().addScaledVector(d, s0 + 0.25);
      cans.push(rod(rA.clone().addScaledVector(d, s0), rA.clone().addScaledVector(d, s0 + 0.5), 0.21, 28));
      for (let j = 0; j < 6; j++) {
        const roll = j * Math.PI / 3 + 0.26;
        const u = new THREE.Vector3().crossVectors(d, Yax).normalize(), w = new THREE.Vector3().crossVectors(d, u);
        const rdir = u.clone().multiplyScalar(Math.cos(roll)).addScaledVector(w, Math.sin(roll));
        const g = new THREE.BoxGeometry(0.09, 0.01, 0.47);
        g.applyMatrix4(new THREE.Matrix4().makeBasis(rdir, new THREE.Vector3().crossVectors(d, rdir), d));
        const p = c.clone().addScaledVector(rdir, 0.21 + 0.043); g.translate(p.x, p.y, p.z);
        fins.push(g);
      }
      cans.push(rod(rA.clone().addScaledVector(d, s0 - 0.02), rA.clone().addScaledVector(d, s0 + 0.02), 0.23, 24));
      cans.push(rod(rA.clone().addScaledVector(d, s0 + 0.48), rA.clone().addScaledVector(d, s0 + 0.52), 0.23, 24));
    }
    add(merge(cans), M.rtg); add(merge(fins), M.rtg);
  }

  // ---- science boom (to +X, a little down and back) + scan platform -----------------------------------
  const sDir = V(1, -0.16, -0.12).normalize();
  const sA = V(0.84, -0.2, BZC), sB = sA.clone().addScaledVector(sDir, 2.0);
  add(truss(sA, sB, 0.085, 0.016, 0.009, 0.3), M.struct);
  {
    const at = s => sA.clone().addScaledVector(sDir, s);
    add(boxAt(at(0.55).add(V(0, 0.22, 0)), 0.34, 0.28, 0.3, sDir), M.gold);
    add(rod(at(1.05).add(V(0, -0.16, 0)), at(1.05).add(V(0, -0.16, 0.38)), 0.12, 18), M.white);
    add(boxAt(at(1.05).add(V(0, -0.16, 0.42)), 0.3, 0.3, 0.06, V(0, 0, 1)), M.black);
    add(rod(at(0.3).add(V(0, -0.18, 0)), at(0.3).add(V(0, -0.38, 0.12)), 0.09, 14, 0.16), M.white);
  }
  const plat = new THREE.Group();
  {
    const pm = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; plat.add(m); return m; };
    pm(new THREE.BoxGeometry(0.62, 0.38, 0.34), M.black);
    pm(new THREE.BoxGeometry(0.64, 0.02, 0.36).translate(0, 0.2, 0), M.gold);
    pm(new THREE.CylinderGeometry(0.095, 0.095, 0.95, 20).rotateX(Math.PI / 2).translate(0.12, 0.27, 0.32), M.white);
    pm(new THREE.CylinderGeometry(0.11, 0.1, 0.12, 20).rotateX(Math.PI / 2).translate(0.12, 0.27, 0.84), M.dark);
    pm(new THREE.CircleGeometry(0.085, 20).translate(0.12, 0.27, 0.905), M.lens);
    pm(new THREE.CylinderGeometry(0.075, 0.075, 0.52, 18).rotateX(Math.PI / 2).translate(-0.12, 0.25, 0.18), M.white);
    pm(new THREE.CircleGeometry(0.065, 18).translate(-0.12, 0.25, 0.445), M.lens);
    pm(new THREE.CylinderGeometry(0.25, 0.25, 0.42, 28).rotateX(Math.PI / 2).translate(0.0, -0.24, 0.26), M.gold);
    pm(new THREE.RingGeometry(0.06, 0.24, 28).translate(0, -0.24, 0.475), M.lens);
    pm(new THREE.BoxGeometry(0.16, 0.14, 0.4).translate(0.32, -0.05, 0.24), M.white);
    pm(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12).translate(0, -0.33, 0), M.struct);
  }
  const platMount = new THREE.Group(); platMount.position.copy(sB).addScaledVector(sDir, 0.22); body.add(platMount); platMount.add(plat);
  // the cameras look back along the flight path, a little off the dish axis (as on Valentine's Day 1990)
  plat.quaternion.setFromUnitVectors(V(0, 0, 1), V(-0.25, 0.1, 1).normalize());

  // ---- magnetometer boom: 13 m astromast hanging down (−Y), a little back ------------------------------
  const mDir = V(-0.16, -1, -0.12).normalize();
  const mA = V(0.25, -0.9, BZC - 0.1), mB = mA.clone().addScaledVector(mDir, 13);
  add(truss(mA, mB, 0.11, 0.013, 0.008, 0.36), M.struct);
  add(rod(mA.clone().addScaledVector(mDir, 6.45), mA.clone().addScaledVector(mDir, 6.75), 0.07, 12), M.white);
  add(rod(mA.clone().addScaledVector(mDir, 12.8), mB, 0.08, 12), M.white);
  add(boxAt(mA.clone().addScaledVector(mDir, -0.05), 0.3, 0.3, 0.2, mDir), M.black);
  // PRA/PWS whips: two 10 m antennas in a V, up and back
  {
    const base = V(-0.5, 0.72, BZ0 + 0.05);
    const w1 = V(-0.62, 0.72, -0.3).normalize(), w2 = V(-0.12, 0.9, -0.42).normalize();
    add(merge([rod(base, base.clone().addScaledVector(w1, 10), 0.012, 4, 0.006), rod(base, base.clone().addScaledVector(w2, 10), 0.012, 4, 0.006)]), M.struct);
  }
  add(new THREE.CylinderGeometry(0.36, 0.27, 0.24, 20).rotateX(Math.PI / 2).translate(0, 0, BZ0 - 0.12), M.white);
  add(new THREE.SphereGeometry(0.25, 20, 10).translate(0, 0, BZ0 - 0.26), M.white);
  {
    const th = [];
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, p = V(Math.cos(a) * 0.62, Math.sin(a) * 0.62, BZ0 - 0.06);
      th.push(rod(p, p.clone().add(V(0, 0, -0.14)), 0.035, 8, 0.06)); }
    add(merge(th), M.struct);
    const st = [];
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; st.push(rod(V(Math.cos(a) * 0.75, Math.sin(a) * 0.75, BZ1), V(Math.cos(a) * 0.35, Math.sin(a) * 0.35, Z_DISH - 0.06), 0.02, 5)); }
    add(merge(st), M.struct);
  }

  // ---- lights --------------------------------------------------------------------------------------------
  const sun = new THREE.DirectionalLight(lin(0xF4F6FF), 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 80;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.015;
  const root = new THREE.Group();
  body.quaternion.copy(attitude);
  root.add(body, sun, sun.target);

  // bounding points (for the screen-space checks: span, exit)
  const extents = [V(0, 0, zPar(DR)), V(DR, 0, zPar(DR)), V(-DR, 0, zPar(DR)), V(0, DR, zPar(DR)), V(0, -DR, zPar(DR)), rB, sB, mB, mA.clone().addScaledVector(mDir, 6.6)];

  return {
    root, body, sun, materials: M, extents,
    recordLocal: recC.clone(), recordNormal: recN.clone(),
    // world position of the record and whether it faces a lens at `eye`
    record(eye) { const p = recC.clone().applyMatrix4(body.matrixWorld); const n = recN.clone().transformDirection(body.matrixWorld); return { p, facing: n.dot(eye.clone().sub(p).normalize()) }; },
  };
}
