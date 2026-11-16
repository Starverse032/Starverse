/* LATENT CLASH — FX: Gemini 娘 special-move spawn effects (owned by FX).
 *  gemini.riseTrail   (every frame) two intertwined star strands spiralling up behind the rising claw;
 *                     the strand passing behind her goes to the back layer (a real helix)
 *  gemini.twinSpawn   sparkles converge onto her silhouette (cat ears, big hair, wide sleeves, tail),
 *                     which flashes as light and fades as the twin puppet appears; floor ring
 *  gemini.twinVanish  the twin's light silhouette flashes and bursts into stardust and small stars
 *  gemini.blinkOut    she collapses into a vertical lens of light -> a point star -> ring + sparkles
 *  gemini.blinkIn     a point star unfolds into the lens (fading as she appears); ring + a few stars
 * Silhouette: one designed mask (64 x 112, origin = feet centre (32,108), facing right), baked per palette. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var G = I.GEM = I.GEM || [{}, {}];
  var A = I.A = I.A || {};
  var SW = 64, SH = 112, SOX = 32, SOY = 108;
  function lay(O, d) { return O.layer == null ? d : O.layer; }
  function ease(u) { u = u < 0 ? 0 : u > 1 ? 1 : u; return 1 - (1 - u) * (1 - u) * (1 - u); }

  /** Her silhouette mask (1 colour), facing right (tail behind = left). */
  function silMask(c) {
    var b = new I.Buf(SW, SH);
    b.ellipse(31, 50, 15, 30, c);                                        // hair mass
    b.poly([17, 52, 46, 52, 44, 80, 40, 98, 34, 92, 30, 99, 25, 92, 20, 97, 18, 78], c);   // long wavy hair ends
    b.disc(32, 22, 10, c);                                                // head
    b.poly([23, 16, 21, 3, 30, 12], c); b.poly([34, 12, 43, 3, 41, 16], c);  // cat ears
    b.disc(42, 17, 3.5, c);                                               // side bun
    b.poly([22, 33, 42, 33, 38, 58, 26, 58], c);                          // torso
    b.poly([22, 33, 12, 60, 23, 62, 25, 40], c); b.poly([42, 33, 52, 60, 41, 62, 39, 40], c);   // wide sleeves
    b.poly([25, 56, 39, 56, 45, 72, 19, 72], c);                          // skirt
    b.poly([19, 62, 23, 62, 22, 96, 17, 94], c); b.poly([41, 62, 45, 62, 47, 94, 42, 96], c);   // coat-tail panels
    b.poly([26, 71, 31, 71, 30, 100, 27, 100], c); b.poly([33, 71, 38, 71, 37, 100, 34, 100], c); // legs
    b.rect(23, 98, 9, 10, c); b.rect(33, 98, 9, 10, c);                    // platform shoes
    b.stroke([24, 66, 12, 72, 5, 62, 7, 50, 13, 46], function (u) { return 2.6 + Math.sin(u * PI) * 1.4; }, c);   // tail
    return b;
  }

  function bake() {
    [0, 1].forEach(function (pal) {
      var g = G[pal], Au = g.Au, W0 = I.col('#ffffff'), dk = g.dkU, Su = g.Su;
      var m = silMask(W0), pts = [], edge = [];
      for (var y = 0; y < SH; y++) for (var x = 0; x < SW; x++) if (m.d[y * SW + x]) {
        pts.push(x - SOX, y - SOY);
        if (!m.get(x - 1, y) || !m.get(x + 1, y) || !m.get(x, y - 1) || !m.get(x, y + 1)) edge.push(x - SOX, y - SOY);
      }
      g.silPts = pts; g.silEdge = edge;
      // light silhouette: 0 dotted outline, 1-2 white fill, 3-11 fill fades (accent, dithered) while the rim stays
      g.sil = I.anim(SW + 4, SH + 4, 12, SOX + 2, SOY + 2, function (b, f) {
        var o = new I.Buf(SW + 4, SH + 4), k;
        for (var y = 0; y < SH; y++) for (var x = 0; x < SW; x++) {
          if (!m.d[y * SW + x]) continue;
          var isE = !m.get(x - 1, y) || !m.get(x + 1, y) || !m.get(x, y - 1) || !m.get(x, y + 1);
          if (f === 0) { if (isE && ((x + y) & 1)) o.set(x + 2, y + 2, Au[1]); continue; }
          if (isE) { o.set(x + 2, y + 2, f < 6 ? Au[0] : f < 9 ? Au[1] : Au[2]); continue; }
          if (f < 3) { o.set(x + 2, y + 2, f === 1 ? W0 : Au[0]); continue; }
          k = 1 - (f - 3) / 8;
          if (I.bayer(x, y) < k * 0.8) o.set(x + 2, y + 2, y > 100 - (f - 3) * 12 ? Au[1] : (x + y + f) % 7 === 0 ? Su[1] : Au[0]);
        }
        if (f > 8) o.breakup(1 - (f - 8) * 0.28, f, 0);
        b.blit(o, 0, 0);
      });
      // blink lens: 80 x 120, origin (40,112); out: 0-4 collapse, 5 point star, 6-11 ring
      var LX = 40, LY = 62;
      function lens(b, rx, ry, cy) {
        b.ellipse(LX, cy, rx + 1.2, ry + 1.2, Au[2]); b.ellipse(LX, cy, rx, ry, Au[0]);
        if (rx > 2) b.ellipse(LX, cy, rx * 0.45, ry * 0.8, W0);
      }
      function ring(b, r, c) { var q = new I.Buf(80, 120); q.ring(LX, LY, r - 1.4, r, c); if (r > 20) q.breakup(Math.max(0.3, 1 - (r - 20) / 24), 0, 0); b.blit(q, 0, 0); }
      g.blinkOut = I.anim(80, 120, 12, 40, 112, function (b, f) {
        if (f < 5) {
          var u = f / 4, rx = 15 * (1 - u) + 1.5, ry = 50 * (1 - u * u) + 3;
          lens(b, rx, ry, LY + (1 - u) * 0);
          if (f > 1) { b.rect(LX - 20 + f * 3, LY, 41 - f * 6, 1, W0); }
        } else if (f === 5) {
          I.gemStar(b, LX + 0.5, LY + 0.5, 11, 0, pal, { rim: true, p: 0.5 });
          b.rect(LX - 24, LY, 49, 1, W0); b.rect(LX, LY - 24, 1, 49, W0);
        } else {
          var k = f - 6; ring(b, 9 + k * 5.5, k < 2 ? W0 : k < 4 ? Au[1] : Au[2]);
          if (k < 4) I.gemMini(b, LX, LY, 4 - k, k, pal, k & 1);
        }
      });
      g.blinkIn = I.anim(80, 120, 12, 40, 112, function (b, f) {
        if (f === 0) { I.gemMini(b, LX, LY, 3, 0, pal, false); return; }
        if (f === 1) { I.gemStar(b, LX + 0.5, LY + 0.5, 9, 0.4, pal, { rim: true, p: 0.5 }); b.rect(LX - 18, LY, 37, 1, W0); b.rect(LX, LY - 18, 1, 37, W0); ring(b, 7, W0); return; }
        var k = f - 2, u = Math.min(1, k / 4), rx = 2 + 13 * ease(u), ry = 6 + 46 * ease(u);
        ring(b, 12 + k * 5, k < 2 ? W0 : k < 5 ? Au[1] : Au[2]);
        var q = new I.Buf(80, 120); lens(q, rx, ry, LY);
        if (k > 3) q.breakup(1 - (k - 3) * 0.17, k, 0);
        b.blit(q, 0, 0);
      });
    });
  }
  I.onInit('gemini-specials', bake);

  // ---- K_GCONV: a sparkle flying from (a,b) to the target (d,e) with ease-out; p.c = mini size --------
  I.K_GCONV = I.kind('gemConv', {
    draw: function (ctx, p, sx, sy) { I.gemPS(ctx, p.f0, p.c, p.age + p.seq, sx, sy); },
    step: function (p) { var u = ease(p.age / p.life); p.x = p.a + (p.d - p.a) * u; p.y = p.b + (p.e - p.b) * u; }
  });
  function conv(pal, x0, y0, x1, y1, life, size, layer, delay) {
    var p = I.add(I.K_GCONV, x0, y0, layer);
    p.a = x0; p.b = y0; p.d = x1; p.e = y1; p.life = life; p.c = size; p.f0 = pal; p.delay = delay | 0;
    return p;
  }
  function silPt(g, edgeOnly) { var L = edgeOnly ? g.silEdge : g.silPts, i = I.RI(0, (L.length >> 1) - 1); return [L[i * 2], L[i * 2 + 1]]; }

  I.def('gemini.riseTrail', function (x, y, O) {
    var g = G[O.pal], f = O.facing, ph = I.tick * 0.55;
    for (var s = 0; s < 2; s++) {
      var a = ph + s * PI, ox = Math.round(Math.sin(a) * 9) * f, front = Math.cos(a) > 0, L = O.layer != null ? O.layer : front ? I.FRONT : I.BACK;
      var d = I.add(I.K_DOT, x + ox, y, L);
      d.size = front ? 2 : 1; d.life = 14; d.vy = 0.35; d.ramp = s ? [g.S[2], g.A[1], g.A[2], g.dk] : [g.S[1], g.S[1], g.A[1], g.A[2]]; d.e = 1;
      if ((I.tick + s) % 3 === 0) { var p = I.gemStarP(O.pal, x + ox, y, front ? 1 : 0, 0, 0.25, 16, L); p.vrot *= 0.5; }
    }
    if ((I.tick & 3) === 0) I.gemTwinkle(O.pal, x + I.RS() * 12, y + I.RR(2, 10), 2, 10, I.FRONT);
  }, { desc: 'Per call: one dot on each of two strands (cyan / pink) at +-9 px around the point, helix phase from the FX tick (the strand passing behind goes to the back layer); a small spinning star on each strand every 3rd call; twinkles. Dots drift down and shrink over 14f, so calls every frame draw two intertwined star trails spiralling up.', use: 'Every frame of starRise "rise" at weapon (claw tip), facing = hers. opts.layer forces one layer.' });

  I.def('gemini.twinSpawn', function (x, y, O) {
    var g = G[O.pal], f = O.facing, L = lay(O, I.FRONT), n = I.nOf(26, O);
    for (var i = 0; i < n; i++) {
      var tp = silPt(g, i & 1), a = I.R() * TAU, r = I.RR(30, 62);
      conv(O.pal, x + f * tp[0] + Math.cos(a) * r, y + tp[1] + Math.sin(a) * r * 0.8, x + f * tp[0], y + tp[1], I.RI(9, 13), i % 5 === 0 ? 1 : 0, L, I.RI(0, 3));
    }
    I.anim1(g.sil, x, y, f, L, 1, 11);
    if (A.ringGC && A.ringGC['gemini' + O.pal]) I.anim1(A.ringGC['gemini' + O.pal][0], x, y, 1, I.BACK, 1, 12);
    for (i = 0; i < I.nOf(6, O); i++) { var q = silPt(g, true); I.gemTwinkle(O.pal, x + f * q[0], y + q[1], I.RI(2, 3), I.RI(10, 14), L, I.RI(12, 22)); }
  }, { desc: 'Twin appears: ~26 iridescent sparkles fly in from around her and land on points of her silhouette (t 0-15), the silhouette lights up (t 11: dotted outline, then a white flash, then the light fades from the feet up with dither while the rim stays, 12f), floor ring, twinkles on the rim; ~30f.', use: 'At the twin\'s ORIGIN (feet) on the frame the twin entity is created, facing = the twin\'s. Start drawing the twin puppet at ~t 12 (fade its alpha in over t 12-20) so the light silhouette dissolves into it.' });

  I.def('gemini.twinVanish', function (x, y, O) {
    var g = G[O.pal], f = O.facing, L = lay(O, I.FRONT), n = I.nOf(30, O);
    I.anim1(g.sil, x, y, f, L, 1, 0).f0 = 1;
    for (var i = 0; i < n; i++) {
      var tp = silPt(g, false), px = x + f * tp[0], py = y + tp[1], a = Math.atan2(tp[1] + 50, tp[0] * f) + I.RS() * 0.6, v = I.RR(0.6, 2.4);
      if (i % 3 === 0) { var p = I.gemStarP(O.pal, px, py, i % 6 === 0 ? 1 : 0, Math.cos(a) * v, Math.sin(a) * v - 0.6, I.RI(20, 34), L, I.RI(1, 4)); p.drag = 0.94; p.e = I.R() * TAU; }
      else { var d = I.add(I.K_DOT, px, py, L); d.vx = Math.cos(a) * v * 0.8; d.vy = Math.sin(a) * v * 0.8 - 0.8; d.drag = 0.93; d.life = I.RI(18, 30); d.size = I.RI(1, 2); d.ramp = g.dust; d.e = 1; d.delay = I.RI(1, 4); }
    }
    for (i = 0; i < I.nOf(4, O); i++) I.gemTwinkle(O.pal, x + I.RS() * 20, y - I.RR(20, 90), 3, 12, L, I.RI(2, 10));
  }, { desc: 'Twin bursts into stardust: its light silhouette flashes white and fades (11f) while ~30 dust motes and small spinning stars burst outward from points of the silhouette and drift up; twinkles; ~34f.', use: 'At the twin\'s ORIGIN on the frame it disappears (after twinStrike, or when Gemini is hit), facing = the twin\'s. Stop drawing the puppet on that frame.' });

  I.def('gemini.blinkOut', function (x, y, O) {
    var g = G[O.pal], L = lay(O, I.FRONT);
    I.anim1(g.blinkOut, x, y, O.facing, L, 1);
    for (var i = 0; i < I.nOf(8, O); i++) {
      var a = i * TAU / 8 + I.RS() * 0.3, v = I.RR(1.8, 3.2);
      I.gemStarP(O.pal, x + Math.cos(a) * 6, y - 50 + Math.sin(a) * 6, i & 1, Math.cos(a) * v, Math.sin(a) * v, I.RI(12, 18), L, 5).drag = 0.88;
    }
    for (i = 0; i < I.nOf(6, O); i++) conv(O.pal, x + I.RS() * 14, y - I.RR(8, 96), x, y - 50, 5, 0, L, I.RI(0, 1));
  }, { desc: 'She collapses into a point of light: a vertical lens of light her size squeezes to a point at chest height (5f), a faceted point star with glints (1f), then a ring expands (6f) and 8 small stars burst out; sparkles get sucked in during the collapse; ~22f.', use: 'At her ORIGIN (feet) on blinkOut startup f0, facing = hers (the point is at y - 50). Hide her sprite from vanish f0.' });

  I.def('gemini.blinkIn', function (x, y, O) {
    var g = G[O.pal], L = lay(O, I.FRONT);
    I.anim1(g.blinkIn, x, y, O.facing, L, 1);
    for (var i = 0; i < I.nOf(5, O); i++) {
      var a = -PI / 2 + I.RS() * 1.6, v = I.RR(1, 2.4);
      I.gemStarP(O.pal, x + I.RS() * 6, y - 50, i & 1, Math.cos(a) * v, Math.sin(a) * v, I.RI(14, 22), L, I.RI(2, 5)).drag = 0.9;
    }
    for (i = 0; i < I.nOf(3, O); i++) I.gemTwinkle(O.pal, x + I.RS() * 16, y - I.RR(10, 90), 2, 12, L, I.RI(4, 10));
  }, { desc: 'The point unfolds: a point star appears at chest height, flashes with glints and a ring, then a lens of light unfolds to her height (4f) and fades with dither (to f 11) while a ring expands; a few small stars and twinkles; ~22f.', use: 'At her ORIGIN (feet) at the arrival point on blinkIn appear f0, facing = hers. Draw her sprite from ~f 3 (fade in over 3f if possible).' });
})();
