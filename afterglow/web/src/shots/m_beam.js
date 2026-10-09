// m_beam — S27 向黑暗发问 (113.0 → 123.0, f2712–2951). 24 mm; the camera is behind and above the beam
// and drifts straight back, linearly, 5 % of the distance to R in 10 s (R stays on R: the optical axis
// passes through it, lens-shifted).
//
// The only beam of light in the film. A warm, thin ray leaves the night Earth (a sliver of limb and
// airglow in the lower-left corner), crosses R and runs up and to the right, thinning in perspective
// (Gaussian section, σ 14 px at the frame edge → 1 px) until its head sinks into the stars near the
// vanishing point (1268, 160). Three quiet layers carry the 10 seconds:
//   ① the root glows in the air: single-scattering of the beam by an exponential atmosphere, integrated
//      analytically per pixel (closed form of the line integral — the soft "volume cone" without the
//      noise or cost of a 24-step march)
//   ② inside the core, particles flow outwards — their light/dark rhythm is the 1679 bits of the 1974
//      Arecibo message (m_beam/arecibo.js); nobody can read it, the body feels it (S28 reveals the beam
//      is made of words)
//   ③ ~119.0 the head runs through a faint cold nebula and leaves a warm scratch in it.
// Background: a sparse cold kit.starfield. The lower third stays empty sky for card ③ (114.0–118.75).
import * as THREE from 'three';
import { ARECIBO } from './m_beam/arecibo.js';
import { hex, RX, RY } from './f_fire/common.js';

const T0 = 113.0;
const F = 960 / (18 / 24);                       // 1080p px per unit tangent (24 mm)
const VP = [1268, 160];
const DR = 1000;                                 // distance camera → R along the axis (arbitrary units)

export async function create(ctx) {
  const { renderer, W, H, kit, util } = ctx;
  const S = H / 1080;

  // ---- geometry of the beam in screen terms ------------------------------------------------------
  // direction D (camera space, looking down −z) whose vanishing point is VP
  const D = new THREE.Vector3((VP[0] - RX) / F, (RY - VP[1]) / F, -1).normalize();
  const Dxy = Math.hypot(D.x, D.y), Dz = -D.z;
  const u = new THREE.Vector2(VP[0] - RX, VP[1] - RY).normalize();     // screen direction (y down) R → VP
  // beam half-width (units) so that σ = 14 px where it enters the band at the bottom
  const aOf = (s, cz) => F * s * Dxy / (DR + cz + s * Dz);
  const sOf = (a, cz) => a * (DR + cz) / (F * Dxy - a * Dz);
  const aEntry = -(942 - RY) / Math.abs(u.y);                            // along-line coordinate at y = 942
  const sEntry = sOf(aEntry, 0);
  const WB = 14 * (DR + sEntry * Dz) / F;
  const S_NEB = 9000;                                                   // the cold nebula's distance along the beam
  const head = t => 2600 + 1080 * (t - T0);                              // the beam front (reaches the nebula ≈ 119.0)

  // ---- Arecibo bits as a 1679×1 texture ----------------------------------------------------------
  const bits = new Uint8Array(1679 * 4);
  for (let i = 0; i < 1679; i++) bits[4 * i] = ARECIBO[i] === '1' ? 255 : 0;
  const bitTex = new THREE.DataTexture(bits, 1679, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  bitTex.minFilter = bitTex.magFilter = THREE.NearestFilter; bitTex.needsUpdate = true;

  // ---- the cold nebula (baked, sky-fixed) ----------------------------------------------------------
  const pNeb = [RX + u.x * aOf(S_NEB, 0), RY + u.y * aOf(S_NEB, 0)];
  const nebTex = kit.bake(renderer, {
    w: 1024, h: 512, wrap: THREE.ClampToEdgeWrapping, float: true,
    frag: /* glsl */ `
      void main(){
        vec2 p = (vUv - 0.5) * vec2(2.0, 1.0);
        vec2 q = rot2(0.95) * p;
        vec2 w = vec2(fbm(q * 3.0 + 1.3, 5), fbm(q * 3.0 + 8.1, 5)) - 0.5;
        float env = exp(-pow(length(q * vec2(0.9, 2.2)) / 0.62, 2.0));
        float f1 = fbm(q * 5.0 + w * 1.6, 6);
        float wisp = pow(1.0 - abs(snoise(vec3(q * vec2(2.4, 7.0) + w * 2.0, 3.0))), 6.0);
        float d = env * (smoothstep(0.42, 0.85, f1) * 0.8 + wisp * 0.6 * smoothstep(0.35, 0.6, f1));
        gl_FragColor = vec4(d, f1, 0.0, 1.0);
      }`,
  });

  // ---- stars --------------------------------------------------------------------------------------
  const stars = kit.starfield({ count: 14000, seed: 2727, radius: 1e5, H, sizeScale: 0.8, brightness: 0.75, warm: 0.12 });
  const starScene = new THREE.Scene(); starScene.add(stars);
  const starCam = kit.filmCamera(W, H, { focalMM: 24, near: 1, far: 3e5 });
  starCam.setViewOffset(W, H, (960 - RX) * S, (540 - RY) * S, W, H);
  starCam.rotation.set(0.05, -0.4, 0.0); starCam.updateMatrixWorld(); starCam.updateProjectionMatrix();

  // ---- background layer: night Earth's limb (lower-left), airglow, nebula — premultiplied over the stars
  const LIMB_C = [-760, 1720], LIMB_R = 1420;
  const bgU = {
    uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uNeb: { value: nebTex },
    uNebP: { value: new THREE.Vector4(pNeb[0] - 262, pNeb[1] - 128, 500, 250) },
    uC: { value: new THREE.Vector2(...LIMB_C) }, uRad: { value: LIMB_R },
    uAir: { value: new THREE.Vector3(...hex(0x7FE3C2)) }, uTw: { value: new THREE.Vector3(...hex(0x3A6FD8)) },
    uOIII: { value: new THREE.Vector3(...hex(0x4FE0D0)) }, uIron: { value: new THREE.Vector3(...hex(0x6FA8FF)) },
  };
  const bg = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes, uC; uniform float uS, uRad; uniform sampler2D uNeb; uniform vec4 uNebP;
    uniform vec3 uAir, uTw, uOIII, uIron;
    void main(){
      vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;
      float r = length(px - uC) - uRad;                  // > 0 outside the planet (px)
      vec3 col = vec3(0.0); float a = 0.0;
      // the night side: opaque, a faint glow of the hemisphere's cities under the beam root
      float inside = smoothstep(0.8, -0.8, r);
      vec3 land = vec3(0.0010, 0.0011, 0.0016) + vec3(1.0, 0.62, 0.32) * 0.010 * exp(-length(px - vec2(60.0, 1010.0)) / 160.0);
      // limb: a thin airglow line (σ ≈ 2 px) a little above the surface + Rayleigh blue haze, faint
      float ag = exp(-0.5 * pow((r - 9.0) / 3.0, 2.0));
      float ray = exp(-max(r, 0.0) / 26.0) * smoothstep(-1.5, 1.5, r) + 0.35 * exp(-max(r, 0.0) / 90.0) * step(0.0, r);
      // the limb is brighter towards the beam root (scattered city light), fading along the arc
      float along = exp(-length(px - vec2(120.0, 960.0)) / 700.0);
      col += (uAir * ag * 0.10 + uTw * ray * 0.035) * (0.35 + 0.65 * along);
      col = mix(col, land, inside); a = inside;
      // the cold nebula
      vec2 nu = (px - uNebP.xy) / uNebP.zw;
      if (nu.x > 0.0 && nu.x < 1.0 && nu.y > 0.0 && nu.y < 1.0) {
        vec2 n = texture2D(uNeb, vec2(nu.x, 1.0 - nu.y)).rg;
        float fe = smoothstep(0.0, 0.15, nu.x) * smoothstep(1.0, 0.85, nu.x) * smoothstep(0.0, 0.2, nu.y) * smoothstep(1.0, 0.8, nu.y);
        col += mix(uIron, uOIII, n.g) * n.r * fe * 0.12;
      }
      gl_FragColor = vec4(col, a);
    }`, bgU, { blending: THREE.CustomBlending, transparent: true });
  premult(bg.material);

  // ---- the beam -------------------------------------------------------------------------------------
  const beamU = {
    uRes: bgU.uRes, uS: bgU.uS, uR: { value: new THREE.Vector2(RX, RY) }, uU: { value: u.clone() },
    uDR: { value: DR }, uCz: { value: 0 }, uDxy: { value: Dxy }, uDz: { value: Dz }, uF: { value: F }, uWB: { value: WB },
    uT: { value: 0 }, uHead: { value: 3000 }, uBits: { value: bitTex }, uSEntry: { value: sEntry },
    uCol: { value: new THREE.Vector3(1.0, 0.47, 0.17) }, uNeb: { value: nebTex }, uNebP: bgU.uNebP, uScratch: { value: 0 },
    uSNeb: { value: S_NEB },
  };
  const beam = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes, uR, uU; uniform float uS, uDR, uCz, uDxy, uDz, uF, uWB, uT, uHead, uSEntry, uScratch, uSNeb;
    uniform sampler2D uBits, uNeb; uniform vec4 uNebP; uniform vec3 uCol;
    void main(){
      vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;
      vec2 d = px - uR;
      float a = dot(d, uU), dp = abs(d.x * uU.y - d.y * uU.x);
      float aVP = uF * uDxy / uDz;
      vec3 col = vec3(0.0);
      if (a < aVP - 0.5) {
        float s = a * (uDR + uCz) / (uF * uDxy - a * uDz);
        float depth = uDR + uCz + s * uDz;
        float sig = uWB * uF / depth;                         // 1080p px
        float sg = max(sig, 0.75), flux = min(sig / 0.75, 1.0);
        float headF = smoothstep(uHead, uHead * 0.78, s);     // the front, softly
        float prof = exp(-0.5 * dp * dp / (sg * sg));
        // ② the flow inside the core: the 1679 Arecibo bits, one every SP units, travelling outwards at
        // V units/s (≈ 300 px/s at R). Each bit is a soft Gaussian bead (σ 0.45·SP), so runs of 1s merge
        // into bright packets and runs of 0s into gaps: the core's brightness breathes ±25 % with the
        // message. The rhythm fades out where a bit shrinks below ~4 px (no aliasing towards the head).
        float sp = 45.0, flow = s - 515.0 * uT;
        float kc = floor(flow / sp + 0.5), m = 0.0;
        for (int j = -1; j <= 1; j++) {
          float k = kc + float(j), x = (flow - k * sp) / (0.45 * sp);
          m += texelFetch(uBits, ivec2(int(mod(k + 1679.0 * 64.0, 1679.0)), 0), 0).r * exp(-0.5 * x * x);
        }
        m = min(m, 1.0);
        float ds = (uF * uDxy * (uDR + uCz)) / (depth * depth);             // px per unit along the beam
        float vis = smoothstep(2.5, 6.0, sp * ds);
        float mod1 = 1.0 + 0.25 * (2.0 * m - 1.0) * vis;
        // the core: a warm (AMBER) thread, HDR ≈ 1.3 (±25 %) — below the ACES shoulder, never a white plateau
        float I = 1.3 * flux * headF;
        col += uCol * I * prof * mod1;
        // a thin sheath (σ × 2.4) carries the same rhythm more strongly, so the flow reads in the air
        // around the thread without fattening it
        float sh = exp(-0.5 * dp * dp / (sg * sg * 5.76));
        col += vec3(1.0, 0.52, 0.22) * I * 0.08 * sh * (1.0 + 0.6 * (2.0 * m - 1.0) * vis);
        col += vec3(1.0, 0.60, 0.32) * I * 0.025 * exp(-dp / (4.0 * sg));  // soft skirt
        // ① the air around the root: closed-form single scattering of a line source (≈ 1/√(d₃² + r₀²))
        float rho = exp(-(s - uSEntry + 260.0) / 240.0);
        float d3 = dp * depth / uF, r0 = 3.0;
        col += vec3(1.0, 0.60, 0.30) * 0.30 * rho * r0 / sqrt(d3 * d3 + r0 * r0) * smoothstep(-40.0, 0.0, -dp + 400.0);
        // ③ the warm scratch the head leaves in the cold nebula: the nebula's own density, lit by the
        // beam where it crosses it — a flare as the head passes (≈119.0), settling to a lasting trace
        vec2 nu = (px - uNebP.xy) / uNebP.zw;
        if (uScratch > 0.0 && nu.x > 0.0 && nu.x < 1.0 && nu.y > 0.0 && nu.y < 1.0 && s < uHead) {
          float n = texture2D(uNeb, vec2(nu.x, 1.0 - nu.y)).r;
          n *= smoothstep(0.0, 0.15, nu.x) * smoothstep(1.0, 0.85, nu.x) * smoothstep(0.0, 0.2, nu.y) * smoothstep(1.0, 0.8, nu.y);
          col += vec3(1.0, 0.55, 0.24) * n * uScratch * (exp(-dp / 2.0) * 2.4 + exp(-dp / 9.0) * 0.9 + exp(-dp / 30.0) * 0.2);
        }
      }
      gl_FragColor = vec4(col, 1.0);
    }`, beamU, { blending: THREE.AdditiveBlending, transparent: true });

  return {
    render(shot, f) {
      const lt = f.t - T0;
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.setRenderTarget(f.target); renderer.setClearColor(0x000000, 1); renderer.clear();
      renderer.render(starScene, starCam);
      bg.render(renderer, f.target);
      beamU.uT.value = lt;
      beamU.uCz.value = 0.05 * DR * util.clamp(lt / 10, 0, 1.2);
      beamU.uHead.value = head(f.t);
      // the scratch: flares as the head crosses the nebula (≈ 119.0), holds ~2 s, settles to a trace
      beamU.uScratch.value = util.smoothstep(118.6, 119.3, f.t) * (0.35 + 0.65 * Math.exp(-Math.max(0, f.t - 120.3) / 1.2));
      beam.render(renderer, f.target);
      renderer.autoClear = ac;
      renderer.setRenderTarget(f.target);
    },
    post(shot, f) {
      return { bloom: 0.35, bloomThreshold: 0.9, streak: 0.04, streakTint: [1.0, 0.8, 0.6], vignette: 0.24, grain: 0.035 };
    },
  };
}

function premult(m) {
  m.blending = THREE.CustomBlending; m.transparent = true;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation;
  m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; m.blendEquationAlpha = THREE.AddEquation;
}
