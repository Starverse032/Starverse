/* LATENT CLASH — FX: screen.superBackdrop, the animated stage replacement for supers (owned by FX).
 *  claude   — a dark study: tall shelves, a warm sunburst rotating in from her side, lines of
 *             glowing script scrolling at several depths, huge manuscript pages drifting, motes.
 *  deepseek — the deep sea rushing up: blue-black water bands, swaying light shafts, a faint
 *             whale gliding far away, bubble streams and marine snow racing upward, caustics.
 * Baked once per palette (facing right = she stands on the left; mirrored for facing -1).
 * Runtime = ~25 drawImage + ~250 fillRect per frame. Intro wipe (8f) and outro (phase 'out'). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var W = LC.W || 384, H = LC.H || 216, GY = LC.GROUND_Y || 186, PI = Math.PI, TAU = PI * 2;
  var BW = W + 16, BH = H + 16, FY = GY + 8;          // buffer covers the 8 px bleed; FY = floor row in it
  var CB = [{}, {}], DB = [{}, {}];
  var SUNX = -14, SUNY = 100;                          // sun centre (screen coords, facing right)
  var NRF = 8, RAYP = TAU / 20;                        // ray rotation frames, ray period

  function mixc(a, b, t) { return I.col(I.mix(a, b, t)); }

  // ---------------------------------------------------------------------------------
  // CLAUDE — the study
  var polar = null;
  function bakeClaude(pal) {
    var sc = I.scheme('claude', pal), L = sc.light.css, P = sc.paper.css, K = sc.ink.css, O = sc.outline, C = CB[pal];
    var wall = [mixc(O, '#000000', 0.62), mixc(O, '#000000', 0.42), mixc(O, '#000000', 0.2), I.col(O)];
    var lit = [mixc(O, L[4], 0.3), mixc(O, L[3], 0.42), mixc(L[4], L[3], 0.5), I.col(L[3]), I.col(L[2])];
    var shelf = mixc(O, '#000000', 0.5), shelfHi = mixc(O, L[4], 0.22);
    var spines = [mixc(O, L[4], 0.24), mixc(O, K[0], 0.28), mixc(O, P[3], 0.2), mixc(O, '#6a3050', 0.3), mixc(O, L[3], 0.16)];
    var floor = [mixc(O, '#000000', 0.15), mixc(O, '#000000', 0.45), mixc(O, L[3], 0.55), mixc(O, L[4], 0.35)];
    var base = new I.Buf(BW, BH), d = base.d, x, y, i;
    var cxs = SUNX + 8, cys = SUNY + 8;
    if (!polar) {   // angle / radius per buffer pixel (shared by both palettes)
      polar = { a: new Float32Array(BW * BH), r: new Float32Array(BW * BH) };
      for (y = 0; y < BH; y++) for (x = 0; x < BW; x++) { var dx = x + 0.5 - cxs, dy = y + 0.5 - cys; polar.a[y * BW + x] = Math.atan2(dy, dx); polar.r[y * BW + x] = Math.sqrt(dx * dx + dy * dy); }
    }
    // wall bands (dark at the top, a little warmer toward the floor), dithered seams
    for (y = 0; y < FY; y++) {
      var v = y / FY * 3;
      for (x = 0; x < BW; x++) { var bi = Math.floor(v), fr = v - bi; d[y * BW + x] = wall[Math.min(3, bi + (I.bayer(x, y) < fr ? 1 : 0))]; }
    }
    // shelves: frames, planks, book spines (low contrast)
    var rng = I.bakeRng(4040 + pal);
    for (var sx0 = 30; sx0 < BW; sx0 += 92) {
      base.rect(sx0, 22, 5, FY - 22, shelf); base.rect(sx0 + 84, 22, 5, FY - 22, shelf);
      base.rect(sx0, 18, 89, 4, shelf); base.rect(sx0, 18, 89, 1, shelfHi);
      for (var py = 46; py < FY - 4; py += 30) {
        base.rect(sx0, py, 89, 3, shelf); base.rect(sx0, py, 89, 1, shelfHi);
        for (x = sx0 + 6; x < sx0 + 83;) {
          var bw = 2 + Math.floor(rng() * 3), bh = 16 + Math.floor(rng() * 9);
          if (rng() < 0.08) { x += 3; continue; }
          var bc = spines[Math.floor(rng() * spines.length)];
          if (rng() < 0.12 && x + 6 < sx0 + 83) { for (var lk = 0; lk < 5; lk++) base.rect(x + lk, py - bh + 4 + lk, 3, bh - 4 - lk, bc); x += 8; continue; }   // leaning book
          base.rect(x, py - bh, bw, bh, bc);
          if (bh > 18) base.rect(x, py - bh + 3, bw, 1, shelfHi);
          x += bw + (rng() < 0.3 ? 1 : 0);
        }
      }
    }
    // floor: planks, joints, lit rim
    for (y = FY; y < BH; y++) for (x = 0; x < BW; x++) {
      var pr = Math.floor((y - FY) / 6), joint = ((x + pr * 37) % 61) === 0, seam = (y - FY) % 6 === 5;
      d[y * BW + x] = seam || joint ? floor[1] : floor[0];
    }
    base.rect(0, FY, BW, 1, floor[2]); base.rect(0, FY + 1, BW, 1, floor[3]);
    // frames: rotating sunburst rays + glow composited on the base
    C.base = [];
    for (var f = 0; f < NRF; f++) {
      var b = base.copy(), bd = b.d, rot = f * RAYP / NRF;
      for (i = 0; i < BW * BH; i++) {
        var r = polar.r[i], px = i % BW, pyy = (i / BW) | 0;
        var inten = I.clamp(1.25 - r / 270, 0, 1) * (pyy > 70 ? 0.75 : 1), bay = I.bayer(px, pyy);
        if (pyy >= FY) {   // floor reflection of the sun: dithered streaks
          if (pyy > FY + 1 && ((pyy - FY) % 6 < 3) && bay < inten * inten * 0.55) bd[i] = (pyy - FY) % 6 === 1 ? lit[2] : lit[1];
          continue;
        }
        var w = ((polar.a[i] - rot) / RAYP) % 1; if (w < 0) w += 1;
        if (r < 40) bd[i] = r < 26 ? lit[4] : bay < 0.6 ? lit[4] : lit[3];
        else if (r < 78 && bay < (78 - r) / 38 * 0.9) bd[i] = lit[r < 56 ? 3 : 2];
        else if (w < 0.36) {
          var core = Math.abs(w - 0.18) < 0.045;
          if (bay < inten * (core ? 0.6 : 0.3)) bd[i] = core && r < 210 ? lit[2] : r < 140 ? lit[1] : lit[0];
        } else if (bay < inten * 0.12) bd[i] = lit[0];
      }
      C.base.push(I.toCanvas(b));
    }
    // sun flower (12 tapering petals around a core), 6 rotation frames over 30 deg
    var Lu = sc.light.u;
    C.sun = I.anim(100, 100, 6, 50, 50, function (bb, ff) {
      var rot = ff * (TAU / 12) / 6;
      for (var k = 0; k < 12; k++) { var a = rot + k * TAU / 12; bb.ray(50, 50, a, 12, 46, 5.5, 0.3, Lu[1]); }
      bb.outline(Lu[3]);
      for (k = 0; k < 12; k++) { var a2 = rot + k * TAU / 12; bb.ray(50, 50, a2, 14, 36, 2.2, 0.3, Lu[0]); }
      bb.disc(50, 50, 13, Lu[0]); bb.ring(50, 50, 13, 14.5, Lu[1]);
    });
    // script rows: glowing 3x5 glyph text with a 1 px halo; seamless tiles
    var TXT = ['BE HELPFUL * BE HONEST * DO NO HARM * ', 'IN THE BEGINNING WAS THE WORD * ', 'ONCE UPON A TIME IN LATENT SPACE * ', 'THINK STEP BY STEP * ',
      'TO BE OR NOT TO BE * ', 'ONE MILLION TOKENS OF CONTEXT * ', 'SHALL I COMPARE THEE TO A SUMMER DAY * '];
    C.rows = TXT.map(function (tx, ri) {
      var near = ri < 4, wpx = tx.length * 4, n = Math.ceil((W + 16) / wpx) + 1, s = '';
      for (var q = 0; q < n; q++) s += tx;
      var rb = new I.Buf(wpx * n, 9);
      I.text35(rb, s, 0, 2, I.col(near ? L[2] : I.mix(L[4], O, 0.2)));
      rb.outline(near ? mixc(L[4], O, 0.35) : mixc(L[4], O, 0.72));
      return { c: I.toCanvas(rb), w: wpx };
    });
    // manuscript pages: 2 sizes x 5 tilts (RotSprite-lite)
    function pageBuf(pw, ph, dim, seed) {
      var pb = new I.Buf(pw + 4, ph + 4), r2 = I.bakeRng(seed), pc = P.map(function (c) { return mixc(I.mix(c, L[3], 0.3), O, dim); });
      var ink = mixc(L[3], O, dim * 0.4), inkHi = mixc(L[2], O, dim * 0.3), edge = mixc(L[1], O, dim * 0.3);
      pb.poly([2, 2, pw + 2, 2, pw + 2, ph - 8, pw - 8, ph + 2, 2, ph + 2], pc[1]);          // sheet with a folded corner
      pb.poly([pw + 2, ph - 8, pw - 8, ph - 8, pw - 8, ph + 2], pc[2]);
      pb.rect(2, 2, pw, 1, pc[0]); pb.rect(pw + 1, 3, 1, ph - 11, pc[2]); pb.rect(2, 2, 1, ph, edge);
      var m = Math.round(pw * 0.12);
      pb.rect(2 + m, 2 + m, 7, 8, ink); pb.rect(3 + m, 3 + m, 5, 6, inkHi);          // drop cap
      for (var ly = 2 + m; ly < ph - m; ly += 5) {
        for (var lx = 2 + m + (ly < 2 + m + 10 ? 9 : 0); lx < pw - m;) {
          var ww = 2 + Math.floor(r2() * 6);
          if (lx + ww > pw - m) ww = pw - m - lx;
          if (ww > 0) pb.rect(lx, ly, ww, 2, r2() < 0.18 ? inkHi : ink);
          lx += ww + 2;
        }
      }
      pb.outline(mixc(O, '#000000', 0.3));
      return pb;
    }
    C.pages = [[74, 94, 0.55, 11], [50, 64, 0.38, 12]].map(function (pp) {
      var src = pageBuf(pp[0], pp[1], pp[2], pp[3] + pal * 5), up = src.scale2x().scale2x();
      var tilts = [];
      for (var k = 0; k < 5; k++) { var rr = I.rotate(src, (k - 2) * 0.085, src.w / 2, src.h / 2, up); tilts.push({ c: I.toCanvas(rr.buf), px: rr.px, py: rr.py }); }
      return tilts;
    });
    // small far pages: dim flutter (8f)
    var pd = P.map(function (c) { return mixc(c, O, 0.5); });
    C.mini = I.anim(14, 16, 8, 7, 8, function (bb, ff) {
      var widths = [9, 8, 5, 1, 5, 8, 9, 8], ww = widths[ff], back = ff >= 3 && ff <= 5, x0 = Math.round(7 - ww / 2);
      for (var yy = 2; yy < 14; yy++) bb.rect(x0 + (yy < 5 && ff < 3 ? 1 : 0), yy, ww, 1, back ? pd[2] : pd[0]);
      if (!back && ww > 4) for (var ln = 0; ln < 4; ln++) bb.rect(x0 + 1, 4 + ln * 2, ww - 3, 1, mixc(L[3], O, 0.3));
    });
    C.cols = { mote: [L[1], L[2], L[3], L[0]], edge: [L[0], L[1], L[2]] };
  }

  function drawClaude(ctx, sx, sy, t, o) {
    var C = CB[o.pal];
    ctx.drawImage(C.base[Math.floor(t / 3) % NRF], sx - 8, sy - 8);
    I.drawAnim(ctx, C.sun, Math.floor(t / 4) % 6, sx + SUNX, sy + SUNY, 1);
    var i, x, y;
    // far mini pages (slow)
    for (i = 0; i < 9; i++) {
      var h1 = I.hash(i * 31 + 7), h2 = I.hash(i * 17 + 3);
      x = ((h1 * 900 + t * (0.25 + h2 * 0.3)) % (W + 40)) - 20; y = ((h2 * 500 - t * (0.15 + h1 * 0.2)) % (H - 40) + (H - 40)) % (H - 40) + 10;
      I.drawAnim(ctx, C.mini, Math.floor(t * (0.12 + h2 * 0.1) + i * 3) % 8, sx + Math.round(x), sy + Math.round(y), 1);
    }
    // script rows (parallax: upper rows faster, lane rows slow and dim)
    var ROWY = [24, 40, 58, 76, 108, 136, 162], ROWV = [1.3, 1.0, 0.8, 1.6, 0.5, 0.7, 0.4];
    for (i = 0; i < 7; i++) {
      var R = C.rows[i], off = Math.floor(t * ROWV[i] + i * 97) % R.w;
      ctx.drawImage(R.c, R.w - off, 0, W + 16, 9, sx - 8, sy + ROWY[i] - 4, W + 16, 9);
    }
    // huge drifting pages: 2 big (far), 3 medium
    for (i = 0; i < 5; i++) {
      var big = i < 2, set = C.pages[big ? 0 : 1], q1 = I.hash(i * 13 + 1), q2 = I.hash(i * 29 + 5);
      var vx = big ? 0.32 : 0.62, vy = big ? 0.14 : 0.3, span = W + 220;
      x = ((q1 * span + i * 230 + t * vx) % span) - 110; y = (((q2 * 300 + i * 90 - t * vy) % (H + 120)) + (H + 120)) % (H + 120) - 70;
      var tilt = set[Math.max(0, Math.min(4, Math.round(2 + 2.2 * Math.sin(t * 0.03 + i * 1.7))))];
      ctx.drawImage(tilt.c, sx + Math.round(x) - tilt.px, sy + Math.round(y) - tilt.py);
    }
    // motes rising through the light
    for (i = 0; i < 36; i++) {
      var m1 = I.hash(i * 7 + 99), m2 = I.hash(i * 3 + 41), life = 90 + Math.floor(m2 * 80), age = (t + Math.floor(m1 * life)) % life;
      x = (m1 * (W + 20) + Math.sin(age * 0.07 + i) * 6 + age * 0.3) % (W + 20) - 10; y = FY - 8 - age * (0.6 + m1 * 0.9) - m2 * 40;
      if (y < -4) continue;
      ctx.fillStyle = C.cols.mote[(i + (age >> 3)) & 3];
      ctx.fillRect(sx + Math.round(x), sy + Math.round(y), i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
  }

  // ---------------------------------------------------------------------------------
  // DEEPSEEK — the deep sea rushing up
  function bakeDeep(pal) {
    var sc = I.scheme('deepseek', pal), B = sc.blue.css, Wt = sc.water.css, Gl = sc.glow.css, O = sc.outline, D = DB[pal];
    var deep = sc.deep;
    var band = [mixc(B[1], B[2], 0.35), mixc(B[2], B[3], 0.2), mixc(B[2], B[3], 0.6), I.col(B[3]), mixc(B[3], '#000000', 0.35), mixc(B[3], '#000000', 0.55)];
    var base = new I.Buf(BW, BH), d = base.d, x, y;
    for (y = 0; y < FY; y++) {
      var v = Math.pow(y / FY, 0.85) * 5;
      for (x = 0; x < BW; x++) { var bi = Math.floor(v), fr = v - bi; d[y * BW + x] = band[Math.min(5, bi + (I.bayer(x, y) < fr ? 1 : 0))]; }
    }
    // surface shimmer at the very top
    var shim = mixc(Wt[3], B[1], 0.4), shim2 = mixc(Wt[2], B[1], 0.3);
    for (y = 0; y < 14; y++) for (x = 0; x < BW; x++) {
      var s = Math.sin(x * 0.11 + Math.sin(y * 0.7 + x * 0.03) * 2) + Math.sin(x * 0.047 - y * 0.3);
      if (s > 1.1 - y * 0.05 && I.bayer(x, y) < 0.8 - y * 0.05) d[y * BW + x] = y < 5 && s > 1.5 ? shim2 : shim;
    }
    // seabed: far ridge, near rocks, floor sand
    var ridgeF = mixc(B[3], B[2], 0.3), ridgeN = mixc(B[3], '#000000', 0.25), rim = mixc(B[2], Wt[3], 0.35);
    for (x = 0; x < BW; x++) {
      var hf = 150 + Math.sin(x * 0.021) * 10 + Math.sin(x * 0.057 + 1) * 6 + Math.sin(x * 0.13) * 2;
      var hn = 170 + Math.sin(x * 0.033 + 2) * 9 + Math.sin(x * 0.09) * 4 + (Math.sin(x * 0.011) > 0.6 ? -14 * (Math.sin(x * 0.011) - 0.6) / 0.4 : 0);
      for (y = Math.round(hf); y < FY; y++) d[y * BW + x] = y === Math.round(hf) ? rim : ridgeF;
      for (y = Math.round(hn); y < FY; y++) d[y * BW + x] = ridgeN;
    }
    // kelp silhouettes on the near ridge
    var rng = I.bakeRng(777 + pal);
    for (var kx = 12; kx < BW; kx += 26 + Math.floor(rng() * 40)) {
      var kh = 18 + rng() * 30, ph = rng() * 6;
      for (var ky = 0; ky < kh; ky++) base.rect(kx + Math.round(Math.sin(ky * 0.18 + ph) * 3), FY - 1 - ky, ky < kh - 4 ? 2 : 1, 1, ridgeN);
    }
    var sand = [mixc(B[3], '#000000', 0.1), mixc(B[3], '#000000', 0.4), mixc(B[2], Wt[3], 0.45), mixc(B[2], Wt[3], 0.2)];
    for (y = FY; y < BH; y++) for (x = 0; x < BW; x++) d[y * BW + x] = I.bayer(x, y) < (y - FY) / (BH - FY) * 0.8 ? sand[1] : sand[0];
    base.rect(0, FY, BW, 1, sand[2]); base.rect(0, FY + 1, BW, 1, sand[3]);
    D.base = I.toCanvas(base);
    // caustics on the floor: 4 frames
    var cau = mixc(Wt[3], B[2], 0.25), cau2 = mixc(Wt[2], B[2], 0.3);
    D.caustic = [];
    for (var f = 0; f < 4; f++) {
      var cb = new I.Buf(BW, BH - FY - 2);
      for (y = 0; y < cb.h; y++) for (x = 0; x < BW; x++) {
        var ph2 = f * PI / 2, yy = y * 2.2;
        var c1 = Math.abs(Math.sin(x * 0.09 + Math.sin(yy * 0.08 + ph2) * 1.6 + ph2 * 0.5)), c2 = Math.abs(Math.sin(yy * 0.1 - x * 0.03 + Math.sin(x * 0.05 - ph2) * 1.4));
        if (Math.min(c1, c2) < 0.12 && I.bayer(x, y) < 0.9 - y * 0.03) cb.set(x, y, c1 < 0.05 && y < 10 ? cau2 : cau);
      }
      D.caustic.push(I.toCanvas(cb));
    }
    // light shafts: 5 baked wedges, dithered fade downward
    D.shafts = [[60, 46, 12, 200], [150, 34, 10, 175], [228, 54, 14, 210], [310, 30, 8, 160], [372, 42, 12, 190]].map(function (sp, si) {
      var w0 = sp[1], w1 = sp[2], len = sp[3], slope = 0.28, bw2 = Math.ceil(w0 + len * slope + 4), sb = new I.Buf(bw2, len);
      var c0 = mixc(Gl[1], B[1], 0.55), c1 = mixc(Gl[2], B[2], 0.5), c2 = mixc(Wt[3], B[2], 0.4);
      for (y = 0; y < len; y++) {
        var u = y / len, wd = w0 + (w1 - w0) * u, xc = 2 + w0 / 2 + y * slope, inten = Math.pow(1 - u, 1.3);
        for (x = Math.round(xc - wd / 2); x < Math.round(xc + wd / 2); x++) {
          var e = Math.abs(x + 0.5 - xc) / (wd / 2), bay = I.bayer(x + si, y);
          if (bay < inten * (0.55 - e * 0.35)) sb.set(x, y, e < 0.3 && u < 0.4 ? c0 : e < 0.6 ? c1 : c2);
        }
      }
      return { c: I.toCanvas(sb), x: sp[0] - 2 - w0 / 2 };
    });
    // distant whale silhouette (~210 px): 4 tail-beat frames, faint rim + glow line + eye
    var sil = mixc(B[3], '#000000', 0.35), silRim = mixc(B[2], Gl[3], 0.18), silHi = mixc(B[3], Gl[2], 0.35), eye = mixc(Gl[1], B[2], 0.2);
    D.far = I.anim(224, 84, 4, 112, 42, function (bb, ff) {
      var beat = [0, 4, 0, -4][ff], yc0 = 40;
      for (var xx = 26; xx < 218; xx++) {
        var u = (xx - 26) / 192, hh = u < 0.6 ? 4 + 20 * Math.pow(u / 0.6, 0.7) : 24 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.6) / 0.41, 2)));
        var yc = yc0 + beat * (1 - u) * (1 - u);
        bb.rect(xx, Math.round(yc - hh), 1, Math.round(hh * 1.75), sil);
      }
      var ty = yc0 + beat;
      bb.poly([30, ty - 3, 6, ty - 21 - beat, 0, ty - 20 - beat, 10, ty, 0, ty + 17 - beat, 6, ty + 18 - beat, 30, ty + 4], sil);
      bb.poly([124, 58, 104, 76, 114, 76, 136, 60], sil);
      bb.outline(silRim);
      for (xx = 50; xx < 196; xx++) { var u2 = (xx - 26) / 192, h2 = u2 < 0.6 ? 4 + 20 * Math.pow(u2 / 0.6, 0.7) : 24 * Math.sqrt(Math.max(0, 1 - Math.pow((u2 - 0.6) / 0.41, 2))); if ((xx >> 1) % 3) bb.set(xx, Math.round(yc0 - h2 + 6 + beat * (1 - u2) * (1 - u2)), silHi); }
      bb.rect(198, yc0 + 2, 2, 2, eye);
    });
    D.cols = { snow: [I.mix(Wt[3], B[2], 0.45), Wt[3], Wt[2]], bub: [Wt[1], Wt[2], Wt[3], Wt[0]], streak: [I.mix(Wt[3], B[2], 0.3), Wt[3]] };
  }

  function drawDeep(ctx, sx, sy, t, o) {
    var D = DB[o.pal], i, x, y;
    ctx.drawImage(D.base, sx - 8, sy - 8);
    // far whale glides away from her, very slowly
    var span = W + 300, wx = ((t * 0.5 + 170) % span) - 150;
    I.drawAnim(ctx, D.far, Math.floor(t / 10) % 4, sx + Math.round(wx), sy + 64 + Math.round(Math.sin(t * 0.02) * 4), 1);
    // shafts sway
    for (i = 0; i < D.shafts.length; i++) {
      var S = D.shafts[i];
      ctx.drawImage(S.c, sx + Math.round(S.x + Math.sin(t * 0.025 + i * 1.3) * 7), sy - 8);
    }
    ctx.drawImage(D.caustic[Math.floor(t / 5) & 3], sx - 8, sy + GY + 2);
    // marine snow: three depths racing upward (the camera sinks)
    var C3 = D.cols.snow;
    for (i = 0; i < 90; i++) {
      var depth = i % 3, h1 = I.hash(i * 11 + 5), h2 = I.hash(i * 23 + 9), sp = [1.2, 2.4, 4.2][depth];
      x = (h1 * (W + 16)) - 8 + Math.sin(t * 0.04 + i) * (depth + 1);
      y = ((h2 * (H + 30) - t * sp) % (H + 30) + (H + 30)) % (H + 30) - 15;
      ctx.fillStyle = C3[depth];
      ctx.fillRect(sx + Math.round(x), sy + Math.round(y), 1, depth === 2 ? 3 : depth);
    }
    // vertical rush streaks near the screen edges
    ctx.fillStyle = D.cols.streak[0];
    for (i = 0; i < 12; i++) {
      var e1 = I.hash(i * 41 + 2), ln = 18 + Math.floor(e1 * 30), ex = i < 6 ? Math.floor(e1 * 70) : W - 1 - Math.floor(e1 * 70);
      var ey = ((I.hash(i * 7) * (H + 60) - t * (7 + e1 * 5)) % (H + 60) + (H + 60)) % (H + 60) - 40;
      ctx.fillRect(sx + ex, sy + Math.round(ey), 1, ln);
    }
    // bubble streams from 5 vents (+ loose bubbles)
    var B4 = D.cols.bub, VENT = [30, 104, 196, 270, 352];
    for (i = 0; i < 70; i++) {
      var v = VENT[i % 5], b1 = I.hash(i * 13 + 1), b2 = I.hash(i * 5 + 77), life = 60 + Math.floor(b2 * 40);
      var age = (t * (i % 2 ? 1 : 1.4) + Math.floor(b1 * life)) % life, rs = age * (2.6 + b1 * 1.6);
      y = GY - 2 - rs; if (y < -6) continue;
      x = v + (b2 - 0.5) * 14 + Math.sin(age * 0.25 + i) * (2 + rs * 0.02);
      var size = b1 < 0.25 ? 2 : b1 < 0.7 ? 1 : 0, X = sx + Math.round(x), Y = sy + Math.round(y);
      ctx.fillStyle = B4[size === 2 ? 1 : 2];
      if (size === 2) { ctx.fillRect(X - 1, Y - 2, 3, 1); ctx.fillRect(X - 1, Y + 2, 3, 1); ctx.fillRect(X - 2, Y - 1, 1, 3); ctx.fillRect(X + 2, Y - 1, 1, 3); ctx.fillStyle = B4[3]; ctx.fillRect(X - 1, Y - 1, 1, 1); }
      else if (size === 1) { ctx.fillRect(X - 1, Y, 1, 1); ctx.fillRect(X + 1, Y, 1, 1); ctx.fillRect(X, Y - 1, 1, 1); ctx.fillRect(X, Y + 1, 1, 1); }
      else { ctx.fillStyle = B4[0]; ctx.fillRect(X, Y, 1, 1); }
    }
    // big near bubbles hugging the screen edges (fast)
    for (i = 0; i < 10; i++) {
      var n1 = I.hash(i * 19 + 4), lf = 50 + Math.floor(n1 * 30), ag = (t + Math.floor(I.hash(i * 3 + 8) * lf)) % lf;
      var bx = (i & 1 ? W - 14 - n1 * 40 : 10 + n1 * 40) + Math.sin(ag * 0.2 + i) * 3, by = GY + 10 - ag * (4.5 + n1 * 2);
      if (by < -10) continue;
      var R = 3 + (i % 3), X2 = sx + Math.round(bx), Y2 = sy + Math.round(by);
      ctx.fillStyle = B4[1];
      ctx.fillRect(X2 - R + 1, Y2 - R, R * 2 - 1, 1); ctx.fillRect(X2 - R + 1, Y2 + R, R * 2 - 1, 1);
      ctx.fillRect(X2 - R, Y2 - R + 1, 1, R * 2 - 1); ctx.fillRect(X2 + R, Y2 - R + 1, 1, R * 2 - 1);
      ctx.fillStyle = B4[3]; ctx.fillRect(X2 - R + 2, Y2 - R + 2, 2, 1); ctx.fillRect(X2 - R + 2, Y2 - R + 3, 1, 1);
    }
  }

  I.onInit('backdrop', function () { [0, 1].forEach(function (p) { bakeClaude(p); bakeDeep(p); }); });

  I.defSprite('screen.superBackdrop', {
    desc: 'Animated full-screen backdrop that REPLACES THE STAGE during a super. claude: dark study, sunburst rotating in from her side, glowing script rows scrolling, huge manuscript pages drifting, motes. deepseek: deep sea rushing up — water bands, swaying light shafts, a distant whale, marine snow + bubble streams racing upward, caustics on the floor. 8f intro wipe (claude: page wipe from her side; deepseek: water rising); phase "out" = 8f outro.',
    use: 'Instead of stage.drawBack from the end of the super flash until the super ends: drawSprite(ctx,"screen.superBackdrop",0,0,t,{char, palette, facing}) — facing = the attacker\'s facing (the light/whale come from her side). During t < 8 (intro) and phase:"out" (t = frames since the end, 8f) it only covers part of the screen: draw stage.drawBack first on those frames.',
    info: { duration: 0, bbox: { x: 0, y: 0, w: W, h: H }, intro: 8, outro: 8 },
    draw: function (ctx, sx, sy, t, o) {
      var deep = o.char === 'deepseek', out = o.phase === 'out';
      if (out && t >= 8) return;
      var k = out ? 1 - (t + 1) / 9 : Math.min(1, (t + 1) / 8), tt = out ? 200 + t : t;
      I.mirrored(ctx, sx + W / 2, o.facing, function () {
        var clip = k < 1;
        if (clip) {
          ctx.save(); ctx.beginPath();
          if (deep) { var yr = Math.round(H + 8 - k * (H + 16)); ctx.rect(sx - 8, sy + yr, W + 16, H + 16); }
          else { var xr = Math.round(-8 + k * (W + 16)); ctx.rect(sx - 8, sy - 8, xr + 8, H + 16); }
          ctx.clip();
        }
        if (deep) drawDeep(ctx, sx, sy, tt, o); else drawClaude(ctx, sx, sy, tt, o);
        if (clip) {
          ctx.restore();
          if (deep) {
            var Wt = I.scheme('deepseek', o.pal).water.css, yy = sy + Math.round(H + 8 - k * (H + 16));
            for (var x = -8; x < W + 8; x += 2) { var wv = Math.round(Math.sin(x * 0.12 + t) * 2); ctx.fillStyle = (x & 4) ? Wt[0] : Wt[1]; ctx.fillRect(sx + x, yy + wv - 1, 2, 2); }
          } else {
            var Lc = I.scheme('claude', o.pal).light.css, xx = sx + Math.round(-8 + k * (W + 16));
            ctx.fillStyle = Lc[0]; ctx.fillRect(xx - 2, sy - 8, 2, H + 16);
            ctx.fillStyle = Lc[1]; ctx.fillRect(xx, sy - 8, 2, H + 16);
            ctx.fillStyle = Lc[3]; ctx.fillRect(xx + 2, sy - 8, 1, H + 16);
          }
        }
      });
    }
  });
})();
