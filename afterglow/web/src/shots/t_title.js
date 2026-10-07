// t_title — S42 片名 (03:48.12 → 03:55.00). Card C06 has render = module: the title is drawn here,
// in HDR, so it can bloom and cool (screenplay §3 S42, §5.1, §8).
//
//   228.5–229.0  black (smash cut from S40)
//   229.0        「余光」 at (960, 520), Noto Serif CJK SC ExtraLight 120 px, tracking 0.5 em;
//                「AFTERGLOW」 at (960, 610), 300 30px "Noto Serif Display VF", tracking 0.9 em.
//                Arrival: 4 frames up to HDR 2.0 at 6500 K (white-hot).
//   then         L(t) = 2.0 · e^{−(t − 229)/1.6}; colour temperature cools along the S08 CMB blackbody
//                ramp 6500 → 3000 → 1200 K (log-interpolated, same GLSL blackbody() as c_afterglow).
//                The strokes behave like a cooling filament: thick parts of the glyphs (a blurred copy of
//                the ink, baked once) stay a little hotter and brighter than the thin hairlines, so the
//                word fades from its edges inward — the light source is gone, the light is still there.
//   234.0        zero; 234–235 black.
// Cost: one fullscreen pass with two texture fetches (≈ 0.08 s at 1080p).
import * as THREE from 'three';
import { assertFonts } from './p_terminal/ui.js';

const T_ON = 229.0, T_ZERO = 234.0;
const F_ZH = '200 120px "Noto Serif CJK SC"';
const F_EN = '300 30px "Noto Serif Display VF"';

export async function create(ctx) {
  const { renderer, W, H, util, kit } = ctx;
  const { clamp, smoothstep } = util;
  const S = H / 1080;
  assertFonts([F_ZH, F_EN]);

  // bake the title (2× super-sampled): R = ink, G = blurred ink ("thickness" / heat reservoir)
  const RX = { x0: 560, y0: 400, w: 800, h: 260 };
  const K = 2 * S;
  const c = document.createElement('canvas'); c.width = Math.round(RX.w * K); c.height = Math.round(RX.h * K);
  const g = c.getContext('2d');
  const drawTitle = (gg) => {
    gg.setTransform(K, 0, 0, K, -RX.x0 * K, -RX.y0 * K);
    gg.fillStyle = '#fff'; gg.textAlign = 'center'; gg.textBaseline = 'alphabetic';
    // letterSpacing adds space after every glyph (also the last): shift by half a tracking unit to centre
    gg.font = F_ZH; gg.letterSpacing = '60px';
    let m = gg.measureText('余光');
    const zhBase = 520 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    gg.fillText('余光', 960 + 30, zhBase);
    gg.font = F_EN; gg.letterSpacing = '27px';
    m = gg.measureText('AFTERGLOW');
    const enBase = 610 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    gg.fillText('AFTERGLOW', 960 + 13.5, enBase);
    gg.letterSpacing = '0px';
  };
  drawTitle(g);
  const ink = g.getImageData(0, 0, c.width, c.height);
  const b = document.createElement('canvas'); b.width = c.width; b.height = c.height;
  const bg = b.getContext('2d');
  bg.filter = `blur(${(2.2 * K).toFixed(2)}px)`; bg.drawImage(c, 0, 0); bg.filter = 'none';
  const blur = bg.getImageData(0, 0, c.width, c.height);
  const out = new Uint8Array(c.width * c.height * 4);
  for (let i = 0; i < c.width * c.height; i++) {
    out[i * 4] = ink.data[i * 4 + 3]; out[i * 4 + 1] = blur.data[i * 4 + 3]; out[i * 4 + 2] = 0; out[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(out, c.width, c.height, THREE.RGBAFormat);
  tex.flipY = false; tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  const U = { tTitle: { value: tex }, uRect: { value: new THREE.Vector4(RX.x0, RX.y0, RX.w, RX.h) }, uRes: { value: new THREE.Vector2(W, H) },
    uL: { value: 0 }, uT: { value: 6500 } };
  const pass = kit.fullscreen(/* glsl */ `
    uniform sampler2D tTitle; uniform vec4 uRect; uniform vec2 uRes; uniform float uL, uT;
    void main(){
      vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (1080.0 / uRes.y);
      vec2 q = (sp - uRect.xy) / uRect.zw;
      vec3 col = vec3(0.0);
      if (uL > 0.0 && all(greaterThan(q, vec2(0.0))) && all(lessThan(q, vec2(1.0)))) {
        vec2 tb = texture2D(tTitle, q).rg;
        float thick = smoothstep(0.08, 0.55, tb.g);
        // local temperature: the thick parts lag the cooling; brightness ∝ (T'/T)^4 (Stefan–Boltzmann)
        float cool = smoothstep(6500.0, 1500.0, uT);                 // 0 white-hot … 1 ember
        float Tl = uT * (1.0 + cool * 0.16 * (thick - 0.6));
        float I = uL * pow(Tl / uT, 4.0);
        col = blackbody(Tl) * I * tb.r;
        col += blackbody(Tl * 0.92) * I * 0.05 * tb.g;               // faint radiant skin around the strokes
      }
      gl_FragColor = vec4(col, 1.0);
    }`, U);

  const logLerp = (a, b2, u) => Math.exp(Math.log(a) + (Math.log(b2) - Math.log(a)) * u);
  return {
    render(shot, f) {
      const t = f.t;
      let L = 0, T = 6500;
      if (t >= T_ON && t < T_ZERO) {
        const arrive = Math.pow(clamp((t - T_ON) * 24 / 4 + 0.25), 1.5);        // f5496 0.13 → f5499 1.0 (4 frames to HDR 2.0)
        L = 2.0 * Math.exp(-(t - T_ON) / 1.6) * arrive * (1 - smoothstep(T_ZERO - 0.75, T_ZERO, t));
        // CMB ramp: 6500 K (white) → 3000 K (≈ 231.0) → 1200 K (≈ 233.6)
        const a = t - T_ON;
        T = a < 2 ? logLerp(6500, 3000, smoothstep(0.15, 2.0, a) ) : logLerp(3000, 1200, clamp((a - 2) / 2.6));
      }
      U.uL.value = L; U.uT.value = T;
      renderer.setRenderTarget(f.target);
      pass.render(renderer, f.target);
    },
  };
}
