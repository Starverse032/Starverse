/* LATENT CLASH — RIG: Claude 娘 V2 attacks (normals, specials, super).
 * Style: precise and economical. Anticipation → 1–2 smear frames → held impact →
 * overshoot → settle. Book strikes (5L spine jab, jM two-handed smash), long kicks that
 * flare the skirt (5M, 2L, 2M), quill-of-light slashes (5H, 2H, jH, haiku, sonnet; the
 * quill is drawn out of the book during start-up and fades in recovery).
 * `weapon` = tip of what strikes (book edge / palm / toe / quill nib). Reach targets
 * (V2.2): 5L 40 5M 60 5H 72 · 2L 42 2M 62 2H 70 · jL 36 jM 46 jH 58.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob;
  var def = function (name, d) { return I.defAnim('claude', name, d); };
  var Q = I.POSE_CLAUDE, S = I.CHARS.claude.rest, C = Q.crouch, JF = Q.jumpFall;
  var ATK = { eyes: 'focus', mouth: 'neutral' };
  var HIT = { eyes: 'focus', mouth: 'teeth', glow: 1 };
  var QON = { quill: true }, QOFF = { quill: false };
  // front hand reaching to the book at the back hip (drawing the quill)
  var DRAW = { hF: [0, -58], handF: 'grip', lean: 4, book: -70 };

  // ---------------------------------------------------------------- 5L: spine jab with the book (rear hand)
  var L0 = P(S, ATK, { hip: [-1, -53], lean: -2, hB: [-4, -70], book: -10, z: { armB: 6 }, hF: [12, -72], handF: 'fist' });
  var L1 = P(S, ATK, { hip: [3, -52], lean: 12, bend: 3, fF: [12, 0], hB: [29, -75], book: 88, z: { armB: 6 }, hF: [8, -70], handF: 'fist', weapon: 'book', glow: 1 });
  def('5L', {
    segs: [['startup', 5], ['active', 3], ['recovery', 8]], step: 1,
    keys: [
      ['startup', P(S, ATK)], ['startup+2', L0, 'out'], ['startup+4', P(L0, { hB: [-5, -70] }), 'snap'],
      ['active', P(L1, { smear: { part: 'book', from: 'startup+4', n: 3 } }), 'snap'],
      ['active+1', L1, 'snap'],
      ['recovery', P(L1, { glow: 0, hB: [25, -74] }), 'snap'], ['recovery+2', P(L1, { glow: 0, hB: [24, -73] }), 'out'],
      ['recovery+6', P(S, ATK, { z: { armB: 6 }, hB: [4, -60] })], ['recovery+7', S]
    ]
  });

  // ---------------------------------------------------------------- 5M: long sweeping side kick (skirt flares)
  var M0 = P(S, ATK, { hip: [-2, -54], lean: -8, fF: [14, -32], faF: 40, knF: -1, hF: [12, -76], hB: [-9, -54], skirt: 2 });
  var M1 = P(S, ATK, { hip: [3, -56], lean: -20, bend: 6, fF: [52, -60], faF: -4, fB: [-6, 0], hF: [-4, -82], handF: 'open', hB: [-15, -60],
    skirt: 4, weapon: 'fF', glow: 1, tilt: -5 });
  def('5M', {
    segs: [['startup', 8], ['active', 4], ['recovery', 14]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+4', M0, 'out'], ['startup+6', P(M0, { fF: [16, -34] }), 'snap'],
      ['active', P(M1, { smear: { part: 'fF', from: 'startup+6', n: 4 } }), 'snap'],
      ['active+2', M1, 'snap'],
      ['recovery', P(M1, { glow: 0, fF: [52, -58] }), 'snap'], ['recovery+4', P(M0, { glow: 0, fF: [20, -30], skirt: 3 }), 'out'],
      ['recovery+10', P(S, ATK, { skirt: 1 })], ['recovery+13', S]
    ]
  });

  // ---------------------------------------------------------------- 5H: quill of light — drawn from the book, big diagonal slash
  var H0 = P(S, ATK, QON, { hip: [-2, -53], lean: -10, bend: -4, hF: [2, -88], pen: -150, pg: 0.15, fF: [12, 0], hB: [-8, -52], tilt: -5 });
  var H1 = P(S, HIT, QON, { hip: [7, -50], lean: 22, bend: 4, fF: [25, 0], fB: [-14, 0], faB: 20, hF: [45, -66], pen: 12, pg: 0.15,
    hB: [-16, -58], skirt: 3 });
  def('5H', {
    segs: [['startup', 12], ['active', 5], ['recovery', 22]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+2', P(S, ATK, DRAW), 'out'],
      ['startup+4', P(S, ATK, QON, { hF: [2, -72], pen: -95, lean: -2 }), 'out'],
      ['startup+8', H0, 'out'], ['startup+10', P(H0, { hF: [0, -88], pen: -155 }), 'snap'],
      ['active', P(H1, { smear: { part: 'quill', from: 'startup+10', n: 5 } }), 'snap'],
      ['active+2', H1, 'snap'],
      ['recovery', P(H1, { glow: 0, mouth: 'neutral' }), 'snap'],
      ['recovery+4', P(H1, { glow: 0, mouth: 'neutral', hF: [38, -56], pen: 42, lean: 18 }), 'out'],
      ['recovery+12', P(S, ATK, QON, { hF: [20, -60], pen: 60, hip: [2, -52] })],
      ['recovery+16', P(S, ATK, QOFF)], ['recovery+21', S]
    ]
  });

  // ---------------------------------------------------------------- crouching normals (all hit low)
  var c0 = P(C, ATK);
  // 2L: quick toe poke sliding out from under the hem
  var CL1 = P(C, ATK, { fF: [34, -1], faF: 4, hip: [-5, -22], lean: 20, hF: [20, -52], weapon: 'fF', glow: 1, skirt: 2 });
  def('2L', {
    segs: [['startup', 5], ['active', 3], ['recovery', 9]], step: 1,
    keys: [
      ['startup', c0], ['startup+2', P(c0, { fF: [18, -4], faF: 10 }), 'out'], ['startup+4', P(c0, { fF: [17, -5], faF: 10 }), 'snap'],
      ['active', P(CL1, { smear: { part: 'fF', from: 'startup+4', n: 3 } }), 'snap'],
      ['active+1', CL1, 'snap'],
      ['recovery', P(CL1, { glow: 0 }), 'snap'], ['recovery+3', P(c0, { fF: [26, -1] }), 'out'], ['recovery+8', C]
    ]
  });
  // 2M: long low sliding kick
  var CM1 = P(C, ATK, { hip: [6, -18], lean: 8, bend: 4, fF: [54, -1], faF: 0, fB: [-24, 0], faB: 80, hF: [24, -46], hB: [-12, -24],
    weapon: 'fF', glow: 1, skirt: 3 });
  def('2M', {
    segs: [['startup', 8], ['active', 4], ['recovery', 15]], step: 2,
    keys: [
      ['startup', c0], ['startup+4', P(c0, { hip: [-5, -20], fF: [16, -6], faF: 20, lean: 30 }), 'out'], ['startup+6', P(c0, { hip: [-5, -20], fF: [15, -7], faF: 20, lean: 30 }), 'snap'],
      ['active', P(CM1, { smear: { part: 'fF', from: 'startup+6', n: 4 } }), 'snap'],
      ['active+2', CM1, 'snap'],
      ['recovery', P(CM1, { glow: 0 }), 'snap'], ['recovery+5', P(c0, { hip: [2, -20], fF: [34, 0] }), 'out'], ['recovery+14', C]
    ]
  });
  // 2H: low quill sweep along the floor (knockdown)
  var CH0 = P(c0, QON, { hF: [6, -64], pen: -135, pg: 0.15, lean: 12, hip: [-4, -22] });
  var CH1 = P(C, HIT, QON, { hip: [8, -18], lean: 42, bend: 6, fF: [27, 0], fB: [-20, 0], faB: 75, hF: [43, -18], pen: 12, pg: 0.15, hB: [-12, -30], skirt: 3 });
  def('2H', {
    segs: [['startup', 11], ['active', 5], ['recovery', 24]], step: 2,
    keys: [
      ['startup', c0], ['startup+2', P(c0, { hF: [-2, -32], handF: 'grip' }), 'out'],
      ['startup+4', P(c0, QON, { hF: [2, -48], pen: -100 }), 'out'],
      ['startup+7', CH0, 'out'], ['startup+9', P(CH0, { hF: [4, -66], pen: -140 }), 'snap'],
      ['active', P(CH1, { smear: { part: 'quill', from: 'startup+9', n: 5 } }), 'snap'],
      ['active+2', CH1, 'snap'],
      ['recovery', P(CH1, { glow: 0, mouth: 'neutral' }), 'snap'],
      ['recovery+6', P(CH1, { glow: 0, mouth: 'neutral', hF: [40, -12], pen: 20, hip: [6, -18] }), 'out'],
      ['recovery+16', P(c0, QON, { hF: [22, -40], pen: 50 })], ['recovery+19', P(c0, QOFF)], ['recovery+23', C]
    ]
  });

  // ---------------------------------------------------------------- jump normals (down-forward; recovery* loops until landing)
  var j0 = P(JF, ATK);
  var JL1 = P(JF, ATK, { hF: [32, -60], handF: 'palm', lean: 12, bend: 3, fF: [8, -10], weapon: 'hF', glow: 1 });
  def('jL', {
    segs: [['startup', 5], ['active', 6], ['recovery', 12, true]], step: 1,
    keys: [
      ['startup', j0], ['startup+2', P(j0, { hF: [10, -74], handF: 'palm', lean: -2 }), 'out'], ['startup+4', P(j0, { hF: [9, -75], handF: 'palm', lean: -3 }), 'snap'],
      ['active', P(JL1, { smear: { part: 'hF', from: 'startup+4', n: 3 } }), 'snap'],
      ['active+1', JL1, 'snap'], ['active+4', P(JL1, { glow: 0 })],
      ['recovery', P(j0, { hF: [24, -66], handF: 'open' })]
    ]
  });
  // jM: two-handed overhead book smash
  var JM0 = P(j0, { bm: 'both', hF: [6, -98], hB: [1, -96], handF: 'grip', handB: 'grip', book: -60, z: { armB: 4.7 }, lean: -12, bend: -4, fF: [6, -12] });
  var JM1 = P(JF, ATK, { bm: 'both', hF: [40, -64], hB: [36, -66], handF: 'grip', handB: 'grip', book: 20, z: { armB: 4.7 }, lean: 20, bend: 6,
    fF: [10, -6], weapon: 'book', glow: 1, mouth: 'teeth' });
  def('jM', {
    segs: [['startup', 7], ['active', 6], ['recovery', 12, true]], step: 2,
    keys: [
      ['startup', P(j0, { bm: 'both', hF: [10, -78], hB: [6, -76], handF: 'grip', handB: 'grip', book: -90, z: { armB: 4.7 } })],
      ['startup+3', JM0, 'out'], ['startup+5', P(JM0, { hF: [4, -99], hB: [0, -97], book: -70 }), 'snap'],
      ['active', P(JM1, { smear: { part: 'book', from: 'startup+5', n: 4 } }), 'snap'],
      ['active+2', JM1, 'snap'], ['active+5', P(JM1, { glow: 0, hF: [36, -62], hB: [32, -64] })],
      ['recovery', P(j0, { bm: 'both', hF: [24, -66], hB: [20, -68], handF: 'grip', handB: 'grip', book: 0, z: { armB: 4.7 } })]
    ]
  });
  // jH: quill overhead slash, down-forward
  var JH0 = P(j0, QON, { hF: [2, -98], pen: -130, pg: 0.15, lean: -10, bend: -6, fF: [6, -14], faF: 30 });
  var JH1 = P(JF, HIT, QON, { hF: [35, -62], pen: 32, pg: 0.15, lean: 18, bend: 6, fF: [9, -6] });
  def('jH', {
    segs: [['startup', 10], ['active', 6], ['recovery', 12, true]], step: 2,
    keys: [
      ['startup', j0], ['startup+2', P(j0, { hF: [2, -62], handF: 'grip', book: -60 }), 'out'],
      ['startup+4', P(j0, QON, { hF: [4, -80], pen: -90 }), 'out'],
      ['startup+6', JH0, 'out'], ['startup+8', P(JH0, { hF: [1, -99], pen: -135 }), 'snap'],
      ['active', P(JH1, { smear: { part: 'quill', from: 'startup+8', n: 5 } }), 'snap'],
      ['active+2', JH1, 'snap'], ['active+5', P(JH1, { glow: 0, hF: [32, -58], pen: 44 })],
      ['recovery', P(j0, QON, { hF: [24, -62], pen: 55 })], ['recovery+8', P(j0, QOFF)]
    ]
  });

  // ---------------------------------------------------------------- spark: the book floats open beside her, open-palm cast
  var FL = { bm: 'float', bk: [-15, -84], book: -90, bko: 1, glow: 1 };
  var SP0 = P(S, ATK, FL, { hF: [6, -72], handF: 'open', lean: -6, bend: -3, hip: [-2, -53], fB: [-9, 0], hB: [-10, -66], handB: 'open' });
  var SP2 = P(S, HIT, FL, { hF: [36, -75], handF: 'palm', lean: 14, bend: 3, hip: [4, -52], fF: [14, 0], hB: [-14, -64], handB: 'open', mouth: 'neutral' });
  def('spark', {
    segs: [['startup', 13], ['active', 3], ['recovery', 28]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+3', P(S, ATK, { hB: [-8, -68], book: -95 }), 'out'],
      ['startup+5', P(SP0, { bk: [-12, -76], bko: 0.3 }), 'out'], ['startup+9', SP0, 'out'], ['startup+11', P(SP0, { hF: [4, -72], lean: -8 }), 'snap'],
      ['active', P(SP2, { smear: { part: 'hF', from: 'startup+11', n: 3 } }), 'snap'],
      ['active+1', SP2, 'snap'],
      ['recovery', P(SP2, { glow: 0 }), 'snap'], ['recovery+10', P(SP2, { glow: 0, hip: [3, -52], hF: [33, -73], bk: [-14, -82] }), 'out'],
      ['recovery+18', P(S, ATK, { bm: 'float', bk: [-11, -64], book: -100, bko: 0, hB: [-9, -58] })],
      ['recovery+22', P(S, ATK)], ['recovery+27', S]
    ]
  });
  def('airSpark', {
    segs: [['startup', 10], ['active', 3], ['recovery', 12, true]], step: 2,
    keys: [
      ['startup', P(JF, ATK)], ['startup+4', P(JF, ATK, FL, { bk: [-14, -96], hF: [6, -82], handF: 'open', lean: -8, hB: [-12, -74], handB: 'open' }), 'out'],
      ['startup+8', P(JF, ATK, FL, { bk: [-16, -98], hF: [4, -84], handF: 'open', lean: -10, hB: [-12, -76], handB: 'open' }), 'snap'],
      ['active', P(JF, HIT, FL, { bk: [-16, -98], hF: [31, -58], handF: 'palm', lean: 16, bend: 4, hB: [-14, -74], handB: 'open', mouth: 'neutral',
        smear: { part: 'hF', from: 'startup+8', n: 3 } }), 'snap'],
      ['active+1', P(JF, HIT, FL, { bk: [-16, -98], hF: [31, -58], handF: 'palm', lean: 16, bend: 4, hB: [-14, -74], handB: 'open', mouth: 'neutral' }), 'snap'],
      ['recovery', P(JF, ATK, { bm: 'float', bk: [-14, -86], book: -100, bko: 0.2, hF: [26, -62], handF: 'open', hB: [-12, -70] })],
      ['recovery+8', P(JF, ATK)]
    ]
  });

  // ---------------------------------------------------------------- sonnet: rising quill uppercut (anti-air)
  var SN1 = P(S, HIT, QON, { air: true, hip: [3, -58], lean: -6, bend: -4, tilt: -10, hF: [16, -106], pen: -78, pg: 0.15, hB: [-12, -64],
    fF: [8, -14], fB: [-4, 0], faF: 30, faB: 50, mouth: 'shout', skirt: 4 });
  def('sonnet', {
    segs: [['startup', 5], ['rise', 14], ['fall', 12, true], ['land', 12]], step: 2,
    keys: [
      ['startup', P(C, ATK, { hF: [4, -40], handF: 'grip' })], ['startup+3', P(C, ATK, QON, { hip: [0, -22], hF: [30, -34], pen: 30, lean: 30 })],
      ['rise', P(SN1, { smear: { part: 'quill', from: 'startup+3', n: 5 } }), 'snap'],
      ['rise+2', SN1, 'snap'], ['rise+8', P(SN1, { glow: 0, fB: [-4, -6], hF: [14, -104] })],
      ['fall', P(JF, ATK, QON, { hF: [18, -80], pen: -40 })], ['fall+6', P(JF, ATK, QOFF, { hF: [18, -76] })],
      ['land', P(S, { hip: [0, -41], lean: 16, hF: [17, -52], eyes: 'focus', skirt: 2 })], ['land+6', P(S, ATK)], ['land+11', S]
    ]
  });

  // ---------------------------------------------------------------- haiku: 5·7·5 — three advancing quill slashes
  var HK1 = P(S, HIT, QON, { hF: [36, -60], pen: 40, pg: 0.15, lean: 18, hip: [5, -50], fF: [20, 0], fB: [-10, 0], skirt: 2 });
  var HK2 = P(S, HIT, QON, { hF: [34, -84], pen: -42, pg: 0.15, lean: 6, hip: [5, -52], fF: [20, 0], fB: [-10, 0], skirt: 2 });
  var HK3 = P(S, HIT, QON, { hF: [44, -70], pen: 2, pg: 0.15, lean: 22, bend: 4, hip: [9, -49], fF: [28, 0], fB: [-14, 0], faB: 20, hB: [-18, -60], skirt: 4, mouth: 'shout' });
  def('haiku', {
    segs: [['startup', 9], ['hit1', 3], ['gap1', 6], ['hit2', 3], ['gap2', 6], ['hit3', 4], ['recovery', 20]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+2', P(S, ATK, DRAW), 'out'],
      ['startup+5', P(S, ATK, QON, { hF: [8, -92], pen: -120, lean: -6 }), 'out'], ['startup+7', P(S, ATK, QON, { hF: [6, -93], pen: -125, lean: -7 }), 'snap'],
      ['hit1', P(HK1, { smear: { part: 'quill', from: 'startup+7', n: 5 } }), 'snap'], ['hit1+2', HK1, 'snap'],
      ['gap1', P(HK1, { mouth: 'neutral', hF: [22, -46], pen: 120 }), 'out'], ['gap1+4', P(HK1, { mouth: 'neutral', hF: [18, -44], pen: 135 }), 'snap'],
      ['hit2', P(HK2, { smear: { part: 'quill', from: 'gap1+4', n: 5 } }), 'snap'], ['hit2+2', HK2, 'snap'],
      ['gap2', P(HK2, { mouth: 'neutral', hF: [8, -94], pen: -150, lean: -4 }), 'out'], ['gap2+4', P(HK2, { mouth: 'neutral', hF: [6, -95], pen: -155, lean: -6 }), 'snap'],
      ['hit3', P(HK3, { smear: { part: 'quill', from: 'gap2+4', n: 5 } }), 'snap'], ['hit3+2', HK3, 'snap'],
      ['recovery', P(HK3, { glow: 0, mouth: 'neutral' }), 'snap'], ['recovery+8', P(HK3, { glow: 0, mouth: 'neutral', hip: [6, -50], hF: [38, -62], pen: 30 }), 'out'],
      ['recovery+14', P(S, ATK, QON, { hF: [20, -60], pen: 60 })], ['recovery+16', P(S, ATK, QOFF)], ['recovery+19', S]
    ]
  });

  // ---------------------------------------------------------------- guardrail: the open book held out as the barrier's focus
  var GR = P(S, ATK, { hip: [-1, -52], lean: -3, fF: [12, 0], fB: [-10, 0], hF: [10, -78], handF: 'palm', hB: [22, -70], book: -90, bko: 0.6,
    z: { armB: 6 }, eyes: 'closed', mouth: 'neutral', glow: 1, muzAt: 'book' });
  def('guardrail', {
    segs: [['startup', 3], ['hold', 18], ['recovery', 22]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+2', GR, 'out'],
      ['hold', GR], ['hold+9', bob(GR, 0, 1)],
      ['recovery', P(GR, { glow: 0, eyes: 'open' }), 'snap'], ['recovery+8', P(GR, { glow: 0, bko: 0, hB: [6, -64], eyes: 'open' })], ['recovery+18', P(S, ATK)], ['recovery+21', S]
    ]
  });
  var GH = P(S, HIT, { hip: [5, -51], lean: 16, fF: [16, 0], hF: [40, -73], handF: 'palm', hB: [14, -66], book: -90, bko: 0.6, z: { armB: 4.7 },
    mouth: 'shout', weapon: 'hF', skirt: 2 });
  def('guardrailHit', {
    segs: [['startup', 4], ['active', 4], ['recovery', 22]], step: 1,
    keys: [
      ['startup', P(GR, { eyes: 'focus' })], ['startup+2', P(GR, { hF: [4, -72], handF: 'open', lean: -6, eyes: 'focus' }), 'out'],
      ['active', P(GH, { smear: { part: 'hF', from: 'startup+2', n: 3 } }), 'snap'], ['active+2', GH, 'snap'],
      ['recovery', P(GH, { glow: 0, mouth: 'neutral' }), { ease: 'out', step: 2 }], ['recovery+12', P(S, ATK, { z: { armB: 6 }, hB: [6, -64] }), { step: 2 }],
      ['recovery+21', S]
    ]
  });

  // ---------------------------------------------------------------- super: opens the book wide in both hands (muzzle = book centre)
  var SU0 = P(S, ATK, { bm: 'both', hip: [0, -54], lean: -4, hF: [12, -86], hB: [8, -88], handF: 'grip', handB: 'grip', book: -90, bko: 0,
    z: { armB: 4.7 }, glow: 1, eyes: 'closed', mouth: 'neutral', muzAt: 'book', tilt: -5 });
  var SU1 = P(S, HIT, { bm: 'both', hip: [-2, -52], lean: 6, fF: [13, 0], fB: [-12, 0], hF: [24, -74], hB: [16, -76], handF: 'grip', handB: 'grip',
    book: -90, bko: 1, z: { armB: 4.7 }, mouth: 'shout', muzAt: 'book', skirt: 2 });
  def('super', {
    segs: [['startup', 6], ['cast', 10], ['active', 40], ['recovery', 30]], step: 2,
    keys: [
      ['startup', P(S, ATK, { muzAt: 'book' })], ['startup+3', P(SU0, { hF: [10, -74], hB: [4, -76], eyes: 'focus' }), 'out'], ['startup+5', SU0, 'snap'],
      ['cast', SU0], ['cast+4', P(SU0, { hF: [16, -82], hB: [10, -84], eyes: 'focus', bko: 0.3 }), 'out'],
      ['cast+7', P(SU1, { hF: [22, -76], hB: [14, -78], bko: 0.8 }), 'snap'],
      ['active', SU1, 'snap'], ['active+20', bob(SU1, 0, 1)], ['active+38', SU1],
      ['recovery', P(SU1, { glow: 0, mouth: 'neutral' }), 'snap'], ['recovery+8', P(SU1, { glow: 0, mouth: 'neutral', bko: 0, hF: [16, -70], hB: [10, -70] }), 'out'],
      ['recovery+20', P(S, ATK, { z: { armB: 6 }, hB: [4, -60] })], ['recovery+29', S]
    ]
  });
})();
