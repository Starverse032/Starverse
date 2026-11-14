/* LATENT CLASH — ILLUST: Claude 娘 portraits, V2 design (ZipZipPipe's 橙发优等生).
 * bust / bustWin / bustLose / face here; cut-in in cutin.js (native close-up).
 * Drawn in palette slots (see core.js) so palette 0/1 recolour exactly.
 * Three-quarter view facing right. Light: upper-front (upper right). */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit, S = K.S;
  I.ART = I.ART || {};

  // ---------------------------------------------------------------- hand-typed face maps
  // K lash · k dark iris rim · D/s/B/H iris deep→light · P pupil · W catch-light · w eye white
  var EL = { K: S.lash, k: S.eK, D: S.e3, s: S.e2, B: S.e1, H: S.e0, w: S.ew, W: S.W, P: S.lash, x: S.s2, l: S.sl, y: S.s3,
    b: S.bl, c: S.blS, m: S.mo, t: S.tg, n: S.sl, r: S.tear, R: S.tear2, h: S.hl, o: S.ol };
  var EYES = {
    // near eye: outer corner left; level, slightly narrow, heavy upper lash
    near: [
      '...KKKKKKK..',
      '.KKKKKKKKKKK',
      'KK.kDDDDDkKw',
      '..wDDssWWDkw',
      '..wDsPPWWsDw',
      '..wssPPPssDw',
      '..wsBPPPBssw',
      '..wBBBBBBHBw',
      '...wHHBBHHw.',
      '....llllll..'
    ],
    far: [
      '..KKKKKK.',
      'KKKKKKKKK',
      'wkDDDDkK.',
      'wDsWWDDK.',
      'wsPWWsDw.',
      'wsPPPsDw.',
      'wBPPBBsw.',
      'wBBBHBBw.',
      '.wHHBBw..',
      '..llll...'
    ],
    // win: serene closed eyes (lid arcs with a lash flick)
    nearWin: [
      '............',
      '............',
      '............',
      '............',
      '............',
      'KK..........',
      '.KKK.....KK.',
      '...KKKKKKK..',
      '.....yyy....',
      '............'
    ],
    farWin: [
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.KK....KK',
      '..KKKKKK.',
      '...yyy...',
      '.........'
    ],
    // lose: exhausted, heavy half lids, glassy, bags under the eyes
    nearLose: [
      '............',
      '............',
      '............',
      '..yyyyyyyy..',
      '.KKKKKKKKKKK',
      'KKKkDDDDDkKK',
      '..wDsPPWsDsw',
      '..wsBPPBBssw',
      '..wBBHHBBBHw',
      '...ylllllly.',
      '....xxxxx...'
    ],
    farLose: [
      '.........',
      '.........',
      '.........',
      '.yyyyyy..',
      'KKKKKKKKK',
      'KkDDDDkK.',
      'wsPWsDsw.',
      'wBPPBBsw.',
      'wBHHBBHw.',
      '.yllllly.',
      '..xxxx...'
    ]
  };
  var MOUTHS = {
    calm: ['nmmmn', '.xxx.'],
    smile: ['n...n', '.nmn.'],
    tired: ['.nnn.', 'n.t.n', '.nnn.']
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
  // sunburst flower: a ring of n thin petals around a round core. Returns {petals, core}
  function sunflower(P, cx, cy, r, n, rot, sq) {
    var pts = [], k = sq || 1;
    for (var i = 0; i < n * 2; i++) {
      var a = rot + i * Math.PI / n, rr = i % 2 === 0 ? r * (i % 4 === 0 ? 1 : 0.84) : r * 0.56;
      if (i % 2 === 0) {   // blunt petal tip: two points
        var da = Math.PI / n * 0.22;
        pts.push(cx + Math.cos(a - da) * rr, cy + Math.sin(a - da) * rr * k, cx + Math.cos(a + da) * rr, cy + Math.sin(a + da) * rr * k);
      } else pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * k);
    }
    return { petals: P.poly(pts), core: P.ell(cx, cy, r * 0.4, r * 0.4 * k) };
  }
  // paint a sunburst flower in accent slots (lit from the upper right); outline only on the outside
  function paintFlower(P, cx, cy, r, n, rot, sq) {
    var f = sunflower(P, cx, cy, r, n, rot, sq), all = f.petals.or(f.core);
    P.fill(f.petals, S.a1);
    P.recol(f.petals.band(-1, 1), [S.a1], S.a0);
    P.recol(f.petals.band(1, -1), [S.a1], S.a2);
    P.fill(all.edge(), S.al);
    P.fill(f.core, S.a3);
    if (r > 5) {
      P.fill(K.inner(f.core), S.a2);
      if (r > 11) P.fill(P.ell(cx, cy, r * 0.22, r * 0.22 * (sq || 1)), S.a3);
      P.px(Math.round(cx + 1), Math.round(cy - 1), S.a0); P.px(Math.round(cx), Math.round(cy), S.a1);
    }
    else P.px(Math.round(cx), Math.round(cy - 0.5), S.a0);
    return all;
  }
  I.sunflower = sunflower; I.paintFlower = paintFlower;
  function sparkle(P, x, y, big) {   // 4-point twinkle in light slots
    P.px(x, y, S.W);
    P.px(x - 1, y, S.sp); P.px(x + 1, y, S.sp); P.px(x, y - 1, S.sp); P.px(x, y + 1, S.sp);
    if (big) { P.px(x - 2, y, S.a1); P.px(x + 2, y, S.a1); P.px(x, y - 2, S.a1); P.px(x, y + 2, S.a1); P.px(x, y - 3, S.a2); P.px(x, y + 3, S.a2); }
  }
  I.sparkle = sparkle;

  // head geometry shared by bust and cut-in (bust pixel coordinates)
  var FR = [
    [[46, 11, 60, 14, 71, 22, 77, 33, 79, 45], 14, 0, 13],
    [[46, 12, 57, 19, 64, 28, 67, 36, 68, 41], 13, 0, 12],
    [[45, 13, 51, 23, 56, 34, 58, 44, 57, 53], 10, 0, 9],
    [[45, 13, 47, 23, 50, 32, 51, 40], 8, 0, 8],
    [[44, 12, 38, 18, 35, 27, 34, 38], 11, 0, 10],
    [[44, 13, 41, 23, 41, 32, 42, 39], 7, 0, 7]
  ];
  var FACEPTS = [36, 27, 33, 37, 33, 47, 35, 55, 40, 62, 46, 67, 52, 72, 57, 75, 61, 75.5, 64.5, 73.5, 69, 68, 73, 62, 76, 55, 77.5, 49, 77, 43, 77.5, 36, 76, 29, 64, 25, 46, 25];

  // a hair clump: tapered ribbon with lit/shaded edges, optional mid highlight streak and tip colour
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
  // straight-hair texture: thin dark strand lines inside an existing hair region
  function strands(P, lines, slot) {
    lines.forEach(function (l) { P.line(l, slot || S.h2, true, true); });
  }

  // ---------------------------------------------------------------- bust
  function drawBust(P, o) {
    var expr = o.expr || 'n', sw = o.sway || 0;
    var lose = expr === 'lose', win = expr === 'win';

    // ---- back hair: straight curtain behind the shoulders, falling out of frame
    var back = P.spoly([52, 14, 36, 17, 27, 28, 23, 44, 19, 62, 14, 82, 10 + sw, 104, 8 + sw * 2, 132, 101 + sw * 2, 132, 98 + sw, 104, 94, 82, 90, 62, 86, 42, 80, 25, 70, 15]);
    P.part(back, S.h2, S.hl);
    P.recol(back.band(4, 0), [S.h2], S.h3);
    // clumps inside the curtain: lit streaks + dark partings
    [[[30, 40, 25, 66, 20 + sw, 96, 18 + sw * 2, 130], 5, 3], [[84, 40, 88, 64, 92 + sw, 96, 94 + sw * 2, 130], 5, 3],
      [[24, 52, 18, 80, 14 + sw, 110, 13 + sw * 2, 130], 3, 2], [[90, 56, 94, 84, 96 + sw, 112], 3, 2]].forEach(function (l) {
      P.recol(P.sr(l[0], l[1], l[2]), [S.h2, S.h3], S.h1);
    });
    strands(P, [[26, 44, 21, 72, 17 + sw, 100, 15 + sw * 2, 130], [33, 60, 29, 90, 27 + sw * 2, 130],
      [80, 44, 85, 70, 88 + sw, 100, 90 + sw * 2, 130], [92, 70, 95, 96, 98 + sw * 2, 130]], S.h3);
    // loose flowing strands at the edges
    P.line([14, 84, 8, 98, 5 + sw, 112, 3 + sw * 2, 126], S.h2, true);
    P.line([96, 86, 102, 100, 104 + sw, 116, 106 + sw * 2, 128], S.h2, true);

    // ---- body
    var neck = P.poly([50, 60, 62, 60, 63, 82, 50, 82]);
    P.part(neck, S.s1, S.sl);
    // blouse torso under the capelet
    var torso = P.poly([36, 92, 78, 92, 82, 128, 32, 128]);
    P.part(torso, S.c1, S.cl);
    P.recol(torso.band(6, 0), [S.c1], S.c2);
    // puffed sleeves below the capelet
    var slvN = P.spoly([4, 106, 18, 104, 30, 112, 34, 128, 1, 128]);
    P.part(slvN, S.c1, S.cl); P.recol(slvN.band(5, -2), [S.c1], S.c2); P.recol(slvN.band(-2, 2), [S.c1], S.c0);
    P.line([12, 114, 16, 128], S.c2, true); P.line([22, 114, 26, 128], S.c2, true);
    var slvF = P.spoly([92, 100, 104, 104, 110, 116, 110, 128, 88, 128]);
    P.part(slvF, S.c1, S.cl); P.recol(slvF.band(4, -1), [S.c1], S.c2); P.recol(slvF.band(-2, 2), [S.c1], S.c0);
    // capelet (two halves meeting at the collar, open over the jabot), gold edging, sunburst emblem
    var capeN = P.spoly([50, 78, 38, 81, 25, 87, 14, 95, 7, 104, 4, 112, 14, 116, 28, 117, 40, 114, 45, 106, 49, 96, 53, 86]);
    var capeF = P.spoly([60, 78, 72, 80, 85, 86, 96, 94, 103, 102, 106, 109, 96, 112, 84, 111, 74, 107, 68, 100, 63, 90]);
    [capeN, capeF].forEach(function (cp, i) {
      P.part(cp, S.c0, S.cl);
      P.recol(cp.band(i ? 3 : 6, -2), [S.c0], S.c1);
      P.recol(cp.band(i ? 1 : 2, -1), [S.c1], S.c2);
      // gold edging: hem + front edge
      var front = (i ? cp.band(2, 0) : cp.band(-2, 0)).and(P.rect(i ? 60 : 36, 84, 16, 34));
      P.recol(cp.band(0, -2).or(front), [S.c1, S.c0, S.c2], S.m1);
      P.recol(cp.band(0, -1).or(i ? cp.band(1, 0) : cp.band(-1, 0)).and(cp.band(0, -2).or(front)), [S.m1], S.m2);
    });
    // fold shadows on the capelet
    P.line([30, 92, 24, 104, 22, 114], S.c2, true, true);
    P.line([40, 88, 38, 100, 36, 112], S.c2, true, true);
    P.line([80, 90, 84, 100, 86, 110], S.c2, true, true);
    paintFlower(P, 17, 103, 6.5, 9, 0.2, 0.8);
    // high collar with frilled edge
    // shadow cast by the capelet hem onto the sleeves / blouse
    P.recol(capeN.or(capeF).shift(1, 3).sub(capeN).sub(capeF), [S.c1, S.c0], S.c2);
    // high collar with a small frill on top
    var collar = P.spoly([49, 75, 57, 77, 64, 75, 65, 82, 63, 87, 56, 89, 49, 87, 47, 81]);
    P.part(collar, S.c1, S.cl);
    P.recol(collar.band(3, 0), [S.c1], S.c2);
    P.recol(collar.band(-1, 2), [S.c1], S.c0);
    for (var fx = 48; fx <= 64; fx += 2) { var fy = 75 + ((fx - 56) * (fx - 56) / 40 | 0); P.px(fx, fy - 1, (fx & 2) ? S.W : S.c0); P.px(fx + 1, fy - 1, S.cl); }
    // jabot: three tiers of cream ruffles with wavy hems and fold lines
    [[57, 92, 5, 7], [57, 99, 7, 8], [57, 107, 9, 9], [58, 116, 10, 10]].forEach(function (r) {
      var x = r[0], y = r[1], w = r[2], h = r[3], pts = [x - w * 0.6, y, x + w * 0.6, y];
      for (var k = 0; k <= 6; k++) { var px = x + w - k * (2 * w) / 6; pts.push(px, y + h - (k & 1 ? 2 : 0)); }
      var t = P.poly(pts);
      P.part(t, S.c0, S.cl);
      P.recol(t.band(3, 0), [S.c0], S.c2);
      P.recol(t.band(0, -2), [S.c0], S.c1);
      for (var k2 = 1; k2 < 6; k2 += 2) P.line([x + w - k2 * (2 * w) / 6, y + h - 4, x + w - k2 * (2 * w) / 6, y + h - 2], S.c2, false, true);
    });
    // black cravat: knot + two flared tails, sunburst brooch
    var tl = P.spoly([55, 87, 51, 94, 47, 103, 50, 104, 54, 98, 57, 90]), tr = P.spoly([58, 87, 63, 94, 68, 101, 65, 103, 60, 97, 57, 90]);
    [tl, tr].forEach(function (t, i) {
      P.part(t, S.d1, S.dl);
      P.recol(t.band(i ? 2 : -1, 0), [S.d1], i ? S.d2 : S.d0);
    });
    var knot = P.spoly([52, 84, 57, 83, 62, 84, 61, 89, 57, 91, 53, 89]);
    P.part(knot, S.d1, S.dl); P.recol(knot.band(-1, 1), [S.d1], S.d0); P.recol(knot.band(2, -1), [S.d1], S.d2);
    paintFlower(P, 57, 87, 3.8, 8, 0.4);

    // ---- head
    var skull = P.ell(53, 36, 25, 26).or(P.ell(47, 42, 21, 23));
    P.part(skull, S.h1, S.hl);
    var face = P.spoly(FACEPTS);
    P.part(face, S.s1, S.sl);
    P.recol(neck.and(face.shift(-1, 5)).sub(face), [S.s1], S.s2);
    P.recol(face.band(2, 0).and(P.rect(0, 30, 44, 40)), [S.s1], S.s2);
    P.recol(face.band(2, -2).and(P.rect(36, 60, 30, 20)), [S.s1, S.s2], S.s2);

    // ---- face features
    P.map(40, 42, lose ? EYES.nearLose : win ? EYES.nearWin : EYES.near, EL);
    P.map(62, 42, lose ? EYES.farLose : win ? EYES.farWin : EYES.far, EL);
    P.px(71, 56, S.s2); P.px(71, 57, S.sl);                     // nose
    if (win) P.map(59, 63, MOUTHS.smile, EL);
    else if (lose) P.map(59, 63, MOUTHS.tired, EL);
    else P.map(59, 63, MOUTHS.calm, EL);
    [[42, 55], [44, 55], [46, 55], [43, 56], [45, 56], [66, 55], [68, 55], [67, 56]].forEach(function (p) {
      if (P.get(p[0], p[1]) === S.s1) P.px(p[0], p[1], win || lose ? S.bl : S.blS);
    });

    // ---- fringe: parted (part at x≈45), long strands; cast shadow first
    var fringe = P.mask();
    FR.forEach(function (c) { fringe = fringe.or(P.sr(c[0], c[1], c[2], c[3])); });
    P.recol(fringe.shift(-1, 2).or(fringe.shift(0, 2)), [S.s1], S.s2);
    FR.forEach(function (c) { hairClump(P, c, S.h1); });
    strands(P, [[54, 16, 62, 26, 66, 36], [50, 18, 54, 28, 56, 38]]);
    // skull shading + broken highlight ring
    P.recol(skull.band(5, -4), [S.h1], S.h2);
    var ring = P.ell(55, 33, 24, 20).sub(P.ell(56, 36, 24, 20)).and(skull);
    for (var gx = 0; gx < 112; gx += 7) ring = ring.sub(P.rect(gx, 0, 2, 40));
    P.recol(ring, [S.h1], S.h0);
    // brows drawn through the fringe (level, composed)
    if (!win) {
      if (lose) { P.line([42, 38, 46, 37, 50, 37], S.hl); P.line([63, 37, 66, 37, 69, 38], S.hl); }
      else if (expr === 'cut') { P.line([42, 37, 46, 38, 51, 40], S.hl); P.line([62, 40, 66, 38, 69, 37], S.hl); }
      else { P.line([42, 39, 46, 38, 51, 38], S.hl); P.line([63, 38, 66, 38, 69, 39], S.hl); }
    }
    // part line
    P.line([45, 10, 45, 14], S.h3);

    // ---- face-framing locks (in front of the capelet), long and straight
    hairClump(P, [[37, 26, 32, 38, 30, 52, 28, 68, 25 + sw, 90, 23 + sw * 2, 110, 22 + sw * 2, 132], 9, 9, 12, 0, [0.12, 0.5]], S.h1);
    hairClump(P, [[33, 62, 32, 80, 33 + sw, 100, 35 + sw * 2, 132], 5, 4, 6, 0, [0.2, 0.7]], S.h1);
    hairClump(P, [[39, 30, 36, 44, 35, 58, 36, 70], 4.5, 0, 5], S.h1);
    hairClump(P, [[75, 26, 79, 40, 80, 56, 81, 74, 83 + sw, 98, 85 + sw * 2, 132], 9, 6, 10, 0, [0.1, 0.45]], S.h1);
    strands(P, [[32, 46, 30, 70, 26, 100], [80, 50, 82, 80, 84, 110]]);

    // ---- hair ornament: black ribbon bow, cream tassel, sunburst flower (near side)
    var FX = 27, FY = 22;
    var tails = P.poly([FX - 3, FY + 2, FX - 9, FY + 18, FX - 6, FY + 16, FX - 4, FY + 20, FX + 1, FY + 4])
      .or(P.poly([FX - 1, FY + 3, FX - 2, FY + 22, FX + 1, FY + 19, FX + 4, FY + 22, FX + 2, FY + 4]));
    P.part(tails, S.d1, S.dl); P.recol(tails.band(2, 0), [S.d1], S.d2); P.recol(tails.band(-1, 0), [S.d1], S.d0);
    var loopA = P.poly([FX, FY, FX - 13, FY - 9, FX - 15, FY - 3, FX - 12, FY + 1]);
    var loopB = P.poly([FX, FY + 1, FX - 13, FY + 6, FX - 13, FY + 12, FX - 9, FY + 11]);
    [loopA, loopB].forEach(function (l, i) {
      P.part(l, S.d1, S.dl); P.recol(l.band(-1, 1), [S.d1], S.d0); P.recol(l.band(1, -2), [S.d1], S.d2);
    });
    P.line([FX - 4, FY - 1, FX - 11, FY - 4], S.d3); P.line([FX - 4, FY + 3, FX - 10, FY + 8], S.d3);
    var tas = P.sr([FX + 5, FY + 9, FX + 5.5, FY + 16, FX + 5, FY + 24], 2.4, 4.5);
    P.part(tas, S.c1, S.cl); P.recol(tas.band(2, 0), [S.c1], S.c2);
    P.line([FX + 5, FY + 17, FX + 5, FY + 23], S.c2);
    P.part(P.rect(FX + 3.5, FY + 8, 3, 4), S.m1, S.ml); P.px(FX + 5, FY + 8, S.m0);
    paintFlower(P, FX, FY, 9.5, 14, 0.1);

    if (!o.noProp) drawBook(P, o);

    P.outer(S.ol);

    // ---- expression accents
    if (win) { sparkle(P, 88, 22, true); sparkle(P, 12, 46, false); }
    if (lose) {
      P.map(77, 30, ['.r.', 'rRr', 'rRR', '.R.'], EL);
      // "usage limit": an empty battery gauge blinking over her shoulder
      P.part(P.rect(88, 8, 13, 7), S.K, S.ol); P.fill(P.rect(89, 9, 11, 5), S.ew); P.fill(P.rect(101, 10, 2, 3), S.ol);
      P.fill(P.rect(90, 10, 2, 3), S.a2);
      // stray strands
      P.line([50, 10, 47, 4, 43, 3], S.h1); P.line([51, 10, 48, 5], S.hl);
    }
  }

  function drawBook(P, o) {
    // red-brown leather book, cover toward the viewer, held up by her far hand
    var pages = P.poly([100, 72, 105, 70, 103, 109, 99, 112]);
    P.part(pages, S.c0, S.cl);
    for (var y = 76; y < 108; y += 3) P.px(102, y, S.c2);
    var cover = P.poly([76, 69, 101, 72, 99, 112, 74, 109]);
    P.part(cover, S.x1, S.xl);
    P.recol(cover.band(-2, 2), [S.x1], S.x0);
    P.recol(cover.band(3, -1), [S.x1], S.x2);
    // gold border line + corners
    P.line([79, 73, 97, 75, 95.5, 108, 77.5, 105.5, 79, 73], S.m2);
    [[76, 69, 1, 1], [101, 72, -1, 1], [99, 112, -1, -1], [74, 109, 1, -1]].forEach(function (c) {
      var t = P.poly([c[0], c[1], c[0] + 6 * c[2], c[1] + 0.6 * c[3], c[0] + 0.6 * c[2], c[1] + 6 * c[3]]);
      P.part(t, S.m1, S.ml); P.px(c[0] + c[2], c[1] + c[3], S.m0);
    });
    // a small gold sunburst on the cover
    var em = starburst(P, 88, 88, 5, -0.2);
    P.part(em, S.m1, S.m2);
    // sleeve + frilled cuff + slender hand gripping the cover's lower left
    var slv = P.poly([68, 114, 84, 112, 90, 128, 66, 128]);
    P.part(slv, S.c1, S.cl); P.recol(slv.band(4, -1), [S.c1], S.c2);
    var cuff = P.spoly([67, 108, 74, 104, 82, 106, 86, 112, 82, 116, 74, 117, 68, 115]);
    P.part(cuff, S.c0, S.cl); P.recol(cuff.band(3, -1), [S.c0], S.c2);
    P.px(71, 115, S.cl); P.px(76, 116, S.cl); P.px(81, 115, S.cl);
    var hand = P.spoly([69, 106, 70, 98, 74, 92, 80, 91, 82, 99, 79, 106, 74, 110]);
    P.part(hand, S.s1, S.sl); P.recol(hand.band(3, -1), [S.s1], S.s2); P.recol(hand.band(-1, 1), [S.s1], S.s0);
    // fingers laid over the cover's left edge (back of the fingers toward us)
    [[[77, 92.5, 82, 91.5, 87, 92.5], 3.4, 2.6], [[78, 96, 83, 95.5, 88, 96.5], 3.4, 2.6], [[78, 99.5, 83, 99.5, 87.5, 100.5], 3.2, 2.4],
      [[77, 103, 81, 103.5, 84.5, 104.5], 2.8, 2.2]].forEach(function (f) {
      var m = P.sr(f[0], f[1], f[2]);
      P.part(m, S.s1, S.sl); P.recol(m.band(0, -1), [S.s1], S.s2); P.recol(m.band(0, 1), [S.s1], S.s0);
    });
    P.px(87, 92, S.bl); P.px(88, 96, S.bl); P.px(87, 100, S.bl);
  }

  // ---------------------------------------------------------------- face icon 24x24 (hand-typed)
  var FACE = [
    '.......hhhhhhh..........',
    '.....hhHHHHHHHhh........',
    '..oo.hHHHHHHHHHHh.......',
    '.oAAohHHHHHHHHHHHh......',
    'oAaAAoHHHHhHHHHHHHh.....',
    'oAAAohHHHhHHHHHhHHHh....',
    '.oAohHHHhfHHHHhfHHHh....',
    '.ddhHHHhffhHHhfffhHHh...',
    'ddhHHHhffffhhffffhHHh...',
    '.dhHHhKKKKfffKKKfhHHh...',
    '..hHHhKDWDffKDWKfhHHh...',
    '..hHhfwsBwfffsBwfhHHh...',
    '..hHhffffffffffffhHHh...',
    '..hHhfccfffffffcfhHHh...',
    '..hHHhffffffmmffhHHHh...',
    '..hHHhhfffffffffhHHHh...',
    '..hHHHhhhfffffhhHHHHh...',
    '..hHHHhCCCffhCCChHHHh...',
    '..hHHhCCCCdrdCCCChHHh...',
    '.hHHhCCCCCJdJCCCCChHh...',
    '.hHHhCCCCCJJJCCCCCChHh..',
    '.hHhCAACCCJJJCCCCCCChHh.',
    'hHHhCAACCCJJJCCCMMMChHh.',
    'hHhMMMMMMCJJJCCCCCCCChh.'
  ];
  var FL = { h: S.hl, H: S.h1, A: S.a1, a: S.a0, o: S.al, r: S.a1, d: S.d1, f: S.s1, K: S.lash, D: S.e3, W: S.W, s: S.e2, w: S.ew, B: S.e1,
    c: S.blS, m: S.mo, C: S.c1, J: S.c0, M: S.m1 };

  I.ART.claude = {
    bust: function () { var P = K.painter(112, 128); drawBust(P, {}); return P; },
    bustWin: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'win' }); return P; },
    bustLose: function () { var P = K.painter(112, 128); drawBust(P, { expr: 'lose' }); return P; },
    titleFrame: function (o) { var P = K.painter(112, 128); drawBust(P, o); return P; },
    cutin: function () { return I.cutin ? I.cutin('claude') : K.painter(240, 72); },
    face: function () { var P = K.painter(24, 24); P.map(0, 0, FACE, FL); return P; }
  };
  I.drawClaudeBust = drawBust;
  I.ART.claude.head = { FR: FR, face: FACEPTS, skull: [[53, 36, 25, 26], [47, 42, 21, 23]] };
  I.H = { tipMap: tipMap, hairClump: hairClump, sparkle: sparkle, starburst: starburst, strands: strands, paintFlower: paintFlower };
})();
