// a_star / shell — the supernova ejecta: ≈ 300 k particles on a sphere expanding from the blast centre
// (c_supernova/shell.js: filament network, ±15 % Rayleigh–Taylor corrugation, outward fingers, onion
// layers), re-coloured cold — inner IRON_BLUE → OIII cyan, H-alpha only as thin filaments on the outer
// skin (≤ 5 % of the shell) — with a large-scale one-sided brightness asymmetry (angular CoV ≥ 0.3).
// The camera is at distance 1 from the blast centre and only creeps forward; the shell's limb ratio
// q = ρ/d follows shellQ(fr): 50 / 200 / 600 px at f1352 / 1368 / 1392, past the frame corners before
// f1416, the near cap passes the lens ≈ f1428 (then only the far "bowl" is left, receding and fading).
// Motion blur: the shell layer is rendered into its own target and composited with an analytic radial
// zoom blur about R spanning the shutter (half the frame's expansion) — no sub-frames (audit §3.5).
// Depth split for the Earth overlap (substitution ②): mode 'far' draws only particles behind the blast
// centre (the bowl the Earth silhouettes against), 'near' only those in front of it.
import * as THREE from 'three';
import { buildShell, hex } from '../c_supernova/shell.js';
import * as C from './curves.js';

const IRON = hex(0x6FA8FF), OIII = hex(0x4FE0D0), HA = hex(0xFF3B4E);
const v3 = a => `vec3(${a.map(x => x.toFixed(4)).join(',')})`;

export function createZoomComposite(ctx) {
  const { kit } = ctx;
  // additive composite with an 8-tap zoom blur about R; scale range [sLo, sHi] (multiplicative, about R)
  const fsq = kit.fullscreen(/* glsl */ `
    uniform sampler2D tex; uniform float uLo, uHi, uGain, uJit; uniform vec2 uC;
    void main(){
      float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uJit);
      vec3 c = vec3(0.0);
      if (uHi - uLo < 1e-4) c = texture2D(tex, vUv).rgb;
      else {
        float a = log(uLo), b = log(uHi);
        for (int k = 0; k < 8; k++) { float s = exp(mix(a, b, (float(k) + j) / 8.0)); c += texture2D(tex, uC + (vUv - uC) * s).rgb; }
        c /= 8.0;
      }
      gl_FragColor = vec4(c * uGain, 1.0);
    }`, { tex: { value: null }, uLo: { value: 1 }, uHi: { value: 1 }, uGain: { value: 1 }, uJit: { value: 0 }, uC: { value: new THREE.Vector2(C.RX / 1920, 1 - C.RY / 1080) } },
  { blending: THREE.AdditiveBlending, transparent: true });
  return {
    apply(tex, target, lo, hi, gain = 1, n = 0) {
      const u = fsq.material.uniforms;
      u.tex.value = tex; u.uLo.value = Math.min(lo, hi); u.uHi.value = Math.max(lo, hi); u.uGain.value = gain; u.uJit.value = (Math.round(n) * 0.618034) % 1;
      fsq.render(ctx.renderer, target);
    },
  };
}

export function createShell(ctx) {
  const { renderer, W, H, kit, makeRT } = ctx;
  const S = H / 1080;
  const shell = buildShell(300000, 55012);
  const A = new THREE.Vector3(-0.62, 0.45, 0.64).normalize();      // the brighter side (upper left, towards us)

  function makeMat(sizeK, sizeAdd, filW, quarter) {
    const U = { uQ: { value: 0.01 }, uGain: { value: 1 }, uHot: { value: 1 }, uS: { value: S * (quarter ? 0.25 : 1) }, uSpread: { value: 1 }, uMode: { value: 0 }, uA: { value: A } };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: U,
      vertexShader: /* glsl */ `
        attribute float aRad, aLayer, aB, aFil, aSeed, aPatch;
        uniform float uQ, uGain, uHot, uS, uSpread, uMode; uniform vec3 uA;
        varying vec3 vCol; varying float vI;
        void main(){
          float rr = 1.0 + (aRad - 1.0) * uSpread;
          vec4 mv = modelViewMatrix * vec4(position * uQ * rr, 1.0);
          float depth = -mv.z;
          bool keep = depth > 0.035 && (uMode < 0.5 || (uMode < 1.5 ? depth >= 1.0 : depth < 1.0));
          gl_Position = keep ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
          // element colour: iron blue inside, oxygen cyan outside (patchy), H-alpha only on outer filaments
          float L = clamp(aLayer + 0.45 * (aPatch - 0.5), 0.0, 1.0);
          vec3 c = mix(${v3(IRON)}, ${v3(OIII)}, smoothstep(0.30, 0.70, L));
          float ha = smoothstep(0.90, 0.975, aLayer) * smoothstep(0.55, 0.85, aFil) * step(0.45, aSeed);
          c = mix(c, ${v3(HA)} * 0.75, ha);
          c /= max(0.12, dot(c, vec3(0.2126, 0.7152, 0.0722)));
          vCol = mix(c, vec3(0.93, 0.97, 1.0) * 1.0, uHot);
          // one-sided asymmetry + patchy brightness
          float asym = 1.0 + 0.60 * dot(normalize(position), uA) + 0.5 * (aPatch - 0.5);
          // near the lens a particle spreads: larger, dimmer (energy kept)
          float near = clamp(0.35 / max(depth, 0.035), 1.0, 5.0);
          float size = (${sizeAdd.toFixed(2)} + ${sizeK.toFixed(2)} * (1.1 * aFil + 0.6 * aSeed)) * near;
          gl_PointSize = max(size * uS, 1.0);
          vI = aB * uGain * max(asym, 0.15) * mix(1.0, 0.1 + 0.9 * aFil, ${filW.toFixed(2)}) / (near * near) * (1.0 - 0.35 * ha);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vCol; varying float vI;
        void main(){ vec2 d = gl_PointCoord - 0.5; float g = exp(-dot(d, d) * 9.0); gl_FragColor = vec4(vCol * vI * g, 1.0); }`,
    });
    return { m, U };
  }
  const fine = makeMat(1.0, 1.25, 1.0, false), gas = makeMat(3.2, 6.0, 0.0, true);
  const finePts = new THREE.Points(shell.geometry, fine.m); finePts.frustumCulled = false;
  const gasGeo = new THREE.BufferGeometry();
  for (const k of ['position', 'aRad', 'aLayer', 'aB', 'aFil', 'aSeed', 'aPatch']) gasGeo.setAttribute(k, shell.geometry.getAttribute(k));
  const NG = Math.min(shell.count, 120000);
  gasGeo.setDrawRange(0, NG);
  const gasPts = new THREE.Points(gasGeo, gas.m); gasPts.frustumCulled = false;
  const sceneFine = new THREE.Scene(); sceneFine.add(finePts);
  const sceneGas = new THREE.Scene(); sceneGas.add(gasPts);
  const cam = kit.filmCamera(W, H, { focalMM: 35, near: 0.01, far: 100 });
  cam.position.set(0, 0, 1); cam.lookAt(0, 0, 0);
  cam.setViewOffset(W, H, (960 - C.RX) * S, (540 - C.RY) * S, W, H);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);

  const rt = makeRT(W, H);
  const gasRT = makeRT(Math.round(W / 4), Math.round(H / 4));
  const up = kit.compositor();
  const zoom = createZoomComposite(ctx);
  const FINE_GAIN = 0.11, GAS_GAIN = 0.016 * shell.count / NG;

  const limb = fr => { const q = C.shellQ(fr); return q < 0.97 ? q / Math.sqrt(1 - q * q) : q * 4.1; };

  return {
    count: shell.count,
    /** render the shell (mode 0 all, 1 far, 2 near) and add it, zoom-blurred, into target */
    render(fr, target, mode = 0, gainMul = 1, barPx = 0) {
      const st = C.shellState(fr);
      if (st.on <= 0 || gainMul <= 0) return;
      const q = C.shellQ(fr);
      for (const M of [fine, gas]) {
        M.U.uQ.value = q; M.U.uHot.value = 0.85 * st.hot; M.U.uSpread.value = st.spread; M.U.uMode.value = mode;
      }
      fine.U.uGain.value = FINE_GAIN * st.energy * gainMul;
      gas.U.uGain.value = GAS_GAIN * st.energy * gainMul;
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.setRenderTarget(gasRT); renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
      renderer.render(sceneGas, cam);
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
      renderer.render(sceneFine, cam);
      up.material.uniforms.tex.value = gasRT.texture; up.material.uniforms.gain.value = 1;
      up.render(renderer, rt);
      // shutter: the image a quarter frame earlier / later is scaled about R by limb(fr ± ¼)/limb(fr)
      const l0 = limb(fr), lo = limb(fr - 0.25) / l0, hi = limb(fr + 0.25) / l0;
      // sampling the current image at p·s reproduces the image at the time whose limb is limb/s
      zoom.apply(rt.texture, target, 1 / Math.min(hi, 1.6), 1 / Math.max(lo, 1 / 1.6), 1, fr);
      renderer.autoClear = ac;
    },
  };
}
