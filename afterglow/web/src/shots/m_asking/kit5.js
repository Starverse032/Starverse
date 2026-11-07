// m_asking/kit5.js — shared infrastructure of the S05 radio-telescope montage (M1–M7).
//
// One night, seven facilities. Every cut is built from the same parts:
//   · sky: base radiance by elevation (dark zenith ≤ L5, airglow towards the horizon, a deep-blue band of
//     the last twilight on one azimuth: the "暮光" that lights the structures), the baked Milky Way
//     (m_asking/sky.js, a frozen copy of the fire group's) and 300 k point stars;
//   · hills: elevation(azimuth) profiles, drawn per pixel with aerial perspective (antenna.js recipe);
//   · surfaces: painted steel lit by the sky hemisphere + the twilight (key on the faces that look at it, a
//     glossy reflection of the sky — the twilight crescent inside a dish), and the red lamp's spill;
//   · lines: screen-space ribbons with analytic coverage (rims, feed legs, wires, dipoles) — rims are kept
//     ≥ 3 px (1080p) wide so the sky-light contour survives 720p; thinner wires fade instead of thinning;
//   · lamps: the feed's red indicator, RED_LAMP = linear (1.0, 0.06, 0.05) × 0.6: a flat core at exactly
//     HDR 0.6 (luma 0.155, below the bloom knee) + its own red halo (radius 10 px, 30 % of the core), drawn
//     premultiplied so the core pixel is the lamp colour itself, not lamp + background.
// The three tiers (visual-changes §1.1): deep black ≤ L5 (zenith, ground in shadow), structure L 25–70
// (twilight-lit faces, rims, the dish crescents; backlit faces 6–12 against a sky of 10–25), action
// light (the lamp: R channel ≥ 160 at exposure 1.0, hue ≈ 355°, S ≈ 0.93).
import * as THREE from 'three';
import { hex } from '../f_fire/common.js';
import { bakeGalaxy, skyFrame, SKY_GLSL, makeStars, L_SPAN, B_SPAN } from './sky.js';

export const D2R = Math.PI / 180;
export const CXY = [960.5, 540.5];                  // C as a pixel centre (pixel (960, 540))
export const RXY = [734.5, 540.5];                  // R as a pixel centre (pixel (734, 540))
export const LAMP = [0.6, 0.036, 0.03];             // palette.RED_LAMP_LINEAR
export const TWI = hex(0x3A6FD8);                   // palette.TWILIGHT
export const AIR = hex(0x7FE3C2);                   // palette.AIRGLOW
export const SODIUM = hex(0xFFB45A);
export { skyFrame, SKY_GLSL, L_SPAN, B_SPAN };

// the post of every red-lamp cut: exposure 1.0 keeps the lamp at S ≥ 0.90 after ACES (1.2 would drop to 0.88)
export const POST = { exposure: 1.0, bloom: 0.55, bloomThreshold: 1.0, bloomKnee: 0.5, streak: 0.10, streakTint: [0.6, 0.75, 1.0], vignette: 0.22, grain: 0.035, ca: 0.0005, saturation: 1.0, contrast: 1.0, tint: [1, 1, 1], lift: [0, 0, 0], flash: 0 };

// ---- shared, built once per process: the Milky Way and the stars -----------------------------------------
let SHARED = null;
export function shared(ctx) {
  if (SHARED) return SHARED;
  const gal = bakeGalaxy(ctx);
  const stars = makeStars(ctx, gal, { count: 300000, seed: 2323 });
  stars.uniforms.uExt.value = 0.16; stars.uniforms.uGain.value = 1.15;
  const starScene = new THREE.Scene(); starScene.add(stars.pts);
  SHARED = { gal, stars, starScene };
  return SHARED;
}

// ---- cameras: `cam` (meshes, lines, lamps) and `skyCam` (same rotation at the origin) -----------------
export function makeView(ctx, focalMM, { near = 0.5, far = 30000 } = {}) {
  const { W, H, kit } = ctx; const S = H / 1080;
  const cam = kit.filmCamera(W, H, { focalMM, near, far });
  const skyCam = kit.filmCamera(W, H, { focalMM, near, far });
  const FPX = 960 / (18 / focalMM);
  return {
    cam, skyCam, FPX,
    // camera at `pos`, aimed so that world point `target` lands on 1080p pixel `px` (lens shift, no keystone)
    aim(pos, target, px, up = [0, 1, 0]) {
      for (const c of [cam, skyCam]) c.setViewOffset(W, H, (960 - px[0]) * S, (540 - px[1]) * S, W, H);
      cam.position.set(...pos); cam.up.set(...up); cam.lookAt(new THREE.Vector3(...target));
      cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      skyCam.position.set(0, 0, 0); skyCam.quaternion.copy(cam.quaternion);
      skyCam.updateMatrixWorld(); skyCam.updateProjectionMatrix();
    },
    project(p) {   // world → 1080p px
      const v = new THREE.Vector3(...p).project(cam);
      return [(v.x * 0.5 + 0.5) * 1920, (0.5 - v.y * 0.5) * 1080];
    },
  };
}

// ---- uniforms shared by the sky, hills and surfaces of one cut ---------------------------------------------
export function skyUniforms(ctx, o = {}) {
  const { W, H } = ctx; const sh = shared(ctx);
  const tw = new THREE.Vector3(Math.sin((o.twiAz ?? 0) * D2R), 0, -Math.cos((o.twiAz ?? 0) * D2R));   // az 0 = −z (forward), + = right
  return {
    uInvVP: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(W, H) }, uS: { value: H / 1080 },
    uM: { value: new THREE.Matrix3() }, uGal: { value: sh.gal }, uL: { value: L_SPAN }, uB: { value: B_SPAN },
    uZen: { value: new THREE.Vector3(...(o.zen || [0.0030, 0.0040, 0.0072])) },
    uLow: { value: new THREE.Vector3(...(o.low || [0.010, 0.015, 0.022])) },
    uTwiDir: { value: tw }, uTwiW: { value: o.twiW ?? 3.0 },
    uTwiCol: { value: new THREE.Vector3(...(o.twiCol || TWI.map(v => v * (o.twiK ?? 0.12)))) },
    uAirC: { value: new THREE.Vector3(...AIR) }, uGalK: { value: o.galK ?? 0.30 },
    uAmbK: { value: o.ambK ?? 1.0 }, uKeyK: { value: o.keyK ?? 0.45 },
    uLampW: { value: new THREE.Vector3(0, -1e5, 0) }, uLampK: { value: o.lampK ?? 0.05 },
    uGround: { value: new THREE.Vector3(...(o.ground || [0.0016, 0.0018, 0.0022])) },
  };
}
export function setSkyFrame(U, view, P, angDeg, l0, b0) {
  const M = skyFrame(view.skyCam, P, angDeg, l0, b0);
  U.uM.value.copy(M);
  return M;
}
export function updateView(U, view) {
  U.uInvVP.value.multiplyMatrices(view.skyCam.matrixWorld, view.skyCam.projectionMatrixInverse);
}

// GLSL: the sky radiance (no galaxy) — used by the sky pass and by every reflection
export const NIGHT_GLSL = SKY_GLSL + /* glsl */ `
uniform vec3 uZen, uLow, uTwiDir, uTwiCol, uAirC, uGround; uniform float uTwiW;
vec3 skyRad(vec3 d){
  float e = max(asin(clamp(d.y, -1.0, 1.0)), 0.0);
  vec2 h = d.xz / max(length(d.xz), 1e-4);
  float az = pow(0.5 + 0.5 * dot(h, uTwiDir.xz), uTwiW);
  vec3 c = uZen + uLow * exp(-e / 0.22) + uAirC * 0.0045 * exp(-pow((e / DG - 10.0) / 7.0, 2.0));
  c += uTwiCol * az * (exp(-e / 0.085) + 0.28 * exp(-e / 0.40));
  return c;
}`;
export const RAY_GLSL = /* glsl */ `
uniform mat4 uInvVP; uniform vec2 uRes; uniform float uS;
vec2 pix(){ return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS; }
vec3 rayDir(){
  vec2 px = pix();
  vec2 ndc = vec2(px.x / 1920.0 * 2.0 - 1.0, 1.0 - px.y / 1080.0 * 2.0);
  vec4 p = uInvVP * vec4(ndc, 1.0, 1.0); return normalize(p.xyz / p.w);
}`;

// ---- sky pass ------------------------------------------------------------------------------------------
export function makeSky(ctx, U) {
  return ctx.kit.fullscreen(NIGHT_GLSL + RAY_GLSL + /* glsl */ `
    uniform mat3 uM; uniform sampler2D uGal; uniform float uL, uB, uGalK;
    void main(){
      vec3 d = rayDir(); float el = asin(clamp(d.y, -1.0, 1.0));
      vec3 col = skyRad(d);
      if (el > -0.02) col += galaxy(uGal, uM, d, uL, uB) * extinction(el, 0.16) * uGalK;
      gl_FragColor = vec4(col, 1.0);
    }`, U);
}

// ---- hills: up to 4 profile layers, elevation (deg) by azimuth (deg; 0 = −z, + = right) -------------------
// layers: [{ dist (m), haze 0..1, fn(az) → elevation deg }], drawn far → near. Parallax: the camera's world
// offset (uOff, set per frame) shifts each layer by offset / dist.
export function makeHills(ctx, U, layers, { az0 = -60, az1 = 60, n = 2048, rim = 0.0 } = {}) {
  const prof = new Float32Array(n * 4).fill(-90);
  layers.forEach((L, k) => { for (let i = 0; i < n; i++) prof[4 * i + k] = L.fn(az0 + (az1 - az0) * i / (n - 1)); });
  const tex = new THREE.DataTexture(prof, n, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const HU = Object.assign({}, U, {
    uProf: { value: tex }, uAz: { value: new THREE.Vector2(az0, az1) }, uOff: { value: new THREE.Vector3() },
    uDist: { value: new THREE.Vector4(...[0, 1, 2, 3].map(k => layers[k] ? layers[k].dist : 1e9)) },
    uHaze: { value: new THREE.Vector4(...[0, 1, 2, 3].map(k => layers[k] ? layers[k].haze : 0)) },
    uRim: { value: rim },
  });
  const nl = layers.length;
  const pass = ctx.kit.fullscreen(NIGHT_GLSL + RAY_GLSL + /* glsl */ `
    uniform sampler2D uProf; uniform vec2 uAz; uniform vec3 uOff; uniform vec4 uDist, uHaze; uniform float uRim;
    float ridge(float az, int k, float dist){
      vec3 side = vec3(cos(az * DG), 0.0, sin(az * DG));
      float a = az + dot(uOff, side) / dist / DG;
      vec4 p = texture2D(uProf, vec2((a - uAz.x) / (uAz.y - uAz.x), 0.5));
      float r = k == 0 ? p.r : k == 1 ? p.g : k == 2 ? p.b : p.a;
      return r - uOff.y / dist / DG;
    }
    void main(){
      vec3 d = rayDir(); float el = asin(clamp(d.y, -1.0, 1.0)) / DG, az = atan(d.x, -d.z) / DG;
      float pw = fwidth(el) * 0.75 + 1e-4;
      vec3 col = vec3(0.0); float a = 0.0;
      for (int i = 0; i < ${nl}; i++){
        float dist = uDist[i], hz = uHaze[i];
        float r = ridge(az, i, dist);
        float c = smoothstep(r + pw, r - pw, el);
        if (c <= 0.0) continue;
        vec3 sk = skyRad(normalize(vec3(d.x, max(r, 0.0) * DG * 0.5, d.z)));
        float under = exp(-max(r - el, 0.0) / 1.0);
        vec3 hc = sk * hz * (0.80 + 0.20 * under) + uGround;
        vec2 h = normalize(d.xz);
        hc += uTwiCol * uRim * pow(max(dot(h, uTwiDir.xz), 0.0), 2.0) * exp(-max(r - el, 0.0) / 0.06) * (1.0 - hz);
        col = mix(col, hc, c); a = a + (1.0 - a) * c;
      }
      gl_FragColor = vec4(col * a, a);
    }`, HU);
  premult(pass.material);
  return { pass, U: HU, tex, render(r, t) { pass.render(r, t); } };
}

// ---- surfaces --------------------------------------------------------------------------------------------
export const SURF_VS = /* glsl */ `
varying vec3 vW, vN; varying vec2 vUv;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`;
// opts: alb (albedo rgb), spec (F0), specK, gloss (galaxy in the reflection), seams: [rings, sectors, depth], emis
export function surfMat(U, o = {}) {
  const u = Object.assign({}, U, {
    uAlb: { value: new THREE.Vector3(...(o.alb || [0.55, 0.56, 0.58])) },
    uSpec: { value: o.spec ?? 0.04 }, uSpecK: { value: o.specK ?? 1.0 }, uGloss: { value: o.gloss ?? 0.0 },
    uSeam: { value: new THREE.Vector3(...(o.seams || [0, 0, 0])) }, uEmis: { value: new THREE.Vector3(...(o.emis || [0, 0, 0])) },
  });
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: u, vertexShader: SURF_VS,
    fragmentShader: NIGHT_GLSL + /* glsl */ `
      uniform mat3 uM; uniform sampler2D uGal; uniform float uL, uB;
      uniform vec3 uAlb, uSeam, uEmis, uLampW; uniform float uSpec, uSpecK, uGloss, uAmbK, uKeyK, uLampK;
      varying vec3 vW, vN; varying vec2 vUv;
      void main(){
        vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vW); if (dot(n, V) < 0.0) n = -n;
        vec3 Lt = normalize(vec3(uTwiDir.x, 0.22, uTwiDir.z));
        vec3 amb = (uZen + uLow * 0.6) * (0.35 + 0.65 * (0.5 + 0.5 * n.y)) * uAmbK;
        vec3 key = uTwiCol * uKeyK * max(dot(n, Lt), 0.0);
        vec3 c = uAlb * (amb + key);
        vec3 R = reflect(-V, n);
        float F = uSpec + (1.0 - uSpec) * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 env = R.y > 0.0 ? skyRad(R) : uGround;
        if (uGloss > 0.0 && R.y > 0.0) env += galaxy(uGal, uM, R, uL, uB) * extinction(asin(R.y), 0.16) * uGloss;
        c += F * env * uSpecK;
        // panel seams (lathe uv: u around, v along the profile): fine dark lines, analytically AA
        if (uSeam.z > 0.0) {
          vec2 g = vec2(vUv.x * uSeam.y, vUv.y * uSeam.x);
          vec2 fw = fwidth(g) + 1e-4;
          vec2 dd = abs(fract(g + 0.5) - 0.5) / fw;
          float ln = 1.0 - clamp(min(dd.x, dd.y) - 0.3, 0.0, 1.0);
          float fade = clamp(1.0 - max(fw.x, fw.y) * 2.5, 0.0, 1.0);
          c *= 1.0 - uSeam.z * mix(0.35, ln, fade);
        }
        vec3 tl = uLampW - vW; float dl = length(tl);
        c += vec3(${LAMP.map(v => v.toFixed(3)).join(', ')}) * uLampK / (1.0 + dl * dl) * max(dot(n, tl / max(dl, 1e-3)), 0.0);
        gl_FragColor = vec4(c + uEmis, 1.0);
      }`,
  });
}

// ---- lines: screen-space ribbons with analytic coverage -------------------------------------------------
// seg = { a:[x,y,z], b:[x,y,z], w: world width (m), col:[r,g,b] radiance, min: min px (1 = thin wire that
// dims below 1 px; ≥ 2 = a contour kept at least that wide, never dimmed), pull: metres towards the camera }
export function makeLines(ctx, max) {
  const { W, H } = ctx; const S = H / 1080;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  const A = new Float32Array(max * 4), B = new Float32Array(max * 4), Cc = new Float32Array(max * 4);
  const aA = new THREE.InstancedBufferAttribute(A, 4), aB = new THREE.InstancedBufferAttribute(B, 4), aC = new THREE.InstancedBufferAttribute(Cc, 4);
  geo.setAttribute('iA', aA); geo.setAttribute('iB', aB); geo.setAttribute('iC', aC);
  geo.instanceCount = 0;
  const u = { uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uCamPos: { value: new THREE.Vector3() } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      attribute vec4 iA, iB, iC; uniform vec2 uRes; uniform float uS; uniform vec3 uCamPos;
      varying float vD, vHW, vI; varying vec3 vCol;
      void main(){
        vec3 pa = iA.xyz, pb = iB.xyz;
        if (iB.w > 0.0) { pa += normalize(uCamPos - pa) * iB.w; pb += normalize(uCamPos - pb) * iB.w; }
        vec4 ca = projectionMatrix * viewMatrix * vec4(pa, 1.0), cb = projectionMatrix * viewMatrix * vec4(pb, 1.0);
        if (ca.w < 0.05 && cb.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        if (ca.w < 0.05) ca = mix(ca, cb, (0.05 - ca.w) / (cb.w - ca.w));
        if (cb.w < 0.05) cb = mix(cb, ca, (0.05 - cb.w) / (ca.w - cb.w));
        vec2 sa = (ca.xy / ca.w * 0.5 + 0.5) * uRes, sb = (cb.xy / cb.w * 0.5 + 0.5) * uRes;
        vec2 t = normalize(sb - sa + 1e-6), n = vec2(-t.y, t.x);
        float dist = mix(ca.w, cb.w, position.x);
        float wpx = iA.w * projectionMatrix[1][1] * 0.5 * uRes.y / dist;
        float mn = max(iC.w, 1.0) * uS;
        float hw = max(wpx, mn) * 0.5;
        vI = iC.w > 1.5 ? 1.0 : min(wpx / uS, 1.0);
        vHW = hw; vCol = iC.rgb;
        float off = (hw + uS) * position.y; vD = off;
        vec2 s = mix(sa, sb, position.x) + n * off + t * (position.x * 2.0 - 1.0) * uS;
        vec4 c = mix(ca, cb, position.x);
        gl_Position = vec4((s / uRes * 2.0 - 1.0) * c.w, c.z, c.w);
      }`,
    fragmentShader: /* glsl */ `
      varying float vD, vHW, vI; varying vec3 vCol;
      void main(){ float cov = clamp(vHW + 0.5 - abs(vD), 0.0, 1.0) * vI; gl_FragColor = vec4(vCol * cov, cov); }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  return {
    scene, u,
    set(segs) {
      const n = Math.min(segs.length, max);
      for (let i = 0; i < n; i++) {
        const s = segs[i];
        A[4 * i] = s.a[0]; A[4 * i + 1] = s.a[1]; A[4 * i + 2] = s.a[2]; A[4 * i + 3] = s.w;
        B[4 * i] = s.b[0]; B[4 * i + 1] = s.b[1]; B[4 * i + 2] = s.b[2]; B[4 * i + 3] = s.pull || 0;
        Cc[4 * i] = s.col[0]; Cc[4 * i + 1] = s.col[1]; Cc[4 * i + 2] = s.col[2]; Cc[4 * i + 3] = s.min ?? 1;
      }
      geo.instanceCount = n; aA.needsUpdate = aB.needsUpdate = aC.needsUpdate = true;
    },
    setCam(cam) { u.uCamPos.value.copy(cam.position); },
  };
}

// ---- lamps: point sprites; core radius / halo radius in 1080p px ------------------------------------------
export function makeLamps(ctx, max = 8) {
  const { W, H } = ctx; const S = H / 1080;
  const pos = new Float32Array(max * 3), rad = new Float32Array(max * 2);
  const g = new THREE.BufferGeometry();
  const aP = new THREE.BufferAttribute(pos, 3), aR = new THREE.BufferAttribute(rad, 2);
  g.setAttribute('position', aP); g.setAttribute('rad', aR); g.setDrawRange(0, 0);
  const u = { uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uCol: { value: new THREE.Vector3(...LAMP) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      attribute vec2 rad; uniform vec2 uRes; uniform float uS; varying vec2 vC; varying vec2 vR;
      void main(){
        vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = c;
        vC = (c.xy / c.w * 0.5 + 0.5) * uRes;
        vR = rad * uS;
        gl_PointSize = 2.0 * (rad.y * uS + 2.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; varying vec2 vC; varying vec2 vR;
      void main(){
        float r = length(gl_FragCoord.xy - vC);
        float core = clamp(vR.x + 0.5 - r, 0.0, 1.0);
        float h = 0.3 * pow(clamp(1.0 - (r - vR.x) / max(vR.y - vR.x, 1.0), 0.0, 1.0), 1.6);
        gl_FragColor = vec4(uCol * (core + (1.0 - core) * h), core);
      }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(pts);
  return {
    scene,
    set(list) {   // [{ p:[x,y,z], core, halo }]
      list.forEach((l, i) => { pos.set(l.p, 3 * i); rad[2 * i] = l.core ?? 2.6; rad[2 * i + 1] = l.halo ?? 10; });
      g.setDrawRange(0, list.length); aP.needsUpdate = aR.needsUpdate = true;
    },
  };
}

export function premult(m) {
  m.blending = THREE.CustomBlending; m.transparent = true;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation;
  m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; m.blendEquationAlpha = THREE.AddEquation;
}

// local progress inside a shot (pure function of t)
export const shotP = (shot, t) => (t * 24 - shot.frames[0]) / (shot.frames[1] - shot.frames[0]);

// Standard draw order of a cut. parts: { sky, hills:[passes], scenes:[...], lines, floor:[passes], after(), lamps }
export function drawCut(ctx, f, view, sh, parts) {
  const { renderer } = ctx;
  const ac = renderer.autoClear; renderer.autoClear = false;
  renderer.setRenderTarget(f.target); renderer.setClearColor(0x000000, 1); renderer.clear();
  if (parts.sky) parts.sky.render(renderer, f.target);
  if (parts.stars !== false) { renderer.setRenderTarget(f.target); renderer.render(sh.starScene, view.skyCam); }
  for (const h of parts.hills || []) h.render(renderer, f.target);
  renderer.setRenderTarget(f.target); renderer.clearDepth();
  for (const s of parts.scenes || []) renderer.render(s, view.cam);
  if (parts.lines) renderer.render(parts.lines.scene, view.cam);
  for (const h of parts.floor || []) h.render(renderer, f.target);
  if (parts.after) parts.after();
  renderer.setRenderTarget(f.target);
  if (parts.lamps) renderer.render(parts.lamps.scene, view.cam);
  renderer.autoClear = ac;
  renderer.setRenderTarget(f.target);
}

// ---- a posable alt-az dish (built once in a local frame; pose() moves it) --------------------------------
// local frame: the elevation axis on the origin, the dish axis = +y; az measured from +z towards +x.
export class Dish {
  constructor(U, { D = 26, F = 10.4, off = 1.5, legs = 4, legPhase = 45, cabin = [1.4, 1.8, 1.4], lip = 0.18,
    pedestal = null, yoke = true, bowlMat = {}, steelMat = {}, seams = [10, 48, 0.25] } = {}) {
    this.D = D; this.F = F; this.off = off;
    this.depth = (D / 2) ** 2 / (4 * F);
    this.group = new THREE.Group();          // tilts with the dish (az + el)
    this.mount = new THREE.Group();          // turns with the dish (az only)
    this.root = new THREE.Group(); this.root.add(this.mount); this.mount.add(this.group);
    const bowl = surfMat(U, Object.assign({ alb: [0.62, 0.64, 0.66], spec: 0.10, specK: 0.9, seams }, bowlMat));
    const steel = surfMat(U, Object.assign({ alb: [0.50, 0.51, 0.53], spec: 0.04 }, steelMat));
    this.mats = { bowl, steel };
    const pts = [];
    for (let i = 0; i <= 48; i++) { const r = (D / 2) * i / 48; pts.push(new THREE.Vector2(Math.max(r, 0.01), off + r * r / (4 * F))); }
    pts.push(new THREE.Vector2(D / 2 + lip, off + this.depth + 0.03));
    this.group.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 192), bowl));
    // the back: a truss cone from below the vertex up to the underside of the bowl at 24 % of the diameter
    const bh = off + (D * 0.24) ** 2 / (4 * F) - 0.12 + 0.6;
    const back = new THREE.CylinderGeometry(D * 0.24, D * 0.07, bh, 48, 1, true); back.translate(0, bh / 2 - 0.6, 0);
    this.group.add(new THREE.Mesh(back, steel));
    if (cabin) { const c = new THREE.BoxGeometry(...cabin); c.translate(0, off + F + cabin[1] * 0.1, 0); this.group.add(new THREE.Mesh(c, steel)); }
    this.cabinH = cabin ? cabin[1] : 0;
    if (yoke) {
      for (const s of [-1, 1]) { const a = new THREE.BoxGeometry(1.0, D * 0.22, 2.2); a.translate(s * D * 0.16, -D * 0.09, 0); this.mount.add(new THREE.Mesh(a, steel)); }
      const tu = new THREE.BoxGeometry(D * 0.36, 1.6, 3.4); tu.translate(0, -D * 0.2, 0); this.mount.add(new THREE.Mesh(tu, steel));
    }
    if (pedestal) {
      const [rt, rb, h] = pedestal; const p = new THREE.CylinderGeometry(rt, rb, h, 40); p.translate(0, -D * 0.2 - 0.8 - h / 2, 0);
      this.root.add(new THREE.Mesh(p, steel));
    }
    this.legs = []; for (let k = 0; k < legs; k++) this.legs.push((legPhase + 360 * k / legs) * D2R);
    this.lip = lip;
  }
  pose(E, az, el) {
    this.az = az; this.el = el;
    this.root.position.set(...E);
    this.mount.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), az * D2R);
    this.group.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (90 - el) * D2R);
    this.root.updateMatrixWorld(true);
    return this;
  }
  w(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.group.matrixWorld); }
  axis() { return this.w(0, 1, 0).sub(this.w(0, 0, 0)).normalize(); }
  focus() { return this.w(0, this.off + this.F, 0); }
  lamp() { return this.w(0, this.off + this.F + this.cabinH * 0.6 + 0.1, 0); }      // on the cabin's sky face
  centre() { return this.w(0, this.off + this.depth, 0); }
  rim(a) { const R = this.D / 2 + this.lip; return this.w(R * Math.cos(a), this.off + this.depth + 0.03, R * Math.sin(a)); }
  // rim (≥ 3 px contour, brighter on the side facing the twilight) + feed legs
  lines(U, { n = 192, rimW = 0.22, rimCol = [0.040, 0.048, 0.064], rimLit = [0.020, 0.034, 0.070], legW = 0.32, legCol = [0.012, 0.014, 0.019], legLit = [0.010, 0.020, 0.045], pull = 0.35, min = 3 } = {}) {
    const tw = U.uTwiDir.value, segs = [], c0 = this.centre();
    for (let i = 0; i < n; i++) {
      const p0 = this.rim(i / n * 2 * Math.PI), p1 = this.rim((i + 1) / n * 2 * Math.PI);
      const out = p0.clone().add(p1).multiplyScalar(0.5).sub(c0).normalize();
      const lit = Math.pow(Math.max(0, out.dot(tw) * 0.8 + out.y * 0.4), 1.5);
      segs.push({ a: p0.toArray(), b: p1.toArray(), w: rimW, col: rimCol.map((v, k) => v + rimLit[k] * lit), min, pull });
    }
    const fc = this.focus(), L = new THREE.Vector3(tw.x, 0.22, tw.z).normalize();
    for (const a of this.legs) {
      const foot = this.rim(a), d = fc.clone().sub(foot).normalize();
      const lit = Math.sqrt(Math.max(0, 1 - d.dot(L) ** 2)) * Math.max(0, 0.5 + 0.5 * foot.clone().sub(c0).normalize().dot(tw));
      segs.push({ a: foot.toArray(), b: fc.toArray(), w: legW, col: legCol.map((v, k) => v + legLit[k] * lit), min: 1, pull: 0.05 });
    }
    return segs;
  }
}
