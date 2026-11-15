/* LATENT CLASH — character SFX (AUDIO module).
 * Claude 娘: warm — FM bells, chimes, paper/ink, major-key sparkle (D major / lydian colours).
 * DeepSeek 娘: cool — water, bubbles, splashes, sonar; quick and bouncy (E minor pentatonic).
 * GPT 娘: regal dragon — cold teal fire (airy roar + icy shimmer), claws (metal ring), wing beats,
 *         low growls and heavy floor impacts (A minor / open fifths). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var K = LC.audio._, S = K.S, def = K.defSfx;
  var N = function (s) { return K.mtof(K.midi(s)); };

  function fmBell(r, out, t, f, v, dec, p, ratio, idx) {
    S.osc(r, out, t, { w: 'sine', f: f, g: [[0, 0], [0.002, 1], [dec, 0.0001, 'e']], v: v, fm: { r: ratio || 3.5, i: [[0, idx || 2.2], [dec * 0.5, 0.12, 'e']] } }, p);
  }
  function punch(r, out, t, p, k) {     // compact body hit used by character impacts
    S.noise(r, out, t, { c: 'white', hp: 1800, lp: 8000, g: S.ad(0.0003, 0.007), v: 0.8 });
    S.osc(r, out, t, { w: 'sine', f: [[0, 300 * k], [0.07, 105 * k, 'e']], g: S.ad(0.001, 0.12), v: 0.6, drive: 1.5 }, p);
    S.noise(r, out, t, { c: 'white', bp: [[0, 1800], [0.1, 800, 'e']], q: 1, lp: 6000, g: S.ad(0.001, 0.12), v: 0.9 }, p);
  }
  // amplitude points that "roar" (fast irregular tremolo) between t0 and t1 (relative)
  function roar(t0, t1, lvl, rate, depth, rnd) {
    var pts = [[0, 0], [t0, lvl]], t = t0;
    while (t < t1) { t += 1 / rate; pts.push([Math.min(t, t1), lvl * (1 - depth * rnd())]); }
    return pts;
  }

  // ---- Claude 娘 ---------------------------------------------------------------------
  def('claude.spark', { cat: 'claude', dur: 0.5, poly: 2, guard: 0.1, wet: 0.3,
    desc: 'shimmering cast: D-major bell triplet + sparkle', when: 'Spark Shot (星芒弹) leaves the pen (first active frame)',
    build: function (r, o, t, p) {
      S.osc(r, o, t, { w: 'sine', f: [[0, 320], [0.06, 640, 'e']], g: S.ad(0.002, 0.07), v: 0.22 }, p);
      ['D6', 'F#6', 'A6'].forEach(function (n, i) { fmBell(r, o, t + i * 0.04, N(n), 0.15, 0.4, p); });
      S.osc(r, o, t, { w: 'triangle', f: N('D5'), g: S.ad(0.003, 0.18), v: 0.12 }, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 1500], [0.25, 4200, 'e']], q: 1.2, g: [[0, 0], [0.05, 1], [0.3, 0.0001, 'e']], v: 0.24 }, p);
      S.noise(r, o, t + 0.03, { c: 'crackle', hp: 4000, lp: 10000, g: S.ad(0.01, 0.35), v: 0.25 });
    } });

  def('claude.sparkHit', { cat: 'claude', dur: 0.38, poly: 2, guard: 0.06, prio: 3, wet: 0.2,
    desc: 'starburst impact: bright ping + crackle + thump', when: 'Spark Shot hits (or is blocked, at lower vol)',
    build: function (r, o, t, p) {
      punch(r, o, t, p, 1);
      S.bell(r, o, t, 1760, 0.16, 0.3, [1, 2.76, 5.4], [1, 0.4, 0.15], p);
      fmBell(r, o, t + 0.02, N('A6'), 0.09, 0.25, p);
      S.noise(r, o, t, { c: 'crackle', bp: 3000, q: 0.7, g: S.ad(0.001, 0.2), v: 0.5 });
    } });

  def('claude.sonnet', { cat: 'claude', dur: 0.6, poly: 1, guard: 0.15, wet: 0.3,
    desc: 'rising arpeggio whoosh with fluttering pages', when: 'Sonnet Rise (十四行升) start-up → rise',
    build: function (r, o, t, p) {
      ['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6'].forEach(function (n, i) {
        var tt = t + i * 0.05;
        S.osc(r, o, tt, { w: 's25', f: N(n), g: [[0, 0], [0.003, 1], [0.12, 0.0001, 'e']], v: 0.1, lp: 4500 }, p);
        fmBell(r, o, tt, N(n), 0.07, 0.25, p, 2);
      });
      S.noise(r, o, t, { c: 'white', bp: [[0, 700], [0.35, 5000, 'e']], q: 1.1, lp: 8000, g: [[0, 0], [0.2, 1], [0.45, 0.0001, 'e']], v: 0.42 }, p);
      S.noise(r, o, t + 0.05, { c: 'crackle', bp: 2800, q: 0.9, g: [[0, 0], [0.1, 1], [0.45, 0.0001, 'e']], v: 0.45 });
      S.osc(r, o, t, { w: 'sine', f: [[0, 120], [0.2, 240, 'e']], g: S.ad(0.01, 0.2), v: 0.3 }, p);
    } });

  def('claude.haiku', { cat: 'claude', dur: 0.24, poly: 3, guard: 0.05,
    desc: 'crisp brush slash + koto-like pluck; pitch 1 / 1.12 / 1.26 for the 3 hits (5-7-5)', when: 'each Haiku Slash hit (opts.pitch per hit)',
    build: function (r, o, t, p) {
      S.noise(r, o, t, { c: 'white', bp: [[0, 6000], [0.08, 1500, 'e']], q: 1.5, lp: 8000, g: [[0, 0], [0.004, 1], [0.1, 0.0001, 'e']], v: 0.6 }, p);
      S.noise(r, o, t, { c: 'crackle', bp: 2500, q: 0.8, g: S.ad(0.002, 0.1), v: 0.45 });
      S.osc(r, o, t + 0.01, { w: 'sine', f: N('A5'), g: [[0, 0], [0.002, 1], [0.22, 0.0001, 'e']], v: 0.16, fm: { r: 1, i: [[0, 3], [0.12, 0.1, 'e']] } }, p);
      S.noise(r, o, t, { c: 'white', hp: 2500, lp: 9000, g: S.ad(0.0003, 0.006), v: 0.5 });
    } });

  def('claude.guardrail', { cat: 'claude', dur: 0.62, poly: 1, guard: 0.15, wet: 0.35,
    desc: 'glassy shield hum rising into place', when: 'Guardrail (宪章护栏) stance starts (barrier appears)',
    build: function (r, o, t, p) {
      [[1046.5, 0.12], [1568, 0.08], [2093, 0.05]].forEach(function (x) {
        S.osc(r, o, t, { w: 'sine', f: [[0, x[0] * 0.8], [0.14, x[0], 'e']], g: [[0, 0], [0.03, 1], [0.35, 0.6], [0.6, 0.0001, 'e']], v: x[1], fm: { r: 3, i: [[0, 1.5], [0.3, 0.3]] } }, p);
      });
      S.osc(r, o, t, { w: 'triangle', f: [[0, 180], [0.14, 220, 'e']], g: [[0, 0], [0.05, 1], [0.6, 0.0001, 'e']], v: 0.2, vib: [11, 25, 0.05] }, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 400], [0.15, 2200, 'e']], q: 1.5, g: [[0, 0], [0.06, 1], [0.25, 0.0001, 'e']], v: 0.25 }, p);
    } });

  def('claude.beam', { cat: 'claude', dur: 1.25, poly: 1, guard: 0.4, prio: 5, wet: 0.35, stereo: true,
    desc: '≈1.2 s: charge-up, roaring bright glyph beam, sparkling tail', when: 'Magnum Opus beam fires (after the super flash)',
    build: function (r, o, t, p, rnd) {
      var C = 0.25, F = 0.95;
      // charge
      S.osc(r, o, t, { w: 'sine', f: [[0, 300], [C, 1200, 'e']], fm: { r: 1.5, i: [[0, 3], [C, 1]] }, g: [[0, 0], [C, 1], [C + 0.05, 0.0001, 'e']], v: 0.18 }, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 600], [C, 4000, 'e']], q: 2, g: [[0, 0.0001], [C, 1, 'e'], [C + 0.03, 0.2]], v: 0.4 }, p);
      // beam body
      S.osc(r, o, t + C, { w: 'sine', f: [[0, 90], [0.15, 73.4, 'e']], g: [[0, 0], [0.01, 1], [F - C, 0.8], [F - C + 0.3, 0.0001, 'e']], v: 0.55, drive: 1.5 }, p);
      var body = S.bus(r, o, 1, { lp: [[0, 1500], [0.08, 3600, 'e'], [F - C, 2600], [F - C + 0.3, 800, 'e']], t: t + C });
      ['D3', 'A3', 'D4', 'F#4', 'A4'].forEach(function (n) {
        S.osc(r, body, t + C, { w: 'sawtooth', f: N(n), det: -9, g: roar(0.01, F - C, 1, 22, 0.35, rnd).concat([[F - C + 0.3, 0.0001, 'e']]), v: 0.08 }, p);
        S.osc(r, body, t + C, { w: 'sawtooth', f: N(n), det: 9, g: roar(0.01, F - C, 1, 19, 0.35, rnd).concat([[F - C + 0.3, 0.0001, 'e']]), v: 0.08 }, p);
      });
      S.noise(r, o, t + C, { c: 'white', lp: 3200, hp: 300, g: roar(0.01, F - C, 1, 25, 0.5, rnd).concat([[F - C + 0.25, 0.0001, 'e']]), v: 0.32 });
      S.noise(r, o, t + C, { c: 'white', hp: 1800, lp: 5000, g: S.ad(0.001, 0.12), v: 0.4 });
      // streaming glyph sparkles, panned across
      var notes = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7'];
      for (var i = 0; i < 16; i++) {
        var tt = C + 0.03 + i * 0.045, w = S.bus(r, o, 1, { pan: (rnd() * 2 - 1) * 0.8, t: t + tt });
        fmBell(r, w, t + tt, N(notes[Math.floor(rnd() * notes.length)]), 0.045, 0.2, p, 3.5);
      }
      fmBell(r, o, t + F, N('D6'), 0.1, 0.5, p);
      fmBell(r, o, t + F + 0.05, N('A6'), 0.08, 0.5, p);
    } });

  // ---- DeepSeek 娘 -------------------------------------------------------------------
  def('deepseek.wave', { cat: 'deepseek', dur: 0.55, poly: 2, guard: 0.1, wet: 0.2,
    desc: 'rushing water with bubbles', when: 'Whale Wave (鲸波) spawns at her foot',
    build: function (r, o, t, p, rnd) {
      S.osc(r, o, t, { w: 'sine', f: [[0, 170], [0.08, 90, 'e']], g: S.ad(0.002, 0.1), v: 0.35 }, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 600], [0.2, 1800, 'e'], [0.5, 900, 'e']], q: 0.7, lp: 6000, g: [[0, 0], [0.07, 1], [0.25, 0.7], [0.5, 0.0001, 'e']], v: 0.5 }, p);
      S.noise(r, o, t, { c: 'brown', lp: 700, g: [[0, 0], [0.05, 1], [0.45, 0.0001, 'e']], v: 0.4 }, p);
      for (var i = 0; i < 6; i++) S.bubble(r, o, t + 0.04 + rnd() * 0.36, 380 + rnd() * 520, 0.11, 0.04 + rnd() * 0.03, p);
    } });

  def('deepseek.waveHit', { cat: 'deepseek', dur: 0.42, poly: 2, guard: 0.06, prio: 3, wet: 0.2,
    desc: 'splash: thump + spray + droplets', when: 'Whale Wave hits (or is blocked, at lower vol)',
    build: function (r, o, t, p, rnd) {
      punch(r, o, t, p, 0.85);
      S.noise(r, o, t, { c: 'white', bp: [[0, 3200], [0.25, 700, 'e']], q: 0.8, lp: 7000, g: S.ad(0.002, 0.3), v: 0.6 }, p);
      S.noise(r, o, t, { c: 'crackle', hp: 2000, lp: 9000, g: S.ad(0.002, 0.2), v: 0.35 });
      for (var i = 0; i < 5; i++) S.bubble(r, o, t + 0.03 + rnd() * 0.2, 700 + rnd() * 700, 0.1, 0.035, p);
    } });

  def('deepseek.breach', { cat: 'deepseek', dur: 0.52, poly: 1, guard: 0.15, wet: 0.2,
    desc: 'kick thump + rising spray whoosh + pentatonic bloops', when: 'Breach (鲸跃) start-up → rise',
    build: function (r, o, t, p) {
      S.osc(r, o, t, { w: 'sine', f: [[0, 160], [0.08, 60, 'e']], g: S.ad(0.001, 0.12), v: 0.6, drive: 1.4 }, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 500], [0.3, 3500, 'e']], q: 1, lp: 7000, g: [[0, 0], [0.15, 1], [0.45, 0.0001, 'e']], v: 0.5 }, p);
      S.noise(r, o, t + 0.05, { c: 'crackle', hp: 3000, lp: 9000, g: S.ad(0.05, 0.3), v: 0.3 });
      ['E5', 'G5', 'A5', 'B5', 'D6'].forEach(function (n, i) { S.bubble(r, o, t + 0.04 + i * 0.04, N(n), 0.12, 0.045, p); });
    } });

  def('deepseek.dive', { cat: 'deepseek', dur: 0.72, poly: 1, guard: 0.15, wet: 0.25,
    desc: 'plunge "bloosh" + low drop + trail of bubbles', when: 'Deep Dive sinks into the pool (diveIn)',
    build: function (r, o, t, p, rnd) {
      S.noise(r, o, t, { c: 'white', lp: [[0, 4000], [0.3, 500, 'e']], g: S.ad(0.003, 0.35), v: 0.6 }, p);
      S.osc(r, o, t, { w: 'sine', f: [[0, 320], [0.3, 60, 'e']], g: S.ad(0.003, 0.32), v: 0.45 }, p);
      var uw = S.bus(r, o, 1, { lp: 2200, t: t });
      for (var i = 0; i < 9; i++) S.bubble(r, uw, t + 0.12 + i * 0.055 + rnd() * 0.02, 300 + rnd() * 420, 0.16 * (1 - i / 11), 0.05, p);
    } });

  def('deepseek.emerge', { cat: 'deepseek', dur: 0.5, poly: 1, guard: 0.15, wet: 0.2,
    desc: 'burst out of the water: thump + upward splash + bubbles', when: 'Deep Dive bursts out (diveOut)',
    build: function (r, o, t, p, rnd) {
      S.osc(r, o, t, { w: 'sine', f: [[0, 210], [0.1, 80, 'e']], g: S.ad(0.001, 0.13), v: 0.55, drive: 1.3 }, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 800], [0.2, 4000, 'e']], q: 0.8, lp: 8000, g: [[0, 0], [0.01, 1], [0.4, 0.0001, 'e']], v: 0.6 }, p);
      S.noise(r, o, t, { c: 'crackle', hp: 2500, lp: 9000, g: S.ad(0.005, 0.25), v: 0.35 });
      for (var i = 0; i < 4; i++) S.bubble(r, o, t + 0.02 + i * 0.03, 500 + i * 160 + rnd() * 100, 0.12, 0.04, p);
    } });

  def('deepseek.chain', { cat: 'deepseek', dur: 0.24, poly: 3, guard: 0.05, prio: 2,
    desc: 'snappy wet punch; pitch 1 / 1.12 / 1.3 for chain1-3', when: 'each Chain of Thought hit/step (opts.pitch per step)',
    build: function (r, o, t, p) {
      punch(r, o, t, p, 1);
      S.bubble(r, o, t + 0.01, 620, 0.16, 0.04, p);
      S.noise(r, o, t, { c: 'white', hp: 1500, lp: 6000, g: S.ad(0.001, 0.1), v: 0.3 }, p);
    } });

  def('deepseek.diveKick', { cat: 'deepseek', dur: 0.42, poly: 1, guard: 0.15,
    desc: 'descending whoosh with a water trail', when: 'Dive Kick (俯冲) starts its descent',
    build: function (r, o, t, p, rnd) {
      S.noise(r, o, t, { c: 'white', bp: [[0, 4200], [0.32, 1000, 'e']], q: 1.2, lp: 8000, g: [[0, 0], [0.05, 1], [0.38, 0.0001, 'e']], v: 0.5 }, p);
      S.noise(r, o, t, { c: 'white', bp: 1200, q: 0.8, g: roar(0.02, 0.32, 0.7, 30, 0.6, rnd).concat([[0.4, 0.0001, 'e']]), v: 0.3 }, p);
      for (var i = 0; i < 3; i++) S.bubble(r, o, t + 0.1 + i * 0.08, 500 + rnd() * 300, 0.08, 0.04, p);
    } });

  def('deepseek.whale', { cat: 'deepseek', dur: 2.0, poly: 1, guard: 0.5, prio: 5, wet: 0.4, irDur: 1.6, stereo: true,
    desc: '≈1.5 s: low whale-song call gliding upward, then a colossal splash-crash', when: 'Whale Fall: R1 starts to breach (after the super flash)',
    build: function (r, o, t, p, rnd) {
      var X = 0.82;
      S.osc(r, o, t, { w: 'reed', f: [[0, 104], [0.28, 128], [0.78, 330, 'e']], g: [[0, 0], [0.15, 1], [0.65, 0.85], [0.84, 0.0001, 'e']], v: 0.3, vib: [6, 35, 0.12], lp: 1400, lq: 2 }, p);
      S.osc(r, o, t, { w: 'sine', f: [[0, 312], [0.28, 384], [0.78, 990, 'e']], g: [[0, 0], [0.2, 1], [0.6, 0.6], [0.82, 0.0001, 'e']], v: 0.08, vib: [6, 35, 0.12] }, p);
      S.noise(r, o, t, { c: 'brown', lp: 280, g: [[0, 0], [0.4, 1], [X, 0.6]], v: 0.4 }, p);
      // crash
      S.osc(r, o, t + X, { w: 'sine', f: [[0, 105], [0.9, 30, 'e']], g: [[0, 0], [0.003, 1], [0.3, 0.6], [1.15, 0.0001, 'e']], v: 0.95, drive: 1.6 }, p);
      S.noise(r, o, t + X, { c: 'white', hp: 1800, lp: 8000, g: S.ad(0.0005, 0.015), v: 0.6 });
      S.noise(r, o, t + X, { c: 'white', bp: [[0, 2600], [0.6, 600, 'e']], q: 0.6, lp: 7000, g: [[0, 0], [0.004, 1], [0.15, 0.6], [0.9, 0.0001, 'e']], v: 0.75 }, p);
      var wide = S.bus(r, o, 1, { pan: [[0, 0.5], [1, -0.5]], t: t + X });
      S.noise(r, wide, t + X, { c: 'white', hp: 3200, lp: 9000, g: [[0, 0], [0.003, 1], [0.15, 0.4, 'e'], [1.1, 0.0001, 'e']], v: 0.28 });
      S.noise(r, o, t + X, { c: 'crackle', hp: 1500, lp: 9000, g: S.ad(0.005, 0.6), v: 0.4 });
      S.noise(r, o, t + X, { c: 'brown', lp: 500, g: S.ad(0.005, 0.8), v: 0.7 }, p);
      for (var i = 0; i < 10; i++) S.bubble(r, o, t + X + 0.05 + rnd() * 0.45, 350 + rnd() * 700, 0.1, 0.05, p);
    } });

  // ---- GPT 娘 ------------------------------------------------------------------------
  function wingFlap(r, o, t, p, k, v) {   // low "fwump": filtered noise swell + sub push
    S.noise(r, o, t, { c: 'pink', bp: [[0, 260 * k], [0.12, 520 * k, 'e']], q: 0.8, lp: 1800, g: [[0, 0], [0.05, 1], [0.18, 0.0001, 'e']], v: 0.7 * v }, p);
    S.osc(r, o, t + 0.02, { w: 'sine', f: [[0, 90 * k], [0.12, 55 * k, 'e']], g: S.ad(0.02, 0.14), v: 0.4 * v }, p);
  }
  function icyShimmer(r, o, t, len, v, p, rnd) {   // cold glassy glints
    ['A6', 'E7', 'B6', 'E6', 'A7'].forEach(function (n, i) {
      var tt = t + (i / 5) * len * 0.8 + rnd() * 0.03;
      S.osc(r, o, tt, { w: 'sine', f: N(n), g: [[0, 0], [0.003, 1], [0.18, 0.0001, 'e']], v: v, fm: { r: 2.41, i: [[0, 1.4], [0.1, 0.1, 'e']] } }, p);
    });
  }

  def('gpt.breath', { cat: 'gpt', dur: 0.62, poly: 2, guard: 0.1, wet: 0.25,
    desc: 'sustained teal dragon-fire: airy roar, crackle, icy shimmer, loop-like tail', when: 'dragon-fire breath starts (first active frame)',
    build: function (r, o, t, p, rnd) {
      var L = 0.5;
      S.noise(r, o, t, { c: 'white', bp: [[0, 900], [0.06, 1600, 'e'], [L, 1300]], q: 0.6, lp: 6500, g: roar(0.04, L, 1, 24, 0.35, rnd).concat([[L + 0.1, 0.0001, 'e']]), v: 0.45 }, p);
      S.noise(r, o, t, { c: 'pink', lp: 900, hp: 90, g: roar(0.05, L, 1, 17, 0.3, rnd).concat([[L + 0.1, 0.0001, 'e']]), v: 0.5 }, p);
      S.noise(r, o, t + 0.02, { c: 'crackle', hp: 2500, lp: 9000, g: [[0, 0], [0.04, 1], [L - 0.02, 0.8], [L + 0.08, 0.0001, 'e']], v: 0.35 });
      S.osc(r, o, t, { w: 'sawtooth', f: N('A2'), g: [[0, 0], [0.05, 1], [L, 0.8], [L + 0.1, 0.0001, 'e']], v: 0.07, lp: 600, vib: [9, 30, 0] }, p);
      S.osc(r, o, t, { w: 'sine', f: [[0, 180], [0.06, 110, 'e']], g: S.ad(0.004, 0.1), v: 0.3 }, p);
      icyShimmer(r, o, t + 0.05, L, 0.05, p, rnd);
    } });

  def('gpt.rise', { cat: 'gpt', dur: 0.55, poly: 1, guard: 0.15, wet: 0.2,
    desc: 'rising claw uppercut: sharp upward whoosh, metallic claw ring, wing flap', when: 'rising claw (anti-air special) start-up → rise',
    build: function (r, o, t, p) {
      S.noise(r, o, t, { c: 'white', bp: [[0, 800], [0.28, 6000, 'e']], q: 1.3, lp: 9000, g: [[0, 0], [0.12, 1], [0.34, 0.0001, 'e']], v: 0.6 }, p);
      S.noise(r, o, t + 0.04, { c: 'white', hp: 3000, lp: 9000, g: S.ad(0.0005, 0.01), v: 0.5 });
      S.bell(r, o, t + 0.04, 2350, 0.09, 0.3, [1, 1.47, 2.09, 2.76], [1, 0.6, 0.4, 0.2], p);
      S.noise(r, o, t + 0.04, { c: 'metal', bp: 4200, q: 3, g: S.ad(0.001, 0.2), v: 0.35 }, p);
      S.osc(r, o, t, { w: 'sine', f: [[0, 140], [0.25, 320, 'e']], g: S.ad(0.01, 0.22), v: 0.25 }, p);
      wingFlap(r, o, t + 0.2, p, 1, 0.9);
    } });

  def('gpt.call', { cat: 'gpt', dur: 0.5, poly: 1, guard: 0.15, prio: 3, wet: 0.15,
    desc: 'command grab connects: quick snatch + low wing-beat lift', when: 'command grab connects (victim seized)',
    build: function (r, o, t, p) {
      S.noise(r, o, t, { c: 'white', bp: [[0, 3000], [0.05, 1200, 'e']], q: 1, lp: 7000, g: S.ad(0.001, 0.07), v: 0.8 }, p);
      S.osc(r, o, t, { w: 'sine', f: [[0, 260], [0.05, 120, 'e']], g: S.ad(0.001, 0.08), v: 0.5, drive: 1.4 }, p);
      S.noise(r, o, t + 0.005, { c: 'metal', bp: 3600, q: 2.5, g: S.ad(0.001, 0.08), v: 0.25 }, p);
      wingFlap(r, o, t + 0.12, p, 0.8, 1.1);
      wingFlap(r, o, t + 0.3, p, 0.9, 0.6);
    } });

  def('gpt.callSlam', { cat: 'gpt', dur: 0.95, poly: 1, guard: 0.15, prio: 4, wet: 0.25,
    desc: 'command-grab slam: heavy ground impact with rumble', when: 'command grab: victim hits the floor',
    build: function (r, o, t, p) {
      S.noise(r, o, t, { c: 'white', hp: 1500, lp: 7000, g: S.ad(0.0004, 0.012), v: 0.7 });
      S.osc(r, o, t, { w: 'sine', f: [[0, 130], [0.35, 38, 'e']], g: [[0, 0], [0.002, 1], [0.15, 0.6], [0.6, 0.0001, 'e']], v: 0.85, drive: 1.6 }, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 1400], [0.2, 400, 'e']], q: 0.7, lp: 5000, g: S.ad(0.002, 0.25), v: 0.7 }, p);
      S.noise(r, o, t, { c: 'brown', lp: [[0, 500], [0.8, 120, 'e']], g: [[0, 0], [0.01, 1], [0.25, 0.6], [0.85, 0.0001, 'e']], v: 0.9 }, p);
      S.noise(r, o, t + 0.01, { c: 'crackle', hp: 1200, lp: 6000, g: S.ad(0.004, 0.3), v: 0.35 });
    } });

  def('gpt.roar', { cat: 'gpt', dur: 0.75, poly: 1, guard: 0.2, wet: 0.3,
    desc: 'short dragon roar: growling formant sweep + pressure-wave thump', when: 'roar move (or win pose / taunt)',
    build: function (r, o, t, p, rnd) {
      var L = 0.6;
      S.osc(r, o, t, { w: 'sine', f: [[0, 120], [0.1, 45, 'e']], g: S.ad(0.002, 0.18), v: 0.7, drive: 1.5 }, p);
      var vox = S.bus(r, o, 1, { bp: [[0, 500], [0.18, 1100, 'e'], [L, 650, 'e']], q: 1.6, t: t, drive: 2 });
      [[0, 0.22], [9, 0.18], [-11, 0.18]].forEach(function (x, i) {
        S.osc(r, vox, t, { w: 'sawtooth', f: [[0, 70], [0.15, 95, 'e'], [L, 62, 'e']], det: x[0], g: roar(0.03, L - 0.05, 1, 31 + i * 4, 0.55, rnd).concat([[L + 0.08, 0.0001, 'e']]), v: x[1] }, p);
      });
      S.noise(r, o, t, { c: 'pink', bp: [[0, 700], [0.2, 1500, 'e'], [L, 800, 'e']], q: 0.9, g: roar(0.03, L - 0.05, 1, 27, 0.5, rnd).concat([[L + 0.08, 0.0001, 'e']]), v: 0.35 }, p);
      S.noise(r, o, t, { c: 'brown', lp: 300, g: [[0, 0], [0.01, 1], [0.4, 0.0001, 'e']], v: 0.6 }, p);
    } });

  def('gpt.super', { cat: 'gpt', dur: 2.0, poly: 1, guard: 0.5, prio: 5, wet: 0.4, irDur: 1.5, stereo: true,
    desc: '≈1.5 s: three rising lock-on tones (three dragon heads), then a huge converging beam blast, bright tail', when: 'GPT super: heads appear (after the super flash)',
    build: function (r, o, t, p, rnd) {
      var X = 0.62, B = 0.6;
      // three heads locking on: E4 → A4 → E5, each a rising FM tone panned L / R / C
      [['E4', -0.6], ['A4', 0.6], ['E5', 0]].forEach(function (x, i) {
        var tt = t + i * 0.18, f = N(x[0]), w = S.bus(r, o, 1, { pan: x[1], t: tt });
        S.osc(r, w, tt, { w: 's25', f: [[0, f * 0.7], [0.12, f, 'e']], g: [[0, 0], [0.01, 1], [0.15, 0.7], [X - i * 0.18 + 0.02, 0.5], [X - i * 0.18 + 0.06, 0.0001, 'e']], v: 0.08, lp: 3500 }, p);
        S.osc(r, w, tt, { w: 'sine', f: [[0, f * 1.4], [0.12, f * 2, 'e']], g: [[0, 0], [0.005, 1], [0.25, 0.0001, 'e']], v: 0.07, fm: { r: 2.41, i: [[0, 2], [0.2, 0.2, 'e']] } }, p);
        S.noise(r, w, tt, { c: 'white', bp: [[0, 1500], [0.15, 5000, 'e']], q: 2, g: S.ad(0.03, 0.15), v: 0.2 }, p);
      });
      S.noise(r, o, t, { c: 'white', bp: [[0, 500], [X, 4500, 'e']], q: 1.5, g: [[0, 0.0001], [X, 1, 'e'], [X + 0.02, 0.0001, 'e']], v: 0.3 }, p);
      // converging blast
      S.osc(r, o, t + X, { w: 'sine', f: [[0, 110], [0.25, 55, 'e']], g: [[0, 0], [0.003, 1], [B, 0.7], [B + 0.35, 0.0001, 'e']], v: 0.7, drive: 1.6 }, p);
      S.noise(r, o, t + X, { c: 'white', hp: 1800, lp: 8000, g: S.ad(0.0005, 0.02), v: 0.6 });
      var body = S.bus(r, o, 1, { lp: [[0, 1200], [0.06, 4200, 'e'], [B, 3000], [B + 0.35, 900, 'e']], t: t + X });
      ['A2', 'E3', 'A3', 'E4', 'B4'].forEach(function (n) {
        [-8, 8].forEach(function (d, j) {
          S.osc(r, body, t + X, { w: 'sawtooth', f: N(n), det: d, g: roar(0.01, B, 1, 20 + j * 3, 0.35, rnd).concat([[B + 0.35, 0.0001, 'e']]), v: 0.07 }, p);
        });
      });
      S.noise(r, o, t + X, { c: 'white', bp: 1400, q: 0.5, lp: 6000, g: roar(0.01, B, 1, 26, 0.45, rnd).concat([[B + 0.3, 0.0001, 'e']]), v: 0.4 });
      S.noise(r, o, t + X, { c: 'brown', lp: 400, g: S.ad(0.005, 0.9), v: 0.6 }, p);
      // bright icy tail
      var wide = S.bus(r, o, 1, { pan: [[0, -0.5], [0.8, 0.5]], t: t + X + B - 0.1 });
      icyShimmer(r, wide, t + X + B - 0.1, 0.5, 0.06, p, rnd);
      S.noise(r, o, t + X + B - 0.05, { c: 'crackle', hp: 4000, lp: 10000, g: [[0, 0], [0.05, 1], [0.6, 0.0001, 'e']], v: 0.3 });
    } });
})();
