// b_flight/path.js — the one camera of long take B (S06 + S07, f2928–3863) and everything that moves
// relative to it, as pure functions of the frame number n (= f.t·24, fractional for sub-frames).
// No THREE here (plain arrays), so the numbers can be checked in node.
//
// World axes: −Z = the leaving direction D (yaw 0), +Y up, +X = right when looking along D.
// Yaw ψ > 0 turns the view to the LEFT (towards −X); pitch θ > 0 looks up.
// The sun sits at yaw +125°, elevation +30° (screenplay §0) for the whole take.
//
// Scales (poetic compression, screenplay §0): three frames of reference share the lens:
//   · the WORD STREAM: metres, relative to the camera; Q(n) = how far the camera has advanced through
//     the stream; z_front(n) = depth of the stream's front ahead of the lens.
//   · the PROBE: metres; rel(n) = probe centre − camera (world axes).
//   · the FAR field (Earth in S07, planets, stars): Earth radii / directions; distance dE(n).
//   In S06-a a near-frame Earth (metres) carries the root of the beam (nearEarth()).
// They never disagree on screen because each is only seen through its own parallax.

export const FPS = 24;
export const F35 = 960 * 35 / 18, F24 = 960 * 24 / 18;      // focal length, 1080p px (36 mm gauge)
export const VP = [1500, 330];                               // the beam's vanishing point in S06–S07-a
export const ROOT_PX = [330, 880];
export const LB = 5.06;                                      // camera → beam axis, m (dish 200 px at f3336)
const BD = (() => { const x = ROOT_PX[0] - VP[0], y = ROOT_PX[1] - VP[1], l = Math.hypot(x, y); return [x / l, y / l]; })();
export const BEAM_SCREEN_DIR = BD;                           // screen direction VP → root (y down)
export const BOFF = [BD[0] * LB, -BD[1] * LB];               // beam axis, lateral offset (world x, y) from the B1 lens
export const R_PX = [734, 540];                              // R as a continuous coordinate (pixel 733.5 + 0.5)
export const D2R = Math.PI / 180;
export const SUN = (() => { const y = 125 * D2R, e = 30 * D2R; return [-Math.sin(y) * Math.cos(e), Math.sin(e), -Math.cos(y) * Math.cos(e)]; })();

// ---- small math -----------------------------------------------------------------------------------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const inOutSine = u => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u));
export const lerp = (a, b, u) => a + (b - a) * u;
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vnorm = norm, vdot = dot;

// monotone cubic (Fritsch–Carlson) through keys [[x, y], …]
export function pchip(keys) {
  const n = keys.length, x = keys.map(k => k[0]), y = keys.map(k => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  // interior slopes: weighted harmonic mean (Fritsch–Butland); 0 at local extrema
  for (let i = 1; i < n - 1; i++) if (d[i - 1] * d[i] > 0) { const w1 = 2 * (x[i + 1] - x[i]) + (x[i] - x[i - 1]), w2 = (x[i + 1] - x[i]) + 2 * (x[i] - x[i - 1]); m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  return t => {
    if (t <= x[0]) return y[0] + m[0] * (t - x[0]);
    if (t >= x[n - 1]) return y[n - 1] + m[n - 1] * (t - x[n - 1]);
    let i = 0; while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i], s = (t - x[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}

// numeric integral of g over [a, b] on a fixed lattice (pure, deterministic): cumulative table
function integrator(g, n0, n1, step = 0.25) {
  const N = Math.ceil((n1 - n0) / step), T = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) { const a = n0 + (i - 1) * step; T[i] = T[i - 1] + step * (g(a) + 4 * g(a + step / 2) + g(a + step)) / 6; }
  return n => { const u = clamp((n - n0) / step, 0, N), i = Math.min(N - 1, Math.floor(u)), f = u - i; return T[i] + (T[i + 1] - T[i]) * f; };
}

// =====================================================================================================
// 1. the word stream: speed of the camera through it (m / frame) and its integral Q(n)
// =====================================================================================================
const vStream = pchip([
  [2880, 0.02], [2928, 0.03], [2952, 0.085], [2976, 0.15], [3026, 0.23], [3048, 0.15], [3062, 0.10],
  [3128, 0.095], [3150, 0.30], [3216, 0.40], [3336, 0.34], [3420, 0.30], [3900, 0.30],
]);
export const streamSpeed = n => Math.max(0.01, vStream(n));
const Qi = integrator(streamSpeed, 2880, 3900);
export const Q = n => Qi(n);
export const Z_FRONT_3336 = 55;                               // m: the front is just beyond the probe at f3336
export const zFront = n => Z_FRONT_3336 + Q(3336) - Q(n);
export const W_RAMP = 120;                                    // m: density ramps up behind the front
export const streamDensity = w => Math.pow(sstep(0, W_RAMP, w), 1.6);

// =====================================================================================================
// 2. the lens: orientation (yaw, pitch), focal length, principal-point shift
// =====================================================================================================
export const TURN = [3360, 3552];
export const ZOOM = [3360, 3400];
export const SHIFT_END = 3480;
export const YAW_END = 170;
export const PITCH_DIP = -4;
export function lens(n) {
  const u = clamp((n - TURN[0]) / (TURN[1] - TURN[0]));
  const yaw = YAW_END * inOutSine(u);
  const pitch = PITCH_DIP * Math.sin(Math.PI * u);
  const uz = clamp((n - ZOOM[0]) / (ZOOM[1] - ZOOM[0]));
  const F = F35 * Math.pow(F24 / F35, inOutSine(uz));
  const us = inOutSine((n - TURN[0]) / (SHIFT_END - TURN[0]));
  const ppx = VP[0] + (960 - VP[0]) * us, ppy = VP[1] + (540 - VP[1]) * us;
  return { yaw, pitch, F, ppx, ppy };
}
// camera basis (world) for yaw/pitch: right, up, back (= −forward)
export function basis(yawDeg, pitchDeg) {
  const y = yawDeg * D2R, p = pitchDeg * D2R;
  const fwd = [-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)];
  const right = [Math.cos(y), 0, -Math.sin(y)];
  // camera frame: x = right, y = up, z = back = −fwd, right-handed → up = back × right = right × fwd
  const up = norm([right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]]);
  return { fwd, right, up };
}
// world direction of a screen point (continuous 1080p coords) for lens state L
export function screenDir(px, py, L) {
  const B = basis(L.yaw, L.pitch);
  const x = (px - L.ppx) / L.F, y = -(py - L.ppy) / L.F;
  return norm([B.right[0] * x + B.up[0] * y + B.fwd[0], B.right[1] * x + B.up[1] * y + B.fwd[1], B.right[2] * x + B.up[2] * y + B.fwd[2]]);
}
// screen position of a world vector v (relative to the lens); returns [px, py, depth] (depth > 0 ahead)
export function project(v, L) {
  const B = basis(L.yaw, L.pitch);
  const d = dot(v, B.fwd), x = dot(v, B.right), y = dot(v, B.up);
  return [L.ppx + L.F * x / d, L.ppy - L.F * y / d, d];
}

// =====================================================================================================
// 3. the probe (Voyager 1): rel(n) = probe centre − lens, metres, world axes
// =====================================================================================================
// B1: on the beam axis, approaching; log-rate ρ(n) per frame; anchored at zp(3336) = 34.2 m
export const ZP_3336 = 34.2;
export const NET_GROW = 0.0065;                               // ≥ 0.5 %/frame net magnification (K: f3360–3400)
const rhoB1 = n => NET_GROW + 0.006 * (1 - sstep(3200, 3340, n));
const rhoB1i = integrator(rhoB1, 2880, 3360);
export const zpB1 = n => ZP_3336 * Math.exp(rhoB1i(3336) - rhoB1i(Math.min(n, 3360)));
const relB1 = n => [BOFF[0], BOFF[1], -zpB1(n)];
// B2: the probe's screen position p(n) and distance r(n) are prescribed; rel = r · screenDir(p, lens)
export const P_FINAL = [1340, 660];
export let R_FINAL = 16.0;                                    // m (S07-c: span ≈ 760 px)
export function setFinalDistance(r) { R_FINAL = r; buildR2(); }
const r3360 = (() => { const z = zpB1(3360); return Math.hypot(z, LB); })();
const dlnF = n => { const a = Math.log(lens(n - 0.25).F), b = Math.log(lens(n + 0.25).F); return (b - a) / 0.5; };
let lnR2 = null;
function buildR2() {
  // f3360–3400: d ln r/dn = d ln F/dn − NET_GROW (exactly +0.65 %/frame on screen while the lens widens)
  const g = integrator(n => dlnF(n) - NET_GROW, 3360, 3400);
  const l3400 = Math.log(r3360) + g(3400);
  const tail = pchip([[3400, l3400], [3406, l3400 - 6 * NET_GROW * 0.9], [3462, Math.log(Math.min(R_FINAL * 0.9, Math.exp(l3400) * 0.92))], [3552, Math.log(R_FINAL)], [3600, Math.log(R_FINAL)]]);
  lnR2 = n => (n <= 3400 ? Math.log(r3360) + g(n) : n >= 3552 ? Math.log(R_FINAL) : tail(n));
}
buildR2();
export const rProbe = n => (n <= 3360 ? Math.hypot(zpB1(n), LB) : Math.exp(lnR2(n)));
const pB1 = n => { const z = zpB1(n); return [VP[0] + F35 * BOFF[0] / z, VP[1] - F35 * BOFF[1] / z]; };
const P0 = pB1(3360), V0 = (() => { const a = pB1(3359.5), b = pB1(3360); return [(b[0] - a[0]) * 2, (b[1] - a[1]) * 2]; })();
// S07-d: the camera slides sideways, the probe leaves the frame to the right before f3816
export const EXIT = [3768, 3814];
export function probeScreen(n) {
  if (n <= 3360) return pB1(n);
  if (n < 3552) {
    const T = 3552 - 3360, s = (n - 3360) / T, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2;
    return [h00 * P0[0] + h10 * T * V0[0] + h01 * P_FINAL[0], h00 * P0[1] + h10 * T * V0[1] + h01 * P_FINAL[1]];
  }
  if (n <= EXIT[0]) return P_FINAL.slice();
  const u = (n - EXIT[0]) / (EXIT[1] - EXIT[0]);
  // ease in (velocity 0 at f3768), then keep going
  const dx = u < 1 ? 1400 * u * u * u * (1 - 0.35 * u) / 0.65 : 1400 / 0.65 * (0.65 + (3 - 0.35 * 4) * (u - 1));
  return [P_FINAL[0] + dx * 0.65, P_FINAL[1] - 40 * clamp(u) * clamp(u)];
}
export function probeRel(n) {
  if (n <= 3360) return relB1(n);
  const L = lens(n), d = screenDir(...probeScreen(n), L), r = rProbe(n);
  return [d[0] * r, d[1] * r, d[2] * r];
}
// the probe's own (absolute) outward speed — only to state that the lens always moves outward:
// lens velocity along D = V_PROBE − d(rel_z)/dn must stay > 0
export const V_PROBE = 1.0;

// =====================================================================================================
// 4. the far field: Earth after the turn (always on R from f3552), distance in Earth radii
// =====================================================================================================
const lnDiam = pchip([[3551, Math.log(64)], [3624, Math.log(32)], [3672, Math.log(16)], [3720, Math.log(8)], [3756, Math.log(4)], [3800, Math.log(4) - 44 / 36 * Math.log(2)]]);
export const earthDiamPx = n => Math.exp(lnDiam(n));
export const earthDist = n => 2 * F24 / earthDiamPx(n);      // R⊕ (small-angle: diameter = 2·F/d)
export const LENS_FINAL = { yaw: YAW_END, pitch: 0, F: F24, ppx: 960, ppy: 540 };
export const EARTH_DIR = screenDir(R_PX[0], R_PX[1], LENS_FINAL);

// =====================================================================================================
// 5. focus of the stream (for the words' depth of field): far, then on the probe
// =====================================================================================================
export const focusDepth = n => lerp(45, clamp(zpB1(n), 32, 80), sstep(3190, 3240, n));

// =====================================================================================================
// 6. the near-frame Earth of S06-a (limb (0,700) → (520,942), the beam root on it at (330,880))
// =====================================================================================================
const dirB1 = (px, py) => norm([(px - VP[0]) / F35, -(py - VP[1]) / F35, -1]);
export const ROOT_Z0 = (() => { const a = Math.hypot(ROOT_PX[0] - VP[0], ROOT_PX[1] - VP[1]); return F35 * LB / a; })();  // m
let NE = null;
export function nearEarth() {
  if (NE) return NE;
  const r1 = dirB1(0, 700), r2 = dirB1(520, 942), r0 = dirB1(ROOT_PX[0], ROOT_PX[1]);
  // centre direction u on the bisector family r1·u = r2·u; pick the member where the root ray is
  // DELTA inside the limb
  const DELTA = 1.2 * D2R;
  const solveCy = cx => { let lo = 1000, hi = 6000; const f = cy => { const u = dirB1(cx, cy); return dot(r1, u) - dot(r2, u); };
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; } return (lo + hi) / 2; };
  const err = cx => { const cy = solveCy(cx), u = dirB1(cx, cy), al = Math.acos(dot(r1, u)), a0 = Math.acos(dot(r0, u)); return a0 - (al - DELTA); };
  let lo = -2000, hi = 300;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (err(lo) * err(m) <= 0) hi = m; else lo = m; }
  const cx = (lo + hi) / 2, cy = solveCy(cx), u = dirB1(cx, cy), alpha = Math.acos(dot(r1, u));
  const P = r0.map(v => v * ROOT_Z0 / -r0[2]);
  const c2 = Math.cos(alpha) ** 2, pu = dot(P, u), pp = dot(P, P);
  const disc = Math.sqrt(Math.max(0, pu * pu - c2 * pp));
  let best = null;
  for (const d of [(pu + disc) / c2, (pu - disc) / c2]) {
    const C = u.map(v => v * d), nrm = norm([P[0] - C[0], P[1] - C[1], P[2] - C[2]]);
    if (dot(nrm, P.map(v => -v)) > 0 && (!best || d > best.d)) best = { d, C };
  }
  const R = best.d * Math.sin(alpha);
  // forward travel (relative to the Earth) after which no part of the disc is in the band
  const inBand = dz => {
    const C = [best.C[0], best.C[1], best.C[2] + dz];
    if (C[2] - R > 0) return false;
    const dc = Math.hypot(...C), uc = C.map(v => v / dc);
    if (dc <= R) return true;
    const a = Math.asin(R / dc);
    const e1 = norm([-uc[1], uc[0], 0]), e2 = [uc[1] * e1[2] - uc[2] * e1[1], uc[2] * e1[0] - uc[0] * e1[2], uc[0] * e1[1] - uc[1] * e1[0]];
    for (let k = 0; k < 720; k++) {
      const t = k / 720 * 2 * Math.PI, cs = Math.cos(t), sn = Math.sin(t);
      const v = uc.map((x, j) => x * Math.cos(a) + (e1[j] * cs + e2[j] * sn) * Math.sin(a));
      if (v[2] >= -1e-3) continue;
      const px = VP[0] + F35 * v[0] / -v[2], py = VP[1] - F35 * v[1] / -v[2];
      if (px > -2 && px < 1922 && py > 136 && py < 944) return true;
    }
    return false;
  };
  let a = 0, b = 400; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (inBand(m)) a = m; else b = m; }
  NE = { C: best.C, R, root: P, exit: b, centrePx: [cx, cy], alpha };
  return NE;
}
// forward travel of the lens relative to the near Earth (m): eases in, the Earth is gone by f2972
export const nearEarthTravel = n => { const ne = nearEarth(), u = clamp((n - 2926) / (2972 - 2926)); return ne.exit * 1.04 * (0.25 * u + 0.75 * u * u); };
export const rootDepth = n => ROOT_Z0 - nearEarthTravel(n);

// =====================================================================================================
// 7. events
// =====================================================================================================
export const GLINT_FRAME = 3456;                              // the golden record catches the sun (HDR 6, 6 frames)
export const BLUE_DOT_FROM = 3780;                            // from here on w_sea's hand-off layer draws dot, stars, band
// camera lateral displacement relative to the word stream (B2: the lens slides with its pass)
export const lensLateral = n => { if (n <= 3360) return [0, 0]; const a = probeRel(3360), b = probeRel(n); return [a[0] - b[0], a[1] - b[1]]; };
