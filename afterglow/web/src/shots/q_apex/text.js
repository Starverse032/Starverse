// q_apex text helpers: crisp canvas2D text planes (ink + a separate soft halo), ink masks and
// point sampling inside the ink. Everything is in 1080p pixel space (x right, y down).
import * as THREE from 'three';

export const SS = 2;   // canvas px per 1080p px (supersampled ink: crisp at 1080p, clean at 720p)

// ---- measuring: the ink box of a string drawn at (x, baseline) ---------------------------------
// canvas2D actualBoundingBox* is used for the layout, a pixel scan for the vertical ink centre.
export function inkBox(text, font, { rtl = false } = {}) {
  const fpx = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)[1]);
  const c = document.createElement('canvas'); const w = Math.ceil(fpx * (text.length + 4)), h = Math.ceil(fpx * 3);
  c.width = w; c.height = h;
  const g = c.getContext('2d'); g.font = font; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  if (rtl) g.direction = 'rtl';
  g.textAlign = 'left';
  const adv = g.measureText(text).width;
  const bx = fpx, by = Math.round(fpx * 2);
  g.fillText(text, bx, by);
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[4 * (y * w + x) + 3] > 40) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  // relative to the pen origin (x = 0 at the pen, y = 0 at the baseline)
  return { adv, left: x0 - bx, right: x1 + 1 - bx, top: y0 - by, bottom: y1 + 1 - by, fpx };
}

// ---- a text plane --------------------------------------------------------------------------
// items: [{ text, font, x, baseline, rtl? }] in 1080p px. The plane covers `rect` [x0, y0, x1, y1]
// (1080p px). Returns textures (ink, halo) and the rect.
export function textTextures(items, rect, { halo = 9 } = {}) {
  const [x0, y0, x1, y1] = rect, w = Math.ceil((x1 - x0) * SS), h = Math.ceil((y1 - y0) * SS);
  const draw = (blur) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff';
    if (blur) g.filter = `blur(${blur * SS}px)`;
    for (const it of items) {
      g.font = it.font.replace(/(\d+(?:\.\d+)?)px/, (m, v) => `${parseFloat(v) * SS}px`);
      g.textBaseline = 'alphabetic'; g.direction = it.rtl ? 'rtl' : 'ltr'; g.textAlign = 'left';
      g.fillText(it.text, (it.x - x0) * SS, (it.baseline - y0) * SS);
    }
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
    t.anisotropy = 1;
    return t;
  };
  return { ink: draw(0), halo: draw(halo), rect, w, h };
}

const hashGLSL = /* glsl */ `
  float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }`;

// The plane material. World units = 1080p px (q_apex's 50 mm camera). Uniforms:
//   col (linear HDR stroke colour = palette × stroke level), gain (breath × sync × surge), alpha,
//   haloGain (halo relative to the stroke), dissolve (0 = intact … 1 = gone, pixel-noise threshold),
//   arr (optional arrival field: the ink lands where the words have landed; arrT = [t0, t1] s).
export function textPlaneMaterial(tex, { arr = null, arrT = [0, 0] } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      ink: { value: tex.ink }, halo: { value: tex.halo }, col: { value: new THREE.Vector3(1, 1, 1) },
      gain: { value: 1 }, haloGain: { value: 0.16 }, alpha: { value: 1 }, dissolve: { value: 0 },
      arr: { value: arr }, useArr: { value: arr ? 1 : 0 }, arrT: { value: new THREE.Vector2(...arrT) }, time: { value: 0 },
      noiseScale: { value: new THREE.Vector2(tex.w / SS / 3.0, tex.h / SS / 3.0) },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: hashGLSL + /* glsl */ `
      uniform sampler2D ink, halo, arr; uniform vec3 col; uniform float gain, haloGain, alpha, dissolve, useArr, time;
      uniform vec2 arrT, noiseScale; varying vec2 vUv;
      void main(){
        float a = texture2D(ink, vUv).a, hl = texture2D(halo, vUv).a;
        float k = alpha;
        if (useArr > 0.5) { float g = texture2D(arr, vUv).r; float ta = mix(arrT.x, arrT.y, g); k *= smoothstep(ta - 0.05, ta + 0.30, time); }
        if (dissolve > 0.0) {
          float n = vn(vUv * noiseScale) * 0.7 + vn(vUv * noiseScale * 0.31 + 7.0) * 0.3;
          float m = smoothstep(dissolve - 0.08, dissolve + 0.08, n);
          a *= m; hl *= m;
        }
        vec3 c = col * gain * k * (a + haloGain * hl * (1.0 - a));
        if (max(c.r, max(c.g, c.b)) < 1e-5) discard;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}
// A mesh for a text texture set, positioned in q_apex world space (X = px − 960, Y = 540 − py).
export function textPlane(tex, opts) {
  const [x0, y0, x1, y1] = tex.rect;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), textPlaneMaterial(tex, opts));
  m.frustumCulled = false;
  m.userData.cx = (x0 + x1) / 2; m.userData.cy = (y0 + y1) / 2;
  m.position.set(m.userData.cx - 960, 540 - m.userData.cy, 0);
  return m;
}
// place a plane squashed horizontally about the 1080p-px anchor ax (sx = 1: untouched)
export function squash(m, sx, ax, dy = 0) {
  const s = Math.max(1e-4, sx);
  m.scale.x = s;
  m.position.x = (ax - 960) + (m.userData.cx - ax) * s;
  m.position.y = 540 - m.userData.cy + dy;
  m.visible = sx > 1e-3;
}

// ---- ink masks (alpha + stroke tangent from the structure tensor) ---------------------------
export function inkMask(items, region) {
  const [x0, y0, w, h] = region;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff';
  for (const it of items) {
    g.font = it.font; g.textBaseline = 'alphabetic'; g.direction = it.rtl ? 'rtl' : 'ltr'; g.textAlign = 'left';
    g.fillText(it.text, it.x - x0, it.baseline - y0);
  }
  const d = g.getImageData(0, 0, w, h).data;
  const A = new Float32Array(w * h); let ink = 0;
  for (let i = 0; i < w * h; i++) { A[i] = d[4 * i + 3] / 255; ink += A[i]; }
  const blur = (src, r) => {
    let a = src;
    for (let pass = 0; pass < 2; pass++) {
      const b = new Float32Array(w * h);
      for (let y = 0; y < h; y++) { let s = 0; for (let x2 = -r; x2 <= r; x2++) s += a[y * w + Math.min(w - 1, Math.max(0, x2))];
        for (let x2 = 0; x2 < w; x2++) { b[y * w + x2] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x2 + r + 1)] - a[y * w + Math.max(0, x2 - r)]; } }
      const c2 = new Float32Array(w * h);
      for (let x2 = 0; x2 < w; x2++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x2];
        for (let y = 0; y < h; y++) { c2[y * w + x2] = s / (2 * r + 1); s += b[Math.min(h - 1, y + r + 1) * w + x2] - b[Math.max(0, y - r) * w + x2]; } }
      a = c2;
    }
    return a;
  };
  const B = blur(A, 2);
  const jxx = new Float32Array(w * h), jxy = new Float32Array(w * h), jyy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x2 = 1; x2 < w - 1; x2++) {
    const i = y * w + x2, gx = B[i + 1] - B[i - 1], gy = B[i + w] - B[i - w];
    jxx[i] = gx * gx; jxy[i] = gx * gy; jyy[i] = gy * gy;
  }
  const Jxx = blur(jxx, 4), Jxy = blur(jxy, 4), Jyy = blur(jyy, 4);
  const at = (px, py) => { const ix = Math.round(px - x0), iy = Math.round(py - y0); return (ix < 0 || iy < 0 || ix >= w || iy >= h) ? 0 : A[iy * w + ix]; };
  const tangent = (px, py) => {
    const ix = Math.min(w - 1, Math.max(0, Math.round(px - x0))), iy = Math.min(h - 1, Math.max(0, Math.round(py - y0))), i = iy * w + ix;
    const th = 0.5 * Math.atan2(2 * Jxy[i], Jxx[i] - Jyy[i]) + Math.PI / 2;
    return [Math.cos(th), -Math.sin(th)];   // world (Y up)
  };
  return { at, tangent, ink, region };
}
export function gridInk(M, s, r, thr = 0.5, jit = 1) {
  const [x0, y0, w, h] = M.region, out = [];
  for (let y = y0; y < y0 + h; y += s) for (let x = x0; x < x0 + w; x += s) {
    const px = x + (0.5 + (r() - 0.5) * jit) * s, py = y + (0.5 + (r() - 0.5) * jit) * s;
    if (M.at(px, py) > thr) out.push([px, py]);
  }
  return out;
}
export function randInk(M, n, r, thr = 0.45) {
  const [x0, y0, w, h] = M.region, out = [];
  for (let tries = 0; out.length < n && tries < n * 300; tries++) {
    const px = x0 + r() * w, py = y0 + r() * h;
    if (M.at(px, py) > thr) out.push([px, py]);
  }
  return out;
}

// ---- screen-space bloom-mask rectangles (V2): soft-edged, MaxEquation into f.mask -------------
export function maskRectMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { rect: { value: new THREE.Vector4() }, feather: { value: new THREE.Vector2(2, 2) }, rgb: { value: new THREE.Vector3(1, 1, 1) } },
    vertexShader: /* glsl */ `uniform vec4 rect; uniform vec2 feather; varying vec2 vPx;
      void main(){ vec2 c = position.xy * 0.5 + 0.5; vec2 lo = rect.xy - feather, hi = rect.zw + feather;
        vPx = mix(lo, hi, vec2(c.x, 1.0 - c.y)); gl_Position = vec4(vPx.x / 960.0 - 1.0, 1.0 - vPx.y / 540.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec4 rect; uniform vec2 feather; uniform vec3 rgb; varying vec2 vPx;
      void main(){ vec2 f = max(feather, vec2(1e-3));
        float kx = smoothstep(rect.x - f.x, rect.x, vPx.x) * (1.0 - smoothstep(rect.z, rect.z + f.x, vPx.x));
        float ky = smoothstep(rect.y - f.y, rect.y, vPx.y) * (1.0 - smoothstep(rect.w, rect.w + f.y, vPx.y));
        gl_FragColor = vec4(rgb * kx * ky, 1.0); }`,
  });
}
