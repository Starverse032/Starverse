/* LATENT CLASH — FIGHT combat: hurt/hit/push boxes, hit + block resolution (stun, scaling,
 * juggles, counter-hits, pushback with corner transfer, gauge), throws + techs, Claude's
 * counter-catch, projectiles (spawn, travel, clash, absorb, hit), DeepSeek's dive teleport. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var T = F.T, GY = T.GY;

  var LVNAME = { L: 'light', M: 'medium', H: 'heavy', S: 'special', X: 'special', T: 'heavy' };
  var EMPTY = [];

  // ------------------------------------------------------------------ boxes
  F.hurtBoxes = function (f, out) {
    out = out || [];
    out.length = 0;
    var a = f.action, C = f.C;
    if (f.hidden || a === 'down' || a === 'getup') return out;
    var set = f.air ? C.hurt.air : (f.isCrouching() ? C.hurt.crouch : C.hurt.stand);
    for (var i = 0; i < set.length; i++) out.push(F.worldBox(set[i], f.x, f.y, f.facing));
    // limb extension while attacking (whiff punishable pokes)
    if (a === 'attack' && f.mv && f.mv.hits && (f.mv.kind === 'normal' || f.mv.extHurt)) {
      var sg = f.seg(), ph = f.phase();
      if (ph === 'active' || (ph === 'recovery' && sg && f.sf < sg.f * 0.66)) {
        var h = f.mv.hits[0], b = h.box;
        if (b) {
          var tip = b[0] + b[2] - 4;
          if (tip > 8) out.push(F.worldBox([6, b[1] + 1, tip - 6, Math.max(6, b[3] - 2)], f.x, f.y, f.facing));
        }
      }
    }
    return out;
  };

  F.pushBox = function (f) {
    if (f.hidden || f.action === 'thrown') return null;
    var a = f.action;
    if (a === 'attack' && f.seg() && f.seg().noPush) return null;
    var P = f.C.push;
    var b = f.air ? P.air : (f.isCrouching() || a === 'down' ? P.crouch : P.stand);
    return F.worldBox(b, f.x, f.y, f.facing);
  };

  // local hit box for spec h at the fighter's current pose
  F.hitLocal = function (f, h) {
    var sg = f.seg();
    if (h.beam) {
      var bm = f.mv.beam, len = Math.min(bm.max, bm.grow * (f.sf + 1));
      return [bm.x0, bm.y, len, bm.h];
    }
    var b = h.box;
    if (h.anchor && f.puppet && !f.puppetFallback) {
      var a = f.anchor(h.anchor);
      var tipD = b[0] + b[2], cyD = b[1] + b[3] / 2;
      var tip = F.clamp(a.x + 2, tipD - 8, tipD + 6);
      var cy = F.clamp(a.y, cyD - 14, cyD + 14);
      return [tip - b[2], Math.round(cy - b[3] / 2), b[2], b[3]];
    }
    return b;
  };

  // hits active on this frame -> [{ h, box, key }]
  F.activeHits = function (f, out) {
    out = out || [];
    out.length = 0;
    if (f.action !== 'attack' || !f.mv || !f.mv.hits) return out;
    var sg = f.seg(), hs = f.mv.hits;
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (h.seg !== sg.id) continue;
      if (h.fr && (f.sf < h.fr[0] || f.sf > h.fr[1])) continue;
      var key = h.group;
      if (h.every) key = h.group + ':' + Math.floor((f.sf - (h.fr ? h.fr[0] : 0)) / h.every);
      if (f.hitGroups[key]) continue;
      var lb = F.hitLocal(f, h);
      out.push({ h: h, key: key, box: F.worldBox(lb, f.x, f.y, f.facing) });
    }
    return out;
  };

  F.barrierBox = function (f) {
    if (!f.mv || !f.mv.catchSeg || f.action !== 'attack') return null;
    var sg = f.seg();
    if (!sg || sg.id !== f.mv.catchSeg) return null;
    return F.worldBox(f.mv.barrier, f.x, f.y, f.facing);
  };

  function hitSpec(h, s, final) {
    if (!final) return h;
    var o = {}, k;
    for (k in h) o[k] = h[k];
    for (k in final) if (k !== 'from') o[k] = final[k];
    o.final = null;
    return o;
  }

  function juggleOK(vic, h) {
    if (vic.action !== 'launch') return true;
    if (vic.juggle >= 99) return false;
    if (h.juggleAny) return true;
    return vic.juggle + (h.jug || 1) <= T.JUGGLE_MAX;
  }

  // ------------------------------------------------------------------ strike resolution (per tick)
  var tmpA = [], tmpH = [];
  F.collectStrikes = function (m, att, vic, events) {
    if (m.noHits || att.action !== 'attack' || !att.mv || !att.mv.hits) return;
    var hits = F.activeHits(att, tmpA);
    if (!hits.length) return;
    if (vic.strikeInvuln()) return;
    var hurts = F.hurtBoxes(vic, tmpH);
    var bar = F.barrierBox(vic);
    for (var i = 0; i < hits.length; i++) {
      var e = hits[i], hb = e.box;
      if (!juggleOK(vic, e.h)) continue;
      var touch = bar && !e.h.noCatch && F.overlap(hb, bar);
      for (var j = 0; !touch && j < hurts.length; j++) if (F.overlap(hb, hurts[j])) touch = true;
      if (!touch) continue;
      var hx = (Math.max(hb.x, vic.x - 12) + Math.min(hb.x + hb.w, vic.x + 12)) / 2;
      var hy = Math.max(hb.y, vic.y - 70) + Math.min(hb.h, 14) / 2;
      events.push({ att: att, vic: vic, h: e.h, key: e.key, x: hx, y: hy, sf: att.sf, mv: att.mv });
      return;   // one hit per attacker per tick
    }
  };

  F.blockCheck = function (m, vic, h, srcX) {
    if (!vic.guardState() || h.guard === 'none') return null;
    var away = srcX > vic.x + 0.5 ? -1 : (srcX < vic.x - 0.5 ? 1 : -vic.facing);
    var auto = m.autoGuard ? m.autoGuard(vic, h) : null;
    if (auto === true) return { low: h.guard === 'low' ? true : h.guard === 'high' ? false : vic.isCrouching() };
    if (auto === false) return null;
    if (vic.inp.absX() !== away) return null;
    var low = vic.inp.absY() < 0;
    if (h.guard === 'low' && !low) return null;
    if (h.guard === 'high' && low) return null;
    return { low: low };
  };

  function pushback(att, vic, dist, dir, transfer) {
    if (dist <= 0) return;
    var avail = dir > 0 ? (LC.STAGE_W - T.WALL - vic.x) : (vic.x - T.WALL);
    var vd = Math.min(dist, Math.max(0, avail));
    setPush(vic, vd, dir);
    if (transfer && att && vd < dist && !att.air) setPush(att, dist - vd, -dir);
  }
  function setPush(f, dist, dir) {
    if (dist <= 0) return;
    var n = 8;
    f.pushN = n; f.pushV = (2 * dist / n) * dir; f.pushDec = f.pushV / n;
  }
  F.setPush = setPush;

  function abortMove(f) {
    if (f.action === 'attack') { f.mv = null; f.res = null; f.connected = null; }
    if (f.victim) { var v = f.victim; f.victim = null; if (v.action === 'thrown') { v.setActionRaw('launch'); v.air = v.y < GY; v.knock = 'reset'; v.juggle = 99; v.thrower = null; } }
  }

  // Apply one strike/projectile/throw contact. ctx = { proj, x, y, key }
  F.applyHit = function (m, att, vic, h0, ctx) {
    var s = ctx.proj ? ctx.proj.str : att.str;
    var proj = ctx.proj || null;
    var mv = proj ? null : (att.mv || ctx.mv);
    if (!proj && !mv) return 'whiff';
    var finalHit = !proj && h0.final && (ctx.sf != null ? ctx.sf : att.sf) >= h0.final.from;
    var h = hitSpec(h0, s, finalHit ? h0.final : null);
    var lv = h.lv || 'M';
    var srcX = proj ? proj.x - proj.vx * 4 : att.x;
    var dir = proj ? F.sign(proj.vx) || att.facing : (F.sign(vic.x - att.x) || att.facing);
    var kind = proj ? 'special' : mv.kind;
    if (!proj && ctx.key != null) att.hitGroups[ctx.key] = 1;

    // ---- Claude's counter stance catches strikes
    if (!proj && !h.noCatch && kind !== 'throw' && vic.action === 'attack' && vic.mv && vic.mv.catchSeg &&
      vic.seg() && vic.seg().id === vic.mv.catchSeg) {
      F.catchStrike(m, vic, att);
      return 'catch';
    }

    var dmg0 = F.v(h.dmg, s) || 0;
    var blk = F.blockCheck(m, vic, h, srcX);
    if (blk) {
      var chip = Math.round(dmg0 * (F.v(h.chip, s) || 0));
      if (chip > 0) { vic.hp = Math.max(0, vic.hp - chip); att.stats.damage += chip; if (vic.hp <= 0) m.lastKill = { side: att.side, kind: kind === 'super' ? 'super' : 'chip' }; }
      var bs;
      if (h.stun) bs = F.v(h.stun[1], s);
      else bs = remaining(att) + F.v(h.adv ? h.adv[1] : 0, s);
      bs = Math.max(4, bs | 0);
      if (vic.action === 'attack') abortMove(vic);
      vic.guardLow = blk.low; vic.setActionRaw('blockstun'); vic.stun = bs; vic.stunMax = bs; vic.vx = 0;
      var pb = h.push ? F.v(h.push[1], s) : T.PUSH[lv][1];
      pushback(att, vic, pb, dir, !proj);
      var bst = T.BLOCKSTOP[lv] != null ? T.BLOCKSTOP[lv] : 7;
      vic.stop = Math.max(vic.stop, bst);
      if (proj) proj.stop = bst; else att.stop = Math.max(att.stop, bst);
      att.addMeter((T.METER_HIT[lv] || 4) / 2);
      vic.addMeter(2);
      if (!proj && !att.connected) att.connected = 'block';
      var heavy = lv === 'H' || lv === 'S' || lv === 'X';
      F.fx(heavy ? 'block.heavy' : 'block.light', ctx.x, ctx.y, { facing: -dir, power: heavy ? 0.8 : 0.4, palette: vic.pal });
      F.sfx(heavy ? 'block.heavy' : 'block.light', { pan: F.pan(ctx.x, m.camX) });
      if (m.onContact) m.onContact(att, vic, 'block', 0, h, kind);
      return 'block';
    }

    // ---- hit
    var counter = vic.action === 'attack' && vic.mv && vic.mv.kind !== 'super' && vic.mv.kind !== 'system' && vic.phase() !== 'recovery';
    var inCombo = vic.action === 'hitstun' || vic.action === 'launch' || vic.action === 'caught';
    if (!inCombo) { att.combo = 0; att.comboDmg = 0; att.comboStart = m.tick; }
    var inst = proj ? 'p' + proj.id : 'm' + att.moveInst;
    if (att.scaleInst !== inst) { att.scaleInst = inst; att.scaleIdx = att.combo; }
    var idx = (kind === 'super' || (mv && mv.hits && mv.hits.length > 1) || h.every) ? att.scaleIdx : att.combo;
    var sc = T.SCALE[Math.min(idx, T.SCALE.length - 1)];
    sc = Math.max(sc, kind === 'super' ? T.SCALE_MIN_SUPER : T.SCALE_MIN);
    var dmg = Math.max(1, Math.round(dmg0 * sc * (counter ? T.COUNTER_DMG : 1)));
    att.combo++; att.comboDmg += dmg; att.comboShow = att.combo; att.comboShowDmg = att.comboDmg; att.comboT = 0;
    vic.hp = Math.max(0, vic.hp - dmg);
    att.stats.damage += dmg; att.stats.hits++;
    if (att.combo > att.stats.maxCombo) att.stats.maxCombo = att.combo;
    if (vic.hp <= 0) m.lastKill = { side: att.side, kind: kind === 'super' ? 'super' : (kind === 'special' ? 'special' : (kind === 'throw' ? 'throw' : 'normal')) };

    var wasAir = vic.air, wasCrouch = vic.isCrouching();
    if (vic.action === 'attack') {
      if (vic.mv && vic.mv.kind === 'super') { /* super armor is invuln-based; still interrupted */ }
      abortMove(vic);
    }
    var stun;
    if (h.stun) stun = F.v(h.stun[0], s); else stun = remaining(att) + F.v(h.adv ? h.adv[0] : 0, s);
    if (counter) stun += lv === 'L' ? 3 : 6;
    stun -= Math.max(0, Math.floor((att.combo - 5) / 2));
    if (m.tick - (att.comboStart || 0) > 300) stun = Math.min(stun, 6);
    stun = Math.max(6, stun | 0);

    var isNormal = kind === 'normal';
    if (h.kd === 'down' && !wasAir) {
      vic.setActionRaw('down'); vic.vx = 0; vic.vy = 0; vic.quick = false; vic.lie = T.DOWN_LIE; vic.juggle = 0;
      F.fx('dust.down', vic.x, GY, { facing: dir, power: 0.6 });
      F.sfx('down', { pan: F.pan(vic.x, m.camX), vol: 0.8 });
    } else if (h.kd === 'launch' || wasAir || vic.hp <= 0) {
      var reset = wasAir && !h.kd && isNormal && h.air !== 'knock';
      vic.setActionRaw('launch');
      vic.knock = reset ? 'reset' : 'knock';
      if (wasAir) vic.juggle += (h.jug || 1);
      if (reset) vic.juggle = 99;
      vic.air = true;
      var lvx = h.lvx != null ? h.lvx : (reset ? 1.4 : 1.8);
      var lvy = h.lvy != null ? h.lvy : (reset ? -3.2 : -4.2);
      if (!h.kd && !wasAir) lvy = -3.4;
      vic.vx = lvx * dir; vic.vy = lvy;
      vic.grav = 0.36 + 0.025 * Math.min(vic.juggle, 10);
      if (vic.y >= GY) vic.y = GY - 1;
    } else {
      vic.setActionRaw('hitstun');
      vic.stun = stun; vic.stunMax = stun; vic.vx = 0;
      vic.stunAnim = wasCrouch ? 'hitCrouch' : (h.guard === 'low' ? 'hitLow' : 'hitHigh');
      var pd = h.push ? F.v(h.push[0], s) : T.PUSH[lv][0];
      pushback(att, vic, pd, dir, !proj);
    }
    if (vic.hp <= 0) { vic.juggle = 99; }
    if (h.pull && !proj) { var tx = att.x + att.facing * h.pull; vic.x += F.clamp(tx - vic.x, -10, 10); }

    var st = (T.HITSTOP[lv] != null ? T.HITSTOP[lv] : 9) + (counter ? 4 : 0);
    vic.stop = Math.max(vic.stop, st);
    if (proj) proj.stop = st; else att.stop = Math.max(att.stop, st);
    att.addMeter(T.METER_HIT[lv] != null ? T.METER_HIT[lv] : 5);
    vic.addMeter(Math.max(1, dmg / 22));
    if (!proj) att.connected = 'hit';
    else if (proj.inst === att.moveInst && att.action === 'attack') att.connected = 'hit';
    vic.flash = 1; vic.flashColor = counter ? '#ffd166' : '#ffffff';

    // presentation
    var fxName = h.fx || ('hit.' + LVNAME[lv]);
    F.fx(fxName, ctx.x, ctx.y, { facing: dir, power: lv === 'L' ? 0.3 : lv === 'M' ? 0.55 : 0.9, palette: att.pal, index: h.fxIndex || 0 });
    if (fxName !== 'hit.' + LVNAME[lv] && !proj) F.fx('hit.' + LVNAME[lv], ctx.x, ctx.y, { facing: dir, power: 0.6, palette: att.pal });
    if (counter) F.fx('hit.counter', ctx.x, ctx.y, { facing: dir, power: 1, palette: att.pal });
    F.sfx(h.sfx || (counter ? 'hit.counter' : 'hit.' + LVNAME[lv]), { pan: F.pan(ctx.x, m.camX) });
    if (lv === 'H' || lv === 'S' || (lv === 'M' && counter)) F.voice(vic.ch, 'hurt');
    var shake = lv === 'H' ? 3 : lv === 'S' ? 3 : lv === 'X' ? 2 : lv === 'M' ? 1 : 0;
    if (counter) shake++;
    if (shake) m.addShake(shake, lv === 'L' || lv === 'M' ? 6 : 10);
    m.stageEvent('hit', { x: ctx.x, power: lv === 'L' ? 0.2 : lv === 'M' ? 0.45 : 0.85 });
    if (m.onContact) m.onContact(att, vic, 'hit', dmg, h, kind, counter);
    return 'hit';
  };

  function remaining(att) {
    if (!att.res) return 10;
    var r = att.res.total - att.mf - 1;
    return r > 0 ? r : 0;
  }

  // ------------------------------------------------------------------ counter stance
  F.catchStrike = function (m, cl, att) {
    var gx = cl.x + cl.facing * 18;
    F.fx('claude.guardCatch', gx, cl.y - 40, { facing: cl.facing, palette: cl.pal, power: 1 });
    F.sfx('counter.catch', { pan: F.pan(gx, m.camX) });
    if (LC.LORE && LC.LORE.guardrailLine) m.say(cl.side, LC.LORE.guardrailLine, 80);
    abortMove(att);
    att.setActionRaw('caught'); att.caughtT = 34; att.vx = 0; att.vy = 0; att.pushN = 0;
    att.stop = 10; att.flash = 1; att.flashColor = '#ffd9a0';
    var s = cl.str;
    cl.startMove('guardrailHit', s);
    cl.stop = 10;
    cl.addMeter(6);
    m.addShake(2, 8);
    if (m.onContact) m.onContact(cl, att, 'catch', 0, null, 'special');
  };

  // ------------------------------------------------------------------ throws
  F.tryGrab = function (m, att, vic) {
    if (m.noHits || att.victim) return;
    if (Math.abs(vic.x - att.x) > att.C.throwRange) return;
    if (vic.inMove('throw') && vic.seg() && vic.seg().id !== 'recovery') { F.techThrow(m, att, vic); return; }
    if (!vic.throwable()) return;
    var back = att.throwBack;
    att.startMove('throwHit', 'M');
    att.throwBack = back;
    att.victim = vic;
    abortMove(vic);
    vic.setActionRaw('thrown'); vic.thrower = att; vic.techT = T.THROW_TECH;
    vic.vx = 0; vic.vy = 0; vic.air = false; vic.pushN = 0;
    vic.facing = -att.facing;
    F.sfx('throw.grab', { pan: F.pan(att.x, m.camX) });
    if (m.onContact) m.onContact(att, vic, 'grab', 0, null, 'throw');
  };

  F.techThrow = function (m, a, b) {
    abortMove(a); abortMove(b);
    [a, b].forEach(function (f) {
      f.setActionRaw('blockstun'); f.stun = 16; f.stunMax = 16; f.guardLow = false; f.thrower = null; f.victim = null; f.air = false; f.y = GY;
    });
    var dir = F.sign(b.x - a.x) || a.facing;
    setPush(b, 26, dir); setPush(a, 26, -dir);
    var mx = (a.x + b.x) / 2;
    F.fx('throw.tech', mx, GY - 44, { facing: a.facing });
    F.sfx('throw.tech', { pan: F.pan(mx, m.camX) });
    m.addShake(1, 6);
    if (m.onContact) m.onContact(a, b, 'tech', 0, null, 'throw');
  };

  function lerpPath(path, u) {
    if (!path || !path.length) return [24, -42];
    if (path.length === 1) return path[0];
    var t = F.clamp(u, 0, 1) * (path.length - 1), i = Math.min(Math.floor(t), path.length - 2), k = t - i;
    return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k];
  }

  F.throwStep = function (m, att, vic) {
    if (!vic || vic.action !== 'thrown' || vic.thrower !== att) return;
    var sg = att.seg();
    if (sg.id === 'hold' && vic.techT > 0) {
      var p = vic.inp.fresh(3, T.BUF_BTN);
      if (p && (p.b & 3) === 3) { vic.inp.consume(p); F.techThrow(m, att, vic); return; }
    }
    if (sg.id === 'recovery') { if (att.sf === 0) release(m, att, vic); return; }
    var g;
    if (att.puppet && !att.puppetFallback) { var a = att.anchor('grab'); g = [a.x, a.y]; }
    else g = lerpPath(att.C.grabPath[sg.id], att.sf / Math.max(1, sg.f));
    if (att.throwBack && sg.id === 'toss') {
      var k = F.clamp(att.sf / Math.max(1, sg.f), 0, 1);
      g = [g[0] * (1 - 2 * k), g[1] - Math.sin(k * Math.PI) * 16];
    }
    var c = vic.anchor('chest');
    vic.x = att.x + g[0] * att.facing - c.x * vic.facing;
    vic.y = Math.min(GY, att.y + g[1] - c.y);
  };

  function release(m, att, vic) {
    var dir = att.throwBack ? -att.facing : att.facing;
    var dmg = T.THROW_DMG;
    vic.hp = Math.max(0, vic.hp - dmg);
    att.stats.damage += dmg; att.stats.throws++; att.stats.hits++;
    att.combo = 1; att.comboDmg = dmg; att.comboShow = 1; att.comboShowDmg = dmg; att.comboT = 0;
    if (vic.hp <= 0) m.lastKill = { side: att.side, kind: 'throw' };
    if (att.throwBack) { vic.x = att.x - att.facing * 22; }
    vic.thrower = null; att.victim = null;
    vic.setActionRaw('launch'); vic.knock = 'knock'; vic.juggle = 99; vic.air = true;
    vic.vx = 2.2 * dir; vic.vy = -3.8; vic.grav = 0.4;
    if (vic.y >= GY) vic.y = GY - 2;
    vic.flash = 1; vic.flashColor = '#ffffff';
    vic.stop = 6; att.stop = 6;
    att.addMeter(T.METER_HIT.T); vic.addMeter(4);
    F.fx('throw.slam', vic.x, GY - 20, { facing: dir, power: 1, palette: att.pal });
    F.sfx('throw.slam', { pan: F.pan(vic.x, m.camX) });
    F.voice(vic.ch, 'hurt');
    m.addShake(3, 10);
    m.stageEvent('hit', { x: vic.x, power: 0.7 });
    if (m.onContact) m.onContact(att, vic, 'hit', dmg, null, 'throw');
  }

  // ------------------------------------------------------------------ projectiles
  var projId = 0;
  F.spawnProj = function (m, f) {
    var P = f.mv.proj, s = f.str;
    var a = f.puppet && !f.puppetFallback ? f.anchor(P.spawn) : { x: P.spawnFb[0], y: P.spawnFb[1] };
    var ax = F.clamp(a.x, 8, 52), ay = F.clamp(a.y, -76, 0);
    var x = f.x + ax * f.facing, y = P.ground ? GY : f.y + ay;
    var p = {
      id: ++projId, owner: f, inst: f.moveInst, spec: P, str: s, kind: P.kind, sprite: P.sprite,
      x: x, y: y, vx: F.v(P.vx, s) * f.facing, vy: F.v(P.vy, s) || 0, t: 0, dist: 0,
      range: F.v(P.range, s) || 99999, facing: f.facing, stop: 0, dead: false,
      hit: {
        dmg: F.v(P.dmg, s), lv: P.lv || 'S', stun: P.stun, chip: P.chip, push: P.push, guard: P.guard || 'mid',
        fx: P.hitFx, sfx: P.hitSfx, air: 'knock', lvx: 2.0, lvy: -4.4, jug: 1
      }
    };
    m.projs.push(p);
    f.proj++;
    if (P.castFx) F.fx(P.castFx, x, y, { facing: f.facing, palette: f.pal, power: s === 'H' ? 1 : s === 'L' ? 0.4 : 0.7 });
    if (P.castSfx) F.sfx(P.castSfx, { pan: F.pan(x, m.camX) });
  };

  function killProj(m, p, fx) {
    if (p.dead) return;
    p.dead = true;
    p.owner.proj = Math.max(0, p.owner.proj - 1);
    if (fx) F.fx(p.spec.hitFx || 'hit.special', p.x, p.y - (p.spec.ground ? 10 : 0), { facing: F.sign(p.vx) || 1, palette: p.owner.pal, power: 0.5 });
  }
  F.killProj = killProj;

  function projBox(p) { return F.worldBox(p.spec.box, p.x, p.y, F.sign(p.vx) || p.facing); }

  F.updateProjs = function (m) {
    var ps = m.projs, i, j;
    for (i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p.dead) continue;
      if (p.stop > 0) { p.stop--; continue; }
      p.x += p.vx; p.y += p.vy; p.t++; p.dist += Math.abs(p.vx);
      if (p.spec.diag && p.y >= GY - 5) { p.y = GY - 5; killProj(m, p, true); continue; }
      if (p.dist > p.range) { killProj(m, p, true); continue; }
      if (p.x < m.camX - 40 || p.x > m.camX + LC.W + 40 || p.x < -40 || p.x > LC.STAGE_W + 40) { killProj(m, p, false); continue; }
    }
    // projectile vs projectile
    for (i = 0; i < ps.length; i++) for (j = i + 1; j < ps.length; j++) {
      var a = ps[i], b = ps[j];
      if (a.dead || b.dead || a.owner === b.owner) continue;
      if (F.overlap(projBox(a), projBox(b))) {
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 6;
        killProj(m, a, false); killProj(m, b, false);
        F.fx('ring', mx, my, { power: 0.6 });
        F.fx(a.spec.hitFx || 'hit.special', mx, my, { facing: 1, palette: a.owner.pal, power: 0.6 });
        F.fx(b.spec.hitFx || 'hit.special', mx, my, { facing: -1, palette: b.owner.pal, power: 0.6 });
        F.sfx('hit.special', { pan: F.pan(mx, m.camX), vol: 0.7 });
        m.addShake(1, 4);
      }
    }
    // projectiles vs supers, barriers, fighters
    for (i = 0; i < ps.length; i++) {
      var q = ps[i];
      if (q.dead || q.stop > 0) continue;
      var vic = m.opp(q.owner), qb = projBox(q);
      if (vic.action === 'attack' && vic.mv && vic.mv.kind === 'super') {
        var sh = F.activeHits(vic, tmpA);
        var big = vic.mv.hits[0];
        var lb = big.beam ? F.hitLocal(vic, big) : big.box;
        if (vic.seg().id === 'active' && F.overlap(qb, F.worldBox(lb, vic.x, vic.y, vic.facing))) { killProj(m, q, true); continue; }
        if (sh.length) { /* nothing else */ }
      }
      var bar = F.barrierBox(vic);
      if (bar && F.overlap(qb, bar)) {
        killProj(m, q, false);
        F.fx('claude.guardCatch', q.x, q.y, { facing: vic.facing, palette: vic.pal, power: 0.6 });
        F.sfx('counter.catch', { pan: F.pan(q.x, m.camX), vol: 0.7 });
        vic.addMeter(5);
        if (m.onContact) m.onContact(q.owner, vic, 'absorb', 0, null, 'special');
        continue;
      }
      if (m.noHits || vic.strikeInvuln() || !juggleOK(vic, q.hit)) continue;
      var hurts = F.hurtBoxes(vic, tmpH), touch = false;
      for (j = 0; j < hurts.length; j++) if (F.overlap(qb, hurts[j])) { touch = true; break; }
      if (!touch) continue;
      var hx = q.x + F.sign(q.vx) * 4, hy = q.spec.ground ? q.y - 12 : q.y;
      F.applyHit(m, q.owner, vic, q.hit, { proj: q, x: hx, y: hy });
      killProj(m, q, false);
    }
    // compact
    for (i = ps.length - 1; i >= 0; i--) if (ps[i].dead) ps.splice(i, 1);
  };

  // ------------------------------------------------------------------ DeepSeek dive
  F.diveSeg = function (m, f, id) {
    var o = m.opp(f);
    if (id === 'sink') {
      F.fx('deepseek.poolIn', f.x, GY, { facing: f.facing, palette: f.pal });
      F.fx('deepseek.bubbles', f.x, GY - 6, { facing: f.facing, palette: f.pal });
    } else if (id === 'travel') {
      var s = f.str, toward = F.sign(o.x - f.x) || f.facing, dest;
      if (s === 'L') dest = f.x;
      else if (s === 'M') dest = f.x + toward * F.clamp(Math.abs(o.x - f.x) - 34, 0, 96);
      else {
        dest = o.x + toward * 36;
        if (dest < T.WALL + 4 || dest > LC.STAGE_W - T.WALL - 4) dest = o.x - toward * 36;
      }
      dest = F.clamp(dest, T.WALL, LC.STAGE_W - T.WALL);
      dest = F.clamp(dest, o.x - T.MAXSEP + 8, o.x + T.MAXSEP - 8);
      f.diveFrom = f.x; f.diveDest = dest;
    } else if (id === 'emerge') {
      if (f.diveDest != null) f.x = f.diveDest;
      var d = F.sign(o.x - f.x);
      if (d) f.facing = d;
      f.trail = 14;
      F.fx('deepseek.poolOut', f.x, GY, { facing: f.facing, palette: f.pal, power: 1 });
      F.sfx('deepseek.emerge', { pan: F.pan(f.x, m.camX) });
    }
  };
})();
