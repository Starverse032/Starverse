/* LATENT CLASH — ILLUST: GPT 娘 portraits, V2.5 design (ZipZipPipe's 白发龙娘).
 * bust / bustWin / bustLose / face here; cut-in face + motif hooks for cutin.js. Same construction,
 * head size and light (upper right) as the other two. Three-quarter view facing right.
 * Slots: h* hair (white), e* eye (lavender), c* cloth1 (white gown), d* cloth2 (silver-grey),
 * x* scale (horns, wing bones), u* wing membrane, z* blob, a* accent (teal magic), m* metal. */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit, S = K.S;
  I.ART = I.ART || {};

  var EL = { K: S.lash, k: S.eK, D: S.e3, s: S.e2, B: S.e1, H: S.e0, w: S.ew, W: S.W, P: S.lash, x: S.s2, l: S.sl, y: S.s3,
    b: S.bl, c: S.blS, m: S.mo, t: S.tg, n: S.sl, r: S.tear, R: S.tear2, h: S.hl, o: S.ol, Z: S.z3, z: S.zl };
  var EYES = {
    // cool, half-lidded: the upper lid sits low and level over the iris, lid crease above
    near: [
      '............',
      '..xxxxxxxx..',
      '.KKKKKKKKKKK',
      'KKKKkDDDDkKK',
      'K.wDDsPPsDkw',
      '..wDsPPPWWDw',
      '..wsBPPPWWsw',
      '..wBBBPBBHBw',
      '...wHHBBHHw.',
      '....llllll..'
    ],
    far: [
      '.........',
      '..xxxxx..',
      'KKKKKKKK.',
      'KKKKKKKKK',
      'wkDDDDkKK',
      'wDsPPsDw.',
      'wsPPPWWw.',
      'wBBPBBBw.',
      '.wHHBHw..',
      '..llll...'
    ],
    // win: eyes closed, serene and a little smug (level lids, lashes hanging)
    nearWin: [
      '............',
      '............',
      '............',
      '..xxxxxxxx..',
      '............',
      '.KKKKKKKKKK.',
      'KK.KKKKKKKKK',
      'K..y.y.y.y..',
      '............',
      '............'
    ],
    farWin: [
      '.........',
      '.........',
      '.........',
      '..xxxxx..',
      '.........',
      'KKKKKKKK.',
      'KKKKKKKKK',
      '.y.y.y..K',
      '.........',
      '.........'
    ],
    // lose: flustered — eyes snapped wide, small shaky pupils, wet lower rim
    nearLose: [
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
    calm: ['nmn', '.x.'],
    smirk: ['....n', 'nnmn.', '.xx..'],
    fluster: ['.n.n.', 'n.n.n']
  };

  // head geometry shared by bust and cut-in (bust pixel coordinates)
  var FR = [
    [[50, 12, 62, 16, 72, 25, 77, 36, 78, 46], 13, 0, 13],
    [[49, 13, 58, 20, 64, 30, 66, 38, 64, 44], 12, 0, 12],
    [[48, 13, 53, 24, 57, 34, 58, 43, 56, 52], 9, 0, 9],
    [[47, 14, 48, 24, 50, 33, 49, 40], 8, 0, 8],
    [[46, 13, 40, 19, 37, 28, 36, 38, 38, 44], 11, 0, 10],
    [[46, 14, 43, 24, 43, 33, 45, 40], 7, 0, 7]
  ];
  var FACEPTS = [36, 27, 33, 37, 33, 47, 35, 55, 40, 62, 46, 67.5, 52, 72.5, 56.5, 75.5, 60.5, 76, 64, 73.5, 69, 68, 73, 62, 76, 55, 77.5, 49, 77, 43, 77.5, 36, 76, 29, 64, 25, 46, 25];
  var SKULL = [[53, 37, 25, 26], [47, 42, 21, 23]];

  // ---------------------------------------------------------------- helpers
  // point + tangent along a smoothed spine at fraction t (design coords)
  function along(pts, t) {
    var p = K.bez(K.smooth(pts), 24), n = (p.length >> 1) - 1, i = Math.max(0, Math.min(n - 1, Math.floor(t * n)));
    var x = p[i * 2], y = p[i * 2 + 1], dx = p[i * 2 + 2] - x, dy = p[i * 2 + 3] - y, l = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: x, y: y, tx: dx / l, ty: dy / l };
  }
  // curved, ribbed dragon horn in the scale ramp; spine from base to tip
  function horn(P, pts, w, ridges) {
    var m = P.sr(pts, w, 1.9, w * 0.72), nr = ridges || 5;
    P.part(m, S.x1, S.x3);
    P.recol(m.band(3, -1), [S.x1], S.x2);
    P.recol(m.band(-1, 2), [S.x1], S.x0);
    P.recol(m.edge().and(m.band(2, -1)), [S.x3], S.xl);
    for (var k = 1; k <= nr; k++) {
      var t = k / (nr + 1.2), a = along(pts, t), hw = (w * (1 - t) * (1 - t) + 2 * w * 0.72 * t * (1 - t) + 1.9 * t * t) / 2 + 1;
      var nx = -a.ty, ny = a.tx, q = P.s < 1.5 ? 0.9 : 0.5;
      var r = P.poly([a.x + nx * hw, a.y + ny * hw, a.x - nx * hw + a.tx * 0.6, a.y - ny * hw + a.ty * 0.6,
        a.x - nx * hw + a.tx * (0.6 + q), a.y - ny * hw + a.ty * (0.6 + q), a.x + nx * hw + a.tx * q, a.y + ny * hw + a.ty * q]).and(K.inner(m));
      P.recol(r, [S.x1, S.x0], S.x2);
      P.recol(r.shift(Math.round(a.tx), Math.round(a.ty)).and(K.inner(m)).sub(r), [S.x1], S.x0);
    }
    return m;
  }
  // knot rosette: n interlaced cord rings around a small centre knot — white cord, dark line work,
  // recessed backing in the loop holes. Neighbouring rings weave: over at the rim, under near the
  // centre. Our own design. o = {line, t (cord thickness), d, ro, core}
  function knot(P, cx, cy, r, n, rot, o) {
    o = o || {};
    var L = o.line || S.d2, rg = [], all = P.mask(), i, d = r * (o.d || 0.42), ro = r * (o.ro || 0.56), t = o.t || Math.max(2, r * 0.22);
    for (i = 0; i < n; i++) {
      var a = rot + i * Math.PI * 2 / n, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
      var O = P.ell(px, py, ro, ro), Hh = o.small ? P.ell(px + Math.cos(a) * 0.4, py + Math.sin(a) * 0.4, o.hole || 0.9, o.hole || 0.9) : P.ell(px, py, ro - t, ro - t);
      rg.push({ O: O, H: Hh }); all = all.or(O);
    }
    if (o.ring) P.fill(all.grow(1).sub(all).and(P.solid()), o.ring);
    P.fill(all, o.small ? L : S.c3);
    function ring(p, clip) {
      var cord = p.O.sub(p.H), e = o.small ? p.O.edge() : p.O.edge().or(p.H.grow(1).and(p.O).sub(p.H));
      if (clip) { cord = cord.and(clip); e = e.and(clip); }
      P.fill(cord, S.c0); P.fill(e, L);
    }
    if (o.small) {
      // tiny: no weave (it turns into a pinwheel) — scalloped loops, hole dots, notch lines
      P.fill(all, S.c0);
      for (i = 0; i < n; i++) {
        P.fill(rg[i].H, L);
        var na = rot + (i + 0.5) * Math.PI * 2 / n;
        if (!o.noNotch) P.line([cx + Math.cos(na) * r * 0.86, cy + Math.sin(na) * r * 0.86, cx + Math.cos(na) * r * 0.5, cy + Math.sin(na) * r * 0.5], L);
      }
    } else {
      for (i = 0; i < n; i++) ring(rg[i]);
      var inn = P.ell(cx, cy, d, d), out = all.sub(inn);
      ring(rg[0], rg[n - 1].O.and(out));
      for (i = 0; i < n; i++) ring(rg[(i + n - 1) % n], rg[i].O.and(inn));
    }
    P.recol(all.band(2, -2), [S.c0], S.c1);
    P.recol(all.band(1, -1).and(all.band(2, -2)), [S.c1], S.c2);
    var core = P.ell(cx, cy, r * (o.core || 0.2), r * (o.core || 0.2));
    P.part(core, S.c0, L);
    if (r >= 10) P.px(Math.round(cx), Math.round(cy - 1), S.W);
    return all;
  }
  I.gptEmblem = function (P, size) {
    if (size >= 32) knot(P, 16, 16, 15, 5, -Math.PI / 2, {});
    else knot(P, size / 2, size / 2, size * 0.465, 5, -Math.PI / 2, { small: 1, d: 0.58, ro: 0.44, hole: 1.2, core: 0.3, noNotch: 1 });
    P.outer(S.ol);
  };
  I.knot = knot;

  // bat-like wing rising behind the near shoulder; droop (radians) lowers it outward
  function wing(P, droop) {
    var bx = 26, by = 102, a = droop || 0, ca = Math.cos(a), sa = Math.sin(a), dy = droop ? 14 : 0;
    function R(pts) { var o = []; for (var i = 0; i < pts.length; i += 2) { var x = pts[i] - bx, y = pts[i + 1] - by; o.push(bx + x * ca - y * sa, by + x * sa + y * ca + dy); } return o; }
    var mem = P.poly(R([28, 100, 9, 36, -6, 18, -10, 44, -4, 56, 1, 57, 5, 64, 5, 80, 10, 79, 14, 86, 22, 96]));
    P.part(mem, S.u1, S.ul);
    P.recol(mem.band(3, -1), [S.u1], S.u2);
    P.recol(mem.band(2, -1), [S.u2], S.u3);
    P.recol(mem.band(-1, 2), [S.u1], S.u0);
    P.line(R([9, 40, 5, 48, 1, 56]), S.u2, true, true);
    P.line(R([10, 42, 10, 58, 7, 76]), S.u2, true, true);
    P.line(R([12, 46, 15, 66, 14, 84]), S.u2, true, true);
    var bones = P.sr(R([28, 104, 19, 72, 9, 36]), 5, 3).or(P.sr(R([9, 36, 2, 26, -6, 18]), 3, 1.2))
      .or(P.sr(R([9, 36, 1, 46, -4, 56]), 2.6, 1.2)).or(P.sr(R([9, 36, 8, 58, 5, 80]), 2.6, 1.2));
    P.part(bones, S.x1, S.xl);
    P.recol(bones.band(-1, 1), [S.x1], S.x0);
    P.recol(bones.band(2, -1), [S.x1], S.x2);
    var claw = P.sr(R([9, 36, 12, 30, 10, 25]), 3.4, 0.6);
    P.part(claw, S.x0, S.xl);
  }

  // the little blue blob companion; mood: 'n' | 'win' | 'lose'
  function blob(P, x, y, mood) {
    var m = P.ell(x, y + 1, 7, 5.5).or(P.ell(x - 4, y - 3, 3.6, 3.6)).or(P.ell(x + 1, y - 4.5, 4.2, 3.6)).or(P.ell(x + 5, y - 2, 3.4, 3.4));
    if (mood === 'win') m = P.ell(x, y, 6, 6.5).or(P.ell(x - 3.5, y - 5, 3.4, 3.4)).or(P.ell(x + 3, y - 6, 3.6, 3.4));
    P.part(m, S.z1, S.zl);
    P.recol(m.band(3, -2), [S.z1], S.z2);
    P.recol(m.band(-1, 2), [S.z1], S.z0);
    P.recol(m.band(-1, 1).and(P.rect(x + 1, y - 9, 8, 6)), [S.z0], S.W);
    if (mood === 'win') {
      P.map(x - 4, y - 2, ['.Z...Z.', 'Z.Z.Z.Z'], EL);
      P.map(x - 2, y + 2, ['ZzZ'], EL);
    } else if (mood === 'lose') {
      P.map(x - 5, y - 3, ['.ZZ..ZZ.', 'Z.Z.Z.Z.', 'ZZ...ZZ.'], EL);
    } else {
      P.map(x - 3, y - 3, ['Z..Z', 'Z..Z', 'Z..Z'], EL);
      P.px(x - 3, y - 3, S.W); P.px(x, y - 3, S.W);
    }
    return m;
  }

  // ---------------------------------------------------------------- bust
  function drawBust(P, o) {
    var expr = o.expr || 'n', sw = o.sway || 0, H = I.H;
    var lose = expr === 'lose', win = expr === 'win';

    // ---- wing behind the near shoulder
    wing(P, lose ? 0.12 : 0);

    // ---- back hair: long, voluminous, wavy curtain
    var back = P.spoly([54, 12, 38, 14, 29, 22, 24, 34, 21, 48, 18, 58, 19, 68, 14, 78, 15, 88, 9 + sw, 100, 11 + sw, 110, 6 + sw * 2, 122, 5 + sw * 2, 132,
      108 + sw * 2, 132, 107 + sw * 2, 122, 102 + sw, 110, 104 + sw, 100, 98, 88, 100, 78, 94, 66, 96, 56, 92, 46, 88, 34, 82, 22, 70, 14]);
    P.part(back, S.h2, S.hl);
    P.recol(back.band(4, -1), [S.h2], S.h3);
    var nape = P.spoly([38, 60, 48, 66, 66, 66, 78, 60, 82, 90, 80, 132, 34, 132, 32, 90]).and(back);
    P.recol(nape, [S.h2], S.h3);
    [[[24, 44, 18, 58, 20, 70, 14 + sw, 84, 16 + sw, 98, 11 + sw * 2, 112, 13 + sw * 2, 132], 9, 5, 10, 0, [0.15, 0.6]],
      [[32, 52, 27, 66, 30, 80, 25 + sw, 94, 28 + sw, 108, 24 + sw * 2, 132], 8, 4, 9, 0],
      [[86, 40, 92, 54, 90, 66, 96 + sw, 80, 94 + sw, 94, 100 + sw * 2, 110, 98 + sw * 2, 132], 9, 5, 10, 0, [0.15, 0.6]]
    ].forEach(function (c) { H.hairClump(P, c, S.h2); });

    // ---- far horn (base hidden behind the head)
    horn(P, [71, 21, 74, 12, 72, 6, 66, 2.5, 59, 2.5], 9, 5);

    // ---- body: bare shoulders, sleeveless high-collared bodice
    var neck = P.poly([50, 60, 62, 60, 63, 84, 50, 84]);
    P.part(neck, S.s1, S.sl);
    var sh = P.spoly([46, 80, 68, 80, 80, 86, 90, 92, 96, 104, 98, 132, 14, 132, 16, 104, 22, 92, 34, 86]);
    P.part(sh, S.s1, S.sl);
    P.recol(sh.band(4, -1), [S.s1], S.s2);
    P.recol(sh.band(-1, 2), [S.s1], S.s0);
    var bod = P.spoly([47, 84, 66, 84, 70, 92, 73, 104, 75, 116, 77, 132, 36, 132, 38, 116, 40, 104, 43, 92]);
    P.recol(bod.shift(-2, 1).sub(bod), [S.s1, S.s0], S.s2);
    P.part(bod, S.c1, S.cl);
    P.recol(bod.band(5, 0), [S.c1], S.c2);
    P.recol(bod.band(-2, 1), [S.c1], S.c0);
    P.line([42, 104, 47, 108, 54, 108], S.c2, true, true);
    P.line([60, 108, 66, 107, 71, 103], S.c2, true, true);
    // diamond cut-out with silver edging, seam of tiny diamonds below
    var cut = P.poly([57, 89, 61.5, 96, 57, 103, 52.5, 96]);
    P.part(cut, S.s1, S.dl);
    P.recol(cut.band(0, -2).and(cut), [S.s1], S.s2);
    P.line([57, 104, 57, 132], S.c2);
    [110, 117, 124].forEach(function (y) { P.px(56, y, S.m2); P.px(58, y, S.m2); P.px(57, y - 1, S.m0); P.px(57, y + 1, S.m2); P.px(57, y, S.m1); });
    // high collar, silver trim, small platinum clasp
    var col = P.spoly([48, 72, 57, 74, 66, 72, 66, 80, 65, 87, 57, 89, 49, 87, 47, 80]);
    P.part(col, S.c1, S.cl);
    P.recol(col.band(4, 0), [S.c1], S.c2);
    P.recol(col.band(-1, 1), [S.c1], S.c0);
    P.recol(col.band(0, -2), [S.c1, S.c0, S.c2], S.d1);
    P.recol(col.band(0, 2).and(P.rect(0, 0, 112, 80)), [S.c1, S.c0, S.c2], S.d0);
    P.part(P.poly([57, 79, 59, 82, 57, 85, 55, 82]), S.m1, S.ml); P.px(57, 81, S.m0);
    // near arm: top of the detached frilled sleeve on the upper arm
    var slv = P.spoly([6, 116, 14, 110, 26, 110, 32, 116, 36, 132, 2, 132]);
    P.part(slv, S.c1, S.cl);
    P.recol(slv.band(5, -1), [S.c1], S.c2);
    P.recol(slv.band(-1, 2), [S.c1], S.c0);
    var bandN = P.sr([7, 114, 16, 110, 26, 110, 32, 114], 3, 3);
    P.part(bandN, S.d1, S.dl); P.recol(bandN.band(0, 1), [S.d1], S.d0);
    for (var fx = 6; fx < 34; fx += 3) P.px(fx, 117 + ((fx / 3) & 1), S.c2);
    P.line([12, 118, 10, 132], S.c2, true, true); P.line([22, 118, 24, 132], S.c2, true, true);

    // ---- head
    var skull = P.ell(SKULL[0][0], SKULL[0][1], SKULL[0][2], SKULL[0][3]).or(P.ell(SKULL[1][0], SKULL[1][1], SKULL[1][2], SKULL[1][3]));
    P.part(skull, S.h1, S.hl);
    var face = P.spoly(FACEPTS);
    P.part(face, S.s1, S.sl);
    P.recol(neck.and(face.shift(-1, 5)).sub(face), [S.s1], S.s2);
    P.recol(face.band(2, 0).and(P.rect(0, 30, 44, 40)), [S.s1], S.s2);
    P.recol(face.band(2, -2).and(P.rect(36, 60, 30, 20)), [S.s1, S.s2], S.s2);

    // ---- face features
    P.map(40, 42, lose ? EYES.nearLose : win ? EYES.nearWin : EYES.near, EL);
    P.map(62, 42, lose ? EYES.farLose : win ? EYES.farWin : EYES.far, EL);
    P.px(71, 56, S.s2); P.px(71, 57, S.sl);
    if (win) P.map(57, 63, MOUTHS.smirk, EL);
    else if (lose) P.map(57, 64, MOUTHS.fluster, EL);
    else P.map(59, 64, MOUTHS.calm, EL);
    var bl = lose ? [[41, 56], [43, 55], [45, 54], [44, 56], [46, 55], [42, 57], [65, 56], [67, 55], [69, 54], [66, 57], [68, 56]]
      : [[42, 56], [44, 56], [46, 56], [43, 57], [45, 57], [66, 56], [68, 56], [67, 57]];
    bl.forEach(function (p) { if (P.get(p[0], p[1]) === S.s1) P.px(p[0], p[1], lose || win ? S.bl : S.blS); });

    // ---- fringe: long choppy bangs, a strand between the eyes; cast shadow first
    var fringe = P.mask();
    FR.forEach(function (c) { fringe = fringe.or(P.sr(c[0], c[1], c[2], c[3])); });
    P.recol(fringe.shift(-1, 2).or(fringe.shift(0, 2)), [S.s1], S.s2);
    FR.forEach(function (c) { H.hairClump(P, c, S.h1); });
    P.recol(skull.band(5, -4), [S.h1], S.h2);
    var ring = P.ell(55, 34, 24, 20).sub(P.ell(56, 37, 24, 20)).and(skull);
    for (var gx = 0; gx < 112; gx += 6) ring = ring.sub(P.rect(gx, 0, 2, 40));
    P.recol(ring, [S.h1], S.h0);
    if (lose) { P.line([42, 39, 46, 38, 51, 36], S.hl); P.line([63, 36, 66, 38, 69, 39], S.hl); }
    else if (!win) { P.line([42, 40, 46, 39, 51, 39], S.hl); P.line([63, 39, 66, 39, 69, 40], S.hl); }

    // ---- wavy face-framing locks in front of the shoulders (hair tucked behind the ear)
    H.hairClump(P, [[31, 60, 25, 74, 27 + sw, 88, 21 + sw, 100, 23 + sw * 2, 112, 18 + sw * 2, 124, 20 + sw * 2, 134], 7, 3, 8, 0], S.h1);
    H.hairClump(P, [[34, 40, 29, 54, 31, 66, 26, 78, 29 + sw, 90, 25 + sw, 101, 27 + sw * 2, 110, 25 + sw * 2, 116, 22 + sw * 2, 117], 10, 1.5, 11, 0, [0.1, 0.5]], S.h1);
    H.hairClump(P, [[37, 30, 35, 44, 37, 56, 34, 66, 35, 72, 37, 74], 5, 1, 6, 0], S.h1);
    H.hairClump(P, [[80, 52, 86, 64, 84, 76, 89 + sw, 88, 87 + sw, 98, 90 + sw * 2, 104], 5, 1.4, 6, 0], S.h1);
    H.hairClump(P, [[76, 30, 80, 44, 79, 56, 83, 68, 81 + sw, 80, 85 + sw, 92, 83 + sw * 2, 104, 85 + sw * 2, 112, 88 + sw * 2, 113], 9, 1.5, 10, 0, [0.1, 0.5]], S.h1);

    // ---- pointed ear + drop earring
    var ear = P.spoly([36, 45, 31, 42, 25, 37, 20, 32, 23, 40, 27, 47, 30, 52, 34, 54, 36, 51]);
    P.part(ear, S.s1, S.sl);
    P.recol(ear.band(-1, 1), [S.s1], S.s0);
    P.line([33, 46, 28, 42, 24, 37], S.s2, true, true);
    P.part(P.ell(32, 56, 1.5, 1.5), S.m1, S.ml);
    P.px(32, 58, S.ml); P.px(32, 59, S.m2);
    var drop = P.poly([32, 59.5, 34.2, 63, 32, 67, 29.8, 63]);
    P.part(drop, S.a1, S.al); P.px(32, 62, S.a0); P.px(33, 63, S.a0);

    // ---- near horn: sweeps up and back from the temple
    horn(P, [37, 24, 32, 14, 26, 7.5, 18, 4.5, 10.5, 5], 11, 6);

    // ---- knot rosette + little tassel (far side, at the horn root)
    var tas = P.sr([80, 28, 81, 33, 80.5, 39], 1.8, 3);
    P.part(tas, S.c1, S.cl); P.recol(tas.band(1, 0), [S.c1], S.c2);
    P.part(P.rect(79, 28, 3, 2), S.m1, S.ml);
    knot(P, 77, 23, 7.6, 5, -0.3, { small: 1, d: 0.58, ro: 0.44, hole: 1.2, core: 0.3, noNotch: 1, ring: S.hl });

    // ---- ahoge
    var aho = lose ? P.sr([50, 12, 48, 7, 44, 5, 41, 7], 3.6, 1.8) : P.sr([50, 12, 49, 6, 46, 3, 42, 2, 39, 4], 4, 1.8);
    P.part(aho, S.h1, S.hl); P.recol(aho.band(-1, 1), [S.h1], S.h0);

    // ---- raised far arm: wide frilled sleeve, bare forearm, bracelet, beckoning hand
    if (!lose) drawHand(P, o);
    else drawLowArm(P);

    // ---- companion
    if (lose) blob(P, 99, 50, 'lose');
    else if (win) blob(P, 98, 24, 'win');
    else blob(P, 99, 30, 'n');

    P.outer(S.ol);

    if (win) { H.sparkle(P, 88, 12, true); H.sparkle(P, 108, 40, false); H.sparkle(P, 90, 40, false); }
    if (lose) {
      // "regenerate" spinner: an open circular arrow over her shoulder
      var spin = P.ell(96, 14, 6.5, 6.5).sub(P.ell(96, 14, 3.6, 3.6)).sub(P.poly([96, 14, 104, 2, 106, 12]));
      spin = spin.or(P.poly([97.5, 4.5, 104.5, 8.5, 98, 11.5]));
      P.part(spin, S.a1, S.al); P.recol(spin.band(-1, 1), [S.a1], S.a0); P.recol(spin.band(1, -1), [S.a1], S.a2);
      P.map(77, 34, ['.r.', 'rRr', 'rRR', '.R.'], EL);
      P.map(84, 40, ['..R', '.R.', '...', 'R..'], EL);
    }
  }

  function sleeve(P, pts) {
    var m = P.spoly(pts);
    P.part(m, S.c1, S.cl);
    P.recol(m.band(4, -1), [S.c1], S.c2);
    P.recol(m.band(-1, 2), [S.c1], S.c0);
    return m;
  }
  // hanging frilled detached sleeve (far arm): band on the upper arm, folds, ruffled outer edge
  function farSleeve(P) {
    var m = sleeve(P, [82, 132, 81, 116, 85, 104, 92, 99, 100, 98, 106, 101, 111, 108, 114, 120, 114, 132]);
    [[88, 108, 86, 132], [94, 106, 93, 120, 94, 132], [102, 106, 104, 132]].forEach(function (l) { P.line(l, S.c2, true, true); });
    var ruf = P.mask();
    for (var k = 0; k < 8; k++) ruf = ruf.or(P.ell(106 + k * 1.1, 101 + k * 4, 2.6, 2.3));
    P.part(ruf, S.c0, S.cl); P.recol(ruf.band(2, -1), [S.c0], S.c2);
    var band = P.sr([84, 105, 90, 100.5, 98, 99, 105, 100.5], 3.2, 3.2);
    P.part(band, S.d1, S.dl); P.recol(band.band(0, 1), [S.d1], S.d0);
    [[89, 102], [96, 100]].forEach(function (p) { P.px(p[0], p[1], S.m0); });
    return m;
  }
  function drawHand(P, o) {
    farSleeve(P);
    // forearm rising out of the sleeve
    var fa = P.sr([99, 112, 99.5, 100, 100, 90], 8.4, 7);
    P.part(fa, S.s1, S.sl); P.recol(fa.band(3, 0), [S.s1], S.s2); P.recol(fa.band(-1, 0), [S.s1], S.s0);
    // platinum bracelet with a teal stone
    var br = P.sr([95.5, 90.5, 100, 91.5, 104.5, 90.5], 3.4, 3.4);
    P.part(br, S.m1, S.ml); P.recol(br.band(0, 1), [S.m1], S.m0); P.recol(br.band(0, -1), [S.m1], S.m2);
    P.px(100, 91, S.a1); P.px(101, 91, S.a0);
    // beckoning hand: palm toward us, index finger raised and crooking toward her, the rest folded
    var palm = P.spoly([95, 89, 94, 84, 95.5, 79, 100, 77, 104.5, 78, 106.5, 82, 106, 87, 102, 90]);
    var thumb = P.sr([96, 86, 92.5, 83, 90.5, 79.5], 3.8, 2.8);
    var idx = P.sr([98, 79, 97.6, 72, 98.4, 67, 97.4, 63.6, 95, 62.8, 93.6, 64.2], 3.6, 2.4);
    var curl = P.ell(101.2, 77.6, 2, 2).or(P.ell(103.8, 78.6, 2, 2)).or(P.ell(106, 81.4, 1.7, 1.8));
    var hand = palm.or(thumb).or(idx).or(curl);
    P.part(hand, S.s1, S.sl);
    P.recol(hand.band(2, -1), [S.s1], S.s2);
    P.recol(hand.band(-1, 1), [S.s1], S.s0);
    P.line([99.8, 80, 99.8, 77], S.s2);
    P.line([101, 80, 102.5, 80.5], S.s2); P.line([104, 81, 105, 82.5], S.s2);
    P.line([96, 86, 99, 87.5, 103, 86.5], S.s2, true);
    P.px(94, 64, S.bl);
  }
  function drawLowArm(P) {
    farSleeve(P);
  }

  // ---------------------------------------------------------------- face icon 24x24 (hand-typed)
  var FACE = [
    'o............ooo........',
    'oXo.........oXXXo.......',
    'oXXo........o.oXxo......',
    '.oXxo..hhhhh..oXxyo.....',
    '.oXxxohhHHHJhh.oxyo.....',
    '..oxxyoHHHHJJHhhxyo.....',
    '...oyyhHHHHHJHHHyo......',
    '..hHHHHHHHhHHHHHHHh.....',
    '.hHHHHHHHhfhHHHhHHHh....',
    '.hHHHHHHhffhHHhffhHHh...',
    'ohHHHhKKKKfffhKKKfhHHh..',
    'ofohHKDWDKffffKDWfhHHh..',
    '.offhwsBBwfffwsBwfhGHh..',
    '..ofhfffffffffffffhGHh..',
    '..hhffbbfffffffbbfhGHh..',
    '..hGhfffffffmmfffhGHHh..',
    '..hGHhfffffffffffhGHHh..',
    '..hGHhhffffffffhhGHHh...',
    '.hGGHhehhffffhhheGHHh...',
    '.hGGHheeCdCCCCdCehGHh...',
    'hGGHheffCCCdCCCCfehHh...',
    'hGGheffCCCCfCCCCCfehh...',
    'hGhefffCCCCMCCCCCCffh...',
    'hhefffCCCCCdCCCCCCCfeh..'
  ];
  var FL = { o: S.ol, X: S.x0, x: S.x1, y: S.x2, h: S.hl, H: S.h1, J: S.h0, G: S.h2, f: S.s1, e: S.s2, K: S.lash, D: S.e3,
    s: S.e2, B: S.e1, W: S.W, w: S.ew, b: S.bl, m: S.mo, C: S.c1, c: S.c2, d: S.d1, M: S.m1, A: S.a1, l: S.sl };
  function face(P) { P.map(0, 0, FACE, FL); }

  // ---------------------------------------------------------------- cut-in hooks (see cutin.js)
  // Q = the ×2.8 painter in bust coordinates; visible window ≈ x 1–87, y 37–63
  function cutinFace(Q) {
    var H = I.H;
    Q.part(Q.rect(4, 20, 104, 60), S.h2, S.hl);
    Q.recol(Q.rect(4, 20, 104, 60).band(-6, 0), [S.h2], S.h3);
    H.strands(Q, [[86, 30, 90, 44, 87, 56, 91, 70], [93, 30, 97, 46, 94, 58, 98, 70], [22, 30, 17, 44, 21, 56, 16, 70]], S.h3);
    Q.part(Q.ell(53, 37, 25, 26).or(Q.ell(47, 42, 21, 23)), S.h1, S.hl);
    var f = Q.spoly(FACEPTS);
    Q.part(f, S.s1, S.sl); Q.recol(f.band(4, 0), [S.s1], S.s2); Q.recol(f.band(-2, 0), [S.s1], S.s0);
    I.bigEye(Q, { x: 46, y: 48.5, w: 12, h: 9.6 }, true, { lid: 0.34, fierce: true });
    I.bigEye(Q, { x: 66, y: 48.5, w: 8.4, h: 9.6 }, false, { lid: 0.34, fierce: true });
    // glow: bright lower iris + glint streaks trailing from the outer corners
    [[46 + 12 * 0.08, 49.4, 12 * 0.3], [66 + 8.4 * 0.08, 49.4, 8.4 * 0.34]].forEach(function (e) {
      Q.recol(Q.ell(e[0], e[1] + 2.2, e[2] * 0.7, 1.6), [S.e1, S.e2], S.e0);
    });
    Q.fill(Q.sr([39.6, 47.2, 35, 46.4, 29, 46.2], 0.9, 0.3), S.e0);
    Q.fill(Q.sr([70.6, 47.2, 74, 46.2, 78, 45.8], 0.8, 0.3), S.e0);
    Q.fill(Q.sr([40.2, 40.6, 46, 41.8, 51.8, 44.2], 1.1, 1.5, 1.5), S.hl);
    Q.fill(Q.sr([62.4, 44.2, 66, 42, 69.6, 41], 1.4, 0.9, 1.3), S.hl);
    Q.line([71, 57, 71.4, 58.2], S.s2); Q.px(Q.tx(71.2), Q.ty(58.6), S.sl);
    [[43, 56.5], [45, 56.5], [67, 56.5]].forEach(function (p) { Q.line([p[0], p[1], p[0] - 1.2, p[1] + 1.6], S.bl); });
    var fr = Q.mask();
    FR.forEach(function (c) { fr = fr.or(Q.sr(c[0], c[1], c[2], c[3])); });
    Q.recol(fr.shift(-2, 6).or(fr.shift(0, 6)), [S.s1, S.s0], S.s2);
    FR.forEach(function (c) { H.hairClump(Q, c, S.h1); });
    H.hairClump(Q, [[34, 40, 29, 54, 31, 66, 26, 78], 10, 6, 11, 0, [0.1, 0.6]], S.h1);
    H.hairClump(Q, [[76, 30, 80, 44, 79, 56, 83, 68], 9, 6, 10, 0, [0.1, 0.6]], S.h1);
    // horns slicing up through the top of the frame
    horn(Q, [31, 52, 27, 46, 24, 41.5, 22, 37.5, 21.5, 33], 7, 4);
    horn(Q, [80, 50, 83, 45, 85, 40.5, 85.6, 35], 6, 3);
  }
  // band motif: dragon-scale crescents + teal flame tongues along the bottom (px coords)
  function cutinMotif(P) {
    for (var j = 0; j < 7; j++) for (var i = -1; i < 18; i++) {
      var x = i * 15 + (j & 1) * 7.5, y = j * 11 + 2;
      P.fill(P.ell(x, y, 8, 7.5), S.a2); P.fill(P.ell(x, y - 1.6, 6.8, 6.2), S.a3);
    }
    var r = K.rng(7);
    for (var k = 0; k < 8; k++) {
      var fx = 4 + k * 13 + r() * 6, fh = 8 + r() * 10 + (k > 4 ? 6 : 0), fw = 4 + r() * 3;
      var fl = P.poly([fx - fw, 72, fx - fw * 0.4, 72 - fh * 0.5, fx - fw * 1.1, 72 - fh, fx + fw * 0.3, 72 - fh * 0.55, fx + fw, 72]);
      P.fill(fl, S.a1); P.fill(fl.and(fl.shift(0, -3)).and(fl.shift(2, 0)).and(fl.shift(-2, 0)), S.a0);
    }
  }
  // drawn over the finished band: drifting scale shards / sparks at the left
  function cutinOver(P) {
    [[22, 14], [48, 56], [12, 44], [60, 20], [36, 30]].forEach(function (p, i) {
      P.px(p[0], p[1], S.W); P.px(p[0] - 1, p[1], S.a0); P.px(p[0] + 1, p[1], S.a0); P.px(p[0], p[1] - 1, S.a0); P.px(p[0], p[1] + 1, S.a0);
      if (i & 1) { P.px(p[0] - 2, p[1], S.a1); P.px(p[0] + 2, p[1], S.a1); }
    });
  }

  I.ART.gpt = {
    bust: function () { var P = K.painter(112, 128); drawBust(P, {}); return P; },
    bustWin: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'win' }); return P; },
    bustLose: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'lose' }); return P; },
    titleFrame: function (o) { var P = K.painter(112, 128); drawBust(P, o); return P; },
    cutin: function () { return I.cutin ? I.cutin('gpt') : K.painter(240, 72); },
    face: function () { var P = K.painter(24, 24); face(P); return P; },
    cutinFace: cutinFace, cutinMotif: cutinMotif, cutinOver: cutinOver, cutinCfg: { seed: 41 }
  };
  I.drawGptBust = drawBust;
  I.ART.gpt.head = { FR: FR, face: FACEPTS, skull: SKULL };
  I.gptHorn = horn; I.gptBlob = blob;
})();
