"""Sound-design building blocks for AFTERGLOW (SFX part). Everything synthesised, fixed seeds.

Conventions (in addition to dsp.py):
- One-shot generators return a MONO float32 clip whose sample 0 is the acoustic onset (the
  transient starts on that very sample - frame-exact placement is done with integer indices).
- Clips that need a pre-roll (finger noise before a key press) return (clip, preroll_samples).
- Level helpers: `peak_to(x, db)` for transients (dBFS peak per channel), `rms_to(x, db)` for
  steady beds (dBFS RMS, mean power over channels).
"""
from __future__ import annotations

import numpy as np
from scipy import signal

import dsp
from dsp import SR

TINY = 10 ** (-150 / 20)  # flush-to-zero threshold (well below 24-bit LSB)


# ------------------------------------------------------------------ levels / placement
def db(x):
    return 10 ** (x / 20.0)


def peak_to(x, target_db):
    p = float(np.abs(x).max())
    return (x * (db(target_db) / p)).astype(np.float32) if p > 0 else x


def rms_db(x):
    return float(10 * np.log10(np.mean(np.asarray(x, np.float64) ** 2) + 1e-30))


def rms_to(x, target_db):
    r = np.sqrt(np.mean(np.asarray(x, np.float64) ** 2))
    return (x * (db(target_db) / r)).astype(np.float32) if r > 0 else x


def pan_c(x, p):
    """Equal-power pan normalised so that centre = unity in each channel (keeps dBFS peak specs
    true for centred mono sounds). p scalar or per-sample in [-1, 1]."""
    p = np.asarray(p, dtype=np.float32)
    a = (p + 1) * np.pi / 4
    s2 = np.float32(np.sqrt(2.0))
    return np.stack([x * np.cos(a) * s2, x * np.sin(a) * s2], axis=1).astype(np.float32)


def place(buf, clip, idx, gain=1.0, pan=None):
    """Add clip into stereo buf at integer sample index idx (sample-exact)."""
    c = np.asarray(clip, np.float32)
    if c.ndim == 1:
        c = pan_c(c, pan) if pan is not None else np.stack([c, c], axis=1)
    c = c * np.float32(gain)
    i = int(idx)
    if i < 0:
        c = c[-i:]
        i = 0
    if i >= len(buf) or len(c) == 0:
        return
    e = min(len(buf), i + len(c))
    buf[i:e] += c[:e - i]


def frame_idx(f):
    return int(f) * 2000


def t_idx(t):
    return int(round(t * SR))


# ------------------------------------------------------------------ envelopes
def onset_env(n, attack, tau):
    """Starts NON-ZERO on sample 0 (so the onset is exactly where we put it), linear attack of
    `attack` samples, exponential decay with time-constant `tau` samples."""
    k = np.arange(n, dtype=np.float64)
    att = np.minimum(1.0, (k + 1) / max(1, attack))
    dec = np.exp(-np.maximum(0, k - attack) / max(1e-9, tau))
    return (att * dec).astype(np.float32)


def hann(n):
    return np.hanning(n + 2)[1:-1].astype(np.float32) if n > 0 else np.zeros(0, np.float32)


def raised_ramp(n):
    u = (np.arange(n) + 0.5) / max(1, n)
    return (0.5 - 0.5 * np.cos(np.pi * u)).astype(np.float32)


def ease_in_out_cubic(u):
    u = np.clip(u, 0, 1)
    return np.where(u < 0.5, 4 * u ** 3, 1 - (-2 * u + 2) ** 3 / 2)


def ease_in_out_sine(u):
    u = np.clip(u, 0, 1)
    return 0.5 - 0.5 * np.cos(np.pi * u)


def db_curve(points, n, t0=0.0):
    """Piecewise-linear in dB over absolute times; returns linear amplitude per sample."""
    t = t0 + np.arange(n) / SR
    ts, vs = zip(*points)
    return db(np.interp(t, ts, vs)).astype(np.float32)


def fade_edges(x, fin=0.0, fout=0.0):
    x = x.copy()
    if fin > 0:
        k = min(len(x), dsp.n_samples(fin))
        r = raised_ramp(k)
        x[:k] *= r if x.ndim == 1 else r[:, None]
    if fout > 0:
        k = min(len(x), dsp.n_samples(fout))
        r = raised_ramp(k)[::-1]
        x[len(x) - k:] *= r if x.ndim == 1 else r[:, None]
    return x


def smooth_noise(n, rate_hz, seed, lo=-1.0, hi=1.0):
    """Band-limited random walk (cubic-ish interpolation of random points every 1/rate s)."""
    r = dsp.rng(seed)
    step = max(2, int(SR / rate_hz))
    pts = r.uniform(lo, hi, n // step + 4)
    xs = np.arange(len(pts)) * step
    from scipy.interpolate import CubicSpline
    y = CubicSpline(xs, pts)(np.arange(n))
    return np.clip(y, lo - 0.25 * (hi - lo), hi + 0.25 * (hi - lo)).astype(np.float32)


# ------------------------------------------------------------------ filters
def bp(x, lo, hi, order=2):
    return dsp.bandpass(x, max(20, lo), min(SR * 0.47, hi), order)


def peak_res(x, f, q, gain=1.0):
    b, a = signal.iirpeak(min(f, SR * 0.45), q, fs=SR)
    return (gain * signal.lfilter(b, a, x, axis=0)).astype(np.float32)


def swept(x, fc, kind='lp', order=2, block=128, bw_oct=1.0):
    """Block-wise time-varying Butterworth filter with carried state (lp / hp / bp).
    fc: per-sample cutoff (lp/hp) or centre (bp, bandwidth bw_oct octaves)."""
    x = np.asarray(x, dtype=np.float64)
    out = np.empty_like(x)
    zi = None
    fc = np.broadcast_to(np.asarray(fc, np.float64), (len(x),))
    for s in range(0, len(x), block):
        e = min(len(x), s + block)
        f = float(np.clip(fc[s], 15, SR * 0.46))
        if kind == 'bp':
            k = 2 ** (bw_oct / 2)
            sos = signal.butter(order, [max(15, f / k), min(SR * 0.46, f * k)], 'band', fs=SR, output='sos')
        else:
            sos = signal.butter(order, f, 'low' if kind == 'lp' else 'high', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        out[s:e], zi = signal.sosfilt(sos, x[s:e], axis=0, zi=zi)
    return out.astype(np.float32)


def follow_unit(x, win=0.25):
    """Normalise a (non-impulsive) signal to unit short-term RMS (keeps timbre, flattens level),
    so an explicit dB automation curve can then be applied exactly."""
    p = np.mean(np.asarray(x, np.float64) ** 2, axis=1) if x.ndim == 2 else np.asarray(x, np.float64) ** 2
    w = max(1, dsp.n_samples(win))
    c = np.concatenate([[0.0], np.cumsum(p)])
    i = np.arange(len(p))
    a = np.clip(i - w // 2, 0, len(p)); b = np.clip(i + w // 2 + 1, 0, len(p))
    rms = np.sqrt((c[b] - c[a]) / np.maximum(1, b - a)) + 1e-12
    g = 1.0 / rms
    g = np.minimum(g, 1e4)
    return (x * (g[:, None] if x.ndim == 2 else g)).astype(np.float32)


# ------------------------------------------------------------------ noise
def pink_st(sec, seed, corr=0.0):
    """Decorrelated stereo pink noise (corr = 0 fully independent)."""
    a = dsp.pink(sec, seed)
    b = dsp.pink(sec, seed + 7919)
    r = b * np.sqrt(1 - corr ** 2) + a * corr
    return np.stack([a, r], axis=1).astype(np.float32)


def brown_st(sec, seed):
    return np.stack([dsp.brown(sec, seed), dsp.brown(sec, seed + 7919)], axis=1).astype(np.float32)


# ------------------------------------------------------------------ rooms (impulse responses)
_IR = {}


def ir(name):
    if name not in _IR:
        if name == 'room':   # R_room: 0.4 s, near & dry & warm
            _IR[name] = dsp.make_ir(sec=0.7, decay=0.4, predelay=0.004, damp_hz=7000, damp_end_hz=2500, seed=31, early=10, width=0.6, size=0.25)
        elif name == 'void':  # R_void: RT60 7 s, LP 5 kHz, pre-delay 40 ms, wide
            ir_ = dsp.make_ir(sec=8.0, decay=7.0, predelay=0.04, damp_hz=5000, damp_end_hz=1500, seed=37, early=6, width=1.0, size=1.5)
            _IR[name] = dsp.lowpass(ir_, 5000)
        elif name == 'mid':   # medium bloom for word granules (3 s)
            _IR[name] = dsp.make_ir(sec=3.6, decay=3.0, predelay=0.025, damp_hz=8000, damp_end_hz=2500, seed=41, early=8, width=1.0, size=0.8)
        elif name == 'probe':  # metal structure: very short, bright, sparse
            _IR[name] = dsp.make_ir(sec=0.25, decay=0.12, predelay=0.001, damp_hz=9000, damp_end_hz=4000, seed=43, early=14, width=0.3, size=0.05)
        elif name == 'outdoor':  # night air: few reflections, short diffuse tail
            _IR[name] = dsp.make_ir(sec=1.4, decay=0.9, predelay=0.012, damp_hz=5000, damp_end_hz=1500, seed=47, early=5, width=0.8, size=0.6)
    return _IR[name]


def verb(x, name, wet, dry=1.0):
    return dsp.reverb(x, wet=wet, dry=dry, ir=ir(name))


# ------------------------------------------------------------------ heartbeat (#2) & pulsar (#28)
def _body(freq, ms, n):
    """Sine body: non-zero first sample, short attack, decays to ~-40 dB at `ms`."""
    t = np.arange(n) / SR
    env = np.minimum(1.0, (np.arange(n) + 1) / (0.0015 * SR)) * np.exp(-t / (ms / 1000 / 4.5))
    return (np.sin(2 * np.pi * freq * t + 0.35) * env).astype(np.float32)


def _noise_pulse(ms, f, q, seed, n):
    r = dsp.rng(seed)
    k = max(2, int(ms / 1000 * SR))
    x = np.zeros(n, np.float32)
    x[:k] = r.standard_normal(k).astype(np.float32) * onset_env(k, 4, k / 3.5)
    b, a = signal.iirpeak(f, q, fs=SR)
    return signal.lfilter(b, a, x).astype(np.float32)


def heart_lub():
    """lub: 2 ms noise pulse BP 3.2 kHz (Q4) + 12 ms 1.6 kHz decaying sine + 40 ms 110 Hz body (-14 dB)."""
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    click = _noise_pulse(2, 3200, 4, 202, n)
    click /= np.abs(click).max()
    tick = np.sin(2 * np.pi * 1600 * t) * onset_env(n, 8, 0.012 * SR / 4.5)
    body = _body(110, 40, n)
    x = click * 1.0 + tick * 0.55 + body * db(-14)
    return dsp.highpass(x, 40, order=2)


def heart_dub():
    """dub: BP 2.2 kHz noise pulse + 80 Hz body; whole dub -8 dB vs lub (applied at placement)."""
    n = int(0.11 * SR)
    t = np.arange(n) / SR
    click = _noise_pulse(2.5, 2200, 4, 203, n)
    click /= np.abs(click).max()
    tick = np.sin(2 * np.pi * 1100 * t) * onset_env(n, 10, 0.010 * SR / 4.5)
    body = _body(80, 55, n)
    x = click * 1.0 + tick * 0.4 + body * db(-14)
    return dsp.highpass(x, 35, order=2)


def radio(x, hp=90, lp=3000, drive=2.2, hiss_db=-30, seed=0, hiss_env=None):
    """Radio chain: HP + LP + tanh soft clip + receiver hiss (shaped by hiss_env)."""
    y = dsp.highpass(x, hp, order=2)
    y = dsp.lowpass(y, lp, order=4)
    pk = np.abs(y).max() + 1e-12
    y = np.tanh(drive * y / pk) / np.tanh(drive) * pk
    hz = bp(dsp.pink(len(y) / SR, seed), 300, lp, 2)
    hz = hz / (np.sqrt(np.mean(hz ** 2)) + 1e-12) * pk * db(hiss_db)
    if hiss_env is not None:
        hz = hz * hiss_env
    y = y + hz
    return dsp.lowpass(y, min(lp * 1.15, 20000), order=2).astype(np.float32)


def pulsar_sample():
    """30 ms G#6 sine (3 ms ramps) + 40 ms 110 Hz body (the lub recipe, -14 dB), radio-filtered."""
    n = int(0.11 * SR)
    t = np.arange(n) / SR
    k = int(0.030 * SR); rr = int(0.003 * SR)
    g = np.zeros(n, np.float32)
    e = np.ones(k, np.float32); e[:rr] = raised_ramp(rr); e[-rr:] = raised_ramp(rr)[::-1]
    e[0] = max(e[0], 1e-3)
    g[:k] = np.sin(2 * np.pi * 1661.2 * t[:k]) * e
    body = _body(110, 40, n)
    x = g + body * db(-14) * 2.2  # body slightly lifted so it survives the HP 90 Hz
    hiss_env = np.zeros(n, np.float32)
    he = int(0.07 * SR)
    hiss_env[:he] = np.minimum(1, (np.arange(he) + 1) / 48) * np.exp(-np.arange(he) / (0.025 * SR))
    y = radio(x, 90, 3000, 2.0, -24, seed=1919, hiss_env=hiss_env)
    y[0] = y[0] if abs(y[0]) > 0 else 1e-6
    return y


# ------------------------------------------------------------------ keys (#3–#9)
def keystroke(seed=0, body_hz=160, body_ms=20, press_ms=5, press_bp=(1500, 4000), lift_ms=40,
              lift_db=-12, pitch=1.0, felt=0.35, soft_lp=6500, extra_clicks=(), lift_bp=(2200, 5500),
              body2=None, tail=0.09):
    """One keystroke, mono, sample 0 = press transient. pitch scales every frequency."""
    r = dsp.rng(seed)
    n = int((lift_ms / 1000 + tail) * SR)
    t = np.arange(n) / SR
    # press: short noise burst, band-limited ("da", not "clack")
    kp = max(4, int(press_ms / 1000 * SR))
    nz = np.zeros(n, np.float32)
    nz[:kp] = r.standard_normal(kp) * onset_env(kp, 6, kp / 3.0)
    press = bp(nz, press_bp[0] * pitch, press_bp[1] * pitch, 2)
    press = dsp.lowpass(press, soft_lp * pitch, order=2)
    press /= np.abs(press).max() + 1e-12
    # body: damped sine with a tiny downward glide + felt thud
    f = body_hz * pitch * (1 + 0.04 * np.exp(-t / 0.004))
    ph = np.cumsum(f) / SR
    benv = onset_env(n, int(0.0006 * SR), body_ms / 1000 * SR / 4.0)
    body = np.sin(2 * np.pi * ph) * benv
    thud = dsp.lowpass(r.standard_normal(n).astype(np.float32), 700 * pitch, order=2) * onset_env(n, 20, body_ms / 1000 * SR / 5)
    thud /= np.abs(thud).max() + 1e-12
    x = press * 0.9 + body * 0.75 + thud * felt
    if body2 is not None:  # (freq, q, gain): resonant "dong"
        imp = np.zeros(n, np.float32); imp[:int(0.004 * SR)] = hann(int(0.004 * SR))
        res = peak_res(imp, body2[0] * pitch, body2[1])
        x += res / (np.abs(res).max() + 1e-12) * body2[2]
    for (dt_ms, g, lo, hi) in extra_clicks:  # rattles / long click
        i = int(dt_ms / 1000 * SR)
        k = int(0.0015 * SR)
        c = np.zeros(n, np.float32)
        c[i:i + k] = r.standard_normal(k) * onset_env(k, 3, k / 3)
        c = bp(c, lo * pitch, hi * pitch, 2)
        x += c / (np.abs(c).max() + 1e-12) * g
    # lift (key release): smaller click + tiny upper body
    li = int(lift_ms / 1000 * SR)
    if li < n:
        kl = int(0.002 * SR)
        lz = np.zeros(n, np.float32)
        lz[li:li + kl] = r.standard_normal(kl) * onset_env(kl, 4, kl / 3)
        lift = bp(lz, lift_bp[0] * pitch, lift_bp[1] * pitch, 2)
        lift /= np.abs(lift).max() + 1e-12
        tt = np.clip(t - t[li], 0, None)
        lb = np.sin(2 * np.pi * body_hz * 1.35 * pitch * tt) * np.exp(-tt / 0.004) * (t >= t[li])
        x += (lift * 0.8 + lb * 0.3) * db(lift_db)
    x = dsp.highpass(x, 45, order=2)
    return fade_out_tail(x, 0.01)


def fade_out_tail(x, sec):
    k = min(len(x), dsp.n_samples(sec))
    y = x.copy()
    rr = raised_ramp(k)[::-1]
    y[len(y) - k:] *= rr if y.ndim == 1 else rr[:, None]
    return y


def with_room(x, wet=0.16):
    """Bake the near room (R_room) into a key so identical keys stay identical in any context."""
    y = verb(x, 'room', wet=wet, dry=1.0)
    m = y.mean(axis=1)
    side = (y[:, 0] - y[:, 1]) * 0.5
    y = np.stack([m + side * 0.5, m - side * 0.5], axis=1)  # narrow
    y = trim_tail(y)
    return (y * (np.abs(x).max() / (np.abs(y).max() + 1e-12))).astype(np.float32)  # keep the dry peak spec


def trim_tail(y, thresh_db=-110):
    a = np.abs(y).max(axis=1) if y.ndim == 2 else np.abs(y)
    th = a.max() * db(thresh_db)
    nz = np.nonzero(a > th)[0]
    end = int(nz[-1]) + 1 if len(nz) else 1
    y = y[:end]
    return fade_out_tail(y, min(0.02, end / SR / 4))


def finger_noise(seed, ms=22):
    """A breath of finger skin touching the keycap before the press (LP noise)."""
    r = dsp.rng(seed)
    k = int(ms / 1000 * SR)
    x = r.standard_normal(k + 400).astype(np.float32)
    x = dsp.lowpass(x, 1100, order=2)[400:]
    return (x * hann(k)).astype(np.float32)


def tick_4k():
    """Print tick: 4 kHz 1 ms click."""
    k = int(0.001 * SR)
    t = np.arange(k) / SR
    x = np.sin(2 * np.pi * 4000 * t) * hann(k)
    x[0] = 1e-4
    return x.astype(np.float32)


# ------------------------------------------------------------------ granular helpers
def sine_grain(freq, ms, phase=0.0):
    k = max(8, int(ms / 1000 * SR))
    t = np.arange(k) / SR
    return (np.sin(2 * np.pi * freq * t + phase) * hann(k)).astype(np.float32)


class NoiseBank:
    """Pre-filtered noise buffers to slice grains from (fast granular noise)."""

    def __init__(self, bands, sec=1.5, seed=0, order=2):
        self.bands = bands
        self.buf = []
        for i, (lo, hi) in enumerate(bands):
            x = bp(dsp.white(sec, seed + i), lo, hi, order)
            self.buf.append(x / (np.std(x) + 1e-12))

    def grain(self, band, n, r):
        b = self.buf[band]
        s = int(r.integers(0, len(b) - n - 1))
        return b[s:s + n]


def pitch_up(x, ratio):
    """Resample-based pitch/speed-up by `ratio` with anti-alias pre-filter."""
    y = dsp.lowpass(x, min(SR * 0.45, 0.42 * SR / ratio), order=4)
    n = int(len(y) / ratio)
    src = np.arange(n) * ratio
    return np.interp(src, np.arange(len(y)), y).astype(np.float32)
