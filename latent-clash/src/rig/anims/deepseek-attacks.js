/* LATENT CLASH — RIG: DeepSeek 娘 attacks (normals, specials, super).
 * V2: `weapon` anchor = tip of the striking part named by ds.weapon ('hF','hB' palm/knuckles,
 * 'fF','fB' toe, 'kF','kB' knee, 'tail' forward-most fluke point). Spins use `flip`.
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
  var L1 = P(S, HIT, { hip: [2, -46], lean: 12, bend: 2, hF: [29, -67], hB: [3, -58], handF: 'flat', handB: 'fist', fB: [-12, 0], weapon: 'hF', mouth: 'grin' });
  def('5L', {
    segs: sar(4, 3, 7), step: 1,
    keys: [['startup', P(S, ATK)], ['startup+2', L0, 'out'],
      ['active', P(L1, { smear: { part: 'hF', from: 'startup+2', n: 3 } }), 'snap'], ['active+1', L1, 'snap'],
      ['recovery', P(L1, { hF: [25, -66] }), 'out'], ['recovery+4', P(S, ATK, { hF: [19, -59] })], ['recovery+6', S]]
  });
  // 5M: front snap kick, the hem lifted over the thigh (reach 50)
  var M0 = P(S, ATK, { hip: [-2, -47], lean: -8, bend: -4, fF: [14, -22], faF: 40, knF: -1, fB: [-9, 0], hF: [16, -66], hB: [-2, -62], skirt: 0.2 });
  var M1 = P(S, HIT, { hip: [-1, -46], lean: -20, bend: -6, fF: [42, -46], faF: 4, knF: -1, fB: [-10, 0], faB: 10,
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
  var CL = P(C, HIT, { hip: [3, -19], lean: 34, hF: [31, -34], hB: [16, -38], handF: 'flat', weapon: 'hF', mouth: 'grin' });
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
  var JL = P(JF, HIT, { hip: [2, -47], lean: 16, hF: [26, -58], hB: [0, -62], handF: 'flat', weapon: 'hF', mouth: 'grin', skirt: 0.45 });
  def('jL', {
    segs: [['startup', 4], ['active', 8], ['recovery', 12, true]], step: 1,
    keys: [['startup', j0], ['startup+2', P(j0, { hF: [14, -68] }), 'out'],
      ['active', P(JL, { smear: { part: 'hF', from: 'startup+2', n: 3 } }), 'snap'], ['active+2', JL, 'snap'],
      ['recovery', P(j0, { hF: [19, -64] })]]
  });
  // jM: flying knee under the lifted hem (reach 40 at the knee)
  var JM = P(JF, HIT, { hip: [10, -48], lean: -6, bend: -6, fF: [22, -30], faF: 50, knF: -1, fB: [-4, -12], faB: 40,
    hF: [14, -72], hB: [-10, -64], handF: 'fist', weapon: 'kF', skirt: 0.5, tail: -10 });
  def('jM', {
    segs: [['startup', 6], ['active', 6], ['recovery', 12, true]], step: 2,
    keys: [['startup', j0], ['startup+3', P(j0, { fF: [10, -20], faF: 40 }), 'out'],
      ['active', P(JM, { smear: { part: 'kF', from: 'startup+3', n: 3 } }), 'snap'], ['active+2', JM, 'snap'],
      ['recovery', P(j0, { fF: [12, -12] })]]
  });
  // jH: heavy down-forward stomp kick, skirt blown up (reach 48)
  var JH = P(JF, HIT, { hip: [6, -48], lean: 14, bend: 4, fF: [40, -18], faF: 28, knF: -1, fB: [-6, -14], faB: 50,
    hF: [4, -76], hB: [-14, -66], handF: 'open', handB: 'open', weapon: 'fF', skirt: 0.7, tail: -20 });
  def('jH', {
    segs: [['startup', 9], ['active', 6], ['recovery', 12, true]], step: 2,
    keys: [['startup', j0], ['startup+5', P(j0, { lean: -12, fF: [12, -26], faF: 50, hF: [12, -80], hB: [-6, -78], skirt: 0.6 }), 'out'],
      ['active', P(JH, { smear: { part: 'fF', from: 'startup+5', n: 4 } }), 'snap'], ['active+2', JH, 'snap'],
      ['recovery', P(j0, { fF: [16, -10] })]]
  });

  // ================================================================ SPECIALS (V2)
  // rotate a pose about its hip (somersaults): limbs, torso, head, feet and tail turn together
  function spin(pose, deg) {
    var o = P(pose), c = o.hip || S.hip, r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    ['hF', 'hB', 'fF', 'fB'].forEach(function (k) {
      var v = o[k] || S[k], dx = v[0] - c[0], dy = v[1] - c[1];
      o[k] = [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs];
    });
    o.lean = (o.lean || 0) + deg; o.tilt = (o.tilt || 0) + deg;
    o.faF = (o.faF || 0) + deg; o.faB = (o.faB || 0) + deg; o.tail = (o.tail == null ? 0 : o.tail) + deg * 0.5;
    return o;
  }

  // wave: turns her back, raises the tail high and slams it flat on the floor in front (muzzle = impact point)
  var WV0 = P(S, ATK, { hip: [-3, -44], lean: 8, bend: 4, hF: [14, -62], hB: [4, -60], handF: 'fist', tail: 75, arch: 8, tsw: 0.3, muz: [40, 0], z: { tail: -8 } });
  var WV1 = P(S, ATK, { hip: [-4, -46], lean: -6, bend: -8, hF: [12, -70], hB: [-4, -68], handF: 'open', handB: 'open', tail: 98, arch: 8, tsw: 0, skirt: 0.2, muz: [40, 0], z: { tail: -8 },
    eyes: 'focus', mouth: 'teeth' });
  // flipped: authored facing right with the tail slammed down behind = in front on screen
  var WVX = P(S, HIT, { flip: 1, hip: [-6, -34], lean: 26, bend: 8, fF: [8, 0], fB: [-14, 0], faB: 30, hF: [16, -50], hB: [8, -46], handF: 'flat', handB: 'flat',
    tail: 42, arch: -8, pen: -10, tl: 1, tsw: 0, skirt: 0.45, z: { tail: 6 }, weapon: 'tail', muz: [40, 0], eyes: 'focus', mouth: 'shout' });
  def('wave', {
    segs: sar(15, 3, 26), step: 2,
    keys: [['startup', P(S, ATK, { muz: [40, 0] })], ['startup+5', WV0, 'out'], ['startup+11', WV1, 'snap'],
      ['startup+13', P(WVX, { tail: 150, arch: 4, pen: 0, tl: 0, mouth: 'teeth', smear: { part: 'tail', from: 'startup+11', n: 3 } }), 'snap'],
      ['active', P(WVX, { smear: { part: 'tail', from: 'startup+13', n: 4 } }), 'snap'], ['active+2', WVX, 'snap'],
      ['recovery', P(WVX, { mouth: 'grin' }), 'snap'], ['recovery+8', P(WVX, { tail: 60, arch: 2, tl: 0, mouth: 'grin', hip: [-5, -40] }), 'snap'],
      ['recovery+14', P(S, ATK, { hip: [-2, -42], lean: 12, tail: 10, skirt: 0.25, muz: [40, 0] }), 'snap'],
      ['recovery+25', P(S, { muz: [40, 0] })]]
  });

  // breach: rising back somersault — the tail sweeps up through a crescent in front of her
  var BR0 = P(C, ATK, { hip: [0, -24], lean: 20, hF: [20, -40], hB: [8, -38], tail: 0 });
  var BRa = P(S, HIT, { hip: [0, -48], lean: 0, bend: -6, fF: [10, -14], fB: [-4, -2], faF: 30, faB: 40, knF: -1, hF: [-4, -80], hB: [-14, -76],
    handF: 'open', handB: 'open', tail: -10, arch: 4, tl: 1, tsw: 0, skirt: 0.5, z: { tail: 6 }, weapon: 'tail', eyes: 'focus', mouth: 'shout' });
  def('breach', {
    segs: [['startup', 5], ['rise', 12], ['fall', 12, true], ['land', 14]], step: 2,
    keys: [['startup', P(C, ATK)], ['startup+3', BR0, 'snap'],
      ['rise', P(spin(BRa, -50), { smear: { part: 'tail', from: 'startup+3', n: 4 } }), 'snap'],
      ['rise+2', spin(BRa, -100), 'out'], ['rise+5', spin(P(BRa, { mouth: 'grin' }), -150)],
      ['rise+8', spin(P(BRa, { tl: 0, z: {}, mouth: 'grin' }), -210)], ['rise+11', spin(P(JF, ATK, { tl: 0, skirt: 0.8 }), -290)],
      ['fall', spin(P(JF, ATK, { skirt: 0.7, tail: -20, hs: 0.3 }), -360)], ['fall+6', spin(P(JF, ATK, { skirt: 0.6, hB: [-12, -63], tail: -20, hs: 0.15 }), -360)],
      ['land', P(S, { hip: [0, -36], lean: 18, bend: 4, sq: 1, hF: [21, -46], hB: [9, -44], skirt: 0.35, eyes: 'focus' }), 'snap'],
      ['land+3', P(S, ATK, { hip: [0, -40], lean: 14, skirt: 0.1 }), 'out'], ['land+13', S]]
  });

  // chain of thought rekka: 1 lunging water hook · 2 knee under the hem · 3 rising palm uppercut
  var C1a = P(S, ATK, { hip: [-3, -45], lean: 2, bend: -6, hB: [-8, -62], hF: [16, -66], handB: 'fist', z: { armB: 6 } });
  var C1 = P(S, HIT, { hip: [8, -43], lean: 26, bend: 6, fF: [22, 0], fB: [-10, 0], faB: 30, hF: [14, -60], hB: [40, -66], handB: 'fist', handF: 'open',
    z: { armB: 6 }, weapon: 'hB', tail: -10 });
  def('chain1', {
    segs: sar(9, 4, 18), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+5', C1a, 'out'],
      ['active', P(C1, { smear: { part: 'hB', from: 'startup+5', n: 4 } }), 'snap'], ['active+2', C1, 'snap'],
      ['recovery', P(C1, { mouth: 'grin', hB: [36, -64] }), 'out'], ['recovery+12', P(S, ATK, { hip: [2, -45], lean: 10 })], ['recovery+17', S]]
  });
  var C2 = P(S, HIT, { hip: [8, -47], lean: -6, bend: -4, fF: [24, -32], faF: 60, knF: -1, fB: [-4, 0], hF: [26, -70], hB: [18, -72], handF: 'fist', handB: 'fist',
    weapon: 'kF', skirt: 0.3, z: { armB: 6 } });
  def('chain2', {
    segs: sar(7, 4, 20), step: 2,
    keys: [['startup', P(C1, ATK)], ['startup+4', P(S, ATK, { hip: [4, -45], lean: 10, fF: [14, -12], faF: 40, hF: [24, -68], hB: [20, -70], handB: 'fist', z: { armB: 6 } }), 'out'],
      ['active', P(C2, { smear: { part: 'kF', from: 'startup+4', n: 3 } }), 'snap'], ['active+2', C2, 'snap'],
      ['recovery', P(C2, { mouth: 'grin' }), 'out'], ['recovery+8', P(S, ATK, { fF: [14, -6], hip: [3, -45] })], ['recovery+19', S]]
  });
  var C3 = P(S, HIT, { root: [0, -6], hip: [4, -50], lean: -8, bend: -6, tilt: -15, fF: [9, -2], fB: [-8, 0], faF: 40, faB: 30, hF: [18, -96], hB: [-4, -64],
    handF: 'flat', handB: 'fist', weapon: 'hF', mouth: 'shout', skirt: 0.45, tail: -30, arch: 26 });
  def('chain3', {
    segs: sar(9, 5, 26), step: 2,
    keys: [['startup', P(C2, ATK)], ['startup+5', P(C, ATK, { hip: [2, -22], lean: 30, hF: [18, -32], hB: [10, -36], handF: 'flat' }), 'out'],
      ['active', P(C3, { smear: { part: 'hF', from: 'startup+5', n: 5 } }), 'snap'], ['active+2', C3, 'snap'],
      ['recovery', P(C3, { root: [0, -3], mouth: 'grin' }), 'out'], ['recovery+16', P(S, ATK, { skirt: 0.2 })], ['recovery+25', S]]
  });

  // deep dive: dives head-first into the water (floor) and erupts out of it
  def('diveIn', {
    segs: [['startup', 6], ['sink', 6]], step: 2,
    keys: [['startup', P(S, ATK)], ['startup+3', P(S, ATK, { root: [0, -6], hip: [2, -50], lean: -10, hF: [16, -88], hB: [10, -90], handF: 'flat', handB: 'flat', skirt: 0.3, tail: -20 }), 'out'],
      ['sink', P(S, ATK, { root: [8, 4], hip: [4, -40], lean: 70, bend: 6, fF: [-6, -20], fB: [-12, -26], faF: 60, faB: 70, hF: [40, -32], hB: [38, -34], handF: 'flat', handB: 'flat',
        eyes: 'closed', skirt: 0.5, tail: 30 })],
      ['sink+5', P(S, ATK, { root: [14, 36], hip: [4, -40], lean: 85, bend: 6, fF: [-10, -26], fB: [-14, -30], faF: 70, faB: 80, hF: [44, -26], hB: [42, -28], handF: 'flat', handB: 'flat',
        eyes: 'closed', skirt: 0.6, tail: 40 })]]
  });
  var DO = P(S, HIT, { root: [0, -8], hip: [2, -50], lean: -6, bend: -6, tilt: -10, hF: [20, -92], hB: [-8, -70], handF: 'flat', handB: 'open', fF: [6, -2], fB: [-6, 0],
    faF: 40, faB: 30, weapon: 'hF', skirt: 0.6, tail: -30, arch: 26 });
  def('diveOut', {
    segs: sar(6, 5, 22), step: 2,
    keys: [['startup', P(C, ATK, { root: [0, 30], lean: 10, hF: [14, -70], hB: [8, -72], handF: 'flat' })], ['startup+4', P(C, ATK, { root: [0, 10], hF: [16, -60] }), 'out'],
      ['active', P(DO, { smear: { part: 'hF', from: 'startup+4', n: 4 } }), 'snap'], ['active+2', DO, 'snap'],
      ['recovery', P(DO, { root: [0, -3], mouth: 'grin' }), 'out'], ['recovery+12', P(S, { hip: [0, -38], lean: 16, skirt: 0.3 })], ['recovery+21', S]]
  });
  // diveKick: both feet first, down-forward; skirt and tail streaming behind
  var DK = P(JF, HIT, { hip: [-8, -42], lean: 34, bend: 6, fF: [22, -6], fB: [17, -3], drape: { F: 1, B: 1 }, faF: 40, faB: 45, knF: -1, knB: -1, hF: [-12, -62], hB: [-22, -58],
    handF: 'open', handB: 'open', weapon: 'fF', skirt: -0.2, tail: -50, arch: 6, tsw: 0.4 });
  def('diveKick', {
    segs: [['startup', 8], ['active', 10, true], ['land', 12]], step: 2,
    keys: [['startup', P(JF, ATK)], ['startup+5', P(JR, ATK, { fF: [8, -20], fB: [2, -16], faF: 40, faB: 40, lean: -12 }), 'out'],
      ['active', DK], ['active+5', P(DK, { fB: [8, 1], hB: [-23, -57] })],
      ['land', P(S, { hip: [0, -36], lean: 18, sq: 1, hF: [21, -46], hB: [9, -44], skirt: 0.3, eyes: 'focus' }), 'snap'], ['land+5', P(S, ATK)], ['land+11', S]]
  });

  // super 「深度思考·鲸落」: gathers water low, then both arms thrown up to call the whale, held; tail raised
  var SU0 = P(C, ATK, { hip: [0, -20], lean: 30, hF: [24, -26], hB: [16, -24], handF: 'flat', handB: 'flat', eyes: 'closed', mouth: 'shout', tail: 0, arch: 30 });
  var SU1 = P(S, HIT, { hip: [0, -47], lean: -8, bend: -8, tilt: -10, fF: [12, 0], fB: [-12, 0], hF: [20, -96], hB: [-4, -98], handF: 'open', handB: 'open',
    mouth: 'grin', weapon: 'hF', skirt: 0.35, tail: -40, arch: 30, tsw: 1.6 });
  def('super', {
    segs: [['startup', 6], ['cast', 8], ['active', 44], ['recovery', 34]], step: 2,
    keys: [['startup', P(S, ATK)], ['startup+5', SU0, 'out'],
      ['cast', SU0], ['cast+5', P(SU0, { hip: [0, -18] }), 'snap'],
      ['active', P(SU1, { smear: { part: 'hF', from: 'cast+5', n: 4 } }), 'snap'], ['active+3', SU1, 'snap'],
      ['active+22', P(SU1, { hip: [0, -46], hF: [21, -95] })], ['active+42', SU1],
      ['recovery', P(SU1, { mouth: 'smile', eyes: 'happy' }), 'snap'], ['recovery+10', P(SU1, { mouth: 'smile', eyes: 'happy', hF: [18, -80], hB: [0, -82] }), 'out'],
      ['recovery+26', P(S, ATK)], ['recovery+33', S]]
  });
})();
