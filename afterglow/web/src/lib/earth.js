// A recognisable Earth, built from coordinates only: Natural Earth coastlines are rasterised
// with canvas2D; city lights are synthesised from populated-place positions (blobs ∝ population,
// suburban sprawl dust, highway filaments between neighbouring cities); biomes, ice and clouds are
// procedural. Everything is baked once at create(); per frame the globe is a few texture fetches.
//
//   const earth = await createEarth(ctx, { radius: 1 });
//   scene.add(earth.group);
//   earth.setSun(dirVec3)              // world-space direction *towards* the sun
//   earth.uniforms.lights.value = 1.0  // night lights gain   (also: dayGain, clouds, atmo, airglow, glint)
//   earth.group.rotation.y = ...       // spin (lon 0 faces +Z when rotation is 0)
//   earth.lonLatToLocal(lon, lat, r)   // → THREE.Vector3 in the globe's local frame
import * as THREE from 'three';
import * as GLSL from './glsl.js';
import { bake } from './kit.js';
import { rng } from './util.js';
import { LAND, LAND_HOLES, LAKES } from '../data/land.js';
import { PLACES } from '../data/places.js';

const D2R = Math.PI / 180;

function ringPath(g, pts, W, H, dx = 0) {
  g.moveTo(((pts[0] + 180) / 360) * W + dx, ((90 - pts[1]) / 180) * H);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(((pts[i] + 180) / 360) * W + dx, ((90 - pts[i + 1]) / 180) * H);
  g.closePath();
}

function landCanvas(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  g.beginPath(); for (const r of LAND) ringPath(g, r, W, H); g.fill('evenodd');
  g.fillStyle = '#000';
  g.beginPath(); for (const r of LAND_HOLES) ringPath(g, r, W, H); g.fill();
  g.beginPath(); for (const r of LAKES) ringPath(g, r, W, H); g.fill();
  // Antarctica's ring runs along the bottom edge; make sure the polar cap is solid
  g.fillStyle = '#fff'; g.fillRect(0, H * (1 - 6 / 180), W, H * 6 / 180);
  return c;
}

function lightsCanvas(W, H, seed) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const r = rng(seed);
  const px = (lon, lat) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  const degPx = W / 360;
  // 1) highway filaments between near neighbours (drawn first, faint)
  const top = PLACES.slice(0, 3500);
  g.lineCap = 'round';
  for (let i = 0; i < top.length; i++) {
    const [lo, la, pop] = top[i];
    const cand = [];
    for (let j = 0; j < top.length; j++) {
      if (j === i) continue;
      const dlo = (top[j][0] - lo) * Math.cos(la * D2R), dla = top[j][1] - la;
      const d2 = dlo * dlo + dla * dla;
      if (d2 < 16) cand.push([d2, j]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [d2, j] of cand.slice(0, 2)) {
      const a = px(lo, la), b = px(top[j][0], top[j][1]);
      if (Math.abs(a[0] - b[0]) > W / 2) continue;
      const w = Math.min(1, Math.sqrt(Math.min(pop, top[j][2])) / 2500);
      g.strokeStyle = `rgba(255,180,105,${(0.008 + 0.025 * w).toFixed(3)})`;
      g.lineWidth = Math.max(0.6, 1.0 * W / 8192);
      // slightly wandering road: two segments with a jittered midpoint
      const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * Math.sqrt(d2) * degPx * 0.15, my = (a[1] + b[1]) / 2 + (r() - 0.5) * Math.sqrt(d2) * degPx * 0.15;
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(mx, my, b[0], b[1]); g.stroke();
    }
  }
  // 2) towns & villages: a smooth population-density field splatted from the places, then
  //    hundreds of thousands of tiny lights scattered by rejection sampling against it (land only)
  const DW = 2048, DH = 1024;
  const dc = document.createElement('canvas'); dc.width = DW; dc.height = DH;
  const dg = dc.getContext('2d'); dg.fillStyle = '#000'; dg.fillRect(0, 0, DW, DH); dg.globalCompositeOperation = 'lighter';
  for (const [lo, la, pop] of PLACES) {
    const x = ((lo + 180) / 360) * DW, y = ((90 - la) / 180) * DH;
    const radDeg = 0.25 + 0.9 * Math.pow(pop / 1e6, 0.35);
    const rp = radDeg * DW / 360, k = 1 / Math.max(0.2, Math.cos(la * D2R));
    const a0 = Math.min(0.5, 0.04 + 0.1 * Math.log10(pop / 1e4));
    dg.save(); dg.translate(x, y); dg.scale(k, 1);
    const gr = dg.createRadialGradient(0, 0, 0, 0, 0, rp);
    gr.addColorStop(0, `rgba(255,255,255,${a0.toFixed(3)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    dg.fillStyle = gr; dg.beginPath(); dg.arc(0, 0, rp, 0, Math.PI * 2); dg.fill(); dg.restore();
  }
  const dens = dg.getImageData(0, 0, DW, DH).data;
  const lm = landCanvas(DW, DH).getContext('2d').getImageData(0, 0, DW, DH).data;
  const N = Math.round(4500000 * (W / 8192));
  for (let i = 0; i < N; i++) {
    const lo = r() * 360 - 180, la = Math.asin(2 * r() - 1) / D2R;
    const ix = Math.min(DW - 1, ((lo + 180) / 360 * DW) | 0), iy = Math.min(DH - 1, ((90 - la) / 180 * DH) | 0);
    const o = (iy * DW + ix) * 4;
    if (lm[o] < 128) continue;
    const d = dens[o] / 255;
    if (r() > Math.min(1, d * 2.2 + 0.002)) continue;
    const [x, y] = px(lo, la);
    const b = Math.exp(r.gauss() * 0.7) * (0.35 + 0.65 * d);
    g.fillStyle = `rgba(255,${(165 + 70 * r()) | 0},${(85 + 90 * r()) | 0},${Math.min(0.95, 0.3 * b).toFixed(3)})`;
    const sz = W / 8192 * (0.8 + 0.8 * r());
    g.fillRect(x, y, sz, sz);
  }
  // 3) urban cores: soft blobs (horizontal radius stretched by 1/cos(lat) for the equirect)
  for (const [lo, la, pop] of PLACES) {
    const [x, y] = px(lo, la);
    if (pop < 150000) continue;
    const rad = Math.max(0.9, 0.0032 * Math.pow(pop, 0.42)) * W / 8192;
    const k = 1 / Math.max(0.15, Math.cos(la * D2R));
    const I = Math.min(1, 0.25 + Math.log10(pop) / 7);
    g.save(); g.translate(x, y); g.scale(k, 1);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, rad * 2.2);
    grd.addColorStop(0, `rgba(255,232,195,${(0.16 * I).toFixed(3)})`);
    grd.addColorStop(0.3, `rgba(255,190,110,${(0.05 * I).toFixed(3)})`);
    grd.addColorStop(0.7, `rgba(255,165,80,${(0.012 * I).toFixed(3)})`);
    grd.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(0, 0, rad * 2.2, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // light diffusion (atmospheric scatter): add a blurred copy underneath
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  const g2 = c2.getContext('2d');
  g2.filter = `blur(${(6 * W / 8192).toFixed(1)}px)`; g2.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35; g.drawImage(c2, 0, 0); g.globalAlpha = 1;
  return c;
}

const canvasTex = (c, { mip = true } = {}) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = mip; t.anisotropy = 8;
  return t;
};

// Seamless equirect lookup from an object-space unit vector (Tarini's trick for the seam).
const EQUIRECT = /* glsl */ `
vec2 eqUV(vec3 n){
  float lon = atan(n.x, n.z); float lat = asin(clamp(n.y, -1.0, 1.0));
  float u1 = lon / TAU + 0.5; float u2 = fract(lon / TAU + 1.0);
  float u = fwidth(u1) <= fwidth(u2) + 1e-6 ? u1 : u2;
  return vec2(u, lat / PI + 0.5);
}`;

export async function createEarth(ctx, { radius = 1, lightsW = 8192, landW = 4096, seed = 3, segments = 192 } = {}) {
  const { renderer } = ctx;
  const landTex = canvasTex(landCanvas(landW, landW / 2));
  const lightsTex = canvasTex(lightsCanvas(lightsW, lightsW / 2, seed));
  // biome / albedo + ocean shelf, baked in a shader from the land mask
  const albedoTex = bake(renderer, {
    w: 4096, h: 2048, wrap: THREE.RepeatWrapping,
    uniforms: { land: { value: landTex } },
    frag: /* glsl */ `uniform sampler2D land;
      vec3 dirOf(vec2 uv){ float lon = (uv.x - 0.5) * TAU, lat = (uv.y - 0.5) * PI; return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); }
      void main(){
        vec2 uv = vUv; vec3 d = dirOf(uv); float lat = (uv.y - 0.5) * 180.0;
        float m = texture2D(land, uv).r;
        float shelf = 0.0; for (int i = 0; i < 8; i++) { float a = float(i) * 0.785; shelf += texture2D(land, uv + vec2(cos(a) * 0.0025, sin(a) * 0.005)).r; } shelf /= 8.0;
        float n1 = fbm(d * 3.0, 6), n2 = fbm(d * 11.0 + 3.0, 4);
        float alat = abs(lat); float lon = (uv.x - 0.5) * 360.0;
        // deserts & steppes placed by region (lon0, lon1, lat0, lat1), edges warped by noise
        const vec4 BX[12] = vec4[12](vec4(-17.,35.,15.,31.), vec4(35.,59.,13.,31.), vec4(50.,73.,24.,37.), vec4(50.,80.,36.,47.),
          vec4(76.,112.,37.,46.), vec4(115.,146.,-32.,-19.), vec4(12.,26.,-29.,-17.), vec4(40.,51.,0.,12.),
          vec4(-118.,-102.,25.,38.), vec4(-112.,-97.,32.,50.), vec4(-72.,-68.,-30.,-15.), vec4(-72.,-64.,-50.,-38.));
        const float BS[12] = float[12](1.0, 1.0, 0.7, 0.55, 0.9, 0.9, 0.7, 0.6, 0.6, 0.3, 0.8, 0.45);
        float wlon = lon + (fbm(d * 4.0 + 11.0, 4) - 0.5) * 9.0, wlat = lat + (fbm(d * 4.0 + 23.0, 4) - 0.5) * 6.0;
        float arid = 0.0;
        for (int i = 0; i < 12; i++) { vec4 b = BX[i];
          float m2 = smoothstep(b.x - 3.0, b.x + 3.0, wlon) * smoothstep(b.y + 3.0, b.y - 3.0, wlon) * smoothstep(b.z - 3.0, b.z + 3.0, wlat) * smoothstep(b.w + 3.0, b.w - 3.0, wlat);
          arid = max(arid, m2 * BS[i]); }
        arid = clamp(arid * (0.8 + 0.5 * n1), 0.0, 1.0);
        vec3 forest = mix(vec3(0.03, 0.045, 0.02), vec3(0.055, 0.06, 0.03), n2);
        vec3 tropic = vec3(0.02, 0.04, 0.015);
        vec3 desert = mix(vec3(0.30, 0.20, 0.11), vec3(0.42, 0.30, 0.18), n2);
        vec3 steppe = vec3(0.13, 0.11, 0.065);
        vec3 tundra = vec3(0.09, 0.085, 0.07);
        vec3 c = mix(tropic, forest, smoothstep(10.0, 35.0, alat));
        c = mix(c, steppe, smoothstep(0.15, 0.5, arid) * 0.8);
        c = mix(c, desert, smoothstep(0.45, 0.85, arid));
        c = mix(c, tundra, smoothstep(55.0, 68.0, alat + (n1 - 0.5) * 10.0));
        float ice = smoothstep(68.0, 74.0, alat + (n1 - 0.5) * 8.0);
        // Greenland & Antarctica icy interiors
        ice = max(ice, smoothstep(0.0, 1.0, (alat - 60.0) / 5.0) * step(0.5, m) * step(60.0, alat));
        c = mix(c, vec3(0.75, 0.78, 0.82), ice);
        vec3 ocean = mix(vec3(0.004, 0.014, 0.04), vec3(0.01, 0.045, 0.07), smoothstep(0.0, 1.0, shelf) * 0.8);
        ocean = mix(ocean, vec3(0.6, 0.65, 0.7), smoothstep(72.0, 80.0, alat + (n1 - 0.5) * 6.0) * 0.8); // sea ice
        gl_FragColor = vec4(mix(ocean, c, m), m);
      }`,
  });
  // clouds: latitude-banded, domain-warped fbm with storm swirls
  const cloudTex = bake(renderer, {
    w: 4096, h: 2048, wrap: THREE.RepeatWrapping,
    frag: /* glsl */ `
      vec3 dirOf(vec2 uv){ float lon = (uv.x - 0.5) * TAU, lat = (uv.y - 0.5) * PI; return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); }
      void main(){
        vec3 d = dirOf(vUv); float lat = (vUv.y - 0.5) * 180.0; float alat = abs(lat);
        vec3 q = d * 2.2; q += 0.6 * vec3(fbm(q + 1.3, 4), fbm(q + 7.1, 4), fbm(q + 3.7, 4));
        float n = fbm(q * 2.0, 7);
        float band = 0.45 + 0.35 * exp(-pow(lat / 7.0, 2.0)) + 0.3 * exp(-pow((alat - 55.0) / 12.0, 2.0)) - 0.25 * exp(-pow((alat - 25.0) / 8.0, 2.0));
        float c = smoothstep(0.62 - band * 0.25, 0.85 - band * 0.2, n);
        c *= 0.75 + 0.25 * fbm(d * 40.0, 3);
        gl_FragColor = vec4(c, c, c, 1.0);
      }`,
  });

  const uniforms = {
    landTex: { value: landTex }, lightsTex: { value: lightsTex }, albedoTex: { value: albedoTex }, cloudTex: { value: cloudTex },
    sunDir: { value: new THREE.Vector3(1, 0, 0) },
    dayGain: { value: 1.0 }, lights: { value: 1.0 }, clouds: { value: 1.0 }, glint: { value: 1.0 },
    atmo: { value: 1.0 }, airglow: { value: 0.25 }, cloudShift: { value: 0.0 }, lightsWarm: { value: 1.0 },
    time: { value: 0 },
  };
  const surface = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `varying vec3 vObjN; varying vec3 vWN; varying vec3 vWPos;
      void main(){ vObjN = normalize(position); vWN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vWPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: GLSL.common + EQUIRECT + /* glsl */ `
      uniform sampler2D landTex, lightsTex, albedoTex, cloudTex; uniform vec3 sunDir;
      uniform float dayGain, lights, clouds, glint, cloudShift, lightsWarm, time;
      varying vec3 vObjN; varying vec3 vWN; varying vec3 vWPos;
      void main(){
        vec3 n = normalize(vObjN); vec3 N = normalize(vWN); vec3 L = normalize(sunDir);
        vec3 V = normalize(cameraPosition - vWPos);
        vec2 uv = eqUV(n);
        vec4 alb = texture2D(albedoTex, uv);
        float land = alb.a;
        float cl = texture2D(cloudTex, uv + vec2(cloudShift, 0.0)).r * clouds;
        float ndl = dot(N, L);
        float day = smoothstep(-0.08, 0.25, ndl);
        // day side: albedo lit, ocean glint
        vec3 col = alb.rgb * max(ndl, 0.0) * 2.2;
        vec3 H = normalize(L + V);
        float nh = max(dot(N, H), 0.0);
        float spec = (pow(nh, 900.0) * 6.0 + pow(nh, 60.0) * 0.12) * (1.0 - land) * (1.0 - cl);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        col += vec3(1.0, 0.88, 0.72) * spec * glint * smoothstep(0.0, 0.1, ndl);
        col += vec3(0.02, 0.05, 0.12) * fres * (1.0 - land) * max(ndl, 0.0);
        // clouds: lit on the day side, faint moonlit on the night side
        vec3 cloudCol = vec3(0.9) * max(ndl, 0.0) * 2.0 + vec3(0.004, 0.006, 0.012);
        col = mix(col, cloudCol, cl * 0.92);
        col *= dayGain;
        // night side: faint moon/airglow-lit land so continents read against the ocean
        col += alb.rgb * vec3(0.5, 0.6, 0.9) * 0.025 * (1.0 - day) * (1.0 - cl * 0.5);
        // limb haze over the disc
        float rimV = 1.0 - max(dot(N, V), 0.0);
        col += vec3(0.12, 0.3, 0.8) * pow(rimV, 3.0) * smoothstep(-0.2, 0.5, ndl) * 0.35;
        // terminator warmth
        col += vec3(0.5, 0.18, 0.05) * exp(-pow(ndl / 0.06, 2.0)) * 0.12 * (0.4 + cl);
        // night side: city lights (sodium orange, whiter cores), dimmed & blurred by clouds
        float night = 1.0 - smoothstep(-0.15, 0.08, ndl);
        vec3 li = texture2D(lightsTex, uv).rgb;
        float lum = dot(li, vec3(0.333)) * 3.0;  // canvas stores lights at 1/3 to keep 8-bit headroom
        lum = lum * (0.35 + 0.65 * smoothstep(0.0, 0.6, lum));
        vec3 warm = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.85, 0.65), smoothstep(0.4, 1.2, lum));
        vec3 lightsCol = mix(vec3(lum), lum * warm, lightsWarm) * 1.6;
        col += lightsCol * lights * night * (1.0 - 0.75 * cl);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const geo = new THREE.SphereGeometry(radius, segments, segments / 2);
  const globe = new THREE.Mesh(geo, surface);
  // atmosphere: additive back-face shell with a limb-brightened scattering approximation and airglow
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: Object.assign(uniforms, { R: { value: radius }, C: { value: new THREE.Vector3() } }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: /* glsl */ `varying vec3 vWN; varying vec3 vWPos; void main(){ vWN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vWPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: GLSL.common + /* glsl */ `uniform vec3 sunDir; uniform float atmo, airglow, R; uniform vec3 C; varying vec3 vWN; varying vec3 vWPos;
      void main(){
        // closest approach of the view ray to the planet centre → altitude of the ray above the surface
        vec3 ro = cameraPosition; vec3 rd = normalize(vWPos - ro);
        float tca = dot(C - ro, rd); vec3 pc = ro + rd * tca; float dmin = length(pc - C);
        float alt = max(dmin - R, 0.0) / R;
        float dens = exp(-alt / 0.0065);                    // thin, crisp limb
        vec3 n = normalize(pc - C); vec3 L = normalize(sunDir);
        float mu = dot(n, L);
        float lit = smoothstep(-0.3, 0.4, mu);
        vec3 rayleigh = vec3(0.16, 0.4, 1.0) * dens * lit * 2.4;
        rayleigh += vec3(1.0, 0.33, 0.07) * dens * exp(-pow(mu / 0.14, 2.0)) * 1.4;     // sunset ring at the terminator
        // forward scattering when looking towards the sun through the limb
        float fwd = pow(max(dot(rd, L), 0.0), 8.0);
        rayleigh += vec3(1.0, 0.75, 0.5) * dens * fwd * 3.0 * smoothstep(-0.2, 0.1, mu);
        vec3 glow = vec3(0.12, 0.6, 0.25) * exp(-pow((alt - 0.015) / 0.004, 2.0)) * (1.0 - lit) * airglow * 0.5; // airglow band
        gl_FragColor = vec4((rayleigh + glow) * atmo, 1.0);
      }`,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.04, 128, 64), atmoMat);
  const group = new THREE.Group();
  group.add(globe); group.add(atmo);
  return {
    group, globe, atmo, uniforms,
    textures: { landTex, lightsTex, albedoTex, cloudTex },
    setSun(v) { uniforms.sunDir.value.copy(v).normalize(); },
    // call after moving the group so the atmosphere knows where the planet centre is
    update() { group.updateMatrixWorld(); uniforms.C.value.setFromMatrixPosition(group.matrixWorld); uniforms.R.value = radius * group.scale.x; },
    lonLatToLocal(lon, lat, r = radius) {
      const lo = lon * D2R, la = lat * D2R;
      return new THREE.Vector3(Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r);
    },
  };
}
