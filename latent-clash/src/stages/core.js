/* LATENT CLASH — STAGE core: registry, LC.stages API, pixel painting helpers, parallax + floor.
 *
 * Stage files call LC.stages.define(id, def):
 *   def = { music, shadowColor,
 *           build(U)            -> assets   (static pre-render, once, cached)
 *           setup(st, A, U)     -> layers   ([{ name, front?, draw(ctx, camX, st) }], back to front)
 *           update(st, A, U), event(st, A, name, data, U) }
 * The layer list is what drawBack/drawFront walk; each layer has `on` (viewer toggles).
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var S = LC.stages = LC.stages || {};
  var W = LC.W, H = LC.H, B = LC.BLEED, GY = LC.GROUND_Y;
  var U = S.U = {};
  U.W = W; U.H = H; U.B = B; U.GY = GY;
  U.LW = W + 2 * B;                       // 400: width of a screen with bleed
  U.LH = H + 2 * B;                       // 232

  // ---------------------------------------------------------------- colours
  var colCache = {};
  U.col = function (hex) {               // '#rrggbb' -> packed uint32 (little-endian ABGR)
    var c = colCache[hex];
    if (c !== undefined) return c;
    var n = parseInt(hex.slice(1), 16);
    c = ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0;
    colCache[hex] = c;
    return c;
  };
  U.rgb = function (hex) { var n = parseInt(hex.slice(1), 16); return [n >>> 16, (n >> 8) & 255, n & 255]; };
  U.hex = function (r, g, b) {
    function h(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + h(r) + h(g) + h(b);
  };
  U.mix = function (a, b, t) {
    var A = U.rgb(a), Bc = U.rgb(b);
    return U.hex(A[0] + (Bc[0] - A[0]) * t, A[1] + (Bc[1] - A[1]) * t, A[2] + (Bc[2] - A[2]) * t);
  };
  U.css = function (hex, a) { var c = U.rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

  // ---------------------------------------------------------------- random
  U.rng = function (seed) {               // mulberry32 -> function returning [0,1)
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = function (x, y) {             // stable integer hash -> [0,1)
    var h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // 4x4 Bayer matrix, values 0..15. dith(x,y,level 0..16) -> true if pixel is "on".
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  U.BAYER = BAYER;
  U.dith = function (x, y, level) { return BAYER[((y & 3) << 2) | (x & 3)] < level; };

  // ---------------------------------------------------------------- canvas
  U.canvas = function (w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  };

  // Pixel buffer painter. All coordinates are integers; colours are packed (U.col); 0 = clear.
  function Pix(w, h) {
    this.w = w | 0; this.h = h | 0;
    this.cv = U.canvas(this.w, this.h);
    this.g = this.cv.getContext('2d');
    this.img = this.g.createImageData(this.w, this.h);
    this.d = new Uint32Array(this.img.data.buffer);
  }
  U.Pix = Pix;
  var P = Pix.prototype;
  P.set = function (x, y, c) {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  };
  P.get = function (x, y) {
    x |= 0; y |= 0;
    return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.d[y * this.w + x] : 0;
  };
  P.rect = function (x, y, w, h, c) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    var x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (var j = y0; j < y1; j++) { var o = j * this.w; for (var i = x0; i < x1; i++) this.d[o + i] = c; }
    return this;
  };
  // ordered-dither fill: pixel on where bayer < level (0..16); ox/oy shift the pattern phase.
  P.dither = function (x, y, w, h, c, level, ox, oy) {
    x |= 0; y |= 0; ox = ox | 0; oy = oy | 0;
    var x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (var j = y0; j < y1; j++) for (var i = x0; i < x1; i++) {
      if (BAYER[(((j + oy) & 3) << 2) | ((i + ox) & 3)] < level) this.d[j * this.w + i] = c;
    }
    return this;
  };
  // only paint where the buffer already has a pixel (mask = non-zero)
  P.ditherOn = function (x, y, w, h, c, level) {
    x |= 0; y |= 0;
    var x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (var j = y0; j < y1; j++) for (var i = x0; i < x1; i++) {
      var k = j * this.w + i;
      if (this.d[k] && BAYER[((j & 3) << 2) | (i & 3)] < level) this.d[k] = c;
    }
    return this;
  };
  P.hline = function (x, y, w, c) { return this.rect(x, y, w, 1, c); };
  P.vline = function (x, y, h, c) { return this.rect(x, y, 1, h, c); };
  P.line = function (x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return this;
  };
  // filled ellipse with centre (cx,cy) in pixel units (can be .5), radii rx, ry
  P.ellipse = function (cx, cy, rx, ry, c) {
    var y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (var y = y0; y <= y1; y++) {
      var dy = (y + 0.5 - cy) / ry;
      if (dy * dy > 1) continue;
      var hw = rx * Math.sqrt(1 - dy * dy);
      var xa = Math.round(cx - hw), xb = Math.round(cx + hw);
      if (xb > xa) this.rect(xa, y, xb - xa, 1, c);
    }
    return this;
  };
  // filled polygon (even-odd, pixel centres). pts = [x0,y0, x1,y1, ...]
  P.poly = function (pts, c) {
    var n = pts.length / 2, ymin = 1e9, ymax = -1e9, i;
    for (i = 0; i < n; i++) { ymin = Math.min(ymin, pts[i * 2 + 1]); ymax = Math.max(ymax, pts[i * 2 + 1]); }
    var xs = [];
    for (var y = Math.floor(ymin); y <= Math.ceil(ymax); y++) {
      var yc = y + 0.5; xs.length = 0;
      for (i = 0; i < n; i++) {
        var ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort(function (a, b) { return a - b; });
      for (i = 0; i + 1 < xs.length; i += 2) {
        var xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]);
        if (xb > xa) this.rect(xa, y, xb - xa, 1, c);
      }
    }
    return this;
  };
  // procedural fill: f(x, y, current) -> colour (0 keeps current)
  P.fn = function (x, y, w, h, f) {
    x |= 0; y |= 0;
    var x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (var j = y0; j < y1; j++) for (var i = x0; i < x1; i++) {
      var k = j * this.w + i, v = f(i, j, this.d[k]);
      if (v) this.d[k] = v;
    }
    return this;
  };
  // remap colours through a lookup {packed: packed} inside a rect, optionally masked by mf(x,y)
  P.remap = function (x, y, w, h, lut, mf) {
    x |= 0; y |= 0;
    var x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (var j = y0; j < y1; j++) for (var i = x0; i < x1; i++) {
      var k = j * this.w + i, v = lut[this.d[k]];
      if (v !== undefined && (!mf || mf(i, j))) this.d[k] = v;
    }
    return this;
  };
  P.clear = function (x, y, w, h) { return this.rect(x, y, w, h, 0); };
  // copy another Pix (non-zero pixels) at x,y; flip = mirror horizontally
  P.blit = function (src, x, y, flip) {
    for (var j = 0; j < src.h; j++) for (var i = 0; i < src.w; i++) {
      var v = src.d[j * src.w + (flip ? src.w - 1 - i : i)];
      if (v) this.set(x + i, y + j, v);
    }
    return this;
  };
  // 1-px outline around non-zero pixels (outside), colour c
  P.outline = function (c, diag) {
    var w = this.w, h = this.h, d = this.d, out = new Uint32Array(d);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (d[y * w + x]) continue;
      var hit = (x > 0 && d[y * w + x - 1]) || (x < w - 1 && d[y * w + x + 1]) || (y > 0 && d[(y - 1) * w + x]) || (y < h - 1 && d[(y + 1) * w + x]);
      if (!hit && diag) hit = (x > 0 && y > 0 && d[(y - 1) * w + x - 1]) || (x < w - 1 && y > 0 && d[(y - 1) * w + x + 1]) ||
        (x > 0 && y < h - 1 && d[(y + 1) * w + x - 1]) || (x < w - 1 && y < h - 1 && d[(y + 1) * w + x + 1]);
      if (hit) out[y * w + x] = c;
    }
    d.set(out);
    return this;
  };
  P.toCanvas = function () { this.g.putImageData(this.img, 0, 0); return this.cv; };
  U.pix = function (w, h) { return new Pix(w, h); };

  // vertical banded gradient: stops = [[y, '#hex'], ...] (absolute y in the buffer); between two
  // stops the colour switches with a short ordered-dither transition of `dw` px (classic 16-bit bands).
  P.bands = function (x, y0, w, y1, stops, dw) {
    dw = dw || 4;
    for (var y = y0; y < y1; y++) {
      var k = 0;
      while (k < stops.length - 1 && stops[k + 1][0] <= y) k++;
      var c = U.col(stops[k][1]);
      var nxt = stops[k + 1];
      if (nxt && nxt[0] - y <= dw) {
        var lvl = Math.round((1 - (nxt[0] - y) / (dw + 1)) * 16);
        var c2 = U.col(nxt[1]);
        for (var i = Math.max(0, x); i < Math.min(this.w, x + w); i++) {
          if (y >= 0 && y < this.h) this.d[y * this.w + i] = BAYER[((y & 3) << 2) | (i & 3)] < lvl ? c2 : c;
        }
      } else {
        this.rect(x, y, w, 1, c);
      }
    }
    return this;
  };

  // ---------------------------------------------------------------- text (baked Fusion Pixel)
  U.glyph = function (size, ch) {
    var G = S._glyphs && S._glyphs[size];
    if (!G) return null;
    var g = G.g[ch];
    if (!g) return null;
    if (!g.rows) g.rows = g[1].split('.').map(function (s) { return parseInt(s, 36); });
    return g;
  };
  U.textW = function (str, size, sp) {
    var w = 0; sp = sp || 0;
    for (var i = 0; i < str.length; i++) { var g = U.glyph(size, str[i]); w += (g ? g[0] : size) + sp; }
    return w - sp;
  };
  // draw text into a Pix: y = top of the line box. Returns width.
  U.text = function (px, str, x, y, size, c, sp) {
    var cx = x; sp = sp || 0;
    for (var i = 0; i < str.length; i++) {
      var g = U.glyph(size, str[i]);
      if (!g) { cx += size + sp; continue; }
      for (var r = 0; r < g.rows.length; r++) {
        var bits = g.rows[r], b = 0;
        while (bits) { if (bits & 1) px.set(cx + b, y + r, c); bits = Math.floor(bits / 2); b++; }
      }
      cx += g[0] + sp;
    }
    return cx - x - sp;
  };
  // tiny 3x5 digits / letters for rulers and labels (own design, crisp at 1x)
  var F3 = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001111', '-': '000000111000000', '.': '000000000000010',
    'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110',
    'E': '111100110100111', 'F': '111100110100100', 'G': '011100101101011', 'H': '101101111101101',
    'I': '111010010010111', 'K': '101101110101101', 'L': '100100100100111', 'M': '101111111101101',
    'N': '110101101101101', 'O': '010101101101010', 'P': '110101110100100', 'R': '110101110101101',
    'S': '011100010001110', 'T': '111010010010010', 'U': '101101101101111', 'V': '101101101101010',
    'W': '101101111111101', 'X': '101101010101101', 'Y': '101101010010010', ':': '000010000010000',
    '/': '001001010100100', '%': '101001010100101', ' ': '000000000000000', '>': '100010001010100',
    '<': '001010100010001', '#': '101111101111101', '+': '000010111010000', '=': '000111000111000'
  };
  U.text3 = function (px, str, x, y, c) {
    var cx = x;
    for (var i = 0; i < str.length; i++) {
      var g = F3[str[i]] || F3[' '];
      for (var k = 0; k < 15; k++) if (g[k] === '1') px.set(cx + (k % 3), y + ((k / 3) | 0), c);
      cx += 4;
    }
    return cx - x - 1;
  };
  U.text3W = function (str) { return str.length * 4 - 1; };

  // ---------------------------------------------------------------- parallax
  // A layer of factor f is drawn at x = -B - round(camX * f); its image needs width LW + 256 f.
  // wx(X, f) = layer-image x of world-anchored X at depth factor f (centre of view at X = camX+192).
  U.layerW = function (f) { return U.LW + Math.ceil((LC.STAGE_W - W) * f) + 1; };
  U.wx = function (X, f) { return Math.round(B + W / 2 + (X - W / 2) * f); };
  U.layer = function (ctx, cv, f, camX, y) {
    ctx.drawImage(cv, -B - Math.round(camX * f), y === undefined ? -B : y);
  };
  U.sx = function (X, f, camX) { return W / 2 + (X - camX - W / 2) * f; };   // screen x of world X at depth f

  // ---------------------------------------------------------------- perspective floor (line scroll)
  // Each screen row y in [y0, y1) shows the floor plane at depth scale s(y) = (y - yH)/(GY - yH):
  // a row image holds the world texture scaled by s; drawing shifts each row by (camX+192)*s.
  var FW = 1024, U0 = 200;
  U.FLOOR_U0 = U0;
  U.floorScale = function (yH, y) { return (y + 0.5 - yH) / (GY - yH); };
  // texel(X, y, s, rowIndex) -> packed colour (X = world x, may be outside 0..640)
  U.buildFloor = function (y0, y1, yH, texel, w) {
    w = w || FW;
    var px = new Pix(w, y1 - y0);
    for (var y = y0; y < y1; y++) {
      var s = U.floorScale(yH, y), o = (y - y0) * w;
      for (var u = 0; u < w; u++) px.d[o + u] = texel((u + 0.5 - U0) / s, y, s, y - y0);
    }
    return { cv: px.toCanvas(), pix: px, y0: y0, y1: y1, yH: yH };
  };
  U.drawFloor = function (ctx, fl, camX, cv) {
    cv = cv || fl.cv;
    var cx = camX + W / 2;
    for (var y = fl.y0; y < fl.y1; y++) {
      var s = U.floorScale(fl.yH, y);
      var sx = Math.round(U0 + cx * s - W / 2 - B);
      ctx.drawImage(cv, sx, y - fl.y0, U.LW, 1, -B, y, U.LW, 1);
    }
  };
  // screen x of a world point on the floor row y
  U.floorX = function (yH, X, y, camX) { return W / 2 + (X - camX - W / 2) * U.floorScale(yH, y); };

  // ---------------------------------------------------------------- sprite helpers
  // pre-render a list of frames from a painter fn(pix, i)
  U.frames = function (n, w, h, paint) {
    var out = [];
    for (var i = 0; i < n; i++) { var p = new Pix(w, h); paint(p, i, n); out.push(p.toCanvas()); }
    return out;
  };

  // ---------------------------------------------------------------- registry + API
  var defs = S._defs = S._defs || {};
  var built = {};
  var thumbs = {};
  S.define = function (id, def) { defs[id] = def; };

  function ensureBuilt(id) {
    if (built[id]) return built[id];
    var def = defs[id];
    var t0 = performance.now();
    try {
      built[id] = def.build(U) || {};
    } catch (e) {
      console.error('[stages] build failed for ' + id, e);
      built[id] = null;
      throw e;
    }
    built[id]._ms = performance.now() - t0;
    return built[id];
  }
  S.buildTime = function (id) { return built[id] ? built[id]._ms : 0; };

  function Stage(id) {
    var def = defs[id];
    this.id = id;
    this.def = def;
    this.A = ensureBuilt(id);
    this.t = 0;
    this.rnd = U.rng(0x5eed + id.length * 977);
    this.shadowColor = def.shadowColor || 'rgba(0,0,0,0.35)';
    this.music = def.music || ('stage.' + id);
    this.layers = def.setup(this, this.A, U) || [];
    for (var i = 0; i < this.layers.length; i++) if (this.layers[i].on === undefined) this.layers[i].on = true;
    this.thumb = thumbs[id] || null;
  }
  Stage.prototype.update = function () {
    this.t++;
    if (this.def.update) this.def.update(this, this.A, U);
  };
  Stage.prototype._draw = function (ctx, camX, front) {
    camX = Math.max(0, Math.min(LC.STAGE_W - W, +camX || 0));
    var L = this.layers;
    for (var i = 0; i < L.length; i++) {
      var l = L[i];
      if (!!l.front === front && l.on) l.draw(ctx, camX, this);
    }
  };
  Stage.prototype.drawBack = function (ctx, camX) { this._draw(ctx, camX, false); };
  Stage.prototype.drawFront = function (ctx, camX) { this._draw(ctx, camX, true); };
  Stage.prototype.event = function (name, data) {
    try {
      if (this.def.event) this.def.event(this, this.A, name, data || {}, U);
    } catch (e) { console.error('[stages] event ' + name, e); }
  };

  function makeThumb(id) {
    var st = new Stage(id);
    for (var i = 0; i < 90; i++) st.update();
    var big = U.canvas(W, H), g = big.getContext('2d');
    g.imageSmoothingEnabled = false;
    st.drawBack(g, 128); st.drawFront(g, 128);
    var d = g.getImageData(0, 0, W, H).data;
    var tw = 96, th = 54, t = U.canvas(tw, th), tg = t.getContext('2d');
    var out = tg.createImageData(tw, th);
    for (var y = 0; y < th; y++) for (var x = 0; x < tw; x++) {
      var r = 0, gg = 0, b = 0;
      for (var j = 0; j < 4; j++) for (var k = 0; k < 4; k++) {
        var o = ((y * 4 + j) * W + x * 4 + k) * 4;
        r += d[o]; gg += d[o + 1]; b += d[o + 2];
      }
      var q = (y * tw + x) * 4;
      // average, then snap to a 5-bit-per-channel grid to keep the thumb crisp and flat
      out.data[q] = ((r / 16) & 0xf8) | 4; out.data[q + 1] = ((gg / 16) & 0xf8) | 4; out.data[q + 2] = ((b / 16) & 0xf8) | 4; out.data[q + 3] = 255;
    }
    tg.putImageData(out, 0, 0);
    return t;
  }

  S.init = function () {
    var t0 = performance.now();
    var ids = S.ids();
    for (var i = 0; i < ids.length; i++) {
      try {
        ensureBuilt(ids[i]);
        thumbs[ids[i]] = makeThumb(ids[i]);
      } catch (e) { console.error('[stages] init ' + ids[i], e); }
    }
    S.initMs = performance.now() - t0;
  };
  S.ids = function () { return (LC.STAGES || []).filter(function (id) { return defs[id]; }); };
  S.list = function () { return S.ids().map(function (id) { return { id: id, music: (defs[id].music || 'stage.' + id) }; }); };
  S.create = function (id) {
    if (!defs[id]) {
      console.error('[stages] unknown stage ' + id + ', using ' + S.ids()[0]);
      id = S.ids()[0];
    }
    var st = new Stage(id);
    if (!st.thumb) { thumbs[id] = makeThumb(id); st.thumb = thumbs[id]; }
    return st;
  };
  S.thumb = function (id) { if (!thumbs[id] && defs[id]) thumbs[id] = makeThumb(id); return thumbs[id] || null; };
})();
