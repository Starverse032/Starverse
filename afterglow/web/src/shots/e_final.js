// e_final — S40 问题升空 · 仍在问 (S10-b, f5256–5471, 219.0 → 228.0 s). 35 mm.
//
// The analytic ray-cast globe (e_final/globe.js, a private copy of e_earth's) over the regional HDR night
// map, in the screenplay's oblique geometry: the camera's sub-point lies 38° south-west of R_geo
// (Nairobi — the first fire's ground point) at 9000 km, aimed so that R_geo sits exactly on R = (734, 540),
// north up. The Earth fills the lower left; its limb and the airglow line pass up-right of R; the sun is
// behind the planet, a little to screen-right, leaving a thin dawn crescent on the right (east) limb:
// modern deep night, not S02's evening. No anchors other than R / R_geo are read (anchors.arc is gone).
//   f5256–5279  still: one warm light at R (the city).
//   f5280       ONE light (RISING #FFF1DC, HDR 2) leaves R along the local vertical, h = ½·a·τ²; on screen
//               an arc up-right, faster and faster; it crosses the airglow line on f5340 and enters the
//               stars. Its brightness never drops in this shot (a flat-topped disc: constant peak).
//   f5352       exponential pull-back: k ramps to 1.6 /s over 1 s (smoothstep), then constant. The camera
//               retreats along its own line of sight to R_geo with a FIXED orientation (a true dolly-out):
//               R_geo stays on R, the Earth contracts onto R, the light's offset contracts with it (it
//               stays 12–110 px clear of the limb until f5418), and the stars do not move at all.
//   f5436–5447  the planet and its question merge into one point at R: CURSOR #F2EEE4, HDR 2.5, a 4×4 px
//               flat disc on R's pixels (x 732–735, y 538–541) — the cursor's colour and level.
//   f5448–5459  the point is lit — exactly one on-phase of the heartbeat grid.
//   f5460       it goes out on the off-phase, like the cursor: the module draws black to f5471.
//   Card ⑤ [5352, 5436): city lights × 0.5 inside the card box while it is up (fading with the card);
//               the limb / dawn crescent sweeping through the box are soft-limited there as well.
// Background stars: a static field (fixed camera orientation), 0.95 HDR at most, nothing flashes, no
// new signal arrives — the light is the only moving point.
import * as THREE from 'three';
import { createEarth } from '../lib/earth.js';
import { smoothstep } from '../lib/util.js';
import * as G from './e_earth/geo.js';
import { createGlobe } from './e_final/globe.js';
import { buildNightMap } from './e_earth/nightmap.js';

const D2R = Math.PI / 180;
const ALT0 = 9000;                         // km, camera altitude at f5256
const K0 = 0.03;                           // the near-still drift before the pull-back (1/s)

export async function create(ctx) {
  const { renderer, W, H, kit, timeline } = ctx;
  const S = H / 1080;
  const shot = timeline.shots.find(s => s.module === 'e_final') || { frames: [5256, 5472], params: {} };
  const P = shot.params || {};
  const FPS = timeline.fps || 24;
  const [F0] = shot.frames;
  const T0 = F0 / FPS;                                          // 219.0
  const T_RISE = P.riseStart ?? 220.0;                          // f5280
  const T_PULL = P.pullbackStart ?? 223.0;                      // f5352
  const KMAX = P.kMax ?? 1.6;
  const A_RISE = P.riseAccelKmS2 ?? 290;                        // km/s²
  const MERGE = P.merge || [5436, 5460];
  const T_M0 = MERGE[0] / FPS, T_M1 = (MERGE[0] + 12) / FPS;    // 226.5 → 227.0 merge
  const T_BLACK = (P.blackFrom ?? 5460) / FPS;                  // 227.5
  const card = timeline.cards.find(c => c.shot === shot.id) || { frames: [5352, 5436], fadeIn: 0.75, fadeOut: 0.75, pos: [960, 781] };
  const C0 = card.frames[0] / FPS, C1 = card.frames[1] / FPS;

  // ln(distance / distance0) as an analytic function of t: slow drift, then k ramps (smoothstep, 1 s) to KMAX
  const lnPull = t => {
    let s = K0 * Math.max(0, t - T0);
    if (t > T_PULL) {
      const u = Math.min(1, t - T_PULL);
      s += (KMAX - K0) * (u * u * u - u * u * u * u / 2);       // ∫ smoothstep
      if (t > T_PULL + 1) s += (KMAX - K0) * (t - T_PULL - 1);
    }
    return s;
  };
  const clearBlack = target => {
    const cc = new THREE.Color(); renderer.getClearColor(cc); const ca = renderer.getClearAlpha();
    renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.setClearColor(cc, ca);
  };
  const postAt = t => (t >= T_BLACK ? { bloom: 0, streak: 0, grain: 0, fade: 1 } : { bloom: 0.75, streak: 0.15, vignette: 0.22, grain: 0.028 });

  // E4: build the planet only when this block renders S40 (post() needs none of it)
  if (ctx.shotInRange && !ctx.shotInRange(shot, 0.5)) {
    return { render(s, f) { clearBlack(f.target); }, post: (s, f) => postAt(f.t) };
  }

  const earth = await createEarth(ctx, { radius: 1 });
  const globe = createGlobe(ctx, earth, {});
  globe.setNight(buildNightMap(ctx));
  const U = globe.uniforms;
  const scene = new THREE.Scene();
  const stars = kit.starfield({ count: 30000, seed: 4019, radius: 1000, H, brightness: 1.5, sizeScale: 1.0, warm: 0.35 });
  scene.add(stars);
  const cam = kit.filmCamera(W, H, { focalMM: 35, near: 0.5, far: 5000 });

  const R_GEO = P.R_geo || G.R_GEO;
  const g = G.lonLatDir(R_GEO[0], R_GEO[1]);
  const north = G.enu(g).north;
  const sub = G.travel(g, 225 * D2R, (P.subPointOffsetDeg ?? 38) * D2R);   // sub-point 38° SW of R_geo
  const R = [timeline.anchors.R[0] * S, timeline.anchors.R[1] * S];
  const c0 = sub.clone().multiplyScalar(1 + ALT0 / G.R_EARTH_KM);
  const p0 = G.aim(c0, g, R[0], R[1], W, H, 35, north);
  const back = c0.clone().sub(g);                                // R_geo → camera (dolly-out axis)
  const poseAt = t => ({ pos: g.clone().addScaledVector(back, Math.exp(lnPull(t))), cols: p0.cols.map(c => c.clone()), focalMM: 35 });
  // sun: behind the planet, rotated ~13° towards screen-right (and a little down) → thin dawn crescent (east)
  const behind = sub.clone().negate();
  const sunDir = behind.clone().multiplyScalar(Math.cos(13 * D2R))
    .addScaledVector(p0.cols[0].clone().multiplyScalar(0.94).addScaledVector(p0.cols[1], -0.34).normalize(), Math.sin(13 * D2R)).normalize();
  const moonDir = G.lonLatDir(-10, 25);
  const lightPos = t => {
    const tau = Math.max(0, t - T_RISE);
    return g.clone().multiplyScalar(1 + 0.5 * A_RISE * tau * tau / G.R_EARTH_KM);
  };
  // card ⑤ box (cinema_lower, centre (960, 781); visual-changes §1.4: x 600–1320, y 735–830)
  const box = { x0: 600, y0: 728, x1: 1320, y1: 838 };
  const CUR = [0.888, 0.855, 0.776];                             // #F2EEE4 (linear)
  const RIS = [1.0, 0.879, 0.723];                               // #FFF1DC (linear)
  const CITY = [1.0, 0.546, 0.195];                              // #FFC37A (linear)
  // stars: the camera never turns, so the field is placed once
  G.applyPose(cam, p0);
  stars.position.copy(p0.pos); stars.updateMatrixWorld(true);
  stars.material.uniforms.brightness.value = 0.95;

  return {
    msaa: false,
    render(sh, f) {
      const t = f.t;
      renderer.setRenderTarget(f.target);
      if (t >= T_BLACK) { clearBlack(f.target); return; }
      const pose = poseAt(t);
      globe.setPose(pose);
      // ---- night hemisphere fully lit, city-lit cloud bellies, thin airglow, dawn crescent
      U.sunDir.value.copy(sunDir); U.moonDir.value.copy(moonDir);
      U.dayGain.value = 1; U.moonGain.value = 0.1; U.nightLand.value = 0.006;
      U.lightsGain.value = 1.5; U.cloudsGain.value = 1; U.cloudShift.value = 0.00002 * (t - T0); U.glowGain.value = 0.16;
      U.atmoGain.value = 1; U.airglowGain.value = 0.3; U.airglowSig.value = 0.0012; U.termGain.value = 0.5;
      U.conicOn.value = 0; U.birthOn.value = 0; U.patchOn.value = 0; U.cloudDetail.value = 0.5;
      // card legibility: lights in the card box × 0.5 while the card is up (follows its fades)
      const cardA = smoothstep(C0, C0 + card.fadeIn, t) * (1 - smoothstep(C1 - card.fadeOut, C1, t));
      U.dimRect.value.set(box.x0 * S, box.y0 * S, box.x1 * S, box.y1 * S);
      U.dimAmt.value = 1 - 0.5 * cardA;
      // the pull-back sweeps the HDR limb / dawn crescent and some stars through the box: soft-limit them
      // there (led in a little ahead of the card's own fade so no bright arc is ever under the text)
      U.dimHi.value = smoothstep(C0 - 0.2, C0 + 0.5, t) * (1 - smoothstep(C1 - 0.6, C1 + 0.1, t));
      U.dimCap.value = 0.015; U.dimStar.value = 0.08;
      // ---- merge: the planet and its question become one point at R
      const m = smoothstep(T_M0, T_M1, t);
      U.lightsGain.value *= 1 - m; U.dayGain.value *= 1 - m; U.moonGain.value *= 1 - m; U.atmoGain.value *= 1 - m; U.airglowGain.value *= 1 - m;
      globe.clearSprites();
      // the city at R: one warm point that the question leaves from
      { const I = 1.0 * (1 - m); globe.sprite(2, R[0], R[1], 1.6 * S, [CITY[0] * I, CITY[1] * I, CITY[2] * I], 2); }
      if (t >= T_RISE && m < 1) {
        let [x, y, z] = G.project(pose, W, H, lightPos(t));
        if (z > 0) {
          x += (R[0] - x) * m; y += (R[1] - y) * m;               // drawn into the point as they merge
          const I = 2.0 * (1 - m);
          globe.sprite(0, x, y, 1.6 * S, [RIS[0] * I, RIS[1] * I, RIS[2] * I], 2);
        }
      }
      if (m > 0) { const I = 2.5 * m; globe.sprite(1, R[0], R[1], 2.0 * S, [CUR[0] * I, CUR[1] * I, CUR[2] * I], 2); }
      renderer.render(scene, cam);
      globe.render(renderer, f.target);
    },
    post(sh, f) { return postAt(f.t); },
    _debug: { poseAt, lightPos },
  };
}
