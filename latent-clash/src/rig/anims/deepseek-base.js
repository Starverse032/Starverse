/* LATENT CLASH — RIG: DeepSeek 娘 base motion (stance + all common anims).
 * Personality: bouncy, low, boxer-like; quick shuffles, peek-a-boo guard.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob, G = I.gen;
  var def = function (name, d) { return I.defAnim('deepseek', name, d); };
  var S = I.CHARS.deepseek.rest;
  var LEG = 28;
  var POSE = I.POSE_DEEPSEEK = { stance: S };

  // ---------------------------------------------------------------- idle (two bounces per loop)
  def('idle', {
    segs: [['loop', 64, true]], step: 2,
    keys: [
      [0, S],
      [8, bob(S, 0, 2, { hF: [14, -33], hB: [8, -34] }), 'out'],
      [16, bob(S, 0, -1, { hF: [15, -37] }), 'inout'],
      [32, S],
      [40, bob(S, 0, 2, { hF: [13, -33], hB: [8, -34] }), 'out'],
      [48, bob(S, 0, -1, { hB: [8, -38] }), 'inout']
    ]
  });

  // ---------------------------------------------------------------- walk (bouncy shuffles)
  def('walkF', {
    segs: [['loop', 32, true]], step: 2, walk: 1.7,
    keys: G.shuffle(P(S, { lean: 10 }), 1.7, 32, 4, { lift: 4, bob: 1.5, leg: LEG })
  });
  def('walkB', {
    segs: [['loop', 32, true]], step: 2, walk: -1.3,
    keys: G.shuffle(P(S, { lean: 4, hF: [12, -37], hB: [7, -38] }), -1.3, 32, 4, { lift: 3, bob: 1.5, leg: LEG })
  });

  // ---------------------------------------------------------------- crouch
  var C = POSE.crouch = P(S, { hip: [-1, -13], lean: 22, bend: 4, hF: [14, -25], hB: [9, -26], fF: [11, 0], fB: [-9, 0] });
  def('crouchIn', { segs: [['go', 4]], step: 1, keys: [[0, bob(S, 0, 4, { lean: 14 })], [3, C]] });
  def('crouch', {
    segs: [['loop', 64, true]], step: 2,
    keys: [[0, C], [16, bob(C, 0, 1)], [32, C], [48, bob(C, 0, 1, { hF: [15, -24] })]]
  });
  def('crouchOut', { segs: [['go', 4]], step: 1, keys: [[0, C], [3, bob(S, 0, 3, { lean: 12 })]] });

  // ---------------------------------------------------------------- jump
  var SQ = P(S, { hip: [0, -16], lean: 18, hF: [14, -26], hB: [8, -27], eyes: 'focus', mouth: 'grin' });
  def('jumpSquat', { segs: [['go', 4]], step: 1, keys: [[0, bob(S, 0, 3)], [2, SQ]] });
  var JR = POSE.jumpRise = P(S, { hip: [0, -28], lean: 6, fF: [7, -11], fB: [-5, -6], faF: 30, faB: 45,
    hF: [13, -43], hB: [-6, -48], handB: 'fist', mouth: 'grin' });
  def('jumpRise', { segs: [['loop', 12, true]], step: 3, keys: [[0, JR], [6, P(JR, { hB: [-7, -47], fF: [7, -12] })]] });
  var JF = POSE.jumpFall = P(S, { hip: [0, -28], lean: 2, fF: [6, -2], fB: [-6, -5], faF: 15, faB: 30, hF: [14, -38], hB: [-8, -43] });
  def('jumpFall', { segs: [['loop', 12, true]], step: 3, keys: [[0, JF], [6, P(JF, { hB: [-8, -44], fB: [-6, -4] })]] });
  def('land', {
    segs: [['go', 6]], step: 1,
    keys: [[0, P(S, { hip: [0, -15], lean: 20, hF: [14, -25], hB: [6, -26] })], [2, P(S, { hip: [0, -18], lean: 14 })], [5, S]]
  });

  // ---------------------------------------------------------------- dashes
  var DF = P(S, { hip: [3, -19], lean: 34, bend: 4, fF: [15, -3], fB: [-13, 0], faB: 40, faF: -5,
    hF: [20, -30], hB: [12, -31], eyes: 'focus', mouth: 'grin' });
  def('dashF', {
    segs: [['go', 16]], step: 2,
    keys: [
      [0, P(S, { hip: [0, -18], lean: 18 })],
      [2, DF, 'out'],
      [9, P(DF, { fF: [12, 0], faF: 0, hip: [2, -18] })],
      [12, P(S, { hip: [0, -19], lean: 14 })],
      [15, S]
    ]
  });
  var DB = P(S, { root: [0, -8], hip: [-1, -26], lean: -8, fF: [5, -8], fB: [-7, -4], faF: 35, faB: 25, hF: [12, -38], hB: [6, -40] });
  def('dashB', {
    segs: [['go', 18]], step: 2,
    keys: [
      [0, P(S, { hip: [0, -18], lean: 12 })],
      [2, DB, 'out'],
      [9, P(DB, { root: [0, -5] })],
      [12, P(S, { hip: [0, -16], lean: 16 }), 'out'],
      [17, S]
    ]
  });

  // ---------------------------------------------------------------- guard (peek-a-boo)
  var GS = POSE.guard = P(S, { hip: [-1, -21], lean: 4, bend: 4, hF: [11, -42], hB: [9, -44], tilt: 10, eyes: 'focus', mouth: 'teeth', fB: [-11, 0] });
  def('guardStand', { segs: [['loop', 30, true]], step: 3, keys: [[0, GS], [15, bob(GS, 0, 1)]] });
  var GC = P(C, { lean: 16, hF: [12, -31], hB: [10, -33], tilt: 10, eyes: 'focus', mouth: 'teeth' });
  def('guardCrouch', { segs: [['loop', 30, true]], step: 3, keys: [[0, GC], [15, bob(GC, 0, 1)]] });

  // ---------------------------------------------------------------- hits
  var HH = P(S, { hip: [-3, -22], lean: -14, bend: -6, tilt: -25, hF: [6, -42], hB: [-8, -44], handF: 'open', handB: 'open',
    eyes: 'shut', mouth: 'hurt', fB: [-11, 0] });
  def('hitHigh', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HH, 'snap'], [3, P(HH, { tilt: -18, lean: -11 }), 'out'], [9, P(S, { lean: -2, tilt: -5, hip: [-2, -22], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HL = P(S, { hip: [-3, -20], lean: 36, bend: 10, tilt: 15, hF: [9, -26], hB: [4, -28], eyes: 'shut', mouth: 'open', fB: [-11, 0] });
  def('hitLow', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HL, 'snap'], [3, P(HL, { lean: 32 }), 'out'], [9, P(S, { lean: 18, hip: [-2, -20], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HC = P(C, { hip: [-3, -12], lean: -2, tilt: -15, hF: [8, -30], hB: [-2, -32], handF: 'open', handB: 'open', eyes: 'shut', mouth: 'hurt' });
  def('hitCrouch', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HC, 'snap'], [3, P(HC, { lean: 2 }), 'out'], [10, P(C, { eyes: 'shut', mouth: 'hurt' })], [16, P(C, { eyes: 'focus' })]]
  });

  // ---------------------------------------------------------------- launch / down / getup
  var LA = P(S, { hip: [0, -22], lean: -45, bend: -10, tilt: -35, fF: [7, -8], fB: [0, -2], faF: 40, faB: 30,
    hF: [-4, -46], hB: [-14, -40], handF: 'open', handB: 'open', eyes: 'shut', mouth: 'open' });
  def('launch', {
    segs: [['loop', 24, true]], step: 4,
    keys: [[0, LA], [8, P(LA, { hB: [-16, -36], fF: [8, -6], lean: -48 })], [16, P(LA, { hF: [-2, -48], fB: [1, -4], lean: -42 })]]
  });
  var DN = P(S, { hip: [-2, -5], lean: -90, bend: 0, tilt: -90, fF: [24, -2], fB: [22, -1], faF: -80, faB: -85,
    hF: [-4, -3], hB: [-24, -2], handF: 'open', handB: 'open', eyes: 'dizzy', mouth: 'hurt' });
  def('down', {
    segs: [['impact', 10], ['lie', 30, true]], step: 2,
    keys: [
      ['impact', P(DN, { root: [0, -3], eyes: 'shut' }), 'snap'],
      ['impact+2', P(DN, { root: [0, -7], hF: [-6, -12], fF: [21, -8], eyes: 'shut' }), 'out'],
      ['impact+5', P(DN, { eyes: 'shut' }), 'in'],
      ['impact+7', P(DN, { root: [0, -1] })],
      ['lie', DN], ['lie+15', P(DN, { hip: [-2, -6] })]
    ]
  });
  def('getup', {
    segs: [['rise', 24]], step: 2,
    keys: [
      [0, P(DN, { eyes: 'shut' })],
      [4, P(S, { hip: [-6, -4], lean: -60, tilt: -40, fF: [6, -10], fB: [2, -6], hF: [-14, -8], hB: [-18, -2], handF: 'flat', handB: 'flat', eyes: 'shut' }), 'out'],
      [9, P(S, { root: [0, -6], hip: [0, -16], lean: 10, fF: [6, -4], fB: [-6, -2], faF: 30, faB: 30, eyes: 'focus', mouth: 'grin' }), 'out'],
      [15, P(S, { hip: [0, -15], lean: 20, eyes: 'focus' }), 'in'],
      [20, P(S, { hip: [0, -19], lean: 12 })],
      [23, S]
    ]
  });

  // ---------------------------------------------------------------- throws
  var TH = P(S, { lean: 22, hip: [3, -20], hF: [24, -36], hB: [18, -38], handF: 'open', handB: 'open', eyes: 'focus', mouth: 'grin', fF: [13, 0] });
  def('throw', {
    segs: [['startup', 5], ['active', 2], ['recovery', 22]], step: 2,
    keys: [
      ['startup', P(S, { lean: 12 })],
      ['startup+3', TH, 'out'],
      ['active', P(TH, { hF: [25, -36], handF: 'fist', handB: 'fist' }), 'snap'],
      ['recovery+4', P(TH, { mouth: 'o', handF: 'open' })],
      ['recovery+14', P(S, { lean: 12 })],
      ['recovery+21', S]
    ]
  });
  // grabs the hood, swings round and tosses her over the shoulder
  var TG = P(S, { lean: 14, hip: [2, -21], hF: [18, -38], hB: [15, -40], handF: 'fist', handB: 'fist', grab: [21, -40], eyes: 'focus', mouth: 'grin' });
  def('throwHit', {
    segs: [['hold', 16], ['toss', 14], ['recovery', 18]], step: 2,
    keys: [
      ['hold', TG],
      ['hold+10', P(TG, { lean: 6, hip: [0, -20], hF: [12, -42], hB: [10, -44], grab: [15, -44] })],
      ['toss', P(TG, { lean: -10, hip: [-2, -21], hF: [2, -50], hB: [0, -52], grab: [2, -54], mouth: 'shout' }), 'in'],
      ['toss+7', P(TG, { lean: 30, hip: [4, -19], hF: [24, -30], hB: [20, -32], handF: 'open', handB: 'open', grab: [30, -26], mouth: 'shout', smear: { part: 'hF', from: 'toss+0' } }), 'out'],
      ['toss+13', P(TG, { lean: 26, hF: [22, -30], hB: [18, -32], handF: 'open', handB: 'open', grab: [34, -22] })],
      ['recovery+6', P(S, { lean: 14 })],
      ['recovery+17', S]
    ]
  });
  def('thrown', {
    segs: [['loop', 20, true]], step: 4,
    keys: [
      [0, P(S, { root: [0, -3], hip: [-2, -27], lean: -12, tilt: 15, hF: [5, -22], hB: [-4, -23], handF: 'open', handB: 'open', fF: [4, 1], fB: [-3, 0], faF: 40, faB: 50, eyes: 'shut', mouth: 'hurt' })],
      [10, P(S, { root: [0, -3], hip: [-2, -27], lean: -9, tilt: 20, hF: [4, -23], hB: [-5, -22], handF: 'open', handB: 'open', fF: [3, 1], fB: [-4, 0], faF: 45, faB: 50, eyes: 'shut', mouth: 'hurt' })]
    ]
  });

  // ---------------------------------------------------------------- intro / win / lose
  var ST = P(S, { hip: [0, -27], lean: 0, bend: 0, fF: [5, 0], fB: [-5, 0] });
  def('intro', {
    segs: [['act', 100]], step: 2,
    keys: [
      [0, P(ST, { root: [0, -10], hF: [8, -52], hB: [-6, -54], handF: 'open', handB: 'open', eyes: 'happy', mouth: 'grin', fF: [3, -4], fB: [-4, -2] })],
      [8, P(ST, { root: [0, 0], hip: [0, -18], lean: 12, hF: [12, -30], hB: [-6, -30], eyes: 'closed', mouth: 'grin' }), 'out'],
      [16, P(ST, { hF: [10, -40], hB: [-4, -42], eyes: 'happy', mouth: 'grin' }), 'out'],
      [28, P(ST, { hF: [9, -38], hB: [8, -38], handF: 'fist', handB: 'fist', eyes: 'focus', mouth: 'grin', z: { armB: 6 } }), 'in'],
      [32, P(ST, { hip: [0, -26], hF: [7, -38], hB: [7, -38], eyes: 'closed', mouth: 'grin', z: { armB: 6 } }), 'snap'],
      [44, P(ST, { hF: [7, -38], hB: [7, -38], eyes: 'happy', mouth: 'grin', z: { armB: 6 } })],
      [60, P(S, { eyes: 'focus', mouth: 'grin' }), 'out'],
      [70, bob(S, 0, 2, { mouth: 'grin' })],
      [78, P(S, { mouth: 'grin' })],
      [86, bob(S, 0, 2)],
      [94, S]
    ]
  });
  var WN = P(ST, { hip: [0, -27], hF: [9, -58], hB: [-3, -36], handF: 'fist', eyes: 'happy', mouth: 'grin', blush: 1 });
  def('win', {
    segs: [['in', 30], ['loop', 60, true]], step: 2,
    keys: [
      ['in', P(S, { eyes: 'closed' })],
      ['in+6', P(S, { hip: [0, -15], lean: 20, eyes: 'closed', mouth: 'grin' }), 'in'],
      ['in+12', P(WN, { root: [0, -12], fF: [4, -6], fB: [-5, -3], faF: 30, faB: 30 }), 'out'],
      ['in+20', P(WN, { root: [0, 0], hip: [0, -22], lean: 6 }), 'in'],
      ['in+26', WN],
      ['loop', WN],
      ['loop+15', bob(WN, 0, 2)],
      ['loop+30', WN],
      ['loop+45', bob(WN, 0, 2, { hF: [10, -57] })]
    ]
  });
  var LS = P(ST, { hip: [0, -26], lean: 10, bend: 6, tilt: 25, hF: [6, -22], hB: [-6, -22], handF: 'relax', handB: 'relax', shr: -1, eyes: 'sad', mouth: 'frown' });
  def('lose', {
    segs: [['in', 30], ['loop', 60, true]], step: 3,
    keys: [
      ['in', P(S, { eyes: 'wide', mouth: 'o' })],
      ['in+10', P(LS, { tilt: 5, eyes: 'wide', mouth: 'o' }), 'out'],
      ['in+22', LS],
      ['loop', LS],
      ['loop+30', P(LS, { hip: [0, -25], tilt: 30, eyes: 'closed', sq: 1 })]
    ]
  });
})();
