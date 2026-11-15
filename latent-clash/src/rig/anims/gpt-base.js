/* LATENT CLASH — RIG: GPT 娘 base motion (stance + all common anims).
 * Personality: regal, composed, economical; the tail, wings, sleeves and hair carry the life.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob, G = I.gen;
  // local aliases: wing → book channel (spread), wf → bko (raise deg), blob → bk (companion offset)
  function mapPose(o) {
    if (!o) return o;
    if (o.wing != null) o.book = o.wing;
    if (o.wf != null) o.bko = o.wf;
    if (o.blob) o.bk = o.blob;
    return o;
  }
  var def = I.defGpt = function (name, d) {
    if (d.keys) d.keys.forEach(function (k) { k[1] = mapPose(P(k[1])); });
    return I.defAnim('gpt', name, d);
  };
  var S = I.CHARS.gpt.rest;
  var POSE = I.POSE_GPT = { stance: S };

  // ---------------------------------------------------------------- idle: slow breathing, weight shift, claw flex
  var IN = P(S, { hip: [0, -50], bend: -2, hF: [16, -65], hB: [-2, -56], sq: 1 });
  var WB = P(S, { hip: [-1, -51], lean: -1, hF: [15, -66], hB: [-3, -57], head: [-1, 0], tail: 4 });
  def('idle', {
    segs: [['loop', 64, true]], step: 2,
    keys: [[0, S], [12, P(IN, { wing: 0.08 })], [24, P(S, { hF: [17, -67] })], [34, WB], [46, P(WB, { hip: [-1, -50], sq: 1, wing: 0.1, handF: 'relax' })], [56, P(S, { handF: 'relax' })]]
  });
})();
