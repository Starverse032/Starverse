// c_afterglow — S07 闪 (the Big Bang flash: the only full-white frames of the film) and
// S08 最古老的光 (the oldest light: opaque boiling plasma → decoupling → cooling to black).
//
// One continuous function of global time t drives both shots, so the 8-frame S07 → S08 dissolve
// blends two identical images (S07 keeps rendering past its end with the same field).
//
//   S07 25.000–27.000  f600 point 1.5 at R (= S06's last frame) · f601 30 · f602 1e4 (expanding light)
//                      f603–615 full-frame clipped warm white #FFF4E0 (dithered by post grain/dither)
//                      f601–612 full-width anamorphic line at y = 540 (core 6 px, halo 60 px, #CFE0FF)
//                      f616–647 the white "opens" onto the plasma: contrast 0 → 1, 6500 K → 4500 K
//   S08 27.000–35.000  24 mm, yaw +8° and roll 1.5° (uniform). Direction-space shader:
//                      F_far  = band-pass Gaussian random field (sum of rotated simplex layers in a
//                               narrow band, peak ≈ 1° ≈ 26 px, + a ×0.3 secondary peak), baked once
//                               into a gnomonic (tangent-plane) texture with mipmaps;
//                      F_near = 4-octave domain-warped fbm "boiling plasma", half resolution,
//                               flowing with t_w = min(t, 30) (frozen at decoupling).
//                      30.0–31.0 decoupling: fog contrast → 0, speckle blur σ 6 px → 1 px (mip LOD).
//                      colour = blackbody(T·(1 + 0.12 (F − 0.5))) with T 4500 → 3000 (31) → 1500 K (34);
//                      exposure 0 → −1 EV (31) → −7 EV (35), then a final roll-off so 35.0 is true black.
//
// Cost (1080p, SwiftShader): main pass ≈ 0.15 s, fog pass (half res) ≈ 0.1 s; bake ≈ 1.5 s in create().
import * as THREE from 'three';

const FPS = 24;
const T_FLASH = 25.0;       // S07 start (f600)
const T_FIELD = 27.0;       // S08 start
const T_DEC = 30.0;         // decoupling
const T_END = 35.0;         // must be black

// tangent-plane window baked for F_far (camera yaw 0..8°, roll ≤1.5°, 24 mm: tan(hFOV/2) = 0.75)
const PLANE = { x0: -0.86, x1: 1.12, y0: -0.44, y1: 0.44 };
const TAN_H = 18 / 24;      // 36 mm gauge, 24 mm (screenplay §2.1 conversion table)

// --- ACES fitted (same as post.js), for solving the HDR value that displays #FFF4E0 -------------
function acesFitted(c) {
  const inM = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
  const outM = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
  const mul = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const v = mul(inM, c).map(x => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.4329510) + 0.238081));
  return mul(outM, v);
}
// Newton solve: HDR rgb whose ACES output equals `target` (linear display); R is pushed past the clip.
function inverseAces(target) {
  let x = [8, 4, 2];
  for (let it = 0; it < 60; it++) {
    const y = acesFitted(x), e = 1e-3;
    const J = [0, 1, 2].map(j => { const xp = x.slice(); xp[j] += e; const yp = acesFitted(xp); return yp.map((v, i) => (v - y[i]) / e); });
    // solve J^T (columns are d y / d x_j) — 3×3 via Cramer
    const A = [[J[0][0], J[1][0], J[2][0]], [J[0][1], J[1][1], J[2][1]], [J[0][2], J[1][2], J[2][2]]];
    const r = target.map((t, i) => t - y[i]);
    const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const D = det(A); if (Math.abs(D) < 1e-12) break;
    const dx = [0, 1, 2].map(k => det(A.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)))) / D);
    x = x.map((v, i) => Math.max(0.01, v + dx[i]));
  }
  return x;
}
const srgbToLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export async function create(ctx) {
  const { renderer, W, H, kit, util } = ctx;
  const { clamp, lerp, smoothstep } = util;

  // ---------------------------------------------------------------------------------------------
  // F_far: band-pass Gaussian random field on directions, baked into the tangent plane.
  // Seven rotated simplex layers in a narrow band around f0 (≈1° hot spots) + three layers at ≈2.3 f0
  // (×0.3, the secondary acoustic peak) + one weak large-scale layer. Normalised to unit variance.
  // ---------------------------------------------------------------------------------------------
  const BW = 3072, BH = 1376;
  const farTex = kit.bake(renderer, {
    w: BW, h: BH, wrap: THREE.ClampToEdgeWrapping, mipmaps: true,
    uniforms: { plane: { value: new THREE.Vector4(PLANE.x0, PLANE.x1, PLANE.y0, PLANE.y1) } },
    frag: /* glsl */ `
      uniform vec4 plane;
      mat3 rmat(float a, float b, float c){ return rotZ(c) * rotY(b) * rotX(a); }
      void main(){
        vec3 d = normalize(vec3(mix(plane.x, plane.y, vUv.x), mix(plane.z, plane.w, vUv.y), -1.0));
        const float f0 = 30.0;
        float s = 0.0;
        // main band (peak ≈ 1°)
        s += 1.00 * snoise(rmat(0.3, 1.1, 2.0) * d * f0 * 0.82 + vec3(1.3, 7.1, 3.3));
        s += 1.00 * snoise(rmat(1.7, 0.2, 0.9) * d * f0 * 0.91 + vec3(9.1, 2.4, 5.7));
        s += 1.00 * snoise(rmat(2.5, 2.9, 0.4) * d * f0 * 1.00 + vec3(4.4, 8.8, 1.2));
        s += 1.00 * snoise(rmat(0.9, 1.9, 2.7) * d * f0 * 1.07 + vec3(6.6, 3.1, 9.9));
        s += 0.90 * snoise(rmat(2.1, 0.7, 1.5) * d * f0 * 1.16 + vec3(2.2, 5.5, 7.7));
        s += 0.75 * snoise(rmat(1.2, 2.4, 0.1) * d * f0 * 1.30 + vec3(8.3, 0.6, 4.1));
        s += 0.60 * snoise(rmat(0.5, 0.4, 1.8) * d * f0 * 0.70 + vec3(3.9, 6.2, 2.8));
        // secondary peak (×0.3)
        s += 0.32 * snoise(rmat(2.8, 1.3, 2.2) * d * f0 * 2.25 + vec3(5.1, 1.9, 8.4));
        s += 0.30 * snoise(rmat(1.4, 2.6, 1.1) * d * f0 * 2.45 + vec3(7.4, 4.6, 0.3));
        s += 0.26 * snoise(rmat(0.2, 0.8, 2.9) * d * f0 * 2.70 + vec3(0.8, 9.3, 6.0));
        // weak large-scale modulation (the sky is not perfectly uniform in contrast)
        float big = snoise(d * 3.2 + vec3(2.0, 4.0, 1.0));
        s *= 0.85 + 0.25 * big;
        s += 0.55 * snoise(rmat(1.0, 0.5, 0.2) * d * f0 * 0.28 + vec3(1.0, 2.0, 3.0));
        // unit variance (simplex σ ≈ 0.31 per layer; Σw² ≈ 6.9)
        float F = s / (0.31 * sqrt(6.9));
        gl_FragColor = vec4(F, big, 0.0, 1.0);
      }`,
  });
  farTex.minFilter = THREE.LinearMipmapLinearFilter; farTex.magFilter = THREE.LinearFilter;

  // ---------------------------------------------------------------------------------------------
  // Shared GLSL: pixel → world direction for the S08 camera (24 mm, yaw, roll).
  // ---------------------------------------------------------------------------------------------
  const DIR = /* glsl */ `
    uniform vec2 uRes; uniform float uTanH, uYaw, uRoll;
    vec3 viewDir(vec2 sxy){            // sxy: pixel coords, origin top-left
      vec2 n = (sxy - 0.5 * uRes) / (0.5 * uRes.x);
      vec3 r = normalize(vec3(n.x * uTanH, -n.y * uTanH, -1.0));
      r.xy = rot2(uRoll) * r.xy;
      r = rotY(-uYaw) * r;
      return r;
    }`;

  // half-resolution boiling plasma (F_near)
  const fogRT = new kit.LowRes(W, H, 0.5);
  const fogUni = {
    uRes: { value: new THREE.Vector2(W, H) }, uTanH: { value: TAN_H }, uYaw: { value: 0 }, uRoll: { value: 0 },
    uTw: { value: 0 },
  };
  const fogPass = kit.fullscreen(DIR + /* glsl */ `
    uniform float uTw;
    void main(){
      vec3 d = viewDir(vec2(vUv.x, 1.0 - vUv.y) * uRes);
      vec3 p = d * 2.6 + vec3(0.0, 0.0, uTw * 0.045);
      // domain warp (2 octaves) drifting with time, then 4-octave fbm: plasma that boils
      vec3 w1 = vec3(fbm(p * 1.3 + vec3(0.0, uTw * 0.06, 0.0), 2), fbm(p * 1.3 + vec3(5.2, 1.3, uTw * 0.05), 2), fbm(p * 1.3 + vec3(2.7, 8.1, -uTw * 0.04), 2));
      float f = fbm(p + 1.8 * (w1 - 0.5) + vec3(0.0, -uTw * 0.03, 0.0), 4);
      gl_FragColor = vec4(f, w1.x, 0.0, 1.0);
    }`, fogUni);

  // full-resolution composite
  const uni = {
    uRes: { value: new THREE.Vector2(W, H) }, uTanH: { value: TAN_H }, uYaw: { value: 0 }, uRoll: { value: 0 },
    uS: { value: H / 1080 },
    tFar: { value: farTex }, tFog: { value: fogRT.texture },
    uPlane: { value: new THREE.Vector4(PLANE.x0, PLANE.x1, PLANE.y0, PLANE.y1) },
    uTexel: { value: new THREE.Vector2(1 / BW, 1 / BH) },
    uLod: { value: 0 }, uAmpFar: { value: 0 }, uAmpFog: { value: 0 }, uContrast: { value: 0 },
    uTemp: { value: 4500 }, uGain: { value: 1 },
    uWhite: { value: new THREE.Vector3(1, 1, 1) }, uWhiteMix: { value: 0 },
    uR: { value: new THREE.Vector2(734.5, 540.5) },
    uFlashP: { value: 0 }, uFlashSig: { value: 1.6 }, uHaloA: { value: 0 }, uHaloR: { value: 50 },
    uLineA: { value: 0 }, uFrame: { value: 0 },
  };
  const main = kit.fullscreen(DIR + /* glsl */ `
    uniform float uS, uLod, uAmpFar, uAmpFog, uContrast, uTemp, uGain, uWhiteMix, uFlashP, uFlashSig, uHaloA, uHaloR, uLineA, uFrame;
    uniform sampler2D tFar, tFog; uniform vec4 uPlane; uniform vec2 uTexel, uR; uniform vec3 uWhite;
    void main(){
      vec2 sxy = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);     // pixel coords, top-left origin
      vec3 col = vec3(0.0);
      if (uGain > 0.0 && uWhiteMix < 0.999) {
        vec3 d = viewDir(sxy);
        vec2 X = d.xy / -d.z;
        vec2 uv = (X - uPlane.xz) / (uPlane.yw - uPlane.xz);
        // F_far with a defocus that pulls from σ≈6 px to 1 px: trilinear mip + 4 rotated taps
        float spread = exp2(uLod) * 0.6;
        float Ff = 0.0;
        Ff += textureLod(tFar, uv + vec2( 0.7,  0.3) * uTexel * spread, uLod).r;
        Ff += textureLod(tFar, uv + vec2(-0.3,  0.7) * uTexel * spread, uLod).r;
        Ff += textureLod(tFar, uv + vec2(-0.7, -0.3) * uTexel * spread, uLod).r;
        Ff += textureLod(tFar, uv + vec2( 0.3, -0.7) * uTexel * spread, uLod).r;
        Ff *= 0.25;
        // blur lowers the variance of a band-pass field: restore part of it so contrast does not "pop"
        Ff *= 1.0 + 0.10 * uLod;
        vec2 fg = texture2D(tFog, vec2(gl_FragCoord.x / uRes.x, gl_FragCoord.y / uRes.y)).rg;
        float Fn = (fg.r - 0.5) * 5.0 + (fg.g - 0.5) * 1.5;           // ≈ unit variance plasma
        float F = (uAmpFar * Ff + uAmpFog * Fn) * uContrast;          // centred, ≈ unit σ
        // colour = blackbody(T·(1 + 0.12 (F01 − 0.5))) with F01 = 0.5 + 0.25 F; brightness ∝ (T'/T)^4
        float Te = uTemp * (1.0 + 0.12 * clamp(0.25 * F, -0.75, 0.75));
        float I = pow(Te / uTemp, 4.0) * exp(0.18 * F);
        col = blackbody(Te) * I * uGain;
      }
      col = mix(col, uWhite, uWhiteMix);
      // Big Bang flash at R: radial HDR Gaussian + an expanding exponential halo
      vec2 q = (sxy - uR * uS) / uS;                                   // 1080p pixel units from R
      float r2 = dot(q, q);
      col += vec3(1.0, 0.975, 0.93) * (uFlashP * exp(-0.5 * r2 / (uFlashSig * uFlashSig)) + uHaloA * exp(-sqrt(r2) / uHaloR));
      // full-width anamorphic line at y = 540 (core FWHM 6 px, halo FWHM 60 px), #CFE0FF
      if (uLineA > 0.0) {
        float dy = q.y;
        float line = exp(-0.5 * dy * dy / (2.55 * 2.55)) + 0.14 * exp(-0.5 * dy * dy / (25.5 * 25.5));
        line *= exp(-abs(q.x) / 2600.0);
        col += vec3(0.62, 0.745, 1.0) * uLineA * line;
      }
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`, uni);

  // HDR value that displays as #FFF4E0 after ACES (bloom/vignette are switched off on those frames)
  const WHITE = inverseAces([1.004, srgbToLin(0xF4 / 255), srgbToLin(0xE0 / 255)]);
  uni.uWhite.value.fromArray(WHITE);

  // ---------------------------------------------------------------------------------------------
  // Time curves (pure functions of global t). fr = frames since f600 (continuous).
  // ---------------------------------------------------------------------------------------------
  const logLerp = (a, b, u) => Math.exp(lerp(Math.log(a), Math.log(b), u));
  // flash keys: f600 1.5 · f601 30 · f602 1e4 (log-interpolated between frames)
  function flashState(fr) {
    const s = { P: 0, sig: 1.6, haloA: 0, haloR: 40, white: 0, line: 0 };
    if (fr < 0) return s;
    const keysP = [1.5, 30, 1e4, 1e4];
    if (fr < 3) {
      const i = Math.floor(fr), u = fr - i;
      s.P = logLerp(keysP[i], keysP[i + 1], u);
      s.sig = lerp([1.6, 2.2, 3.5][i], [2.2, 3.5, 6][i], u);
      // the light expands: halo grows from nothing (f600) → a disc of light (f601) → beyond the frame (f602)
      s.haloA = i === 0 ? lerp(0, 0.35, u) : i === 1 ? logLerp(0.35, 6, u) : logLerp(6, 60, u);
      s.haloR = i === 0 ? 30 : i === 1 ? logLerp(30, 220, u) : logLerp(220, 2000, u);
    } else { s.P = 0; s.haloA = 0; }
    // full white f603–615; opening from f615 to ≈f628 (blend into the bright plasma)
    if (fr >= 2.5 && fr < 15) s.white = smoothstep(2.5, 3.0, fr);
    else if (fr >= 15) s.white = 1 - smoothstep(15, 27, fr);
    // anamorphic line: f601–612 at full strength, gone before f620
    if (fr >= 0.6 && fr < 19.5) s.line = smoothstep(0.6, 1.0, fr) * (1 - smoothstep(12, 19.5, fr)) * (fr < 3 ? [4, 6, 40][Math.min(2, Math.floor(fr))] : 40);
    return s;
  }

  function fieldState(t) {
    const fr = (t - T_FLASH) * FPS;
    // camera (S08): uniform yaw +8° and roll 1.5° over 27–35; locked before
    const u = clamp((t - T_FIELD) / (T_END - T_FIELD));
    const yaw = THREE.MathUtils.degToRad(8 * u), roll = THREE.MathUtils.degToRad(1.5 * u);
    // temperature: 6500 K at f616 → 4500 K at 27.0 → 3000 K at 31 → 1500 K at 34 → 1200 K
    let T;
    if (t < T_FIELD) T = logLerp(6500, 4500, smoothstep(16, 48, fr));
    else if (t < 31) T = logLerp(4500, 3000, (t - 27) / 4);
    else if (t < 34) T = logLerp(3000, 1500, (t - 31) / 3);
    else T = logLerp(1500, 1200, clamp(t - 34));
    // exposure: 0 EV (27) → −1 EV (31) → −7 EV (35); final roll-off so that 35.0 is black
    let ev;
    if (t < 31) ev = -(clamp(t - 27, 0, 4)) / 4;
    else ev = -1 - 6 * clamp((t - 31) / 4);
    const L0 = 1.35;
    let gain = L0 * Math.pow(2, ev) * (1 - smoothstep(34.2, 34.96, t));
    // while white: the field is far over-exposed and blends with the white (opening f615–f647)
    if (fr < 48) gain *= logLerp(30, 1, smoothstep(14, 46, fr));
    // contrast: 0 under the white, opens f616–f647 (S07), full by 27.0
    const contrast = smoothstep(15, 48, fr);
    // decoupling 30–31: fog contrast → 0, speckle blur σ 6 px → 1 px
    const dec = util.ease.inOutCubic(clamp(t - T_DEC));
    const ampFog = 1 - dec;
    const ampFar = lerp(0.55, 1.0, dec);
    const sigmaPx = lerp(6, 1, dec);
    // texel density ≈ 1.2 texel / px at 1080p; trilinear mip σ ≈ 0.45·2^lod texels
    const texPerPx = (BW / (PLANE.x1 - PLANE.x0)) / (W / 2 / TAN_H);
    const lod = Math.max(0, Math.log2(Math.max(1e-3, sigmaPx * texPerPx / 0.45)));
    const tw = Math.min(t, T_DEC);
    return { yaw, roll, T, gain, contrast, ampFog, ampFar, lod, tw };
  }

  return {
    render(shot, f) {
      const t = f.t;
      const fr = (t - T_FLASH) * FPS;
      const F = fieldState(t), S = flashState(fr);
      const needField = S.white < 0.999 && F.gain > 1e-5;
      // fog pass (only while the plasma is opaque)
      if (needField && F.ampFog > 0.001) {
        fogUni.uYaw.value = F.yaw; fogUni.uRoll.value = F.roll; fogUni.uTw.value = F.tw;
        fogPass.render(renderer, fogRT.rt);
      }
      uni.uYaw.value = F.yaw; uni.uRoll.value = F.roll;
      uni.uLod.value = F.lod; uni.uAmpFar.value = F.ampFar; uni.uAmpFog.value = F.ampFog; uni.uContrast.value = F.contrast;
      uni.uTemp.value = F.T; uni.uGain.value = needField ? F.gain : 0;
      // before f603 the screen is the black of S06 with the growing flash only
      if (fr < 2.5) uni.uGain.value = 0;
      uni.uWhiteMix.value = S.white;
      uni.uFlashP.value = S.P; uni.uFlashSig.value = S.sig; uni.uHaloA.value = S.haloA; uni.uHaloR.value = S.haloR;
      uni.uLineA.value = S.line; uni.uFrame.value = fr;
      main.render(renderer, f.target);
    },
    post(shot, f) {
      const fr = (f.t - T_FLASH) * FPS;
      // flash frames: strong bloom; white frames: no bloom / vignette so the white is exactly #FFF4E0;
      // then the film look returns as the white opens; S08 plasma: soft bloom, no streak.
      if (fr < 2.5) return { bloom: 1.0, streak: 0.35, vignette: 0.2, bloomThreshold: 1.0 };
      if (fr < 15) return { bloom: 0, streak: 0, vignette: 0, ca: 0 };
      const u = smoothstep(15, 40, fr);
      return { bloom: 0.35 * u, streak: 0, vignette: 0.2 * u, bloomThreshold: 1.0, ca: 0.0006 * u };
    },
  };
}
