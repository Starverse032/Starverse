/* LATENT CLASH — FX: signature specials at the V2 scale (~100 px fighters) (owned by FX).
 * Claude:   claude.sonnetPillar (new), claude.haikuSlash v2, claude.guardrail v2 + guardCatch,
 *           claude.spark v2 (sunburst flower projectile, L/M/H sizes, petal trail).
 * DeepSeek: deepseek.wave v2 (taller breaker), deepseek.breachCrescent (new),
 *           deepseek.geyser (new; deepseek.poolOut is now an alias), chainHit v2, diveTrail v2.
 * Same names / option semantics as v1; this file loads after the v1 files and overrides them. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var A = I.A = I.A || {};
  var SC = [{}, {}], SD = [{}, {}];
  function lay(O, d) { return O.layer == null ? d : O.layer; }

  // ---- 11x11 seal glyphs -------------------------------------------------------------
  var SEAL = {
    '五': ['.#########.', '....##.....', '....##.....', '....##.....', '.#########.', '...##...##.', '...##...##.', '...##...##.', '..##....##.', '..##....##.', '###########'],
    '七': ['...##......', '...##......', '...##...###', '...######..', '######.....', '...##......', '...##......', '...##......', '...##.....#', '...##.....#', '....#######']
  };

  // ---- haiku strokes v2 (facing right, rel. the hip anchor) -----------------------------
  var STROKES = [
    { p: [-34, 24, 4, 22, 72, -42], w: 8, ch: '五', seal: [74, -60], box: [140, 110, 50, 70] },
    { p: [-44, 4, 24, -34, 104, -6], w: 9, ch: '七', seal: [100, -36], box: [170, 90, 56, 54] },
    { p: [-34, -54, 66, -46, 192, 22], w: 10, ch: '五', seal: [176, -22], box: [248, 120, 48, 76] }
  ];
  function bez(s, u) { var p = s.p, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; return [a * p[0] + b * p[2] + c * p[4], a * p[1] + b * p[3] + c * p[5]]; }
  function brushW(s, u) { return s.w * (u < 0.1 ? 0.55 + u / 0.1 * 0.45 : u < 0.42 ? 1 : 1 - (u - 0.42) / 0.58 * 0.93); }

  function bakeClaude(pal) {
    var sc = I.scheme('claude', pal), L = sc.light.u, S = sc.seal.u, G = sc.gold.u, C = SC[pal];

    // SONNET PILLAR — 26f, 64x204, origin (32,200)
    C.pillar = I.anim(64, 204, 26, 32, 200, function (b, f) {
      var cx = 32, by = 200, H = f === 0 ? 70 : f === 1 ? 150 : 192, w = f < 2 ? 3 : f === 2 ? 9 : f === 3 ? 19 : f < 15 ? 26 - (f % 3 === 0 ? 1 : 0) : Math.max(8, 26 - (f - 14) * 2.4);
      for (var y = by - H; y < by; y++) {
        var up = (by - y) / H, tip = up > 0.82 ? 1 - (up - 0.82) / 0.18 : 1, ww = w * (0.55 + 0.45 * tip), band = ((by - y + f * 7) % 16) < 3;
        for (var x = Math.round(cx - ww / 2); x < Math.round(cx + ww / 2); x++) {
          var e = Math.abs(x + 0.5 - cx) / (ww / 2), c;
          if (e < 0.22) c = L[0]; else if (e < 0.45) c = band ? L[0] : G[1]; else if (e < 0.7) c = band ? L[1] : L[2]; else if (e < 0.88) c = L[3];
          else { if (I.bayer(x, y + f) < 0.5) c = L[4]; else continue; }
          if (tip < 1 && I.bayer(x, y) > tip * 1.3) continue;
          b.set(x, y, c);
        }
      }
      if (f >= 2 && f < 12) {   // base flare: sunburst petals + ellipse
        var k = Math.min(1, (f - 1) / 3), fade = f < 8 ? 1 : 1 - (f - 8) / 4;
        b.ellipse(cx, by - 2, 30 * k, 5 * k, L[2]); b.ellipse(cx, by - 2, 20 * k, 3 * k, L[1]); b.rect(cx - 16 * k, by - 3, 32 * k, 1, L[0]);
        for (var p = 0; p < 10; p++) { var a = PI + (p + 0.5) * PI / 10; if (fade > 0.4 || p % 2) b.ray(cx, by - 2, a, 6, 18 + (p % 2 ? 0 : 8) * k, 2.2, 0.3, p % 2 ? L[2] : L[1]); }
      }
      if (f < 14) b.outline(L[5]);
      if (f >= 19) b.breakup(function (x, y) { return 1 - (f - 18) / 7 - (y / 204) * 0.3; }, f, 0);
    });

    // HAIKU v2 — 12f per stroke
    C.slash = STROKES.map(function (st, si) {
      var bw = st.box[0], bh = st.box[1], ox = st.box[2], oy = st.box[3], len = 0, pp = bez(st, 0);
      for (var q = 1; q <= 20; q++) { var pq = bez(st, q / 20); len += Math.hypot(pq[0] - pp[0], pq[1] - pp[1]); pp = pq; }
      var N = Math.ceil(len * 1.6), rng = I.bakeRng(300 + si * 17), gaps = [];
      for (var g = 0; g < 3; g++) gaps.push({ off: -0.62 + g * 0.6 + (rng() - 0.5) * 0.2, from: 0.5 + rng() * 0.25 });
      return I.anim(bw, bh, 12, ox, oy, function (b, f) {
        function body(u0, u1, ws, cOut, cMid, cCore, dry, dst) {
          for (var i = 0; i <= N; i++) {
            var u = u0 + (u1 - u0) * i / N, pt = bez(st, u), w = brushW(st, u) * ws;
            if (w < 0.4) continue;
            var p2 = bez(st, Math.min(1, u + 0.005)), dx = p2[0] - pt[0], dy = p2[1] - pt[1], dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
            for (var s2 = -w; s2 <= w; s2 += 0.5) {
              var rel = s2 / w, isDry = false;
              if (dry) for (var gi = 0; gi < 3; gi++) if (u > gaps[gi].from && Math.abs(rel - gaps[gi].off) < 0.15) isDry = true;
              if (isDry) continue;
              dst.set(ox + pt[0] + nx * s2, oy + pt[1] + ny * s2, Math.abs(rel) > 0.72 ? cOut : Math.abs(rel + 0.25) < 0.3 ? cCore : cMid);
            }
          }
        }
        if (f === 0) { body(0, 1, 1.15, L[0], L[0], L[0], false, b); b.outline(L[2]); b.outline(L[5]); return; }
        if (f < 3) { body(f === 1 ? 0 : 0.06, 1, 1.05, L[3], L[1], L[0], true, b); b.outline(L[5]); return; }
        var k = (f - 2) / 9, m = new I.Buf(bw, bh);
        body(0.08 + k * 0.7, 1, 1 - k * 0.5, L[4], L[2 + (k > 0.5 ? 1 : 0)], L[1], true, m);
        m.breakup(1 - k * 0.45, f, 0);
        if (f < 6) m.outline(L[5]);
        b.blit(m, 0, 0);
        var tip = bez(st, 1), ang = Math.atan2(st.p[5] - st.p[3], st.p[4] - st.p[2]);
        for (var d = 0; d < 5 + si; d++) {
          var r1 = I.bakeRng(si * 50 + d)(), a2 = ang + (r1 - 0.5) * 1.1, dist = 4 + (f - 2) * (2.5 + r1 * 2.5);
          b.rect(ox + tip[0] + Math.cos(a2) * dist, oy + tip[1] + Math.sin(a2) * dist + (f - 2) * (f - 2) * 0.15, d % 2 ? 1 : 2, d % 3 ? 1 : 2, L[3 + (f > 7 ? 1 : 0)]);
        }
      });
    });
    // seals 15x15 stamps, 26f
    C.seal = {};
    ['五', '七'].forEach(function (ch) {
      var g = SEAL[ch], SZ = 15;
      C.seal[ch] = I.anim(SZ + 6, SZ + 6, 26, (SZ + 6) / 2, (SZ + 6) / 2, function (b, f) {
        var x0 = 3, y0 = 3;
        if (f === 0) { b.rect(x0 - 3, y0 - 3, SZ + 6, SZ + 6, S[0]); return; }
        var m = new I.Buf(SZ + 6, SZ + 6), sc2 = f === 1 ? 1 : 0;
        m.rect(x0 - sc2, y0 - sc2, SZ + sc2 * 2, SZ + sc2 * 2, S[1]);
        m.rect(x0, y0, SZ, 1, S[2]); m.rect(x0, y0 + SZ - 1, SZ, 1, S[2]); m.rect(x0, y0, 1, SZ, S[2]); m.rect(x0 + SZ - 1, y0, 1, SZ, S[2]);
        m.set(x0, y0, 0); m.set(x0 + SZ - 1, y0 + SZ - 1, 0); m.set(x0 + SZ - 1, y0 + 3, S[2]);
        for (var y = 0; y < 11; y++) for (var x = 0; x < 11; x++) if (g[y].charAt(x) === '#') m.set(x0 + 2 + x, y0 + 2 + y, S[0]);
        m.outline(sc.outline ? I.col(sc.outline) : S[3]);
        if (f > 17) m.breakup(1 - (f - 17) / 9, 0, f);
        b.blit(m, 0, 0);
      });
    });

    // GUARDRAIL v2 — 6 appear + 24 loop + 6 end, 48x108; barrier spans x 26..60, y -102..-6 rel. origin
    var GW = 48, GH = 108, OX = -22, OY = 104, mask = new I.Buf(GW, GH), cell = new Int16Array(GW * GH).fill(-1), cen = [];
    var top = 2, bot = 98, mid = 50;
    mask.poly([21, top, 38, top + 12, 38, bot - 12, 21, bot, 4, bot - 12, 4, top + 12], 1);
    var bent = new I.Buf(GW, GH);
    for (var yy = 0; yy < GH; yy++) { var uu = (yy - mid) / (mid - top), sh = -Math.round(uu * uu * 4); for (var xx = 0; xx < GW; xx++) if (mask.d[yy * GW + xx]) bent.set(xx + sh + 4, yy, 1); }
    mask = bent;
    for (var r = -1; r * 9 < GH + 9; r++) for (var q = -1; q < 7; q++) cen.push([q * 10 + (r & 1 ? 5 : 0), r * 9]);
    for (yy = 0; yy < GH; yy++) for (xx = 0; xx < GW; xx++) if (mask.d[yy * GW + xx]) {
      var best = 1e9, bi = -1;
      for (var kk = 0; kk < cen.length; kk++) { var ddx = xx - cen[kk][0], ddy = (yy - cen[kk][1]) * 1.15, dd = ddx * ddx + ddy * ddy; if (dd < best) { best = dd; bi = kk; } }
      cell[yy * GW + xx] = bi;
    }
    function edgeAt(x, y) { var c = cell[y * GW + x]; return (x + 1 < GW && cell[y * GW + x + 1] >= 0 && cell[y * GW + x + 1] !== c) || (y + 1 < GH && cell[(y + 1) * GW + x] >= 0 && cell[(y + 1) * GW + x] !== c); }
    function border(x, y) { return !mask.get(x - 1, y) || !mask.get(x + 1, y) || !mask.get(x, y - 1) || !mask.get(x, y + 1); }
    function panel(b, f, amt) {
      var scan = (f * 4) % 130 - 14;
      for (var y = 0; y < GH; y++) for (var x = 0; x < GW; x++) {
        if (!mask.d[y * GW + x]) continue;
        var c = cell[y * GW + x], cy = cen[c] ? cen[c][1] : 0, bd = border(x, y), ed = edgeAt(x, y), hl = I.hash(c * 7 + Math.floor(f / 4) * 131) < 0.16, sc2 = Math.abs(y - scan) <= 1;
        if (amt != null && Math.abs(cy - mid) > amt) { if (bd && Math.abs(y - mid) <= amt + 6) b.set(x, y, L[0]); continue; }
        var col = 0;
        if (bd) col = sc2 ? L[0] : L[1];
        else if (ed) col = sc2 || hl ? L[0] : L[2];
        else if (sc2) col = (x + y) & 1 ? L[0] : L[1];
        else if (I.bayer(x, y) < (hl ? 0.55 : I.hash(c + 999) < 0.5 ? 0.38 : 0.22)) col = hl ? L[1] : L[2];
        if (col) b.set(x, y, col);
      }
    }
    C.guard = I.anim(GW, GH, 36, OX, OY, function (b, f) {
      if (f === 0) { for (var i = 0; i < mask.d.length; i++) if (mask.d[i]) b.d[i] = L[0]; b.outline(L[2]); b.outline(L[5]); return; }
      if (f < 6) { panel(b, f, (f - 1) * 12 + 6); b.outline(L[4]); return; }
      if (f < 30) { panel(b, f - 6, null); b.outline(L[4]); return; }
      var e = (f - 30) / 6, m = new I.Buf(GW, GH);
      panel(m, f, null); m.outline(L[4]);
      m.breakup(function (x, y) { return 1 - e * 1.1 - (Math.abs(y - mid) / 60) * e; }, 0, f);
      b.blit(m, 0, Math.round(-e * 4));
    });
    C.grFlash = I.anim(GW, GH, 5, OX, OY, function (b, f) {
      if (f === 0) { for (var i = 0; i < mask.d.length; i++) if (mask.d[i]) b.d[i] = L[0]; b.outline(L[1]); b.outline(L[4]); return; }
      if (f < 3) { panel(b, f, null); for (var j = 0; j < b.d.length; j++) if (b.d[j]) b.d[j] = f === 1 ? L[0] : L[1]; b.breakup(0.8 - f * 0.2, f, 0); return; }
      for (var y = 0; y < GH; y++) for (var x = 0; x < GW; x++) if (mask.d[y * GW + x] && edgeAt(x, y) && I.bayer(x, y + f) < 0.5 - (f - 3) * 0.2) b.set(x, y, L[2]);
    });

    // SPARK v2 — sunburst flower: 3 sizes x (12 rotations x 2 pulses)
    C.spark = [9, 12, 15].map(function (R) {
      var S2 = R * 2 + 12, c0 = S2 / 2;
      return I.anim(S2, S2, 24, c0, c0, function (b, f) {
        var rot = (f % 12) * (TAU / 12) / 12, pulse = f >= 12 ? 1 : 0;
        var halo = new I.Buf(S2, S2); halo.disc(c0, c0, R + 4 + pulse, L[3]); halo.breakup(0.3, f, 0); b.blit(halo, 0, 0);
        var pet = new I.Buf(S2, S2);
        for (var k = 0; k < 12; k++) { var a = rot + k * TAU / 12; pet.ray(c0, c0, a, R * 0.3, R * (k % 2 ? 0.92 : 1.08) + pulse, R * 0.2, 0.3, L[1]); }
        pet.outline(L[4]);
        for (k = 0; k < 12; k++) { var a2 = rot + k * TAU / 12; pet.ray(c0, c0, a2, R * 0.3, R * 0.72, R * 0.08 + 0.4, 0.3, L[0]); }
        b.blit(pet, 0, 0);
        b.disc(c0, c0, R * 0.4 + pulse * 0.6, L[2]); b.disc(c0, c0, R * 0.3, L[0]);
      });
    });
    C.petal = I.anim(11, 11, 8, 5, 5, function (b, f) { var a = f * PI / 8; b.ray(5.5, 5.5, a, -4.5, 4.5, 2, 0.3, L[1]); b.set(5, 5, L[0]); b.outline(L[3]); });
  }

  // ---- DeepSeek ----------------------------------------------------------------------------
  function bakeDeep(pal) {
    var sc = I.scheme('deepseek', pal), Wt = sc.water.u, F = sc.foam.u, D = SD[pal];
    // WAVE v2 — 8f loop, 56x50, origin base centre (26,46); ~40x40 breaker
    D.wave = I.anim(56, 50, 8, 26, 46, function (b, f) {
      var bx = 34, by = 46, Hc = 38 + ((f >> 1) & 1), j = (f & 3) === 1 || (f & 3) === 2 ? 1 : 0, rng = I.bakeRng(70 + f);
      b.poly([2, by, 8, by - Hc * 0.3, 18, by - Hc * 0.75, 26, by - Hc * 0.97, 31, by - Hc, 38, by - Hc * 0.96 + j, 44, by - Hc * 0.84, 47 + j, by - Hc * 0.66,
        43, by - Hc * 0.6, 38, by - Hc * 0.66, 35, by - Hc * 0.5, 37, by - Hc * 0.25, 41, by - 3, 44, by], Wt[2]);
      for (var y = 0; y < 50; y++) for (var x = 0; x < 56; x++) { var i = y * 56 + x; if (!b.d[i]) continue; var fr = (by - y) / Hc, bz = I.bayer(x, y); if (fr < 0.2 + bz * 0.12) b.d[i] = Wt[3]; else if (fr > 0.6 + bz * 0.15 && x < 32) b.d[i] = Wt[1]; }
      b.poly([31, by - Hc, 38, by - Hc * 0.96, 35, by - Hc * 0.5, 37, by - Hc * 0.25, 41, by - 3, 44, by, 34, by, 28, by - Hc * 0.5], Wt[3]);
      b.poly([43, by - Hc * 0.6, 38, by - Hc * 0.66, 36, by - Hc * 0.56, 41, by - Hc * 0.56], Wt[4]);
      for (var s = 0; s < 3; s++) b.line(8 + s * 7 + ((f * 2 + s * 3) % 6), by - 6 - s * 8, 14 + s * 7 + ((f * 2 + s * 3) % 6), by - 10 - s * 8, Wt[1]);
      b.outline(Wt[5]);
      for (x = 18; x < 47 + j; x++) { var u = (x - 18) / (29 + j), yt = by - Hc * (0.9 + 0.1 * Math.sin(Math.min(1, u * 1.4) * PI * 0.85)) + (u > 0.8 ? (u - 0.8) * Hc * 1.2 : 0); b.rect(x, Math.round(yt) - 1, 1, 2, (x + f) % 3 ? F[0] : F[1]); }
      for (var k = 0; k < 10; k++) { var px = 12 + rng() * 30, py = by - Hc - 2 - rng() * rng() * 14; b.rect(px, py, 1, rng() < 0.5 ? 2 : 1, rng() < 0.5 ? F[0] : Wt[1]); }
      for (k = 0; k < 4; k++) { var t2 = (f + k * 2) % 8; b.rect(24 - t2 * 2.4, by - Hc - t2 + t2 * t2 * 0.25, 2, 1, k % 2 ? F[0] : Wt[1]); }
      b.rect(0, by + 1, 48, 1, Wt[1]); for (var q = 0; q < 48; q += 3) b.set((q + f * 2) % 50, by, F[0]);
    });
    // BREACH CRESCENT — 14f, 140x150, origin = fighter origin at (70,140)
    D.crescent = I.anim(140, 150, 14, 70, 140, function (b, f) {
      var cx = 70 + 6, cy = 140 - 62, R = 52, a0 = PI * 0.42, sweep = Math.min(1, (f + 1) / 5) * PI * 1.45, head = a0 - sweep, rng = I.bakeRng(900 + f);
      var fade = f < 6 ? 0 : (f - 6) / 8, m = new I.Buf(140, 150);
      for (var i = 0; i <= 160; i++) {
        var u = i / 160, a = a0 - sweep * u, w = 3 + 10 * Math.sin(PI * Math.min(1, u * 1.15)) * (1 - fade * 0.6);
        if (u < fade * 0.9) continue;
        var px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R * 1.05, nx = Math.cos(a), ny = Math.sin(a);
        for (var s = -w; s <= w; s += 0.5) {
          var rel = s / w, c = rel > 0.55 ? Wt[0] : rel > 0.15 ? Wt[1] : rel > -0.5 ? Wt[2] : Wt[3];
          if (u > 0.92 && rel > 0) c = F[0];
          m.set(px + nx * s, py + ny * s, c);
        }
      }
      if (f < 8) m.outline(Wt[5]);
      if (fade > 0) m.breakup(1 - fade * 0.8, f, 0);
      b.blit(m, 0, 0);
      var hx = cx + Math.cos(head) * R, hy = cy + Math.sin(head) * R;
      for (var k = 0; k < 14; k++) {   // spray flung off the leading edge
        var aa = head - PI / 2 + (rng() - 0.5) * 1.4, d = 4 + rng() * 12 + f * 1.5;
        if (f < 10) b.rect(hx + Math.cos(aa) * d, hy + Math.sin(aa) * d + f * 0.8, rng() < 0.4 ? 2 : 1, 2, rng() < 0.5 ? F[0] : Wt[1]);
      }
    });
    // GEYSER — 26f, 80x200, origin (40,196)
    D.geyser = I.anim(80, 200, 26, 40, 196, function (b, f) {
      var cx = 40, by = 196, H = f < 5 ? 30 + f * 34 : f < 14 ? 170 + Math.sin(f) * 3 : Math.max(0, 170 - (f - 13) * 15), rng = I.bakeRng(1200 + f);
      if (H > 4) {
        var top = by - H;
        for (var y = Math.round(top); y <= by; y++) {
          var u = (y - top) / H, w = 6 + u * 9 + Math.sin(y * 0.35 + f * 1.3) * 1.6;
          b.rect(cx - w, y, w * 2, 1, Wt[2]); b.rect(cx - w * 0.5, y, w * 0.75, 1, Wt[1]); b.rect(cx - w * 0.25, y, 2, 1, Wt[0]);
          if (((y + f * 6) % 14) < 2) b.rect(cx - w + 1, y, w * 2 - 2, 1, Wt[1]);
          b.set(cx + w - 1, y, Wt[3]);
        }
        if (f < 16) {   // plume at the top
          var pw = 12 + Math.min(10, f * 2);
          b.ellipse(cx, top + 4, pw, 7, Wt[1]); b.ellipse(cx - 3, top + 2, pw * 0.6, 4, Wt[0]);
          for (var k = 0; k < 9; k++) { var a = -PI + (k + 0.5) * PI / 9; b.ray(cx, top + 4, a, pw * 0.7, pw + 8 + (k % 2) * 6, 2.4, 0.4, k % 2 ? Wt[1] : F[0]); }
        }
        b.outline(Wt[5]);
      }
      if (f > 3) for (var d = 0; d < 26; d++) {   // falling rain from the plume
        var dx = (rng() - 0.5) * (40 + f * 3), dy = by - 170 + (f - 3) * (f - 3) * 0.55 * (0.6 + rng() * 0.6) - rng() * 30;
        if (dy < by) b.rect(cx + dx, dy, 1, 3, rng() < 0.5 ? Wt[1] : F[0]);
      }
      b.ellipse(cx, by - 1, 22, 4, Wt[2]); b.rect(cx - 16, by - 2, 32, 1, F[0]);
      if (f > 13) b.breakup(1 - (f - 13) / 13, f, 0);
    });
    // chain-hit burst v2 — 12f, 76x64, radial water star + fan
    var rr = I.makeRays(161 + pal, 11, 20, 12, 0.5);
    D.burst = I.anim(76, 64, 12, 34, 32, function (b, f) {
      var cx = 34, cy = 32;
      if (f === 0) { I.starOf(b, cx, cy, rr, 1, 6, Wt[0]); b.disc(cx, cy, 8, Wt[0]); b.outline(Wt[2]); b.outline(Wt[5]); }
      else if (f === 1) { I.starOf(b, cx, cy, rr, 1.12, 6.5, Wt[2]); I.starOf(b, cx, cy, rr, 0.75, 4, Wt[1]); b.disc(cx, cy, 6, Wt[0]); b.outline(Wt[5]); }
      else if (f < 6) {
        var k = f - 2;
        for (var i = 0; i < rr.length; i++) { var r = rr[i], d = r.len * (0.7 + k * 0.2), s = Math.max(1, 3.6 - k * 0.7); b.disc(cx + Math.cos(r.a) * d, cy + Math.sin(r.a) * d + k * k * 0.6, s, k < 2 ? Wt[1] : Wt[2]); b.ray(cx, cy, r.a, r.len * (0.3 + k * 0.2), d - s, 0.3, Math.max(0.5, s * 0.6), Wt[2 + (k >> 1)]); }
        b.ring(cx, cy, 7 + k * 4, 8.6 + k * 4, k < 2 ? Wt[0] : Wt[1]);
        if (k < 2) b.outline(Wt[5]);
      } else { var q = f - 6; for (var j = 0; j < rr.length; j++) { var a = rr[j].a, dd = rr[j].len * (1.6 + q * 0.12); b.rect(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd + (4 + q) * (4 + q) * 0.3, q < 3 ? 2 : 1, q < 3 ? 2 : 1, q < 3 ? Wt[2] : Wt[3]); } }
    });
  }

  I.onInit('specials', function () { [0, 1].forEach(function (p) { bakeClaude(p); bakeDeep(p); }); });

  // ---- Claude: spawns + sprites -----------------------------------------------------------
  I.def('claude.sonnetPillar', function (x, y, O) {
    var s = I.scheme('claude', O.pal), C = SC[O.pal], L = lay(O, I.BACK);
    I.anim1(C.pillar, x, y, 1, L, 1);
    for (var i = 0; i < I.nOf(9, O); i++) {
      var tl = I.textLine(x + I.RS() * 8, y - 10 - I.R() * 60, I.RI(3, 6), -I.RR(1.6, 2.8), I.RI(22, 32), s.light.css, i & 1 ? 1 : -1, L);
      tl.d = I.RR(6, 12); tl.delay = I.RI(1, 12);
    }
    for (i = 0; i < I.nOf(8, O); i++) I.twinkle(x + I.RS() * 16, y - I.R() * 170, I.RI(2, 4), I.RI(10, 16), s.light.css, I.FRONT, I.RI(2, 16));
    if (A.ringGC) I.anim1(A.ringGC['claude' + O.pal][1], x, y, 1, I.BACK, 1, 2);
  }, { desc: 'Tall light pillar (~26x190) bursting from the floor: white-gold core, rising bands, sunburst flare at the base, rising verse lines spiralling up, twinkles, floor ring; dissolves bottom-up. 26f.', use: 'At her ORIGIN (floor) on the first rise frame of sonnet, facing = hers; back layer (behind her). Keep claude.sonnetTrail at the weapon as before.' });

  I.def('claude.haikuSlash', function (x, y, O) {
    var s = I.scheme('claude', O.pal), C = SC[O.pal], idx = ((O.index % 3) + 3) % 3, st = STROKES[idx], f = O.facing;
    I.anim1(C.slash[idx], x, y, f, lay(O, I.FRONT), 1);
    I.anim1(C.seal[st.ch], x + f * st.seal[0], y + st.seal[1], 1, lay(O, I.FRONT), 1, 2).vy = -0.12;
    var tip = bez(st, 1), a = Math.atan2(st.p[5] - st.p[3], (st.p[4] - st.p[2]) * f);
    for (var i = 0; i < I.nOf(5 + idx * 2, O); i++) I.spark(x + tip[0] * f, y + tip[1], a + I.RS() * 0.5, I.RR(2.5, 5), I.RI(7, 11), s.light.css, I.FRONT, { max: 8 });
    if (idx === 2) for (i = 0; i < 6; i++) { var u = 0.3 + i * 0.12, p = bez(st, u); I.twinkle(x + p[0] * f, y + p[1], 3, 12, s.light.css, I.FRONT, 2 + i); }
  }, { desc: 'v2: long calligraphic light-ink slash (index 0 rising ~110 px / 1 wide sweep ~150 px / 2 falling slash ~230 px, half the screen) with dry-brush streaks, ink drops, and a 15 px vermilion 五/七/五 seal stamp. 12f (seal 26f).', use: 'At the `hip` anchor on the first frame of hit1/hit2/hit3 (index 0/1/2), facing = hers.' });

  I.defSprite('claude.guardrail', {
    desc: 'v2 hex-panel barrier (~34x96, tall hexagon bulging toward the opponent): dithered translucent cells, bright lattice, scan line, flickering cells; 6f appear, 24f loop.',
    use: 'Draw at the fighter ORIGIN with her facing; t = frames since the stance began (loops). End: opts.phase="end", t = frames since it ended (6f dissolve).',
    info: { duration: 0, bbox: { x: 26, y: -102, w: 36, h: 96 }, appear: 6, endFrames: 6 },
    draw: function (ctx, sx, sy, t, o) {
      var C = SC[o.pal], f;
      if (o.phase === 'end') { if (t > 5 && o.u == null) return; f = 30 + Math.min(5, o.u != null ? Math.floor(o.u * 6) : t); }
      else f = t < 6 ? t : 6 + ((t - 6) % 24);
      I.drawAnim(ctx, C.guard, f, sx, sy, o.facing);
    }
  });

  I.def('claude.guardCatch', function (x, y, O) {
    var s = I.scheme('claude', O.pal), C = SC[O.pal], f = O.facing, bx = x + f * 43, cy = y - 54, CL = A.cl && A.cl[O.pal];
    I.anim1(C.grFlash, x, y, f, lay(O, I.FRONT), 1);
    if (A.ringC) I.anim1(A.ringC['claude' + O.pal][2], bx, cy, 1, I.FRONT, 1, 1);
    for (var i = 0; i < I.nOf(26, O) && CL; i++) {
      var p = I.add(I.K_SHARD, bx + I.RS() * 12, cy + I.RS() * 44, I.FRONT), a = (f > 0 ? 0 : PI) + I.RS() * 1.6;
      p.A = CL.shard[i % 3 ? 1 : 0]; p.vx = Math.cos(a) * I.RR(1.2, 4) + f * 0.8; p.vy = Math.sin(a) * I.RR(1, 3.2) - 1.2; p.g = 0.15; p.drag = 0.96;
      p.life = I.RI(18, 30); p.rot = I.R() * 8; p.vrot = I.RS() * 0.6; p.floor = I.GY + 2; p.bounce = 0.3; p.delay = 1;
    }
    I.spark4P(bx - f * 2, cy, s.light.css);
    for (i = 0; i < 7; i++) I.twinkle(bx + I.RS() * 14, cy + I.RS() * 40, 3, 12, s.light.css, I.FRONT, I.RI(1, 8));
  }, { desc: 'v2: the tall barrier pops white and shatters into ~26 spinning hex shards + ring + lens cross, ~30f.', use: 'At the fighter ORIGIN (same point/facing as claude.guardrail) when the counter catches a strike.' });

  I.defSprite('claude.spark', {
    desc: 'v2 projectile: spinning 12-petal sunburst flower (her hair ornament) with dithered glow, pulsing core and a trail of shed petals + motes. opts.power picks the size: < 0.4 L (~22 px), < 0.75 M (~28 px), else H (~34 px).',
    use: 'Every frame for the live projectile at its centre; t = frames alive; opts.power = 0.3 / 0.6 / 1 for L / M / H; opts.angle = travel angle (default along facing; airSpark e.g. 0.6).',
    info: { duration: 0, bbox: { x: -15, y: -15, w: 30, h: 30 }, sizes: { L: 22, M: 28, H: 34 } },
    draw: function (ctx, sx, sy, t, o) {
      var C = SC[o.pal], L = I.scheme('claude', o.pal).light.css, si = o.power < 0.4 ? 0 : o.power < 0.75 ? 1 : 2, R = [9, 12, 15][si];
      var ang = o.raw.angle != null ? +o.raw.angle : (o.facing > 0 ? 0 : PI), bx = -Math.cos(ang), by = -Math.sin(ang), nx = -by, ny = bx;
      for (var k = 0; k < 5; k++) {   // shed petals drifting behind
        var d = R + 4 + k * 7 + (t % 7), wob = Math.sin(t * 0.4 + k * 1.9) * (2 + k * 0.8);
        if (k === 4 && (t & 1)) continue;
        I.drawAnim(ctx, C.petal, (t + k * 3) & 7, Math.round(sx + bx * d + nx * wob), Math.round(sy + by * d + ny * wob), 1);
      }
      ctx.fillStyle = L[3];
      for (var j = 0; j < 6; j++) { var dd = R + 2 + j * 5 + ((t + j) % 3); ctx.fillRect(Math.round(sx + bx * dd + nx * Math.sin(t + j) * 5), Math.round(sy + by * dd + ny * Math.cos(t * 0.7 + j) * 5), 1, 1); }
      var spin = o.facing > 0 ? t : -t, f = ((spin % 12) + 12) % 12 + (((t >> 2) & 1) ? 12 : 0);
      I.drawAnim(ctx, C.spark[si], f, sx, sy, 1);
    }
  });

  // ---- DeepSeek: spawns + sprites -----------------------------------------------------------
  function drops(x, y, n, a0, spread, v0, v1, rc, layer, life) {
    for (var i = 0; i < n; i++) { var a = a0 + I.RS() * spread, v = I.RR(v0, v1); I.drop(x + I.RS() * 4, y, Math.cos(a) * v, Math.sin(a) * v, life || I.RI(22, 34), rc, layer, I.R() < 0.35 ? 2 : 1); }
  }

  I.defSprite('deepseek.wave', {
    desc: 'v2 travelling breaker (~44x40): curling lip with foam cap, darker face and hollow, light streaks on the back, spray flung back, foam skid line; 8f loop; rises out of the floor in the first 3 frames.',
    use: 'Every frame at the wave projectile position, origin = base centre on the floor; facing = travel direction; t = frames alive.',
    info: { duration: 0, bbox: { x: -24, y: -40, w: 46, h: 41 } },
    draw: function (ctx, sx, sy, t, o) {
      var D = SD[o.pal];
      if (t < 3) { ctx.save(); ctx.beginPath(); ctx.rect(sx - 40, sy - 60, 80, 62); ctx.clip(); I.drawAnim(ctx, D.wave, 0, sx, sy + (3 - t) * 12, o.facing); ctx.restore(); return; }
      I.drawAnim(ctx, D.wave, (t >> 1) % 8, sx, sy, o.facing);
    }
  });

  I.def('deepseek.breachCrescent', function (x, y, O) {
    var s = I.scheme('deepseek', O.pal), D = SD[O.pal];
    I.anim1(D.crescent, x, y, O.facing, lay(O, I.BACK), 1);
    drops(x + O.facing * 30, y - 90, I.nOf(14, O), -PI / 2 - O.facing * 0.6, 0.9, 1.5, 4, s.water.css, I.FRONT, I.RI(26, 40));
    for (var i = 0; i < I.nOf(6, O); i++) I.bubble(x + I.RS() * 40, y - 30 - I.R() * 80, I.RI(1, 2), I.RI(16, 26), s.water.css, I.FRONT, I.RI(2, 10));
  }, { desc: 'Big crescent of water (~110x120) that sweeps from in front of her up and over her head, following the somersault tail kick, foam on the leading edge, spray; dissolves into falling drops. 14f.', use: 'At her ORIGIN (floor point) on the first rise frame of breach, facing = hers; back layer. Keep deepseek.breachTrail at the tail tip as before.' });

  I.def('deepseek.geyser', function (x, y, O) {
    var s = I.scheme('deepseek', O.pal), D = SD[O.pal], DS = A.ds && A.ds[O.pal];
    I.anim1(D.geyser, x, y, 1, lay(O, I.BACK), 1);
    if (DS) { I.anim1(DS.crownL, x, y, O.facing, I.FRONT, 1); I.anim1(DS.foam[1], x - 12, y, -1, I.FRONT, 2, 3).vx = -0.9; I.anim1(DS.foam[1], x + 12, y, 1, I.FRONT, 2, 3).vx = 0.9; }
    drops(x, y - 60, I.nOf(22, O), -PI / 2, 0.8, 2, 6.5, s.water.css, I.FRONT, I.RI(34, 50));
    if (A.ringGC) I.anim1(A.ringGC['deepseek' + O.pal][1], x, y, 1, I.BACK, 1);
  }, { desc: 'Tall water column (~30x170) bursting from the floor with a plume, banded turbulence, rain falling back, crown + foam + floor ring, ~40f.', use: 'At the exit point (floor) on the first frame of diveOut (deepseek.poolOut is an alias). Column in the back layer, splash in front.' });
  I.def('deepseek.poolOut', function (x, y, O) { I.effects['deepseek.geyser'].fn(x, y, O); }, { desc: 'Alias of deepseek.geyser (v2).', use: 'Same as deepseek.geyser.' });

  I.def('deepseek.chainHit', function (x, y, O) {
    var s = I.scheme('deepseek', O.pal), D = SD[O.pal], idx = O.index | 0;
    I.anim1(D.burst, x, y, O.facing, lay(O, I.FRONT), 1);
    var up = idx === 2 ? -PI / 2 + O.facing * 0.35 : (O.facing > 0 ? -0.25 : PI + 0.25);
    drops(x, y, I.nOf(idx === 2 ? 16 : 9, O), up, 0.6, 2.4, idx === 2 ? 6.5 : 5, s.water.css, I.FRONT);
    for (var i = 0; i < I.nOf(4 + idx * 2, O); i++) I.spark(x, y, (idx === 2 ? up : (O.facing > 0 ? 0 : PI)) + I.RS() * 0.5, I.RR(4, 7), I.RI(6, 10), s.water.css, I.FRONT, { max: 12, len: 2 });
    if (A.ringC) I.anim1(A.ringC['deepseek' + O.pal][idx === 2 ? 2 : 1], x, y, 1, I.FRONT, 1);
  }, { desc: 'v2: big radial water burst (~70 px) + directional spray streaks + droplets + ring; index 2 (launcher) sprays upward with a larger ring.', use: 'On each chain1/2/3 hit (index 0/1/2) at the contact point, with hit.medium/heavy.' });

  var dtr = {};
  I.def('deepseek.diveTrail', function (x, y, O) {
    var s = I.scheme('deepseek', O.pal), L = lay(O, I.BACK), key = 'd' + O.pal, last = dtr[key], now = I.tick;
    if (last && now - last.t <= 3 && Math.abs(last.x - x) < 60 && Math.abs(last.y - y) < 70) {
      var r = I.add(I.K_RIBBON, x, y, L); r.a = last.x; r.b = last.y; r.size = 7; r.life = 11; r.ramp = s.water.css; r.vy = 0.2;
    }
    dtr[key] = { x: x, y: y, t: now };
    drops(x, y, 1 + (I.R() < 0.5 ? 1 : 0), O.facing > 0 ? PI * 0.85 : PI * 0.15, 0.4, 1, 2.5, s.water.css, I.FRONT, I.RI(16, 24));
    I.spark(x, y, O.facing > 0 ? PI * 0.8 : PI * 0.2, I.RR(2.5, 4), 7, s.water.css, I.FRONT, { max: 9 });
    if (I.R() < 0.5) I.bubble(x + I.RS() * 6, y + I.RS() * 6, I.RI(1, 2), I.RI(12, 18), s.water.css, I.FRONT);
  }, { desc: 'v2: thick diagonal water ribbon segment (7 px) + spray streak + drops + bubbles (joins consecutive spawns).', use: 'Every frame of diveKick active at anchor `weapon` (the leading feet).' });
})();
