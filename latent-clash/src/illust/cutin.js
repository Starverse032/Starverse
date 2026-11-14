/* LATENT CLASH — ILLUST: super cut-ins (240x72), V2. Native-resolution close-up of the upper face
 * (brows → cheeks) drawn with the bust's own head geometry scaled ×2.8 through the painter transform,
 * and large vector eyes (no upscaled bust pixels). Opaque band: deep accent colour, a character motif
 * (Claude: sunburst rays · DeepSeek: water rings), speed lines streaming left; the left ~62 px stay
 * free for the move name. Facing right like the busts; mirror it yourself for P2 if wanted. */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit, S = K.S;

  // ---------------------------------------------------------------- big vector eye (design coords)
  // e = {x, y, w, h}; near = outer corner on the left; m = {lid: 0..0.4 (narrowing), pupil: 0..1, fierce}
  function bigEye(P, e, near, m) {
    var o = near ? -1 : 1, x = e.x, y = e.y, w = e.w, h = e.h;
    var xo = x + o * w / 2, xi = x - o * w / 2, top = y - h / 2 + (m.lid || 0) * h, bot = y + h / 2;
    var white = P.spoly([xo, y + 0.4, xo - o * w * 0.2, top + h * 0.14, x + o * w * 0.04, top, xi + o * w * 0.22, top + h * 0.1,
      xi, y + 0.6, xi + o * w * 0.18, bot - h * 0.12, x - o * w * 0.04, bot, xo - o * w * 0.24, bot - h * 0.16]);
    P.part(white, S.ew, S.sl);
    P.recol(white.band(0, 5), [S.ew], S.tear);
    var ix = x + w * 0.08, iy = y + h * 0.06, rx = w * (near ? 0.3 : 0.34), ry = h * 0.52;
    var iris = P.ell(ix, iy, rx, ry).and(white);
    P.fill(iris, S.e1);
    P.recol(iris.and(P.rect(0, 0, 200, iy)), [S.e1], S.e2);
    P.recol(iris.and(P.rect(0, 0, 200, iy - ry * 0.45)), [S.e2], S.e3);
    var cres = P.ell(ix + rx * 0.05, iy + ry * 0.62, rx * 0.72, ry * 0.42).and(iris);
    P.recol(cres, [S.e1, S.e2], S.e0);
    P.fill(iris.edge(), S.eK);
    P.fill(P.ell(ix, iy - ry * 0.02, rx * (m.fierce ? 0.2 : 0.34), ry * (m.fierce ? 0.5 : 0.4)).and(iris), S.lash);
    // catch-lights (light from the upper right) + a glint ring
    P.fill(P.ell(ix + rx * 0.36, iy - ry * 0.4, rx * 0.26, ry * 0.2).and(iris), S.W);
    P.fill(P.ell(ix - rx * 0.42, iy + ry * 0.36, rx * 0.12, ry * 0.1).and(iris), S.W);
    P.recol(P.ell(ix, iy + ry * 0.1, rx * 0.62, ry * 0.62).edge().and(iris), [S.e1, S.e2], S.e0);
    // upper lash line with an outer flick, lower lash at the outer third, lid crease
    var lash = P.sr([xo + o * w * 0.1, y + h * 0.16, xo, y + 0.2, xo - o * w * 0.2, top + h * 0.12, x + o * w * 0.04, top - 0.1,
      xi + o * w * 0.22, top + h * 0.08, xi - o * 0.2, y + 0.4], 0.9, 0.7, 2.1);
    P.fill(lash, S.lash);
    P.fill(P.sr([xo, y + 0.2, xo + o * w * 0.16, y - h * 0.08, xo + o * w * 0.24, y - h * 0.22], 1, 0.2), S.lash);
    P.recol(lash.band(0, 2).and(P.rect(0, 0, 300, 200)), [S.lash], S.K);
    P.line([xo - o * w * 0.02, y + h * 0.1, xo - o * w * 0.2, bot - h * 0.1, x - o * w * 0.1, bot + 0.2], S.eK, true);
    P.line([x + o * w * 0.04, bot + 0.1, xi + o * w * 0.25, bot - h * 0.14], S.sl, true);
    P.line([xo - o * w * 0.12, top - h * 0.05, x + o * w * 0.02, top - h * 0.18, xi + o * w * 0.3, top - h * 0.05], S.sl, true);
  }
  I.bigEye = bigEye;

  // ---------------------------------------------------------------- per-character head close-ups
  function face(P, A, rim) {
    var f = P.spoly(A.head.face);
    P.part(f, S.s1, S.sl);
    P.recol(f.band(4, 0), [S.s1], S.s2);
    P.recol(f.band(-2, 0), [S.s1], S.s0);
    return f;
  }
  function fringe(P, A) {
    var fr = P.mask();
    A.head.FR.forEach(function (c) { fr = fr.or(P.sr(c[0], c[1], c[2], c[3])); });
    P.recol(fr.shift(-2, 6).or(fr.shift(0, 6)), [S.s1, S.s0], S.s2);
    A.head.FR.forEach(function (c) { I.H.hairClump(P, c, S.h1); });
  }
  function blush(P, pts) {
    pts.forEach(function (p) { P.line([p[0], p[1], p[0] - 1.2, p[1] + 1.6], S.bl); });
  }
  var DRAW = {
    claude: function (Q) {
      var A = I.ART.claude, H = I.H;
      Q.part(Q.rect(10, 20, 96, 60), S.h2, S.hl);
      Q.recol(Q.rect(10, 20, 96, 60).band(-6, 0), [S.h2], S.h3);
      H.strands(Q, [[86, 30, 89, 50, 92, 70], [92, 30, 96, 52, 98, 70], [22, 30, 18, 52, 16, 70]], S.h3);
      Q.part(Q.ell(53, 36, 25, 26).or(Q.ell(47, 42, 21, 23)), S.h1, S.hl);
      face(Q, A);
      bigEye(Q, { x: 46, y: 47, w: 12, h: 9 }, true, { lid: 0.14 });
      bigEye(Q, { x: 66, y: 47, w: 8.4, h: 9 }, false, { lid: 0.14 });
      Q.fill(Q.sr([41, 40.5, 46, 39.6, 51.5, 41], 1.2, 1.4, 1.5), S.hl);           // brows: level, inner ends lowered
      Q.fill(Q.sr([62.5, 41, 66, 39.4, 69.5, 39.8], 1.3, 0.9, 1.3), S.hl);
      Q.line([70.6, 54.5, 71.4, 57.2], S.s2); Q.px(Q.tx(71.2), Q.ty(57.6), S.sl);
      blush(Q, [[43, 55.5], [45, 55.5], [47, 55.5], [67, 55.5], [69, 55.5]]);
      fringe(Q, A);
      H.hairClump(Q, [[37, 26, 32, 38, 30, 54, 30, 72], 10, 8, 11, 0, [0.12, 0.6]], S.h1);
      H.hairClump(Q, [[39, 30, 36, 44, 35, 58, 36, 70], 4.5, 0, 5], S.h1);
      H.hairClump(Q, [[75, 26, 79, 40, 80, 56, 81, 74], 9, 8, 10, 0, [0.1, 0.6]], S.h1);
    },
    deepseek: function (Q) {
      var A = I.ART.deepseek, H = I.H;
      Q.part(Q.rect(4, 20, 104, 60), S.h2, S.hl);
      Q.fill(Q.rect(30, 56, 52, 30), S.t1);
      Q.part(Q.ell(53, 38, 25, 26).or(Q.ell(47, 43, 21, 23)), S.h1, S.hl);
      face(Q, A);
      bigEye(Q, { x: 46, y: 48.5, w: 12, h: 10.4 }, true, { lid: 0.08, fierce: true });
      bigEye(Q, { x: 66, y: 48.5, w: 8.4, h: 10.4 }, false, { lid: 0.08, fierce: true });
      Q.fill(Q.sr([40.5, 39.5, 46, 40.6, 51.5, 43], 1.2, 1.5, 1.5), S.hl);          // fierce, angled brows
      Q.fill(Q.sr([62.5, 43, 66, 40.8, 69.5, 40], 1.4, 0.9, 1.3), S.hl);
      Q.line([70.6, 55.5, 71.4, 58.2], S.s2); Q.px(Q.tx(71.2), Q.ty(58.6), S.sl);
      blush(Q, [[42, 57], [44, 57], [46, 57], [66, 57], [68, 57]]);
      fringe(Q, A);
      H.hairClump(Q, [[37, 28, 31, 42, 32, 56, 28, 68, 29, 82], 13, 6, 13, 0, [0.1, 0.6]], S.h1);
      H.hairClump(Q, [[75, 28, 80, 42, 79, 56, 83, 68, 82, 82], 10, 6, 11, 0, [0.1, 0.6]], S.h1);
      // whale fins (lop ears), pale inner face
      [[[37, 28, 27, 31, 18, 37, 11, 46, 6, 56, 5, 63, 9, 63, 16, 57, 25, 51, 36, 47], [36, 47, 25, 51, 16, 57, 9, 63, 7, 59, 14, 50, 24, 43, 36, 40]],
        [[74, 27, 84, 30, 93, 36, 99, 45, 103, 55, 103, 61, 99, 60, 92, 53, 83, 47, 74, 43], [74, 43, 83, 47, 92, 53, 99, 60, 102, 58, 96, 48, 86, 40, 74, 35]]
      ].forEach(function (f) {
        var m = Q.spoly(f[0]), im = Q.spoly(f[1]).and(m);
        Q.fill(m.grow(1).sub(m).and(Q.solid()), S.ol);
        Q.part(m, S.x1, S.xl); Q.recol(m.band(-1, 3), [S.x1], S.x0); Q.recol(m.band(4, -4), [S.x1], S.x2);
        Q.recol(im, [S.x1, S.x2, S.x0], S.xP); Q.recol(im.band(4, -2), [S.xP], S.x0);
      });
    }
  };
  var CFG = { claude: { seed: 17 }, deepseek: { seed: 29 } };

  I.cutin = function (charId) {
    var cfg = CFG[charId] || CFG.claude, r = K.rng(cfg.seed), x, y, i;
    var P = K.painter(240, 72);
    P.fill(P.rect(0, 0, 240, 72), S.a3);
    // motif behind the face
    if (charId === 'claude') {
      for (i = 0; i < 24; i += 2) {
        var a0 = i * Math.PI / 12 + 0.1, a1 = a0 + Math.PI / 12;
        P.fill(P.poly([150, 30, 150 + Math.cos(a0) * 260, 30 + Math.sin(a0) * 260, 150 + Math.cos(a1) * 260, 30 + Math.sin(a1) * 260]), S.a2);
      }
    } else {
      for (i = 0; i < 9; i++) { var rr = 14 + i * 16; P.fill(P.ell(160, 36, rr + 3, (rr + 3) * 0.6).sub(P.ell(160, 36, rr, rr * 0.6)), S.a2); }
    }
    // speed lines streaming left
    for (i = 0; i < 34; i++) {
      y = 1 + Math.floor(r() * 70); var x0 = Math.floor(r() * 120), len = 20 + Math.floor(r() * 110);
      var sl = i % 6 === 0 ? S.W : i % 3 === 0 ? S.a0 : S.a1;
      for (x = x0; x < Math.min(240, x0 + len); x++) P.px(x, y, sl);
      if (i % 4 === 0) for (x = x0 + 6; x < Math.min(240, x0 + len - 10); x++) P.px(x, y + 1, S.a2);
    }
    // the face, drawn at x2.8 in bust coordinates, cut on a slant
    var Q = K.painter(240, 72);
    Q.s = 2.8; Q.ox = -4; Q.oy = -103.6;
    (DRAW[charId] || DRAW.claude)(Q);
    Q.s = 1; Q.ox = 0; Q.oy = 0;
    Q.outer(S.ol);
    for (y = 0; y < 72; y++) {
      var cut = Math.round(62 + (71 - y) * 0.26);
      for (x = cut; x < 240; x++) { var c = Q.c[y * 240 + x]; if (c) P.c[y * 240 + x] = c; }
      P.px(cut - 1, y, S.W); P.px(cut - 2, y, S.a0); P.px(cut, y, S.ol);
    }
    for (x = 0; x < 240; x++) { P.px(x, 0, S.a0); P.px(x, 71, S.a0); P.px(x, 1, S.ol); P.px(x, 70, S.ol); }
    return P;
  };
})();
