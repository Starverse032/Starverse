// e_final — S40 问题升空 (03:39.00 → 03:48.12).
//
// The same analytic ray-cast globe as e_earth (shots/e_earth/globe.js) over the regional HDR night
// map, in the oblique geometry the screenplay asks for (risk ②, jury note D1):
//   the camera's sub-point sits 38° south-west of R_geo at 9000 km; R_geo (Nairobi, the first fire's
//   ground point) is aimed exactly onto R = (734, 540) every frame, north up. The Earth then fills the
//   lower left, its limb (airglow line) passing just up-right of R, and a thin dawn crescent lies on
//   the right part of the limb (the sun is behind the planet, a little to screen-right).
//   219.0–220.0  still: one warm city at R.
//   220.0        ONE light (RISING #FFF1DC, HDR 2) leaves R along the local vertical, h = ½·a·τ²,
//                a = 290 km/s²; local up has a large up-right screen component, so it visibly climbs,
//                crosses the airglow line and enters the stars. Its brightness never drops.
//   224.0        exponential pull-back along the sub-point radial: k ramps 0.03 → 1.6 /s over 1 s
//                (smoothstep), then constant. R_geo stays locked on R, so the disc and the light both
//                contract onto R; at 228.0 the disc radius is ≈ 2.5 px.
//   228.0–228.5  disc and question merge into one warm-white point at R (CURSOR #F2EEE4, HDR 2.5).
//   228.5        hard cut to black on the cursor's off-phase (engine cut; nothing to do here).
//   Card ⑤ 224.0–227.5: lights × 0.5 inside the card's box while it is up.
import * as THREE from 'three';
import { createEarth } from '../lib/earth.js';
import { clamp, smoothstep } from '../lib/util.js';
import * as G from './e_earth/geo.js';
import { createGlobe } from './e_earth/globe.js';
import { buildNightMap } from './e_earth/nightmap.js';

const D2R = Math.PI / 180;
const T0 = 219.0, T_RISE = 220.0, T_PULL = 224.0, T_MERGE = 228.0;
const ALT0 = 9000, A_RISE = 290;          // km, km/s²
const K0 = 0.03, KMAX = 1.6;               // pull-back rates (1/s)

// ln(D/D0) as an analytic function of t: slow drift, then k ramps (smoothstep over 1 s) to KMAX
function lnPull(t) {
  let s = K0 * Math.max(0, t - T0);
  if (t > T_PULL) {
    const u = Math.min(1, t - T_PULL);
    s += (KMAX - K0) * (u * u * u - u * u * u * u / 2);         // ∫ smoothstep
    if (t > T_PULL + 1) s += (KMAX - K0) * (t - T_PULL - 1);
  }
  return s;
}

export async function create(ctx) {
  const { renderer, W, H, kit } = ctx;
  const S = H / 1080;
  const earth = await createEarth(ctx, { radius: 1 });
  const globe = createGlobe(ctx, earth, {});
  const night = buildNightMap(ctx);
  globe.setNight(night);
  const U = globe.uniforms;
  const scene = new THREE.Scene();
  const stars = kit.starfield({ count: 30000, seed: 4019, radius: 1000, H, brightness: 1.5, sizeScale: 1.0, warm: 0.35 });
  scene.add(stars);
  const cam = kit.filmCamera(W, H, { focalMM: 35, near: 0.5, far: 5000 });

  const g = G.lonLatDir(...G.R_GEO);
  const north = G.enu(g).north;
  const sub = G.travel(g, 225 * D2R, 38 * D2R);                    // sub-point 38° SW of R_geo
  const D0 = 1 + ALT0 / G.R_EARTH_KM;
  const R = [734 * S, 540 * S];
  const poseAt = t => G.aim(sub.clone().multiplyScalar(D0 * Math.exp(lnPull(t))), g, R[0], R[1], W, H, 35, north);
  // sun: behind the planet, rotated ~22° towards screen-right (and a little down) → thin dawn crescent
  const p0 = poseAt(T0);
  const back = sub.clone().negate();
  const sunDir = back.clone().multiplyScalar(Math.cos(13 * D2R))
    .addScaledVector(p0.cols[0].clone().multiplyScalar(0.94).addScaledVector(p0.cols[1], -0.34).normalize(), Math.sin(13 * D2R)).normalize();
  const moonDir = G.lonLatDir(-10, 25);
  // the rising light: world position at time t
  const lightPos = t => {
    const tau = Math.max(0, t - T_RISE);
    const h = 0.5 * A_RISE * tau * tau;
    return g.clone().multiplyScalar(1 + h / G.R_EARTH_KM);
  };
  // card ⑤ box (cinema_lower: centre y = 942 − 0.2·804 ≈ 781), in pixels
  const card = { x0: 960 - 300, y0: 700, x1: 960 + 300, y1: 840 };
  const CUR = [0.888, 0.855, 0.776];                                // #F2EEE4 (linear)
  const RIS = [1.0, 0.879, 0.723];                                  // #FFF1DC (linear)

  return {
    msaa: false,
    render(shot, f) {
      const t = f.t;
      const pose = poseAt(t);
      globe.setPose(pose); G.applyPose(cam, pose);
      stars.position.copy(pose.pos); stars.updateMatrixWorld(true);     // sky at infinity (no parallax in the pull-back)
      // ---- globe look: night hemisphere fully lit, city-lit cloud bellies, thin airglow, dawn crescent
      U.sunDir.value.copy(sunDir); U.moonDir.value.copy(moonDir);
      U.dayGain.value = 1; U.moonGain.value = 0.1; U.nightLand.value = 0.006;
      U.lightsGain.value = 1.5; U.cloudsGain.value = 1; U.cloudShift.value = 0.00002 * (t - T0); U.glowGain.value = 0.12;
      U.atmoGain.value = 1; U.airglowGain.value = 0.3; U.airglowSig.value = 0.0012; U.termGain.value = 0.5;
      U.conicOn.value = 0; U.birthOn.value = 0; U.patchOn.value = 0;
      // card legibility: lights in the card box × 0.5 while the card is up (fades with the card)
      const cardA = smoothstep(224.0, 224.75, t) * (1 - smoothstep(226.75, 227.5, t));
      U.dimRect.value.set(card.x0 * S, card.y0 * S, card.x1 * S, card.y1 * S);
      U.dimAmt.value = 1 - 0.5 * cardA;
      // ---- merge: the planet and its question fade into one warm-white point at R
      const m = smoothstep(T_MERGE - 0.3, T_MERGE + 0.15, t);
      U.lightsGain.value *= 1 - m; U.dayGain.value *= 1 - m; U.moonGain.value *= 1 - m; U.atmoGain.value *= 1 - m; U.airglowGain.value *= 1 - m;
      globe.clearSprites();
      if (t >= T_RISE) {
        const [x, y, z] = G.project(pose, W, H, lightPos(t));
        if (z > 0) {
          const I = 2.0 * (1 - m);
          globe.sprite(0, x, y, 2.4 * S, [RIS[0] * I, RIS[1] * I, RIS[2] * I], 0);
        }
      }
      // the city at R: one warm point (CITY #FFC37A) that the question leaves from
      { const I = 0.9 * (1 - m); globe.sprite(2, R[0], R[1], 2.6 * S, [1.0 * I, 0.546 * I, 0.195 * I], 0); }
      if (m > 0) {
        const I = 2.5 * m;
        globe.sprite(1, R[0], R[1], 2.2 * S, [CUR[0] * I, CUR[1] * I, CUR[2] * I], 0);
      }
      stars.material.uniforms.brightness.value = 1.5;
      renderer.setRenderTarget(f.target);
      renderer.render(scene, cam);
      globe.render(renderer, f.target);
    },
    post(shot, f) {
      return { bloom: 0.8, streak: 0.12, vignette: 0.22 };
    },
    _debug: { poseAt, lightPos },
  };
}
