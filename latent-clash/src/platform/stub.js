/* LATENT CLASH — stub match (PLATFORM). Used only when LC.fight is missing (or createMatch
 * throws), so the whole arcade / versus / training flow stays playable and testable.
 * Same interface as an LC.fight match (§5.2). Rules: attack buttons near the opponent chip
 * their HP; number keys decide the current round (1 = P1, 2 = P2, 0 = time over / draw). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H, ui = LC.ui;
  var DMG = { L: 35, M: 65, H: 100, S: 120 };

  function Fighter(i, p) {
    this.i = i; this.char = p.char; this.pal = p.palette; this.control = p.control; this.level = p.level || 3;
    this.hp = 1000; this.lag = 1000; this.meter = 0; this.x = i ? 240 : 144; this.cd = 0; this.flash = 0; this.act = 'idle'; this.actT = 0;
    this.stats = { damage: 0, maxCombo: 0, hits: 0, specials: 0, supers: 0, throws: 0 }; this.combo = 0; this.comboT = 0;
    this.puppet = ui.puppet(p.char, p.palette);
  }

  LC.app.createStubMatch = function (cfg) {
    var F = [new Fighter(0, cfg.p1), new Fighter(1, cfg.p2)];
    var st = null;
    if (LC.stages && LC.stages.create) { try { st = LC.stages.create(cfg.stage); } catch (e) { console.error('[platform] stub stage', e); } }
    var seed = (cfg.seed >>> 0) || 1;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    var training = cfg.mode === 'training';
    var m = {
      stub: true, finished: false, result: null, tick: 0, state: 'intro', stateT: 0, round: 1, roundsWon: [0, 0],
      timer: cfg.time || 0, timerF: 0, trainingOpts: Object.assign({}, cfg.training || {}), announce: null, prevKeys: {}
    };
    if (!cfg.intro) m.stateT = 60;
    if (!LC.fight) ui.music('stage.' + cfg.stage, { fade: 0.4, restart: true });

    function say(text, sub, dur) { m.announce = { text: text, sub: sub, t: 0, dur: dur || 70 }; }
    function hit(a, b, btn) {
      var d = DMG[btn];
      b.hp = Math.max(training && m.trainingOpts.refill !== false ? 1 : 0, b.hp - d);
      b.flash = 6; a.stats.damage += d; a.stats.hits++; if (btn === 'S') a.stats.specials++;
      a.combo = a.comboT > 0 ? a.combo + 1 : 1; a.comboT = 40; a.stats.maxCombo = Math.max(a.stats.maxCombo, a.combo);
      a.meter = Math.min(100, a.meter + 6); b.meter = Math.min(100, b.meter + 4);
      ui.sfx(btn === 'H' || btn === 'S' ? 'hit.heavy' : btn === 'M' ? 'hit.medium' : 'hit.light');
      if (LC.fx && LC.fx.spawn) { try { LC.fx.spawn(btn === 'H' || btn === 'S' ? 'hit.heavy' : 'hit.light', b.x + 128, LC.GROUND_Y - 40, { facing: a.i ? -1 : 1 }); } catch (e) { /* ignore */ } }
      b.x += (b.x > a.x ? 1 : -1) * (btn === 'H' ? 10 : 4);
    }
    function endRound(w) {
      if (m.state !== 'fight') return;
      m.state = 'ko'; m.stateT = 0;
      if (w >= 0) m.roundsWon[w]++;
      say(w < 0 ? 'TIME UP' : 'K.O.', w < 0 ? '平局' : LC.LORE.chars[F[w].char].nameZh + ' 胜', 80);
      ui.sfx(w < 0 ? 'ann.timeup' : 'ann.ko');
      m.lastWinner = w;
    }
    function keyEdge(code) { var d = LC.input.held(code); var e = d && !m.prevKeys[code]; m.prevKeys[code] = d; return e; }

    m.update = function (in0, in1) {
      m.tick++; m.stateT++;
      if (st && st.update) st.update();
      if (LC.fx && LC.fx.update) { try { LC.fx.update(); } catch (e) { /* ignore */ } }
      F.forEach(function (f) { if (f.flash) f.flash--; if (f.cd) f.cd--; if (f.comboT) f.comboT--; else f.combo = 0; f.lag += (f.hp - f.lag) * 0.06; f.actT++; });
      if (m.announce) { m.announce.t++; if (m.announce.t > m.announce.dur) m.announce = null; }
      if (m.state === 'intro') {
        if (m.stateT === 1) say(m.round >= 3 ? 'FINAL ROUND' : 'ROUND ' + m.round, null, 50);
        if (m.stateT === 60) { say('FIGHT!', null, 40); ui.sfx('ann.fight'); }
        if (m.stateT >= 70) { m.state = 'fight'; m.stateT = 0; }
        return;
      }
      if (m.state === 'fight') {
        var ins = [in0 || {}, in1 || {}];
        F.forEach(function (f, i) {
          var o = F[1 - i], inp = ins[i];
          if (f.control === 'cpu' || (cfg.mode === 'demo')) {
            inp = {};
            var dist = Math.abs(o.x - f.x);
            if (training && m.trainingOpts.dummy !== 'cpu' && i === 1) inp = {};
            else {
              if (dist > 60) inp[o.x > f.x ? 'right' : 'left'] = true;
              if (dist < 72 && rnd() < 0.02 + f.level * 0.012) inp[['L', 'M', 'H', 'S'][(rnd() * 4) | 0]] = true;
            }
          }
          var sp = 1.6;
          if (inp.left) f.x -= sp; if (inp.right) f.x += sp;
          f.x = Math.max(24, Math.min(W - 24, f.x));
          f.act = inp.left || inp.right ? 'walk' : 'idle';
          if (!f.cd) ['S', 'H', 'M', 'L'].some(function (b) {
            if (!inp[b]) return false;
            f.cd = { L: 10, M: 16, H: 24, S: 30 }[b]; f.act = 'atk'; f.actT = 0;
            ui.sfx('whiff.' + (b === 'L' ? 'light' : b === 'M' ? 'medium' : 'heavy'));
            if (Math.abs(o.x - f.x) < 76) hit(f, o, b);
            return true;
          });
        });
        if (F[0].x > F[1].x - 30 && F[0].x < F[1].x) { F[0].x = F[1].x - 30; } else if (F[1].x > F[0].x - 30 && F[1].x < F[0].x) { F[1].x = F[0].x - 30; }
        if (cfg.time) { m.timerF++; if (m.timerF >= 60) { m.timerF = 0; m.timer--; if (m.timer <= 10 && m.timer > 0) ui.sfx('timer.tick'); } }
        if (keyEdge('Digit1')) { F[1].hp = 0; }
        if (keyEdge('Digit2')) { F[0].hp = 0; }
        if (keyEdge('Digit0')) { endRound(-1); return; }
        if (training) { F.forEach(function (f) { if (m.trainingOpts.refill !== false && f.hp < 1000 && f.comboT === 0) f.hp = Math.min(1000, f.hp + 8); if (m.trainingOpts.meter === 'full') f.meter = 100; }); return; }
        if (F[0].hp <= 0 || F[1].hp <= 0) endRound(F[0].hp <= 0 && F[1].hp <= 0 ? -1 : F[0].hp <= 0 ? 1 : 0);
        else if (cfg.time && m.timer <= 0) endRound(F[0].hp === F[1].hp ? -1 : F[0].hp > F[1].hp ? 0 : 1);
        return;
      }
      if (m.state === 'ko' && m.stateT > 100) {
        var need = cfg.rounds || 2;
        if (m.roundsWon[0] >= need || m.roundsWon[1] >= need || m.round >= need * 2 + 1) {
          m.state = 'matchEnd'; m.stateT = 0;
          var w = m.roundsWon[0] === m.roundsWon[1] ? -1 : m.roundsWon[0] > m.roundsWon[1] ? 0 : 1;
          m.result = {
            winner: w, roundsWon: m.roundsWon.slice(), perfect: w >= 0 && F[w].hp >= 1000, timeLeft: Math.max(0, m.timer),
            score: w === 0 ? 10000 + Math.max(0, m.timer) * 100 + F[0].hp * 10 : 0, stats: F.map(function (f) { return Object.assign({}, f.stats); })
          };
          say(w < 0 ? 'DRAW' : (cfg.p1.control === 'human' && cfg.p2.control !== 'human' ? (w === 0 ? 'YOU WIN' : 'YOU LOSE') : (w === 0 ? '1P WIN' : '2P WIN')), null, 110);
          ui.music(w === 0 || cfg.p2.control === 'human' ? 'victory' : null);
        } else {
          m.round++; m.state = 'intro'; m.stateT = 0; m.timer = cfg.time || 0;
          F.forEach(function (f, i) { f.hp = f.lag = 1000; f.x = i ? 240 : 144; });
        }
      }
      if (m.state === 'matchEnd' && m.stateT > 130) m.finished = true;
    };

    m.draw = function (c) {
      var cam = 128;
      if (st && st.drawBack) st.drawBack(c, cam);
      else { ui.backdrop(c, m.tick, { horizon: 120 }); ui.box(c, 0, LC.GROUND_Y, W, H - LC.GROUND_Y, '#15132a'); ui.box(c, 0, LC.GROUND_Y, W, 1, U.line); }
      if (LC.fx && LC.fx.draw) { try { LC.fx.draw(c, cam, 'back'); } catch (e) { /* ignore */ } }
      F.forEach(function (f, i) {
        var face = F[1 - i].x > f.x ? 1 : -1;
        if (f.puppet.setAnim) f.puppet.setAnim(f.act === 'walk' ? (face * (f.x - (f.px || f.x)) >= 0 ? 'walkF' : 'walkB') : f.act === 'atk' && f.actT < 20 ? '5M' : (m.state === 'matchEnd' && m.result ? (m.result.winner === i ? 'win' : 'lose') : 'idle'), m.tick);
        f.px = f.x;
        f.puppet.tick(m.tick, { x: f.x + cam, y: LC.GROUND_Y, vx: 0, vy: 0, facing: face, grounded: true });
        ui.box(c, (f.x - 16) | 0, LC.GROUND_Y - 1, 32, 3, st && st.shadowColor ? st.shadowColor : 'rgba(0,0,0,0.35)');
        f.puppet.draw(c, f.x | 0, LC.GROUND_Y, { facing: face, flash: f.flash ? 0.8 : 0, flashColor: '#ffffff' });
      });
      if (LC.fx && LC.fx.draw) { try { LC.fx.draw(c, cam, 'front'); } catch (e) { /* ignore */ } }
      if (st && st.drawFront) st.drawFront(c, cam);
      // HUD
      F.forEach(function (f, i) {
        var bw = 150, x = i ? W - 8 - bw : 8, y = 10;
        ui.box(c, x - 1, y - 1, bw + 2, 9, U.black);
        ui.box(c, x, y, bw, 7, '#2b2750');
        var lw = Math.round(bw * f.lag / 1000), hw = Math.round(bw * f.hp / 1000);
        ui.box(c, i ? x + bw - lw : x, y, lw, 7, U.hpLag);
        ui.box(c, i ? x + bw - hw : x, y, hw, 7, f.hp < 300 ? U.hpLow : U.hp);
        ui.box(c, i ? x + bw - hw : x, y, hw, 1, '#fff3b0');
        var face = ui.portrait(f.char, 'face', f.pal);
        LC.font.draw(c, LC.LORE.chars[f.char].name, i ? x + bw : x, y + 10, { size: 8, color: U.text, outline: U.black, align: i ? 'right' : 'left' });
        for (var k = 0; k < (cfg.rounds || 2); k++) ui.box(c, i ? x + bw - 6 - k * 8 : x + k * 8, y + 20, 6, 4, k < m.roundsWon[i] ? U.gold : '#2b2750');
        var mw = 80;
        ui.bar(c, i ? W - 8 - mw : 8, H - 12, mw, 4, f.meter, 100, f.meter >= 100 ? U.meterFull : U.meter, {});
        if (f.combo > 1) LC.font.draw(c, f.combo + ' HITS', i ? W - 10 : 10, 60, { size: 8, scale: 2, color: U.gold, outline: U.black, align: i ? 'right' : 'left' });
        if (face) c.drawImage(face, i ? x + bw + 1 - 24 : x - 1, y + 28);
      });
      var tm = cfg.time ? String(Math.max(0, m.timer)) : '∞';
      LC.font.draw(c, tm, W >> 1, 7, { size: 12, scale: tm.length > 2 ? 1 : 2, color: U.text, outline: U.black, align: 'center' });
      // stub notice
      ui.box(c, (W >> 1) - 96, 40, 192, 26, 'rgba(5,4,10,0.6)');
      LC.font.draw(c, '模拟对局（战斗引擎未载入）', W >> 1, 42, { size: 10, color: U.gold, align: 'center' });
      LC.font.draw(c, '攻击键削减体力 · 数字键 1/2 判定胜者 · 0 平局', W >> 1, 54, { size: 10, color: U.dim, align: 'center' });
      if (m.announce) {
        var a = m.announce, s = ui.ease.back(a.t / 10);
        var size = Math.max(1, Math.round(3 * s));
        LC.font.draw(c, a.text, W >> 1, 92, { size: 8, scale: size, color: U.gold, outline: '#7e3830', align: 'center' });
        if (a.sub) LC.font.draw(c, a.sub, W >> 1, 120, { size: 12, color: U.text, outline: U.black, align: 'center' });
      }
    };
    m.snapshot = function () {
      return {
        tick: m.tick, state: m.state === 'ko' ? 'ko' : m.state, round: m.round, timer: m.timer, roundsWon: m.roundsWon.slice(),
        fighters: F.map(function (f, i) { return { char: f.char, x: f.x + 128, y: LC.GROUND_Y, vx: 0, vy: 0, facing: F[1 - i].x > f.x ? 1 : -1, hp: f.hp, meter: f.meter, action: f.act, move: null, frame: f.actT, grounded: true, hitstun: 0, blockstun: 0, invuln: false, combo: f.combo }; }),
        projectiles: []
      };
    };
    m.setTraining = function (o) { Object.assign(m.trainingOpts, o || {}); };
    m.resetPositions = function () { F.forEach(function (f, i) { f.x = i ? 240 : 144; f.hp = f.lag = 1000; }); };
    m.destroy = function () { if (LC.fx && LC.fx.clear) { try { LC.fx.clear(); } catch (e) { /* ignore */ } } };
    return m;
  };
})();
