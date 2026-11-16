/* LATENT CLASH — ILLUST: Gemini 娘 portraits, V2.6 design (ZipZipPipe's heterochromia cat-girl).
 * bust / bustWin / bustLose / face here; cut-in face + motif hooks for cutin.js; emblem hook for
 * icons.js. Same construction, head size and light (upper right) as the other three. Three-quarter
 * view facing right.
 * Slots: h* hair (blue crown) -> x* hair2 (violet) -> t* hairTip (pink ends), shifted in clean bands by
 * hairShift(); z* inner ear; e* near eye (rose red), g* far eye (gold); c* cloth1 (white), d* cloth2
 * (navy), u* lining (violet), a* accent (pink-violet magic), q* star facets, m* metal (gold). */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit, S = K.S;
  I.ART = I.ART || {};

  var EL = { K: S.lash, k: S.eK, D: S.e3, s: S.e2, B: S.e1, H: S.e0, w: S.ew, W: S.W, P: S.lash, x: S.s2, l: S.sl, y: S.s3,
    b: S.bl, c: S.blS, m: S.mo, t: S.tg, n: S.sl, r: S.tear, R: S.tear2, h: S.hl, o: S.ol };
  var EL2 = {}; Object.keys(EL).forEach(function (k) { EL2[k] = EL[k]; });
  EL2.k = S.gK; EL2.D = S.g3; EL2.s = S.g2; EL2.B = S.g1; EL2.H = S.g0;
  var EYES = {
    // big, lively, a little sly: slightly lowered outer lid, narrow cat pupil, two catch-lights
    near: [
      '............',
      '....xxxxxx..',
      '..KKKKKKKK..',
      '.KKKKKKKKKKK',
      'KKKkDDDDDkKK',
      'K.wDDsPPsDDw',
      '..wDssPPWWsw',
      '..wsBsPPWWBw',
      '..wBBBPPBBBw',
      '..wBHBBBBHBw',
      '...wHHHHHHw.',
      '....llllll..'
    ],
    far: [
      '.........',
      '..xxxxx..',
      '.KKKKKK..',
      'KKKKKKKKK',
      'KkDDDDkKK',
      'wDsPPsDw.',
      'wsBPPWWw.',
      'wBsPPWWw.',
      'wBBPPBBw.',
      'wHBBBBHw.',
      '.wHHHHw..',
      '..llll...'
    ],
    // win: near eye winks (happy closed arc), far eye stays open
    nearWin: [
      '............',
      '............',
      '............',
      '............',
      '....KKKKK...',
      '..KKK...KKK.',
      '.KK.......KK',
      'K...........',
      '............',
      '............',
      '............',
      '............'
    ],
    // lose: teary, wide, shaky small pupils, wet lower rim
    nearLose: [
      '............',
      '............',
      '...KKKKKKK..',
      '.KKKKKKKKKKK',
      'KK.wkDDDDkKw',
      '..wDDsssWDkw',
      '..wDsBPWWsDw',
      '..wsBPPBBssw',
      '..wBBBBBBBBw',
      '..wBHHHHHHBw',
      '...rrRRRRrr.',
      '....llllll..'
    ],
    farLose: [
      '.........',
      '.........',
      '..KKKKKK.',
      'KKKKKKKKK',
      'wkDDDDkK.',
      'wDssWDDw.',
      'wsBPWsDw.',
      'wsPPBBsw.',
      'wBBBBBBw.',
      'wBHHHHBw.',
      '.rRRRRr..',
      '..llll...'
    ]
  };
  var MOUTHS = {
    sly: ['.....n', 'n...n.', '.nnn..'],
    grin: ['nnnnnn', '.Wmmn.', '..nn..'],
    pout: ['.nnn.', 'n...n']
  };

  // head geometry shared by bust and cut-in (bust pixel coordinates)
  var FR = [
    [[50, 12, 62, 16, 72, 25, 77, 36, 78, 46], 13, 0, 13],
    [[49, 13, 58, 20, 64, 30, 66, 38, 64, 44], 12, 0, 12],
    [[48, 13, 53, 24, 57, 34, 58, 43, 56, 50], 9, 0, 9],
    [[47, 14, 48, 24, 50, 33, 49, 40], 8, 0, 8],
    [[46, 13, 40, 19, 37, 28, 36, 38, 38, 44], 11, 0, 10],
    [[46, 14, 43, 24, 43, 33, 45, 40], 7, 0, 7]
  ];
  var FACEPTS = [36, 27, 33, 37, 33, 47, 35, 55, 40, 62, 46, 67.5, 52, 72, 56.5, 74.5, 60.5, 75, 64, 72.5, 69, 67, 73, 61, 76, 55, 77.5, 49, 77, 43, 77.5, 36, 76, 29, 64, 25, 46, 25];
  var SKULL = [[53, 37, 25, 26], [47, 42, 21, 23]];

  // ---------------------------------------------------------------- helpers
  // hair colour shift in clean bands: blue crown -> violet -> pink ends, by d = y + k·|x - cx|
  // (2-px checker transition). Applied to every h*/t* pixel inside `region` (default: everything).
  var HB = [S.h0, S.h1, S.h2, S.h3, S.hl], HX = [S.x0, S.x1, S.x2, S.x3, S.xl], HT = [S.t0, S.t0, S.t1, S.tS, S.tl];
  function lvl(d, t, x, y) { return d >= t + 2 ? 1 : d >= t ? (x + y) & 1 : d >= t - 2 ? ((x & 1) === 0 && (y & 1) === 0 ? 1 : 0) : 0; }
  // remap h* pixels (inside `only`, or everywhere but `skip`) to violet / pink by a field d(x, y)
  function shiftBy(P, only, dfn, a, b, skip) {
    var idx = {}; HB.forEach(function (s, i) { idx[s] = i; });
    for (var y = 0; y < P.h; y++) for (var x = 0; x < P.w; x++) {
      var i = y * P.w + x, v = idx[P.c[i]]; if (v === undefined || (only && !only.d[i]) || (skip && skip.d[i])) continue;
      var d = dfn(x, y);
      if (lvl(d, b, x, y)) P.c[i] = HT[v];
      else if (lvl(d, a, x, y)) P.c[i] = HX[v];
    }
  }
  function hairShift(P, a, b, skip, k, cx) {
    k = k === undefined ? 0.7 : k; cx = cx === undefined ? 56 : cx;
    shiftBy(P, null, function (x, y) { return y + k * Math.abs(x - cx) + 3 * Math.sin(x * 0.45); }, a, b, skip);
  }
  // four-pointed iridescent star: 8 facets in the star hues, coloured outline. Returns the mask.
  var FACETS = [S.q0, S.q1, S.q2, S.q3, S.q2, S.q1, S.q3, S.q1];
  function star4(P, cx, cy, r, o) {
    o = o || {};
    var k = o.k || 0.4, rot = (o.rot || 0) - Math.PI / 2, pts = [], i;
    for (i = 0; i < 8; i++) { var a = rot + i * Math.PI / 4, rr = i % 2 ? r * k : r; pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    var m = P.poly(pts);
    if (r < 4.5) {
      // tiny: hand-placed cross, white core
      var X = Math.round(cx), Y = Math.round(cy), n = Math.max(1, Math.round(r - 0.5));
      m = P.mask();
      for (i = -n; i <= n; i++) { m.d[Y * P.w + X + i] = 1; m.d[(Y + i) * P.w + X] = 1; }
      if (n >= 2) { m.d[Y * P.w + X + 1 - P.w] = 1; m.d[Y * P.w + X - 1 + P.w] = 1; m.d[Y * P.w + X - 1 - P.w] = 1; m.d[Y * P.w + X + 1 + P.w] = 1; }
      P.fill(m, S.q1);
      for (i = 1; i <= n; i++) { P.px(X + i, Y, S.q2); P.px(X, Y + i, S.q3); }
      P.px(X, Y - n, S.q0); P.px(X, Y, S.W);
      if (o.line) P.fill(m.grow(1).sub(m), o.line);
      return m;
    }
    P.fill(m, S.q1);
    for (i = 0; i < 8; i++) {
      var j = (i + 1) % 8, tri = P.poly([cx, cy, pts[i * 2], pts[i * 2 + 1], pts[j * 2], pts[j * 2 + 1]]).and(m);
      P.fill(tri, (o.cols || FACETS)[i]);
    }
    if (o.inner) P.fill(m.edge(), o.line || S.ul); else P.fill(m.grow(1).sub(m), o.line || S.ul);
    P.px(Math.round(cx - 0.5), Math.round(cy - 0.5), S.W);
    if (r >= 6) { P.px(Math.round(cx - 0.5), Math.round(cy - 1.5), S.W); P.px(Math.round(cx + 0.5), Math.round(cy - 0.5), S.W); }
    return m;
  }
  I.star4 = star4;

  // cat ear: outer (hair blue, lit edge), pink inner, white fluff tuft. pts = outer, inn = inner
  function catEar(P, pts, inn, fluff) {
    var m = P.spoly(pts);
    P.part(m, S.h1, S.hl);
    P.recol(m.band(3, -1), [S.h1], S.h2);
    P.recol(m.band(-1, 2), [S.h1], S.h0);
    var im = P.spoly(inn).and(K.inner(m));
    P.part(im, S.z1, S.z3);
    P.recol(im.band(2, -2), [S.z1], S.z2);
    P.recol(im.band(-1, 1), [S.z1], S.z0);
    if (fluff) fluff.forEach(function (f) { var t = P.sr(f, 2.4, 0.6).and(im.grow(1)); P.fill(t, S.c0); P.recol(t.band(1, 0), [S.c0], S.c1); });
    return m;
  }

  // fluffy tail: thick tapered ribbon with tufted outline, shade underneath, lit top
  function tail(P, pts, w) {
    var p = K.bez(K.smooth(pts), 24), n = (p.length >> 1) - 1, i, n2 = pts.length, ex = pts[n2 - 2], ey = pts[n2 - 1];
    var m = P.sr(pts, w, w * 0.55, w * 1.08).or(P.ell(ex, ey, w * 0.3, w * 0.3));
    // fur tufts: little wedges flicking back toward the base, alternating sides
    for (i = 1; i < 12; i++) {
      var t = i / 12, q = Math.min(n - 1, Math.floor(t * n)), x = p[q * 2], y = p[q * 2 + 1];
      var dx = p[q * 2 + 2] - x, dy = p[q * 2 + 3] - y, l = Math.sqrt(dx * dx + dy * dy) || 1; dx /= l; dy /= l;
      var sd = i & 1 ? 1 : -1, hw = (w * (1 - t) + w * 0.55 * t) / 2 - 0.4, bx = x - dy * hw * sd, by = y + dx * hw * sd;
      m = m.or(P.poly([bx + dx * 1.8, by + dy * 1.8, bx - dy * sd * 2.4 - dx * 3.2, by + dx * sd * 2.4 - dy * 3.2, bx - dx * 2.2, by - dy * 2.2]));
    }
    P.part(m, S.h1, S.hl);
    P.recol(m.band(3, -2), [S.h1], S.h2);
    P.recol(m.band(2, -1).and(m.band(4, -3)), [S.h2], S.h3);
    P.recol(m.band(-1, 2), [S.h1], S.h0);
    // short fur strokes along the spine
    for (i = 2; i < 11; i += 2) {
      var u = i / 12, r = Math.floor(u * n), ux = p[r * 2], uy = p[r * 2 + 1], vx = p[r * 2 + 2] - ux, vy = p[r * 2 + 3] - uy, vl = Math.sqrt(vx * vx + vy * vy) || 1;
      var o2 = (i & 2 ? 1.6 : -1.6);
      P.line([ux - vy / vl * o2, uy + vx / vl * o2, ux - vy / vl * o2 + vx / vl * 3, uy + vx / vl * o2 + vy / vl * 3], S.h2, false, true);
    }
    // blue base -> violet -> pink tip, by distance from the tip end (same 3-step band as the hair)
    shiftBy(P, m, function (x, y) { return 40 - Math.sqrt((x + 0.5 - ex) * (x + 0.5 - ex) + (y + 0.5 - ey) * (y + 0.5 - ey)); }, 24, 33);
    return m;
  }
  function H() { return I.H; }

  // the light-twin: a translucent pink-violet copy peeking in behind her (win)
  function twin(P, dx, dy) {
    var Q = K.painter(P.w, P.h); Q.ox = dx; Q.oy = dy;
    var m = Q.ell(53, 37, 25, 26).or(Q.ell(47, 42, 21, 23))
      .or(Q.spoly([29, 28, 25, 16, 25, 6, 27, 1, 34, 4, 41, 8, 47, 13, 38, 16])).or(Q.spoly([62, 14, 68, 8, 75, 4, 81, 1, 84, 7, 83, 16, 80, 25, 72, 22]))
      .or(Q.spoly([30, 40, 24, 60, 26, 80, 20, 100, 24, 132, 94, 132, 98, 100, 92, 80, 94, 60, 84, 36]));
    P.fill(m, S.a1);
    for (var y = 0; y < P.h; y += 4) for (var x = (y & 4) ? 2 : 0; x < P.w; x += 4) if (m.has(x, y)) P.px(x, y, S.a0);
    P.recol(m.band(-2, 2), [S.a1], S.a0);
    P.fill(m.edge(), S.a0);
    // glinting eyes
    [[44, 46], [66, 46]].forEach(function (e) { var x = Math.round(e[0] + dx), y = Math.round(e[1] + dy); P.px(x, y, S.W); P.px(x, y + 1, S.W); P.px(x + 1, y + 1, S.a0); P.px(x, y + 2, S.a0); });
  }

  // ---------------------------------------------------------------- bust
  function drawBust(P, o) {
    var expr = o.expr || 'n', sw = o.sway || 0, HH = I.H;
    var lose = expr === 'lose', win = expr === 'win';

    // ---- back hair: huge, wavy, spreading past the shoulders
    var back = P.spoly([54, 10, 36, 12, 26, 20, 20, 32, 17, 46, 13, 58, 14, 70, 8, 82, 9, 94, 3 + sw, 106, 6 + sw, 118, 1 + sw * 2, 128, 0, 132,
      112, 132, 110 + sw * 2, 120, 106 + sw, 108, 108 + sw, 96, 102, 84, 104, 72, 98, 60, 99, 48, 94, 36, 89, 24, 80, 14, 68, 10]);
    P.part(back, S.h2, S.hl);
    P.recol(back.band(4, -1), [S.h2], S.h3);
    var nape = P.spoly([38, 60, 48, 66, 66, 66, 78, 60, 82, 90, 80, 132, 34, 132, 32, 90]).and(back);
    P.recol(nape, [S.h2], S.h3);
    [[[24, 40, 17, 54, 19, 66, 12 + sw, 80, 15 + sw, 94, 8 + sw * 2, 108, 11 + sw * 2, 132], 10, 5, 11, 0, [0.15, 0.55]],
      [[31, 50, 25, 64, 28, 78, 22 + sw, 92, 26 + sw, 106, 20 + sw * 2, 132], 9, 4, 10, 0],
      [[88, 36, 95, 50, 92, 62, 99 + sw, 76, 96 + sw, 90, 103 + sw * 2, 106, 100 + sw * 2, 132], 10, 5, 11, 0, [0.15, 0.55]],
      [[82, 48, 86, 62, 84, 76, 89 + sw, 92, 86 + sw, 110], 7, 3, 8, 0]
    ].forEach(function (c) { HH.hairClump(P, c, S.h2); });
    // escaping curls
    [[[14, 60, 7, 66, 5, 74, 7, 79, 11, 78], 3.6, 1.2], [[8, 92, 2, 98, 1, 106, 4, 109], 3.2, 1.2], [[10, 114, 4, 120, 4, 127, 7, 128], 3, 1.2],
    ].forEach(function (c) { var m = P.sr(c[0], c[1], c[2]); P.part(m, S.h2, S.hl); P.recol(m.band(-1, 1), [S.h2], S.h1); });

    // ---- tail tip curling in at the right, behind the sleeve
    var tl = lose ? tail(P, [119, 58, 113, 66, 109, 78, 108, 88, 105, 97], 10)
      : tail(P, [118, 106, 112, 94, 109, 82, 110, 70, 107, 60, 101, 55, 95, 56, 92, 60], 11);

    // ---- body: bare shoulders, navy halter top
    var neck = P.poly([50, 60, 62, 60, 63, 84, 50, 84]);
    P.part(neck, S.s1, S.sl);
    var sh = P.spoly([46, 80, 68, 80, 80, 86, 90, 92, 96, 104, 98, 132, 14, 132, 16, 104, 22, 92, 34, 86]);
    P.part(sh, S.s1, S.sl);
    P.recol(sh.band(4, -1), [S.s1], S.s2);
    P.recol(sh.band(-1, 2), [S.s1], S.s0);
    P.line([30, 96, 38, 99, 46, 99], S.s2, true, true);   // collarbone hint
    var top = P.spoly([48, 82, 66, 82, 71, 94, 76, 106, 79, 132, 35, 132, 38, 106, 43, 94]);
    P.recol(top.shift(-2, 1).sub(top), [S.s1, S.s0], S.s2);
    P.part(top, S.d1, S.dl);
    P.recol(top.band(5, 0), [S.d1], S.d2);
    P.recol(top.band(-2, 1), [S.d1], S.d0);
    P.recol(K.inner(top).edge().and(P.rect(0, 88, 112, 40)), [S.d1, S.d0], S.m1);
    P.recol(K.inner(top).edge().and(P.rect(0, 88, 112, 40)), [S.d2], S.m2);
    // white front panel in a V down to the star gem, violet inset, gold piping
    var pan = P.poly([50, 84, 64, 84, 62, 93, 57, 99, 52, 93]);
    P.part(pan, S.c1, S.m2);
    P.recol(pan.band(3, 0), [S.c1], S.c2);
    P.recol(pan.band(-1, 1), [S.c1], S.c0);

    // violet under-bust band peeking at the bottom
    var ub = P.sr([37, 124, 48, 127, 58, 127.5, 68, 127, 78, 124], 4, 4).and(top);
    P.part(ub, S.u1, S.ul); P.recol(ub.band(0, 1), [S.u1], S.u0);
    P.line([44, 104, 50, 112, 52, 124], S.d2, true, true);
    P.line([70, 104, 66, 112, 64, 124], S.d3, true, true);
    // high navy collar with gold trim
    var col = P.spoly([48, 72, 57, 74, 66, 72, 66, 80, 65, 85, 57, 87, 49, 85, 47, 80]);
    P.part(col, S.d1, S.dl);
    P.recol(col.band(4, 0), [S.d1], S.d2);
    P.recol(col.band(-1, 1), [S.d1], S.d0);
    P.recol(col.band(0, -2), [S.d1, S.d0, S.d2], S.m1);
    P.recol(col.band(0, 2).and(P.rect(0, 0, 112, 80)), [S.d1, S.d0, S.d2], S.m2);
    star4(P, 57, 105.5, 5.5, { line: S.m2, k: 0.46 });
    star4(P, 57, 80, 2, { line: S.m3 });

    // ---- near arm: top of the wide detached sleeve (white frill, navy, gold trim)
    var slv = P.spoly([4, 118, 12, 110, 26, 110, 34, 116, 38, 132, 0, 132]);
    P.part(slv, S.d1, S.dl);
    P.recol(slv.band(5, -1), [S.d1], S.d2);
    P.recol(slv.band(-1, 2), [S.d1], S.d0);
    var fr = P.sr([5, 116, 14, 110, 26, 110, 33, 115], 4, 4);
    P.part(fr, S.c1, S.cl); P.recol(fr.band(0, 1), [S.c1], S.c0); P.recol(fr.band(2, -1), [S.c1], S.c2);
    for (var fx = 6; fx < 34; fx += 3) P.px(fx, 114 + ((fx / 3) & 1), S.c2);
    P.line([5, 119, 14, 114, 26, 114, 34, 119], S.m1, true, true);
    P.line([12, 120, 9, 132], S.d2, true, true); P.line([24, 120, 27, 132], S.d2, true, true);

    // ---- head
    var skull = P.ell(SKULL[0][0], SKULL[0][1], SKULL[0][2], SKULL[0][3]).or(P.ell(SKULL[1][0], SKULL[1][1], SKULL[1][2], SKULL[1][3]));
    P.part(skull, S.h1, S.hl);

    // ---- cat ears (far first); flattened outward when she loses
    if (lose) {
      catEar(P, [64, 14, 74, 12, 86, 14, 97, 20, 92, 24, 84, 26, 77, 27], [68, 16, 76, 15, 87, 18, 92, 21, 84, 23, 76, 23], [[74, 22, 82, 20]]);
      catEar(P, [44, 13, 36, 14, 26, 18, 14, 25, 21, 29, 28, 29, 33, 28], [41, 16, 34, 17, 24, 21, 19, 25, 26, 26, 33, 25], [[34, 25, 26, 23]]);
    } else {
      catEar(P, [62, 14, 68, 8, 75, 4, 81, 1, 84, 7, 83, 16, 80, 25, 72, 22], [67, 14, 73, 9, 79, 6, 81, 11, 79, 18, 76, 21], [[72, 21, 76, 13]]);
      catEar(P, [30, 28, 25, 17, 25, 7, 27, 1, 34, 4, 41, 8, 47, 13, 38, 16], [32, 24, 29, 15, 29, 8, 32, 7, 37, 10, 41, 14], [[34, 23, 33, 14], [38, 20, 37, 14]]);
    }

    var face = P.spoly(FACEPTS);
    P.part(face, S.s1, S.sl);
    P.recol(neck.and(face.shift(-1, 5)).sub(face), [S.s1], S.s2);
    P.recol(face.band(2, 0).and(P.rect(0, 30, 44, 40)), [S.s1], S.s2);
    P.recol(face.band(2, -2).and(P.rect(36, 60, 30, 20)), [S.s1, S.s2], S.s2);

    // ---- face features: rose-red near eye, gold far eye
    P.map(40, 40, lose ? EYES.nearLose : win ? EYES.nearWin : EYES.near, EL);
    P.map(62, 40, lose ? EYES.farLose : EYES.far, EL2);
    P.px(71, 56, S.s2); P.px(71, 57, S.sl);
    if (win) P.map(56, 63, MOUTHS.grin, EL);
    else if (lose) P.map(57, 64, MOUTHS.pout, EL);
    else P.map(57, 63, MOUTHS.sly, EL);
    var bl = [[42, 56], [44, 56], [46, 56], [43, 57], [45, 57], [66, 56], [68, 56], [67, 57]];
    bl.forEach(function (p) { if (P.get(p[0], p[1]) === S.s1) P.px(p[0], p[1], lose || win ? S.bl : S.blS); });

    // ---- fringe: soft wavy bangs, a strand between the eyes; cast shadow first
    var fringe = P.mask();
    FR.forEach(function (c) { fringe = fringe.or(P.sr(c[0], c[1], c[2], c[3])); });
    P.recol(fringe.shift(-1, 2).or(fringe.shift(0, 2)), [S.s1], S.s2);
    FR.forEach(function (c) { HH.hairClump(P, c, S.h1); });
    P.recol(skull.band(5, -4), [S.h1], S.h2);
    var ring = P.ell(55, 34, 24, 20).sub(P.ell(56, 37, 24, 20)).and(skull);
    for (var gx = 0; gx < 112; gx += 6) ring = ring.sub(P.rect(gx, 0, 2, 40));
    P.recol(ring, [S.h1], S.h0);
    if (lose) { P.line([42, 38, 46, 37, 51, 35], S.hl); P.line([63, 35, 66, 37, 69, 38], S.hl); }
    else if (!win) { P.line([42, 38, 46, 37, 51, 38], S.hl); P.line([63, 38, 66, 37, 69, 38], S.hl); }

    // ---- wavy face-framing locks in front of the shoulders
    HH.hairClump(P, [[31, 60, 25, 74, 28 + sw, 88, 21 + sw, 100, 24 + sw * 2, 112, 18 + sw * 2, 124, 21 + sw * 2, 134], 7, 3, 8, 0], S.h1);
    HH.hairClump(P, [[34, 40, 29, 54, 31, 66, 26, 78, 29 + sw, 90, 25 + sw, 101, 27 + sw * 2, 110, 25 + sw * 2, 116, 22 + sw * 2, 117], 10, 1.5, 11, 0, [0.08, 0.3]], S.h1);
    HH.strands(P, [[31, 50, 28, 60, 30, 70, 27, 80, 29 + sw, 90, 26 + sw, 100]], S.h2);
    HH.hairClump(P, [[37, 30, 35, 44, 37, 56, 34, 66, 35, 72, 37, 74], 5, 1, 6, 0], S.h1);
    HH.hairClump(P, [[76, 30, 80, 44, 79, 56, 83, 68, 81 + sw, 80, 85 + sw, 92, 83 + sw * 2, 104], 9, 1.5, 10, 0, [0.08, 0.3]], S.h1);
    HH.strands(P, [[79, 46, 81, 58, 80, 66, 83, 76]], S.h2);

    // ---- side bun + star clip (far side)
    var bun = P.ell(87, 27, 6.5, 6);
    HH.hairClump(P, [[82, 24, 88, 21, 93, 26, 90, 32, 84, 31], 4, 4, 5, 0], S.h1);
    P.part(bun.sub(P.solid().sub(bun)), S.h1, S.hl);
    star4(P, 85, 19, 7, { rot: 0.15 });

    // ---- ahoge
    var aho = lose ? P.sr([51, 12, 50, 7, 46, 5, 43, 7], 3.6, 1.8) : P.sr([51, 12, 51, 6, 48, 2, 44, 1, 42, 3, 43, 5], 4, 1.6);
    P.part(aho, S.h1, S.hl); P.recol(aho.band(-1, 1), [S.h1], S.h0);

    // ---- raised far arm: wide sleeve hanging open, finger to the cheek (or peace sign)
    if (!lose) farArm(P, win);
    else farSleeveLow(P);

    hairShift(P, 70, 124, tl);
    P.outer(S.ol);

    if (win) {
      star4(P, 98, 12, 6, { rot: 0.2 }); star4(P, 14, 16, 5); star4(P, 104, 40, 3);
      star4(P, 8, 40, 2); star4(P, 92, 30, 2);
    } else if (lose) {
      // drooping star + a little "?"
      star4(P, 98, 16, 5, { rot: 0.6, k: 0.36 });
      P.map(84, 4, ['.ooo.', 'oWWWo', 'oWooWo', '.o.oWo', '..oWo', '..oWo', '..ooo', '..oWo', '..ooo'], { o: S.ul, W: S.a0 });
      P.map(77, 32, ['.r.', 'rRr', 'rRR', '.R.'], EL);
    } else {
      star4(P, 13, 16, 6, { rot: 0.1 }); star4(P, 104, 40, 3);
    }
  }

  // raised far arm: the bell sleeve falls open toward the elbow (violet lining inside, white cuff,
  // gold trim); bare forearm; hand with the index finger to the cheek, or a peace sign (win)
  function farArm(P, win) {
    var bell = P.spoly([80, 88, 87, 85, 95, 86, 100, 90, 105, 100, 110, 112, 114, 132, 70, 132, 73, 114, 77, 98]);
    P.part(bell, S.d1, S.dl);
    P.recol(bell.band(5, -1), [S.d1], S.d2);
    P.recol(bell.band(-1, 2), [S.d1], S.d0);
    P.line([84, 94, 80, 112, 82, 132], S.d2, true, true); P.line([92, 94, 92, 112, 95, 132], S.d2, true, true);
    // the flared back edge turns over: violet lining wedge with a white cuff edge and gold trim
    var lin = P.spoly([97, 88, 102, 96, 107, 108, 112, 122, 113, 132, 103, 132, 102, 116, 99, 102, 96, 92]).and(bell);
    P.part(lin, S.u1, S.ul); P.recol(lin.band(3, 0), [S.u1], S.u2); P.recol(lin.band(-1, 1), [S.u1], S.u0);
    P.line([96, 90, 99, 102, 102, 116, 103, 132], S.c1, true);
    P.line([97, 90, 100, 102, 103, 116, 104, 132], S.m1, true);
    var open = P.ell(88.5, 87, 9, 3.4, -0.18), inside = P.ell(88.5, 87.4, 6.6, 2, -0.18);
    P.part(open, S.c1, S.m2); P.fill(inside, S.u3);
    var fa = P.sr([89, 89, 87.5, 84, 85.5, 78], 7, 6.4);
    P.part(fa, S.s1, S.sl); P.recol(fa.band(3, 0), [S.s1], S.s2); P.recol(fa.band(-1, 0), [S.s1], S.s0);
    var front = open.and(P.rect(0, 87, 112, 6)).sub(fa.and(P.rect(0, 0, 112, 87)));
    P.part(front, S.c1, S.m2); P.recol(front.band(0, -1), [S.c1], S.c0);
    P.line([80, 89, 85, 91, 91, 91, 97, 88], S.m1, true, true);
    if (win) {
      // peace sign: index + middle finger spread up, the rest folded
      var palm = P.spoly([81, 79, 80, 73, 83, 69, 88, 69, 91, 73, 90, 78, 86, 80]);
      var f1 = P.sr([83, 70, 81, 64, 79.5, 59], 3.2, 2.4), f2 = P.sr([87, 70, 89, 64, 91, 59.5], 3.2, 2.4);
      var th = P.sr([81.5, 76, 84, 74, 86.5, 73], 3, 2.4);
      var hand = palm.or(f1).or(f2);
      P.part(hand, S.s1, S.sl); P.recol(hand.band(2, -1), [S.s1], S.s2); P.recol(hand.band(-1, 1), [S.s1], S.s0);
      P.part(th, S.s1, S.sl);
      P.line([84, 71, 86, 71], S.s2);
    } else {
      // loose fist at the jaw, index finger reaching up-left to touch the cheek
      var pm = P.spoly([79, 78, 78, 72, 80, 67.5, 85, 66.5, 88.5, 69, 88.5, 74, 85, 78.5]);
      var idx = P.sr([80.5, 69, 77, 66, 74, 63.5, 72, 62.6], 3.4, 2.4);
      var curl = P.ell(86, 69.5, 2.1, 1.9).or(P.ell(86.8, 73, 2, 1.9)).or(P.ell(85.6, 76.4, 1.8, 1.7));
      var hd = pm.or(idx).or(curl);
      P.part(hd, S.s1, S.sl);
      P.recol(hd.band(2, -1), [S.s1], S.s2);
      P.recol(hd.band(-1, 1), [S.s1], S.s0);
      P.line([83, 69, 85, 69], S.s2); P.line([84, 72.5, 86, 72.5], S.s2); P.line([83.5, 76, 85, 76], S.s2);
      P.px(72, 62, S.bl);
    }
  }
  function farSleeveLow(P) {
    var bell = P.spoly([80, 104, 88, 100, 98, 99, 106, 102, 110, 110, 112, 132, 74, 132, 76, 116]);
    P.part(bell, S.d1, S.dl);
    P.recol(bell.band(5, -1), [S.d1], S.d2);
    P.recol(bell.band(-1, 2), [S.d1], S.d0);
    var band = P.sr([80, 106, 88, 101.5, 98, 100.5, 106, 103], 3.6, 3.6);
    P.part(band, S.c1, S.m2); P.recol(band.band(0, 1), [S.c1], S.c0);
    P.line([88, 106, 86, 132], S.d2, true, true); P.line([98, 106, 100, 132], S.d2, true, true);
  }

  // ---------------------------------------------------------------- emblem: four-pointed star with cat ears
  function emblem(P, size) {
    var s = size / 16, cx = 8 * s - 0.5, cy = 9.2 * s - 0.5;
    // ears sit on the star's upper inner corners, like a cat head
    var eL = P.poly([3.4 * s, 8.2 * s, 2.4 * s, 0.8 * s, 7.6 * s, 4.6 * s]), eR = P.poly([12.6 * s, 8.2 * s, 13.6 * s, 0.8 * s, 8.4 * s, 4.6 * s]);
    P.part(eL.or(eR), S.u1, S.ul);
    P.recol(eL.or(eR).band(-1, 1), [S.u1], S.u0);
    if (size >= 32) {
      P.fill(P.poly([7.6, 13, 6.4, 5, 12.4, 8.8]), S.z1); P.fill(P.poly([24.4, 13, 25.6, 5, 19.6, 8.8]), S.z1);
      P.fill(P.poly([7.6, 13, 7, 9, 10, 11]), S.z2); P.fill(P.poly([24.4, 13, 25, 9, 22, 11]), S.z2);
    } else { P.px(3, 3, S.z1); P.px(3, 4, S.z1); P.px(4, 4, S.z1); P.px(12, 3, S.z1); P.px(12, 4, S.z1); P.px(11, 4, S.z1); }
    star4(P, cx, cy, 7 * s, { k: 0.42, inner: 1, line: S.ul,
      cols: [S.a0, S.a1, S.u1, S.a2, S.u2, S.u1, S.a1, S.u0] });
    if (size >= 32) {
      var core = P.ell(cx, cy, 3.2, 3.2);
      P.fill(core, S.q1); P.fill(core.and(P.rect(cx, 0, 9, 32)), S.q2); P.fill(core.and(P.rect(0, cy, 32, 9)), S.q3);
      P.fill(core.and(P.rect(cx, cy, 9, 9)), S.q0);
      P.px(Math.round(cx - 1), Math.round(cy - 2), S.W); P.px(Math.round(cx), Math.round(cy - 1), S.W);
    } else { P.px(7, 8, S.W); P.px(8, 8, S.q1); P.px(7, 9, S.q2); P.px(8, 9, S.q3); }
    P.outer(S.ol);
  }

  // ---------------------------------------------------------------- cut-in hooks (see cutin.js)
  // Q = the x2.8 painter in bust coordinates; visible window = x 1-87, y 37-63
  function cutinFace(Q) {
    var HH = I.H, i;
    Q.part(Q.rect(4, 20, 104, 60), S.h2, S.hl);
    Q.recol(Q.rect(4, 20, 104, 60).band(-6, 0), [S.h2], S.h3);
    HH.strands(Q, [[86, 30, 90, 44, 87, 56, 91, 70], [93, 30, 97, 46, 94, 58, 98, 70], [22, 30, 17, 44, 21, 56, 16, 70]], S.h3);
    Q.part(Q.ell(53, 37, 25, 26).or(Q.ell(47, 42, 21, 23)), S.h1, S.hl);
    var f = Q.spoly(FACEPTS);
    Q.part(f, S.s1, S.sl); Q.recol(f.band(4, 0), [S.s1], S.s2); Q.recol(f.band(-2, 0), [S.s1], S.s0);
    var E = [{ x: 46, y: 48.5, w: 12, h: 10 }, { x: 66.4, y: 48.5, w: 8.4, h: 10 }];
    E.forEach(function (e, k) {
      I.bigEye(Q, e, k === 0, { lid: 0.36, fierce: true });
      // cat slit pupil: clear the round pupil, draw a narrow vertical slit + glint
      var ix = e.x + e.w * 0.08, iy = e.y + e.h * 0.06, rx = e.w * (k === 0 ? 0.3 : 0.34), ry = e.h * 0.52;
      var iris = Q.ell(ix, iy, rx - 0.5, ry - 0.5);
      Q.recol(iris, [S.lash], S.e2);
      Q.recol(Q.ell(ix, iy + 0.4, rx * 0.2, ry * 0.66).and(iris), [S.e0, S.e1, S.e2, S.e3, S.eK], S.lash);
      Q.recol(Q.ell(ix + rx * 0.42, iy - ry * 0.05, 0.5, ry * 0.36).and(iris), [S.e0, S.e1, S.e2, S.e3], S.W);
      if (k === 1) {
        var R = Q.rect(e.x - 6, e.y - 7, 12, 14), from = [S.e0, S.e1, S.e2, S.e3, S.eK], to = [S.g0, S.g1, S.g2, S.g3, S.gK];
        for (i = 0; i < 5; i++) Q.recol(R, [from[i]], to[i]);
      }
    });
    // glint streaks from the outer corners (rose on the near eye, gold on the far)
    Q.fill(Q.sr([39.6, 47.4, 35, 46.6, 29, 46.4], 0.9, 0.3), S.e0);
    Q.fill(Q.sr([70.8, 47.4, 74, 46.4, 78, 46], 0.8, 0.3), S.g0);
    // sly brows: inner ends raised a touch, outer ends down
    Q.fill(Q.sr([40.2, 41.6, 46, 40.6, 51.8, 41.4], 1.1, 1.5, 1.5), S.hl);
    Q.fill(Q.sr([62.4, 41.4, 66, 40.6, 69.6, 41.6], 1.4, 0.9, 1.3), S.hl);
    Q.line([71, 57, 71.4, 58.2], S.s2); Q.px(Q.tx(71.2), Q.ty(58.6), S.sl);
    [[43, 56.5], [45, 56.5], [47, 56.5], [67, 56.5], [69, 56.5]].forEach(function (p) { Q.line([p[0], p[1], p[0] - 1.2, p[1] + 1.6], S.bl); });
    var fr = Q.mask();
    FR.forEach(function (c) { fr = fr.or(Q.sr(c[0], c[1], c[2], c[3])); });
    Q.recol(fr.shift(-2, 6).or(fr.shift(0, 6)), [S.s1, S.s0], S.s2);
    // cat ears (cheated down so their lower halves cut into the top of the frame), bases under the fringe
    FR.forEach(function (c) { HH.hairClump(Q, c, S.h1); });
    // hair sweeping across the sides
    HH.hairClump(Q, [[36, 36, 30, 48, 32, 58, 26, 66, 22, 72], 10, 5, 11, 0, [0.1, 0.6]], S.h1);
    HH.hairClump(Q, [[76, 32, 81, 44, 79, 54, 84, 62, 90, 68], 9, 5, 10, 0, [0.1, 0.6]], S.h1);
    HH.hairClump(Q, [[16, 36, 10, 46, 13, 56, 6, 66], 7, 3, 8, 0], S.h2);
    catEar(Q, [26, 46, 23, 38, 23, 30, 25, 26, 31, 28, 37, 32, 41, 37, 34, 43], [28, 42, 26, 35, 26, 30, 29, 30, 33, 32, 37, 36], [[30, 42, 29, 35], [34, 40, 33, 35]]);
    catEar(Q, [73, 39, 78, 34, 84, 30, 90, 27, 92, 33, 91, 41, 88, 47, 81, 44], [77, 39, 83, 34, 88, 31, 89, 36, 87, 42, 84, 44], [[82, 43, 86, 36]]);
    // colour shift toward violet at the lower sides (pixel coordinates)
    shiftBy(Q, null, function (x, y) { return y + 0.42 * Math.abs(x - 150); }, 62, 999);
  }
  // band motif: a huge faint four-pointed star behind the face, constellation lines + nodes
  function cutinMotif(P) {
    function st(cx, cy, r, k) { var pts = []; for (var i = 0; i < 8; i++) { var a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * k : r; pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } return P.poly(pts); }
    P.fill(st(36, 36, 110, 0.16), S.a2);
    P.fill(st(36, 36, 62, 0.18), S.a3);
    P.fill(st(36, 36, 46, 0.18), S.a2);
    var C = [[8, 52], [22, 40], [36, 46], [50, 30], [64, 18], [84, 10], [196, 8], [214, 22], [232, 14], [226, 50], [206, 64]];
    [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 7], [7, 8], [7, 9], [9, 10]].forEach(function (e) {
      P.line([C[e[0]][0], C[e[0]][1], C[e[1]][0], C[e[1]][1]], S.a1);
    });
    C.forEach(function (c, i) { var x = c[0], y = c[1]; P.px(x, y, S.W); P.px(x - 1, y, S.a0); P.px(x + 1, y, S.a0); P.px(x, y - 1, S.a0); P.px(x, y + 1, S.a0); });
  }
  // over the finished band: streaking iridescent stars with trails
  function cutinOver(P) {
    [[70, 10, 4.5, 30], [228, 58, 5, 12], [24, 62, 3, 18], [206, 7, 2.5, 8]].forEach(function (q) {
      var x = q[0], y = q[1], r = q[2];
      for (var t = 2; t < q[3]; t++) if (t < 10 || t % 3) P.px(x - r - t, y, t < 10 ? S.a0 : S.a1);
      star4(P, x, y, r, { line: S.ol });
    });
  }

  // ---------------------------------------------------------------- face icon 24x24 (hand-typed)
  var FACE = [
    '..o.............o.......',
    '.oJo...........oHo......',
    '.oPHo..ooooo..oPPHo.....',
    '.oPpHohJJJJJhhoPpHo.....',
    '.oPpHHJJHHHJJHHPHHo.....',
    '.ohHHJHHHHHHHJJHHho.....',
    '..hHHHHHHHHHHHHHHHh.....',
    '..hHHHHHHHhHHHHHHHh.....',
    '.hHHHHHHHhfhHHHhHHHh....',
    '.hHHHHHHhffhHHhffhHHh...',
    'ohHHHhKKKKfffhKKKfhHHh..',
    'ohGhHKrWRKffffKyWfhGHh..',
    'oVGfhwRRRwfffwYYwfhGVh..',
    'oVVfhfffffffffffffhVVh..',
    'oVVhffbbfffffffbbfhVVh..',
    'oVvhhffffffnmmfffhVVVh..',
    'oVvVhfffffffffffhVVvVh..',
    'ovVVhhfffffffffhhVvVVh..',
    'ovVVVhhhffffffhhhVVvVh..',
    'oTvVVheeDMDDDMDehVVvVh..',
    'oTTvheffDDDqDDDfehVTvh..',
    'oTThefffDDDDDDDDfehTTh..',
    'oThefffDDdDDDDDDDffhTh..',
    'ohefffDDDDdDDDDDDDffeh..'
  ];
  var FL = { o: S.ol, h: S.hl, H: S.h1, J: S.h0, G: S.h2, V: S.x1, v: S.x2, T: S.t1, P: S.z1, p: S.z2, f: S.s1, e: S.s2,
    K: S.lash, r: S.e2, R: S.e1, W: S.W, y: S.g2, Y: S.g1, w: S.ew, b: S.bl, n: S.sl, m: S.mo, D: S.d1, d: S.d2, M: S.m1, q: S.q1 };
  function face(P) { P.map(0, 0, FACE, FL); }

  I.ART.gemini = {
    bust: function () { var P = K.painter(112, 128); drawBust(P, {}); return P; },
    bustWin: function () { var P = K.painter(112, 128); twin(P, 30, 2); var Q = K.painter(112, 128); drawBust(Q, { expr: 'win' }); P.blit(Q, 0, 0); return P; },
    bustLose: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'lose' }); return P; },
    titleFrame: function (o) { var P = K.painter(112, 128); drawBust(P, o); return P; },
    cutin: function () { return I.cutin ? I.cutin('gemini') : K.painter(240, 72); },
    face: function () { var P = K.painter(24, 24); face(P); return P; },
    emblem: emblem,
    cutinFace: cutinFace, cutinMotif: cutinMotif, cutinOver: cutinOver, cutinCfg: { seed: 53 }
  };
  I.drawGeminiBust = drawBust;
  I.ART.gemini.head = { FR: FR, face: FACEPTS, skull: SKULL };
})();
