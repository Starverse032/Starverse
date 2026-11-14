/* LATENT CLASH — RIG: DeepSeek 娘 attacks (normals, specials, super).
 * Fists and feet: `weapon` anchor = the limb named by ds.weapon ('hF','hB','fF','fB'),
 * or an explicit `wpn: [x, y]`. Water trails on the gloves = smears.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob;
  var def = function (name, d) { return I.defAnim('deepseek', name, d); };
  var S = I.CHARS.deepseek.rest, C = I.POSE_DEEPSEEK.crouch, JF = I.POSE_DEEPSEEK.jumpFall, JR = I.POSE_DEEPSEEK.jumpRise;
  var ATK = { eyes: 'focus', mouth: 'grin' };
  var HIT = { eyes: 'focus', mouth: 'shout' };
  var sar = function (s, a, r) { return [['startup', s], ['active', a], ['recovery', r]]; };

  // ---------------------------------------------------------------- 5L: snappy lead jab (reach 24)
  var L1 = P(S, HIT, { hF: [21, -38], lean: 14, hip: [2, -22], weapon: 'hF', mouth: 'grin' });
  def('5L', {
    segs: sar(4, 3, 7), step: 1,
    keys: [
      ['startup', P(S, ATK)], ['startup+2', P(S, ATK, { hF: [11, -36], lean: 6 }), 'out'],
      ['active', P(L1, { smear: { part: 'hF', from: 'startup+2', n: 3 } }), 'snap'], ['active+1', L1, 'snap'],
      ['recovery', P(L1, { hF: [20, -37] }), 'out'], ['recovery+6', S]
    ]
  });
  // ---------------------------------------------------------------- 5M: front snap kick (reach 38)
  var M1 = P(S, HIT, { hip: [11, -26], lean: -16, bend: -4, fF: [37, -24], faF: -75, knF: -1, fB: [-4, 0], hF: [12, -42], hB: [4, -38], weapon: 'fF' });
  def('5M', {
    segs: sar(7, 4, 12), step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+4', P(S, ATK, { hip: [1, -24], lean: -4, fF: [12, -14], faF: 30, fB: [-7, 0], hF: [12, -40] }), 'out'],
      ['active', P(M1, { smear: { part: 'fF', from: 'startup+4', n: 3 } }), 'snap'], ['active+2', M1, 'snap'],
      ['recovery', P(M1, { fF: [16, -14], faF: 20, mouth: 'grin' }), 'out'], ['recovery+8', P(S, ATK)], ['recovery+11', S]
    ]
  });
  // ---------------------------------------------------------------- 5H: lunging hook-straight with water (reach 44)
  var H1 = P(S, HIT, { hip: [17, -18], lean: 38, bend: 6, fF: [29, 0], fB: [-6, 0], faB: 50, hB: [48, -37], hF: [12, -34], z: { armB: 6 }, weapon: 'hB' });
  def('5H', {
    segs: sar(10, 5, 19), step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+4', P(S, ATK, { hip: [-3, -20], lean: -6, hB: [-6, -38], hF: [14, -40], z: { armB: 6 } }), 'out'],
      ['startup+8', P(S, ATK, { hip: [-3, -19], lean: -8, hB: [-8, -37], hF: [14, -41], z: { armB: 6 } })],
      ['active', P(H1, { smear: { part: 'hB', from: 'startup+8', n: 4 } }), 'snap'], ['active+2', H1, 'snap'],
      ['recovery', P(H1, { mouth: 'grin' }), 'snap'], ['recovery+5', P(H1, { mouth: 'grin', hB: [34, -40] }), 'out'],
      ['recovery+14', P(S, ATK)], ['recovery+18', S]
    ]
  });

  // ---------------------------------------------------------------- crouching normals
  var c0 = P(C, ATK);
  var CL = P(C, HIT, { hF: [21, -13], lean: 32, hip: [1, -12], weapon: 'hF', mouth: 'grin' });
  def('2L', {
    segs: sar(4, 3, 8), step: 1,
    keys: [['startup', c0], ['startup+2', P(c0, { hF: [10, -20], lean: 18 }), 'out'],
      ['active', P(CL, { smear: { part: 'hF', from: 'startup+2', n: 3 } }), 'snap'], ['active+1', CL, 'snap'],
      ['recovery', P(CL, { hF: [19, -14] }), 'out'], ['recovery+7', C]]
  });
  var CM = P(C, HIT, { hip: [5, -12], lean: 10, fF: [33, -4], faF: -70, fB: [-6, 0], weapon: 'fF' });
  def('2M', {
    segs: sar(7, 4, 13), step: 2,
    keys: [['startup', c0], ['startup+4', P(c0, { fF: [14, -6], faF: 20 }), 'out'],
      ['active', P(CM, { smear: { part: 'fF', from: 'startup+4', n: 3 } }), 'snap'], ['active+2', CM, 'snap'],
      ['recovery', P(CM, { fF: [20, -3], mouth: 'grin' }), 'out'], ['recovery+12', C]]
  });
  var CH = P(C, HIT, { hip: [14, -8], lean: 42, fF: [41, -1], faF: -88, fB: [6, 0], hF: [20, -6], hB: [14, -4], handF: 'flat', handB: 'flat', weapon: 'fF' });
  def('2H', {
    segs: sar(10, 5, 22), step: 2,
    keys: [['startup', c0], ['startup+6', P(c0, { hip: [0, -10], lean: 26, fF: [10, -3], hF: [8, -12], handF: 'flat' }), 'out'],
      ['active', P(CH, { smear: { part: 'fF', from: 'startup+6', n: 5 } }), 'snap'], ['active+2', CH, 'snap'],
      ['recovery', P(CH, { mouth: 'grin' }), 'snap'], ['recovery+10', P(CH, { fF: [22, 0], faF: 0, mouth: 'grin' }), 'out'], ['recovery+21', C]]
  });

  // ---------------------------------------------------------------- jump normals
  var j0 = P(JF, ATK);
  var JL = P(JF, HIT, { hF: [19, -22], lean: 20, weapon: 'hF', mouth: 'grin' });
  def('jL', {
    segs: [['startup', 4], ['active', 8], ['recovery', 12, true]], step: 1,
    keys: [['startup', j0], ['startup+2', P(j0, { hF: [12, -36] }), 'out'],
      ['active', P(JL, { smear: { part: 'hF', from: 'startup+2', n: 3 } }), 'snap'], ['active+2', JL, 'snap'],
      ['recovery', P(j0, { hF: [16, -34] })]]
  });
  var JM = P(JF, HIT, { hip: [0, -30], lean: -12, fF: [23, -6], faF: -35, fB: [-4, -8], weapon: 'fF' });
  def('jM', {
    segs: [['startup', 6], ['active', 6], ['recovery', 12, true]], step: 2,
    keys: [['startup', j0], ['startup+3', P(j0, { fF: [8, -14], faF: 30 }), 'out'],
      ['active', P(JM, { smear: { part: 'fF', from: 'startup+3', n: 3 } }), 'snap'], ['active+2', JM, 'snap'],
      ['recovery', P(j0, { fF: [10, -6] })]]
  });
  var JH = P(JF, HIT, { hip: [10, -29], lean: 26, fF: [25, -4], faF: 20, fB: [2, -12], hF: [12, -46], hB: [0, -44], weapon: 'fF' });
  def('jH', {
    segs: [['startup', 9], ['active', 6], ['recovery', 12, true]], step: 2,
    keys: [['startup', j0], ['startup+5', P(j0, { lean: -10, fF: [6, -16], faF: 40, hF: [10, -48], hB: [0, -50] }), 'out'],
      ['active', P(JH, { smear: { part: 'fF', from: 'startup+5', n: 4 } }), 'snap'], ['active+2', JH, 'snap'],
      ['recovery', P(j0, { fF: [12, -4] })]]
  });

  // ---------------------------------------------------------------- wave: double-fist ground slam (muzzle = leading foot)
  var WV = P(S, HIT, { hip: [3, -14], lean: 40, bend: 8, hF: [20, -6], hB: [16, -6], handF: 'flat', handB: 'flat', fF: [14, 0], weapon: 'hF', muz: [20, 0] });
  def('wave', {
    segs: sar(15, 3, 26), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+6', P(S, ATK, { hip: [-1, -25], lean: -10, hF: [8, -56], hB: [2, -58], handF: 'fist', handB: 'fist', muz: [20, 0] }), 'out'],
      ['startup+12', P(S, ATK, { hip: [-1, -26], lean: -12, hF: [6, -58], hB: [0, -59], muz: [20, 0] })],
      ['active', P(WV, { smear: { part: 'hF', from: 'startup+12', n: 4 } }), 'snap'], ['active+2', WV, 'snap'],
      ['recovery', P(WV, { mouth: 'grin' }), 'snap'], ['recovery+12', P(WV, { mouth: 'grin', hip: [2, -16] }), 'out'],
      ['recovery+22', P(S, ATK, { muz: [20, 0] })], ['recovery+25', S]]
  });

  // ---------------------------------------------------------------- breach: rising whale-tail somersault kick
  var BR = P(JR, HIT, { hip: [2, -34], lean: -40, bend: -10, tilt: -25, fF: [24, -60], faF: -60, knF: -1, fB: [-2, -8], faB: 40,
    hF: [-8, -30], hB: [-12, -34], handF: 'open', handB: 'open', weapon: 'fF' });
  def('breach', {
    segs: [['startup', 5], ['rise', 12], ['fall', 12, true], ['land', 14]], step: 2,
    keys: [
      ['startup', P(C, ATK)], ['startup+3', P(C, ATK, { hip: [0, -11], lean: 30 })],
      ['rise', P(BR, { smear: { part: 'fF', from: 'startup+3', n: 5 } }), 'snap'], ['rise+2', BR, 'snap'],
      ['rise+7', P(BR, { lean: -70, tilt: -55, fF: [12, -66], hF: [-14, -40], mouth: 'grin' })],
      ['fall', P(JF, ATK, { fF: [6, -8], fB: [-6, -10], faF: 30 })], ['fall+6', P(JF, ATK)],
      ['land', P(S, { hip: [0, -14], lean: 22, hF: [14, -25], hB: [6, -26], eyes: 'focus' })], ['land+7', P(S, ATK)], ['land+13', S]
    ]
  });

  // ---------------------------------------------------------------- chain of thought rekka
  var C1 = P(S, HIT, { hip: [8, -20], lean: 30, fF: [20, 0], fB: [-8, 0], faB: 30, hF: [32, -38], hB: [6, -36], weapon: 'hF' });
  def('chain1', {
    segs: sar(9, 4, 18), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+5', P(S, ATK, { hip: [-2, -20], lean: 4, hF: [6, -38] }), 'out'],
      ['active', P(C1, { smear: { part: 'hF', from: 'startup+5', n: 4 } }), 'snap'], ['active+2', C1, 'snap'],
      ['recovery', P(C1, { mouth: 'grin' }), 'out'], ['recovery+14', P(S, ATK)], ['recovery+17', S]]
  });
  var C2 = P(S, HIT, { hip: [6, -26], lean: -6, fF: [12, -22], faF: 50, knF: -1, fB: [-6, 0], hF: [14, -44], hB: [4, -44], wpn: [16, -30] });
  def('chain2', {
    segs: sar(7, 4, 20), step: 2,
    keys: [['startup', P(C1, ATK)], ['startup+4', P(S, ATK, { hip: [2, -22], lean: 10, fF: [8, -6], hF: [14, -40], hB: [6, -40] }), 'out'],
      ['active', P(C2, { smear: { part: 'fF', from: 'startup+4', n: 3 } }), 'snap'], ['active+2', C2, 'snap'],
      ['recovery', P(C2, { mouth: 'grin' }), 'out'], ['recovery+16', P(S, ATK)], ['recovery+19', S]]
  });
  var C3 = P(S, HIT, { root: [0, -4], hip: [4, -30], lean: -8, tilt: -15, fF: [8, -4], fB: [-6, 0], faF: 40, hF: [16, -64], hB: [0, -40], weapon: 'hF', mouth: 'shout' });
  def('chain3', {
    segs: sar(9, 5, 26), step: 2,
    keys: [['startup', P(C2, ATK)], ['startup+5', P(C, ATK, { hip: [2, -12], lean: 26, hF: [10, -16] }), 'out'],
      ['active', P(C3, { smear: { part: 'hF', from: 'startup+5', n: 5 } }), 'snap'], ['active+2', C3, 'snap'],
      ['recovery', P(C3, { root: [0, -2], mouth: 'grin' }), 'out'], ['recovery+18', P(S, ATK)], ['recovery+25', S]]
  });

  // ---------------------------------------------------------------- deep dive
  def('diveIn', {
    segs: [['startup', 6], ['sink', 6]], step: 2,
    keys: [['startup', P(S, ATK)], ['startup+3', P(C, ATK, { hF: [16, -50], hB: [12, -52], handF: 'flat', handB: 'flat', lean: 30 }), 'out'],
      ['sink', P(C, ATK, { root: [6, 6], lean: 70, hF: [24, -4], hB: [22, -6], handF: 'flat', handB: 'flat', eyes: 'closed' })],
      ['sink+5', P(C, ATK, { root: [10, 30], lean: 80, hF: [28, 0], hB: [26, -2], handF: 'flat', handB: 'flat', eyes: 'closed' })]]
  });
  var DO = P(S, HIT, { root: [0, -6], hip: [2, -30], lean: -6, tilt: -10, hF: [14, -62], hB: [-6, -48], handB: 'open', fF: [4, -2], fB: [-6, 0], faF: 40, weapon: 'hF' });
  def('diveOut', {
    segs: sar(6, 5, 22), step: 2,
    keys: [['startup', P(C, ATK, { root: [0, 26], lean: 10, hF: [12, -40], hB: [6, -42] })], ['startup+4', P(C, ATK, { root: [0, 8] }), 'out'],
      ['active', P(DO, { smear: { part: 'hF', from: 'startup+4', n: 4 } }), 'snap'], ['active+2', DO, 'snap'],
      ['recovery', P(DO, { root: [0, -2], mouth: 'grin' }), 'out'], ['recovery+14', P(S, { hip: [0, -17], lean: 18 })], ['recovery+21', S]]
  });
  var DK = P(JF, HIT, { hip: [-6, -24], lean: 34, fF: [10, 0], faF: 30, fB: [-12, -14], faB: 60, hF: [-4, -38], hB: [-14, -36], handF: 'open', handB: 'open', weapon: 'fF' });
  def('diveKick', {
    segs: [['startup', 8], ['active', 10, true], ['land', 12]], step: 2,
    keys: [['startup', P(JF, ATK)], ['startup+5', P(JR, ATK, { fF: [6, -14], faF: 40, lean: -8 }), 'out'],
      ['active', DK], ['active+5', P(DK, { fB: [-12, -13] })],
      ['land', P(S, { hip: [0, -14], lean: 22, hF: [14, -25], hB: [6, -26], eyes: 'focus' })], ['land+7', P(S, ATK)], ['land+11', S]]
  });

  // ---------------------------------------------------------------- super: crouch-gather, snap-point upward, held
  var SU0 = P(C, ATK, { hip: [0, -12], lean: 30, hF: [14, -8], hB: [9, -8], handF: 'flat', handB: 'flat', eyes: 'closed', mouth: 'shout' });
  var SU1 = P(S, HIT, { hip: [1, -26], lean: -10, bend: -6, tilt: -15, hF: [16, -62], handF: 'point', hB: [-6, -36], handB: 'fist',
    fF: [12, 0], fB: [-11, 0], mouth: 'grin', weapon: 'hF' });
  def('super', {
    segs: [['startup', 6], ['cast', 8], ['active', 44], ['recovery', 34]], step: 2,
    keys: [['startup', P(S, ATK)], ['startup+5', SU0, 'out'],
      ['cast', SU0], ['cast+5', P(SU0, { hip: [0, -11] }), 'snap'],
      ['active', P(SU1, { smear: { part: 'hF', from: 'cast+5', n: 4 } }), 'snap'], ['active+3', SU1, 'snap'],
      ['active+22', bob(SU1, 0, 1)], ['active+42', SU1],
      ['recovery', P(SU1, { mouth: 'smile' }), 'snap'], ['recovery+10', P(SU1, { mouth: 'smile', hF: [14, -50] }), 'out'],
      ['recovery+26', P(S, ATK)], ['recovery+33', S]]
  });
})();
