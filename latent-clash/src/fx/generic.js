/* LATENT CLASH — FX generic hits & blocks (owned by FX).
 * Shape language: HITS = radial warm starbursts (white-hot core -> yellow ->
 * orange -> red), escalating in size / ray count / rings / duration.
 * BLOCKS = cool blue-white crescents "(" bulging toward the attacker that
 * crack into segments and shed chips. Distinguishable in one frame.
 * All frames are baked facing right; opts.facing mirrors (attacker's facing). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};

  var PI = Math.PI, TAU = PI * 2;
  var A = I.A = I.A || {};   // baked anims, shared between fx files

  /** Irregular ray set; forward (+x) rays are longer. */
  function makeRays(seed, n, len, fwd, jit) {
    var rng = I.bakeRng(seed), rays = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * TAU + (rng() - 0.5) * (TAU / n) * jit;
      var c = Math.cos(a);
      var L = len * (0.62 + rng() * 0.38) + fwd * Math.max(0, c) * Math.max(0, c);
      if (i % 2) L *= 0.72;
      rays.push({ a: a, len: L, w: 1 + rng() * 0.8 });
    }
    return rays;
  }
  function starOf(buf, cx, cy, rays, scale, ri, c) {
    var angs = [], rads = [];
    for (var i = 0; i < rays.length; i++) { angs.push(rays[i].a); rads.push(rays[i].len * scale); }
    buf.star(cx, cy, angs, rads, ri, c);
  }
  /** Detached tapered ray segments between fractions f0..f1 of each ray's length. */
  function dashes(buf, cx, cy, rays, f0, f1, w, c, minLen) {
    for (var i = 0; i < rays.length; i++) {
      var r = rays[i], r0 = r.len * f0, r1 = r.len * f1;
      if (r1 - r0 < (minLen || 1)) r0 = r1 - (minLen || 1);
      buf.ray(cx, cy, r.a, r0, r1, w * r.w, 0.3, c);
    }
  }
  function dots(buf, cx, cy, rays, f, size, c, every) {
    for (var i = 0; i < rays.length; i += (every || 1)) {
      var r = rays[i];
      buf.rect(Math.round(cx + Math.cos(r.a) * r.len * f - size / 2), Math.round(cy + Math.sin(r.a) * r.len * f - size / 2), size, size, c);
    }
  }
  I.makeRays = makeRays; I.starOf = starOf; I.dashes = dashes; I.dots = dots;
  /** Outward-flying streaks: thin tail at f0, thick head at f1 (every `step`-th ray). */
  function streaks(buf, cx, cy, rays, f0, f1, w, c, step) {
    for (var i = 0; i < rays.length; i += (step || 1)) {
      var r = rays[i];
      buf.ray(cx, cy, r.a, r.len * f0, r.len * f1, 0.3, Math.max(0.5, w * r.w * 0.6), c);
    }
  }
  /** 1-px 4-arm lens spark (arm lengths right/left/up/down) with a diamond core. */
  function spark4(buf, cx, cy, ar, al, au, ad, core, c) {
    buf.rect(cx - al, cy, ar + al + 1, 1, c); buf.rect(cx, cy - au, 1, au + ad + 1, c);
    for (var dy = -core; dy <= core; dy++) for (var dx = -core; dx <= core; dx++) if (Math.abs(dx) + Math.abs(dy) <= core) buf.set(cx + dx, cy + dy, c);
  }
  /** Detached 4-arm segments: each arg = [from, to] distance. */
  function segs4(buf, cx, cy, r, l, u, d, c) {
    buf.rect(cx + r[0], cy, r[1] - r[0] + 1, 1, c); buf.rect(cx - l[1], cy, l[1] - l[0] + 1, 1, c);
    buf.rect(cx, cy - u[1], 1, u[1] - u[0] + 1, c); buf.rect(cx, cy + d[0], 1, d[1] - d[0] + 1, c);
  }
  I.streaks = streaks; I.spark4 = spark4; I.segs4 = segs4;

  // ---------------------------------------------------------------------------
  // HIT SPARKS
  function bakeHits() {
    var H = I.N.hot.u, R = I.N.red.u;

    // LIGHT — 8f, 28x20. Crisp 4-arm lens spark (1-px arms + rim), long forward arm.
    A.hitL = I.anim(28, 20, 8, 11, 10, function (b, f) {
      var cx = 11, cy = 10;
      if (f === 0) {
        spark4(b, cx, cy, 11, 6, 5, 5, 1, H[0]); b.outline(H[3]); b.rect(cx - 1, cy - 1, 3, 3, H[0]);
      } else if (f === 1) {
        spark4(b, cx, cy, 13, 7, 6, 6, 1, H[1]); b.outline(H[3]); b.rect(cx, cy, 1, 1, H[0]);
        b.rect(cx - 1, cy, 3, 1, H[0]); b.rect(cx, cy - 1, 1, 3, H[0]);
      } else if (f === 2) {
        segs4(b, cx, cy, [4, 13], [3, 7], [3, 6], [3, 6], H[2]); b.outline(H[4]);
      } else if (f === 3) {
        segs4(b, cx, cy, [8, 14], [5, 8], [5, 7], [5, 7], H[3]);
      } else {
        var k = f - 4, c = k < 2 ? H[3] : H[4];
        b.rect(cx + 14 + k, cy, k < 2 ? 2 : 1, 1, c); b.rect(cx - 8 - k, cy, 1, 1, c);
        b.rect(cx, cy - 7 - k, 1, 1, c); b.rect(cx, cy + 7 + k, 1, 1, c);
        if (k < 2) { b.set(cx + 6 + k, cy - 5 - k, H[4]); b.set(cx + 6 + k, cy + 5 + k, H[4]); }
      }
    });

    // MEDIUM — 12f, 40x34. 8 irregular rays, small ring.
    var rm = makeRays(11, 8, 11, 7, 0.5);
    A.hitM = I.anim(40, 34, 12, 17, 17, function (b, f) {
      var cx = 17, cy = 17;
      if (f === 0) {
        starOf(b, cx, cy, rm, 1, 3.2, H[0]); b.disc(cx, cy, 3.5, H[0]); b.outline(H[3]);
      } else if (f === 1) {
        starOf(b, cx, cy, rm, 1.12, 3.4, H[2]);
        starOf(b, cx, cy, rm, 0.7, 2.4, H[1]);
        b.disc(cx, cy, 4, H[0]); b.outline(H[4]);
      } else if (f === 2) {
        streaks(b, cx, cy, rm, 0.45, 1.16, 1.5, H[2], 1);
        b.ring(cx, cy, 3.4, 5.6, H[0]); b.outline(H[4]);
      } else if (f === 3) {
        streaks(b, cx, cy, rm, 0.72, 1.24, 1.1, H[2], 1);
        b.ring(cx, cy, 6.4, 7.8, H[1]); b.outline(H[4]);
      } else if (f === 4) {
        streaks(b, cx, cy, rm, 0.92, 1.28, 0.9, H[3], 1);
        var rb = new I.Buf(40, 34); rb.ring(cx, cy, 9, 10.2, H[3]); rb.breakup(0.72); b.blit(rb, 0, 0);
      } else if (f === 5) {
        streaks(b, cx, cy, rm, 1.08, 1.3, 0.7, H[4], 2);
        var rc = new I.Buf(40, 34); rc.ring(cx, cy, 11, 12, H[4]); rc.breakup(0.4); b.blit(rc, 0, 0);
      } else if (f < 9) {
        dots(b, cx, cy, rm, 1.3 + (f - 6) * 0.05, f === 6 ? 2 : 1, f < 8 ? H[3] : H[4], 1);
      } else {
        dots(b, cx, cy, rm, 1.44 + (f - 9) * 0.04, 1, H[5], f === 11 ? 3 : 2);
      }
    });

    // HEAVY — 16f, 64x52. Big white star, inverted impact frame, ring, long rays.
    var rh = makeRays(23, 10, 15, 14, 0.55);
    A.hitH = I.anim(64, 52, 16, 28, 26, function (b, f) {
      var cx = 28, cy = 26;
      if (f === 0) {
        starOf(b, cx, cy, rh, 1, 5.5, H[0]); b.disc(cx, cy, 7, H[0]); b.outline(H[3]); b.outline(H[5]);
      } else if (f === 1) {
        starOf(b, cx, cy, rh, 1.12, 6, H[2]);
        starOf(b, cx, cy, rh, 0.78, 4.5, H[0]);
        b.disc(cx, cy, 8.5, H[0]); b.disc(cx, cy, 6.5, H[6]);
        b.set(cx - 3, cy - 3, H[5]); b.set(cx - 2, cy - 4, H[5]); b.set(cx - 4, cy - 2, H[5]);
        b.outline(H[4]);
      } else if (f === 2) {
        streaks(b, cx, cy, rh, 0.5, 1.2, 2.2, H[2], 1);
        streaks(b, cx, cy, rh, 0.56, 1.0, 0.9, H[0], 1);
        b.ring(cx, cy, 8, 11, H[1]); b.disc(cx, cy, 4.5, H[0]); b.outline(H[4]);
      } else if (f === 3) {
        streaks(b, cx, cy, rh, 0.78, 1.26, 1.6, H[2], 1);
        b.ring(cx, cy, 12, 14, H[2]); b.rect(cx - 1, cy - 1, 3, 3, H[1]); b.outline(H[4]);
      } else if (f === 4) {
        streaks(b, cx, cy, rh, 0.94, 1.3, 1.3, H[3], 1);
        var r4 = new I.Buf(64, 52); r4.ring(cx, cy, 15, 16.6, H[2]); r4.breakup(0.8); b.blit(r4, 0, 0);
        b.outline(H[5]);
      } else if (f < 8) {
        var k = f - 5;
        streaks(b, cx, cy, rh, 1.08 + k * 0.08, 1.32 + k * 0.05, 1.1 - k * 0.2, H[3 + (k > 1 ? 1 : 0)], 1);
        var rr = new I.Buf(64, 52); rr.ring(cx, cy, 17.5 + k * 2, 18.6 + k * 2, H[3 + (k > 0 ? 1 : 0)]); rr.breakup(0.6 - k * 0.14, k, 0); b.blit(rr, 0, 0);
      } else if (f < 12) {
        dots(b, cx, cy, rh, 1.42 + (f - 8) * 0.05, f < 10 ? 2 : 1, f < 10 ? H[4] : H[5], 1);
      } else {
        dots(b, cx, cy, rh, 1.62 + (f - 12) * 0.04, 1, H[5 + (f > 13 ? 1 : 0)], 2 + (f > 13 ? 1 : 0));
      }
    });

    // SPECIAL — 18f, 72x60. Compass-star + diamond (rotated square) rings: "magic" geometry.
    function specialAnim(P, C) {   // P = core ramp (hot), C = outer ramp (char-tinted or hot)
      var rs = makeRays(37, 8, 13, 9, 0.18);
      return I.anim(72, 60, 18, 36, 30, function (b, f) {
        var cx = 36, cy = 30;
        function diamond(r, th, c, keep) {
          var d = new I.Buf(72, 60);
          d.poly([cx + r, cy, cx, cy + r * 0.8, cx - r, cy, cx, cy - r * 0.8], c);
          var inner = new I.Buf(72, 60); inner.poly([cx + r - th, cy, cx, cy + (r - th) * 0.8, cx - r + th, cy, cx, cy - (r - th) * 0.8], 1);
          for (var i = 0; i < d.d.length; i++) if (inner.d[i]) d.d[i] = 0;
          if (keep < 1) d.breakup(keep);
          b.blit(d, 0, 0);
        }
        if (f === 0) {
          b.ray(cx, cy, 0, 0, 30, 2.4, 0, P[0]); b.ray(cx, cy, PI, 0, 24, 2.4, 0, P[0]);
          b.ray(cx, cy, PI / 2, 0, 22, 2.4, 0, P[0]); b.ray(cx, cy, -PI / 2, 0, 22, 2.4, 0, P[0]);
          b.star4(cx, cy, 12, 12, 4, P[0]);
          b.outline(C[3]); b.disc(cx, cy, 5, P[0]);
        } else if (f === 1) {
          b.star4(cx, cy, 15, 13, 5, C[2]);
          b.ray(cx, cy, 0, 0, 32, 2, 0, C[1]); b.ray(cx, cy, PI, 0, 26, 2, 0, C[1]);
          b.ray(cx, cy, PI / 2, 0, 23, 1.6, 0, C[1]); b.ray(cx, cy, -PI / 2, 0, 23, 1.6, 0, C[1]);
          b.disc(cx, cy, 7, P[0]); b.disc(cx, cy, 5, C[5]); b.star4(cx, cy, 4, 4, 1, P[0]);
          b.outline(C[4]);
        } else if (f < 7) {
          var k = f - 2;
          diamond(9 + k * 4.2, 2.6 - k * 0.3, k < 2 ? P[0] : C[1 + (k > 3 ? 1 : 0)], 1 - k * 0.1);
          if (k < 4) diamond(5 + k * 2.4, 1.6, C[2 + (k > 1 ? 1 : 0)], 1);
          var rl = 32 + k * 3, rw = 1.6 - k * 0.25;
          b.ray(cx, cy, 0, 6 + k * 5, rl, rw, 0, C[1]); b.ray(cx, cy, PI, 6 + k * 5, rl - 6, rw, 0, C[1]);
          b.ray(cx, cy, PI / 2, 5 + k * 4, 22 + k * 2, rw, 0, C[2]); b.ray(cx, cy, -PI / 2, 5 + k * 4, 22 + k * 2, rw, 0, C[2]);
          if (k < 3) b.star4(cx, cy, 5 - k, 5 - k, 1, P[k]);
          dashes(b, cx, cy, rs, 0.7 + k * 0.12, 1 + k * 0.12, 1, C[2 + (k >> 1)]);
        } else if (f < 12) {
          var q = f - 7;
          diamond(30 + q * 2, 1, C[3 + (q > 2 ? 1 : 0)], 0.55 - q * 0.1);
          dots(b, cx, cy, rs, 1.7 + q * 0.08, q < 2 ? 2 : 1, C[3 + (q >> 1)], 1);
          b.rect(cx + 34 + q, cy, 4 - q * 0.6, 1, C[3]); b.rect(cx - 30 - q, cy, 3, 1, C[3]);
        } else {
          dots(b, cx, cy, rs, 2.1 + (f - 12) * 0.06, 1, C[4 + (f > 14 ? 1 : 0)], f > 15 ? 2 : 1);
        }
      });
    }
    var hotC = I.N.hot.u;
    A.hitS = specialAnim(H, hotC);
    A.hitSc = [0, 1].map(function (p) { var L = I.scheme('claude', p).light.u; return specialAnim(H, [L[0], L[1], L[2], L[3], L[4], L[5], L[5]]); });
    A.hitSd = [0, 1].map(function (p) { var W = I.scheme('deepseek', p).water.u; return specialAnim(I.N.white.u.concat([W[5]]), [W[0], W[1], W[2], W[3], W[4], W[5], W[5]]); });

    // COUNTER — 22f, 84x72. Jagged crackling burst, dark-red inversion, double red ring.
    var rcn = makeRays(51, 12, 18, 14, 0.6);
    function zig(b, cx, cy, ray, s0, s1, w, c, seed) {
      var rng = I.bakeRng(seed), pts = [], steps = 4, nx = -Math.sin(ray.a), ny = Math.cos(ray.a);
      for (var i = 0; i <= steps; i++) {
        var t = s0 + (s1 - s0) * (i / steps), off = (i === 0 || i === steps) ? 0 : (rng() - 0.5) * 5;
        pts.push(cx + Math.cos(ray.a) * ray.len * t + nx * off, cy + Math.sin(ray.a) * ray.len * t + ny * off);
      }
      b.stroke(pts, function (u) { return w * (1 - u * 0.75); }, c);
    }
    A.hitC = I.anim(84, 72, 22, 41, 36, function (b, f) {
      var cx = 41, cy = 36, i;
      if (f === 0) {
        starOf(b, cx, cy, rcn, 1.05, 7, R[0]);
        for (i = 0; i < rcn.length; i += 2) zig(b, cx, cy, rcn[i], 0.8, 1.45, 1.3, R[0], i * 7 + 1);
        b.disc(cx, cy, 9, R[0]); b.outline(R[3]); b.outline(R[5]);
      } else if (f === 1) {
        starOf(b, cx, cy, rcn, 1.15, 8, R[3]);
        starOf(b, cx, cy, rcn, 0.85, 6, R[1]);
        for (i = 0; i < rcn.length; i += 2) zig(b, cx, cy, rcn[i], 0.9, 1.5, 1, R[2], i * 7 + 1);
        b.disc(cx, cy, 11, R[0]); b.disc(cx, cy, 9, R[6]); b.disc(cx, cy, 5, R[5]);
        b.outline(R[5]);
      } else if (f < 6) {
        var k = f - 2;
        dashes(b, cx, cy, rcn, 0.5 + k * 0.14, 1.2 + k * 0.08, 2.2 - k * 0.35, R[2 + (k >> 1)]);
        dashes(b, cx, cy, rcn, 0.56 + k * 0.14, 1.0 + k * 0.06, 0.9, R[0 + k]);
        for (i = 1; i < rcn.length; i += 3) zig(b, cx, cy, rcn[i], 1.0 + k * 0.1, 1.5 + k * 0.08, 0.9, R[1 + k], i * 5 + 3);
        b.ring(cx, cy, 10 + k * 4, 12.5 + k * 3.6, k < 1 ? R[0] : R[2 + (k > 2 ? 1 : 0)]);
        if (k > 0) b.ring(cx, cy, 6 + k * 2, 7.2 + k * 2, R[1]);
        b.disc(cx, cy, Math.max(0, 6 - k * 2), R[0]);
      } else if (f < 12) {
        var q = f - 6;
        var r1 = new I.Buf(84, 72); r1.ring(cx, cy, 26 + q * 2, 27.4 + q * 2, R[3 + (q > 2 ? 1 : 0)]); r1.breakup(0.8 - q * 0.12, q, q); b.blit(r1, 0, 0);
        var r2 = new I.Buf(84, 72); r2.ring(cx, cy, 16 + q * 2.6, 17.2 + q * 2.6, R[2 + (q > 1 ? 1 : 0)]); r2.breakup(0.7 - q * 0.12, 1 - q, 2); b.blit(r2, 0, 0);
        dashes(b, cx, cy, rcn, 1.12 + q * 0.07, 1.4 + q * 0.06, 1, R[3 + (q >> 1)]);
      } else if (f < 17) {
        dots(b, cx, cy, rcn, 1.6 + (f - 12) * 0.06, f < 14 ? 2 : 1, R[4 + (f > 14 ? 1 : 0)], 1);
      } else {
        dots(b, cx, cy, rcn, 1.92 + (f - 17) * 0.04, 1, R[5 + (f > 19 ? 1 : 0)], 2);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // BLOCK FLASHES  (crescent "(" toward the attacker: facing right => opens to the right)
  function bakeBlocks() {
    var C = I.N.cool.u;
    function segs(b, cx, cy, r0, r1, a0, a1, n, gap, c) {
      var span = (a1 - a0) / n;
      for (var i = 0; i < n; i++) b.ring(cx, cy, r0, r1, c, a0 + i * span + gap / 2, a0 + (i + 1) * span - gap / 2);
    }
    function facets(b, cx, cy, r, a0, a1, c) {   // hex facet ticks across the shield
      for (var a = a0 + 0.25; a < a1 - 0.1; a += 0.42) b.line(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2), cx + Math.cos(a) * (r + 1), cy + Math.sin(a) * (r + 1), c);
    }
    var L0 = PI * 0.62, L1 = PI * 1.38;

    // LIGHT — 10f, 30x34
    A.blockL = I.anim(30, 34, 10, 12, 17, function (b, f) {
      var cx = 21, cy = 17;
      if (f === 0) {
        b.ring(cx, cy, 7, 10.5, C[0], L0, L1);
        b.rect(cx - 9, cy - 13, 1, 27, C[0]); b.rect(cx - 10, cy - 4, 3, 9, C[0]);
        b.outline(C[4]);
      } else if (f === 1) {
        b.ring(cx, cy, 8, 11.5, C[3], L0, L1);
        b.ring(cx, cy, 8, 9.4, C[0], L0 + 0.1, L1 - 0.1);
        facets(b, cx, cy, 10, L0, L1, C[1]);
        b.outline(C[5]);
      } else if (f === 2) {
        segs(b, cx, cy, 9, 12, L0, L1, 3, 0.22, C[2]);
        segs(b, cx, cy, 9, 10, L0, L1, 3, 0.3, C[1]);
      } else if (f === 3) {
        segs(b, cx + 1, cy, 11, 13, L0 - 0.05, L1 + 0.05, 3, 0.4, C[3]);
        segs(b, cx + 1, cy, 11, 12, L0, L1, 3, 0.5, C[2]);
      } else if (f < 6) {
        var d = new I.Buf(30, 34); segs(d, cx + 1, cy, 12.5 + (f - 4), 13.6 + (f - 4), L0 - 0.1, L1 + 0.1, 5, 0.32, C[3 + (f - 4)]); b.blit(d, 0, 0);
      } else {
        var k = f - 6, a;
        for (a = L0; a <= L1; a += 0.3) b.set(cx + 1 + Math.cos(a) * (14.5 + k), cy + Math.sin(a) * (14.5 + k), k < 2 ? C[4] : C[5]);
        if (k > 1) b.breakup(0.5);
      }
    });

    // HEAVY — 14f, 44x52. Double crescent with facet grid, cracks, bigger chips.
    var H0 = PI * 0.58, H1 = PI * 1.42;
    A.blockH = I.anim(44, 52, 14, 17, 26, function (b, f) {
      var cx = 32, cy = 26;
      if (f === 0) {
        b.ring(cx, cy, 11, 17, C[0], H0, H1);
        b.rect(cx - 16, cy - 22, 2, 45, C[0]); b.rect(cx - 18, cy - 8, 4, 17, C[0]);
        b.ring(cx, cy, 6, 8, C[1], H0 + 0.2, H1 - 0.2);
        b.outline(C[3]); b.outline(C[5]);
      } else if (f === 1) {
        b.ring(cx, cy, 12, 18, C[3], H0, H1);
        b.ring(cx, cy, 12, 14, C[1], H0 + 0.05, H1 - 0.05);
        b.ring(cx, cy, 17, 18, C[1], H0 + 0.05, H1 - 0.05);
        facets(b, cx, cy, 15, H0, H1, C[0]);
        b.ring(cx, cy, 7, 8.6, C[0], H0 + 0.3, H1 - 0.3);
        b.outline(C[5]);
      } else if (f === 2) {
        segs(b, cx, cy, 13, 19, H0, H1, 4, 0.12, C[2]);
        segs(b, cx, cy, 13, 15, H0, H1, 4, 0.2, C[0]);
        facets(b, cx, cy, 16, H0, H1, C[1]);
        b.outline(C[5]);
      } else if (f < 6) {
        var k = f - 3;
        segs(b, cx + k, cy, 15 + k * 2, 19.5 + k * 1.6, H0 - 0.04 * k, H1 + 0.04 * k, 5, 0.22 + k * 0.08, C[2 + (k > 0 ? 1 : 0)]);
        segs(b, cx + k, cy, 15 + k * 2, 16.4 + k * 2, H0, H1, 5, 0.3 + k * 0.08, C[1 + k]);
        if (k < 2) b.ring(cx, cy, 9 + k * 3, 10 + k * 3, C[2], H0 + 0.3, H1 - 0.3);
      } else if (f < 10) {
        var q = f - 6, d = new I.Buf(44, 52);
        segs(d, cx + 3 + q, cy, 21 + q * 1.5, 22.6 + q * 1.3, H0 - 0.15, H1 + 0.15, 7, 0.26, C[3 + (q > 1 ? 1 : 0)]);
        if (q > 1) d.breakup(0.75 - (q - 2) * 0.25);
        b.blit(d, 0, 0);
      } else {
        var e = f - 10, a2;
        for (a2 = H0 - 0.1; a2 <= H1 + 0.1; a2 += 0.24) b.set(cx + 6 + Math.cos(a2) * (27 + e), cy + Math.sin(a2) * (27 + e), C[4 + (e > 1 ? 1 : 0)]);
        if (e > 1) b.breakup(0.55);
      }
    });
  }

  I.onInit('hits', bakeHits);
  I.onInit('blocks', bakeBlocks);

  // ---------------------------------------------------------------------------
  // spawn definitions
  function dirOf(O) { return O.angle != null ? O.angle : (O.facing > 0 ? 0 : PI); }
  function nOf(base, O) { return Math.max(1, Math.round(base * (0.45 + 0.55 * O.power) * (O.scale || 1))); }
  function sparks(x, y, O, n, spread, v0, v1, l0, l1, rampCss, opt) {
    var a0 = dirOf(O);
    for (var i = 0; i < n; i++) {
      var a = a0 + I.RS() * spread;
      I.spark(x, y, a, I.RR(v0, v1), I.RI(l0, l1), rampCss, I.FRONT, opt);
    }
  }
  function lay(O, d) { return O.layer == null ? d : O.layer; }
  I.sparksFan = sparks; I.nOf = nOf; I.dirOf = dirOf; I.lay = lay;

  I.def('hit.light', function (x, y, O) {
    I.anim1(A.hitL, x, y, O.facing, lay(O, I.FRONT));
    sparks(x, y, O, nOf(3, O), 0.9, 2.4, 3.6, 5, 8, I.N.hot.css, { max: 5, len: 1.4 });
  }, { desc: 'Small 4-point white-yellow cross star, 8f.', use: 'Light normals (5L/2L/jL) on hit, at the contact point, facing = attacker.' });

  I.def('hit.medium', function (x, y, O) {
    I.anim1(A.hitM, x, y, O.facing, lay(O, I.FRONT));
    sparks(x, y, O, nOf(6, O), 0.85, 2.6, 4.6, 6, 10, I.N.hot.css, { max: 7 });
  }, { desc: '8-ray starburst with a small ring, 12f.', use: 'Medium normals on hit.' });

  I.def('hit.heavy', function (x, y, O) {
    I.anim1(A.hitH, x, y, O.facing, lay(O, I.FRONT));
    sparks(x, y, O, nOf(9, O), 0.8, 3.2, 5.8, 8, 13, I.N.hot.css, { max: 10, size: 2 });
    var a0 = dirOf(O);
    for (var i = 0; i < nOf(2, O); i++) I.spark(x, y + I.RI(-6, 6), a0 + I.RS() * 0.08, I.RR(7, 9), 7, I.N.hot.css, I.FRONT, { max: 16, len: 2.4, drag: 0.8 });
    for (i = 0; i < nOf(3, O); i++) {
      var p = I.add(I.K_DOT, x, y, I.FRONT);
      var a = a0 + I.RS() * 1.1;
      p.vx = Math.cos(a) * I.RR(1.5, 3.5); p.vy = Math.sin(a) * I.RR(1.5, 3.5) - 1.5; p.g = 0.22; p.life = I.RI(12, 18); p.size = 2; p.ramp = I.N.hot.css; p.c = 1; p.e = 1;
    }
  }, { desc: 'Big 10-ray burst, inverted impact frame, ring, flying embers, 16f.', use: 'Heavy normals / launchers / sweeps on hit.' });

  I.def('hit.special', function (x, y, O) {
    var Aa = O.char === 'claude' ? A.hitSc[O.pal] : O.char === 'deepseek' ? A.hitSd[O.pal] : A.hitS;
    var rc = O.char === 'claude' ? I.scheme('claude', O.pal).light.css : O.char === 'deepseek' ? I.scheme('deepseek', O.pal).water.css : I.N.hot.css;
    I.anim1(Aa, x, y, O.facing, lay(O, I.FRONT));
    sparks(x, y, O, nOf(8, O), 1.2, 3, 5.5, 8, 13, rc, { max: 9 });
    for (var i = 0; i < nOf(4, O); i++) {
      var a = I.R() * TAU;
      I.twinkle(x + Math.cos(a) * I.RR(10, 22), y + Math.sin(a) * I.RR(8, 16), I.RI(2, 3), I.RI(10, 14), rc, I.FRONT, I.RI(2, 6));
    }
  }, { desc: 'Compass star + expanding diamond rings (magic geometry), 18f. opts.char tints it.', use: 'Special-move hits; pass char for character colours.' });

  I.def('hit.counter', function (x, y, O) {
    I.anim1(A.hitC, x, y, O.facing, lay(O, I.FRONT));
    sparks(x, y, O, nOf(12, O), 1.3, 3.5, 6.5, 9, 15, I.N.red.css, { max: 11, size: 2 });
    var a0 = dirOf(O);
    for (var i = 0; i < nOf(3, O); i++) I.spark(x, y + I.RI(-8, 8), a0 + I.RS() * 0.06, I.RR(8, 10), 8, I.N.red.css, I.FRONT, { max: 20, len: 2.6, drag: 0.8 });
    for (i = 0; i < nOf(5, O); i++) {
      var p = I.add(I.K_DOT, x, y, I.FRONT), a = I.R() * TAU;
      p.vx = Math.cos(a) * I.RR(1.5, 4); p.vy = Math.sin(a) * I.RR(1.5, 4) - 1.6; p.g = 0.2; p.life = I.RI(14, 22); p.size = 2; p.ramp = I.N.red.css; p.c = 1; p.e = 1;
    }
  }, { desc: 'Huge jagged crackling red-white burst, dark-red inversion, double ring, 22f.', use: 'Counter hits (instead of the normal hit spark).' });

  I.def('block.light', function (x, y, O) {
    I.anim1(A.blockL, x, y, O.facing, lay(O, I.FRONT));
    var back = O.facing > 0 ? PI : 0;
    for (var i = 0; i < nOf(4, O); i++) {
      var a = back + I.RS() * 1.1;
      var p = I.chip(x - O.facing * 2, y + I.RI(-6, 6), Math.cos(a) * I.RR(1.2, 2.6), Math.sin(a) * I.RR(1, 2.2) - 1, I.RI(9, 14), I.N.cool.css, 1, I.FRONT);
      p.g = 0.15; p.d = 2; p.floor = 0;
    }
  }, { desc: 'Cool blue-white crescent shield flash that cracks into 3 arcs, chips fly back, 10f.', use: 'Any light/medium attack blocked. Contact point, facing = attacker.' });

  I.def('block.heavy', function (x, y, O) {
    I.anim1(A.blockH, x, y, O.facing, lay(O, I.FRONT));
    var back = O.facing > 0 ? PI : 0;
    for (var i = 0; i < nOf(8, O); i++) {
      var a = back + I.RS() * 1.3;
      var p = I.chip(x - O.facing * 4, y + I.RI(-12, 12), Math.cos(a) * I.RR(1.5, 3.4), Math.sin(a) * I.RR(1, 2.6) - 1.2, I.RI(12, 18), I.N.cool.css, I.RI(1, 2), I.FRONT);
      p.g = 0.18; p.d = 2;
    }
    for (i = 0; i < nOf(3, O); i++) I.spark(x - O.facing * 6, y + I.RI(-10, 10), back + I.RS() * 0.15, I.RR(4, 6), 7, I.N.cool.css, I.FRONT, { max: 10, len: 2 });
  }, { desc: 'Large double crescent with hex facets, shatters into 5-7 arcs, 14f.', use: 'Heavy normals / specials / supers blocked (chip damage).' });
})();
