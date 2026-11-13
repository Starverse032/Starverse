/* LATENT CLASH — ILLUST public API (contract §5.5). Everything is generated lazily and cached;
 * init() pre-builds the lot so nothing is generated mid-match. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var I = LC.illust = LC.illust || {};
  var K = I.kit;
  I.ART = I.ART || {};

  var KINDS = { face: [24, 24], bust: [112, 128], bustWin: [112, 128], bustLose: [112, 128], cutin: [240, 72] };
  var pics = {}, canv = {}, tables = {};
  var warned = {};
  function warn(msg) { if (!warned[msg]) { warned[msg] = 1; console.error('[illust] ' + msg); } }

  function table(charId, pal) {
    var k = charId + pal;
    return tables[k] || (tables[k] = K.slotColors(charId, pal));
  }
  // indexed picture (palette independent) for a portrait kind
  I.portraitPic = function (charId, kind, opts) {
    var k = charId + ':' + kind + (opts ? JSON.stringify(opts) : '');
    if (pics[k]) return pics[k];
    var art = I.ART[charId];
    if (!art || !art[kind]) return null;
    return (pics[k] = art[kind](opts || {}));
  };
  function blank(w, h) { return K.canvas(w, h); }

  I.portrait = function (charId, kind, palette) {
    palette = palette | 0;
    if (!KINDS[kind]) { warn('unknown portrait kind ' + kind); kind = 'bust'; }
    if (!LC.PAL[charId]) { warn('unknown character ' + charId); return blank(KINDS[kind][0], KINDS[kind][1]); }
    if (palette < 0 || palette >= LC.PAL[charId].length) palette = 0;
    var k = charId + ':' + kind + ':' + palette;
    if (canv[k]) return canv[k];
    var p = I.portraitPic(charId, kind);
    if (!p) { warn('no art for ' + charId + ' ' + kind); return blank(KINDS[kind][0], KINDS[kind][1]); }
    return (canv[k] = p.canvas(table(charId, palette)));
  };
  // render an indexed picture with a palette (used by title art)
  I.render = function (charId, pic, palette, flip) { return pic.canvas(table(charId, palette | 0), flip); };

  I.logo = function () {
    if (!I.LOGO) { warn('logo missing'); return blank(240, 90); }
    return canv.logo || (canv.logo = I.LOGO.build());
  };
  I.BANNERS = ['round1', 'round2', 'round3', 'finalRound', 'fight', 'ko', 'perfect', 'timeup', 'doubleKo', 'draw',
    'youWin', 'youLose', 'p1Win', 'p2Win', 'vs', 'counter', 'ready'];
  I.banner = function (name) {
    var k = 'banner:' + name;
    if (canv[k]) return canv[k];
    if (!I.TYPE || I.BANNERS.indexOf(name) < 0) { warn('unknown banner ' + name); return blank(16, 16); }
    return (canv[k] = I.TYPE.banner(name));
  };
  I.ICONS = ['btn.L', 'btn.M', 'btn.H', 'btn.S', 'dir.1', 'dir.2', 'dir.3', 'dir.4', 'dir.5', 'dir.6', 'dir.7', 'dir.8', 'dir.9',
    'emblem.claude', 'emblem.deepseek', 'emblem.claude.lg', 'emblem.deepseek.lg', 'pip.on', 'pip.off', 'cursor', 'lock',
    'keyboard', 'gamepad', 'touch', 'p1', 'p2', 'cpu'];
  I.icon = function (name) {
    var k = 'icon:' + name;
    if (canv[k]) return canv[k];
    var c = I.ICON && I.ICON.build(name);
    if (!c) { warn('unknown icon ' + name); return blank(12, 12); }
    return (canv[k] = c);
  };
  I.drawTitle = function (ctx, t) {
    if (!I.TITLE) { ctx.fillStyle = LC.UI.bg0; ctx.fillRect(0, 0, LC.W, LC.H); return; }
    I.TITLE.draw(ctx, t | 0);
  };
  I.names = function () {
    return { portraits: Object.keys(KINDS), banners: I.BANNERS.slice(), icons: I.ICONS.slice() };
  };
  I.version = '1.0';

  I.init = function () {
    var t0 = (window.performance || Date).now();
    try {
      LC.CHARS.forEach(function (c) {
        Object.keys(KINDS).forEach(function (kind) { for (var p = 0; p < LC.PAL[c].length; p++) I.portrait(c, kind, p); });
      });
      I.logo();
      I.BANNERS.forEach(function (b) { I.banner(b); });
      I.ICONS.forEach(function (n) { I.icon(n); });
      if (I.TITLE) I.TITLE.init();
    } catch (e) { console.error('[illust] init failed', e); }
    I.initMs = (window.performance || Date).now() - t0;
    return Promise.resolve();
  };
})();
