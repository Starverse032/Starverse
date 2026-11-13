/* LATENT CLASH — FIGHT CPU AI (levels 1–5).
 * Plays through the same input interface as a human: every tick it returns held-button states.
 * It perceives the opponent through a delayed observation buffer (reaction time by level) and
 * only uses what a player can see (positions, animation = current move/phase, projectiles,
 * whether its own attack connected). Behaviour: spacing/footsies, pokes at range, anti-airs,
 * level-dependent blocking incl. high/low guesses, throws/techs, whiff punishes, hit-confirmed
 * chains → specials → super, projectile play, character plans, wake-up options, anti-repetition. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var T = F.T;

  var LV = [
    { react: 28, block: 0.12, guess: 0.5, aa: 0.04, punish: 0.06, depth: 0, confirm: 30, tech: 0.03, sup: 0.15, think: 16, aggr: 0.45, jump: 0.10, mash: 0.35 },
    { react: 22, block: 0.32, guess: 0.55, aa: 0.18, punish: 0.25, depth: 1, confirm: 16, tech: 0.10, sup: 0.35, think: 11, aggr: 0.50, jump: 0.09, mash: 0.15 },
    { react: 17, block: 0.58, guess: 0.64, aa: 0.42, punish: 0.5, depth: 2, confirm: 10, tech: 0.25, sup: 0.65, think: 8, aggr: 0.55, jump: 0.08, mash: 0.05 },
    { react: 13, block: 0.76, guess: 0.72, aa: 0.62, punish: 0.72, depth: 3, confirm: 7, tech: 0.40, sup: 0.85, think: 6, aggr: 0.6, jump: 0.07, mash: 0 },
    { react: 10, block: 0.88, guess: 0.8, aa: 0.78, punish: 0.86, depth: 3, confirm: 5, tech: 0.55, sup: 1.0, think: 4, aggr: 0.62, jump: 0.06, mash: 0 }
  ];

  function AI(m, side, level, seed) {
    this.m = m; this.side = side; this.rng = new F.RNG(seed >>> 0);
    this.setLevel(level);
    this.q = []; this.obs = []; this.recent = []; this.cool = {};
    this.guardT = 0; this.guardLow = false; this.idleT = 0; this.nextThink = 0;
    this.hitTick = -99; this.blockTick = -99; this.lastInst = -1; this.comboStep = 0;
    this.techTried = false; this.wakePlanned = false; this.jumpAtk = false; this.held = {};
  }
  F.AI = AI;

  AI.prototype.setLevel = function (l) { this.level = F.clamp(l | 0 || 3, 1, 5); this.P = LV[this.level - 1]; };

  AI.prototype.onContact = function (att, vic, what) {
    var me = this.m.f[this.side];
    if (att === me && what === 'hit') this.hitTick = this.m.tick;
    if (att === me && what === 'block') this.blockTick = this.m.tick;
  };

  // ------------------------------------------------------------------ perception
  AI.prototype.observe = function () {
    var m = this.m, o = m.f[1 - this.side], me = m.f[this.side];
    var ob = { x: o.x, y: o.y, air: o.air, vx: o.vx, vy: o.vy, act: o.action, mv: o.mv ? o.mv.id : null, kind: o.mv ? o.mv.kind : null,
      ph: o.mv ? o.phase() : null, hit: o.connected, guard: null, reach: 0, projs: [] };
    if (o.mv && o.mv.hits && o.mv.hits.length) {
      var h = o.mv.hits[0];
      ob.guard = o.mv.stance === 'air' || o.air ? 'high' : (h.guard || 'mid');
      ob.reach = h.box ? h.box[0] + h.box[2] : (h.beam ? 400 : 60);
      if (o.mv.whale) ob.reach = 190;
    }
    for (var i = 0; i < m.projs.length; i++) { var p = m.projs[i]; if (p.owner === o) ob.projs.push({ x: p.x, y: p.y, vx: p.vx }); }
    this.obs.push(ob);
    if (this.obs.length > 40) this.obs.shift();
  };
  AI.prototype.seen = function () {
    var k = Math.max(0, this.obs.length - 1 - this.P.react);
    return this.obs[k];
  };

  // ------------------------------------------------------------------ input queue
  // step = { d: relative numpad dir, b: 'LMHS' subset, n: frames }
  AI.prototype.push = function (steps, name) {
    for (var i = 0; i < steps.length; i++) this.q.push(steps[i]);
    if (name) { this.recent.push(name); if (this.recent.length > 10) this.recent.shift(); }
  };
  AI.prototype.emit = function () {
    var me = this.m.f[this.side], s = this.q[0], out = {};
    var d = s.d || 5, fx = (d % 3 === 0) ? 1 : (d % 3 === 1 ? -1 : 0), fy = d >= 7 ? 1 : (d <= 3 ? -1 : 0);
    var ax = fx * me.facing;
    if (ax > 0) out.right = true; else if (ax < 0) out.left = true;
    if (fy > 0) out.up = true; else if (fy < 0) out.down = true;
    var b = s.b || '';
    for (var i = 0; i < b.length; i++) out[b[i]] = true;
    if (--s.n <= 0) this.q.shift();
    return out;
  };
  function motion(seq, btn) {
    var out = [];
    for (var i = 0; i < seq.length; i++) out.push({ d: seq[i], n: 2, b: i === seq.length - 1 ? btn : '' });
    out.push({ d: 5, n: 1 });
    return out;
  }
  var MOT = { '236': [2, 3, 6], '623': [6, 2, 3], '214': [2, 1, 4], '22': [2, 5, 2], '236236': [2, 3, 6, 2, 3, 6] };
  AI.prototype.special = function (id, str) {
    var me = this.m.f[this.side], mv = me.C.moves[id];
    if (!mv) return [];
    var b = str || this.pick(['L', 'M', 'H']);
    return motion(MOT[mv.motion] || [5], b);
  };
  AI.prototype.press = function (b, d) { return [{ d: d || 5, b: b, n: 2 }, { d: d || 5, n: 1 }]; };
  AI.prototype.pick = function (a) { return a[this.rng.int(a.length)]; };
  AI.prototype.chance = function (p) { return this.rng.next() < p; };

  // ------------------------------------------------------------------ main
  AI.prototype.think = function () {
    var m = this.m, me = m.f[this.side], o = m.f[1 - this.side];
    this.observe();
    if (m.state !== 'fight' || m.freeze > 0) {
      if (m.state !== 'fight') { this.q.length = 0; return {}; }
      return this.q.length ? this.emit() : this.holdGuard(me, o);
    }
    if (me.action !== 'thrown') this.techTried = false;
    if (me.action === 'thrown' && !this.techTried) {
      this.techTried = true;
      if (this.chance(this.P.tech)) { this.q.length = 0; this.push([{ d: 5, n: 2 + this.rng.int(3), b: '' }, { d: 5, b: 'LM', n: 2 }]); }
    }
    if (this.q.length) return this.emit();
    var pv = this.seen();
    var dx = Math.abs(o.x - me.x);
    var a = me.action;

    if (a === 'attack') return this.inMove(me, o, pv, dx) || {};
    if (a === 'blockstun') { this.guardT = Math.max(this.guardT, 4); return this.holdGuard(me, o, pv); }
    if (a === 'down' || a === 'getup') return this.wakeup(me, o, dx);
    if (a === 'jump') return this.air(me, o, pv, dx);
    if (a === 'hitstun' || a === 'launch' || a === 'caught' || a === 'thrown' || a === 'dashF' || a === 'dashB' || a === 'land' || a === 'jumpSquat') {
      this.wakePlanned = false;
      return {};
    }
    this.wakePlanned = false;
    return this.neutral(me, o, pv, dx);
  };

  AI.prototype.holdGuard = function (me, o, pv) {
    var low = this.guardLow;
    if (pv && pv.guard && this.guessFor !== pv) {
      this.guessFor = pv;
      if (pv.guard === 'high') low = this.chance(this.P.guess) ? false : low;
      else if (pv.guard === 'low') low = this.chance(this.P.guess) ? true : low;
    }
    if (this.guardT > 0) this.guardT--;
    this.guardLow = low;
    var out = {};
    if (o.x > me.x) out.left = true; else out.right = true;
    if (low) out.down = true;
    return out;
  };

  // ------------------------------------------------------------------ defense / neutral
  AI.prototype.threat = function (me, pv, dx) {
    if (!pv) return null;
    var pdx = Math.abs(pv.x - me.x);
    if (pv.act === 'attack' && (pv.ph === 'startup' || pv.ph === 'active') && pv.kind !== 'throw' && pdx < pv.reach + 34) return 'strike';
    if (pv.air && pdx < 110 && F.sign(me.x - pv.x) === F.sign(pv.vx || 0)) return 'air';
    for (var i = 0; i < pv.projs.length; i++) {
      var p = pv.projs[i];
      if (F.sign(me.x - p.x) === F.sign(p.vx) && Math.abs(p.x - me.x) < 150) return 'proj:' + Math.abs(p.x - me.x);
    }
    return null;
  };

  AI.prototype.neutral = function (me, o, pv, dx) {
    var P = this.P, C = me.ch, m = this.m;
    // keep guarding briefly once committed
    if (this.guardT > 0) {
      var tn = this.threat(me, pv, dx);
      if (tn || this.guardT > 0) return this.holdGuard(me, o, pv);
    }
    var th = this.threat(me, pv, dx);
    if (th) {
      if (th === 'air') {
        if (this.chance(P.aa * 0.25) || (this.aaRolled !== pv && (this.aaRolled = pv) && this.chance(P.aa))) {
          var air = dx < 70;
          if (air && this.chance(0.7)) { this.push(this.special(C === 'claude' ? 'sonnet' : 'breach', this.level >= 4 ? 'H' : 'M'), 'aa'); return this.emit(); }
          if (dx < 60) { this.push(this.press('H'), 'aa5H'); return this.emit(); }
        }
        if (this.chance(P.block)) { this.guardT = 14; this.guardLow = false; return this.holdGuard(me, o, null); }
        return this.hold(me, o, dx);
      }
      if (th.indexOf('proj') === 0) {
        var pd = +th.slice(5);
        if (C === 'claude' && pd > 40 && this.chance(P.block * 0.25) && me.proj === 0) { this.push(this.special('spark', this.pick(['M', 'H'])), 'clash'); return this.emit(); }
        if (C === 'claude' && pd < 70 && pd > 24 && this.chance(P.block * 0.2)) { this.push(this.special('guardrail', 'M'), 'absorb'); return this.emit(); }
        if (pd > 50 && pd < 110 && dx > 110 && this.chance(P.block * 0.35)) { this.push([{ d: 9, n: 3 }], 'jumpProj'); this.jumpAtk = true; return this.emit(); }
        if (this.chance(P.block + 0.1)) { this.guardT = 12; this.guardLow = true; return this.holdGuard(me, o, null); }
      }
      if (th === 'strike' && this.blockRolled !== pv) {
        this.blockRolled = pv;
        if (this.chance(P.block)) {
          this.guardT = 16;
          this.guardLow = pv.guard === 'low' ? this.chance(P.guess) : pv.guard === 'high' ? !this.chance(P.guess) : true;
          return this.holdGuard(me, o, null);
        }
      }
    }
    // whiff / block punish
    if (pv && pv.act === 'attack' && pv.ph === 'recovery' && pv.hit !== 'hit' && this.punRolled !== pv.mv + pv.x) {
      this.punRolled = pv.mv + pv.x;
      if (this.chance(P.punish)) { var pp = this.punisher(me, dx); if (pp) { this.push(pp, 'punish'); this.comboStep = 0; return this.emit(); } }
    }
    // opponent knocked down: approach or set up
    if (o.action === 'down' || o.action === 'getup') {
      if (dx > 90) { if (C === 'claude' && me.proj === 0 && this.chance(0.04)) { this.push(this.special('spark', 'L'), 'oki'); return this.emit(); } return { right: o.x > me.x, left: o.x < me.x }; }
      return this.hold(me, o, dx);
    }
    if (this.m.tick < this.nextThink) return this.hold(me, o, dx);
    this.nextThink = this.m.tick + P.think + this.rng.int(P.think);
    var plan = this.choose(me, o, dx);
    if (plan) { this.push(plan.steps, plan.name); return this.emit(); }
    return this.hold(me, o, dx);
  };

  // default between decisions: drift toward a preferred range, guard if the opponent looks active
  AI.prototype.hold = function (me, o, dx) {
    var want = me.ch === 'claude' ? 92 : 58;
    if (this.m.timer < 1800 && this.behind()) want -= 30;
    var out = {};
    var tow = o.x > me.x ? 'right' : 'left', away = o.x > me.x ? 'left' : 'right';
    this.idleT++;
    if (dx > want + 16) out[tow] = true;
    else if (dx < want - 30 && me.x > T.WALL + 30 && me.x < LC.STAGE_W - T.WALL - 30 && (this.m.tick >> 4) % 3 === 0) out[away] = true;
    return out;
  };
  AI.prototype.behind = function () {
    var me = this.m.f[this.side], o = this.m.f[1 - this.side];
    return me.hp / me.maxHp < o.hp / o.maxHp;
  };

  AI.prototype.reachOf = function (me, id) {
    var mv = me.C.moves[id];
    if (!mv || !mv.hits) return 0;
    var b = mv.hits[0].box;
    return b ? b[0] + b[2] : 0;
  };

  AI.prototype.punisher = function (me, dx) {
    var C = me.ch, d = this.P.depth;
    var r5H = this.reachOf(me, '5H') + 10, r5M = this.reachOf(me, '5M') + 10;
    if (dx <= this.reachOf(me, '5L') + 12 && d >= 2) return this.press('L');
    if (dx <= r5M) return this.press(d >= 1 ? 'M' : 'H');
    if (dx <= r5H) return this.press('H');
    if (C === 'deepseek' && dx < 110) return this.special('chain', dx > 80 ? 'H' : 'M');
    if (C === 'claude' && dx < 90) return this.special('haiku', 'H');
    return null;
  };

  AI.prototype.score = function (name, w) {
    var n = 0;
    for (var i = 0; i < this.recent.length; i++) if (this.recent[i] === name) n++;
    return w * Math.pow(0.55, n);
  };

  AI.prototype.choose = function (me, o, dx) {
    var C = me.ch, P = this.P, m = this.m, opts = [], self = this;
    var urgency = (m.timerMax > 0 && m.timer < 1500 ? 0.5 : 0) + (this.behind() ? 0.3 : 0) + Math.min(0.6, this.idleT / 400);
    var ag = P.aggr + urgency;
    function add(name, w, steps) { if (w > 0 && steps && steps.length) opts.push({ name: name, w: self.score(name, w), steps: steps }); }
    var r = function (id) { return self.reachOf(me, id) + 12; };
    var full = me.meter >= 100;
    // universal
    add('walkF', 0.6 + ag * 0.6, [{ d: 6, n: 10 + this.rng.int(20) }]);
    add('walkB', dx < 120 ? 0.35 : 0.1, [{ d: 4, n: 8 + this.rng.int(14) }]);
    add('wait', 0.25 * (1 - ag), [{ d: dx < 80 ? 1 : 4, n: 8 + this.rng.int(12) }]);
    if (dx > 70) add('dashF', 0.25 + ag * 0.4 * (C === 'deepseek' ? 1.6 : 0.8), [{ d: 6, n: 2 }, { d: 5, n: 2 }, { d: 6, n: 2 }, { d: 5, n: 1 }]);
    if (dx < 70 && me.x > T.WALL + 50 && me.x < LC.STAGE_W - T.WALL - 50) add('dashB', 0.15, [{ d: 4, n: 2 }, { d: 5, n: 2 }, { d: 4, n: 2 }, { d: 5, n: 1 }]);
    var jr = C === 'claude' ? [70, 130] : [70, 150];
    if (dx > jr[0] && dx < jr[1]) add('jumpIn', P.jump * 4 * (0.6 + ag), [{ d: 9, n: 3 }]);
    if (dx < 70) add('jumpN', P.jump, [{ d: 8, n: 3 }]);
    // pokes at range
    if (dx <= r('5L')) { add('5L', 0.7, this.press('L')); add('2L', 0.7, this.press('L', 2)); }
    if (dx <= r('5M') && dx > r('5L') - 10) add('5M', 0.8, this.press('M'));
    if (dx <= r('2M') && dx > r('2L') - 10) add('2M', 0.8, this.press('M', 2));
    if (dx <= r('5H') && dx > r('5M') - 8) add('5H', 0.35, this.press('H'));
    if (dx <= r('2H') && dx > r('2M') - 8) add('2H', 0.3, this.press('H', 3));
    if (dx < me.C.throwRange - 2 && o.action !== 'blockstun') add('throw', 0.55 + ag * 0.3, [{ d: this.chance(0.3) ? 4 : 6, b: 'LM', n: 2 }, { d: 5, n: 1 }]);
    if (P.mash > 0 && dx < 80) add('mash', P.mash * 2, this.press(this.pick(['L', 'M', 'H', 'S']), this.pick([5, 2, 6])));
    if (full && dx < (C === 'claude' ? 200 : 120) && this.chance(P.sup * 0.15)) add('superRaw', 0.8, this.special('super', 'H'));
    if (C === 'claude') {
      if (me.proj === 0 && dx > 120) add('spark', 0.9 + (dx > 200 ? 0.8 : 0), this.special('spark', dx > 220 ? 'L' : this.pick(['M', 'H'])));
      if (me.proj === 0 && dx > 70 && dx <= 120) add('spark', 0.35, this.special('spark', 'H'));
      if (dx < 80 && dx > 30) add('haiku', 0.2, this.special('haiku', this.pick(['L', 'M'])));
      if (dx < 70 && this.level >= 3) add('guardrail', 0.12 + (o.action === 'attack' ? 0.1 : 0), this.special('guardrail', this.pick(['L', 'M'])));
    } else {
      if (me.proj === 0 && dx > 110) add('wave', 0.5 + (dx > 200 ? 0.3 : 0), this.special('wave', dx > 200 ? 'H' : 'M'));
      if (dx > 50 && dx < 110) add('chain', 0.35 + ag * 0.2, this.special('chain', dx > 90 ? 'H' : 'M'));
      if (dx > 90 && dx < 260 && this.level >= 2) add('diveM', 0.2 + ag * 0.15, this.special('dive', 'M'));
      if (dx > 60 && dx < 200 && this.level >= 3) add('diveH', 0.15 + ag * 0.1, this.special('dive', 'H'));
      if (dx > 90 && dx < 170) add('jumpKick', P.jump * 3, [{ d: 9, n: 3 }]);
    }
    if (!opts.length) return null;
    var tot = 0, i;
    for (i = 0; i < opts.length; i++) tot += opts[i].w;
    var x = this.rng.next() * tot;
    for (i = 0; i < opts.length; i++) { x -= opts[i].w; if (x <= 0) break; }
    var pick = opts[Math.min(i, opts.length - 1)];
    if (pick.name === 'jumpIn' || pick.name === 'jumpProj' || pick.name === 'jumpKick') { this.jumpAtk = pick.name; }
    if (pick.name !== 'wait') this.idleT = Math.max(0, this.idleT - 60);
    this.comboStep = 0;
    return pick;
  };

  // ------------------------------------------------------------------ air
  AI.prototype.air = function (me, o, pv, dx) {
    var h = me.height();
    if (me.airUsed || me.airSpecial) return {};
    var toward = F.sign(o.x - me.x) === me.facing;
    if (this.jumpAtk === 'jumpKick' && me.ch === 'deepseek' && me.vy > -2 && h > 30 && dx < 150 && toward) {
      this.jumpAtk = false; this.push(this.special('diveKick', dx > 100 ? 'H' : dx > 60 ? 'M' : 'L'), 'diveKick'); return this.emit();
    }
    if (me.ch === 'claude' && this.jumpAtk && me.vy > -1 && h > 30 && dx > 110 && me.proj === 0 && this.chance(0.05)) {
      this.jumpAtk = false; this.push(this.special('airSpark', 'M'), 'airSpark'); return this.emit();
    }
    if (me.vy > 0 && dx < 46 && h < 44 && h > 8 && toward) {
      this.jumpAtk = false; this.push(this.press(this.level >= 3 ? 'H' : this.pick(['L', 'M', 'H'])), 'jAtk'); return this.emit();
    }
    if (o.air && Math.abs(o.y - me.y) < 30 && dx < 40) { this.push(this.press(this.pick(['L', 'M'])), 'airToAir'); return this.emit(); }
    return {};
  };

  // ------------------------------------------------------------------ in a move: combos / follow-ups
  AI.prototype.inMove = function (me, o, pv, dx) {
    var mv = me.mv, P = this.P, C = me.ch;
    if (!mv) return {};
    var hit = me.connected === 'hit', blk = me.connected === 'block';
    if (!hit && !blk) return {};
    var since = this.m.tick - (hit ? this.hitTick : this.blockTick);
    if (since < P.confirm) return {};
    var key = me.moveInst;
    if (this.lastInst === key) return {};
    this.lastInst = key;
    var full = me.meter >= 100;
    if (mv.kind === 'normal' && mv.stance !== 'air') {
      // chain upward, then special
      if (P.depth <= 0 && !this.chance(0.3)) return {};
      var next = null;
      var stepOK = this.comboStep < P.depth + 1;
      if (blk && this.chance(0.5)) {
        if (mv.rank < 2 && this.chance(0.5)) next = this.press('M', mv.stance === 'crouch' ? 2 : 5);
        else if (C === 'claude' && me.proj === 0 && this.chance(0.4)) next = this.special('spark', 'M');
        else return {};
      } else if (mv.rank === 1 && stepOK) next = this.press(this.chance(0.6) ? 'M' : 'H', mv.stance === 'crouch' && this.chance(0.6) ? 2 : 5);
      else if (mv.rank === 2 && stepOK) next = this.press('H', mv.stance === 'crouch' && this.chance(0.4) ? 3 : 5);
      else if (P.depth >= 2 && hit) next = this.comboSpecial(me, dx, full);
      else if (P.depth >= 1 && hit && mv.rank === 3 && this.chance(0.5)) next = this.comboSpecial(me, dx, false);
      if (next) { this.comboStep++; this.q.length = 0; this.push(next, 'combo'); }
      return {};
    }
    if (mv.kind === 'special') {
      if (hit && full && P.depth >= 3 && this.chance(P.sup)) { this.q.length = 0; this.push(this.special('super', 'H'), 'superCombo'); return {}; }
      if (hit && full && P.depth >= 2 && this.chance(P.sup * 0.4)) { this.q.length = 0; this.push(this.special('super', 'H'), 'superCombo'); return {}; }
      if (mv.follow) {   // rekka: continue on hit; mix up on block
        this.lastInst = -1;
        if (hit || (blk && this.chance(this.level >= 4 ? 0.45 : 0.75))) { this.q.length = 0; this.push([{ d: 5, n: 2 + this.rng.int(3) }, { d: 5, b: 'M', n: 2 }, { d: 5, n: 1 }]); }
      }
    }
    return {};
  };

  AI.prototype.comboSpecial = function (me, dx, full) {
    var C = me.ch;
    if (full && this.P.depth >= 3 && this.chance(this.P.sup * 0.5)) return this.special('super', 'H');
    if (C === 'claude') return dx < 70 ? this.special('haiku', this.level >= 4 ? 'H' : 'M') : (me.proj === 0 ? this.special('spark', 'H') : null);
    return dx < 80 ? (this.chance(0.7) ? this.special('chain', 'H') : this.special('breach', 'H')) : (me.proj === 0 ? this.special('wave', 'H') : null);
  };

  // ------------------------------------------------------------------ wake-up
  AI.prototype.wakeup = function (me, o, dx) {
    if (me.action === 'down') {
      if (me.af < 6 && this.chance(this.level * 0.03)) return { L: (me.af & 1) === 1 };   // quick rise sometimes
      return {};
    }
    if (me.af < T.GETUP - 5 || this.wakePlanned) return this.holdGuard(me, o, null);
    this.wakePlanned = true;
    var close = dx < 70, oAtk = o.action === 'attack';
    var r = this.rng.next();
    if (close && r < 0.08 + this.level * 0.03) { this.push(this.special(me.ch === 'claude' ? 'sonnet' : 'breach', 'H'), 'reversal'); return this.emit(); }
    if (close && r < 0.18 + this.level * 0.03) { this.push([{ d: 4, n: 2 }, { d: 5, n: 2 }, { d: 4, n: 2 }, { d: 5, n: 1 }], 'wakeBack'); return this.emit(); }
    if (close && !oAtk && r < 0.3) { this.push([{ d: 6, b: 'LM', n: 2 }, { d: 5, n: 1 }], 'wakeThrow'); return this.emit(); }
    this.guardT = 16; this.guardLow = this.chance(0.6);
    return this.holdGuard(me, o, null);
  };
})();
