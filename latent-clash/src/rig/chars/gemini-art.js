/* LATENT CLASH — RIG: Gemini 娘 hand-authored pixel stamps (head with cat ears, faces, hands, stars).
 * Facing right, 3/4 view. Blue wavy hair (violet lower down, dynamic locks in gemini.js), two cat ears with
 * pink insides, a small bun at the back of the head (the star clip is blitted on it by gemini.js),
 * heterochromia: near eye rose-red (M.eye), far eye gold (M.white).
 * Materials (gemini.js ramps): M.hair blue, M.legs violet, M.tip pink ends, M.blush = ear/blush pink,
 * M.white = gold eye, M.glow = iridescent star facets (white, cyan, pink, yellow — hues, not a ramp).
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col;

  var LEGEND = {
    'h': col(M.hair, 1), 'H': col(M.hair, 0), 's': col(M.hair, 2), 'd': col(M.hair, 3),
    'u': col(M.legs, 1), 'U': col(M.legs, 0), 'y': col(M.legs, 2),
    'K': col(M.skin, 0), 'k': col(M.skin, 1), 'q': col(M.skin, 2), 'Q': col(M.skin, 3),
    'o': 1,
    'p': col(M.blush, 1), 'P': col(M.blush, 0), 'n': col(M.blush, 2), 'N': col(M.blush, 3),
    'w': col(M.eye, 0), 'e': col(M.eye, 1), 'E': col(M.eye, 2), 'x': col(M.eye, 3),
    'Y': col(M.white, 0), 'G': col(M.white, 1), 'j': col(M.white, 2), 'J': col(M.white, 3),
    'b': col(M.blush, 1), 'r': col(M.blush, 3), 'R': col(M.blush, 0),
    'W': col(M.c1, 0), 'c': col(M.c1, 1),
    'm': col(M.metal, 1), 'M': col(M.metal, 0),
    'a': col(M.acc, 1), 'A': col(M.acc, 0),
    '-': 255
  };

  // pivot (under the jaw) = column 17, row 27. Crown row 11-12 (≈15 above the pivot), ear tips rows 3-4, chin row 28.
  var HEAD = [
    '..............................',
    '..............................',
    '..............................',
    '.........h....................',
    '........hhs...........h.......',
    '........hPs..........hhs......',
    '.......shPps........hPPs......',
    '.......shPPps......hPppns.....',
    '.......shPppns....HhPppns.....',
    '......sshPppnsHHHhhPppnss.....',
    '...ss.shhhPpnshHHHHhhpnnhs....',
    '..shhsshhhhhhhhhHHHHHhhhhhs...',
    '.shHhhshhhhhhhhhhhHHhhhhhhhs..',
    'shHhhhhshhhhhhhhhhhhhhhhhhhhs.',
    'shhHHhhshhhhhhhhhshhhhhhhhhhs.',
    'shhHhhsshhhhhhhhshhhhhhshhhhhs',
    '.shhssshhHHhhhhshhhhhhshhhhhhs',
    '..ssshhhhHhhhhshhhhhshhhhhshhs',
    '...shhhshhhhhshhhKhhshhKhhshhs',
    '...shhhshhhhshhhkkkhshkkkhskhs',
    '...shhhhshhshhhqkkkkkKkkkkkkhs',
    '...shshhshhshhqkkkkkkkkkkkkks.',
    '...shshhshhshhqkkkkkkkkkkkkks.',
    '...shhshhshshhqkkkkkkkkkkkkk..',
    '...shhshhshshhhqkkkkkkkkkkkk..',
    '...shhshhshshhhqkkkkkkkkkkk...',
    '...sdhshhhhshhhhqkkkkkkkkkk...',
    '....dhhhhhhshhh..qqkkkkkkk....',
    '....sdhhhhhshhs....qqkkkq.....',
    '.....sdhhhhhss................',
    '......sssshs..................'
  ];

  // ears folded flat back (hurt, guard, scared): overlay rows 3-10 of the head ('-' erases)
  var FLAT = [
    '------------------------------',
    '------------------------------',
    '------------------------------',
    '------------------------------',
    '--hhs-----------hhs-----------',
    '---hPpss-------shPps----------',
    '----sPpnshHHHhhhhpnshhs-------',
    '...ss.shhhhhhshHHHHhhhhhhs....'
  ];

  // eye overlay: near eye cols 0-3 (rose), far eye cols 7-9 (gold), placed at eyeAt
  var EYES = {
    open: [
      '.ooo....oo.',
      'oxEwo..oJY.',
      'oeEeo..oGj.',
      '.eee....G..'
    ],
    half: [
      '...........',
      'ooooo..ooo.',
      'oeEeo..oGj.',
      '.eee....G..'
    ],
    closed: [
      '...........',
      '...........',
      'oooo...ooo.',
      '...........'
    ],
    happy: [
      '...........',
      '.oo.....o..',
      'o..o...o.o.',
      '...........'
    ],
    focus: [
      'oo......oo.',
      '.oooo..ooo.',
      'oxEwo..oJY.',
      '.eEe....G..'
    ],
    shut: [
      'oo.......o.',
      '..oo...oo..',
      'oo.......o.',
      '...........'
    ],
    dizzy: [
      '.oo.....o..',
      'o.xo...oJo.',
      '.oo.....o..',
      '...........'
    ],
    sad: [
      '...o....o..',
      '.ooo...ooo.',
      'oxEwo..oJY.',
      '.eee....G..'
    ],
    wide: [
      '.ooo....oo.',
      'oxEwo..oJYo',
      'oeEeo..oGjo',
      'oeee...oGG.',
      '.oo.....o..'
    ],
    // sly half-lidded side glance (cheeky)
    sly: [
      '...........',
      'oooo...ooo.',
      'oEwo...JYo.',
      '.ee.....G..'
    ],
    wink: [
      '.ooo.......',
      'oxEwo......',
      'oeEeo..ooo.',
      '.eee.......'
    ]
  };
  var EYE_DY = { focus: -1, sad: -1, wide: -1 };

  var MOUTHS = {
    neutral: ['o.o', '.o.'],                 // tiny cat mouth
    smile:   ['o...o', '.ooo.'],
    cat:     ['o.o.o', '.o.o.'],             // ω
    open:    ['.oo.', 'orro', '.oo.'],
    shout:   ['oooo', 'oWrr', 'orRr', '.oo.'],
    teeth:   ['oooo', 'oWWo', '.oo.'],
    hurt:    ['.o.o', 'o.o.'],
    o:       ['.o.', 'oro', '.o.'],
    frown:   ['.oo.', 'o..o'],
    grin:    ['ooooo', 'oWWWo', '.ooo.'],
    tongue:  ['o..o', '.oRo', '..r.']        // paw-lick
  };

  // ---------------------------------------------------------------- hands (small, nimble; pink claw tips)
  // pointing right (a0) and down-right (a45); wrist at the pivot. n = claw (accent highlight).
  var HAND_LEGEND = { 'k': col(M.skin, 1), 'K': col(M.skin, 0), 'q': col(M.skin, 2), 'Q': col(M.skin, 3), 'o': 1, 'n': col(M.acc, 0) };
  var HANDS = {
    id: 'gemini', legend: HAND_LEGEND,
    fist: { a0: ['.kK.', 'kkkK', 'kkkk', 'qkqq', '.qq.'], p0: [0, 2],
            a45: ['kk..', 'kkK.', '.kkK', '.kkk', '..qq'], p45: [0, 0] },
    open: { a0: ['...KK.', '.kkkkK', 'kkkkkk', 'kkkqq.', 'qqk...'], p0: [0, 2],
            a45: ['kk....', 'kkk...', '.kkKk.', '.kkkkK', '..qkkk', '...q.q'], p45: [0, 0] },
    flat: { a0: ['..kK', '..kK', 'kkkK', 'kkkq', 'qkq.', '.q..'], p0: [0, 3],
            a45: ['.kK..', 'kkkK.', 'kkkkq', '.qqq.'], p45: [0, 1] },
    relax: { a0: ['.kK.', 'kkkK', 'kkkq', 'qkq.', '.q..'], p0: [0, 1],
             a45: ['kk..', 'kkK.', '.kkK', '.qkk', '..qk'], p45: [0, 0] },
    point: { a0: ['.kK....', 'kkkkkkK', 'kkkqq..', 'qkq....', '.q.....'], p0: [0, 2],
             a45: ['kk....', 'kkK...', '.kkkK.', '.kkqkK', '..qq.k'], p45: [0, 0] },
    // paw: curled fingers, cat-paw (idle, cheeky poses)
    paw: { a0: ['.kKk.', 'kkkkK', 'kkkkq', '.qkq.'], p0: [0, 1],
           a45: ['kk...', 'kkKk.', '.kkkK', '..kkq', '...q.'], p45: [0, 0] },
    // claw: fingers hooked, pink claw tips out
    claw: { a0: ['..kKn.', '.kkkkn', 'kkkkk.', 'kkkqkn', 'qqkq..', '.q....'], p0: [0, 2],
            a45: ['kk.....', 'kkkKn..', '.kkkkn.', '.kkqk..', '..kq.n.', '.....n.'], p45: [0, 0] }
  };
  HANDS.grip = HANDS.fist;

  // ---------------------------------------------------------------- four-pointed stars (codes = facet slots 0..3)
  // '0' white core, '1' cyan, '2' pink, '3' yellow; gemini.js rotates the facet hues (twinkle)
  var STARS = {
    s3: ['.1.', '102', '.2.'],
    s5: ['..1..', '..0..', '30002', '..0..', '..2..'],
    s7: ['...1...', '...0...', '..101..', '3000002', '..202..', '...0...', '...2...'],
    s9: ['....1....', '....1....', '...101...', '...000...', '330000022', '...000...', '...202...', '....2....', '....2....']
  };

  I.ART = I.ART || {};
  I.ART.gemini = {
    legend: LEGEND,
    hands: HANDS,
    stars: STARS,
    pivot: [17, 27],
    build: function () {
      var set = {
        base: I.parseArt(HEAD, LEGEND, 17, 27),
        eyes: {}, mouth: {}, cache: {},
        eyeAt: [15, 20], mouthAt: [21, 25],
        extras: { blush: { img: I.parseArt(['bb......b'], LEGEND), at: [15, 24] }, flat: { img: I.parseArt(FLAT, LEGEND), at: [0, 3] } }
      };
      Object.keys(EYES).forEach(function (k) { var e = set.eyes[k] = I.parseArt(EYES[k], LEGEND); if (EYE_DY[k]) e.dy = EYE_DY[k]; });
      Object.keys(MOUTHS).forEach(function (k) { var m = set.mouth[k] = I.parseArt(MOUTHS[k], LEGEND); if (MOUTHS[k][0].length >= 5) m.dx = -1; });
      return set;
    }
  };
})();
