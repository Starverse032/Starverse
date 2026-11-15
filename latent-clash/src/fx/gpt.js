/* LATENT CLASH — FX: GPT 娘 shared bakes + spawn effects (owned by FX).
 * Visual language: cold teal-white dragon-fire (palette 1: violet), luminous dragon scales,
 * three-claw arcs, attention grids. Never warm script/sunbursts (claude) or water (deepseek).
 *  I.GPT[pal]   colour sets + baked scale sprites (shared with gpt-super / gpt-backdrop / gpt-breath)
 *  K_SCALE      fluttering scale particle (4 flip frames, flicker-out)
 * Spawn: gpt.scales, gpt.clawHit, gpt.breathCast, gpt.riseTrail, gpt.callSlam, gpt.roarRing. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var G = I.GPT = I.GPT || [{}, {}];
  function lay(O, d) { return O.layer == null ? d : O.layer; }
  function mixu(a, b, t) { return I.col(I.mix(a, b, t)); }

  /** Colour sets per palette (css strings in .c*, packed ints in .u*). */
  function colours(pal) {
    var sc = I.scheme('gpt', pal), P = LC.PAL.gpt[pal], A = P.accent, S = P.scale, dk = sc.deep;
    var g = G[pal];
    g.L = sc.light.css; g.Lu = sc.light.u;                      // white, A0..A3, deep
    g.S = S; g.Su = S.map(I.col);
    // spectral (heads, claws): white -> pale -> accent; outline = deep accent
    g.spec = ['#ffffff', I.mix('#ffffff', A[0], 0.55), A[0], I.mix(A[0], A[1], 0.5), A[1], A[2]];
    g.specU = g.spec.map(I.col);
    g.dk = dk; g.dkU = I.col(dk); g.out = P.outline;
    g.fire = ['#ffffff', A[0], A[1], A[2], A[3], dk];            // flame layers, hot -> edge
    g.fireU = g.fire.map(I.col);
    g.twk = sc.glow.css;                                         // twinkles
    g.ember = [A[0], A[1], A[2], A[3]];
    g.dust = pal === 0 ? ['#eef2f6', '#c9cfdc', '#9aa2b8', '#6c7290', '#474a66'] : ['#c8c2dc', '#9a94b4', '#6c6688', '#47425f', '#2a2640'];
    g.rock = [mixu(S[1], '#8a8494', 0.5), mixu(S[2], '#5a5468', 0.5), mixu(S[3], '#2a2636', 0.5)];
  }

  // ---- luminous scale sprites: 4 flutter frames (face, turning, edge glint, back) x 2 sizes --
  // shape masks (1 = body); outline added; highlight top-left, ridge down the middle.
  var SM = [
    ['.###.', '#####', '#####', '#####', '.###.', '..#..'],
    ['.##.', '####', '####', '####', '.##.', '..#.'],
    ['#', '#', '#', '#', '#', '.'],
    ['.##.', '####', '####', '####', '.##.', '.#..']
  ];
  var SB = [
    ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
    ['.###.', '#####', '#####', '#####', '#####', '.###.', '..#..', '.....'],
    ['.#.', '###', '###', '###', '###', '.#.', '.#.', '...'],
    ['.###.', '#####', '#####', '#####', '#####', '.###.', '.#...', '.....']
  ];
  function scaleAnim(masks, fillU, hiU, rimU, backU, outU) {
    var w = 11, h = 12;
    return I.anim(w, h, 4, 5, 5, function (b, f) {
      var m = masks[f], mh = m.length, mw = m[0].length, x0 = Math.floor((w - mw) / 2), y0 = 2;
      for (var y = 0; y < mh; y++) for (var x = 0; x < mw; x++) {
        if (m[y].charAt(x) !== '#') continue;
        var c = f === 3 ? backU : fillU;
        if (f === 2) c = y < 2 ? hiU : fillU;
        else if ((y <= 1 && x <= mw / 2) || (x === 0 && y < 3)) c = f === 3 ? fillU : hiU;
        else if (mw > 3 && x === Math.floor(mw / 2) && y > 1 && y < mh - 2) c = rimU;
        b.set(x0 + x, y0 + y, c);
      }
      b.outline(outU);
    });
  }

  function bakeShared() {
    [0, 1].forEach(function (pal) {
      colours(pal);
      var g = G[pal], s = g.specU, P = LC.PAL.gpt[pal];
      // luminous (magic) scales: pale accent body, white glint, accent ridge, deep outline
      g.scl = [scaleAnim(SM, s[2], s[0], s[4], s[4], g.dkU), scaleAnim(SB, s[2], s[0], s[4], s[4], g.dkU)];
      // body scales (her own scale ramp): shards for the slam
      var Su = g.Su;
      g.shard = [scaleAnim(SM, Su[1], Su[0], Su[2], Su[2], I.col(P.outline)), scaleAnim(SB, Su[1], Su[0], Su[2], Su[2], I.col(P.outline))];
    });
  }
  I.onInit('gpt-shared', bakeShared);

  /** Draw a luminous scale at screen (x,y): big 0|1, frame 0..3. */
  I.gptScale = function (ctx, pal, big, f, x, y) { I.drawAnim(ctx, G[pal].scl[big], f & 3, x, y, 1); };

  // ---- K_SCALE: fluttering scale; p.A = anim, p.e = sway phase, p.fd = ticks per flip frame --
  I.K_SCALE = I.kind('gptScale', {
    draw: function (ctx, p, sx, sy) {
      var k = p.age / p.life;
      if (k > 0.72 && ((p.age + p.seq) & 1)) return;          // flicker out
      I.drawAnim(ctx, p.A, (p.f0 + Math.floor(p.age / p.fd)) & 3, sx, sy, 1);
    },
    step: function (p) { p.vx += Math.sin(p.age * 0.21 + p.e) * p.d; }
  });
  function scale(x, y, vx, vy, life, A, layer, delay) {
    var p = I.add(I.K_SCALE, x, y, layer);
    p.vx = vx; p.vy = vy; p.life = life; p.A = A; p.g = 0.045; p.drag = 0.94;
    p.fd = I.RI(2, 4); p.f0 = I.RI(0, 3); p.e = I.R() * TAU; p.d = 0.05; p.delay = delay | 0;
    return p;
  }
  I.gptScaleP = scale;

  I.def('gpt.scales', function (x, y, O) {
    var g = G[O.pal], L = lay(O, I.FRONT), n = I.nOf(14, O);
    for (var i = 0; i < n; i++) {
      var a = -PI / 2 + I.RS() * 1.9, v = I.RR(1.2, 3.6);
      scale(x + I.RS() * 6, y + I.RS() * 6, Math.cos(a) * v, Math.sin(a) * v - 0.6, I.RI(36, 60), g.scl[i % 3 === 0 ? 1 : 0], L, i % 4);
    }
    for (i = 0; i < I.nOf(5, O); i++) I.twinkle(x + I.RS() * 16, y + I.RS() * 14, I.RI(2, 3), I.RI(10, 16), g.twk, L, I.RI(0, 10));
  }, { desc: 'Burst of 8-14 luminous teal-white dragon scales that pop up, flutter (4 flip frames incl. an edge-on glint) and drift down, + twinkles; ~60f. palette 1 = violet.', use: 'Accent: her hits, landings, wing buffets, intro/win. Anywhere, facing irrelevant.' });
})();
