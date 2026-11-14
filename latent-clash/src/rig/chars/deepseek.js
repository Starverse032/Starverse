/* LATENT CLASH — RIG: DeepSeek 娘 V2 (98 px, whale maid) body, chains, renderer.
 *
 * Materials (15 shared slots, re-purposed locally): hair = crown blue, white = hair
 * mid-gradient, tip = light inner layers / ends, c1 = white (apron, frills, cuffs,
 * tights), c2 = navy (dress, shoes), legs = `under` (light-blue pinstriped under-skirt),
 * shoe = `fin` (navy-grey whale tail and head fins), metal = gold (buttons, embroidery).
 *
 * DeepSeek-only pose fields (all optional):
 *   tail (deg, swings the whole tail; + = clockwise on screen), arch (curl deg per link,
 *   rest 16), pen (extra whip on the outer half), skirt (hem flare 0..1, <0 = cling),
 *   tl (1 = tail locked exactly to the pose curve, use on tail strikes), tsw (sway scale),
 *   flip (1 = this drawing faces left: whole sprite mirrored about x = 0; author the
 *   pose as if facing right — used for spins), weapon ('hF'|'hB'|'fF'|'fB'|'kF'|'kB'|'tail'),
 *   z: { tail, armF, armB, legF, legB, hair }.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col, SH = I.SH, H = I.H;
  var fr = H.fr, lerp = H.lerp, rot = H.rot;
  var MU = M.legs, MF = M.shoe, MG = M.white;     // under-skirt, fin, hair mid-gradient
  var D2R = Math.PI / 180;

  function hx(h) { var v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function mixHex(a, b, t) {
    var A = hx(a), B = hx(b), o = '#';
    for (var i = 0; i < 3; i++) { var c = Math.round(A[i] + (B[i] - A[i]) * t); o += (c < 16 ? '0' : '') + c.toString(16); }
    return o;
  }
  function lum(h) { var c = hx(h); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
  function R0(p) { return [Math.round(p[0]), Math.round(p[1])]; }

  var C = {
    id: 'deepseek', height: 98, crouchHeight: 66, width: 28,
    body: {
      spine: 29, waist: 11, neck: 8, upper: 15, fore: 13, thigh: 23, shin: 22, ankle: 3,
      shF: [2, 2], shB: [-4, 2], hipF: [3, 1], hipB: [-3, 1]
    },
    // lazy, loose stance: weight on the back leg, lead palm low and open, rear hand at the belly
    rest: {
      root: [0, 0], hip: [-1, -46], lean: 4, bend: -2, head: [0, 0], tilt: 3,
      hF: [15, -60], hB: [6, -56], fF: [11, 0], fB: [-10, 0], faF: 0, faB: 0,
      pen: 0, sq: 0, shr: 0, haF: 0, haB: 0, pg: 0, skirt: 0, tail: 0, arch: 16,
      eyes: 'open', mouth: 'smile', handF: 'open', handB: 'relax',
      elF: 1, elB: 1, knF: -1, knB: -1, glow: 0, blush: 0, z: {}
    },
    sigJoints: ['pel', 'waist', 'chest', 'neck', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB',
      'hipF', 'knF', 'anF', 'ftF', 'hipB', 'knB', 'anB', 'ftB'],
    ramps: function (pal) {
      var r = [], hr = pal.hair, ht = pal.hairTip;
      var tip = [ht[0], ht[1], mixHex(ht[1], hr[2], 0.5), mixHex(hr[2], hr[3], 0.4)];
      r[M.skin] = pal.skin; r[M.hair] = hr; r[M.tip] = tip;
      r[MG] = [mixHex(hr[0], ht[0], 0.45), mixHex(hr[1], ht[1], 0.45), mixHex(hr[2], ht[1], 0.3), hr[3]];
      r[M.eye] = pal.eye; r[M.c1] = pal.cloth1; r[M.c2] = pal.cloth2; r[M.acc] = pal.accent; r[M.metal] = pal.metal;
      r[M.blush] = [pal.blush, pal.blush, pal.skin[2], pal.skin[3]];
      r[MU] = pal.under || pal.cloth2;
      r[MF] = pal.fin || pal.hair;
      r[M.ink] = [pal.eye[3], pal.skin[3], pal.outline, pal.outline];
      r[M.glow] = ['#ffffff', pal.accent[0], pal.accent[1], pal.accent[2]];
      r[M.smear] = ['#ffffff', pal.accent[0], pal.accent[1], pal.accent[2]];
      return r;
    }
  };
  // shoes: whichever of the two cloth ramps is darker
  C.shoeMat = function (pal) { return lum(pal.cloth2[1]) < lum(pal.cloth1[1]) ? M.c2 : M.c1; };

  // ------------------------------------------------------------------ chains
  // skirt hem contours stay outside the legs
  function angOf(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax) / D2R; }
  function clampLink(ch, i, tx, ty, front) {
    var px = ch.x[i - 1], py = ch.y[i - 1], L = Array.isArray(ch.def.len) ? ch.def.len[i - 1] : ch.def.len;
    var a = angOf(px, py, ch.x[i], ch.y[i]), b = angOf(px, py, tx, ty);
    if (front ? a > b : a < b) { ch.x[i] = px + Math.cos(b * D2R) * L; ch.y[i] = py + Math.sin(b * D2R) * L; }
  }
  function limF(ch, i, sk) {
    var d = sk && (sk.d || sk); if (!d || !d.knF) return;
    if (i === 1) clampLink(ch, 1, d.knF[0] + 4, d.knF[1], true);
    else { clampLink(ch, 2, d.anF[0] + 4, d.anF[1] + 2, true); clampLink(ch, 2, d.knF[0] + 4, d.knF[1] + 6, true); }
  }
  function limB(ch, i, sk) {
    var d = sk && (sk.d || sk); if (!d || !d.knB) return;
    if (i === 1) clampLink(ch, 1, d.knB[0] - 4, d.knB[1], false);
    else { clampLink(ch, 2, d.anB[0] - 4, d.anB[1] + 2, false); clampLink(ch, 2, d.knB[0] - 4, d.knB[1] + 6, false); }
  }
  var TAIL_LEN = [6, 6, 6, 6, 5, 5, 5, 4];
  C.chains = [
    { id: 'tail', n: 8, len: TAIL_LEN, rest: [120, 136, 152, 168, 184, 200, 216, 232], stiff: 0.5, damp: 0.74, grav: 0.03, drag: 0.22, hys: 0.6 },
    { id: 'hairA', n: 4, len: [9, 9, 9, 8], rest: [104, 98, 94, 92], stiff: [0.34, 0.28, 0.22, 0.18], damp: 0.84, grav: 0.24, drag: 0.32 },
    { id: 'hairB', n: 4, len: [8, 8, 8, 7], rest: [97, 93, 91, 89], stiff: [0.36, 0.3, 0.24, 0.2], damp: 0.83, grav: 0.24, drag: 0.3 },
    { id: 'lockN', n: 3, len: [6, 6, 6], rest: [86, 90, 94], stiff: 0.32, damp: 0.8, grav: 0.22, drag: 0.25 },
    { id: 'ahoge', n: 3, len: [4, 4, 3], rest: [-95, -40, 20], stiff: 0.5, damp: 0.72, grav: 0.03, drag: 0.12 },
    { id: 'bowA', n: 3, len: [5, 5, 5], rest: [100, 104, 100], stiff: 0.22, damp: 0.82, grav: 0.22, drag: 0.35 },
    { id: 'bowB', n: 3, len: [5, 5, 4], rest: [112, 116, 110], stiff: 0.22, damp: 0.82, grav: 0.22, drag: 0.35 },
    { id: 'hemF', n: 2, len: [21, 21], rest: [78, 84], stiff: [0.4, 0.34], damp: 0.8, grav: 0.2, drag: 0.32, limit: limF },
    { id: 'hemB', n: 2, len: [21, 21], rest: [104, 98], stiff: [0.4, 0.34], damp: 0.8, grav: 0.2, drag: 0.32, limit: limB }
  ];
  // per-puppet def copy (rest angles are rewritten every tick from the pose)
  function own(ch) {
    if (!ch._own) { ch.def = Object.assign({}, ch.def, { rest: ch.def.rest.slice() }); ch._own = true; }
    return ch;
  }

  // ------------------------------------------------------------------ tail curve (pose only)
  function tailRoot(d) { return fr(d.pel, d.lean, -5, 1); }
  function tailAngles(d, out) {
    var a0 = 120 + d.tail + d.lean * 0.5, arch = d.arch, whip = d.pen;
    for (var i = 0; i < 8; i++) out[i] = a0 + arch * i + (i >= 4 ? whip * (i - 3) : 0);
    return out;
  }
  var TA = new Float64Array(8);
  function tailCurve(d) {
    var p = tailRoot(d), pts = [p];
    tailAngles(d, TA);
    for (var i = 0; i < 8; i++) { p = [p[0] + Math.cos(TA[i] * D2R) * TAIL_LEN[i], p[1] + Math.sin(TA[i] * D2R) * TAIL_LEN[i]]; pts.push(p); }
    return pts;
  }
  // fluke polygon at the end of a tail point list
  function fluke(pts) {
    var n = pts.length, a = pts[n - 2], b = pts[n - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= l; dy /= l;
    var nx = -dy, ny = dx;
    function q(u, v) { return [b[0] + dx * u + nx * v, b[1] + dy * u + ny * v]; }
    return {
      d: [dx, dy], nrm: [nx, ny], b: b,
      tips: [q(6, 11.5), q(6, -11.5)], mid: q(3.4, 0),
      poly: [q(-2.5, 2.4), q(0.5, 6.5), q(3, 10), q(6, 11.5), q(5.2, 7.5), q(4.2, 3.5), q(3.4, 0), q(4.2, -3.5), q(5.2, -7.5), q(6, -11.5), q(3, -10), q(0.5, -6.5), q(-2.5, -2.4)],
      // pale underside = the half toward +n when the tail points up-back
      under: [q(-1.5, 0), q(4.2, 0), q(5.2, 7.5), q(6, 11.5), q(3, 10), q(0.5, 6.5)]
    };
  }

  // ------------------------------------------------------------------ flip (spins)
  var JK = ['pel', 'waist', 'chest', 'neck', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB',
    'hipF', 'knF', 'anF', 'ftF', 'hipB', 'knB', 'anB', 'ftB'];
  function mir(sk, v) { return sk.flip ? [-v[0], v[1]] : v; }

  C.post = function (sk) {
    sk.headAng = Math.round(sk.headAng / 5) * 5;
    sk.flip = !!(sk.ds && sk.ds.flip);
    if (sk.flip) {
      var o = { flip: false, ds: sk.ds, lean: sk.lean, chestAng: sk.chestAng, headAng: sk.headAng, handAngF: sk.handAngF, handAngB: sk.handAngB,
        faF: sk.faF, faB: sk.faB, tail: sk.tail, arch: sk.arch, pen: sk.pen, skirt: sk.skirt };
      for (var i = 0; i < JK.length; i++) { var k = JK[i]; o[k] = sk[k]; sk[k] = [-sk[k][0], sk[k][1]]; }
      sk.d = o;
    } else sk.d = sk;
    sk.nib = sk.haF;
  };

  // ------------------------------------------------------------------ anchors
  var PV = [14, 17];
  function headPt(d, x, y) { return R0(fr(d.neck, d.headAng, x - PV[0], y - PV[1])); }
  C.headCenter = function (sk) { return mir(sk, headPt(sk.d, 16, 11)); };
  C.headTop = function (sk) { return mir(sk, headPt(sk.d, 13, 3)); };
  C.footPoint = function (sk, s) {
    var d = sk.d, f = s === 'F' ? d.ftF : d.ftB, a = s === 'F' ? d.faF : d.faB;
    return mir(sk, R0(fr(f, a, 3, -1)));
  };
  C.defaultMuzzle = function (sk) { return sk.haF; };
  function tipOf(sk, w) {
    var d = sk.d;
    switch (w) {
      case 'fF': case 'fB': {
        var f = w === 'fF' ? d.ftF : d.ftB, a = w === 'fF' ? d.faF : d.faB;
        return R0(fr(f, a, 8, -1.5));
      }
      case 'kF': case 'kB': {
        var k = w === 'kF' ? d.knF : d.knB, h = w === 'kF' ? d.hipF : d.hipB, dx = k[0] - h[0], dy = k[1] - h[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
        return R0([k[0] + dx / l * 4, k[1] + dy / l * 4]);
      }
      case 'tail': {
        var fl = fluke(tailCurve(d)), best = fl.mid;
        // the striking tip: the fluke point farthest along the strike (forward in final space)
        var sgn = sk.flip ? -1 : 1;
        [fl.tips[0], fl.tips[1]].forEach(function (t) { if (t[0] * sgn > best[0] * sgn) best = t; });
        return R0(best);
      }
      case 'hB': case 'hF': default: {
        var hh = w === 'hB' ? d.haB : d.haF, ang = w === 'hB' ? d.handAngB : d.handAngF, v = rot(4, 0, ang);
        return R0([hh[0] + v[0], hh[1] + v[1]]);
      }
    }
  }
  C.weaponPoint = function (sk) { return mir(sk, tipOf(sk, (sk.ds && sk.ds.weapon) || 'hF')); };
  C.extraAnchor = function (sk, name) {
    if (name === 'tail') return mir(sk, tipOf(sk, 'tail'));
    return null;
  };
  // smear source points (drawing space)
  C.partPoints = function (sk, part) {
    var d = sk.d || sk;
    switch (part) {
      case 'hF': return [d.elF[0], d.elF[1], d.haF[0], d.haF[1]];
      case 'hB': return [d.elB[0], d.elB[1], d.haB[0], d.haB[1]];
      case 'fF': { var t = tipOf(sk, 'fF'); return [d.knF[0], d.knF[1], t[0], t[1]]; }
      case 'fB': { var t2 = tipOf(sk, 'fB'); return [d.knB[0], d.knB[1], t2[0], t2[1]]; }
      case 'kF': return [d.hipF[0], d.hipF[1], d.knF[0], d.knF[1]];
      case 'kB': return [d.hipB[0], d.hipB[1], d.knB[0], d.knB[1]];
      case 'tail': {
        var c = tailCurve(d), fl = fluke(c);
        return [c[4][0], c[4][1], fl.mid[0], fl.mid[1]];
      }
    }
    return [d.elF[0], d.elF[1], d.haF[0], d.haF[1]];
  };
  C.boundsExtra = function (sk) {
    var d = sk.d, c = tailCurve(d), fl = fluke(c), o = [];
    o.push(mir(sk, R0(c[4])), mir(sk, R0(fl.tips[0])), mir(sk, R0(fl.tips[1])), mir(sk, R0(fl.mid)));
    o.push(mir(sk, R0(fr(d.pel, d.lean, -17, 40))), mir(sk, R0(fr(d.pel, d.lean, 16, 40))));
    o.push(mir(sk, R0(fr(d.neck, d.headAng, -14, -6))));
    return o;
  };

  // ------------------------------------------------------------------ attach (every tick)
  C.attach = function (sk, sec, ds) {
    var d = sk.d || sk, by = sec.by, a = d.headAng, n = d.neck, L = d.lean;
    ds = ds || d.ds || {};
    sec._ph = (sec._ph || 0) + 1;
    // tail: rest shape = pose curve + a constant lazy sway
    var tl = own(by.tail), tr = tailRoot(d), sw = 7 * (ds.tsw == null ? 1 : ds.tsw), ph = sec._ph * 0.085;
    tailAngles(d, TA);
    for (var i = 0; i < 8; i++) tl.def.rest[i] = TA[i] + sw * Math.sin(ph - i * 0.55) * (0.35 + i * 0.09);
    sec.attach('tail', tr[0], tr[1], 0);
    if (ds.tl) {   // locked to the pose (strikes): exact, no lag
      var c = tailCurve(d);
      for (i = 0; i < c.length; i++) { tl.x[i] = tl.px[i] = c[i][0]; tl.y[i] = tl.py[i] = c[i][1]; }
      tl._lock = true;
    } else tl._lock = false;
    // hair
    var hA = headPt(d, 5, 9), hB = headPt(d, 9, 9), lk = headPt(d, 10, 13), ah = headPt(d, 13, 3);
    sec.attach('hairA', hA[0], hA[1], a * 0.5);
    sec.attach('hairB', hB[0], hB[1], a * 0.5);
    sec.attach('lockN', lk[0], lk[1], a * 0.4);
    sec.attach('ahoge', ah[0], ah[1], a);
    // apron bow tails at the back of the waist
    var W = d.waist, wa = L * 0.7 + d.chestAng * 0.3, bw = fr(W, wa, -6.5, 1.5);
    sec.attach('bowA', bw[0], bw[1], 0);
    sec.attach('bowB', bw[0] - 1, bw[1], 0);
    // skirt: rest angles from the flare; legs push the contours (limits)
    var fl = d.skirt || 0, F0 = fr(d.pel, L, 9, -1.5), B0 = fr(d.pel, L, -10, -1.5);
    var hf = own(by.hemF), hb = own(by.hemB);
    hf.def.rest[0] = 78 - fl * 40; hf.def.rest[1] = 85 - fl * 32;
    hb.def.rest[0] = 104 + fl * 40; hb.def.rest[1] = 97 + fl * 32;
    sec.attach('hemF', F0[0], F0[1], 0);
    sec.attach('hemB', B0[0], B0[1], 0);
  };

  // ------------------------------------------------------------------ drawing helpers
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
  // skirt surface: s = 0 front contour .. 1 back contour, v = 0 waist .. 1 hem
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
    var n = 10, prev = null;
    for (var k = 0; k <= n; k++) {
      var q = R0(surf(S, s0 + (s1 - s0) * k / n, v));
      if (prev && (!dash || k & 1)) p.line(prev[0], prev[1], q[0], q[1], c, onlyOn);
      prev = q;
    }
  }
  // wavy tapered ribbon (hair locks) — returns a flat polygon
  function wavy(pts, w, amp, seed) {
    var sub = [];
    for (var i = 0; i < pts.length - 1; i++) for (var k = 0; k < 3; k++) sub.push(lerp(pts[i], pts[i + 1], k / 3));
    sub.push(pts[pts.length - 1]);
    var n = sub.length, Lf = [], Rt = [];
    for (i = 0; i < n; i++) {
      var a = sub[i > 0 ? i - 1 : 0], b = sub[i < n - 1 ? i + 1 : n - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / l, ny = dx / l, t = i / (n - 1), ww = w[0] + (w[1] - w[0]) * t + (w[2] || 0) * Math.sin(Math.PI * t);
      var wv = amp * Math.sin(i * 1.7 + seed);
      Lf.push([sub[i][0] + nx * (ww + wv), sub[i][1] + ny * (ww + wv)]);
      Rt.push([sub[i][0] - nx * (ww - wv * 0.6), sub[i][1] - ny * (ww - wv * 0.6)]);
    }
    var tipP = sub[n - 1];
    return { poly: H.flat(Lf.concat([[tipP[0] + (tipP[0] - sub[n - 2][0]) * 0.8, tipP[1] + (tipP[1] - sub[n - 2][1]) * 0.8]], Rt.reverse())), sub: sub, L: Lf, R: Rt };
  }

  // ------------------------------------------------------------------ parts
  function drawTail(p, sk, sec, ds) {
    var ch = sec.tail, pts;
    if (ds.tl) pts = tailCurve(sk); else pts = H.chainPts(ch);
    var fl = fluke(pts);
    // stock: thick, tapering
    p.poly(H.ribbon(pts, [5.2, 5, 4.6, 4.1, 3.6, 3.1, 2.7, 2.3, 2.0], null), MF, SH.thick);
    // pale belly line along the underside (the side toward the viewer's lower edge)
    for (var i = 1; i < pts.length - 2; i++) {
      var a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / l, ny = dx / l, s = ny > 0 ? 1 : -1, w = 3.6 - i * 0.3;
      p.line(Math.round(a[0] + nx * s * (w - 1)), Math.round(a[1] + ny * s * (w - 1)), Math.round(b[0] + nx * s * (w - 1.3)), Math.round(b[1] + ny * s * (w - 1.3)), col(MF, 0), true);
    }
    p.poly(H.flat(fl.poly), MF, SH.body);
    var un = fl.under;
    if (fl.nrm[1] < 0) un = un.map(function (q) { var v0 = [q[0] - fl.b[0], q[1] - fl.b[1]], u = v0[0] * fl.d[0] + v0[1] * fl.d[1], v = v0[0] * fl.nrm[0] + v0[1] * fl.nrm[1]; return [fl.b[0] + fl.d[0] * u - fl.nrm[0] * v, fl.b[1] + fl.d[1] * u - fl.nrm[1] * v]; });
    H.recolor(p, H.flat(un), MF, MF, false);
    H.forPoly(H.flat(un), function (bi) { var c = p.s[bi], c0 = 2 + MF * 4; if (c >= c0 && c <= c0 + 3) p.s[bi] = c0 + Math.max(0, c - c0 - 1); });
    // fluke ridge
    var m0 = R0(fl.b), m1 = R0(fl.mid);
    p.line(m0[0], m0[1], m1[0], m1[1], col(MF, 2), true);
  }

  function drawHairLock(p, ch, w, amp, seed, mats, strands) {
    var pts = H.chainPts(ch), wv = wavy(pts, w, amp, seed), sub = wv.sub, n = sub.length;
    // gradient: base material then lighter toward the ends
    p.poly(wv.poly, mats[0], SH.hair);
    var cut1 = Math.floor(n * 0.45), cut2 = Math.floor(n * 0.72);
    var g1 = H.flat(wv.L.slice(cut1).concat([sub[n - 1]], wv.R.slice(cut1).reverse()));
    var g2 = H.flat(wv.L.slice(cut2).concat([sub[n - 1]], wv.R.slice(cut2).reverse()));
    H.recolor(p, g1, mats[0], mats[1], false);
    H.recolor(p, g2, mats[1], mats[2], false);
    // strands: darker grooves + a highlight sheen near the top
    for (var s = 0; s < strands.length; s++) {
      var off = strands[s], prev = null;
      for (var i = 1; i < n - 1; i++) {
        var q = R0(lerp(wv.L[i], wv.R[i], off));
        if (prev && i > 1) p.darkLine(prev[0], prev[1], q[0], q[1], 1);
        prev = q;
      }
    }
    var h0 = R0(lerp(wv.L[2], wv.R[2], 0.3)), h1 = R0(lerp(wv.L[4], wv.R[4], 0.35));
    p.line(h0[0], h0[1], h1[0], h1[1], col(mats[0], 0), true);
  }

  function drawArm(p, sk, s, ds) {
    var sh = s === 'F' ? sk.shF : sk.shB, el = s === 'F' ? sk.elF : sk.elB, ha = s === 'F' ? sk.haF : sk.haB;
    var ang = s === 'F' ? sk.handAngF : sk.handAngB, shape = s === 'F' ? ds.handF : ds.handB, t = s === 'F' ? 1 : 2;
    p.cap(sh[0], sh[1], el[0], el[1], 2.8, 2.4, M.c2, SH.limbL, t);
    var cf = lerp(el, ha, 0.7);
    p.cap(el[0], el[1], cf[0], cf[1], 2.5, 2.3, M.c2, SH.limbL, t);
    // puffed shoulder
    var pu = lerp(sh, el, 0.18);
    p.ell(pu[0] - 0.5, pu[1] - 0.5, 4.6, 4.2, M.c2, SH.body, t);
    var hi = fr(pu, 0, 1, -2);
    p.pxOn(Math.round(hi[0]), Math.round(hi[1]), col(M.c2, t - 1));
    p.pxOn(Math.round(hi[0]) + 1, Math.round(hi[1]), col(M.c2, t - 1));
    // white frilled cuff (wider at the wrist)
    p.cap(cf[0], cf[1], ha[0], ha[1], 2.6, 3.3, M.c1, SH.limbL, t);
    var dx = ha[0] - cf[0], dy = ha[1] - cf[1], l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l, ny = dx / l;
    for (var k = -2; k <= 2; k += 2) p.pxOn(Math.round(ha[0] + nx * k - dx / l), Math.round(ha[1] + ny * k - dy / l), col(M.c1, t + 1));
    var g0 = lerp(cf, ha, 0.3);
    p.line(Math.round(g0[0] + nx * 2.4), Math.round(g0[1] + ny * 2.4), Math.round(g0[0] - nx * 2.4), Math.round(g0[1] - ny * 2.4), col(M.metal, t), true);
    H.hand(p, [ha[0] + dx / l * 1.5, ha[1] + dy / l * 1.5], ang, shape || 'fist', M.skin, M.skin, I.ART.deepseek.hands);
  }

  function drawLeg(p, sk, s, lockOff, shoeM) {
    var hip = s === 'F' ? sk.hipF : sk.hipB, kn = s === 'F' ? sk.knF : sk.knB;
    var an = s === 'F' ? sk.anF : sk.anB, ft = s === 'F' ? sk.ftF : sk.ftB, fa = s === 'F' ? sk.faF : sk.faB;
    var lo = lockOff || 0, t = s === 'F' ? 1 : 2;
    an = [an[0] + lo, an[1]]; ft = [ft[0] + lo, ft[1]];
    p.cap(hip[0], hip[1], kn[0], kn[1], 4.6, 3.3, M.c1, SH.limbL, t);
    p.cap(kn[0], kn[1], an[0], an[1], 3.2, 2.0, M.c1, SH.limbL, t);
    var calf = lerp(kn, an, 0.3), dx = an[0] - kn[0], dy = an[1] - kn[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    p.cap(calf[0] - dy / l * 0.8, calf[1] + dx / l * 0.8, calf[0] + dx / l * 4 - dy / l * 0.4, calf[1] + dy / l * 4 + dx / l * 0.4, 3.4, 2.6, M.c1, SH.limbL, t);
    // mary-jane
    var b = [[-3, 0], [7, 0], [8, -1.2], [7.2, -3], [4, -3.6], [1, -4.6], [-2.2, -4.6], [-3.4, -2]];
    var pts = [];
    for (var i = 0; i < b.length; i++) { var q = fr(ft, fa, b[i][0], b[i][1]); pts.push(q[0], q[1]); }
    p.poly(pts, shoeM, SH.limbL, 1);
    var s0 = R0(fr(ft, fa, -3, 0)), s1 = R0(fr(ft, fa, 7, 0));
    p.line(s0[0], s0[1], s1[0], s1[1], col(shoeM, 3), true);
    var st0 = R0(fr(ft, fa, 0, -4.6)), st1 = R0(fr(ft, fa, 3, -3.4));
    p.line(st0[0], st0[1], st1[0], st1[1], col(shoeM, 0), true);
    var tg = R0(fr(ft, fa, 5.5, -2.4));
    p.pxOn(tg[0], tg[1], col(shoeM, 0));
  }

  function skirtSurf(sk, sec) {
    var W = sk.waist, wa = sk.lean * 0.7 + sk.chestAng * 0.3, hf = H.chainPts(sec.hemF), hb = H.chainPts(sec.hemB);
    return {
      f: plMake([fr(W, wa, 5, 2), hf[0], hf[1], hf[2]]),
      b: plMake([fr(W, wa, -5.5, 2), hb[0], hb[1], hb[2]]),
      sag: 1.5
    };
  }
  var sA = function (v) { return 0.11 - 0.09 * v; }, sB = function (v) { return 0.2 + 0.24 * v; };
  var aA = function () { return 0.03; }, aB = function (v) { return 0.47 + 0.12 * v; };
  var AV = 0.6;   // apron bottom (fraction of the skirt length)

  function drawPetticoat(p, S) {
    var top = [], bot = [];
    for (var k = 0; k <= 12; k++) {
      var s = -0.02 + 1.04 * k / 12, q = surf(S, s, 1);
      top.push([q[0], q[1] - 2]); bot.push([q[0], q[1] + 2.4]);
    }
    p.poly(H.flat(top.concat(bot.reverse())), M.c1, null, 1);
    for (k = 0; k <= 14; k++) {
      var q2 = surf(S, -0.02 + 1.04 * k / 14, 1);
      p.ell(q2[0] - 0.5, q2[1] + 2.2, 1.6, 1.2, M.c1, null, k & 1 ? 1 : 2);
    }
  }

  function drawSkirt(p, S) {
    // navy over-skirt
    p.poly(band(S, 0, 1, 0, 1, 8), M.c2, SH.body);
    // light-blue pinstriped under-skirt in the front opening
    p.poly(band(S, sA, sB, 0.1, 1, 8), MU, SH.soft);
    for (var k = 1; k <= 4; k++) {
      (function (kk) { sLine(p, S, function (v) { return sA(v) + (sB(v) - sA(v)) * kk / 5; }, 0.18, 0.97, col(MU, 2), true); })(k);
    }
    // folds on the over-skirt + a sheen along the lit edge of the opening
    sLine(p, S, function (v) { return 0.62 + 0.04 * v; }, 0.3, 1, 0, true, true);
    sLine(p, S, function (v) { return 0.8 + 0.03 * v; }, 0.22, 1, 0, true, true);
    sLine(p, S, function (v) { return sB(v) + 0.05; }, 0.35, 0.9, col(M.c2, 0), true);
    // gold embroidery: opening edges + hems
    sLine(p, S, sB, 0.12, 1, col(M.metal, 1), true);
    sLine(p, S, sA, 0.12, 1, col(M.metal, 1), true);
    hLine(p, S, sB(0.93) + 0.02, 1.0, 0.93, col(M.metal, 2), true, true);
    hLine(p, S, sA(0.93) + 0.02, sB(0.93) - 0.02, 0.92, col(M.metal, 1), true, true);
    // small gold bow on the opening edge
    var bw = R0(surf(S, sB(0.78), 0.78));
    p.pxOn(bw[0] - 1, bw[1], col(M.metal, 0)); p.pxOn(bw[0] + 1, bw[1], col(M.metal, 0)); p.pxOn(bw[0], bw[1], col(M.metal, 2));
    p.pxOn(bw[0] - 1, bw[1] + 1, col(M.metal, 1)); p.pxOn(bw[0] + 1, bw[1] + 1, col(M.metal, 1));
  }

  function drawApron(p, S) {
    p.poly(band(S, aA, aB, 0, AV, 6), M.c1, SH.soft);
    // frilled edge: back side + bottom
    for (var k = 0; k <= 6; k++) {
      var v = 0.12 + (AV - 0.12) * k / 6, q = surf(S, aB(v) + 0.015, v);
      p.ell(q[0] - 0.5, q[1] - 0.5, 1.5, 1.6, M.c1, null, k & 1 ? 1 : 2);
    }
    for (k = 0; k <= 8; k++) {
      var s = aA() + (aB(AV) - aA()) * k / 8, q2 = surf(S, s, AV);
      p.ell(q2[0] - 0.5, q2[1] + 0.8, 1.5, 1.4, M.c1, null, k & 1 ? 1 : 2);
    }
    // soft fold shading
    sLine(p, S, function (v) { return 0.3 + 0.05 * v; }, 0.15, AV - 0.02, 0, true, true);
    // whale emblem with a spout
    var e = R0(surf(S, 0.2, AV - 0.13)), c2 = M.c2;
    var W = [[-2, 0], [-1, 0], [0, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [2, 0], [-3, -1], [-3, 1]];
    for (var i = 0; i < W.length; i++) p.pxOn(e[0] + W[i][0], e[1] + W[i][1], col(c2, i < 9 ? 1 : 2));
    p.pxOn(e[0] + 1, e[1] - 1, col(c2, 0));
    p.pxOn(e[0], e[1] - 3, col(M.acc, 1)); p.pxOn(e[0] - 1, e[1] - 4, col(M.acc, 1)); p.pxOn(e[0] + 1, e[1] - 4, col(M.acc, 1));
  }

  function drawTorso(p, sk) {
    var c = sk.chest, ca = sk.chestAng, W = sk.waist, wa = sk.lean * 0.6 + ca * 0.4;
    p.cap(c[0], c[1] - 1, sk.neck[0], sk.neck[1], 2.3, 2.2, M.skin, null, 2);
    var body = H.flat([fr(c, ca, -3.5, -0.5), fr(c, ca, -7, 2), fr(c, ca, -7.5, 7), fr(c, ca, -6.5, 12), fr(W, wa, -5.5, 0), fr(W, wa, -6, 3.5),
      fr(W, wa, 5.5, 3.5), fr(W, wa, 5, 0), fr(c, ca, 6.5, 13), fr(c, ca, 8.6, 9.5), fr(c, ca, 7.8, 5.5), fr(c, ca, 5, 1.5), fr(c, ca, 2.5, -0.5)]);
    p.poly(body, M.c2, SH.body);
    // white blouse front (the bust), above the fitted bodice
    var bl = H.flat([fr(c, ca, -1, 0.5), fr(c, ca, 2.5, -0.5), fr(c, ca, 5, 1.5), fr(c, ca, 7.8, 5.5), fr(c, ca, 8.6, 9.5), fr(c, ca, 7.6, 12), fr(c, ca, 1.5, 11.5), fr(c, ca, -1.5, 6)]);
    p.poly(bl, M.c1, SH.body);
    // under-bust shadow line + blouse buttons
    var u0 = R0(fr(c, ca, 1.5, 11.5)), u1 = R0(fr(c, ca, 7.6, 12));
    p.line(u0[0], u0[1], u1[0], u1[1], col(M.c1, 3), true);
    var b0 = R0(fr(c, ca, 3.2, 4)), b1 = R0(fr(c, ca, 3.6, 8));
    p.pxOn(b0[0], b0[1], col(M.c1, 2)); p.pxOn(b1[0], b1[1], col(M.c1, 2));
    // bodice: two rows of gold buttons
    for (var r = 0; r < 2; r++) {
      var bx = r ? 5.2 : 1.6;
      [15, 18.5].forEach(function (y) { var q = R0(fr(c, ca, bx, y)); p.pxOn(q[0], q[1], col(M.metal, 1)); p.pxOn(q[0], q[1] - 1, col(M.metal, 0)); });
    }
    // waist seam
    var w0 = R0(fr(W, wa, -5.5, 2.5)), w1 = R0(fr(W, wa, 5, 2.5));
    p.line(w0[0], w0[1], w1[0], w1[1], col(M.c2, 3), true);
  }

  function drawCollar(p, sk) {
    var c = sk.chest, ca = sk.chestAng;
    // white frilled collar + dark ribbon bow with a blue gem
    p.poly(H.flat([fr(c, ca, -3.5, -1.5), fr(c, ca, 0, -2), fr(c, ca, 3.5, -1), fr(c, ca, 4.5, 1), fr(c, ca, 2, 2), fr(c, ca, -2.5, 1)]), M.c1, SH.soft);
    var k = R0(fr(c, ca, 3, 0.8)), ink = col(M.c2, 3);
    [[-2, -1], [-2, 0], [-1, 0], [-2, 1], [1, 0], [2, -1], [2, 0], [2, 1], [-1, 2], [1, 2], [-1, 3], [1, 3]].forEach(function (o) { p.px(k[0] + o[0], k[1] + o[1], ink); });
    p.px(k[0], k[1], col(M.acc, 1)); p.px(k[0], k[1] - 1, col(M.acc, 0)); p.px(k[0], k[1] + 1, col(M.acc, 2));
    // apron shoulder ruffle (front shoulder)
    var r0 = fr(c, ca, 1, 1), r1 = fr(c, ca, 3.5, 2.5);
    void r0; void r1;
  }

  // mirror the composited buffer about x = 0 (flip drawings)
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
    var pal = (LC.PAL.deepseek || [])[D.pal] || {}, shoeM = pal.cloth1 ? C.shoeMat(pal) : M.c2;
    var eyes = ds.eyes || 'open';
    if (D.blink && (eyes === 'open' || eyes === 'focus' || eyes === 'sad' || eyes === 'wide')) eyes = (D.blink > 5 || D.blink < 3) ? 'half' : 'closed';
    var S = skirtSurf(d, sec);
    var lockF = sk0.flip ? 0 : D.lock.F, lockB = sk0.flip ? 0 : D.lock.B;
    var steps = [
      [z.tail != null ? z.tail : -10, function () { drawTail(p, d, sec, ds); p.end(); }],
      [z.hair != null ? z.hair : -9, function () {
        drawHairLock(p, sec.hairA, [6.5, 2.5, 2], 1, 0.3, [M.hair, MG, M.tip], [0.35, 0.7]);
        p.end();
        drawHairLock(p, sec.hairB, [5, 2, 1.5], 0.8, 1.9, [MG, M.tip, M.tip], [0.5]);
        p.end();
      }],
      [-8, function () {
        var a = H.chainPts(sec.bowA), b = H.chainPts(sec.bowB);
        p.poly(H.ribbon(a, [1.6, 1.8, 2, 1.6], null), M.c1, SH.soft, 1);
        p.poly(H.ribbon(b, [1.4, 1.6, 1.8, 1.4], null), M.c1, SH.soft, 2);
        var bw = fr(d.waist, d.lean, -7, 1);
        p.ell(bw[0] - 2, bw[1] - 2, 2.6, 2, M.c1, SH.soft, 1);
        p.end();
      }],
      [z.armB != null ? z.armB : -6, function () { drawArm(p, d, 'B', ds); p.end(); }],
      [z.legB != null ? z.legB : -4, function () { drawLeg(p, d, 'B', lockB, shoeM); p.end(); }],
      [z.legF != null ? z.legF : -3, function () { drawLeg(p, d, 'F', lockF, shoeM); p.end(); }],
      [-2, function () { drawPetticoat(p, S); p.end(); }],
      [-1, function () { drawSkirt(p, S); p.end(); }],
      [-0.5, function () { drawApron(p, S); p.end(); }],
      [0, function () { drawTorso(p, d); p.end(); }],
      [0.5, function () { drawCollar(p, d); p.end(); }],
      [2, function () {
        var img = H.headImage(C.headSet, eyes, ds.mouth || 'smile', ds.blush ? 'blush' : '', d.headAng);
        p.blit(img, d.neck[0], d.neck[1]);
        var ah = H.chainPts(sec.ahoge);
        p.cap(ah[0][0], ah[0][1] + 1, ah[1][0], ah[1][1], 0.9, 0.8, M.hair, null);
        p.cap(ah[1][0], ah[1][1], ah[2][0], ah[2][1], 0.8, 0.6, M.hair, null);
        p.cap(ah[2][0], ah[2][1], ah[3][0], ah[3][1], 0.6, 0.5, M.hair, null, 0);
        p.end();
      }],
      [3, function () { drawHairLock(p, sec.lockN, [2.6, 1, 0.8], 0.6, 0.7, [M.hair, MG, M.tip], [0.5]); p.end(); }],
      [4, function () { if (D.smear) { H.smear2(p, D.smear, M.smear); p.end({ outline: false }); } }],
      [z.armF != null ? z.armF : 5, function () { drawArm(p, d, 'F', ds); p.end(); }]
    ];
    steps.sort(function (a, b) { return a[0] - b[0]; });
    for (var i = 0; i < steps.length; i++) steps[i][1]();
    if (sk0.flip) mirrorBuffer(p);
  };

  C.build = function () { C.headSet = I.ART.deepseek.build(); };
  I.CHARS.deepseek = C;
})();
