/* LATENT CLASH — options, key config, credits (PLATFORM). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H, ui = LC.ui, LORE = LC.LORE, S = LC.settings;

  function save() { LC.save.saveSettings(); }
  function vol(kind) {
    return {
      label: { master: '主音量', music: '音乐', sfx: '音效' }[kind],
      value: function () { var n = Math.round(S[kind] * 10); return '■'.repeat(n) + '□'.repeat(10 - n) + ' ' + String(n * 10).padStart(3, ' ') + '%'; },
      adjust: function (d) {
        S[kind] = Math.max(0, Math.min(1, Math.round(S[kind] * 10 + d) / 10));
        if (LC.audio && LC.audio.setVolume && !LC.app.muted) { try { LC.audio.setVolume(kind, S[kind]); } catch (e) { console.error('[platform] setVolume', e); } }
        if (kind !== 'music') ui.sfx(kind === 'sfx' ? 'hit.medium' : 'ui.confirm');
        save();
      }
    };
  }
  function cycle(key, label, vals, names, after) {
    return {
      label: label,
      value: function () { var i = vals.indexOf(S[key]); return names[i < 0 ? 0 : i]; },
      adjust: function (d) { var i = Math.max(0, vals.indexOf(S[key])); S[key] = vals[(i + d + vals.length) % vals.length]; save(); if (after) after(); }
    };
  }

  LC.scenes.define('options', function () {
    var confirmReset = 0;
    var items = [
      vol('master'), vol('music'), vol('sfx'),
      cycle('difficulty', 'CPU 难度', [1, 2, 3, 4, 5], ['★☆☆☆☆ 入门', '★★☆☆☆ 简单', '★★★☆☆ 普通', '★★★★☆ 困难', '★★★★★ 极限']),
      cycle('rounds', '胜利回合', [1, 2, 3], ['一局定胜负', '三局两胜', '五局三胜']),
      cycle('time', '回合时间', [30, 60, 99, 0], ['30 秒', '60 秒', '99 秒', '无限']),
      cycle('shake', '画面震动', [true, false], ['开', '关']),
      cycle('flash', '闪光效果', [true, false], ['正常', '减弱']),
      cycle('crt', 'CRT 滤镜', [false, true], ['关', '开'], function () { LC.display.refreshCrt(); }),
      cycle('touch', '触屏按键', ['auto', 'on', 'off'], ['自动', '显示', '隐藏'], function () { LC.display.relayout(); }),
      cycle('showFps', '帧率显示', [false, true], ['关', '开']),
      { id: 'keys', label: '按键设置', action: true },
      { id: 'reset', label: '重置存档', action: true },
      { id: 'back', label: '返回', action: true }
    ];
    if (LC.display.fullscreenAvailable()) items.splice(11, 0, { id: 'fs', label: '全屏切换', action: true });
    var menu = new ui.Menu(items, { x: 40, y: 25, w: 304, itemH: 12, size: 12 });
    return {
      music: 'select',
      update: function () {
        if (confirmReset) confirmReset--;
        var r = menu.update();
        if (!r) return;
        if (r.type === 'cancel') { save(); LC.scenes.go('menu', {}, { transition: 'wipe' }); return; }
        if (r.type !== 'ok') return;
        var id = r.item.id;
        if (id === 'back') { save(); LC.scenes.go('menu', {}, { transition: 'wipe' }); }
        else if (id === 'keys') LC.scenes.go('keys', {}, { transition: 'wipe' });
        else if (id === 'fs') LC.display.toggleFullscreen();
        else if (id === 'reset') {
          if (!confirmReset) { confirmReset = 150; ui.toast('再按一次确认重置全部存档'); return; }
          LC.save.clearAll(); LC.save.resetSettings(); LC.input.resetKeys();
          LC.display.refreshCrt(); LC.display.relayout();
          if (LC.audio && LC.audio.setVolume) { try { ['master', 'music', 'sfx'].forEach(function (k) { LC.audio.setVolume(k, S[k]); }); } catch (e) { /* ignore */ } }
          confirmReset = 0; ui.toast('存档已重置');
        }
      },
      draw: function (c) {
        var t = this.t;
        ui.backdrop(c, t, { speed: 0.25 });
        ui.header(c, '设置', 'OPTIONS', t);
        ui.panel(c, 28, 23, 328, items.length * 12 + 5, {});
        menu.o.appear = t + 30;
        menu.draw(c, t);
        ui.hints(c, [['←→', '调整'], ['L', '决定'], ['M', '返回']], { y: H - 12, align: 'right' });
      }
    };
  });

  // ---------------------------------------------------------------- key config
  var ACT = [['up', '上'], ['down', '下'], ['left', '左'], ['right', '右'], ['L', '轻 L'], ['M', '中 M'], ['H', '重 H'], ['S', '特 S'], ['throw', '投 (轻+中)'], ['super', '超 (重+特)']];
  LC.scenes.define('keys', function () {
    var row = 0, col = 0, capture = false, flash = 0;
    var ROWS = ACT.length + 2;   // + reset + back
    function startCapture() {
      capture = true; ui.sfx('ui.confirm');
      LC.input.captureNext(function (code) {
        capture = false;
        if (code === 'Escape') { ui.sfx('ui.cancel'); return; }
        LC.input.bind(col, ACT[row][0], code); flash = 20; ui.sfx('ui.lock');
      });
    }
    return {
      music: 'select',
      exit: function () { LC.input.cancelCapture(); },
      update: function () {
        if (flash) flash--;
        if (capture) return;
        var m = LC.input.menu;
        if (m.up) { row = (row + ROWS - 1) % ROWS; ui.sfx('ui.move'); }
        else if (m.down) { row = (row + 1) % ROWS; ui.sfx('ui.move'); }
        else if ((m.left || m.right) && row < ACT.length) { col ^= 1; ui.sfx('ui.move'); }
        else if (m.ok) {
          if (row < ACT.length) startCapture();
          else if (row === ACT.length) { LC.input.resetKeys(); ui.sfx('ui.confirm'); ui.toast('已恢复默认按键'); }
          else { ui.sfx('ui.cancel'); LC.scenes.go('options', {}, { transition: 'wipe' }); }
        } else if (m.cancel) { ui.sfx('ui.cancel'); LC.scenes.go('options', {}, { transition: 'wipe' }); }
      },
      draw: function (c) {
        var t = this.t, K = LC.input.keys, kn = LC.input.keyName;
        ui.backdrop(c, t, { speed: 0.25 });
        ui.header(c, '按键设置', 'KEY CONFIG', t);
        ui.panel(c, 40, 24, 304, 172, {});
        LC.font.draw(c, '1P', 196, 28, { size: 8, color: U.gold, align: 'center' });
        LC.font.draw(c, '2P（双人）', 286, 27, { size: 10, color: '#58d4ff', align: 'center' });
        for (var r = 0; r < ROWS; r++) {
          var y = 40 + r * 13, sel = r === row;
          if (r < ACT.length) {
            LC.font.draw(c, ACT[r][1], 54, y, { size: 12, color: sel ? U.text : U.dim });
            [0, 1].forEach(function (k) {
              var x = k ? 246 : 156, on = sel && col === k;
              ui.box(c, x, y, 80, 12, on ? (capture ? (ui.blink(t, 16) ? U.gold : U.bg2) : U.bg2) : 'rgba(255,255,255,0.03)');
              if (on) { ui.box(c, x, y, 2, 12, U.gold); }
              var codes = K[k ? 'p2' : 'p1'][ACT[r][0]] || [];
              var txt = capture && on ? '请按键…' : codes.map(kn).join(' / ');
              LC.font.draw(c, txt, x + 40, y + 1, { size: 10, color: on && flash ? U.green : on ? U.text : U.dim, align: 'center' });
            });
          } else {
            var lab = r === ACT.length ? '恢复默认' : '返回';
            if (sel) ui.box(c, 54, y, 100, 12, U.bg2);
            LC.font.draw(c, lab, 60, y, { size: 12, color: sel ? U.gold : U.dim });
          }
        }
        ui.hints(c, [['L', '修改'], ['Esc', '取消'], ['←→', '1P/2P'], ['M', '返回']], { y: H - 13 });
      }
    };
  });

  // ---------------------------------------------------------------- credits
  LC.scenes.define('credits', function (params) {
    var ending = !!params.ending;
    var lines = [['logo']].concat(
      [['', ''], ['h', '制作名单 CREDITS']],
      LORE.credits.slice(1).map(function (s) { return ['t', s]; }),
      [['', ''], ['h', '模块'], ['t', '系统与界面 PLATFORM · 战斗 FIGHT'], ['t', '角色动画 RIG · 特效 FX · 立绘 ILLUST'], ['t', '场景 STAGE · 音频 AUDIO'],
        ['', ''], ['h', '字体授权'], ['t', 'Fusion Pixel Font 缝合像素字体'], ['s', '© TakWolf · SIL Open Font License 1.1'],
        ['', ''], ['h', '声明'], ['w', LORE.disclaimer], ['', ''], ['', ''], ['big', '感谢游玩！'], ['s', 'THANK YOU FOR PLAYING']]);
    var y0 = H, total = 0, speed = 0.4;
    lines.forEach(function (l) { total += l[0] === 'logo' ? 100 : l[0] === 'w' ? 30 : l[0] === 'big' ? 30 : 16; });
    return {
      music: ending ? undefined : 'ending',
      update: function () {
        var m = LC.input.menu;
        var fast = LC.input.player(0).down || LC.input.player(0).L || LC.input.pointer.down;
        y0 -= fast ? speed * 5 : speed;
        var end = y0 + total < 60;
        if (m.cancel || (ending ? end && this.t > 60 : (m.ok && this.t > 20) || end)) {
          LC.scenes.go(ending ? 'title' : 'menu', {}, { transition: 'dissolve', frames: 24 });
          y0 = -1e9;
        }
      },
      draw: function (c) {
        var t = this.t;
        ui.backdrop(c, t, { speed: 0.15 });
        var y = Math.round(y0);
        lines.forEach(function (l) {
          var k = l[0], h = k === 'logo' ? 100 : k === 'w' ? 30 : k === 'big' ? 30 : 16;
          if (y > -h && y < H) {
            if (k === 'logo') { var lg = ui.logo(); if (lg) c.drawImage(lg, (W - lg.width) >> 1, y + ((100 - lg.height) >> 1)); }
            else if (k === 'h') LC.font.draw(c, l[1], W >> 1, y, { size: 12, color: U.gold, align: 'center', shadow: U.black });
            else if (k === 't') LC.font.draw(c, l[1], W >> 1, y, { size: 12, color: U.text, align: 'center', shadow: U.black });
            else if (k === 's') LC.font.draw(c, l[1], W >> 1, y + 2, { size: 8, color: U.dim, align: 'center' });
            else if (k === 'w') LC.font.draw(c, LC.font.wrap(l[1], 300, { size: 10 }).join('\n'), W >> 1, y, { size: 10, color: U.dim, align: 'center' });
            else if (k === 'big') LC.font.draw(c, l[1], W >> 1, y, { size: 12, scale: 2, color: U.text, outline: U.black, align: 'center' });
          }
          y += h;
        });
        if (ending && LC.app.session && LC.app.session.arcade) {
          var A = LC.app.session.arcade;
          ui.box(c, 0, H - 16, W, 16, 'rgba(5,4,10,0.75)');
          LC.font.draw(c, 'FINAL SCORE ' + String(A.score).padStart(7, '0') + (A.newRecord ? '  NEW RECORD!' : ''), W >> 1, H - 12, { size: 8, color: U.gold, align: 'center' });
        } else ui.hints(c, [['↓', '加速'], ['M', '返回']], { y: H - 13, align: 'right' });
      }
    };
  });
})();
