/* LATENT CLASH — RIG: Claude 娘 base motion (stance + all common anims). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob;
  var def = function (name, d) { return I.defAnim('claude', name, d); };

  var S = I.CHARS.claude.rest;     // en-garde stance
  var POSE = I.POSE_CLAUDE = { stance: S };

  // ---------------------------------------------------------------- idle
  def('idle', {
    segs: [['loop', 64, true]], step: 4,
    keys: [
      [0, S],
      [16, bob(S, 0, 1, { pen: 33, hF: [11, -26], hB: [-7, -30] })],
      [32, bob(S, 0, 1, { pen: 34, hF: [11, -26], sq: 0 })],
      [48, P(S, { pen: 31, sq: -1, hB: [-7, -32] })]
    ]
  });
})();
