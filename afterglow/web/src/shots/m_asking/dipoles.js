// m_asking/dipoles.js — M5 · S05-e 偶极子天线阵 [2892, 2906), 14 frames. No lamp in this cut.
//
// 35 mm from 60 m up, looking down the rows of a low-frequency array: thousands of crossed inverted-V
// dipoles (each a mast and two crossed wires, ≤ 20 px even in the front row) in rows parallel to the view,
// so every row, the field's edges and the service track converge on one vanishing point — on R, where the
// horizon carries the last of the twilight. The grass is ≤ 5 near us and takes a cool sheen towards the
// horizon; the wires catch the sky (L ≈ 25–40 near, fading to a fine texture with distance); stars above.
// Drift →: the camera trucks right; the rows' vanishing point does not move (parallel lines), the near
// rows slide left under it.
import * as THREE from 'three';
import { RXY, POST, NIGHT_GLSL, RAY_GLSL, shared, makeView, skyUniforms, setSkyFrame, updateView, makeLines, drawCut } from './kit5.js';

const H = 60;                                  // camera height (m)
const DX = 10, DZ = 12;                          // row spacing (across), element spacing (along)
export function createDipoles(ctx, shot) {
  const { kit, util } = ctx;
  const sh = shared(ctx);
  const view = makeView(ctx, 35, { near: 1, far: 40000 });
  const U = skyUniforms(ctx, { twiAz: -4, twiCol: [0.024, 0.044, 0.090], twiW: 4.0, low: [0.012, 0.017, 0.026], keyK: 1.0, galK: 0.26, ground: [0.0010, 0.0011, 0.0014] });
  U.uCam = { value: new THREE.Vector3() };
  const sky = kit.fullscreen(NIGHT_GLSL + RAY_GLSL + /* glsl */ `
    uniform mat3 uM; uniform sampler2D uGal; uniform float uL, uB, uGalK, uKeyK, uAmbK; uniform vec3 uCam;
    void main(){
      vec3 d = rayDir(); float el = asin(clamp(d.y, -1.0, 1.0));
      vec3 col;
      if (d.y < -0.00002) {
        float tt = -uCam.y / d.y; vec3 p = uCam + d * tt;
        float fp = tt * 0.000536 / max(-d.y, 0.003);                  // ≈ metres per pixel along the ground
        float g = fbm(p.xz * 0.012, 3), g2 = fbm(p.xz * vec2(0.08, 0.03) + 3.0, 2);
        vec3 alb = vec3(0.030, 0.038, 0.032) * (0.6 + 0.8 * g) * mix(0.75 + 0.5 * g2, 1.0, clamp(fp * 0.2, 0.0, 1.0));
        // the field: mown rectangle with the array (x −270..470), rough grass outside
        float inF = smoothstep(-282.0, -270.0, p.x) * smoothstep(482.0, 470.0, p.x) * smoothstep(-235.0, -250.0, p.z) * smoothstep(-1900.0, -1700.0, p.z);
        alb *= mix(0.7, 1.15, inF);
        // the gravel service track along x = 0 (to the vanishing point)
        float fx = tt * 0.000536, w = 2.2; float tr = smoothstep(w + fx, w - fx, abs(p.x - ${(-DX / 2).toFixed(1)})) * min(1.0, 2.0 * w / max(fx, 1e-3));
        vec3 Lt = normalize(vec3(uTwiDir.x, 0.22, uTwiDir.z));
        col = alb * ((uZen + uLow * 0.6) * uAmbK + uTwiCol * uKeyK * Lt.y) + tr * vec3(0.022, 0.027, 0.036);
        // dew sheen: the grass at grazing angles mirrors the low sky (strongest towards the twilight)
        vec3 R = reflect(d, vec3(0.0, 1.0, 0.0));
        float F = 0.02 + 0.98 * pow(1.0 - (-d.y), 5.0);
        col += F * skyRad(R) * 0.30;
        // ground haze far out
        col = mix(col, skyRad(vec3(d.x, 0.01, d.z)) * 0.6, 1.0 - exp(-tt / 5000.0));
      } else {
        col = skyRad(d);
        col += galaxy(uGal, uM, d, uL, uB) * extinction(el, 0.16) * uGalK;
      }
      gl_FragColor = vec4(col, 1.0);
    }`, U);

  // ---- the array: crossed inverted-V dipoles (mast 1.7 m, four wire legs to ±1.3 m) -------------------
  const segs = [];
  const wire = [0.060, 0.074, 0.098], mast = [0.026, 0.031, 0.040];
  for (let z = -255; z > -1650; z -= DZ) {
    const half = -z;                                   // the visible half-width grows with distance
    for (let x = -270; x <= 470; x += DX) {
      if (x < -0.45 * half - 30 || x > 0.70 * half + 30) continue;
      const top = [x, 1.7, z];
      const k = Math.min(1, 300 / -z);                 // wires further away: thinner in the mean
      for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) segs.push({ a: top, b: [x + 1.3 * sx, 0.12, z + 1.3 * sz], w: 0.10 + 0.05 * k, col: wire, min: 1 });
      segs.push({ a: [x, 0, z], b: top, w: 0.12, col: mast, min: 1 });
    }
  }
  const lines = makeLines(ctx, segs.length);
  lines.set(segs);

  const T0 = shot.start, T1 = shot.end;
  const setup = t => {
    const x = -2.0 + 4.0 * util.clamp((t - T0) / (T1 - T0), -0.2, 1.2);      // → 4 m over the cut
    // camera level-ish (−9°) with the lens shifted so the vanishing point of the rows (straight ahead,
    // on the horizon) lands on R
    const P = [x, H, 0];
    const fwd = [x, H - Math.tan(9 * Math.PI / 180) * 1000, -1000];
    view.aim(P, fwd, [RXY[0], RXY[1] + Math.tan(9 * Math.PI / 180) * view.FPX]);
    updateView(U, view);
    U.uCam.value.set(...P);
    lines.setCam(view.cam);
  };
  setup((T0 + T1) / 2);
  setSkyFrame(U, view, [1200, 250], 160, 25, 3.0);
  const M = U.uM.value.clone();
  return {
    render(s, f) {
      setup(f.t);
      U.uM.value.copy(M); sh.stars.setFrame(M);
      drawCut(ctx, f, view, sh, { sky, lines });
    },
    post() { return { ...POST }; },
  };
}
