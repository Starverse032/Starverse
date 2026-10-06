// Building blocks for shots. The golden rule on this CPU renderer: bake anything static
// (skies, nebulae, planet surface maps, text atlases) ONCE at init into textures, then do
// cheap lookups per frame. Animate with transforms, uniforms and a few texture fetches.
import * as THREE from 'three';
import * as GLSL from './glsl.js';
import { FSQ, makeRT } from '../post.js';
import { rng } from './util.js';

const VS_UV = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Render a fullscreen fragment shader once into a texture.
// frag: GLSL body with `varying vec2 vUv;` available and GLSL.all prepended; must write gl_FragColor.
export function bake(renderer, { frag, w = 2048, h = 2048, uniforms = {}, mipmaps = true, wrap = THREE.RepeatWrapping, float = true }) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: float ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat,
    minFilter: mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter: THREE.LinearFilter,
    generateMipmaps: mipmaps, depthBuffer: false, wrapS: wrap, wrapT: wrap,
  });
  const mat = new THREE.ShaderMaterial({ vertexShader: VS_UV, fragmentShader: GLSL.all + '\nvarying vec2 vUv;\n' + frag, uniforms, depthTest: false, depthWrite: false });
  const fsq = new FSQ(mat);
  const prev = renderer.getRenderTarget();
  fsq.render(renderer, rt);
  renderer.setRenderTarget(prev);
  mat.dispose();
  rt.texture.wrapS = rt.texture.wrapT = wrap;
  rt.texture.anisotropy = 4;
  return rt.texture;
}

// Bake an equirectangular sky. `dirFrag` is GLSL that defines `vec3 sky(vec3 dir)`.
// Returns a texture to use with skyDome().
export function bakeSky(renderer, { dirFrag, w = 4096, h = 2048, uniforms = {} }) {
  return bake(renderer, {
    w, h, uniforms, wrap: THREE.ClampToEdgeWrapping,
    frag: dirFrag + /* glsl */ `
      void main(){
        float lon = (vUv.x - 0.5) * TAU; float lat = (vUv.y - 0.5) * PI;
        vec3 d = vec3(cos(lat) * sin(lon), sin(lat), -cos(lat) * cos(lon));
        gl_FragColor = vec4(sky(d), 1.0);
      }`,
  });
}

// Large inside-out sphere sampling an equirect texture. Uniforms: gain (brightness), tint.
export function skyDome(tex, { radius = 5000, gain = 1, tint = [1, 1, 1] } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { tex: { value: tex }, gain: { value: gain }, tint: { value: new THREE.Vector3(...tint) }, rot: { value: new THREE.Matrix3() } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: GLSL.common + /* glsl */ `varying vec3 vDir; uniform sampler2D tex; uniform float gain; uniform vec3 tint; uniform mat3 rot;
      void main(){ vec3 d = normalize(rot * vDir); vec2 uv = vec2(atan(d.x, -d.z) / TAU + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
        gl_FragColor = vec4(texture2D(tex, uv).rgb * gain * tint, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), mat);
  m.frustumCulled = false; m.renderOrder = -1000;
  return m;
}

// Point-sprite star field on a sphere shell (or in a volume with `volume: true`).
// Stars have a magnitude distribution (few bright, many faint), blackbody colours and a
// Gaussian PSF; size/brightness are resolution-aware so they stay crisp, not blobby.
// Uniforms you may animate: opacity, sizeScale, twinkle, time.
export function starfield({ count = 30000, seed = 1, radius = 3000, volume = false, inner = 0, H = 1080, sizeScale = 1, brightness = 1, warm = 0.5, distribution = null } = {}) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3), mag = new Float32Array(count), temp = new Float32Array(count), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let p;
    if (distribution) p = distribution(r, i);
    else {
      const s = r.sphere();
      const rad = volume ? inner + (radius - inner) * Math.cbrt(r()) : radius;
      p = [s[0] * rad, s[1] * rad, s[2] * rad];
    }
    pos.set(p, i * 3);
    mag[i] = Math.pow(r(), 9) * 0.97 + r() * 0.03;   // 0..1, heavily skewed towards faint
    temp[i] = r() < warm ? 2800 + r() * 3500 : 5500 + Math.pow(r(), 2) * 16000;
    ph[i] = r() * 6.283;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
  g.setAttribute('temp', new THREE.BufferAttribute(temp, 1));
  g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { H: { value: H }, sizeScale: { value: sizeScale }, opacity: { value: 1 }, brightness: { value: brightness }, twinkle: { value: 0 }, time: { value: 0 } },
    vertexShader: GLSL.common + /* glsl */ `
      attribute float mag, temp, ph; uniform float H, sizeScale, brightness, twinkle, time; varying vec3 vCol; varying float vI;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = H / 1080.0;
        float size = (1.6 + 7.0 * pow(mag, 1.5)) * sizeScale * px;
        gl_PointSize = max(size, 1.0);
        float tw = 1.0 + twinkle * 0.35 * sin(time * (3.0 + 5.0 * fract(ph * 7.1)) + ph * 9.0);
        vI = (0.05 + 3.5 * mag * mag) * brightness * tw;
        vCol = blackbody(temp);
      }`,
    fragmentShader: /* glsl */ `
      uniform float opacity; varying vec3 vCol; varying float vI;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d) * 4.0; float psf = exp(-r2 * 6.0) + 0.04 * exp(-r2 * 1.2);
        gl_FragColor = vec4(vCol * vI * psf * opacity, 1.0); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

// A camera helper that also exposes the visible (letterboxed) vertical FOV.
// Shots should frame for the 2.39:1 band: content outside f.barPx..H-f.barPx is hidden.
export function filmCamera(W, H, { focalMM = 35, near = 0.1, far = 20000 } = {}) {
  const cam = new THREE.PerspectiveCamera(40, W / H, near, far);
  cam.setFocalLength(focalMM); // based on 35mm film (36mm wide) and the 16:9 frame
  cam.filmGauge = 36;
  return cam;
}

// Fullscreen shader pass rendered into the current shot target (or a half-res target).
export function fullscreen(frag, uniforms = {}, { blending = THREE.NoBlending, transparent = false } = {}) {
  const mat = new THREE.ShaderMaterial({ vertexShader: VS_UV, fragmentShader: GLSL.all + '\nvarying vec2 vUv;\n' + frag, uniforms, depthTest: false, depthWrite: false, blending, transparent });
  return new FSQ(mat);
}

// Half/quarter resolution helper: render expensive content at lower res, then composite.
export class LowRes {
  constructor(W, H, scale = 0.5) { this.rt = makeRT(Math.round(W * scale), Math.round(H * scale), { depth: true }); }
  get texture() { return this.rt.texture; }
}

// Upscale-composite a texture into the current target (additive or normal blending).
export function compositor() {
  return fullscreen(/* glsl */ `uniform sampler2D tex; uniform float gain; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * gain, 1.0); }`,
    { tex: { value: null }, gain: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
}
