/* LATENT CLASH — LC.font: pixel-exact bitmap text (PLATFORM).
 *
 * Glyph bitmaps come from src/gen/fontdata.js (baked by tools/platform-bake-font.py from
 * Fusion Pixel 8/10/12 px). Every string is laid out once, rasterised into a small canvas
 * (text + optional 8-neighbour outline + drop shadow) and kept in an LRU cache, so drawing a
 * whole screen of text each frame is one drawImage per string. `cache:false` draws glyph by
 * glyph from a tinted atlas per (size, colour) instead (for text that changes every frame).
 *
 *   LC.font.draw(ctx, text, x, y, opts) -> drawn width   (y = top of the line box)
 *   opts = { size: 12, color: '#fff', align: 'left'|'center'|'right', outline: null|'#000',
 *            shadow: null|'#000', scale: 1, spacing: 0, lineGap: 2,
 *            reveal: n (typewriter: show only the first n characters), cache: true, alpha: 1 }
 *   LC.font.measure(text, opts) -> { w, h }   (w = ink-tight width of the widest line)
 *   LC.font.wrap(text, maxWidth, opts) -> string[]   (CJK aware)
 *   LC.font.lineHeight(size, lineGap = 2) -> size + lineGap  (line pitch)
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.font = LC.font || {};

  var SIZES = [8, 10, 12];
  var cpIndex = null;          // Map codepoint -> char index
  var S = {};                  // per size tables
  var warned = {};
  var ready = false;

  // ---------------------------------------------------------------- decoding
  function b64(str) {
    var bin = atob(str), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function readVarints(bytes) {
    var out = [], v = 0, sh = 0;
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      v += (b & 127) * Math.pow(2, sh);
      if (b & 128) sh += 7; else { out.push(v); v = 0; sh = 0; }
    }
    return out;
  }

  function decode() {
    var D = F.DATA;
    if (!D) { console.error('[platform] font data missing (src/gen/fontdata.js)'); return false; }
    var deltas = readVarints(b64(D.chars));
    var n = deltas.length, cp = 0;
    cpIndex = new Map();
    for (var i = 0; i < n; i++) { cp += deltas[i]; cpIndex.set(cp, i); }
    SIZES.forEach(function (size) {
      var d = D.sizes[size];
      if (!d) return;
      var bits = b64(d.bits);
      var t = {
        size: size, asc: d.asc, desc: d.desc, bits: bits,
        off: new Int32Array(n), adv: new Uint8Array(n),
        gx: new Int8Array(n), gy: new Int8Array(n), gw: new Uint8Array(n), gh: new Uint8Array(n),
        masks: new Array(n), kern: new Map()
      };
      var pos = 0;
      function rd(k) {
        var v = 0;
        for (var j = 0; j < k; j++, pos++) if (bits[pos >> 3] & (1 << (pos & 7))) v |= 1 << j;
        return v;
      }
      for (var g = 0; g < n; g++) {
        var adv = rd(5);
        if (adv === 31) { t.off[g] = -1; continue; }
        t.adv[g] = adv;
        t.gx[g] = rd(5) - 8; t.gy[g] = rd(5) - 4; t.gw[g] = rd(5); t.gh[g] = rd(5);
        t.off[g] = pos;
        pos += t.gw[g] * t.gh[g];
      }
      var kv = readVarints(b64(d.kern));
      for (var k = 0; k + 2 < kv.length; k += 3) t.kern.set(kv[k] * 16384 + kv[k + 1], kv[k + 2] - 16);
      S[size] = t;
    });
    return true;
  }

  function mask(t, g) {
    var m = t.masks[g];
    if (m) return m;
    var w = t.gw[g], h = t.gh[g], pos = t.off[g], bits = t.bits;
    m = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++, pos++) if (bits[pos >> 3] & (1 << (pos & 7))) m[i] = 1;
    t.masks[g] = m;
    return m;
  }

  function sizeOf(size) {
    size = size || 12;
    if (S[size]) return S[size];
    var best = 12;
    SIZES.forEach(function (s) { if (Math.abs(s - size) < Math.abs(best - size)) best = s; });
    return S[best] || S[12];
  }

  // Resolve one character to { t, g } (glyph in table t), falling back to other sizes.
  var FALLBACK = { 8: [10, 12], 10: [12, 8], 12: [10, 8] };
  function resolve(t, code) {
    var g = cpIndex.get(code);
    if (g !== undefined) {
      if (t.off[g] >= 0) return { t: t, g: g };
      var fb = FALLBACK[t.size];
      for (var i = 0; i < fb.length; i++) {
        var o = S[fb[i]];
        if (o && o.off[g] >= 0) return { t: o, g: g };
      }
    }
    if (!warned[code]) {
      warned[code] = true;
      console.warn('[platform] font: missing glyph U+' + code.toString(16).toUpperCase() + ' "' + String.fromCodePoint(code) + '"');
    }
    return null;
  }

  // ---------------------------------------------------------------- layout
  function isDigit(c) { return c >= 0x30 && c <= 0x39; }
  // A laid-out line: arrays of glyph placements relative to the line-box top-left.
  function layoutLine(str, t, spacing) {
    var items = [], x = 0, prevG = -1, inkR = 0, minY = 0, maxY = t.size, i = 0;
    var ends = [];   // x of the right ink edge after each character (for reveal)
    var cps = Array.from(str, function (c) { return c.codePointAt(0); });
    for (i = 0; i < cps.length; i++) {
      var code = cps[i];
      // the font's own GSUB rules (ccmp / calt), baked as private-use glyphs
      if (code === 0x2014 && cps[i + 1] === 0x2014) code = 0xE001;
      else if (code === 0x3A && isDigit(cps[i - 1]) && isDigit(cps[i + 1])) code = 0xE000;
      var r = resolve(t, code);
      if (!r) {   // tofu box
        var bw = Math.max(4, (t.size * 0.6) | 0);
        items.push({ box: true, x: x, y: 1, w: bw - 1, h: t.size - 3 });
        inkR = x + bw - 1; x += bw + spacing; prevG = -1; ends.push(inkR);
        continue;
      }
      if (prevG >= 0 && r.t === t) {
        var k = t.kern.get(prevG * 16384 + r.g);
        if (k) x += k;
      }
      var gt = r.t, g = r.g;
      // glyphs borrowed from another size sit on our baseline
      var dy = (t.asc) - (gt.asc);
      var gw = gt.gw[g], gh = gt.gh[g];
      if (gw && gh) {
        var gx = x + gt.gx[g], gy = gt.gy[g] + dy;
        items.push({ t: gt, g: g, x: gx, y: gy, w: gw, h: gh });
        if (gx + gw > inkR) inkR = gx + gw;
        if (gy < minY) minY = gy;
        if (gy + gh > maxY) maxY = gy + gh;
      }
      ends.push(Math.max(inkR, x));
      x += gt.adv[g] + spacing;
      prevG = r.t === t ? g : -1;
    }
    return { items: items, w: inkR, adv: x, minY: minY, maxY: maxY, ends: ends, n: ends.length };
  }

  function layout(text, o) {
    var t = sizeOf(o.size);
    var lines = String(text).split('\n').map(function (s) { return layoutLine(s, t, o.spacing || 0); });
    var gap = o.lineGap == null ? 2 : o.lineGap;
    var w = 0;
    lines.forEach(function (l) { if (l.w > w) w = l.w; });
    lines.forEach(function (l, i) {
      l.y = i * (t.size + gap);
      l.x = o.align === 'center' ? ((w - l.w) >> 1) : o.align === 'right' ? (w - l.w) : 0;
    });
    return { t: t, lines: lines, w: w, h: lines.length * t.size + (lines.length - 1) * gap, gap: gap };
  }

  // ---------------------------------------------------------------- colours
  var colCache = new Map(), colCtx = null;
  function rgba(c) {
    if (c == null) return null;
    var hit = colCache.get(c);
    if (hit) return hit;
    var s = String(c), out;
    var m = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (m) {
      var h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map(function (ch) { return ch + ch; }).join('');
      out = [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16), h.length >= 8 ? parseInt(h.substr(6, 2), 16) : 255];
    } else {
      m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
      if (m) out = [+m[1] | 0, +m[2] | 0, +m[3] | 0, m[4] == null ? 255 : Math.round(+m[4] * 255)];
      else {
        if (!colCtx) colCtx = document.createElement('canvas').getContext('2d');
        colCtx.fillStyle = '#000'; colCtx.fillStyle = s;
        var n = colCtx.fillStyle;
        out = n.charAt(0) === '#' ? rgba(n) : (/^rgba?\(/.test(n) ? rgba(n) : [255, 255, 255, 255]);
      }
    }
    colCache.set(c, out);
    return out;
  }

  // ---------------------------------------------------------------- string cache
  var cache = new Map(), cachePixels = 0;
  var CACHE_MAX = 900, CACHE_PIXELS = 3000000;
  var stats = { hits: 0, misses: 0 };

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w); c.height = Math.max(1, h);
    return c;
  }

  function render(text, o) {
    var L = layout(text, o);
    var outline = rgba(o.outline), shadow = rgba(o.shadow), col = rgba(o.color || '#fff');
    var pad = outline ? 1 : 0;
    var sh = shadow ? 1 : 0;
    var minY = 0, maxY = L.h;
    L.lines.forEach(function (l) { minY = Math.min(minY, l.y + l.minY); maxY = Math.max(maxY, l.y + l.maxY); });
    var ox = pad, oy = pad - minY;
    var cw = L.w + pad * 2 + sh, ch = (maxY - minY) + pad * 2 + sh;
    var m = new Uint8Array(cw * ch);            // 0 empty, 1 text, 2 outline, 3 shadow
    L.lines.forEach(function (l) {
      l.items.forEach(function (it) {
        var bx = ox + l.x + it.x, by = oy + l.y + it.y;
        if (it.box) {
          for (var yy = 0; yy < it.h; yy++) for (var xx = 0; xx < it.w; xx++)
            if (yy === 0 || xx === 0 || yy === it.h - 1 || xx === it.w - 1) m[(by + yy) * cw + bx + xx] = 1;
          return;
        }
        var gm = mask(it.t, it.g);
        for (var y = 0; y < it.h; y++) {
          var row = (by + y) * cw + bx;
          for (var x = 0; x < it.w; x++) if (gm[y * it.w + x]) m[row + x] = 1;
        }
      });
    });
    var i, x, y;
    if (outline) {
      for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
        i = y * cw + x;
        if (m[i]) continue;
        var hit = false;
        for (var dy = -1; dy <= 1 && !hit; dy++) {
          var yy2 = y + dy;
          if (yy2 < 0 || yy2 >= ch) continue;
          for (var dx = -1; dx <= 1; dx++) {
            var xx2 = x + dx;
            if (xx2 >= 0 && xx2 < cw && m[yy2 * cw + xx2] === 1) { hit = true; break; }
          }
        }
        if (hit) m[i] = 2;
      }
    }
    if (shadow) {
      for (y = ch - 1; y >= 1; y--) for (x = cw - 1; x >= 1; x--) {
        i = y * cw + x;
        if (!m[i]) { var s = m[i - cw - 1]; if (s === 1 || s === 2) m[i] = 3; }
      }
    }
    var cv = makeCanvas(cw, ch);
    var cx = cv.getContext('2d');
    var img = cx.createImageData(cw, ch), d = img.data;
    var cols = [null, col, outline, shadow];
    for (i = 0; i < m.length; i++) {
      var c = cols[m[i]];
      if (!c) continue;
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = c[3];
    }
    cx.putImageData(img, 0, 0);
    return { canvas: cv, ox: ox, oy: oy, w: L.w, h: L.h, cw: cw, ch: ch, L: L, pad: pad, sh: sh };
  }

  function keyOf(text, o) {
    return (o.size || 12) + '|' + (o.color || '#fff') + '|' + (o.outline || '') + '|' + (o.shadow || '') + '|' +
      (o.spacing || 0) + '|' + (o.lineGap == null ? 2 : o.lineGap) + '|' + (o.align || 'left') + '|' + text;
  }

  function get(text, o) {
    var key = keyOf(text, o);
    var e = cache.get(key);
    if (e) { cache.delete(key); cache.set(key, e); stats.hits++; return e; }
    stats.misses++;
    e = render(text, o);
    cache.set(key, e);
    cachePixels += e.cw * e.ch;
    while (cache.size > CACHE_MAX || cachePixels > CACHE_PIXELS) {
      var k = cache.keys().next().value, old = cache.get(k);
      cache.delete(k);
      cachePixels -= old.cw * old.ch;
    }
    return e;
  }

  // ---------------------------------------------------------------- glyph atlas (cache:false path)
  var atlases = new Map();
  function atlasFor(size, color) {
    var key = size + '|' + color;
    var a = atlases.get(key);
    if (!a) {
      a = { cv: makeCanvas(512, 256), map: new Map(), x: 0, y: 0, rowH: 0, col: rgba(color) };
      a.cx = a.cv.getContext('2d');
      atlases.set(key, a);
    }
    return a;
  }
  function atlasGlyph(a, t, g) {
    var k = t.size * 65536 + g;
    var p = a.map.get(k);
    if (p) return p;
    var w = t.gw[g], h = t.gh[g];
    if (a.x + w + 1 > a.cv.width) { a.x = 0; a.y += a.rowH + 1; a.rowH = 0; }
    if (a.y + h + 1 > a.cv.height) {   // grow: copy into a taller canvas
      var nc = makeCanvas(a.cv.width, a.cv.height * 2);
      nc.getContext('2d').drawImage(a.cv, 0, 0);
      a.cv = nc; a.cx = nc.getContext('2d');
    }
    var gm = mask(t, g), img = a.cx.createImageData(Math.max(1, w), Math.max(1, h)), c = a.col;
    for (var i = 0; i < gm.length; i++) if (gm[i]) { img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = c[3]; }
    a.cx.putImageData(img, a.x, a.y);
    p = { x: a.x, y: a.y, w: w, h: h };
    a.x += w + 1; if (h > a.rowH) a.rowH = h;
    a.map.set(k, p);
    return p;
  }
  function drawImmediate(ctx, L, x, y, o, scale) {
    var passes = [];
    if (o.shadow) passes.push([o.shadow, [[1, 1]].concat(o.outline ? [[0, 1], [1, 0], [2, 1], [1, 2], [0, 0], [2, 2], [0, 2], [2, 0]] : [])]);
    if (o.outline) passes.push([o.outline, [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]]);
    passes.push([o.color || '#fff', [[0, 0]]]);
    passes.forEach(function (p) {
      var color = p[0], offs = p[1];
      L.lines.forEach(function (l) {
        l.items.forEach(function (it) {
          if (it.box) return;
          var a = atlasFor(it.t.size, color), r = atlasGlyph(a, it.t, it.g);
          for (var k = 0; k < offs.length; k++) {
            ctx.drawImage(a.cv, r.x, r.y, r.w, r.h,
              x + (l.x + it.x + offs[k][0]) * scale, y + (l.y + it.y + offs[k][1]) * scale, r.w * scale, r.h * scale);
          }
        });
      });
    });
  }

  // ---------------------------------------------------------------- public API
  var DEF = {};
  F.init = function () {
    if (ready) return Promise.resolve();
    var t0 = performance.now();
    if (decode()) ready = true;
    F.initMs = performance.now() - t0;
    return Promise.resolve();
  };
  F.isReady = function () { return ready; };

  F.draw = function (ctx, text, x, y, opts) {
    if (text == null || text === '') return 0;
    if (!ready) F.init();
    if (!ready) return 0;
    var o = opts || DEF;
    text = String(text);
    var scale = Math.max(1, (o.scale || 1) | 0);
    var align = o.align || 'left';
    x = Math.round(x); y = Math.round(y);
    var alpha = o.alpha == null ? 1 : o.alpha;
    if (alpha <= 0) return 0;
    var oldA = ctx.globalAlpha;
    if (alpha < 1) ctx.globalAlpha = oldA * alpha;
    if (scale > 1) ctx.imageSmoothingEnabled = false;
    var w;
    if (o.cache === false && o.reveal == null) {
      var L = layout(text, o);
      w = L.w;
      var dx = align === 'center' ? x - ((L.w * scale) >> 1) : align === 'right' ? x - L.w * scale : x;
      drawImmediate(ctx, L, dx, y, o, scale);
    } else {
      var e = get(text, o);
      w = e.w;
      var bx = align === 'center' ? x - ((e.w * scale) >> 1) : align === 'right' ? x - e.w * scale : x;
      var px = bx - e.ox * scale, py = y - e.oy * scale;
      if (o.reveal == null) {
        ctx.drawImage(e.canvas, px, py, e.cw * scale, e.ch * scale);
      } else {
        drawReveal(ctx, e, px, py, scale, o.reveal | 0);
      }
    }
    if (alpha < 1) ctx.globalAlpha = oldA;
    return w * scale;
  };

  // Typewriter: draw the cached string clipped after `n` characters (line by line).
  function drawReveal(ctx, e, px, py, scale, n) {
    var lines = e.L.lines, t = e.L.t, gap = e.L.gap;
    for (var i = 0; i < lines.length && n > 0; i++) {
      var l = lines[i];
      var top = i === 0 ? 0 : e.oy + l.y - (gap >> 1);
      var bot = i === lines.length - 1 ? e.ch : e.oy + l.y + t.size + (gap - (gap >> 1));
      var right;
      if (n >= l.n) right = e.cw;
      else right = e.ox + l.x + l.ends[n - 1] + e.pad + e.sh;
      if (l.n === 0) { n -= 1; continue; }
      if (right > 0 && bot > top) {
        ctx.drawImage(e.canvas, 0, top, right, bot - top, px, py + top * scale, right * scale, (bot - top) * scale);
      }
      n -= l.n + 1;   // the '\n' counts as one character
    }
  }

  F.measure = function (text, opts) {
    if (!ready) F.init();
    var o = opts || DEF;
    var s = Math.max(1, (o.scale || 1) | 0);
    if (!ready || text == null || text === '') return { w: 0, h: 0 };
    var L = layout(String(text), o);
    return { w: L.w * s, h: L.h * s };
  };

  F.lineHeight = function (size, lineGap) {
    return (sizeOf(size || 12).size) + (lineGap == null ? 2 : lineGap);
  };

  // Count of drawable characters (for typewriter effects).
  F.length = function (text) { return Array.from(String(text)).length; };

  // ---------------------------------------------------------------- wrap
  var NO_BEFORE = '，。、！？；：）」』】》〉〕〗’”…—～·‧・ー々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ,.!?;:)]}%>' + '~';
  var NO_AFTER = '（「『【《〈〔〖‘“([{<';
  function isWide(c) { var k = c.codePointAt(0); return k >= 0x2E80 || (k >= 0x1100 && k <= 0x11ff) || (k >= 0x2190 && k <= 0x21ff) || (k >= 0x2500 && k <= 0x27bf); }

  // Split a paragraph into unbreakable atoms; spaces become their own atoms.
  function atoms(par) {
    var chars = Array.from(par), out = [], cur = '';
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      if (c === ' ') { if (cur) out.push(cur); out.push(' '); cur = ''; continue; }
      if (!cur) { cur = c; continue; }
      var prev = Array.from(cur).pop();
      var brk;
      if (NO_BEFORE.indexOf(c) >= 0) brk = false;
      else if (NO_AFTER.indexOf(prev) >= 0) brk = false;
      else if (isWide(c) || isWide(prev)) brk = true;
      else brk = false;
      if (brk) { out.push(cur); cur = c; } else cur += c;
    }
    if (cur) out.push(cur);
    return out;
  }

  F.wrap = function (text, maxWidth, opts) {
    if (!ready) F.init();
    var o = opts || DEF;
    var res = [];
    String(text == null ? '' : text).split('\n').forEach(function (par) {
      if (!par) { res.push(''); return; }
      var line = '';
      atoms(par).forEach(function (a) {
        if (a === ' ' && !line) return;
        var test = line + a;
        if (!line || F.measure(test, o).w <= maxWidth) { line = test; }
        else {
          res.push(line.replace(/ +$/, ''));
          line = a === ' ' ? '' : a;
        }
        // hard-break atoms that are wider than a whole line
        while (F.measure(line, o).w > maxWidth && Array.from(line).length > 1) {
          var cs = Array.from(line), k = cs.length - 1;
          while (k > 1 && F.measure(cs.slice(0, k).join(''), o).w > maxWidth) k--;
          res.push(cs.slice(0, k).join(''));
          line = cs.slice(k).join('');
        }
      });
      res.push(line.replace(/ +$/, ''));
    });
    return res;
  };

  F.has = function (ch, size) {
    if (!ready) F.init();
    var g = cpIndex && cpIndex.get(String(ch).codePointAt(0));
    return g !== undefined && sizeOf(size).off[g] >= 0;
  };
  F.clearCache = function () { cache.clear(); cachePixels = 0; atlases.clear(); };
  F.stats = function () { return { strings: cache.size, pixels: cachePixels, hits: stats.hits, misses: stats.misses, atlases: atlases.size }; };
})();
