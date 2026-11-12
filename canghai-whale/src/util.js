import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const saturate = (v) => clamp(v, 0, 1);
export const smoothstep = (a, b, x) => {
  const t = saturate((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** frame-rate independent exponential approach */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export const dampAngle = (a, b, lambda, dt) => a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash01(x, y = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Tileable multi-channel fbm noise texture used by every procedural material. */
export function makeNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const chan = (seed, octaves, basePeriod) => {
    const out = new Float32Array(size * size);
    let amp = 1;
    let total = 0;
    let period = basePeriod;
    for (let o = 0; o < octaves; o++) {
      const rnd = mulberry32(seed + o * 101);
      const lat = new Float32Array(period * period);
      for (let i = 0; i < lat.length; i++) lat[i] = rnd();
      const cell = size / period;
      for (let y = 0; y < size; y++) {
        const fy = y / cell;
        const y0 = Math.floor(fy);
        let ty = fy - y0;
        ty = ty * ty * (3 - 2 * ty);
        const ya = (y0 % period) * period;
        const yb = ((y0 + 1) % period) * period;
        for (let x = 0; x < size; x++) {
          const fx = x / cell;
          const x0 = Math.floor(fx);
          let tx = fx - x0;
          tx = tx * tx * (3 - 2 * tx);
          const xa = x0 % period;
          const xb = (x0 + 1) % period;
          const v = lerp(lerp(lat[ya + xa], lat[ya + xb], tx), lerp(lat[yb + xa], lat[yb + xb], tx), ty);
          out[y * size + x] += v * amp;
        }
      }
      total += amp;
      amp *= 0.5;
      period *= 2;
      if (period > size) break;
    }
    for (let i = 0; i < out.length; i++) out[i] /= total;
    return out;
  };
  const r = chan(11, 6, 4);
  const g = chan(29, 5, 8);
  const b = chan(47, 3, 32);
  const rnd = mulberry32(977);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = clamp(Math.round(((r[i] - 0.5) * 1.9 + 0.5) * 255), 0, 255);
    data[i * 4 + 1] = clamp(Math.round(((g[i] - 0.5) * 1.9 + 0.5) * 255), 0, 255);
    data[i * 4 + 2] = clamp(Math.round(((b[i] - 0.5) * 1.6 + 0.5) * 255), 0, 255);
    data[i * 4 + 3] = Math.round(rnd() * 255);
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- 2D polygon helpers (rings are flat [x,z,x,z,...])
export function ringArea(r) {
  let a = 0;
  const n = r.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1];
  }
  return a / 2;
}
export function reverseRing(r) {
  const out = new Array(r.length);
  const n = r.length / 2;
  for (let i = 0; i < n; i++) {
    out[i * 2] = r[(n - 1 - i) * 2];
    out[i * 2 + 1] = r[(n - 1 - i) * 2 + 1];
  }
  return out;
}
export function pointInRing(x, z, r) {
  let inside = false;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = r[i * 2], zi = r[i * 2 + 1], xj = r[j * 2], zj = r[j * 2 + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export function pointInPoly(x, z, poly) {
  if (!pointInRing(x, z, poly.o)) return false;
  for (const h of poly.h) if (pointInRing(x, z, h)) return false;
  return true;
}
export function distToRing(x, z, r) {
  let best = Infinity;
  const n = r.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = r[i * 2], az = r[i * 2 + 1], bx = r[j * 2], bz = r[j * 2 + 1];
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
    t = clamp(t, 0, 1);
    const px = ax + dx * t - x, pz = az + dz * t - z;
    const d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
export function distToPolyEdge(x, z, poly) {
  let d = distToRing(x, z, poly.o);
  for (const h of poly.h) d = Math.min(d, distToRing(x, z, h));
  return d;
}

/** Offset a ring towards its inside (positive-area rings) by t metres using mitred joints. */
export function insetRing(r, t) {
  const n = r.length / 2;
  const out = new Array(r.length);
  for (let i = 0; i < n; i++) {
    const p = (i + n - 1) % n, q = (i + 1) % n;
    let d0x = r[i * 2] - r[p * 2], d0z = r[i * 2 + 1] - r[p * 2 + 1];
    let d1x = r[q * 2] - r[i * 2], d1z = r[q * 2 + 1] - r[i * 2 + 1];
    const l0 = Math.hypot(d0x, d0z) || 1, l1 = Math.hypot(d1x, d1z) || 1;
    d0x /= l0; d0z /= l0; d1x /= l1; d1z /= l1;
    // outward normals for positive-area rings: (d.z, -d.x)
    let mx = d0z + d1z, mz = -d0x - d1x;
    const ml = Math.hypot(mx, mz);
    if (ml < 1e-4) { mx = d0z; mz = -d0x; } else { mx /= ml; mz /= ml; }
    const cosHalf = Math.max(0.34, mx * d0z + mz * -d0x);
    const s = t / cosHalf;
    out[i * 2] = r[i * 2] - mx * s;
    out[i * 2 + 1] = r[i * 2 + 1] - mz * s;
  }
  return out;
}

const _v2 = [];
export function triangulate(outer, holes = []) {
  // returns { pts:[x,z,...], tris:[i,j,k,...] }
  const contour = [];
  for (let i = 0; i < outer.length; i += 2) contour.push(new THREE.Vector2(outer[i], outer[i + 1]));
  const hs = holes.map((h) => {
    const a = [];
    for (let i = 0; i < h.length; i += 2) a.push(new THREE.Vector2(h[i], h[i + 1]));
    return a;
  });
  const faces = THREE.ShapeUtils.triangulateShape(contour, hs);
  const pts = outer.slice();
  for (const h of holes) for (let i = 0; i < h.length; i++) pts.push(h[i]);
  const tris = [];
  for (const f of faces) tris.push(f[0], f[1], f[2]);
  _v2.length = 0;
  return { pts, tris };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export const CJK_SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC","Source Han Sans SC","WenQuanYi Micro Hei",sans-serif';
export const CJK_SERIF = '"Songti SC","STSong","SimSun","Noto Serif CJK SC","Noto Serif SC","Source Han Serif SC",serif';
export const CJK_KAI = '"Kaiti SC","STKaiti","KaiTi","楷体","AR PL UKai CN","Noto Serif CJK SC",serif';
