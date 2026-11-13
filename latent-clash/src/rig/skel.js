/* LATENT CLASH — RIG skeleton: pose channels, animation timelines, IK solve.
 *
 * A pose is a plain object (see NOTES.md "Pose format"). Numeric fields are
 * interpolated between keys; everything else (expression, hand shapes, bend
 * directions, layering, smear…) switches at the key. Animations are lists of
 * segments, each with its own keys; time inside a key span is quantised to
 * `step` frames (default 2 = "on twos") so motion lands on held drawings.
 *
 * The solver turns a pose into integer joint positions (pure maths, no
 * canvas) — anchors come from here, so they are deterministic.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};

  // ---------------------------------------------------------- channels
  // vector fields expand to two channels (x, y)
  var VEC = ['root', 'hip', 'head', 'hF', 'hB', 'fF', 'fB', 'muz', 'grab', 'wpn'];
  var SCAL = ['lean', 'bend', 'tilt', 'faF', 'faB', 'pen', 'sq', 'shr', 'haF', 'haB', 'pg', 'skirt', 'tail', 'arch'];
  var CH = {}, NCH = 0;
  VEC.forEach(function (k) { CH[k] = NCH; NCH += 2; });
  SCAL.forEach(function (k) { CH[k] = NCH++; });
  I.CH = CH; I.NCH = NCH; I.VEC = VEC; I.SCAL = SCAL;
  var NUMERIC = {};
  VEC.forEach(function (k) { NUMERIC[k] = 2; });
  SCAL.forEach(function (k) { NUMERIC[k] = 1; });
  I.NUMERIC = NUMERIC;

  // ---------------------------------------------------------- easing
  var EASE = I.EASE = {
    linear: function (u) { return u; },
    in: function (u) { return u * u; },
    out: function (u) { return 1 - (1 - u) * (1 - u); },
    inout: function (u) { return u * u * (3 - 2 * u); },
    in3: function (u) { return u * u * u; },
    out3: function (u) { var v = 1 - u; return 1 - v * v * v; },
    back: function (u) { var c = 1.9, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; },   // overshoot
    snap: function () { return 0; },          // hold this key until the next one
    hold: function () { return 0; }
  };

  // ---------------------------------------------------------- registry
  var ANIMS = I.ANIMS = {};      // ANIMS[char][name] = compiled anim
  var CHARS = I.CHARS = I.CHARS || {};

  function fillPose(charId, src) {
    var c = CHARS[charId];
    var base = c ? c.rest : {};
    var ch = new Float64Array(NCH), ds = {}, k;
    for (k in NUMERIC) {
      var v = src[k] !== undefined ? src[k] : base[k];
      if (v === undefined) v = NUMERIC[k] === 2 ? [0, 0] : 0;
      if (NUMERIC[k] === 2) { ch[CH[k]] = v[0]; ch[CH[k] + 1] = v[1]; } else ch[CH[k]] = v;
    }
    for (k in base) if (!NUMERIC[k]) ds[k] = base[k];
    for (k in src) if (!NUMERIC[k]) ds[k] = src[k];
    ds.has = {};    // which optional vectors were explicitly given
    ['muz', 'grab', 'wpn'].forEach(function (n) { ds.has[n] = src[n] !== undefined || base[n] !== undefined; });
    return { ch: ch, ds: ds };
  }

  // def = { segs: [[id, frames, loop?], ...] | [{id,f,loop}], step: 2,
  //         keys: [[time, pose, opts?], ...], walk: px/f (optional), alias: ... }
  // time: number (absolute authored frame) or 'segId' / 'segId+N'.
  // opts: ease name | { ease, step, hold }
  I.defAnim = function (charId, name, def) {
    var segs = def.segs.map(function (s) {
      return Array.isArray(s) ? { id: s[0], f: s[1], loop: !!s[2] } : { id: s.id, f: s.f, loop: !!s.loop };
    });
    var start = [], acc = 0;
    segs.forEach(function (s) { start.push(acc); acc += s.f; });
    var a = {
      name: name, char: charId, segs: segs, start: start, total: acc,
      loop: segs.some(function (s) { return s.loop; }),
      step: def.step || 2, walk: def.walk || 0, keys: segs.map(function () { return []; }),
      alias: def.alias || null, segMap: def.segMap || null, placeholder: !!def.placeholder,
      thumb: def.thumb, src: def
    };
    if (!def.alias) {
      (def.keys || []).forEach(function (k) {
        var t = k[0], si, lt;
        if (typeof t === 'string') {
          var m = /^([A-Za-z0-9_]+)\s*([+-]\s*\d+(?:\.\d+)?)?$/.exec(t);
          si = m ? segs.findIndex(function (s) { return s.id === m[1]; }) : -1;
          if (si < 0) { console.error('[rig] ' + charId + '.' + name + ': unknown segment in key time "' + t + '"'); return; }
          lt = m[2] ? parseFloat(m[2].replace(/\s/g, '')) : 0;
          if (lt < 0) lt += segs[si].f;
        } else {
          si = segs.length - 1;
          for (var i = 0; i < segs.length; i++) if (t < start[i] + segs[i].f) { si = i; break; }
          lt = t - start[si];
        }
        var o = k[2] || {};
        if (typeof o === 'string') o = { ease: o };
        var p = fillPose(charId, k[1] || {});
        a.keys[si].push({
          t: lt, ch: p.ch, ds: p.ds, ease: EASE[o.ease || 'inout'] || EASE.inout,
          hold: o.ease === 'snap' || o.ease === 'hold' || !!o.hold, step: o.step || 0
        });
      });
      a.keys.forEach(function (ks) { ks.sort(function (x, y) { return x.t - y.t; }); });
    }
    (ANIMS[charId] = ANIMS[charId] || {})[name] = a;
    return a;
  };

  // ---------------------------------------------------------- evaluation
  function prevKey(a, si) {     // last key before segment si
    for (var s = si - 1; s >= 0; s--) if (a.keys[s].length) return a.keys[s][a.keys[s].length - 1];
    return null;
  }
  function nextKeyAfter(a, si) {   // first key after segment si (+ distance offset)
    var off = a.segs[si].f;
    for (var s = si + 1; s < a.segs.length; s++) {
      if (a.keys[s].length) return { k: a.keys[s][0], t: off + a.keys[s][0].t };
      off += a.segs[s].f;
    }
    return null;
  }

  // write pose for segment si at local time t into out = { ch, ds }
  function evalSeg(a, si, t, out) {
    var seg = a.segs[si], ks = a.keys[si], k0 = null, t0 = 0, k1 = null, t1 = 0, i;
    if (seg.loop && seg.f > 0) { t = t % seg.f; if (t < 0) t += seg.f; }
    for (i = ks.length - 1; i >= 0; i--) if (ks[i].t <= t + 1e-9) { k0 = ks[i]; t0 = ks[i].t; break; }
    if (k0) {
      if (i + 1 < ks.length) { k1 = ks[i + 1]; t1 = ks[i + 1].t; }
      else if (seg.loop && ks.length) { k1 = ks[0]; t1 = seg.f + ks[0].t; }
      else { var nk = nextKeyAfter(a, si); if (nk) { k1 = nk.k; t1 = nk.t; } }
    } else {
      // before the first key of this segment: come from the previous segment's last key
      k0 = prevKey(a, si); t0 = 0;
      if (seg.loop && ks.length) { k0 = k0 || ks[ks.length - 1]; }
      if (ks.length) { k1 = ks[0]; t1 = ks[0].t; }
      else { var nk2 = nextKeyAfter(a, si); if (nk2) { k1 = nk2.k; t1 = nk2.t; } }
      if (!k0) { k0 = k1; k1 = null; }
    }
    if (!k0) { out.ch.fill(0); out.ds = {}; return; }
    var u = 0;
    if (k1 && !k0.hold && t1 > t0) {
      var step = k0.step || a.step;
      var tq = t0 + Math.floor((t - t0) / step + 1e-9) * step;
      u = k0.ease(Math.max(0, Math.min(1, (tq - t0) / (t1 - t0))));
    }
    var c0 = k0.ch, ch = out.ch;
    if (u === 0 || !k1) { for (i = 0; i < NCH; i++) ch[i] = c0[i]; }
    else { var c1 = k1.ch; for (i = 0; i < NCH; i++) ch[i] = c0[i] + (c1[i] - c0[i]) * u; }
    out.ds = k0.ds;
  }

  // resolve aliases: returns { a, si, t } in the real anim
  function resolve(a, si, t, depth) {
    if (!a.alias || depth > 4) return { a: a, si: si, t: t };
    var src = ANIMS[a.char][a.alias];
    if (!src) return { a: a, si: si, t: t };
    var seg = a.segs[si], u = seg.f > 0 ? t / seg.f : 0;
    if (seg.loop) u = u - Math.floor(u); else u = Math.max(0, Math.min(0.9999, u));
    var target = a.segMap && a.segMap[seg.id];
    var ti = src.segs.findIndex(function (s) { return s.id === (target || seg.id); });
    if (ti < 0 && a.segs.length === src.segs.length) ti = si;
    if (ti >= 0) return resolve(src, ti, u * src.segs[ti].f, depth + 1);
    // proportional over the whole source
    var g = (a.start[si] + u * seg.f) / Math.max(1, a.total) * src.total;
    var pos = locate(src, g, true);
    return resolve(src, pos.si, pos.t, depth + 1);
  }

  // absolute authored frame → segment + local time (setPose semantics:
  // loops absorb all later time; one-shots clamp to the end)
  function locate(a, frame, noLoop) {
    if (frame < 0) frame = 0;
    for (var i = 0; i < a.segs.length; i++) {
      var s = a.segs[i];
      if (s.loop && !noLoop) return { si: i, t: frame - a.start[i] };
      if (frame < a.start[i] + s.f) return { si: i, t: frame - a.start[i] };
    }
    var last = a.segs.length - 1;
    return { si: last, t: Math.max(0, a.segs[last].f - 1) };
  }
  I.locate = locate;

  I.evalAnim = function (a, si, t, out) {
    var r = resolve(a, si, t, 0);
    evalSeg(r.a, r.si, r.t, out);
    return r;
  };

  // ---------------------------------------------------------- solving
  function rot(x, y, deg) {
    var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [x * c - y * s, x * s + y * c];
  }
  I.rot = rot;

  // two-bone IK. returns [ex, ey, hx, hy] (elbow, end) — end clamped to reach
  function ik(ax, ay, tx, ty, l1, l2, bend) {
    var dx = tx - ax, dy = ty - ay, d = Math.sqrt(dx * dx + dy * dy);
    var maxd = l1 + l2 - 0.05, mind = Math.abs(l1 - l2) + 0.5;
    var ang = Math.atan2(dy, dx);
    if (d < 1e-6) { d = mind; }
    var dc = d > maxd ? maxd : (d < mind ? mind : d);
    var ca = (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc);
    ca = ca > 1 ? 1 : (ca < -1 ? -1 : ca);
    var al = Math.acos(ca) * (bend >= 0 ? 1 : -1);
    var ex = ax + Math.cos(ang + al) * l1, ey = ay + Math.sin(ang + al) * l1;
    var hx = ax + Math.cos(ang) * dc, hy = ay + Math.sin(ang) * dc;
    return [ex, ey, hx, hy];
  }
  I.ik = ik;

  function R0(v) { return Math.round(v); }

  // Solve pose → skeleton (integers). body = char body proportions.
  // out is a reusable object.
  I.solve = function (body, ch, ds, out) {
    var rx = ch[CH.root], ry = ch[CH.root + 1];
    var lean = ch[CH.lean], bend = ch[CH.bend], sq = ch[CH.sq];
    var hx = ch[CH.hip] + rx, hy = ch[CH.hip + 1] + ry;
    out.lean = lean; out.chestAng = lean + bend;
    out.pel = [R0(hx), R0(hy)];
    var w = rot(0, -body.waist, lean);
    out.waist = [R0(hx + w[0]), R0(hy + w[1])];
    var c = rot(0, -(body.spine - body.waist - sq), lean + bend);
    var cx = hx + w[0] + c[0], cy = hy + w[1] + c[1];
    out.chest = [R0(cx), R0(cy)];
    var shr = ch[CH.shr];
    var n = rot(0, -body.neck, lean + bend * 0.5);
    var nx = cx + n[0] + ch[CH.head], ny = cy + n[1] + ch[CH.head + 1];
    out.neck = [R0(nx), R0(ny)];
    var tilt = ch[CH.tilt];
    out.headAng = tilt;
    // shoulders
    var sF = rot(body.shF[0], body.shF[1] - shr, lean + bend), sB = rot(body.shB[0], body.shB[1] - shr, lean + bend);
    var sFx = cx + sF[0], sFy = cy + sF[1], sBx = cx + sB[0], sBy = cy + sB[1];
    out.shF = [R0(sFx), R0(sFy)]; out.shB = [R0(sBx), R0(sBy)];
    var aF = ik(sFx, sFy, ch[CH.hF] + rx, ch[CH.hF + 1] + ry, body.upper, body.fore, ds.elF == null ? 1 : ds.elF);
    var aB = ik(sBx, sBy, ch[CH.hB] + rx, ch[CH.hB + 1] + ry, body.upper, body.fore, ds.elB == null ? 1 : ds.elB);
    out.elF = [R0(aF[0]), R0(aF[1])]; out.haF = [R0(aF[2]), R0(aF[3])];
    out.elB = [R0(aB[0]), R0(aB[1])]; out.haB = [R0(aB[2]), R0(aB[3])];
    out.handAngF = ds.haFset ? ch[CH.haF] : Math.atan2(aF[3] - aF[1], aF[2] - aF[0]) * 180 / Math.PI + ch[CH.haF];
    out.handAngB = ds.haBset ? ch[CH.haB] : Math.atan2(aB[3] - aB[1], aB[2] - aB[0]) * 180 / Math.PI + ch[CH.haB];
    // hips & legs
    var pF = rot(body.hipF[0], body.hipF[1], lean * 0.6), pB = rot(body.hipB[0], body.hipB[1], lean * 0.6);
    var hFx = hx + pF[0], hFy = hy + pF[1], hBx = hx + pB[0], hBy = hy + pB[1];
    out.hipF = [R0(hFx), R0(hFy)]; out.hipB = [R0(hBx), R0(hBy)];
    var faF = ch[CH.faF], faB = ch[CH.faB];
    var fFx = ch[CH.fF] + rx, fFy = ch[CH.fF + 1] + ry, fBx = ch[CH.fB] + rx, fBy = ch[CH.fB + 1] + ry;
    var oF = rot(0, -body.ankle, faF), oB = rot(0, -body.ankle, faB);
    var lF = ik(hFx, hFy, fFx + oF[0], fFy + oF[1], body.thigh, body.shin, ds.knF == null ? -1 : ds.knF);
    var lB = ik(hBx, hBy, fBx + oB[0], fBy + oB[1], body.thigh, body.shin, ds.knB == null ? -1 : ds.knB);
    out.knF = [R0(lF[0]), R0(lF[1])]; out.anF = [R0(lF[2]), R0(lF[3])];
    out.knB = [R0(lB[0]), R0(lB[1])]; out.anB = [R0(lB[2]), R0(lB[3])];
    // sole point follows the (possibly clamped) ankle
    out.ftF = [R0(lF[2] - oF[0]), R0(lF[3] - oF[1])]; out.ftB = [R0(lB[2] - oB[0]), R0(lB[3] - oB[1])];
    out.faF = faF; out.faB = faB;
    out.pen = ch[CH.pen]; out.pg = ch[CH.pg];
    out.skirt = ch[CH.skirt]; out.tail = ch[CH.tail]; out.arch = ch[CH.arch];
    // optional explicit anchors
    out.muz = ds.has && ds.has.muz ? [R0(ch[CH.muz] + rx), R0(ch[CH.muz + 1] + ry)] : null;
    out.grab = ds.has && ds.has.grab ? [R0(ch[CH.grab] + rx), R0(ch[CH.grab + 1] + ry)] : null;
    out.wpn = ds.has && ds.has.wpn ? [R0(ch[CH.wpn] + rx), R0(ch[CH.wpn + 1] + ry)] : null;
    out.ds = ds;
    return out;
  };

  // ---------------------------------------------------------- pose helpers for authors
  // P(base, changes): shallow copy with overrides (vectors copied).
  I.P = function (base, ch) {
    var o = {}, k;
    for (k in base) o[k] = Array.isArray(base[k]) ? base[k].slice() : base[k];
    if (ch) for (k in ch) o[k] = Array.isArray(ch[k]) ? ch[k].slice() : ch[k];
    return o;
  };
  // shift the whole body except the feet (bob / crouch)
  I.bob = function (base, dx, dy, ch) {
    var o = I.P(base, null);
    ['hip', 'hF', 'hB'].forEach(function (k) { if (o[k]) o[k] = [o[k][0] + dx, o[k][1] + dy]; });
    return ch ? I.P(o, ch) : o;
  };
  // shift everything (hops)
  I.shift = function (base, dx, dy, ch) {
    var o = I.P(base, null);
    o.root = [(o.root ? o.root[0] : 0) + dx, (o.root ? o.root[1] : 0) + dy];
    return ch ? I.P(o, ch) : o;
  };
  // mirror-swap helpers are character specific; see anims files.
})();
