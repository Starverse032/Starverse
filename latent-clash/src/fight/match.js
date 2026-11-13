/* LATENT CLASH — FIGHT match: createMatch, the fixed-tick update (input → fighters → positions →
 * projectiles → strikes → KO/time), round flow (intro → ready → fight → ko → roundEnd →
 * matchEnd), camera, super flash, shake, speech bubbles, banners, snapshot and result. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var T = F.T, GY = T.GY;

  var START_SEP = 140;

  function defaults(cfg) {
    cfg = cfg || {};
    var S = F.settings();
    var c = {
      mode: cfg.mode || 'versus',
      stage: cfg.stage || 'library',
      rounds: Math.max(1, (cfg.rounds != null ? cfg.rounds : S.rounds) | 0 || 2),
      time: cfg.time != null ? cfg.time : (S.time != null ? S.time : 99),
      seed: (cfg.seed != null ? cfg.seed : 12345) >>> 0,
      intro: cfg.intro !== false,
      introLines: cfg.introLines || null,
      startMeter: cfg.startMeter || [0, 0],
      training: cfg.training || null
    };
    var lv = S.difficulty || 3;
    function pl(p, i) {
      p = p || {};
      return { char: F.chars[p.char] ? p.char : (i ? 'deepseek' : 'claude'), palette: p.palette | 0,
        control: p.control === 'cpu' ? 'cpu' : 'human', level: F.clamp(p.level | 0 || lv, 1, 5) };
    }
    c.p1 = pl(cfg.p1, 0); c.p2 = pl(cfg.p2, 1);
    if (c.mode === 'demo') { c.p1.control = 'cpu'; c.p2.control = 'cpu'; }
    if (c.mode === 'training') { c.time = 0; c.intro = false; }
    return c;
  }

  var TRAIN_DEF = { dummy: 'stand', guard: 'none', refill: true, meter: 'normal', hitboxes: false, inputs: true, data: true, level: 3 };

  function Match(cfg) {
    this.cfg = cfg = defaults(cfg);
    this.mode = cfg.mode;
    this.rng = new F.RNG(cfg.seed);
    this.cosm = new F.RNG(cfg.seed ^ 0x2545F491);   // cosmetic only (never feeds the sim)
    this.tick = 0;
    this.f = [new F.Fighter(this, 0, cfg.p1), new F.Fighter(this, 1, cfg.p2)];
    this.f[0].meter = F.clamp(cfg.startMeter[0] | 0, 0, 100);
    this.f[1].meter = F.clamp(cfg.startMeter[1] | 0, 0, 100);
    this.projs = [];
    this.round = 1; this.roundsWon = [0, 0]; this.finishes = [[], []];
    this.timerMax = cfg.time > 0 ? cfg.time * 60 : 0;
    this.timer = this.timerMax;
    this.state = 'intro'; this.st = 0;
    this.canAct = false; this.noHits = true;
    this.camX = (LC.STAGE_W - LC.W) / 2;
    this.freeze = 0; this.flash = null; this.slow = 0;
    this.shakeT = 0; this.shakeA = 0;
    this.topSide = 0;
    this.finished = false; this.result = null;
    this.bubbles = [null, null];
    this.banners = [];
    this.callouts = [];
    this.fade = 0;
    this.lastKill = null; this.endKind = null; this.roundWinner = -1;
    this.errors = 0; this.perfectRound = false;
    this.prevAtk = [false, false]; this.fadeDir = 0; this.fadeT = 0;
    this.training = null;
    if (this.mode === 'training') this.training = Object.assign({}, TRAIN_DEF, cfg.training || {});
    this.tdata = { last: 0, combo: 0, comboHits: 0, adv: null, pend: null, maxCombo: 0, startup: null };
    this.ai = [null, null];
    for (var i = 0; i < 2; i++) {
      var pc = i ? cfg.p2 : cfg.p1;
      if (pc.control === 'cpu' && F.AI) this.ai[i] = new F.AI(this, i, pc.level, cfg.seed + 977 * (i + 1));
    }
    if (this.training && this.training.dummy === 'cpu' && !this.ai[1] && F.AI) this.ai[1] = new F.AI(this, 1, this.training.level || 3, cfg.seed + 1954);
    this.stage = null;
    if (!F.headless && F.mod('stages', 'create')) {
      try { this.stage = LC.stages.create(cfg.stage); } catch (e) { F.err('stages.create ' + cfg.stage, e); this.stage = null; }
    }
    for (i = 0; i < 2; i++) F.attachPuppet(this.f[i]);
    if (!F.headless && F.mod('fx', 'clear')) { try { LC.fx.clear(); } catch (e) { F.err('fx.clear', e); } }
    F.music('stage.' + cfg.stage, { fade: 0.6, restart: true });
    this.placeFighters();
    if (this.mode === 'training') { this.enter('fight'); this.noHits = false; this.canAct = true; }
    else if (cfg.intro) this.enter('intro');
    else this.enter('ready');
  }
  F.Match = Match;

  F.createMatch = function (cfg) { return new Match(cfg); };

  Match.prototype.opp = function (f) { return f === this.f[0] ? this.f[1] : this.f[0]; };
  Match.prototype.rngFx = function () { return this.cosm.next(); };

  Match.prototype.placeFighters = function () {
    var c = LC.STAGE_W / 2;
    this.f[0].roundReset(c - START_SEP / 2, 1);
    this.f[1].roundReset(c + START_SEP / 2, -1);
    this.projs.length = 0;
    this.camX = c - LC.W / 2;
    for (var i = 0; i < 2; i++) this.resetPuppet(this.f[i]);
  };
  Match.prototype.resetPuppet = function (f) {
    if (f.puppet && f.puppet.reset && !F.headless) {
      try { f.pose(); f.puppet.reset({ x: f.x, y: f.y, vx: 0, vy: 0, facing: f.facing, grounded: true }); } catch (e) { F.err('rig.reset', e); }
    }
  };

  Match.prototype.enter = function (s) {
    this.state = s; this.st = 0;
    var f0 = this.f[0], f1 = this.f[1];
    if (s === 'intro') {
      f0.setActionRaw('intro'); f1.setActionRaw('intro');
      this.canAct = false; this.noHits = true;
      var L = this.cfg.introLines;
      if (!L) {
        var C = LC.LORE && LC.LORE.chars;
        L = [C ? (C[f0.ch].intro[f1.ch] || []) : [], C ? (C[f1.ch].intro[f0.ch] || []) : []];
      }
      this.introQ = [];
      var n = Math.max(L[0].length, L[1].length);
      for (var i = 0; i < n; i++) { if (L[0][i]) this.introQ.push([0, L[0][i]]); if (L[1][i]) this.introQ.push([1, L[1][i]]); }
      this.introI = -1; this.introNext = 50;
      F.voice(f0.ch, 'intro');
    } else if (s === 'ready') {
      this.canAct = false; this.noHits = true;
      if (f0.action === 'intro' || f0.action === 'win' || f0.action === 'lose') f0.setActionRaw('idle');
      if (f1.action === 'intro' || f1.action === 'win' || f1.action === 'lose') f1.setActionRaw('idle');
      this.bubbles = [null, null];
      var final = this.cfg.rounds > 1 && this.roundsWon[0] === this.cfg.rounds - 1 && this.roundsWon[1] === this.cfg.rounds - 1;
      this.banner(final ? 'finalRound' : ('round' + Math.min(this.round, 3)), final ? 'FINAL ROUND' : ('ROUND ' + this.round), 66);
      F.sfx('ann.round');
      this.stageEvent('roundStart', { round: this.round });
    } else if (s === 'fight') {
      this.canAct = true; this.noHits = false;
      if (this.mode !== 'training') { this.banner('fight', 'FIGHT!', 44); F.sfx('ann.fight'); }
    }
  };

  // ------------------------------------------------------------------ presentation hooks
  Match.prototype.banner = function (name, text, dur) {
    this.banners.push({ name: name, text: text, t: 0, dur: dur || 60 });
    if (this.banners.length > 3) this.banners.shift();
  };
  Match.prototype.say = function (side, text, dur) {
    this.bubbles[side] = { text: String(text), t: 0, dur: dur || 90 };
  };
  Match.prototype.addShake = function (amp, dur) {
    if (F.settings().shake === false) return;
    this.shakeA = Math.max(this.shakeT > 0 ? this.shakeA : 0, amp);
    this.shakeT = Math.max(this.shakeT, dur);
  };
  Match.prototype.stageEvent = function (name, data) {
    if (!this.stage || !this.stage.event || F.headless) return;
    try { this.stage.event(name, data || {}); } catch (e) { F.err('stage.event ' + name, e); }
  };
  Match.prototype.callout = function (side, text, color) {
    this.callouts.push({ side: side, text: text, color: color || LC.UI.gold, t: 0 });
    if (this.callouts.length > 4) this.callouts.shift();
  };

  Match.prototype.superFlash = function (f) {
    this.freeze = T.FLASH;
    this.flash = { who: f, side: f.side, t: 0, dur: T.FLASH };
    F.fx('super.charge', f.x, f.y - 40, { facing: f.facing, palette: f.pal, power: 1 });
    F.sfx('super.flash', { pan: F.pan(f.x, this.camX) });
    F.sfx('super.charge', { pan: F.pan(f.x, this.camX), vol: 0.8 });
    F.voice(f.ch, 'super');
    F.duck(0.5, 1.2);
    this.stageEvent('super', { side: f.side });
    var cry = LC.LORE && LC.LORE.chars[f.ch] && LC.LORE.chars[f.ch].cry;
    if (cry && cry['super']) this.say(f.side, cry['super'], 80);
  };

  Match.prototype.onMoveStart = function (f, mv) {
    if (this.training) {
      var td = this.tdata;
      if (f.side === 0 && mv.kind !== 'system') { td.startMove = mv.id; td.startTick = this.tick; }
    }
    if (this.aiHook) this.aiHook(f, mv);
  };

  Match.prototype.onContact = function (att, vic, what, dmg, h, kind, counter) {
    if (what === 'hit' && counter) this.callout(att.side, 'COUNTER', LC.UI.gold);
    if (what === 'catch') this.callout(att.side, '当身!', LC.UI.green);
    if (what === 'tech') { this.callout(0, 'TECH', LC.UI.text); this.callout(1, 'TECH', LC.UI.text); }
    if (this.training) {
      var td = this.tdata;
      if (what === 'hit') { td.last = dmg; td.combo = att.comboDmg; td.comboHits = att.combo; if (att.combo > td.maxCombo) td.maxCombo = att.combo; }
      if (what === 'hit' || what === 'block') {
        td.pend = { att: att, vic: vic, ta: -1, tv: -1 };
        if (td.startMove && att.side === 0 && td.startTick != null && att.mf != null) td.startup = att.mf + 1;
      }
    }
    if (this.ai[0]) this.ai[0].onContact(att, vic, what);
    if (this.ai[1]) this.ai[1].onContact(att, vic, what);
  };

  // ------------------------------------------------------------------ inputs
  var KEYS = ['left', 'right', 'up', 'down', 'L', 'M', 'H', 'S'];
  function clean(r) {
    var o = {};
    for (var i = 0; i < KEYS.length; i++) o[KEYS[i]] = !!(r && r[KEYS[i]]);
    return o;
  }
  var NONE = clean({});

  Match.prototype.inputFor = function (i, raw) {
    if (this.ai[i]) {
      var tr = this.training;
      if (!tr || i === 0 || tr.dummy === 'cpu') { try { return clean(this.ai[i].think()); } catch (e) { F.err('ai.think', e); return NONE; } }
    }
    if (this.training && i === 1 && this.dummyInput) return clean(this.dummyInput());
    return clean(raw);
  };

  // ------------------------------------------------------------------ main tick
  Match.prototype.update = function (in0, in1) {
    if (this.finished && this.state === 'done') return;
    try { this._update(in0, in1); }
    catch (e) {
      F.err('update', e);
      if (++this.errors > 30) { this.state = 'matchEnd'; this.finish(); }
    }
  };

  Match.prototype._update = function (in0, in1) {
    this.tick++; this.st++;
    var raw = [this.inputFor(0, in0), this.inputFor(1, in1)];
    var human = [this.f[0].control === 'human' && !this.ai[0], this.f[1].control === 'human' && !this.ai[1]];
    var anyPress = false;
    for (var i = 0; i < 2; i++) {
      var r = raw[i];
      if (human[i] && (r.L || r.M || r.H || r.S) && !this.prevAtk[i]) anyPress = true;
      this.prevAtk[i] = !!(r.L || r.M || r.H || r.S);
    }
    var step = true;
    if (this.slow > 0) { this.slow--; step = (this.tick & 1) === 0; }
    this.flow(anyPress);
    if (step) this.simulate(raw);
    else for (i = 0; i < 2; i++) this.f[i].inp.push(raw[i], true, this.f[i].facing);
    this.cosmetic(step);
  };
  Match.prototype.prevAtk = null;

  Match.prototype.simulate = function (raw) {
    var A = this.f[0], Bf = this.f[1], i;
    var frozen = this.freeze > 0;
    for (i = 0; i < 2; i++) this.f[i].inp.push(raw[i], frozen || this.f[i].stop > 0, this.f[i].facing);
    if (frozen) {
      this.freeze--;
      if (this.flash) { this.flash.t++; if (this.freeze <= 0) this.flash = null; }
      this.fxUpdate();
      return;
    }
    if (this.state === 'fight' && this.timerMax > 0 && this.timer > 0) this.timer--;
    A.step(Bf); Bf.step(A);
    this.resolvePositions();
    F.updateProjs(this);
    var ev = this._ev || (this._ev = []);
    ev.length = 0;
    F.collectStrikes(this, A, Bf, ev);
    F.collectStrikes(this, Bf, A, ev);
    for (i = 0; i < ev.length; i++) F.applyHit(this, ev[i].att, ev[i].vic, ev[i].h, ev[i]);
    this.resolvePositions();
    this.updateFacing();
    this.updateCombos();
    if (this.training && this.trainingTick) this.trainingTick();
    this.checkEnd();
    this.updateCamera();
    for (i = 0; i < 2; i++) {
      var f = this.f[i];
      f.pose();
      if (f.stop <= 0) f.tickPuppet();
    }
    if (!(A.stop > 0 && Bf.stop > 0)) this.fxUpdate();
    if (this.stage && this.stage.update && !F.headless) { try { this.stage.update(); } catch (e) { F.err('stage.update', e); } }
    this.watchdog();
  };

  Match.prototype.fxUpdate = function () {
    if (F.headless || !F.mod('fx', 'update')) return;
    try { LC.fx.update(); } catch (e) { F.err('fx.update', e); }
  };

  Match.prototype.cosmetic = function (step) {
    if (this.shakeT > 0) this.shakeT--;
    var i;
    for (i = this.banners.length - 1; i >= 0; i--) { var b = this.banners[i]; b.t++; if (b.t > b.dur) this.banners.splice(i, 1); }
    for (i = this.callouts.length - 1; i >= 0; i--) { var c = this.callouts[i]; c.t++; if (c.t > 60) this.callouts.splice(i, 1); }
    for (i = 0; i < 2; i++) {
      var bb = this.bubbles[i];
      if (bb) {
        var was = Math.floor(bb.t / 2);
        bb.t++;
        if (Math.floor(bb.t / 2) > was && Math.floor(bb.t / 2) <= bb.text.length && (bb.t & 3) === 0) F.sfx('text.blip', { vol: 0.35, pitch: i ? 1.25 : 1 });
        if (bb.t > bb.text.length * 2 + bb.dur) this.bubbles[i] = null;
      }
      var f = this.f[i];
      if (f.comboShow && f.combo === 0) { f.comboT++; if (f.comboT > 70) { f.comboShow = 0; f.comboT = 0; } }
    }
    if (this.fade > 0 && this.fadeDir < 0) this.fade = Math.max(0, this.fade - 0.08);
  };

  Match.prototype.resolvePositions = function () {
    var A = this.f[0], B = this.f[1];
    var dx = B.x - A.x, ad = Math.abs(dx);
    if (ad > T.MAXSEP && A.action !== 'thrown' && B.action !== 'thrown') {
      var over = ad - T.MAXSEP;
      var L = dx > 0 ? A : B, R = dx > 0 ? B : A;
      var lo = Math.max(0, L.px - L.x), ro = Math.max(0, R.x - R.px), tot = lo + ro;
      var lsh = tot > 0 ? over * lo / tot : over / 2;
      L.x += lsh; R.x -= over - lsh;
    }
    var lo2 = T.WALL, hi2 = LC.STAGE_W - T.WALL;
    A.x = F.clamp(A.x, lo2, hi2); B.x = F.clamp(B.x, lo2, hi2);
    var pa = F.pushBox(A), pb = F.pushBox(B);
    if (pa && pb && F.overlap(pa, pb)) {
      var left;
      if (A.x < B.x - 0.01) left = A;
      else if (B.x < A.x - 0.01) left = B;
      else if (A.air !== B.air) { var air = A.air ? A : B, gnd = A.air ? B : A; left = (air.vx * air.facing >= 0 ? (air.facing > 0 ? gnd : air) : (air.facing > 0 ? air : gnd)); }
      else left = A.facing > 0 ? A : B;
      var right = left === A ? B : A;
      var pl = left === A ? pa : pb, pr = left === A ? pb : pa;
      var o = pl.x + pl.w - pr.x;
      if (o > 0) {
        var lw = left.x <= lo2 + 0.01, rw = right.x >= hi2 - 0.01;
        if (lw && !rw) right.x += o;
        else if (rw && !lw) left.x -= o;
        else if (left.air && !right.air) left.x -= o;
        else if (right.air && !left.air) right.x += o;
        else { left.x -= o / 2; right.x += o / 2; }
        A.x = F.clamp(A.x, lo2, hi2); B.x = F.clamp(B.x, lo2, hi2);
        // still overlapping against a wall: shove the other one
        pa = F.pushBox(A); pb = F.pushBox(B);
        if (pa && pb && F.overlap(pa, pb)) {
          pl = left === A ? pa : pb; pr = left === A ? pb : pa;
          o = pl.x + pl.w - pr.x;
          if (o > 0) { if (left.x <= lo2 + 0.01) right.x += o; else left.x -= o; }
          A.x = F.clamp(A.x, lo2, hi2); B.x = F.clamp(B.x, lo2, hi2);
        }
      }
    }
  };

  var TURN = { idle: 1, walkF: 1, walkB: 1, crouch: 1, guard: 1, land: 1 };
  Match.prototype.updateFacing = function () {
    for (var i = 0; i < 2; i++) {
      var f = this.f[i], o = this.f[1 - i];
      var turn = TURN[f.action] === 1 || (f.action === 'jumpSquat' && f.af <= 1) || (f.action === 'blockstun' && f.stun <= 1) ||
        (f.action === 'hitstun' && f.stun <= 1) || (f.action === 'getup' && f.af >= T.GETUP - 1);
      if (!turn) continue;
      var d = F.sign(o.x - f.x);
      if (d && d !== f.facing && Math.abs(o.x - f.x) >= 1) f.facing = d;
    }
  };

  Match.prototype.updateCombos = function () {
    for (var i = 0; i < 2; i++) {
      var f = this.f[i], o = this.f[1 - i];
      if (f.combo > 0) {
        var a = o.action;
        if (!(a === 'hitstun' || a === 'launch' || a === 'caught' || a === 'thrown')) {
          if (f.combo >= 2 && !this.training) { /* shown by HUD */ }
          f.combo = 0; f.comboT = 0;
        }
      }
    }
  };

  Match.prototype.updateCamera = function () {
    var A = this.f[0], B = this.f[1], W = LC.W, maxC = LC.STAGE_W - W;
    var tx = F.clamp((A.x + B.x) / 2 - W / 2, 0, maxC);
    var d = tx - this.camX;
    this.camX += Math.abs(d) < 0.3 ? d : d * 0.2;
    var lo = Math.max(A.x, B.x) - (W - 22), hi = Math.min(A.x, B.x) - 22;
    if (lo <= hi) this.camX = F.clamp(this.camX, lo, hi);
    this.camX = F.clamp(this.camX, 0, maxC);
  };

  Match.prototype.watchdog = function () {
    if (this.state !== 'fight') return;
    for (var i = 0; i < 2; i++) {
      var f = this.f[i];
      var k = f.action + '|' + (f.mv ? f.mv.id : '');
      if (k !== f.wdKey) { f.wdKey = k; f.wdT = 0; continue; }
      f.wdT++;
      var lim = (NEUTRAL_OK[f.action] ? 1e9 : 600);
      if (f.wdT > lim) {
        F.err('watchdog ' + f.ch + ' stuck in ' + k, '');
        f.mv = null; f.res = null; f.air = f.y < GY; f.vy = 0; f.stop = 0; f.victim = null; f.thrower = null;
        f.setActionRaw(f.air ? 'launch' : 'idle'); f.knock = 'reset'; f.juggle = 99;
        f.wdT = 0;
      }
    }
  };
  var NEUTRAL_OK = { idle: 1, walkF: 1, walkB: 1, crouch: 1, guard: 1, intro: 1, win: 1, lose: 1, down: 0 };
  F.NEUTRAL_OK = NEUTRAL_OK;

  // ------------------------------------------------------------------ round flow
  Match.prototype.checkEnd = function () {
    if (this.state !== 'fight' || this.training) return;
    var d0 = this.f[0].hp <= 0, d1 = this.f[1].hp <= 0;
    if (d0 || d1) this.startKO(d0, d1);
    else if (this.timerMax > 0 && this.timer <= 0) this.startTimeUp();
  };

  Match.prototype.startKO = function (d0, d1) {
    this.enter('ko');
    this.endKind = d0 && d1 ? 'double' : 'ko';
    this.canAct = false; this.noHits = true;
    this.roundWinner = d0 && d1 ? -1 : (d0 ? 1 : 0);
    for (var i = 0; i < 2; i++) {
      var f = this.f[i], dead = i === 0 ? d0 : d1;
      f.stop = Math.max(f.stop, T.KO_STOP);
      if (dead) {
        f.ko = true; f.juggle = 99;
        if (f.action === 'thrown') { f.thrower = null; }
        if (f.action !== 'launch' && f.action !== 'down') {
          f.mv = null; f.res = null; f.setActionRaw('launch'); f.knock = 'knock'; f.air = true;
          f.vx = -f.facing * 2.4; f.vy = -5.2; if (f.y >= GY) f.y = GY - 1;
        } else if (f.action === 'launch') { f.vy = Math.min(f.vy, -4.6); f.vx = F.sign(f.vx || -f.facing) * Math.max(Math.abs(f.vx), 2.4); }
        f.grav = 0.32;
        F.fx('ko.burst', f.x, f.y - 36, { facing: f.facing, palette: f.pal, power: 1 });
        F.voice(f.ch, 'ko');
      }
    }
    for (i = this.projs.length - 1; i >= 0; i--) F.killProj(this, this.projs[i], true);
    this.projs.length = 0;
    this.slowPending = T.KO_SLOW;
    this.koFlash = 24;
    this.addShake(4, 24);
    F.sfx('ko'); F.sfx('ann.ko');
    F.duck(0.6, 2);
    this.stageEvent('ko', {});
    this.banner(this.endKind === 'double' ? 'doubleKo' : 'ko', this.endKind === 'double' ? 'DOUBLE K.O.' : 'K.O.', 110);
  };

  Match.prototype.startTimeUp = function () {
    this.enter('ko');
    this.endKind = 'timeup';
    this.canAct = false; this.noHits = true;
    var r0 = this.f[0].hp / this.f[0].maxHp, r1 = this.f[1].hp / this.f[1].maxHp;
    this.roundWinner = Math.abs(r0 - r1) < 1e-9 ? -1 : (r0 > r1 ? 0 : 1);
    this.lastKill = { side: this.roundWinner, kind: 'time' };
    F.sfx('ann.timeup');
    this.banner('timeup', 'TIME UP', 100);
  };

  Match.prototype.settled = function (f) {
    if (f.air || f.stop > 0) return false;
    if (f.ko) return f.action === 'down' && f.af > 12;
    return f.action === 'idle' || f.action === 'crouch' || f.action === 'walkF' || f.action === 'walkB' || f.action === 'guard' || f.action === 'win' || f.action === 'lose';
  };

  Match.prototype.flow = function (anyPress) {
    var s = this.state, st = this.st, f0 = this.f[0], f1 = this.f[1];
    if (s === 'intro') {
      if (anyPress && st > 8) { this.enter('ready'); return; }
      if (st >= this.introNext) {
        this.introI++;
        if (this.introI >= this.introQ.length) { if (st > 120) this.enter('ready'); else this.introNext = st + 10; return; }
        var q = this.introQ[this.introI];
        this.say(q[0], q[1], 40);
        this.introNext = st + q[1].length * 2 + 52;
      }
      if (st > 900) this.enter('ready');
    } else if (s === 'ready') {
      if (st === 74) this.enter('fight');
    } else if (s === 'ko') {
      if (this.slowPending && f0.stop <= 0 && f1.stop <= 0) { this.slow = this.slowPending; this.slowPending = 0; }
      if (this.koFlash > 0) this.koFlash--;
      var ok = (this.settled(f0) && this.settled(f1)) || st > 420;
      if (this.endKind === 'timeup' && st === 1) { /* waiting for moves to finish */ }
      if (ok && st > (this.endKind === 'timeup' ? 70 : 110)) this.endRound();
    } else if (s === 'roundEnd') {
      if (st === 40 && this.perfectRound) { this.banner('perfect', 'PERFECT', 80); F.sfx('ann.perfect'); }
      if (st >= (this.perfectRound ? 150 : 120)) {
        if (this.decided()) { this.enter('matchEnd'); this.startMatchEnd(); }
        else if (!this.fadeDir || this.fadeDir < 0) { this.fadeDir = 1; this.fadeT = 0; }
      }
      if (this.fadeDir > 0) {
        this.fadeT++; this.fade = Math.min(1, this.fadeT / 16);
        if (this.fadeT === 20) { this.nextRound(); this.fadeDir = -1; }
      }
    } else if (s === 'matchEnd') {
      var bq = this.bubbles[this.result ? this.result.winner : 0];
      if (st === 70 && this.winQuote) this.say(this.winQuote[0], this.winQuote[1], 160);
      if ((anyPress && st > 50) || st > 520) this.finish();
    }
  };

  Match.prototype.endRound = function () {
    var w = this.roundWinner;
    this.enter('roundEnd');
    var f0 = this.f[0], f1 = this.f[1];
    var kind = this.lastKill ? this.lastKill.kind : 'normal';
    if (w === -1) {
      this.roundsWon[0]++; this.roundsWon[1]++;
      this.finishes[0].push('draw'); this.finishes[1].push('draw');
      if (this.endKind === 'timeup') { f0.setActionRaw('lose'); f1.setActionRaw('lose'); }
      if (this.endKind !== 'double') this.banner('draw', 'DRAW', 80);
      this.perfectRound = false;
    } else {
      this.roundsWon[w]++;
      var W = this.f[w], Lf = this.f[1 - w];
      this.perfectRound = W.hp >= W.maxHp;
      this.finishes[w].push(this.perfectRound ? 'perfect' : kind);
      W.mv = null; W.res = null; W.setActionRaw('win');
      if (this.endKind === 'timeup') Lf.setActionRaw('lose');
      F.voice(W.ch, 'win');
      if (this.perfectRound) this.perfects = (this.perfects || 0) + 1;
      if (w === 0) this.timeBonus = (this.timeBonus || 0) + Math.ceil(this.timer / 60);
    }
    this.lastRoundTime = Math.ceil(this.timer / 60);
  };

  Match.prototype.decided = function () {
    return this.roundsWon[0] >= this.cfg.rounds || this.roundsWon[1] >= this.cfg.rounds;
  };

  Match.prototype.nextRound = function () {
    this.round++;
    this.placeFighters();
    this.timer = this.timerMax;
    this.lastKill = null; this.endKind = null; this.roundWinner = -1; this.perfectRound = false;
    this.freeze = 0; this.flash = null; this.slow = 0; this.slowPending = 0;
    this.bubbles = [null, null]; this.callouts.length = 0;
    if (!F.headless && F.mod('fx', 'clear')) { try { LC.fx.clear(); } catch (e) { F.err('fx.clear', e); } }
    this.enter('ready');
  };

  Match.prototype.startMatchEnd = function () {
    var w = this.roundsWon[0] >= this.cfg.rounds && this.roundsWon[1] >= this.cfg.rounds ? -1 :
      (this.roundsWon[0] >= this.cfg.rounds ? 0 : 1);
    this.result = this.buildResult(w);
    var humans = (this.f[0].control === 'human' && !this.ai[0] ? 1 : 0) + (this.f[1].control === 'human' && !this.ai[1] ? 1 : 0);
    var name, text;
    if (w < 0) { name = 'draw'; text = 'DRAW'; }
    else if (humans === 1) {
      var hs = (this.f[0].control === 'human' && !this.ai[0]) ? 0 : 1;
      name = w === hs ? 'youWin' : 'youLose'; text = w === hs ? 'YOU WIN' : 'YOU LOSE';
    } else { name = w === 0 ? 'p1Win' : 'p2Win'; text = w === 0 ? '1P WIN' : '2P WIN'; }
    this.banner(name, text, 999);
    F.music('victory', { fade: 0.3, restart: true });
    F.sfx('ann.win');
    this.winQuote = null;
    if (w >= 0) {
      var W = this.f[w], Lf = this.f[1 - w], C = LC.LORE && LC.LORE.chars[W.ch];
      if (C) {
        var q = (C.winVs && C.winVs[Lf.ch] && this.cosm.next() < 0.6) ? C.winVs[Lf.ch] : C.win[this.cosm.int(C.win.length)];
        if (this.endKind === 'timeup' && Lf.action === 'lose' && LC.LORE.chars[Lf.ch].timeover) this.say(Lf.side, LC.LORE.chars[Lf.ch].timeover, 60);
        this.winQuote = [w, q];
      }
    }
  };

  Match.prototype.buildResult = function (w) {
    var p = this.f[0];
    var timeLeft = this.lastRoundTime != null ? this.lastRoundTime : Math.ceil(this.timer / 60);
    var perfect = !!(w >= 0 && this.finishes[w].length && this.finishes[w][this.finishes[w].length - 1] === 'perfect');
    var score = p.stats.damage * 10 + p.stats.maxCombo * 300 + this.roundsWon[0] * 3000 +
      (this.timeBonus || 0) * 50 + p.stats.supers * 1000 + (w === 0 ? 5000 : 0);
    if (w === 0 && perfect) score += 10000;
    return {
      winner: w, roundsWon: this.roundsWon.slice(), perfect: perfect, timeLeft: timeLeft, score: Math.round(score),
      finishes: [this.finishes[0].slice(), this.finishes[1].slice()],
      stats: [Object.assign({}, this.f[0].stats), Object.assign({}, this.f[1].stats)],
      rounds: this.round
    };
  };

  Match.prototype.finish = function () {
    if (this.finished) return;
    if (!this.result) this.result = this.buildResult(this.roundsWon[0] === this.roundsWon[1] ? -1 : (this.roundsWon[0] > this.roundsWon[1] ? 0 : 1));
    this.finished = true;
  };

  // ------------------------------------------------------------------ public API
  Match.prototype.snapshot = function () {
    var self = this;
    return {
      tick: this.tick, state: this.state === 'done' ? 'matchEnd' : this.state, round: this.round,
      timer: this.timerMax > 0 ? Math.ceil(this.timer / 60) : 99,
      roundsWon: this.roundsWon.slice(),
      fighters: this.f.map(function (f) {
        return {
          char: f.ch, x: f.x, y: f.y, vx: f.vx, vy: f.vy, facing: f.facing, hp: f.hp, meter: f.meter,
          action: f.action, move: f.mv ? f.mv.id : null, frame: f.action === 'attack' ? f.mf : f.af,
          grounded: !f.air, hitstun: f.action === 'hitstun' ? f.stun : 0, blockstun: f.action === 'blockstun' ? f.stun : 0,
          invuln: f.strikeInvuln(), combo: f.combo
        };
      }),
      projectiles: this.projs.map(function (p) { return { owner: p.owner.side, kind: p.kind, x: p.x, y: p.y }; })
    };
  };

  Match.prototype.setTraining = function (opts) {
    if (!this.training) return;
    for (var k in opts) this.training[k] = opts[k];
    if (opts.dummy === 'cpu' && !this.ai[1] && F.AI) this.ai[1] = new F.AI(this, 1, this.training.level || 3, this.cfg.seed + 1954);
    if (opts.level && this.ai[1]) this.ai[1].setLevel(opts.level);
    if (this.training.meter === 'full') { this.f[0].meter = 100; this.f[1].meter = 100; }
  };
  Match.prototype.resetPositions = function () {
    var m0 = this.f[0].meter, m1 = this.f[1].meter;
    this.placeFighters();
    this.f[0].meter = m0; this.f[1].meter = m1;
    this.freeze = 0; this.flash = null; this.slow = 0;
    this.tdata.pend = null;
    if (this.training) { this.state = 'fight'; this.canAct = true; this.noHits = false; }
    if (!F.headless && F.mod('fx', 'clear')) { try { LC.fx.clear(); } catch (e) { F.err('fx.clear', e); } }
  };
  Match.prototype.destroy = function () {
    this.finished = true;
    this.f.forEach(function (f) { f.puppet = null; });
    this.projs.length = 0;
    if (!F.headless && F.mod('fx', 'clear')) { try { LC.fx.clear(); } catch (e) { F.err('fx.clear', e); } }
  };

  // ------------------------------------------------------------------ module init
  F.init = function () {
    F.clearAnimCache();
    F.clearIllustCache();
    if (F.hudInit) { try { F.hudInit(); } catch (e) { F.err('hud.init', e); } }
    return Promise.resolve();
  };
})();
