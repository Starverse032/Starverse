/* LATENT CLASH — FX: screen.superBackdrop for char 'gemini' (owned by FX).
 * A deep cosmic sky: dithered violet night, a Milky-Way dust band, far star field; a blue -> violet
 * -> pink aurora (scrolling, pulsing) behind the Gemini constellation — two "twin" stick figures
 * of bright stars (Castor / Pollux heads) joined by glowing lines that draw themselves one segment
 * after another (t 2 .. ~30) and then twinkle; four-pointed stars drifting at three depths; a dark
 * starlit floor with aurora reflections. Intro (8f): a huge four-pointed-star iris opening from
 * her side; phase 'out' closes it. Other chars fall through to the previous definition.
 * Shares I.GEM.CONST (constellation geometry, screen coords for facing 1) with gemini-super.js. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var W = LC.W || 384, H = LC.H || 216, GY = LC.GROUND_Y || 186, PI = Math.PI, TAU = PI * 2;
  var BW = W + 16, BH = H + 16, FY = GY + 8, AW = 800;
  var G = I.GEM = I.GEM || [{}, {}];
  function mixc(a, b, t) { return I.col(I.mix(a, b, t)); }

  // ---- the constellation: two tilted stick figures holding hands (screen coords, facing 1) ----------
  function figure(hx, hy) {
    var ux = 0.4, uy = 0.92, nx = 0.92, ny = -0.4;
    function P(a, b) { return [Math.round(hx + ux * a + nx * b), Math.round(hy + uy * a + ny * b)]; }
    return { H: P(0, 0), C: P(18, 0), L: P(24, -27), R: P(22, 26), P: P(50, 1), F1: P(86, 14), F2: P(88, -12) };
  }
  var TA = figure(104, 10), TB = figure(176, 6);
  var V = [], E = [];
  [TA, TB].forEach(function (f, k) {
    var base = V.length;
    ['H', 'C', 'L', 'R', 'P', 'F1', 'F2'].forEach(function (n, i) { V.push({ x: f[n][0], y: f[n][1], head: i === 0, twin: k }); });
    [[0, 1], [1, 2], [1, 3], [1, 4], [4, 5], [4, 6]].forEach(function (e) { E.push([base + e[0], base + e[1]]); });
  });
  E.push([3, 9]);    // A's forward hand holds B's back hand
  E.push([0, 7]);    // Castor - Pollux
  // drawing order: A head-down, the link, then B; each segment starts DT after the previous one
  var ORDER = [0, 1, 2, 3, 12, 4, 5, 6, 13, 7, 8, 9, 10, 11];
  var DT = 2, SEG = 5, C0 = 2;
  var start = []; ORDER.forEach(function (ei, k) { start[ei] = C0 + k * DT; });
  E.forEach(function (e, i) { e.t0 = start[i] == null ? C0 : start[i]; });
  V.forEach(function (v, i) {         // a star appears when the first line touching it arrives
    var tt = 1e9; E.forEach(function (e) { if (e[0] === i) tt = Math.min(tt, e.t0); if (e[1] === i) tt = Math.min(tt, e.t0 + SEG); });
    v.t0 = tt;
  });
  var CONST = I.GEM.CONST = { V: V, E: E, SEG: SEG, done: C0 + ORDER.length * DT + SEG };

  function bake(pal) {
    var sc = I.scheme('gemini', pal), N = sc.night.css, Au = sc.aur.css, L = sc.light.css, S = sc.star.css, B = G[pal];
    var base = new I.Buf(BW, BH), d = base.d, x, y, i;
    // sky: darkest at the top, violet glow toward the horizon
    var sky = [I.col(N[4]), I.col(N[3]), I.col(N[2]), mixc(N[2], N[1], 0.5), I.col(N[1])];
    for (y = 0; y < FY; y++) {
      var v = Math.pow(y / FY, 1.5) * 4;
      for (x = 0; x < BW; x++) { var bi = Math.floor(v), fr = v - bi; d[y * BW + x] = sky[Math.min(4, bi + (I.bayer(x, y) < fr ? 1 : 0))]; }
    }
    // milky-way dust band: a dithered arc across the upper sky, two tones + bright knots
    var mw = [mixc(N[2], Au[1], 0.14), mixc(N[2], Au[2], 0.2), mixc(N[1], S[1], 0.3)];
    for (x = 0; x < BW; x++) {
      var cyb = 40 + Math.sin(x * 0.009 + 0.6) * 26, hw = 14 + Math.sin(x * 0.031) * 5 + Math.sin(x * 0.083 + 1) * 3;
      for (y = Math.max(0, Math.floor(cyb - hw)); y < cyb + hw; y++) {
        var k = 1 - Math.abs(y + 0.5 - cyb) / hw, n = 0.5 + 0.25 * Math.sin(x * 0.21 + y * 0.13) + 0.25 * Math.sin(x * 0.07 - y * 0.31);
        var dd = k * n;
        if (I.bayer(x, y) < dd * 0.6) d[y * BW + x] = dd > 0.6 ? mw[1] : mw[0];
        if (dd > 0.72 && I.hash(x * 7 + y * 131) > 0.86) d[y * BW + x] = mw[2];
      }
    }
    // far star field
    var rng = I.bakeRng(4242 + pal), starC = [I.col('#ffffff'), mixc(S[1], N[2], 0.25), mixc(S[2], N[2], 0.3), mixc(S[3], N[2], 0.35), mixc(L[2], N[2], 0.5)];
    for (i = 0; i < 190; i++) {
      x = Math.floor(rng() * BW); y = Math.floor(Math.pow(rng(), 1.3) * (FY - 20));
      var c = starC[i % 9 === 0 ? 0 : 1 + (i % 4)];
      if (y > 100 && i % 9 === 0) c = starC[1];       // keep the fighters' lane calm
      base.set(x, y, c);
    }
    // horizon haze
    var hz = mixc(N[1], Au[2], 0.25);
    for (y = FY - 22; y < FY; y++) for (x = 0; x < BW; x++) if (I.bayer(x, y) < (y - (FY - 22)) / 22 * 0.4) d[y * BW + x] = hz;
    // floor: dark starlit plane, horizon line, aurora reflections, reflected stars
    var fl = [I.col(N[3]), I.col(N[4]), mixc(N[2], Au[1], 0.3), mixc(N[2], Au[2], 0.3), I.col(L[2]), I.col(N[1])];
    for (y = FY; y < BH; y++) for (x = 0; x < BW; x++) d[y * BW + x] = I.bayer(x, y) < (y - FY) / (BH - FY) * 0.75 ? fl[1] : fl[0];
    var rr = I.bakeRng(77 + pal);
    for (i = 0; i < 26; i++) { var ry = FY + 3 + Math.floor(rr() * (BH - FY - 4)), rx = Math.floor(rr() * BW), rl = 6 + Math.floor(rr() * 30); base.rect(rx, ry, rl, 1, i % 2 ? fl[2] : fl[3]); }
    for (i = 0; i < 30; i++) base.set(Math.floor(rr() * BW), FY + 3 + Math.floor(rr() * (BH - FY - 4)), fl[5]);
    base.rect(0, FY, BW, 1, fl[4]); base.rect(0, FY + 1, BW, 1, fl[5]);
    B.bdBase = I.toCanvas(base);

    // aurora: tileable 800-px band, curtains of vertical streaks, blue top -> violet -> pink hem
    var ab = new I.Buf(AW, 110), ac = [mixc(Au[0], N[2], 0.3), mixc(Au[1], N[2], 0.28), mixc(Au[2], N[2], 0.3), mixc(Au[3], N[2], 0.35), mixc(Au[5], N[1], 0.15)];
    function s8(k, x0, ph) { return Math.sin(x0 * TAU * k / AW + ph); }
    for (x = 0; x < AW; x++) {
      var top = 18 + 9 * s8(2, x, 1) + 5 * s8(5, x, 0), len = 46 + 16 * s8(3, x, 2);
      var str = (0.5 + 0.4 * s8(4, x, 0) * s8(7, x, 0.5)) * (0.45 + 0.75 * I.hash(Math.floor(x / 2) * 13) * (0.6 + 0.4 * s8(23, x, 1)));
      for (y = Math.round(top); y < top + len && y < 110; y++) {
        var u = (y - top) / len, den = str * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 * 0.95);
        if (I.bayer(x, y) < den * 0.95) ab.set(x, y, u < 0.32 ? ac[0] : u < 0.62 ? ac[1] : ac[2]);
        if (u > 0.04 && u < 0.1 && str > 0.55) ab.set(x, y, ac[4]);
      }
    }
    B.aur = I.toCanvas(ab);
    B.bdCols = { line: [mixc(L[3], N[2], 0.35), L[1], '#ffffff'], edge: ['#ffffff', S[2], L[2]], tw: [S[1], S[2], S[3], '#ffffff'] };
  }
  I.onInit('gemini-backdrop', function () { bake(0); bake(1); });

  /** Constellation: segment progress at t, glow + core line, a bright head on drawing segments; stars. */
  function drawConst(ctx, sx, sy, t, pal, bright) {
    var C = G[pal].bdCols, k, e, a, b, u;
    for (k = 0; k < E.length; k++) {
      e = E[k]; u = (t - e.t0) / SEG; if (u <= 0) continue; if (u > 1) u = 1;
      a = V[e[0]]; b = V[e[1]];
      var x1 = a.x + (b.x - a.x) * u, y1 = a.y + (b.y - a.y) * u;
      ctx.fillStyle = C.line[0]; I.runLine(ctx, sx + a.x - 1, sy + a.y, sx + Math.round(x1) - 1, sy + Math.round(y1), 3);
      ctx.fillStyle = bright ? '#ffffff' : C.line[1]; I.runLine(ctx, sx + a.x, sy + a.y, sx + Math.round(x1), sy + Math.round(y1), 1);
      if (u < 1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + Math.round(x1) - 1, sy + Math.round(y1), 3, 1); ctx.fillRect(sx + Math.round(x1), sy + Math.round(y1) - 1, 1, 3); }
    }
    for (k = 0; k < V.length; k++) {
      var v = V[k], age = t - v.t0; if (age < 0) continue;
      var tw = (t + k * 7) % 40;
      if (v.head) { var f = Math.floor(t / 5 + k); I.drawAnim(ctx, G[pal].ps[3], ((f % 8) + 8) % 8, sx + v.x, sy + v.y, 1); }
      else I.gemPS(ctx, pal, age < 4 || tw < 4 ? 2 : 1, Math.floor(t / 6) + k, sx + v.x, sy + v.y);
      if (age < 4) { var r = 3 + age * 3; ctx.fillStyle = C.edge[1]; ctx.fillRect(sx + v.x - r, sy + v.y, r * 2 + 1, 1); ctx.fillRect(sx + v.x, sy + v.y - r, 1, r * 2 + 1); }
    }
  }
  I.gemConst = drawConst;

  function drawSky(ctx, sx, sy, t, o) {
    var B = G[o.pal], i, x, y, C = B.bdCols;
    ctx.drawImage(B.bdBase, sx - 8, sy - 8);
    // aurora (scrolling, pulsing)
    var off = Math.floor(t * 0.4) % AW, a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * (0.8 + 0.2 * Math.sin(t * 0.07));
    ctx.drawImage(B.aur, sx - 8 - off, sy - 4); ctx.drawImage(B.aur, sx - 8 - off + AW, sy - 4);
    ctx.globalAlpha = a0;
    // far twinkles
    for (i = 0; i < 18; i++) {
      var ph = (t + Math.floor(I.hash(i * 17 + 3) * 50)) % 50; if (ph > 8) continue;
      x = Math.floor(I.hash(i * 3 + 11) * W); y = Math.floor(I.hash(i * 7 + 5) * 110);
      var arm = ph < 4 ? (ph >> 1) : ((8 - ph) >> 1);
      ctx.fillStyle = C.tw[i & 3]; ctx.fillRect(sx + x - arm, sy + y, arm * 2 + 1, 1); ctx.fillRect(sx + x, sy + y - arm, 1, arm * 2 + 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + x, sy + y, 1, 1);
    }
    // mid layer: small sparkles drifting slowly
    for (i = 0; i < 14; i++) {
      var h1 = I.hash(i * 29 + 1), h2 = I.hash(i * 31 + 7);
      x = ((h1 * (W + 40) + t * (0.12 + h2 * 0.1)) % (W + 40)) - 20; y = 8 + h2 * 150 + Math.sin(t * 0.04 + i) * 3;
      I.gemPS(ctx, o.pal, i % 3 ? 0 : 1, Math.floor(t / 7) + i, sx + Math.round(x), sy + Math.round(y));
    }
    drawConst(ctx, sx, sy, t, o.pal, false);
    // near layer: bigger faceted stars, faster, bobbing
    for (i = 0; i < 5; i++) {
      var q1 = I.hash(i * 43 + 9), q2 = I.hash(i * 19 + 2);
      x = ((q1 * (W + 60) + t * (0.35 + q2 * 0.25)) % (W + 60)) - 30; y = 20 + q2 * 170 + Math.sin(t * 0.05 + i * 2) * 6;
      if (y > 96 && y < 180) y = y < 138 ? 96 - (138 - y) * 0.2 : 180 + (y - 138) * 0.1;   // stay out of the lane
      if (i < 2) I.drawAnim(ctx, B.ps[3], Math.floor(t / 4 + i * 3) % 8, sx + Math.round(x), sy + Math.round(y), 1);
      else I.gemPS(ctx, o.pal, 2, Math.floor(t / 5) + i, sx + Math.round(x), sy + Math.round(y));
    }
  }

  // ---- intro / outro: a four-pointed-star iris from her side ---------------------------------------
  var spans = new Int16Array(BH);
  function irisSpans(k, cx, cy) {
    var R = 560 * Math.pow(k, 1.7), p = 0.8;
    for (var r = 0; r < BH; r += 2) {
      var dy = Math.abs(r - 8 + 1 - cy), hw = 0;
      if (dy < R) hw = R * Math.pow(1 - Math.pow(dy / R, p), 1 / p);
      spans[r] = Math.round(hw);
    }
  }
  var prev = I.sprites['screen.superBackdrop'];
  I.defSprite('screen.superBackdrop', {
    desc: prev.desc + ' gemini: a deep cosmic sky — violet night, Milky-Way dust band, blue->violet->pink aurora, the Gemini constellation (two twin stick figures of stars holding hands, Castor/Pollux heads) drawing itself line by line over t 2..~35, four-pointed stars drifting at three depths, a dark starlit floor; intro = a four-pointed-star iris opening from her side, out = it closes.',
    use: prev.use,
    info: prev.info,
    draw: function (ctx, sx, sy, t, o) {
      if (o.char !== 'gemini') { prev.draw(ctx, sx, sy, t, o); return; }
      var out = o.phase === 'out', f = o.facing;
      if (out && t >= 8) return;
      var k = out ? 1 - (t + 1) / 9 : Math.min(1, (t + 1) / 8), tt = out ? 200 + t : t, clip = k < 1, r;
      var cx = f > 0 ? 56 : W - 56, cy = 118;
      if (clip) {
        irisSpans(k, cx, cy);
        ctx.save(); ctx.beginPath();
        for (r = 0; r < BH; r += 2) { var hw = spans[r]; if (hw > 0) ctx.rect(sx + cx - hw, sy - 8 + r, hw * 2 + 1, 2); }
        ctx.clip();
      }
      I.mirrored(ctx, sx + W / 2, f, function () { drawSky(ctx, sx, sy, tt, o); });
      if (!clip) return;
      ctx.restore();
      var Ed = G[o.pal].bdCols.edge;
      for (r = 0; r < BH; r += 2) {
        var h2 = spans[r]; if (h2 <= 0) continue;
        ctx.fillStyle = (r >> 1) & 1 ? Ed[1] : Ed[0];
        ctx.fillRect(sx + cx - h2 - 1, sy - 8 + r, 2, 2); ctx.fillRect(sx + cx + h2, sy - 8 + r, 2, 2);
        ctx.fillStyle = Ed[2]; ctx.fillRect(sx + cx - h2 - 3, sy - 8 + r, 2, 2); ctx.fillRect(sx + cx + h2 + 2, sy - 8 + r, 2, 2);
      }
    }
  });
})();
