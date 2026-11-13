/* LATENT CLASH — fight SFX: hits, blocks, whiffs, movement, throws, KO (AUDIO module).
 * build(r, out, t, p, rnd): r = context resources, out = destination, t = start, p = pitch factor.
 * Hits escalate light→medium→heavy→special→counter: lower body, longer crunch, extra layers.
 * Blocks are short pitched "tk"/"clank" knocks with little noise — they never sound like hits. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var K = LC.audio._, S = K.S, def = K.defSfx;

  // Shared impact core: click + body drop + crunch. k = size (0.6 light .. 1.3 KO)
  function impact(r, out, t, p, k) {
    S.noise(r, out, t, { c: 'white', hp: 1800, lp: 8000, g: S.ad(0.0003, 0.008 * k), v: 0.9 });
    S.osc(r, out, t, { w: 'sine', f: [[0, 150 / k + 20], [0.11 * k, 44, 'e']], g: [[0, 0], [0.001, 1], [0.07 * k, 0.75], [0.28 * k, 0.0001, 'e']], v: 0.62, drive: 1.8 }, p);
    S.osc(r, out, t, { w: 'p50', f: [[0, 240], [0.1 * k, 75, 'e']], g: S.ad(0.001, 0.14 * k), v: 0.5, lp: 2200 }, p);
    S.osc(r, out, t, { w: 'triangle', f: [[0, 520], [0.06 * k, 190, 'e']], g: S.ad(0.001, 0.09 * k), v: 0.45 }, p);
    S.noise(r, out, t, { c: 'white', drive: 3, lp: [[0, 5200], [0.2 * k, 900, 'e']], hp: 180, g: [[0, 0], [0.001, 1], [0.05, 0.5, 'e'], [0.26 * k, 0.0001, 'e']], v: 1.0 }, p);
    S.noise(r, out, t, { c: 'crackle', lp: 3600, g: S.ad(0.001, 0.14 * k), v: 0.8 });
    S.noise(r, out, t, { c: 'white', bp: 950, q: 1.3, g: S.ad(0.001, 0.09 * k), v: 0.9 }, p);
  }

  def('hit.light', { cat: 'hit', dur: 0.12, poly: 3, guard: 0.03, jitter: 0.04, prio: 2,
    desc: 'tight snap', when: 'a light normal (L) connects',
    build: function (r, o, t, p) {
      S.noise(r, o, t, { c: 'white', hp: 2500, lp: 9000, g: S.ad(0.0003, 0.007), v: 0.9 });
      S.osc(r, o, t, { w: 'p25', f: [[0, 1100], [0.04, 360, 'e']], g: [[0, 0], [0.0008, 1], [0.07, 0.0001, 'e']], v: 0.4, lp: 4000 }, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 2600], [0.09, 1200, 'e']], q: 1.1, g: [[0, 0], [0.0008, 1], [0.025, 0.4, 'e'], [0.11, 0.0001, 'e']], v: 1.2, lp: 6500 }, p);
      S.osc(r, o, t, { w: 'triangle', f: [[0, 420], [0.05, 180, 'e']], g: S.ad(0.001, 0.06), v: 0.5 }, p);
      S.noise(r, o, t, { c: 'crackle', bp: 1800, q: 0.8, g: S.ad(0.001, 0.05), v: 0.5 });
    } });

  def('hit.medium', { cat: 'hit', dur: 0.19, poly: 3, guard: 0.03, jitter: 0.04, prio: 2,
    desc: 'solid thwack', when: 'a medium normal (M) connects',
    build: function (r, o, t, p) {
      S.noise(r, o, t, { c: 'white', hp: 2000, lp: 8000, g: S.ad(0.0003, 0.008), v: 0.75 });
      S.osc(r, o, t, { w: 'sine', f: [[0, 400], [0.075, 100, 'e']], g: [[0, 0], [0.001, 1], [0.03, 0.6], [0.15, 0.0001, 'e']], v: 0.55, drive: 1.5 }, p);
      S.osc(r, o, t, { w: 'p50', f: [[0, 330], [0.06, 150, 'e']], g: S.ad(0.001, 0.08), v: 0.4, lp: 2600 }, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 2000], [0.13, 760, 'e']], q: 0.9, lp: 6000, g: [[0, 0], [0.001, 1], [0.03, 0.45, 'e'], [0.17, 0.0001, 'e']], v: 1.5 }, p);
      S.noise(r, o, t, { c: 'white', drive: 2.5, bp: 1300, q: 0.8, g: S.ad(0.001, 0.07), v: 0.6 }, p);
      S.noise(r, o, t, { c: 'crackle', lp: 4000, g: S.ad(0.001, 0.08), v: 0.6 });
    } });

  def('hit.heavy', { cat: 'hit', dur: 0.32, poly: 3, guard: 0.035, jitter: 0.03, prio: 3,
    desc: 'deep crunch with sub thump', when: 'a heavy normal (H), sweep or throw-level hit connects',
    build: function (r, o, t, p) { impact(r, o, t, p, 1); } });

  def('hit.special', { cat: 'hit', dur: 0.36, poly: 3, guard: 0.035, jitter: 0.02, prio: 3,
    desc: 'crunch + zap + sparkle', when: 'a special move or super hit connects (generic layer)',
    build: function (r, o, t, p) {
      impact(r, o, t, p, 0.95);
      S.osc(r, o, t, { w: 'sawtooth', f: [[0, 2600], [0.1, 520, 'e']], g: S.ad(0.001, 0.11), v: 0.13, lp: 5200 }, p);
      [0, 0.028, 0.056].forEach(function (d, i) {
        S.osc(r, o, t + 0.02 + d, { w: 'sine', f: [1568, 2093, 2637][i], g: S.ad(0.001, 0.2), v: 0.1, fm: { r: 2, i: [[0, 1.2], [0.15, 0.1, 'e']] } }, p);
      });
    } });

  def('hit.counter', { cat: 'hit', dur: 0.46, poly: 2, guard: 0.05, prio: 4,
    desc: 'heavy crunch + bright metallic ting', when: 'any hit that lands as a COUNTER (in addition to nothing else)',
    build: function (r, o, t, p) {
      impact(r, o, t, p, 1.05);
      S.bell(r, o, t + 0.004, 1320, 0.2, 0.42, [1, 2.76, 5.4], [1, 0.45, 0.2], p);
      S.noise(r, o, t, { c: 'metal', bp: 5200, q: 2, g: S.ad(0.0005, 0.05), v: 0.22 }, p);
      S.osc(r, o, t + 0.01, { w: 'sine', f: [[0, 880], [0.08, 1760, 'e']], g: S.ad(0.002, 0.12), v: 0.1 }, p);
    } });

  def('block.light', { cat: 'block', dur: 0.08, poly: 3, guard: 0.03, jitter: 0.05, prio: 2,
    desc: 'short dull "tk"', when: 'a light/medium attack is blocked',
    build: function (r, o, t, p) {
      var b = S.bus(r, o, 1, { lp: 4200 });
      S.noise(r, b, t, { c: 'white', hp: 1200, g: S.ad(0.0003, 0.005), v: 0.55 });
      S.osc(r, b, t, { w: 'sine', f: [[0, 920], [0.03, 720, 'e']], g: S.ad(0.0008, 0.038), v: 0.6 }, p);
      S.osc(r, b, t, { w: 'triangle', f: [[0, 1450], [0.02, 1150, 'e']], g: S.ad(0.0005, 0.02), v: 0.3 }, p);
      S.noise(r, b, t, { c: 'white', bp: 1600, q: 3, g: S.ad(0.0005, 0.03), v: 0.5 }, p);
      S.osc(r, b, t, { w: 'sine', f: [[0, 220], [0.03, 150, 'e']], g: S.ad(0.001, 0.03), v: 0.3 }, p);
    } });

  def('block.heavy', { cat: 'block', dur: 0.2, poly: 3, guard: 0.035, jitter: 0.04, prio: 2,
    desc: 'muted metallic clank', when: 'a heavy attack or special is blocked',
    build: function (r, o, t, p) {
      var b = S.bus(r, o, 1, { lp: 3600 });
      S.noise(r, b, t, { c: 'white', hp: 1000, g: S.ad(0.0003, 0.006), v: 0.7 });
      S.osc(r, b, t, { w: 'sine', f: [[0, 170], [0.06, 92, 'e']], g: S.ad(0.001, 0.085), v: 0.7 }, p);
      S.bell(r, b, t, 520, 0.3, 0.17, [1, 2.4, 3.9, 5.1], [1, 0.6, 0.35, 0.2], p);
      S.noise(r, b, t, { c: 'white', bp: 1150, q: 2, g: S.ad(0.0008, 0.06), v: 0.55 }, p);
    } });

  function whoosh(r, o, t, p, f0, f1, f2, len, q, v, low) {
    S.noise(r, o, t, { c: 'white', bp: [[0, f0], [len * 0.45, f1, 'e'], [len, f2, 'e']], q: q, lp: 7000, g: [[0, 0], [len * 0.35, 1], [len, 0.0001, 'e']], v: v }, p);
    S.noise(r, o, t, { c: 'pink', lp: f1 * 0.6, g: [[0, 0], [len * 0.4, 1], [len, 0.0001, 'e']], v: v * 0.45 }, p);
    if (low) S.noise(r, o, t, { c: 'brown', lp: 420, g: [[0, 0], [len * 0.35, 1], [len, 0.0001, 'e']], v: low }, p);
  }
  def('whiff.light', { cat: 'whiff', dur: 0.11, poly: 2, guard: 0.04, jitter: 0.06,
    desc: 'small fast swish', when: 'a light normal is thrown (startup), hit or not',
    build: function (r, o, t, p) { whoosh(r, o, t, p, 2200, 4400, 2600, 0.1, 1.6, 0.5, 0); } });
  def('whiff.medium', { cat: 'whiff', dur: 0.18, poly: 2, guard: 0.04, jitter: 0.05,
    desc: 'medium swoosh', when: 'a medium normal is thrown',
    build: function (r, o, t, p) { whoosh(r, o, t, p, 1300, 3000, 1500, 0.17, 1.3, 0.6, 0.2); } });
  def('whiff.heavy', { cat: 'whiff', dur: 0.28, poly: 2, guard: 0.05, jitter: 0.04,
    desc: 'big heavy whoomp', when: 'a heavy normal is thrown',
    build: function (r, o, t, p) {
      whoosh(r, o, t, p, 650, 2000, 850, 0.26, 1.0, 0.7, 0.55);
      S.osc(r, o, t, { w: 'sine', f: [[0, 70], [0.2, 110]], g: [[0, 0], [0.08, 1], [0.26, 0.0001, 'e']], v: 0.22 }, p);
    } });

  def('jump', { cat: 'move', dur: 0.13, poly: 2, guard: 0.06, jitter: 0.05,
    desc: 'soft hop: air puff + tiny rising blip', when: 'the jump leaves the ground (after pre-jump)',
    build: function (r, o, t, p) {
      S.osc(r, o, t, { w: 's12', f: [[0, 300], [0.09, 640, 'e']], g: [[0, 0], [0.004, 1], [0.1, 0.0001, 'e']], v: 0.14, lp: 3000 }, p);
      S.noise(r, o, t, { c: 'white', bp: 1800, q: 0.8, g: S.ad(0.002, 0.06), v: 0.28 }, p);
      S.osc(r, o, t, { w: 'sine', f: [[0, 160], [0.05, 90, 'e']], g: S.ad(0.002, 0.05), v: 0.3 }, p);
    } });

  def('land', { cat: 'move', dur: 0.09, poly: 2, guard: 0.06, jitter: 0.05,
    desc: 'soft footfall thud', when: 'a fighter lands from a jump',
    build: function (r, o, t, p) {
      S.osc(r, o, t, { w: 'sine', f: [[0, 140], [0.06, 68, 'e']], g: S.ad(0.001, 0.07), v: 0.6 }, p);
      S.noise(r, o, t, { c: 'white', hp: 200, lp: 1500, g: S.ad(0.001, 0.05), v: 0.35 }, p);
      S.noise(r, o, t, { c: 'white', bp: 3000, q: 1, g: S.ad(0.002, 0.03), v: 0.1 }, p);
    } });

  def('dash', { cat: 'move', dur: 0.19, poly: 2, guard: 0.08, jitter: 0.04,
    desc: 'quick swoosh + scuff', when: 'forward dash or back-dash starts',
    build: function (r, o, t, p) {
      S.noise(r, o, t, { c: 'white', bp: [[0, 900], [0.11, 3200, 'e']], q: 1.2, lp: 6500, g: [[0, 0], [0.02, 1], [0.18, 0.0001, 'e']], v: 0.5 }, p);
      S.noise(r, o, t, { c: 'white', hp: 2000, lp: 6000, g: S.ad(0.001, 0.04), v: 0.18 });
      S.osc(r, o, t, { w: 'sine', f: [[0, 130], [0.05, 80, 'e']], g: S.ad(0.001, 0.05), v: 0.4 }, p);
    } });

  def('down', { cat: 'move', dur: 0.34, poly: 2, guard: 0.1,
    desc: 'body hits the floor, small bounce', when: 'a knocked-down fighter hits the ground (down impact)',
    build: function (r, o, t, p) {
      S.osc(r, o, t, { w: 'sine', f: [[0, 112], [0.12, 42, 'e']], g: [[0, 0], [0.001, 1], [0.26, 0.0001, 'e']], v: 0.95, drive: 1.4 }, p);
      S.noise(r, o, t, { c: 'brown', lp: 800, g: S.ad(0.002, 0.18), v: 0.75 }, p);
      S.noise(r, o, t, { c: 'crackle', lp: 2500, g: S.ad(0.001, 0.06), v: 0.45 });
      S.osc(r, o, t + 0.15, { w: 'sine', f: [[0, 92], [0.07, 50, 'e']], g: S.ad(0.001, 0.08), v: 0.42 }, p);
      S.noise(r, o, t + 0.15, { c: 'white', lp: 1200, g: S.ad(0.001, 0.05), v: 0.3 }, p);
    } });

  def('throw.grab', { cat: 'throw', dur: 0.14, poly: 2, guard: 0.1,
    desc: 'cloth grab + whup', when: 'a throw connects (grab frame)',
    build: function (r, o, t, p) {
      S.noise(r, o, t, { c: 'white', bp: 1800, q: 0.9, lp: 6000, g: [[0, 0], [0.004, 1], [0.1, 0.0001, 'e']], v: 0.6 }, p);
      S.noise(r, o, t, { c: 'crackle', bp: 3000, q: 0.8, g: S.ad(0.002, 0.08), v: 0.4 });
      S.osc(r, o, t, { w: 'p50', f: [[0, 260], [0.06, 170, 'e']], g: S.ad(0.002, 0.07), v: 0.16, lp: 1500 }, p);
      S.osc(r, o, t, { w: 'sine', f: [[0, 190], [0.05, 100, 'e']], g: S.ad(0.001, 0.05), v: 0.45 }, p);
    } });

  def('throw.slam', { cat: 'throw', dur: 0.46, poly: 2, guard: 0.1, prio: 3,
    desc: 'big floor slam with crunch and debris', when: 'the thrown fighter hits the ground',
    build: function (r, o, t, p) {
      S.osc(r, o, t, { w: 'sine', f: [[0, 125], [0.3, 34, 'e']], g: [[0, 0], [0.001, 1], [0.12, 0.7], [0.44, 0.0001, 'e']], v: 1, drive: 2 }, p);
      S.noise(r, o, t, { c: 'white', drive: 3, lp: [[0, 3000], [0.3, 500, 'e']], g: [[0, 0], [0.001, 1], [0.32, 0.0001, 'e']], v: 0.6 }, p);
      S.noise(r, o, t, { c: 'brown', lp: 600, g: S.ad(0.003, 0.35), v: 0.8 }, p);
      S.noise(r, o, t, { c: 'crackle', lp: 3000, g: S.ad(0.001, 0.15), v: 0.55 });
      S.noise(r, o, t, { c: 'white', bp: 700, q: 1.4, g: S.ad(0.001, 0.1), v: 0.5 }, p);
      [0.1, 0.17, 0.25].forEach(function (d, i) {
        S.noise(r, o, t + d, { c: 'white', bp: 2800 - i * 400, q: 2, g: S.ad(0.001, 0.025), v: 0.18 - i * 0.04 }, p);
      });
    } });

  def('throw.tech', { cat: 'throw', dur: 0.3, poly: 1, guard: 0.1, prio: 3,
    desc: 'bright clash + push-apart whoosh', when: 'a throw is teched (both fighters pushed apart)',
    build: function (r, o, t, p) {
      S.bell(r, o, t, 1760, 0.17, 0.2, [1, 2.4, 3.1], [1, 0.4, 0.25], p);
      S.bell(r, o, t + 0.035, 2350, 0.12, 0.18, [1, 2.4, 3.1], [1, 0.4, 0.25], p);
      S.noise(r, o, t, { c: 'white', hp: 2500, lp: 8000, g: S.ad(0.0005, 0.05), v: 0.55 });
      S.noise(r, o, t + 0.02, { c: 'white', bp: [[0, 4000], [0.22, 1200, 'e']], q: 1.2, g: [[0, 0], [0.03, 1], [0.24, 0.0001, 'e']], v: 0.35 }, p);
      S.osc(r, o, t, { w: 'sine', f: [[0, 200], [0.06, 110, 'e']], g: S.ad(0.001, 0.07), v: 0.4 }, p);
    } });

  def('ko', { cat: 'hit', dur: 2.0, poly: 1, guard: 0.3, prio: 5, wet: 0.5, irDur: 1.6, tail: 1.2, stereo: true,
    desc: 'the biggest impact: crunch, sub boom, crash, gong-like ring, long tail', when: 'the KO hit lands (with hit-stop / slow-mo)',
    build: function (r, o, t, p) {
      impact(r, o, t, p, 1.3);
      S.osc(r, o, t, { w: 'sine', f: [[0, 92], [0.8, 28, 'e']], g: [[0, 0], [0.002, 1], [0.3, 0.55], [1.7, 0.0001, 'e']], v: 0.95, drive: 1.5 }, p);
      var wide = S.bus(r, o, 1, { pan: [[0, -0.4], [1.5, 0.4]], t: t });
      S.noise(r, wide, t, { c: 'white', hp: 2600, lp: 8500, g: [[0, 0], [0.002, 1], [0.2, 0.35, 'e'], [1.8, 0.0001, 'e']], v: 0.3 });
      S.noise(r, o, t, { c: 'brown', lp: 300, g: [[0, 0], [0.01, 1], [1.4, 0.0001, 'e']], v: 0.8 }, p);
      S.noise(r, o, t, { c: 'crackle', bp: 2400, q: 0.7, g: S.ad(0.002, 0.6), v: 0.45 });
      S.bell(r, o, t + 0.01, 196, 0.16, 1.7, [1, 2.0, 2.98, 4.1], [1, 0.5, 0.3, 0.15], p);
    } });
})();
