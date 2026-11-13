/* LATENT CLASH — VS screen (PLATFORM): busts slide in over split colour fields with speed lines,
 * names / titles, an impact 'vs' banner, stage + round info, sting. params: { config } */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H, ui = LC.ui, LORE = LC.LORE;
  var DUR = 180;

  LC.scenes.define('vs', function (params) {
    var cfg = params.config || LC.app.matchConfig({});
    var P = [cfg.p1, cfg.p2];
    var lines = [];
    for (var i = 0; i < 46; i++) lines.push({ y: (Math.random() * H) | 0, len: 10 + (Math.random() * 50) | 0, sp: 3 + Math.random() * 6, ph: Math.random() * W, side: i & 1 });
    var leaving = false;
    function next() {
      if (leaving) return;
      leaving = true;
      LC.scenes.go('match', { config: cfg }, { transition: 'iris', frames: 16 });
    }
    return {
      music: 'vs',
      enter: function () { LC.input.setMode(P[0].control === 'human' && P[1].control === 'human' ? 'duo' : 'solo'); },
      update: function () {
        var t = this.t;
        if (t === 34) ui.sfx('ui.lock', { pitch: 0.8 });
        if (t === 12 && LC.audio && LC.audio.voice) { try { LC.audio.voice(P[0].char, 'intro'); } catch (e) { /* ignore */ } }
        if (t >= DUR) next();
        if (t > 40 && (LC.input.menu.ok || LC.input.menu.start || LC.input.pointer.pressed)) { ui.sfx('ui.confirm'); next(); }
      },
      draw: function (c) {
        var t = this.t;
        var C0 = ui.charCol(P[0].char, P[0].palette), C1 = ui.charCol(P[1].char, P[1].palette);
        // split fields with a slanted seam
        for (var y = 0; y < H; y += 2) {
          var seam = (W >> 1) + Math.round((y - H / 2) * -0.32);
          ui.box(c, 0, y, seam, 2, ui.mix(C0.dark, '#05040a', 0.35));
          ui.box(c, seam, y, W - seam, 2, ui.mix(C1.dark, '#05040a', 0.35));
          ui.box(c, seam - 1, y, 2, 2, '#fff7e8');
        }
        // speed lines
        lines.forEach(function (l) {
          var x = l.side ? W - ((l.ph + t * l.sp) % (W + 60)) : ((l.ph + t * l.sp) % (W + 60)) - 60;
          ui.box(c, x | 0, l.y, l.len, 1, l.side ? ui.mix(C1.ui, '#05040a', 0.3) : ui.mix(C0.ui, '#05040a', 0.3));
        });
        // busts
        P.forEach(function (p, k) {
          var b = ui.portrait(p.char, 'bust', p.palette);
          if (!b) return;
          if (k === 1) b = ui.flip(b);
          var e = ui.ease.back((t - 4 - k * 6) / 22);
          var x = k ? Math.round(W + 10 - (W + 10 - (W - 136)) * e) : Math.round(-122 + (122 + 24) * e);
          var drift = Math.round((t / 20) * (k ? -1 : 1));
          c.drawImage(b, x + drift, 30);
          if (t < 40 && e > 0.9 && t > 26) { c.globalAlpha = 0.5; c.drawImage(ui.silhouette(b, '#ffffff'), x + drift, 30); c.globalAlpha = 1; }
        });
        // name plates
        P.forEach(function (p, k) {
          var L = LORE.chars[p.char], col = k ? C1 : C0;
          var a = ui.ease.out((t - 24 - k * 4) / 14);
          if (a <= 0) return;
          var bx = k ? W - 186 + Math.round((1 - a) * 40) : 4 - Math.round((1 - a) * 40);
          ui.box(c, bx, 160, 182, 40, 'rgba(5,4,10,0.82)');
          ui.box(c, bx, 160, 182, 1, col.ui);
          ui.box(c, bx, 199, 182, 1, ui.mix(col.ui, '#000000', 0.5));
          var al = k ? 'right' : 'left', tx = k ? bx + 176 : bx + 6;
          LC.font.draw(c, L.name, tx, 164, { size: 8, scale: 2, color: col.light, align: al, outline: U.black, spacing: 1 });
          LC.font.draw(c, L.nameZh + ' · ' + L.title, tx, 184, { size: 10, color: U.text, align: al });
          if (p.control === 'cpu') LC.font.draw(c, 'CPU Lv.' + p.level, k ? bx + 6 : bx + 176, 166, { size: 8, color: U.dim, align: k ? 'left' : 'right' });
        });
        // VS banner with impact
        if (t >= 30) {
          var vb = ui.banner('vs');
          var s = t < 36 ? 2 : 1;
          var bw = vb.width * s, bh = vb.height * s;
          var shake = t < 44 ? ((t & 2) ? 2 : -2) : 0;
          c.drawImage(vb, ((W - bw) >> 1) + shake, 74 - (bh >> 1) + 20);
          if (t < 34) { c.globalAlpha = (34 - t) / 4; ui.box(c, 0, 0, W, H, '#fff7e8'); c.globalAlpha = 1; }
        }
        // top info
        var top = cfg.mode === 'arcade' && LC.app.session && LC.app.session.arcade ? LORE.arcade[LC.app.session.arcade.stage] : null;
        ui.box(c, 0, 0, W, 16, 'rgba(5,4,10,0.75)');
        var sname = LORE.stages[cfg.stage] ? LORE.stages[cfg.stage].zh : cfg.stage;
        LC.font.draw(c, top ? top.title + ' · ' + top.sub : '对战', 6, 2, { size: 12, color: U.gold });
        LC.font.draw(c, 'STAGE  ' + sname, W - 6, 3, { size: 10, color: U.dim, align: 'right' });
        if (t > 40 && ui.blink(t, 40)) LC.font.draw(c, 'L 跳过', W >> 1, H - 12, { size: 10, color: '#4f4a78', align: 'center' });
      }
    };
  });
})();
