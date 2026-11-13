/* LATENT CLASH — match scene (wraps LC.fight.createMatch, or the stub) + pause overlay (PLATFORM).
 * params: { config } (a full createMatch config, see LC.app.matchConfig). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H, ui = LC.ui;

  function strip(p) { return { left: p.left, right: p.right, up: p.up, down: p.down, L: p.L, M: p.M, H: p.H, S: p.S }; }

  LC.scenes.define('match', function (params) {
    var cfg = params.config || LC.app.matchConfig(params);
    var match = null, done = false, prevStart = [true, true], demoT = 0;
    var humans = [cfg.p1.control === 'human', cfg.p2.control === 'human'];
    var scene = {
      music: undefined,
      match: null,
      cfg: cfg,
      enter: function () {
        ui.forgetMusic();
        LC.input.setMode(humans[0] && humans[1] ? 'duo' : 'solo');
        if (LC.fight && LC.fight.createMatch) {
          try { match = LC.fight.createMatch(cfg); } catch (e) {
            console.error('[platform] fight.createMatch failed, using stub', e);
            LC.debug.errors.push({ message: 'fight.createMatch: ' + (e && e.message || e), stack: e && e.stack });
            match = null;
          }
        }
        if (!match) match = LC.app.createStubMatch(cfg);
        scene.match = match;
        if (LC.app.session) LC.app.session.lastConfig = cfg;
      },
      update: function () {
        if (!match) return;
        var p0 = LC.input.player(0), p1 = LC.input.player(1);
        if (cfg.mode === 'demo') {
          demoT++;
          if (demoT > 10 && LC.input.anyPressed()) { done = true; LC.scenes.go('title', { fromDemo: true }, { transition: 'dissolve' }); return; }
          if (demoT > 60 * 75 && !done) { done = true; LC.scenes.go('title', { fromDemo: true }, { transition: 'dissolve' }); return; }
        } else if (!done) {
          var st = [p0.start, p1.start];
          for (var i = 0; i < 2; i++) {
            if (st[i] && !prevStart[i] && (humans[i] || (!humans[0] && !humans[1]))) {
              prevStart = st;
              LC.scenes.push('pause', { cfg: cfg, by: i });
              return;
            }
          }
          prevStart = st;
          // tap on the game screen (no touch overlay / mouse) also pauses, from the top-centre timer
          var ptr = LC.input.pointer;
          if (ptr.pressed && ptr.y < 26 && ptr.x > W / 2 - 24 && ptr.x < W / 2 + 24) { LC.scenes.push('pause', { cfg: cfg, by: 0 }); return; }
        }
        var in0 = humans[0] ? strip(p0) : {}, in1 = humans[1] ? strip(p1) : {};
        try { match.update(in0, in1); } catch (e) { throw e; }
        if (match.finished && !done) {
          done = true;
          LC.app.afterMatch(cfg, match.result);
        }
      },
      draw: function (c) {
        if (!match) { c.fillStyle = U.bg0; c.fillRect(0, 0, W, H); return; }
        c.save();
        match.draw(c);
        c.restore();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalAlpha = 1;
        if (cfg.mode === 'demo') {
          ui.box(c, 6, H - 30, 46, 13, 'rgba(5,4,10,0.75)');
          ui.box(c, 6, H - 30, 2, 13, U.red);
          LC.font.draw(c, 'DEMO', 12, H - 27, { size: 8, color: U.text, spacing: 1 });
          if (ui.blink(this.t, 70, 0.6)) LC.font.draw(c, '按任意键返回标题', W >> 1, H - 28, { size: 10, color: U.text, outline: U.black, align: 'center' });
        }
      },
      exit: function () {
        if (match && match.destroy) { try { match.destroy(); } catch (e) { console.error('[platform] match.destroy', e); } }
        if (LC.audio && LC.audio.setPaused) { try { LC.audio.setPaused(false); } catch (e) { /* ignore */ } }
      },
      onFocusReturn: function () {
        if (cfg.mode !== 'demo' && !done && (humans[0] || humans[1]) && LC.scenes.current() === scene) LC.scenes.push('pause', { cfg: cfg, by: 0 });
      }
    };
    return scene;
  });

  // ---------------------------------------------------------------- pause overlay
  var TRAIN = [
    { k: 'dummy', label: '陪练动作', vals: ['stand', 'crouch', 'jump', 'cpu'], names: ['站立', '蹲下', '跳跃', 'CPU 操作'] },
    { k: 'guard', label: '陪练防御', vals: ['none', 'all', 'afterFirst', 'random'], names: ['不防御', '全部防御', '首击后防御', '随机'] },
    { k: 'refill', label: '体力回复', vals: [true, false], names: ['开', '关'] },
    { k: 'meter', label: '能量', vals: ['normal', 'full'], names: ['普通', '无限'] },
    { k: 'hitboxes', label: '判定框', vals: [false, true], names: ['隐藏', '显示'] },
    { k: 'inputs', label: '输入显示', vals: [true, false], names: ['显示', '隐藏'] },
    { k: 'data', label: '伤害数据', vals: [true, false], names: ['显示', '隐藏'] }
  ];

  LC.scenes.define('pause', function (params) {
    var cfg = params.cfg || {};
    var view = 'main', moves = null, movesChar = cfg.p1 ? cfg.p1.char : 'claude', scroll = 0;
    var items = [{ id: 'resume', label: '继续游戏', en: 'RESUME' }, { id: 'moves', label: '出招表', en: 'MOVE LIST' }];
    if (cfg.mode === 'training') items.push({ id: 'training', label: '训练设置', en: 'TRAINING' }, { id: 'reset', label: '重置位置', en: 'RESET' });
    items.push({ id: 'restart', label: '重新开始', en: 'RESTART' }, { id: 'quit', label: cfg.mode === 'arcade' ? '放弃挑战' : '退出对局', en: 'QUIT' });
    var menu = new ui.Menu(items, { x: 128, y: 70, w: 140, itemH: 18 });
    var tmenu = null, confirmQuit = 0;
    function match() { return LC.debug.match(); }
    function trainingMenu() {
      var M = match(), opts = Object.assign({}, cfg.training || {}, M && M.trainingOpts || {});
      cfg.training = cfg.training || {};
      var list = TRAIN.map(function (o) {
        return {
          label: o.label,
          value: function () { var v = cfg.training[o.k] !== undefined ? cfg.training[o.k] : opts[o.k]; var i = o.vals.indexOf(v); return o.names[i < 0 ? 0 : i]; },
          adjust: function (d) {
            var v = cfg.training[o.k] !== undefined ? cfg.training[o.k] : opts[o.k];
            var i = Math.max(0, o.vals.indexOf(v));
            cfg.training[o.k] = o.vals[(i + d + o.vals.length) % o.vals.length];
            var m2 = match(); if (m2 && m2.setTraining) { try { var u = {}; u[o.k] = cfg.training[o.k]; m2.setTraining(u); } catch (e) { console.error('[platform] setTraining', e); } }
          }
        };
      });
      list.push({ label: '返回', action: true, id: 'back' });
      return new ui.Menu(list, { x: 96, y: 52, w: 192, itemH: 16, size: 12 });
    }
    return {
      overlay: true,
      enter: function () {
        ui.sfx('ui.pause');
        if (LC.audio && LC.audio.setPaused) { try { LC.audio.setPaused(true); } catch (e) { /* ignore */ } }
      },
      exit: function () { if (LC.audio && LC.audio.setPaused) { try { LC.audio.setPaused(false); } catch (e) { /* ignore */ } } },
      update: function () {
        var m = LC.input.menu;
        if (confirmQuit) confirmQuit--;
        if (view === 'moves') {
          if (m.cancel || m.ok) { view = 'main'; ui.sfx('ui.cancel'); }
          else if (m.left || m.right) { movesChar = movesChar === 'claude' ? 'deepseek' : 'claude'; scroll = 0; ui.sfx('ui.move'); }
          else if (m.down) scroll++; else if (m.up) scroll = Math.max(0, scroll - 1);
          return;
        }
        if (view === 'training') {
          var r2 = tmenu.update();
          if ((r2 && r2.type === 'cancel') || (r2 && r2.type === 'ok' && r2.item.id === 'back')) view = 'main';
          return;
        }
        if (m.start) { LC.scenes.pop(); return; }
        var r = menu.update();
        if (!r) return;
        if (r.type === 'cancel') { LC.scenes.pop(); return; }
        if (r.type !== 'ok') return;
        var id = r.item.id;
        if (id === 'resume') LC.scenes.pop();
        else if (id === 'moves') { view = 'moves'; scroll = 0; }
        else if (id === 'training') { tmenu = trainingMenu(); view = 'training'; }
        else if (id === 'reset') { var M = match(); if (M && M.resetPositions) M.resetPositions(); LC.scenes.pop(); }
        else if (id === 'restart') { var c2 = Object.assign({}, cfg); LC.scenes.go('match', { config: c2 }, { transition: 'wipe' }); }
        else if (id === 'quit') {
          if (!confirmQuit) { confirmQuit = 120; r.item.label = '确定退出？'; return; }
          LC.scenes.go(cfg.mode === 'arcade' ? 'title' : 'menu', {}, { transition: 'wipe' });
        }
        if (id !== 'quit') items[items.length - 1].label = cfg.mode === 'arcade' ? '放弃挑战' : '退出对局';
      },
      draw: function (c) {
        var t = this.t;
        c.globalAlpha = 0.62; ui.box(c, 0, 0, W, H, U.black); c.globalAlpha = 1;
        // dithered edge bands
        for (var y = 0; y < H; y += 4) { ui.box(c, ((y >> 2) & 1) * 2, y, 2, 2, U.bg2); ui.box(c, W - 2 - ((y >> 2) & 1) * 2, y, 2, 2, U.bg2); }
        if (!confirmQuit) items[items.length - 1].label = cfg.mode === 'arcade' ? '放弃挑战' : '退出对局';
        if (view === 'moves') {
          ui.drawMoveList(c, movesChar, 20, 24, W - 40, H - 44, scroll, t);
          ui.hints(c, [['←→', '切换角色'], ['↑↓', '滚动'], ['M', '返回']], { y: H - 14 });
          return;
        }
        if (view === 'training') {
          ui.panel(c, 84, 30, 216, 52 + TRAIN.length * 16, { accent: U.green, fill: 'rgba(21,19,42,0.96)' });
          LC.font.draw(c, '训练设置', 96, 36, { size: 12, color: U.green });
          LC.font.draw(c, 'TRAINING OPTIONS', 288, 39, { size: 8, color: U.dim, align: 'right' });
          tmenu.draw(c, t);
          ui.hints(c, [['←→', '调整'], ['M', '返回']], { y: H - 14 });
          return;
        }
        var a = ui.ease.back(t / 10);
        var ph = 34 + items.length * 18;
        ui.panel(c, 112, 40, 160, Math.round(ph * a), { accent: U.gold, fill: 'rgba(21,19,42,0.96)' });
        if (a > 0.9) {
          LC.font.draw(c, '暂停', 124, 46, { size: 12, color: U.gold });
          LC.font.draw(c, 'PAUSE', 262, 49, { size: 8, color: U.dim, align: 'right', spacing: 1 });
          ui.box(c, 120, 62, 144, 1, U.line);
          menu.o.appear = t;
          menu.draw(c, t);
        }
        ui.hints(c, [['L', '确认'], ['M', '返回']], { y: H - 14 });
      }
    };
  });
})();
