/* LATENT CLASH — FX: V2 hit / block / KO sparks at the new scale (owned by FX).
 * Layered: impact star (white core, inverted impact frame) + expanding ring + flying
 * streak segments + debris chips + short speed lines in the blow direction.
 * hit.heavy ~60 px, hit.special ~64 px (char-tinted compass star + diamond rings),
 * hit.counter ~76 px (jagged red-white + crackle + double ring), block.light/heavy =
 * cool crescent shields (")" facing the attacker) that crack, ko.burst ~110 px.
 * Overrides the v1 definitions from generic.js / generic2.js (same names and opts). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var A = I.A = I.A || {};
  var HB = {};

  /** Layered burst: star -> inverted frame -> streaks + ring -> broken ring + dots. */
  function burst(W, H, n, seed, rays, R, ramp, opt) {
    opt = opt || {};
    var cx = Math.round(W * (opt.cxf || 0.42)), cy = H >> 1, rr = I.makeRays(seed, rays, R, opt.fwd || R * 0.45, 0.55);
    return I.anim(W, H, n, cx, cy, function (b, f) {
      var c = ramp, k;
      if (f === 0) { I.starOf(b, cx, cy, rr, 1, R * 0.2, c[0]); b.disc(cx, cy, R * 0.32, c[0]); b.outline(c[2]); b.outline(c[c.length - 2]); return; }
      if (f === 1) {
        I.starOf(b, cx, cy, rr, 1.1, R * 0.22, c[2]); I.starOf(b, cx, cy, rr, 0.72, R * 0.16, c[1]);
        b.disc(cx, cy, R * 0.34, c[0]); b.disc(cx, cy, R * 0.24, opt.inv || c[c.length - 1]);
        if (opt.diamond) b.star4(cx, cy, R * 0.22, R * 0.22, 1.2, c[1]);
        b.outline(c[c.length - 1]);
        return;
      }
      if (f < 6) {
        k = f - 2;
        I.dashes(b, cx, cy, rr, 0.45 + k * 0.17, 0.9 + k * 0.2, 1.6 - k * 0.25, c[1 + (k >> 1)], 3);
        b.ring(cx, cy, R * (0.36 + k * 0.17), R * (0.36 + k * 0.17) + (k < 2 ? 2.6 : 1.6), k < 1 ? c[0] : c[1 + k]);
        if (opt.diamond) { var d = R * (0.5 + k * 0.22); b.poly([cx + d, cy, cx, cy + d, cx - d, cy, cx, cy - d], c[2]); var d2 = d - 2; b.poly([cx + d2, cy, cx, cy + d2, cx - d2, cy, cx, cy - d2], 0); }
        if (k < 2) b.disc(cx, cy, R * (0.22 - k * 0.08), c[0]);
        if (opt.crackle && k < 3) for (var q = 0; q < 5; q++) {   // red lightning crackle
          var a = rr[q * 2 % rr.length].a + 0.3, x = cx, y = cy, rng = I.bakeRng(seed + q * 9 + f);
          for (var s = 0; s < 5; s++) { var nx = x + Math.cos(a) * R * 0.22, ny = y + Math.sin(a) * R * 0.22; b.line(x, y, nx, ny, s < 2 ? c[0] : c[2]); x = nx; y = ny; a += (rng() - 0.5) * 1.4; }
        }
        if (k < 2) b.outline(c[c.length - 1]);
        if (opt.ring2 && k > 0) b.ring(cx, cy, R * (0.2 + k * 0.28), R * (0.2 + k * 0.28) + 1.2, c[2]);
        return;
      }
      k = f - 6;
      var m = new I.Buf(W, H), rk = R * (1.02 + k * 0.08);
      m.ring(cx, cy, rk, rk + 1.4, c[2 + (k > 3 ? 1 : 0)]); m.breakup(0.72 - k * 0.09, k, 0); b.blit(m, 0, 0);
      I.dots(b, cx, cy, rr, 1.15 + k * 0.1, k < 4 ? 2 : 1, c[3], 2);
    });
  }
  /** Block crescent: ")" shield toward the attacker, cracks into arcs. */
  function shield(W, H, n, R, th, ramp, facets) {
    var cx = 6, cy = H >> 1;
    return I.anim(W, H, n, cx, cy, function (b, f) {
      var c = ramp, a0 = -PI * 0.38, a1 = PI * 0.38;
      if (f === 0) { b.ring(cx - R * 0.55, cy, R, R + th + 2, c[0], a0 - 0.1, a1 + 0.1, 0.62, 1); b.outline(c[2]); b.outline(c[4]); return; }
      if (f < 4) {
        b.ring(cx - R * 0.55, cy, R + f, R + f + th, c[1], a0, a1, 0.62, 1);
        b.ring(cx - R * 0.55, cy, R + f + 1, R + f + 2, c[0], a0, a1, 0.62, 1);
        if (facets) for (var q = -2; q <= 2; q++) { var aa = q * 0.26; b.line(cx - R * 0.55 + Math.cos(aa) * (R + f) * 0.62, cy + Math.sin(aa) * (R + f), cx - R * 0.55 + Math.cos(aa) * (R + f + th) * 0.62, cy + Math.sin(aa) * (R + f + th), c[2]); }
        b.outline(c[4]);
        return;
      }
      var k = f - 4, segs = facets ? 6 : 3;   // cracked arcs drifting apart
      for (var s = 0; s < segs; s++) {
        var sa = a0 + (a1 - a0) * s / segs + 0.04, sb = a0 + (a1 - a0) * (s + 1) / segs - 0.04, mid = (sa + sb) / 2, push = k * 1.6;
        b.ring(cx - R * 0.55 + Math.cos(mid) * push, cy + Math.sin(mid) * push * 1.6, R + 2 + k, R + 2 + k + Math.max(1, th - k), c[1 + Math.min(2, k >> 1)], sa, sb, 0.62, 1);
      }
      if (k > 3) b.breakup(1 - (k - 3) / (n - 7), k, 0);
    });
  }

  I.onInit('hits-v2', function () {
    var Ho = I.N.hot.u, Rd = I.N.red.u, Co = I.N.cool.u, Go = I.N.gold.u;
    HB.heavy = burst(84, 76, 16, 811, 12, 30, Ho, {});
    HB.counter = burst(100, 92, 22, 823, 16, 38, [Rd[0], Rd[1], Rd[2], Rd[3], Rd[4], Rd[5], Rd[6]], { crackle: true, ring2: true, inv: Rd[6] });
    HB.special = { generic: burst(88, 80, 18, 833, 8, 30, Go, { diamond: true, fwd: 4 }) };
    ['claude', 'deepseek'].forEach(function (ch) {
      [0, 1].forEach(function (pal) {
        var sc = I.scheme(ch, pal), r = ch === 'claude' ? sc.light.u : sc.water.u;
        HB.special[ch + pal] = burst(88, 80, 18, 833, 8, 30, r, { diamond: true, fwd: 4 });
      });
    });
    HB.blockL = shield(40, 52, 10, 20, 3, Co, false);
    HB.blockH = shield(52, 80, 14, 32, 4, Co, true);
    HB.ko = burst(150, 140, 26, 851, 18, 56, [Ho[0], Ho[0], Ho[1], Ho[2], Ho[3], Rd[4], Rd[6]], { crackle: true, ring2: true, inv: Rd[6], cxf: 0.5 });
  });

  var nOf = function (b, O) { return I.nOf(b, O); };
  function speedLines(x, y, O, n, v, rc) {
    var a0 = I.dirOf(O);
    for (var i = 0; i < n; i++) { var p = I.spark(x - Math.cos(a0) * 6, y + I.RI(-14, 14), a0 + I.RS() * 0.05, I.RR(9, 12), 7, rc, I.FRONT, { max: 22, len: 2.6, drag: 0.8 }); p.delay = 1; }
  }
  function debris(x, y, O, n, rc, size) {
    var a0 = I.dirOf(O);
    for (var i = 0; i < n; i++) {
      var a = a0 + I.RS() * 1.2, p = I.add(I.K_DOT, x, y, I.FRONT);
      p.vx = Math.cos(a) * I.RR(1.8, 4.2); p.vy = Math.sin(a) * I.RR(1.8, 4) - 1.8; p.g = 0.24; p.life = I.RI(14, 22); p.size = size; p.ramp = rc; p.c = 1; p.e = 1;
    }
  }

  I.def('hit.heavy', function (x, y, O) {
    I.anim1(HB.heavy, x, y, O.facing, I.lay(O, I.FRONT));
    I.sparksFan(x, y, O, nOf(10, O), 0.8, 3.4, 6.4, 9, 14, I.N.hot.css, { max: 12, size: 2 });
    speedLines(x, y, O, nOf(4, O), 10, I.N.hot.css);
    debris(x, y, O, nOf(6, O), I.N.hot.css, 2);
  }, { desc: 'v2: ~60 px 12-ray burst, inverted impact frame, ring, flying streak segments, speed lines in the blow direction, embers; 16f.', use: 'Heavy normals / launchers / sweeps on hit, contact point, facing = attacker. Pair with screen.impact for big ones.' });

  I.def('hit.special', function (x, y, O) {
    var key = O.char ? O.char + O.pal : 'generic', Aa = HB.special[key] || HB.special.generic;
    var rc = O.char === 'claude' ? I.scheme('claude', O.pal).light.css : O.char === 'deepseek' ? I.scheme('deepseek', O.pal).water.css : I.N.gold.css;
    I.anim1(Aa, x, y, O.facing, I.lay(O, I.FRONT));
    I.sparksFan(x, y, O, nOf(9, O), 1.2, 3.2, 6, 9, 14, rc, { max: 10 });
    speedLines(x, y, O, nOf(3, O), 10, rc);
    for (var i = 0; i < nOf(6, O); i++) { var a = I.R() * TAU; I.twinkle(x + Math.cos(a) * I.RR(14, 30), y + Math.sin(a) * I.RR(10, 24), I.RI(2, 4), I.RI(10, 15), rc, I.FRONT, I.RI(2, 7)); }
  }, { desc: 'v2: ~64 px compass star + expanding diamond rings (magic geometry), streaks, twinkles; tinted by opts.char; 18f.', use: 'Special-move hits; pass char for character colours.' });

  I.def('hit.counter', function (x, y, O) {
    I.anim1(HB.counter, x, y, O.facing, I.lay(O, I.FRONT));
    I.sparksFan(x, y, O, nOf(14, O), 1.3, 3.8, 7, 10, 16, I.N.red.css, { max: 12, size: 2 });
    speedLines(x, y, O, nOf(5, O), 11, I.N.red.css);
    debris(x, y, O, nOf(8, O), I.N.red.css, 2);
  }, { desc: 'v2: huge ~76 px jagged red-white burst, dark-red inversion, red crackle, double ring, speed lines, embers; 22f.', use: 'Counter hits (instead of the normal spark), with screen.impact phase "counter".' });

  I.def('block.light', function (x, y, O) {
    I.anim1(HB.blockL, x - O.facing * 2, y, -O.facing, I.lay(O, I.FRONT));
    var back = O.facing > 0 ? PI : 0;
    for (var i = 0; i < nOf(5, O); i++) { var a = back + I.RS() * 1.1, p = I.chip(x - O.facing * 2, y + I.RI(-8, 8), Math.cos(a) * I.RR(1.2, 2.8), Math.sin(a) * I.RR(1, 2.4) - 1, I.RI(9, 14), I.N.cool.css, 1, I.FRONT); p.g = 0.15; p.d = 2; p.floor = 0; }
  }, { desc: 'v2: cool blue-white ")" crescent shield (~26 px tall) bulging toward the attacker, cracks into 3 arcs, chips fly back; 10f.', use: 'Light/medium attacks blocked. Contact point, facing = attacker.' });

  I.def('block.heavy', function (x, y, O) {
    I.anim1(HB.blockH, x - O.facing * 3, y, -O.facing, I.lay(O, I.FRONT));
    var back = O.facing > 0 ? PI : 0;
    for (var i = 0; i < nOf(9, O); i++) { var a = back + I.RS() * 1.3, p = I.chip(x - O.facing * 4, y + I.RI(-16, 16), Math.cos(a) * I.RR(1.5, 3.6), Math.sin(a) * I.RR(1, 2.8) - 1.2, I.RI(12, 18), I.N.cool.css, I.RI(1, 2), I.FRONT); p.g = 0.18; p.d = 2; }
    for (i = 0; i < nOf(4, O); i++) I.spark(x - O.facing * 6, y + I.RI(-14, 14), back + I.RS() * 0.15, I.RR(4.5, 6.5), 7, I.N.cool.css, I.FRONT, { max: 12, len: 2 });
  }, { desc: 'v2: large faceted ")" shield (~42 px tall), shatters into 6 arcs, chips + back-streaks; 14f.', use: 'Heavy normals / specials / supers blocked (chip damage).' });

  I.def('ko.burst', function (x, y, O) {
    I.anim1(HB.ko, x, y, O.facing, I.lay(O, I.FRONT), 2);
    if (A.ringW) { I.anim1(A.ringW[2], x, y, 1, I.FRONT, 1, 2); I.anim1(A.ringW[2], x, y, 1, I.FRONT, 2, 8); }
    for (var s = -1; s <= 1; s += 2) for (var k = 0; k < 3; k++) I.spark(x, y + (k - 1) * 6 * s, s > 0 ? 0 : PI, I.RR(12, 15), 16, I.N.gold.css, I.FRONT, { max: 90, len: 8, drag: 0.86 }).delay = 1;
    var a0 = O.facing > 0 ? 0 : PI;
    for (var i = 0; i < nOf(30, O); i++) { var a = a0 + I.RS() * 2.6, v = I.RR(2, 8); I.spark(x, y, a, v, I.RI(20, 36), i % 3 ? I.N.hot.css : I.N.red.css, I.FRONT, { g: 0.08, max: 12, size: i % 2 + 1, drag: 0.93 }); }
    for (i = 0; i < nOf(12, O); i++) { var an = I.R() * TAU, r = I.RR(36, 90); I.twinkle(x + Math.cos(an) * r, y + Math.sin(an) * r * 0.7, I.RI(3, 6), I.RI(16, 26), I.N.gold.css, I.FRONT, I.RI(6, 26)); }
    for (i = 0; i < nOf(12, O); i++) { var q = I.add(I.K_DOT, x, y, I.FRONT), aa = I.R() * TAU; q.vx = Math.cos(aa) * I.RR(1, 4.5); q.vy = Math.sin(aa) * I.RR(1, 4.5) - 2; q.g = 0.15; q.life = I.RI(30, 46); q.size = 2; q.ramp = I.N.gold.css; q.c = 1; q.e = 1; q.floor = I.GY + 2; q.bounce = 0.35; }
  }, { desc: 'v2: ~110 px white-hot burst with red inversion + crackle, double ring, two white rings, screen-wide flash streaks, embers & twinkles; ~52f at 2 ticks per frame.', use: 'At the final hit\'s contact point on the KO frame (with screen.koFlash, then screen.koBackdrop).' });
})();
