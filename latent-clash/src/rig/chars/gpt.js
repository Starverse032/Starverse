/* LATENT CLASH — RIG: GPT 娘 (102 px, white-haired dragon girl) body, chains, renderer.
 *
 * Materials (15 shared slots, re-purposed locally): legs = `scale` (horns, tail, wing bones),
 * shoe = `wing` (wing membrane), white = `blob` (the blue companion), c1 = white gown, sleeves,
 * heels; c2 = silver-grey lining; acc = teal magic; glow/smear = teal-white.
 *
 * GPT-only pose fields (all optional):
 *   tail (deg, swings the whole tail; + = clockwise on screen), arch (curl, 10 = rest shape),
 *   pen (extra whip on the outer half, deg/link), tl (1 = tail locked to the pose curve: strikes),
 *   tsw (tail sway scale), wing (0 folded .. 1 fully spread; stored in the `book` channel),
 *   wf (wing raise, deg; `bko` channel), blob ([dx, dy] offset of the companion; `bk` channel),
 *   bf (blob face: open happy shut sad wide x), claw ('F'|'B'|'FB' teal glow on the claws),
 *   flip (1 = this drawing faces left — spins; author as if facing right), weapon
 *   ('hF'|'hB'|'fF'|'fB'|'kF'|'tail'), muzAt ('mouth' → muzzle = mouth), skirt (flare),
 *   hem (px, - = lifted), tw (hem swing), drape {F,B}, pool, hs (settle hair), z: {tail, armF,
 *   armB, legF, legB, hair, wing, blob, slvF}.
 * Use the local def() in the anim files: it maps wing/wf/blob onto the numeric channels.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col, SH = I.SH, H = I.H;
  var fr = H.fr, lerp = H.lerp, rot = H.rot;
  var MS = M.legs, MW = M.shoe, MB = M.white;     // scale, wing membrane, blob
  var D2R = Math.PI / 180;

  function R0(p) { return [Math.round(p[0]), Math.round(p[1])]; }
  function ln(p, a, b, c, on) { p.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c, on); }
  function dl(p, a, b, st) { p.darkLine(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), st || 1); }

  var C = {
    id: 'gpt', height: 102, crouchHeight: 68, width: 28,
    body: {
      spine: 30, waist: 10, neck: 4, upper: 16, fore: 14, thigh: 26, shin: 24, ankle: 3,
      shF: [2, 1], shB: [-3, 1], hipF: [3, 1], hipB: [-3, 1]
    },
    // imperious stance: upright, chin level, lead hand loose and clawed at chest height, rear hand low
    rest: {
      root: [0, 0], hip: [0, -51], lean: 1, bend: -3, head: [0, 0], tilt: 0,
      hF: [16, -66], hB: [-2, -57], fF: [9, 0], fB: [-8, 0], faF: 0, faB: 0,
      pen: 0, sq: 0, shr: 0, haF: 0, haB: 0, pg: 0, skirt: 0, tail: 0, arch: 10,
      book: 0, bko: 0, bk: [0, 0], tw: 0, hem: 0,
      eyes: 'open', mouth: 'neutral', handF: 'claw', handB: 'relax',
      elF: 1, elB: 1, knF: -1, knB: -1, blush: 0, z: {}
    },
    sigJoints: ['pel', 'waist', 'chest', 'neck', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB',
      'hipF', 'knF', 'anF', 'ftF', 'hipB', 'knB', 'anB', 'ftB'],
    ramps: function (pal) {
      var r = [];
      r[M.skin] = pal.skin; r[M.hair] = pal.hair;
      r[M.tip] = [pal.hairTip[0], pal.hairTip[1], pal.hair[2], pal.hair[3]];
      r[M.eye] = pal.eye; r[M.c1] = pal.cloth1; r[M.c2] = pal.cloth2; r[M.acc] = pal.accent; r[M.metal] = pal.metal;
      r[M.blush] = [pal.blush, pal.blush, pal.skin[2], pal.skin[3]];
      r[MS] = pal.scale || pal.hair; r[MW] = pal.wing || pal.cloth2; r[MB] = pal.blob || pal.accent;
      r[M.ink] = [pal.eye[3], pal.skin[3], pal.outline, pal.outline];
      r[M.glow] = ['#ffffff', pal.accent[0], pal.accent[1], pal.accent[2]];
      r[M.smear] = ['#ffffff', pal.accent[0], pal.accent[1], pal.accent[2]];
      return r;
    }
  };

  // ------------------------------------------------------------------ skirt contour limits (legs push the hem)
  function angOf(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax) / D2R; }
  function clampLink(ch, i, tx, ty, front) {
    var px = ch.x[i - 1], py = ch.y[i - 1], L = Array.isArray(ch.def.len) ? ch.def.len[i - 1] : ch.def.len;
    var a = angOf(px, py, ch.x[i], ch.y[i]), b = angOf(px, py, tx, ty);
    if (front ? a > b : a < b) { ch.x[i] = px + Math.cos(b * D2R) * L; ch.y[i] = py + Math.sin(b * D2R) * L; }
  }
  function raised(d, s) {
    var h = s === 'F' ? d.hipF : d.hipB, k = s === 'F' ? d.knF : d.knB;
    var r = (h[1] + 21 - k[1]) / 10, f = d.ds && d.ds.drape;
    var across = (s === 'F' ? h[0] - k[0] : k[0] - h[0]);
    if (across > 2) r *= Math.max(0, 1 - (across - 2) / 4);
    if (f && f[s] != null && f[s] > r) r = f[s];
    return r < 0 ? 0 : (r > 1 ? 1 : r);
  }
  function limF(ch, i, sk) {
    var d = sk && (sk.d || sk); if (!d || !d.knF) return;
    if (raised(d, 'F') > 0.5) return;
    if (i === 1) clampLink(ch, 1, d.knF[0] + 4, d.knF[1], true);
    else { clampLink(ch, 2, d.anF[0] + 5, d.anF[1] + 2, true); clampLink(ch, 2, d.knF[0] + 4, d.knF[1] + 6, true); }
  }
  function limB(ch, i, sk) {
    var d = sk && (sk.d || sk); if (!d || !d.knB) return;
    if (raised(d, 'B') > 0.5) return;
    if (i === 1) clampLink(ch, 1, d.knB[0] - 4, d.knB[1], false);
    else { clampLink(ch, 2, d.anB[0] - 5, d.anB[1] + 2, false); clampLink(ch, 2, d.knB[0] - 4, d.knB[1] + 6, false); }
  }
  function drape(d, s, c0, c1, c2) {
    var r = raised(d, s);
    if (r <= 0) return [c1, c2];
    var h = s === 'F' ? d.hipF : d.hipB, k = s === 'F' ? d.knF : d.knB, dx = k[0] - h[0], dy = k[1] - h[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = dy / l, ny = -dx / l;
    if (ny > 0) { nx = -nx; ny = -ny; }
    var pl = (d.ds && d.ds.pool) || 0, fT = 0.6 + 0.52 * pl, nT = 3.5 + 1.5 * pl;
    var T = [h[0] + dx * fT + nx * nT, h[1] + dy * fT + ny * nT];
    var used = Math.sqrt((T[0] - c0[0]) * (T[0] - c0[0]) + (T[1] - c0[1]) * (T[1] - c0[1]));
    var hang = Math.max(5, 48 - used), sg = s === 'F' ? 1 : -1;
    var B = [T[0] + sg * (3 + 3 * pl), pl ? 0 : Math.min(0, T[1] + hang)];
    return [lerp(c1, T, r), lerp(c2, B, r)];
  }

  // ------------------------------------------------------------------ chains
  var TAIL_N = 10, TAIL_LEN = [8, 8, 8, 7, 7, 7, 6, 6, 5, 5];
  // rest shape of the tail (deg added per link at arch 10): drops behind her, runs back along the floor, tip curls up
  var TAIL_PROF = [0, 6, 14, 26, 44, 66, 86, 106, 130, 158];
  var TAIL_R = [5.6, 5.4, 5.1, 4.7, 4.3, 3.8, 3.3, 2.8, 2.2, 1.6, 0.9];
  C.chains = [
    { id: 'tail', n: TAIL_N, len: TAIL_LEN, rest: [92, 98, 106, 118, 136, 158, 178, 198, 222, 250], stiff: 0.5, damp: 0.74, grav: 0.03, drag: 0.2, hys: 0.6 },
    { id: 'hairA', n: 6, len: [10, 10, 10, 10, 9, 9], rest: [104, 96, 92, 90, 89, 88], stiff: [0.36, 0.3, 0.24, 0.2, 0.16, 0.14], damp: 0.84, grav: 0.24, drag: 0.3, cvel: 0.6 },
    { id: 'hairB', n: 5, len: [10, 10, 10, 9, 8], rest: [98, 93, 90, 88, 86], stiff: [0.38, 0.3, 0.24, 0.2, 0.16], damp: 0.83, grav: 0.24, drag: 0.3, cvel: 0.6 },
    { id: 'lockN', n: 4, len: [7, 8, 8, 7], rest: [84, 88, 91, 93], stiff: 0.32, damp: 0.8, grav: 0.22, drag: 0.25, cvel: 0.5 },
    { id: 'lockF', n: 3, len: [6, 6, 6], rest: [86, 90, 93], stiff: 0.34, damp: 0.8, grav: 0.22, drag: 0.25, cvel: 0.5 },
    { id: 'ahoge', n: 3, len: [4, 4, 3], rest: [-100, -45, 15], stiff: 0.5, damp: 0.72, grav: 0.03, drag: 0.12 },
    { id: 'sFa', n: 3, len: [10, 10, 10], rest: [100, 96, 93], stiff: [0.3, 0.24, 0.2], damp: 0.85, grav: 0.24, drag: 0.42, cvel: 0.5 },
    { id: 'sFe', n: 3, len: [10, 10, 10], rest: [78, 83, 87], stiff: [0.3, 0.24, 0.2], damp: 0.85, grav: 0.24, drag: 0.42, cvel: 0.5 },
    { id: 'sBa', n: 3, len: [10, 10, 10], rest: [100, 96, 93], stiff: [0.3, 0.24, 0.2], damp: 0.85, grav: 0.24, drag: 0.42, cvel: 0.5 },
    { id: 'sBe', n: 3, len: [10, 10, 10], rest: [78, 83, 87], stiff: [0.3, 0.24, 0.2], damp: 0.85, grav: 0.24, drag: 0.42, cvel: 0.5 },
    { id: 'hemF', n: 2, len: [26, 26], rest: [80, 86], stiff: [0.4, 0.34], damp: 0.8, grav: 0.2, drag: 0.32, limit: limF },
    { id: 'hemB', n: 2, len: [26, 26], rest: [104, 97], stiff: [0.4, 0.34], damp: 0.8, grav: 0.2, drag: 0.32, limit: limB },
    { id: 'tas', n: 2, len: [5, 5], rest: [90, 90], stiff: 0.25, damp: 0.8, grav: 0.25, drag: 0.3 },
    { id: 'wing', n: 1, len: [6], rest: [-90], stiff: 0.3, damp: 0.8, grav: 0, drag: 0.3, slack: 1, hys: 0.6 },
    { id: 'blob', n: 1, len: [14], rest: [-90], stiff: 0.1, damp: 0.86, grav: 0, drag: 0.22, slack: 1, hys: 0.65 }
  ];
  function own(ch) {
    if (!ch._own) { ch.def = Object.assign({}, ch.def, { rest: ch.def.rest.slice() }); ch._own = true; }
    return ch;
  }

  // ------------------------------------------------------------------ pose-only geometry (anchors use it)
  var PV = [19, 26];
  function headPt(d, x, y) { return R0(fr(d.neck, d.headAng, x - PV[0], y - PV[1])); }
  function tailRoot(d) { return fr(d.pel, d.lean, -6, 2); }
  var TA = new Float64Array(TAIL_N);
  function tailAngles(d, out) {
    var a0 = 92 + d.tail + d.lean * 0.5, k = d.arch / 10, whip = d.pen;
    for (var i = 0; i < TAIL_N; i++) out[i] = a0 + TAIL_PROF[i] * k + (i >= 5 ? whip * (i - 4) : 0);
    return out;
  }
  function tailCurve(d) {
    var p = tailRoot(d), pts = [p];
    tailAngles(d, TA);
    for (var i = 0; i < TAIL_N; i++) { p = [p[0] + Math.cos(TA[i] * D2R) * TAIL_LEN[i], p[1] + Math.sin(TA[i] * D2R) * TAIL_LEN[i]]; pts.push(p); }
    return pts;
  }
  // wings: half-folded (spread 0) → fully spread (1); frame angle = raise + lean
  var WF = { w: [-15, -9], t: [[-17, 9], [-13, 22], [-2, 27]] };          // half-folded: points out and down behind the hips
  var WS = { w: [-17, -30], t: [[-36, -10], [-34, 12], [-16, 30]] };      // spread: huge, up and back
  function wingGeo(d, far) {
    var s = Math.max(0, Math.min(1.15, d.book || 0)), ang = (d.bko || 0) + d.lean * 0.6 + (far ? -14 : 0);
    var root = fr(d.waist, d.lean, far ? -2 : -4, far ? 0 : 3);
    var sc = far ? 0.86 : 1;
    function at(o, base) { var v = rot(o[0] * sc, o[1] * sc, ang); return [base[0] + v[0], base[1] + v[1]]; }
    var w = at(lerp(WF.w, WS.w, s), root), tips = [];
    for (var k = 0; k < 3; k++) tips.push(at(lerp(WF.t[k], WS.t[k], s), w));
    return { root: root, w: w, tips: tips, s: s };
  }
  function blobTarget(d) {
    var b = d.bk || [0, 0];
    return [Math.round(d.neck[0] - 29 + b[0]), Math.round(d.neck[1] - 8 + b[1])];
  }

  // ------------------------------------------------------------------ flip (spins)
  var JK = ['pel', 'waist', 'chest', 'neck', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB',
    'hipF', 'knF', 'anF', 'ftF', 'hipB', 'knB', 'anB', 'ftB', 'bk'];
  function mir(sk, v) { return sk.flip ? [-v[0], v[1]] : v; }

  C.sigExtra = function (sk, s, n) {
    s[n++] = Math.round(sk.hemS != null ? sk.hemS : (sk.hem || 0)); s[n++] = Math.round(sk.tw || 0);
    s[n++] = Math.round((sk.book || 0) * 20); s[n++] = Math.round(sk.bko || 0);
    return n;
  };

  C.post = function (sk) {
    sk.headAng = Math.round(sk.headAng / 5) * 5;
    sk.headAng = ((sk.headAng + 180) % 360 + 360) % 360 - 180;
    sk.flip = !!(sk.ds && sk.ds.flip);
    if (sk.flip) {
      var o = { flip: false, ds: sk.ds, lean: sk.lean, chestAng: sk.chestAng, headAng: sk.headAng, handAngF: sk.handAngF, handAngB: sk.handAngB,
        faF: sk.faF, faB: sk.faB, tail: sk.tail, arch: sk.arch, pen: sk.pen, skirt: sk.skirt, book: sk.book, bko: sk.bko, tw: sk.tw, hem: sk.hem };
      for (var i = 0; i < JK.length; i++) { var k = JK[i]; o[k] = sk[k]; sk[k] = [-sk[k][0], sk[k][1]]; }
      sk.d = o;
    } else sk.d = sk;
  };

  // ------------------------------------------------------------------ anchors
  C.headCenter = function (sk) { return mir(sk, headPt(sk.d, 20, 19)); };
  C.headTop = function (sk) { return mir(sk, headPt(sk.d, 11, 4)); };     // horn tips (the head itself tops out 8 px lower)
  C.footPoint = function (sk, s) {
    var d = sk.d, f = s === 'F' ? d.ftF : d.ftB, a = s === 'F' ? d.faF : d.faB;
    return mir(sk, R0(fr(f, a, 3, -1)));
  };
  function mouthPt(d) { return headPt(d, 25, 24); }
  C.defaultMuzzle = function (sk) {
    var ds = sk.ds || {};
    if (ds.muzAt === 'mouth') return mir(sk, mouthPt(sk.d));
    return mir(sk, tipOf(sk, 'hF'));
  };
  function tipOf(sk, w) {
    var d = sk.d;
    switch (w) {
      case 'fF': case 'fB': {
        var f = w === 'fF' ? d.ftF : d.ftB, a = w === 'fF' ? d.faF : d.faB;
        return R0(fr(f, a, 8, -0.5));
      }
      case 'kF': case 'kB': {
        var k = w === 'kF' ? d.knF : d.knB, h = w === 'kF' ? d.hipF : d.hipB, dx = k[0] - h[0], dy = k[1] - h[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
        return R0([k[0] + dx / l * 4, k[1] + dy / l * 4]);
      }
      case 'tail': { var c = tailCurve(d); return R0(c[c.length - 1]); }
      case 'hB': case 'hF': default: {
        var hh = w === 'hB' ? d.haB : d.haF, ang = w === 'hB' ? d.handAngB : d.handAngF, v = rot(6, 0, ang);
        return R0([hh[0] + v[0], hh[1] + v[1]]);
      }
    }
  }
  C.weaponPoint = function (sk) { return mir(sk, tipOf(sk, (sk.ds && sk.ds.weapon) || 'hF')); };
  C.extraAnchor = function (sk, name) {
    if (name === 'blob') return mir(sk, blobTarget(sk.d));
    if (name === 'tail') return mir(sk, tipOf(sk, 'tail'));
    if (name === 'mouth') return mir(sk, mouthPt(sk.d));
    if (name === 'wingL') { var g = wingGeo(sk.d, false); return mir(sk, R0(g.tips[0])); }
    return null;
  };
  C.partPoints = function (sk, part) {
    var d = sk.d || sk;
    switch (part) {
      case 'hF': { var a = tipOf(sk, 'hF'); return [d.elF[0], d.elF[1], a[0], a[1]]; }
      case 'hB': { var b = tipOf(sk, 'hB'); return [d.elB[0], d.elB[1], b[0], b[1]]; }
      case 'fF': { var t = tipOf(sk, 'fF'); return [d.knF[0], d.knF[1], t[0], t[1]]; }
      case 'fB': { var t2 = tipOf(sk, 'fB'); return [d.knB[0], d.knB[1], t2[0], t2[1]]; }
      case 'kF': return [d.hipF[0], d.hipF[1], d.knF[0], d.knF[1]];
      case 'tail': { var c = tailCurve(d); return [c[5][0], c[5][1], c[TAIL_N][0], c[TAIL_N][1]]; }
    }
    return [d.elF[0], d.elF[1], d.haF[0], d.haF[1]];
  };
  C.boundsExtra = function (sk) {
    var d = sk.d, c = tailCurve(d), o = [], g = wingGeo(d, false);
    o.push(mir(sk, R0(c[4])), mir(sk, R0(c[7])), mir(sk, R0(c[TAIL_N])));
    o.push(mir(sk, R0(g.w)), mir(sk, R0(g.tips[0])), mir(sk, R0(g.tips[1])), mir(sk, R0(g.tips[2])));
    o.push(mir(sk, R0(fr(d.pel, d.lean, -19, 50))), mir(sk, R0(fr(d.pel, d.lean, 16, 50))));
    o.push(mir(sk, R0([d.elF[0] + 4, d.elF[1] + 34])), mir(sk, R0([d.elB[0] - 4, d.elB[1] + 34])));
    o.push(mir(sk, blobTarget(d)), mir(sk, headPt(d, 3, 2)));
    return o;
  };

  // ------------------------------------------------------------------ attach (every tick)
  C.attach = function (sk, sec, ds) {
    var d = sk.d || sk, by = sec.by, a = d.headAng, L = d.lean;
    ds = ds || d.ds || {};
    sec._ph = (sec._ph || 0) + 1;
    // tail: rest = pose curve + a slow, heavy sway (stronger toward the tip)
    var tl = own(by.tail), tr = tailRoot(d), sw = 6 * (ds.tsw == null ? 1 : ds.tsw), ph = sec._ph * 0.06;
    tailAngles(d, TA);
    for (var i = 0; i < TAIL_N; i++) tl.def.rest[i] = TA[i] + sw * Math.sin(ph - i * 0.45) * (0.2 + i * 0.1);
    sec.attach('tail', tr[0], tr[1], 0);
    if (ds.tl) {
      var c = tailCurve(d);
      for (i = 0; i < c.length; i++) { tl.x[i] = tl.px[i] = c[i][0]; tl.y[i] = tl.py[i] = c[i][1]; }
    }
    // hair
    var hA = headPt(d, 6, 18), hB = headPt(d, 9, 21), lk = headPt(d, 14, 24), lf = headPt(d, 27, 21), ah = headPt(d, 15, 11);
    sec.attach('hairA', hA[0], hA[1], a * 0.4);
    sec.attach('hairB', hB[0], hB[1], a * 0.4);
    sec.attach('lockN', lk[0], lk[1], a * 0.35);
    sec.attach('lockF', lf[0], lf[1], a * 0.35);
    sec.attach('ahoge', ah[0], ah[1], a);
    if (ds.hs) ['hairA', 'hairB', 'lockN', 'lockF', 'sFa', 'sFe', 'sBa', 'sBe'].forEach(function (id) {
      var ch = by[id]; if (!ch.ready) return;
      for (var j = 1; j < ch.n; j++) {
        var r = ch.restPos(j);
        ch.x[j] += (r[0] - ch.x[j]) * ds.hs; ch.y[j] += (r[1] - ch.y[j]) * ds.hs;
        ch.px[j] += (r[0] - ch.px[j]) * ds.hs; ch.py[j] += (r[1] - ch.py[j]) * ds.hs;
      }
    });
    // sleeves hang from the upper arm (band → elbow)
    ['F', 'B'].forEach(function (s) {
      var sh = s === 'F' ? d.shF : d.shB, el = s === 'F' ? d.elF : d.elB;
      var A = lerp(sh, el, 0.5), E = lerp(sh, el, 1.05);
      sec.attach('s' + s + 'a', A[0], A[1], 0);
      sec.attach('s' + s + 'e', E[0], E[1], 0);
    });
    // hem lift eases in/out
    var ht = d.hem != null ? d.hem : (sk.hem || 0);
    sec._hem = sec._hem == null ? ht : sec._hem + (ht - sec._hem) * 0.35;
    if (Math.abs(sec._hem - ht) < 0.05) sec._hem = ht;
    sk.hemS = sec._hem;
    // skirt contours
    var fl = d.skirt || 0, F0 = fr(d.pel, L, 8, -1), B0 = fr(d.pel, L, -9, -1);
    var hf = own(by.hemF), hb = own(by.hemB);
    var rl = L * (0.4 + 0.6 * Math.min(1, Math.abs(L) / 90)) - (d.tw || 0);
    hf.def.rest[0] = 80 - fl * 40 + rl; hf.def.rest[1] = 86 - fl * 32 + rl;
    hb.def.rest[0] = 104 + fl * 40 + rl; hb.def.rest[1] = 97 + fl * 32 + rl;
    sec.attach('hemF', F0[0], F0[1], 0);
    sec.attach('hemB', B0[0], B0[1], 0);
    // chain-belt pendant tassel (front hip)
    var tp = fr(d.pel, L * 0.6, 6, 2);
    sec.attach('tas', tp[0], tp[1], 0);
    // wing wrist lag
    var g = wingGeo(d, false);
    sec.attach('wing', g.w[0], g.w[1] + 6, 0);
    // blob: floats behind her shoulder, bobbing
    var bt = blobTarget(d), bob = Math.sin(sec._ph * 0.07) * 1.6;
    sec.attach('blob', bt[0], bt[1] + 14 + bob, 0);
  };

  // ------------------------------------------------------------------ drawing helpers (skirt surface)
  function plMake(pts) {
    var Ls = [0];
    for (var i = 1; i < pts.length; i++) { var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1]; Ls.push(Ls[i - 1] + Math.sqrt(dx * dx + dy * dy)); }
    return { p: pts, L: Ls, T: Ls[Ls.length - 1] || 1 };
  }
  function plAt(pl, v) {
    var d = v * pl.T, i = 1;
    while (i < pl.p.length - 1 && pl.L[i] < d) i++;
    var a = pl.L[i - 1], b = pl.L[i], u = b > a ? (d - a) / (b - a) : 0;
    return lerp(pl.p[i - 1], pl.p[i], Math.max(0, Math.min(1, u)));
  }
  function surf(S, s, v) {
    var p = lerp(plAt(S.f, v), plAt(S.b, v), s);
    if (v > 0.85) p[1] += S.sag * Math.sin(Math.PI * Math.max(0, Math.min(1, s))) * (v - 0.85) / 0.15;
    return p;
  }
  function band(S, sa, sb, v0, v1, n) {
    var L = [], Rr = [];
    for (var k = 0; k <= n; k++) {
      var v = v0 + (v1 - v0) * k / n;
      L.push(surf(S, typeof sa === 'function' ? sa(v) : sa, v));
      Rr.push(surf(S, typeof sb === 'function' ? sb(v) : sb, v));
    }
    return H.flat(L.concat(Rr.reverse()));
  }
  function sLine(p, S, sfn, v0, v1, c, onlyOn, dark) {
    var n = 8, prev = null;
    for (var k = 0; k <= n; k++) {
      var v = v0 + (v1 - v0) * k / n, q = R0(surf(S, typeof sfn === 'function' ? sfn(v) : sfn, v));
      if (prev) { if (dark) p.darkLine(prev[0], prev[1], q[0], q[1], 1); else p.line(prev[0], prev[1], q[0], q[1], c, onlyOn); }
      prev = q;
    }
  }
  function hLine(p, S, s0, s1, v, c, onlyOn, dash) {
    var n = 12, prev = null;
    for (var k = 0; k <= n; k++) {
      var q = R0(surf(S, s0 + (s1 - s0) * k / n, v));
      if (prev && (!dash || k & 1)) p.line(prev[0], prev[1], q[0], q[1], c, onlyOn);
      prev = q;
    }
  }
  // wavy tapered ribbon (hair locks) — returns a flat polygon + side lines
  function wavy(pts, w, amp, seed) {
    var sub = [];
    for (var i = 0; i < pts.length - 1; i++) for (var k = 0; k < 2; k++) sub.push(lerp(pts[i], pts[i + 1], k / 2));
    sub.push(pts[pts.length - 1]);
    var n = sub.length, Lf = [], Rt = [];
    for (i = 0; i < n; i++) {
      var a = sub[i > 0 ? i - 1 : 0], b = sub[i < n - 1 ? i + 1 : n - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / l, ny = dx / l, t = i / (n - 1), ww = w[0] + (w[1] - w[0]) * t + (w[2] || 0) * Math.sin(Math.PI * t);
      var wv = amp * Math.sin(i * 2.1 + seed) * (0.4 + t);
      Lf.push([sub[i][0] + nx * (ww + wv), sub[i][1] + ny * (ww + wv)]);
      Rt.push([sub[i][0] - nx * (ww - wv * 0.7), sub[i][1] - ny * (ww - wv * 0.7)]);
    }
    var tipP = sub[n - 1];
    return { poly: H.flat(Lf.concat([[tipP[0] + (tipP[0] - sub[n - 2][0]) * 0.9, tipP[1] + (tipP[1] - sub[n - 2][1]) * 0.9]], Rt.reverse())), sub: sub, L: Lf, R: Rt };
  }

  // ------------------------------------------------------------------ parts
  // knot rosette (interlaced loops) — our own 5×5 / 7×7 design, white with dark line work
  var ROS5 = ['.WCW.', 'WvWvW', 'CWvWC', 'WvWvW', '.WCW.'];
  var ROS7 = ['..WCW..', '.WvWvW.', 'WvWCWvW', 'CWCvCWC', 'WvWCWvW', '.WvWvW.', '..WCW..'];
  function rosette(p, at, big, onlyOn) {
    var art = big ? ROS7 : ROS5, h = art.length, o = (h - 1) / 2;
    for (var j = 0; j < h; j++) for (var i = 0; i < h; i++) {
      var ch = art[j][i]; if (ch === '.') continue;
      var c = ch === 'W' ? col(M.c1, 0) : ch === 'C' ? col(M.c1, 2) : col(M.c2, 3);
      if (onlyOn) p.pxOn(at[0] + i - o, at[1] + j - o, c); else p.px(at[0] + i - o, at[1] + j - o, c);
    }
  }

  function drawTail(p, sk, sec, ds) {
    var pts = ds.tl ? tailCurve(sk) : H.chainPts(sec.tail), n = pts.length, i;
    pts = H.chaikin(pts);
    var m = pts.length, rr = [];
    for (i = 0; i < m; i++) { var u = i / (m - 1) * (TAIL_R.length - 1), k = Math.floor(u), f = u - k; rr.push(k + 1 < TAIL_R.length ? TAIL_R[k] + (TAIL_R[k + 1] - TAIL_R[k]) * f : TAIL_R[k]); }
    // dorsal spikes first (behind the body of the tail): on the side n = (-dy, dx)
    for (i = 2; i < m - 3; i += 2) {
      var a = pts[i - 1], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l; dy /= l;
      var nx = -dy, ny = dx, r = rr[i], hgt = 1.8 + r * 0.55;
      var q0 = [pts[i][0] + nx * (r - 0.8) - dx * 1.8, pts[i][1] + ny * (r - 0.8) - dy * 1.8];
      var q1 = [pts[i][0] + nx * (r + hgt) - dx * 2.6, pts[i][1] + ny * (r + hgt) - dy * 2.6];
      var q2 = [pts[i][0] + nx * (r - 0.8) + dx * 1.4, pts[i][1] + ny * (r - 0.8) + dy * 1.4];
      p.poly(H.flat([q0, q1, q2]), MS, null, 2);
    }
    for (i = 0; i < m - 1; i++) p.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rr[i], rr[i + 1], MS, SH.thick, 1);
    // pale belly band (side -n) with plate lines; scale rows on the flank
    for (i = 1; i < m - 2; i++) {
      var A = pts[i], B = pts[i + 1], ex = B[0] - A[0], ey = B[1] - A[1], el = Math.sqrt(ex * ex + ey * ey) || 1;
      ex /= el; ey /= el;
      var bx = ey, by = -ex, rb = rr[i] - 1.2;      // belly side = -n
      if (rb > 0.6) ln(p, [A[0] + bx * rb, A[1] + by * rb], [B[0] + bx * (rr[i + 1] - 1.2), B[1] + by * (rr[i + 1] - 1.2)], col(MS, 0), true);
      if (i % 2 === 0 && rr[i] > 1.8) {
        // a chevron of scale marks across the flank
        var c0 = [A[0] - ey * rr[i] * 0.5 - ex * 1, A[1] + ex * rr[i] * 0.5 - ey * 1];
        p.darken(Math.round(c0[0]), Math.round(c0[1]), 1);
        p.darken(Math.round(A[0]), Math.round(A[1]), 1);
        p.darken(Math.round(A[0] + bx * rr[i] * 0.5 - ex), Math.round(A[1] + by * rr[i] * 0.5 - ey), 1);
      }
    }
    void n;
  }

  function drawHairLock(p, ch, w, amp, seed, strands, tipMat) {
    var pts = H.chainPts(ch), wv = wavy(pts, w, amp, seed), sub = wv.sub, n = sub.length, i;
    p.poly(wv.poly, M.hair, null);
    var cut = Math.floor(n * 0.7);
    if (tipMat != null) p.poly(H.flat(wv.L.slice(cut).concat([sub[n - 1]], wv.R.slice(cut).reverse())), tipMat, null, 1);
    var prev = null;
    for (i = 0; i < n; i++) {
      var q = R0(lerp(wv.L[i], wv.R[i], 0.1));
      if (prev) p.darkLine(prev[0], prev[1], q[0], q[1], 1);
      prev = q;
    }
    for (var s = 0; s < strands.length; s++) {
      prev = null;
      for (i = 1; i < n - 1; i++) {
        var q2 = R0(lerp(wv.L[i], wv.R[i], strands[s] + 0.08 * Math.sin(i * 1.3 + s)));
        if (prev && i > 1) p.darkLine(prev[0], prev[1], q2[0], q2[1], 1);
        prev = q2;
      }
    }
    var h0 = R0(lerp(wv.L[1], wv.R[1], 0.72)), h1 = R0(lerp(wv.L[3], wv.R[3], 0.7));
    p.line(h0[0], h0[1], h1[0], h1[1], col(M.hair, 0), true);
  }

  function drawWing(p, sk, sec, far) {
    var g = wingGeo(sk, far), wc = sec.wing, lag = [0, 0];
    if (!far && wc && wc.ready) {
      lag = [wc.qx[1] - Math.round(g.w[0]), wc.qy[1] - Math.round(g.w[1])];
      lag[0] = Math.max(-4, Math.min(4, lag[0])); lag[1] = Math.max(-4, Math.min(4, lag[1]));
    }
    var w = [g.w[0] + lag[0], g.w[1] + lag[1]], tips = g.tips.map(function (t) { return [t[0] + lag[0] * 1.6, t[1] + lag[1] * 1.6]; });
    var r = g.root, t = far ? 1 : 0;
    // membrane: root → wrist → tip0 ⌒ tip1 ⌒ tip2 → back to the root, scalloped between the fingers
    function scal(a, b, k) { var m = lerp(a, b, 0.5); return lerp(m, w, k); }
    var mem = [r, w, tips[0], scal(tips[0], tips[1], 0.36), tips[1], scal(tips[1], tips[2], 0.38), tips[2], scal(tips[2], [r[0] + 1, r[1] + 5], 0.25), [r[0] + 1, r[1] + 5]];
    p.poly(H.flat(mem), MW, SH.soft, 1 + t);
    // darker inner panels near the body
    p.poly(H.flat([r, w, scal(tips[1], tips[2], 0.55), lerp(tips[2], r, 0.6)]), MW, null, 2 + t);
    // bones: arm (thick) + three fingers, wrist claw
    p.cap(r[0], r[1], w[0], w[1], 1.6, 1.2, MS, SH.limb, 1 + t);
    for (var k = 0; k < 3; k++) {
      var bt = lerp(w, tips[k], 0.96);
      p.cap(w[0], w[1], bt[0], bt[1], 0.9, 0.5, MS, null, 1 + t);
    }
    var cl = fr(w, angOf(r[0], r[1], w[0], w[1]) - 40, 2.5, 0);
    ln(p, w, cl, col(MS, 0 + t));
    ln(p, w, tips[0], col(MS, 2 + t), true);
  }

  function drawBlob(p, sk, sec, ds) {
    var ch = sec.blob, c = ch && ch.ready ? [ch.qx[1], ch.qy[1]] : blobTarget(sk), f = ds.bf || 'open';
    var x = c[0], y = c[1];
    p.ell(x - 0.5, y - 0.5, 4.6, 4, MB, SH.body, 1);
    p.ell(x - 0.5, y + 2, 3.6, 1.6, MB, null, 2);                // heavier bottom
    p.px(x - 2, y - 3, col(MB, 0)); p.px(x - 1, y - 3, col(MB, 0)); p.px(x - 3, y - 2, col(MB, 0));
    var ink = col(M.ink, 2), wht = col(M.c1, 0);
    if (f === 'happy') { p.px(x, y - 1, ink); p.px(x - 1, y, ink); p.px(x + 1, y, ink); p.px(x + 3, y - 1, ink); p.px(x + 2, y, ink); p.px(x + 4, y, ink); }
    else if (f === 'shut') { p.px(x - 1, y, ink); p.px(x, y, ink); p.px(x + 2, y, ink); p.px(x + 3, y, ink); }
    else if (f === 'x') { [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]].forEach(function (o) { p.px(x + o[0], y + o[1], ink); p.px(x + 3 + o[0], y + o[1], ink); }); }
    else {
      var big = f === 'wide';
      p.px(x, y - 1, ink); p.px(x, y, ink); p.px(x + 3, y - 1, ink); p.px(x + 3, y, ink);
      if (big) { p.px(x, y + 1, ink); p.px(x + 3, y + 1, ink); p.px(x - 1, y, ink); p.px(x + 2, y, ink); }
      p.px(x, y - 1, wht); p.px(x + 3, y - 1, wht);
      p.px(x, y - 2, f === 'sad' ? ink : 0); p.px(x + 3, y - 2, f === 'sad' ? ink : 0);
      if (f === 'sad') { p.px(x, y - 1, ink); p.px(x + 3, y - 1, ink); }
    }
  }

  function drawSleeve(p, sk, sec, s) {
    var a = H.chainPts(sec['s' + s + 'a']), e = H.chainPts(sec['s' + s + 'e']), t = s === 'F' ? 1 : 2;
    var poly = [a[0], e[0], e[1], e[2], e[3], a[3], a[2], a[1]];
    // bell: push the hanging edges apart a little toward the bottom
    var bw = [0, 0.5, 1.1, 1.9];
    var E2 = e.map(function (q, i) { return [q[0] + bw[i], q[1]]; }), A2 = a.map(function (q, i) { return [q[0] - bw[i], q[1]]; });
    poly = [A2[0], E2[0], E2[1], E2[2], E2[3], A2[3], A2[2], A2[1]];
    p.poly(H.flat(poly), M.c1, SH.soft, t);
    // silver lining along the inner (back) edge
    for (var i = 1; i < 4; i++) {
      var q0 = lerp(A2[i - 1], E2[i - 1], i === 1 ? 0.12 : 0.14), q1 = lerp(A2[i], E2[i], 0.16);
      ln(p, lerp(A2[i - 1], E2[i - 1], 0.02), lerp(A2[i], E2[i], 0.02), col(M.c2, 1), true);
      ln(p, q0, q1, col(M.c2, 0), true);
    }
    // folds
    for (var f = 0; f < 2; f++) {
      var u = f ? 0.68 : 0.42;
      for (i = 1; i < 4; i++) dl(p, lerp(A2[i - 1], E2[i - 1], u - 0.12 * (i === 1 ? 1 : 0)), lerp(A2[i], E2[i], u));
    }
    // frilled bottom edge + front edge ruffles
    for (var k = 0; k <= 6; k++) {
      var q = lerp(A2[3], E2[3], k / 6);
      p.ell(q[0] - 0.5, q[1] + 0.5, 1.6, 1.4, M.c1, null, k & 1 ? t : t + 1);
    }
    for (k = 1; k <= 5; k++) {
      var seg = k / 6 * 3, si = Math.floor(seg), uu = seg - si, q3 = lerp(E2[si], E2[Math.min(3, si + 1)], uu);
      p.ell(q3[0] + 0.5, q3[1] - 0.5, 1.2, 1.4, M.c1, null, k & 1 ? t : t + 1);
    }
    // band around the upper arm (where the sleeve is tied) with a tiny rosette knot
    var sh = s === 'F' ? sk.shF : sk.shB, el = s === 'F' ? sk.elF : sk.elB, B = lerp(sh, el, 0.48), dir = [el[0] - sh[0], el[1] - sh[1]], l = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]) || 1;
    var nx = -dir[1] / l * 2.8, ny = dir[0] / l * 2.8;
    p.cap(B[0] - nx, B[1] - ny, B[0] + nx, B[1] + ny, 1.3, 1.3, M.c1, null, t - 1);
  }

  function drawArm(p, sk, s, ds) {
    var sh = s === 'F' ? sk.shF : sk.shB, el = s === 'F' ? sk.elF : sk.elB, ha = s === 'F' ? sk.haF : sk.haB;
    var ang = s === 'F' ? sk.handAngF : sk.handAngB, shape = s === 'F' ? ds.handF : ds.handB, t = s === 'F' ? 1 : 2;
    p.cap(sh[0], sh[1], el[0], el[1], 2.5, 2.0, M.skin, SH.limbL, t);
    p.cap(el[0], el[1], ha[0], ha[1], 2.0, 1.6, M.skin, SH.limbL, t);
    // round bare shoulder
    p.ell(sh[0] - 0.5, sh[1] + 0.5, 2.8, 2.6, M.skin, SH.body, t);
    // arm band (sleeve tie) on the upper arm
    var B = lerp(sh, el, 0.48), dx = el[0] - sh[0], dy = el[1] - sh[1], l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l, ny = dx / l;
    ln(p, [B[0] + nx * 2.4, B[1] + ny * 2.4], [B[0] - nx * 2.4, B[1] - ny * 2.4], col(M.c1, t - 1), true);
    ln(p, [B[0] + nx * 2.4 + dx / l, B[1] + ny * 2.4 + dy / l], [B[0] - nx * 2.4 + dx / l, B[1] - ny * 2.4 + dy / l], col(M.c2, t), true);
    // frilled wrist cuff + platinum bracelet
    var fx = ha[0] - el[0], fy = ha[1] - el[1], fl = Math.sqrt(fx * fx + fy * fy) || 1;
    var cf = [ha[0] - fx / fl * 2.5, ha[1] - fy / fl * 2.5];
    p.cap(cf[0], cf[1], ha[0] - fx / fl * 0.5, ha[1] - fy / fl * 0.5, 2.3, 2.6, M.c1, SH.limbL, t);
    var gn = -fy / fl, gm = fx / fl;
    ln(p, [cf[0] + gn * 2.2, cf[1] + gm * 2.2], [cf[0] - gn * 2.2, cf[1] - gm * 2.2], col(M.metal, t), true);
    H.hand(p, [ha[0] + fx / fl * 0.5, ha[1] + fy / fl * 0.5], ang, shape || 'relax', M.skin, M.skin, I.ART.gpt.hands);
  }

  // teal glow on the claw tips (ds.claw)
  function drawClawGlow(p, sk, s) {
    var ha = s === 'F' ? sk.haF : sk.haB, ang = (s === 'F' ? sk.handAngF : sk.handAngB) * D2R;
    var ux = Math.cos(ang), uy = Math.sin(ang);
    for (var k = -1; k <= 1; k++) {
      var b = [ha[0] + ux * 5 - uy * k * 1.6, ha[1] + uy * 5 + ux * k * 1.6], tp = [b[0] + ux * 3.5 - uy * k * 0.8, b[1] + uy * 3.5 + ux * k * 0.8];
      ln(p, b, tp, col(M.glow, k === 0 ? 0 : 1));
    }
  }

  function drawLeg(p, sk, s, lockOff, garter) {
    var hip = s === 'F' ? sk.hipF : sk.hipB, kn = s === 'F' ? sk.knF : sk.knB;
    var an = s === 'F' ? sk.anF : sk.anB, ft = s === 'F' ? sk.ftF : sk.ftB, fa = s === 'F' ? sk.faF : sk.faB;
    var lo = lockOff || 0, t = s === 'F' ? 1 : 2;
    an = [an[0] + lo, an[1]]; ft = [ft[0] + lo, ft[1]];
    p.cap(hip[0], hip[1], kn[0], kn[1], 4.0, 2.8, M.skin, SH.limbL, t);
    p.cap(kn[0], kn[1], an[0], an[1], 2.7, 1.6, M.skin, SH.limbL, t);
    var calf = lerp(kn, an, 0.3), dx = an[0] - kn[0], dy = an[1] - kn[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    p.cap(calf[0] - dy / l * 0.6, calf[1] + dx / l * 0.6, calf[0] + dx / l * 4 - dy / l * 0.3, calf[1] + dy / l * 4 + dx / l * 0.3, 2.9, 2.2, M.skin, SH.limbL, t);
    if (garter) {   // lace garter band with a tiny pendant, visible in the slit
      var gq = lerp(hip, kn, 0.55), tx = kn[0] - hip[0], ty = kn[1] - hip[1], tl = Math.sqrt(tx * tx + ty * ty) || 1, gx = -ty / tl * 3.6, gy = tx / tl * 3.6;
      ln(p, [gq[0] + gx, gq[1] + gy], [gq[0] - gx, gq[1] - gy], col(M.c1, t - 1), true);
      ln(p, [gq[0] + gx + tx / tl, gq[1] + gy + ty / tl], [gq[0] - gx + tx / tl, gq[1] - gy + ty / tl], col(M.c1, t + 1), true);
      p.pxOn(Math.round(gq[0] + tx / tl * 2), Math.round(gq[1] + ty / tl * 2), col(M.metal, 1));
    }
    // white heeled pump: pointed toe, slim heel post
    var b = [[-2.6, -4.2], [0.5, -4.4], [3.5, -3.2], [6.5, -1.4], [8.2, 0], [3.2, 0], [0, -1.2], [-2.8, -2.2]];
    var pts = [];
    for (var i = 0; i < b.length; i++) { var q = fr(ft, fa, b[i][0], b[i][1]); pts.push(q[0], q[1]); }
    p.poly(pts, M.c1, SH.limbL, 1);
    var h0 = fr(ft, fa, -2, -1.8), h1 = fr(ft, fa, -2.2, 0.2);
    p.cap(h0[0], h0[1], h1[0], h1[1], 0.7, 0.6, M.c1, null, 2);
    var s0 = fr(ft, fa, 0.5, -1), s1 = fr(ft, fa, 7.5, -0.4);
    ln(p, s0, s1, col(M.c1, 3), true);
    var ac0 = fr(ft, fa, -2.4, -5.2), ac1 = fr(ft, fa, 1.6, -5.4);
    ln(p, ac0, ac1, col(M.metal, 1), true);
    var tg = R0(fr(ft, fa, 4.5, -2.4));
    p.pxOn(tg[0], tg[1], col(M.c1, 0));
  }

  function skirtSurf(sk, sec, hu) {
    var W = sk.waist, wa = sk.lean * 0.7 + sk.chestAng * 0.3, hf = H.chainPts(sec.hemF), hb = H.chainPts(sec.hemB);
    var df = drape(sk, 'F', hf[0], hf[1], hf[2]), db = drape(sk, 'B', hb[0], hb[1], hb[2]);
    if (hu) { df = [df[0], [df[1][0], df[1][1] - hu]]; db = [db[0], [db[1][0], db[1][1] - hu]]; }
    return {
      f: plMake([fr(W, wa, 4.5, 1.5), hf[0], df[0], df[1]]),
      b: plMake([fr(W, wa, -5, 1.5), hb[0], db[0], db[1]]),
      sag: 1.5
    };
  }
  var VS = 0.3;                                                        // slit top (fraction of the skirt length)
  var flap = function (v) { return 0.16 * Math.max(0, 1 - (v - VS) / (1 - VS)) + 0.05; };   // front panel edge (s)
  var slitB = function (v) { return 0.16 + 0.26 * Math.min(1, (v - VS) / 0.5); };          // back edge of the opening

  function drawHemFrill(p, S) {
    for (var k = 0; k <= 14; k++) {
      var q = surf(S, -0.02 + 1.04 * k / 14, 1);
      p.ell(q[0] - 0.5, q[1] - 0.5, 1.7, 1.3, M.c1, null, k & 1 ? 1 : 2);
    }
  }
  // main skirt (behind the front leg): back panel + far side, lining visible in the slit opening
  function drawSkirtBack(p, S) {
    p.poly(band(S, 0, 1, 0, 1, 6), M.c1, null);
    sLine(p, S, 0.975, 0.04, 1, 0, true, true);
    sLine(p, S, 0.95, 0.3, 1, 0, true, true);
    hLine(p, S, 0.4, 1, 0.985, col(M.c1, 3), true);
    // folds (soft lavender) on the back panel
    sLine(p, S, function (v) { return 0.6 + 0.05 * v; }, 0.25, 1, 0, true, true);
    sLine(p, S, function (v) { return 0.8 + 0.04 * v; }, 0.2, 1, 0, true, true);
    sLine(p, S, function (v) { return 0.7 + 0.06 * v; }, 0.45, 0.98, col(M.c1, 0), true);
    // silver lining behind the leg (inside of the slit)
    p.poly(band(S, flap, slitB, VS + 0.02, 1, 5), M.c2, null, 1);
    sLine(p, S, function (v) { return slitB(v) - 0.03; }, VS + 0.08, 1, col(M.c2, 2), true);
    sLine(p, S, slitB, VS + 0.04, 1, col(M.c1, 2), true);
    // hem: platinum band line + rosettes along the hem
    hLine(p, S, slitB(0.92), 1.0, 0.9, col(M.c2, 1), true, true);
    [0.55, 0.85].forEach(function (s) { rosette(p, R0(surf(S, s, 0.93)), false, true); });
  }
  // upper skirt (over the front thigh) + front panel edge beside the leg
  function drawSkirtFront(p, S) {
    p.poly(band(S, 0, 1, 0, VS + 0.04, 3), M.c1, SH.soft);
    p.poly(band(S, 0, flap, VS, 1, 5), M.c1, SH.soft);
    sLine(p, S, 0.012, 0.05, 0.95, col(M.c1, 0), true);
    sLine(p, S, function (v) { return flap(v) - 0.01; }, VS + 0.02, 1, col(M.c2, 1), true);     // lining at the slit edge
    sLine(p, S, 0.98, 0.04, VS + 0.04, 0, true, true);
    // slit top: a knot rosette at the hip
    rosette(p, R0(surf(S, 0.14, VS - 0.02)), true, true);
  }
  function drawBelt(p, sk, sec) {
    var W = sk.waist, wa = sk.lean * 0.7 + sk.chestAng * 0.3, L = sk.lean;
    // platinum chain slung over the hips: back waist → front hip, dashed links
    var a = fr(W, wa, -5, 2.5), b = fr(sk.pel, L * 0.6, 6.5, 0), m = lerp(a, b, 0.5);
    m = [m[0], m[1] + 1.5];
    var pts = [a, m, b];
    for (var k = 0; k < 2; k++) {
      var p0 = pts[k], p1 = pts[k + 1], n = 6;
      for (var i = 0; i < n; i++) {
        var q = R0(lerp(p0, p1, i / n));
        p.pxOn(q[0], q[1], col(M.metal, i & 1 ? 2 : 0));
        p.pxOn(q[0], q[1] + 1, col(M.metal, 2));
      }
    }
    // diamond pendant + tassel on the front hip (tassel swings: chain 'tas')
    var tc = H.chainPts(sec.tas);
    var d0 = R0(tc[0]);
    [[0, 0, 0], [-1, 1, 1], [1, 1, 1], [0, 1, 0], [0, 2, 2]].forEach(function (o) { p.px(d0[0] + o[0], d0[1] + o[1], col(M.metal, o[2])); });
    p.px(d0[0], d0[1] + 1, col(M.acc, 1));
    ln(p, [d0[0], d0[1] + 3], tc[1], col(M.metal, 1));
    ln(p, tc[1], tc[2], col(M.metal, 2));
    p.px(Math.round(tc[2][0]), Math.round(tc[2][1]), col(M.metal, 0));
    p.px(Math.round(tc[2][0]) - 1, Math.round(tc[2][1]) + 1, col(M.metal, 2)); p.px(Math.round(tc[2][0]) + 1, Math.round(tc[2][1]) + 1, col(M.metal, 2));
    // a second pendant at mid-belt (short, rigid)
    var m2 = R0(lerp(m, b, 0.2));
    p.px(m2[0], m2[1] + 1, col(M.metal, 1)); p.px(m2[0], m2[1] + 2, col(M.metal, 0)); p.px(m2[0], m2[1] + 3, col(M.acc, 2)); p.px(m2[0], m2[1] + 4, col(M.metal, 2));
  }

  function drawTorso(p, sk) {
    var c = sk.chest, ca = sk.chestAng, W = sk.waist, wa = sk.lean * 0.6 + ca * 0.4;
    // neck
    p.cap(c[0] + 0.5, c[1] + 1, sk.neck[0] - 0.5, sk.neck[1], 1.9, 1.8, M.skin, null, 2);
    // bare shoulders / upper chest (skin), then the fitted halter bodice over it
    var body = H.flat([fr(c, ca, -3, 0), fr(c, ca, -6, 1.5), fr(c, ca, -6.5, 6), fr(c, ca, -5.5, 12), fr(W, wa, -4.5, 0), fr(W, wa, -5, 3),
      fr(W, wa, 4.5, 3), fr(W, wa, 4, 0), fr(c, ca, 5.2, 12.5), fr(c, ca, 6.8, 9), fr(c, ca, 6, 5), fr(c, ca, 4, 1), fr(c, ca, 1.5, -0.5)]);
    p.poly(body, M.skin, SH.body);
    var bod = H.flat([fr(c, ca, 0.5, 0), fr(c, ca, 3, 0.5), fr(c, ca, 5.5, 4.5), fr(c, ca, 6.8, 9), fr(c, ca, 5.2, 12.5), fr(W, wa, 4, 0), fr(W, wa, 4.5, 3),
      fr(W, wa, -5, 3), fr(W, wa, -4.5, 0), fr(c, ca, -5.5, 12), fr(c, ca, -6, 7), fr(c, ca, -3, 6), fr(c, ca, -0.5, 3)]);
    p.poly(bod, M.c1, SH.body);
    // armhole edge, under-bust line, centre-front diamond line
    dl(p, fr(c, ca, -6, 7), fr(c, ca, -3, 6));
    var u0 = fr(c, ca, 0.5, 10.5), u1 = fr(c, ca, 6, 11);
    ln(p, u0, u1, col(M.c1, 3), true);
    var cx0 = fr(c, ca, 3.6, 2), cx1 = fr(c, ca, 3.2, 18);
    ln(p, cx0, cx1, col(M.c2, 1), true);
    [[3.5, 5.5], [3.3, 13]].forEach(function (o, i) {
      var q = R0(fr(c, ca, o[0], o[1]));
      p.pxOn(q[0], q[1] - 1, col(M.c2, 2)); p.pxOn(q[0] - 1, q[1], col(M.c2, 2)); p.pxOn(q[0] + 1, q[1], col(M.c2, 2)); p.pxOn(q[0], q[1] + 1, col(M.c2, 2));
      p.pxOn(q[0], q[1], i ? col(M.acc, 1) : col(M.skin, 1));    // keyhole cut-out at the top, teal gem lower
    });
    var w0 = fr(W, wa, -4.5, 2.5), w1 = fr(W, wa, 4, 2.5);
    ln(p, w0, w1, col(M.c1, 2), true);
  }
  function drawCollar(p, sk) {
    var c = sk.chest, ca = sk.chestAng, n = sk.neck;
    // high stand-up collar around the neck with a platinum edge and a small diamond
    var a0 = lerp(c, n, 0.15), a1 = lerp(c, n, 0.85);
    p.poly(H.flat([fr(a0, ca, -2.6, 0.5), fr(a1, ca, -2.4, 0), fr(a1, ca, 2.6, -0.5), fr(a0, ca, 3, 0.5), fr(a0, ca, 1.5, 2)]), M.c1, SH.soft, 1);
    ln(p, fr(a1, ca, -2.4, 0), fr(a1, ca, 2.6, -0.5), col(M.metal, 1), true);
    var g = R0(fr(lerp(a0, a1, 0.5), ca, 2.2, 0));
    p.pxOn(g[0], g[1], col(M.acc, 1)); p.pxOn(g[0], g[1] + 1, col(M.metal, 2));
  }

  function mirrorBuffer(p) {
    var BW = I.BW, OX = I.OX, m = p.m, y, x;
    var x0 = p.mx0, x1 = p.mx1;
    if (x1 <= x0) return;
    var nx0 = 2 * OX - (x1 - 1), nx1 = 2 * OX - x0 + 1;
    if (nx0 < 0) nx0 = 0; if (nx1 > BW) nx1 = BW;
    var row = mirrorBuffer.row || (mirrorBuffer.row = new Uint8Array(BW));
    for (y = p.my0; y < p.my1; y++) {
      var o = y * BW;
      row.fill(0);
      for (x = x0; x < x1; x++) { var t = 2 * OX - x; if (t >= 0 && t < BW) row[t] = m[o + x]; }
      m.fill(0, o + x0, o + x1);
      for (x = nx0; x < nx1; x++) m[o + x] = row[x];
    }
    p.mx0 = Math.min(nx0, x0); p.mx1 = Math.max(nx1, x1);
  }

  C.draw = function (D) {
    var p = D.p, sk0 = D.sk, d = sk0.d || sk0, ds = D.ds, sec = D.sec, z = ds.z || {};
    var eyes = ds.eyes || 'open';
    if (D.blink && (eyes === 'open' || eyes === 'focus' || eyes === 'sad' || eyes === 'wide')) eyes = (D.blink > 5 || D.blink < 3) ? 'half' : 'closed';
    var S = skirtSurf(d, sec, -Math.round(sk0.hemS != null ? sk0.hemS : (sk0.hem || 0)));
    var lockF = sk0.flip ? 0 : D.lock.F, lockB = sk0.flip ? 0 : D.lock.B;
    var steps = [
      [z.blob != null ? z.blob : -8.8, function () { drawBlob(p, d, sec, ds); p.end(); }],
      [-11, function () { drawWing(p, d, sec, true); p.end(); }],
      [z.tail != null ? z.tail : -10, function () { drawTail(p, d, sec, ds); p.end(); }],
      [z.hair != null ? z.hair : -9, function () {
        drawHairLock(p, sec.hairA, [8.5, 4.5, 3], 2.2, 0.3, [0.3, 0.55, 0.8], M.tip); p.end();
        drawHairLock(p, sec.hairB, [6, 3, 2], 2, 1.9, [0.4, 0.72], M.tip); p.end();
      }],
      [-7.5, function () { drawSleeve(p, d, sec, 'B'); p.end(); }],
      [z.armB != null ? z.armB : -6, function () { drawArm(p, d, 'B', ds); p.end(); }],
      [z.wing != null ? z.wing : -5, function () { drawWing(p, d, sec, false); p.end(); }],
      [z.legB != null ? z.legB : -4, function () { drawLeg(p, d, 'B', lockB, false); p.end(); }],
      [-2.2, function () { drawHemFrill(p, S); p.end(); }],
      [-2, function () { drawSkirtBack(p, S); p.end(); }],
      [z.legF != null ? z.legF : -1.5, function () { drawLeg(p, d, 'F', lockF, true); p.end(); }],
      [-1, function () { drawSkirtFront(p, S); p.end(); }],
      [-0.5, function () { drawBelt(p, d, sec); p.end(); }],
      [0, function () { drawTorso(p, d); p.end(); }],
      [0.5, function () { drawCollar(p, d); p.end(); }],
      [2, function () {
        var img = H.headImage(C.headSet, eyes, ds.mouth || 'neutral', ds.blush ? 'blush' : '', d.headAng);
        p.blit(img, d.neck[0], d.neck[1]);
        var ah = H.chainPts(sec.ahoge);
        p.cap(ah[0][0], ah[0][1] + 1, ah[1][0], ah[1][1], 0.9, 0.8, M.hair, null);
        p.cap(ah[1][0], ah[1][1], ah[2][0], ah[2][1], 0.8, 0.6, M.hair, null);
        p.cap(ah[2][0], ah[2][1], ah[3][0], ah[3][1], 0.6, 0.5, M.hair, null, 0);
        p.end();
      }],
      [2.5, function () { drawHairLock(p, sec.lockN, [2.8, 1.2, 1], 0.9, 0.7, [0.5], M.tip); p.end(); }],
      [3, function () { drawHairLock(p, sec.lockF, [1.8, 0.8, 0.6], 0.6, 2.2, [], null); p.end(); }],
      [z.slvF != null ? z.slvF : 4, function () { drawSleeve(p, d, sec, 'F'); p.end(); }],
      [4.5, function () { if (D.smear) { H.smear2(p, D.smear, M.smear); p.end({ outline: false }); } }],
      [z.armF != null ? z.armF : 5, function () { drawArm(p, d, 'F', ds); p.end(); }],
      [5.5, function () {
        if (ds.claw) { if (ds.claw.indexOf('B') >= 0) drawClawGlow(p, d, 'B'); if (ds.claw.indexOf('F') >= 0) drawClawGlow(p, d, 'F'); p.end({ ring: col(M.acc, 3) }); }
      }]
    ];
    steps.sort(function (a, b) { return a[0] - b[0]; });
    p.fastTone = true;
    try { for (var i = 0; i < steps.length; i++) steps[i][1](); } finally { p.fastTone = false; }
    if (sk0.flip) mirrorBuffer(p);
  };

  C.build = function () { C.headSet = I.ART.gpt.build(); };
  // expose pose-only helpers for the anim files / tools
  C.geo = { tailCurve: tailCurve, wingGeo: wingGeo, blobTarget: blobTarget, tipOf: tipOf };
  I.CHARS.gpt = C;
})();
