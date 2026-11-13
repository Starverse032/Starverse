/* LATENT CLASH — FIGHT HUD: health bars (lagging damage trail, low-HP colour), face icons, names,
 * round pips with finish marks, timer, super gauges (full pulse), combo counter + damage with a
 * pop, COUNTER call-outs, special move-name tags. Mirrored for P2, fillRect + LC.font only. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var U = LC.UI;

  var BAR_W = 140, BAR_H = 8, BAR_Y = 9, BAR_X0 = 30;     // P1 bar x range [30, 170]
  var MET_W = 92, MET_Y = 203;
  var FIN = { super: '超', special: '技', 'throw': '投', time: 'T', chip: '削', perfect: 'P', draw: '=', normal: null, ko: null };

  function rect(ctx, x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }

  F.hudInit = function () {};

  function hudState(m) {
    if (!m.hud) m.hud = { lag: [m.f[0].hp, m.f[1].hp], lagWait: [0, 0], pop: [0, 0], lastCombo: [0, 0], lastHp: [m.f[0].hp, m.f[1].hp] };
    return m.hud;
  }

  function bar(ctx, m, side) {
    var f = m.f[side], H = hudState(m);
    var r = F.clamp(f.hp / f.maxHp, 0, 1);
    // lag trail: waits while the victim is in a combo, then drains
    if (f.hp > H.lastHp[side]) H.lag[side] = f.hp;
    H.lastHp[side] = f.hp;
    var inCombo = f.action === 'hitstun' || f.action === 'launch' || f.action === 'thrown' || f.action === 'caught';
    if (H.lag[side] > f.hp) {
      if (inCombo) H.lagWait[side] = 24;
      else if (H.lagWait[side] > 0) H.lagWait[side]--;
      else H.lag[side] = Math.max(f.hp, H.lag[side] - 6);
    } else H.lag[side] = f.hp;
    var lr = F.clamp(H.lag[side] / f.maxHp, 0, 1);
    var x0 = side === 0 ? BAR_X0 : LC.W - BAR_X0 - BAR_W;
    var P = F.palOf(f);
    rect(ctx, x0 - 2, BAR_Y - 2, BAR_W + 4, BAR_H + 4, U.black);
    rect(ctx, x0 - 1, BAR_Y - 1, BAR_W + 2, BAR_H + 2, U.line);
    rect(ctx, x0, BAR_Y, BAR_W, BAR_H, '#2a1420');
    var wl = Math.round(BAR_W * lr), wh = Math.round(BAR_W * r);
    var low = r < 0.25, blink = low && (m.tick >> 3) & 1;
    var col = low ? (blink ? '#ff7a5c' : U.hpLow) : U.hp;
    var hi = low ? '#ffb199' : '#fff1a8', sh = low ? '#b8322a' : '#e0a21c';
    if (side === 0) {
      rect(ctx, x0, BAR_Y, wl, BAR_H, H.lagWait[side] > 0 ? U.hpLag : '#ff5a4d');
      rect(ctx, x0, BAR_Y, wh, BAR_H, col);
      rect(ctx, x0, BAR_Y, wh, 2, hi); rect(ctx, x0, BAR_Y + BAR_H - 2, wh, 2, sh);
    } else {
      rect(ctx, x0 + BAR_W - wl, BAR_Y, wl, BAR_H, H.lagWait[side] > 0 ? U.hpLag : '#ff5a4d');
      rect(ctx, x0 + BAR_W - wh, BAR_Y, wh, BAR_H, col);
      rect(ctx, x0 + BAR_W - wh, BAR_Y, wh, 2, hi); rect(ctx, x0 + BAR_W - wh, BAR_Y + BAR_H - 2, wh, 2, sh);
    }
    // tick marks every 10%
    for (var i = 1; i < 10; i++) rect(ctx, x0 + Math.round(BAR_W * i / 10), BAR_Y + BAR_H - 2, 1, 2, 'rgba(5,4,10,0.35)');
    // inner accent cap in the character colour
    rect(ctx, side === 0 ? x0 + BAR_W + 2 : x0 - 4, BAR_Y - 2, 2, BAR_H + 4, P.ui);

    // face icon
    var face = F.portrait(f.ch, 'face', f.pal);
    var fx = side === 0 ? 3 : LC.W - 27;
    rect(ctx, fx - 1, 3, 26, 26, U.black); rect(ctx, fx, 4, 24, 24, U.bg2);
    if (face) {
      if (side === 0) ctx.drawImage(face, fx, 4);
      else { ctx.save(); ctx.translate(fx + 24, 4); ctx.scale(-1, 1); ctx.drawImage(face, 0, 0); ctx.restore(); }
    } else { rect(ctx, fx + 4, 6, 16, 9, P.hair[1]); rect(ctx, fx + 5, 14, 14, 10, P.skin[1]); }
    if (f.flash > 0.5) { ctx.globalAlpha = 0.5; rect(ctx, fx, 4, 24, 24, '#ffffff'); ctx.globalAlpha = 1; }
    rect(ctx, fx, 27, 24, 1, P.ui);

    // name
    var nm = LC.LORE && LC.LORE.chars[f.ch] ? LC.LORE.chars[f.ch].name : f.ch.toUpperCase();
    F.text(ctx, nm, side === 0 ? x0 : x0 + BAR_W, BAR_Y + BAR_H + 3, { size: 8, align: side === 0 ? 'left' : 'right', color: U.text, outline: U.black });
    if (f.control === 'cpu' || m.ai[side]) {
      var tagx = side === 0 ? x0 + F.measure(nm, { size: 8 }).w + 4 : x0 + BAR_W - F.measure(nm, { size: 8 }).w - 4;
      F.text(ctx, 'CPU' + (m.ai[side] ? m.ai[side].level : ''), tagx, BAR_Y + BAR_H + 3, { size: 8, align: side === 0 ? 'left' : 'right', color: U.dim, outline: U.black });
    }

    // round pips (inner side, under the bar)
    var need = m.cfg.rounds;
    for (var k = 0; k < need; k++) {
      var won = k < m.roundsWon[side];
      var px = side === 0 ? x0 + BAR_W - 9 - k * 11 : x0 + 1 + k * 11;
      var py = BAR_Y + BAR_H + 3;
      var icon = F.icon(won ? 'pip.on' : 'pip.off');
      if (icon) ctx.drawImage(icon, px + ((8 - icon.width) >> 1), py + ((8 - icon.height) >> 1));
      else {
        rect(ctx, px, py, 8, 8, U.black);
        rect(ctx, px + 1, py + 1, 6, 6, won ? U.gold : U.bg2);
        if (won) rect(ctx, px + 2, py + 2, 2, 2, '#fff7d0');
      }
      var fin = won ? FIN[m.finishes[side][k]] : null;
      if (fin) F.text(ctx, fin, px + 4, py + 9, { size: 8, align: 'center', color: U.gold, outline: U.black });
    }

    // special move-name tag
    if (f.tag && f.tagT > 0) {
      var a = f.tagT > 80 ? (90 - f.tagT) / 10 : f.tagT < 12 ? f.tagT / 12 : 1;
      ctx.globalAlpha = F.clamp(a, 0, 1);
      var tw = F.measure(f.tag, { size: 10 }).w + 10, tx = side === 0 ? x0 : x0 + BAR_W - tw, ty = 40;
      rect(ctx, tx, ty, tw, 13, 'rgba(11,10,20,0.75)'); rect(ctx, side === 0 ? tx : tx + tw - 2, ty, 2, 13, P.ui);
      F.text(ctx, f.tag, tx + 5 + (side === 0 ? 1 : -1), ty + 1, { size: 10, color: P.uiLight });
      ctx.globalAlpha = 1;
    }
  }

  function timer(ctx, m) {
    var x = (LC.W >> 1) - 15, y = 4;
    rect(ctx, x, y, 30, 22, U.black); rect(ctx, x + 1, y + 1, 28, 20, U.bg1); rect(ctx, x + 1, y + 20, 28, 1, U.line);
    var txt = m.timerMax > 0 ? String(Math.ceil(m.timer / 60)) : '∞';
    if (txt.length < 2 && m.timerMax > 0) txt = '0' + txt;
    var low = m.timerMax > 0 && m.timer < 600 && m.state === 'fight';
    if (m.timerMax <= 0) txt = '--';
    F.text(ctx, txt, LC.W >> 1, y + 3, { size: 12, align: 'center', color: low && (m.tick >> 4) & 1 ? U.red : U.text, outline: null });
    if (m.timerMax > 0 && m.state === 'fight' && m.timer % 60 === 0 && m.timer <= 600 && m.timer > 0 && m.lastTickSfx !== m.timer) {
      m.lastTickSfx = m.timer; F.sfx('timer.tick', { vol: 0.5 });
    }
  }

  function meter(ctx, m, side) {
    var f = m.f[side], P = F.palOf(f);
    var x0 = side === 0 ? 8 : LC.W - 8 - MET_W, y = MET_Y;
    var full = f.meter >= 100;
    rect(ctx, x0 - 2, y - 2, MET_W + 4, 9, U.black);
    rect(ctx, x0 - 1, y - 1, MET_W + 2, 7, U.line);
    rect(ctx, x0, y, MET_W, 5, U.bg1);
    var w = Math.round(MET_W * f.meter / 100);
    var pulse = full && ((m.tick >> 2) & 3);
    var col = full ? (pulse === 0 ? '#ffffff' : pulse === 2 ? U.gold : U.meterFull) : U.meter;
    if (side === 0) { rect(ctx, x0, y, w, 5, col); rect(ctx, x0, y, w, 1, '#d8f6ff'); }
    else { rect(ctx, x0 + MET_W - w, y, w, 5, col); rect(ctx, x0 + MET_W - w, y, w, 1, '#d8f6ff'); }
    for (var i = 1; i < 4; i++) rect(ctx, x0 + Math.round(MET_W * i / 4), y + 3, 1, 2, U.bg0);
    var label = full ? 'SUPER  MAX' : 'SUPER';
    F.text(ctx, label, side === 0 ? x0 : x0 + MET_W, y - 11, { size: 8, align: side === 0 ? 'left' : 'right', color: full ? U.meterFull : U.dim, outline: U.black });
    F.text(ctx, String(Math.floor(f.meter)), side === 0 ? x0 + MET_W + 4 : x0 - 4, y - 2, { size: 8, align: side === 0 ? 'left' : 'right', color: full ? U.meterFull : U.text, outline: U.black });
    if (full && (m.tick % 40) < 20) rect(ctx, side === 0 ? x0 + w - 2 : x0 + MET_W - w, y - 1, 2, 7, '#ffffff');
  }

  function combo(ctx, m, side) {
    var f = m.f[side], H = hudState(m);
    var n = f.comboShow;
    if (n !== H.lastCombo[side]) { if (n > H.lastCombo[side]) H.pop[side] = 6; H.lastCombo[side] = n; }
    if (H.pop[side] > 0) H.pop[side]--;
    if (n < 2) return;
    var fade = f.combo === 0 ? Math.max(0, 1 - f.comboT / 70) : 1;
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    var x = side === 0 ? 8 : LC.W - 8, al = side === 0 ? 'left' : 'right', y = 56 - (H.pop[side] > 3 ? 2 : 0);
    var P = F.palOf(f);
    F.text(ctx, String(n), x, y, { size: 12, scale: 2, align: al, color: U.gold, outline: U.black });
    var nw = F.measure(String(n), { size: 12, scale: 2 }).w;
    F.text(ctx, 'HITS', side === 0 ? x + nw + 3 : x - nw - 3, y + 11, { size: 8, align: al, color: U.text, outline: U.black });
    F.text(ctx, String(f.comboShowDmg) + ' DMG', x, y + 26, { size: 8, align: al, color: P.uiLight, outline: U.black });
    ctx.globalAlpha = 1;
  }

  function callouts(ctx, m) {
    for (var i = 0; i < m.callouts.length; i++) {
      var c = m.callouts[i];
      var x = c.side === 0 ? 8 : LC.W - 8, al = c.side === 0 ? 'left' : 'right';
      var y = 96 + (c.t < 4 ? 4 - c.t : 0);
      ctx.globalAlpha = c.t > 45 ? (60 - c.t) / 15 : 1;
      var ic = c.text === 'COUNTER' ? F.banner('counter') : null;
      if (ic && ic.height <= 40) ctx.drawImage(ic, c.side === 0 ? 4 : LC.W - 4 - ic.width, y - 6);
      else F.text(ctx, c.text, x, y, { size: 10, align: al, color: c.color, outline: U.black });
      ctx.globalAlpha = 1;
    }
  }

  F.drawHud = function (ctx, m) {
    if (m.state === 'intro' && m.st < 30) return;
    var a = m.state === 'intro' ? Math.min(1, (m.st - 30) / 20) : 1;
    ctx.globalAlpha = a;
    bar(ctx, m, 0); bar(ctx, m, 1);
    timer(ctx, m);
    meter(ctx, m, 0); meter(ctx, m, 1);
    ctx.globalAlpha = 1;
    combo(ctx, m, 0); combo(ctx, m, 1);
    callouts(ctx, m);
  };
})();
