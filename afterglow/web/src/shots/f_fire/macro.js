// S15 · 燧石 · 点燃 (70.0 → 79.0, f1680–1895) — the first fire, 100 mm macro.
//
// How it is made (the "photographic" problem solved by baking light, not geometry):
//   The scene (soil with mineral grains, pebbles, volcanic stones, ~2000 dry grass blades, a tinder
//   nest of ~450 fibres around a charred lump) is real geometry, but the camera is locked (only a
//   2D hand-held breath on top), and every light in the shot sits at one of five fixed positions:
//   the ember, three flame positions (the flame light dances between them), the spark cloud.
//   Light is linear, and so is defocus blur. So in create() we render the scene once per light
//   with shadows (own cube distance maps, PCF), 4× MSAA, GGX + thin-sheet transmission, and pass each
//   result through a depth-aware scatter-as-gather bokeh (f/5.6, focus 0.75 m: background discs
//   16–24 px). Per frame the plate is Σ wᵢ(t)·colourᵢ(t)·Bᵢ — five texture taps — exactly what the
//   fully re-lit, re-blurred scene would be. Shadows of the grass wobble because the flame light
//   moves between three bases.
//   Live on top: the burning front creeping along the tinder fibres and the Worley crack glow of the
//   ember (the protagonist, in focus, msaa), the out-of-focus flame (9 advected-noise teardrop sheets,
//   blackbody, half resolution) and a thin plume of smoke lit from below by it, heat haze (±2 px) on
//   the plate above it, flint sparks and rising
//   sparks as motion-blurred capsules with their own bokeh, and the cursor footprint at f1776.
//
// Timing (screenplay §3 S15): 70.0–71.5 black · strikes on the off-beats 71.5 (30 sparks, light
// nothing) · 72.5 (60, the spark light briefly shows a stone) · 73.5 (sparks fall into the tinder at R,
// the ember wakes and breathes) · 74.0 = f1776 the 24×64 footprint at R · f1777 ignition · 77.0 the
// first string of sparks flies up · 79.0 cut on their rise.
import * as THREE from 'three';
import { hex, CURSOR, RX, RY, fbm3, breath, HAND_GLSL, handUniforms, setHand, merge, tag, ribbon, plain } from './common.js';

const FOCAL = 100, FPX = 960 / (18 / FOCAL);       // 5333 px per unit tangent (1080p)
const DF = 0.75, PITCH = 12 * Math.PI / 180;      // focus distance (m), down-tilt
const FNUM = 5.6;
// circle-of-confusion radius in 1080p px: (f/N)·f/(df−f)·|d−df|/d · (1920/36mm) / 2
const COC_A = (0.1 / FNUM) * (0.1 / (DF - 0.1)) * (1920 / 0.036) / 2;
const COC_MAX = 24;
const T_IGN = 74.0, F_FOOT = 1776;
const E = new THREE.Vector3(0, 0.010, 0);          // ember / focus / R

// light positions of the five bases (metres)
const LIGHTS = [
  [0.000, 0.016, 0.003],   // 0 ember (just above the lump)
  [0.000, 0.036, 0.000],   // 1 flame centre
  [-0.010, 0.050, 0.005],  // 2 flame left / up
  [0.011, 0.044, -0.006],  // 3 flame right
  [-0.022, 0.050, 0.012],  // 4 spark cloud
];
const R0 = [0.006, 0.028, 0.028, 0.028, 0.012];   // a flame is a volume source: no near-field hot spot   // light "size" (soft core of the falloff)

// ---- ground height (CPU; the mesh and the pebble placement share it) -----------------------------
function hG(x, z) {
  let h = 0.007 * (fbm3(x * 6, 0.3, z * 6, 4, 3) - 0.5) + 0.0016 * (fbm3(x * 45, 1.7, z * 45, 3, 5) - 0.5);
  const r2 = x * x + z * z;
  h -= 0.0028 * Math.exp(-r2 / (0.032 * 0.032));        // the nest sits in a shallow hollow
  return h;
}

export function createMacro(ctx) {
  const { renderer, W, H, kit, GLSL, util } = ctx;
  const S = H / 1080;
  const rng = util.rng(55 * 1000 + 15);

  // ---- camera ----------------------------------------------------------------------------------------
  const cam = kit.filmCamera(W, H, { focalMM: FOCAL, near: 0.01, far: 6 });
  cam.position.set(0, E.y + DF * Math.sin(PITCH), DF * Math.cos(PITCH));
  cam.lookAt(E);
  // lens shift so the optical axis (through the ember) lands on R
  cam.setViewOffset(W, H, (960 - RX) * S, (540 - RY) * S, W, H);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const eye = cam.position.clone();

  // =====================================================================================================
  // GEOMETRY
  // =====================================================================================================
  const parts = [];
  const add = (g, mat, seed) => parts.push(tag(g, { mat, seed }));

  // ground: 2 mm grid
  {
    const x0 = -0.26, x1 = 0.37, z0 = -0.56, z1 = 0.26, step = 0.002;
    const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1;
    const pos = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * step, z = z0 + j * step, k = (j * nx + i) * 3;
      pos[k] = x; pos[k + 1] = hG(x, z); pos[k + 2] = z;
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let o = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.setAttribute('ru', new THREE.BufferAttribute(new Float32Array(nx * nz * 2), 2));
    add(g, 0, 0);
  }

  // stones: displaced, flattened spheres sunk into the soil
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
    const yb = hG(cx, cz) + r * flat * 0.25;
    g.translate(cx, yb, cz);
    add(g, matId, (seed * 0.137) % 1);
  };
  stone(-0.078, -0.055, 0.034, 0.62, 3.1);          // left, behind: the stone the spark light finds
  stone(0.090, -0.020, 0.026, 0.55, 5.7);
  stone(0.045, -0.170, 0.048, 0.60, 8.3);
  stone(-0.170, -0.230, 0.060, 0.55, 11.9);
  stone(0.230, -0.120, 0.042, 0.58, 2.2);
  stone(0.140, 0.100, 0.024, 0.60, 6.6);            // foreground right, out of focus
  stone(-0.040, -0.420, 0.070, 0.5, 9.4);
  // pebbles (gravel 2–7 mm), kept out of the nest
  for (let i = 0; i < 300; i++) {
    const x = -0.22 + rng() * 0.56, z = -0.50 + rng() * 0.72;
    if (Math.hypot(x, z) < 0.04) continue;
    const r = 0.0018 + Math.pow(rng(), 2.2) * 0.006;
    stone(x, z, r, 0.55 + rng() * 0.3, 20 + i * 1.31, 14, 5);
  }

  // dry grass: tufts of blades (oriented ribbons with a twist) + blades lying on the soil
  const blade = (bx, bz, len, w0, az, lean, bend, twist, seed) => {
    const n = 14, pts = [], ws = [];
    const y0 = hG(bx, bz) - 0.002;
    let p = new THREE.Vector3(bx, y0, bz);
    for (let k = 0; k < n; k++) {
      const s = k / (n - 1);
      pts.push([p.x, p.y, p.z]);
      ws.push(w0 * (1 - 0.88 * Math.pow(s, 1.6)));
      const a = lean + bend * s * s;                        // angle from vertical
      const d = new THREE.Vector3(Math.sin(a) * Math.cos(az), Math.cos(a), Math.sin(a) * Math.sin(az));
      p = p.clone().addScaledVector(d, len / (n - 1));
    }
    const sideFn = (k, T) => {
      const s = k / (n - 1);
      const h = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az));
      return h.applyAxisAngle(T, twist * s + seed).projectOnPlane(T).normalize();
    };
    add(ribbon(pts, ws, { side: sideFn }), 2, seed % 1);
  };
  const tufts = [
    // x, z, blades, height, spread
    [-0.135, -0.085, 70, 0.15, 0.5], [0.165, -0.095, 80, 0.17, 0.5], [0.050, -0.260, 120, 0.24, 0.6],
    [-0.060, -0.330, 110, 0.22, 0.6], [0.270, -0.310, 120, 0.22, 0.6], [-0.200, -0.300, 100, 0.20, 0.6],
    [0.120, -0.420, 140, 0.26, 0.7], [-0.120, -0.470, 140, 0.26, 0.7], [0.330, -0.180, 90, 0.18, 0.6],
    [-0.215, -0.120, 70, 0.16, 0.6], [0.230, 0.020, 50, 0.10, 0.6], [0.010, -0.150, 50, 0.11, 0.5],
    [-0.052, 0.168, 26, 0.08, 0.4],                     // foreground left: big, soft, back-lit
    [0.135, 0.150, 22, 0.075, 0.4],                     // foreground right
  ];
  let nBlades = 0;
  for (const [tx, tz, nb, ht, spread] of tufts) {
    for (let i = 0; i < nb; i++) {
      const az = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * 0.012;
      const bx = tx + Math.cos(az) * rr, bz = tz + Math.sin(az) * rr;
      const len = ht * (0.35 + 0.75 * rng());
      blade(bx, bz, len, 0.0014 + rng() * 0.0022, az + (rng() - 0.5) * 0.8, spread * (0.15 + 0.85 * rng()), 0.3 + rng() * 1.2, (rng() - 0.5) * 3, i * 0.618 + tx * 17);
      nBlades++;
    }
  }
  // stray blades lying on the ground (radial litter around the nest, none in front of it)
  for (let i = 0; i < 260; i++) {
    const a = rng() * Math.PI * 2, r = 0.05 + Math.pow(rng(), 0.7) * 0.32;
    const bx = Math.cos(a) * r, bz = -Math.abs(Math.sin(a)) * r * 1.2 + 0.03;
    if (bz > 0.02 && Math.abs(bx) < 0.07) continue;
    const len = 0.03 + rng() * 0.09;
    blade(bx, bz, len, 0.0012 + rng() * 0.0018, rng() * Math.PI * 2, 1.45 + rng() * 0.1, 0.05, (rng() - 0.5) * 2, 500 + i);
    nBlades++;
  }

  // the tinder nest: fine fibres wound in a bowl around the charred lump, camera-facing ribbons
  const nestParts = [];
  const fibre = (pts, w, seed) => {
    const ws = pts.map((_, k) => w * (0.6 + 0.4 * Math.sin(Math.PI * k / (pts.length - 1))));
    const g = tag(ribbon(pts, ws, { eye }), { mat: 3, seed });
    parts.push(g); nestParts.push(g);
  };
  // A loose bundle of dry grass and shredded bark, NOT a woven bowl: each fibre is an arc of a circle
  // whose plane is tilted at random (up to ±50° from horizontal) and centred off-axis, wobbled by
  // low-frequency noise, lifted onto a flattened-dome envelope with a hollow where the charred lump
  // sits; a third are long, gently bent straws laid across the bundle in every direction.
  const envY = r => 0.0022 + 0.016 * Math.pow(Math.min(r / 0.028, 1.0), 1.25) * (1 - 0.7 * Math.pow(Math.max(0, (r - 0.026) / 0.016), 1.5));
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
      const rh = Math.hypot(q.x, q.z);
      const y = envY(rh) + q.y * 0.55 + lift + 0.0012 * Math.sin(ph * 4.3 + sd);
      pts.push([q.x, Math.max(0.0011, y), q.z]);
    }
    fibre(pts, 0.00020 + rng() * 0.00036, rng());
  }
  for (let i = 0; i < 140; i++) {                      // straws laid across the bundle
    const a0 = rng() * Math.PI * 2, rS = 0.004 + rng() * 0.03;
    const dir = a0 + Math.PI / 2 + (rng() - 0.5) * 1.6, len = 0.02 + rng() * 0.045, bend = (rng() - 0.5) * 18;
    const n = 24, pts = []; let x = Math.cos(a0) * rS - Math.cos(dir) * len * 0.5, z = Math.sin(a0) * rS - Math.sin(dir) * len * 0.5;
    const sd = rng() * 100, lift = (rng() - 0.3) * 0.004;
    for (let k = 0; k < n; k++) {
      const s2 = k / (n - 1), d = dir + bend * (s2 - 0.5) * len;
      const rh = Math.hypot(x, z);
      pts.push([x, Math.max(0.0011, envY(rh) + lift + 0.0016 * Math.sin(s2 * 5 + sd)), z]);
      x += Math.cos(d) * len / (n - 1); z += Math.sin(d) * len / (n - 1);
    }
    fibre(pts, 0.00024 + rng() * 0.0004, rng());
  }
  for (let i = 0; i < 26; i++) {                       // a few flat shreds of bark
    const a0 = rng() * Math.PI * 2, rS = 0.012 + rng() * 0.02, dir = a0 + Math.PI / 2 + (rng() - 0.5), len = 0.012 + rng() * 0.02;
    const n = 12, pts = [];
    for (let k = 0; k < n; k++) {
      const s2 = k / (n - 1) - 0.5, x = Math.cos(a0) * rS + Math.cos(dir) * len * s2, z = Math.sin(a0) * rS + Math.sin(dir) * len * s2;
      pts.push([x, Math.max(0.0012, envY(Math.hypot(x, z)) + 0.001 * Math.sin(s2 * 4)), z]);
    }
    fibre(pts, 0.0009 + rng() * 0.0012, rng());
  }
  // loose strands sticking out of the bundle
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
  // the charred lump (the ember's body), partly buried in fibres
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

  // =====================================================================================================
  // BAKE: shadow cubes → lit MSAA render per light → bokeh gather → five plates
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
      uCam: { value: eye }, uSoft: { value: 0.05 },
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
      uniform vec3 uLight, uCam; uniform float uR0, uSoft; uniform samplerCube uShadow;
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
        if (vMat < 0.5) {                                     // soil: volcanic, umber/grey, mineral grains
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
          if (gh > 0.985 && gr > 0.1) {                      // glinting flakes: tilted mirrors → bokeh balls
            rough = 0.16; f0 = 0.45;
            N = normalize(N + 0.9 * (hash33(vec3(vec2(gc), 5.0)) - 0.5));
            bump = false;
          }
        } else if (vMat < 1.5 || vMat > 4.5) {                // stones / pebbles
          vec3 q = P * 55.0 + vSeed * 31.0;
          float n1 = fbm(q, 4), n2 = fbm(q * 6.0, 3);
          vec3 base = mix(vec3(0.050, 0.046, 0.042), vec3(0.095, 0.072, 0.055), fract(vSeed * 7.3));
          if (vMat > 4.5) base = mix(base, vec3(0.16, 0.14, 0.12), step(0.8, fract(vSeed * 13.1)));
          alb = base * (0.6 + 0.8 * n1) * (0.85 + 0.3 * n2);
          float lichen = smoothstep(0.62, 0.7, fbm(P * 140.0 + 2.0, 3)) * step(vMat, 1.5);
          alb = mix(alb, vec3(0.11, 0.105, 0.08), lichen * 0.6);
          h = n1 * 0.0012 + n2 * 0.0004; bump = true; rough = 0.62 - 0.15 * n2;
        } else if (vMat < 2.5) {                              // dry grass
          float sd = vSeed;
          vec3 straw = mix(vec3(0.40, 0.29, 0.15), vec3(0.30, 0.24, 0.16), fract(sd * 3.7));
          straw = mix(straw, vec3(0.20, 0.15, 0.10), step(0.85, fract(sd * 11.3)));
          float stripe = 0.8 + 0.2 * vnoise(vec2(vRu.y * 4.0 + sd * 50.0, vRu.x * 60.0));
          alb = straw * stripe * mix(0.55, 1.08, smoothstep(0.0, 0.35, vRu.x));
          trans = 0.55; tcol = vec3(1.0, 0.78, 0.45); rough = 0.5; f0 = 0.045;
        } else if (vMat < 3.5) {                              // tinder fibres
          float sd = vSeed;
          // pale dry grass and bark shreds; a good part already charred near the lump (dark, matte)
          alb = mix(vec3(0.42, 0.34, 0.22), vec3(0.28, 0.23, 0.16), fract(sd * 5.1));
          float charred = step(0.66, fract(sd * 9.7)) + (1.0 - step(0.66, fract(sd * 9.7))) * smoothstep(0.016, 0.006, length(P.xz)) * 0.8;
          alb = mix(alb, vec3(0.035, 0.028, 0.022), clamp(charred, 0.0, 1.0));
          alb *= 0.75 + 0.5 * vnoise(vec2(vRu.x * 40.0, sd * 77.0));
          trans = 0.38 * (1.0 - clamp(charred, 0.0, 1.0)); tcol = vec3(1.0, 0.8, 0.5); rough = 0.6;
        } else {                                              // charred lump
          vec3 q = (P - vec3(0.0, 0.0045, 0.0)) * 500.0;
          float ash = smoothstep(0.55, 0.75, fbm(q, 4));
          alb = mix(vec3(0.018, 0.016, 0.015), vec3(0.11, 0.105, 0.10), ash);
          h = fbm(q * 2.0, 3) * 0.0003; bump = true; rough = 0.95;
        }
        if (bump) N = bumpN(P, N, h);
        vec3 Lv = uLight - P; float d2 = dot(Lv, Lv); vec3 L = Lv * inversesqrt(d2);
        float att = 1.0 / (d2 + uR0 * uR0);
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
        gl_FragColor = vec4(col * att * vis, vIZ);
      }`,
  });
  const bakeScene = new THREE.Scene();
  const bakeMesh = new THREE.Mesh(sceneGeo, litMat);
  bakeMesh.frustumCulled = false;
  bakeScene.add(bakeMesh);

  const cubeRT = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true });
  const cubeCam = new THREE.CubeCamera(0.0008, 3, cubeRT);
  bakeScene.add(cubeCam);
  const beauty = ctx.makeRT(W, H, { depth: true, samples: 4 });

  const dof = kit.fullscreen(/* glsl */ `
    uniform sampler2D uSrc; uniform vec2 uRes; uniform float uDF, uA, uMax, uS;
    float coc(float iz){ return iz <= 1e-4 ? uMax : min(uMax, uA * abs(1.0 - uDF * iz)) * uS; }
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
        float cov = s.a >= c0.a * 0.985 ? cs : min(cs, cc);      // behind the centre: limited by its own blur
        float w = clamp(cov - r + 0.5, 0.0, 1.0) * (inner ? A1 : A2) / max(PI * cov * cov, 1.0);
        sum += s.rgb * w; wsum += w;
      }
      gl_FragColor = vec4(sum / wsum, 1.0);
    }`, {
    uSrc: { value: beauty.texture }, uRes: { value: new THREE.Vector2(W, H) }, uDF: { value: DF },
    uA: { value: COC_A }, uMax: { value: COC_MAX }, uS: { value: S },
  });

  const plates = [];
  const prevClear = new THREE.Color(); renderer.getClearColor(prevClear); const prevAlpha = renderer.getClearAlpha();
  for (let i = 0; i < LIGHTS.length; i++) {
    const L = new THREE.Vector3(...LIGHTS[i]);
    // shadow cube: distance to the light
    bakeScene.overrideMaterial = distMat;
    distMat.uniforms.uLight.value.copy(L);
    cubeCam.position.copy(L); cubeCam.updateMatrixWorld();
    renderer.setClearColor(0xffffff, 1);
    cubeCam.update(renderer, bakeScene);
    bakeScene.overrideMaterial = null;
    // lit render
    litMat.uniforms.uLight.value.copy(L); litMat.uniforms.uR0.value = R0[i]; litMat.uniforms.uShadow.value = cubeRT.texture;
    litMat.uniforms.uSoft.value = i === 0 ? 0.12 : 0.06;
    renderer.setRenderTarget(beauty); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(bakeScene, cam);
    // bokeh
    const out = ctx.makeRT(W, H);
    dof.render(renderer, out);
    plates.push(out);
  }
  renderer.setRenderTarget(null); renderer.setClearColor(prevClear, prevAlpha);
  cubeRT.dispose(); beauty.dispose(); litMat.dispose(); distMat.dispose(); sceneGeo.dispose();

  // =====================================================================================================
  // LIVE LAYERS
  // =====================================================================================================
  const hand = handUniforms();
  const plateU = {
    ...hand, uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uT: { value: 0 }, uHaze: { value: 0 },
    uFl: { value: new THREE.Vector3(RX, RY - 30, 200) },
  };
  for (let i = 0; i < 5; i++) { plateU['uB' + i] = { value: plates[i].texture }; plateU['uW' + i] = { value: new THREE.Vector3() }; }
  const platePass = kit.fullscreen(HAND_GLSL + /* glsl */ `
    uniform sampler2D uB0, uB1, uB2, uB3, uB4; uniform vec3 uW0, uW1, uW2, uW3, uW4;
    uniform vec2 uRes; uniform float uS, uT, uHaze; uniform vec3 uFl;
    void main(){
      vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;
      vec2 src = handInv(px);
      // heat haze: ±2 px refraction above the flame, rising
      float m = uHaze * exp(-pow((src.x - uFl.x) / 85.0, 2.0)) * smoothstep(uFl.y + 20.0, uFl.y - 60.0, src.y)
              * smoothstep(uFl.y - uFl.z - 380.0, uFl.y - uFl.z * 0.5, src.y);
      if (m > 0.003) {
        vec2 q = src * vec2(0.045, 0.028) + vec2(0.0, uT * 3.1);
        src += (vec2(vnoise(q), vnoise(q + 17.3)) - 0.5) * 4.0 * m;
      }
      vec2 uv = vec2(src.x / 1920.0, 1.0 - src.y / 1080.0);
      vec3 c = vec3(0.0);
      if (dot(uW0, uW0) > 0.0) c += uW0 * texture2D(uB0, uv).rgb;
      if (dot(uW1, uW1) > 0.0) c += uW1 * texture2D(uB1, uv).rgb;
      if (dot(uW2, uW2) > 0.0) c += uW2 * texture2D(uB2, uv).rgb;
      if (dot(uW3, uW3) > 0.0) c += uW3 * texture2D(uB3, uv).rgb;
      if (dot(uW4, uW4) > 0.0) c += uW4 * texture2D(uB4, uv).rgb;
      gl_FragColor = vec4(c, 1.0);
    }`, plateU);

  // ---- burning tinder & ember (live emission over the plate) ------------------------------------------
  const emU = { ...hand, uT: { value: 0 }, uRh: { value: 0 }, uEmb: { value: 0 }, uE: { value: E.clone() } };
  const nestVS = HAND_GLSL + /* glsl */ `
    attribute float mat; attribute float seed; attribute vec2 ru;
    varying vec3 vW; varying float vMat, vSeed; varying vec2 vRu;
    void main(){
      vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vMat = mat; vSeed = seed; vRu = ru;
      gl_Position = handClip(projectionMatrix * viewMatrix * w);
    }`;
  const nestDepth = new THREE.ShaderMaterial({ uniforms: emU, vertexShader: nestVS, fragmentShader: 'void main(){ gl_FragColor = vec4(0.0); }', colorWrite: false, side: THREE.DoubleSide });
  const nestEmit = new THREE.ShaderMaterial({
    uniforms: emU, vertexShader: nestVS, side: THREE.DoubleSide, depthWrite: false, depthFunc: THREE.LessEqualDepth, transparent: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    fragmentShader: GLSL.all + /* glsl */ `
      uniform float uT, uRh, uEmb; uniform vec3 uE;
      varying vec3 vW; varying float vMat, vSeed; varying vec2 vRu;
      void main(){
        float r = length(vW - uE);
        // breathing: two slow waves (0.43 / 0.67 Hz) travelling through the bundle
        float br = 0.78 + 0.16 * sin(6.2832 * 0.43 * uT - r * 260.0 + vSeed * 2.0) + 0.10 * sin(6.2832 * 0.67 * uT + r * 410.0);
        vec3 emi = vec3(0.0); float a = 0.0;
        if (vMat > 3.5) {
          vec3 q = (vW - vec3(0.0, 0.0045, 0.0)) * 520.0;
          vec2 w = worley(q + vec3(0.0, uT * 0.04, 0.0));
          float crack = 1.0 - smoothstep(0.015, 0.14, w.y - w.x);
          float hot = smoothstep(uRh + 0.002, uRh * 0.35, r);
          float n = vnoise(q * 0.35 + uT * 0.2);
          float g = (crack * (2.2 + 1.5 * n) + 0.18 * (0.5 + n)) * hot * br;
          emi = blackbody(mix(1000.0, 1420.0, clamp(g * 0.35, 0.0, 1.0))) * g * 1.6;
        } else {
          float front = exp(-pow((r - uRh) / 0.0024, 2.0));
          float inner = smoothstep(uRh + 0.0008, uRh - 0.0025, r);
          float n = vnoise(vec2(vRu.x * 90.0, vSeed * 91.0)), n2 = vnoise(vec2(vRu.x * 23.0 - uT * 0.6, vSeed * 13.0));
          float g = front * (0.35 + 1.1 * n * n2) + inner * 0.22 * n * n;
          emi = blackbody(mix(1000.0, 1450.0, clamp(g * br, 0.0, 1.0))) * g * br * 3.2;
          a = inner * 0.8;
        }
        gl_FragColor = vec4(emi * uEmb, a * step(0.001, uEmb));
      }`,
  });
  const nestScene = new THREE.Scene();
  const nestD = new THREE.Mesh(nestGeo, nestDepth), nestE = new THREE.Mesh(nestGeo, nestEmit);
  nestD.frustumCulled = nestE.frustumCulled = false; nestE.renderOrder = 1;
  nestScene.add(nestD, nestE);

  // ---- flame: 7 sheets of advected noise, blackbody, rendered at half resolution (out of focus) -----
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
  const NSHEET = 9;
  const FL_ROOT = 6;                                          // flame root just below R (px): the ember at R stays visible under it
  const sheets = [];
  for (let k = 0; k < NSHEET; k++) sheets.push({ dx: (rng() - 0.5) * 46, w: 34 + rng() * 30, h: 0.6 + rng() * 0.55, seed: rng(), gain: 0.5 + rng() * 0.6 });
  sheets.sort((a, b) => b.w - a.w);
  const shGeo = new THREE.BufferGeometry();
  {
    const cor = [], par = [], idx = [];
    sheets.forEach((s, k) => {
      for (const [cx, cy] of [[-1, 0], [1, 0], [-1, 1.25], [1, 1.25]]) { cor.push(cx, cy); par.push(s.dx, s.w, s.h, s.seed); }
      const b = k * 4; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      par.length; // keep
    });
    shGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cor.length / 2 * 3), 3));
    shGeo.setAttribute('corner', new THREE.BufferAttribute(new Float32Array(cor), 2));
    shGeo.setAttribute('par', new THREE.BufferAttribute(new Float32Array(par), 4));
    const gains = []; sheets.forEach(s => { for (let j = 0; j < 4; j++) gains.push(s.gain); });
    shGeo.setAttribute('gain', new THREE.BufferAttribute(new Float32Array(gains), 1));
    shGeo.setIndex(idx);
  }
  const flU = { ...hand, uT: { value: 0 }, uF: { value: 0 }, uHt: { value: 220 }, uBase: { value: new THREE.Vector2(RX, RY + FL_ROOT) }, uNoise: { value: noiseTex }, uFlick: { value: 1 }, uSpread: { value: 1 } };
  const flMat = new THREE.ShaderMaterial({
    uniforms: flU, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    vertexShader: HAND_GLSL + /* glsl */ `
      attribute vec2 corner; attribute vec4 par; attribute float gain;
      uniform float uHt, uSpread; uniform vec2 uBase; varying vec2 vQ; varying vec2 vP;
      void main(){
        float h = uHt * par.z, w = par.y;
        vec2 px = uBase + vec2(par.x * uSpread * (1.0 - 0.55 * corner.y) + corner.x * w * mix(1.0, uSpread, 0.5), -corner.y * h);
        vQ = vec2(corner.x, corner.y); vP = vec2(par.w, gain);
        vec4 c = vec4(px.x / 1920.0 * 2.0 - 1.0, 1.0 - px.y / 1080.0 * 2.0, 0.0, 1.0);
        gl_Position = handClip(c);
      }`,
    fragmentShader: GLSL.common + /* glsl */ `
      uniform float uT, uF, uFlick; uniform sampler2D uNoise; varying vec2 vQ; varying vec2 vP;
      void main(){
        float y = vQ.y, sd = vP.x;
        // two octaves of noise advected upward (the flame's own buoyant flow), the second warped by the first
        float spd = 1.3 + 0.6 * sd;
        vec2 nuv = vec2(vQ.x * 0.18 + sd * 7.31, y * 0.46 - uT * spd * 0.46);
        vec3 n1 = texture2D(uNoise, nuv).rgb;
        vec3 n2 = texture2D(uNoise, nuv * vec2(2.3, 1.9) + (n1.rg - 0.5) * 0.3 + vec2(0.0, -uT * 0.5)).rgb;
        // sway grows with height: the root is anchored in the tinder, the tip licks
        float sway = (n1.r - 0.5) * 1.4 * y * y + 0.16 * sin(uT * (2.1 + 1.5 * sd) + sd * 9.0 - y * 2.6) * y;
        float x = vQ.x - sway;
        // a teardrop: rounded root, widest at ~0.2, a long taper to the tip
        float wy = 0.44 * sqrt(smoothstep(-0.03, 0.18, y)) * pow(max(1.0 - smoothstep(0.05, 1.22, y), 0.0), 0.8) * (1.0 - 0.5 * y) + 1e-3;
        float body = smoothstep(wy, wy * 0.25, abs(x));
        // the upper part tears into separate tongues
        float tongue = smoothstep(0.2, 0.62, n2.g * 1.25 + 0.72 - y * 1.1 + 0.3 * (n1.b - 0.5));
        // the root rises out of the burning tinder: no hard bottom edge
        float dens = body * mix(1.0, tongue, smoothstep(0.04, 0.45, y)) * smoothstep(-0.04, 0.2, y + 0.06 * (n1.g - 0.5));
        // temperature: hottest low in the middle (the luminous soot zone), cooling to the tips
        float core = smoothstep(wy * 0.8, 0.0, abs(x)) * exp(-pow((y - 0.22) / 0.25, 2.0));
        float T = 1050.0 + 880.0 * clamp(0.8 * core + 0.35 * (1.0 - y) * body - 0.15 * y + 0.15 * (n2.b - 0.5), 0.0, 1.0);
        vec3 c = blackbody(T) * dens * (0.3 + 0.75 * core + 0.3 * (1.0 - y)) * vP.y;
        c += vec3(0.20, 0.15, 0.06) * core * core * vP.y;
        gl_FragColor = vec4(c * uF * uFlick * 1.15, 1.0);
      }`,
  });
  const flScene = new THREE.Scene();
  const flMesh = new THREE.Mesh(shGeo, flMat); flMesh.frustumCulled = false; flScene.add(flMesh);
  // smoke: a thin plume curling up out of the flame, lit from below by it (emission only, on black);
  // it shares the flame's half-resolution layer and its defocus
  const smU = { ...hand, uT: flU.uT, uF: flU.uF, uHt: flU.uHt, uBase: flU.uBase, uNoise: flU.uNoise, uSmk: { value: 0 } };
  const smGeo = new THREE.BufferGeometry();
  smGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0]), 3));
  smGeo.setIndex([0, 1, 2, 1, 3, 2]);
  const smMat = new THREE.ShaderMaterial({
    uniforms: smU, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    vertexShader: HAND_GLSL + /* glsl */ `
      uniform vec2 uBase; varying vec2 vPx;
      void main(){
        vec2 px = uBase + vec2(position.x * 230.0, -position.y * 560.0);
        vPx = px;
        gl_Position = handClip(vec4(px.x / 1920.0 * 2.0 - 1.0, 1.0 - px.y / 1080.0 * 2.0, 0.0, 1.0));
      }`,
    fragmentShader: GLSL.common + /* glsl */ `
      uniform float uT, uF, uHt, uSmk; uniform vec2 uBase; uniform sampler2D uNoise; varying vec2 vPx;
      void main(){
        float h = uBase.y - vPx.y;                                   // px above the flame root
        float h0 = uHt * 0.45;                                       // smoke appears above the flame body
        float xc = uBase.x + 26.0 * sin(h * 0.0105 - uT * 0.55) * smoothstep(40.0, 260.0, h) + 0.00009 * h * h;
        float wd = 16.0 + 0.16 * h;
        float xn = (vPx.x - xc) / wd;
        vec2 q = vec2(xn * 0.11 + h * 0.0009, h * 0.0021 - uT * 0.11);
        vec3 n1 = texture2D(uNoise, q).rgb;
        vec3 n2 = texture2D(uNoise, q * vec2(2.4, 2.1) + (n1.rg - 0.5) * 0.25 + vec2(0.0, -uT * 0.07)).rgb;
        float body = exp(-xn * xn * (1.2 + 1.2 * n1.r));
        float dens = body * smoothstep(0.32, 0.8, n1.g * 0.75 + n2.b * 0.55) * smoothstep(h0 * 0.6, h0 * 1.4, h) * (1.0 - smoothstep(300.0, 560.0, h));
        // lit by the flame below it: warm, falling off with height
        vec3 lit = vec3(1.0, 0.52, 0.24) * (0.3 * exp(-max(h - h0, 0.0) / 170.0)) + vec3(0.010, 0.008, 0.006);
        gl_FragColor = vec4(lit * dens * uSmk * clamp(uF, 0.0, 1.0), 1.0);
      }`,
  });
  const smMesh = new THREE.Mesh(smGeo, smMat); smMesh.frustumCulled = false; smMesh.renderOrder = -1; flScene.add(smMesh);
  const flCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const comp = kit.compositor();
  // The flame stands just behind the plane of focus (the fibres in front of it are sharp): a uniform
  // disc gather (the iris) of radius FL_COC turns it into a soft, luminous tongue, its hot core a
  // bokeh disc. Half resolution, scissored to the flame's box — a few ms.
  const FL_COC = 15;                                           // 1080p px
  const flameBlur = ctx.makeRT(Math.round(W / 2), Math.round(H / 2));
  const flBlur = kit.fullscreen(/* glsl */ `
    uniform sampler2D uSrc; uniform vec2 uRes; uniform float uR;
    void main(){
      vec2 px = gl_FragCoord.xy; vec3 s = vec3(0.0);
      for (int i = 0; i < 64; i++){
        float r = uR * sqrt((float(i) + 0.5) / 64.0), a = float(i) * 2.39996;
        s += texture2D(uSrc, (px + vec2(cos(a), sin(a)) * r) / uRes).rgb;
      }
      gl_FragColor = vec4(s / 64.0, 1.0);
    }`, { uSrc: { value: flameRT.texture }, uRes: { value: new THREE.Vector2(flameRT.width, flameRT.height) }, uR: { value: FL_COC * S / 2 } });
  {
    const x0 = Math.floor((RX - 280) * S / 2), y0 = Math.floor((1080 - (RY + 70)) * S / 2);
    const box = new THREE.Vector4(x0, y0, Math.ceil(560 * S / 2), Math.ceil(660 * S / 2));
    flameRT.scissor.copy(box); flameBlur.scissor.copy(box);
  }

  // ---- sparks -----------------------------------------------------------------------------------------
  const G = 4.9, KD = 3.2, SHUT = 0.5 / 24;
  const SP = [-0.050, 0.092, 0.024];                   // flint strike point (above the band, left)
  const sparks = [];
  // sync: the flint sound is sample-synced to t0 (71.5 / 72.5 / 73.5 = f1716 / f1740 / f1764). The strike
  // point is above the frame, and a spark needs ≈ 40 ms to fly into the band, so the spray is released
  // 28–40 ms before t0: its first visible pixels land on the strike frame itself, with the sound
  const strike = (t0, n, seed, landers, gain = 1) => {
    const r = util.rng(seed);
    for (let i = 0; i < n; i++) {
      const sp = 0.25 + Math.pow(r(), 0.7) * 0.75;
      const d = [0.25 + 0.75 * r(), -0.95 + 0.9 * r(), -0.45 + 0.9 * r()];
      const L = Math.hypot(...d);
      // the off-frame pre-roll (t0 − tb) is added to the life: 6–10 frames on screen from the strike frame
      const tb = t0 - 0.040 + r() * 0.012;
      sparks.push({ p0: SP.map((x, j) => x + (r() - 0.5) * 0.006), v0: d.map(x => x / L * sp), tb, life: (6 + r() * 4) / 24 + (t0 - tb), kind: 0, seed: r(), I0: gain * (34 + 60 * Math.pow(r(), 1.5)), T0: 2700 + 700 * r() });
    }
    for (let i = 0; i < landers; i++) {            // aimed into the tinder: they end in the ember
      const tl = 0.16 + 0.03 * i;
      const tgt = [E.x + (r() - 0.5) * 0.004, E.y + 0.001, E.z + (r() - 0.5) * 0.004];
      const p0 = SP.map((x, j) => x + (r() - 0.5) * 0.004);
      const e = (1 - Math.exp(-KD * tl)) / KD, gk = -G / KD;
      const v0 = [0, 1, 2].map(j => { const gkj = j === 1 ? gk : 0; return gkj + (tgt[j] - p0[j] - gkj * tl) / e; });
      sparks.push({ p0, v0, tb: t0 + 0.01 * i, life: tl, kind: 0, seed: r(), I0: 60, T0: 2900 });
    }
  };
  strike(71.5, 30, 1501, 0, 0.85);          // the first strike lights nothing
  strike(72.5, 60, 1502, 0);
  strike(73.5, 40, 1503, 3);
  const T_LAND = 73.5 + 0.16;
  // rising sparks from 77.0: strings of 4–10 born within 0.15 s, plus singles
  {
    const r = util.rng(1504);
    // born inside the flame, slow at first (buoyancy accelerates them): each string stays in frame
    // ~0.5 s; the last full string (78.62) is mid-flight on the cut at 79.0
    const strings = [77.0, 77.45, 77.8, 78.2, 78.45, 78.62, 78.85, 79.1];
    for (const ts of strings) {
      const n = (ts === 78.62 ? 10 : 4 + Math.floor(r() * 6)), x0 = (r() - 0.5) * 0.012;
      for (let i = 0; i < n; i++) sparks.push({ p0: [x0 + (r() - 0.5) * 0.004, 0.016 + r() * 0.014, (r() - 0.5) * 0.008], v0: [(r() - 0.5) * 0.04, 0.06 + 0.11 * r(), (r() - 0.5) * 0.04], tb: ts + r() * 0.15, life: 0.6 + r() * 0.9, kind: 1, seed: r(), I0: 30 + 40 * r(), T0: 1900 + 400 * r() });
    }
    for (let i = 0; i < 24; i++) sparks.push({ p0: [(r() - 0.5) * 0.016, 0.03 + r() * 0.02, (r() - 0.5) * 0.01], v0: [(r() - 0.5) * 0.06, 0.1 + 0.2 * r(), (r() - 0.5) * 0.05], tb: 76.6 + r() * 2.6, life: 0.5 + r() * 0.8, kind: 1, seed: r(), I0: 18 + 30 * r(), T0: 1800 + 400 * r() });
  }
  const NS = sparks.length;
  const spGeo = new THREE.InstancedBufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
  spGeo.setIndex([0, 1, 2, 1, 3, 2]);
  {
    const A = new Float32Array(NS * 4), B = new Float32Array(NS * 4), C = new Float32Array(NS * 4);
    sparks.forEach((s, i) => { A.set([...s.p0, s.tb], 4 * i); B.set([...s.v0, s.life], 4 * i); C.set([s.kind, s.seed, s.I0, s.T0], 4 * i); });
    spGeo.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
    spGeo.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
    spGeo.setAttribute('iC', new THREE.InstancedBufferAttribute(C, 4));
    spGeo.instanceCount = NS;
  }
  const spU = {
    ...hand, uT: { value: 0 }, uShut: { value: SHUT }, uG: { value: G }, uK: { value: KD },
    uPV: { value: new THREE.Matrix4() }, uV: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(W, H) },
    uS: { value: S }, uDF: { value: DF }, uA: { value: COC_A }, uMax: { value: COC_MAX },
  };
  const SPARK_POS = /* glsl */ `
    uniform float uG, uK;
    vec3 posAt(vec4 A, vec4 B, vec4 C, float tau){
      if (C.x < 0.5) { vec3 gk = vec3(0.0, -uG / uK, 0.0); return A.xyz + gk * tau + (B.xyz - gk) * (1.0 - exp(-uK * tau)) / uK; }
      vec3 p = A.xyz + vec3(B.x * tau, B.y * tau + 0.32 * tau * tau, B.z * tau);
      float e = min(tau * 4.0, 1.0);
      p.x += (0.011 * sin(tau * (3.0 + 2.5 * C.y) + C.y * 20.0) + 0.0025 * sin(tau * 13.0 + C.y * 7.0)) * e + 0.01 * tau * (C.y - 0.5);
      p.z += 0.0035 * cos(tau * (3.0 + 2.0 * C.y) + C.y * 13.0) * e;
      return p;
    }`;
  const spMat = new THREE.ShaderMaterial({
    uniforms: spU, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    vertexShader: GLSL.common + HAND_GLSL + SPARK_POS + /* glsl */ `
      attribute vec4 iA, iB, iC;
      uniform float uT, uShut, uS, uDF, uA, uMax; uniform mat4 uPV, uV; uniform vec2 uRes;
      varying vec2 vA, vB; varying float vI, vRad; varying vec3 vCol;
      void main(){
        float tau = uT - iA.w, life = iB.w;
        float alive = step(0.0, tau) * step(tau, life);
        // a flint spark that reaches the soil does not vanish: it lands (time tl, bisection — its fall is
        // monotonic) and cools where it lies for the rest of its 6–10 frames
        float tl = life;
        if (iC.x < 0.5 && posAt(iA, iB, iC, life).y < 0.0) {
          float lo = 0.0, hi = life;
          for (int k = 0; k < 12; k++) { float m = 0.5 * (lo + hi); if (posAt(iA, iB, iC, m).y < 0.0) hi = m; else lo = m; }
          tl = lo;
        }
        vec3 pa = posAt(iA, iB, iC, min(clamp(tau, 0.0, life), tl)), pb = posAt(iA, iB, iC, min(clamp(tau - uShut, 0.0, life), tl));
        float landed = step(tl, tau);
        pa.y = max(pa.y, 0.0015); pb.y = max(pb.y, 0.0015);
        vec4 ca = handClip(uPV * vec4(pa, 1.0)), cb = handClip(uPV * vec4(pb, 1.0));
        vec2 sa = (ca.xy / ca.w * 0.5 + 0.5) * uRes, sb = (cb.xy / cb.w * 0.5 + 0.5) * uRes;
        float d = -(uV * vec4(pa, 1.0)).z;
        float coc = min(uMax, uA * abs(d - uDF) / d) * uS;
        float r0 = 0.9 * uS, rad = sqrt(r0 * r0 + coc * coc);
        float L = length(sa - sb);
        float u = clamp(tau / life, 0.0, 1.0);
        float I = iC.z * (1.0 - u * u) * (0.75 + 0.25 * sin(tau * 70.0 + iC.y * 30.0)) * mix(1.0, 0.55 * exp(-6.0 * (tau - tl)), landed);
        vI = I * alive * (r0 * r0) / (rad * rad) * (2.5 * rad) / (2.5 * rad + L);
        vCol = blackbody(mix(iC.w, 1150.0, u));
        vRad = rad; vA = sa; vB = sb;
        vec2 mn = min(sa, sb) - rad * 3.0, mx = max(sa, sb) + rad * 3.0;
        vec2 P = mix(mn, mx, position.xy * 0.5 + 0.5);
        gl_Position = vec4(P / uRes * 2.0 - 1.0, clamp(ca.z / ca.w, -1.0, 1.0), 1.0);
        if (alive < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vA, vB; varying float vI, vRad; varying vec3 vCol;
      void main(){
        vec2 p = gl_FragCoord.xy, ab = vB - vA;
        float h = clamp(dot(p - vA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
        float d = length(p - vA - ab * h);
        float f = exp(-0.5 * d * d / (vRad * vRad * 0.42));
        gl_FragColor = vec4(vCol * vI * f, 1.0);
      }`,
  });
  const spMesh = new THREE.Mesh(spGeo, spMat); spMesh.frustumCulled = false;
  const spScene = new THREE.Scene(); spScene.add(spMesh);
  spU.uPV.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  spU.uV.value.copy(cam.matrixWorldInverse);

  // JS mirror of the spark motion: the summed spark light for plate 4
  const sparkLight = t => {
    let s = 0;
    for (const sp of sparks) {
      if (sp.kind !== 0 || sp.tb < 72.0) continue;          // the first strike lights nothing
      const tau = t - sp.tb; if (tau < 0 || tau > sp.life) continue;
      const u = tau / sp.life;
      const y = sp.p0[1] + (-G / KD) * tau + (sp.v0[1] + G / KD) * (1 - Math.exp(-KD * tau)) / KD;
      if (y < 0) continue;
      s += sp.I0 * (1 - u * u);
    }
    return s;
  };

  // ---- the cursor footprint (f1776) ---------------------------------------------------------------
  const foot = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes; uniform float uS; uniform vec3 uCol;
    void main(){
      vec2 sxy = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;
      float inside = step(722.0, sxy.x) * step(sxy.x, 746.0) * step(508.0, sxy.y) * step(sxy.y, 572.0);
      gl_FragColor = vec4(uCol * 2.0 * inside, 1.0);
    }`, { uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uCol: { value: new THREE.Vector3(...CURSOR) } },
    { blending: THREE.AdditiveBlending, transparent: true });

  // =====================================================================================================
  // TIME CURVES (pure functions of t)
  // =====================================================================================================
  const { smoothstep: ss, clamp } = util;
  const nz = (t, f, s) => util.shake(t, s, f, 1)[0];          // smooth noise ≈ ±0.9
  // ember: wakes when the sparks land, small until ignition, then the protagonist
  const ember = t => {
    if (t < T_LAND) return 0;
    let e = 0.25 * ss(T_LAND, T_LAND + 0.3, t);
    e += 0.75 * ss(T_IGN + 0.04, T_IGN + 0.9, t);
    return e;
  };
  const hotR = t => {
    if (t < T_LAND) return 0;
    const pre = 0.0025 + 0.0035 * ss(T_LAND, T_IGN, t);
    const post = 0.0105 * ss(T_IGN, T_IGN + 2.2, t) + 0.0045 * clamp((t - T_IGN - 2.2) / 3.0, 0, 1);
    return pre + post;
  };
  const tIg = T_IGN + 1 / 24;                                  // f1777: first frame of flame
  const flame = t => {
    if (t < tIg) return 0;
    const u = (t - tIg) / 0.75;
    const grow = u >= 1 ? 1 : 1 - Math.pow(1 - u, 3);
    const whoosh = 0.25 * Math.exp(-Math.pow((t - tIg - 0.32) / 0.18, 2));
    return grow + whoosh;
  };
  const flick = t => 1 + 0.13 * nz(t, 6.5, 41) + 0.07 * nz(t, 13.0, 43) + 0.10 * nz(t, 2.1, 47);
  const bb = T => {                                              // CPU blackbody (same fit as GLSL)
    T = Math.min(40000, Math.max(1000, T)) / 100;
    const r = T <= 66 ? 1 : Math.min(1, 1.29293618606 * Math.pow(T - 60, -0.1332047592));
    const g = T <= 66 ? Math.min(1, Math.max(0, 0.39008157876 * Math.log(T) - 0.63184144378)) : Math.min(1, 1.12989086089 * Math.pow(T - 60, -0.0755148492));
    const b = T >= 66 ? 1 : T <= 19 ? 0 : Math.min(1, Math.max(0, 0.54320678911 * Math.log(T - 10) - 1.19625408914));
    return [r, g, b].map(c => Math.pow(c, 2.2));
  };
  const C_EMB = bb(1250), C_FL = bb(1850), C_SP = bb(2300);
  const K_EMB = 0.012, K_FL = 0.03, K_SP = 0.0000042;

  return {
    render(shot, f) {
      const t = f.t;
      renderer.setRenderTarget(f.target);
      renderer.setClearColor(0x000000, 1); renderer.clear();
      if (t < 71.45) return;
      const b = breath(util, t, { px: 1.5, deg: 0.15, hz: 0.3, seed: 15, zeroAt: T_IGN });
      setHand(hand, b);
      const em = ember(t), fl = flame(t), fk = flick(t), sl = sparkLight(t);
      // plate weights: ember light, flame light moving between three positions, spark light
      const emb = em * (0.85 + 0.15 * Math.sin(6.2832 * 0.43 * t));
      plateU.uW0.value.set(...C_EMB.map(c => c * K_EMB * emb));
      const a1 = 0.5 + 0.35 * nz(t, 2.8, 51), a2 = 0.5 + 0.4 * nz(t, 3.7, 53), a3 = 0.5 + 0.4 * nz(t, 3.1, 57);
      const as = Math.max(0.05, a1) + Math.max(0.05, a2) + Math.max(0.05, a3);
      const fw = fl * fk * K_FL / as;
      plateU.uW1.value.set(...C_FL.map(c => c * fw * Math.max(0.05, a1)));
      plateU.uW2.value.set(...C_FL.map(c => c * fw * Math.max(0.05, a2)));
      plateU.uW3.value.set(...C_FL.map(c => c * fw * Math.max(0.05, a3)));
      plateU.uW4.value.set(...C_SP.map(c => c * sl * K_SP));
      plateU.uT.value = t; plateU.uHaze.value = clamp(fl, 0, 1);
      const grow = ss(75.0, 79.2, t);                         // the tinder catches: the fire keeps growing
      const ht = 330 * (0.6 + 0.4 * clamp(fl, 0, 1.3)) * (0.9 + 0.1 * fk) * (1 + 0.3 * grow);
      plateU.uFl.value.set(RX, RY + FL_ROOT, ht);
      platePass.render(renderer, f.target);


      // live: ember & burning fibres
      if (em > 0) {
        emU.uT.value = t; emU.uRh.value = hotR(t); emU.uEmb.value = em;
        renderer.setRenderTarget(f.target);
        renderer.render(nestScene, cam);
      }
      // flame (half res, then added)
      if (fl > 0) {
        smU.uSmk.value = ss(tIg + 0.3, tIg + 2.5, t);
        flU.uT.value = t; flU.uF.value = clamp(fl, 0, 1.3) * (1 - 0.12 * grow); flU.uHt.value = ht; flU.uFlick.value = fk; flU.uSpread.value = 1 + 0.5 * grow;
        renderer.setClearColor(0x000000, 1);
        renderer.setRenderTarget(flameRT); renderer.clear();
        flameRT.scissorTest = true; renderer.setRenderTarget(flameRT);
        renderer.render(flScene, flCam);
        flameRT.scissorTest = false;
        renderer.setRenderTarget(flameBlur); renderer.clear();
        flameBlur.scissorTest = true;
        flBlur.render(renderer, flameBlur);
        flameBlur.scissorTest = false;
        comp.material.uniforms.tex.value = flameBlur.texture; comp.material.uniforms.gain.value = 1;
        comp.render(renderer, f.target);
      }
      // sparks
      spU.uT.value = t;
      renderer.setRenderTarget(f.target);
      renderer.render(spScene, cam);
      // the cursor's footprint: one frame, f1776
      if (f.frame === F_FOOT) foot.render(renderer, f.target);
      renderer.setRenderTarget(f.target);
    },
    post(shot, f) {
      // 70.0–71.5 is black, as black as S14's fade: the grain floor only comes up into the first strike
      const grain = 0.04 * ss(71.0, 71.5, f.t);
      return { exposure: 1.0, bloom: 0.8, bloomThreshold: 1.0, streak: 0.05, streakTint: [1.0, 0.72, 0.45], vignette: 0.32, grain };
    },
  };
}
