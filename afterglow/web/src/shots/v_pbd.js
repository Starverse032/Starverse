// v_pbd — S33 暗淡蓝点 (154.0 → 161.0, f3696–3863).
//
// The Pale Blue Dot as a photograph, not as a render: one locked, absolutely still frame from Voyager 1's
// narrow-angle camera (1500 mm, hFOV 1.37°). A single fullscreen shader, evaluated on a 960×540 vidicon
// grid and shown nearest-neighbour ×2 (every "vidicon pixel" is a 2×2 block of output pixels):
//   · photo black #030303 (not INK), a faint veil of scattered light,
//   · the main band of scattered sunlight: Gaussian cross-section through R, 4° off vertical, σ = 70 px,
//     0.18 × PBD_BAND, with a faint prismatic fringe (R/G/B profiles offset ±6 px, red left, blue right),
//     a few fine striations along its length and a slow along-band modulation (light scattered in optics
//     is never a perfect Gaussian),
//   · the secondary band at x ≈ 1150 (σ 40, 0.06),
//   · the sensor: static fixed-pattern noise (seed 33) 0.02, per-line gain ripple, temporal noise 0.005,
//   · the dot: exactly one vidicon pixel = output pixels x 734–735, y 540–541 (centre 734.5, 540.5 —
//     even-aligned so a yuv420 chroma block is not split), PBD_DOT, 0.32.
// No stars, no bloom, no streak, no grain from post (timeline post + post() below).
//
// The intensities are display-linear (sRGB-decoded) multipliers of the palette colours. Because the
// engine's post tone-maps with ACES, the shader inverts the ACES fit exactly (both matrices + the
// rational curve) so that what reaches the screen is the photograph's value, not a tone-mapped one.
import * as THREE from 'three';

const R = [734.5, 540.5];

const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = h => new THREE.Vector3(s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255));

export async function create(ctx) {
  const { renderer, W, H, kit } = ctx;

  // ACES fitted (lib/glsl.js acesFitted): out = outM · f(inM · c). Inverse matrices for the shader.
  const inM = new THREE.Matrix3().fromArray([0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777]);
  const outM = new THREE.Matrix3().fromArray([1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602]);
  const inMi = inM.clone().invert(), outMi = outM.clone().invert();

  const U = {
    uS: { value: H / 1080 }, uFrame: { value: 0 },
    uInMi: { value: inMi }, uOutMi: { value: outMi },
    uBand: { value: hexLin(0xCDBB98) }, uDot: { value: hexLin(0xA8C4E6) },
    uBlack: { value: 3 / 255 },
  };
  const pass = kit.fullscreen(/* glsl */ `
    uniform float uS, uFrame, uBlack; uniform mat3 uInMi, uOutMi; uniform vec3 uBand, uDot;
    const vec2 R = vec2(${R[0].toFixed(1)}, ${R[1].toFixed(1)});
    const float TH = 0.0698132;                      // 4° off vertical (top leans right)
    float h21(vec2 p, float s){ return fract(sin(dot(p, vec2(127.1, 311.7)) + s * 17.13) * 43758.5453); }
    float vn1(float x, float s){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(h21(vec2(i, 3.1), s), h21(vec2(i + 1.0, 3.1), s), f); }
    float g(float d, float sg){ return exp(-0.5 * d * d / (sg * sg)); }
    // one band: n = signed distance from its centre line (px), a = position along it (px, up = +)
    float bandProfile(float n, float a, float sg, float seed){
      float core = g(n, sg);
      // fine striations inside the band (scattered rays) and a slow modulation along it
      float str = 1.0 + 0.24 * (vn1(n / 13.0, seed) - 0.5) + 0.16 * (vn1(n / 4.0, seed + 1.0) - 0.5)
                + 0.08 * (vn1(n / 1.7 + a / 4000.0, seed + 3.0) - 0.5)
                + 0.16 * g(n - 0.32 * sg, 0.07 * sg) + 0.10 * g(n + 0.55 * sg, 0.05 * sg) + 0.08 * g(n + 0.08 * sg, 0.04 * sg);
      float lon = 1.0 + 0.10 * (vn1(a / 160.0 + n / 900.0, seed + 2.0) - 0.5) + 0.06 * (a / 540.0);
      return core * str * lon;
    }
    vec3 lin2srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    vec3 srgb2lin(vec3 c){ return mix(c / 12.92, pow((max(c, 0.0) + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
    // exact inverse of acesFitted (per channel quadratic between the matrices)
    vec3 acesInv(vec3 y){
      y = uOutMi * clamp(y, 0.0, 0.98);
      vec3 A = 1.0 - 0.983729 * y, B = 0.0245786 - 0.4329510 * y, C = 0.000090537 + 0.238081 * y;
      vec3 x = (-B + sqrt(max(B * B + 4.0 * A * C, 0.0))) / (2.0 * A);
      return max(uInMi * x, 0.0);
    }
    void main(){
      // 1080p pixel coordinates, top-down; snap to the 960×540 vidicon grid (2×2 output px per sample)
      vec2 p = vec2(gl_FragCoord.x, ${H.toFixed(1)} - gl_FragCoord.y) / uS;
      vec2 blk = floor(p / 2.0);
      vec2 c = blk * 2.0 + 1.0;                      // the block's centre (e.g. the dot's block → 735, 541)
      vec2 nrm = vec2(cos(TH), sin(TH)), axu = vec2(sin(TH), -cos(TH));
      vec2 q = c - R;
      float n = dot(q, nrm), a = dot(q, axu);
      // main band with its prismatic fringe: red sits 6 px to the left, blue 6 px to the right
      vec3 band = vec3(bandProfile(n + 6.0, a, 70.0, 1.0), bandProfile(n, a, 70.0, 1.0), bandProfile(n - 6.0, a, 70.0, 1.0));
      vec3 col = 0.18 * uBand * band;
      // secondary band at x ≈ 1150
      float n2 = dot(c - vec2(1150.0, 540.5), nrm);
      col += 0.06 * uBand * vec3(bandProfile(n2 + 4.0, a, 40.0, 5.0), bandProfile(n2, a, 40.0, 5.0), bandProfile(n2 - 4.0, a, 40.0, 5.0));
      // a broad veil of scattered light around the bands (the optics are flooded by the nearby sun)
      col += uBand * (0.0035 * g(n, 300.0) + 0.0015 * g(n2, 200.0));
      // the dot: exactly one vidicon pixel
      if (blk == vec2(367.0, 270.0)) col = 0.32 * uDot;
      // to display (sRGB) space: photo black + sensor
      vec3 s = lin2srgb(col) + uBlack;
      float fpn = (h21(blk, 33.0) + h21(blk * 1.37 + 9.1, 34.0) - 1.0);          // static pattern
      float line = (vn1(blk.y * 0.5, 41.0) - 0.5) * 0.6 + (h21(vec2(0.0, blk.y), 42.0) - 0.5) * 0.5;   // per-line gain
      float tmp = h21(blk + vec2(uFrame * 0.731, uFrame * 1.917), 77.0) + h21(blk * 0.71 + uFrame, 78.0) - 1.0;
      float sig = clamp(dot(s, vec3(0.333)) * 4.0, 0.0, 1.0);                    // noise grows with signal
      s += (0.02 * fpn * (0.35 + 0.65 * sig) + 0.006 * line * sig + 0.005 * tmp) * vec3(1.0, 0.985, 1.02);
      s = max(s, vec3(0.0));
      gl_FragColor = vec4(acesInv(srgb2lin(s)), 1.0);
    }`, U);

  return {
    msaa: false,
    render(shot, f) {
      U.uFrame.value = f.frame;
      pass.render(renderer, f.target);
    },
    post() {
      // a photograph: no bloom, no streak, no post grain, no CA; neutral grade so the ACES inverse holds
      return { exposure: 1.0, bloom: 0.0, streak: 0.0, grain: 0.0, ca: 0.0, vignette: 0.12, saturation: 1.0, contrast: 1.0,
        tint: [1, 1, 1], lift: [0, 0, 0] };
    },
  };
}
