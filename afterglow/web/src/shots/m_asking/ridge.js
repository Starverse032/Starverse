// m_asking/ridge.js — M1 · S05-a 山脊上的孤碟 [2784, 2820), 36 frames.
//
// 50 mm, low angle from the grass below a bare ridge: one 28 m dish stands on the crest, its face turned to
// the left and up, the feed cabin hanging in front of the bowl on four legs; the red lamp on the cabin is on
// C (it catches S04's last light centre). The servo raises the dish 3° during the cut (35° → 38°).
// Light: the last blue of the twilight low on the right, behind the ridge — it lights the rim and legs on
// their right sides and makes a pale crescent inside the bowl; the bowl's back and the pedestal are 6–12
// against a sky of 12–22; the ridge in front is ≤ 5 with a thread of sky on its crest. The Milky Way climbs
// on the left. Drift →: the camera orbits the lamp to its right at ~3 % of the frame per second (the sky
// slides right, the crest left, the lamp never leaves C).
import * as THREE from 'three';
import { fbm1 } from '../f_fire/common.js';
import { CXY, D2R, POST, shared, makeView, skyUniforms, setSkyFrame, updateView, makeSky, makeHills, makeLines, makeLamps, Dish, drawCut, shotP } from './kit5.js';

export function createRidge(ctx, shot) {
  const { util } = ctx;
  const sh = shared(ctx);
  const view = makeView(ctx, 50);
  const U = skyUniforms(ctx, { twiAz: -125, twiCol: [0.030, 0.052, 0.100], twiW: 2.0, low: [0.013, 0.018, 0.027], keyK: 1.8, galK: 0.22, ground: [0.05, 0.0, 0.0] });
  const sky = makeSky(ctx, U);
  const ridgeEl = az => 7.5 + 0.075 * az - 0.0022 * az * az + 1.1 * (fbm1(az / 9 + 3.1, 4, 501) - 0.5) + 0.35 * (fbm1(az / 2.2, 3, 502) - 0.5) + 0.08 * (fbm1(az / 0.35, 2, 503) - 0.5);
  const farEl = az => 4.2 + 2.2 * (fbm1(az / 14 + 7.0, 4, 511) - 0.5) + 1.5 * Math.exp(-(((az + 30) / 9) ** 2)) + 0.4 * (fbm1(az / 2.5, 3, 512) - 0.5);
  const far = makeHills(ctx, U, [{ dist: 5200, haze: 0.62, fn: farEl }], { az0: -50, az1: 50 });
  const ridge = makeHills(ctx, U, [{ dist: 100, haze: 0.0, fn: ridgeEl }], { az0: -50, az1: 50, rim: 0.10 });   // in front of the pedestal: drawn after it

  const dish = new Dish(U, { D: 28, F: 11.2, off: 1.5, legs: 4, legPhase: 45, cabin: [1.6, 2.0, 1.6], pedestal: [2.4, 3.0, 9.0], seams: [9, 56, 0.22], bowlMat: { spec: 0.14, specK: 1.0 } });
  const E = [0, 20, -112];
  const meshScene = new THREE.Scene(); meshScene.add(dish.root);
  const lines = makeLines(ctx, 256);
  const lamps = makeLamps(ctx, 1);

  const T0 = shot.start, T1 = shot.end, TM = (T0 + T1) / 2;
  const el = t => 25 + 3 * util.ease.inOutSine(util.clamp((t - T0) / (T1 - T0), 0, 1));
  const CAM0 = new THREE.Vector3(0, 0, 0);
  const RATE = 0.0216;                       // rad/s of orbit = 3 % of the frame per second for the sky
  const setup = t => {
    dish.pose(E, -22, el(t));
    const L = dish.lamp();
    const off = CAM0.clone().sub(L).applyAxisAngle(new THREE.Vector3(0, 1, 0), RATE * (t - TM));
    const P = L.clone().add(off);
    view.aim(P.toArray(), L.toArray(), CXY);
    updateView(U, view);
    far.U.uOff.value.copy(P).sub(CAM0); ridge.U.uOff.value.copy(P).sub(CAM0);
    U.uLampW.value.copy(L);
    lines.setCam(view.cam); lines.set(dish.lines(U, { rimW: 0.20, legLit: [0.003, 0.005, 0.010] }));
    lamps.set([{ p: L.toArray(), core: 2.6, halo: 10 }]);
  };
  setup(TM);
  setSkyFrame(U, view, [1250, 300], 152, -8, 1.0);    // the frame is fixed in the world: set once at mid-shot
  sh.stars.setFrame(U.uM.value);
  const M = U.uM.value.clone();

  return {
    render(s, f) {
      setup(f.t);
      U.uM.value.copy(M); sh.stars.setFrame(M);
      drawCut(ctx, f, view, sh, { sky, hills: [far], scenes: [meshScene], lines, floor: [ridge], lamps });
    },
    post() { return { ...POST }; },
  };
}
