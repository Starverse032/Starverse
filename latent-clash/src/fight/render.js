/* LATENT CLASH — FIGHT render: puppets (rig or a built-in fallback), frame composition per
 * contract §6, engine-owned sprites (projectiles, barrier, beam, book, whale, pools), shadows,
 * after-images, hit flash / hit-stop jitter, super-flash cut-in, speech bubbles, banners. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var T = F.T, GY = T.GY;

  // ------------------------------------------------------------------ puppets
  function FallbackPuppet(ch, pal) { this.ch = ch; this.pal = pal; this.fallback = true; this.anim = 'idle'; this.seg = 'loop'; this.u = 0; }
  FallbackPuppet.prototype.setPoseSeg = function (a, s, u) { this.anim = a; this.seg = s; this.u = u; };
  FallbackPuppet.prototype.setPose = function (a) { this.anim = a; };
  FallbackPuppet.prototype.tick = function () {};
  FallbackPuppet.prototype.reset = function () {};
  FallbackPuppet.prototype.getAnchor = function () { return null; };
  FallbackPuppet.prototype.getBounds = function () { return { x: -15, y: -104, w: 30, h: 104 }; };
  FallbackPuppet.prototype.draw = function (ctx, sx, sy, o) {
    var P = palFor(this.ch, this.pal);
    var low = /crouch|down|getup|2[LMH]/.test(this.anim) || this.seg === 'lie';
    var C = F.chars[this.ch], h = this.seg === 'lie' ? 20 : low ? 68 : ((C && C.height) || 100);
    var col = o && o.silhouette ? o.silhouette : P.cloth1[1];
    ctx.globalAlpha = o && o.alpha != null ? o.alpha : 1;
    ctx.fillStyle = P.outline; ctx.fillRect(sx - 14, sy - h - 1, 28, h + 1);
    ctx.fillStyle = col; ctx.fillRect(sx - 13, sy - h, 26, h);
    if (!(o && o.silhouette)) { ctx.fillStyle = P.hair[1]; ctx.fillRect(sx - 13, sy - h, 26, 16); ctx.fillStyle = P.accent[1]; ctx.fillRect(sx + (o && o.facing < 0 ? -20 : 12), sy - h + 30, 8, 5); }
    ctx.globalAlpha = 1;
  };

  F.attachPuppet = function (f) {
    f.puppet = null; f.puppetFallback = true;
    if (F.mod('rig', 'createPuppet')) {
      try { f.puppet = LC.rig.createPuppet(f.ch, { palette: f.pal }); f.puppetFallback = !f.puppet; }
      catch (e) { F.err('rig.createPuppet ' + f.ch, e); f.puppet = null; }
    }
    if (!f.puppet) { f.puppet = new FallbackPuppet(f.ch, f.pal); f.puppetFallback = true; }
  };

  // ------------------------------------------------------------------ helpers
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
  F.rect = rect;
  // palette for a character id (falls back to the first roster palette that exists)
  function palFor(ch, pal) {
    var set = LC.PAL[ch];
    if (!set) for (var i = 0; !set && i < (LC.CHARS || []).length; i++) set = LC.PAL[LC.CHARS[i]];
    if (!set) for (var k in LC.PAL) { if (LC.PAL[k] && LC.PAL[k][0] && LC.PAL[k][0].outline) { set = LC.PAL[k]; break; } }
    return set[pal] || set[0];
  }
  F.palFor = palFor;
  function palOf(f) { return palFor(f.ch, f.pal); }
  F.palOf = palOf;

  function shadow(ctx, m, f) {
    if (f.hidden) return;
    var sx = Math.round(f.x - m.camX), hgt = GY - f.y;
    var w = Math.max(10, Math.round(40 * (1 - Math.min(hgt, 150) / 220)));
    var c = (m.stage && m.stage.shadowColor) || 'rgba(10,6,20,0.35)';
    ctx.fillStyle = c;
    ctx.fillRect(sx - (w >> 1), GY - 1, w, 3);
    ctx.fillRect(sx - (w >> 1) + 2, GY - 2, w - 4, 1);
    ctx.fillRect(sx - (w >> 1) + 2, GY + 2, w - 4, 1);
  }

  function drawPuppet(ctx, m, f) {
    var p = f.puppet;
    if (!p || f.hidden) return;
    if (f.action === 'attack' && f.mv && f.mv.clipFloor) {   // dive: hide what sinks below the ground line
      ctx.save(); ctx.beginPath(); ctx.rect(-16, -64, LC.W + 32, GY + 64); ctx.clip();
      drawPuppet0(ctx, m, f, p); ctx.restore(); return;
    }
    drawPuppet0(ctx, m, f, p);
  }
  function drawPuppet0(ctx, m, f, p) {
    var sx = Math.round(f.x - m.camX), sy = Math.round(f.y);
    if (f.stop > 0 && (f.action === 'hitstun' || f.action === 'launch' || f.action === 'blockstun' || f.action === 'caught')) sx += (m.tick & 2) ? 1 : -1;
    // after-images
    if (f.after.length) {
      var col = palOf(f).accent[1], cur = [f.anim, f.pseg, f.pu];
      for (var i = 0; i < f.after.length; i++) {
        var a = f.after[i];
        try {
          p.setPoseSeg(a.anim, a.seg, a.u);
          p.draw(ctx, Math.round(a.x - m.camX), Math.round(a.y), { facing: a.facing, silhouette: col, alpha: 0.18 + 0.1 * i });
        } catch (e) { F.err('rig.draw afterimage', e); }
      }
      try { p.setPoseSeg(cur[0], cur[1], cur[2]); } catch (e) { F.err('rig.setPoseSeg', e); }
    }
    try {
      p.draw(ctx, sx, sy, { facing: f.facing, flash: f.flash > 0 ? Math.min(0.85, f.flash) : 0, flashColor: f.flashColor, alpha: 1, silhouette: null });
    } catch (e) { F.err('rig.draw ' + f.ch, e); }
  }

  function wpt(f, name, m) {   // anchor -> screen point
    var a = f.anchor(name);
    return { x: Math.round(f.x + a.x * f.facing - m.camX), y: Math.round(f.y + a.y) };
  }
  // super timeline: frames since cast f0 (fx V2 timelines start there), -1 outside the super
  F.superT = function (f) {
    if (f.action !== 'attack' || !f.mv || f.mv.kind !== 'super' || !f.res) return -1;
    var segs = f.res.segs;
    for (var i = 0; i < segs.length; i++) if (segs[i].id === 'cast') return f.mf >= segs[i].start ? f.mf - segs[i].start : -1;
    return -1;
  };
  // whale sprite time for a fighter in the super (-1 when not out); tidal wave time after the crash
  F.whaleT = function (f) { return f.mv && f.mv.whale ? F.superT(f) : -1; };
  F.tidalT = function (f) { var t = F.whaleT(f); return t >= 0 && t >= F.whaleCrash() ? t - F.whaleCrash() : -1; };

  function engineSprites(ctx, m, f, layer) {
    var mv = f.mv, sg = f.seg(), sx = Math.round(f.x - m.camX), sy = Math.round(f.y), o = { facing: f.facing, palette: f.pal };
    if (f.action !== 'attack' || !mv) return;
    var st = mv.kind === 'super' ? F.superT(f) : -1;
    if (layer === 'back') {
      if (mv.id === 'dive') {
        var pw = { facing: f.facing, palette: f.pal, power: 1 };
        if (sg.id === 'startup' || sg.id === 'sink') { pw.power = Math.min(1, f.mf / 10); F.sprite(ctx, 'deepseek.pool', sx, GY, f.mf, pw); }
        if (sg.id === 'travel') {
          if (f.sf < 8) { pw.power = 1 - f.sf / 8; F.sprite(ctx, 'deepseek.pool', Math.round(f.diveFrom - m.camX), GY, f.mf, pw); }
          if (f.diveDest != null && f.sf >= sg.f - 10) { pw.power = Math.min(1, (f.sf - sg.f + 11) / 6); F.sprite(ctx, 'deepseek.pool', Math.round(f.diveDest - m.camX), GY, f.sf, pw); }
        }
        if (sg.id === 'emerge') { pw.power = 1 - f.sf / 6; F.sprite(ctx, 'deepseek.pool', sx, GY, f.sf + 20, pw); }
      }
      // [C] the whale is behind the fighters
      if (mv.whale && st >= 0 && st < 60) F.sprite(ctx, 'deepseek.whale', sx + f.facing * mv.whale.x, GY, st, o);
      // [C] GPT super: necks + heads behind the fighters (target point latched at cast f0)
      if (mv.attn && st >= 0 && st < 70 && f.attnX != null) F.sprite(ctx, 'gpt.attention', 0, 0, st, attnOpts(m, f, 'back'));
      return;
    }
    // [D] GPT super: lines, beams, orb, burst, scales after the fighters
    if (mv.attn && st >= 0 && st < 70 && f.attnX != null) {
      if (!F.sprite(ctx, 'gpt.attention', 0, 0, st, attnOpts(m, f, 'front')) && st >= 24 && st < 50) {
        var ob = F.attnBox(f), P0 = palOf(f);
        if (ob) { rect(ctx, ob.x - m.camX, ob.y, ob.w, ob.h, P0.accent[1]); rect(ctx, ob.x - m.camX + 4, ob.y + 4, ob.w - 8, ob.h - 8, P0.accent[0]); }
      }
    }
    // [D] GPT breath: flame cone at the mouth (start → loop on active frames, 10f 'end' after)
    if (mv.flame) {
      var ph = null, ft = 0, mx = 0, my = 0;
      if (sg.id === 'active') {
        var mz = F.flameMouth(f);
        mx = sx + mz.x * f.facing; my = sy + mz.y; ft = f.sf; ph = f.sf < 6 ? 'start' : 'loop';
        f.flameAt = { x: f.x + mz.x * f.facing, y: f.y + mz.y };   // render-only: where the 'end' flies on
      } else if (sg.id === 'recovery' && f.sf < 10 && f.flameAt) { mx = Math.round(f.flameAt.x - m.camX); my = Math.round(f.flameAt.y); ft = f.sf; ph = 'end'; }
      if (ph) {
        var fo = { length: F.v(mv.flame.length, f.str), angle: mv.flame.angle, phase: ph, facing: f.facing, palette: f.pal };
        if (!F.sprite(ctx, 'gpt.breath', mx, my, ft, fo) && ph !== 'end') {
          var fl = F.flameLocal(f), P1 = palOf(f), fb = F.worldBox(fl, f.x, f.y, f.facing);
          rect(ctx, fb.x - m.camX, fb.y + 4, fb.w, Math.max(2, fb.h - 8), P1.accent[1]);
          rect(ctx, fb.x - m.camX, fb.y + 10, fb.w, Math.max(2, fb.h - 20), P1.accent[0]);
        }
      }
    }
    if (mv.catchSeg) {
      if (sg.id === 'hold' || sg.id === 'startup') F.sprite(ctx, 'claude.guardrail', sx, sy, f.mf, { facing: f.facing, palette: f.pal });
      else if (sg.id === 'recovery' && f.sf < 6) F.sprite(ctx, 'claude.guardrail', sx, sy, f.sf, { facing: f.facing, palette: f.pal, phase: 'end' });
    }
    // [D] claude.beam -> claude.book (both at the muzzle = book centre)
    if (mv.beam && st >= 0 && (sg.id !== 'recovery' || f.sf < 12)) {
      var bm = mv.beam, mz = f.anchor('muzzle');
      var bx = sx + f.facing * F.clamp(mz.x + (bm.fwd || 0), 8, bm.x0 + 8), by = sy + F.clamp(mz.y, bm.y + 20, bm.y + bm.h - 20);
      var ph = sg.id === 'cast' ? 'charge' : sg.id === 'active' ? 'fire' : 'fade';
      var len = sg.id === 'active' ? Math.min(bm.max, bm.grow * (f.sf + 1)) : (sg.id === 'cast' ? 0 : bm.max);
      var pow = sg.id === 'cast' ? (f.sf + 1) / sg.f : sg.id === 'active' ? 1 : 1 - f.sf / 12;
      if (!F.sprite(ctx, 'claude.beam', bx, by, st, { facing: f.facing, palette: f.pal, length: len, phase: ph, power: pow }) && len > 0) {
        var bx2 = f.facing > 0 ? sx + bm.x0 : sx - bm.x0 - len;
        rect(ctx, bx2, sy + bm.y + 6, len, bm.h - 12, palOf(f).accent[1]);
        rect(ctx, bx2, sy + bm.y + 14, len, bm.h - 28, palOf(f).accent[0]);
      }
      F.sprite(ctx, 'claude.book', bx, by, st, o);
    }
    // [D] the tidal wave from the whale's crash point
    if (mv.whale) {
      var tt = F.tidalT(f);
      if (tt >= 0 && tt < 48) F.sprite(ctx, 'deepseek.tidal', sx + f.facing * (mv.whale.x + F.whaleCrashX()), GY, tt, o);
    }
  }

  function attnOpts(m, f, part) {
    return { tx: Math.round(f.attnX - m.camX), ty: Math.round(f.attnY), facing: f.facing, palette: f.pal, part: part };
  }

  function drawProjs(ctx, m) {
    for (var i = 0; i < m.projs.length; i++) {
      var p = m.projs[i], sx = Math.round(p.x - m.camX), sy = Math.round(p.y);
      if (!F.sprite(ctx, p.sprite, sx, sy, p.t, { facing: F.sign(p.vx) || p.facing, palette: p.owner.pal, power: p.power != null ? p.power : 1, angle: p.vy ? Math.atan2(p.vy, Math.abs(p.vx)) : 0 })) {
        var P = palOf(p.owner), b = p.box || p.spec.box;
        rect(ctx, sx + b[0], sy + b[1], b[2], b[3], P.accent[2]);
        rect(ctx, sx + b[0] + 2, sy + b[1] + 2, b[2] - 4, b[3] - 4, P.accent[0]);
      }
    }
  }

  function fxDraw(ctx, m, layer) {
    if (!F.mod('fx', 'draw')) return;
    try { LC.fx.draw(ctx, Math.round(m.camX), layer); } catch (e) { F.err('fx.draw ' + layer, e); }
  }

  function drawFallbackStage(ctx, camX) {
    rect(ctx, -8, -8, LC.W + 16, LC.H + 16, '#1b1834');
    for (var i = 0; i < 12; i++) {
      var x = ((i * 64 - camX * 0.5) % 768 + 768) % 768 - 64;
      rect(ctx, x, 60, 2, 126, '#2a2650');
    }
    rect(ctx, -8, GY, LC.W + 16, LC.H - GY + 8, '#2c2846');
    for (var k = 0; k < 11; k++) { var gx = ((k * 64 - camX) % 704 + 704) % 704 - 32; rect(ctx, gx, GY, 1, 30, '#3b3670'); }
    rect(ctx, -8, GY, LC.W + 16, 1, '#4b4590');
  }

  // ------------------------------------------------------------------ bubbles / banners / cut-in
  function bubble(ctx, m, side) {
    var b = m.bubbles[side];
    if (!b) return;
    var f = m.f[side];
    var n = Math.min(b.text.length, Math.floor(b.t / 2));
    var lines = F.wrap(b.text, 132, { size: 10 });
    var full = 0, i;
    for (i = 0; i < lines.length; i++) full = Math.max(full, F.measure(lines[i], { size: 10 }).w);
    var lh = 12, w = Math.max(28, full + 12), h = lines.length * lh + 8;
    var top = f.anchor ? f.anchor('top') : { y: -80 };
    var cx = Math.round(f.x - m.camX), by = Math.max(34, Math.round(f.y + top.y - h - 10));
    var bx = F.clamp(cx - (w >> 1), 4, LC.W - 4 - w);
    var P = palOf(f);
    rect(ctx, bx - 1, by - 1, w + 2, h + 2, P.outline);
    rect(ctx, bx, by, w, h, LC.UI.text);
    rect(ctx, bx, by + h - 2, w, 2, '#d9d2c4');
    rect(ctx, bx, by, 3, h, P.ui);
    var tx = F.clamp(cx, bx + 6, bx + w - 8);
    rect(ctx, tx - 3, by + h, 7, 1, LC.UI.text); rect(ctx, tx - 2, by + h + 1, 5, 1, LC.UI.text); rect(ctx, tx - 1, by + h + 2, 3, 2, LC.UI.text);
    rect(ctx, tx - 4, by + h, 1, 1, P.outline); rect(ctx, tx + 4, by + h, 1, 1, P.outline);
    var shown = 0;
    for (i = 0; i < lines.length; i++) {
      var ln = lines[i], take = Math.max(0, Math.min(ln.length, n - shown));
      shown += ln.length;
      if (take > 0) F.text(ctx, ln.slice(0, take), bx + 7, by + 4 + i * lh, { size: 10, color: LC.UI.bg1 });
    }
  }

  function drawBanners(ctx, m) {
    for (var i = 0; i < m.banners.length; i++) {
      var b = m.banners[i], t = b.t;
      var c = F.banner(b.name), y = 64;
      var off = t < 6 ? (6 - t) * 5 : 0;
      var alpha = b.dur < 900 && t > b.dur - 8 ? Math.max(0, (b.dur - t) / 8) : 1;
      ctx.globalAlpha = alpha;
      if (c) ctx.drawImage(c, ((LC.W - c.width) >> 1), Math.round(y - (c.height >> 1) - off));
      else F.text(ctx, b.text, LC.W >> 1, y - 12 - off, { size: 12, scale: 2, align: 'center', color: LC.UI.gold, outline: LC.UI.black });
      ctx.globalAlpha = 1;
      if (t < 3) { ctx.globalAlpha = 0.35; rect(ctx, 0, y - 22, LC.W, 44, '#ffffff'); ctx.globalAlpha = 1; }
    }
  }

  function cutin(ctx, m) {
    var fl = m.flash;
    if (!fl) return;
    var f = fl.who, t = fl.t, D = fl.dur, P = palOf(f);
    var inK = Math.min(1, t / 7), outK = t > D - 8 ? (D - t) / 8 : 1;
    var hgt = Math.round(72 * Math.min(inK, outK));
    if (hgt <= 0) return;
    var cy = 92, y0 = cy - (hgt >> 1);
    rect(ctx, 0, y0 - 2, LC.W, hgt + 4, P.outline);
    rect(ctx, 0, y0, LC.W, hgt, P.ui);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, LC.W, hgt); ctx.clip();
    for (var k = 0; k < 18; k++) {   // speed streaks
      var sy = y0 + ((k * 37 + t * 5) % 72), len = 30 + (k * 53) % 90;
      var sx = ((k * 97 + t * (f.side ? -14 : 14)) % (LC.W + 120) + LC.W + 120) % (LC.W + 120) - 120;
      rect(ctx, sx, sy, len, 1, P.uiLight);
    }
    var por = F.portrait(f.ch, 'cutin', f.pal);
    var slide = Math.round((1 - inK) * 200);
    var px = f.side === 0 ? LC.W - 240 + slide : -slide;
    if (por) {
      if (f.side === 0) ctx.drawImage(por, px, cy - 36);
      else { ctx.save(); ctx.translate(px + por.width, cy - 36); ctx.scale(-1, 1); ctx.drawImage(por, 0, 0); ctx.restore(); }
    }
    ctx.restore();
    rect(ctx, 0, y0, LC.W, 1, P.uiLight); rect(ctx, 0, y0 + hgt - 1, LC.W, 1, P.uiDark);
    var mv = LC.LORE && LC.LORE.moves[f.ch] && LC.LORE.moves[f.ch]['super'];
    if (mv && hgt > 40) {
      var tx = f.side === 0 ? 10 : LC.W - 10, al = f.side === 0 ? 'left' : 'right';
      var tin = Math.max(0, 10 - t) * 6 * (f.side === 0 ? -1 : 1);
      F.text(ctx, mv.zh, tx + tin, cy - 14, { size: 12, scale: 2, align: al, color: '#ffffff', outline: P.outline });
      F.text(ctx, mv.en, tx + tin, cy + 16, { size: 8, align: al, color: P.uiLight, outline: P.outline });
    }
  }

  // ------------------------------------------------------------------ frame
  F.Match.prototype.draw = function (ctx) {
    try { this._draw(ctx); } catch (e) { F.err('draw', e); }
  };

  // [A] full-screen backdrop replacing the stage (fx V2): KO burst / super finish while the KO'd body
  // falls, else the super's own backdrop (with 8f intro / outro over the stage). null = the stage.
  function backdrop(m) {
    var K = m.koInfo;
    if (K && m.state === 'ko' && m.koFlash <= 24 - 5) {
      // full until KO_BG_HOLD ticks after the KO (freeze + the dramatic start of the slow-mo) or the body
      // landing, then a stepped fade over the stage (KO_BG_FADE ticks); the stage is back well before the win pose.
      var kt = m.tick - K.tick, landed = true;
      for (var i = 0; i < 2; i++) { var d = m.f[i]; if (d.ko && !(d.action === 'down' && d.af >= 6)) landed = false; }
      if (m._koBg !== K) { m._koBg = K; m._koBgOut = 0; }   // render-only bookkeeping (not match state)
      if (!m._koBgOut && (landed || kt >= T.KO_BG_HOLD)) m._koBgOut = Math.min(kt, T.KO_BG_HOLD) || 1;
      var ft = m._koBgOut ? kt - m._koBgOut : -1;
      if (ft < T.KO_BG_FADE) {
        var o = { cx: Math.round(K.x - m.camX), cy: Math.round(K.y) };
        var W = K.winner >= 0 ? m.f[K.winner] : null;
        if (W) { o['char'] = W.ch; o.palette = W.pal; }
        var bd = { name: K.kind === 'super' && W ? 'screen.superFinish' : 'screen.koBackdrop', t: kt - 5, o: o, under: false };
        if (ft >= 0) { bd.under = true; bd.front = true; bd.alpha = 1 - (Math.floor(ft * 4 / T.KO_BG_FADE) + 1) / 5; }   // .8 .6 .4 .2
        return bd;
      }
      return null;   // KO backdrop done: the stage, not a still-running super's backdrop
    }
    for (var j = 0; j < 2; j++) {
      var f = m.f[j], st = F.superT(f);
      if (st < 0) continue;
      var sg = f.seg(), out = f.mv.bgOut != null ? f.mv.bgOut : 12;
      var so = { 'char': f.ch, palette: f.pal, facing: f.facing };
      if (sg.id === 'recovery' && f.sf >= out) {
        if (f.sf - out >= 8) return null;
        so.phase = 'out';
        return { name: 'screen.superBackdrop', t: f.sf - out, o: so, under: true };
      }
      m.supLast = { tick: m.tick, ch: f.ch, pal: f.pal, facing: f.facing };
      return { name: 'screen.superBackdrop', t: st, o: so, under: st < 8 };
    }
    var L = m.supLast;   // a super that ended early (interrupted / round over): play the outro anyway
    if (L && m.tick > L.tick && m.tick - L.tick <= 8) return { name: 'screen.superBackdrop', t: m.tick - L.tick - 1, o: { 'char': L.ch, palette: L.pal, facing: L.facing, phase: 'out' }, under: true };
    return null;
  }

  function drawStage(ctx, m, camX) {
    var ok = false;
    if (m.stage && m.stage.drawBack) { try { m.stage.drawBack(ctx, camX); ok = true; } catch (e) { F.err('stage.drawBack', e); } }
    if (!ok) drawFallbackStage(ctx, camX);
  }

  F.Match.prototype._draw = function (ctx) {
    var m = this, camX = Math.round(m.camX), A = m.f[0], B = m.f[1];
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (m.shakeT > 0 && F.settings().shake !== false) {
      var a = m.shakeA * Math.min(1, m.shakeT / 6);
      ctx.translate(Math.round(((m.tick * 7) % 3 - 1) * a), Math.round(((m.tick * 5) % 3 - 1) * a * 0.6));
    }
    // [A] stage or a full-screen backdrop
    var bg = backdrop(m);
    if (!bg || bg.under) drawStage(ctx, m, camX);
    var a0 = ctx.globalAlpha;
    if (bg && bg.alpha != null) ctx.globalAlpha = a0 * bg.alpha;
    if (bg && !F.sprite(ctx, bg.name, 0, 0, bg.t, bg.o) && !bg.under) { drawStage(ctx, m, camX); bg = null; }
    ctx.globalAlpha = a0;
    // [B] super flash backdrop / heavy-hit impact
    if (m.flash) {
      var fl = m.flash;
      var cp = wpt(fl.who, 'chest', m);
      if (!F.sprite(ctx, 'screen.superBg', 0, 0, fl.t, { palette: fl.who.pal, 'char': fl.who.ch, cx: cp.x, cy: cp.y, color: palOf(fl.who).ui, facing: fl.who.facing })) {
        ctx.globalAlpha = 0.6; rect(ctx, -8, -8, LC.W + 16, LC.H + 16, '#05040a'); ctx.globalAlpha = 1;
      }
    }
    var im = m.impact;
    if (im && im.t < T.IMPACT) {
      var io = { cx: Math.round(im.x - camX), cy: Math.round(im.y) };
      if (im.counter) io.phase = 'counter'; else if (im.special) { io['char'] = im.ch; io.palette = im.pal; }
      F.sprite(ctx, 'screen.impact', 0, 0, im.t, io);
    }
    // [C] engine back sprites (whale, pools)
    engineSprites(ctx, m, A, 'back'); engineSprites(ctx, m, B, 'back');
    fxDraw(ctx, m, 'back');
    shadow(ctx, m, A); shadow(ctx, m, B);
    var top = m.f[m.topSide], under = m.f[1 - m.topSide];
    drawPuppet(ctx, m, under); drawPuppet(ctx, m, top);
    // [D] engine front sprites
    engineSprites(ctx, m, under, 'front'); engineSprites(ctx, m, top, 'front');
    drawProjs(ctx, m);
    fxDraw(ctx, m, 'front');
    if ((!bg || bg.front) && m.stage && m.stage.drawFront) { try { m.stage.drawFront(ctx, camX); } catch (e) { F.err('stage.drawFront', e); } }
    if ((m.forceBoxes || (m.training && m.training.hitboxes)) && F.drawBoxes) F.drawBoxes(ctx, m);
    ctx.restore();
    // [E] KO white-out -> bubbles -> HUD -> training panels -> cut-in -> banners
    if (m.koFlash > 0) {
      if (!F.sprite(ctx, 'screen.koFlash', 0, 0, 24 - m.koFlash, {})) {
        ctx.globalAlpha = (F.settings().flash === false ? 0.15 : 0.5) * m.koFlash / 24; rect(ctx, 0, 0, LC.W, LC.H, '#ffffff'); ctx.globalAlpha = 1;
      }
    }
    bubble(ctx, m, 0); bubble(ctx, m, 1);
    if (F.drawHud) F.drawHud(ctx, m);
    if (m.training && F.drawTraining) F.drawTraining(ctx, m);
    cutin(ctx, m);
    drawBanners(ctx, m);
    if (m.fade > 0) { ctx.globalAlpha = Math.min(1, m.fade); rect(ctx, 0, 0, LC.W, LC.H, '#05040a'); ctx.globalAlpha = 1; }
  };
})();
