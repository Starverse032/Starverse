/* LATENT CLASH — FX engine core (owned by FX).
 *
 * Pooled, allocation-free (steady state) effect system:
 *  - one pool of MAX particle objects; `live` keeps them in spawn order, which
 *    is also draw order inside a layer (effects add parts back-to-front);
 *  - "kinds" give each particle its behaviour + drawing (baked anim frames,
 *    sparks, droplets, chips, glyphs, pages, bubbles, ribbons, emitters...);
 *  - effect definitions (I.def) are plain functions that add particles;
 *  - sprite definitions (I.defSprite) are stateless draw functions of t.
 * Own PRNG; never touches gameplay RNG. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};

  var MAX = 400;              // contract budget: <= 400 live particles
  var BACK = 0, FRONT = 1;
  I.BACK = BACK; I.FRONT = FRONT; I.MAX = MAX;
  I.GY = LC.GROUND_Y || 186;

  // ---- own PRNG (mulberry32) ---------------------------------------------------
  var rs = 0x2f6b9a1d;
  function R() {
    rs = (rs + 0x6D2B79F5) | 0;
    var t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  I.R = R;
  I.RR = function (a, b) { return a + (b - a) * R(); };
  I.RI = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
  I.RS = function () { return R() * 2 - 1; };
  I.pick = function (arr) { return arr[Math.floor(R() * arr.length)]; };

  // ---- registries ------------------------------------------------------------
  var effects = {}, sprites = {}, effOrder = [], sprOrder = [], bakers = [];
  I.effects = effects; I.sprites = sprites;
  /** Register a spawn effect. meta = { desc, use } (documentation, shown in the viewer). */
  I.def = function (name, fn, meta) {
    if (!effects[name]) effOrder.push(name);
    effects[name] = { fn: fn, meta: meta || {} };
  };
  /** Register a stateless sprite: def = { draw(ctx,sx,sy,t,o), info:{duration,bbox,...}, desc } */
  I.defSprite = function (name, def) {
    if (!sprites[name]) sprOrder.push(name);
    sprites[name] = def;
  };
  /** Register a bake step run once in init(). */
  I.onInit = function (label, fn) { bakers.push({ label: label, fn: fn }); };

  // ---- particle kinds --------------------------------------------------------
  var kinds = [];   // id -> { draw(ctx,p,sx,sy), step(p) }
  I.kind = function (name, def) { kinds.push(def); def.name = name; return kinds.length - 1; };

  // ---- pool --------------------------------------------------------------------
  function Particle() { this.reset(); this.seq = 0; }
  Particle.prototype.reset = function () {
    this.kind = 0; this.layer = FRONT; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.g = 0; this.drag = 1; this.life = 1; this.age = 0; this.delay = 0; this.pri = 0;
    this.facing = 1; this.size = 1; this.A = null; this.fd = 1; this.f0 = 0; this.loop = false;
    this.ramp = null; this.ramp2 = null; this.rot = 0; this.vrot = 0;
    this.a = 0; this.b = 0; this.c = 0; this.d = 0; this.e = 0;
    this.fn = null; this.ref = null; this.floor = 0; this.bounce = 0; this.dead = false;
  };
  var pool = [], live = new Array(MAX), nLive = 0, free = new Array(MAX), nFree = 0;
  for (var pi = 0; pi < MAX; pi++) { pool.push(new Particle()); free[nFree++] = pool[pi]; }
  var dummy = new Particle(), seq = 0, updating = false, peak = 0;

  /** Get a particle (reset). When the pool is full, the oldest expendable one is recycled. */
  function add(kind, x, y, layer) {
    var p;
    if (nFree > 0) p = free[--nFree];
    else if (updating) { dummy.reset(); return dummy; }
    else {
      var k = -1;
      for (var i = 0; i < nLive; i++) if (live[i].pri === 0) { k = i; break; }
      if (k < 0) k = 0;
      p = live[k];
      for (var j = k + 1; j < nLive; j++) live[j - 1] = live[j];
      nLive--;
    }
    p.reset();
    p.kind = kind; p.x = x; p.y = y; p.layer = layer === undefined ? FRONT : layer;
    p.seq = ++seq;
    live[nLive++] = p;
    if (nLive > peak) peak = nLive;
    return p;
  }
  I.add = add;
  I.freeSlots = function () { return nFree; };

  // ---- options ---------------------------------------------------------------
  var O = { facing: 1, power: 1, pal: 0, palette: 0, angle: null, vx: 0, vy: 0, scale: 1, text: null, index: 0, char: null, layer: null, raw: null };
  function readOpts(o) {
    o = o || {};
    O.facing = o.facing < 0 ? -1 : 1;
    O.power = o.power == null ? 1 : I.clamp(+o.power || 0, 0, 1);
    O.pal = O.palette = o.palette === 1 ? 1 : 0;
    O.angle = o.angle == null ? null : +o.angle;
    O.vx = +o.vx || 0; O.vy = +o.vy || 0;
    O.scale = o.scale == null ? 1 : +o.scale;
    O.text = o.text == null ? null : String(o.text);
    O.index = o.index | 0;
    O.char = o.char || null;
    O.layer = o.layer === 'back' ? BACK : o.layer === 'front' ? FRONT : null;
    O.raw = o;
    return O;
  }
  var SO = { facing: 1, palette: 0, pal: 0, alpha: 1, length: 0, phase: null, power: 1, char: null, color: null, cx: null, cy: null, u: null, raw: null };
  function readSpriteOpts(o) {
    o = o || {};
    SO.facing = o.facing < 0 ? -1 : 1;
    SO.pal = SO.palette = o.palette === 1 ? 1 : 0;
    SO.alpha = o.alpha == null ? 1 : I.clamp(+o.alpha, 0, 1);
    SO.length = o.length == null ? 0 : +o.length;
    SO.phase = o.phase || null;
    SO.power = o.power == null ? 1 : I.clamp(+o.power || 0, 0, 1);
    SO.char = o.char || null;
    SO.color = o.color || null;
    SO.cx = o.cx == null ? null : +o.cx;
    SO.cy = o.cy == null ? null : +o.cy;
    SO.u = o.u == null ? null : +o.u;
    SO.raw = o;
    return SO;
  }

  var warned = {};
  function warnOnce(key, msg) {
    if (warned[key]) return;
    warned[key] = true;
    console.warn('[fx] ' + msg);
  }
  I.warnOnce = warnOnce;

  // ---- public API --------------------------------------------------------------
  FX.ready = false;
  FX.init = function () {
    if (FX.ready) return Promise.resolve();
    var t0 = performance.now();
    I.bakeTimes = [];
    for (var i = 0; i < bakers.length; i++) {
      var b0 = performance.now();
      try { bakers[i].fn(); } catch (err) { console.error('[fx] bake failed: ' + bakers[i].label, err); }
      I.bakeTimes.push([bakers[i].label, +(performance.now() - b0).toFixed(1)]);
    }
    // pre-warm: draw every baked canvas once so the GPU upload happens now, not on first use
    var w0 = performance.now();
    try {
      var sc = document.createElement('canvas'); sc.width = 4; sc.height = 4;
      var sg = sc.getContext('2d');
      for (var ci = 0; ci < I.canvases.length; ci++) sg.drawImage(I.canvases[ci], 0, 0);
      sg.getImageData(0, 0, 1, 1);
    } catch (err) { console.error('[fx] pre-warm failed', err); }
    I.bakeTimes.push(['prewarm(' + I.canvases.length + ')', +(performance.now() - w0).toFixed(1)]);
    I.initMs = performance.now() - t0;
    FX.ready = true;
    return Promise.resolve();
  };

  FX.spawn = function (name, x, y, opts) {
    var e = effects[name];
    if (!e) { warnOnce('e:' + name, 'unknown effect "' + name + '"'); return; }
    if (!FX.ready) { warnOnce('notready', 'spawn("' + name + '") before LC.fx.init()'); return; }
    if (!(isFinite(x) && isFinite(y))) { warnOnce('nan:' + name, 'spawn("' + name + '") with non-finite position'); return; }
    try { e.fn(x, y, readOpts(opts)); } catch (err) { console.error('[fx] spawn ' + name + ' failed', err); }
  };

  I.tick = 0;
  FX.update = function () {
    I.tick++;
    updating = true;
    var n0 = nLive, j = 0, i, p;
    for (i = 0; i < n0; i++) {
      p = live[i];
      if (p.delay > 0) { p.delay--; live[j++] = p; continue; }
      p.age++;
      if (p.drag !== 1) { p.vx *= p.drag; p.vy *= p.drag; }
      p.vy += p.g;
      p.x += p.vx; p.y += p.vy;
      if (p.floor && p.y > p.floor && p.vy > 0) {
        if (p.bounce > 0) { p.y = p.floor; p.vy = -p.vy * p.bounce; p.vx *= 0.7; p.vrot *= 0.6; if (p.vy > -0.6) { p.vy = 0; p.g = 0; } }
        else if (p.bounce < 0) p.dead = true;
        else { p.y = p.floor; p.vy = 0; p.g = 0; p.vx *= 0.8; }
      }
      var k = kinds[p.kind];
      if (k.step) k.step(p);
      if (p.dead || p.age >= p.life) { p.dead = true; free[nFree++] = p; }
      else live[j++] = p;
    }
    for (i = n0; i < nLive; i++) live[j++] = live[i];   // spawned by emitters this tick
    nLive = j;
    updating = false;
  };

  FX.draw = function (ctx, camX, layer) {
    var L = layer === 'back' ? BACK : FRONT;
    camX = camX || 0;
    for (var i = 0; i < nLive; i++) {
      var p = live[i];
      if (p.layer !== L || p.delay > 0) continue;
      var k = kinds[p.kind];
      if (k.draw) k.draw(ctx, p, Math.round(p.x - camX), Math.round(p.y));
    }
  };

  FX.clear = function () {
    for (var i = 0; i < nLive; i++) { live[i].dead = true; free[nFree++] = live[i]; }
    nLive = 0;
  };
  FX.count = function () { return nLive; };

  FX.drawSprite = function (ctx, name, sx, sy, t, opts) {
    var s = sprites[name];
    if (!s) { warnOnce('s:' + name, 'unknown sprite "' + name + '"'); return; }
    if (!FX.ready) { warnOnce('notready2', 'drawSprite("' + name + '") before LC.fx.init()'); return; }
    var o = readSpriteOpts(opts);
    if (o.alpha <= 0) return;
    var a0 = ctx.globalAlpha;
    if (o.alpha < 1) ctx.globalAlpha = a0 * o.alpha;
    try { s.draw(ctx, Math.round(sx), Math.round(sy), t > 0 ? Math.floor(t) : 0, o); }
    catch (err) { warnOnce('se:' + name, 'drawSprite ' + name + ' failed: ' + err); console.error(err); }
    ctx.globalAlpha = a0;
  };
  FX.spriteInfo = function (name) {
    var s = sprites[name];
    if (!s) { warnOnce('s:' + name, 'unknown sprite "' + name + '"'); return null; }
    return typeof s.info === 'function' ? s.info() : s.info;
  };
  FX.names = function () { return { spawn: effOrder.slice(), sprites: sprOrder.slice() }; };
  /** Extra (non-contract): documentation + diagnostics for tools. */
  FX.describe = function (name) {
    var e = effects[name];
    if (e) return e.meta;
    var s = sprites[name];
    return s ? { desc: s.desc, use: s.use } : null;
  };
  FX.stats = function () {
    return { live: nLive, peak: peak, max: MAX, initMs: I.initMs, bake: I.bakeTimes };
  };
  FX.resetPeak = function () { peak = nLive; };
  /** Re-seed the FX PRNG (tools use it for reproducible film strips). */
  FX.seed = function (s) { rs = s | 0; };

  // ---- colour schemes from LC.PAL -----------------------------------------
  var ramp = I.ramp;
  I.N = {   // neutral ramps (generic effects); bright -> dark
    hot:   ramp(['#ffffff', '#fff6b8', '#ffd84a', '#ffa23a', '#ec5a2c', '#a8302c', '#5a1a2a']),
    cool:  ramp(['#ffffff', '#e2f7ff', '#a4e2ff', '#5cb4ff', '#3a70f0', '#2a3ea8', '#1a1f5e']),
    red:   ramp(['#ffffff', '#ffe2ea', '#ff8cae', '#ff3f6c', '#d41c4a', '#7e1032', '#3c0a20']),
    gold:  ramp(['#ffffff', '#fff9c8', '#fff07a', '#ffd166', '#e5a23a', '#a8661e', '#5e3412']),
    dust:  ramp(['#f6eee0', '#dccfb8', '#b9a98f', '#8f8170', '#655b50', '#433c38']),
    rock:  ramp(['#d8d0c4', '#a89f92', '#787068', '#4e4846', '#2e2a2c']),
    tech:  ramp(['#ffffff', '#efe8ff', '#c6b6ff', '#8f7cf0', '#5d4cc0', '#352a78']),
    white: ramp(['#ffffff', '#f4f4ff', '#d6dcf0', '#a8b0cc', '#767e9c'])
  };
  function schemeFor(ch, pi) {
    var P = LC.PAL[ch][pi];
    if (ch === 'claude') {
      var A = P.accent, M = P.metal, C = P.cloth1, K = P.cloth2;
      return {
        id: ch + pi, ch: ch, pal: pi, outline: P.outline,
        // light: white-hot -> accent ramp -> deep outline (stars, beam, slash)
        light: ramp(['#ffffff', A[0], A[1], A[2], A[3], I.mix(A[3], P.outline, 0.55)]),
        gold: ramp(['#ffffff', M[0], M[1], M[2], M[3]]),
        paper: ramp(C.slice()),
        ink: ramp(K.slice()),
        text: ramp([A[1], A[2], A[3]]),
        // seal: vermilion stamp for the haiku slash (pal 1: deep gold stamp)
        seal: ramp(pi === 0 ? ['#fff3df', '#e8482e', '#a8241c', '#5e1414'] : ['#fffbe6', '#e6a020', '#9c5e10', '#4e2c08'])
      };
    }
    var Ac = P.accent, Wc = P.cloth1, Bc = P.cloth2;
    var deep = pi === 0 ? Bc[3] : Wc[3];
    return {
      id: ch + pi, ch: ch, pal: pi, outline: P.outline,
      water: ramp(['#ffffff', Ac[0], Ac[1], Ac[2], Ac[3], deep]),
      foam: ramp(['#ffffff', I.mix('#ffffff', Ac[0], 0.5), Ac[0], Ac[1]]),
      blue: ramp(pi === 0 ? Bc.slice() : Wc.slice()),
      belly: ramp(pi === 0 ? Wc.slice() : Bc.slice()),
      glow: ramp(['#ffffff', Ac[0], Ac[1], Ac[2]]),
      deep: deep
    };
  }
  I.SC = { claude: [schemeFor('claude', 0), schemeFor('claude', 1)], deepseek: [schemeFor('deepseek', 0), schemeFor('deepseek', 1)] };
  I.scheme = function (ch, pal) { return (I.SC[ch] || I.SC.claude)[pal === 1 ? 1 : 0]; };

  // ---- basic kinds -------------------------------------------------------------
  function rampAt(p, r) {
    var n = r.length, i = Math.floor((p.age / p.life) * n) + p.c;
    return r[i < 0 ? 0 : i >= n ? n - 1 : i];
  }
  I.rampAt = rampAt;

  // ANIM: baked frame sheet, optional velocity/drag; dies after last frame unless loop
  I.K_ANIM = I.kind('anim', {
    draw: function (ctx, p, sx, sy) {
      var A = p.A, f = p.f0 + Math.floor(p.age / p.fd);
      if (p.loop) f = f % A.n; else if (f >= A.n) return;
      I.drawAnim(ctx, A, f, sx, sy, p.facing);
    }
  });
  /** Spawn a baked animation. fd = ticks per frame. */
  I.anim1 = function (A, x, y, facing, layer, fd, delay) {
    var p = add(I.K_ANIM, x, y, layer);
    p.A = A; p.facing = facing < 0 ? -1 : 1; p.fd = fd || A.fd || 1; p.life = A.n * p.fd; p.pri = 1;
    p.delay = delay | 0;
    return p;
  };

  // DOT: square of p.size, colour through ramp over life; p.e = shrink (1 = shrinks to 1px)
  I.K_DOT = I.kind('dot', {
    draw: function (ctx, p, sx, sy) {
      var s = p.size;
      if (p.e) s = Math.max(1, Math.round(s * (1 - p.age / p.life) + 0.49));
      ctx.fillStyle = rampAt(p, p.ramp);
      var h = s >> 1;
      ctx.fillRect(sx - h, sy - h, s, s);
    }
  });

  // SPARK: tapering streak along velocity; head colour ramp[i], tail ramp[i+1]; p.a = length factor, p.b = max len
  I.K_SPARK = I.kind('spark', {
    draw: function (ctx, p, sx, sy) {
      if (p.age === 0) return;     // hidden on the (held) impact frame; emerges from the burst
      var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      var k = 1 - p.age / p.life;
      var len = Math.min(p.b, sp * p.a) * (0.35 + 0.65 * k);
      var r = p.ramp, n = r.length, ci = Math.floor((p.age / p.life) * (n - 1)) + p.c;
      if (ci > n - 2) ci = n - 2; if (ci < 0) ci = 0;
      var ux = sp > 0.01 ? p.vx / sp : Math.cos(p.rot), uy = sp > 0.01 ? p.vy / sp : Math.sin(p.rot);
      var L = Math.round(len);
      ctx.fillStyle = r[ci + 1];
      var hl = L >> 1;
      for (var s = L; s > hl; s--) ctx.fillRect(Math.round(sx - ux * s), Math.round(sy - uy * s), 1, 1);
      ctx.fillStyle = r[ci];
      for (s = hl; s >= 1; s--) ctx.fillRect(Math.round(sx - ux * s), Math.round(sy - uy * s), 1, 1);
      var hs = p.size > 1 && k > 0.4 ? 2 : 1;
      ctx.fillRect(sx - (hs >> 1), sy - (hs >> 1), hs, hs);
    }
  });
  /** Convenience: spark at angle a (radians), speed v. */
  I.spark = function (x, y, a, v, life, rampCss, layer, opt) {
    var p = add(I.K_SPARK, x, y, layer);
    p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.life = life; p.ramp = rampCss;
    p.a = 1.6; p.b = 9; p.drag = 0.86; p.size = 1; p.rot = a;
    if (opt) { if (opt.g) p.g = opt.g; if (opt.len) p.a = opt.len; if (opt.max) p.b = opt.max; if (opt.drag) p.drag = opt.drag; if (opt.size) p.size = opt.size; if (opt.c) p.c = opt.c; }
    return p;
  };

  // DROP: water droplet, stretches with speed; splats on the floor
  I.K_DROP = I.kind('drop', {
    draw: function (ctx, p, sx, sy) {
      var r = p.ramp, s = p.size;
      var st = Math.min(3, Math.floor(Math.abs(p.vy) * 0.45));
      var k = p.age / p.life;
      var ci = k > 0.75 ? 2 : 1;
      if (p.floor && p.y >= p.floor - 0.5) {     // landed: tiny splat
        ctx.fillStyle = r[2];
        ctx.fillRect(sx - 1, sy - 1, 1, 1); ctx.fillRect(sx + 1, sy - 1, 1, 1);
        return;
      }
      ctx.fillStyle = r[ci + 1];
      ctx.fillRect(sx, sy - st, s, s + st);
      ctx.fillStyle = r[ci - 1];
      ctx.fillRect(sx, sy - st, 1, 1);
    },
    step: function (p) {
      if (p.floor && p.y >= p.floor && p.vy === 0) { if (!p.e) { p.e = 1; p.life = Math.min(p.life, p.age + 4); } }
    }
  });
  I.drop = function (x, y, vx, vy, life, rampCss, layer, size) {
    var p = add(I.K_DROP, x, y, layer);
    p.vx = vx; p.vy = vy; p.life = life; p.ramp = rampCss; p.g = 0.22; p.size = size || 1;
    p.floor = I.GY + 1 + Math.floor(R() * 6); p.bounce = 0;
    return p;
  };

  // CHIP: debris chunk (w = size, h = p.d|size), lit top; bounces
  I.K_CHIP = I.kind('chip', {
    draw: function (ctx, p, sx, sy) {
      var r = p.ramp, k = p.age / p.life, s = p.size, h = p.d || s;
      if (k > 0.7) { s = Math.max(1, s - 1); h = Math.max(1, h - 1); }
      var spin = (Math.floor(p.rot) & 1);
      var w2 = spin ? h : s, h2 = spin ? s : h;
      ctx.fillStyle = r[2 + p.c];
      ctx.fillRect(sx, sy, w2, h2);
      ctx.fillStyle = r[1 + p.c];
      ctx.fillRect(sx, sy, w2, 1);
    },
    step: function (p) { p.rot += p.vrot; }
  });
  I.chip = function (x, y, vx, vy, life, rampCss, size, layer) {
    var p = add(I.K_CHIP, x, y, layer);
    p.vx = vx; p.vy = vy; p.life = life; p.ramp = rampCss; p.g = 0.25; p.size = size || 2;
    p.floor = I.GY + 1 + Math.floor(R() * 4); p.bounce = 0.4; p.vrot = 0.3 + R() * 0.4;
    return p;
  };

  // TWINKLE: 4-point star sparkle that grows then shrinks (p.size = max arm)
  I.K_TWINKLE = I.kind('twinkle', {
    draw: function (ctx, p, sx, sy) {
      var k = p.age / p.life, a = k < 0.3 ? k / 0.3 : (1 - k) / 0.7;
      var arm = Math.round(p.size * a);
      var r = p.ramp;
      ctx.fillStyle = r[k < 0.5 ? 1 : 2];
      if (arm >= 1) { ctx.fillRect(sx - arm, sy, arm * 2 + 1, 1); ctx.fillRect(sx, sy - arm, 1, arm * 2 + 1); }
      ctx.fillStyle = r[0];
      if (arm >= 2) { ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
      else ctx.fillRect(sx, sy, 1, 1);
    }
  });
  I.twinkle = function (x, y, size, life, rampCss, layer, delay) {
    var p = add(I.K_TWINKLE, x, y, layer);
    p.size = size; p.life = life; p.ramp = rampCss; p.delay = delay | 0;
    return p;
  };

  // RIBBON: thick segment from (a,b) to (x,y); p.size = width; colours ramp[i] core / ramp[i+1] rim
  I.K_RIBBON = I.kind('ribbon', {
    draw: function (ctx, p, sx, sy) {
      var k = p.age / p.life, w = Math.max(1, Math.round(p.size * (1 - k * k)));
      var camOff = p.x - sx;
      var ax = Math.round(p.a - camOff), ay = Math.round(p.b);
      var dx = sx - ax, dy = sy - ay, n = Math.max(Math.abs(dx), Math.abs(dy), 1);
      var r = p.ramp, ci = Math.min(r.length - 2, Math.floor(k * (r.length - 1)) + p.c);
      var h = w >> 1;
      ctx.fillStyle = r[ci + 1];
      for (var i = 0; i <= n; i++) ctx.fillRect(Math.round(ax + dx * i / n) - h, Math.round(ay + dy * i / n) - h, w, w);
      if (w >= 3) {
        ctx.fillStyle = r[ci];
        var w2 = w - 2, h2 = w2 >> 1;
        for (i = 0; i <= n; i++) ctx.fillRect(Math.round(ax + dx * i / n) - h2, Math.round(ay + dy * i / n) - h2 - 1, w2, w2);
      }
    },
    step: function (p) { p.a += p.vx; p.b += p.vy; }
  });

  // EMIT: invisible; calls p.fn(p) every tick (age already advanced)
  I.K_EMIT = I.kind('emit', { step: function (p) { p.fn(p); } });
  I.emitter = function (fn, x, y, life, layer) {
    var p = add(I.K_EMIT, x, y, layer);
    p.fn = fn; p.life = life; p.pri = 1;
    return p;
  };
})();
