// c_firststar — S09 黑暗时代 · 第一颗星 (35.0 → 43.0, f840–1031).
//
//   35.0–37.0  the Dark Ages: true black, only the film grain of the post chain.
//   37.0 f888  the first star ignites at R — its FIRST frame is a 24×64 vertical rectangle of light
//              (the cursor's footprint, one of the film's three), warm cursor white, HDR 2.0.
//   f889–      a point-spread star (core FWHM 2 px + Moffat wing: brighter stars look bigger), HDR 1 → 40 in 6 frames (easeOutQuad + a slight
//              overshoot), a short own anamorphic streak (±60 px), colour STAR #BFD4FF.
//   39.0       the second star at (1086, 422); from 39.0 the camera pulls straight back, uniformly, and
//              zooms out 50 → 24 mm (framing ×6.3), ending EXACTLY on S10's opening pose WEB_PATH(0):
//              the first star drifts from R to its S10 pixel, and the cut at 43.0 is concentric — every
//              lit star keeps its pixel across it (c_firststar/camera.js; c_web draws this same star
//              layer over 43–45 and crossfades it into its own node stars).
//   40.0–43.0  ignition law N(t) = 2^((t − 40)/0.5), order = hop distance in the WEB graph (seed 1990)
//              from the first star: these stars ARE the nodes of S10's cosmic web (c_web/ignition.js
//              shares the law, so the cut at 43.0 continues the same process). ≈ 66 stars by 43.0
//              (44 of them inside S10's frame).
//
// The universe makes no sound and has no colour but cold: blue-white stars on pure black.
// Cost: ~70 point sprites + one fullscreen pass on f888 only → ≈ 20–60 ms/frame.
import * as THREE from 'three';
import { ignition, T_FIRST } from './c_web/ignition.js';
import { solveCamera, firstStarPose, FOCAL } from './c_firststar/camera.js';
import { createFirstStars } from './c_firststar/stars.js';

const FPS = 24;
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => [srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255)];
const CURSOR = hex(0xF2EEE4);

export async function create(ctx) {
  const { renderer, W, H, kit, util } = ctx;
  const S = H / 1080;
  const I = ignition();
  const sol = solveCamera(I);

  // ---- the first stars: web nodes in ignition order (shared with c_web for the cut) --------------
  const FS = createFirstStars(ctx, I, { uRef: sol.D0 });
  const uni = FS.uni;
  const scene = new THREE.Scene();
  scene.add(FS.points);
  const cam = kit.filmCamera(W, H, { focalMM: FOCAL, near: 0.5, far: 5000 });

  // ---- the cursor footprint (f888 only): 24×64 px vertical rectangle centred on R -----------------
  const foot = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes; uniform float uS; uniform vec3 uCol;
    void main(){
      vec2 sxy = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;   // 1080p px, top-left origin
      float inside = step(722.0, sxy.x) * step(sxy.x, 746.0) * step(508.0, sxy.y) * step(sxy.y, 572.0);
      gl_FragColor = vec4(uCol * 2.0 * inside, 1.0);
    }`, { uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uCol: { value: new THREE.Vector3(...CURSOR) } },
    { blending: THREE.AdditiveBlending, transparent: true });

  return {
    render(shot, f) {
      const t = f.t;
      const P = firstStarPose(sol, t);
      cam.position.copy(P.pos); cam.quaternion.copy(P.quat);
      cam.setFocalLength(P.focal); cam.updateMatrixWorld();
      uni.uT.value = t; uni.uZoom.value = P.zoom; uni.uGain.value = 1;
      renderer.setRenderTarget(f.target);
      renderer.setClearColor(0x000000, 1); renderer.clear();
      if (t >= T_FIRST) renderer.render(scene, cam);
      const fr = Math.floor((t - T_FIRST) * FPS + 1e-4);
      if (fr === 0) foot.render(renderer, f.target);
    },
    post(shot, f) {
      // the stars draw their own short streak; the post streak would smear the 40-HDR core across the frame.
      // Over the last second the grade meets S10's (c_web post) so the cut changes no star's code value.
      const u = util.smoothstep(42.0, 43.0, f.t);
      return { streak: 0.0, bloom: util.lerp(0.7, 0.8, u), bloomThreshold: 1.0, contrast: util.lerp(1, 1.08, u), saturation: util.lerp(1, 0.8, u) };
    },
  };
}
