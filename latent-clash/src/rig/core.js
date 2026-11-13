/* LATENT CLASH — RIG core: public API (contract §5.3) and the Puppet class.
 *
 * Pipeline per puppet:
 *   setPose / setPoseSeg → evaluate keys (skel.js) → solve integer skeleton
 *   tick(env)            → secondary chains, blink
 *   draw(ctx, sx, sy, o) → if the integer state changed, re-render the
 *                          indexed buffer (char renderer + raster.js), then
 *                          map indices → RGBA through a cached LUT (normal /
 *                          flash level / silhouette), mirrored in the copy
 *                          loop for facing -1, and blit 1:1.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var BW = I.BW, BH = I.BH, OX = I.OX, OY = I.OY;

  var inited = false, seedCounter = 1;
  I.stats = { renders: 0, draws: 0, initMs: 0 };

  function err(msg) { console.error('[rig] ' + msg); }

  // ---------------------------------------------------------------- init
  R.init = function () {
    if (inited) return Promise.resolve();
    var t0 = performance.now();
    inited = true;
    Object.keys(I.CHARS).forEach(function (id) {
      var c = I.CHARS[id];
      try {
        if (c.build) c.build();
        c.colours = (LC.PAL[id] || []).map(function (pal) { return I.buildColours(pal.outline, c.ramps(pal)); });
      } catch (e) { err('building ' + id + ': ' + (e && e.stack || e)); }
    });
    if (I.fillPlaceholders) I.fillPlaceholders();
    I.stats.initMs = performance.now() - t0;
    return Promise.resolve();
  };
  function ensure() { if (!inited) R.init(); }

  R.listAnims = function (charId) { return Object.keys(I.ANIMS[charId] || {}); };
  R.hasAnim = function (charId, anim) { return !!(I.ANIMS[charId] && I.ANIMS[charId][anim]); };
  R.animInfo = function (charId, anim) {
    var a = I.ANIMS[charId] && I.ANIMS[charId][anim];
    if (!a) return null;
    return {
      segs: a.segs.map(function (s) { var o = { id: s.id, f: s.f }; if (s.loop) o.loop = true; return o; }),
      total: a.total, loop: a.loop, placeholder: a.placeholder || undefined, walk: a.walk || undefined
    };
  };
  R.charInfo = function (charId) {
    var c = I.CHARS[charId];
    if (!c) return null;
    return { height: c.height, crouchHeight: c.crouchHeight, width: c.width, palettes: (LC.PAL[charId] || []).length };
  };
  R.createPuppet = function (charId, opts) {
    ensure();
    if (!I.CHARS[charId]) { err('unknown character ' + charId); charId = 'claude'; }
    return new Puppet(charId, opts || {});
  };

  // ---------------------------------------------------------------- puppet
  function Puppet(charId, opts) {
    var c = I.CHARS[charId];
    this.charId = charId; this.c = c;
    var np = (LC.PAL[charId] || []).length || 1;
    this.palette = Math.max(0, Math.min(np - 1, opts.palette | 0));
    this.cols = c.colours[this.palette];
    this.pose = { ch: new Float64Array(I.NCH), ds: {} };
    this.sk = {};
    this.anim = null; this.animName = ''; this.si = 0; this.st = 0; this.absT = 0;
    this.sec = new I.Sec(c.chains || []);
    this.rnd = I.rng(0x9e37 * (seedCounter++));
    this.blink = 0; this.blinkWait = 40 + Math.floor(this.rnd() * 120);
    this.smear = null;
    this.env = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, grounded: true };
    this.locks = { F: null, B: null };     // foot lock (visual)
    this.lockOff = { F: 0, B: 0 };
    // render state
    this.cv = null; this.cx = null; this.img = null; this.u32 = null;
    this.idx = new Uint8Array(BW * BH);
    this.ib = [BW, BH, 0, 0];               // bbox of idx
    this.cb = [BW, BH, 0, 0];               // bbox written to the canvas
    this.sig = new Int32Array(320); this.sigN = 0; this.lsig = new Int32Array(320); this.lsigN = -1; this.lds = null;
    this.dirty = true; this.lookKey = ''; this.luts = {};
    this.setPose('idle', 0);
    this.sec.reset(null);
  }
  var PP = Puppet.prototype;

  PP._apply = function (a, si, t) {
    this.anim = a; this.animName = a.name; this.si = si; this.st = t;
    I.evalAnim(a, si, t, this.pose);
    I.solve(this.c.body, this.pose.ch, this.pose.ds, this.sk);
    if (this.c.post) this.c.post(this.sk);
    this._smear(a, si, t);
  };

  PP.setPose = function (anim, frame) {
    var a = I.ANIMS[this.charId][anim];
    if (!a) { if (!this._warned) { err(this.charId + ': no anim "' + anim + '"'); this._warned = true; } a = I.ANIMS[this.charId].idle; }
    frame = +frame || 0;
    this.absT = frame;
    var pos = I.locate(a, frame);
    this._apply(a, pos.si, pos.t);
  };

  PP.setPoseSeg = function (anim, segId, u) {
    var a = I.ANIMS[this.charId][anim];
    if (!a) { if (!this._warned) { err(this.charId + ': no anim "' + anim + '"'); this._warned = true; } a = I.ANIMS[this.charId].idle; }
    var si = 0;
    for (var i = 0; i < a.segs.length; i++) if (a.segs[i].id === segId) { si = i; break; }
    var s = a.segs[si];
    u = +u || 0;
    var t;
    if (s.loop) t = u * s.f;
    else { if (u < 0) u = 0; t = Math.min(u * s.f, Math.max(0, s.f - 1e-6)); }
    this.absT = a.start[si] + t;
    this._apply(a, si, t);
  };

  // smear: ds.smear = { part: 'pen'|'hF'|'hB'|'fF'|'fB', from: 'seg+N' | frame, n }
  var tmpPose = { ch: new Float64Array(64), ds: {} }, tmpSk = {};
  PP._smear = function (a, si, t) {
    var sm = this.pose.ds.smear;
    if (!sm) { this.smear = null; return; }
    var src = a, from = sm.from, fsi = si, ft = 0;
    if (typeof from === 'string') {
      var m = /^([A-Za-z0-9_]+)\s*([+-]\s*\d+(?:\.\d+)?)?$/.exec(from);
      fsi = m ? src.segs.findIndex(function (s) { return s.id === m[1]; }) : -1;
      if (fsi < 0) { this.smear = null; return; }
      ft = m[2] ? parseFloat(m[2].replace(/\s/g, '')) : 0;
    } else { var p = I.locate(src, from, true); fsi = p.si; ft = p.t; }
    I.evalAnim(src, fsi, ft, tmpPose);
    var ch0 = new Float64Array(tmpPose.ch), ch1 = this.pose.ch, n = sm.n || 5, pts = [];
    var mid = new Float64Array(ch0.length);
    for (var k = 0; k <= n; k++) {
      var u = k / n;
      for (var i = 0; i < ch0.length; i++) mid[i] = ch0[i] + (ch1[i] - ch0[i]) * u;
      I.solve(this.c.body, mid, this.pose.ds, tmpSk);
      if (this.c.post) this.c.post(tmpSk);
      var tb = this.c.partPoints(tmpSk, sm.part);
      pts.push(tb[0], tb[1], tb[2], tb[3]);    // base x,y, tip x,y
    }
    this.smear = { part: sm.part, pts: pts, kind: sm.kind || 'arc', col: sm.col || null };
  };

  PP.tick = function (env) {
    env = env || this.env;
    this.env = env;
    // attach chains to the current pose and step them
    if (this.c.attach) this.c.attach(this.sk, this.sec, this.pose.ds);
    this.sec.step(env, this.sk);
    // blink
    if (this.blink > 0) this.blink--;
    else if (--this.blinkWait <= 0) {
      this.blink = 7;
      this.blinkWait = 80 + Math.floor(this.rnd() * 160);
      if (this.rnd() < 0.18) this.blinkWait = 14;   // double blink
    }
    this._footLock(env);
  };

  PP.reset = function (env) {
    if (env) this.env = env;
    if (this.c.attach) this.c.attach(this.sk, this.sec, this.pose.ds);
    this.sec.reset(env || this.env);
    this.locks.F = this.locks.B = null; this.lockOff.F = this.lockOff.B = 0;
  };

  // keep planted feet fixed in the world during walk anims (visual only)
  PP._footLock = function (env) {
    var a = this.anim, ds = this.pose.ds, f = env.facing || 1;
    var plant = (a && a.walk && ds.plant) || '';
    for (var s = 0; s < 2; s++) {
      var k = s ? 'B' : 'F', on = plant.indexOf(k) >= 0;
      if (!on || env.x == null) { this.locks[k] = null; this.lockOff[k] = 0; continue; }
      var ft = s ? this.sk.ftB : this.sk.ftF;
      if (this.locks[k] == null) this.locks[k] = Math.round(env.x + f * ft[0]);
      var want = (this.locks[k] - env.x) * f, off = Math.round(want - ft[0]);
      this.lockOff[k] = off > 2 ? 2 : (off < -2 ? -2 : off);
    }
  };

  // ---------------------------------------------------------------- anchors
  PP.getAnchor = function (name) {
    var sk = this.sk, c = this.c, v;
    switch (name) {
      case 'head': v = c.headCenter(sk); break;
      case 'top': v = c.headTop(sk); v = [v[0], v[1] - 4]; break;
      case 'chest': v = [Math.round(sk.chest[0] * 0.65 + sk.waist[0] * 0.35), Math.round(sk.chest[1] * 0.65 + sk.waist[1] * 0.35)]; break;
      case 'hip': v = sk.pel; break;
      case 'center': v = [Math.round((sk.neck[0] + sk.pel[0]) / 2), Math.round((sk.neck[1] + sk.pel[1]) / 2)]; break;
      case 'handF': v = sk.haF; break;
      case 'handB': v = sk.haB; break;
      case 'footF': v = c.footPoint(sk, 'F'); break;
      case 'footB': v = c.footPoint(sk, 'B'); break;
      case 'muzzle': v = sk.muz || c.defaultMuzzle(sk); break;
      case 'weapon': v = sk.wpn || c.weaponPoint(sk); break;
      case 'grab': v = sk.grab || [sk.haF[0] + 4, sk.haF[1]]; break;
      default: v = c.extraAnchor ? c.extraAnchor(sk, name) : null;
    }
    if (!v) return { x: 0, y: 0 };
    return { x: v[0], y: v[1] };
  };

  PP.getBounds = function () {
    var sk = this.sk, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    var pts = [sk.pel, sk.chest, sk.neck, sk.haF, sk.haB, sk.elF, sk.elB, sk.knF, sk.knB, sk.ftF, sk.ftB, this.c.headTop(sk)];
    var extra = this.c.boundsExtra ? this.c.boundsExtra(sk) : null;
    if (extra) pts = pts.concat(extra);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    var m = 5;
    return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
  };

  // ---------------------------------------------------------------- drawing
  PP._signature = function () {
    var s = this.sig, n = 0, sk = this.sk, J = this.c.sigJoints, i, p;
    for (i = 0; i < J.length; i++) { p = sk[J[i]]; s[n++] = p[0]; s[n++] = p[1]; }
    s[n++] = Math.round(sk.lean); s[n++] = Math.round(sk.chestAng); s[n++] = Math.round(sk.headAng);
    s[n++] = Math.round(sk.faF); s[n++] = Math.round(sk.faB); s[n++] = Math.round(sk.pen); s[n++] = Math.round(sk.pg * 100);
    s[n++] = Math.round(sk.handAngF); s[n++] = Math.round(sk.handAngB);
    s[n++] = Math.round(sk.skirt * 10); s[n++] = Math.round(sk.tail * 10); s[n++] = Math.round(sk.arch * 10);
    s[n++] = this.blink; s[n++] = this.lockOff.F; s[n++] = this.lockOff.B;
    var L = this.sec.list;
    for (i = 0; i < L.length; i++) { var c = L[i]; for (var k = 0; k < c.n; k++) { s[n++] = c.qx[k]; s[n++] = c.qy[k]; } }
    if (this.smear) { var sp = this.smear.pts; s[n++] = sp.length; for (i = 0; i < sp.length; i++) s[n++] = Math.round(sp[i]); }
    if (n > s.length) err('signature overflow');
    this.sigN = n;
  };

  PP._render = function () {
    var pt = I.getPainter();
    pt.clear();
    pt.setLum(this.cols.lum);
    var D = {
      p: pt, sk: this.sk, ds: this.pose.ds, sec: this.sec.by, blink: this.blink,
      smear: this.smear, lock: this.lockOff, pal: this.palette, puppet: this
    };
    try { this.c.draw(D); } catch (e) { err('draw ' + this.charId + ': ' + (e && e.stack || e)); }
    // copy painter main buffer into our own index buffer
    var ib = this.ib, idx = this.idx, y;
    for (y = ib[1]; y < ib[3]; y++) idx.fill(0, y * BW + ib[0], y * BW + ib[2]);
    var x0 = pt.mx0, y0 = pt.my0, x1 = pt.mx1, y1 = pt.my1;
    if (x1 <= x0) { ib[0] = BW; ib[1] = BH; ib[2] = 0; ib[3] = 0; return; }
    for (y = y0; y < y1; y++) idx.set(pt.m.subarray(y * BW + x0, y * BW + x1), y * BW + x0);
    ib[0] = x0; ib[1] = y0; ib[2] = x1; ib[3] = y1;
    I.stats.renders++;
  };

  PP._lut = function (flash, flashColor, sil) {
    var key = sil ? 's' + sil : (flash > 0 ? 'f' + flash + flashColor : 'n');
    var l = this.luts[key];
    if (!l) {
      l = I.makeLUT(this.cols, flash / 8, flash > 0 ? I.hexToRGB(flashColor) : null, sil ? I.hexToRGB(sil) : null);
      this.luts[key] = l;
    }
    return { key: key, lut: l };
  };

  PP.draw = function (ctx, sx, sy, o) {
    o = o || {};
    I.stats.draws++;
    var facing = o.facing === -1 ? -1 : 1;
    var flash = o.flash > 0 ? Math.max(1, Math.min(8, Math.round(o.flash * 8))) : 0;
    var L = this._lut(flash, o.flashColor || '#ffffff', o.silhouette || null);
    // re-render indices if the integer state changed
    this._signature();
    var same = this.lsigN === this.sigN && this.lds === this.pose.ds;
    if (same) { for (var i = 0; i < this.sigN; i++) if (this.sig[i] !== this.lsig[i]) { same = false; break; } }
    if (!same) {
      this._render();
      this.lsig.set(this.sig.subarray(0, this.sigN)); this.lsigN = this.sigN; this.lds = this.pose.ds;
      this.dirty = true;
    }
    if (!this.cv) {
      this.cv = document.createElement('canvas'); this.cv.width = BW; this.cv.height = BH;
      this.cx = this.cv.getContext('2d'); this.img = this.cx.createImageData(BW, BH);
      this.u32 = new Uint32Array(this.img.data.buffer);
    }
    var look = L.key + '|' + facing;
    if (this.dirty || look !== this.lookKey) {
      this._convert(L.lut, facing);
      this.dirty = false; this.lookKey = look;
    }
    var ib = this.ib;
    if (ib[2] <= ib[0]) return;
    var cx0 = facing === 1 ? ib[0] : BW - ib[2], cw = ib[2] - ib[0], ch = ib[3] - ib[1];
    var org = facing === 1 ? OX : BW - 1 - OX;
    var dx = (sx | 0) + cx0 - org, dy = (sy | 0) + ib[1] - OY;
    var a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0) return;
    var pa = ctx.globalAlpha;
    if (a < 1) ctx.globalAlpha = pa * a;
    ctx.drawImage(this.cv, cx0, ib[1], cw, ch, dx, dy, cw, ch);
    if (a < 1) ctx.globalAlpha = pa;
  };

  PP._convert = function (lut, facing) {
    var ib = this.ib, cb = this.cb, u32 = this.u32, idx = this.idx, x, y;
    // canvas-space bbox of the new image
    var nx0 = facing === 1 ? ib[0] : BW - ib[2], nx1 = facing === 1 ? ib[2] : BW - ib[0];
    // clear the previously written area
    for (y = cb[1]; y < cb[3]; y++) u32.fill(0, y * BW + cb[0], y * BW + cb[2]);
    for (y = ib[1]; y < ib[3]; y++) {
      var row = y * BW;
      if (facing === 1) for (x = ib[0]; x < ib[2]; x++) u32[row + x] = lut[idx[row + x]];
      else for (x = ib[0]; x < ib[2]; x++) u32[row + BW - 1 - x] = lut[idx[row + x]];
    }
    var ux0 = Math.min(cb[0], nx0), uy0 = Math.min(cb[1], ib[1]), ux1 = Math.max(cb[2], nx1), uy1 = Math.max(cb[3], ib[3]);
    if (ux1 > ux0 && uy1 > uy0) this.cx.putImageData(this.img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
    cb[0] = nx0; cb[1] = ib[1]; cb[2] = nx1; cb[3] = ib[3];
  };

  // debug helpers for tools
  PP.info = function () {
    return { anim: this.animName, seg: this.anim ? this.anim.segs[this.si].id : '', t: this.st, abs: this.absT };
  };
  R.Puppet = Puppet;
  R.stats = I.stats;
})();
