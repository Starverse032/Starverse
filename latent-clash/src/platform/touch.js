/* LATENT CLASH — LC.input.touch: on-screen touch controls (PLATFORM).
 * DOM overlay: 8-way d-pad (left), L/M/H/S in a thumb arc (right), 投 (L+M) and 超 (H+S)
 * macros, pause. True multi-touch via Pointer Events; a finger may slide between buttons; the
 * d-pad keeps its finger even when it drifts outside. Writes LC.input.touchState.
 * Placement comes from LC.display's layout (portrait: below the game; landscape: side bars
 * or translucent bottom-corner overlay). Art is drawn as tiny pixel canvases, CSS-upscaled. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};

  var root = null, dpad = null, btns = [], pauseBtn = null;
  var active = new Map();     // pointerId -> { kind, btn, x, y }
  var dirState = 5;
  var built = false, visible = false;
  var curLayout = null;

  var DEFS = [
    { id: 'L', label: '轻', col: '#5ee6a8', key: 'L' },
    { id: 'M', label: '中', col: '#ffd166', key: 'M' },
    { id: 'H', label: '重', col: '#ff6b7f', key: 'H' },
    { id: 'S', label: '特', col: '#58d4ff', key: 'S' },
    { id: 'throw', label: '投', col: '#c9b6ff', key: 'throw', small: true },
    { id: 'super', label: '超', col: '#fff07a', key: 'super', small: true }
  ];

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var m = function (v) { return Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)))); };
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }
  function disc(c, cx, cy, r, col) {   // pixel disc without AA
    c.fillStyle = col;
    for (var y = -r; y <= r; y++) {
      var hw = Math.floor(Math.sqrt(r * r - y * y) + 0.35);
      c.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
    }
  }
  function mk(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function drawButton(cv, def, on) {
    var n = def.small ? 17 : 23, c = cv.getContext('2d');
    cv.width = n; cv.height = n;
    c.clearRect(0, 0, n, n);
    var r = (n - 1) / 2;
    disc(c, r, r, r, '#0b0a14');
    disc(c, r, r + (on ? 0 : 0), r - 1, shade(def.col, on ? 0.15 : -0.45));
    if (!on) disc(c, r, r - 1, r - 2, shade(def.col, -0.15));
    else disc(c, r, r, r - 2, shade(def.col, 0.35));
    // specular pixels
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fillRect(Math.round(r - r * 0.55), Math.round(r - r * 0.6), 2, 1);
    c.fillRect(Math.round(r - r * 0.68), Math.round(r - r * 0.42), 1, 2);
    if (LC.font && LC.font.isReady && LC.font.isReady()) {
      var sz = def.small ? 10 : 12;
      LC.font.draw(c, def.label, Math.round(r) + 1, Math.round(r - sz / 2) + (on ? 1 : 0), { size: sz, color: on ? '#15132a' : '#fff', outline: on ? null : '#15132a', align: 'center' });
    }
  }

  function drawDpad(cv, dir) {
    var n = 49, c = cv.getContext('2d'), m = 24;
    cv.width = n; cv.height = n;
    c.clearRect(0, 0, n, n);
    disc(c, m, m, 24, 'rgba(11,10,20,0.75)');
    disc(c, m, m, 23, 'rgba(35,31,69,0.75)');
    disc(c, m, m, 21, 'rgba(21,19,42,0.85)');
    var up = dir === 7 || dir === 8 || dir === 9, down = dir === 1 || dir === 2 || dir === 3;
    var left = dir === 1 || dir === 4 || dir === 7, right = dir === 3 || dir === 6 || dir === 9;
    var arm = 7, len = 17;
    function bar(x, y, w, h, lit) {
      c.fillStyle = '#0b0a14'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
      c.fillStyle = lit ? '#ffd166' : '#3b3670'; c.fillRect(x, y, w, h);
      c.fillStyle = lit ? '#fff3c4' : '#5a5499'; c.fillRect(x, y, w, 1);
    }
    bar(m - arm, m - len, arm * 2 + 1, len - arm, up);
    bar(m - arm, m + arm + 1, arm * 2 + 1, len - arm, down);
    bar(m - len, m - arm, len - arm, arm * 2 + 1, left);
    bar(m + arm + 1, m - arm, len - arm, arm * 2 + 1, right);
    c.fillStyle = '#3b3670'; c.fillRect(m - arm, m - arm, arm * 2 + 1, arm * 2 + 1);
    c.fillStyle = dir === 5 ? '#4a4488' : '#2b2758'; c.fillRect(m - 3, m - 3, 7, 7);
    // arrow heads
    c.fillStyle = '#0b0a14';
    var tri = function (cx, cy, dx, dy) {
      for (var k = 0; k < 3; k++) {
        if (dx) c.fillRect(cx + dx * k, cy - (2 - k), 1, (2 - k) * 2 + 1);
        else c.fillRect(cx - (2 - k), cy + dy * k, (2 - k) * 2 + 1, 1);
      }
    };
    tri(m, m - len + 3, 0, -1); tri(m, m + len - 3, 0, 1); tri(m - len + 3, m, -1, 0); tri(m + len - 3, m, 1, 0);
    // diagonal ticks
    c.fillStyle = 'rgba(155,150,184,0.6)';
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) {
      var lit = (d[0] < 0 ? left : right) && (d[1] < 0 ? up : down);
      c.fillStyle = lit ? '#ffd166' : 'rgba(155,150,184,0.55)';
      c.fillRect(m + d[0] * 14, m + d[1] * 14, 2, 2);
    });
  }

  function drawPause(cv, on) {
    var n = 15, c = cv.getContext('2d');
    cv.width = n; cv.height = n;
    disc(c, 7, 7, 7, '#0b0a14');
    disc(c, 7, 7, 6, on ? '#ffd166' : '#3b3670');
    c.fillStyle = on ? '#15132a' : '#f4efe6';
    c.fillRect(5, 4, 2, 7); c.fillRect(9, 4, 2, 7);
  }

  function build() {
    if (built) return;
    built = true;
    root = mk('div'); root.id = 'lc-touch';
    document.getElementById('lc-root').appendChild(root);
    dpad = { el: mk('div', 'lc-tc lc-dpad'), cv: mk('canvas') };
    dpad.el.appendChild(dpad.cv); root.appendChild(dpad.el);
    drawDpad(dpad.cv, 5);
    DEFS.forEach(function (d) {
      var b = { def: d, el: mk('div', 'lc-tc lc-btn' + (d.small ? ' lc-small' : '')), cv: mk('canvas'), on: false };
      b.el.appendChild(b.cv); root.appendChild(b.el);
      drawButton(b.cv, d, false);
      btns.push(b);
    });
    pauseBtn = { el: mk('div', 'lc-tc lc-pause'), cv: mk('canvas'), on: false };
    pauseBtn.el.appendChild(pauseBtn.cv); root.appendChild(pauseBtn.el);
    drawPause(pauseBtn.cv, false);

    root.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', onUp, { passive: false });
    ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'contextmenu', 'selectstart', 'dblclick'].forEach(function (t) {
      root.addEventListener(t, function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
    });
  }

  function place(el, cx, cy, size) {
    el.style.width = el.style.height = Math.round(size) + 'px';
    el.style.left = Math.round(cx - size / 2) + 'px';
    el.style.top = Math.round(cy - size / 2) + 'px';
    el._cx = cx; el._cy = cy; el._r = size / 2;
  }

  function layoutControls(L) {
    curLayout = L;
    var show = !!(L && L.touch && L.controls);
    visible = show;
    if (!built) { if (!show) return; build(); }
    root.style.display = show ? 'block' : 'none';
    root.className = L.mode === 'overlay' ? 'lc-overlay' : '';
    if (!show) { release(); return; }
    var lz = L.controls.left, rz = L.controls.right;
    // d-pad: square area anchored low in the left zone
    var Z = Math.min(lz.w, lz.h, 230);
    var D = Z * (L.mode === 'sides' ? 0.92 : 0.86);
    var dcx = lz.x + Math.max(D / 2 + 6, Math.min(lz.w / 2, Z / 2 + 4));
    if (L.mode === 'overlay') dcx = lz.x + D / 2 + 10;
    var dcy = L.mode === 'below' ? lz.y + Math.min(lz.h - D / 2 - 8, Math.max(D / 2 + 8, lz.h * 0.52)) : lz.y + lz.h - D / 2 - Math.max(12, lz.h * 0.12);
    place(dpad.el, dcx, dcy, D);
    // buttons: arc around a pivot near the zone's bottom-right corner
    var Zr = Math.min(rz.w, rz.h, 240);
    var B = Math.max(40, Math.min(70, Zr * 0.29));
    var px = rz.x + rz.w - (L.mode === 'sides' ? 0.28 : 0.42) * B - 6;
    if (L.mode === 'below') px = rz.x + Math.min(rz.w - 0.4 * B - 4, rz.w / 2 + Zr / 2 - 0.4 * B);
    var py = dcy + D / 2 - 0.05 * B;
    var R1 = B * 2.05, R0 = B * 0.98;
    var angs = { L: 172, M: 146, H: 120, S: 94, throw: 160, super: 108 };
    btns.forEach(function (b) {
      var small = b.def.small, a = angs[b.def.id] * Math.PI / 180, R = small ? R0 : R1;
      var size = small ? B * 0.74 : B;
      place(b.el, px + Math.cos(a) * R, py - Math.sin(a) * R, size);
    });
    // pause
    var ps = Math.max(30, B * 0.6);
    if (L.mode === 'below') place(pauseBtn.el, L.vw / 2, lz.y + ps / 2 + 4, ps);
    else if (L.mode === 'sides') place(pauseBtn.el, rz.x + rz.w / 2, rz.y + ps / 2 + 44, ps);
    else place(pauseBtn.el, L.insets.l + ps / 2 + 8, L.insets.t + ps / 2 + 8, ps);
  }

  function hitButton(x, y, slack) {
    var best = null, bd = 1e9;
    btns.forEach(function (b) {
      var dx = x - b.el._cx, dy = y - b.el._cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < b.el._r * slack && d / b.el._r < bd) { bd = d / b.el._r; best = b; }
    });
    return best;
  }

  function dirFrom(x, y) {
    var dx = x - dpad.el._cx, dy = y - dpad.el._cy, r = dpad.el._r;
    if (dx * dx + dy * dy < (r * 0.18) * (r * 0.18)) return 5;
    var a = Math.atan2(-dy, dx) * 180 / Math.PI;     // 0 = right, 90 = up
    var oct = Math.round(((a + 360) % 360) / 45) % 8;
    return [6, 9, 8, 7, 4, 1, 2, 3][oct];
  }

  function onDown(e) {
    if (!visible) return;
    var x = e.clientX, y = e.clientY;
    var t = null;
    var ddx = x - dpad.el._cx, ddy = y - dpad.el._cy;
    if (Math.sqrt(ddx * ddx + ddy * ddy) < dpad.el._r * 1.2) t = { kind: 'dpad', x: x, y: y };
    else {
      var pdx = x - pauseBtn.el._cx, pdy = y - pauseBtn.el._cy;
      if (Math.sqrt(pdx * pdx + pdy * pdy) < pauseBtn.el._r * 1.3) t = { kind: 'pause' };
      else { var b = hitButton(x, y, 1.25); if (b) t = { kind: 'btn', btn: b }; }
    }
    if (!t) return;
    e.preventDefault();
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    active.set(e.pointerId, t);
    LC.input._touchPressed();
    if (t.kind !== 'dpad') buzz();
    update();
  }
  function onMove(e) {
    var t = active.get(e.pointerId);
    if (!t) return;
    e.preventDefault();
    if (t.kind === 'dpad') { t.x = e.clientX; t.y = e.clientY; }
    else if (t.kind === 'btn') {
      var b = hitButton(e.clientX, e.clientY, 1.05);
      if (b && b !== t.btn) { t.btn = b; buzz(); }
      else if (!b && t.btn) {
        var dx = e.clientX - t.btn.el._cx, dy = e.clientY - t.btn.el._cy;
        if (Math.sqrt(dx * dx + dy * dy) > t.btn.el._r * 1.7) t.btn = null;
      }
    }
    update();
  }
  function onUp(e) {
    if (!active.has(e.pointerId)) return;
    active.delete(e.pointerId);
    update();
  }
  function release() { active.clear(); update(); }

  function buzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* ignore */ } }

  function update() {
    var s = LC.input.touchState;
    for (var k in s) s[k] = false;
    var dir = 5, pause = false;
    var held = {};
    active.forEach(function (t) {
      if (t.kind === 'dpad') dir = dirFrom(t.x, t.y);
      else if (t.kind === 'pause') pause = true;
      else if (t.btn) held[t.btn.def.id] = true;
    });
    s.left = dir === 1 || dir === 4 || dir === 7; s.right = dir === 3 || dir === 6 || dir === 9;
    s.up = dir >= 7; s.down = dir <= 3;
    btns.forEach(function (b) {
      var on = !!held[b.def.id];
      s[b.def.key] = s[b.def.key] || on;
      if (on !== b.on) { b.on = on; b.el.classList.toggle('on', on); drawButton(b.cv, b.def, on); }
    });
    s.start = pause;
    if (pause !== pauseBtn.on) { pauseBtn.on = pause; drawPause(pauseBtn.cv, pause); pauseBtn.el.classList.toggle('on', pause); }
    if (dir !== dirState) { dirState = dir; drawDpad(dpad.cv, dir); }
  }

  LC.input = LC.input || {};
  LC.input.touch = {
    layout: layoutControls,
    isVisible: function () { return visible; },
    redraw: function () {   // after the font is ready
      if (!built) return;
      btns.forEach(function (b) { drawButton(b.cv, b.def, b.on); });
    },
    release: release
  };
})();
