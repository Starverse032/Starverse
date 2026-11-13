/* LATENT CLASH — audio analysis helpers (AUDIO dev tooling; loaded by dev/audio-render.html).
 * Pure functions on AudioBuffers: loudness (BS.1770 K-weighted LUFS), peak, DC, clipping,
 * active duration, attack time, spectral centroid / band split, PNG waveform + spectrogram, WAV. */
(function () {
  'use strict';
  var LCA = window.LCA = {};

  function fft(re, im) {          // in-place radix-2
    var n = re.length, i, j = 0, k, m;
    for (i = 1; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { var tr = re[i]; re[i] = re[j]; re[j] = tr; var ti = im[i]; im[i] = im[j]; im[j] = ti; }
    }
    for (m = 2; m <= n; m <<= 1) {
      var ang = -2 * Math.PI / m, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += m) {
        var cr = 1, ci = 0;
        for (k = 0; k < m / 2; k++) {
          var a = i + k, b = a + m / 2;
          var xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  LCA.fft = fft;

  function chans(buf) { var a = []; for (var c = 0; c < buf.numberOfChannels; c++) a.push(buf.getChannelData(c)); return a; }
  function db(x) { return x > 0 ? 20 * Math.log10(x) : -Infinity; }

  // K-weighting biquads (BS.1770, exact at 48 kHz; recomputed for other rates)
  function kCoefs(sr) {
    var f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
    var K = Math.tan(Math.PI * f0 / sr), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    var a0 = 1 + K / Q + K * K;
    var s1 = { b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] };
    var f1 = 38.13547087602444, Q1 = 0.5003270373238773, K1 = Math.tan(Math.PI * f1 / sr);
    var a01 = 1 + K1 / Q1 + K1 * K1;
    var s2 = { b: [1, -2, 1], a: [2 * (K1 * K1 - 1) / a01, (1 - K1 / Q1 + K1 * K1) / a01] };
    return [s1, s2];
  }
  function biquad(x, c) {
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var v = c.b[0] * x[i] + c.b[1] * x1 + c.b[2] * x2 - c.a[0] * y1 - c.a[1] * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  // Momentary (400 ms) / short-term (3 s) max and integrated (gated) loudness.
  LCA.loudness = function (buf) {
    var sr = buf.sampleRate, cs = kCoefs(sr), ch = chans(buf).map(function (x) { return biquad(biquad(x, cs[0]), cs[1]); });
    var n = buf.length, hop = Math.floor(sr * 0.1);
    function blocks(win) {
      var out = [], w = Math.floor(sr * win);
      if (n < w) w = n;
      for (var s = 0; s + w <= n; s += hop) {
        var sum = 0;
        for (var c = 0; c < ch.length; c++) { var d = ch[c]; for (var i = s; i < s + w; i++) sum += d[i] * d[i]; }
        out.push(sum / w * (ch.length === 1 ? 2 : 1));   // mono counted as both channels (dual mono)
      }
      return out;
    }
    function L(z) { return -0.691 + 10 * Math.log10(z + 1e-20); }
    var m = blocks(0.4), mMax = -Infinity, s = blocks(3), sMax = -Infinity;
    m.forEach(function (z) { mMax = Math.max(mMax, L(z)); });
    s.forEach(function (z) { sMax = Math.max(sMax, L(z)); });
    var g1 = m.filter(function (z) { return L(z) > -70; });
    var mean1 = g1.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, g1.length);
    var rel = L(mean1) - 10;
    var g2 = g1.filter(function (z) { return L(z) > rel; });
    var mean2 = g2.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, g2.length);
    return { M: mMax, S: sMax, I: g2.length ? L(mean2) : -Infinity };
  };

  LCA.stats = function (buf, from, to) {
    var sr = buf.sampleRate, ch = chans(buf), n = buf.length;
    from = Math.floor((from || 0) * sr); to = Math.min(n, to ? Math.floor(to * sr) : n);
    var peak = 0, sum = 0, dc = 0, clips = 0, i, c;
    for (c = 0; c < ch.length; c++) {
      var d = ch[c];
      for (i = from; i < to; i++) { var v = d[i], a = Math.abs(v); if (a > peak) peak = a; sum += v * v; dc += v; if (a >= 0.999) clips++; }
    }
    var cnt = (to - from) * ch.length;
    // envelope in 0.25 ms blocks (max over channels)
    var blk = Math.max(1, Math.floor(sr * 0.00025)), env = [];
    for (i = from; i < to; i += blk) {
      var mx = 0;
      for (c = 0; c < ch.length; c++) for (var j = i; j < Math.min(to, i + blk); j++) mx = Math.max(mx, Math.abs(ch[c][j]));
      env.push(mx);
    }
    var onset = -1, last = -1;
    for (i = 0; i < env.length; i++) if (env[i] > peak * 0.01) { onset = i; break; }
    for (i = env.length - 1; i >= 0; i--) if (env[i] > peak * 0.00316) { last = i; break; }     // -50 dB re peak
    var early = 0, att = -1;
    for (i = onset; i >= 0 && i < Math.min(env.length, onset + 240); i++) early = Math.max(early, env[i]);
    for (i = onset; i >= 0 && i < env.length; i++) if (env[i] >= early * 0.5) { att = i; break; }
    // active RMS (onset..last)
    var aS = from + Math.max(0, onset) * blk, aE = from + Math.max(0, last) * blk, asum = 0;
    for (c = 0; c < ch.length; c++) for (i = aS; i < aE; i++) asum += ch[c][i] * ch[c][i];
    var spec = LCA.spectrum(buf, aS / sr, aE / sr);
    var sub = buf;
    if (from > 0 || to < n) {
      sub = new AudioBuffer({ numberOfChannels: ch.length, length: Math.max(1, to - from), sampleRate: sr });
      for (c = 0; c < ch.length; c++) sub.getChannelData(c).set(ch[c].subarray(from, to));
    }
    var lu = LCA.loudness(sub);
    return {
      peakDb: db(peak), rmsDb: db(Math.sqrt(asum / Math.max(1, (aE - aS) * ch.length))), dc: dc / cnt, clips: clips,
      onsetMs: onset * blk / sr * 1000, attackMs: att >= 0 ? (att - onset) * blk / sr * 1000 : -1,
      durMs: (last - onset) * blk / sr * 1000, lufsM: lu.M, lufsS: lu.S, lufsI: lu.I,
      centroid: spec.centroid, bands: spec.bands
    };
  };

  // Energy-weighted spectral centroid and band split over [t0, t1].
  LCA.spectrum = function (buf, t0, t1) {
    var sr = buf.sampleRate, ch = chans(buf), N = 2048, hop = 512;
    var s0 = Math.floor(t0 * sr), s1 = Math.min(buf.length, Math.floor(t1 * sr));
    var re = new Float64Array(N), im = new Float64Array(N), win = new Float64Array(N), i;
    for (i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    var cw = 0, ew = 0, bands = [0, 0, 0, 0, 0];
    var edges = [120, 500, 2000, 5000];
    for (var s = s0; s < Math.max(s0 + 1, s1 - N / 4); s += hop) {
      for (i = 0; i < N; i++) {
        var v = 0;
        for (var c = 0; c < ch.length; c++) v += (s + i < buf.length ? ch[c][s + i] : 0);
        re[i] = v * win[i]; im[i] = 0;
      }
      fft(re, im);
      for (var k = 1; k < N / 2; k++) {
        var p = re[k] * re[k] + im[k] * im[k], f = k * sr / N;
        cw += p * f; ew += p;
        var b = 0; while (b < 4 && f >= edges[b]) b++;
        bands[b] += p;
      }
    }
    var tot = bands.reduce(function (a, b) { return a + b; }, 0) || 1;
    return { centroid: ew ? cw / ew : 0, bands: bands.map(function (x) { return Math.round(x / tot * 1000) / 10; }) };
  };

  // Waveform + spectrogram PNG (dataURL).
  LCA.png = function (buf, title, opts) {
    opts = opts || {};
    var W = opts.w || 960, HW = 150, HS = 300, sr = buf.sampleRate, ch = chans(buf), n = buf.length;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = HW + HS + 34;
    var g = cv.getContext('2d');
    g.fillStyle = '#0b0a14'; g.fillRect(0, 0, W, cv.height);
    g.fillStyle = '#f4efe6'; g.font = '12px monospace'; g.fillText(title || '', 6, 13);
    var y0 = 18, mid = y0 + HW / 2;
    g.strokeStyle = '#3b3670';
    [1, 0.5].forEach(function (a) { [mid - a * HW / 2, mid + a * HW / 2].forEach(function (y) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }); });
    var cols = ['rgba(255,209,102,0.85)', 'rgba(88,212,255,0.6)'];
    for (var c = 0; c < ch.length; c++) {
      g.fillStyle = cols[c];
      for (var x = 0; x < W; x++) {
        var a = Math.floor(x * n / W), b = Math.floor((x + 1) * n / W), lo = 0, hi = 0;
        for (var i = a; i < b; i++) { var v = ch[c][i]; if (v < lo) lo = v; if (v > hi) hi = v; }
        g.fillRect(x, mid - hi * HW / 2, 1, Math.max(1, (hi - lo) * HW / 2));
      }
    }
    // time ticks
    var dur = n / sr, step = dur > 20 ? 5 : dur > 5 ? 1 : dur > 1 ? 0.1 : 0.05;
    g.fillStyle = '#9b96b8';
    for (var tt = 0; tt <= dur; tt += step) { var tx = tt / dur * W; g.fillRect(tx, y0 + HW, 1, 4); if ((Math.round(tt / step)) % (dur > 1 && dur <= 5 ? 5 : 2) === 0) g.fillText(tt.toFixed(step < 1 ? 2 : 0), tx + 2, y0 + HW + 12); }
    // spectrogram (log frequency 30 Hz .. 20 kHz)
    var sy = y0 + HW + 16, N = 2048, re = new Float64Array(N), im = new Float64Array(N), win = new Float64Array(N);
    for (i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    var img = g.createImageData(W, HS), fl = Math.log(30), fh = Math.log(20000);
    for (x = 0; x < W; x++) {
      var s = Math.floor(x * n / W) - N / 2;
      for (i = 0; i < N; i++) {
        var q = s + i, v2 = 0;
        if (q >= 0 && q < n) for (c = 0; c < ch.length; c++) v2 += ch[c][q];
        re[i] = v2 * win[i] / ch.length; im[i] = 0;
      }
      fft(re, im);
      for (var y = 0; y < HS; y++) {
        var f = Math.exp(fl + (fh - fl) * (1 - y / HS)), k = Math.min(N / 2 - 1, Math.max(1, Math.round(f * N / sr)));
        var mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / (N / 4), d = 20 * Math.log10(mag + 1e-9);
        var u = Math.max(0, Math.min(1, (d + 96) / 96));
        var o = (y * W + x) * 4;
        img.data[o] = Math.floor(255 * Math.min(1, u * 1.6)); img.data[o + 1] = Math.floor(255 * Math.max(0, u * 1.5 - 0.5)); img.data[o + 2] = Math.floor(255 * Math.max(0, Math.min(1, (u < 0.4 ? u * 1.5 : 1.0 - (u - 0.4) * 1.4)) )); img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, sy);
    g.fillStyle = '#f4efe6';
    [100, 1000, 2000, 5000, 10000].forEach(function (f) {
      var yy = sy + HS * (1 - (Math.log(f) - fl) / (fh - fl));
      g.fillRect(0, yy, 6, 1); g.fillText(f >= 1000 ? (f / 1000) + 'k' : String(f), 8, yy + 4);
    });
    if (opts.marks) opts.marks.forEach(function (m) { var mx = m / dur * W; g.fillStyle = 'rgba(255,77,109,0.9)'; g.fillRect(mx, y0, 1, HW + HS + 16); });
    return cv.toDataURL('image/png');
  };

  LCA.wav = function (buf) {     // 16-bit PCM WAV as base64
    var ch = chans(buf), n = buf.length, nc = ch.length, sr = buf.sampleRate;
    var ab = new ArrayBuffer(44 + n * nc * 2), dv = new DataView(ab);
    function str(o, s) { for (var i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * nc * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nc, true); dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * nc * 2, true); dv.setUint16(32, nc * 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * nc * 2, true);
    var o = 44;
    for (var i = 0; i < n; i++) for (var c = 0; c < nc; c++) { var v = Math.max(-1, Math.min(1, ch[c][i])); dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
    var bytes = new Uint8Array(ab), bin = '', CH = 0x8000;
    for (i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  };

  // Seam comparison: RMS of the difference between two equally long windows, relative to signal.
  LCA.compare = function (buf, a0, b0, len) {
    var sr = buf.sampleRate, ch = chans(buf), A = Math.floor(a0 * sr), B = Math.floor(b0 * sr), L = Math.floor(len * sr);
    var ds = 0, ss = 0;
    for (var c = 0; c < ch.length; c++) for (var i = 0; i < L; i++) { var x = ch[c][A + i] || 0, y = ch[c][B + i] || 0; ds += (x - y) * (x - y); ss += x * x; }
    return { diffDb: 10 * Math.log10((ds + 1e-20) / (ss + 1e-20)), rmsDb: 10 * Math.log10(ss / (L * ch.length) + 1e-20) };
  };
  // RMS in consecutive windows around a time (gap / spike detector).
  LCA.windows = function (buf, t, span, win) {
    var sr = buf.sampleRate, ch = chans(buf), w = Math.floor(win * sr), out = [];
    for (var s = Math.floor((t - span) * sr); s < Math.floor((t + span) * sr); s += w) {
      var sum = 0;
      for (var c = 0; c < ch.length; c++) for (var i = s; i < s + w; i++) { var v = ch[c][i] || 0; sum += v * v; }
      out.push(Math.round(10 * Math.log10(sum / (w * ch.length) + 1e-20) * 10) / 10);
    }
    return out;
  };
})();
