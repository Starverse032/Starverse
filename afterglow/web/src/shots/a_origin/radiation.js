// a_origin / radiation — S02-a 爆炸与辐射 [600, 792) and the radiation half of S02-b [792, 960).
//
// One continuous function of the frame number fr (= t·24).  Three depth layers, all seen from a camera
// that only moves FORWARD along the ray through R (shift-lens: planes perpendicular to the motion
// magnify about R by z₀/z — R is the focus of expansion, no rotation):
//   far   F_far: band-pass Gaussian random field on directions (c_afterglow's bake, ≈1° = 26 px speckle),
//         at infinity → static but for a very slow drift.  f720 decoupling: σ 6 → 1 px (mip LOD).
//   mid   granular plasma: NM depth planes (z 1.2–13 u) of a baked tileable grain texture (cells ≈ 13 px
//         at z = 5), 3–8 px/frame outward; low absorption.  f720–744 its contrast goes to 0, it thins.
//   near  big soft fog clouds: NN depth planes (z 0.3–5.3 u) of a baked tileable cloud texture; a clear
//         "tunnel" around the motion axis (radius 0.35 u) keeps them off R, so they grow and slide out
//         of the four frame edges (40 px/frame at f624 → 10 px/frame at f792); they absorb what is
//         behind (premultiplied "over"), so the layers occlude each other.  After f720 only 1–2 wisps.
//   Planes are a recycled stack (k-th plane at world depth k·Δ, camera travel s(fr)): every plane fades
//   in at the far end and out at the near end — no plane ever has an edge on screen.
// Flash (c_afterglow): f600 HDR 1.5 point (= p_terminal f599) · f601 30 · f602 1e4 with an expanding halo;
// f601–612 the full-width anamorphic line (y 540, core 6 px, halo 60 px, #CFE0FF), gone before f620.
// f603–610 near-clipped warm white #FFF4E0 that is not flat: the same three layers at a very high gain
// (the near fog keeps ≥ 5 % relief and is already flowing out of R).  f611 the exposure starts to fall.
// Colour = blackbody 6500 (white) → 4500 K (f648) → 3000 K (f744) → 1500 K (f792) → 1300 K (f840);
// exposure 0 EV (f648) → −1 (f744) → −4 (f792) → −7 (f840) → black (≈ f900).
// S02-b: the afterglow target at R (dark red-brown soft clump, HDR luma 0.02–0.035, Ø 40 → 12 px
// f792 → f888, the surrounding gas drains into it: a darker moat 30–150 px), and 3–6 very faint dust
// wisps (the near planes at display 3–8) drifting out at 2–4 px/frame, fading out by f1010.
//
// Cost (1080p SwiftShader): bake ≈ 2 s in create(); per frame ≈ 0.10 s (half-res layers) + 0.12 s (main).
import * as THREE from 'three';

const FPX = 1280;                       // 24 mm focal length in 1080p px (36 mm gauge)
const R = [734.5, 540.5];
const PLANE = { x0: -0.80, x1: 0.80, y0: -0.45, y1: 0.45 };   // gnomonic window of F_far (no yaw)
const BW = 3072, BH = 1728;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const s5 = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
const outCubic = t => 1 - Math.pow(1 - t, 3);
const logLerp = (a, b, u) => Math.exp(lerp(Math.log(a), Math.log(b), u));
const srgb2lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// --- ACES fitted (= post.js) and its inverse, to hit #FFF4E0 on the white frames -----------------------
function acesFitted(c) {
  const inM = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
  const outM = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
  const mul = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const v = mul(inM, c).map(x => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.4329510) + 0.238081));
  return mul(outM, v);
}
function inverseAces(target) {
  let x = [8, 4, 2];
  for (let it = 0; it < 60; it++) {
    const y = acesFitted(x), e = 1e-3;
    const J = [0, 1, 2].map(j => { const xp = x.slice(); xp[j] += e; const yp = acesFitted(xp); return yp.map((v, i) => (v - y[i]) / e); });
    const A = [[J[0][0], J[1][0], J[2][0]], [J[0][1], J[1][1], J[2][1]], [J[0][2], J[1][2], J[2][2]]];
    const r = target.map((t, i) => t - y[i]);
    const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const D = det(A); if (Math.abs(D) < 1e-12) break;
    const dx = [0, 1, 2].map(k => det(A.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)))) / D);
    x = x.map((v, i) => Math.max(0.01, v + dx[i]));
  }
  return x;
}

// ---------------------------------------------------------------------------------------------------
// Time curves (pure).  fr = frame number (fractional).
// ---------------------------------------------------------------------------------------------------
// camera travel (world units) for the radiation planes: speed v = 0.006 + 0.094·e^(−(fr−600)/95) u/frame
export function camTravel(fr) { const x = Math.max(0, fr - 600); return 0.006 * x + 0.094 * 95 * (1 - Math.exp(-x / 95)); }
export function camSpeed(fr) { return 0.006 + 0.094 * Math.exp(-Math.max(0, fr - 600) / 95); }

// piecewise-linear key curve, then a 16-frame box smoothing (C1-ish, no pauses at the keys)
function pl(keys, x) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return va + (vb - va) * (x - a) / (b - a); }
  return keys[keys.length - 1][1];
}
function smoothPL(keys, x, w = 16) { let s = 0; const n = 9; for (let i = 0; i < n; i++) s += pl(keys, x + w * (i / (n - 1) - 0.5)); return s / n; }
const EV_KEYS = [[648, 0], [744, -1], [792, -4], [840, -7], [888, -10.5], [912, -14]];
const LT_KEYS = [[648, Math.log(4500)], [744, Math.log(3000)], [792, Math.log(1500)], [840, Math.log(1300)], [900, Math.log(1250)]];

export function radState(fr) {
  const s = { fr };
  // ---- flash (c_afterglow, f600–602) ----
  s.P = 0; s.sig = 1.6; s.haloA = 0; s.haloR = 40; s.asp = 1; s.line = 0;
  if (fr >= 0 + 600 && fr < 603) {
    const x = fr - 600, i = Math.floor(x), u = x - i;
    const keysP = [1.5, 30, 1e4, 1e4];
    s.P = logLerp(keysP[i], keysP[i + 1], u);
    s.sig = lerp([1.6, 3.6, 3.5][i], [3.6, 3.5, 6][i], u);
    s.asp = lerp([1, 2.67, 1.6][i], [2.67, 1.6, 1][i], u);
    s.haloA = i === 0 ? lerp(0, 0.35, u) : i === 1 ? logLerp(0.35, 6, u) : logLerp(6, 60, u);
    s.haloR = i === 0 ? 30 : i === 1 ? logLerp(30, 220, u) : logLerp(220, 2000, u);
  }
  const x = fr - 600;
  // p_terminal's still point carries its faint lens line (0.035 · P) on f600
  s.pline = x < 0.5 ? 0.035 : 0;
  if (x >= 0.6 && x < 19.5) s.line = sstep(0.6, 1.0, x) * (1 - sstep(12, 19.5, x)) * (x < 3 ? [1.5, 2.5, 30][Math.min(2, Math.floor(x))] : 30);
  // ---- field exposure ----
  const ev = smoothPL(EV_KEYS, fr);
  let gain = Math.pow(2, ev);
  // white f603–610 (field at WHITE gain), falling from f611 (outCubic over f611–f646)
  const W = 1.2, L0 = 0.5;
  if (x < 2.5) gain = 0;
  else if (x < 11) gain = W * lerp(1, 0.72, clamp((x - 3) / 8)) * sstep(2.5, 3.0, x);
  else if (fr < 648) gain = logLerp(W * 0.72, L0, outCubic(clamp((x - 11) / 36))) * Math.pow(2, Math.min(0, ev));
  else gain *= L0;
  if (fr > 900) gain *= 1 - sstep(900, 915, fr);
  s.gain = gain;
  // near fog: luminous (brighter than the field); on the white frames it carries the ≥ 5 % relief
  s.nearBoost = x < 11 ? 22.0 : lerp(22.0, 1.9, outCubic(clamp((x - 11) / 30)));
  s.white = x >= 2.5 && x < 11 ? 1 : x < 2.5 ? 0 : 1 - sstep(11, 30, x);     // warm-white tint weight
  // temperature (log-linear keys, smoothed); the white frames are 6500 K → 4500 K by f648
  s.T = x < 48 ? logLerp(6500, 4500, sstep(8, 48, x)) : Math.exp(smoothPL(LT_KEYS, fr, 20));
  // decoupling f720–744: mid contrast → 0, far speckle σ 6 → 1 px, near thins to 1–2 wisps
  const dec = clamp((fr - 720) / 24); s.dec = dec * dec * (3 - 2 * dec);
  s.sigmaFar = lerp(6, 1, s.dec);
  s.ampMid = 1 - s.dec;                    // mid layer contrast
  s.midGain = lerp(1, 0.55, s.dec);        // mid layer: sparser and darker
  s.nearThin = s.dec;                      // near fog threshold up: 1–2 wisps remain
  s.ampFar = lerp(0.6, 1.0, s.dec);
  // near-layer brightness: with the field during S02-a; S02-b: faint dust (display 3–8), out by f1010
  s.dust = sstep(770, 830, fr) * (1 - sstep(960, 1010, fr));
  // the afterglow target at R (S02-b): HDR luma 0.02–0.035, Ø 40 → 12 px (FWHM), gone at f888
  const ag = sstep(744, 800, fr) * (fr < 888 ? 1 : 0);
  s.agA = ag * lerp(0.022, 0.026, clamp((fr - 792) / 96));
  s.agFWHM = fr < 792 ? 40 : lerp(40, 12, Math.pow(clamp((fr - 792) / 96), 0.8));
  s.moat = sstep(744, 800, fr) * (fr < 888 ? 1 : 0);
  s.camS = camTravel(fr);
  s.camV = camSpeed(fr);
  return s;
}

export function createRadiation(ctx) {
  const { renderer, W, H, kit } = ctx;

  // ---- bakes ----------------------------------------------------------------------------------------
  // F_far (c_afterglow): band-pass Gaussian random field on directions, unit variance; G = large-scale
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
        s += 1.00 * snoise(rmat(0.3, 1.1, 2.0) * d * f0 * 0.82 + vec3(1.3, 7.1, 3.3));
        s += 1.00 * snoise(rmat(1.7, 0.2, 0.9) * d * f0 * 0.91 + vec3(9.1, 2.4, 5.7));
        s += 1.00 * snoise(rmat(2.5, 2.9, 0.4) * d * f0 * 1.00 + vec3(4.4, 8.8, 1.2));
        s += 1.00 * snoise(rmat(0.9, 1.9, 2.7) * d * f0 * 1.07 + vec3(6.6, 3.1, 9.9));
        s += 0.90 * snoise(rmat(2.1, 0.7, 1.5) * d * f0 * 1.16 + vec3(2.2, 5.5, 7.7));
        s += 0.75 * snoise(rmat(1.2, 2.4, 0.1) * d * f0 * 1.30 + vec3(8.3, 0.6, 4.1));
        s += 0.60 * snoise(rmat(0.5, 0.4, 1.8) * d * f0 * 0.70 + vec3(3.9, 6.2, 2.8));
        s += 0.32 * snoise(rmat(2.8, 1.3, 2.2) * d * f0 * 2.25 + vec3(5.1, 1.9, 8.4));
        s += 0.30 * snoise(rmat(1.4, 2.6, 1.1) * d * f0 * 2.45 + vec3(7.4, 4.6, 0.3));
        s += 0.26 * snoise(rmat(0.2, 0.8, 2.9) * d * f0 * 2.70 + vec3(0.8, 9.3, 6.0));
        float big = snoise(d * 3.2 + vec3(2.0, 4.0, 1.0));
        s *= 0.80 + 0.35 * big;
        s += 0.70 * snoise(rmat(1.0, 0.5, 0.2) * d * f0 * 0.28 + vec3(1.0, 2.0, 3.0));
        s += 0.55 * snoise(rmat(0.4, 2.2, 1.3) * d * f0 * 0.13 + vec3(7.0, 3.0, 5.0));
        float F = s / (0.31 * sqrt(7.5));
        gl_FragColor = vec4(F, big, 0.0, 1.0);
      }`,
  });
  // periodic gradient noise / worley for tileable plane textures
  const PERIODIC = /* glsl */ `
    vec2 pgrad(vec2 c, vec2 per){ c = mod(c, per); float h = ihash2(ivec2(c)) * TAU; return vec2(cos(h), sin(h)); }
    float pnoise(vec2 p, vec2 per){
      vec2 i = floor(p), f = fract(p); vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
      float a = dot(pgrad(i, per), f), b = dot(pgrad(i + vec2(1, 0), per), f - vec2(1, 0));
      float c = dot(pgrad(i + vec2(0, 1), per), f - vec2(0, 1)), d = dot(pgrad(i + vec2(1, 1), per), f - vec2(1, 1));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.4 + 0.5;
    }
    float pfbm(vec2 p, float per, int oct){ float s = 0.0, a = 0.5, n = 0.0; for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a * pnoise(p, vec2(per)); n += a; p *= 2.0; per *= 2.0; a *= 0.5; } return s / n; }
    vec2 pworley(vec2 p, float per){            // (F1, cell id hash)
      vec2 i = floor(p), f = fract(p); float d1 = 9.0; float id = 0.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
        vec2 o = vec2(x, y); vec2 c = mod(i + o, vec2(per));
        vec2 h = vec2(ihash2(ivec2(c)), ihash2(ivec2(c) + ivec2(71, 13)));
        vec2 dv = o + h - f; float dd = dot(dv, dv);
        if (dd < d1){ d1 = dd; id = ihash2(ivec2(c) + ivec2(5, 191)); }
      }
      return vec2(sqrt(d1), id);
    }`;
  // near fog: R = sparse soft clouds (≈ 25 % cover), G = wispy detail, B = alternative (thinner) clouds
  const fogTex = kit.bake(renderer, {
    w: 1024, h: 1024, mipmaps: true,
    frag: PERIODIC + /* glsl */ `
      void main(){
        vec2 p = vUv * 3.0;
        vec2 w = vec2(pfbm(p * 1.0 + vec2(1.7, 9.2), 3.0, 4), pfbm(p * 1.0 + vec2(8.3, 2.8), 3.0, 4));
        vec2 q = p + 1.6 * (w - 0.5);
        float d = pfbm(q, 3.0, 6);
        float det = pfbm(vUv * 14.0 + 2.0 * (w - 0.5), 14.0, 4);
        float cloud = smoothstep(0.50, 0.74, d + 0.10 * (det - 0.5));
        float wisp = smoothstep(0.60, 0.80, d + 0.22 * (det - 0.5)) * smoothstep(0.35, 0.75, det);
        gl_FragColor = vec4(cloud, det, wisp, 1.0);
      }`,
  });
  // mid grains: soft cells (≈ 40 per tile), clumped by a low-frequency field
  const grainTex = kit.bake(renderer, {
    w: 1024, h: 1024, mipmaps: true,
    frag: PERIODIC + /* glsl */ `
      void main(){
        vec2 wv = PERIODIC_W(vUv);
        vec2 c1 = pworley(vUv * 40.0 + 1.2 * (wv - 0.5), 40.0);
        vec2 c2 = pworley(vUv * 23.0 + vec2(3.1, 7.7), 23.0);
        float g1 = exp(-c1.x * c1.x / 0.10) * (0.45 + 0.9 * c1.y);
        float g2 = exp(-c2.x * c2.x / 0.12) * (0.35 + 0.8 * c2.y);
        float clump = pfbm(vUv * 5.0 + vec2(4.2, 1.9), 5.0, 4);
        float g = (0.65 * g1 + 0.45 * g2) * smoothstep(0.30, 0.75, clump);
        float cloud = pfbm(vUv * 8.0 + vec2(9.0, 4.0), 8.0, 5);
        gl_FragColor = vec4(g, cloud, clump, 1.0);
      }`.replace('PERIODIC_W(vUv)', 'vec2(pfbm(vUv * 6.0, 6.0, 3), pfbm(vUv * 6.0 + vec2(5.0, 3.0), 6.0, 3))'),
  });

  // ---- half-res layer pass: mid grains + near fog, premultiplied (rgb = emission, a = 1 − T) --------
  // mid grains at half resolution, near fog (soft by nature) at quarter resolution — two passes
  const layRT = new kit.LowRes(W, H, 0.5);
  const nearRT = new kit.LowRes(W, H, 0.25);
  const LAYERS = /* glsl */ `
    uniform sampler2D tFog, tGrain;
    uniform float uPxScale, uHt, uCamS, uTemp, uAmpMid, uMidGain, uNearThin, uNearGain, uDust, uWhite, uNearAbs, uDustMix, uPresence;
    const float FPX = ${FPX.toFixed(1)};
    const vec2 RR = vec2(${R[0].toFixed(1)}, ${R[1].toFixed(1)});
    const int NM = 8; const float DM = 1.5, ZM0 = 1.2, ZM1 = 13.2;
    const int NN = 9; const float DN = 0.36, ZN0 = 0.26, ZN1 = 3.3;
    // normalised blackbody around uTemp, linearised in ln T (uBB0 = colour at uTemp, uBB1 = d colour / d ln T): cheap per layer
    uniform vec3 uBB0, uBB1;
    vec3 bbN(float T){ return max(uBB0 + uBB1 * log(T / uTemp), 0.0); }
    void main(){
      vec2 px = vec2(gl_FragCoord.x, uHt - gl_FragCoord.y) * uPxScale;   // 1080p px, y down
      vec2 d = px - RR;
      float pxw = uPxScale;                                              // 1080p px per target px
      vec3 col = vec3(0.0); float T = 1.0;
      // ---- mid: granular plasma (far → near) ----
#ifdef DO_MID
      float kTop = floor((uCamS + ZM1) / DM);
      for (int i = 0; i < NM; i++){
        float k = kTop - float(i);
        float z = k * DM - uCamS;
        if (z < ZM0) break;
        float w = smoothstep(ZM1, ZM1 - 3.5, z) * smoothstep(ZM0, ZM0 + 2.0, z);
        vec2 P = d * z / FPX;
        vec2 h = hash22(vec2(k * 1.37, 3.1));
        vec2 uv = rot2(h.x * TAU) * P * 0.5 + h * 7.0;                  // tile = 2 u
        float tpp = z / FPX * 0.5 * 1024.0 * pxw;                         // texels per target px
        float lod = log2(max(1.0, tpp)) + 2.2 * smoothstep(4.0, 1.2, z);  // defocus near the lens
        vec4 g = textureLod(tGrain, uv, lod);
        // decoupling: the smooth plasma (contrast) goes, sparse bright grains remain (sparser, dimmer)
        float grain = mix(pow(g.r, 2.6) * 4.5 * smoothstep(0.45, 0.75, g.g), pow(g.r, 1.3) * 2.2, uAmpMid);
        // clumpy planes: each depth plane is patchy, so different depths dominate different places (parallax)
        float patchy = mix(1.0, 2.6 * smoothstep(0.42, 0.72, g.b), uAmpMid);
        float dens = grain * (0.55 + 0.9 * g.g) * patchy * smoothstep(0.03, 0.12, length(P));
        float a = 0.07 * dens * w * uMidGain;
        float Te = uTemp * (1.0 + 0.22 * (g.g - 0.5) + 0.12 * (grain - 0.5));
        col = col * (1.0 - a) + bbN(Te) * (0.11 * dens * w * uMidGain);
        T *= 1.0 - a;
      }
#endif
      // ---- near: big soft fog clouds (far → near) ----
#ifdef DO_NEAR
      float kTopN = floor((uCamS + ZN1) / DN);
      float thr = mix(0.0, 0.62, uNearThin);
      for (int i = 0; i < NN; i++){
        float k = kTopN - float(i);
        float z = k * DN - uCamS;
        if (z < ZN0) break;
        float w = smoothstep(ZN1, ZN1 - 1.2, z) * smoothstep(ZN0, ZN0 + 0.30, z);
        vec2 P = d * z / FPX;
        vec2 h = hash22(vec2(k * 2.11, 9.7));
        vec2 uv = rot2(h.y * TAU) * P / 6.0 + h * 5.0;                   // tile = 6 u
        float tpp = z / FPX / 6.0 * 1024.0 * pxw;
        float lod = log2(max(1.0, tpp)) + 1.6 * smoothstep(2.5, 0.3, z) + 0.6;
        vec4 fg = textureLod(tFog, uv, lod);
        // after the decoupling only the thin wisps (B) of 1–2 clouds remain
        float c = mix(mix(fg.r, fg.b, uNearThin), max(fg.b, 0.55 * fg.r), uDustMix) * step(uPresence, hash11(k * 3.7 + 0.31));
        float tunnel = smoothstep(0.12, 0.75, length(P) * (0.85 + 0.3 * fg.g));   // soft, irregular clear channel
        float dens = c * tunnel * w;
        float a = (0.55 * (1.0 - uWhite) + 0.25 * uWhite) * dens * (0.6 + 0.4 * fg.g);
        float Te = uTemp * (1.0 + 0.10 * (fg.g - 0.4) + 0.22 * (c - 0.3));
        vec3 e = bbN(Te) * dens * (0.75 + 0.7 * fg.g) * (uNearGain + uDust);
        col = col * (1.0 - a * uNearAbs) + e;
        T *= 1.0 - a * uNearAbs;
      }
#endif
      gl_FragColor = vec4(col, 1.0 - T);
    }`;
  const layUni = {
    tFog: { value: fogTex }, tGrain: { value: grainTex },
    uPxScale: { value: 1 }, uHt: { value: 1 }, uCamS: { value: 0 }, uTemp: { value: 4500 },
    uAmpMid: { value: 1 }, uMidGain: { value: 1 }, uNearThin: { value: 0 }, uNearGain: { value: 1 }, uDust: { value: 0 }, uWhite: { value: 0 }, uNearAbs: { value: 1 }, uDustMix: { value: 0 }, uPresence: { value: 0.45 }, uBB0: { value: new THREE.Vector3(1, 1, 1) }, uBB1: { value: new THREE.Vector3() },
  };
  const layPass = kit.fullscreen('#define DO_MID\n' + LAYERS, layUni);
  const nearPass = kit.fullscreen('#define DO_NEAR\n' + LAYERS, layUni);

  // ---- full-res main pass ----------------------------------------------------------------------------
  const MAIN = /* glsl */ `
    uniform sampler2D tFar, tLay, tNear; uniform vec4 uPlane; uniform vec2 uTexel;
    uniform float uPxScale, uHt, uWt, uLod, uSpread, uAmpFar, uTemp, uGain, uFGain, uWhite, uDrift, uOverMode, uFarZoom;
    uniform vec3 uWhiteTint;
    uniform float uP, uSig, uAsp, uHaloA, uHaloR, uLine, uPLine;
    uniform float uAgA, uAgSig, uMoat, uDustOnly;
    const vec2 RR = vec2(${R[0].toFixed(1)}, ${R[1].toFixed(1)});
    // normalised blackbody around uTemp, linearised in ln T (uBB0 = colour at uTemp, uBB1 = d colour / d ln T): cheap per layer
    uniform vec3 uBB0, uBB1;
    vec3 bbN(float T){ return max(uBB0 + uBB1 * log(T / uTemp), 0.0); }
    void main(){
      vec2 px = vec2(gl_FragCoord.x, uHt - gl_FragCoord.y) * uPxScale;
      vec2 sv = gl_FragCoord.xy / vec2(uWt, uHt);
      vec4 L = texture2D(tLay, sv), Ln = texture2D(tNear, sv);
      vec3 col = vec3(0.0);
      if (uGain > 0.0 && uDustOnly < 0.5) {
        // far field: gnomonic direction of this pixel (camera fixed, no yaw)
        // the far layer is very far, not at infinity: a slow zoom about R (≈ 0.3 %/frame)
        vec2 n = (RR + (px - RR) / uFarZoom - vec2(960.0, 540.0)) / 1280.0;
        vec2 uv = (vec2(n.x, -n.y) + vec2(uDrift, 0.3 * uDrift) - uPlane.xz) / (uPlane.yw - uPlane.xz);
        float Ff = 0.0;
        Ff += textureLod(tFar, uv + vec2( 0.7,  0.3) * uTexel * uSpread, uLod).r;
        Ff += textureLod(tFar, uv + vec2(-0.3,  0.7) * uTexel * uSpread, uLod).r;
        Ff += textureLod(tFar, uv + vec2(-0.7, -0.3) * uTexel * uSpread, uLod).r;
        Ff += textureLod(tFar, uv + vec2( 0.3, -0.7) * uTexel * uSpread, uLod).r;
        Ff *= 0.25 * (1.0 + 0.10 * uLod);
        float F = uAmpFar * Ff;
        float Te = uTemp * (1.0 + 0.20 * clamp(0.25 * F, -0.75, 0.75));
        float I = pow(Te / uTemp, 4.0) * exp(uFGain * F);
        vec3 far = bbN(Te) * I;
        // S02-b: the gas around R drains into the afterglow — a darker moat 30–150 px
        float r = length(px - RR);
        far *= 1.0 - 0.72 * uMoat * smoothstep(230.0, 30.0, r);
        col = (far * (1.0 - L.a) + L.rgb) * (1.0 - Ln.a) + Ln.rgb;
        col *= uGain;
        col *= mix(vec3(1.0), uWhiteTint, uWhite);
      }
      if (uDustOnly > 0.5) col = Ln.rgb;          // S02-b/c: only the faint dust wisps (gain inside)
      // the flash, its lines and the f600 point are centred on p_terminal's still point (734.0, 540.0)
      vec2 q = px - vec2(734.0, 540.0);
      float r2 = dot(q, q);
      // flash at R (c_afterglow): the source keeps the cursor's 24:64 proportion for a frame
      float rc = q.x * q.x + q.y * q.y / (uAsp * uAsp);
      col += vec3(1.0, 0.975, 0.93) * (uP * exp(-0.5 * rc / (uSig * uSig)) + uHaloA * exp(-sqrt(r2) / uHaloR));
      // p_terminal's f599 lens line through the still point (f600 only)
      col += vec3(0.80, 0.90, 1.0) * uPLine * uP * exp(-abs(q.x) / 110.0) * exp(-0.5 * q.y * q.y / 1.44);
      // full-width anamorphic line at y = 540 (core FWHM 6 px, halo FWHM 60 px), #CFE0FF
      if (uLine > 0.0) {
        float line = exp(-0.5 * q.y * q.y / (2.55 * 2.55)) + 0.14 * exp(-0.5 * q.y * q.y / (25.5 * 25.5));
        line *= exp(-abs(q.x) / 2600.0);
        col += vec3(0.62, 0.745, 1.0) * uLine * line;
      }
      // the afterglow target at R: dark red-brown soft clump (S02-b)
      if (uAgA > 0.0) {
        r2 = dot(px - RR, px - RR);
        float g = exp(-0.5 * r2 / (uAgSig * uAgSig)) + 0.18 * exp(-0.5 * r2 / (4.0 * uAgSig * uAgSig));
        col += vec3(1.0, 0.30, 0.10) / 0.4205 * uAgA * g / 1.18;
      }
      gl_FragColor = vec4(max(col, 0.0), uDustOnly > 0.5 ? L.a * 0.0 : 1.0);
    }`;
  const uni = {
    tFar: { value: farTex }, tLay: { value: layRT.texture }, tNear: { value: nearRT.texture },
    uPlane: { value: new THREE.Vector4(PLANE.x0, PLANE.x1, PLANE.y0, PLANE.y1) }, uTexel: { value: new THREE.Vector2(1 / BW, 1 / BH) },
    uPxScale: { value: 1 }, uHt: { value: H }, uWt: { value: W }, uLod: { value: 0 }, uSpread: { value: 1 }, uAmpFar: { value: 1 },
    uTemp: { value: 4500 }, uGain: { value: 1 }, uFGain: { value: 0.25 }, uWhite: { value: 0 }, uDrift: { value: 0 }, uOverMode: { value: 0 }, uFarZoom: { value: 1 }, uBB0: { value: new THREE.Vector3(1, 1, 1) }, uBB1: { value: new THREE.Vector3() },
    uWhiteTint: { value: new THREE.Vector3(1, 1, 1) },
    uP: { value: 0 }, uSig: { value: 1.6 }, uAsp: { value: 1 }, uHaloA: { value: 0 }, uHaloR: { value: 40 }, uLine: { value: 0 }, uPLine: { value: 0 },
    uAgA: { value: 0 }, uAgSig: { value: 10 }, uMoat: { value: 0 }, uDustOnly: { value: 0 },
  };
  const mainPass = kit.fullscreen(MAIN, uni);
  const mainMat = mainPass.material;

  // white tint: on the white frames the field (normalised blackbody at 6500 K) is re-tinted so that its
  // mean lands on #FFF4E0 after ACES (solved once)
  const WHITE = inverseAces([1.004, srgb2lin(0xF4 / 255), srgb2lin(0xE0 / 255)]);
  const bbJS = T => {
    T = Math.min(40000, Math.max(1000, T)) / 100;
    const c = [T <= 66 ? 1 : clamp(1.29293618606 * Math.pow(T - 60, -0.1332047592)),
      T <= 66 ? clamp(0.39008157876 * Math.log(T) - 0.63184144378) : clamp(1.12989086089 * Math.pow(T - 60, -0.0755148492)),
      T >= 66 ? 1 : (T <= 19 ? 0 : clamp(0.54320678911 * Math.log(T - 10) - 1.19625408914))];
    return c.map(v => Math.pow(v, 2.2));
  };
  const lumaJS = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const b65 = bbJS(6500), wN = WHITE.map(v => v / lumaJS(WHITE)), bN = b65.map(v => v / lumaJS(b65));
  uni.uWhiteTint.value.set(wN[0] / bN[0], wN[1] / bN[1], wN[2] / bN[2]);
  const texPerPx = (BW / (PLANE.x1 - PLANE.x0)) / (W / 2 / 0.75);

  return {
    state: radState,
    // mode 'base': opaque full frame (S02-a/b, before anything else is drawn)
    // mode 'dust': only the dust wisps, premultiplied-over on top of the target (S02-b/c with stars)
    render(r, target, fr, mode = 'base') {
      const S = radState(fr);
      const pxScale = 1080 / target.height;
      // layers (half res)
      layUni.uPxScale.value = 1080 / layRT.rt.height; layUni.uHt.value = layRT.rt.height;
      layUni.uCamS.value = S.camS; layUni.uTemp.value = S.T;
      {
        const n0 = bbJS(S.T), n1 = bbJS(S.T * 1.03), n2 = bbJS(S.T / 1.03);
        const c0 = n0.map(v => v / lumaJS(n0)), c1 = n1.map(v => v / lumaJS(n1)), c2 = n2.map(v => v / lumaJS(n2));
        const d = c0.map((_, i) => (c1[i] - c2[i]) / (2 * Math.log(1.03)));
        layUni.uBB0.value.set(...c0); layUni.uBB1.value.set(...d); uni.uBB0.value.set(...c0); uni.uBB1.value.set(...d);
      }
      layUni.uAmpMid.value = S.ampMid; layUni.uMidGain.value = mode === 'dust' ? 0 : S.midGain;
      layUni.uNearThin.value = S.nearThin; layUni.uWhite.value = S.white;
      // near fog: the field's own clouds fade out as they become the faint dust wisps of S02-b
      // (absolute HDR ≈ 0.004–0.012, display 3–8; in 'base' mode divided by the field gain applied later)
      const dustAbs = 0.012 * S.dust;
      layUni.uNearGain.value = mode === 'dust' ? 0 : S.nearBoost * (1 - S.dust);
      layUni.uDust.value = mode === 'dust' || S.gain < 1e-4 ? dustAbs : dustAbs / S.gain;
      layUni.uNearAbs.value = 1 - S.dust;
      layUni.uDustMix.value = S.dust;
      layUni.uPresence.value = lerp(lerp(0.45, 0.80, S.nearThin), 0.35, S.dust);
      const ac = r.autoClear; r.autoClear = true;
      r.setClearColor(0x000000, 0);
      if (mode !== 'dust' && S.gain > 1e-4) {
        layUni.uPxScale.value = 1080 / layRT.rt.height; layUni.uHt.value = layRT.rt.height;
        r.setRenderTarget(layRT.rt); r.clear();
        layPass.render(r, layRT.rt);
      } else { r.setRenderTarget(layRT.rt); r.clear(); }
      layUni.uPxScale.value = 1080 / nearRT.rt.height; layUni.uHt.value = nearRT.rt.height;
      r.setRenderTarget(nearRT.rt); r.clear();
      nearPass.render(r, nearRT.rt);
      // main
      uni.uPxScale.value = pxScale; uni.uHt.value = target.height; uni.uWt.value = target.width;
      const sig = S.sigmaFar;
      const farZoom = Math.exp(0.003 * Math.max(0, fr - 600));
      uni.uFarZoom.value = farZoom;
      uni.uLod.value = Math.max(0, Math.log2(Math.max(1e-3, sig * texPerPx / farZoom / 0.45)));
      uni.uSpread.value = Math.pow(2, uni.uLod.value) * 0.6;
      uni.uAmpFar.value = S.ampFar; uni.uTemp.value = S.T; uni.uFGain.value = lerp(0.22, 0.30, S.dec);
      uni.uDrift.value = 0.00004 * (fr - 600);
      uni.uWhite.value = S.white;
      const dustOnly = mode === 'dust' || (S.gain < 1e-4 && S.P <= 0);
      uni.uGain.value = S.gain; uni.uDustOnly.value = dustOnly ? 1 : 0;
      uni.uP.value = S.P; uni.uSig.value = S.sig; uni.uAsp.value = S.asp; uni.uHaloA.value = S.haloA; uni.uHaloR.value = S.haloR;
      uni.uLine.value = S.line; uni.uPLine.value = S.pline;
      uni.uAgA.value = mode === 'dust' ? 0 : S.agA; uni.uAgSig.value = S.agFWHM / 2.355; uni.uMoat.value = S.moat;
      if (mode === 'dust') {
        mainMat.blending = THREE.AdditiveBlending; mainMat.transparent = true;
        r.autoClear = false;
      } else {
        mainMat.blending = THREE.NoBlending; mainMat.transparent = false;
      }
      mainMat.needsUpdate = false;
      r.setRenderTarget(target);
      r.render(mainPass.scene, mainPass.camera);
      r.autoClear = ac;
      return S;
    },
  };
}
