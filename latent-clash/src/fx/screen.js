/* LATENT CLASH — FX full-screen overlays (owned by FX).
 * screen.superBg: dark backdrop + radiating speed lines in the character's
 * colours (lazily baked per char/palette, 3 flicker frames, 2x screen so the
 * focus can be anywhere). screen.speedLines: horizontal streaks. screen.koFlash:
 * white -> black/red -> fade. All respect LC.settings.flash === false. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var W = LC.W || 384, H = LC.H || 216, TAU = Math.PI * 2;
  var radial = {};

  function lineSet(key) {
    if (radial[key]) return radial[key];
    var parts = key.split(':'), ch = parts[0], pal = +parts[1], col = parts[2];
    var ramp;
    if (col) ramp = [I.col('#ffffff'), I.col(col), I.col(I.mix(col, '#000000', 0.45))];
    else if (ch === 'deepseek') { var w = I.scheme('deepseek', pal).water.u; ramp = [w[0], w[1], w[3]]; }
    else if (ch === 'claude') { var l = I.scheme('claude', pal).light.u; ramp = [l[0], l[1], l[3]]; }
    else ramp = [I.col('#ffffff'), I.col('#fff07a'), I.col('#a8661e')];
    var BW2 = W * 2, BH2 = H * 2, cx = W, cy = H, frames = [];
    for (var f = 0; f < 3; f++) {
      var b = new I.Buf(BW2, BH2), rng = I.bakeRng(77 + f * 13);
      for (var i = 0; i < 70; i++) {
        var a = rng() * TAU, r0 = 50 + rng() * 120, r1 = r0 + 60 + rng() * 300, wd = 0.6 + rng() * 1.6;
        var c = i % 5 === 0 ? ramp[0] : i % 2 ? ramp[1] : ramp[2];
        b.ray(cx, cy, a, r0, r1, 0.3, wd, c);
      }
      frames.push(I.toCanvas(b));
    }
    radial[key] = frames;
    return frames;
  }
  // pre-bake the four character variants (cheap enough, avoids a hitch at the super flash)
  I.onInit('screen', function () { ['claude:0', 'claude:1', 'deepseek:0', 'deepseek:1'].forEach(lineSet); });

  I.defSprite('screen.superBg', {
    desc: 'Super flash backdrop: dims the stage, radiating speed lines from the focus point in the character\'s colours, flickering.',
    use: 'Between stage.drawBack and fx back layer while the super flash runs: drawSprite(ctx,"screen.superBg",0,0,t,{char,palette,cx,cy}) with cx,cy = attacker chest on screen. opts.color overrides the tint.',
    info: { duration: 0, bbox: { x: 0, y: 0, w: W, h: H } },
    draw: function (ctx, sx, sy, t, o) {
      var soft = LC.settings && LC.settings.flash === false;
      var a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * Math.min(1, (t + 1) / 4) * (soft ? 0.55 : 0.78);
      ctx.fillStyle = o.char === 'deepseek' ? '#040a1c' : o.char === 'claude' ? '#140806' : '#05040a';
      ctx.fillRect(sx - 8, sy - 8, W + 16, H + 16);
      ctx.globalAlpha = a0 * (soft ? 0.4 : 1);
      var fr = lineSet((o.char || 'none') + ':' + o.pal + ':' + (o.color || ''));
      var cx = o.cx == null ? W / 2 : o.cx, cy = o.cy == null ? H / 2 : o.cy;
      ctx.drawImage(fr[soft ? 0 : (t >> 1) % 3], Math.round(sx + cx - W), Math.round(sy + cy - H));
      ctx.globalAlpha = a0;
    }
  });

  I.defSprite('screen.speedLines', {
    desc: 'Horizontal speed streaks racing across the screen (white/pale), animated.',
    use: 'Over the stage during dashes-in-cut-ins / super cut-in band: drawSprite(ctx,"screen.speedLines",0,0,t,{facing, color}); facing = direction of travel.',
    info: { duration: 0, bbox: { x: 0, y: 0, w: W, h: H } },
    draw: function (ctx, sx, sy, t, o) {
      var soft = LC.settings && LC.settings.flash === false, n = soft ? 14 : 34;
      for (var i = 0; i < n; i++) {
        var y = Math.floor(I.hash(i * 11 + 3) * H), len = 20 + Math.floor(I.hash(i * 5) * 90), sp = 14 + I.hash(i) * 16;
        var x = ((t * sp + I.hash(i * 3) * 900) % (W + len * 2)) - len;
        if (o.facing < 0) x = W - x - len;
        ctx.fillStyle = o.color || (i % 4 ? '#d6e2ff' : '#ffffff');
        ctx.fillRect(sx + Math.round(x), sy + y, len, i % 6 ? 1 : 2);
      }
    }
  });

  I.defSprite('screen.koFlash', {
    desc: 'KO flash: 2f white, 3f dark-red/black inversion, then a fading red tint, 24f total.',
    use: 'Over everything (before the HUD) for 24 frames from the KO hit: drawSprite(ctx,"screen.koFlash",0,0,t). Softened when LC.settings.flash === false.',
    info: { duration: 24, bbox: { x: 0, y: 0, w: W, h: H } },
    draw: function (ctx, sx, sy, t, o) {
      if (t >= 24) return;
      var soft = LC.settings && LC.settings.flash === false, a0 = ctx.globalAlpha;
      if (t < 2) { ctx.globalAlpha = a0 * (soft ? 0.25 : 0.92); ctx.fillStyle = '#ffffff'; }
      else if (t < 5) { ctx.globalAlpha = a0 * (soft ? 0.2 : 0.7); ctx.fillStyle = t === 2 ? '#3c0a20' : '#05040a'; }
      else { ctx.globalAlpha = a0 * (soft ? 0.12 : 0.4) * (1 - (t - 5) / 19); ctx.fillStyle = '#d41c4a'; }
      ctx.fillRect(sx - 8, sy - 8, W + 16, H + 16);
      ctx.globalAlpha = a0;
    }
  });
})();
