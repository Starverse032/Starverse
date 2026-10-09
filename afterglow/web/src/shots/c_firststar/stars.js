// The first stars of S09 as a point-sprite layer, shared by c_firststar (S09) and c_web (S10, 43–45:
// the same sprites at the same pixels across the cut, crossfading into S10's own node stars).
//
//   createFirstStars(ctx, I, { uRef })  →  { points, uni }
//     uni.uT     global time (s)            uni.uZoom  FOCAL / focal (S09's zoom-out: 1 → 2.08; S10: 2.08)
//     uni.uGain  layer gain (S10 crossfade) uni.uRef   S09's reference distance D39
//
// Stars: web nodes in ignition order (rank < COUNT). Peak HDR: the first star 40, the second 16, the
// rest lognormal. Each sprite: core FWHM 2 px + Moffat wing + faint halation, a short own streak.
import * as THREE from 'three';

export const COUNT = 72;                            // stars that can appear in S09 (rank < COUNT)
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => [srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255)];
export const STAR = hex(0xBFD4FF);

export function createFirstStars(ctx, I, { uRef }) {
  const { util, H } = ctx;
  const S = H / 1080;
  const web = I.web;
  const pos = new Float32Array(COUNT * 3), tIgn = new Float32Array(COUNT), amp = new Float32Array(COUNT), temp = new Float32Array(COUNT), isFirst = new Float32Array(COUNT);
  const r = util.rng(55 * 1000 + 9);
  for (let k = 0; k < COUNT; k++) {
    const n = I.order[k];
    pos.set(web.nodes.subarray(3 * n, 3 * n + 3), 3 * k);
    tIgn[k] = I.tIgn[n];
    // peak HDR: the first star 40, the second 16, the rest lognormal (Population III stars are all
    // massive and hot: a narrow, bright distribution, weighted gently by the node's mass)
    const m = Math.pow(web.mass[n], 0.35);
    amp[k] = k === 0 ? 40 : k === 1 ? 16 : Math.min(30, 3.6 * m * Math.exp(0.95 * r.gauss()));
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
    uRef: { value: uRef }, uHalf: { value: 64 }, uZoom: { value: 1 }, uGain: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: uni,
    vertexShader: ctx.GLSL.common + ctx.GLSL.color + /* glsl */ `
      attribute float tIgn, amp, temp, isFirst;
      uniform float uT, uS, uRef, uHalf, uZoom, uGain; uniform vec3 uStar;
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
        // pull-back: stars dim gently with the framing distance d·zoom (not 1/d²: they must stay stars)
        float d = -mv.z * uZoom;
        // (the first star dims a little faster, HDR 40 → ≈ 9 by 43.0: its brightness on S10's first frame)
        peak *= pow(clamp(uRef / d, 0.05, 4.0), isFirst > 0.5 ? 0.83 : 0.55);
        vI = peak * on * uGain;
        vStreak = isFirst > 0.5 ? 1.0 : clamp((amp - 8.0) / 14.0, 0.0, 1.0) * 0.7;
        vec3 bb = blackbody(temp); bb /= max(1e-3, dot(bb, vec3(0.2126, 0.7152, 0.0722)));
        vec3 st = uStar / dot(uStar, vec3(0.2126, 0.7152, 0.0722));
        vCol = mix(st, bb, 0.35);
        gl_PointSize = (on > 0.0 && vI > 1e-4) ? 2.0 * uHalf * uS : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uS, uHalf; varying vec3 vCol; varying float vI, vStreak;
      void main(){
        vec2 q = (gl_PointCoord - 0.5) * 2.0 * uHalf;       // 1080p px from the star centre
        q.y = -q.y;
        float r2 = dot(q, q);
        // photographic PSF: brighter stars look bigger. Gaussian core (FWHM 2 px) + Moffat wing (β 2.5)
        // + a faint halation skirt; bloom (post) adds the glow
        float core = exp(-0.5 * r2 / (0.85 * 0.85));
        float wing = 0.045 * pow(1.0 + r2 / (1.8 * 1.8), -2.5) + 0.0010 * exp(-sqrt(r2) / 12.0);
        // short anamorphic streak, ±60 px, thin
        float st = vStreak * 0.010 * exp(-abs(q.x) / 20.0) * exp(-0.5 * q.y * q.y / (0.9 * 0.9)) * smoothstep(64.0, 40.0, abs(q.x));
        float I = vI * (core + wing + st);
        gl_FragColor = vec4(vCol * I, 1.0);
      }`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  return { points, uni, mat };
}
