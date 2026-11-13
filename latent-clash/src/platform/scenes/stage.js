/* LATENT CLASH — stage select (PLATFORM). Thumbnails (st.thumb), live 1:1 preview window of the
 * actual stage (drawBack/drawFront into an offscreen canvas, cropped), names + descriptions,
 * random option. Fallback art when LC.stages is missing. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H, ui = LC.ui, LORE = LC.LORE;
  var TINT = { library: '#d97757', abyss: '#2bb8f0', latent: '#b06bff', training: '#5ee6a8' };

  function fallbackArt(id, w, h, t) {
    var cv = ui.canvas(w, h), c = cv.getContext('2d'), col = TINT[id] || '#5a5499';
    for (var y = 0; y < h; y++) { c.fillStyle = ui.mix('#0b0a14', col, 0.12 + 0.25 * (y / h)); c.fillRect(0, y, w, 1); }
    var hz = (h * 0.62) | 0;
    c.fillStyle = ui.mix('#0b0a14', col, 0.5); c.fillRect(0, hz, w, 1);
    for (var i = -8; i <= 8; i++) ui.line(c, (w >> 1) + i * 4, hz, (w >> 1) + i * 20, h, ui.mix('#0b0a14', col, 0.3));
    var name = (LORE.stages[id] || {}).zh || id;
    LC.font.draw(c, name, w >> 1, (hz >> 1) - 6, { size: 12, color: ui.mix(col, '#ffffff', 0.5), align: 'center', shadow: U.black });
    return cv;
  }

  LC.scenes.define('stage', function (params) {
    var mode = params.mode || (LC.app.session && LC.app.session.mode) || 'versus';
    var ids = LC.app.stageIds();
    var items = ids.concat(['random']);
    var inst = {}, thumbs = {};
    var big = ui.canvas(W, H), bc = big.getContext('2d');
    var idx = Math.max(0, ids.indexOf(mode === 'training' ? 'training' : (LC.app.lastStage || ids[0])));
    var prevT = 0, chosen = -1, chosenT = 0, randomRoll = 0;

    function stage(id) {
      if (inst[id] !== undefined) return inst[id];
      inst[id] = null;
      if (LC.stages && LC.stages.create) {
        try { inst[id] = LC.stages.create(id); } catch (e) { console.error('[platform] stages.create ' + id, e); }
      }
      return inst[id];
    }
    function thumb(id) {
      if (thumbs[id]) return thumbs[id];
      var st = stage(id), th = st && st.thumb;
      if (!th || ui.isBlank(th)) th = fallbackArt(id, 96, 54);
      return (thumbs[id] = th);
    }
    function rect(k) {
      if (k === items.length - 1) return { x: 10, y: 150, w: 198, h: 18 };
      return { x: 10 + (k % 2) * 102, y: 28 + Math.floor(k / 2) * 60, w: 96, h: 54 };
    }
    function go() {
      var id = items[idx];
      if (id === 'random') id = ids[(Math.random() * ids.length) | 0];
      LC.app.lastStage = id;
      var S = LC.app.session || { mode: mode, sides: [{ char: 'claude' }, { char: 'deepseek' }] };
      var cfg = LC.app.matchConfig({ mode: mode, p1: S.sides[0], p2: S.sides[1], stage: id });
      if (LC.app.session) LC.app.session.lastConfig = cfg;
      if (mode === 'training') LC.scenes.go('match', { config: cfg }, { transition: 'iris' });
      else LC.scenes.go('vs', { config: cfg }, { transition: 'slash' });
    }
    function move(dx, dy) {
      var n = items.length, k = idx;
      if (k === n - 1) { if (dy < 0) k = n - 3 + (ids.length % 2 ? 1 : 0); }
      else {
        var col = k % 2, row = Math.floor(k / 2);
        if (dx) { var nk = row * 2 + (1 - col); if (nk < n - 1) k = nk; }
        if (dy) { var r2 = row + dy; var nk2 = r2 * 2 + col; if (r2 < 0) nk2 = n - 1; k = nk2 >= n - 1 ? n - 1 : nk2; }
      }
      if (k !== idx) { idx = k; prevT = 0; ui.sfx('ui.move'); }
    }

    return {
      music: 'select',
      update: function () {
        prevT++;
        var id = items[idx];
        var st = id !== 'random' ? stage(id) : null;
        if (st && st.update) { try { st.update(); } catch (e) { console.error('[platform] stage.update', e); } }
        if (chosen >= 0) { chosenT++; if (items[idx] === 'random' && chosenT % 4 === 0) randomRoll++; if (chosenT === 26) go(); return; }
        var m = LC.input.menu;
        if (m.left) move(-1, 0); else if (m.right) move(1, 0); else if (m.up) move(0, -1); else if (m.down) move(0, 1);
        else if (m.ok) { chosen = idx; ui.sfx('ui.confirm'); }
        else if (m.cancel) { ui.sfx('ui.cancel'); LC.scenes.go('select', { mode: mode, vs: LC.app.session && LC.app.session.vs }, { transition: 'wipe' }); }
        var p = LC.input.pointer;
        if (p.pressed) for (var k = 0; k < items.length; k++) {
          var r = rect(k);
          if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
            if (k === idx) { chosen = idx; ui.sfx('ui.confirm'); } else { idx = k; prevT = 0; ui.sfx('ui.move'); }
          }
        }
      },
      draw: function (c) {
        var t = this.t, id = items[idx];
        var showId = id === 'random' ? ids[(Math.floor(t / 8) + randomRoll) % ids.length] : id;
        ui.backdrop(c, t, { accent: TINT[showId] || U.gold, speed: 0.3 });
        ui.header(c, '选择场景', 'STAGE SELECT', t, TINT[showId]);
        // thumbnails
        items.forEach(function (sid, k) {
          var r = rect(k), sel = k === idx;
          var a = ui.ease.out((t - k * 3) / 12);
          var oy = Math.round((1 - a) * 12);
          ui.box(c, r.x - 1, r.y - 1 + oy, r.w + 2, r.h + 2, sel ? (chosen >= 0 && (chosenT & 2) ? '#ffffff' : U.gold) : U.black);
          if (sid === 'random') {
            ui.box(c, r.x, r.y + oy, r.w, r.h, sel ? U.bg2 : U.bg1);
            LC.font.draw(c, '？ 随机场景', r.x + 8, r.y + 3 + oy, { size: 12, color: sel ? U.text : U.dim });
            LC.font.draw(c, 'RANDOM', r.x + r.w - 6, r.y + 6 + oy, { size: 8, color: sel ? U.gold : '#4f4a78', align: 'right' });
            return;
          }
          c.drawImage(thumb(sid), r.x, r.y + oy);
          if (!sel) { c.globalAlpha = 0.45; ui.box(c, r.x, r.y + oy, r.w, r.h, U.bg0); c.globalAlpha = 1; }
          ui.box(c, r.x, r.y + r.h - 11 + oy, r.w, 11, 'rgba(5,4,10,0.7)');
          LC.font.draw(c, LORE.stages[sid] ? LORE.stages[sid].zh : sid, r.x + 4, r.y + r.h - 11 + oy, { size: 10, color: sel ? U.text : U.dim });
        });
        // live preview
        var px = 216, py = 28, pw = 160, ph = 90;
        ui.box(c, px - 2, py - 2, pw + 4, ph + 4, U.black);
        ui.box(c, px - 1, py - 1, pw + 2, ph + 2, U.line);
        var st = stage(showId);
        var drawn = false;
        if (st && st.drawBack) {
          try {
            var cam = Math.round(128 + Math.sin(t * 0.008) * 110);
            bc.setTransform(1, 0, 0, 1, 0, 0);
            bc.fillStyle = '#000'; bc.fillRect(0, 0, W, H);
            st.drawBack(bc, cam);
            if (st.drawFront) st.drawFront(bc, cam);
            c.drawImage(big, 112, 92, pw, ph, px, py, pw, ph);
            drawn = true;
          } catch (e) { console.error('[platform] stage preview', e); }
        }
        if (!drawn) c.drawImage(fallbackArt(showId, pw, ph), px, py);
        if (id === 'random') { c.globalAlpha = 0.6; ui.box(c, px, py, pw, ph, U.bg0); c.globalAlpha = 1; LC.font.draw(c, '?', px + pw / 2, py + 30, { size: 12, scale: 2, color: U.gold, align: 'center', outline: U.black }); }
        // wipe-in on change
        var wp = 1 - ui.ease.out(prevT / 10);
        if (wp > 0) ui.box(c, px, py, Math.round(pw * wp), ph, U.bg0);
        // info
        var info = id === 'random' ? { zh: '随机场景', en: 'RANDOM STAGE', desc: '由潜空间决定战场。' } : (LORE.stages[id] || { zh: id, en: id, desc: '' });
        ui.panel(c, px - 4, 124, pw + 8, 66, { accent: TINT[showId] });
        LC.font.draw(c, info.zh, px + 4, 129, { size: 12, color: U.text, shadow: U.black });
        LC.font.draw(c, info.en, px + pw - 2, 132, { size: 8, color: U.dim, align: 'right' });
        var lines = LC.font.wrap(info.desc || '', pw - 4, { size: 10 });
        LC.font.draw(c, lines.slice(0, 2).join('\n'), px + 4, 146, { size: 10, color: U.dim, lineGap: 3 });
        if (info.home) LC.font.draw(c, LORE.chars[info.home].nameZh + '的主场', px + 4, 174, { size: 10, color: ui.charCol(info.home, 0).light });
        ui.hints(c, [['L', '决定'], ['M', '返回'], ['↑↓←→', '选择']], { y: H - 13 });
      }
    };
  });
})();
