/* LATENT CLASH — boot / loading scene + "press any key" gate (PLATFORM). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H;

  var STEPS = [
    ['platform', '字体与界面', 'INTERFACE'],
    ['audio', '音频合成器', 'AUDIO'],
    ['fx', '视觉特效', 'EFFECTS'],
    ['stages', '对战场景', 'STAGES'],
    ['illust', '立绘与标题', 'ILLUSTRATION'],
    ['rig', '角色动画', 'ANIMATION'],
    ['fight', '战斗引擎', 'FIGHT ENGINE']
  ];

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function runInits(state) {
    var i = 0;
    function next() {
      if (i >= STEPS.length) return Promise.resolve();
      var st = STEPS[i], k = i;
      state.cur = k;
      var mod = st[0] === 'platform' ? LC.font : LC[st[0]];
      if (!mod || typeof mod.init !== 'function') { state.status[k] = 'missing'; i++; return next(); }
      state.status[k] = 'run';
      if (!LC.app.opts.manual) try { LC.app._render(); } catch (e) { /* ignore */ }
      var t0 = performance.now();
      return wait(1).then(function () {
        var r;
        try { r = mod.init(); } catch (e) { return Promise.reject(e); }
        return Promise.race([Promise.resolve(r), wait(12000).then(function () { throw new Error('init timed out'); })]);
      }).then(function () {
        state.status[k] = 'ok';
      }, function (e) {
        state.status[k] = 'err';
        console.error('[platform] ' + st[0] + '.init failed', e);
        LC.debug.errors.push({ message: st[0] + '.init: ' + (e && e.message || e), stack: e && e.stack });
      }).then(function () {
        LC.debug.initTimes[st[0]] = Math.round(performance.now() - t0);
        i++;
        return next();
      });
    }
    return next();
  }

  LC.scenes.define('boot', function () {
    var state = { status: STEPS.map(function () { return 'wait'; }), cur: 0, done: false, gate: false, gateT: 0 };
    var opts = LC.app.opts;
    return {
      music: undefined,
      enter: function () {
        runInits(state).then(function () {
          state.done = true;
          if (LC.input.touch) LC.input.touch.redraw();
          if (LC.ui.clearArtCache) LC.ui.clearArtCache();
          if (LC.audio && LC.audio.setVolume) {
            try { ['master', 'music', 'sfx'].forEach(function (k) { LC.audio.setVolume(k, LC.app.muted ? 0 : LC.settings[k]); }); } catch (e) { console.error('[platform] audio.setVolume', e); }
          }
          if (opts.scene && opts.scene !== 'boot') {
            if (opts.scene === 'match') LC.debug.goto('match', opts);
            else LC.scenes.go(opts.scene, Object.assign({}, opts), { transition: 'none' });
          } else state.gate = true;
          LC.debug._resolveReady();
        });
      },
      update: function () {
        if (state.gate) {
          state.gateT++;
          if (state.gateT > 8 && LC.input.anyPressed()) {
            LC.ui.sfx('ui.start');
            LC.scenes.go('title', {}, { transition: 'iris', frames: 18 });
            state.gate = false;
          }
        }
      },
      draw: function (c) {
        var t = this.t;
        c.fillStyle = U.bg0; c.fillRect(0, 0, W, H);
        if (state.gate || state.done) LC.ui.backdrop(c, t, { speed: 0.2 });
        // title lettering
        var ly = state.gate ? 56 : 44;
        LC.font.draw(c, LC.TITLE_ZH, W >> 1, ly, { size: 12, scale: 2, color: U.text, outline: U.bg2, shadow: U.black, align: 'center' });
        LC.font.draw(c, LC.TITLE_EN, W >> 1, ly + 30, { size: 8, color: U.gold, align: 'center', spacing: 2 });
        var done = state.status.filter(function (s) { return s !== 'wait' && s !== 'run'; }).length;
        if (!state.gate) {
          // module list
          var x0 = 112, y0 = 96;
          STEPS.forEach(function (st, i) {
            var s = state.status[i], y = y0 + i * 12;
            var col = s === 'ok' ? U.text : s === 'run' ? U.gold : s === 'err' ? U.red : s === 'missing' ? '#4f4a78' : '#3b3670';
            LC.font.draw(c, st[1], x0, y, { size: 10, color: col });
            LC.font.draw(c, st[2], x0 + 68, y + 1, { size: 8, color: s === 'wait' ? '#2b2758' : U.dim });
            var mark = s === 'ok' ? 'OK' : s === 'run' ? ['·  ', '·· ', '···'][(t >> 3) % 3] : s === 'err' ? 'ERR' : s === 'missing' ? '—' : '';
            LC.font.draw(c, mark, W - x0, y + 1, { size: 8, color: s === 'ok' ? U.green : s === 'err' ? U.red : U.dim, align: 'right' });
          });
          // progress bar
          var bw = 160, bx = (W - bw) >> 1, by = 186;
          LC.ui.bar(c, bx, by, bw, 5, done + (state.status[state.cur] === 'run' ? 0.5 : 0), STEPS.length, U.gold, {});
          LC.font.draw(c, 'LOADING', bx, by + 9, { size: 8, color: U.dim, spacing: 1 });
          LC.font.draw(c, Math.round(done / STEPS.length * 100) + '%', bx + bw, by + 9, { size: 8, color: U.dim, align: 'right' });
        } else {
          var a = LC.ui.ease.out(state.gateT / 30);
          LC.font.draw(c, LC.LORE.tagline, W >> 1, 110 + Math.round((1 - a) * 6), { size: 12, color: U.dim, align: 'center', shadow: U.black, alpha: a });
          if (LC.ui.blink(t, 60, 0.7)) {
            LC.font.draw(c, '点击画面 / 按任意键开始', W >> 1, 150, { size: 12, color: U.gold, align: 'center', outline: U.black });
          }
          LC.font.draw(c, 'CLICK OR PRESS ANY KEY', W >> 1, 166, { size: 8, color: U.dim, align: 'center', spacing: 1 });
          LC.font.draw(c, LC.display.touchDetected ? '建议横屏游玩 · 支持触屏 / 键盘 / 手柄' : '支持键盘 / 手柄 / 触屏', W >> 1, H - 18, { size: 10, color: '#4f4a78', align: 'center' });
        }
      }
    };
  });
})();
