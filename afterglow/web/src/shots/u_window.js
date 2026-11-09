// u_window — S39 窗 (S10-a, f5184–5255, 216.0 → 219.0 s). 85 mm.
//
// f5184 match cut from S38's cursor: the cursor's 24×64 px rectangle at R (x 722–746, y 508–572) is,
// one frame later, the glass of a lit window in a dark facade — same position, same size. It is the
// window of S04-e (l_carriers/sheet.js), drawn by the same function: every feature comes from timeline
// anchors.window, in metres around the lamp, with the carriers' noise texture:
//   · 3:8 tall narrow glass (0.9 × 2.4 m) — here the glass is exactly the cursor's rectangle;
//   · a fixed transom 1/3 of the glass height below the head (drawn at 1/32 of the glass height, so it
//     is ≥ 4 px at the end of the push: its true 3.75 cm would be 2 px);
//   · a linen curtain gathered to the left jamb, its inner edge S04-e's diagonal (600, 138) → (780, 942)
//     continued to the tie-back at 0.80 of the glass height;
//   · a milky round desk-lamp shade (Ø 200/720 of the glass width) on the window's vertical centre line,
//     0.42 of the glass height below the head — under the transom — 4000 K, uniform, the brightest thing.
//   Inside, barely: the desk edge, the lamp's stem, a cup, the corner of a bookshelf.
// The facade is the S04-f lattice (columns 3.0 m, floors 3.2 m, ours = cell (0, 0)) and the same
// neighbours: the red-linen curtain one floor down is on; the tungsten lamp to the left comes on at f5220
// (warming up), the cool LED ceiling up-right at f5244 (fading up) — the two windows that came on in
// S04-f, coming on again. A few other windows switch by hash; nothing flickers, nothing reads as a signal.
// f5184–5207 still; f5208–5255 a very slow push (easeInSine) about the window centre R: the glass grows
// 24×64 → 54×144 px (scale 1 → 2.25), reached exactly on f5255. The facade is a plane, so the push is an
// exact 2-D scale about R for it; the farther building scales less (parallax); the sky does not scale.
// The facade is only a silhouette (a little darker than the sky, no material); sodium street glow rises
// from the bottom of the frame. Every edge is box-filtered analytically over the pixel footprint.
import * as THREE from 'three';
import { bakeNoise } from './l_carriers/common.js';

const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => [srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255)];
const v3 = a => `vec3(${a.map(v => v.toFixed(4)).join(',')})`;
const f1 = x => { const t = String(+(+x).toPrecision(9)); return /[.e]/.test(t) ? t : t + '.0'; };
const SODIUM = hex(0xFFB45A), LED = hex(0xE8F0FF);
const easeInSine = u => 1 - Math.cos(u * Math.PI / 2);

export async function create(ctx) {
  const { W, H, kit, renderer, timeline } = ctx;
  const S = H / 1080;
  const shot = timeline.shots.find(s => s.module === 'u_window') || { frames: [5184, 5256], params: {} };
  const P = shot.params || {};
  const [F0, F1] = shot.frames;
  const PUSH = P.push || [5208, 5256];
  const s0 = (P.startPx || [24, 64])[0], s1 = (P.endPx || [54, 144])[0];
  const NB = P.neighbourOn || [5220, 5244];
  const R = timeline.anchors.R;                                   // (734, 540): window centre
  // ---- the shared window (anchors.window), in metres (same constants as l_carriers/sheet.js) ----
  const AW = timeline.anchors.window;
  const e = AW.S04e;
  const ppmE = e.pxPerM || 800;
  const gw = AW.sizeM[0], gh = AW.sizeM[1];
  const glassTop = (540 - e.top) / ppmE;                          // head of the glass above the lamp (m)
  const jamb = (e.frame[0][1] - e.frame[0][0]) / ppmE;
  const lampR = 0.5 * e.lampDiameter / ppmE;
  const edgeA = [(e.curtainEdge[0][0] - e.glass[0]) / (e.glass[1] - e.glass[0]), (e.curtainEdge[0][1] - e.top) / (e.bottom - e.top)];
  const edgeB = [(e.curtainEdge[1][0] - e.glass[0]) / (e.glass[1] - e.glass[0]), (e.curtainEdge[1][1] - e.top) / (e.bottom - e.top)];
  // S10-a scale at f5184: the glass is the cursor, 24 px wide
  const ppm = s0 / gw;                                            // 26.67 px/m
  const GH = gh * ppm;                                            // 64 px
  const G0 = [R[0] - s0 / 2, R[1] - GH / 2];                      // glass top-left (722, 508)
  const lampY = G0[1] + glassTop * ppm;                           // lamp centre y (534.9)
  // push: frame-exact scale about R, 1 → s1/s0 reached on the last frame of the push
  const scaleAt = fr => 1 + (s1 / s0 - 1) * easeInSine(Math.min(1, Math.max(0, (fr - PUSH[0]) / (PUSH[1] - 1 - PUSH[0]))));

  const noise = bakeNoise(kit, renderer);
  const U = {
    uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uFr: { value: 0 }, uScale: { value: 1 },
    uNoise: { value: noise },
  };
  const pass = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes; uniform float uS, uFr, uScale;
    uniform sampler2D uNoise;
    const vec3 SODIUM = ${v3(SODIUM)};
    const vec3 LEDC = ${v3(LED)};
    const vec2 RP = vec2(${f1(R[0])}, ${f1(R[1])});
    const float PPM = ${f1(ppm)};                    // facade px per metre (scale 1)
    const float LAMPY = ${f1(lampY)};
    const vec2 PITCH = vec2(${f1(3.0 * ppm)}, ${f1(3.2 * ppm)});   // the S04-f lattice: 3.0 m × 3.2 m
    // window (metres, origin = lamp centre, x right, y up) — identical to l_carriers/sheet.js
    const float GW = ${f1(gw)}, GH = ${f1(gh)};
    const float GTOP = ${f1(glassTop)};
    const float JAMB = ${f1(jamb)};
    const float LAMPV = ${f1(AW.lampFromTop)}, TRANSOM = ${f1(AW.transomFromTop)};
    const float LAMPR = ${f1(lampR)};
    const vec2 EDGEA = vec2(${f1(edgeA[0])}, ${f1(edgeA[1])});
    const vec2 EDGEB = vec2(${f1(edgeB[0])}, ${f1(edgeB[1])});
    const float TIEV = 0.80;
    const float NB1 = ${f1(NB[0])}, NB2 = ${f1(NB[1])};
    // S10-a is exposed for a night facade, ~1 stop over S04-e's interior: the room is lifted ×2, the
    // shade (already near the shoulder) ×1.3 so it stays a low-saturation 4000 K face
    const float ROOMEXP = 2.0, LAMPEXP = 1.3;
    float FW;                                              // pixel footprint in facade px
    float FP;                                              // pixel footprint in metres

    float ss(float a, float b, float x){ return smoothstep(a, b, x); }
    vec3 nz(vec2 uv){ return texture2D(uNoise, uv).rgb; }
    vec3 kmax(float T){ vec3 b = blackbody(T); return b / max(1e-3, max(b.r, max(b.g, b.b))); }
    float cov1(float a, float b, float x){ return clamp((min(x + 0.5 * FW, b) - max(x - 0.5 * FW, a)) / FW, 0.0, 1.0); }
    float covR(vec4 r, vec2 p){ return cov1(r.x, r.z, p.x) * cov1(r.y, r.w, p.y); }
    float mcov1(float a, float b, float x){ return clamp((min(x + 0.5 * FP, b) - max(x - 0.5 * FP, a)) / FP, 0.0, 1.0); }
    float mcovD(float d){ return clamp(0.5 - d / FP, 0.0, 1.0); }       // d < 0 inside
    float hsh(vec2 c, float s){ return hash13(vec3(c, s * 7.0 + 3.0)); }

    // the city sky (screen space, does not scale): blue-black above, sodium skyglow towards the horizon
    vec3 sky(vec2 q){
      vec3 top = vec3(0.0085, 0.0092, 0.0150), hor = vec3(0.052, 0.033, 0.019);
      vec3 c = mix(top, hor, smoothstep(60.0, 820.0, q.y));
      float cl = fbm(vec2(q.x / 560.0, q.y / 130.0) + vec2(3.0, 1.0), 4);
      c += vec3(0.010, 0.0068, 0.0042) * smoothstep(0.42, 0.8, cl) * smoothstep(60.0, 460.0, q.y);
      return c;
    }

    // ======================= OUR WINDOW — the function of l_carriers/sheet.js (S04-e) =======================
    float curtainEdge(float v){
      float k = (EDGEB.x - EDGEA.x) / (EDGEB.y - EDGEA.y);
      float e = EDGEA.x + k * (v - EDGEA.y);
      float tie = EDGEA.x + k * (TIEV - EDGEA.y);
      if (v > TIEV) e = tie - 0.55 * (v - TIEV);
      return e;
    }
    vec3 ourWindow(vec2 m, float lev, float lampLev){
      vec2 g = vec2((m.x + 0.5 * GW) / GW, (GTOP - m.y) / GH);
      vec3 K = kmax(4000.0);
      float aspect = GW / GH;
      float FU = FP / GW, FV = FP / GH;
      float rl = length(m);
      float soft = max(FP, 6.0 / 800.0);
      float shade = clamp((LAMPR - rl) / soft + 0.5, 0.0, 1.0);
      float deskV = LAMPV + 1.25 * (LAMPR / GW) / aspect * 0.5 + 0.05;
      float rw = length(vec2(g.x - 0.5, (g.y - LAMPV) * 1.2 / aspect));
      float wall = 0.035 + 0.40 / (1.0 + pow(rw / 0.30, 2.0));
      wall *= mix(1.0, 0.86, ss(0.2, 0.0, g.y));
      wall *= 0.92 + 0.10 * nz(m * 3.0).r;
      vec3 c = K * vec3(1.0, 0.96, 0.92) * wall;
      c *= 1.0 - 0.18 * exp(-pow((g.x - 0.5) / 0.03, 2.0)) * ss(LAMPV + 0.05, LAMPV + 0.2, g.y);
      float deskTop = clamp((g.y - deskV) / FV + 0.5, 0.0, 1.0);
      float under = ss(deskV, deskV + 0.12, g.y);
      c *= mix(1.0, 0.18 + 0.12 * (1.0 - under), deskTop);
      float edgeLit = mcov1(deskV * GH, deskV * GH + max(FP * 0.9, 0.010 * GH), g.y * GH);
      c += K * 0.20 * edgeLit * exp(-pow((g.x - 0.5) / 0.35, 2.0));
      float stem = mcov1((0.5 - 0.012) * GW, (0.5 + 0.012) * GW, g.x * GW) * mcov1((LAMPV + 0.02) * GH, deskV * GH, g.y * GH);
      c = mix(c, K * 0.04 + K * 0.10 * ss(0.5, 0.488, g.x), stem * 0.85);
      vec2 cupC = vec2(0.73, deskV - 0.022);
      float cup = mcov1((cupC.x - 0.045) * GW, (cupC.x + 0.045) * GW, g.x * GW) * mcov1((cupC.y - 0.022) * GH, deskV * GH, g.y * GH);
      float handle = mcovD(abs(length(vec2((g.x - cupC.x - 0.055) * GW, (g.y - cupC.y + 0.004) * GH)) - 0.022) - 0.005);
      cup = max(cup, handle * mcov1((cupC.x + 0.04) * GW, 1e3, g.x * GW));
      c = mix(c, K * 0.03, cup * 0.9);
      c += K * 0.12 * cup * mcov1((cupC.x - 0.045) * GW, (cupC.x - 0.045) * GW + max(FP, 0.004), g.x * GW);
      float shelfX = 0.86;
      float inShelf = mcov1(shelfX * GW, 2.0 * GW, g.x * GW) * mcov1(0.12 * GH, 0.95 * GH, g.y * GH);
      float rowF = g.y * 9.0, rows = fract(rowF);
      float board = ss(0.0, 0.10, rows) * ss(0.30, 0.14, rows);
      float spineId = floor(g.x * 55.0 + floor(rowF) * 3.1);
      float spine = 0.3 + 0.7 * ihash2(ivec2(int(spineId), int(rowF) + 7));
      float topH = 0.18 + 0.12 * ihash2(ivec2(int(spineId), 3));
      float book = ss(0.30 + topH * 0.3, 0.32 + topH * 0.3, rows) * (1.0 - board);
      vec3 spc = mix(vec3(0.55, 0.30, 0.22), vec3(0.30, 0.38, 0.46), ihash2(ivec2(int(spineId), 11)));
      vec3 shelf = K * (vec3(0.020) + spc * 0.07 * spine * book) * (0.5 + 0.5 * wall / 0.3) * (1.0 - 0.6 * ss(0.86, 1.0, g.x));
      c = mix(c, shelf, inShelf);
      float ce = curtainEdge(g.y);
      float inC = clamp((ce - g.x) / FU + 0.5, 0.0, 1.0) * ss(EDGEA.y - 0.05, EDGEA.y + 0.02, g.y + 0.03 * (1.0 - g.x));
      float relx = clamp(g.x / max(ce, 0.02), 0.0, 1.0);
      float fp = relx * 18.0 + g.y * 4.0 + 1.6 * ss(0.4, 0.8, g.y) * relx * 6.0;
      float folds = 0.62 + 0.38 * sin(fp) * (0.6 + 0.4 * sin(relx * 7.0 - 1.3));
      folds += 0.10 * (nz(vec2(relx * 3.0, g.y * 0.8)).g - 0.5);
      float lampSide = 0.55 + 0.45 * relx;
      vec3 linen = kmax(3300.0) * vec3(1.0, 0.93, 0.80) * 0.052 * folds * lampSide * (0.8 + 0.4 / (1.0 + pow(rw / 0.35, 2.0)));
      linen *= 0.92 + 0.16 * nz(m * vec2(40.0, 6.0)).b;
      float rim = exp(-pow((ce - g.x) * GW / max(FP * 0.6, 0.012 * GW), 2.0)) * step(g.x, ce + 0.01);
      linen += K * 0.035 * rim;
      c = mix(c, linen, inC);
      float tb = GH / 32.0;
      float ty = TRANSOM * GH;
      float tr = mcov1(ty - 0.5 * tb, ty + 0.5 * tb, g.y * GH);
      vec3 trc = K * 0.022 + vec3(0.002) + K * 0.06 * mcov1(ty + 0.5 * tb - max(0.25 * FP, 0.004), ty + 0.5 * tb, g.y * GH);   // (S04-e: max(FP, 4 mm); here sub-pixel so the bar keeps ≥ 4 px)
      c = mix(c, trc, tr);
      vec3 lamp = K * 1.32 * (1.0 + 0.06 * (1.0 - ss(0.0, LAMPR, length(m))));
      c *= lev;
      c = mix(c, lamp * lampLev, shade);
      vec3 refl = vec3(0.0055, 0.0068, 0.0098) * (0.7 + 0.6 * (1.0 - g.y));
      c += refl * ss(0.0, 0.6, lev);
      return c;
    }

    // ======================= NEIGHBOURS (the S04-f room presets, hashed per lattice cell) =======================
    vec3 room(vec2 g, float type, float h1, float h2, float lev, vec3 K){
      vec3 c;
      if (type < 1.0) {                                    // a lamp low in a corner
        vec2 lp = vec2(h1 < 0.5 ? 0.18 : 0.82, 0.78);
        float gg = exp(-dot((g - lp) * vec2(1.0, 0.45), (g - lp) * vec2(1.0, 0.45)) / 0.07);
        c = K * (0.10 + 1.0 * gg) * (0.8 + 0.2 * g.y);
      } else if (type < 2.0) {                             // ceiling light
        c = K * (0.55 + 0.45 * ss(0.9, 0.0, g.y));
      } else if (type < 3.0) {                             // drawn curtain: light through fabric
        float folds = 0.78 + 0.22 * sin(g.x * 6.2831 * (2.0 + h1 * 2.0) + h2 * 6.0);
        c = K * vec3(1.0, 0.82, 0.62) * folds * (0.55 + 0.25 * ss(1.0, 0.2, g.y));
      } else if (type < 4.0) {                             // half-drawn curtain
        float e = 0.35 + 0.35 * h1;
        float side = h2 < 0.5 ? g.x : 1.0 - g.x;
        float sh = ss(e - 0.12, e + 0.12, side);
        vec2 lp = vec2(h2 < 0.5 ? 0.8 : 0.2, 0.7);
        float gg = exp(-dot(g - lp, g - lp) / 0.18);
        c = K * mix(vec3(0.42, 0.30, 0.20), vec3(1.0), sh) * (0.35 + 0.7 * gg);
      } else {                                             // blinds
        float y = g.y * 40.0;
        float sl = 0.5 + 0.5 * ss(0.25, 0.55, abs(fract(y) - 0.5) * 2.0);
        c = K * (0.45 + 0.55 * sl) * (0.6 + 0.4 * ss(1.0, 0.3, g.y));
      }
      float rev = (0.72 + 0.28 * ss(0.0, 0.22, min(g.x, 1.0 - g.x))) * (0.8 + 0.2 * ss(0.0, 0.15, g.y));
      return c * lev * rev;
    }
    // a lattice window of building 0 (cell = column, floor-up) — the S04-f hash, so the windows lit
    // tonight are a subset of those lit in S04-f; plus a few hashed switchings and the scripted three
    vec3 neighbour(vec2 p, vec2 cell, out float cov, out float lit, out vec3 litK){
      vec2 gc = vec2(RP.x + cell.x * PITCH.x, RP.y - cell.y * PITCH.y);       // glass centre (px)
      vec2 hs = 0.5 * vec2(GW, GH) * PPM;
      float jb = JAMB * PPM;
      vec4 gr = vec4(gc - hs, gc + hs);
      cov = covR(vec4(gr.xy - jb, gr.zw + jb), p);
      float glass = covR(gr, p);
      vec2 g = (p - gr.xy) / (gr.zw - gr.xy);
      float h0 = ihash2(ivec2(cell) + ivec2(0, 5)), h1 = ihash2(ivec2(cell) + ivec2(13, 2));
      float h2 = ihash2(ivec2(cell) + ivec2(7, 29)), h3 = ihash2(ivec2(cell) + ivec2(41, 3));
      float on = step(h0, 0.20);                           // late at night: fewer than in S04-f (0.30)
      float type = floor(h1 * 5.0);
      float lev = (0.22 + 0.45 * h2 * h2 + 0.15 * h3) * 0.24;
      vec3 K = kmax(mix(2300.0, 3400.0, h3 * h3));
      if (h1 > 0.9) K = vec3(0.86, 0.91, 1.0);
      // a few windows change state at a hashed moment (~5 %), never next to ours
      float h4 = hsh(cell, 4.0);
      if (h4 < 0.05 && length(cell) > 2.2) {
        float sw = step(mix(${f1(F0)}, ${f1(F1)}, hsh(cell, 5.0)), uFr);
        on = h0 < 0.20 ? 1.0 - sw : sw;
      }
      if (cell == vec2(0.0, -1.0)) { on = 1.0; type = 2.0; lev = 0.20; K = kmax(3000.0) * vec3(1.0, 0.92, 0.80); }   // red-linen curtain, on
      else if (cell == vec2(-1.0, 0.0)) {                  // f5220: tungsten lamp warming up (2600 K)
        float a = clamp((uFr - NB1 + 1.0) / 6.0, 0.0, 1.0);
        on = a * a * (3.0 - 2.0 * a); type = 0.0; lev = 0.30; K = kmax(mix(1700.0, 2600.0, a));
      } else if (cell == vec2(1.0, 1.0)) {                 // f5244: cool LED ceiling fading up
        float a = clamp((uFr - NB2 + 1.0) / 8.0, 0.0, 1.0);
        on = a * a; type = 1.0; lev = 0.20; K = vec3(0.84, 0.91, 1.0);
      } else if (cell == vec2(2.0, 0.0) || cell == vec2(1.0, 0.0) || cell == vec2(0.0, 1.0) || cell == vec2(-1.0, 1.0)) on = 0.0;
      lit = on * lev; litK = K;
      vec3 col = vec3(0.0);
      if (on > 0.0) {
        vec3 rc = room(clamp(g, 0.0, 1.0), type, h1, h2, lev, K) * on;
        float tb = 1.0 / 32.0;                             // the same window type: transom 1/3 down
        float tr = clamp((min(g.y + 0.5 * FW / (2.0 * hs.y), TRANSOM + 0.5 * tb) - max(g.y - 0.5 * FW / (2.0 * hs.y), TRANSOM - 0.5 * tb)) / (FW / (2.0 * hs.y)), 0.0, 1.0);
        rc = mix(rc, K * 0.02 * lit + vec3(0.002), tr);
        float rev = ss(0.0, 0.06, min(min(g.x, 1.0 - g.x) * GW / GH * 2.0, min(g.y, 1.0 - g.y)));
        rc *= 0.55 + 0.45 * rev;
        col = rc * glass;
      }
      float jam = cov - glass;
      col += K * 0.02 * lit * jam;
      if (on <= 0.0) cov = 0.0;                            // unlit: nothing — the facade stays a silhouette
      return col;
    }
    // building 2 (farther, right): an older block, smaller windows on its own grid, hashed presets
    vec4 farWindow(vec2 p, vec4 r, vec2 id, out float lit){
      vec2 sz = r.zw - r.xy, uv = (p - r.xy) / sz;
      float h0 = hsh(id, 1.0), h1 = hsh(id, 2.0), h2 = hsh(id, 3.0), h3 = hsh(id, 4.0);
      float on = step(h0, 0.15);
      float type = floor(h1 * 5.0);
      float lev = (0.06 + 0.24 * h2 * h2 + 0.10 * h3) * 0.8;
      vec3 K = h3 < 0.18 ? LEDC : kmax(mix(2100.0, 3100.0, h3 * h3));
      float c = covR(r, p);
      lit = on * lev;
      if (c <= 0.0 || on <= 0.0) return vec4(0.0);
      return vec4(room(uv, type, h1, h2, lev, K) * c, c);
    }

    void main(){
      vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;   // screen, 1080p px, top-left origin
      float s1 = uScale, s2 = 1.0 + (uScale - 1.0) * 0.55;            // facade / the farther building
      vec2 p = RP + (q - RP) / s1;                                     // facade px (scale 1 = f5184)
      vec2 p2 = RP + (q - RP) / s2;
      vec3 col = sky(q);
      // street glow: part on the facade (moves with it), part sodium air between us and it (screen)
      float streetF = exp(-(940.0 - p.y) / 210.0);
      float streetQ = exp(-(942.0 - q.y) / 150.0);

      // ---- building 2 (farther, right): roof at 372 ----
      FW = 1.0 / (uS * s2);
      float b2 = cov1(1262.0, 99999.0, p2.x) * cov1(372.0, 99999.0, p2.y);
      vec3 skyR2 = sky(vec2(q.x, RP.y + (342.0 - RP.y) * s2));
      vec3 wall2 = min(skyR2 * 0.52 + SODIUM * 0.003 * exp(-(940.0 - p2.y) / 210.0), skyR2 * 0.74);
      col = mix(col, wall2, b2);
      if (b2 > 0.0 && p2.x >= 1262.0 && p2.y > 386.0) {
        float i = floor((p2.x - 1286.0 + 15.0) / 46.0);
        float j = floor((p2.y - 398.0 + 7.0) / 52.0);
        vec4 r = vec4(1286.0 + 46.0 * i, 398.0 + 52.0 * j, 1301.0 + 46.0 * i, 436.0 + 52.0 * j);
        if (r.x > 1268.0) {
          float lit;
          vec4 w = farWindow(p2, r, vec2(i, j), lit);
          col = col * (1.0 - w.a) + w.rgb;
          vec2 dq = max(abs(p2 - 0.5 * (r.xy + r.zw)) - 0.5 * (r.zw - r.xy), 0.0);
          col += kmax(2600.0) * lit * 0.012 * exp(-length(dq) / 6.0) * step(0.01, length(dq));
        }
      }

      // ---- building 1 (ours): x < 1262, roof at 222 with a water tank and a lift housing ----
      FW = 1.0 / (uS * s1);
      FP = FW / PPM;
      float roof = 222.0;
      float b1 = (1.0 - cov1(1262.0, 99999.0, p.x)) * cov1(roof, 99999.0, p.y);
      b1 = max(b1, covR(vec4(392.0, 160.0, 448.0, 207.0), p));                       // tank body
      float capW = mix(0.0, 28.0, clamp((p.y - 144.0) / 16.0, 0.0, 1.0));
      b1 = max(b1, cov1(420.0 - capW, 420.0 + capW, p.x) * cov1(144.0, 160.0, p.y)); // conical cap
      for (int k = 0; k < 3; k++) b1 = max(b1, covR(vec4(395.0 + 23.0 * float(k), 206.0, 398.0 + 23.0 * float(k), 223.0), p));
      b1 = max(b1, covR(vec4(904.0, 186.0, 1012.0, 223.0), p));                      // lift housing
      b1 = max(b1, covR(vec4(958.5, 112.0, 960.5, 187.0), p));                        // mast
      b1 = max(b1, covR(vec4(1110.0, 208.0, 1160.0, 223.0), p));                      // a/c units
      // the wall: referenced to the sky ABOVE the roofline (not the brighter horizon behind it), a trace
      // of street glow at the bottom, always a few code values under that sky (silhouette, no material)
      vec3 skyR1 = sky(vec2(q.x, RP.y + (roof - 30.0 - RP.y) * s1));
      vec3 wall1 = min(skyR1 * 0.50 + SODIUM * 0.0050 * streetF, skyR1 * 0.70 + SODIUM * 0.0020 * streetF);
      col = mix(col, wall1, b1);

      if (b1 > 0.0 && p.x < 1250.0 && p.y > roof + 26.0) {
        vec2 cell = vec2(floor((p.x - RP.x) / PITCH.x + 0.5), floor((RP.y - p.y) / PITCH.y + 0.5));
        vec2 gc = vec2(RP.x + cell.x * PITCH.x, RP.y - cell.y * PITCH.y);
        vec2 hs = 0.5 * vec2(GW, GH) * PPM;
        if (gc.x + hs.x < 1250.0 && gc.y - hs.y > roof + 26.0) {
          vec2 dq = max(abs(p - gc) - hs, 0.0);
          float dd = length(dq);
          if (cell == vec2(0.0)) {
            vec4 gr = vec4(gc - hs, gc + hs);
            float c = covR(gr, p);
            float jb = JAMB * PPM;
            float fr = covR(vec4(gr.xy - jb, gr.zw + jb), p) - c;          // aluminium jamb
            vec3 K = kmax(4000.0);
            col = mix(col, K * 0.012 + vec3(0.002), max(fr, 0.0));
            if (c > 0.0) {
              vec2 m = vec2(p.x - RP.x, LAMPY - p.y) / PPM;                // metres from the lamp
              col = col * (1.0 - c) + ourWindow(m, ROOMEXP, LAMPEXP) * c;
            }
            // light spilling onto the sill and into the air just around the glass
            float sill = covR(vec4(gr.x - jb - 1.0, gr.w + jb, gr.z + jb + 1.0, gr.w + jb + 1.6), p);
            col += K * 0.05 * sill;
            col += K * 0.030 * exp(-dd / 6.0) * step(0.01, dd) * (1.0 - max(fr, 0.0));
          } else {
            float cv, lit; vec3 lk;
            vec3 w = neighbour(p, cell, cv, lit, lk);
            col = col * (1.0 - cv) + w;
            col += lk * lit * 0.018 * exp(-dd / 6.0) * step(0.01, dd);
            float sill = covR(vec4(gc.x - hs.x - 1.0, gc.y + hs.y + 1.0, gc.x + hs.x + 1.0, gc.y + hs.y + 2.4), p);
            col += lk * 0.03 * lit * sill;
          }
        }
      }
      // the night air in front of everything: sodium haze rising from the street below the frame
      col += SODIUM * (0.022 * streetQ * streetQ + 0.006 * streetQ + 0.004 * streetF);
      gl_FragColor = vec4(col, 1.0);
    }`, U);

  return {
    render(shot, f) {
      const fr = Math.round(f.t * 24 * 1000) / 1000;
      U.uFr.value = fr;
      U.uScale.value = scaleAt(fr);
      pass.render(renderer, f.target);
    },
    post(shot, f) {
      // the modern lamp / window optics (visual-changes §1.3): wide, faint bloom, no anamorphic streak
      return { bloom: 0.3, bloomRadius: 1.2, streak: 0.0, bloomThreshold: 1.0 };
    },
    _debug: { scaleAt },
  };
}
