"""Synthesised instruments for the AFTERGLOW score. Each returns a float32 array (mono unless noted)
for ONE note/event; place them on a dsp.Bus. Recipes are tuned to sound "acoustic-adjacent" and
cinematic rather than chiptune: slow attacks, gentle inharmonicity, ensemble detune, air noise,
and everything is meant to be heard through dsp.reverb.
"""
from __future__ import annotations

import numpy as np

import dsp
from dsp import SR, n_samples, t_axis


def _vibrato(sec, rate=5.0, depth_cents=8.0, delay=0.3, seed=0):
    t = t_axis(sec)
    r = dsp.rng(seed)
    onset = np.clip((t - delay) / 0.6, 0, 1)
    wobble = np.sin(2 * np.pi * rate * t + r.uniform(0, 6.28)) + 0.3 * np.sin(2 * np.pi * rate * 0.53 * t)
    return 2 ** (depth_cents / 1200 * wobble * onset)


def organ(freq, sec, stops=(1.0, 0.55, 0.3, 0.18, 0.1, 0.06), chiff=0.15, seed=0):
    """Pipe organ (Interstellar-like): additive flue ranks (8', 4', 2 2/3', 2', 1 3/5', 1'),
    slow wind attack, a little 'chiff' at the start and slight rank detune. Sustains for `sec`."""
    t = t_axis(sec)
    r = dsp.rng(seed)
    ratios = [1, 2, 3, 4, 5, 8]
    out = np.zeros_like(t)
    for k, (ratio, amp) in enumerate(zip(ratios, stops)):
        if freq * ratio > SR * 0.45:
            break
        det = 1 + r.uniform(-0.0008, 0.0008)
        ph = r.uniform(0, 2 * np.pi)
        # each rank: fundamental + a couple of weak harmonics (flue pipes are nearly sine)
        rank = np.sin(2 * np.pi * freq * ratio * det * t + ph) + 0.12 * np.sin(4 * np.pi * freq * ratio * det * t + ph)
        out += amp * rank
    wind = np.clip(t / 0.09, 0, 1) ** 1.5 * (1 - np.exp(-t / 0.25))
    rel = np.clip((sec - t) / 0.25, 0, 1)
    out *= wind * rel
    if chiff > 0:
        nz = dsp.bandpass(dsp.white(sec, seed + 1), freq * 2, min(freq * 8, 15000))
        out += chiff * nz * np.exp(-t / 0.04)
    out += 0.004 * dsp.lowpass(dsp.white(sec, seed + 2), 3000) * wind  # wind noise
    return (out / (sum(stops) + 1e-9)).astype(np.float32)


def felt_piano(freq, sec=4.0, vel=0.7, seed=0):
    """Soft 'felt' piano: stretched partials with frequency-dependent decay, muted hammer thump,
    double-string beating, darker at low velocity."""
    t = t_axis(sec)
    r = dsp.rng(seed)
    B = 0.0004 * (freq / 261.6) ** 0.5
    out = np.zeros_like(t)
    n_part = int(min(24, (SR * 0.4) // freq))
    bright = 0.35 + 0.65 * vel
    for k in range(1, n_part + 1):
        fk = freq * k * np.sqrt(1 + B * k * k)
        amp = (1 / k ** (1.6 - 0.6 * bright)) * np.exp(-k * 0.08 / bright)
        dec = 0.6 + 0.35 * k ** 1.15 * (freq / 261.6) ** 0.35
        det = 1 + r.uniform(0.0002, 0.0012)
        env = np.exp(-t * dec) * 0.75 + 0.25 * np.exp(-t * dec * 0.25)
        out += amp * env * (np.sin(2 * np.pi * fk * t + r.uniform(0, 6.28)) + 0.6 * np.sin(2 * np.pi * fk * det * t))
    thump = dsp.lowpass(dsp.white(0.05, seed + 3), 700) * np.exp(-t_axis(0.05) / 0.012) * 0.6
    out[:len(thump)] += thump
    att = np.clip(t / 0.004, 0, 1)
    out *= att * vel
    return (out / 2.0).astype(np.float32)


def pad(freq, sec, voices=7, detune_cents=14, cutoff=1800, attack=1.5, release=2.5, seed=0, bright_sweep=None):
    """Lush ensemble pad: detuned band-limited saws, slow low-pass, gentle movement. Stereo."""
    r = dsp.rng(seed)
    t = t_axis(sec)
    L = np.zeros_like(t, dtype=np.float32); R = np.zeros_like(L)
    for v in range(voices):
        c = (v / max(1, voices - 1) - 0.5) * 2 * detune_cents
        drift = 1 + 0.0006 * np.sin(2 * np.pi * r.uniform(0.05, 0.2) * t + r.uniform(0, 6.28))
        s = dsp.saw(freq * 2 ** (c / 1200) * drift, phase0=r.uniform(0, 1))
        p = (v / max(1, voices - 1) - 0.5) * 1.6
        L += s * np.cos((p + 1) * np.pi / 4); R += s * np.sin((p + 1) * np.pi / 4)
    x = np.stack([L, R], axis=1) / voices
    cut = bright_sweep if bright_sweep is not None else np.full(len(t), cutoff, np.float32)
    x = dsp.swept_lowpass(x, cut, order=2)
    x = dsp.lowpass(x, min(SR * 0.45, cutoff * 2.5))
    env = dsp.adsr(sec, a=attack, d=0.5, s=0.9, r=release, curve=2.5)
    return (x * env[:, None]).astype(np.float32)


def strings(freq, sec, attack=0.8, release=1.5, vib=True, seed=0, brightness=1.0):
    """Section strings: detuned saws with vibrato, body resonances, bow noise. Stereo."""
    r = dsp.rng(seed)
    t = t_axis(sec)
    out = np.zeros((len(t), 2), np.float32)
    for v in range(6):
        vf = _vibrato(sec, rate=r.uniform(4.6, 5.6), depth_cents=r.uniform(5, 11), delay=0.2, seed=seed + v) if vib else 1.0
        f = freq * 2 ** (r.uniform(-7, 7) / 1200) * vf
        s = dsp.saw(f, sec, phase0=r.uniform(0, 1)) if not np.isscalar(f) else dsp.saw(f, sec)
        out += dsp.pan(s, r.uniform(-0.7, 0.7))
    body = dsp.formant(out, [(300, 120, 0), (1000, 300, -4), (2800, 600, -10)]) * 0.6 + out * 0.4
    body = dsp.lowpass(body, 2200 * brightness + freq * 2)
    bow = dsp.bandpass(dsp.white(sec, seed + 9), 2000, 7000) * 0.02
    env = dsp.adsr(sec, a=attack, d=0.3, s=0.95, r=release, curve=2.2)
    return ((body / 6 + dsp.stereo(bow)) * env[:, None]).astype(np.float32)


def choir(freq, sec, vowel='a', voices=8, attack=1.2, release=2.0, seed=0):
    """'Aah' choir: pulse/saw glottal sources with vibrato & jitter through vowel formants. Stereo."""
    r = dsp.rng(seed)
    t = t_axis(sec)
    out = np.zeros((len(t), 2), np.float32)
    for v in range(voices):
        vf = _vibrato(sec, rate=r.uniform(4.8, 5.8), depth_cents=r.uniform(10, 20), delay=0.4, seed=seed * 31 + v)
        f = freq * 2 ** (r.uniform(-9, 9) / 1200) * vf
        src = 0.6 * dsp.saw(f, phase0=r.uniform(0, 1)) + 0.4 * dsp.square(f, pw=0.35, phase0=r.uniform(0, 1))
        breath = dsp.highpass(dsp.white(sec, seed + 100 + v), 1500) * 0.05
        out += dsp.pan(src + breath, r.uniform(-0.8, 0.8))
    form = dsp.formant(out, dsp.VOWELS[vowel])
    env = dsp.adsr(sec, a=attack, d=0.4, s=0.92, r=release, curve=2.0)
    return (dsp.lowpass(form, 6000) / voices * 0.7 * env[:, None]).astype(np.float32)


def bell(freq, sec=6.0, vel=0.8, seed=0, kind='glass'):
    """Modal bell / glass / celesta. kind: 'glass' (pure, celesta-like), 'bell' (church-bell partials)."""
    t = t_axis(sec)
    r = dsp.rng(seed)
    if kind == 'bell':
        modes = [(0.5, 1.0, 0.6), (1.0, 0.8, 1.0), (1.19, 0.5, 1.4), (1.5, 0.4, 1.8), (2.0, 0.5, 2.2), (2.5, 0.25, 3.0), (3.0, 0.2, 3.5), (4.07, 0.12, 4.5)]
    else:
        modes = [(1.0, 1.0, 1.2), (2.76, 0.35, 3.5), (5.40, 0.12, 7.0), (8.93, 0.05, 11.0)]
    out = np.zeros_like(t)
    for ratio, amp, dec in modes:
        f = freq * ratio * (1 + r.uniform(-0.001, 0.001))
        if f > SR * 0.45:
            continue
        beat = 1 + 0.02 * np.sin(2 * np.pi * r.uniform(0.3, 1.5) * t)
        out += amp * np.exp(-t * dec / max(0.2, vel)) * np.sin(2 * np.pi * f * t + r.uniform(0, 6.28)) * beat
    strike = dsp.highpass(dsp.white(0.01, seed + 5), 3000) * np.exp(-t_axis(0.01) / 0.002) * 0.3
    out[:len(strike)] += strike
    return (out * vel * 0.5).astype(np.float32)


def sub_boom(sec=6.0, f0=55.0, f1=28.0, drive=1.6, seed=0):
    """Cinematic low impact: pitch-dropping sine + noise crack + saturated body. Mono."""
    t = t_axis(sec)
    f = f1 + (f0 - f1) * np.exp(-t / 0.35)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (sec * 0.35))
    crack = dsp.lowpass(dsp.white(sec, seed), 900) * np.exp(-t / 0.08) * 0.5
    x = dsp.saturate(body + crack, drive)
    return (x * np.clip(t / 0.003, 0, 1)).astype(np.float32)


def braam(freq=55.0, sec=4.0, seed=0):
    """Brass-like 'BRAAAM': detuned saws + octave, fast filter opening, saturation. Stereo."""
    t = t_axis(sec)
    r = dsp.rng(seed)
    x = np.zeros((len(t), 2), np.float32)
    for k, mult in enumerate([1, 1, 2, 0.5, 1.5]):
        for d in (-12, 0, 12):
            s = dsp.saw(freq * mult * 2 ** (d / 1200 + r.uniform(-0.002, 0.002)), sec)
            x += dsp.pan(s * (0.5 if mult == 1.5 else 1.0), r.uniform(-0.6, 0.6))
    cut = dsp.curve([(0, 120), (0.15, 2400), (1.2, 900), (sec, 300)], sec)
    x = dsp.swept_lowpass(x / 15, cut, order=2)
    x = dsp.saturate(x * 2.2, 2.0)
    env = dsp.adsr(sec, a=0.04, d=0.6, s=0.7, r=1.6)
    return (x * env[:, None]).astype(np.float32)


def riser(sec=6.0, f0=80.0, f1=2400.0, seed=0, noise=0.6):
    """Tension riser: Shepard-ish rising tones + swept noise, exponential crescendo. Stereo."""
    t = t_axis(sec)
    u = t / sec
    f = f0 * (f1 / f0) ** u
    tone = np.zeros_like(t)
    for k in range(4):
        tone += np.sin(2 * np.pi * np.cumsum(f * 2 ** (k * 0.5)) / SR) * (0.5 ** k)
    nz = dsp.swept_lowpass(dsp.white(sec, seed), f * 3, order=2)
    x = (tone * 0.5 + nz * noise) * (u ** 2.2)
    return dsp.haas(x.astype(np.float32), 9.0)


def reverse_swell(x, sec=3.0, **rv):
    """Reverse-reverb swell into a hit: reverb(x) reversed and trimmed to `sec` (ends at the hit)."""
    wet = dsp.reverb(x, wet=1.0, dry=0.0, **({'sec': 5, 'decay': 4} | rv))
    rev = wet[::-1]
    n = n_samples(sec)
    return rev[-n:] if len(rev) >= n else rev


def key_click(seed=0, bright=1.0):
    """One keyboard keystroke (soft mechanical/laptop): click transient + body thock. Mono, ~80 ms."""
    r = dsp.rng(seed)
    sec = 0.09
    t = t_axis(sec)
    click = dsp.bandpass(dsp.white(sec, seed), 2500 * bright, 9000) * np.exp(-t / 0.004)
    thock = dsp.bandpass(dsp.white(sec, seed + 1), 180, 900) * np.exp(-t / 0.018) * 0.8
    ping = np.sin(2 * np.pi * r.uniform(1800, 2600) * t) * np.exp(-t / 0.01) * 0.15
    x = click * 0.5 + thock + ping
    return (x / (np.abs(x).max() + 1e-9) * r.uniform(0.6, 1.0)).astype(np.float32)


def ui_tone(freq=880.0, sec=0.25, seed=0):
    """Clean interface blip: sine + soft octave, quick decay."""
    t = t_axis(sec)
    x = (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)) * np.exp(-t / (sec * 0.25))
    return (x * np.clip(t / 0.002, 0, 1) * 0.5).astype(np.float32)


# =====================================================================================
# Score instruments (screenplay §6.4). Everything below is used by audio/score.py.
# Conventions: `n` = samples; per-sample automation arrays have length n; clips are float32,
# mono (n,) or stereo (n, 2); sample 0 of a clip is its acoustic onset.
# =====================================================================================
from scipy import signal as _sig  # noqa: E402


def smooth_noise(n, rate_hz, seed):
    """Band-limited random walk (~unit std), spectral content below ~rate_hz. Cosine-interpolated."""
    r = dsp.rng(seed)
    m = int(n * rate_hz / SR) + 4
    pts = r.standard_normal(m)
    x = np.linspace(0, m - 3, n)
    i = x.astype(np.int64)
    u = x - i
    u = 0.5 - 0.5 * np.cos(np.pi * u)
    return (pts[i] * (1 - u) + pts[i + 1] * u)


def raised(n):
    """Raised-cosine ramp 0→1 of n samples."""
    if n <= 0:
        return np.zeros(0)
    return 0.5 - 0.5 * np.cos(np.pi * np.arange(n) / n)


def ar_env(n, attack, release, hold=None, a_shape=1.0):
    """Attack (raised cosine, optionally ^a_shape) → sustain 1 → release (cosine) over the last
    `release` seconds of the n samples. Returns float64 (n,)."""
    e = np.ones(n)
    na = min(n, n_samples(attack))
    if na:
        e[:na] = raised(na) ** a_shape
    nr = min(n - na, n_samples(release))
    if nr > 0:
        e[n - nr:] *= raised(nr)[::-1]
    return e


def peq(x, f, q, gain_db):
    """RBJ peaking EQ."""
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * f / SR
    al = np.sin(w) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w), 1 - al * A])
    a = np.array([1 + al / A, -2 * np.cos(w), 1 - al / A])
    return _sig.lfilter(b / a[0], a / a[0], x, axis=0)


def lp1(x, fc):
    """One-pole low-pass (−6 dB/oct)."""
    a = np.exp(-2 * np.pi * fc / SR)
    return _sig.lfilter([1 - a], [1, -a], x, axis=0)


def sos_lp(x, fc, order=2):
    return _sig.sosfilt(_sig.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x, axis=0)


def sos_hp(x, fc, order=2):
    return _sig.sosfilt(_sig.butter(order, max(fc, 10), 'high', fs=SR, output='sos'), x, axis=0)


def sos_bp(x, lo, hi, order=2):
    return _sig.sosfilt(_sig.butter(order, [max(10, lo), min(SR * 0.45, hi)], 'band', fs=SR, output='sos'), x, axis=0)


def blsaw(freq, phase0=0.0):
    """Band-limited saw from a per-sample frequency array (polyBLEP), starting at phase0 (cycles)."""
    f = np.asarray(freq, dtype=np.float64)
    ph = np.cumsum(f / SR) + phase0
    t = ph % 1.0
    dt = f / SR
    y = 2 * t - 1
    m = t < dt
    x = t[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m2 = t > 1 - dt
    x2 = (t[m2] - 1) / dt[m2]
    y[m2] -= x2 * x2 + x2 + x2 + 1
    return y


def frac_delay(x, d_samples):
    """Read x at (n − d[n]) with linear interpolation (d per-sample array)."""
    n = len(x)
    idx = np.arange(n) - d_samples
    return np.interp(idx, np.arange(n), x, left=0.0, right=0.0)


def pan2(x, p):
    p = np.asarray(p, dtype=np.float64)
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


# ------------------------------------------------------------------ the Asker (AI's voice)
def asker(n, f_curve, amp, vib_cents=None, seed=0, breath_db=-30.0):
    """The Asker (§6.4-1): sine + 2nd harmonic −14 dB + 3rd −22 dB + breath noise (band around
    f0, Q≈8, −30 dB). Monophonic; pitch comes from f_curve (Hz per sample, glides already drawn),
    loudness from amp (per sample). No vibrato unless vib_cents (per-sample depth) is given —
    "a machine does not tremble". A ±1.2-cent 0.1 Hz drift keeps it from being sterile. Mono."""
    r = dsp.rng(seed)
    drift = 2 ** (1.2 / 1200 * smooth_noise(n, 0.15, seed + 1))
    f = np.asarray(f_curve, dtype=np.float64) * drift
    if vib_cents is not None:
        t = np.arange(n) / SR
        f = f * 2 ** (np.asarray(vib_cents) / 1200 * np.sin(2 * np.pi * 5.0 * t + r.uniform(0, 6.28)))
    ph = 2 * np.pi * np.cumsum(f / SR) + r.uniform(0, 6.28)
    y = np.sin(ph) + 10 ** (-14 / 20) * np.sin(2 * ph + 0.4) + 10 ** (-22 / 20) * np.sin(3 * ph + 1.1)
    # breath: narrow noise band centred on f0 (ring-modulated low-pass noise → bandwidth ≈ f0/8)
    nz = r.standard_normal(n)
    nz = sos_lp(nz, 40.0, order=2)
    nz /= (np.std(nz) + 1e-12)
    breath = nz * np.sin(ph * 1.0 + 0.7) * 10 ** (breath_db / 20) * 1.4
    air = sos_bp(r.standard_normal(n), 2500, 7000, order=1) * 10 ** ((breath_db - 14) / 20)
    out = (y + breath + air) * np.asarray(amp)
    return (out / 1.25).astype(np.float32)


# ------------------------------------------------------------------ strings
SEAT = {'bass': 0.35, 'cello': 0.28, 'viola': 0.08, 'vln2': -0.14, 'vln1': -0.3}


def seat_for(freq):
    if freq < 80:
        return 'bass'
    if freq < 160:
        return 'cello'
    if freq < 300:
        return 'viola'
    if freq < 520:
        return 'vln2'
    return 'vln1'


def string_section(n, f_curve, dyn, seed=0, players=7, detune=7.0, vib=False, vib_delay=1.0,
                   cut_lo=1200.0, cut_hi=2500.0, bow_db=-30.0, pan=None, spread=0.5, ensemble=True,
                   body=True):
    """Section strings (§6.4-2): `players` detuned band-limited saws (±detune cents), 2nd-order LP
    between cut_lo..cut_hi driven by dynamics, 0.07 Hz LFO ±200 Hz on the cutoff, 3 ensemble delays
    12–20 ms modulated at 0.3 Hz, bow noise around the harmonics (−30 dB). `dyn` = per-sample
    amplitude (already the envelope; brightness follows it). Optional human vibrato 4.5 Hz ±6 c
    fading in after vib_delay. Stereo."""
    r = dsp.rng(seed)
    t = np.arange(n) / SR
    f0 = np.asarray(f_curve, dtype=np.float64)
    if np.ndim(f0) == 0:
        f0 = np.full(n, float(f0))
    fm = float(np.median(f0))
    if pan is None:
        pan = SEAT[seat_for(fm)]
    L = np.zeros(n); R = np.zeros(n)
    if players > 1 and fm < 130:
        players += 2                                  # low sections: more, closer players → no pumping
    detune = detune * float(np.clip(fm / 200.0, 0.45, 1.0))
    for v in range(players):
        c = ((v / max(1, players - 1)) - 0.5) * 2 * detune + r.uniform(-1.5, 1.5)
        mult = 2 ** (c / 1200) * 2 ** (2.6 / 1200 * smooth_noise(n, 0.12, seed * 13 + v))
        if vib:
            onset = np.clip((t - vib_delay) / 1.2, 0, 1)
            rate = r.uniform(4.2, 4.9)
            mult = mult * 2 ** (r.uniform(4.5, 7.0) / 1200 * onset * np.sin(2 * np.pi * rate * t + r.uniform(0, 6.28)))
        s = blsaw(f0 * mult, r.uniform(0, 1))
        s *= 1 + 0.06 * smooth_noise(n, 0.6, seed * 17 + v)   # bow pressure
        p = np.clip(pan + ((v / max(1, players - 1)) - 0.5) * 2 * spread, -1, 1)
        a = (p + 1) * np.pi / 4
        L += s * np.cos(a); R += s * np.sin(a)
    x = np.stack([L, R], axis=1) / np.sqrt(players)
    if ensemble:
        ens = np.zeros_like(x)
        for k in range(3):
            d = (r.uniform(12, 20) + 2.5 * np.sin(2 * np.pi * 0.3 * t + r.uniform(0, 6.28))) * SR / 1000
            ch = k % 2
            ens[:, ch] += frac_delay(x[:, ch], d)
            ens[:, 1 - ch] += 0.4 * frac_delay(x[:, 1 - ch], d * 1.13)
        x = x + 0.35 * ens
    if body:
        x = 0.65 * x + 0.35 * (peq(x, 280, 1.2, 4.0))
        x = peq(x, 3200, 0.8, -3.0)
    # dynamics → brightness: crossfade between a dark and a bright LP; 0.07 Hz LFO ±200 Hz
    lfo = 200 * np.sin(2 * np.pi * 0.07 * t + r.uniform(0, 6.28))
    dark = sos_lp(x, cut_lo + fm * 1.5, 2)
    bright = sos_lp(x, cut_hi + fm * 2.0, 2)
    dn = np.clip(np.asarray(dyn, dtype=np.float64), 0, None)
    w = np.clip((dn / (dn.max() + 1e-12)) ** 0.7 + lfo / 1200, 0, 1)[:, None] if dn.max() > 0 else 0
    y = dark * (1 - w) + bright * w
    # bow noise: low-passed noise ring-modulated onto the first harmonics (noise *near* the partials)
    nz = sos_lp(r.standard_normal(n), 60, 2)
    nz /= (np.std(nz) + 1e-12)
    ph = 2 * np.pi * np.cumsum(f0 / SR)
    comb = sum(np.sin(k * ph + r.uniform(0, 6)) / k for k in range(1, 7) if k * fm < 6000)
    bow = nz * comb * 10 ** (bow_db / 20) * 1.5
    rosin = sos_bp(r.standard_normal(n), 3000, 9000, 1) * 10 ** ((bow_db - 10) / 20)
    y = y + pan2(bow + rosin, pan)
    return (y * dn[:, None]).astype(np.float32)


def solo_violin(n, f_curve, dyn, seed=0, vib=True):
    """Solo violin for S27's E5 (§6.4-1): ONE saw (single player), bow noise −24 dB, body, human
    vibrato. Stereo, narrow."""
    return string_section(n, f_curve, dyn, seed=seed, players=1, detune=0.0, vib=vib, vib_delay=0.4,
                          cut_lo=2200, cut_hi=4200, bow_db=-24.0, pan=-0.12, spread=0.0, ensemble=False)


# ------------------------------------------------------------------ Karplus–Strong pluck
def ks_pluck(freq, sec, decay=0.996, beta=0.18, bright=0.6, vel=1.0, seed=0):
    """Karplus–Strong (§6.4-5): loop filter 0.5·(x[n]+x[n−1]) with loss 0.996 per period, pluck-
    position comb β = 0.18, body resonances 220 Hz (Q 4, +6 dB) and 480 Hz (Q 5, +4 dB) — between
    a guqin and a harp. Vectorised per period; exact tuning by resampling the integer-delay loop.
    Mono, peak ≈ 1 × vel."""
    r = dsp.rng(seed)
    n = n_samples(sec)
    N = max(8, int(np.floor(SR / freq - 0.5)))
    f_eff = SR / (N + 0.5)
    ratio = freq / f_eff                      # > 1 → read faster
    m = int(n * ratio) + 2 * N + 4
    blocks = m // N + 2
    y = np.zeros(blocks * N + 1)
    exc = r.standard_normal(N)
    exc = lp1(exc, 1500 + 6000 * bright * vel)
    k = max(1, int(round(beta * N)))
    exc = exc - np.roll(exc, k)
    exc -= exc.mean()
    exc /= (np.abs(exc).max() + 1e-12)
    y[1:N + 1] = exc
    g = decay * 0.5
    for b in range(1, blocks):
        s = 1 + b * N
        y[s:s + N] = g * (y[s - N:s] + y[s - N - 1:s - 1])
    y = y[1:]
    z = np.interp(np.arange(n) * ratio, np.arange(len(y)), y)
    z = peq(z, 220, 4, 6.0)
    z = peq(z, 480, 5, 4.0)
    z = lp1(z, 7000)
    z[:24] *= raised(24)
    z = sos_hp(z, 40, 2)
    return (z / (np.abs(z).max() + 1e-12) * vel).astype(np.float32)


# ------------------------------------------------------------------ modal: glass bell, celesta
def glass_bell(freq, sec=6.0, vel=1.0, seed=0):
    """Glass bell (§6.4-3): partials ×1/2.756/5.404/8.933, decays 4/2/1/0.5 s, 2 ms noise strike.
    Each mode is a slightly detuned pair (slow beating) so it shimmers instead of buzzing. Mono."""
    r = dsp.rng(seed)
    t = t_axis(sec)
    out = np.zeros_like(t)
    for ratio, amp, tau in ((1.0, 1.0, 4.0), (2.756, 0.42, 2.0), (5.404, 0.2, 1.0), (8.933, 0.09, 0.5)):
        f = freq * ratio
        if f > SR * 0.45:
            continue
        for d in (-1, 1):
            fd = f * (1 + d * r.uniform(0.0002, 0.0006))
            out += 0.5 * amp * np.exp(-t / tau) * np.sin(2 * np.pi * fd * t + r.uniform(0, 6.28))
    ns = n_samples(0.002)
    strike = sos_bp(r.standard_normal(ns * 4), 2000, 12000, 1)[:ns * 4] * np.exp(-np.arange(ns * 4) / ns)
    out[:len(strike)] += 0.25 * strike
    out[:48] *= raised(48)
    return (out / (np.abs(out).max() + 1e-12) * vel).astype(np.float32)


def celesta(freq, sec=4.0, vel=1.0, seed=0):
    """Celesta (§6.4-7): partials [1, 4.0, 10.1], amps [1, 0.3, 0.08], decays [2.5, 0.8, 0.3] s,
    1 ms strike; soft felt hammer + resonator-box warmth. Mono."""
    r = dsp.rng(seed)
    t = t_axis(sec)
    out = np.zeros_like(t)
    for ratio, amp, tau in ((1.0, 1.0, 2.5), (4.0, 0.3, 0.8), (10.1, 0.08, 0.3)):
        f = freq * ratio
        if f > SR * 0.45:
            continue
        fd = f * (1 + r.uniform(-0.0003, 0.0003))
        out += amp * np.exp(-t / tau) * np.sin(2 * np.pi * fd * t + r.uniform(0, 6.28))
        out += 0.25 * amp * np.exp(-t / tau * 1.3) * np.sin(2 * np.pi * fd * 1.0007 * t)
    ns = n_samples(0.001)
    strike = sos_bp(r.standard_normal(ns * 5), 1500, 9000, 1) * np.exp(-np.arange(ns * 5) / ns)
    out[:len(strike)] += 0.3 * strike
    out = out + 0.15 * peq(out, freq * 0.5 + 200, 2, 3)  # box
    out[:24] *= raised(24)
    return (out / (np.abs(out).max() + 1e-12) * vel).astype(np.float32)


# ------------------------------------------------------------------ glass bowed ("many askers")
def glass_bowed(n, f_curve, dyn, seed=0, pan=0.0, trem_rate=3.0):
    """Bowed glass (§6.4-8): additive partials 1 / 2.01 / 3.0 (1 / 0.25 / 0.1), 3 Hz ±1.5 dB
    tremolo, ±5-cent random-walk pitch, friction noise riding on the fundamental. An instrument,
    not a voice. Stereo (gentle width)."""
    r = dsp.rng(seed)
    t = np.arange(n) / SR
    f = np.asarray(f_curve, dtype=np.float64) * 2 ** (5.0 / 1200 * np.clip(smooth_noise(n, 0.4, seed + 3), -1.5, 1.5) / 1.5)
    ph = 2 * np.pi * np.cumsum(f / SR) + r.uniform(0, 6.28)
    y = np.sin(ph) + 0.25 * np.sin(2.01 * ph + 1.0) + 0.1 * np.sin(3.0 * ph + 2.0)
    trem = 10 ** (1.5 / 20 * np.sin(2 * np.pi * trem_rate * r.uniform(0.9, 1.1) * t + r.uniform(0, 6.28)))
    nz = sos_lp(r.standard_normal(n), 30, 2)
    nz /= (np.std(nz) + 1e-12)
    fr = nz * np.sin(ph + 0.3) * 0.03
    y = (y + fr) * trem * np.asarray(dyn)
    st = pan2(y, pan)
    st[:, 1] = frac_delay(st[:, 1], np.full(n, r.uniform(4, 9) * SR / 1000))
    return (st / 1.35).astype(np.float32)


# ------------------------------------------------------------------ FM horn (used once)
def fm_horn(n, freq, dyn, seed=0):
    """FM horn (§6.4-6): two operators 1:1, modulation index 0 → 2.0 (400 ms) → 0.8, two voices
    ±4 cents, LP 2 kHz, attack in dyn. Horn colour, not brass brightness. Stereo."""
    r = dsp.rng(seed)
    t = np.arange(n) / SR
    idx = np.where(t < 0.4, 2.0 * t / 0.4, 0.8 + 1.2 * np.exp(-(t - 0.4) / 0.35))
    out = np.zeros((n, 2))
    for k, c in enumerate((-4.0, 4.0)):
        f = freq * 2 ** (c / 1200) * 2 ** (1.5 / 1200 * smooth_noise(n, 0.2, seed + k))
        ph = 2 * np.pi * np.cumsum(f / SR)
        y = np.sin(ph + idx * np.sin(ph + r.uniform(0, 6)))
        out += pan2(y, -0.25 + 0.5 * k)
    out = sos_hp(sos_lp(out, 2000, 2), 25, 2)        # 1:1 FM has a DC sideband — remove it
    out += sos_bp(r.standard_normal((n, 2)), 300, 1500, 1) * 0.004
    return (out * np.asarray(dyn)[:, None] * 0.5).astype(np.float32)


# ------------------------------------------------------------------ low end
def sub_tone(n, freq, dyn, h2_db=-10.0, seed=0):
    """Sustained bass D1/A1 (§6.4-10): sine + 2nd harmonic. Mono."""
    r = dsp.rng(seed)
    f = np.asarray(freq, dtype=np.float64) * 2 ** (0.8 / 1200 * smooth_noise(n, 0.1, seed))
    if np.ndim(f) == 0 or len(np.atleast_1d(f)) == 1:
        f = np.full(n, float(freq))
    ph = 2 * np.pi * np.cumsum(f / SR) + r.uniform(0, 6.28)
    y = np.sin(ph) + 10 ** (h2_db / 20) * np.sin(2 * ph + 0.5)
    return (y * np.asarray(dyn)).astype(np.float32)


def score_timpani(f0, f1, glide, sec, decay_db_per_s=8.0, h2_db=-10.0, drive=1.3, attack=0.010):
    """Score timpani (§6.4-10, §7.1-#17/#21): sine exponentially gliding f0 → f1 over `glide` s
    (log-frequency, eased), 10 ms attack, long decay, + 2nd harmonic −10 dB, light tanh. Not an
    explosion — a pitched note in the score. Mono, peak ≈ 1."""
    n = n_samples(sec)
    t = np.arange(n) / SR
    u = np.clip(t / glide, 0, 1)
    u = 1 - (1 - u) ** 2.2                       # fast at first, settling
    f = f0 * (f1 / f0) ** u
    ph = 2 * np.pi * np.cumsum(f / SR)
    y = np.sin(ph) + 10 ** (h2_db / 20) * np.sin(2 * ph)
    env = 10 ** (-decay_db_per_s * t / 20) * (1 - np.exp(-t / 0.6) * 0.0)
    env *= np.clip(t / attack, 0, 1) ** 1.5
    y = np.tanh(drive * y * env) / np.tanh(drive)
    y[-n_samples(0.5):] *= raised(n_samples(0.5))[::-1]
    return (y / (np.abs(y).max() + 1e-12)).astype(np.float32)


# ------------------------------------------------------------------ choir (only after 210.0)
FORMANTS_F = [(850, 80), (1220, 90), (2810, 120), (3500, 130)]
FORMANTS_M = [(700, 80), (1100, 90), (2600, 120), (3300, 130)]


def resonator_cascade(x, formants, shift=1.0):
    """Klatt-style cascade of 2-pole resonators (unit DC gain) — natural formant balance."""
    y = np.asarray(x, dtype=np.float64)
    for F, BW in formants:
        F = F * shift
        rr = np.exp(-np.pi * BW / SR)
        th = 2 * np.pi * F / SR
        a1 = -2 * rr * np.cos(th); a2 = rr * rr
        b0 = 1 + a1 + a2
        y = _sig.lfilter([b0], [1, a1, a2], y, axis=0)
    return y


def choir_voice_src(n, f_curve, seed, vib_delay=0.5):
    """One singer's glottal source: band-limited saw with extra −6 dB/oct tilt (≈ −12 dB/oct
    glottal pulse), ±8-cent 0.3 Hz jitter, 5–6 Hz ±15-cent vibrato with random phase."""
    r = dsp.rng(seed)
    t = np.arange(n) / SR
    f = np.asarray(f_curve, dtype=np.float64)
    jit = 2 ** (8.0 / 1200 * np.clip(smooth_noise(n, 0.3, seed + 1), -1.6, 1.6) / 1.6)
    onset = np.clip((t - vib_delay) / 1.0, 0, 1)
    vib = 2 ** (r.uniform(11, 16) / 1200 * onset * np.sin(2 * np.pi * r.uniform(5.0, 6.0) * t + r.uniform(0, 6.28)))
    ff = f * jit * vib
    s = blsaw(ff, r.uniform(0, 1))
    s = lp1(s, float(np.median(f)) * 1.2)
    s *= 1 + 0.05 * smooth_noise(n, 1.5, seed + 7)  # breath pressure shimmer
    return s / 0.12


def choir_section(n, voices, dyn, women=True, seed=0, pan=0.0, breath_db=-20.0):
    """A choir section singing "aah": `voices` = per-sample f curves (one per singer). Each singer's
    −12 dB/oct glottal source gets lip radiation (+6 dB/oct), then the section's formants as a
    PARALLEL band-pass bank (women F1–F4 = 850/1220/2810/3500, men 700/1100/2600/3300, bandwidths
    80/90/120/130 Hz, + a weak F5) over a −30 dB source floor — a cascade with no higher-pole
    correction would cut everything above F4 and sound muffled. Two sub-groups with ±4 % formant
    shift = different singers. Breath noise through the same formants, −20 dB. Stereo."""
    r = dsp.rng(seed)
    fm = FORMANTS_F if women else FORMANTS_M
    gains = (0.0, -4.0, -17.0, -21.0) if women else (0.0, -5.0, -15.0, -21.0)
    f5 = (4950, 200, -30.0) if women else (4500, 200, -31.0)
    out = np.zeros((n, 2))
    for g, shift in enumerate((0.96, 1.04)):
        src = np.zeros(n)
        for k, fc in enumerate(voices):
            if k % 2 == g:
                src += choir_voice_src(n, fc, seed * 31 + k * 7 + g)
        nz = r.standard_normal(n) * 10 ** (breath_db / 20) * 1.2
        x = src + nz
        x = _sig.lfilter([1.0, -0.95], [1.0], x)              # lip radiation
        y = 10 ** (-30 / 20) * x
        for (F, BW), gd in list(zip(fm, gains)) + [(f5[:2], f5[2])]:
            F = F * shift
            b_, a_ = _sig.iirpeak(F, F / BW, fs=SR)
            y = y + 10 ** (gd / 20) * _sig.lfilter(b_, a_, x)
        y += 10 ** (-38 / 20) * sos_hp(nz, 5000, 2) * 4.0      # air above the formants
        y = sos_hp(y, 120 if women else 80, 2)
        p = pan + (g - 0.5) * 0.5
        out += pan2(y, p)
    out = sos_lp(out, 12000, 2) * 10 ** ((CHOIR_CAL_F if women else CHOIR_CAL_M) / 20)   # ≈ −8 dB RMS
    return (out * np.asarray(dyn)[:, None] / max(1, len(voices)) ** 0.5).astype(np.float32)


CHOIR_CAL_F = 14.1
CHOIR_CAL_M = 22.1
