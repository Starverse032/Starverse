/* LATENT CLASH — ILLUST: super cut-ins (I.cutin) and the animated title key art (I.TITLE).
 * Cut-in: the bust's eye band re-rendered with determined brows, composed over speed lines at
 * 120x36 and doubled to 240x72 (uniform 2x chunky pixels, allowed for super cut-ins). Opaque band.
 * Title: both busts facing off (DeepSeek mirrored) over a pre-rendered orange-vs-blue clash. */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit, S = K.S;

  // ---------------------------------------------------------------- cut-in
  I.cutin = function (charId) {
    var src = K.painter(112, 128);
    (charId === 'claude' ? I.drawClaudeBust : I.drawDeepseekBust)(src, { expr: 'cut', noPen: true });
    var P = K.painter(120, 36), r = K.rng(charId === 'claude' ? 17 : 29), x, y;
    // band: deep accent, speed lines streaming left
    P.fill(P.rect(0, 0, 120, 36), S.a3);
    for (var i = 0; i < 26; i++) {
      y = 1 + Math.floor(r() * 34); var x0 = Math.floor(r() * 60), len = 12 + Math.floor(r() * 50);
      var sl = i % 5 === 0 ? S.W : i % 2 ? S.a1 : S.a2;
      for (x = x0; x < Math.min(120, x0 + len); x++) P.px(x, y, sl);
    }
    // face crop: bust rows 22..58, cols 12..94 -> placed at x 30, with a slanted left cut
    var oy = (charId === 'claude' ? 23 : 25);
    for (y = 0; y < 36; y++) for (x = 0; x < 84; x++) {
      var sx = 12 + x, sy = oy + y, c = src.get(sx, sy);
      if (!c || x + (36 - y) * 0.45 < 14) continue;
      P.px(30 + x, y, c);
    }
    // slash borders
    for (x = 0; x < 120; x++) { P.px(x, 0, S.a0); P.px(x, 35, S.a0); }
    var B = K.painter(240, 72);
    for (y = 0; y < 72; y++) for (x = 0; x < 240; x++) B.c[y * 240 + x] = P.c[(y >> 1) * 120 + (x >> 1)];
    return B;
  };

  // ---------------------------------------------------------------- title key art
  var TT = I.TITLE = {}, L = null;
  var W = 384, H = 216;

  function grad(ctx, y0, y1, cols) {
    var n = cols.length, h = y1 - y0;
    for (var i = 0; i < n; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(0, y0 + Math.floor(i * h / n), W, Math.ceil(h / n) + 1); }
  }
  TT.init = function () {
    if (L) return;
    L = {};
    // back layer: night gradient, warm left glow / cool right glow as dithered bands
    var bg = K.canvas(W, H), b = bg.getContext('2d');
    grad(b, 0, H, ['#07060f', '#0b0a18', '#100e22', '#15132c', '#1a1736', '#1f1b40', '#231f45', '#272250']);
    var r = K.rng(5);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var dl = Math.hypot((x - 40) / 1.6, y - 150), dr = Math.hypot((x - 344) / 1.6, y - 150);
      var ch = ((x + y) & 1) === 0, ch2 = ((x ^ y) & 3) === 0;
      if (dl < 70 && (dl < 45 || ch) && (dl < 25 || ch || ch2)) { b.fillStyle = dl < 30 ? '#4a2030' : '#341626'; b.fillRect(x, y, 1, 1); }
      if (dr < 70 && (dr < 45 || ch) && (dr < 25 || ch || ch2)) { b.fillStyle = dr < 30 ? '#18286a' : '#141c4a'; b.fillRect(x, y, 1, 1); }
    }
    // latent grid floor lines (perspective) in the lower half
    b.fillStyle = '#2e2860';
    for (var k = 0; k < 7; k++) { var gy = 150 + Math.floor(k * k * 1.6); b.fillRect(0, gy, W, 1); }
    for (k = -10; k <= 10; k++) for (y = 150; y < H; y += 1) { var gx = Math.round(192 + k * 22 * (1 + (y - 150) / 30)); if (gx >= 0 && gx < W && (y & 1)) b.fillRect(gx, y, 1, 1); }
    L.bg = bg;
    // two star layers (tileable horizontally)
    L.stars = [0, 1].map(function (lay) {
      var c = K.canvas(W, 140), x2 = c.getContext('2d');
      for (var i = 0; i < (lay ? 40 : 90); i++) {
        var sx = Math.floor(r() * W), sy = Math.floor(r() * 140), warm = sx < W / 2;
        x2.fillStyle = lay ? (warm ? '#ffd9a0' : '#a9c0ff') : (warm ? '#7a5a6a' : '#4a5a9a');
        x2.fillRect(sx, sy, 1, 1);
        if (lay && i % 6 === 0) { x2.fillRect(sx - 1, sy, 3, 1); x2.fillRect(sx, sy - 1, 1, 3); }
      }
      return c;
    });
    // busts (3 sway frames each); DeepSeek mirrored to face left
    L.claude = [-1, 0, 1].map(function (sw) { return I.render('claude', I.ART.claude.titleFrame({ sway: sw }), 0); });
    L.deep = [-1, 0, 1].map(function (sw) { return I.render('deepseek', I.ART.deepseek.titleFrame({ sway: sw }), 0, true); });
    // clash core frames: orange starburst + blue ring, 4 rotations
    L.core = [0, 1, 2, 3].map(function (f) {
      var P = K.painter(64, 64), tb = [[0, 0, 0, 0], [255, 158, 107, 255], [255, 217, 160, 255], [255, 255, 255, 255], [77, 107, 254, 255], [116, 228, 255, 255], [212, 250, 255, 255]];
      var a = f * Math.PI / 16;
      var ring = P.ell(32, 32, 22 + (f & 1), 22 + (f & 1)).sub(P.ell(32, 32, 18, 18));
      P.fill(ring.and(P.rect(32, 0, 32, 64)), 4); P.fill(ring.and(P.rect(32, 0, 32, 64)).band(-1, 1), 5);
      var sb = I.starburst(P, 32, 32, 26, a, [1, 0.55, 0.85, 0.5, 1, 0.6, 0.8, 0.5]);
      P.fill(sb.and(P.rect(0, 0, 36, 64)), 1);
      P.fill(I.starburst(P, 32, 32, 15, a + 0.3), 2);
      P.fill(P.ell(32, 32, 7, 7), 6); P.fill(P.ell(32, 32, 4.5, 4.5), 3);
      return P.canvas(tb);
    });
  };

  TT.draw = function (ctx, t) {
    if (!L) TT.init();
    ctx.drawImage(L.bg, 0, 0);
    // parallax stars drift left (far slow, near faster)
    for (var lay = 0; lay < 2; lay++) {
      var off = Math.floor(t * (lay ? 0.25 : 0.1)) % W;
      ctx.drawImage(L.stars[lay], -off, 0); ctx.drawImage(L.stars[lay], W - off, 0);
    }
    var cx = 192, cy = 150, i, k;
    // energy streams converging on the core: orange from the left, blue water from the right
    for (i = 0; i < 18; i++) {
      var ph = (t * 2 + i * 37) % 150, y = cy - 22 + ((i * 29) % 44), len = 10 + (i % 4) * 6;
      var wob = Math.round(Math.sin((t + i * 13) * 0.08) * 2);
      ctx.fillStyle = i % 3 ? '#ff9e6b' : '#ffd9a0';
      ctx.fillRect(cx - 160 + ph, y + wob, Math.max(1, Math.min(len, cx - 14 - (cx - 160 + ph))), 1);
      ctx.fillStyle = i % 3 ? '#4d8afe' : '#74e4ff';
      var xr = cx + 160 - ph - len;
      if (xr > cx + 14) ctx.fillRect(xr, y - wob + 1, len, 1);
    }
    // sparks flung from the core (deterministic from t)
    for (i = 0; i < 16; i++) {
      var life = (t + i * 11) % 44, ang = i * 2.39996, sp = 1.4 + (i % 3) * 0.5;
      var px = Math.round(cx + Math.cos(ang) * life * sp), py = Math.round(cy + Math.sin(ang) * life * sp * 0.6);
      if (life > 40) continue;
      ctx.fillStyle = (Math.cos(ang) < 0) ? (life < 20 ? '#fff6d0' : '#ff9e6b') : (life < 20 ? '#d4faff' : '#4d6bfe');
      ctx.fillRect(px, py, life < 14 ? 2 : 1, life < 14 ? 2 : 1);
    }
    // girls (gentle bob + hair sway frames)
    var sw = Math.sin(t * 0.035), fi = sw < -0.4 ? 0 : sw > 0.4 ? 2 : 1;
    var bobA = Math.round(Math.sin(t * 0.05) * 1.5), bobB = Math.round(Math.sin(t * 0.05 + 2) * 1.5);
    ctx.drawImage(L.claude[fi], 6, 88 + bobA);
    ctx.drawImage(L.deep[2 - fi], W - 118, 88 + bobB);
    // clash core
    k = (t >> 2) & 3;
    ctx.drawImage(L.core[k], cx - 32, cy - 32);
    // twinkles in the sky
    for (i = 0; i < 6; i++) {
      var tw = (t + i * 23) % 60; if (tw > 12) continue;
      var sx = (i * 67 + 31) % W, sy = 12 + (i * 41) % 70, c = tw < 6 ? '#ffffff' : '#a9c0ff';
      ctx.fillStyle = c; ctx.fillRect(sx, sy, 1, 1);
      if (tw > 2 && tw < 10) { ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
    }
  };
})();
