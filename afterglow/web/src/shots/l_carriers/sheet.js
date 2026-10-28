// l_carriers/sheet.js — S04-e 现代窗灯 [2568, 2664) and S04-f 尺度形变 [2664, 2784).
//
// ONE ray-cast surface carries everything from the lamp to the planet: a "light sheet" tangent at the
// lamp's light centre O, which always projects to C. It is described by three numbers per frame —
//   σ  metres per pixel at C (the scale), φ  tilt of the sheet away from the lens, u = D / R_s  its
//   curvature relative to the camera distance D (R_s = radius of the sphere the sheet is bent onto).
// A point on the sheet is addressed by its arc length s and azimuth from O (azimuthal-equidistant), and
// arc length maps 1:1 onto real ground distance from R_geo. So at u = 0, φ = 0 the sheet is the flat
// facade of S04-e (x right = east, y up = north, metres); at the end (σ = 8.53 km/px, φ = 24°, u = 3.57,
// R_s = R⊕) it IS the Earth, seen from 4.5 R⊕ over a point 19° south of R_geo, north up, R_geo on C.
// In between nothing jumps: the window shrinks about the lamp (−5 %/frame), the facade's windows and the
// street lamps below become points of light, the street grid spreads (sodium; LED-white downtown), the
// sheet curls (u ↑: the lamp field wraps over a horizon that bends down at both ends) and the curl opens
// out into the real globe (R_s → R⊕, φ → 24°). Point lights keep one PSF throughout (σ_psf ≈ 0.85 px);
// when their spacing drops under ~3 px they hand their flux to a line, then to an area average
// (flux-conserving LOD), and the area field hands over to earth.js's night-lights map.
// Window geometry: timeline anchors.window (shared with S10-a / u_window): 3:8 glass 0.9 × 2.4 m, 30 px
// aluminium jambs, transom 1/3 below the head, linen curtain gathered left (edge (600,138)→(780,942),
// tie-back at 0.80 of the glass height), milky round shade (Ø 200 px) 0.42 below the head on the
// window's vertical centre line, 4000 K low saturation.
import * as THREE from 'three';
import { PRELUDE, pass, baseUniforms, hex, v3, f1 } from './common.js';
import { createEarth } from '../../lib/earth.js';

const D2R = Math.PI / 180;
const FPX = 960 * 50 / 18;                     // 50 mm on the 36 mm gauge: focal length in 1080p px
const RE = 6371e3;
const SOD = hex(0xFFB45A), LED = hex(0xE8F0FF);
const R_GEO = [36.8, -1.3];

// cubic Hermite through knots [f, value, slope]
function hermite(K, x) {
  if (x <= K[0][0]) return K[0][1] + (x - K[0][0]) * 0;            // held before the first knot
  for (let i = 0; i < K.length - 1; i++) {
    const [x0, y0, m0] = K[i], [x1, y1, m1] = K[i + 1];
    if (x <= x1) {
      const h = x1 - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1;
    }
  }
  return K[K.length - 1][1];
}
// scale schedule: ln(σ) (σ = metres per px at C). Knots are the screenplay's: 720 px window on f2664,
// 120 × 320 on f2699, 12 × 32 on f2723; the globe at rest on f2783.
const SIG_F = 3.57 * RE / FPX;
const LSIG = [[2664, Math.log(0.9 / 720), 0.0512], [2699, Math.log(0.9 / 120), 0.075], [2723, Math.log(0.9 / 12), 0.16],
  [2752, Math.log(60), 0.30], [2783, Math.log(SIG_F), 0]];
const UK = [[2726, 0, 0], [2752, 2.6, 0.16], [2783, 3.57, 0]];
export function sheetState(fr) {
  const lsig = fr < 2664 ? LSIG[0][1] : hermite(LSIG, fr);
  const u = fr < 2726 ? 0 : hermite(UK, fr);
  const k = Math.min(1, Math.max(0, (fr - 2736) / (2783 - 2736)));
  const phi = 24 * D2R * k * k * (3 - 2 * k);
  return { sig: Math.exp(lsig), u, phi };
}

export async function createSheet(ctx, noiseTex, T, shot) {
  const { kit, renderer, W, H } = ctx;
  const AW = ctx.timeline.anchors.window;
  const e = AW.S04e;
  const ppm = e.pxPerM || 800;
  const gw = AW.sizeM[0], gh = AW.sizeM[1];
  const glassTop = (540 - e.top) / ppm;                       // head of the glass above the lamp (m)
  const lampFromTop = AW.lampFromTop, transom = AW.transomFromTop;
  const jamb = (e.frame[0][1] - e.frame[0][0]) / ppm;         // aluminium jamb width (m)
  const lampR = 0.5 * e.lampDiameter / ppm;
  const edgeA = [(e.curtainEdge[0][0] - e.glass[0]) / (e.glass[1] - e.glass[0]), (e.curtainEdge[0][1] - e.top) / (e.bottom - e.top)];
  const edgeB = [(e.curtainEdge[1][0] - e.glass[0]) / (e.glass[1] - e.glass[0]), (e.curtainEdge[1][1] - e.top) / (e.bottom - e.top)];

  // the globe only when the range reaches the last second of S04-f
  const needEarth = !ctx.inRange || ctx.inRange(2738 / 24, 2784 / 24, 0.5);
  let earth = null;
  if (needEarth) earth = await createEarth(ctx, { radius: 1 });
  const blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blackTex.needsUpdate = true;

  // R_geo frame (earth.js convention: lon 0 on +Z, 90°E on +X, north +Y)
  const lo = R_GEO[0] * D2R, la = R_GEO[1] * D2R;
  const gUp = new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
  const gE = new THREE.Vector3(0, 1, 0).cross(gUp).normalize();
  const gN = gUp.clone().cross(gE).normalize();
  // sun: sub-solar point on the equator so that the terminator runs just inside the globe's right limb
  const sl = -150 * D2R;
  const sun = new THREE.Vector3(Math.sin(sl), 0.08, Math.cos(sl)).normalize();

  const U = {
    ...baseUniforms(W, H), uNoise: { value: noiseTex },
    uSig: { value: 1 / 800 }, uD: { value: 3.3 }, uPhi: { value: 0 }, uK: { value: 0 }, uU: { value: 0 },
    uLamp: { value: 0 }, uOn: { value: T.on },
    uLights: { value: earth ? earth.textures.lightsTex : blackTex }, uLand: { value: earth ? earth.textures.landTex : blackTex },
    uEarthOn: { value: earth ? 1 : 0 },
    uGE: { value: gE }, uGN: { value: gN }, uGU: { value: gUp }, uSun: { value: sun },
  };
  const p = pass(kit, PRELUDE + /* glsl */ `
    uniform sampler2D uNoise, uLights, uLand;
    uniform float uSig, uD, uPhi, uK, uU, uLamp, uOn, uEarthOn;
    uniform vec3 uGE, uGN, uGU, uSun;
    const float FPX = ${f1(FPX)};
    const float RE = ${f1(RE)};
    const vec3 SOD = ${v3(SOD)};
    const vec3 LEDC = ${v3(LED)};
    // window (metres, origin = lamp centre, x east/right, y north/up)
    const float GW = ${f1(gw)}, GH = ${f1(gh)};
    const float GTOP = ${f1(glassTop)};
    const float JAMB = ${f1(jamb)};
    const float LAMPV = ${f1(lampFromTop)}, TRANSOM = ${f1(transom)};
    const float LAMPR = ${f1(lampR)};
    const vec2 EDGEA = vec2(${f1(edgeA[0])}, ${f1(edgeA[1])});
    const vec2 EDGEB = vec2(${f1(edgeB[0])}, ${f1(edgeB[1])});
    const float TIEV = 0.80;
    float TT, FP;                  // seconds; footprint (m per px)
    mat2 JI;                       // surface metres → screen px (inverse Jacobian)
    vec3 nz(vec2 uv){ return texture2D(uNoise, uv).rgb; }
    vec3 kmax(float T){ vec3 b = blackbody(T); return b / max(1e-3, max(b.r, max(b.g, b.b))); }
    // metre-space coverage helpers (box filter over the pixel footprint)
    float mcov1(float a, float b, float x){ return clamp((min(x + 0.5 * FP, b) - max(x - 0.5 * FP, a)) / FP, 0.0, 1.0); }
    float mcovR(vec4 r, vec2 p){ return mcov1(r.x, r.z, p.x) * mcov1(r.y, r.w, p.y); }
    float mcovD(float d){ return clamp(0.5 - d / FP, 0.0, 1.0); }       // d < 0 inside
    float mline(float d, float wpx){ return clamp(0.5 * wpx + 0.5 - abs(d) / FP, 0.0, 1.0); }   // line of wpx px
    // a point light at surface offset dm (metres): screen-space PSF, σ = 0.85 px
    float psf(vec2 dm){ vec2 q = JI * dm; return exp(-dot(q, q) / 1.45); }

    // ======================= OUR WINDOW (glass coords gu → right, gv ↓ from the head) =======================
    float curtainEdge(float v){
      float k = (EDGEB.x - EDGEA.x) / (EDGEB.y - EDGEA.y);
      float e = EDGEA.x + k * (v - EDGEA.y);
      float tie = EDGEA.x + k * (TIEV - EDGEA.y);
      if (v > TIEV) e = tie - 0.55 * (v - TIEV);
      return e;
    }
    vec3 ourWindow(vec2 m, float lev, out float lampMask, out float outl){
      // m: metres from the lamp. glass coords:
      vec2 g = vec2((m.x + 0.5 * GW) / GW, (GTOP - m.y) / GH);
      vec3 K = kmax(4000.0);
      float aspect = GW / GH;
      float FU = FP / GW, FV = FP / GH;
      // lamp shade: milky round disc, uniform face, 6 px soft edge at the S04-e scale
      float rl = length(m);
      float soft = max(FP, 6.0 / 800.0);
      float shade = clamp((LAMPR - rl) / soft + 0.5, 0.0, 1.0);
      lampMask = shade;
      // the room behind: back wall lit by the lamp, ceiling falling off, the desk below the shade
      float deskV = LAMPV + 1.25 * (LAMPR / GW) / aspect * 0.5 + 0.05;
      float rw = length(vec2(g.x - 0.5, (g.y - LAMPV) * 1.2 / aspect));
      float wall = 0.035 + 0.40 / (1.0 + pow(rw / 0.30, 2.0));
      wall *= mix(1.0, 0.86, ss(0.2, 0.0, g.y));
      wall *= 0.92 + 0.10 * nz(m * 3.0).r;                       // plaster
      vec3 c = K * vec3(1.0, 0.96, 0.92) * wall;
      // soft shadow of the shade's stem/base on the wall, light cone below the shade
      c *= 1.0 - 0.18 * exp(-pow((g.x - 0.5) / 0.03, 2.0)) * ss(LAMPV + 0.05, LAMPV + 0.2, g.y);
      float deskTop = clamp((g.y - deskV) / FV + 0.5, 0.0, 1.0);
      float under = ss(deskV, deskV + 0.12, g.y);
      c *= mix(1.0, 0.18 + 0.12 * (1.0 - under), deskTop);
      float edgeLit = mcov1(deskV * GH, deskV * GH + max(FP * 0.9, 0.010 * GH), g.y * GH);
      c += K * 0.20 * edgeLit * exp(-pow((g.x - 0.5) / 0.35, 2.0));
      // the stem: a slim dark rod with a lit flank
      float stem = mcov1((0.5 - 0.012) * GW, (0.5 + 0.012) * GW, g.x * GW) * mcov1((LAMPV + 0.02) * GH, deskV * GH, g.y * GH);
      c = mix(c, K * 0.04 + K * 0.10 * ss(0.5, 0.488, g.x), stem * 0.85);
      // cup on the desk (right of the lamp): a silhouette with a lit rim toward the lamp
      vec2 cupC = vec2(0.73, deskV - 0.022);
      float cup = mcov1((cupC.x - 0.045) * GW, (cupC.x + 0.045) * GW, g.x * GW) * mcov1((cupC.y - 0.022) * GH, deskV * GH, g.y * GH);
      float handle = mcovD(abs(length(vec2((g.x - cupC.x - 0.055) * GW, (g.y - cupC.y + 0.004) * GH)) - 0.022) - 0.005);
      cup = max(cup, handle * mcov1((cupC.x + 0.04) * GW, 1e3, g.x * GW));
      c = mix(c, K * 0.03, cup * 0.9);
      c += K * 0.12 * cup * mcov1((cupC.x - 0.045) * GW, (cupC.x - 0.045) * GW + max(FP, 0.004), g.x * GW);
      // bookshelf corner (right): dark uprights, spines lit faintly from the left
      float shelfX = 0.86;
      float inShelf = mcov1(shelfX * GW, 2.0 * GW, g.x * GW) * mcov1(0.12 * GH, 0.95 * GH, g.y * GH);
      float rowF = g.y * 9.0, rows = fract(rowF);
      float board = ss(0.0, 0.10, rows) * ss(0.30, 0.14, rows);
      float bw = 0.018 + 0.02 * ihash2(ivec2(floor(g.x * 60.0), floor(rowF)));
      float spineId = floor(g.x * 55.0 + floor(rowF) * 3.1);
      float spine = 0.3 + 0.7 * ihash2(ivec2(int(spineId), int(rowF) + 7));
      float topH = 0.18 + 0.12 * ihash2(ivec2(int(spineId), 3));
      float book = ss(0.30 + topH * 0.3, 0.32 + topH * 0.3, rows) * (1.0 - board);
      vec3 spc = mix(vec3(0.55, 0.30, 0.22), vec3(0.30, 0.38, 0.46), ihash2(ivec2(int(spineId), 11)));
      vec3 shelf = K * (vec3(0.020) + spc * 0.07 * spine * book) * (0.5 + 0.5 * wall / 0.3) * (1.0 - 0.6 * ss(0.86, 1.0, g.x));
      c = mix(c, shelf, inShelf);
      // curtain: translucent linen, lamp light through it and on its folds; inner edge rim
      float ce = curtainEdge(g.y);
      float inC = clamp((ce - g.x) / FU + 0.5, 0.0, 1.0) * ss(EDGEA.y - 0.05, EDGEA.y + 0.02, g.y + 0.03 * (1.0 - g.x));
      float relx = clamp(g.x / max(ce, 0.02), 0.0, 1.0);
      // folds converge toward the tie-back: the fold phase follows the gathered geometry
      float fp = relx * 18.0 + g.y * 4.0 + 1.6 * ss(0.4, 0.8, g.y) * relx * 6.0;
      float folds = 0.62 + 0.38 * sin(fp) * (0.6 + 0.4 * sin(relx * 7.0 - 1.3));
      folds += 0.10 * (nz(vec2(relx * 3.0, g.y * 0.8)).g - 0.5);
      float lampSide = 0.55 + 0.45 * relx;
      vec3 linen = kmax(3300.0) * vec3(1.0, 0.93, 0.80) * 0.052 * folds * lampSide * (0.8 + 0.4 / (1.0 + pow(rw / 0.35, 2.0)));
      linen *= 0.92 + 0.16 * nz(m * vec2(40.0, 6.0)).b;               // weave
      float rim = exp(-pow((ce - g.x) * GW / max(FP * 0.6, 0.012 * GW), 2.0)) * step(g.x, ce + 0.01);
      linen += K * 0.035 * rim;
      c = mix(c, linen, inC);
      // transom (aluminium): 1/32 of the glass height, as in S10
      float tb = GH / 32.0;
      float ty = TRANSOM * GH;
      float tr = mcov1(ty - 0.5 * tb, ty + 0.5 * tb, g.y * GH);
      vec3 trc = K * 0.022 + vec3(0.002) + K * 0.06 * mcov1(ty + 0.5 * tb - max(FP, 0.004), ty + 0.5 * tb, g.y * GH);  // lower edge catches the lamp
      c = mix(c, trc, tr);
      // the lamp over everything behind it
      vec3 lamp = K * 1.32 * (1.0 + 0.06 * (1.0 - ss(0.0, LAMPR, length(m - vec2(0.0, 0.25 * LAMPR)))));
      c *= lev;
      c = mix(c, lamp * lev, shade);
      // glass: a faint cool reflection of the city sky (≈ 4 %), stronger toward the head; a few dust motes
      vec3 refl = vec3(0.0055, 0.0068, 0.0098) * (0.7 + 0.6 * (1.0 - g.y));
      vec2 dq = m * 70.0; vec2 di = floor(dq);
      float dust = step(0.985, ihash2(ivec2(di) + ivec2(91, 3))) * exp(-dot(fract(dq) - 0.5, fract(dq) - 0.5) * 60.0);
      refl += K * dust * 0.05 * exp(-length(m) / 0.5) * step(FP, 0.004);
      c += refl * ss(0.0, 0.6, lev);
      // dark-phase outline: transom, shade circle, curtain edge
      outl = mline(rl - LAMPR, 2.5);
      outl = max(outl, mline(g.y * GH - ty + 0.5 * tb, 2.5));
      outl = max(outl, mline((ce - g.x) * GW, 2.5) * ss(EDGEA.y, EDGEA.y + 0.03, g.y));
      return c;
    }

    // ======================= FACADE (our building and its neighbours) =======================
    // windows on a lattice: columns every 3.0 m (ours = column 0), floors every 3.2 m (ours = floor 0)
    // returns colour; cov = coverage of window openings (glass + jambs)
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
    // window of a facade lattice cell (i = column, j = floor) of building b
    vec3 facadeWindow(vec2 m, vec2 cell, vec2 origin, vec2 pitch, float bld, float lampLev, out float cov, out float lit){
      vec2 gsz = vec2(GW, GH);
      vec2 g0 = origin + cell * pitch + vec2(-0.5 * GW, GTOP - GH);  // bottom-left of the glass
      vec2 g = vec2((m.x - g0.x) / GW, 1.0 - (m.y - g0.y) / GH);
      vec4 R = vec4(g0.x - JAMB, g0.y - JAMB, g0.x + GW + JAMB, g0.y + GH + JAMB);
      cov = mcovR(R, m);
      float glass = mcovR(vec4(g0, g0 + gsz), m);
      float h0 = ihash2(ivec2(cell) + ivec2(int(bld * 37.0), 5)), h1 = ihash2(ivec2(cell) + ivec2(13, int(bld * 11.0) + 2));
      float h2 = ihash2(ivec2(cell) + ivec2(7, 29)), h3 = ihash2(ivec2(cell) + ivec2(41, 3));
      float on = step(h0, 0.30);
      float type = floor(h1 * 5.0);
      float lev = 0.22 + 0.45 * h2 * h2 + 0.15 * h3;
      vec3 K = kmax(mix(2300.0, 3400.0, h3 * h3));
      if (h1 > 0.9) K = vec3(0.86, 0.91, 1.0);
      // the windows that come on during the pull-back (screenplay S04-f: 2–4, other curtains, other light)
      if (bld < 0.5) {
        if (cell == vec2(-1.0, 0.0)) { on = ss(2680.0, 2683.0, uFr); type = 0.0; lev = 0.62; K = kmax(2600.0); }                          // tungsten, lamp in a corner
        else if (cell == vec2(1.0, 1.0)) { on = ss(2688.0, 2689.0, uFr); type = 1.0; lev = 0.48; K = vec3(0.84, 0.91, 1.0); }            // cool LED ceiling
        else if (cell == vec2(0.0, -1.0)) { on = ss(2694.0, 2696.0, uFr); type = 2.0; lev = 0.55; K = kmax(3000.0) * vec3(1.0, 0.92, 0.80); }  // drawn red-linen curtain
        else if (cell == vec2(2.0, 0.0) || cell == vec2(1.0, 0.0) || cell == vec2(0.0, 1.0) || cell == vec2(-1.0, 1.0)) on = 0.0;          // a little dark round ours
      }
      lit = on * lev;
      vec3 col = vec3(0.004, 0.0042, 0.005) * glass;               // unlit glass: the faintest sky reflection
      if (on > 0.0) col = mix(col, room(clamp(g, 0.0, 1.0), type, h1, h2, lev, K) * on, glass);
      // jamb: dark aluminium, faint lamp catch on the inner edge
      float jam = cov - glass;
      col += vec3(0.003) * jam + K * 0.02 * lit * jam;
      return col;
    }
    // the facade wall: dark concrete, panel joints, a few spandrel ledges
    vec3 wallAt(vec2 m){
      float jx = mline(fract(m.x / 3.0 + 0.5) * 3.0 - 1.5, 1.2) * 0.4;
      float jy = mline(fract((m.y + 1.6) / 3.2) * 3.2 - 1.6, 1.2) * 0.4;
      float t = 0.8 + 0.4 * nz(m * 0.8).r;
      return vec3(0.0042, 0.0040, 0.0038) * t * (1.0 + jx + jy) * 0.9;
    }

    // ======================= CITY (metres around the lamp; north up) =======================
    // street grid: streets every 96 m (x) / 84 m (y), ours runs along y = −20 (south of our building)
    const vec2 PITCH = vec2(96.0, 84.0);
    const vec2 SOFF = vec2(48.0, -20.0);
    float cityDensity(vec2 m){ float r = length(m - vec2(900.0, 1600.0)); return exp(-r / 5200.0) * 0.85 + 0.15 * exp(-length(m) / 9000.0); }
    float ledness(vec2 m){ return ss(2200.0, 900.0, length(m - vec2(1500.0, 2300.0))); }
    // one row of lamps along a street (axis 0: along x at y = y0; axis 1: along y at x = x0)
    vec3 lampRows(vec2 m, vec2 cellLo, float dens){
      vec3 c = vec3(0.0);
      // nearest horizontal and vertical street centre lines
      vec2 rel = m - SOFF;
      vec2 k = floor(rel / PITCH + 0.5);
      vec2 cl = SOFF + k * PITCH;                         // nearest street centre (x of a N–S street, y of an E–W street)
      float arterialX = step(0.5, mod(k.x, 5.0) < 0.5 ? 1.0 : 0.0), arterialY = mod(k.y, 4.0) < 0.5 ? 1.0 : 0.0;
      float led = ledness(m);
      vec3 colr = mix(SOD, LEDC, step(0.5, led * ihash2(ivec2(k) + ivec2(3, 3)) + led * 0.4));
      float B = 2.4 * (0.6 + 0.4 * dens);
      // E–W street (lamps along x on both kerbs, 28 m apart, staggered)
      for (int sgn = 0; sgn < 2; sgn++) {
        float sd = sgn == 0 ? -1.0 : 1.0;
        float y0 = cl.y + sd * (5.8 + 4.0 * arterialY);
        float S = 28.0 - 6.0 * arterialY;
        float ph = sgn == 0 ? 0.0 : 0.5 * S;
        float spx = S / FP;
        float kk = floor((m.x - ph) / S + 0.5);
        float lx = ph + kk * S;
        float on = step(0.12 * (1.0 - dens), ihash2(ivec2(int(kk), int(k.y) * 2 + sgn)));
        float pt = psf(vec2(m.x - lx, m.y - y0)) * on;
        float line = 2.67 / max(spx, 1e-3) * exp(-pow((m.y - y0) / FP, 2.0) / 1.45) * 0.8;   // flux per px along the row
        c += colr * B * mix(line, pt, ss(2.0, 4.0, spx)) * (1.0 + 0.6 * arterialY);
        // the pool of light on the road under each lamp (only while it is resolved)
        float pool = exp(-dot(vec2(m.x - lx, (m.y - y0) * 1.4), vec2(m.x - lx, (m.y - y0) * 1.4)) / 60.0) * on;
        c += colr * 0.035 * pool * ss(1.5, 0.3, FP);
      }
      // N–S street
      for (int sgn = 0; sgn < 2; sgn++) {
        float sd = sgn == 0 ? -1.0 : 1.0;
        float x0 = cl.x + sd * (5.8 + 4.0 * arterialX);
        float S = 28.0 - 6.0 * arterialX;
        float ph = sgn == 0 ? 7.0 : 7.0 + 0.5 * S;
        float spx = S / FP;
        float kk = floor((m.y - ph) / S + 0.5);
        float ly = ph + kk * S;
        float on = step(0.12 * (1.0 - dens), ihash2(ivec2(int(k.x) * 2 + sgn + 77, int(kk))));
        float pt = psf(vec2(m.x - x0, m.y - ly)) * on;
        float line = 2.67 / max(spx, 1e-3) * exp(-pow((m.x - x0) / FP, 2.0) / 1.45) * 0.8;
        c += colr * B * mix(line, pt, ss(2.0, 4.0, spx)) * (1.0 + 0.6 * arterialX);
        float pool = exp(-dot(vec2((m.x - x0) * 1.4, m.y - ly), vec2((m.x - x0) * 1.4, m.y - ly)) / 60.0) * on;
        c += colr * 0.035 * pool * ss(1.5, 0.3, FP);
      }
      return c;
    }
    // windows of the other blocks as lights: a 3 × 3.2 m lattice inside each block, lit by hash
    vec3 blockLights(vec2 m, float dens){
      vec2 rel = m - SOFF;
      vec2 k = floor(rel / PITCH);
      vec2 inb = rel - k * PITCH;                         // position inside the block cell (street at 0 and PITCH)
      float inside = mcov1(8.0, PITCH.x - 8.0, inb.x) * mcov1(8.0, PITCH.y - 8.0, inb.y);
      if (inside <= 0.0) return vec3(0.0);
      // our own block: our building is drawn as the facade, the rest of the block like the others
      float led = ledness(m);
      vec2 wq = m / vec2(3.0, 3.2);
      vec2 wi = floor(wq + 0.5);
      float h = ihash2(ivec2(wi) + ivec2(5, 17));
      float pLit = (0.10 + 0.22 * dens) * (1.0 + led);
      float on = step(h, pLit);
      vec3 K = mix(kmax(mix(2400.0, 3600.0, ihash2(ivec2(wi) + 3))), vec3(0.88, 0.92, 1.0), step(0.6, led + 0.3 * ihash2(ivec2(wi) + 9)));
      float spx = 3.0 / FP;
      float pt = psf((wq - wi) * vec2(3.0, 3.2)) * on;
      float area = 2.67 * pLit / (spx * spx * 1.07);       // mean flux per px²
      float B = 0.9;
      return K * B * mix(area, pt, ss(2.0, 4.0, spx)) * inside;
    }

    // ======================= EARTH (night lights from lib/earth.js) =======================
    vec3 earthLights(vec3 n, out float landAmt){
      float lon = atan(n.x, n.z); float lat = asin(clamp(n.y, -1.0, 1.0));
      vec2 uv = vec2(lon / TAU + 0.5, lat / PI + 0.5);
      vec3 li = texture2D(uLights, uv).rgb;
      landAmt = texture2D(uLand, uv).r;
      float lum = dot(li, vec3(0.333)) * 3.0;
      lum = lum * (0.35 + 0.65 * ss(0.0, 0.6, lum));
      // LED white where the light is densest (city cores); sodium elsewhere — ≈ 1 : 3 by pixel count
      float core = ss(0.55, 1.10, lum + 0.25 * (nz(uv * 900.0).r - 0.5));
      vec3 c = mix(SOD, LEDC * 0.9, core) * lum;
      return c;
    }

    void main(){
      setupP(vec2(0.0));
      TT = uFr / 24.0;
      // ---------- ray vs the sheet (sphere of curvature uK tangent at O, normal n) ----------
      float cp = cos(uPhi), sp = sin(uPhi);
      vec3 n = vec3(0.0, 0.0, 1.0), e1 = vec3(1.0, 0.0, 0.0), e2 = vec3(0.0, 1.0, 0.0);
      vec3 cam = uD * vec3(0.0, -sp, cp);
      vec3 rgt = vec3(1.0, 0.0, 0.0), up = vec3(0.0, cp, sp), w = vec3(0.0, sp, -cp);
      vec2 sxy = vec2(P.x - 960.0, 540.0 - P.y);
      vec3 d = normalize(sxy.x * rgt + sxy.y * up + FPX * w);
      float k = uK;
      float b = k * dot(cam, d) + dot(n, d);
      float cc = k * dot(cam, cam) + 2.0 * dot(cam, n);
      float disc = b * b - k * cc;
      float den = -b + sqrt(max(disc, 0.0));
      bool hit = disc > 0.0 && den > 0.0;
      float t = hit ? cc / den : 0.0;
      vec3 col = vec3(0.0);
      // atmosphere / limb (only once the sheet is curled)
      vec3 ctr = -n / max(k, 1e-12);                       // sphere centre
      float atm = ss(0.3, 1.5, uU);
      vec3 airC = vec3(0.0);
      if (atm > 0.0) {
        float tca = dot(ctr - cam, d);
        float dmin = length(cam + d * tca - ctr);
        float Rs = 1.0 / k;
        float alt = (dmin - Rs) / Rs;
        float limb = exp(-max(alt, 0.0) / 0.0065) * step(-0.002, alt);
        float glow = exp(-pow((alt - 0.016) / 0.0035, 2.0));
        airC = (vec3(0.10, 0.26, 0.75) * 0.20 * limb + vec3(0.12, 0.55, 0.25) * 0.05 * glow) * atm;
      }
      if (!hit) {
        // space: a sparse, steady star field (screen space: the lens does not move)
        vec2 sq = P / 3.0; vec2 si = floor(sq);
        float hs = ihash2(ivec2(si) + ivec2(19, 71));
        float star = step(0.9965, hs) * exp(-dot(fract(sq) - 0.5, fract(sq) - 0.5) * 30.0) * (0.15 + 0.6 * pow(ihash2(ivec2(si) + 4), 6.0));
        col = vec3(0.8, 0.86, 1.0) * star * 0.5 * atm + airC;
        gl_FragColor = vec4(col * uGain, 1.0);
        return;
      }
      vec3 Ph = cam + d * t;                               // hit, relative to O
      vec2 pt = vec2(dot(Ph, e1), dot(Ph, e2));
      float pn = dot(Ph, n);
      float rt = length(pt);
      float th = atan(k * rt, 1.0 + k * pn);
      float s = k * rt > 1e-5 ? th / k : rt;               // arc length from O (m)
      vec2 m = rt > 0.0 ? pt * (s / rt) : vec2(0.0);       // azimuthal-equidistant surface coords (m)
      // pixel footprint and Jacobian
      vec2 mx = dFdx(m) * uS, my = dFdy(m) * uS;           // per 1080p px (dFdy in GL is bottom-up)
      my = -my;
      mat2 J = mat2(mx, my);
      float dj = mx.x * my.y - mx.y * my.x;
      FP = sqrt(max(abs(dj), 1e-12));
      JI = abs(dj) > 1e-20 ? inverse(J) : mat2(0.0);
      // ---------- content by scale ----------
      float lev = uLamp;
      float lampMask = 0.0, outl = 0.0;
      // our building: x ∈ [−13.5, 10.5], y ∈ [−12, 11.6] (its windows are the scripted ones)
      vec4 BLD = vec4(-13.5, -12.0, 10.5, 11.6);
      float inBld = mcovR(BLD, m);
      float dens = cityDensity(m);
      float facW = ss(0.9, 0.3, FP);                       // facade mode while windows are resolvable
      // block cell and interior (streets between blocks)
      vec2 rel = m - SOFF;
      vec2 kb = floor(rel / PITCH);
      vec2 inb = rel - kb * PITCH;
      float inside = mcov1(8.0, PITCH.x - 8.0, inb.x) * mcov1(8.0, PITCH.y - 8.0, inb.y);
      inside = max(inside, inBld);
      // 1) facades with their windows
      if (facW > 0.0 && inside > 0.0 && s < 3000.0) {
        vec3 fac = wallAt(m);
        vec2 cell = floor(vec2(m.x / 3.0 + 0.5, (m.y + 0.19) / 3.2 + 0.5));
        if (cell == vec2(0.0)) {
          // ours, in full detail
          vec2 g0 = vec2(-0.5 * GW, GTOP - GH);
          vec4 R = vec4(g0.x - JAMB, g0.y - JAMB, g0.x + GW + JAMB, GTOP + JAMB);
          float cov = mcovR(R, m);
          float glass = mcovR(vec4(g0, vec2(0.5 * GW, GTOP)), m);
          float wo;
          vec3 wc = ourWindow(m, lev, lampMask, wo);
          vec3 K = kmax(4000.0);
          float jam = cov - glass;
          float inner = mline(abs(m.x) - 0.5 * GW, 2.0) * step(abs(m.x), 0.5 * GW + JAMB);
          vec3 jc = vec3(0.0035, 0.0036, 0.004) + K * 0.05 * inner * lev;
          fac = mix(fac, wc, glass);
          fac = mix(fac, jc, clamp(jam, 0.0, 1.0));
          outl = max(wo * glass, mline(abs(m.x) - 0.5 * GW - JAMB, 2.5) + mline(abs(m.x) - 0.5 * GW, 2.5));
          outl = clamp(outl, 0.0, 1.0);
        } else {
          float bld = inBld > 0.5 ? 0.0 : 1.0 + ihash2(ivec2(kb) + ivec2(int(floor((m.x + 13.5) / 24.0)), 5));
          float cov, lit;
          vec3 wcol = facadeWindow(m, cell, vec2(0.0), vec2(3.0, 3.2), bld, lev, cov, lit);
          // other buildings: fewer lit at the edge of town, more downtown
          if (bld > 0.5) wcol *= 0.55 + 0.9 * dens * step(ihash2(ivec2(cell) + ivec2(3, 1)), 0.35 + 0.5 * dens);
          fac = mix(fac, wcol, cov);
        }
        col += fac * inside * facW;
      }
      // 2) streets and blocks as lights (sodium / LED)
      if (FP > 0.004 && s < 60000.0) {
        vec3 city = lampRows(m, vec2(0.0), dens) * ss(0.004, 0.012, FP);
        city += blockLights(m, dens) * (1.0 - facW);
        float extent = ss(16000.0, 8000.0, length(m - vec2(900.0, 1600.0)));
        col += city * extent * ss(400.0, 120.0, FP);
      }
      // 3) region and planet: earth.js night lights mapped through the same arc length
      if (uEarthOn > 0.5 && FP > 15.0) {
        float a = s / RE;
        vec2 dir2 = rt > 0.0 ? pt / rt : vec2(0.0, 1.0);
        vec3 gp = cos(a) * uGU + sin(a) * (dir2.x * uGE + dir2.y * uGN);
        float landAmt;
        vec3 el = earthLights(gp, landAmt);
        float w = ss(15.0, 180.0, FP);
        // night land faintly seen (airglow / starlight), the ocean darker
        vec3 night = vec3(0.004, 0.005, 0.008) * (0.4 + 0.6 * landAmt) * ss(200.0, 2000.0, FP);
        // dawn on the right limb: pale blue twilight beyond the terminator (east = into tomorrow)
        float mu = dot(gp, uSun);
        vec3 tw = vec3(0.10, 0.22, 0.50) * 0.10 * ss(-0.18, 0.05, mu) * ss(1500.0, 7000.0, FP);
        tw += vec3(0.5, 0.6, 0.75) * 0.06 * ss(0.0, 0.25, mu) * (0.3 + 0.7 * landAmt) * ss(1500.0, 7000.0, FP);
        float nightSide = ss(0.12, -0.10, mu);
        col += (el * 1.1 * nightSide + night) * w + tw;
      }
      // the lamp itself at every scale: once the window is under ~4 px its light is one point on C
      float sub = ss(0.03, 0.12, FP);
      col += kmax(4000.0) * 1.2 * lev * exp(-dot(P - CC, P - CC) / 1.45) * sub * ss(5000.0, 400.0, FP);
      // limb atmosphere over the disc edge
      col += airC;
      // dark gap / swap: only the outline of the window and lamp (warm residual, display ≈ 22)
      if (uFr < uOn - 0.5) col = vec3(0.034, 0.034, 0.036) * outl * uOutline;
      gl_FragColor = vec4(col * uGain, 1.0);
    }`, U);

  const LAMP = [0.59, 0.84, 1.0];                           // f2568, f2569, f2570: 85 % / 96 % / 100 % display
  return {
    U,
    render(target, fr, t, outline, additive) {
      const st = sheetState(fr);
      const D = st.sig * FPX;
      U.uFr.value = fr; U.uOutline.value = outline;
      U.uSig.value = st.sig; U.uD.value = D; U.uPhi.value = st.phi; U.uU.value = st.u; U.uK.value = st.u / D;
      const k = Math.floor(fr + 1e-6) - T.on;
      U.uLamp.value = fr < T.on - 0.5 ? 0 : (k <= 0 ? LAMP[0] : k === 1 ? LAMP[1] : 1);
      p.draw(renderer, target, additive);
    },
  };
}
