/* LATENT CLASH — RIG: DeepSeek 娘 body, whale hoodie, secondary chains, renderer. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col, SH = I.SH, H = I.H;
  var fr = H.fr, lerp = H.lerp, rot = H.rot;

  var C = {
    id: 'deepseek', height: 66, crouchHeight: 44, width: 26,
    body: {
      spine: 16, waist: 5, neck: 2, upper: 9, fore: 8, thigh: 13, shin: 12, ankle: 3,
      shF: [2, 1], shB: [-3, 1], hipF: [2, 0], hipB: [-2, 0]
    },
    // bouncy, low, boxer-like stance: lead fist forward, rear fist at the chin
    rest: {
      root: [0, 0], hip: [0, -22], lean: 8, bend: 2, head: [0, 0], tilt: 0,
      hF: [14, -35], hB: [8, -36], fF: [11, 0], fB: [-10, 0], faF: 0, faB: 0,
      pen: 0, sq: 0, shr: 0, haF: 0, haB: 0, pg: 0.3, skirt: 0, tail: 0, arch: 0,
      eyes: 'open', mouth: 'smile', handF: 'fist', handB: 'fist',
      elF: 1, elB: 1, knF: -1, knB: -1, glow: 0, blush: 0, z: { armB: 1.5 }
    },
    sigJoints: ['pel', 'waist', 'chest', 'neck', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB',
      'hipF', 'knF', 'anF', 'ftF', 'hipB', 'knB', 'anB', 'ftB'],
    ramps: function (pal) {
      var r = [];
      r[M.skin] = pal.skin; r[M.hair] = pal.hair;
      r[M.tip] = [pal.hairTip[0], pal.hairTip[1], pal.hair[1], pal.hair[2]];
      r[M.eye] = pal.eye; r[M.c1] = pal.cloth1; r[M.c2] = pal.cloth2; r[M.acc] = pal.accent; r[M.metal] = pal.metal;
      r[M.blush] = [pal.blush, pal.blush, pal.skin[2], pal.skin[3]];
      r[M.legs] = pal.skin;
      r[M.shoe] = pal.cloth1;
      r[M.ink] = [pal.eye[3], pal.skin[3], pal.outline, pal.outline];
      r[M.glow] = ['#ffffff', pal.accent[0], pal.accent[1], pal.accent[2]];
      r[M.smear] = ['#ffffff', pal.accent[0], pal.accent[1], pal.accent[2]];
      r[M.white] = ['#ffffff', '#f2f6ff', '#d2dcf2', '#a3b0d6'];
      return r;
    }
  };

  C.chains = [
    { id: 'tailW', n: 3, len: [4, 4, 3], rest: [40, 32, 22], stiff: [0.35, 0.28, 0.22], damp: 0.84, grav: 0.24, drag: 0.4 },
    { id: 'pigN', n: 2, len: [3, 3], rest: [10, 25], stiff: 0.35, damp: 0.78, grav: 0.18, drag: 0.25 },
    { id: 'pigF', n: 2, len: [3, 3], rest: [95, 110], stiff: 0.35, damp: 0.78, grav: 0.18, drag: 0.25 },
    { id: 'ahoge', n: 2, len: [3, 2], rest: [-10, 30], stiff: 0.45, damp: 0.75, grav: 0.05, drag: 0.15 },
    { id: 'strF', n: 2, len: [3, 3], rest: [0, 0], stiff: 0.2, damp: 0.8, grav: 0.25, drag: 0.3 },
    { id: 'strB', n: 2, len: [3, 3], rest: [0, 0], stiff: 0.2, damp: 0.8, grav: 0.25, drag: 0.3 },
    { id: 'hem', n: 1, len: [6], rest: [0], stiff: 0.25, damp: 0.84, grav: 0.2, drag: 0.35 }
  ];

  C.attach = function (sk, sec) {
    var a = sk.headAng, n = sk.neck;
    var t = fr(sk.pel, sk.lean, -6, 5);
    sec.attach('tailW', t[0], t[1], 90 + sk.lean * 0.5);
    var pn = fr(n, a, -5, -15);
    sec.attach('pigN', pn[0], pn[1], 180 + a);
    var pf = fr(n, a, 9, -16);
    sec.attach('pigF', pf[0], pf[1], 180 + a + 60);
    var ah = fr(n, a, 3, -19);
    sec.attach('ahoge', ah[0], ah[1], -90 + a);
    var s1 = fr(sk.chest, sk.chestAng, 2, 0), s2 = fr(sk.chest, sk.chestAng, 4, 0);
    sec.attach('strF', s2[0], s2[1], 90 + sk.chestAng);
    sec.attach('strB', s1[0], s1[1], 90 + sk.chestAng);
    sec.attach('hem', sk.pel[0], sk.pel[1] - 4, 90 + sk.lean);
  };
  function swing(ch) {
    var rp = ch.restPos(ch.n - 1);
    return [ch.qx[ch.n - 1] - Math.round(rp[0]), ch.qy[ch.n - 1] - Math.round(rp[1])];
  }

  C.post = function (sk) { sk.headAng = Math.round(sk.headAng / 5) * 5; sk.nib = sk.haF; };
  C.headCenter = function (sk) { var v = fr(sk.neck, sk.headAng, 1, -9); return [Math.round(v[0]), Math.round(v[1])]; };
  C.headTop = function (sk) { var v = fr(sk.neck, sk.headAng, 1, -20); return [Math.round(v[0]), Math.round(v[1])]; };
  C.footPoint = function (sk, s) {
    var f = s === 'F' ? sk.ftF : sk.ftB, a = s === 'F' ? sk.faF : sk.faB, v = fr(f, a, 2, -1);
    return [Math.round(v[0]), Math.round(v[1])];
  };
  C.defaultMuzzle = function (sk) { return sk.haF; };
  // true striking tip: knuckles (hand + 3 along the forearm) or toe (sole + 5 along the foot)
  function tip(sk, w) {
    if (w === 'fF' || w === 'fB') {
      var f = w === 'fF' ? sk.ftF : sk.ftB, a = w === 'fF' ? sk.faF : sk.faB, v = fr(f, a, 5, -1.5);
      return [Math.round(v[0]), Math.round(v[1])];
    }
    var h = w === 'hB' ? sk.haB : sk.haF, ang = w === 'hB' ? sk.handAngB : sk.handAngF, d = rot(3, 0, ang);
    return [Math.round(h[0] + d[0]), Math.round(h[1] + d[1])];
  }
  C.weaponPoint = function (sk) { return tip(sk, (sk.ds && sk.ds.weapon) || 'hF'); };
  C.partPoints = function (sk, part) {
    switch (part) {
      case 'hF': return [sk.elF[0], sk.elF[1], sk.haF[0], sk.haF[1]];
      case 'hB': return [sk.elB[0], sk.elB[1], sk.haB[0], sk.haB[1]];
      case 'fF': return [sk.knF[0], sk.knF[1], sk.ftF[0], sk.ftF[1]];
      case 'fB': return [sk.knB[0], sk.knB[1], sk.ftB[0], sk.ftB[1]];
    }
    return [sk.elF[0], sk.elF[1], sk.haF[0], sk.haF[1]];
  };

  function drawLeg(p, sk, s, lockOff) {
    var hip = s === 'F' ? sk.hipF : sk.hipB, kn = s === 'F' ? sk.knF : sk.knB;
    var an = s === 'F' ? sk.anF : sk.anB, ft = s === 'F' ? sk.ftF : sk.ftB, fa = s === 'F' ? sk.faF : sk.faB;
    var lo = lockOff || 0, tone = s === 'F' ? 1 : 1;
    an = [an[0] + lo, an[1]]; ft = [ft[0] + lo, ft[1]];
    // shorts cuff at the top of the thigh
    p.cap(hip[0], hip[1], kn[0], kn[1], 2.6, 2.1, M.legs, SH.limbL, tone);
    var sh = lerp(hip, kn, 0.3);
    p.cap(hip[0], hip[1], sh[0], sh[1], 3.0, 2.8, M.c2, SH.limb);
    p.cap(kn[0], kn[1], an[0], an[1], 2.1, 1.6, M.legs, SH.limbL, tone);
    // high-top sneaker
    var b = [[-3, 0], [5, 0], [6, -1.2], [5, -2.6], [2, -3.4], [2, -7.2], [-2.6, -7.2], [-3.4, -1.4]];
    var pts = [];
    for (var i = 0; i < b.length; i++) { var q = fr(ft, fa, b[i][0], b[i][1]); pts.push(q[0], q[1]); }
    p.poly(pts, M.shoe, SH.limbL);
    var s0 = fr(ft, fa, -3, 0), s1 = fr(ft, fa, 5, 0);
    p.line(Math.round(s0[0]), Math.round(s0[1]), Math.round(s1[0]), Math.round(s1[1]), col(M.c2, 1), true);
    var t0 = fr(ft, fa, -2, -6), t1 = fr(ft, fa, 1, -6);
    p.line(Math.round(t0[0]), Math.round(t0[1]), Math.round(t1[0]), Math.round(t1[1]), col(M.c2, 2), true);
    var k0 = fr(ft, fa, 3, -2);
    p.pxOn(Math.round(k0[0]), Math.round(k0[1]), col(M.c2, 1));
  }

  function drawArm(p, sk, s, ds) {
    var sh = s === 'F' ? sk.shF : sk.shB, el = s === 'F' ? sk.elF : sk.elB, ha = s === 'F' ? sk.haF : sk.haB;
    var ang = s === 'F' ? sk.handAngF : sk.handAngB, shape = s === 'F' ? ds.handF : ds.handB;
    var tone = s === 'F' ? 1 : 2;
    p.cap(sh[0], sh[1], el[0], el[1], 2.6, 2.3, M.c1, SH.limbL, tone);
    p.cap(el[0], el[1], ha[0], ha[1], 2.3, 2.2, M.c1, SH.limbL, tone);
    // sleeve stripes (two blue bands)
    var bands = [[sh, el, 0.5], [el, ha, 0.45]];
    for (var bi = 0; bi < 2; bi++) {
      var A = bands[bi][0], B = bands[bi][1], st = lerp(A, B, bands[bi][2]);
      var ax = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI, pp = rot(1, 0, ax + 90), dd = rot(1, 0, ax);
      for (var w2 = 0; w2 < 2; w2++) {
        var o = [st[0] + dd[0] * w2, st[1] + dd[1] * w2];
        p.line(Math.round(o[0] - pp[0] * 2.6), Math.round(o[1] - pp[1] * 2.6), Math.round(o[0] + pp[0] * 2.6), Math.round(o[1] + pp[1] * 2.6), col(M.c2, tone), true);
      }
    }
    H.hand(p, ha, ang, shape || 'fist', M.skin, M.acc);
  }

  function drawHood(p, sk) {
    // lowered hood = the whale's blue back, lying on the shoulders behind the neck
    var c = sk.chest, ca = sk.chestAng;
    var pts = H.flat([fr(c, ca, -11, 6), fr(c, ca, -11.5, 0), fr(c, ca, -9, -3.5), fr(c, ca, -4, -4.5), fr(c, ca, 0, -2.5),
      fr(c, ca, 0, 1), fr(c, ca, -4, 4), fr(c, ca, -8, 7)]);
    p.poly(pts, M.c2, SH.body, 1);
    // white belly rim of the hood opening
    var r0 = fr(c, ca, -3.5, -3.5), r1 = fr(c, ca, -0.5, 0);
    p.line(Math.round(r0[0]), Math.round(r0[1]), Math.round(r1[0]), Math.round(r1[1]), col(M.c1, 1), true);
    // two tiny whale eyes
    var e = fr(c, ca, -9, 1), e2 = fr(c, ca, -7, 0);
    p.px(Math.round(e[0]), Math.round(e[1]), 1); p.px(Math.round(e2[0]), Math.round(e2[1]), 1);
  }

  function drawTorso(p, sk, sec) {
    var c = sk.chest, ca = sk.chestAng, pel = sk.pel, L = sk.lean;
    p.cap(c[0], c[1] - 1, sk.neck[0], sk.neck[1], 1.6, 1.5, M.skin, null, 2);
    var hs = swing(sec.hem);
    var hb = fr(pel, L, -7.5, 5), hf = fr(pel, L, 7, 4.5);
    hb = [hb[0] + hs[0] * 0.5, hb[1]]; hf = [hf[0] + hs[0] * 0.4, hf[1]];
    var body = H.flat([fr(c, ca, -5.5, 0), fr(c, ca, -2, -1.5), fr(c, ca, 3, -1.5), fr(c, ca, 6, 0.5), fr(c, ca, 6.5, 6),
      fr(pel, L, 7, -2), hf, fr(pel, L, 0, 5.5), hb, fr(pel, L, -7, -2), fr(c, ca, -6.5, 6)]);
    p.poly(body, M.c1, SH.body);
    // hem band
    p.line(Math.round(hb[0]), Math.round(hb[1]) - 1, Math.round(hf[0]), Math.round(hf[1]) - 1, col(M.c1, 2), true);
    // kangaroo pocket
    var k0 = fr(pel, L, 0, -3), k1 = fr(pel, L, 5, -3), k2 = fr(pel, L, 6.5, 2), k3 = fr(pel, L, -1.5, 2);
    p.line(Math.round(k0[0]), Math.round(k0[1]), Math.round(k1[0]), Math.round(k1[1]), col(M.c1, 3), true);
    p.line(Math.round(k0[0]), Math.round(k0[1]), Math.round(k3[0]), Math.round(k3[1]), col(M.c1, 2), true);
    p.line(Math.round(k1[0]), Math.round(k1[1]), Math.round(k2[0]), Math.round(k2[1]), col(M.c1, 2), true);
    // neckline + strings
    var n0 = fr(c, ca, 0, -1), n1 = fr(c, ca, 4, -1);
    p.line(Math.round(n0[0]), Math.round(n0[1]), Math.round(n1[0]), Math.round(n1[1]), col(M.c1, 2), true);
    var a = sec.strF, b = sec.strB;
    p.line(a.qx[0], a.qy[0], a.qx[2], a.qy[2], col(M.c2, 1));
    p.line(b.qx[0], b.qy[0], b.qx[2], b.qy[2], col(M.c2, 2));
  }

  function drawTail(p, sk, sec) {
    var ch = sec.tailW, pts = H.chainPts(ch);
    var n = pts.length;
    p.poly(H.ribbon(pts, [2.4, 2.0, 1.6, 1.2], null), M.c2, SH.limb);
    // fluke: two lobes perpendicular to the last link
    var a = pts[n - 2], b = pts[n - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= l; dy /= l;
    var nx = -dy, ny = dx;
    var L1 = [b[0] + nx * 5 + dx * 2, b[1] + ny * 5 + dy * 2], L2 = [b[0] - nx * 5 + dx * 2, b[1] - ny * 5 + dy * 2];
    p.poly(H.flat([[b[0] - dx, b[1] - dy], L1, [b[0] + dx * 1.5 + nx * 1.5, b[1] + dy * 1.5 + ny * 1.5], [b[0] + dx * 1, b[1] + dy * 1],
      [b[0] + dx * 1.5 - nx * 1.5, b[1] + dy * 1.5 - ny * 1.5], L2]), M.c2, SH.limb);
  }

  function drawPig(p, ch, sk) {
    var pts = H.chainPts(ch), n = pts.length;
    p.poly(H.ribbon(pts, [2.3, 1.9, 1.5], null), M.hair, SH.hair);
    var a = pts[n - 2], b = pts[n - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= l; dy /= l;
    var nx = -dy, ny = dx;
    var L1 = [b[0] + nx * 4.5 + dx * 2.5, b[1] + ny * 4.5 + dy * 2.5], L2 = [b[0] - nx * 4.5 + dx * 2.5, b[1] - ny * 4.5 + dy * 2.5];
    p.poly(H.flat([[b[0] - dx * 1.5 + nx * 1.5, b[1] - dy * 1.5 + ny * 1.5], L1, [b[0] + dx * 1.2, b[1] + dy * 1.2], L2, [b[0] - dx * 1.5 - nx * 1.5, b[1] - dy * 1.5 - ny * 1.5]]), M.tip, SH.soft, 1);
    // tie (scrunchie) at the root
    p.px(pts[0][0], pts[0][1], col(M.c2, 1));
  }

  C.draw = function (D) {
    var p = D.p, sk = D.sk, ds = D.ds, sec = D.sec, z = ds.z || {};
    var eyes = ds.eyes || 'open';
    if (D.blink && (eyes === 'open' || eyes === 'focus' || eyes === 'sad' || eyes === 'wide')) eyes = (D.blink > 5 || D.blink < 3) ? 'half' : 'closed';
    var steps = [
      [-10, function () { drawTail(p, sk, sec); p.end(); }],
      [-9, function () { drawPig(p, sec.pigF, sk); p.end(); }],
      [-6, function () { drawArm(p, sk, 'B', ds); p.end(); }],
      [-4, function () { drawLeg(p, sk, 'B', D.lock.B); p.end(); }],
      [-3, function () { drawLeg(p, sk, 'F', D.lock.F); p.end(); }],
      [0.5, function () { drawHood(p, sk); p.end(); }],
      [0, function () { drawTorso(p, sk, sec); p.end(); }],
      [2, function () {
        var img = H.headImage(C.headSet, eyes, ds.mouth || 'smile', ds.blush ? 'blush' : '', sk.headAng);
        p.blit(img, sk.neck[0], sk.neck[1]);
        var ah = H.chainPts(sec.ahoge);
        p.cap(ah[0][0], ah[0][1] + 1, ah[1][0], ah[1][1], 0.8, 0.7, M.hair, null);
        p.cap(ah[1][0], ah[1][1], ah[2][0], ah[2][1], 0.6, 0.5, M.hair, null, 0); p.px(ah[2][0] + 1, ah[2][1], col(M.tip, 1));
        p.end();
      }],
      [3, function () { drawPig(p, sec.pigN, sk); p.end(); }],
      [4, function () { if (D.smear) { H.smear(p, D.smear, M.smear); p.end({ outline: false }); } }],
      [5, function () { drawArm(p, sk, 'F', ds); p.end(); }]
    ];
    if (z.armB != null) steps[2][0] = z.armB;
    if (z.armF != null) steps[10][0] = z.armF;
    if (z.legF != null) steps[4][0] = z.legF;
    if (z.legB != null) steps[3][0] = z.legB;
    steps.sort(function (a, b) { return a[0] - b[0]; });
    for (var i = 0; i < steps.length; i++) steps[i][1]();
  };

  C.build = function () { C.headSet = I.ART.deepseek.build(); };
  I.CHARS.deepseek = C;
})();
