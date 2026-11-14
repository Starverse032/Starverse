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

  // ================================================================ NORMALS (V2)
  // 5L: snappy water-wrapped lead palm (reach 32)
  var L0 = P(S, ATK, { hip: [-2, -46], lean: 0, bend: -4, hF: [11, -63], hB: [5, -56], handF: 'flat' });
  var L1 = P(S, HIT, { hip: [2, -46], lean: 12, bend: 2, hF: [27, -67], hB: [3, -58], handF: 'flat', handB: 'fist', fB: [-12, 0], weapon: 'hF', mouth: 'grin' });
  def('5L', {
    segs: sar(4, 3, 7), step: 1,
    keys: [['startup', P(S, ATK)], ['startup+2', L0, 'out'],
      ['active', P(L1, { smear: { part: 'hF', from: 'startup+2', n: 3 } }), 'snap'], ['active+1', L1, 'snap'],
      ['recovery', P(L1, { hF: [25, -66] }), 'out'], ['recovery+4', P(S, ATK, { hF: [19, -59] })], ['recovery+6', S]]
  });
  // 5M: front snap kick, the hem lifted over the thigh (reach 50)
  var M0 = P(S, ATK, { hip: [-2, -47], lean: -8, bend: -4, fF: [14, -22], faF: 40, knF: -1, fB: [-9, 0], hF: [16, -66], hB: [-2, -62], skirt: 0.2 });
  var M1 = P(S, HIT, { hip: [-1, -46], lean: -20, bend: -6, fF: [40, -46], faF: 4, knF: -1, fB: [-10, 0], faB: 10,
    hF: [10, -70], hB: [-12, -62], handF: 'fist', handB: 'open', skirt: 0.3, tail: 20, weapon: 'fF' });
  def('5M', {
    segs: sar(7, 4, 12), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+4', M0, 'out'],
      ['active', P(M1, { smear: { part: 'fF', from: 'startup+4', n: 4 } }), 'snap'], ['active+2', M1, 'snap'],
      ['recovery', P(M1, { fF: [30, -36], faF: 20, mouth: 'grin' }), 'out'], ['recovery+6', P(M0, { fF: [14, -12] })], ['recovery+11', S]]
  });
  // 5H: spin and lash — pivots, turns her back, the tail whips round flat at hip height (reach 62)
  var H0 = P(S, ATK, { hip: [-3, -43], lean: 10, bend: 6, fF: [12, 0], fB: [-11, 0], hF: [16, -60], hB: [8, -62], handF: 'fist', tail: -40, arch: 30, tsw: 0.2 });
  var H1 = P(S, ATK, { hip: [-6, -42], lean: -4, bend: -10, fF: [6, 0], fB: [-16, 0], faB: 20, hF: [4, -64], hB: [-12, -60], handF: 'fist',
    tail: 60, arch: 12, tsw: 0, skirt: 0.4, z: { tail: 6 } });
  // drawn mirrored (flip): authored facing right, tail sweeping out behind = forward on screen
  var HX = P(S, HIT, { flip: 1, hip: [-9, -43], lean: 22, bend: 6, fF: [6, 0], fB: [-13, 0], faB: 30, hF: [18, -62], hB: [6, -58], handF: 'open', handB: 'fist',
    tail: 60, arch: -1, pen: 0, tl: 1, tsw: 0, skirt: 0.55, z: { tail: 6 }, weapon: 'tail', eyes: 'focus', mouth: 'teeth' });
  def('5H', {
    segs: sar(10, 5, 19), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+3', H0, 'out'], ['startup+7', P(H0, { hip: [-4, -42], lean: 14, tail: -46, arch: 32 }), 'snap'],
      ['startup+8', P(H1, { flip: 1, smear: { part: 'tail', from: 'startup+7', n: 3 } }), 'snap'],
      ['active', P(HX, { smear: { part: 'tail', from: 'startup+8', n: 4 } }), 'snap'], ['active+2', HX, 'snap'],
      ['recovery', P(HX, { tail: 40, arch: -10, tl: 0, mouth: 'grin' }), 'snap'],
      ['recovery+5', P(S, ATK, { hip: [-3, -43], lean: 8, tail: 20, arch: 4, skirt: 0.3 }), 'snap'],
      ['recovery+12', P(S, ATK, { tail: 5, arch: 16 }), 'inout'], ['recovery+18', S]]
  });

  // ---------------------------------------------------------------- crouching normals
  var c0 = P(C, ATK);
  // 2L: low palm jab (reach 34)
  var CL = P(C, HIT, { hip: [3, -19], lean: 34, hF: [29, -34], hB: [16, -38], handF: 'flat', weapon: 'hF', mouth: 'grin' });
  def('2L', {
    segs: sar(4, 3, 8), step: 1,
    keys: [['startup', c0], ['startup+2', P(c0, { hF: [17, -40], lean: 24 }), 'out'],
      ['active', P(CL, { smear: { part: 'hF', from: 'startup+2', n: 3 } }), 'snap'], ['active+1', CL, 'snap'],
      ['recovery', P(CL, { hF: [27, -35] }), 'out'], ['recovery+7', C]]
  });
  // 2M: low poke kick along the floor, skirt hem pushed out (reach 52)
  var CM = P(C, HIT, { hip: [2, -18], lean: 18, bend: 4, fF: [44, -4], faF: 2, fB: [-8, 0], hF: [22, -42], hB: [12, -36], handF: 'open', weapon: 'fF', skirt: 0.2 });
  def('2M', {
    segs: sar(7, 4, 13), step: 2,
    keys: [['startup', c0], ['startup+4', P(c0, { fF: [18, -8], faF: 20, lean: 22 }), 'out'],
      ['active', P(CM, { smear: { part: 'fF', from: 'startup+4', n: 3 } }), 'snap'], ['active+2', CM, 'snap'],
      ['recovery', P(CM, { fF: [32, -3], mouth: 'grin' }), 'out'], ['recovery+12', C]]
  });
  // 2H: crouching spin — the tail sweeps flat along the floor (reach 66)
  var CH0 = P(C, ATK, { hip: [-2, -18], lean: 34, hF: [26, -36], hB: [18, -32], tail: -20, arch: 30, tsw: 0.2 });
  var CHX = P(C, HIT, { flip: 1, hip: [-13, -17], lean: 36, bend: 4, fF: [8, 0], fB: [-14, 0], faB: 30, hF: [18, -22], hB: [12, -18], handF: 'flat', handB: 'flat',
    tail: 77, arch: -1, tl: 1, tsw: 0, skirt: 0.5, z: { tail: 6 }, weapon: 'tail', eyes: 'focus', mouth: 'teeth' });
  def('2H', {
    segs: sar(10, 5, 22), step: 2,
    keys: [['startup', c0], ['startup+4', CH0, 'out'], ['startup+7', P(CH0, { hip: [0, -17], lean: 38, tail: -30 }), 'snap'],
      ['startup+8', P(CHX, { tail: 30, arch: 10, tl: 0, smear: { part: 'tail', from: 'startup+7', n: 3 } }), 'snap'],
      ['active', P(CHX, { smear: { part: 'tail', from: 'startup+8', n: 4 } }), 'snap'], ['active+2', CHX, 'snap'],
      ['recovery', P(CHX, { tail: 90, arch: -6, tl: 0, mouth: 'grin' }), 'snap'],
      ['recovery+7', P(C, ATK, { tail: 20, arch: 6, skirt: 0.2 }), 'snap'], ['recovery+21', C]]
  });

  // ---------------------------------------------------------------- jump normals
  var j0 = P(JF, ATK, { skirt: 0.4 });
  // jL: downward palm (reach 30)
  var JL = P(JF, HIT, { hip: [2, -47], lean: 16, hF: [24, -58], hB: [0, -62], handF: 'flat', weapon: 'hF', mouth: 'grin', skirt: 0.45 });
  def('jL', {
    segs: [['startup', 4], ['active', 8], ['recovery', 12, true]], step: 1,
    keys: [['startup', j0], ['startup+2', P(j0, { hF: [14, -68] }), 'out'],
      ['active', P(JL, { smear: { part: 'hF', from: 'startup+2', n: 3 } }), 'snap'], ['active+2', JL, 'snap'],
      ['recovery', P(j0, { hF: [19, -64] })]]
  });
  // jM: flying knee under the lifted hem (reach 40 at the knee)
  var JM = P(JF, HIT, { hip: [8, -48], lean: -6, bend: -6, fF: [22, -30], faF: 50, knF: -1, fB: [-4, -12], faB: 40,
    hF: [14, -72], hB: [-10, -64], handF: 'fist', weapon: 'kF', skirt: 0.5, tail: -10 });
  def('jM', {
    segs: [['startup', 6], ['active', 6], ['recovery', 12, true]], step: 2,
    keys: [['startup', j0], ['startup+3', P(j0, { fF: [10, -20], faF: 40 }), 'out'],
      ['active', P(JM, { smear: { part: 'kF', from: 'startup+3', n: 3 } }), 'snap'], ['active+2', JM, 'snap'],
      ['recovery', P(j0, { fF: [12, -12] })]]
  });
  // jH: heavy down-forward stomp kick, skirt blown up (reach 48)
  var JH = P(JF, HIT, { hip: [6, -48], lean: 14, bend: 4, fF: [38, -18], faF: 28, knF: -1, fB: [-6, -14], faB: 50,
    hF: [4, -76], hB: [-14, -66], handF: 'open', handB: 'open', weapon: 'fF', skirt: 0.7, tail: -20 });
  def('jH', {
    segs: [['startup', 9], ['active', 6], ['recovery', 12, true]], step: 2,
    keys: [['startup', j0], ['startup+5', P(j0, { lean: -12, fF: [12, -26], faF: 50, hF: [12, -80], hB: [-6, -78], skirt: 0.6 }), 'out'],
      ['active', P(JH, { smear: { part: 'fF', from: 'startup+5', n: 4 } }), 'snap'], ['active+2', JH, 'snap'],
      ['recovery', P(j0, { fF: [16, -10] })]]
  });

  // ---------------------------------------------------------------- wave: knee-raise → stomp; wave spawns at the leading toe (muzzle)
  var WV0 = P(S, ATK, { hip: [-2, -26], lean: -6, bend: -4, fF: [9, -17], faF: 25, knF: -1, fB: [-8, 0], hF: [10, -48], hB: [-8, -44], handB: 'open', muz: [23, 0] });
  var WV = P(S, HIT, { hip: [4, -17], lean: 18, bend: 6, fF: [19, 0], faF: 0, fB: [-10, 0], hF: [18, -30], hB: [8, -32], handF: 'fist', handB: 'fist', weapon: 'fF', muz: [23, 0] });
  def('wave', {
    segs: sar(15, 3, 26), step: 2,
    keys: [['startup', P(S, ATK, { muz: [23, 0] })], ['startup+7', WV0, 'out'], ['startup+12', P(WV0, { fF: [9, -19], hip: [-2, -27] }), 'snap'],
      ['active', P(WV, { smear: { part: 'fF', from: 'startup+12', n: 3 } }), 'snap'], ['active+2', WV, 'snap'],
      ['recovery', P(WV, { mouth: 'grin' }), 'snap'], ['recovery+10', P(WV, { mouth: 'grin', hip: [3, -19] }), 'out'],
      ['recovery+22', P(S, ATK, { muz: [23, 0] })], ['recovery+25', S]]
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
