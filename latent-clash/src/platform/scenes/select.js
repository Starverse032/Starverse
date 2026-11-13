/* LATENT CLASH — character select (PLATFORM).
 * Busts (LC.illust) slide in per cursor, live idle puppets (LC.rig), stats + bio pages from
 * LC.LORE, palette switch (↑↓), P1 / P2 / CPU cursors, lock-in flourish.
 * params: { mode: 'arcade'|'versus'|'training', vs: 'pvc'|'pvp'|'cvc' } */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H, ui = LC.ui, LORE = LC.LORE;
  var CH = LC.CHARS;
  var STATS = [['power', '力量'], ['speed', '速度'], ['range', '射程'], ['technique', '技巧']];
  var MODE_TAG = { arcade: '街机模式', versus: '对战', training: '训练' };

  function Side(i, ch, pal) {
    this.i = i; this.cur = CH.indexOf(ch); this.pal = pal || 0; this.locked = false; this.active = i === 0;
    this.slide = 0; this.flash = 0; this.lockT = 0; this.puppets = {}; this.bioT = 0; this.moveT = 0;
  }
  Side.prototype.ch = function () { return CH[this.cur]; };
  Side.prototype.puppet = function () {
    var k = this.ch() + this.pal;
    if (!this.puppets[k]) this.puppets[k] = ui.puppet(this.ch(), this.pal);
    return this.puppets[k];
  };

  LC.scenes.define('select', function (params) {
    var mode = params.mode || 'versus', vs = params.vs || (mode === 'versus' ? 'pvc' : 'pvc');
    var prev = (LC.app.lastPick && LC.app.lastPick[mode + vs]) || null;
    var sides = [new Side(0, prev ? prev[0].char : 'claude', prev ? prev[0].palette : 0), new Side(1, prev ? prev[1].char : 'deepseek', prev ? prev[1].palette : 0)];
    var twoSided = mode !== 'arcade';
    var pvp = vs === 'pvp' && mode === 'versus';
    if (pvp) sides[1].active = true;
    var doneT = -1, leaving = false;
    var lastMoved = 0;

    function controlOf(i) {
      if (mode === 'arcade') return i === 0 ? 'human' : 'cpu';
      if (mode === 'training') return i === 0 ? 'human' : 'cpu';
      if (vs === 'pvp') return 'human';
      if (vs === 'cvc') return 'cpu';
      return i === 0 ? 'human' : 'cpu';
    }
    function tagOf(i) { return controlOf(i) === 'cpu' ? 'CPU' : (i === 0 ? '1P' : '2P'); }
    function palFor(i) {
      var s = sides[i], o = sides[1 - i];
      if (twoSided && i === 1 && o.locked && o.ch() === s.ch() && o.pal === s.pal) return 1 - s.pal;
      return s.pal;
    }
    function lock(s) {
      s.locked = true; s.lockT = 0; s.flash = 16;
      s.pal = palFor(s.i);
      ui.sfx('ui.lock');
      if (LC.audio && LC.audio.voice) { try { LC.audio.voice(s.ch(), 'intro'); } catch (e) { console.error('[platform] audio.voice', e); } }
      var p = s.puppet(); if (p.setAnim) p.setAnim('win', s.anim || 0);
      if (!pvp && s.i === 0 && twoSided) { sides[1].active = true; sides[1].slide = 0; }
    }
    function allLocked() { return sides[0].locked && (!twoSided || sides[1].locked); }
    function proceed() {
      leaving = true;
      var picks = sides.map(function (s, i) { return { char: s.ch(), palette: palFor(i), control: controlOf(i), level: LC.settings.difficulty }; });
      LC.app.lastPick = LC.app.lastPick || {};
      LC.app.lastPick[mode + vs] = picks;
      if (mode === 'arcade') {
        LC.app.newArcade(picks[0].char, picks[0].palette);
        LC.scenes.go('ladder', {}, { transition: 'slash' });
        return;
      }
      LC.app.session = { mode: mode, vs: vs, sides: picks };
      LC.scenes.go('stage', { mode: mode }, { transition: 'wipe' });
    }

    function handle(s, m) {
      if (leaving) return;
      if (s.locked) {
        if (m.cancel) {
          // in single-controller modes, cancelling on side 1 unlocks side 0 first
          s.locked = false; ui.sfx('ui.cancel');
          var p = s.puppet(); if (p.setAnim) p.setAnim('idle', 0);
          if (!pvp && s.i === 0) sides[1].active = false;
        }
        return;
      }
      if (m.left || m.right) {
        s.cur = (s.cur + (m.right ? 1 : CH.length - 1)) % CH.length; s.slide = 0; s.bioT = 0; s.moveT = 0;
        lastMoved = s.i; ui.sfx('ui.move');
      } else if (m.up || m.down) {
        s.pal = 1 - s.pal; s.flash = 6; ui.sfx('ui.move', { pitch: 1.2 }); lastMoved = s.i;
      } else if (m.ok) lock(s);
      else if (m.cancel) {
        if (s.i === 1 && !pvp) { sides[1].active = false; sides[0].locked = false; ui.sfx('ui.cancel'); var p0 = sides[0].puppet(); if (p0.setAnim) p0.setAnim('idle', 0); }
        else if (!pvp || s.i === 0) { ui.sfx('ui.cancel'); leaving = true; LC.scenes.go('menu', {}, { transition: 'wipe' }); }
      }
    }

    function pointer() {
      var p = LC.input.pointer;
      if (!p.pressed) return;
      // tiles
      for (var k = 0; k < CH.length; k++) {
        var tx = 150 + k * 46, ty = 26;
        if (p.x >= tx && p.x < tx + 40 && p.y >= ty && p.y < ty + 40) {
          var s = !sides[0].locked ? sides[0] : (twoSided && sides[1].active && !sides[1].locked ? sides[1] : null);
          if (!s) return;
          if (s.cur !== k) { s.cur = k; s.slide = 0; s.bioT = 0; ui.sfx('ui.move'); }
          else lock(s);
          return;
        }
      }
      if (allLocked()) proceed();
    }

    return {
      music: 'select',
      enter: function () { LC.input.setMode(pvp ? 'duo' : 'solo'); },
      update: function () {
        var t = this.t;
        sides.forEach(function (s) {
          s.slide++; s.bioT++; s.moveT++;
          if (s.flash) s.flash--;
          if (s.locked) s.lockT++;
          var p = s.puppet();
          p.tick(t, { x: 0, y: LC.GROUND_Y, vx: 0, vy: 0, facing: s.i ? -1 : 1, grounded: true });
        });
        if (leaving) return;
        if (pvp) { handle(sides[0], LC.input.menuFor(0)); handle(sides[1], LC.input.menuFor(1)); }
        else if (twoSided && sides[1].active && sides[0].locked) handle(sides[1], LC.input.menu);
        else handle(sides[0], LC.input.menu);
        pointer();
        if (allLocked()) {
          if (doneT < 0) doneT = 0;
          doneT++;
          if (doneT > 50 || (doneT > 12 && LC.input.menu.ok)) { ui.sfx('ui.confirm'); proceed(); }
        } else doneT = -1;
      },
      draw: function (c) {
        var t = this.t;
        var accL = ui.charCol(sides[0].ch(), sides[0].pal).ui;
        ui.backdrop(c, t, { accent: accL, speed: 0.5 });
        // side colour wedges
        [0, 1].forEach(function (i) {
          var s = sides[i];
          if (i === 1 && !twoSided) return;
          var col = ui.charCol(s.ch(), palFor(i));
          c.globalAlpha = 0.16;
          for (var y = 20; y < 146; y += 2) {
            var w = 120 + Math.round((y - 20) * 0.22);
            ui.box(c, i ? W - w : 0, y, w, 1, col.ui);
          }
          c.globalAlpha = 1;
        });
        // busts
        sides.forEach(function (s, i) {
          var ch = s.ch(), pal = palFor(i);
          if (i === 1 && !twoSided) {
            // arcade: mystery challenger
            var b0 = ui.portrait(LC.app.other(ch), 'bust', 0);
            if (b0) c.drawImage(ui.tint(ui.flip(b0), '#0b0a14', 0.86), W - 112, 22);
            LC.font.draw(c, '???', W - 56, 78, { size: 8, scale: 2, color: '#3b3670', align: 'center' });
            return;
          }
          if (i === 1 && !s.active && !pvp) { var bb = ui.portrait(ch, 'bust', pal); if (bb) c.drawImage(ui.tint(ui.flip(bb), '#0b0a14', 0.7), W - 112, 22); return; }
          var kind = s.locked ? 'bustWin' : 'bust';
          var b = ui.portrait(ch, kind, pal) || ui.portrait(ch, 'bust', pal);
          if (!b) return;
          if (i === 1) b = ui.flip(b);
          var e = ui.ease.out(s.slide / 14);
          var dx = Math.round((1 - e) * (i ? 40 : -40));
          var shake = s.flash > 8 ? ((s.flash & 2) ? 1 : -1) : 0;
          var bx = (i ? W - 112 : 0) + dx + shake;
          c.globalAlpha = Math.min(1, 0.3 + e);
          c.drawImage(b, bx, 22);
          c.globalAlpha = 1;
          if (s.flash > 8 && s.locked) { c.globalAlpha = (s.flash - 8) / 8 * 0.8; c.drawImage(ui.silhouette(b, '#ffffff'), bx, 22); c.globalAlpha = 1; }
        });
        ui.header(c, '选择角色', 'CHARACTER SELECT', t, accL);
        LC.font.draw(c, MODE_TAG[mode] + (mode === 'versus' ? ' · ' + { pvc: '玩家 vs CPU', pvp: '玩家 vs 玩家', cvc: 'CPU vs CPU' }[vs] : ''), W >> 1, 5, { size: 10, color: U.gold, align: 'center' });
        // tiles
        CH.forEach(function (ch, k) {
          var tx = 150 + k * 46, ty = 26;
          var hov0 = sides[0].cur === k, hov1 = twoSided && sides[1].active && sides[1].cur === k;
          ui.box(c, tx - 1, ty - 1, 42, 42, U.black);
          ui.box(c, tx, ty, 40, 40, ui.charCol(ch, 0).dark);
          var b = ui.portrait(ch, 'bust', 0);
          if (b) c.drawImage(b, 36, 22, 40, 40, tx, ty, 40, 40);
          if (!hov0 && !hov1) { c.globalAlpha = 0.45; ui.box(c, tx, ty, 40, 40, U.bg0); c.globalAlpha = 1; }
          LC.font.draw(c, LORE.chars[ch].name, tx + 20, ty + 32, { size: 8, color: U.text, outline: U.black, align: 'center' });
        });
        // cursors
        sides.forEach(function (s, i) {
          if (i === 1 && (!twoSided || !s.active)) return;
          var tx = 150 + s.cur * 46, ty = 26;
          var col = i === 0 ? U.gold : (tagOf(1) === 'CPU' ? '#9b96b8' : '#58d4ff');
          var pulse = s.locked ? 0 : ((t >> 3) & 1);
          var g = 2 + pulse;
          c.fillStyle = col;
          // corner brackets
          [[-g, -g, 1, 1], [40 + g - 6, -g, -1, 1], [-g, 40 + g - 1, 1, -1], [40 + g - 6, 40 + g - 1, -1, -1]].forEach(function (q) {
            var x = tx + q[0], y = ty + q[1];
            c.fillRect(x + (q[2] < 0 ? 0 : 0), y, 6, 2);
            c.fillRect(q[2] > 0 ? x : x + 4, q[3] > 0 ? y : y - 4, 2, 6);
          });
          var tag = tagOf(i), tw = LC.font.measure(tag, { size: 8 }).w + 6;
          var tagX = i === 0 ? tx - 2 : tx + 42 - tw, tagY = i === 0 ? ty - 9 : ty + 43;
          if (i === 1 && sides[0].cur === s.cur) tagX = tx + 42 - tw;
          ui.box(c, tagX, tagY, tw, 9, col);
          LC.font.draw(c, tag, tagX + 3, tagY + 1, { size: 8, color: U.bg0 });
          if (s.locked) { var ic = ui.icon('lock'); if (ic) c.drawImage(ic, i ? tx + 2 : tx + 40 - ic.width - 2, ty + 2); }
        });
        // puppets
        sides.forEach(function (s, i) {
          if (i === 1 && (!twoSided || (!s.active && !pvp))) return;
          var p = s.puppet();
          var x = i ? 230 : 154, y = 146;
          ui.box(c, x - 14, y, 28, 2, 'rgba(5,4,10,0.6)');
          try { p.draw(c, x, y, { facing: i ? -1 : 1 }); } catch (e) { console.error('[platform] puppet.draw', e); }
        });
        // info panels
        sides.forEach(function (s, i) {
          var px = i ? 196 : 4, py = 148, pw = 184, ph = 52;
          if (i === 1 && !twoSided) {
            ui.panel(c, px, py, pw, ph, {});
            LC.font.draw(c, '挑战者', px + 8, py + 6, { size: 12, color: U.dim });
            LC.font.draw(c, 'NEXT CHALLENGER', px + 8, py + 22, { size: 8, color: '#4f4a78' });
            LC.font.draw(c, '击败三位对手，抵达潜空间。', px + 8, py + 34, { size: 10, color: '#4f4a78' });
            return;
          }
          var ch = s.ch(), L = LORE.chars[ch], col = ui.charCol(ch, palFor(i));
          var dim = i === 1 && !s.active && !pvp;
          ui.panel(c, px, py, pw, ph, { accent: dim ? null : col.ui, accentW: 30 });
          var nx = px + 8;
          var nw = LC.font.draw(c, L.nameZh, nx, py + 5, { size: 12, color: dim ? U.dim : col.light, shadow: U.black });
          LC.font.draw(c, L.title, nx + nw + 6, py + 7, { size: 10, color: U.dim });
          // palette tag
          var pn = L.palNames[palFor(i)];
          LC.font.draw(c, pn, px + pw - 8, py + 7, { size: 10, color: U.gold, align: 'right' });
          var page = Math.floor(s.bioT / 300) % 2;
          if (page === 0) {
            STATS.forEach(function (st, k) {
              var sx = px + 8 + (k % 2) * 88, sy = py + 21 + Math.floor(k / 2) * 13;
              LC.font.draw(c, st[1], sx, sy, { size: 10, color: U.dim });
              ui.bar(c, sx + 24, sy + 3, 54, 4, L.stats[st[0]], 5, col.ui, { seg: true });
            });
          } else {
            var lines = LC.font.wrap(L.bio, pw - 16, { size: 10 });
            var off = Math.min(Math.max(0, lines.length - 2), Math.floor(((s.bioT % 300)) / 110));
            LC.font.draw(c, lines.slice(off, off + 2).join('\n'), px + 8, py + 21, { size: 10, color: U.text, lineGap: 3 });
          }
          if (s.locked) {
            var a = ui.ease.back(s.lockT / 12);
            LC.font.draw(c, 'OK!', px + pw - 10, py + ph - 14 - Math.round((1 - a) * 6), { size: 8, scale: 1, color: U.green, outline: U.black, align: 'right' });
          }
        });
        // ready banner
        if (doneT > 0) {
          var r = ui.ease.back(doneT / 12);
          var bw = Math.round(160 * r);
          ui.box(c, (W - bw) >> 1, 96, bw, 22, 'rgba(5,4,10,0.85)');
          ui.box(c, (W - bw) >> 1, 96, bw, 1, U.gold); ui.box(c, (W - bw) >> 1, 117, bw, 1, U.gold);
          if (r > 0.8) LC.font.draw(c, '准备完毕！', W >> 1, 101, { size: 12, color: U.gold, align: 'center', outline: U.black });
        }
        var hints = [['L', '决定'], ['M', '返回'], ['←→', '角色'], ['↑↓', '换色']];
        ui.hints(c, hints, { y: H - 13 });
      }
    };
  });
})();
