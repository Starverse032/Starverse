/* LATENT CLASH — RIG secondary motion: springy chains (hair, cloth, tails).
 *
 * Each chain is a list of points in the puppet's local space (facing right).
 * Point 0 is pinned to an attach point computed from the solved pose every
 * tick; the rest are verlet particles pulled toward a rest shape (angles
 * relative to the attach's base angle), with gravity, damping, drag from the
 * body's velocity and world inertia (when the body moves, the points lag).
 * Render positions are snapped to integers with hysteresis so settled hair
 * never shimmers. Purely visual: never feeds anchors or gameplay.
 *
 * Chain def: { id, n: links, len: px | [px...], rest: [deg...] (absolute,
 *   relative to the base angle), stiff: 0..1 | [..], damp: 0..1, grav: px/f²,
 *   drag: factor, limit: fn(pt, i, sk) optional (in-place clamp) }
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};

  function arr(v, i) { return Array.isArray(v) ? v[Math.min(i, v.length - 1)] : v; }

  function Chain(def) {
    this.def = def;
    var n = def.n + 1;
    this.n = n;
    this.x = new Float64Array(n); this.y = new Float64Array(n);
    this.px = new Float64Array(n); this.py = new Float64Array(n);
    this.qx = new Int32Array(n); this.qy = new Int32Array(n);   // snapped
    this.ax = 0; this.ay = 0; this.base = 0; this.ready = false;
  }

  Chain.prototype.restPos = function (i) {
    var d = this.def, x = this.ax, y = this.ay;
    for (var k = 0; k < i; k++) {
      var a = (this.base + arr(d.rest, k)) * Math.PI / 180, l = arr(d.len, k);
      x += Math.cos(a) * l; y += Math.sin(a) * l;
    }
    return [x, y];
  };

  Chain.prototype.reset = function () {
    var d = this.def, x = this.ax, y = this.ay;
    this.x[0] = this.px[0] = x; this.y[0] = this.py[0] = y;
    for (var i = 1; i < this.n; i++) {
      var a = (this.base + arr(d.rest, i - 1)) * Math.PI / 180, l = arr(d.len, i - 1);
      x += Math.cos(a) * l; y += Math.sin(a) * l;
      this.x[i] = this.px[i] = x; this.y[i] = this.py[i] = y;
    }
    for (i = 0; i < this.n; i++) { this.qx[i] = Math.round(this.x[i]); this.qy[i] = Math.round(this.y[i]); }
    this.ready = true;
  };

  // dx, dy: body displacement this tick in local space; vx, vy: body velocity (local)
  Chain.prototype.step = function (dx, dy, vx, vy, sk, floor) {
    if (!this.ready) { this.reset(); return; }
    var d = this.def, n = this.n, i;
    var damp = d.damp == null ? 0.82 : d.damp, g = d.grav == null ? 0.25 : d.grav, drag = d.drag == null ? 0.12 : d.drag;
    // pin
    this.x[0] = this.px[0] = this.ax; this.y[0] = this.py[0] = this.ay;
    for (i = 1; i < n; i++) {
      // world inertia: body moved, points stay
      this.x[i] -= dx; this.y[i] -= dy; this.px[i] -= dx; this.py[i] -= dy;
      var vxi = (this.x[i] - this.px[i]) * damp, vyi = (this.y[i] - this.py[i]) * damp;
      this.px[i] = this.x[i]; this.py[i] = this.y[i];
      var w = i / (n - 1);
      this.x[i] += vxi - vx * drag * w; this.y[i] += vyi + g - vy * drag * w * 0.6;
    }
    // shape springs (toward rest, relative to the actual parent)
    var a = this.base * Math.PI / 180;
    for (i = 1; i < n; i++) {
      var ra = (this.base + arr(d.rest, i - 1)) * Math.PI / 180, l = arr(d.len, i - 1), st = arr(d.stiff == null ? 0.2 : d.stiff, i - 1);
      var tx = this.x[i - 1] + Math.cos(ra) * l, ty = this.y[i - 1] + Math.sin(ra) * l;
      this.x[i] += (tx - this.x[i]) * st; this.y[i] += (ty - this.y[i]) * st;
    }
    // length constraints (from the root)
    for (i = 1; i < n; i++) {
      var ex = this.x[i] - this.x[i - 1], ey = this.y[i] - this.y[i - 1], el = Math.sqrt(ex * ex + ey * ey), L = arr(d.len, i - 1);
      if (el < 1e-6) { ex = 0; ey = 1; el = 1; }
      var mn = d.slack ? L * (1 - d.slack) : L;
      if (el > L || el < mn) {
        var tl = el > L ? L : mn;
        this.x[i] = this.x[i - 1] + ex / el * tl; this.y[i] = this.y[i - 1] + ey / el * tl;
      }
      if (d.limit) d.limit(this, i, sk);
      if (floor != null && this.y[i] > floor) { this.y[i] = floor; this.py[i] = floor + (this.py[i] - floor) * 0.5; }
    }
    // hysteresis snap
    var hys = d.hys == null ? 0.72 : d.hys;
    for (i = 0; i < n; i++) {
      if (i === 0 || Math.abs(this.x[i] - this.qx[i]) > hys) this.qx[i] = Math.round(this.x[i]);
      if (i === 0 || Math.abs(this.y[i] - this.qy[i]) > hys) this.qy[i] = Math.round(this.y[i]);
    }
    void a;
  };

  // A set of chains for one puppet
  function Sec(defs) {
    this.list = []; this.by = {};
    for (var i = 0; i < defs.length; i++) { var c = new Chain(defs[i]); this.list.push(c); this.by[defs[i].id] = c; }
    this.lx = null; this.ly = 0; this.lf = 1;
  }
  Sec.prototype.attach = function (id, x, y, base) {
    var c = this.by[id]; if (!c) return;
    c.ax = x; c.ay = y; c.base = base;
  };
  Sec.prototype.reset = function (env) {
    for (var i = 0; i < this.list.length; i++) this.list[i].reset();
    this.lx = env && env.x != null ? env.x : null; this.ly = env && env.y != null ? env.y : 0;
    this.lf = env && env.facing ? env.facing : 1;
  };
  Sec.prototype.step = function (env, sk) {
    env = env || {};
    var f = env.facing || 1, x = env.x == null ? 0 : env.x, y = env.y == null ? 0 : env.y;
    var dx = 0, dy = 0;
    if (this.lx != null && f === this.lf) {
      dx = (x - this.lx) * f; dy = y - this.ly;
      if (Math.abs(dx) > 40 || Math.abs(dy) > 40) { dx = 0; dy = 0; this.reset(env); }
    } else if (this.lx != null && f !== this.lf) {
      for (var k = 0; k < this.list.length; k++) this.list[k].reset();
    }
    this.lx = x; this.ly = y; this.lf = f;
    var vx = (env.vx || 0) * f, vy = env.vy || 0;
    var floor = env.grounded === false ? null : -1;
    for (var i = 0; i < this.list.length; i++) this.list[i].step(dx, dy, vx, vy, sk, floor);
  };

  I.Sec = Sec;
  I.Chain = Chain;

  // tiny deterministic PRNG (visual only)
  I.rng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})();
