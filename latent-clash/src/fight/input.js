/* LATENT CLASH — FIGHT input layer.
 * One Input per fighter. Fed raw held-button states every tick (absolute screen directions),
 * it keeps a direction history, edge-detects button presses into a short buffer, merges
 * near-simultaneous presses (L+M, H+S), recognises motions lazily (236, 623, 214, 22,
 * 236236) relative to the fighter's facing, and detects 66 / 44 dashes.
 *
 * Time: `t` counts every push; `et` (effective time) only counts frames in which the fighter
 * was not frozen (hit-stop / super flash), so freezes never eat into buffers or windows. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var T = F.T;

  var SIZE = 192;
  var B = F.BTN = { L: 1, M: 2, H: 4, S: 8 };

  function bits(list) { var m = 0; for (var i = 0; i < list.length; i++) m |= 1 << list[i]; return m; }
  var DN = bits([1, 2]), DOWN = bits([1, 2, 3]), NOTDOWN = bits([4, 5, 6, 7, 8, 9]);
  var D3 = bits([3]), D1 = bits([1]), FW = bits([6, 9]), BW = bits([4, 7]);
  var DNB = bits([3, 2]);

  // Patterns: list of { s: [sets...], span } (alternatives). Matched as ordered subsequences.
  var MOTIONS = {
    '236236': [{ s: [DN, D3, FW, DN, D3, FW], span: 28 }, { s: [DN, FW, DN, FW], span: 20 }],
    '623': [{ s: [bits([6, 3]), bits([2, 1]), D3], span: T.MOTION }],
    // the diagonal-less shortcut only counts for a quick tap of down (keyboard roll), never
    // for "was crouching, then walked forward and pressed a button"
    '236': [{ s: [DN, D3, FW], span: T.MOTION }, { s: [bits([2]), FW], span: 3, firstMax: 10 }],
    '214': [{ s: [DNB, D1, BW], span: T.MOTION }, { s: [bits([2]), BW], span: 3, firstMax: 10 }],
    '22': [{ s: [DOWN, NOTDOWN, DOWN], span: 15 }]
  };
  var PRIO = { '623': 3, '214': 2, '236': 2, '22': 1 };
  F.MOTIONS = MOTIONS;

  function Input() {
    this.dx = new Int8Array(SIZE);
    this.dy = new Int8Array(SIZE);
    this.et = new Int32Array(SIZE);
    this.t = 0; this.ett = 0;
    this.held = 0; this.pressed = 0;
    this.presses = [];
    this.dash = null; this.dashAge = 99;
    this.facing = 1;
    this.log = [];               // input-history display: [{ d, b, n }]
  }
  F.Input = Input;

  Input.prototype.reset = function () {
    this.presses.length = 0; this.dash = null; this.dashAge = 99;
  };

  Input.prototype.push = function (raw, frozen, facing) {
    raw = raw || {};
    var x = (raw.right ? 1 : 0) - (raw.left ? 1 : 0);
    var y = (raw.up && !raw.down) ? 1 : ((raw.down && !raw.up) ? -1 : 0);
    if (!frozen) this.ett++;
    this.t++;
    var i = this.t % SIZE;
    this.dx[i] = x; this.dy[i] = y; this.et[i] = this.ett;
    this.facing = facing;

    var held = (raw.L ? B.L : 0) | (raw.M ? B.M : 0) | (raw.H ? B.H : 0) | (raw.S ? B.S : 0);
    var pressed = held & ~this.held;
    this.held = held; this.pressed = pressed;

    // age / expire buffered presses
    var ps = this.presses;
    for (var k = ps.length - 1; k >= 0; k--) {
      var p = ps[k];
      if (!frozen) p.age++;
      if (p.age > T.BUF_BTN + T.SIMUL + 2) ps.splice(k, 1);
    }
    if (pressed) {
      var last = ps.length ? ps[ps.length - 1] : null;
      if (last && last.age <= T.SIMUL && !(last.b & pressed)) {
        last.b |= pressed;
        if (last.used) last.upgrade = true;
      } else {
        ps.push({ b: pressed, t: this.t, et: this.ett, age: 0, used: false, upgrade: false, x: x, y: y, mc: null });
        if (ps.length > 8) ps.shift();
      }
    }

    // dashes (66 / 44) — edge into a pure horizontal direction after a short neutral gap
    if (!frozen) this.dashAge++;
    var d = 5 + x * facing + 3 * y;
    var pd = this.dirAt(this.t - 1, facing);
    if ((d === 6 || d === 4) && pd !== d) {
      if (this.tapBefore(d, facing)) { this.dash = d === 6 ? 'F' : 'B'; this.dashAge = 0; }
    }

    // compact log for the training input display
    var lg = this.log, top = lg.length ? lg[lg.length - 1] : null;
    var ad = 5 + x + 3 * y;
    if (top && top.d === ad && top.h === held && !pressed) top.n++;
    else { lg.push({ d: ad, h: held, b: pressed, n: 1 }); if (lg.length > 24) lg.shift(); }
  };

  Input.prototype.dirAt = function (t, facing) {
    if (t <= 0 || t <= this.t - SIZE) return 5;
    var i = t % SIZE;
    return 5 + this.dx[i] * facing + 3 * this.dy[i];
  };
  Input.prototype.etAt = function (t) { return t <= 0 ? 0 : this.et[t % SIZE]; };
  Input.prototype.dir = function (facing) { return this.dirAt(this.t, facing); };
  Input.prototype.absX = function () { return this.dx[this.t % SIZE]; };
  Input.prototype.absY = function () { return this.dy[this.t % SIZE]; };

  // d pressed, released to neutral (<= 8 frames), pressed again, all within ~12 frames
  Input.prototype.tapBefore = function (d, facing) {
    var t = this.t - 1, lo = Math.max(1, this.t - SIZE + 2), etNow = this.ett, gap = 0;
    while (t >= lo && this.dirAt(t, facing) === 5) { gap++; t--; if (etNow - this.etAt(t) > 12) return false; }
    if (gap === 0 || gap > 8) return false;
    return t >= lo && this.dirAt(t, facing) === d && etNow - this.etAt(t) <= 12;
  };

  Input.prototype.takeDash = function () {
    if (this.dash && this.dashAge <= 3) { var d = this.dash; this.dash = null; return d; }
    return null;
  };

  // Ordered-subsequence match, scanning backward. Returns the effective time at which the final
  // direction was first reached, or -1.
  Input.prototype.matchPat = function (pat, facing, endT, minEt) {
    var lo = Math.max(1, this.t - SIZE + 2), s = pat.s, k = s.length - 1, t = endT;
    while (t >= lo && !(s[k] & (1 << this.dirAt(t, facing)))) t--;
    if (t < lo || this.etAt(t) < minEt) return -1;
    while (t - 1 >= lo && (s[k] & (1 << this.dirAt(t - 1, facing)))) t--;   // start of the final run
    var etLast = this.etAt(t);
    if (etLast < minEt) return -1;
    t--; k--;
    while (k >= 0) {
      while (t >= lo && !(s[k] & (1 << this.dirAt(t, facing)))) {
        if (etLast - this.etAt(t) > pat.span) return -1;
        t--;
      }
      if (t < lo || etLast - this.etAt(t) > pat.span) return -1;
      if (k === 0 && pat.firstMax) {
        var run = 0, tt = t;
        while (tt >= lo && (s[0] & (1 << this.dirAt(tt, facing)))) { run++; tt--; if (run > pat.firstMax) return -1; }
      }
      k--; t--;
    }
    return etLast;
  };

  Input.prototype.motionEt = function (name, facing, endT, minEt) {
    var pats = MOTIONS[name], best = -1;
    for (var i = 0; i < pats.length; i++) {
      var r = this.matchPat(pats[i], facing, endT, minEt);
      if (r > best) best = r;
    }
    return best;
  };

  // Motions recognised for a buffered press, relative to `facing`.
  // -> { sup: bool, m: '623'|'236'|'214'|'22'|null }
  Input.prototype.motions = function (p, facing) {
    var endT = Math.min(this.t, p.t + 2);
    var key = facing + ':' + endT;
    if (p.mc && p.mc.key === key) return p.mc;
    var minEt = p.et - T.MOTION_LATE;
    var res = { key: key, sup: this.motionEt('236236', facing, endT, minEt) >= 0, m: null };
    var bestEt = -1, bestP = 0;
    for (var name in PRIO) {
      var e = this.motionEt(name, facing, endT, minEt);
      if (e < 0) continue;
      if (e > bestEt || (e === bestEt && PRIO[name] > bestP)) { bestEt = e; bestP = PRIO[name]; res.m = name; }
    }
    p.mc = res;
    return res;
  };

  // direction (relative numpad) held when the press happened
  Input.prototype.pressDir = function (p, facing) { return 5 + p.x * facing + 3 * p.y; };

  Input.prototype.pending = function () {
    var out = [], ps = this.presses;
    for (var i = ps.length - 1; i >= 0; i--) if (!ps[i].used && ps[i].age <= T.BUF_BTN) out.push(ps[i]);
    return out;   // newest first
  };

  // a fresh (unused, recent) press containing any of mask
  Input.prototype.fresh = function (mask, maxAge) {
    var ps = this.presses, a = maxAge == null ? T.BUF_BTN : maxAge;
    for (var i = ps.length - 1; i >= 0; i--) {
      var p = ps[i];
      if (!p.used && p.age <= a && (p.b & mask)) return p;
    }
    return null;
  };

  Input.prototype.consume = function (p) { if (p) p.used = true; };
  Input.prototype.consumeAll = function () { for (var i = 0; i < this.presses.length; i++) this.presses[i].used = true; };
})();
