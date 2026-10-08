// S18 lights birth mask: an equirect HalfFloat texture over Africa / Europe / W Asia whose R
// channel is the moment (normalised, 0 = R_geo … ~1 = the far edge of the visible hemisphere)
// at which each place lights up. Computed once in create() as a travel-time field (8-neighbour
// Dijkstra on a 0.2° grid): slow across open land and desert, fast along the hand-entered Nile
// and its delta branches, faster along coasts (Red Sea and Mediterranean coasts fastest), slow
// but possible across narrow seas — so the light leaves R, runs down to Lake Victoria, climbs
// the Nile, fans through the delta, then runs along the Levant / North African coasts and out of
// Africa. A low-frequency value-noise jitter keeps the front from looking like a ring.
import * as THREE from 'three';
import { LAND, LAND_HOLES } from '../../data/land.js';
import { rng } from '../../lib/util.js';
import { R_GEO, RIVERS } from './geo.js';

export const BIRTH_RECT = [-40, -45, 100, 75];   // lon0, lat0, lon1, lat1
const STEP = 0.2;

function maskCanvas(GW, GH, draw) {
  const c = document.createElement('canvas'); c.width = GW; c.height = GH;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, GW, GH);
  draw(g, (lon, lat) => [(lon - BIRTH_RECT[0]) / STEP, (BIRTH_RECT[3] - lat) / STEP]);
  return g.getImageData(0, 0, GW, GH).data;
}

export function buildBirth() {
  const [lo0, la0, lo1, la1] = BIRTH_RECT;
  const GW = Math.round((lo1 - lo0) / STEP), GH = Math.round((la1 - la0) / STEP);
  const ring = (g, P, r) => { g.moveTo(...P(r[0], r[1])); for (let i = 2; i < r.length; i += 2) g.lineTo(...P(r[i], r[i + 1])); g.closePath(); };
  const land = maskCanvas(GW, GH, (g, P) => {
    g.fillStyle = '#fff'; g.beginPath(); for (const r of LAND) ring(g, P, r); g.fill('evenodd');
    g.fillStyle = '#000'; g.beginPath(); for (const r of LAND_HOLES) ring(g, P, r); g.fill();
  });
  // coast proximity (blurred land): coastal land = land with sea within ~1°
  const blur = maskCanvas(GW, GH, (g, P) => {
    g.filter = 'blur(4px)'; g.fillStyle = '#fff'; g.beginPath(); for (const r of LAND) ring(g, P, r); g.fill('evenodd');
  });
  const river = maskCanvas(GW, GH, (g, P) => {
    g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [k, line] of RIVERS.entries()) {
      g.lineWidth = k === 0 ? 5 : 3;
      g.beginPath(); g.moveTo(...P(...line[0])); for (const p of line) g.lineTo(...P(...p)); g.stroke();
    }
    // Lake Victoria shore (the light reaches the source of the Nile first)
    g.lineWidth = 4; g.beginPath(); g.arc(...P(33.0, -1.0), 1.2 / STEP, 0, Math.PI * 2); g.stroke();
  });
  const N = GW * GH;
  const cost = new Float32Array(N);
  const r = rng(1855);
  // value-noise jitter fields (bilinear lattices at ~4°, ~0.8° and ~0.3°): the travel cost varies
  // over every scale, so the front never reads as a geometric ring — it fingers ahead along easy
  // ground and lags in pockets, as settlement actually spread
  const lattice = (LW, LH) => {
    const lat = new Float32Array(LW * LH).map(() => r());
    return (x, y) => {
      const fx = x * (LW - 1), fy = y * (LH - 1), ix = Math.min(LW - 2, fx | 0), iy = Math.min(LH - 2, fy | 0), tx = fx - ix, ty = fy - iy;
      const s = t => t * t * (3 - 2 * t);
      const a = lat[iy * LW + ix], b = lat[iy * LW + ix + 1], c = lat[(iy + 1) * LW + ix], d = lat[(iy + 1) * LW + ix + 1];
      return (a + (b - a) * s(tx)) * (1 - s(ty)) + (c + (d - c) * s(tx)) * s(ty);
    };
  };
  const vn = lattice(36, 32), vn2 = lattice(176, 152), vn3 = lattice(470, 400);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x, o = i * 4;
    const lon = lo0 + (x + 0.5) * STEP, la = la1 - (y + 0.5) * STEP;
    const isLand = land[o] > 127, b = blur[o] / 255, rv = river[o] / 255;
    let k;
    if (!isLand) k = 7.0;                                         // open sea: slow but crossable (Sicily, Bosporus, Hormuz)
    else {
      k = 1.0;
      const coast = b < 0.93 ? 1 : 0;
      if (coast) {
        // Mediterranean, Red Sea and Levant coasts carry the light fastest
        const med = la > 29 && la < 46 && lon > -8 && lon < 37;
        const red = lon > 32 && lon < 44 && la > 12 && la < 30;
        k = med || red ? 0.28 : 0.5;
      }
      // Sahara / Arabian interiors: lights come late (they mostly stay dark anyway)
      const sah = la > 17 && la < 30 && lon > -12 && lon < 30 && !coast;
      const arab = la > 17 && la < 30 && lon > 42 && lon < 56 && !coast;
      if (sah || arab) k = 1.8;
      if (rv > 0.2) k = Math.min(k, 0.16 + 0.2 * (1 - rv));        // the Nile corridor
    }
    k *= (0.75 + 0.5 * vn(x / GW, y / GH)) * Math.exp(1.1 * (vn2(x / GW, y / GH) - 0.5) + 0.9 * (vn3(x / GW, y / GH) - 0.5));
    cost[i] = k;
  }
  // Dijkstra from R_geo
  const T = new Float32Array(N).fill(1e9);
  const sx = Math.round((R_GEO[0] - lo0) / STEP - 0.5), sy = Math.round((la1 - R_GEO[1]) / STEP - 0.5);
  const heap = new MinHeap(N);
  T[sy * GW + sx] = 0; heap.push(sy * GW + sx, 0);
  const D2R = Math.PI / 180;
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (heap.size) {
    const [i, ti] = heap.pop();
    if (ti > T[i]) continue;
    const x = i % GW, y = (i / GW) | 0;
    const cl = Math.cos((la1 - (y + 0.5) * STEP) * D2R);
    for (const [dx, dy] of nb) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= GW || Y >= GH) continue;
      const j = Y * GW + X;
      const len = Math.hypot(dx * cl, dy) * STEP;
      const tj = ti + len * 0.5 * (cost[i] + cost[j]);
      if (tj < T[j]) { T[j] = tj; heap.push(j, tj); }
    }
  }
  // normalise: Moscow (37.6E, 55.8N) ≈ 0.95, so the visible hemisphere is fully lit when τ ≈ 1
  const at = (lon, la) => T[Math.round((la1 - la) / STEP - 0.5) * GW + Math.round((lon - lo0) / STEP - 0.5)];
  const ref = at(37.6, 55.75) / 0.95;
  // 16-bit fixed point split over two 8-bit channels (v = (R·256 + G)·255 / 16384, range 0…4).
  // Bilinear filtering of each byte channel is linear, so the decoded value is exactly the bilinear
  // interpolation of v — and 8-bit textures filter everywhere (half-float data textures came out
  // nearest-sampled on SwiftShader, which drew the 0.2° grid as visible squares).
  const enc = new Uint8Array(N * 4);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    // texture row 0 = south (lat0), so flip y
    const v = Math.min(T[y * GW + x] / ref, 3.99);
    const q = Math.round(v * 16384);
    const o = ((GH - 1 - y) * GW + x) * 4;
    enc[o] = q >> 8; enc[o + 1] = q & 255; enc[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(enc, GW, GH, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const probe = {};
  for (const [n, ll] of Object.entries({ Victoria: [33.2, 0.4], Khartoum: [32.5, 15.6], Cairo: [31.24, 30.05], Alex: [29.9, 31.2], Jerusalem: [35.2, 31.8], Istanbul: [28.97, 41.02], Rome: [12.5, 41.9], Paris: [2.35, 48.86], Lagos: [3.39, 6.45], Joburg: [28, -26.2], Riyadh: [46.7, 24.6], Tehran: [51.4, 35.7] })) probe[n] = +(at(...ll) / ref).toFixed(3);
  for (const km of [50, 150, 300, 600, 1200]) for (const [nm, dx, dy] of [['N', 0, 1], ['E', 1, 0], ['S', 0, -1], ['W', -1, 0]]) {
    const lon = R_GEO[0] + dx * km / 111.32, la = R_GEO[1] + dy * km / 111.32;
    probe[nm + km] = +(at(lon, la) / ref).toFixed(4);
  }
  return { tex, probe };
}

class MinHeap {
  constructor(cap) { this.k = new Int32Array(cap * 4); this.v = new Float32Array(cap * 4); this.size = 0; }
  push(k, v) {
    if (this.size >= this.k.length) { const k2 = new Int32Array(this.k.length * 2); k2.set(this.k); this.k = k2; const v2 = new Float32Array(this.v.length * 2); v2.set(this.v); this.v = v2; }
    let i = this.size++; const K = this.k, V = this.v;
    while (i > 0) { const p = (i - 1) >> 1; if (V[p] <= v) break; K[i] = K[p]; V[i] = V[p]; i = p; }
    K[i] = k; V[i] = v;
  }
  pop() {
    const K = this.k, V = this.v; const rk = K[0], rv = V[0];
    const lk = K[--this.size], lv = V[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= this.size) break;
      if (c + 1 < this.size && V[c + 1] < V[c]) c++;
      if (V[c] >= lv) break;
      K[i] = K[c]; V[i] = V[c]; i = c;
    }
    K[i] = lk; V[i] = lv;
    return [rk, rv];
  }
}
