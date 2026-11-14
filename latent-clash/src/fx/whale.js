/* LATENT CLASH — FX: DeepSeek 娘 super 深度思考·鲸落 DEEPTHINK: WHALE FALL (owned by FX).
 * deepseek.whale v2 — a ~300x170 px whale "R1" (blue back, pale belly with pleats, cyan glow
 * circuit lines, eye + blush, pectoral fin, fish-like flukes). The straight body is designed
 * once per palette in a local (u along the body, v across) bitmap and forward-warped
 * (4 sub-samples / px) along a bent spine for every pose: it bursts out of the floor,
 * arcs across the screen arched at the apex (hang), then dives head-first with the flukes
 * kicking up. Details (glow lines, pleats, mouth, eye) are drawn after the warp so they stay
 * crisp; the outline is added last; everything below the floor is cut (water hides it).
 * The R1 lettering is a separate rotated sprite so it reads correctly for both facings.
 * deepseek.tidal — the full-width tidal wave pushed out by the crash.
 * Stateless: pure functions of t. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var A = I.A = I.A || {};
  var GY = LC.GROUND_Y || 186;
  var DUR = 60, BL = 300, VM = 66;                 // duration, body length, max |v|
  var X0 = -14, X1 = 204, Y0 = 136, Y1 = 64, HA = 208;   // centre path (rel. origin, facing right)
  var TA = 27, TD = 24, PW = 1.6;                  // apex tick, half-duration, hang exponent
  var info = { duration: DUR, bbox: { x: -60, y: -205, w: 330, h: 206 }, frames: [], events: { emerge: 3, apex: TA, crash: 49 }, crashX: 160 };
  var WH = [{}, {}];

  // ---- motion ------------------------------------------------------------------------
  function tau(t) {
    var s = (t - TA) / TD, as = Math.abs(s), g = as <= 1 ? Math.pow(as, PW) : 1 + PW * (as - 1);
    return 0.5 + 0.5 * (s < 0 ? -g : g);
  }
  function pose(t) {
    var u = tau(t), cx = X0 + (X1 - X0) * u, cy = (1 - u) * Y0 + u * Y1 - 4 * HA * u * (1 - u);
    var th = Math.atan2(Y1 - Y0 - 4 * HA * (1 - 2 * u), X1 - X0);
    if (th > 0) th *= 0.58;                                                  // falls flatter than its path: a slam, not a dive
    var k = 0.22 + 0.42 * Math.sin(PI * I.clamp(u, 0, 1));                 // arch (back up) strongest at the apex
    var fk = u < 0.45 ? -0.35 * (1 - u / 0.45) : I.clamp((u - 0.5) / 0.35, 0, 1) * 1.05;   // flukes trail, then kick up on the dive
    return { cx: cx, cy: cy, th: th, k: k, fk: fk };
  }
  /** Spine points (i = 0 tail tip .. BL snout): x, y, angle. */
  var SPX = new Float32Array(BL + 1), SPY = new Float32Array(BL + 1), SPA = new Float32Array(BL + 1);
  function spine(p) {
    var mid = BL >> 1, i;
    for (i = 0; i <= BL; i++) {
      var s = i / BL, a = p.th + p.k * (s - 0.5);
      if (s < 0.3) a += p.fk * Math.pow((0.3 - s) / 0.3, 2);
      SPA[i] = a;
    }
    SPX[mid] = p.cx; SPY[mid] = p.cy;
    for (i = mid + 1; i <= BL; i++) { var am = (SPA[i - 1] + SPA[i]) / 2; SPX[i] = SPX[i - 1] + Math.cos(am); SPY[i] = SPY[i - 1] + Math.sin(am); }
    for (i = mid - 1; i >= 0; i--) { var an = (SPA[i + 1] + SPA[i]) / 2; SPX[i] = SPX[i + 1] - Math.cos(an); SPY[i] = SPY[i + 1] - Math.sin(an); }
  }
  /** Local (u,v) -> world (rel. origin) using the current spine. */
  var OUT = [0, 0];
  function map(u, v) {
    if (u < 0) u = 0; if (u > BL - 0.001) u = BL - 0.001;
    var i = Math.floor(u), f = u - i, a = SPA[i] + (SPA[i + 1] - SPA[i]) * f;
    OUT[0] = SPX[i] + (SPX[i + 1] - SPX[i]) * f - Math.sin(a) * v;
    OUT[1] = SPY[i] + (SPY[i + 1] - SPY[i]) * f + Math.cos(a) * v;
    return OUT;
  }

  // ---- body design (local bitmap) -------------------------------------------------------
  function hh(s) {   // half thickness
    if (s < 0.075) return 0;
    if (s < 0.62) return 7 + 41 * Math.pow((s - 0.075) / 0.545, 0.85);
    return 48 * Math.sqrt(Math.max(0, 1 - Math.pow((s - 0.62) / 0.385, 2)));
  }
  function sideY(s) { return hh(s) * 0.16 - (s > 0.78 ? (s - 0.78) * 60 : 0); }   // back/belly boundary (mouth rises to the snout)
  // colour indices (the warp works on indices once; each palette recolours the result)
  var IX = { B: [1, 2, 3, 4], Be: [5, 6, 7, 8], G: [9, 10, 11], O: 12, blush: 13, white: 14 };
  function lutFor(pal) {
    var P = LC.PAL.deepseek[pal], hr = P.hair, sc = I.scheme('deepseek', pal);
    var back = pal === 0 ? [hr[0], hr[1], hr[2], hr[3]] : [hr[1], hr[2], hr[3], I.mix(hr[3], P.outline, 0.45)];
    var belly = ['#ffffff', '#e8eefc', '#b8c5ea', '#8492c6'];
    var lut = new Uint32Array(16);
    back.forEach(function (c, i) { lut[1 + i] = I.col(c); });
    belly.forEach(function (c, i) { lut[5 + i] = I.col(c); });
    lut[9] = sc.glow.u[0]; lut[10] = sc.glow.u[1]; lut[11] = sc.glow.u[2];
    lut[12] = I.col(P.outline); lut[13] = I.col(P.blush); lut[14] = I.col('#ffffff');
    return lut;
  }
  function recolor(buf, lut) { var b = new I.Buf(buf.w, buf.h), d = b.d, s = buf.d; for (var i = 0; i < s.length; i++) if (s[i]) d[i] = lut[s[i]]; return b; }
  function designBody() {
    var Wd = BL, Hd = VM * 2 + 1, b = new I.Buf(Wd, Hd), B = IX.B, Be = IX.Be;
    function put(u, v, c) { b.set(u, v + VM, c); }
    // flukes (fish-like V) + tail stock
    var fl = new I.Buf(Wd, Hd);
    fl.poly([30, VM - 7, 10, VM - 60, 0, VM - 62, 9, VM - 30, 16, VM, 9, VM + 30, 0, VM + 62, 10, VM + 60, 30, VM + 7], B[1]);
    fl.poly([10, VM - 60, 0, VM - 62, 5, VM - 52, 13, VM - 30], B[0]);
    fl.poly([0, VM + 62, 10, VM + 60, 14, VM + 40, 6, VM + 50], B[2]);
    b.blit(fl, 0, 0);
    for (var u = 0; u < Wd; u++) {
      var s = (u + 0.5) / Wd, h = hh(s);
      if (h <= 0.4) continue;
      var top = -h, bot = h * 0.94, yb = sideY(s);
      for (var v = Math.ceil(top); v <= Math.floor(bot); v++) {
        var c;
        if (v < yb) c = v < top + 3 ? B[0] : v > yb - 4 ? B[2] : (v < top + 7 && I.bayer(u, v) < 0.5 ? B[0] : B[1]);
        else c = v > bot - 3 ? Be[2] : v > bot - 7 && I.bayer(u, v) < 0.5 ? Be[1] : Be[0];
        put(u, v, c);
      }
    }
    // dorsal fin
    var df = new I.Buf(Wd, Hd);
    df.poly([104, VM - hh(0.35) + 2, 118, VM - hh(0.4) - 13, 124, VM - hh(0.41) - 12, 126, VM - hh(0.42) + 2], B[1]);
    df.poly([118, VM - hh(0.4) - 13, 124, VM - hh(0.41) - 12, 120, VM - hh(0.4) - 8], B[0]);
    b.blit(df, 0, 0);
    // pectoral fin (near side, over the belly)
    var pf = new I.Buf(Wd, Hd);
    pf.poly([214, VM + 18, 196, VM + 30, 166, VM + 58, 160, VM + 62, 170, VM + 62, 204, VM + 40, 224, VM + 24], B[1]);
    pf.poly([214, VM + 18, 196, VM + 30, 166, VM + 58, 172, VM + 56, 208, VM + 30], B[0]);
    pf.outline(B[3]);
    b.blit(pf, 0, 0);
    return b;
  }

  // ---- pose bake -------------------------------------------------------------------------
  function bakePose(src, p, clipFloor) {
    spine(p);
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, i;
    for (i = 0; i <= BL; i += 4) {
      var n0x = -Math.sin(SPA[i]), n0y = Math.cos(SPA[i]);
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var px = SPX[i] + n0x * VM * sgn, py = SPY[i] + n0y * VM * sgn;
        if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py;
      }
    }
    var ox = Math.floor(minx) - 4, oy = Math.floor(miny) - 4;
    if (clipFloor) maxy = Math.min(maxy, 2);
    var W = Math.ceil(maxx) - ox + 5, H = Math.max(1, Math.ceil(maxy) - oy + 5);
    if (H <= 5) return null;
    var b = new I.Buf(W, H), bd = b.d, sd = src.d, SW = src.w, SH = src.h, u, v, q;
    for (u = 0; u < SW; u++) for (q = 0; q < 2; q++) {
      var m = map(u + (q ? 0.75 : 0.25), 0), bx0 = m[0] - ox, by0 = m[1] - oy, ia = Math.min(BL - 1, u), a = SPA[ia], nx = -Math.sin(a), ny = Math.cos(a);
      for (v = 0; v < SH; v++) {
        var c = sd[v * SW + u];
        if (!c) continue;
        for (var r = 0; r < 2; r++) {
          var vv = v - VM + (r ? 0.75 : 0.25), X = Math.floor(bx0 + nx * vv), Y = Math.floor(by0 + ny * vv);
          if (X >= 0 && Y >= 0 && X < W && Y < H) bd[Y * W + X] = c;
        }
      }
    }
    function lineUV(u0, v0, u1, v1, c) {
      var a = map(u0, v0), ax = Math.round(a[0] - ox), ay = Math.round(a[1] - oy), e = map(u1, v1);
      b.line(ax, ay, Math.round(e[0] - ox), Math.round(e[1] - oy), c);
    }
    function dotUV(u0, v0, w, h, c) { var a = map(u0, v0); b.rect(Math.round(a[0] - ox - w / 2), Math.round(a[1] - oy - h / 2), w, h, c); }
    var B = IX.B, Be = IX.Be, G = IX.G, s;
    // belly pleats (throat grooves) and the mouth line
    for (var g = 0; g < 4; g++) {
      var pu0 = 168 + g * 8, pu1 = 282 - g * 6;
      for (u = pu0; u < pu1; u += 3) { s = u / BL; var vv = sideY(s) + 7 + g * 6.5; if (vv < hh(s) * 0.9 - 2) lineUV(u, vv, u + 3, sideY((u + 3) / BL) + 7 + g * 6.5, Be[1]); }
    }
    for (u = 236; u < 299; u += 2) { s = u / BL; lineUV(u, sideY(s), u + 2, sideY((u + 2) / BL), B[3]); }
    // glow circuit line along the back with nodes and short branches
    for (u = 40; u < 262; u += 3) {
      s = u / BL; var v1 = -hh(s) + 9 + Math.sin(u * 0.06) * 1.5, s2 = (u + 3) / BL;
      lineUV(u, v1, u + 3, -hh(s2) + 9 + Math.sin((u + 3) * 0.06) * 1.5, G[1]);
    }
    for (u = 64; u < 262; u += 36) {
      s = u / BL; var vn = -hh(s) + 9 + Math.sin(u * 0.06) * 1.5;
      dotUV(u, vn, 3, 3, G[1]); dotUV(u, vn, 1, 1, G[0]);
      lineUV(u, vn, u + 6, vn + 8, G[2]); dotUV(u + 6, vn + 8, 2, 2, G[1]);
    }
    for (u = 14; u < 30; u += 2) { lineUV(u, -8 - (30 - u) * 2.9, u + 2, -8 - (28 - u) * 2.9, G[2]); lineUV(u, 8 + (30 - u) * 2.9, u + 2, 8 + (28 - u) * 2.9, G[2]); }
    // eye + blush
    var e = map(270, -6), ex = Math.round(e[0] - ox), ey = Math.round(e[1] - oy);
    b.rect(ex - 2, ey - 3, 5, 7, IX.O); b.rect(ex - 3, ey - 2, 7, 5, IX.O); b.rect(ex - 1, ey - 2, 2, 2, IX.white); b.rect(ex, ey + 1, 2, 1, G[1]);
    var bl = map(262, 6); b.rect(Math.round(bl[0] - ox) - 3, Math.round(bl[1] - oy), 6, 2, IX.blush);
    b.outline(IX.O);
    if (clipFloor) b.erase(function (x, y) { return y + oy > 1; });
    var bb = b.bounds();
    if (!bb) return null;
    var r1 = map(150, -hh(0.5) * 0.42);
    return { buf: b, ox: ox - p.cx, oy: oy - p.cy, cx: p.cx, cy: p.cy, bb: { x: ox + bb.x, y: oy + bb.y, w: bb.w, h: bb.h }, r1x: r1[0] - p.cx, r1y: r1[1] - p.cy, r1a: SPA[150] };
  }
  /** Which baked pose a tick uses: 2-tick holds while the whole whale is in the air. */
  var POSEKEY = [];
  function airborne(t) { spine(pose(t)); for (var i = 0; i <= BL; i += 6) if (SPY[i] + VM > -2) return false; return true; }
  function poseTick(t) { return POSEKEY[t] == null ? t : POSEKEY[t]; }

  // ---- R1 lettering, 25 rotations ----------------------------------------------------------
  var R1G = {
    R: ['#######.', '########', '##....##', '##....##', '########', '#######.', '##..##..', '##...##.', '##....##', '##....##'],
    1: ['..##', '.###', '####', '..##', '..##', '..##', '..##', '..##', '####', '####']
  };
  function r1Buf(lut) {
    var b = new I.Buf(20, 16), c = lut[5];
    ['R', '1'].forEach(function (ch, ci) { var g = R1G[ch]; for (var y = 0; y < g.length; y++) for (var x = 0; x < g[y].length; x++) if (g[y][x] === '#') b.set(3 + x + ci * 10, 3 + y, c); });
    b.outline(lut[11]);
    return b;
  }

  function bake() {
    var t0 = performance.now();
    for (var tk = 0; tk < DUR; tk++) POSEKEY[tk] = tk >= 4 && airborne(tk) && airborne(tk & ~1) ? tk & ~1 : tk;
    var src = designBody(), luts = [lutFor(0), lutFor(1)];
    WH[0].poses = {}; WH[1].poses = {};
    for (var t = 3; t <= 58; t++) {
      var pt = poseTick(t);
      if (WH[0].poses[pt] !== undefined) continue;
      var P0 = bakePose(src, pose(pt), pt === t);
      [0, 1].forEach(function (pal) {
        if (!P0) { WH[pal].poses[pt] = null; return; }
        var Q = {}; for (var k in P0) if (k !== 'buf') Q[k] = P0[k];
        Q.c = I.toCanvas(recolor(P0.buf, luts[pal]));
        WH[pal].poses[pt] = Q;
      });
    }
    [0, 1].forEach(function (pal) {
      var rb = r1Buf(luts[pal]), up = rb.scale2x().scale2x(), Wd = WH[pal];
      Wd.r1 = [];
      for (var k = 0; k < 25; k++) { var rr = I.rotate(rb, (k - 12) * PI / 24, 10, 8, up); Wd.r1.push({ c: I.toCanvas(rr.buf), px: rr.px, py: rr.py }); }
    });
    // per-frame hitboxes (facing right, rel. origin, above the floor), crash tick and point
    info.frames = [];
    var crash = -1;
    for (t = 0; t < DUR; t++) {
      var P = t >= 3 && t <= 58 ? WH[0].poses[poseTick(t)] : null, fr = { x: 0, y: 0, w: 0, h: 0 };
      if (P) {
        var p = pose(t), dx = p.cx - P.cx, dy = p.cy - P.cy, x0 = P.bb.x + dx, y0 = P.bb.y + dy, y1 = Math.min(0, y0 + P.bb.h);
        if (y1 - y0 > 12) fr = { x: Math.round(x0 + 10), y: Math.round(y0 + 10), w: Math.max(0, Math.round(P.bb.w - 20)), h: Math.max(0, Math.round(y1 - y0 - 10)) };
      }
      info.frames.push(fr);
      if (crash < 0 && t > TA) { var pc = pose(t); if (pc.cy >= -44) { crash = t; info.crashX = Math.round(pc.cx + 24); } }
    }
    info.events.crash = crash > 0 ? crash : 49;
    I.whaleBakeMs = performance.now() - t0;
  }
  I.onInit('whale', bake);

  function waterDrops(ctx, Wc, sx, sy, t, t0, n, cx, seed, vmax, spread) {
    for (var k = 0; k < n; k++) {
      var ti = t0 + (k % 5), dt = t - ti;
      if (dt < 0) continue;
      var h1 = I.hash(seed + k), h2 = I.hash(seed + k * 7 + 3);
      var vx = (h1 - 0.5) * spread, vy = -(2 + h2 * vmax), x = cx + vx * dt + (h2 - 0.5) * 16, y = vy * dt + 0.25 * dt * dt;
      if (y > 2) continue;
      ctx.fillStyle = Wc[dt < 6 ? 0 : dt < 14 ? 1 : 2];
      var s = k % 3 ? 1 : 2;
      ctx.fillRect(Math.round(sx + x), Math.round(sy + y), s, s + (vy + 0.5 * dt > 2 ? 1 : 0));
    }
  }

  I.defSprite('deepseek.whale', {
    desc: 'The super v2: a ~300x170 px whale R1 bursts out of a data pool in front of her, arcs across the screen (body arched, hangs at the apex), dives head-first with the flukes kicking up and crashes; spray crowns at both ends, drips from the body. 60f.',
    use: 'Every frame of the super at the floor point in front of her (origin), t = 0..59, facing = hers. Hitboxes: spriteInfo().frames[t] (facing right; mirror x for facing -1 as x\' = -(x+w)). On t = events.crash spawn deepseek.whaleSplash at (x + facing*crashX, GROUND_Y) and start the deepseek.tidal sprite there.',
    info: info,
    draw: function (ctx, sx, sy, t, o) {
      var Wd = WH[o.pal], Wc = I.scheme('deepseek', o.pal).water.css, dir = o.facing, crashX = info.crashX, cr = info.events.crash;
      var pools = A.dss && A.dss[o.pal] && A.dss[o.pal].pool;
      if (pools) {
        if (t < 30) I.drawAnim(ctx, pools[Math.max(0, Math.min(4, t < 4 ? t + 1 : t > 24 ? 4 - (t - 24) : 4))], t % 8, sx + dir * 20, sy, 1);
        if (t > cr - 8) I.drawAnim(ctx, pools[Math.min(4, Math.max(0, t < cr - 3 ? t - (cr - 8) : t > cr + 7 ? 4 - (t - cr - 7) : 4))], t % 8, sx + dir * crashX, sy, 1);
      }
      if (t < 3) {   // the floor bulges before it breaks
        ctx.fillStyle = Wc[1]; ctx.fillRect(sx + dir * 20 - 14 - t * 6, sy - 2 - t * 3, 28 + t * 12, 2 + t * 3);
        ctx.fillStyle = Wc[0]; ctx.fillRect(sx + dir * 20 - 9 - t * 4, sy - 2 - t * 3, 18 + t * 8, 1);
      }
      var P = t >= 3 && t <= 58 ? Wd.poses[poseTick(t)] : null;
      if (P) {
        var p = pose(t), x = Math.round(p.cx + P.ox), y = Math.round(p.cy + P.oy);
        I.mirrored(ctx, sx, dir, function () { ctx.drawImage(P.c, sx + x, sy + y); });
        if (P.r1y + p.cy < -8) {   // R1 lettering (unmirrored, follows the flank)
          var ang = dir > 0 ? P.r1a : -P.r1a, k = Math.max(0, Math.min(24, Math.round(ang / (PI / 24)) + 12)), r = Wd.r1[k];
          ctx.drawImage(r.c, Math.round(sx + dir * (p.cx + P.r1x) - r.px), Math.round(sy + p.cy + P.r1y - r.py));
        }
      }
      // drips falling from the body while it is airborne
      for (var kk = 0; kk < 34; kk++) {
        var ti = 8 + kk, dt = t - ti;
        if (dt < 0 || dt > 28 || ti > cr) continue;
        var pp = pose(ti), ox2 = (I.hash(kk * 5) - 0.5) * 200, dxp = pp.cx + ox2 * Math.cos(pp.th), dyp = pp.cy + ox2 * Math.sin(pp.th) + 30 + 0.22 * dt * dt;
        if (dyp > 0) continue;
        ctx.fillStyle = Wc[kk % 3 === 0 ? 0 : 1];
        ctx.fillRect(Math.round(sx + dir * dxp), Math.round(sy + dyp), 1, dt > 6 ? 3 : 1);
      }
      waterDrops(ctx, Wc, sx, sy, t, 2, 56, dir * 20, 100, 10, 7);
      if (t >= cr - 2) waterDrops(ctx, Wc, sx, sy, t, cr - 2, 60, dir * crashX, 300, 12, 9);
      var crowns = A.ds && A.ds[o.pal];
      if (crowns) {
        if (t < 22) I.drawAnim(ctx, crowns.crownXL, t, sx + dir * 20, sy, dir);
        if (t >= cr - 4) I.drawAnim(ctx, crowns.crownXL, Math.min(21, (t - cr + 4) * 2), sx + dir * crashX, sy, dir);
      }
    }
  });

  // ---------------------------------------------------------------------------------------
  // TIDAL WAVE
  var TDUR = 48, TI = { duration: TDUR, bbox: { x: -60, y: -110, w: 420, h: 112 }, frames: [] };
  function front(t) { return t < 4 ? 6 + t * 3 : 18 + (t - 4) * 9.2 - Math.max(0, t - 30) * (t - 30) * 0.25; }
  function crestH(t) { return t < 6 ? 14 + t * 11 : t < 24 ? 80 - Math.abs(t - 14) * 0.4 : t < 38 ? 76 - (t - 24) * 3.3 : Math.max(8, 30 - (t - 38) * 2.6); }
  var TS = [{}, {}];
  function bakeTidal() {
    [0, 1].forEach(function (pal) {
      var sc = I.scheme('deepseek', pal), Wt = sc.water.u, F = sc.foam.u, T = TS[pal];
      T.crest = I.anim(150, 124, TDUR >> 1, 120, 120, function (b, f2) {
        var f = f2 * 2, Hc = crestH(f), bx = 120, by = 120, rng = I.bakeRng(500 + f), col = f >= 38;
        var curl = col ? Math.max(0, 1 - (f - 38) / 6) : 1;
        // body: long back slope, crest, overhanging lip curling forward
        var pts = [bx - 118, by - 12, bx - 84, by - Hc * 0.32, bx - 56, by - Hc * 0.72, bx - 36, by - Hc * 0.95, bx - 22, by - Hc,
          bx - 8, by - Hc * (0.98 - 0.04 * curl), bx + 6 * curl, by - Hc * (0.9 - 0.06 * curl), bx + 13 * curl, by - Hc * (0.74 - 0.04 * curl),
          bx + 5 * curl, by - Hc * 0.68, bx - 5, by - Hc * 0.72, bx - 11, by - Hc * 0.58, bx - 8, by - Hc * 0.36, bx - 3, by - Hc * 0.14, bx + 2, by, bx - 118, by];
        b.poly(pts, Wt[2]);
        // shading: back slope light streaks, darker face, hollow of the curl
        b.poly([bx - 22, by - Hc, bx - 8, by - Hc * 0.97, bx - 11, by - Hc * 0.58, bx - 8, by - Hc * 0.36, bx - 3, by - Hc * 0.14, bx + 2, by, bx - 16, by, bx - 26, by - Hc * 0.5], Wt[3]);
        if (curl > 0.2) b.poly([bx + 5 * curl, by - Hc * 0.68, bx - 5, by - Hc * 0.72, bx - 10, by - Hc * 0.6, bx - 2, by - Hc * 0.6], Wt[4]);
        for (var s = 0; s < 6; s++) {   // flowing light streaks on the back
          var sxx = bx - 100 + s * 15 + ((f * 3 + s * 7) % 12), syy = by - Hc * (0.2 + 0.11 * s) + 6;
          b.line(sxx, syy, sxx + 10, syy - Hc * 0.08, Wt[1]);
        }
        for (var fl = 0; fl < 3; fl++) {  // foam lines running down the face
          var fy = by - Hc * (0.3 + fl * 0.18);
          b.line(bx - 9 - fl, fy, bx - 4 + fl, fy + Hc * 0.1, F[1]);
        }
        b.outline(Wt[5]);
        // foam cap along the crest + lip
        for (var x = bx - 40; x < bx + 14 * curl; x++) {
          var u = (x - (bx - 40)) / (40 + 14 * curl), yt = by - Hc * (0.86 + 0.14 * Math.sin(Math.min(1, u * 1.3) * PI * 0.9)) - (u > 0.75 ? -(u - 0.75) * Hc * 0.6 : 0);
          b.rect(x, Math.round(yt) - 1, 1, 2 + ((x + f) % 3 === 0 ? 1 : 0), (x + f) % 4 ? F[0] : F[1]);
        }
        // spray wall above the crest
        var nsp = col ? 8 : 26;
        for (var k = 0; k < nsp; k++) {
          var px = bx - 46 + rng() * 64, rise = rng() * (col ? 14 : 34), py = by - Hc - 2 - rise;
          var c = rise > 24 ? Wt[1] : F[rng() < 0.5 ? 0 : 1];
          if (I.bayer(Math.round(px), Math.round(py)) < 0.9) b.rect(px, py, rng() < 0.3 ? 2 : 1, rng() < 0.5 ? 2 : 1, c);
        }
        // foam at the toe
        b.rect(bx - 24, by - 2, 30, 2, F[1]); for (var tq = 0; tq < 8; tq++) b.set(bx - 20 + tq * 3 + (f % 3), by - 3, F[0]);
      }, 1, true);
      // flood tile: 64x16, 4 frames scrolling foam
      T.flood = I.anim(64, 16, 4, 0, 14, function (b, f) {
        for (var x = 0; x < 64; x++) {
          var top = 4 + Math.round(Math.sin((x + f * 16) * TAU / 64) * 1.5 + Math.sin((x * 3 - f * 16) * TAU / 64) * 0.8);
          for (var y = top; y < 16; y++) b.set(x, y, y === top ? F[0] : y === top + 1 ? F[1] : y < top + 5 ? Wt[2] : Wt[3]);
          if (((x + f * 16) % 16) < 5) b.set(x, top + 3, Wt[1]);
        }
      });
    });
    TI.frames = [];
    for (var t = 0; t < TDUR; t++) {
      var xf = front(t), Hc = crestH(t);
      TI.frames.push(t < 38 ? { x: Math.round(xf - 48), y: -Math.round(Hc), w: 56, h: Math.round(Hc) } : { x: 0, y: 0, w: 0, h: 0 });
    }
  }
  I.onInit('tidal', bakeTidal);

  I.defSprite('deepseek.tidal', {
    desc: 'Full-width tidal wave pushed out by the whale crash: an ~80 px curling breaker with a foam cap and a wall of spray races from the crash point to the far edge of the screen (~300 px in 34f) over a flooded, foaming floor, then collapses into foam. 48f.',
    use: 'From t = 0 at the crash (whale events.crash), origin = the crash point on the floor (x + facing*crashX, GROUND_Y), facing = hers; draw it in front of the fighters. Hitboxes: spriteInfo("deepseek.tidal").frames[t] (facing right, rel. origin; w = 0 when not hittable).',
    info: TI,
    draw: function (ctx, sx, sy, t, o) {
      if (t >= TDUR) return;
      var T = TS[o.pal], Wc = I.scheme('deepseek', o.pal).water.css, xf = Math.round(front(t)), Hc = crestH(t);
      I.mirrored(ctx, sx, o.facing, function () {
        // flooded floor from behind the crash point to the wave's back
        var fx0 = -50, fx1 = xf - 100, lift = t > 36 ? Math.min(14, (t - 36) * 1.3) : 0;
        for (var x = fx0; x < fx1; x += 64) {
          var w = Math.min(64, fx1 - x);
          if (w > 0) ctx.drawImage(T.flood.c, ((t >> 1) & 3) * 64, Math.round(lift), w, 16 - Math.round(lift), sx + x, sy - 14 + Math.round(lift) + 2, w, 16 - Math.round(lift));
        }
        I.drawAnim(ctx, T.crest, t >> 1, sx + xf, sy + 2, 1);
        // spray flung forward off the lip
        for (var k = 0; k < 14; k++) {
          var ph = ((t * 0.09 + I.hash(k * 3)) % 1), dx = ph * 36, dy = -Hc * 0.9 - ph * 18 + ph * ph * 40;
          if (t > 40) continue;
          ctx.fillStyle = Wc[ph < 0.5 ? 0 : 1];
          ctx.fillRect(sx + xf - 4 + Math.round(dx + I.hash(k) * 8), sy + Math.round(dy), k % 3 ? 1 : 2, 2);
        }
      });
    }
  });
})();
