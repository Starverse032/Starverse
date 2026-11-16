/* LATENT CLASH — RIG: Gemini 娘 (96 px, heterochromia cat-girl) body, chains, renderer.
 *
 * Materials (15 shared slots, re-purposed locally): legs = violet hair (`hair2`), tip = pink hair ends,
 * shoe = violet lining, white = gold eye (`eye2`), blush = ear pink (`ear`), glow = iridescent star facets
 * (`star`: white, cyan, pink, yellow), smear = pink-white claw after-glow; c1 white, c2 navy, acc pink-violet.
 *
 * Gemini-only pose fields (all optional):
 *   tail (deg, swings the whole tail; + = clockwise on screen), arch (curl, 10 = rest shape), pen (extra whip
 *   on the outer half, deg/link), tl (1 = tail locked to the pose curve: strikes), tsw (sway scale),
 *   book (coat-panel flare 0..1, panels swing back/out), bko (coat-panel lift deg), bk ([dx,dy] offset of the
 *   lead drifting star), stars (0 = hide the drifting stars, 'hand' = they gather at the front hand),
 *   claw ('F'|'B'|'FB' pink glow on the claws), flip (1 = drawing faces left — spins), weapon
 *   ('hF'|'hB'|'fF'|'fB'|'heelF'|'heelB'|'kF'|'kB'|'tail'), skirt (flare), hem (px, - = lifted), tw (hem swing),
 *   drape {F,B}, hd (hair direction offset deg), hs (settle hair 0..1), air (no floor clip, light gravity),
 *   ears ('flat' | 'perk'), only ('star' = draw just a star glint at the centre: blink vanish), dith (1 = 50 %,
 *   2 = 75 % checker dissolve), z: {tail, armF, armB, legF, legB, hair, slvF, coatN}.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col, SH = I.SH, H = I.H;
  var fr = H.fr, lerp = H.lerp, rot = H.rot;
  var MV = M.legs, MP = M.tip, ML = M.shoe, MG = M.glow;     // violet hair, pink hair ends, violet lining, star facets
  var D2R = Math.PI / 180;

  function R0(p) { return [Math.round(p[0]), Math.round(p[1])]; }
  function ln(p, a, b, c, on) { p.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c, on); }
  function dl(p, a, b, st) { p.darkLine(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), st || 1); }
  function hx(h) { var v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function mixHex(a, b, t) {
    var A = hx(a), B = hx(b), o = '#';
    for (var i = 0; i < 3; i++) { var v = Math.round(A[i] + (B[i] - A[i]) * t); o += (v < 16 ? '0' : '') + v.toString(16); }
    return o;
  }
  function norm(dx, dy) { var l = Math.sqrt(dx * dx + dy * dy) || 1; return [dx / l, dy / l]; }

  var C = {
    id: 'gemini', height: 96, crouchHeight: 64, width: 24,
    body: {
      spine: 26, waist: 9, neck: 4, upper: 14, fore: 13, thigh: 24, shin: 22, ankle: 6,
      shF: [2, 1], shB: [-3, 1], hipF: [3, 1], hipB: [-3, 1]
    },
    // bouncy stance on the balls of her feet: lead paw up at chest height, rear paw tucked by her ribs
    rest: {
      root: [0, 0], hip: [0, -50], lean: 3, bend: -3, head: [0, 0], tilt: -2,
      hF: [17, -61], hB: [4, -60], fF: [9, 0], fB: [-9, 0], faF: 0, faB: 14,
      pen: 0, sq: 0, shr: 0, haF: 0, haB: 0, pg: 0, skirt: 0, tail: 0, arch: 10,
      book: 0, bko: 0, bk: [0, 0], tw: 0, hem: 0,
      eyes: 'open', mouth: 'neutral', handF: 'paw', handB: 'paw',
      elF: 1, elB: 1, knF: -1, knB: -1, blush: 0, z: {}
    },
    sigJoints: ['pel', 'waist', 'chest', 'neck', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB',
      'hipF', 'knF', 'anF', 'ftF', 'hipB', 'knB', 'anB', 'ftB'],
    ramps: function (pal) {
      var r = [];
      r[M.skin] = pal.skin; r[M.hair] = pal.hair; r[MV] = pal.hair2 || pal.hair;
      var h2 = pal.hair2 || pal.hair, tp = pal.hairTip;
      r[MP] = [tp[0], tp[1], mixHex(tp[1], h2[2], 0.5), h2[3]];
      r[M.eye] = pal.eye; r[M.white] = pal.eye2 || pal.eye;
      r[M.c1] = pal.cloth1; r[M.c2] = pal.cloth2; r[ML] = pal.lining || pal.accent; r[M.acc] = pal.accent; r[M.metal] = pal.metal;
      r[M.blush] = pal.ear || [pal.blush, pal.blush, pal.skin[2], pal.skin[3]];
      r[M.ink] = [pal.eye[3], pal.skin[3], pal.outline, pal.outline];
      r[MG] = pal.star || ['#ffffff', pal.accent[0], pal.accent[1], pal.metal[0]];
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
    var r = (h[1] + 17 - k[1]) / 8, f = d.ds && d.ds.drape;
    var across = (s === 'F' ? h[0] - k[0] : k[0] - h[0]);
    if (across > 2) r *= Math.max(0, 1 - (across - 2) / 4);
    if (f && f[s] != null && f[s] > r) r = f[s];
    return r < 0 ? 0 : (r > 1 ? 1 : r);
  }
  function limF(ch, i, sk) {
    var d = sk && (sk.d || sk); if (!d || !d.knF) return;
    if (raised(d, 'F') > 0.5) return;
    var q = lerp(d.hipF, d.knF, i === 1 ? 0.3 : 0.62);
    clampLink(ch, i, q[0] + 4.5, q[1], true);
  }
  function limB(ch, i, sk) {
    var d = sk && (sk.d || sk); if (!d || !d.knB) return;
    if (raised(d, 'B') > 0.5) return;
    var q = lerp(d.hipB, d.knB, i === 1 ? 0.3 : 0.62);
    clampLink(ch, i, q[0] - 4.5, q[1], false);
  }
  // a raised thigh lifts that side of the skirt: the hem lies over the thigh and hangs off it
  function drape(d, s, c0, c1, c2) {
    var r = raised(d, s);
    if (r <= 0) return [c1, c2];
    var h = s === 'F' ? d.hipF : d.hipB, k = s === 'F' ? d.knF : d.knB, dx = k[0] - h[0], dy = k[1] - h[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = dy / l, ny = -dx / l;
    if (ny > 0) { nx = -nx; ny = -ny; }
    var T = [h[0] + dx * 0.3 + nx * 4, h[1] + dy * 0.3 + ny * 4];
    var B = [h[0] + dx * 0.62 + nx * 2, h[1] + dy * 0.62 + ny * 2 + 3];
    void c0;
    return [lerp(c1, T, r), lerp(c2, B, r)];
  }

  // ------------------------------------------------------------------ chains
  var TAIL_N = 10, TAIL_LEN = [5, 5, 5, 5, 5, 5, 5, 5, 4.6, 4.2];
  // rest shape (deg added per link at arch 10): drops behind her, sweeps back, the tip curls up
  var TAIL_PROF = [0, 0, 4, 10, 20, 36, 58, 84, 110, 134];
  var TAIL_R = [1.8, 2.2, 2.6, 2.9, 3.1, 3.2, 3.2, 3.1, 2.9, 2.5, 1.8];
  var HAIR_GRAV = 0.24;
  C.chains = [
    { id: 'tail', n: TAIL_N, len: TAIL_LEN, rest: [116, 116, 120, 126, 136, 152, 174, 200, 226, 250], stiff: 0.55, damp: 0.74, grav: 0.02, drag: 0.22, hys: 0.6 },
    { id: 'hairA', n: 7, len: [10, 10, 10, 10, 10, 9, 9], rest: [100, 94, 92, 92, 95, 100, 108], stiff: [0.36, 0.3, 0.25, 0.21, 0.18, 0.15, 0.13], damp: 0.84, grav: HAIR_GRAV, drag: 0.3, cvel: 0.6 },
    { id: 'hairB', n: 6, len: [10, 10, 10, 10, 9, 9], rest: [120, 106, 100, 102, 112, 128], stiff: [0.36, 0.3, 0.24, 0.2, 0.16, 0.14], damp: 0.84, grav: HAIR_GRAV, drag: 0.3, cvel: 0.6 },
    { id: 'hairC', n: 6, len: [10, 10, 10, 9, 9, 8], rest: [92, 88, 86, 85, 84, 82], stiff: [0.38, 0.3, 0.24, 0.2, 0.16, 0.14], damp: 0.83, grav: HAIR_GRAV, drag: 0.3, cvel: 0.6 },
    { id: 'lockN', n: 4, len: [7, 7, 7, 6], rest: [84, 88, 92, 96], stiff: 0.32, damp: 0.8, grav: 0.22, drag: 0.25, cvel: 0.5 },
    { id: 'lockF', n: 3, len: [6, 6, 6], rest: [84, 88, 92], stiff: 0.34, damp: 0.8, grav: 0.22, drag: 0.25, cvel: 0.5 },
    { id: 'ahoge', n: 3, len: [4, 4, 3], rest: [-96, -40, 20], stiff: 0.5, damp: 0.7, grav: 0.03, drag: 0.14 },
    { id: 'sFb', n: 2, len: [5, 5], rest: [96, 102], stiff: [0.3, 0.24], damp: 0.84, grav: 0.24, drag: 0.42, cvel: 0.5 },
    { id: 'sBb', n: 2, len: [5, 5], rest: [96, 102], stiff: [0.3, 0.24], damp: 0.84, grav: 0.24, drag: 0.42, cvel: 0.5 },
    { id: 'hemF', n: 2, len: [8, 8], rest: [78, 84], stiff: [0.42, 0.36], damp: 0.78, grav: 0.2, drag: 0.32, limit: limF },
    { id: 'hemB', n: 2, len: [8, 8], rest: [106, 100], stiff: [0.42, 0.36], damp: 0.78, grav: 0.2, drag: 0.32, limit: limB },
    { id: 'cpN', n: 3, len: [12, 12, 12], rest: [94, 92, 91], stiff: [0.34, 0.28, 0.24], damp: 0.84, grav: 0.24, drag: 0.36, cvel: 0.4 },
    { id: 'cpF', n: 3, len: [12, 12, 12], rest: [98, 95, 93], stiff: [0.34, 0.28, 0.24], damp: 0.84, grav: 0.24, drag: 0.36, cvel: 0.4 },
    { id: 'chN', n: 1, len: [4], rest: [90], stiff: 0.2, damp: 0.8, grav: 0.3, drag: 0.3 },
    { id: 'chF', n: 1, len: [4], rest: [90], stiff: 0.2, damp: 0.8, grav: 0.3, drag: 0.3 },
    { id: 'pend', n: 2, len: [3, 3], rest: [90, 90], stiff: 0.25, damp: 0.8, grav: 0.3, drag: 0.3 },
    { id: 'stA', n: 1, len: [8], rest: [-90], stiff: 0.14, damp: 0.84, grav: 0, drag: 0.2, slack: 1, hys: 0.65 },
    { id: 'stB', n: 1, len: [6], rest: [-90], stiff: 0.2, damp: 0.84, grav: 0, drag: 0.2, slack: 1, hys: 0.65 },
    { id: 'stC', n: 1, len: [6], rest: [-90], stiff: 0.18, damp: 0.84, grav: 0, drag: 0.2, slack: 1, hys: 0.65 }
  ];
  function own(ch) {
    if (!ch._own) { ch.def = Object.assign({}, ch.def, { rest: ch.def.rest.slice() }); ch._own = true; }
    return ch;
  }

  // ------------------------------------------------------------------ pose-only geometry (anchors use it)
  var PV = [17, 27];
  function headPt(d, x, y) { return R0(fr(d.neck, d.headAng, x - PV[0], y - PV[1])); }
  function tailRoot(d) { return fr(d.pel, d.lean, -5, 3); }
  var TA = new Float64Array(TAIL_N);
  function tailAngles(d, out) {
    var a0 = 116 + d.tail + d.lean * 0.5, k = d.arch / 10, whip = d.pen;
    for (var i = 0; i < TAIL_N; i++) out[i] = a0 + TAIL_PROF[i] * k + (i >= 5 ? whip * (i - 4) : 0);
    return out;
  }
  function tailCurve(d) {
    var p = tailRoot(d), pts = [p];
    tailAngles(d, TA);
    for (var i = 0; i < TAIL_N; i++) { p = [p[0] + Math.cos(TA[i] * D2R) * TAIL_LEN[i], p[1] + Math.sin(TA[i] * D2R) * TAIL_LEN[i]]; pts.push(p); }
    return pts;
  }
  // lead drifting star: behind-above her rear shoulder (pose offset bk)
  function starTarget(d) {
    var b = d.bk || [0, 0];
    return [Math.round(d.neck[0] - 30 + b[0]), Math.round(d.neck[1] - 4 + b[1])];
  }

  // ------------------------------------------------------------------ flip (spins)
  var JK = ['pel', 'waist', 'chest', 'neck', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB',
    'hipF', 'knF', 'anF', 'ftF', 'hipB', 'knB', 'anB', 'ftB', 'bk'];
  function mir(sk, v) { return sk.flip ? [-v[0], v[1]] : v; }

  C.sigExtra = function (sk, s, n) {
    s[n++] = Math.round(sk.hemS != null ? sk.hemS : (sk.hem || 0)); s[n++] = Math.round(sk.tw || 0);
    s[n++] = Math.round((sk.book || 0) * 20); s[n++] = Math.round(sk.bko || 0);
    s[n++] = sk._tw | 0; s[n++] = sk._sd | 0;
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
  C.headCenter = function (sk) { return mir(sk, headPt(sk.d, 18, 20)); };
  C.headTop = function (sk) { return mir(sk, headPt(sk.d, 12, 5)); };     // ear tips (the head itself tops out 8 px lower)
  C.footPoint = function (sk, s) {
    var d = sk.d, f = s === 'F' ? d.ftF : d.ftB, a = s === 'F' ? d.faF : d.faB;
    return mir(sk, R0(fr(f, a, 2, -1)));
  };
  function tipOf(sk, w) {
    var d = sk.d;
    switch (w) {
      case 'fF': case 'fB': {
        var f = w === 'fF' ? d.ftF : d.ftB, a = w === 'fF' ? d.faF : d.faB;
        return R0(fr(f, a, 8, -2));
      }
      case 'heelF': case 'heelB': {
        var f2 = w === 'heelF' ? d.ftF : d.ftB, a2 = w === 'heelF' ? d.faF : d.faB;
        return R0(fr(f2, a2, -4.5, -2));
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
  C.defaultMuzzle = function (sk) { return mir(sk, tipOf(sk, 'hF')); };
  C.weaponPoint = function (sk) { return mir(sk, tipOf(sk, (sk.ds && sk.ds.weapon) || 'hF')); };
  C.extraAnchor = function (sk, name) {
    if (name === 'tail') return mir(sk, tipOf(sk, 'tail'));
    if (name === 'star') {
      var ds = sk.ds || {};
      if (ds.stars === 'hand') return mir(sk, tipOf(sk, 'hF'));
      return mir(sk, starTarget(sk.d));
    }
    return null;
  };
  C.partPoints = function (sk, part) {
    var d = sk.d || sk;
    switch (part) {
      case 'hF': { var a = tipOf(sk, 'hF'); return [d.elF[0], d.elF[1], a[0], a[1]]; }
      case 'hB': { var b = tipOf(sk, 'hB'); return [d.elB[0], d.elB[1], b[0], b[1]]; }
      case 'fF': { var t = tipOf(sk, 'fF'); return [d.knF[0], d.knF[1], t[0], t[1]]; }
      case 'fB': { var t2 = tipOf(sk, 'fB'); return [d.knB[0], d.knB[1], t2[0], t2[1]]; }
      case 'heelF': { var t3 = tipOf(sk, 'heelF'); return [d.knF[0], d.knF[1], t3[0], t3[1]]; }
      case 'heelB': { var t4 = tipOf(sk, 'heelB'); return [d.knB[0], d.knB[1], t4[0], t4[1]]; }
      case 'kF': return [d.hipF[0], d.hipF[1], d.knF[0], d.knF[1]];
      case 'tail': { var c = tailCurve(d); return [c[5][0], c[5][1], c[TAIL_N][0], c[TAIL_N][1]]; }
    }
    return [d.elF[0], d.elF[1], d.haF[0], d.haF[1]];
  };
  C.boundsExtra = function (sk) {
    var d = sk.d, c = tailCurve(d), o = [];
    o.push(mir(sk, R0(c[4])), mir(sk, R0(c[7])), mir(sk, R0(c[TAIL_N])));
    var hb = headPt(d, 4, 20);
    o.push(mir(sk, [hb[0] - 12, Math.min(-2, hb[1] + 60)]), mir(sk, [hb[0] - 4, hb[1]]));     // hair mass
    o.push(mir(sk, R0(fr(d.pel, d.lean, -10, 38))), mir(sk, R0(fr(d.pel, d.lean, 8, 14))));     // coat panels / skirt
    o.push(mir(sk, R0([d.haF[0] + 3, d.haF[1] + 14])), mir(sk, R0([d.haB[0] - 3, d.haB[1] + 14])));   // sleeve bells
    o.push(mir(sk, starTarget(d)));
    return o;
  };

  // ------------------------------------------------------------------ attach (every tick)
  C.attach = function (sk, sec, ds) {
    var d = sk.d || sk, by = sec.by, a = d.headAng, L = d.lean;
    ds = ds || d.ds || {};
    sec._ph = (sec._ph || 0) + 1;
    var ph = sec._ph;
    // tail: rest = pose curve + a lively cat sway (two waves; stronger toward the tip, the tip flicks)
    var tl = own(by.tail), tr = tailRoot(d), sw = 7 * (ds.tsw == null ? 1 : ds.tsw), p1 = ph * 0.075, p2 = ph * 0.19;
    tailAngles(d, TA);
    for (var i = 0; i < TAIL_N; i++) {
      var w = (0.15 + i * 0.1);
      tl.def.rest[i] = TA[i] + sw * (Math.sin(p1 - i * 0.5) * w + (i >= 6 ? 0.45 * Math.sin(p2 - i * 0.7) * (i - 5) * 0.4 : 0));
    }
    sec.attach('tail', tr[0], tr[1], 0);
    if (ds.tl) {
      var c = tailCurve(d);
      for (i = 0; i < c.length; i++) { tl.x[i] = tl.px[i] = c[i][0]; tl.y[i] = tl.py[i] = c[i][1]; }
    }
    // hair
    var hA = headPt(d, 6, 22), hB = headPt(d, 3, 18), hC = headPt(d, 9, 26), lk = headPt(d, 12, 26), lf = headPt(d, 25, 23), ah = headPt(d, 16, 12);
    var hd = ds.hd || 0, airy = ds.air ? 0.4 : 1;
    ['hairA', 'hairB', 'hairC', 'lockN', 'sFb', 'sBb', 'hemF', 'hemB', 'cpN', 'cpF'].forEach(function (id) {
      var ch = own(by[id]); if (ch._g0 == null) ch._g0 = ch.def.grav == null ? 0.25 : ch.def.grav;
      ch.def.grav = ch._g0 * airy;
    });
    sec.attach('hairA', hA[0], hA[1], a * 0.4 + hd);
    sec.attach('hairB', hB[0], hB[1], a * 0.4 + hd);
    sec.attach('hairC', hC[0], hC[1], a * 0.3 + hd * 0.8);
    sec.attach('lockN', lk[0], lk[1], a * 0.35);
    sec.attach('lockF', lf[0], lf[1], a * 0.35);
    sec.attach('ahoge', ah[0], ah[1], a);
    if (ds.hs) ['hairA', 'hairB', 'hairC', 'lockN', 'lockF', 'sFb', 'sBb', 'cpN', 'cpF'].forEach(function (id) {
      var ch = by[id]; if (!ch.ready) return;
      for (var j = 1; j < ch.n; j++) {
        var r = ch.restPos(j);
        ch.x[j] += (r[0] - ch.x[j]) * ds.hs; ch.y[j] += (r[1] - ch.y[j]) * ds.hs;
        ch.px[j] += (r[0] - ch.px[j]) * ds.hs; ch.py[j] += (r[1] - ch.py[j]) * ds.hs;
      }
    });
    // sleeve bags hang from under the elbow
    ['F', 'B'].forEach(function (s) {
      var g = sleeveFrame(d, s);
      sec.attach('s' + s + 'b', g.eb[0], g.eb[1], 0);
    });
    // hem lift eases in/out
    var ht = d.hem != null ? d.hem : (sk.hem || 0);
    sec._hem = sec._hem == null ? ht : sec._hem + (ht - sec._hem) * 0.35;
    if (Math.abs(sec._hem - ht) < 0.05) sec._hem = ht;
    sk.hemS = sec._hem;
    // skirt contours
    var fl = d.skirt || 0, F0 = fr(d.pel, L, 7, -4), B0 = fr(d.pel, L, -7, -4);
    var hf = own(by.hemF), hb = own(by.hemB);
    var rl = L * (0.4 + 0.6 * Math.min(1, Math.abs(L) / 90)) - (d.tw || 0);
    hf.def.rest[0] = 78 - fl * 44 + rl; hf.def.rest[1] = 84 - fl * 36 + rl;
    hb.def.rest[0] = 106 + fl * 44 + rl; hb.def.rest[1] = 100 + fl * 36 + rl;
    sec.attach('hemF', F0[0], F0[1], 0);
    sec.attach('hemB', B0[0], B0[1], 0);
    // coat-tail panels: hang from the hip sides; book = flare back/out, bko = lift
    var cf = (d.book || 0) * 46 + (d.bko || 0), cl = L * 0.5;
    var cn = own(by.cpN), cfar = own(by.cpF);
    cn.def.rest[0] = 110 + cf + cl; cn.def.rest[1] = 102 + cf * 0.9 + cl; cn.def.rest[2] = 97 + cf * 0.8 + cl;
    cfar.def.rest[0] = 112 + cf * 1.1 + cl; cfar.def.rest[1] = 104 + cf + cl; cfar.def.rest[2] = 99 + cf * 0.9 + cl;
    var PN = fr(d.pel, L * 0.6, -7, -4), PF = fr(d.pel, L * 0.6, -10, -5);
    sec.attach('cpN', PN[0], PN[1], 0);
    sec.attach('cpF', PF[0], PF[1], 0);
    var tn = H.chainPts(by.cpN), tf = H.chainPts(by.cpF);
    sec.attach('chN', tn[3][0], tn[3][1], 0);
    sec.attach('chF', tf[3][0], tf[3][1], 0);
    // chain-belt star pendant (front hip)
    var pp = fr(d.pel, L * 0.6, 5, -1);
    sec.attach('pend', pp[0], pp[1], 0);
    // drifting stars: lead star near the target, one orbiting her upper body, one small one over the lead hand
    var st = starTarget(d), b1 = Math.sin(ph * 0.05) * 2, ch2 = d.chest;
    if (ds.stars === 'hand') {
      var ht2 = tipOf(sk, 'hF');
      st = [ht2[0] + 2, ht2[1] - 6];
    }
    sec.attach('stA', st[0], st[1] + 8 + b1, 0);
    var ob = ph * 0.035;
    sk._sd = Math.sin(ob) > 0 ? 1 : 0;
    var oB = ds.stars === 'hand' ? [st[0] - 6 + Math.cos(ob * 3) * 6, st[1] + 2 + Math.sin(ob * 3) * 4] : [ch2[0] + Math.cos(ob) * 22, ch2[1] - 6 + Math.sin(ob) * 6];
    sec.attach('stB', oB[0], oB[1] + 6, 0);
    var oC = ds.stars === 'hand' ? [st[0] + 6, st[1] - 4 + Math.sin(ph * 0.08) * 2] : [ch2[0] + 18, ch2[1] - 26 + Math.sin(ph * 0.04 + 1) * 3];
    sec.attach('stC', oC[0], oC[1] + 6, 0);
    sk._tw = Math.floor(ph / 6) % 12;
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
    if (v > 0.8) p[1] += S.sag * Math.sin(Math.PI * Math.max(0, Math.min(1, s))) * (v - 0.8) / 0.2;
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
    var n = 6, prev = null;
    for (var k = 0; k <= n; k++) {
      var v = v0 + (v1 - v0) * k / n, q = R0(surf(S, typeof sfn === 'function' ? sfn(v) : sfn, v));
      if (prev) { if (dark) p.darkLine(prev[0], prev[1], q[0], q[1], 1); else p.line(prev[0], prev[1], q[0], q[1], c, onlyOn); }
      prev = q;
    }
  }
  function hLine(p, S, s0, s1, v, c, onlyOn, dash) {
    var n = 10, prev = null;
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
      var wv = amp * Math.sin(i * 1.9 + seed) * (0.4 + t);
      Lf.push([sub[i][0] + nx * (ww + wv), sub[i][1] + ny * (ww + wv)]);
      Rt.push([sub[i][0] - nx * (ww - wv * 0.7), sub[i][1] - ny * (ww - wv * 0.7)]);
    }
    var tipP = sub[n - 1];
    return { poly: H.flat(Lf.concat([[tipP[0] + (tipP[0] - sub[n - 2][0]) * 0.9, tipP[1] + (tipP[1] - sub[n - 2][1]) * 0.9]], Rt.reverse())), sub: sub, L: Lf, R: Rt };
  }
  function partPoly(wv, i0, i1, tip) {
    var n = wv.sub.length, a = Math.max(0, i0), b = Math.min(n - 1, i1);
    var L = wv.L.slice(a, b + 1), Rr = wv.R.slice(a, b + 1).reverse();
    if (tip && b === n - 1) { var tp = wv.sub[n - 1], pv = wv.sub[n - 2]; L.push([tp[0] + (tp[0] - pv[0]) * 0.9, tp[1] + (tp[1] - pv[1]) * 0.9]); }
    return H.flat(L.concat(Rr));
  }

  // ------------------------------------------------------------------ stars
  var starImgs = {};
  function starImg(size, shift) {
    var key = size + ':' + shift;
    if (starImgs[key]) return starImgs[key];
    var rows = I.ART.gemini.stars[size], lg = { '0': col(MG, 0) };
    for (var k = 1; k <= 3; k++) lg[String(k)] = col(MG, 1 + ((k - 1 + shift) % 3));
    var img = I.parseArt(rows, lg, (rows[0].length - 1) >> 1, (rows.length - 1) >> 1);
    return (starImgs[key] = img);
  }
  function drawStar(p, at, size, shift) { p.blit(starImg(size, shift % 3), Math.round(at[0]), Math.round(at[1])); }

  // ------------------------------------------------------------------ parts
  function drawHairLock(p, ch, w, amp, seed, strands, cuts, tone) {
    var pts = H.chainPts(ch), wv = wavy(pts, w, amp, seed), sub = wv.sub, n = sub.length, i;
    var t0 = tone || 0;
    p.poly(wv.poly, M.hair, null, 1 + (t0 > 1 ? 1 : 0));
    // shade band on the back side of the lock (volume)
    p.poly(H.flat(wv.L.concat(wv.L.map(function (q, k) { return lerp(q, wv.R[k], 0.22); }).reverse())), M.hair, null, 2 + t0 > 3 ? 3 : 2 + t0);
    // blue → violet → pink, dithered at the seams
    var c1 = Math.round(n * cuts[0]), c2 = Math.round(n * cuts[1]);
    H.recolor(p, partPoly(wv, c1, n - 1, true), M.hair, MV);
    H.recolor(p, partPoly(wv, c1, c1 + 1, false), MV, M.hair, true);
    H.recolor(p, partPoly(wv, c2, n - 1, true), MV, MP);
    H.recolor(p, partPoly(wv, c2, c2 + 1, false), MP, MV, true);
    var prev = null;
    for (i = 0; i < n; i++) {
      var q = R0(lerp(wv.L[i], wv.R[i], 0.12));
      if (prev) p.darkLine(prev[0], prev[1], q[0], q[1], 1);
      prev = q;
    }
    for (var s = 0; s < strands.length; s++) {
      prev = null;
      for (i = 1; i < n - 1; i++) {
        var q2 = R0(lerp(wv.L[i], wv.R[i], strands[s] + 0.1 * Math.sin(i * 1.3 + s)));
        if (prev && i > 1) p.darkLine(prev[0], prev[1], q2[0], q2[1], 1);
        prev = q2;
      }
    }
    // sheen: a short light streak near the top, and one in the violet part
    var h0 = R0(lerp(wv.L[1], wv.R[1], 0.7)), h1 = R0(lerp(wv.L[3], wv.R[3], 0.68));
    p.line(h0[0], h0[1], h1[0], h1[1], col(M.hair, 0), true);
    if (n > 8) {
      var k0 = Math.min(n - 3, c1 + 1), g0 = R0(lerp(wv.L[k0], wv.R[k0], 0.66)), g1 = R0(lerp(wv.L[k0 + 2], wv.R[k0 + 2], 0.62));
      p.line(g0[0], g0[1], g1[0], g1[1], col(MV, 0), true);
    }
  }

  // fluffy cat tail: thick capsules, fur tufts along both sides, blue → violet toward the tip
  function drawTail(p, sk, sec, ds) {
    var pts = ds.tl ? tailCurve(sk) : H.chainPts(sec.tail), i;
    pts = H.chaikin(pts);
    var m = pts.length, rr = [];
    for (i = 0; i < m; i++) { var u = i / (m - 1) * (TAIL_R.length - 1), k = Math.floor(u), f = u - k; rr.push(k + 1 < TAIL_R.length ? TAIL_R[k] + (TAIL_R[k + 1] - TAIL_R[k]) * f : TAIL_R[k]); }
    for (i = 0; i < m - 1; i++) p.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rr[i], rr[i + 1], M.hair, SH.thick, 1);
    // fur tufts: small swept-back triangles alternating sides
    for (i = 3; i < m - 1; i += 2) {
      var a = pts[i - 1], b = pts[i + 1], dd = norm(b[0] - a[0], b[1] - a[1]), dx = dd[0], dy = dd[1];
      var side = (i >> 1) & 1 ? 1 : -1, nx = -dy * side, ny = dx * side, r = rr[i];
      if (ny > 0.3) continue;
      var q0 = [pts[i][0] + nx * (r - 1) + dx * 1.5, pts[i][1] + ny * (r - 1) + dy * 1.5];
      var q1 = [pts[i][0] + nx * (r + 1.6) - dx * 1.4, pts[i][1] + ny * (r + 1.6) - dy * 1.4];
      var q2 = [pts[i][0] + nx * (r - 1) - dx * 2, pts[i][1] + ny * (r - 1) - dy * 2];
      p.poly(H.flat([q0, q1, q2]), M.hair, null, side > 0 ? 1 : 2);
    }
    // fluffy tip tuft
    var e = pts[m - 1], e0 = pts[m - 2], de = norm(e[0] - e0[0], e[1] - e0[1]);
    p.poly(H.flat([[e[0] - de[1] * 2.6, e[1] + de[0] * 2.6], [e[0] + de[0] * 3.5, e[1] + de[1] * 3.5], [e[0] + de[1] * 2.6, e[1] - de[0] * 2.6]]), M.hair, null, 1);
    // gradient: violet over the outer 45 %, dithered seam
    var cut = Math.floor(m * 0.66), poly = [], j;
    function sidePts(i0, i1, sg) {
      var o = [];
      for (j = i0; j <= i1; j++) {
        var A = pts[Math.max(0, j - 1)], B = pts[Math.min(m - 1, j + 1)], q = norm(B[0] - A[0], B[1] - A[1]), rad = rr[j] + 3;
        o.push([pts[j][0] - q[1] * rad * sg, pts[j][1] + q[0] * rad * sg]);
      }
      return o;
    }
    var Lp = sidePts(cut, m - 1, 1), Rp = sidePts(cut, m - 1, -1);
    poly = H.flat(Lp.concat([[e[0] + de[0] * 6, e[1] + de[1] * 6]], Rp.reverse()));
    H.recolor(p, poly, M.hair, MV);
    var Ld = sidePts(cut, cut + 1, 1), Rd = sidePts(cut, cut + 1, -1);
    H.recolor(p, H.flat(Ld.concat(Rd.reverse())), MV, M.hair, true);
    // lit ridge along the upper side
    for (i = 1; i < m - 2; i++) {
      var Aa = pts[i], Bb2 = pts[i + 1], qq = norm(Bb2[0] - Aa[0], Bb2[1] - Aa[1]), sgn = qq[0] <= 0 ? 1 : -1, rr0 = rr[i] - 1, rr1 = rr[i + 1] - 1;
      ln(p, [Aa[0] + qq[1] * rr0 * sgn, Aa[1] - qq[0] * rr0 * sgn], [Bb2[0] + qq[1] * rr1 * sgn, Bb2[1] - qq[0] * rr1 * sgn], col(i >= cut ? MV : M.hair, 0), true);
    }
    // light fur streaks on the upper side, a dark crease on the underside
    for (i = 2; i < m - 3; i += 3) {
      var A2 = pts[i], B2 = pts[i + 1], q3 = norm(B2[0] - A2[0], B2[1] - A2[1]), up = q3[0] >= 0 ? -1 : 1;
      var o0 = [A2[0] - q3[1] * rr[i] * 0.5 * up, A2[1] + q3[0] * rr[i] * 0.5 * up];
      ln(p, o0, [o0[0] + q3[0] * 2, o0[1] + q3[1] * 2], col(i > cut ? MV : M.hair, 0), true);
    }
  }

  // sleeve frame: band on the upper arm, elbow, wrist; n = forearm normal pointing up
  function sleeveFrame(d, s) {
    var sh = s === 'F' ? d.shF : d.shB, el = s === 'F' ? d.elF : d.elB, ha = s === 'F' ? d.haF : d.haB;
    var e = norm(ha[0] - el[0], ha[1] - el[1]), n = [-e[1], e[0]];
    if (n[1] > 0 || (Math.abs(n[1]) < 0.2 && n[0] > 0)) n = [-n[0], -n[1]];
    var u = norm(el[0] - sh[0], el[1] - sh[1]), un = [-u[1], u[0]];
    if (un[1] > 0 || (Math.abs(un[1]) < 0.2 && un[0] > 0)) un = [-un[0], -un[1]];
    var band = lerp(sh, el, 0.45);
    return { sh: sh, el: el, ha: ha, e: e, n: n, u: u, un: un, band: band, eb: [ha[0] + e[0] * 2.5 - n[0] * 4, ha[1] + e[1] * 2.5 - n[1] * 4] };
  }
  function drawArmSkin(p, sk, s) {
    var sh = s === 'F' ? sk.shF : sk.shB, el = s === 'F' ? sk.elF : sk.elB, ha = s === 'F' ? sk.haF : sk.haB, t = s === 'F' ? 1 : 2;
    p.cap(sh[0], sh[1], el[0], el[1], 2.3, 1.9, M.skin, SH.limbL, t);
    p.cap(el[0], el[1], ha[0], ha[1], 1.9, 1.5, M.skin, SH.limbL, t);
    p.ell(sh[0] - 0.5, sh[1] + 0.5, 2.5, 2.4, M.skin, SH.body, t);
  }
  function drawSleeve(p, sk, sec, s) {
    var g = sleeveFrame(sk, s), t = s === 'F' ? 1 : 2, bag = H.chainPts(sec['s' + s + 'b']), t0 = t - 1;
    var A = [g.band[0] + g.un[0] * 2.4, g.band[1] + g.un[1] * 2.4], A2 = [g.band[0] - g.un[0] * 2.4, g.band[1] - g.un[1] * 2.4];
    var Bt = [g.el[0] + g.n[0] * 2.8, g.el[1] + g.n[1] * 2.8], Bb = [g.el[0] - g.n[0] * 3.2, g.el[1] - g.n[1] * 3.2];
    var W = [g.ha[0] + g.e[0] * 2.5, g.ha[1] + g.e[1] * 2.5];
    var Ct = [W[0] + g.n[0] * 4.4, W[1] + g.n[1] * 4.4], Dt = bag[0], E1 = bag[1], E2 = bag[2];
    var Lw = [lerp(Bb, E2, 0.55)[0], lerp(Bb, E2, 0.55)[1] + 2];     // the lower edge sags between elbow and corner
    p.poly(H.flat([A, Bt, Ct, Dt, E1, E2, Lw, Bb, A2]), M.c2, SH.soft, t0);
    p.poly(H.flat([lerp(A, A2, 0.5), lerp(Bt, Bb, 0.55), lerp(Ct, E2, 0.6), E2, Lw, Bb, A2]), M.c2, null, t);
    // the mouth of the bell: violet lining crescent, then a white cuff band, gold trim on the rim
    var m0 = lerp(Ct, Dt, 0.5), m1 = lerp(Dt, E2, 0.5);
    p.poly(H.flat([lerp(Ct, Bt, 0.3), Ct, Dt, E1, E2, lerp(E2, Lw, 0.35), lerp(m1, Lw, 0.42), lerp(m0, Bt, 0.42)]), M.c1, null, t0);
    p.poly(H.flat([m0, Dt, E1, E2, lerp(m1, Lw, 0.12)]), ML, null, t);
    ln(p, Ct, Dt, col(M.metal, 1), true); ln(p, Dt, E1, col(M.metal, 1), true); ln(p, E1, E2, col(M.metal, 2), true);
    ln(p, lerp(Ct, Bt, 0.34), lerp(E2, Lw, 0.38), col(M.metal, 2), true);
    // folds + a sheen along the top
    dl(p, lerp(Bt, Bb, 0.5), lerp(Ct, E2, 0.6));
    dl(p, lerp(A, A2, 0.6), lerp(Lw, E2, 0.3));
    ln(p, lerp(A, Bt, 0.4), lerp(Bt, Ct, 0.45), col(M.c2, 0), true);
    // white top band where the sleeve is tied on (gold edge)
    p.cap(A[0], A[1], A2[0], A2[1], 1.2, 1.2, M.c1, null, t0);
    var b0 = [g.band[0] + g.u[0] * 1.6, g.band[1] + g.u[1] * 1.6];
    ln(p, [b0[0] + g.un[0] * 2.4, b0[1] + g.un[1] * 2.4], [b0[0] - g.un[0] * 2.4, b0[1] - g.un[1] * 2.4], col(M.metal, 1), true);
  }
  function drawHand(p, sk, s, ds) {
    var el = s === 'F' ? sk.elF : sk.elB, ha = s === 'F' ? sk.haF : sk.haB;
    var ang = s === 'F' ? sk.handAngF : sk.handAngB, shape = s === 'F' ? ds.handF : ds.handB;
    var e = norm(ha[0] - el[0], ha[1] - el[1]);
    H.hand(p, [ha[0] + e[0] * 0.5, ha[1] + e[1] * 0.5], ang, shape || 'paw', M.skin, M.skin, I.ART.gemini.hands);
  }
  // pink glow on the claw tips (ds.claw)
  function drawClawGlow(p, sk, s) {
    var ha = s === 'F' ? sk.haF : sk.haB, ang = (s === 'F' ? sk.handAngF : sk.handAngB) * D2R;
    var ux = Math.cos(ang), uy = Math.sin(ang);
    for (var k = -1; k <= 1; k++) {
      var b = [ha[0] + ux * 5 - uy * k * 1.7, ha[1] + uy * 5 + ux * k * 1.7], tp = [b[0] + ux * 4 - uy * k * 0.9, b[1] + uy * 4 + ux * k * 0.9];
      ln(p, b, tp, col(M.acc, k === 0 ? 0 : 1));
    }
  }

  // leg: bare thigh, navy sock band under the knee, slouchy white leg warmer, chunky platform shoe
  function drawLeg(p, sk, s, lockOff, strap) {
    var hip = s === 'F' ? sk.hipF : sk.hipB, kn = s === 'F' ? sk.knF : sk.knB;
    var an = s === 'F' ? sk.anF : sk.anB, ft = s === 'F' ? sk.ftF : sk.ftB, fa = s === 'F' ? sk.faF : sk.faB;
    var lo = lockOff || 0, t = s === 'F' ? 1 : 2;
    an = [an[0] + lo, an[1]]; ft = [ft[0] + lo, ft[1]];
    p.cap(hip[0], hip[1], kn[0], kn[1], 3.8, 2.6, M.skin, SH.limbL, t);
    // shin: navy sock, then the leg warmer from a third of the way down
    p.cap(kn[0], kn[1], an[0], an[1], 2.5, 1.8, M.c2, SH.limb, t);
    var sd = norm(an[0] - kn[0], an[1] - kn[1]), sl = Math.sqrt((an[0] - kn[0]) * (an[0] - kn[0]) + (an[1] - kn[1]) * (an[1] - kn[1]));
    p.cap(kn[0] - sd[1] * 0.4, kn[1] + sd[0] * 0.4, kn[0] + sd[0] * 3, kn[1] + sd[1] * 3, 2.6, 2.4, M.skin, SH.limbL, t);  // knee cap
    var w0 = lerp(kn, an, 0.3), w1 = lerp(kn, an, 0.98);
    p.cap(w0[0], w0[1], w1[0], w1[1], 2.8, 3.4, M.c1, SH.limbL, t);
    var wb = [an[0] + sd[0] * 0.5, an[1] + sd[1] * 0.5];
    p.ell(wb[0] - 0.5, wb[1] - 1, 3.7, 2.4, M.c1, SH.soft, t);       // slouch over the shoe
    // ribs + scrunch folds
    var nx = -sd[1], ny = sd[0];
    for (var k = 0; k < 3; k++) {
      var q = lerp(w0, w1, 0.25 + k * 0.25);
      dl(p, [q[0] + nx * 2.5 - sd[0] * 0.5, q[1] + ny * 2.5 - sd[1] * 0.5], [q[0] - nx * 2.5 + sd[0] * 0.5, q[1] - ny * 2.5 + sd[1] * 0.5]);
    }
    ln(p, [w0[0] + nx * 2.6, w0[1] + ny * 2.6], [w0[0] - nx * 2.6, w0[1] - ny * 2.6], col(M.c1, 0), true);
    void sl;
    if (strap) {     // thigh strap: navy band, gold ring, tiny star charm
      var gq = lerp(hip, kn, 0.62), tx = kn[0] - hip[0], ty = kn[1] - hip[1], tl = Math.sqrt(tx * tx + ty * ty) || 1, gx = -ty / tl * 3.4, gy = tx / tl * 3.4;
      ln(p, [gq[0] + gx, gq[1] + gy], [gq[0] - gx, gq[1] - gy], col(M.c2, 1), true);
      ln(p, [gq[0] + gx + tx / tl, gq[1] + gy + ty / tl], [gq[0] - gx + tx / tl, gq[1] - gy + ty / tl], col(M.c2, 2), true);
      var rg = R0([gq[0] - gx * 0.75, gq[1] - gy * 0.75]);
      p.pxOn(rg[0], rg[1], col(M.metal, 0));
    }
    // platform shoe (relative to the sole point, rotated by the foot pitch): thick violet sole, navy upper, round toe
    var sole = [[-4.5, 0], [7, 0], [8.4, -1.2], [8.6, -3], [-4.6, -3]];
    var up = [[-4.4, -3], [8.4, -3], [8.2, -5], [6.5, -6.8], [3.5, -7.6], [0.5, -8.8], [-2.5, -9], [-4.4, -8]];
    var P1 = [], P2 = [], i;
    for (i = 0; i < sole.length; i++) { var a = fr(ft, fa, sole[i][0], sole[i][1]); P1.push(a[0], a[1]); }
    for (i = 0; i < up.length; i++) { var b = fr(ft, fa, up[i][0], up[i][1]); P2.push(b[0], b[1]); }
    p.poly(P1, ML, SH.soft, t);
    p.poly(P2, M.c2, SH.limbL, t);
    ln(p, fr(ft, fa, -4, -2), fr(ft, fa, 7.6, -2), col(ML, t - 1), true);            // sole stripe
    ln(p, fr(ft, fa, -4.4, -3), fr(ft, fa, 8.2, -3), col(M.metal, 1), true);         // gold welt
    var tg = R0(fr(ft, fa, 6, -5.5)); p.pxOn(tg[0], tg[1], col(M.c2, 0));            // toe shine
    var bw = R0(fr(ft, fa, 2.5, -7.4));                                              // strap buckle
    p.pxOn(bw[0], bw[1], col(M.metal, 0)); p.pxOn(bw[0] + 1, bw[1], col(M.metal, 2));
  }

  function skirtSurf(sk, sec, hu, ext) {
    var W = sk.waist, wa = sk.lean * 0.7 + sk.chestAng * 0.3, hf = H.chainPts(sec.hemF), hb = H.chainPts(sec.hemB);
    var df = drape(sk, 'F', hf[0], hf[1], hf[2]), db = drape(sk, 'B', hb[0], hb[1], hb[2]);
    if (hu) { df = [df[0], [df[1][0], df[1][1] - hu]]; db = [db[0], [db[1][0], db[1][1] - hu]]; }
    if (ext) {
      var ef = norm(df[1][0] - df[0][0], df[1][1] - df[0][1]), eb = norm(db[1][0] - db[0][0], db[1][1] - db[0][1]);
      df = [df[0], [df[1][0] + ef[0] * ext, df[1][1] + ef[1] * ext]]; db = [db[0], [db[1][0] + eb[0] * ext, db[1][1] + eb[1] * ext]];
    }
    return {
      f: plMake([fr(W, wa, 4.5, 3), hf[0], df[0], df[1]]),
      b: plMake([fr(W, wa, -5, 3), hb[0], db[0], db[1]]),
      sag: 1.5
    };
  }
  // white frilled petticoat: scalloped hem peeking below the navy layer
  function drawPetticoat(p, S) {
    p.poly(band(S, 0, 1, 0.25, 1, 4), M.c1, null, 1);
    p.poly(band(S, 0.55, 1, 0.3, 1, 3), M.c1, null, 2);
    for (var k = 0; k <= 10; k++) {
      var q = surf(S, -0.02 + 1.04 * k / 10, 1);
      p.ell(q[0] - 0.5, q[1] - 0.6, 1.6, 1.3, M.c1, null, k & 1 ? 1 : 2);
    }
    hLine(p, S, 0.02, 0.98, 0.86, col(M.c1, 3), true, true);
  }
  // navy overskirt: open at the very front (petticoat shows), gold-trimmed hem and front edge, pleats
  var SF = function (v) { return 0.16 - 0.1 * v; };
  function drawOverskirt(p, S) {
    p.poly(band(S, SF, 1, 0, 1, 4), M.c2, SH.soft, 1);
    p.poly(band(S, function (v) { return 0.68 + 0.04 * v; }, 1, 0.05, 1, 3), M.c2, null, 2);
    sLine(p, S, function (v) { return 0.42 + 0.06 * v; }, 0.2, 1, 0, true, true);
    sLine(p, S, function (v) { return 0.78 + 0.03 * v; }, 0.2, 1, 0, true, true);
    sLine(p, S, function (v) { return 0.3 + 0.1 * v; }, 0.25, 0.95, col(M.c2, 0), true);
    hLine(p, S, SF(0.95), 1, 0.92, col(M.metal, 1), true);
    sLine(p, S, function (v) { return SF(v) + 0.02; }, 0.05, 0.93, col(M.metal, 1), true);
    var sp = R0(surf(S, 0.5, 0.85));
    p.pxOn(sp[0], sp[1], col(MG, 0));        // a tiny sparkle stitched on the navy
  }
  function drawBelt(p, sk, sec) {
    var W = sk.waist, wa = sk.lean * 0.7 + sk.chestAng * 0.3, L = sk.lean;
    // waistband (navy) + gold chain slung low across the hips
    var a = fr(W, wa, -5.5, 3), b = fr(W, wa, 5, 3);
    p.cap(a[0], a[1], b[0], b[1], 1.3, 1.3, M.c2, null, 2);
    var c0 = fr(W, wa, -5.5, 4.5), c2 = fr(sk.pel, L * 0.6, 5.5, -1), cm = lerp(c0, c2, 0.5);
    cm = [cm[0], cm[1] + 1.5];
    var pts = [c0, cm, c2];
    for (var k = 0; k < 2; k++) {
      for (var i = 0; i < 5; i++) {
        var q = R0(lerp(pts[k], pts[k + 1], i / 5));
        p.px(q[0], q[1], col(M.metal, i & 1 ? 2 : 0));
        p.pxOn(q[0], q[1] + 1, col(M.metal, 3));
      }
    }
    // star pendant on the front hip (swings: chain 'pend')
    var pc = H.chainPts(sec.pend);
    ln(p, pc[0], pc[1], col(M.metal, 1)); ln(p, pc[1], pc[2], col(M.metal, 2));
    p.end();
    drawStar(p, [pc[2][0], pc[2][1] + 2], 's3', (sk._tw || 0) + 1);
    p.end({ hard: true });
  }

  function drawCoat(p, sk, sec, which) {
    var ch = sec[which], pts = H.chainPts(ch), t = which === 'cpN' ? 1 : 2;
    var w = [2.8, 3.6, 4.2, 4.4], L = [], Rr = [], i;
    for (i = 0; i < pts.length; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], q = norm(b[0] - a[0], b[1] - a[1]);
      L.push([pts[i][0] - q[1] * w[i], pts[i][1] + q[0] * w[i]]);
      Rr.push([pts[i][0] + q[1] * w[i], pts[i][1] - q[0] * w[i]]);
    }
    var n = pts.length - 1, e = norm(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]);
    var tip = [pts[n][0] + e[0] * 4, pts[n][1] + e[1] * 4];
    // the outer edge (L, toward the back) ends higher: a slanted, pointed hem
    var poly = L.slice(0, n).concat([lerp(L[n], pts[n], 0.2), tip, Rr[n]], Rr.slice(0, n).reverse());
    p.poly(H.flat(poly), M.c2, SH.soft, t);
    // violet lining along the inner edge + gold trim
    var inner = Rr.map(function (q, k) { return lerp(q, pts[k], 0.35); });
    p.poly(H.flat(Rr.concat([tip], inner.reverse())), ML, null, t);
    for (i = 0; i < n; i++) ln(p, L[i], L[i + 1], col(M.metal, 2), true);
    ln(p, Rr[n], tip, col(M.metal, 1), true);
    ln(p, lerp(L[n], pts[n], 0.2), tip, col(M.metal, 1), true);
    dl(p, lerp(L[1], Rr[1], 0.5), lerp(L[n], Rr[n], 0.45));
    p.end();
    // star charm on a short chain at the tip
    var cc = H.chainPts(sec[which === 'cpN' ? 'chN' : 'chF']);
    ln(p, tip, cc[1], col(M.metal, 1));
    p.end({ outline: false });
    drawStar(p, [cc[1][0], cc[1][1] + 1], 's3', (sk._tw || 0) + (t === 1 ? 0 : 2));
    p.end({ hard: true });
  }

  function drawTorso(p, sk) {
    var c = sk.chest, ca = sk.chestAng, W = sk.waist, wa = sk.lean * 0.6 + ca * 0.4;
    // neck
    p.cap(c[0] + 0.5, c[1] + 1, sk.neck[0] - 0.5, sk.neck[1], 1.7, 1.6, M.skin, null, 2);
    // bare torso (skin): shoulders → slim waist
    var body = H.flat([fr(c, ca, -3, 0), fr(c, ca, -5.5, 1.5), fr(c, ca, -6, 6), fr(c, ca, -5, 11), fr(W, wa, -4.2, 0), fr(W, wa, -4.8, 3.5),
      fr(W, wa, 4.4, 3.5), fr(W, wa, 3.8, 0), fr(c, ca, 4.6, 12), fr(c, ca, 5.8, 8.5), fr(c, ca, 5.2, 4.5), fr(c, ca, 3.5, 1), fr(c, ca, 1.5, -0.5)]);
    p.poly(body, M.skin, SH.body);
    // navel + a hint of the ribcage/waist shading
    var nv = R0(fr(W, wa, 2.2, 0.5)); p.darken(nv[0], nv[1], 1);
    dl(p, fr(c, ca, -5.5, 8), fr(W, wa, -4.2, -1));
    // cropped navy halter top: from the halter neck over the bust, ends under the bust
    var top = H.flat([fr(c, ca, 0, -0.5), fr(c, ca, 2.6, 0.5), fr(c, ca, 5, 4.2), fr(c, ca, 6, 8.2), fr(c, ca, 4.6, 10.6), fr(c, ca, 0, 11),
      fr(c, ca, -5, 10.2), fr(c, ca, -5.6, 6.5), fr(c, ca, -3, 5.5), fr(c, ca, -1, 2.5)]);
    p.poly(top, M.c2, SH.body);
    // violet band under the bust, white halter strap, gold edge
    ln(p, fr(c, ca, -5, 9.6), fr(c, ca, 4.6, 10), col(ML, 1), true);
    ln(p, fr(c, ca, -5, 10.4), fr(c, ca, 4.4, 10.8), col(ML, 2), true);
    ln(p, fr(c, ca, -0.6, 0), fr(c, ca, 4.6, 4.6), col(M.c1, 1), true);
    ln(p, fr(c, ca, -1.6, 0.8), fr(c, ca, 3.8, 5.4), col(M.metal, 2), true);
    ln(p, fr(c, ca, -5.4, 6.4), fr(c, ca, -3, 5.6), col(M.c2, 0), true);
    // centre-front: a small star gem low on the top
    var g = R0(fr(c, ca, 3.2, 8));
    p.pxOn(g[0], g[1] - 1, col(MG, 1)); p.pxOn(g[0] - 1, g[1], col(MG, 2)); p.pxOn(g[0] + 1, g[1], col(MG, 3)); p.pxOn(g[0], g[1] + 1, col(MG, 2)); p.pxOn(g[0], g[1], col(MG, 0));
  }
  function drawCollar(p, sk) {
    var c = sk.chest, ca = sk.chestAng, n = sk.neck;
    // white choker-halter band around the neck with a gold star clasp
    var a0 = lerp(c, n, 0.35);
    ln(p, fr(a0, ca, -2, 0), fr(a0, ca, 2.2, -0.3), col(M.c1, 1));
    var g = R0(fr(a0, ca, 2, 0.6));
    p.pxOn(g[0], g[1], col(M.metal, 0));
    p.px(g[0], g[1] + 1, col(M.metal, 1));
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

  function drawStars(p, sec, sk, front) {
    var s = sk._tw || 0;
    var A = H.chainPts(sec.stA)[1], B = H.chainPts(sec.stB)[1], Cc = H.chainPts(sec.stC)[1];
    if (front) {
      drawStar(p, A, (s % 6) < 2 ? 's7' : 's5', s);
      drawStar(p, Cc, 's3', s + 1);
      if (sk._sd) drawStar(p, B, 's3', s + 2);
    } else if (!sk._sd) drawStar(p, B, 's3', s + 2);
    p.end({ hard: true });
  }

  C.draw = function (D) {
    var p = D.p, sk0 = D.sk, d = sk0.d || sk0, ds = D.ds, sec = D.sec, z = ds.z || {};
    if (ds.only === 'star') {      // blink: nothing but a star glint at her centre
      var cc = [Math.round((sk0.neck[0] + sk0.pel[0]) / 2), Math.round((sk0.neck[1] + sk0.pel[1]) / 2)];
      drawStar(p, cc, ds.onlySize || 's9', sk0._tw || 0); p.end({ hard: true });
      return;
    }
    var eyes = ds.eyes || 'open';
    if (D.blink && (eyes === 'open' || eyes === 'focus' || eyes === 'sad' || eyes === 'wide')) eyes = (D.blink > 5 || D.blink < 3) ? 'half' : 'closed';
    var hu = -Math.round(sk0.hemS != null ? sk0.hemS : (sk0.hem || 0));
    var S = skirtSurf(d, sec, hu, 0), S2 = skirtSurf(d, sec, hu, 3);
    var lockF = sk0.flip ? 0 : D.lock.F, lockB = sk0.flip ? 0 : D.lock.B;
    var showStars = ds.stars !== 0;
    var steps = [
      [-13, function () { if (showStars) drawStars(p, sec, sk0, false); }],
      [z.hair != null ? z.hair : -11, function () {
        drawHairLock(p, sec.hairB, [6, 3.5, 4], 2.6, 1.9, [0.35, 0.7], [0.36, 0.68], 1); p.end();
        drawHairLock(p, sec.hairA, [7, 4, 5], 2.8, 0.3, [0.3, 0.55, 0.8], [0.34, 0.66], 0); p.end();
      }],
      [-10, function () { drawCoat(p, d, sec, 'cpF'); }],
      [-9.5, function () { drawHairLock(p, sec.hairC, [5, 2.5, 3], 2.2, 3.1, [0.4, 0.75], [0.38, 0.7], 0); p.end(); }],
      [z.armB != null ? z.armB : -7, function () { drawArmSkin(p, d, 'B'); p.end(); drawSleeve(p, d, sec, 'B'); p.end(); drawHand(p, d, 'B', ds); p.end(); }],
      [z.legB != null ? z.legB : -4, function () { drawLeg(p, d, 'B', lockB, false); p.end(); }],
      [z.tail != null ? z.tail : -4.5, function () { drawTail(p, d, sec, ds); p.end(); }],
      [z.coatN != null ? z.coatN : -3, function () { drawCoat(p, d, sec, 'cpN'); }],
      [z.legF != null ? z.legF : -1.5, function () { drawLeg(p, d, 'F', lockF, true); p.end(); }],
      [-1, function () { drawPetticoat(p, S2); p.end(); drawOverskirt(p, S); p.end(); }],
      [-0.5, function () { drawBelt(p, d, sec); }],
      [0, function () { drawTorso(p, d); p.end(); }],
      [0.5, function () { drawCollar(p, d); p.end(); }],
      [2, function () {
        var img = H.headImage(C.headSet, eyes, ds.mouth || 'neutral', (ds.blush ? 'blush' : '') + (ds.ears === 'flat' ? (ds.blush ? ',flat' : 'flat') : ''), d.headAng);
        p.blit(img, d.neck[0], d.neck[1]);
        var ah = H.chainPts(sec.ahoge);
        p.cap(ah[0][0], ah[0][1] + 1, ah[1][0], ah[1][1], 0.9, 0.8, M.hair, null);
        p.cap(ah[1][0], ah[1][1], ah[2][0], ah[2][1], 0.8, 0.6, M.hair, null);
        p.cap(ah[2][0], ah[2][1], ah[3][0], ah[3][1], 0.6, 0.5, M.hair, null, 0);
        p.end();
        drawStar(p, headPt(d, 4, 14), 's7', (sk0._tw || 0) + 1); p.end({ hard: true });     // star clip on the bun
      }],
      [2.5, function () { drawHairLock(p, sec.lockN, [2.8, 1.6, 1], 1, 0.7, [0.5], [0.55, 0.9], 0); p.end(); }],
      [1.5, function () { drawHairLock(p, sec.lockF, [1.8, 0.9, 0.6], 0.6, 2.2, [], [0.6, 0.95], 0); p.end(); }],
      [z.armF != null ? z.armF : 4, function () { drawArmSkin(p, d, 'F'); p.end(); drawSleeve(p, d, sec, 'F'); p.end(); }],
      [4.5, function () { if (D.smear) { H.smear2(p, D.smear, M.smear); p.end({ outline: false }); } }],
      [z.armF != null ? z.armF + 0.6 : 5, function () { drawHand(p, d, 'F', ds); p.end(); }],
      [5.5, function () {
        if (ds.claw) { if (ds.claw.indexOf('B') >= 0) drawClawGlow(p, d, 'B'); if (ds.claw.indexOf('F') >= 0) drawClawGlow(p, d, 'F'); p.end({ ring: col(M.acc, 3) }); }
      }],
      [6, function () { if (showStars) drawStars(p, sec, sk0, true); }]
    ];
    steps.sort(function (a, b) { return a[0] - b[0]; });
    p.fastTone = true;
    var prof = I._gemProf;
    try {
      for (var i = 0; i < steps.length; i++) {
        if (prof) { var t0 = performance.now(); steps[i][1](); prof[steps[i][0]] = (prof[steps[i][0]] || 0) + performance.now() - t0; } else steps[i][1]();
      }
    } finally { p.fastTone = false; }
    // grounded poses: nothing (hair, tail, panels) sinks more than 2 px into the floor
    if (!ds.air && p.my1 > I.OY + 3) {
      for (var y = Math.max(p.my0, I.OY + 3); y < p.my1; y++) p.m.fill(0, y * I.BW + p.mx0, y * I.BW + p.mx1);
    }
    if (sk0.flip) mirrorBuffer(p);
    // teleport dissolve: checker out 50 % / 75 % of the pixels
    if (ds.dith) {
      var BW = I.BW;
      for (var yy = p.my0; yy < p.my1; yy++) for (var xx = p.mx0; xx < p.mx1; xx++) {
        var k = (xx & 1) + ((yy & 1) << 1);
        if (ds.dith >= 2 ? k !== 0 : ((xx + yy) & 1)) p.m[yy * BW + xx] = 0;
      }
    }
  };

  C.build = function () { C.headSet = I.ART.gemini.build(); };
  // expose pose-only helpers for the anim files / tools
  C.geo = { tailCurve: tailCurve, starTarget: starTarget, tipOf: tipOf, sleeveFrame: sleeveFrame };
  I.CHARS.gemini = C;
})();
