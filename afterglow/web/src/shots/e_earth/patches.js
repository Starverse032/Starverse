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
  // legacyGrid: S18 only ever sees Nairobi's streets unresolved (mean-coverage branch); it keeps the
  // first-cut street model so S18 stays bit-identical (polish note: the resolved grid read as graph paper)
  nairobi: { lon: 36.8, lat: -1.3, sizeKm: 320, edge: 0.42, res: 4096, seed: 11, legacyGrid: true, rural: 0.05, roadGain: 0.45, radLen: 0.6, warpKm: 3.5, glow: 0.8, gain: 1.8, darkPoly: [[[36.77, -1.325], [36.86, -1.315], [36.93, -1.33], [36.965, -1.37], [36.93, -1.43], [36.84, -1.425], [36.78, -1.39]]] },
  // delta: villages are discrete point lights strung along the branches and canals (pointsCanvas), not
  // density blobs; Cairo's sprawl and LED core are held down so it is a city, not a blown white ball
  delta:   { lon: 31.0, lat: 30.45, sizeKm: 680, res: 4096, seed: 12, nile: true, coast: 0.3, gain: 0.7, cityR: 0.62, coreK: 0.3, glow: 0.75 },
  naples:  { lon: 14.2, lat: 40.95, sizeKm: 300, res: 4096, seed: 13, coast: 1.0, rural: 0.34, gain: 1.35, roadGain: 0.55, dark: [[14.426, 40.821, 3.6]] },
  paris:   { lon: 2.35, lat: 48.86, sizeKm: 120, res: 4096, seed: 14, rivers: [SEINE], rural: 0.15 },
  europe:  { lon: 6.6, lat: 50.9, sizeKm: 900, res: 4096, seed: 15, rural: 0.26, gain: 1.35, roadGain: 1.7, radLen: 0.55 },
  fishing: { lon: 130.3, lat: 37.0, sizeKm: 560, res: 4096, seed: 16, fleet: true, fleetAt: [129.86, 36.235], coast: 0.8, rural: 0.12, gain: 1.4 },
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
  // (0.3 km: the water plus its unlit quays and banks — the dark corridor a city river is from orbit)
  for (const rv of P.rivers || []) rivers.push([rv, 0.3]);
  // unlit ground polygons (G channel): Nairobi National Park, the dark wedge under the city
  for (const poly of P.darkPoly || []) {
    const pts = fractalize(poly.map(q => px(q[0], q[1])).concat([px(poly[0][0], poly[0][1])]), 3, 0.14, N);
    g.fillStyle = 'rgb(0,230,0)'; g.beginPath(); g.moveTo(...pts[0]); for (const q of pts) g.lineTo(...q); g.closePath(); g.fill();
  }
  // unlit ground (G channel): Vesuvius' cone is a dark disc ringed by the towns on its flanks
  for (const [dlon, dlat, rKm] of P.dark || []) {
    const [x, y] = px(dlon, dlat), rr = rKm * kmPx;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, 'rgba(0,255,0,1)'); gr.addColorStop(0.6, 'rgba(0,255,0,0.9)'); gr.addColorStop(1, 'rgba(0,255,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  // rivers: a soft dark band (blurred ~0.5 width, ≤ 85 % dark at its axis), never a hard black line —
  // the shader adds an fbm variation along it; the patch mips band-limit it further per footprint
  for (const [line, wkm] of rivers) {
    const pts = fractalize(line.map(p => px(p[0], p[1])), 3, 0.09, N);
    g.strokeStyle = 'rgba(0,255,0,0.95)'; g.lineWidth = Math.max(1.2, wkm * kmPx);
    g.filter = `blur(${Math.max(1, 0.45 * wkm * kmPx).toFixed(1)}px)`;
    g.beginPath(); g.moveTo(...pts[0]); for (const p of pts) g.lineTo(...p); g.stroke();
    g.filter = 'none';
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
    const radKm = Math.min(21, 2.2 * Math.pow(p.pop / 1e4, 0.42));
    // radial arterials: only real cities get a star of avenues (a 30 000-person town with eight
    // spokes reads as an asterisk); they start a little out from the centre (no single bright hub),
    // swell to full brightness at ~20 % of their length and then fade into the countryside
    const lp = Math.log10(p.pop / 1e4);
    const nR = p.pop < 1e5 ? 2 + (r() < 0.5 ? 1 : 0) : Math.min(9, 3 + Math.floor(lp * 2.0));
    const a0 = r() * 6.283;
    for (let k = 0; k < nR; k++) {
      const ang = a0 + k * 6.283 / nR + (r() - 0.5) * 0.7;
      const len = radKm * (0.9 + r() * 0.7) * (P.radLen ?? 1) * kmPx * (p.pop < 1e5 ? 0.6 : 1);
      const steps = 28; let an = ang;
      let x = p.x + Math.cos(an) * radKm * 0.12 * kmPx, y = p.y + Math.sin(an) * radKm * 0.12 * kmPx;
      for (let s = 0; s < steps; s++) {
        const f = s / steps;
        const nx = x + Math.cos(an) * len / steps, ny = y + Math.sin(an) * len / steps;
        an += (r() - 0.5) * 0.3;
        const I = Math.min(1, f / 0.2) * Math.pow(1 - f, 2.6) * Math.min(0.45, 0.12 + 0.09 * lp) * (p.pop < 1e5 ? 0.6 : 1);
        g.strokeStyle = `rgba(0,0,255,${(0.9 * I).toFixed(3)})`;
        g.lineWidth = Math.max(1.0, (0.05 + 0.04 * (1 - f)) * kmPx);
        g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        x = nx; y = ny;
      }
    }
    // ring road for the big ones
    if (p.pop > 3e6) {
      g.strokeStyle = 'rgba(0,0,255,0.22)'; g.lineWidth = Math.max(1.0, 0.07 * kmPx);
      g.beginPath();
      const ph = [r() * 6.3, r() * 6.3, r() * 6.3];
      for (let k = 0; k <= 96; k++) {
        const an = k / 96 * 6.283;
        const rr = radKm * 0.3 * kmPx * (1 + 0.1 * Math.sin(an * 2 + ph[0]) + 0.06 * Math.sin(an * 3 + ph[1]) + 0.04 * Math.sin(an * 5 + ph[2]));
        const q = [p.x + Math.cos(an) * rr * 1.15, p.y + Math.sin(an) * rr * 0.87]; k ? g.lineTo(...q) : g.moveTo(...q);
      }
      g.stroke();
    }
  }
  return c;
}

function densityCanvas(P, F, uvOf, places) {
  const N = 2048, c = document.createElement('canvas'); c.width = N; c.height = N;
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
    const radKm = Math.min(19, 2.0 * Math.pow(p.pop / 1e4, 0.42)) * (P.cityR ?? 1);     // megacities: ~40 km across, not 80
    blob(x, y, radKm * kmPx * 1.1, Math.min(0.95, 0.42 + 0.16 * Math.log10(p.pop / 1e4)));
    // green channel: "core" (LED) fraction for dense centres
    if (p.pop > 4e5) {
      const gr = g.createRadialGradient(x, y, 0, x, y, radKm * kmPx * 0.5);
      gr.addColorStop(0, `rgba(0,255,0,${(Math.min(0.9, 0.2 * Math.log10(p.pop / 1e5)) * (P.coreK ?? 1)).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,255,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, radKm * kmPx * 0.5, 0, 6.283); g.fill();
    }
  }
  if (P.coast) {
    // settlements crowd the shore: a soft band of density along the (fractal) coastline
    const px = (lon, lat) => { const [u, v] = uvOf(lon, lat); return [u * N, (1 - v) * N]; };
    g.lineJoin = 'round';
    for (const [w, a] of [[9, 0.35], [3.5, 0.6]]) {
      g.strokeStyle = `rgba(255,0,0,${(a * P.coast).toFixed(3)})`; g.lineWidth = w * kmPx;
      g.filter = `blur(${(0.3 * w * kmPx).toFixed(1)}px)`;                // a shore band fades inland, it has no inner edge
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
  g.filter = 'none';
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
    g.fillStyle = 'rgba(255,0,0,0.2)'; g.filter = 'blur(8px)'; g.fill(fan); g.filter = 'none';
    // (the villages and market towns are point lights in pointsCanvas: as density blobs they read as
    //  'cauliflower' at the S19 footprint)
  }
  // soften
  const c2 = document.createElement('canvas'); c2.width = N; c2.height = N; const g2 = c2.getContext('2d');
  g2.filter = 'blur(2px)'; g2.drawImage(c, 0, 0);
  return c2;
}

// S19 (polish note 3): the delta's villages as discrete point lights at patch resolution, strung along
// the hand-entered Rosetta / Damietta branches, the main stem and a web of synthetic distributary canals
// (fractal polylines fanning north between the branches), plus a sparse dim scatter of hamlets between
// them. Each light is a ~1–3 texel gaussian (the patch mips band-limit it per footprint), so from S19's
// 1000 km the branches read as lines of lights and the fan as a fine mesh — no soft blobs.
function pointsCanvas(P, F, uvOf) {
  const N = P.nile ? P.res : 1, c = document.createElement('canvas'); c.width = N; c.height = N;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  if (!P.nile) return c;
  g.globalCompositeOperation = 'lighter';
  const kmPx = N / P.sizeKm;
  const px = (lon, lat) => { const [u, v] = uvOf(lon, lat); return [u * N, (1 - v) * N]; };
  const rr = rng(P.seed * 53 + 3);
  const dot = (x, y, radKm, a) => {
    const rad = Math.max(1.3, radKm * kmPx);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,0,0,${Math.min(1, a).toFixed(3)})`); gr.addColorStop(0.45, `rgba(255,0,0,${(Math.min(1, a) * 0.3).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
  };
  const fan = new Path2D();
  fan.moveTo(...px(31.12, 30.15)); for (const q of NILE_ROSETTA) fan.lineTo(...px(q[0] - 0.12, q[1]));
  fan.lineTo(...px(30.9, 31.5)); fan.lineTo(...px(31.5, 31.45)); fan.lineTo(...px(32.15, 31.25));
  for (const q of NILE_DAMIETTA.slice().reverse()) fan.lineTo(...px(q[0] + 0.15, q[1])); fan.closePath();
  // string villages along a polyline (px coordinates): both banks, every ~spKm, jittered off the bank
  const string = (pts, spKm, offKm, bright) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const L = Math.hypot(x1 - x0, y1 - y0); if (L < 1e-3) continue;
      const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const n = Math.max(1, Math.round(L / (spKm * kmPx)));
      for (let k = 0; k < n; k++) {
        const t = (k + rr()) / n, side = rr() < 0.5 ? -1 : 1;
        const off = side * offKm * kmPx * (0.35 + Math.abs(rr.gauss()) * 0.8);
        const x = x0 + (x1 - x0) * t + nx * off, y = y0 + (y1 - y0) * t + ny * off;
        const big = rr() < 0.08;
        dot(x, y, big ? 0.45 : 0.2 + 0.1 * rr(), bright * (big ? 1.0 : 0.45 + 0.55 * rr() * rr()));
      }
    }
  };
  const fr = line => fractalize(line.map(q => px(q[0], q[1])), 2.5, 0.08, N);
  // the two branches and the stem below the apex (the lotus' stem): the brightest strings
  for (const br of [NILE_ROSETTA, NILE_DAMIETTA]) { string(fr(br), 0.3, 0.8, 1.0); string(fr(br), 0.6, 2.2, 0.7); }
  string(fr(NILE_MAIN.slice(-6)), 0.4, 1.4, 0.9);
  // distributary canals: from points on the branches / apex, meandering north towards the coast
  const canals = [];
  const along = (line, t) => { const f = t * (line.length - 1), i = Math.min(line.length - 2, Math.floor(f)), u = f - i; return [line[i][0] + (line[i + 1][0] - line[i][0]) * u, line[i][1] + (line[i + 1][1] - line[i][1]) * u]; };
  // (they leave the branches at all heights — never all from the apex, which reads as a broom)
  for (let k = 0; k < 18; k++) {
    const tLon = 30.5 + 1.3 * ((k + 0.5) / 18) + (rr() - 0.5) * 0.1, tLat = 31.25 + 0.2 * rr();
    const src = tLon < 31.1 ? NILE_ROSETTA : NILE_DAMIETTA;
    let [lon, lat] = along(src, 0.15 + 0.6 * rr());
    // head for a point on the coast between (and a little outside) the branches
    const pts = [[lon, lat]]; let hd = Math.atan2(tLat - lat, (tLon - lon) * 0.857);
    for (let s2 = 0; s2 < 60 && lat < tLat; s2++) {
      const want = Math.atan2(tLat - lat, (tLon - lon) * 0.857);
      hd += 0.35 * (want - hd) + (rr() - 0.5) * 0.5;
      lon += Math.cos(hd) * 0.03 / 0.857; lat += Math.sin(hd) * 0.03;
      pts.push([lon, lat]);
    }
    canals.push(pts);
  }
  for (const cl of canals) {
    const pp = fractalize(cl.map(q => px(q[0], q[1])), 3, 0.1, N).filter(q => g.isPointInPath(fan, q[0], q[1]));
    if (pp.length > 2) string(pp, 0.6, 0.9, 0.6);
  }
  // sparse dim hamlets over the whole fan (the farmland between the canals is not empty, just dimmer)
  const [bx0, by0] = px(29.7, 31.7), [bx1, by1] = px(32.4, 29.9);
  for (let i = 0, made = 0; i < 90000 && made < 5200; i++) {
    const x = bx0 + (bx1 - bx0) * rr(), y = by0 + (by1 - by0) * rr();
    if (!g.isPointInPath(fan, x, y)) continue;
    made++; dot(x, y, 0.18, 0.2 + 0.4 * rr() * rr());
  }
  return c;
}

const BAKE = /* glsl */ `
uniform sampler2D vecT, denT, ptsT; uniform vec2 fleetT; uniform float sizeKm, texKm, fleet, seed, nile, rural, roadGain, warpKm, glowK, legacy;
// Voronoi with the exact distance to the cell border (two-pass): (border distance, cell id) in cell units
vec2 vorB(vec2 x, float sd){
  vec2 n = floor(x), f = fract(x), mg = vec2(0.0), mr = vec2(0.0); float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 r = g + hash22(n + g + sd) - f; float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j)); vec2 r = g + hash22(n + g + sd) - f;
    if (dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return vec2(md, hash12(n + mg + sd * 1.7));
}
// 2D Voronoi (3×3): returns (F1, approximate distance to the nearest cell edge) in cell units
vec4 vor(vec2 x, float sd){     // (F1, distance to the nearest edge, id of the cell, id of the edge)
  vec2 n = floor(x), f = fract(x); float f1 = 8.0, f2 = 8.0; float id = 0.0, id2 = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 o = hash22(n + g + sd);
    vec2 r = g + o - f; float d = dot(r, r);
    float h = fract(o.x * 17.13 + o.y * 3.71);
    if (d < f1) { f2 = f1; id2 = id; f1 = d; id = h; } else if (d < f2) { f2 = d; id2 = h; }
  }
  return vec4(sqrt(f1), 0.5 * (sqrt(f2) - sqrt(f1)), id, fract((id + id2) * 37.7 + id * id2 * 11.3));
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
    float b = exp(-d2) * (0.2 + 2.6 * pow(fract(h.x * 13.7 + h.y * 7.1), 5.0));
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
    // urban fabric (the "chessboard"): Voronoi districts ~1.3 km across, each with its own street
    // grid (orientation and block size from the district's hash: 110–210 m blocks) — like a real
    // city's quarters laid out at different times — bounded by brighter arterials along the district
    // edges. Blocks carry their own brightness (housing, a dark rail yard, a floodlit depot).
    // Lines are never thinner than a texel and are replaced by their mean coverage once a block
    // spans only a few texels (band-limited for every footprint the patch is seen at).
    vec4 dv = vor(w / 1.3, seed + 5.0);
    float lw = max(px * 0.6, 0.012);
    float kd = smoothstep(2.5, 6.0, 1.3 / px);
    float gl, bh, kg;
    if (legacy > 0.5) {
      // first-cut model (Nairobi / S18 only, always unresolved there): per-district rotated grids
      float th = dv.z * 3.14159, sp = (0.11 + 0.10 * fract(dv.z * 7.31)) * mix(1.0, 0.7, smoothstep(0.6, 1.0, D));
      vec2 rq = mat2(cos(th), -sin(th), sin(th), cos(th)) * w / sp;
      vec2 fq = fract(rq); vec2 dl = (0.5 - abs(fq - 0.5)) * sp;     // km to the nearest grid line, per axis
      kg = smoothstep(2.5, 5.0, sp / px);
      gl = max(exp(-pow(dl.x / lw, 2.0)), exp(-pow(dl.y / lw, 2.0)));
      gl = mix(min(1.0, 3.4 * lw / sp), gl, kg);
      bh = hash12(floor(rq) + dv.z * 91.0);
    } else {
      // streets = density-seeded Voronoi edges + domain warp (screenplay §3: no hash-rotated grids).
      // Two street networks — collector streets (~420 m cells) everywhere in town, local streets
      // (~170 m cells) faded in with density, so the mesh tightens towards the centre — both seen
      // through a fine warp (streets bend; no straight graph-paper runs). Each line is a texel-wide
      // gaussian of the exact border distance; once a cell spans only a few texels it is replaced by
      // its mean coverage (band-limited for every footprint the patch is seen at).
      vec2 ws = w + 0.06 * vec2(vnoise(p * 3.1 + seed * 2.0), vnoise(p * 3.1 + seed * 2.0 + 23.0)) - 0.03;
      float s1 = 0.42, s2 = 0.17;
      vec2 v1 = vorB(ws / s1, seed + 31.0), v2 = vorB(ws / s2, seed + 47.0);
      float k1 = smoothstep(2.5, 5.0, s1 / px), k2 = smoothstep(2.5, 5.0, s2 / px);
      float g1 = mix(min(1.0, 3.4 * lw / s1), exp(-pow(v1.x * s1 / lw, 2.0)), k1);
      float g2 = mix(min(1.0, 3.4 * lw / s2), exp(-pow(v2.x * s2 / lw, 2.0)), k2);
      float wl = smoothstep(0.45, 0.85, D);                     // local streets only where the town is dense
      gl = max(g1 * (0.7 + 0.3 * fract(v1.y * 13.1)), g2 * wl * (0.55 + 0.45 * fract(v2.y * 7.7)));
      kg = mix(k1, k2, wl);
      bh = v2.y;                                                // per-block brightness at the fine (local) scale
    }
    // only some district edges are arterials (a city is not a turtle shell), the rest are ordinary streets
    float artW = dv.w < 0.42 ? 1.0 : 0.22;
    float art = exp(-pow(dv.y * 1.3 / (lw * 1.6), 2.0));
    art = mix(min(1.0, 4.0 * lw / 1.3), art, kd) * artW;
    art *= smoothstep(0.5, 0.9, Dm);                          // arterials belong to the dense city, not to every hamlet
    // unresolved blocks: each district keeps its own mean brightness (a mottled patchwork of quarters
    // instead of a smooth glow); resolved: per-block variation (sparse fringe: no mosaic)
    float blkU = mix(0.6, 0.25 + 0.9 * fract(dv.z * 5.37), kd);
    float blkR = legacy > 0.5 ? mix(0.45 + 0.4 * bh, 0.12 + 1.2 * bh * bh, smoothstep(0.35, 0.8, Dm))
                              : mix(0.6 + 0.2 * bh, 0.2 + 1.0 * bh * bh, smoothstep(0.5, 0.9, Dm));   // quiet fringe: no mosaic
    float blk = mix(blkU, blkR, kg);
    float dense = smoothstep(0.35, 0.95, Dm);
    // brightness follows density continuously (no thresholds that flatten towns into plateaus):
    //   glow    = lit blocks (the unresolved fabric), ∝ density² × block brightness × grain
    //   streets = the street grid + district arterials, where the town is dense enough to have them
    //   vil     = discrete point lights: hamlets in the countryside, a finer layer in towns
    float grain = 0.5 + 1.0 * vnoise(p * 2.3 + seed * 7.0) * (0.5 + vnoise(p * 7.9 + seed * 3.0));
    // a town has an edge: the built-up fabric switches on over a narrow density range (lobed by the
    // warp above), outside it only scattered lamps remain — no soft "galaxy" halo of light
    float urb = smoothstep(0.16, 0.5, Dm);
    float glow = pow(Dm, 1.7) * urb * 0.32 * glowK * grain * blk;
    float streets = (gl * 0.55 + art * 1.1) * smoothstep(0.42, 0.9, Dm) * Dm;
    streets *= 0.45 + 0.55 * vnoise(p * 1.7 + seed) * (0.6 + 0.8 * vnoise(p * 9.0 + seed));   // lamps are not a continuous tube
    float hue, hue2;
    float vil = dots(p, 1.15, clamp(Dm * 1.6 - 0.04, 0.0, 0.9), max(px * 0.8, 0.04), seed + 9.0, hue) * (0.35 + 1.1 * Dm)
              + dots(p, 0.42, clamp((Dm - 0.25) * 1.5, 0.0, 0.8), max(px * 0.8, 0.035), seed + 13.0, hue2) * 0.55 * Dm;
    float park = 1.0 - 0.55 * smoothstep(0.58, 0.82, vnoise(p * 0.55 + seed * 3.0)) * smoothstep(0.6, 0.9, Dm) * (1.0 - nile);
    float rd = roadGain * road * (0.3 + 0.7 * smoothstep(0.35, 0.65, vnoise(p * 1.9 + seed * 5.0)));   // highways read as strings of lamps
    float I = (glow + streets + vil * (0.6 + 0.5 * (1.0 - dense)) + rd * (0.9 + 0.8 * Dm)) * park;
    I = I / (1.0 + 0.3 * I) * 1.25;                           // soft knee: dense cores saturate like film, not into a bloom ball
    vec3 c = mix(SOD, WARM, 0.35 * hue);
    c = mix(c, LED, smoothstep(0.15, 0.6, core) * 0.55 * dense);
    col = c * I;
  }
  if (legacy < 0.5) river *= 0.75 + 0.25 * vnoise(p * 1.3 + seed * 4.0);   // the dark band varies along the river
  col *= land * (1.0 - 0.95 * river);
  // the delta's string villages (pointsCanvas): sodium, a few warmer-white
  float ptl = texture2D(ptsT, uv).r;
  if (ptl > 0.0) col += mix(SOD, WARM, 0.3 * hash12(floor(p / 0.6) + seed)) * ptl * 2.4 * land;
  // banks of the Nile are the brightest strings of all (lights crowd the water)
  if (fleet > 0.5) {
    // squid-fishing fleets: bands and clots of very bright lamps on open water (> 15 km offshore)
    float off = 1.0 - smoothstep(0.0, 0.25, land);
    vec2 q = p * vec2(0.0042, 0.0105); q += 0.8 * vec2(vnoise(p * 0.006 + 3.0), vnoise(p * 0.006 + 9.0));
    float band = smoothstep(0.52, 0.72, vnoise(q * 3.0) * 0.65 + vnoise(q * 7.0) * 0.35) * 0.3;
    // the S22A composition: two meandering fleet lanes cross the frame diagonally (WNW–ESE on the
    // ground, lower-left → upper-right on screen) through the camera's target point fleetT
    vec2 fd = vec2(-0.891, 0.454), fnrm = vec2(-fd.y, fd.x);
    vec2 fr = p - fleetT; float fs = dot(fr, fd), fo = dot(fr, fnrm);
    float o1 = fo - 6.0 * sin(fs / 21.0) - 2.5 * sin(fs / 8.0 + 1.3);
    float lane1 = exp(-pow(o1 / 4.5, 2.0)) * smoothstep(0.2, 0.55, vnoise(vec2(fs / 13.0, 3.0)));
    float o2 = fo + 22.0 - 4.0 * sin(fs / 16.0 + 2.0);
    float lane2 = exp(-pow(o2 / 3.2, 2.0)) * smoothstep(0.35, 0.7, vnoise(vec2(fs / 10.0, 9.0)));
    band = max(band, max(lane1, lane2 * 0.85));
    // boats: fully jittered (no lattice), each a brilliant point plus a faint pool of lit water
    vec3 boats = vec3(0.0);
    for (int L = 0; L < 2; L++) {
      float cell = L == 0 ? 2.1 : 1.1, pres = L == 0 ? band * 0.6 : band * band * band * 0.3;
      vec2 qq = p / cell; vec2 c0 = floor(qq);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 c = c0 + vec2(float(i), float(j));
        vec3 h = hash33(vec3(c, seed + 21.0 + float(L) * 7.0));
        if (h.z > pres) continue;
        vec2 bp = (c + 0.05 + 0.9 * h.xy) * cell;
        float d2 = dot(p - bp, p - bp);
        float b = 0.5 + 1.5 * fract(h.x * 7.3 + h.y * 3.1);
        float psf = max(px * 0.9, 0.05);
        // FISHING #FFB45A (linear 1, 0.456, 0.102) with a little lamp-to-lamp spread; HDR held low enough
        // (with S22A's knee) that the cores tone-map sodium-yellow instead of clipping white
        // (pre-saturated a little: the ACES crosstalk pulls bright sodium towards white)
        vec3 bc = mix(vec3(1.0, 0.36, 0.05), vec3(1.0, 0.44, 0.09), fract(h.y * 11.7));
        boats += bc * b * (exp(-d2 / (psf * psf)) * 4.0 + exp(-d2 / 0.09) * 0.12);
      }
    }
    col += boats * off;
  }
  gl_FragColor = vec4(col, land);
}`;

const VS_UV = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function createPatchBank(ctx) {
  const { renderer } = ctx;
  const cache = {}; let useCount = 0;
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
    const vc = vectorCanvas(P, F, uvOf, places), dc = densityCanvas(P, F, uvOf, places), pc = pointsCanvas(P, F, uvOf);
    const vt = new THREE.CanvasTexture(vc), dt = new THREE.CanvasTexture(dc), ptt = new THREE.CanvasTexture(pc);
    for (const t of [vt, dt, ptt]) { t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
    const rt = new THREE.WebGLRenderTarget(N, N, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true,   // mip chain = band-limiting
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    });
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS_UV, fragmentShader: GLSL.all + '\nvarying vec2 vUv;\n' + BAKE, depthTest: false, depthWrite: false,
      uniforms: { vecT: { value: vt }, denT: { value: dt }, fleetT: { value: new THREE.Vector2(...(P.fleetAt ? uvOf(...P.fleetAt).map(u => (u - 0.5) * P.sizeKm) : [0, 0])) }, sizeKm: { value: P.sizeKm }, texKm: { value: P.sizeKm / N }, fleet: { value: P.fleet ? 1 : 0 }, nile: { value: P.nile ? 1 : 0 }, rural: { value: P.rural || 0 }, seed: { value: P.seed }, roadGain: { value: P.roadGain ?? 1 }, warpKm: { value: P.warpKm ?? 0 }, glowK: { value: P.glow ?? 1 }, ptsT: { value: ptt }, legacy: { value: P.legacyGrid ? 1 : 0 } },
    });
    const fsq = new FSQ(mat);
    const prev = renderer.getRenderTarget();
    // bake in horizontal strips (keeps every draw short on the software rasteriser)
    const strips = 16;
    rt.scissorTest = true;
    for (let s = 0; s < strips; s++) {
      rt.scissor.set(0, s * N / strips, N, N / strips); rt.viewport.set(0, 0, N, N);
      fsq.render(renderer, rt);
    }
    rt.scissorTest = false;
    renderer.setRenderTarget(prev);
    mat.dispose(); vt.dispose(); dt.dispose(); ptt.dispose();
    rt.texture.anisotropy = 8;
    return { key, rt, tex: rt.texture, c: F.c, e: F.e, n: F.n, half: F.half, res: N, uvOf, P, gain: P.gain ?? 1 };
  }
  return {
    // keep at most two baked patches resident (each is a 4096² HalfFloat target with mips, ~170 MB
    // of CPU memory under SwiftShader): a worker renders the montage in order, so the cache never thrashes
    get(key) {
      if (!cache[key]) {
        const keys = Object.keys(cache);
        if (keys.length >= 2) { const old = keys.sort((a, b) => cache[a].used - cache[b].used)[0]; cache[old].rt.dispose(); delete cache[old]; }
        cache[key] = bakePatch(key);
      }
      cache[key].used = ++useCount;
      return cache[key];
    },
    frame(key) { return frameOf(PATCHES[key]); },
  };
}
