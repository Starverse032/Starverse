/* LATENT CLASH — RIG: Claude 娘 V2 base motion (stance + all common anims).
 * Personality: composed, upright, economical; the book 「宪章」 rides in the rear hand.
 * Poses are origin-relative (feet line), facing right; see NOTES.md. Body: hip -53 at rest,
 * leg 49 (+4 ankle), arm 18+16, head top -104.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob, G = I.gen;
  var def = function (name, d) { return I.defAnim('claude', name, d); };

  var S = I.CHARS.claude.rest;
  var LEG = 53;
  var POSE = I.POSE_CLAUDE = { stance: S };
  var AIR = { air: true };

  // ---------------------------------------------------------------- idle: breathing + weight shift
  def('idle', {
    segs: [['loop', 64, true]], step: 4,
    keys: [
      [0, S],
      [16, bob(S, 0, 1, { hF: [17, -67], hB: [-5, -48] })],
      [32, P(S, { hip: [1, -53], hF: [18, -68], lean: 3, tilt: 5 })],
      [48, P(S, { sq: -1, shr: 1, hF: [17, -70], tilt: 0 })]
    ]
  });

  // ---------------------------------------------------------------- walk (feet planted at 1.6 / 1.2 px/f)
  var W = P(S, { hF: [16, -67], lean: 4 });
  def('walkF', {
    segs: [['loop', 32, true]], step: 2, walk: 1.6,
    keys: G.walk(W, 1.6, 32, { lift: 6, bob: 1.5, leg: LEG, swingF: 2, swingB: 2 })
  });
  var WB = P(S, { hF: [15, -70], lean: -1, hB: [-6, -50] });
  def('walkB', {
    segs: [['loop', 36, true]], step: 2, walk: -1.2,
    keys: G.walk(WB, -1.2, 36, { lift: 4, bob: 1, leg: LEG, swingF: 1, swingB: 1 })
  });

  // ---------------------------------------------------------------- crouch (top ≈ 70)
  var C = POSE.crouch = P(S, { hip: [-2, -25], lean: 30, bend: 8, head: [1, 1], tilt: 5, hF: [19, -47], hB: [-2, -27], book: -80,
    fF: [13, 0], fB: [-9, 0], faB: 35, knB: -1 });
  def('crouchIn', { segs: [['go', 4]], step: 1, keys: [[0, bob(S, 0, 8, { lean: 12 })], [3, C]] });
  def('crouch', {
    segs: [['loop', 64, true]], step: 4,
    keys: [[0, C], [24, bob(C, 0, 1, { hF: [19, -46] })], [44, P(C, { sq: -1, hF: [19, -48] })]]
  });
  def('crouchOut', { segs: [['go', 4]], step: 1, keys: [[0, C], [3, bob(S, 0, 4, { lean: 6 })]] });

  // ---------------------------------------------------------------- jump
  var SQ = POSE.squat = P(S, { hip: [0, -41], lean: 16, bend: 6, sq: 1, head: [1, 1], hF: [17, -52], hB: [-8, -38], eyes: 'focus' });
  def('jumpSquat', { segs: [['go', 4]], step: 1, keys: [[0, bob(S, 0, 4, { lean: 8 })], [2, SQ, 'snap']] });
  var JR = POSE.jumpRise = P(S, AIR, { hip: [0, -56], lean: 6, fF: [9, -17], fB: [-6, -5], faF: 30, faB: 55, knF: -1,
    hF: [19, -79], hB: [-14, -62], book: -130, handF: 'open', eyes: 'focus' });
  def('jumpRise', { segs: [['loop', 12, true]], step: 3, keys: [[0, JR], [6, P(JR, { hB: [-15, -61], fF: [9, -18] })]] });
  var JF = POSE.jumpFall = P(S, AIR, { hip: [0, -55], lean: 0, fF: [8, -5], fB: [-7, -9], faF: 20, faB: 40,
    hF: [19, -73], hB: [-14, -60], book: -120, handF: 'open', skirt: 1 });
  def('jumpFall', { segs: [['loop', 12, true]], step: 3, keys: [[0, JF], [6, P(JF, { hB: [-14, -61], fB: [-7, -8] })]] });
  def('land', {
    segs: [['go', 6]], step: 1,
    keys: [
      [0, P(S, { hip: [0, -40], lean: 18, bend: 6, sq: 1, head: [1, 1], hF: [17, -50], hB: [-9, -40], eyes: 'focus', skirt: 2 }), 'snap'],
      [2, P(S, { hip: [0, -45], lean: 12, bend: 3, hF: [17, -58], skirt: 1 }), 'out'],
      [4, P(S, { hip: [0, -51], lean: 4 })],
      [5, S]
    ]
  });

  // ---------------------------------------------------------------- dashes
  // gliding step: lean in, skirt and hair streaming, book swung back
  var DF = P(S, { hip: [3, -48], lean: 22, bend: 4, fF: [20, -2], fB: [-20, 0], faB: 35, faF: -10,
    hF: [12, -62], hB: [-16, -52], book: -140, eyes: 'focus', skirt: 2 });
  def('dashF', {
    segs: [['go', 18]], step: 2,
    keys: [
      [0, P(S, { hip: [-1, -49], lean: 14, fB: [-12, 0], hF: [17, -64], eyes: 'focus' }), 'snap'],
      [2, P(DF, { root: [0, -3] }), 'out'],
      [6, P(DF, { root: [0, -3], fB: [-24, -6], faB: 60 })],
      [10, P(DF, { fF: [18, 0], faF: 0, hip: [2, -47] }), 'in'],
      [13, P(S, { hip: [1, -49], lean: 12, hF: [17, -64], skirt: 1 }), 'out'],
      [17, S]
    ]
  });
  var DB = P(S, AIR, { root: [0, -9], hip: [-1, -55], lean: -12, fF: [9, -8], fB: [-8, -4], faF: 30, faB: 20,
    hF: [15, -77], hB: [-15, -58], book: -120, handF: 'open', skirt: 2 });
  def('dashB', {
    segs: [['go', 20]], step: 2,
    keys: [
      [0, P(S, { hip: [0, -48], lean: 10, eyes: 'focus' }), 'snap'],
      [3, DB, 'out'],
      [10, P(DB, { root: [0, -6] })],
      [13, P(S, { hip: [0, -44], lean: 14, sq: 1, skirt: 2 }), 'snap'],
      [15, P(S, { hip: [0, -49], lean: 8, skirt: 1 }), 'out'],
      [19, S]
    ]
  });

  // ---------------------------------------------------------------- guard: the book raised as a shield, lead forearm up
  var GS = POSE.guard = P(S, { hip: [-1, -52], lean: -5, fB: [-10, 0], hF: [14, -82], handF: 'palm', hB: [10, -66], book: -92,
    z: { armB: 6 }, eyes: 'focus', mouth: 'neutral' });
  def('guardStand', { segs: [['loop', 30, true]], step: 3, keys: [[0, GS], [15, bob(GS, 0, 1)]] });
  var GC = POSE.guardCrouch = P(C, { lean: 16, hF: [15, -60], handF: 'palm', hB: [11, -44], book: -92, z: { armB: 6 }, eyes: 'focus' });
  def('guardCrouch', { segs: [['loop', 30, true]], step: 3, keys: [[0, GC], [15, bob(GC, 0, 1)]] });

  // ---------------------------------------------------------------- hits
  var HH = P(S, { hip: [-4, -52], lean: -16, bend: -6, head: [-1, 0], tilt: -20, hF: [9, -72], hB: [-14, -56], handF: 'open',
    fF: [10, 0], fB: [-11, 0], book: -130, eyes: 'shut', mouth: 'hurt', skirt: 1 });
  def('hitHigh', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HH, 'snap'], [3, P(HH, { tilt: -15, lean: -13 }), 'out'], [9, P(S, { lean: -6, tilt: -5, hip: [-2, -52], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HL = P(S, { hip: [-4, -50], lean: 26, bend: 8, head: [1, 2], tilt: 15, hF: [12, -58], hB: [-2, -50], handF: 'open',
    eyes: 'shut', mouth: 'open', fF: [9, 0], fB: [-11, 0] });
  def('hitLow', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HL, 'snap'], [3, P(HL, { lean: 22 }), 'out'], [9, P(S, { lean: 12, hip: [-2, -51], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HC = P(C, { hip: [-4, -24], lean: 8, tilt: -15, hF: [12, -44], hB: [-12, -30], handF: 'open', eyes: 'shut', mouth: 'hurt' });
  def('hitCrouch', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HC, 'snap'], [3, P(HC, { lean: 12 }), 'out'], [10, P(C, { eyes: 'shut', mouth: 'hurt' })], [16, P(C, { eyes: 'focus' })]]
  });

  // ---------------------------------------------------------------- launch / down / getup
  var LA = POSE.launch = P(S, AIR, { hip: [0, -40], lean: -45, bend: -10, tilt: -35, head: [-1, 0], fF: [11, -15], fB: [0, -4], faF: 40, faB: 30,
    hF: [-6, -80], hB: [-24, -62], handF: 'open', book: -170, eyes: 'shut', mouth: 'open', skirt: 2 });
  def('launch', {
    segs: [['loop', 24, true]], step: 3,
    keys: [
      [0, LA],
      [6, P(LA, { hB: [-28, -52], hF: [-12, -76], fF: [14, -7], fB: [-4, -9], lean: -50, tilt: -40 })],
      [12, P(LA, { hB: [-20, -70], hF: [0, -82], fF: [8, -16], fB: [3, -3], lean: -40, tilt: -30 })],
      [18, P(LA, { hB: [-26, -60], hF: [-8, -76], fF: [12, -10], fB: [-3, -6], lean: -47 })]
    ]
  });
  var DN = POSE.down = P(S, AIR, { hip: [-3, -7], lean: -90, bend: 0, tilt: -90, head: [0, 0], fF: [44, -2], fB: [41, -1], faF: -80, faB: -85,
    knF: -1, knB: -1, hF: [-10, -7], hB: [-38, -3], handF: 'open', book: 180, eyes: 'dizzy', mouth: 'hurt', z: { armB: 1 } });
  def('down', {
    segs: [['impact', 10], ['lie', 30, true]], step: 2,
    keys: [
      ['impact', P(DN, { root: [0, -4], eyes: 'shut' }), 'snap'],
      ['impact+2', P(DN, { root: [0, -9], hF: [-12, -18], fF: [40, -12], eyes: 'shut' }), 'out'],
      ['impact+5', P(DN, { eyes: 'shut' }), 'in'],
      ['impact+7', P(DN, { root: [0, -2], eyes: 'dizzy' })],
      ['lie', DN], ['lie+15', P(DN, { hip: [-3, -8] })]
    ]
  });
  def('getup', {
    segs: [['rise', 24]], step: 2,
    keys: [
      [0, P(DN, { eyes: 'shut' })],
      [5, P(S, { hip: [-6, -12], lean: -25, tilt: -10, fF: [18, 0], fB: [12, -1], knF: -1, knB: -1, hF: [8, -18], hB: [-18, -4], handB: 'grip',
        book: 180, eyes: 'shut', mouth: 'hurt' }), 'out'],
      [11, P(S, { hip: [-3, -22], lean: 28, fF: [13, 0], fB: [-9, -1], faB: 60, hF: [18, -24], hB: [-3, -24], book: -60, eyes: 'focus', mouth: 'neutral' })],
      [17, P(S, { hip: [0, -46], lean: 10, eyes: 'focus' }), 'out'],
      [23, S]
    ]
  });

  // ---------------------------------------------------------------- throws: collar grab with the lead hand
  var TH = P(S, { lean: 14, hip: [3, -52], hF: [36, -72], handF: 'open', eyes: 'focus', fF: [16, 0], fB: [-8, 0] });
  def('throw', {
    segs: [['startup', 5], ['active', 2], ['recovery', 22]], step: 2,
    keys: [
      ['startup', P(S, { lean: 6, hF: [12, -70], eyes: 'focus' })],
      ['startup+3', TH, 'out'],
      ['active', P(TH, { hF: [38, -72], handF: 'fist' }), 'snap'],
      ['recovery+4', P(TH, { hF: [34, -70], handF: 'open', mouth: 'o' })],
      ['recovery+14', P(S, { eyes: 'focus' })],
      ['recovery+21', S]
    ]
  });
  var TG = P(S, { lean: 12, hip: [3, -52], hF: [30, -74], handF: 'fist', eyes: 'focus', mouth: 'neutral', grab: [32, -74], fF: [16, 0] });
  def('throwHit', {
    segs: [['hold', 16], ['toss', 14], ['recovery', 18]], step: 2,
    keys: [
      ['hold', TG],
      ['hold+8', P(TG, { lean: 2, hip: [0, -52], hF: [20, -76], grab: [21, -76], hB: [-8, -54] }), 'out'],
      ['hold+14', P(TG, { lean: -6, hip: [-2, -52], hF: [16, -76], grab: [17, -76], hB: [-10, -56], tilt: -5 })],
      ['toss+2', P(TG, { lean: 24, bend: 4, hip: [6, -49], fF: [22, 0], hF: [42, -72], handF: 'palm', grab: [46, -72], hB: [-14, -58],
        mouth: 'shout', skirt: 2, weapon: 'hF', smear: { part: 'hF', from: 'hold+14', n: 3 } }), 'snap'],
      ['toss+5', P(TG, { lean: 24, bend: 4, hip: [6, -49], fF: [22, 0], hF: [42, -72], handF: 'palm', grab: [52, -72], hB: [-14, -58], mouth: 'shout', skirt: 2 }), 'snap'],
      ['toss+12', P(TG, { lean: 18, hip: [5, -50], fF: [22, 0], hF: [38, -71], handF: 'palm', grab: [60, -70], hB: [-12, -56] })],
      ['recovery+6', P(S, { lean: 8 })],
      ['recovery+17', S]
    ]
  });
  def('thrown', {
    segs: [['loop', 20, true]], step: 4,
    keys: [
      [0, P(S, AIR, { root: [0, -4], hip: [-3, -53], lean: -12, tilt: 15, head: [0, 1], hF: [6, -42], hB: [-9, -44], handF: 'relax', fF: [6, 1], fB: [-4, 0], faF: 40, faB: 50, eyes: 'shut', mouth: 'hurt' })],
      [10, P(S, AIR, { root: [0, -4], hip: [-3, -53], lean: -9, tilt: 20, head: [0, 1], hF: [5, -43], hB: [-10, -43], handF: 'relax', fF: [5, 1], fB: [-5, 0], faF: 45, faB: 50, eyes: 'shut', mouth: 'hurt' })]
    ]
  });

  // ---------------------------------------------------------------- intro / win / lose
  // intro: reading the open book, snaps it shut, lowers it and settles into stance
  var RD = P(S, { hip: [0, -54], lean: 0, fF: [5, 0], fB: [-5, 0], hF: [11, -66], hB: [6, -64], handF: 'grip', handB: 'grip', book: 'both',
    tilt: 20, eyes: 'half', mouth: 'neutral', z: { armB: 6 } });
  RD.book = undefined;
  var RDb = P(RD, { book: -100, bko: 1, z: { armB: 6, book: 5.5 } });
  RDb.book = -100; RDb.bookMode = null;
  def('intro', {
    segs: [['act', 100]], step: 3,
    keys: [
      [0, P(RDb, { bkMode: 1 })],
      [30, P(RDb, { tilt: 15 })],
      [42, P(RDb, { bko: 1, tilt: 10, eyes: 'open' }), 'snap'],
      [45, P(RDb, { bko: 0, hF: [9, -66], tilt: 5, eyes: 'open' }), 'out'],
      [54, P(S, { hip: [0, -54], fF: [5, 0], fB: [-5, 0], hF: [10, -62], handF: 'relax', hB: [-4, -52], eyes: 'closed', mouth: 'neutral', tilt: 10 }), 'inout'],
      [66, P(S, { hip: [0, -54], fF: [5, 0], fB: [-5, 0], hF: [10, -62], handF: 'relax', hB: [-4, -52], eyes: 'open', mouth: 'neutral', tilt: 0 })],
      [80, P(S, { eyes: 'focus' }), 'out'],
      [99, S]
    ]
  });
  // win: closes the book to her chest, composed half smile
  var WN = P(S, { hip: [0, -54], lean: -2, fF: [5, 0], fB: [-5, 0], hF: [8, -70], handF: 'flat', hB: [6, -70], book: -95,
    eyes: 'closed', mouth: 'smile', tilt: 8, z: { armB: 6 } });
  def('win', {
    segs: [['in', 30], ['loop', 60, true]], step: 2,
    keys: [
      ['in', P(S, { eyes: 'closed' })],
      ['in+8', P(WN, { hB: [2, -64], tilt: 0, eyes: 'open' }), 'out'],
      ['in+16', P(WN, { eyes: 'closed' }), 'inout'],
      ['loop', WN],
      ['loop+30', P(WN, { hip: [0, -53], tilt: 5, hB: [6, -69] })]
    ]
  });
  var LS = P(S, { hip: [0, -53], lean: 6, bend: 4, tilt: 25, head: [1, 1], fF: [6, 0], fB: [-5, 0], hF: [10, -50], handF: 'relax', hB: [-3, -46], book: -80,
    shr: -1, eyes: 'sad', mouth: 'frown' });
  def('lose', {
    segs: [['in', 30], ['loop', 60, true]], step: 3,
    keys: [
      ['in', P(S, { eyes: 'wide', mouth: 'o' })],
      ['in+10', P(LS, { tilt: 10, eyes: 'wide', mouth: 'o' }), 'out'],
      ['in+22', LS],
      ['loop', LS],
      ['loop+30', P(LS, { hip: [0, -52], tilt: 28, eyes: 'closed', sq: 1 })]
    ]
  });
})();
