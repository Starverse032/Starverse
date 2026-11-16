/* LATENT CLASH — FX: GPT 娘 special-move spawn effects (owned by FX).
 *  gpt.clawHit     three parallel teal claw slashes (staggered), white cores, after-glow, sparks, scales
 *  gpt.breathCast  inhale: glints and streaks converge on the mouth, then a white glint
 *  gpt.riseTrail   (every frame) spiral of teal claw-arcs + scales behind the rising uppercut
 *  gpt.callSlam    crater burst: flattened white-teal star with floor cracks, ground shock rings,
 *                  dust, rock chips, her scale shards, a teal flare
 *  gpt.roarRing    expanding concentric shock rings with interlaced "distortion" bands; power -> R 56..84
 * Uses I.GPT colours / scale anims from gpt.js. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var G = I.GPT = I.GPT || [{}, {}];
  var A = I.A = I.A || {};
  function lay(O, d) { return O.layer == null ? d : O.layer; }

  function qb(p, u) { var a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; return [a * p[0] + b * p[2] + c * p[4], a * p[1] + b * p[3] + c * p[5]]; }
  function strokeQ(b, p, w, col, u0, u1) {
    var pts = [], n = 18;
    for (var i = 0; i <= n; i++) { var q = qb(p, u0 + (u1 - u0) * i / n); pts.push(q[0], q[1]); }
    b.stroke(pts, function (u) { var uu = u0 + (u1 - u0) * u; return w * Math.sin(Math.PI * uu); }, col);
  }

  function bake() {
    [0, 1].forEach(function (pal) {
      var g = G[pal], s = g.specU, Lu = g.Lu, dk = g.dkU;
      // ---- claw hit: 3 slashes, 14 frames, 72x64, origin centre ----
      var CL = [[-26, -24, -2, -12, 24, 20], [-30, -14, -6, 0, 18, 28], [-20, -32, 4, -20, 28, 10]];
      g.claw = I.anim(72, 64, 14, 36, 32, function (b, f) {
        var cx = 36, cy = 32;
        for (var k = 0; k < 3; k++) {
          var lf = f - k, src = CL[k], p = [src[0] + cx, src[1] + cy, src[2] + cx, src[3] + cy, src[4] + cx, src[5] + cy];
          if (lf < 0) continue;
          var gl = Math.min(1, (lf + 1) / 2), u0 = lf > 5 ? Math.min(0.9, (lf - 5) * 0.14) : 0;
          var w = lf < 4 ? 3.4 : Math.max(1, 3.4 - (lf - 3) * 0.45);
          if (u0 >= gl - 0.05) continue;
          var m = new I.Buf(72, 64);
          strokeQ(m, p, w + 1.2, dk, u0, gl);
          strokeQ(m, p, w, lf < 6 ? Lu[2] : Lu[3], u0, gl);
          if (lf < 7) strokeQ(m, p, w * 0.45, lf < 3 ? Lu[0] : Lu[1], u0, gl);
          if (lf > 8) m.breakup(1 - (lf - 8) * 0.17, k, 0);
          b.blit(m, 0, 0);
        }
        if (f < 3) { b.star4(cx + 2, cy - 2, 12 - f * 3, 12 - f * 3, 1.6, Lu[0]); }
      });
      // ---- rise arcs: 8 orientations x 6 frames (crescent, tapered), 32x32 ----
      g.arcs = [];
      for (var o = 0; o < 8; o++) {
        g.arcs.push(I.anim(32, 32, 6, 16, 16, function (b, f) {
          var a0 = o * TAU / 8, span = 2.0 - f * 0.12, r = 10 + f * 0.8, pts = [];
          for (var i = 0; i <= 14; i++) { var a = a0 + span * (i / 14 - 0.5); pts.push(16 + Math.cos(a) * r, 16 + Math.sin(a) * r * 0.8); }
          var w = f < 2 ? 2.6 : 2.6 - (f - 1) * 0.4;
          b.stroke(pts, function (u) { return w * Math.sin(PI * u) + 0.3; }, f < 3 ? Lu[2] : Lu[3]);
          b.outline(f < 4 ? dk : Lu[4]);
          if (f < 3) b.stroke(pts, function (u) { return w * 0.45 * Math.sin(PI * u); }, f === 0 ? Lu[0] : Lu[1]);
          if (f > 3) b.breakup(f === 4 ? 0.6 : 0.3, o, 0);
        }, 1, true));
      }
      // ---- slam crater: 20 frames, 140x56, origin = floor point (70, 46) ----
      g.crater = I.anim(140, 60, 20, 70, 48, function (b, f) {
        var cx = 70, cy = 48, rng = I.bakeRng(5150 + pal);
        // floor cracks (dark), growing then fading
        if (f >= 1) {
          var cl = Math.min(1, f / 4), cc = f < 12 ? dk : Lu[4];
          for (var k = 0; k < 9; k++) {
            var side = k % 2 ? 1 : -1, len = (18 + rng() * 40) * cl, y0 = cy + 1 + Math.floor(rng() * 3), x = cx, y = y0;
            for (var st = 0; st < len; st += 3) { var nx = x + side * 3, ny = y0 + Math.round(Math.sin(st * 0.5 + k) * 1.2); b.line(x, y, nx, ny, cc); if (f < 6 && st < len * 0.4) b.set(nx, ny - 1, Lu[2]); x = nx; y = ny; }
          }
          if (f > 14) b.breakup(1 - (f - 14) * 0.15, 3, 0);
        }
        // flattened burst star
        if (f < 9) {
          var R = [16, 30, 40, 44, 42, 36, 28, 18, 10][f], m = new I.Buf(140, 60);
          var angs = [], rads = [];
          for (var q = 0; q < 12; q++) { angs.push(PI + q * PI / 11); rads.push(R * (q % 2 ? 0.55 : 1) * (q === 0 || q === 11 ? 1.2 : 1)); }
          var pts = [];
          for (q = 0; q < 12; q++) pts.push(cx + Math.cos(angs[q]) * rads[q] * 1.6, cy + Math.sin(angs[q]) * rads[q] * 0.85);
          pts.push(cx + R * 1.7, cy + 2, cx - R * 1.7, cy + 2);
          m.poly(pts, f < 2 ? Lu[0] : f < 5 ? Lu[1] : Lu[2]);
          m.outline(f < 5 ? Lu[3] : dk);
          if (f < 6) m.ellipse(cx, cy - R * 0.2, R * 0.9, R * 0.32, f < 3 ? Lu[0] : Lu[1]);
          if (f > 5) m.breakup(1 - (f - 5) * 0.2, 1, 0);
          b.blit(m, 0, 0);
        }
      });
      g.css = { L: g.L, rock: g.rock.map(function (u) { return u; }) };
    });
  }
  I.onInit('gpt-specials', bake);

  // ---- CLAW HIT ---------------------------------------------------------------------------------
  I.def('gpt.clawHit', function (x, y, O) {
    var g = G[O.pal];
    I.anim1(g.claw, x, y, O.facing, lay(O, I.FRONT), 1);
    var a0 = O.facing > 0 ? 0.75 : PI - 0.75;
    for (var i = 0; i < I.nOf(8, O); i++) I.spark(x, y, a0 + I.RS() * 0.6, I.RR(3, 6), I.RI(8, 13), g.L, I.FRONT, { max: 9 });
    for (i = 0; i < I.nOf(4, O); i++) I.gptScaleP(x + I.RS() * 6, y + I.RS() * 6, O.facing * I.RR(0.6, 2.2), -I.RR(0.8, 2.4), I.RI(26, 40), g.scl[0], I.FRONT, I.RI(0, 4));
    for (i = 0; i < I.nOf(3, O); i++) I.twinkle(x + I.RS() * 18, y + I.RS() * 16, I.RI(2, 3), I.RI(8, 12), g.twk, I.FRONT, I.RI(2, 6));
  }, { desc: 'Three parallel teal claw slashes (~56 px, staggered 1f each, white cores, dark rims) that thin and break up into after-glow; sparks along the swipe, a few scales and twinkles; 14f.', use: 'Claw normals / dragonRise hits: at the contact point, facing = attacker. Use instead of (or on top of) hit.light/medium for her L claws, or with char:"gpt" hit.special for specials.' });

  // ---- BREATH CAST (inhale) -----------------------------------------------------------------------
  I.def('gpt.breathCast', function (x, y, O) {
    var g = G[O.pal], f = O.facing;
    var e = I.emitter(function (p) {
      if (p.age > 9) return;
      for (var k = 0; k < 2; k++) {
        var a = (f > 0 ? 0 : PI) + I.RS() * 1.6, r = I.RR(18, 30), v = I.RR(2.6, 3.6);
        var s = I.spark(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, a + PI, v, Math.max(3, Math.floor((r - 3) / v)), p.ref, I.FRONT, { drag: 1, max: 6, len: 1.8 });
        s.age = 1;
      }
      if (p.age % 3 === 0) { var b = (f > 0 ? 0 : PI) + I.RS() * 1.2; I.twinkle(p.x + Math.cos(b) * I.RR(8, 16), p.y + Math.sin(b) * I.RR(6, 12), 2, 8, g.twk, I.FRONT); }
    }, x, y, 12, I.FRONT);
    e.ref = g.L;
    var tw = I.twinkle(x + f * 2, y, 5, 10, g.twk, I.FRONT, 10); tw.pri = 1;
    I.twinkle(x + f * 2, y, 3, 8, g.twk, I.FRONT, 12);
    if (A.ringC && A.ringC['gpt' + O.pal]) I.anim1(A.ringC['gpt' + O.pal][0], x + f * 2, y, 1, I.FRONT, 1, 10);
  }, { desc: 'Inhale: teal streaks and glints converge on the mouth for 10f, then a white 4-point glint + a tiny teal ring pop; ~22f.', use: 'At the `muzzle` (mouth) on the first frame of breath / airBreath startup, facing = hers. Follow with the gpt.breath sprite from the first active frame.' });

  // ---- RISE TRAIL (every frame) ---------------------------------------------------------------------
  I.def('gpt.riseTrail', function (x, y, O) {
    var g = G[O.pal], f = O.facing, ph = I.tick * 0.95, L = lay(O, I.BACK);
    var oi = ((Math.round(ph / (TAU / 8)) % 8) + 8) % 8, ox = Math.cos(ph) * 9 * f, oy = Math.sin(ph) * 5;
    if (f < 0) oi = (12 - oi) % 8;            // mirror the orientation
    var p = I.anim1(g.arcs[oi], x + ox, y + oy, 1, L, 2);
    p.vy = 0.5; p.drag = 0.96;
    if (I.tick & 1) I.gptScaleP(x + I.RS() * 6, y + I.RS() * 4, I.RS() * 1.2, I.RR(0.2, 1.2), I.RI(22, 34), g.scl[I.R() < 0.3 ? 1 : 0], L);
    var s = I.spark(x, y, PI / 2 + I.RS() * 0.5, I.RR(1.5, 3), I.RI(6, 10), g.L, L, { max: 6 }); s.c = 1;
  }, { desc: 'Spawned every frame of a rising uppercut: a teal claw-arc crescent placed on a spiral around the claw (orientation turns with the spiral, so successive arcs form a helix), sinking behind her; scales every 2nd frame; a falling spark. Each arc lives 12f.', use: 'Every frame of dragonRise "rise" at the `weapon` anchor (claw tip), facing = hers. Back layer by default (opts.layer "front" to put it over her).' });

  // ---- CALL SLAM (crater burst) ------------------------------------------------------------------------
  I.def('gpt.callSlam', function (x, y, O) {
    var g = G[O.pal], L = lay(O, I.FRONT), i;
    I.anim1(g.crater, x, y, O.facing, I.BACK, 2);
    if (A.ringGC && A.ringGC['gpt' + O.pal]) { I.anim1(A.ringGC['gpt' + O.pal][1], x, y, 1, I.BACK, 1); I.anim1(A.ringGC['gpt' + O.pal][1], x, y, 1, I.BACK, 1, 5); }
    if (A.puff) {
      for (i = 0; i < 4; i++) {
        var sd = i % 2 ? 1 : -1, pp = I.anim1(A.puff[2], x + sd * (10 + i * 8), y, sd, L, 2, i);
        pp.vx = sd * (1.4 + i * 0.4); pp.vy = -0.2; pp.drag = 0.88;
      }
    }
    for (i = 0; i < I.nOf(12, O); i++) {     // her scale shards burst up and rain down
      var a = -PI / 2 + I.RS() * 1.2, v = I.RR(2.5, 5.5), q = I.gptScaleP(x + I.RS() * 12, y - 4, Math.cos(a) * v, Math.sin(a) * v, I.RI(40, 60), g.shard[i % 3 === 0 ? 1 : 0], L);
      q.g = 0.2; q.drag = 0.97; q.floor = I.GY + 1 + I.RI(0, 4); q.bounce = 0.3; q.d = 0.02;
    }
    for (i = 0; i < I.nOf(8, O); i++) { var b = -PI / 2 + I.RS() * 1.3, w = I.RR(2.4, 4.8); I.chip(x + I.RS() * 14, y - 2, Math.cos(b) * w, Math.sin(b) * w, I.RI(26, 38), I.N.rock.css, I.RI(1, 3), L); }
    for (i = 0; i < I.nOf(10, O); i++) I.spark(x + I.RS() * 8, y - 2, -PI / 2 + I.RS() * 0.5, I.RR(4, 8), I.RI(10, 16), g.L, L, { max: 16, len: 2.4 });
    for (i = 0; i < I.nOf(6, O); i++) I.twinkle(x + I.RS() * 40, y - I.RR(6, 40), I.RI(2, 4), I.RI(10, 16), g.twk, L, I.RI(2, 12));
  }, { desc: 'Crater burst on the floor: flattened white-teal star (~140 px wide) with dark floor cracks racing out, two teal ground shock rings, dust clouds both ways, rock chips, a fountain of her scale shards that bounce and rain down, an upward teal flare; ~45f.', use: 'At the victim\'s landing point on the floor (GROUND_Y) on the slam frame of callHit, facing = hers. Pair with screen.impact (char:"gpt") and a camera shake.' });

  // ---- ROAR RING -------------------------------------------------------------------------------------
  /** Elliptical band (sy = vertical squash) as row spans; interlaced = every other row only. */
  function ellBand(ctx, cx, cy, r0, r1, sy, inter) {
    var ry = Math.round(r1 * sy);
    for (var y = -ry; y <= ry; y++) {
      if (inter && ((y + cy) & 1)) continue;
      var yy = y / sy, ho = Math.floor(Math.sqrt(Math.max(0, r1 * r1 - yy * yy))), hi = yy * yy < r0 * r0 ? Math.floor(Math.sqrt(r0 * r0 - yy * yy)) : -1;
      if (hi < 0) { ctx.fillRect(cx - ho, cy + y, ho * 2 + 1, 1); continue; }
      if (ho - hi <= 0) continue;
      ctx.fillRect(cx - ho, cy + y, ho - hi, 1); ctx.fillRect(cx + hi + 1, cy + y, ho - hi, 1);
    }
  }
  I.K_ROAR = I.kind('gptRoar', {
    draw: function (ctx, p, sx, sy) {
      var L = p.ramp, R = p.size, age = p.age, life = p.life;
      for (var j = 2; j >= 0; j--) {
        var lag = j * 3, a = age - lag;
        if (a < 0) continue;
        var u = Math.min(1, a / (life - 6 - lag)), r = R * (1 - Math.pow(1 - u, 2.2)) * (1 - j * 0.16), fade = (a - (life - 9 - lag)) / 6;
        if (r < 3 || fade >= 1) continue;
        var th = Math.max(1, Math.round((j ? 2 : 3) * (1 - u * 0.5)));
        if (fade < 0.5) { ctx.fillStyle = j ? L[2] : L[3]; ellBand(ctx, sx, sy, r - th - 7, r - th - 1, 0.82, true); }     // distortion band
        ctx.fillStyle = fade < 0 ? (j ? L[2] : L[1]) : L[3]; ellBand(ctx, sx, sy, r - th, r, 0.82, fade > 0.4);
        if (fade < 0 && u < 0.7) { ctx.fillStyle = L[0]; ellBand(ctx, sx, sy, r - 1, r, 0.82, false); }
        if (j === 0 && u < 0.85) { ctx.fillStyle = L[4]; ellBand(ctx, sx, sy, r - th - 10, r - th - 9, 0.82, false); }
      }
      if (age < 3) { ctx.fillStyle = age < 2 ? L[0] : L[1]; ellBand(ctx, sx, sy, 0, 10 - age * 2, 0.82, false); }
    }
  });
  I.def('gpt.roarRing', function (x, y, O) {
    var g = G[O.pal], R = 56 + Math.round(28 * O.power), L = lay(O, I.FRONT);
    var p = I.add(I.K_ROAR, x, y, L);
    p.size = R; p.life = 24; p.ramp = g.L; p.pri = 1;
    for (var i = 0; i < I.nOf(14, O); i++) {      // dust / debris blown outward along the floor + air
      var a = I.R() * TAU, v = I.RR(3, 5.5) * (R / 70);
      I.spark(x + Math.cos(a) * 10, y + Math.sin(a) * 8, a, v, I.RI(10, 16), i % 2 ? g.L : g.dust, L, { max: 10, len: 2, drag: 0.9 });
    }
    for (i = 0; i < I.nOf(6, O); i++) { var b = I.R() * TAU; I.gptScaleP(x + Math.cos(b) * 14, y + Math.sin(b) * 10, Math.cos(b) * I.RR(2, 3.5), Math.sin(b) * I.RR(1.5, 3) - 0.5, I.RI(26, 40), g.scl[0], L, I.RI(0, 3)); }
  }, { desc: 'Point-blank roar: three concentric shock rings expanding to radius 56 (L) / 70 (M) / 84 (H) — white leading edge, teal body, an interlaced "distortion" band behind each ring, a thin inner ripple — squashed to 0.82 vertically; debris and scales blown outward; ~24f.', use: 'On the first active frame of roar at her chest/mouth, facing = hers, power = 0 / 0.5 / 1 for L / M / H (radius = 56 + 28*power). Front layer (opts.layer "back" to put it behind her).' });
})();
