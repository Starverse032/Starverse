/* LATENT CLASH — RIG: Claude 娘 hand-authored pixel stamps (head, faces).
 * Facing right, 3/4 view. Exterior outline is added by the renderer, so the
 * art only contains interior lines. Legend in LEGEND below.
 * Head pivot (neck top) = HEAD_PIVOT. Eyes overlay at EYE_AT, mouth at MOUTH_AT.
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
    '-': 255
  };

  var HEAD = [
    //0123456789012345678901
    '........hhhhh.........',  // 0
    '......hhhhhhhhh.......',  // 1
    '....shhhhhhhhhhhh.....',  // 2
    '...shhhhhHHHHhhhhh....',  // 3
    '..shhhhhHHhhHHHhhhh...',  // 4
    '..shhhhhhhhhhhhhhhhh..',  // 5
    '.sshhhhhhhhhhhhhhhhhh.',  // 6
    '.sshhhhhhhshhhhhhhhhh.',  // 7
    '.sshhhhhhshhhhhshhhhhh',  // 8
    'sshhhhhhshhhhhshhhhshh',  // 9
    'sshhhhhhshkhhshkhhshkh',  // 10
    'sshhhhhhhkkkhhkkkhkkkh',  // 11
    'sshhhshhkkkkkkkkkkkkkh',  // 12
    'sshhhshhkkkkkkkkkkkkk.',  // 13
    'sshhhshhkkkkkkkkkkkkk.',  // 14
    'sshhhshhkkkkkkkkkkkkk.',  // 15
    '.shhhshhkkkkkkkkkkkk..',  // 16
    '.shhhshhkkkkkkkkkkkk..',  // 17
    '..shhshhqkkkkkkkkkk...',  // 18
    '..shhshh.qkkkkkkkk....',  // 19
    '...shshh..qqkkkkk.....',  // 20
    '....shh.....qkk.......'   // 21
  ];

  // eyes block: 11 wide x 6 tall at EYE_AT (row 0 = brow row r11)
  var EYES = {
    open: [
      '...........',
      '.ooo....oo.',
      'oxEw....xwo',
      '.Eee....Ee.',
      '.eew....e..',
      '...........'
    ],
    half: [
      '...........',
      '...........',
      'oooo....ooo',
      '.Eee....Ee.',
      '.eew....e..',
      '...........'
    ],
    closed: [
      '...........',
      '...........',
      '...........',
      'oooo....ooo',
      '...........',
      '...........'
    ],
    happy: [
      '...........',
      '...........',
      '.oo.....oo.',
      'o..o...o..o',
      '...........',
      '...........'
    ],
    focus: [
      'o.......o..',
      '.oo....o...',
      '.ooo....oo.',
      'oxEw....xwo',
      '.Ee.....E..',
      '...........'
    ],
    shut: [
      '...........',
      'o........o.',
      '.ooo...ooo.',
      'o........o.',
      '...........',
      '...........'
    ],
    dizzy: [
      '...........',
      '.ooo...ooo.',
      '.o.o...o.o.',
      '.oo....oo..',
      '...........',
      '...........'
    ],
    sad: [
      '...o.....o.',
      '.oo.....o..',
      '.ooo....oo.',
      'oxEw....xwo',
      '.eew....e..',
      '...........'
    ],
    wide: [
      '...........',
      '.ooo....oo.',
      'oxEw....xwo',
      '.Eee....Ee.',
      '.eee....e..',
      '..o........'
    ]
  };

  // mouth block: 4 wide × 3 tall at MOUTH_AT
  var MOUTHS = {
    neutral: ['....', '.QQ.', '....'],
    smile:   ['....', 'Q..Q', '.QQ.'],
    open:    ['.oo.', 'orro', '.oo.'],
    shout:   ['oooo', 'orro', '.oo.'],
    teeth:   ['....', 'oWWo', '.oo.'],
    hurt:    ['....', 'o.o.', '.o.o'],
    o:       ['.o..', 'oro.', '.o..'],
    frown:   ['....', '.QQ.', 'Q..Q'],
    grin:    ['....', 'oWWo', '.rr.']
  };

  I.ART = I.ART || {};
  I.ART.claude = {
    legend: LEGEND,
    build: function () {
      var set = {
        base: I.parseArt(HEAD, LEGEND, 9, 20),
        eyes: {}, mouth: {}, cache: {},
        eyeAt: [8, 11], mouthAt: [13, 17],
        extras: {
          blush: { img: I.parseArt(['bb.....bb'], LEGEND), at: [9, 16] }
        }
      };
      Object.keys(EYES).forEach(function (k) { set.eyes[k] = I.parseArt(EYES[k], LEGEND); });
      Object.keys(MOUTHS).forEach(function (k) { set.mouth[k] = I.parseArt(MOUTHS[k], LEGEND); });
      // starburst hair clip, drawn into the base
      var clip = I.parseArt([
        '..a..',
        'a.A.a',
        '.AMA.',
        'a.A.a',
        '..c..'
      ], LEGEND);
      set.base = I.overlay(set.base, clip, 1, 6, null);
      return set;
    }
  };
})();
