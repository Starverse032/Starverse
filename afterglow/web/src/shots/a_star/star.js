// a_star / star — S02-d after the hand-off: the star with volume, the tightening, the collapse, the still
// point and the supernova flash.  Screen-space analytic sphere centred on R (the star stays on R, its
// screen radius is starRadiusPx(fr) = camera magnification × its own radius), drawn additively over
// A1's dimmed web.  Surface: two layers of baked 3D-cellular granulation on the sphere, turning about
// different axes at different speeds (the granules visibly flow), limb darkening, a 3 px IRON_BLUE
// chromosphere with spicules, a 1.4 R coronal halo with streamers.
import * as THREE from 'three';
import * as C from './curves.js';

const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const hexv = h => new THREE.Vector3(srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255));

// a quad covering a pixel rect (1080p px, y down) — fragment work only where the object is
export function rectQuad(material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0]), 3));
  const mesh = new THREE.Mesh(geo, material); mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { scene, cam, mesh };
}
export const RECT_VS = /* glsl */ `
  uniform vec4 uRect;            // x0, y0, x1, y1 (1080p px, y down)
  varying vec2 vPx;              // 1080p px, y down
  void main(){
    vPx = mix(uRect.xy, uRect.zw, position.xy);
    vec2 ndc = vec2(vPx.x / 960.0 - 1.0, 1.0 - vPx.y / 540.0);
    gl_Position = vec4(ndc, 0.0, 1.0);
  }`;

export function createStar(ctx) {
  const { renderer, kit, GLSL } = ctx;
  // ---- granulation: equirect, R = granules (≈ 125 around the equator), G = finer granules, B = supergranulation
  const granTex = kit.bake(renderer, {
    w: 2048, h: 1024, wrap: THREE.RepeatWrapping,
    frag: /* glsl */ `
      vec3 dirOf(vec2 uv){ float lon = (uv.x - 0.5) * TAU, lat = (uv.y - 0.5) * PI; return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); }
      float gran(vec3 p, float seed){
        vec3 q = p + 0.35 * vec3(snoise(p * 0.7 + seed), snoise(p * 0.7 + seed + 11.0), snoise(p * 0.7 + seed + 23.0));
        vec2 w = worley(q);
        float lane = smoothstep(0.0, 0.32, w.y - w.x);                   // dark intergranular lanes
        float cell = ihash3v(ivec3(floor(q * 1.0) + seed)).x;
        float dome = 1.0 - smoothstep(0.1, 0.75, w.x);                   // bright cell centres
        return lane * (0.55 + 0.45 * dome) * (0.8 + 0.4 * cell);
      }
      void main(){
        vec3 d = dirOf(vUv);
        float a = gran(d * 20.0, 3.0);
        float b = gran(d * 33.0, 17.0);
        float s = fbm(d * 3.5 + 5.0, 4);
        gl_FragColor = vec4(a, b, s, 1.0);
      }`,
  });
  granTex.wrapT = THREE.ClampToEdgeWrapping;

  const U = {
    uRect: { value: new THREE.Vector4() }, uR: { value: 60 }, uI: { value: 0.7 }, uGain: { value: 1 },
    uTex: { value: granTex }, uRotA: { value: new THREE.Matrix3() }, uRotB: { value: new THREE.Matrix3() },
    uTight: { value: 0 }, uPulse: { value: 0 }, uCollapse: { value: 0 }, uRa: { value: 60 }, uRb: { value: 60 },
    uDisk: { value: hexv(0xE6EEFF).multiplyScalar(1.0) }, uLimb: { value: new THREE.Vector3(0.20, 0.36, 1.0) }, uIron: { value: hexv(0x6FA8FF) }, uStar: { value: hexv(0xBFD4FF) },
    uFr: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
    // premultiplied "over": the disc hides the web behind it, the halo adds
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: RECT_VS,
    fragmentShader: GLSL.common + GLSL.noise + /* glsl */ `
      float anoise(float th, float k, float y){ return vnoise(vec3(cos(th) * k / 6.2831853, sin(th) * k / 6.2831853, y)); }
      varying vec2 vPx;
      uniform float uR, uI, uGain, uTight, uPulse, uCollapse, uRa, uRb, uFr;
      uniform sampler2D uTex; uniform mat3 uRotA, uRotB;
      uniform vec3 uDisk, uLimb, uIron, uStar;
      vec2 eqUV(vec3 n){ float lon = atan(n.x, n.z); float lat = asin(clamp(n.y, -1.0, 1.0)); return vec2(lon / TAU + 0.5, lat / PI + 0.5); }
      vec4 samp(vec3 n){
        vec2 uv = eqUV(n);
        // the seam: sample with explicit gradients of the continuous longitude
        vec2 g1 = vec2(fwidth(uv.x), fwidth(uv.y));
        if (g1.x > 0.25) g1.x = fwidth(fract(uv.x + 0.5));
        return textureGrad(uTex, uv, vec2(g1.x, 0.0), vec2(0.0, g1.y));
      }
      void main(){
        vec2 d = vPx - vec2(${C.RX.toFixed(1)}, ${C.RY.toFixed(1)});
        float r = length(d);
        float x = r / uR;
        vec3 col = vec3(0.0); float alpha = 0.0;
        // ---- disc (analytic motion blur of the edge over the shutter: coverage between uRb and uRa)
        float cov = uRa > uRb + 0.05 ? clamp((uRa - r) / (uRa - uRb), 0.0, 1.0) : clamp(uR - r + 0.5, 0.0, 1.0);
        if (cov > 0.0) {
          vec2 p = d / max(uR, 1e-3) * vec2(1.0, -1.0);
          float pr = min(dot(p, p), 1.0);
          float mu = sqrt(1.0 - pr);
          vec3 n = vec3(p, mu);
          vec4 A = samp(uRotA * n), B = samp(uRotB * n);
          // granules: layer A + layer B (flowing against each other); tightening → the finer channel
          float g = mix(A.r * 0.62 + B.r * 0.38, A.g * 0.6 + B.g * 0.4, uTight);
          float sg = A.b;
          float limb = 0.10 + 0.90 * pow(mu, 0.95);
          // granulation contrast fades towards the limb, where bright faculae (supergranule network) take over
          float gc = mix(1.05, 1.35, uTight) * mix(1.0, 0.4, smoothstep(0.0, 0.7, 1.0 - mu));
          float fac = smoothstep(0.55, 0.8, sg) * smoothstep(0.35, 0.95, 1.0 - mu);
          float I = uI * limb * (1.0 + gc * (g - 0.55) + 0.14 * (sg - 0.5) + 0.55 * fac);
          I *= 1.0 + 0.35 * uPulse;
          vec3 c = mix(uLimb, uDisk, pow(mu, 0.45));
          c = mix(c, uIron * 1.2, 0.30 * uTight * (1.0 - 0.5 * mu));         // bluer while it holds its breath
          // collapse: the surface streams radially inwards, the light concentrates in the centre
          if (uCollapse > 0.0) {
            float th = atan(p.y, p.x);
            float streak = 0.55 + 0.9 * pow(anoise(th, 38.0, 0.0) * 0.6 + anoise(th, 91.0, 3.0) * 0.4, 1.6);
            float flow = anoise(th, 24.0, log(max(sqrt(pr), 1e-3)) * 3.0 + uFr * 0.9);
            I = mix(I, uI * (0.5 + 0.8 * flow) * streak * (0.5 + 1.6 * exp(-pr * 3.0)), smoothstep(0.0, 0.5, uCollapse));
            I *= 1.0 + 2.5 * uCollapse * exp(-pr * 6.0);
          }
          col += c * I * cov;
          alpha = cov;
        }
        // ---- inward trails of the collapsing limb (radial streaks between the shutter radii, faint)
        if (uCollapse > 0.0 && r > uRb && r < uRa + 6.0) {
          float th = atan(d.y, d.x);
          col += uIron * 0.12 * uI * pow(anoise(th, 60.0, 1.0), 2.0) * smoothstep(uRa + 6.0, uRb, r);
        }
        // ---- chromosphere: 3 px IRON_BLUE layer just outside the limb, broken into spicules
        float th = atan(d.y, d.x);
        float sp = 0.65 + 0.35 * anoise(th, 140.0, uFr * 0.05) + 0.25 * anoise(th, 37.0, 7.0 + uFr * 0.02);
        float h = r - uR;                                                    // px above the limb
        float chrom = smoothstep(-2.0, 0.0, h) * exp(-max(h, 0.0) / (1.2 + 2.2 * sp));
        col += mix(uIron, uStar, 0.35) * chrom * (0.55 + 0.55 * uTight) * sp * uI * (1.0 - smoothstep(0.0, 0.8, uCollapse));
        // ---- coronal halo to ≈ 1.4 R at ≈ 3 %, with faint streamers
        float str = 1.0 + 0.5 * (anoise(th, 6.0, 2.0) - 0.5) + 0.35 * (anoise(th, 17.0, 9.0) - 0.5);
        float halo = 0.030 * exp(-max(x - 1.0, 0.0) / (0.16 * str)) * smoothstep(0.98, 1.02, x);
        col += mix(uStar, uIron, smoothstep(1.0, 1.4, x)) * halo * uI * (1.0 - uCollapse);
        gl_FragColor = vec4(col * uGain, alpha * uGain);
      }`,
  });
  const disc = rectQuad(mat);

  // ---- the still point and the flash (point-spread function, cold white) -------------------------
  const PU = { uRect: { value: new THREE.Vector4() }, uP: { value: 0 }, uF: { value: 0 }, uCore: { value: 0 } };
  const pmat = new THREE.ShaderMaterial({
    uniforms: PU, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: RECT_VS,
    fragmentShader: /* glsl */ `
      varying vec2 vPx; uniform float uP, uF, uCore;
      void main(){
        vec2 d = vPx - vec2(${C.RX.toFixed(1)}, ${C.RY.toFixed(1)});
        float r2 = dot(d, d), r = sqrt(r2);
        // the point: 4 px (diameter) flat-topped core + a small soft skirt
        float pt = smoothstep(2.6, 1.4, r) + 0.06 * exp(-r / 4.0);
        // the flash: 1.3 px core, Moffat wing, faint wide halation (the bloom does the 400 px glow)
        float fl = exp(-0.5 * r2 / 1.7) + 0.02 * pow(1.0 + r2 / 9.0, -1.6) + 0.0006 * exp(-r / 60.0);
        float core = exp(-0.5 * r2 / 20.0) + 0.05 * exp(-r / 26.0);
        vec3 c = vec3(0.86, 0.92, 1.0) * uP * pt + vec3(0.92, 0.96, 1.0) * uF * fl + vec3(0.62, 0.80, 1.0) * uCore * core;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const point = rectQuad(pmat);

  // flow phase: ∫ (1 + 2·tighten) dfr — the granules flow ×3 during the tightening
  const phase = fr => { let s = 0; const a = 1212, n = Math.max(0, Math.ceil((fr - a) / 0.5)); for (let i = 0; i < n; i++) { const f = a + (i + 0.5) * (fr - a) / n; s += (1 + 2 * C.tighten(f)) * (fr - a) / n; } return s; };
  const axA = new THREE.Vector3(0.25, 1, 0.12).normalize(), axB = new THREE.Vector3(-0.4, 0.9, -0.2).normalize();
  const m4 = new THREE.Matrix4();

  return {
    texture: granTex,
    /** draw the star (disc / point / flash) additively into the current target */
    render(fr, target) {
      const r = C.starRadiusPx(fr);
      const sh = 0.25;                                          // 180° shutter: ± 1/4 frame
      U.uR.value = r; U.uRa.value = C.starRadiusPx(fr - sh); U.uRb.value = C.starRadiusPx(fr + sh);
      const tight = C.tighten(fr), col = C.collapseU(fr);
      U.uTight.value = tight; U.uPulse.value = C.pulse(fr); U.uCollapse.value = col; U.uFr.value = fr;
      U.uI.value = 1.0;
      U.uGain.value = C.discGain(fr) * (fr < 1331 ? 1 : 0);
      const ph = phase(fr);
      U.uRotA.value.setFromMatrix4(m4.makeRotationAxis(axA, 0.0016 * ph));
      U.uRotB.value.setFromMatrix4(m4.makeRotationAxis(axB, -0.0011 * ph - 0.6));
      renderer.setRenderTarget(target);
      if (U.uGain.value > 0) {
        const e = Math.max(r, U.uRa.value) * 1.5 + 12;
        U.uRect.value.set(C.RX - e, C.RY - e, C.RX + e, C.RY + e);
        renderer.render(disc.scene, disc.cam);
      }
      const P = C.pointI(fr), F = C.flashI(fr);
      const core = fr > 1344 ? 4 * Math.exp(-Math.max(0, fr - 1348) / 40) * C.s5(1344, 1348, fr) : 0;
      if (P > 0 || F > 0 || core > 0) {
        PU.uP.value = fr < 1344 ? P : P * Math.max(0, 1 - (fr - 1344) / 3);
        PU.uF.value = F; PU.uCore.value = core;
        const e = F > 5 ? 420 : 140;
        PU.uRect.value.set(C.RX - e, C.RY - e, C.RX + e, C.RY + e);
        renderer.render(point.scene, point.cam);
      }
    },
  };
}
