/* LATENT CLASH — ILLUST core: a tiny "pixel vector" toolkit.
 *
 * Everything ILLUST draws goes through here. Shapes (polygons, ellipses, tapered bezier
 * ribbons) are rasterised WITHOUT anti-aliasing (pixel-centre sampling) into Masks; masks are
 * painted into an indexed-colour Painter buffer as palette *slots*, so a picture can be
 * re-coloured exactly for any palette. Faces/eyes are stamped from hand-typed pixel maps.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var I = LC.illust = LC.illust || {};
  var K = I.kit = {};

  // ---------------------------------------------------------------- colour helpers
  function rgb(c) {
    if (Array.isArray(c)) return c;
    var n = parseInt(c.slice(1), 16);
    if (c.length === 4) return [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hex(a) {
    return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
  }
  function mix(a, b, t) {
    a = rgb(a); b = rgb(b);
    return hex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  K.rgb = rgb; K.hex = hex; K.mix = mix;

  // ---------------------------------------------------------------- slots (portrait palette)
  // Fixed slot layout shared by every portrait. Index 0 = transparent.
  var SLOT_NAMES = ['ol', 's0', 's1', 's2', 's3', 'bl', 'h0', 'h1', 'h2', 'h3', 't0', 't1', 'tS',
    'e0', 'e1', 'e2', 'e3', 'c0', 'c1', 'c2', 'c3', 'd0', 'd1', 'd2', 'd3', 'a0', 'a1', 'a2', 'a3',
    'm0', 'm1', 'm2', 'm3', 'W', 'hl', 'sl', 'cl', 'dl', 'al', 'ml', 'lash', 'mo', 'tg', 'tear',
    'tear2', 'ew', 'tl', 'blS', 'sp', 'K', 'gl0', 'gl1', 'sk1'];
  var S = K.S = {};
  SLOT_NAMES.forEach(function (n, i) { S[n] = i + 1; });
  K.NSLOT = SLOT_NAMES.length + 1;

  // Build the RGB table for LC.PAL[char][pal] (derived tones are mixes of palette colours).
  K.slotColors = function (charId, pal) {
    var p = LC.PAL[charId][pal] || LC.PAL[charId][0];
    var ol = p.outline, c = {};
    c.ol = ol;
    ['skin:s', 'hair:h', 'eye:e', 'cloth1:c', 'cloth2:d', 'accent:a', 'metal:m'].forEach(function (k) {
      var kk = k.split(':');
      for (var i = 0; i < 4; i++) c[kk[1] + i] = p[kk[0]][i];
    });
    c.bl = p.blush; c.t0 = p.hairTip[0]; c.t1 = p.hairTip[1];
    c.tS = mix(p.hairTip[1], p.hair[2], 0.45);
    c.tl = mix(p.hairTip[1], p.hair[3], 0.7);
    c.W = '#ffffff';
    c.hl = mix(p.hair[3], ol, 0.55);
    c.sl = mix(p.skin[3], ol, 0.5);
    c.cl = mix(p.cloth1[3], ol, 0.5);
    c.dl = mix(p.cloth2[3], ol, 0.45);
    c.al = mix(p.accent[3], ol, 0.5);
    c.ml = mix(p.metal[3], ol, 0.5);
    c.lash = mix(ol, p.eye[3], 0.25);
    c.mo = mix(p.blush, ol, 0.62);
    c.tg = mix(p.blush, p.skin[2], 0.3);
    c.tear = '#d8f6ff'; c.tear2 = '#7fd0f5';
    c.ew = mix('#ffffff', p.skin[0], 0.35);
    c.blS = mix(p.blush, p.skin[1], 0.45);
    c.sp = '#fff8d0';
    c.K = mix(ol, '#000000', 0.3);
    c.gl0 = mix(p.accent[0], '#ffffff', 0.5); c.gl1 = p.accent[1];
    c.sk1 = mix(p.skin[1], p.skin[2], 0.5);
    var out = [[0, 0, 0, 0]];
    SLOT_NAMES.forEach(function (n) { var v = rgb(c[n] || '#ff00ff'); out.push([v[0], v[1], v[2], 255]); });
    return out;
  };

  // ---------------------------------------------------------------- masks
  function Mask(w, h, d) { this.w = w; this.h = h; this.d = d || new Uint8Array(w * h); }
  K.Mask = Mask;
  Mask.prototype.clone = function () { return new Mask(this.w, this.h, new Uint8Array(this.d)); };
  Mask.prototype.or = function (m) { var r = this.clone(); for (var i = 0; i < r.d.length; i++) r.d[i] |= m.d[i]; return r; };
  Mask.prototype.and = function (m) { var r = this.clone(); for (var i = 0; i < r.d.length; i++) r.d[i] &= m.d[i]; return r; };
  Mask.prototype.sub = function (m) { var r = this.clone(); for (var i = 0; i < r.d.length; i++) if (m.d[i]) r.d[i] = 0; return r; };
  Mask.prototype.not = function () { var r = this.clone(); for (var i = 0; i < r.d.length; i++) r.d[i] ^= 1; return r; };
  Mask.prototype.shift = function (dx, dy) {
    var w = this.w, h = this.h, r = new Mask(w, h);
    for (var y = 0; y < h; y++) {
      var sy = y - dy; if (sy < 0 || sy >= h) continue;
      for (var x = 0; x < w; x++) { var sx = x - dx; if (sx >= 0 && sx < w && this.d[sy * w + sx]) r.d[y * w + x] = 1; }
    }
    return r;
  };
  // band on the side opposite to (dx,dy): pixels uncovered when the shape is shifted by (dx,dy)
  Mask.prototype.band = function (dx, dy) { return this.sub(this.shift(dx, dy)); };
  Mask.prototype.grow = function (n) {
    var r = this;
    for (var k = 0; k < (n || 1); k++) r = r.or(r.shift(1, 0)).or(r.shift(-1, 0)).or(r.shift(0, 1)).or(r.shift(0, -1));
    return r;
  };
  Mask.prototype.edge = function () { return this.sub(innerOf(this)); };
  function innerOf(m) { // pixels whose 4 neighbours are all set (OOB counts as set)
    var w = m.w, h = m.h, r = new Mask(w, h), d = m.d;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x; if (!d[i]) continue;
      if ((x > 0 && !d[i - 1]) || (x < w - 1 && !d[i + 1]) || (y > 0 && !d[i - w]) || (y < h - 1 && !d[i + w])) continue;
      r.d[i] = 1;
    }
    return r;
  }
  K.inner = innerOf;
  Mask.prototype.rect = function (x, y, w, h) {
    for (var j = Math.max(0, y); j < Math.min(this.h, y + h); j++)
      for (var i = Math.max(0, x); i < Math.min(this.w, x + w); i++) this.d[j * this.w + i] = 1;
    return this;
  };
  Mask.prototype.has = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[y * this.w + x] === 1; };

  // ---------------------------------------------------------------- rasterisers (no AA)
  // Non-zero polygon fill, pixel (i,j) set when its centre is inside. pts: flat [x,y,...].
  function fillPoly(m, pts) {
    var n = pts.length >> 1, w = m.w, h = m.h, ymin = 1e9, ymax = -1e9, i;
    for (i = 0; i < n; i++) { var yy = pts[i * 2 + 1]; if (yy < ymin) ymin = yy; if (yy > ymax) ymax = yy; }
    var j0 = Math.max(0, Math.floor(ymin - 0.5)), j1 = Math.min(h - 1, Math.ceil(ymax));
    var xs = [];
    for (var j = j0; j <= j1; j++) {
      var yc = j + 0.5; xs.length = 0;
      for (i = 0; i < n; i++) {
        var k = (i + 1) % n, x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[k * 2], y1 = pts[k * 2 + 1];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push([x0 + (yc - y0) * (x1 - x0) / (y1 - y0), y1 > y0 ? 1 : -1]);
      }
      if (!xs.length) continue;
      xs.sort(function (a, b) { return a[0] - b[0]; });
      var wind = 0;
      for (var q = 0; q < xs.length - 1; q++) {
        wind += xs[q][1];
        if (wind !== 0) {
          var a = Math.max(0, Math.ceil(xs[q][0] - 0.5)), b = Math.min(w, Math.ceil(xs[q + 1][0] - 0.5));
          for (var x = a; x < b; x++) m.d[j * w + x] = 1;
        }
      }
    }
    return m;
  }
  K.fillPoly = fillPoly;

  // Cubic bezier chain [x0,y0, c1x,c1y, c2x,c2y, x1,y1, c1x,c1y, c2x,c2y, x2,y2 ...] -> points
  function bez(pts, seg) {
    seg = seg || 20;
    var out = [pts[0], pts[1]];
    for (var s = 0; s + 7 < pts.length; s += 6) {
      for (var k = 1; k <= seg; k++) {
        var t = k / seg, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        out.push(a * pts[s] + b * pts[s + 2] + c * pts[s + 4] + d * pts[s + 6],
          a * pts[s + 1] + b * pts[s + 3] + c * pts[s + 5] + d * pts[s + 7]);
      }
    }
    return out;
  }
  K.bez = bez;
  // Smooth path through points (Catmull-Rom -> bezier chain)
  function smooth(p) {
    if (p.length < 6) return p.slice();
    var out = [p[0], p[1]], n = p.length >> 1;
    for (var i = 0; i < n - 1; i++) {
      var x0 = p[Math.max(0, i - 1) * 2], y0 = p[Math.max(0, i - 1) * 2 + 1], x1 = p[i * 2], y1 = p[i * 2 + 1];
      var x2 = p[(i + 1) * 2], y2 = p[(i + 1) * 2 + 1], x3 = p[Math.min(n - 1, i + 2) * 2], y3 = p[Math.min(n - 1, i + 2) * 2 + 1];
      out.push(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2);
    }
    return out;
  }
  K.smooth = smooth;

  // ---------------------------------------------------------------- painter
  // tf: design coords -> pixels: px = x*s + ox (optionally mirrored)
  function Painter(w, h) {
    this.w = w; this.h = h; this.c = new Uint8Array(w * h);
    this.s = 1; this.ox = 0; this.oy = 0;
  }
  K.Painter = Painter;
  K.painter = function (w, h) { return new Painter(w, h); };
  var PP = Painter.prototype;
  PP.mask = function () { return new Mask(this.w, this.h); };
  PP.T = function (pts) { var o = new Array(pts.length); for (var i = 0; i < pts.length; i += 2) { o[i] = pts[i] * this.s + this.ox; o[i + 1] = pts[i + 1] * this.s + this.oy; } return o; };
  PP.tx = function (x) { return Math.round(x * this.s + this.ox); };
  PP.ty = function (y) { return Math.round(y * this.s + this.oy); };
  // shapes -> masks
  PP.poly = function (pts) { return fillPoly(this.mask(), this.T(pts)); };
  PP.spoly = function (pts) { return fillPoly(this.mask(), this.T(bez(smooth(pts), 10))); };    // smooth closed blob through points
  PP.bpoly = function (pts) { return fillPoly(this.mask(), this.T(bez(pts, 16))); };            // closed bezier chain
  PP.ell = function (cx, cy, rx, ry, ang) {
    var m = this.mask(), s = this.s; cx = cx * s + this.ox; cy = cy * s + this.oy; rx *= s; ry *= s;
    var ca = Math.cos(ang || 0), sa = Math.sin(ang || 0), R = Math.max(rx, ry) + 1;
    for (var y = Math.max(0, Math.floor(cy - R)); y < Math.min(this.h, Math.ceil(cy + R)); y++)
      for (var x = Math.max(0, Math.floor(cx - R)); x < Math.min(this.w, Math.ceil(cx + R)); x++) {
        var dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
        if (u * u + v * v <= 1) m.d[y * this.w + x] = 1;
      }
    return m;
  };
  PP.rect = function (x, y, w, h) { return this.poly([x, y, x + w, y, x + w, y + h, x, y + h]); };
  // Tapered ribbon along a bezier chain. widths: [w0, w1] or [w0, wm, w1]
  PP.rib = function (spine, w0, w1, wm) {
    var p = bez(spine, 24), n = p.length >> 1, L = [], R = [];
    if (wm === undefined) wm = (w0 + w1) / 2;
    for (var i = 0; i < n; i++) {
      var a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      var tx = p[b * 2] - p[a * 2], ty = p[b * 2 + 1] - p[a * 2 + 1], l = Math.sqrt(tx * tx + ty * ty) || 1;
      var t = i / (n - 1), u = 1 - t, wd = (u * u * w0 + 2 * u * t * wm + t * t * w1) / 2;
      var nx = -ty / l * wd, ny = tx / l * wd;
      L.push(p[i * 2] + nx, p[i * 2 + 1] + ny); R.push(p[i * 2] - nx, p[i * 2 + 1] - ny);
    }
    for (var j = R.length - 2; j >= 0; j -= 2) L.push(R[j], R[j + 1]);
    return fillPoly(this.mask(), this.T(L));
  };
  // ribbon through points (Catmull-Rom smoothed)
  PP.sr = function (pts, w0, w1, wm) { return this.rib(smooth(pts), w0, w1, wm); };
  // pixel output
  PP.fill =function (m, slot) { var d = m.d, c = this.c; for (var i = 0; i < d.length; i++) if (d[i]) c[i] = slot; return m; };
  // fill + 1px line on the shape's own boundary (OOB counts as inside, so frame edges get no line)
  PP.part = function (m, slot, line) {
    var w = this.w, h = this.h, d = m.d, c = this.c;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x; if (!d[i]) continue;
      var edge = (x > 0 && !d[i - 1]) || (x < w - 1 && !d[i + 1]) || (y > 0 && !d[i - w]) || (y < h - 1 && !d[i + w]);
      c[i] = edge && line ? line : slot;
    }
    return m;
  };
  // recolour pixels inside m whose current slot is in `from` (array or single) -> slot
  PP.recol = function (m, from, slot) {
    var set = {}; (Array.isArray(from) ? from : [from]).forEach(function (s) { set[s] = 1; });
    var d = m.d, c = this.c;
    for (var i = 0; i < d.length; i++) if (d[i] && set[c[i]]) c[i] = slot;
    return m;
  };
  PP.solid = function () { var m = this.mask(); for (var i = 0; i < m.d.length; i++) m.d[i] = this.c[i] ? 1 : 0; return m; };
  PP.slotMask = function (slots) {
    var set = {}; (Array.isArray(slots) ? slots : [slots]).forEach(function (s) { set[s] = 1; });
    var m = this.mask(); for (var i = 0; i < m.d.length; i++) m.d[i] = set[this.c[i]] ? 1 : 0; return m;
  };
  PP.px = function (x, y, slot) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = slot; };
  PP.get = function (x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.c[y * this.w + x] : 0; };
  // 1px pixel-perfect polyline/curve (design coords). curve=true -> smooth through the points
  PP.line = function (pts, slot, curve, onlyOver) {
    var q = this.T(curve ? bez(smooth(pts), 12) : pts), list = [], self = this;
    function plot(x, y) { var l = list.length; if (l && list[l - 1][0] === x && list[l - 1][1] === y) return; list.push([x, y]); }
    for (var i = 0; i + 3 < q.length; i += 2) {
      var x0 = Math.floor(q[i]), y0 = Math.floor(q[i + 1]), x1 = Math.floor(q[i + 2]), y1 = Math.floor(q[i + 3]);
      var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
      for (;;) { plot(x0, y0); if (x0 === x1 && y0 === y1) break; var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    }
    if (q.length === 2) plot(Math.floor(q[0]), Math.floor(q[1]));
    // remove L-corners for clean 1px curves
    var out = [];
    for (var k = 0; k < list.length; k++) {
      if (k > 0 && k < list.length - 1 && out.length) {
        var a = out[out.length - 1], c = list[k + 1], b = list[k];
        if (a[0] !== c[0] && a[1] !== c[1] && Math.abs(a[0] - c[0]) <= 1 && Math.abs(a[1] - c[1]) <= 1) continue;
      }
      out.push(list[k]);
    }
    out.forEach(function (p) { if (!onlyOver || self.get(p[0], p[1])) self.px(p[0], p[1], slot); });
    return out;
  };
  // stamp a hand-typed pixel map; legend maps chars -> slot ('.' / ' ' = skip). flip mirrors horizontally
  PP.map = function (x, y, rows, legend, flip) {
    x = this.tx(x); y = this.ty(y);
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j], n = r.length;
      for (var i = 0; i < n; i++) {
        var ch = r.charAt(flip ? n - 1 - i : i);
        if (ch === '.' || ch === ' ') continue;
        var s = legend[ch];
        if (s === undefined) s = S[ch];
        if (s === undefined) continue;
        this.px(x + i, y + j, s);
      }
    }
  };
  // outer silhouette pass: opaque pixels touching transparency -> slot (or fn(oldSlot, sidesMask))
  // sides bitmask: 1 = up, 2 = right, 4 = down, 8 = left are transparent
  PP.outer = function (slot, fn) {
    var w = this.w, h = this.h, c = this.c, out = new Uint8Array(c);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x; if (!c[i]) continue;
      var s = 0;
      if (y > 0 && !c[i - w]) s |= 1; if (x < w - 1 && !c[i + 1]) s |= 2;
      if (y < h - 1 && !c[i + w]) s |= 4; if (x > 0 && !c[i - 1]) s |= 8;
      if (s) out[i] = fn ? fn(c[i], s) : slot;
    }
    this.c = out;
  };
  // remove isolated single pixels of slot (noise clean-up)
  PP.despeckle = function (slots) {
    var set = {}; slots.forEach(function (s) { set[s] = 1; });
    var w = this.w, h = this.h, c = this.c;
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      var i = y * w + x; if (!set[c[i]]) continue;
      var a = c[i - 1], b = c[i + 1], u = c[i - w], d = c[i + w];
      if (a !== c[i] && b !== c[i] && u !== c[i] && d !== c[i] && a === b && u === d && a === u) c[i] = a;
    }
  };
  // render to a canvas with a slot colour table [[r,g,b,a],...]
  PP.canvas = function (table, flip) {
    var cv = K.canvas(this.w, this.h), ctx = cv.getContext('2d'), im = ctx.createImageData(this.w, this.h), D = im.data;
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var s = this.c[y * this.w + (flip ? this.w - 1 - x : x)], o = (y * this.w + x) * 4, col = table[s];
      if (!s || !col) continue;
      D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = col[3] === undefined ? 255 : col[3];
    }
    ctx.putImageData(im, 0, 0);
    return cv;
  };
  // blit another painter's buffer into this one at (x,y) (opaque slots only)
  PP.blit = function (src, x, y) {
    for (var j = 0; j < src.h; j++) for (var i = 0; i < src.w; i++) {
      var s = src.c[j * src.w + i]; if (s) this.px(x + i, y + j, s);
    }
  };

  // ---------------------------------------------------------------- canvases
  K.canvas = function (w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    return c;
  };
  // nearest-neighbour integer upscale (for dev/gallery only)
  K.scaled = function (src, k) {
    var c = K.canvas(src.width * k, src.height * k), x = c.getContext('2d');
    x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  };
  K.flipped = function (src) {
    var c = K.canvas(src.width, src.height), x = c.getContext('2d');
    x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
    return c;
  };

  // simple seeded RNG (ILLUST's own randomness, never the fight RNG)
  K.rng = function (seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; };
  };
})();
