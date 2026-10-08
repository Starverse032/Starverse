// c_supernova — S12 超新星 (53.0 → 57.0, f1272–1367) and S13 弧 · 迟到的信 (57.0 → 64.0, f1368–1535).
//
// S12  f1272 the collapsed point at R flashes: HDR ≈ 10 → 10³ in 4 frames (peak f1276), then decays;
//      the post streak (0.4) draws the anamorphic flare, the PSF is narrow so the frame never clips
//      to white (that belongs to the Big Bang alone). From f1276 the ejecta shell: ≈ 300 k particles on
//      a sphere, r = r_max·(1 − (1 − u)³), u = (t − 53)/4, with ±15 % 3D-fbm radial jitter
//      (Rayleigh–Taylor corrugation + outward fingers) and an onion of forged elements coloured by the
//      layer coordinate: inner iron blue → OIII → sulfur → outer H-alpha. The shell starts white-hot
//      and cools into its element colours. 35 mm, the camera is pushed back by the blast,
//      distance 10 → 40 (easeOutExpo); a shift lens keeps the blast centre pinned on R at every
//      distance. 4 motion-blur sub-frames (timeline).
// S13  85 mm, locked. The shell's light front rises from below the frame (easeOutCubic) and stops at
//      61.0 EXACTLY on the conic C = anchors.arc (S14's horizon), then holds for 3 s. The front is a
//      screen-space shader on the distance |Q|/|∇Q| to C: a sharp outer edge, a 3 px white-blue core and
//      a 30 px inward exponential glow (the same profile S14's airglow line uses, measured against
//      S14's first frame). Just inside it, ash: braided H-alpha / OIII filaments drawn out along the arc
//      and creased gas sheets (baked once in "front space": along-arc × depth; OIII right behind the
//      shock, H-alpha further back, as in the Veil). Inside the dome ≤ 0.03; stars only outside it.
//      (A first version also re-mapped S12's particles into front space; at 85 mm they read as
//      coloured noise on the arc, so the ash is the baked filament field alone.)
//      During the rise the front is motion-blurred analytically (profile averaged over the shutter).
import * as THREE from 'three';
import { buildShell, LAYER_GLSL, hex } from './c_supernova/shell.js';

const FPS = 24;
const R = [734, 540];
const T12 = 53.0, T13 = 57.0, T_STOP = 61.0;

// apex-relative conic: A x² + B xy + C y² + Dx x + Ey y + F0 with x = u − 960, y = v − 430
function apexConic(coef, ax = 960, ay = 430) {
  const [A, B, C, D, E, F] = coef;
  return {
    A: A / C, B: B / C,
    Dx: (2 * A * ax + B * ay + D) / C,
    Ey: (2 * C * ay + B * ax + E) / C,
    F0: (A * ax * ax + B * ax * ay + C * ay * ay + D * ax + E * ay + F) / C,
  };
}

export async function create(ctx) {
  const { renderer, W, H, kit, timeline } = ctx;
  const S = H / 1080;
  const arc = timeline.anchors.arc;
  const K = apexConic(arc.coef, arc.apex[0], arc.apex[1]);
  console.log('[c_supernova] apex conic ' + JSON.stringify(K));

  const shell = buildShell(300000, 55012);
  console.log('[c_supernova] shell particles ' + shell.count);

  // =========================================== S12 =============================================
  const scene12 = new THREE.Scene();
  const stars12 = kit.starfield({ count: 9000, seed: 55120, radius: 3000, H, brightness: 0.55, sizeScale: 0.9, warm: 0.15 });
  scene12.add(stars12);
  // the shell is drawn twice from the same particles: crisp 1–2 px points at full resolution (the
  // filaments and knots) and a quarter-resolution pass with wide soft points (the glowing gas between
  // them, which also averages the element colours into coherent bands instead of confetti)
  function makeShellMat(sizeK, sizeAdd, filW) {
    const U = {
      uR: { value: 1 }, uGain: { value: 1 }, uHot: { value: 1 }, uS: { value: S }, uSpread: { value: 1 },
    };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: U,
      vertexShader: LAYER_GLSL + /* glsl */ `
        attribute float aRad, aLayer, aB, aFil, aSeed, aPatch;
        uniform float uR, uGain, uHot, uS, uSpread;
        varying vec3 vCol; varying float vI;
        void main(){
          // layers separate as the shell coasts (the onion thickens slightly)
          float rr = 1.0 + (aRad - 1.0) * uSpread;
          vec4 mv = modelViewMatrix * vec4(position * uR * rr, 1.0);
          gl_Position = projectionMatrix * mv;
          float L = clamp(0.6 * aLayer + 0.8 * (aPatch - 0.5) + 0.24, 0.0, 1.0);
          L = max(L, smoothstep(0.78, 0.98, aLayer));            // the outermost skin is hydrogen: H-alpha rim
          vec3 lc = layerColor(L);
          vec3 hot = vec3(1.0, 0.96, 0.92);
          vCol = mix(lc, hot, uHot);
          // the crisp pass carries the filaments and knots; the diffuse sheet lives in the gas pass
          vI = aB * uGain * mix(1.0, 0.1 + 0.9 * aFil, ${filW.toFixed(2)});
          gl_PointSize = (${sizeAdd.toFixed(2)} + ${sizeK.toFixed(2)} * (1.1 * aFil + 0.6 * aSeed)) * uS;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vCol; varying float vI;
        void main(){ vec2 d = gl_PointCoord - 0.5; float g = exp(-dot(d, d) * 9.0);
          gl_FragColor = vec4(vCol * vI * g, 1.0); }`,
    });
    return { m, U };
  }
  const fine = makeShellMat(1.0, 1.35, 1.0), gas = makeShellMat(3.0, 6.0, 0.0);
  const shellPts = new THREE.Points(shell.geometry, fine.m);
  shellPts.frustumCulled = false;
  scene12.add(shellPts);
  // the gas pass only needs a random subset (the particles are in random order): 120 k, gain × 2.5
  const gasGeo = new THREE.BufferGeometry();
  for (const k of ['position', 'aRad', 'aLayer', 'aB', 'aFil', 'aSeed', 'aPatch']) gasGeo.setAttribute(k, shell.geometry.getAttribute(k));
  gasGeo.setDrawRange(0, Math.min(shell.count, 120000));
  const GAS_SUB = shell.count / Math.min(shell.count, 120000);
  const gasPts = new THREE.Points(gasGeo, gas.m);
  gasPts.frustumCulled = false;
  const sceneGas = new THREE.Scene();
  sceneGas.add(gasPts);
  const GAS_SCALE = 0.25;
  const gasRT = new kit.LowRes(W, H, GAS_SCALE);
  gas.U.uS.value = S * GAS_SCALE;
  const comp = kit.compositor();
  const shellU = fine.U;

  // the flash and the hot core left behind: one point sprite at the blast centre
  const flashU = { uI: { value: 0 }, uCore: { value: 0 }, uS: { value: S }, uHalf: { value: 256 } };
  const flashG = new THREE.BufferGeometry();
  flashG.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
  const flashMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: flashU,
    vertexShader: /* glsl */ `uniform float uS, uHalf; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 2.0 * uHalf * uS; }`,
    fragmentShader: /* glsl */ `
      uniform float uI, uCore, uHalf;
      void main(){
        vec2 q = (gl_PointCoord - 0.5) * 2.0 * uHalf; float r2 = dot(q, q);
        // flash PSF: a 1.3 px core, a Moffat wing and a faint wide halation skirt (cold white)
        float psf = exp(-0.5 * r2 / 1.7) + 0.03 * pow(1.0 + r2 / 9.0, -1.6) + 0.0012 * exp(-sqrt(r2) / 70.0);
        // the hot remnant core: a soft, small blue-white glow that lingers inside the shell
        float core = exp(-0.5 * r2 / 16.0) + 0.06 * exp(-sqrt(r2) / 30.0);
        vec3 c = vec3(0.92, 0.96, 1.0) * uI * psf + vec3(0.75, 0.85, 1.0) * uCore * core;
        gl_FragColor = vec4(c * smoothstep(uHalf, uHalf * 0.8, sqrt(r2)), 1.0);
      }`,
  });
  const flashPt = new THREE.Points(flashG, flashMat);
  flashPt.frustumCulled = false;
  scene12.add(flashPt);

  const cam12 = kit.filmCamera(W, H, { focalMM: 35, near: 0.05, far: 6000 });
  // shift lens: the optical axis lands on R instead of the frame centre (blast centre stays on R)
  cam12.setViewOffset(W, H, (960 - R[0]) * S, (540 - R[1]) * S, W, H);
  const R_MAX = 7.6;
  const FINE_GAIN = 0.55, GAS_GAIN = 0.065;

  // =========================================== S13 =============================================
  const conicU = {
    cA: { value: K.A }, cDx: { value: K.Dx }, cEy: { value: K.Ey }, cF0: { value: K.F0 },
    uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uDelta: { value: 0 }, uBlur: { value: 0 }, uT: { value: 0 },
  };
  const CONIC_GLSL = /* glsl */ `
    uniform float cA, cDx, cEy, cF0, uDelta;
    // signed distance (1080p px) to the conic shifted down by uDelta; + inside (below the arc)
    float conicD(vec2 pix){
      vec2 p = pix - vec2(960.0, 430.0 + uDelta);
      float Q = cA * p.x * p.x + p.y * p.y + cDx * p.x + cEy * p.y + cF0;
      vec2 g = vec2(2.0 * cA * p.x + cDx, 2.0 * p.y + cEy);
      return Q / length(g);
    }`;

  // ---- ash: braided filaments baked in front space (x: −240..2160 px along the arc, y: 0..256 px depth)
  const ashTex = kit.bake(renderer, {
    w: 2048, h: 256, mipmaps: true, wrap: THREE.ClampToEdgeWrapping,
    frag: /* glsl */ `
      const vec3 HA = vec3(${hex(0xFF3B4E).map(v => v.toFixed(4)).join(',')});
      const vec3 O3 = vec3(${hex(0x4FE0D0).map(v => v.toFixed(4)).join(',')});
      // ridged 2D noise: thin bright creases (sheets of shocked gas seen edge-on)
      float ridge2(vec2 p, int oct){ float a = 0.5, s = 0.0, n = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 6; i++){ if (i >= oct) break; float v = 1.0 - abs(2.0 * vnoise(p) - 1.0); s += a * v * v * v; n += a; p = m * p; a *= 0.5; } return s / n; }
      void main(){
        float X = vUv.x * 2400.0 - 240.0;
        float d = vUv.y * 256.0;
        vec3 col = vec3(0.0);
        // braided strands running along the arc: hair-thin, wandering in depth, broken into segments
        for (int k = 0; k < 16; k++){
          float fk = float(k);
          float base = 2.5 + 2.2 * fk + 0.22 * fk * fk;                       // 2.5 … 88 px behind the front
          float c = base + (5.0 + 2.2 * fk) * (fbm(vec2(X / (240.0 + 37.0 * fk) + fk * 3.7, fk * 1.9), 4) - 0.5) * 2.2;
          float w = 0.45 + 0.08 * fk + 0.9 * pow(fbm(vec2(X / 60.0 + fk * 5.1, fk * 2.3), 3), 2.0);
          float s = exp(-0.5 * pow((d - c) / w, 2.0));
          // segments: the strand exists only where a slow noise is above a threshold, with bright knots
          float seg = smoothstep(0.48, 0.68, fbm(vec2(X / (120.0 + 25.0 * fk), fk * 7.3 + 4.0), 5));
          float knots = 0.2 + 3.2 * pow(fbm(vec2(X / (16.0 + 5.0 * fk), fk * 11.0 + 2.0), 4), 3.5);
          // OIII lights up right behind the shock, H-alpha further back (as in the Veil / Cygnus Loop)
          float hue = clamp(smoothstep(6.0, 26.0, c) + 0.5 * (fbm(vec2(X / 700.0, fk * 4.3 + 1.0), 3) - 0.5), 0.0, 1.0);
          vec3 sc = mix(O3 * 0.85 + vec3(0.06), HA * 1.25 + vec3(0.04, 0.01, 0.02), hue);
          col += sc * s * seg * knots * exp(-c / 32.0) * 0.34 * (1.0 + 0.6 * step(fk, 3.0));
        }
        // creased gas sheets: ridged, strongly anisotropic, domain-warped (stretched along the arc)
        vec2 p = vec2(X / 150.0, d / 7.0);
        vec2 wv = vec2(fbm(p * vec2(0.5, 0.25) + 3.0, 4), fbm(p * vec2(0.5, 0.25) + 9.0, 4));
        p += vec2(1.4, 3.0) * (wv - 0.5);
        float sheet = pow(ridge2(p, 5), 2.2) * smoothstep(0.35, 0.7, fbm(vec2(X / 380.0, d / 50.0) + 2.0, 4));
        float env = exp(-d / 26.0) * smoothstep(1.0, 5.0, d);
        float hue2 = clamp(smoothstep(5.0, 30.0, d) + 0.6 * (fbm(vec2(X / 520.0, d / 40.0) + 7.0, 3) - 0.5), 0.0, 1.0);
        col += mix(O3 * 0.8 + vec3(0.05), HA * 1.2 + vec3(0.03, 0.0, 0.01), hue2) * sheet * env * 0.95;
        // deep interior: the faintest residue (≤ 0.012)
        float deep = fbm(vec2(X / 160.0, d / 40.0) + 13.0, 4);
        col += vec3(0.25, 0.35, 0.8) * 0.010 * deep * smoothstep(8.0, 40.0, d);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const frontU = { ...conicU, tAsh: { value: ashTex }, uAsh: { value: 1 }, uCoreK: { value: 1 }, uGlowK: { value: 1 } };
  const front = kit.fullscreen(CONIC_GLSL + /* glsl */ `
    uniform vec2 uRes; uniform float uS, uBlur, uT, uAsh, uCoreK, uGlowK; uniform sampler2D tAsh;
    // light-front profile along the inward normal: sharp outer edge (≈1 px), 3 px core, 30 px glow
    void prof(float d, out float core, out float glow){
      float e = smoothstep(-0.9, 0.5, d);
      float dd = max(d, 0.0);
      core = e * exp(-0.5 * (dd - 1.0) * (dd - 1.0) / (2.6 * 2.6));   // 3 px core (FWHM ≈ 6 px, peak 1 px inside)
      glow = e * exp(-dd / 30.0);
    }
    void main(){
      vec2 pix = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;
      float d = conicD(pix);
      if (d < -60.0) { gl_FragColor = vec4(0.0); return; }
      // analytic motion blur: average the profile over the shutter displacement along the normal
      float core = 0.0, glow = 0.0;
      for (int k = 0; k < 6; k++){
        float o = uBlur * ((float(k) + 0.5) / 6.0 - 0.5);
        float c1, g1; prof(d + o, c1, g1); core += c1; glow += g1;
      }
      core /= 6.0; glow /= 6.0;
      float x = pix.x;
      // the inward glow brightens towards the right end of the arc (S14's dawn is there)
      float tw = smoothstep(500.0, 1900.0, x);
      vec3 coreCol = vec3(0.62, 0.72, 0.86);
      vec3 glowCol = vec3(0.30, 0.46, 1.0) * (0.085 + 0.2 * pow(tw, 2.0)) + vec3(0.62, 0.72, 1.0) * 0.26 * pow(tw, 3.0);
      vec3 col = coreCol * core * uCoreK + glowCol * glow * uGlowK;
      // ash (three taps across the shutter)
      vec3 ash = vec3(0.0);
      for (int k = 0; k < 3; k++){
        float o = uBlur * ((float(k) + 0.5) / 3.0 - 0.5);
        ash += texture2D(tAsh, vec2((x + 240.0 + 2.0 * uT) / 2400.0, (d + o) / 256.0)).rgb;
      }
      ash /= 3.0;
      float inside = smoothstep(-0.6, 1.2, d);
      col += ash * uAsh * inside * (1.0 - smoothstep(230.0, 256.0, d));
      // the dome is opaque: it hides the stars behind it (premultiplied: ONE, ONE_MINUS_SRC_ALPHA)
      gl_FragColor = vec4(col, inside);
    }`, frontU, { blending: THREE.CustomBlending, transparent: true });
  front.material.blendSrc = THREE.OneFactor; front.material.blendDst = THREE.OneMinusSrcAlphaFactor;
  front.material.blendEquation = THREE.AddEquation;

  // stars outside the dome (85 mm)
  const scene13 = new THREE.Scene();
  const stars13 = kit.starfield({ count: 40000, seed: 55130, radius: 3000, H, brightness: 0.9, sizeScale: 0.85, warm: 0.25 });
  scene13.add(stars13);
  const cam13 = kit.filmCamera(W, H, { focalMM: 85, near: 0.5, far: 6000 });
  cam13.position.set(0, 0, 0); cam13.lookAt(0.3, 0.45, -1); cam13.updateMatrixWorld();

  // front offset δ(t): from below the frame to 0 at 61.0 (easeOutCubic)
  const DELTA0 = 560;
  const deltaAt = t => { const u = Math.min(1, Math.max(0, (t - T13) / (T_STOP - T13))); return DELTA0 * Math.pow(1 - u, 3); };

  return {
    render(shot, f) {
      const t = f.t;
      renderer.setRenderTarget(f.target);
      renderer.setClearColor(0x000000, 1); renderer.clear();
      const ac = renderer.autoClear;
      renderer.autoClear = false;            // several passes into the same target
      if (shot.id === 'S12') {
        const u = Math.max(0, (t - T12) / 4);
        const uc = Math.min(u, 1.15);
        // the blast pushes the camera back: 10 → 40 (easeOutExpo)
        const dist = 10 + 30 * (uc >= 1 ? 1 : 1 - Math.pow(2, -10 * uc));
        cam12.position.set(0, 0, dist); cam12.lookAt(0, 0, 0); cam12.updateMatrixWorld();
        // shell radius and energy
        shellU.uR.value = R_MAX * (1 - Math.pow(1 - Math.min(uc, 1), 3)) + (uc > 1 ? R_MAX * 0.02 * (uc - 1) : 0);
        const on = Math.min(1, Math.max(0, (t - 53.15) / 0.02));
        const hot = Math.exp(-u / 0.06);
        shellU.uHot.value = 0.9 * hot;
        // energy: compensate part of the compactness of the young shell (it is not a sun), plus the hot burst
        shellU.uGain.value = on * 0.2 * (0.4 + 0.6 * Math.min(1, u / 0.45) + 1.2 * Math.exp(-u / 0.05));
        shellU.uSpread.value = 0.6 + 0.4 * Math.min(1, u * 2);
        for (const k of ['uR', 'uHot', 'uSpread']) gas.U[k].value = shellU[k].value;
        gas.U.uGain.value = shellU.uGain.value * GAS_GAIN * GAS_SUB;
        shellU.uGain.value *= FINE_GAIN;
        // the flash: ≈ 10 at f1272, 10³ at f1276 (4 frames), then a fast decay; the core lingers
        const tf = t - 52.98, tp = 53.0 + 4 / FPS - 52.98;
        let I = 0;
        if (tf >= 0) I = tf < tp ? 1000 * Math.pow(tf / tp, 2) : 1000 * Math.exp(-(tf - tp) / 0.07) + 25 * Math.exp(-(tf - tp) / 0.6);
        flashU.uI.value = I;
        flashU.uHalf.value = I > 2 ? 256 : 72;           // the wide flash PSF only while it matters
        flashU.uCore.value = tf > 0 ? 6 * Math.exp(-Math.max(0, tf - tp) / 2.5) * Math.min(1, tf / tp) : 0;
        renderer.render(scene12, cam12);
        // the gas glow (quarter resolution) added on top
        renderer.setRenderTarget(gasRT.rt); renderer.setClearColor(0x000000, 1); renderer.clear();
        renderer.render(sceneGas, cam12);
        comp.material.uniforms.tex.value = gasRT.texture; comp.material.uniforms.gain.value = 1;
        comp.render(renderer, f.target);
      } else {
        const lt = t - T13;
        const delta = deltaAt(t);
        // shutter displacement (180°) of the front, in px
        const u = Math.min(1, Math.max(0, lt / (T_STOP - T13)));
        const vel = 3 * DELTA0 * Math.pow(1 - u, 2) / (T_STOP - T13);
        conicU.uDelta.value = delta; conicU.uBlur.value = vel * 0.5 / FPS; conicU.uT.value = Math.max(0, lt);
        // the arriving front burns a little hotter, settling to S14's profile level as it stops
        frontU.uCoreK.value = 1 + 0.6 * Math.pow(1 - u, 2); frontU.uGlowK.value = 1 + 0.3 * Math.pow(1 - u, 2);
        renderer.render(scene13, cam13);
        front.render(renderer, f.target);
      }
      renderer.autoClear = ac;
    },
    post(shot, f) {
      if (shot.id === 'S12') return { bloom: 1.0, streak: 0.4, bloomThreshold: 1.0 };
      return {};
    },
  };
}
