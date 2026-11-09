// m_asking/dive.js — M7 · S05-g 俯冲 · 琥珀闪光 [2916, 2928), 12 frames. Lamp on R.
//
// (v1.3 S26 dived onto a city at a hard-coded 112.5 s; v2 dives onto the sinkhole telescope, times from the
// shot.) 35 mm straight down from 1100 m over the karst sinkhole: the 300 m bowl is a dark mirror holding the
// Milky Way and stars overhead, panelled; six towers on the sinkhole's lip carry cables to the feed cabin
// hanging 100 m above the rim, and on the cabin, exactly under the camera, the red lamp — on R. The cones
// around the sinkhole catch the twilight on one flank (L2), the pit and the shadowed flanks are ≤ 5.
// f2916–2923 the plunge (1100 → 165 m above the rim; log-altitude with an ease-in): the cabin and its lamp
// grow (core 2.6 → ~16 px, its halo 10 → ~60 px); the karst falls out of frame faster than the bowl
// (parallax by height). f2924–2927 the amber flash (post): peak on f2924, a slight fall to f2927, then the
// cut to B1 whose flash decays over f2928–2933. Under the flash the plunge continues slowly.
// Motion: radial zoom blur integrated analytically (NT taps of the altitude across a 90° shutter); the
// timeline's 4 sub-frames reuse one cached render per frame (a cache, not state: same frame → same image).
import * as THREE from 'three';
import { RXY, LAMP, POST, NIGHT_GLSL, skyUniforms, skyFrame } from './kit5.js';

const FPX = 960 / (18 / 35);                     // 1080p px per unit tangent at 35 mm
const BD = 300, BF = 140;                        // bowl diameter, focal length (m)
const BR = BD / 2, BDEPTH = BR * BR / (4 * BF);  // 40 m
const HCAB = BF - BDEPTH;                        // the cabin 100 m above the rim
const TEXT = 1500, BEXT = 160;                   // half extents of the terrain / bowl plates (m)
const NT = 6;
const D2R = Math.PI / 180;

// terrain height (m above the rim) — GLSL, used by the bake
const TERRAIN = /* glsl */ `
float coneField(vec2 g){
  // fengcong: rounded limestone cones on a 260 m jittered lattice
  vec2 c = g / 260.0, i = floor(c); float h = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 cc = i + vec2(float(x), float(y));
    vec3 hh = hash33(vec3(cc, 5.0));
    vec2 o = (cc + 0.2 + 0.6 * hh.xy) * 260.0;
    float rc = 120.0 + 70.0 * hh.z, hc = 110.0 + 120.0 * hash12(cc + 3.3);
    float d = length(g - o) / rc;
    h = max(h, hc * pow(max(1.0 - d * d, 0.0), 1.2));
  }
  return h;
}
float terrainH(vec2 g){
  float r = length(g), a = atan(g.y, g.x);
  float lob = 1.0 + 0.16 * (fbm(vec2(a * 2.0, 1.3), 3) - 0.5) * 2.0;
  float rr = r / lob;
  float wall = 210.0 * pow(smoothstep(168.0, 560.0, rr), 1.25);
  float cones = coneField(g) * smoothstep(380.0, 700.0, rr);
  float rough = 14.0 * (fbm(g * 0.012, 4) - 0.5) * smoothstep(170.0, 260.0, rr);
  return (rr < 168.0 ? -6.0 : max(wall, cones * 0.9 + wall * 0.55) + rough - 6.0 * (1.0 - smoothstep(168.0, 200.0, rr)));
}`;

export function createDive(ctx, shot) {
  const { renderer, W, H, kit } = ctx;
  const S = H / 1080;
  const U = skyUniforms(ctx, { twiAz: 0, twiCol: [0.030, 0.052, 0.100], twiW: 1.6, low: [0.013, 0.018, 0.027], galK: 0.6 });
  // the sky overhead (for the mirror): the Milky Way crossing the zenith
  const up = kit.filmCamera(W, H, { focalMM: 35 }); up.position.set(0, 0, 0); up.up.set(0, 0, -1); up.lookAt(0, 1, 0); up.updateMatrixWorld(); up.updateProjectionMatrix();
  U.uM.value.copy(skyFrame(up, [700, 600], 55, 22, 0.5));
  const L = new THREE.Vector3(-0.80, 0.30, -0.52).normalize();          // the twilight, low in the west-north-west

  // ---- bake: the terrain (shaded colour, height in alpha) -------------------------------------------------
  const terr = kit.bake(renderer, {
    w: 3072, h: 3072, float: true, mipmaps: true, wrap: THREE.ClampToEdgeWrapping,
    uniforms: { uL: { value: L } },
    frag: TERRAIN + /* glsl */ `
      uniform vec3 uL;
      void main(){
        vec2 g = (vUv - 0.5) * ${(2 * TEXT).toFixed(1)};
        float h = terrainH(g), e = 1.2;
        vec3 n = normalize(vec3(-(terrainH(g + vec2(e, 0.0)) - h) / e, 1.0, (terrainH(g + vec2(0.0, e)) - h) / e));
        float steep = 1.0 - n.y;
        float veg = smoothstep(0.35, 0.65, fbm(g * 0.02, 4) + 0.3 * (1.0 - steep * 2.0));
        vec3 alb = mix(vec3(0.16, 0.16, 0.15), vec3(0.060, 0.075, 0.055), veg);
        alb *= 0.75 + 0.5 * fbm(g * 0.15, 3);
        float r = length(g);
        alb *= mix(0.45, 1.0, smoothstep(170.0, 240.0, r));                // the pit floor in its own shadow
        vec3 amb = vec3(0.010, 0.014, 0.022) * (0.35 + 0.65 * n.y);
        vec3 key = vec3(0.030, 0.052, 0.100) * 7.0 * max(dot(n, uL), 0.0);
        // a little of the sky's occlusion in the folds
        float occ = smoothstep(-40.0, 60.0, h - (terrainH(g + vec2(25.0, 0.0)) + terrainH(g - vec2(25.0, 0.0)) + terrainH(g + vec2(0.0, 25.0)) + terrainH(g - vec2(0.0, 25.0))) * 0.25);
        gl_FragColor = vec4(alb * (amb + key) * (0.55 + 0.45 * occ), h);
      }`,
  });
  // ---- bake: the bowl (a panelled mirror of the sky overhead, seen from straight above) -----------------
  const bowl = kit.bake(renderer, {
    w: 2048, h: 2048, float: true, mipmaps: true, wrap: THREE.ClampToEdgeWrapping,
    uniforms: Object.assign({}, U),
    frag: NIGHT_GLSL + /* glsl */ `
      uniform mat3 uM; uniform sampler2D uGal; uniform float uL, uB, uGalK;
      void main(){
        vec2 g = (vUv - 0.5) * ${(2 * BEXT).toFixed(1)};
        float r = length(g);
        if (r > ${(BR + 1.5).toFixed(1)}) { gl_FragColor = vec4(0.0); return; }
        // panels: 5 m rings × spokes doubling outwards; each panel tilted a hair (its own reflection)
        float a = atan(g.y, g.x);
        float ring = floor(r / 5.0), ns = 24.0 * exp2(floor(log2(max(ring, 1.0) / 3.0) + 1.0));
        float sec = floor((a / 6.2831853 + 0.5) * ns);
        vec2 tilt = (hash22(vec2(ring, sec) + 1.7) - 0.5) * 0.010;
        vec3 n = normalize(vec3(-g.x / ${(2 * BF).toFixed(1)} + tilt.x, 1.0, g.y / ${(2 * BF).toFixed(1)} + tilt.y));
        vec3 R = reflect(vec3(0.0, -1.0, 0.0), n);
        vec3 sky = skyRad(R) + galaxy(uGal, uM, R, uL, uB) * extinction(asin(R.y), 0.16) * uGalK;
        sky += starLayer(R, 260.0, 0.35, 11.0, 0.0011) * 0.012 + starLayer(R, 120.0, 0.20, 23.0, 0.0011) * 0.02;
        vec3 c = sky * 0.82 + vec3(0.0016, 0.0018, 0.0024);
        // seams (0.25 m): darker lines, band-limited by the texel (0.156 m)
        float tx = ${(2 * BEXT / 2048).toFixed(4)};
        float dr = abs(fract(r / 5.0 + 0.5) - 0.5) * 5.0;
        float ds = abs(fract((a / 6.2831853 + 0.5) * ns + 0.5) - 0.5) / ns * 6.2831853 * r;
        float seam = max(smoothstep(0.25 + tx, 0.25 - tx, dr), smoothstep(0.25 + tx, 0.25 - tx, ds));
        c *= 1.0 - 0.45 * seam;
        // the receiver's survey targets and the actuator nodes read as faint pale dots at the panel corners
        c += vec3(0.020, 0.026, 0.034) * smoothstep(0.6 + tx, 0.6 - tx, length(vec2(dr, ds))) * step(10.0, r);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

  const towers = [];
  for (let k = 0; k < 6; k++) { const a = (k * 60 + 17) * D2R; towers.push(new THREE.Vector2(Math.cos(a) * 178, Math.sin(a) * 178)); }
  const Ud = {
    uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S },
    uTerr: { value: terr }, uBowl: { value: bowl },
    uAlt: { value: new Array(NT + 1).fill(1000) }, uRot: { value: 0 }, uJit: { value: 0 }, uDim: { value: 1 },
    uTow: { value: towers }, uLampR: { value: new THREE.Vector2(2.6, 10) }, uL: { value: new THREE.Vector2(L.x, L.z).normalize() },
  };
  const pass = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes, uLampR, uL; uniform float uS, uRot, uJit, uDim; uniform float uAlt[${NT + 1}];
    uniform sampler2D uTerr, uBowl; uniform vec2 uTow[6];
    const float FPX = ${FPX.toFixed(3)};
    float segD(vec2 p, vec2 a, vec2 b){ vec2 ab = b - a; float h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0); return length(p - a - ab * h); }
    vec3 ground(vec2 d, float alt, float pxm){
      // the bowl: solve g = d (alt − hb(|g|)) / FPX by fixed point
      vec2 g = d * alt / FPX;
      if (length(g) < ${(BR + 30).toFixed(1)}) {
        for (int i = 0; i < 3; i++){ float r = length(g); float hb = r < ${BR.toFixed(1)} ? -${BDEPTH.toFixed(1)} + r * r / ${(4 * BF).toFixed(1)} : -6.0; g = d * (alt - hb) / FPX; }
        float r = length(g);
        if (r < ${(BR + 3.0).toFixed(1)}) {
          vec3 c = texture2D(uBowl, g / ${(2 * BEXT).toFixed(1)} + 0.5).rgb;
          // the ring beam on the rim: lit steel, brighter on the twilight side
          float rb = smoothstep(${BR.toFixed(1)} - pxm, ${BR.toFixed(1)} + pxm * 0.5, r);
          vec3 st = vec3(0.040, 0.052, 0.070) * (0.8 + 0.6 * max(dot(normalize(g), uL), 0.0));
          return mix(c, st, rb);
        }
      }
      // the terrain: two fixed-point steps through the baked height
      g = d * alt / FPX;
      float h = texture2D(uTerr, g / ${(2 * TEXT).toFixed(1)} + 0.5).a; g = d * (alt - h) / FPX;
      h = texture2D(uTerr, g / ${(2 * TEXT).toFixed(1)} + 0.5).a; g = d * (alt - h) / FPX;
      return texture2D(uTerr, g / ${(2 * TEXT).toFixed(1)} + 0.5).rgb;
    }
    // towers, cables and the feed cabin, drawn over the ground (screen px)
    vec3 rig(vec2 d, float alt, vec3 c){
      float w = 1.0 / uS;
      for (int k = 0; k < 6; k++){
        vec2 t = uTow[k];
        vec2 tb = t * FPX / (alt + 4.0), tt = t * FPX / (alt - 120.0);
        // the tower: a radial bar (seen from straight above), lit on the twilight side
        float tw = max(5.0 * FPX / (alt - 60.0), w);
        float dt = segD(d, tb, tt);
        c = mix(c, vec3(0.020, 0.026, 0.034) * (0.7 + 0.8 * max(dot(normalize(t), uL), 0.0)), clamp(tw * 0.5 + 0.5 - dt, 0.0, 1.0));
        // the cable to the cabin
        vec2 ce = normalize(t) * 10.0 * FPX / (alt - ${HCAB.toFixed(1)});
        float cw = 0.8 * FPX / (alt - 110.0);
        float dc = segD(d, tt, ce);
        float cov = clamp(max(cw, w) * 0.5 + 0.5 - dc, 0.0, 1.0) * min(cw / w, 1.0);
        c = mix(c, vec3(0.045, 0.058, 0.078), cov);
      }
      // the cabin: a hexagonal drum, 10 m, dark steel with a lit edge
      float rc = 10.0 * FPX / (alt - ${HCAB.toFixed(1)});
      float a = atan(d.y, d.x); float hx = cos(3.14159265 / 6.0) / cos(mod(a, 1.0471976) - 0.5235988);
      float rr = length(d) / hx;
      float cin = clamp(rc - rr + 0.5, 0.0, 1.0);
      float edge = clamp(1.0 - abs(rr - rc + 1.2 * w) / max(1.5 * w, rc * 0.06), 0.0, 1.0);
      vec3 cab = vec3(0.012, 0.014, 0.019) + vec3(0.040, 0.052, 0.072) * edge * (0.6 + 0.8 * max(dot(normalize(d + 1e-4), uL), 0.0));
      return mix(c, cab, cin);
    }
    void main(){
      vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;
      vec2 d = (px - vec2(${RXY[0].toFixed(1)}, ${RXY[1].toFixed(1)})) * vec2(1.0, -1.0);
      d = mat2(cos(uRot), sin(uRot), -sin(uRot), cos(uRot)) * d;
      float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uJit);
      vec3 acc = vec3(0.0);
      for (int k = 0; k < ${NT}; k++){
        float alt = exp(mix(log(uAlt[k]), log(uAlt[k + 1]), jit));
        float pxm = alt / FPX;
        acc += rig(d, alt, ground(d, alt, pxm));
      }
      vec3 col = acc / float(${NT}) * uDim;
      // the lamp on the cabin, on R: a flat core at exactly RED_LAMP + its own red halo (30 %)
      float r = length(px - vec2(${RXY[0].toFixed(1)}, ${RXY[1].toFixed(1)})) * uS;
      float core = clamp(uLampR.x * uS + 0.5 - r, 0.0, 1.0);
      float hl = 0.3 * pow(clamp(1.0 - (r - uLampR.x * uS) / max((uLampR.y - uLampR.x) * uS, 1.0), 0.0, 1.0), 1.6);
      vec3 lamp = vec3(${LAMP.map(v => v.toFixed(3)).join(', ')});
      col = lamp * core + (1.0 - core) * (col + lamp * hl * uDim);
      gl_FragColor = vec4(col, 1.0);
    }`, Ud);

  const F0 = shot.frames[0];
  // altitude above the rim (m) as a function of the (fractional) frame: 1100 → 165 over f2916–2923, then slow
  const altF = fr => {
    const k = fr - F0;
    if (k <= 7) return 1100 * Math.pow(165 / 1100, Math.pow(Math.max(k, 0) / 7, 1.15));
    const s0 = 1100 * Math.log(165 / 1100) * 1.15 / 7 * (165 / 1100);   // d alt / d frame at k = 7 (continuous slope)
    return Math.max(118, 165 + s0 * (k - 7) * Math.exp(-(k - 7) / 2.2));
  };
  const cache = ctx.makeRT(W, H);
  let key = null;
  const blit = kit.fullscreen(/* glsl */ `uniform sampler2D tex; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb, 1.0); }`, { tex: { value: cache.texture } });
  return {
    render(s, f) {
      const fr = f.frame;
      const k = fr + ':' + f.barPx.toFixed(2);
      const ac = renderer.autoClear; renderer.autoClear = false;
      if (key !== k) {
        for (let i = 0; i <= NT; i++) Ud.uAlt.value[i] = altF(fr + 0.25 * (i / NT - 0.5));     // 90° shutter
        Ud.uJit.value = (fr * 0.6180339887) % 1;
        Ud.uRot.value = 0.06 * (fr - F0) / 12;
        Ud.uDim.value = fr >= F0 + 8 ? 0.35 : 1.0;
        const A = altF(fr) - HCAB - 2;
        const core = Math.min(40, Math.max(2.6, 0.55 * FPX / A));
        Ud.uLampR.value.set(core, Math.max(10, core * 3.85));
        renderer.setRenderTarget(cache); renderer.setClearColor(0x000000, 1); renderer.clear();
        pass.render(renderer, cache);
        key = k;
      }
      blit.render(renderer, f.target);
      renderer.autoClear = ac;
      renderer.setRenderTarget(f.target);
    },
  };
}

// The amber flash: the visible peak is f2924 (all voices land on E), then a slight fall to f2927; the cut to B1
// (whose transitionIn flash decays f2928–2933). The engine adds M7's transitionOut cubic (0, 0.02, 0.18, 0.59
// on f2924–2927); post() supplies the rest so that the total follows TARGET. tint / saturation are the
// timeline's v1.3 S26 values (keeps ACES from turning the flash cream) — only under the flash: before it they
// would warm the night and push the red lamp off its hue.
const TARGET = { 0: 0.95, 1: 0.90, 2: 0.86, 3: 0.82 };
export function divePost(shot, f) {
  const fr = Math.round(f.t * 24), k = fr - (shot.frames[1] - 4);
  if (k < 0) return { ...POST };
  const tout = shot.transitionOut || {};
  const rem = shot.end - fr / 24;
  const eng = tout.type === 'flash' && rem < tout.dur ? Math.pow(1 - rem / tout.dur, 3) * (tout.strength ?? 6) : 0;
  return { ...POST, tint: [1.0, 0.92, 0.8], saturation: 1.08, flash: Math.max(0, (TARGET[k] ?? 0.85) - eng), flashColor: (tout.color || [1.0, 0.4, 0.11]).slice() };
}
