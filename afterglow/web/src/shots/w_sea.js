// w_sea — the sea of words.
//   S34 光标 · 都还在   161.0–171.0  24 mm, locked at WEB_PATH(0) (= S10's first frame).
//        161–164 only the cursor at R, blinking (x.00–x.11 on): the film's first image again.
//        164.0  the first glyph 𒀭 (cuneiform AN, "sky" — the sign is a star) at (900, 450), 72 px,
//               AMBER HDR 1.4; readable 1.5 s, then it recedes and becomes one of the sea.
//        165.0  the darkness fills with words exactly the way S09 filled with first stars: 150 000
//               glyphs on the SAME web graph (seed 1990), far ones ignite first, near ones last.
//               Violet filament fog (cold) + amber words (warm): the first time they mix.
//        165.25–169.25 card ④ (cards.js): words under the card thinned to 40 %.
//        169.5  the cursor, instead of blinking off, breaks into 400 tiny words that join the sea:
//               it crumbles cell by cell (≈ 7 frames) as each grain takes its cell's light, and the
//               grains drift (ease-out, on screen) into the sea by 170.5.
//   S35 文字之海  171.0–180.0  WEB_PATH, 9 u/s from the first frame, no roll: frame-identical to S10.
//        Four readable lines (canvas2D planes, full resolution, racked into focus on their frame):
//        174.75「遂古之初，谁传道之？」(2.0 s, 40–64 px) · 176.75 Is anyone there? · 177.75
//        「誰かいますか？」· 178.75「هل يوجد أحد هنا؟」(1.0 s each). Everything else ≤ 32 px.
//        Warm amber fog replaces the violet one.
//   S36 或许他也不知道  180.0–184.0  100 mm, extremely shallow focus, dolly 0.3 %/s.
//        Rigveda X.129.7 सो अङ्ग वेद यदि वा न वेद (Noto Serif Devanagari 56 px, AMBER HDR 1.3), the
//        centre of सो on R; the rest of the sea is bokeh. SB1 「……或许，他也不知道。」 drawn here in
//        screen space (300 26px Noto Serif CJK SC, baseline 862), SB2 English by cards.js.
//
// Build: one glyph field (w_sea/lexicon.js) — point sprites for the many, instanced quads for the
// near ones, sized from depth. A word too small to read (< ≈ 4 px em) is drawn as a round point of
// light of the same energy: the far field is a starfield of words, never a field of dashes. Words
// come from one continuous stream of the corpus (each filament a run of consecutive words, each
// node clump a passage), so nothing reads as a word cloud. S34 adds a dense near field on the same
// edges in front of the locked lens so that the eye can read that the stars are words. Defocus =
// larger footprint + blurrier mip + aperture disc. Fog: 24 000 soft sprites along the same
// filaments, quarter resolution, violet → amber after the cursor has joined the sea (169.8–171).
// The readable line of S35 keeps a clear margin (sea words inside its screen box step back).
// S36: four depth layers of real-lens bokeh with a clear pocket around the line. All motion is
// analytic in t.
import * as THREE from 'three';
import { getWeb, sampleWebPoints, webPathPose, WEB } from './_webgraph.js';
import { getLexicon, assertFonts, PAL, glyphMesh, glyphField, screenRect, screenImage, hdrForDisplay, hash1, rng, RIGVEDA_7, Compactor, frustumTans } from './w_sea/lexicon.js';

const T34 = 161, T35 = 171, T36 = 180, T37 = 184;
const R = [734, 540];
const CURSOR_RECT = [722, 508, 746, 572];       // 24 × 64, centred on R
const FPX24 = 960 / (18 / 24);                  // focal length in 1080p px (filmCamera: 36 mm gauge)
const FPX100 = 960 / (18 / 100);
const N_SEA = 142000, N_NEAR = 8000, N_GAS = 24000, N_GRAIN = 400, N_MOTE = 450000;
const PROF = false;   // per-frame instance counts in the console
const CARD4 = [165.25, 169.25, 0.75];           // card ④ (timeline C04): start, end, fade

// four readable lines of S35: window [t0, t1], screen centre at the window middle, char size there
const LINES = [
  { text: '遂古之初，谁传道之？', font: '400 160px "Noto Serif CJK SC"', t0: 174.75, t1: 176.75, at: [600, 300], px: 50, D: 39 },
  { text: 'Is anyone there?', font: 'italic 400 170px "Cormorant Garamond"', t0: 176.75, t1: 177.75, at: [585, 600], px: 66, D: 24 },
  { text: '誰かいますか？', font: '400 150px "Noto Serif CJK JP"', t0: 177.75, t1: 178.75, at: [1290, 455], px: 46, D: 22 },
  { text: 'هل يوجد أحد هنا؟', font: '400 160px "Noto Naskh Arabic"', t0: 178.75, t1: 179.75, at: [905, 640], px: 52, D: 20, rtl: true },
];

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const env = (t, a, b, fi, fo) => Math.min(smooth(a, a + fi, t), 1 - smooth(b - fo, b, t));

export async function create(ctx) {
  const { THREE: T, renderer, W, H, kit, makeRT } = ctx;
  await assertFonts([
    ['400 72px "Noto Sans Cuneiform"', '𒀭'], ['400 56px "Noto Serif Devanagari"', 'सो अङ्ग वेद'],
    ['400 50px "Noto Serif CJK SC"', '遂古之初谁传道之'], ['italic 400 50px "Cormorant Garamond"', 'Is anyone there'],
    ['400 50px "Noto Serif CJK JP"', '誰かいますか'], ['400 50px "Noto Naskh Arabic"', 'هل يوجد أحد هنا'],
    ['300 26px "Noto Serif CJK SC"', '或许他也不知道'], ['400 40px "Noto Sans"', 'print Hello world'],
    ['400 40px "Noto Sans Egyptian Hieroglyphs"', '𓇼'], ['400 40px "Noto Serif Thai"', 'มีใครอยู่ไหม'],
  ]);
  const lex = getLexicon();
  const web = getWeb();
  const P0 = webPathPose(0);

  // =========================================================================================
  // The sea: 150 000 words on the web graph. Each filament carries one real sentence, its words
  // laid out in order along the strand; node clumps carry words of the node's sentence.
  const pts0 = sampleWebPoints(web, N_SEA, 7);
  // + words on the same filaments that pass within 2.5–12 units of WEB_PATH (so that some words are
  // close enough to be read as the camera flies, 18–32 px), drawn from a denser sampling (seed 9)
  const near = sampleWebPoints(web, 900000, 9), path = [];
  for (let k = 0; k <= 90; k++) path.push(webPathPose(k * 0.1).pos);
  const keepNear = []; let nearBig = 0, nearBig0 = 0;
  for (let i = 0; i < near.count && keepNear.length < N_NEAR; i++) {
    if (near.kind[i] !== 0) continue;
    const x = near.pos[3 * i], y = near.pos[3 * i + 1], z = near.pos[3 * i + 2];
    let dm = 1e9;
    for (let k = 0; k < path.length; k += 2) { const q = path[k]; const dd = (x - q.x) ** 2 + (y - q.y) ** 2 + (z - q.z) ** 2; if (dd < dm) dm = dd; }
    if (dm > 2.5 * 2.5 && dm < 12 * 12 && hash1(i, 91) < 0.55) keepNear.push(i);
  }
  nearBig0 = pts0.count + keepNear.length;
  // + S34's own near field: the camera is locked at WEB_PATH(0), where the uniform sampling leaves
  // almost nothing within reading distance. The same edges and the same lateral law (σ = 0.02 L),
  // sampled densely only where they pass 4–40 units in front of the lens (a level of detail of the
  // same graph) — the words that let the eye *read* that the stars are words.
  {
    const rN = rng(1990 * 34 + 7), F = P0.forward, Rt = P0.right, Up = P0.up, O = P0.pos;
    const tx = 18 / 24 + 0.05, ty = 10.125 / 24 * 804 / 1080 + 0.04;
    const { nodes: Nd, edges: Ed, E } = web;
    const extra = [];
    for (let e = 0; e < E; e++) {
      const a = Ed[2 * e], c = Ed[2 * e + 1];
      const ax = Nd[3 * a], ay = Nd[3 * a + 1], az = Nd[3 * a + 2], bx = Nd[3 * c], by = Nd[3 * c + 1], bz = Nd[3 * c + 2];
      const L = Math.hypot(bx - ax, by - ay, bz - az);
      // cheap reject: both ends far behind / far away
      const da = (ax - O.x) * F.x + (ay - O.y) * F.y + (az - O.z) * F.z, db = (bx - O.x) * F.x + (by - O.y) * F.y + (bz - O.z) * F.z;
      if ((da < 2 && db < 2) || (da > 75 && db > 75) || Math.min(Math.hypot(ax - O.x, ay - O.y, az - O.z), Math.hypot(bx - O.x, by - O.y, bz - O.z)) > 75 + L) continue;
      const m = Math.ceil(L * 9);
      for (let k = 0; k < m; k++) {
        const u = rN(), sg = 0.02 * L;
        const x = ax + (bx - ax) * u + rN.gauss() * sg, y = ay + (by - ay) * u + rN.gauss() * sg, z = az + (bz - az) * u + rN.gauss() * sg;
        const dx = x - O.x, dy = y - O.y, dz = z - O.z, d = dx * F.x + dy * F.y + dz * F.z;
        if (d < 3.5 || d > 58) continue;
        if (Math.abs(dx * Rt.x + dy * Rt.y + dz * Rt.z) > tx * d || Math.abs(dx * Up.x + dy * Up.y + dz * Up.z) > ty * d) continue;
        extra.push([x, y, z, e, u, u < 0.5 ? a : c]);
      }
    }
    for (let k = 0; k < extra.length; k++) if (hash1(k, 92) < 0.32) keepNear.push(extra[k]);
    nearBig = pts0.count + keepNear.length;
    console.log(`WARN w_sea: S34 near field ${extra.length} candidates`);
  }
  const pts = { count: pts0.count + keepNear.length, pos: new Float32Array((pts0.count + keepNear.length) * 3), edgeOf: new Uint32Array(pts0.count + keepNear.length), kind: new Uint8Array(pts0.count + keepNear.length), along: new Float32Array(pts0.count + keepNear.length), nodeOf: new Uint32Array(pts0.count + keepNear.length) };
  pts.pos.set(pts0.pos); pts.edgeOf.set(pts0.edgeOf); pts.kind.set(pts0.kind); pts.along.set(pts0.along); pts.nodeOf.set(pts0.nodeOf);
  keepNear.forEach((i, k) => {
    const o = pts0.count + k;
    if (Array.isArray(i)) { pts.pos.set(i.slice(0, 3), 3 * o); pts.edgeOf[o] = i[3]; pts.kind[o] = 0; pts.along[o] = i[4]; pts.nodeOf[o] = i[5]; return; }
    pts.pos.set(near.pos.subarray(3 * i, 3 * i + 3), 3 * o); pts.edgeOf[o] = near.edgeOf[i]; pts.kind[o] = 0; pts.along[o] = near.along[i]; pts.nodeOf[o] = near.nodeOf[i];
  });
  const n = pts.count + N_GRAIN;
  const iPos = new Float32Array(n * 3), iRect = new Float32Array(n * 4), iA = new Float32Array(n * 4), iB = new Float32Array(n * 4), iC = new Float32Array(n * 4), iCol = new Float32Array(n * 3);
  const r = rng(1990 * 34 + 1);
  // One continuous stream of human text: every sentence of the corpus once, in a fixed shuffled
  // order, word after word. Each filament reads a run of consecutive words of the stream (in strand
  // order), each node clump a longer passage — so a clump is a paragraph, never a word cloud of
  // one repeated "Salve".
  const order = lex.sentences.map((x, i) => i).filter(i => lex.sentences[i].sea.length)
    .sort((a, b) => hash1(a, 341) - hash1(b, 341));
  const stream = []; for (const i of order) stream.push(...lex.sentences[i].sea);
  const SL = stream.length;
  const perEdge = new Map();
  for (let i = 0; i < pts.count; i++) if (pts.kind[i] === 0) perEdge.set(pts.edgeOf[i], (perEdge.get(pts.edgeOf[i]) || 0) + 1);
  let clumpNode = -1, clumpK = 0;
  const warm = [[1.0, 0.36, 0.085], PAL.AMBER, [1.0, 0.58, 0.25], [1.0, 0.74, 0.47]];
  const pickCol = (h, bright) => {
    const k = h * 3, i = Math.min(2, Math.floor(k)), f = k - i;
    const c = warm[i].map((v, j) => v + (warm[i + 1][j] - v) * f);
    const wb = Math.min(1, Math.max(0, (bright - 1.2) / 3));          // the brightest run whiter (hotter)
    return c.map((v, j) => v + (PAL.CURSOR[j] - v) * wb * 0.45);
  };
  const { nodes, edges } = web;
  for (let i = 0; i < pts.count; i++) {
    const e = pts.edgeOf[i], isFil = pts.kind[i] === 0;
    let si;
    if (isFil) si = Math.floor(hash1(e, 34) * SL) + Math.min(perEdge.get(e) - 1, Math.floor(pts.along[i] * perEdge.get(e)));
    else { if (pts.nodeOf[i] !== clumpNode) { clumpNode = pts.nodeOf[i]; clumpK = 0; } si = Math.floor(hash1(clumpNode, 38) * SL) + clumpK++; }
    const tok = stream[si % SL];
    iRect.set(lex.rects.subarray(tok * 4, tok * 4 + 4), i * 4);
    iPos.set(pts.pos.subarray(3 * i, 3 * i + 3), 3 * i);
    // brightness: lognormal × node mass (a few heavy clusters, many faint knots)
    const m = web.mass[pts.nodeOf[i]];
    let b = Math.exp(0.85 * r.gauss()) * 1.1 * (0.55 + 0.45 * Math.sqrt(Math.min(m, 9)));
    b = Math.min(b, 14);
    // (S34's near field: larger glyphs, so that at 25–55 units they are 10–24 px — readable words)
    const hW = (i >= nearBig0 && i < nearBig ? 0.44 : 0.19) * Math.exp(0.28 * r.gauss()) * (isFil ? 1 : 0.85);
    const h1 = r(), h2 = r();
    iA.set([Math.min(0.42, Math.max(0.09, hW)), b, h1, h2], i * 4);
    iCol.set(pickCol(r(), b), 3 * i);
    // flow along the filament (each strand flows one way), slow: ≈ 0.07 u/s
    if (isFil) {
      const a = edges[2 * e], c = edges[2 * e + 1];
      let dx = nodes[3 * c] - nodes[3 * a], dy = nodes[3 * c + 1] - nodes[3 * a + 1], dz = nodes[3 * c + 2] - nodes[3 * a + 2];
      const L = Math.hypot(dx, dy, dz) || 1, v = (0.045 + 0.05 * hash1(e, 35)) * (hash1(e, 36) < 0.5 ? -1 : 1) / L;
      iB.set([dx * v, dy * v, dz * v, 0], i * 4);
    } else iB.set([0, 0, 0, 1], i * 4);
    // ignition: distance from S34's camera; far first (like the first stars), near last
    const d0 = Math.hypot(iPos[3 * i] - P0.pos.x, iPos[3 * i + 1] - P0.pos.y, iPos[3 * i + 2] - P0.pos.z);
    const u = 1 - smooth(10, 250, d0);
    iC[i * 4 + 3] = 165.0 + 3.2 * Math.pow(u, 1.25) + 0.35 * r();
  }
  // the cursor's 400 grains (kind 2): start on a 10 × 40 grid inside the cursor block, on the camera
  // ray at depth 6, then drift out into the sea (rest = their place in the sea from then on)
  const camRay = (px, py, d, P = P0) => P.pos.clone().addScaledVector(P.forward, d)
    .addScaledVector(P.right, (px - 960) / FPX24 * d).addScaledVector(P.up, -(py - 540) / FPX24 * d);
  const shortToks = lex.sea.filter(k => lex.rowAspect(k) < 2.2);
  const rg = rng(169);
  const grainDelay = new Uint8Array(N_GRAIN * 4);      // per cell of the block: when its grain leaves
  for (let k = 0; k < N_GRAIN; k++) {
    const i = pts.count + k;
    const gx = k % 10, gy = Math.floor(k / 10);
    const px = CURSOR_RECT[0] + (gx + 0.5) * 2.4, py = CURSOR_RECT[1] + (gy + 0.5) * 1.6;
    const s = camRay(px, py, 6);
    const ang = rg() * Math.PI * 2, rad = 40 + 260 * Math.pow(rg(), 0.7);
    const dRest = 9 + 34 * Math.pow(rg(), 1.4);
    const rest = camRay(px + Math.cos(ang) * rad, py + Math.sin(ang) * rad * 0.8, dRest);
    const tok = shortToks[Math.floor(rg() * shortToks.length)];
    iRect.set(lex.rects.subarray(tok * 4, tok * 4 + 4), i * 4);
    iPos.set([rest.x, rest.y, rest.z], 3 * i);
    const b = 0.35 * Math.exp(0.5 * rg.gauss());
    iA.set([0.16 * Math.exp(0.2 * rg.gauss()), b, rg(), rg()], i * 4);
    iB.set([0, 0, 0, 2], i * 4);
    iC.set([s.x, s.y, s.z, 0.22 * Math.pow(rg(), 1.5)], i * 4);
    grainDelay[4 * k] = Math.round(iC[i * 4 + 3] / 0.25 * 255); grainDelay[4 * k + 3] = 255;
    iCol.set(pickCol(rg(), b), 3 * i);
  }
  const GRAIN_H0 = 2.4 * 6 / FPX24;   // start height: a 2.4-px grain at depth 6

  const seaF = glyphField(n, { iPos, iRect, iA, iB, iC, iCol }, {
    uniforms: { uCard: { value: 0 }, uClear: { value: new T.Vector4(0, 0, 0, 0) }, uClearK: { value: 0 }, uGrainH: { value: GRAIN_H0 }, uCamC: { value: P0.pos.clone() }, uCamF: { value: P0.forward.clone() }, uCurCol: { value: new T.Vector3(...PAL.CURSOR) }, uFlowT0: { value: T34 } },
    header: /* glsl */ `uniform float uCard, uGrainH, uFlowT0, uClearK; uniform vec3 uCurCol, uCamC, uCamF; uniform vec4 uClear;`,
    vertexBody: /* glsl */ `
      float kind = iB.w;
      vec3 flow = iB.xyz * (time - uFlowT0);
      if (kind < 1.5) {
        p += flow;
        float age = time - iC.w;
        b *= smoothstep(0.0, 0.32, age) * (1.0 + 1.5 * exp(-max(age, 0.0) * 4.5));   // ignites like a star
        b *= 0.88 + 0.12 * sin(time * (0.5 + 1.6 * iA.z) + iA.w * 40.0);              // breathing
      } else {
        // a grain of the cursor: its cell of the block goes out (169.5 + delay, 2 frames) and the
        // grain takes over the cell's light (cursor white, HDR ≈ the block's energy), then drifts
        // out into the sea, every grain arriving by 170.5 (ease-out: it drifts, never bursts),
        // cooling to amber and dimming to its sea level on the way
        float dt = time - 169.5 - iC.w;
        float u = clamp(dt / (1.0 - iC.w), 0.0, 1.0);
        float e = 1.0 - (1.0 - u) * (1.0 - u);
        // interpolated on screen (the ray) and in depth separately — a straight world-space mix
        // would be dominated by the near end and jump half-way across the screen in 2 frames
        vec3 rs = iC.xyz - uCamC, rq = p - uCamC;
        float ds = dot(rs, uCamF), dq = dot(rq, uCamF);
        float dd = mix(ds, dq, e);
        p = uCamC + mix(rs / ds, rq / dq, e) * dd;
        float hRest = hW;
        hW = mix(uGrainH * dd / ds, hRest, e * e);
        col = mix(uCurCol, col, smoothstep(0.25, 1.0, u));
        // the block's energy (HDR ≈ 4 in a 2.4-px grain), spread as the grain grows into a word
        float gr = (uGrainH / ds) / max(1e-6, hW / dd);
        b = max(b, 4.2 * gr * gr) * smoothstep(0.0, 0.083, dt);
      }
      // card ④: words in the lower 260 px of the band thinned to 40 % (by hash; no dark halo)
      vec4 cp = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      float yPx = (0.5 - 0.5 * cp.y / max(cp.w, 1e-4)) * 1080.0;
      float keep = 1.0 - 0.6 * uCard * smoothstep(662.0, 702.0, yPx);
      b *= smoothstep(0.0, 0.06, keep - iA.z);
      // the readable line of S35 keeps a clear margin: sea words whose centre falls inside its
      // screen rectangle step back (dimmed, no dark halo — the far motes stay)
      float xPx = (0.5 + 0.5 * cp.x / max(cp.w, 1e-4)) * 1920.0;
      float inR = smoothstep(uClear.x - 18.0, uClear.x, xPx) * (1.0 - smoothstep(uClear.z, uClear.z + 18.0, xPx))
                * smoothstep(uClear.y - 14.0, uClear.y, yPx) * (1.0 - smoothstep(uClear.w, uClear.w + 14.0, yPx));
      b *= 1.0 - uClearK * inR;
      // near-field words (≥ 14 px rows) never blow out into a bloom blob (HDR ≤ 1.4), and a big word
      // whose box reaches under the letterbox edge (band 138–942) fades out before it gets there —
      // nothing bright lives on the bar edge
      float hPx = hW * projectionMatrix[1][1] * 540.0 / max(cp.w, 1e-4);
      b = min(b, mix(1e4, 1.4, smoothstep(10.0, 20.0, hPx)));
      float edgeK = smoothstep(150.0, 190.0, yPx - 0.5 * hPx) * (1.0 - smoothstep(890.0, 930.0, yPx + 0.5 * hPx));
      b *= mix(1.0, edgeK, smoothstep(7.0, 15.0, hPx));`,
  });
  const sea = seaF.pts;
  sea.material.uniforms.res.value.set(W, H);
  const births = new Float32Array(n); for (let i = 0; i < pts.count; i++) births[i] = iC[4 * i + 3];
  const seaC = new Compactor(sea.geometry, { iPos, iRect, iRect2: iRect, iA, iB, iC, iCol }, n,
    { pos: iPos, flow: iB, flowStride: 4, flowOffset: 0, flowT0: T34, birth: births, always: N_GRAIN, big: seaF.quads.geometry, bigPx: 18 });
  sea.material.uniforms.capPx.value = [34, 52];     // quad height (≈ 1.6 × glyph size): ≤ 32 px glyphs
  sea.material.uniforms.nearFade.value = [0.6, 2.2];
  sea.material.uniforms.moteRange.value = [6.5, 12];   // atlas-row px: below ≈ 4 px em a word is a star

  // =========================================================================================
  // Far field: 450 000 motes on the same web (screenplay fallback C1). Beyond ~40 units every word
  // is a 1–2 px point of light anyway; these give the filaments their S10 density. Same ignition
  // law, same flow, same card thinning as the words.
  const mp = sampleWebPoints(web, N_MOTE, 8);
  const mA = new Float32Array(mp.count * 4), mFlow = new Float32Array(mp.count * 3), mCol = new Float32Array(mp.count * 3);
  const rm = rng(1990 * 34 + 2);
  for (let i = 0; i < mp.count; i++) {
    const m = web.mass[mp.nodeOf[i]];
    const b = Math.min(9, Math.exp(0.9 * rm.gauss()) * 0.42 * (0.5 + 0.5 * Math.sqrt(Math.min(m, 9))));
    const d0 = Math.hypot(mp.pos[3 * i] - P0.pos.x, mp.pos[3 * i + 1] - P0.pos.y, mp.pos[3 * i + 2] - P0.pos.z);
    mA.set([b, 165.0 + 3.2 * Math.pow(1 - smooth(10, 250, d0), 1.25) + 0.35 * rm(), rm(), 0], 4 * i);
    mCol.set(pickCol(rm(), b * 3), 3 * i);
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
  const moteC = new Compactor(mGeo, { position: mPos, mA, mFlow, mCol }, mp.count, { pos: mPos, flow: mFlow, flowT0: T34, birth: mBirth, instanced: false });
  const moteMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, pxs: { value: H / 1080 }, gain: { value: 1 }, uCard: { value: 0 }, uFlowT0: { value: T34 } },
    vertexShader: /* glsl */ `attribute vec4 mA; attribute vec3 mFlow, mCol; uniform float time, pxs, gain, uCard, uFlowT0; varying vec3 vC;
      void main(){
        vec3 p = position + mFlow * (time - uFlowT0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
        gl_Position = projectionMatrix * mv;
        float age = time - mA.y;
        float b = mA.x * smoothstep(0.0, 0.32, age) * (1.0 + 1.5 * exp(-max(age, 0.0) * 4.5));
        b *= 0.85 + 0.15 * sin(time * (0.6 + 2.0 * mA.z) + mA.z * 70.0);
        float s = clamp(70.0 / max(d, 1.0), 1.0, 2.4) * pxs;
        gl_PointSize = max(s, 1.0);
        b *= smoothstep(4.0, 14.0, d) * min(1.0, s * s);
        float yPx = (0.5 - 0.5 * gl_Position.y / max(gl_Position.w, 1e-4)) * 1080.0;
        float keep = 1.0 - 0.6 * uCard * smoothstep(662.0, 702.0, yPx);
        b *= smoothstep(0.0, 0.06, keep - mA.z);
        if (b < 1e-4) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        vC = mCol * b * gain;
      }`,
    fragmentShader: /* glsl */ `varying vec3 vC; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; gl_FragColor = vec4(vC * exp(-dot(q, q) * 2.2), 1.0); }`,
  });
  const motes = new T.Points(mGeo, moteMat); motes.frustumCulled = false;

  // =========================================================================================
  // Fog: soft sprites along the same filaments (quarter resolution)
  const gp = sampleWebPoints(web, N_GAS, 11, { clumpShare: 0.12 });
  const gGeo = new T.BufferGeometry();
  gGeo.setAttribute('position', new T.BufferAttribute(gp.pos, 3));
  const gs = new Float32Array(gp.count); for (let i = 0; i < gp.count; i++) gs[i] = 0.75 + 0.5 * hash1(i, 77);
  gGeo.setAttribute('gs', new T.BufferAttribute(gs, 1));
  const gasMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    uniforms: { fpxQ: { value: 1 }, alpha: { value: 0.02 }, hazeCol: { value: new T.Vector3(...PAL.HAZE) }, gain: { value: 1 } },
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

  // =========================================================================================
  // Text planes (canvas2D, full resolution, mip-mapped): 𒀭 and the four readable lines.
  const planeMat = (tex) => new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    uniforms: { tex: { value: tex }, color: { value: new T.Vector3(...PAL.AMBER) }, gain: { value: 0 }, bias: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tex; uniform vec3 color; uniform float gain, bias; varying vec2 vUv;
      void main(){ float a = texture2D(tex, vUv, bias).a; gl_FragColor = vec4(color * gain * a, 1.0); }`,
  });
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; draw(g, c);
    const tx = new T.CanvasTexture(c);
    tx.minFilter = T.LinearMipmapLinearFilter; tx.magFilter = T.LinearFilter; tx.generateMipmaps = true; tx.anisotropy = 8;
    return tx;
  };
  const mainScene = new T.Scene(); mainScene.add(motes); mainScene.add(seaF.group);
  // 𒀭: a plane on the camera ray through (900, 450); 72-px glyph at depth 10, receding to depth 42
  const anTex = canvasTex(320, 320, g => { g.font = '400 200px "Noto Sans Cuneiform"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('𒀭', 160, 160); });
  const AN_D0 = 10, AN_D1 = 70;           // 72 px at depth 10 → ≈ 10 px at depth 70: one word of the sea
  const an = new T.Mesh(new T.PlaneGeometry(1, 1), planeMat(anTex));
  an.frustumCulled = false; mainScene.add(an);
  const anDir = camRay(900, 450, 1).sub(P0.pos);          // unnormalised: point at depth d = P0.pos + anDir·d
  const anQuat = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(P0.right, P0.up, P0.forward.clone().negate()));
  // the four lines
  for (const L of LINES) {
    const fpxSize = parseFloat(L.font.match(/(\d+)px/)[1]);
    const meas = document.createElement('canvas').getContext('2d'); meas.font = L.font;
    const tw = Math.ceil(meas.measureText(L.text).width);
    const cw = tw + 2 * Math.round(fpxSize * 0.6), ch = Math.round(fpxSize * 1.9);
    L.fx = (tw / 2 + 0.3 * fpxSize) / cw; L.fy = 0.62 * fpxSize / ch;   // text box (+ margin) as a fraction of the plane
    L.tex = canvasTex(cw, ch, g => { g.font = L.font; g.textBaseline = 'middle'; g.textAlign = 'center'; if (L.rtl) g.direction = 'rtl'; g.fillText(L.text, cw / 2, ch / 2); });
    const tm = (L.t0 + L.t1) / 2 - T35, P = webPathPose(tm);
    const centre = camRay(L.at[0], L.at[1], L.D, P);
    const s = L.px * L.D / FPX24 / fpxSize;               // world units per canvas px (glyph em = px at D)
    L.mesh = new T.Mesh(new T.PlaneGeometry(cw * s, ch * s), planeMat(L.tex));
    L.mesh.position.copy(centre);
    // face the camera at mid-window (normal → camera), keeping the camera's up
    const nrm = P.pos.clone().sub(centre).normalize(), rt = new T.Vector3().crossVectors(P.up, nrm).normalize(), up = new T.Vector3().crossVectors(nrm, rt);
    L.mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(rt, up, nrm));
    L.mesh.frustumCulled = false; L.mesh.visible = false; mainScene.add(L.mesh);
  }
  // cursor (screen space, exact pixels)
  const cursor = screenRect(); cursor.material.uniforms.color.value.set(...PAL.CURSOR.map(v => v * 2.0));
  // 169.5: the block goes out cell by cell (10 × 40 cells of 2.4 × 1.6 px), each cell at the moment
  // its grain leaves (fade 2 frames) — the light is handed over, the bloom never drops out
  const delayTex = new T.DataTexture(grainDelay, 10, 40, T.RGBAFormat); delayTex.needsUpdate = true;
  delayTex.minFilter = delayTex.magFilter = T.NearestFilter; delayTex.flipY = false;
  cursor.material.uniforms.uDelay = { value: delayTex }; cursor.material.uniforms.uT = { value: 0 };
  cursor.material.vertexShader = cursor.material.vertexShader.replace('uniform vec4 rect;', 'uniform vec4 rect; varying vec2 vC;').replace('vec2 c = position.xy * 0.5 + 0.5;', 'vec2 c = position.xy * 0.5 + 0.5; vC = c;');
  cursor.material.fragmentShader = /* glsl */ `uniform vec3 color; uniform sampler2D uDelay; uniform float uT; varying vec2 vC;
    void main(){ vec2 cell = (floor(clamp(vC, 0.0, 0.9999) * vec2(10.0, 40.0)) + 0.5) / vec2(10.0, 40.0);
      float dl = texture2D(uDelay, cell).r * 0.25;
      float k = 1.0 - smoothstep(0.0, 0.083, uT - 169.5 - dl);
      gl_FragColor = vec4(color * k, 1.0); }`;
  const overlay = new T.Scene(); overlay.add(cursor);
  const ortho = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const cam = kit.filmCamera(W, H, { focalMM: 24, near: 0.05, far: 3000 });
  const setPose = (P) => { cam.position.copy(P.pos); cam.up.copy(P.up); cam.lookAt(P.pos.clone().add(P.forward)); cam.updateMatrixWorld(); };

  // =========================================================================================
  // S36: 100 mm close-up. Its own little world: the line at the focus plane, the sea as bokeh.
  const S36 = buildS36(ctx, lex, canvasTex, planeMat);

  const draw = (scene, camera, target, clear) => {
    const ac = renderer.autoClear; renderer.autoClear = !!clear;
    renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.autoClear = ac;
  };

  function renderSea(shot, f) {
    const t = f.t, s34 = t < T35;
    const P = s34 ? P0 : webPathPose(Math.min(WEB.duration + 0.5, t - T35));
    setPose(P);
    const tans = frustumTans(cam, H, f.barPx);
    seaC.update(cam, t, { ...tans, near: 0.5, margin: 1.6, fpx: FPX24 });
    moteC.update(cam, t, { ...tans, near: 3.5, margin: 0.4 });
    const U = sea.material.uniforms;
    U.time.value = t;
    U.uCard.value = env(t, CARD4[0], CARD4[1], CARD4[2], CARD4[2]);
    moteMat.uniforms.time.value = t; moteMat.uniforms.uCard.value = U.uCard.value;
    // focus: S34 deep focus; S35 racks to the line that is being read
    let focus = 40, ap = 0.006;
    if (!s34) {
      const L = LINES.find((l, i) => t < l.t1 + (i === LINES.length - 1 ? 0.3 : -0.12)) || LINES[LINES.length - 1];
      focus = Math.max(4, L.mesh.position.distanceTo(P.pos)); ap = 0.014;
    }
    U.focus.value = focus; U.aperture.value = ap;
    // 𒀭
    const aU = an.material.uniforms;
    if (t >= 164.0) {
      // readable 164.0–165.5, then it recedes along its ray (1/d in screen size, so the eye reads a
      // steady drift away) and dims to the sea's level by 167.2; from then on it is a word of the sea
      const k = smooth(165.5, 167.2, t), d = 1 / (1 / AN_D0 + (1 / AN_D1 - 1 / AN_D0) * k);
      an.position.copy(P0.pos).addScaledVector(anDir, d);
      an.quaternion.copy(anQuat);
      const sc = 72 * (320 / 200) * AN_D0 / FPX24; an.scale.set(sc, sc, 1);   // fixed world size: 72 px at depth 10
      const on = smooth(164.0, 164.17, t);
      // in S35 the camera flies towards it: same ≤ 32 px rule as every other word
      const depth = an.position.clone().sub(P.pos).dot(P.forward);
      const px = depth > 0.05 ? sc * (200 / 320) * FPX24 / depth : 1e3;
      aU.gain.value = on * (1.4 + 0.9 * Math.exp(-(t - 164.0) * 6)) * (1 - 0.55 * k) * (s34 ? 1 : 1 - smooth(24, 34, px));
      aU.bias.value = 0;
      an.visible = true;
    } else an.visible = false;
    // readable lines: blurred glow → rack to focus at t0 (the celesta frame) → hold → defocus out
    for (let li = 0; li < LINES.length; li++) {
      const L = LINES[li], u = L.mesh.material.uniforms;
      // before its window a line is only a soft warm smear (a light not yet a sentence): one line
      // readable at a time. At a handover the outgoing line is already racked out (≈ 6 frames,
      // ending 1 frame before the boundary) while the next one racks in over the last 5 frames, so
      // the two are never sharp together; the last line (no successor) defocuses after its window.
      const last = li === LINES.length - 1;
      const pre = smooth(L.t0 - 1.4, L.t0 - 0.4, t), focusIn = smooth(L.t0 - (li ? 0.21 : 0.33), L.t0, t);
      const out = last ? smooth(L.t1, L.t1 + 0.4, t) : smooth(L.t1 - 0.30, L.t1 - 0.04, t);
      u.bias.value = 5.6 * (1 - focusIn) + 5.0 * out;
      u.gain.value = (0.07 * pre + 1.33 * focusIn) * (1 - out);
      L.mesh.visible = !s34 && u.gain.value > 0.002;
    }
    // clear zone around the line being read (projected bbox of its text plane)
    let ck = 0;
    for (const L of LINES) {
      const g = L.mesh.material.uniforms.gain.value / 1.4;
      if (L.mesh.visible && g > ck) {
        ck = g; const pa = L.mesh.geometry.parameters, bb = [1e9, 1e9, -1e9, -1e9];
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const v = new T.Vector3(sx * pa.width * L.fx, sy * pa.height * L.fy, 0).applyQuaternion(L.mesh.quaternion).add(L.mesh.position).project(cam);
          const x = (v.x * 0.5 + 0.5) * 1920, y = (0.5 - 0.5 * v.y) * 1080;
          bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y);
        }
        U.uClear.value.set(bb[0] - 48, bb[1] - 30, bb[2] + 48, bb[3] + 30);   // word centres: allow for their own extent
      }
    }
    U.uClearK.value = Math.min(1, ck);
    draw(mainScene, cam, f.target, false);
    // fog (violet in S34, fading in with the words; amber in S35)
    const gu = gasMat.uniforms;
    gu.fpxQ.value = cam.projectionMatrix.elements[5] * gasRT.height * 0.5;
    // violet (S10's) fog while card ④ speaks; once the cursor has dissolved into the words the
    // filaments warm to amber (169.8–171.0), so the cut to S35 is a cut of motion only
    const warmK = smooth(169.8, 171.0, t);
    gu.hazeCol.value.set(...PAL.HAZE.map((v, j) => v + (PAL.SODIUM[j] - v) * warmK));
    gu.alpha.value = 0.02 + (0.015 - 0.02) * warmK;
    gu.gain.value = (0.42 + (0.6 - 0.42) * warmK) * smooth(165.0, 168.8, t);
    if (gu.gain.value > 0.001) {
      draw(gasScene, cam, gasRT, true);
      comp.material.uniforms.gain.value = 1;
      const ac = renderer.autoClear; renderer.autoClear = false; comp.render(renderer, f.target); renderer.autoClear = ac;
    }
    if (PROF) console.log(`WARN w_sea t=${t.toFixed(2)} words ${seaC.count}+${seaC.bigCount} motes ${moteC.count}`);
    // the cursor: blinking at R until 169.5, then it crumbles into the grains (≈ 7 frames)
    const on = s34 && ((t < 169.5 && (t - Math.floor(t)) < 0.5 - 1e-6) || (t >= 169.5 - 1e-6 && t < 169.84));
    cursor.material.uniforms.uT.value = t;
    if (on) {
      cursor.material.uniforms.rect.value.set(...CURSOR_RECT);
      draw(overlay, ortho, f.target, false);
    }
  }

  return {
    render(shot, f) {
      if (shot.id === 'S36') S36.render(f, draw);
      else renderSea(shot, f);
      renderer.setRenderTarget(f.target);
    },
    post(shot, f) {
      if (shot.id === 'S34') return { bloom: 0.8, streak: 0.3, exposure: 1.0 };
      if (shot.id === 'S35') return { bloom: 0.8, streak: 0.22, exposure: 1.0 };
      return { bloom: 0.95, streak: 0.14, exposure: 1.0, vignette: 0.26 };
    },
  };
}

// =============================================================================================
// S36 — सो अङ्ग वेद यदि वा न वेद. 100 mm; focus plane at DF = 2.5 units; the line's first syllable
// centred on R; camera dollies along the ray through सो (so R never moves) at 0.3 % / s.
function buildS36(ctx, lex, canvasTex, planeMat) {
  const { THREE: T, renderer, W, H, kit } = ctx;
  const DF = 2.5, FONT = 112, FSPEC = `400 ${FONT}px "Noto Serif Devanagari"`;   // 2× canvas for 56 px
  const text = RIGVEDA_7.t;
  const m = document.createElement('canvas').getContext('2d'); m.font = FSPEC;
  const full = m.measureText(text), so = m.measureText('सो');
  const pad = 80, cw = Math.ceil(full.width) + 2 * pad, ch = 300, base = 190;
  const tex = canvasTex(cw, ch, g => { g.font = FSPEC; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillText(text, pad, base); });
  // ink centre of सो in canvas px
  const soCx = pad + (so.actualBoundingBoxRight - so.actualBoundingBoxLeft) / 2;
  const soCy = base - (so.actualBoundingBoxAscent - so.actualBoundingBoxDescent) / 2;
  const s = (56 / FONT) * DF / FPX100;                       // world per canvas px
  const Q = new T.Vector3((R[0] - 960) / FPX100 * DF, -(R[1] - 540) / FPX100 * DF, -DF);   // सो centre
  const line = new T.Mesh(new T.PlaneGeometry(cw * s, ch * s), planeMat(tex));
  // plane centre so that (soCx, soCy) lands on Q
  line.position.set(Q.x + (cw / 2 - soCx) * s, Q.y - (ch / 2 - soCy) * s, -DF);
  line.material.uniforms.gain.value = 1.3;
  line.frustumCulled = false;
  // The sea as a 100 mm lens sees it at f/1.4: four depth layers, sparse and uneven, like real
  // bokeh — never a wallpaper of equal discs.
  //   far    (6–60 u)   ~110 round discs 45–80 px: single signs, so the aperture shape stays round
  //   mid    (3.1–5 u)  ~34 signs, 20–40 px discs: the sea right behind the line
  //   words  (3.4–4.4 u) a dozen words above / below the line, out of focus (CoC ≈ 1–2 × their height):
//                      only the line itself is sharp — everything else is bokeh
  //   front  (0.7–1.4 u) 5 huge, very faint discs drifting through the lens
  // A clear pocket around the line and the subtitle: discs whose footprint would cross them are
  // dimmed (×0.1 / ×0.3) — legibility first, and the line reads as the one lamp in the room.
  const NF = 112, NM = 34, NP = 12, NX = 5, n = NF + NM + NP + NX;
  const iPos = new Float32Array(n * 3), iRect = new Float32Array(n * 4), iA = new Float32Array(n * 4), iB = new Float32Array(n * 4), iCol = new Float32Array(n * 3);
  const r = rng(36036);
  const signs = lex.sea.filter(k => lex.rowAspect(k) < 1.25), words = lex.sea.filter(k => lex.rowAspect(k) > 1.6 && lex.rowAspect(k) < 4.5 && !['code', 'morse'].includes(lex.items[k].lang));   // human words only near the lamp
  const AP = 0.04, fpx = FPX100;
  const cocAt = d => AP * fpx * Math.abs(1 / d - 1 / DF);
  const lineBox = [700, 488, 1250, 600], subBox = [740, 820, 1180, 915];
  const overlap = (cx, cy, rx, ry, B) => cx + rx > B[0] && cx - rx < B[2] && cy + ry > B[1] && cy - ry < B[3];
  for (let i = 0; i < n; i++) {
    const layer = i < NF ? 0 : i < NF + NM ? 1 : i < NF + NM + NP ? 2 : 3;
    let d, sx, sy;
    if (layer === 0) d = 6 * Math.pow(10, Math.pow(r(), 1.3));
    else if (layer === 1) d = 3.1 + 1.9 * r();
    else if (layer === 2) d = 3.4 + 1.0 * r();     // behind the focus plane: soft capsules, never sharp
    else d = 0.7 + 0.7 * r();
    // screen position (1080p px); plane-layer words stay out of the line's rows
    sx = -80 + 2080 * r(); sy = 120 + 840 * r();
    if (layer === 2) { sy = r() < 0.5 ? 250 + 190 * r() : 650 + 130 * r(); sx = 120 + 1680 * r(); }
    const x = (sx - 960) / fpx * d, y = -(sy - 540) / fpx * d;
    iPos.set([x, y, -d], 3 * i);
    const tok = layer !== 2 ? signs[Math.floor(r() * signs.length)] : words[Math.floor(r() * words.length)];
    iRect.set(lex.rects.subarray(tok * 4, tok * 4 + 4), 4 * i);
    // world height: far signs ~ 6–10 px if they were in focus, words 9–16 px
    const hpx = layer === 0 ? 6 + 4 * r() : layer === 3 ? 30 : layer === 1 ? 8 + 5 * r() : 12 + 9 * r();
    const hW = hpx * 1.6 * d / fpx;
    // brightness: lognormal, most discs dim, a few bright lamps (energy is spread over the disc)
    let b = Math.exp(1.05 * r.gauss()) * (layer === 0 ? 9.0 : layer === 1 ? 4.0 : layer === 2 ? 0.55 : 1.0);
    b = Math.min(b, layer === 0 ? 60 : layer === 2 ? 0.8 : 8);   // in-focus neighbours never outshine the line
    const coc = cocAt(d), rad = 0.5 * Math.max(coc, hpx * 1.6);
    if (overlap(sx, sy, rad * (layer === 0 ? 1 : 2.2), rad, lineBox)) b *= 0.1;
    else if (overlap(sx, sy, rad, rad, subBox)) b *= 0.3;
    iA.set([hW, b, r(), r()], 4 * i);
    // slow drift (screen-relative px/s → world): the sea moves past the lamp, upward and to the left
    const vx = (-3 - 4 * r()) * d / fpx, vy = (2 + 3 * r()) * d / fpx;
    iB.set([vx * (layer === 3 ? 6 : 1), vy * (layer === 3 ? 4 : 1), 0, 0], 4 * i);
    const h = r();
    const c = h < 0.55 ? [1.0, 0.36 + 0.28 * h, 0.09 + 0.14 * h] : h < 0.9 ? [1.0, 0.55 + 0.4 * (h - 0.55), 0.22 + 0.5 * (h - 0.55)] : [1.0, 0.86, 0.72];
    iCol.set(c, 3 * i);
  }
  const bok = glyphMesh(n, { iPos, iRect, iA, iB, iCol }, {
    points: false,                       // big discs must not pop at the frame edge
    vertexBody: /* glsl */ `p += vec3(iB.xy * (time - 180.0), 0.0); b *= 0.9 + 0.1 * sin(time * (0.4 + iA.z) + iA.w * 30.0);`,
  });
  const U = bok.material.uniforms;
  U.res.value.set(W, H); U.focus.value = DF; U.aperture.value = AP; U.minPx.value = 1.2; U.nearFade.value = [0.3, 0.6];
  // a defocused sign is a round aperture disc (a capsule for a word), never a blurred glyph box
  U.discRange.value = [0.2, 0.6];
  // the lamp: a very faint warm light around the line (the bloom of a small night-light in air)
  const glowMat = new T.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { c: { value: new T.Vector3(...PAL.AMBER.map(v => v * 0.022)) }, rect: { value: new T.Vector4(960 + 0, 545, 520, 110) } },
    vertexShader: /* glsl */ `varying vec2 vPx; void main(){ vPx = (position.xy * 0.5 + 0.5) * vec2(1920.0, 1080.0); vPx.y = 1080.0 - vPx.y; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 c; uniform vec4 rect; varying vec2 vPx;
      void main(){ vec2 q = (vPx - rect.xy) / rect.zw; gl_FragColor = vec4(c * exp(-dot(q, q)), 1.0); }`,
  });
  const glow = new T.Mesh(new T.PlaneGeometry(2, 2), glowMat); glow.frustumCulled = false;
  const scene = new T.Scene(); scene.add(bok); scene.add(line);
  const glowScene = new T.Scene(); glowScene.add(glow);
  const cam = kit.filmCamera(W, H, { focalMM: 100, near: 0.01, far: 500 });
  // SB1 — the Chinese subtitle line, screen space (baseline 862, centred on x 960)
  const SB = ctx.timeline.subtitles?.find(s2 => s2.id === 'SB1') || { start: 180.5, end: 184.0, fadeIn: 0.25, fadeOut: 0.25, zh: '……或许，他也不知道。' };
  const sbFont = '300 52px "Noto Serif CJK SC"';             // 2× canvas for 26 px
  const sbC = document.createElement('canvas'); sbC.width = 1600; sbC.height = 160;
  { const g = sbC.getContext('2d'); g.font = sbFont; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 20; g.fillStyle = '#fff'; g.fillText(SB.zh, 800, 100); }
  const sb = screenImage(sbC);
  sb.material.uniforms.rect.value.set(960 - 400, 862 - 50, 960 + 400, 862 + 30);   // canvas baseline (100/160) → 862
  sb.material.uniforms.color.value.set(...hdrForDisplay('#CFC9BE', 0.85));
  const overlay = new T.Scene(); overlay.add(sb);
  const ortho = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    render(f, draw) {
      const lt = f.t - 180;
      const k = 0.003 * lt;                                 // 0.3 % / s towards सो
      cam.position.copy(Q).multiplyScalar(k);
      cam.lookAt(cam.position.x, cam.position.y, cam.position.z - 1); cam.updateMatrixWorld();
      U.time.value = f.t;
      draw(scene, cam, f.target, false);
      draw(glowScene, ortho, f.target, false);
      const e = env(f.t, SB.start, SB.end, SB.fadeIn ?? 0.25, SB.fadeOut ?? 0.25);
      if (e > 0.001) { sb.material.uniforms.opacity.value = e; draw(overlay, ortho, f.target, false); }
    },
  };
}
