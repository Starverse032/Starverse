// f_fire/sky.js — the night sky of S16 / S17: one baked Milky Way, one star field, one sky pass.
//
// The Milky Way is baked once into a 4096×2048 HalfFloat patch in GALACTIC coordinates
// (l ∈ [−110°, 110°], b ∈ [−45°, 45°] → ~19 px/deg in l, ~23 px/deg in b: at 24–35 mm that is close to
// one texel per screen pixel, so the dust lanes stay crisp). Recipe (screenplay §3 S16 / D7):
//   · disc light ∝ thin exp(−|b|/h) + thick Gaussian, brighter towards the centre, clumped into star
//     clouds by domain-warped fbm; a texel-scale grain of unresolved stars that follows the light
//   · the warm bulge (#FFE3B0)
//   · dust: a wandering central rift + ridged-fbm dark clouds and filaments, multiplicative absorption
//     with reddening exp(−τ·(1, 1.25, 1.6)); alpha = mean transmission (the point stars read it too)
//   · sparse pink HII knots near the plane.
// Each shot places the sky with a rotation (world → galactic) built from "this galactic point at this
// screen position, the plane running at this screen angle" — so the band can be composed like a
// photograph (S16: diagonal after the tilt; S17: rising from behind the ridge on the left).
// Stars are 150 k point sprites in galactic coordinates (density by galactic latitude, power-law
// fluxes, blackbody colours), dimmed by the baked dust, extinguished and reddened by the air mass,
// and grown into defocus discs when the lens is focused short of infinity (S16 starts focused on the fire).
import * as THREE from 'three';
import { HAND_GLSL } from './common.js';

export const L_SPAN = 220, B_SPAN = 90;
const D2R = Math.PI / 180;

const GAL_FRAG = /* glsl */ `
uniform float uL, uB;
// value-noise fbm on vec3 with many octaves (cheap enough for a one-off bake)
float fbmN(vec3 p, int oct){ float a = 0.5, s = 0.0, n = 0.0; for (int i = 0; i < 9; i++){ if (i >= oct) break; s += a * (snoise(p) * 0.5 + 0.5); n += a; p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.52; } return s / n; }
void main(){
  float l = (vUv.x - 0.5) * uL, b = (vUv.y - 0.5) * uB;
  float ab = abs(b);
  // mildly anisotropic domain (structure ~1.8× longer along the plane), a light warp only
  vec3 P = vec3(l * 0.09, b * 0.16, 3.7);
  P += 0.12 * (vec3(fbmN(P * 1.3 + 3.1, 4), fbmN(P * 1.3 + 7.7, 4), 0.0) - 0.5);
  float cen = exp(-pow(l / 50.0, 2.0));
  // ---- disc light: profile × multi-scale lumpy star clouds ---------------------------------------
  float h = 2.3 + 2.6 * exp(-pow(l / 26.0, 2.0)) + 1.4 * (fbmN(P * 0.7 + 9.0, 3) - 0.5);
  float thin = exp(-ab / h), thick = exp(-b * b / (2.0 * 10.0 * 10.0));
  float c1 = fbmN(P * 1.2, 4), c2 = fbmN(P * 4.0 + 5.0, 5), c3 = fbmN(P * 16.0 + 1.3, 4);
  float clouds = pow(clamp(c1 * 1.6 - 0.3, 0.0, 1.6), 1.8) * pow(clamp(c2 * 1.5 - 0.15, 0.0, 1.6), 1.4) * (0.6 + 0.8 * c3);
  float lw = 0.22 + 0.78 * cen;
  float disc = lw * (0.6 * thin * (0.12 + 2.4 * clouds) + 0.08 * thick * (0.5 + 0.8 * c1));
  float bul = exp(-(pow(l / 11.0, 2.0) + pow(b / 8.0, 2.0)));
  float bulCore = exp(-(pow(l / 4.5, 2.0) + pow(b / 3.2, 2.0)));
  vec3 cool = vec3(0.80, 0.86, 1.00), warm = vec3(1.00, 0.87, 0.68);
  vec3 col = mix(cool, warm, clamp(0.1 + 0.55 * cen + 0.4 * (c2 - 0.5), 0.0, 1.0)) * disc;
  col += warm * (bul * 0.7 + bulCore * 0.5) * (0.55 + 0.8 * c2);
  // ---- unresolved stars: a power-law sparkle that follows the light ------------------------------
  vec2 tc = floor(vUv * vec2(4096.0, 2048.0));
  float hs = hash12(tc + 0.5), hb = hash12(tc + 17.3);
  float dens = clamp((disc * 2.0 + bul) * 1.2, 0.0, 0.9);
  col *= 0.62 + 0.76 * pow(hash12(tc + 3.3), 1.6);
  col += mix(cool, warm, hb) * step(1.0 - dens * 0.7, hs) * pow(hb, 3.0) * (0.08 + 0.45 * dens);
  // ---- HII knots ---------------------------------------------------------------------------------
  vec2 cell = floor(vec2(l, b) / vec2(3.0, 1.6));
  vec3 hh = hash33(vec3(cell, 4.0));
  if (hh.x < 0.22 && abs(cell.y * 1.6 + 0.8) < 4.5) {
    vec2 c = (cell + 0.2 + 0.6 * hh.yz) * vec2(3.0, 1.6);
    float r = 0.15 + 0.4 * hash12(cell + 9.1);
    vec2 dd = (vec2(l, b) - c) / vec2(r * 1.3, r);
    float blob = exp(-dot(dd, dd) * 1.5) * (0.3 + 1.2 * fbmN(vec3(l, b, 2.0) * 3.0 + hh * 10.0, 4));
    col += vec3(1.0, 0.36, 0.50) * blob * 0.06 * (0.4 + cen);
  }
  // ---- dust: fractal-edged dark clouds (thresholded 8-octave fbm), a coherent rift, thin wisps -----
  float rc = 0.8 * sin(l * 0.054 + 0.5) + 2.6 * (fbmN(vec3(l * 0.035, 0.0, 8.0), 3) - 0.5) - 0.2;
  float lw2 = 0.9 + 1.3 * exp(-pow(l / 20.0, 2.0)) + 0.9 * fbmN(P * 1.5 + 13.0, 3);
  float lane = exp(-pow((b - rc) / lw2, 2.0));
  float dn = fbmN(P * 2.4 + 4.0, 8);
  float big = fbmN(P * 0.75 + 21.0, 4);
  // the rift: coherent along the plane, fractal-edged
  float tau = lane * 2.4 * smoothstep(0.34, 0.66, dn + 0.2 * (big - 0.5));
  // a few large dark complexes near the plane (masked by the large-scale field), soft fractal edges
  float cx = smoothstep(0.50, 0.68, big) * exp(-ab / 5.0);
  tau += cx * 2.0 * smoothstep(0.38, 0.72, dn);
  // sparse thin wisps
  float wisp = 1.0 - abs(snoise(P * vec3(3.0, 5.0, 1.0) + 31.0));
  tau += pow(clamp(wisp, 0.0, 1.0), 14.0) * exp(-ab / 7.0) * 0.6 * smoothstep(0.45, 0.65, big);
  tau *= 1.0 + 0.4 * cen;
  vec3 tr = exp(-tau * vec3(1.0, 1.3, 1.75));
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
export function makeStars(ctx, galTex, { count = 150000, seed = 1616 } = {}) {
  const { util, GLSL, H } = ctx;
  const r = util.rng(seed);
  const pos = new Float32Array(count * 3), lum = new Float32Array(count), temp = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let l, b;
    if (r() < 0.3) { const s = r.sphere(); b = Math.asin(s[1]); l = Math.atan2(s[0], s[2]); }
    else {
      // galactic latitude: Laplace (scale 3.5° thin + 9° thick), longitude weighted to the centre
      const thick = r() < 0.35;
      b = (r() < 0.5 ? -1 : 1) * -Math.log(Math.max(1e-6, r())) * (thick ? 9 : 3.5) * D2R;
      for (;;) { l = (r() * 2 - 1) * Math.PI; if (r() < 0.25 + 0.75 * Math.exp(-Math.pow(l / (60 * D2R), 2))) break; }
      b = Math.max(-1.5, Math.min(1.5, b));
    }
    const R = 1000;
    pos[3 * i] = R * Math.cos(b) * Math.sin(l); pos[3 * i + 1] = R * Math.sin(b); pos[3 * i + 2] = R * Math.cos(b) * Math.cos(l);
    // fluxes: N(>L) ∝ L^−0.85, from 0.012 (grain-level) up to ~60
    lum[i] = Math.min(40, 0.006 * Math.pow(Math.max(1e-7, r()), -1 / 1.15));
    const u = r();
    temp[i] = u < 0.35 ? 3900 + 2200 * r() : 6000 + 14000 * Math.pow(r(), 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('lum', new THREE.BufferAttribute(lum, 1));
  g.setAttribute('temp', new THREE.BufferAttribute(temp, 1));
  const uniforms = {
    uGal: { value: galTex }, uL: { value: L_SPAN }, uB: { value: B_SPAN }, uS: { value: H / 1080 },
    uGain: { value: 1 }, uCoc: { value: 0 }, uExt: { value: 0.25 },
    uHand: { value: new THREE.Vector4(0, 0, 1, 0) }, uHandC: { value: new THREE.Vector2(734.5, 540.5) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL.common + HAND_GLSL + SKY_GLSL + /* glsl */ `
      attribute float lum, temp; uniform sampler2D uGal; uniform float uL, uB, uS, uGain, uCoc, uExt;
      varying vec3 vCol; varying float vSig, vRad, vI, vSize;
      void main(){
        vec3 g = normalize(position);
        float b = asin(g.y) / DG, l = atan(g.x, g.z) / DG;
        vec2 uv = vec2(l / uL + 0.5, b / uB + 0.5);
        float tr = 1.0;
        if (abs(uv.x - 0.5) < 0.5 && abs(uv.y - 0.5) < 0.5) tr = mix(1.0, textureLod(uGal, uv, 2.0).a, 0.92);
        vec3 wd = normalize(mat3(modelMatrix) * g);
        float el = asin(clamp(wd.y, -1.0, 1.0));
        vec3 ext = el < -0.01 ? vec3(0.0) : extinction(el, uExt);
        gl_Position = handClip(projectionMatrix * modelViewMatrix * vec4(position, 1.0));
        float L = lum * tr * uGain;
        float sig = (0.62 + 0.28 * clamp(log2(1.0 + L), 0.0, 4.0)) * uS;
        float R = uCoc * uS;
        float rad = R + 3.0 * sig;
        vSize = 2.0 * rad + 2.0;
        gl_PointSize = vSize;
        vSig = sig; vRad = R;
        // flux-normalised peak: Gaussian 1/(2πσ²); defocus disc 1/(π(R² + 2σ²))
        vI = L / (6.2832 * sig * sig + 3.1416 * R * R);
        vCol = blackbody(temp) * ext;
        if (vI * max(vCol.r, vCol.b) < 0.0006) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
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
