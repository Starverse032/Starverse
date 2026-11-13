/* LATENT CLASH — FIGHT core: namespace, tuning constants, seeded RNG, geometry helpers and
 * feature-detected bridges to the other modules (fx / audio / stages / rig / illust / font).
 * Nothing here touches another module at load time. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};

  F.version = '1.0.0';
  F.chars = F.chars || {};
  F.headless = false;          // sim/test harness: skip fx/audio/stage calls entirely

  var GY = LC.GROUND_Y;

  // ---------------------------------------------------------------- tuning
  F.T = {
    GY: GY,
    WALL: 18,                  // closest an origin may get to the world edge
    MAXSEP: 328,               // max horizontal distance between the two fighters
    BUF_BTN: 6,                // button buffer (frames)
    MOTION: 13,                // motion window (first to last direction, frames)
    MOTION_LATE: 8,            // last direction of a motion -> button press, max frames
    SIMUL: 2,                  // simultaneous-press leniency (L+M, H+S)
    CONVERT: 2,                // a normal started this many frames ago may still turn into a throw/super
    CHAIN_EXTRA: 7,            // chain/special cancel window extends this far into recovery
    HITSTOP: { L: 7, M: 9, H: 11, S: 12, X: 3, T: 0 },
    BLOCKSTOP: { L: 6, M: 7, H: 9, S: 9, X: 2, T: 0 },
    PUSH: { L: [7, 7], M: [10, 9], H: [14, 12], S: [16, 14], X: [1, 2], T: [0, 0] },   // [hit, block] px
    METER_HIT: { L: 4, M: 6, H: 8, S: 9, X: 0, T: 10 },
    SCALE: [1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3],
    SCALE_MIN: 0.3, SCALE_MIN_SUPER: 0.5,
    COUNTER_DMG: 1.2,
    JUGGLE_MAX: 5,
    THROW_TECH: 8,             // tech window after being grabbed
    THROW_PROT: 6,             // unthrowable frames after leaving hit/block stun
    WAKE_THROW_INV: 6,         // unthrowable after get-up
    THROW_DMG: 120,
    KO_STOP: 42, KO_SLOW: 72,
    FLASH: 44,                 // super flash freeze length
    LAND_LAG: 3,               // empty-jump landing frames (attacks may be buffered)
    DOWN_LIE: 26, QUICK_LIE: 8, GETUP: 24
  };

  // ---------------------------------------------------------------- RNG (mulberry32)
  function RNG(seed) { this.s = (seed >>> 0) ^ 0x5bd1e995; if (!this.s) this.s = 0x9e3779b9; }
  RNG.prototype.next = function () {
    var t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.int = function (n) { return Math.floor(this.next() * n); };
  RNG.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.pick = function (arr) { return arr[this.int(arr.length)]; };
  F.RNG = RNG;

  // ---------------------------------------------------------------- helpers
  F.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  F.sign = function (v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); };
  F.num = function (v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; };
  // value that may depend on strength: { L:.., M:.., H:.. } or a plain value
  F.v = function (val, s) {
    if (val && typeof val === 'object' && !Array.isArray(val) && ('M' in val || 'L' in val || 'H' in val)) {
      return (s in val) ? val[s] : val.M;
    }
    return val;
  };
  F.overlap = function (a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  };
  // local box [x, y, w, h] (facing right, rel. origin) -> world rect
  F.worldBox = function (b, ox, oy, facing) {
    var x = facing > 0 ? ox + b[0] : ox - b[0] - b[2];
    return { x: x, y: oy + b[1], w: b[2], h: b[3] };
  };

  // ---------------------------------------------------------------- errors
  var once = {};
  F.err = function (tag, e) {
    if (once[tag]) return;
    once[tag] = 1;
    console.error('[fight] ' + tag, e);
  };
  F.warn = function (tag, msg) {
    if (once['w:' + tag]) return;
    once['w:' + tag] = 1;
    console.warn('[fight] ' + tag + (msg ? ': ' + msg : ''));
  };

  // ---------------------------------------------------------------- module bridges
  F.mod = function (name, fn) { var m = LC[name]; return !!(m && typeof m[fn] === 'function'); };

  F.fx = function (name, x, y, opts) {
    if (F.headless || !F.mod('fx', 'spawn')) return;
    try { LC.fx.spawn(name, x, y, opts || {}); } catch (e) { F.err('fx.spawn ' + name, e); }
  };
  F.sprite = function (ctx, name, sx, sy, t, opts) {
    if (!F.mod('fx', 'drawSprite')) return false;
    try { LC.fx.drawSprite(ctx, name, sx | 0, sy | 0, t, opts || {}); return true; } catch (e) { F.err('fx.drawSprite ' + name, e); return false; }
  };
  F.sfx = function (name, opts) {
    if (F.headless || !F.mod('audio', 'sfx')) return;
    try { LC.audio.sfx(name, opts || {}); } catch (e) { F.err('audio.sfx ' + name, e); }
  };
  F.voice = function (ch, kind) {
    if (F.headless || !F.mod('audio', 'voice')) return;
    try { LC.audio.voice(ch, kind); } catch (e) { F.err('audio.voice ' + kind, e); }
  };
  F.music = function (track, opts) {
    if (F.headless || !F.mod('audio', 'music')) return;
    try { LC.audio.music(track, opts || {}); } catch (e) { F.err('audio.music ' + track, e); }
  };
  F.duck = function (amount, secs) {
    if (F.headless || !F.mod('audio', 'duck')) return;
    try { LC.audio.duck(amount, secs); } catch (e) { F.err('audio.duck', e); }
  };
  F.text = function (ctx, text, x, y, opts) {
    if (!F.mod('font', 'draw')) return 0;
    try { return LC.font.draw(ctx, String(text), x | 0, y | 0, opts || {}) || 0; } catch (e) { F.err('font.draw', e); return 0; }
  };
  F.measure = function (text, opts) {
    if (!F.mod('font', 'measure')) return { w: String(text).length * 6, h: 12 };
    try { return LC.font.measure(String(text), opts || {}); } catch (e) { F.err('font.measure', e); return { w: 0, h: 12 }; }
  };
  F.wrap = function (text, w, opts) {
    if (!F.mod('font', 'wrap')) return [String(text)];
    try { return LC.font.wrap(String(text), w, opts || {}); } catch (e) { F.err('font.wrap', e); return [String(text)]; }
  };
  var illCache = {};
  F.portrait = function (ch, kind, pal) {
    var k = ch + '|' + kind + '|' + pal;
    if (k in illCache) return illCache[k];
    var c = null;
    if (F.mod('illust', 'portrait')) { try { c = LC.illust.portrait(ch, kind, pal) || null; } catch (e) { F.err('illust.portrait', e); } }
    return (illCache[k] = c);
  };
  F.banner = function (name) {
    var k = 'banner|' + name;
    if (k in illCache) return illCache[k];
    var c = null;
    if (F.mod('illust', 'banner')) { try { c = LC.illust.banner(name) || null; } catch (e) { F.err('illust.banner', e); } }
    return (illCache[k] = c);
  };
  F.icon = function (name) {
    var k = 'icon|' + name;
    if (k in illCache) return illCache[k];
    var c = null;
    if (F.mod('illust', 'icon')) { try { c = LC.illust.icon(name) || null; } catch (e) { F.err('illust.icon', e); } }
    return (illCache[k] = c);
  };
  F.clearIllustCache = function () { illCache = {}; };

  // Pan for sfx from a world x and the camera.
  F.pan = function (x, camX) { return F.clamp(((x - camX) / LC.W) * 2 - 1, -1, 1) * 0.7; };

  F.settings = function () { return LC.settings || {}; };
})();
