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
      '....KKKKKK..',
      '..KKKKKKKKKK',
      '.KKKDDDDDDKK',
      'KKKDDDDDDDDw',
      'K.wDsssWWDDw',
      '..wDssWWWsDw',
      '..wsssPPssDw',
      '..wsBBPPBssw',
      '..wBBBBBBBsw',
      '..wHBBBBBBHw',
      '...wHHBBHH.l',
      '....llllll..'
    ],
    far: [
      '..KKKKK..',
      'KKKKKKKKK',
      'KKDDDDDKK',
      'wDDDDDDDK',
      'wDsWWssDK',
      'wDsWWssDw',
      'wsPPsssDw',
      'wsPPBBssw',
      'wBBBBBBsw',
      'wHBBBBHHw',
      '.HHBBHHw.',
      '..llll...'
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
  function drawBust(P, o) {
    var expr = o.expr || 'n', sw = o.sway || 0;
    var lose = expr === 'lose', win = expr === 'win';

    // ---- back hair (long, flowing to the left behind her)
    var back = P.sr([46, 14, 28, 22, 17, 40, 13, 62, 9 + sw, 86, 3 + sw * 2, 108, -2 + sw * 3, 128], 34, 14, 34)
      .or(P.sr([40, 28, 29, 52, 25, 78, 19 + sw, 102, 13 + sw * 2, 128], 24, 12, 24))
      .or(P.sr([38, 46, 36, 72, 34, 98, 32, 128], 18, 16, 20))
      .or(P.sr([70, 28, 82, 46, 86, 70, 85 + sw, 94, 90 + sw * 2, 114], 20, 3, 18));
    P.part(back, S.h2, S.hl);
    // internal clump lines + shade in the back hair
    P.recol(back.band(3, 0), [S.h2], S.h3);
    P.line([22, 34, 16, 58, 14, 84, 8 + sw, 108], S.hl, true);
    P.line([30, 52, 26, 78, 22 + sw, 104, 18 + sw * 2, 126], S.hl, true);
    P.line([80, 50, 84, 74, 86 + sw, 98], S.hl, true);
    P.line([16, 50, 13, 72, 9 + sw, 96], S.h1, true);
    P.line([26, 70, 22 + sw, 92, 16 + sw * 2, 116], S.h1, true);
    tipMap(P, back, function (x, y) { return (y - 104) + (40 - x) * 0.35; });

    // ---- body: capelet, blouse, ribbon
    var neck = P.poly([48, 60, 61, 60, 61, 88, 48, 88]);
    P.part(neck, S.s1, S.sl);
    var cape = P.spoly([46, 82, 34, 86, 22, 94, 14, 106, 10, 120, 8, 132, 104, 132, 102, 116, 98, 102, 90, 92, 76, 86, 64, 83]);
    P.part(cape, S.c1, S.cl);
    P.recol(cape.band(4, -2), [S.c1], S.c2);
    P.recol(cape.band(2, -1).and(cape.band(5, -3).not()), [S.c2], S.c2);
    P.recol(cape.band(-2, 3), [S.c1], S.c0);       // lit shoulder tops
    // capelet folds
    P.line([26, 100, 22, 116, 21, 128], S.c2, true);
    P.line([40, 106, 38, 128], S.c2, true);
    P.line([86, 100, 90, 116, 92, 128], S.c2, true);
    // shawl collar: rolled lapels framing a blouse V
    var blouse = P.poly([47, 84, 62, 84, 57, 108, 53, 108]);
    P.part(blouse, S.W, S.cl);
    var lapL = P.spoly([46, 80, 40, 86, 38, 96, 44, 110, 52, 116, 54, 108, 48, 96, 49, 86]);
    var lapR = P.spoly([62, 80, 70, 84, 74, 94, 68, 108, 58, 116, 57, 108, 64, 96, 61, 86]);
    P.part(lapL, S.c1, S.cl); P.part(lapR, S.c0, S.cl);
    P.recol(lapL.band(2, 0), [S.c1], S.c2);
    // ribbon tie (terracotta) + gold brooch
    var tails = P.poly([53, 90, 57, 90, 52, 108, 47, 106]).or(P.poly([55, 90, 59, 90, 64, 106, 59, 108]));
    P.part(tails, S.a2, S.al);
    var loops = P.ell(49, 88, 5, 3.5, 0.3).or(P.ell(61, 88, 5, 3.5, -0.3));
    P.part(loops, S.a1, S.al);
    P.recol(loops.band(0, -2), [S.a1], S.a2);
    P.part(P.ell(55, 88, 2.6, 2.6), S.m1, S.ml);
    P.px(55, 87, S.m0); P.px(56, 87, S.W);

    // ---- head
    var skull = P.ell(53, 37, 27, 27);
    var farLock = P.sr([73, 30, 79, 46, 80, 62, 83 + sw * 0.5, 78, 85 + sw, 90], 10, 2, 10);
    P.part(farLock, S.h1, S.hl);
    P.recol(farLock.band(2, 0), [S.h1], S.h2);
    P.part(skull, S.h1, S.hl);
    var face = P.spoly([33, 28, 31, 40, 32, 50, 35, 57, 41, 63, 49, 68, 56, 72, 61, 73.5, 66, 71, 71, 65, 75, 58, 77, 52, 76.5, 46, 77.5, 39, 76, 30, 64, 25, 46, 25]);
    P.part(face, S.s1, S.sl);
    // neck shadow under the jaw
    P.recol(neck.and(face.shift(-1, 4)).sub(face), [S.s1], S.s2);
    // near ear (mostly hidden)
    P.part(P.ell(33, 50, 3, 5), S.s1, S.sl);

    // ---- face features
    var nearEye = lose ? EYES.nearTired : win ? EYES.nearHappy : EYES.near;
    var farEye = lose ? EYES.farTired : win ? EYES.farHappy : EYES.far;
    P.map(39, 41, nearEye, EL);
    P.map(60, 41, farEye, EL);
    // brows
    if (lose) { P.line([40, 36, 44, 35, 48, 36], S.hl); P.line([61, 36, 64, 35, 67, 36], S.hl); }
    else { P.line([41, 37, 44, 36, 49, 36], S.hl); P.line([61, 36, 65, 36, 67, 37], S.hl); }
    // nose + mouth
    P.px(71, 55, S.sl); P.px(71, 56, S.s2);
    P.map(59, 62, win ? MOUTHS.open : lose ? MOUTHS.wobble : MOUTHS.smile, EL);
    // blush
    [[40, 55], [42, 55], [44, 55], [46, 55], [41, 56], [43, 56], [45, 56], [63, 55], [65, 55], [64, 56], [66, 56]].forEach(function (p) {
      if (P.get(p[0], p[1]) === S.s1) P.px(p[0], p[1], (p[0] + p[1]) & 1 ? S.bl : S.blS);
    });

    // ---- fringe (side-swept from a part on her right/near side)
    var fr = [
      P.sr([50, 12, 64, 16, 74, 26, 78, 38, 79, 48], 14, 0, 12),
      P.sr([45, 12, 56, 20, 64, 30, 68, 41], 12, 0, 13),
      P.sr([41, 12, 48, 22, 54, 32, 57, 42], 12, 0, 12),
      P.sr([37, 14, 40, 24, 44, 33, 46, 40], 11, 0, 11),
      P.sr([33, 16, 32, 26, 33, 36, 36, 44], 10, 0, 10)
    ];
    var fringe = P.mask();
    fr.forEach(function (m) { fringe = fringe.or(m); });
    // cast shadow of fringe on the face
    P.recol(fringe.shift(-1, 2).or(fringe.shift(0, 2)), [S.s1], S.s2);
    fr.forEach(function (m) { P.part(m, S.h1, S.hl); P.recol(m.band(2, -1), [S.h1], S.h2); });
    // near side lock (in front of the ear, over the capelet)
    var nearLock = P.sr([35, 28, 29, 44, 28, 60, 30, 76, 27 + sw, 92, 30 + sw, 106], 11, 1, 12);
    P.part(nearLock, S.h1, S.hl);
    P.recol(nearLock.band(3, 0), [S.h1], S.h2);
    P.line([31, 40, 30, 60, 31, 80], S.h2, true, true);
    tipMap(P, nearLock, function (x, y) { return y - 92; });
    // skull shading + highlight ring
    P.recol(skull.band(5, -4), [S.h1], S.h2);
    var ring = P.ell(55, 34, 25, 22).sub(P.ell(56, 37, 25, 22)).and(skull);
    P.recol(ring, [S.h1], S.h0);
    P.line([44, 18, 50, 16], S.h0, false, true);
    // ahoge
    var aho = lose ? P.sr([52, 12, 50, 6, 46, 4, 42, 7], 3, 1) : P.sr([52, 12, 53, 5, 58, 1, 64, 2, 66, 6], 3, 1);
    P.part(aho, S.h1, S.hl);
    // starburst hair clip on the near side of the head
    var clip = starburst(P, 31, 24, 7, -0.25);
    P.part(clip, S.a1, S.al);
    P.recol(clip.band(-1, -1), [S.a1], S.a0);
    P.px(31, 24, S.W); P.px(32, 24, S.a0); P.px(31, 23, S.a0);

    // ---- the pen「宪章」held up beside her
    if (!o.noPen) drawPen(P, o);

    // ---- outline pass (dark coloured silhouette)
    P.outer(S.ol);

    // ---- expression accents (after outline, on top)
    if (win) { sparkle(P, 84, 24, true); sparkle(P, 20, 18, false); sparkle(P, 76, 8, false); }
    if (lose) {
      // sweat drop + "battery empty" usage-limit glyph
      P.map(76, 28, ['.r.', 'rRr', 'rRR', '.R.'], EL);
    }
  }

  function drawPen(P, o) {
    var bx0 = 88, by0 = 132, bx1 = 99, by1 = 18;     // barrel axis
    var barrel = P.poly([bx0 - 4.5, by0, bx0 + 4.5, by0, bx1 + 4, by1, bx1 - 4, by1]);
    P.part(barrel, S.d1, S.dl);
    P.recol(barrel.band(-2, 0), [S.d1], S.d0);
    P.recol(barrel.band(3, 0), [S.d1], S.d2);
    // gold bands
    [[30, 3], [36, 1]].forEach(function (b) {
      var t = (b[0] - by1) / (by0 - by1), cx = bx1 + (bx0 - bx1) * t, cy = b[0];
      var band = P.poly([cx - 5.5, cy, cx + 5.5, cy - 1, cx + 5.5, cy - 1 + b[1], cx - 5.5, cy + b[1]]);
      P.part(band, S.m1, S.ml); P.recol(band.band(-2, 0), [S.m1], S.m0);
    });
    // section + nib
    var sec = P.poly([bx1 - 4, by1, bx1 + 4, by1, bx1 + 3.6, by1 - 4, bx1 - 3, by1 - 4]);
    P.part(sec, S.d2, S.dl);
    var nib = P.spoly([bx1 - 3, by1 - 4, bx1 - 3, by1 - 9, bx1 + 0.5, by1 - 16, bx1 + 2.5, by1 - 14, bx1 + 3.6, by1 - 9, bx1 + 3.6, by1 - 4]);
    P.part(nib, S.m1, S.ml);
    P.recol(nib.band(-2, 0), [S.m1], S.m0);
    P.line([bx1 + 0.5, by1 - 5, bx1 + 1, by1 - 13], S.m3);
    P.px(Math.round(bx1 + 0.5), by1 - 7, S.ml);
    // hand gripping the barrel (her far hand) + terracotta cuff
    var cuff = P.spoly([80, 118, 84, 112, 96, 112, 99, 118, 94, 124, 82, 124]);
    P.part(cuff, S.a2, S.al);
    P.recol(cuff.band(0, 2), [S.a2], S.a1);
    var hand = P.spoly([82, 112, 82, 104, 86, 98, 92, 97, 97, 100, 98, 106, 96, 112]);
    P.part(hand, S.s1, S.sl);
    P.recol(hand.band(2, -2), [S.s1], S.s2);
    P.line([86, 103, 96, 102], S.sl); P.line([86, 107, 96, 106], S.sl);
    P.px(97, 100, S.s0);
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
})();
