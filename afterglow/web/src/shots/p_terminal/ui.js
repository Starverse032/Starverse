// Shared helpers for the terminal group (p_terminal S01–S06/S44, t_title S42).
//
// DISPLAY-EXACT UI. The post chain tone-maps every frame with ACES (post.js). A UI colour such as
// UI_TEXT #E8E4DA written straight into the HDR target would come out ≈ #D3CFC4, and UI_BG #050607
// would be crushed to pure black by the ACES toe. The interface must be pixel-exact, so every UI
// pixel is composed in display sRGB (like a real canvas), then pushed through the *inverse* of the
// fitted ACES curve. With exposure 1 and no grade the screen shows exactly the specified sRGB values.
// HDR light (cursor glow, star particles, the white point) is added on top in scene-linear units.

// GLSL: sRGB → linear, and the analytic inverse of acesFitted() from lib/glsl.js.
export const DISPLAY_GLSL = /* glsl */ `
vec3 ui_srgb2lin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
// acesFitted(x) = outM * rrt(inM * x)  with rrt(c) = (c(c+a) - b) / (c(d c + e) + f), per channel.
vec3 ui_invAces(vec3 y){
  const mat3 outInv = mat3(0.6430382, 0.0592687, 0.0059619, 0.3111868, 0.9314365, 0.0639290, 0.0457755, 0.0092949, 0.9301184);
  const mat3 inInv  = mat3(1.7647410, -0.1470279, -0.0363368, -0.6757777, 1.1602515, -0.1624364, -0.0889633, -0.0132237, 1.1987733);
  vec3 v = clamp(outInv * clamp(y, 0.0, 0.985), 0.0, 1.0);
  // (1 - 0.983729 v) c^2 + (0.0245786 - 0.432951 v) c - (0.000090537 + 0.238081 v) = 0
  vec3 A = 1.0 - 0.983729 * v, B = 0.0245786 - 0.4329510 * v, C = -(0.000090537 + 0.238081 * v);
  vec3 c = (-B + sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
  return max(inInv * c, 0.0);
}
// display sRGB (0..1) → scene-linear HDR value that the post chain will display as exactly that colour
vec3 ui_hdr(vec3 srgb){ return ui_invAces(ui_srgb2lin(srgb)); }
`;

// '#RRGGBB' → [r, g, b] in 0..1 (display sRGB)
export const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

// JS mirror of the GLSL above (used to pre-compute HDR constants on the CPU).
export function acesFitted(c) {
  const inM = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
  const outM = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
  const mul = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const v = mul(inM, c).map(x => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.4329510) + 0.238081));
  return mul(outM, v).map(x => Math.min(1, Math.max(0, x)));
}
export const srgb2lin = c => c.map(x => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
// HDR value displaying as sRGB colour `c` — analytic inverse, identical to ui_invAces() in GLSL
export function hdrFor(c) {
  const outInv = [[0.6430382, 0.3111868, 0.0457755], [0.0592687, 0.9314365, 0.0092949], [0.0059619, 0.0639290, 0.9301184]];
  const inInv = [[1.7647410, -0.6757777, -0.0889633], [-0.1470279, 1.1602515, -0.0132237], [-0.0363368, -0.1624364, 1.1987733]];
  const mul = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const y = srgb2lin(c).map(x => Math.min(0.985, Math.max(0, x)));
  const cc = mul(outInv, y).map(v => {
    v = Math.min(1, Math.max(0, v));
    const A = 1 - 0.983729 * v, B = 0.0245786 - 0.4329510 * v, C = -(0.000090537 + 0.238081 * v);
    return (-B + Math.sqrt(Math.max(B * B - 4 * A * C, 0))) / (2 * A);
  });
  return mul(inInv, cc).map(x => Math.max(0, x));
}

// Fail loudly if a font string would silently fall back (screenplay §2.1 "字体断言").
export function assertFonts(list) {
  const bad = list.filter(f => !document.fonts.check(f, '余光 Aa0'));
  if (bad.length) throw new Error('fonts missing: ' + bad.join(' | '));
}

// CJK / full-width detection for mixed-script runs (terminal output uses Plex Mono + Noto Sans Mono CJK).
export const isCJK = ch => /[⺀-鿿　-〿＀-￯豈-﫿]/.test(ch);

// Split a string into script runs: [{text, cjk}]
export function scriptRuns(str) {
  const out = [];
  for (const ch of str) {
    const c = isCJK(ch);
    if (out.length && out[out.length - 1].cjk === c) out[out.length - 1].text += ch; else out.push({ text: ch, cjk: c });
  }
  return out;
}

// Draw [{text, font, color, alpha}] runs left to right from (x, baseline); returns the end x.
export function drawRuns(g, x, y, runs) {
  for (const r of runs) {
    g.font = r.font; g.fillStyle = r.color; g.globalAlpha = r.alpha ?? 1;
    g.fillText(r.text, x, y);
    x += g.measureText(r.text).width;
  }
  g.globalAlpha = 1;
  return x;
}
