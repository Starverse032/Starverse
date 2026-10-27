// a_star / curves — every time curve of A2 as a pure function of the (fractional) frame number fr.
// No THREE, no DOM: importable from node for measurements (build/a_star/*.mjs).
//
// Star phase   [1212, 1344): screen diameter of the star (camera magnification × the star's own radius)
// Shell        [1344, 1500): flash intensity, shell limb ratio q = ρ/d (screen radius = fpx·q/√(1−q²))
// Earth        [1392, 1680]: camera slant distance s (km) to R_geo and elevation φ of the line of sight;
//                            exposure E(t); star birth law; at f1680 the camera IS _clouds.js camAt(1680)
//                            (slant 87.5 km, glide 4.5°, 35 mm) — the A3 cloud track takes over there.

export const FPX35 = 960 * 35 / 18;          // 1080p focal length in px, 36 mm gauge (1866.67)
export const R_EARTH_KM = 6371;
export const RX = 734.5, RY = 540.5;          // R, pixel-centre convention (= _webgraph / _corona / _clouds)

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const s5 = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// integrate ∫ ln(1 + rate(f)) df on a fine table (trapezoid), returns a lookup fn(fr)
function integrator(rate, f0, f1, step = 1 / 16) {
  const n = Math.round((f1 - f0) / step) + 1, L = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const a = f0 + (i - 1) * step;
    L[i] = L[i - 1] + 0.5 * (Math.log1p(rate(a)) + Math.log1p(rate(a + step))) * step;
  }
  return fr => {
    if (fr <= f0) return (fr - f0) * Math.log1p(rate(f0));
    if (fr >= f1) return L[n - 1] + (fr - f1) * Math.log1p(rate(f1));
    const x = (fr - f0) / step, i = Math.floor(x), u = x - i;
    return L[i] + (L[Math.min(i + 1, n - 1)] - L[i]) * u;
  };
}
function bisect(fn, a, b, it = 60) { let fa = fn(a); for (let i = 0; i < it; i++) { const m = 0.5 * (a + b), fm = fn(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; } return 0.5 * (a + b); }

// ============================== star ==========================================================
// Camera magnification at R (per frame): continues A1's WEB_PATH_A schedule through the corona
// (5 % → 2.2 % over f1204–1224), then 2.2 % → b over f1224–1296 (b solved so the disc is exactly
// 120 → 380 px), then eases to 0.5 %/frame for the tightening / collapse / shell (screenplay).
function starRateFactory(b) {
  return fr => {
    if (fr < 1204) return 0.050;
    if (fr < 1224) return 0.050 - 0.028 * s5(1204, 1224, fr);
    const r = 0.022 - (0.022 - b) * s5(1224, 1296, fr);
    return lerp(r, 0.005, s5(1290, 1304, fr));
  };
}
const STAR_B = bisect(b => { const I = integrator(starRateFactory(b), 1200, 1500); return Math.exp(I(1296) - I(1224)) * 120 - 380; }, 0.002, 0.03);
export const starRate = starRateFactory(STAR_B);
const starLnM = integrator(starRate, 1200, 1500);
/** camera magnification at R relative to f1224 (pure camera: dolly + zoom) */
export const camMag = fr => Math.exp(starLnM(fr) - starLnM(1224));
export const focalAt = fr => 24 * Math.pow(35 / 24, s5(1224, 1272, fr));

// the star's own radius (1 until the tightening), visible diameter 380 → 260 px over f1296–1320
const TIGHT_END = (260 / 380) / (camMag(1320) / camMag(1296));
export function starOwnRadius(fr) { return 1 - (1 - TIGHT_END) * s5(1296, 1320, fr); }
/** screen radius (1080p px) of the star disc; collapse r = r0·(1 − u³) → 2 px (4 px diameter) at f1331 */
export function starRadiusPx(fr) {
  if (fr < 1320) return 60 * camMag(fr) * starOwnRadius(fr);
  const r0 = 130;
  if (fr < 1331) { const u = clamp((fr - 1320) / 11); return 2 + (r0 - 2) * (1 - u * u * u); }
  return 2;
}
/** tightening state 0..1 (granules smaller, flow ×3, limb ×2, bluer, one luminosity pulse) */
export const tighten = fr => s5(1294, 1316, fr);
export const pulse = fr => Math.exp(-Math.pow((fr - 1309) / 4.5, 2));
/** disc visibility through the corona (the disc emerges from f1213, fully there at f1224) */
export const discGain = fr => s5(1212, 1225, fr);
/** collapse progress 0..1 over f1320–1331 */
export const collapseU = fr => clamp((fr - 1320) / 11);

// ============================== supernova =====================================================
/** flash HDR at R: ≈ 10 at f1344, 10³ at f1348 (4 frames), fast decay + a lingering hot core */
export function flashI(fr) {
  const tf = fr - 1343.75, tp = 4.25;
  if (tf < 0) return 0;
  if (tf < tp) return 10 + 990 * Math.pow(tf / tp, 2);
  const x = tf - tp;
  return 1000 * Math.exp(-x / 1.5) + 30 * Math.exp(-x / 9);
}
export const pointI = fr => (fr >= 1328 && fr < 1348 ? 2.6 * s5(1326, 1331, fr) : 0);

// shell limb ratio q = ρ/d: monotone cubic through ln q keyframes (screen radius 50 / 200 / 600 px at
// f1352 / 1368 / 1392, past the frame corners before f1416, the near cap passes the lens at ≈ f1428)
const pxQ = px => px / Math.sqrt(FPX35 * FPX35 + px * px);
const QK = [[1344, Math.log(pxQ(4))], [1348, Math.log(pxQ(20))], [1352, Math.log(pxQ(50))], [1368, Math.log(pxQ(200))], [1392, Math.log(pxQ(600))],
  [1404, Math.log(pxQ(980))], [1416, Math.log(pxQ(1700))], [1428, 0.0], [1440, 0.24], [1470, 0.58], [1530, 0.95]];
function monotoneCubic(K) {
  const n = K.length, x = K.map(k => k[0]), y = K.map(k => k[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);   // harmonic mean
  return t => {
    if (t <= x[0]) return y[0] + m[0] * (t - x[0]);
    if (t >= x[n - 1]) return y[n - 1] + m[n - 1] * (t - x[n - 1]);
    let i = 0; while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i], u = (t - x[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * y[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * y[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}
const lnQ = monotoneCubic(QK);
export const shellQ = fr => Math.exp(lnQ(fr));
export const shellRadiusPx = fr => { const q = shellQ(fr); return q >= 1 ? Infinity : FPX35 * q / Math.sqrt(1 - q * q); };
/** shell energy (relative), hot → element colours, and fade of the far "bowl" behind the Earth */
export function shellState(fr) {
  const u = fr - 1346;
  const on = s5(1345, 1349, fr);
  const hot = Math.exp(-Math.max(0, u) / 5);
  const energy = on * (0.55 + 0.45 * s5(1349, 1366, fr) + 1.6 * Math.exp(-Math.max(0, u) / 3)) * (1 - 0.82 * s5(1430, 1520, fr));
  return { on, hot, energy, spread: 0.6 + 0.4 * s5(1346, 1380, fr) };
}
/** edge sweep: the front of the near cap leaving through the frame edges, f1404–1428 (radius in px) */
export function sweep(fr) {
  const u = clamp((fr - 1402) / 28);
  return { r: lerp(620, 1500, Math.pow(u, 0.8)), a: Math.sin(Math.PI * u) * s5(1400, 1406, fr) };
}

// ============================== earth =========================================================
// disc diameter keyframes (px): 160 (f1400) → 220 (f1440) → 310 (f1536) → 420 (f1584); monotone cubic
// in ln(diameter), nadir camera over R_geo (disc centre on R).  The camera magnification at R is the
// ratio of the altitudes; the diameter rates are 0.80 / 0.36 / 0.63 %/frame (screenplay).
const DK = [[1380, Math.log(160) - 20 * Math.log(1.008)], [1400, Math.log(160)], [1440, Math.log(220)], [1536, Math.log(310)], [1584, Math.log(420)], [1590, Math.log(420) + 6 * Math.log(1.0068)]];
const lnDiam = monotoneCubic(DK);
export const earthDiamNadir = fr => Math.exp(lnDiam(fr));
const altFromDiam = D => { const a = Math.atan(D / 2 / FPX35); return (1 / Math.sin(a) - 1) * R_EARTH_KM; };
export const S1584 = altFromDiam(420);                    // ≈ 50 600 km

// [1584, 1680]: the sprint.  rate ≤ 6 % (×16) then ≤ 8 % (×40) with smooth joins; s(1680) = 87.5 km
// exactly = _clouds.js camAt(1680).d (W 90 km, 35 mm, d = W·35/36).
export const S1680 = 90 * 35 / 36;
const R0 = Math.log(420 / 310) / 48;                      // ≈ 0.63 %/frame at the end of the cruise
function sprintRateFactory(r2) {
  const r1 = 0.05995;
  return fr => {
    let r = lerp(Math.expm1(R0), r1, s5(1583.5, 1588, fr));
    r = lerp(r, r2, s5(1631.6, 1636, fr));
    return r;
  };
}
const SPRINT_R2 = bisect(r2 => { const I = integrator(sprintRateFactory(r2), 1584, 1700); return Math.log(S1584) - (I(1680) - I(1584)) - Math.log(S1680); }, 0.03, 0.12);
export const sprintRate = sprintRateFactory(SPRINT_R2);
const sprintI = integrator(sprintRate, 1584, 1700);
/** slant distance (km) from the camera to R_geo */
export function slantKm(fr) {
  if (fr <= 1584) return altFromDiam(earthDiamNadir(fr));
  return Math.exp(Math.log(S1584) - (sprintI(fr) - sprintI(1584)));
}
/** elevation (deg) of the camera seen from R_geo (90 = nadir view), camera due south of R_geo */
export function elevDeg(fr) {
  // nadir until f1566; the line of sight tilts (≤ 1.25°/frame) so that the horizon apex is ≈ y 300 at
  // f1632 (K30), and reaches the A3 glide (4.5°) at f1680 with zero slope (= _clouds.js camAt(1680))
  return 4.5 + 85.5 * Math.pow(1 - sstep(1566, 1680, fr), 1.3);
}
/** exposure curve E(t): −6 EV (f1400) … −5 EV (f1440) → 0 EV (f1584), smooth (smootherstep in EV) */
export function exposureEV(fr) {
  if (fr < 1440) return -6 + s5(1396, 1440, fr);
  return -5 + 5 * s5(1440, 1584, fr);
}
export const exposureE = fr => Math.pow(2, exposureEV(fr));

// star births: N(f) = 2^((f − 1452)/τ), first star f1452 (screenplay), ≈ 145 by f1583, ≤ 6 per frame
export const BIRTH_TAU = 18.3;
export const birthFrame = k => 1452 + BIRTH_TAU * Math.log2(k + 1);
export const N_STARS = 150;

export const SPRINT = { r2: SPRINT_R2, starB: STAR_B, tightEnd: TIGHT_END };
