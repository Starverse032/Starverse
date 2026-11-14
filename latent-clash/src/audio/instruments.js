/* LATENT CLASH — music instruments and drum kit (AUDIO module).
 * Instruments are note functions  K.INS[name](ti, ch, t, e, dur)
 *   ti  = track instance (ti.ctx, ti.mx), ch = channel runtime { def, in, lastF }
 *   t   = start time, e = event { m: midi, vel, slide, d: drum name, rate }, dur = gated seconds.
 * Drums are one-shots rendered once per sample rate into AudioBuffers (K.drumBuffers). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var K = (LC.audio = LC.audio || {})._ = LC.audio._ || {};
  var S = K.S;
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  function setWave(ti, o, w) {
    if (w === 'sine' || w === 'triangle' || w === 'square' || w === 'sawtooth') o.type = w;
    else o.setPeriodicWave(ti.r.wave(w));
  }
  function freqOf(ch, e) { return K.mtof(e.m + (ch.def.tr || 0)); }

  // Pulse / wave lead with ADSR, delayed vibrato, optional portamento and unison.
  //  def: { w: 's25', env: [a, d, s, r], vib: [rateHz, cents, delay], glide, uni: cents }
  var LEAD_ENV = [0.004, 0.2, 0.65, 0.07];
  K.INS.lead = function (ti, ch, t, e, dur) {
    var ctx = ti.ctx, d = ch.def, f = freqOf(ch, e), env = d.env || LEAD_ENV;
    var a = env[0], dc = env[1], s = env[2], rl = env[3], pk = e.vel;
    var g = ctx.createGain();
    var off = t + Math.max(dur, a + 0.01), end = off + rl * 2.4 + 0.02;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    g.gain.setTargetAtTime(pk * s, t + a, dc / 3);
    g.gain.setTargetAtTime(0, off, rl / 3);
    g.connect(ch.in);
    var n = d.uni ? 2 : 1;
    for (var i = 0; i < n; i++) {
      var o = ctx.createOscillator();
      setWave(ti, o, d.w || 's25');
      if (e.slide && ch.lastF) {
        o.frequency.setValueAtTime(ch.lastF, t);
        o.frequency.exponentialRampToValueAtTime(f, t + (d.glide || 0.06));
      } else o.frequency.value = f;
      if (i) o.detune.value = d.uni;
      if (d.vib && dur > d.vib[2] + 0.06) {
        var l = ctx.createOscillator(), lg = ctx.createGain();
        l.frequency.value = d.vib[0];
        lg.gain.setValueAtTime(0, t + d.vib[2]);
        lg.gain.linearRampToValueAtTime(d.vib[1], t + d.vib[2] + 0.16);
        l.connect(lg); lg.connect(o.detune);
        l.start(t); l.stop(end);
      }
      if (n === 2) { var h = ctx.createGain(); h.gain.value = 0.6; o.connect(h); h.connect(g); } else o.connect(g);
      o.start(t); o.stop(end);
    }
    ch.lastF = f;
  };

  // Bass: wave + optional pitch punch + optional per-note lowpass envelope.
  //  def: { w: 'triangle', env, punch: semitones, flt: [f0, f1, tau, q] }
  var BASS_ENV = [0.003, 0.25, 0.8, 0.04];
  K.INS.bass = function (ti, ch, t, e, dur) {
    var ctx = ti.ctx, d = ch.def, f = freqOf(ch, e), env = d.env || BASS_ENV;
    var a = env[0], dc = env[1], s = env[2], rl = env[3], pk = e.vel;
    var off = t + Math.max(dur, a + 0.01), end = off + rl * 2.4 + 0.02;
    var o = ctx.createOscillator();
    setWave(ti, o, d.w || 'triangle');
    if (e.slide && ch.lastF) {
      o.frequency.setValueAtTime(ch.lastF, t); o.frequency.exponentialRampToValueAtTime(f, t + (d.glide || 0.05));
    } else if (d.punch) {
      o.frequency.setValueAtTime(f * Math.pow(2, d.punch / 12), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.025);
    } else o.frequency.value = f;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    g.gain.setTargetAtTime(pk * s, t + a, dc / 3);
    g.gain.setTargetAtTime(0, off, rl / 3);
    var node = o;
    if (d.flt) {
      var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = d.flt[3] || 1;
      fl.frequency.setValueAtTime(d.flt[0] * (0.7 + 0.3 * pk), t);
      fl.frequency.setTargetAtTime(d.flt[1], t, d.flt[2]);
      o.connect(fl); node = fl;
    }
    node.connect(g); g.connect(ch.in);
    o.start(t); o.stop(end);
    ch.lastF = f;
  };

  // Soft saw pad: two detuned oscillators, slow attack/release.  def: { w, det, a, r }
  K.INS.pad = function (ti, ch, t, e, dur) {
    var ctx = ti.ctx, d = ch.def, f = freqOf(ch, e);
    var a = d.a || 0.25, rl = d.r || 0.5, pk = e.vel;
    var off = t + Math.max(dur, a), end = off + rl * 2.4 + 0.02;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    g.gain.setTargetAtTime(0, off, rl / 3);
    g.connect(ch.in);
    var det = d.det == null ? 9 : d.det;
    for (var i = 0; i < 2; i++) {
      var o = ctx.createOscillator();
      setWave(ti, o, d.w || 'sawtooth');
      o.frequency.value = f;
      o.detune.value = i ? det : -det;
      o.connect(g); o.start(t); o.stop(end);
    }
  };

  // 2-op FM bell / pluck / e-piano.  def: { ratio, idx, isus, idec, dec, hold }
  K.INS.bell = function (ti, ch, t, e, dur) {
    var ctx = ti.ctx, d = ch.def, f = freqOf(ch, e), pk = e.vel;
    var ratio = d.ratio || 3.5, idx = d.idx == null ? 2.2 : d.idx, dec = d.dec || 0.9;
    var off = t + dur, end = d.hold ? Math.min(t + dec * 2.4, off + 0.25) : t + dec * 2.4;
    var c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    c.frequency.value = f;
    m.frequency.value = f * ratio;
    mg.gain.setValueAtTime(idx * f * ratio, t);
    mg.gain.setTargetAtTime(idx * f * ratio * (d.isus == null ? 0.12 : d.isus), t, d.idec || 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.002, dec / 3);
    if (d.hold) g.gain.setTargetAtTime(0, off, 0.06);
    m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(ch.in);
    c.start(t); m.start(t); c.stop(end); m.stop(end);
  };

  // Noise riser / sweep for transitions.  def: { f0, f1, q }
  K.INS.riser = function (ti, ch, t, e, dur) {
    var ctx = ti.ctx, d = ch.def;
    var src = ctx.createBufferSource(); src.buffer = ti.r.nz.white; src.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = d.q || 2;
    bp.frequency.setValueAtTime(d.f0 || 400, t);
    bp.frequency.exponentialRampToValueAtTime(d.f1 || 6000, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(e.vel, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.03);
    src.connect(bp); bp.connect(g); g.connect(ch.in);
    src.start(t, K.rand()); src.stop(t + dur + 0.05);
  };

  // Drum hit from the pre-rendered kit.
  K.INS.drums = function (ti, ch, t, e) {
    var buf = ti.mx.drums && ti.mx.drums[e.d];
    if (!buf) return;
    var ctx = ti.ctx, s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf;
    if (e.rate !== 1) s.playbackRate.value = e.rate;
    g.gain.value = e.vel;
    s.connect(g); g.connect(ch.in);
    s.start(t);
  };

  // ---------------------------------------------------------------------------
  // Drum kit (synthesised once, rendered to buffers)
  // ---------------------------------------------------------------------------
  var D = K.DRUMS;
  D.kick = { dur: 0.42, build: function (r, o, t) {
    S.osc(r, o, t, { w: 'sine', f: [[0, 165], [0.055, 56, 'e'], [0.3, 42, 'e']], g: [[0, 0], [0.0015, 1], [0.09, 0.7], [0.4, 0.0001, 'e']], v: 0.95, drive: 1.4 });
    S.noise(r, o, t, { c: 'white', lp: 3500, g: S.ad(0.0005, 0.012), v: 0.35 });
  } };
  D.kickB = { dur: 0.5, build: function (r, o, t) {      // punchier, slightly longer (fast stages)
    S.osc(r, o, t, { w: 'sine', f: [[0, 200], [0.04, 60, 'e'], [0.35, 44, 'e']], g: [[0, 0], [0.001, 1], [0.12, 0.75], [0.48, 0.0001, 'e']], v: 1, drive: 2.2 });
    S.osc(r, o, t, { w: 'triangle', f: [[0, 900], [0.012, 160, 'e']], g: S.ad(0.0005, 0.018), v: 0.4 });
    S.noise(r, o, t, { c: 'white', lp: 5000, hp: 600, g: S.ad(0.0005, 0.01), v: 0.3 });
  } };
  D.snare = { dur: 0.3, build: function (r, o, t) {
    S.osc(r, o, t, { w: 'triangle', f: [[0, 250], [0.05, 175, 'e']], g: S.ad(0.001, 0.09), v: 0.55 });
    S.noise(r, o, t, { c: 'white', hp: 1100, lp: 8500, pk: [3500, 3, 1], g: [[0, 0], [0.001, 1], [0.04, 0.45, 'e'], [0.24, 0.0001, 'e']], v: 0.62 });
  } };
  D.clap = { dur: 0.3, build: function (r, o, t) {
    for (var i = 0; i < 3; i++) S.noise(r, o, t + i * 0.011, { c: 'white', bp: 1500, q: 1.1, g: S.ad(0.0005, 0.009), v: 0.8 });
    S.noise(r, o, t + 0.03, { c: 'white', bp: 1300, q: 0.9, g: S.ad(0.001, 0.16), v: 0.7 });
  } };
  D.hat = { dur: 0.08, build: function (r, o, t) {
    S.noise(r, o, t, { c: 'white', hp: 7200, lp: 12500, g: S.ad(0.0005, 0.032), v: 0.55 });
    S.noise(r, o, t, { c: 'metal', hp: 6000, g: S.ad(0.0005, 0.018), v: 0.12 });
  } };
  D.ohat = { dur: 0.42, build: function (r, o, t) {
    S.noise(r, o, t, { c: 'white', hp: 6500, lp: 12000, g: [[0, 0], [0.001, 1], [0.38, 0.0001, 'e']], v: 0.36 });
  } };
  D.crash = { dur: 1.9, build: function (r, o, t) {
    S.noise(r, o, t, { c: 'white', hp: 3800, lp: 11000, g: [[0, 0], [0.002, 1], [0.12, 0.6, 'e'], [1.85, 0.0001, 'e']], v: 0.5 });
    S.noise(r, o, t, { c: 'metal', bp: 7000, q: 0.8, g: [[0, 0], [0.002, 1], [0.9, 0.0001, 'e']], v: 0.12 });
  } };
  D.ride = { dur: 0.7, build: function (r, o, t) {
    S.bell(r, o, t, 2350, 0.11, 0.55, [1, 1.47, 2.09, 2.56], [1, 0.6, 0.4, 0.3]);
    S.noise(r, o, t, { c: 'white', hp: 7000, g: [[0, 0], [0.001, 1], [0.5, 0.0001, 'e']], v: 0.16 });
  } };
  D.tom = { dur: 0.42, build: function (r, o, t) {
    S.osc(r, o, t, { w: 'sine', f: [[0, 190], [0.2, 102, 'e']], g: [[0, 0], [0.001, 1], [0.38, 0.0001, 'e']], v: 0.8, drive: 1.2 });
    S.noise(r, o, t, { c: 'white', lp: 2200, g: S.ad(0.001, 0.04), v: 0.25 });
  } };
  D.rim = { dur: 0.06, build: function (r, o, t) {
    S.osc(r, o, t, { w: 'sine', f: 1700, g: S.ad(0.0005, 0.03), v: 0.5 });
    S.noise(r, o, t, { c: 'white', bp: 2600, q: 2, g: S.ad(0.0005, 0.012), v: 0.5 });
  } };
  D.shaker = { dur: 0.09, build: function (r, o, t) {
    S.noise(r, o, t, { c: 'white', bp: 7500, q: 1.4, g: [[0, 0], [0.012, 1], [0.07, 0.0001, 'e']], v: 0.45 });
  } };
  D.chipsn = { dur: 0.2, build: function (r, o, t) {   // NES-style noise snare
    S.noise(r, o, t, { c: 'metal', lp: 9000, hp: 500, rate: [[0, 1.4], [0.1, 0.9]], g: [[0, 0], [0.001, 1], [0.17, 0.0001, 'e']], v: 0.45 });
    S.osc(r, o, t, { w: 'p50', f: [[0, 220], [0.04, 120, 'e']], g: S.ad(0.001, 0.05), v: 0.3, lp: 3000 });
  } };
  D.boom = { dur: 1.4, build: function (r, o, t) {     // cinematic low hit (vs / stings)
    S.osc(r, o, t, { w: 'sine', f: [[0, 120], [0.3, 38, 'e']], g: [[0, 0], [0.002, 1], [1.3, 0.0001, 'e']], v: 1, drive: 1.6 });
    S.noise(r, o, t, { c: 'brown', lp: 900, g: [[0, 0], [0.003, 1], [0.9, 0.0001, 'e']], v: 0.8 });
  } };

  // Render the whole kit for a sample rate (shared between all mixers of that rate).
  var kitCache = {};
  K.drumBuffers = function (sr) {
    if (kitCache[sr]) return kitCache[sr];
    if (!OAC) return Promise.resolve({});
    var names = Object.keys(D), out = {};
    var total = 0, offs = {};
    names.forEach(function (n) { offs[n] = total; total += D[n].dur + 0.05; });
    var oc = new OAC(1, Math.ceil(total * sr), sr), r = K.res(oc);
    var saved = K.rand; K.rand = K.rng(4242);
    names.forEach(function (n) {
      var g = oc.createGain(); g.connect(oc.destination);
      D[n].build(r, g, offs[n]);
    });
    K.rand = saved;
    kitCache[sr] = K.renderCtx(oc).then(function (big) {
      var src = big.getChannelData(0);
      names.forEach(function (n) {
        var s0 = Math.round(offs[n] * sr), len = Math.round(D[n].dur * sr);
        var b = K.mkBuffer(oc, 1, len, sr), d = b.getChannelData(0);
        d.set(src.subarray(s0, s0 + len));
        var fade = Math.floor(sr * 0.004);
        for (var i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
        out[n] = b;
      });
      return out;
    });
    return kitCache[sr];
  };

  // Mixer hook: resolves once the drum kit for this context is ready.
  K.Mixer.prototype.prepare = function () {
    var self = this;
    if (!this.ready) this.ready = K.drumBuffers(this.ctx.sampleRate).then(function (d) { self.drums = d; return self; });
    return this.ready;
  };
})();
