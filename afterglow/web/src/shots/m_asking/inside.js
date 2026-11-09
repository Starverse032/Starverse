// m_asking/inside.js — M3 · S05-c 碟面内侧 [2850, 2874), 24 frames.
//
// 24 mm, standing under the lower lip of a 34 m dish that is turned down towards us (el 20°), looking up:
// the near rim is a dark arc across the bottom of the frame, the concave face rises above it — panelled,
// glossy, holding a reflection of the sky behind us and the twilight (L2) — and the four feed legs reach out
// over our heads to the cabin, which hangs against the Milky Way on C with its red lamp. Drift →: the
// camera orbits the lamp to its right (~3 %/s at 24 mm).
import * as THREE from 'three';
import { CXY, POST, shared, makeView, skyUniforms, setSkyFrame, updateView, makeSky, makeLines, makeLamps, Dish, drawCut } from './kit5.js';

export function createInside(ctx, shot) {
  const sh = shared(ctx);
  const view = makeView(ctx, 24, { near: 0.2 });
  const U = skyUniforms(ctx, { twiAz: 165, twiCol: [0.030, 0.052, 0.100], twiW: 1.6, low: [0.013, 0.018, 0.027], keyK: 1.5, galK: 0.26, ground: [0.0012, 0.0013, 0.0016] });
  const sky = makeSky(ctx, U);
  const dish = new Dish(U, { D: 34, F: 12, off: 2.0, legs: 4, legPhase: 45, cabin: [2.2, 2.6, 2.2], pedestal: [2.8, 3.6, 12.0], seams: [12, 72, 0.24], bowlMat: { spec: 0.16, specK: 1.1, gloss: 0.22 } });
  const meshScene = new THREE.Scene(); meshScene.add(dish.root);
  const lines = makeLines(ctx, 256);
  const lamps = makeLamps(ctx, 1);
  const E = [0, 22, 0];
  const T0 = shot.start, T1 = shot.end, TM = (T0 + T1) / 2;
  const CAM0 = new THREE.Vector3(5.5, 4.0, 25.0);
  const RATE = 0.045;                        // → : 3 % of the frame per second at 24 mm
  const setup = t => {
    dish.pose(E, 8, 20);
    const L = dish.lamp();
    const off = CAM0.clone().sub(L).applyAxisAngle(new THREE.Vector3(0, 1, 0), RATE * (t - TM));
    const P = L.clone().add(off);
    view.aim(P.toArray(), L.toArray(), CXY, [0.25, 1, 0]);
    updateView(U, view);
    U.uLampW.value.copy(L);
    lines.setCam(view.cam);
    lines.set(dish.lines(U, { rimW: 0.30, legW: 0.45, legCol: [0.008, 0.010, 0.014], legLit: [0.010, 0.020, 0.040] }));
    lamps.set([{ p: L.toArray(), core: 2.6, halo: 10 }]);
  };
  setup(TM);
  setSkyFrame(U, view, [1100, 330], 128, 5, -1.0);
  const M = U.uM.value.clone();
  return {
    render(s, f) {
      setup(f.t);
      U.uM.value.copy(M); sh.stars.setFrame(M);
      drawCut(ctx, f, view, sh, { sky, scenes: [meshScene], lines, lamps });
    },
    post() { return { ...POST }; },
  };
}
