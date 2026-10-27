// l_carriers/common.js — shared constants, GLSL helpers and the carrier timetable for L1 (S04).
//
// Screen convention everywhere: 1080p pixels, x right, y DOWN (top-left origin), light centre
// C = (960, 540). Every carrier pass is one fullscreen shader that computes its own state from the
// float frame number uFr (= f.t × 24, so motion-blur sub-frames stay continuous).
import * as THREE from 'three';

export const FPS = 24;
export const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const hex = h => [srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255)];
export const v3 = a => `vec3(${a.map(v => (+v).toFixed(5)).join(',')})`;
export const f1 = x => (+x).toFixed(5);

// Carrier timetable from the shot params (timeline-v2 C9a): the light goes out on gap[0], the next
// carrier lights on gap[1] (always a downbeat). Extinction starts 5 frames before the gap; the gap is
// 4 frames of the old carrier's dark outline + 3 frames dissolving into the new one's outline.
export function carrierTable(shot) {
  const gaps = (shot.params && shot.params.darkGaps) || [[2345, 2352], [2417, 2424], [2489, 2496], [2561, 2568]];
  const names = ['fire', 'candle', 'lantern', 'bulb', 'sheet'];
  const start0 = shot.frames ? shot.frames[0] : 2280;
  const end = shot.frames ? shot.frames[1] : 2784;
  const T = [];
  for (let i = 0; i < names.length; i++) {
    const on = i === 0 ? start0 : gaps[i - 1][1];
    const g = gaps[i];
    T.push({ name: names[i], on, off: g ? g[0] - 5 : end, dark: g ? g[0] : end, next: g ? g[1] : end });
  }
  return T;
}

// Outline weights inside a gap. Old carrier: full for the 4 outline frames, then dissolving out over
// the 3 swap frames; new carrier: dissolving in over the same 3 frames, then (from its ignition) the
// outline hands over to its own light over 3 more frames.
export function outlineOld(fr, c) {
  if (fr < c.dark) return 0;
  const k = fr - (c.next - 3);
  if (k < 0) return 1;
  return Math.max(0, 1 - (k + 1) * 0.28);        // 0.72, 0.44, 0.16
}
export function outlineNew(fr, c) {
  const k = fr - (c.on - 3);
  if (k < 0) return 0;
  if (fr < c.on) return Math.min(1, (k + 1) * 0.3);   // 0.30, 0.60, 0.90
  return Math.max(0, 0.9 - (fr - c.on + 1) * 0.3);    // 0.60, 0.30, 0
}

// GLSL prelude shared by the carrier passes.
export const PRELUDE = /* glsl */ `
uniform vec2 uRes; uniform float uS, uFr, uOutline, uGain;
const vec2 CC = vec2(960.0, 540.0);
float FW;                                   // pixel footprint in 1080p px
vec2 P;                                     // pixel centre, 1080p px, y down
void setupP(vec2 shake){ FW = 1.0 / uS; P = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS + shake; }
float cov1(float a, float b, float x){ return clamp((min(x + 0.5 * FW, b) - max(x - 0.5 * FW, a)) / FW, 0.0, 1.0); }
float covD(float d){ return clamp(0.5 - d / FW, 0.0, 1.0); }            // d = signed distance, < 0 inside
float lineD(float d, float w){ return clamp(0.5 * w + 0.5 * FW - abs(d), 0.0, FW) / FW; } // box-filtered line of width w
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float sdEll(vec2 p, vec2 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
vec3 kel(float T){ vec3 b = blackbody(T); return b / max(1e-4, dot(b, vec3(0.2126, 0.7152, 0.0722))); }   // unit-luminance blackbody
float ss(float a, float b, float x){ return smoothstep(a, b, x); }
// ember colour of the dark outline (display luma ≈ 22 at w = 1 → HDR luminance ≈ 0.036)
vec3 emberLine(float w, float var){ return kel(1350.0) * 0.040 * w * var; }
`;

// A tileable 256² noise texture (3 independent fbm channels), as f_fire/night.js bakes it.
export function bakeNoise(kit, renderer) {
  return kit.bake(renderer, {
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
}

// A fullscreen pass whose blending can be switched per draw (first pass replaces, later passes add).
export function pass(kit, frag, uniforms) {
  const fsq = kit.fullscreen(frag, uniforms);
  const m = fsq.material;
  return {
    fsq, u: m.uniforms,
    draw(renderer, target, additive) {
      m.blending = additive ? THREE.AdditiveBlending : THREE.NoBlending;
      m.transparent = !!additive;
      const ac = renderer.autoClear;
      if (additive) renderer.autoClear = false;
      fsq.render(renderer, target);
      renderer.autoClear = ac;
    },
  };
}

export function baseUniforms(W, H) {
  return { uRes: { value: new THREE.Vector2(W, H) }, uS: { value: H / 1080 }, uFr: { value: 0 }, uOutline: { value: 0 }, uGain: { value: 1 } };
}
