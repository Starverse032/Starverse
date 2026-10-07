// c_firststar — S09 黑暗时代 · 第一颗星 (35.0 → 43.0, f840–1031).
//
//   35.0–37.0  the Dark Ages: true black, only the film grain of the post chain.
//   37.0 f888  the first star ignites at R — its FIRST frame is a 24×64 vertical rectangle of light
//              (the cursor's footprint, one of the film's three), warm cursor white, HDR 2.0.
//   f889–      a point-spread star (core FWHM 2 px), HDR 1 → 40 in 6 frames (easeOutQuad + a slight
//              overshoot), a short own anamorphic streak (±60 px), colour STAR #BFD4FF.
//   39.0       the second star at (1086, 422); from 39.0 the camera dollies straight back, uniformly,
//              z = 1 → 6 (distance to the first star ×6), the first star pinned on R.
//   40.0–43.0  ignition law N(t) = 2^((t − 40)/0.5), order = hop distance in the WEB graph (seed 1990)
//              from the first star: these stars ARE the nodes of S10's cosmic web (c_web/ignition.js
//              shares the law, so the cut at 43.0 continues the same process). ≈ 66 stars by 43.0.
//
// The universe makes no sound and has no colour but cold: blue-white stars on pure black.
// Cost: ~70 point sprites + one fullscreen pass on f888 only → ≈ 20–60 ms/frame.
import * as THREE from 'three';
import { ignition, T_FIRST } from './c_web/ignition.js';
import { solveCamera, firstStarPose, FOCAL } from './c_firststar/camera.js';

const FPS = 24;
const COUNT = 72;                                   // stars that can appear in S09 (rank < COUNT)
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => [srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255)];
const STAR = hex(0xBFD4FF), CURSOR = hex(0xF2EEE4);

export async function create(ctx) {
  const { renderer, W, H, kit, util } = ctx;
  const S = H / 1080;
  const I = ignition();
  const sol = solveCamera(I);
  const web = I.web;

  // ---- the first stars: web nodes in ignition order --------------------------------------------
  const pos = new Float32Array(COUNT * 3), tIgn = new Float32Array(COUNT), amp = new Float32Array(COUNT), temp = new Float32Array(COUNT), isFirst = new Float32Array(COUNT);
  const r = util.rng(55 * 1000 + 9);
  for (let k = 0; k < COUNT; k++) {
    const n = I.order[k];
    pos.set(web.nodes.subarray(3 * n, 3 * n + 3), 3 * k);
    tIgn[k] = I.tIgn[n];
    // peak HDR: the first star 40, the second 16, the rest lognormal (Population III stars are all
    // massive and hot: a narrow, bright distribution, weighted gently by the node's mass)
    const m = Math.pow(web.mass[n], 0.35);
    amp[k] = k === 0 ? 40 : k === 1 ? 16 : Math.min(26, 5.5 * m * Math.exp(0.55 * r.gauss()));
    temp[k] = k === 0 ? 16000 : 11000 + 14000 * r();
    isFirst[k] = k === 0 ? 1 : 0;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tIgn', new THREE.BufferAttribute(tIgn, 1));
  g.setAttribute('amp', new THREE.BufferAttribute(amp, 1));
  g.setAttribute('temp', new THREE.BufferAttribute(temp, 1));
  g.setAttribute('isFirst', new THREE.BufferAttribute(isFirst, 1));
  const uni = {
    uT: { value: 0 }, uS: { value: S }, uStar: { value: new THREE.Vector3(...STAR) },
    uRef: { value: sol.D0 }, uHalf: { value: 64 },
  };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: uni,
    vertexShader: ctx.GLSL.common + ctx.GLSL.color + /* glsl */ `
      attribute float tIgn, amp, temp, isFirst;
      uniform float uT, uS, uRef, uHalf; uniform vec3 uStar;
      varying vec3 vCol; varying float vI, vStreak;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float e = (uT - tIgn) * 24.0;                       // frames since ignition
        // the first star's frame 0 is the cursor footprint (drawn separately): its sprite starts at e = 1
        float e0 = e - isFirst;
        float on = step(0.0, e0) * step(0.0, e);
        float u = clamp(e0 / 6.0, 0.0, 1.0);
        float rise = 1.0 - (1.0 - u) * (1.0 - u);            // easeOutQuad over 6 frames
        float over = 1.0 + 0.10 * sin(3.14159 * clamp((e0 - 3.0) / 10.0, 0.0, 1.0));   // slight overshoot
        float lo = isFirst > 0.5 ? 1.0 / 40.0 : 0.04;        // the first star starts at HDR 1
        float peak = amp * mix(lo, 1.0, rise) * over;
        // dolly back: stars dim gently with distance (not 1/d²: they must stay stars, not vanish)
        float d = -mv.z;
        peak *= pow(clamp(uRef / d, 0.05, 4.0), 0.55);
        vI = peak * on;
        vStreak = isFirst > 0.5 ? 1.0 : clamp((amp - 8.0) / 14.0, 0.0, 1.0) * 0.7;
        vec3 bb = blackbody(temp); bb /= max(1e-3, dot(bb, vec3(0.2126, 0.7152, 0.0722)));
        vec3 st = uStar / dot(uStar, vec3(0.2126, 0.7152, 0.0722));
        vCol = mix(st, bb, 0.35);
        gl_PointSize = on > 0.0 ? 2.0 * uHalf * uS : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uS, uHalf; varying vec3 vCol; varying float vI, vStreak;
      void main(){
        vec2 q = (gl_PointCoord - 0.5) * 2.0 * uHalf;       // 1080p px from the star centre
        q.y = -q.y;
        float r2 = dot(q, q);
        // PSF: core FWHM 2 px (σ 0.85), a faint diffraction wing; bloom (post) adds the glow
        float core = exp(-0.5 * r2 / (0.85 * 0.85));
        float wing = 0.010 * exp(-sqrt(r2) / 3.5) + 0.0012 * exp(-sqrt(r2) / 14.0);
        // short anamorphic streak, ±60 px, thin
        float st = vStreak * 0.010 * exp(-abs(q.x) / 20.0) * exp(-0.5 * q.y * q.y / (0.9 * 0.9)) * smoothstep(64.0, 40.0, abs(q.x));
        float I = vI * (core + wing + st);
        gl_FragColor = vec4(vCol * I, 1.0);
      }`,
  });
  const stars = new THREE.Points(g, mat);
  stars.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(stars);
  const cam = kit.filmCamera(W, H, { focalMM: FOCAL, near: 0.5, far: 5000 });

  // ---- the cursor footprint (f888 only): 24×64 px vertical rectangle centred on R -----------------
  const foot = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes; uniform float uS; uniform vec3 uCol;
    void main(){
      vec2 sxy = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;   // 1080p px, top-left origin
      float inside = step(722.0, sxy.x) * step(sxy.x, 746.0) * step(508.0, sxy.y) * step(sxy.y, 572.0);
      gl_FragColor = vec4(uCol * 2.0 * inside, 1.0);
    }`, { uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uCol: { value: new THREE.Vector3(...CURSOR) } },
    { blending: THREE.AdditiveBlending, transparent: true });

  return {
    render(shot, f) {
      const t = f.t;
      const P = firstStarPose(sol, t);
      cam.position.copy(P.pos); cam.quaternion.copy(P.quat); cam.updateMatrixWorld();
      uni.uT.value = t;
      renderer.setRenderTarget(f.target);
      renderer.setClearColor(0x000000, 1); renderer.clear();
      if (t >= T_FIRST) renderer.render(scene, cam);
      const fr = Math.floor((t - T_FIRST) * FPS + 1e-4);
      if (fr === 0) foot.render(renderer, f.target);
    },
    post(shot, f) {
      // the stars draw their own short streak; the post streak would smear the 40-HDR core across the frame
      return { streak: 0.0, bloom: 0.7, bloomThreshold: 1.0 };
    },
  };
}
