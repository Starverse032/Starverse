// m_asking/dive.js — S26 俯冲 (112.5 → 113.0, 12 frames, f2700–2711).
//
// Straight down onto the city at R (Nairobi, R_geo): 35 mm, looking at the nadir, the city centre held
// on R. The log of the altitude falls with a gentle ease-in, 100 km → 2.4 km in 0.5 s: f2700 a cluster of light with its satellite towns; f2707 the street grid fills the frame;
// f2708–2711 the amber flash (the timeline's transitionOut flash + a ramp in post(), peaking ≈ 85 %,
// never clipped) while the camera punches through a hole in a thin cloud deck (8.5 km) lit from below.
//
// The city is baked once, three nested levels of one and the same procedural light field (so the
// detail that appears is the detail that was there): L0 200 km (49 m/texel), L1 25 km (6.1 m),
// L2 6 km (1.5 m). Light field: a population surface (core + eight satellite towns + highway corridors,
// domain-warped and patchy, the national park south of the centre left dark) × street hierarchy
// (radial highways, arterial Voronoi 1.3 km, collector Voronoi 330 m, local grids rotated per block,
// building lights on a 22 m lattice); sodium #FFB45A outside, LED white #E8F0FF in the dense core.
// Every line is band-limited to the texel it is baked into (sub-texel families bake as their mean).
// Per frame the shader picks the finest valid level by pixel footprint and integrates the radial
// motion of the zoom along a 45° shutter (8 taps; see the note on the shutter in createDive).
import * as THREE from 'three';
import { hex, RX, RY } from '../f_fire/common.js';

const T0 = 112.5, T1 = 113.0;
const A0 = 100000, A1 = 2400;                      // altitude (m) at the first / last frame
const EZ = 1.35;                                   // ease-in of log-altitude: calm first frames, then the plunge
const FPX = 960 / (18 / 35);                       // 1080p px per unit tangent (35 mm)
const LV = [[100000, 4096], [12500, 4096], [3000, 4096]];   // [half extent m, texels]
const ZC = 8500;                                   // cloud deck altitude (m)
const ENC = 6.0;                                   // 8-bit encoding: c = ENC · e^2.2

const CITY = /* glsl */ `
uniform float uExt, uTexel;
const vec3 SOD = vec3(${hex(0xFFB45A).map(v => v.toFixed(4)).join(', ')});
const vec3 LED = vec3(${hex(0xE8F0FF).map(v => v.toFixed(4)).join(', ')});
// street lamps: a street is a dotted line (one lamp every per metres); sub-texel → its mean (0.246)
#define LAMPS(s, per) mix(pow(0.5 + 0.5 * cos(6.2832 * (s) / (per)), 6.0), 0.246, smoothstep(0.15 * (per), 0.45 * (per), uTexel))
float gss(vec2 p, vec2 c, vec2 s){ vec2 d = (p - c) / s; return exp(-dot(d, d)); }
// band-limited line of width w (m) at distance d (m)
float bline(float d, float w){ float we = max(w, uTexel * 1.25); return (w / we) * smoothstep(0.5 * we + 0.5 * uTexel, max(0.5 * we - 0.5 * uTexel, 0.0), d); }
// a family of lines with spacing s: when the texel approaches the spacing, bake its mean coverage
float family(float d, float w, float s){ float m = clamp(w * 1.7 / s, 0.0, 1.0); float k = smoothstep(0.12 * s, 0.4 * s, uTexel); return mix(bline(d, w), m, k); }
// Voronoi: F1, F2, id
vec3 vor(vec2 p){
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y)); vec2 c = i + g;
    vec2 o = 0.12 + 0.76 * hash22(c); vec2 r = g + o - f; float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; id = hash12(c + 0.5); } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
float segD(vec2 p, vec2 a, vec2 b){ vec2 ab = b - a; float h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0); return length(p - a - ab * h); }
// population surface (0..~1.2); q in km
float density(vec2 q){
  vec2 w = vec2(fbm(q * 0.07 + 3.1, 4), fbm(q * 0.07 + 7.7, 4)) - 0.5;
  vec2 qw = q + w * 12.0;
  float c = exp(-pow(length(qw * vec2(1.0, 1.2)) / 7.0, 1.2));
  c += 0.55 * gss(qw, vec2(13.0, 3.0), vec2(5.0, 3.6));     // eastlands
  c += 0.45 * gss(qw, vec2(-6.0, 9.0), vec2(4.0, 5.0));     // Westlands → Kiambu
  c += 0.40 * gss(qw, vec2(36.0, 31.0), vec2(4.5, 4.0));    // Thika
  c += 0.32 * gss(qw, vec2(50.0, -26.0), vec2(4.5, 3.5));   // Machakos
  c += 0.30 * gss(qw, vec2(-17.0, -8.0), vec2(4.0, 3.0));   // Ngong
  c += 0.25 * gss(qw, vec2(-27.0, 14.0), vec2(3.6, 3.0));   // Limuru
  c += 0.36 * gss(qw, vec2(21.0, -14.0), vec2(5.0, 2.8));   // Athi River / Mlolongo
  c += 0.14 * gss(qw, vec2(-6.0, -63.0), vec2(3.5, 3.5));   // Kajiado
  c += 0.12 * gss(qw, vec2(-70.0, 38.0), vec2(5.0, 4.0));   // towards Naivasha
  float park = gss(q, vec2(-2.0, -10.5), vec2(6.5, 4.2));   // Nairobi National Park: dark
  c *= 1.0 - 0.97 * smoothstep(0.35, 0.65, park);
  float pt = fbm(q * 0.55 + 1.7, 5);
  c *= mix(1.0, smoothstep(0.32, 0.72, pt) * 1.5, clamp(1.15 - c * 1.3, 0.0, 1.0));
  return max(c, 0.0);
}
// highways (km): distance to the nearest, km
float highway(vec2 q, out float along){
  vec2 qw = q + (vec2(fbm(q * 0.12 + 9.0, 3), fbm(q * 0.12 + 2.0, 3)) - 0.5) * 3.0;
  vec2 P[11]; P[0] = vec2(36.0, 31.0); P[1] = vec2(70.0, 75.0); P[2] = vec2(21.0, -14.0); P[3] = vec2(50.0, -26.0);
  P[4] = vec2(120.0, -80.0); P[5] = vec2(-17.0, -8.0); P[6] = vec2(-27.0, 14.0); P[7] = vec2(-90.0, 45.0);
  P[8] = vec2(-6.0, -63.0); P[9] = vec2(48.0, 2.0); P[10] = vec2(-4.0, 90.0);
  float d = 1e9;
  // they end at the edge of the centre (2–3 km out), not all at one point
  d = min(d, segD(qw, vec2(2.0, 1.6), P[0])); d = min(d, segD(qw, P[0], P[1]));
  d = min(d, segD(qw, vec2(2.2, -1.4), P[2])); d = min(d, segD(qw, P[2], P[3])); d = min(d, segD(qw, P[2], P[4]));
  d = min(d, segD(qw, vec2(-2.4, -1.0), P[5])); d = min(d, segD(qw, vec2(-2.0, 1.8), P[6])); d = min(d, segD(qw, P[6], P[7]));
  d = min(d, segD(qw, P[5], P[8])); d = min(d, segD(qw, vec2(2.8, 0.2), P[9])); d = min(d, segD(qw, vec2(-6.0, 9.0), P[10]));
  along = length(q);
  return d;
}
vec3 cityLight(vec2 p){
  vec2 q = p / 1000.0;
  float al; float hd = highway(q, al) * 1000.0;
  float rho = density(q) + 0.22 * exp(-hd / 600.0) * exp(-al / 60.0);
  vec3 col = vec3(0.0);
  // the unresolved glow of everything (houses, yards, small roads)
  col += SOD * 0.018 * rho;
  // highways: bright, thin, lit through empty land too
  col += SOD * 0.8 * bline(hd, 30.0) * (0.3 + 0.7 * smoothstep(0.0, 0.5, rho)) * exp(-al / 80.0) * mix(1.0, 3.0 * LAMPS(al * 1000.0, 45.0), smoothstep(30.0, 10.0, uTexel));
  if (rho > 0.02) {
    vec2 wp = p + (vec2(fbm(q * 0.7 + 4.0, 3), fbm(q * 0.7 + 1.0, 3)) - 0.5) * 700.0;
    // districts (1.8 km Voronoi): their borders are the arterials, each has its own street grid
    vec3 vd = vor(wp / 1800.0);
    float dArt = (vd.y - vd.x) * 0.5 * 1800.0;
    float led = smoothstep(0.62, 0.95, rho) * 0.8 + step(0.8, vd.z) * 0.35 * smoothstep(0.2, 0.5, rho);
    vec3 cc = mix(SOD, LED, clamp(led, 0.0, 0.9));
    col += mix(SOD, cc, 0.5) * 1.5 * family(dArt, 22.0, 1800.0) * smoothstep(0.02, 0.2, rho) * LAMPS(vd.x * 1800.0 * 3.0, 40.0);
    float ang = vd.z * 3.1416;
    vec2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * wp;
    // main streets of the district grid; each street its own brightness (some unlit)
    float spM = 170.0 + 100.0 * fract(vd.z * 7.31);
    vec2 gm = abs(fract(r / spM) - 0.5) * spM;
    vec2 si = floor(r / spM + 0.5);
    bool vert = gm.x < gm.y;
    float sb = hash12(vec2(vert ? si.x : si.y, vert ? 1.0 : 2.0) + vd.z * 57.0);
    float sbr = sb < 0.15 ? 0.1 : 0.45 + 0.9 * sb;
    float g2 = smoothstep(0.06, 0.35, rho);
    col += cc * 2.2 * family(min(gm.x, gm.y), 11.0, spM) * g2 * sbr * LAMPS(vert ? r.y : r.x, 32.0);
    // blocks: some dark (yards, works, parks), lights in the rest; lanes only in the dense parts
    float spm = spM / 3.0;
    vec2 rm = r / spm; vec2 bi = floor(rm);
    vec2 gq = abs(fract(rm) - 0.5) * spm;
    float blk = hash12(bi + vd.z * 131.0);
    float lit = smoothstep(0.1, 0.8, blk) * step(blk, 0.88) * smoothstep(0.15, 0.45, fbm(wp / 600.0 + 3.0, 3) + rho * 0.4);
    float g3 = smoothstep(0.3, 0.75, rho);
    col += cc * 0.35 * family(min(gq.x, gq.y), 5.0, spm) * g3 * lit * LAMPS(gq.x < gq.y ? rm.y * spm : rm.x * spm, 26.0);
    // building lights: a jittered lattice, 4 per block
    vec2 bq = r / (spm * 0.5); vec2 bj = floor(bq); vec2 bf = fract(bq) - 0.5;
    float h = hash12(bj + 3.7 + vd.z * 17.0);
    float on = step(h, (0.2 + 0.5 * rho) * lit);
    vec2 o = (hash22(bj + 9.1) - 0.5) * 0.45;
    float pd = length(bf - o) * spm * 0.5;
    vec3 bc = mix(vec3(1.0, 0.60, 0.28), vec3(0.95, 0.96, 1.0), step(0.72, fract(h * 13.0)));
    col += bc * 2.2 * on * family(pd, 4.5, spm * 0.5) * (0.3 + 0.7 * fract(h * 31.0)) * smoothstep(0.03, 0.3, rho);
  }
  return col;
}`;

export function createDive(ctx) {
  const { renderer, W, H, kit } = ctx;
  const S = H / 1080;

  // ---- bake the three levels (8-bit, γ-encoded: c = ENC·e^2.2) ------------------------------------------
  const levels = LV.map(([ext, n]) => kit.bake(renderer, {
    w: n, h: n, float: false, mipmaps: true, wrap: THREE.ClampToEdgeWrapping,
    uniforms: { uExt: { value: ext }, uTexel: { value: 2 * ext / n } },
    frag: CITY + /* glsl */ `
      void main(){
        vec2 p = (vUv - 0.5) * 2.0 * uExt;
        vec3 c = cityLight(p);
        gl_FragColor = vec4(pow(clamp(c / ${ENC.toFixed(1)}, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
      }`,
  }));
  // the cloud deck: tileable fbm (period 32 km), 1024²
  const cloudTex = kit.bake(renderer, {
    w: 1024, h: 1024, float: false, mipmaps: true,
    frag: /* glsl */ `
      float tn(vec2 p, float P){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        float a = ihash2(ivec2(mod(i, P))), b = ihash2(ivec2(mod(i + vec2(1, 0), P)));
        float c = ihash2(ivec2(mod(i + vec2(0, 1), P))), d = ihash2(ivec2(mod(i + vec2(1, 1), P)));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
      void main(){ vec2 p = vUv * 8.0; float v = 0.0, a = 0.5, P = 8.0;
        for (int i = 0; i < 6; i++){ v += a * tn(p, P); p *= 2.0; P *= 2.0; a *= 0.5; }
        gl_FragColor = vec4(v / 0.984, 0.0, 0.0, 1.0); }`,
  });

  const U = {
    uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S },
    uL0: { value: levels[0] }, uL1: { value: levels[1] }, uL2: { value: levels[2] }, uCloud: { value: cloudTex },
    uExt: { value: new THREE.Vector3(LV[0][0], LV[1][0], LV[2][0]) },
    uTex: { value: new THREE.Vector3(...LV.map(([e, n]) => 2 * e / n)) },
    uAlt: { value: [0, 0, 0, 0, 0, 0] }, uRot: { value: 0 },
  };
  const NT = 8;
  const pass = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes; uniform float uS, uRot; uniform float uAlt[${NT}];
    uniform sampler2D uL0, uL1, uL2, uCloud; uniform vec3 uExt, uTex;
    vec3 dec(vec4 e){ return ${ENC.toFixed(1)} * pow(e.rgb, vec3(2.2)); }
    vec3 city(vec2 g, float fp){
      vec3 c = dec(texture2D(uL0, g / (2.0 * uExt.x) + 0.5));
      float m = max(abs(g.x), abs(g.y));
      float w1 = smoothstep(3.0 * uTex.y, 1.6 * uTex.y, fp) * smoothstep(uExt.y, uExt.y * 0.85, m);
      if (w1 > 0.0) c = mix(c, dec(texture2D(uL1, g / (2.0 * uExt.y) + 0.5)), w1);
      float w2 = smoothstep(3.0 * uTex.z, 1.6 * uTex.z, fp) * smoothstep(uExt.z, uExt.z * 0.85, m);
      if (w2 > 0.0) c = mix(c, dec(texture2D(uL2, g / (2.0 * uExt.z) + 0.5)), w2);
      return c;
    }
    void main(){
      vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;
      vec2 d = (px - vec2(${RX.toFixed(1)}, ${RY.toFixed(1)})) * vec2(1.0, -1.0);
      d = mat2(cos(uRot), sin(uRot), -sin(uRot), cos(uRot)) * d;
      vec3 acc = vec3(0.0);
      for (int k = 0; k < ${NT}; k++){
        float alt = uAlt[k], fp = alt / ${FPX.toFixed(2)};
        vec2 g = d * fp;
        vec3 c = city(g, fp);
        // the light dome: the air over the city scatters its glow (only while there is air below us)
        float air = smoothstep(3000.0, 30000.0, alt);
        c += dec(textureLod(uL0, g / (2.0 * uExt.x) + 0.5, 6.5)) * 0.16 * air;
        // the cloud deck at ${ZC} m, a hole over the centre, lit from below by the city
        if (alt > ${ZC.toFixed(1)}) {
          float fc = (alt - ${ZC.toFixed(1)}) / ${FPX.toFixed(2)};
          vec2 gc = d * fc;
          float cov = texture2D(uCloud, gc / 32000.0 + vec2(0.31, 0.62)).r;
          float hole = 1.0 - exp(-dot(gc, gc) / (2600.0 * 2600.0));
          float a = smoothstep(0.52, 0.75, cov) * hole * 0.55;
          vec3 under = dec(textureLod(uL0, gc / (2.0 * uExt.x) + 0.5, 7.0)) * 0.9 + vec3(0.0012, 0.0013, 0.0017);
          c = mix(c, under, a);
        }
        acc += c;
      }
      gl_FragColor = vec4(acc / float(${NT}), 1.0);
    }`, U);

  const alt = t => A0 * Math.pow(A1 / A0, Math.pow(Math.max(0, (t - T0) / (T1 - T0)), EZ));
  // Shutter. The zoom is ×1.2–1.5 per frame: a 180° shutter smears the whole city into streaks. We
  // shoot it at 45° instead (crisp centre on R, radial streaks growing to the edges) and integrate the
  // shutter ourselves with NT taps. The image is a pure function of the frame: the timeline's 4
  // sub-frames all map to the frame centre and reuse one render (a cache, not state: same t → same image).
  const cache = ctx.makeRT(W, H);
  let cacheKey = null;
  const blit = kit.fullscreen(/* glsl */ `uniform sampler2D tex; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb, 1.0); }`, { tex: { value: cache.texture } });
  return {
    render(shot, f) {
      const fr = Math.round(f.t * 24), tc = fr / 24;
      const ac = renderer.autoClear; renderer.autoClear = false;
      const key = fr + ':' + f.barPx.toFixed(2);
      if (cacheKey !== key) {
        const span = 0.125 / 24;
        for (let k = 0; k < NT; k++) U.uAlt.value[k] = alt(tc + span * ((k + 0.5) / NT - 0.5));
        U.uRot.value = 0.09 * (tc - T0) / (T1 - T0);
        renderer.setRenderTarget(cache); renderer.setClearColor(0x000000, 1); renderer.clear();
        pass.render(renderer, cache);
        cacheKey = key;
      }
      blit.render(renderer, f.target);
      renderer.autoClear = ac;
      renderer.setRenderTarget(f.target);
    },
    post(shot, f) {
      // the four flash frames rise smoothly into the timeline's cubic flash (strength 2.5):
      // totals ≈ 0.35 / 0.64 / 0.91 / 1.10 → ACES peak ≈ 85 % amber, never clipped
      const fr = Math.round(f.t * 24);
      const ramp = { 2708: 0.35, 2709: 0.60, 2710: 0.60, 2711: 0.05 }[fr] ?? 0;
      return { exposure: 1.6, bloom: 0.85, bloomThreshold: 0.95, streak: 0.12, streakTint: [1.0, 0.75, 0.5], vignette: 0.3, grain: 0.04, flash: ramp, flashColor: [1.0, 0.70, 0.42] };
    },
  };
}
