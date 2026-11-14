/* LATENT CLASH — RIG: Claude 娘 V2 body (104 px, ~6.5 heads), Victorian layered
 * dress, book 「宪章」, quill of light, secondary chains and renderer.
 *
 * Extra pose fields (see NOTES.md): bm ('B' back hand | 'F' front hand | 'both' |
 * 'float' (at bk) | 'none'), channels book (spine angle, deg; -90 = upright),
 * bko (0..1 open), bk (float centre); quill (true → quill of light in the front hand,
 * angle = pen, grip = pg); weapon ('quill' | 'hF' | 'hB' | 'fF' | 'fB' | 'book');
 * muzAt ('book' → muzzle = book centre; default = front palm).
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col, SH = I.SH, H = I.H;
  var fr = H.fr, lerp = H.lerp, rot = H.rot;

  var QL = 30;                 // quill of light: grip → nib
  var BKH = 7, BKW = 5;        // book half height (along spine) / half width

  var C = {
    id: 'claude', height: 104, crouchHeight: 70, width: 26,
    body: {
      spine: 23, waist: 9, neck: 12, upper: 18, fore: 16, thigh: 25, shin: 24, ankle: 4,
      shF: [2, -5], shB: [-3, -5], hipF: [3, 1], hipB: [-3, 1]
    },
    // composed stance: upright, lead palm low and open, book raised in the rear hand
    rest: {
      root: [0, 0], hip: [0, -53], lean: 2, bend: 0, head: [0, 0], tilt: 0,
      hF: [17, -69], hB: [-5, -49], fF: [9, 0], fB: [-7, 0], faF: 0, faB: 0,
      pen: -60, sq: 0, shr: 0, haF: 0, haB: 0, pg: 0.15, skirt: 0, tail: 0, arch: 0,
      book: -100, bko: 0, bk: [0, -60], tw: 0, hem: 0,
      eyes: 'open', mouth: 'neutral', handF: 'palm', handB: 'grip',
      elF: 1, elB: 1, knF: -1, knB: -1, book_: 0, glow: 0, blush: 0
    },
    sigJoints: ['pel', 'waist', 'chest', 'neck', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB',
      'hipF', 'knF', 'anF', 'ftF', 'hipB', 'knB', 'anB', 'ftB', 'bc', 'qt'],
    ramps: function (pal) {
      var dark = pal.id === 'darkmode';
      var light = dark ? pal.cloth2 : pal.cloth1;
      var r = [];
      r[M.skin] = pal.skin; r[M.hair] = pal.hair;
      r[M.tip] = [pal.hairTip[0], pal.hairTip[1], pal.hair[1], pal.hair[2]];
      r[M.eye] = pal.eye; r[M.c1] = pal.cloth1; r[M.c2] = pal.cloth2; r[M.acc] = pal.accent; r[M.metal] = pal.metal;
      r[M.blush] = [pal.blush, pal.blush, pal.skin[2], pal.skin[3]];
      r[M.legs] = dark ? [pal.cloth1[1], pal.cloth1[2], pal.cloth1[3], pal.outline] : pal.cloth2;
      r[M.shoe] = light;
      r[M.ink] = pal.book || pal.cloth2;
      r[M.glow] = ['#ffffff', pal.accent[0], pal.accent[1], pal.accent[2]];
      r[M.smear] = ['#ffffff', pal.accent[0], pal.accent[1], pal.accent[2]];
      r[M.white] = light;
      return r;
    }
  };

  // ------------------------------------------------------------ chains
  C.chains = [
    { id: 'hair', n: 9, len: 9, rest: [12, 5, 2, 1, 0, 0, 0, 0, 0], stiff: [0.34, 0.26, 0.2, 0.15, 0.12, 0.1, 0.08, 0.07, 0.06], damp: 0.88, grav: 0.24, drag: 0.1,
      limit: function (c, i, sk) {
        // keep the long hair hanging behind the back silhouette (it is drawn behind everything)
        var lim = i < 2 ? sk.chest[0] - 2 : (i < 4 ? Math.min(sk.chest[0], sk.pel[0]) - 7 : sk.pel[0] - 9 - Math.max(0, c.y[i] - sk.pel[1]) * 0.12);
        if (c.x[i] > lim) c.x[i] += (lim - c.x[i]) * 0.6;
        if (c.y[i] < c.ay - 3) c.y[i] = c.ay - 3;
      } },
    { id: 'lockN', n: 4, len: [5, 6, 6, 6], rest: [-2, 2, 4, 2], stiff: 0.3, damp: 0.82, grav: 0.22, drag: 0.18 },
    { id: 'lockF', n: 3, len: [5, 6, 5], rest: [-4, 0, 2], stiff: 0.32, damp: 0.8, grav: 0.22, drag: 0.18 },
    { id: 'cape', n: 1, len: [5], rest: [0], stiff: 0.25, damp: 0.84, grav: 0.18, drag: 0.4 },
    { id: 'skirtF', n: 1, len: [14], rest: [0], stiff: 0.2, damp: 0.86, grav: 0.2, drag: 0.45 },
    { id: 'skirtB', n: 1, len: [14], rest: [0], stiff: 0.18, damp: 0.87, grav: 0.2, drag: 0.5 },
    { id: 'sash', n: 3, len: [9, 9, 9], rest: [-6, -2, 0], stiff: [0.3, 0.22, 0.18], damp: 0.84, grav: 0.24, drag: 0.3 },
    { id: 'bowT', n: 2, len: [3, 4], rest: [0, 0], stiff: 0.3, damp: 0.8, grav: 0.22, drag: 0.3 }
  ];

  C.attach = function (sk, sec) {
    var a = sk.headAng, n = sk.neck;
    var hb = fr(n, a, -6, -12);
    sec.attach('hair', hb[0], hb[1], 90 + a * 0.3);
    var ln = fr(n, a, -1, -7);
    sec.attach('lockN', ln[0], ln[1], 90 + a * 0.5);
    var lf = fr(n, a, 7, -6);
    sec.attach('lockF', lf[0], lf[1], 90 + a * 0.5);
    var cp = fr(sk.chest, sk.chestAng, -8, -2);
    sec.attach('cape', cp[0], cp[1], 90 + sk.chestAng);
    var sf = fr(sk.pel, sk.lean * 0.5, 6, -1), sb = fr(sk.pel, sk.lean * 0.5, -7, -1);
    sec.attach('skirtF', sf[0], sf[1], 90);
    sec.attach('skirtB', sb[0], sb[1], 90);
    var sa = fr(sk.waist, sk.lean, 3.5, 4.5);
    sec.attach('sash', sa[0], sa[1], 90 + sk.lean * 0.4);
    var bt = fr(sk.pel, sk.lean * 0.35, -3, 5);
    sec.attach('bowT', bt[0], bt[1], 90);
  };

  function swing(ch) {
    var rp = ch.restPos(ch.n - 1);
    return [ch.qx[ch.n - 1] - Math.round(rp[0]), ch.qy[ch.n - 1] - Math.round(rp[1])];
  }
  function R2(v) { return [Math.round(v[0]), Math.round(v[1])]; }
  function ln(p, a, b, c, on) { p.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c, on); }
  function dl(p, a, b, st) { p.darkLine(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), st || 1); }
  function nrm(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1; return [dx / l, dy / l, l]; }

  // ------------------------------------------------------------ geometry (pure; anchors use it)
  function handTip(sk, s, len) {
    var h = s === 'B' ? sk.haB : sk.haF, a = s === 'B' ? sk.handAngB : sk.handAngF, d = rot(len, 0, a);
    return [Math.round(h[0] + d[0]), Math.round(h[1] + d[1])];
  }
  C.bookGeo = function (sk) {
    var ds = sk.ds || {}, m = ds.bm || 'B';
    if (m === 'none') return null;
    var th = sk.book * Math.PI / 180, U = [Math.cos(th), Math.sin(th)], V = [-Math.sin(th), Math.cos(th)], c;
    if (m === 'float') c = sk.bk;
    else if (m === 'both') c = [(sk.haF[0] + sk.haB[0]) / 2, (sk.haF[1] + sk.haB[1]) / 2 - 1];
    else {
      var g = handTip(sk, m === 'F' ? 'F' : 'B', 2);
      c = [g[0] - V[0] * BKW, g[1] - V[1] * BKW];
    }
    return { c: c, U: U, V: V, o: m === 'float' || m === 'both' ? sk.bko : sk.bko };
  };
  C.quillGeo = function (sk) {
    var g = handTip(sk, 'F', 2), u = rot(1, 0, sk.pen), pg = sk.pg || 0;
    return { g: g, u: u, butt: [g[0] - u[0] * (QL * pg + 7), g[1] - u[1] * (QL * pg + 7)],
      tip: [g[0] + u[0] * QL * (1 - pg), g[1] + u[1] * QL * (1 - pg)] };
  };
  C.post = function (sk) {
    sk.pen = Math.round(sk.pen);
    sk.headAng = Math.round(sk.headAng / 5) * 5;
    var b = C.bookGeo(sk);
    sk.bc = b ? R2(b.c) : [0, 0];
    sk.qt = sk.ds && sk.ds.quill ? R2(C.quillGeo(sk).tip) : [0, 0];
  };
  C.sigExtra = function (sk, s, n) {
    s[n++] = Math.round(sk.book); s[n++] = Math.round(sk.bko * 20); s[n++] = Math.round(sk.hem); s[n++] = Math.round(sk.skirt * 4);
    return n;
  };
  C.headCenter = function (sk) { return R2(fr(sk.neck, sk.headAng, 1, -8)); };
  C.headTop = function (sk) { return R2(fr(sk.neck, sk.headAng, 1, -16)); };
  C.footPoint = function (sk, s) {
    var f = s === 'F' ? sk.ftF : sk.ftB, a = s === 'F' ? sk.faF : sk.faB;
    return R2(fr(f, a, 3, -1));
  };
  function toe(sk, s) { return R2(fr(s === 'F' ? sk.ftF : sk.ftB, s === 'F' ? sk.faF : sk.faB, 8, -1)); }
  function bookFront(sk) {
    var b = C.bookGeo(sk); if (!b) return sk.haB;
    var best = null;
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (k) {
      var q = [b.c[0] + b.U[0] * BKH * k[0] + b.V[0] * BKW * k[1], b.c[1] + b.U[1] * BKH * k[0] + b.V[1] * BKW * k[1]];
      if (!best || q[0] > best[0]) best = q;
    });
    return R2(best);
  }
  C.defaultMuzzle = function (sk) {
    if (sk.ds && sk.ds.muzAt === 'book') return sk.bc;
    return handTip(sk, 'F', 4);
  };
  C.weaponPoint = function (sk) {
    var w = sk.ds && sk.ds.weapon;
    if (!w && sk.ds && sk.ds.quill) w = 'quill';
    switch (w) {
      case 'quill': return sk.qt;
      case 'hB': return handTip(sk, 'B', 5);
      case 'fF': return toe(sk, 'F');
      case 'fB': return toe(sk, 'B');
      case 'book': return bookFront(sk);
      default: return handTip(sk, 'F', 5);
    }
  };
  C.boundsExtra = function (sk) {
    var o = [];
    if (sk.ds && sk.ds.quill) o.push(sk.qt);
    if (sk.ds && sk.ds.bm !== 'none') o.push(sk.bc);
    return o;
  };
  C.partPoints = function (sk, part) {
    var t;
    switch (part) {
      case 'pen': case 'quill': return [sk.haF[0], sk.haF[1], sk.qt[0], sk.qt[1]];
      case 'hF': t = handTip(sk, 'F', 5); return [sk.elF[0], sk.elF[1], t[0], t[1]];
      case 'hB': t = handTip(sk, 'B', 5); return [sk.elB[0], sk.elB[1], t[0], t[1]];
      case 'fF': t = toe(sk, 'F'); return [sk.knF[0], sk.knF[1], t[0], t[1]];
      case 'fB': t = toe(sk, 'B'); return [sk.knB[0], sk.knB[1], t[0], t[1]];
      case 'book': t = bookFront(sk); return [sk.haB[0], sk.haB[1], t[0], t[1]];
    }
    return [0, 0, 0, 0];
  };

  // ------------------------------------------------------------ legs (black tights, cream heeled lace-up boots)
  var BOOT = [[-3, 0], [-1.2, 0], [-0.8, -1.6], [3.5, 0], [7.8, 0], [8.4, -1.2], [7.4, -2.6], [3.6, -4], [2, -6.5], [-2.6, -6.5], [-3.4, -3.5]];
  function drawLeg(p, sk, s, lockOff) {
    var hip = s === 'F' ? sk.hipF : sk.hipB, kn = s === 'F' ? sk.knF : sk.knB;
    var an = s === 'F' ? sk.anF : sk.anB, ft = s === 'F' ? sk.ftF : sk.ftB, fa = s === 'F' ? sk.faF : sk.faB;
    var lo = lockOff || 0, t = s === 'F' ? 1 : 2;
    an = [an[0] + lo, an[1]]; ft = [ft[0] + lo, ft[1]];
    p.cap(hip[0], hip[1], kn[0], kn[1], 4.2, 3.0, M.legs, SH.limbL, t);
    p.cap(kn[0], kn[1], an[0], an[1], 3.0, 1.8, M.legs, SH.limbL, t);
    var d = nrm(an, kn), cf = [kn[0] + (an[0] - kn[0]) * 0.28 - d[1] * 0.9, kn[1] + (an[1] - kn[1]) * 0.28 + d[0] * 0.9];
    p.cap(kn[0], kn[1], cf[0], cf[1], 2.9, 3.1, M.legs, SH.limbL, t);   // calf
    var bt = [an[0] + d[0] * 9, an[1] + d[1] * 9];
    p.cap(an[0], an[1], bt[0], bt[1], 2.3, 2.6, M.shoe, SH.limbL, t);
    var pts = [];
    for (var i = 0; i < BOOT.length; i++) { var q = fr(ft, fa, BOOT[i][0], BOOT[i][1]); pts.push(q[0], q[1]); }
    p.poly(pts, M.shoe, SH.limbL, t);
    // boot top edge, laces up the front, heel + sole
    ln(p, [bt[0] - d[1] * 2, bt[1] + d[0] * 2], [bt[0] + d[1] * 2, bt[1] - d[0] * 2], col(M.shoe, 2), true);
    for (var k = 1; k < 8; k += 2) {
      var lp = [an[0] + d[0] * k - d[1] * -1.6, an[1] + d[1] * k + d[0] * -1.6];
      p.pxOn(lp[0] + (fa > 20 ? 0 : 1), lp[1], col(M.shoe, 3));
    }
    var h0 = fr(ft, fa, -3, -1), h1 = fr(ft, fa, -1.2, -1);
    ln(p, h0, h1, col(M.shoe, 3), true);
    var s0 = fr(ft, fa, 3.5, 0), s1 = fr(ft, fa, 7.6, 0);
    ln(p, s0, s1, col(M.shoe, 2), true);
  }

  // ------------------------------------------------------------ arms (puffed sleeves, frilled cuffs)
  var HANDS = null;
  function drawArm(p, sk, s, ds) {
    var sh = s === 'F' ? sk.shF : sk.shB, el = s === 'F' ? sk.elF : sk.elB, ha = s === 'F' ? sk.haF : sk.haB;
    var ang = s === 'F' ? sk.handAngF : sk.handAngB, shape = s === 'F' ? ds.handF : ds.handB;
    var t = s === 'F' ? 1 : 2;
    var u = nrm(el, ha), w0 = [ha[0] - u[0] * 4.2, ha[1] - u[1] * 4.2];
    p.cap(sh[0], sh[1], el[0], el[1], 3.0, 2.3, M.c1, SH.limbL, t);
    var pf = lerp(sh, el, 0.42);
    p.cap(sh[0], sh[1], pf[0], pf[1], 3.6, 3.2, M.c1, SH.thick, t);             // puff
    p.cap(el[0], el[1], w0[0], w0[1], 2.3, 1.9, M.c1, SH.limbL, t);
    // gathered sleeve under the puff + lacing on the forearm
    var g0 = lerp(sh, el, 0.75);
    dl(p, [pf[0] - u[1] * 0, pf[1]], g0, 1);
    for (var k = 0.25; k < 0.8; k += 0.27) { var q = lerp(el, w0, k); p.pxOn(q[0] - u[1] * 1.2, q[1] + u[0] * 1.2, col(M.c1, 3)); }
    // frilled cuff
    var c1 = [ha[0] - u[0] * 0.6, ha[1] - u[1] * 0.6];
    p.cap(w0[0], w0[1], c1[0], c1[1], 2.0, 2.9, M.white, SH.limb, Math.max(0, t - 1));
    var e0 = [c1[0] - u[1] * 2.6, c1[1] + u[0] * 2.6], e1 = [c1[0] + u[1] * 2.6, c1[1] - u[0] * 2.6];
    ln(p, e0, e1, col(M.white, 2), true);
    H.hand(p, ha, ang, shape || 'relax', M.skin, null, HANDS);
  }

  // ------------------------------------------------------------ book 「宪章」 (leather, gold corners)
  function drawBook(p, sk, ds) {
    var b = C.bookGeo(sk); if (!b) return;
    var c = b.c, U = b.U, V = b.V, o = Math.max(0, Math.min(1, b.o || 0));
    function q(u, v) { return [c[0] + U[0] * u + V[0] * v, c[1] + U[1] * u + V[1] * v]; }
    if (o < 0.15) {
      // closed: page block shows along the top edge + fore edge (3/4), cover over it
      p.poly(H.flat([q(-BKH, -BKW - 1), q(BKH + 1, -BKW - 1), q(BKH + 1, BKW - 1), q(-BKH, BKW - 1)]), M.white, null, 2);
      p.poly(H.flat([q(-BKH, -BKW), q(BKH, -BKW), q(BKH, BKW), q(-BKH, BKW)]), M.ink, SH.thick, 1);
      // spine highlight band
      ln(p, q(-BKH + 1, BKW - 1), q(BKH - 1, BKW - 1), col(M.ink, 0), true);
      ln(p, q(-BKH + 1, BKW - 2), q(BKH - 1, BKW - 2), col(M.ink, 2), true);
      // gold corners + clasp + small sunburst emblem
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (k) {
        var a = q(k[0] * (BKH - 0.5), k[1] * (BKW - 0.5));
        p.pxOn(a[0], a[1], col(M.metal, k[0] < 0 ? 0 : 1));
        var a2 = q(k[0] * (BKH - 1.5), k[1] * (BKW - 0.5)); p.pxOn(a2[0], a2[1], col(M.metal, 2));
      });
      var cl = q(0, -BKW); p.px(cl[0], cl[1], col(M.metal, 1)); var cl2 = q(1, -BKW); p.px(cl2[0], cl2[1], col(M.metal, 2));
      var em = q(0.5, -0.5);
      p.pxOn(em[0], em[1], col(M.acc, 0));
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (k) { var e = q(0.5 + k[0] * 1.6, -0.5 + k[1] * 1.6); p.pxOn(e[0], e[1], col(M.acc, 1)); });
    } else {
      // open: spine in the middle, two page blocks spread; covers behind
      var wv = BKW * 2 * (0.55 + 0.45 * o);
      p.poly(H.flat([q(-BKH - 0.5, -wv - 1), q(BKH + 0.5, -wv - 1), q(BKH + 0.5, wv + 1), q(-BKH - 0.5, wv + 1)]), M.ink, null, 2);
      p.poly(H.flat([q(-BKH, -wv), q(BKH, -wv + 0.5), q(BKH, -0.5), q(-BKH, -0.5)]), M.white, null, 0);
      p.poly(H.flat([q(-BKH, 0.5), q(BKH, 0.5), q(BKH, wv - 0.5), q(-BKH, wv)]), M.white, null, 1);
      for (var r = -BKH + 2; r < BKH - 1; r += 2) {
        ln(p, q(r, -wv + 2), q(r, -1.8), col(M.acc, ds.glow ? 1 : 2), true);
        ln(p, q(r, 1.8), q(r, wv - 2), col(M.acc, ds.glow ? 1 : 2), true);
      }
      ln(p, q(-BKH, 0), q(BKH, 0), col(M.white, 3), true);
    }
  }

  // ------------------------------------------------------------ quill of light
  function drawQuill(p, sk) {
    var g = C.quillGeo(sk), u = g.u, v = [-u[1], u[0]], b = g.butt, t = g.tip;
    function q(a, s) { return [b[0] + u[0] * a + v[0] * s, b[1] + u[1] * a + v[1] * s]; }
    var L = QL + 7 + QL * (sk.pg || 0);
    // feather vane (blade of light): wide on the upper side, tapering to the nib
    p.poly(H.flat([q(0, 0), q(L * 0.18, -2.6), q(L * 0.45, -3.6), q(L * 0.75, -2.6), q(L - 3, -0.8), q(L - 3, 0.8), q(L * 0.6, 1.8), q(L * 0.25, 1.4)]), M.glow, null, 1);
    // light along the leading (upper) edge, shade on the lower barbs
    ln(p, q(L * 0.2, -2.2), q(L * 0.72, -2.2), col(M.glow, 0), true);
    for (var a = L * 0.22; a < L * 0.7; a += 3) ln(p, q(a, 1.2), q(a + 2, 0.4), col(M.glow, 2), true);
    ln(p, q(0, 0), q(L - 3, 0), col(M.glow, 0), true);     // shaft
    p.poly(H.flat([q(L - 3.5, -1.2), t, q(L - 3.5, 1.2)]), M.metal, null, 0);   // gold nib
    void t;
  }

  // ------------------------------------------------------------ skirt (layered, ankle length)
  var K = 7;
  function skirtGeo(sk, sec) {
    var L = sk.lean, pel = sk.pel, la = L * 0.35;
    var rootB = fr(pel, la, -8, -1.5), rootF = fr(pel, la, 7, -2.5);
    var swF = swing(sec.skirtF), swB = swing(sec.skirtB);
    var fl = (sk.skirt || 0) + Math.max(0, -swF[1] - swB[1]) * 1.4;
    var aF = 80 - fl * 3 - swF[0] * 2.5, aB = 101 + fl * 3 - swB[0] * 2.5, Lf = 49, Lb = 50;
    var pts = [], k, s;
    for (s = 0; s < 2; s++) {
      var S = s ? 'B' : 'F', kn = sk['kn' + S], an = sk['an' + S], hp = sk['hip' + S];
      pts.push([kn, 4.2], [lerp(kn, an, 0.5), 3.4], [an, 3], [lerp(hp, kn, 0.6), 4.4], [toe(sk, S), 1.5], [fr(sk['ft' + S], sk['fa' + S], -3, -3), 1.5]);
    }
    var kneeF = Lf * 0.55, kneeB = Lb * 0.55;
    for (k = 0; k < pts.length; k++) {
      var P = pts[k][0], cl = pts[k][1];
      var dx = P[0] - rootF[0], dy = P[1] - rootF[1], d = Math.sqrt(dx * dx + dy * dy);
      if (d < Lf - 1 && d > 1) {
        var a = Math.atan2(dy, dx) * 180 / Math.PI, m = Math.asin(Math.min(1, cl / d)) * 180 / Math.PI;
        if (a - m < aF) aF = a - m;
        if (k % 6 === 0 && a < 55) kneeF = Math.min(kneeF, Math.max(8, d - 1));
      }
      dx = P[0] - rootB[0]; dy = P[1] - rootB[1]; d = Math.sqrt(dx * dx + dy * dy);
      if (d < Lb - 1 && d > 1) {
        var a2 = Math.atan2(dy, dx) * 180 / Math.PI, m2 = Math.asin(Math.min(1, cl / d)) * 180 / Math.PI;
        if (a2 + m2 > aB) aB = a2 + m2;
        if (k % 6 === 0 && a2 > 125) kneeB = Math.min(kneeB, Math.max(8, d - 1));
      }
    }
    function rib(root, a, len, s1) {
      var kk = a < 60 ? Math.min(1, (60 - a) / 50) : (a > 120 ? Math.min(1, (a - 120) / 50) : 0);
      var b = a + ((a < 90 ? 96 : 84) - a) * kk;
      var r1 = Math.PI * a / 180, r2 = Math.PI * b / 180;
      var m = [root[0] + Math.cos(r1) * s1, root[1] + Math.sin(r1) * s1];
      var e = [m[0] + Math.cos(r2) * (len - s1), m[1] + Math.sin(r2) * (len - s1)];
      return { m: m, e: e };
    }
    var rf = rib(rootF, aF, Lf, Math.min(Lf * 0.55, kneeF)), rb = rib(rootB, aB, Lb, Math.min(Lb * 0.55, kneeB));
    var floor = sk.ds && sk.ds.air ? 999 : -1;
    [rf, rb].forEach(function (r) { if (r.e[1] > floor) r.e[1] = floor; if (r.m[1] > floor) r.m[1] = floor; });
    // hem: quadratic curve back end → front end, sagging toward the floor
    var mid = lerp(rb.e, rf.e, 0.5), sag = 3 + Math.abs(rf.e[0] - rb.e[0]) * 0.06;
    var cy = Math.max(mid[1] + sag, Math.min(rb.e[1], rf.e[1]) + sag * 0.5);
    if (cy > floor) cy = floor;
    var ctrl = [mid[0] - (sk.hem || 0) * 0.5, cy + (sk.hem || 0)];
    var hem = [];
    for (k = 0; k <= 10; k++) {
      var t = k / 10, it = 1 - t;
      hem.push([it * it * rb.e[0] + 2 * it * t * ctrl[0] + t * t * rf.e[0], it * it * rb.e[1] + 2 * it * t * ctrl[1] + t * t * rf.e[1]]);
    }
    var roots = [];
    for (k = 0; k <= 10; k++) roots.push(lerp(rootB, rootF, k / 10));
    return { rootB: rootB, rootF: rootF, rf: rf, rb: rb, hem: hem, roots: roots, wB: fr(sk.waist, L, -5.6, 4.5), wF: fr(sk.waist, L, 5.4, 4.5) };
  }

  function drawSkirt(p, sk, sec, ds) {
    var G = skirtGeo(sk, sec), hem = G.hem, i;
    // frill under-layer below the hem
    var fr1 = [];
    for (i = 0; i < hem.length; i++) fr1.push([hem[i][0], hem[i][1] + 1.4]);
    p.poly(H.ribbon(fr1, 1.6), M.white, null, 1);
    // main bell
    var outline = [G.wB, G.wF, G.rootF, G.rf.m, G.rf.e];
    for (i = hem.length - 2; i >= 1; i--) outline.push(hem[i]);
    outline.push(G.rb.e, G.rb.m, G.rootB);
    p.poly(H.flat(outline), M.c1, SH.body, 1);
    // pleats on the cream front panel (fan from the hips to the hem)
    for (i = 5; i <= 9; i++) {
      var r0 = G.roots[i], h0 = hem[i];
      dl(p, lerp(r0, h0, 0.18), lerp(h0, r0, 0.08), 1);
      if (i < 9) ln(p, [lerp(r0, h0, 0.3)[0] + 1, lerp(r0, h0, 0.3)[1]], [h0[0] + 1, h0[1] - 2], col(M.c1, 0), true);
    }
    // black side panel (back half) with a gold border, cream drape lined orange over its top
    var pTop = fr(sk.pel, sk.lean * 0.35, -1, -2.5);
    var panel = [pTop, G.rootB, G.rb.m, G.rb.e];
    for (i = 1; i <= 4; i++) panel.push(hem[i]);
    panel.push([hem[4][0] + 1, hem[4][1] - 1]);
    H.recolor(p, H.flat(panel), M.c1, M.c2, false);
    ln(p, pTop, [hem[4][0] + 1, hem[4][1] - 2], col(M.metal, 1), true);
    for (i = 0; i < 4; i++) ln(p, [hem[i][0], hem[i][1] - 2], [hem[i + 1][0], hem[i + 1][1] - 2], col(M.metal, 2), true);
    var dEnd = lerp(pTop, hem[4], 0.32), dBack = lerp(G.rb.m, G.rb.e, 0.45);
    var drape = [pTop, G.rootB, G.rb.m, dBack, lerp(dBack, dEnd, 0.5), dEnd];
    H.recolor(p, H.flat(drape), M.c2, M.c1, false);
    var dm = lerp(dBack, dEnd, 0.5);
    ln(p, dBack, [dm[0], dm[1] + 1], col(M.acc, 1), true); ln(p, [dm[0], dm[1] + 1], dEnd, col(M.acc, 1), true);
    ln(p, [dBack[0], dBack[1] + 1], [dm[0], dm[1] + 2], col(M.acc, 2), true);
    // orange embroidery dots above the frill on the cream front
    for (i = 5; i < 10; i++) { var e = lerp(hem[i], hem[i + 1], 0.5); p.pxOn(e[0], e[1] - 3, col(M.acc, (i & 1) ? 1 : 2)); }
    // corset chain (gold) swinging below the belt
    var c0 = fr(sk.waist, sk.lean, -3, 5), c2 = fr(sk.waist, sk.lean, 4, 5.5), cm = fr(sk.waist, sk.lean, 0.5, 8.5);
    for (i = 0; i <= 6; i++) { var t = i / 6, it = 1 - t; p.pxOn(it * it * c0[0] + 2 * it * t * cm[0] + t * t * c2[0], it * it * c0[1] + 2 * it * t * cm[1] + t * t * c2[1], col(M.metal, (i & 1) ? 1 : 2)); }
    return G;
  }

  function drawSash(p, sk, sec) {
    var pts = H.chainPts(sec.sash), n = pts.length;
    var w = [];
    for (var i = 0; i < n; i++) w.push(1.4 + i * 0.25);
    var last = pts[n - 1], prev = pts[n - 2], d = nrm(prev, last);
    var tip = [last[0] + d[0] * 2.5, last[1] + d[1] * 2.5];
    p.poly(H.ribbon(pts, w, tip), M.acc, SH.limbL, 1);
    for (i = 0; i < n - 1; i++) dl(p, [pts[i][0] + 0.5, pts[i][1] + 1], [pts[i + 1][0] + 0.5, pts[i + 1][1]], 1);
    // gold border at the cut end + tassel
    ln(p, [last[0] - d[1] * 2.4, last[1] + d[0] * 2.4], [last[0] + d[1] * 2.4, last[1] - d[0] * 2.4], col(M.metal, 1), true);
    p.end();
    p.cap(tip[0], tip[1], tip[0] + d[0] * 3, tip[1] + d[1] * 3, 0.9, 1.3, M.metal, null, 1);
  }

  function drawHipBow(p, sk, sec) {
    var c = fr(sk.pel, sk.lean * 0.35, -3, 4);
    p.poly(H.flat([[c[0] - 1, c[1]], [c[0] - 5, c[1] - 2.5], [c[0] - 5, c[1] + 2], [c[0] - 1, c[1] + 1]]), M.c2, SH.limb, 1);
    p.poly(H.flat([[c[0] + 1, c[1]], [c[0] + 4, c[1] - 2.5], [c[0] + 4.5, c[1] + 2], [c[0] + 1, c[1] + 1]]), M.c2, SH.limb, 1);
    var bt = H.chainPts(sec.bowT);
    p.cap(bt[0][0], bt[0][1] + 1, bt[2][0], bt[2][1], 0.8, 1.2, M.metal, null, 1);
    p.end();
    // sunburst flower at the knot
    p.ell(c[0], c[1], 1.7, 1.7, M.acc, null, 1);
    [[0, -2], [2, -1], [2, 1], [0, 2], [-2, 1], [-2, -1]].forEach(function (k) { p.px(c[0] + k[0], c[1] + k[1], col(M.acc, k[1] < 0 ? 0 : 2)); });
    p.px(c[0], c[1], col(M.metal, 0));
  }

  // ------------------------------------------------------------ torso (blouse, jabot, cravat, corset belt, capelet)
  function drawTorso(p, sk, sec, ds) {
    var c = sk.chest, ca = sk.chestAng, L = sk.lean, w = sk.waist;
    function Cf(x, y) { return fr(c, ca, x, y); }
    function Wf(x, y) { return fr(w, L, x, y); }
    // neck + high collar
    var nb = Cf(0.5, -6.5);
    p.cap(nb[0], nb[1], sk.neck[0], sk.neck[1], 1.9, 1.7, M.skin, SH.limb, 1);
    var hc = lerp(nb, sk.neck, 0.6);
    p.cap(nb[0], nb[1], hc[0], hc[1], 2.6, 2.3, M.c1, SH.limbL, 1);
    // blouse
    var body = H.flat([Cf(-1.8, -7.5), Cf(2.8, -7.5), Cf(5.2, -5.2), Cf(6.6, -2), Cf(7.3, 1.4), Cf(6.4, 4), Wf(4.8, -3), Wf(5.2, 4.5),
      Wf(-5.4, 4.5), Wf(-4.9, -3), Cf(-5.4, 3.5), Cf(-6.1, -1.5), Cf(-5.2, -5.6)]);
    p.poly(body, M.c1, SH.body, 1);
    dl(p, Cf(6.2, 4), Cf(2.5, 4.6), 1);                          // under-bust shadow
    var csw = swing(sec.cape), cbk = Cf(-8.6, -1.2); cbk = [cbk[0] + csw[0], cbk[1] + csw[1] * 0.5 + 1];
    dl(p, Cf(7.2, -1.2), Cf(4.6, 0.6), 1); dl(p, Cf(4.6, 0.6), Cf(0.5, 1.8), 1); dl(p, Cf(0.5, 1.8), Cf(-4.5, 1.5), 1); dl(p, Cf(-4.5, 1.5), cbk, 1);
    // corset belt (wide, black) with gold buttons
    var belt = H.flat([Wf(-5.3, -5.5), Wf(5.4, -6.6), Wf(6.0, -1), Wf(5.7, 4.6), Wf(-5.9, 4.6), Wf(-5.5, -1)]);
    p.poly(belt, M.c2, SH.body, 1);
    ln(p, Wf(-4.6, -5.2), Wf(4.8, -6.2), col(M.c2, 0), true);
    ln(p, Wf(-5, 3.8), Wf(5, 3.8), col(M.c2, 3), true);
    dl(p, Wf(1.5, -5.6), Wf(1.5, 3.6), 1);
    [-4.6, -1.8, 1].forEach(function (y) { var b = Wf(4.2, y); p.pxOn(b[0], b[1], col(M.metal, 1)); });
    p.end();
    // capelet: short cream layer over the shoulders, gold edge, sunburst emblem; back corner lags
    var cs = swing(sec.cape), bk = Cf(-8.6, -1.2);
    bk = [bk[0] + cs[0], bk[1] + cs[1] * 0.5];
    var cape = [Cf(-2.2, -8.6), Cf(2.6, -8.6), Cf(5.8, -6), Cf(7.4, -2.4), Cf(4.6, -0.6), Cf(0.5, 0.6), Cf(-4.5, 0.3), bk, Cf(-7.4, -5)];
    p.poly(H.flat(cape), M.c1, { d: 1.3, l: 1 }, 1);
    for (var i = 2; i < 7; i++) ln(p, cape[i], cape[i + 1], col(M.metal, i < 4 ? 1 : 2), true);
    var em = Cf(-2.5, -3.6);
    p.pxOn(em[0], em[1], col(M.acc, 1)); p.pxOn(em[0] - 1, em[1], col(M.acc, 2)); p.pxOn(em[0] + 1, em[1], col(M.acc, 2));
    p.pxOn(em[0], em[1] - 1, col(M.acc, 0)); p.pxOn(em[0], em[1] + 1, col(M.acc, 2));
    p.end();
    // jabot frill + black cravat + orange flower brooch at the throat
    var j0 = Cf(4.2, -5.5), j1 = Cf(5.6, 1.5);
    p.cap(j0[0], j0[1], j1[0], j1[1], 1.3, 1.9, M.white, null, 0);
    for (var k = 0; k < 4; k++) { var jp = lerp(j0, j1, 0.2 + k * 0.25); p.pxOn(jp[0] + 1.5, jp[1], col(M.white, 2)); }
    p.end();
    var cr = H.flat([Cf(2.2, -7.6), Cf(4.8, -7.4), Cf(4.4, -5.6), Cf(5.6, -0.6), Cf(4.4, 0.6), Cf(3.0, -5.4)]);
    p.poly(cr, M.c2, SH.limb, 1);
    var br = Cf(3.6, -6.8);
    p.px(br[0], br[1], col(M.acc, 0)); p.px(br[0] + 1, br[1], col(M.acc, 1)); p.px(br[0], br[1] + 1, col(M.acc, 2)); p.px(br[0] - 1, br[1], col(M.acc, 1)); p.px(br[0], br[1] - 1, col(M.acc, 1));
    p.end();
  }

  // ------------------------------------------------------------ hair
  function drawBackHair(p, sk, sec) {
    var pts = H.chainPts(sec.hair);
    var top = fr(sk.neck, sk.headAng, -2, -15), top2 = fr(sk.neck, sk.headAng, -5, -10);
    pts.unshift(top2); pts.unshift(top);
    var sp = H.chaikin(pts), n = sp.length, w = [];
    for (var i = 0; i < n; i++) { var t = i / (n - 1); w.push(7.2 - t * 2.6 - t * t * 1.2); }
    var last = sp[n - 1], prev = sp[n - 3], d = nrm(prev, last);
    var tip = [last[0] + d[0] * 4, last[1] + d[1] * 4];
    p.poly(H.ribbon(sp, w, tip), M.hair, SH.hair);
    // split ends: notches cut into the tip
    var side = [-d[1], d[0]];
    for (var k = -1; k <= 1; k += 2) {
      for (var j = 0; j < 4; j++) p.px(Math.round(last[0] + side[0] * k * 1.5 - d[0] * j + d[0] * 3), Math.round(last[1] + side[1] * k * 1.5 - d[1] * j + d[1] * 3), 0);
    }
    // strands + sheen band
    var k0 = 3, k1 = n - 2;
    for (i = k0; i < k1; i++) {
      var q0 = sp[i], q1 = sp[i + 1], dd = nrm(q0, q1), sd = [-dd[1], dd[0]];
      dl(p, [q0[0] + sd[0] * 2.5, q0[1] + sd[1] * 2.5], [q1[0] + sd[0] * 2.5, q1[1] + sd[1] * 2.5], 1);
      if (i > 5) dl(p, [q0[0] - sd[0] * 1.5, q0[1] - sd[1] * 1.5], [q1[0] - sd[0] * 1.5, q1[1] - sd[1] * 1.5], 1);
      if (i >= 3 && i < 7) ln(p, [q0[0] - sd[0] * 3.6, q0[1] - sd[1] * 3.6], [q1[0] - sd[0] * 3.6, q1[1] - sd[1] * 3.6], col(M.hair, 0), true);
    }
    // ends shade into the light tip colour
    var ts = Math.floor(n * 0.8);
    var tipsPoly = H.ribbon(sp.slice(ts), 9, [tip[0] + d[0] * 6, tip[1] + d[1] * 6]);
    H.recolor(p, tipsPoly, M.hair, M.tip, false);
    var ts2 = Math.floor(n * 0.7);
    H.recolor(p, H.ribbon(sp.slice(ts2, ts + 1), 9), M.hair, M.tip, true);
  }

  function drawLock(p, ch, extraTop, w0) {
    var pts = H.chainPts(ch);
    if (extraTop) pts.unshift(extraTop);
    var n = pts.length, w = [];
    for (var i = 0; i < n; i++) w.push(w0 * (1 - i / n * 0.55));
    var last = pts[n - 1], d = nrm(pts[n - 2], last);
    var tip = [last[0] + d[0] * 3, last[1] + d[1] * 3];
    p.poly(H.ribbon(pts, w, tip), M.hair, SH.hair);
    H.recolor(p, H.ribbon(pts.slice(n - 2), 5, [tip[0] + d[0] * 3, tip[1] + d[1] * 3]), M.hair, M.tip, false);
  }

  // ------------------------------------------------------------ main draw
  C.draw = function (D) {
    var p = D.p, sk = D.sk, ds = D.ds, sec = D.sec, z = ds.z || {};
    var head = C.headSet;
    var eyes = ds.eyes || 'open';
    if (D.blink && (eyes === 'open' || eyes === 'focus' || eyes === 'sad' || eyes === 'wide')) eyes = (D.blink > 5 || D.blink < 3) ? 'half' : 'closed';
    var bm = ds.bm || 'B';
    var steps = [
      [-10, function () { drawBackHair(p, sk, sec); p.end(); }],
      [-1.6, function () { drawArm(p, sk, 'B', ds); p.end(); }],
      [-1.5, function () { if (bm === 'B') { drawBook(p, sk, ds); p.end(); } }],
      [-4, function () { drawLeg(p, sk, 'B', D.lock.B); p.end(); }],
      [-3, function () { drawLeg(p, sk, 'F', D.lock.F); p.end(); }],
      [-2, function () { drawSkirt(p, sk, sec, ds); p.end(); drawHipBow(p, sk, sec); p.end(); }],
      [0, function () { drawTorso(p, sk, sec, ds); }],
      [0.5, function () { drawSash(p, sk, sec); p.end(); }],
      [1, function () { drawLock(p, sec.lockF, null, 1.6); p.end(); }],
      [2, function () {
        var img = H.headImage(head, eyes, ds.mouth || 'neutral', ds.blush ? 'blush' : '', sk.headAng);
        p.blit(img, sk.neck[0], sk.neck[1]);
        p.end();
      }],
      [3, function () { drawLock(p, sec.lockN, fr(sk.neck, sk.headAng, -1, -10), 1.9); p.end(); }],
      [4, function () { if (D.smear) { H.smear2(p, D.smear, M.smear); p.end({ outline: false }); } }],
      [4.5, function () { if (ds.quill) { drawQuill(p, sk); p.end({ ring: col(M.acc, 3) }); } }],
      [4.8, function () { if (bm === 'float' || bm === 'both' || bm === 'F') { drawBook(p, sk, ds); p.end(); } }],
      [5, function () { drawArm(p, sk, 'F', ds); p.end(); }]
    ];
    if (z.armB != null) steps[1][0] = z.armB;
    if (z.book != null) { steps[2][0] = z.book; steps[13][0] = z.book; }
    else if (z.armB != null && bm === 'B') steps[2][0] = z.armB + 0.5;
    if (z.armF != null) steps[14][0] = z.armF;
    if (z.legF != null) steps[4][0] = z.legF;
    if (z.legB != null) steps[3][0] = z.legB;
    if (z.pen != null) steps[12][0] = z.pen;
    steps.sort(function (a, b) { return a[0] - b[0]; });
    for (var i = 0; i < steps.length; i++) steps[i][1]();
  };

  C.build = function () { C.headSet = I.ART.claude.build(); HANDS = I.ART.claude.hands; };

  I.CHARS = I.CHARS || {};
  I.CHARS.claude = C;
})();
