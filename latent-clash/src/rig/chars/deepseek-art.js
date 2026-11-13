/* LATENT CLASH — RIG: DeepSeek 娘 hand-authored pixel stamps (head, faces).
 * Facing right, 3/4 view; blue bob, blunt fringe, upturned bright eyes, fang.
 * Pigtails and the spout ahoge are dynamic chains (chars/deepseek.js).
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col;

  var LEGEND = Object.assign({}, I.ART.claude.legend);

  var HEAD = [
    //0123456789012345678901
    '........hhhhh.........',  // 0
    '......hhhhhhhhh.......',  // 1
    '....shhhhhhhhhhhh.....',  // 2
    '...shhhhhHHHHhhhhh....',  // 3
    '..shhhhhHHhhHHHhhhh...',  // 4
    '..shhhhhhhhhhhhhhhhh..',  // 5
    '.sshhhhhhhhhhhhhhhhhh.',  // 6
    '.sshhhhhhhhhhhhhhhhhh.',  // 7
    '.sshhhhhhhshhhhshhhhhh',  // 8
    'sshhhhhhshhhhshhhhshhh',  // 9
    'sshhhhhhkhkkkhkkkkhkhh',  // 10
    'sshhhhhhkkkkkkkkkkkkhh',  // 11
    'sshhhhhkkkkkkkkkkkkkhh',  // 12
    'sshhhhhkkkkkkkkkkkkkhs',  // 13
    'sshhhhhkkkkkkkkkkkkkhs',  // 14
    'sshhhhhkkkkkkkkkkkkkh.',  // 15
    'sshhhhhkkkkkkkkkkkkks.',  // 16
    '.sshhhhqkkkkkkkkkkks..',  // 17
    '.sshhhs.qkkkkkkkkk....',  // 18
    '..ssss...qqkkkkk......',  // 19
    '...........qqk........'   // 20
  ];

  var EYES = {
    open: [
      'o.......o..',
      '.ooo...ooo.',
      '.xwE....xw.',
      '.eEe....Ee.',
      '.wee....e..',
      '...........'
    ],
    half: [
      '...........',
      '...........',
      'oooo...ooo.',
      '.eEe....Ee.',
      '.wee....e..',
      '...........'
    ],
    closed: [
      '...........',
      '...........',
      '...........',
      'oooo...ooo.',
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
      'o........o.',
      '.oo....oo..',
      '.ooo...ooo.',
      '.xwE....xw.',
      '.eEe....E..',
      '...........'
    ],
    shut: [
      '...........',
      'o.......o..',
      '.ooo...ooo.',
      'o.......o..',
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
      '...o....o..',
      '.oo......o.',
      '.ooo...ooo.',
      '.xwE....xw.',
      '.wee....e..',
      '...........'
    ],
    wide: [
      'o.......o..',
      '.ooo...ooo.',
      '.xwE....xw.',
      '.ewe....we.',
      '.eee....e..',
      '...........'
    ]
  };

  var MOUTHS = {
    neutral: ['....', '.QQ.', '....'],
    smile:   ['....', 'o..o', '.oW.'],
    open:    ['.oo.', 'orro', '.oo.'],
    shout:   ['oooo', 'oWrr', '.oo.'],
    teeth:   ['....', 'oWWo', '.oo.'],
    hurt:    ['....', 'o.o.', '.o.o'],
    o:       ['.o..', 'oro.', '.o..'],
    frown:   ['....', '.QQ.', 'Q..Q'],
    grin:    ['oooo', 'oWrr', '.oo.']
  };

  I.ART.deepseek = {
    legend: LEGEND,
    build: function () {
      var set = {
        base: I.parseArt(HEAD, LEGEND, 9, 19),
        eyes: {}, mouth: {}, cache: {},
        eyeAt: [8, 10], mouthAt: [13, 16],
        extras: { blush: { img: I.parseArt(['bb.....bb'], LEGEND), at: [9, 15] } }
      };
      Object.keys(EYES).forEach(function (k) { set.eyes[k] = I.parseArt(EYES[k], LEGEND); });
      Object.keys(MOUTHS).forEach(function (k) { set.mouth[k] = I.parseArt(MOUTHS[k], LEGEND); });
      return set;
    }
  };
})();
