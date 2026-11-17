/* LATENT CLASH — FIGHT CPU AI (levels 1–5).
 * Plays through the same input interface as a human: every tick it returns held-button states.
 * It perceives the opponent through a delayed observation buffer (reaction time by level) and
 * only uses what a player can see (positions, animation = current move/phase, projectiles,
 * whether its own attack connected). Behaviour: spacing/footsies, pokes at range, anti-airs,
 * level-dependent blocking incl. high/low guesses, throws/techs, whiff punishes, hit-confirmed
 * chains → specials → super, projectile play, character plans, wake-up options, anti-repetition. */
(function () {
  'use strict';
  // V2: tall fighters — every distance constant below was tuned for the V1 68-px bodies; D() scales it
  var DK = 1.3;
  function D(n) { return n * DK; }
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var T = F.T;

  // c* = Claude-only plan multipliers (balance, real modules): cJump jump-in weight, cHaiku raw haiku weight,
  // cGuard guardrail base, cSpark zoning spark, cPun whiff/block-punish chance (overrides punish),
  // cMash / cThrow (L1: her mashed reach + throws over-performed). dChain = DeepSeek rekka plan weight (L2).
  var LV = [
    { react: 28, block: 0.12, guess: 0.5, aa: 0.04, punish: 0.06, depth: 0, confirm: 30, tech: 0.03, sup: 0.15, think: 16, aggr: 0.45, jump: 0.10, mash: 0.35, cJump: 0.55, cHaiku: 0.1, cGuard: 0.12, cSpark: 0.6, cMash: 0.4, cThrow: 0.6, gWalk: 0.8, gJump: 1  , gem: { walk: 0.5, dash: 0.5, jump: 0.8 } },
    { react: 22, block: 0.32, guess: 0.55, aa: 0.18, punish: 0.25, depth: 1, confirm: 16, tech: 0.10, sup: 0.35, think: 11, aggr: 0.50, jump: 0.09, mash: 0.15, cJump: 0.3, cHaiku: 0.04, cGuard: 0.12, cSpark: 1.4, cPun: 0.5, cThrow: 0.4, cMash: 2, dChain: 0.4, gWalk: 0.4  , gem: { walk: 0.35, dash: 0.4, jump: 0.6 } },
    { react: 17, block: 0.58, guess: 0.64, aa: 0.42, punish: 0.5, depth: 2, confirm: 10, tech: 0.25, sup: 0.65, think: 8, aggr: 0.55, jump: 0.08, mash: 0.05, cJump: 0.3, cHaiku: 0.02, cGuard: 0.12, cSpark: 1.5, cPun: 0.8, gWalk: 0.35  , gem: { walk: 0.3, dash: 0.35, jump: 0.5 } },
    { react: 13, block: 0.76, guess: 0.72, aa: 0.62, punish: 0.72, depth: 3, confirm: 7, tech: 0.40, sup: 0.85, think: 6, aggr: 0.6, jump: 0.07, mash: 0, cJump: 0.3, cHaiku: 0.03, cGuard: 0.12, cSpark: 1.5, cPun: 0.95, gWalk: 0.2  , gem: { walk: 0.3, dash: 0.35, jump: 0.5 } },
    { react: 10, block: 0.88, guess: 0.8, aa: 0.78, punish: 0.86, depth: 3, confirm: 5, tech: 0.55, sup: 1.0, think: 4, aggr: 0.62, jump: 0.06, mash: 0, cJump: 0.55, cHaiku: 0.1, cGuard: 0.12, cSpark: 1, gWalk: 0.15  , gem: { walk: 0.3, dash: 0.35, jump: 0.5 } }
  ];

  // per-character neutral profile (distances in px; D() = V1 constants scaled for the V2 bodies)
  var PROF = {
    claude:   { dp: 'sonnet',     want: D(92), jr: [D(70), D(130)], dashW: 0.8,  superR: D(200) },
    deepseek: { dp: 'breach',     want: D(60), jr: [D(70), D(150)], dashW: 0.9,  superR: D(120) },
    gpt:      { dp: 'dragonRise', want: 80,    jr: [D(70), D(125)], dashW: 0.55, superR: 0, vs: { deepseek: { breath: 1.7 } } },   // vs: matchup plan multipliers (breath, tail, call)
    gemini:   { dp: 'starRise',   want: 92,    jr: [D(70), D(140)], dashW: 1.0,  superR: 0 }
  };
  // Gemini per-level plan multipliers (LV[i].gem; missing = 1): star zoning, twin set-ups, blink, double-jump
  // approaches, hit-and-run retreats, pokes. vsTwin / vsBlink: the other CPUs' respect for a pending twin strike
  // and their punish chance on blink recovery (LV[i].vsTwin, .vsBlink; missing = 1).
  function gem(P, k) { return P.gem && P.gem[k] != null ? P.gem[k] : 1; }
  function prof(ch) { return PROF[ch] || PROF.claude; }
  F.AI_PROF = PROF;

  function AI(m, side, level, seed) {
    this.m = m; this.side = side; this.rng = new F.RNG(seed >>> 0);
    this.setLevel(level);
    this.q = []; this.obs = []; this.recent = []; this.cool = {};
    this.guardT = 0; this.guardLow = false; this.idleT = 0; this.nextThink = 0;
    this.hitTick = -99; this.blockTick = -99; this.lastInst = -1; this.comboStep = 0;
    this.techTried = false; this.wakePlanned = false; this.jumpAtk = false; this.held = {};
    this.blkLog = []; this.lastAct = null; this.oppGuard = 0; this.projV = 0;
  }
  F.AI = AI;

  AI.prototype.setLevel = function (l) { this.level = F.clamp(l | 0 || 3, 1, 5); this.P = LV[this.level - 1]; };

  AI.prototype.onContact = function (att, vic, what, h) {
    var me = this.m.f[this.side];
    if (att === me && what === 'hit' && h && h.src === 'twin') { this.twinHitTick = this.m.tick; return; }   // not her own move
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
      ob.reach = h.box ? h.box[0] + h.box[2] : (h.beam ? 400 : D(60));
      if (o.mv.whale) ob.reach = 300;
      if (o.mv.flame) ob.reach = 29 + F.v(o.mv.flame.length, o.str);
      if (o.mv.roar) ob.reach = F.v(o.mv.roar.radius, o.str);
      if (o.mv.attn) ob.reach = 500;
    }
    if (o.mv && o.mv.cmdGrab) ob.grab = true;
    if (o.twin) ob.twin = { id: o.twin.id, x: o.twin.x, left: F.twinLeft(o.twin), st: o.twin.st };   // Gemini's light-twin
    if (o.mv && o.mv.blink) { var bsg = o.seg(); ob.blink = bsg ? bsg.id : null; ob.ph = ob.blink === 'recovery' ? 'recovery' : 'blink'; }
    if (o.djT > 0) ob.dj = true;
    if (o.res && o.res.segs[0] && o.res.segs[0].vx) ob.lunge = o.res.segs[0].vx * o.res.segs[0].f;   // forward travel during start-up
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
    if (me.action === 'blockstun' && this.lastAct !== 'blockstun') { this.blkLog.push(m.tick); if (this.blkLog.length > 6) this.blkLog.shift(); }
    this.lastAct = me.action;
    this.oppGuard = this.oppGuard * 0.985 + ((o.action === 'guard' || o.action === 'blockstun') ? 0.015 : 0);   // ~ share of time the opponent spends guarding
    if (o.action === 'jumpSquat' && o.af === 1) this.oppJumpy = (this.oppJumpy || 0) * 0.7 + 0.3; else if ((m.tick & 63) === 0) this.oppJumpy = (this.oppJumpy || 0) * 0.9;
    if (me.action !== 'thrown') this.techTried = false;
    if (me.action === 'thrown' && !this.techTried) {
      this.techTried = true;
      if (this.chance(this.P.tech)) { this.q.length = 0; this.push([{ d: 5, n: 2 + this.rng.int(3), b: '' }, { d: 5, b: 'LM', n: 2 }]); }
    }
    if (this.gsrcT > 0) this.gsrcT--;
    var pv0 = this.seen();
    if (pv0 && pv0.twin && pv0.twin.id !== this.twinRolled && pv0.twin.left >= 0) {   // a pending twin strike near me
      var est = pv0.twin.left - this.P.react;
      if (est <= 14 && est >= -6 && Math.abs(pv0.twin.x - me.x) < 100) {
        this.twinRolled = pv0.twin.id;
        if (this.chance(Math.min(0.97, this.P.block * (this.P.vsTwin != null ? this.P.vsTwin : 1) + 0.08))) { this.gsrc = pv0.twin.x; this.gsrcT = Math.max(6, est + 10); }
      }
    }
    if (this.q.length) return this.emit();
    var pv = this.seen();
    var dx = Math.abs(o.x - me.x);
    var a = me.action;

    if (a === 'attack') return this.inMove(me, o, pv, dx) || {};
    if (a === 'blockstun') {
      // GPT: a blocked rekka step (DeepSeek's chain) -> buffered reversal rising claw through the next step
      if (me.ch === 'gpt' && o.mv && (o.mv.id === 'chain' || o.mv.id === 'chain2') && me.stun <= 6 && dx < 70 && this.rekStun !== o.moveInst) {
        this.rekStun = o.moveInst;
        if (this.chance(this.P.block * (this.P.gRekka != null ? this.P.gRekka : 0.7))) { this.q.length = 0; this.push(this.special('dragonRise', this.level >= 4 ? 'H' : 'M'), 'antiRekka'); return this.emit(); }
      }
      this.guardT = Math.max(this.guardT, 4); return this.holdGuard(me, o, pv);
    }
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
    var sx = this.gsrcT > 0 && this.gsrc != null ? this.gsrc : o.x;   // the twin's side while it is about to claw
    if (sx > me.x) out.left = true; else out.right = true;
    if (low) out.down = true;
    return out;
  };

  // ------------------------------------------------------------------ defense / neutral
  AI.prototype.threat = function (me, pv, dx) {
    if (!pv) return null;
    var pdx = Math.abs(pv.x - me.x);
    var lunge = me.ch === 'gpt' && pv.lunge ? pv.lunge * (this.P.gLunge != null ? this.P.gLunge : 1.6) : 0;   // GPT's patient guard reads lunges
    if (pv.act === 'attack' && (pv.ph === 'startup' || pv.ph === 'active') && pv.kind !== 'throw' && !pv.grab && pdx < pv.reach + D(34) + lunge) return 'strike';
    if (pv.air && pdx < D(110) && F.sign(me.x - pv.x) === F.sign(pv.vx || 0)) return 'air';
    for (var i = 0; i < pv.projs.length; i++) {
      var p = pv.projs[i];
      if (F.sign(me.x - p.x) === F.sign(p.vx) && Math.abs(p.x - me.x) < D(150)) { this.projV = Math.abs(p.vx); return 'proj:' + Math.abs(p.x - me.x); }
    }
    return null;
  };

  AI.prototype.neutral = function (me, o, pv, dx) {
    var P = this.P, C = me.ch, m = this.m;
    // GPT vs a blocked rekka (DeepSeek's chain): the invulnerable rising claw goes through the next step
    if (C === 'gpt' && pv && pv.act === 'attack' && (pv.mv === 'chain' || pv.mv === 'chain2') && dx < 66 && this.blkLog.length &&
      m.tick - this.blkLog[this.blkLog.length - 1] < 24 && this.rekRolled !== this.blkLog[this.blkLog.length - 1]) {
      this.rekRolled = this.blkLog[this.blkLog.length - 1];
      if (this.chance(P.block * (P.gRekka != null ? P.gRekka : 0.7))) { this.push(this.special('dragonRise', this.level >= 4 ? 'H' : 'M'), 'antiRekka'); return this.emit(); }
    }
    // GPT vs DeepSeek's dive: the roar circle covers both sides when she surfaces (front or behind)
    if (C === 'gpt' && pv && pv.mv === 'dive' && pv.act === 'attack' && this.diveRolled !== pv.x) {
      this.diveRolled = pv.x;
      if (this.chance(P.block * (P.gDive != null ? P.gDive : 0.8))) { this.q.length = 0; this.push(this.special('roar', 'H'), 'roarDive'); return this.emit(); }
    }
    // vs a pending twin strike (rolled in think): move away when it is on her side and there is room, else guard
    if (this.gsrcT > 0) {
      var twSide = F.sign(this.gsrc - me.x), herSide = F.sign(o.x - me.x);
      if (twSide === herSide && this.gsrcT > 10 && me.x > T.WALL + 60 && me.x < LC.STAGE_W - T.WALL - 60 && this.escTw !== this.twinRolled && this.chance(0.35)) {
        this.escTw = this.twinRolled; this.gsrcT = 0;
        this.push([{ d: 4, n: 2 }, { d: 5, n: 2 }, { d: 4, n: 2 }, { d: 5, n: 1 }], 'twinAvoid'); return this.emit();
      }
      this.guardLow = true;
      return this.holdGuard(me, o, null);
    }
    if (C === 'gemini') { var gs = this.geminiNow(me, o, pv, dx); if (gs) return gs; }
    // keep guarding briefly once committed
    if (this.guardT > 0) {
      var tn = this.threat(me, pv, dx);
      if (tn || this.guardT > 0) return this.holdGuard(me, o, pv);
    }
    var th = this.threat(me, pv, dx);
    if (th) {
      if (th === 'air') {
        var aaP = C === 'gpt' ? Math.min(0.95, P.aa * (P.gAA != null ? P.gAA : 1)) : P.aa;   // GPT: patient, watches the air
        if (this.chance(aaP * 0.25) || (this.aaRolled !== pv && (this.aaRolled = pv) && this.chance(aaP))) {
          var air = dx < D(70);
          if (C === 'gpt' && dx < 64 && this.chance(0.25 * (P.gRoar || 1))) { this.push(this.special('roar', 'M'), 'aaRoar'); return this.emit(); }
          if (air && this.chance(0.7)) { this.push(this.special(prof(C).dp, this.level >= 4 ? 'H' : 'M'), 'aa'); return this.emit(); }
          if (dx < D(60)) { this.push(this.press('H'), 'aa5H'); return this.emit(); }
        }
        if (this.chance(P.block)) { this.guardT = 14; this.guardLow = false; return this.holdGuard(me, o, null); }
        return this.hold(me, o, dx);
      }
      if (th.indexOf('proj') === 0) {
        var pd = +th.slice(5);
        if (C === 'claude' && pd > D(40) && this.chance(P.block * 0.25) && me.proj === 0) { this.push(this.special('spark', this.pick(['M', 'H'])), 'clash'); return this.emit(); }
        if (C === 'claude' && pd < D(70) && pd > D(24) && this.chance(P.block * 0.2)) { this.push(this.special('guardrail', 'M'), 'absorb'); return this.emit(); }
        if (C === 'deepseek' && pd > D(30) && pd < D(120) && dx < D(260) && this.chance(P.block * 0.3)) { this.push(this.special('dive', dx < D(200) ? 'H' : 'M'), 'diveProj'); return this.emit(); }
        if (C === 'deepseek' && pd > D(50) && me.proj === 0 && this.chance(P.block * 0.15)) { this.push(this.special('wave', 'H'), 'clash'); return this.emit(); }
        if (C === 'gpt') {   // roar erases projectiles inside its radius: time it so the wave is out when the shot arrives
          var est = pd - this.projV * P.react, arrive = est - this.projV * 10;
          if (arrive < 76 && est > 24 && this.chance((P.block * 0.6 + 0.1) * (P.gRoar || 1))) { this.push(this.special('roar', arrive < 50 ? 'L' : 'M'), 'roarProj'); return this.emit(); }
          if (est >= 76 && this.chance(0.6)) return this.holdGuard(me, o, null);   // wait for it
        }
        if (pd > D(50) && pd < D(110) && dx > D(110) && this.chance(P.block * 0.35)) { this.push([{ d: 9, n: 3 }], 'jumpProj'); this.jumpAtk = true; return this.emit(); }
        if (this.chance(P.block + 0.1)) { this.guardT = 12; this.guardLow = true; return this.holdGuard(me, o, null); }
      }
      if (th === 'strike' && this.blockRolled !== pv) {
        this.blockRolled = pv;
        if (this.chance(C === 'gemini' && me.twin ? Math.min(0.97, P.block + 0.15 * gem(P, 'wait')) : P.block)) {
          this.guardT = 16;
          this.guardLow = pv.guard === 'low' ? this.chance(P.guess) : pv.guard === 'high' ? !this.chance(P.guess) : true;
          return this.holdGuard(me, o, null);
        }
      }
    }
    // whiff / block punish
    if (pv && pv.act === 'attack' && pv.ph === 'recovery' && pv.hit !== 'hit' && this.punRolled !== pv.mv + pv.x) {
      this.punRolled = pv.mv + pv.x;
      var whiffCall = pv.mv === 'call' && o.action === 'attack' && o.mv && o.mv.id === 'call';   // 30f recovery: dash in if needed
      var blinkPun = pv.blink === 'recovery' ? (P.vsBlink != null ? P.vsBlink : 1) : 1;
      if (this.chance(Math.min(0.97, ((C === 'claude' && P.cPun ? P.cPun : P.punish) + (whiffCall ? 0.25 : 0)) * blinkPun))) {
        var pp = this.punisher(me, dx, o);
        if (!pp && whiffCall && dx < this.reachOf(me, '5H') + 70) pp = [{ d: 6, n: 2 }, { d: 5, n: 2 }, { d: 6, n: 2 }, { d: 5, n: 12 }].concat(this.press('H'));
        if (pp) { this.push(pp, 'punish'); this.comboStep = 0; return this.emit(); }
      }
    }
    // vs GPT up close while blocking a lot: leave command-grab range (jump back / back-dash)
    if (o.ch === 'gpt' && dx < 74 && C !== 'gpt' && this.recentBlocks(150) >= 2 && o.action !== 'attack' && this.escRolled !== this.blkLog[this.blkLog.length - 1]) {
      this.escRolled = this.blkLog[this.blkLog.length - 1];
      if (this.chance(P.block * (P.vsGrab != null ? P.vsGrab : 0.6))) {
        if (this.chance(0.5) && me.x > T.WALL + 50 && me.x < LC.STAGE_W - T.WALL - 50) this.push([{ d: 4, n: 2 }, { d: 5, n: 2 }, { d: 4, n: 2 }, { d: 5, n: 1 }], 'escDash');
        else this.push([{ d: this.chance(0.5) ? 7 : 8, n: 3 }], 'escJump');
        return this.emit();
      }
    }
    // opponent knocked down: approach or set up
    if (o.action === 'down' || o.action === 'getup') {
      if (dx > D(90)) { if (C === 'claude' && me.proj === 0 && this.chance(0.04)) { this.push(this.special('spark', 'L'), 'oki'); return this.emit(); } return { right: o.x > me.x, left: o.x < me.x }; }
      if (C === 'gemini' && !me.twin && o.action === 'down' && !o.ko && this.okiTw !== this.m.round + ':' + (this.m.tick - o.af)) {
        // meaty twin on wake-up: L strikes ≈ 47f after the press, H ≈ 55f (down 10 + lie 26 + get-up 24 = 60)
        var okT = dx < 80 ? 13 : 5;
        if (o.af === okT && dx < 200) {
          this.okiTw = this.m.round + ':' + (this.m.tick - o.af);
          if (this.chance(0.5 * gem(P, 'twin') + 0.1 * P.depth)) { this.push(this.special('twin', dx < 80 ? 'L' : 'H'), 'okiTwin'); return this.emit(); }
        }
      }
      if (C === 'gpt' && o.action === 'getup' && dx < 62 && o.af >= T.GETUP - 7 && this.okiRolled !== this.m.round + ':' + (this.m.tick - o.af)) {
        this.okiRolled = this.m.round + ':' + (this.m.tick - o.af);
        var ok = this.rng.next();   // meaty mix-up: command grab / low / tail lash / wait
        if (ok < 0.42 * (P.gOki != null ? P.gOki : 1)) { this.push([{ d: 5, n: 1 }].concat(this.special('call', 'M')), 'okiCall'); return this.emit(); }
        if (ok < 0.62) { this.push([{ d: 2, n: 4 }].concat(this.press('M', 2)), 'okiLow'); return this.emit(); }
        if (ok < 0.74) { this.push([{ d: 5, n: 5 }].concat(this.press('H')), 'okiTail'); return this.emit(); }
      }
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
    var PFh = prof(me.ch), want = (PFh.wantVs && PFh.wantVs[o.ch]) || PFh.want;
    if (this.m.timer < 1800 && this.behind()) want -= D(30);
    var out = {};
    var tow = o.x > me.x ? 'right' : 'left', away = o.x > me.x ? 'left' : 'right';
    this.idleT++;
    if (dx > want + D(16)) out[tow] = true;
    else if (dx < want - D(30) && me.x > T.WALL + 30 && me.x < LC.STAGE_W - T.WALL - 30 && (this.m.tick >> 4) % 3 === 0) out[away] = true;
    return out;
  };
  AI.prototype.recentBlocks = function (win) {
    var n = 0;
    for (var i = 0; i < this.blkLog.length; i++) if (this.m.tick - this.blkLog[i] <= win) n++;
    return n;
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

  AI.prototype.punisher = function (me, dx, o) {
    var C = me.ch, d = this.P.depth;
    if (C === 'gpt') {
      if (o && !o.air && dx < 56 && this.chance(0.55)) return this.special('call', dx < 50 ? 'H' : 'M');   // 190 on a recovering body
      if (dx <= this.reachOf(me, '5L') + 15 && d >= 2) return this.press('L');
      if (dx <= this.reachOf(me, '5M') + 13) return this.press(d >= 1 ? 'M' : 'H');
      if (dx <= this.reachOf(me, '5H') + 13) return this.press('H');
      if (dx < 140) return this.special('breath', dx < 95 ? 'L' : dx < 120 ? 'M' : 'H');
      return null;
    }
    var r5H = this.reachOf(me, '5H') + 13, r5M = this.reachOf(me, '5M') + 13;
    if (dx <= this.reachOf(me, '5L') + 15 && d >= 2) return this.press('L');
    if (dx <= r5M) return this.press(d >= 1 ? 'M' : 'H');
    if (dx <= r5H) return this.press('H');
    if (C === 'deepseek' && dx < D(110)) return this.special('chain', dx > D(80) ? 'H' : 'M');
    if (C === 'claude' && dx < D(90)) return this.special('haiku', 'H');
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
    function add(name, w, steps) { if (F.AI_OFF && F.AI_OFF[me.ch + '.' + name]) return; if (w > 0 && steps && steps.length) opts.push({ name: name, w: self.score(name, w), steps: steps }); }
    var r = function (id) { return self.reachOf(me, id) + 15; };
    var full = me.meter >= 100;
    // universal
    var isG = C === 'gpt', gW = isG ? (P.gWalk != null ? P.gWalk : 0.15) : 1;   // GPT: patient, lets them come
    var isN = C === 'gemini', nW = isN ? gem(P, 'walk') : 1, nD = isN ? gem(P, 'dash') : 1;   // Gemini: hit-and-run, not a rushdown
    var twP = isN && me.twin && me.twin.st !== 'super' && F.twinLeft(me.twin) > 12;   // her twin is still waiting: stay safe
    if (twP) { nW *= 0.3; nD *= 0.3; add('twinWait', 1.2 * gem(P, 'wait'), [{ d: dx < D(80) ? 1 : 4, n: 6 + this.rng.int(8) }]); }
    add('walkF', (0.6 + ag * 0.6) * (isG && dx < 150 ? gW : 1) * nW, [{ d: 6, n: 10 + this.rng.int(20) }]);
    add('walkB', dx < D(120) ? 0.35 : 0.1, [{ d: 4, n: 8 + this.rng.int(14) }]);
    add('wait', 0.25 * (1 - ag) + (isG ? (P.gWait != null ? P.gWait : 0.5) : 0), [{ d: dx < D(80) ? 1 : 4, n: 8 + this.rng.int(12) }]);
    var PF = prof(C), vsG = o.ch === 'gpt' && C !== 'gpt';
    if (dx > D(70)) add('dashF', (0.25 + ag * 0.4 * PF.dashW) * (isG && dx < 170 ? gW : 1) * nD, [{ d: 6, n: 2 }, { d: 5, n: 2 }, { d: 6, n: 2 }, { d: 5, n: 1 }]);
    if (dx < D(70) && me.x > T.WALL + 60 && me.x < LC.STAGE_W - T.WALL - 60) add('dashB', 0.15, [{ d: 4, n: 2 }, { d: 5, n: 2 }, { d: 4, n: 2 }, { d: 5, n: 1 }]);
    var jr = PF.jr;
    if (dx > jr[0] && dx < jr[1]) add('jumpIn', P.jump * 4 * (0.6 + ag) * (C === 'claude' ? P.cJump : isG ? (P.gJump != null ? P.gJump : 0.25) : isN ? gem(P, 'jump') : 1), [{ d: 9, n: 3 }]);   // V2: DeepSeek's breach box anti-airs Claude's jump-ins well
    if (dx < D(70)) add('jumpN', P.jump * (C === 'claude' ? P.cJump / 0.55 : 1), [{ d: 8, n: 3 }]);
    // pokes at range
    if (dx <= r('5L')) { add('5L', 0.7, this.press('L')); add('2L', 0.7, this.press('L', 2)); }
    if (dx <= r('5M') && dx > r('5L') - 10) add('5M', 0.8, this.press('M'));
    if (dx <= r('2M') && dx > r('2L') - 10) add('2M', 0.8, this.press('M', 2));
    var MU = (PF.vs && PF.vs[o.ch]) || {};   // matchup multipliers
    if (o.twin && o.twin.st !== 'super' && C !== 'gemini') {   // hit her to dispel the twin
      var dsp = P.vsDispel != null ? P.vsDispel : 1;
      if (dx <= r('5M') + 6) add('dispel', 0.9 * dsp, this.press(dx <= r('5L') ? 'L' : 'M', this.chance(0.5) ? 2 : 5));
      else if (dx < D(110) && Math.abs(o.twin.x - me.x) > 70) add('dispelDash', 0.5 * dsp, [{ d: 6, n: 2 }, { d: 5, n: 2 }, { d: 6, n: 2 }, { d: 5, n: 8 }].concat(this.press('M')));
    }
    var gT = C === 'gpt' ? (P.gTail != null ? P.gTail : 1.8) * (MU.tail || 1) : 1;   // GPT: patient spacing with the long tail
    if (dx <= r('5H') && dx > r('5M') - 8) add('5H', 0.35 * gT, this.press('H'));
    if (dx <= r('2H') && dx > r('2M') - 8) add('2H', 0.3 * gT, this.press('H', 3));
    if (dx < me.C.throwRange - 2 && o.action !== 'blockstun') add('throw', (0.55 + ag * 0.3) * (C === 'claude' && P.cThrow != null ? P.cThrow : isG ? (P.gThrow != null ? P.gThrow : 0.35) : 1), [{ d: this.chance(0.3) ? 4 : 6, b: 'LM', n: 2 }, { d: 5, n: 1 }]);
    if (P.mash > 0 && dx < D(80)) add('mash', P.mash * 2 * (C === 'claude' && P.cMash != null ? P.cMash : 1), this.press(this.pick(['L', 'M', 'H', 'S']), this.pick([5, 2, 6])));
    if (full && dx < PF.superR && this.chance(P.sup * 0.15)) add('superRaw', 0.8, this.special('super', 'H'));
    var pk = vsG && dx < 150 ? 0.25 : 1;   // vs GPT: no projectiles into a point-blank roar
    if (C === 'claude') {
      if (me.proj === 0 && dx > D(120)) add('spark', (0.9 + (dx > D(200) ? 0.8 : 0)) * P.cSpark * pk, this.special('spark', dx > D(220) ? 'L' : this.pick(['M', 'H'])));
      if (me.proj === 0 && dx > D(70) && dx <= D(120)) add('spark', 0.35 * pk, this.special('spark', 'H'));
      if (dx < D(80) && dx > D(30)) add('haiku', P.cHaiku, this.special('haiku', this.pick(['L', 'M'])));   // unsafe raw; mostly a combo ender
      if (dx < D(70) && this.level >= 3) add('guardrail', P.cGuard + (o.action === 'attack' ? 0.1 : 0), this.special('guardrail', this.pick(['L', 'M'])));
    } else if (C === 'gemini') {
      this.geminiPlans(me, o, dx, add, r, ag);
    } else if (C === 'gpt') {
      var og = this.oppGuard, gC = (P.gCall != null ? P.gCall : 1) * (MU.call || 1), gB = (P.gBreath != null ? P.gBreath : 1) * (MU.breath || 1);
      if (dx > 62 && dx < 145) add('breath', (0.45 + (dx > 95 ? 0.25 : 0)) * gB, this.special('breath', dx < 95 ? 'L' : dx < 120 ? 'M' : 'H'));
      if (dx < 57 && o.action !== 'blockstun' && o.action !== 'hitstun' && !o.air) add('call', (0.22 + og * 1.6) * gC, this.special('call', dx < 52 ? this.pick(['M', 'H']) : 'H'));
      if (dx > 57 && dx < 90 && og > 0.25) add('walkCall', og * 0.8 * gC, [{ d: 6, n: Math.round((dx - 50) / 1.4) }].concat(this.special('call', 'M')));
      if (dx < 66 && o.action === 'attack') add('roar', 0.12 * (P.gRoar || 1), this.special('roar', 'M'));
      if (dx > 120 && dx < 260) add('wait', 0.3, [{ d: 4, n: 6 + this.rng.int(10) }]);
    } else {
      if (me.proj === 0 && dx > D(110)) add('wave', (0.7 + (dx > D(200) ? 0.4 : 0)) * pk, this.special('wave', dx > D(200) ? 'H' : 'M'));
      if (dx > D(50) && dx < D(110)) add('chain', (0.5 + ag * 0.25) * (P.dChain || 1) * (MU.chain || 1), this.special('chain', dx > D(90) ? 'H' : 'M'));
      if (dx > D(90) && dx < D(240) && this.level >= 2) add('diveM', 0.07 + ag * 0.05, this.special('dive', 'M'));
      if (dx > D(60) && dx < D(200) && this.level >= 3) add('diveH', 0.07 + ag * 0.05, this.special('dive', 'H'));
      if (dx > D(90) && dx < D(170)) add('jumpKick', P.jump * 3, [{ d: 9, n: 3 }]);
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
    if (this.jumpAtk === 'jumpKick' && me.ch === 'deepseek' && me.vy > -2 && h > D(30) && dx < D(150) && toward) {
      this.jumpAtk = false; this.push(this.special('diveKick', dx > D(100) ? 'H' : dx > D(60) ? 'M' : 'L'), 'diveKick'); return this.emit();
    }
    if (me.ch === 'gpt' && this.jumpAtk && me.vy > -1.5 && h > 44 && dx > 40 && dx < 120 && toward && !o.air && this.chance(0.12 * (this.P.gAir != null ? this.P.gAir : 1))) {
      this.jumpAtk = false; this.push(this.special('airBreath', dx > 90 ? 'H' : dx > 65 ? 'M' : 'L'), 'airBreath'); return this.emit();
    }
    if (me.ch === 'gemini') { var ga = this.geminiAir(me, o, pv, dx, h, toward); if (ga) return ga; }
    if (me.ch === 'claude' && this.jumpAtk && me.vy > -1 && h > D(30) && dx > D(110) && me.proj === 0 && this.chance(0.05)) {
      this.jumpAtk = false; this.push(this.special('airSpark', 'M'), 'airSpark'); return this.emit();
    }
    if (me.vy > 0 && dx < D(46) && h < D(44) && h > 10 && toward) {
      this.jumpAtk = false; this.push(this.press(this.level >= 3 ? 'H' : this.pick(['L', 'M', 'H'])), 'jAtk'); return this.emit();
    }
    if (o.air && Math.abs(o.y - me.y) < D(30) && dx < D(40)) { this.push(this.press(this.pick(['L', 'M'])), 'airToAir'); return this.emit(); }
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
      if (blk && C === 'gpt' && mv.rank === 1 && dx < 60 && this.chance(0.4 * (P.gCall != null ? P.gCall : 1))) {   // tick into the command grab
        var rem = me.res.total - me.mf - 1;
        this.q.length = 0; this.push([{ d: 5, n: Math.max(1, rem - 4) }].concat(this.special('call', 'M')), 'tickCall');
        return {};
      }
      if (blk && C === 'gemini' && this.chance(0.3 * gem(P, 'run'))) {   // hit-and-run: poke, then leave
        var rem2 = me.res.total - me.mf - 1;
        this.q.length = 0;
        if (this.chance(0.5) || me.x < T.WALL + 70 || me.x > LC.STAGE_W - T.WALL - 70) this.push([{ d: 5, n: Math.max(1, rem2 - 2) }].concat(this.special('blink', this.cornered(me, o) ? 'M' : 'L')), 'runBlink');
        else this.push([{ d: 5, n: Math.max(1, rem2) }, { d: 4, n: 2 }, { d: 5, n: 2 }, { d: 4, n: 2 }, { d: 5, n: 1 }], 'runDash');
        return {};
      }
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
        if (hit || (blk && this.chance(this.level >= 4 ? 0.25 : this.level >= 3 ? 0.45 : this.level === 2 ? 0.5 : 0.75))) { this.q.length = 0; this.push([{ d: 5, n: 2 + this.rng.int(3) }, { d: 5, b: 'M', n: 2 }, { d: 5, n: 1 }]); }
      }
    }
    return {};
  };

  AI.prototype.comboSpecial = function (me, dx, full) {
    var C = me.ch;
    if (full && this.P.depth >= 3 && this.chance(this.P.sup * 0.5)) return this.special('super', 'H');
    if (C === 'claude') return dx < D(70) ? this.special('haiku', this.level >= 4 ? 'H' : 'M') : (me.proj === 0 ? this.special('spark', 'H') : null);
    if (C === 'gpt') return dx < 60 && this.chance(0.45) ? this.special('dragonRise', 'H') : (dx < 130 ? this.special('breath', dx < 90 ? 'M' : 'H') : null);
    if (C === 'gemini') return dx < 56 && this.chance(0.55) ? this.special('starRise', this.level >= 4 ? 'H' : 'M') : (me.proj === 0 && dx < 150 ? this.special('star', 'H') : null);
    return dx < D(80) ? (this.chance(0.7) ? this.special('chain', 'H') : this.special('breach', 'H')) : (me.proj === 0 ? this.special('wave', 'H') : null);
  };

  // ------------------------------------------------------------------ Gemini
  AI.prototype.cornered = function (me, o) {
    var away = F.sign(me.x - o.x) || -me.facing;
    return away > 0 ? me.x > LC.STAGE_W - T.WALL - 64 : me.x < T.WALL + 64;
  };
  // every tick (before the decision gate): follow a twin hit, time her pressure with her own twin, swap
  AI.prototype.geminiNow = function (me, o, pv, dx) {
    var P = this.P, m = this.m, tw = me.twin;
    // the twin landed: link into a chain (5M / 2M) or dash in
    if (this.twinHitTick != null && m.tick - this.twinHitTick < 12 && (o.action === 'hitstun' || o.action === 'caught') && this.tcRolled !== this.twinHitTick) {
      this.tcRolled = this.twinHitTick;
      if (this.chance(0.35 + 0.15 * P.depth)) {
        if (dx <= this.reachOf(me, '5M') + 8) { this.push(this.press('M', this.chance(0.5) ? 2 : 5), 'twinConfirm'); this.comboStep = 1; return this.emit(); }
        if (dx < 130) { this.push([{ d: 6, n: 2 }, { d: 5, n: 2 }, { d: 6, n: 2 }, { d: 5, n: 7 }].concat(this.press('L')), 'twinConfirmDash'); return this.emit(); }
      }
    }
    if (!tw || tw.st === 'super') return null;
    var left = F.twinLeft(tw);
    // pressure / cross-up timing: her low / mid / throw lands a few frames before or after the twin
    // (never within TWIN_GRACE: that would be forgiven anyway)
    if (left >= 0 && this.twSet !== tw.id) {
      var close = dx <= this.reachOf(me, '2M') + 6, tside = F.sign(tw.x - o.x) !== F.sign(me.x - o.x);
      if (close && (left === 11 || left === 0) && !o.air) {   // lands ≈ 5f before / after the twin's claw
        this.twSet = tw.id;
        if (this.chance((0.55 + 0.1 * P.depth) * gem(P, 'twin'))) {
          var k = this.rng.next();
          if (k < 0.45) this.push(this.press(dx <= this.reachOf(me, '2L') + 6 ? 'L' : 'M', 2), tside ? 'twinXlow' : 'twinLow');
          else if (k < 0.75) this.push(this.press(dx <= this.reachOf(me, '5L') + 6 ? 'L' : 'M', 5), tside ? 'twinXmid' : 'twinMid');
          else if (dx < me.C.throwRange - 2) this.push([{ d: 6, b: 'LM', n: 2 }, { d: 5, n: 1 }], 'twinThrow');
          else this.push(this.press('M', 2), 'twinLow');
          return this.emit();
        }
      }
      // approach so the pressure lands with the twin (H twin behind them: walk / dash in)
      if (!close && left > 12 && left < 40 && dx < 150 && !o.air && this.chance(0.08)) { this.push([{ d: 6, n: Math.min(14, left - 10) }], 'twinApproach'); return this.emit(); }
    }
    // H swap: the twin stands across the opponent and she is pressured / far away
    if (left > 14 && this.swRolled !== tw.id && F.sign(tw.x - o.x) !== F.sign(me.x - o.x) && Math.abs(tw.x - o.x) < 90 && dx > 60 && this.level >= 2) {
      this.swRolled = tw.id;
      if (this.chance(0.25 * gem(P, 'blink'))) { this.push(this.special('blink', 'H'), 'swap'); return this.emit(); }
    }
    return null;
  };
  AI.prototype.geminiPlans = function (me, o, dx, add, r, ag) {
    var P = this.P, st = gem(P, 'star'), tw = gem(P, 'twin'), bl = gem(P, 'blink'), dj = gem(P, 'dj');
    var pk = o.ch === 'gpt' && dx < 150 ? 0.25 : 1;   // no stars into a point-blank roar
    if (me.proj === 0 && dx > 130) add('star', (0.6 + (dx > 210 ? 0.5 : 0)) * st * pk, this.special('star', dx > 210 ? 'L' : this.pick(['L', 'H'])));
    if (me.proj === 0 && dx > 100 && (o.air || this.oppJumpy > 0.3)) add('starM', (0.5 + this.oppJumpy) * st * pk, this.special('star', 'M'));   // catches jumps
    if (me.proj === 0 && dx > 120 && dx < 220) add('starHrun', 0.25 * st * pk, this.special('star', 'H').concat([{ d: 6, n: 14 }]));
    if (!me.twin && o.action !== 'attack') {
      if (dx < 76) add('twinL', 0.3 * tw, this.special('twin', 'L'));
      if (dx > 70 && dx < 150) add('twinM', 0.22 * tw, this.special('twin', 'M'));
      if (dx > 50 && dx < 200 && this.level >= 2) add('twinH', (0.22 + ag * 0.1) * tw, this.special('twin', 'H'));
    }
    if (dx > 60 && dx < 140 && o.action === 'attack') add('blinkM', 0.25 * bl, this.special('blink', 'M'));   // through them
    if (this.cornered(me, o) && dx < 90) add('blinkEsc', 0.45 * bl, this.special('blink', 'M'));
    if (dx < 70 && !this.cornered(me, o)) add('blinkL', 0.12 * bl, this.special('blink', 'L'));
    if (!me.twin && dx > 80 && dx < 220 && this.level >= 3) add('blinkAir', 0.06 * bl, this.special('blink', 'H'));
    if (dx > D(110) && dx < D(190)) add('djIn', P.jump * 3 * dj * (0.6 + ag), [{ d: 9, n: 3 }]);
  };
  AI.prototype.geminiAir = function (me, o, pv, dx, h, toward) {
    var P = this.P;
    if (!me.djUsed && me.C.airJump && h > 20) {
      // bait an anti-air: the opponent starts a rising special under her -> double jump away
      if (pv && pv.act === 'attack' && pv.kind === 'special' && pv.mv === prof(o.ch).dp && dx < 100 && this.djbRolled !== pv) {
        this.djbRolled = pv;
        if (this.chance(0.3 * gem(P, 'dj') * P.block)) { this.push([{ d: 5, n: 1 }, { d: 7, n: 2 }], 'djBack'); return this.emit(); }
      }
      if (this.jumpAtk === 'djIn' && me.vy > -1.2 && toward && dx > 50) { this.jumpAtk = 'djIn2'; this.push([{ d: 5, n: 1 }, { d: 9, n: 2 }], 'dj'); return this.emit(); }
    }
    if (this.jumpAtk && me.proj === 0 && me.vy > -1.5 && h > 44 && dx > 80 && dx < 190 && toward && this.chance(0.08 * gem(P, 'star'))) {
      this.jumpAtk = false; this.push(this.special('airStar', dx > 150 ? 'H' : dx > 115 ? 'M' : 'L'), 'airStar'); return this.emit();
    }
    return null;
  };

  // ------------------------------------------------------------------ wake-up
  AI.prototype.wakeup = function (me, o, dx) {
    if (me.action === 'down') {
      if (me.af < 6 && this.chance(this.level * 0.03)) return { L: (me.af & 1) === 1 };   // quick rise sometimes
      return {};
    }
    if (me.af < T.GETUP - 5 || this.wakePlanned) return this.holdGuard(me, o, null);
    this.wakePlanned = true;
    var close = dx < D(70), oAtk = o.action === 'attack';
    var r = this.rng.next();
    var vsG = o.ch === 'gpt' && me.ch !== 'gpt' && dx < 72 ? (this.P.vsWake != null ? this.P.vsWake : 0.1) : 0;   // her meaty command grab
    if (close && r < 0.08 + this.level * 0.03) { this.push(this.special(prof(me.ch).dp, 'H'), 'reversal'); return this.emit(); }
    if (me.ch === 'gpt' && close && !oAtk && r < 0.16 + this.level * 0.02) { this.push(this.special('roar', 'H'), 'wakeRoar'); return this.emit(); }
    if (me.ch === 'gemini' && close && r < 0.2 + this.level * 0.02) { this.push(this.special('blink', this.cornered(me, o) || this.chance(0.5) ? 'M' : 'L'), 'wakeBlink'); return this.emit(); }
    if (close && r < 0.18 + this.level * 0.03 + vsG) { this.push([{ d: 4, n: 2 }, { d: 5, n: 2 }, { d: 4, n: 2 }, { d: 5, n: 1 }], 'wakeBack'); return this.emit(); }
    if (vsG && r < 0.18 + this.level * 0.03 + 2 * vsG) { this.push([{ d: 7, n: 3 }], 'wakeJump'); return this.emit(); }
    if (close && !oAtk && r < 0.3) { this.push([{ d: 6, b: 'LM', n: 2 }, { d: 5, n: 1 }], 'wakeThrow'); return this.emit(); }
    this.guardT = 16; this.guardLow = this.chance(0.6);
    return this.holdGuard(me, o, null);
  };
})();
