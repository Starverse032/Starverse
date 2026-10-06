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
