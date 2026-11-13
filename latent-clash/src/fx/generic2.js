/* LATENT CLASH — FX generic: dust, rings, throws, KO, meter, super charge (owned by FX).
 * Dust = lumpy lit puffs (highlight top, dark rim bottom) that grow, then
 * crumble with ordered dither. Rings = eased expanding annuli that thin and
 * break up. KO = the biggest burst in the game. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var A = I.A = I.A || {};

  /**
   * Puff: cloud of 3 lobes, lit from the top. rp = [hi, base, shade, rim].
   * n frames: grows (0..3), then crumbles via dither while lifting 1-2 px.
   */
  function puffAnim(r, n, rp, seed, flat) {
    var S = Math.ceil(r * 2.6) + 4, rng = I.bakeRng(seed);
    var lobes = [{ x: 0, y: 0, r: 1 }, { x: -0.55, y: 0.25, r: 0.7 }, { x: 0.6, y: 0.2, r: 0.66 }, { x: 0.15, y: -0.45, r: 0.6 }];
    for (var i = 1; i < lobes.length; i++) { lobes[i].x += (rng() - 0.5) * 0.2; lobes[i].y += (rng() - 0.5) * 0.2; }
    var fy = flat ? 0.62 : 1;
    return I.anim(S, S, n, S / 2, S / 2 + r * 0.5, function (b, f) {
      var cx = S / 2, cy = S / 2;
      var g = f < 3 ? 0.55 + f * 0.17 : 1 + (f - 3) * 0.03 - Math.max(0, f - n * 0.6) * 0.06;
      var lift = f < 3 ? 0 : Math.min(2, (f - 3) * 0.4);
      var m = new I.Buf(S, S);
      for (var k = 0; k < lobes.length; k++) {
        var L = lobes[k];
        m.ellipse(cx + L.x * r * g, cy + L.y * r * g * fy - lift, L.r * r * g, L.r * r * g * fy, 1);
      }
      var keep = f < 4 ? 1 : 1 - Math.pow((f - 3) / (n - 3), 0.8) * 0.95;
      for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
        if (!m.d[y * S + x]) continue;
        // shading: distance above/below the lobe-centre line
        var up = !m.get(x, y - 2), dn = !m.get(x, y + 1), dn2 = !m.get(x, y + 2);
        var c = up ? rp[0] : dn ? rp[3] : dn2 ? rp[2] : rp[1];
        if (keep < 1 && I.bayer(x, y) >= keep * (up ? 0.8 : 1)) continue;
        b.d[y * S + x] = c;
      }
    });
  }
  I.puffAnim = puffAnim;

  function ringAnim(R, n, rp, flat, thick) {
    var ry = flat ? 0.3 : 1, S = Math.ceil(R * 2 + 6), Sh = Math.ceil(R * 2 * ry + 6);
    return I.anim(S, Sh, n, S / 2, Sh / 2, function (b, f) {
      var k = (f + 1) / n, e = 1 - (1 - k) * (1 - k);
      var r = 3 + (R - 3) * e, th = Math.max(1, (thick || 3) * (1 - k) + 0.6);
      var cx = S / 2, cy = Sh / 2;
      var ci = f === 0 ? 0 : Math.min(rp.length - 1, 1 + Math.floor(k * (rp.length - 1.2)));
      var m = new I.Buf(S, Sh);
      if (flat) m.ellRing(cx, cy, r, r * ry, th * (flat ? 0.6 : 1), rp[ci]);
      else m.ring(cx, cy, r - th, r, rp[ci]);
      if (f < 2 && th > 1.6) { var m2 = new I.Buf(S, Sh); if (flat) m2.ellRing(cx, cy, r, r * ry, 1, rp[0]); else m2.ring(cx, cy, r - 1, r, rp[0]); b.blit(m, 0, 0); b.blit(m2, 0, 0); return; }
      if (k > 0.55) m.breakup(1 - (k - 0.55) * 1.6, f, 0);
      b.blit(m, 0, 0);
    });
  }
  I.ringAnim = ringAnim;

  function bake() {
    var D = I.N.dust.u, Rk = I.N.rock.u, H = I.N.hot.u, Rd = I.N.red.u, G = I.N.gold.u, T = I.N.tech.u, Wh = I.N.white.u;
    var dust = [D[0], D[2], D[3], D[4]];
    A.puff = [puffAnim(3, 9, dust, 1), puffAnim(5, 11, dust, 2), puffAnim(8, 13, dust, 3)];
    A.puffFlat = [puffAnim(4, 10, dust, 4, true), puffAnim(7, 12, dust, 5, true)];
    A.ringW = [ringAnim(14, 9, [Wh[0], G[1], G[2], G[3], G[4]]), ringAnim(26, 11, [Wh[0], G[1], G[2], G[3], G[4]]), ringAnim(42, 13, [Wh[0], G[1], G[3], G[4], G[5]], false, 4)];
    A.ringG = [ringAnim(22, 10, [D[0], D[1], D[2], D[3]], true), ringAnim(40, 12, [Wh[0], D[0], D[1], D[2], D[3]], true, 4)];
    A.ringC = {}; A.ringGC = {};
    ['claude', 'deepseek'].forEach(function (ch) {
      [0, 1].forEach(function (p) {
        var sc = I.scheme(ch, p), r = ch === 'claude' ? sc.light.u : sc.water.u;
        var rr = [r[0], r[1], r[2], r[3], r[4]];
        A.ringC[ch + p] = [ringAnim(14, 9, rr), ringAnim(26, 11, rr), ringAnim(42, 13, rr, false, 4)];
        A.ringGC[ch + p] = [ringAnim(22, 10, rr, true), ringAnim(40, 12, rr, true, 4)];
      });
    });

    // THROW TECH — 14f: two crossing slashes ("X") + violet ring: both grabs bounce off.
    A.tech = I.anim(56, 48, 14, 28, 24, function (b, f) {
      var cx = 28, cy = 24;
      if (f === 0) {
        b.ray(cx, cy, -0.7, -22, 22, 2.4, 0.5, Wh[0]); b.ray(cx, cy, 0.7, -22, 22, 2.4, 0.5, Wh[0]);
        b.star4(cx, cy, 9, 11, 3, Wh[0]); b.outline(T[3]); b.outline(T[5]);
      } else if (f < 3) {
        var k = f;
        b.ray(cx, cy, -0.7, -22 - k * 2, 22 + k * 2, 1.8, 0.4, T[2]); b.ray(cx, cy, 0.7, -22 - k * 2, 22 + k * 2, 1.8, 0.4, T[2]);
        b.ray(cx, cy, -0.7, -16, 16, 0.7, 0.2, Wh[0]); b.ray(cx, cy, 0.7, -16, 16, 0.7, 0.2, Wh[0]);
        b.ring(cx, cy, 6 + k * 3, 8 + k * 3, T[1]); b.outline(T[5]);
      } else if (f < 9) {
        var q = f - 3, m = new I.Buf(56, 48);
        m.ray(cx, cy, -0.7, 10 + q * 3, 26 + q * 1.5, 0.5, 1.4 - q * 0.15, T[2 + (q >> 1)]); m.ray(cx, cy, -0.7 + PI, 10 + q * 3, 26 + q * 1.5, 0.5, 1.4 - q * 0.15, T[2 + (q >> 1)]);
        m.ray(cx, cy, 0.7, 10 + q * 3, 26 + q * 1.5, 0.5, 1.4 - q * 0.15, T[2 + (q >> 1)]); m.ray(cx, cy, 0.7 + PI, 10 + q * 3, 26 + q * 1.5, 0.5, 1.4 - q * 0.15, T[2 + (q >> 1)]);
        m.ring(cx, cy, 13 + q * 2.4, 14 + q * 2.4, T[2 + (q >> 1)]);
        if (q > 2) m.breakup(1 - (q - 2) * 0.22, q, 0);
        b.blit(m, 0, 0);
      } else {
        I.dots(b, cx, cy, I.makeRays(5, 8, 20, 0, 0.3), 1.3 + (f - 9) * 0.06, 1, T[4 + (f > 11 ? 1 : 0)], f > 11 ? 2 : 1);
      }
    });

    // THROW SLAM — 18f, 96x48, origin at floor: flattened impact star + floor cracks.
    var rs = I.makeRays(71, 9, 14, 0, 0.5);
    A.slam = I.anim(96, 48, 18, 48, 40, function (b, f) {
      var cx = 48, cy = 39;
      function flatStar(sc, ri, c) {
        var angs = [], rads = [];
        for (var i = 0; i < rs.length; i++) { var a = PI + (i / (rs.length - 1)) * PI; angs.push(a); rads.push(rs[i].len * sc * (0.6 + Math.abs(Math.cos(a)) * 1.2)); }
        var pts = [];
        for (i = 0; i < angs.length; i++) {
          pts.push(cx + Math.cos(angs[i]) * rads[i], cy + Math.sin(angs[i]) * rads[i] * 0.8);
          if (i < angs.length - 1) { var mm = (angs[i] + angs[i + 1]) / 2; pts.push(cx + Math.cos(mm) * ri * 1.6, cy + Math.sin(mm) * ri); }
        }
        pts.push(cx + rads[rads.length - 1], cy + 1, cx - rads[0], cy + 1);
        b.poly(pts, c);
      }
      function cracks(len, c) {
        var rng = I.bakeRng(9);
        for (var s = -1; s <= 1; s += 2) {
          var x = cx, y = cy + 1;
          for (var i = 0; i < len; i++) { x += s; if (rng() < 0.3) y += rng() < 0.5 ? 1 : 0; if (y > cy + 5) y = cy + 3; b.set(x, y, c); if (rng() < 0.12) b.set(x, y + 1, c); }
        }
      }
      if (f === 0) { flatStar(1.15, 5, H[0]); b.rect(cx - 40, cy, 80, 2, H[0]); b.outline(H[3]); b.outline(H[5]); }
      else if (f === 1) { flatStar(1.25, 6, H[2]); flatStar(0.8, 4, H[0]); b.rect(cx - 44, cy, 88, 1, H[1]); b.outline(H[4]); cracks(16, Rk[4]); }
      else if (f < 6) {
        var k = f - 2;
        var m = new I.Buf(96, 48);
        for (var i = 0; i < rs.length; i++) {
          var a = PI + (i / (rs.length - 1)) * PI, L = rs[i].len * (0.6 + Math.abs(Math.cos(a)) * 1.2);
          m.ray(cx, cy, a, L * (0.4 + k * 0.2), L * (1.15 + k * 0.1), 0.4, 1.6 - k * 0.3, H[2 + (k >> 1)]);
        }
        m.rect(cx - 30 - k * 4, cy, 12, 1, H[2 + (k >> 1)]); m.rect(cx + 18 + k * 4, cy, 12, 1, H[2 + (k >> 1)]);
        b.blit(m, 0, 0); cracks(18 + k * 3, Rk[4]); if (k < 2) b.outline(H[5]);
      } else {
        var q = f - 6; cracks(Math.max(0, 30 - q * 3), q < 6 ? Rk[4] : Rk[3]);
        if (q < 4) for (i = 0; i < rs.length; i += 2) { var a2 = PI + (i / (rs.length - 1)) * PI; b.set(cx + Math.cos(a2) * (24 + q * 3), cy + Math.sin(a2) * (16 + q * 2), H[4]); }
      }
    });

    // KO BURST — 26 frames (played at 2 ticks each), 176x150.
    var rk = I.makeRays(97, 16, 42, 14, 0.6);
    A.ko = I.anim(204, 176, 26, 102, 88, function (b, f) {
      var cx = 102, cy = 88;
      if (f === 0) {
        I.starOf(b, cx, cy, rk, 1.2, 12, Wh[0]); b.disc(cx, cy, 18, Wh[0]); b.outline(G[3]); b.outline(Rd[4]);
      } else if (f === 1) {
        I.starOf(b, cx, cy, rk, 1.3, 13, Rd[3]); I.starOf(b, cx, cy, rk, 1.0, 10, Wh[0]);
        b.disc(cx, cy, 22, Wh[0]); b.disc(cx, cy, 18, Rd[6]); b.ring(cx, cy, 10, 12, Rd[4]);
        b.outline(Rd[5]);
      } else if (f === 2) {
        I.starOf(b, cx, cy, rk, 1.35, 14, G[2]); I.starOf(b, cx, cy, rk, 1.0, 11, Wh[0]);
        b.disc(cx, cy, 16, Wh[0]); b.ring(cx, cy, 22, 26, G[1]); b.outline(Rd[4]);
      } else if (f < 9) {
        var k = f - 3;
        I.streaks(b, cx, cy, rk, 0.6 + k * 0.13, 1.4 + k * 0.08, 2.6 - k * 0.3, k < 2 ? G[1] : k < 4 ? G[2] : H[3], 1);
        b.ring(cx, cy, 26 + k * 6, 30 + k * 5.4, k < 2 ? Wh[0] : k < 4 ? G[2] : H[4]);
        var m = new I.Buf(204, 176); m.ring(cx, cy, 14 + k * 4.5, 16 + k * 4.4, Rd[2 + (k >> 1)]); if (k > 2) m.breakup(1 - (k - 2) * 0.2); b.blit(m, 0, 0);
        if (k < 3) { b.disc(cx, cy, 12 - k * 4, Wh[0]); b.outline(Rd[5]); }
      } else if (f < 17) {
        var q = f - 9, m2 = new I.Buf(204, 176);
        m2.ring(cx, cy, 62 + q * 2.4, 64 + q * 2.2, H[3 + (q > 3 ? 1 : 0)]); m2.breakup(0.8 - q * 0.09, q, 0); b.blit(m2, 0, 0);
        var m3 = new I.Buf(204, 176); m3.ring(cx, cy, 42 + q * 3, 43 + q * 3, Rd[3 + (q > 4 ? 1 : 0)]); m3.breakup(0.7 - q * 0.08, 0, q); b.blit(m3, 0, 0);
        I.streaks(b, cx, cy, rk, 1.5 + q * 0.05, 1.72 + q * 0.04, 1.2 - q * 0.1, q < 4 ? H[3] : H[4], 1);
      } else {
        I.dots(b, cx, cy, rk, 1.9 + (f - 17) * 0.04, f < 21 ? 2 : 1, f < 21 ? H[4] : Rd[5], f < 23 ? 1 : 2);
      }
    });

    // super.charge core: pulsing orb that grows (24f) — neutral gold + per-char variants
    function orb(rp) {
      return I.anim(40, 40, 24, 20, 20, function (b, f) {
        var r = 2.5 + f * 0.36 + (f & 2 ? 1 : 0), cx = 20, cy = 20;
        b.disc(cx, cy, r + 2, rp[3]); b.disc(cx, cy, r + 1, rp[2]); b.disc(cx, cy, r, rp[1]); b.disc(cx, cy, r * 0.55, rp[0]);
        var m = new I.Buf(40, 40); m.ring(cx, cy, r + 3, r + 4.5, rp[2]); m.breakup(0.5, f, 0); b.blit(m, 0, 0);
        if (f & 1) { b.rect(cx - r - 5, cy, 3, 1, rp[1]); b.rect(cx + r + 3, cy, 3, 1, rp[1]); b.rect(cx, cy - r - 5, 1, 3, rp[1]); b.rect(cx, cy + r + 3, 1, 3, rp[1]); }
      });
    }
    A.orb = orb([Wh[0], G[1], G[3], G[4]]);
    A.orbC = {
      claude0: orb(sl(I.scheme('claude', 0).light.u)), claude1: orb(sl(I.scheme('claude', 1).light.u)),
      deepseek0: orb(sl(I.scheme('deepseek', 0).water.u)), deepseek1: orb(sl(I.scheme('deepseek', 1).water.u))
    };
    function sl(u) { return [u[0], u[1], u[2], u[4]]; }
  }
  I.onInit('generic2', bake);

  // ---------------------------------------------------------------------------
  var nOf = function (b, O) { return I.nOf(b, O); };
  function lay(O, d) { return O.layer == null ? d : O.layer; }
  function puff(Aa, x, y, vx, vy, layer, fd, delay) {
    var p = I.anim1(Aa, x, y, 1, layer, fd || 2, delay);
    p.vx = vx; p.vy = vy; p.drag = 0.86; p.facing = vx < 0 ? -1 : 1;
    return p;
  }
  function motes(x, y, n, spread, rampCss, life, layer) {
    for (var i = 0; i < n; i++) {
      var p = I.add(I.K_DOT, x + I.RS() * spread, y - I.R() * 3, layer);
      p.vx = I.RS() * 1.2; p.vy = -I.RR(0.6, 1.8); p.g = 0.06; p.drag = 0.95; p.life = life + I.RI(-3, 4); p.ramp = rampCss; p.size = 1; p.c = 1;
    }
  }
  function charRing(O) { return O.char ? A.ringC[O.char + O.pal] : A.ringW; }

  I.def('dust.jump', function (x, y, O) {
    var L = lay(O, I.FRONT);
    puff(A.puff[1], x - 5, y, -0.9, -0.15, L, 2); puff(A.puff[1], x + 5, y, 0.9, -0.15, L, 2);
    puff(A.puff[0], x, y - 1, 0, -0.5, L, 2, 1);
    motes(x, y, nOf(4, O), 6, I.N.dust.css, 14, L);
  }, { desc: 'Two small puffs kicked sideways + motes, ~22f.', use: 'At the take-off origin on the first airborne frame.' });

  I.def('dust.land', function (x, y, O) {
    var L = lay(O, I.FRONT);
    I.anim1(A.ringG[0], x, y, 1, I.BACK, 1);
    puff(A.puffFlat[0], x - 6, y, -1.5, 0, L, 2); puff(A.puffFlat[0], x + 6, y, 1.5, 0, L, 2);
    if (O.power > 0.5) { puff(A.puff[0], x - 12, y, -1.0, -0.2, L, 2, 2); puff(A.puff[0], x + 12, y, 1.0, -0.2, L, 2, 2); }
    motes(x, y, nOf(3, O), 10, I.N.dust.css, 12, L);
  }, { desc: 'Flat puffs spreading both ways + floor ring, ~20f.', use: 'At the landing origin on the landing frame (power 0.3 for small hops).' });

  I.def('dust.dash', function (x, y, O) {
    var L = lay(O, I.FRONT), b = -O.facing;
    puff(A.puff[1], x + b * 6, y, b * 1.6, -0.3, L, 2); puff(A.puff[0], x + b * 13, y, b * 1.1, -0.5, L, 2, 2);
    puff(A.puffFlat[0], x + b * 2, y, b * 0.6, 0, L, 2, 4);
    for (var i = 0; i < nOf(3, O); i++) I.spark(x + b * I.RI(2, 8), y - I.RI(1, 6), b > 0 ? 0 : PI, I.RR(3, 5), I.RI(6, 9), I.N.dust.css, L, { max: 10, len: 2.2, drag: 0.8 });
    motes(x + b * 4, y, nOf(3, O), 4, I.N.dust.css, 12, L);
  }, { desc: 'Puffs + speed streaks behind the feet, ~24f.', use: 'At the origin on the first dash frame; facing = dash direction.' });

  I.def('dust.skid', function (x, y, O) {
    var L = lay(O, I.FRONT), b = -O.facing;
    puff(A.puff[0], x + b * 3, y, b * 0.5, -0.4, L, 2);
    motes(x, y, nOf(2, O), 3, I.N.dust.css, 10, L);
  }, { desc: 'Tiny puff + motes (extra).', use: 'Every ~6 frames while sliding in block/hit push-back; facing = slide direction.' });

  I.def('dust.down', function (x, y, O) {
    var L = lay(O, I.FRONT);
    I.anim1(A.ringG[1], x, y, 1, I.BACK, 1);
    puff(A.puff[2], x - 12, y, -1.4, -0.3, L, 2); puff(A.puff[2], x + 12, y, 1.4, -0.3, L, 2);
    puff(A.puff[1], x - 26, y, -1.1, -0.1, L, 2, 2); puff(A.puff[1], x + 26, y, 1.1, -0.1, L, 2, 2);
    puff(A.puffFlat[1], x, y, 0, 0, L, 2, 1);
    for (var i = 0; i < nOf(7, O); i++) {
      var a = -PI / 2 + I.RS() * 1.2, v = I.RR(1.8, 3.6);
      I.chip(x + I.RS() * 16, y - 2, Math.cos(a) * v, Math.sin(a) * v, I.RI(24, 34), I.N.rock.css, I.RI(1, 2), L);
    }
    motes(x, y, nOf(6, O), 20, I.N.dust.css, 18, L);
  }, { desc: 'Heavy knockdown: big puffs both sides, floor ring, bouncing rubble, ~36f.', use: 'At the origin on the frame the body hits the floor (down: impact).' });

  I.def('ring', function (x, y, O) {
    var set = charRing(O), i = O.power <= 0.4 ? 0 : O.power <= 0.75 ? 1 : 2;
    I.anim1(set[i], x, y, 1, lay(O, I.FRONT), 1);
  }, { desc: 'Expanding shockwave ring; power picks size (14/26/42 px); opts.char tints it.', use: 'Generic accent: clashes, bounces, super start.' });

  I.def('ring.ground', function (x, y, O) {
    var set = O.char ? A.ringGC[O.char + O.pal] : A.ringG, i = O.power <= 0.6 ? 0 : 1;
    I.anim1(set[i], x, y, 1, lay(O, I.BACK), 1);
  }, { desc: 'Flat elliptical ring along the floor (extra).', use: 'Heavy landings, wall/ground bounces, super landing.' });

  I.def('sparkle', function (x, y, O) {
    var rc = O.char === 'claude' ? I.scheme('claude', O.pal).gold.css : O.char === 'deepseek' ? I.scheme('deepseek', O.pal).glow.css : I.N.gold.css;
    I.twinkle(x, y, 3 + Math.round(O.power * 2), 14, rc, lay(O, I.FRONT));
  }, { desc: 'Single 4-point twinkle (extra).', use: 'Glints: pen nib, menu-ish accents, perfect round.' });

  I.def('throw.tech', function (x, y, O) {
    I.anim1(A.tech, x, y, 1, lay(O, I.FRONT), 1);
    for (var i = 0; i < nOf(10, O); i++) {
      var a = (i % 2 ? 0 : PI) + I.RS() * 0.9;
      I.spark(x, y, a, I.RR(2.5, 4.5), I.RI(8, 13), I.N.tech.css, I.FRONT, { max: 8 });
    }
  }, { desc: 'Crossed white slashes "X" + violet ring, sparks both ways, 14f.', use: 'At the midpoint between both chests when a throw is teched.' });

  I.def('throw.slam', function (x, y, O) {
    var L = lay(O, I.FRONT);
    I.anim1(A.slam, x, y, 1, L, 1);
    I.anim1(A.ringG[1], x, y, 1, I.BACK, 1);
    puff(A.puff[2], x - 16, y, -1.6, -0.2, L, 2, 2); puff(A.puff[2], x + 16, y, 1.6, -0.2, L, 2, 2);
    puff(A.puff[1], x - 30, y, -1, -0.1, L, 2, 4); puff(A.puff[1], x + 30, y, 1, -0.1, L, 2, 4);
    for (var i = 0; i < nOf(9, O); i++) {
      var a = -PI / 2 + I.RS() * 1.0, v = I.RR(2.4, 4.6);
      I.chip(x + I.RS() * 10, y - 2, Math.cos(a) * v, Math.sin(a) * v, I.RI(26, 38), I.N.rock.css, I.RI(1, 3), L);
    }
    for (i = 0; i < nOf(6, O); i++) I.spark(x, y - 2, PI + I.R() * PI, I.RR(3, 5), I.RI(8, 12), I.N.hot.css, L, { max: 7 });
  }, { desc: 'Floor impact: flattened white star, floor cracks, rubble, big dust, ~40f.', use: 'At the victim’s landing point (floor) when the throw slams.' });

  I.def('ko.burst', function (x, y, O) {
    I.anim1(A.ko, x, y, O.facing, lay(O, I.FRONT), 2);
    var a0 = O.facing > 0 ? 0 : PI;
    for (var s = -1; s <= 1; s += 2) for (var k = 0; k < 2; k++) {
      var p = I.spark(x, y + (k ? 4 : -4) * s, s > 0 ? 0 : PI, I.RR(11, 14), 14, I.N.gold.css, I.FRONT, { max: 70, len: 7, drag: 0.86 });
      p.delay = 1;
    }
    for (var i = 0; i < nOf(26, O); i++) {
      var a = a0 + I.RS() * 2.6, v = I.RR(2, 7.5);
      I.spark(x, y, a, v, I.RI(18, 34), i % 3 ? I.N.hot.css : I.N.red.css, I.FRONT, { g: 0.08, max: 10, size: i % 2 + 1, drag: 0.93 });
    }
    for (i = 0; i < nOf(10, O); i++) {
      var an = I.R() * TAU, r = I.RR(30, 70);
      I.twinkle(x + Math.cos(an) * r, y + Math.sin(an) * r * 0.7, I.RI(3, 5), I.RI(16, 24), I.N.gold.css, I.FRONT, I.RI(6, 24));
    }
    for (i = 0; i < nOf(10, O); i++) {
      var q = I.add(I.K_DOT, x, y, I.FRONT), aa = I.R() * TAU;
      q.vx = Math.cos(aa) * I.RR(1, 4); q.vy = Math.sin(aa) * I.RR(1, 4) - 2; q.g = 0.15; q.life = I.RI(30, 46); q.size = 2; q.ramp = I.N.gold.css; q.c = 1; q.e = 1;
      q.floor = I.GY + 2; q.bounce = 0.35;
    }
  }, { desc: 'Huge white burst, red inversion, 3 rings, screen-wide flash lines, embers & twinkles, ~52f.', use: 'At the final hit’s contact point on the KO frame (plays fine under KO slow-mo).' });

  I.def('meter.full', function (x, y, O) {
    var rc = O.char ? (O.char === 'claude' ? I.scheme('claude', O.pal).gold.css : I.scheme('deepseek', O.pal).glow.css) : I.N.gold.css;
    I.anim1(A.ringW[1], x, y, 1, I.FRONT, 1);
    for (var i = 0; i < nOf(9, O); i++) {
      var p = I.twinkle(x + I.RS() * 18, y + I.RS() * 30, I.RI(2, 4), I.RI(12, 18), rc, I.FRONT, I.RI(0, 18));
      p.vy = -0.35;
    }
    for (i = 0; i < nOf(8, O); i++) {
      var q = I.add(I.K_DOT, x + I.RS() * 16, y + I.RR(0, 30), I.FRONT);
      q.vy = -I.RR(0.8, 1.6); q.life = I.RI(16, 26); q.ramp = rc; q.size = 1; q.delay = I.RI(0, 12);
    }
  }, { desc: 'Gold ring pulse + twinkles and rising motes over the body, ~36f.', use: 'At the fighter’s `center` anchor when the gauge reaches 100.' });

  I.def('super.charge', function (x, y, O) {
    var sc = O.char ? I.scheme(O.char, O.pal) : null;
    var rc = sc ? (O.char === 'claude' ? sc.light.css : sc.water.css) : I.N.gold.css;
    var orb = sc ? A.orbC[O.char + O.pal] : A.orb;
    I.anim1(orb, x, y, 1, I.FRONT, 1);
    var e = I.emitter(function (p) {
      if (p.age > 20) return;
      for (var k = 0; k < 3; k++) {
        var a = I.R() * TAU, r = I.RR(34, 64), v = I.RR(4.5, 7);
        var s = I.spark(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.85, a + PI, v, Math.max(3, Math.floor((r - 8) / v)), p.ref, I.FRONT, { drag: 1, max: 14, len: 2.6, size: 2 });
        s.age = 1; s.life += 1;
      }
    }, x, y, 24, I.FRONT);
    e.ref = rc;
    var fl = I.anim1(sc ? A.ringC[O.char + O.pal][2] : A.ringW[2], x, y, 1, I.FRONT, 1, 22);
    fl.pri = 1;
    for (var i = 0; i < 6; i++) I.twinkle(x + I.RS() * 12, y + I.RS() * 12, 3, 12, rc, I.FRONT, 20 + i);
  }, { desc: 'Streaks converge on a growing orb for 24f, then a ring pops, ~36f. opts.char tints.', use: 'At the chest when the super starts (keep calling fx.update during the super flash).' });
})();
