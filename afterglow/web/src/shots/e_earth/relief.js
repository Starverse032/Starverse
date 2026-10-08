// Moonlit relief of East Africa for e_earth (S14, S18) and e_final (S40).
//
// earth.js's albedo is ~10 km per texel and flat: from 400–2000 km at night the ground under R
// (the Rift, the first fire's ground point) read as pure black, so the opening of S18 was one lamp
// in a void. This bakes, once, a 2048² HalfFloat relief map over RELIEF_RECT (lon0, lat0, lon1, lat1):
//   rg = surface slope (∂h/∂east, ∂h/∂north, dimensionless, vertically exaggerated) for moon shading
//   b  = albedo multiplier (rift floors and lava fields darker, highland forest, fine soil variation)
//   a  = snow (Kilimanjaro, Mount Kenya)
// Height = the East African and Ethiopian domes + ridged fbm hills + the Gregory, Albertine and
// Ethiopian rift troughs with raised shoulders (hand-entered polylines) + volcanic cones
// (Kilimanjaro, Meru, Kenya, Elgon) and the Ngorongoro caldera; water (earth.js land mask) is flat.
// Pass 1 bakes the height, pass 2 differentiates it (both in strips: short draws on SwiftShader).
import * as THREE from 'three';
import * as GLSL from '../../lib/glsl.js';
import { FSQ } from '../../post.js';

export const RELIEF_RECT = [22, -16, 52, 14];

// rift axes (lon, lat); the shader measures distance to these segments
const RIFTS = [
  // Gregory (Kenya) rift: Turkana → Baringo → Naivasha → Magadi / Natron → Manyara
  [[36.1, 4.6], [36.0, 2.6], [36.1, 0.6], [36.3, -0.7], [36.25, -1.9], [35.95, -2.9], [35.8, -4.2], [35.5, -5.6]],
  // Albertine (western) rift: Albert → Edward → Kivu → Tanganyika → Rukwa → Malawi
  [[31.4, 2.4], [30.0, 0.6], [29.6, -0.6], [29.2, -2.0], [29.3, -4.5], [29.8, -6.6], [30.9, -8.3], [32.4, -8.6], [33.9, -9.8], [34.5, -11.6], [35.0, -13.8]],
  // Main Ethiopian rift → Afar
  [[37.6, 4.5], [38.2, 6.6], [39.0, 8.2], [40.3, 9.6], [41.4, 11.3], [42.4, 12.6]],
];
// volcanoes: lon, lat, height (km), radius (deg), snow
const CONES = [
  [37.35, -3.07, 4.4, 0.32, 1], [36.75, -3.25, 2.6, 0.16, 0], [37.31, -0.15, 3.4, 0.30, 1], [34.55, 1.12, 2.2, 0.38, 0],
  [36.45, -0.9, 1.0, 0.14, 0], [35.9, -2.75, 1.4, 0.14, 0], [38.6, 9.6, 1.2, 0.3, 0],
];

function segGLSL() {
  const segs = [];
  for (const line of RIFTS) for (let i = 0; i < line.length - 1; i++) segs.push([...line[i], ...line[i + 1]]);
  return { n: segs.length, src: `const vec4 SEG[${segs.length}] = vec4[${segs.length}](${segs.map(s => `vec4(${s.map(v => v.toFixed(3)).join(',')})`).join(',')});` };
}

const HEIGHT = (seg) => /* glsl */ `
uniform sampler2D albedoTex; uniform vec4 rect;
${seg.src}
const vec4 CONE[${CONES.length}] = vec4[${CONES.length}](${CONES.map(c => `vec4(${c.slice(0, 4).map(v => v.toFixed(3)).join(',')})`).join(',')});
vec3 dirOf(vec2 ll){ vec2 r = ll * 0.0174533; return vec3(cos(r.y) * sin(r.x), sin(r.y), cos(r.y) * cos(r.x)); }
float segDist(vec2 p, vec4 s, float k){
  vec2 a = vec2(s.x * k, s.y), b = vec2(s.z * k, s.w), q = vec2(p.x * k, p.y);
  vec2 ab = b - a; float t = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(q - a - ab * t);
}
float heightAt(vec2 ll){
  vec3 d = dirOf(ll);
  float k = cos(ll.y * 0.0174533);
  vec2 e1 = vec2((ll.x - 35.5) * k, ll.y + 1.0), e2 = vec2((ll.x - 39.0) * k, ll.y - 9.0);
  float h = 1.35 * exp(-dot(e1, e1) / 70.0) + 1.6 * exp(-dot(e2, e2) / 26.0) + 0.25;
  // hills: ridged fbm, rougher on the domes
  float rough = 0.35 + 0.65 * smoothstep(0.4, 1.4, h);
  h += rough * (0.75 * ridged(d * 55.0, 6) - 0.28) + 0.18 * (fbm(d * 260.0, 4) - 0.5);
  // rift troughs: a flat floor between steep escarpments with raised shoulders
  float dr = 9.0;
  for (int i = 0; i < ${seg.n}; i++) dr = min(dr, segDist(ll, SEG[i], k));
  dr += 0.12 * (fbm(d * 90.0 + 4.0, 3) - 0.5);             // wandering faults
  h += -1.25 * (1.0 - smoothstep(0.22, 0.42, dr)) + 0.55 * exp(-pow((dr - 0.55) / 0.22, 2.0));
  for (int i = 0; i < ${CONES.length}; i++) {
    vec4 c = CONE[i]; vec2 q = vec2((ll.x - c.x) * k, ll.y - c.y); float r = length(q) / c.w;
    h += c.z * exp(-r * 2.2) * (1.0 + 0.15 * (fbm(d * 700.0, 2) - 0.5));
  }
  { vec2 q = vec2((ll.x - 35.58) * k, ll.y + 3.18); float r = length(q);   // Ngorongoro caldera
    h += 0.9 * exp(-pow((r - 0.11) / 0.05, 2.0)) - 0.5 * (1.0 - smoothstep(0.07, 0.1, r)); }
  return h;
}`;

const VS_UV = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function bakeStrips(renderer, rt, mat, strips = 8) {
  const fsq = new FSQ(mat);
  const prev = renderer.getRenderTarget();
  const N = rt.height;
  rt.scissorTest = true;
  for (let s = 0; s < strips; s++) { rt.scissor.set(0, s * N / strips, rt.width, N / strips); rt.viewport.set(0, 0, rt.width, N); fsq.render(renderer, rt); }
  rt.scissorTest = false;
  renderer.setRenderTarget(prev);
}

export function buildRelief(ctx, earth, { res = 2048 } = {}) {
  const { renderer } = ctx;
  const seg = segGLSL();
  const rect = new THREE.Vector4(...RELIEF_RECT);
  const mk = (mip) => new THREE.WebGLRenderTarget(res, res, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
    minFilter: mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: mip,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
  });
  // pass 1: height (km) in r, land in g, snow in b
  const hRT = mk(false);
  const m1 = new THREE.ShaderMaterial({
    vertexShader: VS_UV, depthTest: false, depthWrite: false,
    uniforms: { albedoTex: { value: earth.textures.albedoTex }, rect: { value: rect } },
    fragmentShader: GLSL.all + '\nvarying vec2 vUv;\n' + HEIGHT(seg) + /* glsl */ `
      void main(){
        vec2 ll = mix(rect.xy, rect.zw, vUv);
        vec2 euv = vec2(ll.x / 360.0 + 0.5, ll.y / 180.0 + 0.5);
        float land = smoothstep(0.3, 0.7, texture2D(albedoTex, euv).a);
        float h = heightAt(ll) * land;
        float snow = 0.0;
        for (int i = 0; i < ${CONES.length}; i++) { vec4 c = CONE[i]; vec2 q = vec2((ll.x - c.x) * cos(ll.y * 0.01745), ll.y - c.y); snow = max(snow, (1.0 - smoothstep(0.03, 0.075, length(q))) * step(3.0, c.z)); }
        gl_FragColor = vec4(h, land, snow, 1.0);
      }`,
  });
  bakeStrips(renderer, hRT, m1);
  // pass 2: slopes + albedo multiplier
  const out = mk(true);
  const kmPerTex = [(RELIEF_RECT[2] - RELIEF_RECT[0]) * 111.32 / res, (RELIEF_RECT[3] - RELIEF_RECT[1]) * 111.32 / res];
  const m2 = new THREE.ShaderMaterial({
    vertexShader: VS_UV, depthTest: false, depthWrite: false,
    uniforms: { hT: { value: hRT.texture }, rect: { value: rect }, texel: { value: 1 / res }, km: { value: new THREE.Vector2(...kmPerTex) }, exag: { value: 3.0 } },
    fragmentShader: GLSL.all + '\nvarying vec2 vUv;\n' + /* glsl */ `
      uniform sampler2D hT; uniform vec4 rect; uniform float texel, exag; uniform vec2 km;
      void main(){
        vec4 c = texture2D(hT, vUv);
        float lat = mix(rect.y, rect.w, vUv.y);
        float hx = texture2D(hT, vUv + vec2(texel, 0.0)).r - texture2D(hT, vUv - vec2(texel, 0.0)).r;
        float hy = texture2D(hT, vUv + vec2(0.0, texel)).r - texture2D(hT, vUv - vec2(0.0, texel)).r;
        vec2 s = vec2(hx / (2.0 * km.x * cos(radians(lat))), hy / (2.0 * km.y)) * exag * c.g;
        // albedo: rift floors / lava darker, high ground a little brighter (grass, cloud forest), fine soil grain
        vec2 ll = mix(rect.xy, rect.zw, vUv);
        float g = fbm(ll * 9.0, 5);
        float alb = (0.75 + 0.5 * g) * (0.8 + 0.25 * smoothstep(0.3, 2.0, c.r)) * (1.0 - 0.25 * smoothstep(0.0, -0.6, c.r - 0.6));
        gl_FragColor = vec4(s, mix(1.0, alb, c.g), c.b);
      }`,
  });
  bakeStrips(renderer, out, m2, 4);
  m1.dispose(); m2.dispose(); hRT.dispose();
  return { tex: out.texture, rect: RELIEF_RECT };
}
