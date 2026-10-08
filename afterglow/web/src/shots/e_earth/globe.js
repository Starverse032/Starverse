// Fullscreen ray-cast globe for e_earth / e_final.
//
// Why not the earth.js mesh: S14 must reproduce anchors.arc to < 1 px and the montage flies at
// 250–700 km where a 192-segment sphere has ~1 km chord error and visible facet seams. Here every
// pixel intersects the exact unit sphere analytically, so the limb is the true horizon conic, it is
// anti-aliased from its own analytic distance, and there is no tessellation at any altitude.
// The baked earth.js textures (albedo / clouds / lights) are reused; on top come:
//   moonlight (diffuse + soft ocean glint), city-lit cloud bellies, the lights birth mask (S18),
//   one regional detail patch (4096² tangent-plane texture, footprint-blended with the global map),
//   a physically placed atmosphere (Rayleigh limb, terminator ring, airglow layer), the S14 conic
//   limb profile, a few screen-space light sprites (rising light, cursor footprint), card dimming.
import * as THREE from 'three';
import * as GLSL from '../../lib/glsl.js';
import { FSQ } from '../../post.js';

const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
uniform vec2 res; uniform float fpx;
uniform vec3 camPos, camR, camU, camB;
uniform sampler2D albedoTex, cloudTex, lightsTex, birthTex, patchTex;
uniform vec3 sunDir, moonDir;
uniform float dayGain, moonGain, lightsGain, cloudsGain, cloudShift, glowGain, nightLand;
uniform float atmoGain, airglowGain, airglowAlt, airglowSig, rayleighH, termGain, glintExp, glintBroad;
// birth mask
uniform float birthOn, birthTau, birthSoft; uniform vec4 birthRect;   // lon0, lat0, lon1, lat1 (deg)
// detail patch
uniform float patchOn, patchHalf, patchGain, patchTexels; uniform vec3 patchC, patchE, patchN;
// S14 conic limb
uniform float conicOn, conicCore, conicGlow, conicOut, twGain; uniform vec3 airCol;
uniform float S;                           // pixel scale (H / 1080)
// sprites: xy = px (top-left origin), z = radius px, w = shape (0 round, 1 rect 24×64 footprint)
uniform vec4 spr[4]; uniform vec4 sprCol[4];
uniform vec4 dimRect; uniform float dimAmt;   // card box (px, top-left origin): x0, y0, x1, y1
uniform float lightsColdOcean;               // unused hook (kept 0)
// clear sky: clouds thinned inside a cap around clearDir (cos of inner / outer radius) — S18 opens on
// a cloudless night over the Rift so the first lamps are crisp, the weather comes in with distance
uniform vec3 clearDir; uniform vec2 clearCos; uniform float clearAmt;
varying vec2 vUv;

vec2 eqUV(vec3 n){
  float lon = atan(n.x, n.z); float lat = asin(clamp(n.y, -1.0, 1.0));
  float u1 = lon / TAU + 0.5; float u2 = fract(lon / TAU + 1.0);
  float u = fwidth(u1) <= fwidth(u2) + 1e-6 ? u1 : u2;
  return vec2(u, lat / PI + 0.5);
}
// cubic B-spline reconstruction from 4 bilinear taps at an explicit mip level: under strong
// magnification (S18 at 400–2000 km) plain bilinear draws every coarse texel as a soft square.
vec3 texBS(sampler2D t, vec2 uv, float lod){
  float L = floor(lod + 0.5);
  vec2 size = vec2(textureSize(t, int(L)));
  vec2 st = uv * size - 0.5; vec2 i = floor(st); vec2 f = st - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 p0 = (i + 0.5 - 1.0 + w1 / g0) / size, p1 = (i + 0.5 + 1.0 + w3 / g1) / size;
  return g0.y * (g0.x * textureLod(t, vec2(p0.x, p0.y), L).rgb + g1.x * textureLod(t, vec2(p1.x, p0.y), L).rgb)
       + g1.y * (g0.x * textureLod(t, vec2(p0.x, p1.y), L).rgb + g1.x * textureLod(t, vec2(p1.x, p1.y), L).rgb);
}
// mip level a texture of the given size would pick for coordinates c (implicit derivatives)
float footLod(vec2 c, vec2 size){
  vec2 dx = dFdx(c) * size, dy = dFdy(c) * size;
  return 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-12));
}
// sodium / white mapping of the 8-bit earth.js lights map (stored at 1/3)
vec3 globalLights(vec2 uv, float lod){
  vec3 li;
  if (lod > 0.0) li = texBS(lightsTex, uv, lod);
  else { float fl = footLod(uv, vec2(textureSize(lightsTex, 0))); li = fl < 0.0 ? texBS(lightsTex, uv, 0.0) : texture2D(lightsTex, uv).rgb; }
  float lum = dot(li, vec3(0.333)) * 3.0;
  lum = lum * (0.35 + 0.65 * smoothstep(0.0, 0.6, lum));
  vec3 warm = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.85, 0.65), smoothstep(0.4, 1.2, lum));
  return lum * warm * 1.6;
}
// regional HDR night map (nightmap.js) over nightRect, faded into the global map at its border
uniform sampler2D nightTex; uniform vec4 nightRect; uniform float nightOn, nightGain;
vec2 nightUV(vec3 n){
  float lon = atan(n.x, n.z) * 57.29578, lat = asin(clamp(n.y, -1.0, 1.0)) * 57.29578;
  return vec2((lon - nightRect.x) / (nightRect.z - nightRect.x), (lat - nightRect.y) / (nightRect.w - nightRect.y));
}
// Detail synthesis for magnified lights: where a pixel is much smaller than a night-map texel the
// map's smooth gaussian splats are redistributed into a field of discrete point lamps (mean = 1, so the
// flux is conserved) — a town seen from 1000 km becomes a cluster of sharp lights instead of a soft
// ball. Every lamp's PSF is at least ~0.6 px (band-limited), and the field fades back to its mean
// once a cell spans less than ~1.5 px, so it can never alias or shimmer.
uniform float sparkOn;
float pixKmG;                      // pixel footprint on the ground (km), set in main()
float sparkLayer(vec2 x, float cellKm, float sd){
  vec2 q = x / cellKm; vec2 c0 = floor(q);
  float sig = max(0.11 * cellKm, 0.6 * pixKmG) / cellKm;      // PSF σ in cell units
  float s = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = c0 + vec2(float(i), float(j));
    vec3 h = hash33(vec3(c, sd));
    vec2 d = q - (c + 0.1 + 0.8 * h.xy);
    float b = 0.25 + 2.2 * h.z * h.z * h.z;               // mean 0.8: a few bright lamps, many faint
    s += b * exp(-0.5 * dot(d, d) / (sig * sig));
  }
  return s / (0.8 * 6.2832 * sig * sig);                 // normalise: E[s] = 1
}
float sparkle(vec3 n){
  if (sparkOn < 0.5) return 1.0;
  float lat = asin(clamp(n.y, -1.0, 1.0)), lon = atan(n.x, n.z);
  vec2 x = vec2(lon * cos(lat), lat) * 6371.0;            // km
  float w1 = 1.0 - smoothstep(0.3, 0.7, pixKmG / 0.9);  // fine lamps (0.9 km cells)
  float w2 = 1.0 - smoothstep(0.3, 0.7, pixKmG / 2.8);   // clustered blocks (2.8 km cells)
  float s = 1.0;
  if (w2 > 0.0) s = mix(1.0, sparkLayer(x, 2.8, 5.0), w2);
  if (w1 > 0.0) s *= mix(1.0, sparkLayer(x + 13.7, 0.9, 9.0), w1);
  return s;
}
vec3 lightsAt(vec3 n, vec2 uv, float lod){
  float w = 0.0; vec3 m = vec3(0.0);
  if (nightOn > 0.5) {
    vec2 nu = nightUV(n); vec2 e = min(nu, 1.0 - nu);
    w = smoothstep(0.0, 0.03, min(e.x, e.y));
    if (w > 0.0) {
      if (lod > 0.0) m = texBS(nightTex, nu, max(lod - 1.0, 0.0));
      else { float fl = footLod(nu, vec2(textureSize(nightTex, 0))); m = fl < 0.0 ? texBS(nightTex, nu, 0.0) : texture2D(nightTex, nu).rgb; }
      m *= nightGain;
      if (lod <= 0.0 && dot(m, m) > 1e-8) m *= sparkle(n);
    }
  }
  if (w >= 1.0) return m;
  return mix(globalLights(uv, lod), m, w);
}
float birthAt(vec3 n){
  float lon = atan(n.x, n.z) * 57.29578, lat = asin(clamp(n.y, -1.0, 1.0)) * 57.29578;
  vec2 b = vec2((lon - birthRect.x) / (birthRect.z - birthRect.x), (lat - birthRect.y) / (birthRect.w - birthRect.y));
  if (b.x < 0.0 || b.x > 1.0 || b.y < 0.0 || b.y > 1.0) return 9.0;
  vec2 e = textureLod(birthTex, b, 0.0).rg;
  return (e.r * 256.0 + e.g) * (255.0 / 16384.0);
}

void main(){
  vec2 frag = gl_FragCoord.xy;                       // bottom-left origin
  vec2 pix = vec2(frag.x, res.y - frag.y);           // top-left origin (screenplay convention)
  vec3 dc = normalize(vec3((frag.x - 0.5 * res.x) / fpx, (frag.y - 0.5 * res.y) / fpx, -1.0));
  vec3 rd = normalize(camR * dc.x + camU * dc.y + camB * dc.z);
  vec3 ro = camPos;
  float b = dot(ro, rd), c = dot(ro, ro) - 1.0, disc = b * b - c;
  float D = length(ro);
  // angular distance to the horizon cone → signed pixel distance to the limb (first-order, = |Q|/|∇Q|)
  vec3 cdir = -ro / D;
  float th = acos(clamp(dot(rd, cdir), -1.0, 1.0));
  float alpha = asin(clamp(1.0 / D, 0.0, 1.0));
  float gth = length(vec2(dFdx(th), dFdy(th))) + 1e-9;
  float sd = (alpha - th) / gth;                     // > 0 inside the disc, in pixels
  float cov = clamp(sd + 0.5, 0.0, 1.0);
  vec3 L = normalize(sunDir), M = normalize(moonDir);
  vec3 col = vec3(0.0);
  float tHit = -b - sqrt(max(disc, 0.0));
  vec3 n = normalize(ro + rd * max(tHit, 0.0));
  pixKmG = 0.7071 * length(vec2(length(dFdx(n)), length(dFdy(n)))) * 6371.0;
  {   // surface (evaluated everywhere: keeps implicit derivatives well defined at the limb)
    vec3 V = -rd;
    vec2 uv = eqUV(n);
    vec4 alb = texture2D(albedoTex, uv);
    float land = alb.a;
    // ---- detail patch (tangent plane) ----
    vec4 pt = vec4(0.0); float pw = 0.0;
    if (patchOn > 0.5) {
      vec3 dpp = n - patchC;
      vec2 puv = vec2(dot(dpp, patchE), dot(dpp, patchN)) / (2.0 * patchHalf) + 0.5;
      vec2 e = min(puv, 1.0 - puv);
      pw = smoothstep(0.0, 0.22, min(e.x, e.y)) * step(0.0, dot(n, patchC));
      // footprint blend: patch texels per pixel; once a pixel covers > 48 patch texels the global map is as good
      float fp = length(vec2(length(dFdx(puv)), length(dFdy(puv)))) * patchTexels;
      pw *= 1.0 - smoothstep(24.0, 64.0, fp);
      pt = texture2D(patchTex, puv); land = mix(land, pt.a, pw);
    }
    float cl = texture2D(cloudTex, uv + vec2(cloudShift, 0.0)).r * cloudsGain;
    if (clearAmt > 0.0) cl *= 1.0 - clearAmt * smoothstep(clearCos.y, clearCos.x, dot(n, clearDir));
    float ndl = dot(n, L), ndm = dot(n, M);
    float day = smoothstep(-0.08, 0.25, ndl);
    vec3 albc = mix(mix(vec3(0.004, 0.014, 0.04), vec3(0.008, 0.03, 0.055), alb.a), alb.rgb, land);   // patch coast overrides land/sea
    // day side (dawn crescent / terminator)
    vec3 H = normalize(L + V); float nh = max(dot(n, H), 0.0);
    vec3 dayc = albc * max(ndl, 0.0) * 2.2;
    dayc += vec3(1.0, 0.88, 0.72) * (pow(nh, 900.0) * 6.0 + pow(nh, 60.0) * 0.12) * (1.0 - land) * (1.0 - cl) * smoothstep(0.0, 0.1, ndl);
    dayc = mix(dayc, vec3(0.9) * max(ndl, 0.0) * 2.0, cl * 0.92);
    col += dayc * dayGain;
    col += vec3(0.5, 0.18, 0.05) * exp(-pow(ndl / 0.06, 2.0)) * 0.12 * (0.4 + cl) * dayGain;
    // moonlight: diffuse land/sea + moonlit clouds + a broad soft glint on open water
    vec3 moonC = vec3(0.345, 0.456, 0.693);        // #9FB4D9 linear
    float mdl = max(ndm, 0.0);
    vec3 moonLit = albc * mdl * 2.2;
    vec3 Hm = normalize(M + V); float nhm = max(dot(n, Hm), 0.0);
    // wave facets (~300 m, fixed to the surface) break a sharp glint into sparkle
    float facet = glintExp > 300.0 ? 0.25 + 1.5 * pow(vnoise(n * 21000.0), 3.0) : 1.0;
    float glintM = (pow(nhm, glintExp) * 2.2 * facet + pow(nhm, 40.0) * glintBroad) * (1.0 - land) * (1.0 - cl) * smoothstep(0.0, 0.15, ndm);
    moonLit = mix(moonLit, vec3(0.55, 0.6, 0.68) * mdl * 1.6, cl * 0.9) + glintM * vec3(0.9, 0.95, 1.0);
    col += moonLit * moonC * moonGain * (1.0 - day);
    // ambient night (airglow/starlight) so continents still separate from the sea
    col += albc * vec3(0.5, 0.6, 0.9) * nightLand * (1.0 - day) * (1.0 - cl * 0.5);
    // ---- city lights ----
    float night = 1.0 - smoothstep(-0.15, 0.08, ndl);
    if (lightsGain > 0.0) {
      vec3 gl = lightsAt(n, uv, 0.0);
      // the patch only adds detail where the global map says people live (keeps both maps consistent)
      // (the patch is built from the same places as the regional map; it replaces it where it lies)
      vec3 li = mix(gl, pt.rgb * patchGain, pw);
      // cloud bellies: blurred lights (~25–80 km kernel) under cloud only (skipped where it cannot show)
      vec3 blur = cl * glowGain > 0.004 ? lightsAt(n, uv, 4.0) * 2.2 : vec3(0.0);
      float lit = 1.0, flare = 0.0;
      if (birthOn > 0.5) {
        float bt = birthAt(n);
        // organic front: high-frequency jitter so towns pop on individually, not as a wipe
        float j = (snoise(n * 900.0) * 0.6 + snoise(n * 3100.0) * 0.4) * 0.018;
        float a = bt + j;
        lit = clamp((birthTau - a) / birthSoft, 0.0, 1.0);
        flare = lit * exp(-max(birthTau - a, 0.0) / 0.03) * 0.3; // a newly lit town burns a touch brighter
        float bb = clamp((birthTau - bt) / 0.05, 0.0, 1.0);
        blur *= bb;
      }
      li *= lit * (1.0 + 1.2 * flare);
      col += li * lightsGain * night * (1.0 - 0.72 * cl);
      // cloud bellies lit orange by the city glow underneath (blurred lights × cloud cover)
      col += blur * vec3(1.0, 0.52, 0.22) * cl * (1.0 - cl * 0.4) * glowGain * lightsGain * night;
    }
    // haze over the disc near the limb (Rayleigh), lit by the sun at the terminator
    float mu = max(dot(n, V), 0.0);
    float hz = (1.0 - exp(-rayleighH / (mu + 0.02))) ;
    float mus = dot(n, L);
    col += (vec3(0.16, 0.4, 1.0) * smoothstep(-0.3, 0.4, mus) * 0.5 + vec3(1.0, 0.36, 0.08) * exp(-pow(mus / 0.12, 2.0)) * 0.35) * hz * atmoGain;
    col += airCol * hz * 0.02 * airglowGain * (1.0 - smoothstep(-0.2, 0.1, mus));
    // card legibility: lights in the card's bounding box × dimAmt (S40)
    vec2 dr = smoothstep(dimRect.xy - 30.0 * S, dimRect.xy, pix) * (1.0 - smoothstep(dimRect.zw, dimRect.zw + 30.0 * S, pix));
    col *= mix(1.0, dimAmt, dr.x * dr.y);
  }
  // ---- atmosphere outside the disc: limb Rayleigh, terminator ring, forward scatter, airglow layer ----
  vec3 atm = vec3(0.0);
  {
    float tca = -b; vec3 pc = ro + rd * max(tca, 0.0);
    float alt = max(length(pc) - 1.0, 0.0);
    vec3 na = normalize(pc);
    float mu = dot(na, L);
    float dens = exp(-alt / rayleighH) * (1.0 - cov);
    float lit = smoothstep(-0.3, 0.4, mu);
    atm += vec3(0.16, 0.4, 1.0) * dens * lit * 2.4;
    atm += vec3(1.0, 0.33, 0.07) * dens * exp(-pow(mu / 0.14, 2.0)) * 1.4 * termGain;
    atm += vec3(1.0, 0.75, 0.5) * dens * pow(max(dot(rd, L), 0.0), 8.0) * 3.0 * smoothstep(-0.2, 0.1, mu);
    atm *= atmoGain;
    // airglow: a thin emitting shell seen edge-on (limb brightening), only on the night side
    float ag = exp(-pow((alt - airglowAlt) / airglowSig, 2.0)) * (1.0 - smoothstep(-0.25, 0.05, mu));
    atm += airCol * ag * airglowGain * (1.0 - cov * 0.5);
  }
  // ---- S14: the horizon of anchors.arc with the S13 light-front profile ----
  if (conicOn > 0.5) {
    float d = sd / S;                                      // 1080p pixels, + inside (on the planet)
    float core = exp(-0.5 * d * d / 9.0);                  // σ = 3 px
    float glow = exp(-max(d, 0.0) / 30.0) * step(0.0, d) + exp(max(d, 0.0) * 0.0 + min(d, 0.0) / 7.0) * step(d, 0.0) * 0.35;
    float x = pix.x / S;
    float tw = smoothstep(500.0, 1900.0, x);
    vec3 twc = mix(vec3(0.042, 0.159, 0.686), vec3(1.0, 0.45, 0.15), tw * tw);   // TWILIGHT #3A6FD8 → #FFB36B (linear)
    atm = vec3(0.0);
    col += airCol * core * conicCore;
    col += twc * glow * (conicGlow + twGain * pow(tw, 3.0)) * (1.0 - 0.0 * cov);
    col += vec3(0.30, 0.55, 1.0) * glow * conicOut * 0.25;
  }
  // ---- sprites (screen space): round lights and the 24×64 cursor footprint ----
  vec3 sp = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 s = spr[i]; if (sprCol[i].a <= 0.0) continue;
    vec2 q = pix - s.xy;
    if (s.w > 0.5) {
      // 24×64 rectangle, analytically anti-aliased box (pixel footprint = 1 px)
      vec2 hb = vec2(12.0, 32.0) * S;
      vec2 a = clamp(q + hb + 0.5, 0.0, 1.0) * clamp(hb - q + 0.5, 0.0, 1.0);
      float soft = exp(-dot(max(abs(q) - hb, 0.0), max(abs(q) - hb, 0.0)) / (9.0 * S * S));
      sp += sprCol[i].rgb * (a.x * a.y + 0.15 * soft);
    } else {
      float r = max(s.z, 0.6);
      float k = dot(q, q) / (r * r);
      sp += sprCol[i].rgb * (exp(-k) + 0.06 * exp(-k * 0.08));
    }
  }
  vec3 outc = col * cov;
  gl_FragColor = vec4(outc + atm + sp, cov);
}`;

export function createGlobe(ctx, earth, { birthTex = null } = {}) {
  const { W, H } = ctx;
  const tx = earth.textures;
  const dummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); dummy.needsUpdate = true;
  const U = {
    res: { value: new THREE.Vector2(W, H) }, fpx: { value: 1 }, S: { value: H / 1080 },
    camPos: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3() }, camU: { value: new THREE.Vector3() }, camB: { value: new THREE.Vector3() },
    albedoTex: { value: tx.albedoTex }, cloudTex: { value: tx.cloudTex }, lightsTex: { value: tx.lightsTex },
    birthTex: { value: birthTex || dummy }, patchTex: { value: dummy },
    nightTex: { value: dummy }, nightRect: { value: new THREE.Vector4(-30, -50, 100, 70) }, nightOn: { value: 0 }, nightGain: { value: 1 },
    sunDir: { value: new THREE.Vector3(0, 0, -1) }, moonDir: { value: new THREE.Vector3(0, 1, 0) },
    dayGain: { value: 1 }, moonGain: { value: 0 }, lightsGain: { value: 1 }, cloudsGain: { value: 1 }, cloudShift: { value: 0 }, glowGain: { value: 0.6 }, nightLand: { value: 0.012 },
    atmoGain: { value: 1 }, airglowGain: { value: 0.4 }, airglowAlt: { value: 0.0150 }, airglowSig: { value: 0.0022 }, rayleighH: { value: 0.0065 }, termGain: { value: 1 }, glintExp: { value: 260 }, glintBroad: { value: 0.18 },
    birthOn: { value: 0 }, birthTau: { value: 0 }, birthSoft: { value: 0.01 }, birthRect: { value: new THREE.Vector4(-40, -45, 100, 75) },
    patchOn: { value: 0 }, patchHalf: { value: 0.05 }, patchGain: { value: 1 }, patchTexels: { value: 4096 },
    patchC: { value: new THREE.Vector3(0, 0, 1) }, patchE: { value: new THREE.Vector3(1, 0, 0) }, patchN: { value: new THREE.Vector3(0, 1, 0) },
    conicOn: { value: 0 }, conicCore: { value: 1.4 }, conicGlow: { value: 0.1 }, conicOut: { value: 0.3 }, twGain: { value: 0.35 },
    airCol: { value: new THREE.Vector3(0.212, 0.768, 0.539) },     // AIRGLOW #7FE3C2 (linear)
    spr: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, sprCol: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
    sparkOn: { value: 0 },
    clearDir: { value: new THREE.Vector3(0, 1, 0) }, clearCos: { value: new THREE.Vector2(1, 1) }, clearAmt: { value: 0 },
    dimRect: { value: new THREE.Vector4(-1e4, -1e4, -1e4, -1e4) }, dimAmt: { value: 1 }, lightsColdOcean: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: GLSL.all + FRAG, uniforms: U,
    depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const fsq = new FSQ(mat);
  return {
    uniforms: U, fsq,
    setPose(pose) {
      U.camPos.value.copy(pose.pos);
      U.camR.value.copy(pose.cols[0]); U.camU.value.copy(pose.cols[1]); U.camB.value.copy(pose.cols[2]);
      U.fpx.value = (W / 2) * pose.focalMM / 18;
    },
    setNight(nm) { U.nightTex.value = nm.tex; U.nightRect.value.set(...nm.rect); U.nightOn.value = 1; },
    setPatch(p) {
      if (!p) { U.patchOn.value = 0; return; }
      U.patchOn.value = 1; U.patchTex.value = p.tex; U.patchHalf.value = p.half; U.patchTexels.value = p.res;
      U.patchC.value.copy(p.c); U.patchE.value.copy(p.e); U.patchN.value.copy(p.n); U.patchGain.value = p.gain ?? 1;
    },
    clearSprites() { for (const c of U.sprCol.value) c.set(0, 0, 0, 0); },
    sprite(i, x, y, r, rgb, shape = 0) { U.spr.value[i].set(x, y, r, shape); U.sprCol.value[i].set(rgb[0], rgb[1], rgb[2], 1); },
    // composite over what is already in the target (stars): the engine runs with autoClear = true,
    // which would wipe the starfield when the fullscreen pass is drawn
    render(renderer, target) { const ac = renderer.autoClear; renderer.autoClear = false; fsq.render(renderer, target); renderer.autoClear = ac; },
  };
}
