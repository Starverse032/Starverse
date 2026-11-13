/* LATENT CLASH — game flow: sessions, match configs, arcade ladder, post-match routing (PLATFORM). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var app = LC.app = LC.app || {};
  var LORE = LC.LORE;

  function other(ch) { return ch === 'claude' ? 'deepseek' : 'claude'; }
  function clampLv(v) { return Math.max(1, Math.min(5, v | 0)); }
  function homeOf(ch) { for (var k in LORE.stages) if (LORE.stages[k].home === ch) return k; return 'latent'; }
  app.other = other;
  app.homeOf = homeOf;
  app.charName = function (ch) { return (LORE.chars[ch] || LORE.chars.claude).nameZh; };
  app.stageIds = function () {
    var ids = LC.STAGES.slice();
    try { if (LC.stages && LC.stages.list) { var l = LC.stages.list().map(function (s) { return s.id; }); if (l.length) ids = l; } } catch (e) { console.error('[platform] stages.list', e); }
    return ids;
  };
  app.randomSeed = function () { return (Math.random() * 0x7fffffff) | 0; };

  // Normalise a player description: accepts 'claude' or { char, palette, control, level }.
  function side(p, flat, idx, mode) {
    var o = typeof p === 'string' ? { char: p } : Object.assign({}, p || {});
    if (!o.char && flat['p' + (idx + 1)] && typeof flat['p' + (idx + 1)] === 'string') o.char = flat['p' + (idx + 1)];
    if (LC.CHARS.indexOf(o.char) < 0) o.char = idx === 0 ? 'claude' : 'deepseek';
    if (o.palette == null) o.palette = flat['pal' + (idx + 1)] != null ? +flat['pal' + (idx + 1)] : 0;
    if (o.control == null) o.control = flat['ctl' + (idx + 1)] || (mode === 'demo' ? 'cpu' : idx === 0 ? 'human' : 'cpu');
    if (o.level == null) o.level = flat.level != null ? +flat.level : LC.settings.difficulty;
    o.palette = o.palette ? 1 : 0;
    o.level = clampLv(o.level);
    return o;
  }

  // Build a complete LC.fight.createMatch config from partial params / boot options.
  app.matchConfig = function (p) {
    p = p || {};
    var opts = app.opts || {};
    var mode = p.mode || 'versus';
    var p1 = side(p.p1, p, 0, mode), p2 = side(p.p2, p, 1, mode);
    if (p1.char === p2.char && p1.palette === p2.palette) p2.palette = 1 - p1.palette;
    var stage = p.stage || (mode === 'training' ? 'training' : homeOf(p2.char));
    if (stage === 'random') { var ids = app.stageIds(); stage = ids[(Math.random() * ids.length) | 0]; }
    var cfg = {
      mode: mode, p1: p1, p2: p2, stage: stage,
      rounds: p.rounds || LC.settings.rounds, time: p.time != null ? p.time : LC.settings.time,
      seed: p.seed != null ? +p.seed : (opts.seed != null ? opts.seed : app.randomSeed()),
      intro: p.intro != null ? !!p.intro : !(opts.skipIntro || p.skipIntro),
      introLines: p.introLines || null,
      startMeter: p.startMeter || [0, 0]
    };
    if (mode === 'training') {
      cfg.training = Object.assign({ dummy: 'stand', guard: 'none', refill: true, meter: 'normal', hitboxes: false, inputs: true, data: true }, p.training || {});
      cfg.time = 0;
      cfg.intro = false;
    }
    if (mode === 'demo') cfg.intro = p.intro != null ? !!p.intro : true;
    return cfg;
  };

  // ---------------------------------------------------------------- arcade
  app.newArcade = function (ch, pal) {
    app.session = { mode: 'arcade', vs: 'pvc', arcade: { char: ch, palette: pal, stage: 0, score: 0, continues: 0, wins: 0, history: [] } };
    return app.session;
  };
  app.arcadeFightParams = function () {
    var A = app.session.arcade, step = LORE.arcade[A.stage];
    var foe = step.foe === 'mirror' ? A.char : other(A.char);
    var pal = step.palette;
    if (foe === A.char && pal === A.palette) pal = 1 - A.palette;
    var stage = step.stage === 'rivalHome' ? homeOf(foe) : step.stage === 'ownHome' ? homeOf(A.char) : step.stage;
    var intro = null, me = LORE.chars[A.char];
    var foeLines = step.foe === 'mirror' ? LORE.arcadeTaunt.mirror[A.char] : step.boss ? LORE.arcadeTaunt.boss[foe] : null;
    if (foeLines) intro = [(me.intro[foe] || []).slice(), foeLines.slice()];
    return {
      mode: 'arcade',
      p1: { char: A.char, palette: A.palette, control: 'human' },
      p2: { char: foe, palette: pal, control: 'cpu', level: clampLv(LC.settings.difficulty + (step.levelDelta || 0)) },
      stage: stage, introLines: intro, startMeter: step.boss ? [0, 50] : [0, 0]
    };
  };
  app.fallbackScore = function (r, side) {
    if (!r || r.winner !== side) return 0;
    var s = 10000 + (r.timeLeft || 0) * 100;
    if (r.perfect) s += 20000;
    var st = r.stats && r.stats[side];
    if (st) s += (st.maxCombo || 0) * 500 + (st.supers || 0) * 3000 + (st.damage || 0) * 2;
    return s;
  };

  // ---------------------------------------------------------------- after a match
  // Called by the match scene once match.finished. Routes to the next scene.
  app.afterMatch = function (cfg, result) {
    var S = LC.scenes;
    result = result || { winner: -1, roundsWon: [0, 0], stats: [{}, {}] };
    if (cfg.mode === 'demo') { S.go('title', { fromDemo: true }, { transition: 'dissolve' }); return; }
    if (cfg.mode === 'arcade') {
      var A = app.session && app.session.arcade;
      if (!A) { S.go('menu'); return; }
      var won = result.winner === 0;
      var gained = won ? (typeof result.score === 'number' && result.score > 0 ? result.score : app.fallbackScore(result, 0)) : 0;
      A.history.push({ stage: A.stage, won: won, score: gained });
      if (won) { A.score += gained; A.wins++; }
      S.go('result', { cfg: cfg, result: result, arcade: true, gained: gained }, { transition: 'iris' });
      return;
    }
    S.go('result', { cfg: cfg, result: result }, { transition: 'iris' });
  };
  // From the arcade result screen: continue the ladder.
  app.arcadeNext = function (won) {
    var S = LC.scenes, A = app.session.arcade;
    if (!won) { S.go('continue', {}, { transition: 'dissolve' }); return; }
    A.stage++;
    if (A.stage >= LORE.arcade.length) {
      var best = LC.save.get('bestScore', 0) || 0;
      A.newRecord = A.score > best;
      if (A.newRecord) LC.save.set('bestScore', A.score);
      var cleared = LC.save.get('cleared', {}) || {};
      cleared[A.char] = true; LC.save.set('cleared', cleared);
      S.go('ending', {}, { transition: 'dissolve', frames: 30, color: '#fff7e8' });
    } else S.go('ladder', {}, { transition: 'slash' });
  };
})();
