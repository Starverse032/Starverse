/* LATENT CLASH — FIGHT dev stubs (NOT in src/fight/manifest.js, never shipped).
 * Minimal stand-ins for rig / fx / audio / stages / font / illust that install only when the real
 * module is missing (or when forced: window.FIGHT_FORCE_STUBS = 'all' | 'rig,fx,...').
 * The stick-figure rig implements the full §5.3 puppet API with anchors consistent with FIGHT's
 * hitbox data, so gameplay can be developed before the real rig exists. */
window.fightStubs = function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var force = String(window.FIGHT_FORCE_STUBS || '');
  function forced(n) { return force === 'all' || force.split(',').indexOf(n) >= 0; }
  function need(n, fn) { return forced(n) || !(LC[n] && typeof LC[n][fn] === 'function'); }
  var installed = window.FIGHT_STUBS = window.FIGHT_STUBS || [];
  var GY = LC.GROUND_Y;

  // ------------------------------------------------------------------ rig
  if (need('rig', 'createPuppet')) {
    installed.push('rig');
    var SEGS = {
      idle: [['loop', 64, 1]], walkF: [['loop', 40, 1]], walkB: [['loop', 44, 1]],
      crouchIn: [['go', 4]], crouch: [['loop', 64, 1]], crouchOut: [['go', 4]], jumpSquat: [['go', 4]],
      jumpRise: [['loop', 12, 1]], jumpFall: [['loop', 12, 1]], land: [['go', 6]],
      dashF: [['go', 18]], dashB: [['go', 20]], guardStand: [['loop', 30, 1]], guardCrouch: [['loop', 30, 1]],
      hitHigh: [['reel', 18]], hitLow: [['reel', 18]], hitCrouch: [['reel', 18]], launch: [['loop', 24, 1]],
      down: [['impact', 10], ['lie', 30, 1]], getup: [['rise', 24]], thrown: [['loop', 20, 1]],
      'throw': [['startup', 5], ['active', 2], ['recovery', 22]], throwHit: [['hold', 16], ['toss', 14], ['recovery', 18]],
      intro: [['act', 100]], win: [['in', 30], ['loop', 60, 1]], lose: [['in', 30], ['loop', 60, 1]],
      'super': [['startup', 6], ['cast', 10], ['active', 40], ['recovery', 30]],
      spark: [['startup', 13], ['active', 3], ['recovery', 28]], airSpark: [['startup', 10], ['active', 3], ['recovery', 12, 1]],
      sonnet: [['startup', 5], ['rise', 14], ['fall', 12, 1], ['land', 12]],
      haiku: [['startup', 9], ['hit1', 3], ['gap1', 6], ['hit2', 3], ['gap2', 6], ['hit3', 4], ['recovery', 20]],
      guardrail: [['startup', 3], ['hold', 18], ['recovery', 22]], guardrailHit: [['startup', 4], ['active', 4], ['recovery', 22]],
      wave: [['startup', 15], ['active', 3], ['recovery', 26]], breach: [['startup', 5], ['rise', 12], ['fall', 12, 1], ['land', 14]],
      chain1: [['startup', 9], ['active', 4], ['recovery', 18]], chain2: [['startup', 7], ['active', 4], ['recovery', 20]],
      chain3: [['startup', 9], ['active', 5], ['recovery', 26]], diveIn: [['startup', 6], ['sink', 6]],
      diveOut: [['startup', 6], ['active', 5], ['recovery', 22]], diveKick: [['startup', 8], ['active', 10, 1], ['land', 12]]
    };
    ['5L', '5M', '5H', '2L', '2M', '2H'].forEach(function (n) { SEGS[n] = [['startup', 8], ['active', 4], ['recovery', 14]]; });
    ['jL', 'jM', 'jH'].forEach(function (n) { SEGS[n] = [['startup', 7], ['active', 6], ['recovery', 12, 1]]; });
    var CH = { claude: { h: 70, ch: 46 }, deepseek: { h: 66, ch: 42 } };
    var R = LC.rig = {};
    R.init = function () { return Promise.resolve(); };
    R.listAnims = function () { return Object.keys(SEGS); };
    R.hasAnim = function (c, a) { return !!SEGS[a]; };
    R.animInfo = function (c, a) {
      var s = SEGS[a] || SEGS.idle, t = 0;
      return { segs: s.map(function (x) { t += x[1]; return { id: x[0], f: x[1], loop: !!x[2] }; }), total: t, loop: !!s[s.length - 1][2] };
    };
    R.charInfo = function (c) { return { height: CH[c].h, crouchHeight: CH[c].ch, width: 26, palettes: 2 }; };

    function Puppet(c, opts) { this.c = c; this.pal = (opts && opts.palette) | 0; this.a = 'idle'; this.s = 'loop'; this.u = 0; this.H = CH[c].h; }
    Puppet.prototype.setPose = function (a, f) { this.a = a; this.s = (SEGS[a] || SEGS.idle)[0][0]; this.u = f / 20; };
    Puppet.prototype.setPoseSeg = function (a, s, u) { this.a = a; this.s = s; this.u = u; };
    Puppet.prototype.tick = function () {};
    Puppet.prototype.reset = function () {};
    Puppet.prototype.hitBox = function () {   // the FIGHT data box for the current pose, if attacking
      var F = LC.fight, C = F && F.chars[this.c];
      if (!C) return null;
      var a = this.a, mv = C.moves[a];
      if (!mv) for (var k in C.moves) if (C.moves[k].anim === a) { mv = C.moves[k]; break; }
      if (!mv || !mv.hits) return null;
      for (var i = 0; i < mv.hits.length; i++) if (mv.hits[i].seg === this.s && mv.hits[i].box) return mv.hits[i].box;
      return null;
    };
    Puppet.prototype.lowPose = function () {
      var a = this.a;
      return a === 'crouch' || a === 'crouchIn' || a === 'guardCrouch' || a === 'hitCrouch' || a[0] === '2' || a === 'jumpSquat' || a === 'land' || a === 'getup' && this.u < 0.5;
    };
    Puppet.prototype.getAnchor = function (n) {
      var H = this.H, low = this.lowPose(), lie = this.a === 'down';
      var top = lie ? -10 : low ? -(H * 0.66) : -H;
      var b = this.hitBox();
      switch (n) {
        case 'head': return { x: lie ? -20 : 2, y: top + 8 };
        case 'top': return { x: 0, y: top - 10 };
        case 'chest': return { x: lie ? -8 : 2, y: lie ? -6 : top + 24 };
        case 'hip': return { x: 0, y: lie ? -5 : top * 0.42 };
        case 'center': return { x: 0, y: top / 2 };
        case 'handF': return b ? { x: b[0] + b[2] - 6, y: b[1] + b[3] / 2 } : { x: 14, y: top + 28 };
        case 'handB': return { x: -8, y: top + 28 };
        case 'footF': return { x: 7, y: 0 };
        case 'footB': return { x: -7, y: 0 };
        case 'weapon': return b ? { x: b[0] + b[2] - 2, y: b[1] + b[3] / 2 } : { x: this.c === 'claude' ? 30 : 16, y: top + 22 };
        case 'muzzle': return this.c === 'deepseek' && this.a === 'wave' ? { x: 24, y: 0 } : (this.a === 'airSpark' ? { x: 24, y: -34 } : { x: 32, y: top + 20 });
        case 'grab':
          if (this.a !== 'throwHit') return { x: 24, y: top + 26 };
          if (this.s === 'toss') { var k = Math.min(1, this.u); return { x: 22 - 40 * k, y: top + 24 - Math.sin(k * Math.PI) * 26 }; }
          return { x: 24, y: top + 26 };
      }
      return { x: 0, y: top / 2 };
    };
    Puppet.prototype.getBounds = function () { return { x: -14, y: -this.H, w: 28, h: this.H }; };
    function line(ctx, x0, y0, x1, y1, w) {
      var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
      for (var i = 0; i <= n; i++) { var t = n ? i / n : 0; ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), w, w); }
    }
    Puppet.prototype.draw = function (ctx, sx, sy, o) {
      o = o || {};
      var P = LC.PAL[this.c][this.pal], f = o.facing || 1;
      var X = function (x) { return sx + x * f; };
      ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
      var body = o.silhouette || P.cloth1[1], hair = o.silhouette || P.hair[1], acc = o.silhouette || P.accent[1];
      if (o.flash > 0.3 && !o.silhouette) { body = o.flashColor || '#fff'; hair = body; acc = body; }
      var a = this.a, H = this.H;
      if (a === 'down') {
        ctx.fillStyle = P.outline; ctx.fillRect(Math.min(X(-30), X(10)), sy - 9, 41, 9);
        ctx.fillStyle = body; ctx.fillRect(Math.min(X(-29), X(9)), sy - 8, 39, 7);
        ctx.fillStyle = hair; ctx.fillRect(Math.min(X(-30), X(-20)), sy - 10, 11, 9);
        ctx.globalAlpha = 1; return;
      }
      var head = this.getAnchor('head'), hip = this.getAnchor('hip'), hand = this.getAnchor('weapon');
      var air = a.indexOf('jump') === 0 || a === 'launch' || a[0] === 'j' || a === 'airSpark' || a === 'diveKick';
      var tilt = a === 'launch' ? 6 : (a.indexOf('hit') === 0 ? -3 : 0);
      ctx.fillStyle = P.outline;
      // legs
      var kn = air ? -8 : 0, sw = (a === 'walkF' || a === 'walkB') ? Math.round(Math.sin(this.u * Math.PI * 2) * 5) : 0;
      ctx.fillStyle = o.silhouette || P.cloth2[1];
      line(ctx, X(hip.x), sy + hip.y, X(6 + sw), sy + kn, 3);
      line(ctx, X(hip.x), sy + hip.y, X(-6 - sw), sy + kn, 3);
      // torso
      ctx.fillStyle = body;
      line(ctx, X(hip.x), sy + hip.y, X(head.x + tilt), sy + head.y + 8, 6);
      // arm to weapon
      ctx.fillStyle = acc;
      line(ctx, X(head.x + tilt), sy + head.y + 14, X(hand.x), sy + hand.y, 2);
      ctx.fillRect(Math.round(X(hand.x)) - 2, Math.round(sy + hand.y) - 2, 4, 4);
      // head
      ctx.fillStyle = P.outline; ctx.fillRect(Math.round(X(head.x + tilt)) - 6, Math.round(sy + head.y) - 7, 12, 13);
      ctx.fillStyle = o.silhouette || P.skin[1]; ctx.fillRect(Math.round(X(head.x + tilt)) - 5, Math.round(sy + head.y) - 6, 10, 11);
      ctx.fillStyle = hair; ctx.fillRect(Math.round(X(head.x + tilt)) - 6, Math.round(sy + head.y) - 8, 12, 5);
      if (!o.silhouette) { ctx.fillStyle = P.eye[2]; ctx.fillRect(Math.round(X(head.x + tilt + 3)) - (f < 0 ? 1 : 0), Math.round(sy + head.y) - 1, 1, 2); }
      ctx.globalAlpha = 1;
    };
    R.createPuppet = function (c, opts) { return new Puppet(c, opts); };
  }

  // ------------------------------------------------------------------ fx
  if (need('fx', 'spawn')) {
    installed.push('fx');
    var parts = [];
    var X = LC.fx = {};
    X.init = function () { return Promise.resolve(); };
    X.spawn = function (name, x, y, o) {
      o = o || {};
      var big = /heavy|special|counter|ko|slam|whale|beam/.test(name), col = /block/.test(name) ? '#9fd8ff' : /counter/.test(name) ? '#ffd166' : /dust/.test(name) ? '#cbbfae' : '#fff3c0';
      if (/^hit|^block|Hit|slam|tech|burst|Catch|Splash|ring/.test(name)) parts.push({ x: x, y: y, t: 0, d: big ? 14 : 9, c: col, r: big ? 14 : 8, layer: 'front' });
      else if (/dust/.test(name)) parts.push({ x: x, y: y, t: 0, d: 12, c: col, r: 6, layer: 'back' });
      if (parts.length > 200) parts.shift();
    };
    X.update = function () { for (var i = parts.length - 1; i >= 0; i--) if (++parts[i].t > parts[i].d) parts.splice(i, 1); };
    X.draw = function (ctx, camX, layer) {
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i]; if (p.layer !== layer) continue;
        var k = p.t / p.d, r = Math.round(p.r * (0.4 + k));
        ctx.fillStyle = p.c; ctx.globalAlpha = 1 - k;
        var sx = Math.round(p.x - camX), sy = Math.round(p.y);
        ctx.fillRect(sx - r, sy - 1, r * 2, 2); ctx.fillRect(sx - 1, sy - r, 2, r * 2);
        ctx.fillRect(sx - (r >> 1), sy - (r >> 1), r, r);
        ctx.globalAlpha = 1;
      }
    };
    X.clear = function () { parts.length = 0; };
    X.count = function () { return parts.length; };
    X.drawSprite = function (ctx, name, sx, sy, t, o) {
      o = o || {};
      var P = (name.indexOf('claude') === 0 ? LC.PAL.claude : LC.PAL.deepseek)[o.palette | 0] || LC.PAL.claude[0];
      var f = o.facing || 1;
      ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
      switch (name) {
        case 'claude.spark':
          ctx.fillStyle = P.accent[2]; ctx.fillRect(sx - 7, sy - 2, 14, 4); ctx.fillRect(sx - 2, sy - 7, 4, 14);
          ctx.fillStyle = P.accent[0]; ctx.fillRect(sx - 4, sy - 4, 8, 8); ctx.fillStyle = '#fff'; ctx.fillRect(sx - 1, sy - 1, 2, 2); break;
        case 'deepseek.wave':
          ctx.fillStyle = P.accent[2]; ctx.fillRect(sx - 11, sy - 12, 22, 12);
          ctx.fillStyle = P.accent[1]; ctx.fillRect(sx - 8 + f * 2, sy - 20, 14, 10); ctx.fillStyle = P.accent[0]; ctx.fillRect(sx - 4 + f * 4, sy - 22, 6, 4); break;
        case 'claude.guardrail':
          ctx.fillStyle = P.accent[1]; ctx.globalAlpha *= 0.55; ctx.fillRect(sx - 4, sy - 58, 10, 56);
          ctx.globalAlpha = o.alpha != null ? o.alpha : 1; ctx.fillStyle = P.accent[0]; ctx.fillRect(sx - 4, sy - 58, 2, 56); break;
        case 'claude.beam':
          var L = o.length || 40, bx = f > 0 ? sx : sx - L;
          ctx.fillStyle = P.accent[2]; ctx.fillRect(bx, sy - 20, L, 40); ctx.fillStyle = P.accent[0]; ctx.fillRect(bx, sy - 10, L, 20);
          ctx.fillStyle = '#fff'; ctx.fillRect(bx, sy - 3, L, 6); break;
        case 'claude.book': ctx.fillStyle = P.cloth1[0]; ctx.fillRect(sx - 10, sy - 6, 20, 12); ctx.fillStyle = P.accent[1]; ctx.fillRect(sx - 1, sy - 6, 2, 12); break;
        case 'deepseek.pool': ctx.fillStyle = P.accent[2]; ctx.fillRect(sx - 20, sy - 2, 40, 4); ctx.fillStyle = P.accent[0]; ctx.fillRect(sx - 14, sy - 1, 28, 2); break;
        case 'deepseek.whale':
          var k = Math.min(1, t / 30), hgt = Math.round(Math.sin(Math.min(1, t / 60) * Math.PI) * 110);
          ctx.fillStyle = P.cloth2[1]; var wx = f > 0 ? sx - 10 + k * 60 : sx - 160 - k * 60;
          ctx.fillRect(Math.round(wx), sy - hgt, 170, Math.max(4, Math.min(60, hgt))); ctx.fillStyle = P.cloth1[1]; ctx.fillRect(Math.round(wx) + 20, sy - hgt + 30, 120, 10); break;
        case 'screen.superBg': ctx.fillStyle = 'rgba(5,4,10,0.65)'; ctx.fillRect(-8, -8, LC.W + 16, LC.H + 16);
          ctx.fillStyle = o.color || '#fff'; for (var i = 0; i < 14; i++) ctx.fillRect(0, (i * 31 + t * 7) % LC.H, LC.W, 1); break;
        case 'screen.koFlash': ctx.fillStyle = '#ffffff'; ctx.globalAlpha = Math.max(0, 0.6 - t / 40); ctx.fillRect(0, 0, LC.W, LC.H); break;
        default: break;
      }
      ctx.globalAlpha = 1;
    };
    X.spriteInfo = function () { return { duration: 0, bbox: { x: -8, y: -8, w: 16, h: 16 } }; };
    X.names = function () { return { spawn: [], sprites: [] }; };
  }

  // ------------------------------------------------------------------ audio
  if (need('audio', 'sfx')) {
    installed.push('audio');
    var noop = function () {};
    LC.audio = { init: function () { return Promise.resolve(); }, unlock: noop, sfx: noop, voice: noop, music: noop, setVolume: noop,
      getVolume: function () { return 1; }, duck: noop, setPaused: noop, list: function () { return { sfx: [], music: [] }; } };
  }

  // ------------------------------------------------------------------ stages
  if (need('stages', 'create')) {
    installed.push('stages');
    LC.stages = {
      init: function () { return Promise.resolve(); },
      list: function () { return LC.STAGES.map(function (id) { return { id: id, music: 'stage.' + id }; }); },
      create: function (id) {
        var t = 0;
        return {
          shadowColor: 'rgba(8,6,20,0.4)', thumb: null,
          update: function () { t++; },
          drawBack: function (ctx, camX) {
            ctx.fillStyle = '#26214a'; ctx.fillRect(-8, -8, LC.W + 16, GY + 8);
            ctx.fillStyle = '#2f2a5c'; for (var i = 0; i < 14; i++) { var x = ((i * 56 - camX * 0.6) % 784 + 784) % 784 - 64; ctx.fillRect(x, 40, 20, GY - 40); }
            ctx.fillStyle = '#3a345e'; ctx.fillRect(-8, GY, LC.W + 16, LC.H - GY + 8);
            ctx.fillStyle = '#4a4378'; for (var k = 0; k <= 10; k++) ctx.fillRect(Math.round(k * 64 - camX), GY, 1, 30);
            ctx.fillStyle = '#5d55a0'; ctx.fillRect(-8, GY, LC.W + 16, 1);
          },
          drawFront: function () {}, event: function () {}
        };
      }
    };
  }

  // ------------------------------------------------------------------ font (dev only: fillText)
  if (need('font', 'draw')) {
    installed.push('font');
    var mc = document.createElement('canvas').getContext('2d');
    function fnt(o) { return ((o && o.size) || 12) * ((o && o.scale) || 1) + 'px monospace'; }
    LC.font = {
      init: function () { return Promise.resolve(); },
      draw: function (ctx, text, x, y, o) {
        o = o || {}; ctx.font = fnt(o); ctx.textBaseline = 'top'; ctx.textAlign = o.align || 'left';
        var s = String(text); if (o.reveal != null) s = s.slice(0, o.reveal);
        if (o.outline) { ctx.fillStyle = o.outline; ctx.fillText(s, x - 1, y); ctx.fillText(s, x + 1, y); ctx.fillText(s, x, y - 1); ctx.fillText(s, x, y + 1); }
        ctx.fillStyle = o.color || '#fff'; ctx.fillText(s, x, y); ctx.textAlign = 'left';
        return ctx.measureText(s).width;
      },
      measure: function (text, o) { mc.font = fnt(o); return { w: Math.ceil(mc.measureText(String(text)).width), h: ((o && o.size) || 12) * ((o && o.scale) || 1) }; },
      wrap: function (text, w, o) {
        var out = [], cur = '';
        String(text).split('').forEach(function (ch) { if (LC.font.measure(cur + ch, o).w > w && cur) { out.push(cur); cur = ch; } else cur += ch; });
        if (cur) out.push(cur); return out;
      },
      lineHeight: function (s) { return (s || 12) + 2; }
    };
  }

  // ------------------------------------------------------------------ illust
  if (need('illust', 'portrait')) {
    installed.push('illust');
    LC.illust = { init: function () { return Promise.resolve(); }, portrait: function () { return null; }, logo: function () { return null; },
      drawTitle: function () {}, banner: function () { return null; }, icon: function () { return null; } };
  }
};
window.fightStubs();
