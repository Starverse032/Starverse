/* LATENT CLASH — STAGE 2: abyss 深蓝机房 (DeepSeek's home). Data centre on the sea floor.
 *
 * Light logic: deep-sea blue light enters through the huge curved glass wall (key light from the
 * back, cool teal); cool white strip lights in the ceiling; caustics from the glass ripple over
 * the floor and the racks; LEDs and the holo sign are the only saturated accents. The room is deep
 * indigo/teal so DeepSeek's white hoodie and Claude's coral both pop.
 *
 * Layers: ocean 0.04 (+rays) · whales 0.07 · seabed 0.12 · kelp 0.2 · fish 0.3 · wall 0.841
 * (glass frame, racks, console; LED + caustic overlays) · floor (line scroll, 8 caustic frames)
 * · rays (additive) · tanks 0.9 · holo sign 0.88 · front: bottom pipe 1.25.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var YH = 76;

  var C = {
    sea: ['#1b5266', '#164659', '#12394d', '#0f2f44', '#0c263b', '#0a1f33', '#09192b', '#081424'],
    ray: ['#000000', '#041014', '#07191e', '#0a2228'],
    whale: '#061322', whaleTop: '#2a6474', whaleBelly: '#0e2638', whaleFar: '#0c2638',
    bed: '#0a1c2c', bedTop: '#10283a', bed2: '#071422', kelp: '#0c3034', kelpLt: '#14484a', fish: '#3a7a88', fishLt: '#6ab0b8',
    snow: '#3a7280',
    s0: '#080b16', s1: '#0e1222', s2: '#151b2e', s3: '#1c2440', s4: '#253052', s5: '#323f68', s6: '#46598a', s7: '#6a82b0',
    teal0: '#12343c', teal1: '#1a4a52', teal2: '#24666c', teal3: '#3a8c8c',
    rack: '#1a2136', rackLt: '#252f4a', rackDk: '#10141f', bezel: '#2c3856', vent: '#0b0e18',
    ledC: '#62f2ff', ledG: '#5effa8', ledA: '#ffb24a', ledR: '#ff5a5a', ledOff: '#1a2a3a',
    cable: ['#2a5a6a', '#3a4a7a', '#6a5a3a', '#2a3a5a', '#4a6a5a'],
    strip: '#86c8d8', stripDk: '#3a6474',
    glassHi: '#2a5a6e', glassHi2: '#3e7a8a', frame: '#141a2c', frameLt: '#3a4c70', frameRim: '#4c90a0',
    glow: '#3ad0e8', glowDk: '#1a7a90', holo: '#8af8ff', holoDk: '#2ab8d0',
    fl: ['#1a2236', '#1e2740', '#222c48'], flSeam: '#0a0e18', flSlot: '#121828', flHi: '#34426a', wet: '#101a2c', wetHi: '#2a5a6c', wetHi2: '#3e7c88',
    rivet: '#4a5a80', warn: '#8a6a2a', warnDk: '#2a2214',
    pipe: ['#5a6e90', '#3a4a6a', '#26304a', '#161c2e'], pipeTeal: ['#4a9a9a', '#2c6a70', '#1a464e', '#0e2a32'],
    coolant: '#1d8a9a', coolantDk: '#0f4c5a', coolantLt: '#8ae4ee'
  };

  // tileable animated caustic pattern: 64×64 tiles, `n` frames, values 0 / 1 / 2 (none, line, hot)
  function causticTiles(n) {
    var T = [], TAU = Math.PI * 2;
    for (var f = 0; f < n; f++) {
      var t = f / n * TAU, a = new Uint8Array(64 * 64);
      for (var y = 0; y < 64; y++) for (var x = 0; x < 64; x++) {
        var u = x / 64 * TAU, v = y / 64 * TAU;
        var p = Math.sin(2 * u + 1.3 * Math.sin(v + t) + 0.7 * Math.sin(3 * v - t)) + Math.sin(3 * v + 1.1 * Math.sin(2 * u - t) + 0.6 * Math.cos(u + 2 * v + t));
        var q = Math.abs(p);
        a[y * 64 + x] = q < 0.1 ? 2 : q < 0.26 ? 1 : 0;
      }
      T.push(a);
    }
    return T;
  }

  function build(U) {
    var c = U.col, A = {}, rnd = U.rng(4242);
    var FW = A.FW = U.floorScale(YH, 168);
    var sy = function (y) { return y + 8; };

    // ------------------------------------------------------------ ocean (0.04) with light rays
    var fO = A.fO = 0.04, ow = U.layerW(fO), ocean = U.pix(ow, 180);
    ocean.bands(0, 0, ow, 180, [[0, C.sea[0]], [sy(30), C.sea[1]], [sy(52), C.sea[2]], [sy(74), C.sea[3]], [sy(96), C.sea[4]], [sy(116), C.sea[5]], [sy(136), C.sea[6]], [sy(154), C.sea[7]]], 4);
    A.ocean = ocean.toCanvas();
    // god rays from the surface far above (additive, stepped, slowly swaying)
    var rays = U.pix(ow + 60, 180), rc = C.ray.map(c);
    [[40, 22, 1.0], [96, 14, 0.8], [150, 26, 1.0], [214, 12, 0.7], [262, 20, 0.9], [330, 16, 0.8], [372, 24, 1.0], [420, 12, 0.7]].forEach(function (r) {
      for (var y = 0; y < 170; y++) {
        var k = y / 170, x0 = r[0] + y * 0.32, w = r[1] * (0.35 + k * 0.5);
        var L = (y < 40 ? 3 : y < 80 ? 2 : y < 120 ? 1 : 0);
        if (r[2] < 0.9) L--;
        for (var x = Math.round(x0); x < x0 + w; x++) {
          var l = L - ((x - x0 < 2 || x0 + w - x < 2) ? 1 : 0);
          if (l > 0) rays.set(x, y, rc[l]);
        }
      }
    });
    A.rays = rays.toCanvas();

    // ------------------------------------------------------------ whales (sprites, 4 fluke frames)
    A.whale = U.frames(4, 124, 40, function (p, f) { whale(U, p, f, 1, C.whale, C.whaleTop, C.whaleBelly); });
    A.calf = U.frames(4, 62, 22, function (p, f) { whale(U, p, f, 0.5, C.whale, C.whaleTop, C.whaleBelly); });
    A.farWhale = U.frames(4, 40, 14, function (p, f) { whale(U, p, f, 0.32, C.whaleFar, C.whaleFar, C.whaleFar); });

    // ------------------------------------------------------------ seabed ridges (0.12) + kelp (0.2)
    var fB = A.fB = 0.12, bw = U.layerW(fB), bed = U.pix(bw, 180);
    for (var i = 0; i < bw; i++) {
      var h = 128 + Math.sin(i / 23) * 6 + Math.sin(i / 9 + 2) * 2 + (U.hash(i >> 2, 5) * 2 | 0);
      bed.rect(i, sy(Math.round(h)), 1, 80, c(C.bed));
      bed.set(i, sy(Math.round(h)), c(C.bedTop));
      var h2 = 140 + Math.sin(i / 31 + 1) * 5 + Math.sin(i / 7) * 1.5;
      bed.rect(i, sy(Math.round(h2)), 1, 80, c(C.bed2));
    }
    // distant sister module: a domed habitat with lit portholes, a mast beacon and a lit cable run
    var hx = U.wx(300, fB);
    bed.ellipse(hx, sy(118), 22, 14, c('#24586a')); bed.ellipse(hx, sy(119), 21, 13, c('#0e2a3c')); bed.ellipse(hx + 3, sy(121), 17, 10, c('#0b2234'));
    bed.rect(hx - 30, sy(118), 60, 14, c('#0b2234')); bed.rect(hx - 30, sy(118), 60, 1, c('#24586a')); bed.rect(hx - 30, sy(118), 1, 14, c('#1c4a5c'));
    bed.rect(hx - 1, sy(98), 2, 8, c(C.bedTop)); A.beacon = [hx, sy(97)];
    for (var q = -3; q <= 3; q++) bed.rect(hx + q * 7 - 1, sy(112) + Math.abs(q), 2, 2, c(q === 0 ? '#e0b060' : '#5ac8d8'));
    for (q = -26; q < 26; q += 4) bed.set(hx + q, sy(126), c('#2a7a8a'));
    for (i = 0; i < bw; i += 3) if (Math.abs(i - hx) > 32) bed.set(i, sy(131 + Math.round(Math.sin(i / 40) * 2)), c(i % 9 === 0 ? '#3ab0c0' : '#123a4a'));
    A.bed = bed.toCanvas();
    A.kelp = U.frames(6, U.layerW(0.2), 100, function (p, f) {
      var r2 = U.rng(77), TAU = Math.PI * 2;
      for (var s = 0; s < 34; s++) {
        var x0 = r2() * p.w, hgt = 40 + r2() * 50, ph = r2() * TAU, thick = r2() < 0.4 ? 2 : 1;
        for (var y = 0; y < hgt; y++) {
          var k = y / hgt, sw = Math.sin(f / 6 * TAU + ph + y / 12) * k * 4;
          var x = Math.round(x0 + sw), yy = 99 - y;
          p.rect(x, yy, thick, 1, c(C.kelp));
          if ((y % 7) === 3) { p.set(x + (Math.sin(ph + y) > 0 ? thick : -1), yy, c(C.kelpLt)); }
        }
      }
    });
    A.fK = 0.2;
    A.jelly = U.frames(4, 9, 14, function (p, f) {
      var sq = [0, 1, 2, 1][f];
      p.ellipse(4.5, 3 + sq * 0.3, 4 - sq * 0.5, 3 - sq * 0.4, c('#6a5a9a'));
      p.rect(2, 1, 3, 1, c('#b8a8e8')); p.set(4, 3, c('#e0d0ff'));
      for (var tx = 2; tx < 8; tx += 2) for (var ty = 6; ty < 13 - sq; ty++) if (((ty + tx + f) & 3) !== 0) p.set(tx + ((ty >> 2) & 1), ty, c('#4a4078'));
    });

    // ------------------------------------------------------------ wall (FW): glass frame, racks, console
    var ww = U.layerW(FW), wall = U.pix(ww, 176);
    var R = function (x, y, w, h, col) { wall.rect(x, y + 8, w, h, c(col)); };
    var gx0 = Math.round(U.wx(196, FW)), gx1 = Math.round(U.wx(444, FW)), gcx = (gx0 + gx1) / 2, ghw = (gx1 - gx0) / 2;
    A.glass = { x0: gx0, x1: gx1 };
    var glassTop = function (x) { var k = (x - gcx) / ghw; return Math.round(26 + 14 * k * k); };
    // base wall panels
    R(0, -8, ww, 176, C.s2);
    for (var py = 26; py < 168; py += 22) R(0, py, ww, 1, C.s1);
    for (var px2 = 6; px2 < ww; px2 += 34) R(px2, -8, 1, 176, C.s1);
    // ceiling with strip lights (calm band)
    R(0, -8, ww, 26, C.s1);
    for (var bx = 0; bx < ww; bx += 48) { R(bx + 4, 8, 34, 3, C.s0); R(bx + 6, 9, 30, 1, C.strip); R(bx + 6, 10, 30, 1, C.stripDk); }
    R(0, 17, ww, 2, C.s3); R(0, 17, ww, 1, C.s5); R(0, 19, ww, 1, C.s0);
    // overhead coolant pipes (teal) along the ceiling line
    pipeH(U, wall, 0, ww, 21, C.pipeTeal);
    // glass: cut out (ocean shows through) + frame ribs
    for (var x = gx0; x < gx1; x++) {
      var gt = glassTop(x);
      wall.rect(x, sy(gt), 1, 146 - gt, 0);
    }
    // outer frame
    for (x = gx0 - 6; x < gx1 + 6; x++) {
      var t2 = glassTop(Math.max(gx0, Math.min(gx1 - 1, x)));
      R(x, t2 - 6, 1, 6, C.frame); R(x, t2 - 6, 1, 1, C.frameLt); R(x, t2 - 1, 1, 1, C.frameRim);
    }
    R(gx0 - 6, 20, 6, 128, C.frame); R(gx0 - 6, 20, 1, 128, C.frameLt); R(gx0 - 1, 20, 1, 128, C.frameRim);
    R(gx1, 20, 6, 128, C.frame); R(gx1 + 5, 20, 1, 128, C.s0); R(gx1, 20, 1, 128, C.frameRim);
    // vertical ribs (curving in at the top) and one transom
    var ribs = 6;
    for (i = 1; i < ribs; i++) {
      var rx = Math.round(gx0 + (gx1 - gx0) * i / ribs);
      var tt = glassTop(rx);
      R(rx - 2, tt, 4, 146 - tt, C.frame); R(rx - 2, tt, 1, 146 - tt, C.frameLt); R(rx + 1, tt, 1, 146 - tt, C.frameRim);
      for (var b2 = tt + 6; b2 < 146; b2 += 14) { wall.set(rx - 1, sy(b2), c(C.rivet)); }
    }
    for (x = gx0; x < gx1; x++) { if (wall.get(x, sy(104)) === 0) { R(x, 103, 1, 2, C.frame); R(x, 103, 1, 1, C.frameRim); } }
    // console / parapet under the glass with a glowing trim line
    R(gx0 - 6, 146, gx1 - gx0 + 12, 22, C.s3);
    R(gx0 - 6, 146, gx1 - gx0 + 12, 1, C.glow); R(gx0 - 6, 147, gx1 - gx0 + 12, 1, C.glowDk);
    R(gx0 - 6, 148, gx1 - gx0 + 12, 2, C.s4); R(gx0 - 6, 150, gx1 - gx0 + 12, 1, C.s1);
    A.screens = [];
    for (x = gx0 + 8; x < gx1 - 24; x += 40) {
      R(x, 153, 22, 10, C.s0); R(x + 1, 154, 20, 8, '#0c2430'); A.screens.push(x + 1);
      R(x + 26, 155, 2, 2, C.ledG); R(x + 30, 155, 2, 2, C.ledA);
      for (var kk = 0; kk < 3; kk++) R(x + 26 + kk * 3, 159, 2, 1, C.s5);
    }
    R(gx0 - 6, 165, gx1 - gx0 + 12, 3, C.s1);

    // racks left and right of the glass
    A.leds = [];
    var rackY = 62, rackH = 104;
    var rackXs = [];
    for (x = gx0 - 10 - 30; x > -30; x -= 31) rackXs.push(x);
    for (x = gx1 + 10; x < ww; x += 31) rackXs.push(x);
    rackXs.forEach(function (x0, k) { rack(U, wall, x0, rackY, 30, rackH, rnd, A.leds, k); });
    // cable trays above the racks with drooping cables
    [[0, gx0 - 8], [gx1 + 8, ww]].forEach(function (seg) {
      R(seg[0], 52, seg[1] - seg[0], 3, C.s4); R(seg[0], 52, seg[1] - seg[0], 1, C.s6); R(seg[0], 55, seg[1] - seg[0], 1, C.s0);
      for (var hx = seg[0] + 8; hx < seg[1]; hx += 22) { R(hx, 26, 1, 26, C.s4); }
      for (var cb = 0; cb < 4; cb++) {
        var col = c(C.cable[cb]);
        for (var cx = seg[0]; cx < seg[1]; cx++) {
          var ph2 = ((cx - seg[0] + cb * 5) % 22) / 22, sag = Math.round(Math.sin(ph2 * Math.PI) * (2 + cb));
          wall.set(cx, sy(56 + cb + sag), col);
        }
      }
    });
    // big exhaust fans (housings; blades are animated sprites)
    A.fans = [Math.round(gx0 / 2 - 4), Math.round((gx1 + ww) / 2 + 4)];
    A.fans.forEach(function (fx) {
      wall.ellipse(fx, sy(39), 13, 13, c(C.s0)); wall.ellipse(fx, sy(39), 12, 12, c(C.s3));
      wall.ellipse(fx, sy(39), 10, 10, c(C.vent));
      R(fx - 14, 25, 28, 1, C.s5); R(fx - 14, 52, 28, 1, C.s0);
    });
    // labels: small plates above the racks
    U.text3(wall, 'DC-01', 6, sy(44), c(C.s6));
    U.text3(wall, 'R1 COOLING', ww - 48, sy(44), c(C.s6));
    // floor skirting with hazard stripes on the console foot
    R(0, 164, ww, 4, C.s1); R(0, 164, ww, 1, C.s4);
    A.wall = wall.toCanvas();

    // fan blade frames
    A.fan = U.frames(6, 21, 21, function (p, f) {
      var a0 = f / 6 * Math.PI / 2;
      for (var b = 0; b < 4; b++) {
        var a = a0 + b * Math.PI / 2;
        for (var r = 2; r < 10; r++) for (var w2 = -1.4; w2 <= 1.4; w2 += 0.7) {
          var aa = a + w2 / r * 1.6;
          p.set(Math.round(10 + Math.cos(aa) * r), Math.round(10 + Math.sin(aa) * r), c(r > 7 ? C.s5 : C.s4));
        }
      }
      p.ellipse(10.5, 10.5, 2.5, 2.5, c(C.s6)); p.set(10, 10, c(C.s7));
    });

    // LED overlay frames (16): each LED has its own blink rhythm
    A.ledFrames = U.frames(16, ww, 176, function (p, f) {
      A.leds.forEach(function (L) {
        var on;
        if (L.kind === 0) on = true;                                    // power: steady
        else if (L.kind === 1) on = ((f + L.ph) % L.per) < (L.per >> 1);   // heartbeat
        else on = U.hash(f + L.ph * 3, L.x * 7 + L.y) < 0.55;             // disk activity
        p.set(L.x, L.y, on ? c(L.col) : c(C.ledOff));
        if (on && L.kind === 0) p.set(L.x + 1, L.y, c(L.col));
      });
    });

    // caustics: tiles; wall overlay (racks/console only, additive) + floor frames
    var tiles = causticTiles(8);
    var cA = c('#0a1e22'), cB = c('#143438'), cG = c('#06141a');
    var lo = sy(62);
    A.wallCaustic = U.frames(8, ww, 176, function (p, f) {
      var T = tiles[f];
      for (var y = sy(36); y < sy(168); y++) for (var x = 0; x < ww; x++) {
        if (y < lo && !(x > gx0 && x < gx1)) continue;
        if (x > gx0 - 8 && x < gx1 + 8 && y < sy(146)) {
          var gd = (x + y * 0.6) % 90;
          if ((gd < 3 || (gd > 7 && gd < 9)) && y > sy(40)) p.set(x, y, cG);
          continue;
        }
        var v = T[((y * 2) & 63) * 64 + ((x * 2 + (y >> 1)) & 63)];
        if (v === 2 && U.dith(x, y, 10)) p.set(x, y, cA);
      }
    });
    A.floor = floorFrames(U, tiles);

    // ------------------------------------------------------------ coolant tanks (0.9) + holo sign (0.88)
    A.fT = U.floorScale(YH, 175);
    A.tank = tank(U);
    A.fHolo = 0.88;
    A.holo = holoFrames(U);
    // bottom pipe (front)
    A.fP = 1.25;
    var pw = U.layerW(A.fP), pipe = U.pix(pw, 30);
    pipeH(U, pipe, 0, pw, 8, C.pipe, 12);
    for (x = 20; x < pw; x += 74) {
      pipe.rect(x, 6, 5, 16, c(C.pipe[2])); pipe.rect(x, 6, 1, 16, c(C.pipe[0])); pipe.rect(x + 4, 6, 1, 16, c(C.pipe[3]));
      pipe.set(x + 2, 8, c(C.rivet)); pipe.set(x + 2, 18, c(C.rivet));
    }
    for (x = 50; x < pw; x += 148) {                                    // valve wheels
      pipe.rect(x, 2, 2, 6, c(C.pipe[2]));
      pipe.rect(x - 5, 0, 12, 2, c(C.warn)); pipe.rect(x - 5, 1, 12, 1, c(C.warnDk));
    }
    A.pipe = pipe.toCanvas();
    return A;
  }

  // ================================================================== painters
  function whale(U, p, f, sc, body, top, belly) {
    var c = U.col, L = 118 * sc, H2 = 15 * sc, cy = p.h / 2;
    var flap = [0, 1, 0, -1][f];
    for (var x = 0; x < L; x++) {
      var k = x / L;                                                 // 0 = head (left), 1 = tail
      var th = k < 0.12 ? Math.sqrt(k / 0.12) * 0.9 : k < 0.45 ? 1 : Math.max(0.12, 1 - (k - 0.45) / 0.55 * 0.88);
      var hh = H2 * th, yo = Math.round(flap * Math.max(0, k - 0.6) * 10 * sc);
      var y0 = Math.round(cy - hh * 0.9) + yo, y1 = Math.round(cy + hh * 0.75) + yo;
      p.rect(Math.round(x + 2), y0, 1, y1 - y0, c(body));
      p.set(Math.round(x + 2), y0, c(top));
      if (sc > 0.4 && k > 0.15 && k < 0.7 && U.dith(x, y0 + 1, 6)) p.set(Math.round(x + 2), y0 + 1, c(top));
      if (k > 0.05 && k < 0.6) {
        var bh = Math.max(1, Math.round(hh * 0.35));
        p.rect(Math.round(x + 2), y1 - bh, 1, bh, c(belly));
        if (sc > 0.4 && k < 0.4) for (var gy = y1 - bh; gy < y1; gy += 2) p.set(Math.round(x + 2), gy, c(body));   // throat grooves
      }
    }
    // flukes
    var tx = Math.round(L + 1), ty = Math.round(cy + flap * 4 * sc);
    for (var j = 0; j < 8 * sc + 1; j++) {
      p.rect(tx - Math.round(j * 0.6), ty - Math.round(j), Math.max(1, Math.round(4 * sc)), 1, c(body));
      p.rect(tx - Math.round(j * 0.6), ty + Math.round(j), Math.max(1, Math.round(4 * sc)), 1, c(body));
    }
    // pectoral fin + eye
    var fx = Math.round(L * 0.28), fy = Math.round(cy + H2 * 0.6);
    for (j = 0; j < 9 * sc; j++) p.rect(fx + Math.round(j * 0.9), fy + Math.round(j * 0.5), Math.max(1, Math.round(3 * sc)), 1, c(body));
    if (sc > 0.4) p.set(Math.round(L * 0.1) + 2, Math.round(cy), c(top));
  }

  function rack(U, P, x0, y0, w, h, rnd, leds, k) {
    var c = U.col, Y = y0 + 8;
    P.rect(x0, Y, w, h, c(C.rackDk));
    P.rect(x0 + 1, Y + 1, w - 2, h - 2, c(C.rack));
    P.rect(x0 + 1, Y + 1, w - 2, 4, c(C.rackLt)); P.rect(x0 + 1, Y + 1, w - 2, 1, c(C.s6));     // top cap, lit from above
    U.text3(P, (k < 9 ? 'A' : 'B') + ((k % 9) + 1), x0 + 3, Y + 7, c(C.s5));
    P.rect(x0 + w - 7, Y + 8, 4, 2, c(C.s4));
    var y = Y + 14;
    while (y < Y + h - 10) {
      var kind = rnd(), uh;
      if (kind < 0.45) {                                               // 2U server: vents + led column
        uh = 6;
        P.rect(x0 + 2, y, w - 4, uh - 1, c(C.bezel)); P.rect(x0 + 2, y, w - 4, 1, c(C.s5));
        for (var vx = x0 + 4; vx < x0 + w - 9; vx += 2) P.rect(vx, y + 2, 1, 2, c(C.vent));
        leds.push({ x: x0 + w - 6, y: y + 2, col: C.ledC, kind: 0, per: 0, ph: 0 });
        leds.push({ x: x0 + w - 4, y: y + 2, col: rnd() < 0.8 ? C.ledG : C.ledA, kind: 2, per: 0, ph: (rnd() * 16) | 0 });
      } else if (kind < 0.7) {                                         // drive bays
        uh = 8;
        P.rect(x0 + 2, y, w - 4, uh - 1, c(C.s3));
        for (var dx = x0 + 3; dx < x0 + w - 4; dx += 3) {
          P.rect(dx, y + 1, 2, uh - 3, c(C.bezel)); P.set(dx, y + 1, c(C.s6));
          if (rnd() < 0.5) leds.push({ x: dx + 1, y: y + uh - 3, col: C.ledG, kind: 2, per: 0, ph: (rnd() * 16) | 0 });
        }
      } else if (kind < 0.85) {                                        // patch panel with cables
        uh = 5;
        P.rect(x0 + 2, y, w - 4, uh - 1, c(C.s1));
        for (var px = x0 + 3; px < x0 + w - 3; px += 2) {
          P.set(px, y + 1, c(C.s5));
          P.rect(px, y + 2, 1, 2 + ((rnd() * 2) | 0), c(C.cable[(rnd() * C.cable.length) | 0]));
        }
      } else {                                                         // 1U switch with a led row
        uh = 4;
        P.rect(x0 + 2, y, w - 4, uh - 1, c(C.bezel));
        for (var lx = x0 + 4; lx < x0 + w - 4; lx += 2) leds.push({ x: lx, y: y + 1, col: C.ledC, kind: 1, per: 6 + ((rnd() * 6) | 0), ph: (rnd() * 16) | 0 });
      }
      y += uh;
    }
    // bottom vent grille + feet
    for (var gy = Y + h - 9; gy < Y + h - 2; gy += 2) P.rect(x0 + 3, gy, w - 6, 1, c(C.vent));
    // glass door: reflection streak + hinge side
    for (var j = 0; j < h - 4; j++) { var rx = x0 + 4 + Math.round(j * 0.25) % (w - 8); if ((j >> 3) % 3 === 0) P.set(rx, Y + 2 + j, c(C.s5)); }
    P.rect(x0 + 1, Y + 1, 1, h - 2, c(C.s4));
  }

  function pipeH(U, P, x0, x1, y, ramp, thick) {
    var c = U.col; thick = thick || 6;
    var rows = thick === 6 ? [0, 1, 1, 2, 2, 3] : [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3];
    for (var r = 0; r < thick; r++) P.rect(x0, y + 8 + r - (P.h === 30 ? 8 : 0), x1 - x0, 1, c(ramp[rows[r]]));
    for (var x = x0 + 30; x < x1; x += 62) {                             // flanges
      for (r = -1; r <= thick; r++) P.rect(x, y + 8 + r - (P.h === 30 ? 8 : 0), 3, 1, c(r < thick / 2 ? ramp[1] : ramp[3]));
    }
  }

  function tank(U) {
    var c = U.col, p = U.pix(22, 80);
    // caps
    p.rect(1, 0, 20, 5, c(C.pipe[1])); p.rect(1, 0, 20, 1, c(C.pipe[0])); p.rect(1, 4, 20, 1, c(C.pipe[3]));
    p.rect(1, 74, 20, 6, c(C.pipe[1])); p.rect(1, 74, 20, 1, c(C.pipe[0])); p.rect(1, 79, 20, 1, c(C.pipe[3]));
    // glass cylinder with coolant (lit from inside)
    for (var x = 3; x < 19; x++) {
      var k = Math.abs(x - 10.5) / 8;
      var col = k > 0.85 ? C.coolantDk : k > 0.55 ? '#166c7a' : C.coolant;
      p.rect(x, 5, 1, 69, c(col));
    }
    p.rect(3, 5, 16, 6, c('#0e3c48')); p.rect(3, 11, 16, 1, c(C.coolantLt));       // meniscus
    p.rect(6, 12, 1, 60, c('#3cb0bc')); p.rect(7, 14, 1, 40, c('#7ad8e0'));          // glass glints
    p.rect(1, 5, 2, 69, c(C.pipe[2])); p.rect(19, 5, 2, 69, c(C.pipe[3]));            // frame posts
    p.rect(1, 38, 20, 2, c(C.pipe[2])); p.rect(1, 38, 20, 1, c(C.pipe[0]));
    p.outline(c(C.s0));
    return p.toCanvas();
  }

  function holoFrames(U) {
    var c = U.col, txt = '服务器正常', tw = U.textW(txt, 12, 1), w = tw + 16, h = 30;
    return U.frames(3, w, h, function (p, f) {
      var main = f === 1 ? C.holoDk : C.holo, dim = C.glowDk;
      // frame brackets
      p.rect(0, 0, 5, 1, c(dim)); p.rect(0, 0, 1, 5, c(dim)); p.rect(w - 5, 0, 5, 1, c(dim)); p.rect(w - 1, 0, 1, 5, c(dim));
      p.rect(0, h - 1, 5, 1, c(dim)); p.rect(0, h - 5, 1, 5, c(dim)); p.rect(w - 5, h - 1, 5, 1, c(dim)); p.rect(w - 1, h - 5, 1, 5, c(dim));
      U.text(p, txt, 8, 3, 12, c(main), 1);
      // status line: dot + ONLINE + bar
      p.rect(8, 20, 3, 3, c(C.ledG));
      U.text3(p, 'ONLINE  99.9%', 14, 19, c(main));
      for (var x = 8; x < w - 8; x += 2) p.set(x, 25, c(dim));
      // scanlines: every other row dimmed
      for (var y = 1; y < h; y += 2) for (x = 0; x < w; x++) if (p.get(x, y) === c(C.holo)) p.set(x, y, c(C.holoDk));
      if (f === 2) {                                                     // glitch frame: shifted rows
        for (y = 6; y < 11; y++) { for (x = w - 1; x >= 3; x--) p.set(x, y, p.get(x - 3, y)); }
      }
    });
  }

  function floorFrames(U, tiles) {
    var c = U.col, fl = C.fl.map(c), seam = c(C.flSeam), slot = c(C.flSlot), hi = c(C.flHi), wet = c(C.wet), wetHi = c(C.wetHi), wetHi2 = c(C.wetHi2), rivet = c(C.rivet);
    var warn = c(C.warn), warnDk = c(C.warnDk);
    var cA = [0, c('#22344e')], cW = [0, c('#2c5c6a')];
    var base = U.buildFloor(168, 224, YH, function (X, y, s) {
      var z = 1 / s, pz = Math.floor(z / 0.34), px = Math.floor(X / 48), fx = X - px * 48;
      var wetA = Math.sin(X / 37 + Math.sin(z * 5) * 1.5) + Math.sin(X / 13 + z * 9) * 0.5;
      var isWet = wetA > 1.05 && y > 172;
      // hazard strip along the far edge
      if (y === 169 || y === 170) return ((Math.floor(X / 6) & 1) ? warn : warnDk);
      if (y === 168) return seam;
      if (fx < 1 / s) return seam;                                    // panel seam (converging lines)
      var zf = z / 0.34 - pz;
      if (zf * 0.34 * (186 - YH) * s * s < 0.7) return seam;          // panel joint (row)
      if (fx < 4 && zf < 0.18 && fx > 1.5) return rivet;
      var tone = fl[(U.hash(px, pz) * 3) | 0];
      // central grating band in each panel: horizontal slots (row-stable, no moiré)
      if (fx > 10 && fx < 38 && zf > 0.25 && zf < 0.8) tone = (y & 1) ? slot : tone;
      var gl = Math.abs(X - 320);
      if (y >= 171 && y < 184 && gl < 128 && !isWet) {
        var rib = ((X - 196) / (248 / 6)) % 1, ribD = Math.min(rib, 1 - rib) * 41;
        if (ribD > 2.5 && (y & 1) && (y < 178 || U.dith(Math.round(X * s), y, 16 - (y - 178) * 2))) tone = y < 175 ? wetHi2 : wetHi;
      }
      if (isWet) {
        tone = wet;
        if (y < 186 && Math.abs(X - 320) < 170 && (y & 1)) tone = wetA > 1.3 ? wetHi2 : wetHi;   // reflections of the glass wall
      } else if (fx > 1 && fx < 2.5) tone = hi;
      if (y > 212 && U.dith(Math.round(X * s), y, (y - 212) * 2)) tone = seam;
      return tone;
    });
    // 8 caustic variants: hot lines lighten the floor (sampled in world space, so they sit on the plane)
    var out = [];
    for (var f = 0; f < 8; f++) {
      var px2 = U.pix(base.pix.w, base.pix.h), T = tiles[f];
      px2.d.set(base.pix.d);
      for (var y = 168; y < 224; y++) {
        var s = U.floorScale(YH, y), z = 1 / s, row = (y - 168) * px2.w;
        var tz = Math.floor(z * 90) & 63;
        for (var u = 0; u < px2.w; u++) {
          var X = (u + 0.5 - U.FLOOR_U0) / s, v = T[tz * 64 + (Math.floor(X * 0.7) & 63)];
          if (v !== 2) continue;
          var cur = px2.d[row + u];
          if (cur === seam) continue;
          px2.d[row + u] = (cur === wet || cur === wetHi || cur === wetHi2) ? cW[v - 1] : cA[v - 1];
        }
      }
      out.push(px2.toCanvas());
    }
    base.frames = out;
    return base;
  }

  // ================================================================== instance
  function setup(st, A, U) {
    var rnd = st.rnd, i;
    st.snow = [];
    for (i = 0; i < 40; i++) st.snow.push({ x: rnd() * 420, y: rnd() * 160, v: 0.04 + rnd() * 0.06, f: 0.05 + rnd() * 0.25 });
    st.fish = [];
    for (i = 0; i < 2; i++) {
      var sc = { x: rnd() * 500, y: 60 + rnd() * 50, dir: i ? 1 : -1, n: [] };
      for (var k = 0; k < 16; k++) sc.n.push({ ox: (rnd() - 0.5) * 34, oy: (rnd() - 0.5) * 12, ph: rnd() * 6.28 });
      st.fish.push(sc);
    }
    st.bub = [];
    for (i = 0; i < 18; i++) st.bub.push({ t: i % 2, y: 72 * rnd(), x: 3 + rnd() * 12, v: 0.25 + rnd() * 0.35 });
    st.flicker = 0; st.alarm = 0; st.glitch = 0;
    st.whaleT = 0;

    var L = [];
    L.push({ name: 'ocean', draw: function (g, cam, s) {
      U.layer(g, A.ocean, A.fO, cam);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(A.rays, -8 - Math.round(cam * A.fO) - 30 + Math.round(Math.sin(s.t / 160) * 6), -8);
      g.globalCompositeOperation = 'source-over';
    } });
    L.push({ name: 'whales', draw: function (g, cam, s) {
      // far pod (tiny), then the big whale + calf gliding right→left across the glass
      var t = s.t, f4 = (t >> 4) & 3;
      var fx = 520 - ((t * 0.12 + 200) % 760);
      g.drawImage(A.farWhale[f4], Math.round(fx - cam * 0.05), 62);
      g.drawImage(A.farWhale[(f4 + 2) & 3], Math.round(fx + 26 - cam * 0.05), 70);
      var per = 4200, ph = (t + 1500) % per;
      var wx = 470 - ph * 0.17 - cam * 0.07, wy = 70 + Math.sin(t / 200) * 4;
      g.drawImage(A.whale[(t >> 5) & 3], Math.round(wx), Math.round(wy));
      g.drawImage(A.calf[((t >> 4) + 1) & 3], Math.round(wx + 96), Math.round(wy + 30 + Math.sin(t / 150) * 3));
    } });
    L.push({ name: 'seabed', draw: function (g, cam, s) {
      U.layer(g, A.bed, A.fB, cam);
      if ((s.t % 120) < 12) { g.fillStyle = '#ff7060'; g.fillRect(A.beacon[0] - 8 - Math.round(cam * A.fB), A.beacon[1] - 8, 2, 1); }
    } });
    L.push({ name: 'kelp', draw: function (g, cam, s) {
      g.drawImage(A.kelp[((s.t / 20) | 0) % 6], -8 - Math.round(cam * A.fK), 54);
    } });
    L.push({ name: 'jellies', draw: function (g, cam, s) {
      for (var i = 0; i < 3; i++) {
        var ph = (s.t * 0.06 + i * 70) % 210, f = 0.16 + i * 0.05;
        var x = Math.round([210, 330, 430][i] - cam * f + Math.sin(s.t / 120 + i) * 6), y = Math.round(150 - ph);
        if (y > 22 && y < 140) g.drawImage(A.jelly[((s.t >> 4) + i) & 3], x, y);
      }
    } });
    L.push({ name: 'fish', draw: function (g, cam, s) {
      g.fillStyle = C.fish;
      for (var i = 0; i < s.fish.length; i++) {
        var sc = s.fish[i];
        var bx = sc.x - cam * 0.3;
        for (var k = 0; k < sc.n.length; k++) {
          var n = sc.n[k];
          var x = Math.round(bx + n.ox + Math.sin(s.t / 40 + n.ph) * 2), y = Math.round(sc.y + n.oy + Math.sin(s.t / 25 + n.ph) * 1.5);
          g.fillRect(x, y, 2, 1);
          g.fillRect(sc.dir < 0 ? x + 2 : x - 1, y + ((s.t >> 3) + k & 1 ? -1 : 0), 1, 1);
        }
      }
      g.fillStyle = C.snow;
      for (i = 0; i < s.snow.length; i++) {
        var m = s.snow[i];
        g.fillRect(Math.round(((m.x - cam * m.f) % 420 + 420) % 420 - 10), Math.round(m.y), 1, 1);
      }
    } });
    L.push({ name: 'wall', draw: function (g, cam, s) {
      var ox = -8 - Math.round(cam * A.FW);
      g.drawImage(A.wall, ox, -8);
      g.drawImage(A.ledFrames[s.alarm ? (s.t >> 2) & 15 : ((s.t >> 3) & 15)], ox, -8);
      if (s.alarm && (s.t & 8)) {
        g.fillStyle = C.ledR;
        for (var i = 0; i < A.leds.length; i += 3) g.fillRect(ox + A.leds[i].x, A.leds[i].y - 8, 1, 1);
      }
      g.globalCompositeOperation = 'lighter';
      g.drawImage(A.wallCaustic[((s.t / 9) | 0) & 7], ox, -8);
      g.globalCompositeOperation = 'source-over';
      var ff = ((s.t >> 1) % 6);
      for (i = 0; i < A.fans.length; i++) g.drawImage(A.fan[(ff + i * 2) % 6], ox + A.fans[i] - 10, 39 - 10);
      // console screens: scrolling throughput graph
      for (i = 0; i < A.screens.length; i++) {
        var sx = ox + A.screens[i];
        g.fillStyle = C.glowDk;
        for (var k = 0; k < 20; k += 1) {
          var v = Math.round(3 + 2.5 * Math.sin((k + s.t / 6 + i * 9) / 3) + 1.5 * Math.sin((k * 7 + s.t / 4 + i) / 5));
          g.fillRect(sx + k, 145 + 8 - v - 8 + 8, 1, 1);
          if ((k & 3) === 0) g.fillRect(sx + k, 153, 1, 1);
        }
        g.fillStyle = C.glow;
        g.fillRect(sx + ((s.t >> 2) % 20), 147, 1, 6);
      }
    } });
    L.push({ name: 'floor', draw: function (g, cam, s) { U.drawFloor(g, A.floor, cam, A.floor.frames[((s.t / 9) | 0) & 7]); } });
    L.push({ name: 'tanks', draw: function (g, cam, s) {
      [128, 512].forEach(function (X, i) {
        var x = Math.round(U.sx(X, A.fT, cam)) - 11, y = 175 - 80;
        g.drawImage(A.tank, x, y);
        g.fillStyle = C.coolantLt;
        for (var k = 0; k < s.bub.length; k++) {
          var b = s.bub[k];
          if (b.t !== i) continue;
          var by = y + 72 - Math.round(b.y);
          if (by > y + 12) g.fillRect(x + Math.round(b.x + Math.sin((s.t + k * 20) / 12)), by, (k & 3) ? 1 : 2, (k & 3) ? 1 : 2);
        }
      });
    } });
    L.push({ name: 'holo', draw: function (g, cam, s) {
      var fr = s.glitch > 0 ? 2 : ((s.t % 233) < 4 ? 2 : ((s.t % 97) < 3 ? 1 : 0));
      if (s.flicker && (s.t & 4)) return;
      var im = A.holo[fr];
      g.drawImage(im, Math.round(U.sx(320, A.fHolo, cam) - im.width / 2) + (fr === 2 ? 1 : 0), 40 + Math.round(Math.sin(s.t / 50)));
    } });
    L.push({ name: 'lights', draw: function (g, cam, s) {
      // 'super' flicker: the room drops to emergency darkness for a few frames
      if (s.flicker > 0 && ((s.t >> 1) & 3) !== 0 && (s.flicker > 30 || (s.t & 8))) {
        g.fillStyle = 'rgba(4,6,18,0.55)'; g.fillRect(-8, -8, 400, 232);
      }
    } });
    L.push({ name: 'pipe', front: true, draw: function (g, cam) { g.drawImage(A.pipe, -8 - Math.round(cam * A.fP), 203); } });
    return L;
  }

  function update(st, A, U) {
    var i, rnd = st.rnd;
    for (i = 0; i < st.snow.length; i++) { var m = st.snow[i]; m.y += m.v; if (m.y > 150) { m.y = 20; m.x = rnd() * 420; } }
    for (i = 0; i < st.fish.length; i++) {
      var sc = st.fish[i];
      sc.x += sc.dir * 0.22; sc.y += Math.sin(st.t / 90 + i) * 0.05;
      if (sc.x < -120) sc.x = 620; if (sc.x > 620) sc.x = -120;
    }
    for (i = 0; i < st.bub.length; i++) { var b = st.bub[i]; b.y += b.v; if (b.y > 62) { b.y = 0; b.x = 3 + rnd() * 12; } }
    if (st.flicker > 0) st.flicker--;
    if (st.alarm > 0) st.alarm--;
    if (st.glitch > 0) st.glitch--;
  }

  function event(st, A, name, data) {
    if (name === 'super') { st.flicker = 50; st.glitch = 20; }
    else if (name === 'ko') { st.flicker = 40; st.alarm = 180; st.glitch = 30; }
    else if (name === 'hit' && (data.power || 0) >= 0.6) { st.glitch = 8; }
    else if (name === 'roundStart') { st.glitch = 16; }
  }

  LC.stages.define('abyss', { music: 'stage.abyss', shadowColor: 'rgba(2,6,20,0.55)', build: build, setup: setup, update: update, event: event });
})();
