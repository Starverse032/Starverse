/* LATENT CLASH — FX tiny glyphs (owned by FX).
 * Own micro bitmap fonts so effects never depend on LC.font being ready:
 * a 3x5 Latin/digit set (text-line and beam glyph streams), 7x7 hanzi for the
 * haiku seals (五/七), 5x7 "R1" for the whale. Glyph atlases are baked per
 * colour on demand and cached. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};

  var F35 = {
    A: '.#.#.####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.', E: '####..##.#..###',
    F: '####..##.#..#..', G: '.###..#.##.#.##', H: '#.##.####.##.##', I: '###.#..#..#.###', J: '..#..#..##.#.#.',
    K: '#.##.###.#.##.#', L: '#..#..#..#..###', M: '#.#####.##.##.#', N: '##.#.##.##.##.#', O: '.#.#.##.##.#.#.',
    P: '##.#.###.#..#..', Q: '.#.#.##.###..##', R: '##.#.###.#.##.#', S: '.###...#...###.', T: '###.#..#..#..#.',
    U: '#.##.##.##.####', V: '#.##.##.##.#.#.', W: '#.##.#######.##', X: '#.##.#.#.#.##.#', Y: '#.##.#.#..#..#.',
    Z: '###..#.#.#..###', '0': '####.##.##.####', '1': '.#.##..#..#.###', '2': '##...#.#.#..###', '3': '##...#.#...###.',
    '4': '#.##.####..#..#', '5': '####..##...###.', '6': '.###..##.#.#.#.', '7': '###..#.#..#..#.', '8': '.#.#.#.#.#.#.#.',
    '9': '.#.#.#.##..###.', '.': '............#..', ',': '..........#.#..', '-': '......###......', '!': '.#..#..#.....#.',
    '?': '##...#.#.....#.', ':': '....#.....#....', "'": '.#..#..........', '/': '..#..#.#.#..#..', '+': '....#.###.#....',
    '=': '...###...###...', '<': '..#.#.#...#...#', '>': '#...#...#.#.#..', '(': '.#.#..#..#...#.', ')': '.#...#..#..#.#.',
    '*': '#.#.#.#.#......', '#': '#.####.#.####.#', ' ': '...............'
  };
  var ORDER = Object.keys(F35);
  var GI = {}; ORDER.forEach(function (k, i) { GI[k] = i; });
  I.GLYPHS = ORDER; I.glyphIndex = function (ch) { var i = GI[ch.toUpperCase()]; return i === undefined ? GI[' '] : i; };
  I.LETTERS = ORDER.slice(0, 26).map(function (k) { return GI[k]; });
  I.DIGITS01 = [GI['0'], GI['1']];

  /** Draw a 3x5 glyph into a Buf. */
  I.glyph35 = function (buf, ch, x, y, c) {
    var s = F35[ch] || F35[ch.toUpperCase()] || F35[' '];
    for (var i = 0; i < 15; i++) if (s.charAt(i) === '#') buf.set(x + (i % 3), y + Math.floor(i / 3), c);
  };
  /** Draw a 3x5 string; returns the width. */
  I.text35 = function (buf, str, x, y, c, gap) {
    gap = gap == null ? 1 : gap;
    for (var i = 0; i < str.length; i++) I.glyph35(buf, str.charAt(i), x + i * (3 + gap), y, c);
    return str.length * (3 + gap) - gap;
  };

  // 7x7 seal hanzi and 5x7 whale letters
  var BIG = {
    '五': ['#######', '..#....', '..#....', '.#####.', '.#...#.', '.#...#.', '#######'],
    '七': ['..#....', '..#...#', '.#####.', '#.#....', '..#....', '..#...#', '...###.'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###']
  };
  I.bigGlyph = function (buf, ch, x, y, c) {
    var g = BIG[ch];
    if (!g) return 0;
    for (var j = 0; j < g.length; j++) for (var i = 0; i < g[j].length; i++) if (g[j].charAt(i) === '#') buf.set(x + i, y + j, c);
    return g[0].length;
  };

  /**
   * Seal glyph bitmap for 五/七: uses LC.font (size 8) if it renders the glyph,
   * else our 7x7 bitmap. Returns a Buf mask (1 = ink), 7x7..8x8.
   */
  var sealMasks = {};
  I.sealMask = function (ch) {
    if (sealMasks[ch]) return sealMasks[ch];
    var mask = null;
    try {
      if (LC.font && typeof LC.font.draw === 'function' && LC.font.ready !== false) {
        var cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
        var g = cv.getContext('2d');
        LC.font.draw(g, ch, 0, 0, { size: 8, color: '#ffffff' });
        var d = g.getImageData(0, 0, 16, 16).data, b = null, x0 = 16, y0 = 16, x1 = -1, y1 = -1;
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) if (d[(y * 16 + x) * 4 + 3] > 128) {
          if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
        }
        var w = x1 - x0 + 1, h = y1 - y0 + 1;
        if (x1 >= 0 && w >= 5 && h >= 5 && w <= 9 && h <= 9) {
          b = new I.Buf(w, h);
          for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (d[((y + y0) * 16 + x + x0) * 4 + 3] > 128) b.d[y * w + x] = 1;
          mask = b;
        }
      }
    } catch (err) { console.error('[fx] LC.font seal glyph failed, using built-in', err); mask = null; }
    if (!mask) {
      mask = new I.Buf(7, 7);
      I.bigGlyph(mask, ch, 0, 0, 1);
    }
    sealMasks[ch] = mask;
    return mask;
  };

  // ---- glyph atlases per colour (cell 4x6, glyph 3x5) ---------------------------
  var atlases = {};
  I.glyphAtlas = function (css) {
    var a = atlases[css];
    if (a) return a;
    var b = new I.Buf(ORDER.length * 4, 5), c = I.col(css);
    for (var i = 0; i < ORDER.length; i++) I.glyph35(b, ORDER[i], i * 4, 0, c);
    a = atlases[css] = I.toCanvas(b);
    return a;
  };

  // GLYPH particle: one 3x5 glyph (p.a = glyph index) drifting; colour through ramp
  I.K_GLYPH = I.kind('glyph', {
    draw: function (ctx, p, sx, sy) {
      var css = I.rampAt(p, p.ramp);
      var k = p.age / p.life;
      if (k > 0.8 && ((p.age + p.seq) & 1)) return;     // flicker out
      ctx.drawImage(I.glyphAtlas(css), p.a * 4, 0, 3, 5, sx - 1, sy - 2, 3, 5);
    },
    step: function (p) { if (p.d) p.x += Math.sin(p.age * p.d + p.e) * 0.35; }
  });
  I.glyphP = function (x, y, gi, vx, vy, life, rampCss, layer) {
    var p = I.add(I.K_GLYPH, x, y, layer);
    p.a = gi; p.vx = vx; p.vy = vy; p.life = life; p.ramp = rampCss;
    return p;
  };

  // TEXTLINE particle: a short line of glyph *blocks* (verse line), p.a = word seed,
  // p.b = number of blocks; spirals around (p.c) with radius p.d.
  I.K_TEXTLINE = I.kind('textline', {
    draw: function (ctx, p, sx, sy) {
      var k = p.age / p.life, r = p.ramp;
      var n = p.b, cut = k > 0.55 ? Math.floor((k - 0.55) / 0.45 * n) : 0;   // eaten from the tail
      var ci = k < 0.2 ? 0 : k < 0.5 ? 1 : k < 0.8 ? 2 : 3;
      if (ci >= r.length) ci = r.length - 1;
      var atlas = I.glyphAtlas(r[ci]);
      var dir = p.facing;
      for (var i = cut; i < n; i++) {
        var gi = I.LETTERS[(p.a + i * 7) % 26];
        var gx = dir > 0 ? sx - (n - i) * 4 : sx + (n - i - 1) * 4;
        ctx.drawImage(atlas, gi * 4, 0, 3, 5, gx, sy - 2, 3, 5);
      }
      // underline cursor at the head
      ctx.fillStyle = r[Math.min(ci + 1, r.length - 1)];
      ctx.fillRect(dir > 0 ? sx : sx - 4, sy + 3, 3, 1);
    },
    step: function (p) {
      // p.rot = spiral centre x (drifts with vx); orbit radius p.d, angular speed p.c, phase p.e
      p.rot += p.vx;
      p.x = p.rot + Math.cos(p.e + p.age * p.c) * p.d;
    }
  });
  /** Spawn a verse line that spirals around centre x while rising. */
  I.textLine = function (x, y, blocks, vy, life, rampCss, facing, layer) {
    var p = I.add(I.K_TEXTLINE, x, y, layer);
    p.rot = x; p.a = Math.floor(I.R() * 26); p.b = blocks; p.vy = vy; p.life = life; p.ramp = rampCss;
    p.facing = facing < 0 ? -1 : 1; p.c = 0.18 * p.facing; p.d = 4; p.e = I.R() * 6.28; p.drag = 0.94;
    return p;
  };
})();
