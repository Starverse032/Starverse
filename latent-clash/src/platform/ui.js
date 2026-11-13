/* LATENT CLASH — LC.ui: pixel UI kit (PLATFORM).
 * Everything draws with fillRect / drawImage at integer coordinates (no AA). Panels, cursors,
 * bars, Bresenham lines, discs, transitions, the animated "latent space" backdrop, menus,
 * typewriter, toasts, button-hint footers, guarded audio helpers. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H;

  var ui = LC.ui = {};

  // ---------------------------------------------------------------- maths / easing
  ui.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  ui.lerp = function (a, b, t) { return a + (b - a) * t; };
  ui.ease = {
    out: function (t) { t = ui.clamp(t, 0, 1); return 1 - (1 - t) * (1 - t) * (1 - t); },
    in: function (t) { t = ui.clamp(t, 0, 1); return t * t * t; },
    inOut: function (t) { t = ui.clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    back: function (t) { t = ui.clamp(t, 0, 1); var c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    elastic: function (t) { t = ui.clamp(t, 0, 1); return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * 2.0944) + 1; }
  };
  ui.blink = function (t, period, duty) { period = period || 40; return (t % period) < period * (duty || 0.6); };

  // ---------------------------------------------------------------- colours
  ui.hex = function (c) { var n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  ui.mix = function (a, b, t) {
    var A = ui.hex(a), B = ui.hex(b), r = function (i) { return Math.round(A[i] + (B[i] - A[i]) * t); };
    return '#' + ((1 << 24) | (r(0) << 16) | (r(1) << 8) | r(2)).toString(16).slice(1);
  };
  ui.charCol = function (ch, pal) {
    var p = (LC.PAL[ch] || LC.PAL.claude)[pal || 0] || LC.PAL[ch][0];
    return { ui: p.ui, light: p.uiLight, dark: p.uiDark, accent: p.accent[1], hair: p.hair[1] };
  };

  // ---------------------------------------------------------------- primitives
  ui.box = function (c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); };
  ui.line = function (c, x0, y0, x1, y1, col, dash) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    c.fillStyle = col;
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, n = 0;
    for (;;) {
      if (!dash || ((n >> 1) % dash) === 0) c.fillRect(x0, y0, 1, 1);
      n++;
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  ui.disc = function (c, cx, cy, r, col) {
    c.fillStyle = col; cx |= 0; cy |= 0;
    for (var y = -r; y <= r; y++) { var hw = Math.floor(Math.sqrt(r * r - y * y) + 0.35); c.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); }
  };
  ui.ring = function (c, cx, cy, r, col) {
    c.fillStyle = col; cx |= 0; cy |= 0;
    var x = r, y = 0, err = 1 - r;
    while (x >= y) {
      c.fillRect(cx + x, cy + y, 1, 1); c.fillRect(cx - x, cy + y, 1, 1); c.fillRect(cx + x, cy - y, 1, 1); c.fillRect(cx - x, cy - y, 1, 1);
      c.fillRect(cx + y, cy + x, 1, 1); c.fillRect(cx - y, cy + x, 1, 1); c.fillRect(cx + y, cy - x, 1, 1); c.fillRect(cx - y, cy - x, 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  };
  // Right-pointing (dir 1) / left-pointing (dir -1) pixel triangle, h rows tall (odd).
  ui.tri = function (c, x, y, h, dir, col) {
    c.fillStyle = col; var half = h >> 1;
    for (var i = 0; i <= half; i++) {
      var len = half - i + 1;
      if (dir > 0) { c.fillRect(x + i, y + i, 1, h - i * 2); } else { c.fillRect(x - i, y + i, 1, h - i * 2); }
      if (len <= 0) break;
    }
  };
  ui.triV = function (c, x, y, w, dir, col) {   // up (dir -1) / down (1) pointing, w wide (odd)
    c.fillStyle = col; var half = w >> 1;
    for (var i = 0; i <= half; i++) c.fillRect(x + i, dir > 0 ? y + i : y - i, w - i * 2, 1);
  };

  // Panel: dark translucent body, 1px outline, cut corners, inner highlight, optional accent stripe.
  ui.panel = function (c, x, y, w, h, o) {
    o = o || {};
    x |= 0; y |= 0; w |= 0; h |= 0;
    var fill = o.fill || 'rgba(21,19,42,0.88)', edge = o.edge || U.line, dark = o.dark || U.black;
    c.fillStyle = dark;
    c.fillRect(x + 2, y, w - 4, 1); c.fillRect(x + 2, y + h - 1, w - 4, 1);
    c.fillRect(x, y + 2, 1, h - 4); c.fillRect(x + w - 1, y + 2, 1, h - 4);
    c.fillRect(x + 1, y + 1, 1, 1); c.fillRect(x + w - 2, y + 1, 1, 1); c.fillRect(x + 1, y + h - 2, 1, 1); c.fillRect(x + w - 2, y + h - 2, 1, 1);
    c.fillStyle = fill; c.fillRect(x + 2, y + 1, w - 4, h - 2); c.fillRect(x + 1, y + 2, 1, h - 4); c.fillRect(x + w - 2, y + 2, 1, h - 4);
    c.fillStyle = edge;
    c.fillRect(x + 2, y + 1, w - 4, 1); c.fillRect(x + 1, y + 2, 1, h - 4);
    c.fillStyle = o.shadowEdge || U.bg2;
    c.fillRect(x + 2, y + h - 2, w - 4, 1); c.fillRect(x + w - 2, y + 2, 1, h - 4);
    if (o.accent) {
      c.fillStyle = o.accent;
      c.fillRect(x + 2, y + 1, Math.min(w - 4, o.accentW || 18), 2);
      c.fillRect(x + w - 2 - Math.min(w - 4, 6), y + h - 3, Math.min(w - 4, 6), 1);
    }
  };

  // Chunky animated selection cursor ">" with bounce.
  ui.cursor = function (c, x, y, t, col, dir) {
    var dx = Math.round(Math.sin(t * 0.22) * 1.5 + 1.5) * (dir || 1);
    ui.tri(c, x + dx + 1, y + 1, 7, dir || 1, U.black);
    ui.tri(c, x + dx, y, 7, dir || 1, col || U.gold);
  };

  // Horizontal bar: segmented pips (n = max) or continuous (seg = 0).
  ui.bar = function (c, x, y, w, h, v, max, col, o) {
    o = o || {};
    ui.box(c, x - 1, y - 1, w + 2, h + 2, U.black);
    ui.box(c, x, y, w, h, o.back || U.bg2);
    if (o.seg) {
      var n = max, sw = Math.floor((w - (n - 1)) / n);
      for (var i = 0; i < n; i++) {
        var on = i < v;
        ui.box(c, x + i * (sw + 1), y, sw, h, on ? col : (o.off || '#2b2750'));
        if (on) ui.box(c, x + i * (sw + 1), y, sw, 1, o.hi || ui.mix(col, '#ffffff', 0.45));
      }
    } else {
      var fw = Math.round(w * ui.clamp(v / max, 0, 1));
      ui.box(c, x, y, fw, h, col);
      ui.box(c, x, y, fw, 1, o.hi || ui.mix(col, '#ffffff', 0.45));
    }
  };

  // ---------------------------------------------------------------- text shortcuts
  ui.text = function (c, s, x, y, o) { return LC.font.draw(c, s, x, y, o); };
  ui.label = function (c, s, x, y, size, col, align, outline) {
    return LC.font.draw(c, s, x, y, { size: size || 12, color: col || U.text, align: align || 'left', outline: outline === undefined ? null : outline, shadow: outline === undefined ? U.black : null });
  };

  // ---------------------------------------------------------------- canvases
  var flipCache = new WeakMap(), silCache = new WeakMap();
  ui.canvas = function (w, h) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; var x = cv.getContext('2d'); x.imageSmoothingEnabled = false; return cv; };
  ui.flip = function (src) {
    if (!src) return src;
    var f = flipCache.get(src);
    if (f) return f;
    f = ui.canvas(src.width, src.height);
    var c = f.getContext('2d'); c.translate(src.width, 0); c.scale(-1, 1); c.drawImage(src, 0, 0);
    flipCache.set(src, f);
    return f;
  };
  ui.silhouette = function (src, col) {
    var m = silCache.get(src); if (!m) { m = {}; silCache.set(src, m); }
    if (m[col]) return m[col];
    var s = ui.canvas(src.width, src.height), c = s.getContext('2d');
    c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = col; c.fillRect(0, 0, s.width, s.height);
    m[col] = s;
    return s;
  };

  // ---------------------------------------------------------------- audio (guarded)
  var warnedAudio = {};
  ui.sfx = function (name, opts) {
    var a = LC.audio;
    if (!a || !a.sfx || LC.app && LC.app.muted) return;
    try { a.sfx(name, opts); } catch (e) { if (!warnedAudio[name]) { warnedAudio[name] = 1; console.error('[platform] audio.sfx', name, e); } }
  };
  var curTrack;
  ui.music = function (track, opts) {
    var a = LC.audio;
    if (track === curTrack && !(opts && opts.restart)) return;
    curTrack = track;
    if (!a || !a.music) return;
    try { a.music(track, opts || { fade: 0.6 }); } catch (e) { console.error('[platform] audio.music', track, e); }
  };
  ui.musicTrack = function () { return curTrack; };
  ui.forgetMusic = function () { curTrack = undefined; };

  // ---------------------------------------------------------------- illust helpers (feature-detected)
  // True when a canvas has no visible pixel (modules may return blank placeholders).
  var blankCache = new WeakMap();
  ui.isBlank = function (cv) {
    if (!cv || !cv.width || !cv.height) return true;
    var b = blankCache.get(cv);
    if (b !== undefined) return b;
    b = true;
    try {
      var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (var i = 3; i < d.length; i += 4) if (d[i]) { b = false; break; }
    } catch (e) { b = false; }
    blankCache.set(cv, b);
    return b;
  };
  var icCache = {};
  ui.icon = function (name) {
    if (icCache[name] !== undefined) return icCache[name];
    var cv = null;
    try { if (LC.illust && LC.illust.icon) cv = LC.illust.icon(name) || null; } catch (e) { cv = null; }
    if (cv && ui.isBlank(cv)) cv = null;
    if (LC.debug && LC.debug.ready && LC.scenes && LC.scenes.name() !== 'boot') icCache[name] = cv;
    return cv;
  };
  ui.clearIconCache = function () { icCache = {}; };
  var BTN_COL = { L: U.green, M: U.gold, H: '#ff6b7f', S: U.meter };
  ui.btnColor = function (b) { return BTN_COL[b] || U.dim; };
  // Button glyph: illust icon when available, else a pixel disc with the letter.
  ui.btnGlyph = function (c, b, x, y) {
    var ic = ui.icon('btn.' + b);
    if (ic) { c.drawImage(ic, x | 0, y | 0); return ic.width; }
    ui.disc(c, x + 5, y + 6, 5, U.black);
    ui.disc(c, x + 5, y + 5, 5, BTN_COL[b] || U.dim);
    ui.disc(c, x + 5, y + 6, 4, ui.mix(BTN_COL[b] || U.dim, '#000000', 0.25));
    LC.font.draw(c, b, x + 6, y + 2, { size: 8, color: '#15132a', align: 'center' });
    return 11;
  };
  var ARROWS = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '●', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
  ui.dirGlyph = function (c, d, x, y, col) {
    var ic = ui.icon('dir.' + d);
    if (ic) { c.drawImage(ic, x | 0, y | 0); return ic.width; }
    LC.font.draw(c, ARROWS[d] || '?', x, y, { size: 12, color: col || U.text });
    return 12;
  };
  // Draw a notation string like "236+L", "j.236", "H+S", "5S" as icons. Returns width.
  ui.notation = function (c, s, x, y, o) {
    o = o || {};
    var cx = x, str = String(s);
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (/[1-9]/.test(ch)) cx += ui.dirGlyph(c, +ch, cx, y, o.color) + 1;
      else if (/[LMHS]/.test(ch) && (i === str.length - 1 || /[+\s/]/.test(str[i + 1]))) cx += ui.btnGlyph(c, ch, cx, y) + 1;
      else if (ch === 'X') { cx += ui.btnGlyph(c, 'L', cx, y) + 1; LC.font.draw(c, '/', cx, y + 2, { size: 8, color: U.dim }); cx += 5; cx += ui.btnGlyph(c, 'M', cx, y) + 1; LC.font.draw(c, '/', cx, y + 2, { size: 8, color: U.dim }); cx += 5; cx += ui.btnGlyph(c, 'H', cx, y) + 1; }
      else cx += LC.font.draw(c, ch === 'j' ? '空中' : ch, cx, y + (ch === 'j' ? 0 : 2), { size: ch === 'j' ? 10 : 8, color: o.dim || U.dim }) + 1;
    }
    return cx - x;
  };

  // Footer with button hints: items = [['L', '确认'], ['M', '返回'], ...]
  ui.hints = function (c, items, o) {
    o = o || {};
    var y = o.y == null ? H - 14 : o.y;
    var widths = items.map(function (it) { return 13 + LC.font.measure(it[1], { size: 10 }).w + 10; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0);
    var x = o.align === 'left' ? (o.x || 6) : o.align === 'right' ? W - 6 - total : ((W - total) >> 1);
    items.forEach(function (it, i) {
      if (it[0].length === 1) ui.btnGlyph(c, it[0], x, y);
      else LC.font.draw(c, it[0], x, y + 1, { size: 10, color: U.gold, shadow: U.black });
      var lx = x + (it[0].length === 1 ? 13 : LC.font.measure(it[0], { size: 10 }).w + 3);
      LC.font.draw(c, it[1], lx, y + 1, { size: 10, color: o.color || U.dim, shadow: U.black });
      x += widths[i] + (it[0].length === 1 ? 0 : LC.font.measure(it[0], { size: 10 }).w - 10);
    });
  };

  // Scene header band: Chinese title + small English tag + moving accent.
  ui.header = function (c, zh, en, t, accent) {
    accent = accent || U.gold;
    ui.box(c, 0, 0, W, 19, 'rgba(5,4,10,0.82)');
    ui.box(c, 0, 19, W, 1, U.line);
    ui.box(c, 0, 20, W, 1, 'rgba(5,4,10,0.5)');
    var sx = (t * 2) % (W + 60) - 60;
    ui.box(c, sx | 0, 19, 40, 1, accent);
    ui.box(c, 6, 4, 3, 11, accent);
    ui.box(c, 10, 4, 1, 11, ui.mix(accent, '#000000', 0.4));
    LC.font.draw(c, zh, 15, 4, { size: 12, color: U.text, shadow: U.black });
    if (en) LC.font.draw(c, en, W - 7, 6, { size: 8, color: U.dim, align: 'right', spacing: 1 });
  };

  // ---------------------------------------------------------------- transitions
  // p: 0 = clear, 1 = fully covered.
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  ui.transition = function (c, kind, p, col) {
    if (p <= 0) return;
    col = col || U.black;
    c.fillStyle = col;
    if (p >= 1) { c.fillRect(0, 0, W, H); return; }
    var x, y;
    if (kind === 'dissolve') {
      var lvl = p * 16, B = 3;
      for (y = 0; y < H; y += B) for (x = 0; x < W; x += B) {
        if (BAYER[((y / B) & 3) * 4 + ((x / B) & 3)] < lvl) c.fillRect(x, y, B, B);
      }
    } else if (kind === 'iris') {
      var R = Math.sqrt(W * W + H * H) / 2 + 2, r = R * (1 - p), cx = W >> 1, cy = H >> 1;
      for (y = 0; y < H; y += 2) {
        var dy = y + 1 - cy, hw = r * r - dy * dy;
        if (hw <= 0) { c.fillRect(0, y, W, 2); continue; }
        hw = Math.floor(Math.sqrt(hw) / 2) * 2;
        c.fillRect(0, y, cx - hw, 2); c.fillRect(cx + hw, y, W - cx - hw, 2);
      }
    } else if (kind === 'slash') {
      var span = W + H * 0.6 + 24, edge = p * span;
      for (y = 0; y < H; y += 2) {
        var ex = edge - (H - y) * 0.6;
        if (ex > 0) c.fillRect(0, y, Math.min(W, ex | 0), 2);
      }
    } else {   // 'wipe': diamond blocks sweeping diagonally (default)
      var S = 12, cols = Math.ceil(W / S), rows = Math.ceil(H / S), tot = cols + rows;
      for (var by = 0; by < rows; by++) for (var bx = 0; bx < cols; bx++) {
        var q = ui.clamp(p * (tot + 6) - (bx + by), 0, 6) / 6;
        if (q <= 0) continue;
        var sz = Math.ceil(q * S);
        if (sz >= S) { c.fillRect(bx * S, by * S, S, S); continue; }
        // diamond-ish: centered square
        var o = (S - sz) >> 1;
        c.fillRect(bx * S + o, by * S + o, sz, sz);
      }
    }
  };

  // ---------------------------------------------------------------- backdrop ("latent space")
  var bdBase = null, nodes = null, toks = null;
  var TOK = ['0', '1', 'λ', 'Σ', 'π', '∞', '◆', '·', '+', 'Q', 'K', 'V', '词', '元', '潜', '◇', '01', '10', '∂', 'θ'];
  function rnd(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function buildBase() {
    bdBase = ui.canvas(W, H);
    var c = bdBase.getContext('2d');
    // stepped vertical gradient with ordered-dither transitions
    var stops = ['#07060d', '#0b0a14', '#100e1f', '#15132a', '#121026', '#0d0b1a', '#09080f'];
    var band = H / (stops.length - 1);
    for (var y = 0; y < H; y++) {
      var f = y / band, i = Math.min(stops.length - 2, Math.floor(f)), t = f - i;
      for (var x = 0; x < W; x += 1) {
        var th = BAYER[(y & 3) * 4 + (x & 3)] / 16;
        c.fillStyle = t > th ? stops[i + 1] : stops[i];
        c.fillRect(x, y, 1, 1);
      }
    }
    var r = rnd(7);
    // faint star dust
    for (var k = 0; k < 90; k++) { c.fillStyle = r() < 0.2 ? '#2b2758' : '#1c1a38'; c.fillRect((r() * W) | 0, (r() * 120) | 0, 1, 1); }
    nodes = [];
    for (k = 0; k < 16; k++) nodes.push({ x: r() * W, y: 14 + r() * 100, vx: (r() - 0.5) * 0.12, vy: (r() - 0.5) * 0.06, ph: r() * 6.28 });
    toks = [];
    for (k = 0; k < 26; k++) toks.push({ x: r() * W, y: r() * H, z: 0.3 + r() * 0.7, s: TOK[(r() * TOK.length) | 0], ph: r() * 100 });
  }
  ui.backdrop = function (c, t, o) {
    o = o || {};
    if (!bdBase) buildBase();
    c.drawImage(bdBase, 0, 0);
    var accent = o.accent || '#5a5499';
    var hz = o.horizon || 132, vx = W >> 1;
    // perspective floor grid
    var gcol = o.grid || '#1f1c40';
    for (var i = -12; i <= 12; i++) {
      ui.line(c, vx + i * 6, hz, vx + i * 46, H + 2, gcol);
    }
    var speed = o.speed == null ? 0.35 : o.speed;
    var ph = (t * speed * 0.02) % 1;
    for (var k = 0; k < 9; k++) {
      var z = (k + 1 - ph) / 9;              // 0..1 near the horizon -> bottom
      var yy = hz + Math.round(Math.pow(z, 2.2) * (H - hz + 6));
      if (yy <= hz) continue;
      c.fillStyle = z > 0.55 ? '#2a2652' : gcol;
      c.fillRect(0, yy, W, 1);
    }
    c.fillStyle = ui.mix(accent, '#0b0a14', 0.45); c.fillRect(0, hz, W, 1);
    c.fillStyle = ui.mix(accent, '#0b0a14', 0.75); c.fillRect(0, hz - 1, W, 1); c.fillRect(0, hz + 1, W, 1);
    // drifting tokens
    for (i = 0; i < toks.length; i++) {
      var tk = toks[i];
      var x = (tk.x + t * 0.08 * tk.z) % (W + 20) - 10, y = (tk.y - t * 0.05 * tk.z + H * 4) % H;
      if (y > hz - 4 && y < hz + 4) continue;
      var tw = (Math.sin((t + tk.ph * 7) * 0.03) + 1) / 2;
      var col = tk.z > 0.8 && tw > 0.85 ? ui.mix(accent, '#ffffff', 0.2) : tk.z > 0.6 ? '#3b3670' : '#262249';
      LC.font.draw(c, tk.s, x | 0, y | 0, { size: 8, color: col });
    }
    // embedding constellation
    var pts = nodes.map(function (n) {
      return { x: ((n.x + n.vx * t) % W + W) % W, y: n.y + Math.sin(t * 0.01 + n.ph) * 6, ph: n.ph };
    });
    for (i = 0; i < pts.length; i++) for (k = i + 1; k < pts.length; k++) {
      var dx = pts[i].x - pts[k].x, dy = pts[i].y - pts[k].y;
      if (dx * dx + dy * dy < 62 * 62) ui.line(c, pts[i].x, pts[i].y, pts[k].x, pts[k].y, '#1d1a3a', 2);
    }
    for (i = 0; i < pts.length; i++) {
      var on = (Math.sin(t * 0.04 + pts[i].ph * 3) + 1) / 2;
      c.fillStyle = on > 0.9 ? ui.mix(accent, '#ffffff', 0.3) : on > 0.5 ? '#4a4488' : '#332e63';
      c.fillRect(pts[i].x | 0, pts[i].y | 0, on > 0.9 ? 2 : 1, on > 0.9 ? 2 : 1);
    }
  };

  // ---------------------------------------------------------------- menu widget
  // items: [{ label, en?, desc?, value?: fn -> string, disabled?, id }]
  ui.Menu = function (items, o) {
    this.items = items; this.o = o || {};
    this.i = this.o.index || 0;
    this.t = 0; this.hy = null; this.flash = 0; this.shake = 0;
    while (this.items[this.i] && this.items[this.i].disabled) this.i++;
  };
  ui.Menu.prototype.rect = function (k) {
    var o = this.o, h = o.itemH || 18;
    return { x: o.x || 0, y: (o.y || 0) + k * h, w: o.w || 160, h: h };
  };
  ui.Menu.prototype.move = function (d) {
    var n = this.items.length, j = this.i;
    for (var k = 0; k < n; k++) { j = (j + d + n) % n; if (!this.items[j].disabled) break; }
    if (j !== this.i) { this.i = j; ui.sfx('ui.move'); if (this.o.onMove) this.o.onMove(j); }
  };
  // Returns { type: 'ok'|'cancel'|'left'|'right', index, item } or null.
  ui.Menu.prototype.update = function (m, ptr) {
    this.t++;
    if (this.flash > 0) this.flash--;
    if (this.shake > 0) this.shake--;
    m = m || LC.input.menu;
    var it = this.items[this.i];
    if (m.up) this.move(-1);
    else if (m.down) this.move(1);
    else if (m.left && it && it.adjust) { it.adjust(-1); ui.sfx('ui.move'); return { type: 'left', index: this.i, item: it }; }
    else if (m.right && it && it.adjust) { it.adjust(1); ui.sfx('ui.move'); return { type: 'right', index: this.i, item: it }; }
    ptr = ptr === undefined ? LC.input.pointer : ptr;
    if (ptr && (ptr.pressed || (ptr.moved && ptr.type === 'mouse'))) {
      for (var k = 0; k < this.items.length; k++) {
        var r = this.rect(k);
        if (ptr.x >= r.x && ptr.x < r.x + r.w && ptr.y >= r.y && ptr.y < r.y + r.h && !this.items[k].disabled) {
          if (k !== this.i) { this.i = k; ui.sfx('ui.move'); if (this.o.onMove) this.o.onMove(k); }
          if (ptr.pressed) {
            var item = this.items[k];
            if (item.adjust) {   // tap left/right half to adjust
              item.adjust(ptr.x < r.x + r.w * 0.5 ? -1 : 1); ui.sfx('ui.move');
              return { type: 'right', index: k, item: item };
            }
            return this.confirm();
          }
        }
      }
    }
    if (m.ok) return this.confirm();
    if (m.cancel) { ui.sfx('ui.cancel'); return { type: 'cancel', index: this.i }; }
    return null;
  };
  ui.Menu.prototype.confirm = function () {
    var it = this.items[this.i];
    if (!it || it.disabled) { ui.sfx('ui.error'); this.shake = 10; return null; }
    if (it.adjust && !it.action) { it.adjust(1); ui.sfx('ui.move'); return { type: 'right', index: this.i, item: it }; }
    this.flash = 14;
    ui.sfx(this.o.confirmSfx || 'ui.confirm');
    return { type: 'ok', index: this.i, item: it };
  };
  ui.Menu.prototype.draw = function (c, t, o2) {
    var o = this.o, h = o.itemH || 18, x = o.x || 0, y0 = o.y || 0, w = o.w || 160;
    var size = o.size || 12, accent = o.accent || U.gold, appear = o.appear == null ? 999 : o.appear;
    var ty = y0 + this.i * h;
    this.hy = this.hy == null ? ty : this.hy + (ty - this.hy) * 0.35;
    var hy = Math.round(this.hy);
    // highlight bar
    var sh = this.shake ? ((this.shake & 2) ? 2 : -2) : 0;
    var hx = x + sh;
    var hw = w;
    ui.box(c, hx, hy + 1, hw, h - 2, 'rgba(255,255,255,0.06)');
    ui.box(c, hx, hy + 1, 2, h - 2, accent);
    ui.box(c, hx + 2, hy + h - 2, hw - 2, 1, ui.mix(accent, '#000000', 0.55));
    if (this.flash && (this.flash & 2)) ui.box(c, hx, hy + 1, hw, h - 2, 'rgba(255,255,255,0.18)');
    for (var k = 0; k < this.items.length; k++) {
      var it = this.items[k], sel = k === this.i;
      var a = ui.ease.out((appear - k * 3) / 14);
      if (a <= 0) continue;
      var ix = x + 10 + Math.round((1 - a) * 30) + (sel ? 3 : 0) + (sel ? sh : 0);
      var iy = y0 + k * h + ((h - size) >> 1);
      var col = it.disabled ? '#4f4a78' : sel ? U.text : U.dim;
      LC.font.draw(c, it.label, ix, iy, { size: size, color: col, shadow: U.black, alpha: a });
      if (it.en && o.showEn !== false) LC.font.draw(c, it.en, ix + LC.font.measure(it.label, { size: size }).w + 6, iy + size - 8, { size: 8, color: sel ? accent : '#4f4a78', alpha: a });
      if (it.value) {
        var v = it.value();
        var vx = x + w - 8;
        if (sel && it.adjust) {
          var vw = LC.font.measure(v, { size: 10 }).w;
          var bob = (t >> 4) & 1;
          ui.tri(c, vx - vw - 9 - bob, iy + 1, 9, -1, accent);
          ui.tri(c, vx + 3 + bob, iy + 1, 9, 1, accent);
        }
        LC.font.draw(c, v, vx, iy + (size - 10 > 0 ? 1 : 0), { size: 10, color: sel ? U.gold : U.dim, align: 'right', shadow: U.black, alpha: a });
      }
    }
    if (o.cursor !== false) ui.cursor(c, x - 9 + sh, hy + ((h - 7) >> 1), t, accent);
  };

  // ---------------------------------------------------------------- typewriter
  ui.Typewriter = function (text, o) {
    this.o = o || {}; this.text = text; this.n = 0; this.t = 0;
    this.total = LC.font.length(text);
    this.speed = this.o.speed || 0.5;   // chars per tick
  };
  ui.Typewriter.prototype.update = function () {
    if (this.n >= this.total) return;
    var before = Math.floor(this.n);
    this.n = Math.min(this.total, this.n + this.speed);
    var now = Math.floor(this.n);
    if (now > before && now % 2 === 1) ui.sfx('text.blip', { vol: 0.5, pitch: this.o.pitch || 1 });
  };
  ui.Typewriter.prototype.done = function () { return this.n >= this.total; };
  ui.Typewriter.prototype.skip = function () { this.n = this.total; };
  ui.Typewriter.prototype.draw = function (c, x, y, o) {
    var opts = Object.assign({}, this.o.font || {}, o || {});
    opts.reveal = Math.floor(this.n);
    LC.font.draw(c, this.text, x, y, opts);
  };

  // ---------------------------------------------------------------- toasts
  var toasts = [];
  ui.toast = function (text, kind) { toasts.push({ text: text, kind: kind, t: 0 }); if (toasts.length > 3) toasts.shift(); };
  ui.drawToasts = function (c) {
    var y = 24;
    for (var i = 0; i < toasts.length; i++) {
      var tt = toasts[i]; tt.t++;
      var a = tt.t < 10 ? tt.t / 10 : tt.t > 140 ? 1 - (tt.t - 140) / 20 : 1;
      var m = LC.font.measure(tt.text, { size: 10 });
      var w = m.w + 16, x = (W - w) >> 1, yy = y - Math.round((1 - ui.ease.out(Math.min(1, tt.t / 10))) * 10);
      c.globalAlpha = Math.max(0, a);
      ui.panel(c, x, yy, w, 16, { accent: U.gold, accentW: 8 });
      LC.font.draw(c, tt.text, x + 8, yy + 3, { size: 10, color: U.text });
      c.globalAlpha = 1;
      y += 18;
    }
    toasts = toasts.filter(function (q) { return q.t < 160; });
  };
})();
