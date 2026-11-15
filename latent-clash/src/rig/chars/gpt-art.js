/* LATENT CLASH — RIG: GPT 娘 hand-authored pixel stamps (head with horns, faces, hands).
 * Facing right, 3/4 view. White wavy hair with lavender shading, two curved horns sweeping
 * up and back (scale ramp), a pointed ear with a platinum drop earring (teal bead), a knot
 * rosette at the near horn base, pale lavender half-lidded eyes. Long hair locks, ahoge,
 * wings, tail and the blob companion are dynamic (gpt.js).
 * Materials: M.legs = scale ramp (horns), M.white = blob, M.shoe = wing membrane.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col;

  var LEGEND = {
    'h': col(M.hair, 1), 'H': col(M.hair, 0), 's': col(M.hair, 2), 'd': col(M.hair, 3),
    't': col(M.tip, 1), 'T': col(M.tip, 0),
    'K': col(M.skin, 0), 'k': col(M.skin, 1), 'q': col(M.skin, 2), 'Q': col(M.skin, 3),
    'o': 1,
    'w': col(M.eye, 0), 'e': col(M.eye, 1), 'E': col(M.eye, 2), 'x': col(M.eye, 3),
    'b': col(M.blush, 1), 'r': col(M.blush, 3), 'R': col(M.blush, 0),
    'W': col(M.c1, 0), 'c': col(M.c1, 1), 'C': col(M.c1, 2), 'v': col(M.c1, 3),
    'L': col(M.legs, 0), 'l': col(M.legs, 1), 'j': col(M.legs, 2), 'J': col(M.legs, 3),
    'M': col(M.metal, 0), 'm': col(M.metal, 1), 'g': col(M.metal, 2),
    'A': col(M.acc, 0), 'a': col(M.acc, 1),
    '-': 255
  };

  // pivot (under the jaw) = column 19, row 26. Crown row 10 (16 above the pivot), horn tips row 2, chin row 27.
  var HEAD = [
    '..............................',
    '..............................',
    '.jL...........................',
    '..JlL.........................',
    '...jllL.......................',
    '....JllL...jL.................',
    '.....jlllL..JlL...............',
    '......JlllL..jllL.............',
    '.......jjllL..JllL............',
    '.......JjjllL..jjlL...........',
    '........jjjllHhJjjl...........',
    '.......shhjjlhHHHHHhjjhhs.....',
    '......shhhhhHHhhhhhhHHHhhs....',
    '.....svWvhhhhhshhhhhhhhhhhs...',
    '....svWcWvhhhhshhhhhshhhhhhs..',
    '...shWvoWvhhhshhhhhshhhhhhhhs.',
    '..shhvWcWvhhshhhhhshhhhshhhhs.',
    '..shhhvWvhqhshhhhshhhhdhhhhhs.',
    '..shhhhmhhQKhhhsdkkhhsdkkkhhs.',
    '..shhhhmhhQkKkhqkkkkkkkkkkkhhs',
    '..shhhhghhhQkkqqkkkkkkkkkkkhhs',
    '.shhhhhhhhhhQqqqkkkkkkkkkkkhhs',
    '.shhhhhhhhhhhmQqkkkkkkkkkkqhhs',
    '.shhshhhhhhhhMqkkkkkkkkkkkkhs.',
    '.shhshhhhhhhha.qkkkkkkkkkkks..',
    '.shhhshhhhhhhs...qqkkkkkkkq...',
    '.sshhhshhhhhs......qqkkkkq....',
    '..sshhhshhs..........qqqq.....'
  ];

  // eye overlay: near eye cols 0-3, far eye cols 7-9 (placed at eyeAt). 'open' = her cool half-lidded gaze.
  var EYES = {
    open: [
      'ooooo..ooo.',
      '.xEw....xw.',
      '.eEe...eE..',
      '...........'
    ],
    half: [
      '...........',
      'ooooo..ooo.',
      '.eEe...eE..',
      '...........'
    ],
    closed: [
      '...........',
      '...........',
      '.ooo...oo..',
      '...........'
    ],
    happy: [
      '...........',
      '.ooo....oo.',
      'o...o..o..o',
      '...........'
    ],
    focus: [
      'oo.......o.',
      '.oooo..ooo.',
      '.xEw....xw.',
      '..eo...eo..'
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
      '...o....o..',
      'ooooo..ooo.',
      '.xEw....xw.',
      '.ee....e...'
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
    neutral: ['.oo'],
    smile:   ['o..o', '.oo.'],
    open:    ['.oo.', 'orro', '.oo.'],
    shout:   ['oooo', 'oWrr', 'orRr', '.oo.'],
    teeth:   ['oooo', 'oWWo', '.oo.'],
    hurt:    ['.o.o', 'o.o.'],
    o:       ['.o.', 'oro', '.o.'],
    frown:   ['.oo.', 'o..o'],
    grin:    ['oooo', 'oWWo', '.oo.'],
    breath:  ['oooo', 'oaAa', 'oaao', '.oo.']
  };

  // ---------------------------------------------------------------- hands (slender, long-fingered; claws)
  // pointing right (a0) and down-right (a45); wrist at the pivot. k/K/q = skin, n = nail (platinum-white).
  var HAND_LEGEND = { 'k': col(M.skin, 1), 'K': col(M.skin, 0), 'q': col(M.skin, 2), 'Q': col(M.skin, 3), 'o': 1, 'n': col(M.c1, 0) };
  var HANDS = {
    id: 'gpt', legend: HAND_LEGEND,
    fist: { a0: ['.kKK.', 'kkkkK', 'kkkkk', 'qkqkq', '.qqq.'], p0: [0, 2],
            a45: ['kk...', 'kkKK.', '.kkkK', '.kkkk', '..qkq', '...q.'], p45: [0, 0] },
    open: { a0: ['...KKn', '.kkkkK', 'kkkkkkn', 'kkkqq.', 'qqk...', '.q....'], p0: [0, 2],
            a45: ['kk....', 'kkk...', '.kkKk.', '.kkkkK', '..qkkkn', '...q.q.', '......n'], p45: [0, 0] },
    flat: { a0: ['...kK', '...kK', '..kkK', 'kkkkk', 'kkkkq', 'qkkq.', '.qq..'], p0: [0, 3],
            a45: ['.kK...', 'kkkK..', 'kkkkK.', '.kkkkq', '..qqq.'], p45: [0, 1] },
    relax: { a0: ['.kK..', 'kkkK.', 'kkkkq', 'qkqq.', '.q...'], p0: [0, 1],
             a45: ['kk..', 'kkK.', '.kkK', '.qkk', '..qk', '...q'], p45: [0, 0] },
    point: { a0: ['.kK.....', 'kkkkkkkn', 'kkkkqq..', 'qkqk....', '.qq.....'], p0: [0, 2],
             a45: ['kk....', 'kkK...', '.kkkK.', '.kkqkK', '..qq.k', '......'], p45: [0, 0] },
    // claw: fingers bent like talons, nails out
    claw: { a0: ['..kKn..', '.kkkkKn', 'kkkkk.n', 'kkkqkKn', 'qqkq..n', '.q.....'], p0: [0, 2],
            a45: ['kk.....', 'kkkKn..', '.kkkkKn', '.kkqkk.', '..kq.kn', '..n..n.'], p45: [0, 0] }
  };
  HANDS.grip = HANDS.fist;

  I.ART = I.ART || {};
  I.ART.gpt = {
    legend: LEGEND,
    hands: HANDS,
    pivot: [19, 26],
    build: function () {
      var set = {
        base: I.parseArt(HEAD, LEGEND, 19, 26),
        eyes: {}, mouth: {}, cache: {},
        eyeAt: [16, 19], mouthAt: [21, 24],
        extras: { blush: { img: I.parseArt(['bb.....b'], LEGEND), at: [16, 22] } }
      };
      Object.keys(EYES).forEach(function (k) { var e = set.eyes[k] = I.parseArt(EYES[k], LEGEND); if (EYE_DY[k]) e.dy = EYE_DY[k]; });
      Object.keys(MOUTHS).forEach(function (k) { set.mouth[k] = I.parseArt(MOUTHS[k], LEGEND); });
      return set;
    }
  };
})();
