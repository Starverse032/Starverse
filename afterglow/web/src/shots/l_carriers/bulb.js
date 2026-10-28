// l_carriers/bulb.js — S04-d 白炽灯 [2496, 2568): 85 mm, locked.
//
// A clear pear bulb (≈ 300 × 420 px with its base), the filament's centre on C. The filament is a
// 60 px coiled tungsten wire — a projected helix whose turns stay separated even at full heat — held
// by two lead-in wires from the glass press, with the glass core column (exhaust tube) rising to a
// small button. The light is a temperature, not a flame: f2496–2505 the coil climbs from dull red
// (800 K, HDR ≈ 0.07) through orange to 2700 K (HDR ≈ 3) in 10 visible frames; it is perfectly steady.
// The glass is restrained: Fresnel-bright edges, two soft vertical highlights (≈ 10 %), one small hot
// spot. Below, a short length of brass screw thread catching the filament, then the black socket.
// f2556–2560 the switch opens: bright → orange → dark red in 5 frames (thermal inertia); the gap shows
// the filament's dying red afterglow and the glass shell faintly outlined by it, then the window.
import { PRELUDE, pass, baseUniforms } from './common.js';

export async function createBulb(ctx, noiseTex, T) {
  const { kit, renderer, W, H } = ctx;
  const U = { ...baseUniforms(W, H), uNoise: { value: noiseTex }, uOn: { value: T.on }, uOff: { value: T.off }, uDark: { value: T.dark },
    uLum: { value: 0 }, uTk: { value: 800 } };
  const p = pass(kit, PRELUDE + /* glsl */ `
    uniform sampler2D uNoise; uniform float uOn, uOff, uDark, uLum, uTk;
    const float GR = 150.0;                  // globe radius
    const float NECK0 = 600.0, NECK1 = 738.0, NR = 62.0;
    vec3 nz(vec2 uv){ return texture2D(uNoise, uv).rgb; }
    float glassR(float y){
      if (y < 540.0 - GR || y > NECK1) return -1.0;
      if (y <= NECK0) return sqrt(max(GR * GR - (y - 540.0) * (y - 540.0), 0.0));
      float r0 = sqrt(GR * GR - (NECK0 - 540.0) * (NECK0 - 540.0));
      float k = (y - NECK0) / (NECK1 - NECK0);
      float s = k * k * (3.0 - 2.0 * k);
      return mix(r0, NR, s) - 10.0 * sin(3.14159 * k) * (1.0 - k);
    }
    // filament coil: projected helix between (930, yc) and (990, yc); returns distance to the wire (px)
    float coil(vec2 p, out float depthF){
      float x = p.x - 960.0;
      depthF = 0.0;
      if (abs(x) > 34.0 || abs(p.y - 540.0) > 14.0) return 99.0;
      float sag = 3.5 * (1.0 - (x / 30.0) * (x / 30.0));
      float yc = 538.5 + sag;
      float R = 5.2, pitch = 4.0, k = 6.2832 / pitch;
      float ph = k * x;
      float dy = p.y - yc - R * sin(ph);
      float slope = R * k * cos(ph);
      depthF = cos(ph);                                    // > 0 front half of a turn
      float d = abs(dy) / sqrt(1.0 + slope * slope);
      // the coil ends at the clamps (|x| = 30)
      d = max(d, abs(x) - 30.0);
      return d;
    }

    void main(){
      setupP(vec2(0.0));
      vec2 q = P - CC;
      float x = q.x, y = P.y;
      bool on = uFr >= uOn - 0.5;
      bool lit = uFr >= uOn - 0.5 && uFr < uDark;
      vec3 Kc = kel(uTk);
      float I = uLum;                                       // filament luminance (HDR)
      float Lset = clamp(I / 3.0, 0.0, 1.0);                // light on the glass and brass, relative to full
      vec3 lc = Kc * Lset;
      vec3 col = vec3(0.0);
      float outl = 0.0;

      // ---------- socket (black bakelite) ----------
      float sdS = max(abs(x) - (76.0 - 4.0 * ss(790.0, 800.0, y)), 790.0 - y);
      float mS = covD(sdS);
      if (mS > 0.0) {
        float u = clamp(x / 76.0, -1.0, 1.0);
        vec3 sc = vec3(0.004, 0.0037, 0.0035) * (0.4 + 0.6 * sqrt(1.0 - u * u));
        sc += lc * 0.20 * exp(-pow((y - 792.5) / 1.8, 2.0)) * ss(1.0, 0.2, abs(u));   // its top lip catches the filament
        col = mix(col, sc, mS);
        outl = max(outl, lineD(sdS, 2.4));
      }
      // ---------- brass screw (y 738–790) ----------
      float sdT = max(abs(x) - (NR + 2.0 * sin((y - 738.0) * 6.2832 / 13.0 + x * 0.02)), max(736.0 - y, y - 791.0));
      float mT = covD(sdT) * (1.0 - mS);
      if (mT > 0.0) {
        float u = clamp(x / NR, -1.0, 1.0), nzc = sqrt(max(1.0 - u * u, 0.0));
        float th = fract((y - 738.0 - u * 3.0) / 13.0);
        float ridgeUp = ss(0.15, 0.35, th) * ss(0.55, 0.35, th);     // upper flank of each thread faces the filament
        vec3 brass = vec3(1.0, 0.72, 0.38);
        vec3 tc = brass * 0.006 * nzc + brass * lc * (0.22 * ridgeUp * pow(nzc, 3.0) + 0.04 * nzc) ;
        tc += brass * lc * 0.40 * ridgeUp * exp(-pow((u + 0.25) / 0.12, 2.0));          // the specular column
        col = mix(col, tc, mT);
        outl = max(outl, lineD(sdT, 2.4) * step(y, 791.0));
      }
      // ---------- glass envelope ----------
      float r = glassR(y);
      float sdG = r < 0.0 ? 99.0 : abs(x) - r;
      if (y < 390.0) sdG = max(sdG, 390.0 - y);
      float mG = covD(sdG);
      if (r > 0.0 || mG > 0.0) {
        float rr = max(r, 1.0);
        float u = clamp(x / rr, -1.0, 1.0), nzg = sqrt(max(1.0 - u * u, 0.0));
        float fres = 0.04 + 0.96 * pow(1.0 - nzg, 5.0);
        vec3 g = vec3(0.0);
        // edges: Fresnel reflections of the filament's light
        g += lc * fres * 0.09 * (0.6 + 0.4 * ss(740.0, 450.0, y));
        // two soft vertical highlights (≈ 10 %) and one small hot spot — restrained
        float vfall = ss(400.0, 450.0, y) * ss(600.0, 500.0, y);
        g += lc * 0.016 * (exp(-pow((u + 0.55) / 0.10, 2.0)) + 0.7 * exp(-pow((u - 0.50) / 0.08, 2.0))) * vfall;
        g += lc * 0.30 * exp(-dot(P - vec2(902.0, 468.0), P - vec2(902.0, 468.0)) / 18.0);
        // glass stem: exhaust tube / core column rising from the base to a small button, and the press
        float sdStem = max(abs(x) - (6.0 + 9.0 * ss(640.0, 735.0, y)), max(586.0 - y, y - 738.0));
        float sdPress = max(abs(x) - 15.0 + 0.4 * (y - 642.0), abs(y - 655.0) - 13.0);
        float sdBtn = length(P - vec2(960.0, 586.0)) - 6.0;
        float stem = min(min(sdStem, sdPress), sdBtn);
        float mSt = covD(stem);
        float stEdge = lineD(stem, 2.0);
        g += lc * 0.035 * stEdge + lc * 0.004 * mSt;
        // lead-in wires: from the press up and out to the coil clamps
        float w1 = min(sdSeg(P, vec2(948.0, 650.0), vec2(938.0, 600.0)), sdSeg(P, vec2(938.0, 600.0), vec2(929.0, 541.0)));
        float w2 = min(sdSeg(P, vec2(972.0, 650.0), vec2(982.0, 600.0)), sdSeg(P, vec2(982.0, 600.0), vec2(991.0, 541.0)));
        float wd = min(w1, w2) - 0.8;
        float mWire = covD(wd);
        g = mix(g, lc * 0.06 + vec3(0.0015), mWire);
        g += lc * 0.20 * lineD(wd + 0.6, 0.8) * mWire;
        col = mix(col, g, mG);
        outl = max(outl, lineD(sdG, 2.4) * step(y, 740.0));
      }
      // ---------- the filament ----------
      float dF;
      float cd = coil(P, dF);
      float wire = clamp(0.95 - cd + 0.5 * FW, 0.0, 1.0);          // ≈ 1.3 px wire
      // back half of each turn a little dimmer (seen through the front)
      vec3 fil = Kc * I * wire * (0.80 + 0.20 * dF) * 1.6;
      // a soft core glow around the coil (heat haze, light in the glass)
      fil += Kc * I * 0.020 * exp(-max(cd, 0.0) / 3.0) * step(cd, 30.0);
      col += fil;
      // clamps (where the coil meets the lead-ins): tiny bright beads
      col += Kc * I * 0.35 * (exp(-dot(P - vec2(929.5, 541.0), P - vec2(929.5, 541.0)) / 3.0) + exp(-dot(P - vec2(990.5, 541.0), P - vec2(990.5, 541.0)) / 3.0));

      // dark phase: the glass shell outlined by the dying filament
      if (!lit) {
        float wv = 0.85 + 0.3 * nz(P / 150.0).r;
        vec3 o = emberLine(outl, wv) * 0.9 * uOutline;
        col = o + fil;                                          // fil = the afterglow itself (uLum small)
        if (!on) col = o;
      }
      gl_FragColor = vec4(col * uGain, 1.0);
    }`, U);

  // filament thermal curve: luminance (HDR) and apparent colour temperature per (float) frame
  const lumOf = Tk => 3.0 * Math.pow(Tk / 2700, 3.09);
  function state(fr) {
    if (fr < T.on - 0.5) return { lum: 0, Tk: 800 };
    if (fr < T.off) {
      const u = Math.min(1, Math.max(0, (fr - T.on) / 9));
      const e = 1 - Math.pow(1 - u, 1.6);
      const Tk = 800 + 1900 * e;
      return { lum: lumOf(Tk), Tk };
    }
    // switch off: luminance halves every frame for 5 frames (f2556–2560: bright → orange → dark red), drops
    // below the outline level on f2561 (the gap), then the red afterglow fades slowly
    const k = fr - T.off + 1;
    const lum = k <= 5 ? 3.0 * Math.pow(0.5, k) : 3.0 * Math.pow(0.5, 5) * 0.40 * Math.pow(0.72, k - 6);
    const Tk = 2700 * Math.pow(lum / 3.0, 1 / 3.09);
    return { lum, Tk };
  }
  return {
    U, state,
    render(target, fr, t, outline, additive) {
      const s = state(fr);
      U.uFr.value = fr; U.uOutline.value = outline; U.uLum.value = s.lum;
      // apparent colour: below ~1450 K a dull glow reads deep red-orange, never magenta (ACES)
      U.uTk.value = Math.max(s.Tk, 1450 + (s.Tk - 800) * 0.25);
      p.draw(renderer, target, additive);
    },
  };
}
