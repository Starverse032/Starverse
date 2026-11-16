/* LATENT CLASH — RIG: GPT 娘 attacks (normals, specials, super).
 * `weapon` anchor = tip of the striking part named by ds.weapon ('hF','hB' claw tips, 'fF','fB' toe,
 * 'kF' knee, 'tail' tail tip). Claw swipes carry a teal after-glow (smear + `claw` glow). Tail lashes
 * (5H, 2H, jH) are drawn mirrored (`flip`): she turns her back and the tail whips forward.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P;
  var def = I.defGpt;
  var S = I.CHARS.gpt.rest, C = I.POSE_GPT.crouch, JF = I.POSE_GPT.jumpFall, JR = I.POSE_GPT.jumpRise;
  var ATK = { eyes: 'focus', mouth: 'neutral' };
  var HIT = { eyes: 'focus', mouth: 'teeth' };
  var sar = function (s, a, r) { return [['startup', s], ['active', a], ['recovery', r]]; };
  var jsar = function (s, a) { return [['startup', s], ['active', a], ['recovery', 12, true]]; };

  // ================================================================ NORMALS
  // 5L: economical claw swipe from the shoulder, teal after-glow (reach 36)
  var L0 = P(S, ATK, { hip: [-1, -51], lean: -2, bend: -6, tilt: -4, hF: [7, -79], hB: [-4, -58], handF: 'claw', wing: 0.1 });
  var L1 = P(S, ATK, { hip: [2, -50], lean: 10, bend: 3, tilt: 2, hF: [30, -63], hB: [-6, -60], handF: 'claw', fB: [-10, 0], tw: 5,
    weapon: 'hF', claw: 'F', wing: 0.15 });
  def('5L', {
    segs: sar(6, 3, 9), step: 1,
    keys: [['startup', P(S, ATK)], ['startup+3', L0, 'out'],
      ['active', P(L1, { smear: { part: 'hF', from: 'startup+3', n: 4 } }), 'snap'], ['active+1', P(L1, { smear: { part: 'hF', from: 'startup+4', n: 3 } }), 'snap'],
      ['active+2', L1, 'snap'],
      ['recovery', P(L1, { hF: [28, -62] }), 'out'], ['recovery+5', P(S, ATK, { hF: [20, -64], claw: '' })], ['recovery+8', S]]
  });

  // 5M: high kick through the slit, toe pointed, the skirt panel draping off the thigh (reach 54)
  var M0 = P(S, ATK, { hip: [-2, -52], lean: -6, bend: -4, fF: [14, -24], faF: 40, knF: -1, fB: [-8, 0], hF: [14, -72], hB: [-6, -64],
    skirt: 0.2, tail: 10, drape: { F: 1 }, wing: 0.15 });
  var M1 = P(S, HIT, { hip: [-2, -51], lean: -20, bend: -6, tilt: -6, fF: [46, -60], faF: -16, knF: -1, fB: [-9, 0], faB: 10,
    hF: [10, -76], hB: [-15, -66], handF: 'open', handB: 'open', skirt: 0.35, tail: 26, drape: { F: 1 }, weapon: 'fF', wing: 0.35, wf: -6, mouth: 'neutral' });
  def('5M', {
    segs: sar(9, 4, 15), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+5', M0, 'out'],
      ['active', P(M1, { smear: { part: 'fF', from: 'startup+5', n: 4 } }), 'snap'], ['active+2', M1, 'snap'],
      ['recovery', P(M1, { fF: [38, -50], faF: 4 }), 'out'], ['recovery+7', P(M0, { fF: [14, -14], faF: 20 })], ['recovery+14', S]]
  });

  // 5H: half-turn tail lash — she shows her back, the tail whips round flat at waist height (reach 68)
  var H0 = P(S, ATK, { hip: [-2, -49], lean: 8, bend: 6, fF: [11, 0], fB: [-10, 0], hF: [14, -66], hB: [6, -68], handF: 'claw', tail: -40, arch: 14, tsw: 0.2, wing: 0.25 });
  var HX = P(S, HIT, { flip: 1, hip: [3, -48], lean: 20, bend: 6, fF: [8, 0], fB: [-12, 0], faB: 30, hF: [18, -66], hB: [6, -62], handF: 'open', handB: 'claw',
    tail: 76, arch: 2, pen: 0, tl: 1, tsw: 0, skirt: 0.55, tw: -8, z: { tail: 6 }, weapon: 'tail', wing: 0.55, wf: -12, eyes: 'focus', mouth: 'teeth' });
  def('5H', {
    segs: sar(13, 5, 24), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+4', H0, 'out'], ['startup+9', P(H0, { hip: [-3, -48], lean: 14, tail: -52, arch: 16, wing: 0.35 }), 'snap'],
      ['startup+11', P(HX, { tail: 30, arch: 6, tl: 0, smear: { part: 'tail', from: 'startup+9', n: 3 } }), 'snap'],
      ['active', P(HX, { smear: { part: 'tail', from: 'startup+11', n: 4 } }), 'snap'], ['active+2', HX, 'snap'],
      ['recovery', P(HX, { tail: 56, arch: -4, tl: 0, mouth: 'neutral' }), 'snap'],
      ['recovery+6', P(S, ATK, { hip: [-3, -49], lean: 6, tail: 22, arch: 6, skirt: 0.3, wing: 0.3, hs: 0.3 }), 'snap'],
      ['recovery+14', P(S, ATK, { tail: 6, arch: 9 }), 'inout'], ['recovery+23', S]]
  });

  // ---------------------------------------------------------------- crouching normals
  var c0 = P(C, ATK);
  // 2L: low claw swipe (reach 38)
  var CL = P(C, ATK, { hip: [3, -22], lean: 30, hF: [33, -36], hB: [14, -38], handF: 'claw', weapon: 'hF', claw: 'F' });
  def('2L', {
    segs: sar(6, 3, 10), step: 1,
    keys: [['startup', c0], ['startup+3', P(c0, { hF: [18, -54], lean: 20 }), 'out'],
      ['active', P(CL, { smear: { part: 'hF', from: 'startup+3', n: 4 } }), 'snap'], ['active+2', CL, 'snap'],
      ['recovery', P(CL, { hF: [30, -37] }), 'out'], ['recovery+6', P(C, { claw: '' })], ['recovery+9', C]]
  });
  // 2M: low sliding kick along the floor, the leg out of the slit (reach 56)
  var CM = P(C, HIT, { hip: [4, -20], lean: 12, bend: 4, fF: [48, -3], faF: -4, fB: [-10, 0], hF: [22, -48], hB: [6, -40], handF: 'claw', weapon: 'fF', skirt: 0.25, mouth: 'neutral' });
  def('2M', {
    segs: sar(9, 4, 16), step: 2,
    keys: [['startup', c0], ['startup+5', P(c0, { fF: [20, -8], faF: 20, lean: 18 }), 'out'],
      ['active', P(CM, { smear: { part: 'fF', from: 'startup+5', n: 3 } }), 'snap'], ['active+2', CM, 'snap'],
      ['recovery', P(CM, { fF: [38, -3] }), 'out'], ['recovery+15', C]]
  });
  // 2H: crouching half-turn, the tail sweeps flat along the floor (reach 72, knocks down)
  var CH0 = P(C, ATK, { hip: [-2, -21], lean: 32, hF: [28, -40], hB: [18, -34], tail: -30, arch: 14, tsw: 0.2 });
  var CHX = P(C, HIT, { flip: 1, hip: [-2, -20], lean: 34, bend: 4, fF: [8, 0], fB: [-14, 0], faB: 30, hF: [20, -24], hB: [12, -20], handF: 'flat', handB: 'flat',
    tail: 52, arch: 1.4, tl: 1, tsw: 0, skirt: 0.5, z: { tail: 6 }, weapon: 'tail', wing: 0.5, wf: -6, eyes: 'focus', mouth: 'teeth' });
  def('2H', {
    segs: sar(12, 5, 25), step: 2,
    keys: [['startup', c0], ['startup+4', CH0, 'out'], ['startup+8', P(CH0, { hip: [0, -20], lean: 36, tail: -40 }), 'snap'],
      ['startup+10', P(CHX, { tail: 20, arch: 8, tl: 0, smear: { part: 'tail', from: 'startup+8', n: 3 } }), 'snap'],
      ['active', P(CHX, { smear: { part: 'tail', from: 'startup+10', n: 4 } }), 'snap'], ['active+2', CHX, 'snap'],
      ['recovery', P(CHX, { tail: 60, arch: -4, tl: 0, mouth: 'neutral' }), 'snap'],
      ['recovery+8', P(C, ATK, { tail: 22, arch: 6, skirt: 0.2, hs: 0.3 }), 'snap'], ['recovery+24', C]]
  });

  // ---------------------------------------------------------------- jump normals
  var j0 = P(JF, ATK, { skirt: 0.45 });
  // jL: downward claw rake (reach 32)
  var JL = P(JF, ATK, { hip: [2, -52], lean: 14, hF: [27, -58], hB: [-2, -64], handF: 'claw', weapon: 'hF', claw: 'F', skirt: 0.5 });
  def('jL', {
    segs: jsar(5, 6), step: 1,
    keys: [['startup', j0], ['startup+3', P(j0, { hF: [12, -76] }), 'out'],
      ['active', P(JL, { smear: { part: 'hF', from: 'startup+3', n: 4 } }), 'snap'], ['active+2', JL, 'snap'],
      ['recovery', P(j0, { hF: [20, -64] })]]
  });
  // jM: air kick down-forward through the slit (reach 44)
  var JM = P(JF, HIT, { hip: [2, -52], lean: -10, bend: -6, fF: [36, -30], faF: 20, knF: -1, fB: [-6, -14], faB: 40,
    hF: [12, -76], hB: [-14, -66], handF: 'open', weapon: 'fF', skirt: 0.55, drape: { F: 1 }, tail: 10, mouth: 'neutral' });
  def('jM', {
    segs: jsar(8, 6), step: 2,
    keys: [['startup', j0], ['startup+4', P(j0, { fF: [12, -26], faF: 40, drape: { F: 1 } }), 'out'],
      ['active', P(JM, { smear: { part: 'fF', from: 'startup+4', n: 3 } }), 'snap'], ['active+2', JM, 'snap'],
      ['recovery', P(j0, { fF: [12, -12] })]]
  });
  // jH: mid-air half-turn, the tail lashes down-forward (reach 54)
  var JH0 = P(JF, ATK, { lean: -10, hF: [14, -78], hB: [-4, -76], tail: -40, arch: 14, wing: 0.8, wf: -10 });
  var JHX = P(JF, HIT, { flip: 1, hip: [3, -50], lean: 10, bend: 4, fF: [6, -8], fB: [-8, -14], faF: 30, faB: 40, hF: [18, -66], hB: [6, -70], handF: 'open', handB: 'claw',
    tail: 43, arch: 0.5, tl: 1, tsw: 0, skirt: 0.6, z: { tail: 6 }, weapon: 'tail', wing: 0.7, wf: -16, eyes: 'focus', mouth: 'teeth' });
  def('jH', {
    segs: jsar(11, 6), step: 2,
    keys: [['startup', j0], ['startup+6', JH0, 'out'],
      ['startup+9', P(JHX, { tail: 10, arch: 6, tl: 0, smear: { part: 'tail', from: 'startup+6', n: 3 } }), 'snap'],
      ['active', P(JHX, { smear: { part: 'tail', from: 'startup+9', n: 4 } }), 'snap'], ['active+2', JHX, 'snap'],
      ['recovery', P(j0, { tail: 10, hs: 0.3 })]]
  });
})();
