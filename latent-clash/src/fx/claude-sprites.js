/* LATENT CLASH — FX: Claude 娘 stateless sprites (owned by FX).
 * claude.spark (projectile), claude.guardrail (hex barrier), claude.beam
 * (MAGNUM OPUS glyph beam), claude.book (floating tome). All baked per
 * palette in init(); drawSprite is a pure function of t + opts. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var A = I.A = I.A || {};
  var CS = [{}, {}];

  /** Mirror helper: run fn with the context reflected around screen x = sx when facing < 0. */
  function mirrored(ctx, sx, facing, fn) {
    if (facing >= 0) { fn(); return; }
    ctx.save(); ctx.translate(sx * 2, 0); ctx.scale(-1, 1); fn(); ctx.restore();
  }
  I.mirrored = mirrored;

  var BEAM_TEXT = ['HELPFUL HONEST HARMLESS * ', 'ONCE UPON A TIME IN LATENT SPACE * ', 'THINK STEP BY STEP * ', 'TO BE OR NOT TO BE * ', 'ONE MILLION TOKENS OF CONTEXT * '];

  function bake() {
    [0, 1].forEach(function (pal) {
      var sc = I.scheme('claude', pal), L = sc.light.u, P = sc.paper.u, K = sc.ink.u, G = sc.gold.u, C = CS[pal];

      // ---- SPARK projectile: 16 rotations x 2 pulse states, 26x26 ----
      C.spark = I.anim(26, 26, 32, 13, 13, function (b, f) {
        var rot = (f % 16) * TAU / 16, pulse = f >= 16 ? 1 : 0, cx = 13, cy = 13;
        I.clipStar(b, cx, cy, 10.5 + pulse, 3.2, rot, L[2]);
        b.outline(L[5]);
        var halo = new I.Buf(26, 26); halo.ring(cx, cy, 10, 12, L[3]); halo.breakup(0.3, f, 0);
        for (var i = 0; i < halo.d.length; i++) if (halo.d[i] && !b.d[i]) b.d[i] = halo.d[i];
        I.clipStar(b, cx, cy, 6.5 + pulse * 0.5, 2.2, rot, L[1]);
        b.disc(cx, cy, 2.2 + pulse * 0.9, L[0]);
      });

      // ---- GUARDRAIL hex barrier: 6 appear + 24 loop + 6 end frames, 44x64 ----
      var GW = 44, GH = 64, pcx = 18, top = 4, bot = 60, mid = 32;
      var mask = new I.Buf(GW, GH), cell = new Int16Array(GW * GH).fill(-1), centres = [];
      for (var r = -1, row = 0; r * 8 < GH + 8; r++, row++) for (var q = -1; q < 5; q++) centres.push([q * 9 + (row % 2 ? 4.5 : 0) + 4, r * 8 + 4]);
      function shift(y) { var u = (y - mid) / (mid - top); return -Math.round(u * u * 4); }
      for (var y = top; y < bot; y++) {
        var cut = Math.max(0, 7 - (y - top), 7 - (bot - 1 - y)), x0 = pcx - 12 + cut, x1 = pcx + 12 - cut;
        for (var x = x0; x <= x1; x++) {
          var X = x + shift(y);
          mask.set(X, y, 1);
          var best = 1e9, bi = -1;
          for (var k = 0; k < centres.length; k++) { var dx = x - (pcx - 12) - centres[k][0], dy = y - centres[k][1], d = dx * dx + dy * dy * 1.3; if (d < best) { best = d; bi = k; } }
          if (X >= 0 && X < GW) cell[y * GW + X] = bi;
        }
      }
      function isEdge(x, y) {
        var c = cell[y * GW + x];
        return (x + 1 < GW && cell[y * GW + x + 1] !== c && cell[y * GW + x + 1] >= 0) || (y + 1 < GH && cell[(y + 1) * GW + x] !== c && cell[(y + 1) * GW + x] >= 0);
      }
      function cellY(c) { return centres[c] ? centres[c][1] : 0; }
      function panel(b, f, mode, amt) {
        var scan = (f * 3) % 84 - 12;
        for (var yy = 0; yy < GH; yy++) for (var xx = 0; xx < GW; xx++) {
          if (!mask.d[yy * GW + xx]) continue;
          var c = cell[yy * GW + xx], edge = isEdge(xx, yy), border = !mask.get(xx - 1, yy) || !mask.get(xx + 1, yy) || !mask.get(xx, yy - 1) || !mask.get(xx, yy + 1);
          var hl = I.hash(c * 7 + Math.floor(f / 4) * 131) < 0.18, sc2 = Math.abs(yy - scan) <= 1;
          if (mode === 'appear' && Math.abs(cellY(c) - mid) > amt) { if (border && Math.abs(yy - mid) <= amt + 4) b.set(xx, yy, L[0]); continue; }
          var col = 0;
          if (border) col = sc2 ? L[0] : L[1];
          else if (edge) col = sc2 || hl ? L[0] : L[1];
          else {
            var dens = hl ? 0.62 : (I.hash(c + 999) < 0.5 ? 0.5 : 0.3);
            if (sc2) col = (xx + yy) & 1 ? L[0] : L[1];
            else if (I.bayer(xx, yy) < dens) col = hl ? L[1] : L[2];
          }
          if (mode === 'appear' && amt < 30 && (edge || border)) col = L[0];
          if (col) b.set(xx, yy, col);
        }
      }
      C.guard = I.anim(GW, GH, 36, -8, 62, function (b, f) {
        if (f === 0) { for (var i = 0; i < mask.d.length; i++) if (mask.d[i]) b.d[i] = L[0]; b.outline(L[2]); b.outline(L[5]); return; }
        if (f < 6) { panel(b, f, 'appear', (f - 1) * 8 + 4); b.outline(L[4]); return; }
        if (f < 30) { panel(b, f - 6, 'loop'); b.outline(L[4]); return; }
        var e = (f - 30) / 6, m = new I.Buf(GW, GH), kb = b;
        panel(m, f, 'loop'); m.outline(L[4]);
        m.breakup(function (x, y) { return 1 - e * 1.1 - (Math.abs(y - mid) / 40) * e; }, 0, f);
        kb.blit(m, 0, Math.round(-e * 3));
      });
      // flash version for claude.guardCatch (4f)
      A.grFlash = A.grFlash || [];
      A.grFlash[pal] = I.anim(GW, GH, 5, -8, 62, function (b, f) {
        if (f === 0) { for (var i = 0; i < mask.d.length; i++) if (mask.d[i]) b.d[i] = L[0]; b.outline(L[1]); b.outline(L[4]); }
        else if (f < 3) { panel(b, f, 'loop'); for (var j = 0; j < b.d.length; j++) if (b.d[j]) b.d[j] = f === 1 ? L[0] : L[1]; b.breakup(0.8 - f * 0.2, f, 0); }
        else { var m = new I.Buf(GW, GH); for (var yy = 0; yy < GH; yy++) for (var xx = 0; xx < GW; xx++) if (mask.get(xx, yy) && isEdge(xx, yy)) m.set(xx, yy, L[2]); m.breakup(0.5 - (f - 3) * 0.2, 0, f); b.blit(m, 0, 0); }
      });

      // ---- BEAM: body tiles (3 thickness levels x 4 wobble frames), 96 wide ----
      C.beamH = [22, 14, 7];
      C.beam = C.beamH.map(function (h, li) {
        var TH = 2 * h + 6, cy = h + 3, rng = I.bakeRng(70 + li);
        var dashes = [];
        for (var i = 0; i < 9; i++) dashes.push({ x: Math.floor(rng() * 96), l: 6 + Math.floor(rng() * 12), y: (rng() < 0.5 ? -1 : 1) * (0.32 + rng() * 0.3) });
        return I.anim(96, TH, 4, 0, cy, function (b, f) {
          for (var x = 0; x < 96; x++) {
            var w = Math.sin(TAU * x / 96 * 2 + f * PI / 2) * 1.0 + Math.sin(TAU * x / 96 * 5 - f * PI / 2) * 0.7;
            var hx = h + Math.round(w * (h / 22 + 0.3));
            for (var dy = -hx; dy <= hx; dy++) {
              var u = Math.abs(dy) / hx, c;
              if (u <= 0.17 || Math.abs(dy) <= (li === 2 ? 0 : 1)) c = L[0];
              else if (u <= 0.32) c = L[1];
              else if (u <= 0.62) c = L[2];
              else if (u <= 0.8) c = L[3];
              else if (u <= 0.9) c = L[4];
              else { if (I.bayer(x + f, dy + cy) < (1 - u) * 5) c = L[3]; else continue; }
              b.set(x, cy + dy, c);
            }
          }
          if (li < 2) dashes.forEach(function (d) {
            var yy = cy + Math.round(d.y * h);
            for (var k = 0; k < d.l; k++) b.set((d.x + k) % 96, yy, k < 2 ? L[1] : L[0]);
          });
        });
      });
      // glyph strips (cream glyphs that flow inside the orange body)
      C.strips = [0, 1, 2].map(function (si) {
        var txt = BEAM_TEXT[si] + BEAM_TEXT[(si + 3) % BEAM_TEXT.length], w = txt.length * 4;
        var b = new I.Buf(w, 5); I.text35(b, txt, 0, 0, si === 2 ? L[3] : L[0]);
        return { c: I.toCanvas(b), w: w };
      });
      // muzzle flare (6f loop) and shock ring
      C.muzzle = I.anim(40, 68, 6, 14, 34, function (b, f) {
        var cx = 14, cy = 34, pr = f % 3;
        b.ellipse(cx, cy, 9 + pr, 30 + pr, L[2]); b.ellipse(cx, cy, 6 + pr, 25, L[1]); b.ellipse(cx, cy, 3, 19 - pr, L[0]);
        I.clipStar(b, cx, cy, 16 + pr * 2, 5, f * 0.35, L[1]);
        b.disc(cx, cy, 6, L[0]); b.outline(L[4]);
        for (var i = 0; i < 4; i++) { var a = f * 0.5 + i * PI / 2; b.rect(cx + Math.cos(a) * 20, cy + Math.sin(a) * 30, 2, 2, L[1]); }
      });
      C.shock = C.beamH.map(function (h) {
        return I.anim(8, 2 * h + 14, 1, 4, h + 7, function (b) { b.ellRing(4, h + 7, 3.2, h + 6, 1.2, L[0]); var m = b.copy(); m.breakup(0.6); b.d = m.d; });
      });

      // ---- BOOK: 8 page-flip frames, 46x34 ----
      C.book = I.anim(46, 34, 8, 23, 17, function (b, f) {
        var cx = 23, sp = 23;   // spine x
        // halo
        var halo = new I.Buf(46, 34); halo.ellipse(cx, 16, 22, 15, L[3]); halo.breakup(0.22, f, 0); b.blit(halo, 0, 0);
        // cover (slate with gold corners), visible below the pages
        b.poly([sp, 27, 4, 23, 4, 11, sp, 14, 42, 11, 42, 23], K[1]);
        b.poly([sp, 25, 5, 21, 5, 10, sp, 13, 41, 10, 41, 21], K[2]);
        b.rect(4, 22, 2, 2, G[1]); b.rect(40, 22, 2, 2, G[1]);
        // page stacks
        b.poly([sp, 24, 6, 20, 6, 9, sp, 12], P[2]); b.poly([sp, 24, 40, 20, 40, 9, sp, 12], P[2]);
        b.poly([sp, 23, 6, 19, 7, 8, sp, 11], P[0]); b.poly([sp, 23, 40, 19, 39, 8, sp, 11], P[0]);
        for (var y = 11; y < 23; y++) { b.set(sp - 1, y, P[2]); b.set(sp, y, P[3]); b.set(sp + 1, y, P[2]); b.set(sp - 2, y, P[1]); b.set(sp + 2, y, P[1]); }
        // text lines (glowing)
        for (var ln = 0; ln < 4; ln++) {
          var yl = 11 + ln * 2.6;
          b.line(9, yl + 0.5, sp - 4, yl + 2.5, ln === f % 4 ? L[1] : L[2]);
          b.line(sp + 4, yl + 2.5, 37 - (ln === 3 ? 6 : 0), yl + 0.5, ln === (f + 2) % 4 ? L[1] : L[2]);
        }
        // turning page
        var th = (f / 7) * PI, ex = sp + Math.cos(th) * 15, lift = Math.sin(th) * 6;
        if (f > 0 && f < 7) b.poly([sp, 11, sp, 22, ex, 19 - lift, ex + (th < PI / 2 ? -1 : 1), 8 - lift], th < PI / 2 ? P[1] : P[0]);
        b.outline(L[1]);
        // light rays above
        for (var rr = 0; rr < 3; rr++) { var rx = 14 + rr * 9 + ((f + rr) % 2), hgt = 4 + ((f * 3 + rr * 5) % 4); b.rect(rx, 8 - hgt, 1, hgt, L[(f + rr) % 2 ? 1 : 0]); }
      });
    });
  }
  I.onInit('claude-sprites', bake);

  // ---- sprite definitions ----------------------------------------------------------
  I.defSprite('claude.spark', {
    desc: 'Spinning irregular 8-ray starburst projectile (~16 px) with pulsing core, dithered glow and trailing motes.',
    use: 'Every frame for the live projectile at its position; t = frames alive; opts.angle = travel angle (default along facing; airSpark e.g. 0.6).',
    info: { duration: 0, bbox: { x: -8, y: -8, w: 16, h: 16 } },
    draw: function (ctx, sx, sy, t, o) {
      var C = CS[o.pal], L = I.scheme('claude', o.pal).light.css;
      var ang = o.raw.angle != null ? +o.raw.angle : (o.facing > 0 ? 0 : PI);
      var bx = -Math.cos(ang), by = -Math.sin(ang), nx = -by, ny = bx;
      for (var k = 4; k >= 0; k--) {
        var d = 8 + k * 4 + (t % 4), wob = Math.sin(t * 0.5 + k * 1.7) * (1 + k * 0.4);
        ctx.fillStyle = L[k < 2 ? 1 : k < 4 ? 2 : 3];
        var s = k < 2 ? 2 : 1;
        ctx.fillRect(Math.round(sx + bx * d + nx * wob) - (s >> 1), Math.round(sy + by * d + ny * wob) - (s >> 1), s, s);
      }
      ctx.fillStyle = L[3];
      for (var j = 6; j < 14; j += 2) ctx.fillRect(Math.round(sx + bx * j), Math.round(sy + by * j), 1, 1);
      var spin = o.facing > 0 ? t : -t;
      var f = ((spin % 16) + 16) % 16 + (((t >> 2) & 1) ? 16 : 0);
      I.drawAnim(ctx, C.spark, f, sx, sy, 1);
    }
  });

  I.defSprite('claude.guardrail', {
    desc: 'Hex-panel barrier (~26x56) in front of her: dithered translucent cells, bright lattice, scan line, flickering cells; 6f appear.',
    use: 'Draw at the fighter ORIGIN with her facing; t = frames since the stance began (loops). For the end: opts.phase="end", t = frames since it ended (6f dissolve).',
    info: { duration: 0, bbox: { x: 13, y: -60, w: 26, h: 58 }, appear: 6, endFrames: 6 },
    draw: function (ctx, sx, sy, t, o) {
      var C = CS[o.pal], f;
      if (o.phase === 'end') { f = 30 + Math.min(5, o.u != null ? Math.floor(o.u * 6) : t); if (t > 5 && o.u == null) return; }
      else f = t < 6 ? t : 6 + ((t - 6) % 24);
      I.drawAnim(ctx, C.guard, f, sx, sy, o.facing);
    }
  });

  I.defSprite('claude.beam', {
    desc: 'MAGNUM OPUS beam: white-hot core, orange body bands, flowing energy dashes and rows of glyphs, shock rings, flared muzzle, ragged leading edge. Phases: charge (target line + gathering motes + orb), fire, fade (thins by power).',
    use: 'Each frame: drawSprite(ctx, "claude.beam", muzzleX, muzzleY, t, { facing, palette, length, phase, power }). Length = px from the muzzle to the leading edge (grow it ~40 px/f). charge: power = charge progress 0..1; fade: power 1 -> 0.',
    info: { duration: 0, bbox: { x: 0, y: -22, w: 384, h: 44 }, halfHeight: 22 },
    draw: function (ctx, sx, sy, t, o) {
      var C = CS[o.pal], L = I.scheme('claude', o.pal).light.css, len = Math.max(0, Math.round(o.length || 0));
      var phase = o.phase || 'fire', pw = o.power;
      mirrored(ctx, sx, o.facing, function () {
        if (phase === 'charge') {
          var reach = len || 300;
          ctx.fillStyle = L[(t >> 1) & 1 ? 1 : 2];
          for (var x = 10; x < reach; x += 6) if (I.hash(x * 3 + (t >> 1)) < 0.4 + pw * 0.5) ctx.fillRect(sx + x, sy, 4, 1);
          for (var k = 0; k < 16; k++) {
            var ph = (t * 0.05 + I.hash(k + 7)) % 1, r = 44 * (1 - ph), a = I.hash(k) * TAU;
            ctx.fillStyle = L[r < 12 ? 0 : r < 26 ? 1 : 2];
            var s = r < 20 ? 2 : 1;
            ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r * 0.8), s, s);
          }
          var orb = A.orbC && A.orbC['claude' + o.pal];
          if (orb) I.drawAnim(ctx, orb, Math.min(23, Math.floor(pw * 23)), sx, sy, 1);
          return;
        }
        var li = pw >= 0.7 ? 0 : pw >= 0.4 ? 1 : pw >= 0.14 ? 2 : 3;
        if (phase === 'fade' && pw < 0.3 && (t & 1)) li = Math.min(3, li + 1);
        if (li === 3) {   // last wisps: broken flickering line
          ctx.fillStyle = L[2];
          for (var xx = 0; xx < len; xx += 5) if (I.hash(xx + t * 17) < 0.6) ctx.fillRect(sx + xx, sy - (I.hash(xx + t) < 0.5 ? 1 : 0), 3, 1);
          return;
        }
        var T = C.beam[li], h = C.beamH[li], fr = (t >> 1) & 3, scroll = (t * 7) % 96, bodyEnd = Math.max(0, len - 8);
        for (var x0 = -scroll; x0 < bodyEnd; x0 += 96) {
          var v0 = Math.max(0, x0), v1 = Math.min(bodyEnd, x0 + 96);
          if (v1 <= v0) continue;
          ctx.drawImage(T.c, fr * 96 + (v0 - x0), 0, v1 - v0, T.h, sx + v0, sy - T.oy, v1 - v0, T.h);
        }
        // glyph rows
        if (li < 2) for (var r2 = 0; r2 < (li === 0 ? 2 : 1); r2++) {
          var st = C.strips[r2 + (li === 0 ? 0 : 2)], sp = (t * (3 + r2)) % st.w, gy = sy + (r2 === 0 ? -Math.round(h * 0.47) - 2 : Math.round(h * 0.47) - 2);
          for (var gx = -sp; gx < bodyEnd - 6; gx += st.w) {
            var a0 = Math.max(8, gx), a1 = Math.min(bodyEnd - 6, gx + st.w);
            if (a1 > a0) ctx.drawImage(st.c, a0 - gx, 0, a1 - a0, 5, sx + a0, gy, a1 - a0, 5);
          }
        }
        // shock rings travelling along the beam
        var SR = C.shock[li];
        for (var k2 = 0; k2 < 6; k2++) { var px = ((t * 6 + k2 * 70) % 420); if (px > 14 && px < bodyEnd - 4) I.drawAnim(ctx, SR, 0, sx + px, sy, 1); }
        // ragged leading edge, row by row
        for (var dy = -h; dy <= h; dy++) {
          var u = Math.abs(dy) / h, jag = Math.floor(I.hash(dy * 31 + (t >> 1) * 7) * 7) - 3;
          var end = len - Math.round(u * u * 10) + jag;
          if (end <= bodyEnd) continue;
          ctx.fillStyle = u <= 0.17 ? L[0] : u <= 0.32 ? L[1] : u <= 0.62 ? L[2] : u <= 0.8 ? L[3] : L[4];
          ctx.fillRect(sx + bodyEnd, sy + dy, end - bodyEnd, 1);
        }
        ctx.fillStyle = L[1];
        for (var k3 = 0; k3 < 7; k3++) {
          var fx = len + ((t * 5 + k3 * 9) % 22), fy = Math.round((I.hash(k3 * 13 + ((t * 5 + k3 * 9) / 22 | 0)) - 0.5) * h * 1.5);
          ctx.fillRect(sx + fx, sy + fy, k3 % 2 ? 1 : 2, 1);
        }
        I.drawAnim(ctx, C.muzzle, (t >> 1) % 6, sx, sy, 1);
      });
    }
  });

  I.defSprite('claude.book', {
    desc: 'Open glowing tome (~40x28) hovering and bobbing, pages turning, light rays, glyphs rising.',
    use: 'During the super, at a point in front of her chest (origin = book centre); t = frames since it appeared.',
    info: { duration: 0, bbox: { x: -23, y: -17, w: 46, h: 34 } },
    draw: function (ctx, sx, sy, t, o) {
      var C = CS[o.pal], L = I.scheme('claude', o.pal).light.css;
      var by = sy + Math.round(Math.sin(t * 0.12) * 1.5);
      if (t < 4) { ctx.fillStyle = L[0]; ctx.fillRect(sx - 2 - t * 4, by - 1, 4 + t * 8, 3); ctx.fillRect(sx - 1, by - 3 - t * 3, 2, 6 + t * 6); return; }
      I.drawAnim(ctx, C.book, Math.floor(t / 3) % 8, sx, by, o.facing);
      for (var k = 0; k < 5; k++) {
        var ph = (t * 0.03 + I.hash(k * 5)) % 1, gx = sx + Math.round((I.hash(k * 9) - 0.5) * 30), gy = by - 8 - Math.round(ph * 26);
        var col = L[ph < 0.4 ? 0 : ph < 0.75 ? 1 : 2];
        if (ph > 0.85 && (t & 1)) continue;
        ctx.drawImage(I.glyphAtlas(col), I.LETTERS[(k * 7 + Math.floor(t / 20)) % 26] * 4, 0, 3, 5, gx, gy, 3, 5);
      }
    }
  });
})();
