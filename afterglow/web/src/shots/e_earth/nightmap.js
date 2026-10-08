// Regional HDR night-lights map for e_earth (S18) and e_final (S40).
//
// earth.js's global lights map is an 8-bit canvas whose village "dust" is spread evenly over every
// populated continent; from orbit sub-Saharan Africa then reads as uniform speckle and nothing has
// a recognisable shape. This map is built for the two shots that look at Africa / Arabia / Europe
// from 400–9000 km: every light is a band-limited anisotropic gaussian splat (flux-conserving,
// σ ≥ 0.7 texel) accumulated additively in a HalfFloat render target, so it is linear HDR with no
// 8-bit banding, and its mip chain band-limits it for any footprint.
//
// Content (fixed seed, deterministic): per populated place (places.js, ≥ 15 000 people) a bright
// core + a clustered sprawl of sub-lights + a halo of satellite villages; highways between near
// neighbours as strings of lamps; the Nile valley as a continuous ribbon from Aswan to Cairo (the
// brightest line in Africa), the delta fan densely farmed with villages; and an "electrification"
// grade by region so the map has the real night's structure — sparse sparks over sub-Saharan
// Africa, the Nile a thread, the Mediterranean, the Gulf and Europe blazing (LED-white cores).
//
// Equirect over NIGHT_RECT (lon0, lat0, lon1, lat1); texture row 0 = lat0 (south).
import * as THREE from 'three';
import { LAND, LAND_HOLES, LAKES } from '../../data/land.js';
import { PLACES } from '../../data/places.js';
import { rng } from '../../lib/util.js';
import { NILE_MAIN, NILE_ROSETTA, NILE_DAMIETTA, BLUE_NILE } from './geo.js';

export const NIGHT_RECT = [-30, -50, 100, 70];
const D2R = Math.PI / 180;

// regional grade: [electrification (flux ×), LED-white fraction of cores, rural village density ×]
function grade(lon, lat) {
  let e = 1.0, led = 0.25, rur = 1.0;
  const box = (a, b, c, d) => lon > a && lon < b && lat > c && lat < d;
  if (lat < 17 && lon > -20 && lon < 52) { e = 0.22; led = 0.0; rur = 0.25; }          // sub-Saharan Africa
  if (box(2, 15, 4, 14)) { e = 0.42; rur = 0.45; }                                     // Nigeria
  if (lat < -22 && lon > 15 && lon < 35) { e = 0.9; led = 0.15; rur = 0.6; }            // South Africa
  if (box(32, 42, -6, 4)) { e = 0.55; rur = 0.55; }                                     // Kenya / Uganda highlands (R)
  if (box(36, 41, 6, 12)) { e = 0.45; rur = 0.6; }                                      // Ethiopian highlands
  if (box(-18, 12, 27, 38)) { e = 0.85; led = 0.1; rur = 0.7; }                          // Maghreb
  if (box(29, 34.5, 22, 32)) { e = 1.35; led = 0.15; rur = 2.2; }                       // Egypt: the Nile and the delta
  if (box(34, 37, 29, 37.5)) { e = 1.3; led = 0.45; rur = 1.2; }                         // Levant
  if (box(43, 58, 22, 31)) { e = 1.7; led = 0.7; rur = 0.5; }                            // the Gulf
  if (box(35, 60, 12, 22)) { e = 0.8; led = 0.3; rur = 0.4; }                            // Arabia south / Yemen
  if (lat > 36 && lon > -11 && lon < 42) { e = 1.2; led = 0.55; rur = 1.3; }              // Europe / Turkey
  if (lat > 50 && lon > 28) { e = 0.9; led = 0.35; rur = 0.7; }                           // Russia
  if (box(44, 63, 25, 40)) { e = 1.0; led = 0.3; rur = 0.8; }                             // Iran
  if (box(60, 75, 24, 37)) { e = 0.7; led = 0.15; rur = 1.0; }                            // Pakistan
  if (box(68, 92, 6, 31)) { e = 0.8; led = 0.2; rur = 2.0; }                              // India: villages everywhere
  return [e, led, rur];
}

const SOD = [1.0, 0.456, 0.102];        // #FFB45A (linear)
const LED = [0.807, 0.871, 1.0];         // #E8F0FF
const WARM = [1.0, 0.62, 0.30];

export function buildNightMap(ctx, { res = 4096, seed = 1407 } = {}) {
  const { renderer } = ctx;
  const [lo0, la0, lo1, la1] = NIGHT_RECT;
  const TX = res / (lo1 - lo0), TY = res / (la1 - la0);              // texels per degree
  const kmX = lat => 111.32 * Math.cos(lat * D2R) / TX, kmY = 111.32 / TY;   // km per texel
  // ---- land mask (CPU, 0.05°) for rejection of off-shore villages / road lamps
  const MW = Math.round((lo1 - lo0) / 0.05), MH = Math.round((la1 - la0) / 0.05);
  const mc = document.createElement('canvas'); mc.width = MW; mc.height = MH;
  const mg = mc.getContext('2d');
  const P = (lon, lat) => [(lon - lo0) / 0.05, (la1 - lat) / 0.05];
  const ring = r => { mg.moveTo(...P(r[0], r[1])); for (let i = 2; i < r.length; i += 2) mg.lineTo(...P(r[i], r[i + 1])); mg.closePath(); };
  mg.fillStyle = '#000'; mg.fillRect(0, 0, MW, MH);
  mg.fillStyle = '#fff'; mg.beginPath(); for (const r of LAND) ring(r); mg.fill('evenodd');
  mg.fillStyle = '#000'; mg.beginPath(); for (const r of LAND_HOLES) ring(r); for (const r of LAKES) ring(r); mg.fill();
  const md = mg.getImageData(0, 0, MW, MH).data;
  const isLand = (lon, lat) => {
    const x = Math.floor((lon - lo0) / 0.05), y = Math.floor((la1 - lat) / 0.05);
    if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
    return md[(y * MW + x) * 4] > 127;
  };

  // ---- splat list
  const pos = [], shp = [], col = [];
  const r = rng(seed);
  // add one light: lon/lat, gaussian σ in km, total flux (texel² × intensity), colour
  const add = (lon, lat, sigKm, flux, c) => {
    if (lon < lo0 || lon > lo1 || lat < la0 || lat > la1 || flux <= 0) return;
    const sx = Math.max(0.7, sigKm / kmX(lat)), sy = Math.max(0.7, sigKm / kmY);
    const peak = flux / (2 * Math.PI * sx * sy);
    pos.push((lon - lo0) * TX, (lat - la0) * TY);
    shp.push(sx, sy);
    col.push(c[0] * peak, c[1] * peak, c[2] * peak);
  };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const off = (lon, lat, dxKm, dyKm) => [lon + dxKm / (111.32 * Math.cos(lat * D2R)), lat + dyKm / 111.32];
  const region = PLACES.filter(([lo, la]) => lo > lo0 - 2 && lo < lo1 + 2 && la > la0 - 2 && la < la1 + 2);
  const F0 = 0.9 * (kmY * kmY) / 9;      // flux unit ≈ a 1 km² lit block in a 3.26 km texel

  for (const [lon, lat, pop] of region) {
    const [e, led, rur] = grade(lon, lat);
    const lp = Math.log10(pop / 1e4);                       // 0.18 (15k) … 3.5 (35M)
    const radKm = 1.6 * Math.pow(pop / 1e4, 0.42);           // urban radius
    const coreC = mixc(WARM, LED, led * Math.min(1, lp / 2.5));
    // core: a compact bright centre
    add(lon, lat, Math.max(0.6, radKm * 0.28), F0 * e * 2.2 * Math.pow(pop / 1e4, 0.85) * Math.exp(r.gauss() * 0.35), coreC);
    // sprawl: clustered sub-lights inside the urban radius (exponential falloff, irregular lobes)
    const nS = Math.min(1600, Math.round(14 * Math.pow(pop / 1e4, 0.55)));
    const lobes = 2 + Math.floor(r() * 4), lobeA = r() * 6.283;
    for (let i = 0; i < nS; i++) {
      let ang = r() * 6.283;
      // lobe bias: sprawl follows a few arterial directions
      const lb = lobeA + Math.floor(r() * lobes) * 6.283 / lobes;
      if (r() < 0.55) ang = lb + r.gauss() * 0.25;
      const d = radKm * (-Math.log(1 - r() * 0.985)) * 0.55;
      const [x, y] = off(lon, lat, Math.cos(ang) * d, Math.sin(ang) * d);
      if (!isLand(x, y)) continue;
      const fall = Math.exp(-d / (radKm * 0.9));
      const c = mixc(SOD, coreC, fall * fall * 0.8);
      add(x, y, 0.35 + 0.5 * r(), F0 * e * (0.5 + 1.6 * fall) * Math.exp(r.gauss() * 0.6) * 3.0, c);
    }
    // satellite villages: rural density around the place, out to several urban radii
    const nV = Math.round(rur * 16 * Math.pow(pop / 1e4, 0.38));
    for (let i = 0; i < nV; i++) {
      const ang = r() * 6.283, d = radKm * 1.2 + (12 + 30 * Math.pow(pop / 1e5, 0.25)) * (-Math.log(1 - r() * 0.99)) * 0.7;
      const [x, y] = off(lon, lat, Math.cos(ang) * d, Math.sin(ang) * d);
      if (!isLand(x, y)) continue;
      add(x, y, 0.3 + 0.4 * r(), F0 * Math.min(1.4, e) * 0.3 * Math.exp(r.gauss() * 0.95), mixc(SOD, WARM, r() * 0.5));
    }
  }
  // highways: strings of lamps between near neighbours (only over land), towns every few dozen km
  const big = region.filter(p => p[2] > 4e4);
  for (let i = 0; i < big.length; i++) {
    const [lo, la, pop] = big[i];
    const cand = [];
    for (let j = 0; j < big.length; j++) {
      if (j === i) continue;
      const dx = (big[j][0] - lo) * Math.cos(la * D2R) * 111.32, dy = (big[j][1] - la) * 111.32;
      const d = Math.hypot(dx, dy);
      if (d < 320 && d > 5) cand.push([d, j]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [d, j] of cand.slice(0, 2)) {
      if (j < i && cand.length > 1) { /* each pair once, mostly */ }
      const [lo2, la2, pop2] = big[j];
      const [e] = grade((lo + lo2) / 2, (la + la2) / 2);
      const w = Math.min(1, Math.sqrt(Math.min(pop, pop2)) / 900) * e;
      const bend = (r() - 0.5) * 0.22;
      const n = Math.round(d / 1.2);
      for (let k = 0; k <= n; k++) {
        const t = k / n, sb = Math.sin(t * Math.PI) * bend;
        const x = lo + (lo2 - lo) * t - (la2 - la) * sb, y = la + (la2 - la) * t + (lo2 - lo) * sb;
        if (!isLand(x, y)) continue;
        const flick = 0.55 + 0.45 * Math.sin(k * 0.37 + i) * Math.sin(k * 0.071 + j);
        add(x, y, 0.3, F0 * w * 0.45 * flick, SOD);
        if (r() < 0.03) add(x + (r() - 0.5) * 0.03, y + (r() - 0.5) * 0.03, 0.5, F0 * w * 4 * r(), WARM);   // a roadside town
      }
    }
  }
  // the Nile: a lit ribbon from Aswan (24.1°N) to Cairo, the delta fan, thinner strings up-river
  const along = (line, fn) => {
    for (let s = 0; s < line.length - 1; s++) {
      const [ax, ay] = line[s], [bx, by] = line[s + 1];
      const L = Math.hypot((bx - ax) * Math.cos(ay * D2R), by - ay) * 111.32;
      const n = Math.max(1, Math.round(L / 0.6));
      for (let k = 0; k < n; k++) { const t = k / n; fn(ax + (bx - ax) * t, ay + (by - ay) * t, L / n); }
    }
  };
  along(NILE_MAIN, (x, y) => {
    const [e] = grade(x, y);
    const egypt = y > 24.0 ? 1 : 0;
    const dens = egypt ? 1.0 : 0.12;
    for (let q = 0; q < (egypt ? 3 : 1); q++) {
      if (r() > dens) continue;
      const side = r.gauss() * (egypt ? 4.5 : 2.0);
      const [px, py] = off(x, y, side, r.gauss() * 0.4);
      add(px, py, 0.4 + 0.5 * r(), F0 * e * (egypt ? 2.6 : 1.4) * Math.exp(r.gauss() * 0.5), mixc(SOD, WARM, r() * 0.4));
    }
  });
  along(BLUE_NILE, (x, y) => { if (r() < 0.08) add(...off(x, y, r.gauss() * 2, 0), 0.5, F0 * 0.5, SOD); });
  for (const br of [NILE_ROSETTA, NILE_DAMIETTA]) along(br, (x, y) => {
    for (let q = 0; q < 3; q++) { const [px, py] = off(x, y, r.gauss() * 3, r.gauss() * 0.5); add(px, py, 0.5, F0 * 3.2 * Math.exp(r.gauss() * 0.4), mixc(SOD, WARM, r() * 0.4)); }
  });
  // delta fan: villages between (and a little beyond) the two branches
  {
    const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const fan = [[31.15, 30.05], ...NILE_ROSETTA.map(([x, y]) => [x - 0.22, y]), [30.3, 31.5], [31.0, 31.58], [31.6, 31.55], [32.2, 31.3],
      ...NILE_DAMIETTA.slice().reverse().map(([x, y]) => [x + 0.3, y])];
    for (let i = 0; i < 26000; i++) {
      const x = 29.9 + r() * 2.5, y = 30.0 + r() * 1.6;
      if (!inPoly(fan, x, y) || !isLand(x, y)) continue;
      add(x, y, 0.35 + 0.3 * r(), F0 * 0.9 * Math.exp(r.gauss() * 0.6), mixc(SOD, WARM, r() * 0.5));
    }
  }

  // ---- render the splats into a HalfFloat target (additive, flux-conserving gaussians)
  const N = pos.length / 2;
  const geo = new THREE.BufferGeometry();
  const P3 = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { P3[i * 3] = pos[i * 2]; P3[i * 3 + 1] = pos[i * 2 + 1]; }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3));
  geo.setAttribute('shp', new THREE.Float32BufferAttribute(new Float32Array(shp), 2));
  geo.setAttribute('col', new THREE.Float32BufferAttribute(new Float32Array(col), 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { res: { value: res } },
    vertexShader: /* glsl */ `
      uniform float res; attribute vec2 shp; attribute vec3 col; varying vec3 vC; varying vec2 vS; varying float vSize;
      void main(){
        vC = col; vS = shp;
        float s = 2.0 * ceil(3.0 * max(shp.x, shp.y)) + 1.0;
        vSize = s; gl_PointSize = s;
        gl_Position = vec4(position.xy / res * 2.0 - 1.0, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying vec2 vS; varying float vSize;
      void main(){
        vec2 q = (gl_PointCoord - 0.5) * vSize;          // texels from the centre
        float g = exp(-0.5 * (q.x * q.x / (vS.x * vS.x) + q.y * q.y / (vS.y * vS.y)));
        gl_FragColor = vec4(vC * g, 0.0);
      }`,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    depthTest: false, depthWrite: false, transparent: true,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(pts);
  const cam = new THREE.Camera();
  const rt = new THREE.WebGLRenderTarget(res, res, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
  });
  rt.texture.anisotropy = 8;
  const prev = renderer.getRenderTarget(), prevClr = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev); renderer.setClearColor(prevClr, prevA);
  geo.dispose(); mat.dispose();
  return { tex: rt.texture, rect: NIGHT_RECT, count: N };
}
