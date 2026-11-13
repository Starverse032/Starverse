/* LATENT CLASH — FIGHT training tools: dummy behaviour (stand/crouch/jump/cpu), dummy guard
 * (none/all/afterFirst/random), HP + gauge refill, hitbox overlay (hurt/hit/push/throw/barrier/
 * projectile boxes), input history, damage / combo / frame-advantage readout. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var M = F.Match.prototype, U = LC.UI;

  function rect(ctx, x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }

  M.dummyInput = function () {
    var tr = this.training, d = this.f[1];
    if (!tr) return {};
    if (tr.dummy === 'crouch') return { down: true };
    if (tr.dummy === 'jump') return { up: !d.air && d.action !== 'jumpSquat' && (this.tick % 50) < 3 };
    return {};
  };

  M.autoGuard = function (vic, h) {
    var tr = this.training;
    if (!tr || vic.side !== 1 || tr.dummy === 'cpu') return null;
    var g = tr.guard;
    if (g === 'all') return true;
    if (g === 'afterFirst') return this.tick - (this.tdata.hurtTick || -999) < 90;
    if (g === 'random') return this.rng.next() < 0.5;
    return null;
  };

  function busy(f) {
    var a = f.action;
    return a === 'hitstun' || a === 'launch' || a === 'down' || a === 'getup' || a === 'thrown' || a === 'caught' || a === 'blockstun';
  }
  function free(f) {
    var a = f.action;
    return a === 'idle' || a === 'walkF' || a === 'walkB' || a === 'crouch' || a === 'guard' || a === 'jump' || a === 'land' || a === 'dashF' || a === 'dashB' || a === 'jumpSquat';
  }

  M.trainingTick = function () {
    var tr = this.training, td = this.tdata, A = this.f[0], B = this.f[1];
    for (var i = 0; i < 2; i++) {
      var f = this.f[i];
      if (f.hp <= 0) f.hp = 1;
      if (tr.meter === 'full') f.meter = 100;
      if (busy(f) && i === 1) td.hurtTick = this.tick;
    }
    if (busy(A) || busy(B)) td.calm = 0; else td.calm = (td.calm || 0) + 1;
    if (tr.refill && td.calm === 50) { A.hp = A.maxHp; B.hp = B.maxHp; }
    var p = td.pend;
    if (p) {
      if (p.att.action === 'attack' && p.inst != null && p.att.moveInst !== p.inst) { td.pend = null; }
      else {
        if (p.inst == null) p.inst = p.att.moveInst;
        if (p.ta < 0 && free(p.att)) p.ta = this.tick;
        if (p.tv < 0 && free(p.vic)) p.tv = this.tick;
        if (p.ta >= 0 && p.tv >= 0) { var adv = p.tv - p.ta; td.adv = p.att.side === 0 ? adv : -adv; td.pend = null; }
        else if (this.tick - (p.t0 || (p.t0 = this.tick)) > 240) td.pend = null;
      }
    }
  };

  // ------------------------------------------------------------------ hitbox overlay (world space)
  var tmp = [], tmpH = [];
  function box(ctx, m, r, fill, line) {
    var x = Math.round(r.x - m.camX), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
    ctx.globalAlpha = 0.28; rect(ctx, x, y, w, h, fill); ctx.globalAlpha = 1;
    rect(ctx, x, y, w, 1, line); rect(ctx, x, y + h - 1, w, 1, line); rect(ctx, x, y, 1, h, line); rect(ctx, x + w - 1, y, 1, h, line);
  }
  F.drawBoxes = function (ctx, m) {
    for (var i = 0; i < 2; i++) {
      var f = m.f[i];
      var inv = f.strikeInvuln();
      F.hurtBoxes(f, tmpH).forEach(function (r) { box(ctx, m, r, inv ? '#ffffff' : '#3fa9ff', inv ? '#dddddd' : '#3fa9ff'); });
      var pb = F.pushBox(f);
      if (pb) { var x = Math.round(pb.x - m.camX); rect(ctx, x, Math.round(pb.y + pb.h) - 1, Math.round(pb.w), 1, '#ffe14d'); rect(ctx, x, Math.round(pb.y), 1, Math.round(pb.h), '#ffe14d'); rect(ctx, x + Math.round(pb.w) - 1, Math.round(pb.y), 1, Math.round(pb.h), '#ffe14d'); }
      // all hit boxes active this frame (including already-used groups, for readability)
      if (f.action === 'attack' && f.mv && f.mv.hits) {
        var sg = f.seg();
        f.mv.hits.forEach(function (h) {
          if (h.seg !== sg.id || (h.fr && (f.sf < h.fr[0] || f.sf > h.fr[1]))) return;
          box(ctx, m, F.worldBox(F.hitLocal(f, h), f.x, f.y, f.facing), '#ff3b3b', '#ff3b3b');
        });
        if (f.mv.kind === 'throw') {
          var tr = f.C.throwRange, tx = Math.round(f.x - m.camX), y = Math.round(f.y) - 30;
          rect(ctx, f.facing > 0 ? tx : tx - tr, y, tr, 1, '#ff4dff');
        }
      }
      var bar = F.barrierBox(f);
      if (bar) box(ctx, m, bar, '#5ee6a8', '#5ee6a8');
      var ox = Math.round(f.x - m.camX);
      rect(ctx, ox - 2, Math.round(f.y), 5, 1, '#ffffff'); rect(ctx, ox, Math.round(f.y) - 2, 1, 5, '#ffffff');
    }
    m.projs.forEach(function (p) { box(ctx, m, F.worldBox(p.spec.box, p.x, p.y, F.sign(p.vx) || 1), '#ff3b3b', '#ff8a3b'); });
  };

  // ------------------------------------------------------------------ input history + data
  var MIRROR = { 1: 3, 3: 1, 4: 6, 6: 4, 7: 9, 9: 7, 2: 2, 5: 5, 8: 8 };
  var ARROW = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '·', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
  function inputs(ctx, m) {
    var f = m.f[0], lg = f.inp.log, y = 64;
    rect(ctx, 2, y - 2, 52, 12 * 11 + 2, 'rgba(11,10,20,0.55)');
    for (var i = lg.length - 1, row = 0; i >= 0 && row < 11; i--, row++) {
      var e = lg[i], d = f.facing > 0 ? e.d : MIRROR[e.d];
      var ic = F.icon('dir.' + d), x = 4, yy = y + row * 12;
      if (ic) ctx.drawImage(ic, x, yy - 1); else F.text(ctx, ARROW[d], x + 1, yy, { size: 8, color: U.text });
      x += 13;
      ['L', 'M', 'H', 'S'].forEach(function (b, k) {
        if (!(e.h & (1 << k))) return;
        var bi = F.icon('btn.' + b);
        if (bi) ctx.drawImage(bi, x, yy - 1); else F.text(ctx, b, x + 2, yy, { size: 8, color: (e.b & (1 << k)) ? U.gold : U.dim });
        x += 9;
      });
      F.text(ctx, String(Math.min(e.n, 99)), 52, yy, { size: 8, align: 'right', color: U.dim });
    }
  }
  function data(ctx, m) {
    var td = m.tdata, x = LC.W - 92, y = 64;
    rect(ctx, x, y - 2, 90, 54, 'rgba(11,10,20,0.6)');
    var advTxt = td.adv == null ? '--' : (td.adv > 0 ? '+' + td.adv : String(td.adv));
    var rows = [['伤害', String(td.last || 0)], ['连段伤害', String(td.combo || 0)], ['连段数', String(td.comboHits || 0)], ['帧数差', advTxt]];
    rows.forEach(function (r, i) {
      F.text(ctx, r[0], x + 4, y + i * 13, { size: 10, color: U.dim });
      F.text(ctx, r[1], x + 86, y + i * 13, { size: 10, align: 'right', color: i === 3 ? (td.adv > 0 ? U.green : td.adv < 0 ? U.red : U.text) : U.text });
    });
  }
  F.drawTraining = function (ctx, m) {
    var tr = m.training;
    if (!tr) return;
    if (tr.inputs) inputs(ctx, m);
    if (tr.data) data(ctx, m);
  };
})();
