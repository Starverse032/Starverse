// b_flight/far.js — the far field of long take B: stars, the Earth after the turn, the two planets,
// the blue dot (until f3780, when w_sea's hand-off layer takes over the same pixels), the record's glint.
//
// Stars. Two sets, both at infinity, so they only respond to the lens's rotation:
//   · the hand-off stars (w_sea/handoff.js handoffStars(): the WEB nodes seen from WEB_PATH(9.0)) are the
//     only stars inside the final frame (yaw 170°, 24 mm): their world directions are the final lens's
//     rays through their pixel centres, so from f3552 each one sits on its own pixel with the hand-off
//     layer's exact value (1 px, display 28–84, warm-neutral). During the turn they streak;
//   · a sparse cold field everywhere else (none of them inside the final frame), seen in S06 and
//     streaking through the 170° turn; analytic trails = half the frame's displacement (180° shutter),
//     energy kept along the trail — no strobing, no sub-frames.
import * as THREE from 'three';
import { handoffStars, BLUE_DOT, PBD } from '../w_sea/handoff.js';
import { hdrForDisplay } from '../w_sea/lexicon.js';
import * as P from './path.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = h => [s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255)];

const TRAIL_VS = /* glsl */ `
  attribute vec3 aDir; attribute vec4 aC;          // aC: rgb HDR, w = radius (1080p px)
  uniform mat4 uPV, uPVp; uniform vec2 uRes; uniform float uPx, uBox, uGain;
  varying vec2 vP; varying vec2 vA; varying vec2 vB; varying float vR; varying vec3 vCol;
  vec2 toPx(vec4 c){ return (c.xy / c.w * 0.5 + 0.5) * uRes; }
  void main(){
    vec4 c = uPV * vec4(aDir * 1000.0, 1.0), cp = uPVp * vec4(aDir * 1000.0, 1.0);
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec3(0.0);
    if (c.w <= 0.0 || cp.w <= 0.0) return;
    vec2 a = toPx(cp), b = toPx(c);
    float r = aC.w * uPx;
    vec2 lo = min(a, b) - r - 1.0, hi = max(a, b) + r + 1.0;
    if (hi.x < 0.0 || lo.x > uRes.x || hi.y < 0.0 || lo.y > uRes.y) return;
    if (length(b - a) > 0.6 * uRes.x) return;
    vec2 q = mix(lo, hi, position.xy);
    gl_Position = vec4(q / uRes * 2.0 - 1.0, 0.0, 1.0);
    vP = q; vA = a; vB = b; vR = r; vCol = aC.rgb * uGain;
  }`;
const TRAIL_FS = /* glsl */ `
  uniform float uBox; varying vec2 vP; varying vec2 vA; varying vec2 vB; varying float vR; varying vec3 vCol;
  void main(){
    vec2 ab = vB - vA; float L = length(ab);
    float t = L > 1e-4 ? clamp(dot(vP - vA, ab) / (L * L), 0.0, 1.0) : 0.0;
    float d = length(vP - (vA + ab * t));
    float g;
    if (uBox > 0.5) {
      // 1-px box star (the hand-off stars): a 1 × (1 + L) px capsule, flat; energy of one pixel
      vec2 e = abs(vP - (vA + ab * t));
      vec2 tn = L > 1e-4 ? ab / L : vec2(1.0, 0.0);
      float along = abs(dot(vP - (vA + vB) * 0.5, tn)), across = abs(dot(vP - (vA + vB) * 0.5, vec2(-tn.y, tn.x)));
      g = step(along, 0.5 * L + 0.5) * step(across, 0.5) / (1.0 + L);
    } else {
      float s = vR * 0.55;
      g = exp(-0.5 * d * d / (s * s)) / (1.0 + L / (2.2 * s));
      g += 0.03 * exp(-d / (vR * 2.5)) / (1.0 + L / (6.0 * s));
    }
    gl_FragColor = vec4(vCol * g, 1.0);
  }`;

export async function createFar(ctx, { needStars = true, needEarthFar = false, earth = null, needPlanets = false, needDot = false }) {
  const { renderer, W, H, kit } = ctx;
  const S = H / 1080;
  const out = {};
  const quadGeo = () => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]); return g; };

  // ---- stars ----------------------------------------------------------------------------------------
  const HS = handoffStars();
  const lv = [0.11, 0.22, 0.33].map(l => hdrForDisplay('#E9E3D8', l));
  const hsCol = l => { const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u); return l < 0.22 ? mix(lv[0], lv[1], (l - 0.11) / 0.11) : mix(lv[1], lv[2], (l - 0.22) / 0.11); };
  if (needStars) {
    const r = rng(2930);
    const list = [];
    const STAR = hexLin(0xBFD4FF), WHITE = [1, 1, 1];
    for (let i = 0; i < 2600; i++) {
      const z = 2 * r() - 1, a = 6.2831853 * r(), q = Math.sqrt(1 - z * z);
      const d = [q * Math.cos(a), q * Math.sin(a), z];
      const pf = P.project(d, P.LENS_FINAL);
      if (pf[2] > 0 && pf[0] > -80 && pf[0] < 2000 && pf[1] > 80 && pf[1] < 1000) continue;   // the final frame is the hand-off stars' alone
      const m = Math.pow(r(), 7);
      const t = r();
      const col = STAR.map((v, k) => (v * (0.6 + 0.4 * t) + WHITE[k] * (0.4 - 0.4 * t)) * (0.035 + 1.6 * m));
      list.push({ d, col, rad: 1.1 + 1.6 * Math.pow(m, 0.5) });
    }
    const n1 = list.length;
    for (const s of HS) list.push({ d: P.screenDir(s.px + 0.5, s.py + 0.5, P.LENS_FINAL), col: hsCol(s.level), rad: 1, hand: true });
    const mkSet = (arr, box) => {
      const g = quadGeo();
      const dir = new Float32Array(arr.length * 3), c = new Float32Array(arr.length * 4);
      arr.forEach((s, i) => { dir.set(s.d, 3 * i); c.set([...s.col, s.rad], 4 * i); });
      g.setAttribute('aDir', new THREE.InstancedBufferAttribute(dir, 3)); g.setAttribute('aC', new THREE.InstancedBufferAttribute(c, 4));
      g.instanceCount = arr.length;
      const U = { uPV: { value: new THREE.Matrix4() }, uPVp: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(W, H) }, uPx: { value: S }, uBox: { value: box ? 1 : 0 }, uGain: { value: 1 } };
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.frustumCulled = false;
      return { m, U };
    };
    const cold = mkSet(list.slice(0, n1), false), hand = mkSet(list.slice(n1), true);
    // the hand-off stars once the lens is still (f3552 on): w_sea's own point recipe (1 px at the pixel centre)
    const pg = new THREE.BufferGeometry();
    const pp = new Float32Array(HS.length * 3), pc = new Float32Array(HS.length * 3);
    HS.forEach((s, k) => { pp.set([(s.px + 0.5) / 960 - 1, 1 - (s.py + 0.5) / 540, 0], 3 * k); pc.set(hsCol(s.level), 3 * k); });
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('aCol', new THREE.BufferAttribute(pc, 3));
    const still = new THREE.Points(pg, new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { sz: { value: Math.max(1, S) } },
      vertexShader: `attribute vec3 aCol; uniform float sz; varying vec3 vC; void main(){ gl_Position = vec4(position, 1.0); gl_PointSize = sz; vC = aCol; }`,
      fragmentShader: `varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }`,
    }));
    still.frustumCulled = false;
    const sc = new THREE.Scene(); sc.add(cold.m);
    const sh = new THREE.Scene(); sh.add(hand.m);
    const ss = new THREE.Scene(); ss.add(still);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    out.stars = {
      count: list.length, nCold: n1,
      render(target, PV, PVp, n, { coldGain = 1 } = {}) {
        renderer.setRenderTarget(target);
        cold.U.uPV.value.copy(PV); cold.U.uPVp.value.copy(PVp); cold.U.uGain.value = coldGain;
        if (coldGain > 0) renderer.render(sc, ortho);
        if (n < P.TURN[1]) { hand.U.uPV.value.copy(PV); hand.U.uPVp.value.copy(PVp); renderer.render(sh, ortho); }
        else renderer.render(ss, ortho);
      },
    };
  }

  // ---- the Earth, after the turn (far frame: Earth radii, lens at the origin) ---------------------------
  if (needEarthFar && earth) {
    const farScene = new THREE.Scene(); farScene.add(earth.group);
    out.earthFar = {
      scene: farScene,
      place(n) {
        const d = P.earthDist(n);
        earth.group.position.set(P.EARTH_DIR[0] * d, P.EARTH_DIR[1] * d, P.EARTH_DIR[2] * d);
        earth.group.scale.setScalar(1);
        earth.update();
        return d;
      },
    };
  }

  // ---- the planets: screen-space spheres (S07-c), lit from behind, upper right --------------------------
  if (needPlanets) {
    const bake = (frag) => kit.bake(renderer, { w: 1024, h: 512, wrap: THREE.RepeatWrapping, frag });
    const jup = bake(/* glsl */ `
      void main(){
        float lat = (vUv.y - 0.5) * 3.14159; float lon = vUv.x * 6.2831853;
        vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
        float y = sin(lat) + 0.06 * fbm(d * 6.0, 5) - 0.03;
        float b = 0.5 + 0.5 * sin(y * 30.0 + 1.3 * sin(y * 7.0));
        float t = fbm(vec3(d.x * 3.0, y * 22.0, d.z * 3.0), 5);
        vec3 cream = vec3(0.92, 0.84, 0.70), tan = vec3(0.62, 0.43, 0.27), dark = vec3(0.42, 0.28, 0.18);
        vec3 c = mix(tan, cream, smoothstep(0.35, 0.65, b + 0.25 * (t - 0.5)));
        c = mix(c, dark, smoothstep(0.75, 0.95, b * t * 1.6) * 0.5);
        gl_FragColor = vec4(c, 1.0);
      }`);
    const sat = bake(/* glsl */ `
      void main(){
        float lat = (vUv.y - 0.5) * 3.14159; float lon = vUv.x * 6.2831853;
        vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
        float y = sin(lat) + 0.03 * fbm(d * 5.0, 4);
        float b = 0.5 + 0.5 * sin(y * 18.0);
        vec3 c = mix(vec3(0.80, 0.70, 0.52), vec3(0.93, 0.86, 0.68), b * 0.6 + 0.2 * fbm(d * 8.0, 3));
        gl_FragColor = vec4(c, 1.0);
      }`);
    const mkPlanet = (tex, ring) => {
      const U = {
        uTex: { value: tex }, uC: { value: new THREE.Vector2() }, uR: { value: 100 }, uRes: { value: new THREE.Vector2(W, H) }, uPx: { value: S },
        uL: { value: new THREE.Vector3(0.30, 0.25, -0.92).normalize() }, uI: { value: 0 }, uGain: { value: 0.9 }, uDark: { value: hdrForDisplay('#080808', 1)[0] },
        uTilt: { value: new THREE.Matrix3() }, uRing: { value: ring ? 1 : 0 }, uRingN: { value: new THREE.Vector3(0.0, 0.93, 0.36).normalize() },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms: U, transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        vertexShader: /* glsl */ `uniform vec2 uC, uRes; uniform float uR, uPx, uRing; varying vec2 vQ;
          void main(){ float e = uRing > 0.5 ? 2.4 : 1.08; vec2 q = uC + (position.xy * 2.0 - 1.0) * uR * e; vQ = (q - uC) / uR;
            vec2 pr = q * uPx; pr.y = uRes.y - pr.y; gl_Position = vec4(pr / uRes * 2.0 - 1.0, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `uniform sampler2D uTex; uniform vec3 uL, uRingN; uniform float uI, uGain, uDark, uR, uRing; uniform mat3 uTilt; varying vec2 vQ;
          void main(){
            vec2 p = vec2(vQ.x, -vQ.y);                     // y up
            float r2 = dot(p, p);
            float aa = 1.5 / uR;
            float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, sqrt(r2));
            vec3 col = vec3(0.0); float alpha = 0.0;
            float zs = sqrt(max(1.0 - r2, 0.0));
            if (disc > 0.0) {
              vec3 n = vec3(p, zs);
              vec3 m = uTilt * n;
              vec2 uv = vec2(atan(m.z, m.x) / 6.2831853 + 0.5, asin(clamp(m.y, -1.0, 1.0)) / 3.14159 + 0.5);
              vec3 alb = texture2D(uTex, uv).rgb;
              float ndl = dot(n, uL);
              float lit = smoothstep(-0.02, 0.10, ndl) * (0.25 + 0.75 * clamp(ndl * 4.0, 0.0, 1.0));
              // forward-scattering haze at the bright limb
              float limb = pow(1.0 - zs, 3.0) * smoothstep(-0.25, 0.2, ndl);
              col = alb * lit * uGain + vec3(1.0, 0.93, 0.8) * limb * 0.25 * uGain + vec3(uDark) * (0.7 + 0.3 * alb);
              alpha = disc;
              col *= disc;
            }
            if (uRing > 0.5) {
              // ring plane through the centre (orthographic ray along −z): z where the ray meets it
              float zr = -(uRingN.x * p.x + uRingN.y * p.y) / uRingN.z;
              vec3 pr = vec3(p, zr);
              float rr = length(pr);
              float band = smoothstep(1.32, 1.36, rr) * (1.0 - smoothstep(2.05, 2.12, rr)) * (0.55 + 0.45 * sin(rr * 46.0)) * (1.0 - 0.7 * smoothstep(1.62, 1.66, rr) * (1.0 - smoothstep(1.70, 1.74, rr)));
              bool hidden = r2 < 1.0 && zr < zs;                // behind the globe
              float fwd = 0.5 + 0.5 * smoothstep(-0.2, 0.6, dot(normalize(pr), uL));
              vec3 rc = vec3(0.95, 0.88, 0.72) * band * fwd * 0.22 * uGain;
              float ra = band * 0.6;
              if (!hidden) { col = col * (1.0 - ra) + rc; alpha = max(alpha, ra); }
            }
            gl_FragColor = vec4(col * uI, alpha * uI);
          }`,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), mat); mesh.frustumCulled = false;
      return { U, mesh };
    };
    const left = mkPlanet(jup, false), right = mkPlanet(sat, true);
    left.U.uTilt.value.setFromMatrix4(new THREE.Matrix4().makeRotationZ(0.05).multiply(new THREE.Matrix4().makeRotationX(0.25)));
    right.U.uTilt.value.setFromMatrix4(new THREE.Matrix4().makeRotationZ(-0.45).multiply(new THREE.Matrix4().makeRotationX(0.35)));
    right.U.uRingN.value.set(0.42, 0.86, 0.29).normalize();
    const scene = new THREE.Scene(); scene.add(left.mesh, right.mesh);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // screen-space schedules (1080p): centre, diameter (log), all receding (never growing)
    const L_C = [P.pchip([[3576, -760], [3612, -120], [3648, 240], [3696, 330], [3720, 360]]), P.pchip([[3576, 470], [3612, 410], [3648, 360], [3696, 330], [3720, 320]])];
    const L_D = P.pchip([[3576, Math.log(1560)], [3648, Math.log(300)], [3696, Math.log(60)], [3720, Math.log(36)]]);
    const R_C = [P.pchip([[3624, 2420], [3660, 1760], [3690, 1540], [3708, 1470], [3720, 1450]]), P.pchip([[3624, -330], [3660, 180], [3690, 290], [3708, 322], [3720, 330]])];
    const R_D = P.pchip([[3624, Math.log(1500)], [3660, Math.log(330)], [3690, Math.log(110)], [3720, Math.log(44)]]);
    const fade = n => 1 - P.clamp((n - 3708) / 12);
    out.planets = {
      state(n) {
        const s = {};
        if (n >= 3576 && n < 3720) s.left = { c: [L_C[0](n), L_C[1](n)], d: Math.exp(L_D(n)), I: fade(n) };
        if (n >= 3624 && n < 3720) s.right = { c: [R_C[0](n), R_C[1](n)], d: Math.exp(R_D(n)), I: fade(n) };
        return s;
      },
      render(target, n) {
        const s = this.state(n);
        left.mesh.visible = !!s.left; right.mesh.visible = !!s.right;
        if (!s.left && !s.right) return;
        if (s.left) { left.U.uC.value.set(...s.left.c); left.U.uR.value = s.left.d / 2; left.U.uI.value = s.left.I; }
        if (s.right) { right.U.uC.value.set(...s.right.c); right.U.uR.value = s.right.d / 2; right.U.uI.value = s.right.I; }
        renderer.setRenderTarget(target); renderer.render(scene, ortho);
      },
    };
  }

  // ---- the blue dot and the scattered-light band, as w_sea's hand-off layer draws them (morph = 0) ------
  if (needDot) {
    const dotHDR = hdrForDisplay(BLUE_DOT.hex, 1), bandHDR = hdrForDisplay(PBD.hex, PBD.level);
    const U = { dotC: { value: new THREE.Vector3(...dotHDR) }, bandC: { value: new THREE.Vector3(...bandHDR) }, kDot: { value: 0 }, kBand: { value: 0 },
      res: { value: new THREE.Vector2(W, H) }, center: { value: new THREE.Vector2(...BLUE_DOT.center) } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float kDot, kBand; uniform vec3 dotC, bandC; uniform vec2 res, center;
        void main(){
          vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) * (1080.0 / res.y);
          vec2 aq = abs(px - center);
          float sq = step(aq.x, 2.0) * step(aq.y, 2.0);
          vec3 col = dotC * sq * kDot + bandC * kBand * exp(-0.5 * pow((px.x - 824.0) / 70.0, 2.0)) * (1.0 - sq * kDot);
          gl_FragColor = vec4(col, 1.0); }`,
    }));
    m.frustumCulled = false;
    const sc = new THREE.Scene(); sc.add(m);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    out.dot = { U, render(target, kDot, kBand) { if (kDot <= 0 && kBand <= 0) return; U.kDot.value = kDot; U.kBand.value = kBand; renderer.setRenderTarget(target); renderer.render(sc, ortho); } };
  }

  // ---- the golden record's glint (a reflection: HDR 6, six frames, a small halo) -------------------------
  {
    const U = { uC: { value: new THREE.Vector2() }, uI: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, uPx: { value: S } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform vec2 uC, uRes; uniform float uPx; varying vec2 vQ; void main(){ vec2 q = uC + (position.xy * 2.0 - 1.0) * 60.0; vQ = q - uC; vec2 pr = q * uPx; pr.y = uRes.y - pr.y; gl_Position = vec4(pr / uRes * 2.0 - 1.0, 0.0, 1.0); }`,
      fragmentShader: `uniform float uI; varying vec2 vQ; void main(){ float r = length(vQ); float g = exp(-0.5 * r * r / 1.7) + 0.035 * exp(-r / 7.0) + 0.006 * exp(-r / 22.0);
        gl_FragColor = vec4(vec3(1.0, 0.80, 0.46) * uI * g, 1.0); }`,
    }));
    m.frustumCulled = false;
    const sc = new THREE.Scene(); sc.add(m);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    out.glint = { render(target, c, I) { if (I <= 0) return; U.uC.value.set(c[0], c[1]); U.uI.value = I; renderer.setRenderTarget(target); renderer.render(sc, ortho); } };
  }
  return out;
}

// glint envelope: f3456 attack, peak f3457, ~exponential decay, over by f3462 (six frames)
export const glintEnv = n => { const u = n - P.GLINT_FRAME; if (u < -0.5 || u > 5.5) return 0; if (u < 1) return 0.5 + 0.5 * P.clamp(u + 0.5); return Math.exp(-(u - 1) * 0.7); };
