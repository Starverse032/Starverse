// f_fire/night.js — S16 火星升空 (79.0 → 86.0) and S17 客星 (86.0 → 95.0 + 0.5 s dissolve).
//
// S16 · 35 mm, crane 0.4 → 1.2 m + tilt −5° → +62° (easeInOutSine over the 7 s), hand-held breath.
//   A real little night set around a campfire 3.2 m away (its luminous centre on R at the first frame):
//   displaced soil with ash and litter, a ring of basalt stones, a teepee of charred logs with glowing
//   cracks, a bed of coals, ~5000 dry grass blades (oriented ribbons) — all lit by ONE flickering fire
//   light with a baked soft shadow cube (static set, static light), rendered into a 4× MSAA layer
//   together with the in-focus flame (8 advected-noise sheets, blackbody 1200–1950 K) and 3000 analytic
//   sparks + 12 "hero" sparks (y = v·τ − 0.1·τ², swaying, yellow-white → dark red, motion-blurred
//   capsules, depth-tested against the set). The tilt crosses a ridge silhouette (1D fbm in azimuth,
//   slightly darker than the sky) between pitch +8° and +20°, and ends on the Milky Way running from
//   lower left to upper right. Focus pulls from the fire (3.2 m) to infinity during the tilt: the stars
//   start as soft discs and sharpen. The sparks are dead before 85.0 — they never reach the stars.
//
// S17 · 24 mm, locked off, breath 0.5 px (pinned to zero at the dissolve midpoint 95.25 so R is exact).
//   A ridge profile in screen space (mean y ≈ 600, a knoll with its crest at y = 548 under R, the
//   x 1100–1700 stretch pressed down to 620–640), a farther range in aerial haze, one acacia in
//   silhouette; the campfire is a tiny warm point at R lighting the crest, with a wisp of smoke rising
//   into the Milky Way. 88.0: the guest star at (1500, 270) — 36 frames from nothing to the brightest
//   thing in the sky (GUEST #DCE8FF, four diffraction spikes, a little scintillation, no red shell).
//   Card ② sits on the dark ground below the ridge (y ≈ 781): nothing is drawn there but darkness.
import * as THREE from 'three';
import { hex, RX, RY, fbm1, fbm3, breath, HAND_GLSL, handUniforms, setHand, merge, tag, ribbon, plain } from './common.js';
import { bakeGalaxy, skyFrame, SKY_GLSL, makeStars, L_SPAN, B_SPAN } from './sky.js';

const D2R = Math.PI / 180;
const T16 = 79.0, T17 = 86.0;
const FD = 3.2;                                    // S16: fire distance (m)
const FOC16 = 35, FOC17 = 24;
const FPX16 = 960 / (18 / FOC16);                  // 1080p px per unit tangent
const COCK = 0.5 * (0.035 * 0.035 / 2.8) * (1920 / 0.036);   // CoC radius px per dioptre (35 mm f/2.8)
const GUEST = hex(0xDCE8FF);
const G17 = [1500, 270];                           // guest star (1080p px)
const T_GUEST = 88.0;

export function createNight(ctx) {
  const { renderer, W, H, kit, GLSL, util } = ctx;
  const S = H / 1080;
  const { clamp, smoothstep: ss } = util;
  const rng = util.rng(55 * 1000 + 16);

  // =====================================================================================================
  // SKY (shared)
  // =====================================================================================================
  const gal = bakeGalaxy(ctx);
  const stars = makeStars(ctx, gal, { count: 420000, seed: 1616 });
  const starScene = new THREE.Scene(); starScene.add(stars.pts);
  stars.uniforms.uExt.value = 0.12;
  const hand = stars.uniforms;                         // { uHand, uHandC } shared by every layer
  const handU = { uHand: hand.uHand, uHandC: hand.uHandC };

  // cameras -----------------------------------------------------------------------------------------
  const cam16 = kit.filmCamera(W, H, { focalMM: FOC16, near: 0.05, far: 4000 });
  cam16.setViewOffset(W, H, (960 - RX) * S, (540 - RY) * S, W, H);
  cam16.rotation.order = 'YXZ';
  const pose16 = t => {
    const u = clamp((t - T16) / 7), e = (1 - Math.cos(Math.PI * u)) / 2;
    return { e, c: 0.4 + 0.8 * e, pitch: (-5 + 67 * e) * D2R };
  };
  const setCam16 = t => {
    const p = pose16(t);
    cam16.position.set(0, p.c, 0); cam16.rotation.set(p.pitch, 0, 0); cam16.updateMatrixWorld(); cam16.updateProjectionMatrix();
    return p;
  };
  const cam17 = kit.filmCamera(W, H, { focalMM: FOC17, near: 0.05, far: 4000 });
  cam17.setViewOffset(W, H, (960 - RX) * S, (540 - RY) * S, W, H);
  cam17.rotation.order = 'YXZ';
  cam17.position.set(0, 1.6, 0); cam17.rotation.set(5 * D2R, 0, 0); cam17.updateMatrixWorld(); cam17.updateProjectionMatrix();

  // sky placement (world → galactic): S16 composed on its last frame, S17 on its locked frame
  setCam16(T16 + 7);
  const M16 = skyFrame(cam16, [960, 480], 40, 13, -1.0);
  const M17 = skyFrame(cam17, [205, 640], 23, -2, 0.4);

  const invVP = cam => new THREE.Matrix4().multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
  const skyU = {
    ...handU, uInvVP: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uM: { value: new THREE.Matrix3() },
    uGal: { value: gal }, uL: { value: L_SPAN }, uB: { value: B_SPAN }, uGain: { value: 1 }, uAir: { value: 1 }, uExt: { value: 0.12 },
    uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S },
  };
  const RAY_GLSL = /* glsl */ `
    uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec2 uRes; uniform float uS;
    vec2 pix(){ return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS; }
    vec3 rayAt(vec2 px){ vec2 ndc = vec2(px.x / 1920.0 * 2.0 - 1.0, 1.0 - px.y / 1080.0 * 2.0); vec4 p = uInvVP * vec4(ndc, 1.0, 1.0); return normalize(p.xyz / p.w - uCamPos); }`;
  const skyPass = kit.fullscreen(HAND_GLSL + SKY_GLSL + RAY_GLSL + /* glsl */ `
    uniform mat3 uM; uniform sampler2D uGal; uniform float uL, uB, uGain, uAir, uExt;
    void main(){
      vec3 d = rayAt(handInv(pix()));
      float el = asin(clamp(d.y, -1.0, 1.0));
      vec3 col = skyBase(el, uAir) * mix(1.0, uGain, 0.5);
      col += galaxy(uGal, uM, d, uL, uB) * extinction(el, uExt) * uGain * 0.40;
      gl_FragColor = vec4(col, 1.0);
    }`, skyU);

  // ridge profiles ------------------------------------------------------------------------------------
  const NR = 2048;
  // S16: ridge elevation (deg) by azimuth (deg, 0 = towards the fire), az ∈ [−100, 100]
  const r16 = new Float32Array(NR * 4);
  for (let i = 0; i < NR; i++) {
    const az = -100 + 200 * i / (NR - 1);
    let el = 4.2 + 5.0 * (fbm1(az / 16 + 3.3, 5, 161) - 0.5) + 1.2 * (fbm1(az / 2.2, 4, 162) - 0.5) + 0.25 * (fbm1(az / 0.35, 3, 163) - 0.5);
    r16[4 * i] = el;
  }
  // S17: near ridge y(x) and far range y(x), 1080p px, x ∈ [−64, 1984]
  const r17 = new Float32Array(NR * 4);
  const ctrl = [[-64, 590], [120, 594], [330, 588], [520, 580], [640, 566], [700, 552], [734, 548], [768, 551], [830, 562], [930, 586],
    [1040, 610], [1120, 624], [1260, 633], [1420, 636], [1560, 630], [1700, 622], [1800, 607], [1984, 594]];
  const spline = x => {
    let k = 0; while (k < ctrl.length - 2 && x > ctrl[k + 1][0]) k++;
    const p0 = ctrl[Math.max(0, k - 1)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(ctrl.length - 1, k + 2)];
    const u = clamp((x - p1[0]) / (p2[0] - p1[0]));
    // centripetal-ish Catmull–Rom on y (x is monotone)
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * (p2[0] - p1[0]), m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * (p2[0] - p1[0]);
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
  };
  const det17 = x => 3.2 * (fbm1(x / 70 + 1.1, 5, 171) - 0.5) + 1.3 * (fbm1(x / 11, 4, 172) - 0.5) + 0.5 * (fbm1(x / 2.6, 3, 173) - 0.5)
    // a few low bushes on the crest line (rounded bumps)
    + [[330, 9, 26], [470, 6, 18], [905, 5, 16], [1185, 7, 22], [1610, 5, 18], [1850, 8, 24]].reduce((s, [c, h, w]) => s - h * Math.pow(Math.max(0, 1 - Math.pow((x - c) / w, 2)), 0.6), 0);
  const d734 = det17(734);
  for (let i = 0; i < NR; i++) {
    const x = -64 + 2048 * i / (NR - 1);
    const pin = ss(4, 44, Math.abs(x - 734));                 // the knoll crest is exactly y = 548 under R
    r17[4 * i] = spline(x) + (det17(x) - d734 * (1 - pin)) * (0.35 + 0.65 * pin);
    // the far range: a soft, lower-contrast line, only visible where the near ridge dips
    r17[4 * i + 1] = 603 + 9 * (fbm1(x / 160 + 7.0, 4, 174) - 0.5) + 2.0 * (fbm1(x / 25, 3, 175) - 0.5) + 0.0006 * Math.pow(x - 1350, 2) * 0.02;
  }
  const ridgeTex = (data) => { const t = new THREE.DataTexture(data, NR, 1, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
  const tex16 = ridgeTex(r16), tex17 = ridgeTex(r17);

  // the acacia (canvas2D silhouette): forked trunk, branching limbs, a flat umbrella crown of clumps
  const treeTex = (() => {
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
    limb(258, 286, Math.PI / 2 + 0.06, 86, 10, 0);                  // trunk
    const fx = 258 - Math.cos(Math.PI / 2 + 0.06) * 86, fy = 286 - 86 * Math.sin(Math.PI / 2 + 0.06);
    for (const [a, l, w] of [[2.35, 70, 6.5], [1.85, 62, 5.5], [1.25, 66, 6], [0.78, 74, 6.5]]) limb(fx, fy, a, l, w, 3);
    // crown: clumps on a flattened dome, denser at the top, ragged at the rim
    for (let i = 0; i < 520; i++) {
      const u = r() * 2 - 1;                                         // across the crown
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
  const TREE = { x: 1452, w: 186, h: 105 };                         // base centre x, size in 1080p px
  TREE.y = (() => { const i = Math.round((TREE.x + 64) / 2048 * (NR - 1)); return r17[4 * i] + 3; })();

  const C_FIRE17 = (() => { const c = bbCPU(1750); return c; })();
  const terU = {
    ...handU, uInvVP: skyU.uInvVP, uCamPos: skyU.uCamPos, uRes: skyU.uRes, uS: skyU.uS, uAir: skyU.uAir, uGain: skyU.uGain,
    uMode: { value: 0 }, uR16: { value: tex16 }, uR17: { value: tex17 }, uTree: { value: treeTex },
    uTreeR: { value: new THREE.Vector4(TREE.x - TREE.w / 2, TREE.y - TREE.h, TREE.w, TREE.h) },
    uEdge: { value: 0.03 }, uFire: { value: new THREE.Vector3() }, uRpt: { value: new THREE.Vector2(RX, RY) },
  };
  const terrain = kit.fullscreen(HAND_GLSL + SKY_GLSL + RAY_GLSL + /* glsl */ `
    uniform int uMode; uniform sampler2D uR16, uR17, uTree; uniform vec4 uTreeR; uniform float uEdge, uAir, uGain;
    uniform vec3 uFire; uniform vec2 uRpt;
    float prof(sampler2D T, float u, int ch){
      float fx = clamp(u, 0.0, 1.0) * 2047.0, i0 = floor(fx);
      vec4 a = texelFetch(T, ivec2(int(i0), 0), 0), b = texelFetch(T, ivec2(min(int(i0) + 1, 2047), 0), 0);
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
        col = vec3(0.00085, 0.00095, 0.0013) * mix(1.0, uGain, 0.5);
      } else {
        float u = (px.x + 64.0) / 2048.0;
        float yn = prof(uR17, u, 0), yf = prof(uR17, u, 1);
        float an = smoothstep(yn - 0.65, yn + 0.65, px.y);
        float af = smoothstep(yf - 0.9, yf + 0.9, px.y);
        vec2 tu = (px - uTreeR.xy) / uTreeR.zw;
        float at = 0.0;
        if (tu.x > 0.0 && tu.x < 1.0 && tu.y > 0.0 && tu.y < 1.0) at = texture2D(uTree, vec2(tu.x, 1.0 - tu.y)).r;
        an = max(an, at);
        vec3 far = skyBase(el, uAir) * 0.62 * mix(1.0, uGain, 0.5) + vec3(0.0004, 0.0005, 0.0008);
        // the dark land: starlight only, a hint of relief, warmed by the campfire on the knoll
        vec3 land = vec3(0.00055, 0.00062, 0.00085) * (0.8 + 0.4 * vnoise(px * vec2(0.012, 0.03)));
        vec2 q = (px - uRpt - vec2(0.0, 7.0)) / vec2(30.0, 7.5);
        float fg = exp(-dot(q, q)) + 0.25 * exp(-dot(q, q) * 0.12);
        float crest = smoothstep(yn + 14.0, yn, px.y);             // light grazes the top of the knoll
        land += uFire * (0.020 * fg * (0.35 + 0.65 * crest));
        col = mix(far, land, an);
        a = max(an, af);
      }
      gl_FragColor = vec4(col * a, a);
    }`, terU, { blending: THREE.CustomBlending, transparent: true });
  premult(terrain.material);

  // =====================================================================================================
  // S16 · THE SET
  // =====================================================================================================
  const FP = new THREE.Vector3(0, 0, -FD);           // fire centre on the ground
  const hG = (x, z) => {
    let h = 0.035 * (fbm3(x * 0.6, 0.3, z * 0.6, 4, 21) - 0.5) + 0.012 * (fbm3(x * 3.1, 1.7, z * 3.1, 3, 23) - 0.5);
    const r2 = (x - FP.x) ** 2 + (z - FP.z) ** 2;
    h -= 0.035 * Math.exp(-r2 / (0.33 * 0.33));       // the fire pit
    h -= 0.004 * Math.max(0, -z - 6);                 // the land falls away gently
    return h;
  };
  const parts = [], casters = [];
  const add = (g, mat, seed, cast = true) => { const gg = tag(g, { mat, seed }); parts.push(gg); if (cast) casters.push(gg); return gg; };
  // ground
  {
    const nx = 300, nz = 230, pos = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = -7 + 14 * i / (nx - 1), z = 0.3 - 45 * Math.pow(j / (nz - 1), 2.0), k = (j * nx + i) * 3;
      const xs = x * (1 + Math.max(0, -z) * 0.18);
      pos[k] = xs; pos[k + 1] = hG(xs, z); pos[k + 2] = z;
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let o = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    g.setAttribute('ru', new THREE.BufferAttribute(new Float32Array(nx * nz * 2), 2));
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
  for (let k = 0; k < 10; k++) {                       // the fire ring
    const a = k / 10 * Math.PI * 2 + 0.2 + (rng() - 0.5) * 0.25, rr = 0.47 + (rng() - 0.5) * 0.06;
    stone(FP.x + Math.cos(a) * rr, FP.z + Math.sin(a) * rr, 0.075 + rng() * 0.045, 0.62 + rng() * 0.2, 3 + k * 2.71);
  }
  for (let k = 0; k < 26; k++) {                       // stones scattered on the ground
    const x = (rng() - 0.5) * 7, z = -0.8 - rng() * 9;
    if (Math.hypot(x - FP.x, z - FP.z) < 0.7) continue;
    stone(x, z, 0.02 + Math.pow(rng(), 2) * 0.09, 0.5 + rng() * 0.3, 40 + k * 1.93, 24);
  }
  // logs: a teepee of five, two lying across the ring
  const log = (a, b, r, seed) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const g = plain(new THREE.CylinderGeometry(r * 0.8, r, len, 18, 14, false));
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
  const apex = FP.clone().add(new THREE.Vector3(0.02, 0.29, 0.0));
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + 0.75 + (rng() - 0.5) * 0.35, rr = 0.25 + rng() * 0.07;
    const base = [FP.x + Math.cos(a) * rr, hG(FP.x + Math.cos(a) * rr, FP.z + Math.sin(a) * rr) + 0.01, FP.z + Math.sin(a) * rr];
    const dir = apex.clone().sub(new THREE.Vector3(...base));
    const top = new THREE.Vector3(...base).addScaledVector(dir, 0.94 + 0.12 * rng());
    log(base, [top.x + (rng() - 0.5) * 0.05, top.y, top.z + (rng() - 0.5) * 0.05], 0.018 + rng() * 0.014, 0.37 + k * 0.29);
  }
  log([FP.x - 0.62, 0.035, FP.z + 0.18], [FP.x + 0.18, 0.06, FP.z - 0.05], 0.045, 0.91);
  log([FP.x + 0.55, 0.03, FP.z + 0.25], [FP.x - 0.05, 0.07, FP.z - 0.1], 0.04, 0.53);
  // the bed of coals
  {
    const g = plain(new THREE.CircleGeometry(0.26, 64, 0, Math.PI * 2));
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.012 * (fbm3(x * 30, 0.5, z * 30, 3, 9) - 0.3)); }
    g.computeVertexNormals(); g.translate(FP.x, hG(FP.x, FP.z) + 0.004, FP.z);
    add(g, 4, 0.5, false);
  }
  // dry grass
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
    const sideFn = (k, T) => new THREE.Vector3(-Math.sin(az), 0, Math.cos(az)).applyAxisAngle(T, twist * k / (n - 1) + seed).projectOnPlane(T).normalize();
    add(ribbon(pts, ws, { side: sideFn }), 2, seed % 1);
  };
  const tufts = [];
  for (let i = 0; i < 620; i++) {
    const a = rng() * Math.PI * 2, r = 0.9 + Math.pow(rng(), 0.9) * 8.5;
    const x = FP.x + Math.cos(a) * r * 1.2, z = FP.z + Math.sin(a) * r;
    if (z > -1.1) continue;
    tufts.push([x, z, 14 + Math.floor(rng() * 22), 0.16 + rng() * 0.4]);
  }
  // foreground tufts framing the fire (left and right of the line of sight)
  for (const [x, z, n, h] of [[-0.55, -1.45, 34, 0.42], [-0.95, -1.9, 28, 0.5], [0.62, -1.6, 30, 0.38], [1.05, -2.2, 26, 0.46], [-0.38, -2.35, 18, 0.3], [0.33, -2.6, 16, 0.28]]) tufts.push([x, z, n, h]);
  for (const [tx, tz, nb, ht] of tufts) {
    for (let i = 0; i < nb; i++) {
      const az = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 0.05;
      blade(tx + Math.cos(az) * rr, tz + Math.sin(az) * rr, ht * (0.4 + 0.75 * rng()), 0.003 + rng() * 0.0035,
        az + (rng() - 0.5) * 0.8, 0.12 + 0.45 * rng(), 0.2 + rng() * 1.1, (rng() - 0.5) * 3, i * 0.618 + tx * 7.1);
    }
  }
  const setGeo = merge(parts), casterGeo = merge(casters);

  // shadow cube from the (static) fire light — baked once; logs and coals do not cast
  const LP0 = FP.clone().add(new THREE.Vector3(0, 0.24, 0));
  const shadowCube = (() => {
    const distMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, uniforms: { uLight: { value: LP0 } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uLight; varying vec3 vW; void main(){ gl_FragColor = vec4(length(vW - uLight) / 50.0); }`,
    });
    const sc = new THREE.Scene(); const m = new THREE.Mesh(casterGeo, distMat); m.frustumCulled = false; sc.add(m);
    const rt = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true });
    const cc = new THREE.CubeCamera(0.01, 60, rt); cc.position.copy(LP0); sc.add(cc); cc.updateMatrixWorld();
    const pc = new THREE.Color(); renderer.getClearColor(pc); const pa = renderer.getClearAlpha();
    renderer.setClearColor(0xffffff, 1); cc.update(renderer, sc); renderer.setClearColor(pc, pa);
    distMat.dispose(); casterGeo.dispose();
    return rt.texture;
  })();

  const setU = {
    ...handU, uLP: { value: LP0.clone() }, uLC: { value: new THREE.Vector3() }, uShadow: { value: shadowCube }, uLP0: { value: LP0 },
    uFP: { value: FP }, uT: { value: 0 }, uSky: { value: new THREE.Vector3() }, uEmb: { value: 1 },
  };
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
      uniform vec3 uLP, uLC, uLP0, uFP, uSky; uniform samplerCube uShadow; uniform float uT, uEmb;
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
        vec3 P = vW, V = normalize(cameraPosition - P), N = normalize(vN);
        if (dot(N, V) < 0.0) N = -N;
        vec3 alb = vec3(0.1), emi = vec3(0.0); float trans = 0.0, h = 0.0; bool bump = false;
        float rf = length(P.xz - uFP.xz);
        float br = 0.8 + 0.12 * sin(6.2832 * 0.43 * uT + rf * 9.0) + 0.08 * sin(6.2832 * 0.67 * uT - rf * 13.0);
        if (vMat < 0.5) {                                      // soil, ash, dry litter
          vec2 q = P.xz;
          float n1 = fbm(q * 2.3, 4), n2 = fbm(q * 19.0 + 7.0, 3), n3 = fbm(q * 0.7 + 3.0, 3);
          vec3 soil = mix(vec3(0.050, 0.036, 0.026), vec3(0.095, 0.068, 0.045), smoothstep(0.3, 0.7, n1)) * (0.7 + 0.6 * n2);
          float litter = smoothstep(0.45, 0.62, fbm(q * 4.0 + 11.0, 4)) * smoothstep(0.7, 1.4, rf);
          vec3 straw = vec3(0.22, 0.16, 0.085) * (0.6 + 0.8 * vnoise(q * vec2(90.0, 23.0)));
          alb = mix(soil, straw, litter * 0.8) * (0.85 + 0.3 * n3);
          // the pit: patchy grey ash, charcoal flecks, scorched soil — never a flat disc
          float n4 = fbm(q * 7.0 + 4.0, 4);
          float ash = smoothstep(0.66, 0.30, rf + 0.12 * (n4 - 0.5) + 0.05 * (n2 - 0.5));
          vec3 ashC = mix(vec3(0.035, 0.03, 0.027), vec3(0.12, 0.115, 0.108), smoothstep(0.35, 0.7, n4)) * (0.6 + 0.7 * n2);
          float fleck = step(0.8, vnoise(q * 140.0)) * ash;
          ashC = mix(ashC, vec3(0.012, 0.010, 0.009), fleck);
          alb = mix(alb, ashC, ash * 0.9);
          alb = mix(alb, vec3(0.025, 0.022, 0.02), smoothstep(0.36, 0.28, rf) * 0.7);
          h = n2 * 0.004 + litter * 0.002 * vnoise(q * 60.0); bump = true;
        } else if (vMat < 1.5) {                               // basalt stones
          vec3 q = P * 18.0 + vSeed * 31.0;
          float n1 = fbm(q, 4), n2 = fbm(q * 5.0, 3);
          alb = mix(vec3(0.045, 0.043, 0.041), vec3(0.11, 0.095, 0.08), fract(vSeed * 7.3)) * (0.6 + 0.8 * n1) * (0.85 + 0.3 * n2);
          float soot = smoothstep(0.75, 0.4, rf) * smoothstep(0.05, 0.12, P.y - uFP.y) * 0.0;
          h = n1 * 0.004 + n2 * 0.0015; bump = true;
        } else if (vMat < 2.5) {                               // dry grass
          float sd = vSeed;
          vec3 straw = mix(vec3(0.42, 0.31, 0.16), vec3(0.30, 0.25, 0.16), fract(sd * 3.7));
          straw = mix(straw, vec3(0.20, 0.15, 0.10), step(0.82, fract(sd * 11.3)));
          alb = straw * (0.8 + 0.2 * vnoise(vec2(vRu.y * 4.0 + sd * 50.0, vRu.x * 40.0))) * mix(0.5, 1.05, smoothstep(0.0, 0.35, vRu.x));
          trans = 0.55;
        } else if (vMat < 3.5) {                               // charred logs, glowing cracks near the flames
          vec3 q = P * 70.0;
          float ashp = smoothstep(0.55, 0.8, fbm(q * 0.5, 3));
          alb = mix(vec3(0.018, 0.015, 0.013), vec3(0.13, 0.125, 0.12), ashp);
          float hot = smoothstep(0.24, 0.04, length(P - uFP - vec3(0.0, 0.10, 0.0))) * smoothstep(0.30, 0.05, P.y - uFP.y);
          if (hot > 0.01) {
            vec2 w = worley(q * 1.3 + vec3(0.0, uT * 0.03, 0.0));
            float crack = 1.0 - smoothstep(0.015, 0.09, w.y - w.x);
            float g = (crack * 1.6 * smoothstep(0.35, 0.6, vnoise(q.xy * 0.4 + q.z)) + 0.06) * hot * hot * br * (1.0 - ashp * 0.8);
            emi = blackbody(mix(1000.0, 1380.0, clamp(g * 0.4, 0.0, 1.0))) * g * 1.6;
          }
          h = fbm(q, 3) * 0.002; bump = true;
        } else {                                               // the bed of coals
          vec3 q = vec3(P.xz * 38.0, uT * 0.05);
          vec2 w = worley(q);
          float edge = 1.0 - smoothstep(0.03, 0.22, w.y - w.x);
          float core = smoothstep(0.26, 0.0, rf);
          float n = vnoise(P.xz * 14.0 + uT * 0.15);
          float g = (edge * 1.4 + 0.5 * (1.0 - w.x)) * core * (0.6 + 0.7 * n) * br;
          alb = vec3(0.03, 0.025, 0.022) * (1.0 - edge);
          emi = blackbody(mix(950.0, 1450.0, clamp(g * 0.6, 0.0, 1.0))) * g * 2.2;
        }
        if (bump) N = bumpN(P, N, h);
        vec3 Lv = uLP - P; float d2 = dot(Lv, Lv); vec3 L = Lv * inversesqrt(d2);
        float att = 1.0 / (d2 + 0.0225);
        float vis = (vMat > 2.5) ? 1.0 : shadowVis(P);
        float nl = dot(N, L);
        vec3 col = alb / PI * (max(nl, 0.0) + trans * max(-nl, 0.0) * vec3(1.0, 0.8, 0.55)) * att * vis * uLC;
        col += alb * uSky * (0.55 + 0.45 * N.y);
        col += emi * uEmb;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const setMesh = new THREE.Mesh(setGeo, setMat); setMesh.frustumCulled = false;

  // flame: 8 vertical sheets of advected noise around the teepee (world space, camera-facing about y)
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
  const flU = { ...handU, uT: { value: 0 }, uF: { value: 1 }, uBase: { value: FP.clone().add(new THREE.Vector3(0, 0.03, 0)) }, uNoise: { value: noiseTex }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uFwd: { value: new THREE.Vector3(0, 0, -1) } };
  const flMat = new THREE.ShaderMaterial({
    uniforms: flU, depthTest: true, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: HAND_GLSL + /* glsl */ `
      attribute vec2 corner; attribute vec4 par; attribute vec2 par2;
      uniform vec3 uBase, uRight, uFwd; varying vec2 vQ; varying vec2 vP;
      void main(){
        vec3 w = uBase + uRight * (par.x * (1.0 - 0.35 * corner.y) + corner.x * par.y) + vec3(0.0, corner.y * par.z, 0.0) + uFwd * par2.x;
        vQ = corner; vP = vec2(par.w, par2.y);
        gl_Position = handClip(projectionMatrix * viewMatrix * vec4(w, 1.0));
      }`,
    fragmentShader: GLSL.common + /* glsl */ `
      uniform float uT, uF; uniform sampler2D uNoise; varying vec2 vQ; varying vec2 vP;
      void main(){
        float y = vQ.y, sd = vP.x;
        float spd = 1.4 + 0.6 * sd;
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
        float T = mix(1250.0, 1950.0, clamp(core * 0.9 + (1.0 - y) * 0.25 + (n2.b - 0.5) * 0.2, 0.0, 1.0));
        vec3 c = blackbody(T) * (dens * 0.9 + core * 1.6) * vP.y;
        c += vec3(0.30, 0.22, 0.10) * core * core * vP.y;
        gl_FragColor = vec4(c * uF * 1.4, 0.0);
      }`,
  });
  addOnly(flMat);
  const flMesh = new THREE.Mesh(shGeo, flMat); flMesh.frustumCulled = false; flMesh.renderOrder = 2;

  // sparks: 3000 cycling + 12 heroes (analytic, see header) ---------------------------------------------
  const NSP = 3000, NHERO = 12;
  const spGeo = new THREE.InstancedBufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
  spGeo.setIndex([0, 1, 2, 1, 3, 2]);
  {
    const A = new Float32Array((NSP + NHERO) * 4), B = new Float32Array((NSP + NHERO) * 4);
    const r = util.rng(1606);
    for (let i = 0; i < NSP; i++) { A.set([0, 0, 0, r() * 4.0 + 70.0], 4 * i); B.set([r(), 0, 0, 0], 4 * i); }
    for (let i = 0; i < NHERO; i++) {
      const tb = 78.45 + 0.6 * i / (NHERO - 1) + (r() - 0.5) * 0.08;
      const life = Math.min(6.0, 84.92 - tb) - r() * 0.15;
      A.set([FP.x + (r() - 0.5) * 0.12, 0.30 + r() * 0.12, FP.z + (r() - 0.5) * 0.1, tb], 4 * (NSP + i));
      B.set([r(), 1, life, 1.62 + 0.22 * r()], 4 * (NSP + i));
    }
    spGeo.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
    spGeo.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
    spGeo.instanceCount = NSP + NHERO;
  }
  const spU = {
    ...handU, uT: { value: 0 }, uShut: { value: 0.5 / 24 }, uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S },
    uFP: { value: FP }, uInvDF: { value: 1 / FD }, uCocK: { value: COCK }, uGain: { value: 1 },
  };
  const spMat = new THREE.ShaderMaterial({
    uniforms: spU, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    vertexShader: GLSL.common + HAND_GLSL + /* glsl */ `
      attribute vec4 iA, iB;
      uniform float uT, uShut, uS, uInvDF, uCocK, uGain; uniform vec2 uRes; uniform vec3 uFP;
      varying vec2 vA, vB; varying float vI, vRad; varying vec3 vCol;
      // state of spark (A, B) for the cycle that contains time t
      void sparkInit(float t, out vec3 p0, out float v, out float life, out float tau, out float I0, out float amp, out vec4 ph){
        if (iB.y < 0.5) {
          float P = 4.0, k = floor((t - iA.w) / P);
          tau = t - iA.w - k * P;
          vec3 h1 = hash33(vec3(iB.x * 1000.0, k, 1.7)), h2 = hash33(vec3(iB.x * 1000.0, k, 5.3)), h3 = hash33(vec3(iB.x * 1000.0, k, 9.1));
          v = mix(0.45, 1.45, h1.x); life = 2.5 + 1.5 * h1.y; I0 = mix(4.0, 26.0, pow(h1.z, 2.5));
          if (hash12(vec2(iB.x * 777.0, k)) > 0.7) life = -1.0;          // the fire breathes: most cycles stay dark
          p0 = uFP + vec3((h2.x - 0.5) * 0.16, 0.18 + 0.30 * h2.y, (h2.z - 0.5) * 0.14);
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
        float cool = iB.y < 0.5 ? exp(-tau / 1.5) : exp(-tau / 4.5);           // sparks cool fast; heroes burn longer
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

  const setScene = new THREE.Scene(); setScene.add(setMesh, flMesh, spMesh);
  const nearRT = ctx.makeRT(W, H, { depth: true, samples: 4 });
  const nearComp = kit.fullscreen(/* glsl */ `uniform sampler2D tex; void main(){ gl_FragColor = texture2D(tex, vUv); }`, { tex: { value: nearRT.texture } }, { blending: THREE.CustomBlending, transparent: true });
  premult(nearComp.material);

  // =====================================================================================================
  // S17 · SCREEN-SPACE SPRITES: campfire point, smoke, guest star
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
  const fireSpr = sprite(RX - 60, RY - 60, RX + 60, RY + 60, /* glsl */ `
    uniform vec3 uCol; uniform float uI; uniform vec2 uR;
    void main(){
      vec2 d = vPx - uR;
      float core = exp(-0.5 * (d.x * d.x / 0.95 + (d.y + 0.6) * (d.y + 0.6) / 2.1));
      float glow = exp(-length(d) / 5.0) * 0.045 + exp(-length(d) / 18.0) * 0.009;
      gl_FragColor = vec4(uCol * uI * (core + glow) + vec3(0.25, 0.18, 0.08) * uI * core * core, 1.0);
    }`, { uCol: { value: new THREE.Vector3(...C_FIRE17) }, uI: { value: 5 }, uR: { value: new THREE.Vector2(RX, RY) } });
  // the wisp of smoke: a thin ribbon rising from the fire at R into the Milky Way, leaning a little to
  // the right in the upper air and meandering slowly; warm where the flame lights it (first ~40 px),
  // a faint cool grey above (lit by the sky), thinning as it spreads; it also dims what is behind it
  const smokeSpr = sprite(600, 70, 940, 548, /* glsl */ `
    uniform float uT; uniform sampler2D uNoise; uniform vec3 uFire; uniform vec2 uR;
    void main(){
      float h = uR.y - vPx.y;                                    // px above the fire
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
      float dens = body * mix(0.12, 1.0, brk) * smoothstep(-2.0, 6.0, h) * smoothstep(470.0, 280.0, h)
                 * clamp(9.0 / (wd + 6.0), 0.0, 1.0);
      float a = clamp(dens * 0.5, 0.0, 0.35);
      vec3 emi = uFire * (0.30 * exp(-h / 14.0) + 0.030 * exp(-h / 45.0)) * dens
               + vec3(0.0240, 0.0275, 0.0340) * dens * smoothstep(10.0, 90.0, h);
      gl_FragColor = vec4(emi, a);
    }`, { uT: { value: 0 }, uNoise: { value: noiseTex }, uFire: { value: new THREE.Vector3(...C_FIRE17) }, uR: { value: new THREE.Vector2(RX, RY) } }, 'over');
  const guestSpr = sprite(G17[0] - 260, G17[1] - 260, G17[0] + 260, G17[1] + 260, /* glsl */ `
    uniform vec3 uCol; uniform float uI, uSp; uniform vec2 uG;
    void main(){
      vec2 d = vPx - uG; float r = length(d);
      float core = exp(-0.5 * r * r / 1.25) ;
      float halo = exp(-r / 4.5) * 0.06 + exp(-r / 22.0) * 0.006;
      // four diffraction spikes (a slightly rotated cross), tapering, with a faint chromatic rim
      vec2 e = rot2(0.14) * d;
      float sp = exp(-0.5 * e.y * e.y / 0.55) * exp(-abs(e.x) / (uSp * 0.16)) + exp(-0.5 * e.x * e.x / 0.55) * exp(-abs(e.y) / (uSp * 0.16));
      sp *= 0.06 * (1.0 + 0.25 * sin(r * 0.9));
      vec3 c = uCol * (core + halo + sp) + vec3(0.08, 0.06, -0.02) * halo;
      gl_FragColor = vec4(max(c, 0.0) * uI, 1.0);
    }`, { uCol: { value: new THREE.Vector3(...GUEST) }, uI: { value: 0 }, uSp: { value: 100 }, uG: { value: new THREE.Vector2(...G17) } });

  // =====================================================================================================
  // TIME CURVES
  // =====================================================================================================
  const nz = (t, fr, s) => util.shake(t, s, fr, 1)[0];
  const flick = t => 1 + 0.13 * nz(t, 6.5, 41) + 0.07 * nz(t, 13.0, 43) + 0.10 * nz(t, 2.1, 47);
  const C_FL = bbCPU(1950);
  const setSky = (cam, M, gain, air) => {
    skyU.uInvVP.value.copy(invVP(cam)); skyU.uCamPos.value.copy(cam.position); skyU.uM.value.copy(M);
    skyU.uGain.value = gain; skyU.uAir.value = air;
    stars.setFrame(M); stars.uniforms.uGain.value = gain;
  };

  function renderS16(t, f) {
    const p = setCam16(t);
    setHand(hand, breath(util, t, { px: 1.5, deg: 0.15, hz: 0.3, seed: 15 }));
    // the sky must already be there when the ridge crosses the frame (pitch +8° → +20°, e ≈ 0.2–0.37):
    // the focus pull (fire → infinity) lands by e ≈ 0.26 and the sky gain is ≥ 85 % by then, so the
    // ridge silhouettes against stars instead of against black
    const gain = 0.75 + 0.25 * ss(0.0, 0.5, p.e);
    const invDF = (1 / FD) * (1 - ss(0.04, 0.26, p.e));         // focus pull: fire → infinity
    setSky(cam16, M16, gain, 2.2);
    stars.uniforms.uFieldLow.value = 2.6;                       // stars down to the ridge (see sky.js)
    skyPass.render(renderer, f.target);
    stars.uniforms.uCoc.value = Math.min(6, COCK * invDF);
    renderer.setRenderTarget(f.target); renderer.render(starScene, cam16);
    terU.uMode.value = 0; terU.uEdge.value = Math.max(0.6, COCK * invDF) / FPX16 / D2R;
    terrain.render(renderer, f.target);
    // the set (MSAA layer): visible while the camera still looks down at the ground
    const fk = flick(t);
    const lc = C_FL.map(c => c * 11 * fk);
    setU.uLC.value.set(...lc); setU.uT.value = t;
    setU.uLP.value.copy(LP0).add(new THREE.Vector3(0.03 * nz(t, 2.8, 51), 0.04 * nz(t, 3.7, 53), 0.03 * nz(t, 3.1, 57)));
    setU.uSky.value.set(0.0012, 0.0016, 0.0026).multiplyScalar(gain);
    setMesh.visible = p.pitch < 24 * D2R;
    flMesh.visible = p.pitch < 18 * D2R;
    flU.uT.value = t; flU.uF.value = 0.92 + 0.08 * fk;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam16.quaternion); right.y = 0; right.normalize();
    flU.uRight.value.copy(right); flU.uFwd.value.set(-right.z, 0, right.x);
    spU.uT.value = t; spU.uInvDF.value = invDF;
    nearRT.scissor.set(0, Math.floor(f.barPx), W, H - 2 * Math.floor(f.barPx)); nearRT.scissorTest = true;
    renderer.setRenderTarget(nearRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false); renderer.setClearColor(0x000000, 1);
    renderer.render(setScene, cam16);
    nearComp.render(renderer, f.target);
  }

  function renderS17(t, f) {
    setHand(hand, breath(util, t, { px: 0.5, deg: 0.05, hz: 0.3, seed: 17, zeroAt: 95.25 }));
    setSky(cam17, M17, 1.0, 1.9);
    stars.uniforms.uFieldLow.value = 1.0;
    skyPass.render(renderer, f.target);
    stars.uniforms.uCoc.value = 0;
    renderer.setRenderTarget(f.target); renderer.render(starScene, cam17);
    const fk = flick(t);
    terU.uMode.value = 1; terU.uFire.value.set(...C_FIRE17.map(c => c * fk));
    terrain.render(renderer, f.target);
    smokeSpr.u.uT.value = t;
    renderer.setRenderTarget(f.target); renderer.render(smokeSpr.scene, orthoCam);
    fireSpr.u.uI.value = 5.5 * (0.85 + 0.15 * fk);
    renderer.render(fireSpr.scene, orthoCam);
    if (t >= T_GUEST) {
      const u = clamp((t - T_GUEST) / 1.5);
      const rise = 1 - Math.pow(1 - u, 2.2);
      const sc = 1 + 0.07 * nz(t, 7.3, 61) + 0.05 * nz(t, 12.9, 63);   // scintillation
      guestSpr.u.uI.value = 26 * rise * sc;
      guestSpr.u.uSp.value = 25 + 55 * rise;
      renderer.render(guestSpr.scene, orthoCam);
    }
  }

  return {
    render(shot, f) {
      renderer.setRenderTarget(f.target); renderer.setClearColor(0x000000, 1); renderer.clear();
      if (shot.id === 'S16') renderS16(f.t, f); else renderS17(f.t, f);
      renderer.setRenderTarget(f.target);
    },
    post(shot, f) {
      if (shot.id === 'S16') return { exposure: 1.0, bloom: 0.8, bloomThreshold: 1.0, streak: 0.16, streakTint: [1.0, 0.75, 0.5], vignette: 0.26, grain: 0.04 };
      return { exposure: 1.0, bloom: 0.75, bloomThreshold: 1.0, streak: 0.2, streakTint: [0.7, 0.8, 1.0], vignette: 0.24, grain: 0.04 };
    },
  };
}

// additive colour, destination alpha (coverage) untouched
function addOnly(m) {
  m.blending = THREE.CustomBlending; m.transparent = true;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; m.blendEquation = THREE.AddEquation;
  m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; m.blendEquationAlpha = THREE.AddEquation;
}
// premultiplied-alpha "over" blending
function premult(m) {
  m.blending = THREE.CustomBlending; m.transparent = true;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation;
  m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; m.blendEquationAlpha = THREE.AddEquation;
}
// CPU blackbody (same fit as GLSL.blackbody), linear
function bbCPU(T) {
  T = Math.min(40000, Math.max(1000, T)) / 100;
  const r = T <= 66 ? 1 : Math.min(1, 1.29293618606 * Math.pow(T - 60, -0.1332047592));
  const g = T <= 66 ? Math.min(1, Math.max(0, 0.39008157876 * Math.log(T) - 0.63184144378)) : Math.min(1, 1.12989086089 * Math.pow(T - 60, -0.0755148492));
  const b = T >= 66 ? 1 : T <= 19 ? 0 : Math.min(1, Math.max(0, 0.54320678911 * Math.log(T - 10) - 1.19625408914));
  return [r, g, b].map(c => Math.pow(c, 2.2));
}
