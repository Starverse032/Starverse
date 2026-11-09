// m_asking/town.js — M6 · S05-f 小镇边的天线 [2906, 2916), 10 frames. Lamp on R.
//
// 50 mm, eye level, slightly up: a 12 m dish on a concrete pedestal on the last rise above a small town,
// ~300 px tall, its face to the upper right; the red lamp on its feed cabin is on R — the relay is back on
// R from here to the end of the film. Below and behind it, out of focus, the town: sodium street lamps as
// soft discs (display ≤ 40, max-blended so overlaps never add up), on the dark valley floor in front of the
// far hills. The only other light is the sky (twilight low on the right, the Milky Way overhead).
// Drift ←: the camera orbits the lamp to its left (~3 %/s).
import * as THREE from 'three';
import { fbm1 } from '../f_fire/common.js';
import { RXY, POST, SODIUM, shared, makeView, skyUniforms, setSkyFrame, updateView, makeSky, makeHills, makeLines, makeLamps, Dish, drawCut } from './kit5.js';

export function createTown(ctx, shot) {
  const { util, W, H } = ctx; const S = H / 1080;
  const sh = shared(ctx);
  const view = makeView(ctx, 50);
  const U = skyUniforms(ctx, { twiAz: 150, twiCol: [0.030, 0.052, 0.100], twiW: 1.6, low: [0.013, 0.018, 0.027], keyK: 1.6, galK: 0.24, ground: [0.0008, 0.0009, 0.0011] });
  const sky = makeSky(ctx, U);
  // the hills beyond the town (4 km), the valley floor's far edge (1.2 km), the rise the dish stands on (150 m)
  const farEl = az => 2.6 + 1.6 * (fbm1(az / 10 + 1.0, 4, 701) - 0.5) + 0.3 * (fbm1(az / 1.8, 3, 702) - 0.5);
  const riseEl = az => -1.6 + 3.6 * Math.exp(-(((az + 9) / 15) ** 2)) + 0.25 * (fbm1(az / 2.0, 3, 711) - 0.5) + 0.06 * (fbm1(az / 0.3, 2, 712) - 0.5);
  const far = makeHills(ctx, U, [{ dist: 4000, haze: 0.62, fn: farEl }], { az0: -50, az1: 50 });
  const rise = makeHills(ctx, U, [{ dist: 100, haze: 0.0, fn: riseEl }], { az0: -50, az1: 50, rim: 0.10 });

  const dish = new Dish(U, { D: 12, F: 4.8, off: 0.8, legs: 4, legPhase: 45, cabin: [0.8, 1.0, 0.8], pedestal: [1.0, 1.3, 5.0], seams: [6, 32, 0.22], bowlMat: { spec: 0.12 } });
  const meshScene = new THREE.Scene(); meshScene.add(dish.root);
  const lines = makeLines(ctx, 160);
  const lamps = makeLamps(ctx, 1);

  // ---- the town: ~220 sodium lamps along a few streets on the valley floor, 0.7–1.6 km away ------------
  const rnd = util.rng(7071);
  const town = [];
  // streets on the valley floor 40 m below us, 0.6–2.2 km out: [x0, z0, dx, dz, lamps]
  const streets = [[-300, -700, 900, -120, 26], [150, -650, 120, -1400, 30], [-200, -1100, 1100, 160, 24], [500, -900, 500, -600, 18],
    [-700, -1500, 1500, -200, 22], [-100, -800, -500, -500, 14], [300, -1700, 900, 100, 16], [700, -620, 400, -300, 10]];
  for (const [x0, z0, dx, dz, n] of streets) for (let i = 0; i < n; i++) {
    if (rnd() < 0.15) continue;
    const u = (i + 0.3 * rnd()) / n;
    const x = x0 + dx * u + (rnd() - 0.5) * 12, z = z0 + dz * u + (rnd() - 0.5) * 12, y = -40;
    const dist = Math.hypot(x, z), el = Math.atan2(y - 1.6, dist) * 180 / Math.PI, az = Math.atan2(x, -z) * 180 / Math.PI;
    town.push([az, el, (0.45 + 0.55 * rnd()) * Math.min(1, 900 / dist + 0.35)]);
  }
  const tg = new THREE.BufferGeometry();
  const tp = new Float32Array(town.length * 3), ti = new Float32Array(town.length);
  town.forEach(([az, el, k], i) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; tp.set([1000 * Math.cos(e) * Math.sin(a), 1000 * Math.sin(e), -1000 * Math.cos(e) * Math.cos(a)], 3 * i); ti[i] = k; });
  tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setAttribute('k', new THREE.BufferAttribute(ti, 1));
  const bokeh = new THREE.Points(tg, new THREE.ShaderMaterial({
    uniforms: { uS: { value: S }, uRes: { value: new THREE.Vector2(W, H) }, uCol: { value: new THREE.Vector3(...SODIUM) }, uR: { value: 13.0 } },
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    vertexShader: /* glsl */ `
      attribute float k; uniform float uS, uR; uniform vec2 uRes; varying vec2 vC; varying float vK, vRad;
      void main(){ vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = c;
        vC = (c.xy / c.w * 0.5 + 0.5) * uRes; vK = k; vRad = uR * (0.85 + 0.3 * fract(k * 7.3)) * uS; gl_PointSize = 2.0 * vRad + 4.0; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; varying vec2 vC; varying float vK, vRad;
      void main(){
        float r = length(gl_FragCoord.xy - vC) / vRad;
        // a defocus disc: flat, a slightly brighter rim (spherical aberration), soft 1 px edge
        float disc = clamp((1.0 - r) * vRad + 0.5, 0.0, 1.0) * (0.85 + 0.15 * smoothstep(0.6, 0.95, r));
        gl_FragColor = vec4(uCol * 0.058 * vK * disc, 1.0);     // R ≈ 0.058 → display ≤ 40
      }`,
  }));
  bokeh.frustumCulled = false;
  const bokehScene = new THREE.Scene(); bokehScene.add(bokeh);

  const E = [-2, 8.3, -92];
  const T0 = shot.start, T1 = shot.end, TM = (T0 + T1) / 2;
  const CAM0 = new THREE.Vector3(6, 1.6, 0);
  const RATE = -0.0216;                      // ← : 3 % of the frame per second
  const setup = t => {
    dish.pose(E, 150, 42);
    const L = dish.lamp();
    const off = CAM0.clone().sub(L).applyAxisAngle(new THREE.Vector3(0, 1, 0), RATE * (t - TM));
    const P = L.clone().add(off);
    view.aim(P.toArray(), L.toArray(), RXY);
    updateView(U, view);
    far.U.uOff.value.copy(P).sub(CAM0); rise.U.uOff.value.copy(P).sub(CAM0);
    U.uLampW.value.copy(L);
    lines.setCam(view.cam); lines.set(dish.lines(U, { rimW: 0.08, legW: 0.10, legLit: [0.004, 0.006, 0.012] }));
    lamps.set([{ p: L.toArray(), core: 2.6, halo: 10 }]);
  };
  setup(TM);
  setSkyFrame(U, view, [900, 200], 20, -20, 2.0);
  const M = U.uM.value.clone();
  return {
    render(s, f) {
      setup(f.t);
      U.uM.value.copy(M); sh.stars.setFrame(M);
      drawCut(ctx, f, view, sh, {
        sky, hills: [far, { render(r, t) { r.setRenderTarget(t); r.render(bokehScene, view.skyCam); } }], scenes: [meshScene], lines, floor: [rise], lamps,
      });
    },
    post() { return { ...POST }; },
  };
}
