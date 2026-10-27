// a_descent/world.js — the dusk world under the clouds for A3 (S02-f, f1692–1759).
//
// One continuous world, metres, origin = R_geo (the top of a small rise on the floor of the Rift),
// x east, y up, z SOUTH; the camera comes in from the south along the 4.5° glide line of _clouds.js.
//
//   terrain   one analytic height + albedo function, baked once into five nested, target-centred
//             levels (half extents 256 km · 32 km · 4 km · 500 m · 64 m; 125 m → 6 cm per texel), each
//             band-limited to its own texel, HalfFloat with mipmaps (heights are relative to the target,
//             so half floats keep ≤ 1/1000 of the texel). Per frame: a CAMERA-centred radial grid over
//             the frustum's azimuth range (512 columns × ≈ 700 rings, ring spacing ∝ distance² near the
//             camera then 1 %), displaced in the vertex shader from the finest level that covers it at
//             the pixel footprint (textureLod), Earth curvature applied about the camera's nadir.
//             Fragment: normal from the same level (finite differences), albedo ramp, dusk sky light
//             (cold dome + warm west), lake = mirror of the dusk sky, aerial perspective.
//   Rift      a N–S valley: the west wall (fault scarp + steps, ≈ 1 km, faces east → a dark silhouette
//             against the west glow), the east wall (≈ 0.7 km + the Ngong-like hills), two volcanic cones
//             on the floor to the north (Suswa / Longonot stand-ins), a lake ahead-left (upper left of
//             the frame) that mirrors the western sky, drainage gullies, the target's little rise.
//   acacias   ≈ 30 000 billboards (4 baked umbrella silhouettes), thin on the floor, clumped near R;
//             dark, rim-lit on the west (left) edge; sub-pixel ones keep their mean coverage.
//   grass     ≈ 60 000 tuft cards + 3 000 stones around the last 300 m of the path, drawn back-to-front
//             (the camera is always south of them, looking north: sorted by z, far first).
// Nothing here has a light of its own: the only light is the sky after sunset.
import * as THREE from 'three';
import { SKY_GLSL, camAt, applyCamera, R_EARTH, RX } from '../_clouds.js';

// ---- the Rift (CPU mirror of the few macro lines the instance placement needs) -----------------------
const axisX = z => 1500 * Math.sin(z / 37000) - 600;          // valley axis (m) at z
const wallW = z => axisX(z) - 9000 - 1500 * Math.sin(z / 15000 + 1.3);
const wallE = z => axisX(z) + 11000 + 1200 * Math.sin(z / 19000 + 0.4);
const LAKE = { x: -4800, z: -54000, rx: 3600, rz: 6500 };
const CONES = [[2600, -40000, 720, 8500], [-1500, -82000, 620, 6500]];   // x, z, height, radius

const MACRO = /* glsl */ `
float axisX(float z){ return 1500.0 * sin(z / 37000.0) - 600.0; }
float vn(vec2 p){ return vnoise(p); }
// band-limited fbm octave helper: wavelength lam (m), included only if lam > 3 texels
float oct(vec2 p, float lam, float amp, float tex){ return amp * (vn(p / lam) - 0.5) * smoothstep(2.5 * tex, 5.0 * tex, lam); }
float ridg(vec2 p, float lam, float amp, float tex){ float n = 1.0 - abs(2.0 * vn(p / lam) - 1.0); return amp * n * n * smoothstep(2.5 * tex, 5.0 * tex, lam); }
mat2 RT = mat2(0.8, 0.6, -0.6, 0.8);
// height (m) and albedo parameter (0 dark … 1 salt) at p = (x, z), band-limited to tex (m)
vec2 world(vec2 p, float tex){
  float z = p.y, x = p.x;
  float ax = axisX(z);
  float xw = ax - 9000.0 - 1500.0 * sin(z / 15000.0 + 1.3) + 900.0 * (vn(vec2(z / 9000.0, 3.1)) - 0.5);
  float xe = ax + 11000.0 + 1200.0 * sin(z / 19000.0 + 0.4) + 800.0 * (vn(vec2(z / 8000.0, 7.7)) - 0.5);
  // the walls: a main scarp + a step fault, then the plateau rising gently with ridged relief
  float dW = xw - x, dE = x - xe;                       // > 0 beyond the wall
  float w = 780.0 * smoothstep(-300.0, 1800.0, dW) + 260.0 * smoothstep(2600.0, 5200.0, dW) + 180.0 * smoothstep(6000.0, 26000.0, dW);
  float e = 520.0 * smoothstep(-200.0, 2200.0, dE) + 200.0 * smoothstep(3000.0, 7000.0, dE);
  // the Ngong-like hills on the east plateau edge, south-east of the target
  float ng = 380.0 * exp(-pow((x - xe - 3500.0) / 2600.0, 2.0) - pow((z - 6000.0) / 9000.0, 2.0));
  float h = w + e + ng;
  vec2 q = RT * p;
  // relief on the walls and plateaus: ridged, gullied faces
  float onWall = smoothstep(-500.0, 1500.0, max(dW, dE));
  h += onWall * (ridg(q + 17.0, 4200.0, 160.0, tex) + ridg(RT * q + 3.0, 1500.0, 70.0, tex) + ridg(q * 1.7 + 9.0, 520.0, 22.0, tex));
  // the valley floor: broad swells, low ridges, drainage
  h += oct(p, 9000.0, 70.0, tex) + oct(q, 3200.0, 28.0, tex) + oct(RT * q, 1100.0, 10.0, tex);
  float gul = 1.0 - smoothstep(0.0, 0.08, abs(vn(vec2(p.x / 1700.0, p.y / 5200.0)) - 0.5));
  h -= 9.0 * gul * smoothstep(400.0, 1200.0, 700.0) ;
  // the cones (Suswa / Longonot stand-ins) with summit craters
  ${CONES.map(([cx, cz, ch, cr]) => `{ float r = length(p - vec2(${cx.toFixed(1)}, ${cz.toFixed(1)})) / ${cr.toFixed(1)};
    h += ${ch.toFixed(1)} * (pow(max(1.0 - r, 0.0), 1.6) - 0.22 * exp(-pow(r / 0.12, 2.0))) * (1.0 + 0.12 * (vn(p / 900.0) - 0.5)); }`).join('\n  ')}
  // the lake basin
  vec2 lq = (p - vec2(${LAKE.x.toFixed(1)}, ${LAKE.z.toFixed(1)})) / vec2(${LAKE.rx.toFixed(1)}, ${LAKE.rz.toFixed(1)});
  float lr = length(lq) + 0.18 * (vn(p / 1800.0) - 0.5);
  h -= 70.0 * smoothstep(1.35, 0.75, lr);
  // the target's little rise (R sits on its top)
  h += 26.0 * exp(-dot(p, p) / (750.0 * 750.0)) + 6.0 * exp(-dot(p - vec2(-900.0, -400.0), p - vec2(-900.0, -400.0)) / (500.0 * 500.0));
  // small scales: 400 m … 0.2 m
  h += oct(q, 420.0, 3.2, tex) + oct(RT * q, 160.0, 1.3, tex) + oct(q, 55.0, 0.55, tex) + oct(RT * q, 19.0, 0.22, tex)
     + oct(q, 6.5, 0.09, tex) + oct(RT * q, 2.2, 0.035, tex) + oct(q, 0.75, 0.014, tex) + oct(RT * q, 0.26, 0.006, tex);
  // albedo: dry grass (straw) with olive / dark bush patches, bare red-brown soil, dark lava on the cones,
  // rock on the scarps, pale salt / dust round the lake
  float a = 0.55 + 0.9 * (oct(p, 5200.0, 0.30, tex) + oct(q, 1400.0, 0.30, tex) + oct(RT * q, 380.0, 0.26, tex) + oct(q, 95.0, 0.22, tex)
          + oct(RT * q, 24.0, 0.20, tex) + oct(q, 6.0, 0.18, tex) + oct(RT * q, 1.6, 0.16, tex) + oct(q, 0.45, 0.14, tex));
  a = mix(a, 0.25, onWall * 0.6);
  ${CONES.map(([cx, cz, , cr]) => `a = mix(a, 0.08, smoothstep(1.2, 0.5, length(p - vec2(${cx.toFixed(1)}, ${cz.toFixed(1)})) / ${cr.toFixed(1)}));`).join('\n  ')}
  a = mix(a, 0.95, smoothstep(1.6, 1.05, lr) * smoothstep(0.75, 1.0, lr));
  // the water: below its level the surface is flat (albedo code 1.0 = water)
  float lake = smoothstep(1.0, 0.9, lr);
  float wl = -40.0;
  if (lake > 0.5 && h < wl) { h = wl; a = 1.5; }
  return vec2(h, a);
}`;

export const LEVELS = [[256000, 4096], [32000, 2048], [4000, 2048], [500, 2048], [64, 2048]];

// the sampler chain (vertex and fragment): finest level that covers p, blended at its border
const SAMPLE = /* glsl */ `
uniform sampler2D uT0, uT1, uT2, uT3, uT4;
uniform float uE[5], uX[5];                  // half extent, texel (m)
float hLv(int k, vec2 p, float fp){
  float lod = max(0.0, log2(fp / uX[k])); vec2 uv = p / (2.0 * uE[k]) + 0.5;
  if (k == 0) return textureLod(uT0, uv, lod).r; if (k == 1) return textureLod(uT1, uv, lod).r;
  if (k == 2) return textureLod(uT2, uv, lod).r; if (k == 3) return textureLod(uT3, uv, lod).r;
  return textureLod(uT4, uv, lod).r;
}
vec4 sLv(int k, vec2 p, float fp){
  float lod = max(0.0, log2(fp / uX[k])); float e = uX[k] * exp2(lod);
  vec2 uv = p / (2.0 * uE[k]) + 0.5, du = vec2(e / (2.0 * uE[k]), 0.0);
  vec4 c; float hx, hz;
  if (k == 0) { c = textureLod(uT0, uv, lod); hx = textureLod(uT0, uv + du, lod).r; hz = textureLod(uT0, uv + du.yx, lod).r; }
  else if (k == 1) { c = textureLod(uT1, uv, lod); hx = textureLod(uT1, uv + du, lod).r; hz = textureLod(uT1, uv + du.yx, lod).r; }
  else if (k == 2) { c = textureLod(uT2, uv, lod); hx = textureLod(uT2, uv + du, lod).r; hz = textureLod(uT2, uv + du.yx, lod).r; }
  else if (k == 3) { c = textureLod(uT3, uv, lod); hx = textureLod(uT3, uv + du, lod).r; hz = textureLod(uT3, uv + du.yx, lod).r; }
  else { c = textureLod(uT4, uv, lod); hx = textureLod(uT4, uv + du, lod).r; hz = textureLod(uT4, uv + du.yx, lod).r; }
  return vec4(c.r, c.g, (hx - c.r) / e, (hz - c.r) / e);
}
// the finest level that covers p and is not far finer than the footprint; w = weight of that level
// against the next coarser one (blended at its border)
int pickLv(vec2 p, float fp, out float w){
  float m = max(abs(p.x), abs(p.y));
  for (int k = 4; k >= 1; k--) {
    if (m < uE[k] * 0.97 && fp < uX[k] * 24.0) { w = smoothstep(uE[k] * 0.97, uE[k] * 0.8, m) * smoothstep(uX[k] * 24.0, uX[k] * 12.0, fp); if (w > 0.0) return k; }
  }
  w = 1.0; return 0;
}
float hOf(vec2 p, float fp){
  float w; int k = pickLv(p, fp, w);
  float h = hLv(k, p, fp);
  if (w < 1.0) h = mix(hLv(k - 1, p, fp), h, w);
  return h;
}
// (height, albedo, dh/dx, dh/dz)
vec4 tOf(vec2 p, float fp){
  float w; int k = pickLv(p, fp, w);
  vec4 s = sLv(k, p, fp);
  if (w < 1.0) s = mix(sLv(k - 1, p, fp), s, w);
  return s;
}
`;

// the light after sunset: a cold dome + the warm west; n = surface normal
const LIGHT = /* glsl */ `
vec3 duskLight(vec3 n){
  vec3 wdir = normalize(vec3(-0.95, 0.30, -0.10));
  float sky = 0.55 + 0.45 * n.y;
  float wst = max(0.0, 0.25 + 0.75 * dot(n, wdir));
  return vec3(0.115, 0.130, 0.180) * sky + vec3(0.200, 0.125, 0.075) * wst;
}
vec3 albedoOf(float a){
  // 0 lava/bush · 0.35 olive-brown · 0.6 straw · 0.85 pale dust · 1.0 salt (water handled apart)
  vec3 c0 = vec3(0.040, 0.036, 0.032), c1 = vec3(0.115, 0.098, 0.068), c2 = vec3(0.235, 0.190, 0.120), c3 = vec3(0.330, 0.290, 0.225), c4 = vec3(0.50, 0.48, 0.45);
  a = clamp(a, 0.0, 1.0);
  vec3 c = mix(c0, c1, smoothstep(0.0, 0.35, a));
  c = mix(c, c2, smoothstep(0.35, 0.62, a));
  c = mix(c, c3, smoothstep(0.62, 0.86, a));
  return mix(c, c4, smoothstep(0.86, 1.0, a));
}
// aerial perspective: dusk air between the camera and a point dist metres away
vec3 aerial(vec3 col, vec3 dir, float dist, float alt){
  float k = 1.0 - exp(-dist / 95000.0);
  return mix(col, duskHaze(dir, alt) * 0.55, k);
}
`;

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function vnoise2(x, y, seed) {
  const h = (i, j) => { let v = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(seed, 2246822519); v = Math.imul(v ^ (v >>> 13), 1274126177); v ^= v >>> 16; return (v >>> 0) / 4294967296; };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (h(ix, iy) * (1 - ux) + h(ix + 1, iy) * ux) * (1 - uy) + (h(ix, iy + 1) * (1 - ux) + h(ix + 1, iy + 1) * ux) * uy;
}

// ---- baked sprite atlases (canvas2D, deterministic) ------------------------------------------------
function acaciaAtlas() {
  const S = 256, c = document.createElement('canvas'); c.width = S * 4; c.height = S;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round';
  for (let v = 0; v < 4; v++) {
    const r = rng(9100 + v * 17), ox = v * S;
    // trunk(s): forked, leaning; the umbrella crown: a flat-topped, wide, clumpy canopy
    const tx = ox + S * (0.42 + 0.16 * r()), crownY = S * (0.30 + 0.08 * r()), crownW = S * (0.78 + 0.18 * r());
    g.lineWidth = 7 + 4 * r(); g.beginPath(); g.moveTo(tx, S); g.quadraticCurveTo(tx + (r() - 0.5) * 30, S * 0.7, tx + (r() - 0.5) * 50, crownY + 18); g.stroke();
    for (let k = 0; k < 4; k++) { g.lineWidth = 2.5 + 2 * r(); g.beginPath(); g.moveTo(tx + (r() - 0.5) * 16, S * 0.62); g.quadraticCurveTo(tx + (r() - 0.5) * 60, S * 0.45, ox + S * 0.5 + (r() - 0.5) * crownW * 0.8, crownY + 10); g.stroke(); }
    const cx = ox + S * 0.5;
    for (let k = 0; k < 90; k++) {
      const u = (r() - 0.5) * crownW, h = (1 - Math.pow(Math.abs(u) / (crownW / 2), 2.5)) * S * 0.10;
      const y = crownY - h * r() + r() * S * 0.05;
      g.globalAlpha = 0.55 + 0.45 * r();
      g.beginPath(); g.ellipse(cx + u, y, 6 + 14 * r(), 3 + 6 * r(), 0, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
  }
  return c;
}
function tuftAtlas() {
  const S = 256, c = document.createElement('canvas'); c.width = S * 4; c.height = S;
  const g = c.getContext('2d');
  for (let v = 0; v < 4; v++) {
    const r = rng(7300 + v * 31), ox = v * S;
    for (let k = 0; k < 46; k++) {
      const x0 = ox + S * (0.38 + 0.24 * r()), h = S * (0.45 + 0.52 * r()), lean = (r() - 0.5) * 1.3, curl = (r() - 0.5) * 1.2, w = 2 + 4 * r();
      const sh = Math.round(150 + 105 * r());
      g.strokeStyle = `rgb(${sh},${sh},${sh})`;
      g.lineWidth = w; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, S);
      const a = -Math.PI / 2 + lean;
      const mx = x0 + Math.cos(a) * h * 0.55, my = S + Math.sin(a) * h * 0.55;
      const ex = mx + Math.cos(a + curl) * h * 0.45, ey = my + Math.sin(a + curl) * h * 0.45;
      g.quadraticCurveTo(mx, my, Math.max(ox + 2, Math.min(ox + S - 2, ex)), Math.max(2, ey)); g.stroke();
    }
  }
  return c;
}
const canvasTex = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };

export function createWorld(ctx) {
  const { renderer, W, H, kit, GLSL } = ctx;
  const S = H / 1080;
  // ---- bake the five levels --------------------------------------------------------------------------
  const levels = LEVELS.map(([ext, n]) => kit.bake(renderer, {
    w: n, h: n, float: true, mipmaps: true, wrap: THREE.ClampToEdgeWrapping,
    uniforms: { uExt: { value: ext }, uTex: { value: 2 * ext / n } },
    frag: MACRO + /* glsl */ `
      uniform float uExt, uTex;
      void main(){ vec2 p = (vUv - 0.5) * 2.0 * uExt; vec2 w = world(p, uTex); gl_FragColor = vec4(w.x, w.y, 0.0, 1.0); }`,
  }));
  // the target must sit exactly on the ground: its height (≈ 26 m + noise) is subtracted everywhere
  const U0 = {
    uT0: { value: levels[0] }, uT1: { value: levels[1] }, uT2: { value: levels[2] }, uT3: { value: levels[3] }, uT4: { value: levels[4] },
    uE: { value: LEVELS.map(l => l[0]) }, uX: { value: LEVELS.map(([e, n]) => 2 * e / n) },
    uCam: { value: new THREE.Vector3() }, uFpx: { value: 1000 }, uH0: { value: 0 },
  };
  // read back the target height from the finest level (centre texel) — a one-off in create()
  {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType });
    const m = new THREE.ShaderMaterial({ uniforms: { t: { value: levels[4] } }, vertexShader: `void main(){ gl_Position = vec4(0.0, 0.0, 0.0, 1.0); gl_PointSize = 1.0; }`,
      fragmentShader: `uniform sampler2D t; void main(){ gl_FragColor = vec4(textureLod(t, vec2(0.5), 0.0).r, 0.0, 0.0, 1.0); }` });
    const sc = new THREE.Scene(); const pt = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), m); pt.frustumCulled = false; sc.add(pt);
    renderer.setRenderTarget(rt); renderer.render(sc, new THREE.Camera());
    const px = new Float32Array(4); renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
    U0.uH0.value = px[0]; renderer.setRenderTarget(null); rt.dispose(); m.dispose();
  }
  const COMMON = GLSL.common + GLSL.noise + SKY_GLSL + SAMPLE + LIGHT + /* glsl */ `
    uniform vec3 uCam; uniform float uFpx, uH0;
    // render height of the ground at p (target-relative, with the Earth's curvature about the camera nadir)
    float yOf(vec2 p, float fp){ vec2 d = p - uCam.xz; return hOf(p, fp) - uH0 - dot(d, d) / ${(2 * R_EARTH).toFixed(1)}; }
  `;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, W / H, 1, 1e6);

  // ---- sky (behind everything) ----------------------------------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { uProjInv: { value: new THREE.Matrix4() }, uRot: { value: new THREE.Matrix3() }, uAlt: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: GLSL.common + SKY_GLSL + /* glsl */ `
      varying vec2 vUv; uniform mat4 uProjInv; uniform mat3 uRot; uniform float uAlt;
      void main(){ vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 d = normalize(uRot * (v.xyz / v.w));
        gl_FragColor = vec4(duskSky(d, uAlt), 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat); sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  // ---- terrain: camera-centred radial grid -----------------------------------------------------------
  const NA = 512, NR = 900;
  const tg = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(NA * NR * 3);
    for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const k = (j * NA + i) * 3; pos[k] = i / (NA - 1); pos[k + 1] = j; pos[k + 2] = 0; }
    const idx = new Uint32Array((NA - 1) * (NR - 1) * 6); let o = 0;
    // ring-major, near rings first → drawRange per frame trims the far end
    for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NA - 1; i++) {
      const a = j * NA + i, b = a + 1, c = a + NA, d = c + 1;
      idx[o++] = a; idx[o++] = b; idx[o++] = c; idx[o++] = b; idx[o++] = d; idx[o++] = c;
    }
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tg.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  const terrMat = new THREE.ShaderMaterial({
    uniforms: { ...U0, uRmin: { value: 100 }, uC: { value: 0.004 }, uJ1: { value: 150 }, uQ2: { value: 0.01 }, uAz: { value: new THREE.Vector2() }, uAlt: { value: 0 } },
    vertexShader: COMMON + /* glsl */ `
      uniform float uRmin, uC, uJ1, uQ2; uniform vec2 uAz;
      varying vec3 vW; varying float vFp;
      void main(){
        float j = position.y;
        float r = j < uJ1 ? uRmin / (1.0 - uC * j) : uRmin / (1.0 - uC * uJ1) * exp(uQ2 * (j - uJ1));
        float az = mix(uAz.x, uAz.y, position.x);                 // 0 = north, + east
        vec2 p = uCam.xz + r * vec2(sin(az), -cos(az));
        float dist = length(vec3(p.x - uCam.x, 0.0, p.y - uCam.z));
        float fp = max(dist, 0.5) / uFpx;
        vec3 w = vec3(p.x, yOf(p, fp), p.y);
        vW = w; vFp = fp;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: COMMON + /* glsl */ `
      uniform float uAlt; varying vec3 vW; varying float vFp;
      void main(){
        vec3 v = vW - uCam; float dist = length(v); vec3 dir = v / dist;
        float fp = max(dist / uFpx, 0.004);
        vec4 s = tOf(vW.xz, fp);
        vec3 n = normalize(vec3(-s.z, 1.0, -s.w));
        vec3 col;
        if (s.y > 1.2) {
          // water: the dusk sky mirrored (Fresnel at grazing angles), a little dark body colour
          vec3 rd = reflect(dir, vec3(0.0, 1.0, 0.0));
          float fr = 0.02 + 0.98 * pow(1.0 - max(-dir.y, 0.0), 5.0);
          col = duskSky(normalize(vec3(rd.x, max(rd.y, 0.002), rd.z)), 0.0) * fr * 0.92 + vec3(0.004, 0.005, 0.007);
        } else {
          col = albedoOf(s.y) * duskLight(n);
          // grazing: the dry grass sheen towards the west glow (forward scatter, left of frame)
          col *= 0.9 + 0.35 * max(0.0, -dir.x) * smoothstep(0.2, 0.0, -dir.y);
        }
        col = aerial(col, dir, dist, uAlt);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const terrain = new THREE.Mesh(tg, terrMat); terrain.frustumCulled = false; terrain.renderOrder = 0;
  scene.add(terrain);

  // ---- billboards (trees, tufts): one material type -----------------------------------------------
  // per instance: a = (x, z, width, height), b = (variant, shade, depth-sort key unused, kind)
  const mkBoards = (count, place, atlasTex, look) => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const A = new Float32Array(count * 4), B = new Float32Array(count * 2);
    const list = [];
    for (let i = 0; i < count; i++) { const it = place(i); if (it) list.push(it); }
    list.sort((p, q) => p[1] - q[1]);                           // north (far) first: back to front
    list.forEach((it, i) => { A.set(it.slice(0, 4), i * 4); B.set(it.slice(4, 6), i * 2); });
    g.setAttribute('a', new THREE.InstancedBufferAttribute(A.subarray(0, list.length * 4), 4));
    g.setAttribute('b', new THREE.InstancedBufferAttribute(B.subarray(0, list.length * 2), 2));
    g.instanceCount = list.length;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { ...U0, uAtlas: { value: atlasTex }, uAlt: { value: 0 }, uFade: { value: new THREE.Vector2(0, 1e9) },
        uBody: { value: new THREE.Vector3(...look.body) }, uRim: { value: new THREE.Vector3(...look.rim) }, uMinPx: { value: 1.2 * S } },
      vertexShader: COMMON + /* glsl */ `
        attribute vec4 a; attribute vec2 b; uniform float uMinPx; uniform vec2 uFade;
        varying vec2 vUv; varying float vV, vShade, vCov, vDist; varying vec3 vDir;
        void main(){
          vec2 p = a.xy;
          float dist = length(vec3(p.x - uCam.x, 0.0, p.y - uCam.z));
          float fp = max(dist, 0.5) / uFpx;
          // sub-pixel boards keep their mean coverage: grow to uMinPx, fade by the area ratio
          float hpx = a.w / fp;
          float g = max(1.0, uMinPx / max(hpx, 1e-3));
          vCov = 1.0 / (g * g) * smoothstep(uFade.y, uFade.y * 0.8, dist) * smoothstep(uFade.x, uFade.x * 1.25, dist);
          vec3 base = vec3(p.x, yOf(p, fp) - 0.04 * a.w, p.y);
          vec3 toC = uCam - base; vec2 side = normalize(vec2(toC.z, -toC.x));    // face the camera (cylindrical)
          vec3 w = base + vec3(side.x, 0.0, side.y) * position.x * a.z * g + vec3(0.0, position.y * a.w * g, 0.0);
          vUv = vec2((b.x + position.x + 0.5) / 4.0, 1.0 - position.y);
          vV = position.y; vShade = b.y; vDist = dist; vDir = normalize(w - uCam);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: COMMON + /* glsl */ `
        uniform sampler2D uAtlas; uniform vec3 uBody, uRim; uniform float uAlt;
        varying vec2 vUv; varying float vV, vShade, vCov, vDist; varying vec3 vDir;
        void main(){
          vec4 t = texture2D(uAtlas, vUv);
          float al = t.a * vCov;
          if (al < 0.003) discard;
          // west rim: the texel to the left (west) is empty → this edge sees the glow
          float aw = texture2D(uAtlas, vUv - vec2(0.012 / 4.0, 0.0)).a;
          float rim = clamp(t.a - aw, 0.0, 1.0);
          vec3 col = uBody * (0.55 + 0.45 * t.r) * vShade * (0.6 + 0.4 * vV) + uRim * rim;
          col = aerial(col, vDir, vDist, uAlt);
          gl_FragColor = vec4(col * al, al);
        }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    return { mesh, mat: m, count: list.length };
  };

  // acacias: thin over the floor, clumped near the target, none on the walls, the lake or the cones
  const rT = rng(1728);
  const trees = mkBoards(40000, i => {
    const near = i < 6000;
    const x = near ? (rT() - 0.5) * 5000 : -7000 + rT() * 17000;
    const z = near ? -4500 + rT() * 8000 : -42000 + rT() * 46000;
    if (x < wallW(z) + 1800 || x > wallE(z) - 1500) return null;
    const lr = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz); if (lr < 1.5) return null;
    for (const [cx, cz, , cr] of CONES) if (Math.hypot(x - cx, z - cz) < cr) return null;
    const dens = Math.pow(vnoise2(x / 2200, z / 2200, 3) * 0.7 + vnoise2(x / 600, z / 600, 5) * 0.3, 2.2) * 2.4;
    if (rT() > dens * (near ? 1.0 : 0.55)) return null;
    if (Math.hypot(x, z) < 60) return null;                    // keep the target itself clear
    const wd = 6 + 9 * rT();
    return [x, z, wd * 1.25, wd * (0.62 + 0.25 * rT()), Math.floor(rT() * 4), 0.7 + 0.6 * rT()];
  }, canvasTex(acaciaAtlas()), { body: [0.012, 0.011, 0.011], rim: [0.060, 0.042, 0.030] });
  trees.mesh.renderOrder = 1; scene.add(trees.mesh);

  // grass tufts around the end of the path (the last ~400 m), denser near R
  const rG = rng(1746);
  const tufts = mkBoards(70000, i => {
    const zf = Math.pow(rG(), 1.6);
    const z = 150 - zf * 520;                                  // z ∈ [−370, 150]
    const span = 30 + Math.max(0, 150 - z) * 0.32;
    const x = (rG() - 0.5) * 2 * span;
    const dn = 0.35 + 0.65 * vnoise2(x / 7, z / 7, 11);
    if (rG() > dn) return null;
    if (Math.hypot(x, z) < 0.6) return null;
    const h = 0.25 + 0.65 * Math.pow(rG(), 1.4);
    return [x, z, h * (1.0 + 0.6 * rG()), h, Math.floor(rG() * 4), 0.55 + 0.7 * rG()];
  }, canvasTex(tuftAtlas()), { body: [0.050, 0.040, 0.026], rim: [0.075, 0.052, 0.034] });
  tufts.mesh.renderOrder = 2; scene.add(tufts.mesh);

  // stones: flattened, jittered icosahedra
  const NST = 3500;
  const stoneGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = stoneGeo.attributes.position; const r = rng(77);
    for (let i = 0; i < p.count; i++) { const k = 0.8 + 0.4 * vnoise2(p.getX(i) * 2 + 9, p.getZ(i) * 2 + p.getY(i) * 3, 9); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.55, p.getZ(i) * k); }
    stoneGeo.computeVertexNormals();
  }
  const sg = new THREE.InstancedBufferGeometry().copy(stoneGeo);
  {
    const A = new Float32Array(NST * 4); const r = rng(3141);
    for (let i = 0; i < NST; i++) {
      const z = 150 - Math.pow(r(), 1.5) * 420, span = 25 + Math.max(0, 150 - z) * 0.3;
      A.set([(r() - 0.5) * 2 * span, z, 0.03 + Math.pow(r(), 3) * 0.28, r() * 6.283], i * 4);
    }
    sg.setAttribute('a', new THREE.InstancedBufferAttribute(A, 4)); sg.instanceCount = NST;
  }
  const stoneMat = new THREE.ShaderMaterial({
    uniforms: { ...U0, uAlt: { value: 0 } },
    vertexShader: COMMON + /* glsl */ `
      attribute vec4 a; varying vec3 vN, vW;
      void main(){
        float c = cos(a.w), s = sin(a.w);
        vec3 lp = position * a.z; lp.xz = mat2(c, -s, s, c) * lp.xz;
        vec2 p = a.xy;
        float dist = length(vec3(p.x - uCam.x, 0.0, p.y - uCam.z));
        vec3 w = vec3(p.x, yOf(p, max(dist, 0.5) / uFpx) - a.z * 0.15, p.y) + lp;
        vec3 n = normal; n.xz = mat2(c, -s, s, c) * n.xz;
        vN = n; vW = w;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: COMMON + /* glsl */ `
      uniform float uAlt; varying vec3 vN, vW;
      void main(){ vec3 n = normalize(vN); vec3 v = vW - uCam; float d = length(v);
        vec3 col = vec3(0.10, 0.092, 0.085) * duskLight(n);
        gl_FragColor = vec4(aerial(col, v / d, d, uAlt), 1.0); }`,
  });
  const stones = new THREE.Mesh(sg, stoneMat); stones.frustumCulled = false;
  scene.add(stones);

  const mats = [terrMat, trees.mat, tufts.mat, stoneMat];
  const rot = new THREE.Matrix3();

  return {
    scene, camera: cam, counts: { trees: trees.count, tufts: tufts.count, stones: NST },
    // prepare the scene for frame n (camera, grid extent, LOD switches). Returns the camera state.
    setFrame(n) {
      const c = applyCamera(cam, n, W, H);
      cam.near = Math.min(Math.max(c.alt * 2.0, 0.4), 2000); cam.far = 420000; cam.updateProjectionMatrix();
      const fpx = 1920 / 36 * c.F;                              // 1080p px per unit tangent
      const camPos = cam.position;
      for (const m of mats) { m.uniforms.uCam.value.copy(camPos); m.uniforms.uFpx.value = fpx * S; m.uniforms.uAlt.value = c.alt; }
      skyMat.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse);
      rot.setFromMatrix4(cam.matrixWorld); skyMat.uniforms.uRot.value.copy(rot);
      skyMat.uniforms.uAlt.value = c.alt;
      // grid: azimuths covering the frame (+ margin), nearest ring just below the bottom of the frame
      const left = Math.atan(RX / fpx), right = Math.atan((1920 - RX) / fpx);
      terrMat.uniforms.uAz.value.set(-left - 0.06, right + 0.06);
      const down = 4.5 * Math.PI / 180 + Math.atan(560 / fpx);
      const rmin = Math.max(0.3, c.alt / Math.tan(down) * 0.7 - 2.0);
      const C = 0.0045, J1 = 600 / 4.5 * 0.6;                  // regime 1 until r = rmin / (1 − C·J1) ≈ 1.6 rmin, then 1 %/ring … 2 %
      const Q2 = 0.0125;
      const r1 = rmin / (1 - C * J1);
      const rmax = 330000;
      const nr = Math.min(NR, Math.ceil(J1 + Math.log(rmax / r1) / Q2) + 1);
      Object.assign(terrMat.uniforms.uRmin, { value: rmin }); terrMat.uniforms.uC.value = C; terrMat.uniforms.uJ1.value = J1; terrMat.uniforms.uQ2.value = Q2;
      tg.setDrawRange(0, (nr - 1) * (NA - 1) * 6);
      // detail layers only where they can be seen
      trees.mesh.visible = c.d < 40000;
      trees.mat.uniforms.uFade.value.set(0, 60000);
      tufts.mesh.visible = c.d < 600;
      tufts.mat.uniforms.uFade.value.set(0, 520);
      stones.visible = c.d < 400;
      return c;
    },
  };
}
