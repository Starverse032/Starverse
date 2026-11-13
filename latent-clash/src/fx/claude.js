/* LATENT CLASH — FX: Claude 娘 spawn effects (owned by FX).
 * Visual language: warm starlight + ink. Irregular 8-ray starbursts (her hair
 * clip motif), glowing calligraphic brush strokes with vermilion seals, verse
 * lines of tiny glyphs, fluttering pages, hex-panel shards. Colours from
 * LC.PAL.claude[pal]: accent ramp (light), metal (gold), cloth1 (paper). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var A = I.A = I.A || {};
  var CL = A.cl = [{}, {}];      // per-palette baked anims

  /** Irregular 8-ray clip star (rays alternate long/short, slightly uneven). */
  var CLIP = [1, 0.5, 0.86, 0.46, 0.96, 0.52, 0.8, 0.48];
  function clipStar(b, cx, cy, R, ri, rot, c) {
    var angs = [], rads = [];
    for (var i = 0; i < 8; i++) { angs.push(rot + i * PI / 4 + (i % 3 === 1 ? 0.08 : 0)); rads.push(R * CLIP[i]); }
    b.star(cx, cy, angs, rads, ri, c);
  }
  I.clipStar = clipStar;

  // ---- brush stroke geometry for the haiku slash -----------------------------
  var STROKES = [   // P0, control, P1 (facing right, rel. origin), max half-width, char
    { p: [-22, 12, -2, 12, 26, -18], w: 5.5, ch: '五', seal: [22, -30] },
    { p: [-28, 2, 2, -16, 34, 0], w: 6.2, ch: '七', seal: [30, -20] },
    { p: [-18, -20, 10, -12, 24, 16], w: 7, ch: '五', seal: [28, -12] }
  ];
  function bez(s, u) {
    var p = s.p, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    return [a * p[0] + b * p[2] + c * p[4], a * p[1] + b * p[3] + c * p[5]];
  }
  /** Brush profile: blunt press at the start, belly, long tapering flick. */
  function brushW(s, u) {
    var w = u < 0.12 ? 0.55 + u / 0.12 * 0.45 : u < 0.45 ? 1 : 1 - (u - 0.45) / 0.55 * 0.92;
    return s.w * w;
  }

  function bake() {
    [0, 1].forEach(function (pal) {
      var sc = I.scheme('claude', pal), L = sc.light.u, P = sc.paper.u, S = sc.seal.u, Gd = sc.gold.u;
      var C = CL[pal];

      // SPARK CAST — 10f muzzle flash at the nib
      C.cast = I.anim(36, 32, 10, 14, 16, function (b, f) {
        var cx = 14, cy = 16;
        if (f === 0) { clipStar(b, cx, cy, 11, 3, 0, L[0]); b.outline(L[2]); b.rect(cx + 2, cy, 14, 1, L[0]); }
        else if (f === 1) { clipStar(b, cx, cy, 13, 3.5, 0.2, L[2]); clipStar(b, cx, cy, 8, 2.5, 0.2, L[1]); b.disc(cx, cy, 2.5, L[0]); b.outline(L[4]); b.rect(cx + 4, cy, 16, 1, L[1]); }
        else if (f < 5) {
          var k = f - 2;
          b.ring(cx, cy, 4 + k * 2.5, 5.4 + k * 2.4, L[1 + k]);
          for (var i = 0; i < 8; i += 2) b.ray(cx, cy, 0.2 + i * PI / 4, 7 + k * 3, 12 + k * 3, 0.3, 1, L[2 + (k >> 1)]);
          if (k === 0) b.outline(L[4]);
        } else {
          var q = f - 5;
          for (var j = 0; j < 8; j += 2) b.set(cx + Math.cos(0.2 + j * PI / 4) * (16 + q), cy + Math.sin(0.2 + j * PI / 4) * (16 + q), q < 3 ? L[3] : L[4]);
        }
      });

      // SPARK HIT — 16f: clip-star explosion, inverted core, shatters into star shards
      C.hit = I.anim(64, 60, 16, 30, 30, function (b, f) {
        var cx = 30, cy = 30;
        if (f === 0) { clipStar(b, cx, cy, 22, 6, 0.1, L[0]); b.disc(cx, cy, 7, L[0]); b.outline(L[2]); b.outline(L[5]); }
        else if (f === 1) {
          clipStar(b, cx, cy, 25, 7, 0.25, L[2]); clipStar(b, cx, cy, 17, 5, 0.25, L[0]);
          b.disc(cx, cy, 8, L[0]); b.disc(cx, cy, 6, L[5]); clipStar(b, cx, cy, 5, 1.5, 0.6, L[3]);
          b.outline(L[5]);
        } else if (f < 6) {
          var k = f - 2;
          for (var i = 0; i < 8; i++) {          // each ray flies off as a little star shard
            var a = 0.25 + i * PI / 4, d = 12 + k * 5 * (CLIP[i] + 0.4), s = (CLIP[i] > 0.7 ? 4 : 2.6) - k * 0.5;
            if (s > 0.8) b.star4(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s + 1, s + 1, 0.7, k < 2 ? L[1] : L[2]);
          }
          b.ring(cx, cy, 7 + k * 4, 9 + k * 3.6, k < 1 ? L[0] : L[1 + k]);
          if (k < 2) b.disc(cx, cy, 5 - k * 2, L[0]);
          b.outline(k < 2 ? L[5] : L[4]);
        } else if (f < 11) {
          var q = f - 6, m = new I.Buf(64, 60);
          m.ring(cx, cy, 23 + q * 1.6, 24.2 + q * 1.6, L[3 + (q > 2 ? 1 : 0)]); m.breakup(0.7 - q * 0.13, q, 0); b.blit(m, 0, 0);
          for (var j = 0; j < 8; j++) { var a2 = 0.25 + j * PI / 4, d2 = 32 + q * 2 * CLIP[j]; if ((j + q) % 3) b.set(cx + Math.cos(a2) * d2 * 0.85, cy + Math.sin(a2) * d2 * 0.85, L[2 + (q >> 1)]); }
        } else {
          for (var j2 = 0; j2 < 8; j2 += 2) { var a3 = 0.25 + j2 * PI / 4; b.set(cx + Math.cos(a3) * (30 + f - 11), cy + Math.sin(a3) * (30 + f - 11), L[4]); }
        }
      });

      // HAIKU SLASH strokes (3 shapes) — 16f each, 96x80, origin (44,40)
      C.slash = STROKES.map(function (st, si) {
        var rng = I.bakeRng(300 + si * 17);
        var gaps = [];   // flying-white streaks: lateral offsets that go dry toward the tail
        for (var g = 0; g < 3; g++) gaps.push({ off: -0.6 + g * 0.6 + (rng() - 0.5) * 0.25, from: 0.55 + rng() * 0.25 });
        return I.anim(96, 80, 16, 44, 40, function (b, f) {
          var ox = 44, oy = 40;
          function body(u0, u1, wscale, cOut, cMid, cCore, dry) {
            var N = 90;
            for (var i = 0; i <= N; i++) {
              var u = u0 + (u1 - u0) * i / N, pt = bez(st, u), w = brushW(st, u) * wscale;
              if (w < 0.4) continue;
              var pt2 = bez(st, Math.min(1, u + 0.01)), dx = pt2[0] - pt[0], dy = pt2[1] - pt[1], dl = Math.hypot(dx, dy) || 1;
              var nx = -dy / dl, ny = dx / dl;
              for (var s = -w; s <= w; s += 0.5) {
                var rel = s / w;
                var isDry = false;
                if (dry) for (var gi = 0; gi < gaps.length; gi++) if (u > gaps[gi].from && Math.abs(rel - gaps[gi].off) < 0.16) isDry = true;
                if (isDry) continue;
                var c = Math.abs(rel) > 0.72 ? cOut : Math.abs(rel + 0.25) < 0.3 ? cCore : cMid;
                b.set(ox + pt[0] + nx * s, oy + pt[1] + ny * s, c);
              }
            }
          }
          if (f === 0) { body(0, 1, 1.15, L[0], L[0], L[0], false); b.outline(L[2]); b.outline(L[5]); }
          else if (f === 1) { body(0, 1, 1.05, L[3], L[1], L[0], true); b.outline(L[5]); }
          else if (f === 2) { body(0.08, 1, 1, L[3], L[2], L[0], true); b.outline(L[5]); }
          else if (f < 9) {
            var k = (f - 2) / 7;   // dries from the start (tail of the motion) toward the tip
            var m = new I.Buf(96, 80), keepB = b;
            b = m; body(0.1 + k * 0.62, 1, 1 - k * 0.45, L[4], L[2 + (k > 0.5 ? 1 : 0)], L[1], true); b = keepB;
            m.breakup(function (x, y) { return 1 - k * 0.35; }, f, 0);
            if (f < 5) { m.outline(L[5]); }
            b.blit(m, 0, 0);
            var tip = bez(st, 1), drops = 3 + si;
            for (var d = 0; d < drops; d++) {   // ink droplets thrown off the tip
              var r1 = I.bakeRng(si * 50 + d)(), ang = Math.atan2(st.p[5] - st.p[3], st.p[4] - st.p[2]) + (r1 - 0.5) * 1.2;
              var dist = 3 + (f - 2) * (2 + r1 * 2.2);
              b.rect(ox + tip[0] + Math.cos(ang) * dist, oy + tip[1] + Math.sin(ang) * dist + (f - 2) * (f - 2) * 0.12, d % 2 ? 1 : 2, 1, L[3 + (f > 6 ? 1 : 0)]);
            }
          } else {
            var q = f - 9, m2 = new I.Buf(96, 80), kb = b;
            b = m2; body(0.78 + q * 0.03, 1, 0.45, L[4], L[4], L[3], true); b = kb;
            m2.breakup(0.55 - q * 0.08, q, 1); b.blit(m2, 0, 0);
          }
        });
      });

      // SEALS — 26f: white pop (f0), stamp holds, then dither-dissolves
      C.seal = {};
      ['五', '七'].forEach(function (ch) {
        var mask = I.sealMask(ch), mw = mask.w, mh = mask.h, SZ = Math.max(mw, mh) + 4;
        C.seal[ch] = I.anim(SZ + 4, SZ + 4, 26, (SZ + 4) / 2, (SZ + 4) / 2, function (b, f) {
          var o = 2, x0 = o, y0 = o;
          if (f === 0) { b.rect(x0 - 2, y0 - 2, SZ + 4, SZ + 4, S[0]); return; }
          var m = new I.Buf(SZ + 4, SZ + 4);
          m.rect(x0, y0, SZ, SZ, S[1]);
          m.rect(x0, y0, SZ, 1, S[2]); m.rect(x0, y0 + SZ - 1, SZ, 1, S[2]); m.rect(x0, y0, 1, SZ, S[2]); m.rect(x0 + SZ - 1, y0, 1, SZ, S[2]);
          m.set(x0, y0, 0); m.set(x0 + SZ - 1, y0 + SZ - 1, 0);      // worn stamp corners
          var gx = x0 + Math.floor((SZ - mw) / 2), gy = y0 + Math.floor((SZ - mh) / 2);
          for (var y = 0; y < mh; y++) for (var x = 0; x < mw; x++) if (mask.d[y * mw + x]) m.set(gx + x, gy + y, S[0]);
          if (f === 1) m.outline(S[0]);
          if (f > 18) m.breakup(1 - (f - 18) / 8, 0, f);
          b.blit(m, 0, 0);
        });
      });

      // SHARDS (hex panel fragments): 8 rotations of 2 shapes
      C.shard = [5, 3].map(function (sz, si) {
        return I.anim(sz * 2 + 2, sz * 2 + 2, 8, sz + 1, sz + 1, function (b, f) {
          var a = f * PI / 4, cx = sz + 1, cy = sz + 1, pts = [];
          var shape = si === 0 ? [[1, 0], [-0.6, 0.85], [-0.7, -0.6]] : [[1, 0.2], [-0.8, 0.7], [-0.4, -0.9], [0.6, -0.7]];
          for (var i = 0; i < shape.length; i++) {
            var x = shape[i][0] * sz, y = shape[i][1] * sz;
            pts.push(cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a));
          }
          b.poly(pts, L[2]);
          b.line(pts[0], pts[1], pts[2], pts[3], L[0]);
          b.outline(L[4]);
        });
      });

      // PAGES — 8 flutter frames (turning around the vertical axis), 9x11
      C.page = I.anim(11, 13, 8, 5.5, 6.5, function (b, f) {
        var widths = [7, 6, 4, 1, 4, 6, 7, 6], w = widths[f], back = f >= 3 && f <= 5;
        var x0 = Math.round(5.5 - w / 2), skew = f < 3 ? 1 : f > 5 ? -1 : 0;
        for (var y = 0; y < 9; y++) {
          var sx = x0 + (y < 3 ? skew : y > 6 ? -skew : 0);
          b.rect(sx, 2 + y, w, 1, back ? P[2] : P[0]);
          if (w > 1) { b.set(sx + w - 1, 2 + y, P[2]); }
        }
        if (!back && w >= 4) for (var ln = 0; ln < 3; ln++) b.rect(x0 + 1, 4 + ln * 2, w - 2 - (ln === 2 ? 2 : 0), 1, sc.text.u[ln === 0 ? 0 : 1]);
        b.outline(P[3]);
      });

      // GUARD CATCH flash — the barrier silhouette pops white, 4f (uses guardrail mask from sprites)
    });
  }
  I.onInit('claude', bake);

  // ---- extra kinds: SHARD (rotating sprite frames) and PAGE (flutter) ----------
  I.K_SHARD = I.kind('shard', {
    draw: function (ctx, p, sx, sy) {
      var k = p.age / p.life;
      if (k > 0.75 && (p.age & 1)) return;
      I.drawAnim(ctx, p.A, (Math.floor(p.rot) % 8 + 8) % 8, sx, sy, 1);
    },
    step: function (p) { p.rot += p.vrot; }
  });
  I.K_PAGE = I.kind('page', {
    draw: function (ctx, p, sx, sy) {
      var left = p.life - p.age, f;
      if (left < 6) { f = 3; if (left < 3) return; }       // turns edge-on and vanishes
      else f = Math.floor(p.age * p.b + p.a) % 8;
      I.drawAnim(ctx, p.A, f, sx, sy, 1);
    },
    step: function (p) { p.vx += Math.sin(p.age * 0.11 + p.a) * p.d; }
  });

  // ---- spawn effects -------------------------------------------------------------
  function sc(O) { return I.scheme('claude', O.pal); }
  function lay(O, d) { return O.layer == null ? d : O.layer; }
  var trail = {};   // last sonnetTrail point per palette (for continuous ribbons)

  I.def('claude.sparkCast', function (x, y, O) {
    var s = sc(O), C = CL[O.pal];
    I.anim1(C.cast, x, y, O.facing, lay(O, I.FRONT), 1);
    for (var i = 0; i < I.nOf(5, O); i++) {
      var a = (O.facing > 0 ? 0 : PI) + I.RS() * 0.9;
      var p = I.add(I.K_DOT, x, y, I.FRONT);
      p.vx = Math.cos(a) * I.RR(1, 2.4); p.vy = Math.sin(a) * I.RR(1, 2.4) - 0.3; p.drag = 0.9; p.life = I.RI(10, 16); p.ramp = s.light.css; p.c = 1;
    }
    I.twinkle(x + O.facing * 6, y - 6, 3, 10, s.light.css, I.FRONT, 2);
  }, { desc: 'Clip-star muzzle flash at the pen nib, ring + motes, 10f.', use: 'At anchor `muzzle` on the first active frame of spark / airSpark (when the projectile appears).' });

  I.def('claude.sparkHit', function (x, y, O) {
    var s = sc(O), C = CL[O.pal];
    I.anim1(C.hit, x, y, O.facing, lay(O, I.FRONT), 1);
    I.sparksFan(x, y, O, I.nOf(7, O), 1.4, 2.5, 5, 8, 14, s.light.css, { max: 8 });
    for (var i = 0; i < I.nOf(4, O); i++) {
      var a = I.R() * TAU;
      I.glyphP(x, y, I.pick(I.LETTERS), Math.cos(a) * I.RR(0.8, 2), Math.sin(a) * I.RR(0.8, 2) - 0.8, I.RI(18, 26), s.light.css, I.FRONT).c = 1;
    }
    for (i = 0; i < I.nOf(3, O); i++) { var an = I.R() * TAU; I.twinkle(x + Math.cos(an) * 16, y + Math.sin(an) * 14, 3, 12, s.light.css, I.FRONT, I.RI(3, 8)); }
  }, { desc: 'Clip-star explosion whose rays fly off as star shards, glyphs scatter, 16f.', use: 'Where the spark projectile hits / is blocked / clashes. Facing = projectile direction.' });

  I.def('claude.sonnetTrail', function (x, y, O) {
    var s = sc(O), L = lay(O, I.BACK), key = 'p' + O.pal, last = trail[key], now = I.tick;
    if (last && now - last.t <= 4 && Math.abs(last.x - x) < 40 && Math.abs(last.y - y) < 50) {
      var r = I.add(I.K_RIBBON, x, y, L);
      r.a = last.x; r.b = last.y; r.size = 4; r.life = 14; r.ramp = s.light.css; r.c = 0; r.vy = -0.3;
    }
    trail[key] = { x: x, y: y, t: now };
    var tl = I.textLine(x - O.facing * 4, y + 2, I.RI(3, 5), -0.9, I.RI(20, 26), s.light.css, O.facing, L);
    tl.d = I.RR(3, 7);
    if (I.R() < 0.6) I.glyphP(x + I.RS() * 6, y, I.pick(I.LETTERS), I.RS() * 0.5, -I.RR(0.6, 1.4), I.RI(14, 20), s.light.css, L).d = 0.25;
    if (I.R() < 0.35) I.twinkle(x + I.RS() * 8, y + I.RS() * 8, 2, 10, s.light.css, I.FRONT);
  }, { desc: 'One segment of a rising ribbon: verse line of glyph blocks spiralling up + light ribbon joining consecutive spawns.', use: 'Every 2nd frame of sonnet rise (and fall) at anchor `weapon`; consecutive spawns within 4f are joined.' });

  I.def('claude.haikuSlash', function (x, y, O) {
    var s = sc(O), C = CL[O.pal], idx = ((O.index % 3) + 3) % 3, st = STROKES[idx], f = O.facing;
    I.anim1(C.slash[idx], x, y, f, lay(O, I.FRONT), 1);
    var ch = st.ch, sl = C.seal[ch];
    var p = I.anim1(sl, x + f * st.seal[0], y + st.seal[1], 1, lay(O, I.FRONT), 1, 1);
    p.vy = -0.12;
    var tip = bez(st, 1);
    for (var i = 0; i < I.nOf(4, O); i++) {
      var a = Math.atan2(st.p[5] - st.p[3], (st.p[4] - st.p[2]) * f) + I.RS() * 0.6;
      I.spark(x + tip[0] * f, y + tip[1], a, I.RR(2, 4), I.RI(6, 10), s.light.css, I.FRONT, { max: 6 });
    }
  }, { desc: 'Calligraphic light-brush stroke (index 0 rising / 1 wide sweep / 2 falling) with dry-brush streaks, ink drops and a vermilion 五/七/五 seal, ~16f (seal 26f).', use: 'At the `hip`/`chest` anchor on the first frame of hit1/hit2/hit3 (index 0/1/2), whether or not it connects.' });

  I.def('claude.guardCatch', function (x, y, O) {
    var s = sc(O), C = CL[O.pal], f = O.facing, bx = x + f * 26, cy = y - 30;
    if (A.grFlash) I.anim1(A.grFlash[O.pal], x, y, f, lay(O, I.FRONT), 1);
    I.anim1(A.ringC['claude' + O.pal][1], bx, cy, 1, I.FRONT, 1, 1);
    for (var i = 0; i < I.nOf(18, O); i++) {
      var p = I.add(I.K_SHARD, bx + I.RS() * 10, cy + I.RS() * 26, I.FRONT);
      var a = (f > 0 ? 0 : PI) + I.RS() * 1.6;
      p.A = C.shard[i % 3 ? 1 : 0]; p.vx = Math.cos(a) * I.RR(1, 3.6) + f * 0.6; p.vy = Math.sin(a) * I.RR(1, 3) - 1; p.g = 0.14; p.drag = 0.96;
      p.life = I.RI(16, 26); p.rot = I.R() * 8; p.vrot = I.RS() * 0.6; p.floor = I.GY + 2; p.bounce = 0.3; p.delay = 1;
    }
    I.spark4P(bx - f * 2, cy, s.light.css);
    for (i = 0; i < 5; i++) I.twinkle(bx + I.RS() * 12, cy + I.RS() * 24, 3, 12, s.light.css, I.FRONT, I.RI(1, 8));
  }, { desc: 'Hex barrier pops white and shatters into spinning hex shards + ring, ~26f.', use: 'At the fighter ORIGIN (same point/facing as the claude.guardrail sprite) when the counter catches a strike.' });

  I.def('claude.beamHit', function (x, y, O) {
    var s = sc(O);
    I.spark4P(x, y, s.light.css);
    for (var i = 0; i < I.nOf(3, O); i++) {
      var a = (O.facing > 0 ? 0 : PI) + I.RS() * 1.3;
      I.glyphP(x, y + I.RS() * 8, I.pick(I.LETTERS), Math.cos(a) * I.RR(1, 2.6), Math.sin(a) * I.RR(1, 2) - 0.6, I.RI(12, 18), s.light.css, I.FRONT);
    }
    I.sparksFan(x, y, O, I.nOf(3, O), 1.1, 2.5, 4, 5, 9, s.light.css, { max: 6 });
  }, { desc: 'Light multi-hit tick: white lens cross, glyphs knocked loose, 3 sparks, ~12f.', use: 'At the victim\'s chest on each beam hit (every 3-5 frames). Cheap.' });

  I.def('claude.pages', function (x, y, O) {
    var C = CL[O.pal], n = I.nOf(9, O);
    for (var i = 0; i < n; i++) {
      var p = I.add(I.K_PAGE, x + I.RS() * 6, y + I.RS() * 6, i % 3 ? lay(O, I.BACK) : lay(O, I.FRONT));
      var a = -PI / 2 + I.RS() * 1.5;
      p.A = C.page; p.vx = Math.cos(a) * I.RR(1.5, 3.6); p.vy = Math.sin(a) * I.RR(1.5, 3.4); p.drag = 0.9; p.g = 0.035;
      p.life = I.RI(50, 80); p.a = I.R() * 8; p.b = I.RR(0.25, 0.45); p.d = I.RR(0.05, 0.1); p.pri = 0;
    }
  }, { desc: 'Burst of pages that flutter (turning) and drift down, turning edge-on to vanish, 50-80f.', use: 'From the book at super start, on KO by the super, on Claude\'s win pose. power scales count.' });

  /** White lens cross for beam hits / catches (two-frame anim via twinkle + dots). */
  I.spark4P = function (x, y, rampCss) {
    if (!A.lens) return;
    I.anim1(A.lens, x, y, 1, I.FRONT, 1);
  };
  I.onInit('lens', function () {
    var H = I.N.hot.u;
    A.lens = I.anim(25, 25, 6, 12, 12, function (b, f) {
      var c = 12;
      if (f === 0) { I.spark4(b, c, c, 10, 10, 9, 9, 1, H[0]); b.outline(H[2]); }
      else if (f === 1) { I.spark4(b, c, c, 11, 11, 10, 10, 1, H[1]); b.outline(H[3]); b.rect(c, c, 1, 1, H[0]); }
      else if (f < 4) { I.segs4(b, c, c, [4 + f * 2, 10 + f], [4 + f * 2, 10 + f], [4 + f * 2, 9 + f], [4 + f * 2, 9 + f], H[2 + (f - 2)]); }
      else { b.set(c + 12, c, H[4]); b.set(c - 12, c, H[4]); b.set(c, c + 11, H[4]); b.set(c, c - 11, H[4]); }
    });
  });
})();
