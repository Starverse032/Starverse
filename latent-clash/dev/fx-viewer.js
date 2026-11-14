/* LATENT CLASH — FX viewer + film-strip renderer (owned by FX).
 * Interactive: click a name to spawn / show it at the marker (click the canvas
 * to move the marker). Headless (?headless=1): exposes FXV.strip() for
 * tools/fx-sheet.mjs. */
(function () {
  'use strict';
  var LC = window.LC, FX = LC.fx;
  var W = LC.W, H = LC.H, GY = LC.GROUND_Y;
  var headless = /[?&]headless=1/.test(location.search);
  var FXV = window.FXV = {};

  // ---- mock stage backdrops (procedural, crisp) ---------------------------------
  function bgCanvas(kind) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), i, x, y;
    function band(cols, y0, y1) { var n = cols.length; for (i = 0; i < n; i++) { g.fillStyle = cols[i]; g.fillRect(0, y0 + Math.floor((y1 - y0) * i / n), W, Math.ceil((y1 - y0) / n) + 1); } }
    if (kind === 'mid') {
      band(['#6a6577', '#656072', '#615c6d', '#5c5768'], 0, GY);
      g.fillStyle = '#4a4555'; g.fillRect(0, GY, W, H - GY); g.fillStyle = '#7a7488'; g.fillRect(0, GY, W, 1);
    } else if (kind === 'warm') {
      band(['#2a1820', '#3a2026', '#4a2a2a', '#5a3530', '#6a4234'], 0, GY);
      for (x = 6; x < W; x += 52) {           // bookshelves
        g.fillStyle = '#3a221e'; g.fillRect(x, 30, 40, GY - 30);
        for (y = 38; y < GY - 10; y += 18) {
          for (i = 0; i < 36; i += 3) { g.fillStyle = ['#8a4a36', '#a8683c', '#6a3a40', '#c09050', '#5a4a6a'][(i + y + x) % 5]; g.fillRect(x + 2 + i, y + ((i * 7 + y) % 4), 2, 14 - ((i * 7 + y) % 4)); }
          g.fillStyle = '#2a1814'; g.fillRect(x, y + 14, 40, 3);
        }
      }
      g.fillStyle = '#c88a50'; for (i = 0; i < 20; i++) g.fillRect((i * 97) % W, (i * 53) % 90 + 10, 1, 1);
      g.fillStyle = '#5a3424'; g.fillRect(0, GY, W, H - GY); g.fillStyle = '#7a4a30'; g.fillRect(0, GY, W, 1);
      g.fillStyle = '#4a2a1e'; for (x = 0; x < W; x += 24) g.fillRect(x, GY + 1, 1, H - GY);
    } else if (kind === 'blue') {
      band(['#06142c', '#0a1c3a', '#0e2648', '#123058', '#163a66'], 0, GY);
      g.fillStyle = '#1c4a7a'; for (i = 0; i < 5; i++) { for (y = 0; y < GY; y += 2) g.fillRect(40 + i * 80 + (y >> 3), y, 6, 1); }
      g.fillStyle = '#0a2240'; for (x = 20; x < W; x += 64) g.fillRect(x, 60, 30, GY - 60);
      g.fillStyle = '#2a6a9a'; for (x = 20; x < W; x += 64) for (y = 66; y < GY; y += 8) g.fillRect(x + 4, y, 22, 1);
      g.fillStyle = '#0c2238'; g.fillRect(0, GY, W, H - GY); g.fillStyle = '#2a5a80'; g.fillRect(0, GY, W, 1);
    } else if (kind === 'dark') {
      g.fillStyle = '#0b0a14'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1e1640'; for (x = 0; x < W; x += 24) g.fillRect(x, 0, 1, GY);
      for (y = 6; y < GY; y += 24) g.fillRect(0, y, W, 1);
      g.fillStyle = '#ff3fa0'; for (i = 0; i < 30; i++) g.fillRect((i * 131) % W, (i * 71) % 160, 1, 1);
      g.fillStyle = '#3fe0ff'; for (i = 0; i < 30; i++) g.fillRect((i * 89 + 40) % W, (i * 37) % 170, 1, 1);
      g.fillStyle = '#120e24'; g.fillRect(0, GY, W, H - GY); g.fillStyle = '#7a3aff'; g.fillRect(0, GY, W, 1);
      g.fillStyle = '#2a1a5a'; for (x = 0; x < W; x += 16) g.fillRect(x, GY + 1, 1, H - GY);
    } else if (kind === 'light') {
      g.fillStyle = '#dfe3ea'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#c4cad6'; for (x = 0; x < W; x += 16) g.fillRect(x, 0, 1, GY); for (y = 10; y < GY; y += 16) g.fillRect(0, y, W, 1);
      g.fillStyle = '#ccd2dc'; g.fillRect(0, GY, W, H - GY); g.fillStyle = '#9aa2b2'; g.fillRect(0, GY, W, 1);
      g.fillStyle = '#b4bac8'; for (x = 0; x < W; x += 32) g.fillRect(x, GY + 1, 1, H - GY);
    }
    return c;
  }
  var BG = {};
  ['mid', 'warm', 'blue', 'dark', 'light'].forEach(function (k) { BG[k] = bgCanvas(k); });
  FXV.bgNames = Object.keys(BG);

  function dummy(g, x, col, out) {   // simple fighter silhouette for scale (~68 px)
    g.fillStyle = out;
    g.fillRect(x - 7, GY - 69, 14, 15); g.fillRect(x - 10, GY - 55, 20, 26); g.fillRect(x - 9, GY - 30, 8, 30); g.fillRect(x + 1, GY - 30, 8, 30);
    g.fillStyle = col;
    g.fillRect(x - 6, GY - 68, 12, 13); g.fillRect(x - 9, GY - 54, 18, 24); g.fillRect(x - 8, GY - 30, 6, 29); g.fillRect(x + 2, GY - 30, 6, 29);
  }

  // ---- placement rules per name -------------------------------------------------
  var GROUND = /^(dust\.|throw\.slam|ring\.ground|deepseek\.pool|deepseek\.whale|deepseek\.wave$|deepseek\.waveCast|deepseek\.poolIn|deepseek\.poolOut|deepseek\.whaleSplash|claude\.guardrail|land)/;
  function isScreen(n) { return /^screen\./.test(n); }
  function anchorY(n) { return GROUND.test(n) ? GY : GY - 40; }
  FXV.cellFor = function (n) {
    if (/whale$/.test(n)) return { w: 300, h: 190, ox: 70, oy: 160 };
    if (/whaleSplash/.test(n)) return { w: 240, h: 130, ox: 0, oy: 110 };
    if (/ko\.burst/.test(n)) return { w: 220, h: 180, ox: 0, oy: 90 };
    if (/beam$/.test(n)) return { w: 360, h: 110, ox: 150, oy: 55 };
    if (/super\.charge|meter\.full|claude\.pages|poolOut|guardCatch/.test(n)) return { w: 120, h: 120, ox: 0, oy: 90 };
    if (/hit\.counter|hit\.special|throw/.test(n)) return { w: 104, h: 84, ox: 6, oy: 42 };
    if (/sonnetTrail|breachTrail|diveTrail/.test(n)) return { w: 100, h: 100, ox: 0, oy: 60 };
    if (/^dust\.|ring|pool|waveCast|wave$|bubbles|guardrail/.test(n)) return { w: 104, h: 72, ox: 0, oy: 60 };
    if (/book/.test(n)) return { w: 96, h: 76, ox: 0, oy: 40 };
    return { w: 84, h: 72, ox: 6, oy: 36 };
  };
  FXV.isScreen = isScreen;

  // ---- options from controls ------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function curOpts() {
    if (headless) return FXV.hopts || {};
    var o = { facing: +$('facing').value, power: +$('power').value, palette: +$('pal').value, index: +$('index').value };
    if ($('char').value) o.char = $('char').value;
    return o;
  }
  FXV.spriteOpts = function (name, t, base) {
    var o = {};
    for (var k in base) o[k] = base[k];
    if (/beam$/.test(name) && !base.phase) {      // auto beam cycle (charge 20, fire 70, fade 20)
      var tt = t % 110;
      if (tt < 20) { o.phase = 'charge'; o.power = (tt + 1) / 20; o.length = 0; }
      else if (tt < 90) { o.phase = 'fire'; o.power = 1; o.length = Math.min(base.length || 300, (tt - 19) * 40); }
      else { o.phase = 'fade'; o.power = 1 - (tt - 89) / 20; o.length = base.length || 300; }
    }
    if (/pool$/.test(name) && base.power == null) o.power = Math.min(1, (t + 1) / 8);
    return o;
  };
  function drawSpriteAt(g, name, t, mx, my, o) {
    var so = FXV.spriteOpts(name, t, o);
    if (isScreen(name)) { if (so.cx == null) { so.cx = mx; so.cy = my - 30; } FX.drawSprite(g, name, 0, 0, t, so); }
    else FX.drawSprite(g, name, mx, anchorY(name) === GY ? GY : my, t, so);
  }

  // ---- film strips (used by tools/fx-sheet.mjs) ------------------------------------
  var DIG = { 0: '####.##.##.####', 1: '.#.##..#..#.###', 2: '##...#.#.#..###', 3: '##...#.#...###.', 4: '#.##.####..#..#', 5: '####..##...###.', 6: '.###..##.#.#.#.', 7: '###..#.#..#..#.', 8: '.#.#.#.#.#.#.#.', 9: '.#.#.#.##..###.' };
  function label(g, str, x, y, s) {
    g.fillStyle = '#000'; g.fillRect(x, y, (str.length * 4 + 1) * s, 7 * s);
    g.fillStyle = '#ffd166';
    for (var i = 0; i < str.length; i++) { var d = DIG[str.charAt(i)]; if (!d) continue; for (var k = 0; k < 15; k++) if (d.charAt(k) === '#') g.fillRect(x + (1 + i * 4 + k % 3) * s, y + (1 + Math.floor(k / 3)) * s, s, s); }
  }
  /**
   * o = { name, frames:[...], bgs:['warm','dark'], scale:4, cols, opts:{...}, cell:{w,h,ox,oy}, dummies:false }
   * returns a PNG data URL: rows = backgrounds (wrapped by cols), columns = frames.
   */
  FXV.strip = function (o) {
    var name = o.name, isSpr = FX.names().sprites.indexOf(name) >= 0, frames = o.frames, S = o.scale || 4;
    var cell = o.cell || FXV.cellFor(name), scr = isScreen(name);
    if (scr) cell = { w: W, h: H, ox: 0, oy: 0 };
    var cw = cell.w, chh = cell.h, gap = 2 * S, cols = Math.min(o.cols || frames.length, frames.length);
    var rowsPer = Math.ceil(frames.length / cols), bgs = o.bgs || ['mid'];
    var out = document.createElement('canvas');
    out.width = cols * (cw * S + gap); out.height = bgs.length * rowsPer * (chh * S + gap);
    var og = out.getContext('2d'); og.imageSmoothingEnabled = false; og.fillStyle = '#111'; og.fillRect(0, 0, out.width, out.height);
    var gc = document.createElement('canvas'); gc.width = W; gc.height = H;
    var g = gc.getContext('2d'); g.imageSmoothingEnabled = false;
    var opts = o.opts || {}, mx = o.x || 160, my = anchorY(name);
    var maxF = Math.max.apply(null, frames);
    bgs.forEach(function (bg, bi) {
      FX.clear(); FX.seed(4242);
      FXV.hopts = opts;
      if (!isSpr) FX.spawn(name, mx, my, opts);
      for (var t = 0; t <= maxF; t++) {
        var idx = frames.indexOf(t);
        if (idx >= 0) {
          g.drawImage(BG[bg], 0, 0);
          if (o.dummies) { dummy(g, 120, '#8a8494', '#2a2630'); dummy(g, 230, '#8a8494', '#2a2630'); }
          if (isSpr) drawSpriteAt(g, name, t, mx, my, opts);
          FX.draw(g, 0, 'back'); FX.draw(g, 0, 'front');
          var col = idx % cols, row = bi * rowsPer + Math.floor(idx / cols);
          var sx = scr ? 0 : mx - cw / 2 + (cell.ox || 0) * (opts.facing < 0 ? -1 : 1), sy = scr ? 0 : my - (cell.oy || 0);
          og.drawImage(gc, Math.round(sx), Math.round(sy), cw, chh, col * (cw * S + gap), row * (chh * S + gap), cw * S, chh * S);
          label(og, String(t), col * (cw * S + gap), row * (chh * S + gap), Math.max(1, S >> 1));
        }
        if (!isSpr) FX.update();
      }
    });
    FX.clear();
    return out.toDataURL('image/png');
  };
  /** Draw-time benchmark: fills the pool with heavy effects, times draw(back+front). */
  FXV.bench = function (iter) {
    var gc = document.createElement('canvas'); gc.width = W; gc.height = H;
    var g = gc.getContext('2d'); g.imageSmoothingEnabled = false;
    FX.clear(); FX.seed(9);
    var names = FX.names().spawn, ms = [], i;
    for (i = 0; i < 200 && FX.count() < 390; i++) {
      FX.spawn(names[i % names.length], 40 + (i * 37) % 300, GY - 10 - (i * 13) % 80, { facing: i % 2 ? 1 : -1, palette: i % 2 });
      if (i % 6 === 5) FX.update();
    }
    for (i = 0; i < (iter || 60); i++) {
      if (FX.count() < 360) FX.spawn(names[i % names.length], 60 + (i * 53) % 260, GY - 30, {});
      g.drawImage(BG.mid, 0, 0);
      var t0 = performance.now(); FX.draw(g, 0, 'back'); FX.draw(g, 0, 'front'); ms.push(performance.now() - t0);
      FX.update();
    }
    ms.sort(function (a, b) { return a - b; });
    var live = FX.count();
    FX.clear();
    return { live: live, median: ms[ms.length >> 1], p90: ms[Math.floor(ms.length * 0.9)], max: ms[ms.length - 1] };
  };

  // ---- boot --------------------------------------------------------------------------
  var t0 = performance.now();
  FX.init().then(function () {
    FXV.initMs = performance.now() - t0;
    FXV.ready = true;
    if (!headless) startUI();
  });

  function startUI() {
    var cv = $('game'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    var marker = { x: 160, y: GY - 40 }, active = null, paused = false, acc = 0, lastSpawn = null, sinceEmpty = 0;
    var drawMs = [], frames = 0;
    function setZoom() { var z = +$('zoom').value; cv.style.width = W * z + 'px'; cv.style.height = H * z + 'px'; }
    setZoom(); $('zoom').onchange = setZoom;
    $('power').oninput = function () { $('powerV').textContent = $('power').value; };
    $('flash').onchange = function () { LC.settings.flash = $('flash').checked; };
    var names = FX.names();
    function mk(list, el, isSpr) {
      list.forEach(function (n) {
        var b = document.createElement('button'); b.className = 'fx'; b.textContent = n; b.dataset.n = n;
        b.onclick = function () {
          document.querySelectorAll('button.fx.on').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          var d = FX.describe(n) || {};
          $('desc').innerHTML = '<b>' + n + '</b> — ' + (d.desc || '') + (d.use ? '<br><i>use:</i> ' + d.use : '') +
            (isSpr ? '<br><i>info:</i> ' + JSON.stringify(FX.spriteInfo(n)).slice(0, 300) : '');
          if (isSpr) { active = { name: n, t: 0 }; lastSpawn = null; }
          else { active = null; lastSpawn = n; spawnNow(n); }
        };
        el.appendChild(b);
      });
    }
    mk(names.spawn, $('effList'), false); mk(names.sprites, $('sprList'), true);
    $('filter').oninput = function () { var q = this.value.toLowerCase(); document.querySelectorAll('button.fx').forEach(function (b) { b.style.display = b.dataset.n.toLowerCase().indexOf(q) >= 0 ? '' : 'none'; }); };
    function spawnNow(n) { FX.spawn(n, marker.x, GROUND.test(n) ? GY : marker.y, curOpts()); sinceEmpty = 0; }
    cv.onclick = function (e) {
      var r = cv.getBoundingClientRect();
      marker.x = Math.floor((e.clientX - r.left) / r.width * W); marker.y = Math.floor((e.clientY - r.top) / r.height * H);
      if (lastSpawn) spawnNow(lastSpawn);
    };
    $('pause').onclick = function () { paused = !paused; this.textContent = paused ? 'play' : 'pause'; };
    $('step').onclick = function () { paused = true; $('pause').textContent = 'play'; tick(); };
    $('clear').onclick = function () { FX.clear(); active = null; lastSpawn = null; };
    $('stress').onclick = function () {
      var all = FX.names().spawn;
      for (var i = 0; i < 60; i++) FX.spawn(all[(Math.random() * all.length) | 0], 40 + Math.random() * 300, GY - Math.random() * 90, { facing: Math.random() < 0.5 ? 1 : -1, palette: Math.random() < 0.5 ? 0 : 1 });
      FX.resetPeak();
    };
    function tick() {
      FX.update();
      if (active) {
        active.t++;
        var inf = FX.spriteInfo(active.name);
        if ($('loop').checked && inf && inf.duration > 0 && active.t > inf.duration + 20) active.t = 0;
        if (/beam$/.test(active.name) && active.t >= 110 && !$('loop').checked) active.t = 109;
      }
      if (lastSpawn && $('loop').checked) {
        if (FX.count() === 0) { sinceEmpty++; if (sinceEmpty > 14) spawnNow(lastSpawn); }
      }
    }
    function render() {
      g.drawImage(BG[$('bg').value], 0, 0);
      if ($('dummies').checked) { dummy(g, 120, '#8a8494', '#2a2630'); dummy(g, 230, '#8a8494', '#2a2630'); }
      var t0 = performance.now();
      if (active) {
        var o = curOpts(); o.length = +$('blen').value; if ($('phase').value) o.phase = $('phase').value;
        drawSpriteAt(g, active.name, active.t, marker.x, marker.y, o);
      }
      FX.draw(g, 0, 'back'); FX.draw(g, 0, 'front');
      drawMs.push(performance.now() - t0); if (drawMs.length > 60) drawMs.shift();
      if ($('marker').checked) { g.fillStyle = '#ff00ff'; g.fillRect(marker.x - 3, marker.y, 7, 1); g.fillRect(marker.x, marker.y - 3, 1, 7); }
      if (++frames % 10 === 0) {
        var s = FX.stats(), avg = drawMs.reduce(function (a, b) { return a + b; }, 0) / drawMs.length, mx = Math.max.apply(null, drawMs);
        $('stats').textContent = 'live ' + s.live + '/' + s.max + '  peak ' + s.peak + '  draw avg ' + avg.toFixed(3) + ' ms  max ' + mx.toFixed(3) +
          ' ms  init ' + FXV.initMs.toFixed(0) + ' ms' + (active ? '  t=' + active.t : '');
      }
    }
    function loop() {
      if (!paused) { acc += +$('speed').value; while (acc >= 1) { acc -= 1; tick(); } }
      render();
      requestAnimationFrame(loop);
    }
    loop();
  }
})();
