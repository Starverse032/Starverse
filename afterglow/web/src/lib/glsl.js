// Shared GLSL chunks. Concatenate the ones a shader needs:
//   fragmentShader: GLSL.common + GLSL.noise + `...your code...`
// Everything here is deterministic (no time/random state) so shots stay pure functions of t.

export const common = /* glsl */ `
#ifndef AG_COMMON
#define AG_COMMON
#define PI 3.14159265359
#define TAU 6.28318530718
float saturate(float x){ return clamp(x, 0.0, 1.0); }
vec3  saturate(vec3 x){ return clamp(x, 0.0, 1.0); }
float remap(float x, float a, float b, float c, float d){ return c + (d - c) * (x - a) / (b - a); }
float sstep(float a, float b, float x){ return smoothstep(a, b, x); }
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Integer hashes (PCG-style) — stable across platforms.
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
uvec3 pcg3(uvec3 v){
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
float hash11(float p){ return float(pcg(floatBitsToUint(p))) / 4294967295.0; }
float hash12(vec2 p){ return float(pcg(floatBitsToUint(p.x) ^ pcg(floatBitsToUint(p.y)))) / 4294967295.0; }
vec2  hash22(vec2 p){ uvec3 h = pcg3(uvec3(floatBitsToUint(p.x), floatBitsToUint(p.y), 17u)); return vec2(h.xy) / 4294967295.0; }
vec3  hash33(vec3 p){ uvec3 h = pcg3(floatBitsToUint(p)); return vec3(h) / 4294967295.0; }
float hash13(vec3 p){ return hash33(p).x; }
// Hashes for integer lattice coordinates (use these inside noise, faster than bit-casting floats).
float ihash2(ivec2 c){ return float(pcg(uint(c.x) * 1973u + pcg(uint(c.y) + 9277u))) / 4294967295.0; }
vec3  ihash3v(ivec3 c){ return vec3(pcg3(uvec3(c))) / 4294967295.0; }

// Blackbody colour (approx., linear RGB, normalised), T in Kelvin 1000..40000.
vec3 blackbody(float T){
  T = clamp(T, 1000.0, 40000.0) / 100.0;
  vec3 c;
  c.r = T <= 66.0 ? 1.0 : clamp(1.29293618606 * pow(T - 60.0, -0.1332047592), 0.0, 1.0);
  c.g = T <= 66.0 ? clamp(0.39008157876 * log(T) - 0.63184144378, 0.0, 1.0)
                  : clamp(1.12989086089 * pow(T - 60.0, -0.0755148492), 0.0, 1.0);
  c.b = T >= 66.0 ? 1.0 : (T <= 19.0 ? 0.0 : clamp(0.54320678911 * log(T - 10.0) - 1.19625408914, 0.0, 1.0));
  return pow(c, vec3(2.2)); // to linear
}
#endif
`;

export const noise = /* glsl */ `
#ifndef AG_NOISE
#define AG_NOISE
// --- value noise ---
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  ivec2 c = ivec2(i);
  return mix(mix(ihash2(c), ihash2(c+ivec2(1,0)), u.x), mix(ihash2(c+ivec2(0,1)), ihash2(c+ivec2(1,1)), u.x), u.y);
}
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); vec3 u = f*f*(3.0-2.0*f);
  ivec3 c = ivec3(i);
  float a = ihash3v(c).x, b = ihash3v(c+ivec3(1,0,0)).x, d = ihash3v(c+ivec3(0,1,0)).x, e = ihash3v(c+ivec3(1,1,0)).x;
  float g = ihash3v(c+ivec3(0,0,1)).x, h = ihash3v(c+ivec3(1,0,1)).x, k = ihash3v(c+ivec3(0,1,1)).x, l = ihash3v(c+ivec3(1,1,1)).x;
  return mix(mix(mix(a,b,u.x), mix(d,e,u.x), u.y), mix(mix(g,h,u.x), mix(k,l,u.x), u.y), u.z);
}
// --- simplex noise 3D (Gustavson/Ashima, public domain) ---
vec4 _perm(vec4 x){ return mod(((x*34.0)+10.0)*x, 289.0); }
vec4 _tis(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - 0.5;
  i = mod(i, 289.0);
  vec4 p = _perm(_perm(_perm(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec4 j = p - 49.0 * floor(p / 49.0); vec4 x_ = floor(j / 7.0); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = (x_ * 2.0 + 0.5) / 7.0 - 1.0; vec4 y = (y_ * 2.0 + 0.5) / 7.0 - 1.0; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 g0 = vec3(a0.xy, h.x); vec3 g1 = vec3(a0.zw, h.y); vec3 g2 = vec3(a1.xy, h.z); vec3 g3 = vec3(a1.zw, h.w);
  vec4 norm = _tis(vec4(dot(g0,g0), dot(g1,g1), dot(g2,g2), dot(g3,g3)));
  g0 *= norm.x; g1 *= norm.y; g2 *= norm.z; g3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 105.0 * dot(m*m, vec4(dot(g0,x0), dot(g1,x1), dot(g2,x2), dot(g3,x3)));
}
// --- fbm variants (octaves is a compile-time-ish loop bound, keep <= 8) ---
float fbm(vec2 p, int oct){ float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for(int i = 0; i < 8; i++){ if(i >= oct) break; s += a * vnoise(p); p = m * p; a *= 0.5; } return s; }
float fbm(vec3 p, int oct){ float a = 0.5, s = 0.0; for(int i = 0; i < 8; i++){ if(i >= oct) break; s += a * (snoise(p) * 0.5 + 0.5); p = p * 2.02 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float ridged(vec3 p, int oct){ float a = 0.5, s = 0.0; for(int i = 0; i < 8; i++){ if(i >= oct) break; float n = 1.0 - abs(snoise(p)); s += a * n * n; p = p * 2.03 + vec3(3.1, 1.3, 7.7); a *= 0.5; } return s; }
vec3 curl(vec3 p){
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0), dy = vec3(0.0, e, 0.0), dz = vec3(0.0, 0.0, e);
  float n1 = snoise(p + dy + vec3(31.4)) - snoise(p - dy + vec3(31.4));
  float n2 = snoise(p + dz + vec3(31.4)) - snoise(p - dz + vec3(31.4));
  float n3 = snoise(p + dz + vec3(-17.1)) - snoise(p - dz + vec3(-17.1));
  float n4 = snoise(p + dx + vec3(-17.1)) - snoise(p - dx + vec3(-17.1));
  float n5 = snoise(p + dx) - snoise(p - dx);
  float n6 = snoise(p + dy) - snoise(p - dy);
  return vec3(n1 - n2, n3 - n4, n5 - n6) / (2.0 * e);
}
// --- worley / cellular: returns (F1, F2) distances ---
vec2 worley(vec3 p){
  vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for(int z=-1; z<=1; z++) for(int y=-1; y<=1; y++) for(int x=-1; x<=1; x++){
    vec3 g = vec3(x, y, z); vec3 o = ihash3v(ivec3(i + g)); vec3 r = g + o - f; float d = dot(r, r);
    if(d < d1){ d2 = d1; d1 = d; } else if(d < d2){ d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}
#endif
`;

// Procedural star field on a direction — use for BAKING skies (bakeSky), not per frame.
// One cell lookup per layer: cheap enough to bake 8k equirects. Returns linear HDR colour.
// scale ~ 200..2000 cells across the sphere; density 0..1 = fraction of cells with a star.
export const stars = /* glsl */ `
#ifndef AG_STARS
#define AG_STARS
vec3 starLayer(vec3 dir, float scale, float density, float seed, float pxAngle){
  vec3 p = dir * scale; vec3 c = floor(p);
  vec3 h = hash33(c + seed);
  if (h.x > density) return vec3(0.0);
  vec3 sp = normalize(c + 0.25 + 0.5 * hash33(c + seed + 7.0));
  float ang = acos(clamp(dot(dir, sp), -1.0, 1.0));
  float mag = pow(h.y, 8.0) * 30.0 + 0.3;
  float T = mix(3000.0, 15000.0, pow(h.z, 1.6));
  float sigma = max(pxAngle * 0.7, 1e-6);
  return blackbody(T) * mag * exp(-0.5 * ang * ang / (sigma * sigma));
}
#endif
`;

// Tone mapping & colour helpers used by post.
export const color = /* glsl */ `
#ifndef AG_COLOR
#define AG_COLOR
// Stephen Hill's fitted ACES (RRT+ODT), input linear sRGB, output linear display.
vec3 acesFitted(vec3 c){
  const mat3 inM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 outM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  c = inM * c;
  vec3 a = c * (c + 0.0245786) - 0.000090537;
  vec3 b = c * (0.983729 * c + 0.4329510) + 0.238081;
  return clamp(outM * (a / b), 0.0, 1.0);
}
vec3 linearToSRGB(vec3 c){
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
vec3 srgbToLinear(vec3 c){
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
#endif
`;

export const all = common + noise + stars + color;
