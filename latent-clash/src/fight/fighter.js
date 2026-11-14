/* LATENT CLASH — FIGHT fighter: state machine, command parsing, move runner, physics, pose.
 * One Fighter per side. The match calls, per logic tick:
 *   f.inp.push(raw, frozen, facing)   (always)
 *   f.step(opp)                       (unless the global super-flash freeze is on)
 *   ... positions / hits are resolved by match.js + combat.js ...
 *   f.pose()                          (rig pose for this tick)                          */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var T = F.T, GY = T.GY, B = F.BTN;
  var BIT = { L: 1, M: 2, H: 4 };

  var NEUTRAL = { idle: 1, walkF: 1, walkB: 1, crouch: 1, guard: 1 };
  F.NEUTRAL = NEUTRAL;

  function Fighter(m, side, cfg) {
    this.m = m; this.side = side;
    this.ch = cfg.char; this.C = F.chars[cfg.char]; this.pal = cfg.palette | 0;
    this.control = cfg.control === 'cpu' ? 'cpu' : 'human';
    this.level = F.clamp(cfg.level | 0 || 3, 1, 5);
    this.inp = new F.Input();
    this.maxHp = this.C.hp || 1000;
    this.meter = 0;
    this.stats = { damage: 0, maxCombo: 0, hits: 0, specials: 0, supers: 0, throws: 0 };
    this.puppet = null;
    this.after = [];
    this.roundReset(side === 0 ? 250 : 390, side === 0 ? 1 : -1);
  }
  F.Fighter = Fighter;

  Fighter.prototype.roundReset = function (x, facing) {
    this.x = x; this.y = GY; this.vx = 0; this.vy = 0; this.px = x;
    this.facing = facing; this.air = false;
    this.hp = this.maxHp; this.ko = false;
    this.action = 'idle'; this.af = 0;
    this.mv = null; this.str = 'M'; this.res = null; this.si = 0; this.sf = 0; this.mf = 0;
    this.stop = 0; this.stun = 0; this.stunMax = 1; this.stunAnim = 'hitHigh';
    this.guardLow = false; this.knock = 'knock'; this.juggle = 0; this.grav = 0.4;
    this.pushV = 0; this.pushDec = 0; this.pushN = 0; this.pushSrc = null;
    this.invAll = 0; this.invThrow = 0; this.throwProt = 0;
    this.combo = 0; this.comboDmg = 0; this.comboHits0 = 0; this.comboShow = 0; this.comboShowDmg = 0; this.comboT = 0;
    this.flash = 0; this.flashColor = '#ffffff';
    this.airUsed = false; this.airSpecial = false;
    this.chainMask = 0; this.connected = null; this.hitGroups = {}; this.hitCount = 0; this.moveScale = -1;
    this.fromPress = null; this.cancelUntil = 0;
    this.victim = null; this.throwBack = false; this.techT = 0; this.thrower = null;
    this.caughtT = 0; this.landLag = 0; this.crouchT = 99; this.standT = 99; this.jumpDir = 0;
    this.dashKind = null; this.trail = 0; this.after.length = 0;
    this.proj = 0; this.quick = false; this.lie = T.DOWN_LIE;
    this.tag = null; this.tagT = 0;
    this.anim = 'idle'; this.pseg = 'loop'; this.pu = 0;
    this.lastHitKind = null; this.recoverTick = -1; this.hidden = false;
    this.inp.reset();
  };

  // ------------------------------------------------------------------ helpers
  Fighter.prototype.setAction = function (a) {
    if (this.action !== a) {
      if (this.action === 'crouch' || (this.action === 'guard' && this.guardLow)) this.standT = 0;
      this.action = a; this.af = 0;
    }
  };
  Fighter.prototype.seg = function () { return this.res ? this.res.segs[this.si] : null; };
  Fighter.prototype.height = function () { return GY - this.y; };
  Fighter.prototype.isCrouching = function () {
    return this.action === 'crouch' || (this.action === 'guard' && this.guardLow) ||
      (this.action === 'blockstun' && this.guardLow) || this.stunAnim === 'hitCrouch' && this.action === 'hitstun' ||
      (this.mv && this.mv.stance === 'crouch');
  };
  Fighter.prototype.inMove = function (id) { return this.action === 'attack' && this.mv && this.mv.id === id; };
  Fighter.prototype.phase = function () {   // 'startup' | 'active' | 'recovery' for normal-ish moves
    var sg = this.seg(); if (!sg) return null;
    var hs = this.mv.hits;
    if (!hs || !hs.length) return sg.id === 'startup' ? 'startup' : 'recovery';
    var first = null, last = null, segs = this.res.segs;
    for (var i = 0; i < segs.length; i++) for (var j = 0; j < hs.length; j++) if (hs[j].seg === segs[i].id) { if (first === null) first = i; last = i; }
    if (first === null) return 'recovery';
    if (this.si < first) return 'startup';
    if (this.si <= last) return 'active';
    return 'recovery';
  };
  Fighter.prototype.anchor = function (name) {
    var p = this.puppet, a = null;
    if (p && p.getAnchor) {
      try { a = p.getAnchor(name); } catch (e) { F.err('rig.getAnchor ' + name, e); a = null; }
      if (a && (!isFinite(a.x) || !isFinite(a.y))) a = null;
    }
    if (!a) { var fb = this.C.anchorFb[name] || [0, -36]; a = { x: fb[0], y: fb[1] }; }
    return a;
  };
  Fighter.prototype.addMeter = function (n) {
    if (this.m.training && this.m.training.meter === 'full') { this.meter = 100; return; }
    var was = this.meter;
    this.meter = F.clamp(this.meter + n, 0, 100);
    if (was < 100 && this.meter >= 100) {
      var ca = this.anchor('center');
      F.fx('meter.full', this.x + ca.x * this.facing, this.y + ca.y, { facing: this.facing, palette: this.pal, 'char': this.ch });
      F.sfx('meter.full', { pan: F.pan(this.x, this.m.camX), vol: 0.8 });
    }
  };
  Fighter.prototype.showTag = function (text) { this.tag = text; this.tagT = 90; };

  // ------------------------------------------------------------------ commands
  function strength(b) { return (b & B.H) ? 'H' : (b & B.M) ? 'M' : (b & B.L) ? 'L' : 'M'; }

  Fighter.prototype.findMove = function (motion, simple, air) {
    var ms = this.C.moves;
    for (var id in ms) {
      var mv = ms[id];
      if (mv.internal || (mv.kind !== 'special')) continue;
      if (!!mv.air !== !!air) continue;
      if (motion && mv.motion === motion) return id;
      if (simple != null && mv.simple === simple) return id;
    }
    return null;
  };
  Fighter.prototype.canDo = function (id) {
    var mv = this.C.moves[id];
    if (!mv) return false;
    if (mv.proj && this.proj > 0) return false;
    if (mv.air) {
      if (this.airSpecial) return false;
      if (mv.minHeight && this.height() < mv.minHeight) return false;
    }
    return true;
  };

  // allow = { normal: fn|bool, special, super, throw, air }
  Fighter.prototype.parse = function (p, allow) {
    var b = p.b, f = this.facing, air = !!allow.air;
    if (!(b & 15)) return null;
    var mot = (allow.special || allow.super) ? this.inp.motions(p, f) : null;
    if (allow.super && !air && this.meter >= 100) {
      if (mot.sup || ((b & B.H) && (b & B.S))) return { id: 'super', str: 'M' };
    }
    if (allow.special) {
      var id = null, s = (b & B.S) && !(b & 7) ? 'M' : strength(b);
      if (mot.m) {
        id = air ? (mot.m === '236' ? this.findMove('236', null, true) : null) : this.findMove(mot.m, null, false);
        if (id && this.canDo(id)) return { id: id, str: s };
      }
      if (b & B.S) {
        var d = this.inp.pressDir(p, f), simple;
        if (air) simple = 'j';
        else simple = (d === 4 || d === 7) ? 4 : (d === 6 || d === 9) ? 6 : (d <= 3) ? 2 : 5;
        id = this.findMove(null, simple, air);
        if (id && this.canDo(id)) return { id: id, str: 'M' };
      }
    }
    if (allow['throw'] && !air && (b & B.L) && (b & B.M)) {
      var td = this.inp.pressDir(p, f);
      return { id: 'throw', str: 'M', back: td === 4 || td === 1 || td === 7 };
    }
    if (allow.normal) {
      var btn = (b & B.H) ? 'H' : (b & B.M) ? 'M' : (b & B.L) ? 'L' : null;
      if (btn) {
        var dir = this.inp.dir(f);
        var nid = (air ? 'j' : (dir <= 3 ? '2' : '5')) + btn;
        if (this.C.moves[nid] && (allow.normal === true || allow.normal(this.C.moves[nid]))) return { id: nid, str: btn };
      }
    }
    return null;
  };

  Fighter.prototype.command = function (allow) {
    var ps = this.inp.pending();
    for (var i = 0; i < ps.length; i++) {
      var c = this.parse(ps[i], allow);
      if (c) { this.inp.consume(ps[i]); c.press = ps[i]; return c; }
    }
    return null;
  };

  var ALLOW_GROUND = { normal: true, special: true, 'super': true, 'throw': true, air: false };
  var ALLOW_SQUAT = { normal: false, special: true, 'super': true, 'throw': false, air: false };

  Fighter.prototype.tryGround = function () {
    var c = this.command(ALLOW_GROUND);
    if (c) { this.chainMask = 0; this.startMove(c.id, c.str, c.press, c); return true; }
    return false;
  };
  Fighter.prototype.tryAir = function () {
    var allow = { normal: !this.airUsed, special: !this.airSpecial, 'super': false, 'throw': false, air: true };
    if (!allow.normal && !allow.special) return false;
    var c = this.command(allow);
    if (c) { this.startMove(c.id, c.str, c.press, c); return true; }
    return false;
  };

  // ------------------------------------------------------------------ move runner
  Fighter.prototype.startMove = function (id, str, press, c) {
    var mv = this.C.moves[id];
    if (!mv) { F.warn('move ' + this.ch + '.' + id, 'missing'); return; }
    var prevMv = this.mv;
    this.mv = mv; this.str = str || 'M'; this.res = mv.res[this.str];
    this.si = 0; this.sf = 0; this.mf = 0;
    this.action = 'attack'; this.af = 0;
    this.connected = null; this.hitGroups = {}; this.hitCount = 0; this.moveScale = -1;
    this.fromPress = press || null;
    this.moveInst = (this.moveInst | 0) + 1;
    this.throwBack = !!(c && c.back);
    this.m.topSide = this.side;
    this.cancelUntil = 0;
    var segs = this.res.segs;
    for (var i = 0; i < segs.length; i++) if (segs[i].id === 'active') { this.cancelUntil = segs[i].start + segs[i].f + T.CHAIN_EXTRA; break; }
    if (mv.kind === 'normal') {
      this.chainMask |= BIT[mv.btn];
      if (mv.stance === 'air') this.airUsed = true;
      F.sfx('whiff.' + ({ L: 'light', M: 'medium', H: 'heavy' })[mv.btn], { pan: F.pan(this.x, this.m.camX), vol: 0.7 });
      if (mv.btn !== 'L' || this.m.rngFx() < 0.35) F.voice(this.ch, ({ L: 'light', M: 'medium', H: 'heavy' })[mv.btn]);
    } else if (mv.kind === 'special') {
      if (mv.air) this.airSpecial = true;
      if (!mv.internal && !(prevMv && prevMv.lore === mv.lore)) {
        this.stats.specials++;
        var lore = LC.LORE && LC.LORE.moves && LC.LORE.moves[this.ch] && LC.LORE.moves[this.ch][mv.lore];
        if (lore) this.showTag(lore.zh);
        F.voice(this.ch, 'special');
      }
      if (mv.sfx) F.sfx(mv.sfx, { pan: F.pan(this.x, this.m.camX) });
      this.addMeter(2);
    } else if (mv.kind === 'super') {
      this.stats.supers++;
      if (!(this.m.training && this.m.training.meter === 'full')) this.meter = 0;
      var sl = LC.LORE && LC.LORE.moves && LC.LORE.moves[this.ch] && LC.LORE.moves[this.ch]['super'];
      if (sl) this.showTag(sl.zh);
      this.trail = 60;
    } else if (mv.kind === 'throw') {
      F.sfx('whiff.medium', { pan: F.pan(this.x, this.m.camX), vol: 0.5 });
    }
    if (!this.air) { this.vx = 0; this.vy = 0; }
    else if (mv.air && mv.kind === 'special') { this.vx *= 0.35; this.vy = Math.min(this.vy, -0.8); }
    this.enterSeg();
    if (this.m.onMoveStart) this.m.onMoveStart(this, mv);
  };

  Fighter.prototype.enterSeg = function () {
    var sg = this.seg(); if (!sg) return;
    if (sg.vy0 != null) { this.vy = sg.vy0; this.air = true; }
    if (sg.vyc != null) this.vy = sg.vyc;
    var mv = this.mv;
    if (mv.proj && sg.id === mv.proj.seg) F.spawnProj(this.m, this);
    if (mv.id === 'haiku' && /^hit\d$/.test(sg.id)) {
      var hp = this.anchor('hip');
      F.fx('claude.haikuSlash', this.x + hp.x * this.facing, this.y + hp.y, { facing: this.facing, palette: this.pal, index: (+sg.id[3]) - 1 });
    }
    if (mv.id === 'dive') F.diveSeg(this.m, this, sg.id);
    if (sg.id === 'bounce') { this.vy = -3.4; this.vx = -1.6 * this.facing; this.air = true; }
  };

  Fighter.prototype.endMove = function () {
    var mv = this.mv;
    this.mv = null; this.res = null; this.fromPress = null; this.connected = null;
    if (this.victim) this.victim = null;
    if (this.air) { this.setActionRaw('jump'); return; }
    if (mv && (mv.stance === 'air' || mv.air)) { this.startLand(mv.landLag || 2); return; }
    this.setActionRaw(this.inp.dir(this.facing) <= 3 ? 'crouch' : 'idle');
    if (this.action === 'crouch') this.crouchT = 4;
  };
  Fighter.prototype.setActionRaw = function (a) { this.action = a; this.af = 0; };

  Fighter.prototype.chainOK = function (cur) {
    var self = this;
    return function (nm) {
      if (nm.stance === 'air' || cur.stance === 'air') return false;
      if (nm.rank <= cur.rank) return false;
      return !(self.chainMask & BIT[nm.btn]);
    };
  };

  Fighter.prototype.runMove = function (o) {
    var mv = this.mv, sg = this.seg();
    // conversions: a normal started from a press that grew into L+M / H+S within 2 frames
    if (mv.kind === 'normal' && this.fromPress && this.fromPress.upgrade && this.mf <= T.CONVERT && !this.air) {
      var p = this.fromPress; p.upgrade = false;
      var c0 = this.parse(p, { normal: false, special: true, 'super': true, 'throw': true, air: false });
      if (c0) { this.startMove(c0.id, c0.str, null, c0); return; }
    }
    // cancels
    if (this.connected) {
      var c = null;
      if (mv.kind === 'normal' && this.mf <= this.cancelUntil) {
        c = this.command({ normal: this.chainOK(mv), special: true, 'super': true, 'throw': false, air: this.air });
      } else if (mv.kind === 'special' && this.connected === 'hit' && mv.cancel === 'super' && !this.air) {
        c = this.command({ normal: false, special: false, 'super': true, 'throw': false, air: false });
      }
      if (c) { this.startMove(c.id, c.str, c.press, c); return; }
    }
    // rekka follow-up
    if (mv.follow && this.inFollow(mv.follow)) {
      var fp = this.inp.fresh(15);
      if (fp) { this.inp.consume(fp); this.startMove(mv.follow.to, this.str, null, null); return; }
    }
    // advance
    this.sf++; this.mf++;
    if (!sg.loop && this.sf >= sg.f) {
      if (sg.end || this.si >= this.res.segs.length - 1) { this.endMove(); return; }
      this.si++; this.sf = 0; sg = this.seg(); this.enterSeg();
      if (!this.mv) return;
    }
    // per-frame segment physics
    if (sg.vx != null) this.vx = sg.vx * this.facing;
    else if (!this.air) this.vx = 0;
    if (sg.vyc != null) this.vy = sg.vyc;
    if (mv.flashAt === this.mf) this.m.superFlash(this);
    if (mv.trail && (sg.id === 'rise' || sg.id === 'fall' || (sg.id === 'active' && mv.air)) && (this.ch !== 'claude' || (this.sf & 1) === 0)) {
      var wp = this.anchor('weapon');
      F.fx(mv.trail, this.x + wp.x * this.facing, this.y + wp.y, { facing: this.facing, palette: this.pal });
    }
    if (mv.whale && F.whaleT && F.whaleT(this) === 50) F.fx('deepseek.whaleSplash', this.x + this.facing * (mv.whale.x + 128), T.GY, { facing: this.facing, palette: this.pal, power: 1 });
    if (mv.kind === 'throw' && sg.id === mv.grabSeg) F.tryGrab(this.m, this, o);
    if (mv.id === 'throwHit') F.throwStep(this.m, this, o);
    if (this.mv && this.mv.kind === 'super') this.trail = Math.max(this.trail, 4);
  };

  Fighter.prototype.inFollow = function (fw) {
    var segs = this.res.segs, a = -1, b = -1;
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].id === fw.from[0]) a = segs[i].start + fw.from[1];
      if (segs[i].id === fw.until[0]) b = segs[i].start + fw.until[1];
    }
    return this.mf >= a && this.mf <= b;
  };

  // ------------------------------------------------------------------ states
  Fighter.prototype.threatened = function (o) {
    var dx = Math.abs(o.x - this.x);
    if (o.action === 'attack' && o.mv && (o.mv.hits || o.mv.proj) && dx < 140) {
      var ph = o.phase();
      if (ph === 'startup' || ph === 'active') return true;
    }
    var ps = this.m.projs;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p.owner === o && Math.abs(p.x - this.x) < 150 && F.sign(this.x - p.x) === F.sign(p.vx)) return true;
    }
    return o.air && dx < 90 && o.action === 'attack';
  };

  Fighter.prototype.neutral = function (o) {
    if (this.tryGround()) return;
    var d = this.inp.dir(this.facing);
    var dash = this.inp.takeDash();
    if (dash && d !== 5 && d >= 4 && d <= 6) { this.startDash(dash); return; }
    if (d >= 7) { this.startSquat(d); return; }
    var threat = (d === 1 || d === 4) && this.threatened(o);
    if (d <= 3) {
      if (threat) { if (!(this.action === 'guard' && this.guardLow)) { this.setAction('guard'); } this.guardLow = true; }
      else if (this.action !== 'crouch') { var wasLowGuard = this.action === 'guard' && this.guardLow; this.setAction('crouch'); this.crouchT = wasLowGuard ? 4 : 0; }
      this.vx = 0;
    } else if (d === 6) { this.setAction('walkF'); this.vx = this.C.walkF * this.facing; }
    else if (d === 4) {
      if (threat) { if (this.action === 'guard' && this.guardLow) this.standT = 99; this.setAction('guard'); this.guardLow = false; this.vx = 0; }
      else { this.setAction('walkB'); this.vx = -this.C.walkB * this.facing; }
    } else { this.setAction('idle'); this.vx = 0; }
  };

  Fighter.prototype.startSquat = function (d) {
    this.setActionRaw('jumpSquat'); this.jumpDir = d === 7 ? -1 : d === 9 ? 1 : 0; this.vx = 0;
  };
  Fighter.prototype.takeoff = function () {
    var d = this.inp.dir(this.facing), J = this.C.jump;
    var dir = d === 7 ? -1 : d === 9 ? 1 : d === 8 ? 0 : this.jumpDir;
    this.vx = dir > 0 ? J.vxF * this.facing : dir < 0 ? -J.vxB * this.facing : 0;
    this.vy = -J.vy; this.air = true; this.airUsed = false; this.airSpecial = false;
    this.setActionRaw('jump');
    F.fx('dust.jump', this.x, GY, { facing: this.facing });
    F.sfx('jump', { pan: F.pan(this.x, this.m.camX), vol: 0.6 });
  };
  Fighter.prototype.startDash = function (k) {
    var D = k === 'F' ? this.C.dashF : this.C.dashB;
    this.setActionRaw(k === 'F' ? 'dashF' : 'dashB');
    this.dashKind = k; this.dashN = D.f; this.dashV0 = 2 * D.d / D.f;
    this.trail = D.f;
    if (k === 'B') { this.invAll = D.inv; this.invThrow = D.f + 2; }
    F.fx('dust.dash', this.x, GY, { facing: k === 'F' ? this.facing : -this.facing });
    F.sfx('dash', { pan: F.pan(this.x, this.m.camX), vol: 0.6 });
  };
  Fighter.prototype.startLand = function (lag) {
    this.setActionRaw('land'); this.landLag = lag; this.vx = 0; this.vy = 0; this.air = false;
  };

  Fighter.prototype.recover = function (o) {
    this.recoverTick = this.m.tick;
    this.throwProt = T.THROW_PROT;
    this.setActionRaw('idle'); this.stun = 0;
    this.neutral(o);
  };

  Fighter.prototype.step = function (o) {
    if (this.stop > 0) { this.stop--; return; }
    this.px = this.x;
    this.af++;
    if (this.invAll > 0) this.invAll--;
    if (this.invThrow > 0) this.invThrow--;
    if (this.throwProt > 0) this.throwProt--;
    if (this.tagT > 0) this.tagT--;
    if (this.trail > 0) this.trail--;
    if (this.crouchT < 99) this.crouchT++;
    if (this.standT < 99) this.standT++;
    var C = this.C, a = this.action;

    switch (a) {
      case 'idle': case 'walkF': case 'walkB': case 'crouch': case 'guard':
        if (this.m.canAct) this.neutral(o);
        else { this.vx = 0; if (a !== 'idle' && a !== 'crouch') this.setAction('idle'); }
        break;
      case 'jumpSquat':
        var c =this.af <= 2 ? this.command(ALLOW_SQUAT) : null;
        if (c) { this.startMove(c.id, c.str, c.press, c); break; }
        if (this.af >= 4) this.takeoff();
        break;
      case 'jump':
        this.tryAir();
        break;
      case 'land':
        if (this.af >= this.landLag) { this.setActionRaw('idle'); this.neutral(o); }
        break;
      case 'dashF': case 'dashB':
        var t = this.af - 1, n = this.dashN;
        var sp = Math.max(0, this.dashV0 * (1 - (t + 0.5) / n));
        this.vx = sp * this.facing * (a === 'dashF' ? 1 : -1);
        if (this.af >= n) { this.vx = 0; this.setActionRaw('idle'); this.neutral(o); }
        break;
      case 'attack':
        this.runMove(o);
        break;
      case 'blockstun':
        var bd = this.inp.dir(this.facing);
        this.guardLow = bd <= 3;
        this.vx = 0;
        if (--this.stun <= 0) this.recover(o);
        break;
      case 'hitstun':
        this.vx = 0;
        if (--this.stun <= 0) this.recover(o);
        break;
      case 'launch':
        break;
      case 'down':
        if (this.ko) break;
        if (this.af <= 10 && this.inp.pressed && !this.quick) { this.quick = true; this.lie = T.QUICK_LIE; }
        if (this.af >= 10 + this.lie) { this.setActionRaw('getup'); this.invAll = T.GETUP + 1; }
        break;
      case 'getup':
        if (this.af >= T.GETUP) { this.invThrow = T.WAKE_THROW_INV; this.invAll = 0; this.recover(o); }
        break;
      case 'caught':
        this.vx = 0; this.vy = 0;
        if (--this.caughtT <= 0) {
          if (this.air) { this.setActionRaw('launch'); this.knock = 'reset'; this.vy = -1; }
          else this.recover(o);
        }
        break;
      case 'thrown':
        if (this.techT > 0) this.techT--;
        break;
      default: break;   // intro / win / lose / ko: driven by the match
    }
    this.physics();
  };

  Fighter.prototype.physics = function () {
    var a = this.action;
    if (a === 'thrown' || a === 'caught') return;
    var sg = this.seg();
    if (this.air) {
      var g;
      if (a === 'launch') g = this.grav;
      else if (sg && sg.g != null) g = sg.g;
      else g = this.C.jump.g;
      this.vy += g;
    }
    if (this.pushN > 0) {
      if (!this.air && (this.pushN % 6) === 0 && Math.abs(this.pushV) > 0.8) F.fx('dust.skid', this.x, T.GY, { facing: F.sign(this.pushV) });
      this.x += this.pushV;
      this.pushV -= this.pushDec; this.pushN--;
      if (this.pushN <= 0) { this.pushV = 0; this.pushSrc = null; }
    }
    this.x += this.vx;
    if (this.air) {
      this.y += this.vy;
      if (this.y >= GY && this.vy >= 0) { this.y = GY; this.vy = 0; this.air = false; this.onLand(); }
    } else this.y = GY;
  };

  Fighter.prototype.onLand = function () {
    var a = this.action;
    F.fx('dust.land', this.x, GY, { facing: this.facing });
    if (a === 'jump') { F.sfx('land', { pan: F.pan(this.x, this.m.camX), vol: 0.5 }); this.startLand(T.LAND_LAG); return; }
    if (a === 'attack' && this.mv) {
      var sg = this.seg();
      if (sg && sg.loop === 'land') {
        if (this.si < this.res.segs.length - 1) { this.si++; this.sf = 0; this.vx = 0; this.enterSeg(); if (this.res) { var ns = this.seg(); if (ns && ns.vx == null) this.vx = 0; } }
        else this.endMove();
      } else if (this.mv.stance === 'air' || this.mv.air) {
        this.endMove();
      } else { this.vx = 0; }
      return;
    }
    if (a === 'launch') {
      if (this.knock === 'reset' && !this.ko) { this.startLand(8); this.juggle = 0; return; }
      this.setActionRaw('down'); this.vx = 0; this.juggle = 0; this.quick = false; this.lie = T.DOWN_LIE;
      F.fx('dust.down', this.x, GY, { facing: this.facing, power: 0.7 });
      F.sfx('down', { pan: F.pan(this.x, this.m.camX) });
      if (this.m.stage && !F.headless) this.m.stageEvent('hit', { x: this.x, power: 0.4 });
      return;
    }
    this.startLand(T.LAND_LAG);
  };

  // ------------------------------------------------------------------ status queries
  Fighter.prototype.strikeInvuln = function () {
    if (this.invAll > 0 || this.hidden) return true;
    var a = this.action;
    if (a === 'down' || a === 'getup' || a === 'thrown' || a === 'intro' || a === 'win' || a === 'lose') return true;
    if (a === 'launch' && this.juggle >= 99) return true;
    if (a === 'attack' && this.mv && this.mv.inv) {
      var iv = this.mv.inv, s = this.str, r;
      r = F.v(iv.all, s); if (r && this.mf >= r[0] && this.mf <= r[1]) return true;
      r = F.v(iv.strike, s); if (r && this.mf >= r[0] && this.mf <= r[1]) return true;
    }
    return false;
  };
  Fighter.prototype.throwable = function () {
    if (this.air || this.hidden || this.ko) return false;
    if (this.invThrow > 0 || this.throwProt > 0 || this.invAll > 0) return false;
    var a = this.action;
    if (a === 'hitstun' || a === 'blockstun' || a === 'down' || a === 'getup' || a === 'thrown' ||
      a === 'caught' || a === 'launch' || a === 'dashB' || a === 'intro' || a === 'win' || a === 'lose') return false;
    if (a === 'attack' && this.mv) {
      if (this.mv.kind === 'super' || this.mv.id === 'throwHit') return false;
      var iv = this.mv.inv, s = this.str, r;
      if (iv) {
        r = F.v(iv.all, s); if (r && this.mf >= r[0] && this.mf <= r[1]) return false;
        r = F.v(iv['throw'], s); if (r && this.mf >= r[0] && this.mf <= r[1]) return false;
      }
    }
    return true;
  };
  // in a state where a guard is possible at all
  Fighter.prototype.guardState = function () {
    if (this.air) return false;
    var a = this.action;
    return a === 'idle' || a === 'walkF' || a === 'walkB' || a === 'crouch' || a === 'guard' || a === 'blockstun';
  };
  Fighter.prototype.actionable = function () {
    return NEUTRAL[this.action] === 1 || (this.action === 'jump');
  };

  // ------------------------------------------------------------------ pose
  Fighter.prototype.pose = function () {
    var a = this.action, af = this.af, ch = this.ch, anim, seg, u;
    switch (a) {
      case 'idle':
        if (this.standT < 4) { anim = 'crouchOut'; seg = 'go'; u = this.standT / 4; }
        else { anim = 'idle'; seg = 'loop'; u = (this.m.tick + this.side * 23) / F.segLen(ch, 'idle', 'loop'); }
        break;
      case 'walkF': case 'walkB': anim = a; seg = 'loop'; u = af / F.segLen(ch, a, 'loop'); break;
      case 'crouch':
        if (this.crouchT < 4) { anim = 'crouchIn'; seg = 'go'; u = this.crouchT / 4; }
        else { anim = 'crouch'; seg = 'loop'; u = (this.crouchT - 4) / F.segLen(ch, 'crouch', 'loop'); }
        break;
      case 'guard': case 'blockstun':
        anim = this.guardLow ? 'guardCrouch' : 'guardStand'; seg = 'loop'; u = af / F.segLen(ch, anim, 'loop'); break;
      case 'jumpSquat': anim = 'jumpSquat'; seg = 'go'; u = Math.min(af / 4, 0.99); break;
      case 'jump':
        anim = this.vy < 0 ? 'jumpRise' : 'jumpFall'; seg = 'loop'; u = af / F.segLen(ch, anim, 'loop'); break;
      case 'land': anim = 'land'; seg = 'go'; u = Math.min(af / Math.max(this.landLag, 6), 0.99); break;
      case 'dashF': case 'dashB': anim = a; seg = 'go'; u = Math.min(af / this.dashN, 0.99); break;
      case 'hitstun': anim = this.stunAnim; seg = 'reel'; u = Math.min((this.stunMax - this.stun) / this.stunMax, 0.99); break;
      case 'caught': anim = 'hitHigh'; seg = 'reel'; u = 0.2; break;
      case 'launch': anim = 'launch'; seg = 'loop'; u = af / F.segLen(ch, 'launch', 'loop'); break;
      case 'down':
        if (af < 10) { anim = 'down'; seg = 'impact'; u = af / 10; }
        else { anim = 'down'; seg = 'lie'; u = (af - 10) / F.segLen(ch, 'down', 'lie'); }
        break;
      case 'getup': anim = 'getup'; seg = 'rise'; u = Math.min(af / T.GETUP, 0.99); break;
      case 'thrown': anim = 'thrown'; seg = 'loop'; u = af / F.segLen(ch, 'thrown', 'loop'); break;
      case 'intro': anim = 'intro'; seg = 'act'; u = Math.min(af / F.segLen(ch, 'intro', 'act'), 0.99); break;
      case 'win': case 'lose':
        if (af < 30) { anim = a; seg = 'in'; u = af / 30; }
        else { anim = a; seg = 'loop'; u = (af - 30) / F.segLen(ch, a, 'loop'); }
        break;
      case 'attack':
        var sg = this.seg();
        anim = sg.anim || this.mv.anim; seg = sg.as;
        if (sg.loop) u = this.sf / F.segLen(ch, anim, seg);
        else u = Math.min(this.sf / Math.max(1, sg.f), 0.999);
        if (this.mv.flashAt != null && this.m.freeze > 0 && this.m.flash && this.m.flash.who === this) { u = 0.999; }
        break;
      default: anim = 'idle'; seg = 'loop'; u = 0;
    }
    this.anim = anim; this.pseg = seg; this.pu = u;
    this.hidden = !!(a === 'attack' && this.seg() && this.seg().hide);
    var p = this.puppet;
    if (p) {
      try { p.setPoseSeg(anim, seg, u); } catch (e) { F.err('rig.setPoseSeg ' + anim + '.' + seg, e); }
    }
    // after-images
    if (this.trail > 0 && (this.m.tick & 1) === 0 && !this.hidden) {
      this.after.push({ anim: anim, seg: seg, u: u, x: this.x, y: this.y, facing: this.facing, t: this.m.tick });
      if (this.after.length > 4) this.after.shift();
    } else if (this.trail <= 0 && this.after.length && this.m.tick - this.after[this.after.length - 1].t > 10) this.after.length = 0;
  };

  Fighter.prototype.tickPuppet = function () {
    var p = this.puppet;
    if (!p || !p.tick || F.headless) return;
    try { p.tick({ x: this.x, y: this.y, vx: this.vx, vy: this.vy, facing: this.facing, grounded: !this.air }); }
    catch (e) { F.err('rig.tick', e); }
  };
})();
