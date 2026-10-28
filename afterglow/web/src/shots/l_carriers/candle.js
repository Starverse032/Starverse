// l_carriers/candle.js — S04-b 烛火 [2352, 2424): 85 mm, locked, no breath.
//
// One clear teardrop flame (≈ 50 × 150 px, y 465–615), luminance centroid on C, swaying only ±3 px at
// 0.5 Hz: a blue root (#4F7BFF, ≥ 12 px) cupped under the flame, the dark, transparent zone around
// the wick, the yellow-white inner flame and a thin orange outer edge. A black wick curling at its
// glowing tip. An ivory pillar (110 px wide, from y 620 out of frame) seen nearly level: a molten pool
// and a translucent rim glowing by sub-surface scattering in the top 20 px, the glow dying down the
// column, two or three drips on the left catching specular streaks of the flame. Behind and below,
// a dark wooden table top, foreshortened, lit in a soft pool that dies into black.
// f2352 a 2-frame blue bead on the wick; the flame grows to its teardrop by f2357.
// f2412–2416 the flame shrinks, lifts off the wick and is gone; the wick's ember glows 4 frames and a
// 2 px grey thread of smoke curls up. Gap: the pillar's outline and the smoking wick, then a lantern.
import { PRELUDE, pass, baseUniforms, hex, v3 } from './common.js';

const ROOT = hex(0x4F7BFF);

export async function createCandle(ctx, noiseTex, T) {
  const { kit, renderer, W, H } = ctx;
  const U = { ...baseUniforms(W, H), uNoise: { value: noiseTex }, uOn: { value: T.on }, uOff: { value: T.off }, uDark: { value: T.dark } };
  const p = pass(kit, PRELUDE + /* glsl */ `
    uniform sampler2D uNoise; uniform float uOn, uOff, uDark;
    const vec3 ROOT = ${v3(ROOT)};
    const float CX = 960.0;
    const float RW = 55.0;           // pillar radius (110 px wide)
    const float TOPY = 622.0;        // rim (ellipse centre)
    const float RB = 6.5;            // rim ellipse semi-minor (we look down ~7°)
    const float FB = 612.0;          // flame bottom
    const float FHT = 150.0;         // flame height
    float TT;
    vec3 nz(vec2 uv){ return texture2D(uNoise, uv).rgb; }

    // flame state: grow (ignition), shrink + lift (extinction)
    void flameState(out float g, out float lift, out float I, out float bead){
      float fr = uFr;
      bead = (fr >= uOn - 0.5 && fr < uOn + 2.0) ? 1.0 : 0.0;
      g = clamp((fr - (uOn + 1.5)) / 3.5, 0.0, 1.0);             // f2354 → f2357
      g = g * g * (3.0 - 2.0 * g);
      float k = clamp((fr - uOff) / 4.5, 0.0, 1.0);              // extinction
      lift = 26.0 * k * k;
      g *= 1.0 - 0.72 * k;
      I = (fr < uDark ? 1.0 : 0.0) * (1.0 - 0.8 * k) * (0.35 + 0.65 * g);
    }

    // teardrop: returns (density, inner, rootBlue, darkZone) for a point
    vec4 teardrop(vec2 p, float g, float lift){
      float H = FHT * max(g, 0.08);
      float sway = 3.0 * sin(3.14159 * TT) + 0.5 * sin(TT * 19.0) * 0.4;
      float v = (FB - lift - p.y) / H;                            // 0 bottom … 1 tip
      if (v < -0.15 || v > 1.1) return vec4(0.0);
      float x = p.x - CX - sway * pow(clamp(v, 0.0, 1.0), 1.3);
      // half-width profile: round bottom, widest at ~0.28, long tapering tip
      float vv = clamp(v, 0.0, 1.0);
      float A = 25.0 * min(g * 1.4, 1.0) * 1.62 * pow(vv + 0.02, 0.42) * pow(1.0 - vv, 0.95);
      float d = abs(x) - A;                                       // < 0 inside
      float dens = covD(d) * ss(-0.02, 0.03, v);
      // soft glow just outside the edge (thin outer flame)
      float edge = exp(-max(d, 0.0) / 1.6) * ss(-0.02, 0.05, v) * step(v, 1.0);
      // blue root: the lowest ~12 px, strongest at the outside of the bowl
      float root = ss(0.15, 0.05, v) * ss(-0.10, -0.01, v) * exp(-max(d, 0.0) / 2.0) * ss(0.25, 0.85, abs(x) / max(A, 1.0) + 0.25 * ss(0.02, -0.06, v));
      // the dark zone around the wick: an ellipse low in the flame
      vec2 dz = vec2(x / max(9.0 * g, 1.0), (v - 0.17) / 0.14);
      float dark = exp(-dot(dz, dz) * 1.6) * ss(0.4, 1.0, g);
      // inner (luminous) zone
      float inner = ss(0.05, 0.22, v) * ss(1.02, 0.55, v) * ss(A * 0.95, A * 0.25, abs(x));
      return vec4(max(dens, edge * 0.6), inner, root, dark);
    }

    // the pillar: returns colour; m = coverage; outl = outline strength (silhouette)
    vec3 pillar(vec2 p, float light, float smoulder, out float m, out float outl){
      outl = 0.0; m = 0.0;
      float x = p.x - CX;
      // drips on the left: bulges on the silhouette and runs on the front face
      float drip = 0.0, dripHi = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float dx = -RW + 4.0 + fi * 9.0 + 3.0 * fi * fi;
        float len = fi == 0.0 ? 118.0 : (fi == 1.0 ? 58.0 : 34.0);
        float w = 4.2 - fi * 0.6;
        float y0 = TOPY - 2.0, y1 = TOPY + len;
        float yy = clamp(p.y, y0, y1);
        float bulb = 1.0 + 0.6 * exp(-pow((p.y - y1 + 4.0) / 5.0, 2.0));
        float dd = length(vec2(x - dx - 1.2 * sin(yy * 0.05 + fi), p.y - yy)) - w * bulb;
        drip = max(drip, covD(dd));
        dripHi = max(dripHi, exp(-pow((x - dx - 1.2 * sin(yy * 0.05 + fi) + w * 0.35) / 0.9, 2.0)) * covD(dd) * ss(y1 + 6.0, y0, p.y));
      }
      float leftBulge = drip * step(x, -RW + 6.0);
      // body silhouette
      float side = abs(x) - RW;
      float topEdge = TOPY - RB * sqrt(max(1.0 - (x / RW) * (x / RW), 0.0));   // back rim (top of the ellipse)
      float frontRim = TOPY + RB * sqrt(max(1.0 - (x / RW) * (x / RW), 0.0));  // front lip
      float sdBody = max(side, topEdge - p.y);
      m = max(covD(sdBody), leftBulge);
      if (m <= 0.0) return vec3(0.0);
      float nx = clamp(x / RW, -1.0, 1.0), nzc = sqrt(max(1.0 - nx * nx, 0.0));
      float depth = max(p.y - frontRim, 0.0);                     // px below the lip
      // the top surface (inside the rim ellipse): molten pool, glowing amber, the wick rises from it
      float inTop = covD(-(RB * sqrt(max(1.0 - nx * nx, 0.0)) - abs(p.y - TOPY)));
      inTop *= step(abs(x), RW - 1.0);
      vec3 ivory = vec3(0.86, 0.78, 0.62);
      // sub-surface scattering: light enters at the top and glows through the translucent wax
      float sss = exp(-depth / 9.0) * 0.9 + exp(-depth / 42.0) * 0.28 + exp(-depth / 160.0) * 0.06;
      sss *= 0.55 + 0.45 * nzc;
      vec3 col = vec3(1.0, 0.50, 0.19) * sss * 0.34;
      // a little direct wrap light on the front face, and wax texture
      float tex = 0.85 + 0.3 * nz(vec2(x / 30.0, p.y / 140.0)).r;
      col += ivory * vec3(1.0, 0.68, 0.40) * 0.035 * nzc * exp(-depth / 90.0) * tex;
      col += ivory * 0.0035 * nzc;                                 // never quite black
      // the lip: thin translucent wall lit through, brightest
      float lip = exp(-pow((p.y - frontRim) / 2.2, 2.0)) * step(abs(x), RW);
      col += vec3(1.0, 0.58, 0.26) * lip * 0.40;
      // molten pool (seen at a grazing angle), glowing
      vec3 pool = vec3(1.0, 0.55, 0.22) * (0.30 + 0.10 * nz(vec2(x / 20.0, TT * 0.2)).g) * (0.7 + 0.3 * ss(RW, 0.0, abs(x)));
      col = mix(col, pool, inTop);
      // drips: wax runs, a specular streak of the flame on each
      col = mix(col, vec3(1.0, 0.52, 0.2) * 0.42 * sss + ivory * 0.012, drip * 0.7);
      col += vec3(1.0, 0.80, 0.55) * dripHi * 0.16 * exp(-max(p.y - TOPY, 0.0) / 70.0);
      col *= light;
      col += vec3(0.0035, 0.0032, 0.0028) * nzc * (1.0 - light);
      // silhouette outline (dark phase): the two sides, the rim ellipse, the drips
      float sil = min(abs(sdBody), abs(side));
      outl = lineD(sdBody, 2.6) + lineD(p.y - frontRim, 2.2) * step(abs(x), RW) * 0.8;
      outl = clamp(outl, 0.0, 1.0) * ss(960.0, 700.0, p.y + 0.0) ;
      outl = max(outl, lineD(side, 2.6) * step(TOPY, p.y));
      return col;
    }

    // the wick: black, curling at the top, a glowing tip
    float wick(vec2 p, out vec3 tipCol, float hot){
      vec2 a = vec2(CX - 0.5, TOPY + 1.0), b = vec2(CX + 0.5, FB - 4.0), c = vec2(CX + 5.5, FB - 13.0);
      float d = min(sdSeg(p, a, b) - 1.6, sdSeg(p, b, c) - 1.3);
      float tip = exp(-dot(p - c, p - c) / 5.0);
      tipCol = kel(1300.0) * tip * 0.9 * hot;
      return covD(d);
    }

    // wooden table behind the candle: horizon at y 540, candle base at depth 2.06 m (85 mm)
    vec3 table(vec2 p, float light){
      if (p.y < 548.0) return vec3(0.0);
      float z = 4533.0 * 0.236 / (p.y - 540.0);                     // depth (m)
      float X = (p.x - CX) * z / 4533.0;
      float dz = z - 2.06;
      float dist2 = X * X + dz * dz;
      float E = 0.236 / pow(dist2 + 0.236 * 0.236 + 0.02, 1.5);
      float grain = 0.75 + 0.35 * nz(vec2(X * 1.6, z * 0.12)).r + 0.15 * sin(X * 140.0 + nz(vec2(X, z * 0.3)).g * 9.0);
      vec3 wood = vec3(0.16, 0.085, 0.045) * grain;
      return wood * vec3(1.0, 0.62, 0.32) * E * 0.045 * light;
    }

    vec3 smoke(vec2 p, float k){
      // a 2 px grey thread curling up from the wick after the flame is gone
      float age = (uFr - (uOff + 3.0)) / 24.0;
      if (age <= 0.0) return vec3(0.0);
      float hgt = FB - 10.0 - p.y;
      if (hgt < 0.0 || hgt > 60.0 + 260.0 * age) return vec3(0.0);
      float xc = CX + 5.0 + 9.0 * sin(hgt * 0.045 - TT * 2.2) * ss(0.0, 60.0, hgt) + 0.03 * hgt * sin(TT * 0.7 + 1.0);
      float w = 1.0 + hgt * 0.012;
      float d = abs(p.x - xc);
      float a = exp(-d * d / (w * w)) * ss(60.0 + 260.0 * age, 20.0 + 160.0 * age, hgt) * exp(-age * 1.2);
      return vec3(0.040, 0.040, 0.042) * a;
    }

    void main(){
      setupP(vec2(0.0));
      TT = uFr / 24.0;
      float g, lift, I, bead; flameState(g, lift, I, bead);
      bool before = uFr < uOn - 0.5;
      // flame light on the set (what lights the wax and the table)
      float L = before ? 0.0 : clamp(I * (0.25 + 0.75 * g), 0.0, 1.0);
      vec3 col = table(P, L);
      float pm, outl;
      vec3 pc = pillar(P, L, 0.0, pm, outl);
      col = mix(col, pc, pm);
      // wick (in front of the pool, behind the flame)
      vec3 tip; float hot = clamp((uDark + 4.0 - uFr) / 4.0, 0.0, 1.0) * (before ? 0.0 : 1.0);
      float wm = wick(P, tip, hot);
      col = mix(col, vec3(0.002), wm);
      col += tip;
      // flame
      if (!before && uFr < uDark) {
        vec4 f = teardrop(P, g, lift);
        float v = (FB - lift - P.y) / (FHT * max(g, 0.08));
        vec3 outer = kel(1500.0) * 0.22;
        vec3 inner = mix(kel(1800.0), kel(2700.0), 0.65) * 0.95;
        vec3 fc = outer * f.x * ss(0.04, 0.16, v);
        fc = mix(fc, inner * mix(1.0, 1.45, ss(0.2, 0.5, v) * ss(0.85, 0.5, v)), f.y);
        fc *= 1.0 - 0.75 * f.w;                                    // dark zone around the wick
        fc = mix(fc, ROOT * 0.34, clamp(f.z * 1.2, 0.0, 1.0));
        col = col * (1.0 - 0.6 * f.x) + fc * I;
        // ignition bead (2 frames, blue)
        if (bead > 0.5) col += ROOT * 0.55 * exp(-dot(P - vec2(CX + 3.0, FB - 10.0), P - vec2(CX + 3.0, FB - 10.0)) / 7.0);
      }
      col += smoke(P, 0.0);
      // dark phase / swap: the pillar's outline, the smoking wick
      vec3 o = emberLine(outl, 0.92 + 0.16 * texture2D(uNoise, P / 140.0).r) * uOutline;
      o += emberLine(wm, 1.1) * uOutline * 0.9;
      col = (uFr >= uDark || before) ? o + smoke(P, 0.0) + tip : col;
      gl_FragColor = vec4(col * uGain, 1.0);
    }`, U);
  return {
    U,
    render(target, fr, t, outline, additive) { U.uFr.value = fr; U.uOutline.value = outline; p.draw(renderer, target, additive); },
  };
}
