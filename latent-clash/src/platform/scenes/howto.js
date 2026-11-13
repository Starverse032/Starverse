/* LATENT CLASH — how to play: controls diagram, system pages, both move lists (PLATFORM).
 * Also provides LC.ui.drawMoveList (used by the pause menu) and LC.ui.keycap. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H, ui = LC.ui, LORE = LC.LORE;

  ui.keycap = function (c, x, y, label, col, w) {
    var m = LC.font.measure(label, { size: 8 }).w;
    w = w || Math.max(13, m + 6);
    ui.box(c, x, y + 1, w, 13, U.black);
    ui.box(c, x, y, w, 12, col ? ui.mix(col, '#15132a', 0.55) : '#2b2758');
    ui.box(c, x + 1, y + 1, w - 2, 9, col ? ui.mix(col, '#15132a', 0.25) : '#3b3670');
    ui.box(c, x + 1, y + 1, w - 2, 1, col ? ui.mix(col, '#ffffff', 0.3) : '#5a5499');
    LC.font.draw(c, label, x + (w >> 1) + 1, y + 2, { size: 8, color: U.text, align: 'center' });
    return w;
  };

  // ---------------------------------------------------------------- move lists
  var listCache = {};
  function moveList(ch) {
    if (listCache[ch]) return listCache[ch];
    var list = null;
    if (LC.fight && LC.fight.getMoveList) {
      try { list = LC.fight.getMoveList(ch); } catch (e) { console.error('[platform] fight.getMoveList', e); }
    }
    if (!list || !list.length) {
      list = [];
      var M = LORE.moves[ch];
      Object.keys(M).forEach(function (id) {
        var m = M[id];
        list.push({ id: id, name: m.zh, nameEn: m.en, input: m.input + (m.input.indexOf('j.') === 0 ? '' : ''), simple: m.simple, type: id === 'super' ? 'super' : 'special', desc: m.desc });
      });
      list.push({ id: 'throw', name: '投技', nameEn: 'THROW', input: 'L+M', simple: '', type: 'throw', desc: '贴近对手时使用，无法防御。被投时同样输入 L+M 可以拆投。' });
      list.push({ id: 'dash', name: '冲刺 / 后撤步', nameEn: 'DASH', input: '66', simple: '44', type: 'system', desc: '快速接近；后撤步在开始时短暂无敌。' });
      list.push({ id: 'guard', name: '防御', nameEn: 'GUARD', input: '4', simple: '1', type: 'system', desc: '站立防御挡中上段与跳攻，蹲防挡下段。' });
    }
    return (listCache[ch] = list);
  }
  var TYPE_NAME = { special: '必杀技', super: '超必杀技', throw: '投技', system: '系统', normal: '通常技' };
  var TYPE_COL = { special: U.meter, super: U.meterFull, throw: '#c9b6ff', system: U.green, normal: U.dim };

  function inputStr(m) {
    var inp = String(m.input || '');
    if (/^j?\.?\d+$/.test(inp) && m.type !== 'system') inp += 'X';
    return inp.replace(/\s/g, '');
  }

  ui.drawMoveList = function (c, ch, x, y, w, h, scroll, t) {
    var L = LORE.chars[ch], col = ui.charCol(ch, 0);
    ui.panel(c, x, y, w, h, { accent: col.ui, accentW: 40, fill: 'rgba(15,13,32,0.94)' });
    var em = ui.icon('emblem.' + ch);
    var hx = x + 8;
    if (em) { c.drawImage(em, hx, y + 5); hx += em.width + 4; }
    LC.font.draw(c, L.nameZh + ' 出招表', hx, y + 6, { size: 12, color: col.light });
    LC.font.draw(c, 'MOVE LIST', x + w - 8, y + 9, { size: 8, color: U.dim, align: 'right' });
    ui.box(c, x + 6, y + 21, w - 12, 1, U.line);
    var list = moveList(ch);
    var rowH = 28, top = y + 24, vis = Math.floor((h - 28) / rowH);
    var maxScroll = Math.max(0, list.length - vis);
    scroll = Math.min(scroll, maxScroll);
    c.save();
    c.beginPath(); c.rect(x + 2, top, w - 4, h - 26); c.clip();
    for (var i = 0; i < list.length; i++) {
      var m = list[i], ry = top + (i - scroll) * rowH;
      if (ry < top - rowH || ry > y + h) continue;
      if ((i & 1) === 0) ui.box(c, x + 3, ry, w - 6, rowH, 'rgba(255,255,255,0.025)');
      var tc = TYPE_COL[m.type] || U.dim;
      ui.box(c, x + 6, ry + 3, 2, rowH - 6, tc);
      var nw = LC.font.draw(c, m.name, x + 12, ry + 2, { size: 12, color: U.text });
      var tw2 = LC.font.draw(c, TYPE_NAME[m.type] || '', x + 16 + nw, ry + 3, { size: 10, color: tc });
      // inputs right-aligned
      var right = x + w - 10;
      var simple = m.simple ? String(m.simple) : '';
      var tmp = 0;
      var inW = (simple ? measureNotation(simple) + 18 : 0) + measureNotation(inputStr(m));
      if (m.nameEn && x + 22 + nw + tw2 + LC.font.measure(m.nameEn, { size: 8 }).w < right - inW - 6) LC.font.draw(c, m.nameEn, x + 20 + nw + tw2, ry + 5, { size: 8, color: '#4f4a78' });
      if (simple) {
        tmp = measureNotation(simple);
        ui.notation(c, simple, right - tmp, ry + 2, {});
        LC.font.draw(c, '或', right - tmp - 14, ry + 3, { size: 10, color: '#4f4a78' });
        tmp += 18;
      }
      var main = inputStr(m);
      var mw = measureNotation(main);
      ui.notation(c, main, right - tmp - mw, ry + 2, {});
      var desc = m.desc || '';
      var dl = LC.font.wrap(desc, w - 24, { size: 10 });
      LC.font.draw(c, dl[0] + (dl.length > 1 ? '…' : ''), x + 12, ry + 16, { size: 10, color: U.dim });
    }
    c.restore();
    if (maxScroll > 0) {
      var sh = Math.max(10, Math.round((h - 30) * vis / list.length));
      var sy = top + Math.round((h - 30 - sh) * scroll / maxScroll);
      ui.box(c, x + w - 4, top, 1, h - 30, U.bg2);
      ui.box(c, x + w - 5, sy, 3, sh, U.dim);
    }
    return maxScroll;
  };
  var scratch = null;
  function measureNotation(s) {
    if (!scratch) scratch = ui.canvas(256, 16).getContext('2d');
    return ui.notation(scratch, s, 0, 0, {});
  }

  // ---------------------------------------------------------------- pages
  var SYSTEM = [
    ['防御', '按住后方向防御。站立防御挡中段、上段和跳跃攻击；蹲下防御挡下段（2L/2M/2H）。空中无法防御。'],
    ['连段', '通常技可按 轻→中→重 依次取消（站蹲可混合）。通常技命中或被防时可取消成必杀技，必杀技命中后可取消成超必杀。'],
    ['必杀技', '简易输入：特(S) + 方向。指令输入：如 ↓↘→ + 轻/中/重，按键越重，速度、距离、威力越强。'],
    ['投技', '贴近对手按 轻+中（U 键）。无法防御，被投瞬间输入 轻+中 可拆投。'],
    ['能量与超必杀', '攻击、命中、受击、防御都会积攒能量，满 100 时按 重+特（O 键）或 ↓↘→↓↘→ + 任意攻击键发动超必杀。能量跨回合保留。'],
    ['移动', '→→ 冲刺，←← 后撤步（开始时短暂无敌）。↖↑↗ 跳跃，跳跃攻击为上段。']
  ];

  LC.scenes.define('howto', function (params) {
    var page = params.page || 0, scroll = 0, maxScroll = 0, pageT = 0;
    var TABS = ['基本操作', '系统', LORE.chars.claude.nameZh, LORE.chars.deepseek.nameZh];
    function setPage(p) { page = (p + TABS.length) % TABS.length; scroll = 0; pageT = 0; ui.sfx('ui.move'); }
    function drawControls(c) {
      var K = LC.input.keys, kn = LC.input.keyName;
      var first = function (a, p) { return kn((K[p || 'p1'][a] || [])[0]); };
      ui.panel(c, 8, 26, 182, 120, { accent: U.gold });
      LC.font.draw(c, '键盘 · 1P', 16, 31, { size: 12, color: U.gold });
      // movement cluster
      var bx = 18, by = 52;
      ui.keycap(c, bx + 15, by, first('up'));
      ui.keycap(c, bx, by + 15, first('left')); ui.keycap(c, bx + 15, by + 15, first('down')); ui.keycap(c, bx + 30, by + 15, first('right'));
      LC.font.draw(c, '移动', bx + 14, by + 32, { size: 10, color: U.dim });
      // buttons
      var ax = 92, ay = 52;
      [['throw', '投', '#c9b6ff'], ['S', '特', U.meter], ['super', '超', U.meterFull]].forEach(function (b, i) { ui.keycap(c, ax + i * 30, ay, first(b[0]), b[2], 14); LC.font.draw(c, b[1], ax + i * 30 + 16, ay + 1, { size: 10, color: b[2] }); });
      [['L', '轻', U.green], ['M', '中', U.gold], ['H', '重', '#ff6b7f']].forEach(function (b, i) { ui.keycap(c, ax + i * 30, ay + 15, first(b[0]), b[2], 14); LC.font.draw(c, b[1], ax + i * 30 + 16, ay + 16, { size: 10, color: b[2] }); });
      LC.font.draw(c, '投=轻+中  超=重+特', ax - 4, ay + 32, { size: 10, color: U.dim });
      LC.font.draw(c, '回车 / Esc：暂停 · 确认 / 返回', 16, 102, { size: 10, color: U.dim });
      LC.font.draw(c, '单人时也可用 方向键 + Z X C V', 16, 116, { size: 10, color: U.dim });
      LC.font.draw(c, '按键可在「设置 → 按键设置」中更改', 16, 130, { size: 10, color: '#4f4a78' });

      ui.panel(c, 194, 26, 182, 62, { accent: '#58d4ff' });
      LC.font.draw(c, '键盘 · 2P（双人对战）', 202, 31, { size: 12, color: '#58d4ff' });
      LC.font.draw(c, '移动：方向键', 202, 49, { size: 10, color: U.text });
      LC.font.draw(c, '轻 中 重 特：' + ['L', 'M', 'H', 'S'].map(function (a) { return kn((K.p2[a] || []).slice(-1)[0]); }).join(' '), 202, 62, { size: 10, color: U.text });
      LC.font.draw(c, '或 小键盘 1 2 3 5', 202, 75, { size: 10, color: U.dim });

      ui.panel(c, 194, 92, 182, 54, { accent: '#c9b6ff' });
      var ic = ui.icon('gamepad');
      var gx = 202;
      if (ic) { c.drawImage(ic, gx, 97); gx += ic.width + 4; }
      LC.font.draw(c, '手柄（标准布局）', gx, 97, { size: 12, color: '#c9b6ff' });
      LC.font.draw(c, 'X 轻 · Y 中 · B 重 · A 特', 202, 114, { size: 10, color: U.text });
      LC.font.draw(c, 'LB 投 · RB 超 · Start 暂停', 202, 128, { size: 10, color: U.text });

      ui.panel(c, 8, 150, 368, 48, { accent: U.green });
      var ti = ui.icon('touch'), tx = 16;
      if (ti) { c.drawImage(ti, tx, 155); tx += ti.width + 4; }
      LC.font.draw(c, '触屏', tx, 155, { size: 12, color: U.green });
      LC.font.draw(c, '左侧为方向键，右侧为 轻·中·重·特 四键，「投」「超」为组合快捷键。', 16, 171, { size: 10, color: U.text });
      LC.font.draw(c, '手指可在按键间滑动；菜单也可以直接点击。竖屏时按键位于画面下方。', 16, 184, { size: 10, color: U.dim });
    }
    function drawSystem(c, t) {
      ui.panel(c, 8, 26, 368, 172, { accent: U.green });
      var y = 32 - scroll * 12, maxY = 0;
      c.save(); c.beginPath(); c.rect(10, 28, 364, 168); c.clip();
      SYSTEM.forEach(function (s) {
        LC.font.draw(c, '◆ ' + s[0], 18, y, { size: 12, color: U.gold });
        var lines = LC.font.wrap(s[1], 344, { size: 10 });
        LC.font.draw(c, lines.join('\n'), 30, y + 14, { size: 10, color: U.text, lineGap: 2 });
        y += 18 + lines.length * 12;
      });
      maxY = y + scroll * 12;
      c.restore();
      maxScroll = Math.max(0, Math.ceil((maxY - 196) / 12));
    }
    return {
      music: 'select',
      update: function () {
        pageT++;
        var m = LC.input.menu;
        if (m.left) setPage(page - 1);
        else if (m.right) setPage(page + 1);
        else if (m.down) { if (scroll < maxScroll) { scroll++; ui.sfx('ui.move', { vol: 0.5 }); } }
        else if (m.up) { if (scroll > 0) { scroll--; ui.sfx('ui.move', { vol: 0.5 }); } }
        else if (m.cancel || m.ok) { ui.sfx('ui.cancel'); LC.scenes.go('menu', {}, { transition: 'wipe' }); }
        var p = LC.input.pointer;
        if (p.pressed && p.y < 20) { for (var i = 0; i < TABS.length; i++) if (p.x >= 120 + i * 66 && p.x < 184 + i * 66) setPage(i); }
        else if (p.pressed) setPage(page + (p.x > W / 2 ? 1 : -1));
      },
      draw: function (c) {
        var t = this.t;
        ui.backdrop(c, t, { speed: 0.2 });
        ui.box(c, 0, 0, W, 20, 'rgba(5,4,10,0.85)'); ui.box(c, 0, 20, W, 1, U.line);
        LC.font.draw(c, '出招表与教学', 8, 4, { size: 12, color: U.text });
        TABS.forEach(function (tb, i) {
          var x = 120 + i * 66, sel = i === page;
          if (sel) { ui.box(c, x, 2, 64, 18, U.bg2); ui.box(c, x, 18, 64, 2, U.gold); }
          LC.font.draw(c, tb, x + 32, 5, { size: i >= 2 ? 10 : 12, color: sel ? U.text : U.dim, align: 'center' });
        });
        var a = ui.ease.out(pageT / 10);
        c.save(); c.translate(Math.round((1 - a) * 16), 0);
        if (page === 0) { maxScroll = 0; drawControls(c); }
        else if (page === 1) drawSystem(c, t);
        else maxScroll = ui.drawMoveList(c, page === 2 ? 'claude' : 'deepseek', 8, 26, W - 16, 172, scroll, t);
        c.restore();
        ui.hints(c, [['←→', '翻页'], ['↑↓', '滚动'], ['M', '返回']], { y: H - 13 });
      }
    };
  });
})();
