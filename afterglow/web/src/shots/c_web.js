// c_web — S10 宇宙网 (43.0 → 52.0, f1032–1247) and S11 坍缩 (52.0 → 53.0, f1248–1271).
//
// S10  24 mm, pure uniform dolly along the shared WEB_PATH (9 u/s from the first frame, no roll:
//      _webgraph.js WEB.accel = 0, WEB.rollDeg = 0) through the shared WEB graph (seed 1990) — the
//      identical graph and camera path return in S35 (w_sea) as the sea of words.
//      · lt ≈ 3 s: the hero filament runs bottom-left → top-right (the frame diagonal)
//      · lt = 6 s (49.0): the hero node grazes the right third and whips past the lens
//      · lt = 9 s (52.0): the first star (web.hero.first, S09's star at R) lands exactly on R
//      The S09 ignition law continues (c_web/ignition.js: same nodes, same instants); the ionisation
//      front runs from every lit node along its filaments (PROP s per edge) — fully lit by 47.0.
// S11  the dolly stops: pose = WEB_PATH(9.0) (S10's last frame). f1248–1259 the R star collapses to a
//      needle point (its own clump falls into it, the halo shrinks), the rest of the web dims by 30%;
//      f1260–1271 one point at R, absolutely still. Hard cut → S12 (c_supernova) explodes that point.
//
// Layers (all additive, linear HDR):
//   1. gas   (half resolution, kit.LowRes + kit.compositor): one camera-facing gaussian ribbon per edge
//            (continuous VIOLET filaments), 24 000 soft HAZE sprites (radius 1.5 u, α 0.02; the same
//            sampleWebPoints(…, 11) set as w_sea's gas), and a soft halo per node (∝ mass).
//   2. dust  (full resolution): 640 000 points from sampleWebPoints(web, 640000, 7) — the same sample
//            w_sea uses for its sea — blackbody 5000–12000 K, lognormal brightness × filament weight,
//            1–3 px with a thin-lens circle of confusion for points near the lens.
//            + a clumpy river of 36 000 stars along the hero filament, and two rich Plummer clusters
//            (the hero node, the R star's node) so the knots read as galaxy clusters, not as dots.
//   3. stars (full resolution): one point-spread star per node (core FWHM 2 px, faint wing), brightness
//            ∝ mass; only the brightest carry their own short anamorphic streak (the post streak is
//            off: it would streak every bright knot).
//   Points sweeping fast across the frame (near the lens) fade out by their shutter path length
//   (polish: no warp-speed streaks during the 49.0 graze — "an observation, not a flight").
//   Motion blur (180° shutter) without sub-frame renders: every point is drawn as a capsule along its
//   screen path over the shutter interval (camera poses at both ends → uVPa / uVPb), energy-conserving;
//   two sub-intervals only during the hero-node whip (lt 6.0–7.6) to keep the capsules short.
// Cost (1080p SwiftShader, incl. ≈0.4 s post): ≈ 1.0 s/frame, ≈ 1.9 s during the whip.
import * as THREE from 'three';
import { getWeb, sampleWebPoints, applyWebPose, webPathPose, WEB } from './_webgraph.js';
import { ignition, PROP, T_FIRST } from './c_web/ignition.js';

const T10 = 43.0, T11 = 52.0, FPS = 24;
const T_FULL = 47.0;                              // the web is fully lit (screenplay: 47.0 全亮)
const FPX = 960 / (18 / WEB.focalMM);             // 24 mm focal length in 1080p px (36 mm gauge) = 1280
const N_DUST = 640000, N_GAS = 24000;
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => new THREE.Vector3(srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255));
const PAL = { STAR: hex(0xBFD4FF), HAZE: hex(0x6B5CFF), VIOLET: hex(0x8E7CFF) };

export async function create(ctx) {
  const { renderer, W, H, kit, util, GLSL } = ctx;
  const S = H / 1080;
  const I = ignition();
  const web = I.web;
  const { nodes, edges, E, N, mass, degree } = web;
  const first = web.hero.first;
  const FIRST = new THREE.Vector3(nodes[3 * first], nodes[3 * first + 1], nodes[3 * first + 2]);
  const r = util.rng(55 * 1000 + 10);

  // median-normalised node mass → brightness weight
  const ms = Array.from(mass).sort((a, b) => a - b), mMed = ms[ms.length >> 1];
  const mN = i => mass[i] / mMed;
  // the hero filament (S10 composition: bottom-left → top-right diagonal at lt ≈ 3 s) is a chain of
  // nodes in _webgraph.js; its edges are given extra weight so it reads as THE filament of the frame
  const heroSet = new Set(web.hero.filament);
  const heroEdge = e => heroSet.has(edges[2 * e]) && heroSet.has(edges[2 * e + 1]);
  // The cut S09 → S10 continues one process: at 43.0 only the ~66 point stars that S09 has lit are
  // visible. Everything a lit node grows (its clump, cluster, halo and the ionisation fronts along its
  // filaments) starts after the cut: node times are remapped monotonically from [37, tMax] onto
  // [43, T_FULL − PROP] by a pure quadratic (gateT), so the web lights up from the first star outwards
  // over 43–47 at an even, accelerating pace (lit nodes ≈ 4 · 17 · 72 · 260 · 820 · 2300 · all 4981 at
  // 43.5 … 46.5) — no burst (a linear remap onto 43–44.5 squeezed ranks 65–513 into 0.3 s at 44.3).
  // New stars keep igniting on the law: star sprites keep their true ignition times.
  let tMax = T_FIRST; for (let i = 0; i < N; i++) tMax = Math.max(tMax, I.tIgn[i]);
  const GB = (T_FULL - PROP - T10) / ((tMax - T_FIRST) * (tMax - T_FIRST));
  const gateT = tt => T10 + GB * (tt - T_FIRST) * (tt - T_FIRST);
  const edgeLit = (e, u) => {
    const a = edges[2 * e], b = edges[2 * e + 1];
    return Math.min(gateT(I.tIgn[a]) + PROP * u, gateT(I.tIgn[b]) + PROP * (1 - u));
  };

  // ============================== 2. dust points ==============================================
  const pts = sampleWebPoints(web, N_DUST, 7);
  const nD = pts.count;
  const aD = new Float32Array(nD * 4);         // tLit, lum, temperature, flag (1 = clump of the R star)
  for (let i = 0; i < nD; i++) {
    let tl, w;
    if (pts.kind[i] === 0) {
      const e = pts.edgeOf[i], a = edges[2 * e], b = edges[2 * e + 1];
      tl = edgeLit(e, pts.along[i]);
      w = Math.sqrt(mN(a) * mN(b)) * (heroEdge(e) ? 4.5 : 1);
    } else {
      const n = pts.nodeOf[i];
      tl = gateT(I.tIgn[n]) + 0.05 * r();
      w = mN(n) * 0.8 * (n === web.hero.node ? 1.6 : 1) * Math.exp(0.5 * r.gauss());
    }
    const lum = 0.075 * Math.pow(Math.min(w, 16), 1.25) * Math.exp(0.7 * r.gauss());
    const T = 5000 + 7000 * Math.pow(r(), 0.8);
    // flag 1 = clump of the R star (S11 collapse), 2 = clump of the hero node (49.0 graze fade)
    const flag = pts.kind[i] === 1 && pts.nodeOf[i] === first ? 1 : pts.kind[i] === 1 && pts.nodeOf[i] === web.hero.node ? 2 : 0;
    aD.set([tl, Math.min(lum, 1.6), T, flag], 4 * i);
  }
  // + a dense river of stars along the hero filament (its 18 edges), so it reads as the filament
  const heroEdges = [];
  for (let e = 0; e < E; e++) if (heroEdge(e)) heroEdges.push(e);
  // + two rich clusters (Plummer profile, a = 0.8 u): the hero node and the R star's node
  const CL = [[web.hero.node, 7000, 2], [first, 3500, 1]];
  const N_CL = CL.reduce((s, c) => s + c[1], 0);
  const N_HERO = 36000, nAll = nD + N_HERO + N_CL;
  const dPos = new Float32Array(nAll * 3), dA = new Float32Array(nAll * 4);
  dPos.set(pts.pos, 0); dA.set(aD, 0);
  for (let k = 0; k < N_HERO; k++) {
    const e = heroEdges[k % heroEdges.length], a = edges[2 * e], b = edges[2 * e + 1];
    const u = r(), L = Math.hypot(nodes[3 * b] - nodes[3 * a], nodes[3 * b + 1] - nodes[3 * a + 1], nodes[3 * b + 2] - nodes[3 * a + 2]);
    const sg = (r() < 0.7 ? 0.03 : 0.09) * L;
    for (let j = 0; j < 3; j++) dPos[3 * (nD + k) + j] = nodes[3 * a + j] + (nodes[3 * b + j] - nodes[3 * a + j]) * u + r.gauss() * sg;
    // clumpy along its length (knots of star formation, gaps): smooth deterministic modulation
    const x = (heroEdges.indexOf(e) + u) * 1.7;
    const clump = Math.max(0, 0.45 + 0.55 * Math.sin(x * 2.1 + 0.7) * Math.sin(x * 0.83 + 2.0) + 0.3 * Math.sin(x * 5.3 + 1.1));
    dA.set([edgeLit(e, u), 0.085 * clump * Math.exp(0.6 * r.gauss()), 6000 + 7000 * r(), 0], 4 * (nD + k));
  }
  let o = nD + N_HERO;
  for (const [n, cnt, flag] of CL) for (let k = 0; k < cnt; k++, o++) {
    const rr = Math.min(7, 0.8 / Math.sqrt(Math.pow(Math.max(1e-4, r()), -2 / 3) - 1));
    const d = r.sphere();
    for (let j = 0; j < 3; j++) dPos[3 * o + j] = nodes[3 * n + j] + d[j] * rr;
    dA.set([gateT(I.tIgn[n]) + 0.1 * r(), 0.035 * Math.exp(0.9 * r.gauss()), 6000 + 9000 * r(), flag], 4 * o);
  }
  const gD = new THREE.BufferGeometry();
  gD.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  gD.setAttribute('aD', new THREE.BufferAttribute(dA, 4));
  const common = {
    uT: { value: 0 }, uS: { value: S }, uFpx: { value: FPX * S }, uGain: { value: 1 },
    uCollapse: { value: 0 }, uFirst: { value: FIRST }, uFocus: { value: 24 }, uSub: { value: 1 }, uFadeD: { value: new THREE.Vector2(5, 12) }, uFadeS: { value: new THREE.Vector2(6, 16) }, uFadeH: { value: new THREE.Vector2(5, 12) }, uFadeHS: { value: new THREE.Vector2(8, 18) }, uVPa: { value: new THREE.Matrix4() }, uVPb: { value: new THREE.Matrix4() },
  };
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { ...common, uViolet: { value: PAL.VIOLET } },
    vertexShader: GLSL.common + /* glsl */ `
      attribute vec4 aD;
      uniform float uT, uS, uFpx, uGain, uSub, uCollapse, uFocus; uniform vec3 uFirst, uViolet;
      uniform mat4 uVPa, uVPb; uniform vec2 uFadeD, uFadeH;
      varying vec3 vCol; varying float vI, vSig, vPs; varying vec2 vSeg;
      void main(){
        vec3 p = position;
        float boost = 1.0;
        if (abs(aD.w - 1.0) < 0.5 && uCollapse > 0.0) {
          // S11: the R star's own clump falls into it (r → r (1 − c)²), heating as it falls
          float c = uCollapse, k = (1.0 - c) * (1.0 - c);
          p = uFirst + (p - uFirst) * k;
          boost = (1.0 + 2.5 * c) * (1.0 - smoothstep(0.75, 1.0, c));
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        float e = uT - aD.x;
        // ionisation: 0.3 s rise with a brief over-bright front (the front is visible as it runs)
        float lit = smoothstep(0.0, 0.3, e) * (1.0 + 0.9 * exp(-max(e, 0.0) / 0.3));
        float I = aD.y * lit * boost * uGain * uSub * pow(30.0 / max(d, 9.0), 1.05);
        I *= smoothstep(0.25, 1.4, d) * (1.0 - smoothstep(330.0, 430.0, d));
        // thin-lens CoC (aperture 0.009 u, focus 24 u) on top of a 1.6 px base; energy conserving
        float coc = 0.009 * uFpx / uS * abs(1.0 / max(d, 0.05) - 1.0 / uFocus);
        float size = sqrt(1.6 * 1.6 + coc * coc);
        size = min(size, 28.0);
        I *= (1.6 * 1.6) / (size * size);
        vSig = size / 2.355;
        // motion blur: the sprite is a capsule along the point's screen path over the shutter interval
        vec4 ca = uVPa * vec4(p, 1.0), cb = uVPb * vec4(p, 1.0);
        vec2 seg = (ca.w > 0.05 && cb.w > 0.05) ? (cb.xy / cb.w - ca.xy / ca.w) * vec2(960.0, 540.0) : vec2(0.0);
        float len = length(seg);
        // "an observation, not a flight": a dust point that sweeps more than ~6–16 px over the 180°
        // shutter (≥ 12–32 px/frame; the hero node's cluster 8–20 px — in practice only dust within a
        // few units of the lens during the 49.0 graze) fades out instead of drawing a radial
        // warp-speed streak; the knot slides off the right third and thins out
        vec2 fd = aD.w > 1.5 ? uFadeH : uFadeD;
        I *= 1.0 - smoothstep(fd.x, fd.y, len / uSub);
        // …and what remains is drawn with a very short capsule (≤ 3 px over the shutter, as with a faster
        // shutter): the knot stays a knot of sharp points while it fades — dots, not radial dashes
        float capD = 3.0 * uSub;
        if (len > capD) { seg *= capD / len; len = capD; }
        I *= 6.2832 * vSig * vSig / (6.2832 * vSig * vSig + len * 2.5066 * vSig);
        vSeg = seg;
        vec3 bb = blackbody(aD.z); bb /= max(1e-3, luma(bb));
        vec3 vi = uViolet / luma(uViolet);
        vCol = mix(bb, vi, 0.10);
        vI = I;
        vPs = size * 2.2 + 1.0 + len;
        gl_PointSize = (I > 2e-4 && d > 0.05) ? vPs * uS : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uS; varying vec3 vCol; varying float vI, vSig, vPs; varying vec2 vSeg;
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

  // ============================== 3. node stars ===============================================
  const aS = new Float32Array(N * 4);           // tIgn, amp, temperature, flag (1 = R star, 2 = hero node)
  for (let i = 0; i < N; i++) {
    let amp = 2.2 * Math.pow(Math.min(mN(i), 20), 0.7) * Math.exp(0.35 * r.gauss());
    let flag = 0;
    if (i === first) { amp = 22; flag = 1; }
    if (i === web.hero.node) { amp = Math.max(amp, 12); flag = 2; }
    aS.set([I.tIgn[i], amp, 9000 + 16000 * r(), flag], 4 * i);
  }
  const gS = new THREE.BufferGeometry();
  gS.setAttribute('position', new THREE.BufferAttribute(nodes, 3));
  gS.setAttribute('aS', new THREE.BufferAttribute(aS, 4));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { ...common, uStar: { value: PAL.STAR }, uHaloR: { value: 1 }, uHaloA: { value: 1 }, uRStar: { value: 1 } },
    vertexShader: GLSL.common + /* glsl */ `
      attribute vec4 aS;
      uniform float uT, uS, uGain, uSub, uCollapse, uRStar; uniform vec3 uStar;
      uniform mat4 uVPa, uVPb; uniform vec2 uFadeS, uFadeHS;
      varying vec3 vCol; varying float vI, vStreak, vHalf, vFirst; varying vec2 vSeg;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        float e = (uT - aS.x) * 24.0;                        // frames since ignition (S09 law)
        float u = clamp(e / 6.0, 0.0, 1.0);
        float rise = 1.0 - (1.0 - u) * (1.0 - u);
        float over = 1.0 + 0.10 * sin(3.14159 * clamp((e - 3.0) / 10.0, 0.0, 1.0));
        float on = step(0.0, e);
        vFirst = aS.w > 0.5 && aS.w < 1.5 ? 1.0 : 0.0;
        float g = (vFirst > 0.5 ? uRStar : uGain) * uSub;
        float I = aS.y * mix(0.04, 1.0, rise) * over * on * g * pow(30.0 / max(d, 0.5), 1.15);
        I *= smoothstep(0.4, 2.0, d) * (1.0 - smoothstep(330.0, 430.0, d));
        vI = I;
        vStreak = clamp((I - 5.0) / 20.0, 0.0, 1.0);
        if (vFirst > 0.5) vStreak = max(vStreak, 0.45);     // the needle point keeps a thin streak
        vec3 bb = blackbody(aS.z); bb /= max(1e-3, luma(bb));
        vCol = mix(uStar / luma(uStar), bb, 0.3);
        // sprite radius: where the wing falls under ~0.002 HDR; streaks need ±(40..90) px
        float rad = clamp(4.0 + 6.0 * log2(1.0 + I), 4.0, 40.0);
        rad = max(rad, vStreak > 0.0 ? 40.0 + 50.0 * vStreak : 0.0);
        if (vFirst > 0.5) rad = 96.0;
        // motion blur (as the dust): capsule PSF along the screen path over the shutter interval
        vec4 ca = uVPa * vec4(position, 1.0), cb = uVPb * vec4(position, 1.0);
        vec2 seg = (ca.w > 0.05 && cb.w > 0.05) ? (cb.xy / cb.w - ca.xy / ca.w) * vec2(960.0, 540.0) : vec2(0.0);
        float len = length(seg);
        // node stars whipping past the lens fade (6–16 px over the shutter ≈ 12–32 px/frame; the hero
        // node's star with its cluster, 8–18 px) and their capsule is capped at 12 px (the hero node's
        // star 6 px: a bright knot sliding off the right third, not a dash): never a hyperspace line,
        // no stray bright dashes after the graze
        vec2 fs = aS.w > 1.5 ? uFadeHS : uFadeS;           // the hero node's star fades with its cluster
        vI *= 1.0 - smoothstep(fs.x, fs.y, len / uSub);
        float cap = (aS.w > 1.5 ? 6.0 : 12.0) * uSub;
        if (len > cap) { vI *= cap / len; seg *= cap / len; len = cap; }
        vI *= 4.54 / (4.54 + len * 2.13);                   // core energy 2πσ² vs. capsule (σ 0.85)
        vSeg = seg;
        rad += 0.5 * len;
        vHalf = rad;
        gl_PointSize = (I > 0.01 && d > 0.3) ? 2.0 * rad * uS : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uS, uHaloR, uHaloA, uCollapse;
      varying vec3 vCol; varying float vI, vStreak, vHalf, vFirst; varying vec2 vSeg;
      void main(){
        vec2 q0 = (gl_PointCoord - 0.5) * 2.0 * vHalf;      // 1080p px from the centre
        q0.y = -q0.y;
        vec2 pa = q0 + 0.5 * vSeg;
        float h = clamp(dot(pa, vSeg) / max(dot(vSeg, vSeg), 1e-6), 0.0, 1.0);
        vec2 q = pa - vSeg * h;                             // distance to the path (= q0 when still)
        float r2 = dot(q, q), rr = sqrt(r2);
        float core = exp(-0.5 * r2 / (0.85 * 0.85));
        float wing = 0.012 * exp(-rr / 3.0) + 0.0015 * exp(-rr / 12.0);
        float st = vStreak * 0.012 * exp(-abs(q.x) / (16.0 + 18.0 * vStreak)) * exp(-0.5 * q.y * q.y / 0.8)
                 * (1.0 - smoothstep(0.75, 1.0, abs(q.x) / vHalf));
        float I = core + wing + st;
        // the R star: a bloated stellar glow (radius uHaloR px) that shrinks to a needle in S11
        if (vFirst > 0.5) I += uHaloA * (exp(-0.5 * r2 / (uHaloR * uHaloR)) * 0.05 + 0.012 * exp(-rr / (2.2 * uHaloR)));
        gl_FragColor = vec4(vCol * vI * I, 1.0);
      }`,
  });
  const stars = new THREE.Points(gS, starMat); stars.frustumCulled = false;

  // ============================== 1. gas (half resolution) ====================================
  // 1a. filament ribbons: 4 vertices per edge, camera-facing in view space
  const rbPos = new Float32Array(E * 4 * 3), rbB = new Float32Array(E * 4 * 3), rbC = new Float32Array(E * 4 * 4);
  const rbIdx = new Uint32Array(E * 6);
  for (let e = 0; e < E; e++) {
    const a = edges[2 * e], b = edges[2 * e + 1];
    const L = Math.hypot(nodes[3 * b] - nodes[3 * a], nodes[3 * b + 1] - nodes[3 * a + 1], nodes[3 * b + 2] - nodes[3 * a + 2]);
    const w = Math.sqrt(mN(a) * mN(b)) * (heroEdge(e) ? 3.2 : 1);
    const amp = 0.011 * Math.pow(Math.min(w, 16), 1.25) * Math.exp(0.35 * r.gauss());
    const width = Math.min(1.6, Math.max(0.35, 0.032 * L));            // gaussian σ in units
    for (let k = 0; k < 4; k++) {
      const u = k >> 1, s = (k & 1) * 2 - 1, o = 4 * e + k;
      rbPos.set(nodes.subarray(3 * a, 3 * a + 3), 3 * o);
      rbB.set(nodes.subarray(3 * b, 3 * b + 3), 3 * o);
      // corner: u (0 at a, 1 at b), side ±1, σ, amp ; times packed separately below
      rbC.set([u, s, width, amp], 4 * o);
    }
    rbIdx.set([4 * e, 4 * e + 1, 4 * e + 2, 4 * e + 1, 4 * e + 3, 4 * e + 2], 6 * e);
  }
  const rbT = new Float32Array(E * 4 * 2);
  for (let e = 0; e < E; e++) for (let k = 0; k < 4; k++) rbT.set([I.tIgn[edges[2 * e]], I.tIgn[edges[2 * e + 1]]], 2 * (4 * e + k));
  const gR = new THREE.BufferGeometry();
  gR.setAttribute('position', new THREE.BufferAttribute(rbPos, 3));
  gR.setAttribute('aB', new THREE.BufferAttribute(rbB, 3));
  gR.setAttribute('aC', new THREE.BufferAttribute(rbC, 4));
  gR.setAttribute('aT', new THREE.BufferAttribute(rbT, 2));
  gR.setIndex(new THREE.BufferAttribute(rbIdx, 1));
  const ribbonMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { ...common, uCol: { value: PAL.HAZE.clone().lerp(PAL.VIOLET, 0.5) }, uHot: { value: PAL.STAR.clone().lerp(PAL.VIOLET, 0.35) }, uProp: { value: PROP }, uT10: { value: T10 }, uTFirst: { value: T_FIRST }, uGB: { value: GB } },
    vertexShader: GLSL.common + /* glsl */ `
      attribute vec3 aB; attribute vec4 aC; attribute vec2 aT;
      uniform float uT, uGain, uProp;
      varying float vU, vS, vA, vD, vL; varying vec2 vTimes;
      void main(){
        vec3 A = (modelViewMatrix * vec4(position, 1.0)).xyz;
        vec3 B = (modelViewMatrix * vec4(aB, 1.0)).xyz;
        vec3 P = mix(A, B, aC.x);
        vec3 dir = B - A;
        vec3 side = normalize(cross(dir, P));
        // ribbon half-width: 2.6 σ, widened (and dimmed) where the edge points at the lens
        // (near the lens the ribbon is kept narrow: σ ≤ ~20 px — the dust carries near filaments)
        P += side * aC.y * min(aC.z, 0.016 * max(-P.z, 1.0)) * 2.6;
        gl_Position = projectionMatrix * vec4(P, 1.0);
        vU = aC.x; vS = aC.y; vA = aC.w * uGain; vD = -P.z; vL = length(dir); vTimes = aT;
      }`,
    fragmentShader: GLSL.common + /* glsl */ `
      uniform float uT, uProp, uT10, uTFirst, uGB; uniform vec3 uCol, uHot;
      varying float vU, vS, vA, vD, vL; varying vec2 vTimes;
      void main(){
        float prof = exp(-0.5 * (vS * 2.6) * (vS * 2.6));
        // gated node times (gateT, see create()); the raw times still seed the clump noise below
        vec2 gT = uT10 + uGB * (vTimes - uTFirst) * (vTimes - uTFirst);
        float tl = min(gT.x + uProp * vU, gT.y + uProp * (1.0 - vU));
        float e = uT - tl;
        float lit = smoothstep(0.0, 0.45, e) * (1.0 + 0.6 * exp(-max(e, 0.0) / 0.4));
        float near = smoothstep(12.0, 40.0, vD) * exp(-vD / 170.0) * 1.25;
        // a touch of brightening toward the nodes (matter flows along filaments into the knots)
        float knot = 0.75 + 0.5 * pow(abs(vU - 0.5) * 2.0, 3.0);
        // clumpy gas along the filament: two octaves of smooth 1D value noise (≈ every 2 and 0.8 units)
        float sd = fract((vTimes.x + vTimes.y) * 13.37) * 97.0;
        float x1 = vU * vL / 2.0 + sd, x2 = vU * vL / 0.8 + sd * 1.7;
        float n1 = mix(hash11(floor(x1)), hash11(floor(x1) + 1.0), smoothstep(0.0, 1.0, fract(x1)));
        float n2 = mix(hash11(floor(x2) + 31.0), hash11(floor(x2) + 32.0), smoothstep(0.0, 1.0, fract(x2)));
        knot *= 0.35 + 0.9 * n1 + 0.45 * n2;
        // dense (heavy) filaments glow hotter and whiter, faint ones stay deep violet
        vec3 col = mix(uCol, uHot, smoothstep(0.015, 0.09, vA));
        gl_FragColor = vec4(col * vA * prof * lit * near * knot, 1.0);
      }`,
  });
  const ribbons = new THREE.Mesh(gR, ribbonMat); ribbons.frustumCulled = false;

  // 1b. soft haze sprites (radius 1.5 u, α 0.02, HAZE) + 1c. node halos (radius ∝ clump σ, ∝ mass)
  const gp = sampleWebPoints(web, N_GAS, 11, { clumpShare: 0.12 });
  const nH = gp.count + N;
  const hPos = new Float32Array(nH * 3), hA = new Float32Array(nH * 4);   // tLit, radius (u), amp, kind
  hPos.set(gp.pos, 0);
  for (let i = 0; i < gp.count; i++) {
    const tl = gp.kind[i] === 0 ? edgeLit(gp.edgeOf[i], gp.along[i]) : gateT(I.tIgn[gp.nodeOf[i]]);
    hA.set([tl, 1.5 * (0.7 + 0.6 * r()), 0.02, 0], 4 * i);
  }
  for (let i = 0; i < N; i++) {
    const o = gp.count + i;
    hPos.set(nodes.subarray(3 * i, 3 * i + 3), 3 * o);
    const sig = (0.6 + 0.25 * degree[i]) * 0.9;
    hA.set([gateT(I.tIgn[i]), sig, 0.035 * Math.pow(Math.min(mN(i), 20), 0.85) * (i === first ? 2.5 : i === web.hero.node ? 2 : 1), i === first ? 2 : 1], 4 * o);
  }
  const gH = new THREE.BufferGeometry();
  gH.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
  gH.setAttribute('aH', new THREE.BufferAttribute(hA, 4));
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { ...common, uFpxQ: { value: 1 }, uHaze: { value: PAL.HAZE }, uStar: { value: PAL.STAR }, uRStar: { value: 1 } },
    vertexShader: GLSL.common + /* glsl */ `
      attribute vec4 aH;
      uniform float uT, uGain, uFpxQ, uRStar, uCollapse; uniform vec3 uHaze, uStar;
      varying vec3 vCol; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        float e = uT - aH.x;
        float lit = smoothstep(0.0, 0.5, e);
        float rad = aH.y;
        float g = uGain;
        if (aH.w > 1.5) { rad *= mix(1.0, 0.05, uCollapse); g = uRStar * (1.0 - 0.9 * uCollapse); }
        float px = rad * uFpxQ / max(d, 0.05);               // radius in target px
        float sz = clamp(2.0 * px * 2.2, 1.0, 160.0);
        // keep the integrated light when the sprite clamps
        float a = aH.z * g * lit * min(1.0, pow(2.0 * px * 2.2 / sz, 2.0));
        a *= smoothstep(9.0, 45.0, d) * exp(-d / 170.0) * 1.25;
        vA = a;
        vCol = aH.w > 0.5 ? mix(uHaze, uStar, 0.45) : uHaze;
        gl_PointSize = a > 1e-5 ? sz : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA;
      void main(){
        vec2 q = (gl_PointCoord - 0.5) * 2.0 * 2.2;          // in units of the sprite radius
        float g = exp(-0.5 * dot(q, q) * 2.0);
        gl_FragColor = vec4(vCol * vA * g, 1.0);
      }`,
  });
  const haze = new THREE.Points(gH, hazeMat); haze.frustumCulled = false;

  const sceneGas = new THREE.Scene(); sceneGas.add(ribbons); sceneGas.add(haze);
  const scene = new THREE.Scene(); scene.add(dust); scene.add(stars);
  const cam = kit.filmCamera(W, H, { focalMM: WEB.focalMM, near: 0.05, far: 5000 });
  const camH = kit.filmCamera(W, H, { focalMM: WEB.focalMM, near: 0.05, far: 5000 });   // shutter-interval poses
  const gasRT = new kit.LowRes(W, H, 0.5);
  const comp = kit.compositor();
  comp.material.uniforms.tex.value = gasRT.texture;
  const mats = [dustMat, starMat, ribbonMat, hazeMat];

  return {
    render(shot, f) {
      const t = f.t;
      const s11 = shot.id === 'S11';
      const lt = s11 ? WEB.duration : Math.min(WEB.duration, Math.max(0, t - T10));
      applyWebPose(cam, lt);
      // S11: f1248–1259 collapse (12 frames), then stillness; the rest of the web dims 30%
      const fr = s11 ? (t - T11) * FPS : -1;
      const c = s11 ? util.clamp((fr + 0.5) / 12) : 0;
      const ce = c * c * (3 - 2 * c);
      const gain = 1 - 0.3 * ce;
      for (const m of mats) {
        const u = m.uniforms;
        u.uT.value = t; u.uGain.value = gain; u.uCollapse.value = ce;
        if (u.uRStar) u.uRStar.value = 1;
      }
      // the R star: bloated glow (σ 7 px) → needle point (σ → 0); its core settles to a point of HDR ~8
      const su = starMat.uniforms;
      su.uHaloR.value = 7 * (1 - ce) + 0.6 * ce;
      // (S10: the R star's glow grows in over 43.0–44.5 with its clump, so that on the cut it is the
      // same sharp point as S09's last frame)
      su.uHaloA.value = (1 - ce) * (s11 ? 1 : util.smoothstep(T10, 44.5, t));
      // S10: on the cut the R star (still ~105 u away) carries S09's last brightness (HDR ≈ 9, ×1.7),
      // relaxing to its own over 43–47 as the web lights up around it
      su.uRStar.value = s11 ? util.lerp(1, 0.45, ce) : 1 + 0.7 * (1 - util.smoothstep(T10, 47.0, t));
      hazeMat.uniforms.uRStar.value = 1;
      hazeMat.uniforms.uFpxQ.value = cam.projectionMatrix.elements[5] * gasRT.rt.height * 0.5;

      const ac = renderer.autoClear;
      renderer.autoClear = false;
      // gas at half resolution
      renderer.setRenderTarget(gasRT.rt);
      renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
      renderer.render(sceneGas, cam);
      // composite + points at full resolution into the shot target
      renderer.setRenderTarget(f.target);
      comp.render(renderer, f.target);
      // points: sub-frame accumulation (additive → exact 180° motion blur) during the hero-node whip
      // past the lens (lt 6.0–7.6), where near stars cross >100 px per frame; elsewhere one pass
      // 180° shutter: every point is drawn as a capsule along its path over the (sub-)interval; during
      // the hero-node whip (lt 6.0–7.6) two sub-intervals keep the capsules short (cheaper sprites)
      const sh = s11 ? 0 : 0.5 / FPS;
      const nSub = !s11 && lt > 6.0 && lt < 7.6 ? 2 : 1;
      common.uSub.value = 1 / nSub;
      for (let k = 0; k < nSub; k++) {
        const ta = lt - sh / 2 + sh * k / nSub, tb = ta + sh / nSub, tm = 0.5 * (ta + tb);
        applyWebPose(camH, ta); common.uVPa.value.multiplyMatrices(camH.projectionMatrix, camH.matrixWorldInverse);
        applyWebPose(camH, tb); common.uVPb.value.multiplyMatrices(camH.projectionMatrix, camH.matrixWorldInverse);
        applyWebPose(cam, tm); common.uT.value = t + (tm - lt);
        renderer.render(scene, cam);
      }
      common.uSub.value = 1;
      renderer.autoClear = ac;
    },
    post(shot, f) {
      // own streaks on the brightest stars only; bloom carries the glow of the knots
      return { streak: 0.0, bloom: 0.8, bloomThreshold: 1.0, contrast: 1.08, saturation: 0.8 };
    },
  };
}
