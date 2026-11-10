// m_asking/array.js — M2 · S05-b 山谷里一排六口天线 [2820, 2850), 30 frames.
//
// 35 mm from high on the valley side, looking down ~8°: six 14 m dishes in a line along the valley floor,
// the nearest one's lamp on C, the other five lamps stepping up and to the left into the depth. All six slew
// together (az −34° → −26°) — the one gesture of the cut. The twilight is behind the camera on the left: it
// lights the six concave faces (L2) and their rims; the valley floor is ≤ 5 with a pale gravel track tying
// the dishes together; the far side of the valley and the mountains beyond are hazed by the low sky; a strip
// of sky with the Milky Way at the top. Drift ←: the camera orbits the near lamp to its left (~3 %/s).
import * as THREE from 'three';
import { fbm1 } from '../f_fire/common.js';
import { CXY, POST, NIGHT_GLSL, RAY_GLSL, shared, makeView, skyUniforms, setSkyFrame, updateView, makeHills, makeLines, makeLamps, Dish, drawCut } from './kit5.js';

export function createArray(ctx, shot) {
  const { util, kit } = ctx;
  const sh = shared(ctx);
  const view = makeView(ctx, 35);
  const U = skyUniforms(ctx, { twiAz: -150, twiCol: [0.030, 0.052, 0.100], twiW: 1.6, low: [0.013, 0.018, 0.027], keyK: 1.7, galK: 0.24, ground: [0.0010, 0.0011, 0.0014] });
  // the valley floor (y = 0) and the gravel track, in the sky pass for rays below the horizon
  U.uTrack = { value: new THREE.Vector4(0, -190, -72, -62) };     // x0, z0, dx, dz of the line of dishes
  const sky = kit.fullscreen(NIGHT_GLSL + RAY_GLSL + /* glsl */ `
    uniform mat3 uM; uniform sampler2D uGal; uniform float uL, uB, uGalK; uniform vec3 uCam; uniform vec4 uTrack;
    uniform float uKeyK, uAmbK;
    void main(){
      vec3 d = rayDir(); float el = asin(clamp(d.y, -1.0, 1.0));
      vec3 col;
      if (d.y < -0.0005) {
        vec3 p = uCam + d * (-uCam.y / d.y);
        float dist = length(p - uCam);
        float fp = dist * 0.0012;                     // metres per pixel (approx), for band-limiting
        float g = fbm(p.xz * 0.02, 3), g2 = fbm(p.xz * 0.21 + 7.0, 2);
        vec3 alb = vec3(0.050, 0.058, 0.050) * (0.6 + 0.8 * g) * (0.8 + 0.4 * mix(g2, 0.5, clamp(fp * 3.0, 0.0, 1.0)));
        // the gravel track along the line of dishes: a pale ribbon 5 m wide
        vec2 a = uTrack.xy, ab = normalize(uTrack.zw);
        vec2 q = p.xz - a; float along = dot(q, ab), across = abs(q.x * ab.y - q.y * ab.x);
        float w = 2.5 + fp; float tr = smoothstep(w + fp, w - fp, across) * smoothstep(-420.0, -300.0, along) * step(along, 640.0);
        vec3 Lt = normalize(vec3(uTwiDir.x, 0.22, uTwiDir.z));
        col = alb * ((uZen + uLow * 0.6) * uAmbK + uTwiCol * uKeyK * Lt.y);
        // dew on the grass mirrors the low sky at grazing angles; the gravel track catches the twilight
        col += (0.02 + 0.98 * pow(1.0 - (-d.y), 5.0)) * skyRad(reflect(d, vec3(0.0, 1.0, 0.0))) * 0.25;
        col += tr * vec3(0.036, 0.041, 0.052);
        // the haze over the far floor
        col = mix(col, skyRad(vec3(d.x, 0.02, d.z)) * 0.55, 1.0 - exp(-dist / 2600.0));
      } else {
        col = skyRad(d);
        if (el > -0.02) col += galaxy(uGal, uM, d, uL, uB) * extinction(el, 0.16) * uGalK;
      }
      gl_FragColor = vec4(col, 1.0);
    }`, Object.assign(U, { uCam: { value: new THREE.Vector3() } }));
  // the far side of the valley (1.6 km) and the range beyond (6 km)
  const sideEl = az => 1.2 + 2.6 * Math.exp(-(((az + 8) / 30) ** 2)) + 1.0 * (fbm1(az / 8 + 2.0, 4, 621) - 0.5) + 0.25 * (fbm1(az / 1.3, 3, 622) - 0.5);
  const rangeEl = az => 3.2 + 2.0 * (fbm1(az / 12 + 5.0, 4, 631) - 0.5) + 1.6 * Math.exp(-(((az + 25) / 7) ** 2)) + 0.4 * (fbm1(az / 2, 3, 632) - 0.5);
  const hills = makeHills(ctx, U, [{ dist: 6000, haze: 0.70, fn: rangeEl }, { dist: 1600, haze: 0.40, fn: sideEl }], { az0: -70, az1: 70, rim: 0.0, footH: 26 });

  const meshScene = new THREE.Scene();
  const dishes = [];
  for (let k = 0; k < 6; k++) {
    const d = new Dish(U, { D: 14, F: 5.6, off: 1.0, legs: 4, legPhase: 45, cabin: [0.9, 1.1, 0.9], pedestal: [1.1, 1.5, 4.4], seams: [6, 32, 0.20], bowlMat: { spec: 0.12 } });
    meshScene.add(d.root); dishes.push(d);
  }
  const E = k => [-72 * k, 9.5, -190 - 62 * k];
  const lines = makeLines(ctx, 6 * 104);
  const lamps = makeLamps(ctx, 6);

  const T0 = shot.start, T1 = shot.end, TM = (T0 + T1) / 2;
  const az = t => -34 + 8 * util.ease.inOutSine(util.clamp((t - T0) / (T1 - T0), 0, 1));
  const CAM0 = new THREE.Vector3(80, 26, 0);
  const RATE = -0.031;                       // ← : 3 % of the frame per second (35 mm)
  const setup = t => {
    dishes.forEach((d, k) => d.pose(E(k), az(t), 48));
    const L0 = dishes[0].lamp();
    const off = CAM0.clone().sub(L0).applyAxisAngle(new THREE.Vector3(0, 1, 0), RATE * (t - TM));
    const P = L0.clone().add(off);
    view.aim(P.toArray(), L0.toArray(), CXY);
    updateView(U, view);
    U.uCam.value.copy(P);
    hills.U.uOff.value.copy(P).sub(CAM0);
    U.uLampW.value.copy(L0);
    lines.setCam(view.cam);
    lines.set(dishes.flatMap((d, k) => d.lines(U, { n: k < 2 ? 128 : 96, rimW: 0.12, legW: 0.16, legLit: [0.003, 0.005, 0.010] })));
    lamps.set(dishes.map((d, k) => ({ p: d.lamp().toArray(), core: k === 0 ? 2.6 : Math.max(1.8, 2.6 - 0.2 * k), halo: k === 0 ? 10 : 10 - k })));
  };
  setup(TM);
  setSkyFrame(U, view, [1150, 190], 172, 18, 2.0);
  const M = U.uM.value.clone();
  return {
    render(s, f) {
      setup(f.t);
      U.uM.value.copy(M); sh.stars.setFrame(M);
      drawCut(ctx, f, view, sh, { sky, hills: [hills], scenes: [meshScene], lines, lamps });
    },
    post() { return { ...POST }; },
  };
}
