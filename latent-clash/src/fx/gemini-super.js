/* LATENT CLASH — FX: Gemini 娘 super, 双子座·流星雨 GEMINI: METEOR SHOWER (owned by FX).
 * gemini.meteor (drawn at 0,0; opts.ax, ay = her raised hand on screen, opts.bx, by = her twin's,
 * facing, palette, part 'back' | 'front' | undefined = both).  76 frames:
 *   t  0-13  both hands gather sparkles into a growing faceted star
 *   t 12-19  the Gemini constellation (backdrop geometry, I.GEM.CONST) flares: white lines, glints, rings
 *   t 14-47  three waves of diagonal iridescent meteors with long banded trails (from her side) rain over
 *            the whole screen; each impact on the floor line throws a star flash, sparkles and a floor ring;
 *            a fine streak rain behind (part 'back')
 *   t 44-58  both twins fire a beam; the beams cross in a big X over the middle; the crossing swells
 *   t 56-63  the crossing bursts into a full-screen four-pointed star (nested iridescent layers, rays)
 *   t 60-75  stardust settles
 * Runtime fillRect runs only (no AA); stars are the baked I.GEM sprites. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var W = LC.W || 384, H = LC.H || 216, GY = LC.GROUND_Y || 186, PI = Math.PI, TAU = PI * 2;
  var G = I.GEM = I.GEM || [{}, {}];
  var DUR = 76;
  var EV = { gather: 0, flare: 12, rain: [14, 24, 34], impact: [20, 30, 40], beams: 44, cross: 50, burst: 56, settle: 60, end: 76, hits: [21, 31, 41, 50, 57] };
  var NM = 15, RV = 18, DX = 0.5, DY = 0.866;     // meteors per wave, speed px/f, direction (x by facing)
  var LANE = { x: 0, y: GY - 124, w: W, h: 128 };
  function soft() { return LC.settings && LC.settings.flash === false; }

  I.onInit('gemini-super', function () {
    [0, 1].forEach(function (pal) {
      var g = G[pal];
      g.xstar = [18, 25].map(function (R) {
        var s = R * 2 + 5, c = s / 2;
        return I.anim(s, s, 4, Math.floor(c), Math.floor(c), function (b, f) { I.gemStar(b, c, c, R, f * PI / 8, pal, { rim: true, p: 0.52, core: 0.2 }); }, 1, true);
      });
      g.mcol = { trail: ['#ffffff', g.S[1], g.S[2], g.A[1], g.A[2], g.dk],
        trailH: [1, 2, 3].map(function (h) { return ['#ffffff', g.S[h], I.mix(g.S[h], g.A[1], 0.5), g.A[1], g.A[2], g.dk]; }), fine: [g.A[2], g.dk, I.mix(g.S[1], g.dk, 0.5)],
        beam: [g.dk, g.A[2], g.A[1], g.A[0], '#ffffff'], edge: [g.S[1], g.S[2]], burst: [g.A[3], g.A[2], g.S[2], g.S[1], g.A[0], '#ffffff'] };
    });
  });

  // ---- meteors ------------------------------------------------------------------------------------
  function meteor(w, m) {      // deterministic per (wave, index)
    var h1 = I.hash(w * 97 + m * 13 + 5), h2 = I.hash(w * 31 + m * 7 + 11), h3 = I.hash(w * 53 + m * 29 + 3);
    var big = m % 3 === 0;
    var u = (m + 0.15 + h1 * 0.7) / NM;     // impacts sweep across the screen from her side
    return { u: u, ti: EV.rain[w] + 4 + Math.floor(u * 7 + h2 * 3), v: RV + h3 * 5, big: big, L: big ? 74 : 40 + Math.floor(h3 * 16), hue: m % 3, y0: GY + Math.floor(h1 * 3) };
  }
  function trail(ctx, hx, hy, ux, uy, L, big, C, t) {
    var step = big ? 2 : 3;
    for (var s = 0; s < L; s += step) {
      var k = s / L, px = Math.round(hx - ux * s), py = Math.round(hy - uy * s);
      if (py > GY + 1) continue;
      if (k > 0.55 && I.bayer(px, py + t) < (k - 0.55) * 2.1) continue;
      var ci = k < 0.08 ? 0 : k < 0.24 ? 1 : k < 0.42 ? 2 : k < 0.62 ? 3 : k < 0.82 ? 4 : 5;
      if (big) {
        ctx.fillStyle = C[Math.min(5, ci + 1)]; ctx.fillRect(px - 1, py, 3, step);
        if (k < 0.6) { ctx.fillStyle = C[Math.max(0, ci - 1)]; ctx.fillRect(px, py, 1, step); }
      } else { ctx.fillStyle = C[Math.min(5, ci + 1)]; ctx.fillRect(px, py, 1, step); }
    }
  }
  function drawRain(ctx, sx, sy, t, g, pal, f) {
    var C = g.mcol.trail, ux = f * DX, uy = DY, w, m;
    for (w = 0; w < 3; w++) {
      if (t < EV.rain[w] || t > EV.rain[w] + 30) continue;
      for (m = 0; m < NM; m++) {
        var M = meteor(w, m), dt = M.ti - t;
        M.ix = f > 0 ? -14 + M.u * (W + 28) : W + 14 - M.u * (W + 28);
        var TC = M.big ? C : g.mcol.trailH[M.hue];
        if (dt > 16) continue;
        if (dt >= 0) {          // falling
          var hx = M.ix - ux * dt * M.v, hy = M.y0 - uy * dt * M.v;
          if (hy < -M.L) continue;
          trail(ctx, sx + hx, sy + hy, ux, uy, M.L, M.big, TC, t);
          if (M.big) I.drawAnim(ctx, g.ps[3], (t + m) & 7, sx + Math.round(hx), sy + Math.round(hy), 1);
          else I.gemPS(ctx, pal, 1, t + m, sx + Math.round(hx), sy + Math.round(hy));
        } else {
          var a = -dt;
          if (a < 3) {          // the tail drains into the floor
            var rem = M.L - a * M.v;
            if (rem > 4) trail(ctx, sx + M.ix - ux * a * M.v, sy + M.y0 - uy * a * M.v, ux, uy, rem + a * M.v, M.big, TC, t);
          }
          impact(ctx, sx + Math.round(M.ix), sy + M.y0, a, M, g, pal, w * 17 + m);
        }
      }
    }
  }
  function impact(ctx, x, y, a, M, g, pal, seed) {
    if (a > 12) return;
    if (a < 6 && M.big) I.drawAnim(ctx, g.cast, a + 1, x, y - 2, 1);
    else if (a < 3) { var r = 5 - a; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - r, y - 1, r * 2 + 1, 1); ctx.fillRect(x, y - 1 - r, 1, r * 2 + 1); }
    if (a < 9) {                // floor ring: flat ellipse of dots
      var rr = 4 + a * (M.big ? 4 : 2.6), n = M.big ? 14 : 10;
      ctx.fillStyle = a < 3 ? g.S[1] : a < 6 ? g.A[1] : g.A[2];
      for (var k = 0; k < n; k++) { var an = k * TAU / n; ctx.fillRect(x + Math.round(Math.cos(an) * rr), y + Math.round(Math.sin(an) * rr * 0.22), 2, 1); }
    }
    var ns = M.big ? 5 : 3;      // sparkles thrown up
    for (var i = 0; i < ns; i++) {
      var h = I.hash(seed * 11 + i * 3), vx = (h - 0.5) * 3.2, vy = 2.2 + I.hash(seed + i * 7) * 2;
      var px = x + vx * a, py = y - 2 - (vy * a - 0.2 * a * a);
      if (py > y) continue;
      if (a > 8 && ((a + i) & 1)) continue;
      I.gemPS(ctx, pal, a < 6 && i < 2 ? 1 : 0, a + i * 2, Math.round(px), Math.round(py));
    }
  }
  function fineRain(ctx, sx, sy, t, g, f) {
    if (t < 13 || t > 50) return;
    var C = g.mcol.fine, n = t < 16 || t > 46 ? 14 : 34;
    for (var i = 0; i < n; i++) {
      var h1 = I.hash(i * 19 + 7), h2 = I.hash(i * 23 + 1), v = 20 + h2 * 8, len = 8 + Math.floor(h1 * 10);
      var span = H + 60, y = ((h2 * span + t * v * DY) % span) - 40, x0 = h1 * (W + 120) - 60 + f * ((t * v * DX) % 120);
      ctx.fillStyle = C[i % 3];
      for (var s = 0; s < len; s += 2) ctx.fillRect(sx + Math.round(x0 - f * DX * s), sy + Math.round(y - DY * s), 1, 2);
    }
  }

  // ---- beams ----------------------------------------------------------------------------------------
  function beamHalf(t) {
    var a = t - EV.beams;
    if (a < 0) return 0;
    if (a < 3) return 2 + a * 2;
    if (a <= 11) return 7 + ((t >> 1) & 1);
    return Math.max(0, 7 - (a - 11) * 2);
  }
  function drawBeam(ctx, sx, sy, hx, hy, xx, xy, t, g, sign) {
    var dx = xx - hx, dy = xy - hy, slope = dy / dx, dir = dx > 0 ? 1 : -1;
    var full = (dir > 0 ? W + 8 - hx : hx + 8), len = Math.min(full, (t - EV.beams + 1) * 70);
    var hw = beamHalf(t);
    if (hw <= 0) return null;
    var hh = Math.round(hw / Math.cos(Math.atan(slope))), C = g.mcol.beam, E = g.mcol.edge;
    for (var s = 0; s < len; s += 2) {
      var x = Math.round(hx + dir * s), yc = Math.round(hy + slope * dir * s), wob = (((s + t * 6) >> 3) & 1);
      var taper = s < 10 ? Math.max(1, Math.round(hh * (0.4 + s / 16))) : hh;
      ctx.fillStyle = C[1]; ctx.fillRect(sx + x, sy + yc - taper - wob, 2, taper * 2 + 1 + wob * 2);
      if (taper > 2) { ctx.fillStyle = C[2]; ctx.fillRect(sx + x, sy + yc - taper + 2, 2, taper * 2 - 3); }
      if (taper > 4) { ctx.fillStyle = C[3]; ctx.fillRect(sx + x, sy + yc - taper + 4, 2, taper * 2 - 7); ctx.fillStyle = C[4]; ctx.fillRect(sx + x, sy + yc - 1, 2, 3); }
      ctx.fillStyle = E[0]; ctx.fillRect(sx + x, sy + yc - taper - wob - 1, 2, 1);
      ctx.fillStyle = E[1]; ctx.fillRect(sx + x, sy + yc + taper + wob + 1, 2, 1);
    }
    // stars streaming along the beam
    for (var k = 0; k < 5; k++) {
      var d = (t * 9 + k * 47 + sign * 20) % Math.max(20, len);
      I.gemPS(ctx, g === G[0] ? 0 : 1, k & 1 ? 1 : 2, t + k, sx + Math.round(hx + dir * d), sy + Math.round(hy + slope * dir * d) + ((k & 1) ? -hh - 3 : hh + 3));
    }
    if (len < full) I.drawAnim(ctx, g.proj[2], t & 7, sx + Math.round(hx + dir * len), sy + Math.round(hy + slope * dir * len), 1);
    return len;
  }

  // ---- burst: giant nested four-pointed star (row spans) -------------------------------------------
  function starSpans(ctx, sx, sy, cx, cy, R, col) {
    ctx.fillStyle = col;
    var y0 = Math.max(-8, Math.floor(cy - R)), y1 = Math.min(H + 8, Math.ceil(cy + R));
    for (var y = y0; y < y1; y++) {
      var dy = Math.abs(y + 0.5 - cy) / R; if (dy >= 1) continue;
      var q = 1 - Math.sqrt(dy), hw = Math.round(R * q * q);
      if (hw < 1) continue;
      var xa = Math.max(-8, cx - hw), xb = Math.min(W + 8, cx + hw);
      if (xb > xa) ctx.fillRect(sx + xa, sy + y, xb - xa, 1);
    }
  }
  function drawBurst(ctx, sx, sy, t, g, cx, cy, sf, a0) {
    var a = t - EV.burst;
    if (a < 0 || a > 7) return;
    var C = g.mcol.burst;
    if (a === 0) { ctx.globalAlpha = a0 * (sf ? 0.35 : 1); ctx.fillStyle = sf ? C[4] : '#ffffff'; ctx.fillRect(sx - 8, sy - 8, W + 16, H + 16); ctx.globalAlpha = a0; return; }
    var fade = a >= 5 ? 1 - (a - 4) * 0.25 : 1;
    ctx.globalAlpha = a0 * fade * (sf ? 0.55 : 1);
    var R0 = 150 + a * 80;
    for (var L = 0; L < 6; L++) starSpans(ctx, sx, sy, cx, cy, R0 * (1 - L * 0.15), C[L]);
    // diagonal ray glints between the arms
    ctx.fillStyle = '#ffffff';
    for (var k = 0; k < 4; k++) {
      var an = PI / 4 + k * PI / 2, r0 = 20 + a * 10, r1 = r0 + 60 + a * 14;
      I.runLine(ctx, sx + cx + Math.round(Math.cos(an) * r0), sy + cy + Math.round(Math.sin(an) * r0), sx + cx + Math.round(Math.cos(an) * r1), sy + cy + Math.round(Math.sin(an) * r1), a < 3 ? 2 : 1);
    }
    ctx.globalAlpha = a0;
  }

  // ---- stardust ----------------------------------------------------------------------------------------
  function drawDust(ctx, sx, sy, t, g, pal) {
    var a = t - EV.settle;
    if (a < 0) return;
    for (var i = 0; i < 60; i++) {
      var h1 = I.hash(i * 37 + 1), h2 = I.hash(i * 41 + 9), x = h1 * W + Math.sin(a * 0.12 + i) * 4, y = -10 + h2 * 150 + a * (0.6 + h1 * 0.9);
      if (y > GY) y = GY - (i & 1);
      if (a > 10 && ((a + i) % 3 === 0)) continue;
      if (i % 6 === 0) I.gemPS(ctx, pal, 0, a + i, sx + Math.round(x), sy + Math.round(y));
      else { ctx.fillStyle = g.dust[i % 6]; ctx.fillRect(sx + Math.round(x), sy + Math.round(y), 1, 1); }
    }
  }

  // ---- hands + constellation flare ------------------------------------------------------------------
  function drawHand(ctx, sx, sy, t, g, pal, x, y, k) {
    if (t <= 13) {               // gather
      var u = t / 13, r = Math.round(36 * (1 - u) + 4);
      for (var i = 0; i < 8; i++) { var an = i * TAU / 8 + t * 0.12 + k; I.gemPS(ctx, pal, i & 1 ? 0 : 1, t + i, sx + x + Math.round(Math.cos(an) * r), sy + y + Math.round(Math.sin(an) * r)); }
      I.drawAnim(ctx, g.proj[t < 5 ? 0 : t < 10 ? 1 : 2], t & 7, sx + x, sy + y, 1);
    } else if (t < EV.beams + 14) I.drawAnim(ctx, g.proj[t >= EV.beams ? 2 : 1], (t >> 1) & 7, sx + x, sy + y, 1);
    var ph = t % 8;
    if (t < EV.beams + 14 && ph < 2) { var gl = 12 + ph * 6; ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + x - gl, sy + y, gl * 2 + 1, 1); ctx.fillRect(sx + x, sy + y - gl, 1, gl * 2 + 1); }
  }
  function drawFlare(ctx, sx, sy, t, g, pal, f) {
    var a = t - EV.flare, wave = -1;
    for (var w = 0; w < 3; w++) if (t >= EV.rain[w] && t < EV.rain[w] + 3) wave = t - EV.rain[w];
    if ((a < 0 || a > 7) && wave < 0) return;
    var C = I.GEM.CONST;
    I.mirrored(ctx, sx + W / 2, f, function () {
      if (a >= 0 && a <= 7) I.gemConst(ctx, sx, sy, 60 + t, pal, a < 5);
      for (var k = 0; k < C.V.length; k++) {
        var v = C.V[k], rr = a >= 0 && a <= 7 ? Math.max(0, (v.head ? 16 : 9) - a * 2) : (v.head ? 8 - wave * 3 : 0);
        if (rr <= 0) continue;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + v.x - rr, sy + v.y, rr * 2 + 1, 1); ctx.fillRect(sx + v.x, sy + v.y - rr, 1, rr * 2 + 1);
        if (v.head && a >= 0 && a < 6) {    // ring from Castor / Pollux
          var R = 6 + a * 7; ctx.fillStyle = a < 3 ? g.S[1] : g.A[1];
          for (var i = 0; i < 16; i++) { var an = i * TAU / 16; ctx.fillRect(sx + v.x + Math.round(Math.cos(an) * R), sy + v.y + Math.round(Math.sin(an) * R), 2, 2); }
        }
      }
    });
  }

  function crossPoint(ax, ay, bx, by) { return [Math.round((ax + bx) / 2), Math.round(Math.min(ay, by) - 46)]; }

  function draw(ctx, sx, sy, t, o) {
    if (t >= DUR) return;
    var g = G[o.pal], pal = o.pal, raw = o.raw, f = o.facing, part = raw.part, sf = soft(), a0 = ctx.globalAlpha;
    var ax = raw.ax != null ? Math.round(+raw.ax) : (f > 0 ? 70 : W - 70), ay = raw.ay != null ? Math.round(+raw.ay) : GY - 74;
    var bx = raw.bx != null ? Math.round(+raw.bx) : W - ax, by = raw.by != null ? Math.round(+raw.by) : ay;
    if (part !== 'front') {
      fineRain(ctx, sx, sy, t, g, f);
      drawFlare(ctx, sx, sy, t, g, pal, f);
    }
    if (part === 'back') return;
    drawRain(ctx, sx, sy, t, g, pal, f);
    var X = crossPoint(ax, ay, bx, by);
    if (t >= EV.beams && t < EV.burst + 4) {
      var l1 = drawBeam(ctx, sx, sy, ax, ay, X[0], X[1], t, g, 0), l2 = drawBeam(ctx, sx, sy, bx, by, X[0], X[1], t, g, 1);
      var reach = Math.abs(X[0] - ax);
      if (l1 && l2 && l1 >= reach && t < EV.burst) {      // the crossing swells
        var c = t - EV.cross;
        I.drawAnim(ctx, c < 2 ? g.proj[2] : g.xstar[c < 4 ? 0 : 1], t & 3, sx + X[0], sy + X[1], 1);
        var gl = 20 + (t & 1) * 8 + Math.max(0, c) * 4; ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + X[0] - gl, sy + X[1], gl * 2 + 1, 1); ctx.fillRect(sx + X[0], sy + X[1] - gl, 1, gl * 2 + 1);
      }
    }
    drawHand(ctx, sx, sy, t, g, pal, ax, ay, 0);
    drawHand(ctx, sx, sy, t, g, pal, bx, by, 1);
    drawBurst(ctx, sx, sy, t, g, X[0], X[1], sf, a0);
    drawDust(ctx, sx, sy, t, g, pal);
  }

  var frames = [];
  for (var t = 0; t < DUR; t++) {
    var on = false;
    EV.impact.forEach(function (ti) { if (t >= ti && t < ti + 8) on = true; });
    if (t >= EV.burst && t < EV.burst + 6) on = true;
    frames.push(on ? { x: LANE.x, y: LANE.y, w: LANE.w, h: LANE.h } : { x: 0, y: 0, w: 0, h: 0 });
  }
  I.defSprite('gemini.meteor', {
    desc: 'Gemini super 双子座·流星雨: both hands gather a star (t0-13), the Gemini constellation flares (t12-19), three waves of diagonal iridescent meteors with long banded trails rain over the whole screen from her side, each impact throwing a star flash, sparkles and a floor ring (t14-47), both twins fire pink beams that cross in a big X over the middle (t44-58), the crossing swells and bursts into a full-screen four-pointed star (t56-63), stardust settles (t60-75). 76 frames.',
    use: 'drawSprite(ctx,"gemini.meteor",0,0,t,{ax,ay,bx,by,facing,palette,part}) from cast f0 (t = frames since cast f0). ax,ay = her raised hand (muzzle) ON SCREEN, bx,by = the twin\'s; facing = hers (the rain comes from her side, mirrors the constellation like the backdrop). part:"back" (fine streak rain + constellation flare) at [C] behind the fighters, part:"front" (meteors, impacts, beams, crossing star, burst, stardust) at [D]. spriteInfo: events {gather 0, flare 12, rain [14,24,34], impact [20,30,40], beams 44, cross 50, burst 56, settle 60, end 76, hits [21,31,41,50,57]}; frames[t] = hit box in SCREEN space (full-width floor lane during each impact window t 20-27 / 30-37 / 40-47 and the burst t 56-61; w = 0 otherwise).',
    info: { duration: DUR, bbox: { x: 0, y: 0, w: W, h: H }, events: EV, frames: frames, lane: LANE, cross: 'x = (ax+bx)/2, y = min(ay,by) - 46' },
    draw: draw
  });
})();
