// v_voyager — S32 回望 (148.0 → 154.0, f3552–3695).
//
// Voyager 1, 40 AU out, alone in black. 85 mm, a linear 5 % push-in over the shot. The craft sits on the
// right third (bus near (1300, 560)); the Sun is a bright point at R (HDR 20, small glow, no disc).
// 149.0–152.0 the spacecraft yaws 32° (easeInOutSine — the probe turns, not the camera): its dish swings
// from facing us towards the Sun's side and fills with light. 150.0–152.5 the scan platform turns 40°
// and ends with its cameras pointing exactly at R (the next shot is what they see). 152.0 the golden
// record catches the Sun: one highlight (HDR 12, 6 frames, a small halo) — the letter humans wrote.
//
// Model (metres, body frame: +Z = dish axis, +X = science boom, −X = RTG boom):
//   high-gain antenna — 3.66 m paraboloid (f = 1.25 m), 64 segments, white front / grey back with
//                       radial ribs, rim ring, Cassegrain subreflector on a tripod, feed horn;
//   bus               — decagonal prism (0.9 m), panels of crinkled gold MLI, black blankets and two
//                       bays of silver thermal louvers; propellant-tank blanket and thrusters below;
//   RTG boom          — triangular truss with three finned RTG cylinders;
//   science boom      — truss, instrument boxes, scan platform (NA/WA cameras, IRIS, UVS);
//   magnetometer boom — 13 m triangular astromast (it leaves frame right), sensors at 6.5 m and 13 m;
//   PRA/PWS whips     — two 10 m antennas in a V;
//   golden record     — 0.30 m GOLD disc on the bus panel that faces us.
// Light: one hard, warm-white, weak directional sun, no fill: shadows are pure black (shadow map).
// Lighting cheat (see report): the Sun is drawn at R, 7° from the craft as seen by the lens — physically
// that is near-total backlight, which would leave the craft an invisible silhouette on black. The key
// comes from the R side of the frame (screen left, slightly behind the craft) instead: on screen the light
// visibly comes from the point at R.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const T0 = 148.0;
const YAW0 = 149.0, YAW1 = 152.0, YAW_DEG = 32;
const PL0 = 150.0, PL1 = 152.5, PL_DEG = 40;
const T_GLINT = 152.0;
const RX = 734.5, RY = 540.5;
const F85 = 960 * 85 / 18;                    // 1080p focal length in px (36 mm gauge)
const BUS_PX = [1290, 566];                   // bus centre on screen at 148.0
const DIST = 56;                              // camera → bus at 148.0 (m) → ≈ 69 px per metre
const PUSH = 1 - 1 / 1.05;                    // 5 % larger by 154.0 (linear dolly)

const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = h => new THREE.Color(s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const inOutSine = u => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u));
const dirOf = (px, py, F) => new THREE.Vector3((px - 960) / F, -(py - 540) / F, -1).normalize();

// ---- small geometry helpers -------------------------------------------------------------------------
const Y = new THREE.Vector3(0, 1, 0);
// a cylinder from a to b (radius r), as a geometry in the parent's frame
function rod(a, b, r, seg = 6, r2 = r) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r2, r, L, seg, 1, false);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
// a box of size (sx, sy, sz) whose local +z points along `dir`, centred at c, rolled by `roll`
function boxAt(c, sx, sy, sz, dir = new THREE.Vector3(0, 0, 1), roll = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (roll) g.rotateZ(roll);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()));
  g.translate(c.x, c.y, c.z);
  return g;
}
const merge = gs => mergeGeometries(gs.map(g => (g.index ? g.toNonIndexed() : g)));
// a triangular truss from a to b: three longerons + zig-zag battens (merged)
function truss(a, b, rad, rl, rb, bay) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize();
  const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? Y : new THREE.Vector3(1, 0, 0)).normalize();
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

export async function create(ctx) {
  const { renderer, W, H, kit } = ctx;
  const S = H / 1080;

  // ---- baked surface detail: crinkled multi-layer insulation (normal map) ------------------------------
  const crinkleH = kit.bake(renderer, {
    w: 1024, h: 1024, frag: /* glsl */ `
      void main(){
        vec2 p = vUv * vec2(9.0, 7.0);
        // folds: ridged noise stretched along random directions, plus fine crumple
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
  // louvers / ribs: a fine stripe normal map for the thermal louver blades
  const louverN = kit.bake(renderer, {
    w: 256, h: 256, frag: /* glsl */ `
      void main(){ float x = fract(vUv.y * 8.0); float s = sin(x * 6.2831853);
        vec3 n = normalize(vec3(0.0, s * 0.9, 1.0)); gl_FragColor = vec4(n * 0.5 + 0.5, 1.0); }` });

  // dish front: honeycomb gores (16 panels, faint seams), two ring joints, a little uneven paint
  const dishMap = kit.bake(renderer, {
    w: 1024, h: 512, float: false, frag: /* glsl */ `
      void main(){
        float u = vUv.x * 16.0, v = vUv.y;
        float seam = 1.0 - 0.12 * smoothstep(0.94, 0.99, abs(fract(u) - 0.5) * 2.0);
        float ring = 1.0 - 0.08 * (1.0 - smoothstep(0.0, 0.006, abs(v - 0.42))) - 0.08 * (1.0 - smoothstep(0.0, 0.005, abs(v - 0.78)));
        float paint = 0.96 + 0.06 * fbm(vec3(vUv * vec2(24.0, 10.0), 3.0), 4);
        float a = clamp(seam * ring * paint, 0.0, 1.0);
        gl_FragColor = vec4(vec3(a), 1.0);
      }` });
  dishMap.colorSpace = THREE.NoColorSpace;
  // ---- materials -------------------------------------------------------------------------------------
  const M = {
    // (lathe front faces are the convex outside → the concave interior is the BackSide)
    dishFront: new THREE.MeshStandardMaterial({ color: lin(0xE9E6DF), map: dishMap, roughness: 0.62, metalness: 0.0, side: THREE.BackSide }),
    dishBack: new THREE.MeshStandardMaterial({ color: lin(0xB9B6B0), roughness: 0.7, metalness: 0.0 }),
    sub: new THREE.MeshStandardMaterial({ color: lin(0xDAD7D0), roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide }),
    white: new THREE.MeshStandardMaterial({ color: lin(0xDAD7D0), roughness: 0.6, metalness: 0.0 }),
    struct: new THREE.MeshStandardMaterial({ color: lin(0xB0AEAA), roughness: 0.45, metalness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: lin(0x3C3D40), roughness: 0.55, metalness: 0.1 }),
    black: new THREE.MeshStandardMaterial({ color: lin(0x1C1C1F), roughness: 0.32, metalness: 0.0, normalMap: crinkle, normalScale: new THREE.Vector2(0.6, 0.6) }),
    gold: new THREE.MeshStandardMaterial({ color: lin(0xD9A44E), roughness: 0.22, metalness: 0.75, normalMap: crinkle, normalScale: new THREE.Vector2(1.6, 1.6) }),
    silver: new THREE.MeshStandardMaterial({ color: lin(0xD0D2D6), roughness: 0.22, metalness: 1.0, normalMap: louverN, normalScale: new THREE.Vector2(1, 1) }),
    rtg: new THREE.MeshStandardMaterial({ color: lin(0x7A7570), roughness: 0.5, metalness: 0.3 }),
    lens: new THREE.MeshStandardMaterial({ color: lin(0x050506), roughness: 0.15, metalness: 0.0 }),
    record: new THREE.MeshStandardMaterial({ color: lin(0xE8B04A), roughness: 0.38, metalness: 1.0, emissive: lin(0xE8B04A), emissiveIntensity: 0 }),
  };
  M.gold.normalMap.repeat.set(1, 1);

  const body = new THREE.Group();            // the spacecraft (body frame)
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; body.add(m); return m; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---- high-gain antenna ------------------------------------------------------------------------------
  const DR = 1.83, FOC = 1.25, Z_DISH = 0.12;
  const zPar = r => Z_DISH + r * r / (4 * FOC);
  {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const r = DR * Math.pow(i / 40, 0.85); pts.push(new THREE.Vector2(Math.max(r, 0.001), zPar(r))); }
    const lathe = new THREE.LatheGeometry(pts, 64);
    lathe.rotateX(Math.PI / 2);              // lathe axis Y → body Z (the bowl opens towards +Z)
    add(lathe, M.dishFront);
    add(lathe, M.dishBack);
    // rim ring
    const rim = new THREE.TorusGeometry(DR, 0.028, 6, 96); rim.translate(0, 0, zPar(DR));
    add(rim, M.white);
    // back ribs (following the paraboloid, a little behind it) + central hub
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
    // subreflector (convex, facing the dish) on a tripod + feed horn
    const zs = Z_DISH + FOC * 0.86;
    const sub = new THREE.SphereGeometry(0.62, 32, 6, 0, Math.PI * 2, 0, 0.42); // a shallow cap
    sub.rotateX(-Math.PI / 2); sub.translate(0, 0, zs + 0.6);
    add(sub, M.sub);
    const tri = [];
    for (let k = 0; k < 3; k++) { const a = k * 2.0944 + 0.5; tri.push(rod(V(Math.cos(a) * 1.25, Math.sin(a) * 1.25, zPar(1.25) + 0.02), V(Math.cos(a) * 0.22, Math.sin(a) * 0.22, zs - 0.03), 0.018, 5)); }
    add(merge(tri), M.white);
    add(new THREE.CylinderGeometry(0.06, 0.13, 0.42, 16).rotateX(Math.PI / 2).translate(0, 0, Z_DISH + 0.2), M.white);
  }

  // ---- bus ---------------------------------------------------------------------------------------------
  const BR = 0.9, BZ0 = -0.52, BZ1 = -0.05, BZC = (BZ0 + BZ1) / 2, BH = BZ1 - BZ0;
  const faceN = k => { const a = (k + 0.5) * Math.PI / 5; return V(Math.cos(a), Math.sin(a), 0); };
  const apo = BR * Math.cos(Math.PI / 10), faceW = 2 * BR * Math.sin(Math.PI / 10);
  add(new THREE.CylinderGeometry(BR * 0.995, BR * 0.995, BH, 10, 1, false).rotateX(Math.PI / 2).rotateZ(Math.PI / 10).translate(0, 0, BZC), M.dark);
  // which panel faces the camera at the end (computed below, once the orientation is known)
  let recordFace = 7;
  const panelKinds = ['gold', 'black', 'gold', 'louver', 'black', 'gold', 'black', 'gold', 'louver', 'black'];
  const panels = [];
  // (built after the orientation so the record panel can be chosen; see buildBus())

  // ---- RTG boom ----------------------------------------------------------------------------------------
  // (booms leave the bus in a V towards the lens / away from it, so the bus's own shadow does not swallow them)
  const rA = V(-0.735, 0.436, BZC), rB = rA.clone().addScaledVector(V(-0.85, 0.5, -0.2).normalize(), 2.6);
  add(truss(rA, rB, 0.075, 0.016, 0.009, 0.32), M.struct);
  {
    const d = new THREE.Vector3().subVectors(rB, rA).normalize();
    const L = rA.distanceTo(rB);
    const fins = [], cans = [];
    for (let k = 0; k < 3; k++) {
      const s0 = 1.05 + k * 0.6, c = rA.clone().addScaledVector(d, s0 + 0.25);
      cans.push(rod(rA.clone().addScaledVector(d, s0), rA.clone().addScaledVector(d, s0 + 0.5), 0.21, 28));
      for (let j = 0; j < 6; j++) {
        const roll = j * Math.PI / 3 + 0.26;
        const u = new THREE.Vector3().crossVectors(d, Y).normalize(), w = new THREE.Vector3().crossVectors(d, u);
        const rdir = u.clone().multiplyScalar(Math.cos(roll)).addScaledVector(w, Math.sin(roll));
        const g = new THREE.BoxGeometry(0.09, 0.01, 0.47);
        const m = new THREE.Matrix4().makeBasis(rdir, new THREE.Vector3().crossVectors(d, rdir), d);
        g.applyMatrix4(m); const p = c.clone().addScaledVector(rdir, 0.21 + 0.043); g.translate(p.x, p.y, p.z);
        fins.push(g);
      }
      // end flanges
      cans.push(rod(rA.clone().addScaledVector(d, s0 - 0.02), rA.clone().addScaledVector(d, s0 + 0.02), 0.23, 24));
      cans.push(rod(rA.clone().addScaledVector(d, s0 + 0.48), rA.clone().addScaledVector(d, s0 + 0.52), 0.23, 24));
    }
    add(merge(cans), M.rtg); add(merge(fins), M.rtg);
    void L;
  }

  // ---- science boom + scan platform -------------------------------------------------------------------
  const sA = V(0.68, -0.51, BZC), sB = sA.clone().addScaledVector(V(0.8, -0.6, -0.1).normalize(), 1.9);
  add(truss(sA, sB, 0.085, 0.016, 0.009, 0.3), M.struct);
  {
    const d = new THREE.Vector3().subVectors(sB, sA).normalize();
    const at = s => sA.clone().addScaledVector(d, s);
    add(boxAt(at(0.55).add(V(0, 0.2, 0)), 0.34, 0.28, 0.3, d), M.gold);            // cosmic-ray subsystem
    add(rod(at(1.05).add(V(0, -0.16, 0)), at(1.05).add(V(0, -0.16, 0.38)), 0.12, 18), M.white);   // LECP canister
    add(boxAt(at(1.05).add(V(0, -0.16, 0.42)), 0.3, 0.3, 0.06, V(0, 0, 1)), M.black);
    add(rod(at(0.3).add(V(0, -0.18, 0)), at(0.3).add(V(0, -0.38, 0.12)), 0.09, 14, 0.16), M.white);   // plasma cup
  }
  const plat = new THREE.Group();            // scan platform (its local +Z = boresight)
  {
    const pm = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; plat.add(m); return m; };
    pm(new THREE.BoxGeometry(0.62, 0.38, 0.34), M.black);
    pm(new THREE.BoxGeometry(0.64, 0.02, 0.36).translate(0, 0.2, 0), M.gold);
    // narrow-angle camera (long), wide-angle camera, IRIS, UVS
    pm(new THREE.CylinderGeometry(0.095, 0.095, 0.95, 20).rotateX(Math.PI / 2).translate(0.12, 0.27, 0.32), M.white);
    pm(new THREE.CylinderGeometry(0.11, 0.1, 0.12, 20).rotateX(Math.PI / 2).translate(0.12, 0.27, 0.84), M.dark);
    pm(new THREE.CircleGeometry(0.085, 20).translate(0, 0, 0).translate(0.12, 0.27, 0.905), M.lens);
    pm(new THREE.CylinderGeometry(0.075, 0.075, 0.52, 18).rotateX(Math.PI / 2).translate(-0.12, 0.25, 0.18), M.white);
    pm(new THREE.CircleGeometry(0.065, 18).translate(-0.12, 0.25, 0.445), M.lens);
    pm(new THREE.CylinderGeometry(0.25, 0.25, 0.42, 28).rotateX(Math.PI / 2).translate(0.0, -0.24, 0.26), M.gold);
    pm(new THREE.RingGeometry(0.06, 0.24, 28).translate(0, -0.24, 0.475), M.lens);
    pm(new THREE.BoxGeometry(0.16, 0.14, 0.4).translate(0.32, -0.05, 0.24), M.white);
    // azimuth post
    pm(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12).translate(0, -0.33, 0), M.struct);
  }
  const platMount = new THREE.Group(); platMount.position.copy(sB).addScaledVector(V(0.8, -0.6, -0.1).normalize(), 0.22); body.add(platMount); platMount.add(plat);

  // ---- magnetometer boom (13 m astromast) and PRA/PWS whips -------------------------------------------
  const mA = V(0.82, 0.3, BZC - 0.1);
  const mDir = V(0.88, -0.38, -0.22).normalize(), mB = mA.clone().addScaledVector(mDir, 13);
  add(truss(mA, mB, 0.11, 0.013, 0.008, 0.36), M.struct);
  add(rod(mA.clone().addScaledVector(mDir, 6.45), mA.clone().addScaledVector(mDir, 6.75), 0.07, 12), M.white);
  add(rod(mA.clone().addScaledVector(mDir, 12.8), mB, 0.08, 12), M.white);
  add(boxAt(mA.clone().addScaledVector(mDir, -0.05), 0.3, 0.3, 0.2, mDir), M.black);   // canister
  {
    const base = V(-0.45, -0.75, BZ0 + 0.05);
    const w1 = V(-0.55, 0.75, -0.35).normalize(), w2 = V(0.2, 0.85, -0.45).normalize();   // (+Y = away from the lens)
    add(merge([rod(base, base.clone().addScaledVector(w1, 10), 0.009, 4, 0.005), rod(base, base.clone().addScaledVector(w2, 10), 0.009, 4, 0.005)]), M.struct);
  }
  // under the bus: propellant-tank blanket, thruster clusters
  add(new THREE.CylinderGeometry(0.36, 0.27, 0.24, 20).rotateX(Math.PI / 2).translate(0, 0, BZ0 - 0.12), M.white);
  add(new THREE.SphereGeometry(0.25, 20, 10).translate(0, 0, BZ0 - 0.26), M.white);
  {
    const th = [];
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, p = V(Math.cos(a) * 0.62, Math.sin(a) * 0.62, BZ0 - 0.06);
      th.push(rod(p, p.clone().add(V(0, 0, -0.14)), 0.035, 8, 0.06)); }
    add(merge(th), M.struct);
  }
  // dish support struts (bus top → dish back hub)
  {
    const st = [];
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; st.push(rod(V(Math.cos(a) * 0.75, Math.sin(a) * 0.75, BZ1), V(Math.cos(a) * 0.35, Math.sin(a) * 0.35, Z_DISH - 0.06), 0.02, 5)); }
    add(merge(st), M.struct);
  }

  // =====================================================================================================
  // orientation (world = the camera frame at 148.0; the camera only dollies along −Z)
  // =====================================================================================================
  const busW = dirOf(BUS_PX[0], BUS_PX[1], F85); busW.multiplyScalar(DIST / -busW.z);
  const SUN = dirOf(RX, RY, F85);                                  // direction of R (at infinity)
  // key light: from the R side of the frame (left), a little above and a little behind the craft
  const KEY = new THREE.Vector3(-0.86, 0.18, 0.3).normalize();
  // final dish axis: up, towards the Sun's side, a little towards us; booms ⊥ to it
  const A_f = new THREE.Vector3(-0.12, 0.97, 0.2).normalize();
  const X_f = new THREE.Vector3(1, 0, 0).addScaledVector(A_f, -A_f.x).normalize();   // screen-right ⊥ A
  const Y_f = new THREE.Vector3().crossVectors(A_f, X_f).normalize();
  const qF = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X_f, Y_f, A_f));
  const qYaw = new THREE.Quaternion();
  const orient = t => { const e = inOutSine((t - YAW0) / (YAW1 - YAW0)); qYaw.setFromAxisAngle(Y, (YAW_DEG * Math.PI / 180) * (1 - e)); return qYaw.clone().multiply(qF); };

  // the bus panels — the golden record goes on the panel whose normal is nearest the camera at the end
  {
    const toCam = busW.clone().negate().normalize();
    let best = -2;
    for (let k = 0; k < 10; k++) { const n = faceN(k).applyQuaternion(qF); const d = n.dot(toCam) + 0.6 * n.dot(KEY); if (d > best && panelKinds[k] !== 'louver') { best = d; recordFace = k; } }
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
      panels.push(g);
    }
    // top & bottom blankets
    add(new THREE.CircleGeometry(BR * 0.97, 10).translate(0, 0, BZ1 + 0.003), M.black);
    add(new THREE.CircleGeometry(BR * 0.97, 10).rotateX(Math.PI).translate(0, 0, BZ0 - 0.003), M.gold);
  }
  // the golden record (in its cover) on that panel
  const recN = faceN(recordFace), recC = recN.clone().multiplyScalar(apo + 0.018).add(V(0, 0, BZC + 0.02));
  {
    const disc = new THREE.CylinderGeometry(0.15, 0.15, 0.012, 48).rotateX(Math.PI / 2);
    disc.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(V(0, 0, 1), recN), V(0, 0, 1), recN));
    disc.translate(recC.x, recC.y, recC.z);
    add(disc, M.record);
    const ring = new THREE.TorusGeometry(0.155, 0.008, 6, 48);
    ring.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(V(0, 0, 1), recN), V(0, 0, 1), recN));
    ring.translate(recC.x, recC.y, recC.z); add(ring, M.struct);
  }

  // scan platform: its boresight must end on R: in the final body frame, P_b = qF⁻¹ · SUN
  const qFi = qF.clone().invert();
  const Pb = SUN.clone().applyQuaternion(qFi);
  const qPlatF = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), Pb);
  const qPl = new THREE.Quaternion();
  const platOrient = t => { const e = inOutSine((t - PL0) / (PL1 - PL0)); qPl.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(PL_DEG * Math.PI / 180) * (1 - e)); return qPl.clone().multiply(qPlatF); };

  // ---- scene, light, camera ----------------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.add(body);
  const key = new THREE.DirectionalLight(lin(0xFFF3E2), 3.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -5; sc.near = 1; sc.far = 60;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.012;
  scene.add(key, key.target);
  const cam = kit.filmCamera(W, H, { focalMM: 85, near: 2, far: 200 });

  // the Sun at R and the record's glint: screen-space sprites (additive, exact pixel centres)
  const spriteU = { uR: { value: 90 }, uC: { value: new THREE.Vector2(RX, RY) }, uS: { value: S }, uI: { value: 20 }, uCore: { value: 0.9 }, uGlow: { value: 0.006 },
    uGlowR: { value: 7 }, uCol: { value: new THREE.Vector3(1.0, 0.96, 0.9) }, uH: { value: H } };
  const spriteMat = U => new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    // only a small box around the centre is drawn (uR px at 1080p)
    vertexShader: /* glsl */ `uniform vec2 uC; uniform float uR, uH, uS;
      void main(){ vec2 c = vec2(uC.x / 960.0 - 1.0, 1.0 - uC.y / 540.0); gl_Position = vec4(c + position.xy * vec2(uR / 960.0, uR / 540.0), 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec2 uC; uniform float uS, uI, uCore, uGlow, uGlowR, uH, uR; uniform vec3 uCol;
      void main(){
        vec2 p = vec2(gl_FragCoord.x, uH - gl_FragCoord.y) / uS;      // 1080p px, top-down
        float r = length(p - uC);
        float core = exp(-0.5 * r * r / (uCore * uCore));
        float glow = uGlow * exp(-r / uGlowR) + 0.25 * uGlow * exp(-r / (uGlowR * 5.0));
        float edge = 1.0 - smoothstep(0.7 * uR, uR, max(abs(p.x - uC.x), abs(p.y - uC.y)));
        gl_FragColor = vec4(uCol * uI * (core + glow) * edge, 1.0);
      }`,
  });
  const quadAt = () => new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  const sunQ = quadAt(); sunQ.material = spriteMat(spriteU); sunQ.frustumCulled = false;
  const glintU = { uR: { value: 70 }, uC: { value: new THREE.Vector2() }, uS: { value: S }, uI: { value: 0 }, uCore: { value: 1.3 }, uGlow: { value: 0.05 },
    uGlowR: { value: 9 }, uCol: { value: new THREE.Vector3(1.0, 0.82, 0.5) }, uH: { value: H } };
  const glintQ = quadAt(); glintQ.material = spriteMat(glintU); glintQ.frustumCulled = false;
  const spriteScene = new THREE.Scene(); spriteScene.add(sunQ, glintQ);
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // glint envelope: frames 3648–3653 (attack at 152.0, peak one frame later, ~exponential decay)
  const glint = t => { const u = (t - T_GLINT) * 24; if (u < -0.5 || u > 6) return 0; if (u < 1) return 0.55 + 0.45 * clamp(u); return Math.exp(-(u - 1) * 0.62); };
  const tmp = new THREE.Vector3();

  console.log(`v_voyager diag (not a WARNing): recordFace=${recordFace} busW=${busW.toArray().map(v => v.toFixed(2))} sunDir=${SUN.toArray().map(v => v.toFixed(3))}`);

  return {
    msaa: true,
    render(shot, f) {
      const t = f.t;
      // camera: linear dolly towards the craft (5 % larger at the end), constant orientation
      const k = PUSH * clamp((t - T0) / 6.0, 0, 1.2);
      cam.position.set(0, 0, 0).addScaledVector(busW, k);
      cam.quaternion.identity(); cam.updateMatrixWorld();
      body.position.copy(busW);
      body.quaternion.copy(orient(t));
      plat.quaternion.copy(platOrient(t));
      body.updateMatrixWorld(true);
      key.position.copy(busW).addScaledVector(KEY, 30); key.target.position.copy(busW); key.target.updateMatrixWorld();
      // the record: a highlight as it catches the Sun
      const g = glint(t);
      M.record.emissiveIntensity = 2.2 * g;
      tmp.copy(recC).applyMatrix4(body.matrixWorld).project(cam);
      glintU.uC.value.set((tmp.x * 0.5 + 0.5) * 1920, (0.5 - tmp.y * 0.5) * 1080);
      glintU.uI.value = 12 * g;
      glintQ.visible = g > 0;

      const sm = renderer.shadowMap.enabled, st = renderer.shadowMap.type;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.setRenderTarget(f.target); renderer.setClearColor(0x000000, 1); renderer.clear();
      renderer.render(scene, cam);
      renderer.render(spriteScene, orthoCam);
      renderer.autoClear = ac;
      renderer.shadowMap.enabled = sm; renderer.shadowMap.type = st;
      renderer.setRenderTarget(f.target);
    },
    post() {
      return { bloom: 0.6, bloomThreshold: 1.0, streak: 0.14, streakTint: [1.0, 0.9, 0.78], vignette: 0.22, grain: 0.035 };
    },
  };
}
