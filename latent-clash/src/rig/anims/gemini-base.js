/* LATENT CLASH — RIG: Gemini 娘 base motion (stance + all common anims + airJump).
 * Personality: mischievous, light on her toes, cat-like; the tail never stops, the hair, sleeves, coat panels
 * and skirt follow through.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob;
  // local aliases: coat → book (panel flare), cl → bko (panel lift), st → bk (lead star offset)
  function mapPose(o) {
    if (!o) return o;
    if (o.coat != null) o.book = o.coat;
    if (o.cl != null) o.bko = o.cl;
    if (o.st) o.bk = o.st;
    return o;
  }
  var def = I.defGem = function (name, d) {
    if (d.keys) d.keys.forEach(function (k) { k[1] = mapPose(P(k[1])); });
    return I.defAnim('gemini', name, d);
  };
  var S = I.CHARS.gemini.rest;
  var POSE = I.POSE_GEM = { stance: S };

  // ---------------------------------------------------------------- idle
  def('idle', {
    segs: [['loop', 64, true]], step: 2,
    keys: [[0, S], [16, bob(S, 0, 1, { sq: 1 })], [32, S], [48, bob(S, 0, 1, { sq: 1 })]]
  });
})();
