/* LATENT CLASH — RIG: Gemini 娘 base motion (stance + all common anims + airJump).
 * Personality: mischievous, light on her toes, cat-like; the tail never stops, the hair, sleeves, coat panels
 * and skirt follow through.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var P = I.P, bob = I.bob, G = I.gen;
  // local aliases: coat → book (panel flare), cl → bko (panel lift), st → bk (lead star offset)
  function mapPose(o) {
    if (!o) return o;
    if (o.coat != null) o.book = o.coat;
    if (o.cl != null) o.bko = o.cl;
    if (o.st) o.bk = o.st;
    return o;
  }
  var def = I.defGem = function (name, d) {
    if (d.keys) d.keys.forEach(function (k) { k[1] = mapPose(P(k[1])); });
    return I.defAnim('gemini', name, d);
  };
  var S = I.CHARS.gemini.rest;
  var POSE = I.POSE_GEM = { stance: S };
  // rotate a pose about its hip (flips, rolls)
  var spin = I.gemSpin = function (pose, deg) {
    var o = P(pose), c = o.hip || S.hip, r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    ['hF', 'hB', 'fF', 'fB'].forEach(function (k) {
      var v = o[k] || S[k], dx = v[0] - c[0], dy = v[1] - c[1];
      o[k] = [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs];
    });
    o.lean = (o.lean || 0) + deg; o.tilt = (o.tilt || 0) + deg;
    o.faF = (o.faF || 0) + deg; o.faB = (o.faB || 0) + deg; o.tail = (o.tail == null ? 0 : o.tail) + deg * 0.6;
    return o;
  };

  // ---------------------------------------------------------------- idle: light bounce on her toes, paw flex,
  // a cheeky head tilt halfway through; tail and hair keep moving on their own
  var DN = function (b, ch) { return bob(b, 0, 2, P({ sq: 1, faB: 20, hF: [b.hF[0], b.hF[1] + 3], hB: [b.hB[0], b.hB[1] + 3] }, ch)); };
  def('idle', {
    segs: [['loop', 64, true]], step: 2,
    keys: [[0, S], [8, DN(S, { tail: 6 }), 'inout'], [16, P(S, { hF: [15, -65] })], [24, DN(S, { tail: -4, handF: 'claw' }), 'inout'],
      [32, P(S, { tilt: -8, head: [0, 0], hF: [16, -65], handF: 'claw', eyes: 'sly', mouth: 'cat', hd: -4 })],
      [40, DN(S, { tilt: -8, eyes: 'sly', mouth: 'cat', tail: 8 }), 'inout'], [48, P(S, { tilt: -4 })], [56, DN(S, { tail: -2 }), 'inout']]
  });

  // ---------------------------------------------------------------- walks: light, bouncy cat steps on the balls of her feet
  // custom 16-key cycle (one stride per half loop): heel-off push, high knee, toe-pointed swing, soft landing
  function catWalk(base, v, loop, o) {
    var L = Math.abs(v) * loop / 2, half = loop / 2, keys = [], x0 = v >= 0 ? L / 2 : -L / 2, n = 16;
    for (var k = 0; k < n; k++) {
      var t = k * loop / n, step = k < n / 2 ? 0 : 1, ph = (k % (n / 2)) / (n / 2), tau = ph * half;
      var plant = x0 - v * tau;
      var sw = -x0 + 2 * x0 * (ph < 0.15 ? ph * 0.5 : (ph > 0.85 ? 1 - (1 - ph) * 0.5 : ph * 1.1 - 0.05));
      var swy = -o.lift * Math.pow(Math.sin(Math.PI * ph), 0.8);
      var spread = Math.max(Math.abs(plant), Math.abs(sw)) + 1.5;
      var hy = Math.max(G.reachY(o.leg * 0.985, spread), base.hip[1]) - o.bob * Math.sin(Math.PI * ph) + o.dip * (ph < 0.2 ? 1 : 0);
      var a = step === 0 ? 'F' : 'B', b = a === 'F' ? 'B' : 'F';
      var pose = I.P(base, { hip: [o.hipX || 0, hy], plant: a });
      pose['f' + a] = [plant, 0];
      pose['f' + b] = [sw, swy];
      pose['fa' + a] = ph > 0.7 ? (v > 0 ? 10 : 6) : 0;              // heel rises late in the stance
      pose['fa' + b] = ph < 0.3 ? 40 : (ph < 0.75 ? 26 : 6);        // toe points while swinging
      var sg = (a === 'F' ? 1 : -1) * Math.cos(Math.PI * ph);       // +1 when F leads
      var dy = hy - base.hip[1];
      pose.hF = [base.hF[0] - o.swingF * sg, base.hF[1] + dy];
      pose.hB = [base.hB[0] + o.swingB * sg, base.hB[1] + dy];
      if (o.extra) o.extra(pose, k, ph, sg);
      keys.push([t, pose, 'linear']);
    }
    return keys;
  }
  G.catWalk = catWalk;
  var WK = P(S, { lean: 5, bend: -3, tilt: -3, hF: [14, -63], hB: [2, -60], handF: 'paw', handB: 'paw' });
  def('walkF', {
    segs: [['loop', 32, true]], step: 2, walk: 1.8,
    keys: catWalk(WK, 1.8, 32, { lift: 7, bob: 1.5, dip: 1, leg: 51, swingF: 3, swingB: 4, extra: function (p, k, ph, sg) {
      p.tail = 6 - 10 * sg; p.tw = 5 * sg; p.coat = 0.12; p.skirt = 0.06; p.tilt = -3 + (ph === 0.5 ? -1 : 0); p.hd = -2;
    } })
  });
  var WKB = P(S, { lean: -1, bend: -4, tilt: -4, hF: [15, -65], hB: [3, -61], eyes: 'sly', mouth: 'cat' });
  def('walkB', {
    segs: [['loop', 32, true]], step: 2, walk: -1.5,
    keys: catWalk(WKB, -1.5, 32, { lift: 6, bob: 1.2, dip: 1, leg: 51, swingF: 2, swingB: 3, extra: function (p, k, ph, sg) {
      p.tail = 10 - 8 * sg; p.tw = -4 * sg; p.coat = 0.05; p.skirt = 0.04;
    } })
  });

  // ---------------------------------------------------------------- crouch: low pounce-crouch, lead paw near the floor, tail up
  var CR = POSE.crouch = P(S, { hip: [2, -23], lean: 30, bend: 4, tilt: -16, fF: [14, 0], fB: [-11, 0], faF: 0, faB: 34, knF: -1, knB: -1,
    hF: [26, -28], hB: [14, -32], handF: 'paw', handB: 'paw', head: [1, 0], tail: 24, arch: 8, coat: 0.25, skirt: 0.25 });
  def('crouchIn', { segs: [['go', 4]], step: 1, keys: [[0, P(S, { hip: [0, -42], lean: 14, faB: 20 })], [2, P(CR, { hip: [2, -21], sq: 1 }), 'out'], [3, CR]] });
  def('crouch', {
    segs: [['loop', 64, true]], step: 2,
    keys: [[0, CR], [16, bob(CR, 0, 1, { sq: 1, tail: 30 })], [32, P(CR, { hF: [27, -27], handF: 'claw' })],
      [40, P(CR, { hF: [27, -28], handF: 'claw', tail: 18 })], [48, bob(CR, 0, 1, { sq: 1, tail: 28, hip: [1, -22] })]]
  });
  def('crouchOut', { segs: [['go', 4]], step: 1, keys: [[0, CR], [2, P(S, { hip: [0, -42], lean: 14, faB: 20 }), 'out'], [3, S]] });

  // ---------------------------------------------------------------- jump: knees tucked on the rise, legs reach on the fall
  var SQ = P(S, { hip: [0, -40], lean: 20, bend: 6, tilt: -10, faB: 30, hF: [20, -50], hB: [8, -48], skirt: 0.15, coat: 0.2, tail: 20, eyes: 'focus' });
  def('jumpSquat', { segs: [['go', 4]], step: 1, keys: [[0, bob(S, 0, 3)], [2, SQ]] });
  var JR = POSE.jumpRise = P(S, { hip: [0, -52], lean: 4, bend: -6, tilt: -8, fF: [8, -20], fB: [-4, -12], faF: 40, faB: 55, knF: -1, knB: -1,
    hF: [20, -76], hB: [-8, -70], handF: 'paw', handB: 'open', skirt: 0.45, hem: -4, tail: 26, arch: 7, coat: 0.5, cl: 10, air: true, hd: -6 });
  def('jumpRise', { segs: [['loop', 12, true]], step: 3, keys: [[0, JR], [6, P(JR, { hB: [-9, -69], fF: [8, -21], tail: 30 })]] });
  var JF = POSE.jumpFall = P(S, { hip: [0, -52], lean: 2, bend: -2, tilt: -2, fF: [10, -4], fB: [-8, -10], faF: 22, faB: 40,
    hF: [22, -70], hB: [-12, -64], handF: 'paw', handB: 'open', skirt: 0.75, hem: -7, tail: -10, arch: 8, coat: 0.7, cl: -6, air: true, hd: 6 });
  def('jumpFall', { segs: [['loop', 12, true]], step: 3, keys: [[0, JF], [6, P(JF, { hB: [-12, -63], fB: [-8, -9], tail: -6 })]] });
  // airJump: a quick forward tuck flip that kicks off the second jump
  var TK = P(JR, { hip: [0, -50], lean: 26, bend: 14, tilt: 20, fF: [6, -30], fB: [0, -27], faF: 70, faB: 70, hF: [14, -50], hB: [8, -52],
    handF: 'fist', handB: 'fist', eyes: 'shut', mouth: 'cat', skirt: 0.6, hem: -5, tail: 40, arch: 3, coat: 0.6 });
  def('airJump', {
    segs: [['go', 6]], step: 1,
    keys: [[0, TK, 'linear'], [1, spin(TK, 90), 'linear'], [2, spin(TK, 180), 'linear'], [3, spin(TK, 270), 'linear'],
      [4, P(spin(P(TK, { fF: [8, -24], fB: [-2, -18] }), 340), { eyes: 'focus', hs: 0.3 }), 'out'], [5, P(JR, { tilt: -12, hs: 0.3 })]]
  });
  def('land', {
    segs: [['go', 6]], step: 1,
    keys: [[0, P(S, { hip: [0, -38], lean: 22, bend: 6, sq: 1, faB: 30, hF: [22, -46], hB: [10, -44], skirt: 0.45, coat: 0.5, cl: 10, tail: 26 }), 'snap'],
      [2, P(S, { hip: [0, -45], lean: 12, skirt: 0.2, coat: 0.25, tail: 14 }), 'out'], [4, bob(S, 0, -1)], [5, S]]
  });

  // ---------------------------------------------------------------- dashes
  // forward: pounce — gathers low, then a long stretched leap, both paws reaching, legs and tail streaming back
  var DF = P(S, { root: [0, -6], hip: [4, -46], lean: 52, bend: 0, tilt: -36, fF: [-12, -14], fB: [-22, -10], faF: 70, faB: 80, knF: -1, knB: -1,
    hF: [34, -50], hB: [28, -46], handF: 'claw', handB: 'claw', skirt: 0.3, hem: -4, tw: 10, tail: -36, arch: 4, coat: 0.9, cl: 20,
    eyes: 'focus', mouth: 'cat', air: true, hd: 20 });
  def('dashF', {
    segs: [['go', 16]], step: 2,
    keys: [[0, P(CR, { hip: [2, -30], lean: 34, tilt: -24, fF: [10, 0], hF: [26, -34], hB: [18, -36], eyes: 'focus' })], [2, DF, 'out'],
      [6, P(DF, { root: [0, -7], fF: [-8, -16], hF: [36, -50] })],
      [9, P(DF, { root: [0, -3], hip: [4, -45], lean: 34, tilt: -20, fF: [16, -2], faF: 0, fB: [-16, -12], faB: 60, hF: [30, -46], hB: [20, -44] }), 'in'],
      [11, P(S, { hip: [2, -40], lean: 22, bend: 4, sq: 1, fF: [14, 0], hF: [24, -48], hB: [12, -46], tail: -6, coat: 0.5, skirt: 0.3, eyes: 'focus' }), 'snap'],
      [13, P(S, { hip: [1, -46], lean: 10, coat: 0.2, eyes: 'focus' }), 'out'], [15, S]]
  });
  // back: a springy hop back, knees tucked, tail up for balance
  var DB = P(S, { root: [0, -12], hip: [-2, -52], lean: -12, bend: -4, tilt: -10, fF: [8, -12], fB: [-4, -6], faF: 40, faB: 30,
    hF: [18, -72], hB: [-8, -66], handF: 'paw', handB: 'open', skirt: 0.45, hem: -4, tail: 36, arch: 6, coat: 0.6, cl: -10, air: true, eyes: 'sly', mouth: 'cat' });
  def('dashB', {
    segs: [['go', 18]], step: 2,
    keys: [[0, P(S, { hip: [0, -43], lean: 12, faB: 24, sq: 1 })], [2, DB, 'out'], [8, P(DB, { root: [0, -10], fF: [9, -8], tail: 30 })],
      [12, P(DB, { root: [0, -3], fF: [10, -2], fB: [-6, -2], hip: [-1, -50] }), 'in'],
      [14, P(S, { hip: [0, -41], lean: 14, sq: 1, faB: 30, skirt: 0.3, coat: 0.4, tail: 18 }), 'snap'], [17, S]]
  });

  // ---------------------------------------------------------------- guards: both big sleeves crossed in front, chin tucked
  var GS = POSE.guard = P(S, { hip: [-2, -49], lean: -4, bend: 6, tilt: 10, hF: [12, -80], hB: [14, -70], handF: 'fist', handB: 'fist', elF: 1, elB: 1,
    eyes: 'shut', mouth: 'frown', fB: [-11, 0], faB: 10, tail: -10, arch: 7, coat: 0.15, ears: 'flat' });
  def('guardStand', { segs: [['loop', 30, true]], step: 3, keys: [[0, GS], [15, bob(GS, 0, 1, { tail: -4 })]] });
  var GC = P(CR, { lean: 20, tilt: 4, hF: [22, -58], hB: [24, -50], handF: 'fist', handB: 'fist', eyes: 'shut', mouth: 'frown', tail: 10, ears: 'flat' });
  def('guardCrouch', { segs: [['loop', 30, true]], step: 3, keys: [[0, GC], [15, bob(GC, 0, 1, { tail: 14 })]] });

  // ---------------------------------------------------------------- hits
  var HH = P(S, { hip: [-4, -50], lean: -14, bend: -10, tilt: -20, hF: [6, -72], hB: [-12, -68], handF: 'open', handB: 'open',
    eyes: 'shut', mouth: 'hurt', fB: [-12, 0], faB: 0, skirt: 0.25, coat: 0.4, tail: 30, arch: 6, hd: 16, ears: 'flat' });
  def('hitHigh', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HH, 'snap'], [3, P(HH, { tilt: -14, lean: -10 }), 'out'], [9, P(S, { lean: -2, hip: [-2, -50], eyes: 'shut', mouth: 'hurt', tail: 12 })], [16, P(S, { eyes: 'focus' })]]
  });
  var HL = P(S, { hip: [-4, -46], lean: 28, bend: 12, tilt: 14, hF: [12, -50], hB: [2, -48], handF: 'open', handB: 'paw', eyes: 'shut', mouth: 'open',
    fB: [-12, 0], skirt: 0.2, coat: 0.3, tail: 34, hd: -10, ears: 'flat' });
  def('hitLow', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HL, 'snap'], [3, P(HL, { lean: 24 }), 'out'], [9, P(S, { lean: 10, hip: [-2, -48], eyes: 'shut', mouth: 'hurt' })], [16, P(S, { eyes: 'focus' })]]
  });
  var HC = P(CR, { hip: [-2, -24], lean: 8, bend: -8, tilt: -18, hF: [14, -46], hB: [2, -48], handF: 'open', handB: 'open', eyes: 'shut', mouth: 'hurt', tail: 36, ears: 'flat' });
  def('hitCrouch', {
    segs: [['reel', 18]], step: 2,
    keys: [[0, HC, 'snap'], [3, P(HC, { lean: 12 }), 'out'], [10, P(CR, { eyes: 'shut', mouth: 'hurt' })], [16, P(CR, { eyes: 'focus' })]]
  });

  // ---------------------------------------------------------------- launch / down / getup
  var LA = P(S, { hip: [0, -50], lean: -50, bend: -12, tilt: -40, fF: [14, -14], fB: [5, -6], faF: 40, faB: 30,
    hF: [-8, -76], hB: [-24, -64], handF: 'open', handB: 'open', eyes: 'shut', mouth: 'open', skirt: 0.5, hem: -5, tail: 50, arch: 5, coat: 0.8, cl: 20, air: true, hd: -40, ears: 'flat' });
  var LA2 = function (lean, tilt, hF, hB, fF, fB, sk, tail, pen, cp) {
    return P(LA, { lean: lean, tilt: tilt, hF: hF, hB: hB, fF: fF, fB: fB, skirt: sk, tail: tail, pen: pen, tsw: 2, coat: cp });
  };
  def('launch', {
    segs: [['loop', 24, true]], step: 3,
    keys: [[0, LA2(-50, -40, [-8, -76], [-24, -64], [14, -14], [5, -6], 0.75, 55, 10, 0.8)],
      [6, LA2(-62, -50, [-14, -72], [-30, -54], [18, -6], [0, -12], 0.45, 70, -10, 0.5), 'out'],
      [12, LA2(-44, -32, [-2, -80], [-18, -72], [9, -18], [9, -4], 0.85, 45, 14, 0.9), 'inout'],
      [18, LA2(-58, -46, [-10, -74], [-28, -58], [16, -8], [2, -10], 0.5, 64, -8, 0.55), 'out']]
  });
  var DW = P(S, { hip: [6, -6], lean: -90, bend: 0, tilt: -90, fF: [50, -3], fB: [46, -1], faF: -80, faB: -85, knF: -1, knB: -1,
    hF: [-6, -4], hB: [-30, -2], handF: 'open', handB: 'open', eyes: 'dizzy', mouth: 'hurt', tail: 30, arch: 3, skirt: 0, coat: 0.3, cl: -40, ears: 'flat' });
  def('down', {
    segs: [['impact', 10], ['lie', 30, true]], step: 2,
    keys: [['impact', P(DW, { root: [0, -4], eyes: 'shut' }), 'snap'],
      ['impact+2', P(DW, { root: [0, -9], hF: [-8, -16], fF: [44, -14], eyes: 'shut', skirt: 0.4 }), 'out'],
      ['impact+5', P(DW, { eyes: 'shut' }), 'in'], ['impact+7', P(DW, { root: [0, -1] })],
      ['lie', DW], ['lie+15', P(DW, { hip: [6, -7], tail: 40 })]]
  });
  // getup: rolls onto her side, up onto all fours like a cat, a little stretch, springs back into stance
  def('getup', {
    segs: [['rise', 24]], step: 2,
    keys: [[0, P(DW, { eyes: 'shut' })],
      [4, P(S, { hip: [-2, -10], lean: -30, bend: 6, tilt: -16, fF: [24, -2], fB: [16, -1], faF: -30, faB: -30, hF: [-14, -2], hB: [-22, -2],
        handF: 'flat', handB: 'flat', eyes: 'shut', mouth: 'hurt', tail: 40, arch: 3, tsw: 0.4, skirt: 0.2, coat: 0.3, ears: 'flat' }), 'out'],
      [9, P(S, { hip: [-4, -22], lean: 62, bend: 8, tilt: -30, fF: [4, 0], fB: [-10, 0], faF: 40, faB: 60, hF: [22, -1], hB: [16, -1],
        handF: 'flat', handB: 'flat', eyes: 'focus', mouth: 'cat', tail: 30, arch: 7, skirt: 0.25, coat: 0.3 }), 'inout'],
      [14, P(S, { hip: [-1, -38], lean: 24, bend: 4, tilt: -6, fF: [10, 0], fB: [-10, 0], faB: 30, hF: [22, -44], hB: [10, -42], eyes: 'half', mouth: 'cat', skirt: 0.3, coat: 0.4, hs: 0.2 }), 'inout'],
      [19, P(S, { hip: [0, -51], lean: -1, tilt: -6, hF: [16, -66], hB: [2, -60], eyes: 'open', tail: 10 }), 'out'], [23, S]]
  });
})();
