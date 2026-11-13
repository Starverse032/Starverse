/* LATENT CLASH — RIG: DeepSeek 娘 base motion (stance + all common anims). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob;
  var def = function (name, d) { return I.defAnim('deepseek', name, d); };
  var S = I.CHARS.deepseek.rest;

  // bouncy boxer idle: two bounces per loop
  def('idle', {
    segs: [['loop', 64, true]], step: 2,
    keys: [
      [0, S],
      [8, bob(S, 0, 2, { hF: [14, -33], hB: [8, -34] }), 'out'],
      [16, bob(S, 0, -1, { hF: [15, -37] }), 'inout'],
      [32, S],
      [40, bob(S, 0, 2, { hF: [13, -33], hB: [8, -34] }), 'out'],
      [48, bob(S, 0, -1, { hB: [8, -38] }), 'inout']
    ]
  });
})();
