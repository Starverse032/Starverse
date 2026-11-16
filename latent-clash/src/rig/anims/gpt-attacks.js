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
  var CM = P(C, HIT, { hip: [4, -20], lean: 12, bend: 4, fF: [48, -3], faF: -4, fB: [-10, 0], hF: [22, -48], hB: [6, -40], handF: 'claw', weapon: 'fF', skirt: 0.25, drape: { F: 1 }, mouth: 'neutral' });
  def('2M', {
    segs: sar(9, 4, 16), step: 2,
    keys: [['startup', c0], ['startup+5', P(c0, { fF: [20, -8], faF: 20, lean: 18, drape: { F: 1 } }), 'out'],
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
  var JHX = P(JF, HIT, { flip: 1, hip: [6, -50], lean: 10, bend: 4, fF: [6, -8], fB: [-8, -14], faF: 30, faB: 40, hF: [18, -66], hB: [6, -70], handF: 'open', handB: 'claw',
    tail: 43, arch: 0.5, tl: 1, tsw: 0, skirt: 0.6, z: { tail: 6 }, weapon: 'tail', wing: 0.7, wf: -16, eyes: 'focus', mouth: 'teeth' });
  def('jH', {
    segs: jsar(11, 6), step: 2,
    keys: [['startup', j0], ['startup+6', JH0, 'out'],
      ['startup+9', P(JHX, { tail: 10, arch: 6, tl: 0, smear: { part: 'tail', from: 'startup+6', n: 3 } }), 'snap'],
      ['active', P(JHX, { smear: { part: 'tail', from: 'startup+9', n: 4 } }), 'snap'], ['active+2', JHX, 'snap'],
      ['recovery', P(j0, { tail: 10, hs: 0.3 })]]
  });
  // ================================================================ SPECIALS
  // breath 龙息: draws in (chest up, head back, wings lift), then thrusts the head forward and exhales a cone of
  // teal-white flame; held through active with a tremor; muzzle = mouth (level, facing forward)
  var MZ = { muzAt: 'mouth' };
  var BR0 = P(S, ATK, MZ, { hip: [-3, -51], lean: -10, bend: -10, tilt: -18, hF: [8, -70], hB: [-10, -64], handF: 'claw', handB: 'claw',
    mouth: 'o', eyes: 'closed', wing: 0.5, wf: -10, tail: 12, skirt: 0.1, shr: 1 });
  var BR1 = P(S, MZ, { hip: [3, -48], lean: 16, bend: 6, tilt: 0, head: [2, 1], fF: [14, 0], fB: [-12, 0], faB: 25, hF: [22, -60], hB: [-14, -60],
    handF: 'claw', handB: 'claw', eyes: 'focus', mouth: 'breath', wing: 0.85, wf: 6, tail: -10, arch: 7, skirt: 0.35, tw: -6, claw: 'FB', hd: 10 });
  def('breath', {
    segs: sar(12, 16, 22), step: 2,
    keys: [['startup', P(S, ATK, MZ)], ['startup+6', BR0, 'out'], ['startup+10', P(BR0, { tilt: -22, wing: 0.6, hip: [-4, -51] }), 'snap'],
      ['active', BR1, 'snap'], ['active+4', P(BR1, { head: [3, 1], wing: 0.9, hF: [23, -61] })], ['active+8', P(BR1, { head: [2, 2], wing: 0.82 })],
      ['active+12', P(BR1, { head: [3, 1], wing: 0.88, hF: [23, -59] })],
      ['recovery', P(BR1, { mouth: 'open', claw: '', wing: 0.6 }), 'out'], ['recovery+8', P(S, ATK, MZ, { hip: [0, -49], lean: 8, tilt: 4, mouth: 'neutral', wing: 0.3, skirt: 0.2 })],
      ['recovery+16', P(S, MZ, { eyes: 'half' })], ['recovery+21', P(S, MZ)]]
  });
  // airBreath: hovering on spread wings, head and chest pitched 45° down-forward
  var AB0 = P(JF, ATK, MZ, { lean: -12, bend: -10, tilt: -20, hF: [8, -74], hB: [-12, -68], mouth: 'o', eyes: 'closed', wing: 1, wf: -16, tail: 10 });
  var AB1 = P(JF, MZ, { hip: [2, -52], lean: 30, bend: 10, tilt: 28, head: [2, 2], hF: [20, -56], hB: [-12, -60], handF: 'claw', handB: 'claw',
    eyes: 'focus', mouth: 'breath', wing: 1, wf: 8, tail: -20, arch: 6, skirt: 0.6, claw: 'FB' });
  def('airBreath', {
    segs: [['startup', 10], ['active', 12], ['recovery', 12, true]], step: 2,
    keys: [['startup', P(JF, ATK, MZ)], ['startup+5', AB0, 'out'], ['startup+8', P(AB0, { wf: -24 }), 'snap'],
      ['active', AB1, 'snap'], ['active+4', P(AB1, { wf: 2, head: [3, 2] })], ['active+8', P(AB1, { wf: 10, head: [2, 3] })],
      ['recovery', P(JF, ATK, MZ, { mouth: 'neutral', wing: 0.7 }), 'out']]
  });

  // dragonRise 升龙: crouched gather (invulnerable), then rises with the lead claw thrust overhead, wings flared and
  // beating, teal glow trail; at the top the wings fold and she drops, lands in a crouch
  var DR0 = P(C, ATK, { hip: [2, -24], lean: 30, hF: [24, -32], hB: [10, -40], handF: 'claw', wing: 0.5, wf: 20, tail: 14 });
  var DR1 = P(S, HIT, { hip: [3, -54], lean: -6, bend: -10, tilt: -16, fF: [10, -10], fB: [-6, -2], faF: 40, faB: 30, knF: -1,
    hF: [20, -100], hB: [-14, -68], handF: 'claw', handB: 'open', weapon: 'hF', claw: 'F', wing: 1.1, wf: -18, tail: 20, arch: 4, skirt: 0.7, hem: -8, air: true, hd: 20 });
  def('dragonRise', {
    segs: [['startup', 5], ['rise', 14], ['fall', 12, true], ['land', 14]], step: 2,
    keys: [['startup', P(S, ATK)], ['startup+3', DR0, 'snap'],
      ['rise', P(DR1, { smear: { part: 'hF', from: 'startup+3', n: 4 } }), 'snap'], ['rise+2', P(DR1, { wf: -4 })],
      ['rise+5', P(DR1, { wing: 1.15, wf: -22, hF: [18, -102] })], ['rise+9', P(DR1, { wf: 0, wing: 0.95, hF: [16, -98], mouth: 'neutral' })],
      ['rise+13', P(JF, ATK, { hF: [16, -80], wing: 0.7, wf: 10, claw: '', hs: 0.2 })],
      ['fall', P(JF, ATK, { wing: 0.5, wf: 14, skirt: 0.8 })], ['fall+6', P(JF, ATK, { wing: 0.55, wf: 8, skirt: 0.75, hB: [-12, -63] })],
      ['land', P(S, { hip: [0, -40], lean: 16, bend: 4, sq: 1, hF: [21, -52], hB: [5, -48], skirt: 0.35, wing: 0.5, wf: 14, eyes: 'focus' }), 'snap'],
      ['land+4', P(S, ATK, { hip: [0, -46], lean: 10, wing: 0.3, skirt: 0.15 }), 'out'], ['land+13', S]]
  });

  // call 函数调用: command grab — a sweeping lunge with the open claw (grab anchor at the palm, range ≈ 60);
  // whiff: the claw closes on nothing, a long, irritated recovery
  var CA0 = P(S, ATK, { hip: [-3, -50], lean: -4, bend: -6, hF: [2, -70], hB: [-8, -62], handF: 'open', wing: 0.4, wf: 10, tail: 10 });
  var CA1 = P(S, HIT, { hip: [10, -45], lean: 30, bend: 6, tilt: 4, fF: [26, 0], fB: [-12, 0], faB: 35, hF: [52, -60], hB: [-10, -62], handF: 'open', handB: 'claw',
    grab: [55, -60], weapon: 'hF', claw: 'F', wing: 0.7, wf: 14, tail: -14, skirt: 0.3, tw: 8, mouth: 'neutral' });
  def('call', {
    segs: sar(7, 3, 30), step: 2,
    keys: [['startup', P(S, ATK)], ['startup+4', CA0, 'out'],
      ['active', P(CA1, { smear: { part: 'hF', from: 'startup+4', n: 4 } }), 'snap'], ['active+2', CA1, 'snap'],
      ['recovery', P(CA1, { handF: 'fist', claw: '', eyes: 'wide', grab: [50, -60] }), 'snap'],
      ['recovery+8', P(CA1, { hip: [8, -44], hF: [44, -56], handF: 'fist', claw: '', eyes: 'half', mouth: 'frown', grab: [46, -56] }), 'out'],
      ['recovery+20', P(S, ATK, { hip: [3, -49], lean: 10, handF: 'relax', eyes: 'half', mouth: 'frown', wing: 0.3 }), 'inout'], ['recovery+29', S]]
  });
  // callHit: seizes the throat, wings spread, carries the victim up (self-contained lift, root up to -34) and
  // slams them into the floor in front; victim released at the end of `slam` (grab anchor throughout)
  var CH = P(S, HIT, { hip: [8, -47], lean: 20, bend: 2, fF: [22, 0], fB: [-12, 0], hF: [40, -66], hB: [-6, -62], handF: 'fist', handB: 'claw',
    grab: [42, -64], wing: 0.6, wf: 10, tail: -6, mouth: 'neutral' });
  var CU = P(S, HIT, { hip: [2, -52], lean: -8, bend: -10, tilt: -10, fF: [8, -10], fB: [-6, -3], faF: 40, faB: 30, hF: [24, -88], hB: [-14, -70], handF: 'fist', handB: 'claw',
    grab: [26, -88], wing: 1.1, wf: -20, tail: 20, arch: 5, skirt: 0.7, hem: -8, air: true, mouth: 'teeth' });
  var CS = P(S, HIT, { hip: [10, -36], lean: 46, bend: 12, tilt: 14, fF: [24, 0], fB: [-14, 0], faB: 40, hF: [40, -12], hB: [-12, -50], handF: 'open', handB: 'claw',
    grab: [42, -10], wing: 0.9, wf: 30, tail: -24, arch: 4, skirt: 0.45, mouth: 'shout' });
  def('callHit', {
    segs: [['hold', 14], ['rise', 16], ['slam', 12], ['recovery', 22]], step: 2,
    keys: [['hold', CH], ['hold+6', P(CH, { hF: [36, -70], grab: [38, -68], wing: 0.9, wf: -10, eyes: 'focus' }), 'out'],
      ['hold+12', P(CH, { hip: [6, -44], sq: 1, hF: [34, -66], grab: [36, -64], wing: 1, wf: -24, eyes: 'focus' }), 'snap'],
      ['rise', P(CU, { root: [0, -8], wf: 10 }), 'out'], ['rise+5', P(CU, { root: [0, -22], wf: -18 })], ['rise+10', P(CU, { root: [0, -32], wf: 12 })],
      ['rise+14', P(CU, { root: [0, -34], wf: -14, hF: [20, -92], grab: [22, -92], lean: -14 })],
      ['slam', P(CS, { root: [0, -16], hip: [8, -44], lean: 36, hF: [44, -40], grab: [46, -38], air: true, smear: { part: 'hF', from: 'rise+14', n: 4 } }), 'snap'],
      ['slam+4', P(CS, { root: [0, 0] }), 'snap'], ['slam+8', P(CS, { sq: 1, mouth: 'teeth' }), 'snap'],
      ['recovery', P(CS, { grab: [40, -6] }), 'snap'], ['recovery+8', P(S, ATK, { hip: [4, -44], lean: 18, wing: 0.6, wf: 10, skirt: 0.3, hs: 0.3 }), 'out'],
      ['recovery+21', S]]
  });

  // roar 系统提示: inhales (wings close in), then a point-blank roar — wings fully spread, arms flung wide,
  // head thrust forward, the tail lifted; muzzle = mouth
  var RO0 = P(S, ATK, MZ, { hip: [-2, -50], lean: -6, bend: -6, tilt: 8, hF: [8, -66], hB: [2, -64], handF: 'claw', handB: 'claw', wing: 0.2, wf: 30, tail: 14, eyes: 'closed', mouth: 'neutral', shr: 1 });
  var RO1 = P(S, MZ, { hip: [0, -50], lean: -2, bend: -6, tilt: -12, head: [3, -1], fF: [13, 0], fB: [-12, 0], hF: [31, -62], hB: [-24, -66], handF: 'claw', handB: 'claw',
    eyes: 'focus', mouth: 'shout', wing: 1.15, wf: -14, tail: -22, arch: 5, skirt: 0.5, hd: 18, claw: 'FB' });
  def('roar', {
    segs: sar(9, 6, 24), step: 2,
    keys: [['startup', P(S, ATK, MZ)], ['startup+5', RO0, 'out'], ['startup+8', P(RO0, { hip: [-2, -49], sq: 1 }), 'snap'],
      ['active', RO1, 'snap'], ['active+2', P(RO1, { head: [3, 0], wf: -18 })], ['active+4', P(RO1, { head: [2, 1], wf: -10 })],
      ['recovery', P(RO1, { mouth: 'open', claw: '', wing: 0.9 }), 'out'], ['recovery+10', P(S, ATK, MZ, { lean: 4, wing: 0.4, wf: 6, tail: 4, hs: 0.2 })],
      ['recovery+23', P(S, MZ)]]
  });

  // super 注意力即一切: gathers low, rises with wings fully spread, raises the lead hand to the sky (muzzle = that
  // hand) and commands the three dragon heads — held through active (slow wing beats, hair and sleeves flaring),
  // then lowers the hand and folds the wings, composed
  var SU0 = P(C, ATK, { hip: [0, -26], lean: 22, hF: [18, -50], hB: [12, -48], handF: 'claw', handB: 'claw', eyes: 'closed', wing: 0.3, wf: 24, claw: 'FB' });
  var SU1 = P(S, HIT, { hip: [0, -52], lean: -6, bend: -10, tilt: -14, fF: [12, 0], fB: [-11, 0], hF: [22, -104], hB: [-18, -72], handF: 'open', handB: 'claw',
    mouth: 'neutral', weapon: 'hF', wing: 1.15, wf: -16, tail: 26, arch: 6, skirt: 0.6, hd: 16, claw: 'F' });
  var SUh = P(SU1, { wf: -4, wing: 1.05, skirt: 0.5, hF: [23, -103] });
  def('super', {
    segs: [['startup', 6], ['cast', 12], ['active', 50], ['recovery', 30]], step: 2,
    keys: [['startup', P(S, ATK)], ['startup+4', SU0, 'out'],
      ['cast', SU0], ['cast+4', P(SU0, { hip: [0, -24], wing: 0.2, wf: 30 }), 'out'],
      ['cast+8', P(SU1, { mouth: 'teeth', eyes: 'focus', smear: { part: 'hF', from: 'cast+4', n: 4 } }), 'snap'], ['cast+11', P(SU1, { mouth: 'teeth' })],
      ['active', SU1], ['active+10', SUh, 'inout'], ['active+20', SU1, 'inout'], ['active+30', SUh, 'inout'], ['active+40', SU1, 'inout'], ['active+48', SUh],
      ['recovery', P(SU1, { claw: '', mouth: 'neutral', eyes: 'half' }), 'out'],
      ['recovery+10', P(S, { hip: [0, -50], hF: [14, -70], hB: [-6, -58], handF: 'relax', eyes: 'half', wing: 0.5, wf: 8, skirt: 0.2, hs: 0.15 }), 'out'],
      ['recovery+22', P(S, { eyes: 'closed' })], ['recovery+29', S]]
  });
})();
