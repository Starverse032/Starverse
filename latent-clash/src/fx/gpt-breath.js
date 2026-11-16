/* LATENT CLASH — FX: gpt.breath, 龙息 — a cone of teal-white dragon-fire (owned by FX).
 * Stateless: ~18 fire puffs stream from the mouth along opts.angle, growing, roiling sideways and
 * shrinking into tongues at the tip. They are drawn in six passes (dark edge, deep, body, bright,
 * pale, white core), each pass over all puffs, so the cone reads as one shape with a single dark
 * rim and a white-hot core near the mouth. Embers fly out of it. Discs come from baked sheets
 * (one drawImage per disc per pass). opts: length (60..110), angle (deg, 0 = forward,
 * 45 = down-forward), phase 'start' (6f grow) | 'loop' | 'end' (10f: the source cuts off, the
 * rest flies on and dies), facing, palette. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, D2R = PI / 180;
  var G = I.GPT = I.GPT || [{}, {}];
  var RMAX = 20, CELL = RMAX * 2 + 1, NP = 15;

  function bake() {
    [0, 1].forEach(function (pal) {
      var g = G[pal];
      g.discs = g.fireU.map(function (cu) {
        var b = new I.Buf(CELL * (RMAX + 1), CELL);
        for (var r = 0; r <= RMAX; r++) b.disc(r * CELL + RMAX + 0.5, RMAX + 0.5, r + 0.5, cu);
        return I.toCanvas(b);
      });
    });
  }
  I.onInit('gpt-breath', bake);

  function dsc(ctx, sheet, r, x, y) {
    r = r < 0 ? 0 : r > RMAX ? RMAX : r | 0;
    ctx.drawImage(sheet, r * CELL, 0, CELL, CELL, x - RMAX, y - RMAX, CELL, CELL);
  }
  // scratch arrays (no per-frame allocation)
  var PX = new Float32Array(NP + 2), PY = new Float32Array(NP + 2), PR = new Float32Array(NP + 2), PU = new Float32Array(NP + 2), n = 0;

  function draw(ctx, sx, sy, t, o) {
    var g = G[o.pal], raw = o.raw, f = o.facing;
    var Ln = raw.length == null ? 85 : I.clamp(+raw.length, 30, 140), ang = (raw.angle == null ? 0 : +raw.angle) * D2R;
    var dx = Math.cos(ang) * f, dy = Math.sin(ang), nx = -dy, ny = dx;
    var phase = o.phase || 'loop', grow = 1, cut = 0, shrink = 1;
    if (phase === 'start') grow = Math.min(1, (t + 1) / 6);
    else if (phase === 'end') { if (t >= 10) return; cut = (t + 1) / 9; shrink = 1 - t / 12; }
    var tt = phase === 'end' ? t + 600 : t, sp = 8.5 / Ln, rmax = 5 + Ln * 0.095;
    n = 0;
    for (var i = 0; i < NP; i++) {
      var ph = tt * sp + i / NP, cyc = Math.floor(ph), u = ph - cyc;
      if (phase === 'start') u = i / NP + (tt * sp) % (1 / NP);
      if (u > grow || u < cut) continue;
      var h1 = I.hash(i * 7 + cyc * 131 + 3), h2 = I.hash(i * 13 + cyc * 71 + 9);
      var tongue = i % 3 === 0;
      var lat = (h1 - 0.5) * u * Ln * 0.3 + Math.sin(t * 0.45 + i * 1.7) * u * 3.5;
      if (tongue) lat += (h1 < 0.5 ? -1 : 1) * Math.max(0, u - 0.4) * Ln * 0.3;
      var dist = u * Ln;
      var r = 1.5 + rmax * Math.min(1, u / 0.58) * (u > 0.66 ? 1 - (u - 0.66) / 0.34 * 0.72 : 1) * (tongue ? 0.62 : 1) * (0.86 + h2 * 0.28);
      if (phase === 'start' && u > grow - 0.12) r *= 1.15;     // rounded front while it grows
      PX[n] = sx + dx * dist + nx * lat; PY[n] = sy + dy * dist + ny * lat; PR[n] = r * shrink; PU[n] = u; n++;
    }
    if (phase !== 'end') { PX[n] = sx + dx * 2; PY[n] = sy + dy * 2; PR[n] = 3.2; PU[n] = 0; n++; }   // nozzle at the mouth
    // passes: rim (dk), deep, body as forward-pointing capsules (tongue tips), then the hot
    // layers as single discs pulled toward the mouth and the axis; then the white-hot core line.
    var D = g.discs, k, p, q, c1 = 1.05, c2 = 2.05;
    for (q = 0; q < 3; q++) {
      var sh = D[5 - q], add = 2 - q;
      for (k = n - 1; k >= 0; k--) {
        var r0 = PR[k], x = PX[k], y = PY[k];
        if (q === 2 && PU[k] > 0.84) continue;                    // tip wisps stay dark
        dsc(ctx, sh, r0 + add, Math.round(x), Math.round(y));
        if (r0 > 2.5) { dsc(ctx, sh, r0 * 0.5 + add, Math.round(x + dx * r0 * c1), Math.round(y + dy * r0 * c1)); dsc(ctx, sh, r0 * 0.16 + add * 0.5, Math.round(x + dx * r0 * c2), Math.round(y + dy * r0 * c2)); }
      }
    }
    for (q = 0; q < 3; q++) {
      var lim = [0.86, 0.62, 0.4][q], fr = [0.78, 0.56, 0.34][q], back = [1, 2, 3][q];
      for (k = n - 1; k >= 0; k--) {
        p = PU[k]; if (p >= lim) continue;
        var pull = (q + 1) * 0.12, ax = sx + dx * p * Ln, ay = sy + dy * p * Ln;      // toward the axis
        var xx = PX[k] + (ax - PX[k]) * pull - dx * back, yy = PY[k] + (ay - PY[k]) * pull - dy * back;
        dsc(ctx, D[2 - q], PR[k] * fr * (1 - p / lim * 0.35) + (q === 2 && p < 0.12 ? 1 : 0), Math.round(xx), Math.round(yy));
      }
    }
    if (phase !== 'end') {      // white-hot core streak along the axis
      var cl = Ln * (phase === 'start' ? Math.min(0.38, grow * 0.5) : 0.38) * (phase === 'end' ? 0.5 : 1);
      ctx.fillStyle = '#ffffff';
      I.runLine(ctx, sx + dx * 1, sy + dy * 1 - (Math.abs(dx) >= Math.abs(dy) ? 1 : 0), sx + dx * cl, sy + dy * cl - (Math.abs(dx) >= Math.abs(dy) ? 1 : 0), 3);
    }
    // embers flying out of the cone
    var E = g.ember;
    for (i = 0; i < 12; i++) {
      var e1 = I.hash(i * 19 + 5), life = 14 + Math.floor(e1 * 10), age = (tt + Math.floor(I.hash(i * 3 + 1) * life)) % life;
      var eu = age / life * 1.15 + 0.15, el = (I.hash(i * 11 + Math.floor((tt + Math.floor(I.hash(i * 3 + 1) * life)) / life) * 17) - 0.5) * 2;
      if (eu > grow + 0.1 || eu < cut) continue;
      var ed = eu * Ln, ex = sx + dx * ed + nx * el * (6 + eu * Ln * 0.32), ey = sy + dy * ed + ny * el * (6 + eu * Ln * 0.32) - age * 0.25;
      if (phase === 'end' && ((age + i) & 1)) continue;
      ctx.fillStyle = E[(age >> 2) & 3];
      ctx.fillRect(Math.round(ex), Math.round(ey), i % 4 === 0 ? 2 : 1, 1);
    }
  }

  I.defSprite('gpt.breath', {
    desc: 'GPT 龙息: cone of teal-white dragon-fire from the mouth — roiling puffs with a white-hot core near the mouth, teal body, dark teal rim, tongues licking off the edges at the tip, embers. opts.length 60..110, opts.angle (0 forward, 45 down-forward), phase start (6f) | loop | end (10f).',
    use: 'Every frame of breath active (and airBreath with angle 45) at the `muzzle` anchor (mouth), facing = hers, front layer [D]: drawSprite(ctx,"gpt.breath",mx,my,t,{length: 60|85|110, angle, phase, facing, palette}). phase "start" for the first 6 active frames (t from 0), "loop" after, "end" for 10 frames from the end of active.',
    info: {
      duration: 0, bbox: { x: 0, y: -18, w: 112, h: 36 }, startFrames: 6, endFrames: 10,
      /** Hit area (facing right, rel. the mouth) for a given length / angle: a box around the cone. */
      box: function (len, angDeg) {
        var a = (angDeg || 0) * D2R, half = 4 + len * 0.17, ex = Math.cos(a) * len, ey = Math.sin(a) * len;
        var x0 = Math.min(0, ex) - half * Math.abs(Math.sin(a)), x1 = Math.max(0, ex) + half * Math.abs(Math.sin(a));
        var y0 = Math.min(0, ey) - half * Math.cos(a), y1 = Math.max(0, ey) + half * Math.cos(a);
        return { x: Math.round(x0 + 6 * Math.cos(a)), y: Math.round(y0), w: Math.round(x1 - x0 - 6 * Math.cos(a)), h: Math.round(y1 - y0) };
      }
    },
    draw: draw
  });
})();
