// q_apex — the apex of the film.
//   S37 汇聚   184.0–191.0  50 mm, a slight pull-back that settles at 188.0 (= S38's locked frame).
//        The whole sea of words flows into the human line 「有人吗？」 (Noto Serif CJK SC SemiBold
//        128 px, left 722, centre y 410) with S05's spiral law applied to every word's offset from
//        its own landing place: r = r₀(1 − u)², θ = θ₀ + 10u³ (so each lands softly, and the
//        differential rotation draws the spiral arms). Departures staggered by distance, all landed
//        by 188.0. Legible layer: real graphemes of voices.js sentences, 6–9 px, 10–15 px in flight
//        (shrinking only in the last 0.5 s); dust layer ≤ 3 px; ~700 words gather into the cursor
//        block at R. Breathing = 0.25 Hz brightness + ±3.5 px flow along the stroke tangent.
//        191.0 the cursor block condenses into solid warm white.
//   S38 我在。/ 有人吗？ 191.0–216.0  locked. Frame-exact per the screenplay table:
//        194.0 我 · 194.333 在 · 194.667 。 (one key per 8 frames) — the AI's own voice, Noto Sans Mono
//        CJK SC 64 px, CURSOR HDR 1.6, centre y 540.
//        195–199 every legible glyph of the human line flips (card-flip, one by one by hash) into the
//        same monospace 「我」/「在」: AMBER → (warm-white flash) → ASH, breathing and flow freeze;
//        dust 1.0 → 0.45 and greys. 202.0 / 203.0 / 204.0 the three deletions flip them back
//        (hash < 0.3 / < 0.7 / all — a ripple from the deleted character), 204.0 surge 1.15 → 1.0 by 206.
//        205/206/207 silent blinks. 208/209/210/211 有 人 吗 ？ one key per beat. 211–214 the AI's
//        strokes dissolve into ~700 micro mono 「有」「人」「吗」 + 5000 motes that breathe in the
//        same rhythm as the human line but stay CURSOR warm white (never AMBER). 215.0 carriage
//        return: both lines up 130 px in 6 frames (easeOutCubic), the cursor back on R.
//
// World space = 1080p pixel space on the plane z = 0 (X = px − 960, Y = 540 − py); the 50 mm camera
// sits at the focal distance FPX50 so that 1 unit = 1 px. Cursor block = x 722–746, y 508–572.
import * as THREE from 'three';
import { getWeb, sampleWebPoints, webPathPose } from './_webgraph.js';
import { getLexicon, assertFonts, PAL, glyphMesh, screenRect, hash1, rng } from './w_sea/lexicon.js';

const T37 = 184, T38 = 191, T39 = 216;
const FPX50 = 960 / (18 / 50);                // 2666.667: camera distance for 1 unit = 1 px (36 mm gauge)
const HUMAN = { x: 722, y: 410, font: '600 128px "Noto Serif CJK SC"', text: '有人吗？' };
const AI = { x: 722, y: 540, cell: 64, font: '400 64px "Noto Sans Mono CJK SC"' };
const ROWS = ['我在。', '有人吗？'];
const N_DUST = 14000, N_CUR = 700, N_DRAIN = 11000, N_AI_MICRO = 700, N_AI_DUST = 5000;
const FLIP = { start: 195.0, spread: 4.0, revert: [[202.0, 0.3], [203.0, 0.7], [204.0, 1.0]] };

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const outCubic = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const X = px => px - 960, Y = py => 540 - py;

// ---- the AI line: what is on it at time t (frame-exact keystrokes) ----------------------------
const KEYS = [   // [t, row, count]
  [194.0, 0, 1], [194 + 8 / 24, 0, 2], [194 + 16 / 24, 0, 3],
  [202.0, 0, 2], [203.0, 0, 1], [204.0, 0, 0],
  [208.0, 1, 1], [209.0, 1, 2], [210.0, 1, 3], [211.0, 1, 4],
];
const EPS = 1e-4;
function aiLine(t) {
  let row = 0, n = 0;
  for (const [tk, r, c] of KEYS) if (t >= tk - EPS) { row = r; n = c; }
  return { row, n, returned: t >= 215.0 - EPS };
}
// cursor: steady while typing / deleting / returning, else the 60 BPM square wave (on x.00–x.11)
const STEADY = [[194.0, 195.0], [202.0, 204.5], [208.0, 212.0], [215.0, 217.0]];
function cursorOn(t) {
  if (t < T38 - EPS) return false;
  for (const [a, b] of STEADY) if (t >= a - EPS && t < b - EPS) return true;
  return (t + EPS - Math.floor(t + EPS)) < 0.5;
}
// fraction of the legible layer that is flipped (for the dust layer), and its integral (frozen flow)
function flipFrac(t) {
  let f = Math.min(1, Math.max(0, (t - FLIP.start) / FLIP.spread));
  let prev = 0;
  for (const [tr, h] of FLIP.revert) { const k = smooth(tr, tr + 0.35, t); f = Math.max(0, f - (h - prev) * k); prev = h; }
  return f;
}
function tauDust(t) {   // t − ∫ flipFrac (the dust's own clock stops while it is "answered")
  if (t <= FLIP.start) return t;
  let acc = 0; const n = 64, a = FLIP.start, b = Math.min(t, 206);
  for (let i = 0; i < n; i++) acc += flipFrac(a + (b - a) * (i + 0.5) / n) * (b - a) / n;
  return t - 0.9 * acc;
}

// ---- ink masks -----------------------------------------------------------------------------
// canvas2D rasterisation of a line at 1080p scale; returns alpha (0..1) and a stroke-tangent field
// from the structure tensor of the smoothed gradient (well defined on stroke centres too).
function inkMask(text, font, x, yMid, { cell = 0, region }) {
  const [x0, y0, w, h] = region;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = font; g.textBaseline = 'middle';
  if (cell) { g.textAlign = 'center'; Array.from(text).forEach((ch, i) => g.fillText(ch, x + cell * i + cell / 2 - x0, yMid - y0)); }
  else { g.textAlign = 'left'; g.fillText(text, x - x0, yMid - y0); }
  const d = g.getImageData(0, 0, w, h).data;
  const A = new Float32Array(w * h); let ink = 0;
  for (let i = 0; i < w * h; i++) { A[i] = d[4 * i + 3] / 255; ink += A[i]; }
  const blur = (src, r) => {       // separable box blur ×2
    let a = src, b = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) { let s = 0; for (let x2 = -r; x2 <= r; x2++) s += a[y * w + Math.min(w - 1, Math.max(0, x2))];
        for (let x2 = 0; x2 < w; x2++) { b[y * w + x2] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x2 + r + 1)] - a[y * w + Math.max(0, x2 - r)]; } }
      const c2 = new Float32Array(w * h);
      for (let x2 = 0; x2 < w; x2++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x2];
        for (let y = 0; y < h; y++) { c2[y * w + x2] = s / (2 * r + 1); s += b[Math.min(h - 1, y + r + 1) * w + x2] - b[Math.max(0, y - r) * w + x2]; } }
      a = c2;
    }
    return a;
  };
  const B = blur(A, 2);
  const jxx = new Float32Array(w * h), jxy = new Float32Array(w * h), jyy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x2 = 1; x2 < w - 1; x2++) {
    const i = y * w + x2, gx = B[i + 1] - B[i - 1], gy = B[i + w] - B[i - w];
    jxx[i] = gx * gx; jxy[i] = gx * gy; jyy[i] = gy * gy;
  }
  const Jxx = blur(jxx, 4), Jxy = blur(jxy, 4), Jyy = blur(jyy, 4);
  const at = (px, py) => { const ix = Math.round(px - x0), iy = Math.round(py - y0); return (ix < 0 || iy < 0 || ix >= w || iy >= h) ? 0 : A[iy * w + ix]; };
  const tangent = (px, py) => {    // unit tangent in world coords (Y up)
    const ix = Math.min(w - 1, Math.max(0, Math.round(px - x0))), iy = Math.min(h - 1, Math.max(0, Math.round(py - y0))), i = iy * w + ix;
    const th = 0.5 * Math.atan2(2 * Jxy[i], Jxx[i] - Jyy[i]) + Math.PI / 2;   // across-stroke + 90°
    return [Math.cos(th), -Math.sin(th)];
  };
  return { at, tangent, ink, region };
}
// points inside the ink: jittered grid (spacing s) or uniform rejection sampling (count n)
function gridInk(M, s, r, thr = 0.5) {
  const [x0, y0, w, h] = M.region, out = [];
  for (let y = y0; y < y0 + h; y += s) for (let x = x0; x < x0 + w; x += s) {
    const px = x + r() * s, py = y + r() * s;
    if (M.at(px, py) > thr) out.push([px, py]);
  }
  return out;
}
function randInk(M, n, r, thr = 0.45) {
  const [x0, y0, w, h] = M.region, out = [];
  for (let tries = 0; out.length < n && tries < n * 200; tries++) {
    const px = x0 + r() * w, py = y0 + r() * h;
    if (M.at(px, py) > thr) out.push([px, py]);
  }
  return out;
}

export async function create(ctx) {
  const { THREE: T, renderer, W, H, kit, makeRT, FSQ } = ctx;
  await assertFonts([[HUMAN.font, '有人吗？'], [AI.font, '我在。有人吗？'], ['400 40px "Noto Serif CJK SC"', '遂古之初']]);
  const lex = getLexicon();
  const r = rng(55 * 37 + 1);

  // =========================================================================================
  // The human line: legible layer + dust + cursor words + the rest of the sea (drain)
  const HM = inkMask(HUMAN.text, HUMAN.font, HUMAN.x, HUMAN.y, { region: [700, 318, 600, 190] });
  // legible: jittered grid; coverage ≈ 2.5 glyph cells per ink pixel at em 6–9 px (≈ 7.5 px)
  // legible layer: ~1600 graphemes of 6–8.5 px. Nominal cell coverage ≈ 6 per ink px, i.e. ≈ 1.5–2
  // layers of actual glyph ink (a glyph inks ~25 % of its cell): strokes read solid, glyphs still
  // separate at their edges. Spacing solved from the measured ink area of the line.
  const EM = [6, 8.5], N_LEG = 1600;
  const spacing = Math.sqrt(HM.ink / N_LEG) * 0.93;
  const legible = gridInk(HM, spacing, r, 0.5);
  console.log(`WARN q_apex: ink ${HM.ink.toFixed(0)} px², legible ${legible.length} (spacing ${spacing.toFixed(2)})`);
  // tokens: graphemes of real sentences, interleaved across scripts, written in reading order
  const byLang = new Map();
  for (const s of lex.sentences) if (s.glyphs.length && s.v.lang !== 'morse') { if (!byLang.has(s.v.lang)) byLang.set(s.v.lang, []); byLang.get(s.v.lang).push(s); }
  const langs = [...byLang.keys()].sort((a, b) => hash1(a.length * 31 + a.charCodeAt(0) * 7 + (a.charCodeAt(1) || 0), 5) - hash1(b.length * 31 + b.charCodeAt(0) * 7 + (b.charCodeAt(1) || 0), 5));
  const stream = [];
  for (let k = 0; stream.length < 12000; k++) {
    const L = byLang.get(langs[k % langs.length]);
    const s = L[Math.floor(k / langs.length) % L.length];
    stream.push(...s.glyphs);
  }
  legible.sort((a, b) => (Math.floor(a[1] / 9) - Math.floor(b[1] / 9)) || (a[0] - b[0]));   // reading order
  const dust = randInk(HM, N_DUST, r, 0.45);
  const curPts = []; for (let i = 0; i < N_CUR; i++) curPts.push([722 + 1 + 22 * r(), 508 + 1 + 62 * r()]);
  const drainPts = randInk(HM, N_DRAIN, r, 0.3);

  // start positions: a patch of the word-web (same graph), seen from beyond WEB_PATH(9)
  const web = getWeb();
  const P9 = webPathPose(9);
  const C0 = P9.pos.clone().addScaledVector(P9.forward, 34);
  const wp = sampleWebPoints(web, 260000, 37);
  const starts = [];
  const K = 52;   // px per web unit
  for (let i = 0; i < wp.count && starts.length < 80000; i++) {
    const dx = wp.pos[3 * i] - C0.x, dy = wp.pos[3 * i + 1] - C0.y, dz = wp.pos[3 * i + 2] - C0.z;
    const lx = (dx * P9.right.x + dy * P9.right.y + dz * P9.right.z) * K;
    const ly = (dx * P9.up.x + dy * P9.up.y + dz * P9.up.z) * K;
    const lz = -(dx * P9.forward.x + dy * P9.forward.y + dz * P9.forward.z) * K;
    if (Math.abs(lx) > 3400 || Math.abs(ly) > 2000 || lz > 1500 || lz < -5200) continue;
    starts.push([lx, ly, lz]);
  }
  // pair starts and targets by angle around the line centre (coherent swirl, no criss-crossing)
  const CEN = [X(978), Y(410)];
  const ang = (x, y) => Math.atan2(y - CEN[1], x - CEN[0]);
  const groups = [
    { kind: 0, pts: legible }, { kind: 1, pts: dust }, { kind: 2, pts: curPts }, { kind: 3, pts: drainPts },
  ];
  const total = groups.reduce((s, g) => s + g.pts.length, 0);
  const iPos = new Float32Array(total * 3), iC = new Float32Array(total * 4), iB = new Float32Array(total * 4), iA = new Float32Array(total * 4);
  const iRect = new Float32Array(total * 4), iRect2 = new Float32Array(total * 4), iCol = new Float32Array(total * 3);
  const sorted = starts.map((s, i) => [ang(s[0], s[1]), i]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
  let o = 0, si = 0;
  const amberVar = h => { const c = [[1.0, 0.40, 0.11], PAL.AMBER, [1.0, 0.56, 0.22]]; const k = h * 2, i = Math.min(1, Math.floor(k)), f = k - i; return c[i].map((v, j) => v + (c[i + 1][j] - v) * f); };
  const seaShort = lex.sea.filter(k => lex.rowAspect(k) < 3);
  let maxD = 0;
  for (const G of groups) {
    // choose starts for this group evenly through the angle-sorted list, then pair by target angle
    const n = G.pts.length, step = sorted.length / n;
    const S = []; for (let k = 0; k < n; k++) S.push(starts[sorted[Math.floor((k * step + si * 0.37) % sorted.length)]]);
    si++;
    const tIdx = G.pts.map((p, k) => [ang(X(p[0]), Y(p[1])), k]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
    for (let k = 0; k < n; k++) {
      const p = G.pts[tIdx[k]], s = S[k], i = o + k;
      const tx = X(p[0]), ty = Y(p[1]);
      iPos.set([tx, ty, 0], 3 * i);
      const dd = Math.hypot(s[0] - tx, s[1] - ty, s[2] * 0.5); maxD = Math.max(maxD, dd);
      iC.set([s[0], s[1], s[2], dd], 4 * i);
      const tg = (G.kind === 2) ? [0, 1] : HM.tangent(p[0], p[1]);
      iB.set([tg[0], tg[1], G.kind, 0], 4 * i);
      const h1 = r(), h2 = r();
      let tok, em, b;
      if (G.kind === 0) { tok = stream[tIdx[k] % stream.length]; em = EM[0] + (EM[1] - EM[0]) * r(); b = 0.5 * Math.exp(0.3 * r.gauss()); }
      else if (G.kind === 1) { tok = stream[Math.floor(r() * stream.length)]; em = 1.4 + 0.5 * r(); b = 0.42 * Math.exp(0.3 * r.gauss()); }
      else if (G.kind === 2) { tok = seaShort[Math.floor(r() * seaShort.length)]; em = 1.9 + 0.5 * r(); b = 0.6; }
      else { tok = seaShort[Math.floor(r() * seaShort.length)]; em = 4 + 4 * r(); b = Math.min(8, 1.1 * Math.exp(0.8 * r.gauss())); }
      // two spiral arms (log spiral in the start offsets) — brighter words trace the arms, so the
      // vortex reads as a forming galaxy, then winds up into the sentence
      if (G.kind !== 2) {
        const a0 = Math.atan2(s[1] - CEN[1], s[0] - CEN[0]), r0 = Math.hypot(s[0] - CEN[0], s[1] - CEN[1]) + 60;
        const arm = Math.pow(0.5 + 0.5 * Math.cos(2 * a0 - 2.4 * Math.log(r0 / 300)), 2.5);
        b *= 0.35 + 1.6 * arm;
      }
      iRect.set(lex.rects.subarray(tok * 4, tok * 4 + 4), 4 * i);
      const mono = h2 < 0.5 ? lex.mono['我'] : lex.mono['在'];
      iRect2.set(lex.rects.subarray(mono * 4, mono * 4 + 4), 4 * i);
      iA.set([em * 1.6, b, h1, h2], 4 * i);    // quad height = em × 1.6 (atlas row 80 px, font 50 px)
      iCol.set(amberVar(r()), 3 * i);
    }
    o += n;
  }
  // departures: near first (the line nucleates), all landed by 188.0
  for (let i = 0; i < total; i++) {
    const dn = Math.min(1, iC[4 * i + 3] / maxD), h = iA[4 * i + 2];
    const ts = T37 + 0.15 + 0.75 * dn + 0.25 * h;
    const te = Math.min(188.0, 186.4 + 1.45 * dn + 0.15 * h);
    iC[4 * i + 3] = ts; iB[4 * i + 3] = te;
  }
  const HOPTS = {
    uniforms: {
      uShift: { value: 0 }, uSurge: { value: 1 }, uDust: { value: 1 }, uFrac: { value: 0 }, uTauD: { value: 0 },
      uAsh: { value: new T.Vector3(...PAL.ASH) }, uCur: { value: new T.Vector3(...PAL.CURSOR) }, uRipple: { value: new T.Vector3(X(746), Y(540), 1 / 2400) },
      uRevert: { value: new T.Vector3(202, 203, 204) },
    },
    header: /* glsl */ `uniform float uShift, uSurge, uDust, uFrac, uTauD; uniform vec3 uAsh, uCur, uRipple, uRevert;
      float breath(float tau, float ph){ return sin(6.28318 * 0.25 * tau + ph) * 0.65 + sin(6.28318 * 0.13 * tau + 1.7 * ph + 1.3) * 0.35; }`,
    vertexBody: /* glsl */ `
      float kind = iB.z, ts = iC.w, te = iB.w;
      float s0 = clamp((time - ts) / max(1e-3, te - ts), 0.0, 1.0);
      float u = s0 * s0 * (3.0 - 2.0 * s0);      // soft departure, soft landing
      float k1 = (1.0 - u) * (1.0 - u), phi = 10.0 * u * u * u;
      vec2 off = iC.xy - iPos.xy;
      float cph = cos(phi), sph = sin(phi);
      p = vec3(iPos.xy + vec2(cph * off.x - sph * off.y, sph * off.x + cph * off.y) * k1, iC.z * k1);
      float fl = kind < 0.5 ? 0.6 : kind < 1.5 ? 1.6 : kind < 2.5 ? 3.2 : 0.0;
      hW *= 1.0 + fl * (1.0 - smoothstep(te - 0.5, te, time));
      float landed = smoothstep(0.92, 1.0, u);
      float ph = iPos.x * 0.011 + iA.w * 1.1;
      float tau = time;
      if (kind < 0.5) {
        // the answer: flip to the AI's mono 我/在 (195 + 4·hash), back on the deletions (by hash)
        float tF = 195.0 + 4.0 * iA.z;
        float rip = length(iPos.xy - uRipple.xy) * uRipple.z;
        float tB = (iA.z < 0.3 ? uRevert.x : (iA.z < 0.7 ? uRevert.y : uRevert.z)) + rip;
        tau = time < tF ? time : (time < tB ? tF : time - (tB - tF));
        float fA = clamp((time - tF) / 0.18, 0.0, 1.0), fB = clamp((time - tB) / 0.18, 0.0, 1.0);
        sel = step(0.5, fA) * (1.0 - step(0.5, fB));
        if (fA > 0.0 && fA < 1.0) sx = max(0.06, abs(cos(3.14159 * fA)));
        if (fB > 0.0 && fB < 1.0) sx = max(0.06, abs(cos(3.14159 * fB)));
        float since = time - tF - 0.09;
        vec3 fc = mix(uCur * 1.6, uAsh * 0.95, smoothstep(0.0, 0.55, since));
        col = mix(col, fc, sel);
        float back = time - tB - 0.09;
        col *= 1.0 + 0.55 * exp(-max(back, 0.0) * 5.0) * step(0.0, back) * (1.0 - sel);
        b *= 1.0 + 0.2 * breath(tau, ph) * landed * (1.0 - sel);
        b *= mix(1.0, 0.92, sel);
      } else if (kind < 1.5) {
        tau = uTauD;
        b *= uDust * (1.0 + 0.2 * (1.0 - 0.9 * uFrac) * breath(tau, ph) * landed);
        col = mix(col, uAsh * 1.6, 0.6 * uFrac);
      } else if (kind < 2.5) {
        // the cursor's words: amber, then condensing to warm white; gone when the block is solid
        b *= (1.0 + 1.3 * smoothstep(189.6, 191.0, time)) * (1.0 - step(191.0, time));
        col = mix(col, uCur, smoothstep(189.8, 191.0, time));
        b *= 1.0 + 0.15 * breath(time, ph) * landed;
      } else {
        b *= 1.0 - smoothstep(0.78, 0.995, u);     // the rest of the sea pours in and is absorbed
      }
      if (kind < 1.5) p.xy += iB.xy * 3.5 * sin(6.28318 * 0.25 * tau + 0.7 * ph + 3.0 * iA.z) * landed * (kind < 0.5 ? 1.0 : 1.0 - 0.9 * uFrac);
      b *= uSurge;
      p.y += uShift;`,
  };
  // legible layer (large in flight) as quads — no frame-edge popping; everything else as points
  const nL = legible.length;
  const subA = (lo, hi) => ({ iPos: iPos.subarray(3 * lo, 3 * hi), iRect: iRect.subarray(4 * lo, 4 * hi), iRect2: iRect2.subarray(4 * lo, 4 * hi), iA: iA.subarray(4 * lo, 4 * hi), iB: iB.subarray(4 * lo, 4 * hi), iC: iC.subarray(4 * lo, 4 * hi), iCol: iCol.subarray(3 * lo, 3 * hi) });
  const humanQ = glyphMesh(nL, subA(0, nL), { ...HOPTS, points: false });
  const humanP = glyphMesh(total - nL, subA(nL, total), { ...HOPTS, points: true });
  humanP.material.uniforms = humanQ.material.uniforms;
  const human = new T.Group(); human.add(humanQ); human.add(humanP);
  const HU = humanQ.material.uniforms;
  HU.res.value.set(W, H); HU.minPx.value = 1.0; HU.capPx.value = [700, 900]; HU.nearFade.value = [60, 300];

  // =========================================================================================
  // The AI line: typed glyphs (canvas2D, 2×), then micro mono glyphs + motes that breathe
  const cv = document.createElement('canvas'); cv.width = 128 * 4; cv.height = 128 * 2;
  { const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.font = '400 128px "Noto Sans Mono CJK SC"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ROWS.forEach((row, ri) => Array.from(row).forEach((ch, ci) => g.fillText(ch, 128 * ci + 64, 128 * ri + 64))); }
  const aiTex = new T.CanvasTexture(cv);
  aiTex.minFilter = T.LinearMipmapLinearFilter; aiTex.magFilter = T.LinearFilter; aiTex.generateMipmaps = true;
  const aiMat = new T.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { tex: { value: aiTex }, color: { value: new T.Vector3(...PAL.CURSOR.map(v => v * 1.6)) }, cellUV: { value: new T.Vector4() }, dissolve: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tex; uniform vec3 color; uniform vec4 cellUV; uniform float dissolve; varying vec2 vUv;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      void main(){ vec2 uv = mix(cellUV.xy, cellUV.zw, vUv); float a = texture2D(tex, uv).a;
        // the solid stroke crumbles (pixel-scale noise threshold) as the micro glyphs take over
        float n = vn(vUv * 64.0 / 2.5) * 0.7 + vn(vUv * 64.0 / 9.0 + 7.0) * 0.3;
        a *= smoothstep(dissolve - 0.06, dissolve + 0.06, n);
        gl_FragColor = vec4(color * a, 1.0); }`,
  });
  const aiScene = new T.Scene();
  const aiCells = [];
  for (let ri = 0; ri < 2; ri++) for (let ci = 0; ci < Array.from(ROWS[ri]).length; ci++) {
    const m = new T.Mesh(new T.PlaneGeometry(AI.cell, AI.cell), aiMat.clone());
    m.material.uniforms.tex.value = aiTex;
    m.material.uniforms.cellUV.value.set(ci / 4, 1 - (ri + 1) / 2, (ci + 1) / 4, 1 - ri / 2);   // flipY: v = 1 is the canvas top
    m.userData = { ri, ci, x: X(AI.x + AI.cell * ci + AI.cell / 2) };
    m.frustumCulled = false; aiScene.add(m); aiCells.push(m);
  }
  // micro glyphs in the strokes of 有人吗？ (each cell's own character; ？ cycles through 有人吗)
  const AM = inkMask(ROWS[1], AI.font, AI.x, AI.y, { cell: AI.cell, region: [712, 500, 280, 80] });
  const ra = rng(55 * 38 + 3);
  const micro = gridInk(AM, Math.sqrt(4.2 * 4.2 / 2.2) * 1.0, ra, 0.5);
  const mN = Math.min(micro.length, N_AI_MICRO + 200);
  const adust = randInk(AM, N_AI_DUST, ra, 0.45);
  const an = mN + adust.length;
  const aPos = new Float32Array(an * 3), aA = new Float32Array(an * 4), aB = new Float32Array(an * 4), aRect = new Float32Array(an * 4), aCol = new Float32Array(an * 3);
  const monoOf = ['有', '人', '吗'].map(ch => lex.mono[ch]);
  for (let i = 0; i < an; i++) {
    const isM = i < mN, p = isM ? micro[i] : adust[i - mN];
    aPos.set([X(p[0]), Y(p[1]), 0], 3 * i);
    const ci = Math.min(3, Math.max(0, Math.floor((p[0] - AI.x) / AI.cell)));
    const tok = ci < 3 ? monoOf[ci] : monoOf[Math.floor(ra() * 3)];
    aRect.set(lex.rects.subarray(tok * 4, tok * 4 + 4), 4 * i);
    const em = isM ? 4 + 2 * ra() : 1.3 + 0.4 * ra();
    aA.set([em * 1.6, isM ? 0.85 : 0.2, ra(), ra()], 4 * i);
    const tg = AM.tangent(p[0], p[1]);
    aB.set([tg[0], tg[1], isM ? 0 : 1, 211.0 + 2.0 * ra()], 4 * i);
    aCol.set(PAL.CURSOR, 3 * i);
  }
  console.log(`WARN q_apex: AI micro ${mN}, AI dust ${adust.length}, human dust ${dust.length}, drain ${drainPts.length}`);
  const aiField = glyphMesh(an, { iPos: aPos, iRect: aRect, iA: aA, iB: aB, iCol: aCol }, {
    uniforms: { uShift: { value: 0 } },
    header: /* glsl */ `uniform float uShift;
      float breath(float tau, float ph){ return sin(6.28318 * 0.25 * tau + ph) * 0.65 + sin(6.28318 * 0.13 * tau + 1.7 * ph + 1.3) * 0.35; }`,
    vertexBody: /* glsl */ `
      float appear = smoothstep(iB.w, iB.w + 0.3, time);
      float live = smoothstep(211.4, 214.0, time);
      float ph = iPos.x * 0.011 + iA.w * 1.1;
      b *= appear * (1.0 + 0.2 * breath(time, ph) * live);
      p.xy += iB.xy * 3.0 * sin(6.28318 * 0.25 * time + 0.7 * ph + 3.0 * iA.z) * live;
      p.y += uShift;`,
  });
  aiField.material.uniforms.res.value.set(W, H); aiField.material.uniforms.minPx.value = 1.0;
  aiField.material.uniforms.capPx.value = [700, 900]; aiField.material.uniforms.nearFade.value = [60, 300];

  const scene = new T.Scene(); scene.add(human); scene.add(aiField);
  const cursor = screenRect(); cursor.material.uniforms.color.value.set(...PAL.CURSOR.map(v => v * 2.0));
  const overlay = new T.Scene(); overlay.add(cursor);
  const ortho = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const cam = kit.filmCamera(W, H, { focalMM: 50, near: 10, far: 20000 });

  const draw = (sc, camera, target, clear) => {
    const ac = renderer.autoClear; renderer.autoClear = !!clear;
    renderer.setRenderTarget(target); renderer.render(sc, camera); renderer.autoClear = ac;
  };

  function renderAt(t, target, clear) {
    // camera: slight pull-back 184 → 188 (ease-out), then locked
    const D = FPX50 * (1 - 0.075 * (1 - outCubic((t - T37) / 4)));
    cam.position.set(0, 0, D); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
    const shift = 130 * outCubic((t - 215.0) / 0.25) * (t >= 215.0 - EPS ? 1 : 0);
    HU.time.value = t; HU.focus.value = D; HU.aperture.value = 5;
    HU.uShift.value = shift;
    const fr = flipFrac(t);
    HU.uFrac.value = fr; HU.uDust.value = 1 - 0.55 * fr; HU.uTauD.value = tauDust(t);
    HU.uSurge.value = 1 + 0.15 * smooth(204.0, 204.12, t) * (1 - smooth(204.3, 206.0, t));
    // the absorbed sea (drain, last in the arrays) is no longer drawn once it has landed
    humanP.geometry.setDrawRange(0, t > 188.05 ? total - nL - drainPts.length : total - nL);
    const AU = aiField.material.uniforms;
    AU.time.value = t; AU.focus.value = D; AU.aperture.value = 0; AU.uShift.value = shift;
    aiField.visible = t >= 211.0 - EPS;
    // typed glyphs
    const L = aiLine(t);
    for (const m of aiCells) {
      const { ri, ci, x } = m.userData;
      const vis = t >= T38 - EPS && ri === L.row && ci < L.n;
      m.visible = vis;
      if (!vis) continue;
      m.position.set(x, Y(AI.y) + shift, 0);
      m.material.uniforms.dissolve.value = ri === 1 ? smooth(211.0, 213.6, t) * 1.12 : 0;
    }
    draw(scene, cam, target, clear);
    draw(aiScene, cam, target, false);
    if (cursorOn(t)) {
      const n = L.returned ? 0 : L.n;
      const x0 = AI.x + AI.cell * n;
      cursor.material.uniforms.rect.value.set(x0, 508, x0 + 24, 572);
      draw(overlay, ortho, target, false);
    }
  }

  // S37 has motionBlur 4 (timeline). Only 185–188 should be blurred: outside it every sub-frame is
  // snapped to the frame time and memoised (identical image), so the 4 sub-frames cost one render.
  const cacheRT = makeRT(W, H, { depth: false });
  const blit = new FSQ(new T.ShaderMaterial({ uniforms: { tex: { value: cacheRT.texture } }, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tex; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb, 1.0); }` }));
  let cacheKey = null;

  return {
    render(shot, f) {
      const t = f.t;
      if (shot.id === 'S37' && !(t >= 185.0 && t < 188.0)) {
        const ts = Math.round(t * 24) / 24;
        if (cacheKey !== ts) { renderAt(ts, cacheRT, true); cacheKey = ts; }
        const ac = renderer.autoClear; renderer.autoClear = false; blit.render(renderer, f.target); renderer.autoClear = ac;
      } else renderAt(t, f.target, false);
      renderer.setRenderTarget(f.target);
    },
    post(shot, f) {
      if (shot.id === 'S37') return { bloom: 0.85, streak: 0.22 };
      return { bloom: 0.8, streak: 0.28 };
    },
  };
}
