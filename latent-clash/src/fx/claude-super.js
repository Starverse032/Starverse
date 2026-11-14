/* LATENT CLASH — FX: Claude 娘 super, 巨著·万言长卷 MAGNUM OPUS (owned by FX).
 * claude.beam v2: ~80 px tall at full power — white-gold core, banded orange body with
 * streaming energy dashes, four rows of glyph blocks racing along it, pages and sunburst
 * petals whipping past, a huge sunburst muzzle bloom at the book, shock rings, ragged
 * leading edge with a white spearhead while it grows. claude.book v2: 64x44 tome that
 * opens (cover with the sunburst emblem) and keeps fanning pages. Overrides the v1
 * definitions from claude-sprites.js (same names, same opts contract). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  var PI = Math.PI, TAU = PI * 2;
  var A = I.A = I.A || {};
  var CS = [{}, {}];
  var HS = [40, 30, 20, 11];            // half-heights per power level
  var TW = 128;                         // body tile width
  var ROWS = ['HELPFUL HONEST HARMLESS * ', 'IN THE BEGINNING WAS THE WORD * ', 'THINK STEP BY STEP * ', 'SHALL I COMPARE THEE * ',
    'ONCE UPON A TIME IN LATENT SPACE * ', 'ONE MILLION TOKENS * '];

  function bake() {
    [0, 1].forEach(function (pal) {
      var sc = I.scheme('claude', pal), L = sc.light.u, G = sc.gold.u, P = sc.paper.u, K = sc.ink.u, C = CS[pal];

      // ---- body tiles: 4 thickness levels x 4 wobble frames ----
      C.body = HS.map(function (h, li) {
        var TH = 2 * h + 8, cy = h + 4, rng = I.bakeRng(910 + li * 7);
        var dashes = [];
        for (var i = 0; i < 14; i++) dashes.push({ x: Math.floor(rng() * TW), l: 8 + Math.floor(rng() * 22), y: (rng() < 0.5 ? -1 : 1) * (0.24 + rng() * 0.5) });
        return I.anim(TW, TH, 4, 0, cy, function (b, f) {
          for (var x = 0; x < TW; x++) {
            var w = Math.sin(TAU * x / TW * 2 + f * PI / 2) * 1.2 + Math.sin(TAU * x / TW * 3 - f * PI / 2) * 0.8;
            var hx = h + Math.round(w * (h / 40 + 0.35));
            for (var dy = -hx; dy <= hx; dy++) {
              var u = Math.abs(dy) / hx, c;
              if (u <= 0.1 || Math.abs(dy) <= (li >= 2 ? 0 : 1)) c = L[0];
              else if (u <= 0.2) c = G[1];
              else if (u <= 0.3) c = L[1];
              else if (u <= 0.52) c = (u > 0.41 && u <= 0.45 && li < 2) ? L[3] : L[2];
              else if (u <= 0.7) c = (u > 0.6 && u <= 0.63 && li < 2) ? L[2] : L[3];
              else if (u <= 0.84) c = L[4];
              else if (u <= 0.91) c = L[5];
              else { if (I.bayer(x + f, dy + cy) < (1 - u) * 6) c = L[4]; else continue; }
              b.set(x, cy + dy, c);
            }
          }
          if (li < 3) dashes.forEach(function (dd) {
            var yy = cy + Math.round(dd.y * h), col = Math.abs(dd.y) < 0.4 ? G[1] : L[1];
            for (var k = 0; k < dd.l; k++) b.set((dd.x + k) % TW, yy, k < 3 ? L[2] : k > dd.l - 4 ? L[0] : col);
          });
        });
      });

      // ---- glyph rows (seamless strips): light rows on the dark band, dark rows on the bright band ----
      C.rows = ROWS.map(function (txt, ri) {
        var dark = ri % 2 === 1, wpx = txt.length * 4, n = Math.ceil(400 / wpx) + 1, s = '';
        for (var q = 0; q < n; q++) s += txt;
        var b = new I.Buf(wpx * n, 7);
        I.text35(b, s, 0, 1, dark ? L[4] : L[0]);
        if (!dark) b.outline(L[4]);
        return { c: I.toCanvas(b), w: wpx };
      });

      // ---- whipping pages (10x13, 8 flutter frames) and sunburst petals (8 rotations) ----
      C.page = I.anim(14, 16, 8, 7, 8, function (b, f) {
        var widths = [10, 8, 5, 1, 5, 8, 10, 8], ww = widths[f], back = f >= 3 && f <= 5, x0 = Math.round(7 - ww / 2);
        for (var y = 2; y < 14; y++) b.rect(x0 + (y < 5 && f < 3 ? 1 : y > 10 && f > 5 ? -1 : 0), y, ww, 1, back ? P[2] : P[0]);
        if (!back && ww > 4) for (var ln = 0; ln < 4; ln++) b.rect(x0 + 1, 4 + ln * 2, ww - 3 - (ln === 3 ? 2 : 0), 1, L[3]);
        b.outline(L[4]);
      });
      C.petal = I.anim(13, 13, 8, 6, 6, function (b, f) {
        var a = f * PI / 8;
        b.ray(6.5, 6.5, a, -5.5, 5.5, 2.4, 0.3, L[1]);
        b.ray(6.5, 6.5, a, -3.5, 3, 1, 0.3, L[0]);
        b.outline(L[3]);
      });

      // ---- muzzle bloom: 6f loop, 72x120, origin (24,60) ----
      C.muzzle = I.anim(72, 120, 6, 24, 60, function (b, f) {
        var cx = 24, cy = 60, pr = f % 3, rot = f * TAU / 12 / 6;
        var halo = new I.Buf(72, 120); halo.ellipse(cx + 2, cy, 26 + pr, 54 + pr, L[3]); halo.breakup(0.28, f, 0); b.blit(halo, 0, 0);
        b.ellipse(cx, cy, 15 + pr, 48 + pr, L[3]);
        b.ellipse(cx, cy, 11 + pr, 44, L[2]);
        b.ellipse(cx, cy, 7, 38 - pr, L[1]);
        for (var k = 0; k < 12; k++) { var a = rot + k * TAU / 12; b.ray(cx, cy, a, 8, 30 + (k % 2 ? 0 : 6) + pr * 2, 4.5, 0.3, L[1]); }
        for (k = 0; k < 12; k++) { var a2 = rot + k * TAU / 12; b.ray(cx, cy, a2, 9, 22 + (k % 2 ? 0 : 4), 1.8, 0.3, L[0]); }
        b.ellipse(cx, cy, 4, 32, G[1]); b.ellipse(cx, cy, 2, 26, L[0]);
        b.disc(cx, cy, 9, L[0]);
        b.outline(L[4]);
        for (var s = 0; s < 6; s++) { var aa = f * 0.5 + s * TAU / 6; b.rect(cx + Math.cos(aa) * 34, cy + Math.sin(aa) * 56, 2, 2, s % 2 ? L[1] : L[0]); }
      });
      // shock rings (one per level), travelling ellipse arcs
      C.shock = HS.map(function (h) {
        return I.anim(10, 2 * h + 16, 1, 5, h + 8, function (b) { b.ellRing(5, h + 8, 4, h + 7, 1.3, L[0]); b.breakup(0.65); });
      });
      // spearhead flash at the leading edge (growing frames)
      C.tip = I.anim(40, 40, 3, 14, 20, function (b, f) {
        I.spark4(b, 14, 20, 24 - f * 4, 10 - f * 2, 16 - f * 3, 16 - f * 3, 2, L[0]);
        b.outline(L[2]);
      });
      // charge orb: 12 growth stages
      C.orb = I.anim(60, 60, 12, 30, 30, function (b, f) {
        var r = 4 + f * 1.6, rot = f * 0.21;
        for (var k = 0; k < 12; k++) { var a = rot + k * TAU / 12; b.ray(30, 30, a, r * 0.5, r * 1.55 + (k % 2 ? 0 : r * 0.25), Math.max(1, r * 0.22), 0.3, L[1]); }
        b.outline(L[3]);
        b.disc(30, 30, r, L[1]); b.disc(30, 30, r * 0.72, L[0]);
      });

      // ---- BOOK v2: 6 opening frames + 12 fanning loop frames, 84x66, origin (42,36) ----
      var BW = 84, BH = 66, bx = 42, by = 36;
      function halo(b, f, k) {
        var hb = new I.Buf(BW, BH); hb.ellipse(bx, by - 9, 40 * k, 26 * k, L[3]); hb.breakup(0.12, f, 0); b.blit(hb, 0, 0);
        hb = new I.Buf(BW, BH); hb.ellipse(bx, by - 10, 30 * k, 19 * k, L[2]); hb.breakup(0.22, f, 1); b.blit(hb, 0, 0);
      }
      function closedBook(b, f, open) {
        // front cover seen face-on, opening = cover swinging toward the viewer (narrows)
        var w = Math.round(30 * Math.cos(open * PI / 2)), x0 = bx - 30, y0 = by - 20;
        b.rect(x0 + 2, y0 + 2, 60, 40, P[2]);                       // page block edge
        b.rect(x0, y0, 60, 40, K[1]); b.rect(x0, y0, 4, 40, K[2]);    // back cover / spine
        if (w > 1) {
          var cx0 = x0 + 30 - w + 30, cw = w * 2;
          b.rect(x0 + 4, y0, Math.max(2, cw - 4), 40, K[1]);
          b.rect(x0 + 4, y0, Math.max(2, cw - 4), 1, K[0]);
          var ecx = x0 + 4 + (cw - 4) / 2, ecy = y0 + 20, er = Math.max(2, 9 * cw / 60);
          for (var k = 0; k < 12; k++) { var a = k * TAU / 12; b.ray(ecx, ecy, a, 2, er * (k % 2 ? 1 : 1.25), 1.3, 0.3, L[2]); }
          b.disc(ecx, ecy, Math.max(1, er * 0.35), L[1]);
          b.rect(x0 + cw - 2, y0 + 17, 4, 6, G[1]); b.rect(x0 + cw - 1, y0 + 18, 2, 4, G[2]);   // clasp
          b.rect(x0 + 4, y0 + 2, 2, 2, G[2]); b.rect(x0 + 4, y0 + 36, 2, 2, G[2]); b.rect(x0 + cw - 4, y0 + 2, 2, 2, G[2]); b.rect(x0 + cw - 4, y0 + 36, 2, 2, G[2]);
          void cx0;
        }
        b.outline(L[5]);
      }
      function openBook(b, f) {
        var sp = bx;
        // cover border (black cloth) with gold corners
        b.poly([sp, by + 12, bx - 34, by + 7, bx - 34, by - 15, sp, by - 11, bx + 34, by - 15, bx + 34, by + 7], K[1]);
        b.poly([sp, by + 10, bx - 33, by + 5, bx - 33, by - 15, sp, by - 12, bx + 33, by - 15, bx + 33, by + 5], K[2]);
        b.rect(bx - 34, by + 4, 3, 3, G[1]); b.rect(bx + 31, by + 4, 3, 3, G[1]);
        // page stacks (side edges show the thickness)
        b.poly([sp, by + 9, bx - 31, by + 4, bx - 31, by - 17, sp, by - 13], P[2]);
        b.poly([sp, by + 9, bx + 31, by + 4, bx + 31, by - 17, sp, by - 13], P[2]);
        b.poly([sp, by + 7, bx - 30, by + 2, bx - 29, by - 19, sp, by - 15], P[0]);
        b.poly([sp, by + 7, bx + 30, by + 2, bx + 29, by - 19, sp, by - 15], P[0]);
        for (var y = by - 15; y < by + 8; y++) { b.set(sp - 1, y, P[2]); b.set(sp, y, P[3]); b.set(sp + 1, y, P[2]); b.set(sp - 2, y, P[1]); b.set(sp + 2, y, P[1]); }
        // glowing text lines
        for (var ln = 0; ln < 6; ln++) {
          var yl = by - 14 + ln * 3.4, hot = ln === (f % 6), hot2 = ln === ((f + 3) % 6);
          for (var x = bx - 26; x < sp - 4; x += 1) if (((x * 7 + ln * 5) % 11) < 8) b.set(x, Math.round(yl + (x - (bx - 26)) * 0.14), hot ? L[1] : L[3]);
          for (x = sp + 4; x < bx + 26 - (ln === 5 ? 9 : 0); x += 1) if (((x * 5 + ln * 3) % 11) < 8) b.set(x, Math.round(yl + 3.5 - (x - sp - 4) * 0.14), hot2 ? L[1] : L[3]);
        }
      }
      function leaf(b, ph) {   // a page lifting from the right stack and turning over to the left
        var th = ph * PI, ex = bx + Math.cos(th) * 29, lift = Math.sin(th) * 14, back = th > PI / 2;
        b.poly([bx, by - 15, bx, by + 7, ex, by + 2 - lift, ex + (back ? 1 : -1) * Math.sin(th) * 2, by - 19 - lift], back ? P[0] : P[1]);
        b.line(bx, by - 15, ex, by - 19 - lift, back ? P[0] : P[2]);
      }
      C.book = I.anim(BW, BH, 18, bx, by, function (b, f) {
        if (f < 6) {
          halo(b, f, 0.5 + f * 0.1);
          if (f < 4) closedBook(b, f, f / 4);
          else { openBook(b, f); leaf(b, 0.95 - (f - 4) * 0.25); b.outline(L[4]); }
          if (f >= 4) for (var r = 0; r < 4; r++) b.rect(bx - 15 + r * 10, by - 22 - (f - 3) * 4, 1, (f - 3) * 4, L[1]);
          return;
        }
        var g = f - 6;
        halo(b, g, 1 + (g % 3 === 0 ? 0.04 : 0));
        openBook(b, g);
        for (var k = 0; k < 3; k++) leaf(b, ((g / 12) + k / 3) % 1);
        b.outline(L[4]);
        for (var rr = 0; rr < 5; rr++) {   // light rays shooting up from the pages
          var rx = bx - 20 + rr * 10 + ((g + rr) % 2), hgt = 8 + ((g * 3 + rr * 5) % 7);
          b.rect(rx, by - 20 - hgt, 1, hgt, (g + rr) % 3 ? L[1] : L[0]);
        }
      });
    });
  }
  I.onInit('claude-super', bake);

  I.defSprite('claude.beam', {
    desc: 'MAGNUM OPUS beam v2 (~80 px tall at full power): white-gold core, banded orange body with energy dashes, 4 rows of streaming glyph blocks, pages and sunburst petals whipping along it, huge sunburst muzzle bloom, shock rings, ragged leading edge with a white spearhead while it grows. Phases: charge (target line, converging petals, growing orb), fire, fade (thins by power: 80/60/40/22 px, then wisps).',
    use: 'Each frame: drawSprite(ctx,"claude.beam",muzzleX,muzzleY,t,{facing,palette,length,phase,power}). length = px from the muzzle to the leading edge (grow it ~40 px/f; 400 covers the screen). charge: power = progress 0..1; fire: power 1; fade: power 1 -> 0. Draw claude.book on top (the beam comes out of its pages).',
    info: { duration: 0, bbox: { x: 0, y: -40, w: 384, h: 80 }, halfHeight: 40, levels: HS.slice() },
    draw: function (ctx, sx, sy, t, o) {
      var C = CS[o.pal], L = I.scheme('claude', o.pal).light.css, len = Math.max(0, Math.round(o.length || 0)), phase = o.phase || 'fire', pw = o.power;
      I.mirrored(ctx, sx, o.facing, function () {
        var k, x, y;
        if (phase === 'charge') {
          var reach = len || 360;
          ctx.fillStyle = L[(t >> 1) & 1 ? 1 : 2];
          for (x = 18; x < reach; x += 7) if (I.hash(x * 3 + (t >> 1)) < 0.35 + pw * 0.55) ctx.fillRect(sx + x, sy, 4, 1);
          for (k = 0; k < 14; k++) {          // petals and motes converging on the muzzle
            var ph = (t * 0.045 + I.hash(k + 7)) % 1, r = 70 * (1 - ph), a = I.hash(k) * TAU;
            var px = Math.round(sx + Math.cos(a) * r), py = Math.round(sy + Math.sin(a) * r * 0.85);
            if (k % 2) I.drawAnim(ctx, C.petal, (k + (t >> 2)) & 7, px, py, 1);
            else { ctx.fillStyle = L[r < 20 ? 0 : 1]; ctx.fillRect(px - 1, py - 1, 2, 2); }
          }
          I.drawAnim(ctx, C.orb, Math.min(11, Math.floor(pw * 11.99)), sx, sy, 1);
          return;
        }
        var li = pw >= 0.75 ? 0 : pw >= 0.5 ? 1 : pw >= 0.28 ? 2 : pw >= 0.1 ? 3 : 4;
        if (phase === 'fade' && pw < 0.3 && (t & 1)) li = Math.min(4, li + 1);
        if (li === 4) {   // last wisps: broken flickering lines
          ctx.fillStyle = L[2];
          for (x = 0; x < len; x += 5) if (I.hash(x + t * 17) < 0.55) ctx.fillRect(sx + x, sy - 2 + Math.floor(I.hash(x + t) * 5), 3, 1);
          return;
        }
        var T = C.body[li], h = HS[li], fr = (t >> 1) & 3, scroll = (t * 9) % TW, bodyEnd = Math.max(0, len - 10);
        for (var x0 = -scroll; x0 < bodyEnd; x0 += TW) {
          var v0 = Math.max(0, x0), v1 = Math.min(bodyEnd, x0 + TW);
          if (v1 > v0) ctx.drawImage(T.c, fr * TW + (v0 - x0), 0, v1 - v0, T.h, sx + v0, sy - T.oy, v1 - v0, T.h);
        }
        // glyph rows streaming (4 at full power, 2 at level 1, none below)
        var nr = li === 0 ? 4 : li === 1 ? 2 : 0, RY = li === 0 ? [-0.62, -0.36, 0.3, 0.57] : [-0.5, 0.42], RS = [7, 11, 9, 13];
        for (var ri = 0; ri < nr; ri++) {
          var st = C.rows[(ri + (li === 0 ? 0 : 4)) % C.rows.length], sp = (t * RS[ri]) % st.w, gy = sy + Math.round(RY[ri] * h) - 3;
          var a0 = 22, a1 = bodyEnd - 8, srcx = (st.w - sp + a0) % st.w, ww = Math.min(a1 - a0, st.c.width - srcx);
          if (ww > 0) ctx.drawImage(st.c, srcx, 0, ww, 7, sx + a0, gy, ww, 7);
        }
        // shock rings racing along
        var SR = C.shock[li];
        for (k = 0; k < 5; k++) { x = (t * 8 + k * 86) % 430; if (x > 26 && x < bodyEnd - 4) I.drawAnim(ctx, SR, 0, sx + x, sy, 1); }
        // pages and petals whipping along the beam
        if (li < 3) {
          for (k = 0; k < 6; k++) {
            x = (t * (12 + k % 3 * 3) + k * 71) % 460; if (x < 30 || x > bodyEnd + 20) continue;
            y = Math.round(Math.sin(t * 0.21 + k * 2.1) * h * 0.25 + (k & 1 ? -1 : 1) * h * (0.82 + 0.25 * I.hash(k)));
            I.drawAnim(ctx, C.page, (t + k * 3) & 7, sx + x, sy + y, 1);
          }
          for (k = 0; k < 12; k++) {
            x = (t * (15 + k % 4 * 3) + k * 43) % 470; if (x < 24 || x > bodyEnd + 26) continue;
            y = Math.round((I.hash(k * 9) - 0.5) * h * 2.5 + Math.sin(t * 0.3 + k) * 4);
            I.drawAnim(ctx, C.petal, (k + (t >> 1)) & 7, sx + x, sy + y, 1);
          }
        }
        // ragged leading edge + spearhead while the beam is still growing on screen
        for (var dy = -h; dy <= h; dy++) {
          var u = Math.abs(dy) / h, jag = Math.floor(I.hash(dy * 31 + (t >> 1) * 7) * 9) - 4;
          var end = len - Math.round(u * u * 18) + jag;
          if (end <= bodyEnd) continue;
          ctx.fillStyle = u <= 0.12 ? L[0] : u <= 0.3 ? L[1] : u <= 0.52 ? L[2] : u <= 0.7 ? L[3] : L[4];
          ctx.fillRect(sx + bodyEnd, sy + dy, end - bodyEnd, 1);
        }
        if (phase === 'fire' && len < 420) I.drawAnim(ctx, C.tip, t % 3, sx + len, sy, 1);
        ctx.fillStyle = L[1];
        for (k = 0; k < 9; k++) {
          var fx = len + ((t * 6 + k * 9) % 26), fy = Math.round((I.hash(k * 13 + ((t * 6 + k * 9) / 26 | 0)) - 0.5) * h * 1.6);
          ctx.fillRect(sx + fx, sy + fy, k % 2 ? 1 : 3, 1);
        }
        if (li < 2) I.drawAnim(ctx, C.muzzle, (t >> 1) % 6, sx, sy, 1);
        else I.drawAnim(ctx, C.orb, li === 2 ? 6 + (t & 1) : 3 + (t & 1), sx, sy, 1);
      });
    }
  });

  I.defSprite('claude.book', {
    desc: 'The tome 「宪章」 v2 (~64x44 + halo): closed cover with the sunburst emblem swings open (6f), then pages keep fanning over, glowing text lines, light rays shooting up, glyphs rising.',
    use: 'During the super, in front of her chest (origin = book centre), drawn AFTER claude.beam so the beam comes out of its pages; t = frames since it appeared (0-11 = opening).',
    info: { duration: 0, bbox: { x: -40, y: -34, w: 80, h: 60 }, openFrames: 12 },
    draw: function (ctx, sx, sy, t, o) {
      var C = CS[o.pal], L = I.scheme('claude', o.pal).light.css;
      var by = sy + Math.round(Math.sin(t * 0.12) * 1.5);
      if (t < 2) { ctx.fillStyle = L[0]; ctx.fillRect(sx - 3 - t * 8, by - 1, 6 + t * 16, 3); ctx.fillRect(sx - 1, by - 4 - t * 6, 3, 8 + t * 12); }
      var f = t < 12 ? Math.floor(t / 2) : 6 + Math.floor((t - 12) / 2) % 12;
      I.drawAnim(ctx, C.book, f, sx, by, o.facing);
      if (t < 12) return;
      for (var k = 0; k < 7; k++) {
        var ph = (t * 0.03 + I.hash(k * 5)) % 1, gx = sx + Math.round((I.hash(k * 9) - 0.5) * 50), gy = by - 16 - Math.round(ph * 36);
        if (ph > 0.85 && (t & 1)) continue;
        ctx.drawImage(I.glyphAtlas(L[ph < 0.4 ? 0 : ph < 0.75 ? 1 : 2]), I.LETTERS[(k * 7 + Math.floor(t / 20)) % 26] * 4, 0, 3, 5, gx, gy, 3, 5);
      }
    }
  });
})();
