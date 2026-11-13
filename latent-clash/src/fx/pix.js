/* LATENT CLASH — FX pixel toolkit (owned by FX).
 * A tiny software rasteriser used at init() to bake every effect frame as true
 * pixel art: exact pixel-centre sampling, no anti-aliasing, deliberate shapes.
 * Everything here works on Buf (Uint32 ABGR pixels) and is converted to an
 * offscreen canvas once. Nothing in this file runs per game frame. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};

  // ---- colours --------------------------------------------------------------
  var cache = {};
  function hex2rgb(h) {
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  /** '#rrggbb' -> packed little-endian ABGR uint32 (ImageData order). */
  function col(h) {
    if (typeof h === 'number') return h;
    var c = cache[h];
    if (c !== undefined) return c;
    var v = hex2rgb(h);
    c = ((255 << 24) | (v[2] << 16) | (v[1] << 8) | v[0]) >>> 0;
    cache[h] = c;
    return c;
  }
  function toHex(r, g, b) {
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  /** Linear mix of two hex colours (for deriving in-between ramp tones). */
  function mix(a, b, t) {
    var x = hex2rgb(a), y = hex2rgb(b);
    return toHex(Math.round(x[0] + (y[0] - x[0]) * t), Math.round(x[1] + (y[1] - x[1]) * t),
      Math.round(x[2] + (y[2] - x[2]) * t));
  }
  /** A ramp keeps css strings (for fillRect particles) and uint32s (for baking). */
  function ramp(list) {
    var r = { css: list.slice(), u: [] };
    for (var i = 0; i < list.length; i++) r.u.push(col(list[i]));
    r.n = list.length;
    return r;
  }
  I.col = col; I.mix = mix; I.ramp = ramp; I.hex2rgb = hex2rgb;

  // 4x4 Bayer thresholds in [0,1)
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }
  I.bayer = bayer;

  // ---- Buf ------------------------------------------------------------------
  function Buf(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  var B = Buf.prototype;
  B.set = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  };
  B.get = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[y * this.w + x];
  };
  B.rect = function (x, y, w, h, c) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    var x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (var j = y0; j < y1; j++) for (var i = x0; i < x1; i++) this.d[j * this.w + i] = c;
  };
  /** Filled disc, pixel-centre sampled. (cx,cy) continuous; use .5 for odd sizes. */
  B.disc = function (cx, cy, r, c) {
    if (r <= 0) return;
    var r2 = r * r, y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r), x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r);
    for (var y = y0; y <= y1; y++) {
      var dy = y + 0.5 - cy;
      for (var x = x0; x <= x1; x++) {
        var dx = x + 0.5 - cx;
        if (dx * dx + dy * dy <= r2) this.set(x, y, c);
      }
    }
  };
  /** Annulus r0..r1, optionally restricted to an angle window [a0,a1] (radians). */
  B.ring = function (cx, cy, r0, r1, c, a0, a1, sx, sy) {
    sx = sx || 1; sy = sy || 1;
    var R = r1 + 1, y0 = Math.floor(cy - R * sy), y1 = Math.ceil(cy + R * sy), x0 = Math.floor(cx - R * sx), x1 = Math.ceil(cx + R * sx);
    var lo = r0 * r0, hi = r1 * r1, arc = a0 !== undefined;
    for (var y = y0; y <= y1; y++) {
      var dy = (y + 0.5 - cy) / sy;
      for (var x = x0; x <= x1; x++) {
        var dx = (x + 0.5 - cx) / sx, d = dx * dx + dy * dy;
        if (d < lo || d > hi) continue;
        if (arc && !inArc(Math.atan2(dy, dx), a0, a1)) continue;
        this.set(x, y, c);
      }
    }
  };
  function inArc(a, a0, a1) {
    var TAU = Math.PI * 2;
    var t = (a - a0) % TAU; if (t < 0) t += TAU;
    var span = (a1 - a0) % TAU; if (span < 0) span += TAU;
    if (a1 - a0 >= TAU) return true;
    return t <= span;
  }
  I.inArc = inArc;
  B.ellipse = function (cx, cy, rx, ry, c) {
    var y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry), x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    for (var y = y0; y <= y1; y++) {
      var dy = (y + 0.5 - cy) / ry;
      for (var x = x0; x <= x1; x++) {
        var dx = (x + 0.5 - cx) / rx;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  };
  /** Elliptical ring: thickness th measured in px along the minor axis approx. */
  B.ellRing = function (cx, cy, rx, ry, th, c, pred) {
    var y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1), x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
    var irx = Math.max(0.01, rx - th), iry = Math.max(0.01, ry - th);
    for (var y = y0; y <= y1; y++) {
      var py = y + 0.5 - cy;
      for (var x = x0; x <= x1; x++) {
        var px = x + 0.5 - cx;
        var o = (px * px) / (rx * rx) + (py * py) / (ry * ry);
        var i = (px * px) / (irx * irx) + (py * py) / (iry * iry);
        if (o <= 1 && i > 1 && (!pred || pred(px, py, x, y))) this.set(x, y, c);
      }
    }
  };
  /** Polygon fill (flat array [x0,y0,x1,y1,...]), scanline even-odd at pixel centres. */
  var xs = [];
  B.poly = function (p, c) {
    var n = p.length >> 1, ymin = 1e9, ymax = -1e9, i;
    for (i = 0; i < n; i++) { if (p[i * 2 + 1] < ymin) ymin = p[i * 2 + 1]; if (p[i * 2 + 1] > ymax) ymax = p[i * 2 + 1]; }
    var y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(this.h - 1, Math.ceil(ymax));
    for (var y = y0; y <= y1; y++) {
      var yc = y + 0.5;
      xs.length = 0;
      for (i = 0; i < n; i++) {
        var ax = p[i * 2], ay = p[i * 2 + 1], j = (i + 1) % n, bx = p[j * 2], by = p[j * 2 + 1];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) * (bx - ax) / (by - ay));
      }
      xs.sort(numSort);
      for (i = 0; i + 1 < xs.length; i += 2) {
        var xa = Math.max(0, Math.ceil(xs[i] - 0.5)), xb = Math.min(this.w - 1, Math.floor(xs[i + 1] - 0.5));
        for (var x = xa; x <= xb; x++) this.d[y * this.w + x] = c;
      }
    }
  };
  function numSort(a, b) { return a - b; }
  /** Tapered ray from radius r0 (half-width w0) to r1 (half-width w1) at angle a. */
  B.ray = function (cx, cy, a, r0, r1, w0, w1, c) {
    var dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    var ax = cx + dx * r0, ay = cy + dy * r0, bx = cx + dx * r1, by = cy + dy * r1;
    if (w1 <= 0.05) this.poly([ax + nx * w0, ay + ny * w0, bx, by, ax - nx * w0, ay - ny * w0], c);
    else this.poly([ax + nx * w0, ay + ny * w0, bx + nx * w1, by + ny * w1, bx - nx * w1, by - ny * w1, ax - nx * w0, ay - ny * w0], c);
  };
  /** Star polygon: rays given as arrays of angles & outer radii, inner radius ri. */
  B.star = function (cx, cy, angs, rads, ri, c) {
    var n = angs.length, pts = [];
    for (var i = 0; i < n; i++) {
      var a = angs[i], b = angs[(i + 1) % n];
      if (b < a) b += Math.PI * 2;
      pts.push(cx + Math.cos(a) * rads[i], cy + Math.sin(a) * rads[i]);
      var m = (a + b) / 2;
      pts.push(cx + Math.cos(m) * ri, cy + Math.sin(m) * ri);
    }
    this.poly(pts, c);
  };
  /** 4-point sparkle star: arms rx/ry, waist w. */
  B.star4 = function (cx, cy, rx, ry, w, c) {
    this.poly([cx + rx, cy, cx + w, cy + w, cx, cy + ry, cx - w, cy + w, cx - rx, cy, cx - w, cy - w, cx, cy - ry, cx + w, cy - w], c);
  };
  /** Bresenham line between integer pixel coords. */
  B.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  /** Thick stroke along a polyline [x,y,...] with per-point radius fn(i/n). */
  B.stroke = function (pts, radFn, c) {
    var n = pts.length >> 1;
    for (var i = 0; i < n - 1; i++) {
      var ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[i * 2 + 2], by = pts[i * 2 + 3];
      var L = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (var k = 0; k <= L; k++) {
        var t = k / L, u = (i + t) / (n - 1);
        var r = radFn(u);
        if (r > 0) this.disc(ax + (bx - ax) * t, ay + (by - ay) * t, r, c);
      }
    }
  };
  /** Add a 1-px outline around opaque pixels. diag: include diagonals. */
  B.outline = function (c, diag) {
    var w = this.w, h = this.h, s = this.d, o = new Uint32Array(s);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x;
      if (s[i]) continue;
      var hit = (x > 0 && s[i - 1]) || (x < w - 1 && s[i + 1]) || (y > 0 && s[i - w]) || (y < h - 1 && s[i + w]);
      if (!hit && diag) hit = (x > 0 && y > 0 && s[i - w - 1]) || (x < w - 1 && y > 0 && s[i - w + 1]) ||
        (x > 0 && y < h - 1 && s[i + w - 1]) || (x < w - 1 && y < h - 1 && s[i + w + 1]);
      if (hit) o[i] = c;
    }
    this.d = o;
    return this;
  };
  /** Recolour every opaque pixel whose colour === from (or any if from==null) to c. */
  B.recolor = function (from, c) {
    var d = this.d;
    for (var i = 0; i < d.length; i++) if (d[i] && (from == null || d[i] === from)) d[i] = c;
    return this;
  };
  /** Erase pixels where pred(x,y) is true. */
  B.erase = function (pred) {
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) if (this.d[y * this.w + x] && pred(x, y)) this.d[y * this.w + x] = 0;
    return this;
  };
  /** Ordered-dither breakup: keep pixel only if bayer < keep (0..1). Optional per-pixel keep fn. */
  B.breakup = function (keep, ox, oy) {
    ox = ox | 0; oy = oy | 0;
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var i = y * this.w + x;
      if (!this.d[i]) continue;
      var k = typeof keep === 'function' ? keep(x, y) : keep;
      if (bayer(x + ox, y + oy) >= k) this.d[i] = 0;
    }
    return this;
  };
  /** Remove isolated single pixels (no 4-neighbours) — cleans polygon noise. */
  B.clean = function () {
    var w = this.w, h = this.h, s = this.d, o = new Uint32Array(s);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x;
      if (!s[i]) continue;
      var n = (x > 0 && s[i - 1] ? 1 : 0) + (x < w - 1 && s[i + 1] ? 1 : 0) + (y > 0 && s[i - w] ? 1 : 0) + (y < h - 1 && s[i + w] ? 1 : 0);
      if (!n) o[i] = 0;
    }
    this.d = o;
    return this;
  };
  B.blit = function (src, dx, dy, flip) {
    dx = Math.round(dx); dy = Math.round(dy);
    for (var y = 0; y < src.h; y++) for (var x = 0; x < src.w; x++) {
      var c = src.d[y * src.w + (flip ? src.w - 1 - x : x)];
      if (c) this.set(dx + x, dy + y, c);
    }
    return this;
  };
  B.copy = function () { var b = new Buf(this.w, this.h); b.d.set(this.d); return b; };
  B.flipX = function () {
    var b = new Buf(this.w, this.h);
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) b.d[y * this.w + x] = this.d[y * this.w + this.w - 1 - x];
    return b;
  };
  /** Tight bounds of opaque pixels or null. */
  B.bounds = function () {
    var x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) if (this.d[y * this.w + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  /** EPX / Scale2x: doubles size while keeping pixel-art edges (for rotation). */
  B.scale2x = function () {
    var w = this.w, h = this.h, s = this.d, b = new Buf(w * 2, h * 2), o = b.d, W = w * 2;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var P = s[y * w + x];
      var A = y > 0 ? s[(y - 1) * w + x] : P, Bq = x < w - 1 ? s[y * w + x + 1] : P;
      var C = x > 0 ? s[y * w + x - 1] : P, D = y < h - 1 ? s[(y + 1) * w + x] : P;
      var e0 = P, e1 = P, e2 = P, e3 = P;
      if (C === A && C !== D && A !== Bq) e0 = A;
      if (A === Bq && A !== C && Bq !== D) e1 = Bq;
      if (D === C && D !== Bq && C !== A) e2 = C;
      if (Bq === D && Bq !== A && D !== C) e3 = D;
      var i = (y * 2) * W + x * 2;
      o[i] = e0; o[i + 1] = e1; o[i + W] = e2; o[i + W + 1] = e3;
    }
    return b;
  };
  /**
   * RotSprite-lite: scale2x twice, rotate by `a` (radians, clockwise on screen)
   * around pivot (px,py) with nearest sampling, back at 1x. Returns
   * { buf, px, py } where (px,py) is the pivot's position in the new buffer.
   * Pass an already-upscaled source via `up` to share the upscale work.
   */
  function rotate(src, a, px, py, up) {
    up = up || src.scale2x().scale2x();
    var cs = Math.cos(a), sn = Math.sin(a);
    // output size: rotate the four corners around the pivot
    var cx = [0, src.w, src.w, 0], cy = [0, 0, src.h, src.h], minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (var k = 0; k < 4; k++) {
      var dx = cx[k] - px, dy = cy[k] - py;
      var rx = dx * cs - dy * sn, ry = dx * sn + dy * cs;
      minx = Math.min(minx, rx); maxx = Math.max(maxx, rx); miny = Math.min(miny, ry); maxy = Math.max(maxy, ry);
    }
    var ox = Math.floor(minx) - 1, oy = Math.floor(miny) - 1;
    var W = Math.ceil(maxx) - ox + 2, H = Math.ceil(maxy) - oy + 2;
    var b = new Buf(W, H), o = b.d, us = up.d, UW = up.w, UH = up.h;
    for (var y = 0; y < H; y++) {
      var ry2 = y + 0.5 + oy;
      for (var x = 0; x < W; x++) {
        var rx2 = x + 0.5 + ox;
        // inverse rotation into source space (x4)
        var sx = (rx2 * cs + ry2 * sn + px) * 4, sy = (-rx2 * sn + ry2 * cs + py) * 4;
        var ix = Math.floor(sx), iy = Math.floor(sy);
        if (ix < 0 || iy < 0 || ix >= UW || iy >= UH) continue;
        o[y * W + x] = us[iy * UW + ix];
      }
    }
    return { buf: b, px: -ox, py: -oy };
  }
  I.rotate = rotate;

  /** Buf -> canvas */
  function toCanvas(buf) {
    var c = document.createElement('canvas');
    c.width = buf.w; c.height = buf.h;
    var g = c.getContext('2d');
    var id = g.createImageData(buf.w, buf.h);
    id.data.set(new Uint8ClampedArray(buf.d.buffer, buf.d.byteOffset, buf.d.byteLength));
    g.putImageData(id, 0, 0);
    return c;
  }
  I.toCanvas = toCanvas;
  I.Buf = Buf;

  /**
   * Bake a frame animation. fn(buf, frameIndex, n) draws one frame into a
   * fresh w*h Buf. Returns an anim def with a right-facing sheet (c) and a
   * per-frame mirrored sheet (m). (ox,oy) = origin inside a frame.
   */
  function anim(w, h, n, ox, oy, fn, fd) {
    var R = new Buf(w * n, h), M = new Buf(w * n, h);
    for (var f = 0; f < n; f++) {
      var b = new Buf(w, h);
      fn(b, f, n);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var c = b.d[y * w + x];
        if (!c) continue;
        R.d[y * R.w + f * w + x] = c;
        M.d[y * M.w + f * w + (w - 1 - x)] = c;
      }
    }
    return { c: toCanvas(R), m: toCanvas(M), w: w, h: h, n: n, ox: ox, oy: oy, fd: fd || 1 };
  }
  I.anim = anim;

  /** Draw frame f of anim A with its origin at screen (sx,sy). */
  I.drawAnim = function (ctx, A, f, sx, sy, facing) {
    if (f < 0 || f >= A.n) return;
    var ox = facing < 0 ? A.w - A.ox : A.ox;
    ctx.drawImage(facing < 0 ? A.m : A.c, f * A.w, 0, A.w, A.h, Math.round(sx - ox), Math.round(sy - A.oy), A.w, A.h);
  };

  /** Seeded PRNG used only while baking (keeps baked art identical every boot). */
  I.bakeRng = function (seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** Stateless hash -> [0,1) for drawSprite pseudo-randomness. */
  I.hash = function (n) {
    var t = (n | 0) * 0x9E3779B1;
    t = Math.imul(t ^ (t >>> 15), 0x85EBCA77);
    t = Math.imul(t ^ (t >>> 13), 0xC2B2AE3D);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
  I.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  I.lerp = function (a, b, t) { return a + (b - a) * t; };
  I.smooth = function (t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
})();
