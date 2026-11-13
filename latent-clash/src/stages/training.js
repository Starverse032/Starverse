/* LATENT CLASH — STAGE 4: training 评测基准场. Clean benchmark room, deliberately low-distraction.
 *
 * Light logic: even, cool, overhead panel lighting (no strong direction); mid-light cool grey
 * walls with a measured grid; a darker floor so feet, shadows, hitboxes and effects read.
 * Layers: back wall 0.7 · main wall 0.841 (grid, BENCHMARK sign, scoreboard, whiteboard) ·
 * floor (line scroll: perspective grid + world-exact ruler every 32 px) · props (cones) · front rail 1.25.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var YH = 76;
  var C = {
    ceil: '#3a3f55', ceilLt: '#4a5068', lamp: '#e8eef8', lampDk: '#aab4c8',
    wall: '#8a90a6', wallLt: '#969cb2', grid: '#7c8298', gridMaj: '#6a7088', trim: '#5a6078', trimLt: '#b0b6c8',
    sign: '#2c3044', signTx: '#e8ecf6', signAcc: '#ffd166', board: '#1e2232', boardTx: '#5ee6a8', boardDim: '#2e4a44',
    wb: '#e4e8f0', wbFrame: '#6a7088', wbLine: '#8a90a6', curveA: '#d97757', curveB: '#4d6bfe',
    floor: '#545a6e', floorB: '#4e5468', fGrid: '#626880', fGridMaj: '#70768e', ruler: '#c8cede', rulerDk: '#3a3f52',
    center: '#ffd166', cone: '#e88a4a', coneDk: '#b0602e', coneW: '#f0f0f0', rail: ['#9aa0b6', '#6a7088', '#454b60', '#2e3244'], warn: '#d8b040'
  };

  function build(U) {
    var c = U.col, A = {};
    var FW = A.FW = U.floorScale(YH, 168);
    var ww = U.layerW(FW), wall = U.pix(ww, 176);
    var R = function (x, y, w, h, col) { wall.rect(x, y + 8, w, h, c(col)); };
    R(0, -8, ww, 176, C.wall);
    // measured grid: minor every 8, major every 32 (wall px)
    for (var x = 0; x < ww; x += 8) R(x, 30, 1, 138, (x % 32) ? C.grid : C.gridMaj);
    for (var y = 32; y < 168; y += 8) R(0, y, ww, 1, ((y - 32) % 32) ? C.grid : C.gridMaj);
    // ceiling with flat panel lights (calm HUD band)
    R(0, -8, ww, 36, C.ceil);
    for (x = 10; x < ww; x += 64) { R(x, 8, 40, 4, C.lampDk); R(x + 1, 8, 38, 2, C.lamp); }
    R(0, 26, ww, 2, C.trim); R(0, 28, ww, 1, C.trimLt); R(0, 29, ww, 1, C.trim);
    // wainscot band + skirting
    R(0, 150, ww, 1, C.trimLt); R(0, 151, ww, 13, C.wallLt); R(0, 164, ww, 4, C.trim); R(0, 164, ww, 1, C.trimLt);
    // centre marker on the wall
    var cx = U.wx(320, FW);
    R(cx, 30, 1, 120, C.gridMaj); R(cx - 3, 146, 7, 2, C.center); R(cx, 140, 1, 8, C.center);
    // BENCHMARK sign
    var t1 = 'BENCHMARK', t2 = '评测基准场', w1 = U.textW(t1, 12, 2), w2 = U.textW(t2, 10, 1), sw = Math.max(w1, w2) + 16;
    R(cx - sw / 2, 36, sw, 32, C.sign); R(cx - sw / 2, 36, sw, 1, C.trimLt); R(cx - sw / 2, 67, sw, 1, '#1a1d2a');
    R(cx - sw / 2 + 3, 39, 3, 3, C.signAcc);
    U.text(wall, t1, Math.round(cx - w1 / 2), 38 + 8, 12, c(C.signTx), 2);
    U.text(wall, t2, Math.round(cx - w2 / 2), 54 + 8, 10, c(C.signAcc), 1);
    // scoreboard (left): digits drawn live
    var sbx = U.wx(130, FW) - 30;
    A.sb = { x: sbx, y: 44 };
    R(sbx, 40, 60, 30, C.board); R(sbx, 40, 60, 1, C.trimLt); R(sbx - 1, 40, 1, 30, C.trim); R(sbx + 60, 40, 1, 30, C.trim);
    U.text3(wall, 'HITS', sbx + 4, 44 + 8, c(C.boardDim)); U.text3(wall, 'MAX', sbx + 4, 58 + 8, c(C.boardDim));
    // whiteboard with a loss curve (right)
    var wbx = U.wx(520, FW) - 34;
    R(wbx - 2, 82, 72, 48, C.wbFrame); R(wbx, 84, 68, 44, C.wb);
    U.text3(wall, 'LOSS', wbx + 3, 86 + 8, c(C.wbLine));
    R(wbx + 6, 94, 1, 30, C.wbLine); R(wbx + 6, 123, 58, 1, C.wbLine);
    for (x = 0; x < 56; x++) {
      var la = 26 * Math.exp(-x / 12) + 2 + Math.sin(x * 1.7) * 0.8, lb = 24 * Math.exp(-x / 16) + 3 + Math.cos(x * 1.3) * 0.8;
      wall.set(wbx + 8 + x, 8 + Math.round(122 - la), c(C.curveA));
      wall.set(wbx + 8 + x, 8 + Math.round(122 - lb), c(C.curveB));
    }
    R(wbx + 4, 129, 60, 2, C.trim);
    // distance labels on the wall (every 64 world px) — wall-scale reference
    for (var X = 0; X <= 640; X += 64) { var lx = U.wx(X, FW); R(lx, 140, 1, 6, C.gridMaj); }
    A.wall = wall.toCanvas();

    // floor: perspective grid, lane band, world-exact ruler just in front of the feet line
    A.floor = U.buildFloor(168, 224, YH, (function () {
      var fl = c(C.floor), flB = c(C.floorB), g = c(C.fGrid), gM = c(C.fGridMaj), ru = c(C.ruler), rd = c(C.rulerDk), ce = c(C.center);
      return function (X, y, s) {
        var z = 1 / s, onX = Math.abs(X - Math.round(X / 32) * 32) * s < 0.5, zz = (z - 1) / 0.25, onZ = Math.abs(zz - Math.round(zz)) * 0.25 * 110 * s * s < 0.5;
        if (Math.abs(X - 320) * s < 0.5 && y > 170) return ce;               // centre line
        if (y >= 189 && y <= 193) {                                          // ruler strip
          if (y === 189 || y === 193) return rd;
          var m = ((X % 32) + 32) % 32;
          if (m * s < 1) return ru;
          if (Math.abs(m - 16) * s < 0.5 && y >= 191) return ru;
          return rd;
        }
        if (onX) return Math.round(X / 32) % 4 === 0 ? gM : g;
        if (onZ) return g;
        return ((Math.floor(X / 32) + Math.round(zz - 0.5)) & 1) ? flB : fl;
      };
    })());
    // ruler numbers: 3×5 digits every 64 world px, drawn live at exact screen x (no shear)
    A.cone = (function () {
      var p = U.pix(11, 14);
      p.poly([5.5, 0, 9, 11, 2, 11], c(C.cone)); p.rect(3, 6, 6, 2, c(C.coneW)); p.rect(7, 2, 2, 9, c(C.coneDk));
      p.rect(0, 11, 11, 3, c(C.coneDk)); p.rect(0, 11, 11, 1, c(C.cone));
      p.outline(c('#2e3244'));
      return p.toCanvas();
    })();
    A.fP = 1.25;
    var pw = U.layerW(A.fP), rail = U.pix(pw, 20);
    rail.rect(0, 6, pw, 2, c(C.rail[0])); rail.rect(0, 8, pw, 2, c(C.rail[2])); rail.rect(0, 10, pw, 1, c(C.rail[3]));
    for (x = 12; x < pw; x += 96) { rail.rect(x, 4, 4, 16, c(C.rail[1])); rail.rect(x, 4, 1, 16, c(C.rail[0])); rail.rect(x, 4, 4, 2, c(C.warn)); }
    A.rail = rail.toCanvas();
    return A;
  }

  function setup(st, A, U) {
    st.hits = 0; st.max = 0; st.combo = 0; st.idle = 0; st.blink = 0;
    var L = [];
    L.push({ name: 'wall', draw: function (g, cam, s) {
      var ox = -8 - Math.round(cam * A.FW);
      g.drawImage(A.wall, ox, -8);
      // scoreboard digits (live) + REC blink
      var d = function (n, x, y) { g.fillStyle = C.boardTx; drawNum(g, ('00' + n).slice(-3), x, y); };
      d(Math.min(999, s.hits), ox + A.sb.x + 30, A.sb.y);
      d(Math.min(999, s.max), ox + A.sb.x + 30, A.sb.y + 14);
      if ((s.t >> 5) & 1) { g.fillStyle = '#ff4d6d'; g.fillRect(ox + A.sb.x + 52, A.sb.y - 1, 3, 3); }
      if (s.blink > 0 && (s.blink & 4)) { g.fillStyle = C.signAcc; g.fillRect(ox + A.sb.x, A.sb.y - 4, 60, 1); }
    } });
    L.push({ name: 'floor', draw: function (g, cam) {
      U.drawFloor(g, A.floor, cam);
      g.fillStyle = C.ruler;
      for (var X = 0; X <= 640; X += 64) {
        var x = Math.round(U.floorX(YH, X, 197, cam)), str = String(X);
        drawNum(g, str, x - (str.length * 4 - 1) / 2 | 0, 196);
      }
    } });
    L.push({ name: 'props', draw: function (g, cam) {
      var f = U.floorScale(YH, 178);
      [[36, 178], [604, 178]].forEach(function (p) { g.drawImage(A.cone, Math.round(U.sx(p[0], f, cam)) - 5, p[1] - 13); });
    } });
    L.push({ name: 'rail', front: true, draw: function (g, cam) { g.drawImage(A.rail, -8 - Math.round(cam * A.fP), 208); } });
    return L;
  }

  var DIG = ['111101101101111', '010110010010111', '111001111100111', '111001011001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
  function drawNum(g, str, x, y) {
    for (var i = 0; i < str.length; i++) {
      var d = DIG[+str[i]] || DIG[0];
      for (var k = 0; k < 15; k++) if (d[k] === '1') g.fillRect(x + i * 4 + (k % 3), y + ((k / 3) | 0), 1, 1);
    }
  }

  function update(st) {
    if (st.idle > 0 && --st.idle === 0) st.combo = 0;
    if (st.blink > 0) st.blink--;
  }
  function event(st, A, name) {
    if (name === 'hit') { st.hits++; st.combo++; st.max = Math.max(st.max, st.combo); st.idle = 90; st.blink = 16; }
    else if (name === 'roundStart') { st.combo = 0; }
  }

  LC.stages.define('training', { music: 'stage.training', shadowColor: 'rgba(30,34,52,0.45)', build: build, setup: setup, update: update, event: event });
})();
