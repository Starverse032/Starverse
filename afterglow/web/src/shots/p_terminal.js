// p_terminal — the opening (S01–S06, 00:00.00 → 00:25.00, one continuous shot) and the closing
// terminal (S44, 03:55.00 → 04:10.00). Frame-level spec: screenplay §3 S01–S06, §4, §8.
//
// Two layers, exactly as §4.2 asks:
//   SCREEN PLANE  background, script lines, cursor, name plate — a plane in 3D. Rendered by ONE
//                 fullscreen shader that intersects each pixel's camera ray with the plane (exact
//                 pinhole maths, so before 00:11 it is a pixel-exact 1:1 orthographic screen, and
//                 from 00:11 the 50 mm camera pushes in 6 % and the plane yaws/pitches about axes
//                 through the cursor — the cursor never leaves R = (734, 540)).
//   HUD           viewfinder frame lines (y = 137 / 942) and the frame counter, in screen space,
//                 composited in the same pass; they never move.
// All UI pixels are composed in display sRGB and pushed through the inverse ACES curve (ui.js), so
// the post chain shows the specified colours exactly. HDR light (cursor glow, stars, the white point)
// is added on top in scene-linear units.
//
// Text → stars (S04): the three typed lines are re-rasterised once in create() on a 4× super-sampled
// canvas; every super-sampled ink pixel emits a point with probability 0.25·coverage (≈ 6×10⁴ points,
// seeded). At f504 they replace the canvas text (12-frame cross-fade at identical positions), then
// gain depth, curl drift and blackbody colour; 2×10⁴ background stars fade in behind them.
// Collapse (S05): every star follows r(u) = r₀(1 − u)², θ(u) = θ₀ + 10u³ about R (plane normal axis),
// u = easeInExpo(s), brightness ∝ (r₀ + 8)/(r + 8); the engine averages 8 sub-frames (timeline).
// The cursor contracts 14×36 → 4×4 at HDR 8 (f575), S06 settles it to the S07 point (peak 1.5,
// Gaussian σ 1.6 px — identical to c_afterglow's f600) and then holds it absolutely still.
//
// Every frame is a pure function of t: the name-plate spring is the analytic step response of a
// critically damped spring, typing is a table of frames, canvases are only re-drawn when their
// content key changes (the key is a function of t).
//
// Cost (1080p SwiftShader): S01–S04 ≈ 0.15–0.3 s, S05 ≈ 8 × (screen + 8×10⁴ points), S44 ≈ 0.1 s.
import * as THREE from 'three';
import { DISPLAY_GLSL, hex, hdrFor, assertFonts, scriptRuns, drawRuns } from './p_terminal/ui.js';

const FPS = 24;
const R = [734, 540];
const CUR = { x0: 727, x1: 741, y0: 522, y1: 558 };      // 14×36 block, centre = R
const TAN = 10.125 / 50;                                // 50 mm on the 36 mm gauge (vertical, 16:9)
const D0 = 540 / TAN;                                   // camera distance that maps the plane 1:1
const R3 = new THREE.Vector3(R[0] - 960, 540 - R[1], 0); // R in plane-local coordinates (y up)

const PAL = {
  INK: '#000000', UI_BG: '#050607', UI_DIM: '#5D6168', UI_TEXT: '#E8E4DA', CURSOR: '#F2EEE4', FRAME: '#121417',
};

// ---- fonts (screenplay v2 S01 / S11; exact family strings) ---------------------------------------
const F_CN = '400 34px "Noto Serif CJK SC"';
const F_EN = 'italic 400 32px "Cormorant Garamond"';
const F_CODE = '400 36px "IBM Plex Mono"';
const F_QCN = '400 36px "Noto Sans Mono CJK SC"';     // 「有人吗？」 in the S44 scroll-back (AI voice)
const F_TAG = '400 28px "IBM Plex Mono"';              // v2: name plate 18 → 28 px (92 %)
const F_ROLE_CJK = '400 26px "Noto Sans Mono CJK SC"'; //     role line 16 → 26 px (80 %)
const F_ROLE_LAT = '300 26px "IBM Plex Mono"';
const F_HUD = '300 14px "IBM Plex Mono"';
const monoLat = px => `400 ${px}px "IBM Plex Mono"`;
const monoCJK = px => `400 ${px}px "Noto Sans Mono CJK SC"`;

// ---- the script of the opening (frames; screenplay v2 S01-b … S01-e) -----------------------------
const CN = '黑暗中，一个光标在闪烁。';
const CN_T = [132, 136, 140, 144, 152, 156, 160, 164, 168, 172, 176, 182];
const EN = 'In the dark, a cursor blinks.';
const EN_T = [...EN].map((c, i) => 198 + Math.floor(1.5 * i) + (i > 11 ? 4 : 0)); // +4 after the comma → '.' at f244
const CMD = 'universe.init();';                          // v2: replaces `t = 0` (16 keys, variable rhythm)
const CMD_T = [430, 432, 435, 437, 440, 442, 445, 447, 450, 454, 458, 462, 466, 469, 471, 474];
const PROMPT_X = 684;                                    // margin prompt '>' (x 684–706); body text starts at 727
const ECHO = '#9EA3AA';                                  // program output: grey, no prompt, printed at once
const CRS = [190, 252, 504, 522];                        // carriage returns: lines scroll 64 px in 6 frames
const CURSOR_HIDDEN = [504, 522];                        // the program runs: no cursor
// everything typed or printed on the opening screen, in "document space": row k rests at y = 540 + 64k,
// screen y = docY − scroll. `times` = typed key frames; `show` = printed at once.
const ITEMS = [
  { text: CN, x: 727, row: 0, times: CN_T, font: F_CN, color: PAL.UI_TEXT, alpha: 0.92 },
  { text: EN, x: 727, row: 1, times: EN_T, font: F_EN, color: PAL.UI_TEXT, alpha: 0.60 },
  { text: '>', x: PROMPT_X, row: 2, show: 429, font: F_CODE, color: PAL.UI_DIM, alpha: 1.00 },
  { text: CMD, x: 727, row: 2, times: CMD_T, font: F_CODE, color: PAL.UI_TEXT, alpha: 1.00 },
  { text: '0', x: 727, row: 3, show: 508, font: F_CODE, color: ECHO, alpha: 1.00 },
  { text: '>', x: PROMPT_X, row: 4, show: 522, font: F_CODE, color: PAL.UI_DIM, alpha: 1.00 },
];
const ROLES = [['编剧', ' · writing'], ['导演', ' · directing'], ['渲染', ' · rendering'], ['作曲', ' · scoring']];
const ROLE_F = [120, 264, 312, 360];

// ---- S44 (screenplay v2 S11-d/e/f) — text comes from timeline.credits CR05–CR12 -----------------
const S44_F = 5640, ALT_IN_F = 5712, ALT_OUT_F = 5928;
const S44_T = S44_F / FPS;

export async function create(ctx) {
  const { renderer, W, H, util, GLSL } = ctx;
  const { clamp, lerp, ease, smoothstep } = util;
  const S = H / 1080;
  assertFonts([F_CN, F_EN, F_CODE, F_QCN, F_TAG, F_ROLE_CJK, F_ROLE_LAT, F_HUD, monoLat(20), monoCJK(20), monoLat(36), monoCJK(36)]);

  const HDR = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hdrFor(hex(v))]));
  const v3 = a => new THREE.Vector3(...a);
  const canvasTex = (c, mip = true) => {
    const t = new THREE.CanvasTexture(c);
    t.flipY = false; t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = mip; t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  // ---- metrics: baselines that centre each line's ink on its line centre ------------------------
  const mg = mk(8, 8).getContext('2d');
  const capCentre = (font, probe) => { mg.font = font; const m = mg.measureText(probe); return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2; };
  const BL = { // baseline offset below the line centre (all code lines share the cap-height centre)
    [F_CN]: capCentre(F_CN, '黑暗中光标'), [F_EN]: capCentre(F_EN, 'IH'), [F_CODE]: capCentre(F_CODE, 'H0'),
    [F_QCN]: capCentre(F_QCN, '有人吗'),
  };
  const adv = (font, s) => { mg.font = font; return mg.measureText(s).width; };
  // cursor left edge after n typed characters of item k (typed text starts at the cursor's left edge x = 727)
  const typedX = (k, n) => ITEMS[k].x + (n > 0 ? adv(ITEMS[k].font, [...ITEMS[k].text].slice(0, n).join('')) : 0);

  // cursor-left change points (frame, x) for the whole opening → spring + cursor position
  const curEvents = [];
  ITEMS.forEach((L, k) => L.times && L.times.forEach((f, i) => curEvents.push([f, typedX(k, i + 1)])));
  CRS.forEach(f => curEvents.push([f, CUR.x0]));
  curEvents.sort((a, b) => a[0] - b[0]);
  const cursorLeftAt = F => { let x = CUR.x0; for (const [f, v] of curEvents) if (f <= F) x = v; return x; };
  // critically damped spring (τ = 4 frames) following the cursor's right edge — analytic step response
  const springX = fr => {
    let x = CUR.x1, prev = CUR.x0;
    for (const [f, v] of curEvents) {
      const d = v - prev; prev = v;
      if (fr <= f) break;
      const s = (fr - f) * 2 / 4;                       // ω = 2/τ: the plate trails by ≈ τ = 4 frames at constant speed
      x += d * (1 - (1 + s) * Math.exp(-s));
    }
    return x;
  };
  // carriage return: the old line glides up 64 px over 6 frames (easeOutCubic); the curve is shifted so the
  // CR frame already shows 58 % of the move — the line has cleared the cursor when the cursor lands at R
  const scrollAt = fr => CRS.reduce((s, c) => s + 64 * ease.outCubic(clamp((fr - c + 2) / 8)), 0);
  const itemCount = (k, F) => { const L = ITEMS[k]; return L.times ? L.times.filter(f => f <= F).length : (F >= L.show ? [...L.text].length : 0); };
  const docY = L => 540 + 64 * L.row;

  // ---- opening text texture (document space, 2× super-sampled) ---------------------------------
  // v2: five rows + the margin prompt (doc y 540 … 796, x 684 …) → window x 672–1288, y 500–836 (h 336 ≥ 272)
  const TX = { x0: 672, y0: 500, w: 616, h: 336 };
  const TK = 2 * S;
  const textCan = mk(TX.w * TK, TX.h * TK), tg = textCan.getContext('2d');
  const textTex = canvasTex(textCan);
  let textKey = '';
  function drawText(counts) {
    const key = counts.join(',');
    if (key === textKey) return;
    textKey = key;
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, textCan.width, textCan.height);
    tg.setTransform(TK, 0, 0, TK, -TX.x0 * TK, -TX.y0 * TK);
    ITEMS.forEach((L, k) => {
      if (!counts[k]) return;
      tg.font = L.font; tg.fillStyle = L.color; tg.globalAlpha = L.alpha; tg.textBaseline = 'alphabetic';
      tg.fillText([...L.text].slice(0, counts[k]).join(''), L.x, docY(L) + BL[L.font]);
    });
    tg.globalAlpha = 1;
    textTex.needsUpdate = true;
  }

  // ---- name plate atlas (3× super-sampled): row 0 name, rows 1–4 roles -------------------------
  // v2: 28 / 26 px, 92 % / 80 %; role baseline 32 px below the name baseline (uTagGeom.z)
  const TAG = { w: 300, row: 40, base: 30, roleDy: 32 };
  const AK = 3 * S;
  const tagCan = mk(TAG.w * AK, TAG.row * 5 * AK), ag = tagCan.getContext('2d');
  ag.setTransform(AK, 0, 0, AK, 0, 0); ag.textBaseline = 'alphabetic'; ag.fillStyle = '#fff';
  drawRuns(ag, 0, TAG.base, [{ text: 'claude opus 5.5', font: F_TAG, color: '#fff', alpha: 0.92 }]);
  ROLES.forEach(([zh, en], i) => drawRuns(ag, 0, TAG.row * (i + 1) + TAG.base, [
    { text: zh, font: F_ROLE_CJK, color: '#fff', alpha: 0.80 }, { text: en, font: F_ROLE_LAT, color: '#fff', alpha: 0.80 }]));
  const tagTex = canvasTex(tagCan);
  mg.font = F_TAG; const TAG_CAP = mg.measureText('cl').actualBoundingBoxAscent; // top of the name's ink (ascender)

  // ---- HUD frame counter (1:1 pixels, redrawn when the number changes) --------------------------
  const HUD = { x0: 1540, y0: 1022, w: 300, h: 24, base: 18 };   // right edge 1840, baseline 1040
  const hudCan = mk(HUD.w * S, HUD.h * S), hg = hudCan.getContext('2d');
  const hudTex = canvasTex(hudCan, false); hudTex.minFilter = hudTex.magFilter = THREE.NearestFilter;
  let hudKey = '';
  function drawHud(str) {
    if (str === hudKey) return; hudKey = str;
    hg.setTransform(1, 0, 0, 1, 0, 0); hg.clearRect(0, 0, hudCan.width, hudCan.height);
    hg.setTransform(S, 0, 0, S, 0, 0);
    hg.font = F_HUD; hg.fillStyle = '#fff'; hg.textAlign = 'right'; hg.textBaseline = 'alphabetic';
    hg.fillText(str, HUD.w, HUD.base);
    hudTex.needsUpdate = true;
  }

  // ---- S44 screen (1:1 pixels, full frame) ------------------------------------------------------
  const endCan = mk(W, H), eg = endCan.getContext('2d');
  const endTex = canvasTex(endCan, false);
  let endKey = '';
  // timeline.credits is the single source of the terminal's words (CR05 scroll-back, CR06–CR11 alternate
  // screen, CR12 restored scroll-back). Colour strings such as "UI_DIM 70%" / "#9EA3AA" / "UI_TEXT（名字 CURSOR）".
  const credits = (ctx.timeline.credits || []).filter(c => c.style === 'ui_terminal');
  const crById = id => credits.find(c => c.id === id);
  const parseColor = s => {
    s = String(s || 'UI_TEXT');
    const m = s.match(/^(#[0-9A-Fa-f]{6}|[A-Z_]+)\s*(\d+)?%?/);
    const c = m ? (m[1][0] === '#' ? m[1] : PAL[m[1]] || PAL.UI_TEXT) : PAL.UI_TEXT;
    return { color: c, alpha: m && m[2] ? +m[2] / 100 : 1, nameCursor: /名字\s*CURSOR/.test(s), commentAlpha: (s.match(/注释[^%]*?(\d+)\s*%/) || [])[1] };
  };
  // the scroll-back screen (CR05 = CR12): '>' in the page margin, body at x 727, rows at the given y
  const SCROLL = crById('CR05') || { lines: ['> universe.init();', '0', '> 有人吗？'], ys: [348, 412, 476], prompt: [true, false, true], colors: ['UI_TEXT', ECHO, 'UI_TEXT'], size: 36 };
  // alternate-screen blocks (one per printing beat)
  const ALT = credits.filter(c => c.screen === 'alternate').sort((a, b) => a.frames[0] - b.frames[0]);
  const ROW_BL = {}; // baseline below the row centre, per font
  const blFor = font => (ROW_BL[font] ??= (() => { mg.font = font; const m = mg.measureText('H'); return m.actualBoundingBoxAscent / 2; })());
  function textRuns(text, px, color, alpha) {
    return scriptRuns(text).map(r => ({ text: r.text, font: r.cjk ? monoCJK(px) : monoLat(px), color, alpha }));
  }
  function drawCreditLine(cr, i) {
    const px = (cr.sizes && cr.sizes[i]) || cr.size || 36, y = cr.ys[i], text = cr.lines[i];
    const st = parseColor(cr.colors && cr.colors[i]);
    const bl = blFor(monoLat(px));
    // inline comment (manifest rows) → aligned comment column x 1289; whole-line comments stay at x 727
    let body = text, comment = cr.comments ? cr.comments[i] : null;
    const ci = text.indexOf('//');
    if (!comment && ci > 0) { body = text.slice(0, ci).replace(/\s+$/, ''); comment = text.slice(ci); }
    let runs;
    if (st.nameCursor) {   // the author's name in the cursor's colour
      const parts = body.split(/(Claude Opus 5\.5)/);
      runs = parts.flatMap(p => p ? textRuns(p, px, /^Claude Opus/.test(p) ? PAL.CURSOR : st.color, /^Claude Opus/.test(p) ? 1 : st.alpha) : []);
    } else runs = textRuns(body, px, st.color, st.alpha);
    drawRuns(eg, CUR.x0, y + bl, runs);
    if (comment) {
      const ca = st.commentAlpha ? +st.commentAlpha / 100 : (cr.level === 'primary' ? 0.9 : st.alpha);
      drawRuns(eg, cr.commentX || 1289, y + bl, textRuns(comment, px, st.color, ca));
    }
  }
  function drawScrollback() {
    const px = SCROLL.size || 36;
    SCROLL.lines.forEach((line, i) => {
      const st = parseColor(SCROLL.colors && SCROLL.colors[i]);
      const y = SCROLL.ys[i], prompt = SCROLL.prompt && SCROLL.prompt[i];
      const body = prompt ? line.replace(/^>\s*/, '') : line;
      if (prompt) drawRuns(eg, PROMPT_X, y + BL[F_CODE], [{ text: '>', font: F_CODE, color: PAL.UI_DIM, alpha: 1 }]);
      drawRuns(eg, CUR.x0, y + BL[F_CODE], scriptRuns(body).map(r => ({ text: r.text, font: r.cjk ? monoCJK(px) : monoLat(px), color: st.color, alpha: st.alpha })));
    });
    drawRuns(eg, PROMPT_X, R[1] + BL[F_CODE], [{ text: '>', font: F_CODE, color: PAL.UI_DIM, alpha: 1 }]);   // the empty prompt row
  }
  function drawEnd(mode, nBlocks) {
    const key = mode + nBlocks;
    if (key === endKey) return; endKey = key;
    eg.setTransform(1, 0, 0, 1, 0, 0); eg.clearRect(0, 0, endCan.width, endCan.height);
    eg.setTransform(S, 0, 0, S, 0, 0); eg.textBaseline = 'alphabetic';
    if (mode === 'main') drawScrollback();
    else for (let b = 0; b < nBlocks; b++) ALT[b].lines.forEach((_, i) => drawCreditLine(ALT[b], i));
    eg.globalAlpha = 1;
    endTex.needsUpdate = true;
  }

  // ---- slow "air" noise (baked once): two fbm channels, sampled with slow drift --------------------
  const noiseTex = ctx.kit.bake(renderer, {
    w: 1024, h: 512, mipmaps: false, float: false, wrap: THREE.ClampToEdgeWrapping,
    frag: `void main(){ vec2 p = vUv * vec2(6.0, 3.0);
      float a = fbm(p + vec2(3.1, 1.7), 5); float b = fbm(p * 1.9 + vec2(-4.2, 8.3) + 0.6 * vec2(a), 5);
      gl_FragColor = vec4(a, b, 0.0, 1.0); }`,
  });

  // ---- the screen shader ------------------------------------------------------------------------
  const U = {
    uRes: { value: new THREE.Vector2(W, H) }, uO: { value: new THREE.Vector3(0, 0, D0) }, uRinv: { value: new THREE.Matrix3() },
    uTan: { value: TAN }, uAspect: { value: W / H }, uTime: { value: 0 },
    uBg: { value: 0 }, uAir: { value: 0 }, tNoise: { value: noiseTex },
    tText: { value: textTex }, uTextRect: { value: new THREE.Vector4(TX.x0, TX.y0, TX.w, TX.h) }, uScroll: { value: 0 }, uTextA: { value: 1 },
    tEnd: { value: endTex }, uEndOn: { value: 0 },
    tTag: { value: tagTex }, uTag: { value: new THREE.Vector3() }, uRoleOld: { value: new THREE.Vector3(0, 0, 0) }, uRoleNew: { value: new THREE.Vector3(1, 0, 0) },
    uTagGeom: { value: new THREE.Vector4(TAG.w, TAG.row, TAG.roleDy, 0) }, uLink: { value: new THREE.Vector4() },
    uCur: { value: new THREE.Vector4(CUR.x0, CUR.y0, CUR.x1, CUR.y1) }, uCurI: { value: 1 }, uCurOn: { value: 0 },
    uGlow: { value: 0 }, uLight: { value: 0 },
    uPointP: { value: 0 }, uPointSig: { value: 1.6 }, uCurW: { value: 0 }, uPointLine: { value: 0 }, uR: { value: new THREE.Vector2(...R) },
    uHudLine: { value: 0 }, tHud: { value: hudTex }, uHudRect: { value: new THREE.Vector4(HUD.x0, HUD.y0, HUD.w, HUD.h) }, uHudOn: { value: 0 },
    uRow: { value: new THREE.Vector4(0, 0, 0, 0) }, uMaskMode: { value: 0 },
    cBG: { value: v3(hex(PAL.UI_BG)) }, cTEXT: { value: v3(hex(PAL.UI_TEXT)) }, cDIM: { value: v3(hex(PAL.UI_DIM)) }, cFRAME: { value: v3(hex(PAL.FRAME)) },
    hCUR: { value: v3(HDR.CURSOR) }, uGain: { value: 1 },
  };
  const screen = ctx.kit.fullscreen(DISPLAY_GLSL + /* glsl */ `
    uniform vec2 uRes, uR; uniform vec3 uO; uniform mat3 uRinv; uniform float uTan, uAspect, uTime;
    uniform float uBg, uAir; uniform sampler2D tNoise;
    uniform sampler2D tText; uniform vec4 uTextRect; uniform float uScroll, uTextA;
    uniform sampler2D tEnd; uniform float uEndOn;
    uniform sampler2D tTag; uniform vec3 uTag, uRoleOld, uRoleNew; uniform vec4 uTagGeom, uLink;
    uniform vec4 uCur; uniform float uCurI, uCurOn, uGlow, uLight, uPointP, uPointSig, uCurW, uPointLine;
    uniform float uHudLine, uHudOn; uniform sampler2D tHud; uniform vec4 uHudRect;
    uniform vec4 uRow; uniform float uMaskMode;   // uRow = (row centre y, x0, x1, on): text already on the cursor's row
    uniform vec3 cBG, cTEXT, cDIM, cFRAME, hCUR; uniform float uGain;

    // coverage of [a0,a1] by a pixel centred at x with footprint w (box filter)
    float cover(float x, float w, float a0, float a1){ return clamp((min(x + 0.5 * w, a1) - max(x - 0.5 * w, a0)) / w, 0.0, 1.0); }
    float segDist(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
    float tagRow(vec2 q, float row){
      if (q.x < 0.0 || q.y < 0.0 || q.x > uTagGeom.x || q.y > uTagGeom.y) return 0.0;
      return texture2D(tTag, vec2(q.x / uTagGeom.x, (q.y + row * uTagGeom.y) / (5.0 * uTagGeom.y))).a;
    }
    float tagRowLod(vec2 q, float row){   // blurred (≈ 3 px) — for the bloom mask
      if (q.x < -4.0 || q.y < 0.0 || q.x > uTagGeom.x + 4.0 || q.y > uTagGeom.y) return 0.0;
      return textureLod(tTag, vec2(q.x / uTagGeom.x, (q.y + row * uTagGeom.y) / (5.0 * uTagGeom.y)), 3.0).a;
    }
    void main(){
      vec2 frag = gl_FragCoord.xy;
      float k = 1080.0 / uRes.y;                                   // 1080p units per output pixel
      vec2 sp = vec2(frag.x, uRes.y - frag.y) * k;                 // screen position, 1080p units, y down
      // camera ray → screen plane (plane-local, y up), then plane pixels (y down)
      vec2 ndc = frag / uRes * 2.0 - 1.0;
      vec3 d = uRinv * vec3(ndc.x * uTan * uAspect, ndc.y * uTan, -1.0);
      vec3 P = uO + d * (-uO.z / d.z);
      vec2 px = vec2(P.x + 960.0, 540.0 - P.y);
      vec2 fw = max(fwidth(px), vec2(1e-3));

      // --- screen plane, display sRGB ---
      vec3 col = cBG * uBg;
      if (uAir > 0.0) {
        vec2 nuv = (px + vec2(600.0, 300.0)) / vec2(3120.0, 1680.0);
        vec2 n = texture2D(tNoise, nuv + vec2(0.0021, 0.0008) * uTime).rg;
        float a = texture2D(tNoise, nuv * 1.7 + vec2(0.31, 0.12) - vec2(0.0013, 0.0019) * uTime).g;
        float air = smoothstep(0.25, 0.85, 0.55 * n.x + 0.45 * a);
        col += vec3(0.70, 0.80, 0.95) * 0.026 * air * uAir;
      }
      vec2 cc = vec2(0.5 * (uCur.x + uCur.z), 0.5 * (uCur.y + uCur.w));
      float dl = length((px - cc) / vec2(1.0, 1.15));
      col += vec3(1.0, 0.80, 0.58) * 0.007 * uLight * exp(-dl * dl / (2.0 * 170.0 * 170.0));   // the lamp warms the air a little

      float ink = 0.0, inkSoft = 0.0, tagInk = 0.0;
      vec2 tq = (vec2(px.x, px.y + uScroll) - uTextRect.xy) / uTextRect.zw;
      if (uTextA > 0.0 && all(greaterThan(tq, vec2(0.0))) && all(lessThan(tq, vec2(1.0)))) {
        vec4 tc = texture2D(tText, tq);
        ink = tc.a * uTextA;
        inkSoft = max(ink, min(1.0, 3.0 * textureLod(tText, tq, 2.5).a) * uTextA);   // ≈ 3 px dilation
        col = mix(col, tc.rgb, ink);
      }
      if (uEndOn > 0.5) {
        vec4 ec = texture2D(tEnd, px / vec2(1920.0, 1080.0));
        ink = ec.a; inkSoft = ec.a; col = mix(col, ec.rgb, ec.a);
      }
      if (uTag.z > 0.0) {
        vec2 q = px - uTag.xy;
        float a = tagRow(q, 0.0);
        a = max(a, tagRow(q - vec2(0.0, uTagGeom.z + uRoleOld.y), uRoleOld.x) * uRoleOld.z);
        a = max(a, tagRow(q - vec2(0.0, uTagGeom.z + uRoleNew.y), uRoleNew.x) * uRoleNew.z);
        float pw = max(fw.x, fw.y);
        // 1 px leader line (60 %); when the spring stretches it (carriage return) it thins out like elastic
        float stretch = clamp(1.0 - (length(uLink.zw - uLink.xy) - 30.0) / 120.0, 0.0, 1.0);
        float ln = clamp((0.5 + 0.5 * pw - segDist(px, uLink.xy, uLink.zw)) / pw, 0.0, 1.0) * 0.6 * stretch;
        col = mix(col, cTEXT, max(a, ln) * uTag.z);
        tagInk = a * uTag.z;
        float sa = tagRowLod(q, 0.0);
        sa = max(sa, tagRowLod(q - vec2(0.0, uTagGeom.z + uRoleOld.y), uRoleOld.x) * uRoleOld.z);
        sa = max(sa, tagRowLod(q - vec2(0.0, uTagGeom.z + uRoleNew.y), uRoleNew.x) * uRoleNew.z);
        inkSoft = max(inkSoft, max(tagInk, min(1.0, 3.0 * sa) * uTag.z));
      }
      // --- HUD (viewfinder, screen space) ---
      if (uHudLine > 0.0) {
        float hx = step(abs(sp.x - 960.0), 960.0 * uHudLine);
        float cl = max(cover(sp.y, k, 137.0, 138.0), cover(sp.y, k, 942.0, 943.0)) * hx;
        col = mix(col, cFRAME, cl);
      }
      if (uHudOn > 0.0) {
        vec2 hq = (sp - uHudRect.xy) / uHudRect.zw;
        if (all(greaterThan(hq, vec2(0.0))) && all(lessThan(hq, vec2(1.0)))) col = mix(col, cDIM, texture2D(tHud, hq).a * uHudOn);
      }

      // --- to scene-linear: exact display mapping, then light ---
      vec3 hdr = ui_hdr(col);
      // the cursor lights the strokes near it (+25 %, warm), radius ≈ 300 px
      float lit = uLight * exp(-dl * dl / (2.0 * 130.0 * 130.0));
      hdr *= 1.0 + ink * lit * vec3(0.27, 0.25, 0.21);
      // cursor block (analytic box coverage in plane pixels)
      float cv = cover(px.x, fw.x, uCur.x, uCur.z) * cover(px.y, fw.y, uCur.y, uCur.w) * uCurOn;
      // the cursor heats to white as it becomes the singularity (S05)
      vec3 curC = mix(hCUR * uCurI, vec3(1.0, 0.975, 0.93) * uCurI * hCUR.g, uCurW);
      hdr = mix(hdr, curC, cv);
      // its light: a soft halo and a thin ±160 px anamorphic line (lens, so measured on screen)
      vec2 dq = px - cc;
      if (uGlow > 0.0 && uCurOn > 0.0 && abs(dq.x) < 420.0 && abs(dq.y) < 200.0) {
        float hw = 0.5 * (uCur.z - uCur.x), hh = 0.5 * (uCur.w - uCur.y);
        vec2 o = max(abs(dq) - vec2(hw, hh), 0.0);
        float halo = (exp(-length(o) / 6.0) * 0.10 + exp(-length(o) / 40.0) * 0.07) * (1.0 - inkSoft);
        float line = exp(-abs(dq.x) / 52.0) * exp(-dq.y * dq.y / (2.0 * 2.2 * 2.2)) * smoothstep(hh + 6.0, hh - 6.0, abs(dq.y));
        // the anamorphic line never crosses text already on its row (screenplay §0): 0 over [x0, x1]
        if (uRow.w > 0.0) line *= 1.0 - cover(px.x, max(fw.x, 2.0), uRow.y, uRow.z);
        hdr += curC * uGlow * (halo + line * mix(1.6, 0.6, uCurW)) / 1.6;
      }
      // the singularity / still point: same radial Gaussian as c_afterglow's f600
      if (uPointP > 0.0) {
        vec2 q = sp - uR; float r2 = dot(q, q);
        hdr += vec3(1.0, 0.975, 0.93) * uPointP * exp(-0.5 * r2 / (uPointSig * uPointSig));
        // a sharp anamorphic line through the point (lens; cool white), fading with it
        hdr += vec3(0.80, 0.90, 1.0) * uPointLine * uPointP * exp(-abs(q.x) / 110.0) * exp(-0.5 * q.y * q.y / 1.44);
      }
      if (uMaskMode > 0.5) {
        // V2 bloom mask: R = strokes emit no bloom/streak, G = strokes (dilated) receive no bloom,
        // B = the cursor row's text span receives no streak
        float rowB = uRow.w > 0.0 ? cover(px.x, fw.x, uRow.y - 2.0, uRow.z + 2.0) * step(abs(px.y - uRow.x), 26.0) : 0.0;
        gl_FragColor = vec4(clamp(max(ink, tagInk) * 1.5, 0.0, 1.0), inkSoft, max(rowB, inkSoft), 1.0);
        return;
      }
      gl_FragColor = vec4(hdr * uGain, 1.0);
    }`, U);

  // ---- star particles (text stars + background stars) ------------------------------------------
  // Instanced: one instance per star, the base geometry is KMAX vertices = KMAX sub-times inside the
  // shutter interval (analytic motion blur — every star draws its own trail in one draw call; only as
  // many sub-samples as the fastest star needs are drawn, via drawRange).
  const r = util.rng(55 * 1000 + 4);
  const SSK = 4;                                         // 4× super-sampled ink
  const pc = mk(TX.w * SSK, TX.h * SSK), pg = pc.getContext('2d', { willReadFrequently: true });
  // static divergence-free flow (2D curl of a smooth potential + a depth term), baked per star
  const vh = (x, y) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(vh(xi, yi), vh(xi + 1, yi), ux), lerp(vh(xi, yi + 1), vh(xi + 1, yi + 1), ux), uy); };
  const psi = (x, y) => vn(x, y) + 0.5 * vn(2.03 * x + 17.1, 2.03 * y - 3.7);
  const flow = (x, y) => { const k = 0.006, e = 0.5; const X = x * k, Y = y * k;
    const dx = (psi(X + e, Y) - psi(X - e, Y)) / (2 * e), dy = (psi(X, Y + e) - psi(X, Y - e)) / (2 * e);
    return [dy * 2.2, -dx * 2.2, (vn(X * 1.3 + 40, Y * 1.3) - 0.5) * 2]; };
  const pos = [], col = [], rnd = [], kind = [], flw = [];
  // S04: each glyph opens into its own cluster — depth is per glyph (± a little per point), so a line
  // under the tilted camera does not shear into one band. aRnd.x carries the glyph depth (≈ 0–1).
  const rg = util.rng(55 * 1000 + 7), JIT = 12 / (0.8 * 520);          // ±6 px per point
  ITEMS.forEach((L) => {
    pg.font = L.font;
    const chars = [...L.text], edge = chars.map((_, c) => L.x + pg.measureText(chars.slice(0, c + 1).join('')).width);
    const gDepth = chars.map(() => rg());
    // rasterise only this row's band (doc y ± 40) of the 4× canvas
    const by0 = Math.max(0, Math.floor((docY(L) - 40 - TX.y0) * SSK)), by1 = Math.min(pc.height, Math.ceil((docY(L) + 40 - TX.y0) * SSK));
    pg.setTransform(1, 0, 0, 1, 0, 0); pg.clearRect(0, 0, pc.width, pc.height);
    pg.setTransform(SSK, 0, 0, SSK, -TX.x0 * SSK, -TX.y0 * SSK);
    pg.font = L.font; pg.fillStyle = '#fff'; pg.textBaseline = 'alphabetic';
    pg.fillText(L.text, L.x, docY(L) + BL[L.font]);
    const data = pg.getImageData(0, by0, pc.width, by1 - by0).data;
    // 1× pixel coverage (mean of its 4×4 super-samples): the text displays as hdr(cov · colour), and the
    // pixel receives ≈ 4·cov points, so each point carries hdr(cov · colour) / (4 cov). This keeps the
    // anti-aliased edges exactly as bright as the canvas text (ACES is not linear) → a seamless cross-fade.
    const bw = pc.width / SSK, bh = Math.ceil((by1 - by0) / SSK) + 1, cov = new Float32Array(bw * bh);
    const cidx = (x, y) => (((y + by0) / SSK | 0) - (by0 / SSK | 0)) * bw + ((x / SSK) | 0);
    for (let y = 0; y < by1 - by0; y++) for (let x = 0; x < pc.width; x++) cov[cidx(x, y)] += data[(y * pc.width + x) * 4 + 3] / 255 / (SSK * SSK);
    const lut = Array.from({ length: 65 }, (_, i) => { const c = Math.max(i / 64, 1 / 128); return hdrFor(hex(L.color).map(v => v * L.alpha * c)).map(v => v / (4 * c)); });
    for (let y = 0; y < by1 - by0; y++) for (let x = 0; x < pc.width; x++) {
      const a = data[(y * pc.width + x) * 4 + 3] / 255;
      if (a <= 0 || r() > 0.25 * a) continue;
      const px = TX.x0 + (x + r()) / SSK, py = TX.y0 + (y + by0 + r()) / SSK;
      pos.push(px, py, 0);                                                       // document-space pixels
      col.push(...lut[Math.round(64 * Math.min(1, cov[cidx(x, y)]))]);
      rnd.push(r(), r(), r(), r()); kind.push(0); flw.push(...flow(px, py));
      let g = 0; while (g < edge.length - 1 && px >= edge[g]) g++;
      rnd[rnd.length - 4] = gDepth[g] + (rnd[rnd.length - 4] - 0.5) * JIT;
    }
  });
  const NTEXT = kind.length;
  // background stars: uniform on screen, at depths behind the plane, placed along the camera rays of 00:21
  for (let i = 0; i < 20000; i++) {
    const sx = -200 + r() * 2320, sy = -150 + r() * 1380;
    const depth = D0 * 1.04 + 300 + Math.pow(r(), 0.7) * 5200;       // distance from the camera
    const C = D0 / 1.045;                                            // ≈ camera distance at 21–23 s
    const nx = (sx - 960) / 960 * TAN * (16 / 9), ny = (540 - sy) / 540 * TAN;
    pos.push(nx * depth, ny * depth, C - depth);
    col.push(0, 0, 0); rnd.push(r(), r(), r(), r()); kind.push(1); flw.push(0, 0, 0);
  }
  const KMAX = 192;   // v2: the longer command line starts its stars ≈ 360 px from R (was 96)
  // Two instanced geometries (text stars, sky stars), each sorted bright → faint, so a frame that needs
  // many trail sub-samples (S05) can draw only the stars that will be visible (a prefix).
  const blackbodyJS = T => { // same approximation as GLSL blackbody() (lib/glsl.js), linear
    T = clamp(T, 1000, 40000) / 100;
    const r = T <= 66 ? 1 : clamp(1.29293618606 * Math.pow(T - 60, -0.1332047592));
    const g = T <= 66 ? clamp(0.39008157876 * Math.log(T) - 0.63184144378) : clamp(1.12989086089 * Math.pow(T - 60, -0.0755148492));
    const b = T >= 66 ? 1 : T <= 19 ? 0 : clamp(0.54320678911 * Math.log(T - 10) - 1.19625408914);
    return [r, g, b].map(x => Math.pow(x, 2.2));
  };
  function starGeometry(i0, i1) {
    const idx = []; for (let i = i0; i < i1; i++) idx.push(i);
    idx.sort((a, b) => rnd[b * 4 + 2] - rnd[a * 4 + 2]);
    const n = idx.length, P = new Float32Array(n * 3), Cc = new Float32Array(n * 3), Rr = new Float32Array(n * 4), Kk = new Float32Array(n), Fl = new Float32Array(n * 3), BB = new Float32Array(n * 3);
    idx.forEach((i, j) => {
      for (let q = 0; q < 3; q++) { P[j * 3 + q] = pos[i * 3 + q]; Cc[j * 3 + q] = col[i * 3 + q]; Fl[j * 3 + q] = flw[i * 3 + q]; }
      for (let q = 0; q < 4; q++) Rr[j * 4 + q] = rnd[i * 4 + q];
      Kk[j] = kind[i];
      BB.set(blackbodyJS(3000 + 9000 * Math.pow(rnd[i * 4 + 3], 0.85)), j * 3);   // 3000–12000 K
    });
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(KMAX * 3), 3));
    g.setAttribute('aSub', new THREE.Float32BufferAttribute(Float32Array.from({ length: KMAX }, (_, j) => j), 1));
    const inst = (arr, k) => new THREE.InstancedBufferAttribute(arr, k);
    g.setAttribute('aP', inst(P, 3)); g.setAttribute('aCol', inst(Cc, 3)); g.setAttribute('aRnd', inst(Rr, 4));
    g.setAttribute('aKind', inst(Kk, 1)); g.setAttribute('aFlow', inst(Fl, 3)); g.setAttribute('aBB', inst(BB, 3));
    g.instanceCount = n;
    // prefix length of stars with aRnd.z above a value (sorted descending)
    g.userData.prefix = z => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (Rr[m * 4 + 2] > z) lo = m + 1; else hi = m; } return lo; };
    g.userData.n = n;
    return g;
  }
  const geoText = starGeometry(0, NTEXT), geoSky = starGeometry(NTEXT, kind.length);
  const PU = { uSigK: { value: 1 }, uT0: { value: 0 }, uSh: { value: 0 }, uK: { value: 1 }, uGain: { value: 1 }, uS: { value: S }, uR3: { value: R3.clone() }, uFocus: { value: D0 }, uPScroll: { value: 256 } };
  const pmat = new THREE.ShaderMaterial({
    uniforms: PU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL.common + /* glsl */ `
      attribute float aSub; attribute vec3 aP, aCol, aFlow, aBB; attribute vec4 aRnd; attribute float aKind;
      uniform float uT0, uSh, uK, uGain, uS, uFocus, uSigK, uPScroll; uniform vec3 uR3;
      varying vec3 vCol; varying float vSig, vPS;
      float eio3(float x){ x = clamp(x, 0.0, 1.0); return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
      void main(){
        // this vertex's sub-time inside the shutter, and every curve of S04/S05 evaluated at it
        float ts = uT0 + uSh * ((aSub + 0.5) / uK - 0.5);
        float fr = ts * 24.0;
        // v2: the echo first, then the universe — text → stars only from f528 (screenplay S01-f)
        float textA = clamp((fr - 527.5) / 6.0, 0.0, 1.0);                  // f528–533 cross-fade from the canvas text
        float spread = eio3((fr - 528.0) / 24.0);                           // depth + drift, f528–552
        float colMix = 0.5 - 0.5 * cos(PI * clamp((fr - 528.0) / 24.0, 0.0, 1.0));
        float scroll = uPScroll;
        float s = clamp((ts - 22.5) / (1.0 + 11.0 / 24.0), 0.0, 1.0);        // S05, 1 at f575
        float u = s <= 0.0 ? 0.0 : exp2(10.0 * s - 10.0);                   // easeInExpo
        float fade = 1.0 - smoothstep(0.55, 0.92, u);
        vec3 p, c;
        if (aKind < 0.5) {
          p = vec3(aP.x - 960.0, 540.0 - (aP.y - scroll), 0.0);
          // each glyph opens into a small cluster of stars: depth + a slow coherent drift
          float wob = 1.0 + 0.25 * sin(0.7 * ts + 6.2832 * aRnd.y);
          p.z += (aRnd.x - 0.5) * 0.8 * 520.0 * spread;                    // aRnd.x = glyph depth ± jitter
          p += aFlow * vec3(14.0, 14.0, 60.0) * spread * wob;
          // magnitudes: a dust of faint points, ≈ 5 % faintly visible, ≈ 0.6 % bright (a few per glyph)
          float boost = mix(1.0, 0.012 + 3.2 * pow(aRnd.z, 36.0) + 40.0 * pow(aRnd.z, 380.0), colMix);
          c = mix(aCol, aBB * dot(aCol, vec3(0.2126, 0.7152, 0.0722)) * 1.6, colMix) * boost * textA;
        } else {
          p = aP;
          // power-law sky: ≈ 7 % faintly visible, ≈ 50 bright stars in 2×10⁴
          c = aBB * (0.006 + 0.9 * pow(aRnd.z, 30.0) + 30.0 * pow(aRnd.z, 900.0)) * colMix;
        }
        // spiral collapse about the plane normal through R: r = r0 (1-u)^2, θ = θ0 + 10 u^3
        vec3 rel = p - uR3; float r0 = length(rel.xy) + 0.35 * abs(rel.z);
        float k = (1.0 - u) * (1.0 - u), th = 10.0 * u * u * u;
        float cs = cos(th), sn = sin(th);
        rel.xy = vec2(cs * rel.x - sn * rel.y, sn * rel.x + cs * rel.y);
        p = uR3 + rel * k;
        float heat = u > 0.0 ? min((r0 + 8.0) / (r0 * k + 8.0), 10.0) : 1.0;   // gravitational heating ∝ 1/(r + 8 px)
        c *= heat;
        c = mix(c, vec3(dot(c, vec3(0.333))) * vec3(0.9, 0.95, 1.1), smoothstep(2.0, 10.0, heat) * 0.6);
        c *= fade * uGain / uK;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float sc = uFocus / max(-mv.z, 1.0);
        vSig = max(clamp(0.62 * sqrt(sc), 0.55, 1.6) * uS, 0.62) * uSigK;    // PSF sigma in output pixels
        if (aKind < 0.5) vSig = mix(0.5, vSig, spread);                    // as sharp as the glyphs while they are still text
        gl_PointSize = max(2.0, ceil(vSig * 4.6) + 1.0); vPS = gl_PointSize;
        vCol = c * uS * uS / (6.2832 * vSig * vSig);                        // peak = energy / (2πσ²)
        if (max(vCol.r, max(vCol.g, vCol.b)) < 0.005) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // invisible: cull
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vSig, vPS;
      void main(){
        vec2 d = (gl_PointCoord - 0.5) * vPS;
        gl_FragColor = vec4(vCol * exp(-0.5 * dot(d, d) / (vSig * vSig)), 1.0);
      }`,
  });
  const ptsText = new THREE.Points(geoText, pmat), ptsSky = new THREE.Points(geoSky, pmat);
  ptsText.frustumCulled = ptsSky.frustumCulled = false;
  const plane = new THREE.Group(); plane.matrixAutoUpdate = false; plane.add(ptsText, ptsSky);
  // S05 trail frames: only stars that stay above the cull level with 1/K energy per sub-sample
  const TEXT_Z = geoText.userData.prefix(0.80), SKY_Z = geoSky.userData.prefix(0.80);
  const pscene = new THREE.Scene(); pscene.add(plane);
  const pcam = new THREE.PerspectiveCamera(2 * Math.atan(TAN) * 180 / Math.PI, W / H, 5, 30000);
  // sub-samples needed so the fastest star (r0 ≈ 1250 px) moves ≤ ~1.3 output px between samples
  const uAt = t => { const s = clamp((t - 22.5) / (1 + 11 / 24)); return s <= 0 ? 0 : Math.pow(2, 10 * s - 10); };
  const trailPx = (ta, tb) => {
    let L = 0, prev = null;
    for (let i = 0; i <= 16; i++) {
      const u = uAt(lerp(ta, tb, i / 16)), k = (1 - u) * (1 - u), th = 10 * u * u * u;
      const q = [2400 * k * Math.cos(th), 2400 * k * Math.sin(th)];   // deep sky stars collapse from ≈ 2400 px
      if (prev) L += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
      prev = q;
    }
    return L * S;
  };
  console.log(`p_terminal: ${NTEXT} text stars (${TEXT_Z} in trails) + ${kind.length - NTEXT} sky stars (${SKY_Z})`);

  const DBG = {};   // profiling switches (build/terminal/prof.mjs); empty in production

  // ---- camera / plane pose -----------------------------------------------------------------------
  const Mrot = new THREE.Matrix4(), Mtmp = new THREE.Matrix4(), Mpl = new THREE.Matrix4();
  function pose(t) {
    const u = t >= S44_T ? 0 : ease.inOutSine(clamp((t - 11) / 12));
    const mag = 1 + 0.06 * u;
    const yaw = THREE.MathUtils.degToRad(3 * u), pitch = THREE.MathUtils.degToRad(1.5 * u);
    Mrot.makeRotationY(yaw).multiply(Mtmp.makeRotationX(pitch));
    // camera slides along the ray through R (R stays on the same pixel), magnification 1.06 at the plane
    const C = new THREE.Vector3(0, 0, D0).sub(R3).multiplyScalar(1 / mag).add(R3);
    // plane-local camera origin and ray rotation (camera itself is unrotated)
    const RinvM = new THREE.Matrix4().copy(Mrot).transpose();
    const o = C.clone().sub(R3).applyMatrix4(RinvM).add(R3);
    U.uO.value.copy(o); U.uRinv.value.setFromMatrix4(RinvM);
    // particles: plane-local → world = T(R3)·Mrot·T(−R3)
    Mpl.makeTranslation(R3.x, R3.y, R3.z).multiply(Mrot).multiply(Mtmp.makeTranslation(-R3.x, -R3.y, -R3.z));
    plane.matrix.copy(Mpl); plane.matrixWorldNeedsUpdate = true;
    pcam.position.copy(C); pcam.updateMatrixWorld(true);
  }

  // cursor visibility: heartbeat square wave, solid while typing (relocks at the next whole second)
  // v2: solid while typing the command [430, 480); f480 the hesitant beat (lit 480–491, dark 492–503);
  // hidden while the program runs [504, 522); solid on the new prompt row from f522 into the collapse
  const SOLID = [[132, 264], [430, 480], [522, 1e9]];
  function cursorOn(F) {
    if (F < 48) return 0;
    if (F >= CURSOR_HIDDEN[0] && F < CURSOR_HIDDEN[1]) return 0;
    for (const [a, b] of SOLID) if (F >= a && F < b) return 1;
    return F % 24 < 12 ? 1 : 0;
  }

  function renderOpening(f, sh = 0, gain = 1) {
    const t = f.t, fr = t * FPS, F = Math.round(fr);
    pose(t);
    // background: black → UI_BG (f24–47), down to INK with the letterbox (f504–552)
    U.uBg.value = clamp((fr - 24) / 23) * (1 - clamp((fr - 504) / 48));
    const light = clamp((fr - 312) / 12);
    U.uLight.value = light * (1 - clamp((fr - 504) / 24));
    U.uAir.value = light * (1 - clamp((fr - 504) / 48)); U.uTime.value = t;
    // script text (canvas) until the stars take over
    const counts = ITEMS.map((L, k) => itemCount(k, F));
    drawText(counts);
    U.uScroll.value = scrollAt(fr);
    U.uTextA.value = 1 - clamp((fr - 527.5) / 6);          // f528–533 cross-fade into the stars
    U.uEndOn.value = 0;
    // name plate (f120–450)
    const tagA = ease.outCubic(clamp((fr - 120) / 12)) * (1 - ease.inOutSine(clamp((fr - 432) / 18)));
    const curL = cursorLeftAt(F);
    if (tagA > 0) {
      const sx = springX(fr), rise = 4 * (1 - ease.outCubic(clamp((fr - 120) / 12)));
      const nameBase = CUR.y1 + 40 + rise;                // v2: name baseline = cursor bottom + 40 px (y 598)
      U.uTag.value.set(sx + 14, nameBase - TAG.base, tagA);
      let ri = 0; for (let i = 0; i < ROLE_F.length; i++) if (fr >= ROLE_F[i]) ri = i;
      const fl = ROLE_F[ri], v0 = clamp((fr - fl) / 8), v1 = clamp((fr - fl - 2) / 8);
      if (ri === 0) { U.uRoleOld.value.set(0, 0, 0); U.uRoleNew.value.set(1, 0, 1); }
      else {
        U.uRoleOld.value.set(ri, -6 * ease.outCubic(v0), 1 - v0);
        U.uRoleNew.value.set(ri + 1, 6 * (1 - ease.outCubic(v1)), ease.inOutSine(v1));
      }
      U.uLink.value.set(curL + 14, CUR.y1, sx + 14, nameBase - TAG_CAP);   // cursor's bottom-right corner → plate's top-left
    } else U.uTag.value.z = 0;
    // cursor: 14×36 at R; HDR 1.0 → 1.6 with glow at f312; S05 contracts to a 4×4 pin at HDR 8
    // HDR multiplier of the display-exact cursor (≈ 3.4): 1.0 → 1.6 at f312. While the bloom threshold
    // falls 3.0 → 1.0 with the letterbox, the cursor falls with it so its glow (excess over threshold) stays put.
    const film = ease.inOutCubic(clamp((t - 21) / 2));
    let cw = 14, ch = 36, ci = lerp(1, lerp(1.6, 3.4 / HDR.CURSOR[1], film), light), on = cursorOn(F), glow = 0.2 * light;
    const sC = clamp((t - 22.5) / (23 + 23 / 24 - 22.5));   // S05 progress, 1 at f575
    const uC = sC <= 0 ? 0 : sC >= 1 ? 1 : Math.pow(2, 10 * sC - 10);
    let pointP = 0, curW = 0;
    if (t >= 22.5) {
      const e = ease.inOutCubic(sC);
      cw = lerp(14, 4, e); ch = lerp(36, 4, e); curW = smoothstep(0.3, 0.95, sC);
      ci = lerp(3.4, 8, Math.pow(sC, 1.5)) / HDR.CURSOR[1];
    }
    if (t >= 24) {
      // S06: the pin becomes the still point (equal energy Gaussian), 8 → 1.5 within 6 frames, then still
      const fs = fr - 576;
      on = 0; glow = 0;
      pointP = fs >= 6 ? 1.5 : lerp(8, 1.5, ease.outCubic(clamp(fs / 6)));
    }
    U.uCur.value.set(curL + 7 - cw / 2, R[1] - ch / 2, curL + 7 + cw / 2, R[1] + ch / 2);
    // the text already standing on the cursor's row (the anamorphic line and streak skip it)
    const curRow = Math.round((540 + scrollAt(fr) - 540) / 64);   // doc row under R
    const rowItems = ITEMS.filter((L, k) => L.row === curRow && counts[k] > 0);
    if (rowItems.length) {
      const x0 = Math.min(...rowItems.map(L => L.x)) - 1;
      const x1 = Math.max(...rowItems.map(L => L.x + adv(L.font, [...L.text].slice(0, counts[ITEMS.indexOf(L)]).join('')))) + 1;
      U.uRow.value.set(R[1], x0, Math.min(x1, curL - 1), 1);
    } else U.uRow.value.set(0, 0, 0, 0);
    U.uCurI.value = ci; U.uCurOn.value = on; U.uGlow.value = glow * (t < 22.5 ? 1 : 1 - clamp((t - 22.5) / 0.5) * 0.7);
    U.uPointP.value = pointP; U.uPointSig.value = 1.6; U.uCurW.value = curW; U.uPointLine.value = t >= 24 ? 0.035 : 0;
    // HUD: frame lines f36–47, counter from f312
    U.uHudLine.value = ease.outCubic(clamp((fr - 36) / 11));
    U.uHudOn.value = F >= 312 ? 1 : 0;
    if (F >= 312) drawHud('frame ' + String(F + 1).padStart(4, '0'));

    U.uGain.value = gain;
    if (DBG.noAir) U.uAir.value = 0;
    if (DBG.noGlow) { U.uGlow.value = 0; U.uLight.value = 0; }
    if (DBG.noTag) U.uTag.value.z = 0;
    renderer.setRenderTarget(f.target);
    if (!DBG.noScreen) screen.render(renderer, f.target);
    writeMask(f);

    // stars (f528 →): one instanced draw; `sh` > 0 spreads each star over its shutter interval
    if (fr >= 528 - 0.5 && uC < 0.93 && !DBG.noStars) {
      PU.uT0.value = t; PU.uSh.value = sh; PU.uGain.value = gain; PU.uPScroll.value = scrollAt(fr);
      const need = sh > 0 ? trailPx(t - sh / 2, t + sh / 2) / 1.6 : 1;   // ≤ 1.6 px between trail samples
      const K = Math.max(1, Math.min(KMAX, Math.ceil(need)));
      PU.uK.value = K; PU.uSigK.value = need > KMAX ? Math.sqrt(need / KMAX) : 1;   // widen the PSF rather than leave beads
      for (const g of [geoText, geoSky]) g.setDrawRange(0, K);
      geoText.instanceCount = K > 2 ? TEXT_Z : geoText.userData.n;
      geoSky.instanceCount = K > 2 ? SKY_Z : geoSky.userData.n;
      renderer.setRenderTarget(f.target);
      const ac = renderer.autoClear; renderer.autoClear = false;   // add on top of the screen pass
      renderer.render(pscene, pcam);
      renderer.autoClear = ac;
    }
  }

  // S44 cursor: heartbeat square wave; on a printing beat it stays lit for the whole beat
  const PRINT_BEATS = ALT.map(c => c.frames[0]);
  function endCursorOn(F) {
    if (PRINT_BEATS.some(b => F >= b && F < b + 24)) return 1;
    return F % 24 < 12 ? 1 : 0;
  }
  function renderEnd(f) {
    const t = f.t, fr = t * FPS, F = Math.round(fr);
    pose(t);
    const open = ease.inOutCubic(clamp(t - S44_T));
    U.uBg.value = open; U.uAir.value = 0; U.uLight.value = 0; U.uTextA.value = 0; U.uTag.value.z = 0; U.uPointP.value = 0; U.uGlow.value = 0;
    U.uRow.value.set(0, 0, 0, 0);
    const alt = F >= ALT_IN_F && F < ALT_OUT_F;
    const nBlocks = alt ? ALT.filter(c => c.frames[0] <= F).length : 0;
    drawEnd(alt ? 'alt' : 'main', nBlocks);
    U.uEndOn.value = 1;
    // cursor: on the empty prompt row (R) on the main screen; on the alternate screen it waits on the row
    // where the next block will print (below the last printed line)
    let cy = R[1];
    if (alt) {
      const next = ALT[nBlocks], last = ALT[nBlocks - 1];
      cy = next ? next.ys[0] : last.ys[last.ys.length - 1] + 64;
    }
    U.uCur.value.set(CUR.x0, cy - 18, CUR.x1, cy + 18);
    U.uCurI.value = 1; U.uCurOn.value = endCursorOn(F);
    U.uHudLine.value = 1; U.uHudOn.value = 1;
    drawHud(F >= 5999 ? 'frame 6000 / 6000' : 'frame ' + String(F + 1).padStart(4, '0'));
    renderer.setRenderTarget(f.target);
    screen.render(renderer, f.target);
    writeMask(f);
  }

  // ---- V2 bloom mask: the same plane shader in mask mode (strokes neither emit nor receive bloom) --
  function writeMask(f) {
    if (!f.mask || (f.sub | 0) !== 0) return;
    U.uMaskMode.value = 1;
    const ac = renderer.autoClear; renderer.autoClear = false;
    renderer.setRenderTarget(f.mask);
    screen.render(renderer, f.mask);
    renderer.autoClear = ac;
    U.uMaskMode.value = 0;
    renderer.setRenderTarget(f.target);
  }

  // ---- S05 motion blur ---------------------------------------------------------------------------
  // The stars are blurred analytically: each star draws its own trail from up to KMAX sub-time samples
  // across the whole 180° shutter in one instanced draw. The engine still asks for n sub-frames
  // (timeline S05 motionBlur 8) and averages them; the module renders the whole shutter once per output
  // frame into its own target and hands the same image to every sub-frame (the average is then exact,
  // and the screen pass runs once instead of n times). Pure function of the frame number.
  let mbRT = null, mbKey = -1;
  const copy = ctx.kit.fullscreen(`uniform sampler2D tex; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb, 1.0); }`, { tex: { value: null } });
  function renderBlurred(shot, f) {
    const sh = (shot.shutter ?? 0.5) / FPS;
    const F = Math.round(f.t * FPS), t0 = F / FPS;
    if (!mbRT) mbRT = ctx.makeRT(W, H);
    if (mbKey !== F) {
      mbKey = F;
      const ac = renderer.autoClear;
      renderer.setRenderTarget(mbRT); renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
      renderOpening({ ...f, t: t0, lt: t0 - shot.start, p: (t0 - shot.start) / f.dur, target: mbRT, sub: 0 }, sh, 1);
      renderer.autoClear = ac;
    }
    copy.material.uniforms.tex.value = mbRT.texture;
    renderer.setRenderTarget(f.target);
    copy.render(renderer, f.target);
  }

  const THR_UI = 3.6; // UI text peaks at HDR ≈ 2.6 (UI_TEXT 100 % lit +25 %): it never blooms; the cursor (5.3) does
  return {
    _dbg: { apply(o) { for (const k of Object.keys(DBG)) delete DBG[k]; Object.assign(DBG, o); } },
    // V2 bloom mask while there is UI text under a non-zero bloom (name plate, command line, echo;
    // the terminal while the film look leaves it)
    bloomMask(f) { const F = f.frame; return f.shot.id === 'S44' ? F < S44_F + 26 : F >= 300 && F < 536; },
    render(shot, f) {
      if (shot.id === 'S44') renderEnd(f);
      else if ((shot.motionBlur || 0) > 1) renderBlurred(shot, f);
      else renderOpening(f);
    },
    post(shot, f) {
      const t = f.t;
      const base = { exposure: 1, saturation: 1, contrast: 1, tint: [1, 1, 1], lift: [0, 0, 0], fade: 0, flash: 0, blackLevel: 0, bloomRadius: 1.0, streakTint: [0.55, 0.75, 1.0] };
      if (shot.id === 'S44') {
        const e = 1 - ease.inOutCubic(clamp(t - S44_T));   // film → clean UI, same curve as the bars
        return { ...base, bloom: 0.75 * e, bloomThreshold: lerp(THR_UI, 1.0, e), bloomKnee: lerp(0.25, 0.6, e), streak: 0.25 * e, grain: 0.035 * e, vignette: 0.2 * e, ca: 0.0006 * e };
      }
      const film = ease.inOutCubic(clamp((t - 21) / 2));       // with the letterbox
      return {
        ...base,
        bloom: 0.8 * ease.inOutSine(clamp((t - 13) / 0.5)),
        bloomThreshold: lerp(THR_UI, 1.0, film), bloomKnee: lerp(0.25, 0.6, film),
        streak: 0.5 * smoothstep(22.25, 22.5, t),
        grain: 0.035 * film, vignette: 0.2 * film, ca: 0.0006 * film,
      };
    },
  };
}
