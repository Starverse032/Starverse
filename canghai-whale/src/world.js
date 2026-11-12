import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import DATA from './data/campus.json';
import { MB, Collider, lin } from './geo.js';
import {
  ringArea, reverseRing, pointInPoly, distToPolyEdge, insetRing, triangulate, mulberry32, clamp, lerp,
} from './util.js';
import { facadeMaterial, roofMaterial, groundMaterial, waterMaterial, std, STYLE, GT } from './materials.js';

export { DATA };

const PARAPET = 1.1;
export const ROAD_Y = -0.14;
const WATER_Y = -0.42;

// facade recipes: shader style, bay width (m), wall colour, glass tint index, share of lit rooms at night
const STYLES = {
  li: { sty: STYLE.ribbon, bay: 4.2, col: '#ecebe6', glass: 0, lit: 0.3, roof: '#b9b7b0' },
  zhen: { sty: STYLE.fins, bay: 4.2, col: '#e8e6e0', glass: 0, lit: 0.36, roof: '#b9b7b0' },
  zhi: { sty: STYLE.grid, bay: 4.0, col: '#ddd9d0', glass: 2, lit: 0.34, roof: '#b4b1a9' },
  gong: { sty: STYLE.ribbon, bay: 4.5, col: '#dad4c8', glass: 1, lit: 0.26, roof: '#b4b1a9' },
  xin: { sty: STYLE.ribbon, bay: 4.2, col: '#e7e3da', glass: 0, lit: 0.3, roof: '#b9b7b0' },
  teng: { sty: STYLE.fins, bay: 4.2, col: '#d9c0a2', glass: 1, lit: 0.5, roof: '#b5ab9c' },
  tengbase: { sty: STYLE.grid, bay: 4.5, col: '#d4c1a8', glass: 1, lit: 0.3, roof: '#b5ab9c' },
  yuan: { sty: STYLE.curtain, bay: 2.1, col: '#d2d6da', glass: 0, lit: 0.3, roof: '#a9adb0' },
  yuanbase: { sty: STYLE.ribbon, bay: 4.2, col: '#dedcd6', glass: 0, lit: 0.25, roof: '#b4b1a9' },
  holes: { sty: STYLE.holes, bay: 3.9, col: '#f3f2ee', glass: 2, lit: 0.5, roof: '#c9c7c0' },
  holesbase: { sty: STYLE.holes, bay: 3.9, col: '#eeece7', glass: 2, lit: 0.3, roof: '#c9c7c0' },
  studio: { sty: STYLE.blank, bay: 6.0, col: '#cbc7bf', glass: 2, lit: 0.2, roof: '#a7a49d' },
  canteen: { sty: STYLE.canteen, bay: 7.5, col: '#e4dfd4', glass: 1, lit: 0.85, roof: '#b4b1a9' },
  dorm: { sty: STYLE.dorm, bay: 3.6, col: '#e9e4d9', glass: 2, lit: 0.62, roof: '#b0aca3' },
  dormlow: { sty: STYLE.dorm, bay: 3.6, col: '#dfd2bf', glass: 2, lit: 0.55, roof: '#a89f92' },
  resi: { sty: STYLE.punched, bay: 3.3, col: '#d9c9b4', glass: 2, lit: 0.5, roof: '#9d8f84', vary: 1 },
  uni: { sty: STYLE.ribbon, bay: 4.0, col: '#ddd6c8', glass: 1, lit: 0.22, roof: '#aaa69c', vary: 1 },
  glass: { sty: STYLE.curtain, bay: 1.6, col: '#8fa3b5', glass: -1, lit: 0.2, roof: '#7e8286' },
  office: { sty: STYLE.grid, bay: 3.2, col: '#cfc9bd', glass: -1, lit: 0.24, roof: '#8e8c88', vary: 1 },
  small: { sty: STYLE.punched, bay: 3.5, col: '#cfc8bb', glass: 2, lit: 0.3, roof: '#98948c', vary: 1 },
  construction: { sty: STYLE.blank, bay: 5.0, col: '#9c9b96', glass: 2, lit: 0.0, roof: '#8a8985' },
};

const normRing = (r, positive) => (ringArea(r) > 0 === positive ? r : reverseRing(r));

function vary(c, rnd, amt = 0.08) {
  const k = 1 + (rnd() - 0.5) * 2 * amt;
  const w = (rnd() - 0.5) * amt;
  return [clamp(c[0] * k + w * 0.5, 0, 1), clamp(c[1] * k, 0, 1), clamp(c[2] * k - w * 0.5, 0, 1)];
}

function longestEdge(ring) {
  const n = ring.length / 2;
  let best = { len: 0 };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len > best.len) best = { len, ax, az, bx, bz, ang: Math.atan2(bz - az, bx - ax) };
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------
function addBuilding(b, walls, roofs, col, extras, opts = {}) {
  const st = STYLES[b.st] || STYLES.office;
  const rnd = mulberry32(Math.floor(b.sd * 1e6) + 17);
  let wallCol = lin(b.col || st.col);
  if (st.vary) wallCol = vary(wallCol, rnd, 0.1);
  let roofCol = vary(lin(st.roof), rnd, 0.06);
  const glassType = st.glass >= 0 ? st.glass : Math.floor(rnd() * 3.2);
  const ph = opts.parapet !== undefined ? opts.parapet : b.a < 70 ? 0.35 : st.sty === STYLE.curtain ? 1.5 : PARAPET;
  const base = opts.base !== undefined ? opts.base : b.mh;
  const vOff = b.mh;
  const top = b.ht;
  if (top - base < 0.5) return;
  const seed = b.sd * 10;
  const rings = [normRing(b.o, true), ...b.h.map((h) => normRing(h, false))];
  const fh = b.fh;
  const aC = [top - vOff, glassType, st.lit, 0];

  for (const ring of rings) {
    const n = ring.length / 2;
    const inner = insetRing(ring, 0.28);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const nrm = [dz / len, 0, -dx / len];
      let sty = st.sty;
      let bw = len / Math.max(1, Math.round(len / st.bay));
      if (len < 2.4) { sty = STYLE.blank; bw = 50; }
      const ex = { aB: [fh, bw, sty, seed], aC };
      const y0 = base, y1 = top + ph;
      walls.quad([ax, y0, az], [ax, y1, az], [bx, y1, bz], [bx, y0, bz], nrm, wallCol, ex,
        [[0, y0 - vOff], [0, y1 - vOff], [len, y1 - vOff], [len, y0 - vOff]]);
      if (col) col.quad([ax, y0, az], [ax, y1, az], [bx, y1, bz], [bx, y0, bz]);
      // ---- real relief on the facades of the mapped buildings: sun-shades, fins, balconies
      if (col && len > 3.2 && sty === st.sty) {
        const ang = Math.atan2(dz, dx);
        const ux = dx / len, uz = dz / len;
        const levels = Math.max(1, Math.round((top - vOff) / fh));
        const reliefCol = [wallCol[0] * 0.97, wallCol[1] * 0.97, wallCol[2] * 0.97];
        const D = 0.32;
        const mxp = (ax + bx) / 2 + nrm[0] * D / 2, mzp = (az + bz) / 2 + nrm[2] * D / 2;
        if (sty === STYLE.ribbon) {
          for (let k = 0; k < levels; k++) {
            const y = vOff + k * fh + 0.875 * fh;
            if (y < base + 0.5 || y > top - 0.3) continue;
            roofs.box(mxp, y, mzp, len, 0.11, D, ang, reliefCol, undefined, true);
          }
        } else if (sty === STYLE.fins) {
          const nb = Math.max(1, Math.round(len / bw));
          const y0f = Math.max(base, vOff + fh), hF = top - y0f;
          if (hF > 1) {
            const fw = (0.24 * bw) / 3;
            for (let q = 0; q < nb * 3; q++) {
              const u = (q / 3) * bw + fw / 2;
              if (u > len - 0.05) break;
              roofs.box(ax + ux * u + nrm[0] * D / 2, y0f, az + uz * u + nrm[2] * D / 2, fw, hF, D, ang, reliefCol, undefined, false);
            }
          }
        } else if (sty === STYLE.dorm) {
          for (let k = 1; k < levels; k++) {
            const y = vOff + k * fh;
            if (y < base + 0.5 || y > top - 1.2) continue;
            roofs.box(mxp, y - 0.07, mzp, len - 0.5, 0.13, D + 0.1, ang, reliefCol, undefined, true);
            roofs.box((ax + bx) / 2 + nrm[0] * (D + 0.02), y + 0.06, (az + bz) / 2 + nrm[2] * (D + 0.02), len - 0.5, 0.9, 0.05, ang, [0.3, 0.31, 0.33], undefined, false);
          }
        } else if (sty === STYLE.grid || sty === STYLE.canteen) {
          // a projecting cornice and plinth give the box a little shadow line
          roofs.box(mxp, top - 0.35, mzp, len, 0.3, D, ang, reliefCol, undefined, true);
        }
      }
      // parapet: inner face + cap
      const iax = inner[i * 2], iaz = inner[i * 2 + 1], ibx = inner[j * 2], ibz = inner[j * 2 + 1];
      roofs.quad([ibx, top, ibz], [ibx, y1, ibz], [iax, y1, iaz], [iax, top, iaz], [-nrm[0], 0, -nrm[2]], wallCol);
      roofs.quad([ax, y1, az], [iax, y1, iaz], [ibx, y1, ibz], [bx, y1, bz], [0, 1, 0], wallCol);
    }
  }
  // roof (and underside for bridge-like parts)
  const { pts, tris } = triangulate(rings[0], rings.slice(1));
  for (let t = 0; t < tris.length; t += 3) {
    let i0 = tris[t], i1 = tris[t + 1], i2 = tris[t + 2];
    const ux = pts[i1 * 2] - pts[i0 * 2], uz = pts[i1 * 2 + 1] - pts[i0 * 2 + 1];
    const vx = pts[i2 * 2] - pts[i0 * 2], vz = pts[i2 * 2 + 1] - pts[i0 * 2 + 1];
    if (uz * vx - ux * vz < 0) { const k = i1; i1 = i2; i2 = k; }
    const A = [pts[i0 * 2], top, pts[i0 * 2 + 1]], B = [pts[i1 * 2], top, pts[i1 * 2 + 1]], C = [pts[i2 * 2], top, pts[i2 * 2 + 1]];
    roofs.tri(A, B, C, [0, 1, 0], [A[0], A[2]], [B[0], B[2]], [C[0], C[2]], roofCol);
    if (col) col.tri(A, B, C);
    if (base > 0.5 && !opts.noBottom) {
      const a = [A[0], base, A[2]], b2 = [B[0], base, B[2]], c = [C[0], base, C[2]];
      roofs.tri(a, c, b2, [0, -1, 0], [a[0], a[2]], [c[0], c[2]], [b2[0], b2[2]], [0.42, 0.42, 0.41]);
      if (col) col.tri(a, c, b2);
    }
  }
  if (opts.noProps) return;

  // ---- rooftop clutter: stair cores, plant, water tanks
  const le = longestEdge(rings[0]);
  const poly = { o: rings[0], h: rings.slice(1) };
  let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity;
  for (let i = 0; i < rings[0].length; i += 2) {
    minx = Math.min(minx, rings[0][i]); maxx = Math.max(maxx, rings[0][i]);
    minz = Math.min(minz, rings[0][i + 1]); maxz = Math.max(maxz, rings[0][i + 1]);
  }
  const place = (sx, sz) => {
    const need = Math.hypot(sx, sz) * 0.5 + 1.0;
    for (let k = 0; k < 24; k++) {
      const x = lerp(minx, maxx, rnd()), z = lerp(minz, maxz, rnd());
      if (pointInPoly(x, z, poly) && distToPolyEdge(x, z, poly) > need) return [x, z];
    }
    return null;
  };
  if (b.a > 160) {
    const boxCol = vary(wallCol, rnd, 0.05);
    const nCore = b.a > 2500 ? 2 : 1;
    let spire = null;
    for (let k = 0; k < nCore; k++) {
      const sx = 5 + rnd() * 4, sz = 4 + rnd() * 3, sy = 3.2 + rnd() * 1.6;
      const p = place(sx, sz);
      if (!p) continue;
      roofs.box(p[0], top, p[1], sx, sy, sz, le.ang, boxCol);
      if (col) col.box(p[0], top, p[1], sx, sy, sz, le.ang);
      if (!spire) spire = [p[0], top + sy, p[1]];
    }
    const nAC = clamp(Math.round(b.a / 420), 1, 6);
    for (let k = 0; k < nAC; k++) {
      const sx = 1.6 + rnd() * 2.2, sz = 1.2 + rnd() * 1.4, sy = 1.1 + rnd() * 0.9;
      const p = place(sx, sz);
      if (!p) continue;
      const c = [0.55 + rnd() * 0.12, 0.56 + rnd() * 0.12, 0.57 + rnd() * 0.12];
      roofs.box(p[0], top, p[1], sx, sy, sz, le.ang, c);
      if (col) col.box(p[0], top, p[1], sx, sy, sz, le.ang);
    }
    if ((b.st === 'resi' || b.st === 'dormlow') && rnd() < 0.8) {
      const p = place(2.4, 2.4);
      if (p) {
        roofs.cyl(p[0], top + 0.9, p[1], 1.1, 1.1, 1.7, 12, [0.72, 0.74, 0.76]);
        roofs.box(p[0], top, p[1], 1.9, 0.9, 1.9, le.ang, [0.5, 0.5, 0.5]);
        if (col) col.box(p[0], top, p[1], 2.2, 2.6, 2.2, le.ang);
      }
    }
    if (top > 80 && spire && extras) {
      const hgt = 10 + rnd() * 16;
      roofs.cyl(spire[0], spire[1], spire[2], 0.22, 0.08, hgt, 6, [0.75, 0.75, 0.78]);
      extras.beacons.push([spire[0], spire[1] + hgt, spire[2]]);
    }
    if ((b.c === 1 || b.c === 2) && b.a > 900 && top < 40 && rnd() < 0.7) {
      // rows of solar panels
      const rows = 2 + Math.floor(rnd() * 3);
      const p = place(12, rows * 2.2);
      if (p) {
        const c = Math.cos(le.ang), s = Math.sin(le.ang);
        for (let r = 0; r < rows; r++) {
          const off = (r - (rows - 1) / 2) * 2.2;
          roofs.box(p[0] - s * off, top + 0.35, p[1] + c * off, 11, 0.12, 1.5, le.ang, [0.05, 0.07, 0.16]);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
function buildBuildings(walls, roofs, col, extras, landmarks, signs) {
  const outlines = DATA.buildings.filter((b) => !b.part);
  const bestByName = new Map();
  for (const b of DATA.buildings) {
    const opts = {};
    if (b.part && b.mh === 0) {
      const parent = outlines.find((o) => pointInPoly(b.cx, b.cz, o));
      if (parent) {
        if (b.ht <= parent.ht + 0.5) continue;
        opts.base = parent.ht + PARAPET;
        opts.noBottom = true;
      }
    }
    addBuilding(b, walls, roofs, col, extras, opts);
    if (b.n) {
      const cur = bestByName.get(b.n);
      if (!cur || b.ht > cur.ht) bestByName.set(b.n, b);
      landmarks.push({ name: b.n, sub: b.s, x: b.cx, z: b.cz, h: b.ht, r: Math.sqrt(b.a / Math.PI), campus: b.c });
    }
  }
  for (const b of bestByName.values()) {
    if (b.c !== 1) continue;
    const ring = normRing(b.o, true);
    const le = longestEdge(ring);
    if (le.len < 9) continue;
    const dx = (le.bx - le.ax) / le.len, dz = (le.bz - le.az) / le.len;
    signs.push({
      text: b.n, x: (le.ax + le.bx) / 2, z: (le.az + le.bz) / 2, nx: dz, nz: -dx,
      y: b.ht < 18 ? b.ht - 1.7 : b.ht - 3.2, width: Math.min(le.len * 0.55, b.n.length * 3.4), tall: b.ht >= 18,
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------
function addPoly(mb, col, poly, y, type, color, fieldFn) {
  const { pts, tris } = triangulate(poly.o, poly.h);
  for (let t = 0; t < tris.length; t += 3) {
    let i0 = tris[t], i1 = tris[t + 1], i2 = tris[t + 2];
    const ux = pts[i1 * 2] - pts[i0 * 2], uz = pts[i1 * 2 + 1] - pts[i0 * 2 + 1];
    const vx = pts[i2 * 2] - pts[i0 * 2], vz = pts[i2 * 2 + 1] - pts[i0 * 2 + 1];
    if (uz * vx - ux * vz < 0) { const k = i1; i1 = i2; i2 = k; }
    const A = [pts[i0 * 2], y, pts[i0 * 2 + 1]], B = [pts[i1 * 2], y, pts[i1 * 2 + 1]], C = [pts[i2 * 2], y, pts[i2 * 2 + 1]];
    if (mb) {
      const f = fieldFn || ((p) => [p[0], p[2]]);
      mb.vert(A, UP, A[0], A[2], color, { aT: type, aF: f(A) });
      mb.vert(B, UP, B[0], B[2], color, { aT: type, aF: f(B) });
      mb.vert(C, UP, C[0], C[2], color, { aT: type, aF: f(C) });
    }
    if (col) col.tri(A, B, C);
  }
}
const UP = [0, 1, 0];
const WHITE = [1, 1, 1];

function addKerbs(mb, poly, yLow, yHigh, type) {
  const rings = [normRing(poly.o, true), ...poly.h.map((h) => normRing(h, false))];
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = ring[i * 2], az = ring[i * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.02) continue;
      // faces the inside of the (lower) polygon
      const nrm = [-dz / len, 0, dx / len];
      mb.quad([bx, yLow, bz], [bx, yHigh, bz], [ax, yHigh, az], [ax, yLow, az], nrm, WHITE, { aT: type, aF: [0, 0] });
    }
  }
}

function buildGround(ground, water, pool, col) {
  const g = DATA.ground;
  const each = (name, fn) => { for (const p of g[name] || []) fn(p); };
  each('city', (p) => addPoly(ground, col, p, 0, GT.city, WHITE));
  each('pave', (p) => addPoly(ground, col, p, 0, GT.pave, WHITE));
  each('plaza', (p) => addPoly(ground, col, p, 0, GT.plaza, WHITE));
  each('grass', (p) => addPoly(ground, col, p, 0, GT.grass, WHITE));
  each('lawn', (p) => addPoly(ground, col, p, 0, GT.lawn, WHITE));
  each('wood', (p) => addPoly(ground, col, p, 0, GT.wood, WHITE));
  each('road', (p) => { addPoly(ground, col, p, ROAD_Y, GT.road, WHITE); addKerbs(ground, p, ROAD_Y, 0, GT.curb); });
  each('water', (p) => { addPoly(water, null, p, WATER_Y + 0.14, 0, WHITE); addPoly(null, col, p, WATER_Y, 0, WHITE); addKerbs(ground, p, WATER_Y - 0.3, 0, GT.curb); });
  each('pool', (p) => { addPoly(pool, null, p, -0.12, 0, WHITE); addPoly(null, col, p, -0.3, 0, WHITE); addKerbs(ground, p, -0.5, 0, GT.curb); });

  // the land beyond the detailed map: one big apron of city paving
  const [x0, z0, x1, z1] = DATA.world;
  const R = 9000;
  const apron = (ax, az, bx, bz) => {
    ground.quad([ax, 0, bz], [ax, 0, az], [bx, 0, az], [bx, 0, bz], UP, WHITE, { aT: GT.city, aF: [0, 0] });
    col.quad([ax, 0, bz], [ax, 0, az], [bx, 0, az], [bx, 0, bz]);
  };
  apron(-R, -R, R, z0); apron(-R, z1, R, R); apron(-R, z0, x0, z1); apron(x1, z0, R, z1);
}

// ---------------------------------------------------------------------------------------------------------------
function buildPitches(ground, lines, col, props) {
  for (const p of DATA.pitches) {
    const ca = Math.cos(p.a), sa = Math.sin(p.a);
    const toField = (q) => [(q[0] - p.cx) * ca + (q[2] - p.cz) * sa, -(q[0] - p.cx) * sa + (q[2] - p.cz) * ca];
    const W = (lx, lz, y = 0.012) => [p.cx + lx * ca - lz * sa, y, p.cz + lx * sa + lz * ca];
    const L = p.l, Wd = p.w;
    const line = (x0, z0, x1, z1, w = 0.1, c = WHITE) => {
      const dx = x1 - x0, dz = z1 - z0;
      const len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * w * 0.5, nz = (dx / len) * w * 0.5;
      lines.quad(W(x0 - nx, z0 - nz), W(x0 + nx, z0 + nz), W(x1 + nx, z1 + nz), W(x1 - nx, z1 - nz), UP, c);
    };
    const rect = (x0, z0, x1, z1, w, c) => { line(x0, z0, x1, z0, w, c); line(x1, z0, x1, z1, w, c); line(x1, z1, x0, z1, w, c); line(x0, z1, x0, z0, w, c); };
    const arc = (cx, cz, r, a0, a1, w, c) => {
      const n = Math.max(6, Math.round((Math.abs(a1 - a0) * r) / 0.6));
      for (let i = 0; i < n; i++) {
        const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
        line(cx + Math.cos(t0) * r, cz + Math.sin(t0) * r, cx + Math.cos(t1) * r, cz + Math.sin(t1) * r, w, c);
      }
    };
    if (p.sp === 'soccer' || p.sp === 'futsal') {
      addPoly(ground, col, p, 0, GT.turf, WHITE, toField);
      const hl = L / 2 - Math.min(2.5, L * 0.04), hw = Wd / 2 - Math.min(2.5, Wd * 0.05);
      const s = clamp(hw / 34, 0.25, 1);
      const lw = 0.12;
      rect(-hl, -hw, hl, hw, lw);
      line(0, -hw, 0, hw, lw);
      arc(0, 0, 9.15 * s, 0, Math.PI * 2, lw);
      for (const sgn of [-1, 1]) {
        const gx = sgn * hl;
        rect(gx, -20.16 * s, gx - sgn * 16.5 * s, 20.16 * s, lw);
        rect(gx, -9.16 * s, gx - sgn * 5.5 * s, 9.16 * s, lw);
        arc(gx - sgn * 11 * s, 0, 9.15 * s, sgn > 0 ? Math.PI - 0.93 : -0.93, sgn > 0 ? Math.PI + 0.93 : 0.93, lw);
        props.goals.push({ p: W(gx, 0, 0), a: p.a + (sgn > 0 ? 0 : Math.PI), w: 7.32 * Math.max(0.42, s), h: 2.44 * Math.max(0.82, s) });
      }
    } else if (p.sp === 'basketball' || p.sp === 'multi') {
      addPoly(ground, col, p, 0, GT.court, lin('#2c6a4b'), toField);
      // one or more full courts fitted into the pitch polygon
      const n = Math.max(1, Math.round(L / 32));
      const cl = Math.min(28, L / n - 3), cw = Math.min(15, Wd - 2);
      for (let k = 0; k < n; k++) {
        const ox = (k - (n - 1) / 2) * (L / n);
        const hl = cl / 2, hw = cw / 2, lw = 0.07;
        // coloured playing surface
        const c = lin('#2f5d9a');
        lines.quad(W(ox - hl, -hw, 0.006), W(ox - hl, hw, 0.006), W(ox + hl, hw, 0.006), W(ox + hl, -hw, 0.006), UP, c);
        rect(ox - hl, -hw, ox + hl, hw, lw);
        line(ox, -hw, ox, hw, lw);
        arc(ox, 0, 1.8, 0, Math.PI * 2, lw);
        for (const sgn of [-1, 1]) {
          const bx = ox + sgn * hl;
          const key = lin('#b8452f');
          lines.quad(W(bx, -2.45, 0.009), W(bx, 2.45, 0.009), W(bx - sgn * 5.8, 2.45, 0.009), W(bx - sgn * 5.8, -2.45, 0.009), UP, key);
          rect(bx, -2.45, bx - sgn * 5.8, 2.45, lw);
          arc(bx - sgn * 5.8, 0, 1.8, sgn > 0 ? Math.PI / 2 : -Math.PI / 2, sgn > 0 ? Math.PI * 1.5 : Math.PI / 2, lw);
          const hoopX = bx - sgn * 1.575;
          const r3 = Math.min(6.75, hw - 0.6);
          const a = Math.acos(clamp((hw - 0.9) / 6.75, -1, 1));
          arc(hoopX, 0, r3, sgn > 0 ? Math.PI / 2 + a * 0 : -Math.PI / 2, sgn > 0 ? Math.PI * 1.5 : Math.PI / 2, lw);
          props.hoops.push({ p: W(bx + sgn * 0.6, 0, 0), a: p.a + (sgn > 0 ? Math.PI : 0) });
        }
      }
    } else if (p.sp === 'tennis') {
      addPoly(ground, col, p, 0, GT.court, lin('#2f6f52'), toField);
      const n = Math.max(1, Math.round(Wd / 17));
      for (let k = 0; k < n; k++) {
        const oz = (k - (n - 1) / 2) * (Wd / n);
        const hl = 11.885, hw = 5.485, lw = 0.06;
        const c = lin('#3565a8');
        lines.quad(W(-hl, oz - hw, 0.006), W(-hl, oz + hw, 0.006), W(hl, oz + hw, 0.006), W(hl, oz - hw, 0.006), UP, c);
        rect(-hl, oz - hw, hl, oz + hw, lw);
        line(-hl, oz - 4.115, hl, oz - 4.115, lw); line(-hl, oz + 4.115, hl, oz + 4.115, lw);
        line(-6.4, oz - 4.115, -6.4, oz + 4.115, lw); line(6.4, oz - 4.115, 6.4, oz + 4.115, lw);
        line(-6.4, oz, 6.4, oz, lw);
        props.nets.push({ a: W(0, oz - hw - 0.9, 0), b: W(0, oz + hw + 0.9, 0) });
      }
    } else {
      addPoly(ground, col, p, 0, GT.court, lin('#356b8f'), toField);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
function polylineOffsets(pts, half) {
  // pts: [[x,y,z],...] -> { L:[[x,y,z]], R:[[x,y,z]] } with mitred joints in the horizontal plane
  const n = pts.length;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let d0x = p[0] - a[0], d0z = p[2] - a[2], d1x = b[0] - p[0], d1z = b[2] - p[2];
    let l0 = Math.hypot(d0x, d0z), l1 = Math.hypot(d1x, d1z);
    if (l0 < 1e-6) { d0x = d1x; d0z = d1z; l0 = l1; }
    if (l1 < 1e-6) { d1x = d0x; d1z = d0z; l1 = l0; }
    if (l0 < 1e-6) { L.push(p.slice()); R.push(p.slice()); continue; }
    d0x /= l0; d0z /= l0; d1x /= l1; d1z /= l1;
    let nx = -(d0z + d1z), nz = d0x + d1x;
    const nl = Math.hypot(nx, nz);
    if (nl < 1e-4) { nx = -d0z; nz = d0x; } else { nx /= nl; nz /= nl; }
    const cosHalf = Math.max(0.5, nx * -d0z + nz * d0x);
    const s = half / cosHalf;
    L.push([p[0] + nx * s, p[1], p[2] + nz * s]);
    R.push([p[0] - nx * s, p[1], p[2] - nz * s]);
  }
  return { L, R };
}

function buildDecks(ground, roofs, col) {
  const T = 0.5;       // deck slab thickness
  const RAIL = 1.05;
  const conc = [0.78, 0.78, 0.77];
  for (const d of DATA.decks) {
    const pts = [];
    for (let i = 0; i < d.p.length; i += 3) pts.push([d.p[i], d.p[i + 1], d.p[i + 2]]);
    if (pts.length < 2) continue;
    const { L, R } = polylineOffsets(pts, d.w / 2);
    const steps = d.k === 'steps';
    const type = steps ? GT.steps : GT.deck;
    const thick = steps ? 0.3 : T;
    for (let i = 0; i < pts.length - 1; i++) {
      const l0 = L[i], l1 = L[i + 1], r0 = R[i], r1 = R[i + 1];
      const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][2] - pts[i][2];
      const len = Math.hypot(dx, dz) || 1;
      const side = [dz / len, 0, -dx / len];        // points to the R side
      const dy = pts[i + 1][1] - pts[i][1];
      // physics: a smooth ramp
      col.quad(l0, l1, r1, r0);
      const b = (p) => [p[0], p[1] - thick, p[2]];
      col.quad(b(l0), b(r0), b(r1), b(l1));
      if (steps && Math.abs(dy) > 0.05) {
        // visible treads and risers
        const n = Math.max(1, Math.round(Math.abs(dy) / 0.165));
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          const mix3 = (a, c, t) => [lerp(a[0], c[0], t), lerp(a[1], c[1], t), lerp(a[2], c[2], t)];
          const la = mix3(l0, l1, t0), lb = mix3(l0, l1, t1), ra = mix3(r0, r1, t0), rb = mix3(r0, r1, t1);
          const yT = Math.max(la[1], lb[1]), yB = Math.min(la[1], lb[1]);
          ground.quad([la[0], yT, la[2]], [lb[0], yT, lb[2]], [rb[0], yT, rb[2]], [ra[0], yT, ra[2]], UP, WHITE, { aT: type, aF: [0, 0] });
          const up = dy > 0;
          const e0 = up ? la : lb, e1 = up ? ra : rb;
          const rn = up ? [-dx / len, 0, -dz / len] : [dx / len, 0, dz / len];
          const q = [[e0[0], yB, e0[2]], [e0[0], yT, e0[2]], [e1[0], yT, e1[2]], [e1[0], yB, e1[2]]];
          if (up) ground.quad(q[3], q[2], q[1], q[0], rn, [0.8, 0.8, 0.8], { aT: type, aF: [0, 0] });
          else ground.quad(q[0], q[1], q[2], q[3], rn, [0.8, 0.8, 0.8], { aT: type, aF: [0, 0] });
        }
      } else {
        ground.quad(l0, l1, r1, r0, UP, WHITE, { aT: type, aF: [0, 0] });
      }
      // underside and fascias
      roofs.quad(b(l0), b(r0), b(r1), b(l1), [0, -1, 0], [0.5, 0.5, 0.5]);
      roofs.quad(b(r0), r0, r1, b(r1), side, conc);
      roofs.quad(b(l1), l1, l0, b(l0), [-side[0], 0, -side[2]], conc);
      // parapet walls with a dark handrail
      if (d.k !== 'ramp' || pts[i][1] > 0.6) {
        const up = (p, h) => [p[0], p[1] + h, p[2]];
        const inR = (p) => [p[0] - side[0] * 0.14, p[1], p[2] - side[2] * 0.14];
        const inL = (p) => [p[0] + side[0] * 0.14, p[1], p[2] + side[2] * 0.14];
        const rail = [0.2, 0.21, 0.23];
        // right side
        roofs.quad(r0, up(r0, RAIL), up(r1, RAIL), r1, side, conc);
        roofs.quad(inR(r1), up(inR(r1), RAIL), up(inR(r0), RAIL), inR(r0), [-side[0], 0, -side[2]], conc);
        roofs.quad(up(r0, RAIL), up(inR(r0), RAIL), up(inR(r1), RAIL), up(r1, RAIL), UP, rail);
        col.quad(r0, up(r0, RAIL), up(r1, RAIL), r1);
        // left side
        roofs.quad(l1, up(l1, RAIL), up(l0, RAIL), l0, [-side[0], 0, -side[2]], conc);
        roofs.quad(inL(l0), up(inL(l0), RAIL), up(inL(l1), RAIL), inL(l1), side, conc);
        roofs.quad(up(l1, RAIL), up(inL(l1), RAIL), up(inL(l0), RAIL), up(l0, RAIL), UP, rail);
        col.quad(l1, up(l1, RAIL), up(l0, RAIL), l0);
      }
    }
    // end caps
    const cap = (i, flip) => {
      const l = L[i], r = R[i];
      const lb = [l[0], l[1] - thick, l[2]], rb = [r[0], r[1] - thick, r[2]];
      const j = flip ? 1 : pts.length - 2;
      let nx = pts[i][0] - pts[j][0], nz = pts[i][2] - pts[j][2];
      const nl = Math.hypot(nx, nz) || 1;
      nx /= nl; nz /= nl;
      if (flip) roofs.quad(lb, l, r, rb, [nx, 0, nz], conc); else roofs.quad(rb, r, l, lb, [nx, 0, nz], conc);
    };
    cap(0, true); cap(pts.length - 1, false);
    // columns
    for (let i = 0; i < (d.c || []).length; i += 3) {
      const x = d.c[i], y = d.c[i + 1], z = d.c[i + 2];
      const r = d.k === 'road' ? 0.6 : 0.42;
      roofs.cyl(x, 0, z, r, r, y - thick + 0.02, 12, [0.74, 0.74, 0.73], undefined, false);
      roofs.box(x, y - thick - 0.5, z, r * 3.2, 0.5, r * 3.2, 0, [0.72, 0.72, 0.71]);
      col.box(x, 0, z, r * 1.7, y - thick, r * 1.7, 0.4);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
function buildRoadMarkings(lines) {
  const Y = ROAD_Y + 0.012;
  const white = [0.92, 0.92, 0.9], yellow = [0.95, 0.72, 0.12];
  const dash = (pts, off, w, on, gap, c) => {
    // walk the polyline, emitting dashes (on = 0 -> solid)
    let carry = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
      const emit = (s0, s1) => {
        const x0 = ax + ux * s0 + nx * off, z0 = az + uz * s0 + nz * off;
        const x1 = ax + ux * s1 + nx * off, z1 = az + uz * s1 + nz * off;
        lines.quad([x0 - nx * w / 2, Y, z0 - nz * w / 2], [x0 + nx * w / 2, Y, z0 + nz * w / 2],
          [x1 + nx * w / 2, Y, z1 + nz * w / 2], [x1 - nx * w / 2, Y, z1 - nz * w / 2], UP, c);
      };
      if (!on) { emit(-0.05, len + 0.05); continue; }
      let s = -carry;
      const period = on + gap;
      while (s < len) {
        const s0 = Math.max(0, s), s1 = Math.min(len, s + on);
        if (s1 > s0 + 0.05) emit(s0, s1);
        s += period;
      }
      carry = (carry + len) % period;
    }
  };
  for (const r of DATA.roads) {
    const pts = [];
    for (let i = 0; i < r.p.length; i += 2) pts.push([r.p[i], r.p[i + 1]]);
    const w = r.w;
    if (r.k === 'primary') {
      dash(pts, w / 2 - 0.35, 0.15, 0, 0, white); dash(pts, -(w / 2 - 0.35), 0.15, 0, 0, white);
      const lanes = Math.max(2, Math.round((w - 1) / 3.5));
      for (let k = 1; k < lanes; k++) dash(pts, -w / 2 + 0.5 + ((w - 1) * k) / lanes, 0.15, 6, 9, white);
    } else if (r.k === 'secondary' || r.k === 'tertiary') {
      dash(pts, w / 2 - 0.3, 0.12, 0, 0, white); dash(pts, -(w / 2 - 0.3), 0.12, 0, 0, white);
      if (r.ow) { if (w > 6.5) dash(pts, 0, 0.12, 4, 6, white); } else dash(pts, 0, 0.14, 0, 0, yellow);
    } else if (r.k === 'unclassified' || r.k === 'residential') {
      if (!r.ow && w >= 6) dash(pts, 0, 0.12, 2, 4, white);
    }
  }
  // zebra crossings
  for (const q of DATA.pois) {
    if (q.k !== 'crossing') continue;
    let best = null;
    for (const r of DATA.roads) {
      if (r.k === 'service') continue;
      for (let i = 0; i < r.p.length - 2; i += 2) {
        const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3];
        const dx = bx - ax, dz = bz - az;
        const l2 = dx * dx + dz * dz;
        if (l2 < 0.01) continue;
        const t = clamp(((q.x - ax) * dx + (q.z - az) * dz) / l2, 0, 1);
        const d = Math.hypot(ax + dx * t - q.x, az + dz * t - q.z);
        if (!best || d < best.d) best = { d, ux: dx / Math.sqrt(l2), uz: dz / Math.sqrt(l2), w: r.w, x: ax + dx * t, z: az + dz * t };
      }
    }
    if (!best || best.d > 2.5) continue;
    const { ux, uz, w, x, z } = best;
    const nx = -uz, nz = ux;
    for (let k = -w / 2 + 0.55; k < w / 2 - 0.3; k += 0.95) {
      const cx = x + nx * k, cz = z + nz * k;
      const hw = 0.24, hl = 1.6;
      lines.quad([cx - nx * hw - ux * hl, Y + 0.003, cz - nz * hw - uz * hl], [cx + nx * hw - ux * hl, Y + 0.003, cz + nz * hw - uz * hl],
        [cx + nx * hw + ux * hl, Y + 0.003, cz + nz * hw + uz * hl], [cx - nx * hw + ux * hl, Y + 0.003, cz - nz * hw + uz * hl], UP, white);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
function nearestRoad(x, z, maxD = 6) {
  let best = null;
  for (const r of DATA.roads) {
    for (let i = 0; i < r.p.length - 2; i += 2) {
      const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3];
      const dx = bx - ax, dz = bz - az;
      const l2 = dx * dx + dz * dz;
      if (l2 < 0.01) continue;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (!best || d < best.d) best = { d, ux: dx / Math.sqrt(l2), uz: dz / Math.sqrt(l2), w: r.w, x: ax + dx * t, z: az + dz * t, k: r.k };
    }
  }
  return best && best.d <= maxD ? best : null;
}
export { nearestRoad };

function buildGates(roofs, col, signs) {
  const stone = [0.8, 0.78, 0.74], dark = [0.25, 0.26, 0.28];
  for (const q of DATA.pois) {
    if (q.k !== 'gate') continue;
    const r = nearestRoad(q.x, q.z, 8);
    if (!r) continue;
    // the gate faces away from the heart of the campus
    let fx = r.ux, fz = r.uz;
    const main = q.n === '致远门';
    const cx = main ? 40 : -230, cz = main ? 20 : -40;
    if (fx * (q.x - cx) + fz * (q.z - cz) < 0) { fx = -fx; fz = -fz; }
    const nx = -fz, nz = fx;
    const ang = Math.atan2(fz, fx) + Math.PI / 2;     // wall runs along (nx, nz)
    const half = r.w / 2 + 0.8;
    const len = main ? 15 : 5.5, hgt = main ? 2.9 : 2.2, thick = main ? 1.1 : 0.7;
    for (const sgn of [-1, 1]) {
      const mx = r.x + nx * sgn * (half + len / 2), mz = r.z + nz * sgn * (half + len / 2);
      roofs.box(mx, 0, mz, len, hgt, thick, ang - Math.PI / 2, stone);
      roofs.box(mx, hgt, mz, len + 0.3, 0.16, thick + 0.3, ang - Math.PI / 2, dark);
      col.box(mx, 0, mz, len, hgt + 0.16, thick, ang - Math.PI / 2);
      // pylon beside the carriageway
      const px = r.x + nx * sgn * (half - 0.1), pz = r.z + nz * sgn * (half - 0.1);
      const ph = main ? 6.2 : 3.4;
      roofs.box(px, 0, pz, 1.3, ph, 1.5, ang - Math.PI / 2, stone);
      roofs.box(px, ph, pz, 1.6, 0.25, 1.8, ang - Math.PI / 2, dark);
      col.box(px, 0, pz, 1.3, ph + 0.25, 1.5, ang - Math.PI / 2);
      const text = main ? (sgn < 0 ? '深圳大学' : '沧海校区') : (sgn < 0 ? q.n : '');
      if (text) {
        signs.push({
          text, gate: true, big: main && sgn < 0, x: mx + fx * (thick / 2 + 0.03), z: mz + fz * (thick / 2 + 0.03),
          nx: fx, nz: fz, y: hgt * 0.52, width: main ? (sgn < 0 ? 11 : 9) : 4, tall: false,
        });
      }
    }
    if (main) {
      // guard booth and a boom barrier
      const bx = r.x - nx * (half + 2.2) - fx * 4.5, bz = r.z - nz * (half + 2.2) - fz * 4.5;
      roofs.box(bx, 0, bz, 2.6, 2.7, 2.6, ang, [0.86, 0.86, 0.84]);
      roofs.box(bx, 2.7, bz, 3.4, 0.14, 3.4, ang, dark);
      col.box(bx, 0, bz, 2.6, 2.84, 2.6, ang);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
function buildSkyline(walls, roofs) {
  // a ring of generic towers beyond the mapped area: Nanshan science park, Houhai and the bay front
  const rnd = mulberry32(8848);
  const placed = [];
  let made = 0;
  for (let k = 0; k < 900 && made < 300; k++) {
    const ang = rnd() * Math.PI * 2;
    const dir = [Math.cos(ang), Math.sin(ang)];      // +x east, +z south
    // more and taller towers to the east / south-east (Houhai CBD) and north-east (science park)
    const east = Math.max(0, dir[0]), south = Math.max(0, dir[1]);
    const dens = 0.35 + 0.65 * Math.max(east, south * 0.8);
    if (rnd() > dens) continue;
    const dist = 640 + Math.pow(rnd(), 1.4) * 1900;
    const x = dir[0] * dist, z = dir[1] * dist;
    // keep Shenzhen Bay (far south-east) clear
    if (x + z * 1.2 > 2300) continue;
    const sx = 26 + rnd() * 40, sz = 22 + rnd() * 34;
    let ok = true;
    for (const p of placed) if (Math.abs(p[0] - x) < (p[2] + sx) * 0.62 && Math.abs(p[1] - z) < (p[3] + sz) * 0.62) { ok = false; break; }
    if (!ok) continue;
    placed.push([x, z, sx, sz]);
    const tallBias = 0.35 + 0.65 * Math.max(east * 0.9, south * 0.7);
    const r = rnd();
    let ht = 24 + Math.pow(r, 2.2) * 250 * tallBias;
    if (r > 0.985) ht = 300 + rnd() * 90;
    const rot = (rnd() - 0.5) * 0.9;
    const c = Math.cos(rot), s = Math.sin(rot);
    const o = [];
    for (const [lx, lz] of [[-sx / 2, -sz / 2], [sx / 2, -sz / 2], [sx / 2, sz / 2], [-sx / 2, sz / 2]]) o.push(x + lx * c - lz * s, z + lx * s + lz * c);
    const kind = ht > 90 ? 'glass' : rnd() < 0.4 ? 'glass' : rnd() < 0.5 ? 'office' : 'resi';
    const fh = kind === 'resi' ? 3.0 : 4.0;
    addBuilding({ o, h: [], ht, mh: 0, st: kind, fh, sd: rnd(), a: sx * sz, col: '', c: 0 }, walls, roofs, null, null, { noProps: ht < 60 });
    made++;
  }
}

// ---------------------------------------------------------------------------------------------------------------
export function buildWorld(scene) {
  const walls = new MB({ aB: 4, aC: 4 });
  const roofs = new MB();
  const ground = new MB({ aT: 1, aF: 2 });
  const water = new MB({ aT: 1, aF: 2 });
  const pool = new MB({ aT: 1, aF: 2 });
  const lines = new MB();
  const col = new Collider();
  const farWalls = new MB({ aB: 4, aC: 4 });
  const farRoofs = new MB();
  const extras = { beacons: [] };
  const landmarks = [];
  const signs = [];
  const props = { goals: [], hoops: [], nets: [] };

  buildBuildings(walls, roofs, col, extras, landmarks, signs);
  buildGround(ground, water, pool, col);
  buildPitches(ground, lines, col, props);
  buildDecks(ground, roofs, col);
  buildRoadMarkings(lines);
  buildGates(roofs, col, signs);
  buildSkyline(farWalls, farRoofs);

  const group = new THREE.Group();
  group.name = 'world';
  const facade = facadeMaterial();
  const roofMat = roofMaterial();
  const add = (mb, mat, { cast = true, receive = true, name = '' } = {}) => {
    if (!mb.count) return null;
    const m = new THREE.Mesh(mb.geometry(), mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    m.name = name;
    m.matrixAutoUpdate = false;
    group.add(m);
    return m;
  };
  add(walls, facade, { name: 'walls' });
  add(roofs, roofMat, { name: 'roofs' });
  add(ground, groundMaterial(), { cast: false, name: 'ground' });
  add(water, waterMaterial(false), { cast: false, name: 'water' });
  add(pool, waterMaterial(true), { cast: false, name: 'pool' });
  const lineMat = std({ vertexColors: true, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  add(lines, lineMat, { cast: false, name: 'lines' });
  add(farWalls, facade, { cast: false, name: 'farWalls' });
  add(farRoofs, roofMat, { cast: false, name: 'farRoofs' });
  scene.add(group);

  // physics collider
  const cg = col.geometry();
  const bvh = new MeshBVH(cg, { targetLeafSize: 12 });
  cg.boundsTree = bvh;

  return { group, bvh, colliderGeometry: cg, landmarks, signs, props, beacons: extras.beacons, data: DATA };
}
