/* LATENT CLASH — offline rendering hooks for tools/tests (AUDIO module).
 * LC.audio._dev.render(spec) renders through a fresh Mixer on an OfflineAudioContext — the same
 * graph, caches and scheduler the game uses. No effect on the realtime engine. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var A = LC.audio = LC.audio || {};
  var K = A._;
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  // spec = { seconds, sr: 48000, vol: { master, music, sfx } (default unity),
  //          sfx: [{ name, at, opts }], voice: [{ char, kind, at }], music: name, musicAt: 0,
  //          duck: [{ at, amount, secs }], pause: [{ at, on }], live: false (skip SFX cache) }
  function render(spec) {
    if (!OAC) return Promise.reject(new Error('no OfflineAudioContext'));
    var sr = spec.sr || 48000, secs = spec.seconds || 2;
    var oc = new OAC(2, Math.ceil(secs * sr), sr);
    var mx = new K.Mixer(oc, spec.vol || { master: 1, music: 1, sfx: 1 });
    var sfx = spec.sfx || [], names = [];
    sfx.forEach(function (s) { if (names.indexOf(s.name) < 0 && K.SFX[s.name]) names.push(s.name); });
    var info = {};
    return mx.prepare().then(function () {
      if (spec.live) return null;
      return Promise.all(names.map(function (n) { return K.renderSfx(n, sr).then(function (b) { mx.cache[n] = b; }); }));
    }).then(function () {
      K.rand = K.rng(spec.seed || 99);
      sfx.forEach(function (s) { mx.playSfx(s.name, s.at || 0, s.opts); });
      (spec.voice || []).forEach(function (v) { if (mx.playVoice) mx.playVoice(v.char, v.kind, v.at || 0, v.opts); });
      (spec.duck || []).forEach(function (d) { mx.duck(d.amount, d.secs, d.at); });
      (spec.pause || []).forEach(function (p) { mx.setPaused(p.on, p.at); });
      if (spec.music) {
        var ti = mx.playTrack(spec.music, spec.musicAt || 0, { fade: 0 });
        if (ti) { info.t0 = ti.t0; info.song = { total: ti.song.total, loopStart: ti.song.loopStart, stepDur: ti.song.stepDur, duration: ti.song.duration, loopDur: ti.song.loopDur }; }
        mx.tickMusic(secs + 1, 0);
      }
      return K.renderCtx(oc);
    }).then(function (buf) { return { buffer: buf, info: info }; });
  }

  A._dev = {
    render: render,
    compile: function (n) { return K.compile(n, true); },
    analyze: function (n, o) { return K.analyzeSong(n, o); },
    sfxDefs: function () {
      return K.SFX_ORDER.map(function (n) { var d = K.SFX[n]; return { name: n, dur: d.dur, cat: d.cat || '', desc: d.desc || '', when: d.when || '' }; });
    },
    tracks: function () { return K.TRACK_ORDER.slice(); }
  };
})();
