/* LATENT CLASH — RIG: Claude 娘 attacks (normals, specials, super).
 * Style: anticipation → 1–2 frame strike with smear → held impact pose for
 * `active` → settle in `recovery`. Pen nib = `weapon` anchor; nib glows on hits.
 * Pen maths: nib ≈ hand + 46·(1-pg)·(cos pen, sin pen)  (pen in degrees, +down).
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob;
  var def = function (name, d) { return I.defAnim('claude', name, d); };
  var S = I.CHARS.claude.rest, C = I.POSE_CLAUDE.crouch, JF = I.POSE_CLAUDE.jumpFall;
  var ATK = { eyes: 'focus', mouth: 'neutral' };
  var HIT = { eyes: 'focus', mouth: 'shout', glow: 1 };

  // ---------------------------------------------------------------- 5L: choked-up quick jab, slightly rising (reach 30)
  var L0 = P(S, ATK, { hF: [5, -32], pen: 2, pg: 0.55, lean: -2, hip: [-1, -30] });
  var L1 = P(S, HIT, { hF: [10, -38], pen: -14, pg: 0.55, lean: 7, hip: [1, -30], mouth: 'neutral' });
  def('5L', {
    segs: [['startup', 5], ['active', 3], ['recovery', 8]], step: 1,
    keys: [
      ['startup', P(S, ATK)], ['startup+2', L0, 'out'], ['startup+4', P(L0, { hF: [4, -32] }), 'snap'],
      ['active', P(L1, { smear: { part: 'pen', from: 'startup+4', n: 3 } }), 'snap'],
      ['active+1', L1, 'snap'],
      ['recovery', P(L1, { glow: 0, hF: [9, -37] }), 'snap'], ['recovery+2', P(L1, { glow: 0, hF: [9, -37] }), 'out'],
      ['recovery+6', P(S, ATK)], ['recovery+7', S]
    ]
  });

  // ---------------------------------------------------------------- 5M: chest-height thrust (reach 46)
  var M0 = P(S, ATK, { hF: [-3, -36], pen: 4, pg: 0.3, lean: -8, bend: -3, hip: [-2, -30], fB: [-10, 0], hB: [-10, -38], handB: 'open' });
  var M1 = P(S, HIT, { hF: [13, -39], pen: 0, pg: 0.3, lean: 12, bend: 3, hip: [2, -29], hB: [-12, -41], handB: 'open', fF: [12, 0] });
  def('5M', {
    segs: [['startup', 8], ['active', 4], ['recovery', 14]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+4', M0, 'out'], ['startup+6', P(M0, { hF: [-4, -36] }), 'snap'],
      ['active', P(M1, { smear: { part: 'pen', from: 'startup+6', n: 3 } }), 'snap'],
      ['active+2', M1, 'snap'],
      ['recovery', P(M1, { glow: 0, mouth: 'neutral' }), 'snap'], ['recovery+3', P(M1, { glow: 0, mouth: 'neutral', hF: [11, -38] }), 'out'],
      ['recovery+10', P(S, ATK, { pen: 24 })], ['recovery+13', S]
    ]
  });

  // ---------------------------------------------------------------- 5H: lunging thrust with a big wind-up (reach 54)
  var H0 = P(S, ATK, { hF: [-8, -41], pen: -12, pg: 0.3, lean: -12, bend: -5, hip: [-3, -31], fF: [8, 0], fB: [-10, 0], hB: [6, -40], handB: 'open', z: { armB: 6 } });
  var H1 = P(S, HIT, { hF: [21, -37], pen: 0, pg: 0.3, lean: 18, bend: 4, hip: [5, -26], fF: [19, 0], fB: [-12, 0], faB: 20,
    hB: [-16, -42], handB: 'open' });
  def('5H', {
    segs: [['startup', 12], ['active', 5], ['recovery', 22]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+5', H0, 'out'], ['startup+10', P(H0, { hF: [-9, -42], lean: -13 }), 'snap'],
      ['active', P(H1, { smear: { part: 'pen', from: 'startup+10', n: 4 } }), 'snap'],
      ['active+2', H1, 'snap'],
      ['recovery', P(H1, { glow: 0 }), 'snap'], ['recovery+6', P(H1, { glow: 0, hip: [4, -27] }), 'out'],
      ['recovery+16', P(S, ATK, { hip: [1, -29] })], ['recovery+21', S]
    ]
  });

  // ---------------------------------------------------------------- crouching normals
  var c0 = P(C, ATK);
  def('2L', {
    segs: [['startup', 5], ['active', 3], ['recovery', 9]], step: 1,
    keys: [
      ['startup', c0], ['startup+2', P(c0, { hF: [9, -18], pen: 18, pg: 0.5 }), 'out'],
      ['active', P(C, HIT, { hF: [16, -17], pen: 14, pg: 0.5, lean: 26, mouth: 'neutral', smear: { part: 'pen', from: 'startup+2', n: 3 } }), 'snap'],
      ['active+1', P(C, HIT, { hF: [16, -17], pen: 14, pg: 0.5, lean: 26, mouth: 'neutral' }), 'snap'],
      ['recovery', P(c0, { hF: [14, -17], pen: 16, pg: 0.5 }), 'out'], ['recovery+8', C]
    ]
  });
  def('2M', {
    segs: [['startup', 8], ['active', 4], ['recovery', 15]], step: 2,
    keys: [
      ['startup', c0], ['startup+5', P(c0, { hF: [4, -20], pen: 10, lean: 14 }), 'out'],
      ['active', P(C, HIT, { hF: [20, -18], pen: 6, lean: 30, hip: [3, -15], fF: [15, 0], smear: { part: 'pen', from: 'startup+5', n: 4 } }), 'snap'],
      ['active+2', P(C, HIT, { hF: [20, -18], pen: 6, lean: 30, hip: [3, -15], fF: [15, 0] }), 'snap'],
      ['recovery', P(c0, { hF: [18, -18], pen: 8, hip: [2, -15] }), 'out'], ['recovery+14', C]
    ]
  });
  def('2H', {   // low sweeping slash along the floor (knockdown)
    segs: [['startup', 11], ['active', 5], ['recovery', 24]], step: 2,
    keys: [
      ['startup', c0], ['startup+6', P(c0, { hF: [-2, -16], pen: 170, lean: 10, hip: [-2, -14] }), 'out'],
      ['startup+9', P(c0, { hF: [6, -14], pen: 75, lean: 24, hip: [0, -12] })],
      ['active', P(C, HIT, { hip: [2, -11], lean: 34, hF: [18, -12], pen: 12, fF: [16, 0], fB: [-12, 0], faB: 50, smear: { part: 'pen', from: 'startup+9', n: 4 } }), 'snap'],
      ['active+2', P(C, HIT, { hip: [2, -11], lean: 34, hF: [18, -12], pen: 12, fF: [16, 0], fB: [-12, 0], faB: 50 }), 'snap'],
      ['recovery', P(C, ATK, { hip: [2, -12], lean: 30, hF: [18, -12], pen: 18, fF: [16, 0], fB: [-12, 0] }), 'out'],
      ['recovery+18', C], ['recovery+23', C]
    ]
  });

  // ---------------------------------------------------------------- jump normals (recovery* loops until landing)
  var j0 = P(JF, ATK);
  def('jL', {
    segs: [['startup', 5], ['active', 6], ['recovery', 12, true]], step: 1,
    keys: [
      ['startup', j0], ['startup+2', P(j0, { hF: [8, -38], pen: 20, pg: 0.5 }), 'out'],
      ['active', P(JF, HIT, { hF: [14, -30], pen: 40, pg: 0.5, mouth: 'neutral', smear: { part: 'pen', from: 'startup+2', n: 3 } }), 'snap'],
      ['active+2', P(JF, HIT, { hF: [14, -30], pen: 40, pg: 0.5, mouth: 'neutral' }), 'snap'],
      ['recovery', P(j0, { hF: [13, -33], pen: 30 })]
    ]
  });
  def('jM', {
    segs: [['startup', 7], ['active', 6], ['recovery', 12, true]], step: 2,
    keys: [
      ['startup', j0], ['startup+4', P(j0, { hF: [0, -44], pen: 200, lean: -6 }), 'out'],
      ['active', P(JF, HIT, { hF: [16, -36], pen: 15, lean: 10, smear: { part: 'pen', from: 'startup+4', n: 5 } }), 'snap'],
      ['active+2', P(JF, HIT, { hF: [16, -36], pen: 15, lean: 10 }), 'snap'],
      ['recovery', P(j0, { hF: [15, -34], pen: 25 })]
    ]
  });
  def('jH', {   // big overhead chop
    segs: [['startup', 10], ['active', 6], ['recovery', 12, true]], step: 2,
    keys: [
      ['startup', j0], ['startup+6', P(j0, { hF: [2, -54], pen: -110, lean: -10, bend: -6, fF: [5, -8], faF: 30 }), 'out'],
      ['active', P(JF, HIT, { hF: [16, -30], pen: 55, lean: 18, bend: 6, fF: [8, -3], smear: { part: 'pen', from: 'startup+6', n: 7 } }), 'snap'],
      ['active+2', P(JF, HIT, { hF: [16, -30], pen: 55, lean: 18, bend: 6, fF: [8, -3] }), 'snap'],
      ['recovery', P(j0, { hF: [15, -30], pen: 50, lean: 12 })]
    ]
  });

  // ---------------------------------------------------------------- spark: writes a star in the air, thrusts it out
  var SP0 = P(S, ATK, { hF: [6, -44], pen: -60, pg: 0.4, lean: -4, hB: [-8, -40], handB: 'open', glow: 1 });
  var SP1 = P(S, ATK, { hF: [10, -40], pen: 40, pg: 0.4, lean: 0, glow: 1 });
  var SP2 = P(S, HIT, { hF: [18, -40], pen: -4, pg: 0.35, lean: 14, hip: [3, -29], fF: [13, 0], hB: [-14, -42], handB: 'open', mouth: 'open' });
  def('spark', {
    segs: [['startup', 13], ['active', 3], ['recovery', 28]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+4', SP0, 'out'], ['startup+8', SP1], ['startup+11', P(SP1, { hF: [6, -42], pen: -20 })],
      ['active', P(SP2, { smear: { part: 'pen', from: 'startup+11', n: 3 } }), 'snap'],
      ['active+1', SP2, 'snap'],
      ['recovery', P(SP2, { glow: 0, mouth: 'neutral' }), 'snap'], ['recovery+10', P(SP2, { glow: 0, mouth: 'neutral', hip: [2, -29] }), 'out'],
      ['recovery+22', P(S, ATK)], ['recovery+27', S]
    ]
  });
  def('airSpark', {
    segs: [['startup', 10], ['active', 3], ['recovery', 12, true]], step: 2,
    keys: [
      ['startup', P(JF, ATK)], ['startup+5', P(JF, ATK, { hF: [4, -46], pen: -70, glow: 1 }), 'out'],
      ['active', P(JF, HIT, { hF: [16, -32], pen: 35, mouth: 'open', smear: { part: 'pen', from: 'startup+5', n: 4 } }), 'snap'],
      ['active+1', P(JF, HIT, { hF: [16, -32], pen: 35, mouth: 'open' }), 'snap'],
      ['recovery', P(JF, ATK, { hF: [14, -33], pen: 30 })]
    ]
  });

  // ---------------------------------------------------------------- sonnet: rising pen uppercut
  var SN1 = P(S, HIT, { hip: [2, -32], lean: -6, bend: -4, tilt: -10, hF: [10, -62], pen: -80, pg: 0.3, hB: [-10, -36], handB: 'open',
    fF: [6, -6], fB: [-4, 0], faF: 30, faB: 50, mouth: 'shout' });
  def('sonnet', {
    segs: [['startup', 5], ['rise', 14], ['fall', 12, true], ['land', 12]], step: 2,
    keys: [
      ['startup', P(C, ATK, { hF: [14, -14], pen: 30 })], ['startup+3', P(C, ATK, { hip: [0, -13], hF: [8, -12], pen: 60, lean: 26 })],
      ['rise', P(SN1, { smear: { part: 'pen', from: 'startup+3', n: 5 } }), 'snap'],
      ['rise+2', SN1, 'snap'], ['rise+8', P(SN1, { glow: 0, fB: [-4, -4], hF: [9, -60] })],
      ['fall', P(JF, ATK, { hF: [12, -40], pen: -40, glow: 0 })], ['fall+6', P(JF, ATK, { hF: [12, -39], pen: -38 })],
      ['land', P(S, { hip: [0, -22], lean: 14, hF: [12, -22], pen: 40, eyes: 'focus' })], ['land+6', P(S, ATK)], ['land+11', S]
    ]
  });

  // ---------------------------------------------------------------- haiku: 5·7·5 three advancing slashes
  var HK1 = P(S, HIT, { hF: [18, -32], pen: 40, lean: 16, hip: [3, -28], fF: [14, 0] });
  var HK2 = P(S, HIT, { hF: [18, -44], pen: -40, lean: 8, hip: [3, -29], fF: [14, 0], fB: [-8, 0] });
  var HK3 = P(S, HIT, { hF: [24, -38], pen: 0, lean: 20, hip: [6, -26], fF: [20, 0], fB: [-11, 0], hB: [-16, -42], handB: 'open' });
  def('haiku', {
    segs: [['startup', 9], ['hit1', 3], ['gap1', 6], ['hit2', 3], ['gap2', 6], ['hit3', 4], ['recovery', 20]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+6', P(S, ATK, { hF: [4, -46], pen: -60, lean: -6, glow: 1 }), 'out'],
      ['hit1', P(HK1, { smear: { part: 'pen', from: 'startup+6', n: 5 } }), 'snap'], ['hit1+2', HK1, 'snap'],
      ['gap1', P(HK1, { glow: 1, mouth: 'neutral', hF: [12, -28], pen: 60 }), 'out'],
      ['hit2', P(HK2, { smear: { part: 'pen', from: 'gap1+0', n: 5 } }), 'snap'], ['hit2+2', HK2, 'snap'],
      ['gap2', P(HK2, { mouth: 'neutral', hF: [8, -46], pen: -60 }), 'out'],
      ['hit3', P(HK3, { smear: { part: 'pen', from: 'gap2+0', n: 4 } }), 'snap'], ['hit3+2', HK3, 'snap'],
      ['recovery', P(HK3, { glow: 0, mouth: 'neutral' }), 'snap'], ['recovery+8', P(HK3, { glow: 0, mouth: 'neutral', hip: [5, -27] }), 'out'],
      ['recovery+16', P(S, ATK)], ['recovery+19', S]
    ]
  });

  // ---------------------------------------------------------------- guardrail counter stance + retaliation
  var GR = P(S, ATK, { hip: [-1, -30], lean: -2, hF: [6, -40], pen: -84, pg: 0.45, hB: [12, -42], handB: 'flat', z: { armB: 6 }, mouth: 'neutral', glow: 1 });
  def('guardrail', {
    segs: [['startup', 3], ['hold', 18], ['recovery', 22]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+2', GR, 'out'],
      ['hold', GR], ['hold+9', bob(GR, 0, 1)],
      ['recovery', P(GR, { glow: 0 }), 'snap'], ['recovery+8', P(GR, { glow: 0, hB: [4, -36] })], ['recovery+18', P(S, ATK)], ['recovery+21', S]
    ]
  });
  var GH = P(S, HIT, { hip: [4, -28], lean: 16, hF: [2, -42], pen: -70, hB: [24, -40], handB: 'flat', z: { armB: 6 }, fF: [14, 0], mouth: 'shout', weapon: 'hB' });
  def('guardrailHit', {
    segs: [['startup', 4], ['active', 4], ['recovery', 22]], step: 1,
    keys: [
      ['startup', P(GR, { hB: [6, -40] })], ['startup+2', P(GR, { hB: [2, -40], lean: -4 }), 'out'],
      ['active', P(GH, { smear: { part: 'hB', from: 'startup+2', n: 3 } }), 'snap'], ['active+2', GH, 'snap'],
      ['recovery', P(GH, { glow: 0, mouth: 'neutral' }), { ease: 'out', step: 2 }], ['recovery+16', P(S, ATK)], ['recovery+21', S]
    ]
  });

  // ---------------------------------------------------------------- super: opens the tome, pen raised, beam
  var SU0 = P(S, ATK, { hip: [0, -28], lean: 4, hF: [8, -58], pen: -88, pg: 0.4, hB: [10, -40], handB: 'open', z: { armB: 6 }, glow: 1, mouth: 'shout' });
  var SU1 = P(S, HIT, { hip: [-2, -29], lean: 2, hF: [18, -44], pen: -6, pg: 0.35, hB: [12, -36], handB: 'open', z: { armB: 6 }, fF: [12, 0], fB: [-12, 0], mouth: 'shout' });
  def('super', {
    segs: [['startup', 6], ['cast', 10], ['active', 40], ['recovery', 30]], step: 2,
    keys: [
      ['startup', P(S, ATK)], ['startup+5', P(SU0, { eyes: 'closed' }), 'out'],
      ['cast', SU0], ['cast+6', P(SU0, { hF: [10, -60] })],
      ['active', P(SU1, { smear: { part: 'pen', from: 'cast+6', n: 5 } }), 'snap'], ['active+3', SU1, 'snap'],
      ['active+20', bob(SU1, -1, 1)], ['active+38', SU1],
      ['recovery', P(SU1, { glow: 0, mouth: 'neutral' }), 'out'], ['recovery+20', P(S, ATK)], ['recovery+29', S]
    ]
  });
})();
