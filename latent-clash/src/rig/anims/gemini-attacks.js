/* LATENT CLASH — RIG: Gemini 娘 attacks (normals, specials, super).
 * `weapon` anchor = tip of the striking part named by ds.weapon ('hF','hB' claw tips, 'fF','fB' toe, 'heelF'/'heelB'
 * heel, 'kF' knee, 'tail' tail tip). Claw swipes (L) carry a pink after-glow (smear + `claw` glow); M = nimble kicks
 * with the platform shoes; H = spinning heel + tail attacks, drawn mirrored (`flip`): she turns her back and the
 * heel / tail come round toward the opponent. In flipped poses `wpn` / `muz` / `grab` are given in SCREEN space.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P;
  var def = I.defGem, spin = I.gemSpin;
  var S = I.CHARS.gemini.rest, C = I.POSE_GEM.crouch, JF = I.POSE_GEM.jumpFall, JR = I.POSE_GEM.jumpRise;
  var ATK = { eyes: 'focus', mouth: 'cat' };
  var HIT = { eyes: 'focus', mouth: 'teeth' };
  var sar = function (s, a, r) { return [['startup', s], ['active', a], ['recovery', r]]; };
  var jsar = function (s, a) { return [['startup', s], ['active', a], ['recovery', 12, true]]; };

  // ================================================================ NORMALS
  // 5L: quick cat swipe — paw cocked up by the ear, rakes down-forward, pink after-glow (reach 30)
  var L0 = P(S, ATK, { hip: [-1, -50], lean: -2, bend: -6, tilt: -6, hF: [8, -80], hB: [2, -60], handF: 'claw', faB: 20, tail: 10 });
  var L1 = P(S, ATK, { hip: [2, -49], lean: 12, bend: 4, tilt: 4, hF: [24, -60], hB: [-4, -62], handF: 'claw', handB: 'paw', fB: [-10, 0], faB: 24,
    tw: 6, weapon: 'hF', claw: 'F', tail: -8, coat: 0.2, mouth: 'teeth' });
  def('5L', {
    segs: sar(4, 3, 7), step: 1,
    keys: [['startup', P(S, ATK)], ['startup+2', L0, 'out'],
      ['active', P(L1, { smear: { part: 'hF', from: 'startup+2', n: 4 } }), 'snap'], ['active+1', P(L1, { hF: [25, -58], smear: { part: 'hF', from: 'startup+3', n: 3 } }), 'snap'],
      ['active+2', P(L1, { hF: [25, -57] }), 'snap'],
      ['recovery', P(L1, { hF: [22, -56], claw: '' }), 'out'], ['recovery+4', P(S, ATK, { hF: [18, -60] })], ['recovery+6', S]]
  });

  // 5M: snap front kick with the platform shoe, toe up, leaning back for balance, the skirt flips up (reach 48)
  var M0 = P(S, ATK, { hip: [-2, -51], lean: -6, bend: -4, fF: [12, -22], faF: 50, knF: -1, fB: [-8, 0], faB: 10, hF: [14, -70], hB: [-4, -64],
    skirt: 0.25, drape: { F: 1 }, tail: 16, coat: 0.2 });
  var M1 = P(S, HIT, { hip: [-4, -51], lean: -18, bend: -6, tilt: -8, fF: [38, -44], faF: -40, knF: -1, fB: [-9, 0], faB: 8,
    hF: [10, -74], hB: [-16, -66], handF: 'open', handB: 'open', skirt: 0.45, hem: -3, drape: { F: 1 }, weapon: 'fF', tail: 30, coat: 0.45, cl: 10, mouth: 'cat' });
  def('5M', {
    segs: sar(7, 4, 12), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+4', M0, 'out'],
      ['active', P(M1, { smear: { part: 'fF', from: 'startup+4', n: 4 } }), 'snap'], ['active+2', P(M1, { fF: [38, -45] }), 'snap'],
      ['recovery', P(M1, { fF: [32, -36], faF: -10 }), 'out'], ['recovery+6', P(M0, { fF: [12, -12], faF: 20 })], ['recovery+11', S]]
  });

  // 5H: spinning heel kick — pivots, shows her back (flip), the lead leg whips round heel-first at waist height,
  // the tail lashing round with it (reach 58)
  var H0 = P(S, ATK, { hip: [-2, -49], lean: 6, bend: 4, fF: [10, 0], fB: [-10, 0], faB: 30, hF: [16, -66], hB: [6, -66], handF: 'claw', tail: -30, arch: 14, tsw: 0.2, coat: 0.3 });
  var HT = P(S, ATK, { flip: 1, hip: [1, -48], lean: 18, bend: 4, tilt: -10, fF: [4, -8], faF: 40, knF: -1, fB: [-2, 0], faB: 20, hF: [16, -60], hB: [8, -62], handF: 'open', handB: 'claw',
    tail: 30, arch: 6, coat: 0.8, cl: 20, skirt: 0.5, hem: -3, tw: -10, z: { tail: 6 } });
  var HX = P(S, HIT, { flip: 1, hip: [4, -50], lean: 34, bend: 6, tilt: -24, fF: [-44, -50], faF: 96, knF: 1, fB: [2, 0], faB: 30, hF: [20, -50], hB: [12, -46], handF: 'open', handB: 'flat',
    tail: 34, arch: 2, tl: 1, tsw: 0, skirt: 0.6, hem: -4, tw: -12, coat: 1, cl: 30, z: { tail: 6 }, weapon: 'heelF', wpn: [58, -50], drape: { F: 1 } });
  def('5H', {
    segs: sar(10, 5, 20), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+3', H0, 'out'], ['startup+6', P(HT, { tl: 0 }), 'snap'],
      ['startup+8', P(HT, { fF: [-20, -36], faF: 70, hip: [3, -49], lean: 26, tail: 20, smear: { part: 'heelF', from: 'startup+6', n: 3 } }), 'snap'],
      ['active', P(HX, { smear: { part: 'heelF', from: 'startup+8', n: 4 } }), 'snap'], ['active+2', P(HX, { fF: [-45, -51], wpn: [59, -51] }), 'snap'],
      ['recovery', P(HX, { fF: [-38, -42], wpn: [52, -42], tl: 0, tail: 40, mouth: 'cat' }), 'snap'],
      ['recovery+5', P(HT, { fF: [2, -14], faF: 30, tl: 0, hs: 0.3, eyes: 'focus' }), 'snap'],
      ['recovery+10', P(S, ATK, { hip: [-1, -46], lean: 10, sq: 1, faB: 26, tail: 26, coat: 0.4, skirt: 0.3, hs: 0.3 }), 'snap'],
      ['recovery+16', P(S, ATK, { tail: 10 }), 'inout'], ['recovery+19', S]]
  });

  // ---------------------------------------------------------------- crouching normals
  var c0 = P(C, ATK);
  // 2L: low paw swipe at the shins (reach 32)
  var CL = P(C, ATK, { hip: [4, -22], lean: 34, tilt: -20, hF: [27, -18], hB: [14, -30], handF: 'claw', weapon: 'hF', claw: 'F', tail: 20, mouth: 'teeth' });
  def('2L', {
    segs: sar(4, 3, 8), step: 1,
    keys: [['startup', c0], ['startup+2', P(c0, { hF: [18, -40], lean: 24, handF: 'claw' }), 'out'],
      ['active', P(CL, { smear: { part: 'hF', from: 'startup+2', n: 4 } }), 'snap'], ['active+1', P(CL, { hF: [28, -16] }), 'snap'], ['active+2', CL, 'snap'],
      ['recovery', P(CL, { hF: [25, -18], claw: '' }), 'out'], ['recovery+5', P(C, { claw: '' })], ['recovery+7', C]]
  });
  // 2M: low sliding kick, the platform sole skimming the floor (reach 50)
  var CM = P(C, HIT, { hip: [4, -20], lean: 6, bend: 4, tilt: -12, fF: [42, -3], faF: -70, knF: -1, fB: [-10, 0], faB: 40, hF: [16, -44], hB: [-4, -30], handF: 'claw', handB: 'flat',
    weapon: 'fF', skirt: 0.3, drape: { F: 1 }, tail: 30, coat: 0.5, mouth: 'cat' });
  def('2M', {
    segs: sar(7, 4, 13), step: 2,
    keys: [['startup', c0], ['startup+4', P(c0, { fF: [18, -8], faF: 20, lean: 20, drape: { F: 1 } }), 'out'],
      ['active', P(CM, { smear: { part: 'fF', from: 'startup+4', n: 3 } }), 'snap'], ['active+2', CM, 'snap'],
      ['recovery', P(CM, { fF: [36, -3] }), 'out'], ['recovery+8', P(C, { fF: [18, 0] })], ['recovery+12', C]]
  });
  // 2H: crouching spin sweep — turns her back on the floor, the heel and tail sweep flat along the ground (reach 60)
  var CH0 = P(C, ATK, { hip: [-2, -21], lean: 36, hF: [24, -16], hB: [16, -14], handF: 'flat', handB: 'flat', tail: -20, arch: 14, tsw: 0.2, coat: 0.3 });
  var CHX = P(C, HIT, { flip: 1, hip: [2, -18], lean: 44, bend: 6, tilt: -24, fF: [-46, -3], faF: 90, knF: 1, fB: [6, 0], faB: 30, hF: [18, -1], hB: [10, -1], handF: 'flat', handB: 'flat',
    tail: 46, arch: 1, tl: 1, tsw: 0, skirt: 0.45, coat: 1, cl: 10, z: { tail: 6 }, weapon: 'heelF', wpn: [60, -4], drape: { F: 1 } });
  def('2H', {
    segs: sar(10, 5, 22), step: 2,
    keys: [['startup', c0], ['startup+3', CH0, 'out'], ['startup+6', P(CHX, { fF: [-14, -6], faF: 60, wpn: [28, -8], tl: 0, tail: 20 }), 'snap'],
      ['startup+8', P(CHX, { fF: [-30, -4], wpn: [44, -6], smear: { part: 'heelF', from: 'startup+6', n: 3 } }), 'snap'],
      ['active', P(CHX, { smear: { part: 'heelF', from: 'startup+8', n: 4 } }), 'snap'], ['active+2', CHX, 'snap'],
      ['recovery', P(CHX, { fF: [-40, -3], wpn: [54, -4], tl: 0, tail: 56, mouth: 'cat' }), 'snap'],
      ['recovery+8', P(C, ATK, { tail: 30, coat: 0.5, hs: 0.3 }), 'snap'], ['recovery+21', C]]
  });

  // ---------------------------------------------------------------- jump normals
  var j0 = P(JF, ATK, { skirt: 0.5 });
  // jL: quick downward paw rake (reach 28)
  var JL = P(JF, ATK, { hip: [2, -52], lean: 14, hF: [22, -54], hB: [-4, -64], handF: 'claw', weapon: 'hF', claw: 'F', skirt: 0.55, mouth: 'teeth' });
  def('jL', {
    segs: jsar(4, 8), step: 1,
    keys: [['startup', j0], ['startup+2', P(j0, { hF: [10, -76], handF: 'claw' }), 'out'],
      ['active', P(JL, { smear: { part: 'hF', from: 'startup+2', n: 4 } }), 'snap'], ['active+2', JL, 'snap'],
      ['active+6', P(JL, { hF: [21, -55], claw: '' })],
      ['recovery', P(j0, { hF: [20, -62] })]]
  });
  // jM: air kick down-forward, platform sole first (reach 38)
  var JM = P(JF, HIT, { hip: [0, -52], lean: -12, bend: -6, fF: [30, -24], faF: -10, knF: -1, fB: [-6, -16], faB: 50,
    hF: [10, -76], hB: [-14, -66], handF: 'open', weapon: 'fF', skirt: 0.6, drape: { F: 1 }, tail: 20, coat: 0.7, mouth: 'cat' });
  def('jM', {
    segs: jsar(6, 6), step: 2,
    keys: [['startup', j0], ['startup+4', P(j0, { fF: [10, -26], faF: 50, drape: { F: 1 } }), 'out'],
      ['active', P(JM, { smear: { part: 'fF', from: 'startup+4', n: 3 } }), 'snap'], ['active+2', JM, 'snap'],
      ['recovery', P(j0, { fF: [12, -12] })]]
  });
  // jH: mid-air spinning heel, the heel and tail come down-forward (reach 46)
  var JH0 = P(JF, ATK, { lean: -6, hF: [16, -76], hB: [-2, -74], tail: -30, arch: 14, coat: 0.8 });
  var JHX = P(JF, HIT, { flip: 1, hip: [4, -52], lean: 30, bend: 4, tilt: -20, fF: [-34, -28], faF: 110, knF: 1, fB: [0, -14], faB: 40, hF: [16, -62], hB: [8, -66],
    handF: 'open', handB: 'claw', tail: 40, arch: 2, tl: 1, tsw: 0, skirt: 0.7, coat: 1, cl: 20, z: { tail: 6 }, weapon: 'heelF', wpn: [46, -30], drape: { F: 1 } });
  def('jH', {
    segs: jsar(9, 6), step: 2,
    keys: [['startup', j0], ['startup+4', JH0, 'out'],
      ['startup+7', P(JHX, { fF: [-14, -24], faF: 70, wpn: [26, -30], tl: 0, tail: 20, smear: { part: 'heelF', from: 'startup+4', n: 3 } }), 'snap'],
      ['active', P(JHX, { smear: { part: 'heelF', from: 'startup+7', n: 4 } }), 'snap'], ['active+2', JHX, 'snap'],
      ['recovery', P(j0, { tail: 20, hs: 0.3 })]]
  });
})();
