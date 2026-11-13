/* LATENT CLASH — ILLUST icons: buttons, numpad arrows, emblems, pips, cursor, lock, devices, tags.
 * Hand-typed pixel maps with per-icon colour legends (true colour, not character palettes). */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit;
  var IC = I.ICON = {};
  var O = '#05040a';

  function fromMap(rows, legend) {
    var h = rows.length, w = rows[0].length, c = K.canvas(w, h), x = c.getContext('2d');
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var col = legend[rows[j].charAt(i)]; if (!col) continue;
      x.fillStyle = col; x.fillRect(i, j, 1, 1);
    }
    return c;
  }
  function rot(rows) {          // 90° clockwise
    var h = rows.length, w = rows[0].length, out = [];
    for (var i = 0; i < w; i++) { var r = ''; for (var j = h - 1; j >= 0; j--) r += rows[j].charAt(i); out.push(r); }
    return out;
  }
  function flipX(rows) { return rows.map(function (r) { return r.split('').reverse().join(''); }); }

  // ---- buttons: round, distinct hue AND luminance, letter inside
  var BTN_BASE = [
    '...oooooo...',
    '..oHHHHHHo..',
    '.oHhhhhhhHo.',
    'oHhhhhhhhhBo',
    'oHhhhhhhhhBo',
    'oHhhhhhhhhBo',
    'oHhhhhhhhhBo',
    'oHhhhhhhhhBo',
    'oHhhhhhhhBBo',
    '.oBhhhhhBBo.',
    '..oBBBBBBo..',
    '...oooooo...'
  ];
  var LET = {
    L: ['#...', '#...', '#...', '#...', '####'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    H: ['#..#', '#..#', '####', '#..#', '#..#'],
    S: ['.###', '#...', '.##.', '...#', '###.']
  };
  var BTN_COL = {
    L: { o: '#0c1640', H: '#9fc4ff', h: '#3f74e8', B: '#22388c', t: '#ffffff', s: '#0c1640' },
    M: { o: '#2a2a06', H: '#fffbb0', h: '#e8d43a', B: '#9c8a12', t: '#2a2406', s: '#fff8c0' },
    H: { o: '#3a0612', H: '#ffb0b8', h: '#e83a4e', B: '#94152a', t: '#ffffff', s: '#3a0612' },
    S: { o: '#1c0a30', H: '#d8b0ff', h: '#8a3ed8', B: '#4e1e86', t: '#ffd166', s: '#1c0a30' }
  };
  function button(k) {
    var c = fromMap(BTN_BASE, BTN_COL[k]), x = c.getContext('2d'), g = LET[k], gw = g[0].length;
    var ox = ((12 - gw) >> 1), oy = 3;
    for (var j = 0; j < 5; j++) for (var i = 0; i < gw; i++) if (g[j].charAt(i) === '#') {
      x.fillStyle = BTN_COL[k].s; x.fillRect(ox + i + 1, oy + j + 1, 1, 1);
    }
    for (j = 0; j < 5; j++) for (i = 0; i < gw; i++) if (g[j].charAt(i) === '#') { x.fillStyle = BTN_COL[k].t; x.fillRect(ox + i, oy + j, 1, 1); }
    return c;
  }

  // ---- direction arrows (numpad notation): one straight + one diagonal map, rotated/flipped
  var ARR = [
    '............',
    '......oo....',
    '......owo...',
    '......owwo..',
    'oooooooWwwo.',
    'oWWWWWWWwwwo',
    'owwwwwwwwwso',
    'oooooooswso.',
    '......osso..',
    '......oso...',
    '......oo....',
    '............'
  ];
  var DIAG = [
    '............',
    '....oooooooo',
    '....oWWWWWwo',
    '.....oowwwwo',
    '......oWwwwo',
    '.....oWwwwso',
    '....oWwwosso',
    '...oWwwo.oso',
    '..oWwwo...oo',
    '.oWwso......',
    '.owso.......',
    '..oo........'
  ];
  var ARR_COL = { o: O, W: '#ffffff', w: '#f4efe6', s: '#9b96b8' };
  function arrow(n) {
    if (n === 5) return fromMap([
      '............', '............', '............', '....oooo....', '...oWWwwo...', '...oWwwwo...',
      '...owwwso...', '...owwsso...', '....oooo....', '............', '............', '............'], ARR_COL);
    var m;
    switch (n) {
      case 6: m = ARR; break;
      case 2: m = rot(ARR); break;
      case 4: m = flipX(ARR); break;
      case 8: m = rot(rot(rot(ARR))); break;
      case 9: m = DIAG; break;
      case 3: m = rot(DIAG); break;
      case 1: m = rot(rot(DIAG)); break;
      case 7: m = rot(rot(rot(DIAG))); break;
    }
    return fromMap(m, ARR_COL);
  }

  // ---- emblems (vector, character palette 0 colours)
  function emblem(ch, size) {
    var P = K.painter(size, size), S = K.S, s = size / 16;
    if (ch === 'claude') {
      var SB = [1, 0.56, 0.88, 0.5, 1, 0.64, 0.8, 0.54];
      var st = I.starburst(P, 8 * s, 8 * s, 7.6 * s, -0.2, SB);
      P.part(st, S.a1, S.al);
      P.recol(st.band(-1, 1), [S.a1], S.a0);
      P.recol(st.band(1, -1), [S.a1], S.a2);
      P.fill(I.starburst(P, 8 * s, 8 * s, 2.6 * s, -0.2, SB), S.W);
      P.outer(S.ol);
      return P.canvas(K.slotColors('claude', 0));
    }
    // cute whale: round body, light belly, raised fluke, eye, spout
    var tail = I.fluke(P, 3.2 * s, 4.2 * s, -Math.PI / 2 - 0.5, 0.42 * s).or(P.sr([5 * s, 10 * s, 3.6 * s, 7 * s, 3.2 * s, 4.6 * s], 2.6 * s, 2 * s));
    P.part(tail, S.d1, S.dl);
    var body = P.ell(9 * s, 10.2 * s, 6.4 * s, 4.6 * s);
    P.part(body, S.d1, S.dl);
    P.recol(body.band(-1, 1), [S.d1], S.d0);
    P.recol(P.ell(9.6 * s, 13.4 * s, 5.4 * s, 2.6 * s).and(body), [S.d1, S.d0], S.c0);
    var ex = Math.round(11.6 * s), ey = Math.round(9 * s);
    P.px(ex, ey, S.ol); P.px(ex, ey + 1, S.ol);
    if (size >= 32) { P.px(ex + 1, ey, S.ol); P.px(ex + 1, ey + 1, S.ol); P.px(ex + 1, ey, S.W); P.px(ex + 2, ey + 3, S.bl); P.px(ex + 3, ey + 3, S.bl); }
    else P.px(ex + 1, ey + 2, S.bl);
    P.outer(S.ol);
    var sx = Math.round(9 * s), sy = Math.round(5.6 * s) - 1;
    P.px(sx, sy, S.a1); P.px(sx, sy - 1, S.a0); P.px(sx - 1, sy - 2, S.a0); P.px(sx + 1, sy - 2, S.a0);
    if (size >= 32) { P.px(sx, sy - 2, S.a1); P.px(sx - 2, sy - 3, S.a1); P.px(sx + 2, sy - 3, S.a1); P.px(sx - 3, sy - 4, S.a2); P.px(sx + 3, sy - 4, S.a2); }
    return P.canvas(K.slotColors('deepseek', 0));
  }

  var PIP = [
    '....oo....',
    '...oHHo...',
    '..oHhhho..',
    '.oHhhhhho.',
    'oHhhWhhhBo',
    'oHhhhhhBBo',
    '.oBhhhBBo.',
    '..oBhBBo..',
    '...oBBo...',
    '....oo....'
  ];
  var CURSOR = [
    'oo..........',
    'oWoo........',
    'oWwwoo......',
    'oWwwwwoo....',
    'oWwwwwwwoo..',
    'oWwwwwwwwwoo',
    'oWwwwwwwssoo',
    'oWwwwwssoo..',
    'oWwwssoo....',
    'oWssoo......',
    'osoo........',
    'oo..........'
  ];
  var LOCK = [
    '....oooo....',
    '...oSSSSo...',
    '..oSo..oSo..',
    '..oSo..oSo..',
    '.oooooooooo.',
    '.oHhhhhhhho.',
    '.ohhhoohhho.',
    '.ohhhoohhBo.',
    '.ohhhhohhBo.',
    '.ohhhhhhBBo.',
    '.oBBBBBBBBo.',
    '.oooooooooo.'
  ];
  var KEYB = [
    '................',
    'oooooooooooooooo',
    'oHHHHHHHHHHHHHHo',
    'oHkkHkkHkkHkkHBo',
    'oHkkHkkHkkHkkHBo',
    'oHHHHHHHHHHHHHBo',
    'oHkkHkkHkkHkkHBo',
    'oHkkHkkHkkHkkHBo',
    'oHHHHHHHHHHHHHBo',
    'oHHkkkkkkkkkkHBo',
    'oBBBBBBBBBBBBBBo',
    'oooooooooooooooo'
  ];
  var PAD = [
    '................',
    '..oooooooooooo..',
    '.oHHHHHHHHHHHHo.',
    'oHHkHHHHHHHHrHHo',
    'oHkkkHHHHHHgHbHo',
    'oHHkHHHHHHHHyHHo',
    'oHHHHHHHHHHHHHBo',
    'oHHHHoooooHHHHBo',
    'oHHHBo....oHHBBo',
    '.oBBo......oBBo.',
    '..oo........oo..',
    '................'
  ];
  var TOUCH = [
    '....oo......',
    '...oWWo.....',
    '...oWwo.....',
    '...oWwooo...',
    '...oWwWwoo..',
    '.oooWwWwWwo.',
    'oWWoWwwwwwo.',
    'oWwwwwwwwso.',
    '.owwwwwwwso.',
    '..owwwwwsso.',
    '...owwwsso..',
    '....oooooo..'
  ];
  // 3x5 tag font
  var TF = {
    '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
    P: ['##.', '#.#', '##.', '#..', '#..'], C: ['.##', '#..', '#..', '#..', '.##'], U: ['#.#', '#.#', '#.#', '#.#', '.##']
  };
  function tag(text, bg, hi, dk) {
    var w = text.length * 4 + 5, h = 9, c = K.canvas(w, h), x = c.getContext('2d');
    x.fillStyle = O; x.fillRect(1, 0, w - 2, h); x.fillRect(0, 1, w, h - 2);
    x.fillStyle = bg; x.fillRect(1, 1, w - 2, h - 2);
    x.fillStyle = hi; x.fillRect(2, 1, w - 4, 1);
    x.fillStyle = dk; x.fillRect(2, h - 2, w - 4, 1);
    for (var k = 0; k < text.length; k++) {
      var g = TF[text.charAt(k)];
      for (var j = 0; j < 5; j++) for (var i = 0; i < 3; i++) if (g[j].charAt(i) === '#') {
        x.fillStyle = O; x.fillRect(3 + k * 4 + i, 3 + j, 1, 1);
        x.fillStyle = '#ffffff'; x.fillRect(3 + k * 4 + i, 2 + j, 1, 1);
      }
    }
    return c;
  }

  IC.build = function (name) {
    var m;
    if ((m = /^btn\.([LMHS])$/.exec(name))) return button(m[1]);
    if ((m = /^dir\.([1-9])$/.exec(name))) return arrow(+m[1]);
    if ((m = /^emblem\.(claude|deepseek)(\.lg)?$/.exec(name))) return emblem(m[1], m[2] ? 32 : 16);
    switch (name) {
      case 'pip.on': return fromMap(PIP, { o: '#3a1a08', H: '#fff6c0', h: '#ffd166', B: '#d08a1a', W: '#ffffff' });
      case 'pip.off': return fromMap(PIP, { o: '#0b0a14', H: '#4a4570', h: '#2a2650', B: '#1c1938', W: '#3b3670' });
      case 'cursor': return fromMap(CURSOR, { o: '#3a1a08', W: '#fff6c0', w: '#ffd166', s: '#e0902a' });
      case 'lock': return fromMap(LOCK, { o: O, S: '#c9d4f0', H: '#fff3b8', h: '#edbd4f', B: '#b07e2a' });
      case 'keyboard': return fromMap(KEYB, { o: O, H: '#d9d4e8', B: '#8a84a8', k: '#5a5478' });
      case 'gamepad': return fromMap(PAD, { o: O, H: '#d9d4e8', B: '#8a84a8', k: '#3b3670', r: '#ff4d6d', g: '#5ee6a8', b: '#58a4ff', y: '#ffd166' });
      case 'touch': return fromMap(TOUCH, { o: O, W: '#ffffff', w: '#f7cdb2', s: '#dc9f86' });
      case 'p1': return tag('1P', '#e8463a', '#ff9e8a', '#8a1e18');
      case 'p2': return tag('2P', '#3a6af0', '#9fc0ff', '#1a2c80');
      case 'cpu': return tag('CPU', '#5a5878', '#9b96b8', '#2e2c48');
    }
    return null;
  };
})();
