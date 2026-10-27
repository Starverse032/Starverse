// w_sea — the sea of words (v2).
//   S34 = S08-a/b/c [3864, 4320)  24 mm, WEB_PATH(9.0) pose (= the S02 f1128 composition, hero.first at R).
//     S08-a [3864, 3960)  f3864 continues B2's last frame pixel for pixel (w_sea/handoff.js): the blue dot
//        at R warms (#82A4DA → #FFE2B8, 48 frames) into a node (6-px core + 24-px glow); the hero node's
//        clump of words grows around it; 1.5-px amber threads (20 %) grow from the node to its nearest
//        words at ≈ 40 px/s and on to the next ones; B2's stars (= the web's nodes) flicker and turn,
//        nearest to R first, into 6–9 px words. f3900 the star at (900, 450) grows in 12 frames into
//        𒀭 (72 px, AMBER), readable f3912–3947, back to ≤ 12 px by f3959.
//     S08-b [3960, 4104)  the dark fills along the filaments, far first (≈ 150 000 words; sub-legible
//        words are points of light; > 18 px ones are instanced quads), a faint VIOLET fog; complete by
//        f4032. Card ④ [3966, 4062): words in y 682–942 thinned to 40 %. f4068–4103 the true cosmic web
//        of f1128 (a_origin/web.js rendered at fr = 1128: same graph, same pose) at 35 % over it.
//     S08-c [4104, 4320)  the camera pushes along the ray to N2 (a heavy node right of R, ≈ (1180, 470)):
//        ≈ 1 %/frame magnification there, soft start; never back towards R. f4152–4193 the tracked point
//        grows 3 → 12 px and opens into 「遂古之初，谁传道之？」 (52 → 64 px, readable f4194–4241), then
//        Is anyone there? f4242–4265, 「誰かいますか？」 f4266–4289, the Arabic line f4290–4313 (one at a
//        time, racked in / out). Other words ≤ 32 px; warm amber fog.
//   S36 = S08-d [4320, 4416)  100 mm, extremely shallow focus: सो अङ्ग वेद यदि वा न वेद (56 px, stroke
//        HDR 0.4 + a wide warm halo), सो centred on R; f4320–4355 alone; f4356 SB1 「……或许，他也不知道。」
//        (300 48 px, baseline 846, drawn here; no bloom via the V2 mask) with SB2 (cards.js).
// All motion is analytic in t. No cursor, no heartbeat in this segment.
import * as THREE from 'three';
import { getWeb, sampleWebPoints, webPathPose } from './_webgraph.js';
import { getLexicon, assertFonts, PAL, hexLin, glyphMesh, glyphField, screenImage, hdrForDisplay, hash1, rng, RIGVEDA_7, Compactor, frustumTans } from './w_sea/lexicon.js';
import { createHandoffLayer, handoffStars, handoffPost, nodeMorph, BLUE_DOT } from './w_sea/handoff.js';
import { textTextures, textPlane, inkBox, maskRectMaterial } from './q_apex/text.js';

const FPS = 24;
const T34 = 3864 / FPS, T36 = 4320 / FPS;
const R = [734, 540];
const FPX24 = 960 / (18 / 24);
const FPX100 = 960 / (18 / 100);
const N_SEA = 142000, N_NEAR = 16000, N2_CLUMP = 1400, N_MOTE = 300000, N_GAS = 24000;
const CARD4 = [165.25, 169.25, 0.75];
const COLD = [4068, 4104];                      // cold-web overlay (frames)
const PUSH0 = 4104;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const env = (t, a, b, fi, fo) => Math.min(smooth(a, a + fi, t), 1 - smooth(b - fo, b, t));
const luma = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const atLevel = (lin, L) => lin.map(v => v * L / luma(lin));

// S08-c readable lines (frames): window [f0, f1), size px at f0 → f1, offset from the focus of expansion
const LINES = [
  { text: '遂古之初，谁传道之？', font: '400 60px "Noto Serif CJK SC"', f0: 4194, f1: 4242, px: [52, 64], off: [0, 0] },
  { text: 'Is anyone there?', font: 'italic 400 60px "Cormorant Garamond"', f0: 4242, f1: 4266, px: [50, 58], off: [-30, 6] },
  { text: '誰かいますか？', font: '400 60px "Noto Serif CJK JP"', f0: 4266, f1: 4290, px: [48, 56], off: [24, -8] },
  { text: 'هل يوجد أحد هنا؟', font: '400 60px "Noto Naskh Arabic"', f0: 4290, f1: 4314, px: [50, 60], off: [-10, 4], rtl: true },
];

export async function create(ctx) {
  const { THREE: T, renderer, W, H, kit, makeRT } = ctx;
  const sh = id => ctx.timeline.shots.find(s => s.id === id);
  const need34 = ctx.shotInRange(sh('S34'), 0.6), need36 = ctx.shotInRange(sh('S36'), 0.6);
  await assertFonts([
    ['400 72px "Noto Sans Cuneiform"', '𒀭'], ['400 56px "Noto Serif Devanagari"', 'सो अङ्ग वेद'],
    ['400 50px "Noto Serif CJK SC"', '遂古之初谁传道之'], ['italic 400 50px "Cormorant Garamond"', 'Is anyone there'],
    ['400 50px "Noto Serif CJK JP"', '誰かいますか'], ['400 50px "Noto Naskh Arabic"', 'هل يوجد أحد هنا'],
    ['300 48px "Noto Serif CJK SC"', '或许他也不知道'], ['400 40px "Noto Sans"', 'print Hello world'],
  ]);
  const lex = getLexicon();
  const draw = (scene, camera, target, clear) => {
    const ac = renderer.autoClear; renderer.autoClear = !!clear;
    renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.autoClear = ac;
  };
  const S34 = need34 ? await buildS34(ctx, lex, draw) : null;
  const S36 = need36 ? buildS36(ctx, lex, draw) : null;
  return {
    bloomMask: f => f.shot.id === 'S36' && f.t >= 181.4,
    render(shot, f) {
      if (shot.id === 'S36') S36.render(f);
      else S34.render(f);
      renderer.setRenderTarget(f.target);
    },
    post(shot, f) {
      const fr = f.t * FPS;
      if (shot.id === 'S34') return { ...handoffPost(fr), exposure: 1.0 };
      return { bloom: 0.9, streak: 0.12, exposure: 1.0, vignette: 0.26 };
    },
  };
}

// =============================================================================================
async function buildS34(ctx, lex, draw) {
  const { THREE: T, renderer, W, H, kit, makeRT } = ctx;
  const web = getWeb();
  const P9 = webPathPose(9.0);
  const { nodes, edges, mass } = web;
  const proj = (x, y, z, P = P9) => {
    const dx = x - P.pos.x, dy = y - P.pos.y, dz = z - P.pos.z;
    const d = dx * P.forward.x + dy * P.forward.y + dz * P.forward.z;
    return [960 + (dx * P.right.x + dy * P.right.y + dz * P.right.z) / d * FPX24, 540 - (dx * P.up.x + dy * P.up.y + dz * P.up.z) / d * FPX24, d];
  };
  const camRay = (px, py, d, P = P9) => P.pos.clone().addScaledVector(P.forward, d)
    .addScaledVector(P.right, (px - 960) / FPX24 * d).addScaledVector(P.up, -(py - 540) / FPX24 * d);

  // ---- N2 and the push ------------------------------------------------------------------------
  let n2 = -1, best = -1;
  for (let i = 0; i < web.N; i++) {
    const [x, y, d] = proj(nodes[3 * i], nodes[3 * i + 1], nodes[3 * i + 2]);
    if (d < 18 || d > 220) continue;
    const e = Math.hypot(x - 1180, y - 470);
    if (e > 80) continue;
    const sc = mass[i] * (1 - e / 120);
    if (sc > best) { best = sc; n2 = i; }
  }
  const N2 = new T.Vector3(nodes[3 * n2], nodes[3 * n2 + 1], nodes[3 * n2 + 2]);
  const [foeX, foeY, D2] = proj(N2.x, N2.y, N2.z);
  console.log(`WARN w_sea: N2 node ${n2} at (${foeX.toFixed(0)}, ${foeY.toFixed(0)}) depth ${D2.toFixed(1)} mass ${mass[n2].toFixed(2)}`);
  const pushDir = N2.clone().sub(P9.pos);
  const LN = Math.log(1.01);
  const tau = F => { const x = Math.max(0, F - PUSH0); return x - 12 * (1 - Math.exp(-x / 12)); };    // soft start
  const pushK = F => 1 - Math.exp(-LN * tau(F));                    // fraction of the way to N2
  const poseAt = F => ({ pos: P9.pos.clone().addScaledVector(pushDir, pushK(F)), forward: P9.forward, right: P9.right, up: P9.up });
  const cam = kit.filmCamera(W, H, { focalMM: 24, near: 0.05, far: 3000 });
  const setPose = (P) => { cam.position.copy(P.pos); cam.up.copy(P.up); cam.lookAt(P.pos.clone().add(P.forward)); cam.updateMatrixWorld(); };

  // ---- the first words (B2's stars) and the hero node --------------------------------------------
  const stars = handoffStars();
  const first = web.hero.first;
  const HERO = new T.Vector3(nodes[3 * first], nodes[3 * first + 1], nodes[3 * first + 2]);
  const heroPx = proj(HERO.x, HERO.y, HERO.z);
  const heroCorr = [BLUE_DOT.center[0] - heroPx[0], BLUE_DOT.center[1] - heroPx[1]];   // ≤ 1 px convention offset

  // ---- the sea --------------------------------------------------------------------------------
  const pts0 = sampleWebPoints(web, N_SEA, 7);
  // a near field on the same edges (same lateral law), dense only where they pass 2.5–70 units in front of
  // the lens: the words close enough to be read as words (and to stream past during the push)
  const rN = rng(1990 * 34 + 7), O = P9.pos, F = P9.forward, Rt = P9.right, Up = P9.up;
  const tx = 18 / 24 + 0.05, ty = 10.125 / 24 * 804 / 1080 + 0.04;
  const extra = [];
  for (let e = 0; e < web.E; e++) {
    const a = edges[2 * e], c = edges[2 * e + 1];
    const ax = nodes[3 * a], ay = nodes[3 * a + 1], az = nodes[3 * a + 2], bx = nodes[3 * c], by = nodes[3 * c + 1], bz = nodes[3 * c + 2];
    const L = Math.hypot(bx - ax, by - ay, bz - az);
    const da = (ax - O.x) * F.x + (ay - O.y) * F.y + (az - O.z) * F.z, db = (bx - O.x) * F.x + (by - O.y) * F.y + (bz - O.z) * F.z;
    if ((da < 2 && db < 2) || (da > D2 + 20 && db > D2 + 20)) continue;
    const m = Math.ceil(L * 9);
    for (let k = 0; k < m; k++) {
      const u = rN(), sg = 0.02 * L;
      const x = ax + (bx - ax) * u + rN.gauss() * sg, y = ay + (by - ay) * u + rN.gauss() * sg, z = az + (bz - az) * u + rN.gauss() * sg;
      const dx = x - O.x, dy = y - O.y, dz = z - O.z, d = dx * F.x + dy * F.y + dz * F.z;
      if (d < 2.5) continue;
      const inView = d < 70 && Math.abs(dx * Rt.x + dy * Rt.y + dz * Rt.z) < tx * d && Math.abs(dx * Up.x + dy * Up.y + dz * Up.z) < ty * d;
      // distance from the push line (P9 → N2)
      const s2 = Math.max(0, Math.min(1, (dx * pushDir.x + dy * pushDir.y + dz * pushDir.z) / pushDir.lengthSq()));
      const lx = dx - pushDir.x * s2, ly = dy - pushDir.y * s2, lz = dz - pushDir.z * s2;
      const lat = Math.hypot(lx, ly, lz), along2 = s2 * pushDir.length();
      const nearPath = lat < 4 + 0.22 * along2;
      if (!inView && !nearPath) continue;
      extra.push([x, y, z, e, u, u < 0.5 ? a : c]);
    }
  }
  const keepP = Math.min(0.34, N_NEAR / Math.max(1, extra.length));
  const keep = []; for (let k = 0; k < extra.length && keep.length < N_NEAR; k++) if (hash1(k, 92) < keepP) keep.push(extra[k]);
  // N2's own clump: the "stars" that open into words as the camera arrives
  const rC = rng(1990 * 34 + 9);
  for (let k = 0; k < N2_CLUMP; k++) {
    const rr = Math.abs(rC.gauss()) * 1.6 * Math.pow(rC(), 0.4), dv = rC.sphere();
    keep.push([N2.x + dv[0] * rr, N2.y + dv[1] * rr, N2.z + dv[2] * rr, 0, 0, n2, 1]);
  }
  const nW = stars.filter(s => !s.cune).length;
  const nBase = pts0.count, nNear = keep.length, n = nBase + nNear + nW;
  console.log(`WARN w_sea: sea ${nBase} + near ${nNear} + first words ${nW}`);
  const iPos = new Float32Array(n * 3), iRect = new Float32Array(n * 4), iA = new Float32Array(n * 4), iB = new Float32Array(n * 4), iC = new Float32Array(n * 4), iCol = new Float32Array(n * 3);
  const kind = new Uint8Array(n), nodeOf = new Uint32Array(n), along = new Float32Array(n), edgeOf = new Uint32Array(n);
  iPos.set(pts0.pos); kind.set(pts0.kind); nodeOf.set(pts0.nodeOf); along.set(pts0.along); edgeOf.set(pts0.edgeOf);
  keep.forEach((q, k) => { const o = nBase + k; iPos.set(q.slice(0, 3), 3 * o); kind[o] = q[6] ? 1 : 0; edgeOf[o] = q[3]; along[o] = q[4]; nodeOf[o] = q[5]; });
  // the continuous stream of human text: each filament reads a run of consecutive words, each clump a passage
  const order = lex.sentences.map((x, i) => i).filter(i => lex.sentences[i].sea.length).sort((a, b) => hash1(a, 341) - hash1(b, 341));
  const stream = []; for (const i of order) stream.push(...lex.sentences[i].sea);
  const SL = stream.length;
  const perEdge = new Map();
  for (let i = 0; i < nBase + nNear; i++) if (kind[i] === 0) perEdge.set(edgeOf[i], (perEdge.get(edgeOf[i]) || 0) + 1);
  const warm = [[1.0, 0.36, 0.085], PAL.AMBER, [1.0, 0.56, 0.22], [1.0, 0.66, 0.36]];
  const pickCol = h => { const k = h * 3, i = Math.min(2, Math.floor(k)), f = k - i; return warm[i].map((v, j) => v + (warm[i + 1][j] - v) * f); };
  const r = rng(1990 * 34 + 1);
  let clumpNode = -1, clumpK = 0;
  // the hero node's clump grows around the node during S08-a (nearest first)
  const heroIdx = [];
  for (let i = 0; i < nBase + nNear; i++) {
    const isFil = kind[i] === 0, e = edgeOf[i];
    let si;
    if (isFil) si = Math.floor(hash1(e, 34) * SL) + Math.min(perEdge.get(e) - 1, Math.floor(along[i] * perEdge.get(e)));
    else { if (nodeOf[i] !== clumpNode) { clumpNode = nodeOf[i]; clumpK = 0; } si = Math.floor(hash1(clumpNode, 38) * SL) + clumpK++; }
    const tok = stream[si % SL];
    iRect.set(lex.rects.subarray(tok * 4, tok * 4 + 4), i * 4);
    const m = mass[nodeOf[i]];
    let b = Math.min(14, Math.exp(0.85 * r.gauss()) * 1.1 * (0.55 + 0.45 * Math.sqrt(Math.min(m, 9))));
    const hW = (i >= nBase ? 0.42 : 0.19) * Math.exp(0.28 * r.gauss()) * (isFil ? 1 : 0.85);
    iA.set([Math.min(0.42, Math.max(0.09, hW)), b, r(), r()], i * 4);
    iCol.set(pickCol(r()), 3 * i);
    if (isFil) {
      const a = edges[2 * e], c = edges[2 * e + 1];
      const dx = nodes[3 * c] - nodes[3 * a], dy = nodes[3 * c + 1] - nodes[3 * a + 1], dz = nodes[3 * c + 2] - nodes[3 * a + 2];
      const L = Math.hypot(dx, dy, dz) || 1, v = (0.045 + 0.05 * hash1(e, 35)) * (hash1(e, 36) < 0.5 ? -1 : 1) / L;
      iB.set([dx * v, dy * v, dz * v, 0], i * 4);
    } else iB.set([0, 0, 0, 1], i * 4);
    // ignition: far first (like the first stars), complete by f4032
    const d0 = Math.hypot(iPos[3 * i] - P9.pos.x, iPos[3 * i + 1] - P9.pos.y, iPos[3 * i + 2] - P9.pos.z);
    iC[i * 4 + 3] = 165.0 + 2.6 * Math.pow(1 - smooth(10, 250, d0), 1.25) + 0.35 * r();
    if (!isFil && nodeOf[i] === first) heroIdx.push(i);
  }
  // hero clump: f3870 → f3958, by screen distance from R (the words grow around the node)
  {
    const dd = heroIdx.map(i => { const p = proj(iPos[3 * i], iPos[3 * i + 1], iPos[3 * i + 2]); return Math.hypot(p[0] - R[0], p[1] - R[1]); });
    const ord = heroIdx.map((i, k) => k).sort((a, b) => dd[a] - dd[b]);
    ord.forEach((k, rank) => { const i = heroIdx[k]; iC[4 * i + 3] = (3870 + 88 * Math.pow(rank / ord.length, 0.8)) / FPS; iA[4 * i + 1] = Math.min(iA[4 * i + 1], 2.5); });
  }
  // the first words: B2's stars, each a 6–9 px word at its node's place, born on its turn (tk)
  const shortToks = lex.sea.filter(k => lex.rowAspect(k) < 2.4);
  {
    let o = nBase + nNear;
    stars.forEach((s, k) => {
      if (s.cune) return;
      const i = s.i;
      iPos.set([nodes[3 * i], nodes[3 * i + 1], nodes[3 * i + 2]], 3 * o);
      const tok = shortToks[Math.floor(hash1(k, 4001) * shortToks.length)];
      iRect.set(lex.rects.subarray(tok * 4, tok * 4 + 4), 4 * o);
      const em = 6 + 3 * hash1(k, 4002);
      iA.set([em * 1.6 * s.d / FPX24, 0.45 + 0.6 * s.level, hash1(k, 4003), hash1(k, 4004)], 4 * o);
      iB.set([0, 0, 0, 3], 4 * o);
      iC.set([s.level, 0, 0, s.tk / FPS], 4 * o);
      iCol.set(pickCol(hash1(k, 4005)), 3 * o);
      kind[o] = 3; o++;
    });
  }
  const STAR_HDR = hdrForDisplay('#E9E3D8', 0.25);
  const seaF = glyphField(n, { iPos, iRect, iA, iB, iC, iCol }, {
    uniforms: { uCard: { value: 0 }, uClear: { value: new T.Vector4(0, 0, 0, 0) }, uClearK: { value: 0 }, uStarC: { value: new T.Vector3(...STAR_HDR) } },
    header: /* glsl */ `uniform float uCard, uClearK; uniform vec4 uClear; uniform vec3 uStarC;`,
    vertexBody: /* glsl */ `
      float kind = iB.w;
      p += iB.xyz * max(0.0, time - iC.w);              // each word starts flowing when it is born
      float age = time - iC.w;
      if (kind < 2.5) {
        b *= smoothstep(0.0, 0.32, age) * (1.0 + 1.5 * exp(-max(age, 0.0) * 4.5));   // ignites like a star
        b *= 0.88 + 0.12 * sin(time * (0.5 + 1.6 * iA.z) + iA.w * 40.0);
      } else {
        // a first word: the star's light (6 frames of flicker, drawn by the hand-off layer) passes
        // into the word, which opens from a point to its 6–9 px over 8 frames, warming as it opens
        float g = smoothstep(0.0, 0.33, age);
        hW *= mix(0.22, 1.0, g);
        col = mix(uStarC / max(1e-3, b), col, g);
        b *= step(0.0, age) * (0.6 + 0.4 * g) * (0.9 + 0.1 * sin(time * (0.5 + 1.6 * iA.z) + iA.w * 40.0));
      }
      vec4 cp = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      float yPx = (0.5 - 0.5 * cp.y / max(cp.w, 1e-4)) * 1080.0;
      float xPx = (0.5 + 0.5 * cp.x / max(cp.w, 1e-4)) * 1920.0;
      // card ④: words in the lowest 260 px of the band (y 682–942) thinned to 40 % (by hash), and the
      // few bright ones under the card itself held down
      float keep = 1.0 - 0.6 * uCard * smoothstep(672.0, 692.0, yPx);
      b *= smoothstep(0.0, 0.06, keep - iA.z);
      float inCard = smoothstep(560.0, 620.0, xPx) * (1.0 - smoothstep(1300.0, 1360.0, xPx)) * smoothstep(715.0, 745.0, yPx) * (1.0 - smoothstep(830.0, 860.0, yPx));
      b *= 1.0 - 0.75 * uCard * inCard;
      // the readable line of S08-c keeps a clear margin
      float inR = smoothstep(uClear.x - 18.0, uClear.x, xPx) * (1.0 - smoothstep(uClear.z, uClear.z + 18.0, xPx))
                * smoothstep(uClear.y - 14.0, uClear.y, yPx) * (1.0 - smoothstep(uClear.w, uClear.w + 14.0, yPx));
      b *= 1.0 - uClearK * inR;
      // a word big enough to read is texture (≤ HDR 0.5); nothing bright on the letterbox edge
      float hPx = hW * projectionMatrix[1][1] * 540.0 / max(cp.w, 1e-4);
      b = min(b, mix(1e4, 0.5, smoothstep(10.0, 20.0, hPx)));
      float edgeK = smoothstep(150.0, 190.0, yPx - 0.5 * hPx) * (1.0 - smoothstep(890.0, 930.0, yPx + 0.5 * hPx));
      b *= mix(1.0, edgeK, smoothstep(7.0, 15.0, hPx));`,
  });
  const sea = seaF.pts;
  sea.material.uniforms.res.value.set(W, H);
  const births = new Float32Array(n); for (let i = 0; i < n; i++) births[i] = iC[4 * i + 3];
  const seaC = new Compactor(sea.geometry, { iPos, iRect, iRect2: iRect, iA, iB, iC, iCol }, n,
    { pos: iPos, flow: iB, flowStride: 4, flowOffset: 0, flowT0: 165.0, birth: births, big: seaF.quads.geometry, bigPx: 18 });
  sea.material.uniforms.capPx.value = [34, 52];
  sea.material.uniforms.nearFade.value = [0.6, 2.2];
  sea.material.uniforms.moteRange.value = [6.5, 12];

  // ---- far field: motes on the same web (same ignition law, flow, card thinning) ----------------
  const mp = sampleWebPoints(web, N_MOTE, 8);
  const mA = new Float32Array(mp.count * 4), mFlow = new Float32Array(mp.count * 3), mCol = new Float32Array(mp.count * 3);
  const rm = rng(1990 * 34 + 2);
  for (let i = 0; i < mp.count; i++) {
    const m = mass[mp.nodeOf[i]];
    const b = Math.min(9, Math.exp(0.9 * rm.gauss()) * 0.5 * (0.5 + 0.5 * Math.sqrt(Math.min(m, 9))));
    const d0 = Math.hypot(mp.pos[3 * i] - P9.pos.x, mp.pos[3 * i + 1] - P9.pos.y, mp.pos[3 * i + 2] - P9.pos.z);
    let tb = 165.0 + 2.6 * Math.pow(1 - smooth(10, 250, d0), 1.25) + 0.35 * rm();
    if (mp.kind[i] === 1 && mp.nodeOf[i] === first) tb = Math.max(tb, 3880 / FPS + 3 * rm());
    mA.set([b, tb, rm(), 0], 4 * i);
    mCol.set(pickCol(rm()), 3 * i);
    const e = mp.edgeOf[i];
    if (mp.kind[i] === 0) {
      const a = edges[2 * e], c = edges[2 * e + 1];
      const dx = nodes[3 * c] - nodes[3 * a], dy = nodes[3 * c + 1] - nodes[3 * a + 1], dz = nodes[3 * c + 2] - nodes[3 * a + 2];
      const L = Math.hypot(dx, dy, dz) || 1, v = (0.045 + 0.05 * hash1(e, 35)) * (hash1(e, 36) < 0.5 ? -1 : 1) / L;
      mFlow.set([dx * v, dy * v, dz * v], 3 * i);
    }
  }
  const mGeo = new T.BufferGeometry();
  const mPos = mp.pos.slice();
  for (const [k, a, sz] of [['position', mPos, 3], ['mA', mA, 4], ['mFlow', mFlow, 3], ['mCol', mCol, 3]]) {
    const ba = new T.BufferAttribute(a.slice(), sz); ba.setUsage(T.DynamicDrawUsage); mGeo.setAttribute(k, ba);
  }
  const mBirth = new Float32Array(mp.count); for (let i = 0; i < mp.count; i++) mBirth[i] = mA[4 * i + 1];
  const moteC = new Compactor(mGeo, { position: mPos, mA, mFlow, mCol }, mp.count, { pos: mPos, flow: mFlow, flowT0: 165.0, birth: mBirth, instanced: false });
  const moteMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, pxs: { value: H / 1080 }, gain: { value: 1 }, uCard: { value: 0 } },
    vertexShader: /* glsl */ `attribute vec4 mA; attribute vec3 mFlow, mCol; uniform float time, pxs, gain, uCard; varying vec3 vC;
      void main(){
        vec3 p = position + mFlow * max(0.0, time - mA.y);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
        gl_Position = projectionMatrix * mv;
        float age = time - mA.y;
        float b = mA.x * smoothstep(0.0, 0.32, age) * (1.0 + 1.5 * exp(-max(age, 0.0) * 4.5));
        b *= 0.85 + 0.15 * sin(time * (0.6 + 2.0 * mA.z) + mA.z * 70.0);
        float s = clamp(70.0 / max(d, 1.0), 1.0, 2.4) * pxs;
        gl_PointSize = max(s, 1.0);
        b *= smoothstep(4.0, 14.0, d) * min(1.0, s * s);
        float yPx = (0.5 - 0.5 * gl_Position.y / max(gl_Position.w, 1e-4)) * 1080.0;
        float keep = 1.0 - 0.6 * uCard * smoothstep(672.0, 692.0, yPx);
        b *= smoothstep(0.0, 0.06, keep - mA.z);
        if (b < 1e-4 || age < 0.0) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        vC = mCol * b * gain;
      }`,
    fragmentShader: /* glsl */ `varying vec3 vC; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; gl_FragColor = vec4(vC * exp(-dot(q, q) * 2.2), 1.0); }`,
  });
  const motes = new T.Points(mGeo, moteMat); motes.frustumCulled = false;

  // ---- fog (quarter resolution) -------------------------------------------------------------------
  const gp = sampleWebPoints(web, N_GAS, 11, { clumpShare: 0.12 });
  const gGeo = new T.BufferGeometry();
  gGeo.setAttribute('position', new T.BufferAttribute(gp.pos, 3));
  const gs = new Float32Array(gp.count); for (let i = 0; i < gp.count; i++) gs[i] = 0.75 + 0.5 * hash1(i, 77);
  gGeo.setAttribute('gs', new T.BufferAttribute(gs, 1));
  const gasMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    uniforms: { fpxQ: { value: 1 }, alpha: { value: 0.02 }, hazeCol: { value: new T.Vector3(...PAL.VIOLET) }, gain: { value: 1 } },
    vertexShader: /* glsl */ `attribute float gs; uniform float fpxQ, alpha, gain; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z; gl_Position = projectionMatrix * mv;
        float sz = 3.0 * gs * fpxQ / max(d, 0.05); float s = clamp(sz, 1.0, 72.0);
        gl_PointSize = s; vA = alpha * gain * smoothstep(4.0, 12.0, d) * min(1.0, sz * sz) * (s / sz); }`,
    fragmentShader: /* glsl */ `uniform vec3 hazeCol; varying float vA;
      void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard;
        float g = exp(-r2 * 3.2) - 0.0408 * (1.0 - r2); gl_FragColor = vec4(hazeCol * vA * g, 1.0); }`,
  });
  const gas = new T.Points(gGeo, gasMat); gas.frustumCulled = false;
  const gasScene = new T.Scene(); gasScene.add(gas);
  const gasRT = makeRT(Math.round(W / 4), Math.round(H / 4));
  const comp = kit.compositor();
  comp.material.uniforms.tex.value = gasRT.texture;

  // ---- 𒀭: a plane on the camera ray through (900, 450) at depth AN_D (moves with the world) --------
  const planeMat = (tex) => new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    uniforms: { tex: { value: tex }, halo: { value: null }, color: { value: new T.Vector3(...PAL.AMBER) }, gain: { value: 0 }, haloGain: { value: 0 }, bias: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tex, halo; uniform vec3 color; uniform float gain, haloGain, bias; varying vec2 vUv;
      void main(){ float a = texture2D(tex, vUv, bias).a; float h = texture2D(halo, vUv).a; gl_FragColor = vec4(color * gain * (a + haloGain * h * (1.0 - a)), 1.0); }`,
  });
  const cv = (w, h, blur, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; if (blur) g.filter = `blur(${blur}px)`; fn(g); const t = new T.CanvasTexture(c); t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = true; return t; };
  const anDraw = g => { g.font = '400 200px "Noto Sans Cuneiform"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('𒀭', 160, 160); };
  const anTex = cv(320, 320, 0, anDraw), anHalo = cv(320, 320, 22, anDraw);
  const an = new T.Mesh(new T.PlaneGeometry(1, 1), planeMat(anTex));
  an.material.uniforms.halo.value = anHalo; an.material.uniforms.haloGain.value = 0.22;
  an.frustumCulled = false;
  const AN_D = 40, AN_C = camRay(900, 450, AN_D);
  an.position.copy(AN_C);
  an.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(P9.right, P9.up, P9.forward.clone().negate()));
  // 𒀭's on-screen glyph size (px of the 200-px em) by frame: 3 → 72 (f3900–3911), 72 (→ 3947), → 10 (3959)
  const anPx = fr => fr < 3900 ? 0 : fr < 3912 ? 3 + 69 * (1 - Math.pow(1 - (fr - 3900) / 12, 3)) : fr < 3948 ? 72 : 72 + (10 - 72) * smooth(3948, 3960, fr);
  const anCol = atLevel(PAL.AMBER, 0.38);
  const mainScene = new T.Scene(); mainScene.add(motes); mainScene.add(seaF.group); mainScene.add(an);

  // ---- link threads from the node (screen space; the camera is still while they grow) -----------
  const heroScreen = heroIdx.map(i => { const p = proj(iPos[3 * i], iPos[3 * i + 1], iPos[3 * i + 2]); return { x: p[0], y: p[1], tb: iC[4 * i + 3] * FPS }; })
    .filter(q => Math.hypot(q.x - R[0], q.y - R[1]) > 26 && q.y > 160 && q.y < 920);
  const segs = [];      // [x0, y0, x1, y1, f0] (grows at 40 px/s from f0)
  {
    const V = 40 / FPS;
    const pool = [...heroScreen.map(q => ({ ...q, used: false })), ...stars.filter(s => !s.cune).map(s => ({ x: s.x, y: s.y, tb: s.tk, used: false }))];
    const nearest = (x, y, k, lo, hi) => pool.filter(q => !q.used).map(q => [Math.hypot(q.x - x, q.y - y), q]).filter(a => a[0] > lo && a[0] < hi).sort((a, b) => a[0] - b[0]).slice(0, k).map(a => a[1]);
    let front = [{ x: BLUE_DOT.center[0], y: BLUE_DOT.center[1], f: 3872 }];
    for (let lvl = 0; lvl < 4; lvl++) {
      const next = [];
      for (const s of front) {
        const kids = nearest(s.x, s.y, lvl === 0 ? 4 : 2, lvl === 0 ? 24 : 30, lvl === 0 ? 120 : 260);
        for (const q of kids) {
          q.used = true;
          const len = Math.hypot(q.x - s.x, q.y - s.y), f0 = Math.max(s.f, q.tb - 6);
          segs.push([s.x, s.y, q.x, q.y, f0, len / V]);
          next.push({ x: q.x, y: q.y, f: f0 + len / V });
        }
      }
      front = next;
    }
  }
  const segN = segs.length;
  const sGeo = new T.InstancedBufferGeometry();
  sGeo.setAttribute('position', new T.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  sGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const sA = new Float32Array(segN * 4), sB = new Float32Array(segN * 2);
  segs.forEach((s, k) => { sA.set(s.slice(0, 4), 4 * k); sB.set([s[4], s[5]], 2 * k); });
  sGeo.setAttribute('sA', new T.InstancedBufferAttribute(sA, 4)); sGeo.setAttribute('sB', new T.InstancedBufferAttribute(sB, 2));
  sGeo.instanceCount = segN;
  const threadCol = atLevel(PAL.AMBER, 0.085);
  const segMat = new T.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { fr: { value: 0 }, col: { value: new T.Vector3(...threadCol) }, fade: { value: 1 } },
    vertexShader: /* glsl */ `attribute vec4 sA; attribute vec2 sB; uniform float fr; varying float vD; varying float vK;
      void main(){
        float g = clamp((fr - sB.x) / max(1.0, sB.y), 0.0, 1.0);          // grown fraction
        vec2 a = sA.xy, b = mix(sA.xy, sA.zw, g), d = b - a; float L = length(d);
        vec2 t = L > 1e-3 ? d / L : vec2(1.0, 0.0), nn = vec2(-t.y, t.x);
        vec2 p = a + t * (position.x * (L + 2.0) - 1.0) + nn * position.y * 1.5;   // 1.5 px wide + AA margin
        vD = position.y * 1.5; vK = step(0.001, g);
        gl_Position = vec4(p.x / 960.0 - 1.0, 1.0 - p.y / 540.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 col; uniform float fade; varying float vD; varying float vK;
      void main(){ float a = clamp(1.25 - abs(vD), 0.0, 1.0) * vK * fade; if (a <= 0.0) discard; gl_FragColor = vec4(col * a, 1.0); }`,
  });
  const segMesh = new T.Mesh(sGeo, segMat); segMesh.frustumCulled = false;
  const segScene = new T.Scene(); segScene.add(segMesh);
  const ortho = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---- the hand-off layer (blue dot → node, B2's stars, PBD band) ----------------------------------
  const hand = createHandoffLayer(ctx);

  // ---- the cold web of f1128 (a_origin's own web layer at fr = 1128: same graph, same pose) --------
  let coldRT = null;
  if (ctx.inRange(COLD[0] / FPS - 0.3, COLD[1] / FPS + 0.3)) {
    try {
      const { createWebLayer } = await import('./a_origin/web.js');
      const wl = createWebLayer(ctx);
      coldRT = makeRT(W, H);
      wl.render(renderer, coldRT, 1128, { clear: true });
    } catch (e) { console.log(`WARN w_sea: cold web unavailable (${e.message})`); coldRT = null; }
  }
  const coldMat = new T.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { tex: { value: coldRT ? coldRT.texture : null }, k: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tex; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * k, 1.0); }`,
  });
  const coldMesh = new T.Mesh(new T.PlaneGeometry(2, 2), coldMat); coldMesh.frustumCulled = false;
  const coldScene = new T.Scene(); coldScene.add(coldMesh);

  // ---- S08-c: the tracked point and the four readable lines (screen space, 1080p px) -------------
  const pxScene = new T.Scene();
  const pxCam = new T.OrthographicCamera(-960, 960, 540, -540, -10, 10);
  const lineM = LINES.map(L => {
    const b = inkBox(L.text, L.font, { rtl: L.rtl }), fpx = 60;
    const cx = 0, base = -(b.top + b.bottom) / 2;          // ink centred at (0, 0)
    const items = [{ text: L.text, font: L.font, x: -b.adv / 2, baseline: base, rtl: L.rtl }];
    const tex = textTextures(items, [-b.adv / 2 - 40, -fpx, b.adv / 2 + 40, fpx], { halo: 10 });
    const m = textPlane(tex); m.material.uniforms.haloGain.value = 0.2;
    m.userData.w = b.right - b.left; m.userData.h = b.bottom - b.top; m.userData.fpx = fpx;
    m.visible = false; pxScene.add(m); void cx;
    return m;
  });
  const LCOL = atLevel(PAL.AMBER, 0.40);
  const glowMat = new T.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { c: { value: new T.Vector3() }, sig: { value: new T.Vector2(2, 2) }, pos: { value: new T.Vector2(foeX, foeY) } },
    vertexShader: /* glsl */ `varying vec2 vPx; void main(){ vPx = (position.xy * 0.5 + 0.5) * vec2(1920.0, 1080.0); vPx.y = 1080.0 - vPx.y; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 c; uniform vec2 sig, pos; varying vec2 vPx;
      void main(){ vec2 q = (vPx - pos) / sig; gl_FragColor = vec4(c * exp(-0.5 * dot(q, q)), 1.0); }`,
  });
  const glow = new T.Mesh(new T.PlaneGeometry(2, 2), glowMat); glow.frustumCulled = false;
  const glowScene = new T.Scene(); glowScene.add(glow);

  // =========================================================================================
  function render(f) {
    const t = f.t, fr = t * FPS;
    const P = poseAt(fr);
    setPose(P);
    const tans = frustumTans(cam, H, f.barPx);
    seaC.update(cam, t, { ...tans, near: 0.5, margin: 1.6, fpx: FPX24 });
    moteC.update(cam, t, { ...tans, near: 3.5, margin: 0.4 });
    const U = sea.material.uniforms;
    U.time.value = t;
    U.uCard.value = env(t, CARD4[0], CARD4[1], CARD4[2], CARD4[2]);
    moteMat.uniforms.time.value = t; moteMat.uniforms.uCard.value = U.uCard.value;
    // focus: deep in S08-a/b; during the push, on the line being read
    U.focus.value = fr < PUSH0 ? 40 : Math.max(3, D2 * (1 - pushK(fr)) * 1.4); U.aperture.value = fr < PUSH0 ? 0.004 : 0.012;
    // 𒀭
    const apx = anPx(fr);
    if (apx > 0) {
      const sc = apx * (320 / 200) * AN_D / FPX24; an.scale.set(sc, sc, 1); an.visible = true;
      const read = smooth(3900, 3912, fr) * (1 - smooth(3948, 3960, fr));
      an.material.uniforms.color.value.set(...anCol);
      an.material.uniforms.gain.value = 0.75 + 0.25 * read + 1.4 * (1 - smooth(3900, 3906, fr));   // the star's light first
      an.material.uniforms.haloGain.value = 0.22 * read + 0.4 * (1 - read);
    } else an.visible = false;
    // the readable lines of S08-c: one at a time, racked in over 5 frames, out over 6
    let ck = 0, box = null;
    lineM.forEach((m, k) => {
      const L = LINES[k], u = m.material.uniforms;
      const pre = k === 0 ? smooth(4180, 4194, fr) : smooth(L.f0 - 6, L.f0, fr);
      const out = smooth(L.f1 - 2, L.f1 + 5, fr);
      const vis = pre * (1 - out);
      m.visible = vis > 0.003;
      if (!m.visible) return;
      const s = (L.px[0] + (L.px[1] - L.px[0]) * clamp((fr - L.f0) / (L.f1 - L.f0))) / m.userData.fpx;
      const x = foeX + L.off[0], y = foeY + L.off[1];
      m.scale.set(s, s, 1); m.position.set(x - 960, 540 - y, 0);
      u.bias.value = 5.0 * (1 - pre) + 4.0 * out;
      u.col.value.set(...LCOL); u.gain.value = Math.min(1, 0.15 + vis * 1.2);
      if (vis > ck) { ck = vis; box = [x - m.userData.w * s / 2, y - m.userData.h * s / 2, x + m.userData.w * s / 2, y + m.userData.h * s / 2]; }
    });
    if (box) U.uClear.value.set(box[0] - 40, box[1] - 26, box[2] + 40, box[3] + 26);
    U.uClearK.value = Math.min(1, ck) * 0.85;
    draw(mainScene, cam, f.target, false);
    // fog: violet with the filling (S08-a/b), warm amber in the push
    const gu = gasMat.uniforms;
    gu.fpxQ.value = cam.projectionMatrix.elements[5] * gasRT.height * 0.5;
    const warmK = smooth(PUSH0, PUSH0 + 48, fr);
    gu.hazeCol.value.set(...PAL.VIOLET.map((v, j) => v + (PAL.SODIUM[j] - v) * warmK));
    gu.alpha.value = 0.016 + (0.015 - 0.016) * warmK;
    gu.gain.value = (0.42 + (0.6 - 0.42) * warmK) * smooth(165.0, 168.0, t);
    if (gu.gain.value > 0.001) {
      draw(gasScene, cam, gasRT, true);
      comp.material.uniforms.gain.value = 1;
      const ac = renderer.autoClear; renderer.autoClear = false; comp.render(renderer, f.target); renderer.autoClear = ac;
    }
    // the cold web of f1128, exactly aligned, at 35 %
    const ck2 = 0.35 * smooth(COLD[0] - 0.5, COLD[0] + 5.5, fr) * (1 - smooth(COLD[1] - 6.5, COLD[1] - 0.5, fr));
    if (coldRT && ck2 > 0.001) { coldMat.uniforms.k.value = ck2; draw(coldScene, ortho, f.target, false); }
    // threads
    segMat.uniforms.fr.value = fr; segMat.uniforms.fade.value = 1 - smooth(4070, 4100, fr);
    if (fr < 4100) draw(segScene, ortho, f.target, false);
    // the node (follows the hero node once the camera moves) + B2's stars + the PBD band
    const hp = proj(HERO.x, HERO.y, HERO.z, P);
    const hs = heroPx[2] / Math.max(0.3, hp[2]);
    if (hp[2] > 0.3 && hp[0] > -200 && hp[0] < 2120) hand.render(renderer, f.target, fr, { center: [hp[0] + heroCorr[0] * hs, hp[1] + heroCorr[1] * hs], scale: hs });
    // the tracked point of N2: 3 px star → 12 px glow (f4152–4193), handing over to the first line
    const gk = smooth(4120, 4152, fr) * (1 - smooth(4188, 4200, fr));
    if (gk > 0.001) {
      const gr = 1.3 + (5.1 - 1.3) * smooth(4152, 4186, fr);
      glowMat.uniforms.sig.value.set(gr * (1 + 1.5 * smooth(4180, 4196, fr)), gr);
      glowMat.uniforms.c.value.set(...atLevel(PAL.AMBER, 1.6 * gk));
      draw(glowScene, ortho, f.target, false);
    }
    if (lineM.some(m => m.visible)) draw(pxScene, pxCam, f.target, false);
    void nodeMorph;
  }
  return { render };
}

// =============================================================================================
// S36 — सो अङ्ग वेद यदि वा न वेद. 100 mm; focus plane at DF = 2.5 units; the line's first syllable
// centred on R; camera dollies along the ray through सो (so R never moves) at 0.3 % / s.
function buildS36(ctx, lex, draw) {
  const { THREE: T, renderer, W, H, kit } = ctx;
  const DF = 2.5, FONT = 112, FSPEC = `400 ${FONT}px "Noto Serif Devanagari"`;
  const text = RIGVEDA_7.t;
  const m = document.createElement('canvas').getContext('2d'); m.font = FSPEC;
  const full = m.measureText(text), so = m.measureText('सो');
  const pad = 80, cw = Math.ceil(full.width) + 2 * pad, ch = 300, base = 190;
  const mkTex = (blur) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d'); g.fillStyle = '#fff'; if (blur) g.filter = `blur(${blur}px)`;
    g.font = FSPEC; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillText(text, pad, base);
    const t = new T.CanvasTexture(c); t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = true; return t; };
  const tex = mkTex(0), halo = mkTex(26);
  const soCx = pad + (so.actualBoundingBoxRight - so.actualBoundingBoxLeft) / 2;
  const soCy = base - (so.actualBoundingBoxAscent - so.actualBoundingBoxDescent) / 2;
  const s = (56 / FONT) * DF / FPX100;
  const Q = new T.Vector3((R[0] - 960) / FPX100 * DF, -(R[1] - 540) / FPX100 * DF, -DF);
  // the line: stroke HDR 0.40 (no bloom) + a wide warm halo carrying the "night-light" glow
  const lineMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    uniforms: { tex: { value: tex }, halo: { value: halo }, color: { value: new T.Vector3(...atLevel(PAL.AMBER, 0.40)) }, haloGain: { value: 0.24 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tex, halo; uniform vec3 color; uniform float haloGain; varying vec2 vUv;
      void main(){ float a = texture2D(tex, vUv).a, h = texture2D(halo, vUv).a; gl_FragColor = vec4(color * (a + haloGain * h * (1.0 - a)), 1.0); }`,
  });
  const line = new T.Mesh(new T.PlaneGeometry(cw * s, ch * s), lineMat);
  line.position.set(Q.x + (cw / 2 - soCx) * s, Q.y - (ch / 2 - soCy) * s, -DF);
  line.frustumCulled = false;
  // the sea as a 100 mm lens sees it at f/1.4: four depth layers of bokeh (see v1.3 notes)
  const NF = 112, NM = 34, NP = 12, NX = 5, n = NF + NM + NP + NX;
  const iPos = new Float32Array(n * 3), iRect = new Float32Array(n * 4), iA = new Float32Array(n * 4), iB = new Float32Array(n * 4), iCol = new Float32Array(n * 3);
  const r = rng(36036);
  const signs = lex.sea.filter(k => lex.rowAspect(k) < 1.25), words = lex.sea.filter(k => lex.rowAspect(k) > 1.6 && lex.rowAspect(k) < 4.5 && !['code', 'morse'].includes(lex.items[k].lang));
  const AP = 0.04, fpx = FPX100;
  const cocAt = d => AP * fpx * Math.abs(1 / d - 1 / DF);
  const lineBox = [700, 488, 1250, 600], subBox = [560, 790, 1360, 915];
  const overlap = (cx, cy, rx, ry, B) => cx + rx > B[0] && cx - rx < B[2] && cy + ry > B[1] && cy - ry < B[3];
  for (let i = 0; i < n; i++) {
    const layer = i < NF ? 0 : i < NF + NM ? 1 : i < NF + NM + NP ? 2 : 3;
    let d, sx, sy;
    if (layer === 0) d = 6 * Math.pow(10, Math.pow(r(), 1.3));
    else if (layer === 1) d = 3.1 + 1.9 * r();
    else if (layer === 2) d = 3.4 + 1.0 * r();
    else d = 0.7 + 0.7 * r();
    sx = -80 + 2080 * r(); sy = 120 + 840 * r();
    if (layer === 2) { sy = r() < 0.5 ? 250 + 190 * r() : 650 + 130 * r(); sx = 120 + 1680 * r(); }
    const x = (sx - 960) / fpx * d, y = -(sy - 540) / fpx * d;
    iPos.set([x, y, -d], 3 * i);
    const tok = layer !== 2 ? signs[Math.floor(r() * signs.length)] : words[Math.floor(r() * words.length)];
    iRect.set(lex.rects.subarray(tok * 4, tok * 4 + 4), 4 * i);
    const hpx = layer === 0 ? 6 + 4 * r() : layer === 3 ? 30 : layer === 1 ? 8 + 5 * r() : 12 + 9 * r();
    const hW = hpx * 1.6 * d / fpx;
    let b = Math.exp(1.05 * r.gauss()) * (layer === 0 ? 9.0 : layer === 1 ? 4.0 : layer === 2 ? 0.55 : 1.0);
    b = Math.min(b, layer === 0 ? 60 : layer === 2 ? 0.8 : 8);
    const coc = cocAt(d), rad = 0.5 * Math.max(coc, hpx * 1.6);
    if (overlap(sx, sy, rad * (layer === 0 ? 1 : 2.2), rad, lineBox)) b *= 0.1;
    else if (overlap(sx, sy, rad, rad, subBox)) b *= 0.2;
    iA.set([hW, b, r(), r()], 4 * i);
    const vx = (-3 - 4 * r()) * d / fpx, vy = (2 + 3 * r()) * d / fpx;
    iB.set([vx * (layer === 3 ? 6 : 1), vy * (layer === 3 ? 4 : 1), 0, 0], 4 * i);
    const h = r();
    const c = h < 0.55 ? [1.0, 0.36 + 0.28 * h, 0.09 + 0.14 * h] : h < 0.9 ? [1.0, 0.55 + 0.4 * (h - 0.55), 0.22 + 0.5 * (h - 0.55)] : [1.0, 0.86, 0.72];
    iCol.set(c, 3 * i);
  }
  const bok = glyphMesh(n, { iPos, iRect, iA, iB, iCol }, {
    points: false,
    vertexBody: /* glsl */ `p += vec3(iB.xy * (time - 180.0), 0.0); b *= 0.9 + 0.1 * sin(time * (0.4 + iA.z) + iA.w * 30.0);`,
  });
  const U = bok.material.uniforms;
  U.res.value.set(W, H); U.focus.value = DF; U.aperture.value = AP; U.minPx.value = 1.2; U.nearFade.value = [0.3, 0.6];
  U.discRange.value = [0.2, 0.6];
  const scene = new T.Scene(); scene.add(bok); scene.add(line);
  const cam = kit.filmCamera(W, H, { focalMM: 100, near: 0.01, far: 500 });
  // SB1 — the Chinese subtitle line, screen space (timeline.subtitles SB1: 300 48px, baseline 846)
  const SB = ctx.timeline.subtitles?.find(s2 => s2.id === 'SB1') || {};
  const sbFrames = SB.frames || [4356, 4416];
  const sbSize = SB.size || 48, sbBase = SB.baseline || 846;
  const sbFont = (SB.font || '300 48px "Noto Serif CJK SC"').replace(/(\d+)px/, (m2, v) => `${2 * parseFloat(v)}px`);   // 2× canvas
  const sbC = document.createElement('canvas'); sbC.width = 2000; sbC.height = 4 * sbSize;
  const sbBaseC = Math.round(2.6 * sbSize);
  { const g = sbC.getContext('2d'); g.font = sbFont; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff'; g.fillText(SB.zh || '……或许，他也不知道。', 1000, sbBaseC); }
  const sb = screenImage(sbC);
  sb.material.uniforms.rect.value.set(960 - 500, sbBase - sbBaseC / 2, 960 + 500, sbBase - sbBaseC / 2 + sbC.height / 2);
  sb.material.uniforms.color.value.set(...hdrForDisplay(SB.color || '#CFC9BE', SB.opacity ?? 0.85));
  const overlay = new T.Scene(); overlay.add(sb);
  const ortho = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // V2 mask: SB1 feeds and receives no bloom (it is a subtitle, crisp like cards.js)
  const mrect = new T.Mesh(new T.PlaneGeometry(2, 2), maskRectMaterial()); mrect.frustumCulled = false;
  mrect.material.uniforms.rect.value.set(560, sbBase - sbSize * 1.0, 1360, sbBase + sbSize * 0.3); mrect.material.uniforms.feather.value.set(8, 8);
  mrect.material.uniforms.rgb.value.set(1, 1, 1);
  const maskScene = new T.Scene(); maskScene.add(mrect);
  return {
    render(f) {
      const lt = f.t - 180;
      cam.position.copy(Q).multiplyScalar(0.003 * lt);
      cam.lookAt(cam.position.x, cam.position.y, cam.position.z - 1); cam.updateMatrixWorld();
      U.time.value = f.t;
      draw(scene, cam, f.target, false);
      const e = env(f.t, sbFrames[0] / FPS, sbFrames[1] / FPS, SB.fadeIn ?? 0.25, SB.fadeOut ?? 0.25);
      if (e > 0.001) {
        sb.material.uniforms.opacity.value = e; draw(overlay, ortho, f.target, false);
        if (f.mask && f.sub === 0) { const ac = renderer.autoClear; renderer.autoClear = false; renderer.setRenderTarget(f.mask); renderer.render(maskScene, ortho); renderer.autoClear = ac; renderer.setRenderTarget(f.target); }
      }
    },
  };
}
