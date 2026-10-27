// a_origin — long take A, first engine shot A1 [600, 1212): screenplay S02-a, S02-b, S02-c and S02-d up
// to the middle of substitution ① (hand-off to a_star at f1212, docs/v2/handoffs.md).
//
//   [600, 603)   the R point (p_terminal's f599: HDR 1.5) explodes: 1.5 → 30 → 1e4
//   [603, 611)   near-clipped warm white #FFF4E0 with the near fog still visible (≥ 5 % relief), flowing out
//   [611, 792)   three-layer radiation (a_origin/radiation.js), 4500 → 3000 → 1500 K, 0 → −1 → −4 EV;
//                f720 decoupling (mid contrast → 0, far speckle σ 6 → 1 px, near thins to 1–2 wisps)
//   [792, 888)   darkness (−7 EV at f840); the afterglow target at R (dark red-brown, Ø 40 → 12 px);
//                faint dust wisps drift out of the frame
//   f888         the first star at R — its first frame is the cursor footprint (24×64, CURSOR, HDR 0.9)
//   [889, 960)   point star HDR 1 → 40 (a_origin/web.js); f936 the second star at ≈ (1086, 422)
//   [960, 1128)  the cosmic web lights up on N(t) = 2^((t − 40)/0.5) (a_origin/ignition.js), camera on
//                WEB_PATH_A (≈ 1 %/frame), passing WEB_PATH(9.0) exactly at f1128
//   [1128, 1176) selection: R node +1 EV, the knot of ≈ 40 stars, rest −30 %; 1 → 2 %/frame
//   [1176, 1200) sprint ≤ 5 %/frame with analytic radial blur (capsules + gas zoom blur)
//   [1200, 1212) substitution ① first half: the shared corona (_corona.js) fills R; the web fades behind it
// Camera: only forward, focus of expansion pinned on R (shift lens: the motion ray passes through R).
// Pure function of f.t; motion blur is analytic (no sub-frames).
import * as THREE from 'three';
import { createRadiation, radState } from './a_origin/radiation.js';
import { createWebLayer } from './a_origin/web.js';
import { createCorona, coronaPost } from './_corona.js';

const FPS = 24;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// post: f600 = p_terminal's f599 (match, no jump); flash; white frames (no bloom / vignette / ca);
// radiation (soft bloom, warm saturation); stars & web (bloom 0.75, no streak); corona (shared).
export function postA(fr) {
  const base = {
    exposure: 1, saturation: 1, contrast: 1, tint: [1, 1, 1], lift: [0, 0, 0], fade: 0, flash: 0, flashColor: [1, 0.96, 0.9],
    blackLevel: 0, bloomRadius: 1.0, streakTint: [0.55, 0.75, 1.0], bloomThreshold: 1.0, bloomKnee: 0.6, grain: 0.035,
  };
  if (coronaPost.active(fr)) return coronaPost(fr);
  const x = fr - 600;
  if (x < 0.5) return { ...base, bloom: 0.8, streak: 0.5, vignette: 0.2, ca: 0.0006 };
  if (x < 2.5) return { ...base, bloom: 1.0, streak: 0.35, vignette: 0.2, ca: 0.0006 };
  if (x < 11) return { ...base, bloom: 0, streak: 0, vignette: 0, ca: 0 };
  const u = sstep(11, 36, x);
  const v = sstep(780, 900, fr);                       // radiation → stars
  const w = sstep(1150, 1176, fr);                     // → corona post (streak 0.12)
  return {
    ...base,
    bloom: lerp(0.35 * u, 0.75, v), streak: 0.12 * w, vignette: 0.2 * u, ca: 0.0006 * u,
    saturation: lerp(lerp(1, 1.45, u), 1, v),
  };
}

export async function create(ctx) {
  const { renderer, W, H, kit } = ctx;
  const S = H / 1080;
  const needRad = ctx.inRange(24.5, 42.5);          // radiation + dust wisps until f1010
  const needWeb = ctx.inRange(36.9, 51.0);
  const rad = needRad ? createRadiation(ctx) : null;
  const web = needWeb ? createWebLayer(ctx) : null;
  const corona = createCorona(ctx);
  // the cursor footprint (f888 only): 24×64 px vertical rectangle centred on R, CURSOR #F2EEE4, HDR 0.9
  const CUR = [srgb(0xF2 / 255), srgb(0xEE / 255), srgb(0xE4 / 255)];
  const foot = kit.fullscreen(/* glsl */ `
    uniform float uHt, uPx; uniform vec3 uCol;
    void main(){
      vec2 p = vec2(gl_FragCoord.x, uHt - gl_FragCoord.y) * uPx;      // 1080p px, y down
      // box-filtered coverage of [722, 746] × [508, 572] (exact at 1080p, antialiased at other scales)
      vec2 a = clamp((p + 0.5 * uPx) - vec2(722.0, 508.0), 0.0, uPx) / uPx;
      vec2 b = clamp(vec2(746.0, 572.0) - (p - 0.5 * uPx), 0.0, uPx) / uPx;
      float cov = min(a.x, b.x) * min(a.y, b.y);
      gl_FragColor = vec4(uCol * 0.9 * cov / dot(uCol, vec3(0.2126, 0.7152, 0.0722)), 1.0);
    }`, { uHt: { value: H }, uPx: { value: 1 / S }, uCol: { value: new THREE.Vector3(...CUR) } },
    { blending: THREE.AdditiveBlending, transparent: true });

  return {
    render(shot, f) {
      const fr = f.t * FPS;
      const tgt = f.target;
      if (fr < 888) {
        rad.render(renderer, tgt, fr, 'base');
      } else {
        web.render(renderer, tgt, fr, { clear: true });
        if (rad && fr < 1010 && radState(fr).dust > 0) rad.render(renderer, tgt, fr, 'dust');
        if (fr >= 888 && fr < 889) {
          foot.material.uniforms.uHt.value = tgt.height; foot.material.uniforms.uPx.value = 1080 / tgt.height;
          const ac = renderer.autoClear; renderer.autoClear = false;
          foot.render(renderer, tgt);
          renderer.autoClear = ac;
        }
        corona.render(renderer, tgt, fr);
      }
      renderer.setRenderTarget(tgt);
    },
    post(shot, f) { return postA(f.t * FPS); },
    motionBlur: 0,
  };
}
