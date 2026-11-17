/* LATENT CLASH — FIGHT: Gemini engine support (CONTRACT-V2 §V2.6).
 *  - the light-twin: an engine entity owned by a fighter (f.twin). Spawned by the `twin` move
 *    (mv.twin) or for the super; waits (L/H) or waits + dashes (M), then performs `twinStrike`
 *    (its own copy of the move's segments, hit from the owner's `twinStrike` data); cannot be hit,
 *    has no push box, vanishes after its strike, when the owner is hit or thrown, at KO / round end.
 *    Its hit goes through F.applyHit like a projectile (hit-stop on the twin, not on her; guard
 *    direction from the twin's x; combo scaling and gauge as her own hits).
 *  - twin + mix-up rule (T.TWIN_GRACE): a hit from one source (her / her projectiles vs her twin) that
 *    lands ≤ TWIN_GRACE ticks (0 = the same tick) after the victim BLOCKED the other source is blocked in any
 *    guard (either direction, standing or crouching) — so one correct guard for the first contact
 *    always blocks a twin strike + her low / overhead / cross-up arriving on (almost) the same frame.
 *  - blink repositioning (mv.blink, F.blinkSeg), the double jump (fighter.js, C.airJump),
 *    the super: twin on the far side, pin of a comboed victim, meteor hit boxes from fx spriteInfo. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var T = F.T, GY = T.GY;
  var twinId = 0;

  function lo() { return T.WALL; }
  function hi() { return LC.STAGE_W - T.WALL; }
  function tfx(name, f, x, y, facing, extra) {
    var o = { facing: facing, palette: f.pal, 'char': f.ch, power: 1 };
    if (extra) for (var k in extra) o[k] = extra[k];
    F.fx(name, x, y, o);
  }

  function newTwin(m, f, kind, x) {
    var o = m.opp(f);
    return {
      owner: f, id: ++twinId, kind: kind, str: kind === 'super' ? 'M' : kind, inst: -1,
      x: x, y: GY, vx: 0, facing: F.sign(o.x - x) || f.facing,
      st: 'wait', t: 0, ft: 0, sf: 0, stop: 0, wait: 0, dashLeft: 0, dashN: 0, dashV: 0,
      res: null, si: 0, mf: 0, hitDone: false, anim: 'idle', seg: 'loop', u: 0
    };
  }

  // ------------------------------------------------------------------ spawn / vanish
  F.spawnTwin = function (m, f) {
    if (f.twin) F.twinVanish(m, f, true);
    var D = f.mv.twin, s = f.str, o = m.opp(f), toward = F.sign(o.x - f.x) || f.facing, x = f.x;
    if (s === 'H') {   // behind the opponent when she is close enough (and there is room), else in front
      x = o.x + toward * D.behind;
      if (Math.abs(o.x - f.x) > D.near || x < lo() + 4 || x > hi() - 4) x = o.x - toward * D.behind;
    }
    x = F.clamp(x, lo(), hi());
    var tw = newTwin(m, f, s, x);
    tw.wait = F.v(D.wait, s);
    if (s === 'M') {   // dashes up to D.dash forward, stopping D.stopAt in front of the opponent (as she saw them)
      var dd = F.clamp(Math.abs(o.x - x) - (D.stopAt || 36), 0, D.dash);
      tw.dashN = tw.dashLeft = D.dashF; tw.dashV = toward * dd / D.dashF; tw.facing = toward;
    }
    f.twin = tw;
    tfx('gemini.twinSpawn', f, tw.x, GY, tw.facing);
    F.sfx('gemini.twin', { pan: F.pan(tw.x, m.camX) });
    return tw;
  };

  F.twinVanish = function (m, f, fx, why) {
    var tw = f.twin;
    if (!tw) return;
    f.twin = null;
    if (fx) tfx('gemini.twinVanish', f, tw.x, tw.y, tw.facing);
    if (m.onTwin) m.onTwin(f, tw, why || 'vanish');
  };

  // frames until the twin's strike is active (0 while active, -1 when it cannot hit any more)
  F.twinLeft = function (tw) {
    if (!tw) return -1;
    if (tw.st === 'wait') return tw.wait + tw.dashLeft + 8;
    if (tw.st === 'dash') return tw.dashLeft + 8;
    if (tw.st === 'strike') {
      var sg = tw.res.segs[tw.si];
      if (sg.id === 'startup') return sg.f - tw.sf;
      if (sg.id === 'active' && !tw.hitDone) return 0;
    }
    return -1;
  };
  // is the twin about to hit f (for the hold-back auto guard and the AI)?
  F.twinThreat = function (tw, f, frames, dist) {
    var l = F.twinLeft(tw);
    if (l < 0 || l > (frames || 14)) return false;
    var tx = tw.x + (tw.st === 'dash' ? tw.dashV * tw.dashLeft : 0);
    return Math.abs(tx - f.x) < (dist || 96);
  };

  // ------------------------------------------------------------------ per tick
  function startStrike(m, tw) {
    var f = tw.owner, o = m.opp(f), mv = f.C.moves.twinStrike;
    tw.st = 'strike'; tw.res = mv.res.M; tw.si = 0; tw.sf = 0; tw.mf = 0; tw.hitDone = false; tw.vx = 0;
    tw.facing = F.sign(o.x - tw.x) || tw.facing;   // claws toward the opponent
  }

  function stepTwin(m, f, tw) {
    var o = m.opp(f);
    if (tw.st === 'super') {   // follows her super pose, mirrored; vanishes if the super ends early
      if (!(f.action === 'attack' && f.mv && f.mv.kind === 'super')) { F.twinVanish(m, f, true); return; }
      tw.anim = f.anim; tw.seg = f.pseg; tw.u = f.pu;
      return;
    }
    if (tw.stop > 0) { tw.stop--; return; }
    tw.t++;
    if (tw.st === 'wait') {
      if (tw.wait > 0) tw.wait--;
      else if (tw.dashLeft > 0) { tw.st = 'dash'; tw.sf = 0; }
      else startStrike(m, tw);
      if ((tw.t % 24) === 12 && tw.st === 'wait') tfx('gemini.sparkles', f, tw.x, tw.y - 70, tw.facing, { layer: 'back', power: 0.5 });
    }
    if (tw.st === 'dash') {
      var k = tw.dashN - tw.dashLeft, v = tw.dashV * 2 * (tw.dashN - k - 0.5) / tw.dashN;   // decelerating, total = dash
      tw.vx = v; tw.x = F.clamp(tw.x + v, lo(), hi());
      tw.sf++;
      if (--tw.dashLeft <= 0) startStrike(m, tw);
    }
    if (tw.st === 'strike') {
      var sg = tw.res.segs[tw.si];
      if (tw.mf > 0) {
        tw.sf++;
        if (tw.sf >= sg.f) {
          if (tw.si >= tw.res.segs.length - 1) { F.twinVanish(m, f, true, tw.hitDone ? 'done' : 'whiff'); return; }
          tw.si++; tw.sf = 0; sg = tw.res.segs[tw.si];
          if (sg.id === 'active') F.sfx('gemini.twinStrike', { pan: F.pan(tw.x, m.camX) });
        }
      }
      tw.mf++;
      var lg = f.C.moves.twinStrike.lunge || 0;   // the pounce: forward travel during start-up
      if (sg.id === 'startup' && lg) { tw.vx = lg * tw.facing; tw.x = F.clamp(tw.x + tw.vx, lo(), hi()); } else tw.vx = 0;
      if (sg.id === 'active' && !tw.hitDone) twinHit(m, f, tw, o);
    }
  }

  function twinHitBox(f, tw) {
    var h = f.C.moves.twinStrike.hits[0];
    return F.worldBox(h.box, tw.x, tw.y, tw.facing);
  }
  F.twinHitBox = function (tw) {
    if (!tw || tw.st !== 'strike' || tw.hitDone) return null;
    var sg = tw.res.segs[tw.si];
    return sg.id === 'active' ? twinHitBox(tw.owner, tw) : null;
  };

  var tmpH = [];
  function twinHit(m, f, tw, vic) {
    if (m.noHits) return;
    var h = f.C.moves.twinStrike.hits[0], hb = twinHitBox(f, tw);
    var bar = F.barrierBox(vic);
    if (bar && F.overlap(hb, bar)) {   // Claude's barrier absorbs it like a projectile
      tw.hitDone = true;
      F.fx('claude.guardCatch', vic.x, vic.y, { facing: vic.facing, palette: vic.pal, power: 0.6 });
      F.sfx('counter.catch', { pan: F.pan(tw.x, m.camX), vol: 0.7 });
      vic.addMeter(5);
      if (m.onContact) m.onContact(f, vic, 'absorb', 0, null, 'special');
      F.twinVanish(m, f, true, 'absorb');
      return;
    }
    if (vic.strikeInvuln() || !F.juggleOK(vic, h)) return;
    var hurts = F.hurtBoxes(vic, tmpH), touch = null;
    for (var j = 0; j < hurts.length; j++) if (F.overlap(hb, hurts[j])) { touch = hurts[j]; break; }
    if (!touch) return;
    var ox0 = Math.max(hb.x, touch.x), ox1 = Math.min(hb.x + hb.w, touch.x + touch.w);
    var oy0 = Math.max(hb.y, touch.y), oy1 = Math.min(hb.y + hb.h, touch.y + touch.h);
    var hx = (ox0 + ox1) / 2, hy = F.clamp((oy0 + oy1) / 2, vic.y - 100, vic.y - 8);
    tw.hitDone = true;
    F.applyHit(m, f, vic, h, { proj: tw, twin: true, x: hx, y: hy, srcX: tw.x, dir: F.sign(vic.x - tw.x) || tw.facing });
  }

  function poseTwin(m, f, tw) {
    if (tw.st === 'super') return;
    if (tw.st === 'wait') { tw.anim = 'idle'; tw.seg = 'loop'; tw.u = (tw.t + 11) / F.segLen(f.ch, 'idle', 'loop'); }
    else if (tw.st === 'dash') { tw.anim = 'dashF'; tw.seg = 'go'; tw.u = Math.min(0.99, tw.sf / Math.max(1, tw.dashN)); }
    else if (tw.st === 'strike') { var sg = tw.res.segs[tw.si]; tw.anim = 'twinStrike'; tw.seg = sg.id; tw.u = Math.min(0.999, tw.sf / Math.max(1, sg.f)); }
  }

  // called by match.simulate after the fighters' strikes (twin hits are the later contact of a tick)
  F.updateTwins = function (m) {
    for (var i = 0; i < 2; i++) {
      var f = m.f[i], tw = f.twin;
      if (!tw) continue;
      stepTwin(m, f, tw);
      if (f.twin === tw) poseTwin(m, f, tw);
    }
  };
  // every simulate call (also during the super-flash freeze): fx-time for the fade-in after twinSpawn
  F.twinFxTick = function (m) {
    for (var i = 0; i < 2; i++) {
      var f = m.f[i], tw = f.twin;
      if (!tw) continue;
      tw.ft++;
      if (tw.st === 'super') { tw.anim = f.anim; tw.seg = f.pseg; tw.u = f.pu; }
    }
  };
  F.tickTwinPuppets = function (m) {
    if (F.headless) return;
    for (var i = 0; i < 2; i++) {
      var f = m.f[i], tw = f.twin, p = f.twinPuppet;
      if (!tw || !p || !p.tick || tw.stop > 0 || tw.st === 'dash') continue;   // (dash: a reset follows at the new spot)
      try { p.setPoseSeg(tw.anim, tw.seg, tw.u); p.tick({ x: tw.x, y: tw.y, vx: tw.vx, vy: 0, facing: tw.facing, grounded: true }); }
      catch (e) { F.err('rig.tick twin', e); }
    }
  };

  // ------------------------------------------------------------------ blink (闪现)
  // segment hook (fighter.enterSeg): startup = blinkOut fx (+ at the twin for an H swap), gone =
  // reposition, appear = face the opponent + blinkIn fx
  F.blinkSeg = function (m, f, id) {
    var B = f.mv.blink, s = f.str, o = m.opp(f), toward = F.sign(o.x - f.x) || f.facing;
    if (id === 'startup') {
      f.blinkSwap = s === 'H' && !!f.twin && f.twin.st !== 'super';
      f.blinkAir = false;
      tfx('gemini.blinkOut', f, f.x, f.y, f.facing);
      if (f.blinkSwap) tfx('gemini.blinkOut', f, f.twin.x, f.twin.y, f.twin.facing);
    } else if (id === 'gone') {
      var dest = f.x;
      if (s === 'L') dest = f.x - toward * B.back;
      else if (s === 'M') {
        dest = f.x + toward * B.fwd;
        var past = (dest - o.x) * toward;   // > 0: she ends behind the opponent
        if (Math.abs(o.x - f.x) < B.fwd + B.pass && past < B.pass) dest = o.x + toward * B.pass;
      } else if (f.blinkSwap && f.twin) {
        dest = f.twin.x; f.twin.x = f.x;
        f.twin.facing = F.sign(o.x - f.twin.x) || f.twin.facing;
      } else {   // H without a twin: up-forward into the air
        dest = f.x + toward * B.airX;
        f.blinkAir = true;
        f.air = true; f.y = GY - B.airY; f.vy = 0; f.vx = 0;
        f.airUsed = false; f.airSpecial = false; f.djUsed = false; f.jumpEt = f.inp.ett;
      }
      dest = F.clamp(dest, lo(), hi());
      dest = F.clamp(dest, o.x - T.MAXSEP + 8, o.x + T.MAXSEP - 8);
      f.x = dest; f.px = dest; f.pushN = 0;
    } else if (id === 'appear') {
      f.facing = F.sign(o.x - f.x) || f.facing;
      tfx('gemini.blinkIn', f, f.x, f.y, f.facing);
      if (f.blinkSwap && f.twin) tfx('gemini.blinkIn', f, f.twin.x, f.twin.y, f.twin.facing);
      F.sfx('gemini.blink', { pan: F.pan(f.x, m.camX), vol: 0.6 });
    }
  };
  // the twin is not drawn while an H swap moves it (blinkOut startup .. blinkIn appear f2)
  F.twinHidden = function (f) {
    var tw = f.twin;
    if (!tw) return true;
    if (tw.ft < 12) return true;   // twinSpawn sparkles converge first (fx: draw the puppet from t 12)
    if (f.blinkSwap && f.action === 'attack' && f.mv && f.mv.blink) {
      var sg = f.seg();
      if (sg && (sg.id === 'vanish' || sg.id === 'gone' || (sg.id === 'appear' && f.sf < 3))) return true;
    }
    return false;
  };

  // ------------------------------------------------------------------ super (双子座·流星雨)
  // at the flash: the twin takes the far side of the screen (any twin already out is moved there)
  F.superTwin = function (m, f) {
    var M = f.mv.meteor, x = m.camX + (f.facing > 0 ? LC.W - M.twinEdge : M.twinEdge);
    x = F.clamp(x, lo(), hi());
    if (f.twin) F.twinVanish(m, f, true);
    var tw = newTwin(m, f, 'super', x);
    tw.st = 'super'; tw.facing = -f.facing; tw.anim = f.anim; tw.seg = f.pseg; tw.u = f.pu;
    f.twin = tw;
    tfx('gemini.twinSpawn', f, x, GY, tw.facing);
  };
  // cast f0: a comboed victim is held until the first meteor wave (t 21)
  F.meteorLatch = function (m, f, o) {
    var comboed = !o.ko && (o.action === 'hitstun' || o.action === 'caught' || (o.action === 'launch' && o.juggle < 99));
    if (comboed) { o.setActionRaw('caught'); o.caughtT = f.mv.meteor.pinT || 24; o.vx = 0; o.vy = 0; o.pushN = 0; o.pullTo = null; }
  };
  var meteorInfo;
  F.meteorInfo = function () {
    if (meteorInfo === undefined) {
      meteorInfo = null;
      if (F.mod('fx', 'spriteInfo')) {
        try { var mi = LC.fx.spriteInfo('gemini.meteor'); if (mi && mi.frames && mi.frames.length) meteorInfo = mi; } catch (e) { F.err('fx.spriteInfo gemini.meteor', e); }
      }
    }
    return meteorInfo;
  };
  F.resetGeminiInfo = function () { meteorInfo = undefined; };
  // world hit box of the meteor shower this frame (screen-space fx box + camX); the whole floor lane
  // on hit ticks without a box (t 50, the X beams)
  F.meteorBox = function (f) {
    var t = F.superT(f);
    if (t < 0) return null;
    var mi = F.meteorInfo(), fr = mi ? mi.frames[t] : null;
    if (!fr || !fr.w) fr = (mi && mi.lane) || { x: 0, y: GY - 124, w: LC.W, h: 128 };
    return { x: fr.x + f.m.camX, y: fr.y, w: fr.w, h: fr.h };
  };
})();
