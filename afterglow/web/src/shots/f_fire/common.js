// Shared helpers for the fire group (f_fire S15–S17, m_asking S23/S26, m_beam S27).
//   · colour tokens (sRGB hex → linear)
//   · CPU value noise / fbm (deterministic, for building geometry in create())
//   · the hand-held "breath" as a 2D similarity in 1080p pixel space, applied identically to
//     baked plates (inverse, in a fullscreen pass) and to live geometry (forward, in clip space)
//   · tiny geometry utilities (merge, ribbons)
import * as THREE from 'three';

export const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const hex = h => [srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255)];
export const CURSOR = hex(0xF2EEE4);
// R as a continuous pixel centre (pixel (734,540) → centre 734.5, 540.5), 1080p units
export const RX = 734.5, RY = 540.5;

// ---- CPU noise -----------------------------------------------------------------------------------
function ih(ix, iy, iz, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(iz | 0, 1440662683) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = t => t * t * (3 - 2 * t);
export function vnoise3(x, y, z, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => ih(ix + dx, iy + dy, iz + dz, seed);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
           l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
}
export function fbm3(x, y, z, oct = 4, seed = 0) {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise3(x, y, z, seed + i * 17); n += a; x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 3.1; a *= 0.5; }
  return s / n;
}
export const vnoise1 = (x, seed = 0) => vnoise3(x, 0.5, 0.5, seed);
export function fbm1(x, oct = 5, seed = 0) { return fbm3(x, 0.37, 0.71, oct, seed); }

// ---- hand-held breath ----------------------------------------------------------------------------
// Returns {ox, oy, rot} in 1080p px / radians: amplitude `px` for the translation (noise at `hz`),
// `deg` for the roll. `zeroAt` (seconds) pins the breath to exactly 0 at that instant (a frame on R).
export function breath(util, t, { px = 1.5, deg = 0.15, hz = 0.3, seed = 15, zeroAt = null } = {}) {
  const s = util.shake(t, seed, hz, 3);
  let z = [0, 0, 0];
  if (zeroAt !== null) z = util.shake(zeroAt, seed, hz, 3);
  // util.shake peaks around ±0.9; with the zero pin the excursion can double, so scale by 0.6
  const k = zeroAt !== null ? 0.6 : 1.0;
  return { ox: px * k * (s[0] - z[0]), oy: px * k * (s[1] - z[1]), rot: (deg * Math.PI / 180) * k * (s[2] - z[2]) };
}

// GLSL: forward hand-held transform of a clip-space position (live geometry).
// Uniforms: uHand = vec4(ox, oy, cos, sin), uHandC = centre (1080p px, y down).
export const HAND_GLSL = /* glsl */ `
uniform vec4 uHand; uniform vec2 uHandC;
vec4 handClip(vec4 c){
  vec2 ndc = c.xy / c.w;
  vec2 px = vec2((ndc.x * 0.5 + 0.5) * 1920.0, (0.5 - ndc.y * 0.5) * 1080.0);
  vec2 d = px - uHandC;
  px = uHandC + vec2(uHand.z * d.x - uHand.w * d.y, uHand.w * d.x + uHand.z * d.y) + uHand.xy;
  ndc = vec2(px.x / 1920.0 * 2.0 - 1.0, 1.0 - px.y / 1080.0 * 2.0);
  return vec4(ndc * c.w, c.zw);
}
// inverse transform for a screen position in 1080p px (y down) → where to sample a baked plate
vec2 handInv(vec2 px){
  vec2 d = px - uHandC - uHand.xy;
  return uHandC + vec2(uHand.z * d.x + uHand.w * d.y, -uHand.w * d.x + uHand.z * d.y);
}
`;
export function handUniforms() { return { uHand: { value: new THREE.Vector4(0, 0, 1, 0) }, uHandC: { value: new THREE.Vector2(RX, RY) } }; }
export function setHand(u, b) { u.uHand.value.set(b.ox, b.oy, Math.cos(b.rot), Math.sin(b.rot)); }

// ---- geometry ------------------------------------------------------------------------------------
// Merge plain BufferGeometries (indexed or not) that share the same attribute names.
export function merge(geos) {
  const names = Object.keys(geos[0].attributes);
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const isz = geos[0].attributes[n].itemSize;
    const arr = new Float32Array(nv * isz);
    let o = 0;
    for (const g of geos) { arr.set(g.attributes[n].array, o); o += g.attributes[n].array.length; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, isz));
  }
  const idx = new Uint32Array(ni);
  let oi = 0, base = 0;
  for (const g of geos) {
    const c = g.attributes.position.count;
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[oi++] = a[i] + base; }
    else for (let i = 0; i < c; i++) idx[oi++] = i + base;
    base += c;
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// Add constant float attributes to a geometry (e.g. material id, seed).
export function tag(g, attrs) {
  const n = g.attributes.position.count;
  for (const [k, v] of Object.entries(attrs)) {
    const sz = Array.isArray(v) ? v.length : 1;
    const a = new Float32Array(n * sz);
    for (let i = 0; i < n; i++) for (let j = 0; j < sz; j++) a[i * sz + j] = Array.isArray(v) ? v[j] : v;
    g.setAttribute(k, new THREE.BufferAttribute(a, sz));
  }
  return g;
}

// A ribbon along a polyline. pts: array of [x,y,z]; widths: array; side: either a function
// (i, tangent) → unit side vector, or null for a camera-facing ribbon (needs `eye`).
// Returns a geometry with position, normal, and `ru` (vec2: u along 0..1, v across −1..1).
export function ribbon(pts, widths, { eye = null, side = null } = {}) {
  const n = pts.length;
  const pos = new Float32Array(n * 2 * 3), nor = new Float32Array(n * 2 * 3), ru = new Float32Array(n * 2 * 2);
  const P = pts.map(p => new THREE.Vector3(...p));
  const T = new THREE.Vector3(), Sd = new THREE.Vector3(), N = new THREE.Vector3(), V = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    T.subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
    if (side) Sd.copy(side(i, T));
    else { V.subVectors(eye, P[i]).normalize(); Sd.crossVectors(T, V).normalize(); }
    N.crossVectors(Sd, T).normalize();
    if (eye) { V.subVectors(eye, P[i]); if (N.dot(V) < 0) N.negate(); }
    const w = widths[i] * 0.5;
    for (let s = 0; s < 2; s++) {
      const k = i * 2 + s, sg = s ? 1 : -1;
      pos[3 * k] = P[i].x + Sd.x * w * sg; pos[3 * k + 1] = P[i].y + Sd.y * w * sg; pos[3 * k + 2] = P[i].z + Sd.z * w * sg;
      nor[3 * k] = N.x; nor[3 * k + 1] = N.y; nor[3 * k + 2] = N.z;
      ru[2 * k] = i / (n - 1); ru[2 * k + 1] = sg;
    }
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('ru', new THREE.BufferAttribute(ru, 2));
  g.setIndex(idx);
  return g;
}

// Keep only position+normal (+uv dropped) of a three primitive, as an indexed geometry.
export function plain(g) {
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', g.attributes.position.clone());
  o.setAttribute('normal', g.attributes.normal.clone());
  const n = g.attributes.position.count;
  o.setAttribute('ru', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (g.index) o.setIndex(g.index.clone());
  return o;
}
