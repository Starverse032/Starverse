/* LATENT CLASH — system, announcer and UI SFX (AUDIO module).
 * Announcer stings are short musical/percussive stingers that punctuate the on-screen banners
 * (no speech). UI sounds are short, soft, pitched blips (pulse waves, low-passed). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var K = LC.audio._, S = K.S, def = K.defSfx;
  var N = function (s) { return K.mtof(K.midi(s)); };

  // Brassy chord stab: unison saws + pulse through a swept low-pass.
  function stab(r, out, t, notes, v, len, bright, p) {
    var b = S.bus(r, out, v / Math.sqrt(notes.length), { lp: [[0, 700], [0.03, bright || 3200, 'e'], [len, 900, 'e']], lq: 1.2, t: t });
    notes.forEach(function (n) {
      var f = N(n), g = [[0, 0], [0.006, 1], [0.08, 0.7], [len, 0.0001, 'e']];
      S.osc(r, b, t, { w: 'sawtooth', f: f, det: -7, g: g, v: 0.5 }, p);
      S.osc(r, b, t, { w: 'sawtooth', f: f, det: 7, g: g, v: 0.5 }, p);
      S.osc(r, b, t, { w: 'p25', f: f, g: g, v: 0.35 }, p);
    });
  }
  function boom(r, out, t, v, len, p) {
    S.osc(r, out, t, { w: 'sine', f: [[0, 120], [0.25, 38, 'e']], g: [[0, 0], [0.002, 1], [len, 0.0001, 'e']], v: v, drive: 1.6 }, p);
    S.noise(r, out, t, { c: 'white', hp: 1500, lp: 7000, g: S.ad(0.0005, 0.012), v: v * 0.5 });
    S.noise(r, out, t, { c: 'brown', lp: 700, g: S.ad(0.003, len * 0.6), v: v * 0.6 }, p);
  }
  function crash(r, out, t, v, len) {
    S.noise(r, out, t, { c: 'white', hp: 3800, lp: 9500, g: [[0, 0], [0.002, 1], [0.1, 0.5, 'e'], [len, 0.0001, 'e']], v: v });
  }
  function fmBell(r, out, t, f, v, dec, p, ratio) {
    S.osc(r, out, t, { w: 'sine', f: f, g: [[0, 0], [0.002, 1], [dec, 0.0001, 'e']], v: v, fm: { r: ratio || 3.5, i: [[0, 2.2], [dec * 0.5, 0.15, 'e']] } }, p);
  }
  function blip(r, out, t, f, len, v, w, p, lp) {
    S.osc(r, out, t, { w: w || 's25', f: f, g: [[0, 0], [0.002, 1], [len * 0.6, 0.6], [len, 0.0001, 'e']], v: v, lp: lp || 5000 }, p);
  }

  // ---- system --------------------------------------------------------------------
  def('super.flash', { cat: 'system', dur: 1.35, poly: 1, guard: 0.3, prio: 5, wet: 0.35, stereo: true,
    desc: 'riser (0.55 s) slamming into a bright major-chord impact', when: 'super freeze / cut-in starts (both characters)',
    build: function (r, o, t, p) {
      var T = 0.56;
      S.noise(r, o, t, { c: 'white', bp: [[0, 500], [T, 6500, 'e']], q: 2.5, lp: 8000, g: [[0, 0.0001], [T, 1, 'e'], [T + 0.015, 0]], v: 0.55 }, p);
      S.noise(r, o, t, { c: 'white', hp: 3200, lp: 9000, g: [[0, 0.0001], [T, 1, 'e'], [T + 0.012, 0]], v: 0.2 });
      S.osc(r, o, t, { w: 'sawtooth', f: [[0, 220], [T, 880, 'e']], g: [[0, 0], [T * 0.9, 1], [T + 0.015, 0]], v: 0.12, lp: 3500, det: 8 }, p);
      S.osc(r, o, t, { w: 'p25', f: [[0, 330], [T, 1320, 'e']], g: [[0, 0], [T * 0.9, 1], [T + 0.015, 0]], v: 0.07, lp: 4000 }, p);
      boom(r, o, t + T, 1, 0.9, p);
      stab(r, o, t + T, ['A3', 'E4', 'A4', 'C#5', 'E5'], 0.55, 0.75, 4200, p);
      crash(r, o, t + T, 0.38, 1.1);
      var w = S.bus(r, o, 1, { pan: [[0, -0.6], [0.3, 0.6]], t: t + T });
      fmBell(r, w, t + T + 0.02, 1760, 0.1, 0.6, p);
    } });

  def('super.charge', { cat: 'system', dur: 0.65, poly: 1, guard: 0.2, prio: 3,
    desc: 'energy converging: rising FM whirl + upward noise', when: 'super startup on the fighter (after the flash), or a big install',
    build: function (r, o, t, p) {
      S.osc(r, o, t, { w: 'sine', f: [[0, 260], [0.6, 1100, 'e']], fm: { r: 1.5, i: [[0, 4], [0.6, 0.8]] }, g: [[0, 0], [0.5, 1], [0.62, 0.0001, 'e']], v: 0.22 }, p);
      S.osc(r, o, t, { w: 'triangle', f: [[0, 262], [0.6, 1112, 'e']], g: [[0, 0], [0.5, 1], [0.62, 0.0001, 'e']], v: 0.14 }, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 800], [0.6, 5000, 'e']], q: 4, g: [[0, 0.0001], [0.55, 1, 'e'], [0.62, 0.0001, 'e']], v: 0.35 }, p);
      for (var i = 0; i < 6; i++) fmBell(r, o, t + 0.1 + i * 0.08, 1200 + i * 220, 0.04 + i * 0.008, 0.12, p, 2);
    } });

  def('meter.full', { cat: 'system', dur: 0.7, poly: 1, guard: 0.3, wet: 0.3,
    desc: 'bright two-note chime', when: 'a player\'s gauge reaches 100',
    build: function (r, o, t, p) {
      fmBell(r, o, t, N('E6'), 0.24, 0.45, p);
      fmBell(r, o, t + 0.075, N('B6'), 0.22, 0.6, p);
      S.osc(r, o, t + 0.075, { w: 'sine', f: N('E7'), g: S.ad(0.002, 0.35), v: 0.05 }, p);
    } });

  def('counter.catch', { cat: 'system', dur: 0.4, poly: 1, guard: 0.1, prio: 4,
    desc: 'metallic "ching!" + upward zip', when: 'COUNTER banner / a guard-point catch (generic layer)',
    build: function (r, o, t, p) {
      S.bell(r, o, t, 1500, 0.24, 0.36, [1, 2.76, 5.4], [1, 0.45, 0.2], p);
      S.osc(r, o, t, { w: 'sine', f: [[0, 600], [0.08, 2400, 'e']], g: S.ad(0.002, 0.1), v: 0.14 }, p);
      S.noise(r, o, t, { c: 'white', hp: 3000, lp: 9000, g: S.ad(0.0005, 0.02), v: 0.4 });
    } });

  def('timer.tick', { cat: 'system', dur: 0.05, poly: 1, guard: 0.2,
    desc: 'woodblock clock tick', when: 'each second of the last 10 s of the round timer',
    build: function (r, o, t, p) {
      S.osc(r, o, t, { w: 'sine', f: [[0, 1950], [0.03, 1800, 'e']], g: S.ad(0.0005, 0.032), v: 0.5 }, p);
      S.osc(r, o, t, { w: 'sine', f: 650, g: S.ad(0.0005, 0.02), v: 0.25 }, p);
      S.noise(r, o, t, { c: 'white', bp: 2500, q: 3, g: S.ad(0.0005, 0.01), v: 0.35 }, p);
    } });

  // ---- announcer stings ------------------------------------------------------------
  def('ann.round', { cat: 'ann', dur: 0.95, poly: 1, guard: 0.3, prio: 4, wet: 0.3, stereo: true,
    desc: 'heavy hit + brass power-chord stab ("DAAN")', when: 'ROUND n / FINAL ROUND banner appears',
    build: function (r, o, t, p) {
      boom(r, o, t, 0.9, 0.7, p);
      stab(r, o, t, ['D3', 'A3', 'D4', 'A4'], 0.6, 0.8, 2800, p);
      S.noise(r, o, t, { c: 'white', hp: 900, lp: 7000, g: S.ad(0.001, 0.15), v: 0.3 });
    } });

  def('ann.fight', { cat: 'ann', dur: 1.1, poly: 1, guard: 0.3, prio: 4, wet: 0.3, stereo: true,
    desc: '"da-DAAN!" pickup + big major chord, crash', when: 'FIGHT! banner (control starts)',
    build: function (r, o, t, p) {
      stab(r, o, t, ['A3', 'E4', 'A4'], 0.35, 0.07, 3000, p);
      S.noise(r, o, t, { c: 'white', hp: 1000, lp: 7000, g: S.ad(0.001, 0.06), v: 0.25 });
      boom(r, o, t + 0.12, 1, 0.9, p);
      stab(r, o, t + 0.12, ['D4', 'F#4', 'A4', 'D5', 'F#5'], 0.65, 0.95, 4200, p);
      crash(r, o, t + 0.12, 0.4, 1.0);
    } });

  def('ann.ko', { cat: 'ann', dur: 1.5, poly: 1, guard: 0.3, prio: 4, wet: 0.4, stereo: true,
    desc: 'ominous two-chord descent (F#m → F) with gong', when: 'K.O. banner (after the ko impact)',
    build: function (r, o, t, p) {
      boom(r, o, t, 0.8, 1.0, p);
      stab(r, o, t, ['F#3', 'C#4', 'F#4', 'A4'], 0.5, 0.35, 2600, p);
      stab(r, o, t + 0.38, ['F3', 'C4', 'F4', 'Ab4'], 0.55, 1.0, 2200, p);
      S.bell(r, o, t + 0.38, 147, 0.14, 1.1, [1, 2.0, 2.98, 4.1], [1, 0.5, 0.3, 0.15], p);
      crash(r, o, t + 0.38, 0.25, 1.0);
    } });

  def('ann.perfect', { cat: 'ann', dur: 1.2, poly: 1, guard: 0.3, prio: 4, wet: 0.4, stereo: true,
    desc: 'sparkling ascending Cmaj9 bell arpeggio', when: 'PERFECT banner',
    build: function (r, o, t, p) {
      ['C5', 'E5', 'G5', 'B5', 'D6', 'E6', 'G6'].forEach(function (n, i) {
        var w = S.bus(r, o, 1, { pan: -0.5 + i / 6, t: t });
        fmBell(r, w, t + i * 0.045, N(n), 0.16, 0.8 - i * 0.04, p, 3.5);
      });
      stab(r, o, t + 0.32, ['C4', 'G4', 'B4', 'E5'], 0.25, 0.8, 3000, p);
      S.noise(r, o, t, { c: 'white', hp: 6000, lp: 11000, g: [[0, 0], [0.3, 1], [1.1, 0.0001, 'e']], v: 0.08 });
    } });

  def('ann.timeup', { cat: 'ann', dur: 1.15, poly: 1, guard: 0.3, prio: 4, wet: 0.3,
    desc: 'two-tone descending buzzer + low gong', when: 'TIME UP banner',
    build: function (r, o, t, p) {
      blip(r, o, t, 880, 0.16, 0.22, 's50', p, 3500);
      blip(r, o, t + 0.19, 660, 0.3, 0.22, 's50', p, 3000);
      S.bell(r, o, t + 0.19, 165, 0.16, 0.9, [1, 2.0, 2.98, 4.1], [1, 0.5, 0.3, 0.15], p);
      boom(r, o, t + 0.19, 0.6, 0.6, p);
    } });

  def('ann.win', { cat: 'ann', dur: 1.15, poly: 1, guard: 0.3, prio: 4, wet: 0.35, stereo: true,
    desc: 'triumphant triplet fanfare into a C major stab', when: 'WIN / YOU WIN banner (before the victory jingle)',
    build: function (r, o, t, p) {
      stab(r, o, t, ['G4', 'D5'], 0.3, 0.08, 3200, p);
      stab(r, o, t + 0.09, ['C5', 'G5'], 0.32, 0.08, 3200, p);
      stab(r, o, t + 0.18, ['E5', 'C6'], 0.34, 0.08, 3400, p);
      boom(r, o, t + 0.27, 0.8, 0.8, p);
      stab(r, o, t + 0.27, ['C4', 'G4', 'C5', 'E5', 'G5'], 0.6, 0.85, 4200, p);
      crash(r, o, t + 0.27, 0.35, 0.9);
    } });

  // ---- UI ------------------------------------------------------------------------------
  def('ui.move', { cat: 'ui', dur: 0.04, poly: 2, guard: 0.03,
    desc: 'soft tick', when: 'menu cursor moves',
    build: function (r, o, t, p) {
      blip(r, o, t, 1320, 0.032, 0.17, 's12', p, 4500);
      S.osc(r, o, t, { w: 'sine', f: 2640, g: S.ad(0.001, 0.02), v: 0.04 }, p);
    } });
  def('ui.confirm', { cat: 'ui', dur: 0.13, poly: 2, guard: 0.05,
    desc: 'two-note rising blip', when: 'menu item accepted',
    build: function (r, o, t, p) {
      blip(r, o, t, N('E6'), 0.045, 0.17, 's25', p);
      blip(r, o, t + 0.045, N('A6'), 0.08, 0.17, 's25', p);
    } });
  def('ui.cancel', { cat: 'ui', dur: 0.13, poly: 2, guard: 0.05,
    desc: 'two-note falling, duller', when: 'back / cancel',
    build: function (r, o, t, p) {
      blip(r, o, t, N('A5'), 0.045, 0.2, 's50', p, 2800);
      blip(r, o, t + 0.045, N('E5'), 0.08, 0.2, 's50', p, 2500);
    } });
  def('ui.start', { cat: 'ui', dur: 0.5, poly: 1, guard: 0.2, wet: 0.25,
    desc: 'press-start arpeggio with sparkle', when: 'PRESS START on the title / starting a mode',
    build: function (r, o, t, p) {
      ['C6', 'E6', 'G6', 'C7'].forEach(function (n, i) { blip(r, o, t + i * 0.035, N(n), i === 3 ? 0.3 : 0.05, 0.15, 's25', p); });
      fmBell(r, o, t + 0.105, N('G7'), 0.05, 0.35, p);
      S.noise(r, o, t, { c: 'white', bp: [[0, 1500], [0.15, 6000, 'e']], q: 1.5, g: [[0, 0], [0.1, 1], [0.2, 0.0001, 'e']], v: 0.12 }, p);
    } });
  def('ui.error', { cat: 'ui', dur: 0.14, poly: 1, guard: 0.1,
    desc: 'low double buzz', when: 'invalid choice / locked item',
    build: function (r, o, t, p) {
      blip(r, o, t, 147, 0.05, 0.22, 'square', p, 1400);
      blip(r, o, t + 0.07, 147, 0.06, 0.22, 'square', p, 1400);
    } });
  def('ui.pause', { cat: 'ui', dur: 0.15, poly: 1, guard: 0.1,
    desc: '"pa-ding" two notes, high then low', when: 'pause menu opens/closes',
    build: function (r, o, t, p) {
      blip(r, o, t, N('E6'), 0.05, 0.16, 's25', p);
      blip(r, o, t + 0.055, N('B5'), 0.09, 0.16, 's25', p, 3500);
    } });
  def('ui.lock', { cat: 'ui', dur: 0.36, poly: 1, guard: 0.1, wet: 0.2,
    desc: 'punchy lock-in: click + major stab + sparkle', when: 'character / stage selection locked in',
    build: function (r, o, t, p) {
      S.noise(r, o, t, { c: 'white', hp: 2000, lp: 8000, g: S.ad(0.0005, 0.01), v: 0.4 });
      stab(r, o, t, ['E5', 'G#5', 'B5'], 0.28, 0.25, 4000, p);
      S.osc(r, o, t, { w: 'sine', f: [[0, 200], [0.06, 90, 'e']], g: S.ad(0.001, 0.07), v: 0.4 }, p);
      fmBell(r, o, t + 0.04, N('E7'), 0.06, 0.3, p);
    } });
  def('text.blip', { cat: 'ui', dur: 0.035, poly: 2, guard: 0.025, jitter: 0.05,
    desc: 'tiny soft blip (pleasant at 20/s)', when: 'each character (or every 2nd) of typewriter dialogue',
    build: function (r, o, t, p) {
      S.osc(r, o, t, { w: 'triangle', f: 820, g: [[0, 0], [0.002, 1], [0.03, 0.0001, 'e']], v: 0.22 }, p);
      S.osc(r, o, t, { w: 's25', f: 820, g: [[0, 0], [0.002, 1], [0.02, 0.0001, 'e']], v: 0.05, lp: 3000 }, p);
    } });
})();
