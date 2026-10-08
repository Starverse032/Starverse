// w_stream — S28 离开 (123.0 → 131.0, f2952–3143) and S29 虚空 (131.0 → 136.0, f3144–3263).
//
// S28 · 18 mm. The beam of S27 turns out to be made of words: 「有人吗？」 in the 24 verified languages of
// appendix A (whole shaped phrases from one phraseAtlas — Arabic / Hebrew right-to-left, Devanagari and
// Thai shaped as phrases), flowing away from the night Earth. The camera rides out with the light:
// it recedes radially from the Earth's centre with d(t) = 6000 km·e^{0.49(t−123)} (altitude), at a
// constant orientation, so the Earth sits at a fixed screen point P_E in the lower left and falls
// from a huge night disc (31° radius at 123.0) to a ~40 px disc of city lights at 131.0.
// The stream is built self-similar about the Earth's centre (everything scales with D = 1 + d):
// a phrase at radius r = e^L·D sits on the beam axis (radial at R_geo, Kenya), is offset in the beam's
// cross-section by ρ·s and is uH·s tall (s = r − 1, the beam diverges: "dispersion ∝ s"); phrases
// are log-spaced along the beam (spacing ∝ s) with a density that grows towards the Earth, so the far
// stream condenses into the luminous thread of S27 and only the near words are legible (~120 px at
// the frame edge, ~67 px at R, points far away). The flow is stationary in the camera's frame:
// φ_i(t) = frac(φ0_i + ν t) maps to L through the inverse CDF of that density — far words creep,
// near words sweep past (with an analytic along-the-baseline smear instead of sub-frames).
// The lead phrase 「有人吗？」 (the lane nearest the lens) crosses R at exactly 129.0. 130.0–131.0
// the Moon (baked fbm maria, Lommel–Seeliger shading, lit from the right) sweeps in from the upper
// right. Earth = lib/earth.js (read-only), lights fully on, a thin sunlit crescent on its far limb.
//
// S29 · 35 mm, reverse angle: looking down the beam, the axis vanishing point is R. The camera rode
// with the front (relative velocity 0 at 131.0) and brakes to a stop at 133.0 (easeOutCubic); the
// words keep going, disperse (speed ∝ distance^0.5 → spacing ∝ s^1.5), dim with 1/d² (capped) and go
// out one by one; under 3 px they cross-fade to point sprites. At 132 only a few remain. The last
// 「？」 (an independent instance) drifts onto the axis and reaches R at 133.0, recedes, and fades
// 133.0–134.5 (easeInSine). Then black: a few very faint distant stars, no Milky Way.
import * as THREE from 'three';
import { createEarth } from '../lib/earth.js';
import { phraseAtlas } from '../lib/textatlas.js';
import { QUESTIONS, FONT_FOR, RTL } from '../data/voices.js';

const T28 = 123.0, T29 = 131.0, T_R = 129.0;
const RX = 734.5, RY = 540.5;                       // R as a pixel centre (1080p)
const KM = 1 / 6371;                                // world unit = one Earth radius
const alt = t => 6000 * KM * Math.exp(0.49 * (t - T28));   // d(t), in Earth radii
const F18 = 960 * 18 / 18, F35 = 960 * 35 / 18;     // 1080p focal length in px (36 mm gauge)
const P_E = [205, 850];                             // the Earth's (fixed) screen position in S28
const THETA = 14 * Math.PI / 180;                   // beam axis vs. the camera→Earth line
const R_GEO = [36.8, -1.3];

// appendix A, group 1 — in this order, every cycle starting from Chinese
const ORDER = ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'uk', 'pl', 'el', 'tr', 'ar', 'he', 'hi', 'th', 'vi', 'id', 'sw', 'nl', 'sv', 'la'];
const FONT_OVERRIDE = { el: '"Noto Serif Display VF"' };   // Cormorant Garamond has no Greek

const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = h => [s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255)];
const AMBER = hexLin(0xFFB36B);

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = r => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(6.2831853 * r());
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// fonts: load, then assert the family really is used (compare widths against two generic fallbacks)
async function assertFonts(list) {
  const c = document.createElement('canvas').getContext('2d');
  for (const [spec, sample] of list) {
    try { await document.fonts.load(spec, sample); } catch (e) { /* system font */ }
    if (!document.fonts.check(spec, sample)) throw new Error(`w_stream: font check failed: ${spec}`);
    const fam = spec.replace(/^\d+\s+\d+px\s+/, '');
    if (!fam.includes(',')) {
      c.font = `${spec}, monospace`; const a = c.measureText(sample).width;
      c.font = `${spec}, serif`; const b = c.measureText(sample).width;
      if (Math.abs(a - b) > 0.01) throw new Error(`w_stream: font missing (falls back): ${spec} for "${sample}"`);
    }
  }
}

// screen direction (camera space, looking down −z) of a 1080p pixel for focal length F
const dirOf = (px, py, F) => new THREE.Vector3((px - 960) / F, -(py - 540) / F, -1).normalize();
const project = (p, F) => [960 + F * p.x / -p.z, 540 - F * p.y / -p.z];

export async function create(ctx) {
  const { renderer, W, H, kit } = ctx;

  // ---- the phrases -----------------------------------------------------------------------------------
  const items = ORDER.map(lang => {
    const q = lang === 'en' ? QUESTIONS.find(v => v.t === 'Is anyone there?') : QUESTIONS.find(v => v.lang === lang);
    if (!q) throw new Error(`w_stream: no question for ${lang}`);
    return { text: q.t, lang, font: FONT_OVERRIDE[lang] || FONT_FOR(lang), rtl: RTL.has(lang), weight: 600 };
  });
  const PH = 144;
  // (the sample is the phrase's letters only: punctuation may legitimately come from a fallback face)
  await assertFonts(items.map(it => [`${it.weight} ${Math.round(PH * 0.62)}px ${it.font}`, it.text.replace(/[\s?？;¿’'.,!-]/g, '')]).concat([['600 200px "Noto Serif CJK SC"', '？']]));
  const atlas = phraseAtlas(items, { height: PH, size: 4096, pad: 12, weight: 600 });
  if (atlas.rects.length !== items.length) throw new Error('w_stream: phrase atlas overflow');
  atlas.texture.anisotropy = 16;

  // the last 「？」: its own texture, ink centred exactly (fullwidth ？ sits off-centre in its em box)
  const qTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = '600 200px "Noto Serif CJK SC"'; g.textBaseline = 'alphabetic';
    const m = g.measureText('？');
    const iw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, ih = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    g.fillText('？', 128 - iw / 2 + m.actualBoundingBoxLeft, 128 - ih / 2 + m.actualBoundingBoxAscent);
    const t = new THREE.CanvasTexture(c); t.flipY = false; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
    return { tex: t, aspect: 1 };
  })();

  // =====================================================================================================
  // S28 geometry (camera space; the camera sits at the origin with a constant orientation)
  // =====================================================================================================
  const eHat = dirOf(P_E[0], P_E[1], F18);                       // camera → Earth centre
  const rHat = dirOf(RX, RY, F18);
  const mHat = rHat.clone().addScaledVector(eHat, -rHat.dot(eHat)).normalize();
  const B = eHat.clone().multiplyScalar(-Math.cos(THETA)).addScaledVector(mHat, Math.sin(THETA)).normalize();   // radial beam direction
  const P1 = new THREE.Vector3().crossVectors(B, new THREE.Vector3(0, 0, 1)).normalize();
  const P2 = new THREE.Vector3().crossVectors(B, P1).normalize();
  const Dof = t => 1 + alt(t);
  const Eof = t => eHat.clone().multiplyScalar(Dof(t));

  // stream parameters
  const RHO = 0.10, UH = 0.03, TAU = 1.3;
  // density along the beam (per e-fold of r), counted back from the stream's upper end v = LMAX − L:
  // e^{A1 v} near the camera (sparse, legible), then e^{A2 v} towards the Earth (the thread)
  const A1 = 2.4, A2 = 1.1, VK = 0.9, N_NEAR = 20;
  const XR = 0.8, OFF_EXP = 0.7, SIZE_EXP = 0.35;            // far-field shaping (factor 1 near R)
  const N_TH = 2600, S_TH = 0.75;                             // the thread: N_TH words within 0.6 R⊕ of the root
  const LMIN = Math.log(1 / Dof(131.2));
  // the lead lane: offset in the plane (camera, beam axis), towards the lens
  const leadOffAt = () => {
    // perpendicular to B, pointing from the axis towards the camera, evaluated around R at 129
    const c = Eof(T_R).addScaledVector(B, 0.7 * Dof(T_R));
    const v = c.clone().negate(); v.addScaledVector(B, -v.dot(B)); return v.normalize();
  };
  const LEAD_OFF = leadOffAt(), LEAD_K = 1.45;
  const posJS = (L, t, lead) => {
    const D = Dof(t), r = Math.exp(L) * D, s = Math.max(r - 1, 0);
    const p = Eof(t).addScaledVector(B, r);
    if (lead) p.addScaledVector(LEAD_OFF, RHO * LEAD_K * s * Math.pow(Math.exp(L) / XR, OFF_EXP));
    return p;
  };
  // screen line of the beam: through R, along the projection of the axis
  const lineDir = (() => { const a = project(posJS(-0.5, T_R, false), F18), b = project(posJS(-0.2, T_R, false), F18); const d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(d[0], d[1]); return [d[0] / l, d[1] / l]; })();
  const along = p => { const q = project(p, F18); return (q[0] - RX) * lineDir[0] + (q[1] - RY) * lineDir[1]; };
  // L of the lead phrase's centre at R (129.0): bisection
  let lo = -2.5, hi = 0.0;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (along(posJS(m, T_R, true)) < 0) lo = m; else hi = m; }
  const L_R = (lo + hi) / 2;
  // L where the axis leaves the frame (top edge) → the stream's upper end lies well beyond it
  lo = L_R; hi = 1.0;
  const inFrame = p => { if (p.z > -1e-3) return false; const q = project(p, F18); return q[1] > 60 && q[0] < 2000; };
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (inFrame(posJS(m, T_R, false))) lo = m; else hi = m; }
  const L_EXIT = (lo + hi) / 2, LMAX = L_EXIT + 0.35, DELTA = LMAX - LMIN;
  const EK = Math.exp(A1 * VK), CK = (EK - 1) / A1;
  const Cv = v => (v < VK ? (Math.exp(A1 * v) - 1) / A1 : CK + EK * (Math.exp(A2 * (v - VK)) - 1) / A2);
  const CTOT = Cv(DELTA);
  const N = Math.round(N_NEAR * CTOT);                       // N_NEAR phrases per e-fold at the upper end
  const cdf = L => 1 - Cv(LMAX - L) / CTOT;                 // φ ∈ [0,1): 0 at the root end, 1 at the upper end
  const Lof = phi => { const c = (1 - phi) * CTOT; return LMAX - (c < CK ? Math.log(1 + c * A1) / A1 : VK + Math.log(1 + (c - CK) * A2 / EK) / A2); };
  // near-camera log speed ≈ 0.3 e-fold/s (dL/dφ = CTOT / n(0) at the upper end, n(0) = 1)
  const NU = 0.30 / CTOT;
  const PHI_R = cdf(L_R);
  const lerp = (a, b, u) => a + (b - a) * u;

  // ---- instanced attributes ------------------------------------------------------------------------
  // Slots along the stream: k = 0 is the lead (Chinese), k > 0 follow it, k < 0 went ahead of it.
  // The languages cycle in ORDER from the lead backwards (zh, en, ja, …), every round starting with
  // Chinese. Ahead of the lead's round there is a short gap (≈ 0.45 e-fold at R), so that at 129.0
  // the lead heads the stream near the camera: nothing nearer, nothing ahead of it on screen.
  const R1 = rng(55 * 1000 + 28);
  const GAP = Math.ceil((cdf(L_R + 0.45) - PHI_R) * N);
  const slots = [];
  for (let k = Math.ceil((PHI_R - 1) * N) + 1; k <= Math.floor(PHI_R * N); k++) if (k === 0 || k > 0 || k < -GAP) slots.push(k);
  const NI = slots.length + N_TH;
  const aRect = new Float32Array(NI * 4), aAsp = new Float32Array(NI), aPhi0 = new Float32Array(NI);
  const aOff = new Float32Array(NI * 2), aSeed = new Float32Array(NI), aLead = new Float32Array(NI);
  slots.forEach((k, i) => {
    const lead = k === 0;
    const rc = atlas.rects[((k % ORDER.length) + ORDER.length) % ORDER.length];
    aRect.set([rc[0], rc[1], rc[2], rc[3]], i * 4); aAsp[i] = rc[4];
    aPhi0[i] = lead ? PHI_R : PHI_R - (k + (k > 0 ? 5 : 0) + 0.35 * (R1() - 0.5)) / N;   // a little room behind the lead too
    aOff[i * 2] = gauss(R1) * 0.5; aOff[i * 2 + 1] = gauss(R1) * 0.5;
    aSeed[i] = R1(); aLead[i] = lead ? 1 : 0;
  });
  for (let j = 0; j < N_TH; j++) {
    const i = slots.length + j, rc = atlas.rects[j % ORDER.length];
    aRect.set([rc[0], rc[1], rc[2], rc[3]], i * 4); aAsp[i] = rc[4];
    aPhi0[i] = (j + R1()) / N_TH; aOff[i * 2] = gauss(R1) * 0.5; aOff[i * 2 + 1] = gauss(R1) * 0.5; aSeed[i] = R1(); aLead[i] = 2;
  }
  const inst = {
    aRect: new THREE.InstancedBufferAttribute(aRect, 4), aAsp: new THREE.InstancedBufferAttribute(aAsp, 1),
    aPhi0: new THREE.InstancedBufferAttribute(aPhi0, 1), aOff: new THREE.InstancedBufferAttribute(aOff, 2),
    aSeed: new THREE.InstancedBufferAttribute(aSeed, 1), aLead: new THREE.InstancedBufferAttribute(aLead, 1),
  };
  const quadGeo = new THREE.InstancedBufferGeometry();
  quadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3));
  quadGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const ptGeo = new THREE.InstancedBufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
  for (const g of [quadGeo, ptGeo]) { for (const [k, a] of Object.entries(inst)) g.setAttribute(k, a); g.instanceCount = NI; }

  const U = {
    uAtlas: { value: atlas.texture }, uE: { value: new THREE.Vector3() }, uEp: { value: new THREE.Vector3() },
    uD: { value: 1 }, uDp: { value: 1 }, uPhiT: { value: 0 }, uPhiTp: { value: 0 }, uLeadPhi: { value: 0 }, uLeadPhiP: { value: 0 },
    uB: { value: B }, uP1: { value: P1 }, uP2: { value: P2 }, uLeadOff: { value: LEAD_OFF.clone().multiplyScalar(LEAD_K) },
    uLmax: { value: LMAX }, uCtot: { value: CTOT }, uCk: { value: CK }, uEk: { value: EK }, uRho: { value: RHO }, uUH: { value: UH }, uTau: { value: TAU },
    uFy: { value: 1 }, uPx: { value: H / 1080 }, uCol: { value: new THREE.Vector3(...AMBER) }, uGain: { value: 1.5 }, uDot: { value: 0.3 },
    uThT: { value: 0 }, uThTp: { value: 0 }, uSth: { value: S_TH }, uThGain: { value: 1 },
    uLeadNdc: { value: new THREE.Vector2(9, 9) }, uFocus: { value: 0 }, uAspect: { value: W / H },
  };
  const VS_COMMON = /* glsl */ `
    attribute vec4 aRect; attribute float aAsp, aPhi0, aSeed, aLead; attribute vec2 aOff;
    uniform vec3 uE, uEp, uB, uP1, uP2, uLeadOff; uniform float uD, uDp, uPhiT, uPhiTp, uLeadPhi, uLeadPhiP;
    uniform vec2 uLeadNdc; uniform float uFocus, uAspect;
    uniform float uLmax, uCtot, uCk, uEk, uRho, uUH, uTau, uFy, uPx, uThT, uThTp, uSth, uThGain;
    float Lof(float phi){ float c = (1.0 - phi) * uCtot;
      return uLmax - (c < uCk ? log(1.0 + c * ${A1.toFixed(4)}) / ${A1.toFixed(4)} : ${VK.toFixed(4)} + log(1.0 + (c - uCk) * ${A2.toFixed(4)} / uEk) / ${A2.toFixed(4)}); }
    // aLead: 0 = river, 1 = the lead phrase, 2 = the thread near the root (absolute scale)
    float Lthread(float u, float D){ return log((1.0 + uSth * pow(u, 1.25)) / D); }
    vec3 posAt(float L, vec3 E, float D, out float s){
      float r = exp(L) * D; s = max(r - 1.0, 0.0);
      // the cross-section widens faster than s far out (divergence grows), so the far stream is a thread
      float k = pow(exp(L) / ${XR.toFixed(4)}, ${OFF_EXP.toFixed(2)});
      vec3 off;
      if (aLead > 0.5 && aLead < 1.5) off = uLeadOff * uRho;
      else { float a = uTau * L + aSeed * 6.2831853; vec2 o = vec2(cos(a) * aOff.x - sin(a) * aOff.y, sin(a) * aOff.x + cos(a) * aOff.y);
             off = (uP1 * o.x + uP2 * o.y) * uRho * (aLead > 1.5 ? 0.5 : 1.0); }
      return E + uB * r + off * s * k;
    }
    // shared per-instance evaluation: centre now/prev, height, 1080p pixel height, visibility
    vec3 C, Cp; float hW, hPx, vis, sNow;
    void evalInst(){
      float L, Lp;
      vis = 1.0;
      if (aLead > 1.5) {
        float u = fract(aPhi0 + uThT), up = fract(aPhi0 + uThTp); if (up > u) up = u;
        L = Lthread(u, uD); Lp = Lthread(up, uDp);
        vis = uThGain * smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.7, 1.0, u));
      } else {
        float phi = aLead > 0.5 ? uLeadPhi : fract(aPhi0 + uPhiT);
        float phiP = aLead > 0.5 ? uLeadPhiP : fract(aPhi0 + uPhiTp);
        if (phiP > phi) phiP = phi;                                 // wrapped this frame
        L = Lof(min(phi, 0.99999)); Lp = Lof(min(phiP, 0.99999));
        if (aLead > 0.5) vis = 1.6 * step(phi, 0.9999);
      }
      float sp; C = posAt(L, uE, uD, sNow); Cp = posAt(Lp, uEp, uDp, sp);
      hW = uUH * max(sNow, 0.01) * pow(exp(L) / ${XR.toFixed(4)}, ${SIZE_EXP.toFixed(2)});
      hPx = hW * uFy / max(-C.z, 1e-4) / uPx;                       // 1080p px
      vis *= smoothstep(0.0, 0.05, sNow);
      vis *= 0.8 + 0.4 * fract(aSeed * 13.7);                       // a little life in the brightness
      // around 129 the eye is given to the lead: its neighbours on screen step back (dimmer)
      if (aLead < 0.5 && uFocus > 0.0) {
        vec4 cc = projectionMatrix * vec4(C, 1.0);
        vec2 d = (cc.xy / cc.w - uLeadNdc) * vec2(uAspect, 1.0) * 540.0;   // ≈ 1080p px
        vis *= 1.0 - 0.7 * uFocus * (1.0 - smoothstep(90.0, 260.0, length(d)));
      }
    }`;
  const quadMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    vertexShader: VS_COMMON + /* glsl */ `
      varying vec2 vL; varying float vTrail, vTaps, vI; varying vec4 vRect;
      void main(){
        evalInst();
        float w = hW * aAsp;
        // camera-facing card, its baseline along the beam's direction on screen (B projected ⊥ V):
        // always readable, never seen edge-on
        vec3 V = normalize(-C);
        vec3 X = normalize(uB - V * dot(uB, V));
        vec3 Y = normalize(cross(V, X));
        float ds = max(dot(C - Cp, X), 0.0);                        // smear along the baseline (motion ∥ beam)
        float trail = ds / w;
        float lx = mix(-trail, 1.0, position.x);
        vec3 p = C + X * (lx - 0.5) * w + Y * (position.y - 0.5) * hW;
        gl_Position = projectionMatrix * vec4(p, 1.0);
        float q = smoothstep(2.2, 3.6, hPx);                        // < 3 px: hand over to the point sprite
        vL = vec2(lx, position.y); vTrail = trail; vRect = aRect;
        vTaps = clamp(ceil(trail * hPx * aAsp / 1.2), 1.0, 40.0);
        vI = vis * q / (1.0 + trail);
        if (q <= 0.0 || vis <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; uniform vec3 uCol; uniform float uGain;
      varying vec2 vL; varying float vTrail, vTaps, vI; varying vec4 vRect;
      void main(){
        float a = 0.0;
        float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));   // IGN dither
        // gradients taken once, outside the (divergent) loop, so the mip level stays right
        vec2 uv0 = vec2(mix(vRect.x, vRect.z, vL.x), mix(vRect.w, vRect.y, vL.y));
        vec2 gx = dFdx(uv0), gy = dFdy(uv0);
        float du = vRect.z - vRect.x;
        for (int k = 0; k < 40; k++) {
          if (float(k) >= vTaps) break;
          float o = vTrail * (float(k) + j) / vTaps, x = vL.x + o;
          float inside = step(0.0, x) * step(x, 1.0);
          a += inside * textureGrad(uAtlas, uv0 + vec2(o * du, 0.0), gx, gy).a;
        }
        a /= vTaps;
        a *= (1.0 + vTrail);                                        // energy is spread, not lost
        gl_FragColor = vec4(uCol * uGain * vI * a, 1.0);
      }`,
  });
  const ptMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    vertexShader: VS_COMMON + /* glsl */ `
      varying float vI;
      void main(){
        evalInst();
        gl_Position = projectionMatrix * vec4(C, 1.0);
        float q = smoothstep(2.2, 3.6, hPx);
        // energy-conserving: a phrase of hPx × (hPx·asp) px with ~20 % ink coverage, spread over the sprite
        float energy = hPx * hPx * aAsp * 0.2;
        float ps = 2.6;
        gl_PointSize = ps * uPx;
        vI = vis * (1.0 - q) * energy / (ps * ps * 0.32);
        if (vI <= 1e-5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform float uGain, uDot; varying float vI;
      void main(){ vec2 d = gl_PointCoord - 0.5; float g = exp(-dot(d, d) * 14.0);
        gl_FragColor = vec4(uCol * uGain * uDot * vI * g, 1.0); }`,
  });
  const quads = new THREE.Mesh(quadGeo, quadMat); quads.frustumCulled = false; quads.renderOrder = 10;
  const points = new THREE.Points(ptGeo, ptMat); points.frustumCulled = false; points.renderOrder = 9;

  // ---- Earth -----------------------------------------------------------------------------------------
  const earth = await createEarth(ctx, { radius: 1 });
  {
    // orient the globe: R_geo → B (the beam is radial there); local north → screen up-right
    const g = earth.lonLatToLocal(R_GEO[0], R_GEO[1], 1).normalize();
    const lo = R_GEO[0] * Math.PI / 180, la = R_GEO[1] * Math.PI / 180;
    const nl = new THREE.Vector3(-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo)).normalize();
    const want = new THREE.Vector3(0.55, 0.83, 0.0); want.addScaledVector(B, -want.dot(B)).normalize();
    const mL = new THREE.Matrix4().makeBasis(g, nl, new THREE.Vector3().crossVectors(g, nl));
    const mW = new THREE.Matrix4().makeBasis(B, want, new THREE.Vector3().crossVectors(B, want));
    earth.group.quaternion.setFromRotationMatrix(mW.multiply(mL.transpose()));
  }
  // the sun: behind the planet and to the upper right → a thin crescent on the far limb, Moon lit from the right
  const upRight = new THREE.Vector3(0.8, 0.6, 0); upRight.addScaledVector(eHat, -upRight.dot(eHat)).normalize();
  const SUN = eHat.clone().multiplyScalar(Math.cos(0.55)).addScaledVector(upRight, Math.sin(0.55)).normalize();
  earth.setSun(SUN);
  earth.uniforms.lights.value = 1.15;

  // ---- Moon ------------------------------------------------------------------------------------------
  const moonTex = kit.bake(renderer, {
    w: 1024, h: 512, wrap: THREE.RepeatWrapping,
    frag: /* glsl */ `
      vec3 dirOf(vec2 uv){ float lon = (uv.x - 0.5) * TAU, lat = (uv.y - 0.5) * PI; return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); }
      void main(){
        vec3 d = dirOf(vUv);
        float m = fbm(d * 1.6 + 4.0, 5);
        float maria = smoothstep(0.50, 0.60, m + 0.12 * (fbm(d * 5.0, 4) - 0.5));
        float hi = fbm(d * 9.0 + 2.0, 5);
        // craters: worley-ish pits with bright rims at a few scales
        float cr = 0.0;
        for (int k = 0; k < 3; k++) { float sc = 6.0 * pow(2.3, float(k)); vec3 q = d * sc; vec3 c = floor(q);
          vec3 f = fract(q) - 0.5; vec3 o = vec3(hash13(c), hash13(c + 7.1), hash13(c + 3.3)) - 0.5;
          float r = length(f - o * 0.6) / (0.18 + 0.2 * hash13(c + 1.7));
          cr += (smoothstep(1.0, 0.85, r) * -0.35 + smoothstep(0.85, 1.0, r) * smoothstep(1.25, 1.0, r) * 0.5) * step(0.55, hash13(c + 9.0)) * (0.6 / (1.0 + float(k))); }
        float a = mix(0.13, 0.065, maria) * (0.85 + 0.3 * hi) * (1.0 + cr);
        gl_FragColor = vec4(vec3(a) * vec3(1.0, 0.97, 0.93), 1.0);
      }`,
  });
  const MOON_R = 1737 / 6371;
  const moonMat = new THREE.ShaderMaterial({
    // (the Moon gets its own light from the right — "右侧日照" — a half-lit disc reads at 40–60 px, the
    //  physically consistent hairline crescent would not; at this scale nobody can triangulate the sun)
    uniforms: { tex: { value: moonTex }, sun: { value: new THREE.Vector3(0.62, 0.25, 0.74).normalize() }, uW: { value: 1 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vP; varying vec3 vO;
      void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `uniform sampler2D tex; uniform vec3 sun; uniform float uW; varying vec3 vN; varying vec3 vP; varying vec3 vO;
      void main(){
        vec3 n = normalize(vN), v = normalize(cameraPosition - vP);
        vec2 uv = vec2(atan(vO.x, vO.z) / 6.2831853 + 0.5, asin(clamp(vO.y, -1.0, 1.0)) / 3.14159265 + 0.5);
        float alb = texture2D(tex, uv).r;
        float mu0 = max(dot(n, sun), 0.0), mu = max(dot(n, v), 0.0);
        float ls = mu0 / (mu0 + mu + 1e-4);                     // Lommel–Seeliger: the flat, dusty Moon
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.94) * alb * ls * 9.0 * uW, 1.0);
      }`,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 96, 48), moonMat);
  // place it so that at 130.5 it is at the upper right, ~10 R⊕ from the camera (→ ~50 px across)
  // The camera recedes from the Earth at ~20 R⊕/s by now, so anything fixed streams towards P_E and
  // shrinks fast: the Moon swoops in from the right edge (~130.1), is ~57 px at 130.5 and ~28 px at
  // 131.0, below the stream. It is drawn several times across the shutter (cheap: it is small).
  const T_M = 130.5;
  const M_EARTH = dirOf(1610, 470, F18).multiplyScalar(12).addScaledVector(eHat, -Dof(T_M));   // Earth-centred position (camera axes)

  const scene28 = new THREE.Scene();
  // the beam's core: the integrated light of words too far and too small to resolve — a faint warm
  // thread along the axis, strongest at the root, gone by the time the words become legible
  const CORE_SEG = 160;
  const coreGeo = new THREE.BufferGeometry();
  { const a = new Float32Array((CORE_SEG + 1) * 2 * 3); for (let i = 0; i <= CORE_SEG; i++) for (let j = 0; j < 2; j++) a.set([i / CORE_SEG, j * 2 - 1, 0], (i * 2 + j) * 3);
    const idx = []; for (let i = 0; i < CORE_SEG; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    coreGeo.setAttribute('position', new THREE.BufferAttribute(a, 3)); coreGeo.setIndex(idx); }
  const coreU = { uE: U.uE, uD: U.uD, uB: U.uB, uFy: U.uFy, uPx: U.uPx, uCol: U.uCol, uLo: { value: 0 }, uHi: { value: L_R }, uRho: U.uRho, uI: { value: 0.5 } };
  const core = new THREE.Mesh(coreGeo, new THREE.ShaderMaterial({
    uniforms: coreU, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform vec3 uE, uB; uniform float uD, uFy, uPx, uLo, uHi, uRho; varying float vAcross, vI;
      void main(){
        float L = mix(uLo, uHi, position.x);
        float r = exp(L) * uD, s = max(r - 1.0, 0.0);
        vec3 c = uE + uB * r;
        vec3 side = normalize(cross(normalize(-c), uB));
        float pxPerUnit = uFy / max(-c.z, 1e-4) / uPx;
        float halfW = max(uRho * 0.35 * s, 2.2 / pxPerUnit);          // ≥ 2.2 px, else the cross-section
        gl_Position = projectionMatrix * vec4(c + side * position.y * halfW * 2.5, 1.0);
        vAcross = position.y * 2.5;
        // flux conservation across the widening: brightness ∝ 1/width (px), fading out along the beam
        vI = min(1.0, 2.2 / (halfW * pxPerUnit)) * (1.0 - smoothstep(0.0, 1.0, position.x)) * smoothstep(0.0, 0.02, s);
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uI; varying float vAcross, vI;
      void main(){ gl_FragColor = vec4(uCol * uI * vI * exp(-vAcross * vAcross * 0.5), 1.0); }`,
  }));
  core.frustumCulled = false; core.renderOrder = 8;
  scene28.add(earth.group, core, points, quads);
  const moonScene = new THREE.Scene(); moonScene.add(moon);
  const cam18 = kit.filmCamera(W, H, { focalMM: 18, near: 0.01, far: 1000 });
  cam18.position.set(0, 0, 0); cam18.quaternion.identity(); cam18.updateMatrixWorld();

  // stars at infinity (separate scene so the planet's near/far planes do not matter)
  const stars28 = kit.starfield({ count: 2600, seed: 2828, radius: 5e4, H, sizeScale: 0.8, brightness: 0.55, warm: 0.12 });
  const stars29 = kit.starfield({ count: 380, seed: 2929, radius: 5e4, H, sizeScale: 0.65, brightness: 0.16, warm: 0.1 });
  const starScene28 = new THREE.Scene(); starScene28.add(stars28);
  const starScene29 = new THREE.Scene(); starScene29.add(stars29);
  const starCam18 = kit.filmCamera(W, H, { focalMM: 18, near: 1, far: 1e5 });
  const starCam35 = kit.filmCamera(W, H, { focalMM: 35, near: 1, far: 1e5 });

  // =====================================================================================================
  // S29 — looking down the beam: words recede towards R
  // =====================================================================================================
  const N2 = 150;
  const AX = dirOf(RX, RY, F35);
  const Q1 = new THREE.Vector3().crossVectors(AX, new THREE.Vector3(0, 1, 0)).normalize();
  const Q2 = new THREE.Vector3().crossVectors(Q1, AX).normalize();
  const R2 = rng(55 * 1000 + 29);
  const bRect = new Float32Array(N2 * 4), bAsp = new Float32Array(N2), bZ0 = new Float32Array(N2), bLat = new Float32Array(N2 * 2), bSeed = new Float32Array(N2), bDie = new Float32Array(N2);
  const placed = [[905 - 45, 650 - 45, 905 + 45, 650 + 45]];   // keep the last 「？」's start clear
  for (let i = 0; i < N2; i++) {
    const k = i % ORDER.length, rc = atlas.rects[k];
    bRect.set([rc[0], rc[1], rc[2], rc[3]], i * 4); bAsp[i] = rc[4];
    const u = (i + R2()) / N2;
    const z0 = 1.6 * Math.pow(38, Math.pow(u, 0.7));
    bZ0[i] = z0;
    // a beam of finite width (slowly diverging), not a cone: as the words recede they converge on the
    // axis — the vanishing point is R. Legible (near) words are placed so that they do not overlap on
    // screen at 131.0 (deterministic rejection sampling; the far ones may pile up into the thread's end).
    const wz = 0.42 + 0.012 * z0;                 // beam radius (world): ~0.25 rad near, ~0.02 rad far
    for (let tries = 0; ; tries++) {
      const rad = Math.sqrt(0.08 + 0.92 * R2()), ang = R2() * 6.2831853;     // uniform over the cross-section
      const lx = Math.cos(ang) * rad * wz * 1.9, ly = Math.sin(ang) * rad * wz * 0.8;
      const c = AX.clone().multiplyScalar(z0).addScaledVector(Q1, lx).addScaledVector(Q2, ly);
      const [sx, sy] = project(c, F35), h = 0.062 * F35 / -c.z, w = h * rc[4];
      const box = [sx - w / 2 - 8, sy - h / 2 - 5, sx + w / 2 + 8, sy + h / 2 + 5];
      const hit = h > 9 && placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
      if (!hit || tries > 40) { if (h > 9) placed.push(box); bLat[i * 2] = lx; bLat[i * 2 + 1] = ly; break; }
    }
    bSeed[i] = R2();
    // words go out one by one: most are gone by 132, a few linger into 133
    bDie[i] = 131.25 + 1.5 * Math.pow(R2(), 1.6);
  }
  const geo29 = new THREE.InstancedBufferGeometry();
  geo29.setAttribute('position', quadGeo.getAttribute('position')); geo29.setIndex(quadGeo.getIndex());
  const pt29 = new THREE.InstancedBufferGeometry(); pt29.setAttribute('position', ptGeo.getAttribute('position'));
  const inst2 = { aRect: new THREE.InstancedBufferAttribute(bRect, 4), aAsp: new THREE.InstancedBufferAttribute(bAsp, 1), aZ0: new THREE.InstancedBufferAttribute(bZ0, 1),
    aLat: new THREE.InstancedBufferAttribute(bLat, 2), aSeed: new THREE.InstancedBufferAttribute(bSeed, 1), aDie: new THREE.InstancedBufferAttribute(bDie, 1) };
  for (const g of [geo29, pt29]) { for (const [k, a] of Object.entries(inst2)) g.setAttribute(k, a); g.instanceCount = N2; }
  const U2 = {
    uAtlas: { value: atlas.texture }, uAx: { value: AX }, uQ1: { value: Q1 }, uQ2: { value: Q2 }, uTau: { value: 0 }, uT: { value: 0 },
    uHW: { value: 0.062 }, uFy: { value: 1 }, uPx: { value: H / 1080 }, uCol: { value: new THREE.Vector3(...AMBER) }, uGain: { value: 1.5 }, uDim: { value: 1 },
  };
  const VS29 = /* glsl */ `
    attribute vec4 aRect; attribute float aAsp, aZ0, aSeed, aDie; attribute vec2 aLat;
    uniform vec3 uAx, uQ1, uQ2; uniform float uTau, uT, uHW, uFy, uPx, uDim;
    vec3 C; float hPx, vis;
    void evalInst(){
      float z = aZ0 + 2.2 * pow(aZ0 / 2.6, 0.5) * uTau;            // dispersion: speed ∝ distance^0.5
      C = uAx * z + uQ1 * aLat.x + uQ2 * aLat.y;
      hPx = uHW * uFy / max(-C.z, 1e-4) / uPx;
      vis = uDim * (1.0 - smoothstep(aDie, aDie + 0.45, uT)) * (0.8 + 0.4 * fract(aSeed * 13.7));
    }`;
  const quad29 = new THREE.Mesh(geo29, new THREE.ShaderMaterial({
    uniforms: U2, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: VS29 + /* glsl */ `
      varying vec2 vL; varying float vI; varying vec4 vRect;
      void main(){
        evalInst();
        float w = uHW * aAsp;
        vec3 p = C + vec3((position.x - 0.5) * w, (position.y - 0.5) * uHW, 0.0);
        gl_Position = projectionMatrix * vec4(p, 1.0);
        float q = smoothstep(2.2, 3.6, hPx);
        vL = position.xy; vRect = aRect; vI = vis * q;
        if (vI <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; uniform vec3 uCol; uniform float uGain; varying vec2 vL; varying float vI; varying vec4 vRect;
      void main(){ float a = texture2D(uAtlas, vec2(mix(vRect.x, vRect.z, vL.x), mix(vRect.w, vRect.y, vL.y))).a;
        gl_FragColor = vec4(uCol * uGain * vI * a, 1.0); }`,
  }));
  const pts29 = new THREE.Points(pt29, new THREE.ShaderMaterial({
    uniforms: U2, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: VS29 + /* glsl */ `
      varying float vI;
      void main(){
        evalInst();
        gl_Position = projectionMatrix * vec4(C, 1.0);
        float q = smoothstep(2.2, 3.6, hPx);
        float ps = 2.6; gl_PointSize = ps * uPx;
        vI = vis * (1.0 - q) * hPx * hPx * aAsp * 0.2 / (ps * ps * 0.32);
        if (vI <= 1e-5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uGain; varying float vI;
      void main(){ vec2 d = gl_PointCoord - 0.5; gl_FragColor = vec4(uCol * uGain * vI * exp(-dot(d, d) * 14.0), 1.0); }`,
  }));
  quad29.frustumCulled = pts29.frustumCulled = false;
  // the last 「？」
  const qU = { tex: { value: qTex.tex }, uCol: { value: new THREE.Vector3(...AMBER) }, uI: { value: 1 } };
  const qMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: qU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = vec2(uv.x, 1.0 - uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tex; uniform vec3 uCol; uniform float uI; varying vec2 vUv;
      void main(){ gl_FragColor = vec4(uCol * uI * texture2D(tex, vUv).a, 1.0); }`,
  }));
  qMesh.frustumCulled = false;
  const scene29 = new THREE.Scene(); scene29.add(pts29, quad29, qMesh);
  const cam35 = kit.filmCamera(W, H, { focalMM: 35, near: 0.05, far: 1000 });
  cam35.updateMatrixWorld();
  // the separation between the camera and the words: the camera brakes from the stream's speed to 0
  // over 131 → 133 (easeOutCubic position), the words keep their speed
  const tau29 = t => { const T = 2.0, u = clamp((t - T29) / T); return (t - T29) - (T / 3) * (1 - Math.pow(1 - u, 3)); };
  const Q_START = [905, 650], Q_Z0 = 2.6, Q_H = 0.105;
  const qLat0 = (() => { const d = dirOf(Q_START[0], Q_START[1], F35); const p = d.multiplyScalar(Q_Z0 / -d.z); return p.sub(AX.clone().multiplyScalar(Q_Z0 / -AX.z)); })();

  const exports = {
    msaa: false,
    render(shot, f) {
      const t = f.t;
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.setRenderTarget(f.target); renderer.setClearColor(0x000000, 1); renderer.clear();
      if (shot.id === 'S28') {
        renderer.render(starScene28, starCam18);
        renderer.clearDepth();
        const dt = 0.5 / 24;                                          // 180° shutter for the smear
        const D = Dof(t), Dp = Dof(t - dt);
        U.uD.value = D; U.uDp.value = Dp;
        U.uE.value.copy(eHat).multiplyScalar(D); U.uEp.value.copy(eHat).multiplyScalar(Dp);
        U.uPhiT.value = NU * (t - T_R); U.uPhiTp.value = NU * (t - dt - T_R);
        U.uLeadPhi.value = PHI_R + NU * (t - T_R); U.uLeadPhiP.value = PHI_R + NU * (t - dt - T_R);
        cam18.near = 0.01 * D; cam18.far = 6 * D + 60; cam18.updateProjectionMatrix();
        U.uFy.value = cam18.projectionMatrix.elements[5] * H / 2;
        coreU.uLo.value = Math.log(1 / D);
        { const ph = PHI_R + NU * (t - T_R); const lc = posJS(Lof(Math.min(ph, 0.99999)), t, true).applyMatrix4(cam18.projectionMatrix);
          U.uLeadNdc.value.set(lc.x, lc.y); U.uFocus.value = sstep(127.6, 128.6, t) * (1 - sstep(129.9, 130.6, t)); }
        // the thread flows out at 0.09/s of its length; it dims as 1/D² once the planet is small (its
        // light merges into the root's point)
        U.uThT.value = 0.09 * (t - T28); U.uThTp.value = 0.09 * (t - dt - T28);
        U.uThGain.value = 0.2 * Math.min(1, Math.pow(Dof(T28 + 1.5) / D, 2));
        earth.group.position.copy(U.uE.value); earth.update();
        renderer.render(scene28, cam18);
        if (t > 129.9) {
          const n = 28;
          moonMat.uniforms.uW.value = 1 / n;
          for (let k = 0; k < n; k++) {
            const tk = t + dt * ((k + 0.5) / n - 0.5);
            moon.position.copy(M_EARTH).addScaledVector(eHat, Dof(tk));
            if (moon.position.z < -0.5) renderer.render(moonScene, cam18);
          }
        }
      } else {
        renderer.render(starScene29, starCam35);
        const tau = tau29(t);
        U2.uTau.value = tau; U2.uT.value = t;
        U2.uDim.value = Math.pow(Math.min(1, Math.pow(alt(T29) / alt(t), 2)), 0.35);
        U2.uFy.value = cam35.projectionMatrix.elements[5] * H / 2;
        // the 「？」: drifts onto the axis by 133.0, then recedes along it (stays on R), fades 133.0 → 134.5
        const zq = Q_Z0 + 1.15 * tau;
        const lat = 1 - sstep(T29, 133.0, t);
        qMesh.position.copy(AX).multiplyScalar(zq / -AX.z).addScaledVector(qLat0, lat * zq / Q_Z0);
        qMesh.scale.set(Q_H, Q_H, 1);
        const uq = clamp((t - 133.0) / 1.5);
        qU.uI.value = 1.55 * Math.cos(uq * Math.PI / 2);
        qMesh.visible = uq < 1;
        renderer.render(scene29, cam35);
      }
      renderer.autoClear = ac;
      renderer.setRenderTarget(f.target);
    },
    post(shot, f) {
      if (shot.id === 'S28') return { bloom: 0.8, bloomThreshold: 1.0, streak: 0.08, streakTint: [1.0, 0.8, 0.6], vignette: 0.22, grain: 0.035 };
      return { bloom: 0.8, bloomThreshold: 1.0, streak: 0.06, streakTint: [1.0, 0.8, 0.6], vignette: 0.24, grain: 0.035 };
    },
  };
  // diagnostics for the report
  console.log(`w_stream diag (not a WARNing): L_R=${L_R.toFixed(4)} L_EXIT=${L_EXIT.toFixed(3)} LMIN=${LMIN.toFixed(3)} NU=${NU.toExponential(3)} N=${N} lead@129 → ${project(posJS(L_R, T_R, true), F18).map(v => v.toFixed(2))}`);
  { const path = []; for (const t of [123, 124, 125, 126, 127, 128, 129, 129.5, 130, 130.5]) { const ph = PHI_R + NU * (t - T_R); if (ph >= 1) break;
      const L = Lof(ph); const q = project(posJS(L, t, true), F18); path.push(`${t}:(${q[0].toFixed(0)},${q[1].toFixed(0)}) r=${(Math.exp(L) * Dof(t)).toFixed(2)}`); }
    console.log('w_stream diag (not a WARNing) lead path ' + path.join(' ') + ` GAP=${GAP} NI=${NI}`); }
  return exports;
}
