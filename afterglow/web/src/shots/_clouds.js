// _clouds.js — shared by A2 (a_star, [1680, 1692)) and A3 (a_descent, [1692, ~1708)). Written by the A3 group.
//
// Long take A, S02-f 置换③ 穿过云层 [1680, 1704): the camera dives through 3–4 cloud decks; the frame is
// filled with cloud (≥ 8 % texture, warmer on the left = west) while the view at R shrinks 90 → 30 km.
// The hand-off A2 → A3 is f1692, the middle of the substitution. Both modules draw it with THIS file:
//
//   import { createClouds, cloudsPost, applyCamera } from './_clouds.js';
//   const clouds = createClouds(ctx);                 // bakes two 1024² textures (~0.2 s), nothing else
//   render(shot, f) { clouds.render(f); }             // a complete frame: dusk sky + far ground + clouds + zoom blur
//   post(shot, f)  { return cloudsPost(f.frame); }   // identical post on both sides of f1692
//
// Everything is a pure function of the frame number n = f.t · 24 (fractional for sub-frames).
//
// ---- the camera track (the whole descent, f1680 → f1776; A3 and A4 use the same numbers) -------------
// World: metres, origin = the target R_geo on the ground (a small rise on the floor of the Rift), x east,
// y up, z SOUTH (three.js looks down −z, so a camera facing north looks down −z). The camera always
// sits on one straight glide line through the target, GLIDE = 4.5° above the horizontal, south of it:
//   pos(n) = d(n) · (0, sin GLIDE, cos GLIDE),  looking at the origin, no roll,
// with the optical axis shifted onto R by setViewOffset (lens shift). Because the camera moves along the
// line of sight to the target, the focus of expansion is exactly R for every frame.
//   W(n)  = width of the frame at the target (m) — the screenplay's "视野":
//           [1680,1704) 90 km → 30 km (置换③, ×3 in 24 f)
//           [1704,1740) per-frame magnification 10 % → 8 % (linear in log), → ≈ 1.35 km
//           [1740,1746) → 60 m (置换④)       [1746,1756) 8 %/frame → 27.8 m
//           [1756,1762) → 0.55 m (置换⑤)     [1762,1776) 6 % → 0 (≈ ×1.5) → 0.367 m, then held
//   F(n)  = focal length, 35 mm before f1680, 35 → 100 mm exponential over [1680, 1776] (zoom counted in W)
//   d(n)  = W · F / 36 (36 mm film gauge on the 1920 px width)
// The per-frame magnification at R is W(n−1)/W(n) (rateAt): this is what K29 measures.
import * as THREE from 'three';

export const GLIDE_DEG = 4.5;
export const GLIDE = GLIDE_DEG * Math.PI / 180;
export const RX = 734.5, RY = 540.5;                 // R as a continuous pixel centre, 1080p
export const R_EARTH = 6371000;
export const DUSK = {
  // screenplay §0: R_geo just after sunset, sun 4° below the WEST horizon; camera faces north → west = screen left
  sunAzimuthDeg: 270, sunElevationDeg: -4, facing: 'north (−z)', west: [-1, 0, 0],
};

const G0 = Math.log(1.10), G1 = Math.log(1.08);
const LN = {
  a: Math.log(90000), b: Math.log(30000),
};
LN.c = LN.b - (G0 + G1) / 2 * 36;                      // ln W(1740) ≈ ln 1353 m
LN.d = Math.log(60);
LN.e = LN.d - Math.log(1.08) * 10;                      // ln W(1756) ≈ ln 27.8 m
LN.f = Math.log(0.55);
const GD = Math.log(1.06);

export function lnViewWidth(n) {
  if (n <= 1704) return LN.a + (LN.b - LN.a) * (n - 1680) / 24;      // (extrapolates before f1680: A2 owns that part)
  if (n <= 1740) { const u = n - 1704; return LN.b - (G0 * u + (G1 - G0) * u * u / 72); }
  if (n <= 1746) return LN.c + (LN.d - LN.c) * (n - 1740) / 6;
  if (n <= 1756) return LN.d - Math.log(1.08) * (n - 1746);
  if (n <= 1762) return LN.e + (LN.f - LN.e) * (n - 1756) / 6;
  const u = Math.min(n - 1762, 14);
  return LN.f - (GD * u - GD * u * u / 28);
}
export const viewWidthAt = n => Math.exp(lnViewWidth(n));
export const rateAt = n => Math.exp(lnViewWidth(n - 1) - lnViewWidth(n));     // per-frame magnification at R
export function focalAt(n) {
  const u = Math.min(Math.max((n - 1680) / 96, 0), 1);
  return 35 * Math.pow(100 / 35, u);
}
export function camAt(n) {
  const W = viewWidthAt(n), F = focalAt(n);
  const d = W * F / 36;
  return { n, W, F, d, alt: d * Math.sin(GLIDE), pos: [0, d * Math.sin(GLIDE), d * Math.cos(GLIDE)], target: [0, 0, 0] };
}
// Put a THREE.PerspectiveCamera on the track. W, H = render size (the lens shift scales with H/1080).
export function applyCamera(cam, n, W, H) {
  const c = camAt(n), S = H / 1080;
  cam.filmGauge = 36;
  cam.aspect = W / H;
  cam.setFocalLength(c.F);
  cam.position.set(c.pos[0], c.pos[1], c.pos[2]);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  cam.near = Math.max(0.01, Math.min(c.d * 0.02, c.alt * 0.25));
  cam.far = Math.max(2000, Math.min(450000, c.d * 400));
  cam.setViewOffset(W, H, (960 - RX) * S, (540 - RY) * S, W, H);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  return c;
}

// ---- the dusk sky (shared GLSL: A2's approach, the clouds, A3's terrain haze / lake reflection) -------
// duskSky(dir, alt): linear HDR radiance for a world direction (x east, y up, z south) seen from altitude
// alt (m). Sun 4° below the west horizon: a broad warm twilight arch in the west (screen left), blue-grey
// lavender in the north, indigo in the east with the Earth's shadow and a faint Belt of Venus; deep blue
// overhead. Elevation is measured from the apparent (dipped) horizon. Display values with exposure 1:
// left horizon ≈ 130–150, right horizon ≈ 60–70, 10° up ≈ 40–50.
export const SKY_GLSL = /* glsl */ `
#ifndef AG_DUSKSKY
#define AG_DUSKSKY
float horizonDip(float alt){ return sqrt(2.0 * max(alt, 1.0) / ${R_EARTH.toFixed(1)}); }
vec3 duskSky(vec3 dir, float alt){
  float el = asin(clamp(dir.y, -1.0, 1.0)) + horizonDip(alt);          // above the apparent horizon (rad)
  float az = atan(dir.x, -dir.z);                                        // 0 north, +east, −west
  float dw = az + 1.5708;                                                // 0 = west (the sun's azimuth)
  dw = atan(sin(dw), cos(dw));
  float e = max(el, 0.0);
  float arch = exp(-dw * dw / (2.0 * 0.95 * 0.95));                      // the twilight arch, ±55°
  float archN = exp(-dw * dw / (2.0 * 1.6 * 1.6));                       // its wide skirt
  // vertical structure: a bright warm horizon band thinning upward into blue
  float band = exp(-e / (0.045 + 0.06 * arch));
  float high = exp(-e / 0.5);
  vec3 zen = vec3(0.020, 0.034, 0.085);
  vec3 midN = vec3(0.060, 0.070, 0.125);                                 // north, 10–20° up: lavender blue
  vec3 horN = vec3(0.150, 0.140, 0.185);                                 // north horizon: blue-grey lavender
  vec3 horW = vec3(0.620, 0.330, 0.150);                                 // west horizon: peach / orange
  vec3 horE = vec3(0.060, 0.060, 0.115);                                 // east horizon under the Earth's shadow
  float east = smoothstep(0.3, 1.0, sin(az)) ;                           // 1 towards the east
  vec3 hor = mix(horN, horE, east * 0.85);
  hor = mix(hor, horW, arch);
  hor += vec3(0.10, 0.055, 0.04) * archN;                                // the skirt of the glow, warm
  vec3 c = mix(zen, midN + vec3(0.05, 0.03, 0.02) * archN, high);
  c = mix(c, hor, band);
  // Belt of Venus over the east: a faint pink band 6–14° up above the dark-blue shadow of the Earth
  float belt = exp(-pow((e - 0.17) / 0.07, 2.0)) * east;
  c += vec3(0.045, 0.026, 0.035) * belt;
  // below the apparent horizon (seen from altitude): the far ground in haze, dimmer than the sky above
  if (el < 0.0) c = hor * 0.42 * exp(el / 0.02) + vec3(0.010, 0.011, 0.016) * (1.0 - exp(el / 0.02));
  return c;
}
// the colour of the air between the camera and something at distance dist (m) along dir: in-scatter
vec3 duskHaze(vec3 dir, float alt){
  vec3 d = normalize(vec3(dir.x, max(dir.y, 0.0) * 0.3 + 0.01, dir.z));
  return duskSky(d, alt) * 0.62;
}
#endif
`;

// ---- the cloud decks ---------------------------------------------------------------------------------
// Four slabs (m above the valley floor) with their own map scale, coverage and drift; they exist only in
// the region the camera crosses (z = 25 … 150 km south of the target), so the sky beyond (north) is clear.
// The camera (4.5° glide) is above all at f1680 (6.86 km), in L2 at f1686, in the thick L3 at f1692 (4.52
// km: the frame is entirely cloud there), in L4 at f1698–1700 and under the base at f1704 (2.97 km).
export const CLOUD_LAYERS = [
  { base: 5900, top: 6400, scale: 9000, cov: 0.52, sigma: 0.0030, off: [0.13, 0.71] },
  { base: 5000, top: 5550, scale: 6500, cov: 0.62, sigma: 0.0032, off: [0.57, 0.29] },
  { base: 4050, top: 4900, scale: 5200, cov: 0.86, sigma: 0.0036, off: [0.83, 0.47] },
  { base: 3300, top: 3750, scale: 4200, cov: 0.62, sigma: 0.0032, off: [0.31, 0.92] },
];
const CLOUD_Z = [25000, 150000];

// Post for the cloud substitution and, continued unchanged, the whole of A3 (both sides of f1692 and
// f1758 must agree: A2 returns cloudsPost(f.frame) for [1680, 1692), A4 for its first frames or uses
// postBlend; see docs/v2/handoffs.md).
export function cloudsPost(/* n */) {
  return { exposure: 1.0, bloom: 0.55, bloomThreshold: 1.0, bloomKnee: 0.6, streak: 0.0, vignette: 0.22, ca: 0.0006, grain: 0.04, saturation: 1.0, contrast: 1.0 };
}
// Analytic radial zoom blur at R: the blur spans the scale range [1, m^0.5] (half the per-frame
// displacement, screenplay §0), m = the per-frame magnification; capped during the substitutions.
export function zoomBlurScale(n) {
  const m = Math.min(rateAt(n), 1.12);
  return Math.sqrt(Math.max(m, 1.0));
}

const VS_UV = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Radial zoom blur pass (shared: A2 / A3 / A4 use the same formula).  apply(src texture → target, n)
export function createZoomBlur(ctx) {
  const { THREE: T, FSQ } = ctx;
  const mat = new T.ShaderMaterial({
    vertexShader: VS_UV, depthTest: false, depthWrite: false,
    uniforms: { tex: { value: null }, uC: { value: new T.Vector2() }, uS: { value: 1 }, uJit: { value: 0 }, uRes: { value: new T.Vector2() } },
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform sampler2D tex; uniform vec2 uC, uRes; uniform float uS, uJit;
      void main(){
        float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uJit);
        vec3 acc = vec3(0.0);
        float ls = log(uS);
        for (int k = 0; k < 8; k++){
          float s = exp(-ls * (float(k) + j) / 8.0);          // sample towards R: the image one fraction of a shutter earlier
          acc += texture2D(tex, uC + (vUv - uC) * s).rgb;
        }
        gl_FragColor = vec4(acc / 8.0, 1.0);
      }`,
  });
  const fsq = new FSQ(mat);
  return {
    apply(srcTex, target, n, scale = zoomBlurScale(n)) {
      mat.uniforms.tex.value = srcTex;
      mat.uniforms.uC.value.set(RX / 1920, 1 - RY / 1080);
      mat.uniforms.uS.value = Math.max(scale, 1.0000001);
      mat.uniforms.uJit.value = (Math.round(n) * 0.6180339887) % 1;
      fsq.render(ctx.renderer, target);
    },
  };
}

export function createClouds(ctx) {
  const { renderer, W, H, kit, makeRT, FSQ, GLSL } = ctx;
  // cloud maps: R/G tileable fbm (two seeds), B billows, A fine detail; 1024², period = 1 texture
  const tex = kit.bake(renderer, {
    w: 1024, h: 1024, float: false, mipmaps: true,
    frag: /* glsl */ `
      float tn(vec2 p, float P, float sd){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        float a = ihash2(ivec2(mod(i, P)) + ivec2(int(sd))), b = ihash2(ivec2(mod(i + vec2(1, 0), P)) + ivec2(int(sd)));
        float c = ihash2(ivec2(mod(i + vec2(0, 1), P)) + ivec2(int(sd))), d = ihash2(ivec2(mod(i + vec2(1, 1), P)) + ivec2(int(sd)));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
      float tf(vec2 uv, float P, int oct, float sd){ vec2 p = uv * P; float v = 0.0, a = 0.5, n = 0.0;
        for (int i = 0; i < 8; i++){ if (i >= oct) break; v += a * tn(p, P, sd + float(i) * 31.0); n += a; p *= 2.0; P *= 2.0; a *= 0.5; } return v / n; }
      void main(){
        float r = tf(vUv, 4.0, 7, 3.0);
        float g = tf(vUv + 0.37, 6.0, 6, 101.0);
        float b = 1.0 - abs(2.0 * tf(vUv, 8.0, 5, 211.0) - 1.0);
        float a = tf(vUv, 32.0, 4, 307.0);
        gl_FragColor = vec4(r, g, b, a);
      }`,
  });
  const LOW = 0.5;
  const rtC = makeRT(Math.round(W * LOW), Math.round(H * LOW));
  const rtComp = makeRT(W, H);
  const L = CLOUD_LAYERS;
  const layerGLSL = L.map((l, i) => `Layer(${l.base.toFixed(1)}, ${l.top.toFixed(1)}, ${l.scale.toFixed(1)}, ${l.cov.toFixed(3)}, ${l.sigma.toFixed(5)}, vec2(${l.off[0]}, ${l.off[1]}))`).join(', ');

  const COMMON = GLSL.common + SKY_GLSL + /* glsl */ `
    varying vec2 vUv;
    uniform mat4 uProjInv; uniform mat3 uRot; uniform vec3 uCam; uniform float uN;
    vec3 rayDir(vec2 uv){ vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, 1.0, 1.0); return normalize(uRot * (v.xyz / v.w)); }
    // distance along dir to the curved ground (sphere of the Earth, origin on the ground); −1 if none
    float groundHit(vec3 ro, vec3 rd){
      float h = ro.y, a = 1.0 / ${(2 * R_EARTH).toFixed(1)};
      float disc = rd.y * rd.y - 4.0 * a * h;
      if (rd.y >= 0.0 || disc < 0.0) return -1.0;
      return 2.0 * h / (-rd.y + sqrt(disc));
    }
  `;

  // ---- pass 1: the cloud decks, half resolution, premultiplied (rgb, a = 1 − transmittance) ------------
  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: VS_UV, depthTest: false, depthWrite: false,
    uniforms: { uProjInv: { value: new THREE.Matrix4() }, uRot: { value: new THREE.Matrix3() }, uCam: { value: new THREE.Vector3() }, uN: { value: 0 }, uTex: { value: tex } },
    fragmentShader: COMMON + /* glsl */ `
      uniform sampler2D uTex;
      struct Layer { float b; float t; float s; float cov; float sig; vec2 off; };
      const Layer LS[4] = Layer[4](${layerGLSL});
      float regionMask(vec3 p){ return smoothstep(${CLOUD_Z[0].toFixed(1)}, ${(CLOUD_Z[0] + 15000).toFixed(1)}, p.z) * smoothstep(${CLOUD_Z[1].toFixed(1)}, ${(CLOUD_Z[1] - 30000).toFixed(1)}, p.z); }
      float dens(Layer l, vec3 p, float n){
        float h = (p.y - l.b) / (l.t - l.b);
        if (h <= 0.0 || h >= 1.0) return 0.0;
        vec2 q = p.xz / l.s + l.off + vec2(0.0012, 0.0004) * n;               // slow drift (wind from the east)
        vec4 c = texture2D(uTex, q);
        vec4 c2 = texture2D(uTex, q * 4.3 + vec2(p.y / l.s * 3.1, 0.0) + 0.27);  // detail, varying with height
        float shape = c.r * 0.62 + c.b * 0.22 + c2.g * 0.22 + c2.a * 0.10;
        // flat-ish bases, rounded tops: the threshold rises towards the top
        float thr = (1.0 - l.cov) * 0.95 + 0.2 + 0.30 * smoothstep(0.45, 1.0, h) + 0.25 * smoothstep(0.18, 0.0, h);
        return smoothstep(thr, thr + 0.14, shape) * regionMask(p);
      }
      void main(){
        vec3 rd = rayDir(vUv), ro = uCam;
        float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + fract(uN * 0.6180339887));
        vec3 acc = vec3(0.0); float T = 1.0;
        float gH = groundHit(ro, rd);
        float west = max(dot(rd, vec3(-1.0, 0.0, 0.0)), 0.0);
        float phase = 0.75 + 1.6 * west * west + 0.4 * west;                  // forward scatter towards the bright west
        vec3 skyUp = duskSky(normalize(vec3(rd.x, 0.35, rd.z)), ro.y);
        for (int i = 0; i < 4; i++){
          Layer l = LS[i];
          float t0, t1;
          if (abs(rd.y) < 1e-5){ if (ro.y < l.b || ro.y > l.t) continue; t0 = 0.0; t1 = 60000.0; }
          else {
            float ta = (l.b - ro.y) / rd.y, tb = (l.t - ro.y) / rd.y;
            t0 = max(min(ta, tb), 0.0); t1 = max(ta, tb);
          }
          if (t1 <= t0) continue;
          if (gH > 0.0) t1 = min(t1, gH);
          t1 = min(t1, t0 + 45000.0);
          if (t1 <= t0 || T < 0.01) continue;
          float span = t1 - t0;
          for (int k = 0; k < 8; k++){
            float u0 = (float(k) + jit) / 8.0, u1 = (float(k) + 1.0 + jit) / 8.0;
            float ta = t0 + span * u0 * u0, tb = t0 + span * u1 * u1;
            vec3 p = ro + rd * (0.5 * (ta + tb));
            float dn = dens(l, p, uN);
            if (dn < 0.002) continue;
            float h = (p.y - l.b) / (l.t - l.b);
            // light: the sky dome from above (brighter on the tops), the warm west (on everything facing it),
            // a dim warm floor below; the further west (−x) the warmer the light (the sun is still on the far west)
            float wpos = clamp(0.5 - p.x / 60000.0, 0.0, 1.0);
            float edge = 1.0 - dens(l, p + vec3(-260.0, 0.0, 0.0), uN) * 0.8;    // west-facing edges catch the glow
            vec3 amb = mix(vec3(0.030, 0.036, 0.060), vec3(0.085, 0.090, 0.125), h) + skyUp * 0.25 * h;
            vec3 warm = vec3(0.30, 0.150, 0.085) * (0.25 + 0.75 * edge) * (0.35 + 0.65 * wpos) * (0.45 + 0.55 * h) * phase;
            float topLit = smoothstep(0.55, 1.0, h) * (0.4 + 0.6 * wpos) * float(i < 2);
            vec3 col = amb + warm + vec3(0.30, 0.15, 0.13) * topLit;              // tops of the high decks: pink-orange
            float sigma = l.sig * dn;
            float tau = sigma * (tb - ta);
            float a = 1.0 - exp(-tau);
            // aerial perspective on the cloud itself
            float fogk = 1.0 - exp(-(0.5 * (ta + tb)) / 70000.0);
            col = mix(col, duskHaze(rd, ro.y), fogk);
            acc += T * a * col; T *= 1.0 - a;
            if (T < 0.01) break;
          }
        }
        gl_FragColor = vec4(acc, 1.0 - T);
      }`,
  });
  const cloudPass = new FSQ(cloudMat);

  // ---- pass 2: background (dusk sky + far ground, or a caller's base image) + clouds → full res ---------
  const compMat = new THREE.ShaderMaterial({
    vertexShader: VS_UV, depthTest: false, depthWrite: false,
    uniforms: { uProjInv: { value: new THREE.Matrix4() }, uRot: { value: new THREE.Matrix3() }, uCam: { value: new THREE.Vector3() }, uN: { value: 0 },
      uClouds: { value: rtC.texture }, uBase: { value: null }, uUseBase: { value: 0 } },
    fragmentShader: COMMON + /* glsl */ `
      uniform sampler2D uClouds, uBase; uniform float uUseBase;
      vec3 farGround(vec3 ro, vec3 rd, float t){
        vec3 p = ro + rd * t;
        float v = 0.5 + 0.5 * sin(p.x / 3100.0) * sin(p.z / 2700.0 + 1.3);
        vec3 alb = mix(vec3(0.016, 0.014, 0.011), vec3(0.030, 0.025, 0.018), v);
        vec3 c = alb;
        return mix(c, duskHaze(rd, ro.y), 1.0 - exp(-t / 26000.0));
      }
      void main(){
        vec3 rd = rayDir(vUv), ro = uCam;
        vec3 bg;
        if (uUseBase > 0.5) bg = texture2D(uBase, vUv).rgb;
        else { float g = groundHit(ro, rd); bg = g > 0.0 ? farGround(ro, rd, g) : duskSky(rd, ro.y); }
        vec4 c = texture2D(uClouds, vUv);
        gl_FragColor = vec4(bg * (1.0 - c.a) + c.rgb, 1.0);
      }`,
  });
  const compPass = new FSQ(compMat);
  const blur = createZoomBlur(ctx);
  const cam = new THREE.PerspectiveCamera(40, W / H, 1, 1e6);
  const rot = new THREE.Matrix3();

  function setCam(mat, n) {
    const c = applyCamera(cam, n, W, H);
    mat.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse);
    rot.setFromMatrix4(cam.matrixWorld);
    mat.uniforms.uRot.value.copy(rot);
    mat.uniforms.uCam.value.set(...c.pos);
    mat.uniforms.uN.value = n;
    return c;
  }
  // max transmittance-weighted visibility of the background at frame n (A3 uses it to decide whether its
  // own terrain is needed under the clouds): the camera altitude vs the decks
  function coverAt(n) { const a = camAt(n).alt; return a > 4120 && a < 4880 ? 1 : 0; }

  return {
    camera: cam,
    texture: tex,
    coverAt,
    // Draw the cloud frame into f.target (or opts.target). opts.base: a texture with the world under the
    // clouds (A3's terrain) in place of the built-in sky + far ground; opts.blur = false: no zoom blur.
    render(f, opts = {}) {
      const n = f.t * 24;
      const target = opts.target || f.target;
      const ac = renderer.autoClear; renderer.autoClear = false;
      setCam(cloudMat, n);
      renderer.setRenderTarget(rtC); renderer.setClearColor(0x000000, 0); renderer.clear();
      cloudPass.render(renderer, rtC);
      setCam(compMat, n);
      compMat.uniforms.uUseBase.value = opts.base ? 1 : 0;
      compMat.uniforms.uBase.value = opts.base || null;
      if (opts.blur === false) compPass.render(renderer, target);
      else { compPass.render(renderer, rtComp); blur.apply(rtComp.texture, target, n); }
      renderer.autoClear = ac;
      renderer.setRenderTarget(target);
    },
  };
}
