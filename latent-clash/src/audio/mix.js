/* LATENT CLASH — SFX mix table (AUDIO module).
 * Per-sound gain trims applied once at load (multiplies def.vol), derived from offline
 * measurements (tools/audio-render.mjs sfx all) toward per-category loudness targets
 * (LUFS-M at unity): hits -17.5…-12 (light→counter), KO -8.5, blocks -21…-17, whiffs -23…-20,
 * movement -26…-24, UI -26…-18, character specials -17…-15, super sounds -10…-9.
 * Trims are capped so a single sound never peaks above ~0 dBFS at unity gain. */
(function () {
  'use strict';
  var K = window.LC.audio._;
  var MIX = {
    'hit.light': 1.26, 'hit.medium': 1.2, 'hit.heavy': 1.1, 'hit.special': 1.2, 'hit.counter': 1.22,
    'block.light': 1.6, 'block.heavy': 1.33, 'whiff.light': 1.45, 'whiff.medium': 1.05, 'whiff.heavy': 0.78,
    'jump': 1.72, 'land': 1.24, 'dash': 1.48, 'down': 1.0, 'throw.grab': 1.58, 'throw.slam': 0.71, 'throw.tech': 1.3,
    'ko': 0.94, 'super.flash': 0.97, 'super.charge': 0.72, 'meter.full': 0.78, 'counter.catch': 1.84, 'timer.tick': 1.58,
    'ann.round': 1.0, 'ann.fight': 0.91, 'ann.ko': 0.91, 'ann.perfect': 1.1, 'ann.timeup': 0.86, 'ann.win': 0.8,
    'ui.move': 2.2, 'ui.confirm': 1.13, 'ui.cancel': 0.77, 'ui.start': 0.83, 'ui.error': 0.93, 'ui.pause': 1.27, 'ui.lock': 1.27, 'text.blip': 2.57,
    'claude.spark': 1.07, 'claude.sparkHit': 1.5, 'claude.sonnet': 1.12, 'claude.haiku': 2.0, 'claude.guardrail': 0.79, 'claude.beam': 0.79,
    'deepseek.wave': 0.92, 'deepseek.waveHit': 1.19, 'deepseek.breach': 1.4, 'deepseek.dive': 1.07, 'deepseek.emerge': 1.58,
    'deepseek.chain': 1.5, 'deepseek.diveKick': 1.3, 'deepseek.whale': 0.78
  };
  Object.keys(MIX).forEach(function (n) { if (K.SFX[n]) K.SFX[n].vol *= MIX[n]; });
  K.MIX = MIX;
})();
