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
    var m = P.sr(pts, w, 0.6, w * 0.72);
    P.part(m, S.x1, S.xl);
    P.recol(m.band(3, -1), [S.x1], S.x2);
    P.recol(m.band(-1, 2), [S.x1], S.x0);
    for (var k = 1; k <= (ridges || 5); k++) {
      var t = k / ((ridges || 5) + 1.4), a = along(pts, t), hw = (w * (1 - t) * (1 - t) + 2 * w * 0.72 * t * (1 - t) + 0.6 * t * t) / 2 + 1;
      var nx = -a.ty, ny = a.tx;
      var r = P.poly([a.x + nx * hw, a.y + ny * hw, a.x - nx * hw + a.tx * 0.8, a.y - ny * hw + a.ty * 0.8,
        a.x - nx * hw + a.tx * 1.8, a.y - ny * hw + a.ty * 1.8, a.x + nx * hw + a.tx * 1, a.y + ny * hw + a.ty * 1]).and(m);
      P.recol(r, [S.x1, S.x0], S.x2); P.recol(r, [S.x2], S.x2);
    }
    return m;
  }
  // knot rosette: n interlaced cord loops (petals) around a small centre knot — white cord, dark line
  // work, recessed backing in the holes. Neighbouring loops weave: over at the rim, under near the
  // centre. Our own design. o = {line, small}
  function knot(P, cx, cy, r, n, rot, o) {
    o = o || {};
    var L = o.line || S.d2, pet = [], all = P.mask(), i;
    for (i = 0; i < n; i++) {
      var a = rot + i * Math.PI * 2 / n, px = cx + Math.cos(a) * r * 0.47, py = cy + Math.sin(a) * r * 0.47;
      pet.push({ O: P.ell(px, py, r * 0.53, r * 0.38, a),
        H: P.ell(px + Math.cos(a) * r * 0.06, py + Math.sin(a) * r * 0.06, r * 0.27, r * (o.small ? 0.1 : 0.13), a) });
      all = all.or(pet[i].O);
    }
    P.fill(all, S.c3);
    function ring(p, clip) {
      var cord = p.O.sub(p.H), e = p.O.edge().or(p.H.grow(1).and(p.O).sub(p.H));
      if (clip) { cord = cord.and(clip); e = e.and(clip); }
      P.fill(cord, S.c0); P.fill(e, L);
    }
    for (i = 0; i < n; i++) ring(pet[i]);
    ring(pet[0], pet[n - 1].O.sub(P.ell(cx, cy, r * 0.5, r * 0.5)));
    var inn = P.ell(cx, cy, r * 0.5, r * 0.5);
    for (i = 0; i < n; i++) ring(pet[(i + n - 1) % n], pet[i].O.and(inn));
    P.recol(all.band(2, -2), [S.c0], S.c1);
    P.recol(all.band(1, -1).and(all.band(2, -2)), [S.c1], S.c2);
    var core = P.ell(cx, cy, r * 0.22, r * 0.22);
    P.part(core, S.c1, L);
    P.px(Math.round(cx - 0.5), Math.round(cy - 1), S.c0);
    return all;
  }
  I.gptEmblem = function (P, size) {
    knot(P, size / 2, size / 2, size * 0.47, size >= 32 ? 6 : 5, -Math.PI / 2, { small: size < 32 });
    P.outer(S.ol);
  };
  I.knot = knot;

  // bat-like wing rising behind the near shoulder; droop (radians) lowers it outward
  function wing(P, droop) {
    var bx = 26, by = 102, a = droop || 0, ca = Math.cos(a), sa = Math.sin(a);
    function R(pts) { var o = []; for (var i = 0; i < pts.length; i += 2) { var x = pts[i] - bx, y = pts[i + 1] - by; o.push(bx + x * ca - y * sa, by + x * sa + y * ca); } return o; }
    var mem = P.poly(R([26, 100, 12, 40, -6, 20, -10, 44, -5, 58, 2, 60, 6, 68, 4, 84, 10, 83, 15, 90, 22, 98]));
    P.part(mem, S.u1, S.ul);
    P.recol(mem.band(3, -1), [S.u1], S.u2);
    P.recol(mem.band(-1, 2), [S.u1], S.u0);
    P.line(R([12, 42, 6, 54, 4, 60]), S.u2, true, true);
    P.line(R([13, 44, 12, 62, 9, 78]), S.u2, true, true);
    var bones = P.sr(R([26, 104, 20, 76, 12, 40]), 5, 3).or(P.sr(R([12, 40, 4, 30, -6, 20]), 2.8, 1.2))
      .or(P.sr(R([12, 40, 2, 50, -5, 58]), 2.6, 1.2)).or(P.sr(R([12, 40, 9, 62, 4, 84]), 2.6, 1.2));
    P.part(bones, S.x1, S.xl);
    P.recol(bones.band(-1, 1), [S.x1], S.x0);
    var claw = P.sr(R([12, 40, 14, 34, 12, 30]), 3.2, 0.6);
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
    wing(P, lose ? -0.32 : 0);

    // ---- back hair: long, voluminous, wavy curtain
    var back = P.spoly([54, 12, 38, 14, 28, 22, 22, 34, 19, 48, 15, 58, 17, 68, 12, 78, 14, 88, 9 + sw, 100, 11 + sw, 110, 6 + sw * 2, 122, 5 + sw * 2, 132,
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
    horn(P, [71, 20, 74, 11, 71, 5, 65, 2, 58, 2], 8, 5);

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
    H.hairClump(P, [[34, 40, 29, 54, 31, 66, 25, 78, 28 + sw, 90, 22 + sw, 102, 25 + sw * 2, 116, 20 + sw * 2, 132], 10, 4, 11, 0, [0.1, 0.5]], S.h1);
    H.hairClump(P, [[37, 30, 35, 44, 37, 56, 34, 66], 5, 0, 6, 0], S.h1);
    H.hairClump(P, [[76, 30, 80, 44, 79, 56, 83, 68, 81 + sw, 80, 85 + sw, 92, 83 + sw * 2, 106, 87 + sw * 2, 122], 9, 2, 10, 0, [0.1, 0.5]], S.h1);

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
    horn(P, [36, 23, 31, 13, 25, 7, 17, 4, 10, 5], 9, 6);

    // ---- knot rosette + little tassel (far side, at the horn root)
    var tas = P.sr([80, 28, 81, 33, 80.5, 39], 1.8, 3);
    P.part(tas, S.c1, S.cl); P.recol(tas.band(1, 0), [S.c1], S.c2);
    P.part(P.rect(79, 28, 3, 2), S.m1, S.ml);
    knot(P, 77, 23, 7, 5, -0.3, { small: true });

    // ---- ahoge
    var aho = lose ? P.sr([50, 12, 48, 7, 44, 5, 41, 7], 3, 1) : P.sr([50, 12, 49, 6, 46, 3, 42, 2, 39, 4], 3.2, 1);
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
      [[0, -5], [3.5, -3.5], [5, 0], [3.5, 3.5], [0, 5], [-3.5, 3.5], [-5, 0]].forEach(function (d, i) {
        P.px(Math.round(97 + d[0]), Math.round(14 + d[1]), i < 2 ? S.a0 : i < 5 ? S.a1 : S.a2);
      });
      P.map(90, 6, ['..aa', '.aaA', 'aa..', '.a..'], { a: S.a1, A: S.a0 });
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
  function drawHand(P, o) {
    var s = sleeve(P, [84, 132, 82, 116, 86, 104, 94, 100, 104, 100, 112, 104, 114, 132]);
    P.line([90, 108, 88, 132], S.c2, true, true); P.line([98, 110, 99, 132], S.c2, true, true); P.line([106, 108, 108, 132], S.c2, true, true);
    // ruffled opening
    var ruf = P.mask();
    for (var k = 0; k < 7; k++) ruf = ruf.or(P.ell(88 + k * 3.6, 102 + (k & 1), 2.6, 2.4));
    P.part(ruf, S.c0, S.cl); P.recol(ruf.band(2, -1), [S.c0], S.c2);
    // forearm
    var fa = P.sr([101, 106, 100, 96, 100, 88], 7, 6);
    P.part(fa, S.s1, S.sl); P.recol(fa.band(3, 0), [S.s1], S.s2); P.recol(fa.band(-1, 0), [S.s1], S.s0);
    // platinum bracelet
    var br = P.sr([96, 89, 100, 90, 104, 89], 3.2, 3.2);
    P.part(br, S.m1, S.ml); P.recol(br.band(0, 1), [S.m1], S.m0); P.recol(br.band(0, -1), [S.m1], S.m2);
    P.px(100, 91, S.a1);
    // beckoning hand: palm toward us, index finger raised and curling, the others folded
    var palm = P.spoly([95, 87, 94, 82, 96, 77, 102, 76, 106, 79, 106, 85, 102, 88]);
    var idx = P.sr([103, 78, 106, 72, 107, 67, 105, 64], 3.2, 2.4);
    var mid = P.sr([100, 78, 101, 73, 100, 70], 3.2, 2.8);
    var thumb = P.sr([96, 84, 92, 81, 90, 78], 3.4, 2.4);
    var curl = P.ell(97, 79, 2, 2).or(P.ell(95.5, 81.5, 1.8, 1.8));
    var hand = palm.or(idx).or(mid).or(thumb).or(curl);
    P.part(hand, S.s1, S.sl);
    P.recol(hand.band(2, -1), [S.s1], S.s2);
    P.recol(hand.band(-1, 1), [S.s1], S.s0);
    P.line([102, 79, 103, 75], S.s2); P.line([98, 80, 97, 77], S.s2);
    P.line([96, 85, 99, 86, 102, 85], S.s2, true);
    P.px(105, 64, S.bl);
  }
  function drawLowArm(P) {
    sleeve(P, [84, 132, 82, 112, 88, 102, 98, 100, 108, 104, 113, 112, 114, 132]);
    P.line([90, 108, 88, 132], S.c2, true, true); P.line([100, 110, 101, 132], S.c2, true, true);
    var bandF = P.sr([84, 108, 92, 103, 102, 102, 110, 106], 3, 3);
    P.part(bandF, S.d1, S.dl); P.recol(bandF.band(0, 1), [S.d1], S.d0);
  }

  // ---------------------------------------------------------------- face icon 24x24 (placeholder until drawn)
  function face(P) {
    P.fill(P.ell(12, 12, 9, 9), S.h1);
    P.outer(S.ol);
  }

  I.ART.gpt = {
    bust: function () { var P = K.painter(112, 128); drawBust(P, {}); return P; },
    bustWin: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'win' }); return P; },
    bustLose: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'lose' }); return P; },
    titleFrame: function (o) { var P = K.painter(112, 128); drawBust(P, o); return P; },
    cutin: function () { return I.cutin ? I.cutin('gpt') : K.painter(240, 72); },
    face: function () { var P = K.painter(24, 24); face(P); return P; }
  };
  I.drawGptBust = drawBust;
  I.ART.gpt.head = { FR: FR, face: FACEPTS, skull: SKULL };
  I.gptHorn = horn; I.gptBlob = blob;
})();
