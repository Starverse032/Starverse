/* LATENT CLASH — synthesized "voice" chirps (AUDIO module).
 * Formant synthesis: a glottal-ish source through three parallel band-pass formants that glide
 * between vowels, plus breathy consonant noise. Not words — short cute vowel blips.
 * Claude 娘: lower, rounder, softer (a/o/u vowels, darker filter, gentle contours).
 * DeepSeek 娘: higher, brighter, peppier (a/e/i vowels, quicker syllables, bouncier contours).
 * Mixer.playVoice(charId, kind, t, opts) — one voice per character at a time (new chirp cuts the old). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var K = LC.audio._;

  var VOW = {   // F1, F2, F3 (adult female-ish, shifted per character)
    a: [850, 1250, 2800], o: [560, 950, 2700], u: [380, 900, 2500], e: [520, 1900, 2850], i: [330, 2350, 3000], n: [300, 1300, 2600]
  };
  var CHAR = {
    claude:   { f0: 300, fs: 0.96, src: 'glottal', lp: 3200, breath: 0.1, speed: 1.0, bend: 1.0, vol: 1.0 },
    deepseek: { f0: 420, fs: 1.1, src: 'reed', lp: 4600, breath: 0.07, speed: 0.82, bend: 1.25, vol: 0.9 }
  };
  // syllables: c = consonant (h breath, t/k click, y glide), v = vowel or [from, to], d = duration (s),
  //            f = pitch contour (ratios of f0), vib = vibrato cents, a = amplitude
  var KINDS = {
    light:   [{ c: 'h', v: 'a', d: 0.085, f: [1.06, 0.96] }],
    medium:  [{ c: 'h', v: ['i', 'a'], d: 0.13, f: [1.0, 1.14, 0.94] }],
    heavy:   [{ c: 't', v: 'e', d: 0.06, f: [1.08, 1.08] }, { c: 'y', v: ['i', 'a'], d: 0.17, f: [1.22, 1.26, 0.9], a: 1.1 }],
    special: [{ c: 'h', v: 'a', d: 0.07, f: [1.0, 1.0] }, { v: 'a', d: 0.07, f: [1.12, 1.12] }, { c: 'y', v: ['e', 'a'], d: 0.2, f: [1.26, 1.34, 1.15], a: 1.1 }],
    super:   [{ c: 'h', v: 'a', d: 0.1, f: [1.0, 1.05] }, { c: 'y', v: ['i', 'a'], d: 0.42, f: [1.12, 1.4, 1.38, 1.25], vib: 30, a: 1.15 }],
    hurt:    [{ c: 'k', v: 'u', d: 0.05, f: [1.32, 1.3] }, { v: ['a', 'o'], d: 0.17, f: [1.28, 0.82] }],
    ko:      [{ c: 'h', v: ['a', 'o'], d: 0.7, f: [1.25, 1.1, 0.62], vib: 45, a: 1.0 }],
    win:     [{ v: 'a', d: 0.1, f: [1.0, 1.0] }, { c: 'y', v: ['i', 'e'], d: 0.24, f: [1.26, 1.5, 1.45], vib: 20 }],
    intro:   [{ v: 'n', d: 0.08, f: [1.0, 1.0], a: 0.6 }, { c: 'h', v: 'e', d: 0.07, f: [1.12, 1.12] }, { v: ['a', 'e'], d: 0.16, f: [1.26, 1.19] }]
  };

  // Per-kind loudness trims from offline measurement (target ≈ -19 LUFS-M at unity; light -22, super -16, ko -18)
  var GAIN = {
    claude:   { light: 2.04, medium: 0.87, heavy: 0.7, special: 1.0, super: 0.56, hurt: 0.8, ko: 1.2, win: 0.5, intro: 0.82 },
    deepseek: { light: 4.0, medium: 1.32, heavy: 1.05, special: 0.74, super: 0.85, hurt: 1.62, ko: 1.64, win: 1.05, intro: 1.16 }
  };

  function syllable(mx, out, t, ch, s, rf, rnd) {
    var ctx = mx.ctx, r = mx.r, d = s.d * ch.speed, f0 = ch.f0 * rf;
    var v0 = VOW[Array.isArray(s.v) ? s.v[0] : s.v], v1 = VOW[Array.isArray(s.v) ? s.v[1] : s.v];
    var src = ctx.createOscillator();
    if (ch.src === 'glottal' || ch.src === 'reed') src.setPeriodicWave(r.wave(ch.src)); else src.type = ch.src;
    var fc = s.f, n = fc.length;
    for (var i = 0; i < n; i++) {
      var ratio = 1 + (fc[i] - 1) * ch.bend, tt = t + d * (n === 1 ? 0 : i / (n - 1));
      if (i === 0) src.frequency.setValueAtTime(f0 * ratio, tt); else src.frequency.exponentialRampToValueAtTime(f0 * ratio, tt);
    }
    var end = t + d + 0.08;
    var srcs = [src];
    if (s.vib) {
      var l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.5 + rnd(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(s.vib, t + d * 0.6);
      l.connect(lg); lg.connect(src.detune); srcs.push(l);
    }
    var amp = ctx.createGain(), a = (s.a || 1);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(a, t + 0.012);
    amp.gain.setValueAtTime(a, t + d * 0.7);
    amp.gain.linearRampToValueAtTime(a * 0.75, t + d);
    amp.gain.linearRampToValueAtTime(0, t + d + 0.05);
    var gains = [1, 0.55, 0.22], bws = [90, 120, 170];
    for (var k = 0; k < 3; k++) {
      var bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass';
      var fa = v0[k] * ch.fs, fb = v1[k] * ch.fs;
      bp.frequency.setValueAtTime(fa, t);
      bp.frequency.linearRampToValueAtTime(fa, t + d * 0.25);
      bp.frequency.linearRampToValueAtTime(fb, t + d * 0.8);
      bp.Q.value = fa / bws[k];
      g.gain.value = gains[k] * (k === 0 ? 1 : 1.4);
      src.connect(bp); bp.connect(g); g.connect(amp);
    }
    amp.connect(out);
    if (s.c) {   // consonant: breath / click
      var nz = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
      nz.buffer = r.nz.white; nf.type = s.c === 'h' ? 'bandpass' : 'highpass';
      nf.frequency.value = s.c === 'h' ? v0[1] * ch.fs : 3200; nf.Q.value = s.c === 'h' ? 1.5 : 0.7;
      var cl = s.c === 'h' ? 0.045 : s.c === 'y' ? 0.02 : 0.012, cv = s.c === 'h' ? 0.35 : s.c === 'y' ? 0.08 : 0.25;
      ng.gain.setValueAtTime(0, t - 0.005); ng.gain.linearRampToValueAtTime(cv, t + 0.004); ng.gain.exponentialRampToValueAtTime(0.0005, t + cl);
      nz.connect(nf); nf.connect(ng); ng.connect(out);
      nz.start(Math.max(0, t - 0.005), rnd()); nz.stop(t + cl + 0.01);
    }
    // continuous breath under the vowel
    var br = ctx.createBufferSource(), bf = ctx.createBiquadFilter(), bg = ctx.createGain();
    br.buffer = r.nz.pink; bf.type = 'bandpass'; bf.frequency.value = v0[1] * ch.fs; bf.Q.value = 2;
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(ch.breath, t + 0.02); bg.gain.linearRampToValueAtTime(0, t + d + 0.03);
    br.connect(bf); bf.connect(bg); bg.connect(out);
    br.start(t, rnd()); br.stop(end);
    srcs.forEach(function (x) { x.start(t); x.stop(end); });
    return d;
  }

  K.Mixer.prototype.playVoice = function (charId, kind, t, opts) {
    var ch = CHAR[charId], syl = KINDS[kind];
    if (!ch) { K.warnOnce('vc:' + charId, 'unknown voice character "' + charId + '"'); return false; }
    if (!syl) { K.warnOnce('vk:' + kind, 'unknown voice kind "' + kind + '"'); return false; }
    opts = opts || {};
    var prev = this.voiceLast[charId];
    if (prev) {
      if (t - prev.t < 0.05) return false;                    // retrigger guard
      prev.g.gain.cancelScheduledValues(t);
      prev.g.gain.setTargetAtTime(0, t, 0.012);
    }
    var ctx = this.ctx, rnd = K.rand;
    var g = ctx.createGain(), lp = ctx.createBiquadFilter(), node = lp;
    lp.type = 'lowpass'; lp.frequency.value = ch.lp; lp.Q.value = 0.5;
    g.gain.value = (opts.vol == null ? 1 : opts.vol) * ch.vol * 0.36 * GAIN[charId][kind];
    g.connect(lp);
    if (opts.pan && ctx.createStereoPanner) { var pn = ctx.createStereoPanner(); pn.pan.value = opts.pan; lp.connect(pn); node = pn; }
    node.connect(this.sfxBus);
    var rf = (1 + (rnd() * 2 - 1) * 0.04) * (opts.pitch || 1), tt = t + 0.002;
    for (var i = 0; i < syl.length; i++) tt += syllable(this, g, tt, ch, syl[i], rf, rnd) + 0.012;
    this.voiceLast[charId] = { g: g, t: t };
    var self = this;
    setTimeout(function () { try { g.disconnect(); node.disconnect(); } catch (e) { /* gone */ } if (self.voiceLast[charId] && self.voiceLast[charId].g === g) self.voiceLast[charId] = null; },
      (tt - t + 0.6) * 1000 + (ctx.currentTime < t ? (t - ctx.currentTime) * 1000 : 0) + (ctx.length ? 1e9 : 0));
    return true;
  };
})();
