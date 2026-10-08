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
        vec2 q = rot2(-0.42) * p;
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
    uNebP: { value: new THREE.Vector4(pNeb[0] - 260, pNeb[1] - 130, 520, 260) },
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
      float ag = exp(-0.5 * pow((r - 9.0) / 2.2, 2.0));
      float ray = exp(-max(r, 0.0) / 22.0) * step(0.0, r);
      col += uAir * ag * 0.05 + uTw * ray * 0.012;
      col = mix(col, land, inside); a = inside;
      // the cold nebula
      vec2 nu = (px - uNebP.xy) / uNebP.zw;
      if (nu.x > 0.0 && nu.x < 1.0 && nu.y > 0.0 && nu.y < 1.0) {
        vec2 n = texture2D(uNeb, vec2(nu.x, 1.0 - nu.y)).rg;
        col += mix(uIron, uOIII, n.g) * n.r * 0.035;
      }
      gl_FragColor = vec4(col, a);
    }`, bgU, { blending: THREE.CustomBlending, transparent: true });
  premult(bg.material);

  // ---- the beam -------------------------------------------------------------------------------------
  const beamU = {
    uRes: bgU.uRes, uS: bgU.uS, uR: { value: new THREE.Vector2(RX, RY) }, uU: { value: u.clone() },
    uDR: { value: DR }, uCz: { value: 0 }, uDxy: { value: Dxy }, uDz: { value: Dz }, uF: { value: F }, uWB: { value: WB },
    uT: { value: 0 }, uHead: { value: 3000 }, uBits: { value: bitTex }, uSEntry: { value: sEntry },
    uCol: { value: new THREE.Vector3(1.0, 0.80, 0.56) }, uNeb: { value: nebTex }, uNebP: bgU.uNebP, uScratch: { value: 0 },
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
        float I = 3.0 * flux * headF;
        col += uCol * I * prof;
        col += vec3(1.0, 0.72, 0.45) * I * 0.05 * exp(-dp / (4.0 * sg));   // soft skirt
        // ② particles flowing outwards: one every 9 units, 60 units/s; bright where the bit is 1
        float sp = 9.0, flow = s - 60.0 * uT;
        float k = floor(flow / sp + 0.5), fr = flow - k * sp;
        float bit = texelFetch(uBits, ivec2(int(mod(k, 1679.0)), 0), 0).r;
        float along = fr / (sp * 0.22);
        float ds = (uF * uDxy * (uDR + uCz)) / (depth * depth);             // px per unit along the beam
        float pl = exp(-0.5 * along * along) * exp(-0.5 * dp * dp / (sg * sg * 0.35));
        col += vec3(1.0, 0.93, 0.82) * pl * mix(0.10, 1.0, bit) * 2.6 * flux * headF * smoothstep(0.6, 2.0, sp * ds);
        // ① the air around the root: closed-form single scattering of a line source (≈ 1/√(d₃² + r₀²))
        float rho = exp(-(s - uSEntry + 260.0) / 240.0);
        float d3 = dp * depth / uF, r0 = 3.0;
        col += vec3(1.0, 0.66, 0.38) * 0.9 * rho * r0 / sqrt(d3 * d3 + r0 * r0) * smoothstep(-40.0, 0.0, -dp + 400.0);
        // ③ the warm scratch the head leaves in the cold nebula
        vec2 nu = (px - uNebP.xy) / uNebP.zw;
        if (uScratch > 0.0 && nu.x > 0.0 && nu.x < 1.0 && nu.y > 0.0 && nu.y < 1.0 && s < uHead) {
          float n = texture2D(uNeb, vec2(nu.x, 1.0 - nu.y)).r;
          col += vec3(1.0, 0.62, 0.32) * n * uScratch * (exp(-dp / 2.5) * 1.2 + exp(-dp / 12.0) * 0.25);
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
      beamU.uScratch.value = util.smoothstep(118.6, 119.6, f.t);
      beam.render(renderer, f.target);
      renderer.autoClear = ac;
      renderer.setRenderTarget(f.target);
    },
    post(shot, f) {
      return { bloom: 0.8, bloomThreshold: 1.0, streak: 0.06, streakTint: [1.0, 0.8, 0.6], vignette: 0.24, grain: 0.035 };
    },
  };
}

function premult(m) {
  m.blending = THREE.CustomBlending; m.transparent = true;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation;
  m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; m.blendEquationAlpha = THREE.AddEquation;
}
