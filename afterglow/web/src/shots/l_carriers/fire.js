// l_carriers/fire.js — S04-a 篝火近景 [2280, 2352): 50 mm, locked + 1 px hand-held breath.
//
// The same campfire as F3's distant warm point, now close: a mass of fast, rolling tongues (advected
// noise, 6–10 Hz flicker, blackbody 1200–1900 K, high-saturation orange), its white-hot body (the only
// pixels ≥ 180) held symmetric about C so the luminance centroid stays on C. Under it a bed of cracked
// coals (Voronoi chunks with glowing seams and ember cracks, white ash crusts lit by the flame), grass
// stems and wood fibres burning at the edge of the bed, two charred sticks crossing the flame base,
// the lit upper rims of a ring of stones whose fronts are black, and a few sparks — the only light in
// S04 with sparks and turbulence. Nothing else is lit; the background is black.
// f2340–2344 the flames collapse onto the bed (360 → 40 px) and dim; f2345 the light is out and only
// the coal chunks remain, outlined by 2–3 px of dark-red ember (display ≈ 22); f2349–2351 that outline
// dissolves into the candle's (drawn by candle.js).
import { PRELUDE, pass, baseUniforms } from './common.js';
import * as THREE from 'three';

export function createFire(ctx, noiseTex, T) {
  const { kit, renderer, W, H } = ctx;
  const U = { ...baseUniforms(W, H), uNoise: { value: noiseTex }, uShake: { value: new THREE.Vector2() },
    uOff: { value: T.off }, uDark: { value: T.dark } };
  const p = pass(kit, PRELUDE + /* glsl */ `
    uniform sampler2D uNoise; uniform vec2 uShake; uniform float uOff, uDark;
    const float BASEY = 702.0;       // flame base (top of the coal bed)
    const float FH = 372.0;          // full flame height
    float TT;                        // seconds

    vec3 nz(vec2 uv){ return texture2D(uNoise, uv).rgb; }

    // ---------------- flame ----------------
    // returns HDR emission; hf = height factor (collapse), If = intensity factor
    vec3 flame(vec2 p, float hf, float If){
      float x = (p.x - CC.x) / 150.0;
      float h = (BASEY - p.y) / FH;                         // 0 at base, 1 at tips
      if (h < -0.08 || h > 1.25 * hf + 0.05 || abs(x) > 1.35) return vec3(0.0);
      float hn = h / max(hf, 0.05);                         // normalised height (collapse squashes it)
      // flicker: 6–10 Hz height pulses of the whole mass, with independent tongues
      float fl = 0.5 + 0.5 * (0.6 * sin(TT * 47.0 + 0.7 * sin(TT * 13.0)) * 0.5 + nz(vec2(TT * 0.31, 0.37)).r - 0.25);
      // advected turbulence (rising, faster with height), domain warp grows with height
      vec2 a = vec2(x * 0.42, hn * 0.55 - TT * 0.62);
      vec3 n1 = nz(a);
      vec3 n2 = nz(a * vec2(2.1, 1.8) + (n1.rg - 0.5) * 0.28 + vec2(0.13, -TT * 0.55));
      vec3 n3 = nz(a * vec2(4.6, 3.4) + (n2.gb - 0.5) * 0.20 + vec2(0.41, -TT * 1.30));
      float sway = (n1.r - 0.5) * 0.85 * hn * hn + 0.10 * sin(TT * 2.1) * hn;
      float xw = x - sway - (n2.b - 0.5) * 0.25 * hn;
      // the mass: broad base narrowing upward; tongues separate above ~40 % height
      float env = 0.98 * pow(max(1.0 - hn / 1.12, 0.0), 0.62) * (0.62 + 0.38 * ss(-0.05, 0.12, hn));
      float body = ss(env, env * 0.30, abs(xw));
      float ridges = 0.5 + 0.5 * cos(xw * 10.5 + (n2.r - 0.5) * 4.0 + 1.2);   // tongue columns
      float tongue = ss(0.30, 0.70, ridges * 0.55 + n3.g * 0.75 + 0.55 - hn * (0.95 + 0.25 * fl));
      float dens = body * mix(1.0, tongue, ss(0.18, 0.62, hn)) * ss(-0.06, 0.04, h);
      // detached flamelets near the tips
      float lick = ss(0.62, 0.80, n3.r + n2.g * 0.5 - (hn - 0.75) * 0.9) * ss(0.65, 0.9, hn) * ss(1.25, 0.95, hn) * ss(env + 0.25, env * 0.4, abs(xw));
      dens = max(dens, lick * 0.55);
      // white-hot body: a stable ellipse centred on C (it is what K1 measures), breathing in brightness only
      vec2 cq = vec2((p.x - CC.x) / 92.0, (p.y - CC.y) / 118.0);
      float core = exp(-dot(cq, cq) * 1.9) * (0.88 + 0.12 * fl) * ss(0.25, 0.9, hf);
      core *= 0.75 + 0.25 * n2.g;
      // temperature: hotter in the body and low down; tips and tongue edges cooler and redder
      float T = mix(1220.0, 1720.0, clamp(dens * 0.55 + (1.0 - hn) * 0.35 + (n3.b - 0.5) * 0.2, 0.0, 1.0));
      vec3 c = kel(T) * dens * (0.20 + 0.20 * (1.0 - hn)) * (0.85 + 0.3 * n3.b);
      c += kel(mix(1650.0, 1900.0, core)) * core * core * 1.55 * dens;
      return c * If;
    }

    // ---------------- coal bed ----------------
    // top contour of the bed (y down): a low mound under the flame
    float bedTop(float x){ float d = (x - CC.x) / 190.0; return BASEY - 14.0 + 52.0 * d * d + 9.0 * (nz(vec2(x / 900.0, 0.71)).r - 0.5) * 2.0; }
    // returns emission+lit colour; out: outline strength for the dark phase
    vec3 coals(vec2 p, float lit, out float outl){
      outl = 0.0;
      float top = bedTop(p.x);
      float bot = 808.0 + 18.0 * (nz(vec2(p.x / 700.0, 0.2)).g - 0.5);
      float halfW = 205.0;
      float side = abs(p.x - CC.x) - halfW;
      float sd = max(max(top - p.y, p.y - bot), side);             // < 0 inside the bed region
      if (sd > 6.0) return vec3(0.0);
      // chunks: Voronoi in a foreshortened plane (cells ~ 30 px wide, 18 px tall)
      vec2 q = vec2(p.x / 30.0, p.y / 17.0);
      vec2 iq = floor(q), fq = fract(q);
      float d1 = 9.0, d2 = 9.0; vec2 c1 = vec2(0.0), id1 = vec2(0.0);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = vec2(ihash2(ivec2(iq + g) + ivec2(31, 7)), ihash2(ivec2(iq + g) + ivec2(5, 91)));
        vec2 r = g + 0.15 + 0.7 * o - fq;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; c1 = r; id1 = iq + g; } else if (d < d2) d2 = d;
      }
      d1 = sqrt(d1); d2 = sqrt(d2);
      float seam = d2 - d1;                                         // 0 on chunk boundaries
      float hc = ihash2(ivec2(id1) + ivec2(17, 3));
      float hc2 = ihash2(ivec2(id1) + ivec2(77, 13));
      // chunk dome normal → lit by the flame above-behind (light from up)
      vec2 nn = -c1 / max(d1, 1e-3) * clamp(d1 * 1.6, 0.0, 1.0);
      float up = clamp(0.55 + 0.75 * nn.y, 0.0, 1.0);                // faces pointing up (y up = -screen y)
      float depthShade = ss(bot + 4.0, top - 10.0, p.y);              // back of the bed (near flame) brighter
      // surface: charcoal / grey ash crust
      float ash = ss(0.55, 0.75, nz(p / 70.0 + hc).g + 0.25 * hc2);
      vec3 alb = mix(vec3(0.030, 0.026, 0.022), vec3(0.42, 0.40, 0.37), ash);
      vec3 flameLight = vec3(1.0, 0.52, 0.20) * (0.10 + 0.55 * depthShade) * up;
      vec3 col = alb * flameLight * lit;
      // embers: glowing seams between chunks (hot interior) and cracks inside chunks
      float glowAmt = (0.35 + 0.65 * hc) * (0.55 + 0.45 * depthShade);
      float seamGlow = exp(-seam * seam / 0.006) * glowAmt;
      vec2 cq = p / vec2(9.0, 6.0) + hc * 17.0;
      vec2 cf = fract(cq) - 0.5; vec2 ci = floor(cq);
      float crack = 1.0 - ss(0.0, 0.10, abs(nz(ci * 0.13 + cf * 0.05).b - 0.5) * 2.0 - 0.0) ;
      crack = exp(-pow((nz(p / 38.0 + hc * 3.1).r - 0.5) / 0.035, 2.0)) * (1.0 - ash) * glowAmt * 0.8;
      float breathe = 0.85 + 0.15 * sin(TT * (1.3 + hc * 1.7) + hc * 20.0);
      float Te = mix(950.0, 1350.0, hc2);
      vec3 em = kel(Te) * (seamGlow * 0.42 + crack * 0.22) * breathe;
      col += em * mix(0.0, 1.0, lit);
      // inside the bed region only (soft edge on the contour)
      float inside = covD(sd);
      // dark phase outline: chunk boundaries + bed contour as thin ember lines (2–3 px)
      float chunkEdge = lineD(seam * 17.0, 2.4) * ss(0.25, 0.75, hc + 0.2);
      float contour = lineD(sd, 2.6) * ss(bot - 6.0, top + 8.0, p.y) ;
      contour = max(contour, lineD(top - p.y, 2.6) * step(side, 0.0));
      outl = max(chunkEdge * inside, contour) * (0.8 + 0.4 * hc);
      return col * inside;
    }

    // ---------------- burning stems at the edge of the bed ----------------
    vec3 stems(vec2 p, float lit){
      vec3 c = vec3(0.0);
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float h1 = hash11(fi * 3.17 + 1.0), h2 = hash11(fi * 7.31 + 2.0), h3 = hash11(fi * 1.93 + 5.0);
        float sgn = i < 5 ? -1.0 : 1.0;
        vec2 a = vec2(CC.x + sgn * (120.0 + 80.0 * h1), BASEY + 30.0 + 60.0 * h2);
        vec2 b = a + vec2(sgn * (60.0 + 70.0 * h3), -30.0 - 50.0 * h1);
        vec2 m = (a + b) * 0.5 + vec2(0.0, -18.0 * h2);
        // quadratic stem, sampled as two segments
        float d = min(sdSeg(p, a, m), sdSeg(p, m, b));
        if (d > 6.0) continue;
        // burn front travels outward along the stem
        float tt = fract(TT * (0.10 + 0.08 * h3) + h1);
        float along = clamp(dot(p - a, b - a) / dot(b - a, b - a), 0.0, 1.0);
        float burnt = ss(tt + 0.02, tt - 0.04, along);              // 1 = already burnt (ash)
        float front = exp(-pow((along - tt) / 0.035, 2.0));
        float w = 1.6 + 0.6 * h2;
        float cv = lineD(d, w);
        vec3 straw = vec3(0.30, 0.22, 0.10) * 0.22 * (0.4 + 0.6 * h2);  // dry grass lit by the fire
        vec3 ashc = vec3(0.10, 0.095, 0.09) * 0.5;
        vec3 sc = mix(straw, ashc, burnt) * lit;
        sc += kel(1500.0) * front * 0.55 * lit;
        c = max(c, sc * cv);
      }
      return c;
    }

    // ---------------- charred sticks (silhouettes across the flame base) ----------------
    float sticks(vec2 p, out vec3 rim){
      rim = vec3(0.0);
      float d1 = sdSeg(p, vec2(745.0, 760.0), vec2(1035.0, 610.0)) - 9.0;
      float d2 = sdSeg(p, vec2(1190.0, 770.0), vec2(905.0, 640.0)) - 7.5;
      float d = min(d1, d2);
      float m = covD(d);
      // glowing ember edge on the upper side of each stick
      rim = kel(1250.0) * 0.16 * exp(-pow((d + 1.5) / 1.6, 2.0)) * (0.6 + 0.4 * nz(p / 40.0).r);
      return m;
    }

    // ---------------- stones (front of the ring): lit top rims, black fronts ----------------
    vec3 stones(vec2 p, float lit, out float occ, out float outl){
      occ = 0.0; outl = 0.0;
      vec3 c = vec3(0.0);
      const int NS = 5;
      vec4 S[5] = vec4[5](vec4(690.0, 868.0, 120.0, 62.0), vec4(1240.0, 884.0, 138.0, 70.0), vec4(905.0, 905.0, 96.0, 52.0),
                          vec4(1065.0, 920.0, 110.0, 58.0), vec4(520.0, 905.0, 105.0, 66.0));
      for (int i = 0; i < NS; i++) {
        vec2 q = p - S[i].xy;
        float bump = (nz(p / 90.0 + float(i) * 0.37).r - 0.5) * 10.0;
        float d = sdEll(q, S[i].zw) - bump;
        if (d > 3.0) continue;
        float m = covD(d);
        // top rim: lit where the surface faces up toward the fire (distance to the top of the ellipse)
        vec2 n = normalize(q / (S[i].zw * S[i].zw) + 1e-5);
        float upf = clamp(-n.y, 0.0, 1.0);
        float rimW = exp(-pow(d / 7.0, 2.0)) * pow(upf, 2.0);
        float face = exp(-max(-d, 0.0) / 26.0) * pow(upf, 3.0);
        float tex = 0.75 + 0.5 * nz(p / 23.0 + float(i)).g;
        vec3 sc = vec3(1.0, 0.50, 0.21) * (0.035 * rimW + 0.022 * face) * tex * lit;
        // black front (dark face kept a hair above the ground so the stone reads: L1' 6–8)
        sc += vec3(0.0045, 0.0040, 0.0036) * (1.0 - rimW);
        c = mix(c, sc, m);
        occ = max(occ, m);
      }
      return c;
    }

    // ---------------- sparks ----------------
    vec3 sparks(vec2 p, float lit){
      vec3 c = vec3(0.0);
      if (p.y > BASEY + 10.0 || p.y < 150.0) return c;
      for (int i = 0; i < 14; i++) {
        float fi = float(i);
        float per = 1.3 + 1.1 * hash11(fi * 2.1 + 0.3);
        float ph = hash11(fi * 5.7 + 1.1);
        float tau = fract(TT / per + ph);
        float x0 = CC.x + (hash11(fi * 9.1 + 3.0) - 0.5) * 220.0;
        float vy = 230.0 + 160.0 * hash11(fi * 1.3 + 7.0);
        float age = tau * per;
        vec2 pos = vec2(x0 + 34.0 * sin(age * 3.1 + fi) * age + 25.0 * age * (hash11(fi) - 0.5), BASEY - 120.0 - vy * age + 30.0 * age * age);
        vec2 vel = vec2(34.0 * (3.1 * cos(age * 3.1 + fi) * age + sin(age * 3.1 + fi)), -vy + 60.0 * age) / 24.0 * 0.5;  // half-frame streak
        float life = ss(0.0, 0.05, tau) * ss(1.0, 0.55, tau);
        float d = sdSeg(p, pos - vel, pos + vel);
        float I = exp(-d * d / 1.1) * life;
        c += kel(mix(1900.0, 1300.0, tau)) * I * 1.1;
      }
      return c * lit;
    }

    void main(){
      setupP(uShake);
      TT = uFr / 24.0;
      float k = clamp((uFr - uOff) / 5.0, 0.0, 1.0);               // collapse progress
      float alive = 1.0 - step(uDark, uFr);                         // main light on?
      float hf = mix(1.0, 0.11, k * k * (3.0 - 2.0 * k));
      float If = (1.0 - 0.55 * k) * alive;
      float lit = mix(1.0, 0.45, k) * alive;                        // flame light on the set
      vec3 col = vec3(0.0);
      float outl = 0.0;
      vec3 bed = coals(P, lit, outl);
      col += bed;
      col += stems(P, lit);
      col += flame(P, hf, If);
      vec3 rim; float stk = sticks(P, rim);
      col = mix(col, vec3(0.0015), stk * ss(0.2, 0.6, hf) * alive);
      col += rim * stk * alive * ss(0.2, 0.6, hf);
      float socc, soutl;
      vec3 st = stones(P, lit, socc, soutl);
      col = mix(col, st, socc);
      col += sparks(P, alive * (1.0 - k));
      // a faint ruddy haze around the fire (light scattered by smoke), very low
      vec2 hq = (P - vec2(CC.x, 560.0)) / vec2(330.0, 300.0);
      col += vec3(1.0, 0.45, 0.16) * 0.006 * exp(-dot(hq, hq) * 1.5) * If;
      // dark phase: only the ember outline of the coal chunks
      float var = 0.85 + 0.3 * texture2D(uNoise, P / 120.0).r;
      vec3 dark = emberLine(outl * (1.0 - socc), var) * uOutline;
      col = alive > 0.5 ? col : dark;
      gl_FragColor = vec4(col * uGain, 1.0);
    }`, U);

  // hand-held breath, 1 px (S04-a only): smooth deterministic noise of t
  const shake = (util, t) => { const s = util.shake(t, 404, 0.35, 2); return [s[0] * 1.0, s[1] * 0.8]; };
  return {
    U,
    render(target, fr, t, outline, additive, util) {
      U.uFr.value = fr; U.uOutline.value = outline;
      const s = shake(util, t); U.uShake.value.set(s[0], s[1]);
      p.draw(renderer, target, additive);
    },
  };
}
