// e_earth — S14 暗地球, S18 文明, S19–S22A 发问蒙太奇 (orbital light patterns).
//
// One analytic ray-cast globe (shots/e_earth/globe.js) over the baked earth.js textures, a
// starfield, and per-shot cameras solved in the Earth frame (shots/e_earth/geo.js):
//  S14  the first frame's horizon IS anchors.arc (camera solved against the conic coefficients:
//       D = 1.31907923 R⊕, centre 45.925° below the axis, 35 mm), R_geo under R, north up, east
//       (dawn) right. The Earth then turns about the camera's nadir axis (0.5°/s), which keeps the
//       horizon conic invariant, plus a 1 % zoom. lights = 0, moonlit, airglow line on the conic
//       with the S13 light-front profile (3 px core + 30 px inward glow), twilight brightening right.
//  S18  400 km → 9000 km exponential pull-back (easeInCubic start), yaw 6°, R_geo locked on R;
//       lights born at R (cursor footprint 24×64 on f2286) spreading along the Nile and the coasts
//       (travel-time birth mask, shots/e_earth/birth.js). The birth front is driven by the altitude
//       so it stays ≈ 0.8 × the visible half-width: the spreading edge is always on screen. Lights
//       come from a nested pair of HDR night maps (nightmap.js: the wide map + a 0.8 km/texel East
//       Africa map with 3× finer sprawl) through a soft film knee (no bloom balls), and a soft radial
//       Nairobi patch (park, district mottling) for the first, lowest seconds.
//  S19–S22A  4096² regional detail patches (shots/e_earth/patches.js): Nile delta lotus (north up;
//       villages as point lights strung along the branches and canals), the Gulf of Naples necklace
//       (dark Vesuvius), Paris (warped Voronoi street mesh, ring, arterials, the Seine as a soft dark
//       band), the Rhine–Ruhr/Benelux highway web, and two squid-fishing fleet lanes off Korea composed
//       to cross the frame — sodium FISHING lamps on a black sea. Every patch is mip-mapped and
//       footprint-blended, so nothing shimmers at 14–36 frames per cut.
import * as THREE from 'three';
import { createEarth } from '../lib/earth.js';
import { ease, clamp, lerp, smoothstep } from '../lib/util.js';
import * as G from './e_earth/geo.js';
import { createGlobe } from './e_earth/globe.js';
import { buildBirth, BIRTH_RECT } from './e_earth/birth.js';
import { createPatchBank } from './e_earth/patches.js';
import { buildNightMap } from './e_earth/nightmap.js';

const FPS = 24;
const D2R = Math.PI / 180;

// S18 pull-back profile: log-distance velocity ramps in with an easeInCubic, then stays constant
function pullback(u, a = 0.3) {
  u = clamp(u, 0, 1.2);
  const Gf = x => (x < a ? a * Math.pow(x / a, 4) / 4 : a / 4 + (x - a));
  return Gf(u) / Gf(1);
}

export async function create(ctx) {
  const { THREE: T3, renderer, W, H, kit } = ctx;
  const S = H / 1080;
  const earth = await createEarth(ctx, { radius: 1 });
  const birth = buildBirth();
  console.log('[e_earth] birth probes ' + JSON.stringify(birth.probe));
  const globe = createGlobe(ctx, earth, { birthTex: birth.tex });
  globe.uniforms.birthRect.value.set(...BIRTH_RECT);
  const patches = createPatchBank(ctx);
  const night = buildNightMap(ctx);
  console.log('[e_earth] night map splats ' + night.count);
  globe.setNight(night);
  // East Africa at ~0.8 km/texel with 3× finer sprawl: what S18's climb sees between 600 and 4000 km
  const night2 = buildNightMap(ctx, { rect: [22, -16, 52, 16], res: 4096, seed: 1408, detail: 3 });
  console.log('[e_earth] fine night map splats ' + night2.count);
  // stars (only seen in S14 / S18 above the limb)
  const scene = new THREE.Scene();
  const stars = kit.starfield({ count: 26000, seed: 1407, radius: 1000, H, brightness: 0.75, sizeScale: 0.85, warm: 0.35 });
  scene.add(stars);
  const cam = kit.filmCamera(W, H, { focalMM: 35, near: 0.5, far: 5000 });
  const U = globe.uniforms;
  const g = G.lonLatDir(...G.R_GEO);
  const Rpx = [734 * S, 540 * S];

  // ---------------- S14 ----------------
  const s14 = G.solveS14(W, H, 35);
  // moon (upper right): place its soft glint on the Indian Ocean right of Africa
  const moonFor = (pose, gx, gy) => {
    const rd = G.worldRay(pose, W, H, gx * S, gy * S);
    const p = G.hitSphere(pose.pos, rd) || g.clone();
    const n = p.clone().normalize(), v = rd.clone().negate();
    return n.clone().multiplyScalar(2 * n.dot(v)).sub(v).normalize();
  };
  const s14Moon = moonFor(s14, 1480, 800);
  // sun: just below the eastern (right) horizon, so the twilight ring is beyond the arc's right end
  const s14Sun = G.travel(g, 80 * D2R, 140 * D2R);

  // ---------------- S18 ----------------
  // The camera climbs out to the SSE of R_geo and looks back north over Africa, local north turned
  // ~20° towards screen upper-right (yaw 6° over the shot): the Nile runs from R up to the delta, the
  // Levant, Anatolia and the Aegean crowd the limb at the top, Arabia / the Gulf / Iran fill the right.
  // (At 9000 km a nadir view cannot hold both R_geo at R and the Mediterranean inside the 804 px band.)
  const s18Pose = (t) => {
    const u = (t - 95.0) / 12.0;
    const k = pullback(u);
    const alt = 400 * Math.pow(9000 / 400, k);
    const sub = lerp(0.4, 21.0, Math.pow(k, 1.3));                 // camera drifts SE as it climbs (horizon enters at the top)
    const az = 155 + 6 * clamp(u, 0, 1.1);                          // yaw 6° over the shot
    const s = G.travel(g, az * D2R, sub * D2R);
    const pos = s.clone().multiplyScalar(1 + alt / G.R_EARTH_KM);
    const up = G.enu(g).north.clone().applyAxisAngle(g, (16 + 6 * clamp(u, 0, 1.1)) * D2R);
    return G.aim(pos, g, Rpx[0], Rpx[1], W, H, 35, up);
  };
  // sun: just below the dawn terminator a few degrees beyond the right edge of the final frame
  const s18Sun = (() => {
    const pe = s18Pose(107.0);
    let q = null;      // the disc's right-most surface point on row 700
    for (let x = 1919; x > 900 && !q; x -= 4) q = G.hitSphere(pe.pos, G.worldRay(pe, W, H, (x - 30) * S, 700 * S));
    q = q || g.clone();
    const tq = q.clone().multiplyScalar(q.dot(g)).sub(g).normalize();
    const dl = 2.5 * D2R;
    return q.clone().multiplyScalar(-Math.sin(dl)).addScaledVector(tq, Math.cos(dl)).normalize();
  })();
  const s18Moon = G.lonLatDir(25, 12);

  // ---------------- montage cameras ----------------
  // nadir/oblique camera over a ground target: tilt from nadir (deg), view heading (deg from north),
  // altitude (km), screen-up heading for nadir shots.
  const groundCam = ({ lon, lat, altKm, focal, tilt = 0, heading = 0, upAz = 0 }) => {
    const tgt = G.lonLatDir(lon, lat);
    const { east, north, up } = G.enu(tgt);
    const hdir = north.clone().multiplyScalar(Math.cos(heading * D2R)).addScaledVector(east, Math.sin(heading * D2R));
    const slant = altKm / Math.cos(tilt * D2R) / G.R_EARTH_KM;
    const pos = tgt.clone().addScaledVector(up, slant * Math.cos(tilt * D2R)).addScaledVector(hdir, -slant * Math.sin(tilt * D2R));
    const upHint = tilt > 1 ? up.clone() : north.clone().multiplyScalar(Math.cos(upAz * D2R)).addScaledVector(east, Math.sin(upAz * D2R));
    return G.aim(pos, tgt, W / 2, H / 2, W, H, focal, upHint);
  };
  // linear drift of the ground target (km/s east, km/s north)
  const drift = (lon, lat, eKm, nKm) => {
    const d = G.lonLatDir(lon, lat); const { east, north } = G.enu(d);
    const p = d.clone().addScaledVector(east, eKm / G.R_EARTH_KM).addScaledVector(north, nKm / G.R_EARTH_KM).normalize();
    return G.dirLonLat(p);
  };
  const MONTAGE = {
    // S19 Nile delta: vertical, north UP (polish note 3) — the lotus: Cairo and the stem at the bottom of
    // the band, the fan of lit branches opening upward to the coast at the top; 1050 km so the whole
    // 160 km apex-to-coast height fits the 804 px band; drifting east
    S19: lt => { const [lon, lat] = drift(31.05, 30.72, 7 * lt, 0); return { pose: groundCam({ lon, lat, altKm: 1050, focal: 85, upAz: 0 }), patch: 'delta' }; },
    // S20 Gulf of Naples necklace: oblique, looking NW across the bay, drifting back along the coast
    S20: lt => { const [lon, lat] = drift(14.30, 40.80, -3.2 * lt, 1.4 * lt); return { pose: groundCam({ lon, lat, altKm: 260, focal: 85, tilt: 40, heading: 340 }), patch: 'naples' }; },
    // S21 Paris: 135 mm vertical; radial arterials, LED core, sodium rings
    S21: lt => { const [lon, lat] = drift(2.36, 48.865, 1.3 * lt, -0.4 * lt); return { pose: groundCam({ lon, lat, altKm: 210, focal: 135, upAz: 8 + 0.6 * lt }), patch: 'paris' }; },
    // S22 the Rhine–Ruhr / Benelux highway web, oblique 30°
    S22: lt => { const [lon, lat] = drift(6.2, 51.05, -9 * lt, 0); return { pose: groundCam({ lon, lat, altKm: 470, focal: 85, tilt: 30, heading: 20 }), patch: 'europe' }; },
    // S22A squid fleet in the East Sea, looking west to the Korean coast
    S22A: lt => { const [lon, lat] = drift(129.86, 36.22, 0, 6 * lt); return { pose: groundCam({ lon, lat, altKm: 330, focal: 85, tilt: 35, heading: 252 }), patch: 'fishing' }; },
  };
  // S22A: put the moon where its glint lands on the open sea in the upper middle of the frame
  const fishMoon = (() => { const p = MONTAGE.S22A(0).pose; return moonFor(p, 1060, 300); })();

  // shared defaults per frame
  function base() {
    U.dayGain.value = 0; U.moonGain.value = 0; U.lightsGain.value = 1; U.cloudsGain.value = 1; U.glowGain.value = 0.6;
    U.nightLand.value = 0.012; U.atmoGain.value = 1; U.airglowGain.value = 0.4; U.conicOn.value = 0; U.birthOn.value = 0;
    U.dimAmt.value = 1; U.clearAmt.value = 0; U.lightsKnee.value = 1.6; U.cloudDetail.value = 0; U.glintSlick.value = 0; U.sparkOn.value = 0; U.cloudShift.value = 0; U.termGain.value = 1; U.airglowSig.value = 0.0022; U.glintExp.value = 260; U.glintBroad.value = 0.18;
    globe.setPatch(null); globe.clearSprites(); globe.setNight2(null);
  }

  return {
    render(shot, f) {
      const t = f.t, lt = f.lt;
      base();
      let pose;
      if (shot.id === 'S14') {
        // drift along the horizon: the Earth turns about the camera's nadir axis (keeps the conic exact)
        const ang = -0.5 * D2R * lt;
        pose = G.rotatePose(s14, s14.pos, ang, new THREE.Vector3(0, 0, 0));
        pose.focalMM = 35 * (1 + 0.01 * clamp(lt / 6, 0, 1.2));
        // equivalently rotate the lights with it (sun / moon are fixed to the camera's sky)
        const q = new THREE.Quaternion().setFromAxisAngle(s14.pos.clone().normalize(), ang);
        U.sunDir.value.copy(s14Sun).applyQuaternion(q); U.moonDir.value.copy(s14Moon).applyQuaternion(q);
        U.lightsGain.value = 0; U.moonGain.value = 0.32; U.nightLand.value = 0.004; U.glintExp.value = 140; U.glintBroad.value = 0.08;
        U.cloudsGain.value = 1.0; U.cloudShift.value = 0.00004 * lt; U.cloudDetail.value = 0.8;
        U.conicOn.value = 1; U.conicCore.value = 1.25; U.conicGlow.value = 0.075; U.conicOut.value = 0.25; U.twGain.value = 0.5;
        U.atmoGain.value = 0.0; U.airglowGain.value = 0.6;
        stars.material.uniforms.brightness.value = 1.6;
      } else if (shot.id === 'S18') {
        pose = s18Pose(t);
        U.sunDir.value.copy(s18Sun); U.moonDir.value.copy(s18Moon);
        U.dayGain.value = 1; U.moonGain.value = 0.12; U.cloudShift.value = 0.00003 * lt; U.lightsGain.value = 2.6; U.lightsKnee.value = 1.4;
        U.birthOn.value = 1; U.sparkOn.value = 1; globe.setNight2(night2); U.cloudDetail.value = 0.5;
        // a clear night over the Rift: clouds thin out within ~6–16° of R_geo
        U.clearDir.value.copy(g); U.clearCos.value.set(Math.cos(6 * D2R), Math.cos(16 * D2R)); U.clearAmt.value = 1;
        // the birth front tracks the frame: its radius stays ≈ 0.8 × the visible ground half-width
        // (birth time 1.0 ≈ 3300 km of easy ground near R), after a 2.2 s start in which Nairobi and
        // the highlands around it light up from the first lamp. It runs faster along the Nile and the
        // coasts (birth.js), so the Nile thread shoots ahead to the top of the frame; by the last
        // second everything on the visible hemisphere is lit (τ ≈ 1.12 at 9000 km).
        const tb = 95.25;
        const altNow = (pose.pos.length() - 1) * G.R_EARTH_KM;
        const ramp = Math.pow(smoothstep(tb, tb + 2.2, t), 1.5);
        U.birthTau.value = t < tb ? -1 : 1.246e-4 * altNow * ramp + 0.0012;
        U.birthSoft.value = 0.006;
        U.airglowGain.value = 0.22; U.airglowSig.value = 0.0012; U.termGain.value = 0.35; U.glowGain.value = 0.05; U.nightLand.value = 0.006;
        const altKm = (pose.pos.length() - 1) * G.R_EARTH_KM;
        if (altKm < 4000) globe.setPatch(patches.get('nairobi'));
        // the first lamp: footprint rectangle on its very first frame, then a round point light
        const fr = Math.round(t * FPS);
        if (fr === 2286) globe.sprite(0, Rpx[0], Rpx[1], 0, [2.3, 1.85, 1.35], 1);
        else if (fr > 2286) {
          const k = clamp((t - 95.3) / 3.0, 0, 1);
          const I = lerp(2.2, 0.0, ease.inOutSine(k));
          if (I > 0) globe.sprite(0, Rpx[0], Rpx[1], (2.2 + 1.2 * (1 - k)) * S, [I * 1.0, I * 0.78, I * 0.52], 0);
        }
        stars.material.uniforms.brightness.value = 1.3;
      } else {
        const m = (MONTAGE[shot.id] || MONTAGE.S19)(lt);
        pose = m.pose;
        if (m.patch) globe.setPatch(patches.get(m.patch));
        // local midnight under every montage camera (sun at the antipode of its sub-point)
        U.sunDir.value.copy(pose.pos).normalize().negate();
        U.moonDir.value.copy(shot.id === 'S22A' ? fishMoon : G.lonLatDir(-60, 10));
        U.moonGain.value = 0.12; U.nightLand.value = 0.008;
        // no clouds: a 10 km/texel cloud map magnified 50–100× only reads as murk at these altitudes
        U.cloudsGain.value = 0.0;
        // S22A (polish note 1): sodium on a BLACK sea — the moonlit, wind-slicked sea read ~5× brighter than
        // its neighbours; moonlight cut by 4 stops (only a faint smooth sheen survives), no slick texture
        if (shot.id === 'S22A') { U.glintExp.value = 260; U.glintBroad.value = 0.04; U.moonGain.value = 0.11 / 16; U.glintSlick.value = 0; }
        U.glowGain.value = 0.06;
        U.airglowGain.value = 0.4;
        // the montage keeps its highlights; S22A's boats are knee'd low so the cores stay FISHING yellow (no white clip)
        U.lightsKnee.value = shot.id === 'S22A' ? 2.0 : 3.0;
      }
      globe.setPose(pose);
      G.applyPose(cam, pose);
      renderer.setRenderTarget(f.target);
      renderer.render(scene, cam);
      globe.render(renderer, f.target);
    },
    post(shot, f) {
      if (shot.id === 'S14') return { streak: 0.18, bloom: 0.7, vignette: 0.24 };
      if (shot.id === 'S18') return { streak: 0.05, bloom: 0.55, vignette: 0.22 };
      return { streak: 0.08, bloom: 0.85, vignette: 0.24, contrast: 1.04, exposure: shot.id === 'S19' ? 1.5 : 1.0 };   // S19: the point-light delta carries less flux than the old blobs
    },
    _debug: { birth, s14 },
  };
}
