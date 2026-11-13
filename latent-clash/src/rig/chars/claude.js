/* LATENT CLASH — RIG: Claude 娘 body, outfit, secondary chains, renderer. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col, SH = I.SH, H = I.H;
  var fr = H.fr, lerp = H.lerp, rot = H.rot;

  var PEN_LEN = 46;

  var C = {
    id: 'claude', height: 70, crouchHeight: 47, width: 26,
    body: {
      spine: 17, waist: 6, neck: 3, upper: 10, fore: 9, thigh: 14, shin: 14, ankle: 3,
      shF: [2, 1], shB: [-3, 1], hipF: [1.5, 0], hipB: [-1.5, 0]
    },
    // default stance: poised, fencing-like, pen low and diagonal like a rapier
    rest: {
      root: [0, 0], hip: [0, -30], lean: 2, bend: 0, head: [0, 0], tilt: 0,
      hF: [11, -27], hB: [-4, -32], fF: [9, 0], fB: [-8, 0], faF: 0, faB: 0,
      pen: 32, sq: 0, shr: 0, haF: 0, haB: 0, pg: 0.3, skirt: 0, tail: 0, arch: 0,
      eyes: 'open', mouth: 'neutral', handF: 'grip', handB: 'relax',
      elF: 1, elB: 1, knF: -1, knB: -1, penIn: 'F', glow: 0, blush: 0
    },
    sigJoints: ['pel', 'waist', 'chest', 'neck', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB',
      'hipF', 'knF', 'anF', 'ftF', 'hipB', 'knB', 'anB', 'ftB'],
    ramps: function (pal) {
      var dark = pal.id === 'darkmode';
      var r = [];
      r[M.skin] = pal.skin; r[M.hair] = pal.hair;
      r[M.tip] = [pal.hairTip[0], pal.hairTip[1], pal.hair[0], pal.hair[1]];
      if (dark) r[M.tip] = [pal.hairTip[0], pal.hairTip[1], pal.accent[2], pal.accent[3]];
      r[M.eye] = pal.eye; r[M.c1] = pal.cloth1; r[M.c2] = pal.cloth2; r[M.acc] = pal.accent; r[M.metal] = pal.metal;
      r[M.blush] = [pal.blush, pal.blush, pal.skin[2], pal.skin[3]];
      r[M.legs] = dark ? pal.cloth1 : pal.cloth2;
      r[M.shoe] = dark ? pal.hair : pal.cloth1;
      r[M.ink] = [pal.eye[3], pal.skin[3], pal.outline, pal.outline];
      r[M.glow] = ['#ffffff', pal.accent[0], pal.accent[1], pal.accent[2]];
      r[M.smear] = ['#ffffff', pal.accent[0], pal.accent[1], pal.accent[2]];
      r[M.white] = ['#ffffff', '#f7f2ea', '#dcd2c4', '#aa9d8c'];
      return r;
    }
  };

  // ------------------------------------------------------------ chains
  C.chains = [
    { id: 'hair', n: 5, len: [8, 8, 8, 7, 7], rest: [14, 9, 6, 3, 1], stiff: [0.3, 0.2, 0.14, 0.1, 0.08], damp: 0.86, grav: 0.22, drag: 0.1,
      limit: function (c, i, sk) { var lim = sk.chest[0] + 1; if (c.x[i] > lim) c.x[i] = lim; } },
    { id: 'lockN', n: 2, len: [4, 3], rest: [2, -6], stiff: 0.32, damp: 0.8, grav: 0.2, drag: 0.2 },
    { id: 'lockF', n: 1, len: [3], rest: [-4], stiff: 0.35, damp: 0.8, grav: 0.2, drag: 0.2 },
    { id: 'ahoge', n: 2, len: [3, 3], rest: [-25, 45], stiff: 0.45, damp: 0.75, grav: 0.05, drag: 0.15 },
    { id: 'cape', n: 1, len: [4], rest: [0], stiff: 0.25, damp: 0.84, grav: 0.18, drag: 0.4 },
    { id: 'skirt', n: 1, len: [7], rest: [0], stiff: 0.22, damp: 0.84, grav: 0.2, drag: 0.4 },
    { id: 'tie', n: 2, len: [2, 2], rest: [-8, 0], stiff: 0.3, damp: 0.8, grav: 0.2, drag: 0.3 }
  ];

  C.attach = function (sk, sec) {
    var a = sk.headAng, n = sk.neck;
    var hb = fr(n, a, -6, -9);
    sec.attach('hair', hb[0], hb[1], 90 + a * 0.4);
    var ln = fr(n, a, -2, -6);
    sec.attach('lockN', ln[0], ln[1], 90 + a * 0.6);
    var lf = fr(n, a, 9, -5);
    sec.attach('lockF', lf[0], lf[1], 90 + a * 0.6);
    var ah = fr(n, a, 2, -20);
    sec.attach('ahoge', ah[0], ah[1], -90 + a);
    var cp = fr(sk.chest, sk.chestAng, -7, 6);
    sec.attach('cape', cp[0], cp[1], 90 + sk.chestAng);
    sec.attach('skirt', sk.pel[0], sk.pel[1] - 6, 90 + sk.lean);
    var tie = fr(sk.chest, sk.chestAng, 3, 3);
    sec.attach('tie', tie[0], tie[1], 90 + sk.chestAng);
  };

  // chain swing (local offset of the tip from its rest position)
  function swing(ch) {
    var rp = ch.restPos(ch.n - 1);
    return [ch.qx[ch.n - 1] - Math.round(rp[0]), ch.qy[ch.n - 1] - Math.round(rp[1])];
  }

  // ------------------------------------------------------------ geometry helpers
  C.penPts = function (sk) {
    var hand = sk.ds && sk.ds.penIn === 'B' ? sk.haB : sk.haF;
    var ha = sk.ds && sk.ds.penIn === 'B' ? sk.handAngB : sk.handAngF;
    var d = rot(1, 0, ha), g = [hand[0] + d[0] * 1.2, hand[1] + d[1] * 1.2];
    var u = rot(1, 0, sk.pen), pg = sk.pg || 0.3;
    return {
      grip: g, u: u,
      cap: [g[0] - u[0] * PEN_LEN * pg, g[1] - u[1] * PEN_LEN * pg],
      nib: [g[0] + u[0] * PEN_LEN * (1 - pg), g[1] + u[1] * PEN_LEN * (1 - pg)]
    };
  };
  C.post = function (sk) {
    sk.pen = Math.round(sk.pen);
    sk.headAng = Math.round(sk.headAng / 5) * 5;
    var p = C.penPts(sk);
    sk.nib = [Math.round(p.nib[0]), Math.round(p.nib[1])];
  };
  C.headCenter = function (sk) { var v = fr(sk.neck, sk.headAng, 1, -10); return [Math.round(v[0]), Math.round(v[1])]; };
  C.headTop = function (sk) { var v = fr(sk.neck, sk.headAng, 1, -21); return [Math.round(v[0]), Math.round(v[1])]; };
  C.footPoint = function (sk, s) {
    var f = s === 'F' ? sk.ftF : sk.ftB, a = s === 'F' ? sk.faF : sk.faB, v = fr(f, a, 2, -1);
    return [Math.round(v[0]), Math.round(v[1])];
  };
  C.defaultMuzzle = function (sk) { return sk.ds && sk.ds.penIn === 'none' ? sk.haF : sk.nib; };
  C.weaponPoint = function (sk) { return sk.ds && sk.ds.penIn === 'none' ? sk.haF : sk.nib; };
  C.boundsExtra = function (sk) { return sk.ds && sk.ds.penIn === 'none' ? [] : [sk.nib]; };
  C.partPoints = function (sk, part) {
    switch (part) {
      case 'pen': return [sk.haF[0], sk.haF[1], sk.nib[0], sk.nib[1]];
      case 'hF': return [sk.elF[0], sk.elF[1], sk.haF[0], sk.haF[1]];
      case 'hB': return [sk.elB[0], sk.elB[1], sk.haB[0], sk.haB[1]];
      case 'fF': return [sk.knF[0], sk.knF[1], sk.ftF[0], sk.ftF[1]];
      case 'fB': return [sk.knB[0], sk.knB[1], sk.ftB[0], sk.ftB[1]];
    }
    return [0, 0, 0, 0];
  };

  // ------------------------------------------------------------ parts
  function drawLeg(p, sk, s, lockOff) {
    var hip = s === 'F' ? sk.hipF : sk.hipB, kn = s === 'F' ? sk.knF : sk.knB;
    var an = s === 'F' ? sk.anF : sk.anB, ft = s === 'F' ? sk.ftF : sk.ftB, fa = s === 'F' ? sk.faF : sk.faB;
    var lo = lockOff || 0;
    an = [an[0] + lo, an[1]]; ft = [ft[0] + lo, ft[1]];
    var lt = s === 'F' ? 2 : 2;
    p.cap(hip[0], hip[1], kn[0], kn[1], 2.6, 2.0, M.legs, SH.limbL, lt);
    p.cap(kn[0], kn[1], an[0], an[1], 2.0, 1.5, M.legs, SH.limbL, lt);
    // ankle boot (foot frame: origin = sole point, +x toward toe)
    var b = [[-2.5, 0], [4.5, 0], [5.4, -1], [4.2, -2.4], [1.6, -3.2], [1.6, -6.4], [-2.4, -6.4], [-3, -1.2]];
    var pts = [];
    for (var i = 0; i < b.length; i++) { var q = fr(ft, fa, b[i][0], b[i][1]); pts.push(q[0], q[1]); }
    p.poly(pts, M.shoe, SH.limbL);
    // terracotta trim at the top of the shaft, dark sole
    var t0 = fr(ft, fa, -2, -6), t1 = fr(ft, fa, 1, -6);
    p.line(Math.round(t0[0]), Math.round(t0[1]), Math.round(t1[0]), Math.round(t1[1]), col(M.acc, 2), true);
    var s0 = fr(ft, fa, -2, 0), s1 = fr(ft, fa, 4, 0);
    p.line(Math.round(s0[0]), Math.round(s0[1]), Math.round(s1[0]), Math.round(s1[1]), col(M.shoe, 3), true);
  }

  function drawArm(p, sk, s, ds) {
    var sh = s === 'F' ? sk.shF : sk.shB, el = s === 'F' ? sk.elF : sk.elB, ha = s === 'F' ? sk.haF : sk.haB;
    var ang = s === 'F' ? sk.handAngF : sk.handAngB, shape = s === 'F' ? ds.handF : ds.handB;
    var tone = s === 'F' ? 1 : 2;   // back arm a touch darker (atmospheric depth)
    p.cap(sh[0], sh[1], el[0], el[1], 2.2, 1.9, M.c1, SH.limbL, tone);
    p.cap(el[0], el[1], ha[0], ha[1], 1.9, 1.7, M.c1, SH.limbL, tone);
    // cuff
    var d = rot(1, 0, ang), c0 = [ha[0] - d[0] * 1.8, ha[1] - d[1] * 1.8];
    p.cap(c0[0], c0[1], ha[0] - d[0] * 0.3, ha[1] - d[1] * 0.3, 2.0, 2.0, M.acc, SH.limb, 2);
    H.hand(p, [ha[0] + d[0] * 0.6, ha[1] + d[1] * 0.6], ang, shape || 'relax', M.skin);
  }

  function drawPen(p, sk, ds) {
    var P = C.penPts(sk), u = P.u, cap = P.cap, nib = P.nib, nb = lerp(cap, nib, 0.84);
    p.cap(cap[0], cap[1], nb[0], nb[1], 1.6, 1.6, M.c2, SH.limbL);
    // bands
    var bands = [0.06, 0.3, 0.33, 0.8];
    var perp = [-u[1], u[0]];
    for (var i = 0; i < bands.length; i++) {
      var q = lerp(cap, nib, bands[i]);
      p.line(Math.round(q[0] - perp[0] * 1.6), Math.round(q[1] - perp[1] * 1.6), Math.round(q[0] + perp[0] * 1.6), Math.round(q[1] + perp[1] * 1.6), col(M.metal, 1), true);
    }
    // clip along the cap end
    var k0 = lerp(cap, nib, 0.08), k1 = lerp(cap, nib, 0.26);
    p.line(Math.round(k0[0] + perp[0] * 2), Math.round(k0[1] + perp[1] * 2), Math.round(k1[0] + perp[0] * 2), Math.round(k1[1] + perp[1] * 2), col(M.metal, 1));
    // nib
    var nm = ds.glow ? M.glow : M.metal;
    var w = 1.9, base0 = [nb[0] + perp[0] * w, nb[1] + perp[1] * w], base1 = [nb[0] - perp[0] * w, nb[1] - perp[1] * w];
    var mid = lerp(nb, nib, 0.5);
    p.poly(H.flat([base0, [mid[0] + perp[0] * 1.2, mid[1] + perp[1] * 1.2], nib, [mid[0] - perp[0] * 1.2, mid[1] - perp[1] * 1.2], base1]), nm, SH.limbL);
    var sl0 = lerp(nb, nib, 0.25), sl1 = lerp(nb, nib, 0.75);
    p.line(Math.round(sl0[0]), Math.round(sl0[1]), Math.round(sl1[0]), Math.round(sl1[1]), col(nm, 3), true);
    if (ds.glow) {
      p.px(nib[0] + Math.round(u[0] * 2), nib[1] + Math.round(u[1] * 2), col(M.glow, 0));
    }
  }

  function drawSkirt(p, sk, sec) {
    var L = sk.lean, pel = sk.pel;
    var sw = swing(sec.skirt);
    var fl = sk.skirt || 0;
    function hem(hip, kn, side) {
      var dx = kn[0] - hip[0], dy = kn[1] - hip[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l; dy /= l;
      var n1 = [-dy, dx], n2 = [dy, -dx], pick = side > 0 ? [1, 0.6] : [-1, 0.6];
      var n = (n1[0] * pick[0] + n1[1] * pick[1]) > (n2[0] * pick[0] + n2[1] * pick[1]) ? n1 : n2;
      var b = lerp(hip, kn, 0.46);
      return [b[0] + n[0] * (3.0 + fl), b[1] + n[1] * (3.0 + fl)];
    }
    var hf = hem(sk.hipF, sk.knF, 1), hb = hem(sk.hipB, sk.knB, -1);
    var wB = fr(pel, L, -4.5, -7.5), wF = fr(pel, L, 4.5, -7.5);
    var sB = fr(pel, L, -5.5, -2.5), sF = fr(pel, L, 5.5, -3);
    // swing lag on the hem
    hb = [hb[0] + sw[0] * 0.6, hb[1] + sw[1] * 0.3]; hf = [hf[0] + sw[0] * 0.6, hf[1] + sw[1] * 0.3];
    sB = [sB[0] + sw[0] * 0.25, sB[1]]; sF = [sF[0] + sw[0] * 0.25, sF[1]];
    var m1 = lerp(hb, hf, 0.33), m2 = lerp(hb, hf, 0.66);
    m1[1] += 1; m2[1] += 1;
    var poly = H.flat([wB, wF, sF, hf, m2, m1, hb, sB]);
    p.poly(poly, M.c2, SH.body);
    // pleats
    var fs = [0.22, 0.45, 0.68, 0.88];
    for (var i = 0; i < fs.length; i++) {
      var a = lerp(wB, wF, fs[i]), b = i < 2 ? lerp(hb, m2, fs[i] * 1.6) : lerp(m1, hf, (fs[i] - 0.4) * 1.6);
      p.darkLine(Math.round(a[0]), Math.round(a[1] + 2), Math.round(b[0]), Math.round(b[1]), 1);
    }
    // waistband highlight
    p.line(Math.round(wB[0]), Math.round(wB[1]), Math.round(wF[0]), Math.round(wF[1]), col(M.c2, 0), true);
  }

  function drawTorso(p, sk, sec, ds) {
    var c = sk.chest, ca = sk.chestAng, pel = sk.pel, L = sk.lean;
    // neck
    p.cap(c[0], c[1] - 1, sk.neck[0], sk.neck[1], 1.6, 1.5, M.skin, null, 2);
    // jacket body
    var body = H.flat([fr(c, ca, -4.5, 0), fr(c, ca, -1, -1.5), fr(c, ca, 2.5, -1.5), fr(c, ca, 5, 0.5), fr(c, ca, 5.5, 4),
      fr(pel, L, 4.2, -7), fr(pel, L, -4.2, -7), fr(c, ca, -5.2, 5)]);
    p.poly(body, M.c1, SH.body);
    // capelet (back corner lags)
    var cs = swing(sec.cape);
    var bk = fr(c, ca, -7.5, 7.5);
    bk = [bk[0] + cs[0], bk[1] + cs[1] * 0.5];
    var cape = H.flat([fr(c, ca, -2.5, -2.5), fr(c, ca, 2.5, -2.5), fr(c, ca, 6.5, 0.5), fr(c, ca, 7, 4.5), fr(c, ca, 5, 7.5),
      fr(c, ca, 0, 8), bk, fr(c, ca, -8, 3), fr(c, ca, -6, -0.5)]);
    p.poly(cape, M.c1, SH.body, 1);
    // capelet hem line (scallop shadow)
    // collar V with blouse + ribbon tie
    var v = H.flat([fr(c, ca, 0.5, -2), fr(c, ca, 4, -2), fr(c, ca, 2.5, 4.5)]);
    p.poly(v, M.white, null, 1);
    var l0 = fr(c, ca, 0, -2), l1 = fr(c, ca, 2.5, 5), l2 = fr(c, ca, 4.5, -2);
    p.line(Math.round(l0[0]), Math.round(l0[1]), Math.round(l1[0]), Math.round(l1[1]), col(M.c1, 2));
    p.line(Math.round(l2[0]), Math.round(l2[1]), Math.round(l1[0]), Math.round(l1[1]), col(M.c1, 2));
    var k = fr(c, ca, 2.5, 3);
    var kx = Math.round(k[0]), ky = Math.round(k[1]);
    p.px(kx - 1, ky, col(M.acc, 1)); p.px(kx + 1, ky, col(M.acc, 1)); p.px(kx - 1, ky - 1, col(M.acc, 0)); p.px(kx + 1, ky - 1, col(M.acc, 1));
    p.px(kx, ky, col(M.metal, 0));
    var tie = sec.tie;
    p.px(tie.qx[1], tie.qy[1], col(M.acc, 2)); p.px(tie.qx[2], tie.qy[2], col(M.acc, 3));
  }

  function drawBackHair(p, sk, sec) {
    var ch = sec.hair, pts = H.chainPts(ch);
    // start a bit inside the head so the mass joins the skull
    var top = fr(sk.neck, sk.headAng, 0, -16);
    pts.unshift(top);
    var sp = H.chaikin(pts);
    var n = sp.length, w = [];
    for (var i = 0; i < n; i++) { var t = i / (n - 1); w.push(5.6 - t * 2.2 - t * t * 1.6); }
    var last = sp[n - 1], prev = sp[n - 2], dx = last[0] - prev[0], dy = last[1] - prev[1], dl = Math.sqrt(dx * dx + dy * dy) || 1;
    var tip = [last[0] + dx / dl * 3, last[1] + dy / dl * 3];
    p.poly(H.ribbon(sp, w, tip), M.hair, SH.hair);
    // notch the tip into two locks (one wavy point each side of the centre)
    var side = [-dy / dl, dx / dl];
    var nb = [last[0] + dx / dl * 1, last[1] + dy / dl * 1];
    p.px(Math.round(nb[0]), Math.round(nb[1] + 1), 0);
    p.px(Math.round(nb[0]), Math.round(nb[1] + 2), 0);
    // strand lines
    var k0 = Math.floor(n * 0.2), k1 = Math.floor(n * 0.92);
    for (i = k0; i < k1; i++) {
      var q0 = sp[i], q1 = sp[i + 1];
      var o0 = 2.2, a = [q0[0] + side[0] * o0, q0[1] + side[1] * o0], b = [q1[0] + side[0] * o0, q1[1] + side[1] * o0];
      p.darkLine(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), 1);
    }
    // cream tips (dithered transition)
    var tipStart = Math.floor(n * 0.7);
    var tipsPoly = H.ribbon(sp.slice(tipStart + 1), 12, [tip[0] + dx / dl * 6, tip[1] + dy / dl * 6]);
    H.recolor(p, tipsPoly, M.hair, M.tip, false);
  }

  function drawLock(p, ch, extraTop, w0) {
    var pts = H.chainPts(ch);
    if (extraTop) pts.unshift(extraTop);
    var n = pts.length, w = [];
    for (var i = 0; i < n; i++) w.push(w0 * (1 - i / n * 0.6));
    var last = pts[n - 1], prev = pts[n - 2], dx = last[0] - prev[0], dy = last[1] - prev[1], dl = Math.sqrt(dx * dx + dy * dy) || 1;
    var tip = [last[0] + dx / dl * 2.5, last[1] + dy / dl * 2.5];
    var poly = H.ribbon(pts, w, tip);
    p.poly(poly, M.hair, SH.hair);
    var tp = H.ribbon(pts.slice(n - 2), 5, [tip[0] + dx / dl * 3, tip[1] + dy / dl * 3]);
    H.recolor(p, tp, M.hair, M.tip, false);
  }

  // ------------------------------------------------------------ main draw
  C.draw = function (D) {
    var p = D.p, sk = D.sk, ds = D.ds, sec = D.sec, z = ds.z || {};
    var head = C.headSet;
    var eyes = ds.eyes || 'open';
    if (D.blink && (eyes === 'open' || eyes === 'focus' || eyes === 'sad' || eyes === 'wide')) eyes = (D.blink > 5 || D.blink < 3) ? 'half' : 'closed';
    var steps = [
      [-10, function () { drawBackHair(p, sk, sec); p.end(); }],
      [-6, function () { drawArm(p, sk, 'B', ds); p.end(); }],
      [-5, function () { if (ds.penIn === 'B') { drawPen(p, sk, ds); p.end(); } }],
      [-4, function () { drawLeg(p, sk, 'B', D.lock.B); p.end(); }],
      [-3, function () { drawLeg(p, sk, 'F', D.lock.F); p.end(); }],
      [-2, function () { drawSkirt(p, sk, sec); p.end(); }],
      [0, function () { drawTorso(p, sk, sec, ds); p.end(); }],
      [1, function () { drawLock(p, sec.lockF, null, 1.3); p.end(); }],
      [2, function () {
        var img = H.headImage(head, eyes, ds.mouth || 'neutral', ds.blush ? 'blush' : '', sk.headAng);
        p.blit(img, sk.neck[0], sk.neck[1]);
        var ah = H.chainPts(sec.ahoge);
        p.cap(ah[0][0], ah[0][1] + 1, ah[1][0], ah[1][1], 0.8, 0.7, M.hair, null);
        p.cap(ah[1][0], ah[1][1], ah[2][0], ah[2][1], 0.7, 0.5, M.hair, null, 0);
        p.end();
      }],
      [3, function () { drawLock(p, sec.lockN, fr(sk.neck, sk.headAng, -3, -9), 1.5); p.end(); }],
      [4, function () { if (D.smear) { H.smear(p, D.smear, M.smear); p.end({ outline: false }); } }],
      [4.5, function () { if (ds.penIn !== 'B' && ds.penIn !== 'none') { drawPen(p, sk, ds); p.end(); } }],
      [5, function () { drawArm(p, sk, 'F', ds); p.end(); }]
    ];
    // layering overrides
    if (z.armB != null) steps[1][0] = z.armB;
    if (z.armF != null) steps[12][0] = z.armF;
    if (z.legF != null) steps[4][0] = z.legF;
    if (z.legB != null) steps[3][0] = z.legB;
    if (z.pen != null) { steps[11][0] = z.pen; steps[2][0] = z.pen; }
    steps.sort(function (a, b) { return a[0] - b[0]; });
    for (var i = 0; i < steps.length; i++) steps[i][1]();
  };

  C.build = function () { C.headSet = I.ART.claude.build(); };

  I.CHARS = I.CHARS || {};
  I.CHARS.claude = C;
})();
