/* LATENT CLASH — main menu (+ versus sub-menu) (PLATFORM). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H, ui = LC.ui;

  var MAIN = [
    { id: 'arcade', label: '街机模式', en: 'ARCADE', desc: '挑战三位对手，直抵潜空间深处！' },
    { id: 'versus', label: '对战', en: 'VERSUS', desc: '与 CPU 或好友一决胜负。' },
    { id: 'training', label: '训练', en: 'TRAINING', desc: '自由练习连段与必杀技。' },
    { id: 'howto', label: '出招表与教学', en: 'HOW TO PLAY', desc: '基本操作、系统与出招表。' },
    { id: 'options', label: '设置', en: 'OPTIONS', desc: '音量、难度、画面与按键设置。' },
    { id: 'credits', label: '制作名单', en: 'CREDITS', desc: '开发团队、字体授权与声明。' }
  ];
  var VS = [
    { id: 'pvc', label: '玩家 vs CPU', en: '1P VS CPU', desc: '与电脑对战，难度可在设置中调整。' },
    { id: 'pvp', label: '玩家 vs 玩家', en: '1P VS 2P', desc: '本地双人：键盘分区或两个手柄。' },
    { id: 'cvc', label: 'CPU vs CPU', en: 'WATCH', desc: '观战模式：欣赏 CPU 的对决。' }
  ];

  LC.scenes.define('menu', function () {
    var main = new ui.Menu(MAIN.map(function (m) { return Object.assign({}, m); }), { x: 26, y: 40, w: 160, itemH: 20, index: LC.app.menuIndex || 0 });
    var sub = null, subT = 0, showcase = 0, swapT = 0;
    function open(id) {
      LC.app.menuIndex = main.i;
      if (id === 'arcade') LC.scenes.go('select', { mode: 'arcade' });
      else if (id === 'versus') { sub = new ui.Menu(VS.map(function (m) { return Object.assign({}, m); }), { x: 196, y: 64, w: 150, itemH: 20, index: LC.app.vsIndex || 0 }); subT = 0; }
      else if (id === 'training') LC.scenes.go('select', { mode: 'training' });
      else if (id === 'howto') LC.scenes.go('howto', {});
      else if (id === 'options') LC.scenes.go('options', { from: 'menu' });
      else if (id === 'credits') LC.scenes.go('credits', {});
    }
    return {
      music: 'title',
      enter: function () { LC.input.setMode('solo'); },
      update: function () {
        swapT++;
        if (swapT > 360) { swapT = 0; showcase ^= 1; }
        if (sub) {
          subT++;
          var r2 = sub.update();
          if (r2 && r2.type === 'ok') { LC.app.vsIndex = sub.i; LC.app.menuIndex = main.i; LC.scenes.go('select', { mode: 'versus', vs: r2.item.id }); }
          else if (r2 && r2.type === 'cancel') sub = null;
          return;
        }
        var r = main.update();
        if (r && r.type === 'ok') open(r.item.id);
        else if (r && r.type === 'cancel') LC.scenes.go('title', {}, { transition: 'dissolve' });
      },
      draw: function (c) {
        var t = this.t;
        var acc = showcase ? '#4d6bfe' : '#d97757';
        ui.backdrop(c, t, { accent: acc });
        // character showcase (right side)
        var order = showcase ? ['claude', 'deepseek'] : ['deepseek', 'claude'];
        var sw = ui.ease.inOut(Math.min(1, swapT / 40));
        order.forEach(function (ch, k) {
          var front = k === 1;
          var b = ui.portrait(ch, 'bust', 0);
          if (!b) return;
          if (ch === 'deepseek') b = ui.flip(b);
          var baseX = ch === 'claude' ? 204 : 266;
          var dx = front ? Math.round((1 - sw) * (ch === 'claude' ? -10 : 10)) : 0;
          var y = (front ? 70 : 62) + Math.round(Math.sin(t * 0.03 + k) * 2);
          c.drawImage(front ? b : ui.tint(b, '#0b0a14', 0.55), baseX + dx, y);
        });
        ui.box(c, 196, 198, W - 196, 18, 'rgba(5,4,10,0.55)');
        ui.header(c, '主菜单', 'MAIN MENU', t, acc);
        // menu panel
        var a = ui.ease.out(t / 18);
        var px = Math.round(-180 + 196 * a);
        ui.panel(c, px - 4 + 0, 32, 176, 132, { accent: acc });
        main.o.x = px + 10;
        main.o.appear = t;
        main.draw(c, t, {});
        // description
        var it = sub ? sub.items[sub.i] : main.items[main.i];
        ui.panel(c, px - 4, 168, 210, 30, {});
        var lines = LC.font.wrap(it.desc, 196, { size: 12 });
        LC.font.draw(c, lines.slice(0, 2).join('\n'), px + 6, 171 + (lines.length === 1 ? 6 : 0), { size: 12, color: U.text, lineGap: 1 });
        if (!sub && it.id === 'arcade') {
          var best = LC.save.get('bestScore', 0) || 0;
          LC.font.draw(c, 'BEST ' + String(best).padStart(7, '0'), px + 166, 154, { size: 8, color: U.gold, align: 'right' });
        }
        if (sub) {
          var s = ui.ease.back(subT / 14);
          var sx = Math.round(W + 10 - (W + 10 - 190) * s);
          ui.panel(c, sx, 56, 166, 72, { accent: U.gold, fill: 'rgba(21,19,42,0.95)' });
          LC.font.draw(c, '对战模式', sx + 8, 44 + 16 - 14, { size: 10, color: U.gold, shadow: U.black });
          sub.o.x = sx + 12; sub.o.appear = subT;
          sub.draw(c, t);
        }
        ui.hints(c, [['L', '确认'], ['M', '返回'], ['↑↓', '选择']], { y: H - 13, align: 'left', x: 8 });
      }
    };
  });
})();
