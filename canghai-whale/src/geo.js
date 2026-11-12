import * as THREE from 'three';

/** Accumulates non-indexed triangles with normals / uvs / colours and arbitrary extra attributes. */
export class MB {
  constructor(extra = {}) {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.col = [];
    this.extra = {};
    for (const k in extra) this.extra[k] = { size: extra[k], data: [] };
    this.count = 0;
  }
  vert(p, n, u, v, c, ex) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.uv.push(u, v);
    this.col.push(c[0], c[1], c[2]);
    for (const k in this.extra) {
      const e = this.extra[k];
      const src = ex ? ex[k] : null;
      if (e.size === 1) e.data.push(src === null || src === undefined ? 0 : src);
      else for (let i = 0; i < e.size; i++) e.data.push(src ? src[i] : 0);
    }
    this.count++;
  }
  tri(a, b, c, n, uva, uvb, uvc, col, ex) {
    this.vert(a, n, uva[0], uva[1], col, ex);
    this.vert(b, n, uvb[0], uvb[1], col, ex);
    this.vert(c, n, uvc[0], uvc[1], col, ex);
  }
  /** a,b,c,d counter-clockwise when seen from the side the normal points to */
  quad(a, b, c, d, n, col, ex, uv) {
    const u = uv || QUV;
    this.tri(a, b, c, n, u[0], u[1], u[2], col, ex);
    this.tri(a, c, d, n, u[0], u[2], u[3], col, ex);
  }
  /** axis-aligned box rotated about Y; omits the bottom face */
  box(cx, cy, cz, sx, sy, sz, rot, col, ex, bottom = false) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const hx = sx / 2, hz = sz / 2;
    const P = (lx, y, lz) => [cx + lx * c - lz * s, y, cz + lx * s + lz * c];
    const N = (lx, lz) => [lx * c - lz * s, 0, lx * s + lz * c];
    const y0 = cy, y1 = cy + sy;
    const uvs = (w, h) => [[0, 0], [0, h], [w, h], [w, 0]];
    // +x
    this.quad(P(hx, y0, hz), P(hx, y1, hz), P(hx, y1, -hz), P(hx, y0, -hz), N(1, 0), col, ex, uvs(sz, sy));
    // -x
    this.quad(P(-hx, y0, -hz), P(-hx, y1, -hz), P(-hx, y1, hz), P(-hx, y0, hz), N(-1, 0), col, ex, uvs(sz, sy));
    // +z
    this.quad(P(-hx, y0, hz), P(-hx, y1, hz), P(hx, y1, hz), P(hx, y0, hz), N(0, 1), col, ex, uvs(sx, sy));
    // -z
    this.quad(P(hx, y0, -hz), P(hx, y1, -hz), P(-hx, y1, -hz), P(-hx, y0, -hz), N(0, -1), col, ex, uvs(sx, sy));
    // top
    this.quad(P(-hx, y1, hz), P(-hx, y1, -hz), P(hx, y1, -hz), P(hx, y1, hz), [0, 1, 0], col, ex, uvs(sx, sz));
    if (bottom) this.quad(P(-hx, y0, -hz), P(-hx, y0, hz), P(hx, y0, hz), P(hx, y0, -hz), [0, -1, 0], col, ex, uvs(sx, sz));
  }
  /** vertical cylinder / cone (open bottom) */
  cyl(cx, cy, cz, r0, r1, h, seg, col, ex, cap = true) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const p00 = [cx + c0 * r0, cy, cz + s0 * r0], p01 = [cx + c0 * r1, cy + h, cz + s0 * r1];
      const p10 = [cx + c1 * r0, cy, cz + s1 * r0], p11 = [cx + c1 * r1, cy + h, cz + s1 * r1];
      const u0 = i / seg, u1 = (i + 1) / seg;
      this.vert(p00, [c0, 0, s0], u0, 0, col, ex); this.vert(p01, [c0, 0, s0], u0, 1, col, ex); this.vert(p11, [c1, 0, s1], u1, 1, col, ex);
      this.vert(p00, [c0, 0, s0], u0, 0, col, ex); this.vert(p11, [c1, 0, s1], u1, 1, col, ex); this.vert(p10, [c1, 0, s1], u1, 0, col, ex);
      if (cap && r1 > 0.001) {
        this.tri([cx, cy + h, cz], p11, p01, [0, 1, 0], [0.5, 0.5], [1, 1], [0, 1], col, ex);
      }
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    for (const k in this.extra) g.setAttribute(k, new THREE.Float32BufferAttribute(this.extra[k].data, this.extra[k].size));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
const QUV = [[0, 0], [0, 1], [1, 1], [1, 0]];

/** Collects raw triangles for the physics collider. */
export class Collider {
  constructor() {
    this.pos = [];
  }
  tri(a, b, c) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }
  quad(a, b, c, d) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
  box(cx, cy, cz, sx, sy, sz, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const hx = sx / 2, hz = sz / 2;
    const P = (lx, y, lz) => [cx + lx * c - lz * s, y, cz + lx * s + lz * c];
    const y0 = cy, y1 = cy + sy;
    this.quad(P(hx, y0, hz), P(hx, y1, hz), P(hx, y1, -hz), P(hx, y0, -hz));
    this.quad(P(-hx, y0, -hz), P(-hx, y1, -hz), P(-hx, y1, hz), P(-hx, y0, hz));
    this.quad(P(-hx, y0, hz), P(-hx, y1, hz), P(hx, y1, hz), P(hx, y0, hz));
    this.quad(P(hx, y0, -hz), P(hx, y1, -hz), P(-hx, y1, -hz), P(-hx, y0, -hz));
    this.quad(P(-hx, y1, hz), P(-hx, y1, -hz), P(hx, y1, -hz), P(hx, y1, hz));
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    return g;
  }
}

export function lin(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}
