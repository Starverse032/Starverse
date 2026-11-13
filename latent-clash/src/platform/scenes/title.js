/* LATENT CLASH — title screen + attract mode trigger (PLATFORM). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var U = LC.UI, W = LC.W, H = LC.H, ui = LC.ui;
  var IDLE_DEMO = 20 * 60;

  // Built-in title art when LC.illust.drawTitle is missing: split sky in both characters'
  // colours, a clash of light in the middle, falling sparks/bubbles.
  var sparks = null;
  function fallbackTitle(c, t) {
    ui.backdrop(c, t, { accent: '#ff9e6b', speed: 0.6, horizon: 150 });
    var cx = W >> 1;
    // diagonal colour wedges
    for (var y = 0; y < H; y += 2) {
      var off = Math.round((y - H / 2) * 0.35);
      c.fillStyle = 'rgba(217,119,87,0.10)'; c.fillRect(0, y, cx - 10 + off, 2);
      c.fillStyle = 'rgba(77,107,254,0.12)'; c.fillRect(cx + 10 + off, y, W, 2);
    }
    // clash core
    var pulse = 2 + Math.round((Math.sin(t * 0.15) + 1) * 1.5);
    for (var k = 0; k < 7; k++) {
      var len = 18 + ((t * 3 + k * 37) % 50);
      ui.box(c, cx - 1, 120 - len, 2, len * 2, k & 1 ? 'rgba(255,240,180,0.25)' : 'rgba(255,255,255,0.12)');
    }
    ui.disc(c, cx, 120, 6 + pulse, 'rgba(255,209,102,0.35)');
    ui.disc(c, cx, 120, 3 + (pulse >> 1), '#fff7e0');
    if (!sparks) { sparks = []; for (var i = 0; i < 40; i++) sparks.push({ x: Math.random() * W, s: 0.3 + Math.random(), ph: Math.random() * 300, side: i & 1 }); }
    sparks.forEach(function (s) {
      var yy = (s.ph + t * s.s) % (H + 20) - 10;
      var xx = s.x + Math.sin((t + s.ph) * 0.03) * 6;
      c.fillStyle = s.side ? (s.s > 0.9 ? '#a9c0ff' : '#4d6bfe') : (s.s > 0.9 ? '#ffd9a0' : '#d97757');
      if (s.side) { if (xx > cx) c.fillRect(xx | 0, (H - yy) | 0, 2, 2); }
      else if (xx < cx) c.fillRect(xx | 0, yy | 0, 1, s.s > 0.9 ? 3 : 2);
    });
  }

  var illustTitleOk = null;
  function illustTitleUsable() {
    if (illustTitleOk !== null) return illustTitleOk;
    illustTitleOk = false;
    if (!(LC.illust && LC.illust.drawTitle)) return false;
    try {
      var cv = ui.canvas(W, H), c = cv.getContext('2d');
      LC.illust.drawTitle(c, 60);
      var d = c.getImageData(0, 0, W, H).data, first = d[0] + ',' + d[1] + ',' + d[2];
      for (var i = 0; i < d.length; i += 4 * 97) if (d[i] + ',' + d[i + 1] + ',' + d[i + 2] !== first) { illustTitleOk = true; break; }
    } catch (e) { console.error('[platform] illust.drawTitle', e); }
    return illustTitleOk;
  }

  LC.scenes.define('title', function (params) {
    var idle = 0, out = false;
    return {
      music: 'title',
      enter: function () { LC.input.setMode('solo'); if (params.fromDemo) this.t = 90; },
      update: function () {
        idle++;
        if (out) return;
        if (LC.input.anyPressed() && this.t > 20) {
          out = true;
          ui.sfx('ui.start');
          this.flash = 16;
          LC.scenes.go('menu', {}, { transition: 'wipe' });
          return;
        }
        if (idle > IDLE_DEMO) {
          out = true;
          var ch = Math.random() < 0.5 ? 'claude' : 'deepseek';
          var other = Math.random() < 0.75 ? LC.app.other(ch) : ch;
          var ids = LC.app.stageIds().filter(function (s) { return s !== 'training'; });
          LC.scenes.go('match', { config: LC.app.matchConfig({ mode: 'demo', p1: { char: ch, control: 'cpu', level: 4 }, p2: { char: other, control: 'cpu', level: 4, palette: other === ch ? 1 : 0 }, stage: ids[(Math.random() * ids.length) | 0] || 'latent' }) }, { transition: 'dissolve', frames: 24 });
        }
      },
      draw: function (c) {
        var t = this.t;
        var drew = false;
        if (illustTitleUsable()) {
          try { LC.illust.drawTitle(c, t); drew = true; } catch (e) { console.error('[platform] illust.drawTitle', e); }
        }
        if (!drew) fallbackTitle(c, t);
        // logo: drops in with an overshoot, then floats
        var logo = ui.logo();
        if (logo) {
          var a = ui.ease.back(t / 40);
          var ly = Math.round(-logo.height + (14 + logo.height) * a + (t > 40 ? Math.sin(t * 0.04) * 1.5 : 0));
          c.drawImage(logo, ((W - logo.width) >> 1), ly);
          if (t > 34 && t < 44) { c.globalAlpha = (44 - t) / 12; ui.box(c, 0, 0, W, H, '#fff7e8'); c.globalAlpha = 1; }
        }
        // prompt
        if (t > 50) {
          var on = this.flash ? (this.flash-- & 2) : ui.blink(t, 64, 0.68);
          if (on) {
            LC.font.draw(c, 'PRESS START', W >> 1, 150, { size: 8, scale: 2, color: U.gold, outline: U.black, align: 'center', spacing: 1 });
            LC.font.draw(c, '按任意键开始', W >> 1, 168, { size: 12, color: U.text, outline: U.black, align: 'center' });
          }
        }
        // footer: disclaimer + version
        ui.box(c, 0, H - 15, W, 15, 'rgba(5,4,10,0.72)');
        var disc = LC.LORE.disclaimer;
        var dl = LC.font.wrap(disc, W - 8, { size: 10 });
        if (dl.length > 1) { ui.box(c, 0, H - 27, W, 12, 'rgba(5,4,10,0.72)'); }
        LC.font.draw(c, dl.join('\n'), W >> 1, H - 13 - (dl.length - 1) * 12, { size: 10, color: U.dim, align: 'center' });
        LC.font.draw(c, 'v' + LC.VERSION, 4, 4, { size: 8, color: '#4f4a78', outline: U.black });
        var best = LC.save.get('bestScore', 0);
        if (best) LC.font.draw(c, 'HI-SCORE ' + String(best).padStart(7, '0'), W - 4, 4, { size: 8, color: U.dim, align: 'right', outline: U.black });
      }
    };
  });
})();
