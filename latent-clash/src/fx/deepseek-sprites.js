/* LATENT CLASH — FX: DeepSeek 娘 stateless sprites (owned by FX).
 * deepseek.wave (travelling ground wave, looped) and deepseek.pool (data-water
 * portal ellipse on the floor). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI;
  var A = I.A = I.A || {};
  var DS = A.dss = [{}, {}];

  function bake() {
    [0, 1].forEach(function (pal) {
      var sc = I.scheme('deepseek', pal), Wt = sc.water.u, D = DS[pal];
      // WAVE: 8f loop, 40x30, origin base centre (18,28)
      D.wave = I.anim(40, 30, 8, 18, 28, function (b, f) {
        var by = 28, j = (f % 4 === 1 || f % 4 === 2) ? 1 : 0;
        var body = [2, by, 6, by - 4, 11, by - 11, 16, by - 19, 21 - j, by - 23, 26, by - 22 + j, 29, by - 18, 28, by - 14, 25, by - 15, 23, by - 12, 25, by - 6, 30, by];
        b.poly(body, Wt[2]);
        b.poly([8, by - 3, 13, by - 10, 18, by - 17, 22 - j, by - 20, 20, by - 13, 15, by - 6, 12, by], Wt[1]);   // lit back slope
        b.poly([23, by - 11, 26, by - 5, 30, by, 22, by], Wt[3]);                                               // shaded face
        for (var i = 0; i < 6; i++) b.set(14 + i * 2, by - 18 - (i < 3 ? i : 5 - i) + ((i + f) % 2), Wt[0]);   // foam lip
        b.rect(20 - j, by - 23, 6, 2, Wt[0]); b.rect(26, by - 21 + j, 3, 2, Wt[0]); b.set(28, by - 16, Wt[0]);
        for (var k = 0; k < 3; k++) { var bx = 10 + ((f * 2 + k * 7) % 12), byy = by - 4 - ((f + k * 3) % 8); b.set(bx, byy, Wt[1]); }
        b.outline(Wt[5]);
        for (var s = 0; s < 4; s++) { var t = (f + s * 2) % 8; b.rect(16 - t * 1.6, by - 22 - t + (t * t) * 0.18, 2, 1, s % 2 ? Wt[0] : Wt[1]); }   // spray flung back
        b.rect(0, by + 1, 34, 1, Wt[1]); for (var q = 0; q < 34; q += 3) b.set(((q + f * 2) % 36), by, Wt[0]);   // foam skid line
      });
      // POOL: 5 sizes x 8 frames, 48x14
      D.pool = [5, 10, 15, 20, 24].map(function (rx) {
        var ry = Math.max(1.5, rx * 0.2);
        return I.anim(52, 14, 8, 26, 7, function (b, f) {
          var cx = 26, cy = 7;
          b.ellipse(cx, cy, rx + 1, ry + 1, Wt[1]);
          b.ellipse(cx, cy, rx, ry, Wt[5]);
          if (rx > 6) {
            for (var k = 0; k < 2; k++) { var rr = ((f / 8 + k * 0.5) % 1) * (rx - 2) + 2; b.ellRing(cx, cy, rr, Math.max(1, rr * 0.2), 1, rr > rx * 0.7 ? Wt[3] : Wt[2]); }
            for (var g = 0; g < 4; g++) { var gx = cx + Math.round((I.hash(g * 7 + (f >> 1)) - 0.5) * rx * 1.4), gy = cy + Math.round((I.hash(g * 3 + 1) - 0.5) * ry); b.set(gx, gy, (g + f) % 3 ? Wt[2] : Wt[0]); }
          }
          b.rect(cx - rx + 2, cy - Math.round(ry), rx, 1, Wt[0]);
        });
      });
    });
  }
  I.onInit('deepseek-sprites', bake);

  I.defSprite('deepseek.wave', {
    desc: 'Travelling breaking ground wave (~26x22) with curling crest, foam lip, spray flung back, foam skid line; 8f loop.',
    use: 'Every frame at the wave projectile position, origin = base centre on the floor; facing = travel direction; t = frames alive.',
    info: { duration: 0, bbox: { x: -15, y: -24, w: 30, h: 25 } },
    draw: function (ctx, sx, sy, t, o) {
      var D = DS[o.pal];
      if (t < 3) { I.drawAnim(ctx, D.wave, 0, sx, sy + (3 - t) * 6, o.facing); return; }
      I.drawAnim(ctx, D.wave, (t >> 1) % 8, sx, sy, o.facing);
    }
  });

  I.defSprite('deepseek.pool', {
    desc: 'Flat elliptical data-water portal on the floor (~40x8): rim, dark centre, ripples, glints. opts.power 0..1 = open size.',
    use: 'At the floor point during diveIn sink / travel / before diveOut; animate power 0->1 to open (8f) and 1->0 to close.',
    info: { duration: 0, bbox: { x: -25, y: -6, w: 50, h: 12 } },
    draw: function (ctx, sx, sy, t, o) {
      var D = DS[o.pal], i = Math.round(o.power * 4);
      if (o.power <= 0.02) return;
      I.drawAnim(ctx, D.pool[Math.max(0, Math.min(4, i))], (t >> 1) % 8, sx, sy, 1);
    }
  });
})();
