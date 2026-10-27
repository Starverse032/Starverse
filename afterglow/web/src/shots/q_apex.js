// q_apex — the apex of the film (v2).
//   S37 = S08-e 汇聚 [4416, 4584)  50 mm, a slight pull-back that settles at f4512 (= S38's frame).
//        The sea flows (S01's spiral law r = r0 (1 − u)², θ = θ0 + 10u³, re-timed so every word
//        spends its last 1.2 s within 30 px of its place) into THREE human questions, left edge
//        x 722, facing the dark on the right:
//          QB  Is anyone there?  italic 500 84 px Cormorant, pale gold, centre y 210, lands f4500
//          QA  「有人吗？」          600 108 px Noto Serif CJK SC, AMBER, centre y 320, lands f4488
//          QC  「هل يوجد أحد هنا؟」  80 px Noto Naskh Arabic, deep orange, centre y 430, lands f4512
//        Each line = a solid ink plane (stroke HDR 0.40 / 0.40 / 0.25, + a wide dim halo) that
//        appears exactly where its words have landed (one arrival field drives both), carrying
//        ≈ 1500–2500 real-sentence glyphs of 6–9 px in its strokes as texture. A cloud of short
//        multilingual questions (6–9 px, ≤ 0.3 of QA) around them; the R row (y 540) left of
//        x 1300 stays empty; ≈ 700 words fly to P_ans = (1520, 540), amber → CURSOR white by their
//        own flight progress, and gather into the cursor's shape by f4583.
//   S38 = S09 长镜头 C [4584, 5184)  locked. Frame-exact per q_apex/state.js:
//        f4584 the cursor is solid at P_ans · 4656/4664/4672 「我在。」 at P_ans · 4704–4727 QA
//        replaced char by char (？→我 吗→。 人→在 有→我) · 4728–4751 QB squeezed (× 0.18, ASH) by a
//        pushed-in 「我在。我在」 · 4752–4775 QC covered by a white 「我在。我在。」 bar · 4776–4823 the
//        cloud flips to white mono 我/在 · rewritten glyphs follow the cursor's square wave ·
//        4848 / 4872 / 4896 deleting 。/ 在 / 我 gives back QC / QB / QA (shape, place, colour,
//        breathing) · 4920–4991 three silent blinks · 4992–5039 the cursor walks to R
//        (inOutSine, analytic blur) · 5040/5064/5088/5112 「有人吗？」 · 5160 return, all up 110 px.
//        The cursor's ±160 px streak is masked to 0 over the strokes of its own row (V2 mask B),
//        its bloom fades out over them (G), and the AI's strokes feed no bloom (R).
//
// World space = 1080p pixel space on the plane z = 0 (X = px − 960, Y = 540 − py); the 50 mm camera
// sits at the focal distance FPX50, so 1 unit = 1 px.
import * as THREE from 'three';
import { getWeb, sampleWebPoints, webPathPose } from './_webgraph.js';
import { getLexicon, assertFonts, PAL, hexLin, glyphMesh, hash1, rng } from './w_sea/lexicon.js';
import { textTextures, textPlane, squash, inkBox, inkMask, gridInk, randInk, maskRectMaterial } from './q_apex/text.js';
import { KF, aiState, cursorPos, cursorOn, qaChar, qbState, qcState, cloudFrac, syncGain, surge, scrollAt, clamp, sstep, outCubic } from './q_apex/state.js';

const T37 = 184, T38 = 191;
const FPX50 = 960 / (18 / 50);
const X = px => px - 960, Y = py => 540 - py;
const MONO = '"Noto Sans Mono CJK SC"';
const luma = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const atLevel = (lin, L) => lin.map(v => v * L / luma(lin));     // linear colour with luma L

// breathing: dominant frequency per the screenplay (QA 0.25, QB 0.20, QC 0.31 Hz), with a weaker
// overtone; phases chosen so the three lines are uncorrelated over S08-e.2 (|r| ≈ 0.17)
const BR = [
  { f: 0.25, p: [1.679, 1.57], m: 2.056 },
  { f: 0.20, p: [6.145, 1.393], m: 2.141 },
  { f: 0.31, p: [2.795, 1.464], m: 1.66 },
];
const breath = (i, t) => { const b = BR[i], x = 2 * Math.PI * b.f * (t - 188); return 0.72 * Math.sin(x + b.p[0]) + 0.28 * Math.sin(x * b.m + b.p[1]); };

// a smooth deterministic value noise (for the arrival field)
const hh = (i, j) => hash1((i * 7919 + j * 104729) & 0x7fffffff, 9);
const vnoise = (x, y) => {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (hh(i, j) * (1 - sx) + hh(i + 1, j) * sx) * (1 - sy) + (hh(i, j + 1) * (1 - sx) + hh(i + 1, j + 1) * sx) * sy;
};

export async function create(ctx) {
  const { THREE: T, renderer, W, H, kit, makeRT, FSQ } = ctx;
  const P38 = ctx.timeline.shots.find(s => s.id === 'S38')?.params || {};
  const LQ = [
    { id: 'QA', text: '有人吗？', font: '600 108px "Noto Serif CJK SC"', color: '#FFB36B', y: 320, hdr: 0.33, rtl: false, land: [185.95, 187.0] },
    { id: 'QB', text: 'Is anyone there?', font: 'italic 500 84px "Cormorant Garamond"', color: '#F2C98A', y: 210, hdr: 0.31, rtl: false, land: [186.4, 187.5] },
    { id: 'QC', text: 'هل يوجد أحد هنا؟', font: '400 80px "Noto Naskh Arabic"', color: '#FF9A5C', y: 430, hdr: 0.20, rtl: true, land: [186.85, 188.0] },
  ];
  for (const L of LQ) { const p = P38[L.id]; if (p) { L.text = p.text || L.text; L.font = p.font || L.font; L.color = p.color || L.color; L.y = p.y || L.y; L.hdrSpec = p.strokeHDR; } }
  await assertFonts([
    [LQ[0].font, '有人吗？'], [LQ[1].font, 'Is anyone there'], [LQ[2].font, 'هل يوجد أحد هنا'],
    [`400 64px ${MONO}`, '我在。有人吗？'],
  ]);
  const lex = getLexicon();
  const r = rng(55 * 37 + 2);
  const CUR_LIN = PAL.CURSOR, ASH_LIN = PAL.ASH;
  const AIW = CUR_LIN.map(v => 0.4 * v + 0.6 * luma(CUR_LIN));   // AI white, a touch more neutral (S ≤ 0.06 after ACES)
  const AI_COL = atLevel(AIW, 0.31);            // AI strokes: neutral white, HDR 0.40

  // =========================================================================================
  // Layout of the three lines (1080p px)
  const LX = 722;
  for (const L of LQ) {
    const b = inkBox(L.text, L.font, { rtl: L.rtl });
    L.baseline = Math.round((L.y - (b.top + b.bottom) / 2) * 2) / 2;
    L.adv = b.adv; L.x0 = LX; L.x1 = LX + b.adv; L.inkL = LX + b.left; L.inkR = LX + b.right;
    L.top = L.baseline + b.top; L.bottom = L.baseline + b.bottom;
    L.rect = [LX - 40, L.top - 34, Math.ceil(L.x1) + 40, L.bottom + 34];
    L.lin = hexLin(L.color); L.col = atLevel(L.lin, L.hdr);
    console.log(`WARN q_apex: ${L.id} ink x ${L.inkL.toFixed(0)}–${L.inkR.toFixed(0)} y ${L.top.toFixed(0)}–${L.bottom.toFixed(0)}`);
  }
  const [QA, QB, QC] = LQ;
  // arrival field g ∈ [0, 1] (left → right with noise): the ink of a pixel appears when the words
  // aimed at it land; the words' landing times are drawn from the same field
  const arrG = (L, px, py) => clamp(0.72 * (L.rtl ? L.inkR - px : px - L.inkL) / Math.max(1, L.inkR - L.inkL) + 0.28 * vnoise(px / 34, py / 34) - 0.06, 0, 1);   // in reading order
  const arrTex = (L, rect) => {
    const nx = 96, ny = 24, d = new Uint8Array(nx * ny * 4);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const px = rect[0] + (i + 0.5) / nx * (rect[2] - rect[0]), py = rect[3] - (j + 0.5) / ny * (rect[3] - rect[1]);
      const g = Math.round(255 * arrG(L, px, py)); d.set([g, g, g, 255], 4 * (j * nx + i));
    }
    const tx = new T.DataTexture(d, nx, ny, T.RGBAFormat); tx.minFilter = tx.magFilter = T.LinearFilter; tx.needsUpdate = true;
    return tx;
  };

  // =========================================================================================
  // Text planes
  const planeScene = new T.Scene();
  const mk = (items, rect, opts = {}) => { const tx = textTextures(items, rect, { halo: opts.halo ?? 9 }); const m = textPlane(tx, opts); planeScene.add(m); return m; };
  // QA: one plane per character (each one turns over on its own frame)
  const qaAdv = []; { let x = LX; for (const ch of Array.from(QA.text)) { const b = inkBox(ch, QA.font); qaAdv.push([x, b.adv]); x += b.adv; } }
  QA.cells = qaAdv;
  const qaPlanes = Array.from(QA.text).map((ch, c) => {
    const [x, a] = qaAdv[c], rect = [x - 34, QA.rect[1], x + a + 34, QA.rect[3]];
    const m = mk([{ text: ch, font: QA.font, x, baseline: QA.baseline }], rect, { arr: arrTex(QA, rect), arrT: QA.land });
    m.userData.cell = [x, a]; return m;
  });
  const monoAt = (text, size, x, yc) => {
    const font = `400 ${size}px ${MONO}`, b = inkBox('我在', font);
    return { text, font, x, baseline: yc - (b.top + b.bottom) / 2 };
  };
  // the white mono glyphs that replace QA's (same size, same cells): ？→我 吗→。 人→在 有→我
  const QA_REPL = ['我', '在', '。', '我'];
  const qaWhite = QA_REPL.map((ch, c) => {
    const [x, a] = qaAdv[c], adv = inkBox(ch, `400 108px ${MONO}`).adv;
    const it = monoAt(ch, 108, x + (a - adv) / 2, QA.y);
    return mk([it], [x - 34, QA.rect[1], x + a + 34, QA.rect[3]]);
  });
  const qbPlane = mk([{ text: QB.text, font: QB.font, x: LX, baseline: QB.baseline }], QB.rect, { arr: arrTex(QB, QB.rect), arrT: QB.land });
  const QB_WHITE = ['我', '在', '。', '我', '在'];
  const qbWhite = QB_WHITE.map(ch => {
    const it = monoAt(ch, 84, 0, QB.y), adv = inkBox(ch, it.font).adv; it.x = (84 - adv) / 2;
    const m = mk([it], [-30, QB.rect[1], 84 + 30, QB.rect[3]]);
    m.userData.cx0 = m.userData.cx; return m;      // positioned per frame: cell left edge + 42
  });
  const qcPlane = mk([{ text: QC.text, font: QC.font, x: LX, baseline: QC.baseline, rtl: true }], QC.rect, { arr: arrTex(QC, QC.rect), arrT: QC.land });
  const QC_BAR = '我在。我在。';
  const qcBar = mk([monoAt(QC_BAR, 80, 0, QC.y)], [-30, QC.rect[1], 480 + 30, QC.rect[3]]);
  // the AI's own glyphs: 「我在。」 at P_ans, 「有人吗？」 on the R row
  const aiGlyph = (ch, x) => { const it = monoAt(ch, 64, x, 540), adv = inkBox(ch, it.font).adv; it.x = x + (64 - adv) / 2; return mk([it], [x - 26, 476, x + 64 + 26, 604], { halo: 8 }); };
  const ansPlanes = ['我', '在', '。'].map((ch, k) => aiGlyph(ch, 1508 + 64 * k));
  const qPlanes = ['有', '人', '吗', '？'].map((ch, k) => aiGlyph(ch, 722 + 64 * k));
  for (const m of [...ansPlanes, ...qPlanes]) m.material.uniforms.haloGain.value = 0.14;

  // =========================================================================================
  // The glyph field: the words that land in the lines, the cloud, the cursor's words, the drain
  const N_MICRO = [1800, 1500, 1500], N_DUST = 1800, N_CUR = 700, N_DRAIN = 7000;
  const groups = [];   // { kind, pts: [[px, py]], line }
  const masks = LQ.map(L => inkMask([{ text: L.text, font: L.font, x: LX, baseline: L.baseline, rtl: L.rtl }],
    [Math.floor(L.rect[0]), Math.floor(L.rect[1]), Math.ceil(L.rect[2] - L.rect[0]), Math.ceil(L.rect[3] - L.rect[1])]));
  LQ.forEach((L, li) => {
    const M = masks[li], sp = Math.sqrt(M.ink / N_MICRO[li]);
    groups.push({ kind: li, pts: gridInk(M, sp, r, 0.5, 0.7), line: li });
    groups.push({ kind: 3 + li, pts: randInk(M, N_DUST, r, 0.45), line: li });
    console.log(`WARN q_apex: ${L.id} ink ${M.ink.toFixed(0)} px², micro ${groups[groups.length - 2].pts.length}`);
  });
  // the cloud: short real questions laid out in rows (6–9 px), around the three lines
  const cloud = [];
  {
    const rc = rng(55 * 37 + 11);
    const pool = lex.sentences.filter(s => s.v.kind === 'question' && s.sea.length && !['code', 'morse'].includes(s.v.lang));
    const GSCR = new Set(['zh', 'ja', 'xsux', 'egy', 'gmy', 'phn', 'peo', 'runr', 'sga', 'glag', 'tfng', 'chr', 'iu']);
    const RTLS = new Set(['ar', 'fa', 'ur', 'he', 'syr', 'phn']);
    const excl = [[700, QB.top - 22, QB.inkR + 26, QB.bottom + 20], [700, QA.top - 20, QA.inkR + 26, QA.bottom + 20],
      [700, QC.top - 20, QC.inkR + 26, QC.bottom + 22], [0, 496, 1320, 584]];
    const hit = (x0, y0, x1, y1) => excl.some(e => x1 > e[0] && x0 < e[2] && y1 > e[1] && y0 < e[3]);
    let y = 154, si = 0;
    while (y < 636) {
      const em = 6 + 3 * rc(), rowH = em * 1.45;
      let x = 60 + 30 * rc();
      while (x < 1300) {
        const s = pool[Math.floor(hash1(si++, 77) * pool.length)];
        const gap = GSCR.has(s.v.lang) ? 0.08 * em : 0.32 * em;
        const ws = s.sea.map(k => lex.rowAspect(k) * em * 1.6 * 0.86);
        const len = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
        const yc = y + rowH / 2;
        // soft edges: density falls off towards the cloud's border, so it is never a rectangle
        const ex = sstep(60, 260, x) * (1 - sstep(1080, 1300, x + len)), ey = sstep(150, 230, yc) * (1 - sstep(560, 640, yc));
        if (x + len < 1300 && !hit(x, yc - em, x + len, yc + em) && rc() < 0.25 + 0.65 * ex * ey) {
          const toks = RTLS.has(s.v.lang) ? s.sea.map((k, i) => [k, ws[i]]).reverse() : s.sea.map((k, i) => [k, ws[i]]);
          let cx = x;
          for (const [k, w] of toks) { cloud.push([cx + w / 2, yc, k, em]); cx += w + gap; }
          x += len + (10 + 26 * rc());
        } else x += 14 + 40 * rc();
      }
      y += rowH + 2 + 4 * rc();
    }
    groups.push({ kind: 6, pts: cloud.map(c => [c[0], c[1]]), toks: cloud });
    const dust = []; for (let i = 0; i < 2600; i++) { const c = cloud[Math.floor(rc() * cloud.length)]; dust.push([c[0] + (rc() - 0.5) * 30, c[1] + (rc() - 0.5) * 12]); }
    groups.push({ kind: 9, pts: dust });
    console.log(`WARN q_apex: cloud ${cloud.length} glyphs`);
  }
  const curPts = []; for (let i = 0; i < N_CUR; i++) curPts.push([1508 + 1 + 22 * r(), 508 + 1 + 62 * r()]);
  groups.push({ kind: 7, pts: curPts });
  const drainPts = []; for (let i = 0; i < N_DRAIN; i++) { const li = i % 3; const p = randInk(masks[li], 1, r, 0.3)[0]; if (p) drainPts.push(p); }
  groups.push({ kind: 8, pts: drainPts });

  // start positions: a patch of the word-web (same graph), seen from beyond WEB_PATH(9)
  const web = getWeb();
  const P9 = webPathPose(9);
  const C0 = P9.pos.clone().addScaledVector(P9.forward, 34);
  const wp = sampleWebPoints(web, 260000, 37);
  const starts = [];
  for (let i = 0; i < wp.count && starts.length < 80000; i++) {
    const dx = wp.pos[3 * i] - C0.x, dy = wp.pos[3 * i + 1] - C0.y, dz = wp.pos[3 * i + 2] - C0.z;
    const lx = (dx * P9.right.x + dy * P9.right.y + dz * P9.right.z) * 52;
    const ly = (dx * P9.up.x + dy * P9.up.y + dz * P9.up.z) * 52;
    const lz = -(dx * P9.forward.x + dy * P9.forward.y + dz * P9.forward.z) * 52;
    if (Math.abs(lx) > 3400 || Math.abs(ly) > 2000 || lz > 1500 || lz < -5200) continue;
    starts.push([lx, ly, lz]);
  }
  const CEN = [X(1000), Y(380)];
  const ang = (x, y) => Math.atan2(y - CEN[1], x - CEN[0]);
  const total = groups.reduce((s, g) => s + g.pts.length, 0);
  const iPos = new Float32Array(total * 3), iC = new Float32Array(total * 4), iB = new Float32Array(total * 4), iA = new Float32Array(total * 4);
  const iRect = new Float32Array(total * 4), iRect2 = new Float32Array(total * 4), iCol = new Float32Array(total * 3);
  const sorted = starts.map((s, i) => [ang(s[0], s[1]), i]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
  // the sentence stream (graphemes of real sentences, interleaved across scripts)
  const byLang = new Map();
  for (const s of lex.sentences) if (s.glyphs.length && !['morse', 'code'].includes(s.v.lang)) { if (!byLang.has(s.v.lang)) byLang.set(s.v.lang, []); byLang.get(s.v.lang).push(s); }
  const langs = [...byLang.keys()].sort((a, b) => hash1(a.charCodeAt(0) * 31 + (a.charCodeAt(1) || 0) * 7 + a.length, 5) - hash1(b.charCodeAt(0) * 31 + (b.charCodeAt(1) || 0) * 7 + b.length, 5));
  const stream = [];
  for (let k = 0; stream.length < 16000; k++) { const L = byLang.get(langs[k % langs.length]); stream.push(...L[Math.floor(k / langs.length) % L.length].glyphs); }
  const amberVar = h => { const c = [[1.0, 0.40, 0.11], PAL.AMBER, [1.0, 0.56, 0.22]]; const k = h * 2, i = Math.min(1, Math.floor(k)), f = k - i; return c[i].map((v, j) => v + (c[i + 1][j] - v) * f); };
  const seaShort = lex.sea.filter(k => lex.rowAspect(k) < 3);
  let o = 0, si = 0, maxD = 0;
  for (const G of groups) {
    const n = G.pts.length, step = sorted.length / n;
    const S = []; for (let k = 0; k < n; k++) S.push(starts[sorted[Math.floor((k * step + si * 0.37) % sorted.length)]]);
    si++;
    const tIdx = G.pts.map((p, k) => [ang(X(p[0]), Y(p[1])), k]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
    for (let k = 0; k < n; k++) {
      const pk = tIdx[k], p = G.pts[pk], s = S[k], i = o + k;
      const tx = X(p[0]), ty = Y(p[1]);
      iPos.set([tx, ty, 1], 3 * i);
      const dd = Math.hypot(s[0] - tx, s[1] - ty, s[2] * 0.5); maxD = Math.max(maxD, dd);
      iC.set([s[0], s[1], s[2], dd], 4 * i);
      const tg = G.kind < 6 ? masks[G.line].tangent(p[0], p[1]) : [1, 0];
      iB.set([tg[0], tg[1], G.kind, 0], 4 * i);
      const h1 = r(), h2 = r();
      let tok, em, b, col = amberVar(r());
      if (G.kind < 3) {                       // the words of a line: 6–9 px landed
        tok = stream[(pk * 7 + G.kind * 977) % stream.length]; em = 6 + 3 * r(); b = 0.55 * Math.exp(0.25 * r.gauss());
        col = LQ[G.kind].lin.map((v, j) => 0.8 * v + 0.2 * col[j]);
      } else if (G.kind < 6) { tok = stream[Math.floor(r() * stream.length)]; em = 1.4 + 0.5 * r(); b = 0.4 * Math.exp(0.3 * r.gauss()); col = LQ[G.kind - 3].lin; }
      else if (G.kind === 6) { tok = G.toks[pk][2]; em = G.toks[pk][3]; b = 0.5 * Math.exp(0.25 * r.gauss()); }
      else if (G.kind === 9) { tok = seaShort[Math.floor(r() * seaShort.length)]; em = 1.2 + 0.5 * r(); b = 0.25 * Math.exp(0.4 * r.gauss()); }
      else if (G.kind === 7) { tok = seaShort[Math.floor(r() * seaShort.length)]; em = 2.0 + 0.5 * r(); b = 0.55; }
      else { tok = seaShort[Math.floor(r() * seaShort.length)]; em = 4 + 4 * r(); b = Math.min(8, 1.1 * Math.exp(0.8 * r.gauss())); }
      // two spiral arms in the start offsets — brighter words trace the arms (flight only)
      if (G.kind !== 7) {
        const a0 = Math.atan2(s[1] - CEN[1], s[0] - CEN[0]), r0 = Math.hypot(s[0] - CEN[0], s[1] - CEN[1]) + 60;
        const arm = Math.pow(0.5 + 0.5 * Math.cos(2 * a0 - 2.4 * Math.log(r0 / 300)), 2.5);
        if (G.kind === 8) b *= 0.35 + 1.6 * arm; else iPos[3 * i + 2] = 0.35 + 1.6 * arm;
      }
      iRect.set(lex.rects.subarray(tok * 4, tok * 4 + 4), 4 * i);
      const mono = h2 < 0.5 ? lex.mono['我'] : lex.mono['在'];
      iRect2.set(lex.rects.subarray(mono * 4, mono * 4 + 4), 4 * i);
      iA.set([em * 1.6, b, h1, h2], 4 * i);
      iCol.set(col, 3 * i);
    }
    o += n;
  }
  // timing: landing time from the line's arrival field (lines), spread over the last seconds (cloud),
  // f4493–4550 for the cursor's words; departures ≥ 2.2 s before landing, near first
  {
    let a = 0;
    for (const G of groups) {
      const n = G.pts.length;
      for (let k = 0; k < n; k++) {
        const i = a + k, px = iPos[3 * i] + 960, py = 540 - iPos[3 * i + 1];
        const dn = Math.min(1, iC[4 * i + 3] / maxD), h = iA[4 * i + 2];
        let te;
        if (G.kind < 6) { const L = LQ[G.kind % 3]; te = L.land[0] + (L.land[1] - L.land[0]) * arrG(L, px, py) - 0.02; }
        else if (G.kind === 6 || G.kind === 9) te = 186.3 + 1.7 * clamp(0.6 * h + 0.4 * (1 - Math.abs(py - 400) / 260));
        else if (G.kind === 7) te = 187.2 + 2.4 * h;
        else te = Math.min(188.0, 186.4 + 1.45 * dn + 0.15 * h);
        let ts = T37 + 0.15 + 0.75 * dn + 0.25 * iA[4 * i + 3];
        if (G.kind !== 8) ts = Math.max(T37 + 0.1, Math.min(ts, te - 2.2));
        iC[4 * i + 3] = ts; iB[4 * i + 3] = te;
      }
      a += n;
    }
  }
  const HOPTS = {
    streak: 28,
    uniforms: {
      uShift: { value: 0 }, uSurge: { value: 1 }, uSync: { value: 1 }, uMicro: { value: 0.16 }, uDustLvl: { value: 0.12 },
      uBr: { value: new T.Vector3(1, 1, 1) }, uLive: { value: new T.Vector3(1, 1, 1) }, uQAsx: { value: new T.Vector4(1, 1, 1, 1) },
      uQB: { value: new T.Vector2(1, 0) }, uQC: { value: new T.Vector2(1, 0) }, uCloudF: { value: 0 }, uCloudGain: { value: 0.5 },
      uAsh: { value: new T.Vector3(...ASH_LIN) }, uCur: { value: new T.Vector3(...CUR_LIN) },
    },
    header: /* glsl */ `uniform float uShift, uSurge, uSync, uMicro, uDustLvl, uCloudF, uCloudGain; uniform vec3 uBr, uLive, uAsh, uCur; uniform vec4 uQAsx; uniform vec2 uQB, uQC;`,
    vertexBody: /* glsl */ `
      float kind = iB.z, ts = iC.w, te = iB.w, F = time * 24.0;
      float s0 = clamp((time - ts) / max(1e-3, te - ts), 0.0, 1.0);
      vec2 off = iC.xy - iPos.xy;
      float u;
      if (kind < 7.5 || kind > 8.5) {
        // spiral law re-timed in two C¹ pieces: the flight brings the word to ≈ 30 px of its place
        // 1.2 s before it lands; the last 1.2 s close those 30 px with an ease-out (≤ 7 px/frame)
        float r0 = length(vec3(off, iC.z));
        float ua = clamp(1.0 - sqrt(30.0 / max(r0, 31.0)), 0.0, 0.985);
        float f = clamp(1.2 / max(1e-3, te - ts), 0.2, 0.7);
        float m1 = min(2.5 * ua, 2.0 * (1.0 - ua) * (1.0 - f) / f);
        if (s0 < 1.0 - f) { float x = s0 / (1.0 - f); u = (3.0 * x * x - 2.0 * x * x * x) * ua + (x * x * x - x * x) * m1; }
        else { float x = (s0 - (1.0 - f)) / f; u = ua + (1.0 - ua) * (1.0 - (1.0 - x) * (1.0 - x)); }
      } else u = s0 * s0 * (3.0 - 2.0 * s0);
      float k1 = (1.0 - u) * (1.0 - u), phi = 10.0 * u * u * u;
      float cph = cos(phi), sph = sin(phi);
      p = vec3(iPos.xy + vec2(cph * off.x - sph * off.y, sph * off.x + cph * off.y) * k1, iC.z * k1);
      // flight size: 10–16 px for the words of the lines, shrinking to 6–9 px only in the last 0.5 s
      float fl = kind < 2.5 ? 0.75 : kind < 5.5 ? 1.2 : kind < 6.5 ? 0.7 : kind < 7.5 ? 2.6 : kind < 8.5 ? 0.0 : 1.0;
      hW *= 1.0 + fl * (1.0 - smoothstep(te - 0.5, te, time));
      float landed = smoothstep(0.92, 1.0, u);
      if (kind < 7.5 || kind > 8.5) b *= mix(iPos.z, 1.0, smoothstep(0.55, 1.0, u));
      float px = iPos.x + 960.0;
      if (kind < 5.5) {
        float L = kind < 2.5 ? kind : kind - 3.0;
        b *= mix(1.0, kind < 2.5 ? uMicro : uDustLvl, landed);
        float br = L < 0.5 ? uBr.x : (L < 1.5 ? uBr.y : uBr.z);
        float lv = L < 0.5 ? uLive.x : (L < 1.5 ? uLive.y : uLive.z);
        float fq = L < 0.5 ? 0.25 : (L < 1.5 ? 0.20 : 0.31);
        b *= mix(1.0, br, landed);
        p.xy += iB.xy * 2.5 * sin(6.28318 * fq * time + 6.28318 * iA.w) * landed * lv;   // ≤ 0.2 px/frame along the stroke
        if (L < 0.5) {
          float c = clamp(floor((px - 722.0) / 108.0), 0.0, 3.0);
          float sxc = c < 0.5 ? uQAsx.x : (c < 1.5 ? uQAsx.y : (c < 2.5 ? uQAsx.z : uQAsx.w));
          float cx = 722.0 + 108.0 * c + 54.0 - 960.0;
          p.x = cx + (p.x - cx) * sxc; sx = max(sxc, 0.06); b *= step(0.001, sxc);
        } else if (L < 1.5) {
          p.x = -238.0 + (p.x + 238.0) * uQB.x; sx = max(uQB.x, 0.06);
          col = mix(col, uAsh, uQB.y); b *= mix(1.0, 0.3 * uSync, uQB.y);
        } else {
          col = mix(col, uAsh, uQC.y); b *= uQC.x * mix(1.0, uSync, uQC.y);
        }
        b *= uSurge;
      } else if (kind < 6.5) {
        // the cloud: flips (4 frames, by hash) to white mono 我 / 在 f4776–4823 and back with the
        // three deletions (30 % / 70 % / all, a small ripple from the answer position)
        float tF = 4776.0 + 46.0 * iA.z;
        float rip = 6.0 * length(iPos.xy - vec2(560.0, 0.0)) / 1600.0;
        float tB = (iA.w < 0.3 ? 4848.0 : (iA.w < 0.7 ? 4872.0 : 4896.0)) + rip;
        float fA = clamp((F - tF) / 4.0, 0.0, 1.0), fB = clamp((F - tB) / 4.0, 0.0, 1.0);
        sel = step(0.5, fA) * (1.0 - step(0.5, fB));
        if (fA > 0.0 && fA < 1.0) sx = max(0.06, abs(cos(3.14159 * fA)));
        if (fB > 0.0 && fB < 1.0) sx = max(0.06, abs(cos(3.14159 * fB)));
        col = mix(col, uCur * 0.9, sel);
        b *= uCloudGain * mix(1.0, uSync, sel);
        b *= 1.0 + 0.15 * sin(6.28318 * (0.13 + 0.22 * iA.z) * time + 6.28318 * iA.w) * landed * (1.0 - sel);
        b *= uSurge;
      } else if (kind < 7.5) {
        // the cursor's words: amber, whitening with their own flight; condensing into the block
        col = mix(col, uCur, smoothstep(0.15, 0.85, s0));
        b *= (1.0 + 1.2 * smoothstep(4540.0, 4583.0, F)) * (1.0 - step(4583.5, F));
      } else if (kind < 8.5) {
        b *= 1.0 - smoothstep(0.78, 0.995, u);
        b *= smoothstep(220.0, 760.0, length(vec3(off, iC.z)) * k1);
      } else {
        col = mix(col, uAsh, uCloudF);
        b *= uCloudGain * mix(1.0, 0.45, uCloudF) * mix(1.0, uSync, uCloudF) * uSurge;
      }
      p.y += uShift;
      if (uShift > 0.0) b *= smoothstep(128.0, 178.0, 540.0 - p.y);`,
  };
  // the words of the lines and the cloud (large in flight) as quads; everything else as points
  // reorder so that quads (kinds 0–2, 6) come first
  const order = [], isQuad = k => k < 2.5 || k === 6;
  for (let i = 0; i < total; i++) if (isQuad(iB[4 * i + 2])) order.push(i);
  const nQ = order.length;
  for (let i = 0; i < total; i++) if (!isQuad(iB[4 * i + 2])) order.push(i);
  const perm = (A, sz) => { const out = new Float32Array(A.length); order.forEach((i, k) => out.set(A.subarray(sz * i, sz * i + sz), sz * k)); return out; };
  const ord = { iPos: perm(iPos, 3), iRect: perm(iRect, 4), iRect2: perm(iRect2, 4), iA: perm(iA, 4), iB: perm(iB, 4), iC: perm(iC, 4), iCol: perm(iCol, 3) };
  const subO = (lo, hi) => ({ iPos: ord.iPos.subarray(3 * lo, 3 * hi), iRect: ord.iRect.subarray(4 * lo, 4 * hi), iRect2: ord.iRect2.subarray(4 * lo, 4 * hi), iA: ord.iA.subarray(4 * lo, 4 * hi), iB: ord.iB.subarray(4 * lo, 4 * hi), iC: ord.iC.subarray(4 * lo, 4 * hi), iCol: ord.iCol.subarray(3 * lo, 3 * hi) });
  const fieldQ = glyphMesh(nQ, subO(0, nQ), { ...HOPTS, points: false });
  const fieldP = glyphMesh(total - nQ, subO(nQ, total), { ...HOPTS, points: true });
  fieldP.material.uniforms = fieldQ.material.uniforms;
  const HU = fieldQ.material.uniforms;
  HU.res.value.set(W, H); HU.minPx.value = 1.0; HU.capPx.value = [700, 900]; HU.nearFade.value = [60, 300];
  const field = new T.Group(); field.add(fieldQ); field.add(fieldP);
  // the drain (kind 8) is not drawn once it has been absorbed: it is the tail of the point list
  let nDrainP = 0; for (let k = nQ; k < total; k++) if (ord.iB[4 * k + 2] === 8) nDrainP++;
  // points: sort the drain to the end
  {
    const g = fieldP.geometry, n = total - nQ, idx = [];
    for (let k = 0; k < n; k++) if (ord.iB[4 * (nQ + k) + 2] !== 8) idx.push(k);
    for (let k = 0; k < n; k++) if (ord.iB[4 * (nQ + k) + 2] === 8) idx.push(k);
    for (const name of ['iPos', 'iRect', 'iRect2', 'iA', 'iB', 'iC', 'iCol']) {
      const a = g.getAttribute(name), sz = a.itemSize, src = a.array.slice();
      idx.forEach((s, d) => a.array.set(src.subarray(sz * s, sz * s + sz), sz * d)); a.needsUpdate = true;
    }
  }
  const nPointsNoDrain = total - nQ - nDrainP;

  // =========================================================================================
  // The AI question dissolving into micro mono glyphs that breathe with QA (f5112 on)
  const AM = inkMask(['有', '人', '吗', '？'].map((ch, k) => { const it = monoAt(ch, 64, 722 + 64 * k, 540); it.x = 722 + 64 * k + (64 - inkBox(ch, it.font).adv) / 2; return it; }), [712, 500, 280, 80]);
  const ra = rng(55 * 38 + 3);
  const micro = gridInk(AM, Math.sqrt(AM.ink / 700), ra, 0.5);
  const mN = Math.min(micro.length, 900), adust = randInk(AM, 5000, ra, 0.45), an = mN + adust.length;
  const aPos = new Float32Array(an * 3), aA = new Float32Array(an * 4), aB = new Float32Array(an * 4), aRect = new Float32Array(an * 4), aCol = new Float32Array(an * 3);
  const monoOf = ['有', '人', '吗'].map(ch => lex.mono[ch]);
  for (let i = 0; i < an; i++) {
    const isM = i < mN, p = isM ? micro[i] : adust[i - mN];
    aPos.set([X(p[0]), Y(p[1]), 0], 3 * i);
    const ci = Math.min(3, Math.max(0, Math.floor((p[0] - 722) / 64)));
    const tok = ci < 3 ? monoOf[ci] : monoOf[Math.floor(ra() * 3)];
    aRect.set(lex.rects.subarray(tok * 4, tok * 4 + 4), 4 * i);
    aA.set([(isM ? 4 + 2 * ra() : 1.3 + 0.4 * ra()) * 1.6, isM ? 0.2 : 0.05, ra(), ra()], 4 * i);
    const tg = AM.tangent(p[0], p[1]);
    aB.set([tg[0], tg[1], isM ? 0 : 1, KF.question[3] / 24 + 1.4 * ra()], 4 * i);
    aCol.set(AIW, 3 * i);
  }
  const aiField = glyphMesh(an, { iPos: aPos, iRect: aRect, iA: aA, iB: aB, iCol: aCol }, {
    uniforms: { uShift: { value: 0 }, uBrA: { value: 1 }, uLiveA: { value: 0 } },
    header: /* glsl */ `uniform float uShift, uBrA, uLiveA;`,
    vertexBody: /* glsl */ `
      float appear = smoothstep(iB.w, iB.w + 0.3, time);
      float ph = iPos.x * 0.011 + iA.w * 1.1;
      b *= appear * mix(1.0, uBrA, uLiveA);
      p.xy += iB.xy * 2.5 * sin(6.28318 * 0.25 * time + 0.7 * ph + 3.0 * iA.z) * uLiveA;
      p.y += uShift;
      if (uShift > 0.0) b *= smoothstep(128.0, 178.0, 540.0 - p.y);`,
  });
  const AU = aiField.material.uniforms;
  AU.res.value.set(W, H); AU.minPx.value = 1.0; AU.capPx.value = [700, 900]; AU.nearFade.value = [60, 300];

  const scene = new T.Scene(); scene.add(field); scene.add(aiField);

  // =========================================================================================
  // The cursor block (screen space): HDR 2.0, exact pixels; analytic box blur while it moves
  const curMat = new T.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { xa: { value: 0 }, xb: { value: 0 }, y0: { value: 508 }, col: { value: new T.Vector3(...CUR_LIN.map(v => v * 2.0)) }, rect: { value: new T.Vector4() } },
    vertexShader: /* glsl */ `uniform vec4 rect; varying vec2 vPx; void main(){ vec2 c = position.xy * 0.5 + 0.5;
      vPx = mix(rect.xy, rect.zw, vec2(c.x, 1.0 - c.y)); gl_Position = vec4(vPx.x / 960.0 - 1.0, 1.0 - vPx.y / 540.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float xa, xb, y0; uniform vec3 col; varying vec2 vPx;
      void main(){
        if (vPx.y < y0 || vPx.y >= y0 + 64.0) discard;
        float x = vPx.x, cov;
        float lo = min(xa, xb), hi = max(xa, xb);
        if (hi - lo < 0.01) cov = step(xa, x) * step(x, xa + 24.0);
        else cov = max(0.0, min(x, hi) - max(x - 24.0, lo)) / (hi - lo);   // time the pixel spends inside the block
        if (cov <= 0.0) discard;
        gl_FragColor = vec4(col * cov, 1.0); }`,
  });
  const curMesh = new T.Mesh(new T.PlaneGeometry(2, 2), curMat); curMesh.frustumCulled = false;
  const overlay = new T.Scene(); overlay.add(curMesh);
  const ortho = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // V2 mask rectangles
  const maskScene = new T.Scene(), maskRects = [];
  for (let i = 0; i < 4; i++) { const m = new T.Mesh(new T.PlaneGeometry(2, 2), maskRectMaterial()); m.frustumCulled = false; maskScene.add(m); maskRects.push(m); }
  const cam = kit.filmCamera(W, H, { focalMM: 50, near: 10, far: 20000 });

  const draw = (sc, camera, target, clear) => {
    const ac = renderer.autoClear; renderer.autoClear = !!clear;
    renderer.setRenderTarget(target); renderer.render(sc, camera); renderer.autoClear = ac;
  };
  const setCol = (m, c, k = 1) => m.material.uniforms.col.value.set(c[0] * k, c[1] * k, c[2] * k);
  const mixC = (a, b, k) => a.map((v, j) => v + (b[j] - v) * k);

  function renderAt(t, target, clear, mask) {
    const F = t * 24;
    const D = FPX50 * (1 - 0.075 * (1 - outCubic((t - T37) / 4)));
    cam.position.set(0, 0, D); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
    const shift = scrollAt(F), sync = syncGain(F), sg = surge(F);
    // --- states
    const live0 = sstep(QA.land[1] - 0.2, 188.4, t);   // breathing begins once a line has landed
    const qa = [0, 1, 2, 3].map(c => qaChar(F, c));
    const qb = qbState(F), qc = qcState(F), cf = cloudFrac(F);
    const qaLive = qa.reduce((s, c) => s + (c.orig >= 0.999 ? 0.25 : 0), 0);
    const liveA = live0 * qaLive, liveB = sstep(QB.land[1] - 0.2, 188.4, t) * qb.live, liveC = sstep(QC.land[1] - 0.2, 188.6, t) * qc.live;
    const brA = 1 + 0.12 * liveA * breath(0, t), brB = 1 + 0.12 * liveB * breath(1, t), brC = 1 + 0.12 * liveC * breath(2, t);
    // --- glyph field
    HU.time.value = t; HU.focus.value = D; HU.aperture.value = 5;
    HU.shutter.value = (t > 184.6 && t < 188.4) ? 0.3 / 24 : 0;
    const mk2 = sstep(186.2, 187.2, t);
    HU.moteRange.value = [6.5 + (-2 - 6.5) * mk2, 12 + (-1 - 12) * mk2];
    HU.uShift.value = shift; HU.uSync.value = sync; HU.uSurge.value = sg; HU.uCloudF.value = cf;
    HU.uBr.value.set(brA, brB, brC); HU.uLive.value.set(liveA, liveB, liveC);
    HU.uQAsx.value.set(qa[0].orig, qa[1].orig, qa[2].orig, qa[3].orig);
    HU.uQB.value.set(qb.sx, qb.ash); HU.uQC.value.set(qc.dim, qc.ash);
    fieldP.geometry.setDrawRange(0, t > 188.05 ? nPointsNoDrain : total - nQ);
    // --- planes: the three lines
    for (const m of planeScene.children) { m.material.uniforms.time.value = t; m.visible = false; }
    if (t > QA.land[0] - 0.3) {
      qaPlanes.forEach((m, c) => {
        const [x, a] = m.userData.cell; squash(m, qa[c].orig, x + a / 2, shift);
        setCol(m, QA.col, brA * sg);
      });
      qaWhite.forEach((m, c) => {
        const [x, a] = qaPlanes[c].userData.cell; squash(m, qa[c].white, x + a / 2, shift);
        setCol(m, atLevel(AIW, 0.31), sync * sg);
      });
      // QB: squeezed about its left edge, greying; the white chain pushed in from the right end
      squash(qbPlane, qb.sx, LX, shift);
      setCol(qbPlane, mixC(QB.col, atLevel(ASH_LIN, 0.11), qb.ash), brB * sg * (qb.ash > 0 ? 1 + (sync - 1) * qb.ash : 1));
      const fadeTop = shift > 0 ? sstep(128, 182, QB.y - shift) : 1;
      qbPlane.material.uniforms.alpha.value = fadeTop;
      qbWhite.forEach((m, k) => {
        const xL = qb.left + 84 * k, emerge = clamp((1232 - xL) / 34);
        if (emerge <= 0 || qb.whiteA <= 0) return;
        m.visible = true; m.scale.x = 1;
        m.position.set(X(xL + 42) + (m.userData.cx0 - 42), Y(m.userData.cy) + shift, 0);
        m.material.uniforms.alpha.value = emerge * qb.whiteA * fadeTop;
        m.material.uniforms.dissolve.value = qb.whiteDis;
        setCol(m, atLevel(AIW, 0.31), sync * sg);
      });
      // QC: dimmed and grey under the bar
      qcPlane.visible = true; qcPlane.position.y = Y(qcPlane.userData.cy) + shift;
      setCol(qcPlane, mixC(QC.col, atLevel(ASH_LIN, 0.25), qc.ash), qc.dim * brC * sg * (1 + (sync - 1) * qc.ash));
      if (qc.barA > 0 && qc.dis < 1) {
        qcBar.visible = true;
        qcBar.position.set(X(qc.x0 + 240) + (qcBar.userData.cx - 240), Y(qcBar.userData.cy) + shift, 0);
        qcBar.material.uniforms.alpha.value = qc.barA; qcBar.material.uniforms.dissolve.value = qc.dis;
        setCol(qcBar, atLevel(AIW, 0.31), sync * sg);
      }
    }
    // --- the AI's glyphs
    const ai = aiState(F);
    ansPlanes.forEach((m, k) => { m.visible = k < ai.ans; setCol(m, AI_COL); });
    const liveQ = sstep(KF.question[3] / 24 + 0.3, KF.question[3] / 24 + 2.0, t);
    const dissolveQ = sstep(KF.question[3] / 24, KF.question[3] / 24 + 1.6, t) * 0.82;
    qPlanes.forEach((m, k) => {
      m.visible = k < ai.q; m.position.y = Y(m.userData.cy) + shift;
      setCol(m, AI_COL, 1 + 0.12 * breath(0, t) * liveQ);
      m.material.uniforms.dissolve.value = dissolveQ;
    });
    AU.time.value = t; AU.focus.value = D; AU.aperture.value = 0; AU.uShift.value = shift;
    AU.uBrA.value = 1 + 0.12 * breath(0, t); AU.uLiveA.value = liveQ;
    aiField.visible = F >= KF.question[3];
    draw(scene, cam, target, clear);
    draw(planeScene, cam, target, false);
    // --- the cursor
    if (cursorOn(F)) {
      const moving = F > KF.move[0] && F < KF.move[1] - 1;
      const c = cursorPos(F), ca = moving ? cursorPos(F - 0.25) : c, cb = moving ? cursorPos(F + 0.25) : c;
      curMat.uniforms.xa.value = ca.x; curMat.uniforms.xb.value = cb.x; curMat.uniforms.y0.value = c.y;
      curMat.uniforms.rect.value.set(Math.min(ca.x, cb.x) - 1, c.y, Math.max(ca.x, cb.x) + 25, c.y + 64);
      draw(overlay, ortho, target, false);
    }
    // --- V2 mask: the strokes of the cursor's own row receive no streak (B) and fade out its bloom
    // (G); the AI's strokes feed no bloom (R)
    if (mask) {
      for (const m of maskRects) m.visible = false;
      let k = 0;
      const row = (x0, x1, y0) => {
        if (x1 <= x0) return;
        const m1 = maskRects[k++]; m1.visible = true;
        m1.material.uniforms.rect.value.set(x0, y0 - 6, x1, y0 + 70); m1.material.uniforms.feather.value.set(3, 6); m1.material.uniforms.rgb.value.set(1, 0, 1);
        const m2 = maskRects[k++]; m2.visible = true;
        m2.material.uniforms.rect.value.set(x0 + 6, y0, x1 - 6, y0 + 64); m2.material.uniforms.feather.value.set(16, 14); m2.material.uniforms.rgb.value.set(0, 1, 0);
      };
      if (ai.ans > 0) row(1508, 1508 + 64 * ai.ans, 508);
      if (ai.q > 0) row(722, 722 + 64 * ai.q, 508 - shift);
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.setRenderTarget(mask); renderer.render(maskScene, ortho);
      renderer.autoClear = ac;
    }
  }

  // S37 has motionBlur 4 (timeline): every sub-frame is snapped to the frame time and memoised (one
  // render); the blur is analytic along each word's own spiral (lexicon.js streak).
  const cacheRT = makeRT(W, H, { depth: false });
  const blit = new FSQ(new T.ShaderMaterial({ uniforms: { tex: { value: cacheRT.texture } }, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tex; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb, 1.0); }` }));
  let cacheKey = null;
  const POST = { bloom: 0.75, bloomRadius: 0.8, streak: 0.2 };

  return {
    bloomMask: f => f.shot.id === 'S38',
    render(shot, f) {
      const t = f.t;
      if (shot.id === 'S37') {
        const ts = Math.round(t * 24) / 24;
        if (cacheKey !== ts) { renderAt(ts, cacheRT, true, null); cacheKey = ts; }
        const ac = renderer.autoClear; renderer.autoClear = false; blit.render(renderer, f.target); renderer.autoClear = ac;
      } else renderAt(t, f.target, false, f.mask && f.sub === 0 ? f.mask : null);
      renderer.setRenderTarget(f.target);
    },
    post() { return POST; },
  };
}
