/* LATENT CLASH — FX: GPT 娘 super, 注意力即一切 ATTENTION IS ALL YOU NEED (owned by FX).
 * gpt.attention (drawn at 0,0; opts.tx, opts.ty = target point on screen; facing; palette;
 * opts.part 'back' | 'front' | undefined = both):
 *   three huge spectral dragon heads (horns, scaled skull, cheek fins, glowing eyes, jaws) on
 *   long segmented necks sweep in from the left, the top and the right; thin dashed targeting
 *   lines + a closing reticle lock onto the target (Q / K / V tags); the jaws open, the mouths
 *   charge, three thick teal-white beams converge on the target (multi-hit orb); the orb swells
 *   into a full-screen burst; the heads dissolve into falling luminous scales.  70 frames.
 * Heads are baked per palette at 10 aim angles (0..90 deg, 10 deg steps; 90..180 = mirrored) x
 * 3 jaw poses, each cropped to its own canvas. Necks = one baked scaled segment drawn along a
 * runtime Bezier. Beams / lines / burst are runtime fillRect runs (no AA). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var W = LC.W || 384, H = LC.H || 216, PI = Math.PI, TAU = PI * 2, D2R = PI / 180;
  var G = I.GPT = I.GPT || [{}, {}];
  var NA = 10, JAW = [0, 0.24, 0.46], HS = 0.86;   // aim angles, jaw poses, head scale
  var DUR = 70, EV = { enter: 0, lock: 12, open: 18, fire: 24, hits: [25, 30, 35, 40], burst: 44, dissolve: 52, end: 70 };

  // ---- head bake ---------------------------------------------------------------------------
  // head-local coords: +x = forward (snout), y down, (0,0) = the mouth point between the jaws.
  var UPPER = [4, -2, 2, -8, -6, -13, -16, -14, -30, -17, -44, -24, -52, -31, -62, -30, -76, -33, -92, -28, -104, -18, -106, -6, -96, 2, -74, 4, -50, 1, -24, 0, 0, 0];
  var SHADOW = [0, -3, -14, -7, -34, -8, -60, -9, -84, -8, -105, -9, -106, -6, -96, 2, -74, 4, -50, 1, -24, 0, 0, 0];
  var TOPHI = [2, -9, -6, -13, -16, -14, -30, -17, -44, -24, -52, -31, -62, -30, -76, -33, -92, -28, -92, -25, -76, -30, -62, -27, -52, -28, -44, -21, -30, -14, -16, -11, -6, -10];
  var JAWP = [-78, 0, -50, 2, -24, 2, -2, 2, 0, 5, -6, 9, -22, 12, -44, 15, -64, 16, -82, 12, -88, 4];
  var JAWSH = [-6, 9, -22, 12, -44, 15, -64, 16, -82, 12, -80, 9, -60, 12, -40, 11, -20, 8];
  var BEARD = [-30, 11, -36, 23, -40, 25, -42, 14];
  var FIN = [-86, -6, -114, -4, -102, 2, -124, 8, -104, 11, -118, 21, -96, 14, -82, 10];
  var FINSH = [-102, 2, -124, 8, -104, 11, -118, 21, -112, 14, -100, 9];
  var EYE = [-59, -21, -53, -25, -45, -23, -47, -18, -56, -18];
  var BROW = [-62, -24, -54, -29, -44, -27, -42, -24, -52, -26, -60, -22];
  var SPINES = [[-80, -32, -86, -42, -88, -31], [-90, -29, -98, -38, -98, -27], [-99, -22, -108, -28, -105, -17]];
  var HORN1 = [-68, -29, -86, -44, -106, -54, -128, -57, -146, -51], HORN2 = [-86, -22, -104, -33, -122, -35, -136, -30];

  function bakeHead(pal, ai, ji) {
    var g = G[pal], s = g.specU, P = LC.PAL.gpt[pal], Su = g.Su;
    var th = ai * 10 * D2R, c = Math.cos(th), sn = Math.sin(th), OX = 180, OY = 190, b = new I.Buf(262, 252);
    var phi = JAW[ji], hx = -74, hy = 2, jc = Math.cos(phi), js = Math.sin(phi);
    function P2(x, y) { x *= HS; y *= HS; return [OX + x * c - y * sn, OY + x * sn + y * c]; }
    function J2(x, y) { var dx = x - hx, dy = y - hy; return P2(hx + dx * jc - dy * js, hy + dx * js + dy * jc); }
    function hw(r) { return function (u) { return r(u) * HS; }; }
    function poly(L, col, jaw) { var o = []; for (var k = 0; k < L.length; k += 2) { var p = jaw ? J2(L[k], L[k + 1]) : P2(L[k], L[k + 1]); o.push(p[0], p[1]); } b.poly(o, col); }
    function tri(x0, y0, x1, y1, x2, y2, col, jaw) { poly([x0, y0, x1, y1, x2, y2], col, jaw); }
    function hornStroke(L, r0, r1, col) {
      var o = []; for (var k = 0; k < L.length; k += 2) { var p = P2(L[k], L[k + 1]); o.push(p[0], p[1]); }
      b.stroke(o, hw(function (u) { return r0 + (r1 - r0) * u; }), col);
    }
    // horns (behind the skull): base, shade underside, ridge bands
    hornStroke(HORN2, 3.6, 0.8, Su[2]);
    hornStroke(HORN1, 5.6, 0.9, Su[1]);
    var h1 = HORN1.map(function (v, k) { return k & 1 ? v - 1.6 : v; });
    hornStroke(h1, 2.4, 0.5, Su[0]);
    // cheek fin
    poly(FIN, s[3]); poly(FINSH, s[4]);
    // mouth interior (only visible when the jaw opens)
    if (ji > 0) {
      var mo = [];
      [[hx, hy], [-50, 1], [-24, 0], [2, 0]].forEach(function (q) { var p = P2(q[0], q[1]); mo.push(p[0], p[1]); });
      [[2, 2], [-24, 2], [-50, 2]].forEach(function (q) { var p = J2(q[0], q[1]); mo.push(p[0], p[1]); });
      b.poly(mo, s[5]);
      var mi = [];
      [[-50, 1], [-24, 0], [2, 0]].forEach(function (q) { var p = P2(q[0], q[1] + 2); mi.push(p[0], p[1]); });
      [[2, 2], [-24, 2]].forEach(function (q) { var p = J2(q[0], q[1] - 2); mi.push(p[0], p[1]); });
      b.poly(mi, s[4]);
      var mw = [];
      [[-30, 2], [2, 1]].forEach(function (q) { var p = P2(q[0], q[1] + 2); mw.push(p[0], p[1]); });
      [[2, 2], [-30, 1]].forEach(function (q) { var p = J2(q[0], q[1] - 2); mw.push(p[0], p[1]); });
      if (ji === 2) b.poly(mw, s[2]);
    }
    // lower jaw + beard spike
    poly(JAWP, s[3], true); poly(JAWSH, s[4], true); poly(BEARD, s[3], true);
    // upper head
    poly(UPPER, s[2]); poly(SHADOW, s[3]); poly(TOPHI, s[1]);
    SPINES.forEach(function (sp) { poly(sp, s[3]); });
    // scale scallops on the back of the skull (pattern in head-local space)
    var bd = b.d, BW = b.w;
    for (var y = 0; y < b.h; y++) for (var x = 0; x < BW; x++) {
      var i = y * BW + x, v = bd[i];
      if (v !== s[2] && v !== s[3]) continue;
      var dx = x + 0.5 - OX, dy = y + 0.5 - OY, lx = (dx * c + dy * sn) / HS, ly = (-dx * sn + dy * c) / HS;
      if (lx > -58 || lx < -106 || ly > 0) continue;
      var r = Math.floor((ly + 40) / 4), fx = ((lx + 200 + (r & 1) * 3) % 6 + 6) % 6, fy = ((ly + 40) % 4 + 4) % 4;
      if ((fy >= 3 && fx >= 1 && fx < 5) || (fy >= 2 && fy < 3 && (fx < 1 || fx >= 5))) bd[i] = v === s[2] ? s[3] : s[4];
    }
    // teeth (white), upper pointing down, lower pointing up (on the jaw)
    if (ji > 0) {
      [[-4, 3.5], [-12, 7], [-21, 3.5], [-30, 3.5], [-40, 3], [-50, 2.5]].forEach(function (q) { tri(q[0] - 2, 0, q[0] + 1.5, 0, q[0] - 0.5, q[1], s[0]); });
      [[-6, 6], [-17, 4], [-27, 3.5], [-37, 3]].forEach(function (q) { tri(q[0] - 2, 2, q[0] + 1.5, 2, q[0] - 0.5, 2 - q[1], s[0], true); });
    }
    // brow ridge + glowing eye
    poly(BROW, s[4]);
    b.outline(g.dkU);
    // glowing eye: dark socket, teal rim, white-hot core, glow trail streaming back
    poly([-62, -21, -54, -28, -43, -25, -41, -21, -47, -15, -58, -15], g.dkU);
    poly(EYE, s[4]);
    poly([-57, -21, -53, -24, -46, -22, -48, -19, -55, -18], s[0]);
    // inner line work after the outline: jaw seam (closed), nostril, eye-trail
    if (ji === 0) { var a0 = P2(-72, 3), a1 = P2(-2, 1); b.line(a0[0], a0[1], a1[0], a1[1], g.dkU); }
    var n0 = P2(-8, -9), n1 = P2(-10, -9); b.line(n0[0], n0[1], n1[0], n1[1], g.dkU);
    var t0 = P2(-62, -22), t1 = P2(-78, -22); b.line(t0[0], t0[1], t1[0], t1[1], s[4]);
    t0 = P2(-62, -20); t1 = P2(-72, -19); b.line(t0[0], t0[1], t1[0], t1[1], s[0]);
    // crop
    var bb = b.bounds(), cb = new I.Buf(bb.w, bb.h);
    for (y = 0; y < bb.h; y++) for (x = 0; x < bb.w; x++) cb.d[y * bb.w + x] = bd.length ? b.d[(y + bb.y) * BW + x + bb.x] : 0;
    var nk = P2(-92, 2);
    return { c: I.toCanvas(cb), ox: OX - bb.x, oy: OY - bb.y, nx: nk[0] - OX, ny: nk[1] - OY };
  }

  function bakeNeck(pal) {
    var g = G[pal], s = g.specU, r = 13, n = 30;
    // two passes at runtime: all outline discs, then all body discs -> one smooth scaled tube
    function mk(body, v) {
      var b = new I.Buf(n, n), cx = 15, cy = 15;
      if (!body) b.disc(cx, cy, r + 1, g.dkU);
      else {
        b.disc(cx, cy, r, s[4]);
        b.disc(cx - 1, cy - 1.5, r - 2, s[3]);
        b.disc(cx - 2.5, cy - 4, r - 6, s[2]);
        b.disc(cx - 3.5, cy - 6.5, r - 10, s[1]);
        for (var k = 0; k < 4; k++) { var a = 0.2 + k * 0.7, rr = r - 5; b.ring(cx + Math.cos(a) * rr * 0.55, cy + Math.sin(a) * rr * 0.55, 2.2, 3.2, s[4], 0.4, PI - 0.4); }
      }
      if (v) b.breakup(0.5, body ? 0 : 1, 0);
      return I.toCanvas(b);
    }
    return { o: [mk(false, 0), mk(false, 1)], b: [mk(true, 0), mk(true, 1)] };
  }

  function bakeSuper() {
    [0, 1].forEach(function (pal) {
      var g = G[pal];
      g.heads = [];
      for (var ai = 0; ai < NA; ai++) { var row = []; for (var ji = 0; ji < 3; ji++) row.push(bakeHead(pal, ai, ji)); g.heads.push(row); }
      g.neck = bakeNeck(pal);
      // tag labels Q / K / V (3x5 font, white with deep outline)
      g.tags = ['Q', 'K', 'V'].map(function (ch) { var tb = new I.Buf(7, 9); I.text35(tb, ch, 2, 2, I.col('#ffffff')); tb.outline(g.dkU); return I.toCanvas(tb); });
    });
  }
  I.onInit('gpt-super', bakeSuper);

  // ---- geometry --------------------------------------------------------------------------------
  function ease(u) { u = u < 0 ? 0 : u > 1 ? 1 : u; return 1 - (1 - u) * (1 - u) * (1 - u); }
  /** Heads in facing-right space: mouth M, aim angle, entry point E, neck sway phase. */
  var HD = [{}, {}, {}];
  function layout(t, tx, ty) {
    var hov = [
      [Math.max(tx - 128, Math.min(100, tx - 36)), I.clamp(ty - 46, 50, 120)],
      [I.clamp(tx - 30, 60, W - 60), I.clamp(ty - 64, 60, 110)],
      [Math.min(tx + 100, Math.max(W - 70, tx + 36)), I.clamp(ty - 58, 52, 120)]
    ];
    var ent = [[-150, 0, 0], [0, -170, 90], [W + 150, 0, 180]];   // entry offsets / travel angle
    for (var k = 0; k < 3; k++) {
      var h = HD[k], hv = hov[k], e = ent[k], u = ease((t - k * 2) / 13);
      var sx0 = k === 0 ? e[0] : k === 1 ? hv[0] + 46 : e[0], sy0 = k === 1 ? e[1] : hv[1] + (k ? 26 : 36);
      var bulge = Math.sin(u * PI) * (k === 1 ? -24 : 26);
      h.mx = sx0 + (hv[0] - sx0) * u + (k === 1 ? bulge : 0);
      h.my = sy0 + (hv[1] - sy0) * u + (k === 1 ? 0 : -bulge);
      if (u >= 1) h.my += Math.round(Math.sin(t * 0.16 + k * 2.1) * 2);
      var aim = Math.atan2(ty - h.my, tx - h.mx) / D2R;
      if (aim < 0) aim = aim < -90 ? 180 : 0;
      var a = e[2] + (aim - e[2]) * ease((t - k * 2 - 4) / 10);
      if (t >= EV.fire && t < EV.fire + 3) { h.mx -= Math.cos(aim * D2R) * 3; h.my -= Math.sin(aim * D2R) * 3; }   // recoil
      h.aim = aim; h.ang = a; h.u = u;
      h.ex = k === 1 ? hv[0] + 70 : e[0] * 1.1; h.ey = k === 1 ? -200 : hv[1] + 70;
      h.mx = Math.round(h.mx); h.my = Math.round(h.my);
    }
    return HD;
  }
  function headSpr(g, ang, j) {
    var mir = ang > 90, a = mir ? 180 - ang : ang, ai = Math.max(0, Math.min(NA - 1, Math.round(a / 10)));
    return { s: g.heads[ai][j], mir: mir };
  }

  // ---- runtime draw helpers ------------------------------------------------------------------------
  /** Thick line: runs of thickness th centred on the line (x-major: vertical runs; y-major: horizontal). */
  function thick(ctx, x0, y0, x1, y1, hw) {
    var xm = Math.abs(x1 - x0) >= Math.abs(y1 - y0), th = hw * 2 + 1;
    if (xm) I.runLine(ctx, x0, y0 - hw, x1, y1 - hw, th); else I.runLine(ctx, x0 - hw, y0, x1 - hw, y1, th);
  }
  function disc(ctx, cx, cy, r) {
    if (r < 0.5) { ctx.fillRect(cx, cy, 1, 1); return; }
    var y0 = Math.max(-r, -cy - 8), y1 = Math.min(r, H + 8 - cy);
    for (var y = Math.ceil(y0); y <= y1; y++) { var hw = Math.floor(Math.sqrt(Math.max(0, (r + 0.5) * (r + 0.5) - y * y))); ctx.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); }
  }
  function annulus(ctx, cx, cy, r0, r1) {
    var y0 = Math.max(-r1, -cy - 8), y1 = Math.min(r1, H + 8 - cy);
    for (var y = Math.ceil(y0); y <= y1; y++) {
      var ho = Math.floor(Math.sqrt(Math.max(0, (r1 + 0.5) * (r1 + 0.5) - y * y)));
      var hi = y * y < r0 * r0 ? Math.floor(Math.sqrt(r0 * r0 - y * y)) : -1;
      if (hi < 0) { ctx.fillRect(cx - ho, cy + y, ho * 2 + 1, 1); continue; }
      var wl = ho - hi; if (wl <= 0) continue;
      ctx.fillRect(cx - ho, cy + y, wl, 1); ctx.fillRect(cx + hi + 1, cy + y, wl, 1);
    }
  }
  I.gptDisc = disc; I.gptAnnulus = annulus;

  function bez(p0, p1, p2, p3, u) { var a = 1 - u; return a * a * a * p0 + 3 * a * a * u * p1 + 3 * a * u * u * p2 + u * u * u * p3; }
  function drawNeck(ctx, g, h, hs, t, k) {
    var ar = h.ang * D2R, dx = Math.cos(ar), dy = Math.sin(ar);
    var nx = h.mx + (hs.mir ? -hs.s.nx : hs.s.nx), ny = h.my + hs.s.ny;
    var sw = Math.sin(t * 0.07 + k * 1.9) * 26;
    var x1 = nx - dx * 54, y1 = ny - dy * 54, x2 = h.ex + (k === 1 ? sw : 0), y2 = h.ey + (k === 1 ? 0 : sw), x3 = h.ex, y3 = h.ey;
    if (k === 1) { x2 = (x1 + h.ex) / 2 + sw; y2 = (y1 + h.ey) / 2; } else { x2 = (x1 + h.ex) / 2; y2 = (y1 + h.ey) / 2 + 30 + sw; }
    var n = 40, i, u, px, py;
    for (var pass = 0; pass < 2; pass++) {
      var set = pass ? g.neck.b : g.neck.o;
      for (i = n; i >= 0; i--) {
        u = i / n; px = bez(nx, x1, x2, x3, u); py = bez(ny, y1, y2, y3, u);
        if (px < -24 || px > W + 24 || py < -24 || py > H + 24) continue;
        ctx.drawImage(set[u > 0.62 ? 1 : 0], Math.round(px) - 15, Math.round(py) - 15);
      }
    }
  }
  function drawHead(ctx, hs, mx, my) {
    var s = hs.s;
    if (!hs.mir) ctx.drawImage(s.c, mx - s.ox, my - s.oy);
    else I.mirrored(ctx, mx, -1, function () { ctx.drawImage(s.c, mx - s.ox, my - s.oy); });
  }

  /** Dashed marching line from (x0,y0) to (x1,y1), 1 px. */
  function dashed(ctx, x0, y0, x1, y1, t, frac, cLine, cShadow) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy), n = Math.floor(L * frac), s;
    for (var pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? cLine : cShadow;
      for (s = 0; s < n; s++) { if (((s - t * 2) % 7 + 7) % 7 < 4) ctx.fillRect(Math.round(x0 + dx * s / L), Math.round(y0 + dy * s / L) + (pass ? 0 : 1), 1, 1); }
    }
  }

  // ---- the sprite ----------------------------------------------------------------------------
  function draw(ctx, sx, sy, t, o) {
    if (t >= DUR) return;
    var g = G[o.pal], raw = o.raw, f = o.facing, part = raw.part;
    var tx0 = raw.tx == null ? W * 0.68 : +raw.tx, ty = Math.round(raw.ty == null ? 140 : +raw.ty);
    var tx = Math.round(f > 0 ? tx0 : W - tx0), sf = I.softFlash();
    var hd = layout(t, tx, ty), L = g.L, a0 = ctx.globalAlpha;
    var dis = t >= EV.dissolve ? 1 - Math.floor((t - EV.dissolve) / 3 + 1) * 0.2 : 1;
    var jaw = t < EV.open ? 0 : t < EV.open + 3 ? 1 : 2;
    var k, h;
    I.mirrored(ctx, sx + W / 2, f, function () {
      ctx.translate(sx, sy);
      if (part !== 'front' && dis > 0) {
        ctx.globalAlpha = a0 * dis;
        var hsArr = [];
        for (k = 0; k < 3; k++) { h = hd[k]; hsArr.push(headSpr(g, h.ang, jaw)); drawNeck(ctx, g, h, hsArr[k], t, k); }
        for (k = 0; k < 3; k++) drawHead(ctx, hsArr[k], hd[k].mx, hd[k].my);
        ctx.globalAlpha = a0;
      }
      if (part !== 'back') drawFront(ctx, g, hd, t, tx, ty, L, sf, a0);
      ctx.translate(-sx, -sy);
    });
    if (part !== 'back' && t >= EV.lock && t < EV.fire) {   // Q / K / V tags (never mirrored)
      for (k = 0; k < 3; k++) {
        h = hd[k];
        var u = 0.42, lx = h.mx + (tx - h.mx) * u, ly = h.my + (ty - h.my) * u - 9;
        if (f < 0) lx = W - lx;
        if (((t - EV.lock) >> 1) % 6 !== 5 || t - EV.lock < 6) ctx.drawImage(g.tags[k], sx + Math.round(lx) - 3, sy + Math.round(ly) - 4);
      }
    }
  }

  function drawFront(ctx, g, hd, t, tx, ty, L, sf, a0) {
    var k, h, ar, dx, dy, mx, my;
    // lock: dashed lines + reticle
    if (t >= EV.lock && t < EV.fire + 2) {
      var gr = Math.min(1, (t - EV.lock + 1) / 4);
      for (k = 0; k < 3; k++) {
        h = hd[k]; ar = h.aim * D2R;
        dashed(ctx, h.mx + Math.cos(ar) * 6, h.my + Math.sin(ar) * 6, tx, ty, t, gr, (t >> 1) & 1 ? L[0] : L[1], L[4]);
      }
      var rs = Math.max(10, Math.round(30 - (t - EV.lock) * 2.6)), bl = 6;
      for (var rp = 0; rp < 2; rp++) {
        ctx.fillStyle = rp ? (t - EV.lock > 8 && (t & 2) ? L[1] : L[0]) : L[4];
        for (var q = 0; q < 4; q++) {
          var qx = q & 1 ? 1 : -1, qy = q & 2 ? 1 : -1, cx = tx + qx * rs + (rp ? 0 : 1), cy = ty + qy * rs + (rp ? 0 : 1);
          ctx.fillRect(qx > 0 ? cx - bl + 1 : cx, cy, bl, 2 - rp); ctx.fillRect(cx, qy > 0 ? cy - bl + 1 : cy, 2 - rp, bl);
        }
      }
      ctx.fillStyle = L[2];
      ctx.fillRect(tx - 2, ty, 5, 1); ctx.fillRect(tx, ty - 2, 1, 5);
    }
    // mouth charge (open .. fire)
    if (t >= EV.open && t < EV.fire) {
      var cr = 1 + (t - EV.open) * 0.9;
      for (k = 0; k < 3; k++) {
        h = hd[k]; ar = h.aim * D2R; mx = Math.round(h.mx + Math.cos(ar) * 5); my = Math.round(h.my + Math.sin(ar) * 5);
        ctx.fillStyle = L[3]; disc(ctx, mx, my, cr + 2);
        ctx.fillStyle = L[1]; disc(ctx, mx, my, cr + 1);
        ctx.fillStyle = L[0]; disc(ctx, mx, my, cr * 0.6);
        ctx.fillStyle = L[1];
        for (var p = 0; p < 6; p++) {   // inward streaks
          var pa = p * TAU / 6 + t * 0.4 + k, pr = 18 - ((t * 3 + p * 5) % 14);
          ctx.fillRect(mx + Math.round(Math.cos(pa) * pr), my + Math.round(Math.sin(pa) * pr), 2, 1);
        }
      }
    }
    // beams
    var fireEnd = EV.burst + 4;
    if (t >= EV.fire && t < fireEnd) {
      var gl = Math.min(1, (t - EV.fire + 1) / 3), fade = t >= EV.burst ? 1 - (t - EV.burst + 1) / 5 : 1;
      for (k = 0; k < 3; k++) {
        h = hd[k]; ar = h.aim * D2R; dx = Math.cos(ar); dy = Math.sin(ar);
        mx = h.mx + dx * 5; my = h.my + dy * 5;
        var ex = mx + (tx - mx) * gl, ey = my + (ty - my) * gl;
        var hw = Math.max(1, Math.round((7 + ((t + k) % 3 === 0 ? 1 : 0)) * fade));
        ctx.fillStyle = L[5]; thick(ctx, mx, my, ex, ey, hw + 1);
        ctx.fillStyle = L[3]; thick(ctx, mx, my, ex, ey, hw);
        ctx.fillStyle = L[2]; thick(ctx, mx, my, ex, ey, hw - 2);
        if (hw > 4) { ctx.fillStyle = L[1]; thick(ctx, mx, my, ex, ey, hw - 4); }
        ctx.fillStyle = L[0]; thick(ctx, mx, my, ex, ey, hw > 5 ? 1 : 0);
        // tokens racing along the beam (attention weights)
        var bl2 = Math.sqrt((ex - mx) * (ex - mx) + (ey - my) * (ey - my));
        for (var d = 0; d < 4; d++) {
          var s0 = ((t * 11 + d * 29 + k * 13) % 116) / 116 * bl2;
          var px = Math.round(mx + dx * s0), py = Math.round(my + dy * s0);
          ctx.fillStyle = L[0]; ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 1, 1, 3);
          ctx.fillStyle = L[1]; ctx.fillRect(px + Math.round(-dx * 4) - 1, py + Math.round(-dy * 4), 2, 1);
        }
        // muzzle flare
        var fr = 5 + ((t + k) & 1) * 2;
        ctx.fillStyle = L[1]; disc(ctx, Math.round(mx), Math.round(my), fr + 2);
        ctx.fillStyle = L[0]; disc(ctx, Math.round(mx), Math.round(my), fr);
        ctx.fillStyle = L[0];
        var pa2 = ar + PI / 2;
        I.runLine(ctx, mx + Math.cos(pa2) * (fr + 7), my + Math.sin(pa2) * (fr + 7), mx - Math.cos(pa2) * (fr + 7), my - Math.sin(pa2) * (fr + 7), 1);
      }
    }
    // convergence orb (fire .. burst), then the burst
    if (t >= EV.fire + 1 && t < EV.burst) {
      var orr = Math.min(16, 6 + (t - EV.fire) * 1.4) + ((t >> 1) & 1) * 2;
      ctx.fillStyle = L[4]; disc(ctx, tx, ty, orr + 3);
      ctx.fillStyle = L[2]; disc(ctx, tx, ty, orr + 1);
      ctx.fillStyle = L[1]; disc(ctx, tx, ty, orr - 1);
      ctx.fillStyle = L[0]; disc(ctx, tx, ty, orr * 0.62);
      ctx.fillStyle = L[0];                 // 8 spikes, 2 rotation frames
      for (var sp = 0; sp < 8; sp++) {
        var sa = sp * TAU / 8 + ((t >> 1) & 1) * PI / 8, sl = sp & 1 ? 10 : 18;
        I.runLine(ctx, tx + Math.cos(sa) * (orr + 2), ty + Math.sin(sa) * (orr + 2), tx + Math.cos(sa) * (orr + sl), ty + Math.sin(sa) * (orr + sl), 1);
      }
    }
    if (t >= EV.burst) drawBurst(ctx, g, hd, t - EV.burst, tx, ty, L, sf, a0);
  }

  function drawBurst(ctx, g, hd, b, tx, ty, L, sf, a0) {
    var k;
    if (b < 6) {     // swelling orb
      var r = 16 + b * b * 4 + b * 2;
      ctx.fillStyle = L[4]; disc(ctx, tx, ty, r + 4);
      ctx.fillStyle = L[2]; disc(ctx, tx, ty, r + 1);
      ctx.fillStyle = L[1]; disc(ctx, tx, ty, r * 0.86);
      ctx.fillStyle = L[0]; disc(ctx, tx, ty, r * 0.66);
    }
    if (b >= 2 && b < 16) {   // radial rays
      ctx.fillStyle = L[0];
      for (k = 0; k < (sf ? 14 : 28); k++) {
        var h1 = I.hash(k * 7 + 41), a = (k + h1 * 0.7) * TAU / (sf ? 14 : 28), r0 = 20 + b * b * 2 + h1 * 30;
        ctx.fillStyle = k % 3 ? L[1] : L[0];
        I.radialRay(ctx, tx, ty, a, r0, r0 + 60 + h1 * 120, k % 4 === 0 && b < 8 ? 2 : 1);
      }
    }
    if (b >= 2 && b < 18) {   // shock rings
      var r1 = (b - 2) * 24 + 40, th = Math.max(1, 6 - (b >> 1));
      ctx.fillStyle = b < 8 ? L[0] : L[1]; annulus(ctx, tx, ty, r1 - th, r1);
      if (b >= 5) { var r2 = (b - 5) * 20 + 30; ctx.fillStyle = L[2]; annulus(ctx, tx, ty, r2 - Math.max(1, th - 2), r2); }
    }
    if (b >= 4 && b < 8) {    // full-screen flash
      ctx.globalAlpha = a0 * (sf ? 0.25 : [0.9, 0.7, 0.45, 0.22][b - 4]);
      ctx.fillStyle = b < 6 ? L[0] : L[1]; ctx.fillRect(-8, -8, W + 16, H + 16);
      ctx.globalAlpha = a0;
    }
    if (b >= 5 && b < 11) {   // full-screen teal wedge burst (the super-finish image), stepping out
      var fin = I.sprites['screen.superFinish'];
      BO.pal = BO.palette = g === G[1] ? 1 : 0; BO.cx = tx; BO.cy = ty;
      ctx.globalAlpha = a0 * (sf ? 0.5 : 1) * [0.9, 0.85, 0.7, 0.5, 0.32, 0.16][b - 5];
      fin.draw(ctx, 0, 0, 9, BO);
      ctx.globalAlpha = a0;
    }
    if (b >= 6 && b < 14) {   // after-glow core
      var cr = Math.max(0, 22 - (b - 6) * 3);
      ctx.fillStyle = L[1]; disc(ctx, tx, ty, cr + 2); ctx.fillStyle = L[0]; disc(ctx, tx, ty, cr);
    }
    // heads dissolve into falling scales
    var ds = b - (EV.dissolve - EV.burst);
    if (ds >= -2 && ds < 22) {
      var dt = ds + 2;
      for (k = 0; k < 3; k++) {
        var h = hd[k], ar = h.ang * D2R, dx = Math.cos(ar), dy = Math.sin(ar);
        for (var i = 0; i < 16; i++) {
          var q1 = I.hash(i * 13 + k * 101 + 3), q2 = I.hash(i * 7 + k * 53 + 9), q3 = I.hash(i * 29 + k * 17);
          if (dt < q3 * 6) continue;
          var e = dt - q3 * 6, along = 6 + q1 * 96, side = (q2 - 0.5) * 34;
          var px = h.mx - dx * along - dy * side + (q2 - 0.5) * 1.6 * e + Math.sin(e * 0.2 + i) * 3, py = h.my - dy * along + dx * side + e * (0.5 + q1 * 0.7) + 0.02 * e * e;
          if (e > 16 && ((e + i) & 1)) continue;
          I.gptScale(ctx, g === G[1] ? 1 : 0, i % 4 === 0 ? 1 : 0, (e >> 2) + i, Math.round(px), Math.round(py));
        }
      }
    }
  }

  var BO = { char: 'gpt', pal: 0, palette: 0, cx: 0, cy: 0, facing: 1, raw: {} };
  var info = { duration: DUR, bbox: { x: 0, y: 0, w: W, h: H }, events: EV, frames: [], hitbox: { x: -16, y: -20, w: 32, h: 40 }, burstBox: { x: -48, y: -48, w: 96, h: 96 } };
  for (var t = 0; t < DUR; t++) {
    if (t > EV.fire && t < EV.burst) info.frames.push({ x: -16, y: -20, w: 32, h: 40 });
    else if (t >= EV.burst && t < EV.burst + 6) info.frames.push({ x: -48, y: -48, w: 96, h: 96 });
    else info.frames.push({ x: 0, y: 0, w: 0, h: 0 });
  }
  I.defSprite('gpt.attention', {
    desc: 'GPT super 注意力即一切: three huge spectral dragon heads on long scaled necks sweep in (left / top / right), dashed targeting lines + closing reticle lock on (Q K V tags), jaws open and charge, three thick teal-white beams converge on the target orb, which swells into a full-screen burst; heads dissolve into falling scales. 70f.',
    use: 'drawSprite(ctx,"gpt.attention",0,0,t,{tx,ty,facing,palette,part}) with tx,ty = the target point on SCREEN (victim chest). part:"back" (necks + heads) at layer [C] behind the fighters, part:"front" (lines, beams, orb, burst, scales) at [D]. events {lock 12, open 18, fire 24, hits 25/30/35/40, burst 44, dissolve 52}; frames[t] = hit box rel. the target point (w = 0: none).',
    info: info,
    draw: draw
  });
})();
