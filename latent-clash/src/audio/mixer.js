/* LATENT CLASH — audio mixer graph (AUDIO module).
 * One Mixer per BaseAudioContext (the realtime one in engine.js, and offline ones in the
 * render tool), so measurements go through exactly the graph the game uses.
 *
 *   sfx voices ─► sfxBus(vol) ───────────────────────────────┐
 *   track channels ─► trackFade ─► musicIn ─► duck ─► pauseLP ─► pauseGain ─► musicVol ─► master ─► comp ─► softclip ─► out
 *   channel sends ─► (per track) verbFade ─► verbIn ─► convolver ─► musicIn
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var K = (LC.audio = LC.audio || {})._ = LC.audio._ || {};
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  var EMPTY = {};
  var MAX_VOICES = 24;

  K.taper = function (v) { v = Math.max(0, Math.min(1, +v || 0)); return v * v; };   // slider -> gain

  // ---------------------------------------------------------------------------
  // Offline rendering helpers
  // ---------------------------------------------------------------------------
  K.renderCtx = function (oc) {
    return new Promise(function (res, rej) {
      var done = false;
      oc.oncomplete = function (e) { if (!done) { done = true; res(e.renderedBuffer); } };
      try {
        var p = oc.startRendering();
        if (p && p.then) p.then(function (b) { if (!done) { done = true; res(b); } }, rej);
      } catch (e) { rej(e); }
    });
  };
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  K.hash = hash;

  // Trim trailing silence (< -76 dBFS) and apply a 4 ms fade at the cut.
  function trim(ctx, buf) {
    var ch = buf.numberOfChannels, n = buf.length, last = 0, i, c;
    for (c = 0; c < ch; c++) {
      var d = buf.getChannelData(c);
      for (i = n - 1; i > last; i--) if (Math.abs(d[i]) > 0.00016) { last = i; break; }
    }
    var len = Math.min(n, last + 1 + Math.floor(buf.sampleRate * 0.004));
    var out = K.mkBuffer(ctx, ch, Math.max(1, len), buf.sampleRate), fade = Math.floor(buf.sampleRate * 0.004);
    for (c = 0; c < ch; c++) {
      var src = buf.getChannelData(c), dst = out.getChannelData(c);
      dst.set(src.subarray(0, len));
      for (i = 0; i < fade && i < len; i++) dst[len - 1 - i] *= i / fade;
    }
    return out;
  }

  // Render one SFX def to an AudioBuffer (dry + baked reverb tail). Unity gain except def.vol.
  K.renderSfx = function (name, sr) {
    var def = K.SFX[name];
    if (!def || !OAC) return Promise.reject(new Error('cannot render ' + name));
    var ch = def.stereo ? 2 : 1;
    var len = Math.ceil((def.dur + def.tail + 0.03) * sr);
    var oc = new OAC(ch, len, sr);
    var r = K.res(oc);
    var out = oc.createGain();
    out.gain.value = def.vol;
    out.connect(oc.destination);
    if (def.wet) {
      var cv = oc.createConvolver(), wg = oc.createGain();
      cv.normalize = false; cv.buffer = K.ir(oc, def.irDur || 1.1, 2);
      wg.gain.value = def.wet;
      out.connect(wg); wg.connect(cv); cv.connect(oc.destination);
    }
    var saved = K.rand; K.rand = K.rng(hash(name));
    try { def.build(r, out, 0, 1, K.rand); }
    finally { K.rand = saved; }
    return K.renderCtx(oc).then(function (b) { return trim(oc, b); });
  };

  // ---------------------------------------------------------------------------
  // Mixer
  // ---------------------------------------------------------------------------
  function Mixer(ctx, vol) {
    this.ctx = ctx;
    this.r = K.res(ctx);
    vol = vol || { master: 1, music: 1, sfx: 1 };
    var c = ctx;
    this.master = c.createGain(); this.master.gain.value = K.taper(vol.master);
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -7; this.comp.knee.value = 5; this.comp.ratio.value = 12;
    this.comp.attack.value = 0.002; this.comp.release.value = 0.16;
    this.clip = c.createWaveShaper(); this.clip.curve = softClipCurve(); this.clip.oversample = '2x';
    this.master.connect(this.comp); this.comp.connect(this.clip); this.clip.connect(c.destination);

    this.sfxBus = c.createGain(); this.sfxBus.gain.value = K.taper(vol.sfx);
    this.sfxBus.connect(this.master);

    this.musicIn = c.createGain();
    this.duckG = c.createGain();
    this.pauseLP = c.createBiquadFilter(); this.pauseLP.type = 'lowpass'; this.pauseLP.frequency.value = 20000; this.pauseLP.Q.value = 0.5;
    this.pauseG = c.createGain();
    this.musicVol = c.createGain(); this.musicVol.gain.value = K.taper(vol.music);
    this.musicIn.connect(this.duckG); this.duckG.connect(this.pauseLP); this.pauseLP.connect(this.pauseG);
    this.pauseG.connect(this.musicVol); this.musicVol.connect(this.master);

    this.verbIn = c.createGain();
    this.verb = c.createConvolver(); this.verb.normalize = false; this.verb.buffer = K.ir(c, 1.25, 1);
    this.verbIn.connect(this.verb); this.verb.connect(this.musicIn);

    this.pool = [];             // voice records (reused)
    this.lastT = {};
    this.cache = {};            // sfx name -> AudioBuffer
    this.tracks = [];           // active track instances (seq.js)
    this.cur = null;            // current (non-fading) track instance
    this.duckUntil = 0; this.duckLevel = 1;
    this.voiceLast = {};        // charId -> voice record (voice.js)
  }
  K.Mixer = Mixer;

  function softClipCurve() {
    var n = 2048, c = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * 2 - 1, a = Math.abs(x), y = a <= 0.8 ? a : 0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18);
      c[i] = x < 0 ? -y : y;
    }
    return c;
  }

  Mixer.prototype.setVol = function (kind, v, t) {
    var node = kind === 'master' ? this.master : kind === 'music' ? this.musicVol : kind === 'sfx' ? this.sfxBus : null;
    if (!node) return;
    node.gain.cancelScheduledValues(t);
    node.gain.setTargetAtTime(K.taper(v), t, 0.02);
  };

  Mixer.prototype.duck = function (amount, secs, t) {
    amount = Math.max(0, Math.min(1, amount == null ? 0.5 : amount));
    secs = Math.max(0, secs == null ? 0.6 : secs);
    var level = 1 - amount;
    if (t < this.duckUntil) level = Math.min(level, this.duckLevel);
    var until = Math.max(this.duckUntil, t + secs);
    var g = this.duckG.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(level, t, 0.012);
    g.setTargetAtTime(1, until, 0.22);
    this.duckLevel = level; this.duckUntil = until;
  };

  Mixer.prototype.setPaused = function (on, t) {
    var f = this.pauseLP.frequency, g = this.pauseG.gain;
    f.cancelScheduledValues(t); g.cancelScheduledValues(t);
    f.setTargetAtTime(on ? 700 : 20000, t, on ? 0.06 : 0.1);
    g.setTargetAtTime(on ? 0.5 : 1, t, 0.08);
  };

  // ---- SFX voices --------------------------------------------------------------
  function getVoice(pool) {
    for (var i = 0; i < pool.length; i++) if (!pool[i].on) return pool[i];
    var v = { on: false, name: '', gn: null, pn: null, src: null, end: 0, start: 0, prio: 1, mixer: null };
    pool.push(v);
    return v;
  }
  function onEnded() {
    var v = this.__lcv;
    if (!v || v.src !== this) return;
    release(v);
  }
  function release(v) {
    if (!v.on) return;
    v.on = false;
    try { if (v.pn) v.pn.disconnect(); v.gn.disconnect(); } catch (e) { /* already gone */ }
    if (v.src) v.src.__lcv = null;
    v.src = v.gn = v.pn = null;
  }
  function steal(v, t) {
    if (!v.on) return;
    v.gn.gain.cancelScheduledValues(t);
    v.gn.gain.setTargetAtTime(0, t, 0.006);
    if (v.src) { try { v.src.stop(t + 0.04); } catch (e) { /* ignore */ } }
    v.end = t + 0.04;
    v.stolen = true;
  }

  // Play an SFX at context time t. Returns true if a voice started.
  Mixer.prototype.playSfx = function (name, t, opts) {
    var def = K.SFX[name];
    if (!def) { K.warnOnce('sfx:' + name, 'unknown sfx "' + name + '"'); return false; }
    opts = opts || EMPTY;
    var vol = opts.vol == null ? 1 : +opts.vol;
    if (!(vol > 0)) return false;
    var lt = this.lastT[name];
    if (lt != null && t >= lt && t - lt < def.guard) return false;    // retrigger guard
    this.lastT[name] = t;

    // polyphony bookkeeping
    var pool = this.pool, same = 0, oldest = null, total = 0, victim = null, i, v;
    for (i = 0; i < pool.length; i++) {
      v = pool[i];
      if (!v.on) continue;
      if (v.end <= t && !v.src) { release(v); continue; }      // live voices: no onended
      if (v.stolen) continue;
      total++;
      if (v.name === name) { same++; if (!oldest || v.start < oldest.start) oldest = v; }
      if (!victim || v.prio < victim.prio || (v.prio === victim.prio && v.start < victim.start)) victim = v;
    }
    if (same >= def.poly && oldest) steal(oldest, t);
    else if (total >= MAX_VOICES && victim) steal(victim, t);

    var ctx = this.ctx, pitch = opts.pitch > 0 ? +opts.pitch : 1;
    if (def.jitter) pitch *= 1 + (K.rand() * 2 - 1) * def.jitter;
    v = getVoice(pool);
    v.on = true; v.stolen = false; v.name = name; v.start = t; v.prio = def.prio; v.mixer = this;
    v.gn = ctx.createGain();
    v.gn.gain.value = vol;
    var node = v.gn;
    if (opts.pan && ctx.createStereoPanner) {
      v.pn = ctx.createStereoPanner();
      v.pn.pan.value = Math.max(-1, Math.min(1, +opts.pan));
      node.connect(v.pn); node = v.pn;
    } else v.pn = null;
    node.connect(this.sfxBus);

    var buf = this.cache[name];
    if (buf) {
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = pitch;
      src.connect(v.gn);
      src.__lcv = v; src.onended = onEnded;
      src.start(t);
      v.src = src;
      v.end = t + buf.duration / pitch;
    } else {
      // live synthesis fallback (cache not rendered yet / OfflineAudioContext unsupported)
      v.src = null;
      var trim = ctx.createGain(); trim.gain.value = def.vol; trim.connect(v.gn);
      try { def.build(this.r, trim, t, pitch, K.rand); }
      catch (e) { console.error('[audio] sfx ' + name + ' failed', e); }
      v.end = t + def.dur / pitch + 0.05;
    }
    return true;
  };

  Mixer.prototype.stopAllSfx = function (t) {
    for (var i = 0; i < this.pool.length; i++) if (this.pool[i].on) steal(this.pool[i], t);
  };

  // Render the SFX cache in the background, one sound at a time (priority order).
  Mixer.prototype.buildCache = function (names, onDone) {
    var self = this, sr = this.ctx.sampleRate, i = 0;
    if (!OAC) { if (onDone) onDone(false); return; }
    function next() {
      if (i >= names.length) { if (onDone) onDone(true); return; }
      var n = names[i++];
      if (self.cache[n] || !K.SFX[n]) { next(); return; }
      K.renderSfx(n, sr).then(function (b) { self.cache[n] = b; setTimeout(next, 0); },
        function (e) { console.error('[audio] cache render failed: ' + n, e); setTimeout(next, 0); });
    }
    next();
  };

  // Analyser tap on the final output (dev page scope / meters).
  Mixer.prototype.tap = function () {
    if (this.analyser) return this.analyser;
    var a = this.ctx.createAnalyser();
    a.fftSize = 2048; a.smoothingTimeConstant = 0;
    this.clip.connect(a);
    this.analyser = a;
    return a;
  };
})();
