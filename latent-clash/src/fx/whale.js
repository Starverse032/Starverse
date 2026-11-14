/* LATENT CLASH — FX: deepseek.whale, the DEEPTHINK: WHALE FALL super (owned by FX).
 * A ~150x64 pixel whale "R1" (blue back, white belly with throat grooves,
 * cyan circuit glow lines, small eye + blush, R1 on the flank) drawn once per
 * palette and facing, rotated with RotSprite-lite to 17 angles, then flown
 * along a time-warped ballistic arc: fast emergence out of a pool, hang at the
 * apex, heavy fall and crash. Stateless: everything (incl. water) is a pure
 * function of t. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI;
  var A = I.A = I.A || {};
  var WH = [{}, {}], DUR = 60, ANG0 = -80, ASTEP = 10, NANG = 17;
  var BW = 160, BH = 72, CY = 38, PX = 82, PY = 38;   // base bitmap and rotation pivot
  var info = { duration: DUR, bbox: { x: -60, y: -170, w: 260, h: 172 }, frames: [], events: { emerge: 3, apex: 27, crash: 50 }, crashX: 128 };

  // ---- flight path (facing right, rel. origin on the floor) --------------------
  function tau(t) {
    var s = (t - 27) / 24; s = s < -1 ? -1 : s > 1 ? 1 : s;
    return 23.3 + 22.6 * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 1.35);
  }
  function path(t) {
    var u = tau(t);
    return { x: -10 + 3.0 * u, y: 60 - 12.6 * u + 0.27 * u * u, a: Math.atan2(-12.6 + 0.54 * u, 3.0) };
  }

  function drawWhale(b, sc, pal) {
    var Bl = sc.blue.u, Be = sc.belly.u, Gl = sc.glow.u, O = I.col(sc.outline);
    var blush = I.col(LC.PAL.deepseek[pal].blush);
    function h(u) { return u < 0.62 ? 5 + 21 * Math.pow(u / 0.62, 0.7) : 26 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.62) / 0.4, 2))); }
    // flukes + tail stock
    b.poly([34, CY - 4, 14, CY - 22, 3, CY - 24, 9, CY - 14, 20, CY - 2, 9, CY + 12, 3, CY + 22, 14, CY + 20, 34, CY + 5], Bl[1]);
    b.poly([14, CY - 22, 3, CY - 24, 6, CY - 20], Bl[0]); b.poly([3, CY + 22, 14, CY + 20, 8, CY + 18], Bl[2]);
    // pectoral fin (behind body part)
    b.poly([92, CY + 14, 70, CY + 34, 78, CY + 34, 100, CY + 18], Bl[2]);
    for (var x = 30; x <= 156; x++) {
      var u = (x - 30) / 126, hh = h(u);
      if (hh <= 0.5) continue;
      var top = CY - hh, bot = CY + hh * 0.82, yb = CY + hh * 0.18 - (u > 0.7 ? (u - 0.7) * 30 : 0);
      for (var y = Math.round(top); y <= Math.round(bot); y++) {
        var c;
        if (y < yb) c = y < top + 2 ? Bl[0] : y > yb - 3 ? Bl[2] : Bl[1];
        else if (y < yb + 1 && u > 0.72) c = Bl[3];                 // smile / mouth line
        else c = y > bot - 2 ? Be[2] : (u > 0.55 && u < 0.95 && ((y - Math.round(yb)) % 3 === 2) && y > yb + 2) ? Be[1] : Be[0];
        b.set(x, y, c);
      }
    }
    b.poly([58, CY - 15, 66, CY - 23, 70, CY - 17], Bl[1]);   // dorsal fin
    // glow circuit line along the back with nodes
    for (x = 44; x < 128; x++) {
      var u2 = (x - 30) / 126, yy = Math.round(CY - h(u2) + 6 + Math.sin(x * 0.08) * 1.5);
      b.set(x, yy, Gl[1]);
      if (x % 21 === 0) { b.rect(x - 1, yy - 1, 3, 3, Gl[1]); b.set(x, yy, Gl[0]); b.line(x, yy, x + 4, yy + 5, Gl[2]); }
    }
    b.line(6, CY - 23, 30, CY - 4, Gl[1]); b.line(6, CY + 21, 30, CY + 5, Gl[1]);
    // eye + blush
    var ex = 136, ey = CY + 2;
    b.rect(ex - 1, ey - 2, 3, 4, O); b.set(ex, ey - 1, I.col('#ffffff')); b.rect(ex - 6, ey + 4, 3, 1, blush);
    b.outline(O);
  }
  function stampR1(b, sc, flip) {
    var c = sc.belly.u[0], Gl = sc.glow.u[1], x = flip ? BW - 1 - 92 - 9 : 92 - 9 + 1, y = CY - 9;
    var m = new I.Buf(BW, BH);
    I.bigGlyph(m, 'R', x, y, c); I.bigGlyph(m, '1', x + 6, y, c);
    var o = m.copy().outline(Gl);
    b.blit(o, 0, 0);
  }

  function bake() {
    var t0 = performance.now();
    [0, 1].forEach(function (pal) {
      var sc = I.scheme('deepseek', pal), W = WH[pal];
      var base = new I.Buf(BW, BH); drawWhale(base, sc, pal);
      var right = base.copy(); stampR1(right, sc, false);
      var left = base.flipX(); stampR1(left, sc, true);
      W.r = []; W.l = [];
      [[right, W.r, 1], [left, W.l, -1]].forEach(function (job) {
        var up = job[0].scale2x().scale2x(), px = job[2] > 0 ? PX : BW - PX;
        for (var i = 0; i < NANG; i++) {
          var ang = (ANG0 + i * ASTEP) * PI / 180 * job[2];
          var r = I.rotate(job[0], ang, px, PY, up);
          job[1].push({ c: I.toCanvas(r.buf), px: r.px, py: r.py, bb: r.buf.bounds() });
        }
      });
    });
    // per-frame hitbox (facing right, relative to the origin, clipped to above the floor)
    info.frames = [];
    for (var t = 0; t < DUR; t++) {
      var f = frame(t), R = WH[0].r[f.ai], bb = R.bb;
      var x0 = f.x - R.px + bb.x, y0 = f.y - R.py + bb.y, y1 = Math.min(0, y0 + bb.h);
      info.frames.push(f.vis && y1 > y0 ? { x: Math.round(x0 + 6), y: Math.round(y0 + 6), w: Math.max(0, Math.round(bb.w - 12)), h: Math.max(0, Math.round(y1 - y0 - 6)) } : { x: 0, y: 0, w: 0, h: 0 });
    }
    I.whaleBakeMs = performance.now() - t0;
  }
  function frame(t) {
    var p = path(t), deg = p.a * 180 / PI, ai = Math.max(0, Math.min(NANG - 1, Math.round((deg - ANG0) / ASTEP)));
    return { x: p.x, y: p.y, ai: ai, vis: t >= 3 && t <= 56 };
  }
  I.onInit('whale', bake);

  function waterDrops(ctx, Wc, sx, sy, t, t0, n, cx, seed, vmax, spread) {
    for (var k = 0; k < n; k++) {
      var ti = t0 + (k % 5), dt = t - ti;
      if (dt < 0) continue;
      var h1 = I.hash(seed + k), h2 = I.hash(seed + k * 7 + 3);
      var vx = (h1 - 0.5) * spread, vy = -(2 + h2 * vmax), x = cx + vx * dt + (h2 - 0.5) * 10, y = vy * dt + 0.25 * dt * dt;
      if (y > 2) continue;
      ctx.fillStyle = Wc[dt < 6 ? 0 : dt < 14 ? 1 : 2];
      var s = k % 3 ? 1 : 2;
      ctx.fillRect(Math.round(sx + x), Math.round(sy + y), s, s + (vy + 0.5 * dt > 2 ? 1 : 0));
    }
  }

  I.defSprite('deepseek.whale', {
    desc: 'The super: big pixel whale R1 breaches out of a data pool, arcs up and forward (hangs at the apex), crashes down ~128 px ahead; water spray at both ends and drips from its body. 60f.',
    use: 'Draw every frame during the super at the floor point in front of her (origin = where it emerges), t = 0..59. Hitboxes: spriteInfo().frames[t] (facing right; mirror x for facing -1). Spawn deepseek.whaleSplash at x + facing*crashX on t = events.crash.',
    info: info,
    draw: function (ctx, sx, sy, t, o) {
      var W = WH[o.pal], sc = I.scheme('deepseek', o.pal), Wc = sc.water.css, f = frame(t), dir = o.facing;
      var pools = A.dss && A.dss[o.pal] && A.dss[o.pal].pool;
      // pools: emergence point (open t0-24) and crash point (t 40-59)
      if (pools) {
        if (t < 26) I.drawAnim(ctx, pools[Math.min(4, t < 4 ? t + 1 : t > 20 ? 4 - (t - 20) : 4)], t % 8, sx + dir * 6, sy, 1);
        if (t > 40) I.drawAnim(ctx, pools[Math.min(4, t < 46 ? t - 41 : t > 54 ? Math.max(0, 4 - (t - 54)) : 4)], t % 8, sx + dir * 128, sy, 1);
      }
      if (t < 3) {   // the floor bulges before it breaks
        ctx.fillStyle = Wc[1]; ctx.fillRect(sx + dir * 6 - 10 - t * 4, sy - 2 - t * 2, 20 + t * 8, 2 + t * 2);
        ctx.fillStyle = Wc[0]; ctx.fillRect(sx + dir * 6 - 6 - t * 3, sy - 2 - t * 2, 12 + t * 6, 1);
      }
      if (f.vis) {
        var R = (dir > 0 ? W.r : W.l)[f.ai];
        ctx.save();
        ctx.beginPath(); ctx.rect(sx - 400, sy - 400, 800, 401); ctx.clip();
        ctx.drawImage(R.c, Math.round(sx + dir * f.x - R.px), Math.round(sy + f.y - R.py));
        ctx.restore();
      }
      // body drips while airborne
      for (var k = 0; k < 26; k++) {
        var ti = 8 + k, dt = t - ti;
        if (dt < 0 || dt > 30) continue;
        var p = path(ti), ox = (I.hash(k * 5) - 0.5) * 70, x = p.x + ox * Math.cos(p.a), y = p.y + ox * Math.sin(p.a) + 14 + 0.22 * dt * dt;
        if (y > 0 || p.y > 10) continue;
        ctx.fillStyle = Wc[k % 3 === 0 ? 0 : 1];
        ctx.fillRect(Math.round(sx + dir * x), Math.round(sy + y), 1, dt > 6 ? 2 : 1);
      }
      waterDrops(ctx, Wc, sx, sy, t, 2, 40, dir * 6, 100, 9, 5);
      if (t >= 48) waterDrops(ctx, Wc, sx, sy, t, 48, 46, dir * 128, 300, 10, 7);
      var crowns = A.ds && A.ds[o.pal];
      if (crowns) {
        if (t < 18) I.drawAnim(ctx, crowns.crownL, t, sx + dir * 6, sy, dir);
        if (t >= 46) I.drawAnim(ctx, crowns.crownXL, Math.min(21, (t - 46) * 2), sx + dir * 128, sy, dir);
      }
    }
  });
})();
