// a_origin / web — the cosmic web of long take A (S02-b stars, S02-c web, S02-d sprint + substitution ①),
// seen from WEB_PATH_A.  Adapted from c_web (v1.3 S10): same WEB graph (seed 1990), same 640 000-point
// dust sample, same gas ribbons / haze, same analytic capsule motion blur.  Importable by A2 (a_star) for
// the dimmed web behind the corona at the f1212 hand-off — see docs/v2/handoffs.md.
//
//   import { createWebLayer } from './a_origin/web.js';
//   const web = createWebLayer(ctx);
//   web.render(renderer, target, fr, { clear: true });   // fr = f.t·24; camera = applyWebPathA(fr)
//
// Pure function of fr.  Brightness: node stars ignite on ignitionA() (S02-b/c law); filaments and gas
// light from their two end nodes (PROP s per edge) → fully lit by f1128.  Colour by distance:
// 7000 K (near: whiter, sharper) → 15000 K (far: colder, dimmer, softer).  Selection f1128–1175: the
// R node +1 EV, ≈ 40 cluster stars around it brighten into one knot, the rest −30 % (coronaWebDim takes
// over from f1198).  Sprint f1176–1200: capsules grow to the full half-frame displacement (radial
// streaks, "≤ 5 %/frame"), the gas gets an 8-tap zoom blur about R of the same length.
// hero.first: f888 footprint (drawn by a_origin), f889 → HDR 1 → 40 in 6 frames (easeOutQuad, slight
// overshoot), short own streak; its glow FWHM 6 px → 20 px over the sprint; f1197–1207 it fades into
// the corona (coronaHeroFade).  Near filaments (S02-c): 4 thin (2–4 px) threads close to the camera,
// drawn "over" (they occlude the nodes behind them), crossing the frame edges.
import * as THREE from 'three';
import { getWeb, sampleWebPoints, applyWebPathA, webPathAPose, WEB_PATH_A } from '../_webgraph.js';
import { ignitionA, PROP, T_FIRST } from './ignition.js';
import { coronaWebDim, coronaHeroFade } from '../_corona.js';

const FPS = 24;
const FPX = 1280;
const N_DUST = 640000, N_GAS = 24000;
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => new THREE.Vector3(srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255));
const PAL = { STAR: hex(0xBFD4FF), HAZE: hex(0x6B5CFF), VIOLET: hex(0x8E7CFF), CURSOR: hex(0xF2EEE4) };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const s5 = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---- shared time curves (pure) -------------------------------------------------------------------
export function webState(fr) {
  const sel = s5(1128, 1146, fr);                         // selection
  const gain = fr < 1198 ? 1 - 0.3 * sel : coronaWebDim(fr);
  const sprint = s5(1172, 1184, fr) * (1 - s5(1206, 1222, fr));   // long capsules / zoom blur
  const heroFade = coronaHeroFade(fr);
  // hero.first: HDR 1 → 40 over f889–895 (easeOutQuad + 10 % overshoot), +1 EV in the selection
  const e0 = fr - 889;
  const u = clamp(e0 / 6), rise = 1 - (1 - u) * (1 - u);
  const over = 1 + 0.10 * Math.sin(Math.PI * clamp((e0 - 3) / 10));
  let hero = fr < 889 ? 0 : 40 * lerp(1 / 40, 1, rise) * over;
  hero *= 1 + sel;                                         // +1 EV
  hero *= heroFade;
  const glowFWHM = lerp(6, 20, s5(1176, 1200, fr));        // 6 → 20 px over the sprint
  const glowA = (0.55 + 0.9 * s5(1176, 1200, fr)) * (fr < 889 ? 0 : 1) * heroFade;
  const cluster = 1 + 1.4 * sel * (1 - s5(1190, 1210, fr));   // the knot of ≈ 40 stars around R
  // in the corona the stars sink into the glare (S02-K15: no pixel above L 230 in [1200, 1224))
  const starDim = 1 - 0.88 * s5(1192, 1206, fr);
  return { fr, t: fr / FPS, starDim, sel, gain, sprint, hero, glowFWHM, glowA, cluster, heroFade };
}

let SHARED = null;
export function createWebLayer(ctx) {
  if (SHARED && SHARED.ctx === ctx) return SHARED.layer;
  const { renderer, W, H, kit, util, GLSL } = ctx;
  const S = H / 1080;
  const I = ignitionA();
  const web = I.web;
  const { nodes, edges, E, N, mass, degree } = web;
  const first = web.hero.first;
  const FIRST = new THREE.Vector3(nodes[3 * first], nodes[3 * first + 1], nodes[3 * first + 2]);
  const r = util.rng(55 * 1000 + 12);
  const ms = Array.from(mass).sort((a, b) => a - b), mMed = ms[ms.length >> 1];
  const mN = i => mass[i] / mMed;
  const heroSet = new Set(web.hero.filament);
  const heroEdge = e => heroSet.has(edges[2 * e]) && heroSet.has(edges[2 * e + 1]);
  const DELAY = 0.25;                                       // filaments start lighting after their node
  const nodeLit = i => I.tIgn[i] + DELAY;
  const edgeLit = (e, u) => { const a = edges[2 * e], b = edges[2 * e + 1]; return Math.min(nodeLit(a) + PROP * u, nodeLit(b) + PROP * (1 - u)); };

  // ============================== dust points ==================================================
  const pts = sampleWebPoints(web, N_DUST, 7);
  const nD = pts.count;
  const aD = new Float32Array(nD * 4);       // tLit, lum, rand (temperature jitter), flag (1 = clump of R star)
  for (let i = 0; i < nD; i++) {
    let tl, w;
    if (pts.kind[i] === 0) {
      const e = pts.edgeOf[i], a = edges[2 * e], b = edges[2 * e + 1];
      tl = edgeLit(e, pts.along[i]);
      w = Math.sqrt(mN(a) * mN(b)) * (heroEdge(e) ? 4.5 : 1);
    } else {
      const n = pts.nodeOf[i];
      // (hero.first's own clump lights with the web at f972, not with the lonely star of f888)
      tl = n === first ? 40.5 + 0.6 * r() : nodeLit(n) + 0.05 * r();
      w = mN(n) * 0.8 * Math.exp(0.5 * r.gauss());
    }
    const lum = 0.075 * Math.pow(Math.min(w, 16), 1.25) * Math.exp(0.7 * r.gauss());
    const flag = pts.kind[i] === 1 && pts.nodeOf[i] === first ? 1 : 0;
    aD.set([tl, Math.min(lum, 1.6), r(), flag], 4 * i);
  }
  const heroEdges = [];
  for (let e = 0; e < E; e++) if (heroEdge(e)) heroEdges.push(e);
  const N_HERO = 36000, N_CL = 3500, nAll = nD + N_HERO + N_CL;
  const dPos = new Float32Array(nAll * 3), dA = new Float32Array(nAll * 4);
  dPos.set(pts.pos, 0); dA.set(aD, 0);
  for (let k = 0; k < N_HERO; k++) {
    const e = heroEdges[k % heroEdges.length], a = edges[2 * e], b = edges[2 * e + 1];
    const u = r(), L = Math.hypot(nodes[3 * b] - nodes[3 * a], nodes[3 * b + 1] - nodes[3 * a + 1], nodes[3 * b + 2] - nodes[3 * a + 2]);
    const sg = (r() < 0.7 ? 0.03 : 0.09) * L;
    for (let j = 0; j < 3; j++) dPos[3 * (nD + k) + j] = nodes[3 * a + j] + (nodes[3 * b + j] - nodes[3 * a + j]) * u + r.gauss() * sg;
    const x = (heroEdges.indexOf(e) + u) * 1.7;
    const clump = Math.max(0, 0.45 + 0.55 * Math.sin(x * 2.1 + 0.7) * Math.sin(x * 0.83 + 2.0) + 0.3 * Math.sin(x * 5.3 + 1.1));
    dA.set([edgeLit(e, u), 0.085 * clump * Math.exp(0.6 * r.gauss()), r(), 0], 4 * (nD + k));
  }
  // the R star's own cluster (Plummer, a = 0.8 u) — the knot the camera dives into
  for (let k = 0, o = nD + N_HERO; k < N_CL; k++, o++) {
    const rr = Math.min(7, 0.8 / Math.sqrt(Math.pow(Math.max(1e-4, r()), -2 / 3) - 1));
    const d = r.sphere();
    for (let j = 0; j < 3; j++) dPos[3 * o + j] = nodes[3 * first + j] + d[j] * rr;
    dA.set([nodeLit(first) + 2.0 + 1.5 * r(), 0.035 * Math.exp(0.9 * r.gauss()), r(), 1], 4 * o);
  }
  const gD = new THREE.BufferGeometry();
  gD.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  gD.setAttribute('aD', new THREE.BufferAttribute(dA, 4));
  const common = {
    uT: { value: 0 }, uS: { value: S }, uFpx: { value: FPX * S }, uGain: { value: 1 }, uSub: { value: 1 },
    uFocus: { value: 24 }, uSprint: { value: 0 }, uCluster: { value: 1 },
    uVPa: { value: new THREE.Matrix4() }, uVPb: { value: new THREE.Matrix4() }, uFirst: { value: FIRST },
  };
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { ...common, uViolet: { value: PAL.VIOLET } },
    vertexShader: GLSL.common + /* glsl */ `
      attribute vec4 aD;
      uniform float uT, uS, uFpx, uGain, uSub, uFocus, uSprint, uCluster; uniform vec3 uViolet;
      uniform mat4 uVPa, uVPb;
      varying vec3 vCol; varying float vI, vSig, vPs; varying vec2 vSeg;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        float e = uT - aD.x;
        float lit = smoothstep(0.0, 0.3, e) * (1.0 + 0.9 * exp(-max(e, 0.0) / 0.3));
        float g = aD.w > 0.5 ? uCluster * min(1.0, uGain / 0.7) : uGain;
        float I = aD.y * lit * g * uSub * pow(30.0 / max(d, 9.0), 1.05);
        I *= smoothstep(0.25, 1.4, d) * (1.0 - smoothstep(330.0, 430.0, d));
        // distance: near = 7000 K, whiter, sharper; far = 15000 K, colder, dimmer, softer
        float fd = smoothstep(14.0, 150.0, d);
        float far = clamp(fd + 0.35 * (aD.z - 0.5), 0.0, 1.0);
        I *= mix(1.0, 0.55, fd);
        float base = mix(1.5, 2.6, fd);
        float coc = 0.009 * uFpx / uS * abs(1.0 / max(d, 0.05) - 1.0 / uFocus);
        float size = min(sqrt(base * base + coc * coc), 28.0);
        I *= (1.6 * 1.6) / (size * size);
        vSig = size / 2.355;
        vec4 ca = uVPa * vec4(position, 1.0), cb = uVPb * vec4(position, 1.0);
        vec2 seg = (ca.w > 0.05 && cb.w > 0.05) ? (cb.xy / cb.w - ca.xy / ca.w) * vec2(960.0, 540.0) : vec2(0.0);
        float len = length(seg);
        // cruise: "an observation, not a flight" — fast near points fade, capsules ≤ 3 px;
        // sprint: the full half-frame streak (radial), fading only beyond ~120 px
        vec2 fd2 = mix(vec2(5.0, 12.0), vec2(40.0, 90.0), uSprint);
        I *= 1.0 - smoothstep(fd2.x, fd2.y, len / uSub);
        float capD = mix(3.0, 60.0, uSprint) * uSub;
        if (len > capD) { seg *= capD / len; len = capD; }
        I *= 6.2832 * vSig * vSig / (6.2832 * vSig * vSig + len * 2.5066 * vSig);
        vSeg = seg;
        vec3 bb = blackbody(mix(7000.0, 15000.0, far)); bb /= max(1e-3, luma(bb));
        vec3 vi = uViolet / luma(uViolet);
        vCol = mix(bb, vi, 0.04 + 0.10 * far);
        vI = I;
        vPs = size * 2.2 + 1.0 + len;
        gl_PointSize = (I > 2e-4 && d > 0.05) ? vPs * uS : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vI, vSig, vPs; varying vec2 vSeg;
      void main(){
        vec2 q = (gl_PointCoord - 0.5) * vPs; q.y = -q.y;
        vec2 pa = q + 0.5 * vSeg;
        float h = clamp(dot(pa, vSeg) / max(dot(vSeg, vSeg), 1e-6), 0.0, 1.0);
        vec2 dv = pa - vSeg * h;
        float g = exp(-0.5 * dot(dv, dv) / (vSig * vSig));
        gl_FragColor = vec4(vCol * vI * g, 1.0);
      }`,
  });
  const dust = new THREE.Points(gD, dustMat); dust.frustumCulled = false;

  // ============================== node stars + the R knot =====================================
  // ≈ 40 knot stars around hero.first: a tube along the line of sight (lateral Plummer a = 0.32 u,
  // depth −2.5 … +7 u towards the camera) — at f1128 (d 24 u) they sit within ≈ 60 px of R; in the
  // sprint the camera flies between them and they scatter past the frame edges.
  const N_KNOT = 42;
  const Pa = webPathAPose(1128);
  const dirC = Pa.pos.clone().sub(FIRST).normalize();       // hero.first → camera
  const rgt = Pa.right.clone(), up = Pa.up.clone();
  const kn = [];
  const rk = util.rng(1990 + 41);
  for (let k = 0; k < N_KNOT; k++) {
    const lat = Math.max(0.12, 0.32 / Math.sqrt(Math.pow(Math.max(1e-3, rk()), -2 / 3) - 1));
    const a = rk() * Math.PI * 2;
    // depth towards the camera: 80 % in front of hero.first (they pass the lens in the sprint), 20 % behind
    const dep = rk() < 0.8 ? 0.8 + 11.0 * Math.pow(rk(), 0.9) : -2.0 + 2.5 * rk();
    const p = FIRST.clone().addScaledVector(dirC, dep).addScaledVector(rgt, Math.min(lat, 1.6) * Math.cos(a)).addScaledVector(up, Math.min(lat, 1.6) * Math.sin(a));
    kn.push([p, 42.2 + 1.6 * k / N_KNOT + 0.2 * rk(), 5 + 9 * Math.pow(rk(), 2)]);
  }
  const NS = N + N_KNOT;
  const sPos = new Float32Array(NS * 3), aS = new Float32Array(NS * 4);  // tIgn, amp, temperature, flag (1 R star, 3 knot)
  sPos.set(nodes, 0);
  for (let i = 0; i < N; i++) {
    let amp = 2.2 * Math.pow(Math.min(mN(i), 20), 0.7) * Math.exp(0.35 * r.gauss());
    let flag = 0;
    if (I.rank[i] === 1) { amp = 16; flag = 4; }
    if (i === first) { amp = 1; flag = 1; }
    aS.set([I.tIgn[i], amp, r(), flag], 4 * i);
  }
  kn.forEach(([p, t, amp], k) => { sPos.set([p.x, p.y, p.z], 3 * (N + k)); aS.set([t, amp, rk(), 3], 4 * (N + k)); });
  const gS = new THREE.BufferGeometry();
  gS.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  gS.setAttribute('aS', new THREE.BufferAttribute(aS, 4));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { ...common, uStar: { value: PAL.STAR }, uHero: { value: 0 }, uStarDim: { value: 1 }, uGlowS: { value: 2.5 }, uGlowA: { value: 0 } },
    vertexShader: GLSL.common + /* glsl */ `
      attribute vec4 aS;
      uniform float uT, uS, uGain, uSub, uSprint, uCluster, uHero, uStarDim; uniform vec3 uStar;
      uniform mat4 uVPa, uVPb;
      varying vec3 vCol; varying float vI, vStreak, vHalf, vFirst; varying vec2 vSeg;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        float e = (uT - aS.x) * 24.0;
        float u = clamp(e / 6.0, 0.0, 1.0);
        float rise = 1.0 - (1.0 - u) * (1.0 - u);
        float over = 1.0 + 0.10 * sin(3.14159 * clamp((e - 3.0) / 10.0, 0.0, 1.0));
        float on = step(0.0, e);
        vFirst = aS.w > 0.5 && aS.w < 1.5 ? 1.0 : 0.0;
        float knot = aS.w > 2.5 ? 1.0 : 0.0;
        float I;
        if (vFirst > 0.5) I = uHero * uSub;                           // explicit schedule (webState)
        else if (aS.w > 3.5) I = aS.y * mix(0.04, 1.0, rise) * over * on * uGain * uSub * mix(1.0, 0.45, smoothstep(41.0, 47.0, uT));   // the second star (f936): not distance-dimmed
        else {
          float g = knot > 0.5 ? uCluster * min(1.0, uGain / 0.7) : uGain;
          // stars stay points: brightness rises gently as the camera nears (not 1/d²)
          I = aS.y * mix(0.04, 1.0, rise) * over * on * g * uSub * pow(30.0 / max(d, 0.5), knot > 0.5 ? 0.6 : 0.9);
          I *= smoothstep(0.4, 2.0, d) * (1.0 - smoothstep(330.0, 430.0, d));
          float fd = smoothstep(14.0, 150.0, d);
          I *= mix(1.0, 0.6, fd);
        }
        I *= vFirst > 0.5 ? 1.0 : uStarDim;
        vI = I;
        vStreak = clamp((I - 5.0) / 20.0, 0.0, 1.0);
        if (vFirst > 0.5) vStreak = 1.0;
        float fd = smoothstep(14.0, 150.0, d);
        float T = mix(7500.0, 15000.0, clamp(fd + 0.4 * (aS.z - 0.5), 0.0, 1.0));
        vec3 bb = blackbody(T); bb /= max(1e-3, luma(bb));
        vCol = vFirst > 0.5 ? uStar / luma(uStar) : mix(uStar / luma(uStar), bb, 0.6);
        float rad = clamp(4.0 + 6.0 * log2(1.0 + I), 4.0, 40.0);
        rad = max(rad, vStreak > 0.0 ? 40.0 + 30.0 * vStreak : 0.0);
        if (vFirst > 0.5) rad = 80.0;
        vec4 ca = uVPa * vec4(position, 1.0), cb = uVPb * vec4(position, 1.0);
        vec2 seg = (ca.w > 0.05 && cb.w > 0.05) ? (cb.xy / cb.w - ca.xy / ca.w) * vec2(960.0, 540.0) : vec2(0.0);
        float len = length(seg);
        vec2 fs = mix(vec2(5.0, 12.0), vec2(90.0, 200.0), max(uSprint, knot * 0.6));
        vI *= 1.0 - smoothstep(fs.x, fs.y, len / uSub);
        float cap = mix(6.0, 140.0, uSprint) * uSub;
        if (len > cap) { vI *= cap / len; seg *= cap / len; len = cap; }
        vI *= 4.54 / (4.54 + len * 2.13);
        vSeg = seg;
        rad += 0.5 * len;
        vHalf = rad;
        gl_PointSize = (I > 0.01 && d > 0.3) ? 2.0 * rad * uS : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uGlowS, uGlowA;
      varying vec3 vCol; varying float vI, vStreak, vHalf, vFirst; varying vec2 vSeg;
      void main(){
        vec2 q0 = (gl_PointCoord - 0.5) * 2.0 * vHalf; q0.y = -q0.y;
        vec2 pa = q0 + 0.5 * vSeg;
        float h = clamp(dot(pa, vSeg) / max(dot(vSeg, vSeg), 1e-6), 0.0, 1.0);
        vec2 q = pa - vSeg * h;
        float r2 = dot(q, q), rr = sqrt(r2);
        float core = exp(-0.5 * r2 / (0.85 * 0.85));
        float wing = 0.045 * pow(1.0 + r2 / (1.8 * 1.8), -2.5) + 0.0010 * exp(-rr / 12.0);
        float st = vStreak * 0.010 * exp(-abs(q.x) / 20.0) * exp(-0.5 * q.y * q.y / 0.81) * smoothstep(64.0, 40.0, abs(q.x));
        float I = vI * (core + wing + st);
        // hero.first's own glow (FWHM 6 → 20 px over the sprint), absolute HDR
        if (vFirst > 0.5) I += uGlowA * (exp(-0.5 * r2 / (uGlowS * uGlowS)) + 0.08 * exp(-rr / (2.5 * uGlowS)));
        gl_FragColor = vec4(vCol * I, 1.0);
      }`,
  });
  const stars = new THREE.Points(gS, starMat); stars.frustumCulled = false;

  // ============================== gas (half resolution) =======================================
  const rbPos = new Float32Array(E * 4 * 3), rbB = new Float32Array(E * 4 * 3), rbC = new Float32Array(E * 4 * 4);
  const rbIdx = new Uint32Array(E * 6), rbT = new Float32Array(E * 4 * 2);
  for (let e = 0; e < E; e++) {
    const a = edges[2 * e], b = edges[2 * e + 1];
    const L = Math.hypot(nodes[3 * b] - nodes[3 * a], nodes[3 * b + 1] - nodes[3 * a + 1], nodes[3 * b + 2] - nodes[3 * a + 2]);
    const w = Math.sqrt(mN(a) * mN(b)) * (heroEdge(e) ? 3.2 : 1);
    const amp = 0.011 * Math.pow(Math.min(w, 16), 1.25) * Math.exp(0.35 * r.gauss());
    const width = Math.min(1.6, Math.max(0.35, 0.032 * L));
    for (let k = 0; k < 4; k++) {
      const u = k >> 1, s = (k & 1) * 2 - 1, o = 4 * e + k;
      rbPos.set(nodes.subarray(3 * a, 3 * a + 3), 3 * o);
      rbB.set(nodes.subarray(3 * b, 3 * b + 3), 3 * o);
      rbC.set([u, s, width, amp], 4 * o);
      rbT.set([nodeLit(a), nodeLit(b)], 2 * o);
    }
    rbIdx.set([4 * e, 4 * e + 1, 4 * e + 2, 4 * e + 1, 4 * e + 3, 4 * e + 2], 6 * e);
  }
  const gR = new THREE.BufferGeometry();
  gR.setAttribute('position', new THREE.BufferAttribute(rbPos, 3));
  gR.setAttribute('aB', new THREE.BufferAttribute(rbB, 3));
  gR.setAttribute('aC', new THREE.BufferAttribute(rbC, 4));
  gR.setAttribute('aT', new THREE.BufferAttribute(rbT, 2));
  gR.setIndex(new THREE.BufferAttribute(rbIdx, 1));
  const ribbonMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { ...common, uCol: { value: PAL.HAZE.clone().lerp(PAL.VIOLET, 0.5).lerp(PAL.STAR, 0.3) }, uHot: { value: PAL.STAR.clone().lerp(PAL.VIOLET, 0.25) }, uProp: { value: PROP } },
    vertexShader: GLSL.common + /* glsl */ `
      attribute vec3 aB; attribute vec4 aC; attribute vec2 aT;
      uniform float uGain;
      varying float vU, vS, vA, vD, vL; varying vec2 vTimes;
      void main(){
        vec3 A = (modelViewMatrix * vec4(position, 1.0)).xyz;
        vec3 B = (modelViewMatrix * vec4(aB, 1.0)).xyz;
        vec3 P = mix(A, B, aC.x);
        vec3 dir = B - A;
        vec3 side = normalize(cross(dir, P));
        P += side * aC.y * min(aC.z, 0.016 * max(-P.z, 1.0)) * 2.6;
        gl_Position = projectionMatrix * vec4(P, 1.0);
        vU = aC.x; vS = aC.y; vA = aC.w * uGain; vD = -P.z; vL = length(dir); vTimes = aT;
      }`,
    fragmentShader: GLSL.common + /* glsl */ `
      uniform float uT, uProp; uniform vec3 uCol, uHot;
      varying float vU, vS, vA, vD, vL; varying vec2 vTimes;
      void main(){
        float prof = exp(-0.5 * (vS * 2.6) * (vS * 2.6));
        float tl = min(vTimes.x + uProp * vU, vTimes.y + uProp * (1.0 - vU));
        float e = uT - tl;
        float lit = smoothstep(0.0, 0.45, e) * (1.0 + 0.6 * exp(-max(e, 0.0) / 0.4));
        float near = smoothstep(12.0, 40.0, vD) * exp(-vD / 170.0) * 1.25;
        float knot = 0.75 + 0.5 * pow(abs(vU - 0.5) * 2.0, 3.0);
        float sd = fract((vTimes.x + vTimes.y) * 13.37) * 97.0;
        float x1 = vU * vL / 2.0 + sd, x2 = vU * vL / 0.8 + sd * 1.7;
        float n1 = mix(hash11(floor(x1)), hash11(floor(x1) + 1.0), smoothstep(0.0, 1.0, fract(x1)));
        float n2 = mix(hash11(floor(x2) + 31.0), hash11(floor(x2) + 32.0), smoothstep(0.0, 1.0, fract(x2)));
        knot *= 0.35 + 0.9 * n1 + 0.45 * n2;
        vec3 col = mix(uCol, uHot, smoothstep(0.015, 0.09, vA));
        gl_FragColor = vec4(col * vA * prof * lit * near * knot, 1.0);
      }`,
  });
  const ribbons = new THREE.Mesh(gR, ribbonMat); ribbons.frustumCulled = false;

  const gp = sampleWebPoints(web, N_GAS, 11, { clumpShare: 0.12 });
  const nH = gp.count + N;
  const hPos = new Float32Array(nH * 3), hA = new Float32Array(nH * 4);
  hPos.set(gp.pos, 0);
  for (let i = 0; i < gp.count; i++) {
    const tl = gp.kind[i] === 0 ? edgeLit(gp.edgeOf[i], gp.along[i]) : nodeLit(gp.nodeOf[i]);
    hA.set([tl, 1.5 * (0.7 + 0.6 * r()), 0.02, 0], 4 * i);
  }
  for (let i = 0; i < N; i++) {
    const o = gp.count + i;
    hPos.set(nodes.subarray(3 * i, 3 * i + 3), 3 * o);
    const sig = (0.6 + 0.25 * degree[i]) * 0.9;
    hA.set([nodeLit(i) + (i === first ? 3.0 : 0), sig, 0.035 * Math.pow(Math.min(mN(i), 20), 0.85) * (i === first ? 2.5 : 1), i === first ? 2 : 1], 4 * o);
  }
  const gH = new THREE.BufferGeometry();
  gH.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
  gH.setAttribute('aH', new THREE.BufferAttribute(hA, 4));
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { ...common, uFpxQ: { value: 1 }, uHaze: { value: PAL.HAZE }, uStar: { value: PAL.STAR } },
    vertexShader: GLSL.common + /* glsl */ `
      attribute vec4 aH;
      uniform float uT, uGain, uFpxQ, uCluster; uniform vec3 uHaze, uStar;
      varying vec3 vCol; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        float e = uT - aH.x;
        float lit = smoothstep(0.0, 0.5, e);
        float g = aH.w > 1.5 ? uCluster * min(1.0, uGain / 0.7) : uGain;
        float px = aH.y * uFpxQ / max(d, 0.05);
        float sz = clamp(2.0 * px * 2.2, 1.0, 160.0);
        float a = aH.z * g * lit * min(1.0, pow(2.0 * px * 2.2 / sz, 2.0));
        a *= smoothstep(9.0, 45.0, d) * exp(-d / 170.0) * 1.25;
        if (aH.w > 1.5) a *= smoothstep(3.0, 9.0, d);
        vA = a;
        vCol = aH.w > 0.5 ? mix(uHaze, uStar, 0.45) : mix(uHaze, uStar, 0.2);
        gl_PointSize = a > 1e-5 ? sz : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA;
      void main(){
        vec2 q = (gl_PointCoord - 0.5) * 2.0 * 2.2;
        float g = exp(-0.5 * dot(q, q) * 2.0);
        gl_FragColor = vec4(vCol * vA * g, 1.0);
      }`,
  });
  const haze = new THREE.Points(gH, hazeMat); haze.frustumCulled = false;

  // ============================== near filaments (occluding) ==================================
  // 4 thin threads, each placed at the pose of frame fc at the depth where it crosses the frame edge
  // at ≈ 30–50 px/frame; drawn "over" (premultiplied): they hide the nodes behind them.
  const NF = [[1010, 0.55, 2.6], [1065, 0.80, -0.25], [1118, 0.62, 3.4], [1160, 0.75, 0.3]];   // frame, edge fraction, angle
  const fPos = [], fSide = [], fAttr = [], fIdx = [];
  const SEG = 48;
  NF.forEach(([fc, ef, ang], j) => {
    const P = webPathAPose(fc);
    const v = WEB_PATH_A.distance(fc - 0.5) - WEB_PATH_A.distance(fc + 0.5);   // u / frame
    const z = Math.max(1.5, v / 0.045);
    const rpx = 1100 * ef;                                                      // px from R at fc
    const dirS = [Math.cos(ang), Math.sin(ang)];
    // anchor: on the ray at (R + rpx·dirS) at depth z
    const R0 = [734.5 + rpx * dirS[0], 540.5 + rpx * dirS[1]];
    const xw = (R0[0] - 960) / FPX * z, yw = -(R0[1] - 540) / FPX * z;
    const anchor = P.pos.clone().addScaledVector(P.forward, z).addScaledVector(P.right, xw).addScaledVector(P.up, yw);
    // direction: mostly tangential (perpendicular to the radial screen direction) with some depth
    const tan = P.right.clone().multiplyScalar(-dirS[1]).addScaledVector(P.up, -dirS[0]).addScaledVector(P.forward, 0.35 * (j % 2 ? 1 : -1)).normalize();
    const L = z * 2.2;
    const base = fPos.length / 3;
    for (let s = 0; s <= SEG; s++) {
      const u = s / SEG - 0.5;
      const bend = 0.12 * z * Math.sin(u * 3.1 + j);                        // a gentle curve (depth)
      const lat = 0.10 * z * Math.sin(u * 4.4 + 1.7 * j) + 0.04 * z * Math.sin(u * 11.0 + j);   // and a sway
      const p = anchor.clone().addScaledVector(tan, u * L).addScaledVector(P.forward, bend)
        .addScaledVector(P.right, lat * dirS[0]).addScaledVector(P.up, -lat * dirS[1]);
      for (const sd of [-1, 1]) { fPos.push(p.x, p.y, p.z); fSide.push(sd); fAttr.push(u + 0.5, j, 0); }
    }
    for (let s = 0; s < SEG; s++) { const a = base + 2 * s; fIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  // tangent per vertex (central difference along the thread)
  const fTan = new Float32Array(fPos.length);
  for (let i = 0; i < fPos.length / 3; i++) {
    const s = Math.floor(i / 2) % (SEG + 1), j0 = i - 2 * s - (i & 1);   // first vertex of this thread
    const a = j0 + 2 * Math.max(0, s - 1) + (i & 1), b = j0 + 2 * Math.min(SEG, s + 1) + (i & 1);
    for (let k = 0; k < 3; k++) fTan[3 * i + k] = fPos[3 * b + k] - fPos[3 * a + k];
  }
  const gF = new THREE.BufferGeometry();
  gF.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  gF.setAttribute('aTan', new THREE.BufferAttribute(fTan, 3));
  gF.setAttribute('aSide', new THREE.Float32BufferAttribute(fSide, 1));
  gF.setAttribute('aF', new THREE.Float32BufferAttribute(fAttr, 3));
  gF.setIndex(fIdx);
  const filMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { ...common, uFilA: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) } },
    vertexShader: GLSL.common + /* glsl */ `
      attribute vec3 aTan, aF; attribute float aSide;
      uniform float uS; uniform mat4 uVPa, uVPb; uniform vec2 uRes;
      varying float vSide, vU, vW, vBlur;
      void main(){
        vec4 c0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec4 c1 = projectionMatrix * modelViewMatrix * vec4(position + aTan, 1.0);
        vec2 s0 = c0.xy / c0.w * 0.5 * uRes, s1 = c1.xy / c1.w * 0.5 * uRes;
        vec2 t = normalize(s1 - s0 + 1e-6); vec2 n = vec2(-t.y, t.x);
        // screen motion over the shutter, its component across the thread widens it (motion blur)
        vec4 ca = uVPa * vec4(position, 1.0), cb = uVPb * vec4(position, 1.0);
        vec2 mv = (ca.w > 0.05 && cb.w > 0.05) ? (cb.xy / cb.w - ca.xy / ca.w) * 0.5 * uRes : vec2(0.0);
        float across = abs(dot(mv, n));
        float wpx = 3.5 * uS;                                   // 3.5 px thread (1080p)
        float hw = 0.5 * wpx + 0.5 * across + 9.0 * uS;           // + a soft out-of-focus glow skirt
        vW = hw; vBlur = wpx / (wpx + across);
        vec2 off = n * aSide * hw;
        gl_Position = c0 + vec4(off / (0.5 * uRes) * c0.w, 0.0, 0.0);
        vSide = aSide; vU = aF.x;
        if (c0.w < 0.05) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFilA, uS;
      varying float vSide, vU, vW, vBlur;
      void main(){
        float x = vSide * vW;                                     // px from the centre line
        float w0 = 1.5 * uS / max(vBlur, 1e-3);
        float prof = exp(-0.5 * x * x / (w0 * w0 * 0.5));
        float ends = smoothstep(0.0, 0.18, vU) * smoothstep(1.0, 0.82, vU);
        float skirt = exp(-0.5 * x * x / (36.0 * uS * uS));
        float a = uFilA * 0.85 * prof * ends * vBlur;
        // the strand itself glows faintly (cold white) and has a soft defocused skirt
        vec3 rim = vec3(0.075, 0.085, 0.11) * (prof + 0.25 * skirt) * ends * vBlur * uFilA;
        gl_FragColor = vec4(rim, a);
      }`,
  });
  const filaments = new THREE.Mesh(gF, filMat); filaments.frustumCulled = false;

  // ============================== assembly ====================================================
  const sceneGas = new THREE.Scene(); sceneGas.add(ribbons); sceneGas.add(haze);
  const scene = new THREE.Scene(); scene.add(dust); scene.add(stars);
  const sceneFil = new THREE.Scene(); sceneFil.add(filaments);
  const cam = kit.filmCamera(W, H, { focalMM: 24, near: 0.05, far: 5000 });
  const camH = kit.filmCamera(W, H, { focalMM: 24, near: 0.05, far: 5000 });
  const gasRT = new kit.LowRes(W, H, 0.5);
  // gas composite with an optional 8-tap zoom blur about R (sprint)
  const comp = kit.fullscreen(/* glsl */ `
    uniform sampler2D tex; uniform float uZoom; uniform vec2 uRuv;
    void main(){
      vec3 c = vec3(0.0);
      if (uZoom > 1e-4) {
        for (int k = 0; k < 8; k++) { float s = 1.0 - uZoom * (float(k) + 0.5) / 8.0; c += texture2D(tex, uRuv + (vUv - uRuv) * s).rgb; }
        c /= 8.0;
      } else c = texture2D(tex, vUv).rgb;
      gl_FragColor = vec4(c, 1.0);
    }`, { tex: { value: gasRT.texture }, uZoom: { value: 0 }, uRuv: { value: new THREE.Vector2(734.5 / 1920, 1 - 540.5 / 1080) } },
    { blending: THREE.AdditiveBlending, transparent: true });
  const mats = [dustMat, starMat, ribbonMat, hazeMat, filMat];

  const layer = {
    ignition: I, state: webState, camera: cam,
    render(rr, target, fr, { clear = true } = {}) {
      const ren = rr || renderer;
      const St = webState(fr);
      const t = fr / FPS;
      applyWebPathA(cam, fr);
      for (const m of mats) {
        const u = m.uniforms;
        u.uT.value = t; u.uGain.value = St.gain; u.uSprint.value = St.sprint; u.uCluster.value = St.cluster;
      }
      const su = starMat.uniforms;
      su.uHero.value = St.hero; su.uStarDim.value = St.starDim; su.uGlowS.value = St.glowFWHM / 2.355; su.uGlowA.value = St.glowA;
      filMat.uniforms.uFilA.value = sstep(985, 1010, fr) * (1 - sstep(1190, 1205, fr));
      hazeMat.uniforms.uFpxQ.value = cam.projectionMatrix.elements[5] * gasRT.rt.height * 0.5;
      // shutter poses (180°): fr ± 0.25
      applyWebPathA(camH, fr - 0.25); common.uVPa.value.multiplyMatrices(camH.projectionMatrix, camH.matrixWorldInverse);
      applyWebPathA(camH, fr + 0.25); common.uVPb.value.multiplyMatrices(camH.projectionMatrix, camH.matrixWorldInverse);
      // zoom blur length = half the frame's displacement: s = 1 − 1/(1+m)^(1/2) ≈ m/2
      const m = WEB_PATH_A.rate(fr);
      comp.material.uniforms.uZoom.value = St.sprint * (1 - Math.pow(1 + m, -0.5));
      const ac = ren.autoClear;
      ren.autoClear = false;
      const gasOn = t > 40.0;
      if (gasOn) {
        ren.setRenderTarget(gasRT.rt);
        ren.setClearColor(0x000000, 1); ren.clear(true, true, true);
        ren.render(sceneGas, cam);
      }
      ren.setRenderTarget(target);
      if (clear) { ren.setClearColor(0x000000, 1); ren.clear(true, true, true); }
      if (gasOn) comp.render(ren, target);
      ren.render(scene, cam);
      if (filMat.uniforms.uFilA.value > 0) ren.render(sceneFil, cam);
      ren.autoClear = ac;
      return St;
    },
  };
  SHARED = { ctx, layer };
  return layer;
}
