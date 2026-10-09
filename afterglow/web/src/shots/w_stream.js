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
// The lead phrase 「有人吗？」 (the lane nearest the lens) crosses R at exactly 129.0. From 129.0 the
// camera starts to match the stream's speed: the flow relative to the lens decelerates (velocity
// (1−u)^3.2, u over 129 → 133) and stops at 133.0 — so the lead, the head of the stream, stays in
// the frame instead of sweeping into the top bar. The screen axis P_E → R is laid exactly on S27's
// beam (R → (1268,160)), so the S27→S28 dissolve reads as one beam resolving into letters.
// Large phrases are laid out at create() by deterministic rejection sampling (lateral offset, spiral
// phase, a little phase jitter) so that no two of them (≥ 34 px tall) overlap on screen anywhere in
// 123.0–131.75 (oriented boxes, each inflated by 0.1 h → ≥ 1.2 h between stacked lines), and none
// crosses the Moon. 130.0–131.0 the Moon (baked fbm maria, Lommel–Seeliger shading, lit from the
// right, opaque) drifts in from the top-right corner at 7 px/frame, 58 → 46 px across.
// Earth = lib/earth.js (read-only), lights fully on, a thin sunlit crescent on its far limb.
//
// S29 · the same world and the same camera — the shot continues S28 (its 131.0 frame is S28's pose):
// over 131.0 → 132.25 the lens zooms 18 → 35 mm about R (a matching yaw keeps R fixed), the flow
// keeps decelerating and stops at 133.0, the words disperse (their cross-section offsets grow),
// dim with 1/d² (capped) and go out one by one (under 3 px they hand over to point sprites); the
// Earth and the Moon leave the frame in the zoom. At 132 only a few words remain. The last 「？」 (an
// independent instance) slides up the beam axis, decelerating (easeOutCubic), and comes to rest on R
// at 133.0, then fades 133.0–134.5 (easeInSine). Then black: a few very faint distant stars.
// S28 past 131.0 (the dissolve tail) renders exactly the same picture, so any S28→S29 dissolve is a no-op.
import * as THREE from 'three';
import { createEarth } from '../lib/earth.js';
import { phraseAtlas } from '../lib/textatlas.js';
import { QUESTIONS, FONT_FOR, RTL } from '../data/voices.js';

const T28 = 123.0, T29 = 131.0, T_R = 129.0, T_STOP = 133.0;
const RX = 734.5, RY = 540.5;                       // R as a pixel centre (1080p)
const KM = 1 / 6371;                                // world unit = one Earth radius
const alt = t => 6000 * KM * Math.exp(0.49 * (t - T28));   // d(t), in Earth radii
const F18 = 960 * 18 / 18, F35 = 960 * 35 / 18;     // 1080p focal length in px (36 mm gauge)
// the Earth's (fixed) screen position in S28: 613 px from R, on the extension of S27's beam (R → VP27)
const VP27 = [1268, 160];
const P_E = (() => { const d = Math.hypot(205 - RX, 850 - RY), u = [VP27[0] - RX, VP27[1] - RY], l = Math.hypot(u[0], u[1]);
  return [RX - d * u[0] / l, RY - d * u[1] / l]; })();
// flow time: the stream's motion relative to the lens decelerates from 129.0 and stops at 133.0
const FLOW_N = 3.2;
const G = t => { if (t <= T_R) return t; const T = T_STOP - T_R, u = Math.min((t - T_R) / T, 1); return T_R + T * (1 - Math.pow(1 - u, FLOW_N + 1)) / (FLOW_N + 1); };
// S29 lens: 18 → 35 mm over 131.0 → 132.25 (easeInOutSine in log focal length)
const ZOOM1 = 132.25;
const focalPx = t => { const u = Math.min(Math.max((t - T29) / (ZOOM1 - T29), 0), 1); return F18 * Math.pow(35 / 18, 0.5 - 0.5 * Math.cos(Math.PI * u)); };
const dispAt = t => 1 + 0.8 * Math.pow(Math.max(t - T29, 0), 1.5);          // S29: the cross-section widens
const dieOf = (seed, lead) => (lead ? 131.35 : 131.15 + 1.45 * Math.pow(seed * 7.31 - Math.floor(seed * 7.31), 1.6));
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

  // ---- the camera (shared by S28 and S29) and the Moon's path, in the S28 camera frame -------------
  const camQ = t => new THREE.Quaternion().setFromUnitVectors(dirOf(RX, RY, focalPx(t)), rHat);   // R stays on R
  const MOON_R = 1737 / 6371;
  const M0 = [1945, 165], MV = 7 * 24;                        // enters at the top-right corner, 7 px/frame
  const mDir = (() => { const d = [P_E[0] - M0[0], P_E[1] - M0[1]], l = Math.hypot(d[0], d[1]); return [d[0] / l, d[1] / l]; })();   // drifting towards the Earth: we recede
  const moonDiam = t => Math.max(58 - 12 * (t - 130.0), 38);
  const moonPos = t => { const u = t - 130.0, x = M0[0] + mDir[0] * MV * u, y = M0[1] + mDir[1] * MV * u;
    return dirOf(x, y, F18).multiplyScalar(2 * MOON_R * F18 / moonDiam(t)); };
  const MOON_T0 = 129.95, MOON_T1 = 131.8;

  // ---- layout: no two large phrases overlap on screen, none crosses the Moon -----------------------
  // A JS mirror of the vertex shader (posAt / evalInst) evaluated on the S28/S29 camera; oriented
  // screen boxes are tested with the separating-axis theorem.
  const fr = x => x - Math.floor(x);
  const evalBox = (lead, phi0, ox, oy, seed, asp, t, hMin) => {
    const g = NU * (G(t) - T_R);
    const phi = lead ? PHI_R + g : fr(phi0 + g);
    if (lead && phi >= 0.9999) return null;
    if (t > dieOf(seed, lead) + 0.3) return null;
    const L = Lof(Math.min(phi, 0.99999)), eL = Math.exp(L), D = Dof(t), r = eL * D, s = Math.max(r - 1, 0);
    if (s < 0.02) return null;
    const k = Math.pow(eL / XR, OFF_EXP) * (dispAt(t) + (1 - dispAt(t)) * sstep(-1.5, -0.6, L));
    const C = eHat.clone().multiplyScalar(D).addScaledVector(B, r);
    if (lead) C.addScaledVector(LEAD_OFF, LEAD_K * RHO * s * k);
    else { const a = TAU * L + seed * 6.2831853, c = Math.cos(a), sn = Math.sin(a);
      C.addScaledVector(P1, (c * ox - sn * oy) * RHO * s * k).addScaledVector(P2, (sn * ox + c * oy) * RHO * s * k); }
    const hW = UH * Math.max(s, 0.01) * Math.pow(eL / XR, SIZE_EXP);
    const V = C.clone().negate().normalize();
    const X = B.clone().addScaledVector(V, -B.dot(V)).normalize();
    let F = F18, Cv = C, Xv = X;
    if (t >= T29) { const qi = camQ(t).invert(); F = focalPx(t); Cv = C.clone().applyQuaternion(qi); Xv = X.clone().applyQuaternion(qi); }
    if (Cv.z > -1e-3) return null;
    const hPx = hW * F / -Cv.z;
    if (hPx < hMin) return null;
    const cx = 960 + F * Cv.x / -Cv.z, cy = 540 - F * Cv.y / -Cv.z;
    const P2v = Cv.clone().addScaledVector(Xv, hW);
    const ex = 960 + F * P2v.x / -P2v.z - cx, ey = 540 - F * P2v.y / -P2v.z - cy, el = Math.hypot(ex, ey) || 1;
    const hw = 0.5 * hPx * asp;
    if (cx + hw < -40 || cx - hw > 1960 || cy + hPx < 120 || cy - hPx > 960) return null;   // off screen
    return { cx, cy, ux: ex / el, uy: ey / el, hw, hh: 0.5 * hPx, h: hPx };
  };
  const obbHit = (a, b) => {
    const ea0 = a.hw + 0.1 * a.h, ea1 = a.hh + 0.1 * a.h, eb0 = b.hw + 0.1 * b.h, eb1 = b.hh + 0.1 * b.h;
    const dx = b.cx - a.cx, dy = b.cy - a.cy;
    for (const [nx, ny] of [[a.ux, a.uy], [-a.uy, a.ux], [b.ux, b.uy], [-b.uy, b.ux]]) {
      const ra = ea0 * Math.abs(a.ux * nx + a.uy * ny) + ea1 * Math.abs(-a.uy * nx + a.ux * ny);
      const rb = eb0 * Math.abs(b.ux * nx + b.uy * ny) + eb1 * Math.abs(-b.uy * nx + b.ux * ny);
      if (Math.abs(dx * nx + dy * ny) > ra + rb) return false;
    }
    return true;
  };
  const TS = []; for (let f = Math.round(T28 * 24); f <= Math.round(131.75 * 24); f += 2) TS.push(f / 24);
  const H_MIN = 34;                                          // phrases this tall must never overlap
  const occ = TS.map(() => []);                                // placed boxes per sample time
  // the Moon (a square around its disc, + margin)
  TS.forEach((t, j) => {
    if (t < MOON_T0 || t > MOON_T1) return;
    const p = moonPos(t); let F = F18, v = p;
    if (t >= T29) { v = p.clone().applyQuaternion(camQ(t).invert()); F = focalPx(t); }
    const rr = 0.5 * moonDiam(t) * F / F18 + 14;
    occ[j].push({ cx: 960 + F * v.x / -v.z, cy: 540 - F * v.y / -v.z, ux: 1, uy: 0, hw: rr, hh: rr, h: 0 });
  });
  const boxesOf = (i, phi0, ox, oy, seed) => TS.map(t => evalBox(aLead[i] === 1, phi0, ox, oy, seed, aAsp[i], t, H_MIN));
  const fits = bx => bx.every((b, j) => !b || !occ[j].some(o => obbHit(b, o)));
  const cand = [];
  for (let i = 0; i < slots.length; i++) {
    let hmax = 0;
    for (let j = 0; j < TS.length; j += 2) { const b = evalBox(aLead[i] === 1, aPhi0[i], aOff[i * 2], aOff[i * 2 + 1], aSeed[i], aAsp[i], TS[j], 12); if (b) hmax = Math.max(hmax, b.h); }
    if (hmax > H_MIN - 4) cand.push([i, aLead[i] === 1 ? 1e9 : hmax]);
  }
  cand.sort((a, b) => b[1] - a[1]);
  const RL = rng(55 * 1000 + 280);
  let nMoved = 0, nHidden = 0;
  for (const [i] of cand) {
    let par = [aPhi0[i], aOff[i * 2], aOff[i * 2 + 1], aSeed[i]], bx = boxesOf(i, ...par), ok = aLead[i] === 1 || fits(bx);
    for (let tr = 0; !ok && tr < 400; tr++) {
      // stay inside the stream's own cross-section (the original distribution, |o| ≤ 1): the beam
      // must stay a beam — what does not fit is dropped rather than pushed out of it
      let ox = gauss(RL) * 0.5, oy = gauss(RL) * 0.5; const ol = Math.hypot(ox, oy); if (ol > 1) { ox /= ol; oy /= ol; }
      par = [aPhi0[i] + (RL() - 0.5) * (tr < 200 ? 0.7 : 1.6) / N, ox, oy, RL()];
      bx = boxesOf(i, ...par); ok = fits(bx);
      if (ok) nMoved++;
    }
    if (!ok) { aLead[i] = -1; nHidden++; continue; }          // no room for it: it is not drawn
    [aPhi0[i], aOff[i * 2], aOff[i * 2 + 1], aSeed[i]] = par;
    bx.forEach((b, j) => { if (b) occ[j].push(b); });
  }
  const LAYOUT_DIAG = `layout: ${cand.length} large phrases, ${nMoved} re-laned, ${nHidden} dropped`;

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
    uT: { value: 0 }, uDisp: { value: 1 }, uDim: { value: 1 },
  };
  const VS_COMMON = /* glsl */ `
    attribute vec4 aRect; attribute float aAsp, aPhi0, aSeed, aLead; attribute vec2 aOff;
    uniform vec3 uE, uEp, uB, uP1, uP2, uLeadOff; uniform float uD, uDp, uPhiT, uPhiTp, uLeadPhi, uLeadPhiP;
    uniform vec2 uLeadNdc; uniform float uFocus, uAspect, uT, uDisp, uDim;
    uniform float uLmax, uCtot, uCk, uEk, uRho, uUH, uTau, uFy, uPx, uThT, uThTp, uSth, uThGain;
    float Lof(float phi){ float c = (1.0 - phi) * uCtot;
      return uLmax - (c < uCk ? log(1.0 + c * ${A1.toFixed(4)}) / ${A1.toFixed(4)} : ${VK.toFixed(4)} + log(1.0 + (c - uCk) * ${A2.toFixed(4)} / uEk) / ${A2.toFixed(4)}); }
    // aLead: 0 = river, 1 = the lead phrase, 2 = the thread near the root (absolute scale)
    float Lthread(float u, float D){ return log((1.0 + uSth * pow(u, 1.25)) / D); }
    vec3 posAt(float L, vec3 E, float D, out float s){
      float r = exp(L) * D; s = max(r - 1.0, 0.0);
      // the cross-section widens faster than s far out (divergence grows), so the far stream is a thread
      // S29 dispersion: the far stream sprays out; the words near the lens keep their lanes (widening
      // those would push them into the lens)
      float k = pow(exp(L) / ${XR.toFixed(4)}, ${OFF_EXP.toFixed(2)}) * mix(uDisp, 1.0, smoothstep(-1.5, -0.6, L));
      vec3 off;
      if (aLead > 0.5 && aLead < 1.5) off = uLeadOff * uRho;
      else { float a = uTau * L + aSeed * 6.2831853; vec2 o = vec2(cos(a) * aOff.x - sin(a) * aOff.y, sin(a) * aOff.x + cos(a) * aOff.y);
             off = (uP1 * o.x + uP2 * o.y) * uRho * (aLead > 1.5 ? 0.5 : 1.0); }
      return E + uB * r + off * s * k;
    }
    // shared per-instance evaluation: centre now/prev, height, 1080p pixel height, visibility
    vec3 C, Cp, Cv; float hW, hPx, vis, sNow;
    void evalInst(){
      float L, Lp;
      vis = aLead < -0.5 ? 0.0 : 1.0;                               // -1: no room on screen (layout)
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
      Cv = (viewMatrix * vec4(C, 1.0)).xyz;                         // C is in the S28 camera frame (= world)
      hW = uUH * max(sNow, 0.01) * pow(exp(L) / ${XR.toFixed(4)}, ${SIZE_EXP.toFixed(2)});
      hPx = hW * uFy / max(-Cv.z, 1e-4) / uPx;                      // 1080p px
      vis *= smoothstep(0.0, 0.05, sNow);
      // S29: the words go out one by one (the same law as the layout pass in JS), and dim with 1/d²
      float fs = fract(aSeed * 7.31);
      float die = (aLead > 0.5 && aLead < 1.5) ? 131.35 : 131.15 + 1.45 * pow(fs, 1.6);
      vis *= (1.0 - smoothstep(die, die + 0.45, uT)) * uDim;
      vis *= 0.8 + 0.4 * fract(aSeed * 13.7);                       // a little life in the brightness
      // around 129 the eye is given to the lead: its neighbours on screen step back (dimmer)
      if (aLead < 0.5 && uFocus > 0.0) {
        vec4 cc = projectionMatrix * vec4(Cv, 1.0);
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
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
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
        gl_Position = projectionMatrix * vec4(Cv, 1.0);
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
  const moonMat = new THREE.ShaderMaterial({
    // (the Moon gets its own light from the right — "右侧日照" — a half-lit disc reads at 40–60 px, the
    //  physically consistent hairline crescent would not; at this scale nobody can triangulate the sun)
    // Opaque and drawn last: nothing shows through it, and the layout keeps the phrases off it.
    uniforms: { tex: { value: moonTex }, sun: { value: new THREE.Vector3(0.62, 0.25, 0.74).normalize() } },
    transparent: false, blending: THREE.NoBlending, depthWrite: false, depthTest: false,
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vP; varying vec3 vO;
      void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `uniform sampler2D tex; uniform vec3 sun; varying vec3 vN; varying vec3 vP; varying vec3 vO;
      void main(){
        vec3 n = normalize(vN), v = normalize(cameraPosition - vP);
        vec2 uv = vec2(atan(vO.x, vO.z) / 6.2831853 + 0.5, asin(clamp(vO.y, -1.0, 1.0)) / 3.14159265 + 0.5);
        float alb = texture2D(tex, uv).r;
        float mu0 = max(dot(n, sun), 0.0), mu = max(dot(n, v), 0.0);
        float ls = mu0 / (mu0 + mu + 1e-4);                     // Lommel–Seeliger: the flat, dusty Moon
        float es = 0.035 * mu;                                  // a trace of earthshine: the night side is a disc, not a hole
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.94) * alb * (ls * 9.0 + es), 1.0);
      }`,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 96, 48), moonMat);
  moon.frustumCulled = false;
  // the Moon is spun so that the maria face us, lit side to the right
  moon.rotation.set(0.25, 2.2, 0.1);

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
        float pxPerUnit = uFy / max(-(viewMatrix * vec4(c, 1.0)).z, 1e-4) / uPx;
        float halfW = max(uRho * 0.35 * s, 2.2 / pxPerUnit);          // ≥ 2.2 px, else the cross-section
        gl_Position = projectionMatrix * viewMatrix * vec4(c + side * position.y * halfW * 2.5, 1.0);
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
  const cam = kit.filmCamera(W, H, { focalMM: 18, near: 0.01, far: 1000 });
  cam.position.set(0, 0, 0);

  // stars at infinity (separate scene so the planet's near/far planes do not matter); S29 hands over
  // from S28's field to a much sparser, dimmer one
  const stars28 = kit.starfield({ count: 2600, seed: 2828, radius: 5e4, H, sizeScale: 0.8, brightness: 0.55, warm: 0.12 });
  const stars29 = kit.starfield({ count: 380, seed: 2929, radius: 5e4, H, sizeScale: 0.65, brightness: 0.16, warm: 0.1 });
  const starScene28 = new THREE.Scene(); starScene28.add(stars28);
  const starScene29 = new THREE.Scene(); starScene29.add(stars29);
  const starCam = kit.filmCamera(W, H, { focalMM: 18, near: 1, far: 1e5 });

  // ---- the last 「？」 ----------------------------------------------------------------------------------
  // On the beam axis (no cross-section offset): from beside the planet at 131.0 it slides up the axis,
  // decelerating (easeOutCubic in L), and comes to rest on R at 133.0; it holds there and fades out.
  const qPos = (L, D) => eHat.clone().multiplyScalar(D).addScaledVector(B, Math.exp(L) * D);
  const projAt = (p, t) => { let F = F18, v = p; if (t >= T29) { v = p.clone().applyQuaternion(camQ(t).invert()); F = focalPx(t); } return [960 + F * v.x / -v.z, 540 - F * v.y / -v.z, -v.z]; };
  const Q_L0 = Math.log(1.6 / Dof(T29));
  let Q_L1; { let lo = Q_L0, hi = 0.0; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (projAt(qPos(m, Dof(T_STOP)), T_STOP)[0] < RX) lo = m; else hi = m; } Q_L1 = (lo + hi) / 2; }
  const Q_PX = 48;                                                       // ？ height on R at 133.0 (1080p px)
  const Q_H = Q_PX * projAt(qPos(Q_L1, Dof(T_STOP)), T_STOP)[2] / F35;    // world height
  const qU = { tex: { value: qTex.tex }, uCol: { value: new THREE.Vector3(...AMBER) }, uI: { value: 1 } };
  const qMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: qU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = vec2(uv.x, 1.0 - uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tex; uniform vec3 uCol; uniform float uI; varying vec2 vUv;
      void main(){ gl_FragColor = vec4(uCol * uI * texture2D(tex, vUv).a, 1.0); }`,
  }));
  qMesh.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(qMesh);

  // post: S28's values, easing to S29's over 131 → 132 (so the join is invisible whatever the edit does)
  const POST28 = { bloom: 0.8, bloomThreshold: 1.0, streak: 0.08, streakTint: [1.0, 0.8, 0.6], vignette: 0.22, grain: 0.035 };
  const POST29 = { bloom: 0.8, bloomThreshold: 1.0, streak: 0.06, streakTint: [1.0, 0.8, 0.6], vignette: 0.24, grain: 0.035 };

  // one world, one camera: S28 and S29 (and S28's dissolve tail past 131.0) are the same function of t
  function renderWorld(t, target) {
    const ac = renderer.autoClear; renderer.autoClear = false;
    renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 1); renderer.clear();
    const s29 = t >= T29;
    const F = focalPx(t);
    cam.setFocalLength(18 * F / F18); starCam.setFocalLength(18 * F / F18);
    if (s29) { const q = camQ(t); cam.quaternion.copy(q); starCam.quaternion.copy(q); }
    else { cam.quaternion.identity(); starCam.quaternion.identity(); }
    starCam.updateMatrixWorld();
    const st = sstep(131.2, 132.6, t);
    if (st < 1) { stars28.material.uniforms.opacity.value = 1 - st; renderer.render(starScene28, starCam); }
    if (st > 0) { stars29.material.uniforms.opacity.value = st; renderer.render(starScene29, starCam); }
    renderer.clearDepth();
    const dt = 0.5 / 24;                                            // 180° shutter for the smear
    const D = Dof(t), Dp = Dof(t - dt);
    U.uD.value = D; U.uDp.value = Dp;
    U.uE.value.copy(eHat).multiplyScalar(D); U.uEp.value.copy(eHat).multiplyScalar(Dp);
    const g = NU * (G(t) - T_R), gp = NU * (G(t - dt) - T_R);
    U.uPhiT.value = g; U.uPhiTp.value = gp;
    U.uLeadPhi.value = PHI_R + g; U.uLeadPhiP.value = PHI_R + gp;
    U.uT.value = t; U.uDisp.value = dispAt(t);
    U.uDim.value = s29 ? Math.pow(Math.min(1, Math.pow(alt(T29) / alt(t), 2)), 0.35) : 1;
    cam.near = 0.01 * D; cam.far = 6 * D + 60; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    U.uFy.value = cam.projectionMatrix.elements[5] * H / 2;
    coreU.uLo.value = Math.log(1 / D);
    const fade29 = 1 - sstep(T29, 131.8, t);                        // the thread and the core go out first
    coreU.uI.value = 0.5 * fade29;
    { const ph = PHI_R + g;
      if (ph < 0.99999 && !s29) { const lc = posJS(Lof(ph), t, true).applyMatrix4(cam.projectionMatrix); U.uLeadNdc.value.set(lc.x, lc.y); }
      U.uFocus.value = sstep(127.6, 128.6, t) * (1 - sstep(129.9, 130.6, t)); }
    // the thread flows out at 0.09/s of its length; it dims as 1/D² once the planet is small (its
    // light merges into the root's point)
    U.uThT.value = 0.09 * (t - T28); U.uThTp.value = 0.09 * (t - dt - T28);
    U.uThGain.value = 0.2 * Math.min(1, Math.pow(Dof(T28 + 1.5) / D, 2)) * fade29;
    earth.group.position.copy(U.uE.value); earth.update();
    renderer.render(scene28, cam);
    if (t > MOON_T0 && t < MOON_T1) {
      const p = moonPos(t), pr = projAt(p, t), rp = 0.5 * moonDiam(t) * F / F18;
      if (pr[0] > -rp && pr[0] < 1920 + rp && pr[1] > -rp && pr[1] < 1080 + rp) { moon.position.copy(p); renderer.render(moonScene, cam); }
    }
    if (s29) {
      const u = clamp((t - T29) / (T_STOP - T29)), e = 1 - Math.pow(1 - u, 3);
      const Dq = Dof(Math.min(t, T_STOP));
      qMesh.position.copy(qPos(Q_L0 + (Q_L1 - Q_L0) * e, Dq));
      qMesh.quaternion.copy(cam.quaternion);
      qMesh.scale.set(Q_H, Q_H, 1);
      const uq = clamp((t - T_STOP) / 1.5);
      qU.uI.value = 1.55 * sstep(T29, 131.35, t) * Math.cos(uq * Math.PI / 2);
      if (uq < 1) renderer.render(qScene, cam);
    }
    renderer.autoClear = ac;
    renderer.setRenderTarget(target);
  }

  const exports = {
    msaa: false,
    render(shot, f) { renderWorld(f.t, f.target); },
    post(shot, f) {
      const m = sstep(T29, 132.0, f.t), o = {};
      for (const k of Object.keys(POST28)) o[k] = Array.isArray(POST28[k]) ? POST28[k] : POST28[k] + (POST29[k] - POST28[k]) * m;
      return o;
    },
  };
  // diagnostics for the report
  console.log(`w_stream diag (not a WARNing): P_E=${P_E.map(v => v.toFixed(1))} L_R=${L_R.toFixed(4)} L_EXIT=${L_EXIT.toFixed(3)} LMIN=${LMIN.toFixed(3)} NU=${NU.toExponential(3)} N=${N} lead@129 → ${project(posJS(L_R, T_R, true), F18).map(v => v.toFixed(2))} ${LAYOUT_DIAG}`);
  { const path = []; for (const t of [123, 125, 127, 128, 129, 129.5, 130, 130.5, 131, 131.5, 132]) { const ph = PHI_R + NU * (G(t) - T_R); if (ph >= 1) break;
      const L = Lof(ph); const q = projAt(posJS(L, t, true), t); path.push(`${t}:(${q[0].toFixed(0)},${q[1].toFixed(0)})`); }
    console.log('w_stream diag (not a WARNing) lead path ' + path.join(' ') + ` GAP=${GAP} NI=${NI}`);
    const mp = []; for (const t of [130, 130.5, 130.958, 131, 131.25, 131.5]) { const q = projAt(moonPos(t), t); mp.push(`${t}:(${q[0].toFixed(0)},${q[1].toFixed(0)}) ⌀${(moonDiam(t) * focalPx(t) / F18).toFixed(0)}`); }
    console.log('w_stream diag (not a WARNing) moon ' + mp.join(' '));
    const qp = []; for (const t of [131, 131.5, 132, 132.5, 133]) { const e = 1 - Math.pow(1 - clamp((t - T29) / 2), 3); const p = qPos(Q_L0 + (Q_L1 - Q_L0) * e, Dof(t)); const q = projAt(p, t); qp.push(`${t}:(${q[0].toFixed(0)},${q[1].toFixed(0)}) h${(Q_H * focalPx(t) / q[2]).toFixed(0)}`); }
    console.log('w_stream diag (not a WARNing) last ？ ' + qp.join(' ')); }
  return exports;
}
