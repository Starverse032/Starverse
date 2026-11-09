// b_flight — long take B (S06 + S07, f2928–3863): the question leaves the Earth as a beam of words,
// overtakes Voyager 1, looks back, and the Earth becomes the blue dot. One camera, no cut:
//   B1 [2928, 3336)  S06-a … S06-d, S07-a (first part)      enters on the amber flash's decay (engine)
//   B2 [3336, 3864)  S07-a (end), S07-b, S07-c, S07-d       handoff inside this module (same functions)
// The lens is one pure function of the frame number (b_flight/path.js):
//   S06–S07-a  35 mm, beside and above the beam, a shift lens: the beam runs from the root (330, 880)
//              to the vanishing point (1500, 330) at a fixed 25° while the lens travels parallel to it.
//   S07-b      overtakes the probe on its right/upper side; the view turns 0 → 170° left (easeInOutSine,
//              8 s), pitch dips −4° and returns; 35 → 24 mm over f3360–3400 while the probe grows
//              +0.65 %/frame net (the lens speeds up — it reads "closer", never "pull back").
//   S07-c/d    24 mm, looking back: the Earth on R shrinks 64 → 4 px; two planets recede at the sides;
//              f3780 the blue dot (w_sea/handoff.js layer from then on, the same pixels as S34).
// Sun fixed in the world at yaw +125°, elevation +30°; never in frame. Files:
//   b_flight/path.js (camera, probe, stream, Earth, schedules), b_flight/words.js (the beam and its
//   words), b_flight/voyager.js (the probe), b_flight/far.js (stars, Earth after the turn, planets,
//   blue dot copy, the record's glint).
import * as THREE from 'three';
import * as P from './b_flight/path.js';
import { createWords, heroState, readingHole } from './b_flight/words.js';
import { createFar, glintEnv } from './b_flight/far.js';
import { createHandoffLayer, handoffPost } from './w_sea/handoff.js';

const T = n => n / P.FPS;
const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// post: a pure function of the frame (also evaluated by the engine without render state)
export function flightPost(n) {
  if (n >= P.BLUE_DOT_FROM) return { ...handoffPost(n) };
  const bloom = P.lerp(0.55, 0.42, P.sstep(3200, 3380, n)) * (1 - P.sstep(3752, 3778, n));
  const streak = 0.06 * (1 - P.sstep(3300, 3380, n));
  return { bloom, bloomThreshold: 1.0, bloomKnee: 0.6, streak, streakTint: [1.0, 0.8, 0.6] };
}

export async function create(ctx) {
  const { renderer, W, H, kit } = ctx;
  const S = H / 1080;
  const sh = id => ctx.timeline.shots.find(s => s.id === id);
  const B1 = sh('B1'), B2 = sh('B2');
  const any = ctx.shotInRange(B1, 0.5) || ctx.shotInRange(B2, 0.5);
  const post = (shot, f) => flightPost(f.t * P.FPS);
  if (!any) return { render() {}, post, msaa: true };
  const t0 = performance.now();
  const R = (a, b) => ctx.inRange(T(a), T(b), 0.3);
  const needStream = R(2928, 3430), needHeroes = R(2990, 3218), needProbe = R(3150, 3820);
  const needNearEarth = R(2928, 2990), needFarEarth = R(3440, 3780);
  const needPlanets = R(3576, 3720), needDot = R(3740, 3864), needHand = R(3780, 3864);

  // ---- the lens ---------------------------------------------------------------------------------------
  const cam = kit.filmCamera(W, H, { focalMM: 35, near: 0.05, far: 4000 });
  cam.rotation.order = 'YXZ';
  const camP = cam.clone(); camP.rotation.order = 'YXZ';
  const farCam = kit.filmCamera(W, H, { focalMM: 24, near: 0.3, far: 6000 }); farCam.rotation.order = 'YXZ';
  const setLens = (c, n) => {
    const L = P.lens(n);
    c.setFocalLength(L.F * 18 / 960);
    c.setViewOffset(W, H, (960 - L.ppx) * S, (540 - L.ppy) * S, W, H);
    c.rotation.set(L.pitch * P.D2R, L.yaw * P.D2R, 0);
    c.position.set(0, 0, 0);
    c.updateProjectionMatrix(); c.updateMatrixWorld(); c.matrixWorldInverse.copy(c.matrixWorld).invert();
    return L;
  };
  const PV = new THREE.Matrix4(), PVp = new THREE.Matrix4();
  const pvOf = (c, out) => out.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);

  // ---- parts --------------------------------------------------------------------------------------------
  const words = (needStream || needHeroes) ? await createWords(ctx, { lensCam: cam, needStream, needHeroes }) : null;
  let earth = null;
  if (needNearEarth || needFarEarth) { const { createEarth } = await import('../lib/earth.js'); earth = await createEarth(ctx, { radius: 1 }); }
  const far = await createFar(ctx, { needStars: true, needEarthFar: needFarEarth, earth, needPlanets, needDot });
  let probe = null, probeScene = null;
  if (needProbe) {
    const { createVoyager, RIM } = await import('./b_flight/voyager.js');
    // attitude: dish axis towards the Earth, turned 35° to the left and 10° down (we see the bus behind
    // the dish in S07-a, the dish's back in S07-c); the record panel faces the lens at f3456
    const att = new THREE.Quaternion().setFromEuler(new THREE.Euler(10 * P.D2R, -35 * P.D2R, 0, 'YXZ'));
    const toward = new THREE.Vector3(...P.probeRel(P.GLINT_FRAME)).negate().normalize().applyQuaternion(att.clone().invert());
    probe = await createVoyager(ctx, { attitude: att, recordToward: toward }); probe.RIM = RIM;
    probeScene = new THREE.Scene(); probeScene.add(probe.root);
  }
  const hand = needHand ? createHandoffLayer(ctx) : null;

  // ---- the near Earth of S06-a (metres; the root of the beam on its night limb) --------------------------
  let nearScene = null;
  const NE = P.nearEarth();
  const qNear = new THREE.Quaternion(), qFar = new THREE.Quaternion();
  if (earth) {
    const orient = (outward, upHint) => {
      const g = earth.lonLatToLocal(36.8, -1.3, 1).normalize();
      const lo = 36.8 * P.D2R, la = -1.3 * P.D2R;
      const nl = new THREE.Vector3(-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo)).normalize();
      const e = new THREE.Vector3().crossVectors(nl, g).normalize(); const nlo = new THREE.Vector3().crossVectors(g, e);
      const want = upHint.clone().addScaledVector(outward, -upHint.dot(outward)).normalize();
      const mL = new THREE.Matrix4().makeBasis(g, nlo, new THREE.Vector3().crossVectors(g, nlo));
      const mW = new THREE.Matrix4().makeBasis(outward, want, new THREE.Vector3().crossVectors(outward, want));
      return new THREE.Quaternion().setFromRotationMatrix(mW.multiply(mL.transpose()));
    };
    const C = new THREE.Vector3(...NE.C), root = new THREE.Vector3(...NE.root);
    qNear.copy(orient(root.clone().sub(C).normalize(), new THREE.Vector3(0.25, 1, 0)));
    // after the turn the Earth shows us the hemisphere of the beam's root (Kenya, at night), north up
    qFar.copy(orient(new THREE.Vector3(...P.EARTH_DIR).negate(), new THREE.Vector3(0, 1, 0)));
    nearScene = new THREE.Scene();
  }
  const sunW = new THREE.Vector3(...P.SUN);
  const tmp = new THREE.Vector3();

  // probe extents on screen (for the reports / checks)
  const probeBox = () => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const e of probe.extents) { tmp.copy(e).applyMatrix4(probe.body.matrixWorld).project(cam); const x = (tmp.x * 0.5 + 0.5) * 1920, y = (0.5 - tmp.y * 0.5) * 1080; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  };

  console.log(`b_flight diag (not a WARNing): built stream=${needStream} heroes=${needHeroes} probe=${needProbe} earth=${!!earth} planets=${needPlanets} dot=${needDot} hand=${needHand} in ${Math.round(performance.now() - t0)} ms; nearEarth R=${NE.R.toFixed(2)} m exit=${NE.exit.toFixed(2)} m centrePx=${NE.centrePx.map(v => v.toFixed(0))}${words && words.stream ? ` words=${words.stream.count}` : ''}`);

  function draw(n, target, mask) {
    const L = setLens(cam, n); setLens(camP, n - 0.5);
    pvOf(cam, PV); pvOf(camP, PVp);
    const ac = renderer.autoClear; renderer.autoClear = false;
    renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 1); renderer.clear();

    // 1. stars (the cold field fades with nothing: it simply leaves the final frame)
    far.stars.render(target, PV, PVp, n);

    // 2. the Earth: near (S06-a) or far (after the turn)
    if (earth && n < 2990 && nearScene) {
      const d = P.nearEarthTravel(n);
      earth.group.position.set(NE.C[0], NE.C[1], NE.C[2] + d);
      earth.group.scale.setScalar(NE.R); earth.group.quaternion.copy(qNear);
      earth.update();
      // night side towards the lens, a thin twilight on the far limb; the cities of the root's hemisphere
      earth.setSun(tmp.set(NE.C[0], NE.C[1], NE.C[2]).normalize().add(new THREE.Vector3(-0.15, -0.55, -0.35)).normalize());
      earth.uniforms.lights.value = 1.25; earth.uniforms.atmo.value = 0.5; earth.uniforms.dayGain.value = 1;
      nearScene.add(earth.group);
      renderer.setRenderTarget(target); renderer.render(nearScene, cam);
      renderer.clearDepth();
    }
    if (earth && far.earthFar && n >= 3440 && n < 3774) {
      const k = 1 - P.sstep(3748, 3772, n);
      setLens(farCam, n);
      farCam.near = Math.max(0.3, P.earthDist(n) - 3); farCam.far = P.earthDist(n) + 3; farCam.updateProjectionMatrix();
      far.earthFar.place(n); earth.group.quaternion.copy(qFar); earth.update();
      earth.setSun(sunW);
      earth.uniforms.lights.value = 1.6 * k; earth.uniforms.dayGain.value = k; earth.uniforms.atmo.value = 0.8 * k; earth.uniforms.airglow.value = 0;
      far.earthFar.scene.add(earth.group);
      renderer.setRenderTarget(target); renderer.render(far.earthFar.scene, farCam);
      renderer.clearDepth();
    }

    // 3. planets (screen space, receding)
    if (far.planets) far.planets.render(target, n);

    // 4. the probe
    if (probe && n >= 3150 && n < 3818) {
      const rel = P.probeRel(n);
      probe.root.position.set(rel[0], rel[1], rel[2]);
      probe.root.updateMatrixWorld(true);
      probe.sun.position.set(rel[0] + P.SUN[0] * 40, rel[1] + P.SUN[1] * 40, rel[2] + P.SUN[2] * 40);
      probe.sun.target.position.set(rel[0], rel[1], rel[2]); probe.sun.target.updateMatrixWorld();
      // light levels (screenplay §0: dark side 6–12, lit faces 40–70, rims ≥ 40)
      const out = 1 - 0.7 * P.sstep(3768, 3812, n);              // S07-d: the rim fades 100 % → 30 % as it slides out
      probe.sun.intensity = 0.36;
      const Rm = probe.RIM;
      Rm.uRimDir1.value.copy(sunW).transformDirection(cam.matrixWorldInverse);
      Rm.uRimCol1.value.set(0.30, 0.32, 0.36).multiplyScalar(out);
      Rm.uRimDir2.value.set(-0.08, -0.05, -1).normalize().transformDirection(cam.matrixWorldInverse);
      const amber = (1 - P.sstep(3330, 3420, n)) * P.sstep(3200, 3260, n);
      Rm.uRimCol2.value.set(0.34, 0.15, 0.05).multiplyScalar(amber);
      Rm.uFill.value.set(0.0042, 0.0046, 0.0056).multiplyScalar(0.6 + 0.4 * out);
      const sm = renderer.shadowMap.enabled, st = renderer.shadowMap.type;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.setRenderTarget(target); renderer.render(probeScene, cam);
      renderer.shadowMap.enabled = sm; renderer.shadowMap.type = st;
      // the golden record catches the sun
      const g = glintEnv(n);
      if (g > 0) {
        const rec = probe.record(new THREE.Vector3(0, 0, 0));
        if (rec.facing > 0.05) { tmp.copy(rec.p).project(cam); far.glint.render(target, [(tmp.x * 0.5 + 0.5) * 1920, (0.5 - tmp.y * 0.5) * 1080], 6 * g); }
      }
    }

    // 5. the beam and its words (depth-tested against the probe)
    if (words && words.stream && n < 3430) {
      const fade = 1 - P.sstep(3336, 3424, n);
      words.stream.update(n, PVp, P.lensLateral(n), P.lensLateral(n - 0.5), fade);
      const rp = P.project([P.BOFF[0], P.BOFF[1], -P.rootDepth(n)], L);
      words.stream.setRootPx([rp[0], rp[1]]);
      words.stream.setHole(readingHole(n));
      words.stream.render(target, cam);
    }
    // 6. the reading targets
    if (words && words.heroes) {
      const st = heroState(n);
      if (globalThis.__bfDiag) void 0;
      if (words.heroes.apply(st)) {
        words.heroes.render(target);
        if (mask) words.heroes.renderMask(mask);
      }
    }

    // 7. the blue dot: my copy of w_sea's layer until f3780, then the layer itself
    if (n < P.BLUE_DOT_FROM && far.dot) far.dot.render(target, P.sstep(3746, 3778, n), P.sstep(3750, 3778, n));
    if (n >= P.BLUE_DOT_FROM && hand) hand.render(renderer, target, n);

    renderer.autoClear = ac;
    renderer.setRenderTarget(target);
  }

  return {
    msaa: true,
    bloomMask: f => { const n = f.t * P.FPS; return n >= 3020 && n < 3218; },
    motionBlur: f => { const n = f.t * P.FPS; return n >= 3792 && n < 3816 ? 3 : 0; },
    render(shot, f) {
      const n = f.t * P.FPS;
      globalThis.__bfDiag = true;
      draw(n, f.target, f.mask && f.sub === 0 ? f.mask : null);
    },
    post,
    // diagnostics (render stills with ?diag)
    _probeBox: probeBox,
  };
}
