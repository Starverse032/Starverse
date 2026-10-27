// t_title — S42 片名 [5472, 5640) (screenplay v2 S11-a / S11-b / S11-c). Card C06 has render = module:
// the title is drawn here, in HDR.
//
//   [5472, 5496)  black
//   f5496         「余光」 at (960, 520), Noto Serif CJK SC ExtraLight 120 px, tracking 0.5 em;
//                 「AFTERGLOW」 at (960, 610), 300 36px "Noto Serif Display VF", tracking 0.9 em.
//                 Hot metal, but legible first: within 4 frames the strokes reach 6500 K white heat at
//                 stroke luminance HDR 0.38 (below the bloom knee, so no bloom ever eats into the strokes),
//                 plus a separate soft glow (σ ≈ 5 px, reach ≈ 12 px) that carries the "heat".
//   [5496, 5532)  white-hot and sharp: 1.5 s to read.
//   [5532, 5604)  cools along the S02-a afterglow ramp 6500 → 3000 → 1200 K; luminance falls so the last
//                 frame is a dim red glyph (display L ≈ 90, hue ≈ 12–16°). Like a cooling filament, the
//                 thick parts of the glyphs (a blurred copy of the ink, baked once) stay hotter than the
//                 hairlines, so the word cools from its edges inward.
//   [5604, 5616)  fades to black; [5616, 5640) black.
// The strokes also write the V2 bloom mask (R), so the post bloom never adds a halo of its own.
// Cost: one fullscreen pass, one texture fetch (≈ 0.1 s at 1080p).
import * as THREE from 'three';
import { assertFonts } from './p_terminal/ui.js';

const FPS = 24;
const F_ON = 5496, F_COOL = 5532, F_MID = 5568, F_FADE = 5604, F_OFF = 5616;
const F_ZH = '200 120px "Noto Serif CJK SC"';
const F_EN = '300 36px "Noto Serif Display VF"';
const Y_HOT = 0.40;      // stroke luminance (HDR) while white-hot → display ≈ 148 (bloom knee starts at 0.4)
const Y_EMBER = 0.23;    // at 1200 K → a dim red glyph, display L ≈ 90, hue ≈ 15°
const GLOW = 0.30;       // glow amplitude relative to the stroke (on the blurred ink)

export async function create(ctx) {
  const { renderer, W, H, util, kit } = ctx;
  const { clamp, smoothstep, ease } = util;
  const S = H / 1080;
  assertFonts([F_ZH, F_EN]);

  // bake the title (2× super-sampled): R = ink, G = slightly blurred ink ("thickness"), B = soft glow
  const RX = { x0: 540, y0: 380, w: 840, h: 300 };
  const K = 2 * S;
  const mkc = () => { const c = document.createElement('canvas'); c.width = Math.round(RX.w * K); c.height = Math.round(RX.h * K); return c; };
  const c = mkc(), g = c.getContext('2d');
  g.setTransform(K, 0, 0, K, -RX.x0 * K, -RX.y0 * K);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // letterSpacing adds space after every glyph (also the last): shift by half a tracking unit to centre
  g.font = F_ZH; g.letterSpacing = '60px';
  let m = g.measureText('余光');
  g.fillText('余光', 960 + 30, 520 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  g.font = F_EN; g.letterSpacing = '32.4px';
  m = g.measureText('AFTERGLOW');
  g.fillText('AFTERGLOW', 960 + 16.2, 610 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  g.letterSpacing = '0px';
  const ink = g.getImageData(0, 0, c.width, c.height);
  const blurred = px => {
    const b = mkc(), bg = b.getContext('2d');
    bg.filter = `blur(${(px * K).toFixed(2)}px)`; bg.drawImage(c, 0, 0); bg.filter = 'none';
    return bg.getImageData(0, 0, c.width, c.height);
  };
  const thick = blurred(2.2), glow = blurred(5.0);
  const out = new Uint8Array(c.width * c.height * 4);
  for (let i = 0; i < c.width * c.height; i++) {
    out[i * 4] = ink.data[i * 4 + 3]; out[i * 4 + 1] = thick.data[i * 4 + 3]; out[i * 4 + 2] = glow.data[i * 4 + 3]; out[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(out, c.width, c.height, THREE.RGBAFormat);
  tex.flipY = false; tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  const U = { tTitle: { value: tex }, uRect: { value: new THREE.Vector4(RX.x0, RX.y0, RX.w, RX.h) }, uRes: { value: new THREE.Vector2(W, H) },
    uY: { value: 0 }, uT: { value: 6500 }, uCool: { value: 0 }, uGlow: { value: GLOW }, uMask: { value: 0 } };
  const pass = kit.fullscreen(/* glsl */ `
    uniform sampler2D tTitle; uniform vec4 uRect; uniform vec2 uRes; uniform float uY, uT, uCool, uGlow, uMask;
    float lumi(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    void main(){
      vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (1080.0 / uRes.y);
      vec2 q = (sp - uRect.xy) / uRect.zw;
      vec3 col = vec3(0.0);
      float m = 0.0;
      if (uY > 0.0 && all(greaterThan(q, vec2(0.0))) && all(lessThan(q, vec2(1.0)))) {
        vec3 tb = texture2D(tTitle, q).rgb;
        float th = smoothstep(0.08, 0.55, tb.g);
        // local temperature: thick parts lag the cooling (hairlines up to ≈ 12 % colder)
        float Tl = uT * (1.0 + uCool * 0.12 * (th - 0.7));
        vec3 bb = blackbody(Tl); bb /= max(lumi(bb), 1e-4);          // unit luminance at that temperature
        float Yl = uY * mix(0.92, 1.0, th) * mix(1.0, pow(Tl / uT, 3.0), uCool);
        col = bb * Yl * tb.r;                                          // strokes: ≤ HDR 0.4 luminance
        col += bb * uY * uGlow * tb.b * (1.0 - tb.r);                  // the heat: a separate soft glow outside the strokes
        m = max(tb.r, step(0.004, tb.b));
      }
      if (uMask > 0.5) { gl_FragColor = vec4(m, 0.0, 0.0, 1.0); return; }   // V2: the title emits no bloom
      gl_FragColor = vec4(col, 1.0);
    }`, U);

  const logLerp = (a, b, u) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * u);
  return {
    bloomMask: true,
    render(shot, f) {
      const F = f.t * FPS;
      let Y = 0, T = 6500, cool = 0;
      if (F >= F_ON - 0.5 && F < F_OFF) {
        // f5496 → f5499: up to white heat in 4 frames (heating 3800 → 6500 K as it brightens)
        const a = clamp((F - F_ON + 1) / 4);
        Y = Y_HOT * ease.outCubic(a);
        T = logLerp(3800, 6500, a);
        if (F >= F_COOL) {
          const u = clamp((F - F_COOL) / (F_FADE - F_COOL));
          T = F < F_MID ? logLerp(6500, 3000, ease.inOutSine(clamp((F - F_COOL) / (F_MID - F_COOL))))
                        : logLerp(3000, 1200, ease.outSine(clamp((F - F_MID) / (F_FADE - F_MID))));
          Y = Y_HOT + (Y_EMBER - Y_HOT) * smoothstep(0, 1, u);
          cool = smoothstep(0, 0.5, u);
        }
        if (F >= F_FADE) Y *= 1 - ease.inOutSine(clamp((F - F_FADE + 1) / (F_OFF - F_FADE)));
      }
      U.uY.value = Y; U.uT.value = T; U.uCool.value = cool;
      renderer.setRenderTarget(f.target);
      pass.render(renderer, f.target);
      if (f.mask && (f.sub | 0) === 0 && Y > 0) {
        U.uMask.value = 1;
        const ac = renderer.autoClear; renderer.autoClear = false;
        pass.render(renderer, f.mask);
        renderer.autoClear = ac; U.uMask.value = 0;
        renderer.setRenderTarget(f.target);
      }
    },
  };
}
