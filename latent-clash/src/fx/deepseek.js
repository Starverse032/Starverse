/* LATENT CLASH — FX: DeepSeek 娘 spawn effects (owned by FX).
 * Visual language: cool water. Splash crowns of tapering spikes with white
 * tips, ballistic droplets that splat on the floor, foam puffs, rising
 * bubbles, water ribbons. Colours from LC.PAL.deepseek[pal] (accent = water). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var A = I.A = I.A || {};
  var DS = A.ds = [{}, {}];

  /** Splash crown: spikes rise from a base line, peak, then break into drops. */
  function crownAnim(W, Hh, n, spikes, Wt, seed, wide) {
    var rng = I.bakeRng(seed), sp = [];
    for (var i = 0; i < spikes; i++) {
      var u = (i + 0.5) / spikes - 0.5;
      sp.push({ x: u * (wide || 1) * W * 0.8, h: (Hh - 6) * (0.45 + 0.55 * (1 - Math.abs(u) * 1.6)) * (0.75 + rng() * 0.25), lean: u * 1.4, w: 1.6 + rng() * 1.2 });
    }
    return I.anim(W, Hh, n, W / 2, Hh - 2, function (b, f) {
      var cx = W / 2, by = Hh - 2, k = f / (n - 1), grow = Math.min(1, (f + 1) / (n * 0.35)), brk = Math.max(0, (k - 0.45) / 0.55);
      for (var i = 0; i < sp.length; i++) {
        var s = sp[i], h = s.h * grow, top = by - h, tx = cx + s.x + s.lean * h * 0.5;
        if (brk < 0.6) {
          var t0 = Math.min(1, brk * 1.8);
          b.ray(cx + s.x * 0.7, by + 1, Math.atan2(top - by, tx - cx - s.x * 0.7), t0 * h, h, s.w * (1 - t0 * 0.6), 0.6, Wt[2]);
          b.ray(cx + s.x * 0.7, by + 1, Math.atan2(top - by, tx - cx - s.x * 0.7), t0 * h + 1, h * 0.85, s.w * 0.45, 0.3, Wt[1]);
          b.rect(Math.round(tx) - 1, Math.round(top), 2, 2, Wt[0]);
        }
        if (brk > 0.2) {   // drops falling off the tips
          var dd = (brk - 0.2) * 1.25;
          b.rect(Math.round(tx + s.lean * 6 * dd), Math.round(top - 3 + dd * dd * h * 0.9), 2, 2, brk > 0.7 ? Wt[3] : Wt[2]);
          if (i % 2) b.set(Math.round(tx - s.lean * 3 * dd), Math.round(top + 4 + dd * dd * h), Wt[1]);
        }
      }
      if (k < 0.8) { b.ellipse(cx, by, W * 0.32 * (0.6 + grow * 0.4), 2.5, Wt[1]); b.rect(Math.round(cx - W * 0.25), by - 1, Math.round(W * 0.5), 1, Wt[0]); }
      if (k < 0.55) b.outline(Wt[5]);
    });
  }
  I.crownAnim = crownAnim;

  function bake() {
    [0, 1].forEach(function (pal) {
      var sc = I.scheme('deepseek', pal), Wt = sc.water.u, D = DS[pal], F = sc.foam.u;
      D.crownS = crownAnim(30, 26, 12, 5, Wt, 11 + pal);
      D.crownM = crownAnim(46, 40, 14, 7, Wt, 21 + pal);
      D.crownL = crownAnim(90, 70, 18, 11, Wt, 31 + pal, 1.1);
      D.crownXL = crownAnim(160, 100, 22, 15, Wt, 41 + pal, 1.2);
      D.foam = [I.puffAnim(3, 9, [F[0], F[1], F[2], Wt[3]], 50), I.puffAnim(6, 11, [F[0], F[1], F[2], Wt[3]], 51)];
      // impact splash burst (radial water star) — 12f
      var rr = I.makeRays(61 + pal, 9, 13, 8, 0.5);
      D.burst = I.anim(52, 44, 12, 24, 22, function (b, f) {
        var cx = 24, cy = 22;
        if (f === 0) { I.starOf(b, cx, cy, rr, 1, 4, Wt[0]); b.disc(cx, cy, 5, Wt[0]); b.outline(Wt[2]); b.outline(Wt[5]); }
        else if (f === 1) { I.starOf(b, cx, cy, rr, 1.12, 4.5, Wt[2]); I.starOf(b, cx, cy, rr, 0.75, 3, Wt[1]); b.disc(cx, cy, 4, Wt[0]); b.outline(Wt[5]); }
        else if (f < 6) {
          var k = f - 2;
          for (var i = 0; i < rr.length; i++) {
            var r = rr[i], d = r.len * (0.7 + k * 0.2), s = Math.max(1, 3 - k * 0.6);
            b.disc(cx + Math.cos(r.a) * d, cy + Math.sin(r.a) * d + k * k * 0.5, s, k < 2 ? Wt[1] : Wt[2]);
            b.ray(cx, cy, r.a, r.len * (0.3 + k * 0.2), d - s, 0.3, Math.max(0.4, s * 0.6), Wt[2 + (k >> 1)]);
          }
          b.ring(cx, cy, 5 + k * 3, 6.2 + k * 3, k < 2 ? Wt[0] : Wt[1]);
          if (k < 2) b.outline(Wt[5]);
        } else {
          var q = f - 6;
          for (var j = 0; j < rr.length; j++) { var a = rr[j].a, dd = rr[j].len * (1.6 + q * 0.12); b.rect(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd + (4 + q) * (4 + q) * 0.3, q < 3 ? 2 : 1, q < 3 ? 2 : 1, q < 3 ? Wt[2] : Wt[3]); }
        }
      });
      // water column (pool out) — 20f, 40x96
      D.column = I.anim(44, 100, 20, 22, 98, function (b, f) {
        var cx = 22, by = 98, H = f < 5 ? 20 + f * 16 : 86 - Math.max(0, f - 9) * 7, wTop = f < 6 ? 4 : 4 + (f - 6) * 1.4;
        if (H <= 0) return;
        var top = by - H;
        for (var y = top; y <= by; y++) {
          var u = (y - top) / Math.max(1, H), w = 3 + u * 6 + Math.sin(y * 0.6 + f) * 1;
          if (f > 10 && I.bayer(cx, y + f) > 1 - (f - 10) / 10) continue;
          b.rect(cx - w, y, w * 2, 1, Wt[2]); b.rect(cx - w * 0.45, y, w * 0.6, 1, Wt[1]); b.set(cx - w * 0.2 - 1, y, Wt[0]);
        }
        if (f < 12) { b.ellipse(cx, top + 2, wTop + 3, 3, Wt[1]); b.rect(cx - wTop - 2, top, wTop * 2 + 4, 1, Wt[0]); }
        for (var i = 0; i < 6; i++) {
          var s = (i - 2.5) / 2.5, dy = Math.max(0, f - 4) * 1.6;
          if (f > 3 && f < 17) b.rect(cx + s * (8 + (f - 3) * 2.2), top + 4 + dy * dy * 0.12 * (1 + Math.abs(s)), 2, 3, i % 2 ? Wt[1] : Wt[2]);
        }
        b.ellipse(cx, by, 14, 3, Wt[2]); b.rect(cx - 10, by - 1, 20, 1, Wt[0]);
        if (f < 14) b.outline(Wt[5]);
      });
    });
  }
  I.onInit('deepseek', bake);

  // ---- BUBBLE kind: ring bubble that rises & wobbles, pops at the end ------------
  I.K_BUBBLE = I.kind('bubble', {
    draw: function (ctx, p, sx, sy) {
      var r = p.ramp, s = p.size, left = p.life - p.age;
      if (left <= 2) { ctx.fillStyle = r[1]; ctx.fillRect(sx - s - 1, sy, 1, 1); ctx.fillRect(sx + s + 1, sy, 1, 1); ctx.fillRect(sx, sy - s - 1, 1, 1); return; }
      ctx.fillStyle = r[2];
      if (s <= 1) { ctx.fillRect(sx - 1, sy, 1, 1); ctx.fillRect(sx + 1, sy, 1, 1); ctx.fillRect(sx, sy - 1, 1, 1); ctx.fillRect(sx, sy + 1, 1, 1); }
      else { ctx.fillRect(sx - 1, sy - 2, 3, 1); ctx.fillRect(sx - 1, sy + 2, 3, 1); ctx.fillRect(sx - 2, sy - 1, 1, 3); ctx.fillRect(sx + 2, sy - 1, 1, 3); }
      ctx.fillStyle = r[0]; ctx.fillRect(sx - (s > 1 ? 1 : 0), sy - (s > 1 ? 1 : 0), 1, 1);
    },
    step: function (p) { p.x += Math.sin(p.age * 0.3 + p.a) * 0.3; }
  });
  I.bubble = function (x, y, size, life, rampCss, layer, delay) {
    var p = I.add(I.K_BUBBLE, x, y, layer);
    p.size = size; p.life = life; p.ramp = rampCss; p.vy = -I.RR(0.5, 1.1); p.a = I.R() * 6; p.delay = delay | 0; p.drag = 0.98;
    return p;
  };

  // ---- spawn effects --------------------------------------------------------------
  function sc(O) { return I.scheme('deepseek', O.pal); }
  function lay(O, d) { return O.layer == null ? d : O.layer; }
  function drops(x, y, n, a0, spread, v0, v1, rc, layer, life) {
    for (var i = 0; i < n; i++) {
      var a = a0 + I.RS() * spread, v = I.RR(v0, v1);
      I.drop(x + I.RS() * 3, y, Math.cos(a) * v, Math.sin(a) * v, life || I.RI(22, 34), rc, layer, I.R() < 0.3 ? 2 : 1);
    }
  }
  var trails = {};
  function ribbon(key, x, y, size, life, rc, L) {
    var last = trails[key], now = I.tick;
    if (last && now - last.t <= 3 && Math.abs(last.x - x) < 50 && Math.abs(last.y - y) < 60) {
      var r = I.add(I.K_RIBBON, x, y, L);
      r.a = last.x; r.b = last.y; r.size = size; r.life = life; r.ramp = rc; r.vy = 0.25;
    }
    trails[key] = { x: x, y: y, t: now };
  }

  I.def('deepseek.waveCast', function (x, y, O) {
    var s = sc(O), D = DS[O.pal];
    I.anim1(D.crownS, x, y, O.facing, lay(O, I.FRONT), 1);
    drops(x, y - 4, I.nOf(7, O), O.facing > 0 ? -1.0 : -2.1, 0.5, 1.6, 3.4, s.water.css, I.FRONT);
    I.anim1(D.foam[0], x + O.facing * 6, y, O.facing, I.FRONT, 2).vx = O.facing * 0.6;
  }, { desc: 'Small forward splash crown + droplets + foam at the foot, ~24f.', use: 'At anchor `muzzle` (floor) on the first active frame of wave, when the wave sprite starts.' });

  I.def('deepseek.waveHit', function (x, y, O) {
    var s = sc(O), D = DS[O.pal];
    I.anim1(D.burst, x, y, O.facing, lay(O, I.FRONT), 1);
    I.anim1(D.crownM, x, I.GY, O.facing, I.BACK, 1);
    drops(x, y, I.nOf(12, O), -PI / 2 + O.facing * 0.5, 1.2, 1.8, 4.4, s.water.css, I.FRONT);
    for (var i = 0; i < I.nOf(5, O); i++) I.bubble(x + I.RS() * 12, y + I.RS() * 10, I.RI(1, 2), I.RI(16, 26), s.water.css, I.FRONT, I.RI(0, 6));
  }, { desc: 'Radial water burst + floor crown + droplets + bubbles, ~30f.', use: 'Where the wave hits / is blocked (at the victim\'s chest height).' });

  I.def('deepseek.breachTrail', function (x, y, O) {
    var s = sc(O), L = lay(O, I.BACK);
    ribbon('b' + O.pal, x, y, 5, 12, s.water.css, L);
    if (I.R() < 0.7) I.drop(x + I.RS() * 4, y + I.RS() * 4, I.RS() * 1.2, I.RR(-1.5, 0.5), I.RI(18, 28), s.water.css, I.FRONT, 1);
    if (I.R() < 0.3) I.bubble(x + I.RS() * 6, y, 1, 14, s.water.css, I.FRONT);
  }, { desc: 'One segment of a water ribbon (foam core) that sheds drops; consecutive spawns join into an arc.', use: 'Every frame of breach rise+fall at anchor `weapon` (the kicking foot).' });

  I.def('deepseek.diveTrail', function (x, y, O) {
    var s = sc(O);
    ribbon('d' + O.pal, x, y, 4, 9, s.water.css, lay(O, I.BACK));
    if (I.R() < 0.6) I.drop(x, y, -O.facing * I.RR(0.5, 1.5), I.RR(-1, 0.5), I.RI(16, 24), s.water.css, I.FRONT, 1);
    if (I.R() < 0.4) I.spark(x, y, O.facing > 0 ? PI * 0.8 : PI * 0.2, I.RR(2, 3), 6, s.water.css, I.FRONT, { max: 6 });
  }, { desc: 'Diagonal water streak segment + drops (joins consecutive spawns).', use: 'Every frame of diveKick active at anchor `weapon`.' });

  I.def('deepseek.poolIn', function (x, y, O) {
    var s = sc(O), D = DS[O.pal];
    I.anim1(D.crownM, x, y, O.facing, lay(O, I.FRONT), 1);
    I.anim1(A.ringGC['deepseek' + O.pal][0], x, y, 1, I.BACK, 1);
    drops(x, y - 2, I.nOf(10, O), -PI / 2, 0.8, 2, 4, s.water.css, I.FRONT);
    for (var i = 0; i < I.nOf(6, O); i++) I.bubble(x + I.RS() * 10, y - I.R() * 6, I.RI(1, 2), I.RI(14, 22), s.water.css, I.FRONT, I.RI(4, 12));
  }, { desc: 'Sinking splash: crown + floor ring + drops + bubbles, ~30f.', use: 'At her origin on the first sink frame of diveIn (draw the deepseek.pool sprite too).' });

  I.def('deepseek.poolOut', function (x, y, O) {
    var s = sc(O), D = DS[O.pal];
    I.anim1(D.column, x, y, 1, lay(O, I.FRONT), 1);
    I.anim1(D.crownL, x, y, O.facing, I.BACK, 1);
    drops(x, y - 30, I.nOf(16, O), -PI / 2, 0.9, 2, 5.5, s.water.css, I.FRONT, I.RI(30, 44));
    I.anim1(D.foam[1], x - 8, y, -1, I.FRONT, 2, 4).vx = -0.7; I.anim1(D.foam[1], x + 8, y, 1, I.FRONT, 2, 4).vx = 0.7;
  }, { desc: 'Water column bursting ~90 px up with crown, raining drops, foam, ~44f.', use: 'At the exit point (floor) on the first frame of diveOut.' });

  I.def('deepseek.chainHit', function (x, y, O) {
    var s = sc(O), D = DS[O.pal], idx = O.index | 0;
    I.anim1(D.burst, x, y, O.facing, lay(O, I.FRONT), 1);
    var up = idx === 2 ? -PI / 2 + O.facing * 0.3 : (O.facing > 0 ? -0.3 : PI + 0.3);
    drops(x, y, I.nOf(idx === 2 ? 10 : 6, O), up, 0.7, 2, idx === 2 ? 5.5 : 4, s.water.css, I.FRONT);
    if (idx === 2) I.anim1(A.ringC['deepseek' + O.pal][1], x, y, 1, I.FRONT, 1);
  }, { desc: 'Water-fist impact burst + directional droplets; index 2 (launcher) adds a ring and an upward spray.', use: 'On each chain1/2/3 hit (index 0/1/2) at the contact point, together with hit.medium/heavy if wanted.' });

  I.def('deepseek.whaleSplash', function (x, y, O) {
    var s = sc(O), D = DS[O.pal];
    I.anim1(D.crownXL, x, y, O.facing, lay(O, I.FRONT), 2);
    I.anim1(A.ringGC['deepseek' + O.pal][1], x, y, 1, I.BACK, 1);
    drops(x, y - 6, I.nOf(60, O), -PI / 2, 1.1, 2.5, 7.5, s.water.css, I.FRONT, I.RI(36, 56));
    for (var i = 0; i < 4; i++) I.anim1(D.foam[1], x + (i - 1.5) * 22, y, i < 2 ? -1 : 1, I.FRONT, 3, i * 2).vx = (i - 1.5) * 0.8;
    for (i = 0; i < I.nOf(14, O); i++) I.bubble(x + I.RS() * 50, y - I.R() * 30, I.RI(1, 2), I.RI(20, 40), s.water.css, I.FRONT, I.RI(4, 20));
  }, { desc: 'Massive crash: 160 px crown wall, 60 drops raining, foam, floor ring, bubbles, ~50f.', use: 'At the whale crash point: (x + facing*spriteInfo("deepseek.whale").crashX, GROUND_Y) on frame events.crash.' });

  I.def('deepseek.bubbles', function (x, y, O) {
    var s = sc(O);
    for (var i = 0; i < I.nOf(8, O); i++) I.bubble(x + I.RS() * 10, y + I.RS() * 8, I.RI(1, 2), I.RI(24, 44), s.water.css, lay(O, I.FRONT), I.RI(0, 16));
  }, { desc: 'Cluster of wobbling rising bubbles that pop, ~50f.', use: 'Ambient: idle/intro flourishes, getup on the abyss stage, after dive.' });

  I.def('deepseek.splash', function (x, y, O) {
    var s = sc(O);
    I.anim1(DS[O.pal].crownS, x, y, O.facing, lay(O, I.FRONT), 1);
    drops(x, y - 3, I.nOf(5, O), -PI / 2, 0.9, 1.5, 3, s.water.css, I.FRONT);
  }, { desc: 'Small water splash (extra).', use: 'Her normals on hit (with hit.*), landings in water flavour.' });
})();
