// Lexicon of real human words — shared by w_sea (S34–S36) and q_apex (S37–S38).
//
// Everything that is written in the sea of words comes from web/src/data/voices.js (plus the two
// lines the screenplay adds: Rigveda X.129.7 and the film's own shader line, appendix B). Nothing is
// generated: a token is either
//   · a whole word (space-separated scripts: Latin, Greek, Cyrillic, Arabic, Hebrew, Devanagari …),
//     drawn with canvas2D so complex scripts are shaped correctly, or
//   · one grapheme (logographic / syllabic / ancient sign lists: Han, kana, cuneiform, hieroglyphs,
//     Linear B, runes, Ogham …), where a single sign is itself a meaningful unit.
// q_apex additionally needs single graphemes of *every* script (the micro glyphs of 「有人吗？」);
// those are the graphemes of the same real sentences, kept in sentence order.
// The monospace face is never part of the sea (screenplay appendix B): monospace belongs to the AI.
// The only mono tokens are the AI's own 「我」「在」「有」「人」「吗」.
//
// The atlas (4096², rows of 80 px, font 50 px, mipmapped) is baked once per page and cached at module
// level, so w_sea and q_apex share one texture.
import * as THREE from 'three';
import { VOICES, FONT_FOR, RTL } from '../../data/voices.js';
import { phraseAtlas } from '../../lib/textatlas.js';
import { rng } from '../../lib/util.js';

// Lines the screenplay asks to add to voices.js (shared file, owned by another team): kept here
// until they land there (see sharedRequests in the w_sea report).
export const RIGVEDA_7 = { t: 'सो अङ्ग वेद यदि वा न वेद', lang: 'sa', kind: 'question', src: 'Rigveda 10.129.7 (Nasadiya Sukta): "…or perhaps he does not know."', era: -1200 };
export const SHADER_LINE = { t: 'vec3 c = blackbody(T) * exp(-t / tau);', lang: 'code', kind: 'code', src: 'AFTERGLOW, c_afterglow.js' };
export const CORPUS = [...VOICES, RIGVEDA_7, SHADER_LINE];

// sea fonts: FONT_FOR(lang), except that machine languages are set in a proportional sans
// (monospace never enters the sea).
export const SEA_FONT = lang => (lang === 'code' || lang === 'morse') ? '"Noto Sans"' : FONT_FOR(lang);
export const MONO_CJK = '"Noto Sans Mono CJK SC"';

const GRAPHEME_SCRIPTS = new Set(['zh', 'ja', 'xsux', 'egy', 'gmy', 'phn', 'peo', 'runr', 'sga', 'glag', 'tfng', 'chr', 'iu']);
const PUNCT = /^[\s\p{P}\p{S}]+$/u;   // punctuation / symbols alone are not tokens
const seg = new Intl.Segmenter('und', { granularity: 'grapheme' });
export const graphemes = s => Array.from(seg.segment(s), x => x.segment);

// ---------------------------------------------------------------------------------------------
// Fonts: load, then assert (document.fonts.check cannot see system fonts, so we also compare the
// width of a sample against two different generic fallbacks — equal widths = the family is used).
export async function assertFonts(list) {
  const c = document.createElement('canvas').getContext('2d');
  for (const [spec, sample] of list) {
    try { await document.fonts.load(spec, sample); } catch (e) { /* system font: nothing to load */ }
    if (!document.fonts.check(spec, sample)) throw new Error(`font check failed: ${spec}`);
    c.font = `${spec}, monospace`; const a = c.measureText(sample).width;
    c.font = `${spec}, serif`; const b = c.measureText(sample).width;
    if (Math.abs(a - b) > 0.01) throw new Error(`font missing (falls back): ${spec} for "${sample}"`);
  }
}

// ---------------------------------------------------------------------------------------------
// Colour helpers (linear HDR). Palette from timeline.json §2.1.
const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const hexLin = h => [1, 3, 5].map(i => s2l(parseInt(h.slice(i, i + 2), 16) / 255));
export const PAL = {
  AMBER: hexLin('#FFB36B'), CURSOR: hexLin('#F2EEE4'), ASH: hexLin('#8A8A8A'), HAZE: hexLin('#6B5CFF'),
  VIOLET: hexLin('#8E7CFF'), SODIUM: hexLin('#FFB45A'), SUB: hexLin('#CFC9BE'),
};
// ACES fitted (identical to post.js) and its Newton inverse: the HDR value that displays `target`.
function acesFitted(c) {
  const inM = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
  const outM = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
  const mul = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const v = mul(inM, c).map(x => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.4329510) + 0.238081));
  return mul(outM, v);
}
export function inverseAces(target) {
  let x = target.map(v => Math.max(0.02, v));
  for (let it = 0; it < 40; it++) {
    const y = acesFitted(x), e = 1e-4;
    const J = [0, 1, 2].map(j => { const xp = x.slice(); xp[j] += e; const yp = acesFitted(xp); return yp.map((v, i) => (v - y[i]) / e); });
    const A = [[J[0][0], J[1][0], J[2][0]], [J[0][1], J[1][1], J[2][1]], [J[0][2], J[1][2], J[2][2]]];
    const r = target.map((t, i) => t - y[i]);
    const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const D = det(A); if (Math.abs(D) < 1e-14) break;
    const dx = [0, 1, 2].map(k => det(A.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)))) / D);
    x = x.map((v, i) => Math.max(0.001, v + dx[i]));
  }
  return x;
}
// HDR colour that displays as an sRGB hex at `opacity` over black (for screen-space subtitles).
export const hdrForDisplay = (hex, opacity = 1) => inverseAces(hex.match(/[0-9a-f]{2}/gi).map(h => s2l(opacity * parseInt(h, 16) / 255)));

// ---------------------------------------------------------------------------------------------
// The lexicon + atlas (cached: one bake per page).
let LEX = null;
export function getLexicon() {
  if (LEX) return LEX;
  const items = [], key = new Map();
  const add = (text, font, lang, kind) => {
    const k = font + '|' + text;
    if (key.has(k)) return key.get(k);
    const i = items.length; key.set(k, i);
    items.push({ text, font, lang, kind, rtl: RTL.has(lang) });
    return i;
  };
  // sea tokens (words / signs), and per sentence the ordered graphemes for q_apex
  const sea = [], sentences = [];
  for (const v of CORPUS) {
    const font = SEA_FONT(v.lang), st = [];
    if (GRAPHEME_SCRIPTS.has(v.lang)) {
      for (const g of graphemes(v.t)) if (!PUNCT.test(g)) st.push(add(g, font, v.lang, 'sign'));
    } else {
      for (const w of v.t.split(/\s+/)) if (w && !PUNCT.test(w)) st.push(add(w, font, v.lang, 'word'));
    }
    sea.push(...st);
    // graphemes of the sentence, in order (Thai/Lao/Khmer/Myanmar/Tibetan clusters stay whole graphemes)
    const gs = [];
    for (const g of graphemes(v.t)) if (!PUNCT.test(g)) gs.push(add(g, font, v.lang, 'sign'));
    sentences.push({ v, glyphs: gs, sea: st });
  }
  const mono = {};
  for (const ch of ['我', '在', '有', '人', '吗']) mono[ch] = add(ch, MONO_CJK, 'zh-mono', 'mono');
  const A = phraseAtlas(items.map(it => ({ text: it.text, font: it.font, rtl: it.rtl })), { height: 80, size: 4096, pad: 12 });
  if (A.rects.length < items.length) throw new Error(`lexicon atlas overflow: ${A.rects.length}/${items.length}`);
  A.texture.anisotropy = 1;   // quads are screen-aligned: anisotropic filtering would only cost (SwiftShader)
  // drop the 64 MB canvas reference only after upload (the texture keeps its image until then)
  const rects = new Float32Array(items.length * 4);
  A.rects.forEach((r, i) => rects.set([r[0], r[1], r[2], r[3]], i * 4));
  const uniqSea = [...new Set(sea)];
  LEX = { items, rects, atlas: A, texture: A.texture, sea: uniqSea, seaAll: sea, sentences, mono, rowAspect: i => (rects[4 * i + 2] - rects[4 * i]) / (rects[4 * i + 3] - rects[4 * i + 1]) };
  console.log(`WARN lexicon: ${items.length} tokens (${uniqSea.length} sea), atlas rows used ≈ ${Math.ceil(A.rects[A.rects.length - 1][3] * 4096 / 92)}`);
  return LEX;
}

// ---------------------------------------------------------------------------------------------
// The glyph field. Every glyph is drawn either as a point sprite (1 vertex: SwiftShader pays per
// vertex, so this is ~5× cheaper than a quad) or — for the few big near glyphs, where a point sprite
// would pop in/out whole at the frame edge (gl.POINTS are clipped by their centre) — as an instanced
// screen-aligned quad. Both share one shader body. Sizes come from world height and depth;
// sub-pixel glyphs become energy-conserving motes (the far field is literally a starfield of words);
// defocus grows the sprite by the circle of confusion, samples the mip whose texel ≈ CoC/2 and blends
// to a rim-lit aperture disc (a capsule for words), conserving energy. Additive HDR, no sorting.
//
// Per-glyph attributes (iPos / iRect required):
//   iPos  vec3   rest position          iRect  vec4  atlas rect (u0 v0 u1 v1)
//   iRect2 vec4  alternate token (flip) iA     vec4  (world height, brightness, hash1, hash2)
//   iB, iC vec4  shot-specific data     iCol   vec3  colour (linear)
// The shot's GLSL (vertexBody) may change: vec3 p, float hW, float b, vec3 col, float sel (0/1 picks
// iRect/iRect2), float sx (horizontal card-flip scale 0..1), float extraBias. It is compiled as a
// function of `time`, so that the streak option can evaluate the motion at the shutter's ends.
//
// Options:
//   moteRange [lo, hi] (uniform, 1080p px of atlas-row height): below lo a word is a round point of
//     light of the same energy (a word 3 px tall is a star, never a dash); between lo and hi it
//     cross-fades into the readable word. Disable with [-2, -1].
//   streak K (define): analytic motion blur — the glyph is drawn as the average of K taps along its
//     own screen-space motion over the shutter (uniform `shutter`, seconds, centred on `time`), so
//     fast glyphs become smooth streaks instead of the stepped copies of sub-frame accumulation.
//     The camera is assumed static over the shutter.
export const GLYPH_ATTRS = { iPos: 3, iRect: 4, iRect2: 4, iA: 4, iB: 4, iC: 4, iCol: 3 };
export function glyphMaterial(tex, { points = true, uniforms = {}, vertexBody = '', header = '', fragmentBody = '', streak = 0 } = {}) {
  const P = (points ? '#define POINTS 1\n' : '') + (streak ? `#define STREAK ${streak | 0}\n` : '');
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,   // streak quads are oriented along the motion: either winding
    uniforms: {
      atlas: { value: tex }, res: { value: new THREE.Vector2(1920, 1080) }, time: { value: 0 },
      focus: { value: 30 }, aperture: { value: 0 }, minPx: { value: 1.2 }, capPx: { value: [1e5, 2e5] },
      gain: { value: 1 }, nearFade: { value: [0.5, 1.5] }, moteRange: { value: [-2, -1] }, shutter: { value: 0 }, discRange: { value: [0.45, 1.8] }, ...uniforms,
    },
    vertexShader: P + /* glsl */ `
      #ifndef POINTS
      attribute vec2 corner;
      #endif
      attribute vec3 iPos; attribute vec4 iRect; attribute vec4 iRect2; attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec3 iCol;
      uniform vec2 res; uniform float time, focus, aperture, minPx, gain, shutter; uniform vec2 capPx, nearFade, moteRange, discRange;
      varying vec4 vRect; varying vec3 vCol; varying float vBias, vDisc;
      varying vec4 vGeo;     // (glyph width px, glyph height px, disc half-segment, disc radius)
      varying vec3 vMote;    // (word weight 0..1, mote radius px, mote intensity relative to the word's ink)
      varying vec2 vDelta;   // streak: screen motion over the shutter (px, y down)
      #ifdef POINTS
      varying float vSize;
      #else
      varying vec2 vOff;
      #endif
      ${header}
      void body(float time, inout vec3 p, inout float hW, inout float b, inout vec3 col, inout float sel, inout float sx, inout float extraBias) {
        ${vertexBody}
      }
      vec2 screenOf(vec3 q) { vec4 c = projectionMatrix * modelViewMatrix * vec4(q, 1.0); return c.xy / max(c.w, 1e-4) * res * vec2(0.5, -0.5); }
      void main(){
        vec3 p = iPos; float hW = iA.x; float b = iA.y; vec3 col = iCol; float sel = 0.0; float sx = 1.0; float extraBias = 0.0;
        body(time, p, hW, b, col, sel, sx, extraBias);
        vec2 delta = vec2(0.0);
        #ifdef STREAK
        if (shutter > 0.0) {
          vec3 pa = iPos, pb = iPos; float h1 = iA.x, b1 = iA.y, s1 = 0.0, x1 = 1.0, e1 = 0.0; vec3 c1 = iCol;
          float h2 = iA.x, b2 = iA.y, s2 = 0.0, x2 = 1.0, e2 = 0.0; vec3 c2 = iCol;
          body(time - 0.5 * shutter, pa, h1, b1, c1, s1, x1, e1);
          body(time + 0.5 * shutter, pb, h2, b2, c2, s2, x2, e2);
          delta = screenOf(pb) - screenOf(pa);
          p = 0.5 * (pa + pb);                               // the streak is centred on the shutter
        }
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        float pxs = res.y / 1080.0;                         // render px per 1080p px
        float fpx = projectionMatrix[1][1] * res.y * 0.5;   // focal length in render px
        b *= smoothstep(nearFade.x, nearFade.y, d);
        vec4 R = sel > 0.5 ? iRect2 : iRect;
        float asp = max(0.05, (R.z - R.x) / max(1e-6, R.w - R.y));
        float h = hW * fpx / max(d, 1e-3);                  // glyph (atlas row) height, render px
        b *= 1.0 - smoothstep(capPx.x * pxs, capPx.y * pxs, h);
        float hmin = minPx * pxs;
        float hq = max(h, hmin);
        b *= min(1.0, (h / hmin) * (h / hmin));             // sub-pixel: energy-conserving
        float coc = aperture * fpx * abs(1.0 / max(d, 1e-3) - 1.0 / focus);
        float ext = sqrt(hq * hq + coc * coc);
        float w0 = asp * hq, w = max(0.5, w0 * max(0.06, sx));       // sx: card-flip squash (footprint only)
        // below legibility a word is a point of light carrying the same energy (ink ≈ 20 % of its row)
        float leg = smoothstep(moteRange.x * pxs, moteRange.y * pxs, h);
        float rm0 = clamp(0.3 * sqrt(w0 * hq), 0.75 * pxs, 1.7 * pxs);
        float rm = sqrt(rm0 * rm0 + 0.25 * coc * coc);
        float moteI = 0.2 * w0 * hq / (3.14159 * rm * rm);
        float spread = (w0 * hq) / max(1e-6, (w0 + ext - hq) * ext);
        b *= mix(1.0, spread, leg);                         // defocus spreads the same energy
        moteI /= max(1e-6, mix(1.0, spread, leg));
        vec2 sz = leg > 0.001 ? vec2(w + (ext - hq), ext) : vec2(2.6 * rm);   // footprint in render px
        sz = max(sz, vec2(2.6 * rm));
        sz += abs(delta);
        gl_Position = projectionMatrix * mv;
        if (d < 0.05 || b < 1e-4) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }
        #ifdef POINTS
        vSize = max(sz.x, sz.y);
        gl_PointSize = vSize;
        #else
        vec2 cd = vec2(corner.x, -corner.y) * sz;           // corner offset, px, y down
        #ifdef STREAK
        float dl = length(delta);
        if (dl > 0.6) {                                     // a rectangle along the motion, not a box around it
          vec2 dn = delta / dl, nn = vec2(-dn.y, dn.x);
          float hx = max(0.5 * w, 0.5 * ext) + 1.5 * rm + 1.0, hy = max(0.5 * hq, 0.5 * ext) + 1.5 * rm + 1.0;
          float ea = abs(dn.x) * hx + abs(dn.y) * hy, ec = abs(dn.y) * hx + abs(dn.x) * hy;
          cd = dn * corner.x * (dl + 2.0 * ea) + nn * corner.y * 2.0 * ec;
        }
        #endif
        gl_Position.xy += vec2(cd.x, -cd.y) * 2.0 / res * gl_Position.w;
        vOff = vec2(cd.x, -cd.y);
        #endif
        vGeo = vec4(w, hq, max(0.0, 0.5 * (w + ext - hq - ext)), 0.5 * ext);
        vMote = vec3(leg, rm, moteI);
        vDelta = delta;
        vRect = R; vCol = col * b * gain;
        vBias = log2(max(1.0, coc / 1.6)) + extraBias;      // the mip whose texel ≈ CoC/2
        vDisc = smoothstep(discRange.x, discRange.y, coc / hq) * step(0.001, leg);
      }`,
    fragmentShader: P + /* glsl */ `
      uniform sampler2D atlas;
      varying vec4 vRect; varying vec3 vCol; varying float vBias, vDisc; varying vec4 vGeo; varying vec3 vMote; varying vec2 vDelta;
      #ifdef POINTS
      varying float vSize;
      #else
      varying vec2 vOff;
      #endif
      float glyphA(vec2 off) {
        float a = 0.0;
        if (vMote.x > 0.001) {
          vec2 q = vec2(off.x / vGeo.x, off.y / vGeo.y) + 0.5;
          if (vDisc < 0.999) {
            float inside = smoothstep(-0.03, 0.04, q.x) * smoothstep(1.03, 0.96, q.x) * smoothstep(-0.03, 0.04, q.y) * smoothstep(1.03, 0.96, q.y);
            if (inside > 0.0) a = texture(atlas, mix(vRect.xy, vRect.zw, clamp(q, 0.0, 1.0)), vBias).a * inside;
          }
          if (vDisc > 0.001) {
            float r = length(vec2(max(0.0, abs(off.x) - vGeo.z), off.y)) / vGeo.w;
            float disc = smoothstep(1.0, 0.8, r) * (0.78 + 0.3 * smoothstep(0.45, 0.92, r));
            a = mix(a, disc * 0.22, vDisc);
          }
        }
        if (vMote.x < 0.999) a = mix(exp(-dot(off, off) / (vMote.y * vMote.y)) * vMote.z, a, vMote.x);
        return a;
      }
      void main(){
        #ifdef POINTS
        vec2 off = (gl_PointCoord - 0.5) * vSize;           // px from centre, y down
        #else
        vec2 off = vec2(vOff.x, -vOff.y);
        #endif
        float a = 0.0;
        #ifdef STREAK
        // taps spaced ≤ ~0.4 of the glyph's smaller side, so the copies always overlap into a streak
        float len = length(vDelta);
        int nt = int(clamp(ceil(len / max(0.8, 0.4 * min(vGeo.x, vGeo.y))), 1.0, float(STREAK)));
        if (nt > 1) {
          // only the taps whose glyph box can cover this fragment are evaluated (a long streak in a
          // square point sprite is mostly empty: those fragments leave before any texture fetch)
          vec2 dn = vDelta / len;
          float hx = max(0.5 * vGeo.x, vGeo.w) + 1.5 * vMote.y + 1.0, hy = max(0.5 * vGeo.y, vGeo.w) + 1.5 * vMote.y + 1.0;
          float ea = abs(dn.x) * hx + abs(dn.y) * hy, ec = abs(dn.y) * hx + abs(dn.x) * hy;
          float al = dot(off, dn), ac = dot(off, vec2(-dn.y, dn.x));
          if (abs(ac) > ec || abs(al) > 0.5 * len + ea) discard;
          float kc = (al / len + 0.5) * float(nt) - 0.5, hw = ea / len * float(nt) + 1.0;
          int k0 = max(0, int(floor(kc - hw))), k1 = min(nt - 1, int(ceil(kc + hw)));
          for (int k = 0; k < STREAK; k++) { int kk = k0 + k; if (kk > k1) break; a += glyphA(off - vDelta * ((float(kk) + 0.5) / float(nt) - 0.5)); }
          a /= float(nt);
        } else a = glyphA(off);
        #else
        a = glyphA(off);
        #endif
        vec3 c = vCol * a;
        ${fragmentBody}
        if (a < 0.002) discard;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// Geometry for n glyphs: points (plain attributes) or instanced quads. Attributes get their own
// (dynamic) arrays so that a Compactor can rewrite them each frame.
export function glyphGeometry(n, attrs, { points = true } = {}) {
  const g = points ? new THREE.BufferGeometry() : new THREE.InstancedBufferGeometry();
  if (!points) {
    g.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
  }
  for (const [name, size] of Object.entries(GLYPH_ATTRS)) {
    const a = attrs[name] ? attrs[name].slice(0, n * size) : new Float32Array(n * size);
    if (!attrs[name] && name === 'iRect2' && attrs.iRect) a.set(attrs.iRect.subarray(0, n * 4));
    if (!attrs[name] && name === 'iCol') a.fill(1);
    const ba = points ? new THREE.BufferAttribute(a, size) : new THREE.InstancedBufferAttribute(a, size);
    ba.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(name, ba);
  }
  if (points) { g.setAttribute('position', g.getAttribute('iPos')); g.setDrawRange(0, n); }
  else { g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); g.instanceCount = n; }
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  return g;
}
export function glyphMesh(n, attrs, matOpts = {}) {
  const points = matOpts.points !== false;
  const geo = glyphGeometry(n, attrs, { points });
  const mat = glyphMaterial(getLexicon().texture, { ...matOpts, points });
  const mesh = points ? new THREE.Points(geo, mat) : new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
// Points for the many + quads for the big near ones, sharing uniforms (one `uniforms` object).
export function glyphField(n, attrs, matOpts = {}, { quadCap = 4000 } = {}) {
  const pts = glyphMesh(n, attrs, { ...matOpts, points: true });
  const quads = glyphMesh(Math.min(n, quadCap), attrs, { ...matOpts, points: false });
  quads.material.uniforms = pts.material.uniforms;
  quads.geometry.instanceCount = 0;
  const group = new THREE.Group(); group.add(pts); group.add(quads);
  return { group, pts, quads, uniforms: pts.material.uniforms };
}

// ---------------------------------------------------------------------------------------------
// Screen-space helpers (pixel coordinates at 1080p, y down; independent of render scale).
// A solid HDR rectangle (the cursor block): exact pixel edges.
export function screenRect() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { rect: { value: new THREE.Vector4(0, 0, 1, 1) }, color: { value: new THREE.Vector3(1, 1, 1) } },
    vertexShader: /* glsl */ `uniform vec4 rect; void main(){ vec2 c = position.xy * 0.5 + 0.5;
      vec2 px = mix(rect.xy, rect.zw, c); gl_Position = vec4(px.x / 960.0 - 1.0, 1.0 - px.y / 540.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); m.frustumCulled = false;
  return m;
}
// A canvas texture drawn into a pixel rect, normal blending with straight alpha (subtitles).
export function screenImage(canvas, { premulDark = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;   // v = 0 is the top row of the canvas
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide,
    uniforms: { tex: { value: tex }, rect: { value: new THREE.Vector4(0, 0, 1, 1) }, color: { value: new THREE.Vector3(1, 1, 1) }, opacity: { value: 1 } },
    vertexShader: /* glsl */ `uniform vec4 rect; varying vec2 vUv; void main(){ vec2 c = position.xy * 0.5 + 0.5; vUv = vec2(c.x, 1.0 - c.y);
      vec2 px = mix(rect.xy, rect.zw, vec2(c.x, 1.0 - c.y)); gl_Position = vec4(px.x / 960.0 - 1.0, 1.0 - px.y / 540.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tex; uniform vec3 color; uniform float opacity; varying vec2 vUv;
      void main(){ vec4 t = texture2D(tex, vUv); gl_FragColor = vec4(t.rgb * color, t.a * opacity); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); m.frustumCulled = false;
  m.tex = tex;
  return m;
}

// deterministic per-index hash in [0,1)
export const hash1 = (i, s = 0) => { let x = Math.imul((i + 1) ^ Math.imul(s + 0x9e37, 0x85ebca6b), 0xc2b2ae35); x ^= x >>> 15; x = Math.imul(x, 0x27d4eb2d); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
export { rng };

// ---------------------------------------------------------------------------------------------
// Per-frame CPU frustum compaction. SwiftShader pays for every vertex (4 per glyph quad) even when
// it is culled in the shader, so each frame we copy only the instances inside the letterboxed view
// frustum (plus a margin), and already born, into the GPU arrays. A pure function of (camera, t).
//   src:  { attrName: Float32Array(full n × size) } — the geometry's attributes get their own arrays
//   pos:  rest positions (n × 3); flow (optional): per-instance velocity, stride `flowStride` at
//         `flowOffset` (e.g. iB.xyz); birth (optional): Float32Array (skip while t < birth − 0.05)
//   always: number of trailing instances that are always kept (moving specials)
export class Compactor {
  constructor(geo, src, n, { pos, flow = null, flowStride = 3, flowOffset = 0, flowT0 = 0, birth = null, always = 0, instanced = false, big = null, bigPx = 12 } = {}) {
    Object.assign(this, { geo, src, n, pos, flow, flowStride, flowOffset, flowT0, birth, always, instanced, big, bigPx });
    this.names = Object.keys(src).filter(k => geo.getAttribute(k));
    this.count = n; this.bigCount = 0;
  }
  // tans: half-FOV tangents of the visible band; fpx: focal length in 1080p px (for routing)
  update(cam, t, { tanX, tanY, near = 0.3, margin = 1.5, fpx = 1000 }) {
    const e = cam.matrixWorldInverse.elements, P = this.pos, F = this.flow, B = this.birth;
    const fs = this.flowStride, fo = this.flowOffset, dt = t - this.flowT0, n = this.n, keepFrom = n - this.always;
    const outs = [this.names.map(k => [this.src[k], this.geo.getAttribute(k)])];
    if (this.big) outs.push(this.names.map(k => [this.src[k], this.big.getAttribute(k)]));
    const cap = this.big ? this.big.getAttribute('iPos').count : 0;
    const A = this.src.iA, Rc = this.src.iRect, bigPx = this.bigPx;
    let k = 0, kb = 0;
    for (let i = 0; i < n; i++) {
      let toBig = false;
      if (i < keepFrom) {
        if (B && t < B[i] - 0.05) continue;
        let x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2];
        if (F) { x += F[fs * i + fo] * dt; y += F[fs * i + fo + 1] * dt; z += F[fs * i + fo + 2] * dt; }
        const d = -(e[2] * x + e[6] * y + e[10] * z + e[14]);
        if (d < near) continue;
        const xv = e[0] * x + e[4] * y + e[8] * z + e[12];
        if (Math.abs(xv) > tanX * d + margin) continue;
        const yv = e[1] * x + e[5] * y + e[9] * z + e[13];
        if (Math.abs(yv) > tanY * d + margin) continue;
        if (this.big && kb < cap) {
          const asp = (Rc[4 * i + 2] - Rc[4 * i]) / Math.max(1e-6, Rc[4 * i + 3] - Rc[4 * i + 1]);
          toBig = A[4 * i] * fpx / d * Math.max(1, asp) > bigPx;
        }
      }
      const o = toBig ? kb++ : k++;
      for (const [s, a] of outs[toBig ? 1 : 0]) {
        const sz = a.itemSize, dst = a.array, oo = o * sz, q = i * sz;
        for (let j = 0; j < sz; j++) dst[oo + j] = s[q + j];
      }
    }
    const fin = (list, c, inst, geo) => {
      for (const [, a] of list) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, c * a.itemSize)); a.needsUpdate = true; }
      if (inst) geo.instanceCount = c; else geo.setDrawRange(0, c);
    };
    fin(outs[0], k, this.instanced, this.geo);
    if (this.big) fin(outs[1], kb, true, this.big);
    this.count = k; this.bigCount = kb;
    return k;
  }
}
// tangents of the half field of view inside the letterbox band (+ a small angular margin)
export function frustumTans(cam, H, barPx, pad = 0.04) {
  const tanY0 = 1 / cam.projectionMatrix.elements[5], tanX0 = 1 / cam.projectionMatrix.elements[0];
  return { tanX: tanX0 + pad, tanY: tanY0 * (1 - 2 * barPx / H) + pad };
}
