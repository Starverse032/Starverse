/* LATENT CLASH — RIG shared character helpers (both girls use these). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var M = I.MAT, col = I.col, OX = I.OX, OY = I.OY, BW = I.BW, BH = I.BH;
  var H = I.H = {};

  H.rot = function (x, y, deg) {
    var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [x * c - y * s, x * s + y * c];
  };
  // point in a frame: origin o, angle deg
  H.fr = function (o, deg, x, y) { var v = H.rot(x, y, deg); return [o[0] + v[0], o[1] + v[1]]; };
  H.lerp = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  H.flat = function (list) { var o = []; for (var i = 0; i < list.length; i++) o.push(list[i][0], list[i][1]); return o; };

  // iterate pixels (buffer index) whose centres are inside polygon pts
  H.forPoly = function (pts, cb) {
    var n = pts.length >> 1, miny = 1e9, maxy = -1e9, i, j, xs = [];
    for (i = 0; i < n; i++) { var y = pts[i * 2 + 1]; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    for (var py = Math.ceil(miny - 1e-4); py <= Math.floor(maxy + 1e-4); py++) {
      xs.length = 0;
      for (i = 0; i < n; i++) {
        j = (i + 1) % n;
        var ay = pts[i * 2 + 1], by = pts[j * 2 + 1];
        if ((ay <= py && by > py) || (by <= py && ay > py)) xs.push(pts[i * 2] + (py - ay) / (by - ay) * (pts[j * 2] - pts[i * 2]));
      }
      xs.sort(function (a, b) { return a - b; });
      for (var q = 0; q + 1 < xs.length; q += 2) {
        for (var x = Math.ceil(xs[q] - 1e-4); x <= Math.floor(xs[q + 1] + 1e-4); x++) {
          var bx = x + OX, by2 = py + OY;
          if (bx < 1 || by2 < 1 || bx >= BW - 1 || by2 >= BH - 1) continue;
          cb(by2 * BW + bx, x, py);
        }
      }
    }
  };
  // recolour scratch pixels of material `from` to `to` (same tone) inside a polygon
  H.recolor = function (p, pts, from, to, dither) {
    var s = p.s, f0 = 2 + from * 4, t0 = 2 + to * 4;
    H.forPoly(pts, function (i, x, y) {
      var c = s[i];
      if (c < f0 || c > f0 + 3) return;
      if (dither && ((x + y) & 1)) return;
      s[i] = t0 + (c - f0);
    });
  };

  // a ribbon (hair lock, cloth strip) through points with half-widths
  // returns the outline polygon (flat) — left side down, right side up
  H.ribbon = function (pts, w, tipPoint) {
    var n = pts.length, L = [], Rr = [];
    for (var i = 0; i < n; i++) {
      var a = pts[i > 0 ? i - 1 : 0], b = pts[i < n - 1 ? i + 1 : n - 1];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / l, ny = dx / l, ww = Array.isArray(w) ? w[Math.min(i, w.length - 1)] : w;
      L.push([pts[i][0] + nx * ww, pts[i][1] + ny * ww]);
      Rr.push([pts[i][0] - nx * ww, pts[i][1] - ny * ww]);
    }
    var out = L.slice();
    if (tipPoint) out.push(tipPoint);
    for (i = n - 1; i >= 0; i--) out.push(Rr[i]);
    return H.flat(out);
  };

  // chain points (snapped) as [[x,y],...]
  H.chainPts = function (ch, dx, dy) {
    var o = [];
    for (var i = 0; i < ch.n; i++) o.push([ch.qx[i] + (dx || 0), ch.qy[i] + (dy || 0)]);
    return o;
  };
  // smooth a polyline by inserting midpoints (Chaikin, 1 pass)
  H.chaikin = function (pts) {
    if (pts.length < 3) return pts;
    var o = [pts[0]];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    o.push(pts[pts.length - 1]);
    return o;
  };

  // ------------------------------------------------------------- heads
  // set = { base, eyes: { name: img }, mouth: { name: img }, eyeAt: [x,y], mouthAt: [x,y], skinSet }
  H.headImage = function (set, eyes, mouth, extra, ang) {
    var q = ang === 0 ? 0 : Math.round(ang / 5) * 5;
    var key = eyes + '|' + mouth + '|' + (extra || '') + '|' + q;
    var c = set.cache[key];
    if (c) return c;
    // features: [img, x, y] in unrotated head coordinates
    var feats = [];
    var e = set.eyes[eyes] || set.eyes.open;
    if (e) feats.push([e, set.eyeAt[0] + (e.dx || 0), set.eyeAt[1] + (e.dy || 0)]);
    var m = set.mouth[mouth] || set.mouth.neutral;
    if (m) feats.push([m, set.mouthAt[0] + (m.dx || 0), set.mouthAt[1] + (m.dy || 0)]);
    if (extra && set.extras) {
      extra.split(',').forEach(function (n) { var x = set.extras[n]; if (x) feats.push([x.img, x.at[0], x.at[1]]); });
    }
    var img, i;
    if (q % 90 === 0) {
      // exact rotation of the composed head
      img = set.base;
      for (i = 0; i < feats.length; i++) img = I.overlay(img, feats[i][0], feats[i][1], feats[i][2], null);
      img = I.rotate(img, q);
    } else {
      // RotSprite the base only; keep the tiny features upright, placed at
      // their rotated positions (rotating 1-px eyes destroys them)
      var bk = 'base|' + q;
      var base = set.cache[bk] || (set.cache[bk] = I.rotate(set.base, q));
      img = base;
      var r = q * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
      for (i = 0; i < feats.length; i++) {
        var f = feats[i][0], cx = feats[i][1] + f.w / 2 - set.base.px - 0.5, cy = feats[i][2] + f.h / 2 - set.base.py - 0.5;
        var nx = cx * cs - cy * sn, ny = cx * sn + cy * cs;
        img = I.overlay(img, f, Math.round(base.px + 0.5 + nx - f.w / 2), Math.round(base.py + 0.5 + ny - f.h / 2), null);
      }
    }
    set.cache[key] = img;
    return img;
  };

  // ------------------------------------------------------------- hands
  // Hand-made stamps, authored pointing right (0°) and down-right (45°), wrist at
  // the pivot; the other 6 directions are exact 90° rotations / mirrors.
  // Codes: G/g = glove (or skin) light/shade, k/q = skin (fingers) light/shade.
  var HANDS = {
    fist: { a0: ['.Gk.', 'GGkk', 'GgkQ', '.gq.'], p0: [0, 1],
            a45: ['GG..', 'GGk.', '.kkk', '.kkq', '..q.'], p45: [0, 0] },
    open: { a0: ['..k..', 'GGkkk', 'GGkkq', '.gq..'], p0: [0, 1],
            a45: ['GG...', 'GGk..', '.kkk.', '..kkq', '...q.'], p45: [0, 0] },
    flat: { a0: ['..kk', '..kk', 'GGkk', 'GGkq', '.gq.'], p0: [0, 2],
            a45: ['.kk..', 'GGkk.', 'GGkq.', '.gq..'], p45: [0, 1] },
    relax: { a0: ['.Gk.', 'GGkk', '.qq.'], p0: [0, 1],
             a45: ['GG.', 'GGk', '.kq', '.q.'], p45: [0, 0] },
    point: { a0: ['.Gk...', 'GGkkkk', 'GGkq..', '.gq...'], p0: [0, 1],
             a45: ['GG...', 'GGk..', '.kkk.', '..q.k', '.....'], p45: [0, 0] }
  };
  HANDS.grip = HANDS.fist;
  var handCache = {};
  function handImg(shape, dir, skin, glove) {
    var key = shape + dir + '|' + skin + '|' + glove;
    if (handCache[key]) return handCache[key];
    var hs = HANDS[shape] || HANDS.fist;
    var lg = { 'G': col(glove, 1), 'g': col(glove, 2), 'k': col(skin, 1), 'q': col(skin, 2), 'Q': col(skin, 3), 'K': col(skin, 0) };
    var b0 = I.parseArt(hs.a0, lg, hs.p0[0], hs.p0[1]), b45 = I.parseArt(hs.a45, lg, hs.p45[0], hs.p45[1]);
    var img, flip = false;
    switch (dir) {
      case 0: img = b0; break;
      case 1: img = b45; break;
      case 2: img = I.rotate(b0, 90); break;
      case 3: img = b45; flip = true; break;
      case 4: img = b0; flip = true; break;
      case 5: img = I.rotate(b45, 270); flip = true; break;
      case 6: img = I.rotate(b0, 270); break;
      default: img = I.rotate(b45, 270);
    }
    return (handCache[key] = { img: img, flip: flip });
  }
  // hand at the wrist point `at`, forearm direction ang (deg). shape: fist|grip|open|flat|relax|point
  H.hand = function (p, at, ang, shape, skin, glove) {
    var dir = ((Math.round(ang / 45) % 8) + 8) % 8;
    var h = handImg(shape || 'fist', dir, skin, glove == null ? skin : glove);
    p.blit(h.img, Math.round(at[0]), Math.round(at[1]), h.flip);
  };

  // ------------------------------------------------------------- smear
  // smear.pts = [bx,by,tx,ty, ...] base→tip pairs along the motion (old → new)
  H.smear = function (p, sm, mat, opts) {
    if (!sm) return;
    var pts = sm.pts, n = pts.length / 4, i;
    opts = opts || {};
    var inner = opts.inner == null ? 0.62 : opts.inner;     // fraction of the limb covered
    for (i = 0; i < n - 1; i++) {
      var b0 = [pts[i * 4], pts[i * 4 + 1]], t0 = [pts[i * 4 + 2], pts[i * 4 + 3]];
      var b1 = [pts[i * 4 + 4], pts[i * 4 + 5]], t1 = [pts[i * 4 + 6], pts[i * 4 + 7]];
      var m0 = H.lerp(b0, t0, inner), m1 = H.lerp(b1, t1, inner);
      var tone = i >= n - 3 ? 0 : (i >= n - 4 ? 1 : 2);
      var poly = H.flat([m0, t0, t1, m1]);
      p.poly(poly, mat, null, tone);
      // bright leading rim along the tip path
      p.line(Math.round(t0[0]), Math.round(t0[1]), Math.round(t1[0]), Math.round(t1[1]), col(mat, i >= n - 3 ? 0 : 1));
    }
    // streak gaps toward the oldest end so it breaks up
    if (n > 3) {
      var a = [pts[0], pts[1]], b = [pts[2], pts[3]];
      for (var k = 0; k < 3; k++) {
        var q = H.lerp(a, b, 0.55 + k * 0.15);
        p.px(Math.round(q[0]), Math.round(q[1]), 0);
      }
    }
  };
})();
