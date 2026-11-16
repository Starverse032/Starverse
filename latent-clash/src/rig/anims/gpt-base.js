/* LATENT CLASH — RIG: GPT 娘 base motion (stance + all common anims).
 * Personality: regal, composed, economical; the tail, wings, sleeves and hair carry the life.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob, G = I.gen;
  // local aliases: wing → book channel (spread), wf → bko (raise deg), blob → bk (companion offset)
  function mapPose(o) {
    if (!o) return o;
    if (o.wing != null) o.book = o.wing;
    if (o.wf != null) o.bko = o.wf;
    if (o.blob) o.bk = o.blob;
    return o;
  }
  var def = I.defGpt = function (name, d) {
    if (d.keys) d.keys.forEach(function (k) { k[1] = mapPose(P(k[1])); });
    return I.defAnim('gpt', name, d);
  };
  var S = I.CHARS.gpt.rest;
  var POSE = I.POSE_GPT = { stance: S };

  // ---------------------------------------------------------------- idle: slow breathing, weight shift, claw flex
  var IN = P(S, { hip: [0, -50], bend: -2, hF: [16, -65], hB: [-2, -56], sq: 1 });
  var WB = P(S, { hip: [-1, -51], lean: -1, hF: [15, -66], hB: [-3, -57], head: [-1, 0], tail: 4 });
  def('idle', {
    segs: [['loop', 64, true]], step: 2,
    keys: [[0, S], [12, P(IN, { wing: 0.08 })], [24, P(S, { hF: [17, -67] })], [34, WB], [46, P(WB, { hip: [-1, -50], sq: 1, wing: 0.1, handF: 'relax' })], [56, P(S, { handF: 'relax' })]]
  });

  // ---------------------------------------------------------------- walks: unhurried, gliding steps (the slit shows the stride)
  function gait(dir, sw, tl) {
    return function (pose, k, ph) {
      var a = k < 4 ? 'F' : 'B', o = a === 'F' ? 'B' : 'F', sg = (a === 'F' ? 1 : -1) * (1 - 2 * ph);
      if (ph === 0) pose['fa' + a] = dir > 0 ? -14 : -6;
      else if (ph === 0.25) pose['fa' + o] = 28;
      else if (ph === 0.5) pose['fa' + o] = 12;
      pose.tw = sw * Math.cos(Math.PI * ph) * (a === 'F' ? 1 : -1) + (dir > 0 ? 2 : -2);
      pose.hem = ph === 0.5 ? -3 : -2;
      pose.tail = (pose.tail || 0) - tl * sg;
      pose.tilt = (pose.tilt || 0) + (ph === 0.5 ? 1 : 0);
      pose.skirt = (pose.skirt || 0) + (ph === 0.5 ? 0.1 : 0.03);
    };
  }
  var WK = P(S, { lean: 3, bend: -3, tilt: -2, hF: [14, -63], hB: [-3, -56], handF: 'relax', skirt: 0.04 });
  def('walkF', { segs: [['loop', 32, true]], step: 2, walk: 1.4, keys: G.walk(WK, 1.4, 32, { lift: 6, bob: 1.5, leg: 52, swingF: 3, swingB: 4, extra: gait(1, 6, 7) }) });
  var WKB = P(S, { lean: -1, bend: -4, tilt: -3, hF: [14, -66], hB: [-2, -58], tail: 6, wing: 0.1 });
  def('walkB', { segs: [['loop', 36, true]], step: 2, walk: -1.1, keys: G.walk(WKB, -1.1, 36, { lift: 5, bob: 1.2, leg: 52, swingF: 2, swingB: 3, extra: gait(-1, 5, 6) }) });

  // ---------------------------------------------------------------- crouch (head top ≈ -68)
  var CR = POSE.crouch = P(S, { hip: [1, -22], lean: 24, bend: 4, tilt: -4, fF: [13, 0], fB: [-11, 0], faB: 28, hF: [30, -44], hB: [16, -38], head: [1, 0],
    handF: 'claw', handB: 'relax', tail: 8, arch: 9, pool: 1, skirt: 0.3, wing: 0.05 });
  def('crouchIn', { segs: [['go', 4]], step: 1, keys: [[0, P(S, { hip: [0, -42], lean: 12 })], [2, P(CR, { hip: [1, -20], sq: 1 }), 'out'], [3, CR]] });
  def('crouch', {
    segs: [['loop', 64, true]], step: 2,
    keys: [[0, CR], [16, bob(CR, 0, 1, { sq: 1 })], [32, CR], [48, bob(CR, 0, 1, { hF: [27, -47], handF: 'relax' })]]
  });
  def('crouchOut', { segs: [['go', 4]], step: 1, keys: [[0, CR], [2, P(S, { hip: [0, -42], lean: 12 }), 'out'], [3, S]] });

  // ---------------------------------------------------------------- jump: wings open on the rise, skirt and sleeves billow on the fall
  var SQ = P(S, { hip: [0, -41], lean: 14, bend: 4, hF: [20, -54], hB: [4, -50], skirt: 0.1, wing: 0.3, wf: 10, eyes: 'focus' });
  def('jumpSquat', { segs: [['go', 4]], step: 1, keys: [[0, bob(S, 0, 3)], [2, SQ]] });
  var JR = POSE.jumpRise = P(S, { hip: [0, -52], lean: 0, bend: -4, tilt: -4, fF: [9, -18], fB: [-5, -8], faF: 35, faB: 50,
    hF: [20, -72], hB: [-10, -66], handF: 'claw', handB: 'open', skirt: 0.45, hem: -6, tail: 14, arch: 6, wing: 0.75, wf: -6, air: true });
  def('jumpRise', { segs: [['loop', 12, true]], step: 3, keys: [[0, JR], [6, P(JR, { hB: [-11, -65], fF: [9, -19], wing: 0.85, wf: -12 })]] });
  var JF = POSE.jumpFall = P(S, { hip: [0, -52], lean: 2, bend: -2, fF: [8, -5], fB: [-7, -11], faF: 20, faB: 40,
    hF: [20, -68], hB: [-12, -64], handF: 'claw', handB: 'open', skirt: 0.7, hem: -9, tail: -6, arch: 7, wing: 0.55, wf: 8, air: true });
  def('jumpFall', { segs: [['loop', 12, true]], step: 3, keys: [[0, JF], [6, P(JF, { hB: [-12, -63], fB: [-7, -10], wing: 0.6, wf: 2 })]] });
  def('land', {
    segs: [['go', 6]], step: 1,
    keys: [[0, P(S, { hip: [0, -40], lean: 16, bend: 4, sq: 1, hF: [21, -52], hB: [5, -48], skirt: 0.35, wing: 0.4, wf: 12 }), 'snap'],
      [2, P(S, { hip: [0, -46], lean: 9, skirt: 0.15, wing: 0.15 }), 'out'], [4, bob(S, 0, -1)], [5, S]]
  });

  // ---------------------------------------------------------------- dashes
  // forward: a low gliding lunge, wings half open, skirt and sleeves streaming back
  var DF = P(S, { hip: [4, -44], lean: 24, bend: 4, tilt: -4, fF: [18, -3], fB: [-18, 0], faF: -8, faB: 45, hF: [27, -60], hB: [-12, -58],
    handF: 'claw', handB: 'open', skirt: -0.15, tw: 10, tail: -8, wing: 0.5, wf: 18, eyes: 'focus' });
  def('dashF', {
    segs: [['go', 20]], step: 2,
    keys: [[0, P(S, { hip: [0, -46], lean: 12, wing: 0.2 })], [2, DF, 'out'],
      [10, P(DF, { fF: [15, 0], faF: 0, fB: [-13, -6], faB: 60, hip: [4, -46], wing: 0.45 })],
      [14, P(S, { hip: [1, -47], lean: 10, eyes: 'focus', wing: 0.2, skirt: 0.15 }), 'inout'], [19, S]]
  });
  // back: wing-assisted hop back, wings beat down, skirt billows
  var DB = P(S, { root: [0, -10], hip: [-2, -52], lean: -8, bend: -4, tilt: -6, fF: [8, -8], fB: [-6, -2], faF: 30, faB: 20,
    hF: [15, -70], hB: [-3, -66], skirt: 0.5, tail: 12, wing: 0.95, wf: -10, air: true });
  def('dashB', {
    segs: [['go', 22]], step: 2,
    keys: [[0, P(S, { hip: [0, -46], lean: 10, wing: 0.3 })], [2, DB, 'out'], [8, P(DB, { root: [0, -9], wing: 0.7, wf: 20 })],
      [14, P(S, { hip: [0, -44], lean: 12, skirt: 0.25, wing: 0.4, wf: 10 }), 'out'], [21, S]]
  });

  // ---------------------------------------------------------------- guards: forearm across the face, wing half-shielding
  var GS = POSE.guard = P(S, { hip: [-2, -50], lean: -3, bend: 5, tilt: 6, hF: [12, -82], hB: [10, -70], handF: 'fist', handB: 'fist',
    eyes: 'focus', mouth: 'neutral', fB: [-11, 0], tail: -6, wing: 0.35, wf: 30 });
  def('guardStand', { segs: [['loop', 30, true]], step: 3, keys: [[0, GS], [15, bob(GS, 0, 1)]] });
  var GC = P(CR, { hF: [24, -60], hB: [21, -52], handF: 'fist', handB: 'fist', eyes: 'focus', mouth: 'neutral', wing: 0.35, wf: 30 });
  def('guardCrouch', { segs: [['loop', 30, true]], step: 3, keys: [[0, GC], [15, bob(GC, 0, 1)]] });

  // ---------------------------------------------------------------- hits
  var HH = P(S, { hip: [-4, -50], lean: -12, bend: -10, tilt: -15, hF: [8, -74], hB: [-12, -70], handF: 'open', handB: 'open',
    eyes: 'shut', mouth: 'hurt', fB: [-11, 0], skirt: 0.2, tail: 12, wing: 0.4, wf: -15 });
  def('hitHigh', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HH, 'snap'], [3, P(HH, { tilt: -10, lean: -9 }), 'out'], [9, P(S, { lean: -1, hip: [-2, -50], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HL = P(S, { hip: [-4, -46], lean: 26, bend: 10, tilt: 10, hF: [12, -52], hB: [2, -50], eyes: 'shut', mouth: 'open', fB: [-11, 0], skirt: 0.15, tail: 18, wing: 0.3 });
  def('hitLow', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HL, 'snap'], [3, P(HL, { lean: 22 }), 'out'], [9, P(S, { lean: 10, hip: [-2, -48], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HC = P(CR, { hip: [-2, -23], lean: 6, bend: -6, tilt: -12, hF: [14, -48], hB: [0, -50], handF: 'open', handB: 'open', eyes: 'shut', mouth: 'hurt', tail: 18, wing: 0.3, wf: -10 });
  def('hitCrouch', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HC, 'snap'], [3, P(HC, { lean: 10 }), 'out'], [10, P(CR, { eyes: 'shut', mouth: 'hurt' })], [16, P(CR, { eyes: 'focus' })]]
  });

  // ---------------------------------------------------------------- launch / down / getup
  var LA = P(S, { hip: [0, -50], lean: -50, bend: -12, tilt: -40, fF: [14, -14], fB: [5, -6], faF: 40, faB: 30,
    hF: [-8, -78], hB: [-24, -66], handF: 'open', handB: 'open', eyes: 'shut', mouth: 'open', skirt: 0.15, tail: -30, arch: 6, air: true, hd: -40, wing: 0.6, wf: 30 });
  var LA2 = function (lean, tilt, hF, hB, fF, fB, sk, tail, pen, wg) {
    return P(LA, { lean: lean, tilt: tilt, hF: hF, hB: hB, fF: fF, fB: fB, skirt: sk, tail: tail, pen: pen, tsw: 2, wing: wg });
  };
  def('launch', {
    segs: [['loop', 24, true]], step: 3,
    keys: [[0, LA2(-50, -40, [-8, -78], [-24, -66], [14, -14], [5, -6], 0.75, -10, 10, 0.7)],
      [6, LA2(-62, -50, [-14, -74], [-30, -56], [18, -6], [0, -12], 0.45, 10, -10, 0.4), 'out'],
      [12, LA2(-44, -32, [-2, -82], [-18, -74], [9, -18], [9, -4], 0.85, -18, 14, 0.8), 'inout'],
      [18, LA2(-58, -46, [-10, -76], [-28, -60], [16, -8], [2, -10], 0.5, 6, -8, 0.45), 'out']]
  });
  var DN = P(S, { hip: [6, -6], lean: -90, bend: 0, tilt: -90, fF: [52, -3], fB: [49, -1], faF: -80, faB: -85, knF: -1, knB: -1,
    hF: [-8, -4], hB: [-32, -2], handF: 'open', handB: 'open', eyes: 'dizzy', mouth: 'hurt', tail: 40, arch: 2, skirt: 0, wing: 0, wf: 40 });
  def('down', {
    segs: [['impact', 10], ['lie', 30, true]], step: 2,
    keys: [['impact', P(DN, { root: [0, -4], eyes: 'shut' }), 'snap'],
      ['impact+2', P(DN, { root: [0, -9], hF: [-10, -16], fF: [46, -12], eyes: 'shut', skirt: 0.4 }), 'out'],
      ['impact+5', P(DN, { eyes: 'shut' }), 'in'], ['impact+7', P(DN, { root: [0, -1] })],
      ['lie', DN], ['lie+15', P(DN, { hip: [6, -7] })]]
  });
  // getup: props up on an elbow, the tail braces on the floor, rises in one smooth push, smooths the skirt
  def('getup', {
    segs: [['rise', 24]], step: 2,
    keys: [[0, P(DN, { eyes: 'shut' })],
      [4, P(S, { hip: [-4, -8], lean: -32, bend: 4, tilt: -10, fF: [22, -2], fB: [14, -1], faF: -30, faB: -30, hF: [-16, -2], hB: [-24, -2],
        handF: 'flat', handB: 'flat', eyes: 'shut', mouth: 'hurt', tail: 40, arch: 2, tsw: 0.3, skirt: 0.2, wing: 0.1, wf: 20 }), 'out'],
      [9, P(S, { hip: [-3, -24], lean: 38, bend: 6, tilt: -5, fF: [2, 0], fB: [-11, 0], faF: 50, faB: 70, hF: [18, -1], hB: [12, -1],
        handF: 'flat', handB: 'flat', eyes: 'focus', mouth: 'neutral', tail: 10, arch: 4, tsw: 0.3, skirt: 0.1, wing: 0.3 }), 'inout'],
      [14, P(S, { hip: [0, -44], lean: 14, bend: 2, tilt: 4, hF: [16, -58], hB: [4, -52], handF: 'relax', eyes: 'half', skirt: 0.3, wing: 0.5, wf: 10, hs: 0.2 }), 'inout'],
      [19, P(S, { hip: [0, -51], lean: -1, tilt: -4, hF: [15, -64], hB: [-6, -52], handB: 'flat', eyes: 'open', wing: 0.15 }), 'out'], [23, S]]
  });
  // ---------------------------------------------------------------- throws
  // whiff: reaches with the open claw and closes on air
  var TH = P(S, { hip: [3, -48], lean: 16, bend: 2, hF: [34, -66], hB: [-8, -62], handF: 'open', handB: 'claw', fF: [16, 0], eyes: 'focus', wing: 0.3, wf: 10 });
  def('throw', {
    segs: [['startup', 5], ['active', 2], ['recovery', 22]], step: 2,
    keys: [['startup', P(S, { lean: 8, hF: [12, -70], eyes: 'focus' })], ['startup+3', TH, 'out'],
      ['active', P(TH, { hF: [35, -66], handF: 'fist' }), 'snap'],
      ['recovery+4', P(TH, { handF: 'fist', eyes: 'half', mouth: 'frown' })], ['recovery+14', P(S, { lean: 8, eyes: 'half' })], ['recovery+21', S]]
  });
  // throwHit: seizes the collar, lifts the victim one-handed at arm's length, then turns and hurls them past her
  // with a wing beat (victim released at the end of `toss`; grab anchor = where the victim's chest goes)
  var TG = P(S, { lean: 12, hip: [3, -49], hF: [30, -68], hB: [-8, -62], handF: 'fist', handB: 'claw', grab: [32, -66], fF: [15, 0],
    eyes: 'focus', mouth: 'neutral', wing: 0.3 });
  var TU = P(TG, { lean: -6, bend: -8, tilt: -12, hip: [-2, -50], fF: [14, 0], fB: [-11, 0], hF: [24, -92], hB: [-12, -66], grab: [25, -94],
    tail: 16, arch: 6, wing: 0.7, wf: -8, skirt: 0.15 });
  var TS = P(TG, { lean: 30, bend: 8, tilt: 10, hip: [7, -42], fF: [21, 0], fB: [-12, 0], faB: 30, hF: [42, -48], hB: [-16, -58], handF: 'open', handB: 'claw',
    grab: [46, -46], mouth: 'teeth', tail: -24, arch: 5, wing: 1, wf: 20, skirt: 0.45 });
  def('throwHit', {
    segs: [['hold', 16], ['toss', 14], ['recovery', 18]], step: 2,
    keys: [['hold', TG],
      ['hold+5', P(TG, { lean: 4, hip: [1, -50], hF: [28, -76], grab: [30, -76], wing: 0.4 }), 'out'],
      ['hold+11', TU, 'inout'], ['hold+15', P(TU, { hF: [22, -94], grab: [23, -96], eyes: 'half' })],
      ['toss+2', P(TS, { hs: 0.6, smear: { part: 'hF', from: 'hold+15', n: 4 } }), 'snap'],
      ['toss+5', P(TS, { hip: [7, -41], sq: 1, wf: 30 }), 'snap'],
      ['toss+10', P(TS, { mouth: 'neutral', eyes: 'half', wing: 0.7, wf: 10 })],
      ['recovery+6', P(S, { lean: 10, hip: [2, -48], mouth: 'neutral', wing: 0.3 }), 'out'], ['recovery+17', S]]
  });
  // thrown: held by the collar, limp — arms and legs dangle, head lolls, wings and tail hang
  var TW = P(S, { root: [0, -4], hip: [-2, -52], lean: -6, bend: 4, tilt: 28, hF: [5, -40], hB: [-5, -39], handF: 'relax', handB: 'relax', elF: 1, elB: 1,
    fF: [3, 0], fB: [-3, -1], faF: 55, faB: 60, eyes: 'dizzy', mouth: 'hurt', tail: -4, arch: 2, tsw: 0.4, skirt: -0.1, wing: 0, wf: 30, bf: 'wide' });
  def('thrown', {
    segs: [['loop', 20, true]], step: 4,
    keys: [[0, TW],
      [6, P(TW, { lean: -2, tilt: 32, hF: [8, -40], hB: [-2, -39], fF: [5, 0], fB: [-1, -1], tail: 2 }), 'inout'],
      [14, P(TW, { lean: -9, tilt: 24, hF: [3, -41], hB: [-7, -40], fF: [1, 0], fB: [-5, -1], tail: -8 }), 'inout']]
  });

  // ---------------------------------------------------------------- intro: descends on spread wings, folds them, a flick of the hair,
  // the blob pops up beside her; a cool glance → stance
  var ST = P(S, { hip: [0, -52], lean: 0, bend: -3, tilt: -4, fF: [5, 0], fB: [-5, 0], hF: [8, -50], hB: [-6, -50], handF: 'relax', handB: 'relax' });
  var HV = P(ST, { root: [0, -14], hip: [0, -52], fF: [5, -2], fB: [-4, -6], faF: 40, faB: 55, hF: [14, -60], hB: [-12, -60], handF: 'open', handB: 'open',
    wing: 1.1, wf: -10, skirt: 0.5, hem: -6, eyes: 'closed', tail: 20, arch: 5, air: true, blob: [-6, 30], bf: 'shut' });
  def('intro', {
    segs: [['act', 100]], step: 2,
    keys: [[0, HV], [8, P(HV, { root: [0, -11], wf: 14 })], [16, P(HV, { root: [0, -8], wf: -12 })], [24, P(HV, { root: [0, -4], wf: 12 })],
      [32, P(ST, { hip: [0, -46], lean: 8, sq: 1, wing: 0.7, wf: 20, skirt: 0.35, eyes: 'closed', blob: [-6, 30], bf: 'shut' }), 'in'],
      [38, P(ST, { wing: 0.3, wf: 10, eyes: 'half', blob: [-4, 22], bf: 'shut' }), 'out'],
      [48, P(ST, { hF: [6, -86], handF: 'open', tilt: -8, eyes: 'closed', wing: 0.1, hd: 14, blob: [0, 6], bf: 'open' }), 'inout'],
      [56, P(ST, { hF: [-4, -88], handF: 'flat', tilt: -10, eyes: 'closed', hd: 26, blob: [0, 0], bf: 'happy' }), 'out'],
      [64, P(ST, { hF: [10, -56], tilt: -6, eyes: 'half', mouth: 'neutral', blob: [0, -2], bf: 'happy' }), 'inout'],
      [76, P(S, { eyes: 'half', tilt: -6, hF: [14, -64], blob: [0, -2], bf: 'open' }), 'inout'],
      [86, P(S, { eyes: 'open', tilt: -2 }), 'out'], [96, S]]
  });
  // ---------------------------------------------------------------- win: wings spread in a slow display, hand to her chest,
  // a small satisfied smile; the blob bounces happily
  var WN = P(ST, { hip: [0, -52], hF: [6, -70], hB: [-10, -56], handF: 'relax', handB: 'relax', tilt: -8, eyes: 'closed', mouth: 'smile',
    wing: 1, wf: -6, tail: 12, arch: 7, skirt: 0.25, bf: 'happy' });
  var wb = function (k) { return P(WN, { wf: k & 1 ? 8 : -10, wing: k & 1 ? 0.92 : 1.05, blob: [0, k & 1 ? -6 : 0], hip: [0, k & 1 ? -51 : -52], tail: k & 1 ? 8 : 16 }); };
  def('win', {
    segs: [['in', 30], ['loop', 60, true]], step: 2,
    keys: [['in', P(S, { eyes: 'closed' })], ['in+8', P(ST, { eyes: 'closed', wing: 0.2, wf: 24, hip: [0, -49], sq: 1 }), 'in'],
      ['in+16', P(WN, { wing: 1.15, wf: -20, skirt: 0.4, hd: 10, blob: [0, -8] }), 'out'], ['in+24', wb(0)],
      ['loop', wb(0)], ['loop+15', wb(1)], ['loop+30', wb(0)], ['loop+45', P(wb(1), { eyes: 'half' })]]
  });
  // ---------------------------------------------------------------- lose (time over): hand to her brow, head bowed, wings drooping,
  // tail flat; the blob floats close and pats her head
  var LS = P(ST, { hip: [0, -50], lean: 6, bend: 6, head: [1, 1], tilt: 18, hF: [14, -84], hB: [-6, -54], handF: 'flat', handB: 'relax', shr: -1,
    eyes: 'sad', mouth: 'frown', wing: 0, wf: 40, tail: -20, arch: 3, tsw: 0.15, skirt: -0.05, blob: [26, -24], bf: 'sad', z: { blob: 6 } });
  def('lose', {
    segs: [['in', 30], ['loop', 60, true]], step: 3,
    keys: [['in', P(S, { eyes: 'wide', mouth: 'o', bf: 'wide' })], ['in+6', P(S, { eyes: 'wide', mouth: 'o', hip: [-1, -51], lean: -4, wing: 0.4, bf: 'wide' }), 'out'],
      ['in+18', P(LS, { tail: -10 }), 'inout'], ['in+26', LS],
      ['loop', LS], ['loop+15', P(LS, { blob: [27, -27] })], ['loop+21', P(LS, { blob: [26, -24] })],
      ['loop+36', P(LS, { hip: [0, -49], sq: 1, eyes: 'closed', tilt: 20, blob: [27, -27] })], ['loop+48', P(LS, { eyes: 'closed', blob: [26, -24] })]]
  });
})();
