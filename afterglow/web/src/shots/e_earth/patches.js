// Regional detail patches (screenplay S19–S26 "低空地球怎么做"): 4096² tangent-plane textures,
// rgb = night lights (linear HDR, HalfFloat), a = land mask with a fractal-densified coastline.
//
// Vector layers are rasterised with canvas2D (anti-aliased, so already band-limited at the texel):
//   coast polygons (Natural Earth rings, midpoint-displaced down to ~2 texels), hand-entered rivers
//   (dark), inter-city highways and 6–10 radial arterials per city (brightness decaying outwards),
//   a smooth population-density field splatted from places.js.
// The bake shader adds the procedural layers: Voronoi street blocks (two scales, domain-warped,
// cell size shrinking with density), village / suburb point lights by hash against density, park
// and river dark masks, sodium #FFB45A outskirts turning LED #E8F0FF in dense cores, fishing fleets
// (S22A). Mipmaps then band-limit everything for minification; the globe shader blends the patch
// with the global earth.js map by pixel footprint.
// Patches are baked lazily (first frame that needs one) so a worker that never renders the montage
// never pays for them. Deterministic: fixed seeds only.
import * as THREE from 'three';
import * as GLSL from '../../lib/glsl.js';
import { FSQ } from '../../post.js';
import { LAND, LAND_HOLES, LAKES } from '../../data/land.js';
import { PLACES } from '../../data/places.js';
import { rng } from '../../lib/util.js';
import { lonLatDir, enu, R_EARTH_KM, NILE_MAIN, NILE_ROSETTA, NILE_DAMIETTA, SEINE } from './geo.js';

export const PATCHES = {
  nairobi: { lon: 36.8, lat: -1.3, sizeKm: 640, res: 4096, seed: 11, rural: 0.05, roadGain: 0.45, radLen: 0.6, warpKm: 3.5, glow: 0.55 },
  delta:   { lon: 31.0, lat: 30.45, sizeKm: 420, res: 4096, seed: 12, nile: true, coast: 0.3, gain: 0.7 },
  naples:  { lon: 14.2, lat: 40.95, sizeKm: 300, res: 4096, seed: 13, coast: 0.55, rural: 0.22 },
  paris:   { lon: 2.35, lat: 48.86, sizeKm: 120, res: 4096, seed: 14, rivers: [SEINE], rural: 0.15 },
  europe:  { lon: 6.6, lat: 50.9, sizeKm: 900, res: 4096, seed: 15, rural: 0.42, gain: 1.35 },
  fishing: { lon: 130.3, lat: 37.0, sizeKm: 560, res: 4096, seed: 16, fleet: true, coast: 0.35, rural: 0.12 },
};

function frameOf(P) {
  const c = lonLatDir(P.lon, P.lat); const { east, north } = enu(c);
  const half = P.sizeKm / 2 / R_EARTH_KM;
  return { c, e: east, n: north, half };
}
// lon/lat → patch uv (0..1, y up) via the tangent plane (same mapping as the globe shader)
function makeUV(F) {
  return (lon, lat) => {
    const q = lonLatDir(lon, lat), d = q.clone().sub(F.c);
    let x = d.dot(F.e), y = d.dot(F.n);
    // orthographic (= the globe shader's tangent-plane mapping) near the patch; beyond 60° the radius
    // keeps growing with the angle so the mapping stays continuous and monotonic: far polygon vertices
    // never fold back, and no long chord between two of them can cut straight across the patch
    const th = Math.acos(Math.max(-1, Math.min(1, q.dot(F.c))));
    if (th > Math.PI / 3) { const L = Math.hypot(x, y) || 1, rr = Math.sin(Math.PI / 3) + (th - Math.PI / 3); x = x / L * rr; y = y / L * rr; }
    return [x / (2 * F.half) + 0.5, y / (2 * F.half) + 0.5];
  };
}

// midpoint displacement of a polyline (deterministic per segment endpoints)
function fractalize(pts, minLen, amp = 0.17, N = 1e9) {
  const out = [pts[0]];
  const lo = -0.15 * N, hi = 1.15 * N;
  const rec = (a, b, depth) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const far = Math.max(a[0], b[0]) < lo || Math.min(a[0], b[0]) > hi || Math.max(a[1], b[1]) < lo || Math.min(a[1], b[1]) > hi;
    if (L < minLen || depth > 16 || far) { out.push(b); return; }
    const h = Math.sin((a[0] * 127.1 + a[1] * 311.7 + b[0] * 74.7 + b[1] * 269.5) * 43758.5453);
    const s = (h - Math.floor(h)) * 2 - 1;
    const m = [(a[0] + b[0]) / 2 - dy * s * amp, (a[1] + b[1]) / 2 + dx * s * amp];
    rec(a, m, depth + 1); rec(m, b, depth + 1);
  };
  for (let i = 0; i < pts.length - 1; i++) rec(pts[i], pts[i + 1], 0);
  return out;
}

function vectorCanvas(P, F, uvOf, places) {
  const N = P.res, c = document.createElement('canvas'); c.width = N; c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  const px = (lon, lat) => { const [u, v] = uvOf(lon, lat); return [u * N, (1 - v) * N]; };
  const inRing = (r, x, y) => {      // even-odd point-in-polygon in lon/lat
    let c = false;
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const inBox = (r, m = 0.25) => {
    for (let i = 0; i < r.length; i += 2) { const [u, v] = uvOf(r[i], r[i + 1]); if (u > -m && u < 1 + m && v > -m && v < 1 + m) return true; }
    return inRing(r, P.lon, P.lat);        // an inland patch lies wholly inside a ring with no vertex nearby
  };
  const ringPx = r => { const pts = []; for (let i = 0; i < r.length; i += 2) pts.push(px(r[i], r[i + 1])); pts.push(pts[0]); return pts; };
  const fill = (rings, style, rule = 'nonzero') => {
    g.fillStyle = style; g.beginPath();
    for (const r of rings) { if (!inBox(r)) continue; const f = fractalize(ringPx(r), 2.2, 0.17, N); g.moveTo(...f[0]); for (const p of f) g.lineTo(...p); g.closePath(); }
    g.fill(rule);
  };
  // R: land (fractal coast)
  fill(LAND, '#f00', 'evenodd'); fill(LAND_HOLES, '#000'); fill(LAKES, '#000');
  g.globalCompositeOperation = 'lighter';
  const kmPx = N / P.sizeKm;
  const r = rng(P.seed * 7919);
  // G: rivers (dark masks). Nile: main stem 0.9 km wide, branches 0.5 km
  const rivers = [];
  // (the Nile branches are 0.3–0.9 km wide: unresolved from orbit at night, so no dark mask —
  //  they show as the strings of brighter towns along them, see densityCanvas)
  for (const rv of P.rivers || []) rivers.push([rv, 0.16]);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [line, wkm] of rivers) {
    const pts = fractalize(line.map(p => px(p[0], p[1])), 3, 0.09, N);
    g.strokeStyle = 'rgb(0,255,0)'; g.lineWidth = Math.max(1.2, wkm * kmPx);
    g.beginPath(); g.moveTo(...pts[0]); for (const p of pts) g.lineTo(...p); g.stroke();
  }
  // B: roads. Highways between near neighbours (curved), then radial arterials per city.
  const top = places.filter(p => p.pop > 20000);
  for (let i = 0; i < top.length; i++) {
    const a = top[i];
    const cand = top.map((b, j) => [Math.hypot(b.x - a.x, b.y - a.y), j]).filter(([d, j]) => j !== i && d < 140 * kmPx).sort((x, y) => x[0] - y[0]).slice(0, 3);
    for (const [d, j] of cand) {
      const b = top[j];
      const w = Math.min(1, Math.sqrt(Math.min(a.pop, b.pop)) / 900);
      g.strokeStyle = `rgba(0,0,255,${(0.10 + 0.22 * w).toFixed(3)})`;
      g.lineWidth = Math.max(1.0, 0.09 * kmPx);
      const mx = (a.x + b.x) / 2 + (r() - 0.5) * d * 0.18, my = (a.y + b.y) / 2 + (r() - 0.5) * d * 0.18;
      const pts = fractalize([[a.x, a.y], [mx, my], [b.x, b.y]], 6, 0.06, N);
      g.beginPath(); g.moveTo(...pts[0]); for (const p of pts) g.lineTo(...p); g.stroke();
    }
  }
  for (const p of top) {
    const radKm = 2.2 * Math.pow(p.pop / 1e4, 0.42);
    const nR = Math.min(10, 4 + Math.floor(Math.log10(p.pop / 1e4) * 2.5));
    const a0 = r() * 6.283;
    for (let k = 0; k < nR; k++) {
      const ang = a0 + k * 6.283 / nR + (r() - 0.5) * 0.5;
      const len = radKm * (0.7 + r() * 0.9) * (P.radLen ?? 1) * kmPx;
      const steps = 28; let x = p.x, y = p.y, an = ang;
      for (let s = 0; s < steps; s++) {
        const f = s / steps;
        const nx = x + Math.cos(an) * len / steps, ny = y + Math.sin(an) * len / steps;
        an += (r() - 0.5) * 0.22;
        const I = Math.pow(1 - f, 2.2) * Math.min(0.6, 0.18 + 0.1 * Math.log10(p.pop / 1e4));
        g.strokeStyle = `rgba(0,0,255,${(0.9 * I).toFixed(3)})`;
        g.lineWidth = Math.max(1.0, (0.06 + 0.06 * (1 - f)) * kmPx);
        g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        x = nx; y = ny;
      }
    }
    // ring road for the big ones
    if (p.pop > 3e6) {
      g.strokeStyle = 'rgba(0,0,255,0.32)'; g.lineWidth = Math.max(1.0, 0.08 * kmPx);
      g.beginPath();
      for (let k = 0; k <= 64; k++) { const an = k / 64 * 6.283; const rr = radKm * 0.24 * kmPx * (1 + 0.06 * Math.sin(an * 3 + p.x)); const q = [p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr]; k ? g.lineTo(...q) : g.moveTo(...q); }
      g.stroke();
    }
  }
  return c;
}

function densityCanvas(P, F, uvOf, places) {
  const N = 1024, c = document.createElement('canvas'); c.width = N; c.height = N;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  g.globalCompositeOperation = 'lighter';
  const kmPx = N / P.sizeKm;
  const blob = (x, y, rad, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,0,0,${a.toFixed(3)})`); gr.addColorStop(0.45, `rgba(255,0,0,${(a * 0.45).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
  };
  for (const p of places) {
    const x = p.u * N, y = (1 - p.v) * N;
    const radKm = 2.0 * Math.pow(p.pop / 1e4, 0.42);
    blob(x, y, radKm * kmPx * 1.1, Math.min(0.95, 0.42 + 0.16 * Math.log10(p.pop / 1e4)));
    // green channel: "core" (LED) fraction for dense centres
    if (p.pop > 4e5) {
      const gr = g.createRadialGradient(x, y, 0, x, y, radKm * kmPx * 0.5);
      gr.addColorStop(0, `rgba(0,255,0,${Math.min(0.9, 0.2 * Math.log10(p.pop / 1e5)).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,255,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, radKm * kmPx * 0.5, 0, 6.283); g.fill();
    }
  }
  if (P.coast) {
    // settlements crowd the shore: a soft band of density along the (fractal) coastline
    const px = (lon, lat) => { const [u, v] = uvOf(lon, lat); return [u * N, (1 - v) * N]; };
    g.lineJoin = 'round';
    for (const [w, a] of [[9, 0.35], [3.5, 0.6]]) {
      g.strokeStyle = `rgba(255,0,0,${(a * P.coast).toFixed(3)})`; g.lineWidth = w * kmPx;
      for (const r of LAND) {
        let near = false;
        for (let i = 0; i < r.length; i += 2) { const [u, v] = uvOf(r[i], r[i + 1]); if (u > -0.2 && u < 1.2 && v > -0.2 && v < 1.2) { near = true; break; } }
        if (!near) continue;
        // stroke only segments whose ends are both near the patch (a ring that jumps across the
        // antimeridian or folds round the globe must not draw a chord through the patch)
        const inN = (lon, lat) => { const [u, v] = uvOf(lon, lat); return u > -0.3 && u < 1.3 && v > -0.3 && v < 1.3; };
        g.beginPath();
        for (let i = 0; i < r.length; i += 2) {
          const j = (i + 2) % r.length;
          if (!inN(r[i], r[i + 1]) || !inN(r[j], r[j + 1]) || Math.abs(r[j] - r[i]) > 5) continue;
          g.moveTo(...px(r[i], r[i + 1])); g.lineTo(...px(r[j], r[j + 1]));
        }
        g.stroke();
      }
    }
  }
  if (P.nile) {
    // the Nile valley ribbon and the densely farmed delta fan (villages everywhere between the branches)
    const px = (lon, lat) => { const [u, v] = uvOf(lon, lat); return [u * N, (1 - v) * N]; };
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, a] of [[10, 0.08], [4, 0.14]]) {
      g.strokeStyle = `rgba(255,0,0,${a})`; g.lineWidth = w * kmPx;
      for (const line of [NILE_MAIN, NILE_ROSETTA, NILE_DAMIETTA]) { g.beginPath(); g.moveTo(...px(...line[0])); for (const q of line) g.lineTo(...px(...q)); g.stroke(); }
    }
    const fan = new Path2D();
    fan.moveTo(...px(31.12, 30.15)); for (const q of NILE_ROSETTA) fan.lineTo(...px(q[0] - 0.12, q[1]));
    fan.lineTo(...px(30.9, 31.5)); fan.lineTo(...px(31.5, 31.45)); fan.lineTo(...px(32.15, 31.25));
    for (const q of NILE_DAMIETTA.slice().reverse()) fan.lineTo(...px(q[0] + 0.15, q[1])); fan.closePath();
    // a low even floor of farm hamlets …
    g.fillStyle = 'rgba(255,0,0,0.34)'; g.filter = 'blur(4px)'; g.fill(fan); g.filter = 'none';
    // … and a hierarchy of market towns on top (denser and brighter along the two branches)
    const rr = rng(P.seed * 31 + 5);
    const town = (x, y, radKm, a) => {
      const rad = Math.max(1.2, radKm * kmPx);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(255,0,0,${a.toFixed(3)})`); gr.addColorStop(0.5, `rgba(255,0,0,${(a * 0.35).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
    };
    const [bx0, by0] = px(29.7, 31.7), [bx1, by1] = px(32.4, 29.9);
    for (let i = 0, made = 0; i < 20000 && made < 520; i++) {
      const x = bx0 + (bx1 - bx0) * rr(), y = by0 + (by1 - by0) * rr();
      if (!g.isPointInPath(fan, x, y)) continue;
      made++; town(x, y, 2.0 * Math.exp(rr.gauss() * 0.45), 0.12 + 0.3 * Math.pow(rr(), 2));
    }
    for (const br of [NILE_ROSETTA, NILE_DAMIETTA, NILE_MAIN.slice(-4)]) {
      for (let s2 = 0; s2 < br.length - 1; s2++) for (let k = 0; k < 9; k++) {
        const t = rr(), a = br[s2], b = br[s2 + 1];
        const [x, y] = px(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
        town(x + rr.gauss() * 2.5 * kmPx, y + rr.gauss() * 2.5 * kmPx, 2.6 * Math.exp(rr.gauss() * 0.4), 0.18 + 0.3 * rr());
      }
    }
  }
  // soften
  const c2 = document.createElement('canvas'); c2.width = N; c2.height = N; const g2 = c2.getContext('2d');
  g2.filter = 'blur(3px)'; g2.drawImage(c, 0, 0);
  return c2;
}

const BAKE = /* glsl */ `
uniform sampler2D vecT, denT; uniform float sizeKm, texKm, fleet, seed, nile, rural, roadGain, warpKm, glowK;
// 2D Voronoi (3×3): returns (F1, approximate distance to the nearest cell edge) in cell units
vec2 vor(vec2 x, float sd){
  vec2 n = floor(x), f = fract(x); float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 o = hash22(n + g + sd);
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return vec2(sqrt(f1), 0.5 * (sqrt(f2) - sqrt(f1)));
}
// point lights on a jittered lattice; presence ∝ density; returns summed gaussian (texel-sized PSF)
float dots(vec2 x, float cellKm, float pres, float psfKm, float sd, out float hue){
  vec2 q = x / cellKm; vec2 n = floor(q); float s = 0.0; hue = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = n + vec2(float(i), float(j));
    vec3 h = hash33(vec3(c, sd));
    if (h.z > pres) continue;
    vec2 p = (c + 0.15 + 0.7 * h.xy) * cellKm;
    float d2 = dot(x - p, x - p) / (psfKm * psfKm);
    float b = exp(-d2) * (0.35 + 1.3 * pow(fract(h.x * 13.7 + h.y * 7.1), 3.0));
    s += b; hue += b * fract(h.y * 31.3);
  }
  hue = s > 0.0 ? hue / s : 0.5;
  return s;
}
void main(){
  vec2 uv = vUv; vec2 p = (uv - 0.5) * sizeKm;              // km, east / north
  vec4 vt = texture2D(vecT, uv);
  float land = vt.r, river = vt.g, road = vt.b;
  // irregular town outlines: the splatted (round) density field is looked up through a domain warp
  vec2 wq = warpKm * (vec2(vnoise(p * 0.08 + seed * 3.3), vnoise(p * 0.08 + seed * 5.9 + 11.0)) - 0.5)
          + 0.4 * warpKm * (vec2(vnoise(p * 0.3 + seed), vnoise(p * 0.3 + seed + 4.0)) - 0.5);
  vec4 dn = texture2D(denT, uv + wq / sizeKm);
  float D = dn.r, core = dn.g;
  // rural floor: scattered villages between the towns (Europe, Campania, Korea are settled everywhere)
  D = max(D, rural * smoothstep(0.25, 0.8, vnoise(p * 0.045 + seed * 4.1)) * (0.6 + 0.4 * vnoise(p * 0.2 + seed)));
  float px = texKm;                                          // one texel in km: the PSF floor
  vec3 SOD = vec3(1.0, 0.456, 0.102), LED = vec3(0.807, 0.871, 1.0), WARM = vec3(1.0, 0.62, 0.30);
  vec3 col = vec3(0.0);
  if (D > 0.002 || road > 0.004) {
    vec2 w = p + 0.9 * vec2(vnoise(p * 0.21 + seed), vnoise(p * 0.21 + 17.0 + seed)) - 0.45;
    // break the splatted blobs into irregular sprawl (lobes, gaps, fingers along valleys)
    float lob = vnoise(p * 0.09 + seed * 1.7) * 0.78 + vnoise(p * 0.31 + seed * 2.3) * 0.22;
    float Dm = D * (0.55 + 0.9 * lob);
    if (nile > 0.5) Dm = D * (0.8 + 0.4 * lob);               // the delta is farmed evenly: no big lobes
    // street blocks: coarse (suburbs) + fine (dense core) Voronoi edges, line width ≥ 1 texel
    vec2 v1 = vor(w / 0.6, seed), v2 = vor(w / 0.2, seed + 3.0);
    float lw = max(px * 0.7, 0.02);
    float e1 = exp(-pow(v1.y * 0.6 / lw, 2.0)), e2 = exp(-pow(v2.y * 0.2 / lw, 2.0));
    // band-limit: when a block is only a few texels wide, replace its edges by their mean coverage
    e1 = mix(2.4 * lw / 0.6, e1, smoothstep(2.5, 6.0, 0.6 / px));
    e2 = mix(2.4 * lw / 0.2, e2, smoothstep(2.5, 6.0, 0.2 / px));
    float dense = smoothstep(0.35, 0.95, Dm);
    // brightness follows density continuously (no thresholds that flatten towns into plateaus):
    //   glow    = the unresolved street grid, ∝ density² and broken by sub-km grain
    //   streets = resolved block edges, only where blocks are large enough and dense enough
    //   vil     = discrete point lights: hamlets in the countryside, a finer layer in towns
    float glow = pow(Dm, 2.2) * 0.5 * glowK * (0.55 + 0.9 * vnoise(p * 3.1 + seed * 7.0));
    float streets = (e1 * (1.0 - dense * 0.5) + e2 * dense) * smoothstep(0.3, 0.85, Dm) * Dm * 0.8;
    streets *= 0.45 + 0.55 * vnoise(p * 1.7 + seed);          // lamps are not a continuous tube
    float hue, hue2;
    float vil = dots(p, 1.15, clamp(Dm * 1.6, 0.0, 0.9), max(px * 0.8, 0.07), seed + 9.0, hue) * (0.35 + 1.1 * Dm)
              + dots(p, 0.42, clamp((Dm - 0.25) * 1.5, 0.0, 0.8), max(px * 0.8, 0.05), seed + 13.0, hue2) * 0.45 * Dm;
    float park = 1.0 - 0.55 * smoothstep(0.58, 0.82, vnoise(p * 0.55 + seed * 3.0)) * smoothstep(0.6, 0.9, Dm) * (1.0 - nile);
    float rd = roadGain * road * (0.3 + 0.7 * smoothstep(0.35, 0.65, vnoise(p * 1.9 + seed * 5.0)));   // highways read as strings of lamps
    float I = (glow + streets + vil * 0.6 + rd * (0.9 + 0.8 * Dm)) * park;
    vec3 c = mix(SOD, WARM, 0.35 * hue);
    c = mix(c, LED, smoothstep(0.15, 0.6, core) * 0.75 * dense);
    col = c * I;
  }
  col *= land * (1.0 - 0.95 * river);
  // banks of the Nile are the brightest strings of all (lights crowd the water)
  if (fleet > 0.5) {
    // squid-fishing fleets: bands and clots of very bright lamps on open water (> 15 km offshore)
    float off = 1.0 - smoothstep(0.0, 0.25, land);
    vec2 q = p * vec2(0.0042, 0.0105); q += 0.8 * vec2(vnoise(p * 0.006 + 3.0), vnoise(p * 0.006 + 9.0));
    float band = smoothstep(0.52, 0.72, vnoise(q * 3.0) * 0.65 + vnoise(q * 7.0) * 0.35);
    float hue;
    float boats = dots(p, 3.2, band * 0.8, max(px * 0.9, 0.12), seed + 21.0, hue);
    // each boat burns hundreds of kilowatts of lamps: brilliant points (they bloom into a constellation)
    col += mix(vec3(1.0, 0.56, 0.17), vec3(1.0, 0.85, 0.6), hue) * boats * 26.0 * off;
  }
  gl_FragColor = vec4(col, land);
}`;

const VS_UV = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function createPatchBank(ctx) {
  const { renderer } = ctx;
  const cache = {};
  function bakePatch(key) {
    const P = PATCHES[key]; const F = frameOf(P); const uvOf = makeUV(F);
    const N = P.res;
    const places = [];
    for (const [lo, la, pop] of PLACES) {
      if (Math.abs(la - P.lat) > 12 || Math.abs(((lo - P.lon + 540) % 360) - 180) > 16) continue;
      const [u, v] = uvOf(lo, la);
      if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) continue;
      places.push({ u, v, x: u * N, y: (1 - v) * N, pop });
    }
    const vc = vectorCanvas(P, F, uvOf, places), dc = densityCanvas(P, F, uvOf, places);
    const vt = new THREE.CanvasTexture(vc), dt = new THREE.CanvasTexture(dc);
    for (const t of [vt, dt]) { t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
    const rt = new THREE.WebGLRenderTarget(N, N, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true,   // mip chain = band-limiting
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    });
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS_UV, fragmentShader: GLSL.all + '\nvarying vec2 vUv;\n' + BAKE, depthTest: false, depthWrite: false,
      uniforms: { vecT: { value: vt }, denT: { value: dt }, sizeKm: { value: P.sizeKm }, texKm: { value: P.sizeKm / N }, fleet: { value: P.fleet ? 1 : 0 }, nile: { value: P.nile ? 1 : 0 }, rural: { value: P.rural || 0 }, seed: { value: P.seed }, roadGain: { value: P.roadGain ?? 1 }, warpKm: { value: P.warpKm ?? 0 }, glowK: { value: P.glow ?? 1 } },
    });
    const fsq = new FSQ(mat);
    const prev = renderer.getRenderTarget();
    // bake in horizontal strips (keeps every draw short on the software rasteriser)
    const strips = 8;
    rt.scissorTest = true;
    for (let s = 0; s < strips; s++) {
      rt.scissor.set(0, s * N / strips, N, N / strips); rt.viewport.set(0, 0, N, N);
      fsq.render(renderer, rt);
    }
    rt.scissorTest = false;
    renderer.setRenderTarget(prev);
    mat.dispose(); vt.dispose(); dt.dispose();
    rt.texture.anisotropy = 8;
    return { key, tex: rt.texture, c: F.c, e: F.e, n: F.n, half: F.half, res: N, uvOf, P, gain: P.gain ?? 1 };
  }
  return {
    get(key) { if (!cache[key]) cache[key] = bakePatch(key); return cache[key]; },
    frame(key) { return frameOf(PATCHES[key]); },
  };
}
