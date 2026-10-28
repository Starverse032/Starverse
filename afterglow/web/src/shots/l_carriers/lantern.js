// l_carriers/lantern.js — S04-c 提灯／油灯 [2424, 2496): 50 mm, locked.
//
// A hurricane lantern, globe centre on C. The barrel glass (≈ 260 × 380 px) is a surface of revolution
// shaded analytically (a long lens: near-orthographic): Fresnel-bright edges, two cold vertical
// highlight strips (#CFE0FF, display 25–40), the flame's image refracted and stretched at the globe's
// edges, a faint smoke stain round the top. Inside: a flat-wick flame — a broad fan (≈ 90 × 70 px,
// 2000 K but hotter and whiter than the candle: steadier, hue 40–46°), luminance centroid on C, rising
// from a brass burner cone. The tin: hood and vent cap, collar rings, the two side air tubes, four 3 px
// guard wires bowed round the glass, the fount below; only warm specular glints and rims, everything
// else dark. The wires and tubes throw thin radial shadows on the rough boards under the lantern.
// f2424 the wick catches from left to right over 6 frames and the glass comes up with it.
// f2484–2488 the wick is wound down: the fan shrinks to a blue bead and goes. Gap: the glass outline
// (residual reflections) and the wick's dark-orange ember, then a bulb.
import { PRELUDE, pass, baseUniforms, hex, v3 } from './common.js';

const GLASS_HI = hex(0xCFE0FF);

export async function createLantern(ctx, noiseTex, T) {
  const { kit, renderer, W, H } = ctx;
  const U = { ...baseUniforms(W, H), uNoise: { value: noiseTex }, uOn: { value: T.on }, uOff: { value: T.off }, uDark: { value: T.dark } };
  const p = pass(kit, PRELUDE + /* glsl */ `
    uniform sampler2D uNoise; uniform float uOn, uOff, uDark;
    const vec3 GHI = ${v3(GLASS_HI)};
    const float GT = 350.0, GB = 730.0;          // glass top / bottom (y)
    const float GR = 130.0;                      // glass max radius
    const float WICKY = 579.0;                   // wick slot (flame bottom)
    float TT;
    vec3 nz(vec2 uv){ return texture2D(uNoise, uv).rgb; }
    float gr(float y){ float yn = clamp((y - 0.5 * (GT + GB)) / (0.5 * (GB - GT)), -1.0, 1.0); return GR * (0.80 + 0.20 * sqrt(1.0 - yn * yn)); }

    // flame state
    void flameState(out float hgt, out float I, out float front, out float bead){
      float fr = uFr;
      front = clamp((fr - uOn + 1.0) / 6.0, 0.0, 1.0);          // catch progress, left → right
      float k = clamp((fr - uOff) / 4.0, 0.0, 1.0);             // wound down
      hgt = mix(1.0, 0.0, k);
      bead = ss(0.55, 0.85, k) * (1.0 - step(uDark, fr));
      float up = ss(0.0, 1.0, (fr - uOn - 3.0) / 3.0);          // full brightness only once the whole wick burns
      I = (fr >= uOn && fr < uDark ? 1.0 : 0.0) * (0.45 + 0.55 * up) * (1.0 - 0.85 * k);
    }

    // the flat fan flame: returns (density, core)
    vec2 fan(vec2 p, float hgt, float front){
      float v = (WICKY - p.y) / (70.0 * max(hgt, 0.05));        // 0 at the wick, 1 at the top
      if (v < -0.1 || v > 1.15) return vec2(0.0);
      float x = p.x - 960.0 - 0.6 * sin(TT * 1.7) * v;
      // fan: as wide as the wick at the bottom, opening to ≈ 90 px, rounded crown
      // a wide rounded fan: an oval crown pinched to the wick's width at the bottom
      float hw = 44.0 * sqrt(max(1.0 - pow((v - 0.47) / 0.53, 2.0), 0.0));
      hw = max(hw, 20.0 * ss(0.10, -0.02, v) * step(-0.04, v));
      hw *= 1.0 + 0.06 * ss(0.3, 0.6, v);
      hw *= mix(0.3, 1.0, hgt);
      float d = abs(x) - hw;
      float dens = covD(d) * ss(-0.04, 0.05, v);
      float glow = exp(-max(d, 0.0) / 2.5) * ss(-0.04, 0.08, v) * step(v, 1.1);
      // catching from the left: only the part of the wick that has caught burns
      float caught = ss(-0.15, 0.0, front * 2.2 - 1.1 - x / 45.0);
      float core = ss(hw, hw * 0.3, abs(x)) * ss(0.08, 0.3, v) * ss(1.0, 0.55, v);
      return vec2(max(dens, glow * 0.5) * caught, core * caught);
    }
    vec3 fanColour(vec2 f, float v){
      vec3 body = mix(kel(2600.0), kel(3400.0), 0.55);
      vec3 c = kel(1900.0) * 0.45 * f.x;
      c = mix(c, body * 1.25, f.y);
      // a little blue at the wick ends
      c += vec3(0.08, 0.16, 0.9) * 0.18 * f.x * ss(0.18, 0.0, v);
      return c;
    }

    void main(){
      setupP(vec2(0.0));
      TT = uFr / 24.0;
      float hgt, I, front, bead; flameState(hgt, I, front, bead);
      float L = I;                                              // light on the set
      vec3 col = vec3(0.0);
      vec2 q = P - CC;
      float x = q.x, y = P.y;
      float outl = 0.0, outlCold = 0.0;

      // ---------- table: rough boards, lit round the lantern, radial shadows of wires & tubes ----------
      if (y > 846.0) {
        float z = 2666.0 * 0.30 / max(y - 540.0, 1.0);          // depth (m), table 0.30 m under the lens
        float X = x * z / 2666.0;
        float dz = z - 2.4;
        float r = sqrt(X * X + dz * dz);
        float E = 0.22 / pow(r * r + 0.22 * 0.22 + 0.01, 1.5);
        float ang = atan(X, dz);
        float sh = 1.0;
        for (int i = 0; i < 6; i++) { float a0 = (float(i) - 2.5) * 0.52 + 0.08 * sin(float(i) * 3.0); sh *= 1.0 - 0.75 * exp(-pow((ang - a0) / 0.022, 2.0)) * ss(0.15, 0.4, r); }
        float boards = 0.7 + 0.5 * nz(vec2(X * 0.6, z * 0.05)).r * (0.6 + 0.4 * sin(X * 52.0)) + 0.25 * nz(vec2(X * 9.0, z * 2.0)).g;
        float gap = 1.0 - 0.7 * exp(-pow(fract(X * 6.0) - 0.5, 2.0) / 0.0004);
        col += vec3(0.20, 0.12, 0.07) * vec3(1.0, 0.62, 0.30) * E * 0.020 * boards * gap * sh * L;
      }

      // ---------- fount (oil tank): a squat rounded drum ----------
      {
        vec2 fq = (P - vec2(960.0, 818.0)) / vec2(156.0, 80.0);
        float sdF = (length(fq) - 1.0) * 70.0;
        sdF = max(sdF, P.y - 872.0);
        float mF = covD(sdF);
        if (mF > 0.0) {
          vec2 n2 = fq; float nzc = sqrt(max(1.0 - dot(n2, n2), 0.0));
          vec3 N = normalize(vec3(n2.x, -n2.y, nzc + 0.05));
          vec3 Ld = normalize(vec3(-x, 818.0 - 545.0, 60.0) * vec3(1.0 / 200.0, 1.0 / 200.0, 1.0 / 200.0));
          float diff = max(dot(N, normalize(vec3(-n2.x * 0.3, 1.0, 0.2))), 0.0);
          float spec = pow(max(dot(N, normalize(vec3(0.0, 0.75, 0.66))), 0.0), 60.0);
          vec3 tin = vec3(0.007, 0.0065, 0.006) * (0.4 + 0.6 * nzc);
          vec3 fc = tin + vec3(1.0, 0.62, 0.32) * (0.05 * diff * diff + 0.55 * spec) * L;
          fc += vec3(1.0, 0.64, 0.33) * 0.10 * exp(-pow((P.y - 748.0) / 2.0, 2.0)) * ss(110.0, 30.0, abs(x)) * L;  // filler neck ring
          col = mix(col, fc, mF);
          outl = max(outl, lineD(sdF, 2.6));
        }
      }

      // ---------- glass globe ----------
      float r = gr(y);
      float inG = step(GT, y) * step(y, GB);
      float sdG = max(abs(x) - r, max(GT - y, y - GB));
      float mG = covD(sdG);
      float u = clamp(x / r, -1.0, 1.0);
      float nzg = sqrt(max(1.0 - u * u, 0.0));
      float fres = 0.04 + 0.96 * pow(1.0 - nzg, 5.0);
      // the flame inside (seen through the glass)
      vec2 f = fan(P, hgt, front);
      float v = (WICKY - y) / (70.0 * max(hgt, 0.05));
      vec3 flameC = fanColour(f, v) * I;
      if (bead > 0.0) flameC += vec3(0.10, 0.22, 1.0) * 0.30 * bead * exp(-dot(P - vec2(960.0, WICKY - 3.0), P - vec2(960.0, WICKY - 3.0)) / 10.0);
      // burner: brass deflector cone the flame rises from
      float sdB = max(abs(x) - (34.0 + 0.55 * (y - WICKY)), max(WICKY - 2.0 - y, y - 622.0));
      float mB = covD(sdB);
      vec3 brass = vec3(0.006, 0.004, 0.002) + vec3(1.0, 0.70, 0.35) * 0.25 * exp(-pow((y - WICKY - 3.0) / 3.0, 2.0)) * ss(36.0, 5.0, abs(x)) * L;
      brass += vec3(1.0, 0.68, 0.35) * 0.09 * exp(-pow((x + 22.0) / 5.0, 2.0)) * ss(622.0, WICKY, y) * L;
      vec3 inside = mix(vec3(0.0), brass, mB) + flameC;
      // light scattered in the hot glass and the warm air: a faint fill so the globe reads as a volume
      float vol = exp(-pow((y - 560.0) / 150.0, 2.0)) * (0.5 + 0.5 * nzg);
      vec3 glass = vec3(1.0, 0.56, 0.24) * 0.022 * vol * L;
      // Fresnel edges reflect the flame's light (warm), the far side's inner reflection
      glass += vec3(1.0, 0.62, 0.30) * fres * 0.10 * exp(-pow((y - 545.0) / 120.0, 2.0)) * L;
      // the flame refracted and stretched at the globe's edges
      float edge = ss(0.72, 0.97, abs(u));
      vec2 fq = vec2(960.0 + sign(u) * (1.0 - abs(u)) * 420.0, 545.0 + (y - 545.0) * 0.45);
      vec2 fi = fan(fq, hgt, front);
      glass += fanColour(fi, (WICKY - fq.y) / 70.0) * I * 0.06 * edge * ss(0.97, 0.9, abs(u));
      // two cold highlight strips (reflections of the night sky outside), following the bulge
      float s1 = exp(-pow((u + 0.56) / 0.045, 2.0)), s2 = exp(-pow((u - 0.70) / 0.022, 2.0));
      float sv = ss(GT + 6.0, GT + 50.0, y) * ss(GB - 4.0, GB - 60.0, y);
      glass += GHI * (0.058 * s1 + 0.046 * s2) * sv * (0.92 + 0.16 * nz(vec2(u * 3.0, y / 90.0)).r);
      // soot round the top
      float soot = ss(GT + 75.0, GT + 8.0, y) * (0.65 + 0.35 * nz(vec2(u * 2.0, y / 30.0)).g);
      inside *= 1.0 - 0.55 * soot;
      glass += vec3(0.30, 0.17, 0.08) * 0.022 * soot * L;
      col = mix(col, inside + glass, mG);
      // residual reflections for the dark outline (cold-ish) + glass silhouette
      outlCold = max(outlCold, lineD(sdG, 2.4));

      // ---------- metal: collars, hood, side tubes, guard wires ----------
      // lower collar (globe plate) and upper collar
      float sdC1 = max(abs(x) - 122.0, abs(y - 735.0) - 7.0);
      float sdC2 = max(abs(x) - 112.0, abs(y - 343.0) - 8.0);
      float mC = max(covD(sdC1), covD(sdC2));
      vec3 cc = vec3(0.008, 0.0075, 0.007);
      cc += vec3(1.0, 0.64, 0.33) * 0.30 * exp(-pow((y - 351.0) / 1.6, 2.0)) * ss(110.0, 40.0, abs(x)) * L;   // underside of the top collar
      cc += vec3(1.0, 0.64, 0.33) * 0.20 * exp(-pow((y - 728.5) / 1.4, 2.0)) * ss(120.0, 20.0, abs(x)) * L;   // lip of the plate
      col = mix(col, cc, mC);
      outl = max(outl, max(lineD(sdC1, 2.4), lineD(sdC2, 2.4)));
      // hood: a dome over the globe, a vent cap with a row of holes, the bail wire arching over
      vec2 hq = (P - vec2(960.0, 342.0)) / vec2(124.0, 58.0);
      float sdDome = max((length(hq) - 1.0) * 55.0, P.y - 342.0);
      float sdCap = max(abs(x) - 40.0, max(256.0 - y, y - 292.0));
      float sdTop = min(sdDome, sdCap);
      float mH = covD(sdTop);
      float hu = clamp(x / 124.0, -1.0, 1.0);
      vec3 hc = vec3(0.007, 0.0065, 0.006) * (0.5 + 0.5 * sqrt(1.0 - hu * hu));
      hc += vec3(1.0, 0.6, 0.3) * 0.12 * exp(-pow((y - 340.0) / 2.5, 2.0)) * ss(124.0, 40.0, abs(x)) * L;      // rim catches light from below
      hc += vec3(1.0, 0.66, 0.35) * 0.05 * exp(-pow((hu + 0.35) / 0.12, 2.0)) * ss(288.0, 330.0, y) * L;
      float holes = step(abs(fract((x + 40.0) / 13.0) - 0.5), 0.22) * step(abs(y - 275.0), 4.0) * step(abs(x), 36.0);
      hc = mix(hc, vec3(1.0, 0.55, 0.22) * 0.05 * L, holes * covD(sdCap));                                        // the vent glows faintly from inside
      col = mix(col, hc, mH);
      outl = max(outl, lineD(sdTop, 2.4));
      float bail = abs(length((P - vec2(960.0, 330.0)) / vec2(196.0, 160.0)) - 1.0) * 170.0 - 1.4;
      bail = max(bail, P.y - 300.0);
      float mBail = covD(bail);
      col = mix(col, vec3(0.004) + vec3(1.0, 0.62, 0.3) * 0.03 * ss(0.0, -1.5, bail) * L, mBail);
      outl = max(outl, lineD(bail + 1.4, 2.2) * step(P.y, 300.0));
      // side air tubes
      float tx = 182.0;
      float sdT = abs(abs(x) - tx) - 9.0;
      float tubeY = ss(305.0, 300.0, y) + ss(752.0, 760.0, y);
      sdT = max(sdT, max(300.0 - y, y - 790.0));
      // shoulders from the tubes into the hood
      float sh = sdSeg(vec2(abs(x), y), vec2(tx, 300.0), vec2(118.0, 330.0)) - 8.0;
      sdT = min(sdT, sh);
      float mT = covD(sdT);
      float tu = clamp((abs(x) - tx) / 8.0, -1.0, 1.0);
      vec3 tc = vec3(0.008, 0.0075, 0.007) * (0.5 + 0.5 * sqrt(1.0 - tu * tu));
      tc += vec3(1.0, 0.64, 0.33) * 0.16 * exp(-pow((tu + sign(x) * 0.55) / 0.25, 2.0)) * exp(-pow((y - 545.0) / 180.0, 2.0)) * L;   // inner side faces the flame
      col = mix(col, tc, mT);
      outl = max(outl, lineD(sdT, 2.4));
      // guard wires: 4, bowed round the glass (two in front, two near the edges), 3 px
      float mW = 0.0; vec3 wc = vec3(0.0);
      if (y > GT - 8.0 && y < GB + 8.0) {
        float rw = r + 7.0;
        for (int i = 0; i < 4; i++) {
          float a = i == 0 ? -0.62 : (i == 1 ? 0.62 : (i == 2 ? -1.38 : 1.38));
          float xw = rw * sin(a);
          float d = abs(x - xw) - 1.5;
          float m = covD(d);
          vec3 c = vec3(0.004);
          // glints where the wire crosses the flame's height, on its inner flank
          c += vec3(1.0, 0.66, 0.36) * 0.35 * exp(-pow((y - 545.0) / 40.0, 2.0)) * exp(-pow((x - xw + sign(xw) * 1.0) / 0.8, 2.0)) * L;
          mW = max(mW, m); wc = mix(wc, c, m);
        }
      }
      col = mix(col, wc, mW);
      // dark phase: tin silhouettes (ember-warm, faint) + the glass outline by its residual reflections
      vec3 o = emberLine(outl, 0.9) * 0.85 + vec3(0.032, 0.036, 0.042) * outlCold;
      o += kel(1200.0) * 0.12 * exp(-dot(P - vec2(960.0, WICKY), P - vec2(960.0, WICKY)) / 10.0) * ss(uDark + 5.0, uDark, uFr);  // wick ember
      bool lit = uFr >= uOn && uFr < uDark;
      col = lit ? col : o * uOutline + (uFr >= uDark ? kel(1200.0) * 0.10 * exp(-dot(P - vec2(960.0, WICKY), P - vec2(960.0, WICKY)) / 10.0) * ss(uDark + 5.0, uDark, uFr) : vec3(0.0));
      gl_FragColor = vec4(col * uGain, 1.0);
    }`, U);
  return {
    U,
    render(target, fr, t, outline, additive) { U.uFr.value = fr; U.uOutline.value = outline; p.draw(renderer, target, additive); },
  };
}
