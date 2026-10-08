// c_pulsar — S30 脉冲星 (136.0 → 142.0, f3264–3407) and S31 无回答 (142.0 → 148.0, f3408–3551).
//
// PSR B1919+21 (LGM-1), true period 1.337 s: pulses t_k = 137.000 + 1.337 k.
//   The neutron star is a tiny white-violet sphere (PULSAR #C9B8FF, Fresnel rim, HDR 8). Spin axis
//   tilted 20° from the frame's vertical, magnetic axis 45° from it; the two opposite beams (cones of
//   half-angle 6°, 40 units long, additive, noise along their length) are ray-marched at half
//   resolution. The geometry is solved every frame so that the magnetic axis points EXACTLY at the
//   lens at t_k (angle = 2π(t − 137)/1.337): the beam sweeps the camera on the pulse, and the
//   exposure spike lands on frame round(t_k·24), the same frame as the audio "beep".
//   Around it a faint remnant nebula (half resolution, α ≈ 0.08, S12's element colours: this
//   pulsar is what a supernova leaves behind), three baked billboards at different depths (parallax).
// S30  136–137 locked on black. 137.0 the first beam: a tiny point flashes at the right edge
//      (1800, 540) (24 mm, distance 160). 138.0–140.0 uniform yaw with 6-frame servo ramps, carrying
//      the point onto R (the impostor R). 140.0 → 141.011 (the 4th pulse) uniform push-in 160 → 60
//      with a zoom 24 → 50 mm, the point held on R the whole time; then still.
//      Rhythm is told ONLY by exposure spikes: +1.5 EV on frame F_k, then +0.9, +0.35.
// S31  50 mm. 142.0–145.0 uniform pull-back ×6 with a lateral truck (camera orientation fixed), the
//      pulsar recedes to (1700, 540) and keeps flashing; then still. R is empty. Far away each sweep
//      is only a local flash of a cold point (+0.6 EV on the point, not the frame). Pulses
//      145.022 / 146.359 / 147.696 flash in silence; 147.75–148.0 fade to black (timeline).
import * as THREE from 'three';
import { hex, IRON_BLUE, OIII, SULFUR, HALPHA, PULSAR } from './c_supernova/shell.js';

const FPS = 24, P = 1.337, T0 = 137.0;
const R = [734, 540];
const D2R = Math.PI / 180;
const fpxOf = mm => 960 * mm / 18;                     // 1080p focal length in px (36 mm gauge)
const D0 = 160, D1 = 60;                               // S30 camera distances
const servo = (t, a, b, ramp) => {                     // 0→1 at constant speed with linear speed ramps
  const T = b - a, x = Math.min(Math.max(t - a, 0), T), v = 1 / (T - ramp);
  if (x < ramp) return 0.5 * v * x * x / ramp;
  if (x > T - ramp) { const y = T - x; return 1 - 0.5 * v * y * y / ramp; }
  return 0.5 * v * ramp + v * (x - ramp);
};
// frame of pulse k (the audio is sample-exact; the picture spikes on the nearest frame)
const pulseFrame = k => Math.round((T0 + P * k) * FPS);

export async function create(ctx) {
  const { renderer, W, H, kit } = ctx;
  const S = H / 1080;

  // ---- camera path ----------------------------------------------------------------------------
  // the pulsar sits at the origin, the camera starts on +z looking down −z; yaw ψ > 0 turns left,
  // which puts the pulsar right of centre: x = 960 + f·tan ψ
  const psi0 = Math.atan((1800 - 960) / fpxOf(24));
  const psiR = mm => -Math.atan((960 - R[0]) / fpxOf(mm));
  const psi1 = psiR(50);
  const T_PUSH0 = 140.0, T_PUSH1 = T0 + 3 * P;        // the push stops on the 4th pulse (141.011)
  // S31: fixed orientation psi1; position from c0 to c1 (pull-back ×6 + truck) so the pulsar lands at x = 1700
  const fwd = new THREE.Vector3(-Math.sin(psi1), 0, -Math.cos(psi1)), right = new THREE.Vector3(Math.cos(psi1), 0, -Math.sin(psi1));
  const c0 = new THREE.Vector3(0, 0, D1);
  const depth1 = 6 * D1 * Math.cos(psi1);
  const X1 = depth1 * (1700 - 960) / fpxOf(50);
  const c1 = fwd.clone().multiplyScalar(-depth1).add(right.clone().multiplyScalar(-X1));
  function pose(t) {
    let pos, psi, mm;
    if (t < 142.0) {
      mm = 24; psi = psi0; pos = new THREE.Vector3(0, 0, D0);
      if (t >= 138.0) psi = psi0 + (psiR(24) - psi0) * servo(t, 138.0, 140.0, 6 / FPS);
      if (t >= T_PUSH0) {
        const u = servo(t, T_PUSH0, T_PUSH1, 4 / FPS);
        mm = 24 + 26 * u;
        pos.z = D0 + (D1 - D0) * u;
        psi = psiR(mm);
      }
    } else {
      mm = 50; psi = psi1;
      const u = Math.min(1, Math.max(0, (t - 142.0) / 3.0));   // uniform, then still
      pos = c0.clone().lerp(c1, u);
    }
    return { pos, psi, mm };
  }
  const cam = kit.filmCamera(W, H, { focalMM: 24, near: 0.05, far: 8000 });

  // ---- scene: background stars, the neutron star -----------------------------------------------
  const scene = new THREE.Scene();
  const stars = kit.starfield({ count: 2600, seed: 55300, radius: 4000, H, brightness: 0.2, sizeScale: 0.75, warm: 0.2 });
  scene.add(stars);
  const nsU = { uI: { value: 0 }, uRpx: { value: 1 }, uS: { value: S }, uHalf: { value: 40 }, uCol: { value: new THREE.Vector3(...PULSAR) } };
  const nsG = new THREE.BufferGeometry();
  // the star is drawn in screen space at 5 instants across a 180° shutter (analytic motion blur for
  // the yaw and the push: it moves up to ~22 px per frame)
  const NSUB = 5;
  const nsPos = new THREE.BufferAttribute(new Float32Array(3 * NSUB), 3);
  nsG.setAttribute('position', nsPos);
  const nsMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: nsU,
    vertexShader: /* glsl */ `uniform float uS, uHalf; void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); gl_PointSize = 2.0 * uHalf * uS; }`,
    fragmentShader: /* glsl */ `
      uniform float uI, uRpx, uHalf; uniform vec3 uCol;
      void main(){
        vec2 q = (gl_PointCoord - 0.5) * 2.0 * uHalf; float r = length(q);
        // a resolved sphere when it is a few px wide (white core, violet Fresnel rim), a PSF when not
        float rs = max(uRpx, 0.6);
        float x = clamp(r / rs, 0.0, 1.0);
        float disc = smoothstep(rs + 0.7, rs - 0.7, r);
        float fres = pow(x, 3.0);
        vec3 c = mix(vec3(1.0, 0.98, 1.0), uCol * 1.4, fres) * disc;
        // sub-pixel: energy-conserving gaussian core; plus a tight halo
        float psf = exp(-0.5 * r * r / 0.8) * clamp(1.4 - uRpx, 0.0, 1.0);
        float halo = 0.05 * exp(-r / (1.5 + 0.6 * rs));
        gl_FragColor = vec4((c + uCol * (psf + halo)) * uI, 1.0);
      }`,
  });
  const ns = new THREE.Points(nsG, nsMat);
  ns.frustumCulled = false;
  const nsScene = new THREE.Scene(); nsScene.add(ns);
  const camP = kit.filmCamera(W, H, { focalMM: 24, near: 0.05, far: 8000 });
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const placeCam = (c, ps) => { c.setFocalLength(ps.mm); c.position.copy(ps.pos); c.rotation.set(0, ps.psi, 0); c.updateMatrixWorld(); };

  // ---- remnant nebula: one baked texture, three billboards at different depths ----------------
  const nebTex = kit.bake(renderer, {
    w: 2048, h: 2048, wrap: THREE.ClampToEdgeWrapping, mipmaps: true,
    frag: /* glsl */ `
      const vec3 C0 = vec3(${IRON_BLUE.map(v => v.toFixed(4)).join(',')});
      const vec3 C1 = vec3(${OIII.map(v => v.toFixed(4)).join(',')});
      const vec3 C2 = vec3(${SULFUR.map(v => v.toFixed(4)).join(',')});
      const vec3 C3 = vec3(${HALPHA.map(v => v.toFixed(4)).join(',')});
      float ridge(vec2 p, int oct){ float a = 0.5, s = 0.0, n = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 6; i++){ if (i >= oct) break; float v = 1.0 - abs(2.0 * vnoise(p) - 1.0); s += a * pow(v, 4.0); n += a; p = m * p; a *= 0.5; } return s / n; }
      void main(){
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        // an old remnant (think Vela): no clean ring — a faint diffuse cloud, and long wisps that gather
        // loosely in a broad, broken shell; H-alpha and OIII in large regions, a little sulfur
        float cloud = smoothstep(0.38, 0.85, fbm(p * 1.7 + 3.0, 5)) * smoothstep(1.0, 0.25, r);
        vec2 q = p * 2.1;
        q += 0.5 * vec2(fbm(q * 0.8 + 1.7, 4), fbm(q * 0.8 + 8.3, 4));
        float fil = pow(ridge(q, 6), 2.4);
        float fil2 = pow(ridge(q * 2.7 + 5.0, 5), 3.0);
        float shellish = smoothstep(0.18, 0.55, r) * smoothstep(1.0, 0.72, r);
        float patchy = smoothstep(0.3, 0.7, fbm(p * 1.2 + 7.0, 3));
        float m = cloud * 0.22 + (fil * (0.25 + 0.95 * shellish) + 0.5 * fil2 * shellish) * patchy * smoothstep(1.0, 0.8, r);
        float inner = exp(-pow(r / 0.2, 2.0)) * 0.3 * fbm(p * 6.0 + 3.0, 4);    // the faint wind nebula at the heart
        float hue = 0.6 * vnoise(p * 1.4 + 11.0) + 0.4 * vnoise(p * 3.1 + 2.0);
        vec3 col = mix(C3 * 1.05, C1 * 1.3, smoothstep(0.36, 0.52, hue));
        col = mix(col, C2, 0.3 * smoothstep(0.6, 0.75, fbm(p * 2.4 + 5.0, 3)));
        col = col * m + mix(C0, vec3(0.8, 0.75, 1.0), 0.5) * inner;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const nebScene = new THREE.Scene();
  const nebU = { uGain: { value: 0.08 } };
  const nebLayers = [];
  for (const [z, sc, rot, g] of [[-7, 46, 0.0, 0.45], [0, 40, 2.1, 0.7], [6, 34, 4.0, 0.4]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { tex: { value: nebTex }, uGain: nebU.uGain, uK: { value: g } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform sampler2D tex; uniform float uGain, uK; varying vec2 vUv;
        void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * uGain * uK, 1.0); }`,
    }));
    m.position.set(0, 0, z); m.rotation.z = rot; m.frustumCulled = false;
    nebScene.add(m); nebLayers.push(m);
  }

  // ---- the beams: half-resolution ray-march through the two cones ------------------------------
  const low = new kit.LowRes(W, H, 0.5);
  const beamU = {
    uInvProj: { value: new THREE.Matrix4() }, uCamW: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
    uM: { value: new THREE.Vector3(0, 1, 0) }, uT: { value: 0 }, uGain: { value: 1 }, uCol: { value: new THREE.Vector3(...PULSAR) },
    uTan: { value: Math.tan(6 * D2R) },
  };
  const beams = kit.fullscreen(/* glsl */ `
    uniform mat4 uInvProj, uCamW; uniform vec3 uCamPos, uM, uCol; uniform float uT, uGain, uTan;
    // emission of one cone (axis m) at point p: narrow angular profile, energy thinning with distance,
    // turbulent along its length (plasma in the beam)
    float cone(vec3 p, vec3 m){
      float s = dot(p, m);
      if (s <= 0.05) return 0.0;
      float rho = length(p - s * m);
      float th = rho / (s * uTan);                         // 1 at the 6° edge
      float prof = exp(-th * th * 2.2);
      float n = 0.45 + 0.9 * vnoise(vec2(s * 0.55 - uT * 3.0, dot(m, vec3(7.0, 3.0, 1.0)))) * vnoise(vec2(s * 1.7 + 4.0, rho * 3.0));
      return prof * n * (1.0 / (1.0 + 0.10 * s * s) + 0.015) * smoothstep(40.0, 30.0, s);
    }
    void main(){
      vec2 ndc = vUv * 2.0 - 1.0;
      vec4 v = uInvProj * vec4(ndc, 1.0, 1.0);
      vec3 rd = normalize((uCamW * vec4(v.xyz / v.w, 0.0)).xyz);
      vec3 ro = uCamPos;
      // intersect the 40-unit sphere around the star
      float b = dot(ro, rd), c = dot(ro, ro) - 1600.0, h = b * b - c;
      if (h <= 0.0) { gl_FragColor = vec4(0.0); return; }
      h = sqrt(h);
      float t0 = max(-b - h, 0.0), t1 = -b + h;
      if (t1 <= t0) { gl_FragColor = vec4(0.0); return; }
      // both cones share one axis line: sample a window around the ray's closest approach to that line,
      // as wide as the cone is there (seen obliquely the window stretches; capped by the sphere)
      float bm = dot(rd, uM), dm = dot(rd, ro), em = dot(uM, ro);
      float den = max(1.0 - bm * bm, 1e-4);
      float tcl = (bm * em - dm) / den;
      float scl = abs(em + bm * tcl);
      float hw = clamp((scl * uTan * 2.6 + 0.6) / sqrt(den), 0.8, 80.0);
      float ta = max(t0, tcl - hw), tb = min(t1, tcl + hw);
      if (den < 0.03 || 2.0 * hw > t1 - t0) { ta = t0; tb = t1; }   // nearly along the axis: the whole chord
      if (tb <= ta) { gl_FragColor = vec4(0.0); return; }
      float acc = 0.0;
      float j = 0.5 + 0.3 * (hash12(gl_FragCoord.xy) - 0.5);
      float dt = (tb - ta) / 28.0;
      for (int i = 0; i < 28; i++){
        vec3 p = ro + rd * (ta + (float(i) + j) * dt);
        acc += (cone(p, uM) + cone(p, -uM)) * dt;
      }
      gl_FragColor = vec4(uCol * acc * uGain, 1.0);
    }`, beamU, { blending: THREE.AdditiveBlending, transparent: true });
  const comp = kit.compositor();

  // beam geometry for time t and LOS ℓ (star → camera): spin axis Ω at 45° from ℓ, tilted 20° in the
  // image plane; magnetic axis m(φ) on the 45° cone around Ω with m(0) = ℓ
  const tmp = new THREE.Vector3();
  function magAxis(t, camPos, camQuat) {
    const l = camPos.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camQuat);
    const upP = up.sub(l.clone().multiplyScalar(up.dot(l))).normalize();          // frame-vertical ⟂ ℓ
    const rgt = new THREE.Vector3().crossVectors(upP, l).normalize();
    const tilt = upP.clone().multiplyScalar(Math.cos(20 * D2R)).add(rgt.clone().multiplyScalar(Math.sin(20 * D2R)));
    const Om = l.clone().multiplyScalar(Math.SQRT1_2).add(tilt.multiplyScalar(Math.SQRT1_2)).normalize();
    const e1 = l.clone().sub(Om.clone().multiplyScalar(l.dot(Om))).normalize();
    const e2 = new THREE.Vector3().crossVectors(Om, e1).normalize();
    const ph = 2 * Math.PI * (t - T0) / P;
    return Om.multiplyScalar(Math.SQRT1_2).add(e1.multiplyScalar(Math.SQRT1_2 * Math.cos(ph))).add(e2.multiplyScalar(Math.SQRT1_2 * Math.sin(ph))).normalize();
  }
  // the spike state on a frame: [frames since the last pulse frame, k]
  function spike(frame) {
    for (let k = 0; k < 12; k++) { const F = pulseFrame(k); if (frame >= F && frame <= F + 2) return frame - F; }
    return -1;
  }
  const EV30 = [1.5, 0.9, 0.35], EV31 = [0.6, 0.35, 0.12];

  return {
    render(shot, f) {
      const t = f.t, frame = Math.round(t * FPS);
      const ps = pose(t);
      cam.setFocalLength(ps.mm);
      cam.position.copy(ps.pos); cam.rotation.set(0, ps.psi, 0); cam.updateMatrixWorld();
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      const dist = ps.pos.length();
      const fpx = fpxOf(ps.mm) * S;
      const sp = spike(frame);
      const lit = t >= T0 - 0.5 / FPS;                    // nothing at all before the first beam
      // neutron star: radius 0.06 units, HDR 8 when resolved; far away it dims (but stays a point)
      const rpx = 0.06 * fpx / dist / S;
      const farDim = Math.min(1, Math.pow(D1 / dist, 1.1));
      let I = lit ? 8 * Math.max(0.2, farDim) : 0;
      if (lit && t < T0 + 1.0) I *= 0.25 + 0.75 * Math.min(1, (t - T0) / 1.0);   // it emerges from the first flash
      if (sp >= 0 && shot.id === 'S31') I *= Math.pow(2, EV31[sp]) * 1.6;          // the local flash of the far point
      if (sp >= 0 && shot.id === 'S30') I *= [6.0, 2.5, 1.4][sp];            // the beam is in the lens
      nsU.uI.value = I / NSUB; nsU.uRpx.value = rpx; nsU.uHalf.value = 24 + 2 * rpx;
      for (let k = 0; k < NSUB; k++) {
        placeCam(camP, pose(t + (0.5 / FPS) * ((k + 0.5) / NSUB - 0.5)));
        const v = new THREE.Vector3(0, 0, 0).project(camP);
        nsPos.setXYZ(k, v.x, v.y, 0);
      }
      nsPos.needsUpdate = true;
      stars.material.uniforms.brightness.value = 0.2;
      renderer.setRenderTarget(f.target);
      renderer.setClearColor(0x000000, 1); renderer.clear();
      const ac = renderer.autoClear; renderer.autoClear = false;
      // nebula billboards (facing the original line of sight), full resolution: the wisps are fine
      nebU.uGain.value = lit ? 0.18 * Math.min(1, (t - T0 + 0.5) / 1.5) : 0;
      renderer.render(nebScene, cam);
      renderer.render(scene, cam);
      renderer.render(nsScene, ortho);
      // half resolution: the beams
      renderer.setRenderTarget(low.rt); renderer.clear();
      if (lit) {
        beamU.uInvProj.value.copy(cam.projectionMatrixInverse);
        beamU.uCamW.value.copy(cam.matrixWorld);
        beamU.uCamPos.value.copy(cam.position);
        beamU.uM.value.copy(magAxis(t, cam.position, cam.quaternion));
        beamU.uT.value = t;
        // far away (S31 pull-back) the beams dissolve into the point: only its flash is left
        const farBeam = Math.min(1, Math.max(0.0, (200 - dist) / 120));
        beamU.uGain.value = 0.55 * Math.min(1, (t - T0 + 0.1) / 0.4) * farBeam * farBeam;
        beams.render(renderer, low.rt);
      }
      comp.material.uniforms.tex.value = low.texture; comp.material.uniforms.gain.value = 1;
      comp.render(renderer, f.target);
      renderer.autoClear = ac;
    },
    post(shot, f) {
      const frame = Math.round(f.t * FPS);
      const sp = spike(frame);
      // S30: the rhythm is told only by whole-frame exposure spikes; S31: the far point flashes locally
      const ev = shot.id === 'S30' && sp >= 0 ? EV30[sp] : 0;
      return { exposure: Math.pow(2, ev), streak: 0.3, bloom: 0.8 };
    },
  };
}
