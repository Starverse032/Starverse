// l_carriers/fire.js — S04-a 篝火近景 [2280, 2352): 50 mm, locked + 1 px hand-held breath.
//
// The same campfire as F3's distant warm point, now close: a mass of fast, rolling tongues (advected
// noise, 6–10 Hz flicker, blackbody 1200–1900 K, high-saturation orange), its white-hot body (the only
// pixels ≥ 180) held symmetric about C so the luminance centroid stays on C. Under it a bed of cracked
// coals (Voronoi chunks with glowing seams and ember cracks, white ash crusts lit by the flame), grass
// stems and wood fibres burning at the edge of the bed, charred logs leaning into it (teepee),
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

    // a low mound of coals under the flame; top contour (y down)
    float bedTop(float x){ float d = (x - CC.x) / 215.0; return 742.0 - 46.0 * sqrt(max(1.0 - d * d, 0.0)) + 7.0 * (nz(vec2(x / 500.0, 0.71)).r - 0.5) * 2.0; }

    // ---------------- flame ----------------
    // a soft union of 9 tongues, each with its own 6–10 Hz height pulse and sway, broken up by advected
    // noise; a white-hot body low in the middle. returns HDR emission; hf = height factor (collapse)
    vec3 flame(vec2 p, float hf, float If, out float dOut){
      dOut = 0.0;
      float x = (p.x - CC.x) / 150.0;
      float base = min(BASEY, bedTop(p.x) + 14.0) + 8.0 * (nz(vec2(p.x / 60.0, TT * 0.8)).r - 0.5);
      float h = (base - p.y) / FH;                          // 0 at base, 1 at tips
      if (h < -0.12 || h > 1.3 * hf + 0.05 || abs(x) > 1.45) return vec3(0.0);
      float hn = h / max(hf, 0.05);
      vec2 a = vec2(x * 0.40, hn * 0.50 - TT * 0.70);
      vec3 n1 = nz(a);
      vec3 n2 = nz(a * vec2(2.3, 1.9) + (n1.rg - 0.5) * 0.30 + vec2(0.13, -TT * 0.60));
      vec3 n3 = nz(a * vec2(5.1, 3.7) + (n2.gb - 0.5) * 0.22 + vec2(0.41, -TT * 1.45));
      float warp = (n1.r - 0.5) * 0.55 * hn + (n2.b - 0.5) * 0.22 * hn;
      float F = 0.0;                                        // soft union of tongue fields
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float bx = -0.80 + 1.60 * (fi + 0.6 * hash11(fi * 3.7) - 0.3) / 8.0;
        float cen = 1.0 - abs(bx) / 0.95;
        float fq = 6.0 + 4.0 * hash11(fi * 1.9 + 0.4);      // 6–10 Hz
        float pulse = 0.5 + 0.5 * sin(TT * 6.2832 * fq + 6.2832 * hash11(fi * 5.3)) * (0.6 + 0.4 * sin(TT * 2.3 + fi));
        float Hi = (0.34 + 0.74 * cen * cen + 0.18 * hash11(fi * 7.1)) * (0.80 + 0.26 * pulse);
        float sw = sin(TT * (2.0 + hash11(fi * 2.2) * 2.5) + fi * 1.7 + hn * 3.0) * 0.09 * hn;
        float xi = x - bx - warp - sw - bx * 0.35 * hn;
        float r = clamp(hn / Hi, 0.0, 1.2);
        float wi = (0.13 + 0.12 * cen + 0.05 * hash11(fi * 9.9)) * (1.0 - 0.55 * r) + 0.015;
        float ti = exp(-pow(xi / wi, 2.0)) * pow(max(1.0 - r, 0.0), 0.45) * (0.75 + 0.25 * hash11(fi * 4.4));
        F = 1.0 - (1.0 - F) * (1.0 - ti);
      }
      // the merged lower sheet
      float bodyW = 0.62 * (1.0 - ss(0.0, 0.45, hn)) + 0.10;
      F = max(F, 0.85 * exp(-pow((x - warp * 0.5) / bodyW, 2.0)) * ss(0.45, 0.05, hn));
      F *= ss(-0.10, 0.06, h) * (0.55 + 0.45 * ss(-0.02, 0.08, h));
      // erosion by advected turbulence: ragged edges, holes, detached flamelets near the tips
      float n = 0.50 * n2.g + 0.33 * n3.r + 0.17 * n1.b;
      float dens = ss(0.0, 0.55 + 0.25 * hn, F * 1.15 - n * (0.30 + 0.60 * hn) - 0.05);
      dens = clamp(dens, 0.0, 1.0);
      dOut = dens;
      // striations along the flow: tall thin streaks advected upward (what makes it read as gas, not a cut-out)
      float stri = nz(vec2(x * 1.6 - warp * 1.2, hn * 0.16 - TT * 0.55)).r;
      stri = 0.45 + 1.1 * ss(0.30, 0.75, stri * 0.7 + n3.g * 0.45);
      // white-hot body: a stable ellipse centred on C (it is what K1 measures), breathing in brightness only
      vec2 cq = vec2((p.x - CC.x) / 84.0, (p.y - CC.y) / 120.0);
      float core = exp(-pow(dot(cq, cq), 1.3) * 1.9) * ss(0.25, 0.9, hf) * (0.75 + 0.25 * n2.g) * (0.7 + 0.3 * stri);
      float T = mix(1250.0, 1700.0, clamp(dens * 0.45 + (1.0 - hn) * 0.40 + (n3.b - 0.5) * 0.25, 0.0, 1.0));
      vec3 c = kel(T) * pow(dens, 1.6) * (0.16 + 0.32 * (1.0 - hn)) * stri;
      c += kel(mix(1600.0, 1900.0, core)) * core * core * 1.7 * ss(0.1, 0.6, dens);
      return c * If;
    }

    // ---------------- coal bed ----------------
    // a low mound under the flame; top contour (y down)
    vec3 coals(vec2 p, float lit, out float outl){
      outl = 0.0;
      float top = bedTop(p.x);
      float bot = 800.0 + 10.0 * (nz(vec2(p.x / 600.0, 0.2)).g - 0.5);
      float side = abs(p.x - CC.x) - 222.0;
      float sd = max(max(top - p.y, p.y - bot), side);
      if (sd > 6.0) return vec3(0.0);
      // chunks: Voronoi in a foreshortened plane, domain-warped so they are irregular lumps
      vec2 w = (nz(p / 160.0).rg - 0.5) * 0.9;
      vec2 q = vec2(p.x / 34.0, p.y / 19.0) + w;
      vec2 iq = floor(q), fq = fract(q);
      float d1 = 9.0, d2 = 9.0; vec2 c1 = vec2(0.0), id1 = vec2(0.0);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = vec2(ihash2(ivec2(iq + g) + ivec2(31, 7)), ihash2(ivec2(iq + g) + ivec2(5, 91)));
        vec2 r = g + 0.1 + 0.8 * o - fq;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; c1 = r; id1 = iq + g; } else if (d < d2) d2 = d;
      }
      d1 = sqrt(d1); d2 = sqrt(d2);
      float seam = d2 - d1;
      float hc = ihash2(ivec2(id1) + ivec2(17, 3)), hc2 = ihash2(ivec2(id1) + ivec2(77, 13));
      vec2 nn = -c1 / max(d1, 1e-3) * clamp(d1 * 1.4, 0.0, 1.0);
      float up = clamp(0.45 + 0.8 * nn.y, 0.0, 1.0);
      float nearF = exp(-pow((p.x - CC.x) / 150.0, 2.0)) * ss(bot, top, p.y);    // under the flame = hottest
      // surface: black charcoal with an alligator char pattern, grey-white ash crusts
      float gator = ss(0.08, 0.0, abs(nz(p / 26.0 + hc * 5.0).b - 0.5));
      float ash = ss(0.58, 0.78, nz(p / 55.0 + hc).g + 0.3 * hc2 - 0.1 * nearF);
      vec3 alb = mix(vec3(0.028, 0.024, 0.021), vec3(0.40, 0.385, 0.36), ash);
      vec3 flameLight = vec3(1.0, 0.50, 0.19) * (0.12 + 0.75 * nearF + 0.15 * ss(bot, top, p.y)) * up;
      vec3 col = alb * flameLight * lit * 0.55;
      // embers: hot chunks glow from inside their cracks; seams glow only where the bed is hot
      float pocket = ss(0.45, 0.75, nz(p / 140.0 + 0.3).r + 0.35 * nearF);
      float hot = clamp(nearF * 1.1 * (0.5 + 0.5 * pocket) + 0.45 * pocket * hc - 0.2, 0.0, 1.0);
      float breathe = 0.8 + 0.2 * sin(TT * (1.1 + hc * 1.9) + hc * 20.0);
      float seamGlow = exp(-seam * seam / 0.014) * hot * hot * ss(0.25, 0.8, hc2 + nearF * 0.5);
      float crk = gator * (1.0 - ash) * hot * (0.4 + 0.6 * hc);
      float glowFace = hot * hot * (1.0 - ash) * 0.10 * (0.6 + 0.4 * up);       // a chunk glowing through
      vec3 em = kel(mix(1000.0, 1350.0, hot * hc2)) * (seamGlow * 0.30 + crk * 0.16 + glowFace) * breathe;
      col += em * lit;
      float inside = covD(sd);
      // dark phase: chunk boundaries + bed contour as thin ember lines (2–3 px)
      float chunkEdge = lineD(seam * 19.0, 2.4) * ss(0.2, 0.7, hc + nearF);
      float contour = lineD(top - p.y, 2.6) * step(side, 0.0);
      outl = max(chunkEdge * inside, contour) * (0.8 + 0.4 * hc);
      return col * inside;
    }

    // ---------------- burning stems at the edge of the bed ----------------
    vec3 stems(vec2 p, float lit){
      vec3 c = vec3(0.0);
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float h1 = hash11(fi * 3.17 + 1.0), h2 = hash11(fi * 7.31 + 2.0), h3 = hash11(fi * 1.93 + 5.0);
        float sgn = i < 3 ? -1.0 : 1.0;
        vec2 a = vec2(CC.x + sgn * (175.0 + 40.0 * h1), 770.0 + 30.0 * h2);
        vec2 b = a + vec2(sgn * (50.0 + 60.0 * h3), 8.0 + 22.0 * h1);
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

    // ---------------- charred logs leaning into the fire (teepee) ----------------
    // returns coverage; col = the log's own appearance (char, glowing alligator cracks on the hot side)
    float logs(vec2 p, float lit, out vec3 col){
      col = vec3(0.0);
      vec2 A[4] = vec2[4](vec2(742.0, 812.0), vec2(1188.0, 818.0), vec2(1078.0, 800.0), vec2(856.0, 806.0));
      vec2 B[4] = vec2[4](vec2(935.0, 575.0), vec2(1000.0, 590.0), vec2(948.0, 610.0), vec2(1002.0, 632.0));
      float R[4] = float[4](19.0, 21.0, 13.0, 12.0);
      float m = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 ba = B[i] - A[i]; float L = length(ba); vec2 dir = ba / L;
        vec2 pa = p - A[i];
        float t = clamp(dot(pa, dir), 0.0, L);
        float r = R[i] * (1.0 - 0.45 * t / L) * (0.9 + 0.2 * nz(vec2(t / 60.0, float(i))).r);
        float bend = 10.0 * sin(3.1416 * t / L) * (float(i) < 2.0 ? 1.0 : -0.6);
        float dn = dot(pa, vec2(-dir.y, dir.x)) - bend;
        float d = abs(dn) - r;
        float end = dot(pa, dir) - L;                       // burnt-off tip
        d = max(d, end);
        float cv = covD(d) * step(-2.0, dot(pa, dir));
        if (cv <= 0.0) continue;
        float u = dn / max(r, 1.0);                         // −1 … 1 across the log
        float heat = ss(0.2, 1.0, t / L);                   // hotter toward the fire
        vec2 st = vec2(t / 9.0, u * 2.2 + float(i) * 3.0);
        float gator = ss(0.10, 0.0, abs(nz(st / 7.0).b - 0.5)) * ss(-0.2, 0.8, -u * sign(dir.x) + 0.3);
        float cyl = sqrt(max(1.0 - u * u, 0.0));
        vec3 c = vec3(0.016, 0.013, 0.011) * (0.35 + 0.65 * cyl) * (0.5 + 0.7 * nz(st / 3.0).r);
        c += kel(1150.0) * gator * heat * 0.30;
        c += kel(1250.0) * 0.30 * ss(0.85, 1.0, t / L) * (1.0 - abs(u));   // glowing burnt tip
        // fire-light on the upper edge of the log
        c += vec3(1.0, 0.5, 0.2) * 0.022 * exp(-pow((u + sign(dir.x) * 0.9) / 0.25, 2.0)) * heat * (0.4 + 0.6 * nz(st / 2.0).g);
        col = mix(col, c * lit, cv);
        m = max(m, cv);
      }
      return m;
    }

    // ---------------- stones (front of the ring): a thin lit top edge, black fronts ----------------
    vec3 stones(vec2 p, float lit, out float occ, out float outl){
      occ = 0.0; outl = 0.0;
      vec3 c = vec3(0.0);
      vec4 S[4] = vec4[4](vec4(640.0, 900.0, 150.0, 58.0), vec4(1290.0, 905.0, 160.0, 62.0), vec4(905.0, 948.0, 120.0, 46.0),
                          vec4(1110.0, 955.0, 120.0, 50.0));
      for (int i = 0; i < 4; i++) {
        vec2 q = p - S[i].xy;
        float fi = float(i);
        // flattened, faceted river stones: squash the top, perturb the contour
        vec2 qq = q; qq.y *= q.y < 0.0 ? 1.25 : 0.9;
        float bump = (nz(vec2(atan(q.y, q.x) * 0.6 + fi, fi * 0.3)).r - 0.5) * 16.0 + (nz(p / 40.0 + fi).g - 0.5) * 5.0;
        float d = sdEll(qq, S[i].zw) - bump;
        if (d > 3.0) continue;
        float m = covD(d);
        vec2 n = normalize(q / (S[i].zw * S[i].zw) + 1e-5);
        float upf = clamp(-n.y - 0.15, 0.0, 1.0);
        float facing = clamp(1.0 - abs(p.x - CC.x) / 700.0, 0.2, 1.0);       // the side toward the fire
        float rimW = lineD(d + 1.6, 2.6) * pow(upf, 1.2) * (0.5 + 0.8 * nz(vec2(q.x / 30.0, fi)).r);
        float face = exp(-max(-d, 0.0) / 10.0) * pow(upf, 2.5);
        float tex = 0.7 + 0.6 * nz(p / vec2(40.0, 18.0) + fi).g;
        vec3 sc = vec3(1.0, 0.50, 0.21) * (0.11 * rimW + 0.035 * face * tex) * facing * lit;
        sc += vec3(0.0042, 0.0038, 0.0034);                       // black front, a hair above the ground
        c = mix(c, sc, m);
        occ = max(occ, m);
      }
      return c;
    }

    // ---------------- ground: ash and trodden earth lit by the fire ----------------
    vec3 ground(vec2 p, float lit){
      if (p.y < 700.0) return vec3(0.0);
      vec2 q = vec2((p.x - CC.x) / 520.0, (p.y - 790.0) / 150.0);
      float fall = exp(-dot(q, q) * 1.4) * ss(700.0, 790.0, p.y);
      float ash = ss(0.35, 0.8, nz(p / vec2(120.0, 40.0)).r) * exp(-dot(q, q) * 3.0);
      float tex = 0.55 + 0.9 * nz(p / vec2(14.0, 6.0)).g * nz(p / vec2(60.0, 20.0) + 0.5).b;
      vec3 alb = mix(vec3(0.05, 0.04, 0.032), vec3(0.24, 0.23, 0.21), ash);
      return alb * vec3(1.0, 0.5, 0.2) * 0.25 * fall * tex * lit;
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
      col += ground(P, lit);
      vec3 bed = coals(P, lit, outl);
      col = mix(col, bed, ss(-1.0, 1.0, length(bed) * 1e4));
      col += stems(P, lit);
      float fd;
      vec3 fl = flame(P, hf, If, fd);
      vec3 lc; float lm = logs(P, lit * alive, lc);
      // logs sit among the flames: 65 % of the flame is behind them, 35 % licks in front
      col = mix(col + fl, lc + fl * 0.35, lm);
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
