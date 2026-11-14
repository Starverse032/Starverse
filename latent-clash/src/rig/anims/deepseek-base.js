/* LATENT CLASH — RIG: DeepSeek 娘 V2 base motion (stance + all common anims).
 * Personality: lazy, loose stance (weight back, open lead palm, tail swaying) that
 * snaps into quick, low rush-down; the long skirt, hair and tail carry the overlap.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob, G = I.gen;
  var def = function (name, d) { return I.defAnim('deepseek', name, d); };
  var S = I.CHARS.deepseek.rest;
  var POSE = I.POSE_DEEPSEEK = { stance: S };

  // ---------------------------------------------------------------- idle: breathing + lazy weight shift
  var IN = P(S, { hip: [-1, -45], bend: -1, hF: [18, -56], hB: [6, -54] });
  var WB = P(S, { hip: [-2, -46], lean: 2, hF: [17, -57], hB: [5, -55], head: [-1, 0] });
  def('idle', {
    segs: [['loop', 64, true]], step: 2,
    keys: [[0, S], [10, bob(S, 0, 1, { sq: 1 })], [22, IN], [32, WB], [42, bob(WB, 0, 1, { sq: 1 })], [54, P(IN, { hF: [17, -56] })]]
  });

  // ---------------------------------------------------------------- walks: two short steps per cycle, 2 cycles per loop
  function walk2(base, v, o) {
    var k = G.walk(base, v, 16, o), out = [];
    k.forEach(function (q) { out.push([q[0], q[1], q[2]]); });
    k.forEach(function (q) { out.push([q[0] + 16, P(q[1]), q[2]]); });
    return out;
  }
  var WK = P(S, { lean: 7, bend: -2, hF: [17, -59], hB: [4, -56], skirt: 0.05 });
  def('walkF', { segs: [['loop', 32, true]], step: 2, walk: 2.0, keys: walk2(WK, 2.0, { lift: 5, bob: 1.5, leg: 47, swingF: 2, swingB: 2 }) });
  var WKB = P(S, { lean: 0, bend: -3, hF: [15, -61], hB: [4, -57], tail: 8 });
  def('walkB', { segs: [['loop', 32, true]], step: 2, walk: -1.5, keys: walk2(WKB, -1.5, { lift: 4, bob: 1, leg: 47, swingF: 1.5, swingB: 1.5 }) });

  // ---------------------------------------------------------------- crouch
  var CR = POSE.crouch = P(S, { hip: [1, -19], lean: 28, bend: 4, fF: [13, 0], fB: [-10, 0], faB: 25, hF: [27, -46], hB: [18, -40], head: [1, 0],
    handF: 'open', handB: 'relax', tail: 10, arch: 18 });
  def('crouchIn', { segs: [['go', 4]], step: 1, keys: [[0, P(S, { hip: [0, -38], lean: 14 })], [2, P(CR, { hip: [1, -17], sq: 1 }), 'out'], [3, CR]] });
  def('crouch', {
    segs: [['loop', 64, true]], step: 2,
    keys: [[0, CR], [16, bob(CR, 0, 1, { sq: 1 })], [32, CR], [48, bob(CR, 0, 1, { hF: [27, -45] })]]
  });
  def('crouchOut', { segs: [['go', 4]], step: 1, keys: [[0, CR], [2, P(S, { hip: [0, -38], lean: 14 }), 'out'], [3, S]] });

  // ---------------------------------------------------------------- jump
  var SQ = P(S, { hip: [0, -37], lean: 16, bend: 4, hF: [21, -48], hB: [9, -46], skirt: 0.1, eyes: 'focus', mouth: 'grin' });
  def('jumpSquat', { segs: [['go', 4]], step: 1, keys: [[0, bob(S, 0, 3)], [2, SQ]] });
  var JR = POSE.jumpRise = P(S, { hip: [0, -47], lean: 2, bend: -4, fF: [9, -17], fB: [-6, -8], faF: 35, faB: 50,
    hF: [20, -72], hB: [-9, -66], handF: 'fist', handB: 'open', skirt: 0.35, tail: -15, arch: 24, mouth: 'grin' });
  def('jumpRise', { segs: [['loop', 12, true]], step: 3, keys: [[0, JR], [6, P(JR, { hB: [-10, -65], fF: [9, -18] })]] });
  var JF = POSE.jumpFall = P(S, { hip: [0, -47], lean: 0, bend: -2, fF: [8, -5], fB: [-7, -11], faF: 20, faB: 40,
    hF: [21, -66], hB: [-12, -62], handF: 'open', handB: 'open', skirt: 0.6, tail: -25, arch: 22 });
  def('jumpFall', { segs: [['loop', 12, true]], step: 3, keys: [[0, JF], [6, P(JF, { hB: [-12, -63], fB: [-7, -10] })]] });
  def('land', {
    segs: [['go', 6]], step: 1,
    keys: [[0, P(S, { hip: [0, -36], lean: 18, bend: 4, sq: 1, hF: [21, -46], hB: [9, -44], skirt: 0.3 }), 'snap'],
      [2, P(S, { hip: [0, -41], lean: 12, skirt: 0.1 }), 'out'], [4, bob(S, 0, -1)], [5, S]]
  });

  // ---------------------------------------------------------------- dashes
  var DF = P(S, { hip: [4, -42], lean: 28, bend: 4, fF: [17, -4], fB: [-16, 0], faF: -10, faB: 45, hF: [25, -58], hB: [-10, -56],
    handF: 'fist', handB: 'open', skirt: -0.1, tail: -10, eyes: 'focus', mouth: 'grin' });
  def('dashF', {
    segs: [['go', 16]], step: 2,
    keys: [[0, P(S, { hip: [0, -42], lean: 14 })], [2, DF, 'out'],
      [8, P(DF, { fF: [14, 0], faF: 0, fB: [-12, -7], faB: 60, hip: [4, -44] })],
      [12, P(S, { hip: [1, -43], lean: 12, eyes: 'focus' }), 'inout'], [15, S]]
  });
  var DB = P(S, { root: [0, -10], hip: [-2, -48], lean: -8, bend: -4, fF: [8, -8], fB: [-6, -2], faF: 30, faB: 20,
    hF: [16, -66], hB: [0, -64], skirt: 0.5, tail: 10 });
  def('dashB', {
    segs: [['go', 18]], step: 2,
    keys: [[0, P(S, { hip: [0, -42], lean: 12 })], [2, DB, 'out'], [9, P(DB, { root: [0, -7] })],
      [13, P(S, { hip: [0, -40], lean: 14, skirt: 0.2 }), 'out'], [17, S]]
  });

  // ---------------------------------------------------------------- guards
  var GS = POSE.guard = P(S, { hip: [-2, -45], lean: -2, bend: 6, hF: [15, -76], hB: [13, -70], handF: 'fist', handB: 'fist',
    eyes: 'focus', mouth: 'teeth', fB: [-12, 0], tail: -10, arch: 26 });
  def('guardStand', { segs: [['loop', 30, true]], step: 3, keys: [[0, GS], [15, bob(GS, 0, 1)]] });
  var GC = P(CR, { hF: [27, -58], hB: [23, -52], handF: 'fist', handB: 'fist', eyes: 'focus', mouth: 'teeth' });
  def('guardCrouch', { segs: [['loop', 30, true]], step: 3, keys: [[0, GC], [15, bob(GC, 0, 1)]] });

  // ---------------------------------------------------------------- hits
  var HH = P(S, { hip: [-4, -45], lean: -12, bend: -10, tilt: -15, hF: [10, -70], hB: [-10, -66], handF: 'open', handB: 'open',
    eyes: 'shut', mouth: 'hurt', fB: [-12, 0], skirt: 0.2, tail: 15, arch: 10 });
  def('hitHigh', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HH, 'snap'], [3, P(HH, { tilt: -10, lean: -9 }), 'out'], [9, P(S, { lean: 0, hip: [-2, -45], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HL = P(S, { hip: [-4, -42], lean: 28, bend: 10, hF: [13, -48], hB: [4, -46], eyes: 'shut', mouth: 'open', fB: [-12, 0], skirt: 0.15, tail: 20 });
  def('hitLow', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HL, 'snap'], [3, P(HL, { lean: 24 }), 'out'], [9, P(S, { lean: 12, hip: [-2, -43], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HC = P(CR, { hip: [-2, -20], lean: 8, bend: -6, hF: [16, -44], hB: [2, -46], handF: 'open', handB: 'open', eyes: 'shut', mouth: 'hurt', tail: 20 });
  def('hitCrouch', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HC, 'snap'], [3, P(HC, { lean: 12 }), 'out'], [10, P(CR, { eyes: 'shut', mouth: 'hurt' })], [16, P(CR, { eyes: 'focus' })]]
  });

  // ---------------------------------------------------------------- launch / down / getup
  var LA = P(S, { hip: [0, -46], lean: -50, bend: -12, tilt: -40, fF: [12, -14], fB: [4, -6], faF: 40, faB: 30,
    hF: [-8, -74], hB: [-22, -62], handF: 'open', handB: 'open', eyes: 'shut', mouth: 'open', skirt: 0.7, tail: -30, arch: 8 });
  def('launch', {
    segs: [['loop', 24, true]], step: 3,
    keys: [[0, LA],
      [6, P(LA, { hB: [-26, -54], hF: [-12, -72], fF: [14, -8], fB: [2, -10], lean: -56, tilt: -45 })],
      [12, P(LA, { hB: [-18, -68], hF: [-2, -76], fF: [8, -16], fB: [6, -4], lean: -44, tilt: -35 })],
      [18, P(LA, { hB: [-24, -60], hF: [-8, -74], fF: [13, -10], fB: [3, -8], lean: -52 })]]
  });
  var DN = P(S, { hip: [6, -6], lean: -90, bend: 0, tilt: -90, fF: [44, -3], fB: [41, -1], faF: -80, faB: -85, knF: -1, knB: -1,
    hF: [-8, -4], hB: [-30, -2], handF: 'open', handB: 'open', eyes: 'dizzy', mouth: 'hurt', tail: -65, arch: -6, skirt: 0 });
  def('down', {
    segs: [['impact', 10], ['lie', 30, true]], step: 2,
    keys: [['impact', P(DN, { root: [0, -4], eyes: 'shut' }), 'snap'],
      ['impact+2', P(DN, { root: [0, -9], hF: [-10, -16], fF: [40, -10], eyes: 'shut', skirt: 0.4 }), 'out'],
      ['impact+5', P(DN, { eyes: 'shut' }), 'in'], ['impact+7', P(DN, { root: [0, -1] })],
      ['lie', DN], ['lie+15', P(DN, { hip: [6, -7] })]]
  });
  def('getup', {
    segs: [['rise', 24]], step: 2,
    keys: [[0, P(DN, { eyes: 'shut' })],
      [5, P(S, { hip: [-2, -10], lean: -40, bend: 0, tilt: -20, fF: [26, -2], fB: [20, -1], faF: -40, faB: -40, hF: [-14, -6], hB: [-20, -4],
        handF: 'flat', handB: 'flat', eyes: 'shut', mouth: 'hurt', tail: -30 }), 'out'],
      [11, P(CR, { hip: [0, -18], lean: 20, eyes: 'focus', mouth: 'teeth' }), 'out'],
      [17, P(S, { hip: [0, -40], lean: 14, eyes: 'focus' }), 'in'], [23, S]]
  });

  // ---------------------------------------------------------------- throws
  var TH = P(S, { hip: [3, -44], lean: 18, bend: 2, hF: [33, -62], hB: [28, -64], handF: 'open', handB: 'open', fF: [16, 0], eyes: 'focus', mouth: 'grin', z: { armB: 6 } });
  def('throw', {
    segs: [['startup', 5], ['active', 2], ['recovery', 22]], step: 2,
    keys: [['startup', P(S, { lean: 10, hF: [14, -60] })], ['startup+3', TH, 'out'],
      ['active', P(TH, { hF: [34, -62], handF: 'fist', handB: 'fist' }), 'snap'],
      ['recovery+4', P(TH, { mouth: 'o', handF: 'open', eyes: 'wide' })], ['recovery+14', P(S, { lean: 10 })], ['recovery+21', S]]
  });
  // grabs the collar, hauls her in, then heaves her away with a tail smack
  var TG = P(S, { lean: 16, hip: [3, -44], hF: [28, -64], hB: [24, -66], handF: 'fist', handB: 'fist', grab: [30, -62], fF: [15, 0],
    eyes: 'focus', mouth: 'grin', z: { armB: 6 } });
  def('throwHit', {
    segs: [['hold', 16], ['toss', 14], ['recovery', 18]], step: 2,
    keys: [['hold', TG],
      ['hold+8', P(TG, { lean: 4, hip: [0, -45], hF: [20, -68], hB: [16, -70], grab: [22, -66], tail: -20, arch: 26 }), 'out'],
      ['hold+14', P(TG, { lean: -6, bend: -6, hip: [-2, -44], hF: [16, -72], hB: [12, -74], grab: [18, -70], tail: -30, arch: 30, mouth: 'teeth' })],
      ['toss+3', P(TG, { lean: 30, bend: 8, hip: [6, -40], fF: [20, 0], hF: [38, -56], hB: [32, -58], handF: 'open', handB: 'open', grab: [42, -58],
        mouth: 'shout', tail: 40, arch: 6, smear: { part: 'hF', from: 'hold+14', n: 4 } }), 'snap'],
      ['toss+8', P(TG, { lean: 32, bend: 8, hip: [6, -40], fF: [20, 0], hF: [37, -55], hB: [31, -57], handF: 'open', handB: 'open', grab: [46, -54], mouth: 'grin', tail: 30 }), 'snap'],
      ['recovery+6', P(S, { lean: 18, hip: [2, -43] }), 'out'], ['recovery+17', S]]
  });
  def('thrown', {
    segs: [['loop', 20, true]], step: 4,
    keys: [[0, P(S, { root: [0, -3], hip: [-2, -48], lean: -12, tilt: 15, hF: [6, -42], hB: [-6, -44], handF: 'open', handB: 'open', fF: [5, 1], fB: [-4, 0],
      faF: 40, faB: 50, eyes: 'shut', mouth: 'hurt', tail: 20, arch: 6 })],
      [10, P(S, { root: [0, -3], hip: [-2, -48], lean: -9, tilt: 20, hF: [5, -43], hB: [-7, -42], handF: 'open', handB: 'open', fF: [4, 1], fB: [-5, 0],
        faF: 45, faB: 50, eyes: 'shut', mouth: 'hurt', tail: 25, arch: 4 })]]
  });

  // ---------------------------------------------------------------- intro: maid curtsy → yawn → snaps into stance
  var ST = P(S, { hip: [0, -47], lean: 0, bend: 0, fF: [5, 0], fB: [-5, 0], hF: [10, -42], hB: [-7, -42], handF: 'relax', handB: 'relax' });
  def('intro', {
    segs: [['act', 100]], step: 2,
    keys: [[0, P(ST, { eyes: 'closed', mouth: 'smile', skirt: 0.2 })],
      [10, P(ST, { hip: [-2, -41], lean: 6, fB: [-15, 0], hF: [12, -38], hB: [-10, -38], skirt: 0.45, eyes: 'closed', mouth: 'smile', head: [1, 1] }), 'inout'],
      [26, P(ST, { hip: [-2, -41], lean: 8, fB: [-15, 0], hF: [12, -38], hB: [-10, -38], skirt: 0.45, eyes: 'closed', mouth: 'smile', head: [1, 1] })],
      [36, P(ST, { eyes: 'happy', mouth: 'smile', skirt: 0.1 }), 'out'],
      [48, P(ST, { hF: [14, -84], hB: [-2, -86], handF: 'fist', handB: 'fist', bend: -6, eyes: 'closed', mouth: 'o', tsw: 1.5 }), 'inout'],
      [60, P(ST, { hF: [14, -84], hB: [-2, -86], handF: 'fist', handB: 'fist', bend: -7, eyes: 'closed', mouth: 'o', tsw: 1.5 })],
      [68, P(S, { hip: [0, -40], lean: 18, eyes: 'focus', mouth: 'grin' }), 'out'],
      [74, P(S, { eyes: 'focus', mouth: 'grin' }), 'out'], [86, bob(S, 0, 1)], [96, S]]
  });
  // ---------------------------------------------------------------- win: hop, cheer, then a smug wave with the tail wagging
  var WN = P(ST, { hip: [0, -47], hF: [16, -88], hB: [-6, -50], handF: 'open', handB: 'relax', eyes: 'happy', mouth: 'grin', blush: 1, tsw: 2.6, tail: -10 });
  def('win', {
    segs: [['in', 30], ['loop', 60, true]], step: 2,
    keys: [['in', P(S, { eyes: 'closed' })],
      ['in+6', P(S, { hip: [0, -38], lean: 18, eyes: 'closed', mouth: 'grin', skirt: 0.2 }), 'in'],
      ['in+12', P(WN, { root: [0, -14], fF: [5, -8], fB: [-5, -4], faF: 30, faB: 30, hF: [14, -92], hB: [-2, -90], handB: 'fist', handF: 'fist', skirt: 0.7 }), 'out'],
      ['in+20', P(WN, { root: [0, 0], hip: [0, -42], lean: 6, skirt: 0.3 }), 'in'], ['in+26', WN],
      ['loop', WN], ['loop+15', P(WN, { hF: [20, -86] })], ['loop+30', WN], ['loop+45', P(WN, { hF: [20, -86], hip: [0, -46] })]]
  });
  // ---------------------------------------------------------------- lose (time over): slump, tail droops
  var LS = P(ST, { hip: [0, -46], lean: 8, bend: 8, head: [1, 1], hF: [7, -40], hB: [-7, -40], handF: 'relax', handB: 'relax', shr: -1,
    eyes: 'sad', mouth: 'frown', tail: 25, arch: 6, tsw: 0.4 });
  def('lose', {
    segs: [['in', 30], ['loop', 60, true]], step: 3,
    keys: [['in', P(S, { eyes: 'wide', mouth: 'o' })], ['in+10', P(LS, { eyes: 'wide', mouth: 'o', tail: 10 }), 'out'], ['in+22', LS],
      ['loop', LS], ['loop+30', P(LS, { hip: [0, -45], eyes: 'closed', sq: 1 })]]
  });
})();
