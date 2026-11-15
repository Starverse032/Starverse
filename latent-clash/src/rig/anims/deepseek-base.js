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
  // gait under the long skirt: heel strike = planted toe tipped up out of the hem, push-off toe down,
  // hem lifted a little and swinging with the stepping leg, the tail counter-swaying, a small bounce
  function gait(dir, sw, tl) {
    return function (pose, k, ph) {
      var a = k < 4 ? 'F' : 'B', o = a === 'F' ? 'B' : 'F', sg = (a === 'F' ? 1 : -1) * (1 - 2 * ph);
      if (ph === 0) pose['fa' + a] = dir > 0 ? -22 : -12;          // heel strike: toe tips up past the hem
      else if (ph === 0.25) pose['fa' + o] = 30;                   // push-off
      else if (ph === 0.5) pose['fa' + o] = 12;
      pose.tw = sw * Math.cos(Math.PI * ph) * (a === 'F' ? 1 : -1) + (dir > 0 ? 2 : -2);
      pose.hem = ph === 0.5 ? -4 : -3;
      pose.tail = (pose.tail || 0) - tl * sg;
      pose.skirt = (pose.skirt || 0) + (ph === 0.5 ? 0.12 : 0.04);
    };
  }
  var WK = P(S, { lean: 7, bend: -2, hF: [17, -59], hB: [4, -56], skirt: 0.05 });
  def('walkF', { segs: [['loop', 32, true]], step: 2, walk: 2.0, keys: walk2(WK, 2.0, { lift: 6, bob: 2, leg: 47, swingF: 3, swingB: 3, extra: gait(1, 7, 9) }) });
  var WKB = P(S, { lean: 0, bend: -3, hF: [15, -61], hB: [4, -57], tail: 8 });
  def('walkB', { segs: [['loop', 32, true]], step: 2, walk: -1.5, keys: walk2(WKB, -1.5, { lift: 5, bob: 1.5, leg: 47, swingF: 2, swingB: 2, extra: gait(-1, 5, 7) }) });

  // ---------------------------------------------------------------- crouch
  var CR = POSE.crouch = P(S, { hip: [1, -19], lean: 28, bend: 4, fF: [13, 0], fB: [-10, 0], faB: 25, hF: [27, -46], hB: [18, -40], head: [1, 0],
    handF: 'open', handB: 'relax', tail: 10, arch: 18, pool: 1, skirt: 0.3 });
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
    hF: [-8, -74], hB: [-22, -62], handF: 'open', handB: 'open', eyes: 'shut', mouth: 'open', skirt: 0.15, tail: -30, arch: 8 });
  // tumbling: the body rolls back, skirt, hair and tail trail and whip a beat behind
  var LA2 = function (lean, tilt, hF, hB, fF, fB, sk, tail, pen) {
    return P(LA, { lean: lean, tilt: tilt, hF: hF, hB: hB, fF: fF, fB: fB, skirt: sk, tail: tail, pen: pen, arch: 12, tsw: 2.2 });
  };
  def('launch', {
    segs: [['loop', 24, true]], step: 3,
    keys: [[0, LA2(-50, -40, [-8, -74], [-22, -62], [12, -14], [4, -6], 0.75, 30, 18)],
      [6, LA2(-62, -50, [-14, -70], [-28, -52], [16, -6], [0, -12], 0.45, 55, -14), 'out'],
      [12, LA2(-44, -32, [-2, -78], [-16, -70], [8, -18], [8, -4], 0.85, 22, 24), 'inout'],
      [18, LA2(-58, -46, [-10, -72], [-26, -56], [15, -8], [2, -10], 0.5, 50, -10), 'out']]
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
  // getup: rolls onto her hands, pushes up with the tail braced on the floor, hops to her feet
  def('getup', {
    segs: [['rise', 24]], step: 2,
    keys: [[0, P(DN, { eyes: 'shut' })],
      [4, P(S, { hip: [-4, -8], lean: -30, bend: 4, tilt: -10, fF: [18, -2], fB: [12, -1], faF: -30, faB: -30, hF: [-16, -2], hB: [-22, -2],
        handF: 'flat', handB: 'flat', eyes: 'shut', mouth: 'hurt', tail: 30, arch: 2, tsw: 0.3, skirt: 0.2 }), 'out'],
      [9, P(S, { hip: [-3, -22], lean: 40, bend: 6, tilt: -5, fF: [0, 0], fB: [-10, 0], faF: 50, faB: 70, hF: [16, -1], hB: [10, -1],
        handF: 'flat', handB: 'flat', eyes: 'focus', mouth: 'teeth', tail: -10, arch: 4, tsw: 0.3, skirt: 0.1 }), 'inout'],
      [13, P(S, { root: [0, -5], hip: [0, -44], lean: 8, bend: -4, fF: [7, -8], fB: [-7, -10], faF: 35, faB: 40, hF: [16, -64], hB: [-6, -66],
        handF: 'open', handB: 'open', eyes: 'focus', mouth: 'grin', tail: -35, arch: 26, pen: 12, skirt: 0.7, tsw: 1.5, hs: 0.2 }), 'inout'],
      [17, P(S, { hip: [0, -37], lean: 16, bend: 4, sq: 1, hF: [21, -48], hB: [9, -46], skirt: 0.35, tail: 10, eyes: 'focus', mouth: 'grin', hs: 0.15 }), 'in'],
      [20, P(S, { hip: [0, -44], lean: 8, eyes: 'focus' }), 'out'], [23, S]]
  });

  // ---------------------------------------------------------------- throws
  var TH = P(S, { hip: [3, -44], lean: 18, bend: 2, hF: [33, -62], hB: [28, -64], handF: 'open', handB: 'open', fF: [16, 0], eyes: 'focus', mouth: 'grin', z: { armB: 6 } });
  def('throw', {
    segs: [['startup', 5], ['active', 2], ['recovery', 22]], step: 2,
    keys: [['startup', P(S, { lean: 10, hF: [14, -60] })], ['startup+3', TH, 'out'],
      ['active', P(TH, { hF: [34, -62], handF: 'fist', handB: 'fist' }), 'snap'],
      ['recovery+4', P(TH, { mouth: 'o', handF: 'open', eyes: 'wide' })], ['recovery+14', P(S, { lean: 10 })], ['recovery+21', S]]
  });
  // grabs the collar, heaves her up overhead (tail braced down as a counterweight), then slams her down
  // forward while the tail flings up behind for balance
  var TG = P(S, { lean: 16, hip: [3, -44], hF: [28, -64], hB: [24, -66], handF: 'fist', handB: 'fist', grab: [30, -62], fF: [15, 0],
    eyes: 'focus', mouth: 'grin', z: { armB: 6 } });
  var TU = P(TG, { lean: -12, bend: -8, tilt: -10, hip: [-3, -42], sq: 1, fF: [16, 0], fB: [-13, 0], hF: [12, -86], hB: [8, -88], grab: [12, -90],
    tail: 32, arch: 1, tsw: 0.2, mouth: 'teeth', skirt: 0.2 });
  var TS = P(TG, { lean: 36, bend: 10, tilt: 10, hip: [7, -37], fF: [21, 0], fB: [-12, 0], faB: 30, hF: [38, -40], hB: [33, -42], handF: 'open', handB: 'open',
    grab: [44, -36], mouth: 'shout', tail: 85, arch: 10, tsw: 0.3, skirt: 0.45 });
  def('throwHit', {
    segs: [['hold', 16], ['toss', 14], ['recovery', 18]], step: 2,
    keys: [['hold', TG],
      ['hold+5', P(TG, { lean: 4, hip: [0, -44], hF: [22, -70], hB: [18, -72], grab: [24, -70], tail: -20, arch: 14 }), 'out'],
      ['hold+12', TU, 'inout'], ['hold+15', P(TU, { hip: [-3, -44], hF: [10, -88], grab: [10, -92], sq: 0 })],
      ['toss+2', P(TS, { hs: 0.45, smear: { part: 'hF', from: 'hold+15', n: 4 } }), 'snap'],
      ['toss+4', P(TS, { hip: [7, -36], sq: 1, mouth: 'grin', tail: 95, arch: 4, hs: 0.3 }), 'snap'],
      ['toss+10', P(TS, { mouth: 'grin', tail: 70, arch: 12, eyes: 'happy' })],
      ['recovery+6', P(S, { lean: 18, hip: [2, -43], tail: 20, mouth: 'grin' }), 'out'], ['recovery+17', S]]
  });
  // thrown: held up by the collar, limp — arms and legs dangle, head lolls, tail hangs and swings
  var TW = P(S, { root: [0, -4], hip: [-2, -48], lean: -6, bend: 4, tilt: 28, hF: [5, -36], hB: [-5, -35], handF: 'relax', handB: 'relax', elF: 1, elB: 1,
    fF: [3, 0], fB: [-3, -1], faF: 55, faB: 60, eyes: 'dizzy', mouth: 'hurt', tail: -14, arch: 5, tsw: 0.4, skirt: -0.1 });
  def('thrown', {
    segs: [['loop', 20, true]], step: 4,
    keys: [[0, TW],
      [6, P(TW, { lean: -2, tilt: 32, hF: [8, -36], hB: [-2, -35], fF: [5, 0], fB: [-1, -1], tail: -8 }), 'inout'],
      [14, P(TW, { lean: -9, tilt: 24, hF: [3, -37], hB: [-7, -36], fF: [1, 0], fB: [-5, -1], tail: -20 }), 'inout']]
  });

  // ---------------------------------------------------------------- intro: maid curtsy → lazy stretch-yawn → eye rub → snaps into stance
  var ST = P(S, { hip: [0, -47], lean: 0, bend: 0, fF: [5, 0], fB: [-5, 0], hF: [10, -42], hB: [-7, -42], handF: 'relax', handB: 'relax' });
  var CU = P(ST, { hip: [-3, -36], lean: 8, fB: [-17, 0], faB: 25, hF: [17, -40], hB: [-15, -40], handF: 'open', handB: 'open', skirt: 0.6,
    head: [1, 2], tilt: 18, eyes: 'closed', mouth: 'smile', tail: 25, arch: 12, tsw: 0.5 });
  var YW = P(ST, { hip: [0, -48], lean: -4, bend: -8, tilt: -16, fF: [5, 0], fB: [-5, 0], faF: 0, hF: [9, -91], hB: [3, -93], handF: 'fist', handB: 'fist',
    eyes: 'closed', mouth: 'o', tail: 62, arch: 5, tsw: 0.3, skirt: 0.1 });
  def('intro', {
    segs: [['act', 100]], step: 2,
    keys: [[0, P(ST, { eyes: 'closed', mouth: 'smile', skirt: 0.2 })],
      [8, CU, 'inout'], [20, P(CU, { hip: [-3, -35], tilt: 20 })],
      [28, P(ST, { eyes: 'happy', mouth: 'smile', blush: 1, skirt: 0.25, tail: -5 }), 'out'],
      [40, YW, 'inout'], [52, P(YW, { hip: [0, -49], bend: -10, tilt: -20, hF: [8, -92], hB: [2, -94] })],
      [58, P(ST, { hF: [13, -80], hB: [-6, -48], handF: 'relax', tilt: 6, eyes: 'half', mouth: 'neutral', tail: 10, tsw: 1 }), 'out'],
      [64, P(ST, { hF: [12, -78], hB: [-6, -48], handF: 'relax', tilt: 4, eyes: 'half', mouth: 'smile', tail: 5, tsw: 1 })],
      [70, P(S, { hip: [0, -40], lean: 18, eyes: 'focus', mouth: 'grin', tail: -25, arch: 30 }), 'out'],
      [76, P(S, { eyes: 'focus', mouth: 'grin', tail: 10 }), 'out'], [86, bob(S, 0, 1)], [96, S]]
  });
  // ---------------------------------------------------------------- win: crouch, happy hop, then bouncing on her toes waving, tail wagging
  var WN = P(ST, { hip: [0, -47], hF: [16, -88], hB: [-6, -50], handF: 'open', handB: 'relax', eyes: 'happy', mouth: 'grin', blush: 1, tsw: 1.2, tail: -10 });
  var wag = function (k) {
    var r = k & 1 ? 1 : -1;
    return P(WN, { hip: [0, k & 1 ? -46 : -48], hF: [16 + 4 * r, -88 + (k & 1)], tilt: 5 * r, tail: -10 + 22 * r, arch: 22 - 4 * r, sq: k & 1 });
  };
  def('win', {
    segs: [['in', 30], ['loop', 60, true]], step: 2,
    keys: [['in', P(S, { eyes: 'closed' })],
      ['in+6', P(S, { hip: [0, -38], lean: 18, eyes: 'closed', mouth: 'grin', skirt: 0.2, tail: 20 }), 'in'],
      ['in+12', P(WN, { root: [0, -16], fF: [5, -9], fB: [-5, -5], faF: 30, faB: 30, hF: [14, -92], hB: [-2, -90], handB: 'fist', handF: 'fist', skirt: 0.75, tail: -40, arch: 26 }), 'out'],
      ['in+20', P(WN, { root: [0, 0], hip: [0, -41], lean: 6, sq: 1, skirt: 0.35, tail: 15 }), 'in'], ['in+26', wag(0)],
      ['loop', wag(0)], ['loop+8', wag(1)], ['loop+15', wag(2)], ['loop+23', wag(3)], ['loop+30', wag(4)], ['loop+38', wag(5)], ['loop+45', wag(6)], ['loop+53', wag(7)]]
  });
  // ---------------------------------------------------------------- lose (time over): shock, then a sulk — arms folded, pout, foot scuffing, tail flat on the floor
  var LS = P(ST, { hip: [0, -46], lean: 6, bend: 6, head: [1, 1], tilt: 14, hF: [9, -57], hB: [8, -60], handF: 'relax', handB: 'relax', shr: -1, z: { armB: 6 },
    eyes: 'sad', mouth: 'frown', tail: -28, arch: 2, tsw: 0.15, skirt: -0.05 });
  def('lose', {
    segs: [['in', 30], ['loop', 60, true]], step: 3,
    keys: [['in', P(S, { eyes: 'wide', mouth: 'o' })], ['in+6', P(S, { eyes: 'wide', mouth: 'o', hip: [-1, -47], lean: -4, tail: -40, arch: 30, tsw: 0 }), 'out'],
      ['in+18', P(LS, { tail: -15 }), 'inout'], ['in+26', LS],
      ['loop', LS], ['loop+15', P(LS, { fF: [13, -2], faF: 25, tilt: 16 })], ['loop+21', P(LS, { fF: [12, 0] })],
      ['loop+36', P(LS, { hip: [0, -45], sq: 1, eyes: 'closed', tilt: 18 })], ['loop+48', P(LS, { eyes: 'closed', mouth: 'frown' })]]
  });
})();
