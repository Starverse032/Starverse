/* LATENT CLASH — RIG: Claude 娘 base motion (stance + all common anims).
 * Personality: poised, upright, fencing-like; the pen is handled like a rapier.
 * Poses are origin-relative (feet line), facing right; see NOTES.md.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob, G = I.gen;
  var def = function (name, d) { return I.defAnim('claude', name, d); };

  var S = I.CHARS.claude.rest;     // en garde
  var LEG = 31;
  var POSE = I.POSE_CLAUDE = { stance: S };

  // ---------------------------------------------------------------- idle
  def('idle', {
    segs: [['loop', 64, true]], step: 4,
    keys: [
      [0, S],
      [16, bob(S, 0, 1, { pen: 33, hF: [11, -26], hB: [-4, -31] })],
      [32, bob(S, 0, 1, { pen: 34, hF: [11, -26], sq: 0 })],
      [48, P(S, { pen: 31, sq: -1, hB: [-4, -33] })]
    ]
  });

  // ---------------------------------------------------------------- walk
  var W = P(S, { hF: [11, -28], pen: 30, lean: 1 });
  def('walkF', {
    segs: [['loop', 32, true]], step: 2, walk: 1.3,
    keys: G.walk(W, 1.3, 32, { lift: 4, bob: 1, leg: LEG, swingF: 1, swingB: 3 })
  });
  var WB = P(S, { hF: [10, -29], pen: 26, lean: -2, hB: [-6, -32] });
  def('walkB', {
    segs: [['loop', 36, true]], step: 2, walk: -1.0,
    keys: G.walk(WB, -1.0, 36, { lift: 3, bob: 1, leg: LEG, swingF: 1, swingB: 2 })
  });

  // ---------------------------------------------------------------- crouch
  var C = POSE.crouch = P(S, { hip: [-1, -16], lean: 20, bend: 4, head: [1, 1], hF: [13, -18], hB: [-5, -20], fF: [10, 0], fB: [-8, 0], pen: 22, faB: 0 });
  def('crouchIn', { segs: [['go', 4]], step: 1, keys: [[0, bob(S, 0, 6, { lean: 10 })], [3, C]] });
  def('crouch', {
    segs: [['loop', 64, true]], step: 4,
    keys: [[0, C], [24, bob(C, 0, 1, { pen: 24 })], [44, P(C, { sq: -1, pen: 21 })]]
  });
  def('crouchOut', { segs: [['go', 4]], step: 1, keys: [[0, C], [3, bob(S, 0, 3, { lean: 6 })]] });

  // ---------------------------------------------------------------- jump
  var SQ = POSE.squat = P(S, { hip: [0, -23], lean: 12, hF: [12, -21], hB: [-8, -23], pen: 40, eyes: 'focus' });
  def('jumpSquat', { segs: [['go', 4]], step: 1, keys: [[0, bob(S, 0, 3)], [2, SQ]] });
  var JR = POSE.jumpRise = P(S, { hip: [0, -32], lean: 4, fF: [6, -10], fB: [-6, -5], faF: 25, faB: 45, knF: -1,
    hF: [13, -40], hB: [-11, -47], pen: 5, handB: 'open', mouth: 'neutral' });
  def('jumpRise', { segs: [['loop', 12, true]], step: 3, keys: [[0, JR], [6, P(JR, { hB: [-12, -46], fF: [6, -11] })]] });
  var JF = POSE.jumpFall = P(S, { hip: [0, -32], lean: 0, fF: [6, -2], fB: [-6, -4], faF: 15, faB: 25,
    hF: [14, -36], hB: [-12, -41], pen: 20, handB: 'open' });
  def('jumpFall', { segs: [['loop', 12, true]], step: 3, keys: [[0, JF], [6, P(JF, { hB: [-12, -42], fB: [-6, -3] })]] });
  def('land', {
    segs: [['go', 6]], step: 1,
    keys: [[0, P(S, { hip: [0, -22], lean: 14, hF: [13, -20], hB: [-9, -24], pen: 42 })], [2, P(S, { hip: [0, -24], lean: 10, pen: 38 })], [5, S]]
  });

  // ---------------------------------------------------------------- dashes
  // fleche-like glide: lean in, pen trailing like a rapier, back leg pushing
  var DF = P(S, { hip: [2, -26], lean: 26, bend: 4, fF: [16, -2], fB: [-14, 0], faB: 35, faF: -10,
    hF: [-4, -30], pen: 165, pg: 0.35, hB: [-14, -36], eyes: 'focus' });
  def('dashF', {
    segs: [['go', 18]], step: 2,
    keys: [
      [0, P(S, { hip: [0, -27], lean: 12 })],
      [2, DF, 'out'],
      [10, P(DF, { fF: [12, 0], faF: 0, hip: [1, -25] })],
      [14, P(S, { hip: [0, -26], lean: 8 })],
      [17, S]
    ]
  });
  var DB = P(S, { root: [0, -6], hip: [-1, -30], lean: -12, fF: [6, -6], fB: [-7, -3], faF: 30, faB: 20,
    hF: [8, -34], pen: 10, hB: [-12, -40], handB: 'open' });
  def('dashB', {
    segs: [['go', 20]], step: 2,
    keys: [
      [0, P(S, { hip: [0, -26], lean: 6 })],
      [3, DB, 'out'],
      [10, P(DB, { root: [0, -4] })],
      [13, P(S, { hip: [0, -24], lean: 10, pen: 40 }), 'out'],
      [19, S]
    ]
  });

  // ---------------------------------------------------------------- guard
  var GS = POSE.guard = P(S, { hip: [-1, -29], lean: -5, fB: [-10, 0], hF: [8, -33], pen: -66, pg: 0.5, hB: [14, -45],
    handB: 'flat', eyes: 'focus', mouth: 'teeth', z: { armB: 6 } });
  def('guardStand', { segs: [['loop', 30, true]], step: 3, keys: [[0, GS], [15, bob(GS, 0, 1)]] });
  var GC = POSE.guardCrouch = P(C, { lean: 8, hF: [10, -20], pen: -62, pg: 0.5, hB: [15, -31], handB: 'flat', eyes: 'focus', mouth: 'teeth', z: { armB: 6 } });
  def('guardCrouch', { segs: [['loop', 30, true]], step: 3, keys: [[0, GC], [15, bob(GC, 0, 1)]] });

  // ---------------------------------------------------------------- hits
  var HH = P(S, { hip: [-3, -29], lean: -16, bend: -6, head: [-1, 0], tilt: -20, hF: [6, -33], pen: 70, hB: [-14, -40],
    handB: 'open', eyes: 'shut', mouth: 'hurt', fF: [8, 0], fB: [-9, 0] });
  def('hitHigh', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HH, 'snap'], [3, P(HH, { tilt: -15, lean: -13 }), 'out'], [9, P(S, { lean: -6, tilt: -5, hip: [-2, -29], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HL = P(S, { hip: [-3, -27], lean: 28, bend: 8, head: [1, 2], tilt: 15, hF: [8, -30], pen: 80, hB: [2, -34],
    handB: 'fist', eyes: 'shut', mouth: 'open', fF: [7, 0], fB: [-10, 0] });
  def('hitLow', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HL, 'snap'], [3, P(HL, { lean: 24 }), 'out'], [9, P(S, { lean: 12, hip: [-2, -28], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HC = P(C, { hip: [-3, -15], lean: -4, tilt: -15, hF: [8, -20], pen: 70, hB: [-10, -26], handB: 'open', eyes: 'shut', mouth: 'hurt' });
  def('hitCrouch', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HC, 'snap'], [3, P(HC, { lean: 0 }), 'out'], [10, P(C, { eyes: 'shut', mouth: 'hurt' })], [16, P(C, { eyes: 'focus' })]]
  });

  // ---------------------------------------------------------------- launch / down / getup
  var LA = POSE.launch = P(S, { hip: [0, -24], lean: -42, bend: -10, tilt: -35, head: [-1, 0], fF: [7, -8], fB: [0, -2], faF: 40, faB: 30,
    hF: [-4, -52], pen: 230, hB: [-16, -44], handB: 'open', eyes: 'shut', mouth: 'open' });
  def('launch', {
    segs: [['loop', 24, true]], step: 3,
    keys: [
      [0, LA],
      [6, P(LA, { hB: [-20, -36], hF: [-8, -50], fF: [9, -4], fB: [-3, -6], lean: -48, tilt: -40, pen: 250 })],
      [12, P(LA, { hB: [-14, -48], hF: [0, -54], fF: [5, -10], fB: [2, -2], lean: -38, tilt: -30, pen: 215 })],
      [18, P(LA, { hB: [-19, -42], hF: [-5, -48], fF: [8, -6], fB: [-2, -4], lean: -45, pen: 235 })]
    ]
  });
  var DN = POSE.down = P(S, { hip: [-2, -5], lean: -90, bend: 0, tilt: -90, head: [0, 0], fF: [27, -2], fB: [25, -1], faF: -80, faB: -85, knF: -1, knB: -1,
    hF: [-6, -4], pen: 2, z: { pen: -11 }, hB: [-26, -2], handB: 'open', eyes: 'dizzy', mouth: 'hurt' });
  def('down', {
    segs: [['impact', 10], ['lie', 30, true]], step: 2,
    keys: [
      ['impact', P(DN, { root: [0, -3], eyes: 'shut' }), 'snap'],
      ['impact+2', P(DN, { root: [0, -6], hF: [-8, -12], fF: [24, -8], eyes: 'shut' }), 'out'],
      ['impact+5', P(DN, { eyes: 'shut' }), 'in'],
      ['impact+7', P(DN, { root: [0, -1], eyes: 'dizzy' })],
      ['lie', DN], ['lie+15', P(DN, { hip: [-2, -6] })]
    ]
  });
  def('getup', {
    segs: [['rise', 24]], step: 2,
    keys: [
      [0, P(DN, { eyes: 'shut' })],
      [5, P(S, { hip: [-4, -8], lean: -25, tilt: -10, fF: [12, 0], fB: [8, -1], knF: -1, knB: -1, hF: [6, -12], pen: 10, hB: [-12, -3], handB: 'flat', eyes: 'shut', mouth: 'hurt' }), 'out'],
      [11, P(S, { hip: [-2, -14], lean: 25, fF: [9, 0], fB: [-6, -1], faB: 60, hF: [12, -14], pen: 30, hB: [-2, -16], eyes: 'focus', mouth: 'neutral' })],
      [17, P(S, { hip: [0, -26], lean: 10, eyes: 'focus' }), 'out'],
      [23, S]
    ]
  });

  // ---------------------------------------------------------------- throws
  var TH = P(S, { lean: 14, hip: [2, -29], hB: [24, -42], handB: 'open', z: { armB: 6 }, eyes: 'focus', fF: [12, 0], fB: [-7, 0] });
  def('throw', {
    segs: [['startup', 5], ['active', 2], ['recovery', 22]], step: 2,
    keys: [
      ['startup', P(S, { lean: 6, hB: [-2, -36], z: { armB: 6 }, eyes: 'focus' })],
      ['startup+3', TH, 'out'],
      ['active', P(TH, { hB: [26, -42], handB: 'fist' }), 'snap'],
      ['recovery+4', P(TH, { hB: [22, -40], handB: 'open', mouth: 'o' })],
      ['recovery+14', P(S, { eyes: 'focus' })],
      ['recovery+21', S]
    ]
  });
  var TG = P(S, { lean: 12, hip: [2, -29], hB: [19, -44], handB: 'fist', z: { armB: 6 }, eyes: 'focus', mouth: 'neutral', grab: [21, -42], fF: [12, 0] });
  def('throwHit', {
    segs: [['hold', 16], ['toss', 14], ['recovery', 18]], step: 2,
    keys: [
      ['hold', TG],
      ['hold+8', P(TG, { lean: 2, hip: [0, -29], hB: [12, -46], grab: [14, -45], hF: [8, -30], pen: 50 }), 'out'],
      ['hold+14', P(TG, { lean: -4, hip: [-1, -29], hB: [8, -46], grab: [11, -45], hF: [6, -32], pen: 60 })],
      ['toss+2', P(TG, { lean: 22, bend: 4, hip: [4, -27], fF: [15, 0], hB: [30, -42], handB: 'flat', grab: [36, -42], hF: [6, -30], pen: 50,
        mouth: 'shout', smear: { part: 'hB', from: 'hold+14', n: 3 } }), 'snap'],
      ['toss+5', P(TG, { lean: 22, bend: 4, hip: [4, -27], fF: [15, 0], hB: [30, -42], handB: 'flat', grab: [40, -42], hF: [6, -30], pen: 50, mouth: 'shout' }), 'snap'],
      ['toss+12', P(TG, { lean: 18, hip: [3, -28], fF: [15, 0], hB: [27, -40], handB: 'flat', grab: [44, -40], hF: [7, -29], pen: 45 })],
      ['recovery+6', P(S, { lean: 8 })],
      ['recovery+17', S]
    ]
  });
  def('thrown', {
    segs: [['loop', 20, true]], step: 4,
    keys: [
      [0, P(S, { root: [0, -3], hip: [-2, -30], lean: -12, tilt: 15, head: [0, 1], hF: [4, -24], pen: 95, hB: [-6, -25], handB: 'relax', fF: [4, 1], fB: [-3, 0], faF: 40, faB: 50, eyes: 'shut', mouth: 'hurt' })],
      [10, P(S, { root: [0, -3], hip: [-2, -30], lean: -9, tilt: 20, head: [0, 1], hF: [3, -25], pen: 100, hB: [-7, -24], handB: 'relax', fF: [3, 1], fB: [-4, 0], faF: 45, faB: 50, eyes: 'shut', mouth: 'hurt' })]
    ]
  });

  // ---------------------------------------------------------------- intro / win / lose
  var UP = P(S, { hip: [0, -31], lean: 0, fF: [4, 0], fB: [-4, 0], hF: [6, -38], pen: -88, pg: 0.4, hB: [-4, -30], eyes: 'closed', mouth: 'smile' });
  def('intro', {
    segs: [['act', 100]], step: 3,
    keys: [
      [0, UP],
      [16, P(UP, { eyes: 'open' })],
      [26, P(UP, { lean: 30, bend: 6, tilt: 15, hB: [2, -28], hF: [10, -36], pen: -60, eyes: 'closed' }), 'inout'],
      [44, P(UP, { lean: 28, bend: 6, tilt: 15, hB: [2, -28], hF: [10, -36], pen: -60, eyes: 'closed' })],
      [54, P(UP, { eyes: 'open', mouth: 'smile' }), 'out'],
      [62, P(S, { hip: [0, -29], hF: [12, -34], pen: -60, eyes: 'open', mouth: 'smile' }), { ease: 'linear', step: 2 }],
      [72, P(S, { hip: [0, -29], hF: [12, -32], pen: 120, eyes: 'focus' }), { ease: 'linear', step: 2 }],
      [80, P(S, { hip: [0, -29], hF: [11, -28], pen: 300, eyes: 'focus' }), 'out'],
      [90, P(S, { pen: 392, eyes: 'focus', mouth: 'neutral' })],
      [99, P(S, { pen: 392 })]
    ]
  });
  var WN = P(S, { hip: [0, -31], lean: -2, fF: [5, 0], fB: [-5, 0], hF: [4, -40], pen: -80, pg: 0.35, hB: [-2, -44], handB: 'open',
    eyes: 'happy', mouth: 'smile', blush: 1, tilt: 10, z: { armB: 6 } });
  def('win', {
    segs: [['in', 30], ['loop', 60, true]], step: 3,
    keys: [
      ['in', P(S, { eyes: 'closed' })],
      ['in+8', P(S, { hF: [12, -32], pen: 180, eyes: 'closed', mouth: 'smile' }), 'linear'],
      ['in+16', P(WN, { hF: [8, -36], pen: 300 }), 'out'],
      ['in+24', P(WN, { pen: 280 })],
      ['loop', P(WN, { pen: 280 })],
      ['loop+30', P(WN, { pen: 280, hip: [0, -30], tilt: 5, hB: [-2, -43] })]
    ]
  });
  var LS = P(S, { hip: [0, -30], lean: 6, bend: 4, tilt: 25, head: [1, 1], fF: [5, 0], fB: [-5, 0], hF: [7, -27], pen: 80, pg: 0.2, hB: [-4, -28],
    shr: -1, eyes: 'sad', mouth: 'frown' });
  def('lose', {
    segs: [['in', 30], ['loop', 60, true]], step: 3,
    keys: [
      ['in', P(S, { eyes: 'wide', mouth: 'o' })],
      ['in+10', P(LS, { tilt: 10, eyes: 'wide', mouth: 'o' }), 'out'],
      ['in+22', LS],
      ['loop', LS],
      ['loop+30', P(LS, { hip: [0, -29], tilt: 28, eyes: 'closed', sq: 1 })]
    ]
  });
})();
