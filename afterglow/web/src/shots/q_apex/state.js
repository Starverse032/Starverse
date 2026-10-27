// q_apex — the climax as pure functions of the frame number F (float; frame = t × 24).
// All event frames are the screenplay's (S08-e, S09-a … S09-h) and timeline.json S38.params.
export const KF = {
  S37: 4416, S38: 4584, END: 5184,
  answer: [4656, 4664, 4672],
  coverQA: { start: [4722, 4716, 4710, 4704], restore: [4896, 4899, 4902, 4905] },   // per char 有 人 吗 ？
  coverQB: [4728, 4752], coverQC: [4752, 4776], cloud: [4776, 4824],
  del: [4848, 4872, 4896],
  move: [4992, 5040],
  question: [5040, 5064, 5088, 5112],
  ret: 5160, scroll: 110,
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const outCubic = x => 1 - Math.pow(1 - clamp(x), 3);
const inOutSine = x => -(Math.cos(Math.PI * clamp(x)) - 1) / 2;
export { clamp, sstep, outCubic, inOutSine };

// --- the AI's own line --------------------------------------------------------------------
export function aiState(F) {
  let ans = 0;
  if (F >= 4656) ans = 1; if (F >= 4664) ans = 2; if (F >= 4672) ans = 3;
  if (F >= 4848) ans = 2; if (F >= 4872) ans = 1; if (F >= 4896) ans = 0;
  let q = 0;
  for (let k = 0; k < 4; k++) if (F >= KF.question[k]) q = k + 1;
  return { ans, q, returned: F >= KF.ret };
}
export const scrollAt = F => (F >= KF.ret ? KF.scroll * outCubic((F - KF.ret) / 6) : 0);

// cursor block top-left (1080p px) — P_ans row until the move, then the R row
export function cursorPos(F) {
  const { ans, q, returned } = aiState(F);
  if (F < KF.move[0]) return { x: 1508 + 64 * ans, y: 508 };
  if (F < KF.move[1]) return { x: 1508 - 786 * inOutSine((F - KF.move[0]) / 47), y: 508 };   // f5039 at x 722
  if (!returned) return { x: 722 + 64 * q, y: 508 };
  return { x: 722, y: 508 + KF.scroll - scrollAt(F) };
}
// steady (no blink) while typing, deleting, moving and after the return; else the 60 BPM square wave
const STEADY = [[4656, 4680], [4848, 4908], [4992, 5136], [5160, 5200]];
export function cursorOn(F) {
  if (F < KF.S38) return false;
  const f = Math.floor(F + 1e-6);
  for (const [a, b] of STEADY) if (f >= a && f < b) return true;
  return (f % 24) < 12;
}

// --- QA 「有人吗？」 replaced char by char -------------------------------------------------------
// per char: orig x-scale (0 = hidden), white x-scale (0 = hidden). 4 frames squash, 4 frames open.
export function qaChar(F, c) {
  const tc = KF.coverQA.start[c], tr = KF.coverQA.restore[c];
  const q = Math.PI / 2;
  if (F < tc) return { orig: 1, white: 0 };
  if (F < tc + 4) return { orig: Math.cos(q * (F - tc) / 4), white: 0 };
  if (F < tc + 8) return { orig: 0, white: Math.sin(q * (F - tc - 4) / 4) };
  if (F < tr) return { orig: 0, white: 1 };
  if (F < tr + 4) return { orig: 0, white: Math.cos(q * (F - tr) / 4) };
  if (F < tr + 8) return { orig: Math.sin(q * (F - tr - 4) / 4), white: 0 };
  return { orig: 1, white: 0 };
}
export const qaCovered = F => { let k = 0; for (let c = 0; c < 4; c++) k += qaChar(F, c).orig < 0.999 ? 0.25 : 0; return k; };

// --- QB *Is anyone there?* squeezed: white 「我在。我在」 pushed in from the right end ----------
// returns the left edge of the white chain (1232 → 814), the English x-scale, ash amount, white alpha
export function qbState(F) {
  const [a] = KF.coverQB, step = 24 / 5;
  let P = 0;
  for (let k = 0; k < 5; k++) P += sstep(a + step * k, a + step * (k + 1), F) / 5;
  let whiteA = 1, whiteDis = 0, sx;
  const back = KF.del[1];
  if (F >= back) {
    // f4872: the white chars dissipate in 8 frames, the English re-opens × 0.18 → × 1 in 12
    whiteDis = clamp((F - back) / 8);
    const u = outCubic((F - back) / 12);
    sx = 0.18 + (1 - 0.18) * u;
    const left = 722 + 510 * 0.18;
    return { left, sx, ash: 1 - u, whiteA: 1 - whiteDis * whiteDis, whiteDis, P: 1 - u, live: u };
  }
  const left = 1232 - 418 * P;
  sx = (left - 722) / 510;
  return { left, sx, ash: sstep(0, 0.6, P), whiteA, whiteDis, P, live: 1 - sstep(0, 0.5, P) };
}

// --- QC (Arabic) covered by a white bar 「我在。我在。」 ------------------------------------------
export function qcState(F) {
  const [a] = KF.coverQC, back = KF.del[0];
  if (F < a) return { x0: 1322, barA: 0, dim: 1, ash: 0, dis: 0, live: 1 };
  if (F < back) {
    const u = outCubic((F - a) / 24);
    const cov = sstep(0.15, 0.9, u);
    return { x0: 762 + 560 * (1 - u), barA: sstep(a, a + 6, F), dim: 1 - 0.85 * cov, ash: cov, dis: 0, live: 1 - cov };
  }
  // f4848: the bar backs off to the right and evaporates in 12 frames
  const u = clamp((F - back) / 12);
  return { x0: 762 + 150 * u * u, barA: 1, dim: 0.15 + 0.85 * sstep(0, 1, u), ash: 1 - sstep(0, 1, u), dis: u, live: sstep(0.2, 1, u) };
}

// --- cloud / dust assimilation fraction (for the sync weight and dust grey) ------------------
export function cloudFrac(F) {
  let f = clamp((F - KF.cloud[0]) / (KF.cloud[1] - KF.cloud[0]));
  const back = [[KF.del[0], 0.3], [KF.del[1], 0.7], [KF.del[2], 1.0]];
  let prev = 0;
  for (const [tb, h] of back) { f = Math.max(0, f - (h - prev) * clamp((F - tb) / 8)); prev = h; }
  return f;
}
// sync: the rewritten glyphs follow the cursor's square wave (on 100 %, off 80 %)
export const syncGain = F => (cursorOn(F) ? 1.0 : 0.8);
// f4896: the whole asking side surges to 1.15, back to 1.0 before f4944
export const surge = F => 1 + 0.15 * sstep(KF.del[2], KF.del[2] + 3, F) * (1 - sstep(KF.del[2] + 4, 4944, F));
