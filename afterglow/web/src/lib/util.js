// Small deterministic helpers shared by all shots.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: t => t * t * t * t,
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inOutQuart: t => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  inSine: t => 1 - Math.cos((t * Math.PI) / 2),
  outSine: t => Math.sin((t * Math.PI) / 2),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// Seeded PRNG (mulberry32). Never use Math.random in shots.
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.gauss = () => { const u = Math.max(1e-9, f()), v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  f.sphere = () => { const z = 2 * f() - 1, a = 2 * Math.PI * f(), r = Math.sqrt(1 - z * z); return [r * Math.cos(a), r * Math.sin(a), z]; };
  return f;
}

// Keyframe interpolation. keys: [{t, v, ease?}] sorted by t; v is a number or array.
// The ease on key i shapes the segment from key i to key i+1.
export function keyframes(keys, t) {
  if (t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  const e = ease[a.ease || 'inOutCubic'] || ease.inOutCubic;
  const u = e(clamp((t - a.t) / (b.t - a.t)));
  if (Array.isArray(a.v)) return a.v.map((x, j) => lerp(x, b.v[j], u));
  return lerp(a.v, b.v, u);
}

// Damped "camera shake" — smooth deterministic pseudo-noise of time. Returns [-1,1]^n.
export function shake(t, seed = 0, freq = 1, n = 3) {
  const out = [];
  for (let k = 0; k < n; k++) {
    let s = 0, a = 0.5, f = freq;
    for (let o = 0; o < 4; o++) {
      const ph = seed * 13.17 + k * 7.31 + o * 3.7;
      s += a * Math.sin(t * f * 6.2831 + ph) * Math.cos(t * f * 2.71 + ph * 1.3);
      a *= 0.5; f *= 2.13;
    }
    out.push(s);
  }
  return out;
}

// Rasterise text with canvas2D and sample filled pixels as points.
// Returns {points: Float32Array [x,y,...] centred at origin in px units, count, width, height}.
export function textToPoints(text, { font = '200px "Noto Serif CJK SC"', step = 3, threshold = 128, maxPoints = 200000, seed = 1, lineHeight = 1.2 } = {}) {
  const lines = String(text).split('\n');
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const m = g.measureText('M');
  const fsize = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 100;
  const widths = lines.map(l => g.measureText(l).width);
  const W = Math.ceil(Math.max(...widths) + 40), H = Math.ceil(lines.length * fsize * lineHeight * 1.3 + 40);
  c.width = W; c.height = H;
  g.font = font; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'center';
  lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * fsize * lineHeight * 1.3));
  const data = g.getImageData(0, 0, W, H).data;
  const r = rng(seed);
  const pts = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    const jx = x + r() * step, jy = y + r() * step;
    const ix = Math.min(W - 1, Math.floor(jx)), iy = Math.min(H - 1, Math.floor(jy));
    if (data[(iy * W + ix) * 4 + 3] >= threshold) pts.push(jx - W / 2, H / 2 - jy);
  }
  let points = new Float32Array(pts);
  if (points.length / 2 > maxPoints) {
    // deterministic subsample
    const keep = new Float32Array(maxPoints * 2); const stride = points.length / 2 / maxPoints;
    for (let i = 0; i < maxPoints; i++) { const k = Math.floor(i * stride); keep[2 * i] = points[2 * k]; keep[2 * i + 1] = points[2 * k + 1]; }
    points = keep;
  }
  return { points, count: points.length / 2, width: W, height: H };
}

// Draws text into a fresh canvas and returns it (for CanvasTexture). Options mimic canvas2D.
export function textCanvas(lines, { width = 1024, height = 256, font = '64px "Noto Serif CJK SC"', color = '#fff', align = 'center', letterSpacing = '0px', lineHeight = 1.3, shadow = 0 } = {}) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const g = c.getContext('2d');
  g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.letterSpacing = letterSpacing;
  if (shadow) { g.shadowColor = color; g.shadowBlur = shadow; }
  const arr = Array.isArray(lines) ? lines : String(lines).split('\n');
  const size = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] || 64);
  const x = align === 'center' ? width / 2 : align === 'right' ? width - 8 : 8;
  arr.forEach((l, i) => g.fillText(l, x, height / 2 + (i - (arr.length - 1) / 2) * size * lineHeight));
  return c;
}

// Time code mm:ss:ff for slates / logs.
export function timecode(t, fps = 24) {
  const f = Math.round(t * fps);
  const ff = f % fps, s = Math.floor(f / fps) % 60, m = Math.floor(f / fps / 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
}
