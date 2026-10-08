// c_supernova/shell.js — the supernova's ejecta shell as a deterministic particle cloud, plus the
// small JS noise kit used to shape it (and reused by c_pulsar for its remnant).
//
// Each particle carries:
//   position  unit direction on the sphere
//   aRad      radial factor: 1 ± 15 % 3D-fbm jitter (Rayleigh–Taylor "fingers" add up to +22 %)
//   aLayer    0 (inner, iron) → 1 (outer, hydrogen): the shell's onion of forged elements
//   aB        brightness weight (filament ridges are brighter and denser)
//   aFil      filament strength 0..1 (drives point size)
//   aSeed     per-particle hash 0..1
//   aPatch    smooth regional composition noise 0..1
import * as THREE from 'three';
import { rng } from '../../lib/util.js';

// ---- palette (linear) -----------------------------------------------------------------------------
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const hex = h => [srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255)];
export const IRON_BLUE = hex(0x6FA8FF), OIII = hex(0x4FE0D0), SULFUR = hex(0xFFD27F), HALPHA = hex(0xFF3B4E);
export const STAR = hex(0xBFD4FF), PULSAR = hex(0xC9B8FF);

// ---- JS value noise (deterministic, integer-lattice hash) ------------------------------------------
function h3(i, j, k, s) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177) ^ Math.imul(s, 1103515245);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const fade = t => t * t * (3 - 2 * t);
export function vnoise3(x, y, z, s = 0) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const fx = fade(x - i), fy = fade(y - j), fz = fade(z - k);
  const a = h3(i, j, k, s), b = h3(i + 1, j, k, s), c = h3(i, j + 1, k, s), d = h3(i + 1, j + 1, k, s);
  const e = h3(i, j, k + 1, s), f = h3(i + 1, j, k + 1, s), g = h3(i, j + 1, k + 1, s), hh = h3(i + 1, j + 1, k + 1, s);
  const x1 = a + (b - a) * fx, x2 = c + (d - c) * fx, x3 = e + (f - e) * fx, x4 = g + (hh - g) * fx;
  const y1 = x1 + (x2 - x1) * fy, y2 = x3 + (x4 - x3) * fy;
  return y1 + (y2 - y1) * fz;
}
export function fbm3(x, y, z, oct = 4, s = 0) {
  let a = 0.5, sum = 0, n = 0;
  for (let o = 0; o < oct; o++) { sum += a * vnoise3(x, y, z, s + o * 17); n += a; x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 3.1; a *= 0.5; }
  return sum / n;
}
// ridged noise: thin bright ridges where the noise crosses 0.5 (filaments)
export function ridge3(x, y, z, oct = 3, s = 0) {
  let a = 0.5, sum = 0, n = 0;
  for (let o = 0; o < oct; o++) { const v = 1 - Math.abs(2 * vnoise3(x, y, z, s + o * 31) - 1); sum += a * v * v; n += a; x = x * 2.1 + 3.1; y = y * 2.1 + 1.3; z = z * 2.1 + 7.7; a *= 0.5; }
  return sum / n;
}

// ---- the shell ------------------------------------------------------------------------------------
export function buildShell(N = 300000, seed = 55012) {
  const r = rng(seed);
  const pos = new Float32Array(N * 3), rad = new Float32Array(N), layer = new Float32Array(N);
  const bright = new Float32Array(N), fil = new Float32Array(N), sd = new Float32Array(N), patch = new Float32Array(N);
  let i = 0, guard = 0;
  while (i < N && guard++ < N * 40) {
    const d = r.sphere();
    const x = d[0], y = d[1], z = d[2];
    // filament network on the sphere: ridges of a low-frequency noise, broken into knots
    const rid = ridge3(x * 3.2 + 5, y * 3.2 + 1, z * 3.2 + 9, 3, seed);
    const knot = vnoise3(x * 11 + 2, y * 11 + 7, z * 11 + 4, seed + 5);
    const rid2 = ridge3(x * 9.0 + 2, y * 9.0 + 8, z * 9.0 + 3, 2, seed + 21);
    const w = Math.pow(rid, 7.0) * (0.3 + 1.1 * knot) + 0.5 * Math.pow(rid2, 9.0) * knot;
    // rejection: ~45 % of the particles fill the shell evenly (the diffuse sheet), the rest trace filaments
    if (r() > 0.45 + 0.55 * Math.min(1, w * 1.6)) continue;
    // ±15 % radial jitter from a 3D fbm of the direction (Rayleigh–Taylor corrugation)
    const j = fbm3(x * 3.6 + 11, y * 3.6 + 3, z * 3.6 + 6, 4, seed + 9);
    let rr = 1 + 0.15 * Math.max(-1, Math.min(1, (j - 0.5) * 2.4));
    // layer coordinate (inner → outer) and outward fingers: where a finger noise is high the outer
    // layers are drawn out radially into spikes
    const L = r();
    const fing = Math.pow(Math.max(0, vnoise3(x * 14 + 1, y * 14 + 5, z * 14 + 2, seed + 3) - 0.62) / 0.38, 2.0);
    rr *= 0.91 + 0.09 * L + fing * 0.12 * L * L * r();
    pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z;
    rad[i] = rr; layer[i] = L;
    bright[i] = (0.55 + 0.9 * Math.min(1, w * 1.6)) * Math.exp(0.45 * r.gauss());
    fil[i] = Math.min(1, w * 1.5);
    sd[i] = r();
    // smooth regional composition (iron-, oxygen-, sulfur-rich patches as in Cas A), 0..1
    patch[i] = vnoise3(x * 2.3 + 4, y * 2.3 + 4, z * 2.3 + 4, seed + 41) * 0.65 + vnoise3(x * 5.1 + 1, y * 5.1 + 1, z * 5.1 + 1, seed + 43) * 0.35;
    i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
  g.setAttribute('aLayer', new THREE.BufferAttribute(layer, 1));
  g.setAttribute('aB', new THREE.BufferAttribute(bright, 1));
  g.setAttribute('aFil', new THREE.BufferAttribute(fil, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  g.setAttribute('aPatch', new THREE.BufferAttribute(patch, 1));
  g.setDrawRange(0, i);
  return { geometry: g, count: i };
}

// GLSL: element colour of the onion, inner iron blue → OIII → sulfur → outer H-alpha
export const LAYER_GLSL = /* glsl */ `
  vec3 layerColor(float L){
    vec3 c0 = vec3(${IRON_BLUE.map(v => v.toFixed(4)).join(',')});
    vec3 c1 = vec3(${OIII.map(v => v.toFixed(4)).join(',')});
    vec3 c2 = vec3(${SULFUR.map(v => v.toFixed(4)).join(',')});
    vec3 c3 = vec3(${HALPHA.map(v => v.toFixed(4)).join(',')});
    vec3 c = mix(c0, c1, smoothstep(0.12, 0.38, L));
    c = mix(c, c2, smoothstep(0.42, 0.62, L));
    c = mix(c, c3, smoothstep(0.66, 0.86, L));
    return c / max(0.12, dot(c, vec3(0.2126, 0.7152, 0.0722)));   // unit luminance: layers differ in hue, not energy
  }`;
