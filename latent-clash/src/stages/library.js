/* LATENT CLASH — STAGE 1: library 星芒书阁 (Claude's home). Grand library at dusk.
 *
 * Light logic: the sun is setting behind the upper-level west windows (back wall). The hall is
 * lit contre-jour: sky glow + warm shafts through the windows, starburst lanterns as local warm
 * fill, everything else in dusky plum / teal shadow. Lane (y 100-190) = mid-dark, desaturated.
 *
 * Layers (back → front): sky 0.05 · city 0.13 · hills 0.24 · wall 0.841 (=floor far edge) ·
 * shafts 0.92 · mezzanine 0.875 · lanterns 0.97 · props (desk/globe) ~0.9 · floor (line scroll)
 * · front: motes + pages 1.0–1.15, foreground book stacks 1.3.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var YH = 76;                                           // eye level / floor vanishing line

  // ---------------------------------------------------------------- palette
  var C = {
    // sky (sunset)
    sky: ['#211a3c', '#2b2150', '#3b2a5e', '#55346a', '#77406e', '#9e5170', '#c4646c', '#de8268', '#eea36a', '#f6c47c', '#fbdf9c'],
    sun: '#fff3cc', sunRing: '#fde3a0',
    cloudDk: '#5a3466', cloudMd: '#7c4470', cloudLit: '#d97a6a', cloudHi: '#f2a676',
    city0: '#7a4874', city0w: '#e9a276', city1: '#56325e', city1w: '#f2b47a', hill: '#3e2650', hillDk: '#2f1d40',
    // wood / architecture
    w0: '#150d18', w1: '#22152a', w2: '#311d33', w3: '#45283e', w4: '#5e3646', w5: '#87504f', w6: '#c07a5e', w7: '#f0b078',
    wall: '#2a1d33', wallLt: '#35263f', wallDk: '#1f1628',
    back: '#140e1a',                                     // shelf interior
    stone: '#4a3a52', stoneLt: '#5f4c66', stoneDk: '#33283c',
    glassRim: '#f8cc8a', frame: '#1e1424', frameLt: '#6a3e48',
    curtain: ['#7a3a52', '#5c2a42', '#43203a', '#2e162a'], tassel: '#c89a50',
    gold: '#c9a050', goldDk: '#8a6a34', goldLt: '#f0d488',
    // light
    shaft: '#f3b878', shaftHi: '#ffe0a8', mote: '#ffe8b8',
    lampCore: '#fff6d8', lampHot: '#ffd98a', lampGlass: '#ffae5e', lampHalo: '#a35a50', lampHalo2: '#6e3a48',
    brass: '#b48040', brassDk: '#704a2a',
    // floor
    pl: ['#3e2430', '#46293a', '#4f2f3f', '#583546'], seam: '#22131c', gloss: '#74464c', gloss2: '#93585a',
    pool: ['#7a4848', '#9c5e52', '#c47c5e', '#e2a06c'],
    rug: '#21363c', rugDk: '#182830', rugPat: '#305058', rugPat2: '#3e6464', rugTrim: '#9a7a44', rugTrimDk: '#5e4a2e', rugRed: '#5c2a36',
    floorFar: '#2a1a26', floorNear: '#1c1018',
    // misc
    clockFace: '#e8d8b0', clockFaceDk: '#b0a078', cat: '#2a2032', catLt: '#4a3c52', catDk: '#120c18', catNose: '#c88a8a',
    page: '#efe2c4', pageDk: '#c4b08c', pageEdge: '#8a7860',
    ink: '#1a1830', tea: '#e9e0cc', teaDk: '#a89c86', steam: '#c8b0a8'
  };
  // book families: [base, shade, light]
  var BOOKS = [
    ['#3a5c5c', '#284248', '#4c7470'], ['#623a58', '#462a44', '#7a4c6a'], ['#8a6840', '#644a30', '#a4804e'],
    ['#4e5c3a', '#38422c', '#647448'], ['#8a4c56', '#62343e', '#a2626a'], ['#36405e', '#262c46', '#4a5478'],
    ['#a8967a', '#7c6c58', '#c0ae90'], ['#6e2e3e', '#4c1e2c', '#86404e'], ['#4a3a5a', '#342842', '#5e4c70']
  ];

  function build(U) {
    var c = U.col, A = {};
    var FW = U.floorScale(YH, 168);                      // wall factor = floor far edge
    A.FW = FW;
    var F_MEZ = U.floorScale(YH, 172);                   // mezzanine columns stand on row 172
    A.F_MEZ = F_MEZ;
    var rnd = U.rng(1337);

    // ------------------------------------------------------------ sky (0.05)
    var fS = 0.05, sw = U.layerW(fS), sky = U.pix(sw, 120);
    var sy = function (y) { return y + 8; };
    var stops = [[0, C.sky[0]], [sy(14), C.sky[1]], [sy(26), C.sky[2]], [sy(35), C.sky[3]], [sy(43), C.sky[4]], [sy(50), C.sky[5]],
      [sy(56), C.sky[6]], [sy(61), C.sky[7]], [sy(66), C.sky[8]], [sy(71), C.sky[9]], [sy(76), C.sky[10]]];
    sky.bands(0, 0, sw, 120, stops, 3);
    // sun, low, half sunk behind the city
    var sunX = U.wx(320, fS) - 10, sunY = sy(63);
    sky.ellipse(sunX, sunY, 12, 12, c(C.sunRing)); sky.ellipse(sunX, sunY, 9.5, 9.5, c(C.sun));
    // cloud streaks: thin strata, lit from below by the low sun
    var clouds = [[30, 32, 70], [120, 39, 90], [200, 28, 60], [60, 47, 110], [170, 53, 70], [-10, 57, 60], [230, 44, 50]];
    clouds.forEach(function (k, i) {
      var x = k[0], y = sy(k[1]), w = k[2];
      for (var r = 0; r < 3; r++) {
        var inset = [6, 0, 3][r] + (i % 2) * 2, col = [C.cloudDk, C.cloudMd, (k[1] > 45 ? C.cloudHi : C.cloudLit)][r];
        sky.rect(x + inset, y + r, w - inset * 2 - r * 3, 1, c(col));
      }
      sky.rect(x + w * 0.3, y - 1, w * 0.3, 1, c(C.cloudDk));
    });
    A.sky = sky.toCanvas(); A.fS = fS;

    // ------------------------------------------------------------ distant city (0.13) + hills (0.24)
    var fC = 0.13, cw = U.layerW(fC), city = U.pix(cw, 110);
    var x = 0;
    while (x < cw) {
      var bw = 6 + Math.floor(rnd() * 12), bh = 14 + Math.floor(rnd() * 16);
      var top = sy(92) - bh;
      city.rect(x, top, bw, 120, c(C.city0));
      if (rnd() < 0.3) city.rect(x + (bw >> 1) - 1, top - 4, 2, 4, c(C.city0));          // chimney / spire stub
      for (var wy = top + 2; wy < sy(90); wy += 3) for (var wx2 = x + 1; wx2 < x + bw - 1; wx2 += 2) {
        if (U.hash(wx2 * 7, wy * 13) < 0.16) city.set(wx2, wy, c(C.city0w));
      }
      x += bw + (rnd() < 0.2 ? 2 : 0);
    }
    // landmarks: clock tower + dome (warm windows) at fixed spots
    var lt = U.wx(250, fC);
    city.rect(lt, sy(46), 7, 60, c(C.city0)); city.poly([lt - 1, sy(46), lt + 8, sy(46), lt + 3.5, sy(34)], c(C.city0));
    city.rect(lt + 2, sy(52), 3, 3, c(C.city0w));
    var dm = U.wx(420, fC);
    city.ellipse(dm, sy(60), 11, 9, c(C.city0)); city.rect(dm - 13, sy(60), 26, 40, c(C.city0)); city.rect(dm, sy(48), 1, 4, c(C.city0));
    A.city = city.toCanvas(); A.fC = fC; A.towerX = lt + 3; A.towerY = sy(33);

    var fHl = 0.24, hw = U.layerW(fHl), hills = U.pix(hw, 110);
    for (var i = 0; i < hw; i++) {
      var h = 76 + Math.sin(i / 37) * 3 + Math.sin(i / 13 + 1) * 2;
      // tree clumps
      var tr = U.hash(Math.floor(i / 5), 3) < 0.45 ? 3 + ((U.hash(Math.floor(i / 5), 9) * 4) | 0) : 0;
      var trc = tr ? Math.round(tr * Math.sqrt(Math.max(0, 1 - Math.pow(((i % 5) - 2) / 3, 2)))) : 0;
      hills.rect(i, sy(Math.round(h - trc)), 1, 120, c(C.hill));
      if (trc > 1 && (i % 5) === 1) hills.set(i, sy(Math.round(h - trc)), c(C.city0));
    }
    hills.dither(0, sy(80), hw, 4, c(C.hillDk), 8);
    hills.rect(0, sy(82), hw, 40, c(C.hillDk));
    A.hills = hills.toCanvas(); A.fHl = fHl;

    // ------------------------------------------------------------ wall (FW): upper windows, shelves, lower shelves
    var ww = U.layerW(FW), wall = U.pix(ww, 176);
    var R = function (x, y, w, h, col) { wall.rect(x, y + 8, w, h, c(col)); };
    // base wall
    wall.rect(0, 0, ww, 176, c(C.wall));
    // ceiling band (calm, dark): coffers + beams
    R(0, -8, ww, 30, C.w0);
    for (var bx = 4; bx < ww; bx += 28) { R(bx, -8, 20, 22, C.w1); R(bx + 1, -8, 18, 21, '#1b1120'); R(bx, 13, 20, 1, C.w2); }
    R(0, 22, ww, 2, C.w3); R(0, 24, ww, 1, C.w5); R(0, 25, ww, 2, C.w2); R(0, 27, ww, 1, C.w0);
    for (bx = 0; bx < ww; bx += 4) R(bx, 28, 2, 2, C.w2);        // dentils
    R(0, 30, ww, 1, C.w0);

    var winX = [120, 320, 520].map(function (X) { return U.wx(X, FW); });
    var winW = [56, 78, 56];
    A.winX = winX; A.winW = winW;

    // upper level: shelves everywhere first, windows cut in after
    var upperTop = 31, upperBot = 92;
    shelfRun(U, wall, 0, upperTop, ww, upperBot - upperTop, 4, 11, true);
    // lower level
    var lowerTop = 100, lowerBot = 168;
    wall.rect(0, lowerTop + 8, ww, lowerBot - lowerTop, c(C.wallDk));
    shelfRun(U, wall, 0, lowerTop + 2, ww, 62, 4, 77, false);
    // baseboard
    R(0, 164, ww, 1, C.w4); R(0, 165, ww, 3, C.w2); R(0, 167, ww, 1, C.w0);

    // windows (cut transparent glass, frame with warm inner rim)
    for (i = 0; i < 3; i++) window_(U, wall, winX[i], winW[i], 27, 91, i === 1);
    // light map. Upper level: contre-jour shadow, warm pools around each lantern.
    var lampWX = [30, 215, 425, 610].map(function (X) { return U.wx(X, FW); });
    var lampD = function (x, y) {
      var m = 99;
      for (var q = 0; q < 4; q++) { var dx = x - lampWX[q], dy = (y - 8 - 58) * 1.3; m = Math.min(m, Math.sqrt(dx * dx + dy * dy)); }
      return m;
    };
    wall.tint(0, 31 + 8, ww, 61, '#120a1a', function (x, y) { return 0.42 * Math.min(1, lampD(x, y) / 40); }, 8);
    wall.tint(0, 31 + 8, ww, 61, '#f0a070', function (x, y) { var d = lampD(x, y); return d < 26 ? 0.22 * (1 - d / 26) + 0.04 : 0; }, 8);
    // lower level: under-balcony shadow at the top, general dusk dimming, desaturated
    wall.tint(0, 100 + 8, ww, 68, '#1a1222', function (x, y) { var sy2 = y - 8; return 0.3 + (sy2 < 116 ? (116 - sy2) / 16 * 0.3 : 0) + (sy2 > 156 ? 0.1 : 0); }, 8);

    // lower level centre: arched doorway into a dim reading room
    var dx = U.wx(320, FW);
    doorway(U, wall, dx, 104, 34, 64);
    // pendulum clock (case) between shelves at world 452
    var clx = U.wx(452, FW);
    A.clock = { x: clx, y: 112 };
    clockCase(U, wall, clx, 106);
    // ladders on the lower shelves and upper shelves
    ladder(U, wall, U.wx(150, FW), 104, 166, 9);
    ladder(U, wall, U.wx(560, FW), 104, 166, -9);
    ladder(U, wall, U.wx(28, FW), 36, 92, 6);
    A.wall = wall.toCanvas(); A.lampWX = lampWX;

    // curtains (animated: 6 breath frames), drawn on the wall layer at each window
    A.curtains = U.frames(6, 18, 64, function (p, f) { curtain(U, p, f); });

    // ------------------------------------------------------------ mezzanine (F_MEZ): slab, railing, columns
    var mw = U.layerW(F_MEZ), mez = U.pix(mw, 176);
    var M = function (x, y, w, h, col) { mez.rect(x, y + 8, w, h, c(col)); };
    // railing: top rail, balusters, bottom rail
    M(0, 75, mw, 1, C.w5); M(0, 76, mw, 2, C.w3); M(0, 78, mw, 1, C.w1);
    for (bx = 1; bx < mw; bx += 5) {
      M(bx, 79, 2, 11, C.w2); M(bx, 79, 1, 11, C.w4); M(bx, 82, 2, 1, C.w1); M(bx - 0, 86, 2, 1, C.w4);
    }
    M(0, 90, mw, 2, C.w3);
    // slab: moulded beam with dentils + shadow under it
    M(0, 92, mw, 1, C.w6); M(0, 93, mw, 1, C.w4); M(0, 94, mw, 3, C.w3); M(0, 97, mw, 1, C.w2);
    for (bx = 0; bx < mw; bx += 6) { M(bx, 98, 3, 2, C.w3); M(bx, 99, 3, 1, C.w2); }
    M(0, 100, mw, 1, C.w1);
    mez.dither(0, 101 + 8, mw, 2, c(C.w0), 8);
    // columns (stand on floor row ~172)
    A.colX = [];
    [20, 220, 420, 620].forEach(function (X) {
      var cx = U.wx(X, F_MEZ);
      A.colX.push(cx);
      column(U, mez, cx, 101, 172);
    });
    A.mez = mez.toCanvas();

    // ------------------------------------------------------------ lanterns (sprite + halo frames)
    A.lantern = lanternSprite(U);
    A.halo = U.frames(4, 48, 48, function (p, f) {
      var r1 = 15 + f, r2 = 10 + f;
      p.fn(0, 0, 48, 48, function (x, y) {
        var d = Math.sqrt((x - 23.5) * (x - 23.5) + (y - 23.5) * (y - 23.5));
        if (d < r2) return U.dith(x, y, 5) ? c(C.lampHalo) : 0;
        if (d < r1) return U.dith(x, y, 2) ? c(C.lampHalo2) : 0;
        return 0;
      });
    });

    // ------------------------------------------------------------ light shafts (0.92)
    var fSh = 0.92, shw = U.layerW(fSh), sh = U.pix(shw, 200);
    var beamCol = [0, c('#160b06'), c('#28160b'), c('#3c2210')];
    A.beam = [];
    winX.forEach(function (lx, i) {
      var X = [120, 320, 520][i], cx0 = U.wx(X, fSh), half = winW[i] / 2 - 3;
      A.beam.push({ X: X, half: half });
      for (var y = 34; y < 168; y++) {
        var k = (y - 34) / 134;
        var xa = Math.round(cx0 - half + k * 40), xb = Math.round(cx0 + half + k * 72), xm = Math.round(cx0 + k * 56);
        var L = y < 84 ? 3 : y < 112 ? 2 : y < 146 ? 1 : 0;
        var nextY = y < 84 ? 84 : y < 112 ? 112 : 146, dd = nextY - y;
        for (var xx = xa; xx < xb; xx++) {
          var l = L;
          if (dd <= 5 && U.dith(xx, y, Math.round((6 - dd) / 6 * 16))) l--;
          if (xx - xa < 3 || xb - xx <= 3) l--;
          if (Math.abs(xx - xm) <= 1) l -= 2;                    // mullion shadow
          if (l > 0) sh.set(xx, y + 8, beamCol[l]);
        }
      }
    });
    A.shafts = sh.toCanvas(); A.fSh = fSh;

    // ------------------------------------------------------------ props on the floor
    A.desk = deskSprite(U); A.globe = globeSprite(U);
    A.fDesk = U.floorScale(YH, 176); A.fGlobe = U.floorScale(YH, 174);
    A.cat = catFrames(U);
    A.page = U.frames(4, 6, 5, function (p, f) {
      var s = [[0, 1, 5, 3], [1, 0, 3, 5], [0, 1, 5, 3], [1, 1, 4, 3]][f];
      p.rect(s[0], s[1], s[2], s[3], c(C.page));
      p.rect(s[0], s[1] + s[3] - 1, s[2], 1, c(C.pageDk));
      if (f === 1) p.rect(s[0] + s[2] - 1, s[1], 1, s[3], c(C.pageDk));
    });
    A.book = U.frames(4, 7, 7, function (p, f) {
      var col = BOOKS[f * 2 % BOOKS.length];
      if (f % 2 === 0) { p.rect(2, 0, 3, 7, c(col[0])); p.rect(4, 0, 1, 7, c(col[1])); p.rect(2, 1, 3, 1, c(C.gold)); }
      else { p.rect(0, 2, 7, 3, c(col[0])); p.rect(0, 4, 7, 1, c(col[1])); p.rect(1, 2, 1, 3, c(C.page)); }
    });

    // ------------------------------------------------------------ floor (line scroll)
    A.floor = U.buildFloor(168, 224, YH, floorTexel(U));
    return A;
  }

  // ================================================================== painters
  // A run of bookshelf units across [x0, x0+w), from y (screen) height h, `rows` shelf rows.
  function shelfRun(U, P, x0, y, w, h, rows, seed, upper) {
    var c = U.col, rnd = U.rng(seed);
    var x = x0 - 6;
    while (x < x0 + w) {
      var uw = 40 + Math.floor(rnd() * 3) * 6;
      shelfUnit(U, P, x, y, uw, h, rows, rnd, upper);
      x += uw;
      // pilaster between units
      P.rect(x, y + 8 - 2, 5, h + 2, c(C.w2)); P.rect(x, y + 8 - 2, 1, h + 2, c(C.w4)); P.rect(x + 4, y + 8 - 2, 1, h + 2, c(C.w1));
      x += 5;
    }
  }
  function shelfUnit(U, P, x, y, w, h, rows, rnd, upper) {
    var c = U.col, Y = y + 8;
    P.rect(x, Y, w, h, c(C.w2));                                  // carcass
    P.rect(x, Y, w, 3, c(C.w3)); P.rect(x, Y, w, 1, c(C.w5)); P.rect(x, Y + 3, w, 1, c(C.w1));   // cornice
    var ix = x + 2, iw = w - 4, iy = Y + 4, ih = h - 7;
    P.rect(ix, iy, iw, ih, c(C.back));
    P.rect(x, Y, 1, h, c(C.w4)); P.rect(x + w - 1, Y, 1, h, c(C.w1));
    P.rect(x, Y + h - 3, w, 3, c(C.w3)); P.rect(x, Y + h - 3, w, 1, c(C.w4));                 // plinth
    var rh = Math.floor(ih / rows);
    for (var r = 0; r < rows; r++) {
      var ry = iy + r * rh, by = ry + rh - 2;                     // board at by..by+1
      books(U, P, ix, ry + 1, iw, rh - 3, rnd, upper);
      // shadow under the board above (top two rows of the cell)
      P.ditherOn(ix, ry, iw, 2, c(C.w0), 10);
      P.rect(ix, ry, iw, 1, c(C.w0));
      // board: below eye level we see its top face (lit), above it its underside (dark)
      var eye = (by - 8) > YH;
      P.rect(ix - 1, by, iw + 2, 2, c(C.w3));
      P.rect(ix - 1, eye ? by : by + 1, iw + 2, 1, c(eye ? C.w5 : C.w1));
    }
  }
  function books(U, P, x0, y0, w, h, rnd, upper) {
    var c = U.col, x = x0, end = x0 + w;
    while (x < end) {
      var roll = rnd();
      if (roll < 0.07 && end - x > 8) {                           // gap with a leaning book
        var col = BOOKS[(rnd() * BOOKS.length) | 0];
        var bh = h - 2, lean = 3;
        for (var j = 0; j < bh; j++) {
          var off = Math.round((bh - j) / bh * lean);
          P.rect(x + off, y0 + h - bh + j, 3, 1, c(col[0])); P.set(x + off + 2, y0 + h - bh + j, c(col[1]));
        }
        x += 7; continue;
      }
      if (roll < 0.13 && end - x > 9) {                           // flat stack
        var sw = 7 + ((rnd() * 3) | 0), n = 2 + ((rnd() * 3) | 0), yy = y0 + h;
        for (var k = 0; k < n; k++) {
          var cl = BOOKS[(rnd() * BOOKS.length) | 0], bw = sw - ((rnd() * 2) | 0);
          yy -= 2; P.rect(x, yy, bw, 2, c(cl[0])); P.rect(x, yy + 1, bw, 1, c(cl[1])); P.set(x, yy, c(cl[2]));
        }
        x += sw + 1; continue;
      }
      if (roll < 0.16 && end - x > 7) {                           // ornament: small starburst / hourglass / jar
        var t = (rnd() * 3) | 0, ox = x + 3, oy = y0 + h;
        if (t === 0) { P.rect(ox - 1, oy - 7, 3, 7, c(C.brassDk)); P.rect(ox, oy - 6, 1, 5, c(C.lampGlass)); P.rect(ox - 2, oy - 8, 5, 1, c(C.brass)); P.rect(ox - 2, oy - 1, 5, 1, c(C.brass)); }
        else if (t === 1) { P.ellipse(ox + 0.5, oy - 3, 3, 3, c(C.stone)); P.rect(ox - 1, oy - 6, 3, 1, c(C.stoneLt)); P.rect(ox - 2, oy - 3, 1, 2, c(C.stoneLt)); }
        else { P.rect(ox - 2, oy - 5, 5, 5, c('#3c5a5a')); P.rect(ox - 2, oy - 5, 5, 1, c('#5c7c78')); P.rect(ox - 1, oy - 7, 3, 2, c(C.w4)); }
        x += 7; continue;
      }
      // a series of books (same family, similar height)
      var fam = BOOKS[(rnd() * BOOKS.length) | 0], cnt = 3 + ((rnd() * 6) | 0), base = h - ((rnd() * 4) | 0), bwid = 2 + ((rnd() * 3) | 0);
      var band = rnd() < 0.6, bandY = 1 + ((rnd() * 2) | 0);
      for (var b = 0; b < cnt && x < end; b++) {
        var bw2 = Math.min(end - x, bwid + (rnd() < 0.25 ? 1 : 0));
        var bh2 = Math.max(4, base - ((rnd() * 2) | 0));
        var by = y0 + h - bh2;
        P.rect(x, by, bw2, bh2, c(fam[0]));
        P.rect(x + bw2 - 1, by, 1, bh2, c(fam[1]));              // right edge shade
        P.rect(x, by, bw2 - 1, 1, c(fam[2]));                    // top lit by lanterns
        if (band && bw2 > 2) { P.rect(x, by + bandY + 1, bw2 - 1, 1, c(fam[1])); P.rect(x, by + bh2 - 3, bw2 - 1, 1, c(fam[1])); }
        if (bw2 >= 3 && rnd() < 0.3) P.rect(x + 1, by + Math.floor(bh2 / 2) - 1, 1, 2, c(fam[2]));
        x += bw2;
      }
      if (rnd() < 0.3) x += 1;
    }
  }
  function window_(U, P, cx, w, top, bot, big) {
    var c = U.col, x0 = Math.round(cx - w / 2), r = w / 2;
    // frame surround (stone architrave)
    var fx0 = x0 - 5, fw = w + 10;
    for (var y = top - 6; y < bot + 3; y++) {
      var yy = y + 8;
      var archY = top + r;                                         // arch centre
      var inner = function (yv, rad) {
        if (yv >= archY) return rad;
        var dy = archY - yv; return dy > rad ? -1 : Math.sqrt(rad * rad - dy * dy);
      };
      var ho = inner(y + 0.5, r + 5), hi = inner(y + 0.5, r);
      if (ho < 0) continue;
      var xa = Math.round(cx - ho), xb = Math.round(cx + ho);
      P.rect(xa, yy, xb - xa, 1, c(C.stoneDk));
      if (ho > 1) { P.set(xa, yy, c(C.w0)); P.set(xb - 1, yy, c(C.w0)); P.set(xa + 1, yy, c(C.stone)); P.set(xb - 2, yy, c(C.stoneDk)); }
      if (hi >= 0) {
        var ga = Math.round(cx - hi), gb = Math.round(cx + hi);
        P.rect(ga, yy, gb - ga, 1, 0);                             // glass = transparent (sky shows)
        P.set(ga - 1, yy, c(C.glassRim)); P.set(gb, yy, c(C.frameLt));
        P.set(ga - 2, yy, c(C.frameLt));
      }
    }
    // mullions + transom (dark frame, warm rim on the side facing the sun)
    var mid = Math.round(cx);
    for (y = top; y < bot; y++) {
      var yy2 = y + 8;
      if (P.get(mid, yy2) === 0 || y > top + 3) {
        if (y >= top + 2) { P.set(mid - 1, yy2, c(C.frame)); P.set(mid, yy2, c(C.frame)); P.set(mid + 1, yy2, c(C.glassRim)); }
      }
      var q = Math.round(w / 4);
      if (y > top + r - 4) {
        P.set(mid - q, yy2, c(C.frame)); P.set(mid - q + 1, yy2, c(C.glassRim)); P.set(mid + q, yy2, c(C.frame)); P.set(mid + q + 1, yy2, c(C.glassRim));
      }
    }
    // leaded horizontal glazing bars (only across glass)
    for (y = top + Math.round(r) + 12; y < bot - 2; y += 10) {
      for (var gx = x0; gx < x0 + w; gx++) if (P.get(gx, y + 8) === 0) P.set(gx, y + 8, c(C.frame));
    }
    var tr = top + Math.round(r) + 2;
    P.rect(x0, tr + 8, w, 2, c(C.frame)); P.rect(x0, tr + 10, w, 1, c(C.glassRim));
    // leaded rose in the arch of the big window
    if (big) {
      // stained-glass starburst rose (Claude's motif): 8 amber rays on violet glass, lead lines
      var ry = Math.round(top + r * 0.6) + 8, rr = 10;
      for (var py = -rr - 1; py <= rr + 1; py++) for (var pxx = -rr - 1; pxx <= rr + 1; pxx++) {
        var d = Math.sqrt((pxx + 0.5) * (pxx + 0.5) + (py + 0.5) * (py + 0.5));
        if (d > rr + 1) continue;
        var X2 = Math.round(cx) + pxx, Y2 = ry + py;
        if (d > rr) { P.set(X2, Y2, c(C.frame)); continue; }
        var an = Math.atan2(py + 0.5, pxx + 0.5), sec = an / (Math.PI / 4), k8 = Math.round(sec), off = Math.abs(sec - k8);
        var rayLen = (k8 & 1) ? rr * 0.7 : rr;
        var col;
        if (d < 2.2) col = C.goldLt;
        else if (d < 3.2) col = C.frame;
        else if (off < 0.16 && d < rayLen) col = d < rayLen * 0.6 ? '#ffe2a0' : '#f2a868';
        else if (off < 0.26 && d < rayLen) col = C.frame;
        else col = d > rr - 2 ? '#7a4a86' : '#523670';
        P.set(X2, Y2, c(col));
      }
    }
    // sill + window seat
    P.rect(x0 - 6, bot + 8, w + 12, 2, c(C.stoneLt)); P.rect(x0 - 6, bot + 10, w + 12, 1, c(C.stoneDk));
  }
  function doorway(U, P, cx, top, w, h) {
    var c = U.col, r = w / 2, bot = top + h;
    for (var y = top - 4; y < bot; y++) {
      var archY = top + r, yy = y + 8;
      var half = function (rad) { if (y + 0.5 >= archY) return rad; var dy = archY - (y + 0.5); return dy > rad ? -1 : Math.sqrt(rad * rad - dy * dy); };
      var ho = half(r + 4), hi = half(r);
      if (ho < 0) continue;
      P.rect(Math.round(cx - ho), yy, Math.round(cx + ho) - Math.round(cx - ho), 1, c(C.stone));
      P.set(Math.round(cx - ho), yy, c(C.stoneLt));
      if (hi >= 0) {
        var a = Math.round(cx - hi), b = Math.round(cx + hi);
        // dim reading room beyond: teal-dark, a far window glow and shelves silhouettes
        var dark = y < top + r ? '#162026' : (y > bot - 10 ? '#1a1c22' : '#1c2a30');
        P.rect(a, yy, b - a, 1, c(dark));
        P.set(b - 1, yy, c(C.stoneDk)); P.set(b - 2, yy, c('#121a1e'));
      }
    }
    // far room: small window with sky glimmer + shelf silhouettes + floor line
    var fy = top + 14;
    P.rect(cx - 4, fy + 8, 8, 12, c('#5a3a5e')); P.rect(cx - 4, fy + 8 + 7, 8, 5, c('#b0605e')); P.rect(cx - 4, fy + 8 + 10, 8, 2, c('#e09062'));
    P.rect(cx, fy + 8, 1, 12, c('#1c2a30')); P.rect(cx - 4, fy + 8 + 5, 8, 1, c('#1c2a30'));
    P.rect(cx - 15, top + 24 + 8, 8, 24, c('#24343a')); P.rect(cx + 7, top + 24 + 8, 8, 24, c('#24343a'));
    for (var k = 0; k < 4; k++) { P.rect(cx - 15, top + 30 + k * 5 + 8, 8, 1, c('#2e4448')); P.rect(cx + 7, top + 30 + k * 5 + 8, 8, 1, c('#2e4448')); }
    P.rect(cx - r, bot - 8 + 8, w, 1, c('#2a3c40'));
    P.dither(cx - r, bot - 7 + 8, w, 7, c('#253238'), 8);
    // keystone
    P.rect(cx - 2, top - 4 + 8, 5, 5, c(C.stoneLt)); P.rect(cx - 2, top + 8, 5, 1, c(C.stoneDk));
  }
  function clockCase(U, P, cx, top) {
    var c = U.col, x = cx - 10, Y = top + 8;
    P.rect(x - 1, Y, 22, 62, c(C.w1));
    P.rect(x, Y + 1, 20, 60, c(C.w3));
    P.rect(x, Y + 1, 1, 60, c(C.w5)); P.rect(x + 19, Y + 1, 1, 60, c(C.w2));
    // bonnet + finials
    P.rect(x - 2, Y - 2, 24, 3, c(C.w4)); P.rect(x - 2, Y - 2, 24, 1, c(C.w6));
    P.rect(x + 8, Y - 5, 4, 3, c(C.w4)); P.rect(x + 9, Y - 7, 2, 2, c(C.gold));
    // face
    P.ellipse(cx, Y + 11, 7, 7, c(C.gold)); P.ellipse(cx, Y + 11, 6, 6, c(C.clockFace));
    P.rect(cx - 6, Y + 13, 12, 3, c(C.clockFace));
    for (var a = 0; a < 12; a++) { var an = a / 12 * Math.PI * 2; P.set(Math.round(cx + Math.cos(an) * 5 - 0.5), Math.round(Y + 11 + Math.sin(an) * 5 - 0.5), c(C.clockFaceDk)); }
    P.line(cx, Y + 11, cx - 3, Y + 9, c(C.ink)); P.line(cx, Y + 11, cx, Y + 6, c(C.ink));
    // trunk window (pendulum is drawn live)
    P.rect(x + 5, Y + 22, 10, 30, c(C.w0)); P.rect(x + 4, Y + 21, 12, 1, c(C.gold)); P.rect(x + 4, Y + 52, 12, 1, c(C.goldDk));
    P.rect(x + 4, Y + 22, 1, 30, c(C.goldDk)); P.rect(x + 15, Y + 22, 1, 30, c(C.goldDk));
    P.rect(x + 13, Y + 23, 1, 6, c('#3a3048'));                    // glass glint
    P.rect(x - 1, Y + 56, 22, 6, c(C.w2)); P.rect(x - 1, Y + 56, 22, 1, c(C.w5));
  }
  function ladder(U, P, x, top, bot, lean) {
    var c = U.col;
    for (var y = top; y < bot; y++) {
      var k = (y - top) / (bot - top), off = Math.round(k * lean);
      P.set(x + off, y + 8, c(C.w5)); P.set(x + off + 1, y + 8, c(C.w3));
      P.set(x + off + 8, y + 8, c(C.w5)); P.set(x + off + 9, y + 8, c(C.w3));
      if ((y - top) % 6 === 3) { P.rect(x + off + 1, y + 8, 7, 1, c(C.w4)); P.rect(x + off + 1, y + 9, 7, 1, c(C.w1)); }
    }
    P.rect(x - 1, top + 8 - 2, 12, 2, c(C.brass)); P.rect(x - 1, top + 8 - 2, 12, 1, c(C.goldLt));  // rail hook
  }
  function column(U, P, cx, top, bot) {
    var c = U.col, w = 12, x = cx - 6;
    for (var y = top; y < bot; y++) {
      var Y = y + 8;
      P.rect(x, Y, w, 1, c(C.stone));
      P.set(x, Y, c(C.stoneDk)); P.set(x + 1, Y, c(C.stoneLt)); P.set(x + 2, Y, c(C.stoneLt));
      P.set(x + w - 1, Y, c(C.w0)); P.set(x + w - 2, Y, c(C.stoneDk)); P.set(x + w - 3, Y, c(C.stoneDk));
      if ((y & 1) === 0) P.set(x + 5, Y, c(C.stoneDk));               // flute
      P.set(x + 8, Y, c(C.stoneDk));
    }
    // capital + base
    P.rect(x - 2, top + 8, w + 4, 3, c(C.stoneLt)); P.rect(x - 2, top + 8 + 3, w + 4, 1, c(C.stoneDk)); P.rect(x - 1, top + 8 + 4, w + 2, 2, c(C.stone));
    P.rect(x - 2, bot + 8 - 5, w + 4, 2, c(C.stone)); P.rect(x - 3, bot + 8 - 3, w + 6, 3, c(C.stoneLt)); P.rect(x - 3, bot + 8 - 1, w + 6, 1, c(C.stoneDk));
    // warm lantern light grazing the left side
    P.dither(x + 1, top + 8 + 8, 2, 40, c(C.w6), 6);
  }
  function curtain(U, p, f) {
    var c = U.col, ph = f / 6 * Math.PI * 2;
    for (var y = 0; y < 64; y++) {
      var k = y / 64, tie = 40;
      var wdt = y < tie ? Math.round(12 - k * 6 + Math.sin(ph + y / 9) * 1.2) : Math.round(6 + (y - tie) * 0.45 + Math.sin(ph + y / 7) * 0.8);
      wdt = Math.max(3, Math.min(17, wdt));
      for (var x = 0; x < wdt; x++) {
        var fold = (x + Math.round(Math.sin(ph * 0.5 + y / 12) * 1.5)) % 4;
        var col = fold === 0 ? C.curtain[0] : fold === 3 ? C.curtain[2] : C.curtain[1];
        if (x === wdt - 1) col = C.curtain[3];
        p.set(x, y, c(col));
      }
    }
    p.rect(0, 39, 9, 2, c(C.tassel)); p.rect(7, 41, 2, 4, c(C.tassel)); p.set(8, 45, c(C.goldDk));
  }
  function lanternSprite(U) {
    var c = U.col, p = U.pix(17, 21), cx = 8, cy = 12;
    // 8 rays
    var rays = [[0, -8], [6, -6], [8, 0], [6, 6], [0, 8], [-6, 6], [-8, 0], [-6, -6]];
    rays.forEach(function (r, i) {
      var len = i % 2 ? 0.75 : 1;
      p.line(cx, cy, Math.round(cx + r[0] * len), Math.round(cy + r[1] * len), c(C.brass));
    });
    p.ellipse(cx + 0.5, cy + 0.5, 4.5, 4.5, c(C.lampGlass));
    p.ellipse(cx + 0.5, cy + 0.5, 3, 3, c(C.lampHot));
    p.rect(cx - 1, cy - 1, 3, 3, c(C.lampCore));
    p.set(cx, cy - 8, c(C.lampHot)); p.set(cx + 8, cy, c(C.lampHot)); p.set(cx, cy + 8, c(C.lampHot)); p.set(cx - 8, cy, c(C.lampHot));
    p.rect(cx - 1, 0, 3, 3, c(C.brassDk)); p.set(cx, 0, c(C.brass));
    return p.toCanvas();
  }
  function deskSprite(U) {
    var c = U.col, p = U.pix(64, 44), y0 = 20;
    // desk top (seen from slightly above), front panel, legs
    p.rect(2, y0, 60, 3, c(C.w5)); p.rect(2, y0, 60, 1, c(C.w6)); p.rect(1, y0 + 3, 62, 2, c(C.w3));
    p.rect(3, y0 + 5, 58, 9, c(C.w2)); p.rect(5, y0 + 7, 24, 5, c(C.w3)); p.rect(35, y0 + 7, 24, 5, c(C.w3));
    p.rect(16, y0 + 9, 2, 1, c(C.brass)); p.rect(46, y0 + 9, 2, 1, c(C.brass));
    p.rect(3, y0 + 14, 4, 10, c(C.w2)); p.rect(57, y0 + 14, 4, 10, c(C.w2)); p.rect(3, y0 + 14, 1, 10, c(C.w4)); p.rect(57, y0 + 14, 1, 10, c(C.w4));
    // book stack (left)
    var st = [[5, 19, 16, BOOKS[1]], [6, 16, 14, BOOKS[5]], [4, 13, 15, BOOKS[2]], [7, 10, 11, BOOKS[0]]];
    st.forEach(function (b) { p.rect(b[0], b[1] - 2, b[2], 3, c(b[3][0])); p.rect(b[0], b[1], b[2], 1, c(b[3][1])); p.rect(b[0] + b[2] - 2, b[1] - 2, 2, 2, c(C.page)); });
    // open book
    p.rect(24, y0 - 2, 9, 2, c(C.page)); p.rect(33, y0 - 2, 9, 2, c(C.pageDk)); p.rect(32, y0 - 2, 1, 2, c(C.pageEdge));
    p.rect(25, y0 - 2, 6, 1, c(C.pageDk)); p.rect(34, y0 - 2, 5, 1, c(C.pageEdge));
    // inkwell + quill
    p.rect(45, y0 - 3, 4, 3, c(C.ink)); p.rect(46, y0 - 4, 2, 1, c('#3a3858'));
    p.line(47, y0 - 4, 51, y0 - 13, c(C.page)); p.line(48, y0 - 6, 52, y0 - 12, c(C.pageDk));
    // teacup + saucer
    p.rect(53, y0 - 1, 8, 1, c(C.teaDk)); p.rect(54, y0 - 4, 5, 3, c(C.tea)); p.rect(58, y0 - 4, 1, 3, c(C.teaDk)); p.rect(59, y0 - 3, 1, 1, c(C.tea));
    p.rect(55, y0 - 4, 3, 1, c('#8a4a34'));
    // candle in brass holder
    p.rect(39, y0 - 2, 5, 2, c(C.brass)); p.rect(40, y0 - 9, 3, 7, c(C.page)); p.rect(42, y0 - 9, 1, 7, c(C.pageDk));
    p.outline(c(C.w0));
    return p.toCanvas();
  }
  function globeSprite(U) {
    var c = U.col, p = U.pix(26, 40);
    p.rect(11, 30, 4, 8, c(C.w3)); p.rect(6, 37, 14, 2, c(C.w3)); p.rect(6, 37, 14, 1, c(C.w5));
    p.ellipse(13, 15, 11, 11, c(C.brassDk));
    p.ellipse(13, 15, 9, 9, c('#2e4a52'));
    p.fn(4, 6, 18, 18, function (x, y, cur) {
      if (cur !== c('#2e4a52')) return 0;
      var n = Math.sin(x * 0.7 + 1) + Math.cos(y * 0.6) + Math.sin((x + y) * 0.4);
      if (n > 0.9) return c(x + y < 26 ? '#7a7448' : '#5c5a38');
      if (x + y < 22 && U.dith(x, y, 4)) return c('#3c5c62');
      return 0;
    });
    p.rect(13, 3, 1, 25, c(C.brass)); p.rect(12, 2, 3, 1, c(C.brass));
    p.set(7, 10, c('#5c7c80')); p.set(8, 9, c('#5c7c80'));
    p.outline(c(C.w0));
    return p.toCanvas();
  }
  function catFrames(U) {
    var c = U.col;
    return U.frames(3, 24, 16, function (p, f) {
      // sleeping loaf facing left on the rail; tail hangs over the front edge (rest / twitch / curl)
      var body = c(C.cat);
      p.ellipse(12.5, 7, 8, 4, body);
      p.ellipse(5, 6.5, 3.5, 3, body);                            // head
      p.rect(2, 2, 2, 2, body); p.set(2, 1, f === 1 ? 0 : body); p.rect(6, 2, 2, 2, body); p.set(7, 1, body);   // ears (left one twitches)
      p.rect(9, 10, 3, 1, body);                                  // tucked paws
      var tail = [[[19, 9], [20, 10], [20, 11], [20, 12], [19, 13], [19, 14]], [[19, 9], [20, 10], [21, 11], [21, 12], [21, 13], [20, 14]], [[19, 9], [20, 10], [20, 11], [19, 12], [18, 12], [17, 13]]][f];
      tail.forEach(function (q) { p.set(q[0], q[1], body); p.set(q[0] + 1, q[1], body); });
      // rim light along the top contour (sun behind), closed eye, nose
      for (var x = 0; x < 24; x++) for (var y = 1; y < 16; y++) {
        if (p.get(x, y) === body && p.get(x, y - 1) === 0) { p.set(x, y, c(x > 4 && x < 18 ? C.w6 : C.w5)); break; }
      }
      p.rect(3, 6, 2, 1, c(C.catDk)); p.set(1, 7, c(C.catNose));
      p.outline(c(C.w0));
    });
  }
  function floorTexel(U) {
    var c = U.col, pl = C.pl.map(c), seam = c(C.seam), gloss = c(C.gloss), gloss2 = c(C.gloss2);
    var pool = C.pool.map(c), rug = c(C.rug), rugDk = c(C.rugDk), rugPat = c(C.rugPat), rugPat2 = c(C.rugPat2);
    var trim = c(C.rugTrim), trimDk = c(C.rugTrimDk), rugRed = c(C.rugRed), far = c(C.floorFar), near = c(C.floorNear);
    var winXW = [120, 320, 520];
    return function (X, y, s) {
      var z = 1 / s;                                     // relative depth (1 at the ground line)
      var px = Math.floor(X / 11), pzLen = 1.5;           // plank index across, board length in depth units
      var zo = z + U.hash(px, 7) * pzLen;
      var pz = Math.floor(zo / pzLen);
      var fx = X - px * 11;
      var lx = Math.round(fx * s);
      // carpet runner rows
      if (y >= 177 && y <= 198) {
        if (y === 177 || y === 198) return trimDk;
        if (y === 178 || y === 197) return trim;
        if (y === 179 || y === 196) return rugRed;
        var mz = y - 187.5, m = ((X % 28) + 28) % 28 - 14;
        var dm = Math.abs(m) / 14 * 9 + Math.abs(mz);
        if (dm < 3) return trim;
        if (dm < 5) return rugPat2;
        if (dm > 8.5 && dm < 10) return rugPat;
        if (y === 180 || y === 195) return rugDk;
        return rug;
      }
      // planks
      var tone = pl[(U.hash(px, pz) * 4) | 0];
      if (fx < 1 / s * 0.9 && s > 0.6) return seam;      // seam between planks (1 px at any depth)
      if (Math.abs(zo - pz * pzLen) * (186 - YH) * s * s < 0.6) return seam;   // board end joint
      // window reflections near the wall (glossy floor): vertical warm streaks under each window
      for (var i = 0; i < 3; i++) {
        var d = Math.abs(X - winXW[i]);
        if (y < 177 && d < 30) {
          var k = (177 - y) / 9;
          if (d < 20 * k && (y & 1)) return d < 8 * k ? gloss2 : gloss;
        }
        // light pools in front: slanted parallelograms (sun behind windows, slightly left)
        if (y > 199) {
          var off = (y - 199) * 1.2 + 22;
          var e = Math.abs(X - (winXW[i] + off)) - (16 + (y - 199) * 0.7);
          if (e < 0) {
            var lvl = Math.max(0, Math.min(3, Math.floor(-e / 4)));
            var t = (y - 199) / 25;
            if (lvl >= 2 && U.dith(Math.round(X * s), y, 8)) return pool[Math.min(3, lvl - 1 + (t < 0.4 ? 1 : 0))];
            return pool[Math.max(0, lvl - 1)] || (U.dith(Math.round(X * s), y, 6) ? pool[0] : tone);
          }
        }
      }
      // gloss: soft highlight line along each plank's lit side
      if (lx === 1 && (pz & 1)) return gloss;
      // depth tint: farther rows darker/cooler, nearest rows darker (vignette)
      if (y < 172 && U.dith(Math.round(X * s), y, (172 - y) * 4)) return far;
      if (y > 214 && U.dith(Math.round(X * s), y, (y - 214) * 2)) return near;
      return tone;
    };
  }

  // ================================================================== instance
  function setup(st, A, U) {
    var c = U.col, rnd = st.rnd;
    st.motes = [];
    for (var i = 0; i < 46; i++) st.motes.push({ x: rnd() * 600, y: 40 + rnd() * 150, v: 0.05 + rnd() * 0.12, p: rnd() * 6.28, f: 0.9 + rnd() * 0.3 });
    st.pages = [];
    st.fall = [];
    st.lamps = [30, 215, 425, 610].map(function (X, i) { return { X: X, y: 44 + (i % 2) * 8, ph: i * 1.7, sw: 0, swv: 0 }; });
    st.flash = 0;
    st.birds = { x: -40, y: 52 };

    var layers = [];
    layers.push({ name: 'sky', draw: function (g, cam) { U.layer(g, A.sky, A.fS, cam); } });
    layers.push({ name: 'city', draw: function (g, cam, s) {
      U.layer(g, A.city, A.fC, cam, -8);
      // radio-tower beacon blink
      if ((s.t >> 5) % 3 === 0) { g.fillStyle = '#ff7a5a'; g.fillRect(A.towerX - 8 - Math.round(cam * A.fC), A.towerY - 8, 1, 1); }
      // a few birds crossing the sky
      var bx = ((s.t * 0.35) % 900) - 100, by = 50 + Math.sin(s.t / 90) * 4;
      g.fillStyle = '#3a2448';
      for (var k = 0; k < 3; k++) {
        var x = Math.round(bx - k * 9 - cam * 0.1), y = Math.round(by + k * 3), fl = ((s.t >> 3) + k) & 1;
        g.fillRect(x - 1, y - fl, 1, 1); g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y - fl, 1, 1);
      }
    } });
    layers.push({ name: 'hills', draw: function (g, cam) { U.layer(g, A.hills, A.fHl, cam, -8); } });
    layers.push({ name: 'wall', draw: function (g, cam, s) {
      var ox = -8 - Math.round(cam * A.FW);
      g.drawImage(A.wall, ox, -8);
      // curtains at each window (breathing)
      var f = ((s.t / 22) | 0) % 6, f2 = (f + 3) % 6;
      for (var i = 0; i < 3; i++) {
        var hw = A.winW[i] / 2;
        g.drawImage(A.curtains[f], ox + Math.round(A.winX[i] - hw - 8), 30);
        g.save(); g.translate(ox + Math.round(A.winX[i] + hw + 8), 30); g.scale(-1, 1); g.drawImage(A.curtains[f2], 0, 0); g.restore();
      }
      // pendulum + cat on the clock
      var cl = A.clock, ang = Math.sin(s.t / 60 * Math.PI) * 0.22;
      var px0 = ox + cl.x, py0 = cl.y + 22, len = 22;
      g.fillStyle = C.brassDk;
      for (var k = 0; k < len; k += 1) g.fillRect(Math.round(px0 + Math.sin(ang) * k), py0 + k, 1, 1);
      var bx = Math.round(px0 + Math.sin(ang) * len), by = py0 + len;
      g.fillStyle = C.brass; g.fillRect(bx - 2, by - 1, 5, 3); g.fillStyle = C.goldLt; g.fillRect(bx - 1, by - 1, 2, 1);
    } });
    layers.push({ name: 'floor', draw: function (g, cam) { U.drawFloor(g, A.floor, cam); } });
    layers.push({ name: 'mezzanine', draw: function (g, cam, s) {
      U.layer(g, A.mez, A.F_MEZ, cam);
      var cf = ((s.t % 300) > 266) ? 1 : ((s.t % 520) > 460 ? 2 : 0);   // cat asleep on the rail, tail twitching
      g.drawImage(A.cat[cf], Math.round(U.sx(372, A.F_MEZ, cam)) - 12, 63);
    } });
    layers.push({ name: 'shafts', draw: function (g, cam) {
      g.globalCompositeOperation = 'lighter';
      U.layer(g, A.shafts, A.fSh, cam);
      g.globalCompositeOperation = 'source-over';
    } });
    layers.push({ name: 'lanterns', draw: function (g, cam, s) {
      var f = 0.97;
      for (var i = 0; i < s.lamps.length; i++) {
        var L = s.lamps[i];
        var x = Math.round(U.sx(L.X, f, cam)), sw = Math.round(L.sw);
        var pulse = (Math.sin(s.t / 40 + L.ph) + 1) / 2, hf = Math.min(3, Math.floor(pulse * 3.99) + (s.flash > 0 ? 1 : 0));
        // chain
        g.fillStyle = C.brassDk;
        for (var y = -8; y < L.y; y += 3) { var cx = Math.round(x + sw * (y + 8) / (L.y + 8)); g.fillRect(cx, y, 1, 2); }
        g.drawImage(A.halo[hf], x + sw - 24, L.y + 12 - 24 + 1);
        g.drawImage(A.lantern, x + sw - 8, L.y);
      }
    } });
    layers.push({ name: 'props', draw: function (g, cam, s) {
      var dx = Math.round(U.sx(96, A.fDesk, cam)) - 32;
      g.drawImage(A.desk, dx, 176 - 44 + 1);
      // candle flame + tea steam
      var fl = (s.t >> 2) & 3;
      g.fillStyle = C.lampHot; g.fillRect(dx + 41, 176 - 44 + 1 + 9 - (fl === 1 ? 1 : 0), 1, 2);
      g.fillStyle = C.lampCore; g.fillRect(dx + 41, 176 - 44 + 1 + 10, 1, 1);
      g.fillStyle = C.steam;
      for (var k = 0; k < 3; k++) {
        var ph = ((s.t / 2 + k * 14) % 42), sy = 176 - 44 + 1 + 15 - ph * 0.35;
        if (ph < 34) g.fillRect(dx + 56 + Math.round(Math.sin(ph / 6 + k) * 1.5), Math.round(sy), 1, 1);
      }
      var gx = Math.round(U.sx(572, A.fGlobe, cam)) - 13;
      g.drawImage(A.globe, gx, 174 - 40 + 1);
    } });
    // falling books (event) live on the floor/wall plane
    layers.push({ name: 'debris', draw: function (g, cam, s) {
      for (var i = 0; i < s.fall.length; i++) {
        var b = s.fall[i];
        g.drawImage(A.book[b.f], Math.round(U.sx(b.X, A.FW, cam)) - 3, Math.round(b.y) - 3);
      }
    } });
    // ---- front
    layers.push({ name: 'motes', front: true, draw: function (g, cam, s) {
      g.fillStyle = C.mote;
      for (var i = 0; i < s.motes.length; i++) {
        var m = s.motes[i];
        var x = Math.round(((m.x - cam * m.f) % 420 + 420) % 420 - 10), y = Math.round(m.y);
        if (((s.t + i * 7) >> 4) % 5 !== 0) g.fillRect(x, y, 1, 1);
      }
      for (i = 0; i < s.pages.length; i++) {
        var p = s.pages[i];
        g.drawImage(A.page[((s.t + i * 5) >> 3) & 3], Math.round(U.sx(p.X, p.f, cam)) - 3, Math.round(p.y));
      }
    } });
    return layers;
  }

  function update(st, A, U) {
    var rnd = st.rnd;
    for (var i = 0; i < st.motes.length; i++) {
      var m = st.motes[i];
      m.y -= m.v * 0.25; m.x += Math.sin(st.t / 90 + m.p) * 0.08;
      if (m.y < 36) { m.y = 190; m.x = rnd() * 600; }
    }
    // ambient loose pages drifting down from the mezzanine
    if (st.pages.length < 3 && (st.t % 150) === 0) st.pages.push({ X: 40 + rnd() * 560, y: 94, f: 0.9 + rnd() * 0.15, ph: rnd() * 6, v: 0.18 + rnd() * 0.08 });
    for (i = st.pages.length - 1; i >= 0; i--) {
      var p = st.pages[i];
      p.y += p.v; p.X += Math.sin(st.t / 30 + p.ph) * 0.35;
      if (p.y > 200) st.pages.splice(i, 1);
    }
    for (i = st.fall.length - 1; i >= 0; i--) {
      var b = st.fall[i];
      if (b.y < b.ground) { b.vy += 0.18; b.y += b.vy; b.X += b.vx; if ((st.t & 3) === 0) b.f = (b.f + 1) & 3; }
      else { b.y = b.ground; b.rest++; if (b.rest > 240) st.fall.splice(i, 1); }
    }
    for (i = 0; i < st.lamps.length; i++) {
      var L = st.lamps[i];
      L.swv += -L.sw * 0.012 - L.swv * 0.02; L.sw += L.swv;
    }
    if (st.flash > 0) st.flash--;
  }

  function event(st, A, name, data, U) {
    var rnd = st.rnd, i;
    if (name === 'hit' && (data.power || 0) >= 0.6) {
      st.fall.push({ X: (data.x || 320) + (rnd() - 0.5) * 80, y: 110 + rnd() * 30, vy: -0.5, vx: (rnd() - 0.5) * 0.4, f: 0, ground: 166, rest: 0 });
      st.pages.push({ X: (data.x || 320), y: 96, f: 1, ph: rnd() * 6, v: 0.3 });
      for (i = 0; i < st.lamps.length; i++) st.lamps[i].swv += (rnd() - 0.5) * 0.3;
    } else if (name === 'ko') {
      for (i = 0; i < 4; i++) st.fall.push({ X: 60 + rnd() * 520, y: 106 + rnd() * 40, vy: -rnd(), vx: (rnd() - 0.5) * 0.5, f: i & 3, ground: 166, rest: 0 });
      for (i = 0; i < 6; i++) st.pages.push({ X: 40 + rnd() * 560, y: 90 + rnd() * 10, f: 0.95 + rnd() * 0.2, ph: rnd() * 6, v: 0.25 + rnd() * 0.2 });
      for (i = 0; i < st.lamps.length; i++) st.lamps[i].swv += (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 0.3);
    } else if (name === 'roundStart' || name === 'super') {
      st.flash = 40;
    }
  }

  LC.stages.define('library', { music: 'stage.library', shadowColor: 'rgba(16,8,24,0.55)', build: build, setup: setup, update: update, event: event });
})();
