/* LATENT CLASH — ILLUST: Claude 娘 portraits (bust / bustWin / bustLose / cutin / face).
 * Drawn in palette slots (see core.js) so palette 0/1 recolour exactly.
 * Light: upper-front (upper right, she faces right). */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit, S = K.S;
  I.ART = I.ART || {};

  // ---------------------------------------------------------------- hand-typed face maps
  var EL = { K: S.lash, k: S.e3, D: S.e3, s: S.e2, B: S.e1, H: S.e0, w: S.ew, W: S.W, P: S.lash, x: S.s2, l: S.sl, y: S.s3, b: S.bl, c: S.blS, m: S.mo, t: S.tg, n: S.sl, r: S.tear, R: S.tear2 };
  var EYES = {
    // near eye (outer corner on the left, gentle droop)
    near: [
      '.....KKKK...',
      '...KKKKKKKK.',
      '.KKKKKKKKKKK',
      'KKKDDDDDDDKw',
      'K.wDDssWWDDw',
      '..wDsssWWsDw',
      '..wsssPPssDw',
      '..wsBBPPBssw',
      '..wBBBBBBBsw',
      '..wHWBBBBBHw',
      '...wHHBBHH.l',
      '....llllll..'
    ],
    far: [
      '...KKK..',
      '.KKKKKKK',
      'KKKKKKKK',
      'wDDDDDDK',
      'wDssWWDK',
      'wsssWWDw',
      'wssPPsDw',
      'wBBPPBsw',
      'wBBBBBsw',
      'wHBBBHHw',
      '.wHHHHw.',
      '..llll..'
    ],
    // win: happy closed arcs
    nearHappy: [
      '............',
      '............',
      '............',
      '............',
      '....KKKKK...',
      '..KKKyyyKKK.',
      '.KKy.....yKK',
      '.K.........K',
      '............',
      '............',
      '............',
      '............'
    ],
    farHappy: [
      '.........',
      '.........',
      '.........',
      '.........',
      '..KKKKK..',
      '.KKyyyKK.',
      'KKy...yKK',
      'K.......K',
      '.........',
      '.........',
      '.........',
      '.........'
    ],
    // lose: tired, half-lidded, teary
    nearTired: [
      '............',
      '............',
      '............',
      '..yyyyyy....',
      '.KKKKKKKKKK.',
      'KKKDDDDDDKKK',
      'K.wDsssWWDw.',
      '..wsssPPsDw.',
      '..wBBBPPBsw.',
      '..wHBBBBBHw.',
      '..rrHHBBHHrR',
      '...rRllllRr.'
    ],
    farTired: [
      '.........',
      '.........',
      '.........',
      '...yyyy..',
      'KKKKKKKKK',
      'KKDDDDDKK',
      'wDsWWsDDw',
      'wsPPssDDw',
      'wBPPBBssw',
      'wHBBBBHHw',
      'rHHBBHHrR',
      '.RllllRr.'
    ]
  };
  var MOUTHS = {
    smile: [
      'n.....n',
      '.nmmmn.',
      '.......'
    ],
    open: [
      'n......n',
      '.nmmmmn.',
      '..ntttn.',
      '...nnn..'
    ],
    wobble: [
      '.......',
      '.nn.nn.',
      'n..n..n'
    ]
  };

  // ---------------------------------------------------------------- helpers
  var HAIR = [S.h0, S.h1, S.h2, S.h3, S.hl];
  function tipMap(P, region, test) {
    var map = {}; map[S.h0] = S.t0; map[S.h1] = S.t0; map[S.h2] = S.t1; map[S.h3] = S.tS; map[S.hl] = S.tl;
    for (var y = 0; y < P.h; y++) for (var x = 0; x < P.w; x++) {
      var i = y * P.w + x; if (!region.d[i]) continue;
      var v = test(x, y), to = map[P.c[i]]; if (!to) continue;
      if (v >= 2 || (v >= 0 && ((x + y) & 1) === 0)) P.c[i] = to;
      if (v >= 0 && v < 2 && to === S.t0 && ((x + y) & 1) === 1) P.c[i] = S.h0;
    }
  }
  // starburst: irregular 8-ray spark polygon around (cx,cy)
  function starburst(P, cx, cy, r, rot, irregular) {
    var pts = [], lens = irregular || [1, 0.62, 0.9, 0.55, 1, 0.66, 0.84, 0.58];
    for (var i = 0; i < 16; i++) {
      var a = rot + i * Math.PI / 8, rr = i % 2 === 0 ? r * lens[(i >> 1) % lens.length] : r * 0.36;
      pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    return P.poly(pts);
  }
  I.starburst = starburst;
  function sparkle(P, x, y, big) {   // 4-point twinkle in light slots
    P.px(x, y, S.W);
    P.px(x - 1, y, S.sp); P.px(x + 1, y, S.sp); P.px(x, y - 1, S.sp); P.px(x, y + 1, S.sp);
    if (big) { P.px(x - 2, y, S.a1); P.px(x + 2, y, S.a1); P.px(x, y - 2, S.a1); P.px(x, y + 2, S.a1); P.px(x, y - 3, S.a2); P.px(x, y + 3, S.a2); }
  }
  I.sparkle = sparkle;

  // ---------------------------------------------------------------- bust
  // a hair clump: tapered ribbon with lit/shaded edges, optional mid highlight streak and cream tip
  // c = [points, w0, w1, wm, tipFrac, shine]
  function hairClump(P, c, base) {
    var m = P.sr(c[0], c[1], c[2], c[3]);
    var hi = base === S.h1 ? S.h0 : S.h1, lo = base === S.h1 ? S.h2 : S.h3;
    P.part(m, base, S.hl);
    P.recol(m.band(3, -1), [base], lo);
    P.recol(m.band(-1, 2), [base], hi);
    if (c[5]) P.recol(P.sr(c[0], c[1] * 0.35, 0, c[3] * 0.3, c[5][0], c[5][1]).shift(1, -1), [base, lo], hi);
    if (c[4]) {
      var full = P.sr(c[0], c[1], c[2], c[3], 1 - c[4]), dz = P.sr(c[0], c[1], c[2], c[3], 1 - c[4] - 0.07).sub(full);
      tipMap(P, full, function () { return 3; });
      tipMap(P, dz, function () { return 0; });
    }
    return m;
  }
  function drawBust(P, o) {
    var expr = o.expr || 'n', sw = o.sway || 0;
    var lose = expr === 'lose', win = expr === 'win';

    // ---- back hair: falls behind her shoulders, lower locks stream left in the wind (cream tips)
    var back = P.mask();
    [
      [[43, 13, 28, 18, 19, 32, 15, 50, 13 + sw * 0.5, 68, 10 + sw, 88, 8 + sw * 1.5, 108, 7 + sw * 2, 136], 24, 16, 26, 0, [0.08, 0.4]],
      [[38, 30, 28, 50, 24, 70, 21 + sw, 92, 18 + sw * 1.5, 114, 17 + sw * 2, 136], 22, 18, 23, 0, [0.3, 0.55]],
      [[36, 52, 33, 74, 30, 96, 28 + sw, 118, 27 + sw, 136], 20, 18, 21],
      [[70, 26, 82, 42, 87, 62, 87 + sw * 0.5, 84, 90 + sw, 104, 93 + sw, 124], 20, 4, 20, 0, [0.1, 0.4]]
    ].forEach(function (c) { back = back.or(hairClump(P, c, S.h2)); });
    P.line([31, 30, 21, 48, 18, 70, 15 + sw, 94, 13 + sw * 1.5, 120], S.h3, true, true);
    P.line([31, 58, 27, 80, 24 + sw, 104, 23 + sw * 2, 130], S.h3, true, true);
    // wind-lifted locks streaming left over the mass, cream tips
    hairClump(P, [[20, 62, 13, 74, 8 + sw * 2, 80, 2 + sw * 3, 84], 11, 0, 9, 0.38], S.h2);
    hairClump(P, [[22, 92, 14, 104, 8 + sw * 2, 110, 1 + sw * 3, 116], 12, 0, 10, 0.4], S.h2);
    hairClump(P, [[20, 112, 12, 122, 6 + sw * 2, 128, 0 + sw * 3, 133], 11, 0, 10, 0.4], S.h2);

    // ---- body: neck, capelet, blouse, ribbon
    var neck = P.poly([49, 60, 61, 60, 61, 86, 49, 86]);
    P.part(neck, S.s1, S.sl);
    var cape = P.spoly([46, 79, 32, 83, 19, 90, 11, 101, 7, 116, 5, 134, 107, 134, 105, 114, 100, 100, 92, 90, 79, 83, 64, 79]);
    P.part(cape, S.c1, S.cl);
    P.recol(cape.band(5, -2), [S.c1], S.c2);
    P.recol(cape.band(-2, 3), [S.c1], S.c0);
    P.recol(P.spoly([36, 84, 46, 84, 50, 98, 46, 112, 40, 120, 34, 110]).and(cape), [S.c1, S.c0], S.c2);
    P.recol(P.spoly([62, 84, 74, 84, 80, 96, 74, 110, 66, 112]).and(cape), [S.c1, S.c0], S.c2);
    P.recol(P.spoly([5, 112, 14, 104, 20, 116, 16, 134, 4, 134]).and(cape), [S.c1, S.c0], S.c2);
    P.line([24, 96, 19, 112, 17, 128], S.c2, true);
    P.line([33, 104, 31, 118, 32, 128], S.c2, true);
    P.line([88, 98, 93, 112, 95, 128], S.c2, true);
    P.line([23, 97, 18, 112, 16, 128], S.c3, true, true);
    var blouse = P.poly([47, 81, 62, 81, 57, 106, 53, 106]);
    P.part(blouse, S.W, S.cl);
    var lapL = P.spoly([46, 78, 40, 84, 37, 95, 42, 108, 51, 116, 54, 108, 48, 95, 49, 84]);
    var lapR = P.spoly([63, 78, 70, 82, 74, 92, 69, 106, 58, 116, 56, 108, 63, 95, 61, 84]);
    P.part(lapL, S.c1, S.cl); P.part(lapR, S.c0, S.cl);
    P.recol(lapL.band(2, 0), [S.c1], S.c2);
    P.recol(lapR.band(2, -1), [S.c0], S.c1);
    P.recol(lapL.or(lapR).shift(-2, 3).sub(lapL).sub(lapR).and(cape), [S.c1, S.c0], S.c2);
    var tails = P.poly([53, 88, 57, 88, 52, 106, 47, 104]).or(P.poly([54, 88, 58, 88, 64, 104, 59, 106]));
    P.part(tails, S.a2, S.al);
    P.recol(tails.band(-1, 0), [S.a2], S.a1);
    var loops = P.ell(49.5, 86, 5.5, 3.6, 0.3).or(P.ell(61, 86, 5.5, 3.6, -0.3));
    P.part(loops, S.a1, S.al);
    P.recol(loops.band(0, -2), [S.a1], S.a2);
    P.part(P.ell(55.5, 86, 2.7, 2.7), S.m1, S.ml);
    P.px(55, 85, S.m0); P.px(56, 85, S.W);

    // ---- head
    var skull = P.ell(52, 36, 27, 26.5).or(P.ell(46, 40, 22, 24));
    hairClump(P, [[71, 30, 77, 46, 79, 62, 81 + sw * 0.5, 76, 83 + sw, 89], 10, 0, 11, 0.25], S.h1);
    P.part(skull, S.h1, S.hl);
    var face = P.spoly([34, 28, 32, 38, 33, 48, 36, 55, 41, 61, 48, 66, 55, 70.5, 61, 73, 65, 72, 70, 67, 74, 61, 77, 55, 78, 50, 76.5, 45, 77.5, 39, 76.5, 30, 64, 25, 46, 25]);
    P.part(face, S.s1, S.sl);
    P.recol(neck.and(face.shift(-1, 4)).sub(face), [S.s1], S.s2);
    P.recol(face.band(3, 0).and(P.rect(0, 40, 40, 30)), [S.s1], S.s2);
    P.part(P.ell(34, 50, 3, 5), S.s1, S.sl);

    // ---- face features
    P.map(41, 41, lose ? EYES.nearTired : win ? EYES.nearHappy : EYES.near, EL);
    P.map(62, 41, lose ? EYES.farTired : win ? EYES.farHappy : EYES.far, EL);
    if (lose) { P.line([42, 36, 46, 35, 50, 36], S.hl); P.line([63, 36, 66, 35, 68, 36], S.hl); }
    else { P.line([43, 37, 46, 36, 51, 36], S.hl); P.line([63, 36, 67, 36, 69, 37], S.hl); }
    P.px(68, 56, S.s2); P.px(68, 57, S.sl);
    P.map(59, 62, win ? MOUTHS.open : lose ? MOUTHS.wobble : MOUTHS.smile, EL);
    [[43, 55], [45, 55], [47, 55], [49, 55], [44, 56], [46, 56], [48, 56], [64, 55], [66, 55], [68, 55], [65, 56], [67, 56]].forEach(function (p) {
      if (P.get(p[0], p[1]) === S.s1) P.px(p[0], p[1], (p[0] + p[1]) & 1 ? S.bl : S.blS);
    });

    // ---- fringe (side-swept from a part on her near side), cast shadow first
    var FR = [
      [[52, 11, 66, 15, 75, 25, 78, 37, 78, 47], 15, 0, 13],
      [[47, 11, 58, 18, 65, 28, 68, 37, 67, 42], 14, 0, 14],
      [[42, 12, 50, 21, 56, 31, 58, 38, 56, 43], 13, 0, 14],
      [[38, 13, 42, 23, 46, 31, 47, 39], 12, 0, 12],
      [[34, 15, 33, 25, 35, 35, 38, 43], 11, 0, 11]
    ];
    var fringe = P.mask();
    FR.forEach(function (c) { fringe = fringe.or(P.sr(c[0], c[1], c[2], c[3])); });
    P.recol(fringe.shift(-1, 2).or(fringe.shift(0, 2)), [S.s1], S.s2);
    FR.forEach(function (c) { hairClump(P, c, S.h1); });
    P.line([58, 16, 64, 26, 66, 34], S.h2, true, true);
    P.line([46, 16, 50, 26, 52, 33], S.h2, true, true);
    // near side lock (in front of the ear, over the capelet)
    var nearLock = hairClump(P, [[36, 27, 30, 42, 29, 58, 31, 74, 27 + sw, 90, 24 + sw * 2, 104, 20 + sw * 2, 110], 11, 0, 12, 0.25, [0.1, 0.4]], S.h1);
    P.line([32, 40, 31, 58, 32, 76], S.h2, true, true);
    // skull shading + broken highlight ring
    P.recol(skull.band(5, -4), [S.h1], S.h2);
    var ring = P.ell(55, 33, 25, 21).sub(P.ell(56, 36, 25, 21)).and(skull);
    P.recol(ring, [S.h1], S.h0);
    // ahoge
    var aho = lose ? P.sr([52, 12, 50, 6, 46, 4, 42, 7], 3, 1) : P.sr([52, 12, 53, 5, 58, 1, 64, 2, 66, 6], 3, 1);
    P.part(aho, S.h1, S.hl);
    // starburst hair clip on the near side of the head
    var clip = starburst(P, 31, 23, 8.5, -0.25);
    P.part(clip, S.a1, S.al);
    P.recol(clip.band(-1, -1), [S.a1], S.a0);
    P.px(31, 23, S.W); P.px(32, 23, S.a0); P.px(31, 22, S.a0); P.px(30, 23, S.a0); P.px(31, 24, S.a0);

    if (!o.noPen) drawPen(P, o);

    P.outer(S.ol);

    // ---- expression accents
    if (win) { sparkle(P, 86, 26, true); sparkle(P, 18, 16, false); sparkle(P, 74, 7, false); }
    if (lose) P.map(76, 28, ['.r.', 'rRr', 'rRR', '.R.'], EL);
    if (!o.noPen) sparkle(P, 101, 2, win);
  }

  function drawPen(P, o) {
    var bx0 = 89, by0 = 134, bx1 = 100, by1 = 19;
    var barrel = P.poly([bx0 - 4.5, by0, bx0 + 4.5, by0, bx1 + 4, by1, bx1 - 4, by1]);
    P.part(barrel, S.d1, S.dl);
    P.recol(barrel.band(-2, 0), [S.d1], S.d0);
    P.recol(barrel.band(3, 0), [S.d1], S.d2);
    [[30, 3], [36, 1]].forEach(function (b) {
      var t = (b[0] - by1) / (by0 - by1), cx = bx1 + (bx0 - bx1) * t, cy = b[0];
      var band = P.poly([cx - 5.5, cy, cx + 5.5, cy - 1, cx + 5.5, cy - 1 + b[1], cx - 5.5, cy + b[1]]);
      P.part(band, S.m1, S.ml); P.recol(band.band(-2, 0), [S.m1], S.m0);
    });
    var sec = P.poly([bx1 - 4, by1, bx1 + 4, by1, bx1 + 3.6, by1 - 4, bx1 - 3, by1 - 4]);
    P.part(sec, S.d2, S.dl);
    var nib = P.spoly([bx1 - 3, by1 - 4, bx1 - 3, by1 - 9, bx1 + 0.5, by1 - 16, bx1 + 2.5, by1 - 14, bx1 + 3.6, by1 - 9, bx1 + 3.6, by1 - 4]);
    P.part(nib, S.m1, S.ml);
    P.recol(nib.band(-2, 0), [S.m1], S.m0);
    P.line([bx1 + 0.5, by1 - 5, bx1 + 1, by1 - 13], S.m3);
    P.px(Math.round(bx1 + 0.5), by1 - 7, S.ml);
    // sleeve + terracotta cuff + fist around the barrel
    var sleeve = P.poly([82, 116, 97, 118, 90, 134, 70, 134]);
    P.part(sleeve, S.W, S.cl);
    P.recol(sleeve.band(3, -1), [S.W], S.c1);
    var cuff = P.spoly([82, 112, 95, 111, 99, 115, 96, 122, 82, 121, 79, 116]);
    P.part(cuff, S.a2, S.al);
    P.recol(cuff.band(-1, 2), [S.a2], S.a1);
    P.recol(cuff.band(2, -1), [S.a2], S.a3);
    var fist = P.spoly([83, 104, 85, 99, 90, 97, 96, 98, 99, 102, 99, 108, 97, 113, 90, 114, 85, 112]);
    P.part(fist, S.s1, S.sl);
    P.recol(fist.band(3, -2), [S.s1], S.s2);
    P.line([86, 102, 92, 102.5, 98, 102], S.sl, true);
    P.line([86, 106, 92, 106.5, 98, 106], S.sl, true);
    P.line([86, 110, 92, 110.5, 97, 110], S.sl, true);
    var thumb = P.sr([84, 108, 85, 102, 89, 98, 93, 97], 4.5, 3);
    P.part(thumb, S.s1, S.sl);
    P.px(92, 98, S.s0); P.px(97, 101, S.s0);
  }

  // ---------------------------------------------------------------- face icon 24x24 (hand-typed)
  var FACE = [
    '........hhhhh...........',
    '.....hhhHHHHhhh.........',
    '...hhHHHHHHHHHHhh.......',
    '..hHHHAHHHHHHHHHHh......',
    '.hHHAaAHHHHHHHHHHHh.....',
    '.hHHHAHHhHHHHhHHHHHh....',
    'hHHHHHHhHHHHhHHHHHHh....',
    'hHHHHHhfffHhffhHHHHHh...',
    'hHHHHhfffffhffffhHHHh...',
    'hHHHhKKKKfffKKKfhHHh....',
    'hHHHhKDWDfffKDWKfhHh....',
    'hHHhfKsDsfffKsDKfhHh....',
    'hHHhfwBBwfffwBBwfhh.....',
    'hHHhfffffffffffffhh.....',
    'hHHHhbbfffffffbbfh......',
    '.hHHhfffffmmfffff.......',
    '.hHHHhfffffffffh........',
    '..hHHHhhffffffh.........',
    '..hHHhhcRRRRRch.........',
    '...hhhccaRaRaRcch.......',
    '...hhccccRRRccccch......',
    '....hcccccRcccccccch....',
    '....cccccccccccccccc....',
    '...ccccccccccccccccccc..'
  ];
  var FL = { h: S.hl, H: S.h1, A: S.a1, a: S.W, f: S.s1, K: S.lash, D: S.e2, W: S.W, s: S.e1, w: S.ew, B: S.e0, b: S.bl, m: S.mo, c: S.c1, R: S.a2 };

  I.ART.claude = {
    bust: function () { var P = K.painter(112, 128); drawBust(P, {}); return P; },
    bustWin: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'win' }); return P; },
    bustLose: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'lose' }); return P; },
    titleFrame: function (o) { var P = K.painter(112, 128); drawBust(P, o); return P; },
    cutin: function () { return I.cutin ? I.cutin('claude') : K.painter(240, 72); },
    face: function () { var P = K.painter(24, 24); P.map(0, 0, FACE, FL); return P; }
  };
  I.drawClaudeBust = drawBust;
  I.H = { tipMap: tipMap, hairClump: hairClump, sparkle: sparkle, starburst: starburst };
})();
