// _sweep.js — shared by A3 (a_descent, [1740, 1758)) and A4 (f_fire, [1758, 1762)). Written by the A3 group.
//
// Long take A, S02-f, the two foreground wipes that carry the last two scale substitutions:
//   置换④ [1740, 1746)  a near acacia branch (out-of-focus dark silhouette, thorny twigs rim-lit by the
//                        west sky) sweeps LEFT → RIGHT; behind it the view goes ≈ 1.35 km → 60 m.
//   置换⑤ [1756, 1762)  a near clump of dry grass blades (out of focus, pale straw, lit from the left)
//                        sweeps RIGHT → LEFT across R; behind it the view goes ≈ 27.8 m → 0.55 m.
// Each covers at most ≈ 70 % of the frame at its widest (measured peaks 52 % / 58 %), covers R (α > 0.5)
// for ≤ 4 frames (acacia f1741, 1742, 1744; grass f1758, 1759), and is never a black frame. The hand-off
// A3 → A4 is f1758, inside 置换⑤.
//
// The behind-the-grass world swap (A3's 28 m ground → A4's macro set) is bridged by the VEIL: a shared,
// screen-space, heavily defocused dusk ground (a pure function of the frame) that both sides mix over
// their own world with the SAME weight veilWeight(n): 0 at f1756, 0.55 at f1757, 1 at f1758, 0.8 at f1759,
// 0.4 at f1760, 0 from f1761. So at f1758 both sides show exactly veil + grass: pixel-continuous by
// construction; A3's world dissolves into it under the grass, A4's macro set dissolves out of it.
//
//   import { createSweep, sweepPost, HANDOFF_1758 } from './_sweep.js';
//   const sweep = createSweep(ctx);      // bakes two canvas textures (~0.3 s)
//   render(shot, f) {
//     ...draw your own world into f.target...
//     sweep.drawOver(f);                 // veil (with its weight) + the wipe of this frame, premultiplied,
//   }                                    // on top of whatever is in f.target; a no-op outside the wipes
//   post(shot, f) { return sweepPost(f.frame); }   // = the A3 post; A4 may instead set postBlend
//
// Everything is a pure function of n = f.t · 24 (sub-frames welcome: the wipes integrate their own
// 180° shutter, 8 taps along the motion).
import * as THREE from 'three';
import { RX, RY, camAt, focalAt, viewWidthAt, GLIDE_DEG, DUSK, cloudsPost } from './_clouds.js';

export const ACACIA_FRAMES = [1740, 1746];
export const GRASS_FRAMES = [1756, 1762];

// ---- the poses (1080p pixel units, y down) ------------------------------------------------------------
// layer = a W×H picture slid across the frame; u = progress 0 → 1 (fully off-frame at both ends)
const ACACIA = { w: 1800, h: 1120, y0: -40, t0: 1739.55, len: 6.05, s0: 1.30, grow: 0.20 };
const GRASS  = { w: 1700, h: 1120, y0: -20, t0: 1755.25, len: 6.00, s0: 1.22, grow: 0.25 };
const ease = u => u;                                   // constant speed: a foreground object whipping past
export function acaciaPose(n) {
  const u = ease((n - ACACIA.t0) / ACACIA.len);
  const x = -ACACIA.w + u * (1920 + ACACIA.w);        // left edge of the layer, moving right
  return { u, x, y: ACACIA.y0, w: ACACIA.w, h: ACACIA.h, s: ACACIA.s0 + ACACIA.grow * u, on: u > -0.05 && u < 1.05 };
}
export function grassPose(n) {
  const u = ease((n - GRASS.t0) / GRASS.len);
  const x = 1920 - u * (1920 + GRASS.w);              // left edge, moving left
  return { u, x, y: GRASS.y0, w: GRASS.w, h: GRASS.h, s: GRASS.s0 + GRASS.grow * u, on: u > -0.05 && u < 1.05 };
}
export function veilWeight(n) {
  // piecewise-linear in n through the integer frames; both sides call this, never a copy of it
  const k = [[1756, 0], [1757, 0.55], [1758, 1], [1759, 0.8], [1760, 0.4], [1761, 0]];
  if (n <= k[0][0] || n >= k[k.length - 1][0]) return 0;
  for (let i = 1; i < k.length; i++) if (n <= k[i][0]) { const [a, wa] = k[i - 1], [b, wb] = k[i]; return wa + (wb - wa) * (n - a) / (b - a); }
  return 0;
}
export const sweepPost = n => cloudsPost(n);

// ---- what A4 needs to line its macro set up with the descent at f1758 ---------------------------------
// World: metres, x east, y up, z south; camera faces north (−z) → west (the dusk) is screen LEFT.
// The descent camera sits on a 4.5° glide line through the target, which is the point on the ground
// that ends up under R: the tinder. At f1758 it is at d ≈ 17.2 m, 1.35 m up (view at the target ≈ 7.5 m, 82.1 mm).
// The veil hides the jump to the macro framing (A4: 100 mm, ≈ 0.55 m view at f1762, 0.37 m at f1776);
// A4 only has to keep: the tinder (its focus point) on R, camera facing north, no roll, the dusk light
// from the left/west (low, cold, sun 4° below the west horizon), no other light, and the same post.
export const HANDOFF_1758 = (() => {
  const c = camAt(1758);
  return {
    frame: 1758,
    focalMM: +focalAt(1758).toFixed(3),           // the A3 zoom curve: 35 → 100 mm exponential over [1680, 1776]
    viewWidthM: +viewWidthAt(1758).toFixed(4),    // frame width at the target (m); 0.55 at f1762 (viewWidthAt(1762))
    distanceM: +c.d.toFixed(4), glideDeg: GLIDE_DEG, cameraHeightM: +c.alt.toFixed(4),
    principalPointPx: [RX, RY],                   // lens shift puts the optical axis (through the target) on R
    facing: DUSK.facing, roll: 0,
    dusk: { ...DUSK, skyLight: 'cold blue-grey from above, warm-grey from the west (screen left); no sun, no lamps' },
    veil: 'veilWeight(n) — A4 mixes its world towards the veil with this weight at f1758–1760 (1, 0.8, 0.4)',
    grassCoversR: [1758, 1759],      // α > 0.5 at R (f1760: 0.49)
  };
})();

// ---- the textures --------------------------------------------------------------------------------------
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const K = 0.5;                                          // canvases at half the 1080p layer size (they are defocused anyway)

function acaciaCanvas() {
  const W = ACACIA.w * K, H = ACACIA.h * K;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rng(1740);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  const leaf = (x, y, s) => {                           // a feathery tuft of bipinnate leaflets
    for (let i = 0; i < 18; i++) {
      const a = r() * 6.283, d = Math.pow(r(), 0.7) * s;
      g.globalAlpha = 0.35 + 0.4 * r();
      g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, s * (0.18 + 0.2 * r()), s * (0.08 + 0.08 * r()), a, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
  };
  const branch = (x, y, ang, len, w, depth) => {
    // a zig-zag twig: straight internodes with a kink at every node, a pair of straight thorns per node
    const nodes = Math.max(3, Math.round(len / (34 + 30 * r())));
    let px = x, py = y, a = ang;
    for (let i = 0; i < nodes; i++) {
      const seg = len / nodes;
      a += (i % 2 ? 1 : -1) * (0.16 + 0.12 * r());
      const nx = px + Math.cos(a) * seg, ny = py + Math.sin(a) * seg;
      const ww = w * (1 - 0.75 * i / nodes);
      g.lineWidth = Math.max(1, ww); g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      if (ww < 9) {                                     // thorns on the thin twigs
        for (const sgn of [-1, 1]) {
          const ta = a + sgn * (1.0 + 0.3 * r()), tl = 7 + 9 * r();
          g.lineWidth = 1.2; g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + Math.cos(ta) * tl, ny + Math.sin(ta) * tl); g.stroke();
        }
        if (r() < 0.85) leaf(nx + (r() - 0.5) * 14, ny + (r() - 0.5) * 14, 18 + 22 * r());
      }
      if (depth > 0 && r() < (depth > 2 ? 0.45 : 0.6)) branch(nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.5 + 0.5 * r()), len * (0.35 + 0.35 * r()), ww * 0.6, depth - 1);
      px = nx; py = ny;
    }
  };
  // the limb enters low-left of the layer and rises to the right, forking (its right end leads the wipe)
  branch(-20, H * 0.95, -0.42, W * 0.62, 34, 4);
  branch(W * 0.28, H * 0.66, -0.15, W * 0.55, 20, 3);
  branch(W * 0.45, H * 0.52, -0.62, W * 0.34, 14, 3);
  branch(W * 0.20, H * 0.80, 0.18, W * 0.40, 12, 3);
  branch(W * 0.55, H * 0.40, 0.25, W * 0.40, 10, 3);
  // defocus (the branch is ≈ 1 m from a 70 mm lens focused far away): a wide soft blur of the silhouette
  const d = document.createElement('canvas'); d.width = W; d.height = H;
  const h = d.getContext('2d');
  h.filter = 'blur(7px)'; h.drawImage(c, 0, 0);
  return d;
}

function grassCanvas() {
  const W = GRASS.w * K, H = GRASS.h * K;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rng(1756);
  // RGB = per-blade brightness (shade of the straw), A = coverage
  const blade = (x0, h, lean, curl, w0, shade) => {
    const n = 24, L = [], Rr = [];
    let x = x0, y = H + 6, a = -Math.PI / 2 + lean;
    for (let i = 0; i <= n; i++) {
      const s = i / n, ww = w0 * (1 - 0.92 * Math.pow(s, 1.4)) / 2;
      const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
      L.push([x + nx * ww, y + ny * ww]); Rr.push([x - nx * ww, y - ny * ww]);
      x += Math.cos(a) * h / n; y += Math.sin(a) * h / n;
      a += curl * s * 0.12;
    }
    const v = Math.round(255 * shade);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath(); g.moveTo(...L[0]); for (const p of L) g.lineTo(...p); for (const p of Rr.reverse()) g.lineTo(...p); g.closePath(); g.fill();
  };
  // a clump: dense near the base (low in the frame), a fan of long blades through the R row and above
  for (let i = 0; i < 120; i++) {
    const x0 = W * (0.04 + 0.92 * r());
    const h = H * (0.45 + 0.75 * Math.pow(r(), 0.8));
    const lean = (r() - 0.5) * 0.9, curl = (r() - 0.5) * 2.2;
    blade(x0, h, lean, curl, 6 + 16 * r(), 0.45 + 0.55 * r());
  }
  for (let i = 0; i < 40; i++) {                         // bent and broken blades lying across
    const x0 = W * (0.1 + 0.8 * r());
    blade(x0, H * (0.3 + 0.4 * r()), (r() < 0.5 ? -1 : 1) * (0.7 + 0.5 * r()), (r() - 0.5) * 4, 5 + 9 * r(), 0.35 + 0.5 * r());
  }
  const d = document.createElement('canvas'); d.width = W; d.height = H;
  const h2 = d.getContext('2d');
  h2.filter = 'blur(5px)'; h2.drawImage(c, 0, 0);
  return d;
}

const VS_UV = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function createSweep(ctx) {
  const { renderer, FSQ, GLSL } = ctx;
  const mk = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.flipY = false; t.needsUpdate = true; return t; };
  const texA = mk(acaciaCanvas()), texG = mk(grassCanvas());

  const NT = 12;
  const SHUTTER = 0.3;                                  // fraction of a frame: fast foreground, crisp enough to read the thorns
  const layerMat = new THREE.ShaderMaterial({
    vertexShader: VS_UV, depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: {
      uTex: { value: null }, uX: { value: new Array(NT).fill(0) }, uS: { value: new Array(NT).fill(1) },
      uY: { value: 0 }, uWH: { value: new THREE.Vector2() }, uBody: { value: new THREE.Vector3() }, uRim: { value: new THREE.Vector3() },
      uRimPx: { value: 14 }, uShadeK: { value: 0 }, uTrans: { value: new THREE.Vector3() },
    },
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform sampler2D uTex; uniform float uX[${NT}], uS[${NT}];
      uniform float uY, uRimPx, uShadeK; uniform vec2 uWH; uniform vec3 uBody, uRim, uTrans;
      vec4 tap(vec2 lp){ vec2 uv = lp / uWH; if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0); return texture2D(uTex, uv); }
      void main(){
        vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
        vec3 col = vec3(0.0); float al = 0.0;
        float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
        for (int k = 0; k < ${NT}; k++){
          // the layer grows about its own centre as it nears the lens; taps jittered inside their stratum
          float xk = uX[k] + j * (uX[${NT - 1}] - uX[0]) / float(${NT - 1});
          vec2 c = vec2(xk + 0.5 * uWH.x, uY + 0.5 * uWH.y);
          vec2 lp = (px - c) / uS[k] + 0.5 * uWH;
          vec4 t = tap(lp);
          float a = t.a;
          // west light: the edges whose outside is to the LEFT catch the dusk sky (soft: out of focus)
          float aw = tap(lp - vec2(uRimPx, -0.3 * uRimPx)).a;
          float rim = clamp(a - aw, 0.0, 1.0);
          float shade = mix(1.0, t.r, uShadeK);
          col += uBody * a * shade + uRim * rim * (0.6 + 0.4 * shade) + uTrans * a * (1.0 - a) * 4.0;
          al += a;
        }
        gl_FragColor = vec4(col / float(${NT}), al / float(${NT}));
      }`,
  });
  const layer = new FSQ(layerMat);

  // the veil: a defocused dusk ground seen through out-of-focus grass, screen space (1080p px)
  const veilMat = new THREE.ShaderMaterial({
    vertexShader: VS_UV, depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.NormalBlending,
    uniforms: { uW: { value: 0 }, uN: { value: 0 } },
    fragmentShader: GLSL.common + /* glsl */ `
      varying vec2 vUv; uniform float uW, uN;
      void main(){
        vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
        float y = px.y / 1080.0, x = px.x / 1920.0;
        // far: the last of the west light low in the frame's upper part, falling off to the right
        vec3 c = mix(vec3(0.050, 0.046, 0.052), vec3(0.018, 0.016, 0.015), smoothstep(0.18, 0.62, y));
        c += vec3(0.060, 0.038, 0.026) * exp(-pow((y - 0.24) / 0.16, 2.0)) * (1.0 - 0.7 * x);
        c *= 1.0 - 0.35 * smoothstep(0.55, 1.0, x) * smoothstep(0.3, 0.9, y);
        // big soft discs: straw tips and pebbles far out of focus, drifting out from R with the push
        float k = (uN - 1756.0) * 0.18;
        for (int i = 0; i < 18; i++){
          vec2 h = hash22(vec2(float(i), 7.3));
          vec2 p = vec2(${RX.toFixed(1)}, ${RY.toFixed(1)}) + (h * vec2(1920.0, 820.0) - vec2(860.0, 300.0)) * (1.0 + k);
          float r = 26.0 + 40.0 * hash12(vec2(float(i), 1.9));
          float d = length(px - p);
          float disc = smoothstep(r, r - 6.0, d);
          c += vec3(0.032, 0.026, 0.018) * disc * (0.4 + 0.6 * hash12(vec2(float(i), 3.3))) * (1.2 - x * 0.6);
        }
        gl_FragColor = vec4(c, uW);
      }`,
  });
  const veil = new FSQ(veilMat);

  // colours (linear HDR, exposure 1): the branch is a dark silhouette (L ≈ 3–6) with a cool-warm west rim
  // (L ≈ 45); the grass is dim straw (L ≈ 15–25) with a brighter west edge (L ≈ 55) and a little glow
  // where the blades thin out (light through dry grass)
  const LOOK = {
    acacia: { body: [0.0045, 0.0040, 0.0038], rim: [0.10, 0.072, 0.055], trans: [0.004, 0.003, 0.002], rimPx: 16, shadeK: 0 },
    grass: { body: [0.032, 0.025, 0.016], rim: [0.120, 0.085, 0.052], trans: [0.010, 0.008, 0.005], rimPx: 12, shadeK: 0.8 },
  };
  function drawLayer(target, n, pose, tex, look) {
    const U = layerMat.uniforms;
    for (let k = 0; k < NT; k++) {
      const nk = n + SHUTTER * ((k + 0.5) / NT - 0.5);     // the shutter around the frame (jittered per pixel below)
      const p = pose(nk);
      U.uX.value[k] = p.x; U.uS.value[k] = p.s;
    }
    const p0 = pose(n);
    U.uY.value = p0.y; U.uWH.value.set(p0.w, p0.h);
    U.uTex.value = tex;
    U.uBody.value.fromArray(look.body); U.uRim.value.fromArray(look.rim); U.uTrans.value.fromArray(look.trans);
    U.uRimPx.value = look.rimPx; U.uShadeK.value = look.shadeK;
    layer.render(renderer, target);
  }
  return {
    textures: { acacia: texA, grass: texG },
    veilWeight, acaciaPose, grassPose,
    // the veil only (weight veilWeight(n)) — for a module that wants to draw its own blades over it
    drawVeil(f, target = f.target) {
      const n = f.t * 24, w = veilWeight(n);
      if (w <= 0) return;
      const ac = renderer.autoClear; renderer.autoClear = false;
      veilMat.uniforms.uW.value = w; veilMat.uniforms.uN.value = n;
      veil.render(renderer, target);
      renderer.autoClear = ac; renderer.setRenderTarget(target);
    },
    // opts.alphaOnly: draw the coverage itself (white, no rim) — for measuring the ≤ 70 % / ≤ 4 frames rules
    drawBlades(f, target = f.target, opts = {}) {
      const n = f.t * 24;
      const ac = renderer.autoClear; renderer.autoClear = false;
      const W1 = { body: [1, 1, 1], rim: [0, 0, 0], trans: [0, 0, 0], rimPx: 1, shadeK: 0 };
      if (acaciaPose(n - 0.25).on || acaciaPose(n + 0.25).on) drawLayer(target, n, acaciaPose, texA, opts.alphaOnly ? W1 : LOOK.acacia);
      if (grassPose(n - 0.25).on || grassPose(n + 0.25).on) drawLayer(target, n, grassPose, texG, opts.alphaOnly ? W1 : LOOK.grass);
      renderer.autoClear = ac; renderer.setRenderTarget(target);
    },
    // veil + blades over whatever is in the target
    drawOver(f, target = f.target) { this.drawVeil(f, target); this.drawBlades(f, target); },
  };
}
