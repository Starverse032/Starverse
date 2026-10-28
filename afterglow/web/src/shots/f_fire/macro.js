// f_fire/macro.js — v2 A4 [1758, 1872): the last metres of long take A, the flint, the first fire.
//
// Screenplay S02-f (end) + S02-g. 100 mm macro on a tinder bundle at R, dusk light from the WEST (screen
// left; the camera faces north), the sun 4° under the horizon. The A3 → A4 hand-off is f1758 inside
// 置换⑤ (the dry-grass wipe): `_sweep.js` (A3's) draws the shared veil + blades over this module at
// [1758, 1762); behind it the macro set "pulls out of the veil" while the push decelerates 6 % → 0
// (viewWidthAt() of `_clouds.js`, extrapolated at 6 %/frame before f1762). f1776 the camera is still:
// only a hand-held breath from then on.
//
// How it is made (photographic light by baking, not geometry): the camera is locked, every light sits at
// a fixed position, light is linear and so is defocus, so create() renders the set once per light with
// shadows (own cube distance maps, PCF), 4× MSAA, GGX + thin-sheet transmission and a depth-aware bokeh
// gather. Per frame the picture is Σ wᵢ(t)·Bᵢ (a few texture taps), zoomed about R (the deceleration) and
// moved by the breath. Plates: 0 ember · 1–3 flame (the flame light dances between them) · 4 spark cloud ·
// 5 dusk (west sky + cool skylight; full frame, mip-mapped) · 6 dusk WIDE (the same at a 1.95× wider
// field: it fills the frame edges while the push is still zoomed out, f1758–1775).
// Live: the four tinder strands that curl and char at the landing point; the ember crack glow and the
// burning front (unburnt straw → front → char); the two flint tips (out of focus, the hand off-frame);
// the sparks (analytic, motion-blurred capsules with their own bokeh); the third strike's lander with its
// 20 px tail, its 6 px landed point; the heat smoke; the footprint (f1848); the small flame (half res,
// slightly out of focus) growing 40 → 90 px.
//
// Frames (timeline A4.params): stop 1776 · strikes 1788 / 1812 / 1836 (the third: stones meet at f1833,
// the spark is in the air for 3 frames and lands on R exactly at f1836, with the sound) · footprint and
// ignition 1848 · cut 1872.
import * as THREE from 'three';
import { hex, CURSOR, RX, RY, fbm3, breath, HAND_GLSL, handUniforms, setHand, merge, tag, ribbon, plain } from './common.js';
import { viewWidthAt } from '../_clouds.js';

const FOCAL = 100;
const DF = 0.75, PITCH = 12 * Math.PI / 180;      // focus distance (m), down-tilt
const FNUM = 5.6;
const COC_A = (0.1 / FNUM) * (0.1 / (DF - 0.1)) * (1920 / 0.036) / 2;   // CoC radius px (1080p) per |1 − df/d|
const COC_MAX = 24;
const KW = 1.95;                                  // field factor of the wide dusk plate
const E = new THREE.Vector3(0, 0.010, 0);         // ember / focus / R

export const FR = { stop: 1776, s1: 1788, s2: 1812, s3c: 1833, land: 1836, ign: 1848, end: 1872 };
const T = n => n / 24;

// the push: view width at the target (m). After f1762 the A3 curve (6 % → 0); before, 6 %/frame continued.
const viewW = n => (n >= 1762 ? viewWidthAt(Math.min(n, 1776)) : viewWidthAt(1762) * Math.pow(1.06, 1762 - n));
export const zoomAt = n => viewW(1776) / viewW(n);  // displayed scale of the f1776 framing (≤ 1)

// light positions (metres); 0 ember, 1–3 flame (small: 40–90 px ≈ 6–13 mm), 4 spark cloud (set below), 5 dusk
const LIGHTS = [
  [0.000, 0.0135, 0.002],
  [0.000, 0.0330, 0.002],
  [-0.004, 0.0360, 0.004],
  [0.004, 0.0345, -0.001],
  null,
  [-2.10, 0.38, -0.55],
];
const R0 = [0.004, 0.012, 0.012, 0.012, 0.012, 0.25];

function hG(x, z) {
  let h = 0.007 * (fbm3(x * 6, 0.3, z * 6, 4, 3) - 0.5) + 0.0016 * (fbm3(x * 45, 1.7, z * 45, 3, 5) - 0.5);
  const r2 = x * x + z * z;
  h -= 0.0028 * Math.exp(-r2 / (0.032 * 0.032));
  return h;
}
const envY = r => 0.0022 + 0.016 * Math.pow(Math.min(r / 0.028, 1.0), 1.25) * (1 - 0.7 * Math.pow(Math.max(0, (r - 0.026) / 0.016), 1.5));

// zoom about R, then the hand-held breath (clip space)
const XF_GLSL = HAND_GLSL + /* glsl */ `
uniform float uZoom;
vec4 xfClip(vec4 c){
  vec2 ndc = c.xy / c.w;
  vec2 px = vec2((ndc.x * 0.5 + 0.5) * 1920.0, (0.5 - ndc.y * 0.5) * 1080.0);
  px = uHandC + (px - uHandC) * uZoom;
  ndc = vec2(px.x / 1920.0 * 2.0 - 1.0, 1.0 - px.y / 1080.0 * 2.0);
  return handClip(vec4(ndc * c.w, c.zw));
}`;

export function createMacro(ctx) {
  const { renderer, W, H, kit, GLSL, util } = ctx;
  const S = H / 1080;
  const rng = util.rng(55 * 1000 + 15);
  const { smoothstep: ss, clamp } = util;

  // ---- cameras -----------------------------------------------------------------------------------------
  const mkCam = (k, w, h) => {
    const c = kit.filmCamera(w, h, { focalMM: FOCAL / k, near: 0.01, far: 12 });
    c.position.set(0, E.y + DF * Math.sin(PITCH), DF * Math.cos(PITCH));
    c.lookAt(E);
    c.setViewOffset(w, h, (960 - RX) * S, (540 - RY) * S, w, h);   // optical axis (through the ember) on R
    c.updateProjectionMatrix(); c.updateMatrixWorld();
    return c;
  };
  const cam = mkCam(1, W, H), camWide = mkCam(KW, W, H);
  const eye = cam.position.clone();
  // a screen point (1080p px) at a given distance from the camera → world
  const unproj = (x, y, dist) => {
    const v = new THREE.Vector3(x / 1920 * 2 - 1, 1 - y / 1080 * 2, 0.5).unproject(cam).sub(eye).normalize();
    return eye.clone().addScaledVector(v, dist);
  };
  const SPW = unproj(352, 478, 0.60);                 // the flint contact point (out of focus, foreground left)
  LIGHTS[4] = [SPW.x + 0.03, SPW.y - 0.004, SPW.z - 0.05];

  // =====================================================================================================
  // GEOMETRY
  // =====================================================================================================
  const parts = [];
  const add = (g, mat, seed) => parts.push(tag(g, { mat, seed }));
  const gridGround = (x0, x1, z0, z1, step, dy, hole) => {
    const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1;
    const pos = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * step, z = z0 + j * step, k = (j * nx + i) * 3;
      pos[k] = x; pos[k + 1] = hG(x, z) + dy; pos[k + 2] = z;
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const x = x0 + (i + 0.5) * step, z = z0 + (j + 0.5) * step;
      if (hole && hole(x, z)) continue;
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    g.computeVertexNormals();
    g.setAttribute('ru', new THREE.BufferAttribute(new Float32Array(nx * nz * 2), 2));
    add(g, 0, 0);
  };
  gridGround(-0.26, 0.37, -0.56, 0.26, 0.002, 0, null);
  // the wide field and the far ground (out of focus): a coarser ring around the fine patch
  gridGround(-1.6, 1.6, -4.0, 0.42, 0.012, -0.0004, (x, z) => x > -0.25 && x < 0.36 && z > -0.55 && z < 0.25);

  const stone = (cx, cz, r, flat, seed, seg = 72, matId = 1) => {
    const g = plain(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + 0.30 * (fbm3(x * 1.3 + seed, y * 1.3, z * 1.3, 4, seed) - 0.5) + 0.05 * (fbm3(x * 7, y * 7 + seed, z * 7, 3, seed + 3) - 0.5);
      const fl = y > 0 ? flat : flat * 0.8;
      p.setXYZ(i, x * r * n, y * r * n * fl, z * r * n);
    }
    g.computeVertexNormals();
    g.translate(cx, hG(cx, cz) + r * flat * 0.25, cz);
    add(g, matId, (seed * 0.137) % 1);
  };
  stone(-0.078, -0.055, 0.034, 0.62, 3.1);          // left, behind: the stone the spark light finds
  stone(0.090, -0.020, 0.026, 0.55, 5.7);
  stone(0.045, -0.170, 0.048, 0.60, 8.3);
  stone(-0.170, -0.230, 0.060, 0.55, 11.9);
  stone(0.230, -0.120, 0.042, 0.58, 2.2);
  stone(0.140, 0.100, 0.024, 0.60, 6.6);
  stone(-0.040, -0.420, 0.070, 0.5, 9.4);
  stone(-0.130, 0.020, 0.030, 0.6, 4.4);            // left of the nest: the "few stones on the left"
  stone(-0.190, -0.070, 0.022, 0.6, 7.7);
  stone(-0.45, -0.9, 0.11, 0.5, 13.3, 40);           // far, out of focus
  stone(0.55, -1.3, 0.14, 0.5, 14.1, 40);
  for (let i = 0; i < 300; i++) {
    const x = -0.22 + rng() * 0.56, z = -0.50 + rng() * 0.72;
    if (Math.hypot(x, z) < 0.04) continue;
    const r = 0.0018 + Math.pow(rng(), 2.2) * 0.006;
    stone(x, z, r, 0.55 + rng() * 0.3, 20 + i * 1.31, 14, 5);
  }

  const blade = (bx, bz, len, w0, az, lean, bend, twist, seed, n = 14) => {
    const pts = [], ws = [];
    const y0 = hG(bx, bz) - 0.002;
    let p = new THREE.Vector3(bx, y0, bz);
    for (let k = 0; k < n; k++) {
      const s = k / (n - 1);
      pts.push([p.x, p.y, p.z]);
      ws.push(w0 * (1 - 0.88 * Math.pow(s, 1.6)));
      const a = lean + bend * s * s;
      const d = new THREE.Vector3(Math.sin(a) * Math.cos(az), Math.cos(a), Math.sin(a) * Math.sin(az));
      p = p.clone().addScaledVector(d, len / (n - 1));
    }
    const sideFn = (k, Tg) => {
      const s = k / (n - 1);
      const h = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az));
      return h.applyAxisAngle(Tg, twist * s + seed).projectOnPlane(Tg).normalize();
    };
    add(ribbon(pts, ws, { side: sideFn }), 2, seed % 1);
  };
  const tufts = [
    [-0.135, -0.085, 70, 0.15, 0.5], [0.165, -0.095, 80, 0.17, 0.5], [0.050, -0.260, 120, 0.24, 0.6],
    [-0.060, -0.330, 110, 0.22, 0.6], [0.270, -0.310, 120, 0.22, 0.6], [-0.200, -0.300, 100, 0.20, 0.6],
    [0.120, -0.420, 140, 0.26, 0.7], [-0.120, -0.470, 140, 0.26, 0.7], [0.330, -0.180, 90, 0.18, 0.6],
    [-0.215, -0.120, 70, 0.16, 0.6], [0.230, 0.020, 50, 0.10, 0.6], [0.010, -0.150, 50, 0.11, 0.5],
    [-0.052, 0.168, 26, 0.08, 0.4], [0.135, 0.150, 22, 0.075, 0.4],
    // the wide field: tufts further out and behind (soft shapes at the frame edges while zoomed out)
    [-0.42, -0.35, 90, 0.26, 0.6], [0.52, -0.40, 90, 0.26, 0.6], [-0.30, -0.80, 120, 0.34, 0.6],
    [0.30, -0.95, 120, 0.36, 0.6], [-0.70, -1.10, 120, 0.40, 0.6], [0.85, -1.20, 120, 0.40, 0.6],
    [0.05, -1.50, 140, 0.45, 0.6], [-0.38, 0.20, 40, 0.14, 0.5], [0.46, 0.16, 40, 0.14, 0.5],
    [-0.95, -0.45, 80, 0.30, 0.6], [1.0, -0.6, 80, 0.30, 0.6], [-0.15, -2.4, 160, 0.5, 0.6], [0.7, -2.6, 160, 0.5, 0.6],
  ];
  for (const [tx, tz, nb, ht, spread] of tufts) {
    const far = Math.hypot(tx, tz) > 0.5;
    for (let i = 0; i < nb; i++) {
      const az = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * (far ? 0.03 : 0.012);
      const bx = tx + Math.cos(az) * rr, bz = tz + Math.sin(az) * rr;
      const len = ht * (0.35 + 0.75 * rng());
      blade(bx, bz, len, (0.0014 + rng() * 0.0022) * (far ? 1.6 : 1), az + (rng() - 0.5) * 0.8, spread * (0.15 + 0.85 * rng()), 0.3 + rng() * 1.2, (rng() - 0.5) * 3, i * 0.618 + tx * 17, far ? 8 : 14);
    }
  }
  for (let i = 0; i < 260; i++) {
    const a = rng() * Math.PI * 2, r = 0.05 + Math.pow(rng(), 0.7) * 0.32;
    const bx = Math.cos(a) * r, bz = -Math.abs(Math.sin(a)) * r * 1.2 + 0.03;
    if (bz > 0.02 && Math.abs(bx) < 0.07) continue;
    const len = 0.03 + rng() * 0.09;
    blade(bx, bz, len, 0.0012 + rng() * 0.0018, rng() * Math.PI * 2, 1.45 + rng() * 0.1, 0.05, (rng() - 0.5) * 2, 500 + i);
  }

  // the tinder nest (as v1.3): arcs on tilted planes, straws across, bark shreds, loose strands, the lump
  const nestParts = [];
  const fibre = (pts, w, seed) => {
    const ws = pts.map((_, k) => w * (0.6 + 0.4 * Math.sin(Math.PI * k / (pts.length - 1))));
    const g = tag(ribbon(pts, ws, { eye }), { mat: 3, seed });
    parts.push(g); nestParts.push(g);
  };
  const V3 = THREE.Vector3;
  for (let i = 0; i < 330; i++) {
    const c = new V3((rng() - 0.5) * 0.012, 0, (rng() - 0.5) * 0.010);
    const tilt = (rng() - 0.5) * 2 * 0.87 * Math.pow(rng(), 0.6), ta = rng() * Math.PI * 2;
    const nrm = new V3(0, 1, 0).applyAxisAngle(new V3(Math.cos(ta), 0, Math.sin(ta)), tilt);
    const e1 = new V3(1, 0, 0).projectOnPlane(nrm).normalize(), e2 = new V3().crossVectors(nrm, e1);
    const r0 = 0.007 + Math.pow(rng(), 0.75) * 0.025;
    const ph0 = rng() * Math.PI * 2, dph = 0.7 + rng() * 2.0, n = 26, pts = [], sd = rng() * 100;
    const lift = (rng() - 0.5) * 0.005;
    for (let k = 0; k < n; k++) {
      const s2 = k / (n - 1), ph = ph0 + dph * s2;
      const rr = r0 * (1 + 0.16 * Math.sin(ph * 2.3 + sd) + 0.07 * Math.sin(ph * 7.1 + sd * 2));
      const q = c.clone().addScaledVector(e1, Math.cos(ph) * rr).addScaledVector(e2, Math.sin(ph) * rr);
      const y = envY(Math.hypot(q.x, q.z)) + q.y * 0.55 + lift + 0.0012 * Math.sin(ph * 4.3 + sd);
      pts.push([q.x, Math.max(0.0011, y), q.z]);
    }
    fibre(pts, 0.00020 + rng() * 0.00036, rng());
  }
  for (let i = 0; i < 140; i++) {
    const a0 = rng() * Math.PI * 2, rS = 0.004 + rng() * 0.03;
    const dir = a0 + Math.PI / 2 + (rng() - 0.5) * 1.6, len = 0.02 + rng() * 0.045, bend = (rng() - 0.5) * 18;
    const n = 24, pts = []; let x = Math.cos(a0) * rS - Math.cos(dir) * len * 0.5, z = Math.sin(a0) * rS - Math.sin(dir) * len * 0.5;
    const sd = rng() * 100, lift = (rng() - 0.3) * 0.004;
    for (let k = 0; k < n; k++) {
      const s2 = k / (n - 1), d = dir + bend * (s2 - 0.5) * len;
      pts.push([x, Math.max(0.0011, envY(Math.hypot(x, z)) + lift + 0.0016 * Math.sin(s2 * 5 + sd)), z]);
      x += Math.cos(d) * len / (n - 1); z += Math.sin(d) * len / (n - 1);
    }
    fibre(pts, 0.00024 + rng() * 0.0004, rng());
  }
  for (let i = 0; i < 26; i++) {
    const a0 = rng() * Math.PI * 2, rS = 0.012 + rng() * 0.02, dir = a0 + Math.PI / 2 + (rng() - 0.5), len = 0.012 + rng() * 0.02;
    const n = 12, pts = [];
    for (let k = 0; k < n; k++) {
      const s2 = k / (n - 1) - 0.5, x = Math.cos(a0) * rS + Math.cos(dir) * len * s2, z = Math.sin(a0) * rS + Math.sin(dir) * len * s2;
      pts.push([x, Math.max(0.0012, envY(Math.hypot(x, z)) + 0.001 * Math.sin(s2 * 4)), z]);
    }
    fibre(pts, 0.0009 + rng() * 0.0012, rng());
  }
  for (let i = 0; i < 80; i++) {
    const a = rng() * Math.PI * 2, r0 = 0.008 + rng() * 0.018, len = 0.012 + rng() * 0.03;
    const up = 0.1 + rng() * 0.5, curl = (rng() - 0.5) * 2.5, n = 20, pts = [];
    for (let k = 0; k < n; k++) {
      const s = k / (n - 1), aa = a + curl * s * 0.4, rr = r0 + len * s;
      const y = 0.004 + 0.016 * Math.pow(r0 / 0.03, 1.2) + up * len * s - 0.25 * len * s * s;
      pts.push([Math.cos(aa) * rr, Math.max(0.001, y), Math.sin(aa) * rr]);
    }
    fibre(pts, 0.00020 + rng() * 0.0003, rng());
  }
  {
    const g = plain(new THREE.SphereGeometry(1, 64, 44));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + 0.35 * (fbm3(x * 2.2, y * 2.2, z * 2.2, 4, 77) - 0.5);
      p.setXYZ(i, x * 0.0095 * n, y * 0.0052 * n, z * 0.0085 * n);
    }
    g.computeVertexNormals();
    g.translate(0, 0.0045, 0);
    const gg = tag(g, { mat: 4, seed: 0.5 });
    parts.push(gg); nestParts.push(gg);
  }
  const sceneGeo = merge(parts);
  const nestGeo = merge(nestParts);

  // the four strands that curl towards the landed spark (live only: they move)
  const STRANDS = [];
  {
    const dirs = [0.42, 1.12, 1.86, 2.55];
    dirs.forEach((a, i) => {
      const n = 28, pts = [];
      const a2 = a + (i % 2 ? 0.35 : -0.3);
      for (let k = 0; k < n; k++) {
        const s = k / (n - 1);
        const aa = a + (a2 - a) * s;
        const r = 0.0042 + (0.020 + 0.004 * i) * s;
        const y = Math.max(envY(r), 0.0096 - 0.006 * s) + 0.0016 + 0.0008 * Math.sin(s * 7 + i);
        pts.push([Math.cos(aa) * r, y, Math.sin(aa) * r]);
      }
      const ws = pts.map((_, k) => 0.00034 * (1 - 0.35 * k / (n - 1)));
      const g = ribbon(pts, ws, { eye });
      // s along the strand → reuse ru.x; per-strand seed
      STRANDS.push(tag(g, { mat: 6, seed: i / 4 + 0.05 }));
    });
  }
  const strandGeo = merge(STRANDS);

  // =====================================================================================================
  // BAKE
  // =====================================================================================================
  const distMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uLight: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uLight; varying vec3 vW; void main(){ gl_FragColor = vec4(length(vW - uLight)); }`,
  });
  const litMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uLight: { value: new THREE.Vector3() }, uR0: { value: 0.01 }, uShadow: { value: null },
      uCam: { value: eye }, uSoft: { value: 0.05 }, uAmb: { value: new THREE.Vector3() }, uDirK: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float mat; attribute float seed; attribute vec2 ru;
      varying vec3 vW; varying vec3 vN; varying float vMat, vSeed, vIZ; varying vec2 vRu;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        vMat = mat; vSeed = seed; vRu = ru;
        vec4 mv = viewMatrix * w; vIZ = 1.0 / max(-mv.z, 1e-3);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: GLSL.all + /* glsl */ `
      uniform vec3 uLight, uCam, uAmb; uniform float uR0, uSoft, uDirK; uniform samplerCube uShadow;
      varying vec3 vW; varying vec3 vN; varying float vMat, vSeed, vIZ; varying vec2 vRu;
      vec3 bumpN(vec3 p, vec3 n, float h){
        vec3 dpx = dFdx(p), dpy = dFdy(p); float dhx = dFdx(h), dhy = dFdy(h);
        vec3 r1 = cross(dpy, n), r2 = cross(n, dpx); float det = dot(dpx, r1);
        vec3 g = sign(det) * (dhx * r1 + dhy * r2);
        return normalize(abs(det) * n - g);
      }
      float shadowVis(vec3 P){
        vec3 D = P - uLight; float d = length(D); vec3 n = D / d;
        vec3 t1 = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))); vec3 t2 = cross(n, t1);
        float bias = 0.0007 + 0.012 * d;
        float rot = hash12(gl_FragCoord.xy) * 6.2832, v = 0.0;
        for (int i = 0; i < 16; i++){
          float a = float(i) * 2.39996 + rot, r = sqrt((float(i) + 0.5) / 16.0) * uSoft;
          float s = textureCube(uShadow, n + (t1 * cos(a) + t2 * sin(a)) * r).r;
          v += step(d - bias, s);
        }
        return v / 16.0;
      }
      void main(){
        vec3 P = vW, V = normalize(uCam - P), N = normalize(vN);
        if (dot(N, V) < 0.0) N = -N;
        vec3 alb = vec3(0.1); float rough = 0.85, f0 = 0.03, trans = 0.0, h = 0.0; vec3 tcol = vec3(1.0);
        bool bump = false;
        if (vMat < 0.5) {
          vec2 q = P.xz;
          float n1 = fbm(q * 32.0, 4), n2 = fbm(q * 170.0 + 7.0, 3), n3 = fbm(q * 9.0 + 3.0, 3);
          alb = mix(vec3(0.026, 0.019, 0.015), vec3(0.080, 0.052, 0.034), smoothstep(0.3, 0.75, n1));
          alb *= (0.65 + 0.7 * n2) * (0.8 + 0.4 * n3);
          vec2 gq = q * 1150.0; ivec2 gc = ivec2(floor(gq)); float gh = ihash2(gc);
          float gr = smoothstep(0.48, 0.22, length(fract(gq) - 0.5 - 0.2 * (hash22(vec2(gc)) - 0.5)));
          float grain = step(0.83, gh) * gr;
          alb = mix(alb, vec3(0.15, 0.13, 0.115) * (0.5 + 0.9 * hash12(vec2(gc) + 3.1)), grain * 0.85);
          h = n2 * 0.0007 + grain * 0.00025 + n1 * 0.0006;
          bump = true;
          if (gh > 0.985 && gr > 0.1) { rough = 0.16; f0 = 0.45; N = normalize(N + 0.9 * (hash33(vec3(vec2(gc), 5.0)) - 0.5)); bump = false; }
        } else if (vMat < 1.5 || vMat > 4.5) {
          vec3 q = P * 55.0 + vSeed * 31.0;
          float n1 = fbm(q, 4), n2 = fbm(q * 6.0, 3);
          vec3 base = mix(vec3(0.050, 0.046, 0.042), vec3(0.095, 0.072, 0.055), fract(vSeed * 7.3));
          if (vMat > 4.5) base = mix(base, vec3(0.16, 0.14, 0.12), step(0.8, fract(vSeed * 13.1)));
          alb = base * (0.6 + 0.8 * n1) * (0.85 + 0.3 * n2);
          float lichen = smoothstep(0.62, 0.7, fbm(P * 140.0 + 2.0, 3)) * step(vMat, 1.5);
          alb = mix(alb, vec3(0.11, 0.105, 0.08), lichen * 0.6);
          h = n1 * 0.0012 + n2 * 0.0004; bump = true; rough = 0.62 - 0.15 * n2;
        } else if (vMat < 2.5) {
          float sd = vSeed;
          vec3 straw = mix(vec3(0.40, 0.31, 0.18), vec3(0.31, 0.26, 0.18), fract(sd * 3.7));
          straw = mix(straw, vec3(0.20, 0.16, 0.11), step(0.85, fract(sd * 11.3)));
          float stripe = 0.8 + 0.2 * vnoise(vec2(vRu.y * 4.0 + sd * 50.0, vRu.x * 60.0));
          alb = straw * stripe * mix(0.55, 1.08, smoothstep(0.0, 0.35, vRu.x));
          trans = 0.55; tcol = vec3(1.0, 0.8, 0.5); rough = 0.5; f0 = 0.045;
        } else if (vMat < 3.5) {
          float sd = vSeed;
          // pale grey-yellow dry grass and bark; only a few fibres near the lump already charred
          alb = mix(vec3(0.46, 0.39, 0.27), vec3(0.32, 0.28, 0.21), fract(sd * 5.1));
          float charred = step(0.86, fract(sd * 9.7)) + (1.0 - step(0.86, fract(sd * 9.7))) * smoothstep(0.012, 0.005, length(P.xz)) * 0.7;
          alb = mix(alb, vec3(0.035, 0.028, 0.022), clamp(charred, 0.0, 1.0));
          alb *= 0.75 + 0.5 * vnoise(vec2(vRu.x * 40.0, sd * 77.0));
          trans = 0.38 * (1.0 - clamp(charred, 0.0, 1.0)); tcol = vec3(1.0, 0.82, 0.55); rough = 0.6;
        } else {
          vec3 q = (P - vec3(0.0, 0.0045, 0.0)) * 500.0;
          float ash = smoothstep(0.55, 0.75, fbm(q, 4));
          alb = mix(vec3(0.018, 0.016, 0.015), vec3(0.11, 0.105, 0.10), ash);
          h = fbm(q * 2.0, 3) * 0.0003; bump = true; rough = 0.95;
        }
        if (bump) N = bumpN(P, N, h);
        vec3 Lv = uLight - P; float d2 = dot(Lv, Lv); vec3 L = Lv * inversesqrt(d2);
        float att = uDirK / (d2 + uR0 * uR0);
        float vis = shadowVis(P);
        float nl = dot(N, L);
        vec3 col = alb / PI * max(nl, 0.0);
        col += alb * tcol / PI * max(-nl, 0.0) * trans;
        if (nl > 0.0) {
          vec3 Hh = normalize(L + V); float nh = max(dot(N, Hh), 0.0), nv = max(dot(N, V), 1e-3);
          float a = rough * rough, a2 = a * a, dd = nh * nh * (a2 - 1.0) + 1.0, D = a2 / (PI * dd * dd);
          float k = (rough + 1.0) * (rough + 1.0) / 8.0, G = nl / (nl * (1.0 - k) + k) * nv / (nv * (1.0 - k) + k);
          float F = f0 + (1.0 - f0) * pow(1.0 - max(dot(Hh, V), 0.0), 5.0);
          col += vec3(D * G * F / (4.0 * nv));
        }
        col *= att * vis;
        // skylight (dusk plate only): cool from above, a little from the west, no shadow but a cheap
        // cavity term (deep inside the bundle and at the stone feet the sky is hidden)
        if (dot(uAmb, uAmb) > 0.0) {
          float cav = vMat > 2.5 && vMat < 3.5 ? 0.55 + 0.45 * smoothstep(0.004, 0.016, P.y) : 1.0;
          col += alb * uAmb * (0.40 + 0.45 * N.y + 0.15 * max(-N.x, 0.0)) * cav * (1.0 + trans * 0.5);
        }
        gl_FragColor = vec4(col, vIZ);
      }`,
  });
  const bakeScene = new THREE.Scene();
  const bakeMesh = new THREE.Mesh(sceneGeo, litMat);
  bakeMesh.frustumCulled = false;
  bakeScene.add(bakeMesh);

  const cubeRT = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true });
  const cubeCam = new THREE.CubeCamera(0.0008, 8, cubeRT);
  bakeScene.add(cubeCam);
  const beauty = ctx.makeRT(W, H, { depth: true, samples: 4 });

  const dof = kit.fullscreen(/* glsl */ `
    uniform sampler2D uSrc; uniform vec2 uRes; uniform float uDF, uA, uMax, uS;
    float coc(float iz){ return iz <= 1e-4 ? uMax * uS : min(uMax, uA * abs(1.0 - uDF * iz)) * uS; }
    void main(){
      vec2 px = gl_FragCoord.xy;
      vec4 c0 = texture2D(uSrc, px / uRes);
      float cc = coc(c0.a), Rm = uMax * uS, r1 = 5.0 * uS;
      float rot = hash12(px) * 6.2832;
      const int N1 = 40, N2 = 112;
      float A1 = PI * r1 * r1 / float(N1), A2 = PI * (Rm * Rm - r1 * r1) / float(N2);
      float wc = 1.0 / max(PI * cc * cc, 1.0);
      vec3 sum = c0.rgb * wc; float wsum = wc;
      for (int i = 0; i < N1 + N2; i++){
        bool inner = i < N1;
        float fi = inner ? float(i) : float(i - N1);
        float r = inner ? r1 * sqrt((fi + 0.5) / float(N1)) : sqrt(r1 * r1 + (Rm * Rm - r1 * r1) * (fi + 0.5) / float(N2));
        float a = fi * 2.39996 + rot + (inner ? 0.0 : 1.3);
        vec2 o = vec2(cos(a), sin(a)) * r;
        vec4 s = texture2D(uSrc, (px + o) / uRes);
        float cs = coc(s.a);
        float cov = s.a >= c0.a * 0.985 ? cs : min(cs, cc);
        float w = clamp(cov - r + 0.5, 0.0, 1.0) * (inner ? A1 : A2) / max(PI * cov * cov, 1.0);
        sum += s.rgb * w; wsum += w;
      }
      gl_FragColor = vec4(sum / wsum, 1.0);
    }`, {
    uSrc: { value: beauty.texture }, uRes: { value: new THREE.Vector2(W, H) }, uDF: { value: DF },
    uA: { value: COC_A }, uMax: { value: COC_MAX }, uS: { value: S },
  });

  const DUSK_K = 2.5, DUSK_AMB = [0.095, 0.112, 0.160];   // tuned: tinder lit face L 30–50, ground darker
  const plates = [];
  const prevClear = new THREE.Color(); renderer.getClearColor(prevClear); const prevAlpha = renderer.getClearAlpha();
  const bakeOne = (li, camera, out, uS) => {
    const L = new THREE.Vector3(...LIGHTS[li]);
    bakeScene.overrideMaterial = distMat;
    distMat.uniforms.uLight.value.copy(L);
    cubeCam.position.copy(L); cubeCam.updateMatrixWorld();
    renderer.setClearColor(0xffffff, 1);
    cubeCam.update(renderer, bakeScene);
    bakeScene.overrideMaterial = null;
    const U = litMat.uniforms;
    U.uLight.value.copy(L); U.uR0.value = R0[li]; U.uShadow.value = cubeRT.texture;
    U.uSoft.value = li === 0 ? 0.12 : li === 5 ? 0.025 : 0.06;
    U.uDirK.value = li === 5 ? DUSK_K * 4.9 : 1;                 // dusk: a far source, K ≈ irradiance · d²
    if (li === 5) U.uAmb.value.set(...DUSK_AMB); else U.uAmb.value.set(0, 0, 0);
    renderer.setRenderTarget(beauty); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(bakeScene, camera);
    dof.material.uniforms.uS.value = uS;
    dof.render(renderer, out);
  };
  for (let i = 0; i < 6; i++) {
    const out = i === 5 ? ctx.makeRT(W, H, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }) : ctx.makeRT(W, H);
    bakeOne(i, cam, out, S);
    plates.push(out);
  }
  {
    const out = ctx.makeRT(W, H, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    bakeOne(5, camWide, out, S / KW);           // CoC in wide texels = full CoC / KW (as if minified)
    plates.push(out);
  }
  renderer.setRenderTarget(null); renderer.setClearColor(prevClear, prevAlpha);
  cubeRT.dispose(); beauty.dispose(); litMat.dispose(); distMat.dispose(); sceneGeo.dispose();

  // =====================================================================================================
  // LIVE LAYERS
  // =====================================================================================================
  const hand = handUniforms();
  const zoomU = { value: 1 };
  const plateU = {
    ...hand, uZoom: zoomU, uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uT: { value: 0 }, uHaze: { value: 0 },
    uFl: { value: new THREE.Vector3(RX, RY, 60) }, uKW: { value: KW },
  };
  for (let i = 0; i < 7; i++) { plateU['uB' + i] = { value: plates[i].texture }; plateU['uW' + i] = { value: new THREE.Vector3() }; }
  const platePass = kit.fullscreen(HAND_GLSL + /* glsl */ `
    uniform sampler2D uB0, uB1, uB2, uB3, uB4, uB5, uB6; uniform vec3 uW0, uW1, uW2, uW3, uW4, uW5, uW6;
    uniform vec2 uRes; uniform float uS, uT, uHaze, uZoom, uKW; uniform vec3 uFl;
    vec2 uvOf(vec2 p){ return vec2(p.x / 1920.0, 1.0 - p.y / 1080.0); }
    void main(){
      vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;
      vec2 src = handInv(px);
      float m = uHaze * exp(-pow((src.x - uFl.x) / 40.0, 2.0)) * smoothstep(uFl.y + 10.0, uFl.y - 30.0, src.y)
              * smoothstep(uFl.y - uFl.z - 220.0, uFl.y - uFl.z * 0.5, src.y);
      if (m > 0.003) {
        vec2 q = src * vec2(0.06, 0.035) + vec2(0.0, uT * 3.1);
        src += (vec2(vnoise(q), vnoise(q + 17.3)) - 0.5) * 3.0 * m;
      }
      vec2 q = uHandC + (src - uHandC) / uZoom;                  // the f1776 framing, zoomed out about R
      vec2 uv = uvOf(q);
      float inF = smoothstep(0.0, 48.0, min(min(q.x, 1920.0 - q.x), min(q.y, 1080.0 - q.y)));
      vec3 c = vec3(0.0);
      vec3 dusk = inF > 0.999 ? texture2D(uB5, uv).rgb : mix(texture2D(uB6, uvOf(uHandC + (q - uHandC) / uKW)).rgb, inF > 0.0 ? texture2D(uB5, uv).rgb : vec3(0.0), inF);
      c += uW5 * dusk;
      if (dot(uW0, uW0) > 0.0) c += uW0 * texture2D(uB0, uv).rgb;
      if (dot(uW1, uW1) > 0.0) c += uW1 * texture2D(uB1, uv).rgb;
      if (dot(uW2, uW2) > 0.0) c += uW2 * texture2D(uB2, uv).rgb;
      if (dot(uW3, uW3) > 0.0) c += uW3 * texture2D(uB3, uv).rgb;
      if (dot(uW4, uW4) > 0.0) c += uW4 * texture2D(uB4, uv).rgb;
      gl_FragColor = vec4(c, 1.0);
    }`, plateU);

  // ---- tinder: ember cracks, burning front + char (over the plate), and the four live strands -------------
  const emU = { ...hand, uZoom: zoomU, uT: { value: 0 }, uRh: { value: 0 }, uEmb: { value: 0 }, uE: { value: E.clone() }, uBurn: { value: 0 } };
  const nestVS = XF_GLSL + /* glsl */ `
    attribute float mat; attribute float seed; attribute vec2 ru;
    varying vec3 vW; varying float vMat, vSeed; varying vec2 vRu;
    void main(){
      vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vMat = mat; vSeed = seed; vRu = ru;
      gl_Position = xfClip(projectionMatrix * viewMatrix * w);
    }`;
  const nestDepth = new THREE.ShaderMaterial({ uniforms: emU, vertexShader: nestVS, fragmentShader: 'void main(){ gl_FragColor = vec4(0.0); }', colorWrite: false, side: THREE.DoubleSide });
  const nestEmit = new THREE.ShaderMaterial({
    uniforms: emU, vertexShader: nestVS, side: THREE.DoubleSide, depthWrite: false, depthFunc: THREE.LessEqualDepth, transparent: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    fragmentShader: GLSL.all + /* glsl */ `
      uniform float uT, uRh, uEmb, uBurn; uniform vec3 uE;
      varying vec3 vW; varying float vMat, vSeed; varying vec2 vRu;
      void main(){
        float r = length(vW - uE);
        float br = 0.78 + 0.16 * sin(6.2832 * 0.43 * uT - r * 260.0 + vSeed * 2.0) + 0.10 * sin(6.2832 * 0.67 * uT + r * 410.0);
        vec3 emi = vec3(0.0); float a = 0.0;
        if (vMat > 3.5) {                                   // the lump: Worley crack glow, 900–1400 K
          vec3 q = (vW - vec3(0.0, 0.0045, 0.0)) * 520.0;
          vec2 w = worley(q + vec3(0.0, uT * 0.04, 0.0));
          float crack = 1.0 - smoothstep(0.015, 0.14, w.y - w.x);
          float hot = smoothstep(uRh + 0.002, uRh * 0.35, r);
          float n = vnoise(q * 0.35 + uT * 0.2);
          float g = (crack * (2.0 + 1.5 * n) + 0.15 * (0.5 + n)) * hot * br;
          emi = blackbody(mix(900.0, 1400.0, clamp(g * 0.33, 0.0, 1.0))) * g * 1.3;
        } else {                                            // fibres: char inside, a thin glowing front
          float n = vnoise(vec2(vRu.x * 90.0, vSeed * 91.0)), n2 = vnoise(vec2(vRu.x * 23.0 - uT * 0.6, vSeed * 13.0));
          float rj = r + 0.0018 * (n - 0.5);
          float front = exp(-pow((rj - uRh) / 0.0011, 2.0));
          float inner = smoothstep(uRh + 0.0004, uRh - 0.0022, rj);
          float g = front * (0.35 + 1.1 * n * n2) + inner * 0.05 * n * n * uBurn;
          emi = blackbody(mix(950.0, 1450.0, clamp(g * br, 0.0, 1.0))) * g * br * 2.6;
          a = inner * 0.86;                                 // char: the straw under the front goes black
        }
        gl_FragColor = vec4(emi * uEmb, a * step(0.001, uEmb));
      }`,
  });
  const stU = {
    ...hand, uZoom: zoomU, uT: { value: 0 }, uE: { value: E.clone() }, uCurl: { value: 0 }, uChar: { value: 0 }, uRh: { value: 0 },
    uDusk: { value: new THREE.Vector3() }, uAmb: { value: new THREE.Vector3() },
    uFlC: { value: new THREE.Vector3() }, uFlP: { value: new THREE.Vector3(...LIGHTS[1]) }, uEmC: { value: new THREE.Vector3() },
  };
  const strandMat = new THREE.ShaderMaterial({
    uniforms: stU, side: THREE.DoubleSide,
    vertexShader: XF_GLSL + /* glsl */ `
      attribute float seed; attribute vec2 ru;
      uniform vec3 uE; uniform float uCurl;
      varying vec3 vW; varying float vS, vSeed; varying vec2 vRu;
      void main(){
        vec3 p = position;
        float s = ru.x;
        // the near end bends towards the heat and lifts a little (2–6 px)
        float k = pow(1.0 - s, 2.0) * uCurl * (0.75 + 0.5 * fract(seed * 7.0));
        vec3 toE = uE - p; toE.y = 0.0;
        p += normalize(toE + 1e-6) * 0.00075 * k + vec3(0.0, 0.0006 * k, 0.0);
        vW = p; vS = s; vSeed = seed; vRu = ru;
        gl_Position = xfClip(projectionMatrix * viewMatrix * vec4(p, 1.0));
      }`,
    fragmentShader: GLSL.all + /* glsl */ `
      uniform float uT, uChar, uRh; uniform vec3 uE, uDusk, uAmb, uFlC, uFlP, uEmC;
      varying vec3 vW; varying float vS, vSeed; varying vec2 vRu;
      void main(){
        vec3 alb = mix(vec3(0.46, 0.39, 0.27), vec3(0.36, 0.31, 0.22), fract(vSeed * 5.1)) * (0.8 + 0.4 * vnoise(vec2(vS * 30.0, vSeed * 50.0)));
        // charring runs out from the hot end; a bright front at its edge
        float cpos = uChar * 0.55 + max(0.0, (uRh - 0.006) / 0.03);
        float charred = smoothstep(cpos + 0.02, cpos - 0.06, vS);
        float front = exp(-pow((vS - cpos) / 0.035, 2.0)) * step(0.001, uChar);
        alb = mix(alb, vec3(0.03, 0.025, 0.02), charred);
        float across = 1.0 - vRu.y * vRu.y;
        vec3 col = alb * (uDusk * (0.55 + 0.45 * across) + uAmb);
        float df = distance(vW, uFlP); col += alb * uFlC / (df * df + 0.0001) * 0.6;
        float de = distance(vW, uE); col += alb * uEmC / (de * de + 0.00002);
        col += blackbody(mix(1000.0, 1500.0, front)) * front * 2.2 * (0.8 + 0.2 * sin(uT * 23.0 + vSeed * 9.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const nestScene = new THREE.Scene();
  const nestD = new THREE.Mesh(nestGeo, nestDepth), nestE = new THREE.Mesh(nestGeo, nestEmit), strands = new THREE.Mesh(strandGeo, strandMat);
  nestD.frustumCulled = nestE.frustumCulled = strands.frustumCulled = false; nestE.renderOrder = 2; strands.renderOrder = 1;
  nestScene.add(nestD, strands, nestE);

  // ---- flame: 9 sheets of advected noise, blackbody, half resolution, slightly out of focus ----------------
  const noiseTex = kit.bake(renderer, {
    w: 256, h: 256, mipmaps: true, float: false,
    frag: /* glsl */ `
      float tn(vec2 p, float P, int s){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        ivec2 o = ivec2(s * 131, s * 71);
        float a = ihash2(ivec2(mod(i, P)) + o), b = ihash2(ivec2(mod(i + vec2(1, 0), P)) + o);
        float c = ihash2(ivec2(mod(i + vec2(0, 1), P)) + o), d = ihash2(ivec2(mod(i + vec2(1, 1), P)) + o);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
      float tf(vec2 p, float P, int s){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * tn(p, P, s + i); p *= 2.0; P *= 2.0; a *= 0.5; } return v / 0.96875; }
      void main(){ vec2 p = vUv * 6.0; gl_FragColor = vec4(tf(p, 6.0, 1), tf(p, 6.0, 9), tf(p * 2.0, 12.0, 17), 1.0); }`,
  });
  const flameRT = ctx.makeRT(Math.round(W / 2), Math.round(H / 2));
  const NSHEET = 9, FL_ROOT = 4;
  const sheets = [];
  for (let k = 0; k < NSHEET; k++) sheets.push({ dx: (rng() - 0.5) * 0.85, w: 0.45 + rng() * 0.40, h: 0.6 + rng() * 0.55, seed: rng(), gain: 0.5 + rng() * 0.6 });
  sheets.sort((a, b) => b.w - a.w);
  const shGeo = new THREE.BufferGeometry();
  {
    const cor = [], par = [], idx = [], gains = [];
    sheets.forEach((s, k) => {
      for (const [cx, cy] of [[-1, 0], [1, 0], [-1, 1.25], [1, 1.25]]) { cor.push(cx, cy); par.push(s.dx, s.w, s.h, s.seed); gains.push(s.gain); }
      const b = k * 4; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    });
    shGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cor.length / 2 * 3), 3));
    shGeo.setAttribute('corner', new THREE.BufferAttribute(new Float32Array(cor), 2));
    shGeo.setAttribute('par', new THREE.BufferAttribute(new Float32Array(par), 4));
    shGeo.setAttribute('gain', new THREE.BufferAttribute(new Float32Array(gains), 1));
    shGeo.setIndex(idx);
  }
  // uHt: flame height (px); sheet widths and offsets scale with it
  const flU = { ...hand, uT: { value: 0 }, uF: { value: 0 }, uHt: { value: 60 }, uBase: { value: new THREE.Vector2(RX, RY + FL_ROOT) }, uNoise: { value: noiseTex }, uFlick: { value: 1 } };
  const flMat = new THREE.ShaderMaterial({
    uniforms: flU, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    vertexShader: HAND_GLSL + /* glsl */ `
      attribute vec2 corner; attribute vec4 par; attribute float gain;
      uniform float uHt; uniform vec2 uBase; varying vec2 vQ; varying vec2 vP;
      void main(){
        float h = uHt * par.z * 0.9, w = par.y * uHt * 0.7;
        vec2 px = uBase + vec2(par.x * uHt * 0.75 * (1.0 - 0.45 * corner.y) + corner.x * w, -corner.y * h);
        vQ = corner; vP = vec2(par.w, gain);
        gl_Position = handClip(vec4(px.x / 1920.0 * 2.0 - 1.0, 1.0 - px.y / 1080.0 * 2.0, 0.0, 1.0));
      }`,
    fragmentShader: GLSL.common + /* glsl */ `
      uniform float uT, uF, uFlick; uniform sampler2D uNoise; varying vec2 vQ; varying vec2 vP;
      void main(){
        float y = vQ.y, sd = vP.x;
        float spd = 1.6 + 0.6 * sd;
        vec2 nuv = vec2(vQ.x * 0.18 + sd * 7.31, y * 0.46 - uT * spd * 0.55);
        vec3 n1 = texture2D(uNoise, nuv).rgb;
        vec3 n2 = texture2D(uNoise, nuv * vec2(2.3, 1.9) + (n1.rg - 0.5) * 0.3 + vec2(0.0, -uT * 0.6)).rgb;
        float sway = (n1.r - 0.5) * 1.4 * y * y + 0.16 * sin(uT * (2.6 + 1.5 * sd) + sd * 9.0 - y * 2.6) * y;
        float x = vQ.x - sway;
        float wy = 0.44 * sqrt(smoothstep(-0.03, 0.18, y)) * pow(max(1.0 - smoothstep(0.05, 1.22, y), 0.0), 0.8) * (1.0 - 0.5 * y) + 1e-3;
        float body = smoothstep(wy, wy * 0.25, abs(x));
        float tongue = smoothstep(0.2, 0.62, n2.g * 1.25 + 0.72 - y * 1.1 + 0.3 * (n1.b - 0.5));
        float dens = body * mix(1.0, tongue, smoothstep(0.04, 0.45, y)) * smoothstep(-0.04, 0.2, y + 0.06 * (n1.g - 0.5));
        float core = smoothstep(wy * 0.8, 0.0, abs(x)) * exp(-pow((y - 0.22) / 0.25, 2.0));
        // 1200–1900 K: the body sits at 1300–1600 K (orange, saturated through the tone curve), only the
        // small core goes to 1900 K and HDR ≈ 3
        float Tk = 1200.0 + 700.0 * clamp(0.85 * core * core + 0.30 * (1.0 - y) * body - 0.18 * y + 0.12 * (n2.b - 0.5), 0.0, 1.0);
        vec3 c = blackbody(Tk) * dens * (0.22 + 1.2 * core * core + 0.2 * (1.0 - y)) * vP.y;
        gl_FragColor = vec4(c * uF * uFlick, 1.0);
      }`,
  });
  const flScene = new THREE.Scene();
  const flMesh = new THREE.Mesh(shGeo, flMat); flMesh.frustumCulled = false; flScene.add(flMesh);
  // smoke: a 2 px grey thread from the heated spot (f1838–1848), then the flame's plume
  const smU = { ...hand, uT: flU.uT, uF: flU.uF, uHt: flU.uHt, uBase: flU.uBase, uNoise: flU.uNoise, uSmk: { value: 0 }, uThr: { value: 0 } };
  const smGeo = new THREE.BufferGeometry();
  smGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0]), 3));
  smGeo.setIndex([0, 1, 2, 1, 3, 2]);
  const smMat = new THREE.ShaderMaterial({
    uniforms: smU, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    vertexShader: HAND_GLSL + /* glsl */ `
      uniform vec2 uBase; varying vec2 vPx;
      void main(){
        vec2 px = uBase + vec2(position.x * 200.0, -position.y * 420.0 + 6.0);
        vPx = px;
        gl_Position = handClip(vec4(px.x / 1920.0 * 2.0 - 1.0, 1.0 - px.y / 1080.0 * 2.0, 0.0, 1.0));
      }`,
    fragmentShader: GLSL.common + /* glsl */ `
      uniform float uT, uF, uHt, uSmk, uThr; uniform vec2 uBase; uniform sampler2D uNoise; varying vec2 vPx;
      void main(){
        float h = uBase.y - vPx.y;
        vec3 col = vec3(0.0);
        // the thread: 2 px, grey, lit a little by the ember from below and by the dusk from the left
        if (uThr > 0.0) {
          float xc = uBase.x + 9.0 * sin(h * 0.045 - uT * 1.4) * smoothstep(8.0, 60.0, h) + 0.0012 * h * h;
          float wd = 1.0 + 0.012 * h;
          float xn = (vPx.x - xc) / wd;
          float th = exp(-xn * xn) * smoothstep(-2.0, 6.0, h) * smoothstep(uThr * 200.0, uThr * 200.0 - 80.0, h);
          col += (vec3(0.030, 0.031, 0.034) + vec3(0.20, 0.07, 0.02) * exp(-h / 18.0)) * th * clamp(uThr * 3.0, 0.0, 1.0) * (1.0 - uSmk);
        }
        if (uSmk > 0.0) {
          float h0 = uHt * 0.6;
          float xc = uBase.x + 16.0 * sin(h * 0.016 - uT * 0.6) * smoothstep(30.0, 200.0, h) + 0.0002 * h * h;
          float wd = 6.0 + 0.13 * h;
          float xn = (vPx.x - xc) / wd;
          vec2 q = vec2(xn * 0.11 + h * 0.0013, h * 0.003 - uT * 0.13);
          vec3 n1 = texture2D(uNoise, q).rgb;
          vec3 n2 = texture2D(uNoise, q * vec2(2.4, 2.1) + (n1.rg - 0.5) * 0.25 + vec2(0.0, -uT * 0.08)).rgb;
          float body = exp(-xn * xn * (1.2 + 1.2 * n1.r));
          float dens = body * smoothstep(0.32, 0.8, n1.g * 0.75 + n2.b * 0.55) * smoothstep(h0 * 0.6, h0 * 1.4, h) * (1.0 - smoothstep(220.0, 400.0, h));
          vec3 lit = vec3(1.0, 0.45, 0.17) * (0.22 * exp(-max(h - h0, 0.0) / 90.0)) + vec3(0.008, 0.008, 0.009);
          col += lit * dens * uSmk * clamp(uF, 0.0, 1.0);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const smMesh = new THREE.Mesh(smGeo, smMat); smMesh.frustumCulled = false; smMesh.renderOrder = -1;
  const smScene = new THREE.Scene(); smScene.add(smMesh);
  const flCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const comp = kit.compositor();
  const FL_COC = 5;                                            // 1080p px: "slightly out of focus"
  const flameBlur = ctx.makeRT(Math.round(W / 2), Math.round(H / 2));
  const flBlur = kit.fullscreen(/* glsl */ `
    uniform sampler2D uSrc; uniform vec2 uRes; uniform float uR;
    void main(){
      vec2 px = gl_FragCoord.xy; vec3 s = vec3(0.0);
      for (int i = 0; i < 24; i++){
        float r = uR * sqrt((float(i) + 0.5) / 24.0), a = float(i) * 2.39996;
        s += texture2D(uSrc, (px + vec2(cos(a), sin(a)) * r) / uRes).rgb;
      }
      gl_FragColor = vec4(s / 24.0, 1.0);
    }`, { uSrc: { value: flameRT.texture }, uRes: { value: new THREE.Vector2(flameRT.width, flameRT.height) }, uR: { value: FL_COC * S / 2 } });
  {
    const x0 = Math.floor((RX - 160) * S / 2), y0 = Math.floor((1080 - (RY + 40)) * S / 2);
    const box = new THREE.Vector4(x0, y0, Math.ceil(320 * S / 2), Math.ceil(300 * S / 2));
    flameRT.scissor.copy(box); flameBlur.scissor.copy(box);
  }

  // ---- the flint and the striker: two out-of-focus stone tips at the left frame edge ------------------
  const tipsU = {
    ...hand, uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uT1: { value: new THREE.Vector2() }, uT2: { value: new THREE.Vector2() },
    uIn: { value: 0 }, uSpark: { value: 0 }, uSpC: { value: new THREE.Vector3() },
  };
  const tips = kit.fullscreen(HAND_GLSL + /* glsl */ `
    uniform vec2 uRes, uT1, uT2; uniform float uS, uIn, uSpark; uniform vec3 uSpC;
    float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2){
      vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2, v0 = p - p0, v1 = p - p1, v2 = p - p2;
      vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
      vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
      vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
      float s = sign(e0.x * e2.y - e0.y * e2.x);
      vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
      return -sqrt(d.x) * sign(d.y);
    }
    float sdUC(vec2 p, vec2 pa, vec2 pb, float ra, float rb){         // uneven capsule (iq)
      p -= pa; pb -= pa; float h = dot(pb, pb);
      vec2 q = vec2(dot(p, vec2(pb.y, -pb.x)), dot(p, pb)) / h;
      q.x = abs(q.x);
      float b = ra - rb; vec2 c = vec2(sqrt(h - b * b), b);
      float k = c.x * q.y - c.y * q.x, m = dot(c, q), n = dot(q, q);
      if (k < 0.0) return sqrt(h * n) - ra;
      else if (k > c.x) return sqrt(h * (n + 1.0 - 2.0 * q.y)) - rb;
      return m - ra;
    }
    // a hand-sized stone seen end-on: a blunt, slightly faceted point, lumpy outline
    float stoneSD(vec2 p, vec2 base, vec2 tip, float ra, float rb, float seed){
      vec2 pb = tip - normalize(tip - base) * rb;
      float d = sdUC(p, base, pb, ra, rb);
      d += 10.0 * (vnoise(p * 0.022 + seed) - 0.5) + 3.0 * (vnoise(p * 0.07 + seed * 3.0) - 0.5);
      return d;
    }
    void main(){
      vec2 px = handInv(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS);
      if (px.x > 560.0 || uIn <= 0.0) { gl_FragColor = vec4(0.0); return; }
      const float BL = 24.0;                                  // defocus half-width
      vec3 col = vec3(0.0); float al = 0.0;
      for (int k = 0; k < 2; k++){
        vec2 tip = k == 0 ? uT1 : uT2;
        vec2 base = k == 0 ? tip + vec2(-400.0, -170.0) : tip + vec2(-380.0, 180.0);
        float ra = k == 0 ? 125.0 : 140.0, rb = k == 0 ? 20.0 : 28.0;
        float sd = stoneSD(px, base, tip, ra, rb, float(k) * 5.1);
        float cov = smoothstep(BL, -BL, sd);
        if (cov <= 0.0) continue;
        vec2 g = vec2(stoneSD(px + vec2(4.0, 0.0), base, tip, ra, rb, float(k) * 5.1) - sd, stoneSD(px + vec2(0.0, 4.0), base, tip, ra, rb, float(k) * 5.1) - sd);
        vec2 nrm = normalize(g + 1e-5);                      // outward normal (screen, y down)
        float edge = smoothstep(-34.0, -4.0, sd);
        vec3 rock = (k == 0 ? vec3(0.016, 0.0155, 0.016) : vec3(0.022, 0.019, 0.016)) * (0.7 + 0.6 * vnoise(px * 0.018 + float(k) * 3.0));
        // the west sky catches the upper-left edges
        rock += vec3(0.050, 0.055, 0.068) * edge * max(dot(nrm, normalize(vec2(-0.5, -0.85))), 0.0);
        // the sparks light the edges that face them (right / down-right)
        rock += uSpC * uSpark * (0.25 + 0.75 * edge) * max(dot(nrm, normalize(vec2(1.0, 0.25))), 0.0);
        col = mix(col, rock, cov); al = max(al, cov);
      }
      gl_FragColor = vec4(col * al * uIn, al * uIn);
    }`, tipsU, { blending: THREE.CustomBlending, transparent: true });
  {
    const m = tips.material;
    m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation;
  }
  // stone motion: the flint swings onto the striker at each strike and recoils
  const STRIKE_CONTACT = [FR.s1, FR.s2, FR.s3c];
  const tipPos = n => {
    let sw = 0;
    for (const c of STRIKE_CONTACT) {
      const u = n - c;
      if (u >= -6 && u < 0) sw = Math.max(sw, Math.pow((u + 6) / 6, 2));            // swing in
      else if (u >= 0 && u < 10) sw = Math.max(sw, Math.exp(-u / 2.4) * (1 - u / 10)); // recoil
    }
    const slide = (1 - ss(1777, 1786, n)) * 330;              // the stones come into frame after the stop
    const drift = 3 * Math.sin(n * 0.21) + 2 * Math.sin(n * 0.37 + 1);
    const t1 = [318 - slide + 34 * sw + drift, 432 - slide * 0.2 + 44 * sw];
    const t2 = [306 - slide * 1.05 + 4 * sw, 520 + slide * 0.15 - 6 * sw + 0.6 * drift];
    return { t1, t2, inF: n >= 1776 ? 1 : 0 };
  };

  // ---- sparks ---------------------------------------------------------------------------------------------
  const G = 4.9, KD = 3.2, SHUT = 0.5 / 24;
  const SP = [SPW.x, SPW.y, SPW.z];
  const sparks = [];
  const strike = (n0, nSp, seed, gain = 1) => {
    const r = util.rng(seed);
    const t0 = T(n0);
    for (let i = 0; i < nSp; i++) {
      const sp = 0.22 + Math.pow(r(), 0.7) * 0.6;
      const d = [0.45 + 0.55 * r(), -0.55 + 0.75 * r(), -0.95 + 0.6 * r()];
      const L = Math.hypot(...d);
      const tb = t0 - 0.5 / 24 + r() * 0.012;
      sparks.push({ p0: SP.map(x => x + (r() - 0.5) * 0.004), v0: d.map(x => x / L * sp), tb, life: (6 + r() * 4) / 24, kind: 0, seed: r(), I0: gain * (34 + 60 * Math.pow(r(), 1.5)), T0: 2700 + 700 * r(), shut: SHUT });
    }
  };
  strike(FR.s1, 30, 1501, 0.85);
  strike(FR.s2, 60, 1502);
  strike(FR.s3c, 26, 1503, 0.8);
  // the lander: from the contact (f1833) to E, landing at f1836 exactly
  const T_LAND = T(FR.land) - 0.0005;
  {
    const r = util.rng(1505);
    const tb = T(FR.s3c) - 0.4 / 24, tl = T_LAND - tb;
    const p0 = SP.map(x => x + (r() - 0.5) * 0.002);
    const tgt = [E.x, E.y + 0.0004, E.z];
    const e = (1 - Math.exp(-KD * tl)) / KD, gk = -G / KD;
    const v0 = [0, 1, 2].map(j => { const gkj = j === 1 ? gk : 0; return gkj + (tgt[j] - p0[j] - gkj * tl) / e; });
    sparks.push({ p0, v0, tb, life: tl, kind: 2, seed: 0.37, I0: 70, T0: 2600, shut: 0.16 / 24 });
  }
  const NS = sparks.length;
  const spGeo = new THREE.InstancedBufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
  spGeo.setIndex([0, 1, 2, 1, 3, 2]);
  {
    const A = new Float32Array(NS * 4), B = new Float32Array(NS * 4), C = new Float32Array(NS * 4), D = new Float32Array(NS);
    sparks.forEach((s, i) => { A.set([...s.p0, s.tb], 4 * i); B.set([...s.v0, s.life], 4 * i); C.set([s.kind, s.seed, s.I0, s.T0], 4 * i); D[i] = s.shut; });
    spGeo.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
    spGeo.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
    spGeo.setAttribute('iC', new THREE.InstancedBufferAttribute(C, 4));
    spGeo.setAttribute('iD', new THREE.InstancedBufferAttribute(D, 1));
    spGeo.instanceCount = NS;
  }
  const spU = {
    ...hand, uT: { value: 0 }, uG: { value: G }, uK: { value: KD },
    uPV: { value: new THREE.Matrix4() }, uV: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(W, H) },
    uS: { value: S }, uDF: { value: DF }, uA: { value: COC_A }, uMax: { value: COC_MAX },
  };
  const spMat = new THREE.ShaderMaterial({
    uniforms: spU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL.common + HAND_GLSL + /* glsl */ `
      attribute vec4 iA, iB, iC; attribute float iD;
      uniform float uT, uS, uDF, uA, uMax, uG, uK; uniform mat4 uPV, uV; uniform vec2 uRes;
      varying vec2 vA, vB; varying float vI, vRad; varying vec3 vCol;
      vec3 posAt(float tau){ vec3 gk = vec3(0.0, -uG / uK, 0.0); return iA.xyz + gk * tau + (iB.xyz - gk) * (1.0 - exp(-uK * tau)) / uK; }
      void main(){
        float tau = uT - iA.w, life = iB.w;
        float alive = step(0.0, tau) * step(tau, life);
        float tl = life;
        if (iC.x < 0.5 && posAt(life).y < 0.0) {
          float lo = 0.0, hi = life;
          for (int k = 0; k < 12; k++) { float m = 0.5 * (lo + hi); if (posAt(m).y < 0.0) hi = m; else lo = m; }
          tl = lo;
        }
        vec3 pa = posAt(min(clamp(tau, 0.0, life), tl)), pb = posAt(min(clamp(tau - iD, 0.0, life), tl));
        float landed = step(tl, tau);
        pa.y = max(pa.y, 0.0015); pb.y = max(pb.y, 0.0015);
        vec4 ca = handClip(uPV * vec4(pa, 1.0)), cb = handClip(uPV * vec4(pb, 1.0));
        vec2 sa = (ca.xy / ca.w * 0.5 + 0.5) * uRes, sb = (cb.xy / cb.w * 0.5 + 0.5) * uRes;
        float d = -(uV * vec4(pa, 1.0)).z;
        float coc = min(uMax, uA * abs(d - uDF) / d) * uS;
        float r0 = 0.9 * uS, rad = sqrt(r0 * r0 + coc * coc);
        float L = length(sa - sb);
        float u = clamp(tau / life, 0.0, 1.0);
        float I = iC.z * (iC.x > 1.5 ? 1.0 : (1.0 - u * u)) * (0.75 + 0.25 * sin(tau * 70.0 + iC.y * 30.0)) * mix(1.0, 0.55 * exp(-6.0 * (tau - tl)), landed);
        vI = I * alive * (r0 * r0) / (rad * rad) * (2.5 * rad) / (2.5 * rad + L);
        vCol = blackbody(mix(iC.w, iC.x > 1.5 ? 2300.0 : 1150.0, u));
        vRad = rad; vA = sa; vB = sb;
        vec2 mn = min(sa, sb) - rad * 3.0, mx = max(sa, sb) + rad * 3.0;
        vec2 P = mix(mn, mx, position.xy * 0.5 + 0.5);
        gl_Position = vec4(P / uRes * 2.0 - 1.0, 0.0, 1.0);
        if (alive < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vA, vB; varying float vI, vRad; varying vec3 vCol;
      void main(){
        vec2 p = gl_FragCoord.xy, ab = vB - vA;
        float h = clamp(dot(p - vA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
        float d = length(p - vA - ab * h);
        // a comet: brighter at the head (vA), fading along the tail
        float f = exp(-0.5 * d * d / (vRad * vRad * 0.42)) * (1.0 - 0.6 * h);
        gl_FragColor = vec4(vCol * vI * f, 1.0);
      }`,
  });
  const spMesh = new THREE.Mesh(spGeo, spMat); spMesh.frustumCulled = false;
  const spScene = new THREE.Scene(); spScene.add(spMesh);
  spU.uPV.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  spU.uV.value.copy(cam.matrixWorldInverse);

  const sparkLight = t => {
    let s = 0;
    for (const sp of sparks) {
      if (sp.kind !== 0 || sp.tb < T(FR.s1) + 0.5) continue;  // the first strike lights nothing
      const tau = t - sp.tb; if (tau < 0 || tau > sp.life) continue;
      const u = tau / sp.life;
      const y = sp.p0[1] + (-G / KD) * tau + (sp.v0[1] + G / KD) * (1 - Math.exp(-KD * tau)) / KD;
      if (y < 0) continue;
      s += sp.I0 * (1 - u * u);
    }
    return s;
  };

  // ---- screen-space points: the landed spark (6 px, HDR 3) and the cursor footprint (f1848) -------------
  const ptU = { ...hand, uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uLand: { value: 0 }, uFoot: { value: 0 }, uFootC: { value: new THREE.Vector3(...CURSOR) } };
  const points = kit.fullscreen(HAND_GLSL + /* glsl */ `
    uniform vec2 uRes; uniform float uS, uLand, uFoot; uniform vec3 uFootC;
    void main(){
      vec2 px = handInv(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS);
      vec3 c = vec3(0.0);
      if (uLand > 0.0) {
        float r = length(px - uHandC);
        float core = smoothstep(3.6, 2.4, r);                // 6 px disc
        c += blackbody(2300.0) / max(blackbody(2300.0).r, 1e-3) * (core * 3.0 + exp(-r / 4.0) * 0.5) * uLand;
      }
      if (uFoot > 0.0) {
        float inside = step(722.0, px.x) * step(px.x, 746.0) * step(508.0, px.y) * step(px.y, 572.0);
        c += uFootC * uFoot * inside;
      }
      gl_FragColor = vec4(c, 1.0);
    }`, ptU, { blending: THREE.AdditiveBlending, transparent: true });

  // =====================================================================================================
  // TIME CURVES (pure functions of the frame)
  // =====================================================================================================
  const nz = (t, f, s) => util.shake(t, s, f, 1)[0];
  const bb = Tk => {
    Tk = Math.min(40000, Math.max(1000, Tk)) / 100;
    const r = Tk <= 66 ? 1 : Math.min(1, 1.29293618606 * Math.pow(Tk - 60, -0.1332047592));
    const g = Tk <= 66 ? Math.min(1, Math.max(0, 0.39008157876 * Math.log(Tk) - 0.63184144378)) : Math.min(1, 1.12989086089 * Math.pow(Tk - 60, -0.0755148492));
    const b = Tk >= 66 ? 1 : Tk <= 19 ? 0 : Math.min(1, Math.max(0, 0.54320678911 * Math.log(Tk - 10) - 1.19625408914));
    return [r, g, b].map(c => Math.pow(c, 2.2));
  };
  const DUSK_TINT = [0.84, 0.92, 1.10];                     // cold: the last of the west sky + skylight
  const C_EMB = bb(1150), C_FL = bb(1650), C_SP = bb(2300);
  const K_EMB = 0.0045, K_FL = 0.0055, K_SP = 0.0000050;
  // the ember: wakes where the spark lands, grows until ignition, then feeds the flame
  const ember = n => n < FR.land ? 0 : 0.35 * ss(FR.land, FR.land + 4, n) + 0.30 * ss(FR.land + 3, FR.ign, n) + 0.35 * ss(FR.ign, FR.ign + 14, n);
  // hot radius (m): 30 → 60 px over the 12 heating frames (7111 px/m at the focus), then the fire spreads
  const hotR = n => n < FR.land ? 0 : 0.0042 + 0.0042 * ss(FR.land, FR.ign, n) + 0.0060 * ss(FR.ign, FR.end + 4, n);
  const flameH = n => n < FR.ign + 1 ? 0 : 40 + 50 * Math.pow(clamp((n - FR.ign - 1) / (FR.end - 1 - FR.ign - 1)), 0.85);
  const flick = t => 1 + 0.13 * nz(t, 6.5, 41) + 0.07 * nz(t, 13.0, 43) + 0.10 * nz(t, 2.1, 47);

  return {
    render(shot, f) {
      const t = f.t, n = t * 24;
      renderer.setRenderTarget(f.target);
      renderer.setClearColor(0x000000, 1); renderer.clear();
      // breath: none during the push; it settles in after the stop, pinned to 0 on the footprint frame
      const bA = ss(FR.stop, FR.stop + 18, n);
      const b = breath(util, t, { px: 1.5, deg: 0.15, hz: 0.3, seed: 15, zeroAt: T(FR.ign) });
      setHand(hand, { ox: b.ox * bA, oy: b.oy * bA, rot: b.rot * bA });
      zoomU.value = Math.min(1, zoomAt(n));

      const em = ember(n), fh = flameH(n), fl = fh > 0 ? 1 : 0, fk = flick(t), sl = sparkLight(t);
      const emb = em * (0.85 + 0.15 * Math.sin(6.2832 * 0.43 * t));
      plateU.uW5.value.set(...DUSK_TINT); plateU.uW6.value.set(...DUSK_TINT);
      const embL = n < FR.ign ? 0.22 : 0.22 + 0.78 * ss(FR.ign, FR.end, n);   // before ignition the glow stays local
      plateU.uW0.value.set(...C_EMB.map(c => c * K_EMB * emb * embL));
      const grow = fh / 90;                                  // the flame light follows the flame's size
      const a1 = 0.5 + 0.35 * nz(t, 2.8, 51), a2 = 0.5 + 0.4 * nz(t, 3.7, 53), a3 = 0.5 + 0.4 * nz(t, 3.1, 57);
      const as = Math.max(0.05, a1) + Math.max(0.05, a2) + Math.max(0.05, a3);
      const fw = fl * grow * grow * fk * K_FL / as;
      plateU.uW1.value.set(...C_FL.map(c => c * fw * Math.max(0.05, a1)));
      plateU.uW2.value.set(...C_FL.map(c => c * fw * Math.max(0.05, a2)));
      plateU.uW3.value.set(...C_FL.map(c => c * fw * Math.max(0.05, a3)));
      plateU.uW4.value.set(...C_SP.map(c => c * sl * K_SP));
      plateU.uT.value = t; plateU.uHaze.value = clamp(grow, 0, 1);
      plateU.uFl.value.set(RX, RY + FL_ROOT, fh);
      platePass.render(renderer, f.target);

      // tinder: strands always (they are part of the bundle), emission once the spark has landed
      const curl = ss(FR.land, FR.ign, n);
      stU.uT.value = t; stU.uCurl.value = curl; stU.uChar.value = curl; stU.uRh.value = hotR(n);
      stU.uDusk.value.set(0.26, 0.28, 0.33); stU.uAmb.value.set(0.06, 0.07, 0.095);
      stU.uFlC.value.set(...C_FL.map(c => c * fw * as * 0.33));
      stU.uEmC.value.set(...C_EMB.map(c => c * K_EMB * emb * 0.02));
      emU.uT.value = t; emU.uRh.value = hotR(n); emU.uEmb.value = em; emU.uBurn.value = ss(FR.ign, FR.end, n);
      nestE.visible = em > 0;
      renderer.setRenderTarget(f.target);
      renderer.render(nestScene, cam);

      // the heated spot: the landed spark, then its thread of smoke
      ptU.uLand.value = n >= FR.land ? Math.max(0, 1 - 0.6 * (n - FR.land) / 12) * (n < FR.ign + 3 ? 1 : 0) : 0;
      ptU.uFoot.value = f.frame === FR.ign ? 0.9 : 0;
      if (ptU.uLand.value > 0 || ptU.uFoot.value > 0) points.render(renderer, f.target);

      // flame (half res, then added) and smoke
      smU.uThr.value = n >= FR.land + 2 ? clamp((n - FR.land - 2) / 10) : 0;
      smU.uSmk.value = ss(FR.ign + 4, FR.ign + 30, n);
      flU.uT.value = t; flU.uHt.value = Math.max(fh, 40); flU.uFlick.value = fk;
      flU.uF.value = fl * (0.9 + 0.1 * clamp((n - FR.ign) / 3));
      if (fl > 0 || smU.uThr.value > 0) {
        renderer.setClearColor(0x000000, 1);
        renderer.setRenderTarget(flameRT); renderer.clear();
        flameRT.scissorTest = true; renderer.setRenderTarget(flameRT);
        renderer.render(smScene, flCam);
        if (fl > 0) renderer.render(flScene, flCam);
        flameRT.scissorTest = false;
        renderer.setRenderTarget(flameBlur); renderer.clear();
        flameBlur.scissorTest = true;
        flBlur.render(renderer, flameBlur);
        flameBlur.scissorTest = false;
        comp.material.uniforms.tex.value = flameBlur.texture; comp.material.uniforms.gain.value = 1;
        comp.render(renderer, f.target);
      }
      // the stone tips (foreground, over the set), then the sparks over everything
      const tp = tipPos(n);
      if (tp.inF > 0 && tp.t1[0] > -60) {
        tipsU.uT1.value.set(...tp.t1); tipsU.uT2.value.set(...tp.t2); tipsU.uIn.value = 1;
        tipsU.uSpark.value = Math.min(1.6, sl * 0.0016 + (n >= FR.s1 && n < FR.s1 + 4 ? 0.15 : 0));
        tipsU.uSpC.value.set(...C_SP.map(c => c * 0.25));
        tips.render(renderer, f.target);
      }
      spU.uT.value = t;
      renderer.setRenderTarget(f.target);
      renderer.render(spScene, cam);
      renderer.setRenderTarget(f.target);
    },
  };
}
