/* LATENT CLASH — FX full-screen overlays (owned by FX).
 * screen.superBg      super-flash backdrop (dim + radiating speed lines, char colours)
 * screen.speedLines   horizontal streaks
 * screen.koFlash      KO white-out -> inversion -> red fade (24f)
 * screen.koBackdrop   radial burst backdrop behind the slow-motion KO fall (animated)
 * screen.superFinish  frozen full-screen burst in the winner's colours (super KO)
 * screen.impact       6-8f radial speed-line burst + tint for heavy hits / counters
 * Big radial images are baked once at 600x340 with the focus in the middle, so the
 * focus can move +-100 / +-54 px from the screen centre and still cover the screen
 * plus the 8 px shake bleed. Runtime rays use run-merged fillRects (no AA).
 * All respect LC.settings.flash === false (no white-outs, softened tints). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var W = LC.W || 384, H = LC.H || 216, TAU = Math.PI * 2;
  var BW = 600, BH = 340, BCX = 300, BCY = 170;   // big radial canvas + its focus
  function soft() { return LC.settings && LC.settings.flash === false; }
  I.softFlash = soft;

  /** Clamp a focus point so a BWxBH canvas centred on it covers the screen + bleed. */
  function focus(o, dx, dy) {
    var cx = o.cx == null ? (dx == null ? W / 2 : dx) : o.cx, cy = o.cy == null ? (dy == null ? H / 2 : dy) : o.cy;
    return [Math.round(I.clamp(cx, W + 8 - BCX, BCX - 8)), Math.round(I.clamp(cy, H + 8 - BCY, BCY - 8))];
  }
  I.screenFocus = focus;

  /** Bresenham line drawn as merged runs of fillRect (th = thickness across the run). */
  function runLine(ctx, x0, y0, x1, y1, th) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = x1 - x0, dy = y1 - y0, adx = dx < 0 ? -dx : dx, ady = dy < 0 ? -dy : dy, i, s, a, b;
    if (adx >= ady) {
      if (adx === 0) { ctx.fillRect(x0, y0, th, th); return; }
      s = dx < 0 ? -1 : 1; a = x0; b = y0;
      for (i = 1; i <= adx; i++) {
        var yy = y0 + Math.round(dy * i / adx);
        if (yy !== b) { var xe = x0 + s * (i - 1); ctx.fillRect(Math.min(a, xe), b, (a < xe ? xe - a : a - xe) + 1, th); a = x0 + s * i; b = yy; }
      }
      ctx.fillRect(Math.min(a, x1), b, (a < x1 ? x1 - a : a - x1) + 1, th);
    } else {
      s = dy < 0 ? -1 : 1; a = y0; b = x0;
      for (i = 1; i <= ady; i++) {
        var xx = x0 + Math.round(dx * i / ady);
        if (xx !== b) { var ye = y0 + s * (i - 1); ctx.fillRect(b, Math.min(a, ye), th, (a < ye ? ye - a : a - ye) + 1); a = y0 + s * i; b = xx; }
      }
      ctx.fillRect(b, Math.min(a, y1), th, (a < y1 ? y1 - a : a - y1) + 1);
    }
  }
  I.runLine = runLine;
  /** Radial ray from (cx,cy) at angle a between radii r0..r1, clipped to the screen+bleed. */
  function radialRay(ctx, cx, cy, a, r0, r1, th) {
    var ux = Math.cos(a), uy = Math.sin(a), t1 = r1;
    // clip the far end to the bleed rectangle
    if (ux > 0.001) t1 = Math.min(t1, (W + 8 - cx) / ux); else if (ux < -0.001) t1 = Math.min(t1, (-8 - cx) / ux);
    if (uy > 0.001) t1 = Math.min(t1, (H + 8 - cy) / uy); else if (uy < -0.001) t1 = Math.min(t1, (-8 - cy) / uy);
    if (t1 <= r0) return;
    runLine(ctx, cx + ux * r0, cy + uy * r0, cx + ux * t1, cy + uy * t1, th);
  }
  I.radialRay = radialRay;

  // ---- colour sets ---------------------------------------------------------------
  /** {core, ring, nearA, nearB, farA, farB, line, line2, dark} for a char/palette ('' = neutral KO red). */
  function burstCols(ch, pal) {
    if (ch === 'claude') {
      var L = I.scheme('claude', pal).light.css;
      return { core: '#ffffff', ring: L[1], nearA: L[3], nearB: L[4], farA: L[4], farB: L[5], line: '#ffffff', line2: L[1], dark: I.mix(L[5], '#000000', 0.5) };
    }
    if (ch === 'deepseek') {
      var sc = I.scheme('deepseek', pal), Wt = sc.water.css, B = sc.blue.css;
      return { core: '#ffffff', ring: Wt[1], nearA: Wt[4], nearB: B[1], farA: B[1], farB: B[3], line: '#ffffff', line2: Wt[2], dark: I.mix(B[3], '#000000', 0.5) };
    }
    var R = I.N.red.css;
    return { core: '#ffffff', ring: '#fff6b8', nearA: R[5], nearB: '#2a0a18', farA: '#2a0a18', farB: '#0e0610', line: '#ffffff', line2: R[2], dark: '#05040a' };
  }
  I.burstCols = burstCols;

  // ---- baked radial images ---------------------------------------------------------
  var radial = {}, wedges = {};
  /** Super-flash speed lines (2 flicker frames) per char:pal. */
  function lineSet(key) {
    if (radial[key]) return radial[key];
    var parts = key.split(':'), ch = parts[0], pal = +parts[1], c = burstCols(ch === 'none' ? '' : ch, pal);
    var ramp = ch === 'none' ? [I.col('#ffffff'), I.col('#fff07a'), I.col('#a8661e')] : [I.col(c.line), I.col(c.ring), I.col(c.nearA)];
    var frames = [];
    for (var f = 0; f < 2; f++) {
      var b = new I.Buf(BW, BH), rng = I.bakeRng(77 + f * 13);
      for (var i = 0; i < 64; i++) {
        var a = rng() * TAU, r0 = 46 + rng() * 110, r1 = r0 + 70 + rng() * 260, wd = 0.6 + rng() * 1.5;
        b.ray(BCX, BCY, a, r0, r1, 0.3, wd, i % 5 === 0 ? ramp[0] : i % 2 ? ramp[1] : ramp[2]);
      }
      frames.push(I.toCanvas(b));
    }
    radial[key] = frames;
    return frames;
  }
  /** Radial wedge burst (bands get darker with distance, white core + ring). */
  function wedgeSet(key) {
    if (wedges[key]) return wedges[key];
    var parts = key.split(':'), ch = parts[0], pal = +parts[1], c = burstCols(ch, pal);
    var nA = I.col(c.nearA), nB = I.col(c.nearB), fA = I.col(c.farA), fB = I.col(c.farB), core = I.col(c.core), ring = I.col(c.ring), dk = I.col(c.dark);
    var N = 26, rng = I.bakeRng(ch.length * 31 + pal * 7 + 5), edges = [], acc = 0;
    for (var i = 0; i < N; i++) { var wd = 0.55 + rng() * 0.9; edges.push(wd); acc += wd; }
    var cum = [0]; for (i = 0; i < N; i++) cum.push(cum[i] + edges[i] / acc * TAU);
    var LUT = new Uint8Array(2048);
    for (i = 0, k = 0; i < 2048; i++) { var aa = (i + 0.5) / 2048 * TAU; while (k < N - 1 && cum[k + 1] <= aa) k++; LUT[i] = k; }
    var b = new I.Buf(BW, BH), d = b.d, k;
    for (var y = 0; y < BH; y++) for (var x = 0; x < BW; x++) {
      var dx = x + 0.5 - BCX, dy = (y + 0.5 - BCY) * 1.15, r = Math.sqrt(dx * dx + dy * dy);
      var a = Math.atan2(dy, dx); if (a < 0) a += TAU;
      var odd = LUT[Math.min(2047, Math.floor(a / TAU * 2048))] & 1, col;
      if (r < 20) col = core;
      else if (r < 25) col = ring;
      else if (r < 28) col = odd ? nA : ring;
      else {
        var far = I.clamp((r - 110) / 90, 0, 1), useFar = I.bayer(x, y) < far;
        col = useFar ? (odd ? fB : fA) : (odd ? nB : nA);
        if (r > 250 && odd && I.bayer(x + 1, y) < (r - 250) / 80) col = dk;
      }
      d[y * BW + x] = col;
    }
    wedges[key] = I.toCanvas(b);
    return wedges[key];
  }
  I.onInit('screen', function () {
    ['claude:0', 'claude:1', 'deepseek:0', 'deepseek:1', 'none:0'].forEach(lineSet);
    ['claude:0', 'claude:1', 'deepseek:0', 'deepseek:1', ':0'].forEach(wedgeSet);
  });

  // ---- sprites -----------------------------------------------------------------------
  I.defSprite('screen.superBg', {
    desc: 'Super flash backdrop: dims the stage, white ring pop at the focus, radiating speed lines in the character\'s colours, flickering.',
    use: 'Between stage.drawBack and fx back layer while the super flash runs: drawSprite(ctx,"screen.superBg",0,0,t,{char,palette,cx,cy}) with cx,cy = attacker chest on screen.',
    info: { duration: 0, bbox: { x: 0, y: 0, w: W, h: H } },
    draw: function (ctx, sx, sy, t, o) {
      var sf = soft(), a0 = ctx.globalAlpha, ch = o.char === 'claude' || o.char === 'deepseek' ? o.char : 'none';
      ctx.globalAlpha = a0 * Math.min(1, (t + 1) / 3) * (sf ? 0.6 : 0.84);
      ctx.fillStyle = ch === 'deepseek' ? '#040a1c' : ch === 'claude' ? '#140806' : '#05040a';
      ctx.fillRect(sx - 8, sy - 8, W + 16, H + 16);
      var f = focus(o), fr = lineSet(ch + ':' + o.pal);
      ctx.globalAlpha = a0 * (sf ? 0.45 : 1);
      ctx.drawImage(fr[sf ? 0 : (t >> 1) & 1], sx + f[0] - BCX, sy + f[1] - BCY);
      ctx.globalAlpha = a0;
      if (t < 8) {   // ring pop at the focus
        var c = burstCols(ch === 'none' ? '' : ch, o.pal), cx = o.cx == null ? W / 2 : Math.round(o.cx), cy = o.cy == null ? H / 2 : Math.round(o.cy);
        var r = 6 + t * 9;
        ctx.fillStyle = t < 3 ? c.line : c.ring;
        for (var k = 0; k < 24; k++) { var a = k * TAU / 24; ctx.fillRect(sx + cx + Math.round(Math.cos(a) * r) - 1, sy + cy + Math.round(Math.sin(a) * r * 0.9) - 1, t < 4 ? 3 : 2, t < 4 ? 3 : 2); }
      }
    }
  });

  I.defSprite('screen.speedLines', {
    desc: 'Horizontal speed streaks racing across the screen: tapered 2-tone streaks, a few thick ones.',
    use: 'Over the stage during dashes-in-cut-ins / super cut-in band: drawSprite(ctx,"screen.speedLines",0,0,t,{facing, color}); facing = direction of travel.',
    info: { duration: 0, bbox: { x: 0, y: 0, w: W, h: H } },
    draw: function (ctx, sx, sy, t, o) {
      var n = soft() ? 16 : 40;
      for (var i = 0; i < n; i++) {
        var y = Math.floor(I.hash(i * 11 + 3) * H), len = 24 + Math.floor(I.hash(i * 5) * 110), sp = 16 + I.hash(i) * 18;
        var x = ((t * sp + I.hash(i * 3) * 900) % (W + len * 2)) - len, th = i % 7 === 0 ? 2 : 1;
        if (o.facing < 0) x = W - x - len;
        var head = Math.round(len * 0.35), tail = len - head, hx = o.facing < 0 ? x : x + tail, tx = o.facing < 0 ? x + head : x;
        ctx.fillStyle = o.color || (i % 3 ? '#a9b6e8' : '#d6e2ff');
        ctx.fillRect(sx + Math.round(tx), sy + y, tail, th);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx + Math.round(hx), sy + y, head, th);
      }
    }
  });

  I.defSprite('screen.koFlash', {
    desc: 'KO flash: 2f white-out, 1f dark-red inversion, 2f black, then a fading red tint; 24f.',
    use: 'Over everything (before the HUD) for 24 frames from the KO hit: drawSprite(ctx,"screen.koFlash",0,0,t). From t = 5 on, draw screen.koBackdrop behind the fighters. Softened when LC.settings.flash === false.',
    info: { duration: 24, bbox: { x: 0, y: 0, w: W, h: H } },
    draw: function (ctx, sx, sy, t, o) {
      if (t >= 24) return;
      var sf = soft(), a0 = ctx.globalAlpha;
      if (t < 2) { ctx.globalAlpha = a0 * (sf ? 0.25 : 1); ctx.fillStyle = '#ffffff'; }
      else if (t < 5) { ctx.globalAlpha = a0 * (sf ? 0.2 : 0.75); ctx.fillStyle = t === 2 ? '#3c0a20' : '#05040a'; }
      else { ctx.globalAlpha = a0 * (sf ? 0.1 : 0.32) * (1 - (t - 5) / 19); ctx.fillStyle = '#d41c4a'; }
      ctx.fillRect(sx - 8, sy - 8, W + 16, H + 16);
      ctx.globalAlpha = a0;
    }
  });

  /** Shared: static/animated rays over a wedge image. */
  function rays(ctx, sx, sy, cx, cy, t, n, seed, c, move, sf) {
    for (var i = 0; i < n; i++) {
      var h1 = I.hash(seed + i * 7), h2 = I.hash(seed + i * 13 + 1), a = (i + h1 * 0.8) * TAU / n;
      var r0 = 34 + h2 * 70, len = 50 + I.hash(seed + i * 3) * 150;
      if (move) { r0 = 30 + ((t * (4 + h2 * 4) + h1 * 400) % 380); len = 30 + h2 * 70; }
      ctx.fillStyle = i % 3 === 0 ? c.line : c.line2;
      radialRay(ctx, sx + cx, sy + cy, a, r0, r0 + len, !sf && i % 4 === 0 ? 2 : 1);
    }
  }

  I.defSprite('screen.superFinish', {
    desc: 'Frozen full-screen burst in the winner\'s colours: radial bands (darker outward), white core + ring at the focus, static speed lines; 3f white flash pop at the start.',
    use: 'When a super KOs: instead of the stage/backdrop, behind the fighters: drawSprite(ctx,"screen.superFinish",0,0,t,{char: winner, palette, cx, cy}) with cx,cy = the KO contact point on screen. Hold it as long as the freeze lasts (t keeps counting; the image is static after t = 3).',
    info: { duration: 0, bbox: { x: 0, y: 0, w: W, h: H } },
    draw: function (ctx, sx, sy, t, o) {
      var ch = o.char === 'deepseek' ? 'deepseek' : 'claude', c = burstCols(ch, o.pal), f = focus(o), sf = soft();
      ctx.drawImage(wedgeSet(ch + ':' + o.pal), sx + f[0] - BCX, sy + f[1] - BCY);
      var cx = o.cx == null ? f[0] : Math.round(o.cx), cy = o.cy == null ? f[1] : Math.round(o.cy);
      rays(ctx, sx, sy, cx, cy, 0, sf ? 24 : 40, 911, c, false, sf);
      if (t < 3 && !sf) {
        var a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * (t === 0 ? 0.9 : t === 1 ? 0.6 : 0.3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 8, sy - 8, W + 16, H + 16); ctx.globalAlpha = a0;
      }
    }
  });

  I.defSprite('screen.koBackdrop', {
    desc: 'Radial burst backdrop for the slow-motion KO: dark-red (or winner-coloured) wedges, white core, speed lines streaming outward from the focus; replaces the stage behind the fighters.',
    use: 'From the end of the KO white-out (koFlash t >= 5) until the body lands: instead of stage.drawBack, drawSprite(ctx,"screen.koBackdrop",0,0,t,{cx,cy,char?,palette?}); t = frames since it started (render frames are fine). cx,cy = KO contact point on screen. No char = neutral KO red.',
    info: { duration: 0, bbox: { x: 0, y: 0, w: W, h: H } },
    draw: function (ctx, sx, sy, t, o) {
      var ch = o.char === 'claude' || o.char === 'deepseek' ? o.char : '', c = burstCols(ch, o.pal), f = focus(o), sf = soft();
      ctx.drawImage(wedgeSet(ch + ':' + (ch ? o.pal : 0)), sx + f[0] - BCX, sy + f[1] - BCY);
      var a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * 0.45; ctx.fillStyle = c.dark; ctx.fillRect(sx - 8, sy - 8, W + 16, H + 16); ctx.globalAlpha = a0;
      var cx = o.cx == null ? f[0] : Math.round(o.cx), cy = o.cy == null ? f[1] : Math.round(o.cy);
      rays(ctx, sx, sy, cx, cy, t, sf ? 20 : 36, 517, c, true, sf);
      ctx.fillStyle = c.core;                         // pulsing core
      var r = 14 + ((t >> 2) & 1) * 2;
      ctx.fillRect(sx + cx - r, sy + cy - 2, r * 2 + 1, 5); ctx.fillRect(sx + cx - 2, sy + cy - r, 5, r * 2 + 1);
    }
  });

  I.defSprite('screen.impact', {
    desc: '8f full-screen burst for heavy hits and counters: 1f tint (white; red for counters) + 1f dark beat, radial speed lines shooting outward from the focus and thinning out. Centre (r < 30) stays clear.',
    use: 'On a heavy hit / counter / launcher: for 8 frames from the hit, drawSprite(ctx,"screen.impact",0,0,t,{cx,cy, phase:"counter"|undefined, char?, palette?}) behind the fighters (right after stage.drawBack), cx,cy = contact point on screen. Advance t only when the game advances (it holds during hit-stop if you pass the same t).',
    info: { duration: 8, bbox: { x: 0, y: 0, w: W, h: H } },
    draw: function (ctx, sx, sy, t, o) {
      if (t >= 8) return;
      var sf = soft(), counter = o.phase === 'counter', a0 = ctx.globalAlpha;
      var c = o.char ? burstCols(o.char, o.pal) : counter ? burstCols('', 0) : { line: '#ffffff', line2: '#fff6b8', ring: '#ffd84a' };
      if (t < 2) {
        ctx.globalAlpha = a0 * (t === 0 ? (sf ? 0.12 : 0.42) : (sf ? 0.1 : 0.3));
        ctx.fillStyle = t === 0 ? (counter ? '#ff3f6c' : '#ffffff') : '#05040a';
        ctx.fillRect(sx - 8, sy - 8, W + 16, H + 16); ctx.globalAlpha = a0;
      }
      var cx = sx + (o.cx == null ? W / 2 : Math.round(o.cx)), cy = sy + (o.cy == null ? H / 2 : Math.round(o.cy));
      var n = sf ? 14 : counter ? 30 : 24, k = t / 7;
      for (var i = 0; i < n; i++) {
        if (t > 4 && I.hash(i * 5 + t) < k * 0.8) continue;
        var h1 = I.hash(i * 7 + 3), a = (i + h1 * 0.7) * TAU / n, sp = 0.7 + I.hash(i * 11) * 0.6;
        var r0 = 30 + t * t * 5 * sp + h1 * 20, len = (70 + h1 * 80) * (1 - k * 0.5);
        ctx.fillStyle = i % 3 === 0 ? c.line : c.line2;
        radialRay(ctx, cx, cy, a, r0, r0 + len, t < 4 && i % 3 === 0 ? 2 : 1);
      }
    }
  });
})();
