"""Core DSP for AFTERGLOW's score and sound design. Everything is synthesized — no samples.

Conventions
- SR = 48000, signals are float32 numpy arrays; mono = shape (n,), stereo = shape (n, 2).
- Times in seconds, frequencies in Hz. All randomness goes through `rng(seed)` so renders are reproducible.
"""
from __future__ import annotations

import numpy as np
from scipy import signal

SR = 48000


def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def n_samples(sec: float) -> int:
    return int(round(sec * SR))


def t_axis(sec: float) -> np.ndarray:
    return np.arange(n_samples(sec), dtype=np.float64) / SR


def mtof(m: float) -> float:
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def note(name: str) -> float:
    """'A4', 'C#5', 'Bb2' -> frequency."""
    letter = name[0].upper()
    rest = name[1:]
    acc = 0
    while rest and rest[0] in '#b':
        acc += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    octave = int(rest)
    return mtof(12 * (octave + 1) + NOTE[letter] + acc)


# ---------------------------------------------------------------- oscillators
def phase_from_freq(freq, sec=None) -> np.ndarray:
    """freq: scalar or per-sample array (Hz). Returns phase in cycles."""
    if np.isscalar(freq):
        return np.arange(n_samples(sec)) * (freq / SR)
    return np.cumsum(np.asarray(freq, dtype=np.float64) / SR)


def sine(freq, sec=None, phase0=0.0):
    return np.sin(2 * np.pi * (phase_from_freq(freq, sec) + phase0)).astype(np.float32)


def _polyblep(t, dt):
    y = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m] if np.ndim(dt) else t[m] / dt
    y[m] = x + x - x * x - 1
    m2 = t > 1 - (dt if np.ndim(dt) == 0 else dt)
    x2 = (t[m2] - 1) / (dt[m2] if np.ndim(dt) else dt)
    y[m2] = x2 * x2 + x2 + x2 + 1
    return y


def saw(freq, sec=None, phase0=0.0):
    """Band-limited sawtooth (polyBLEP)."""
    ph = phase_from_freq(freq, sec) + phase0
    t = ph % 1.0
    dt = (np.full_like(t, freq / SR) if np.isscalar(freq) else np.asarray(freq) / SR)
    return (2 * t - 1 - _polyblep(t, dt)).astype(np.float32)


def square(freq, sec=None, phase0=0.0, pw=0.5):
    ph = phase_from_freq(freq, sec) + phase0
    dt = (np.full(ph.shape, freq / SR) if np.isscalar(freq) else np.asarray(freq) / SR)
    t1 = ph % 1.0
    t2 = (ph + (1 - pw)) % 1.0
    s = np.where(t1 < pw, 1.0, -1.0)
    s = s + _polyblep(t1, dt) - _polyblep(t2, dt)
    return s.astype(np.float32)


def triangle(freq, sec=None, phase0=0.0):
    ph = (phase_from_freq(freq, sec) + phase0) % 1.0
    return (4 * np.abs(ph - 0.5) - 1).astype(np.float32)


def additive(f0, sec, partials, decay=None, inharm=0.0, seed=0):
    """partials: list of amplitudes for harmonics 1..N. decay: per-partial decay rates (1/s) or None.
    inharm: stiffness coefficient B (piano-like stretched partials)."""
    t = t_axis(sec)
    out = np.zeros_like(t)
    r = rng(seed)
    for k, a in enumerate(partials, start=1):
        if a == 0:
            continue
        fk = f0 * k * np.sqrt(1 + inharm * k * k)
        if fk > SR * 0.45:
            break
        env = np.exp(-t * decay[k - 1]) if decay is not None else 1.0
        out += a * env * np.sin(2 * np.pi * fk * t + r.uniform(0, 2 * np.pi))
    return out.astype(np.float32)


# ---------------------------------------------------------------- noise
def white(sec, seed=0):
    return rng(seed).standard_normal(n_samples(sec)).astype(np.float32)


def pink(sec, seed=0):
    n = n_samples(sec)
    X = np.fft.rfft(rng(seed).standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    X /= np.sqrt(f)
    y = np.fft.irfft(X, n)
    return (y / (np.std(y) + 1e-12)).astype(np.float32)


def brown(sec, seed=0):
    n = n_samples(sec)
    X = np.fft.rfft(rng(seed).standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    X /= f
    y = np.fft.irfft(X, n)
    y = signal.sosfilt(signal.butter(2, 15, 'hp', fs=SR, output='sos'), y)
    return (y / (np.std(y) + 1e-12)).astype(np.float32)


# ---------------------------------------------------------------- envelopes
def adsr(sec, a=0.01, d=0.1, s=0.7, r=0.3, curve=3.0):
    """Total length = sec (release included at the end)."""
    n = n_samples(sec)
    t = np.arange(n) / SR
    env = np.empty(n, dtype=np.float64)
    rel_start = max(sec - r, a + d)
    att = t < a
    env[att] = (t[att] / max(a, 1e-6))
    dec = (t >= a) & (t < a + d)
    env[dec] = s + (1 - s) * np.exp(-curve * (t[dec] - a) / max(d, 1e-6))
    sus = (t >= a + d) & (t < rel_start)
    env[sus] = s
    rel = t >= rel_start
    lvl = s
    env[rel] = lvl * np.exp(-curve * (t[rel] - rel_start) / max(r, 1e-6))
    return env.astype(np.float32)


def exp_decay(sec, tau):
    return np.exp(-t_axis(sec) / tau).astype(np.float32)


def fade(x, fin=0.0, fout=0.0, shape='sine'):
    x = x.copy()
    n = len(x)
    def ramp(k):
        u = np.linspace(0, 1, k, dtype=np.float32)
        return np.sin(u * np.pi / 2) ** 2 if shape == 'sine' else u
    if fin > 0:
        k = min(n, n_samples(fin))
        r = ramp(k)
        x[:k] *= r if x.ndim == 1 else r[:, None]
    if fout > 0:
        k = min(n, n_samples(fout))
        r = ramp(k)[::-1]
        x[n - k:] *= r if x.ndim == 1 else r[:, None]
    return x


def line(points, sec):
    """Piecewise-linear automation. points: [(t, value), ...]. Returns per-sample array."""
    t = t_axis(sec)
    ts, vs = zip(*points)
    return np.interp(t, ts, vs).astype(np.float32)


def curve(points, sec, kind='cos'):
    """Smooth (cosine-interpolated) automation curve."""
    t = t_axis(sec)
    ts = np.array([p[0] for p in points]); vs = np.array([p[1] for p in points])
    idx = np.clip(np.searchsorted(ts, t) - 1, 0, len(ts) - 2)
    t0, t1 = ts[idx], ts[idx + 1]
    u = np.clip((t - t0) / np.maximum(t1 - t0, 1e-9), 0, 1)
    if kind == 'cos':
        u = 0.5 - 0.5 * np.cos(np.pi * u)
    return (vs[idx] + (vs[idx + 1] - vs[idx]) * u).astype(np.float32)


# ---------------------------------------------------------------- filters
def _sos(kind, f, order=2, q=None):
    f = np.clip(f, 10, SR * 0.49)
    if kind in ('lp', 'hp'):
        return signal.butter(order, f, 'low' if kind == 'lp' else 'high', fs=SR, output='sos')
    if kind == 'bp':
        lo, hi = f
        return signal.butter(order, [max(10, lo), min(SR * 0.49, hi)], 'band', fs=SR, output='sos')
    raise ValueError(kind)


def lowpass(x, f, order=2):
    return signal.sosfilt(_sos('lp', f, order), x, axis=0).astype(np.float32)


def highpass(x, f, order=2):
    return signal.sosfilt(_sos('hp', f, order), x, axis=0).astype(np.float32)


def bandpass(x, lo, hi, order=2):
    return signal.sosfilt(_sos('bp', (lo, hi), order), x, axis=0).astype(np.float32)


def svf(x, cutoff, q=0.707, mode='lp'):
    """Time-varying state-variable filter (Chamberlin/TPT). cutoff: scalar or per-sample array.
    Slower (python loop in chunks) — use for swept filters on moderate lengths."""
    x = np.asarray(x, dtype=np.float64)
    n = len(x)
    fc = np.broadcast_to(np.asarray(cutoff, dtype=np.float64), (n,))
    g = np.tan(np.pi * np.clip(fc, 10, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    y = np.empty(n)
    ic1 = ic2 = 0.0
    # pure-python loop is fine for a few million samples; vectorised alternatives smear sweeps
    for i in range(n):
        v3 = x[i] - ic2
        v1 = a1[i] * ic1 + a2[i] * v3
        v2 = ic2 + a2[i] * ic1 + a3[i] * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        y[i] = v2 if mode == 'lp' else (v1 if mode == 'bp' else x[i] - k * v1 - v2)
    return y.astype(np.float32)


def swept_lowpass(x, cutoff_curve, block=256, order=2):
    """Fast approximation of a time-varying low-pass: filter in blocks, carrying state.
    cutoff_curve: per-sample array."""
    x = np.asarray(x, dtype=np.float64)
    stereo = x.ndim == 2
    out = np.empty_like(x)
    zi = None
    for s in range(0, len(x), block):
        e = min(len(x), s + block)
        fc = float(np.clip(cutoff_curve[s], 20, SR * 0.45))
        sos = signal.butter(order, fc, 'low', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + ((x.shape[1],) if stereo else ()))
        out[s:e], zi = signal.sosfilt(sos, x[s:e], axis=0, zi=zi)
    return out.astype(np.float32)


def resonator(x, freq, q=50.0):
    """Narrow band-pass (peaking) resonance — for modal / formant work."""
    b, a = signal.iirpeak(np.clip(freq, 20, SR * 0.45), q, fs=SR)
    return signal.lfilter(b, a, x, axis=0).astype(np.float32)


def formant(x, formants):
    """formants: [(freq, bandwidth, gain_db)] — parallel band-pass bank (vowel colour)."""
    out = np.zeros_like(x, dtype=np.float32)
    for f, bw, gdb in formants:
        b, a = signal.iirpeak(f, f / bw, fs=SR)
        out += (10 ** (gdb / 20)) * signal.lfilter(b, a, x, axis=0).astype(np.float32)
    return out


VOWELS = {  # soprano-ish 'aah', 'ooh', 'mmm' formants (Hz, bandwidth, gain dB)
    'a': [(800, 80, 0), (1150, 90, -6), (2900, 120, -32), (3900, 130, -20), (4950, 140, -50)],
    'o': [(450, 70, 0), (800, 80, -11), (2830, 100, -22), (3800, 130, -22), (4950, 135, -50)],
    'u': [(325, 50, 0), (700, 60, -16), (2700, 170, -35), (3800, 180, -40), (4950, 200, -60)],
    'm': [(250, 60, 0), (1300, 200, -24), (2400, 200, -40)],
}


# ---------------------------------------------------------------- dynamics / colour
def saturate(x, drive=1.0):
    return (np.tanh(x * drive) / np.tanh(drive)).astype(np.float32)


def softclip(x, ceiling=0.98):
    return (ceiling * np.tanh(x / ceiling)).astype(np.float32)


def envelope_follower(x, attack=0.005, release=0.15):
    mono = np.abs(x if x.ndim == 1 else x.mean(axis=1)).astype(np.float64)
    # one-pole smoothing using lfilter (symmetric attack/release approximation by max of two)
    a_r = np.exp(-1 / (release * SR))
    a_a = np.exp(-1 / (attack * SR))
    slow = signal.lfilter([1 - a_r], [1, -a_r], mono)
    fast = signal.lfilter([1 - a_a], [1, -a_a], mono)
    return np.maximum(slow, fast * 0.9).astype(np.float32)


def compress(x, threshold_db=-18, ratio=3.0, attack=0.01, release=0.2, makeup_db=0.0):
    env = envelope_follower(x, attack, release)
    lvl = 20 * np.log10(env + 1e-9)
    over = np.maximum(lvl - threshold_db, 0)
    gain_db = -over * (1 - 1 / ratio) + makeup_db
    g = 10 ** (gain_db / 20)
    return (x * (g if x.ndim == 1 else g[:, None])).astype(np.float32)


def duck(x, key, amount_db=-8, attack=0.02, release=0.4, threshold=0.02):
    """Side-chain: lower x when key is loud."""
    env = envelope_follower(key, attack, release)
    g = 10 ** ((amount_db / 20) * np.clip(env / threshold, 0, 1))
    g = np.minimum(1.0, g)
    return (x * (g if x.ndim == 1 else g[:, None])).astype(np.float32)


def limiter(x, ceiling_db=-1.0, lookahead=0.005, release=0.08):
    """Look-ahead peak limiter: instant attack (via look-ahead window), smooth release."""
    from scipy.ndimage import minimum_filter1d
    ceiling = 10 ** (ceiling_db / 20)
    peak = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    req = np.minimum(1.0, ceiling / (peak + 1e-9))
    la = n_samples(lookahead)
    req = minimum_filter1d(req, size=2 * la + 1)
    a = np.exp(-1 / (release * SR))
    smooth = signal.lfilter([1 - a], [1, -a], req, zi=[req[0] * a])[0]
    g = np.minimum(req, smooth)
    y = x * (g[:, None] if x.ndim == 2 else g)
    return np.clip(y, -ceiling, ceiling).astype(np.float32)


# ---------------------------------------------------------------- space
def pan(x, p):
    """Equal-power pan of mono x; p in [-1, 1] scalar or per-sample."""
    p = np.asarray(p, dtype=np.float32)
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1).astype(np.float32)


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


def widen(x, amount=1.2):
    m = (x[:, 0] + x[:, 1]) * 0.5
    s = (x[:, 0] - x[:, 1]) * 0.5 * amount
    return np.stack([m + s, m - s], axis=1).astype(np.float32)


def haas(x, ms=12.0):
    """Mono → stereo by delaying one side slightly."""
    d = n_samples(ms / 1000)
    r = np.concatenate([np.zeros(d, dtype=np.float32), x[:-d] if d else x])
    return np.stack([x, r], axis=1)


def make_ir(sec=4.0, decay=2.5, predelay=0.02, damp_hz=6000, damp_end_hz=1500, seed=11, early=8, width=1.0, size=1.0):
    """Synthesised stereo impulse response: early reflections + exponentially decaying,
    progressively darker, decorrelated noise tail. decay = RT60-ish seconds."""
    n = n_samples(sec)
    r = rng(seed)
    t = np.arange(n) / SR
    env = np.exp(-6.9 * t / decay)  # -60 dB at `decay`
    ir = np.zeros((n, 2), dtype=np.float64)
    for ch in range(2):
        nz = r.standard_normal(n)
        # frequency-dependent decay: split into bands that decay at different rates
        lo = signal.sosfilt(signal.butter(2, damp_end_hz, 'low', fs=SR, output='sos'), nz)
        hi = nz - lo
        hi_env = np.exp(-6.9 * t / max(decay * damp_end_hz / damp_hz * 1.6, 0.05))
        tail = lo * env + hi * env * hi_env
        ir[:, ch] = tail
    ir = ir * (1.0 / np.sqrt(np.sum(ir ** 2, axis=0) + 1e-9))
    # early reflections
    for k in range(early):
        dt = predelay + r.uniform(0.003, 0.08) * size
        i = n_samples(dt)
        if i < n:
            ir[i, 0] += r.uniform(-0.6, 0.6) * (0.85 ** k)
            ir[n_samples(dt * r.uniform(0.9, 1.1)) if i < n - 10 else i, 1] += r.uniform(-0.6, 0.6) * (0.85 ** k)
    pd = n_samples(predelay)
    ir = np.concatenate([np.zeros((pd, 2)), ir])[:n]
    m = ir.mean(axis=1, keepdims=True)
    ir = m + (ir - m) * width
    return ir.astype(np.float32)


_IR_CACHE: dict = {}


def reverb(x, wet=0.3, dry=1.0, ir=None, **ir_kwargs):
    """Convolution reverb. x mono or stereo. Returns stereo of length len(x) + len(ir)."""
    key = tuple(sorted(ir_kwargs.items()))
    if ir is None:
        if key not in _IR_CACHE:
            _IR_CACHE[key] = make_ir(**ir_kwargs)
        ir = _IR_CACHE[key]
    xs = stereo(x).astype(np.float32)
    n = len(xs) + len(ir) - 1
    out = np.zeros((n, 2), dtype=np.float32)
    for ch in range(2):
        out[:, ch] = signal.oaconvolve(xs[:, ch], ir[:, ch], mode='full').astype(np.float32)
    out *= wet
    out[:len(xs)] += xs * dry
    return out


def delay(x, time=0.375, feedback=0.4, wet=0.3, lp=4000, pingpong=True):
    xs = stereo(x).astype(np.float32)
    d = n_samples(time)
    taps = int(np.ceil(np.log(0.001) / np.log(max(feedback, 1e-3))))
    n = len(xs) + d * taps
    out = np.zeros((n, 2), dtype=np.float32)
    out[:len(xs)] += xs
    sig = xs.copy()
    for k in range(1, taps + 1):
        sig = lowpass(sig, lp) * feedback
        if pingpong:
            sig = sig[:, ::-1]
        out[k * d:k * d + len(sig)] += sig * wet
    return out


def shimmer(x, wet=0.4, decay=8.0, seed=5):
    """Octave-up shimmer reverb: reverb of (x + crude octave-up of x)."""
    xs = stereo(x)
    up = np.abs(xs) - np.abs(xs).mean(axis=0)  # full-wave rectification → octave-ish
    up = highpass(up, 600)
    return reverb(xs + 0.25 * up, wet=wet, dry=0.0, sec=decay * 1.3, decay=decay, damp_hz=9000, damp_end_hz=3000, seed=seed)


# ---------------------------------------------------------------- timeline bus
class Bus:
    """A stereo track you can drop clips onto by time."""

    def __init__(self, sec: float, name: str = ''):
        self.name = name
        self.buf = np.zeros((n_samples(sec), 2), dtype=np.float32)

    def add(self, clip, at: float, gain: float = 1.0):
        c = stereo(np.asarray(clip, dtype=np.float32)) * gain
        i = n_samples(at)
        if i >= len(self.buf):
            return self
        if i < 0:
            c = c[-i:]
            i = 0
        e = min(len(self.buf), i + len(c))
        self.buf[i:e] += c[:e - i]
        return self

    def apply(self, fn):
        y = fn(self.buf)
        self.buf = y[:len(self.buf)] if len(y) >= len(self.buf) else np.pad(y, ((0, len(self.buf) - len(y)), (0, 0)))
        return self


# ---------------------------------------------------------------- metering
def lufs(x):
    """Integrated loudness per ITU-R BS.1770-4 (K-weighting at 48 kHz, absolute + relative gating)."""
    xs = stereo(x).astype(np.float64)
    y = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], xs, axis=0)
    y = signal.lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], y, axis=0)
    blk, hop = n_samples(0.4), n_samples(0.1)
    sq = np.sum(y ** 2, axis=1)
    c = np.concatenate([[0.0], np.cumsum(sq)])
    starts = np.arange(0, len(sq) - blk, hop)
    if not len(starts):
        return -70.0
    ms = (c[starts + blk] - c[starts]) / blk
    l = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[l > -70]
    if not len(g):
        return -70.0
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = ms[l > rel]
    return float(-0.691 + 10 * np.log10(np.mean(g2) + 1e-12))


def peak_db(x):
    return float(20 * np.log10(np.abs(x).max() + 1e-12))


def write_wav(path, x, sr=SR):
    import soundfile as sf
    import os
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    sf.write(path, np.asarray(x, dtype=np.float32), sr, subtype='FLOAT')


def read_wav(path):
    import soundfile as sf
    x, sr = sf.read(path, dtype='float32', always_2d=True)
    assert sr == SR, f'{path}: expected {SR} Hz, got {sr}'
    return x
