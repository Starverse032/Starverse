/* LATENT CLASH — LC.input: keyboard (2 players), gamepads, touch, pointer (PLATFORM).
 *
 * Every source is a "device" that yields a held state
 *   { up, down, left, right, L, M, H, S, throw, super, start, ok, cancel }
 * once per logic tick (poll). Devices are routed to players according to the mode:
 *   solo: everything drives player 0 (P1 keys + arrows/ZXCV + every pad + touch)
 *   duo : P1 keys (+ pad 0 when 2+ pads) + touch -> player 0;  P2 keys + the other pad -> player 1
 * Taps shorter than a tick still register for one tick (pressed-since-poll latch).
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};

  var ACTIONS = ['up', 'down', 'left', 'right', 'L', 'M', 'H', 'S', 'throw', 'super'];
  var DEFAULT_KEYS = {
    p1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], L: ['KeyJ'], M: ['KeyK'], H: ['KeyL'], S: ['KeyI'], throw: ['KeyU'], super: ['KeyO'] },
    p2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
          L: ['Numpad1', 'Comma'], M: ['Numpad2', 'Period'], H: ['Numpad3', 'Slash'], S: ['Numpad5', 'Semicolon'],
          throw: ['Numpad4', 'KeyM'], super: ['Numpad6', 'Quote'] }
  };
  // Solo-mode alternates for player 1 (fixed, not rebindable).
  var SOLO_KEYS = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], L: ['KeyZ'], M: ['KeyX'], H: ['KeyC'], S: ['KeyV'], throw: ['KeyB'], super: ['KeyN'] };
  var GLOBAL = {
    start: ['Enter', 'Escape', 'NumpadEnter'],
    ok: ['Enter', 'Space', 'NumpadEnter'],
    cancel: ['Escape', 'Backspace']
  };
  var P2_GLOBAL = { start: ['NumpadEnter', 'NumpadAdd'], ok: ['NumpadEnter'], cancel: ['NumpadDecimal', 'NumpadSubtract'] };

  var keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
  var held = new Set();          // codes currently down
  var tapped = new Set();        // codes that went down since the last poll
  var anyPending = false;
  var mode = 'solo';
  var gestureFns = [];
  var listening = false;
  var captureFn = null;          // key-config capture
  var override = [null, null];
  var padsPrev = {};             // index -> button bool array
  var padInfo = [];              // connected pads (for UI)
  var padsBlocked = false;
  var lastDevice = 'keyboard';
  var locked = false, ptrSaved = false;

  function blank() { return { up: false, down: false, left: false, right: false, L: false, M: false, H: false, S: false, throw: false, super: false, start: false, ok: false, cancel: false }; }
  function or(a, b) { for (var k in b) if (b[k]) a[k] = true; return a; }
  function isDown(code) { return held.has(code) || tapped.has(code); }
  function anyDown(list) { if (!list) return false; for (var i = 0; i < list.length; i++) if (isDown(list[i])) return true; return false; }

  function kbDevice(set, extra) {
    var d = blank();
    ACTIONS.forEach(function (a) { if (anyDown(set[a]) || (extra && anyDown(extra[a]))) d[a] = true; });
    return d;
  }

  // ---------------------------------------------------------------- gamepads
  var PAD = { L: [2], M: [3], H: [1], S: [0], throw: [4, 6], super: [5, 7], start: [9], ok: [0, 9], cancel: [1, 8],
              up: [12], down: [13], left: [14], right: [15] };
  function readPads() {
    var out = [];
    if (padsBlocked || !navigator.getGamepads) return out;
    var list;
    try { list = navigator.getGamepads(); } catch (e) { padsBlocked = true; return out; }
    for (var i = 0; i < (list ? list.length : 0); i++) {
      var p = list[i];
      if (!p || !p.connected) continue;
      var b = p.buttons.map(function (x) { return !!(x && (x.pressed || x.value > 0.5)); });
      var d = blank();
      for (var k in PAD) PAD[k].forEach(function (bi) { if (b[bi]) d[k] = true; });
      var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5) {
        // 8-way from the stick angle (22.5° sectors)
        var ang = Math.atan2(ay, ax), oct = Math.round(ang / (Math.PI / 4));
        if (oct === 0 || oct === 1 || oct === -1) d.right = true;
        if (oct === 4 || oct === -4 || oct === 3 || oct === -3) d.left = true;
        if (oct >= 1 && oct <= 3) d.down = true;
        if (oct <= -1 && oct >= -3) d.up = true;
      }
      var prev = padsPrev[p.index] || [];
      for (var j = 0; j < b.length; j++) if (b[j] && !prev[j]) { anyPending = true; lastDevice = 'gamepad'; }
      padsPrev[p.index] = b;
      out.push({ index: p.index, id: p.id, d: d });
    }
    padInfo = out.map(function (p) { return { index: p.index, id: p.id }; });
    return out;
  }

  // ---------------------------------------------------------------- menu channels
  function Channel() { this.prev = blank(); this.rep = {}; this.edge = blank(); }
  var REPEAT_DELAY = 16, REPEAT_RATE = 4;
  Channel.prototype.feed = function (h) {
    var e = this.edge, k;
    for (k in e) e[k] = false;
    var self = this;
    ['up', 'down', 'left', 'right'].forEach(function (dir) {
      if (h[dir]) {
        var n = (self.rep[dir] || 0) + 1;
        self.rep[dir] = n;
        if (n === 1 || (n > REPEAT_DELAY && (n - REPEAT_DELAY) % REPEAT_RATE === 0)) e[dir] = true;
      } else self.rep[dir] = 0;
    });
    ['ok', 'cancel', 'start', 'L', 'M', 'H', 'S'].forEach(function (k2) { if (h[k2] && !self.prev[k2]) e[k2] = true; });
    for (k in h) this.prev[k] = h[k];
  };
  var chAll = new Channel(), chP = [new Channel(), new Channel()];
  var BLANK = blank();

  // ---------------------------------------------------------------- state
  var playerHeld = [blank(), blank()];
  var anyThisTick = false;
  var pointer = { x: 0, y: 0, down: false, pressed: false, released: false, moved: false, type: 'mouse', active: false };
  var ptrPending = { pressed: false, released: false, moved: false };

  function menuView(d) {   // device held state -> fills ok/cancel from L/M
    if (d.L) d.ok = true;
    if (d.M) d.cancel = true;
    return d;
  }

  var input = LC.input = {
    ACTIONS: ACTIONS,
    DEFAULT_KEYS: DEFAULT_KEYS,
    SOLO_KEYS: SOLO_KEYS,
    keys: keys,
    menu: blank(),
    pointer: pointer,
    touchState: blank(),     // written by touch.js
    touchPressed: false,

    init: function () {
      if (listening) return;
      listening = true;
      var saved = LC.save && LC.save.get('keys', null);
      if (saved && saved.p1 && saved.p2) {
        ['p1', 'p2'].forEach(function (p) { ACTIONS.forEach(function (a) { if (Array.isArray(saved[p][a])) keys[p][a] = saved[p][a].slice(0, 3); }); });
      }
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('keyup', onKeyUp, true);
      window.addEventListener('blur', function () { held.clear(); });
      document.addEventListener('visibilitychange', function () { if (document.hidden) held.clear(); });
      window.addEventListener('gamepadconnected', function (e) {
        lastDevice = 'gamepad';
        if (LC.ui && LC.ui.toast) LC.ui.toast('手柄已连接 ' + (e.gamepad.index + 1) + 'P', 'gamepad');
      });
      window.addEventListener('gamepaddisconnected', function (e) {
        delete padsPrev[e.gamepad.index];
        if (LC.ui && LC.ui.toast) LC.ui.toast('手柄已断开', 'gamepad');
      });
      ['pointerdown', 'touchstart', 'mousedown'].forEach(function (t) {
        window.addEventListener(t, function (e) { gesture(e); }, { capture: true, passive: true });
      });
    },

    poll: function () {
      var pads = readPads();
      var kb1 = kbDevice(keys.p1, mode === 'solo' ? SOLO_KEYS : null);
      var kb2 = mode === 'duo' ? kbDevice(keys.p2) : blank();
      var g = blank();
      GLOBAL.start.forEach(function (c) { if (isDown(c)) g.start = true; });
      GLOBAL.ok.forEach(function (c) { if (isDown(c)) g.ok = true; });
      GLOBAL.cancel.forEach(function (c) { if (isDown(c)) g.cancel = true; });
      var g2 = blank();
      if (mode === 'duo') {
        P2_GLOBAL.start.forEach(function (c) { if (isDown(c)) g2.start = true; });
        P2_GLOBAL.ok.forEach(function (c) { if (isDown(c)) g2.ok = true; });
        P2_GLOBAL.cancel.forEach(function (c) { if (isDown(c)) g2.cancel = true; });
      }
      var touch = input.touchState;
      var dev0 = [kb1, touch], dev1 = [kb2];
      if (mode === 'solo') pads.forEach(function (p) { dev0.push(p.d); });
      else if (pads.length === 1) dev1.push(pads[0].d);
      else pads.forEach(function (p, i) { (i % 2 === 0 ? dev0 : dev1).push(p.d); });

      var h0 = blank(), h1 = blank();
      dev0.forEach(function (d) { or(h0, d); });
      dev1.forEach(function (d) { or(h1, d); });
      or(h0, g);
      if (mode === 'duo') or(h1, g2); else or(h0, g2);
      if (override[0]) h0 = or(blank(), override[0]);
      if (override[1]) h1 = or(blank(), override[1]);

      playerHeld[0] = h0; playerHeld[1] = h1;
      var m0 = menuView(or(blank(), h0)), m1 = menuView(or(blank(), h1));
      chP[0].feed(m0); chP[1].feed(m1);
      chAll.feed(or(or(blank(), m0), m1));
      input.menu = chAll.edge;

      pointer.pressed = ptrPending.pressed; pointer.released = ptrPending.released; pointer.moved = ptrPending.moved;
      ptrPending.pressed = ptrPending.released = ptrPending.moved = false;

      anyThisTick = anyPending || pointer.pressed || input.touchPressed;
      anyPending = false; input.touchPressed = false;
      tapped.clear();
    },

    // Fighting state for player i, macros resolved, SOCD cleaned (absolute directions).
    player: function (i) {
      var h = playerHeld[i] || blank();
      var o = { left: h.left, right: h.right, up: h.up, down: h.down, L: h.L || h.throw, M: h.M || h.throw, H: h.H || h.super, S: h.S || h.super, start: h.start };
      if (o.left && o.right) o.left = o.right = false;
      if (o.up && o.down) o.down = false;
      return o;
    },
    menuFor: function (i) { return locked || (mode === 'solo' && i === 1) ? BLANK : chP[i].edge; },
    anyPressed: function () { return !locked && anyThisTick; },
    // Scene transitions lock menu edges / taps (held fight state is unaffected).
    lock: function (on) {
      if (on === locked) return;
      locked = on;
      input.menu = on ? BLANK : chAll.edge;
      if (on) { ptrSaved = pointer.pressed; pointer.pressed = false; } else pointer.pressed = ptrSaved;
    },
    setMode: function (m) { mode = m === 'duo' ? 'duo' : 'solo'; },
    getMode: function () { return mode; },
    setOverride: function (i, state) { override[i] = state ? or(blank(), state) : null; },
    pads: function () { return padInfo; },
    lastDevice: function () { return lastDevice; },
    held: function (code) { return held.has(code); },

    // Gesture hooks: run synchronously inside real user-gesture events (audio unlock, focus).
    onGesture: function (fn) { gestureFns.push(fn); },

    // Key config
    captureNext: function (fn) { captureFn = fn; },
    cancelCapture: function () { captureFn = null; },
    bind: function (player, action, code) {
      var set = keys[player === 1 ? 'p2' : 'p1'];
      set[action] = [code].concat((set[action] || []).filter(function (c) { return c !== code; })).slice(0, 2);
      input.saveKeys();
    },
    resetKeys: function () {
      var d = JSON.parse(JSON.stringify(DEFAULT_KEYS));
      ['p1', 'p2'].forEach(function (p) { ACTIONS.forEach(function (a) { keys[p][a] = d[p][a]; }); });
      input.saveKeys();
    },
    saveKeys: function () { if (LC.save) LC.save.set('keys', keys); },
    keyName: keyName,

    // called by display.js with game-space coordinates
    _pointer: function (type, x, y, ptype) {
      pointer.x = x; pointer.y = y; pointer.type = ptype || 'mouse'; pointer.active = true;
      if (type === 'down') { pointer.down = true; ptrPending.pressed = true; }
      else if (type === 'up') { pointer.down = false; ptrPending.released = true; }
      else ptrPending.moved = true;
    },
    _touchPressed: function () { input.touchPressed = true; lastDevice = 'touch'; }
  };

  // ---------------------------------------------------------------- DOM handlers
  var BLOCK = { Space: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Tab: 1, Backspace: 1, Enter: 1, NumpadEnter: 1, Slash: 1, Quote: 1 };
  function isGameKey(code) {
    if (BLOCK[code]) return true;
    var sets = [keys.p1, keys.p2, SOLO_KEYS];
    for (var s = 0; s < sets.length; s++) for (var a in sets[s]) if (sets[s][a].indexOf(code) >= 0) return true;
    return false;
  }
  function gesture(e) {
    for (var i = 0; i < gestureFns.length; i++) {
      try { gestureFns[i](e); } catch (err) { console.error('[platform] gesture hook', err); }
    }
  }
  function onKeyDown(e) {
    var code = e.code || e.key;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (captureFn && !e.repeat) {
      var fn = captureFn; captureFn = null;
      e.preventDefault(); e.stopPropagation();
      fn(code);
      return;
    }
    if (isGameKey(code)) e.preventDefault();
    if (!e.repeat) {
      if (!held.has(code)) tapped.add(code);
      anyPending = true;
      lastDevice = 'keyboard';
      gesture(e);
    }
    held.add(code);
  }
  function onKeyUp(e) {
    var code = e.code || e.key;
    held.delete(code);
    if (isGameKey(code)) e.preventDefault();
  }

  var NAMES = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: '空格', Enter: '回车', Escape: 'Esc',
    Backspace: '退格', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
    Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', ShiftLeft: '左Shift', ShiftRight: '右Shift', ControlLeft: '左Ctrl',
    ControlRight: '右Ctrl', AltLeft: '左Alt', AltRight: '右Alt', Tab: 'Tab', CapsLock: 'Caps', NumpadEnter: '小键盘回车',
    NumpadAdd: '小键盘+', NumpadSubtract: '小键盘-', NumpadMultiply: '小键盘*', NumpadDivide: '小键盘/', NumpadDecimal: '小键盘.' };
  function keyName(code) {
    if (!code) return '—';
    if (NAMES[code]) return NAMES[code];
    var m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
    m = /^Digit(\d)$/.exec(code); if (m) return m[1];
    m = /^Numpad(\d)$/.exec(code); if (m) return '小键盘' + m[1];
    return code;
  }
})();
