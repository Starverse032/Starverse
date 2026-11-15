/* LATENT CLASH — FX: screen.superBackdrop for char 'gpt' (owned by FX).
 * A deep night sky on her side of the world: pale crescent moon with a teal halo (on her side),
 * a faint aurora, stars, a dark glassy floor with a teal perspective grid; huge attention
 * matrices (causal lower-triangular heat maps, cells pulsing in teal as a wave runs down the
 * rows) drifting at three depths; faint winged dragon silhouettes gliding; luminous scales
 * falling. Intro (8f): a staircase "causal mask" of 24 px cells reveals it from her side;
 * phase 'out' reverses it. Other chars fall through to the previous definition (backdrop.js). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var W = LC.W || 384, H = LC.H || 216, GY = LC.GROUND_Y || 186, PI = Math.PI, TAU = PI * 2;
  var BW = W + 16, BH = H + 16, FY = GY + 8;
  var GB = [{}, {}];
  var MOONX = 66, MOONY = 50;
  // attention matrices: n cells of cs px; x0,y0 screen pos at t=0, vx drift, max colour level
  var GRIDS = [
    { n: 14, cs: 10, x0: 176, y0: 14, vx: -0.22, max: 3, id: 1 },
    { n: 9, cs: 8, x0: 24, y0: 92, vx: 0.32, max: 2, id: 2 },
    { n: 6, cs: 6, x0: 300, y0: 44, vx: -0.5, max: 4, id: 3 }
  ];
  function mixc(a, b, t) { return I.col(I.mix(a, b, t)); }

  function bake(pal) {
    var sc = I.scheme('gpt', pal), N = sc.night.css, L = sc.light.css, P = LC.PAL.gpt[pal], S = P.scale, B = GB[pal];
    var base = new I.Buf(BW, BH), d = base.d, x, y;
    var sky = [I.col(N[4]), I.col(N[3]), I.col(N[2]), mixc(N[2], N[1], 0.5), I.col(N[1])];
    for (y = 0; y < FY; y++) {
      var v = Math.pow(y / FY, 1.25) * 4;
      for (x = 0; x < BW; x++) { var bi = Math.floor(v), fr = v - bi; d[y * BW + x] = sky[Math.min(4, bi + (I.bayer(x, y) < fr ? 1 : 0))]; }
    }
    // aurora curtains: dithered vertical streaks hanging from a wavy line
    var au = [mixc(N[1], L[4], 0.35), mixc(N[2], L[4], 0.3)];
    for (x = 0; x < BW; x++) {
      var top = 30 + Math.sin(x * 0.019 + 1) * 12 + Math.sin(x * 0.051) * 5, len = 26 + Math.sin(x * 0.033 + 2) * 14;
      var str = 0.5 + 0.5 * Math.sin(x * 0.11) * Math.sin(x * 0.027 + 0.5);
      for (y = Math.round(top); y < top + len; y++) {
        var u = (y - top) / len;
        if (I.bayer(x, y) < str * (1 - u) * 0.55) d[y * BW + x] = u < 0.25 ? au[0] : au[1];
      }
    }
    // stars
    var rng = I.bakeRng(9090 + pal), starC = [I.col(S[0]), I.col(L[1]), mixc(S[2], N[2], 0.3)];
    for (var i = 0; i < 150; i++) {
      x = Math.floor(rng() * BW); y = Math.floor(Math.pow(rng(), 1.4) * (FY - 30));
      var sc2 = starC[i % 7 === 0 ? 0 : i % 3 === 0 ? 1 : 2];
      base.set(x, y, sc2);
      if (i % 23 === 0) { base.set(x - 1, y, starC[2]); base.set(x + 1, y, starC[2]); base.set(x, y - 1, starC[2]); base.set(x, y + 1, starC[2]); }
    }
    // moon: dithered halo, then a pale crescent (her side)
    var mx = MOONX + 8, my = MOONY + 8, halo = [mixc(N[1], L[3], 0.3), mixc(N[2], L[4], 0.3)];
    for (y = my - 46; y < my + 46; y++) for (x = mx - 46; x < mx + 46; x++) {
      var r = Math.sqrt((x + 0.5 - mx) * (x + 0.5 - mx) + (y + 0.5 - my) * (y + 0.5 - my));
      if (r > 22 && r < 46 && I.bayer(x, y) < (46 - r) / 24 * 0.5) base.set(x, y, r < 32 ? halo[0] : halo[1]);
    }
    var moonC = [I.col('#ffffff'), I.col(S[0]), I.col(S[1]), I.col(S[2]), mixc(S[2], L[3], 0.4)];
    for (y = my - 22; y <= my + 22; y++) for (x = mx - 22; x <= mx + 22; x++) {
      var dx = x + 0.5 - mx, dy = y + 0.5 - my, r1 = Math.sqrt(dx * dx + dy * dy);
      if (r1 > 20.5) continue;
      var ddx = dx - 9, ddy = dy + 5, r2 = Math.sqrt(ddx * ddx + ddy * ddy);
      if (r2 < 18) continue;                      // carved: crescent opening away from her
      var lit = (r2 - 18) / 8 - dx * 0.02;
      base.set(x, y, r1 > 19.4 ? moonC[4] : lit > 0.9 ? moonC[1] : lit > 0.45 ? moonC[2] : moonC[3]);
      if (r1 < 19.4 && lit > 1.4 && dx < -8) base.set(x, y, moonC[0]);
    }
    // horizon mist
    var mist = I.col(N[0]);
    for (y = FY - 26; y < FY; y++) for (x = 0; x < BW; x++) if (I.bayer(x, y) < (y - (FY - 26)) / 26 * 0.35) d[y * BW + x] = mist;
    // floor: dark glass with a teal perspective grid
    var fl = [I.col(N[3]), I.col(N[4]), mixc(N[1], L[4], 0.3), I.col(L[3]), I.col(N[0])];
    for (y = FY; y < BH; y++) for (x = 0; x < BW; x++) d[y * BW + x] = I.bayer(x, y) < (y - FY) / (BH - FY) * 0.7 ? fl[1] : fl[0];
    var vx = BW / 2, vy = FY - 60;
    [2, 5, 9, 14, 20, 27, 35].forEach(function (dy2) { if (FY + dy2 < BH) base.rect(0, FY + dy2, BW, 1, fl[2]); });
    for (var k = -12; k <= 12; k++) {
      var xb = vx + k * 46;
      for (y = FY + 1; y < BH; y++) { var xx = vx + (xb - vx) * (y - vy) / (BH - vy); base.set(Math.round(xx), y, fl[2]); }
    }
    base.rect(0, FY, BW, 1, fl[3]); base.rect(0, FY + 1, BW, 1, fl[4]);
    B.base = I.toCanvas(base);

    // dragon silhouettes: 4 wing-beat frames, near (rim-lit) and far (dimmer)
    function dragon(sil, rim, eye) {
      return I.anim(150, 76, 4, 75, 40, function (b, f) {
        var wy = [1, 0.35, -0.55, 0.35][f], sy = 44;
        var spine = [2, sy + 6, 18, sy + 9, 38, sy + 4, 60, sy, 82, sy - 2, 100, sy - 6, 112, sy - 14, 124, sy - 18];
        b.stroke(spine, function (u) { return u < 0.15 ? 1 : u < 0.62 ? 1 + (u - 0.15) / 0.47 * 5.5 : u < 0.86 ? 6.5 - (u - 0.62) / 0.24 * 3.8 : 3; }, sil);
        b.poly([118, sy - 22, 134, sy - 20, 140, sy - 17, 133, sy - 14, 120, sy - 12], sil);            // head
        b.poly([118, sy - 21, 108, sy - 30, 113, sy - 21], sil);                                          // horn
        b.poly([0, sy + 2, 8, sy + 6, 0, sy + 11, 4, sy + 6], sil);                                       // tail spade
        var s0x = 82, s0y = sy - 3;
        function wing(off, c) {
          var ex = s0x - 8 + off, ey = s0y - 30 * wy, t1 = [s0x - 46 + off, s0y - 34 * wy + 6], t2 = [s0x - 30 + off, s0y - 38 * wy + 14], t3 = [s0x - 14 + off, s0y - 30 * wy + 20];
          b.poly([s0x + off, s0y, ex, ey, t1[0], t1[1], t1[0] + 10, t1[1] + 9 + wy * 2, t2[0], t2[1], t2[0] + 8, t2[1] + 8, t3[0], t3[1], s0x - 18 + off, s0y + 3], c);
        }
        wing(10, sil); wing(0, sil);
        // rim light on upper edges
        var o = b.copy();
        for (var y2 = 1; y2 < b.h; y2++) for (var x2 = 0; x2 < b.w; x2++) if (o.d[y2 * b.w + x2] && !o.d[(y2 - 1) * b.w + x2]) b.d[y2 * b.w + x2] = rim;
        b.set(134, sy - 18, eye); b.set(133, sy - 18, eye);
      });
    }
    B.dragon = [dragon(mixc(N[2], N[1], 0.55), mixc(N[1], L[4], 0.5), I.col(L[2])), dragon(mixc(N[3], N[2], 0.6), mixc(N[2], N[1], 0.5), mixc(L[4], N[2], 0.3))];
    // attention matrices: grid line canvases (cells are drawn at runtime underneath)
    B.grid = GRIDS.map(function (gd) {
      var sz = gd.n * gd.cs + 1, gb = new I.Buf(sz + 8, sz + 8), lc = gd.id === 3 ? mixc(L[4], N[2], 0.2) : mixc(N[1], L[4], 0.4), bc = I.col(gd.id === 2 ? N[0] : L[4]);
      for (var q = 0; q <= gd.n; q++) { gb.rect(4 + q * gd.cs, 4, 1, sz, lc); gb.rect(4, 4 + q * gd.cs, sz, 1, lc); }
      gb.rect(3, 3, sz + 2, 1, bc); gb.rect(3, sz + 4, sz + 2, 1, bc); gb.rect(3, 3, 1, sz + 2, bc); gb.rect(sz + 4, 3, 1, sz + 2, bc);
      for (q = 0; q < gd.n; q++) { gb.rect(4 + q * gd.cs + (gd.cs >> 1) - 1, 0, 2, 2, bc); gb.rect(0, 4 + q * gd.cs + (gd.cs >> 1) - 1, 2, 2, bc); }   // token ticks
      return I.toCanvas(gb);
    });
    B.lv = [I.mix(N[2], N[1], 0.6), I.mix(N[1], L[4], 0.45), L[4], I.mix(L[4], L[3], 0.5), L[3], L[2]];
    B.cols = { dot: [L[4], L[3], N[0]], edge: [L[0], L[1], L[3]] };
  }

  I.onInit('gpt-backdrop', function () { bake(0); bake(1); });

  function weight(gd, i, j) {
    if (j === i) return 1;
    var h = I.hash(i * 31 + j * 7 + gd.id * 977);
    return 0.12 + 0.8 * h * h * h + (j === 0 ? 0.35 : 0);
  }
  function drawGrid(ctx, B, gi, sx, sy, t) {
    var gd = GRIDS[gi], sz = gd.n * gd.cs + 1, span = W + sz + 40;
    var x = Math.round((((gd.x0 + t * gd.vx + sz + 20) % span) + span) % span - sz - 20), y = Math.round(gd.y0 + Math.sin(t * 0.021 + gi * 2) * 3);
    var cs = gd.cs, lv = B.lv, head = (t * 0.22 + gi * 3) % (gd.n + 4);
    for (var i = 0; i < gd.n; i++) {
      var wave = Math.max(0, 1 - Math.abs(i - head) / 2.2);
      for (var j = 0; j <= i; j++) {
        var w = weight(gd, i, j) * (0.55 + 0.45 * Math.sin(t * 0.07 + i * 0.6 - j * 0.4)) + wave * 0.5;
        var l = Math.min(gd.max, Math.floor(w * (gd.max + 0.99)));
        ctx.fillStyle = lv[l];
        ctx.fillRect(sx + x + 5 + j * cs, sy + y + 5 + i * cs, cs - 1, cs - 1);
      }
    }
    ctx.drawImage(B.grid[gi], sx + x, sy + y);
  }

  function drawSky(ctx, sx, sy, t, o) {
    var B = GB[o.pal], i, x, y;
    ctx.drawImage(B.base, sx - 8, sy - 8);
    // twinkling stars (a few bright ones)
    for (i = 0; i < 14; i++) {
      var h1 = I.hash(i * 17 + 5), ph = (t + Math.floor(h1 * 60)) % 60;
      if (ph > 10) continue;
      x = Math.floor(I.hash(i * 3 + 1) * W); y = Math.floor(I.hash(i * 7 + 2) * 120);
      var arm = ph < 5 ? (ph >> 1) : ((10 - ph) >> 1);
      ctx.fillStyle = B.cols.edge[1]; ctx.fillRect(sx + x - arm, sy + y, arm * 2 + 1, 1); ctx.fillRect(sx + x, sy + y - arm, 1, arm * 2 + 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + x, sy + y, 1, 1);
    }
    // far dragon (dim), the big grid, the near dragon, the medium + small grids
    var span = W + 320;
    I.drawAnim(ctx, B.dragon[1], Math.floor(t / 9) % 4, sx + Math.round(((t * 0.45 + 300) % span) - 160), sy + 112 + Math.round(Math.sin(t * 0.03) * 5), 1);
    drawGrid(ctx, B, 0, sx, sy, t);
    I.drawAnim(ctx, B.dragon[0], Math.floor(t / 7) % 4, sx + Math.round(W + 160 - ((t * 0.8 + 120) % span)), sy + 64 + Math.round(Math.sin(t * 0.04 + 1) * 6), -1);
    drawGrid(ctx, B, 1, sx, sy, t);
    drawGrid(ctx, B, 2, sx, sy, t);
    // falling scales: far motes, small and big scales (sway + flutter)
    for (i = 0; i < 30; i++) {
      var q1 = I.hash(i * 13 + 7), q2 = I.hash(i * 29 + 3);
      x = (q1 * (W + 20) + Math.sin(t * 0.03 + i) * 4) - 10; y = ((q2 * (H + 20) + t * (0.35 + q1 * 0.3)) % (H + 20)) - 10;
      ctx.fillStyle = B.cols.dot[i % 3]; ctx.fillRect(sx + Math.round(x), sy + Math.round(y), 1, (i & 3) === 0 ? 2 : 1);
    }
    for (i = 0; i < 22; i++) {
      var big = i < 7, r1 = I.hash(i * 37 + 11), r2 = I.hash(i * 19 + 23), sp = big ? 0.9 + r1 * 0.5 : 0.5 + r1 * 0.35;
      x = (r1 * (W + 30) + Math.sin(t * 0.05 + i * 1.7) * (big ? 10 : 6)) - 15; y = ((r2 * (H + 30) + t * sp) % (H + 30)) - 15;
      I.gptScale(ctx, o.pal, big ? 1 : 0, Math.floor(t / (big ? 4 : 5) + i), sx + Math.round(x), sy + Math.round(y));
    }
  }

  var prev = I.sprites['screen.superBackdrop'];
  var CS = 24, NC = Math.ceil(BW / CS), NR = Math.ceil(BH / CS), MMAX = NC + NR * 0.5;
  I.defSprite('screen.superBackdrop', {
    desc: prev.desc + ' gpt: a night sky — crescent moon with a teal halo on her side, aurora, stars, a glassy floor with a teal perspective grid, huge causal attention matrices (lower-triangular heat maps pulsing as a wave runs down the rows) drifting at three depths, faint winged dragon silhouettes gliding, luminous scales falling; intro = a staircase cell reveal ("causal mask") from her side, out = the reverse.',
    use: prev.use,
    info: prev.info,
    draw: function (ctx, sx, sy, t, o) {
      if (o.char !== 'gpt') { prev.draw(ctx, sx, sy, t, o); return; }
      var out = o.phase === 'out', f = o.facing;
      if (out && t >= 8) return;
      var k = out ? 1 - (t + 1) / 9 : Math.min(1, (t + 1) / 8), tt = out ? 200 + t : t, clip = k < 1, r, n, x0;
      var lim = k * (MMAX + 1);
      if (clip) {
        ctx.save(); ctx.beginPath();
        for (r = 0; r < NR; r++) {
          n = Math.max(0, Math.min(NC, Math.ceil(lim - r * 0.5)));
          if (!n) continue;
          x0 = f > 0 ? sx - 8 : sx - 8 + NC * CS - n * CS;
          ctx.rect(x0, sy - 8 + r * CS, n * CS, CS);
        }
        ctx.clip();
      }
      I.mirrored(ctx, sx + W / 2, f, function () { drawSky(ctx, sx, sy, tt, o); });
      if (!clip) return;
      ctx.restore();
      var E = GB[o.pal].cols.edge;
      for (r = 0; r < NR; r++) {     // frontier cells: bright edge + the newest cell flashing
        n = Math.max(0, Math.min(NC, Math.ceil(lim - r * 0.5)));
        if (!n || n >= NC) continue;
        var cx = f > 0 ? sx - 8 + n * CS : sx - 8 + NC * CS - n * CS, yy = sy - 8 + r * CS;
        ctx.fillStyle = E[2]; ctx.fillRect(f > 0 ? cx - CS : cx, yy, CS, 1);
        ctx.fillStyle = E[1]; ctx.fillRect(cx - (f > 0 ? 2 : 0), yy, 2, CS);
        ctx.fillStyle = E[0]; ctx.fillRect(cx - (f > 0 ? 1 : 0), yy + 1, 1, CS - 2);
      }
    }
  });
})();
