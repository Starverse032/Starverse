// f3864 hand-off · B2 `b_flight` (S07-d) → S34 `w_sea` (S08-a). Owned by the w_sea group.
//
// What both sides draw on the hand-off frames, as pure functions of the frame number fr (= f.t·24):
//   · the blue dot: 4×4 px at x 732–735, y 538–541 (screen space, exact pixels), core #82A4DA
//     (display; luma ≈ 160, blue 218), no bloom. From f3864 (w_sea only) it warms to #FFE2B8 and grows
//     into a 6-px core + 24-px soft glow over 48 frames: nodeMorph(fr) = 0 for fr ≤ 3864.
//   · the background stars = the cosmic-web nodes (WEB, seed 1990) projected from WEB_PATH(9.0)
//     (24 mm, the S02 f1128 composition): 1-px points, display 28–84 / 255, warm-neutral (not blue),
//     none within 160 px of R. They are the positions of the sea's first words (S08-a): from f3864
//     on w_sea turns them, nearest to R first, into 6–9 px glyphs (each star's turn: HANDOFF_STARS[i].tk).
//   · the PBD_BAND scattered-light band: vertical, x ≈ 824, σ 70 px, 5 % of #CDBB98 (display);
//     w_sea fades it out over f3864–3912.
//
//   import { createHandoffLayer } from './w_sea/handoff.js';
//   const hand = createHandoffLayer(ctx);
//   hand.render(renderer, f.target, f.t * 24);      // additive, screen space; call after the scene
//   // post on the hand-off frames: timeline.post with bloom 0, streak 0 (handoffPost(fr))
//
// B2 can draw its f3780–3863 frames with this same layer (fr < 3864: dot + stars + band only), so
// that f3863 (B2) and f3864 (S34) are the same function of fr — pixel continuity by construction.
import * as THREE from 'three';
import { getWeb, webPathPose } from '../_webgraph.js';
import { hdrForDisplay, hash1 } from './lexicon.js';

export const BLUE_DOT = { px: [732, 538, 4, 4], center: [734, 540], hex: '#82A4DA', node: '#FFE2B8' };
export const PBD = { x: 824, sigma: 70, level: 0.05, hex: '#CDBB98' };
export const HANDOFF_FRAME = 3864;
const FPX24 = 960 / (18 / 24);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// 0 → 1 over f3864–3912 (the dot becomes a node)
export const nodeMorph = fr => sstep(HANDOFF_FRAME, HANDOFF_FRAME + 48, fr);
export const bandLevel = fr => 1 - sstep(HANDOFF_FRAME, HANDOFF_FRAME + 48, fr);
// post on the hand-off: no bloom, no streak on the blue dot; w_sea ramps them in with the node
export function handoffPost(fr) {
  const k = sstep(HANDOFF_FRAME, HANDOFF_FRAME + 40, fr);
  return { bloom: 0.7 * k, streak: 0.18 * k };
}

// ---- the stars (pure, cached) -------------------------------------------------------------
let STARS = null;
export function handoffStars() {
  if (STARS) return STARS;
  const web = getWeb(), P = webPathPose(9.0);
  const { nodes, N, mass } = web;
  const cand = [];
  for (let i = 0; i < N; i++) {
    if (i === web.hero.first) continue;
    const dx = nodes[3 * i] - P.pos.x, dy = nodes[3 * i + 1] - P.pos.y, dz = nodes[3 * i + 2] - P.pos.z;
    const d = dx * P.forward.x + dy * P.forward.y + dz * P.forward.z;
    if (d < 30) continue;
    const xr = dx * P.right.x + dy * P.right.y + dz * P.right.z, yu = dx * P.up.x + dy * P.up.y + dz * P.up.z;
    const x = 960 + xr / d * FPX24, y = 540 - yu / d * FPX24;
    if (x < 24 || x > 1896 || y < 150 || y > 930) continue;
    if (Math.hypot(x - BLUE_DOT.center[0], y - BLUE_DOT.center[1]) < 172) continue;
    cand.push({ i, x, y, d, m: mass[i] / Math.sqrt(d / 60) });
  }
  // sparse: the heaviest, but never two within 18 px
  cand.sort((a, b) => b.m - a.m);
  const out = [];
  for (const c of cand) {
    if (out.length >= 150) break;
    if (out.some(o => Math.abs(o.x - c.x) < 18 && Math.abs(o.y - c.y) < 18)) continue;
    out.push(c);
  }
  // + the star that becomes 𒀭 at f3900 (S07-c on: "an ordinary star" at (900, 450))
  out.push({ i: -1, x: 900, y: 450, d: 40, m: 2, cune: true });
  const mm = out.map(o => o.m).sort((a, b) => a - b), med = mm[mm.length >> 1];
  const R = BLUE_DOT.center;
  const dist = out.map(o => Math.hypot(o.x - R[0], o.y - R[1])), dmax = Math.max(...dist);
  out.forEach((o, k) => {
    o.px = Math.round(o.x - 0.5); o.py = Math.round(o.y - 0.5);     // the pixel the star occupies
    o.level = clamp(0.11 + 0.10 * Math.log2(1 + o.m / med) + 0.04 * hash1(k, 3864), 0.11, 0.33);   // display 28–84
    // its turn to become a word: nearest to R first, f3870 → f3950
    o.tk = o.cune ? 3900 : 3870 + 80 * Math.pow((dist[k] - 160) / (dmax - 160), 0.9) + 3 * hash1(k, 3865);
  });
  STARS = out;
  return out;
}

// ---- the layer -----------------------------------------------------------------------------
export function createHandoffLayer(ctx) {
  const { renderer, W, H } = ctx;
  const S = H / 1080;
  const stars = handoffStars();
  const starHDR = hdrForDisplay('#E9E3D8', 1);
  const n = stars.length;
  const pos = new Float32Array(n * 3), aS = new Float32Array(n * 4);
  stars.forEach((s, k) => { pos.set([(s.px + 0.5) / 960 - 1, 1 - (s.py + 0.5) / 540, 0], 3 * k); aS.set([s.level, s.tk, hash1(k, 77), s.cune ? 1 : 0], 4 * k); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(aS, 4));
  // the level is a display value: HDR = inverse ACES of (level × colour); a star is exactly one pixel
  const lv = [0.11, 0.22, 0.33].map(l => hdrForDisplay('#E9E3D8', l));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { fr: { value: 0 }, sz: { value: Math.max(1, S) }, L1: { value: new THREE.Vector3(...lv[0]) }, L2: { value: new THREE.Vector3(...lv[1]) }, L3: { value: new THREE.Vector3(...lv[2]) } },
    vertexShader: /* glsl */ `attribute vec4 aS; uniform float fr, sz; uniform vec3 L1, L2, L3; varying vec3 vC;
      void main(){ gl_Position = vec4(position, 1.0); gl_PointSize = sz;
        float l = aS.x; vec3 c = l < 0.22 ? mix(L1, L2, (l - 0.11) / 0.11) : mix(L2, L3, (l - 0.22) / 0.11);
        // its turn: three quick flickers over 6 frames, then the word takes its light (w_sea)
        float e = fr - aS.y;
        float fl = e < 0.0 ? 1.0 : (e < 6.0 ? 1.0 + 0.9 * step(0.5, fract(e / 2.0 + aS.z)) : 0.0);
        vC = c * fl; if (fl <= 0.0) gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }`,
    fragmentShader: /* glsl */ `varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }`,
  });
  const starPts = new THREE.Points(g, starMat); starPts.frustumCulled = false;
  // the blue dot → node, and the PBD band (one full-screen pass, screen space)
  const dotHDR = hdrForDisplay(BLUE_DOT.hex, 1), nodeHDR = hdrForDisplay(BLUE_DOT.node, 1);
  const bandHDR = hdrForDisplay(PBD.hex, PBD.level);
  const fsMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      morph: { value: 0 }, band: { value: 1 }, dotC: { value: new THREE.Vector3(...dotHDR) }, nodeC: { value: new THREE.Vector3(...nodeHDR) },
      bandC: { value: new THREE.Vector3(...bandHDR) }, glowC: { value: new THREE.Vector3(...hdrForDisplay('#FFD9A8', 1)) }, res: { value: new THREE.Vector2(W, H) }, center: { value: new THREE.Vector2(...BLUE_DOT.center) }, scl: { value: 1 },
    },
    vertexShader: /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float morph, band, scl; uniform vec3 dotC, nodeC, bandC, glowC; uniform vec2 res, center;
      void main(){
        vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) * (1080.0 / res.y);   // 1080p px, y down (pixel centre at +0.5)
        vec2 q = (px - center) / scl;
        // the dot: a 4-px square (morph 0) → a 6-px round core (morph 1)
        float hs = mix(2.0, 3.0, morph);
        float rr = mix(1e3, 2.6, morph);
        vec2 aq = abs(q);
        float sq = step(aq.x, hs) * step(aq.y, hs);
        float rd = 1.0 - smoothstep(hs - 0.6, hs + 0.4, length(q));
        float core = mix(sq, rd, smoothstep(0.0, 0.5, morph));
        float glow = morph * 0.22 * exp(-dot(q, q) / (2.0 * 6.5 * 6.5)) + morph * 0.045 * exp(-dot(q, q) / (2.0 * 18.0 * 18.0));
        vec3 c = mix(dotC, nodeC, morph);
        vec3 col = c * core * mix(1.0, 0.62, morph) + glowC * glow;
        col += bandC * band * exp(-0.5 * pow((px.x - 824.0) / 70.0, 2.0)) * (1.0 - core);
        gl_FragColor = vec4(col, 1.0); }`,
  });
  const fs = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fsMat); fs.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(fs); scene.add(starPts);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    stars,
    // center / scale: where the node is on screen once the camera moves (S08-c); default R, 1
    render(rr, target, fr, { center = BLUE_DOT.center, scale = 1 } = {}) {
      const ren = rr || renderer;
      fsMat.uniforms.center.value.set(center[0], center[1]); fsMat.uniforms.scl.value = scale;
      fsMat.uniforms.morph.value = nodeMorph(fr); fsMat.uniforms.band.value = bandLevel(fr);
      starMat.uniforms.fr.value = fr;
      const ac = ren.autoClear; ren.autoClear = false;
      ren.setRenderTarget(target); ren.render(scene, cam);
      ren.autoClear = ac;
    },
    // the node's light on screen (for w_sea's bloom mask / measurements)
    nodeHDR, dotHDR, starHDR,
  };
}
