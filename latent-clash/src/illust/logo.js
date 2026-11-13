/* LATENT CLASH — ILLUST logo: 潜空间激斗 as custom chunky stroke glyphs + LATENT CLASH plate.
 * Hanzi are authored as stroke polylines on a 20×20 unit grid, rasterised at 2 px/unit as thick
 * square-capped bars (no AA), sheared to italic, then given banded fire-gold chrome. */
(function () {
  'use strict';
  var LC = window.LC, I = LC.illust, K = I.kit;
  var L = I.LOGO = {};

  // strokes per glyph: each is a polyline [x0,y0,x1,y1,...]; optional {w} width override as last item
  var HZ = {
    '潜': [[1.2, 1.6, 3, 3.6], [0.6, 7.2, 2.4, 9.2], [1, 18.6, 3.8, 12.4],
      [6.6, 2.6, 11.4, 2.6], [6, 6, 12.2, 6], [9, 0.4, 9, 6.4, 6.4, 10.2], [9.8, 7, 12.2, 9.6],
      [13.6, 2.6, 18.6, 2.6], [13, 6, 19.6, 6], [16.2, 0.4, 16.2, 6.4, 13.6, 10.2], [17, 7, 19.6, 10],
      [8, 12, 8, 19.6], [17.4, 12, 17.4, 19.6], [8, 12, 17.4, 12], [8, 15.8, 17.4, 15.8], [8, 19.4, 17.4, 19.4]],
    '空': [[10, 0, 10, 2.2], [2.4, 6.6, 2.4, 3.6, 17.6, 3.6, 17.6, 6.6], [8, 6.4, 5, 10], [12, 6.4, 15.2, 10],
      [4.6, 12.2, 15.4, 12.2], [10, 12.2, 10, 18.6], [1.6, 18.8, 18.4, 18.8]],
    '间': [[3, 0.4, 4.6, 2.6], [2.4, 4.4, 2.4, 19.8], [7, 2.4, 17.6, 2.4, 17.6, 19, 15, 19],
      [7.2, 7, 7.2, 16.2], [13, 7, 13, 16.2], [7.2, 7, 13, 7], [7.2, 11.6, 13, 11.6], [7.2, 16, 13, 16]],
    '激': [[0.8, 1.8, 2.4, 3.6], [0.4, 7.2, 2, 9], [0.6, 18.6, 3.2, 12.6],
      [8.2, 0, 7.4, 1.6], [5.4, 2.2, 5.4, 8.2], [10.4, 2.2, 10.4, 8.2], [5.4, 2.2, 10.4, 2.2], [5.4, 5.2, 10.4, 5.2], [5.4, 8.2, 10.4, 8.2],
      [8, 9.4, 8, 10.6], [4.4, 11.6, 11.6, 11.6], [7.2, 11.6, 7.2, 14.4, 11.2, 14.4, 11.2, 19, 9.6, 19.6], [7, 14.6, 5, 19.4],
      [14.6, 0, 13.2, 5.4], [13.8, 3.6, 19.6, 3.6], [17.8, 3.6, 13.4, 19.4], [14.6, 10, 19.6, 19.2]],
    '斗': [[5, 3, 7.4, 5.4], [3.8, 8.2, 6.2, 10.6], [1.6, 13.6, 18.4, 12.2], [13.6, 0.2, 13.6, 19.8]]
  };
  L.HZ = HZ;

  // thick square-capped polyline into mask m (pixel coords)
  function thick(P, pts, hw) {
    var m = P.mask();
    for (var i = 0; i + 3 < pts.length; i += 2) {
      var x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
      var dx = x1 - x0, dy = y1 - y0, l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l * hw, uy = dy / l * hw;
      K.fillPoly(m, [x0 - ux - uy, y0 - uy + ux, x1 + ux - uy, y1 + uy + ux, x1 + ux + uy, y1 + uy - ux, x0 - ux + uy, y0 - uy - ux]);
    }
    return m;
  }
  L.glyphMask = function (P, ch, ox, oy, scale, hw, slant, baseY) {
    var m = P.mask();
    (HZ[ch] || []).forEach(function (st) {
      var q = [];
      for (var i = 0; i < st.length; i += 2) {
        var y = oy + st[i + 1] * scale;
        q.push(ox + st[i] * scale + (baseY - y) * slant, y);
      }
      m = m.or(thick(P, q, hw));
    });
    return m;
  };

  function table(list) { return [[0, 0, 0, 0]].concat(list.map(function (c) { var v = K.rgb(c.slice(0, 7)); return [v[0], v[1], v[2], c.length > 7 ? parseInt(c.slice(7), 16) : 255]; })); }

  L.build = function () {
    var W = 240, H = 90;
    var cv = K.canvas(W, H), ctx = cv.getContext('2d');
    var P = K.painter(W, H);

    // ---- hanzi row (fire-gold chrome, extruded)
    var HP = K.painter(W, 60), hm = HP.mask(), chars = ['潜', '空', '间', '激', '斗'];
    var sc = 2, gw = 40, gap = 4, x0 = 9, y0 = 7, slant = 0.16;
    chars.forEach(function (ch, i) { hm = hm.or(L.glyphMask(HP, ch, x0 + i * (gw + gap), y0, sc, 2.4, slant, y0 + 40)); });
    var hz = I.TYPE.paint({ mask: hm, top: y0, gh: 41 }, {
      bands: ['#fffbe6', '#fff0a0', '#ffd84a', '#ffaa2a', '#f06a1c', '#d8402a', '#ff7a3a', '#ffb04a'],
      hi: '#ffffff', lo: '#8a1e18', o1: '#5a1420', o2: '#12060e', sh: '#05040ab0'
    }, { o1: 1, o2: 1, shadow: [2, 2], extrude: 3, exColor: '#7a1c22' });
    ctx.drawImage(hz, 0, 0);

    // ---- accents behind: orange starburst (top left), blue whale fluke (top right)
    var SB = [1, 0.58, 0.86, 0.5, 1, 0.62, 0.8, 0.55];
    var star = I.starburst(P, 12, 12, 13, -0.2, SB), star2 = I.starburst(P, 12, 12, 8, -0.2, SB);
    var fl = I.fluke(P, 226, 15, -Math.PI / 2 + 0.3, 1.15).or(P.sr([222, 27, 224, 21, 226, 16], 5, 3));
    // 1 outline dark, 2 orange deep, 3 orange, 4 orange light, 5 white, 6 blue deep, 7 blue, 8 blue light
    P.fill(star.grow(1).or(fl.grow(1)).grow(1), 9); P.fill(star.grow(1), 1); P.fill(star, 2); P.fill(K.inner(star), 3); P.fill(star2, 4); P.fill(I.starburst(P, 12, 12, 3.5, -0.2, SB), 5);
    P.fill(fl.grow(1), 1); P.fill(fl, 6); P.fill(K.inner(fl), 7); P.fill(fl.band(-2, 2).and(K.inner(fl)), 8);
    ctx.drawImage(P.canvas(table(['#1a0d1e', '#c2482e', '#ff9e6b', '#ffd9a0', '#fff8e8', '#222c85', '#4d6bfe', '#a9c0ff', '#05040a'])), 0, 0);

    // ---- LATENT CLASH on a split orange/blue slanted plate
    var PL = K.painter(W, 34), plate = PL.poly([14, 2, 236, 2, 228, 31, 6, 31]);
    var half = PL.poly([0, 0, 127, 0, 119, 34, 0, 34]);
    PL.fill(plate.grow(1), 1);
    PL.fill(plate.and(half), 2); PL.fill(plate.sub(half), 3);
    var top2 = plate.band(0, 2);
    PL.fill(top2.and(half), 4); PL.fill(top2.sub(half), 5);
    PL.fill(plate.band(0, -2).and(half), 6); PL.fill(plate.band(0, -2).sub(half), 7);
    ctx.drawImage(PL.canvas(table(['#0b0a14', '#c2482e', '#3346c9', '#ff9e6b', '#7d95ff', '#7e2418', '#1a2470'])), 0, 56);
    var en = I.TYPE.word('LATENT CLASH', 3, 'silver', { gap: 1, slant: 0.2, o1: 1, o2: 1, shadow: [2, 2] });
    ctx.drawImage(en, ((W - en.width) >> 1) - 1, 59);
    return cv;
  };
})();
