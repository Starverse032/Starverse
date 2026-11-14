/* LATENT CLASH — RIG: DeepSeek 娘 V2 hand-authored pixel stamps (head, faces, hands).
 * Facing right, 3/4 view. Deep-blue wavy hair, white frilled headdress with a cyan
 * bow, a drooping navy-grey whale fin (near side) like a lop ear, bright blue eyes,
 * open smile with a fang. Long hair locks, ahoge and the tail are dynamic (deepseek.js).
 * Materials: M.white = hair mid-gradient ramp, M.shoe = fin ramp, M.legs = under-skirt.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col;

  var LEGEND = {
    'h': col(M.hair, 1), 'H': col(M.hair, 0), 's': col(M.hair, 2), 'd': col(M.hair, 3),
    'm': col(M.white, 1), 'M': col(M.white, 0), 'T': col(M.tip, 0), 't': col(M.tip, 1),
    'K': col(M.skin, 0), 'k': col(M.skin, 1), 'q': col(M.skin, 2), 'Q': col(M.skin, 3),
    'o': 1,
    'w': col(M.eye, 0), 'e': col(M.eye, 1), 'E': col(M.eye, 2), 'x': col(M.eye, 3),
    'b': col(M.blush, 1), 'r': col(M.blush, 3), 'R': col(M.blush, 0),
    'W': col(M.c1, 0), 'c': col(M.c1, 1), 'C': col(M.c1, 2), 'v': col(M.c1, 3),
    'A': col(M.acc, 0), 'a': col(M.acc, 1), 'g': col(M.acc, 2), 'G': col(M.acc, 3),
    'P': col(M.shoe, 0), 'f': col(M.shoe, 1), 'F': col(M.shoe, 2), 'z': col(M.shoe, 3),
    'n': col(M.ink, 0),
    '-': 255
  };

  // pivot (neck top, under the jaw) = column 16, row 18. Crown row 3, chin row 19.
  var HEAD = [
    //0123456789012345678901234567
    '..........W.W.W.W.W.........',  // 0
    '........WcWcWcWcWcWcW.......',  // 1
    '.......cCcCvCcCvCcCvCc.aAa..',  // 2
    '......cCshhhhhhhhhhhhhsaAAAa',  // 3
    '.....cCshhhhhHHHHhhhhhhsgaAg',  // 4
    '....cCshhhhHHHHhhhhHHhhhhs.g',  // 5
    '....Cshhhhhhhhhhhhhhhhhhhs..',  // 6
    '...sshhhhhhhhhhhhhhhhhhhhhs.',  // 7
    '...shhhhhhhhhhhhshhhhhshhhhs',  // 8
    '..szfhhhhhhhhhhsmhhhhsmhhhhs',  // 9
    '..zffPhhhhhsdkkhhdkkhhdhhhs.',  // 10
    '.zfPPfhhhhhsqkkkkkkkkkkkhhs.',  // 11
    'zfPPPfhhhhsqkkkkkkkkkkkkhhs.',  // 12
    'zfPPfshhhsmqkkkkkkkkkkkkhhs.',  // 13
    '.zfPPfshsmmqkkkkkkkkkkkkhs..',  // 14
    '.zfPf.shmmsqkkkkkkkkkkkkhs..',  // 15
    '.zfPf..smmsqqkkkkkkkkkks....',  // 16
    'zfPf....smt.qqkkkkkkkkq.....',  // 17
    'zff......mt...qqkkkkkq......',  // 18
    '.zz.............qqqq........'   // 19
  ];

  // eye overlay: near eye cols 0-3, far eye cols 7-9 (placed at eyeAt)
  var EYES = {
    open: [
      'oooo...ooo.',
      'xEEw...xEw.',
      'eEew...eEe.',
      '.ee.....e..'
    ],
    half: [
      '...........',
      'oooo...ooo.',
      'eEew...eEe.',
      '.ee.....e..'
    ],
    closed: [
      '...........',
      '...........',
      'oooo...ooo.',
      '...........'
    ],
    happy: [
      '...........',
      '.oo.....oo.',
      'o..o...o..o',
      '...........'
    ],
    focus: [
      'oo.......oo',
      '.ooo...oo..',
      'xEEw...xEw.',
      '.eeo....eo.'
    ],
    shut: [
      'oo......oo.',
      '..oo...o...',
      'oo......oo.',
      '...........'
    ],
    dizzy: [
      '.oo.....o..',
      'o.xo...oxo.',
      '.oo.....o..',
      '...........'
    ],
    sad: [
      '..oo...o...',
      'oooo...ooo.',
      'xEEw...xEw.',
      '.ee.....e..'
    ],
    wide: [
      'oooo...ooo.',
      'xEEw...xEw.',
      'eeEe...eEe.',
      '.ee.....e..'
    ]
  };
  var EYE_DY = { focus: -1, sad: -1, wide: -1 };

  var MOUTHS = {
    neutral: ['.oo.'],
    smile:   ['o..o', '.oWo'],
    open:    ['.oo.', 'orro', '.oo.'],
    shout:   ['oooo', 'oWrr', 'orRr', '.oo.'],
    teeth:   ['oooo', 'oWWo', '.oo.'],
    hurt:    ['.o.o', 'o.o.'],
    o:       ['.o.', 'oro', '.o.'],
    frown:   ['.oo.', 'o..o'],
    grin:    ['oooo', 'oWrr', '.oRo']
  };

  // ---------------------------------------------------------------- hands (V2 size)
  // pointing right (a0) and down-right (a45); wrist at the pivot. k/K/q/Q = skin.
  var HAND_LEGEND = { 'k': col(M.skin, 1), 'K': col(M.skin, 0), 'q': col(M.skin, 2), 'Q': col(M.skin, 3), 'o': 1 };
  var HANDS = {
    id: 'ds2', legend: HAND_LEGEND,
    fist: { a0: ['.kKK.', 'kkkkK', 'kkkkk', 'qkqkq', '.qqq.'], p0: [0, 2],
            a45: ['kk...', 'kkKK.', '.kkkK', '.kkkk', '..qkq', '...q.'], p45: [0, 0] },
    open: { a0: ['...KK.', '.kkkkK', 'kkkkkk', 'kkkqq.', 'qqk...', '.q....'], p0: [0, 2],
            a45: ['kk....', 'kkk...', '.kkKk.', '.kkkkK', '..qkkk', '...q.q'], p0x: 0, p45: [0, 0] },
    flat: { a0: ['...kK', '...kK', '..kkK', 'kkkkk', 'kkkkq', 'qkkq.', '.qq..'], p0: [0, 3],
            a45: ['.kK...', 'kkkK..', 'kkkkK.', '.kkkkq', '..qqq.'], p45: [0, 1] },
    relax: { a0: ['.kK..', 'kkkK.', 'kkkkq', 'qkqq.', '.q...'], p0: [0, 1],
             a45: ['kk..', 'kkK.', '.kkK', '.qkk', '..qk', '...q'], p45: [0, 0] },
    point: { a0: ['.kK.....', 'kkkkkkkK', 'kkkkqq..', 'qkqk....', '.qq.....'], p0: [0, 2],
             a45: ['kk....', 'kkK...', '.kkkK.', '.kkqkK', '..qq.k', '......'], p45: [0, 0] }
  };
  HANDS.grip = HANDS.fist;

  I.ART.deepseek = {
    legend: LEGEND,
    hands: HANDS,
    pivot: [16, 18],
    build: function () {
      var set = {
        base: I.parseArt(HEAD, LEGEND, 16, 18),
        eyes: {}, mouth: {}, cache: {},
        eyeAt: [13, 11], mouthAt: [18, 16],
        extras: { blush: { img: I.parseArt(['bb......b'], LEGEND), at: [13, 15] } }
      };
      Object.keys(EYES).forEach(function (k) { var e = set.eyes[k] = I.parseArt(EYES[k], LEGEND); if (EYE_DY[k]) e.dy = EYE_DY[k]; });
      Object.keys(MOUTHS).forEach(function (k) { set.mouth[k] = I.parseArt(MOUTHS[k], LEGEND); });
      return set;
    }
  };
})();
