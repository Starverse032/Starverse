/* LATENT CLASH — ILLUST: DeepSeek 娘 portraits (bust / bustWin / bustLose / cutin / face).
 * Same construction, head size and light (upper right) as Claude's portraits. */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit, S = K.S;
  I.ART = I.ART || {};

  var EL = { K: S.lash, k: S.e3, D: S.e3, s: S.e2, B: S.e1, H: S.e0, w: S.ew, W: S.W, P: S.lash, x: S.s2, l: S.sl, y: S.s3, b: S.bl, c: S.blS, m: S.mo, t: S.tg, n: S.sl, r: S.tear, R: S.tear2, a: S.a1, A: S.a0, o: S.ol };
  var EYES = {
    // bright, round, outer corners flick up
    near: [
      'K...KKKK....',
      'KK.KKKKKKK..',
      '.KKKKKKKKKKK',
      '..KDDDDDDDKw',
      '..wDDssWWDDw',
      '..wDsssWWsDw',
      '..wsssPPssDw',
      '..wsBBPPBssw',
      '..wBBBBBBBsw',
      '..wHWBBBBBHw',
      '...wHHHHHHl.',
      '....lllll...'
    ],
    far: [
      '....KK.K',
      '.KKKKKKK',
      'KKKKKKKK',
      'wDDDDDDK',
      'wDssWWDw',
      'wsssWWDw',
      'wssPPsDw',
      'wBBPPBsw',
      'wBBBBBsw',
      'wHBBBHHw',
      '.wHHHHl.',
      '..lll...'
    ],
    // win: near eye winks (>), far eye open
    nearWink: [
      '............',
      '............',
      '............',
      '..KK........',
      '....KKK.....',
      '.......KKK..',
      '.........KK.',
      '.......KKK..',
      '....KKK.....',
      '..KK........',
      '............',
      '............'
    ],
    // lose: dizzy spirals ("server busy")
    nearSpin: [
      '............',
      '...KKKKKK...',
      '..K......K..',
      '.K..KKKK..K.',
      '.K.K....K.K.',
      '.K.K.KK.K.K.',
      '.K.K.K..K.K.',
      '.K..KK.K..K.',
      '..K...K..K..',
      '...KKK..K...',
      '......KK....',
      '............'
    ],
    farSpin: [
      '........',
      '..KKKK..',
      '.K....K.',
      'K..KK..K',
      'K.K..K.K',
      'K.K.K..K',
      'K..K..K.',
      '.K...K..',
      '..KKK...',
      '........',
      '........',
      '........'
    ]
  };
  var MOUTHS = {
    grin: [
      'n.......n',
      '.nnnnnnn.',
      '.nWmmmmn.',
      '..nmttn..',
      '...nnn...'
    ],
    big: [
      'n.........n',
      '.nnnnnnnnn.',
      '.nWmmmmmmn.',
      '.nmmmmmmmn.',
      '..nmmtttn..',
      '...nnnnn...'
    ],
    wavy: [
      '.nn...nn.',
      'n..n.n..n',
      '....n....'
    ]
  };

  // whale-fluke shaped pigtail end at (x,y), pointing along angle `ang` (radians), size k
  function fluke(P, x, y, ang, k) {
    var T = [0, -2.2, -3, -4, -6, -7.5, -10, -9.5, -8.6, -5.5, -7.8, -1.6, -5.6, 0, -7.8, 1.6, -8.6, 5.5, -10, 9.5, -6, 7.5, -3, 4, 0, 2.2];
    var ca = Math.cos(ang), sa = Math.sin(ang), pts = [];
    for (var i = 0; i < T.length; i += 2) {
      var u = -T[i] * k, v = T[i + 1] * k;      // u forward along ang
      pts.push(x + u * ca - v * sa, y + u * sa + v * ca);
    }
    return P.poly(pts);
  }
  I.fluke = fluke;

  function pigtail(P, pts, ang, k, sw) {
    var H = I.H;
    var st = H.hairClump(P, [pts, 11, 8, 11, 0, [0.1, 0.6]], S.h1);
    var n = pts.length, ex = pts[n - 2], ey = pts[n - 1];
    var f = fluke(P, ex, ey, ang, k);
    P.part(f, S.h1, S.hl);
    P.recol(f.band(2, -1), [S.h1], S.h2);
    // cyan tips on the lobes' ends
    var c = Math.cos(ang), s = Math.sin(ang);
    H.tipMap(P, f, function (x, y) { var d = (x - ex) * c + (y - ey) * s; return d - 5 * k; });
    return st.or(f);
  }

  // ---------------------------------------------------------------- bust
  function drawBust(P, o) {
    var expr = o.expr || 'n', sw = o.sway || 0, H = I.H;
    var lose = expr === 'lose', win = expr === 'win';

    // ---- pigtails (behind the head): near one up-left, far one up-right
    pigtail(P, [31, 25, 24, 20, 18 + sw, 16], Math.PI + 0.62 + sw * 0.06, 1.2, sw);
    pigtail(P, [71, 19, 79, 13, 86 + sw, 10], -0.42 - sw * 0.06, 1.1, sw);

    // ---- back of the bob (behind face)
    var bob = P.spoly([52, 11, 34, 14, 22, 25, 17, 40, 17, 56, 21, 68, 28, 75, 38, 77, 46, 72, 70, 70, 79, 72, 85, 62, 86, 46, 82, 30, 72, 16]);
    P.part(bob, S.h2, S.hl);
    P.recol(bob.band(4, -2), [S.h2], S.h3);
    H.tipMap(P, bob, function (x, y) { return (y - 70) * 0.8; });

    // ---- R1 peeking over her near shoulder
    drawR1(P, 14, 76, lose);

    // ---- hood (whale back, lowered) + neck
    var neck = P.poly([48, 62, 61, 62, 61, 90, 48, 90]);
    P.part(neck, S.s1, S.sl);
    var hood = P.spoly([24, 92, 26, 82, 34, 76, 46, 77, 54, 84, 64, 77, 76, 76, 86, 80, 92, 90]);
    P.part(hood, S.d1, S.dl);
    P.recol(hood.band(-2, 3), [S.d1], S.d0);
    P.recol(hood.band(3, -1), [S.d1], S.d2);
    // whale eye dots on the hood
    P.px(31, 82, S.W); P.px(32, 82, S.ol); P.px(32, 83, S.ol); P.px(31, 83, S.ol);
    P.px(81, 81, S.W); P.px(82, 81, S.ol); P.px(82, 82, S.ol); P.px(81, 82, S.ol);
    // ---- oversized white hoodie
    var body = P.spoly([46, 84, 34, 86, 22, 92, 13, 102, 8, 116, 6, 134, 106, 134, 104, 116, 99, 102, 90, 92, 76, 86, 62, 84]);
    P.part(body, S.c1, S.cl);
    P.recol(body.band(5, -2), [S.c1], S.c2);
    P.recol(body.band(-2, 3), [S.c1], S.c0);
    var collar = P.spoly([44, 84, 54, 92, 64, 84, 60, 82, 54, 87, 48, 82]);
    P.part(collar, S.c2, S.cl);
    P.line([30, 98, 26, 114, 25, 130], S.c2, true);
    P.line([40, 108, 39, 130], S.c2, true);
    // drawstrings with metal aglets
    P.line([50, 90, 49, 100, 50, 110], S.d2, true); P.line([58, 90, 59, 99, 58, 108], S.d2, true);
    P.px(50, 111, S.m1); P.px(50, 112, S.m2); P.px(58, 109, S.m1); P.px(58, 110, S.m2);

    // ---- head
    var skull = P.ell(52, 38, 27, 26.5).or(P.ell(46, 42, 22, 24));
    P.part(skull, S.h1, S.hl);
    H.hairClump(P, [[73, 32, 78, 46, 78, 58, 76, 68], 10, 2, 10, 0.3], S.h1);
    var face = P.spoly([34, 30, 32, 40, 33, 50, 36, 57, 41, 63, 48, 68, 55, 72, 61, 74.5, 65, 73.5, 70, 69, 74, 63, 77, 57, 78, 52, 76.5, 47, 77.5, 41, 76.5, 32, 64, 27, 46, 27]);
    P.part(face, S.s1, S.sl);
    P.recol(neck.and(face.shift(-1, 4)).sub(face), [S.s1], S.s2);
    P.recol(face.band(3, 0).and(P.rect(0, 42, 40, 30)), [S.s1], S.s2);

    // ---- face features
    P.map(41, 43, lose ? EYES.nearSpin : win ? EYES.nearWink : EYES.near, EL);
    P.map(62, 43, lose ? EYES.farSpin : EYES.far, EL);
    if (expr === 'cut') { P.line([42, 37, 46, 38, 51, 40], S.hl); P.line([62, 40, 66, 38, 69, 38], S.hl); }
    else if (lose) { P.line([42, 37, 46, 38, 50, 39], S.hl); P.line([63, 39, 66, 38, 69, 37], S.hl); }
    else { P.line([43, 38, 46, 37, 50, 38], S.hl); P.line([63, 38, 67, 37, 69, 38], S.hl); }
    P.px(68, 58, S.s2); P.px(68, 59, S.sl);
    if (lose) P.map(58, 64, MOUTHS.wavy, EL);
    else P.map(win ? 57 : 58, 63, win ? MOUTHS.big : MOUTHS.grin, EL);
    [[43, 57], [45, 57], [47, 57], [49, 57], [44, 58], [46, 58], [48, 58], [64, 57], [66, 57], [68, 57], [65, 58], [67, 58]].forEach(function (p) {
      if (P.get(p[0], p[1]) === S.s1) P.px(p[0], p[1], (p[0] + p[1]) & 1 ? S.bl : S.blS);
    });

    // ---- fringe: choppy bangs, slightly swept right; cast shadow first
    var FR = [
      [[50, 13, 62, 17, 71, 26, 75, 36, 76, 46], 14, 0, 13],
      [[46, 14, 56, 21, 62, 31, 64, 42], 13, 0, 13],
      [[42, 15, 48, 24, 53, 33, 54, 42], 12, 0, 13],
      [[38, 16, 41, 25, 44, 33, 45, 40], 11, 0, 11],
      [[34, 18, 33, 28, 35, 37, 38, 44], 10, 0, 10]
    ];
    var fringe = P.mask();
    FR.forEach(function (c) { fringe = fringe.or(P.sr(c[0], c[1], c[2], c[3])); });
    P.recol(fringe.shift(-1, 2).or(fringe.shift(0, 2)), [S.s1], S.s2);
    FR.forEach(function (c) { H.hairClump(P, c, S.h1); });
    // near bob side lock, curling in under the cheek, cyan tip
    H.hairClump(P, [[36, 28, 31, 44, 31, 58, 34, 68, 40, 73], 12, 0, 13, 0.3, [0.1, 0.45]], S.h1);
    P.recol(skull.band(5, -4), [S.h1], S.h2);
    var ring = P.ell(55, 35, 25, 21).sub(P.ell(56, 38, 25, 21)).and(skull);
    P.recol(ring, [S.h1], S.h0);
    // hair ties (cyan beads) at the pigtail roots
    P.part(P.ell(30, 23, 3, 3), S.a1, S.al); P.px(31, 22, S.a0);
    P.part(P.ell(72, 18, 2.6, 2.6), S.a1, S.al); P.px(73, 17, S.a0);
    // spout ahoge: short stem splitting into two curls with a cyan tip
    if (lose) P.part(P.sr([52, 15, 51, 9, 47, 6, 43, 7], 5, 2), S.h1, S.hl);
    else {
      var sp = P.sr([53, 15, 54, 9, 55, 6], 5, 4).or(P.sr([55, 7, 52, 3, 48, 2, 45, 4], 4.5, 1.5)).or(P.sr([55, 7, 58, 2, 62, 1, 65, 3], 4.5, 1.5));
      P.part(sp, S.h1, S.hl);
      P.recol(sp.band(-1, 1), [S.h1], S.h0);
      P.px(45, 4, S.t1); P.px(46, 3, S.t0); P.px(64, 2, S.t0); P.px(65, 3, S.t1);
    }

    // ---- raised cyan-gloved fist wrapped in a swirl of water
    drawFist(P, o);

    P.outer(S.ol);

    if (win) { H.sparkle(P, 26, 46, false); H.sparkle(P, 74, 30, true); H.sparkle(P, 100, 70, false); }
    if (lose) {
      // "server busy" spinner above her head
      [[0, -5], [3.5, -3.5], [5, 0], [3.5, 3.5], [0, 5], [-3.5, 3.5], [-5, 0], [-3.5, -3.5]].forEach(function (d, i) {
        var x = Math.round(84 + d[0]), y = Math.round(16 + d[1]);
        P.px(x, y, i < 3 ? S.a0 : i < 6 ? S.a1 : S.a2); if (i < 2) { P.px(x + 1, y, S.a0); }
      });
      P.map(76, 34, ['.r.', 'rRr', 'rRR', '.R.'], EL);
    }
  }

  function drawR1(P, x, y, sad) {
    // tail fluke behind, then a round body
    var tail = I.fluke(P, x - 13, y - 2, Math.PI + 0.9, 0.65).or(P.sr([x - 6, y + 4, x - 11, y, x - 13, y - 2], 5, 3));
    P.part(tail, S.d1, S.dl); P.recol(tail.band(2, -1), [S.d1], S.d2);
    var body = P.spoly([x - 10, y + 8, x - 9, y, x - 3, y - 6, x + 6, y - 8, x + 14, y - 4, x + 18, y + 4, x + 16, y + 12, x + 6, y + 15, x - 5, y + 14]);
    P.part(body, S.d1, S.dl);
    P.recol(body.band(-2, 2), [S.d1], S.d0);
    P.recol(body.band(3, -1), [S.d1], S.d2);
    P.recol(P.ell(x + 7, y + 12, 11, 4.5).and(body), [S.d1, S.d0, S.d2], S.c0);
    P.px(x + 10, y + 3, S.ol); P.px(x + 10, y + 4, S.ol); P.px(x + 11, y + 3, S.ol); P.px(x + 11, y + 4, S.ol);
    if (!sad) P.px(x + 11, y + 3, S.W); else { P.px(x + 10, y + 3, S.d2); P.px(x + 11, y + 3, S.d2); }
    P.px(x + 13, y + 6, S.bl); P.px(x + 14, y + 6, S.bl);
    P.px(x + 15, y + 8, S.dl); P.px(x + 16, y + 8, S.dl);
    if (!sad) [[x + 4, y - 9, S.a1], [x + 4, y - 10, S.a0], [x + 3, y - 12, S.a0], [x + 5, y - 12, S.a0], [x + 2, y - 13, S.a1], [x + 6, y - 13, S.a1], [x + 1, y - 13, S.a2], [x + 7, y - 13, S.a2]]
      .forEach(function (p) { P.px(p[0], p[1], p[2]); });
  }

  function drawFist(P, o) {
    var cx = 90, cy = 92;
    // sleeve (white, blue stripes) coming up from the bottom right
    var sleeve = P.poly([80, 100, 100, 98, 110, 134, 80, 134]);
    P.part(sleeve, S.c1, S.cl);
    P.recol(sleeve.band(4, 0), [S.c1], S.c2);
    var st1 = P.poly([79, 108, 102, 105, 103, 109, 80, 112]).and(sleeve), st2 = P.poly([80, 115, 104, 112, 105, 115, 81, 118]).and(sleeve);
    P.recol(st1.or(st2), [S.c1, S.c2], S.d1);
    // swirl back half
    var backHalf = P.sr([104, 86, 98, 80, 88, 79, 80, 82, 76, 87], 3, 2, 5);
    P.part(backHalf, S.a2, S.a3);
    // fist: cyan fingerless glove, knuckles toward the viewer
    var fist = P.spoly([80, 92, 81, 85, 86, 81, 94, 81, 99, 84, 100, 92, 98, 99, 90, 101, 83, 99]);
    P.part(fist, S.a1, S.al);
    P.recol(fist.band(3, -2), [S.a1], S.a2);
    P.recol(fist.band(-2, 2), [S.a1], S.a0);
    // finger tips (skin) along the front + finger lines
    var tips = P.poly([82, 89, 99, 87, 99, 92, 82, 94]).and(fist);
    P.recol(tips, [S.a1, S.a2, S.a0], S.s1);
    P.line([88, 88, 88, 93], S.sl); P.line([93, 87, 93, 92], S.sl);
    P.line([82, 88, 99, 86], S.al);
    // thumb across
    var thumb = P.sr([82, 96, 89, 96, 94, 94], 4, 3);
    P.part(thumb, S.a1, S.al);
    // swirl front half + droplets
    var front = P.sr([76, 87, 77, 95, 85, 101, 96, 100, 104, 94, 106, 86, 103, 80, 99, 79], 3, 1, 6);
    P.part(front, S.a1, S.a3);
    P.recol(front.band(0, -1), [S.a1], S.a0);
    P.recol(front.band(-1, 1).and(P.rect(0, 0, 112, 98)), [S.a1], S.a0);
    [[72, 84], [106, 82], [104, 100], [76, 102], [100, 76]].forEach(function (d, i) {
      P.px(d[0], d[1], i % 2 ? S.a0 : S.W); P.px(d[0], d[1] + 1, S.a1);
    });
  }

  // ---------------------------------------------------------------- face icon 24x24
  var FACE = [
    '..hh..............hh....',
    '.hTTh....hhhhh...hTTh...',
    '..hHHhhhhHHHHHhhhHHh....',
    '...hHHHHHHHHHHHHHHHh....',
    '..hHHHHHHHHHHHHHHHHHh...',
    '.hHHHHHHHHhHHHHhHHHHh...',
    '.hHHHHHHHhHHHHhHHHHHHh..',
    'hHHHHHHhfffHHhffhHHHHh..',
    'hHHHHHhfffffhffffhHHHh..',
    'hHHHHhKKKKfffKKKfhHHh...',
    'hHHHhfKDWDfffKDWKfhHh...',
    'hHHHhfKsDsfffKsDKfhHh...',
    'hHHHhfwBBwfffwBBwfhHh...',
    'hHHHhfffffffffffffhHh...',
    'hHHHhbbfffffffbbfhHh....',
    '.hHHhffffmWmmfffhHh.....',
    '.hTThfffffmmffffhTh.....',
    '..hhhhhffffffffhhh......',
    '...hddddhffffhdddh......',
    '..hdddddhcccchdddddh....',
    '.hddDddcccccccddDdddh...',
    '.hdddcccccccccccdddddh..',
    'hdddcccccccccccccccdddh.',
    'hddcccccccccccccccccddh.'
  ];
  var FL = { h: S.hl, H: S.h1, T: S.t1, f: S.s1, K: S.lash, D: S.e2, W: S.W, s: S.e1, w: S.ew, B: S.e0, b: S.bl, m: S.mo, c: S.c1, d: S.d1 };

  I.ART.deepseek = {
    bust: function () { var P = K.painter(112, 128); drawBust(P, {}); return P; },
    bustWin: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'win' }); return P; },
    bustLose: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'lose' }); return P; },
    titleFrame: function (o) { var P = K.painter(112, 128); drawBust(P, o); return P; },
    cutin: function () { return I.cutin ? I.cutin('deepseek') : K.painter(240, 72); },
    face: function () { var P = K.painter(24, 24); P.map(0, 0, FACE, FL); return P; }
  };
  I.drawDeepseekBust = drawBust;
})();
