/* LATENT CLASH — FX: Gemini 娘 shared bakes, star particles, projectile + spawn effects (owned by FX).
 * Visual language: crisp concave four-pointed stars with iridescent facets (the LC.PAL.gemini
 * `star` hues white / cyan / pink / yellow, picked by each facet's screen angle, so a spinning
 * star shimmers), pink-violet magic (`accent`), stardust, constellation lines. Palette 1 =
 * "banana" (yellow-green magic, its own star hues). Never sunbursts/script (claude), water
 * (deepseek) or teal dragon-fire/scales (gpt).
 *  I.GEM[pal]     colour sets + baked stars (shared with gemini-specials / -backdrop / -super)
 *  I.gemStar(b, cx, cy, R, rot, pal, o)   rasterise a faceted star into a Buf
 *  K_GSTAR        spinning iridescent star particle (shrinks + flickers out)
 *  K_GSHARD       spinning star-facet shard
 * Spawn: gemini.sparkles, gemini.starCast, gemini.starHit, gemini.clawHit.
 * Sprite: gemini.star (projectile; power 0.3 / 0.6 / 1 = L / M / H, angle = travel dir, radians). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2, Q = PI / 2;
  var G = I.GEM = I.GEM || [{}, {}];
  var A = I.A = I.A || {};
  var NROT = 8;                                   // rotation frames over 90 deg (4-fold symmetry)
  function lay(O, d) { return O.layer == null ? d : O.layer; }

  /** Colour sets per palette. */
  function colours(pal) {
    var sc = I.scheme('gemini', pal), P = LC.PAL.gemini[pal], Ac = P.accent, S = P.star, g = G[pal];
    g.A = Ac.slice(); g.Au = Ac.map(I.col);
    g.S = S.slice(); g.Su = S.map(I.col);
    g.dk = sc.deep; g.dkU = I.col(sc.deep); g.out = P.outline; g.outU = I.col(P.outline);
    g.L = sc.light.css; g.Lu = sc.light.u;               // white, A0..A3, deep
    g.trail = [Ac[0], Ac[1], Ac[2], Ac[3], sc.deep];
    // twinkle ramps (K_TWINKLE: [centre, early arms, late arms, ..]) — four iridescent variants
    g.tw = [['#ffffff', S[1], S[2], Ac[2]], ['#ffffff', S[2], Ac[1], Ac[2]], ['#ffffff', S[3], S[2], Ac[2]], ['#ffffff', Ac[0], Ac[1], Ac[2]]];
    g.dust = ['#ffffff', S[1], S[2], S[3], Ac[0], Ac[1]];
    g.hue = [S[0], S[1], S[2], S[3]];
  }

  // ---- the faceted four-pointed star ---------------------------------------------------------
  // Shape: |u/R|^p + |v/R|^p <= 1 (concave sides). 8 facets (2 per arm). Each facet's hue comes from
  // its SCREEN angle (anchors: up-left white, up-right cyan, down-right pink, down-left yellow), so a
  // spinning star's colours sweep around it. Side 0 of each arm = light tone, side 1 = mid tone.
  // o = { p, rim, outline, core, flat (single hue idx), glow }
  var HUEA = [-3 * PI / 4, -PI / 4, PI / 4, 3 * PI / 4];
  function hueAt(g, phi, tone) {
    var x = ((phi + 3 * PI / 4) / Q) % 4; if (x < 0) x += 4;
    var i = Math.floor(x), fr = x - i, a = g.hue[i], b = g.hue[(i + 1) & 3];
    var c = fr < 0.32 ? a : fr > 0.68 ? b : I.mix(a, b, 0.5);
    return tone === 0 ? I.mix(c, '#ffffff', 0.35) : I.mix(c, g.A[1], 0.32);
  }
  I.gemStar = function (b, cx, cy, R, rot, pal, o) {
    o = o || {};
    var g = G[pal], p = o.p || 0.5, cs = Math.cos(rot), sn = Math.sin(rot);
    var m = new I.Buf(b.w, b.h), cache = {};
    var x0 = Math.max(0, Math.floor(cx - R - 1)), x1 = Math.min(b.w - 1, Math.ceil(cx + R + 1));
    var y0 = Math.max(0, Math.floor(cy - R - 1)), y1 = Math.min(b.h - 1, Math.ceil(cy + R + 1));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
      var au = Math.abs(u), av = Math.abs(v);
      if (Math.pow(au / R, p) + Math.pow(av / R, p) > 1) continue;
      var arm = au >= av ? (u >= 0 ? 0 : 2) : (v >= 0 ? 1 : 3);
      var ax = Math.cos(arm * Q), ay = Math.sin(arm * Q), side = ax * v - ay * u < 0 ? 0 : 1;
      var col;
      if (o.flat != null) col = side ? I.mix(g.hue[o.flat], g.A[1], 0.3) : g.hue[o.flat];
      else {
        var key = arm * 2 + side;
        if (!cache[key]) cache[key] = I.col(hueAt(g, rot + arm * Q + (side ? 0.32 : -0.32), side));
        col = cache[key];
      }
      if (au + av < R * (o.core || 0.26)) col = '#ffffff';
      m.set(x, y, typeof col === 'number' ? col : I.col(col));
    }
    if (o.rim && R >= 6) {     // inner rim on the shade side: accent
      var r0 = m.copy(), w = m.w, d = r0.d, rimU = I.col(g.A[2]);
      for (y = 1; y < m.h - 1; y++) for (x = 1; x < w - 1; x++) {
        var i = y * w + x;
        if (!d[i]) continue;
        if (!d[i + 1] || !d[i + w]) m.d[i] = rimU;
      }
    }
    if (o.outline !== false) m.outline(o.outline == null ? g.dkU : o.outline);
    b.blit(m, 0, 0);
  };

  /** Baked spinning star: NROT frames, square cell, origin centre. */
  function starAnim(pal, R, o) {
    var s = Math.ceil(R) * 2 + 5, c = s / 2;
    return I.anim(s, s, NROT, Math.floor(c), Math.floor(c), function (b, f) { I.gemStar(b, c, c, R, f * Q / NROT, pal, o); }, 1, true);
  }

  function bake() {
    [0, 1].forEach(function (pal) {
      colours(pal);
      var g = G[pal], Au = g.Au, dk = g.dkU;
      // particle stars: tiny (R 2.5, no outline), small (3.6), mid (5.2), big (7)
      g.ps = [starAnim(pal, 2.6, { outline: false, core: 0.5 }), starAnim(pal, 3.6, { core: 0.4 }), starAnim(pal, 5.2, { core: 0.32 }), starAnim(pal, 7, { rim: true })];
      // projectile: L / M / H
      g.proj = [starAnim(pal, 7.5, { rim: true }), starAnim(pal, 10, { rim: true }), starAnim(pal, 13.5, { rim: true, core: 0.22 })];
      // halo for the big star: dithered glow disc, 2 pulse frames
      g.halo = I.anim(48, 48, 2, 24, 24, function (b, f) {
        var r = 19 + f;
        for (var y = 0; y < 48; y++) for (var x = 0; x < 48; x++) {
          var dd = Math.sqrt((x + 0.5 - 24) * (x + 0.5 - 24) + (y + 0.5 - 24) * (y + 0.5 - 24));
          if (dd > r) continue;
          var k = dd / r;
          if (k > 0.62 && I.bayer(x, y) < (1 - k) * 1.6) b.set(x, y, k > 0.85 ? Au[3] : Au[2]);
          else if (k <= 0.62 && I.bayer(x + f, y) < 0.5) b.set(x, y, Au[2]);
        }
        b.ring(24, 24, r - 1, r, Au[3]); b.breakup(0.5, f, 0);
      }, 1, true);
      // facet shards: 4 hues x 4 spin frames (a sliver of a star arm), 7x7
      g.shard = [0, 1, 2, 3].map(function (h) {
        var hu = I.col(g.hue[h]), hd = I.col(I.mix(g.hue[h], g.A[1], 0.4));
        return I.anim(7, 7, 4, 3, 3, function (b, f) {
          var a = f * PI / 4, c = Math.cos(a), s = Math.sin(a);
          b.poly([3.5 + c * 3.4, 3.5 + s * 3.4, 3.5 - s * 1.4, 3.5 + c * 1.4, 3.5 - c * 2.2, 3.5 - s * 2.2], hu);
          b.set(3, 3, hd);
          b.outline(dk);
        }, 1, true);
      });
      // cast flash: star pops (R 3 -> 9 -> 0) with long axis glints, 8f
      g.cast = I.anim(40, 40, 8, 20, 20, function (b, f) {
        var R = [3, 6, 9, 8, 6, 4, 2.5, 1.5][f];
        if (f < 5) { var gl = [8, 14, 18, 15, 10][f]; b.rect(20 - gl, 20, gl * 2 + 1, 1, Au[1]); b.rect(20, 20 - gl, 1, gl * 2 + 1, Au[1]); b.rect(20 - (gl >> 1), 20, gl + 1, 1, I.col('#ffffff')); b.rect(20, 20 - (gl >> 1), 1, gl + 1, I.col('#ffffff')); }
        I.gemStar(b, 20.5, 20.5, R, f * 0.2, pal, { outline: R > 3 ? dk : false, core: 0.4 });
      }, 1, true);
      // star hit: big faceted star flashes, swells and cracks apart into 4 arms, 12f, 72x72
      g.hit = I.anim(72, 72, 12, 36, 36, function (b, f) {
        var c = 36.5;
        if (f < 2) { b.disc(c, c, 9 + f * 4, Au[1]); I.gemStar(b, c, c, 16 + f * 6, f * 0.15, pal, { rim: true }); if (f === 0) b.disc(c, c, 6, I.col('#ffffff')); return; }
        // arms fly apart: draw the star split into 4 quarters, offset outward
        var k = f - 2, off = 2 + k * 2.6, R = Math.max(4, 22 - k * 1.8), m = new I.Buf(72, 72);
        I.gemStar(m, c, c, R, 0.3 + k * 0.05, pal, { rim: true, core: 0.01 });
        for (var y = 0; y < 72; y++) for (var x = 0; x < 72; x++) {
          var col = m.d[y * 72 + x]; if (!col) continue;
          var dx = x + 0.5 - c, dy = y + 0.5 - c, a = Math.atan2(dy, dx) - 0.3 - k * 0.05, arm = Math.round(a / Q), ang = arm * Q + 0.3 + k * 0.05;
          b.set(x + Math.round(Math.cos(ang) * off), y + Math.round(Math.sin(ang) * off), col);
        }
        if (k > 4) b.breakup(1 - (k - 4) * 0.17, k, 0);
        if (k < 3) b.ring(c, c, 10 + k * 7, 11.5 + k * 7, k < 1 ? I.col('#ffffff') : Au[1]);
      }, 1, true);
      // claw: 3 curved pink scratches with white cores, staggered, 14f, 76x68
      var CL = [[-24, -26, 6, -16, 20, 22], [-30, -16, 0, -6, 12, 30], [-16, -34, 12, -24, 28, 12]];
      g.claw = I.anim(76, 68, 14, 38, 34, function (b, f) {
        var cx = 38, cy = 34;
        for (var k = 0; k < 3; k++) {
          var lf = f - k, s = CL[k], p = [s[0] + cx, s[1] + cy, s[2] + cx, s[3] + cy, s[4] + cx, s[5] + cy];
          if (lf < 0) continue;
          var gl = Math.min(1, (lf + 1) / 2), u0 = lf > 4 ? Math.min(0.92, (lf - 4) * 0.15) : 0;
          var w = lf < 3 ? 2.6 : Math.max(0.9, 2.6 - (lf - 2) * 0.32);
          if (u0 >= gl - 0.05) continue;
          var m = new I.Buf(76, 68);
          strokeQ(m, p, w + 1.1, dk, u0, gl);
          strokeQ(m, p, w, lf < 5 ? Au[1] : Au[2], u0, gl);
          if (lf < 6) strokeQ(m, p, w * 0.45, lf < 3 ? I.col('#ffffff') : Au[0], u0, gl);
          if (lf > 7) m.breakup(1 - (lf - 7) * 0.16, k, 0);
          b.blit(m, 0, 0);
          if (lf >= 1 && lf < 7) {     // tiny star at the tip
            var q = qb(p, gl), tr = lf < 4 ? 3.6 : 2.6;
            I.gemStar(b, q[0] + 0.5, q[1] + 0.5, tr, lf * 0.3 + k, pal, { core: 0.5, outline: lf < 4 ? dk : false });
          }
        }
      });
    });
  }
  function qb(p, u) { var a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; return [a * p[0] + b * p[2] + c * p[4], a * p[1] + b * p[3] + c * p[5]]; }
  function strokeQ(b, p, w, col, u0, u1) {
    var pts = [], n = 18;
    for (var i = 0; i <= n; i++) { var q = qb(p, u0 + (u1 - u0) * i / n); pts.push(q[0], q[1]); }
    b.stroke(pts, function (u) { var uu = u0 + (u1 - u0) * u; return w * Math.pow(Math.sin(Math.PI * uu), 0.7); }, col);
  }
  I.onInit('gemini-shared', bake);

  /** Draw a baked particle star (size 0..3, rotation frame f) centred at screen x,y. */
  I.gemPS = function (ctx, pal, size, f, x, y) { I.drawAnim(ctx, G[pal].ps[size], ((f % NROT) + NROT) % NROT, x, y, 1); };

  // ---- K_GSTAR: spinning iridescent star; p.c = size idx, p.ref = G[pal].ps, p.vrot frames/tick ----
  I.K_GSTAR = I.kind('gemStar', {
    draw: function (ctx, p, sx, sy) {
      var k = p.age / p.life, s = p.c - (k > 0.7 ? 1 : 0) - (k > 0.88 ? 1 : 0);
      if (k > 0.8 && ((p.age + p.seq) & 1)) return;
      if (s < 0) { ctx.fillStyle = p.ramp; ctx.fillRect(sx, sy, 1, 1); return; }
      var A0 = p.ref[s], f = Math.floor(p.rot) % NROT;
      if (f < 0) f += NROT;
      I.drawAnim(ctx, A0, f, sx, sy, 1);
    },
    step: function (p) { p.rot += p.vrot; if (p.e) p.vx += Math.sin(p.age * 0.15 + p.e) * 0.03; }
  });
  /** Spawn a star particle. size 0..3. */
  I.gemStarP = function (pal, x, y, size, vx, vy, life, layer, delay) {
    var p = I.add(I.K_GSTAR, x, y, layer);
    p.c = size; p.ref = G[pal].ps; p.vx = vx; p.vy = vy; p.life = life; p.delay = delay | 0;
    p.rot = I.RI(0, NROT - 1); p.vrot = (I.R() < 0.5 ? -1 : 1) * I.RR(0.2, 0.6); p.ramp = G[pal].hue[I.RI(1, 3)];
    return p;
  };
  // ---- K_GSHARD: facet shard; p.A anim; spins ----
  I.K_GSHARD = I.kind('gemShard', {
    draw: function (ctx, p, sx, sy) {
      var k = p.age / p.life;
      if (k > 0.7 && ((p.age + p.seq) & 1)) return;
      I.drawAnim(ctx, p.A, Math.floor(p.rot) & 3, sx, sy, 1);
    },
    step: function (p) { p.rot += p.vrot; }
  });
  function shard(pal, x, y, vx, vy, life, layer) {
    var p = I.add(I.K_GSHARD, x, y, layer);
    p.A = G[pal].shard[I.RI(0, 3)]; p.vx = vx; p.vy = vy; p.life = life; p.g = 0.12; p.drag = 0.93; p.rot = I.RI(0, 3); p.vrot = I.RR(0.3, 0.7);
    return p;
  }
  I.gemShard = shard;
  /** Iridescent twinkle (4 variants). */
  I.gemTwinkle = function (pal, x, y, size, life, layer, delay) { return I.twinkle(x, y, size, life, G[pal].tw[I.RI(0, 3)], layer, delay); };

  // ---- spawn effects ----------------------------------------------------------------------------
  I.def('gemini.sparkles', function (x, y, O) {
    var L = lay(O, I.FRONT), pal = O.pal, n = I.nOf(8, O);
    for (var i = 0; i < n; i++) {
      var p = I.gemStarP(pal, x + I.RS() * 26, y + I.RS() * 32, i % 4 === 0 ? 2 : i % 2 ? 1 : 0, I.RS() * 0.25, -I.RR(0.15, 0.5), I.RI(40, 70), L, I.RI(0, 30));
      p.e = I.R() * TAU; p.vrot *= 0.6;
    }
    for (i = 0; i < I.nOf(5, O); i++) I.gemTwinkle(pal, x + I.RS() * 30, y + I.RS() * 34, I.RI(2, 3), I.RI(12, 18), L, I.RI(0, 50));
    for (i = 0; i < I.nOf(6, O); i++) {
      var d = I.add(I.K_DOT, x + I.RS() * 28, y + I.RS() * 30, L);
      d.vy = -I.RR(0.1, 0.35); d.vx = I.RS() * 0.15; d.life = I.RI(30, 60); d.size = 1; d.ramp = G[pal].dust; d.delay = I.RI(0, 40);
    }
  }, { desc: 'Ambient: 8 small spinning iridescent four-pointed stars + twinkles + stardust motes drifting up around the point, each shrinking and flickering out; ~90f.', use: 'Free accent around Gemini: idle/intro/win, meter, the light-twin while it waits, landing of the double jump. Front layer (opts.layer to change).' });

  I.def('gemini.starCast', function (x, y, O) {
    var g = G[O.pal], f = O.facing, L = lay(O, I.FRONT);
    I.anim1(g.cast, x, y, 1, L, 1);
    for (var i = 0; i < I.nOf(6, O); i++) {
      var a = (f > 0 ? 0 : PI) + I.RS() * 0.7 - 0.25 * f * 0, v = I.RR(1.6, 3.6);
      var p = I.gemStarP(O.pal, x + f * 3, y + I.RS() * 3, i < 2 ? 1 : 0, Math.cos(a) * v, Math.sin(a) * v - 0.4, I.RI(14, 22), L, i >> 1);
      p.drag = 0.86;
    }
    for (i = 0; i < I.nOf(3, O); i++) I.gemTwinkle(O.pal, x + f * I.RR(4, 14), y + I.RS() * 8, 2, I.RI(8, 12), L, I.RI(1, 6));
  }, { desc: 'Flick of sparkles at the hand: a faceted star pops with long glints (8f) and 6 tiny iridescent stars flick forward in a fan; ~22f.', use: 'At the muzzle (flicking hand) on the release frame of star / airStar (startup f0 also fine), facing = hers.' });

  I.def('gemini.starHit', function (x, y, O) {
    var g = G[O.pal], f = O.facing, L = lay(O, I.FRONT), n = I.nOf(10, O);
    I.anim1(g.hit, x, y, 1, L, 1);
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU + I.RS() * 0.3, v = I.RR(2, 4.2);
      var s = shard(O.pal, x + Math.cos(a) * 5, y + Math.sin(a) * 5, Math.cos(a) * v + f * 0.8, Math.sin(a) * v - 1, I.RI(18, 28), L);
      s.delay = 2;
    }
    for (i = 0; i < I.nOf(5, O); i++) { var b = I.R() * TAU, w = I.RR(1, 2.4); I.gemStarP(O.pal, x, y, I.RI(0, 1), Math.cos(b) * w, Math.sin(b) * w - 0.5, I.RI(18, 30), L, I.RI(2, 6)).drag = 0.92; }
    if (A.ringC && A.ringC['gemini' + O.pal]) I.anim1(A.ringC['gemini' + O.pal][1], x, y, 1, L, 1, 2);
  }, { desc: 'The star shatters: a big faceted star flash splits into its four arms flying apart (12f), 10 spinning iridescent facet shards, small stars, a pink ring; ~30f.', use: 'At the contact point when gemini.star hits (or is blocked), facing = the star\'s travel direction. H star (2 hits): spawn on each hit.' });

  I.def('gemini.clawHit', function (x, y, O) {
    var g = G[O.pal], f = O.facing, L = lay(O, I.FRONT);
    I.anim1(g.claw, x, y, f, L, 1);
    for (var i = 0; i < I.nOf(4, O); i++) I.gemStarP(O.pal, x + f * I.RR(6, 22), y + I.RS() * 18, I.RI(0, 1), f * I.RR(0.4, 1.4), -I.RR(0.3, 1), I.RI(14, 22), L, I.RI(2, 6)).drag = 0.9;
    for (i = 0; i < I.nOf(5, O); i++) I.spark(x, y + I.RI(-8, 8), (f > 0 ? 0.6 : PI - 0.6) + I.RS() * 0.5, I.RR(4, 6), 8, g.trail, L, { max: 8, len: 1.8 });
  }, { desc: 'Cat scratch: three curved pink claw arcs with white cores, staggered 1f, each with a tiny star at its tip; pink sparks, small iridescent stars; ~22f, ~64 px.', use: 'On hit of her claw attacks (5L/2L/jL, starRise, twinStrike) at the contact point, facing = attacker. With or instead of hit.light / hit.medium.' });

  // ---- sprite: the projectile ---------------------------------------------------------------------
  var SZ = [{ R: 7.5, len: 18, w: 3, spin: 1 }, { R: 10, len: 24, w: 4, spin: 0.75 }, { R: 13.5, len: 30, w: 5, spin: 0.5 }];
  function sizeOf(power) { return power <= 0.4 ? 0 : power <= 0.75 ? 1 : 2; }
  I.defSprite('gemini.star', {
    desc: 'Projectile: a crisp four-pointed star with iridescent facets (colours sweep as it spins), white core, accent rim + outline, a short tapered pink-violet trail with stardust, a twinkle glint every ~10f. power 0.3/0.6/1 = L ~20 px / M ~25 px / H ~32 px (H spins slower, has a pulsing dithered halo and a heavier trail).',
    use: 'Every frame for the live projectile at its centre: drawSprite(ctx,"gemini.star",sx,sy,t,{power, angle, facing, palette}); t = frames alive; angle = travel direction in radians on screen (default along facing; M star e.g. -0.35, airStar 0.785 / PI-0.785). Front layer [D].',
    info: { duration: 0, bbox: { x: -14, y: -14, w: 28, h: 28 }, sizes: { L: 20, M: 25, H: 32 }, boxes: { L: { x: -8, y: -8, w: 16, h: 16 }, M: { x: -10, y: -10, w: 20, h: 20 }, H: { x: -14, y: -14, w: 28, h: 28 } } },
    draw: function (ctx, sx, sy, t, o) {
      var g = G[o.pal], si = sizeOf(o.power), z = SZ[si], raw = o.raw;
      var ang = raw.angle != null ? +raw.angle : (o.facing > 0 ? 0 : PI), ux = Math.cos(ang), uy = Math.sin(ang);
      if (si === 2) I.drawAnim(ctx, g.halo, (t >> 2) & 1, sx, sy, 1);
      // trail: square brush tapering back from the star, accent -> deep, dithered tail
      var len = Math.min(z.len, 4 + t * 4), r0 = z.R * 0.45, T = g.trail;
      for (var pass = 0; pass < 2; pass++) {
        for (var s = 0; s < len; s++) {
          var k = s / len, w = Math.max(1, Math.round((z.w - (pass ? 1.5 : 0)) * (1 - k * 0.85)));
          if (pass && (w < 1 || k > 0.55)) continue;
          var px = Math.round(sx - ux * (r0 + s)), py = Math.round(sy - uy * (r0 + s));
          if (k > 0.6 && I.bayer(px, py + t) < (k - 0.6) * 2.2) continue;
          ctx.fillStyle = pass ? T[0] : (k < 0.3 ? T[1] : k < 0.6 ? T[2] : T[3]);
          ctx.fillRect(px - (w >> 1), py - (w >> 1), w, w);
        }
      }
      // stardust in the trail: 3-4 pixels drifting back
      for (var i = 0; i < 2 + si; i++) {
        var d = r0 + ((t * (2 + i) + i * 9) % Math.max(6, len + 6)), wob = Math.round(Math.sin(t * 0.5 + i * 2) * (2 + si));
        ctx.fillStyle = g.dust[(i + (t >> 2)) % 4];
        ctx.fillRect(Math.round(sx - ux * d - uy * wob), Math.round(sy - uy * d + ux * wob), 1, 1);
      }
      var spin = o.facing > 0 ? 1 : -1, fr = Math.floor(t * z.spin) * spin;
      I.drawAnim(ctx, g.proj[si], ((fr % NROT) + NROT) % NROT, sx, sy, 1);
      // twinkle glint: long thin axis cross for 3 frames every 10
      var ph = (t + si * 3) % 10;
      if (ph < 3) {
        var gl = Math.round(z.R * (ph === 1 ? 1.9 : 1.35));
        ctx.fillStyle = g.S[1]; ctx.fillRect(sx - gl, sy, gl * 2 + 1, 1); ctx.fillStyle = g.S[2]; ctx.fillRect(sx, sy - gl, 1, gl * 2 + 1);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - (gl >> 1), sy, gl + 1, 1); ctx.fillRect(sx, sy - (gl >> 1), 1, gl + 1);
      }
    }
  });
})();
