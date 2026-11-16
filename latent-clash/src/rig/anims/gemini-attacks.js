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
  var M1 = P(S, HIT, { hip: [-4, -51], lean: -18, bend: -6, tilt: -8, fF: [43, -46], faF: -40, knF: -1, fB: [-9, 0], faB: 8,
    hF: [10, -74], hB: [-16, -66], handF: 'open', handB: 'open', skirt: 0.45, hem: -3, drape: { F: 1 }, weapon: 'fF', tail: 30, coat: 0.45, cl: 10, mouth: 'cat' });
  def('5M', {
    segs: sar(7, 4, 12), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+4', M0, 'out'],
      ['active', P(M1, { smear: { part: 'fF', from: 'startup+4', n: 4 } }), 'snap'], ['active+2', P(M1, { fF: [43, -47] }), 'snap'],
      ['recovery', P(M1, { fF: [36, -38], faF: -10 }), 'out'], ['recovery+6', P(M0, { fF: [12, -12], faF: 20 })], ['recovery+11', S]]
  });

  // 5H: spinning heel kick — pivots, shows her back (flip), the lead leg whips round heel-first at waist height,
  // the tail lashing round with it (reach 58)
  var H0 = P(S, ATK, { hip: [-2, -49], lean: 6, bend: 4, fF: [10, 0], fB: [-10, 0], faB: 30, hF: [16, -66], hB: [6, -66], handF: 'claw', tail: -30, arch: 14, tsw: 0.2, coat: 0.3 });
  var HT = P(S, ATK, { flip: 1, hip: [1, -48], lean: 18, bend: 4, tilt: -10, fF: [4, -8], faF: 40, knF: -1, fB: [-2, 0], faB: 20, hF: [16, -60], hB: [8, -62], handF: 'open', handB: 'claw',
    tail: 22, arch: 6, coat: 0.8, cl: 20, skirt: 0.5, hem: -3, tw: -10 });
  var HX = P(S, HIT, { flip: 1, hip: [-10, -50], lean: 40, bend: 6, tilt: -26, fF: [-58, -50], faF: 96, knF: 1, fB: [-4, 0], faB: 30, hF: [20, -50], hB: [12, -46], handF: 'open', handB: 'flat',
    tail: 14, arch: 2, tl: 1, tsw: 0, skirt: 0.6, hem: -4, tw: -12, coat: 1, cl: 30, weapon: 'heelF', drape: { F: 1 } });
  def('5H', {
    segs: sar(10, 5, 20), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+3', H0, 'out'], ['startup+6', P(HT, { tl: 0 }), 'snap'],
      ['startup+8', P(HT, { fF: [-34, -42], faF: 74, hip: [-5, -49], lean: 30, tail: 20, smear: { part: 'heelF', from: 'startup+6', n: 3 } }), 'snap'],
      ['active', P(HX, { smear: { part: 'heelF', from: 'startup+8', n: 4 } }), 'snap'], ['active+2', P(HX, { fF: [-59, -51] }), 'snap'],
      ['recovery', P(HX, { hip: [-7, -49], fF: [-48, -42], tl: 0, tail: 40, mouth: 'cat' }), 'snap'],
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
  var CM = P(C, HIT, { hip: [4, -20], lean: 6, bend: 4, tilt: -12, fF: [44, -2], faF: -20, knF: -1, fB: [-10, 0], faB: 40, hF: [16, -44], hB: [-4, -30], handF: 'claw', handB: 'flat',
    weapon: 'fF', skirt: 0.3, drape: { F: 1 }, tail: 30, coat: 0.5, mouth: 'cat' });
  def('2M', {
    segs: sar(7, 4, 13), step: 2,
    keys: [['startup', c0], ['startup+4', P(c0, { fF: [18, -8], faF: 20, lean: 20, drape: { F: 1 } }), 'out'],
      ['active', P(CM, { smear: { part: 'fF', from: 'startup+4', n: 3 } }), 'snap'], ['active+2', CM, 'snap'],
      ['recovery', P(CM, { fF: [38, -2] }), 'out'], ['recovery+8', P(C, { fF: [18, 0] })], ['recovery+12', C]]
  });
  // 2H: crouching spin sweep — turns her back on the floor, the heel and tail sweep flat along the ground (reach 60)
  var CH0 = P(C, ATK, { hip: [-2, -21], lean: 36, hF: [24, -16], hB: [16, -14], handF: 'flat', handB: 'flat', tail: -20, arch: 14, tsw: 0.2, coat: 0.3 });
  var CHX = P(C, HIT, { flip: 1, hip: [-13, -18], lean: 44, bend: 6, tilt: -24, fF: [-60, -3], faF: 90, knF: 1, fB: [6, 0], faB: 30, hF: [18, -1], hB: [10, -1], handF: 'flat', handB: 'flat',
    tail: 40, arch: 1, tl: 1, tsw: 0, skirt: 0.45, coat: 1, cl: 10, weapon: 'heelF', drape: { F: 1 } });
  def('2H', {
    segs: sar(10, 5, 22), step: 2,
    keys: [['startup', c0], ['startup+3', CH0, 'out'], ['startup+6', P(CHX, { hip: [-2, -19], fF: [-20, -6], faF: 60, tl: 0, tail: 20 }), 'snap'],
      ['startup+8', P(CHX, { hip: [-8, -18], fF: [-40, -4], smear: { part: 'heelF', from: 'startup+6', n: 3 } }), 'snap'],
      ['active', P(CHX, { smear: { part: 'heelF', from: 'startup+8', n: 4 } }), 'snap'], ['active+2', CHX, 'snap'],
      ['recovery', P(CHX, { hip: [-9, -18], fF: [-50, -3], tl: 0, tail: 56, mouth: 'cat' }), 'snap'],
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
  var JHX = P(JF, HIT, { flip: 1, hip: [-6, -50], lean: 30, bend: 4, tilt: -20, fF: [-47, -30], faF: 110, knF: 1, fB: [0, -14], faB: 40, hF: [16, -62], hB: [8, -66],
    handF: 'open', handB: 'claw', tail: 22, arch: 2, tl: 1, tsw: 0, skirt: 0.7, coat: 1, cl: 20, weapon: 'heelF', drape: { F: 1 } });
  def('jH', {
    segs: jsar(9, 6), step: 2,
    keys: [['startup', j0], ['startup+4', JH0, 'out'],
      ['startup+7', P(JHX, { hip: [-2, -51], fF: [-24, -26], faF: 70, tl: 0, tail: 20, smear: { part: 'heelF', from: 'startup+4', n: 3 } }), 'snap'],
      ['active', P(JHX, { smear: { part: 'heelF', from: 'startup+7', n: 4 } }), 'snap'], ['active+2', JHX, 'snap'],
      ['recovery', P(j0, { tail: 20, hs: 0.3 })]]
  });
  // ================================================================ SPECIALS
  // star 星闪: the drifting stars gather into her hand, she cocks it back by her ear with a twist of the hips, then
  // flicks it forward like a playing card; muzzle = the flicking hand (first active frame), a wink on release
  var ST0 = P(S, ATK, { hip: [-3, -50], lean: -8, bend: -8, tilt: -10, hF: [-2, -80], hB: [10, -64], handF: 'point', handB: 'paw', faB: 24,
    tail: 24, arch: 8, coat: 0.2, stars: 'hand', tw: -4 });
  var ST1 = P(S, ATK, { hip: [4, -49], lean: 16, bend: 6, tilt: 4, fF: [14, 0], fB: [-10, 0], faB: 30, hF: [30, -70], hB: [-6, -62], handF: 'open', handB: 'paw',
    eyes: 'wink', mouth: 'cat', tail: -10, arch: 9, coat: 0.45, skirt: 0.25, tw: 8, claw: 'F', hd: 10 });
  def('star', {
    segs: sar(11, 3, 24), step: 2,
    keys: [['startup', P(S, ATK, { stars: 'hand' })], ['startup+4', P(S, ATK, { hF: [12, -70], handF: 'paw', stars: 'hand', eyes: 'sly' }), 'out'],
      ['startup+8', ST0, 'out'], ['startup+10', P(ST0, { hF: [-4, -79], hip: [-4, -50] }), 'snap'],
      ['active', P(ST1, { smear: { part: 'hF', from: 'startup+10', n: 4 } }), 'snap'], ['active+2', P(ST1, { hF: [31, -69] }), 'snap'],
      ['recovery', P(ST1, { claw: '', stars: 0 }), 'snap'], ['recovery+6', P(ST1, { hF: [28, -68], handF: 'point', claw: '', stars: 0 }), 'out'],
      ['recovery+14', P(S, { hip: [1, -50], lean: 8, hF: [20, -64], eyes: 'sly', mouth: 'cat', tail: 6 }), 'inout'], ['recovery+23', S]]
  });
  // airStar: in the air, the star flicked 45° down-forward
  var AS0 = P(JF, ATK, { lean: -10, bend: -8, tilt: -12, hF: [-2, -84], hB: [8, -66], handF: 'point', stars: 'hand', tail: 20, coat: 0.6 });
  var AS1 = P(JF, ATK, { hip: [2, -52], lean: 24, bend: 8, tilt: 14, hF: [24, -50], hB: [-12, -66], handF: 'open', eyes: 'wink', mouth: 'cat',
    claw: 'F', tail: -20, coat: 0.9, skirt: 0.7 });
  def('airStar', {
    segs: [['startup', 9], ['active', 3], ['recovery', 12, true]], step: 2,
    keys: [['startup', P(JF, ATK, { stars: 'hand' })], ['startup+5', AS0, 'out'], ['startup+8', P(AS0, { hF: [-4, -83] }), 'snap'],
      ['active', P(AS1, { smear: { part: 'hF', from: 'startup+8', n: 4 } }), 'snap'], ['active+2', AS1, 'snap'],
      ['recovery', P(JF, ATK, { hF: [22, -60], claw: '', stars: 0 }), 'out']]
  });

  // starRise 双子升星: a low pounce-gather (invulnerable), then she corkscrews upward, lead claw high, rear claw
  // trailing, both glowing (alternate drawings face away: the spin), the stars streaking with her; tops out, drops,
  // lands in a crouch
  var SR0 = P(C, ATK, { hip: [2, -24], lean: 34, tilt: -10, hF: [20, -26], hB: [10, -30], handF: 'claw', handB: 'claw', tail: 30, coat: 0.4, eyes: 'focus', mouth: 'teeth' });
  var SR1 = P(S, HIT, { hip: [2, -54], lean: -6, bend: -10, tilt: -20, fF: [8, -14], fB: [-4, -2], faF: 50, faB: 40, knF: -1,
    hF: [16, -104], hB: [-12, -64], handF: 'claw', handB: 'claw', weapon: 'hF', claw: 'FB', tail: 30, arch: 4, skirt: 0.8, hem: -6, coat: 1, cl: -20,
    air: true, hd: 24, stars: 'hand' });
  var SRf = P(SR1, { flip: 1, hF: [-4, -102], hB: [-16, -70], fF: [6, -12], tail: 50 });
  def('starRise', {
    segs: [['startup', 4], ['rise', 12], ['fall', 12, true], ['land', 14]], step: 2,
    keys: [['startup', P(S, ATK)], ['startup+2', SR0, 'snap'],
      ['rise', P(SR1, { smear: { part: 'hF', from: 'startup+2', n: 4 } }), 'snap'], ['rise+2', SRf, 'snap'], ['rise+4', P(SR1, { hF: [17, -104] }), 'snap'],
      ['rise+6', P(SRf, { hF: [-2, -100] }), 'snap'], ['rise+8', P(SR1, { hF: [15, -98], mouth: 'cat' }), 'snap'],
      ['rise+10', P(JR, ATK, { hF: [16, -82], claw: '', hs: 0.25 }), 'out'],
      ['fall', P(JF, ATK, { skirt: 0.85, coat: 0.8 })], ['fall+6', P(JF, ATK, { skirt: 0.8, hB: [-12, -63] })],
      ['land', P(S, { hip: [0, -38], lean: 22, bend: 6, sq: 1, faB: 30, hF: [22, -46], hB: [10, -44], skirt: 0.45, coat: 0.5, tail: 26, eyes: 'focus' }), 'snap'],
      ['land+4', P(S, ATK, { hip: [0, -45], lean: 12, coat: 0.25, skirt: 0.2 }), 'out'], ['land+13', S]]
  });

  // twin 双子·分身: a cheeky "two of me" gesture — paws together at her chest, eyes closed (the twin splits off), then
  // she flings the lead hand out, palm open (spawn), rear finger to her cheek with a wink
  var TW0 = P(S, ATK, { hip: [-1, -49], lean: 2, bend: -2, tilt: 8, hF: [10, -66], hB: [8, -64], handF: 'paw', handB: 'paw', eyes: 'closed', mouth: 'cat', tail: 12, sq: 1 });
  var TW1 = P(S, ATK, { hip: [2, -50], lean: 6, bend: -4, tilt: -10, fF: [12, 0], hF: [32, -66], hB: [6, -80], handF: 'open', handB: 'point', elB: -1,
    eyes: 'wink', mouth: 'smile', tail: -8, arch: 8, coat: 0.35, skirt: 0.2, tw: 6, blush: 1 });
  def('twin', {
    segs: sar(10, 2, 18), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+4', TW0, 'out'], ['startup+8', P(TW0, { hF: [8, -68], hB: [6, -66], tilt: 10 }), 'snap'],
      ['active', P(TW1, { smear: { part: 'hF', from: 'startup+8', n: 3 } }), 'snap'], ['active+1', TW1, 'snap'],
      ['recovery', P(TW1, { hF: [31, -65] }), 'out'], ['recovery+10', P(S, { tilt: -8, hB: [6, -74], handB: 'point', elB: -1, eyes: 'sly', mouth: 'cat' }), 'inout'],
      ['recovery+17', S]]
  });
  // twinStrike (performed by the light-twin): a complete attack on its own — a coiled pounce, then a lunging
  // double-claw X swipe, the pink after-glow behind both paws, a short skid to a stop
  var TS0 = P(C, ATK, { hip: [-4, -28], lean: 30, tilt: -20, fF: [12, 0], fB: [-14, 0], hF: [12, -40], hB: [6, -44], handF: 'claw', handB: 'claw', tail: 30, coat: 0.5,
    eyes: 'focus', mouth: 'teeth' });
  var TS1 = P(S, HIT, { hip: [10, -44], lean: 30, bend: 6, tilt: -4, fF: [26, 0], fB: [-12, 0], faB: 50, hF: [40, -48], hB: [34, -62], handF: 'claw', handB: 'claw', elB: -1,
    weapon: 'hF', claw: 'FB', tail: -24, arch: 6, coat: 1, cl: 20, skirt: 0.4, tw: 10, hd: 20 });
  def('twinStrike', {
    segs: sar(8, 4, 14), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+3', TS0, 'out'], ['startup+6', P(TS0, { hip: [-5, -26], sq: 1 }), 'snap'],
      ['active', P(TS1, { smear: { part: 'hF', from: 'startup+6', n: 4 } }), 'snap'], ['active+2', P(TS1, { hF: [41, -46], hB: [36, -58] }), 'snap'],
      ['recovery', P(TS1, { hF: [36, -42], hB: [30, -50], claw: '', mouth: 'cat' }), 'out'],
      ['recovery+8', P(S, ATK, { hip: [4, -46], lean: 14, hF: [24, -56], tail: 6, coat: 0.4, hs: 0.2 }), 'inout'], ['recovery+13', S]]
  });

  // blinkOut 闪现: curls into a ball (hugging her knees, tail wrapped), dissolves (checker) and pinches down to a star point
  var BO = P(S, ATK, { hip: [0, -30], lean: 40, bend: 16, tilt: 24, fF: [8, -8], fB: [2, -6], faF: 50, faB: 50, hF: [14, -30], hB: [10, -32], handF: 'paw', handB: 'paw',
    eyes: 'closed', mouth: 'cat', tail: 70, arch: 6, coat: 0.3, cl: -10, skirt: 0.3, air: true, hs: 0.2, stars: 0 });
  def('blinkOut', {
    segs: [['startup', 5], ['vanish', 5]], step: 1,
    keys: [['startup', P(S, ATK, { eyes: 'wink' })], ['startup+2', P(BO, { hip: [0, -36], lean: 28, root: [0, 0] }), 'out'], ['startup+4', BO],
      ['vanish', P(BO, { dith: 1 }), 'snap'], ['vanish+1', P(BO, { dith: 2 }), 'snap'], ['vanish+2', P(BO, { only: 'star', onlySize: 's9' }), 'snap'],
      ['vanish+3', P(BO, { only: 'star', onlySize: 's7' }), 'snap'], ['vanish+4', P(BO, { only: 'star', onlySize: 's3' }), 'snap']]
  });
  // blinkIn: a star point blooms, she unfolds from the ball with a flourish (arms flung open, one knee up, wink)
  var BI = P(S, ATK, { hip: [0, -52], lean: -6, bend: -8, tilt: -12, fF: [10, -14], faF: 40, fB: [-8, 0], faB: 30, hF: [26, -82], hB: [-18, -72], handF: 'open', handB: 'open',
    eyes: 'wink', mouth: 'smile', tail: 30, arch: 6, coat: 0.7, skirt: 0.5, hem: -3, hd: 10 });
  def('blinkIn', {
    segs: [['appear', 5], ['recovery', 9]], step: 1,
    keys: [['appear', P(BO, { only: 'star', onlySize: 's3' }), 'snap'], ['appear+1', P(BO, { only: 'star', onlySize: 's7' }), 'snap'],
      ['appear+2', P(BO, { only: 'star', onlySize: 's9' }), 'snap'], ['appear+3', P(BO, { dith: 2 }), 'snap'], ['appear+4', P(BI, { dith: 1, hs: 0.4 }), 'snap'],
      ['recovery', BI, 'out'], ['recovery+4', P(S, { hip: [0, -47], lean: 8, sq: 1, eyes: 'sly', mouth: 'cat', coat: 0.3 }), 'inout'], ['recovery+8', S]]
  });

  // super 双子座·流星雨: gathers the stars into her paws (crouched, eyes closed), springs up into a twirl and throws
  // the lead hand to the sky (muzzle = raised hand) — held through the meteor rain with the hair and coat flaring,
  // then sweeps the arm down to point ahead for the crossing beams; lands the finish with a wink
  var SU0 = P(C, ATK, { hip: [0, -26], lean: 22, tilt: 6, hF: [16, -42], hB: [12, -44], handF: 'paw', handB: 'paw', eyes: 'closed', stars: 'hand', claw: 'FB' });
  var SU1 = P(S, HIT, { hip: [0, -53], lean: -6, bend: -10, tilt: -18, fF: [10, 0], fB: [-10, 0], faB: 20, hF: [18, -106], hB: [-20, -66], handF: 'open', handB: 'open',
    mouth: 'cat', eyes: 'focus', tail: 30, arch: 6, skirt: 0.5, coat: 0.8, cl: 10, hd: 18, claw: 'F', stars: 'hand' });
  var SUh = P(SU1, { hF: [19, -105], coat: 0.9, skirt: 0.6, tail: 40, hd: 24 });
  var SU2 = P(S, HIT, { hip: [4, -50], lean: 14, bend: 2, tilt: -4, fF: [14, 0], fB: [-11, 0], faB: 30, hF: [34, -76], hB: [-14, -60], handF: 'point', handB: 'open',
    mouth: 'teeth', eyes: 'focus', tail: -10, skirt: 0.4, coat: 0.7, tw: 8, claw: 'F', stars: 'hand' });
  def('super', {
    segs: [['startup', 6], ['cast', 12], ['active', 54], ['recovery', 28]], step: 2,
    keys: [['startup', P(S, ATK, { stars: 'hand' })], ['startup+4', SU0, 'out'],
      ['cast', SU0], ['cast+4', P(spin(P(SU1, { fF: [6, -10], faF: 40, air: true }), 0), { flip: 1, hip: [0, -50], hF: [10, -90], eyes: 'closed' }), 'snap'],
      ['cast+8', P(SU1, { mouth: 'teeth', smear: { part: 'hF', from: 'cast+4', n: 4 } }), 'snap'], ['cast+10', SU1],
      ['active', SU1], ['active+10', SUh, 'inout'], ['active+20', SU1, 'inout'], ['active+30', SUh, 'inout'], ['active+38', SU1, 'inout'],
      ['active+44', P(SU2, { smear: { part: 'hF', from: 'active+40', n: 4 } }), 'snap'], ['active+48', P(SU2, { hF: [35, -75] })],
      ['recovery', P(SU2, { claw: '', mouth: 'cat', stars: 0 }), 'out'],
      ['recovery+10', P(S, { hip: [0, -50], lean: 4, hF: [16, -64], hB: [6, -76], handB: 'point', elB: -1, eyes: 'wink', mouth: 'smile', coat: 0.3, hs: 0.15 }), 'out'],
      ['recovery+22', P(S, { eyes: 'sly', mouth: 'cat' })], ['recovery+27', S]]
  });
})();
