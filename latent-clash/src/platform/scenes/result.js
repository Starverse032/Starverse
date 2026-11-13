/* LATENT CLASH — result screen + arcade ladder / continue / ending (PLATFORM). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H, ui = LC.ui, LORE = LC.LORE;
  var ROWS = [['damage', '总伤害'], ['maxCombo', '最大连击'], ['hits', '命中数'], ['specials', '必杀技'], ['supers', '超必杀'], ['throws', '投技']];

  function voice(ch, kind) { if (LC.audio && LC.audio.voice) { try { LC.audio.voice(ch, kind); } catch (e) { console.error('[platform] audio.voice', e); } } }

  // ---------------------------------------------------------------- result
  LC.scenes.define('result', function (params) {
    var cfg = params.cfg || LC.app.matchConfig({}), R = params.result || { winner: -1, roundsWon: [0, 0], stats: [{}, {}] };
    var P = [cfg.p1, cfg.p2], w = R.winner, arcade = !!params.arcade;
    var winCh = w >= 0 ? P[w].char : P[0].char, loseCh = w >= 0 ? P[1 - w].char : P[1].char;
    var L = LORE.chars[winCh];
    var quote = w < 0 ? LORE.chars[P[0].char].timeover : (L.winVs && L.winVs[loseCh] && Math.random() < 0.6 ? L.winVs[loseCh] : L.win[(Math.random() * L.win.length) | 0]);
    var tw = new ui.Typewriter(quote, { speed: 0.45, font: { size: 12, color: U.text, lineGap: 3 } });
    var items = arcade ? (w === 0 ? [{ id: 'next', label: '继续前进' }] : [{ id: 'next', label: '继续' }])
      : [{ id: 'rematch', label: '再战一局' }, { id: 'reselect', label: '重新选择' }, { id: 'menu', label: '返回菜单' }];
    var menu = new ui.Menu(items, { x: 278, y: 156, w: 100, itemH: 15, size: 12 });
    var wrapped = LC.font.wrap(quote, 208, { size: 12 }).join('\n');
    tw.text = wrapped; tw.total = LC.font.length(wrapped);
    return {
      music: null,
      enter: function () { if (w >= 0) voice(winCh, 'win'); },
      update: function () {
        tw.update();
        if (this.t < 30) return;
        if (!tw.done() && (LC.input.menu.ok || LC.input.pointer.pressed)) { tw.skip(); return; }
        var r = menu.update();
        if (!r || r.type !== 'ok') return;
        var id = r.item.id;
        if (id === 'next') LC.app.arcadeNext(w === 0);
        else if (id === 'rematch') LC.scenes.go('vs', { config: Object.assign({}, cfg, { seed: LC.app.randomSeed() }) }, { transition: 'slash' });
        else if (id === 'reselect') LC.scenes.go('select', { mode: cfg.mode, vs: LC.app.session && LC.app.session.vs }, { transition: 'wipe' });
        else LC.scenes.go('menu', {}, { transition: 'wipe' });
      },
      draw: function (c) {
        var t = this.t, col = ui.charCol(winCh, w >= 0 ? P[w].palette : 0);
        ui.backdrop(c, t, { accent: col.ui, speed: 0.2 });
        // loser, dimmed, behind
        if (w >= 0) {
          var lb = ui.portrait(loseCh, 'bustLose', P[1 - w].palette);
          if (lb) c.drawImage(ui.tint(ui.flip(lb), '#0b0a14', 0.6), 96, 52);
        }
        var b = ui.portrait(winCh, w >= 0 ? 'bustWin' : 'bustLose', w >= 0 ? P[w].palette : P[0].palette);
        var e = ui.ease.back(t / 24);
        if (b) c.drawImage(b, Math.round(-112 + 120 * e), 88 - 30 + 2);
        var top = w < 0 ? 'DRAW' : (P[0].control === 'human' && P[1].control !== 'human' ? (w === 0 ? 'YOU WIN' : 'YOU LOSE') : (w === 0 ? '1P WIN' : '2P WIN'));
        var bn = ui.banner(top === 'YOU WIN' ? 'youWin' : top === 'YOU LOSE' ? 'youLose' : top === '1P WIN' ? 'p1Win' : top === '2P WIN' ? 'p2Win' : 'draw');
        ui.box(c, 0, 0, W, 50, 'rgba(5,4,10,0.6)');
        if (bn) c.drawImage(bn, Math.round(8 + (1 - ui.ease.out(t / 16)) * -60), Math.max(2, 25 - (bn.height >> 1)));
        LC.font.draw(c, R.roundsWon[0] + ' - ' + R.roundsWon[1], W - 8, 6, { size: 12, scale: 2, color: col.light, align: 'right', outline: U.black });
        if (R.perfect) LC.font.draw(c, 'PERFECT!', W - 8, 32, { size: 8, color: U.gold, align: 'right' });
        if (arcade && params.gained) LC.font.draw(c, 'SCORE +' + params.gained + '  TOTAL ' + LC.app.session.arcade.score, W - 8, 42, { size: 8, color: U.gold, align: 'right' });
        // quote
        ui.panel(c, 156, 54, 222, 54, { accent: col.ui });
        LC.font.draw(c, w >= 0 ? L.nameZh + ' 获胜' : '平局', 164, 58, { size: 10, color: col.light });
        tw.draw(c, 164, 72, {});
        if (!tw.done() && ui.blink(t, 16)) ui.box(c, 370, 100, 4, 3, U.gold);
        // stats
        ui.panel(c, 156, 110, 116, 92, {});
        LC.font.draw(c, '1P', 236, 113, { size: 8, color: U.gold, align: 'right' });
        LC.font.draw(c, P[1].control === 'cpu' ? 'CPU' : '2P', 266, 113, { size: 8, color: '#58d4ff', align: 'right' });
        ROWS.forEach(function (row, i) {
          var y = 124 + i * 13, a = ui.ease.out((t - 20 - i * 4) / 10);
          if (a <= 0) return;
          LC.font.draw(c, row[1], 162, y, { size: 10, color: U.dim, alpha: a });
          [0, 1].forEach(function (k) {
            var s = (R.stats && R.stats[k]) || {}, v = s[row[0]] || 0, o = (R.stats && R.stats[1 - k] || {})[row[0]] || 0;
            LC.font.draw(c, String(Math.round(v * Math.min(1, (t - 20 - i * 4) / 30))), k ? 266 : 236, y + 1, { size: 8, color: v > o ? U.text : U.dim, align: 'right', alpha: a });
          });
        });
        ui.panel(c, 274, 150, 104, 52, {});
        menu.o.appear = t - 30;
        if (t > 30) menu.draw(c, t);
      }
    };
  });

  // ---------------------------------------------------------------- arcade ladder
  LC.scenes.define('ladder', function () {
    var A = LC.app.session.arcade, fp = LC.app.arcadeFightParams(), step = LORE.arcade[A.stage];
    var foe = fp.p2.char, lines = fp.introLines ? fp.introLines[1] : null;
    var tw = lines ? new ui.Typewriter(lines.join('\n'), { speed: 0.4, font: { size: 12, color: U.text, lineGap: 3 }, pitch: foe === 'deepseek' ? 1.25 : 1 }) : null;
    var leaving = false;
    function go() { if (leaving) return; leaving = true; LC.scenes.go('vs', { config: LC.app.matchConfig(fp) }, { transition: 'slash' }); }
    return {
      music: 'select',
      update: function () {
        if (tw && this.t > 50) tw.update();
        if (this.t > 30 && (LC.input.menu.ok || LC.input.pointer.pressed)) { if (tw && !tw.done()) tw.skip(); else { ui.sfx('ui.confirm'); go(); } }
        if (this.t > (tw ? 330 : 200)) go();
      },
      draw: function (c) {
        var t = this.t, col = ui.charCol(foe, fp.p2.palette);
        ui.backdrop(c, t, { accent: col.ui, speed: 0.8 });
        ui.header(c, '街机模式', 'ARCADE  SCORE ' + String(A.score).padStart(7, '0'), t, col.ui);
        // ladder nodes (left)
        LORE.arcade.forEach(function (s, i) {
          var y = 170 - i * 56, x = 40, cur = i === A.stage, done = i < A.stage;
          if (i < LORE.arcade.length - 1) { for (var yy = y - 44; yy < y - 4; yy += 3) ui.box(c, x + 15, yy, 2, 2, done ? U.gold : U.line); }
          var pulse = cur ? ((t >> 3) & 1) : 0;
          ui.box(c, x - 1 - pulse, y - 1 - pulse, 34 + pulse * 2, 34 + pulse * 2, cur ? U.gold : done ? U.dim : U.line);
          ui.box(c, x, y, 32, 32, U.bg1);
          var fc = s.foe === 'mirror' ? A.char : LC.app.other(A.char);
          var b = ui.portrait(fc, 'bust', s.foe === 'mirror' ? 1 - A.palette : s.palette);
          if (b) c.drawImage(i > A.stage ? ui.tint(b, '#0b0a14', 0.85) : b, 40, 26, 32, 32, x, y, 32, 32);
          if (done) LC.font.draw(c, 'CLEAR', x + 16, y + 22, { size: 8, color: U.green, outline: U.black, align: 'center' });
          LC.font.draw(c, s.title, x + 40, y + 4, { size: 12, color: cur ? U.gold : done ? U.dim : '#4f4a78' });
          LC.font.draw(c, s.sub, x + 40, y + 19, { size: 10, color: cur ? U.text : '#4f4a78' });
        });
        // challenger bust (right)
        var b2 = ui.portrait(foe, 'bust', fp.p2.palette);
        var e = ui.ease.out((t - 6) / 20);
        if (b2) c.drawImage(ui.flip(b2), Math.round(W - 112 + (1 - e) * 60), 30);
        var Lf = LORE.chars[foe];
        ui.box(c, 196, 150, W - 196, 20, 'rgba(5,4,10,0.8)');
        LC.font.draw(c, (step.boss ? 'BOSS · ' : '') + Lf.nameZh + (fp.p2.char === A.char ? '（' + Lf.palNames[fp.p2.palette] + '）' : ''), W - 8, 154, { size: 12, color: col.light, align: 'right' });
        LC.font.draw(c, LORE.stages[fp.stage] ? 'STAGE ' + LORE.stages[fp.stage].zh : '', 200, 156, { size: 10, color: U.dim });
        if (tw && t > 46) {
          ui.panel(c, 168, 174, 210, 36, { accent: col.ui });
          tw.draw(c, 176, 178, {});
        }
        if (step.boss && t < 60 && ui.blink(t, 12)) LC.font.draw(c, 'WARNING', W >> 1, 100, { size: 8, scale: 3, color: U.red, outline: U.black, align: 'center' });
      }
    };
  });

  // ---------------------------------------------------------------- continue
  LC.scenes.define('continue', function () {
    var A = LC.app.session.arcade, count = 9, sub = 0, over = false, overT = 0;
    return {
      music: 'continue',
      update: function () {
        if (over) { overT++; if (overT > 150 || (overT > 40 && LC.input.anyPressed())) LC.scenes.go('title', {}, { transition: 'dissolve' }); return; }
        if (LC.input.menu.ok || LC.input.menu.start || LC.input.pointer.pressed) {
          ui.sfx('ui.start'); A.continues++; A.score = 0;
          LC.scenes.go('ladder', {}, { transition: 'slash' }); return;
        }
        sub++;
        if (LC.input.menu.cancel) sub += 20;
        if (sub >= 60) { sub = 0; count--; ui.sfx('ui.move', { pitch: 0.8 }); if (count < 0) { over = true; ui.music(null); ui.sfx('ui.error'); } }
      },
      draw: function (c) {
        var t = this.t;
        c.fillStyle = U.bg0; c.fillRect(0, 0, W, H);
        for (var y = 0; y < H; y += 4) ui.box(c, 0, y, W, 1, '#0f0d1e');
        var b = ui.portrait(A.char, 'bustLose', A.palette);
        if (b) c.drawImage(over ? ui.tint(b, '#000000', 0.6) : b, 40, 60);
        if (over) {
          LC.font.draw(c, 'GAME OVER', 250, 80, { size: 8, scale: 3, color: U.red, outline: U.black, align: 'center' });
          LC.font.draw(c, LORE.chars[A.char].lose, 250, 120, { size: 10, color: U.dim, align: 'center' });
          return;
        }
        LC.font.draw(c, 'CONTINUE?', 250, 40, { size: 8, scale: 3, color: U.gold, outline: U.black, align: 'center' });
        LC.font.draw(c, '要继续挑战吗？', 250, 70, { size: 12, color: U.text, align: 'center' });
        var s = 1 + (sub < 8 ? 1 : 0);
        LC.font.draw(c, String(Math.max(0, count)), 250, 92 - (s - 1) * 6, { size: 12, scale: 4 + (s - 1), color: count <= 3 ? U.red : U.text, outline: U.black, align: 'center' });
        LC.font.draw(c, '按 L / 回车 继续 · 分数将清零', 250, 160, { size: 10, color: U.dim, align: 'center' });
        if (A.continues) LC.font.draw(c, 'CREDITS USED ' + A.continues, 250, 176, { size: 8, color: '#4f4a78', align: 'center' });
      }
    };
  });

  // ---------------------------------------------------------------- ending
  LC.scenes.define('ending', function () {
    var A = LC.app.session.arcade, L = LORE.chars[A.char];
    var lines = L.ending, idx = 0, tw = null, hold = 0;
    function next() { tw = idx < lines.length ? new ui.Typewriter(LC.font.wrap(lines[idx], 240, { size: 12 }).join('\n'), { speed: 0.35, font: { size: 12, color: U.text, lineGap: 3 } }) : null; hold = 0; }
    next();
    return {
      music: 'ending',
      update: function () {
        if (tw) {
          tw.update();
          if (tw.done()) hold++;
          if (LC.input.menu.ok || LC.input.pointer.pressed) { if (!tw.done()) tw.skip(); else hold = 999; }
          if (hold > 90) { idx++; next(); }
        } else {
          LC.scenes.go('credits', { ending: true }, { transition: 'dissolve', frames: 30 });
          tw = { update: function () {}, done: function () { return true; }, draw: function () {} };
        }
      },
      draw: function (c) {
        var t = this.t, col = ui.charCol(A.char, A.palette);
        ui.backdrop(c, t, { accent: col.ui, speed: 0.15 });
        var b = ui.portrait(A.char, 'bustWin', A.palette);
        if (b) { c.globalAlpha = Math.min(1, t / 60); c.drawImage(b, W - 124, 40); c.globalAlpha = 1; }
        LC.font.draw(c, 'ENDING', 12, 12, { size: 8, color: col.light, spacing: 2 });
        LC.font.draw(c, L.nameZh + ' · ' + L.title, 12, 24, { size: 12, color: U.text });
        // previous lines stay, dimmed
        var y = 60;
        for (var i = 0; i < Math.min(idx, lines.length); i++) {
          var wl = LC.font.wrap(lines[i], 240, { size: 12 });
          LC.font.draw(c, wl.join('\n'), 14, y, { size: 12, color: U.dim, lineGap: 3 });
          y += wl.length * 15 + 6;
        }
        if (tw && tw.text) {
          LC.font.draw(c, tw.text, 14, y, { size: 12, color: U.text, lineGap: 3, reveal: Math.floor(tw.n) });
        }
        ui.box(c, 0, H - 16, W, 16, 'rgba(5,4,10,0.7)');
        LC.font.draw(c, 'SCORE ' + String(A.score).padStart(7, '0') + (A.newRecord ? '  NEW RECORD!' : ''), W - 8, H - 12, { size: 8, color: U.gold, align: 'right' });
      }
    };
  });
})();
