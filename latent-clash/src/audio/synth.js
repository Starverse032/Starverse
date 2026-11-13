/* LATENT CLASH — audio synth building blocks (AUDIO module).
 * Per-context resources (noise buffers, band-limited pulse waves, shaper curves, reverb IR)
 * and the layer helpers every SFX / drum / voice is built from. All helpers take an explicit
 * start time so the same code runs in a realtime AudioContext and an OfflineAudioContext. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var K = (LC.audio = LC.audio || {})._ = LC.audio._ || {};
  var S = K.S = {};

  // ---------------------------------------------------------------------------
  // Shared buffers (independent of any context; keyed by sample rate)
  // ---------------------------------------------------------------------------
  var bufCache = {};
  function mkBuffer(ctx, ch, len, sr) {
    try { return new AudioBuffer({ numberOfChannels: ch, length: len, sampleRate: sr }); }
    catch (e) { return ctx.createBuffer(ch, len, sr); }
  }
  K.mkBuffer = mkBuffer;

  function noiseSet(ctx) {
    var sr = ctx.sampleRate;
    if (bufCache[sr]) return bufCache[sr];
    var rnd = K.rng(1234567), n = Math.floor(sr * 1.5), i;
    var white = mkBuffer(ctx, 1, n, sr), w = white.getChannelData(0);
    for (i = 0; i < n; i++) w[i] = rnd() * 2 - 1;
    // pink (Paul Kellet's economy filter)
    var pink = mkBuffer(ctx, 1, n, sr), pk = pink.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, peak = 0;
    for (i = 0; i < n; i++) {
      var x = w[i];
      b0 = 0.99765 * b0 + x * 0.0990460; b1 = 0.96300 * b1 + x * 0.2965164; b2 = 0.57000 * b2 + x * 1.0526913;
      pk[i] = b0 + b1 + b2 + x * 0.1848; peak = Math.max(peak, Math.abs(pk[i]));
    }
    for (i = 0; i < n; i++) pk[i] /= peak;
    // brown (leaky integrator)
    var brown = mkBuffer(ctx, 1, n, sr), br = brown.getChannelData(0), acc = 0; peak = 0;
    for (i = 0; i < n; i++) { acc = (acc + 0.02 * w[i]) * 0.998; br[i] = acc; peak = Math.max(peak, Math.abs(acc)); }
    for (i = 0; i < n; i++) br[i] /= peak;
    // "metal": NES-style short-mode LFSR noise, 93-step period, held at ~ sr/12 -> tonal grit
    var metal = mkBuffer(ctx, 1, n, sr), mt = metal.getChannelData(0), reg = 1, hold = 0, v = 1;
    for (i = 0; i < n; i++) {
      if (hold-- <= 0) { hold = 11; var bit = (reg ^ (reg >> 6)) & 1; reg = (reg >> 1) | (bit << 14); v = (reg & 1) ? 1 : -1; }
      mt[i] = v * 0.8;
    }
    // crackle: sparse random impulses (paper, crunch)
    var crackle = mkBuffer(ctx, 1, n, sr), cr = crackle.getChannelData(0);
    for (i = 0; i < n; i++) cr[i] = rnd() < 0.012 ? (rnd() * 2 - 1) : 0;
    for (i = 1; i < n; i++) cr[i] = cr[i] + cr[i - 1] * 0.55;
    bufCache[sr] = { white: white, pink: pink, brown: brown, metal: metal, crackle: crackle };
    return bufCache[sr];
  }

  // Small synthetic room IR (stereo, ~dur s): decaying noise that darkens over time.
  var irCache = {};
  K.ir = function (ctx, dur, key) {
    var sr = ctx.sampleRate, id = sr + ':' + dur + ':' + (key || 0);
    if (irCache[id]) return irCache[id];
    var n = Math.floor(sr * dur), buf = mkBuffer(ctx, 2, n, sr), rnd = K.rng(777 + (key || 0));
    var pre = Math.floor(sr * 0.012);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), lp = 0;
      for (var i = 0; i < n; i++) {
        if (i < pre) { d[i] = 0; continue; }
        var t = (i - pre) / sr, k = Math.min(0.92, 0.25 + 0.8 * t / dur);   // darkening one-pole
        lp = lp * k + (rnd() * 2 - 1) * (1 - k);
        d[i] = lp * Math.exp(-6.9 * t / dur) * (1 + 1.5 * (1 - k));
      }
      // short fade-out of the last 10 ms
      for (var j = 0; j < sr * 0.01; j++) d[n - 1 - j] *= j / (sr * 0.01);
    }
    // normalise energy so wet levels are predictable
    var e = 0, a = buf.getChannelData(0), b = buf.getChannelData(1);
    for (var q = 0; q < n; q++) e += a[q] * a[q] + b[q] * b[q];
    var g = 1 / Math.sqrt(e / 2 + 1e-9);
    for (q = 0; q < n; q++) { a[q] *= g; b[q] *= g; }
    irCache[id] = buf;
    return buf;
  };

  // ---------------------------------------------------------------------------
  // Per-context resources (PeriodicWaves are context-bound)
  // ---------------------------------------------------------------------------
  function pulseWave(ctx, duty, roll) {
    var N = 64, re = new Float32Array(N), im = new Float32Array(N);
    for (var n = 1; n < N; n++) {
      var a = 2 / (n * Math.PI), r = roll ? Math.exp(-n / roll) : 1;
      re[n] = a * Math.sin(2 * Math.PI * n * duty) * r;
      im[n] = a * (1 - Math.cos(2 * Math.PI * n * duty)) * r;
    }
    return ctx.createPeriodicWave(re, im);
  }
  function harmWave(ctx, amps) {    // sine-phase additive wave from a harmonic amplitude list
    var N = amps.length + 1, re = new Float32Array(N), im = new Float32Array(N);
    for (var n = 1; n < N; n++) im[n] = amps[n - 1];
    return ctx.createPeriodicWave(re, im);
  }
  var WAVES = {
    p12: function (c) { return pulseWave(c, 0.125); },
    p25: function (c) { return pulseWave(c, 0.25); },
    p50: function (c) { return pulseWave(c, 0.5); },
    p33: function (c) { return pulseWave(c, 0.33); },
    s25: function (c) { return pulseWave(c, 0.25, 14); },   // softened pulses: tame 2-5 kHz on leads
    s50: function (c) { return pulseWave(c, 0.5, 12); },
    s12: function (c) { return pulseWave(c, 0.125, 16); },
    glottal: function (c) { var a = []; for (var n = 1; n <= 40; n++) a.push(Math.pow(n, -1.25)); return harmWave(c, a); },
    reed: function (c) { var a = []; for (var n = 1; n <= 24; n++) a.push((n % 2 ? 1 : 0.35) / n); return harmWave(c, a); },
    organ: function (c) { return harmWave(c, [1, 0.5, 0.32, 0.18, 0.1, 0.06, 0.03, 0.02]); },
    tri8: function (c) {     // 4-bit-ish stepped-feel triangle (odd harmonics, slight extra 3rd)
      var a = []; for (var n = 1; n <= 31; n++) a.push(n % 2 ? (n === 3 ? 0.16 : 1 / (n * n)) * (((n - 1) / 2) % 2 ? -1 : 1) : 0);
      return harmWave(c, a);
    }
  };

  K.res = function (ctx) {
    if (ctx.__lcRes) return ctx.__lcRes;
    var waves = {}, curves = {};
    var r = {
      ctx: ctx, sr: ctx.sampleRate, nz: noiseSet(ctx),
      wave: function (name) { return waves[name] || (waves[name] = WAVES[name](ctx)); },
      curve: function (k) {
        k = Math.round(k * 10) / 10;
        if (curves[k]) return curves[k];
        var n = 1024, c = new Float32Array(n), t = Math.tanh(k);
        for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / t; }
        return (curves[k] = c);
      }
    };
    ctx.__lcRes = r;
    return r;
  };

  // ---------------------------------------------------------------------------
  // Envelopes. pts = [[dt, v], [dt, v, 'e'], [dt, v, 't', tau], [dt, v, 's']]  (dt from t0)
  //   default ramp linear; 'e' exponential; 't' setTarget(tau); 's' step.
  // ---------------------------------------------------------------------------
  S.env = function (param, t0, pts, k) {
    k = k == null ? 1 : k;
    if (typeof pts === 'number') { param.setValueAtTime(pts * k, t0); return; }
    param.setValueAtTime(pts[0][1] * k, t0 + pts[0][0]);
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i], tt = t0 + p[0], v = p[1] * k, m = p[2];
      if (m === 'e') param.exponentialRampToValueAtTime(Math.max(Math.abs(v), 1e-4) * (v < 0 ? -1 : 1), tt);
      else if (m === 't') param.setTargetAtTime(v, tt, p[3] || 0.05);
      else if (m === 's') param.setValueAtTime(v, tt);
      else param.linearRampToValueAtTime(v, tt);
    }
  };
  function lastT(pts) {
    if (typeof pts === 'number') return 0;
    var p = pts[pts.length - 1];
    return p[0] + (p[2] === 't' ? (p[3] || 0.05) * 6 : 0);
  }
  // Common amplitude shapes: AD with a 1 ms click-free attack.
  S.ad = function (a, d, peak) { peak = peak == null ? 1 : peak; return [[0, 0], [a, peak], [a + d, 0.0001, 'e']]; };
  S.adsr = function (a, d, s, hold, r) { return [[0, 0], [a, 1], [a + d, s, 'e'], [a + d + hold, s], [a + d + hold + r, 0.0001, 'e']]; };

  function filt(ctx, type, f, q, t, k) {
    var b = ctx.createBiquadFilter();
    b.type = type;
    if (q != null) b.Q.value = q;
    S.env(b.frequency, t, f, k || 1);
    return b;
  }
  S.filt = filt;

  // Insert the optional filter / shaper chain described by o into src -> ... -> dst.
  function chainFx(r, src, o, t, p) {
    var ctx = r.ctx, node = src;
    if (o.hp) { var h = filt(ctx, 'highpass', o.hp, o.hq == null ? 0.7 : o.hq, t, o.hpk ? p : 1); node.connect(h); node = h; }
    if (o.bp) { var b = filt(ctx, 'bandpass', o.bp, o.q == null ? 1 : o.q, t, o.bpk === false ? 1 : p); node.connect(b); node = b; }
    if (o.bp2) { var b2 = filt(ctx, 'bandpass', o.bp2, o.q2 == null ? 1 : o.q2, t, p); node.connect(b2); node = b2; }
    if (o.pk) { var pk = filt(ctx, 'peaking', o.pk[0], o.pk[2] || 1, t); pk.gain.value = o.pk[1]; node.connect(pk); node = pk; }
    if (o.drive) { var ws = ctx.createWaveShaper(); ws.curve = r.curve(o.drive); ws.oversample = '2x'; node.connect(ws); node = ws; }
    if (o.lp) { var l = filt(ctx, 'lowpass', o.lp, o.lq == null ? 0.7 : o.lq, t, o.lpk ? p : 1); node.connect(l); node = l; }
    return node;
  }

  // ---------------------------------------------------------------------------
  // Layers
  // ---------------------------------------------------------------------------
  // Oscillator layer.
  //  o = { w: 'sine'|'triangle'|'square'|'sawtooth'|'p12'|'p25'|'p50'|'s25'|..., f: Hz | pts,
  //        g: gain pts, v: volume, det: cents, dur, vib: [rateHz, cents, delay],
  //        lp/hp/bp(+q)/drive: filter chain (pts or Hz), fm: { r: ratio, i: index pts } }
  S.osc = function (r, out, t, o, p) {
    var ctx = r.ctx; p = p || 1;
    var osc = ctx.createOscillator();
    var w = o.w || 'sine';
    if (w === 'sine' || w === 'triangle' || w === 'square' || w === 'sawtooth') osc.type = w;
    else osc.setPeriodicWave(r.wave(w));
    S.env(osc.frequency, t, o.f, p);
    if (o.det) osc.detune.setValueAtTime(o.det, t);
    var g = ctx.createGain();
    var dur = o.dur || lastT(o.g || 0.1) + 0.02;
    S.env(g.gain, t, o.g || S.ad(0.002, 0.1), o.v == null ? 1 : o.v);
    var last = chainFx(r, osc, o, t, p);
    last.connect(g); g.connect(out);
    var srcs = [osc];
    if (o.vib) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib[0];
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(0, t + (o.vib[2] || 0));
      lg.gain.linearRampToValueAtTime(o.vib[1], t + (o.vib[2] || 0) + 0.12);
      lfo.connect(lg); lg.connect(osc.detune); srcs.push(lfo);
    }
    if (o.fm) {   // simple 2-op FM: modulator at f*ratio, depth = index * fmod
      var m = ctx.createOscillator(), mg = ctx.createGain();
      m.type = o.fm.w || 'sine';
      var ratio = o.fm.r, f0 = typeof o.f === 'number' ? o.f : o.f[0][1];
      if (typeof o.f === 'number') m.frequency.setValueAtTime(f0 * ratio * p, t);
      else S.env(m.frequency, t, o.f, ratio * p);
      S.env(mg.gain, t, o.fm.i, f0 * ratio * p);
      m.connect(mg); mg.connect(osc.frequency); srcs.push(m);
    }
    for (var i = 0; i < srcs.length; i++) { srcs[i].start(t); srcs[i].stop(t + dur); }
    return g;
  };

  // Noise layer. o = { c: 'white'|'pink'|'brown'|'metal'|'crackle', rate: n|pts, g, v, dur, lp/hp/bp... }
  S.noise = function (r, out, t, o, p) {
    var ctx = r.ctx; p = p || 1;
    var src = ctx.createBufferSource();
    src.buffer = r.nz[o.c || 'white'];
    src.loop = true;
    if (o.rate) S.env(src.playbackRate, t, o.rate, o.ratek === false ? 1 : p);
    var g = ctx.createGain();
    var dur = o.dur || lastT(o.g || 0.1) + 0.02;
    S.env(g.gain, t, o.g || S.ad(0.001, 0.1), o.v == null ? 1 : o.v);
    var last = chainFx(r, src, o, t, p);
    last.connect(g); g.connect(out);
    src.start(t, o.off == null ? (K.rand() * 1.2) : o.off);
    src.stop(t + dur);
    return g;
  };

  // A sub-bus: gain node feeding out, optional pan/filter. Useful to group layers.
  S.bus = function (r, out, v, o) {
    var g = r.ctx.createGain(); g.gain.value = v == null ? 1 : v;
    var node = g;
    if (o && (o.lp || o.hp || o.bp || o.drive || o.pk)) { var last = chainFx(r, g, o, o.t || 0, 1); node = last; }
    if (o && o.pan != null && r.ctx.createStereoPanner) {
      var pn = r.ctx.createStereoPanner(); S.env(pn.pan, o.t || 0, o.pan); node.connect(pn); node = pn;
    }
    node.connect(out);
    return g;
  };

  // Feedback echo (for spacious one-shots): returns the input node.
  S.echo = function (r, out, t, time, fb, lp, mix, dur) {
    var ctx = r.ctx, d = ctx.createDelay(2), f = ctx.createGain(), l = ctx.createBiquadFilter(), w = ctx.createGain(), inp = ctx.createGain();
    d.delayTime.value = time; f.gain.value = fb; l.type = 'lowpass'; l.frequency.value = lp; w.gain.value = mix;
    inp.connect(d); d.connect(l); l.connect(f); f.connect(d); l.connect(w); w.connect(out);
    inp.connect(out);
    return inp;
  };

  // Bubble "bloop": sine with a fast upward glide.
  S.bubble = function (r, out, t, f, v, len, p) {
    len = len || 0.05;
    return S.osc(r, out, t, { w: 'sine', f: [[0, f], [len, f * 2.6, 'e']], g: [[0, 0], [0.004, 1], [len, 0.0001, 'e']], v: v }, p);
  };

  // Struck-bell partial cluster (inharmonic sines). ratios/amps arrays.
  S.bell = function (r, out, t, f, v, dec, ratios, amps, p) {
    ratios = ratios || [1, 2.76, 5.4, 8.93]; amps = amps || [1, 0.45, 0.22, 0.1];
    for (var i = 0; i < ratios.length; i++) {
      var d = dec / (1 + i * 0.8);
      S.osc(r, out, t, { w: 'sine', f: f * ratios[i], g: [[0, 0], [0.0015, 1], [d, 0.0001, 'e']], v: v * amps[i] }, p);
    }
  };
})();
