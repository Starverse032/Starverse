/* LATENT CLASH — ILLUST: DeepSeek 娘 portraits, V2 design (ZipZipPipe's 鲸鱼女仆).
 * bust / bustWin / bustLose / face here; cut-in in cutin.js. Same construction, head size and light
 * (upper right) as Claude's portraits. Three-quarter view facing right. */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit, S = K.S;
  I.ART = I.ART || {};

  var EL = { K: S.lash, k: S.eK, D: S.e3, s: S.e2, B: S.e1, H: S.e0, w: S.ew, W: S.W, P: S.lash, x: S.s2, l: S.sl, y: S.s3,
    b: S.bl, c: S.blS, m: S.mo, t: S.tg, n: S.sl, r: S.tear, R: S.tear2, a: S.a1, A: S.a0, o: S.ol };
  var EYES = {
    // big bright round eyes, outer lashes flick up
    near: [
      'K..KKKKKK...',
      '.KKKKKKKKKK.',
      '..KkDDDDDkKK',
      '..wDDsWWDDkw',
      '..wDsPPWWsDw',
      '..wssPPPssDw',
      '..wsBPPPBssw',
      '..wBBBBBBBsw',
      '..wBHHBBHHBw',
      '...wHHWHHHw.',
      '....llllll..'
    ],
    far: [
      '...KKKK.K',
      '.KKKKKKKK',
      'KkDDDDkK.',
      'wDsWWDDw.',
      'wsPWWsDw.',
      'wsPPPsDw.',
      'wBPPBBsw.',
      'wBBBBBBw.',
      'wHHBBHHw.',
      '.wHWHHw..',
      '..llll...'
    ],
    // win: near eye winks (^ arc), far eye open
    nearWink: [
      '............',
      '............',
      '............',
      '............',
      '............',
      '.....KK.....',
      '...KK..KK...',
      '..K......KK.',
      '.K.........K',
      '............',
      '............'
    ],
    // lose: dizzy spirals ("服务器繁忙")
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
      '......KK....'
    ],
    farSpin: [
      '.........',
      '..KKKK...',
      '.K....K..',
      'K..KK..K.',
      'K.K..K.K.',
      'K.K.K..K.',
      'K..K..K..',
      '.K...K...',
      '..KKK....',
      '.........',
      '.........'
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

  // whale-fluke shape at (x,y), pointing along angle `ang` (radians), size k
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

  // paint a region in the fin ramp (navy-grey), pale inner face on `inner`
  function paintFin(P, m, inner) {
    P.fill(m.grow(1).sub(m).and(P.solid()), S.ol);
    P.part(m, S.x1, S.xl);
    P.recol(m.band(-1, 2), [S.x1], S.x0);
    P.recol(m.band(2, -2), [S.x1], S.x2);
    if (inner) { var im = inner.and(m); P.recol(im, [S.x1, S.x2, S.x0], S.xP); P.recol(im.band(2, -1), [S.xP], S.x0); }
  }

  // head geometry shared by bust and cut-in (bust pixel coordinates)
  var FR = [
    [[50, 14, 62, 18, 71, 26, 76, 36, 78, 46], 14, 0, 13],
    [[47, 15, 56, 22, 62, 32, 64, 42], 13, 0, 13],
    [[44, 15, 49, 25, 53, 34, 54, 43], 11, 0, 12],
    [[40, 16, 42, 25, 45, 33, 46, 41], 10, 0, 10],
    [[36, 18, 34, 28, 35, 37, 38, 44], 10, 0, 10]
  ];
  var FACEPTS = [35, 29, 32, 39, 33, 49, 36, 57, 41, 63, 47, 68, 54, 72, 59, 74, 63, 73.5, 68, 69.5, 72, 63, 75.5, 57, 77.5, 50, 77, 44, 77.5, 37, 76, 30, 64, 26, 46, 26];

  // ---------------------------------------------------------------- bust
  function drawBust(P, o) {
    var expr = o.expr || 'n', sw = o.sway || 0, H = I.H;
    var lose = expr === 'lose', win = expr === 'win';

    // ---- back hair: voluminous wavy curtain (deep blue), light-blue inner layer near the neck
    var back = P.spoly([54, 12, 38, 14, 26, 24, 19, 38, 14, 50, 10, 62, 10, 74, 6, 84, 6 + sw, 96, 2 + sw, 106, 4 + sw, 118, 1 + sw * 2, 132,
      109 + sw * 2, 132, 107 + sw, 118, 108 + sw, 106, 104, 96, 104, 84, 101, 72, 100, 60, 96, 48, 91, 34, 84, 22, 70, 14]);
    P.part(back, S.h2, S.hl);
    P.recol(back.band(4, -1), [S.h2], S.h3);
    var inner = P.spoly([34, 56, 44, 60, 46, 80, 42, 100, 40, 132, 74, 132, 72, 100, 68, 80, 70, 60, 80, 56, 84, 80, 86, 132, 30, 132, 28, 80]);
    P.fill(inner.and(back), S.t1);
    P.recol(inner.and(back).band(-2, 1), [S.t1], S.t0);
    P.recol(inner.and(back).band(3, 0), [S.t1], S.tS);
    I.H.strands(P, [[38, 62, 40, 80, 37, 104, 36, 130], [33, 66, 32, 90, 30, 130], [74, 62, 73, 82, 76, 104, 77, 130], [80, 64, 81, 90, 83, 130]], S.tS);
    // wavy clumps in the curtain
    [[[24, 46, 16, 62, 14, 78, 9 + sw, 92, 10 + sw, 108, 6 + sw * 2, 132], 9, 6, 10, 0.12, [0.1, 0.7]],
      [[30, 56, 24, 72, 23, 88, 19 + sw, 102, 20 + sw, 116, 17 + sw * 2, 132], 8, 5, 9, 0.14],
      [[86, 40, 93, 56, 94, 72, 99 + sw, 86, 98 + sw, 102, 102 + sw * 2, 132], 9, 6, 10, 0.12, [0.1, 0.7]]
    ].forEach(function (c) { H.hairClump(P, c, S.h2); });

    // ---- body: navy dress with puffed shoulders, white blouse front, frilled apron straps
    var neck = P.poly([50, 62, 62, 62, 63, 84, 50, 84]);
    P.part(neck, S.s1, S.sl);
    var bod = P.spoly([40, 84, 72, 84, 80, 96, 84, 128, 30, 128, 34, 96]);
    P.part(bod, S.d1, S.dl); P.recol(bod.band(5, 0), [S.d1], S.d2); P.recol(bod.band(-2, 2), [S.d1], S.d0);
    [[4, 132, 10, 104, 18, 92, 30, 87, 40, 92, 40, 132], [100, 132, 104, 112, 100, 96, 90, 89, 78, 90, 74, 132]].forEach(function (pp, i) {
      var arm = P.spoly(pp);
      P.part(arm, S.d1, S.dl); P.recol(arm.band(4, -1), [S.d1], S.d2); P.recol(arm.band(-2, 2), [S.d1], S.d0);
    });
    // puffed shoulders
    var puffN = P.spoly([12, 104, 14, 94, 22, 87, 32, 85, 42, 88, 44, 96, 38, 104, 26, 108]);
    var puffF = P.spoly([72, 90, 80, 86, 90, 87, 98, 93, 100, 102, 92, 106, 80, 104, 74, 98]);
    [puffN, puffF].forEach(function (pf) {
      P.part(pf, S.d1, S.dl);
      P.recol(pf.band(4, -2), [S.d1], S.d2);
      P.recol(pf.band(-2, 3), [S.d1], S.d0);
      P.recol(pf.band(-1, 1), [S.d0], S.c3);
    });
    P.line([24, 92, 22, 100, 24, 106], S.d2, true, true); P.line([32, 89, 31, 98, 32, 105], S.d2, true, true);
    P.line([86, 89, 85, 97, 86, 104], S.d2, true, true);
    // white blouse front, tiny buttons
    var blouse = P.spoly([49, 84, 64, 84, 66, 100, 67, 128, 46, 128, 47, 100]);
    P.part(blouse, S.c1, S.cl); P.recol(blouse.band(4, 0), [S.c1], S.c2); P.recol(blouse.band(-1, 0), [S.c1], S.c0);
    [100, 108, 116, 124].forEach(function (y) { P.px(57, y, S.cl); P.px(58, y, S.c2); });
    // frilled apron straps along the bodice
    [[[42, 86, 41, 100, 41, 116, 40, 132], -1], [[71, 86, 72, 100, 73, 116, 74, 132], 1]].forEach(function (s) {
      var st = P.sr(s[0], 5, 6);
      P.part(st, S.c0, S.cl); P.recol(st.band(s[1] * 2, 0), [S.c0], S.c2);
      for (var y = 88; y < 128; y += 4) { var xx = Math.round(s[0][0] + (y - 86) * (s[0][6] - s[0][0]) / 46) + s[1] * 3; P.px(xx, y, S.cl); P.px(xx, y + 1, S.c2); }
    });
    // gold buttons on the bodice (two rows)
    [[45, 112], [45, 122], [69, 112], [69, 122]].forEach(function (b) {
      P.part(P.ell(b[0], b[1], 1.8, 1.8), S.m1, S.ml); P.px(b[0], b[1] - 1, S.m0);
    });
    // collar + dark ribbon bow with a blue gem
    var col = P.spoly([47, 82, 56, 88, 65, 82, 67, 86, 58, 92, 54, 92, 45, 86]);
    P.part(col, S.c0, S.cl); P.recol(col.band(2, -1), [S.c0], S.c2);
    var bowL = P.poly([56, 90, 46, 85, 45, 94]), bowR = P.poly([57, 90, 67, 85, 68, 94]);
    var bt = P.poly([55, 91, 50, 104, 53, 103, 56, 93]).or(P.poly([58, 91, 63, 104, 60, 103, 57, 93]));
    P.part(bt.or(bowL).or(bowR), S.d2, S.dl);
    P.recol(bowL.or(bowR).band(-1, 1), [S.d2], S.d1); P.recol(bt.band(-1, 0), [S.d2], S.d1);
    P.line([48, 88, 53, 90], S.d3); P.line([65, 88, 60, 90], S.d3);
    var gem = P.ell(56.5, 90.5, 2.6, 2.6);
    P.part(gem, S.a1, S.a3); P.px(56, 89, S.W); P.px(57, 90, S.a0); P.px(57, 91, S.a2);

    // ---- far fin (behind the head)
    var finF = P.spoly([74, 27, 84, 30, 93, 36, 99, 45, 103, 55, 103, 61, 99, 60, 92, 53, 83, 47, 74, 43]);
    paintFin(P, finF, P.spoly([74, 43, 83, 47, 92, 53, 99, 60, 102, 58, 96, 48, 86, 40, 74, 35]));

    // ---- head
    var skull = P.ell(53, 38, 25, 26).or(P.ell(47, 43, 21, 23));
    P.part(skull, S.h1, S.hl);
    var face = P.spoly(FACEPTS);
    P.part(face, S.s1, S.sl);
    P.recol(neck.and(face.shift(-1, 5)).sub(face), [S.s1], S.s2);
    P.recol(face.band(2, 0).and(P.rect(0, 32, 44, 40)), [S.s1], S.s2);

    // ---- face features
    P.map(40, 43, lose ? EYES.nearSpin : win ? EYES.nearWink : EYES.near, EL);
    P.map(62, 43, lose ? EYES.farSpin : EYES.far, EL);
    P.px(71, 57, S.s2); P.px(71, 58, S.sl);
    if (lose) P.map(58, 64, MOUTHS.wavy, EL);
    else P.map(win ? 56 : 57, 63, win ? MOUTHS.big : MOUTHS.grin, EL);
    [[41, 56], [43, 56], [45, 56], [47, 56], [42, 57], [44, 57], [46, 57], [65, 56], [67, 56], [69, 56], [66, 57], [68, 57]].forEach(function (p) {
      if (P.get(p[0], p[1]) === S.s1) P.px(p[0], p[1], (p[0] + p[1]) & 1 ? S.bl : S.blS);
    });

    // ---- fringe: soft wavy bangs; cast shadow first
    var fringe = P.mask();
    FR.forEach(function (c) { fringe = fringe.or(P.sr(c[0], c[1], c[2], c[3])); });
    P.recol(fringe.shift(-1, 2).or(fringe.shift(0, 2)), [S.s1], S.s2);
    FR.forEach(function (c) { H.hairClump(P, c, S.h1); });
    P.recol(skull.band(5, -4), [S.h1], S.h2);
    var ring = P.ell(55, 35, 24, 20).sub(P.ell(56, 38, 24, 20)).and(skull);
    for (var gx = 0; gx < 112; gx += 6) ring = ring.sub(P.rect(gx, 0, 2, 40));
    P.recol(ring, [S.h1], S.h0);
    // wavy front locks (in front of the shoulders), light-blue ends
    H.hairClump(P, [[32, 40, 23, 54, 23, 68, 18 + sw, 82, 19 + sw, 96, 14 + sw * 2, 112], 11, 3, 12, 0.3, [0.1, 0.5]], S.h1);
    H.hairClump(P, [[81, 40, 89, 54, 89, 68, 94 + sw, 82, 93 + sw, 96, 98 + sw * 2, 110], 9, 3, 10, 0.3], S.h1);
    H.hairClump(P, [[37, 28, 31, 42, 32, 56, 28, 68, 29 + sw, 82, 25 + sw, 96, 26 + sw * 2, 110, 22 + sw * 2, 126], 13, 3, 13, 0.3, [0.1, 0.5]], S.h1);
    H.hairClump(P, [[39, 32, 37, 46, 39, 58, 36, 68], 5, 0, 6, 0.3], S.h1);
    H.hairClump(P, [[75, 28, 80, 42, 79, 56, 83, 68, 82 + sw, 82, 86 + sw, 96, 85 + sw * 2, 110, 89 + sw * 2, 124], 10, 3, 11, 0.3, [0.1, 0.5]], S.h1);

    // ---- near fin (lop-ear, drooping outward), pale inner face
    var finN = P.spoly([37, 28, 27, 31, 18, 37, 11, 46, 6, 56, 5, 63, 9, 63, 16, 57, 25, 51, 36, 47]);
    paintFin(P, finN, P.spoly([36, 47, 25, 51, 16, 57, 9, 63, 7, 59, 14, 50, 24, 43, 36, 40]));
    P.line([33, 33, 23, 38, 15, 46, 10, 55], S.x2, true, true);

    // ---- maid headdress: white frilled band across the crown, cyan bow at the far side
    var band = P.sr([31, 31, 36, 21, 46, 15, 58, 14, 70, 17, 78, 25, 80, 29], 4, 3.5, 5);
    var fr = P.mask();
    [[32, 25], [36, 19], [41, 15], [47, 12], [53, 11], [59, 11], [65, 13], [71, 16], [76, 20], [79, 25]].forEach(function (p) { fr = fr.or(P.ell(p[0], p[1], 3.4, 3)); });
    fr = fr.sub(band);
    P.part(fr, S.c0, S.cl);
    P.recol(fr.band(2, -1), [S.c0], S.c2);
    P.part(band, S.c1, S.cl); P.recol(band.band(0, -1), [S.c1], S.c2);
    [[38, 20], [47, 15], [56, 14], [65, 15], [73, 20]].forEach(function (p) { P.px(p[0], p[1], S.c2); });
    var bw = P.poly([80, 26, 88, 21, 89, 28]).or(P.poly([80, 26, 74, 19, 72, 26])), bk = P.ell(80, 26, 2, 2);
    P.part(bw, S.a1, S.al); P.recol(bw.band(-1, 1), [S.a1], S.a0); P.recol(bw.band(1, -1), [S.a1], S.a2);
    P.part(bk, S.a2, S.al); P.px(80, 25, S.a0);
    var btail = P.sr([80, 28, 82, 33, 85, 36], 2, 1.5);
    P.part(btail, S.a2, S.al);

    // ---- ahoge: long curl
    if (lose) P.part(P.sr([53, 12, 51, 7, 47, 5, 43, 7, 42, 11], 3, 1), S.h1, S.hl);
    else {
      var aho = P.sr([52, 12, 53, 6, 57, 2, 63, 1, 68, 3, 69, 7, 67, 9], 3.4, 1.2);
      P.part(aho, S.h1, S.hl); P.recol(aho.band(-1, 1), [S.h1], S.h0);
    }

    // ---- raised hand: waving (thumbs-up when she wins; lowered when the server is busy)
    if (!lose) drawWave(P, o);
    if (win) drawRice(P, 14, 14);

    P.outer(S.ol);

    if (win) { H.sparkle(P, 24, 44, false); H.sparkle(P, 100, 30, true); H.sparkle(P, 8, 70, false); }
    if (lose) {
      // "server busy" spinner above her head
      [[0, -5], [3.5, -3.5], [5, 0], [3.5, 3.5], [0, 5], [-3.5, 3.5], [-5, 0], [-3.5, -3.5]].forEach(function (d, i) {
        var x = Math.round(92 + d[0]), y = Math.round(12 + d[1]);
        P.px(x, y, i < 3 ? S.a0 : i < 6 ? S.a1 : S.a2); if (i < 2) { P.px(x + 1, y, S.a0); }
      });
      P.map(77, 34, ['.r.', 'rRr', 'rRR', '.R.'], EL);
    }
  }

  function drawWave(P, o) {
    // navy sleeve rising from the bottom right, white frilled cuff, open palm
    var arm = P.sr([100, 134, 99, 116, 97, 100], 13, 10);
    P.part(arm, S.d1, S.dl); P.recol(arm.band(3, 0), [S.d1], S.d2); P.recol(arm.band(-2, 0), [S.d1], S.d0);
    var cuff = P.spoly([88, 98, 92, 93, 98, 92, 105, 93, 108, 98, 104, 101, 98, 100, 92, 101]);
    P.part(cuff, S.c0, S.cl); P.recol(cuff.band(2, -1), [S.c0], S.c2);
    P.px(92, 100, S.cl); P.px(97, 100, S.cl); P.px(103, 100, S.cl);
    if (o.expr === 'win') {
      // thumbs-up: curled fist, thumb straight up
      var fist = P.spoly([89, 93, 88, 85, 92, 80, 101, 80, 105, 84, 105, 92, 101, 96, 93, 96]);
      var th = P.sr([95, 82, 95, 75, 96, 69], 4.4, 3.6);
      var hd = fist.or(th);
      P.part(hd, S.s1, S.sl); P.recol(hd.band(2, -1), [S.s1], S.s2); P.recol(hd.band(-1, 1), [S.s1], S.s0);
      [84, 88, 92].forEach(function (y) { P.line([91, y, 96, y + 0.5, 103, y], S.s2, true); });
      P.line([92, 82, 99, 82], S.sl);
      return;
    }
    var palm = P.spoly([91, 92, 90, 84, 92, 79, 100, 78, 104, 81, 105, 89, 101, 94, 95, 95]);
    var fingers = [[[93, 81, 92.5, 76, 92, 72], 3.6, 3.2], [[96.5, 80, 96.5, 74, 96.5, 70], 3.6, 3.4], [[100, 80, 100.5, 75, 101, 71], 3.6, 3.2], [[103, 82, 104.5, 78, 105.5, 75], 3.2, 2.8]];
    var hand = palm;
    fingers.forEach(function (f) { hand = hand.or(P.sr(f[0], f[1], f[2])); });
    var thumb = P.sr([92, 89, 88, 85, 86, 81], 3.6, 2.8);
    hand = hand.or(thumb);
    P.part(hand, S.s1, S.sl);
    P.recol(hand.band(2, -1), [S.s1], S.s2);
    P.recol(hand.band(-1, 1), [S.s1], S.s0);
    [[94.5, 72, 94.5, 79], [98.5, 71, 98.5, 79], [102.5, 74, 102, 80]].forEach(function (l) { P.line(l, S.s2); });
    P.line([90, 86, 92, 89], S.s2);
    P.line([94, 88, 97, 90, 101, 88], S.s2, true);
  }

  // a little bowl of white rice (her favourite) floating beside her when she wins
  function drawRice(P, x, y) {
    var rice = P.spoly([x - 7, y + 1, x - 5, y - 4, x, y - 6, x + 5, y - 4, x + 7, y + 1]);
    P.part(rice, S.c0, S.cl); P.recol(rice.band(2, -1), [S.c0], S.c2);
    [[-3, -3], [1, -4], [3, -1], [-1, -1], [-5, 0]].forEach(function (d) { P.px(x + d[0], y + d[1], S.W); });
    var bowl = P.poly([x - 8, y, x + 8, y, x + 6, y + 6, x + 3, y + 8, x - 3, y + 8, x - 6, y + 6]);
    P.part(bowl, S.d1, S.dl); P.recol(bowl.band(3, -1), [S.d1], S.d2); P.recol(bowl.band(-1, 1), [S.d1], S.d0);
    P.fill(P.rect(x - 7, y + 2, 14, 1).and(bowl), S.a1);
    P.line([x + 2, y - 2, x + 11, y - 9], S.m1); P.line([x + 4, y - 1, x + 12, y - 7], S.m2);
  }

  // ---------------------------------------------------------------- face icon 24x24
  var FACE = [
    '..........hh............',
    '.........h..h...........',
    '......hWWWWWWWh.........',
    '....hWWcWWcWWcWWh.aa....',
    '...hHHHHHHHHHHHHWhaAa...',
    '..hHHHHHHHHHHHHHHHha....',
    '.xxhHHHHHHhHHHHhHHHhxx..',
    'xXXxHHHHHhfHHHhffHHxXXx.',
    'xXXXxHHhfffHHhffffxXXXx.',
    '.xXXxHhKKKKfffKKKfxXXx..',
    '..xXxhKDWDffKDWKfhxXx...',
    '..hxxfwsBwfffsBwfhxxh...',
    '..hHhfffffffffffffhHh...',
    '..hHhfbbfffffffbbfhHh...',
    '..hHHhffffflmmlffhHHh...',
    '..hTHhffffffmWmffhTHh...',
    '..hTTHhffffffffhhTTTh...',
    '..hTThCChffffhCChTTh....',
    '..hThdCChCCCChCCdhTTh...',
    '..hhdddCCCaCCCCdddhh....',
    '..hddddCCCCCCCCddddh....',
    '.hdddddCCCCCCCCdddddh...',
    'hdddddCCCCCCCCCCddddhh..',
    'hdddMdCCCCCCCCCCdMdddh..'
  ];
  var FL = { h: S.hl, H: S.h1, T: S.t1, f: S.s1, K: S.lash, D: S.e3, W: S.c0, s: S.e2, w: S.ew, B: S.e1, b: S.bl, m: S.mo,
    C: S.c1, d: S.d1, a: S.a1, A: S.a0, x: S.x1, X: S.xP, M: S.m1, l: S.sl };

  I.ART.deepseek = {
    bust: function () { var P = K.painter(112, 128); drawBust(P, {}); return P; },
    bustWin: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'win' }); return P; },
    bustLose: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'lose' }); return P; },
    titleFrame: function (o) { var P = K.painter(112, 128); drawBust(P, o); return P; },
    cutin: function () { return I.cutin ? I.cutin('deepseek') : K.painter(240, 72); },
    face: function () { var P = K.painter(24, 24); P.map(0, 0, FACE, FL); return P; }
  };
  I.drawDeepseekBust = drawBust;
  I.ART.deepseek.head = { FR: FR, face: FACEPTS, skull: [[53, 38, 25, 26], [47, 43, 21, 23]] };
})();
