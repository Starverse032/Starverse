// f_fire/sky.js — the night sky of S16 / S17: one baked Milky Way, one star field, one sky pass.
//
// The Milky Way is baked once into a 4096×2048 HalfFloat patch in GALACTIC coordinates
// (l ∈ [−110°, 110°], b ∈ [−45°, 45°] → ~19 px/deg in l, ~23 px/deg in b: at 24–35 mm that is close to
// one texel per screen pixel, so the dust lanes stay crisp). Recipe (screenplay §3 S16 / D7):
//   · disc light ∝ thin exp(−|b|/h) + thick Gaussian, brighter towards the centre, clumped into star
//     clouds by a multiplicative cascade of fbm (10° → 0.15°; large scales follow the plane, small
//     scales are isotropic) — no per-texel noise: the granularity comes from real point stars
//   · the warm bulge (#FFE3B0)
//   · dust: a wandering central rift + ridged-fbm dark clouds and filaments, multiplicative absorption
//     with reddening exp(−τ·(1, 1.25, 1.6)); alpha = mean transmission (the point stars read it too)
//   · sparse pink HII knots near the plane.
// Each shot places the sky with a rotation (world → galactic) built from "this galactic point at this
// screen position, the plane running at this screen angle" — so the band can be composed like a
// photograph (S16: diagonal after the tilt; S17: rising from behind the ridge on the left).
// Stars are 420 k point sprites in galactic coordinates (density by galactic latitude, power-law
// fluxes N(>L) ∝ L^−1.4, blackbody colours); disc stars are kept with a probability that follows the
// baked light (so the band resolves into clumped, granular star clouds and thins in the dust lanes),
// dimmed by the baked dust, extinguished and reddened by the air mass,
// and grown into defocus discs when the lens is focused short of infinity (S16 starts focused on the fire).
import * as THREE from 'three';
import { HAND_GLSL } from './common.js';

export const L_SPAN = 220, B_SPAN = 90;
const D2R = Math.PI / 180;

const GAL_FRAG = /* glsl */ `
uniform float uL, uB;
// value-noise fbm on vec3 with many octaves (cheap enough for a one-off bake)
float fbmN(vec3 p, int oct){ float a = 0.5, s = 0.0, n = 0.0; for (int i = 0; i < 9; i++){ if (i >= oct) break; s += a * (snoise(p) * 0.5 + 0.5); n += a; p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.52; } return s / n; }
// ridged filaments: thin bright crests of |noise| (used as dust filaments)
float ridgeN(vec3 p, int oct){ float a = 0.5, s = 0.0, n = 0.0; for (int i = 0; i < 6; i++){ if (i >= oct) break; float r = 1.0 - abs(snoise(p)); s += a * r * r; n += a; p = p * 2.07 + vec3(3.1, 1.3, 7.7); a *= 0.55; } return s / n; }
void main(){
  float l = (vUv.x - 0.5) * uL, b = (vUv.y - 0.5) * uB;
  float ab = abs(b);
  // anisotropic domain (structure ~2× longer along the plane) with a turbulent warp
  vec3 P = vec3(l * 0.085, b * 0.17, 3.7);
  P.xy += 0.16 * (vec2(fbmN(P * 1.1 + 3.1, 4), fbmN(P * 1.1 + 7.7, 4)) - 0.5);
  float cen = exp(-pow(l / 52.0, 2.0));
  // ---- disc light: profile × a multiplicative cascade of star clouds (10° → 0.2°) ------------------
  float h = 2.1 + 2.7 * exp(-pow(l / 24.0, 2.0)) + 1.3 * (fbmN(P * 0.7 + 9.0, 3) - 0.5);
  float thin = exp(-ab / h), thick = exp(-b * b / (2.0 * 9.5 * 9.5));
  // large clouds follow the plane; the small-scale clumping is isotropic (star clouds are not streaks)
  vec3 Q = vec3(l * 0.11, b * 0.13, 5.3) + vec3(0.6 * (P.xy - vec2(l * 0.085, b * 0.17)), 0.0);
  float c1 = fbmN(P * 1.1, 4), c2 = fbmN(Q * 3.0 + 5.0, 4), c3 = fbmN(Q * 9.0 + 1.3, 4), c4 = fbmN(Q * 30.0 + 8.1, 3);
  float clouds = pow(clamp(c1 * 1.7 - 0.35, 0.0, 1.7), 2.0) * pow(clamp(c2 * 1.6 - 0.2, 0.0, 1.6), 1.5)
               * (0.45 + 1.1 * c3 * c3) * (0.72 + 0.56 * c4);
  // the unresolved-star mottle (~0.15°, 3 texels a cycle: a texture, not texel noise)
  float c5 = fbmN(Q * 80.0 + 2.9, 2);
  clouds *= 0.55 + 0.9 * c5 * c5;
  float lw = 0.2 + 0.8 * cen;
  float disc = lw * (0.5 * thin * (0.07 + 3.2 * pow(clouds, 1.2)) + 0.07 * thick * (0.55 + 0.7 * c1));
  float bul = exp(-(pow(l / 11.0, 2.0) + pow(b / 7.5, 2.0)));
  float bulCore = exp(-(pow(l / 4.0, 2.0) + pow(b / 3.0, 2.0)));
  vec3 cool = vec3(0.80, 0.88, 1.00), warm = vec3(1.00, 0.86, 0.63);          // warm = #FFE3B0 (linear)
  vec3 col = mix(cool, warm, clamp(0.05 + 0.6 * cen + 0.35 * (c2 - 0.5), 0.0, 1.0)) * disc;
  col += warm * (bul * 0.65 + bulCore * 0.45) * (0.6 + 0.7 * c2) * (0.8 + 0.4 * c3);
  // ---- HII knots ---------------------------------------------------------------------------------
  vec2 cell = floor(vec2(l, b) / vec2(3.0, 1.6));
  vec3 hh = hash33(vec3(cell, 4.0));
  if (hh.x < 0.2 && abs(cell.y * 1.6 + 0.8) < 4.5) {
    vec2 c = (cell + 0.2 + 0.6 * hh.yz) * vec2(3.0, 1.6);
    float r = 0.12 + 0.35 * hash12(cell + 9.1);
    vec2 dd = (vec2(l, b) - c) / vec2(r * 1.3, r);
    float blob = exp(-dot(dd, dd) * 1.5) * (0.3 + 1.2 * fbmN(vec3(l, b, 2.0) * 3.0 + hh * 10.0, 4));
    col += vec3(1.0, 0.30, 0.42) * blob * 0.05 * (0.4 + cen);
  }
  // ---- dust: a coherent fractal-edged rift, layered lanes, filaments (all stretched along the plane)
  vec3 D = vec3(l * 0.08, b * 0.155, 11.0);
  D.xy += 0.22 * (vec2(fbmN(D * 1.7 + 2.0, 3), fbmN(D * 1.7 + 5.0, 3)) - 0.5);
  float dn = fbmN(D * 2.6 + 4.0, 8);
  float big = fbmN(D * 0.8 + 21.0, 4);
  float rc = 0.7 * sin(l * 0.05 + 0.5) + 2.4 * (fbmN(vec3(l * 0.035, 0.0, 8.0), 3) - 0.5) - 0.25;
  float lw2 = 0.75 + 1.2 * exp(-pow(l / 20.0, 2.0)) + 0.8 * fbmN(D * 1.5 + 13.0, 3);
  float lane = exp(-pow((b - rc) / lw2, 2.0));
  float tau = lane * 2.2 * smoothstep(0.33, 0.66, dn + 0.18 * (big - 0.5));
  // secondary lanes either side of the plane (thinner, broken)
  float rc2 = rc + (2.6 + 1.2 * fbmN(D * 0.9 + 40.0, 2)) * sign(sin(l * 0.11 + 1.7));
  tau += exp(-pow((b - rc2) / (0.45 * lw2), 2.0)) * 1.3 * smoothstep(0.45, 0.68, dn);
  // dark complexes near the plane
  float cx = smoothstep(0.54, 0.70, big) * exp(-ab / 4.5);
  tau += cx * 1.3 * smoothstep(0.40, 0.74, dn);
  // filaments: ridged crests, mostly along the plane, a few streamers climbing out of it
  float fil = pow(ridgeN(D * vec3(2.4, 3.6, 1.0) + 31.0, 4), 4.0);
  float str = pow(ridgeN(vec3(l * 0.21, b * 0.06, 17.0) + 0.3 * D, 3), 7.0);
  tau += fil * exp(-ab / 6.0) * 0.55 * smoothstep(0.35, 0.6, big + 0.2 * dn);
  tau += str * exp(-ab / 9.0) * 0.6 * smoothstep(0.5, 0.75, big);
  tau *= (1.0 + 0.3 * cen) * (0.8 + 0.4 * fbmN(D * 9.0, 3));
  vec3 tr = exp(-tau * vec3(1.0, 1.28, 1.7));
  col *= tr;
  gl_FragColor = vec4(col, dot(tr, vec3(0.3333)));
}`;

export function bakeGalaxy(ctx) {
  return ctx.kit.bake(ctx.renderer, {
    w: 4096, h: 2048, wrap: THREE.ClampToEdgeWrapping, mipmaps: true, float: true,
    uniforms: { uL: { value: L_SPAN }, uB: { value: B_SPAN } }, frag: GAL_FRAG,
  });
}

// World → galactic rotation: galactic (l0, b0) seen at 1080p screen point P, the direction of
// increasing l running at screen angle angDeg (counter-clockwise from +x, y up).
export function skyFrame(cam, P, angDeg, l0, b0) {
  const un = (x, y) => {
    const v = new THREE.Vector3(x / 1920 * 2 - 1, 1 - y / 1080 * 2, 0.5).unproject(cam);
    return v.sub(cam.position).normalize();
  };
  const a = angDeg * D2R;
  const d0 = un(P[0], P[1]);
  const d1 = un(P[0] + 20 * Math.cos(a), P[1] - 20 * Math.sin(a));
  const t = d1.clone().addScaledVector(d0, -d1.dot(d0)).normalize();
  const n = new THREE.Vector3().crossVectors(d0, t);
  const l = l0 * D2R, b = b0 * D2R;
  const g0 = new THREE.Vector3(Math.cos(b) * Math.sin(l), Math.sin(b), Math.cos(b) * Math.cos(l));
  const gl = new THREE.Vector3(Math.cos(l), 0, -Math.sin(l));
  gl.addScaledVector(g0, -gl.dot(g0)).normalize();
  const gn = new THREE.Vector3().crossVectors(g0, gl);
  const Aw = new THREE.Matrix3().set(d0.x, t.x, n.x, d0.y, t.y, n.y, d0.z, t.z, n.z);
  const Ag = new THREE.Matrix3().set(g0.x, gl.x, gn.x, g0.y, gl.y, gn.y, g0.z, gl.z, gn.z);
  return Ag.multiply(Aw.transpose());          // world → galactic
}

// Shared GLSL: night-sky base colour by elevation (airglow towards the horizon), extinction.
export const SKY_GLSL = /* glsl */ `
const float DG = 0.0174532925;
float airMass(float el){ float e = max(el / DG, 0.0); return 1.0 / (sin(max(el, 0.0)) + 0.50572 * pow(e + 6.07995, -1.6364)); }
vec3 extinction(float el, float k){ return exp(-k * airMass(el) * vec3(0.55, 0.78, 1.2)); }
vec3 skyBase(float el, float air){
  float e = max(el, 0.0);
  vec3 zen = vec3(0.0024, 0.0034, 0.0064);
  vec3 glow = vec3(0.0060, 0.0110, 0.0090) * exp(-e / 0.18) + vec3(0.0070, 0.0055, 0.0035) * exp(-e / 0.05);
  return zen + glow * air;
}
vec3 galaxy(sampler2D tex, mat3 M, vec3 d, float L, float B){
  vec3 g = M * d;
  float b = asin(clamp(g.y, -1.0, 1.0)) / DG, l = atan(g.x, g.z) / DG;
  vec2 uv = vec2(l / L + 0.5, b / B + 0.5);
  float edge = smoothstep(0.0, 0.04, uv.x) * smoothstep(1.0, 0.96, uv.x) * smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.92, uv.y);
  if (edge <= 0.0) return vec3(0.0);
  return texture2D(tex, uv).rgb * edge;
}`;

// ---- point stars ------------------------------------------------------------------------------------
export function makeStars(ctx, galTex, { count = 420000, seed = 1616 } = {}) {
  const { util, GLSL, H } = ctx;
  const r = util.rng(seed);
  const pos = new Float32Array(count * 3), lum = new Float32Array(count), temp = new Float32Array(count), cls = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    let l, b;
    const field = r() < 0.22;
    cls[2 * i] = field ? 0 : 1; cls[2 * i + 1] = r();
    if (field) { const s = r.sphere(); b = Math.asin(s[1]); l = Math.atan2(s[0], s[2]); }
    else {
      // galactic latitude: Laplace (scale 3.5° thin + 9° thick), longitude weighted to the centre
      const thick = r() < 0.35;
      b = (r() < 0.5 ? -1 : 1) * -Math.log(Math.max(1e-6, r())) * (thick ? 8 : 3.0) * D2R;
      for (;;) { l = (r() * 2 - 1) * Math.PI; if (r() < 0.25 + 0.75 * Math.exp(-Math.pow(l / (60 * D2R), 2))) break; }
      b = Math.max(-1.5, Math.min(1.5, b));
    }
    const R = 1000;
    pos[3 * i] = R * Math.cos(b) * Math.sin(l); pos[3 * i + 1] = R * Math.sin(b); pos[3 * i + 2] = R * Math.cos(b) * Math.cos(l);
    // fluxes: N(>L) ∝ L^−1.4 from 0.016 (the granular faint end) up to 40
    lum[i] = Math.min(40, 0.016 * Math.pow(Math.max(1e-7, r()), -1 / 1.4));
    const u = r();
    temp[i] = u < 0.35 ? 3900 + 2200 * r() : 6000 + 14000 * Math.pow(r(), 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('lum', new THREE.BufferAttribute(lum, 1));
  g.setAttribute('temp', new THREE.BufferAttribute(temp, 1));
  g.setAttribute('cls', new THREE.BufferAttribute(cls, 2));
  const uniforms = {
    uDens: { value: 0.02 }, uFieldLow: { value: 1.0 },
    uGal: { value: galTex }, uL: { value: L_SPAN }, uB: { value: B_SPAN }, uS: { value: H / 1080 },
    uGain: { value: 1 }, uCoc: { value: 0 }, uExt: { value: 0.25 },
    uHand: { value: new THREE.Vector4(0, 0, 1, 0) }, uHandC: { value: new THREE.Vector2(734.5, 540.5) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL.common + HAND_GLSL + SKY_GLSL + /* glsl */ `
      attribute float lum, temp; attribute vec2 cls; uniform sampler2D uGal; uniform float uL, uB, uS, uGain, uCoc, uExt, uDens, uFieldLow;
      varying vec3 vCol; varying float vSig, vRad, vI, vSize;
      void main(){
        vec3 g = normalize(position);
        float b = asin(g.y) / DG, l = atan(g.x, g.z) / DG;
        vec2 uv = vec2(l / uL + 0.5, b / uB + 0.5);
        float tr = 1.0;
        float keep = 1.0, boost = 1.0;
        if (abs(uv.x - 0.5) < 0.5 && abs(uv.y - 0.5) < 0.5) {
          tr = mix(1.0, textureLod(uGal, uv, 2.0).a, 0.92);
          // disc stars are born where the star clouds are: their density follows the baked light
          // (already darkened by the dust), so the band resolves into clumped, granular star clouds
          if (cls.x > 0.5) { float gl = dot(textureLod(uGal, uv, 3.0).rgb, vec3(0.3, 0.5, 0.2)); keep = smoothstep(0.0, uDens, gl); boost = mix(0.7, 1.7, smoothstep(0.0, 5.0 * uDens, gl)); }
        } else if (cls.x > 0.5) keep = 0.0;
        vec3 wd = normalize(mat3(modelMatrix) * g);
        float el = asin(clamp(wd.y, -1.0, 1.0));
        vec3 ext = el < -0.01 ? vec3(0.0) : extinction(el, uExt);
        gl_Position = handClip(projectionMatrix * modelViewMatrix * vec4(position, 1.0));
        // uFieldLow (S16): field stars low in the sky keep their density against the extinction
        if (cls.x < 0.5) boost *= mix(uFieldLow, 1.0, smoothstep(0.17, 0.61, el));
        float L = lum * tr * uGain * boost;
        float sig = (0.62 + 0.28 * clamp(log2(1.0 + L), 0.0, 4.0)) * uS;
        float R = uCoc * uS;
        float rad = R + 3.0 * sig;
        vSize = 2.0 * rad + 2.0;
        gl_PointSize = vSize;
        vSig = sig; vRad = R;
        // flux-normalised peak: Gaussian 1/(2πσ²); defocus disc 1/(π(R² + 2σ²))
        vI = L / (6.2832 * sig * sig + 3.1416 * R * R);
        vCol = blackbody(temp) * ext;
        if (vI * max(vCol.r, vCol.b) < 0.0006 || cls.y > keep) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vSig, vRad, vI, vSize;
      void main(){
        float r = length(gl_PointCoord - 0.5) * vSize;
        float f = vRad < 0.3 ? exp(-0.5 * r * r / (vSig * vSig)) : smoothstep(vRad + vSig * 1.2, vRad - vSig * 1.2, r) * (0.85 + 0.15 * smoothstep(vRad * 0.4, vRad, r));
        gl_FragColor = vec4(vCol * vI * f, 1.0);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.matrixAutoUpdate = false;
  return { pts, uniforms, setFrame(M) { const m = new THREE.Matrix4().setFromMatrix3(M.clone().transpose()); pts.matrix.copy(m); pts.matrixWorld.copy(m); } };
}
