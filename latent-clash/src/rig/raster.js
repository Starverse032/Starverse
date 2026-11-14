/* LATENT CLASH — RIG raster: palette-indexed pixel primitives.
 *
 * Everything a puppet draws goes into a Uint8Array of colour *indices*
 * (material × tone), never RGBA, so cel shading, outlines, flash and
 * silhouettes are cheap table look-ups and nothing is ever anti-aliased.
 *
 *   index 0 = empty, 1 = outline, 2 + mat*4 + tone = material colour
 *   tone 0 highlight · 1 base · 2 shade · 3 deep        (LC.PAL ramp order)
 *
 * Drawing happens in *groups*: primitives are rasterised into a scratch
 * buffer, then composited onto the main buffer with a 1-px 4-neighbour
 * outline (exterior = palette outline colour, interior = the front part's
 * deep tone, or the outline colour when what lies behind is darker).
 * Local coordinates: origin = character origin, +x forward, +y down.
 * Integer coordinates name pixels; primitives sample at pixel centres.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};

  var BW = 320, BH = 256, OX = 160, OY = 204;      // buffer size and origin (V2: fits 104-px fighters + smears)
  I.BW = BW; I.BH = BH; I.OX = OX; I.OY = OY;

  var MAT = I.MAT = {
    skin: 0, hair: 1, tip: 2, eye: 3, c1: 4, c2: 5, acc: 6, metal: 7,
    blush: 8, legs: 9, shoe: 10, ink: 11, glow: 12, smear: 13, white: 14
  };
  var NMAT = 15;
  I.NCOL = 2 + NMAT * 4;
  function col(m, t) { return 2 + m * 4 + t; }
  I.col = col;
  I.OUT = 1;

  // light from the upper front (facing right)
  var LX = 0.62, LY = -0.78;

  // shading presets: d = dark band width, l = light band width (px from the edge)
  var SH = I.SH = {
    flat: null,
    limb: { d: 1.15, l: 0 },
    limbL: { d: 1.15, l: 0.9 },
    thick: { d: 1.6, l: 0.9 },
    body: { d: 2.1, l: 1.0 },
    hair: { d: 1.9, l: 0 },
    soft: { d: 1.0, l: 0 }
  };

  // ------------------------------------------------------------------ painter
  function Painter() {
    this.m = new Uint8Array(BW * BH);
    this.s = new Uint8Array(BW * BH);
    this.tmp = new Int32Array(BW * BH);
    this.lum = new Float32Array(256);
    this.deep = new Uint8Array(256);
    this.clear();
  }
  var P = Painter.prototype;

  P.clear = function () {
    // clear only what was used last time
    if (this.mx1 > this.mx0) {
      for (var y = this.my0; y < this.my1; y++) this.m.fill(0, y * BW + this.mx0, y * BW + this.mx1);
    }
    this.mx0 = BW; this.my0 = BH; this.mx1 = 0; this.my1 = 0;
    this.sx0 = BW; this.sy0 = BH; this.sx1 = 0; this.sy1 = 0;
  };

  P.setLum = function (lum) {   // lum: Float32Array per colour index (palette dependent)
    this.lum = lum;
  };

  // grow scratch bbox; coordinates are buffer coordinates
  P._grow = function (x0, y0, x1, y1) {
    if (x0 < this.sx0) this.sx0 = x0; if (y0 < this.sy0) this.sy0 = y0;
    if (x1 > this.sx1) this.sx1 = x1; if (y1 > this.sy1) this.sy1 = y1;
  };

  function clampX(x) { return x < 1 ? 1 : (x > BW - 1 ? BW - 1 : x); }
  function clampY(y) { return y < 1 ? 1 : (y > BH - 1 ? BH - 1 : y); }

  // raw pixel into scratch (local coords)
  P.px = function (x, y, c) {
    x = (x | 0) + OX; y = (y | 0) + OY;
    if (x < 1 || y < 1 || x >= BW - 1 || y >= BH - 1) return;
    this.s[y * BW + x] = c;
    this._grow(x, y, x + 1, y + 1);
  };
  // pixel only where the scratch already has something (detail decals)
  P.pxOn = function (x, y, c) {
    x = (x | 0) + OX; y = (y | 0) + OY;
    if (x < 1 || y < 1 || x >= BW - 1 || y >= BH - 1) return;
    var i = y * BW + x;
    if (this.s[i]) this.s[i] = c;
  };
  P.peek = function (x, y) {
    x = (x | 0) + OX; y = (y | 0) + OY;
    if (x < 0 || y < 0 || x >= BW || y >= BH) return 0;
    return this.s[y * BW + x];
  };
  // darken an existing scratch pixel by one tone (cast shadow / crease)
  P.darken = function (x, y, steps) {
    x = (x | 0) + OX; y = (y | 0) + OY;
    if (x < 1 || y < 1 || x >= BW - 1 || y >= BH - 1) return;
    var i = y * BW + x, c = this.s[i];
    if (c < 2) return;
    var t = (c - 2) & 3, b = c - t, nt = t + (steps || 1);
    this.s[i] = b + (nt > 3 ? 3 : nt);
  };

  // 1-px line (Bresenham), optional mode: 0 always, 1 only on filled scratch
  P.line = function (x0, y0, x1, y1, c, onlyOn) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var n = 0; n < 400; n++) {
      if (onlyOn) this.pxOn(x0, y0, c); else this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  P.darkLine = function (x0, y0, x1, y1, steps) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var n = 0; n < 400; n++) {
      this.darken(x0, y0, steps);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  function toneFor(ox, oy, d, edge, sh, base) {
    if (!sh) return base;
    if (d > 1e-6) {
      var s = (ox * LX + oy * LY) / d;
      if (sh.d && s < -0.18 && edge < sh.d) return base + 1 > 3 ? 3 : base + 1;
      if (sh.l && s > 0.5 && edge < sh.l && base > 0) return base - 1;
    }
    return base;
  }

  // tapered capsule a→b, radii ra→rb. mat = material id, sh = shading preset,
  // tone = base tone (default 1). Coordinates may be fractional.
  P.cap = function (ax, ay, bx, by, ra, rb, mat, sh, tone) {
    var base = tone == null ? 1 : tone;
    ax += 0.5; ay += 0.5; bx += 0.5; by += 0.5;
    var r = ra > rb ? ra : rb;
    var x0 = clampX(Math.floor(Math.min(ax, bx) - r) + OX), x1 = clampX(Math.ceil(Math.max(ax, bx) + r) + OX + 1);
    var y0 = clampY(Math.floor(Math.min(ay, by) - r) + OY), y1 = clampY(Math.ceil(Math.max(ay, by) + r) + OY + 1);
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, s = this.s, c0 = 2 + mat * 4, hit = false;
    for (var y = y0; y < y1; y++) {
      var py = y - OY + 0.5;
      for (var x = x0; x < x1; x++) {
        var pxx = x - OX + 0.5;
        var t = l2 > 0 ? ((pxx - ax) * dx + (py - ay) * dy) / l2 : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var ox = pxx - (ax + t * dx), oy = py - (ay + t * dy);
        var d = Math.sqrt(ox * ox + oy * oy), rr = ra + (rb - ra) * t;
        if (d > rr + 1e-4) continue;
        s[y * BW + x] = c0 + toneFor(ox, oy, d, rr - d, sh, base);
        hit = true;
      }
    }
    if (hit) this._grow(x0, y0, x1, y1);
  };

  // filled ellipse
  P.ell = function (cx, cy, rx, ry, mat, sh, tone) {
    var base = tone == null ? 1 : tone;
    cx += 0.5; cy += 0.5;
    var x0 = clampX(Math.floor(cx - rx) + OX), x1 = clampX(Math.ceil(cx + rx) + OX + 1);
    var y0 = clampY(Math.floor(cy - ry) + OY), y1 = clampY(Math.ceil(cy + ry) + OY + 1);
    var s = this.s, c0 = 2 + mat * 4, hit = false, rm = rx < ry ? rx : ry;
    for (var y = y0; y < y1; y++) {
      var oy = y - OY + 0.5 - cy;
      for (var x = x0; x < x1; x++) {
        var ox = x - OX + 0.5 - cx;
        var q = (ox * ox) / (rx * rx) + (oy * oy) / (ry * ry);
        if (q > 1 + 1e-4) continue;
        var d = Math.sqrt(q);
        s[y * BW + x] = c0 + toneFor(ox / rx, oy / ry, d, (1 - d) * rm, sh, base);
        hit = true;
      }
    }
    if (hit) this._grow(x0, y0, x1, y1);
  };

  // convex or concave simple polygon, pts = [x0,y0,x1,y1,...] (vertex coords are
  // pixel centres). Shading uses edges facing away from / toward the light.
  P.poly = function (pts, mat, sh, tone) {
    var base = tone == null ? 1 : tone, n = pts.length >> 1, i, j;
    if (n < 3) return;
    var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, area = 0;
    for (i = 0; i < n; i++) {
      var X = pts[i * 2] + 0.5, Y = pts[i * 2 + 1] + 0.5;
      if (X < minx) minx = X; if (X > maxx) maxx = X; if (Y < miny) miny = Y; if (Y > maxy) maxy = Y;
      j = (i + 1) % n;
      area += (pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]);
    }
    var orient = area > 0 ? 1 : -1;   // y-down: area>0 = clockwise on screen
    var x0 = clampX(Math.floor(minx) + OX), x1 = clampX(Math.ceil(maxx) + OX + 1);
    var y0 = clampY(Math.floor(miny) + OY), y1 = clampY(Math.ceil(maxy) + OY + 1);
    var s = this.s, c0 = 2 + mat * 4, hit = false, xs = this._xs || (this._xs = new Float64Array(64));
    for (var y = y0; y < y1; y++) {
      var py = y - OY;   // centre-relative: vertex coords are already centres
      var k = 0;
      for (i = 0; i < n; i++) {
        j = (i + 1) % n;
        var ay = pts[i * 2 + 1], by = pts[j * 2 + 1];
        if ((ay <= py && by > py) || (by <= py && ay > py)) {
          var ax = pts[i * 2], bx = pts[j * 2];
          xs[k++] = ax + (py - ay) / (by - ay) * (bx - ax);
        }
      }
      if (k < 2) continue;
      // sort the few crossings
      for (i = 1; i < k; i++) { var v = xs[i]; j = i - 1; while (j >= 0 && xs[j] > v) { xs[j + 1] = xs[j]; j--; } xs[j + 1] = v; }
      for (var q = 0; q + 1 < k; q += 2) {
        var xa = Math.ceil(xs[q] - 1e-4), xb = Math.floor(xs[q + 1] + 1e-4);
        for (var x = xa; x <= xb; x++) {
          var bxp = x + OX;
          if (bxp < 1 || bxp >= BW - 1) continue;
          var tone2 = base;
          if (sh) tone2 = polyTone(pts, n, orient, x, py, sh, base);
          s[y * BW + bxp] = c0 + tone2;
          hit = true;
        }
      }
    }
    if (hit) this._grow(x0, y0, x1, y1);
  };

  function polyTone(pts, n, orient, px, py, sh, base) {
    var dark = false, light = false;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
      var ex = bx - ax, ey = by - ay, el = Math.sqrt(ex * ex + ey * ey);
      if (el < 1e-6) continue;
      // outward normal
      var nx = ey / el * orient, ny = -ex / el * orient;
      var dist = -((px - ax) * nx + (py - ay) * ny);  // inside distance
      var t = ((px - ax) * ex + (py - ay) * ey) / (el * el);
      if (t < -0.15 || t > 1.15) continue;
      var s = nx * LX + ny * LY;
      if (sh.d && s < -0.25 && dist < sh.d - 0.5) dark = true;
      else if (sh.l && s > 0.55 && dist < sh.l - 0.5) light = true;
    }
    if (dark) return base + 1 > 3 ? 3 : base + 1;
    if (light && base > 0) return base - 1;
    return base;
  }

  // indexed image blit: img = { w, h, d: Uint8Array, px, py } (pivot px,py at x,y)
  P.blit = function (img, x, y, flip) {
    var bx = (x | 0) + OX - (flip ? img.w - 1 - img.px : img.px), by = (y | 0) + OY - img.py;
    var s = this.s, d = img.d, w = img.w, h = img.h, hit = false;
    for (var j = 0; j < h; j++) {
      var yy = by + j;
      if (yy < 1 || yy >= BH - 1) continue;
      for (var i = 0; i < w; i++) {
        var c = d[j * w + (flip ? w - 1 - i : i)];
        if (!c) continue;
        var xx = bx + i;
        if (xx < 1 || xx >= BW - 1) continue;
        s[yy * BW + xx] = c === 255 ? 0 : c;
        hit = true;
      }
    }
    if (hit) this._grow(bx < 1 ? 1 : bx, by < 1 ? 1 : by, clampX(bx + w), clampY(by + h));
  };

  // composite the scratch group onto the main buffer.
  // o.outline (default true): add 1-px outline ring. o.inner (default true):
  // where the ring falls on already-drawn pixels, use the front part's deep tone.
  P.end = function (o) {
    if (this.sx1 <= this.sx0) return;
    var outline = !o || o.outline !== false, inner = !o || o.inner !== false;
    var forceOut = o && o.hard, ring = (o && o.ring) || 1;
    var s = this.s, m = this.m, lum = this.lum, tmp = this.tmp, nt = 0;
    var x0 = this.sx0 - 1, y0 = this.sy0 - 1, x1 = this.sx1 + 1, y1 = this.sy1 + 1;
    if (x0 < 1) x0 = 1; if (y0 < 1) y0 = 1; if (x1 > BW - 1) x1 = BW - 1; if (y1 > BH - 1) y1 = BH - 1;
    var x, y, i;
    if (outline) {
      for (y = y0; y < y1; y++) {
        for (x = x0; x < x1; x++) {
          i = y * BW + x;
          if (s[i]) continue;
          var n = s[i - 1] || s[i + 1] || s[i - BW] || s[i + BW];
          if (!n) continue;
          var under = m[i], c = ring;
          if (under > 1 && inner && !forceOut && ring === 1) {
            // deep tone of the neighbouring front material
            var fd = n < 2 ? 1 : (n - ((n - 2) & 3)) + 3;
            c = (lum[under] < lum[fd] + 0.06) ? 1 : fd;
          }
          tmp[nt++] = i; tmp[nt++] = c;
        }
      }
    }
    for (y = this.sy0; y < this.sy1; y++) {
      for (x = this.sx0; x < this.sx1; x++) {
        i = y * BW + x;
        if (s[i]) { m[i] = s[i]; s[i] = 0; }
      }
    }
    for (var k = 0; k < nt; k += 2) m[tmp[k]] = tmp[k + 1];
    if (x0 < this.mx0) this.mx0 = x0; if (y0 < this.my0) this.my0 = y0;
    if (x1 > this.mx1) this.mx1 = x1; if (y1 > this.my1) this.my1 = y1;
    this.sx0 = BW; this.sy0 = BH; this.sx1 = 0; this.sy1 = 0;
  };

  // discard the scratch group without compositing
  P.drop = function () {
    for (var y = this.sy0; y < this.sy1; y++) this.s.fill(0, y * BW + this.sx0, y * BW + this.sx1);
    this.sx0 = BW; this.sy0 = BH; this.sx1 = 0; this.sy1 = 0;
  };

  I.Painter = Painter;
  I.painter = null;
  I.getPainter = function () { return I.painter || (I.painter = new Painter()); };

  // ------------------------------------------------------------ colour tables
  function hexToRGB(h) {
    var v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  I.hexToRGB = hexToRGB;
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  I.mix = mix;
  function pack(c, a) {   // little-endian ABGR for Uint32 view of ImageData
    return ((a == null ? 255 : a) << 24 | (Math.round(c[2]) & 255) << 16 | (Math.round(c[1]) & 255) << 8 | (Math.round(c[0]) & 255)) >>> 0;
  }
  I.pack = pack;

  // build { rgb: [[r,g,b]...], lum: Float32Array } for a char palette given a
  // material → 4-hex ramp table
  I.buildColours = function (outlineHex, ramps) {
    var rgb = new Array(I.NCOL), lum = new Float32Array(256);
    rgb[0] = [0, 0, 0]; rgb[1] = hexToRGB(outlineHex);
    for (var m = 0; m < NMAT; m++) {
      var r = ramps[m] || ramps[0];
      for (var t = 0; t < 4; t++) rgb[2 + m * 4 + t] = hexToRGB(r[t]);
    }
    for (var i = 0; i < I.NCOL; i++) {
      var c = rgb[i];
      lum[i] = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
    }
    return { rgb: rgb, lum: lum };
  };

  // Uint32 LUT for a given look. kind: 0 normal, 1 flash(t,colour), 2 silhouette(colour)
  I.makeLUT = function (cols, flashT, flashRGB, silRGB) {
    var lut = new Uint32Array(256);
    for (var i = 1; i < I.NCOL; i++) {
      var c = cols.rgb[i];
      if (silRGB) c = silRGB;
      else if (flashT > 0) c = mix(c, flashRGB, flashT);
      lut[i] = pack(c);
    }
    lut[0] = 0;
    return lut;
  };

  // ------------------------------------------------ indexed image utilities
  // ASCII art → indexed image. legend maps a char → colour index (0 = clear,
  // 255 = "erase" i.e. punch a hole when blitted).
  I.parseArt = function (rows, legend, px, py) {
    var h = rows.length, w = 0, j, i;
    for (j = 0; j < h; j++) if (rows[j].length > w) w = rows[j].length;
    var d = new Uint8Array(w * h);
    for (j = 0; j < h; j++) {
      for (i = 0; i < rows[j].length; i++) {
        var ch = rows[j][i], v = legend[ch];
        if (v === undefined) {
          if (ch !== '.' && ch !== ' ') console.error('[rig] unknown art char "' + ch + '"');
          v = 0;
        }
        d[j * w + i] = v;
      }
    }
    return { w: w, h: h, d: d, px: px || 0, py: py || 0 };
  };

  // overlay b onto a copy of a at (ox, oy) in a's coordinates; mask: only
  // where a has one of the listed colours (or everywhere if mask null)
  I.overlay = function (a, b, ox, oy, maskSet) {
    var d = new Uint8Array(a.d);
    for (var j = 0; j < b.h; j++) {
      var y = oy + j;
      if (y < 0 || y >= a.h) continue;
      for (var i = 0; i < b.w; i++) {
        var x = ox + i;
        if (x < 0 || x >= a.w) continue;
        var c = b.d[j * b.w + i];
        if (!c) continue;
        if (maskSet && !maskSet[a.d[y * a.w + x]]) continue;
        d[y * a.w + x] = c === 255 ? 0 : c;
      }
    }
    return { w: a.w, h: a.h, d: d, px: a.px, py: a.py };
  };

  // EPX / Scale2x on an indexed image
  function scale2x(img) {
    var w = img.w, h = img.h, s = img.d, W = w * 2, d = new Uint8Array(W * h * 2);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var P0 = s[y * w + x];
        var A = y > 0 ? s[(y - 1) * w + x] : P0, B = x < w - 1 ? s[y * w + x + 1] : P0;
        var C = x > 0 ? s[y * w + x - 1] : P0, D = y < h - 1 ? s[(y + 1) * w + x] : P0;
        var e0 = P0, e1 = P0, e2 = P0, e3 = P0;
        if (C === A && C !== D && A !== B) e0 = A;
        if (A === B && A !== C && B !== D) e1 = B;
        if (D === C && D !== B && C !== A) e2 = C;
        if (B === D && B !== A && D !== C) e3 = D;
        var o = (y * 2) * W + x * 2;
        d[o] = e0; d[o + 1] = e1; d[o + W] = e2; d[o + W + 1] = e3;
      }
    }
    return { w: W, h: h * 2, d: d };
  }

  // RotSprite-style rotation (×8 Scale2x, nearest sample back at ×1).
  // Rotates about the pivot (px,py); returns a new image with an updated pivot.
  I.rotate = function (img, deg) {
    var a = ((deg % 360) + 360) % 360;
    var w = img.w, h = img.h, i, j, d;
    if (a === 0) return img;
    if (a === 90 || a === 180 || a === 270) {     // exact
      var W2 = a === 180 ? w : h, H2 = a === 180 ? h : w;
      d = new Uint8Array(W2 * H2);
      for (j = 0; j < h; j++) for (i = 0; i < w; i++) {
        var c = img.d[j * w + i], X, Y;
        if (a === 90) { X = h - 1 - j; Y = i; } else if (a === 180) { X = w - 1 - i; Y = h - 1 - j; } else { X = j; Y = w - 1 - i; }
        d[Y * W2 + X] = c;
      }
      var npx, npy;
      if (a === 90) { npx = h - 1 - img.py; npy = img.px; } else if (a === 180) { npx = w - 1 - img.px; npy = h - 1 - img.py; } else { npx = img.py; npy = w - 1 - img.px; }
      return { w: W2, h: H2, d: d, px: npx, py: npy };
    }
    var big = scale2x(scale2x(scale2x(img))), S = 8;
    var rad = a * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
    var cx = img.px + 0.5, cy = img.py + 0.5;
    // bounding box of rotated corners
    var xs = [], ys = [];
    [[0, 0], [w, 0], [0, h], [w, h]].forEach(function (p) {
      var dx = p[0] - cx, dy = p[1] - cy;
      xs.push(cx + dx * cs - dy * sn); ys.push(cy + dx * sn + dy * cs);
    });
    var ox = Math.floor(Math.min.apply(null, xs)) - 1, oy = Math.floor(Math.min.apply(null, ys)) - 1;
    var W = Math.ceil(Math.max.apply(null, xs)) + 1 - ox, H = Math.ceil(Math.max.apply(null, ys)) + 1 - oy;
    d = new Uint8Array(W * H);
    for (j = 0; j < H; j++) {
      for (i = 0; i < W; i++) {
        var qx = ox + i + 0.5 - cx, qy = oy + j + 0.5 - cy;
        var sx = cx + qx * cs + qy * sn, sy = cy - qx * sn + qy * cs;   // inverse rotation
        var bx = Math.floor(sx * S), by = Math.floor(sy * S);
        if (bx < 0 || by < 0 || bx >= big.w || by >= big.h) continue;
        d[j * W + i] = big.d[by * big.w + bx];
      }
    }
    return { w: W, h: H, d: d, px: img.px - ox, py: img.py - oy };
  };
})();
