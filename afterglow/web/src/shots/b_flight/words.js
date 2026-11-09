// b_flight/words.js — the beam of S06 / S07-a: a river of 「有人吗？」 in the 24 verified languages of
// appendix A (the same list, texts and fonts as v1.3 w_stream: voices.js QUESTIONS, one phraseAtlas,
// Arabic / Hebrew right-to-left, Devanagari / Thai shaped as whole phrases).
//
// Layers (all drawn with the shared lens; the lens sits at the origin, objects are placed relative to it):
//   · crowd     — ~2600 phrases inside the beam (lateral σ 0.13 m around the axis, which runs 5.06 m to
//                 the lower left of the lens), moving with the stream: depth z = zFront(n) − w. They are
//                 texture, never a reading target: anything ≥ 12 px tall is held ≥ 9 px out of focus.
//                 Phrase cards face the lens with a horizontal baseline; analytic smear = half the
//                 frame's screen motion (180° shutter); defocus = expanded card + mip blur; "over"
//                 compositing (a glowing word still hides a little of what is behind it).
//   · near lane — ~80 large phrases on lanes close to the lens; in S07-a they pass between the lens
//                 and the probe (out of focus, dim): the craft is first seen in the gaps between them.
//   · core      — the integrated light of the words too small to resolve: a camera-facing ribbon along
//                 the axis, constant surface brightness (flux kept when it is thinner than a pixel),
//                 the 1679 bits of the 1974 Arecibo message as its light/dark rhythm near the root,
//                 fading into "word dust" beyond the front.
//   · root glow — the beam lit in the air at the root (S06-a only).
//   · heroes    — screen-space cards for the reading targets: the lead 「有人吗？」 and the four languages
//                 of S06-d; stroke HDR ≤ 0.4 (display ≈ 140) + a wider, dimmer warm halo; bloom mask.
import * as THREE from 'three';
import { phraseAtlas } from '../../lib/textatlas.js';
import { QUESTIONS, FONT_FOR, RTL } from '../../data/voices.js';
import { hdrForDisplay } from '../w_sea/lexicon.js';
import * as P from './path.js';

export const ORDER = ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'uk', 'pl', 'el', 'tr', 'ar', 'he', 'hi', 'th', 'vi', 'id', 'sw', 'nl', 'sv', 'la'];
const FONT_OVERRIDE = { el: '"Noto Serif Display VF"' };   // Cormorant Garamond has no Greek
export const questionFor = lang => (lang === 'en' ? QUESTIONS.find(v => v.t === 'Is anyone there?') : QUESTIONS.find(v => v.lang === lang));

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(6.2831853 * r());
const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = h => [s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255)];
const QA = hexLin(0xFFB36B), QB = hexLin(0xF2C98A), QC = hexLin(0xFF9A5C);

export async function assertFonts(list) {
  const c = document.createElement('canvas').getContext('2d');
  for (const [spec, sample] of list) {
    try { await document.fonts.load(spec, sample); } catch (e) { /* system font */ }
    if (!document.fonts.check(spec, sample)) throw new Error(`b_flight: font check failed: ${spec}`);
    const fam = spec.replace(/^(italic\s+)?\d+\s+\d+px\s+/, '');
    if (!fam.includes(',')) {
      c.font = `${spec}, monospace`; const a = c.measureText(sample).width;
      c.font = `${spec}, serif`; const b = c.measureText(sample).width;
      if (Math.abs(a - b) > 0.01) throw new Error(`b_flight: font missing (falls back): ${spec} for "${sample}"`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// shared GLSL: a phrase card in screen space with smear taps and mip blur
const CARD_FRAG = /* glsl */ `
  uniform sampler2D uAtlas; uniform float uAtlasH;
  varying vec2 vLocal; varying vec2 vWH; varying vec2 vSm; varying float vBlur; varying vec4 vRect; varying vec3 vCol; varying float vA; varying float vOcc;
  float inkAt(vec2 q, float lod){
    // q in card units [0,1]²; outside → 0
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 0.0;
    vec2 uv = vec2(mix(vRect.x, vRect.z, q.x), mix(vRect.w, vRect.y, q.y));
    return textureLod(uAtlas, uv, lod).a;
  }
  void main(){
    float sm = length(vSm);
    float taps = clamp(ceil(sm / 1.5), 1.0, 20.0);
    float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float lod = log2(max(1.0, uAtlasH / max(vWH.y, 0.5) * max(1.0, 0.8 * vBlur)));
    float a = 0.0;
    for (int k = 0; k < 20; k++) {
      if (float(k) >= taps) break;
      float tt = (float(k) + j) / taps;
      a += inkAt(vLocal + vSm * tt / vWH, lod);
    }
    a /= taps;
    gl_FragColor = vec4(vCol * vA * a, a * vOcc);
  }`;

export async function createWords(ctx, { lensCam, needStream = true, needHeroes = true }) {
  const { renderer, W, H } = ctx;
  const S = H / 1080;

  // ---- fonts and the phrase atlas (crowd) ---------------------------------------------------------------
  const items = ORDER.map(lang => {
    const q = questionFor(lang);
    if (!q) throw new Error(`b_flight: no verified question for ${lang}`);
    return { text: q.t, lang, font: FONT_OVERRIDE[lang] || FONT_FOR(lang), rtl: RTL.has(lang), weight: 600 };
  });
  const PH = 112;
  await assertFonts(items.map(it => [`${it.weight} ${Math.round(PH * 0.62)}px ${it.font}`, it.text.replace(/[\s?？;¿’'.,!-]/g, '')]).concat([
    ['600 200px "Noto Serif CJK SC"', '有人吗'], ['italic 400 70px "Cormorant Garamond"', 'Is anyone there'],
    ['400 70px "Noto Serif CJK JP"', '誰かいますか'], ['italic 400 64px "Cormorant Garamond"', 'Hay alguien ahí'],
    ['400 64px "Noto Naskh Arabic"', 'هل يوجد أحد هنا'],
  ]));
  const atlas = phraseAtlas(items, { height: PH, size: 4096, pad: 14, weight: 600 });
  if (atlas.rects.length !== items.length) throw new Error('b_flight: phrase atlas overflow');
  atlas.texture.anisotropy = 1;

  const out = { scenes: [], heroes: null };

  // =====================================================================================================
  // crowd + near lane
  // =====================================================================================================
  if (needStream) {
    const R = rng(55 * 1000 + 61);
    const inst = [];
    // crowd: inside the beam, w ∈ [0, 160] m behind the front, density ramping up behind it
    const W_MAX = 165, RHO0 = 17;                                   // phrases per metre where dense
    for (let w = 0.2; w < W_MAX; w += 0.02) {
      if (R() > RHO0 * 0.02 * P.streamDensity(w)) continue;
      const k = Math.floor(R() * ORDER.length), rc = atlas.rects[k];
      const lat = 0.13 * Math.min(2.6, Math.abs(gauss(R))) , ang = R() * 6.2831853;
      const hh = 0.04 + 0.09 * Math.pow(R(), 1.8);
      const tint = R(), col = tint < 0.55 ? QA : tint < 0.82 ? QB : QC;
      inst.push({ rc, w: w + 0.02 * R(), x: P.BOFF[0] + lat * Math.cos(ang), y: P.BOFF[1] + lat * Math.sin(ang), h: hh, b: 0.75 + 0.5 * R(), col, ap: 1, near: 0 });
    }
    const nCrowd = inst.length;
    // near lane: lanes close to the lens, around the beam's screen direction; in S07-a they pass in front
    // of the probe (w ≈ 50–112 m behind the front), the last batch f3264–3311 (w ≈ 52–68)
    const R2 = rng(55 * 1000 + 62);
    const dirAng = Math.atan2(-P.BEAM_SCREEN_DIR[1], P.BEAM_SCREEN_DIR[0]);   // world (x, y) angle of the axis offset
    for (let i = 0; i < 84; i++) {
      const w = i < 10 ? 52 + 16 * R2() : 66 + 46 * Math.pow(R2(), 0.8);
      const o = 0.55 + 1.6 * R2(), a = dirAng + (R2() - 0.5) * 0.62;
      const k = Math.floor(R2() * ORDER.length), rc = atlas.rects[k];
      inst.push({ rc, w, x: o * Math.cos(a), y: o * Math.sin(a), h: 0.32 + 0.5 * R2(), b: 0.55 + 0.25 * R2(), col: R2() < 0.6 ? QA : QB, ap: 2.6, near: 1 });
    }
    const N = inst.length;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const A = (n, f) => { const a = new Float32Array(N * n); inst.forEach((it, i) => a.set(f(it), i * n)); return new THREE.InstancedBufferAttribute(a, n); };
    geo.setAttribute('aRect', A(4, it => it.rc.slice(0, 4)));
    geo.setAttribute('aAsp', A(1, it => [it.rc[4]]));
    geo.setAttribute('aWXY', A(3, it => [it.w, it.x, it.y]));
    geo.setAttribute('aHB', A(4, it => [it.h, it.b, it.ap, it.near]));
    geo.setAttribute('aCol', A(3, it => it.col));
    geo.instanceCount = N;
    const U = {
      uAtlas: { value: atlas.texture }, uAtlasH: { value: PH * 4096 / 4096 },
      uZF: { value: 100 }, uZFp: { value: 100 }, uLat: { value: new THREE.Vector2() }, uLatP: { value: new THREE.Vector2() },
      uPVp: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(W, H) }, uPx: { value: S },
      uInvZf: { value: 1 / 45 }, uApF: { value: 0.08 * P.F35 }, uZRoot: { value: 0 }, uGain: { value: 1 }, uNearGain: { value: 1 },
      uCard: { value: new THREE.Vector4(690, 735, 1230, 830) }, uCardDim: { value: 0 }, uHole: { value: new THREE.Vector4(0, 0, 0, 0) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */ `
        attribute vec4 aRect; attribute float aAsp; attribute vec3 aWXY; attribute vec4 aHB; attribute vec3 aCol;
        uniform float uZF, uZFp, uPx, uInvZf, uApF, uZRoot, uGain, uNearGain, uCardDim; uniform vec2 uLat, uLatP, uRes; uniform mat4 uPVp; uniform vec4 uCard, uHole;
        varying vec2 vLocal; varying vec2 vWH; varying vec2 vSm; varying float vBlur; varying vec4 vRect; varying vec3 vCol; varying float vA; varying float vOcc;
        vec2 toPx(vec4 c){ return (c.xy / c.w * 0.5 + 0.5) * uRes; }
        void main(){
          float z = uZF - aWXY.x, zp = uZFp - aWXY.x;
          vec3 Pn = vec3(aWXY.yz - uLat, -z), Pp = vec3(aWXY.yz - uLatP, -zp);
          vec4 c = projectionMatrix * viewMatrix * vec4(Pn, 1.0);
          vec4 cp = uPVp * vec4(Pp, 1.0);
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          vA = 0.0; vOcc = 0.0;
          if (c.w < 0.25 || cp.w < 0.25 || z < uZRoot) return;
          vec2 s = toPx(c), sp = toPx(cp);
          float fy = projectionMatrix[1][1] * uRes.y * 0.5;
          float hPx = fy * aHB.x / c.w;                         // render px
          float h1080 = hPx / uPx;
          if (h1080 < 2.0) return;
          float wPx = hPx * aAsp;
          // depth of field (1080p px), and the guard: no crowd phrase ≥ 12 px is ever sharp
          float b = uApF * aHB.z * abs(1.0 / c.w - uInvZf);
          b = max(b, smoothstep(10.0, 14.0, h1080) * (9.0 + 0.35 * max(h1080 - 12.0, 0.0)));
          float bPx = b * uPx;
          vec2 sm = s - sp;                                     // half-frame screen motion (px)
          // the card's box: text box ∪ text box shifted back by sm, expanded by the blur
          vec2 hw = vec2(wPx, hPx) * 0.5 + bPx;
          vec2 lo = min(s, sp) - hw, hi = max(s, sp) + hw;
          if (hi.x < 0.0 || lo.x > uRes.x || hi.y < 0.0 || lo.y > uRes.y) return;
          vec2 q = mix(lo, hi, position.xy);
          gl_Position = vec4(q / uRes * 2.0 - 1.0, c.z / c.w, 1.0);
          // local card coordinate of this corner at the sample time "now"; taps walk back along sm
          vLocal = (q - s) / vec2(wPx, hPx) + 0.5; vLocal.y = vLocal.y;   // y: card v grows upwards in screen
          vWH = vec2(wPx, hPx); vSm = sm; vBlur = bPx; vRect = aRect;
          // energy: spread over the blurred card; fade in from sub-pixel (the core carries the rest)
          float spread = (hPx * wPx) / ((hPx + 1.6 * bPx) * (wPx + 1.6 * bPx));
          float I = aHB.y * smoothstep(2.0, 4.5, h1080) * mix(1.0, spread, 0.55);
          I *= aHB.w > 0.5 ? uNearGain : 1.0;
          // card ③ (cards.js, y 735–830) keeps a clean patch of sky; and a hole around the reading target
          vec2 s1080 = vec2(s.x, uRes.y - s.y) / uPx;
          float inCard = (1.0 - smoothstep(0.0, 60.0, max(max(uCard.x - s1080.x, s1080.x - uCard.z), max(uCard.y - s1080.y - 30.0, s1080.y - uCard.w))));
          I *= 1.0 - uCardDim * inCard;
          if (uHole.z > 0.0) { vec2 dh = (s1080 - uHole.xy) / uHole.zw; I *= 1.0 - 0.75 * exp(-dot(dh, dh) * 1.5); }
          vCol = aCol * uGain; vA = I; vOcc = 0.55 * smoothstep(2.0, 6.0, h1080);
        }`,
      fragmentShader: CARD_FRAG,
    });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 20;

    // ---- the core ribbon ------------------------------------------------------------------------------
    const SEG = 600;
    const cg = new THREE.BufferGeometry();
    { const a = new Float32Array((SEG + 1) * 2 * 3); for (let i = 0; i <= SEG; i++) for (let j = 0; j < 2; j++) a.set([i / SEG, j * 2 - 1, 0], (i * 2 + j) * 3);
      const idx = []; for (let i = 0; i < SEG; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      cg.setAttribute('position', new THREE.BufferAttribute(a, 3)); cg.setIndex(idx); }
    const bits = new Uint8Array(1679 * 4);
    const { ARECIBO } = await import('../m_beam/arecibo.js');
    for (let i = 0; i < 1679; i++) bits[4 * i] = ARECIBO[i] === '1' ? 255 : 0;
    const bitTex = new THREE.DataTexture(bits, 1679, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    bitTex.minFilter = bitTex.magFilter = THREE.NearestFilter; bitTex.needsUpdate = true;
    const CU = {
      uZF: U.uZF, uLat: U.uLat, uRes: U.uRes, uPx: U.uPx, uZRoot: U.uZRoot, uZNear: { value: 0.5 }, uZFar: { value: 300 },
      uBeam: { value: new THREE.Vector2(...P.BOFF) }, uSig: { value: 0.105 }, uI: { value: 0.42 }, uBits: { value: bitTex },
      uCol: { value: new THREE.Vector3(1.0, 0.47, 0.16) }, uDust: { value: 1 }, uCard: U.uCard, uCardDim: U.uCardDim,
    };
    const core = new THREE.Mesh(cg, new THREE.ShaderMaterial({
      uniforms: CU, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uZF, uZRoot, uZNear, uZFar, uPx, uSig; uniform vec2 uLat, uRes, uBeam;
        varying float vAcross, vI, vZ, vSigPx, vW;
        vec2 toPx(vec4 c){ return (c.xy / c.w * 0.5 + 0.5) * uRes; }
        void main(){
          float z = uZNear * pow(uZFar / uZNear, position.x);
          float dz = z * 0.004;
          vec4 c = projectionMatrix * viewMatrix * vec4(uBeam - uLat, -z, 1.0);
          vec4 c2 = projectionMatrix * viewMatrix * vec4(uBeam - uLat, -(z + dz), 1.0);
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vI = 0.0;
          if (c.w < 0.2 || c2.w < 0.2) return;
          vec2 s = toPx(c), s2 = toPx(c2), t = normalize(s2 - s + 1e-6), nrm = vec2(-t.y, t.x);
          float fy = projectionMatrix[1][1] * uRes.y * 0.5;
          float sig = fy * uSig / c.w;                               // render px
          float sg = max(sig, 0.8 * uPx);
          float hw = 3.2 * sg;
          vec2 q = s + nrm * position.y * hw;
          gl_Position = vec4(q / uRes * 2.0 - 1.0, c.z / c.w, 1.0);
          vAcross = position.y * 3.2; vZ = z; vW = uZF - z; vSigPx = sig / uPx;
          vI = min(1.0, sig / sg);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uI, uZRoot, uZF, uDust, uPx, uCardDim; uniform vec3 uCol; uniform sampler2D uBits; uniform vec4 uCard; uniform vec2 uRes;
        varying float vAcross, vI, vZ, vSigPx, vW;
        void main(){
          if (vZ < uZRoot) discard;
          float prof = exp(-0.5 * vAcross * vAcross);
          // density of the stream behind the front (word dust beyond it)
          float w = vW;
          float dens = w > 0.0 ? pow(smoothstep(0.0, 120.0, w), 1.6) : 0.0;
          float dust = uDust * 0.22 * exp(-max(-w, 0.0) / 14.0) * (1.0 - smoothstep(-2.0, 6.0, w));
          float I = uI * vI * (0.08 + 0.92 * dens) + uI * vI * dust;
          // the Arecibo bits near the root: 1679 beads, 4.5 cm apart, flowing with the words
          float rz = vZ - uZRoot;
          float near = 1.0 - smoothstep(2.0, 3.6, rz);
          if (near > 0.0) {
            float sp = 0.045, f = w / sp, kc = floor(f + 0.5), m = 0.0;
            for (int j = -1; j <= 1; j++) { float k = kc + float(j), x = (f - k) / 0.45;
              m += texelFetch(uBits, ivec2(int(mod(k + 1679.0 * 64.0, 1679.0)), 0), 0).r * exp(-0.5 * x * x); }
            I *= 1.0 + near * 0.42 * (2.0 * min(m, 1.0) - 1.0);
            I *= 1.0 + 0.6 * exp(-rz / 0.6);                      // the root itself is brightest
          }
          vec2 p1080 = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uPx;
          float inCard = 1.0 - smoothstep(0.0, 50.0, max(max(uCard.x - p1080.x, p1080.x - uCard.z), max(uCard.y - p1080.y, p1080.y - uCard.w)));
          I *= 1.0 - 0.8 * uCardDim * inCard;
          gl_FragColor = vec4(uCol * I * prof, 1.0);
        }`,
    }));
    core.frustumCulled = false; core.renderOrder = 15;

    // ---- the root glow (the beam lit in the air) ------------------------------------------------------
    const RG = { uC: { value: new THREE.Vector2() }, uI: { value: 0 }, uRes: U.uRes, uPx: U.uPx };
    const rootGlow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: RG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `uniform vec2 uC, uRes; uniform float uI, uPx;
        void main(){ vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uPx; vec2 d = p - uC;
          float r = length(d);
          float g = 0.55 / (1.0 + pow(r / 26.0, 2.0)) + 0.14 * exp(-r / 140.0);
          gl_FragColor = vec4(vec3(1.0, 0.56, 0.26) * g * uI, 1.0); }`,
    }));
    rootGlow.frustumCulled = false; rootGlow.renderOrder = 16;
    const scene = new THREE.Scene(); scene.add(core, mesh);
    const glowScene = new THREE.Scene(); glowScene.add(rootGlow);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    out.stream = {
      count: N, nCrowd, U, CU, scene,
      // state for frame n; fade = global opacity (B2: the words go out as the lens turns)
      update(n, camPrevPV, latNow, latPrev, fade) {
        const dt = 0.5;                                          // half a frame (180° shutter)
        U.uZF.value = P.zFront(n); U.uZFp.value = P.zFront(n - dt);
        U.uLat.value.set(latNow[0], latNow[1]); U.uLatP.value.set(latPrev[0], latPrev[1]);
        U.uPVp.value.copy(camPrevPV);
        U.uInvZf.value = 1 / P.focusDepth(n);
        U.uZRoot.value = P.rootDepth(n);
        U.uGain.value = fade;
        U.uNearGain.value = fade;
        U.uCardDim.value = P.sstep(2944, 2960, n) * (1 - P.sstep(3040, 3054, n));
        CU.uZNear.value = Math.max(0.6, P.rootDepth(n));
        CU.uZFar.value = P.zFront(n) + 70;
        CU.uI.value = 0.42 * fade;
        RG.uI.value = P.rootDepth(n) > 0.2 ? fade * P.sstep(0.2, 2.0, P.rootDepth(n)) : 0;
      },
      setRootPx(px) { RG.uC.value.set(px[0], px[1]); },
      setHole(v) { U.uHole.value.set(...v); },
      render(target, cam) {
        renderer.setRenderTarget(target);
        renderer.render(scene, cam);
        if (RG.uI.value > 0) renderer.render(glowScene, ortho);
      },
    };
  }

  // =====================================================================================================
  // the reading targets (screen space)
  // =====================================================================================================
  if (needHeroes) {
    // each hero: its own canvas texture: R = ink, G = halo (ink blurred), measured ink box
    const mk = (text, font, { rtl = false, emPx = 220, halo = 0.055 } = {}) => {
      const g0 = document.createElement('canvas').getContext('2d');
      g0.font = `${font.replace('{px}', emPx)}`; g0.direction = rtl ? 'rtl' : 'ltr';
      const m = g0.measureText(text);
      const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const pad = Math.ceil(emPx * 0.35);
      const cw = Math.ceil(inkW + 2 * pad), ch = Math.ceil(inkH + 2 * pad);
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const g = c.getContext('2d');
      g.font = g0.font; g.direction = g0.direction; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const x0 = pad + m.actualBoundingBoxLeft, y0 = pad + m.actualBoundingBoxAscent;
      // halo first (G), then ink (R) — separate passes through a scratch canvas
      const s = document.createElement('canvas'); s.width = cw; s.height = ch; const gs = s.getContext('2d');
      gs.font = g0.font; gs.direction = g0.direction; gs.textBaseline = 'alphabetic'; gs.fillStyle = '#fff';
      gs.filter = `blur(${(emPx * halo).toFixed(1)}px)`; gs.fillText(text, x0, y0);
      const halaData = gs.getImageData(0, 0, cw, ch).data;
      gs.filter = 'none'; gs.clearRect(0, 0, cw, ch); gs.fillText(text, x0, y0);
      const inkData = gs.getImageData(0, 0, cw, ch).data;
      const img = g.createImageData(cw, ch);
      for (let i = 0; i < cw * ch; i++) { img.data[4 * i] = inkData[4 * i + 3]; img.data[4 * i + 1] = Math.min(255, halaData[4 * i + 3] * 1.6); img.data[4 * i + 2] = 0; img.data[4 * i + 3] = 255; }
      g.putImageData(img, 0, 0);
      const tex = new THREE.CanvasTexture(c); tex.flipY = false; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.colorSpace = THREE.NoColorSpace;
      // ink box in canvas px; centre of the ink
      return { tex, cw, ch, emPx, inkW, inkH, inkCx: pad + inkW / 2, inkCy: pad + inkH / 2, text };
    };
    const H_LEAD = mk('有人吗？', '600 {px}px "Noto Serif CJK SC"', { emPx: 240 });
    const H_EN = mk('Is anyone there?', 'italic 500 {px}px "Cormorant Garamond"', { emPx: 200 });
    const H_JA = mk('誰かいますか？', '500 {px}px "Noto Serif CJK JP"', { emPx: 200 });
    const H_ES = mk('¿Hay alguien ahí?', 'italic 500 {px}px "Cormorant Garamond"', { emPx: 200 });
    const H_AR = mk('هل يوجد أحد هنا؟', '500 {px}px "Noto Naskh Arabic"', { emPx: 200, rtl: true });
    const STROKE = hdrForDisplay('#FFB36B', 0.76);              // display ≈ (194, 136, 81), L ≈ 145
    const HALO = hdrForDisplay('#FFB36B', 0.20);
    const makeCard = (h) => {
      const U = {
        uTex: { value: h.tex }, uC: { value: new THREE.Vector2() }, uScale: { value: 1 }, uSm: { value: new THREE.Vector2() },
        uBlur: { value: 0 }, uI: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, uPx: { value: S }, uCanvas: { value: new THREE.Vector4(h.cw, h.ch, h.inkCx, h.inkCy) },
        uStroke: { value: new THREE.Vector3(...STROKE) }, uHalo: { value: new THREE.Vector3(...HALO) }, uMask: { value: 0 },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms: U, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        vertexShader: /* glsl */ `
          uniform vec2 uC, uSm, uRes; uniform float uScale, uBlur, uPx; uniform vec4 uCanvas;
          varying vec2 vQ;                                       // canvas px of this fragment at "now"
          void main(){
            // card corners in 1080p px: canvas box scaled about the ink centre, ∪ shifted by the smear, + blur
            vec2 a = uC - uCanvas.zw * uScale, b = uC + (uCanvas.xy - uCanvas.zw) * uScale;
            vec2 lo = min(a, a - uSm) - uBlur - 2.0, hi = max(b, b - uSm) + uBlur + 2.0;
            vec2 q = mix(lo, hi, position.xy);
            vQ = (q - uC) / uScale + uCanvas.zw;
            vec2 pr = q * uPx; pr.y = uRes.y - pr.y;
            gl_Position = vec4(pr / uRes * 2.0 - 1.0, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uTex; uniform vec2 uSm; uniform float uScale, uBlur, uI, uMask; uniform vec4 uCanvas; uniform vec3 uStroke, uHalo;
          varying vec2 vQ;
          void main(){
            float sm = length(uSm) / uScale;                     // canvas px
            float taps = clamp(ceil(length(uSm) / 1.2), 1.0, 32.0);
            float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            float lod = log2(max(1.0, max(1.0 / uScale, uBlur * 0.9 / uScale)));
            vec2 acc = vec2(0.0);
            for (int k = 0; k < 32; k++) {
              if (float(k) >= taps) break;
              vec2 q = vQ + (uSm / uScale) * (float(k) + j) / taps;
              vec2 uv = q / uCanvas.xy;
              if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;
              acc += textureLod(uTex, uv, lod).rg;
            }
            acc /= taps;
            if (uMask > 0.5) { float m = clamp(acc.r * 1.5 + acc.g * 0.9, 0.0, 1.0); gl_FragColor = vec4(m, m, 0.0, 1.0); return; }
            vec3 col = (uStroke * acc.r + uHalo * acc.g * (1.0 - acc.r)) * uI;
            float a = clamp(acc.r * 0.9 + acc.g * 0.25, 0.0, 1.0) * uI;
            gl_FragColor = vec4(col, a);
          }`,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), mat); mesh.frustumCulled = false;
      const maskMat = mat.clone(); maskMat.uniforms = U; maskMat.blending = THREE.CustomBlending; maskMat.blendEquation = THREE.MaxEquation; maskMat.blendSrc = THREE.OneFactor; maskMat.blendDst = THREE.OneFactor;
      return { h, U, mesh, mat, maskMat };
    };
    const heroes = { lead: makeCard(H_LEAD), en: makeCard(H_EN), ja: makeCard(H_JA), es: makeCard(H_ES), ar: makeCard(H_AR) };
    const heroScene = new THREE.Scene();
    for (const k of Object.keys(heroes)) heroScene.add(heroes[k].mesh);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    out.heroes = {
      cards: heroes,
      // state: { key: { c:[x,y], inkH|fontPx, sm:[dx,dy], blur, I } }
      apply(state) {
        let any = false;
        for (const k of Object.keys(heroes)) {
          const hc = heroes[k], s = state[k];
          if (!s || s.I <= 0.001) { hc.mesh.visible = false; continue; }
          any = true; hc.mesh.visible = true;
          const scale = s.inkH ? s.inkH / hc.h.inkH : s.fontPx / hc.h.emPx;
          hc.U.uC.value.set(s.c[0], s.c[1]); hc.U.uScale.value = scale; hc.U.uSm.value.set(s.sm[0], s.sm[1]);
          hc.U.uBlur.value = s.blur; hc.U.uI.value = s.I;
        }
        return any;
      },
      render(target) { renderer.setRenderTarget(target); for (const k of Object.keys(heroes)) heroes[k].mat.uniforms.uMask.value = 0; renderer.render(heroScene, ortho); },
      renderMask(mask) {
        const ac = renderer.autoClear; renderer.autoClear = false;
        for (const k of Object.keys(heroes)) { heroes[k].mesh.material = heroes[k].maskMat; heroes[k].U.uMask.value = 1; }
        renderer.setRenderTarget(mask); renderer.render(heroScene, ortho);
        for (const k of Object.keys(heroes)) { heroes[k].mesh.material = heroes[k].mat; heroes[k].U.uMask.value = 0; }
        renderer.autoClear = ac;
      },
    };
  }
  return out;
}

// =====================================================================================================
// the reading schedule (pure functions of n): screen centre (1080p), size, smear, focus, intensity
// =====================================================================================================
const leadInk = P.pchip([[3020, Math.log(14)], [3048, Math.log(40)], [3060, Math.log(68)], [3078, Math.log(118)], [3096, Math.log(150)], [3131, Math.log(170)]]);
function leadAt(n) {
  // before f3048: on its lane, growing like a word on the stream (centre ∝ size from the VP)
  const C48 = [1080, 470], C131 = [900, 560];
  let c, inkH;
  if (n <= 3131) {
    inkH = Math.exp(n < 3020 ? Math.log(14) + (n - 3020) * 0.045 : leadInk(n));
    if (n >= 3048) { const u = (n - 3048) / (3131 - 3048); c = [P.lerp(C48[0], C131[0], u), P.lerp(C48[1], C131[1], u)]; }
    else { const k = inkH / 40; c = [P.VP[0] + (C48[0] - P.VP[0]) * k, P.VP[1] + (C48[1] - P.VP[1]) * k]; }
  } else {
    // f3132–3149: the lens accelerates, it sweeps out to the lower left (gone before f3150)
    const u = (n - 3131) / 18;
    const d = 1180 * u * u + 2.4 * 18 * u, ex = [-0.80, 0.60];
    inkH = 170 * (1 + 0.55 * u * u);
    const drift = [(C131[0] - C48[0]) / 83, (C131[1] - C48[1]) / 83];
    c = [C131[0] + ex[0] * d + drift[0] * 0, C131[1] + ex[1] * d];
  }
  return { c, inkH };
}
// the four languages of S06-d: [window start, window end), key, font px at mid-window, centre at mid-window
export const FOUR = [
  { key: 'en', w: [3150, 3170], px: 70, c: [930, 520] },
  { key: 'ja', w: [3165, 3185], px: 70, c: [990, 458] },
  { key: 'es', w: [3180, 3200], px: 64, c: [930, 520] },
  { key: 'ar', w: [3195, 3216], px: 64, c: [990, 458] },
];
function fourAt(f, n) {
  const m = (f.w[0] + f.w[1]) / 2, g = 0.016;
  const t = n - m;
  const tail = Math.max(0, n - (f.w[1] - 4));
  const zeta = Math.max(0.06, 1 - g * t - 0.0042 * tail * tail);
  const c = [P.VP[0] + (f.c[0] - P.VP[0]) / zeta, P.VP[1] + (f.c[1] - P.VP[1]) / zeta];
  return { c, px: f.px / zeta, zeta };
}
export function heroState(n) {
  const st = {};
  const dt = 0.5;
  // lead
  if (n > 2990 && n < 3152) {
    const a = leadAt(n), b = leadAt(n - dt);
    // focus: out of focus until f3048 (≥ 6 px blur at 720p), racked in f3048–3059, sharp to f3131
    const blur = n < 3048 ? 11 + 0.08 * a.inkH : n < 3060 ? (11 + 0.08 * 40) * (1 - P.sstep(3048, 3060, n)) : n <= 3131 ? 0 : 4 + 0.3 * (n - 3131);
    const fadeIn = P.sstep(2995, 3020, n);
    st.lead = { c: a.c, inkH: a.inkH, sm: [a.c[0] - b.c[0], a.c[1] - b.c[1]], blur, I: fadeIn * (n < 3048 ? 0.55 : 1) };
  }
  for (const f of FOUR) {
    if (n < f.w[0] - 22 || n > f.w[1] + 26) continue;
    const a = fourAt(f, n), b = fourAt(f, n - dt);
    if (a.c[0] + a.px * 6 < -50 || a.c[1] - a.px > 960) continue;
    // focus pull per sentence: sharp on its window, soft before/after
    const before = 1 - P.sstep(f.w[0] - 3, f.w[0], n), after = P.sstep(f.w[1], f.w[1] + 4, n);
    const blur = 12 * before + (6 + 0.4 * Math.max(0, n - f.w[1])) * after;
    const I = P.sstep(f.w[0] - 22, f.w[0] - 10, n) * (before > 0.5 ? 0.6 : 1);
    st[f.key] = { c: a.c, fontPx: a.px, sm: [a.c[0] - b.c[0], a.c[1] - b.c[1]], blur, I };
  }
  return st;
}
// the reading target's screen box (for the crowd's clear pocket around it): [cx, cy, rx, ry] (1080p)
export function readingHole(n) {
  const st = heroState(n);
  if (st.lead && n >= 3040 && n <= 3134) return [st.lead.c[0], st.lead.c[1], st.lead.inkH * 2.6, st.lead.inkH * 1.0];
  for (const f of FOUR) if (st[f.key] && n >= f.w[0] && n < f.w[1]) return [st[f.key].c[0], st[f.key].c[1], st[f.key].fontPx * 4.5, st[f.key].fontPx * 0.9];
  return [0, 0, 0, 0];
}
