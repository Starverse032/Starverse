/* LATENT CLASH — RIG: Claude 娘 V2 hand-authored pixel stamps (head, faces, hands).
 * Facing right, 3/4 view, 104-px fighter (head ≈ 16 px chin → crown). The
 * exterior outline is added by the renderer, so the art only holds interior
 * lines. The sunburst flower ornament is drawn procedurally into the head.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col;

  var LEGEND = {
    'h': col(M.hair, 1), 'H': col(M.hair, 0), 's': col(M.hair, 2), 'd': col(M.hair, 3),
    'T': col(M.tip, 0), 't': col(M.tip, 1),
    'K': col(M.skin, 0), 'k': col(M.skin, 1), 'q': col(M.skin, 2), 'Q': col(M.skin, 3),
    'o': 1,
    'w': col(M.eye, 0), 'e': col(M.eye, 1), 'E': col(M.eye, 2), 'x': col(M.eye, 3),
    'b': col(M.blush, 1), 'B': col(M.blush, 2),
    'A': col(M.acc, 0), 'a': col(M.acc, 1), 'c': col(M.acc, 2), 'C': col(M.acc, 3),
    'M': col(M.metal, 0), 'm': col(M.metal, 1),
    'W': col(M.white, 0), 'r': col(M.acc, 3), 'n': col(M.ink, 0),
    'N': col(M.c2, 1), 'D': col(M.c2, 2), 'u': col(M.c2, 0), 'U': col(M.white, 1), 'Y': col(M.white, 2),
    '-': 255
  };

  // 17 wide × 17 tall. Pivot (neck joint, under the jaw) = (8, 16).
  var HEAD = [
    //0123456789012345 6
    '.....hhhhhh......',  // 0
    '...hhhhhHHHhh....',  // 1
    '..shhhhHHHHHhh...',  // 2
    '.sshhhhhhhHHHhh..',  // 3
    '.sshhhhhhhhhhhhh.',  // 4
    'sshhhhhhhhhhhhhhh',  // 5
    'sshhhhhhhhhhhhhhh',  // 6
    'sshhhhhhhhshhhshh',  // 7
    'sshhhhhhhshhhshhh',  // 8
    'sshhhhhhshkhhkhhk',  // 9  fringe tips
    'sshhhhhhkkkkkkkkk',  // 10 brow line
    'sshhhhhhkkkkkkkkk',  // 11 eyes
    'sshhhhhhkkkkkkkkk',  // 12 eyes
    '.shhhhhhkkkkkkkk.',  // 13
    '.shhhhhhqkkkkkkk.',  // 14 nose
    '..shhhhh.qkkkkk..',  // 15 mouth
    '..shhhh...qqkk...'   // 16 chin
  ];

  // eyes block: 9 wide × 5 tall at EYE_AT (row 0 = brow row). Near eye x0-2, far eye x6-7.
  var EYES = {
    open: [
      '.........',
      'oooo..oo.',
      '.xxw..xw.',
      '.eeE..eE.',
      '.........'
    ],
    half: [
      '.........',
      '.........',
      'oooo..oo.',
      '.eeE..eE.',
      '.........'
    ],
    closed: [
      '.........',
      '.........',
      '.........',
      'oooo..oo.',
      '.........'
    ],
    happy: [
      '.........',
      '.........',
      '.oo...o..',
      'o..o.o.o.',
      '.........'
    ],
    focus: [
      '.dd....d.',
      '...d..d..',
      'oooo..oo.',
      '.xxw..xw.',
      '.........'
    ],
    shut: [
      '.........',
      'o.....o..',
      '.ooo.oo..',
      'o.....o..',
      '.........'
    ],
    dizzy: [
      '.........',
      '.ooo..oo.',
      '.o.o..o..',
      '.oo...oo.',
      '.........'
    ],
    sad: [
      '...d..d..',
      '.dd....d.',
      'oooo..oo.',
      '.xxw..xw.',
      '.eeE..eE.'
    ],
    wide: [
      '.ooo..oo.',
      '.xxw..xw.',
      '.eeE..eE.',
      '.eee..ee.',
      '.........'
    ]
  };

  // mouth block: 3 wide × 2 tall at MOUTH_AT
  var MOUTHS = {
    neutral: ['.Q.', '...'],
    smile:   ['Q.Q', '.Q.'],
    open:    ['oo.', 'ro.'],
    shout:   ['ooo', 'rro'],
    teeth:   ['oWo', '...'],
    hurt:    ['o.o', '.o.'],
    o:       ['oo.', 'oo.'],
    frown:   ['.Q.', 'Q.Q'],
    grin:    ['oWW', '.rr']
  };

  // ---------------------------------------------------------------- hands (V2, bigger)
  // authored pointing right (forearm direction 0°) and down-right (45°); wrist at the pivot.
  var HL = { 'K': col(M.skin, 0), 'k': col(M.skin, 1), 'q': col(M.skin, 2), 'Q': col(M.skin, 3) };
  var HANDS = {
    id: 'claudeV2', legend: HL,
    relax: { a0: ['.KK..', 'kkkkq', 'kkkqQ', '.qQq.'], p0: [0, 1],
             a45: ['kK...', 'kkk..', '.kkkq', '.qkqQ', '..QQ.'], p45: [0, 0] },
    fist:  { a0: ['.KKk.', 'kkkkq', 'kkkqQ', '.qQQ.'], p0: [0, 1],
             a45: ['kK...', 'kkKk.', '.kkkq', '.qkQQ', '..QQ.'], p45: [0, 0] },
    palm:  { a0: ['...Kq', '..Kkq', '..kkq', '.kkkq', 'kkkqQ', '.qQQ.'], p0: [0, 4],
             a45: ['....K', '...Kq', '..kkq', '.kkq.', 'kkqQ.', '.QQ..'], p45: [0, 4] },
    open:  { a0: ['...K..', '.KkK.k', 'kkkkkq', 'kkkqq.', '.qQ.q.'], p0: [0, 2],
             a45: ['kK....', 'kkk.K.', '.kkkk.', '.kkqq.', '..q.qk', '...q..'], p45: [0, 0] },
    grip:  { a0: ['.KKk', 'kkkq', 'kkqQ', '.QQ.'], p0: [0, 1],
             a45: ['kK..', 'kkk.', '.kkq', '.qQQ'], p45: [0, 0] },
    point: { a0: ['.KK....', 'kkkkkkq', 'kkkqQ..', '.qQ....'], p0: [0, 1],
             a45: ['kK....', 'kkk...', '.kkq..', '.qkqk.', '..Q..k'], p45: [0, 0] },
    flat:  { a0: ['.KKkk.', 'kkkkkk', 'kkkqqQ', '.qQ...'], p0: [0, 1],
             a45: ['kK....', 'kkk...', '.kkkk.', '..kqkk', '...QQq'], p45: [0, 0] }
  };

  // sunburst flower: 12 tapering petals (alternating long/short) around a small gold core
  function flower(img, cx, cy) {
    var d = img.d, w = img.w;
    function put(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < img.h) d[y * w + x] = c; }
    for (var k = 0; k < 12; k++) {
      var a = (k * 30 + 8) * Math.PI / 180, L = (k & 1) ? 3.6 : 4.7;
      var lit = Math.cos(a) * 0.62 - Math.sin(a) * 0.78;        // light from the upper front
      for (var r = 1.6; r <= L + 0.01; r += 0.35) {
        var c = r > L - 1.6 ? (lit > -0.3 ? col(M.acc, 0) : col(M.acc, 1)) : (lit > 0.2 ? col(M.acc, 0) : col(M.acc, 1));
        put(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c);
      }
    }
    put(cx, cy, col(M.metal, 0)); put(cx + 1, cy, col(M.metal, 1)); put(cx, cy + 1, col(M.metal, 1)); put(cx - 1, cy, col(M.acc, 2)); put(cx, cy - 1, col(M.metal, 0));
  }

  // black ribbon bow (behind/below the flower) + cream tassel, painted into the head stamp
  var BOW = [
    'uN.......',
    'NNN....uN',
    'NNDD.DNNN',
    '.NDD.DND.',
    '.DN...DD.',
    '..D....D.'
  ];
  var TASSEL = ['U', 'U', 'Y'];

  I.ART = I.ART || {};
  I.ART.claude = {
    legend: LEGEND,
    hands: HANDS,
    build: function () {
      var PADL = 4, PADT = 3;
      var raw = I.parseArt(HEAD, LEGEND, 0, 0);
      var W = raw.w + PADL + 1, Hh = raw.h + PADT, d = new Uint8Array(W * Hh);
      for (var y = 0; y < raw.h; y++) for (var x = 0; x < raw.w; x++) d[(y + PADT) * W + x + PADL] = raw.d[y * raw.w + x];
      var base = { w: W, h: Hh, d: d, px: 8 + PADL, py: 16 + PADT };
      base = I.overlay(base, I.parseArt(BOW, LEGEND), PADL - 2, PADT + 4, null);
      base = I.overlay(base, I.parseArt(TASSEL, LEGEND), PADL + 2, PADT + 10, null);
      flower(base, PADL + 3, PADT + 6);
      var set = {
        base: base, eyes: {}, mouth: {}, cache: {},
        eyeAt: [7 + PADL, 9 + PADT], mouthAt: [10 + PADL, 15 + PADT],
        extras: { blush: { img: I.parseArt(['bb....b'], LEGEND), at: [7 + PADL, 13 + PADT] } }
      };
      Object.keys(EYES).forEach(function (k) { set.eyes[k] = I.parseArt(EYES[k], LEGEND); });
      Object.keys(MOUTHS).forEach(function (k) { set.mouth[k] = I.parseArt(MOUTHS[k], LEGEND); });
      return set;
    }
  };
})();
