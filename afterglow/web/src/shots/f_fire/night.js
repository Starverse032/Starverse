// f_fire/night.js — v2 F1 [1872, 1968) · F2 [1968, 2112) · F3 [2112, 2280)  (screenplay S03-a / b / c).
//
// The set: a campfire 3.2 m north of the camera (soil with ash and litter, a ring of basalt stones, a teepee
// of charred sticks with glowing cracks, a bed of coals, ~5000 dry grass blades), one baked Milky Way and
// one star field (f_fire/sky.js, shared with m_asking), a ridge, and the last of the dusk low in the WEST
// (screen left: the camera faces north, as in A4).
//
// F1 · 50 mm, 0.4 m up, locked + breath. The small flame climbs into the teepee, 120 → 260 px tall; the
//   fire light spreads over the stones (ground radius ≈ 300 → 520 px). The camera is locked, so the set is
//   BAKED per light (three fire-light positions + the sky, shadows from own cube maps, 4× MSAA) and
//   re-weighted per frame; only the crack/coal glow, the flame and the sparks are live. The operator's
//   small tilt that keeps the growing fire's light centre on R is a 2D shift (a pure rotation), applied
//   to plates and live layers alike, with the breath. First sparks fly up from f1944.
// F2 · 35 mm crane 0.4 → 1.2 m + tilt −5° → +62° (easeInOutSine, 6 s), following the sparks; the set is
//   live (moving camera) only while it is in frame. The ridge is crossed at pitch +8° … +20° (f2010–2028).
//   3000 cycling sparks (born from f1944) + 12 heroes; everything is dead by f2088 (the last hero dies on
//   f2088, before reaching any star).
// F3 · 24 mm locked landscape, breath 0.5 px pinned to 0 on f2279. The ridge rises into a knoll under
//   C = (960, 540) and the campfire sits on it — a 12 px core + 40 px glow, 1600 K, core HDR ≤ 1.5 —
//   for the light-centre match into L1 at f2280. Smoke rises into the Milky Way; f2136 the guest star at
//   (1500, 270), 36 frames from nothing to the brightest thing in the sky. Card ② sits on the dark ground.
import * as THREE from 'three';
import { hex, RX, RY, fbm1, fbm3, breath, HAND_GLSL, merge, tag, ribbon, plain } from './common.js';
import { bakeGalaxy, skyFrame, SKY_GLSL, makeStars, L_SPAN, B_SPAN } from './sky.js';

const D2R = Math.PI / 180;
const FD = 3.2;                                    // fire distance (m)
const COCK35 = 0.5 * (0.035 * 0.035 / 2.8) * (1920 / 0.036);   // CoC radius px per dioptre (35 mm f/2.8)
const GUEST = hex(0xDCE8FF);
export const NF = { f1: 1872, sparks: 1944, f2: 1968, lastSpark: 2088, f3: 2112, guest: 2136, end: 2280 };
const CX = 960, CY = 540;                          // C (pixel index); continuous centre 960.5, 540.5
const T = n => n / 24;

// fire size: world scale of the flame sheets (1 = the v1.3 bonfire, ≈ 0.65 m)
export function fireScale(n) {
  if (n < NF.f2) { const u = Math.min(1, Math.max(0, (n - NF.f1) / (NF.f2 - 1 - NF.f1))); return 0.205 + (0.445 - 0.205) * (1 - Math.pow(1 - u, 1.6)); }
  return 0.46 + 0.10 * Math.min(1, (n - NF.f2) / 96);
}

// dusk glow (GLSL, world direction: x east, y up, camera faces −z → west = −x = screen left)
const DUSK_GLSL = /* glsl */ `
uniform float uDuskK;
vec3 duskGlow(vec3 d){
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z) / 0.0174533;              // 0 = north, −90 = west
  float w = smoothstep(18.0, -40.0, az);               // only on the left
  float h = exp(-max(el, 0.0) / 0.030) + 0.25 * exp(-max(el, 0.0) / 0.12);
  return vec3(0.034, 0.0075, 0.0030) * h * w * uDuskK;
}`;

export function createNight(ctx, need = { F1: true, F2: true, F3: true }) {
  const { renderer, W, H, kit, GLSL, util } = ctx;
  const S = H / 1080;
  const { clamp, smoothstep: ss } = util;
  const rng = util.rng(55 * 1000 + 16);
  const needSet = need.F1 || need.F2;

  // =====================================================================================================
  // SKY (shared)
  // =====================================================================================================
  const gal = bakeGalaxy(ctx);
  const stars = makeStars(ctx, gal, { count: 420000, seed: 1616 });
  const starScene = new THREE.Scene(); starScene.add(stars.pts);
  stars.uniforms.uExt.value = 0.12;
  const hand = stars.uniforms;
  const handU = { uHand: hand.uHand, uHandC: hand.uHandC };
  const setHandV = b => hand.uHand.value.set(b.ox, b.oy, Math.cos(b.rot), Math.sin(b.rot));

  // cameras -----------------------------------------------------------------------------------------
  const mk = (focal) => {
    const c = kit.filmCamera(W, H, { focalMM: focal, near: 0.05, far: 4000 });
    c.setViewOffset(W, H, (960 - RX) * S, (540 - RY) * S, W, H);
    c.rotation.order = 'YXZ';
    return c;
  };
  const FP = new THREE.Vector3(0, 0, -FD);
  // F1: 50 mm, 0.4 m up, aimed at the fire's light centre at the middle of the growth
  const cam50 = mk(50);
  cam50.position.set(0, 0.4, 0);
  const F1_AIM = 0.075;                                // m above the pit floor
  cam50.rotation.set(Math.atan2(F1_AIM - 0.4, FD), 0, 0); cam50.updateMatrixWorld(); cam50.updateProjectionMatrix();
  const FPX50 = 960 / (18 / 50);
  // F2
  const cam35 = mk(35);
  const pose35 = n => {
    const u = clamp((n - NF.f2) / 144), e = (1 - Math.cos(Math.PI * u)) / 2;
    return { e, c: 0.4 + 0.8 * e, pitch: (-5 + 67 * e) * D2R };
  };
  const setCam35 = n => {
    const p = pose35(n);
    cam35.position.set(0, p.c, 0); cam35.rotation.set(p.pitch, 0, 0); cam35.updateMatrixWorld(); cam35.updateProjectionMatrix();
    return p;
  };
  const FPX35 = 960 / (18 / 35);
  // F3
  const cam24 = mk(24);
  cam24.position.set(0, 1.6, 0); cam24.rotation.set(5 * D2R, 0, 0); cam24.updateMatrixWorld(); cam24.updateProjectionMatrix();

  setCam35(NF.f2 + 144);
  const M35 = skyFrame(cam35, [960, 480], 40, 13, -1.0);
  const M50 = M35;                                      // the same sky (it is barely in frame in F1)
  const M24 = skyFrame(cam24, [205, 640], 23, -2, 0.4);

  const invVP = cam => new THREE.Matrix4().multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
  const skyU = {
    ...handU, uInvVP: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uM: { value: new THREE.Matrix3() },
    uGal: { value: gal }, uL: { value: L_SPAN }, uB: { value: B_SPAN }, uGain: { value: 1 }, uAir: { value: 1 }, uExt: { value: 0.12 },
    uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uDuskK: { value: 1 },
  };
  const RAY_GLSL = /* glsl */ `
    uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec2 uRes; uniform float uS;
    vec2 pix(){ return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS; }
    vec3 rayAt(vec2 px){ vec2 ndc = vec2(px.x / 1920.0 * 2.0 - 1.0, 1.0 - px.y / 1080.0 * 2.0); vec4 p = uInvVP * vec4(ndc, 1.0, 1.0); return normalize(p.xyz / p.w - uCamPos); }`;
  const skyPass = kit.fullscreen(HAND_GLSL + SKY_GLSL + RAY_GLSL + DUSK_GLSL + /* glsl */ `
    uniform mat3 uM; uniform sampler2D uGal; uniform float uL, uB, uGain, uAir, uExt;
    void main(){
      vec3 d = rayAt(handInv(pix()));
      float el = asin(clamp(d.y, -1.0, 1.0));
      vec3 col = skyBase(el, uAir) * mix(1.0, uGain, 0.5);
      col += galaxy(uGal, uM, d, uL, uB) * extinction(el, uExt) * uGain * 0.40;
      col += duskGlow(d);
      gl_FragColor = vec4(col, 1.0);
    }`, skyU);

  // ridge profiles ------------------------------------------------------------------------------------
  const NR = 2048;
  // F1 / F2: ridge elevation (deg) by azimuth (deg, 0 = north / the fire), az ∈ [−100, 100]; a saddle in
  // the west-north-west (az −24 … −4) lets the last dusk line show at the top-left of the 50 mm frame
  const r16 = new Float32Array(NR * 4);
  for (let i = 0; i < NR; i++) {
    const az = -100 + 200 * i / (NR - 1);
    let el = 4.2 + 5.0 * (fbm1(az / 16 + 3.3, 5, 161) - 0.5) + 1.2 * (fbm1(az / 2.2, 4, 162) - 0.5) + 0.25 * (fbm1(az / 0.35, 3, 163) - 0.5);
    const dip = Math.exp(-Math.pow((az + 13) / 9, 2));
    el = el * (1 - 0.8 * dip) + 0.6 * dip;
    r16[4 * i] = el;
  }
  // F3: near ridge y(x) and far range y(x), 1080p px, x ∈ [−64, 1984]: the knoll crest y = 552 under C
  const r17 = new Float32Array(NR * 4);
  const ctrl = [[-64, 596], [120, 600], [330, 596], [520, 592], [700, 586], [820, 574], [900, 559], [940, 553.5], [960, 552], [980, 553.5], [1020, 559],
    [1100, 578], [1190, 602], [1260, 621], [1400, 634], [1560, 638], [1700, 628], [1790, 612], [1880, 600], [1984, 594]];
  const spline = x => {
    let k = 0; while (k < ctrl.length - 2 && x > ctrl[k + 1][0]) k++;
    const p0 = ctrl[Math.max(0, k - 1)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(ctrl.length - 1, k + 2)];
    const u = clamp((x - p1[0]) / (p2[0] - p1[0]));
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * (p2[0] - p1[0]), m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * (p2[0] - p1[0]);
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
  };
  const det17 = x => 3.2 * (fbm1(x / 70 + 1.1, 5, 171) - 0.5) + 1.3 * (fbm1(x / 11, 4, 172) - 0.5) + 0.5 * (fbm1(x / 2.6, 3, 173) - 0.5)
    + [[330, 9, 26], [470, 6, 18], [690, 5, 16], [1185, 7, 22], [1610, 5, 18], [1850, 8, 24]].reduce((s, [c, h, w]) => s - h * Math.pow(Math.max(0, 1 - Math.pow((x - c) / w, 2)), 0.6), 0);
  const dC = det17(CX);
  for (let i = 0; i < NR; i++) {
    const x = -64 + 2048 * i / (NR - 1);
    const pin = ss(4, 44, Math.abs(x - CX));
    r17[4 * i] = spline(x) + (det17(x) - dC * (1 - pin)) * (0.35 + 0.65 * pin);
    r17[4 * i + 1] = 607 + 9 * (fbm1(x / 160 + 7.0, 4, 174) - 0.5) + 2.0 * (fbm1(x / 25, 3, 175) - 0.5) + 0.000012 * Math.pow(x - 1450, 2);
  }
  const ridgeTex = (data) => { const t = new THREE.DataTexture(data, NR, 1, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
  const tex16 = ridgeTex(r16), tex17 = ridgeTex(r17);

  // the acacia (canvas2D silhouette), F3 only
  const treeTex = !need.F3 ? null : (() => {
    const cw = 512, ch = 288, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round';
    const r = util.rng(1717);
    const limb = (x, y, a, len, w, depth) => {
      const x2 = x + Math.cos(a) * len, y2 = y - Math.sin(a) * len;
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * len * 0.25, (y + y2) / 2 + (r() - 0.5) * len * 0.15, x2, y2); g.stroke();
      if (depth <= 0 || y2 < 92) return;
      const n = 2 + (r() < 0.4 ? 1 : 0);
      for (let k = 0; k < n; k++) limb(x2, y2, a + (k - (n - 1) / 2) * (0.45 + 0.3 * r()) + (r() - 0.5) * 0.2, len * (0.62 + 0.2 * r()), w * 0.62, depth - 1);
    };
    limb(258, 286, Math.PI / 2 + 0.06, 86, 10, 0);
    const fx = 258 - Math.cos(Math.PI / 2 + 0.06) * 86, fy = 286 - 86 * Math.sin(Math.PI / 2 + 0.06);
    for (const [a, l, w] of [[2.35, 70, 6.5], [1.85, 62, 5.5], [1.25, 66, 6], [0.78, 74, 6.5]]) limb(fx, fy, a, l, w, 3);
    for (let i = 0; i < 520; i++) {
      const u = r() * 2 - 1;
      const xC = 256 + u * 178 + (r() - 0.5) * 14;
      const top = 58 + 26 * u * u + (r() - 0.5) * 8, bot = 96 + 6 * u * u;
      const y = top + Math.pow(r(), 1.8) * (bot - top);
      const rx = 7 + r() * 16, ry = 3 + r() * 5.5;
      g.globalAlpha = 0.75 + 0.25 * r();
      g.beginPath(); g.ellipse(xC, y, rx * (1 - 0.35 * Math.abs(u)), ry, (r() - 0.5) * 0.3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
    return t;
  })();
  const TREE = { x: 1520, w: 186, h: 105 };
  TREE.y = (() => { const i = Math.round((TREE.x + 64) / 2048 * (NR - 1)); return r17[4 * i] + 3; })();

  const C_FIRE17 = bbCPU(1600);
  const terU = {
    ...handU, uInvVP: skyU.uInvVP, uCamPos: skyU.uCamPos, uRes: skyU.uRes, uS: skyU.uS, uAir: skyU.uAir, uGain: skyU.uGain, uDuskK: skyU.uDuskK,
    uMode: { value: 0 }, uR16: { value: tex16 }, uR17: { value: tex17 }, uTree: { value: treeTex },
    uTreeR: { value: new THREE.Vector4(TREE.x - TREE.w / 2, TREE.y - TREE.h, TREE.w, TREE.h) },
    uEdge: { value: 0.03 }, uFire: { value: new THREE.Vector3() }, uRpt: { value: new THREE.Vector2(CX + 0.5, CY + 0.5) },
  };
  const terrain = kit.fullscreen(HAND_GLSL + SKY_GLSL + RAY_GLSL + DUSK_GLSL + /* glsl */ `
    uniform int uMode; uniform sampler2D uR16, uR17, uTree; uniform vec4 uTreeR; uniform float uEdge, uAir, uGain;
    uniform vec3 uFire; uniform vec2 uRpt;
    float prof(sampler2D Tx, float u, int ch){
      float fx = clamp(u, 0.0, 1.0) * 2047.0, i0 = floor(fx);
      vec4 a = texelFetch(Tx, ivec2(int(i0), 0), 0), b = texelFetch(Tx, ivec2(min(int(i0) + 1, 2047), 0), 0);
      return mix(a[ch], b[ch], fx - i0);
    }
    void main(){
      vec2 px = handInv(pix());
      vec3 d = rayAt(px);
      float el = asin(clamp(d.y, -1.0, 1.0));
      vec3 col; float a;
      if (uMode == 0) {
        float az = atan(d.x, -d.z) / DG;
        float er = prof(uR16, (az + 100.0) / 200.0, 0);
        a = smoothstep(-uEdge, uEdge, er - el / DG);
        col = vec3(0.00085, 0.00095, 0.0013) * mix(1.0, uGain, 0.5) + duskGlow(vec3(d.x, 0.0, d.z)) * 0.035;
      } else {
        float u = (px.x + 64.0) / 2048.0;
        float yn = prof(uR17, u, 0), yf = prof(uR17, u, 1);
        float an = smoothstep(yn - 0.65, yn + 0.65, px.y);
        float af = smoothstep(yf - 0.9, yf + 0.9, px.y);
        vec2 tu = (px - uTreeR.xy) / uTreeR.zw;
        float at = 0.0;
        if (tu.x > 0.0 && tu.x < 1.0 && tu.y > 0.0 && tu.y < 1.0) at = texture2D(uTree, vec2(tu.x, 1.0 - tu.y)).r;
        an = max(an, at);
        // the far range in aerial haze; warmed a little on the left by the very last of the dusk
        vec3 far = skyBase(el, uAir) * 0.62 * mix(1.0, uGain, 0.5) + vec3(0.0004, 0.0005, 0.0008) + duskGlow(vec3(d.x, 0.004, d.z)) * 0.25;
        vec3 land = vec3(0.00055, 0.00062, 0.00085) * (0.8 + 0.4 * vnoise(px * vec2(0.012, 0.03)));
        vec2 q = (px - uRpt - vec2(0.0, 13.0)) / vec2(34.0, 8.0);
        float fg = exp(-dot(q, q)) + 0.25 * exp(-dot(q, q) * 0.12);
        float crest = smoothstep(yn + 14.0, yn, px.y);
        land += uFire * (0.020 * fg * (0.35 + 0.65 * crest));
        col = mix(far, land, an);
        a = max(an, af);
      }
      gl_FragColor = vec4(col * a, a);
    }`, terU, { blending: THREE.CustomBlending, transparent: true });
  premult(terrain.material);

  const noiseTex = kit.bake(renderer, {
    w: 256, h: 256, mipmaps: true, float: false,
    frag: /* glsl */ `
      float tn(vec2 p, float P, int s){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        ivec2 o = ivec2(s * 131, s * 71);
        float a = ihash2(ivec2(mod(i, P)) + o), b = ihash2(ivec2(mod(i + vec2(1, 0), P)) + o);
        float c = ihash2(ivec2(mod(i + vec2(0, 1), P)) + o), d = ihash2(ivec2(mod(i + vec2(1, 1), P)) + o);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
      float tf(vec2 p, float P, int s){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * tn(p, P, s + i); p *= 2.0; P *= 2.0; a *= 0.5; } return v / 0.96875; }
      void main(){ vec2 p = vUv * 6.0; gl_FragColor = vec4(tf(p, 6.0, 1), tf(p, 6.0, 9), tf(p * 2.0, 12.0, 17), 1.0); }`,
  });

  const nz = (t, fr, s) => util.shake(t, s, fr, 1)[0];
  const flick = t => 1 + 0.13 * nz(t, 6.5, 41) + 0.07 * nz(t, 13.0, 43) + 0.10 * nz(t, 2.1, 47);
  const C_FL = bbCPU(1600);
  const setSky = (cam, M, gain, air, dusk) => {
    skyU.uInvVP.value.copy(invVP(cam)); skyU.uCamPos.value.copy(cam.position); skyU.uM.value.copy(M);
    skyU.uGain.value = gain; skyU.uAir.value = air; skyU.uDuskK.value = dusk;
    stars.setFrame(M); stars.uniforms.uGain.value = gain;
  };

  // =====================================================================================================
  // THE SET (F1, F2)
  // =====================================================================================================
  let set = null;
  if (needSet) set = buildSet();
  function buildSet() {
    const hG = (x, z) => {
      let h = 0.035 * (fbm3(x * 0.6, 0.3, z * 0.6, 4, 21) - 0.5) + 0.012 * (fbm3(x * 3.1, 1.7, z * 3.1, 3, 23) - 0.5);
      const r2 = (x - FP.x) ** 2 + (z - FP.z) ** 2;
      h -= 0.035 * Math.exp(-r2 / (0.33 * 0.33));
      h -= 0.004 * Math.max(0, -z - 6);
      return h;
    };
    const parts = [], casters = [];
    const add = (g, mat, seed, cast = true) => { const gg = tag(g, { mat, seed }); parts.push(gg); if (cast) casters.push(gg); return gg; };
    {
      const nx = 300, nz2 = 230, pos = new Float32Array(nx * nz2 * 3);
      for (let j = 0; j < nz2; j++) for (let i = 0; i < nx; i++) {
        const x = -7 + 14 * i / (nx - 1), z = 0.3 - 45 * Math.pow(j / (nz2 - 1), 2.0), k = (j * nx + i) * 3;
        const xs = x * (1 + Math.max(0, -z) * 0.18);
        pos[k] = xs; pos[k + 1] = hG(xs, z); pos[k + 2] = z;
      }
      const idx = new Uint32Array((nx - 1) * (nz2 - 1) * 6); let o = 0;
      for (let j = 0; j < nz2 - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
      g.setAttribute('ru', new THREE.BufferAttribute(new Float32Array(nx * nz2 * 2), 2));
      add(g, 0, 0, false);
    }
    const stone = (cx, cz, r, flat, seed, seg = 40) => {
      const g = plain(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)));
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = 1 + 0.34 * (fbm3(x * 1.2 + seed, y * 1.2, z * 1.2, 4, seed | 0) - 0.5) + 0.06 * (fbm3(x * 6, y * 6 + seed, z * 6, 3, (seed | 0) + 3) - 0.5);
        p.setXYZ(i, x * r * n, y * r * n * (y > 0 ? flat : flat * 0.7), z * r * n);
      }
      g.computeVertexNormals();
      g.translate(cx, hG(cx, cz) + r * flat * 0.3, cz);
      add(g, 1, (seed * 0.137) % 1);
    };
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2 + 0.2 + (rng() - 0.5) * 0.25, rr = 0.47 + (rng() - 0.5) * 0.06;
      stone(FP.x + Math.cos(a) * rr, FP.z + Math.sin(a) * rr, 0.075 + rng() * 0.045, 0.62 + rng() * 0.2, 3 + k * 2.71);
    }
    for (let k = 0; k < 26; k++) {
      const x = (rng() - 0.5) * 7, z = -0.8 - rng() * 9;
      if (Math.hypot(x - FP.x, z - FP.z) < 0.7) continue;
      stone(x, z, 0.02 + Math.pow(rng(), 2) * 0.09, 0.5 + rng() * 0.3, 40 + k * 1.93, 24);
    }
    // a small teepee of twigs over the tinder (the flame climbs into it), two sticks lying across
    const log = (a, b, r, seed) => {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
      const g = plain(new THREE.CylinderGeometry(r * 0.8, r, len, 14, 12, false));
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ang = Math.atan2(z, x);
        const n = 1 + 0.18 * (fbm3(Math.cos(ang) * 1.5, y * 8 + seed, Math.sin(ang) * 1.5, 3, (seed | 0) + 5) - 0.5);
        p.setXYZ(i, x * n, y, z * n);
      }
      g.computeVertexNormals();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
      g.applyQuaternion(q); const m = A.clone().add(B).multiplyScalar(0.5); g.translate(m.x, m.y, m.z);
      add(g, 3, seed % 1, false);
    };
    const apex = FP.clone().add(new THREE.Vector3(0.015, 0.27, 0.0));
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + 0.75 + (rng() - 0.5) * 0.35, rr = 0.17 + rng() * 0.05;
      const base = [FP.x + Math.cos(a) * rr, hG(FP.x + Math.cos(a) * rr, FP.z + Math.sin(a) * rr) + 0.01, FP.z + Math.sin(a) * rr];
      const dir = apex.clone().sub(new THREE.Vector3(...base));
      const top = new THREE.Vector3(...base).addScaledVector(dir, 0.94 + 0.12 * rng());
      log(base, [top.x + (rng() - 0.5) * 0.05, top.y, top.z + (rng() - 0.5) * 0.05], 0.009 + rng() * 0.009, 0.37 + k * 0.29);
    }
    log([FP.x - 0.52, 0.03, FP.z + 0.16], [FP.x + 0.14, 0.05, FP.z - 0.04], 0.035, 0.91);
    log([FP.x + 0.46, 0.025, FP.z + 0.22], [FP.x - 0.05, 0.06, FP.z - 0.08], 0.03, 0.53);
    {
      const g = plain(new THREE.CircleGeometry(0.22, 64, 0, Math.PI * 2));
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.012 * (fbm3(x * 30, 0.5, z * 30, 3, 9) - 0.3)); }
      g.computeVertexNormals(); g.translate(FP.x, hG(FP.x, FP.z) + 0.004, FP.z);
      add(g, 4, 0.5, false);
    }
    const blade = (bx, bz, len, w0, az, lean, bend, twist, seed) => {
      const n = 8, pts = [], ws = [];
      let p = new THREE.Vector3(bx, hG(bx, bz) - 0.01, bz);
      for (let k = 0; k < n; k++) {
        const s = k / (n - 1);
        pts.push([p.x, p.y, p.z]); ws.push(w0 * (1 - 0.85 * Math.pow(s, 1.5)));
        const a = lean + bend * s * s;
        const d = new THREE.Vector3(Math.sin(a) * Math.cos(az), Math.cos(a), Math.sin(a) * Math.sin(az));
        p = p.clone().addScaledVector(d, len / (n - 1));
      }
      const sideFn = (k, Tg) => new THREE.Vector3(-Math.sin(az), 0, Math.cos(az)).applyAxisAngle(Tg, twist * k / (n - 1) + seed).projectOnPlane(Tg).normalize();
      add(ribbon(pts, ws, { side: sideFn }), 2, seed % 1);
    };
    const tufts = [];
    for (let i = 0; i < 620; i++) {
      const a = rng() * Math.PI * 2, r = 0.9 + Math.pow(rng(), 0.9) * 8.5;
      const x = FP.x + Math.cos(a) * r * 1.2, z = FP.z + Math.sin(a) * r;
      if (z > -1.1) continue;
      tufts.push([x, z, 14 + Math.floor(rng() * 22), 0.16 + rng() * 0.4]);
    }
    for (const [x, z, n, h] of [[-0.55, -1.45, 34, 0.42], [-0.95, -1.9, 28, 0.5], [0.62, -1.6, 30, 0.38], [1.05, -2.2, 26, 0.46], [-0.38, -2.35, 18, 0.3], [0.33, -2.6, 16, 0.28]]) tufts.push([x, z, n, h]);
    for (const [tx, tz, nb, ht] of tufts) {
      for (let i = 0; i < nb; i++) {
        const az = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 0.05;
        blade(tx + Math.cos(az) * rr, tz + Math.sin(az) * rr, ht * (0.4 + 0.75 * rng()), 0.003 + rng() * 0.0035,
          az + (rng() - 0.5) * 0.8, 0.12 + 0.45 * rng(), 0.2 + rng() * 1.1, (rng() - 0.5) * 3, i * 0.618 + tx * 7.1);
      }
    }
    const setGeo = merge(parts), casterGeo = merge(casters);

    // shadow cubes (distance maps) for a light position
    const distMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, uniforms: { uLight: { value: new THREE.Vector3() } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uLight; varying vec3 vW; void main(){ gl_FragColor = vec4(length(vW - uLight) / 50.0); }`,
    });
    const casterScene = new THREE.Scene(); { const m = new THREE.Mesh(casterGeo, distMat); m.frustumCulled = false; casterScene.add(m); }
    const shadowCube = (LP) => {
      const rt = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true });
      const cc = new THREE.CubeCamera(0.01, 60, rt); cc.position.copy(LP); casterScene.add(cc); cc.updateMatrixWorld();
      distMat.uniforms.uLight.value.copy(LP);
      const pc = new THREE.Color(); renderer.getClearColor(pc); const pa = renderer.getClearAlpha();
      renderer.setClearColor(0xffffff, 1); cc.update(renderer, casterScene); renderer.setClearColor(pc, pa);
      casterScene.remove(cc);
      return rt;
    };

    const setU = {
      ...handU, uLP: { value: new THREE.Vector3() }, uLC: { value: new THREE.Vector3() }, uShadow: { value: null }, uLP0: { value: new THREE.Vector3() },
      uFP: { value: FP }, uT: { value: 0 }, uSky: { value: new THREE.Vector3() }, uEmb: { value: 1 }, uMode: { value: 0 }, uFs: { value: 1 },
    };
    // uMode: 0 = full shading (F2 live), 1 = light only (bake), 2 = sky only (bake), 3 = emission only (F1 live)
    const setMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, uniforms: setU,
      vertexShader: HAND_GLSL + /* glsl */ `
        attribute float mat; attribute float seed; attribute vec2 ru;
        varying vec3 vW, vN; varying float vMat, vSeed; varying vec2 vRu;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
          vMat = mat; vSeed = seed; vRu = ru;
          gl_Position = handClip(projectionMatrix * viewMatrix * w);
        }`,
      fragmentShader: GLSL.all + /* glsl */ `
        uniform vec3 uLP, uLC, uLP0, uFP, uSky; uniform samplerCube uShadow; uniform float uT, uEmb, uFs; uniform int uMode;
        varying vec3 vW, vN; varying float vMat, vSeed; varying vec2 vRu;
        vec3 bumpN(vec3 p, vec3 n, float h){
          vec3 dpx = dFdx(p), dpy = dFdy(p); float dhx = dFdx(h), dhy = dFdy(h);
          vec3 r1 = cross(dpy, n), r2 = cross(n, dpx); float det = dot(dpx, r1);
          return normalize(abs(det) * n - sign(det) * (dhx * r1 + dhy * r2));
        }
        float shadowVis(vec3 P){
          vec3 D = P - uLP0; float d = length(D); vec3 n = D / d;
          vec3 t1 = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), t2 = cross(n, t1);
          float bias = 0.01 + 0.02 * d, rot = hash12(gl_FragCoord.xy) * 6.2832, v = 0.0;
          for (int i = 0; i < 10; i++){
            float a = float(i) * 2.39996 + rot, r = sqrt((float(i) + 0.5) / 10.0) * 0.07;
            v += step(d - bias, textureCube(uShadow, n + (t1 * cos(a) + t2 * sin(a)) * r).r * 50.0);
          }
          return v / 10.0;
        }
        void main(){
          vec3 P = vW;
          float rf = length(P.xz - uFP.xz);
          float br = 0.8 + 0.12 * sin(6.2832 * 0.43 * uT + rf * 9.0) + 0.08 * sin(6.2832 * 0.67 * uT - rf * 13.0);
          if (uMode == 3) {
            // emission only: cracks in the sticks near the flame, the coal bed (the rest adds black)
            vec3 emi = vec3(0.0);
            if (vMat > 2.5 && vMat < 3.5) {
              vec3 q = P * 70.0;
              float hot = smoothstep(0.20 * max(uFs, 0.5) + 0.04, 0.03, length(P - uFP - vec3(0.0, 0.07, 0.0))) * smoothstep(0.34 * uFs + 0.05, 0.03, P.y - uFP.y);
              if (hot > 0.01) {
                vec2 w = worley(q * 1.3 + vec3(0.0, uT * 0.03, 0.0));
                float crack = 1.0 - smoothstep(0.015, 0.09, w.y - w.x);
                float ashp = smoothstep(0.55, 0.8, fbm(q * 0.5, 3));
                float g = (crack * 1.6 * smoothstep(0.35, 0.6, vnoise(q.xy * 0.4 + q.z)) + 0.06) * hot * hot * br * (1.0 - ashp * 0.8);
                emi = blackbody(mix(1000.0, 1380.0, clamp(g * 0.4, 0.0, 1.0))) * g * 1.6;
              }
            } else if (vMat > 3.5) {
              vec2 w = worley(vec3(P.xz * 38.0, uT * 0.05));
              float edge = 1.0 - smoothstep(0.03, 0.22, w.y - w.x);
              float core = smoothstep(0.08 + 0.16 * uFs, 0.0, rf);
              float n = vnoise(P.xz * 14.0 + uT * 0.15);
              float g = (edge * 1.4 + 0.5 * (1.0 - w.x)) * core * (0.6 + 0.7 * n) * br;
              emi = blackbody(mix(950.0, 1450.0, clamp(g * 0.6, 0.0, 1.0))) * g * 2.2;
            }
            gl_FragColor = vec4(emi * uEmb, 0.0);
            return;
          }
          vec3 V = normalize(cameraPosition - P), N = normalize(vN);
          if (dot(N, V) < 0.0) N = -N;
          vec3 alb = vec3(0.1), emi = vec3(0.0); float trans = 0.0, h = 0.0; bool bump = false;
          if (vMat < 0.5) {
            vec2 q = P.xz;
            float n1 = fbm(q * 2.3, 4), n2 = fbm(q * 19.0 + 7.0, 3), n3 = fbm(q * 0.7 + 3.0, 3);
            vec3 soil = mix(vec3(0.050, 0.036, 0.026), vec3(0.095, 0.068, 0.045), smoothstep(0.3, 0.7, n1)) * (0.7 + 0.6 * n2);
            float litter = smoothstep(0.45, 0.62, fbm(q * 4.0 + 11.0, 4)) * smoothstep(0.7, 1.4, rf);
            vec3 straw = vec3(0.22, 0.16, 0.085) * (0.6 + 0.8 * vnoise(q * vec2(90.0, 23.0)));
            alb = mix(soil, straw, litter * 0.8) * (0.85 + 0.3 * n3);
            float n4 = fbm(q * 7.0 + 4.0, 4);
            float ash = smoothstep(0.52, 0.22, rf + 0.12 * (n4 - 0.5) + 0.05 * (n2 - 0.5));
            vec3 ashC = mix(vec3(0.035, 0.03, 0.027), vec3(0.12, 0.115, 0.108), smoothstep(0.35, 0.7, n4)) * (0.6 + 0.7 * n2);
            float fleck = step(0.8, vnoise(q * 140.0)) * ash;
            ashC = mix(ashC, vec3(0.012, 0.010, 0.009), fleck);
            alb = mix(alb, ashC, ash * 0.9);
            alb = mix(alb, vec3(0.025, 0.022, 0.02), smoothstep(0.30, 0.22, rf) * 0.7);
            h = n2 * 0.004 + litter * 0.002 * vnoise(q * 60.0); bump = true;
          } else if (vMat < 1.5) {
            vec3 q = P * 18.0 + vSeed * 31.0;
            float n1 = fbm(q, 4), n2 = fbm(q * 5.0, 3);
            alb = mix(vec3(0.045, 0.043, 0.041), vec3(0.11, 0.095, 0.08), fract(vSeed * 7.3)) * (0.6 + 0.8 * n1) * (0.85 + 0.3 * n2);
            h = n1 * 0.004 + n2 * 0.0015; bump = true;
          } else if (vMat < 2.5) {
            float sd = vSeed;
            vec3 straw = mix(vec3(0.42, 0.33, 0.19), vec3(0.31, 0.26, 0.17), fract(sd * 3.7));
            straw = mix(straw, vec3(0.20, 0.15, 0.10), step(0.82, fract(sd * 11.3)));
            alb = straw * (0.8 + 0.2 * vnoise(vec2(vRu.y * 4.0 + sd * 50.0, vRu.x * 40.0))) * mix(0.5, 1.05, smoothstep(0.0, 0.35, vRu.x));
            trans = 0.55;
          } else if (vMat < 3.5) {
            vec3 q = P * 70.0;
            float ashp = smoothstep(0.55, 0.8, fbm(q * 0.5, 3));
            alb = mix(vec3(0.020, 0.016, 0.013), vec3(0.14, 0.13, 0.12), ashp);
            h = fbm(q, 3) * 0.002; bump = true;
          } else {
            vec3 q = vec3(P.xz * 38.0, 0.0);
            vec2 w = worley(q);
            float edge = 1.0 - smoothstep(0.03, 0.22, w.y - w.x);
            alb = mix(vec3(0.10, 0.095, 0.09), vec3(0.03, 0.025, 0.022), edge);    // grey-white ash between the coals
          }
          if (bump) N = bumpN(P, N, h);
          vec3 col = vec3(0.0);
          if (uMode != 2) {
            vec3 Lv = uLP - P; float d2 = dot(Lv, Lv); vec3 L = Lv * inversesqrt(d2);
            float att = 1.0 / (d2 + 0.0225);
            float vis = shadowVis(P);
            float nl = dot(N, L);
            col += alb / PI * (max(nl, 0.0) + trans * max(-nl, 0.0) * vec3(1.0, 0.8, 0.55)) * att * vis * uLC;
          }
          if (uMode != 1) col += alb * uSky * (0.55 + 0.45 * N.y);
          if (uMode == 0) col += emi * uEmb;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const setMesh = new THREE.Mesh(setGeo, setMat); setMesh.frustumCulled = false;

    // flame: 10 sheets (world space, camera-facing about y), scaled by fireScale
    const NSH = 10;
    const shGeo = new THREE.BufferGeometry();
    {
      const cor = [], par = [], par2 = [], idx = [];
      for (let k = 0; k < NSH; k++) {
        const s = { dx: (rng() - 0.5) * 0.2, dz: (rng() - 0.5) * 0.14, w: 0.08 + rng() * 0.08, h: 0.40 + rng() * 0.32, seed: rng(), gain: 0.5 + rng() * 0.55 };
        if (k === 0) { s.dx = 0; s.dz = 0; s.w = 0.15; s.h = 0.72; s.gain = 1.0; }
        for (const [cx, cy] of [[-1, 0], [1, 0], [-1, 1.25], [1, 1.25]]) { cor.push(cx, cy); par.push(s.dx, s.w, s.h, s.seed); par2.push(s.dz, s.gain); }
        const b = k * 4; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
      shGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cor.length / 2 * 3), 3));
      shGeo.setAttribute('corner', new THREE.BufferAttribute(new Float32Array(cor), 2));
      shGeo.setAttribute('par', new THREE.BufferAttribute(new Float32Array(par), 4));
      shGeo.setAttribute('par2', new THREE.BufferAttribute(new Float32Array(par2), 2));
      shGeo.setIndex(idx);
    }
    const flU = { ...handU, uT: { value: 0 }, uF: { value: 1 }, uFs: setU.uFs, uBase: { value: FP.clone().add(new THREE.Vector3(0, 0.02, 0)) }, uNoise: { value: noiseTex }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uFwd: { value: new THREE.Vector3(0, 0, -1) } };
    const flMat = new THREE.ShaderMaterial({
      uniforms: flU, depthTest: true, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: HAND_GLSL + /* glsl */ `
        attribute vec2 corner; attribute vec4 par; attribute vec2 par2;
        uniform vec3 uBase, uRight, uFwd; uniform float uFs; varying vec2 vQ; varying vec2 vP;
        void main(){
          vec3 w = uBase + (uRight * (par.x * (1.0 - 0.35 * corner.y) + corner.x * par.y) + vec3(0.0, corner.y * par.z, 0.0) + uFwd * par2.x) * uFs;
          vQ = corner; vP = vec2(par.w, par2.y);
          gl_Position = handClip(projectionMatrix * viewMatrix * vec4(w, 1.0));
        }`,
      fragmentShader: GLSL.common + /* glsl */ `
        uniform float uT, uF, uFs; uniform sampler2D uNoise; varying vec2 vQ; varying vec2 vP;
        void main(){
          float y = vQ.y, sd = vP.x;
          float spd = (1.4 + 0.6 * sd) / sqrt(max(uFs, 0.2));                 // small flames flicker faster
          vec2 nuv = vec2(vQ.x * 0.16 + sd * 7.31, y * 0.38 - uT * spd * 0.42);
          vec3 n1 = texture2D(uNoise, nuv).rgb;
          vec3 n2 = texture2D(uNoise, nuv * vec2(2.1, 1.7) + (n1.rg - 0.5) * 0.22 + vec2(0.0, -uT * 0.35)).rgb;
          vec3 n3 = texture2D(uNoise, nuv * vec2(4.3, 3.1) + (n2.rg - 0.5) * 0.15 + vec2(0.31, -uT * 0.9)).rgb;
          float sway = (n1.r - 0.5) * 1.1 * y * y + 0.12 * sin(uT * 2.3 + sd * 9.0) * y;
          float x = vQ.x - sway;
          float wy = max(0.62 * pow(max(1.0 - y / 1.18, 0.0), 0.7) * (0.45 + 0.55 * smoothstep(0.0, 0.16, y)), 1e-3);
          float body = smoothstep(wy, wy * 0.35, abs(x));
          float tongue = smoothstep(0.32, 0.62, n2.g * 1.2 + (n3.b - 0.5) * 0.35 + 0.62 - y * 1.05);
          float dens = body * mix(1.0, tongue, smoothstep(0.06, 0.55, y)) * smoothstep(0.0, 0.05, y + 0.02);
          float core = smoothstep(wy * 0.7, 0.0, abs(x)) * smoothstep(0.6, 0.06, y) * smoothstep(-0.02, 0.1, y);
          // 1200–1900 K; the body is kept in HDR 0.3–1.5 so that it stays orange through the tone curve
          float Tk = mix(1200.0, 1900.0, clamp(core * 0.75 + (1.0 - y) * 0.2 + (n2.b - 0.5) * 0.2, 0.0, 1.0));
          vec3 c = blackbody(Tk) * (dens * 0.55 + core * 0.9) * vP.y;
          gl_FragColor = vec4(c * uF, 0.0);
        }`,
    });
    addOnly(flMat);
    const flMesh = new THREE.Mesh(shGeo, flMat); flMesh.frustumCulled = false; flMesh.renderOrder = 2;

    // sparks: 3000 cycling + 12 heroes (analytic) -------------------------------------------------------
    const NSP = 3000, NHERO = 12;
    const spGeo = new THREE.InstancedBufferGeometry();
    spGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
    spGeo.setIndex([0, 1, 2, 1, 3, 2]);
    {
      const A = new Float32Array((NSP + NHERO) * 4), B = new Float32Array((NSP + NHERO) * 4);
      const r = util.rng(1606);
      for (let i = 0; i < NSP; i++) { A.set([0, 0, 0, r() * 4.0 + 70.0], 4 * i); B.set([r(), 0, 0, 0], 4 * i); }
      const heroEnd = T(NF.lastSpark) - 0.01;            // the last hero dies just before f2088
      for (let i = 0; i < NHERO; i++) {
        const tb = 81.55 + 0.55 * i / (NHERO - 1) + (r() - 0.5) * 0.06;
        const life = i === NHERO - 1 ? heroEnd - tb : Math.min(6.0, heroEnd - tb) - 0.25 - r() * 0.9;
        A.set([FP.x + (r() - 0.5) * 0.08, 0.16 + r() * 0.08, FP.z + (r() - 0.5) * 0.08, tb], 4 * (NSP + i));
        B.set([r(), 1, life, 1.62 + 0.22 * r()], 4 * (NSP + i));
      }
      spGeo.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
      spGeo.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
      spGeo.instanceCount = NSP + NHERO;
    }
    const spU = {
      ...handU, uT: { value: 0 }, uShut: { value: 0.5 / 24 }, uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S },
      uFP: { value: FP }, uInvDF: { value: 1 / FD }, uCocK: { value: COCK35 }, uGain: { value: 1 },
      uBorn0: { value: T(NF.sparks) }, uDead: { value: T(NF.lastSpark) - 0.05 }, uFs: setU.uFs,
    };
    const spMat = new THREE.ShaderMaterial({
      uniforms: spU, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
      vertexShader: GLSL.common + HAND_GLSL + /* glsl */ `
        attribute vec4 iA, iB;
        uniform float uT, uShut, uS, uInvDF, uCocK, uGain, uBorn0, uDead, uFs; uniform vec2 uRes; uniform vec3 uFP;
        varying vec2 vA, vB; varying float vI, vRad; varying vec3 vCol;
        void sparkInit(float t, out vec3 p0, out float v, out float life, out float tau, out float I0, out float amp, out vec4 ph){
          if (iB.y < 0.5) {
            float P = 4.0, k = floor((t - iA.w) / P);
            tau = t - iA.w - k * P;
            float born = iA.w + k * P;
            vec3 h1 = hash33(vec3(iB.x * 1000.0, k, 1.7)), h2 = hash33(vec3(iB.x * 1000.0, k, 5.3)), h3 = hash33(vec3(iB.x * 1000.0, k, 9.1));
            v = mix(0.45, 1.45, h1.x); life = 2.5 + 1.5 * h1.y; I0 = mix(4.0, 26.0, pow(h1.z, 2.5));
            if (hash12(vec2(iB.x * 777.0, k)) > 0.7) life = -1.0;
            // the first sparks fly from f1944; every cycle ends before f2088
            float ramp = smoothstep(uBorn0, uBorn0 + 0.8, born);
            if (born < uBorn0 || hash12(vec2(iB.x * 313.0, k)) > ramp) life = -1.0;
            life = min(life, uDead - born);
            p0 = uFP + vec3((h2.x - 0.5) * 0.16 * uFs * 2.0, 0.06 + 0.40 * uFs * h2.y, (h2.z - 0.5) * 0.14 * uFs * 2.0);
            amp = mix(0.05, 0.22, h3.x); ph = vec4(h3.yz, h2.yx) * 6.2832;
          } else {
            tau = t - iA.w; life = iB.z; v = iB.w; I0 = 40.0 + 20.0 * iB.x; p0 = iA.xyz; amp = 0.05;
            ph = vec4(iB.x * 31.0, iB.x * 17.0, iB.x * 7.0, iB.x * 3.0);
          }
        }
        vec3 sparkPos(vec3 p0, float v, float tau, float amp, vec4 ph){
          vec3 p = p0 + vec3(0.0, v * tau - 0.1 * tau * tau, 0.0) + vec3(0.07, 0.0, -0.025) * tau;
          float e = min(tau * 1.5, 1.0);
          p.x += amp * tau * e * (0.6 * sin(tau * 1.3 + ph.x) + 0.4 * sin(tau * 3.1 + ph.y));
          p.z += amp * tau * e * (0.6 * cos(tau * 1.1 + ph.z) + 0.4 * sin(tau * 2.7 + ph.w));
          return p;
        }
        void main(){
          vec3 p0; float v, life, tau, I0, amp; vec4 ph;
          sparkInit(uT, p0, v, life, tau, I0, amp, ph);
          float alive = step(0.0, tau) * step(tau, life);
          vec3 pa = sparkPos(p0, v, clamp(tau, 0.0, life), amp, ph), pb = sparkPos(p0, v, clamp(tau - uShut, 0.0, life), amp, ph);
          vec4 ca = handClip(projectionMatrix * viewMatrix * vec4(pa, 1.0)), cb = handClip(projectionMatrix * viewMatrix * vec4(pb, 1.0));
          if (ca.w < 0.05 || cb.w < 0.05) alive = 0.0;
          vec2 sa = (ca.xy / ca.w * 0.5 + 0.5) * uRes, sb = (cb.xy / cb.w * 0.5 + 0.5) * uRes;
          float d = ca.w;
          float coc = min(14.0, uCocK * abs(uInvDF - 1.0 / d)) * uS;
          float r0 = 0.75 * uS, rad = sqrt(r0 * r0 + coc * coc);
          float L = length(sa - sb);
          float u = clamp(tau / life, 0.0, 1.0);
          float cool = iB.y < 0.5 ? exp(-tau / 1.5) : exp(-tau / 4.5);
          float I = I0 * cool * pow(1.0 - u, 1.2) * (0.72 + 0.28 * sin(tau * 37.0 + ph.x * 5.0)) * smoothstep(0.0, 0.04, tau);
          vI = uGain * I * alive * (r0 * r0) / (rad * rad) * (2.5 * rad) / (2.5 * rad + L);
          vCol = blackbody(mix(2300.0, 1000.0, 1.0 - cool * (1.0 - u * 0.5)));
          vRad = rad; vA = sa; vB = sb;
          vec2 mn = min(sa, sb) - rad * 3.0, mx = max(sa, sb) + rad * 3.0;
          vec2 P = mix(mn, mx, position.xy * 0.5 + 0.5);
          gl_Position = vec4(P / uRes * 2.0 - 1.0, clamp(ca.z / ca.w, -1.0, 1.0), 1.0);
          if (alive < 0.5 || vI < 1e-4) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vA, vB; varying float vI, vRad; varying vec3 vCol;
        void main(){
          vec2 p = gl_FragCoord.xy, ab = vB - vA;
          float h = clamp(dot(p - vA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
          float d = length(p - vA - ab * h);
          gl_FragColor = vec4(vCol * vI * exp(-0.5 * d * d / (vRad * vRad * 0.42)), 0.0);
        }`,
    });
    addOnly(spMat);
    const spMesh = new THREE.Mesh(spGeo, spMat); spMesh.frustumCulled = false; spMesh.renderOrder = 3;

    const out = { setU, setMat, setMesh, flU, flMesh, spU, spMesh, hG };

    // ---- F1: bake the set per light at the locked 50 mm camera ---------------------------------------
    if (need.F1) {
      const L3 = [FP.clone().add(new THREE.Vector3(0.0, 0.085, 0.0)), FP.clone().add(new THREE.Vector3(0.025, 0.17, 0.0)), FP.clone().add(new THREE.Vector3(-0.025, 0.15, 0.02))];
      const msRT = ctx.makeRT(W, H, { depth: true, samples: 4 });
      const copy = kit.fullscreen(`uniform sampler2D tex; void main(){ gl_FragColor = texture2D(tex, vUv); }`, { tex: { value: msRT.texture } });
      const bakeScene = new THREE.Scene(); bakeScene.add(setMesh);
      const plates = [];
      const pc = new THREE.Color(); renderer.getClearColor(pc); const pa = renderer.getClearAlpha();
      setHandV({ ox: 0, oy: 0, rot: 0 });
      const bakeTo = () => {
        renderer.setRenderTarget(msRT); renderer.setClearColor(0x000000, 0); renderer.clear();
        renderer.render(bakeScene, cam50);
        const o = ctx.makeRT(W, H); copy.render(renderer, o); return o;
      };
      for (const LP of L3) {
        const cube = shadowCube(LP);
        setU.uMode.value = 1; setU.uLP.value.copy(LP); setU.uLP0.value.copy(LP); setU.uShadow.value = cube.texture; setU.uLC.value.set(1, 1, 1);
        plates.push(bakeTo());
        cube.dispose();
      }
      setU.uMode.value = 2; setU.uSky.value.set(0.0016, 0.0019, 0.0030);
      plates.push(bakeTo());
      renderer.setRenderTarget(null); renderer.setClearColor(pc, pa);
      msRT.dispose();
      const plU = { ...handU, uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S } };
      for (let i = 0; i < 4; i++) { plU['uP' + i] = { value: plates[i].texture }; plU['uW' + i] = { value: new THREE.Vector3() }; }
      const platePass = kit.fullscreen(HAND_GLSL + /* glsl */ `
        uniform sampler2D uP0, uP1, uP2, uP3; uniform vec3 uW0, uW1, uW2, uW3; uniform vec2 uRes; uniform float uS;
        void main(){
          vec2 px = handInv(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS);
          vec2 uv = vec2(px.x / 1920.0, 1.0 - px.y / 1080.0);
          vec4 s = texture2D(uP3, uv);
          vec3 c = uW3 * s.rgb + uW0 * texture2D(uP0, uv).rgb + uW1 * texture2D(uP1, uv).rgb + uW2 * texture2D(uP2, uv).rgb;
          gl_FragColor = vec4(c, s.a);
        }`, plU, { blending: THREE.CustomBlending, transparent: true });
      premult(platePass.material);
      out.f1 = { platePass, plU, L3 };
      // live F1 emission/flame/sparks scene: depth from the set, emission only
      const liveScene = new THREE.Scene(); liveScene.add(setMesh, flMesh, spMesh);
      out.f1.liveScene = liveScene;
    }
    if (need.F2) {
      // F2 lights the live set with one moving light and one static shadow cube
      const LP0 = FP.clone().add(new THREE.Vector3(0, 0.17, 0));
      const cube = shadowCube(LP0);
      out.f2 = { LP0, cube, scene: new THREE.Scene() };
      out.nearRT = ctx.makeRT(W, H, { depth: true, samples: 4 });
      out.nearComp = kit.fullscreen(/* glsl */ `uniform sampler2D tex; void main(){ gl_FragColor = texture2D(tex, vUv); }`, { tex: { value: out.nearRT.texture } }, { blending: THREE.CustomBlending, transparent: true });
      premult(out.nearComp.material);
    }
    distMat.dispose();
    return out;
  }

  // =====================================================================================================
  // F3 · SCREEN-SPACE SPRITES: campfire at C, smoke, guest star
  // =====================================================================================================
  const sprite = (x0, y0, x1, y1, frag, uniforms, blend = 'add') => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x0, y0, 0, x1, y0, 0, x0, y1, 0, x1, y1, 0]), 3));
    g.setIndex([0, 1, 2, 1, 3, 2]);
    const m = new THREE.ShaderMaterial({
      uniforms: { ...handU, ...uniforms }, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: blend === 'add' ? THREE.AdditiveBlending : THREE.CustomBlending,
      vertexShader: HAND_GLSL + /* glsl */ `varying vec2 vPx;
        void main(){ vPx = position.xy; gl_Position = handClip(vec4(position.x / 1920.0 * 2.0 - 1.0, 1.0 - position.y / 1080.0 * 2.0, 0.0, 1.0)); }`,
      fragmentShader: GLSL.all + 'varying vec2 vPx;\n' + frag,
    });
    if (blend !== 'add') premult(m);
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    const sc = new THREE.Scene(); sc.add(mesh);
    return { scene: sc, u: m.uniforms };
  };
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let fireSpr = null, smokeSpr = null, guestSpr = null;
  if (need.F3) {
    // the campfire seen from far: a 12 px core (HDR ≤ 1.5, 1600 K — stays orange through the tone curve)
    // and a 40 px glow; the core is symmetric about the C pixel centre so that the light centre is C
    fireSpr = sprite(CX - 80, CY - 80, CX + 81, CY + 81, /* glsl */ `
      uniform vec3 uCol; uniform float uI, uFk; uniform vec2 uR;
      void main(){
        vec2 d = vPx - uR;
        float core = exp(-0.5 * (d.x * d.x / 4.4 + d.y * d.y / 9.0));
        float tip = exp(-0.5 * (d.x * d.x / 2.0 + (d.y + 7.0) * (d.y + 7.0) / 10.0)) * 0.25 * uFk;   // a lick of flame above
        float glow = exp(-length(d * vec2(1.0, 0.85)) / 7.0) * 0.10 + exp(-length(d) / 20.0) * 0.022;
        gl_FragColor = vec4(uCol * uI * (core + tip + glow), 1.0);
      }`, { uCol: { value: new THREE.Vector3(...C_FIRE17) }, uI: { value: 1.4 }, uFk: { value: 1 }, uR: { value: new THREE.Vector2(CX + 0.5, CY + 0.5) } });
    smokeSpr = sprite(CX - 140, 70, CX + 220, CY + 8, /* glsl */ `
      uniform float uT; uniform sampler2D uNoise; uniform vec3 uFire; uniform vec2 uR;
      void main(){
        float h = uR.y - 6.0 - vPx.y;
        if (h < -2.0) discard;
        float sway = 11.0 * sin(h * 0.011 - uT * 0.30) * smoothstep(20.0, 180.0, h)
                   + 3.0 * sin(h * 0.031 - uT * 0.55 + 1.3) * smoothstep(5.0, 60.0, h);
        float xc = uR.x + 0.00055 * h * h + sway;
        float wd = 1.8 + 0.075 * h + 0.00012 * h * h;
        float xn = (vPx.x - xc) / wd;
        vec2 q = vec2(xn * 0.05 + h * 0.0013, h * 0.0042 - uT * 0.03);
        vec3 n1 = texture2D(uNoise, q).rgb, n2 = texture2D(uNoise, q * 2.7 + (n1.rg - 0.5) * 0.12 + vec2(0.0, -uT * 0.025)).rgb;
        float body = exp(-xn * xn * (1.6 + 0.8 * n1.r));
        float brk = smoothstep(0.2, 0.7, n1.g * 0.8 + n2.b * 0.5);
        float dens = body * mix(0.12, 1.0, brk) * smoothstep(-2.0, 10.0, h) * smoothstep(470.0, 280.0, h)
                   * clamp(9.0 / (wd + 6.0), 0.0, 1.0);
        float a = clamp(dens * 0.5, 0.0, 0.35);
        vec3 emi = uFire * (0.06 * exp(-h / 14.0) + 0.012 * exp(-h / 45.0)) * dens
                 + vec3(0.0240, 0.0275, 0.0340) * dens * smoothstep(10.0, 90.0, h);
        gl_FragColor = vec4(emi, a);
      }`, { uT: { value: 0 }, uNoise: { value: noiseTex }, uFire: { value: new THREE.Vector3(...C_FIRE17) }, uR: { value: new THREE.Vector2(CX + 0.5, CY + 0.5) } }, 'over');
    guestSpr = sprite(1500 - 260, 270 - 260, 1500 + 260, 270 + 260, /* glsl */ `
      uniform vec3 uCol; uniform float uI, uSp; uniform vec2 uG;
      void main(){
        vec2 d = vPx - uG; float r = length(d);
        float core = exp(-0.5 * r * r / 1.25);
        float halo = exp(-r / 4.5) * 0.06 + exp(-r / 22.0) * 0.006;
        vec2 e = rot2(0.14) * d;
        float sp = exp(-0.5 * e.y * e.y / 0.55) * exp(-abs(e.x) / (uSp * 0.16)) + exp(-0.5 * e.x * e.x / 0.55) * exp(-abs(e.y) / (uSp * 0.16));
        sp *= 0.06 * (1.0 + 0.25 * sin(r * 0.9));
        vec3 c = uCol * (core + halo + sp) + vec3(0.08, 0.06, -0.02) * halo;
        gl_FragColor = vec4(max(c, 0.0) * uI, 1.0);
      }`, { uCol: { value: new THREE.Vector3(...GUEST) }, uI: { value: 0 }, uSp: { value: 100 }, uG: { value: new THREE.Vector2(1500.5, 270.5) } });
  }

  // =====================================================================================================
  // RENDER
  // =====================================================================================================
  // the light centre of the growing fire on screen sits at the flame base + ~0.3 of its height; the
  // operator keeps it on R with a small tilt (a 2D vertical shift for the 50 mm lens)
  const f1Follow = n => {
    const fs = fireScale(n);
    const yc = 0.02 + 0.24 * fs;                         // m above the pit floor (calibrated on the stills)
    return (Math.atan2(yc - 0.4, FD) - Math.atan2(F1_AIM - 0.4, FD)) * FPX50;   // px (up is negative y)
  };

  function renderF1(n, f) {
    const t = T(n);
    const fs = fireScale(n), fk = flick(t);
    const b = breath(util, t, { px: 1.5, deg: 0.15, hz: 0.3, seed: 16 });
    const oy = f1Follow(n);
    setHandV({ ox: b.ox, oy: b.oy - oy, rot: b.rot });
    setSky(cam50, M50, 0.75, 2.2, 1.0);
    stars.uniforms.uFieldLow.value = 2.6;
    skyPass.render(renderer, f.target);
    stars.uniforms.uCoc.value = Math.min(6, COCK35 * 2.04 / FD);
    renderer.setRenderTarget(f.target); renderer.render(starScene, cam50);
    terU.uMode.value = 0; terU.uEdge.value = 0.05;
    terrain.render(renderer, f.target);
    // the baked set: three fire-light plates re-weighted by the flicker, the fire's growth and the sky
    const s = set, P = s.f1.plU;
    const I = 11 * Math.pow(fs / 0.5, 2.0) * fk;
    const a1 = 0.5 + 0.35 * nz(t, 2.8, 51), a2 = 0.5 + 0.4 * nz(t, 3.7, 53);
    const lowK = 1 - ss(0.22, 0.42, fs);                     // the small fire's light is low in the tinder
    const w0 = lowK, w1 = (1 - lowK) * Math.max(0.1, a1), w2 = (1 - lowK) * Math.max(0.1, a2), ws = w0 + w1 + w2;
    P.uW0.value.set(...C_FL.map(c => c * I * w0 / ws)); P.uW1.value.set(...C_FL.map(c => c * I * w1 / ws)); P.uW2.value.set(...C_FL.map(c => c * I * w2 / ws));
    P.uW3.value.set(1, 1, 1);
    s.f1.platePass.render(renderer, f.target);
    // live: coals and stick cracks (emission, depth-tested by the set), the flame, the sparks
    s.setU.uMode.value = 3; s.setU.uT.value = t; s.setU.uFs.value = fs; s.setU.uEmb.value = 0.55 + 0.45 * ss(0.2, 0.45, fs);
    s.flU.uT.value = t; s.flU.uF.value = 0.95 + 0.08 * (fk - 1);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam50.quaternion); right.y = 0; right.normalize();
    s.flU.uRight.value.copy(right); s.flU.uFwd.value.set(-right.z, 0, right.x);
    s.spU.uT.value = t; s.spU.uInvDF.value = 1 / FD; s.spU.uCocK.value = COCK35 * 2.04;
    const ac = s.setMat.blending;
    s.setMat.blending = THREE.CustomBlending; addOnly(s.setMat);
    renderer.setRenderTarget(f.target); renderer.clear(false, true, false);
    renderer.render(s.f1.liveScene, cam50);
    s.setMat.blending = ac; s.setMat.transparent = false;
  }

  function renderF2(n, f) {
    const t = T(n);
    const p = setCam35(n);
    const s = set;
    setHandV(breath(util, t, { px: 1.5, deg: 0.15, hz: 0.3, seed: 16 }));
    const gain = 0.75 + 0.25 * ss(0.0, 0.5, p.e);
    const invDF = (1 / FD) * (1 - ss(0.04, 0.26, p.e));
    setSky(cam35, M35, gain, 2.2, 1.0 - 0.6 * ss(0.0, 0.6, p.e));
    stars.uniforms.uFieldLow.value = 2.6 + 4.6 * ss(83.6, 84.0, t) * (1 - ss(85.0, 85.6, t));
    skyPass.render(renderer, f.target);
    stars.uniforms.uCoc.value = Math.min(6, COCK35 * invDF);
    renderer.setRenderTarget(f.target); renderer.render(starScene, cam35);
    terU.uMode.value = 0; terU.uEdge.value = Math.max(0.6, COCK35 * invDF) / FPX35 / D2R;
    terrain.render(renderer, f.target);
    const fs = fireScale(n), fk = flick(t);
    const lc = C_FL.map(c => c * 11 * Math.pow(fs / 0.5, 2.0) * fk);
    s.setU.uMode.value = 0; s.setU.uLC.value.set(...lc); s.setU.uT.value = t; s.setU.uFs.value = fs; s.setU.uEmb.value = 1;
    s.setU.uLP0.value.copy(s.f2.LP0); s.setU.uShadow.value = s.f2.cube.texture;
    s.setU.uLP.value.copy(s.f2.LP0).add(new THREE.Vector3(0.03 * nz(t, 2.8, 51), 0.04 * nz(t, 3.7, 53), 0.03 * nz(t, 3.1, 57)));
    s.setU.uSky.value.set(0.0012, 0.0016, 0.0026).multiplyScalar(gain);
    s.setMesh.visible = p.pitch < 24 * D2R;
    s.flMesh.visible = p.pitch < 18 * D2R;
    s.flU.uT.value = t; s.flU.uF.value = 0.92 + 0.08 * fk;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam35.quaternion); right.y = 0; right.normalize();
    s.flU.uRight.value.copy(right); s.flU.uFwd.value.set(-right.z, 0, right.x);
    s.spU.uT.value = t; s.spU.uInvDF.value = invDF; s.spU.uCocK.value = COCK35;
    const sc = s.f2.scene; sc.add(s.setMesh, s.flMesh, s.spMesh);
    s.nearRT.scissor.set(0, Math.floor(f.barPx), W, H - 2 * Math.floor(f.barPx)); s.nearRT.scissorTest = true;
    renderer.setRenderTarget(s.nearRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false); renderer.setClearColor(0x000000, 1);
    renderer.render(sc, cam35);
    s.nearRT.scissorTest = false;
    s.nearComp.render(renderer, f.target);
  }

  function renderF3(n, f) {
    const t = T(n);
    setHandV(breath(util, t, { px: 0.5, deg: 0.05, hz: 0.3, seed: 17, zeroAt: T(NF.end - 1) }));
    setSky(cam24, M24, 1.0, 1.9, 0.35);
    stars.uniforms.uFieldLow.value = 1.0;
    skyPass.render(renderer, f.target);
    stars.uniforms.uCoc.value = 0;
    renderer.setRenderTarget(f.target); renderer.render(starScene, cam24);
    const fk = flick(t);
    terU.uMode.value = 1; terU.uFire.value.set(...C_FIRE17.map(c => c * fk));
    terrain.render(renderer, f.target);
    smokeSpr.u.uT.value = t;
    renderer.setRenderTarget(f.target); renderer.render(smokeSpr.scene, orthoCam);
    fireSpr.u.uI.value = 1.35 * (0.93 + 0.07 * fk); fireSpr.u.uFk.value = fk;
    renderer.render(fireSpr.scene, orthoCam);
    if (n >= NF.guest) {
      const u = clamp((n - NF.guest) / 36);
      const rise = 1 - Math.pow(1 - u, 2.2);
      const sc = 1 + 0.07 * nz(t, 7.3, 61) + 0.05 * nz(t, 12.9, 63);
      guestSpr.u.uI.value = 26 * rise * sc;
      guestSpr.u.uSp.value = 25 + 55 * rise;
      renderer.render(guestSpr.scene, orthoCam);
    }
  }

  return {
    render(shot, f) {
      renderer.setRenderTarget(f.target); renderer.setClearColor(0x000000, 1); renderer.clear();
      const n = f.t * 24;
      if (shot.id === 'F1') renderF1(n, f);
      else if (shot.id === 'F2') renderF2(n, f);
      else renderF3(n, f);
      renderer.setRenderTarget(f.target);
    },
    fireScale, f1Follow,
  };
}

function addOnly(m) {
  m.blending = THREE.CustomBlending; m.transparent = true;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; m.blendEquation = THREE.AddEquation;
  m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; m.blendEquationAlpha = THREE.AddEquation;
}
function premult(m) {
  m.blending = THREE.CustomBlending; m.transparent = true;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation;
  m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; m.blendEquationAlpha = THREE.AddEquation;
}
function bbCPU(Tk) {
  Tk = Math.min(40000, Math.max(1000, Tk)) / 100;
  const r = Tk <= 66 ? 1 : Math.min(1, 1.29293618606 * Math.pow(Tk - 60, -0.1332047592));
  const g = Tk <= 66 ? Math.min(1, Math.max(0, 0.39008157876 * Math.log(Tk) - 0.63184144378)) : Math.min(1, 1.12989086089 * Math.pow(Tk - 60, -0.0755148492));
  const b = Tk >= 66 ? 1 : Tk <= 19 ? 0 : Math.min(1, Math.max(0, 0.54320678911 * Math.log(Tk - 10) - 1.19625408914));
  return [r, g, b].map(c => Math.pow(c, 2.2));
}
