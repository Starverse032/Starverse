/* LATENT CLASH — portrait / puppet / logo access with built-in fallbacks (PLATFORM).
 *   LC.ui.portrait(char, kind, pal)  -> canvas (LC.illust when present, else a tidy pixel bust)
 *   LC.ui.puppet(char, pal)          -> { tick(t, env), draw(ctx, sx, sy, opts), real }  (LC.rig or fallback)
 *   LC.ui.logo()                     -> canvas (LC.illust.logo or built-in lettering)
 *   LC.ui.banner(name)               -> canvas (LC.illust.banner or built-in lettering)  */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var ui = LC.ui, U = LC.UI;
  var cache = {};

  function pal(ch, p) { return (LC.PAL[ch] || LC.PAL.claude)[p || 0] || LC.PAL[ch][0]; }

  // ---------------------------------------------------------------- fallback bust (112×128)
  function fallbackBust(ch, kind, p) {
    var P = pal(ch, p), cv = ui.canvas(112, 128), c = cv.getContext('2d');
    var O = P.outline;
    var cl = ch === 'claude';
    // shoulders / outfit
    var body = function (x, y, w, h, col) { c.fillStyle = O; c.fillRect(x - 1, y - 1, w + 2, h + 2); c.fillStyle = col; c.fillRect(x, y, w, h); };
    ui.disc(c, 56, 150, 54, O); ui.disc(c, 56, 150, 53, P.cloth1[1]);
    ui.disc(c, 56, 152, 50, P.cloth1[2]);
    if (cl) { ui.box(c, 50, 100, 12, 28, P.accent[2]); ui.box(c, 52, 100, 8, 6, P.accent[1]); }
    else { ui.box(c, 36, 96, 40, 6, P.cloth2[1]); ui.box(c, 54, 102, 4, 26, P.metal[2]); }
    // neck
    body(49, 82, 14, 18, P.skin[2]);
    // back hair
    if (cl) { ui.disc(c, 56, 62, 36, O); ui.disc(c, 56, 62, 35, P.hair[2]); body(20, 60, 72, 60, P.hair[2]); ui.box(c, 20, 104, 72, 16, P.hairTip[1]); }
    else { ui.disc(c, 56, 56, 33, O); ui.disc(c, 56, 56, 32, P.hair[2]); }
    // face
    ui.disc(c, 56, 60, 25, O); ui.disc(c, 56, 60, 24, P.skin[1]);
    ui.box(c, 36, 66, 40, 14, P.skin[1]);
    ui.box(c, 40, 80, 32, 4, P.skin[1]); ui.box(c, 46, 84, 20, 3, P.skin[1]); ui.box(c, 46, 87, 20, 1, O); ui.box(c, 40, 84, 6, 1, O); ui.box(c, 66, 84, 6, 1, O);
    // fringe
    ui.disc(c, 56, 44, 27, O); ui.disc(c, 56, 44, 26, P.hair[1]);
    ui.box(c, 30, 44, 52, 8, P.hair[1]);
    c.fillStyle = P.skin[1];
    for (var i = 0; i < 4; i++) c.fillRect(36 + i * 11, 50, 6, 4 - (i & 1) * 2);
    ui.box(c, 34, 38, 18, 2, P.hair[0]);
    // eyes (expression by kind)
    var ey = 64, eyeCol = P.eye[1];
    [[44, 1], [62, -1]].forEach(function (e) {
      var x = e[0];
      if (kind === 'bustLose') { ui.box(c, x, ey + 3, 8, 1, O); ui.box(c, x + 1, ey + 4, 6, 1, P.eye[3]); return; }
      if (kind === 'bustWin') { ui.box(c, x, ey + 2, 8, 2, O); ui.box(c, x + 1, ey + 1, 6, 1, O); return; }
      ui.box(c, x, ey - 1, 8, 2, O);
      ui.box(c, x, ey + 1, 8, 7, eyeCol); ui.box(c, x, ey + 5, 8, 3, P.eye[2]); ui.box(c, x + 2, ey + 3, 4, 4, P.eye[3]);
      ui.box(c, x + 1, ey + 1, 2, 2, P.eye[0]);
    });
    ui.box(c, 40, 72, 5, 2, P.blush); ui.box(c, 67, 72, 5, 2, P.blush);
    if (kind === 'bustWin') { ui.box(c, 52, 77, 8, 1, O); ui.box(c, 53, 78, 6, 2, '#c4545b'); }
    else if (kind === 'bustLose') { ui.box(c, 53, 79, 6, 1, O); }
    else ui.box(c, 53, 78, 6, 1, O);
    // character keys: hair clip spark / fluke pigtails
    if (cl) {
      var sx = 80, sy = 38;
      ui.box(c, sx - 1, sy - 5, 3, 11, O); ui.box(c, sx - 5, sy - 1, 11, 3, O);
      ui.box(c, sx, sy - 4, 1, 9, P.accent[1]); ui.box(c, sx - 4, sy, 9, 1, P.accent[1]); ui.box(c, sx - 1, sy - 1, 3, 3, P.accent[0]);
      ui.box(c, 26, 56, 6, 40, P.hair[1]); ui.box(c, 80, 56, 6, 40, P.hair[1]);
    } else {
      [[20, 24, -1], [92, 24, 1]].forEach(function (f) {
        ui.disc(c, f[0], f[1], 9, O); ui.disc(c, f[0], f[1], 8, P.hair[1]);
        ui.box(c, f[0] - 6 + f[2] * 2, f[1] - 9, 4, 4, P.hairTip[1]);
      });
      ui.box(c, 54, 14, 4, 5, P.hair[1]); ui.box(c, 52, 12, 3, 2, P.hairTip[1]); ui.box(c, 57, 12, 3, 2, P.hairTip[1]);
    }
    return cv;
  }
  function fallbackFace(ch, p) {
    var b = fallbackBust(ch, 'bust', p), cv = ui.canvas(24, 24), c = cv.getContext('2d');
    // crude 2:1 point-sample of the head region (nearest neighbour, no smoothing)
    var src = b.getContext('2d').getImageData(8, 16, 96, 96).data, img = c.createImageData(24, 24);
    for (var y = 0; y < 24; y++) for (var x = 0; x < 24; x++) {
      var si = ((y * 4 + 1) * 96 + x * 4 + 1) * 4, di = (y * 24 + x) * 4;
      for (var k = 0; k < 4; k++) img.data[di + k] = src[si + k];
    }
    c.putImageData(img, 0, 0);
    return cv;
  }

  ui.portrait = function (ch, kind, p) {
    var key = ch + kind + (p || 0);
    if (cache[key]) return cache[key];
    var cv = null;
    if (LC.illust && LC.illust.portrait) {
      try { cv = LC.illust.portrait(ch, kind, p || 0); } catch (e) { console.error('[platform] illust.portrait', e); }
      if (cv && ui.isBlank(cv)) cv = null;
    }
    if (!cv) {
      if (kind === 'face') cv = fallbackFace(ch, p);
      else if (kind === 'cutin') cv = null;
      else cv = fallbackBust(ch, kind, p);
    }
    cache[key] = cv;
    return cv;
  };
  ui.hasIllust = function () { return !!(LC.illust && LC.illust.portrait); };

  // ---------------------------------------------------------------- puppets
  function FallbackPuppet(ch, p) { this.ch = ch; this.P = pal(ch, p); this.t = 0; this.real = false; }
  FallbackPuppet.prototype.tick = function (t) { this.t = t; };
  FallbackPuppet.prototype.draw = function (c, sx, sy, o) {
    var P = this.P, O = P.outline, f = (o && o.facing) || 1, b = Math.round(Math.sin(this.t * 0.1)) ;
    var h = this.ch === 'claude' ? 70 : 66;
    var X = function (dx, w) { return f > 0 ? sx + dx : sx - dx - w; };
    var R = function (dx, y, w, hh, col) { c.fillStyle = col; c.fillRect(X(dx, w), sy + y, w, hh); };
    var top = -h + b;
    // legs
    R(-7, -22, 5, 22, O); R(2, -22, 5, 22, O);
    R(-6, -21, 3, 20, P.cloth2[1]); R(3, -21, 3, 20, this.ch === 'claude' ? P.cloth2[1] : P.skin[1]);
    // body
    R(-10, top + 22, 20, 28 - b, O); R(-9, top + 23, 18, 26 - b, P.cloth1[1]);
    R(-9, top + 40, 18, 4, this.ch === 'claude' ? P.cloth2[1] : P.cloth1[2]);
    // head
    R(-9, top + 3, 18, 19, O); R(-8, top + 4, 16, 17, P.skin[1]);
    R(-9, top + 1, 18, 8, P.hair[1]); R(-10, top + 3, 3, 16, P.hair[1]); R(7, top + 3, 3, this.ch === 'claude' ? 26 : 10, P.hair[1]);
    if (this.ch === 'claude') R(-11, top + 8, 4, 30, P.hair[2]);
    R(2, top + 12, 2, 3, P.eye[2]);
    // weapon / gloves
    if (this.ch === 'claude') { R(10, top + 34, 22, 2, P.cloth2[1]); R(30, top + 34, 4, 2, P.metal[1]); }
    else { R(9, top + 30, 5, 5, P.accent[1]); }
  };
  FallbackPuppet.prototype.getAnchor = function () { return { x: 0, y: -40 }; };

  function RigPuppet(ch, p) {
    this.p = LC.rig.createPuppet(ch, { palette: p || 0 });
    this.ch = ch; this.real = true; this.anim = 'idle'; this.t0 = 0;
    this.has = {};
  }
  RigPuppet.prototype.setAnim = function (anim, t) {
    if (this.has[anim] === undefined) { try { this.has[anim] = !!LC.rig.hasAnim(this.ch, anim); } catch (e) { this.has[anim] = false; } }
    if (!this.has[anim]) anim = 'idle';
    if (anim !== this.anim) { this.anim = anim; this.t0 = t; }
  };
  RigPuppet.prototype.tick = function (t, env) {
    this.p.setPose(this.anim, t - this.t0);
    this.p.tick(env || { x: 0, y: LC.GROUND_Y, vx: 0, vy: 0, facing: 1, grounded: true });
  };
  RigPuppet.prototype.draw = function (c, sx, sy, o) { this.p.draw(c, sx | 0, sy | 0, o || {}); };
  RigPuppet.prototype.getAnchor = function (n) { try { return this.p.getAnchor(n); } catch (e) { return { x: 0, y: -40 }; } };

  ui.puppet = function (ch, p) {
    if (LC.rig && LC.rig.createPuppet) {
      try { return new RigPuppet(ch, p); } catch (e) { console.error('[platform] rig.createPuppet', e); }
    }
    var fp = new FallbackPuppet(ch, p);
    fp.setAnim = function () {};
    return fp;
  };

  // ---------------------------------------------------------------- logo / banners
  function bigText(lines, o) {   // lines: [{ text, size, scale, color, outline }]
    var w = 0, h = 0;
    lines.forEach(function (l) { var m = LC.font.measure(l.text, { size: l.size, scale: l.scale }); l.m = m; w = Math.max(w, m.w); h += m.h + (l.gap || 2); });
    var cv = ui.canvas(w + 8, h + 8), c = cv.getContext('2d'), y = 3;
    lines.forEach(function (l) {
      LC.font.draw(c, l.text, (w + 8) >> 1, y, { size: l.size, scale: l.scale, color: l.color, outline: l.outline, shadow: l.shadow, align: 'center', spacing: l.spacing || 0 });
      y += l.m.h + (l.gap || 2);
    });
    return cv;
  }
  ui.logo = function () {
    if (cache.logo) return cache.logo;
    var cv = null;
    if (LC.illust && LC.illust.logo) { try { cv = LC.illust.logo(); } catch (e) { console.error('[platform] illust.logo', e); } }
    if (cv && ui.isBlank(cv)) cv = null;
    if (!cv) {
      cv = bigText([
        { text: LC.TITLE_ZH, size: 12, scale: 3, color: '#fff3e0', outline: '#7e3830', shadow: U.black, gap: 4 },
        { text: LC.TITLE_EN, size: 8, scale: 2, color: U.gold, outline: U.black, spacing: 1 }
      ]);
    }
    cache.logo = cv;
    return cv;
  };
  var BANNER_TEXT = { vs: 'VS', ko: 'K.O.', fight: 'FIGHT!', perfect: 'PERFECT', timeup: 'TIME UP', draw: 'DRAW', youWin: 'YOU WIN', youLose: 'YOU LOSE', p1Win: '1P WIN', p2Win: '2P WIN', ready: 'READY' };
  ui.banner = function (name) {
    var key = 'banner.' + name;
    if (cache[key] !== undefined) return cache[key];
    var cv = null;
    if (LC.illust && LC.illust.banner) { try { cv = LC.illust.banner(name); } catch (e) { console.error('[platform] illust.banner', e); } }
    if (cv && ui.isBlank(cv)) cv = null;
    if (!cv) cv = bigText([{ text: BANNER_TEXT[name] || name, size: 8, scale: name === 'vs' ? 5 : 3, color: U.gold, outline: '#7e3830', shadow: U.black }]);
    cache[key] = cv;
    return cv;
  };
  ui.clearArtCache = function () { cache = {}; if (ui.clearIconCache) ui.clearIconCache(); };
  // Darkened copy of a canvas (for figures standing in the background).
  var tintCache = new WeakMap();
  ui.tint = function (src, col, a) {
    var m = tintCache.get(src); if (!m) { m = {}; tintCache.set(src, m); }
    var k = col + a;
    if (m[k]) return m[k];
    var cv = ui.canvas(src.width, src.height), c = cv.getContext('2d');
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'source-atop'; c.globalAlpha = a; c.fillStyle = col; c.fillRect(0, 0, cv.width, cv.height);
    m[k] = cv;
    return cv;
  };
})();
