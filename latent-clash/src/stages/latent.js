/* LATENT CLASH — STAGE 3: latent 潜空间 (final stage). Abstract neon vector space.
 *
 * Light logic: no sun — the void is lit by two distant nebulae (warm orange left = Claude's side,
 * deep blue right = DeepSeek's side) and a huge "attention" aurora band; the neon grid floor
 * glows violet and fades into a hazy horizon. Grid kept violet (not blue/orange) so neither
 * fighter sits on her own colour; cyan only for brief pulses.
 *
 * Layers: void+stars 0.02 · nebulae 0.05 · aurora 0.08 (additive, 12 frames) · horizon range 0.14
 * · constellations 0.22/0.34 · polyhedra 0.3–0.6 · tokens 0.5–0.75 · floor grid (line scroll to
 * the horizon, LOD) + pulses + ripples · front: drifting motes/tokens 1.3.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var YH = 112;                                           // horizon / vanishing line

  var C = {
    void: ['#07051a', '#0a0722', '#0d092a', '#110c33', '#16103c', '#1c1446', '#241a52'],
    star: '#b8b0e8', starDim: '#5a5290', starWarm: '#f0c8a0',
    nebW: ['#22102e', '#3c1a3a', '#5e2a40', '#8a4444', '#b86a50'],   // warm (Claude side)
    nebB: ['#0e1640', '#142254', '#1a2e6c', '#22408a', '#3458a8'],   // deep blue (DeepSeek side)
    aur: [0, '#080a1e', '#0a1a2a', '#0e2c36', '#18504c'],
    range: '#1a1240', rangeLine: '#3a2a78', rangeHi: '#5a44a8',
    haze: '#2a1c5c', hazeHi: '#4a3490', horizon: '#9a7ae8', horizonHi: '#e0d0ff',
    floor: '#0a0720', floorB: '#0d0928', grid: ['#2a1a5a', '#3c2680', '#5434a8', '#7048d0'], gridHi: '#b090ff',
    pulse: '#8af0ff', pulseDk: '#3aa0c8', ripple: '#c0a0ff',
    pt: ['#e8e0ff', '#8ae8ff', '#ffc890'], line: '#3a3478', lineHi: '#5a50a8',
    wire: ['#6ad8ff', '#d070ff', '#ffb070'], wireDk: ['#2a5888', '#5a2a88', '#7a4a3a'],
    tok: '#140f30', tokEdge: '#30286a', tokText: '#6e62b0', tokHi: '#a898e0'
  };

  function build(U) {
    var c = U.col, A = {}, rnd = U.rng(9001);
    var sy = function (y) { return y + 8; };

    // ------------------------------------------------------------ void + stars (0.02)
    var fV = A.fV = 0.02, vw = U.layerW(fV), vd = U.pix(vw, 130);
    vd.bands(0, 0, vw, 130, [[0, C.void[0]], [sy(20), C.void[1]], [sy(42), C.void[2]], [sy(62), C.void[3]], [sy(80), C.void[4]], [sy(96), C.void[5]], [sy(106), C.void[6]]], 4);
    for (var i = 0; i < 130; i++) {
      var x = (rnd() * vw) | 0, y = (rnd() * sy(104)) | 0, r = rnd();
      vd.set(x, y, c(r < 0.1 ? C.starWarm : r < 0.45 ? C.star : C.starDim));
      if (r < 0.04) { vd.set(x - 1, y, c(C.starDim)); vd.set(x + 1, y, c(C.starDim)); vd.set(x, y - 1, c(C.starDim)); vd.set(x, y + 1, c(C.starDim)); }
    }
    A.void = vd.toCanvas();
    A.twinkle = [];
    for (i = 0; i < 24; i++) A.twinkle.push({ x: rnd() * 420, y: 4 + rnd() * 96, ph: (rnd() * 200) | 0 });

    // ------------------------------------------------------------ nebulae (0.05): dithered noisy clouds
    var fN = A.fN = 0.05, nw = U.layerW(fN), neb = U.pix(nw, 130);
    // far layers barely move, so place things by where they appear on screen (at mid camera)
    var scr = function (x, f) { return Math.round(x + 8 + 128 * f); };
    nebula(U, neb, scr(58, fN), sy(50), 64, 26, C.nebW, 11);
    nebula(U, neb, scr(330, fN), sy(42), 66, 28, C.nebB, 23);
    A.neb = neb.toCanvas();

    // ------------------------------------------------------------ attention aurora (0.08, additive, 12 frames)
    var fA = A.fA = 0.08, aw = U.layerW(fA), ac = C.aur.map(function (h) { return h ? c(h) : 0; });
    A.aurora = U.frames(12, aw, 90, function (p, f) {
      var ph = f / 12 * Math.PI * 2;
      for (var x = 0; x < aw; x++) {
        var cy = 44 + Math.sin(x / 90 + ph) * 9 + Math.sin(x / 31 - ph) * 3;
        // attention weights (moving heads) × curtain folds
        var I = 0.35 + 0.65 * Math.max(0, Math.sin(x / 47 + ph)) * Math.max(0.2, Math.sin(x / 131 - ph * 0.5 + 1));
        var fold = 0.55 + 0.45 * Math.sin(x / 4.5 + Math.sin(x / 37 + ph) * 3);
        var a2 = I * fold, hgt = 6 + 26 * a2;
        for (var y = Math.round(cy - hgt); y < cy + 2; y++) {
          var k = (cy + 2 - y) / (hgt + 2);                    // 0 at the bright lower hem .. 1 at the top
          var lvl = k < 0.15 ? 4 : k < 0.4 ? 3 : k < 0.7 ? 2 : 1;
          lvl = Math.min(lvl, 1 + Math.round(a2 * 3));
          if (k > 0.7 && !U.dith(x, y, 8)) continue;
          p.set(x, y, ac[lvl]);
        }
      }
    });

    // ------------------------------------------------------------ horizon range (0.14): low wireframe ridges
    var fR = A.fR = 0.14, rw = U.layerW(fR), rg = U.pix(rw, 130);
    var ridge = [];
    for (x = 0; x <= rw; x += 12) ridge.push(sy(YH) - 4 - Math.round(rnd() * 14 * (0.4 + 0.6 * Math.abs(Math.sin(x / 90)))));
    for (x = 0; x < rw; x++) {
      var k = x / 12, i0 = Math.floor(k), t = k - i0, h = Math.round(ridge[i0] * (1 - t) + ridge[Math.min(ridge.length - 1, i0 + 1)] * t);
      rg.rect(x, h, 1, sy(YH) - h, c(C.range));
      rg.set(x, h, c(C.rangeLine));
    }
    for (i = 0; i < ridge.length - 1; i++) {                       // triangulated facets
      var xa = i * 12, xb = xa + 12, mid = xa + 6;
      rg.line(mid, sy(YH) - 1, xa, ridge[i], c(C.rangeLine));
      if (i % 3 === 0) rg.line(mid, sy(YH) - 1, xb, ridge[i + 1], c(C.rangeLine));
    }
    // horizon haze band + glowing line
    rg.dither(0, sy(YH) - 7, rw, 3, c(C.haze), 4); rg.dither(0, sy(YH) - 4, rw, 3, c(C.haze), 9);
    rg.rect(0, sy(YH) - 1, rw, 1, c(C.hazeHi)); rg.rect(0, sy(YH), rw, 1, c(C.horizon));
    A.range = rg.toCanvas();

    // ------------------------------------------------------------ constellations: clusters with progressive edges
    A.clusters = [];
    for (var q = 0; q < 7; q++) A.clusters.push(cluster(U, rnd, q));

    // ------------------------------------------------------------ wireframe polyhedra (48 rotation frames)
    A.poly = [polyFrames(U, 'ico', 34, 0), polyFrames(U, 'oct', 26, 1), polyFrames(U, 'cube', 22, 2), polyFrames(U, 'tet', 18, 0)];

    // ------------------------------------------------------------ token blocks
    var toks = ['the', 'ing', '<s>', '0.73', '思', '考', 'cat', '向量', '-1.2', '注意', 'R1', '星', '鲸', 'Q·K', '[CLS]', '0.05'];
    A.tokens = toks.map(function (tk, j) { return tokenSprite(U, tk, j); });

    // ------------------------------------------------------------ floor grid (line scroll to the horizon)
    A.floor = U.buildFloor(YH + 1, 224, YH, floorTexel(U), 1120);
    A.motes = U.frames(2, 3, 3, function (p, f) { p.set(1, 1, c(f ? C.tokHi : C.gridHi)); if (f) { p.set(0, 1, c(C.grid[1])); p.set(2, 1, c(C.grid[1])); } });
    return A;
  }

  function nebula(U, P, cx, cy, rx, ry, ramp, seed) {
    var c = U.col;
    P.fn(Math.round(cx - rx * 1.4), Math.round(cy - ry * 1.6), Math.round(rx * 2.8), Math.round(ry * 3.2), function (x, y, cur) {
      var dx = (x - cx) / rx, dy = (y - cy) / ry;
      var n = Math.sin(x / 9 + seed) * 0.18 + Math.sin(y / 6 + x / 15 + seed * 2) * 0.16 + Math.sin((x - y) / 11 + seed) * 0.12
        + (U.hash(x >> 1, y >> 1) - 0.5) * 0.1;
      var d = Math.sqrt(dx * dx + dy * dy * 1.2) + n;
      // filaments: brighter streaks along a tilted axis
      var fil = Math.abs(Math.sin((dx * 3 - dy * 2) + seed)) < 0.12 ? -0.18 : 0;
      d += fil;
      var lvl = d < 0.28 ? 4 : d < 0.48 ? 3 : d < 0.7 ? 2 : d < 0.95 ? 1 : d < 1.2 ? 0 : -1;
      if (lvl < 0) return 0;
      // dithered transition into the next ring
      var frac = d < 0.28 ? 0 : (d % 0.22) / 0.22;
      if (lvl > 0 && frac > 0.7 && U.dith(x, y, Math.round((frac - 0.7) / 0.3 * 10))) lvl--;
      if (lvl === 0 && !U.dith(x, y, 7)) return 0;
      return c(ramp[lvl]);
    });
  }

  function cluster(U, rnd, seed) {
    var c = U.col, n = 6 + ((rnd() * 4) | 0), w = 64, h = 40, pts = [], i, j;
    for (i = 0; i < n; i++) pts.push([4 + rnd() * (w - 8), 4 + rnd() * (h - 8), (rnd() * 3) | 0]);
    // minimum spanning tree (Prim) gives a readable constellation, plus one extra edge
    var inT = [true], edges = [];
    for (i = 1; i < n; i++) inT.push(false);
    for (var e = 0; e < n - 1; e++) {
      var best = null, bd = 1e9;
      for (i = 0; i < n; i++) if (inT[i]) for (j = 0; j < n; j++) if (!inT[j]) {
        var d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        if (d < bd) { bd = d; best = [i, j]; }
      }
      inT[best[1]] = true; edges.push(best);
    }
    edges.push([0, n - 1]);
    var frames = [];
    for (var k = 0; k <= edges.length; k++) {
      var p = U.pix(w, h);
      for (e = 0; e < k; e++) {
        var a = pts[edges[e][0]], b = pts[edges[e][1]], L = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
        for (var s = 0; s <= L; s += 2) p.set(Math.round(a[0] + (b[0] - a[0]) * s / L), Math.round(a[1] + (b[1] - a[1]) * s / L), c(e === k - 1 ? C.lineHi : C.line));
      }
      pts.forEach(function (q, qi) {
        var col = c(C.pt[q[2]]);
        p.set(Math.round(q[0]), Math.round(q[1]), col);
        if (qi % 3 === 0) { p.set(Math.round(q[0]) + 1, Math.round(q[1]), col); p.set(Math.round(q[0]), Math.round(q[1]) + 1, col); p.set(Math.round(q[0]) + 1, Math.round(q[1]) + 1, col); }
      });
      frames.push(p.toCanvas());
    }
    return { frames: frames, n: edges.length, X: 30 + rnd() * 580, y: 22 + rnd() * 70, f: rnd() < 0.5 ? 0.22 : 0.34, ph: (rnd() * 600) | 0, vx: (rnd() - 0.5) * 0.04 };
  }

  function polyFrames(U, kind, size, colIdx) {
    var c = U.col, V, E = [], g = (1 + Math.sqrt(5)) / 2, i, j;
    if (kind === 'ico') {
      V = [[-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]];
    } else if (kind === 'oct') {
      V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    } else if (kind === 'tet') {
      V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    } else {
      V = [];
      for (i = 0; i < 8; i++) V.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1]);
    }
    var md = 1e9;
    for (i = 0; i < V.length; i++) for (j = i + 1; j < V.length; j++) md = Math.min(md, Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]));
    for (i = 0; i < V.length; i++) for (j = i + 1; j < V.length; j++) if (Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]) < md * 1.01) E.push([i, j]);
    var rmax = 0; V.forEach(function (v) { rmax = Math.max(rmax, Math.hypot(v[0], v[1], v[2])); });
    var S = size + 3, half = S / 2, sc = (size / 2) / rmax;
    return U.frames(48, S, S, function (p, f) {
      var a = f / 48 * Math.PI * 2, tilt = 0.5;
      var P2 = V.map(function (v) {
        var x = v[0] * Math.cos(a) + v[2] * Math.sin(a), z = -v[0] * Math.sin(a) + v[2] * Math.cos(a), y = v[1];
        var y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
        return [half + x * sc, half + y2 * sc, z2];
      });
      // back edges first (dim, dotted), then front edges (bright)
      E.slice().sort(function (e1, e2) { return (P2[e1[0]][2] + P2[e1[1]][2]) - (P2[e2[0]][2] + P2[e2[1]][2]); }).forEach(function (e) {
        var A = P2[e[0]], B = P2[e[1]], back = A[2] + B[2] < 0;
        var L = Math.max(1, Math.round(Math.max(Math.abs(B[0] - A[0]), Math.abs(B[1] - A[1]))));
        for (var s = 0; s <= L; s++) {
          if (back && (s & 1)) continue;
          p.set(Math.round(A[0] + (B[0] - A[0]) * s / L), Math.round(A[1] + (B[1] - A[1]) * s / L), c(back ? C.wireDk[colIdx] : C.wire[colIdx]));
        }
      });
      P2.forEach(function (q) { if (q[2] >= 0) { p.set(Math.round(q[0]), Math.round(q[1]), c('#ffffff')); } });
    });
  }

  function tokenSprite(U, tk, j) {
    var c = U.col, cjk = /[一-鿿]/.test(tk);
    var tw = cjk ? U.textW(tk, 10) : U.text3W(tk.toUpperCase()), w = tw + 6, h = cjk ? 13 : 9;
    var p = U.pix(w, h);
    p.rect(1, 0, w - 2, h, c(C.tok)); p.rect(0, 1, w, h - 2, c(C.tok));
    p.rect(1, 0, w - 2, 1, c(C.tokEdge)); p.rect(0, 1, 1, h - 2, c(C.tokEdge)); p.rect(1, h - 1, w - 2, 1, c('#2a2058')); p.rect(w - 1, 1, 1, h - 2, c('#2a2058'));
    if (cjk) U.text(p, tk, 3, 1, 10, c(C.tokText)); else U.text3(p, tk.toUpperCase(), 3, 2, c(j % 4 === 0 ? C.tokHi : C.tokText));
    return p.toCanvas();
  }

  function floorTexel(U) {
    var c = U.col, base = c(C.floor), baseB = c(C.floorB), G = C.grid.map(c), hi = c(C.gridHi), haze = c(C.haze);
    var DZ = 0.5;
    return function (X, y, s) {
      var z = 1 / s;                                          // depth: 1 at the ground line, ∞ at horizon
      var near = Math.min(1, s / 1.2);                        // 0 far .. 1 near
      // X lines every 32 world px, with LOD so screen spacing never drops below ~5 px
      var step = 32;
      while (step * s < 5) step *= 2;
      var dx = Math.abs(X - Math.round(X / step) * step) * s;
      var onX = dx < 0.5;
      var major = onX && Math.round(X / step) * step % 128 === 0;
      // depth lines at z = 1 + n·DZ (the ground line is one of them)
      var zz = (z - 1) / DZ, dz = Math.abs(zz - Math.round(zz));
      var rowPx = DZ * (186 - YH) * s * s;                    // screen px between depth lines here
      var onZ = rowPx > 3.5 && dz * rowPx < 0.5;
      var lvl = near > 0.75 ? 2 : near > 0.4 ? 1 : 0;
      if ((onX || onZ) && y < YH + 12 && !U.dith(Math.round(X * s), y, (y - YH - 4) * 2)) return haze;
      if (onX || onZ) {
        if (major && near > 0.5) return G[3];
        return G[lvl + ((onX && onZ) ? 1 : 0)];
      }
      if (y < YH + 4) return haze;
      if (y < YH + 12 && U.dith(Math.round(X * s) + 1, y, Math.round((YH + 12 - y) * 2))) return haze;
      // subtle checker of the cells near the viewer
      var cell = (Math.floor(X / 32) + Math.floor(zz)) & 1;
      return cell && near > 0.6 ? baseB : base;
    };
  }

  // ================================================================== instance
  function setup(st, A, U) {
    var rnd = st.rnd, i;
    st.polys = [
      { k: 0, X: 120, y: 44, f: 0.42, sp: 1, ph: 0 }, { k: 1, X: 470, y: 30, f: 0.5, sp: -1, ph: 20 },
      { k: 2, X: 300, y: 70, f: 0.32, sp: 1, ph: 33 }, { k: 3, X: 600, y: 82, f: 0.58, sp: 2, ph: 7 }, { k: 1, X: -20, y: 86, f: 0.36, sp: -2, ph: 15 }
    ];
    st.toks = [];
    for (i = 0; i < 7; i++) st.toks.push({ k: (i * 5 + 2) % A.tokens.length, X: i * 92 + rnd() * 40, y: 30 + rnd() * 64, f: 0.5 + rnd() * 0.25, v: 0.03 + rnd() * 0.05, ph: rnd() * 6 });
    st.pulses = [];
    for (i = 0; i < 7; i++) st.pulses.push({ X: Math.round((rnd() * 22 - 1)) * 32, z: 1 + rnd() * 12, v: 0.02 + rnd() * 0.03 });
    st.ripples = [];
    st.fmotes = [];
    for (i = 0; i < 10; i++) st.fmotes.push({ X: rnd() * 640, y: 120 + rnd() * 90, v: 0.05 + rnd() * 0.1, k: i & 1 });
    st.flare = [0, 0];

    var L = [];
    L.push({ name: 'void', draw: function (g, cam, s) {
      U.layer(g, A.void, A.fV, cam);
      g.fillStyle = C.star;
      for (var i = 0; i < A.twinkle.length; i++) {
        var tw = A.twinkle[i], ph = (s.t + tw.ph) % 200;
        if (ph < 20) { var x = Math.round(tw.x - cam * 0.02) - 8, y = Math.round(tw.y); g.fillRect(x, y, 1, 1); if (ph > 6 && ph < 14) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } }
      }
    } });
    L.push({ name: 'nebulae', draw: function (g, cam, s) {
      U.layer(g, A.neb, A.fN, cam);
      for (var sd = 0; sd < 2; sd++) if (s.flare[sd] > 0 && (s.flare[sd] & 2)) {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = sd ? '#0a1430' : '#30140a';
        g.fillRect(sd ? 192 : -8, -8, 208, YH + 8);
        g.globalCompositeOperation = 'source-over';
      }
    } });
    L.push({ name: 'aurora', draw: function (g, cam, s) {
      g.globalCompositeOperation = 'lighter';
      g.drawImage(A.aurora[((s.t / 14) | 0) % 12], -8 - Math.round(cam * A.fA), -2);
      g.globalCompositeOperation = 'source-over';
    } });
    L.push({ name: 'range', draw: function (g, cam) { U.layer(g, A.range, A.fR, cam); } });
    L.push({ name: 'constellations', draw: function (g, cam, s) {
      for (var i = 0; i < A.clusters.length; i++) {
        var cl = A.clusters[i], per = cl.n * 2 * 50 + 160, ph = (s.t + cl.ph) % per;
        var k = ph < cl.n * 50 ? Math.floor(ph / 50) + 1 : ph < cl.n * 50 + 160 ? cl.n : Math.max(0, cl.n - Math.floor((ph - cl.n * 50 - 160) / 50) - 1);
        var x = Math.round(U.sx(cl.X + s.t * cl.vx, cl.f, cam)) - 32, y = Math.round(cl.y + Math.sin((s.t + cl.ph) / 180) * 3);
        g.drawImage(cl.frames[Math.min(cl.n, k)], x, y);
      }
    } });
    L.push({ name: 'polyhedra', draw: function (g, cam, s) {
      for (var i = 0; i < s.polys.length; i++) {
        var p = s.polys[i], fr = A.poly[p.k], im = fr[(((s.t * Math.abs(p.sp) / 5) | 0) * Math.sign(p.sp) + p.ph + 4800) % 48];
        g.drawImage(im, Math.round(U.sx(p.X, p.f, cam) - im.width / 2), Math.round(p.y + Math.sin((s.t + p.ph * 9) / 110) * 4 - im.height / 2));
      }
    } });
    L.push({ name: 'tokens', draw: function (g, cam, s) {
      for (var i = 0; i < s.toks.length; i++) {
        var t = s.toks[i], im = A.tokens[t.k];
        g.drawImage(im, Math.round(((U.sx(t.X, t.f, cam) + 40) % 480 + 480) % 480 - 40), Math.round(t.y + Math.sin(s.t / 90 + t.ph) * 2));
      }
    } });
    L.push({ name: 'floor', draw: function (g, cam, s) {
      U.drawFloor(g, A.floor, cam);
      // pulses travelling toward the viewer along the depth lines
      for (var i = 0; i < s.pulses.length; i++) {
        var p = s.pulses[i];
        var sc = 1 / p.z, y = Math.round(YH + sc * (186 - YH) - 0.5);
        if (y <= YH + 1 || y > 223) continue;
        var x = Math.round(U.floorX(YH, p.X, y, cam)), len = Math.max(1, Math.round(sc * 4));
        g.fillStyle = C.pulseDk; g.fillRect(x, y - len, 1, len);
        g.fillStyle = C.pulse; g.fillRect(x, y, 1, Math.max(1, len >> 1));
      }
      // hit ripples: rings on the floor plane
      for (i = 0; i < s.ripples.length; i++) {
        var r = s.ripples[i], rad = r.age * 1.6;
        g.fillStyle = r.age < 18 ? C.ripple : C.grid[3];
        for (var a = 0; a < 48; a++) {
          var an = a / 48 * Math.PI * 2, X = r.X + Math.cos(an) * rad, z = 1 + Math.sin(an) * rad / 110;
          if (z <= 0.6) continue;
          var yy = Math.round(YH + (186 - YH) / z - 0.5);
          if (yy <= YH + 1 || yy > 223) continue;
          if ((a + r.age) % 3 === 0 && r.age > 30) continue;
          g.fillRect(Math.round(U.floorX(YH, X, yy, cam)), yy, 1, 1);
        }
      }
    } });
    L.push({ name: 'motes', front: true, draw: function (g, cam, s) {
      for (var i = 0; i < s.fmotes.length; i++) {
        var m = s.fmotes[i];
        var x = Math.round(((U.sx(m.X, 1.3, cam) + 40) % 480 + 480) % 480 - 40);
        if (((s.t + i * 31) % 240) < 200) g.drawImage(A.motes[m.k], x, Math.round(m.y));
      }
    } });
    return L;
  }

  function update(st, A, U) {
    var i, rnd = st.rnd;
    for (i = 0; i < st.toks.length; i++) { var t = st.toks[i]; t.X += t.v; if (t.X > 700) t.X = -60; }
    for (i = 0; i < st.pulses.length; i++) {
      var p = st.pulses[i];
      p.z -= p.v * p.z * 0.6;                                   // constant-ish screen speed
      if (p.z < 0.7) { p.z = 8 + rnd() * 8; p.X = Math.round(rnd() * 22 - 1) * 32; }
    }
    for (i = st.ripples.length - 1; i >= 0; i--) { if (++st.ripples[i].age > 70) st.ripples.splice(i, 1); }
    for (i = 0; i < st.fmotes.length; i++) { var m = st.fmotes[i]; m.y -= m.v; if (m.y < 110) { m.y = 214; m.X = rnd() * 640; } }
    if (st.flare[0] > 0) st.flare[0]--;
    if (st.flare[1] > 0) st.flare[1]--;
  }

  function event(st, A, name, data) {
    if (name === 'hit') {
      if (st.ripples.length < 6) st.ripples.push({ X: data.x || 320, age: 0 });
    } else if (name === 'super') {
      st.flare[data.side ? 1 : 0] = 48;
      for (var i = 0; i < st.pulses.length; i++) st.pulses[i].z = 6 + i;
    } else if (name === 'ko') {
      st.ripples.push({ X: data.x || 320, age: 0 }); st.ripples.push({ X: data.x || 320, age: -14 });
      st.flare[0] = st.flare[1] = 40;
    } else if (name === 'roundStart') {
      for (var j = 0; j < st.pulses.length; j++) st.pulses[j].z = 10 + j * 0.3;
    }
  }

  LC.stages.define('latent', { music: 'stage.latent', shadowColor: 'rgba(6,2,24,0.6)', build: build, setup: setup, update: update, event: event });
})();
