// Shared: substitution ① "node corona" (screenplay S02-d, [1200, 1224)) — the long-take-A hand-off
// A1 (a_origin, renders ≤ f1211) → A2 (a_star, renders f1212 →).  Written by the A1 team; A2 imports, never edits.
//
// Everything here is a PURE FUNCTION OF THE FRAME NUMBER (fr = f.t * 24, fractional allowed for
// sub-frames).  Both modules call the same functions with the same numbers, so f1211 → f1212 is
// pixel-continuous by construction.
//
//   import { createCorona, coronaState, coronaPost, coronaWebDim, CORONA } from './_corona.js';
//
//   // in create(ctx):
//   const corona = createCorona(ctx);                 // one fullscreen material, no textures, no bake
//   // in render(shot, f), AFTER your scene is in f.target (the corona veils what is behind it):
//   corona.render(ctx.renderer, f.target, f.t * 24);  // no-op (returns false) when the corona is off
//   // in post(shot, f), for frames inside CORONA.postSpan:
//   if (coronaPost.active(f.t * 24)) return coronaPost(f.t * 24);   // full, explicit param set
//
// What it draws (screen space, 1080p pixel units, y down, centred on R = (734.5, 540.5) — the
// pixel-centre convention of _webgraph.js):
//   • a soft cold-white radial light, "radius ≈ 300 px" = the radius where the wide lobe falls to
//     10 % of its centre value; a tighter core (σ ≈ 46 px) on top.  Display value near R peaks at
//     ≈ 180/255 at f1212 under coronaPost() (HDR luminance ≈ 0.6, below the bloom knee — never white).
//   • faint coronal streamers: an angular modulation of the wide lobe (fixed integer harmonics,
//     seeded phases, very slow rotation) — radial, so forward motion does not smear them.
//   • a veil: the corona is drawn "over" the scene with premultiplied alpha = occ(r), i.e.
//     dst = dst · (1 − occ) + corona.  This is the "web fades behind the light" of the screenplay.
//     The scene itself should ALSO be dimmed by coronaWebDim(fr) (global multiplier for the web).
//
// Envelope (amplitude A, scale R300) — see coronaState():
//   f1194 ─ rise (smootherstep) ─ f1210 ═ plateau, peak exactly at f1212 (zero slope) ═ f1213
//   ─ retreat: amplitude falls and the lobe contracts towards the disk ─ f1224 A ≈ 0.18 ─ f1236 A = 0.
//   R300 grows slowly with the forward dolly (≈ 1.2 %/frame, about the camera's magnification),
//   then during the retreat contracts towards the 120 px disk A2 reveals at f1224.
//
// Colours (linear, ≥ 7000 K cold white): core STAR_DISK #E6EEFF → lobe STAR #BFD4FF → tail IRON_BLUE #6FA8FF.
import * as THREE from 'three';

const srgb2lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => [1, 3, 5].map(i => srgb2lin(parseInt(h.slice(i, i + 2), 16) / 255));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const s5 = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };

export const CORONA = {
  R: [734.5, 540.5],            // 1080p px, y down (pixel-centre convention, = _webgraph R)
  span: [1194, 1236],           // frames where coronaState().A > 0
  substitution: [1200, 1224],   // screenplay substitution ①
  handoffFrame: 1212,           // A1 renders ≤ 1211, A2 renders ≥ 1212
  postSpan: [1176, 1248],       // frames where both modules must use coronaPost()
  radius: 300,                  // nominal R300 at f1212 (px, 1080p)
  core: hex('#E6EEFF'),
  lobe: hex('#BFD4FF'),
  tail: hex('#6FA8FF'),
  coreGain: 0.30,               // HDR at R of the core term at A = 1
  lobeGain: 0.34,               // HDR at R of the lobe term at A = 1
  veil: 0.72,                   // occ at R at A = 1 (how much of what is behind R is hidden)
  streamer: 0.22,               // angular modulation depth of the lobe (outer part)
};

// Amplitude / scale of the corona at (fractional) frame fr.  Pure.
export function coronaState(fr) {
  const rise = s5(1194, 1210.5, fr);
  // retreat: from 1213, amplitude 1 → 0.18 at 1224 → 0 at 1236
  const fall = fr < 1224 ? 1 - 0.82 * s5(1213, 1224, fr) : 0.18 * (1 - s5(1224, 1236, fr));
  const A = rise * fall;
  // scale: slow growth with the dolly (×1.012 per frame around 1212), then contraction 1213 → 1226
  const grow = Math.exp(0.012 * (Math.min(fr, 1213) - 1212));
  const contract = 1 - 0.55 * s5(1213, 1226, fr);
  const R300 = CORONA.radius * grow * contract;
  // core width follows, but contracts less (it becomes the light of the disk's limb)
  const sigma = 46 * Math.exp(0.012 * (Math.min(fr, 1213) - 1212)) * (1 - 0.25 * s5(1213, 1226, fr));
  return { A: Math.max(0, A), R300, sigma, rot: 0.0035 * (fr - 1212) };
}

// How much the web (everything behind the corona) is dimmed globally at frame fr (multiplier).
// 1176–1200 the web is already the "selected" −30 % (0.70); during the substitution it fades further
// behind the light to 0.32 at the peak and stays there (A2 keeps it ≥ that; "only the dimmed web and black").
export function coronaWebDim(fr) {
  return 0.70 - 0.38 * s5(1198, 1212, fr);
}

// Fade of hero.first's own point / halo into the corona (A1 only; 1 = fully visible).
export function coronaHeroFade(fr) { return 1 - sstep(1197, 1207, fr); }

// Profile (CPU mirror of the shader, for measurements / tests).  r in 1080p px; theta in radians.
export function coronaProfile(r, theta, fr) {
  const S = coronaState(fr);
  if (S.A <= 0) return [0, 0, 0, 0];
  const x = r / S.R300;
  const lobe = Math.pow(1 + 3.22 * x * x, -1.6);
  const core = Math.exp(-0.5 * (r / S.sigma) ** 2);
  const str = 1 + CORONA.streamer * streamer(theta + S.rot) * sstep(0.12, 0.8, x);
  const c = [0, 1, 2].map(i => {
    const lobeCol = CORONA.lobe[i] + (CORONA.tail[i] - CORONA.lobe[i]) * sstep(0.45, 1.4, x);
    return S.A * (CORONA.coreGain * core * CORONA.core[i] + CORONA.lobeGain * lobe * str * lobeCol);
  });
  const occ = S.A * CORONA.veil * Math.pow(1 + 2.4 * x * x, -1.25);
  return [...c, occ];
}
const HARM = [[3, 0.9, 1.7], [5, 0.7, 4.1], [7, 0.55, 0.3], [11, 0.4, 2.9], [17, 0.28, 5.6], [29, 0.16, 1.1]];
const HNORM = HARM.reduce((s, h) => s + h[1], 0);
function streamer(th) { let s = 0; for (const [k, a, p] of HARM) s += a * Math.cos(k * th + p); return s / HNORM; }

export const CORONA_GLSL = /* glsl */ `
uniform float cA, cR300, cSigma, cRot, cCoreGain, cLobeGain, cVeil, cStreamer, cH;
uniform vec3 cCore, cLobe, cTail;
float coronaStreamer(float th){
  float s = 0.0;
  ${HARM.map(([k, a, p]) => `s += ${a.toFixed(3)} * cos(${k.toFixed(1)} * th + ${p.toFixed(3)});`).join('\n  ')}
  return s / ${HNORM.toFixed(4)};
}
// px: 1080p pixel coords, y down. Returns premultiplied (rgb, occ).
vec4 corona(vec2 px){
  vec2 d = px - vec2(${CORONA.R[0].toFixed(1)}, ${CORONA.R[1].toFixed(1)});
  float r = length(d);
  float x = r / cR300;
  float lobe = pow(1.0 + 3.22 * x * x, -1.6);
  float core = exp(-0.5 * (r / cSigma) * (r / cSigma));
  float th = atan(-d.y, d.x);
  float str = 1.0 + cStreamer * coronaStreamer(th + cRot) * smoothstep(0.12, 0.8, x);
  vec3 lobeCol = mix(cLobe, cTail, smoothstep(0.45, 1.4, x));
  vec3 c = cA * (cCoreGain * core * cCore + cLobeGain * lobe * str * lobeCol);
  float occ = cA * cVeil * pow(1.0 + 2.4 * x * x, -1.25);
  return vec4(c, occ);
}`;

// Fullscreen "over" pass: dst = dst·(1 − occ) + corona.  render() returns false (and draws nothing)
// outside CORONA.span.  Works at any render scale (uses H / 1080).
export function createCorona(ctx) {
  const { renderer } = ctx;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      cA: { value: 0 }, cR300: { value: 300 }, cSigma: { value: 46 }, cRot: { value: 0 },
      cCoreGain: { value: CORONA.coreGain }, cLobeGain: { value: CORONA.lobeGain }, cVeil: { value: CORONA.veil },
      cStreamer: { value: CORONA.streamer }, cH: { value: ctx.H },
      cCore: { value: new THREE.Vector3(...CORONA.core) }, cLobe: { value: new THREE.Vector3(...CORONA.lobe) }, cTail: { value: new THREE.Vector3(...CORONA.tail) },
    },
    vertexShader: /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: CORONA_GLSL + /* glsl */ `
      void main(){
        float k = 1080.0 / cH;
        vec2 px = vec2(gl_FragCoord.x, cH - gl_FragCoord.y) * k;
        gl_FragColor = corona(px);
      }`,
    depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false; scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    material: mat,
    state: coronaState,
    render(r, target, fr) {
      const S = coronaState(fr);
      if (!(S.A > 0)) return false;
      const u = mat.uniforms;
      u.cA.value = S.A; u.cR300.value = S.R300; u.cSigma.value = S.sigma; u.cRot.value = S.rot;
      u.cH.value = target ? target.height : ctx.H;
      const rr = r || renderer, ac = rr.autoClear;
      rr.autoClear = false;
      rr.setRenderTarget(target);
      rr.render(scene, cam);
      rr.autoClear = ac;
      return true;
    },
  };
}

// Post parameters both sides use for CORONA.postSpan (explicit full set → identical on both sides,
// no postBlend needed).  Pure function of the frame.  Streak is low so the light stays a soft glow.
export function coronaPost(fr) {
  return {
    exposure: 1.0, bloom: 0.75, bloomThreshold: 1.0, bloomKnee: 0.6, bloomRadius: 1.0,
    streak: 0.12, streakTint: [0.55, 0.75, 1.0],
    ca: 0.0006, vignette: 0.2, grain: 0.035, saturation: 1.0, contrast: 1.0,
    tint: [1, 1, 1], lift: [0, 0, 0], fade: 0, flash: 0, flashColor: [1, 0.96, 0.9], blackLevel: 0,
  };
}
coronaPost.active = fr => fr >= CORONA.postSpan[0] && fr < CORONA.postSpan[1];
