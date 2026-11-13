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
  FallbackPuppet.prototype.getBounds = function () { return { x: -14, y: -70, w: 28, h: 70 }; };
  FallbackPuppet.prototype.draw = function (ctx, sx, sy, o) {
    var P = (LC.PAL[this.ch] || LC.PAL.claude)[this.pal] || LC.PAL.claude[0];
    var low = /crouch|down|getup|2[LMH]/.test(this.anim) || this.seg === 'lie';
    var h = this.seg === 'lie' ? 14 : low ? 44 : 66;
    var col = o && o.silhouette ? o.silhouette : P.cloth1[1];
    ctx.globalAlpha = o && o.alpha != null ? o.alpha : 1;
    ctx.fillStyle = P.outline; ctx.fillRect(sx - 11, sy - h - 1, 22, h + 1);
    ctx.fillStyle = col; ctx.fillRect(sx - 10, sy - h, 20, h);
    if (!(o && o.silhouette)) { ctx.fillStyle = P.hair[1]; ctx.fillRect(sx - 10, sy - h, 20, 10); ctx.fillStyle = P.accent[1]; ctx.fillRect(sx + (o && o.facing < 0 ? -14 : 8), sy - h + 18, 6, 4); }
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
  function palOf(f) { return (LC.PAL[f.ch] || LC.PAL.claude)[f.pal] || LC.PAL[f.ch][0]; }
  F.palOf = palOf;

  function shadow(ctx, m, f) {
    if (f.hidden) return;
    var sx = Math.round(f.x - m.camX), hgt = GY - f.y;
    var w = Math.max(8, Math.round(30 * (1 - Math.min(hgt, 110) / 160)));
    var c = (m.stage && m.stage.shadowColor) || 'rgba(10,6,20,0.35)';
    ctx.fillStyle = c;
    ctx.fillRect(sx - (w >> 1), GY - 1, w, 3);
    ctx.fillRect(sx - (w >> 1) + 2, GY - 2, w - 4, 1);
    ctx.fillRect(sx - (w >> 1) + 2, GY + 2, w - 4, 1);
  }

  function drawPuppet(ctx, m, f) {
    var p = f.puppet;
    if (!p || f.hidden) return;
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
      p.draw(ctx, sx, sy, { facing: f.facing, flash: f.flash > 0 ? Math.min(1, f.flash * 1.4) : 0, flashColor: f.flashColor, alpha: 1, silhouette: null });
    } catch (e) { F.err('rig.draw ' + f.ch, e); }
  }

  function engineSprites(ctx, m, f, layer) {
    var mv = f.mv, sg = f.seg(), sx = Math.round(f.x - m.camX), sy = Math.round(f.y), o = { facing: f.facing, palette: f.pal };
    if (f.action !== 'attack' || !mv) return;
    if (layer === 'back') {
      if (mv.id === 'dive') {
        if (sg.id === 'sink' || sg.id === 'startup' || (sg.id === 'travel' && f.sf < 6)) F.sprite(ctx, 'deepseek.pool', Math.round((f.diveFrom != null && sg.id === 'travel' ? f.diveFrom : f.x) - m.camX), GY, f.mf, o);
        if (sg.id === 'travel' && f.diveDest != null && f.sf >= sg.f - 10) F.sprite(ctx, 'deepseek.pool', Math.round(f.diveDest - m.camX), GY, f.sf, o);
        if (sg.id === 'emerge') F.sprite(ctx, 'deepseek.pool', sx, GY, f.sf + 20, o);
      }
      if (mv.kind === 'super' && f.ch === 'claude' && sg.id !== 'recovery') F.sprite(ctx, 'claude.book', sx + f.facing * 16, sy - 58, f.mf, o);
      return;
    }
    if (mv.catchSeg && (sg.id === 'hold' || sg.id === 'startup')) {
      F.sprite(ctx, 'claude.guardrail', sx + f.facing * 20, sy, f.mf, { facing: f.facing, palette: f.pal, alpha: sg.id === 'startup' ? 0.5 : 1 });
    }
    if (mv.beam && (sg.id === 'cast' || sg.id === 'active' || (sg.id === 'recovery' && f.sf < 12))) {
      var bm = mv.beam, len = sg.id === 'active' ? Math.min(bm.max, bm.grow * (f.sf + 1)) : (sg.id === 'cast' ? 12 : bm.max);
      var ph = sg.id === 'cast' ? 'charge' : sg.id === 'active' ? 'fire' : 'fade';
      if (!F.sprite(ctx, 'claude.beam', sx + f.facing * bm.x0, sy + bm.y + (bm.h >> 1), sg.id === 'recovery' ? f.sf : f.mf, { facing: f.facing, palette: f.pal, length: len, phase: ph })) {
        var bx = f.facing > 0 ? sx + bm.x0 : sx - bm.x0 - len;
        rect(ctx, bx, sy + bm.y + 6, len, bm.h - 12, palOf(f).accent[1]);
        rect(ctx, bx, sy + bm.y + 14, len, bm.h - 28, palOf(f).accent[0]);
      }
    }
    if (mv.whale && (sg.id === 'active' || (sg.id === 'recovery' && f.sf < 16))) {
      var t = sg.id === 'active' ? f.sf : sg.f + f.sf;
      F.sprite(ctx, 'deepseek.whale', sx + f.facing * mv.whale.x, GY, t, o);
    }
  }

  function drawProjs(ctx, m) {
    for (var i = 0; i < m.projs.length; i++) {
      var p = m.projs[i], sx = Math.round(p.x - m.camX), sy = Math.round(p.y);
      if (!F.sprite(ctx, p.sprite, sx, sy, p.t, { facing: F.sign(p.vx) || p.facing, palette: p.owner.pal, power: p.str === 'H' ? 1 : p.str === 'L' ? 0.4 : 0.7 })) {
        var P = palOf(p.owner), b = p.spec.box;
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
    var slide = Math.round((1 - inK) * 160);
    var px = f.side === 0 ? 8 - slide : LC.W - 248 + slide;
    if (por) {
      if (f.side === 0) ctx.drawImage(por, px, cy - 36);
      else { ctx.save(); ctx.translate(px + por.width, cy - 36); ctx.scale(-1, 1); ctx.drawImage(por, 0, 0); ctx.restore(); }
    }
    ctx.restore();
    rect(ctx, 0, y0, LC.W, 1, P.uiLight); rect(ctx, 0, y0 + hgt - 1, LC.W, 1, P.uiDark);
    var mv = LC.LORE && LC.LORE.moves[f.ch] && LC.LORE.moves[f.ch]['super'];
    if (mv && hgt > 40) {
      var tx = f.side === 0 ? LC.W - 10 : 10, al = f.side === 0 ? 'right' : 'left';
      F.text(ctx, mv.zh, tx, cy + 4, { size: 12, scale: 2, align: al, color: '#ffffff', outline: P.outline });
      F.text(ctx, mv.en, tx, cy + 34, { size: 8, align: al, color: P.uiLight, outline: P.outline });
    }
  }

  // ------------------------------------------------------------------ frame
  F.Match.prototype.draw = function (ctx) {
    try { this._draw(ctx); } catch (e) { F.err('draw', e); }
  };

  F.Match.prototype._draw = function (ctx) {
    var m = this, camX = Math.round(m.camX), A = m.f[0], B = m.f[1];
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (m.shakeT > 0 && F.settings().shake !== false) {
      var a = m.shakeA * Math.min(1, m.shakeT / 6);
      ctx.translate(Math.round(((m.tick * 7) % 3 - 1) * a), Math.round(((m.tick * 5) % 3 - 1) * a * 0.6));
    }
    var stageOk = false;
    if (m.stage && m.stage.drawBack) { try { m.stage.drawBack(ctx, camX); stageOk = true; } catch (e) { F.err('stage.drawBack', e); } }
    if (!stageOk) drawFallbackStage(ctx, camX);
    if (m.flash) {
      var fl = m.flash;
      if (!F.sprite(ctx, 'screen.superBg', 0, 0, fl.t, { palette: fl.who.pal, color: palOf(fl.who).ui, facing: fl.who.facing })) {
        ctx.globalAlpha = 0.6; rect(ctx, -8, -8, LC.W + 16, LC.H + 16, '#05040a'); ctx.globalAlpha = 1;
      }
    }
    fxDraw(ctx, m, 'back');
    engineSprites(ctx, m, A, 'back'); engineSprites(ctx, m, B, 'back');
    shadow(ctx, m, A); shadow(ctx, m, B);
    var top = m.f[m.topSide], under = m.f[1 - m.topSide];
    drawPuppet(ctx, m, under); drawPuppet(ctx, m, top);
    engineSprites(ctx, m, under, 'front'); engineSprites(ctx, m, top, 'front');
    drawProjs(ctx, m);
    fxDraw(ctx, m, 'front');
    if (m.stage && m.stage.drawFront) { try { m.stage.drawFront(ctx, camX); } catch (e) { F.err('stage.drawFront', e); } }
    if ((m.forceBoxes || (m.training && m.training.hitboxes)) && F.drawBoxes) F.drawBoxes(ctx, m);
    ctx.restore();
    if (m.koFlash > 0) {
      if (!F.sprite(ctx, 'screen.koFlash', 0, 0, 24 - m.koFlash, {})) {
        ctx.globalAlpha = (F.settings().flash === false ? 0.15 : 0.5) * m.koFlash / 24; rect(ctx, 0, 0, LC.W, LC.H, '#ffffff'); ctx.globalAlpha = 1;
      }
    }
    bubble(ctx, m, 0); bubble(ctx, m, 1);
    if (F.drawHud) F.drawHud(ctx, m);
    cutin(ctx, m);
    drawBanners(ctx, m);
    if (m.training && F.drawTraining) F.drawTraining(ctx, m);
    if (m.fade > 0) { ctx.globalAlpha = Math.min(1, m.fade); rect(ctx, 0, 0, LC.W, LC.H, '#05040a'); ctx.globalAlpha = 1; }
  };
})();
