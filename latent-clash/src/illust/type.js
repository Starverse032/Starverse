/* LATENT CLASH — ILLUST lettering: an arcade block font + announcer banners.
 * Glyphs live on a 5x7 cell grid. Cell codes: '#' full, '.' empty, and 45° half cells:
 *   b = ◢ (lower-right filled)  d = ◣ (lower-left)  p = ◥ (upper-right)  q = ◤ (upper-left)
 * A word is rasterised at any cell size, sheared to italic, filled with colour bands, bevelled,
 * double-outlined and given a drop shadow — all as hard-edged slot pixels (no AA). */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit;
  var T = I.TYPE = {};

  var G = {
    A: ['b###d', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    B: ['####d', '#...#', '#...q', '####.', '#...b', '#...#', '####q'],
    C: ['b###d', '#...#', '#....', '#....', '#....', '#...#', 'p###q'],
    D: ['####d', '#...#', '#...#', '#...#', '#...#', '#...#', '####q'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['b###d', '#...#', '#....', '#.###', '#...#', '#...#', 'p###q'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    J: ['....#', '....#', '....#', '....#', '#...#', '#...#', 'p###q'],
    K: ['#...#', '#..bq', '#.bq.', '##q..', '#.pd.', '#..pd', '#...#'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#d.b#', '##d##', '#p#q#', '#...#', '#...#', '#...#', '#...#'],
    N: ['#d..#', '#pd.#', '#.pd#', '#..p#', '#...#', '#...#', '#...#'],
    O: ['b###d', '#...#', '#...#', '#...#', '#...#', '#...#', 'p###q'],
    P: ['####d', '#...#', '#...#', '####q', '#....', '#....', '#....'],
    Q: ['b###d', '#...#', '#...#', '#...#', '#.d.#', '#.pd#', 'p###d'],
    R: ['####d', '#...#', '#...#', '####q', '#.pd.', '#..pd', '#...#'],
    S: ['b###d', '#...#', '#....', 'p###d', '....#', '#...#', 'p###q'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', 'p###q'],
    V: ['#...#', '#...#', '#...#', '#...#', '#...#', 'pd.bq', '.p#q.'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##b##', '#q.p#'],
    X: ['#...#', 'pd.bq', '.pbq.', '..#..', '.bqd.', 'bq.pd', '#...#'],
    Y: ['#...#', '#...#', 'pd.bq', '.p#q.', '..#..', '..#..', '..#..'],
    Z: ['#####', '...bq', '..bq.', '.bq..', 'bq...', '#....', '#####'],
    0: ['b###d', '#...#', '#..b#', '#.bq#', '#bq.#', '#...#', 'p###q'],
    1: ['.b#.', 'b##.', '..#.', '..#.', '..#.', '..#.', '####'],
    2: ['b###d', '#...#', '...bq', '..bq.', '.bq..', 'bq...', '#####'],
    3: ['b###d', '#...#', '....#', '.###q', '....#', '#...#', 'p###q'],
    4: ['...b#', '..bq#', '.bq.#', 'bq..#', '#####', '....#', '....#'],
    5: ['#####', '#....', '####d', '....#', '....#', '#...#', 'p###q'],
    6: ['b###d', '#....', '#....', '####d', '#...#', '#...#', 'p###q'],
    7: ['#####', '....#', '...bq', '..bq.', '..#..', '..#..', '..#..'],
    8: ['b###d', '#...#', 'p###q', 'b###d', '#...#', '#...#', 'p###q'],
    9: ['b###d', '#...#', '#...#', 'p####', '....#', '#...#', 'p###q'],
    '.': ['..', '..', '..', '..', '..', '##', '##'],
    '!': ['##', '##', '##', '##', '#q', '..', '##'],
    ' ': ['..', '..', '..', '..', '..', '..', '..']
  };
  T.GLYPHS = G;

  // pixel inside a code cell? (u,v) in [0,1) cell-local pixel-centre coords
  function inCell(ch, u, v) {
    switch (ch) {
      case '#': return true;
      case 'b': return u + v >= 1;
      case 'd': return v >= u;
      case 'p': return u >= v;
      case 'q': return u + v <= 1;
    }
    return false;
  }
  // rasterise a string into a Mask. cell px, gap = cells between glyphs. Returns {mask, w, h}
  T.textMask = function (text, cell, gap, pad, slant) {
    gap = gap === undefined ? 1 : gap; pad = pad || 0; slant = slant || 0;
    var cw = 0, i, gl = [];
    for (i = 0; i < text.length; i++) { var g = G[text.charAt(i)] || G[' ']; gl.push(g); cw += g[0].length + (i < text.length - 1 ? gap : 0); }
    var gh = 7 * cell, sh = Math.ceil(gh * slant);
    var w = cw * cell + pad * 2 + sh, h = gh + pad * 2;
    var m = new K.Mask(w, h), x0 = pad;
    gl.forEach(function (g) {
      for (var r = 0; r < 7; r++) for (var c = 0; c < g[r].length; c++) {
        var ch = g[r].charAt(c); if (ch === '.') continue;
        for (var py = 0; py < cell; py++) for (var px = 0; px < cell; px++) {
          if (!inCell(ch, (px + 0.5) / cell, (py + 0.5) / cell)) continue;
          var y = pad + r * cell + py, x = x0 + c * cell + px + Math.floor((gh - 1 - r * cell - py) * slant);
          m.d[y * w + x] = 1;
        }
      }
      x0 += (g[0].length + gap) * cell;
    });
    return { mask: m, w: w, h: h, top: pad, gh: gh };
  };

  // ---- fill styles: bands top->bottom, edge light/dark, outline inner/outer, shadow
  var STY = {
    gold:   { bands: ['#fffbe6', '#fff0a0', '#ffd84a', '#ffb627', '#e2780f', '#ff9d2e', '#ffc85a'], hi: '#ffffff', lo: '#b4540c', o1: '#5a2408', o2: '#1a0a0c', sh: '#05040acc' },
    fire:   { bands: ['#fff8d0', '#ffe066', '#ffb238', '#ff7a2a', '#ef4a2c', '#d42a3c', '#ff6a3a'], hi: '#ffffff', lo: '#8a1428', o1: '#4a0a16', o2: '#14050a', sh: '#05040acc' },
    ice:    { bands: ['#ffffff', '#e2fbff', '#9ff0ff', '#58d4ff', '#3a8cf0', '#4d6bfe', '#7fb4ff'], hi: '#ffffff', lo: '#2236a0', o1: '#101c58', o2: '#05061a', sh: '#05040acc' },
    silver: { bands: ['#ffffff', '#f2f0fa', '#d6d4e6', '#b4b0cc', '#6e6a8c', '#9c98ba', '#cfcce0'], hi: '#ffffff', lo: '#4a4666', o1: '#25213d', o2: '#09080f', sh: '#05040acc' },
    red:    { bands: ['#fff4f0', '#ffc2b0', '#ff7a6a', '#ff3b4f', '#c8102e', '#e8243e', '#ff5a5a'], hi: '#ffffff', lo: '#6a0818', o1: '#ffd166', o2: '#2a0508', sh: '#05040acc' },
    p1:     { bands: ['#fff2ea', '#ffc8a8', '#ff9e6b', '#ff6a4a', '#d0402e', '#ee5a40', '#ff8a5e'], hi: '#ffffff', lo: '#7e2418', o1: '#4a140c', o2: '#14060a', sh: '#05040acc' },
    p2:     { bands: ['#f0faff', '#c4ecff', '#74d4ff', '#4d8afe', '#3346c9', '#4d6bfe', '#7fa4ff'], hi: '#ffffff', lo: '#1a2470', o1: '#0e1550', o2: '#05061a', sh: '#05040acc' },
    dusk:   { bands: ['#e8e4ff', '#c4bce8', '#9d94c8', '#7a72a8', '#4e4878', '#625b92', '#8a82b8'], hi: '#ffffff', lo: '#2e2850', o1: '#1a1630', o2: '#07060c', sh: '#05040acc' }
  };
  T.STYLES = STY;

  // Paint a text mask into a canvas with a style. opts: {o1:1, o2:1, shadow:[dx,dy], bevel:true}
  T.paint = function (tm, style, opts) {
    opts = opts || {};
    var st = typeof style === 'string' ? STY[style] : style;
    var o1 = opts.o1 === undefined ? 1 : opts.o1, o2 = opts.o2 === undefined ? 1 : opts.o2;
    var shd = opts.shadow === undefined ? [2, 2] : opts.shadow;
    var m = tm.mask, ring1 = o1 ? m.grow(o1).sub(m) : new K.Mask(m.w, m.h), all1 = m.or(ring1);
    var ring2 = o2 ? all1.grow(o2).sub(all1) : new K.Mask(m.w, m.h), all2 = all1.or(ring2);
    var P = K.painter(m.w, m.h), table = [[0, 0, 0, 0]];
    function slot(c) { var v = K.rgb(c.slice(0, 7)), a = c.length > 7 ? parseInt(c.slice(7), 16) : 255; table.push([v[0], v[1], v[2], a]); return table.length - 1; }
    if (opts.extrude) {      // solid 3D extrusion down-right, outlined
      var ex = new K.Mask(m.w, m.h);
      for (var k = 1; k <= opts.extrude; k++) ex = ex.or(all2.shift(k, k));
      var exo = ex.grow(1).sub(ex).sub(all2);
      if (shd) P.fill(ex.or(exo).shift(shd[0], shd[1]).sub(ex).sub(exo).sub(all2), slot(st.sh));
      P.fill(exo, slot(st.o2)); P.fill(ex.sub(all2), slot(opts.exColor || st.o1));
      P.fill(ex.sub(all2).band(-1, -1).and(ex.band(0, -1)), slot(st.o2));
    } else if (shd) P.fill(all2.shift(shd[0], shd[1]).sub(all2), slot(st.sh));
    P.fill(ring2, slot(st.o2)); P.fill(ring1, slot(st.o1));
    var bs = st.bands.map(slot), n = bs.length;
    var y0 = tm.top, gh = tm.gh;
    for (var y = 0; y < m.h; y++) {
      var t = (y - y0 + 0.5) / gh, bi = Math.max(0, Math.min(n - 1, Math.floor(t * n)));
      for (var x = 0; x < m.w; x++) if (m.d[y * m.w + x]) P.c[y * m.w + x] = bs[bi];
    }
    if (opts.bevel !== false) {
      P.fill(m.band(0, 1).sub(m.band(0, -1)), slot(st.hi));     // top edges catch the light
      P.fill(m.band(0, -1).sub(m.band(0, 1)), slot(st.lo));     // bottom edges
      P.fill(m.band(1, 0).and(m.band(0, 1).not()).and(m.band(0, -1).not()), slot(st.bands[1]));  // left edges lighter
    }
    if (opts.post) opts.post(P, slot, m);
    return P.canvas(table);
  };

  // word -> canvas
  T.word = function (text, cell, style, opts) {
    opts = opts || {};
    var pad = (opts.o1 === undefined ? 1 : opts.o1) + (opts.o2 === undefined ? 1 : opts.o2) + (opts.shadow === undefined ? 2 : (opts.shadow ? opts.shadow[1] : 0));
    var tm = T.textMask(text, cell, opts.gap, pad, opts.slant === undefined ? 0.22 : opts.slant);
    return T.paint(tm, style, opts);
  };
  // join canvases horizontally, bottom-aligned, with spacing (negative = overlap)
  T.join = function (list, space, valign) {
    var w = 0, h = 0;
    list.forEach(function (c, i) { w += c.width + (i ? space : 0); h = Math.max(h, c.height); });
    var cv = K.canvas(w, h), x = cv.getContext('2d'), cx = 0;
    list.forEach(function (c) { x.drawImage(c, cx, valign === 'mid' ? (h - c.height) >> 1 : h - c.height); cx += c.width + space; });
    return cv;
  };
  // small arcade text (for tags / UI mock-ups): cell 1..2, single outline
  T.small = function (text, cell, style, outline) {
    return T.word(text, cell || 1, style || 'silver', { o1: outline === false ? 0 : 1, o2: 0, shadow: null, slant: 0, bevel: cell > 1 });
  };

  // spiky burst polygon behind K.O. / FIGHT!
  function burst(P, cx, cy, rx, ry, n, seed) {
    var r = K.rng(seed), pts = [];
    for (var i = 0; i < n * 2; i++) {
      var a = i / (n * 2) * Math.PI * 2, k = i % 2 ? 0.55 + r() * 0.12 : 0.92 + r() * 0.25;
      pts.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
    }
    return P.poly(pts);
  }

  // ---- banners
  function wordsFor(name) {
    switch (name) {
      case 'round1': case 'round2': case 'round3':
        return T.join([T.word('ROUND', 5, 'silver'), T.word(name.slice(5), 7, 'gold')], 6);
      case 'finalRound': return T.join([T.word('FINAL', 4, 'fire'), T.word('ROUND', 4, 'fire')], 6);
      case 'fight': return fight();
      case 'ko': return ko();
      case 'perfect': return perfect();
      case 'timeup': return T.join([T.word('TIME', 6, 'ice'), T.word('UP', 6, 'ice')], 8);
      case 'doubleKo': return T.join([T.word('DOUBLE', 4, 'fire'), T.word('K.O.', 6, 'red', { gap: 1 })], 4);
      case 'draw': return T.word('DRAW', 7, 'silver');
      case 'youWin': return T.join([T.word('YOU', 6, 'gold'), T.word('WIN', 7, 'gold')], 8);
      case 'youLose': return T.join([T.word('YOU', 6, 'dusk'), T.word('LOSE', 6, 'dusk')], 8);
      case 'p1Win': return T.join([T.word('1P', 7, 'p1'), T.word('WIN', 7, 'gold')], 8);
      case 'p2Win': return T.join([T.word('2P', 7, 'p2'), T.word('WIN', 7, 'gold')], 8);
      case 'vs': return vs();
      case 'counter': return T.word('COUNTER', 2, 'fire', { o1: 1, o2: 0, shadow: [1, 1], slant: 0.2 });
      case 'ready': return T.word('READY', 6, 'ice');
    }
    return null;
  }
  T.banner = function (name) { return wordsFor(name) || K.canvas(16, 16); };

  // FIGHT! — biggest fire lettering over a jagged red/orange burst with speed streaks
  function fight() {
    var txt = T.word('FIGHT!', 7, 'fire', { gap: 1, slant: 0.28, shadow: [3, 3] });
    var w = txt.width + 28, h = Math.min(64, txt.height + 6);
    var P = K.painter(w, h), table = [[0, 0, 0, 0], K.rgb('#7a0e22').concat(255), K.rgb('#d42a3c').concat(255), K.rgb('#ff7a2a').concat(255), K.rgb('#ffd166').concat(255)];
    var b = burst(P, w / 2, h / 2, w / 2 - 2, h / 2 - 1, 14, 7);
    P.fill(b, 1); P.fill(K.inner(K.inner(b)), 2);
    // speed streaks
    var r = K.rng(3);
    for (var i = 0; i < 9; i++) { var y = 6 + Math.floor(r() * (h - 12)), x0 = Math.floor(r() * 18), len = 20 + Math.floor(r() * 40); for (var x = x0; x < x0 + len; x++) P.px(x, y, i % 3 ? 3 : 4); }
    var c = P.canvas(table), x2 = c.getContext('2d');
    x2.drawImage(txt, 14, (h - txt.height) >> 1);
    return c;
  }
  // K.O. — red-hot letters with a gold inner outline on an explosion burst
  function ko() {
    var txt = T.word('K.O.', 8, 'red', { gap: 1, slant: 0.25, shadow: [3, 3] });
    var w = txt.width + 36, h = 64;
    var P = K.painter(w, h), table = [[0, 0, 0, 0], K.rgb('#2a0508').concat(255), K.rgb('#a01828').concat(255), K.rgb('#ff6a2a').concat(255), K.rgb('#ffd166').concat(255), K.rgb('#fff6d0').concat(255)];
    var b = burst(P, w / 2, h / 2, w / 2 - 1, h / 2 - 1, 16, 11), b2 = burst(P, w / 2, h / 2, w / 2 - 12, h / 2 - 8, 11, 5);
    P.fill(b, 1); P.fill(K.inner(b), 2); P.fill(b2, 3); P.fill(K.inner(K.inner(b2)), 4);
    var c = P.canvas(table), x2 = c.getContext('2d');
    x2.drawImage(txt, (w - txt.width) >> 1, (h - txt.height) >> 1);
    return c;
  }
  function perfect() {
    var txt = T.word('PERFECT', 5, 'gold', { slant: 0.22 });
    var P = K.painter(txt.width, txt.height + 6), tb = [[0, 0, 0, 0], [255, 255, 255, 255], [255, 241, 168, 255]];
    [[8, 3], [txt.width - 10, 2], [txt.width / 2 | 0, txt.height + 3]].forEach(function (s) {
      P.px(s[0], s[1], 1); P.px(s[0] - 1, s[1], 2); P.px(s[0] + 1, s[1], 2); P.px(s[0], s[1] - 1, 2); P.px(s[0], s[1] + 1, 2);
      P.px(s[0] - 2, s[1], 2); P.px(s[0] + 2, s[1], 2);
    });
    var c = P.canvas(tb); c.getContext('2d').drawImage(txt, 0, 3);
    return c;
  }
  function vs() {
    var v = T.word('V', 8, 'p1', { slant: 0.3, shadow: [3, 3] }), s = T.word('S', 8, 'p2', { slant: 0.3, shadow: [3, 3] });
    return T.join([v, s], -6);
  }
})();
