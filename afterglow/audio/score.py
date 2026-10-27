"""AFTERGLOW — score part (screenplay v2 §6, plus the musical items of §7.1: #15 reverse reverb,
#16 Shepard rise, #17 Big Bang 定音 + air, #21 supernova 定音 + string surge, #27 E5 carrier keyed
in Morse, #32 the reversed ♯C5). Everything synthesised; fixed seeds (global seed 55).

render(tl) -> {stem: full-length stereo float32 @ 48 kHz}. Stems:
  strings — druid fifths (just intonation in the cosmos), canon/stretto arco, Dm(add9), the one
            D-major chord (+ warm organ bed), Dsus2 → Asus2, the S06 solo violin, S07's ppp fifth
  pedal   — the D2 string pedal of long take A: f888 → f2924 without a break (v2)
  asker   — the Asker (AI's voice), the E5 radio carrier + Morse, the reversed ♯C5
  plucks  — Karplus–Strong: the first human Q (f1848), canon, stretto, pizzicato
  bells   — A6 "light on the road" (sine f1392, glass bells f2136 / f3456 / f5496), 𒀭 D6, celesta Q
  glass   — bowed glass: canon/stretto glass, "many askers", the A4 that is left, the E5 unison,
            the Asus2 overtones
  brass   — the one FM horn D3 (mp, f1152–f1332)
  choir   — 16 singers "aah" — only from f5088 (03:32.00), entries staggered 0–9 frames
  low     — score timpani (Big Bang f608 73.4 → 18.4 Hz, supernova f1352 55 → 27.5 Hz), D1 / A1 subs
  fx      — #15 reverse reverb, #16 Shepard rise, #17 Big Bang air

v2 time base (docs/v2/screenplay-v2.md §6, timeline-v2.md; producer decisions 7-2 / 7-23 locked):
  0–25 s unchanged · 25–78 s long take A is ONE line (D2 pedal from f888, f1332 drop without a
  digital zero, supernova f1352, A6 f1392, KS Q f1848/1872/1896) · S03 bed f1920, guest-star A6
  f2136 · S04 canon: a voice per light-carrier (f2280/2352/2424/2496/2568) + second round from f2664
  · S05 stretto on the cuts f2784…f2916, tutti E f2924 (loudest), f2928 cut to the lone E5 · Morse
  125.0–132.74 · S07 (pulsar deleted): A6 f3456, D2–A2 ppp f3528–f3696, digital zero [3702, 3864) ·
  S08 same windows (𒀭 D6 now f3912) · S09 the question +2 s: D4 f5040, A4 f5064, E5 + choir f5088,
  Dsus2 f5112; enter f5160 unchanged · S10 bass D → A f5184, warmest f5352 · S11 decay from f5472.

Sync: every frame-aligned event sits on sample frame × 2000 (`fs`); the Morse is placed on exact
sample times (`xs`), ending at 132.740 s. Hard cuts (24.0, f1332 upper voices, 122.0, 202.0, 204.0)
end with a 2 ms raised-cosine so the cut is sample-tight without a click; digital silences are exact
zeros. Levels follow the screenplay (dBFS, pre-normalisation mix): sustained parts as RMS, hits as peak.
Every pitched note is logged (NOTES → build/audio/score_notes.json) for the harmony checks.
"""
from __future__ import annotations

import numpy as np
from scipy import signal

import dsp
import instruments as I
from dsp import SR, n_samples

SEED = 55
STEMS = ('strings', 'pedal', 'asker', 'plucks', 'bells', 'glass', 'brass', 'choir', 'low', 'fx')
CUT = 96          # 2 ms raised-cosine at hard cuts
SQ2 = np.sqrt(2.0)

# calibration: instrument output (dyn = 1) → 0 dBFS RMS per channel
K_STR = 10 ** (8.0 / 20)
K_GLS = 10 ** (8.3 / 20)
K_HRN = 10 ** (9.4 / 20)
K_CH = 10 ** (8.0 / 20)
K_SUB = 10 ** (2.6 / 20)


def db(x):
    return 10 ** (np.asarray(x, dtype=np.float64) / 20.0)


def fs(t):
    """Frame-exact sample index of a frame-aligned timeline time."""
    return int(round(t * 24)) * 2000


def xs(t):
    """Exact sample index of a non-frame time (Morse elements, slides)."""
    return int(round(t * SR))


N = dsp.note
D2J = N('D2')                    # just-intonation chain for the cosmos (§6.1): D–A–E–B in 3:2
J = {'D1': D2J / 2, 'D2': D2J, 'A2': D2J * 1.5, 'D3': D2J * 2, 'E3': D2J * 2.25, 'A3': D2J * 3,
     'B3': D2J * 3.375, 'D4': D2J * 4, 'E4': D2J * 4.5, 'A4': D2J * 6, 'B4': D2J * 6.75, 'E5': D2J * 9,
     'D5': D2J * 8, 'A5': D2J * 12}


# ===================================================================== reverbs (§6.4-11)
_IR = {}


def ir(name):
    if name not in _IR:
        if name == 'hall':        # R_hall: RT60 4.5 s, predelay 30 ms, HF damping
            h = dsp.make_ir(sec=6.0, decay=4.5, predelay=0.03, damp_hz=7000, damp_end_hz=2200, seed=101, early=10)
        elif name == 'hall3':     # R_hall, third act: RT60 6 s
            h = dsp.make_ir(sec=8.0, decay=6.0, predelay=0.03, damp_hz=6500, damp_end_hz=2000, seed=102, early=10)
        elif name == 'void':      # R_void: RT60 7 s, LP 5 kHz, predelay 40 ms, few early reflections
            h = dsp.make_ir(sec=9.0, decay=7.0, predelay=0.04, damp_hz=5000, damp_end_hz=1400, seed=103, early=3, size=2.5)
            h = dsp.lowpass(h, 5000, 2)
        elif name == 'room':      # R_room: 0.4 s, near & warm
            h = dsp.make_ir(sec=0.7, decay=0.4, predelay=0.004, damp_hz=6000, damp_end_hz=2500, seed=104, early=6, size=0.3, width=0.5)
        else:
            raise KeyError(name)
        k = len(h) // 8
        h[-k:] *= I.raised(k)[::-1, None]
        # unity average power gain over 150 Hz–3 kHz (log-spaced bands) — a long noise IR keeps most
        # of its energy in the slow low band, so energy normalisation alone makes tails ~5 dB hot
        H = np.abs(np.fft.rfft(h.astype(np.float64), axis=0)) ** 2
        fr = np.fft.rfftfreq(len(h), 1 / SR)
        edges = np.geomspace(150, 3000, 25)
        bands = [H[(fr >= lo) & (fr < hi)].mean() for lo, hi in zip(edges[:-1], edges[1:])]
        h = h / np.sqrt(np.mean(bands))
        _IR[name] = h.astype(np.float32)
    return _IR[name]


def conv(x, h):
    """Stereo convolution (L*hL, R*hR) of the active region of x; output length = len(x)."""
    act = np.flatnonzero(np.any(np.abs(x) > 1e-9, axis=1))
    out = np.zeros_like(x)
    if not len(act):
        return out
    a, b = act[0], act[-1] + 1
    for ch in range(2):
        y = signal.oaconvolve(x[a:b, ch], h[:, ch])
        e = min(len(x), a + len(y))
        out[a:e, ch] = y[:e - a]
    return out


# ===================================================================== helpers
def dbenv(points, i0, n):
    """dB automation over absolute timeline seconds, cosine-interpolated, sampled for a clip that
    starts at absolute sample i0 and lasts n samples. Values ≤ −99 dB → 0."""
    ts = np.array([p[0] for p in points], dtype=np.float64)
    vs = np.array([p[1] for p in points], dtype=np.float64)
    lin = np.array([len(p) > 2 and p[2] == 'lin' for p in points])   # segment from this point is linear in dB
    t = (i0 + np.arange(n)) / SR
    if len(ts) == 1:
        v = np.full(n, vs[0])
    else:
        k = np.clip(np.searchsorted(ts, t, side='right') - 1, 0, len(ts) - 2)
        u = np.clip((t - ts[k]) / np.maximum(ts[k + 1] - ts[k], 1e-9), 0, 1)
        u = np.where(lin[k], u, 0.5 - 0.5 * np.cos(np.pi * u))
        v = vs[k] + (vs[k + 1] - vs[k]) * u
    g = 10 ** (v / 20)
    g[v <= -99] = 0.0
    return g


def lin_env(points, i0, n):
    ts = np.array([p[0] for p in points]); vs = np.array([p[1] for p in points], dtype=np.float64)
    t = (i0 + np.arange(n)) / SR
    k = np.clip(np.searchsorted(ts, t, side='right') - 1, 0, len(ts) - 2)
    u = np.clip((t - ts[k]) / np.maximum(ts[k + 1] - ts[k], 1e-9), 0, 1)
    u = 0.5 - 0.5 * np.cos(np.pi * u)
    return vs[k] + (vs[k + 1] - vs[k]) * u


def note_env(n, attack, hold_n, release, shape=1.0):
    """Raised-cosine attack, sustain, cosine release starting at hold_n samples (clip length n)."""
    e = np.ones(n)
    na = min(n, n_samples(attack))
    if na:
        e[:na] = I.raised(na) ** shape
    nr = n - hold_n
    if nr > 0:
        e[hold_n:] *= I.raised(nr)[::-1]
    return e


def pitch_curve(events, i0, n, default_glide=0.06):
    """events: [(abs_sample, freq, glide_sec)] → per-sample Hz with log-frequency raised-cosine glides
    that START on the event sample (light before sound: nothing anticipates the beat)."""
    f = np.full(n, float(events[0][1]))
    prev = float(events[0][1])
    for (ia, fr, g) in events[1:]:
        i = ia - i0
        if i >= n:
            break
        g = default_glide if g is None else g
        ng = max(1, n_samples(g))
        e = min(n, i + ng)
        f[i:e] = prev * (fr / prev) ** I.raised(ng)[:e - i]
        f[e:] = fr
        prev = float(fr)
    return f


def rearticulate(n, i0, onsets, depth=0.45, rec=0.12):
    """Soft re-attack of a legato voice on each onset (dip on the beat, recover over `rec`)."""
    g = np.ones(n)
    m = n_samples(rec * 2.5)
    tt = np.arange(m) / SR
    dip = 1 - depth * (1 - np.exp(-tt / 0.004)) * np.exp(-tt / (rec / 2.5))
    for ia in onsets:
        i = ia - i0
        if 0 <= i < n:
            e = min(n, i + m)
            g[i:e] *= dip[:e - i]
    return g


NOTES = []      # (stem, i_on, i_off, [Hz, ...]) — every pitched note, for the harmony / third checks


def log_note(stem, i_on, i_off, freqs):
    NOTES.append((stem, int(i_on), int(i_off), [round(float(f), 3) for f in freqs]))


def mono2st(x, pan=0.0):
    return (I.pan2(np.asarray(x, dtype=np.float64), pan) * SQ2).astype(np.float32)


class Scene:
    """A stretch of the score rendered with its own reverb sends, so cuts can silence the dry signal
    AND its tails together."""

    def __init__(self, name, t0, t1, tail=10.0):
        self.name = name
        self.i0 = fs(t0)
        self.n = fs(t1) - self.i0 + n_samples(tail)
        self.dry, self.send, self.post = {}, {}, []

    def _b(self, d, k):
        if k not in d:
            d[k] = np.zeros((self.n, 2), np.float32)
        return d[k]

    def add(self, stem, clip, i_abs, gain=1.0, pan=0.0, rev=None, dry=1.0):
        c = np.asarray(clip, dtype=np.float32)
        if c.ndim == 1:
            c = mono2st(c, pan)
        c = c * np.float32(gain)
        i = i_abs - self.i0
        if i < 0:
            c, i = c[-i:], 0
        e = min(self.n, i + len(c))
        if e <= i:
            return
        if dry:
            self._b(self.dry, stem)[i:e] += c[:e - i] * np.float32(dry)
        for name, amt in (rev or {}).items():
            if amt > 0:
                self._b(self.send, (stem, name))[i:e] += c[:e - i] * np.float32(amt)

    def cut(self, t_abs, stems=None, fade=CUT, exact=False, until=None):
        """Silence everything (dry + reverb) from t (a 2 ms fade ends exactly on t) [until t2]."""
        self.post.append(('cut', stems, xs(t_abs) if exact else fs(t_abs), fade, until))

    def soft(self, stems, ceil_db):
        """Soft-clip (tanh knee) dry + wet at ceil_db dBFS: shaves the crest of a dense tutti so it
        can be louder under the master limiter without being squashed by it."""
        self.post.append(('soft', stems, ceil_db))

    def window(self, stems, points, linear=False):
        """Gain automation applied to dry + wet (absolute seconds): dB points (cosine in dB), or
        linear-amplitude points (cosine in amplitude — a natural fade-out to true zero)."""
        self.post.append(('lin' if linear else 'win', stems, points))

    def low_drain(self, stems, points, fc=160.0):
        """Time-varying low shelf on dry + wet: the band below fc (zero-phase crossover, so the two
        bands sum back to the input exactly) follows the dB points; the band above is untouched."""
        self.post.append(('drain', stems, points, fc))

    def render(self):
        out = {}
        for stem in set(list(self.dry) + [k[0] for k in self.send]):
            y = self.dry.get(stem)
            y = np.zeros((self.n, 2), np.float32) if y is None else y.copy()
            for (s, name), b in self.send.items():
                if s == stem:
                    y += conv(b, ir(name))
            for op in self.post:
                if op[1] is not None and stem not in op[1]:
                    continue
                if op[0] == 'cut':
                    _, _, ia, fade, until = op
                    i = ia - self.i0
                    j = self.n if until is None else min(self.n, fs(until) - self.i0)
                    if 0 <= i < self.n:
                        a = max(0, i - fade)
                        y[a:i] *= I.raised(i - a)[::-1, None].astype(np.float32)
                        y[i:j] = 0.0
                elif op[0] == 'soft':
                    c = np.float32(10 ** (op[2] / 20))
                    y = (c * np.tanh(y / c)).astype(np.float32)
                elif op[0] == 'drain':
                    sos = signal.butter(4, op[3], 'low', fs=SR, output='sos')
                    lo = signal.sosfiltfilt(sos, y, axis=0).astype(np.float32)
                    g = dbenv(op[2], self.i0, self.n)[:, None].astype(np.float32)
                    y = (y - lo) + lo * g
                elif op[0] == 'win':
                    y *= dbenv(op[2], self.i0, self.n)[:, None].astype(np.float32)
                else:
                    y *= lin_env(op[2], self.i0, self.n)[:, None].astype(np.float32)
            out[stem] = y
        return self.i0, out


# ===================================================================== instruments in context
def strings_note(sc, f, t_on, t_off, level, attack=2.5, release=6.0, seed=0, vib=False, pts=None,
                 rev=None, stem='strings', pitch=None, on_exact=False, players=7, pan=None, cut_lo=1200,
                 cut_hi=2500, shape=1.0, artic=None):
    """One section-string note (or legato line when `pitch` events are given). level = dBFS RMS at
    dyn 0 dB; pts = extra dB automation (absolute seconds) on top of the attack/release envelope."""
    i_on = xs(t_on) if on_exact else fs(t_on)
    hold = fs(t_off) - i_on
    n = hold + n_samples(release)
    dyn = note_env(n, attack, hold, release, shape)
    if pts:
        dyn = dyn * dbenv(pts, i_on, n)
    if artic:
        dyn = dyn * rearticulate(n, i_on, artic, depth=0.3, rec=0.18)
    fc = pitch_curve(pitch, i_on, n, 0.08) if pitch else np.full(n, float(f))
    clip = I.string_section(n, fc, dyn, seed=seed, vib=vib, players=players, pan=pan, cut_lo=cut_lo, cut_hi=cut_hi)
    sc.add(stem, clip, i_on, gain=db(level) * K_STR, rev=rev if rev is not None else {'hall': 0.3})
    log_note(stem, i_on, i_on + hold, [f] + [e[1] for e in (pitch or [])])


def glass_note(sc, f, t_on, t_off, level, attack=0.6, release=2.5, seed=0, pts=None, pitch=None,
               rev=None, pan=0.0, stem='glass'):
    i_on = fs(t_on)
    hold = fs(t_off) - i_on
    n = hold + n_samples(release)
    dyn = note_env(n, attack, hold, release)
    if pts:
        dyn = dyn * dbenv(pts, i_on, n)
    fc = pitch_curve(pitch, i_on, n, 0.09) if pitch else np.full(n, float(f))
    clip = I.glass_bowed(n, fc, dyn, seed=seed, pan=pan)
    sc.add(stem, clip, i_on, gain=db(level) * K_GLS, rev=rev if rev is not None else {'hall': 0.4})
    log_note(stem, i_on, i_on + hold, [f] + [e[1] for e in (pitch or [])])


def pluck(sc, f, t, level, sec=None, seed=0, pan=0.0, rev=None, decay=0.996, bright=0.6, stem='plucks'):
    sec = sec or float(np.clip(1100.0 / f, 1.6, 6.0))
    clip = I.ks_pluck(f, sec, decay=decay, bright=bright, seed=seed)
    sc.add(stem, clip, fs(t), gain=db(level), pan=pan, rev=rev if rev is not None else {'room': 0.25, 'hall': 0.22})
    log_note(stem, fs(t), fs(t) + min(len(clip), n_samples(1.5)), [f])


def bell(sc, f, t, level, sec=6.0, seed=0, pan=0.0, rev=None, stem='bells', kind='glass'):
    clip = I.glass_bell(f, sec, seed=seed) if kind == 'glass' else I.celesta(f, sec, seed=seed)
    sc.add(stem, clip, fs(t), gain=db(level), pan=pan, rev=rev if rev is not None else {'hall': 0.35})
    log_note(stem, fs(t), fs(t) + min(len(clip), n_samples(1.5)), [f])


def asker_line(sc, i_on, n, events, amp_pts, level, seed=0, vib=None, harm=None, glide=0.06, rev=None,
               artic=True, stem='asker', attack=0.12, release_at=None, release=1.5, pan=0.0):
    """The Asker as one continuous monophonic line. events [(abs_sample, Hz, glide_s|None)]."""
    f = pitch_curve(events, i_on, n, glide)
    amp = dbenv(amp_pts, i_on, n) if amp_pts else np.ones(n)
    amp = amp * note_env(n, attack, n if release_at is None else release_at - i_on, release)
    if artic:
        amp = amp * rearticulate(n, i_on, [e[0] for e in events[1:]])
    y = I.asker(n, f, amp, vib_cents=vib, seed=seed) if harm is None else asker_h(n, f, amp, harm, vib, seed)
    sc.add(stem, y, i_on, gain=db(level), pan=pan, rev=rev if rev is not None else {'hall': 0.35})
    i_end = i_on + (n if release_at is None else release_at - i_on)
    for k, e in enumerate(events):          # one log entry per sung pitch, from its onset to the next
        log_note(stem, e[0], events[k + 1][0] if k + 1 < len(events) else i_end, [e[1]])
    return y


def asker_h(n, f, amp, harm, vib, seed):
    """Asker whose harmonics/breath fade by `harm` (1 → 0) → the bare E5 carrier (sine + a faint
    2nd harmonic), sharing one phase so the cross-over cannot cancel."""
    r = dsp.rng(seed)
    drift = 2 ** (1.2 / 1200 * I.smooth_noise(n, 0.15, seed + 1))
    ff = f * drift
    if vib is not None:
        t = np.arange(n) / SR
        ff = ff * 2 ** (vib / 1200 * np.sin(2 * np.pi * 5.0 * t))
    ph = 2 * np.pi * np.cumsum(ff / SR) + r.uniform(0, 6.28)
    h2 = 10 ** (-14 / 20) * harm + 10 ** (-34 / 20) * (1 - harm)
    y = np.sin(ph) + h2 * np.sin(2 * ph + 0.4) + 10 ** (-22 / 20) * harm * np.sin(3 * ph + 1.1)
    nz = I.sos_lp(r.standard_normal(n), 40.0, 2)
    nz /= (np.std(nz) + 1e-12)
    y = y + nz * np.sin(ph + 0.7) * 10 ** (-30 / 20) * 1.4 * harm
    return (y * amp / 1.25).astype(np.float32)


def radio(x, hp=800.0, lp=3000.0, drive=2.0):
    """Radio voicing of the carrier (§7.1 #27): BP 800–3000 Hz, soft tanh saturation (relative to the
    clip's peak, so it does not depend on level), band-limit again; RMS-matched to the input so the
    written level (−24 → −40 dB) is kept while the fundamental thins out under the high-pass."""
    x = np.asarray(x, dtype=np.float64)
    y = I.sos_hp(x, hp * 0.75, 2)
    pk = np.abs(y).max() + 1e-12
    y = np.tanh(drive * y / pk) * pk / np.tanh(drive)
    y = I.sos_lp(I.sos_hp(y, hp, 1), lp, 2)
    return y * (np.sqrt(np.mean(x ** 2)) / (np.sqrt(np.mean(y ** 2)) + 1e-12))


def sub(sc, f, t_on, t_off, level, attack=1.0, release=2.0, pts=None, h2=-10.0, seed=0, stem='low', rev=None,
        pitch=None, shape=1.0):
    i_on = fs(t_on)
    hold = fs(t_off) - i_on
    n = hold + n_samples(release)
    dyn = note_env(n, attack, hold, release, shape)
    if pts:
        dyn = dyn * dbenv(pts, i_on, n)
    fc = pitch_curve(pitch, i_on, n, 0.3) if pitch else np.full(n, float(f))
    y = I.sub_tone(n, fc, dyn, h2_db=h2, seed=seed)
    sc.add(stem, y, i_on, gain=db(level) * K_SUB, rev=rev or {})
    log_note(stem, i_on, i_on + hold, [f] + [e[1] for e in (pitch or [])])


# ===================================================================== the Big Bang note (#17)
_BB = {}


def bigbang_parts():
    """Score timpani D2 → D0 (73.4 → 18.4 Hz, 2.5 s, 10 ms attack, ~7 s decay, + 2nd harmonic
    −10 dB, light tanh) and its "air" (white HP 5 kHz, 1.2 s, wide stereo)."""
    if not _BB:
        timp = I.score_timpani(73.4, 18.4, 2.5, 10.0, decay_db_per_s=7.5, h2_db=-10.0, drive=1.25)
        r = dsp.rng(SEED + 17)
        na = n_samples(1.6)
        tt = np.arange(na) / SR
        air = I.sos_hp(r.standard_normal((na, 2)), 5000, 4)
        env = np.exp(-tt / 0.25) * np.clip(tt / 0.004, 0, 1)
        air = air * env[:, None]
        air[-n_samples(0.3):] *= I.raised(n_samples(0.3))[::-1, None]
        air /= np.abs(air).max()
        _BB['timp'] = timp
        _BB['air'] = air.astype(np.float32)
    return _BB['timp'], _BB['air']


# verify (S26 vs S07): the locked rule says the f2708 E landing is the loudest moment ("the human question is
# louder than the Big Bang"), but at −7.2 the Big Bang tied it on 100 ms and beat it on momentary loudness
# in both masters. The landing cannot get much louder in the web master (it already meets the −1 dBTP
# ceiling, and its 400 ms window includes the breath before it), so the cold note gives way:
# −7.2 → −10.7 (S07 peak ≈ −9.5 dBFS instead of −6). The landing is now ≥ 2 LU louder than the Big Bang
# on 100 ms and momentary loudness in both masters. The air keeps its level: its tail is the CMB hiss.
TIMP_BB_DB = -10.7    # dry peak
TIMP_REV_DB = -7.2    # the #15 reverse-reverb source keeps its v1.2 timp/air balance (it is normalised anyway)
AIR_BB_DB = -24.0


# ===================================================================== scenes
def scene_prologue():
    """M1 (15–21) the Asker's first Q over a D2–A2 fifth; M2 (21–24) reverse reverb + Shepard rise →
    hard cut to digital zero at 24.000."""
    sc = Scene('prologue', 15.0, 24.0, tail=0.5)
    # --- the Asker: D4 15 / A4 16 / E5 17 (held ~2 s, then dissolves into R_hall); ppp −34 dBFS
    i_on = fs(15.0)
    n = fs(21.0) - i_on
    ev = [(fs(15.0), N('D4'), 0), (fs(16.0), N('A4'), 0.06), (fs(17.0), N('E5'), 0.06)]
    asker_line(sc, i_on, n, ev, [(15.0, 0), (18.6, 0), (19.0, -1)], -38.5, seed=SEED + 1,
               release_at=fs(19.0), release=1.6, rev={'hall': 0.5})
    # --- strings D2–A2 pure fifth fading in 15 → 17 (f408), −36 dBFS, a breath of growth into 24
    pts = [(15.0, 0), (21.0, 0), (23.96, 6.0)]
    strings_note(sc, J['D2'], 15.0, 24.0, -45.5, attack=2.0, release=0.5, seed=SEED + 2, pts=pts, pan=0.1,
                 rev={'hall': 0.25})
    strings_note(sc, J['A2'], 15.0, 24.0, -46.0, attack=2.0, release=0.5, seed=SEED + 3, pts=pts, pan=-0.1,
                 rev={'hall': 0.25})
    # --- #15 reverse reverb: the 25.333 note's R_void tail, reversed, 3 s, peaking on 24.000
    timp, air = bigbang_parts()
    src = np.zeros((n_samples(3.2), 2), np.float32)
    src[:len(timp[:len(src)])] += mono2st(timp[:len(src)]) * db(TIMP_REV_DB)
    src[:len(air)] += air * db(AIR_BB_DB) * 4.0
    wet = conv(np.pad(src, ((0, n_samples(1.0)), (0, 0))), ir('void'))
    a0 = int(np.flatnonzero(np.abs(wet).max(axis=1) > 1e-3 * np.abs(wet).max())[0])
    wet = wet[a0:a0 + n_samples(3.0)]
    rev = wet[::-1].copy()
    rev /= np.abs(rev).max()
    k = len(rev)
    rev *= (np.linspace(0, 1, k) ** 1.6)[:, None]     # the tail fades in from nothing at 21.0
    sc.add('fx', rev, fs(24.0) - k, gain=db(-16.5))
    # --- #16 Shepard rise 22.5 → 24.0: 8 octave-spaced sines under a Gaussian spectral envelope + noise sweep
    sh = shepard(1.5, seed=SEED + 16)
    sc.add('fx', sh, fs(24.0) - len(sh), gain=db(-13.5))
    sc.cut(24.0)
    return sc


def shepard(sec, seed=0, rise_oct=1.25):
    n = n_samples(sec)
    t = np.arange(n) / SR
    u = t / sec
    base = N('D1')
    out = np.zeros(n)
    r = dsp.rng(seed)
    pos = rise_oct * (u ** 1.15)
    for k in range(8):
        lf = k + pos                         # octaves above D1
        f = base * 2 ** lf
        amp = np.exp(-0.5 * ((lf - 4.6) / 1.35) ** 2)
        ph = 2 * np.pi * np.cumsum(f / SR) + r.uniform(0, 6.28)
        out += amp * np.sin(ph)
    out /= 2.2
    # noise sweep BP 200 Hz → 8 kHz (block-wise band-pass, ~1/3 octave wide)
    nz = r.standard_normal((n, 2))
    fc = 200 * (8000 / 200) ** (u ** 1.3)
    sw = np.zeros_like(nz)
    blk = 256
    zi = None
    for s in range(0, n, blk):
        c = fc[s]
        sos = signal.butter(1, [c / 1.25, min(c * 1.25, SR * 0.45)], 'band', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2, 2))
        sw[s:s + blk], zi = signal.sosfilt(sos, nz[s:s + blk], axis=0, zi=zi)
    sw /= np.abs(sw).max()
    cres = (0.02 + 0.98 * u ** 2.4)
    y = mono2st(out) * 0.85 + sw * 0.35
    y *= cres[:, None]
    y[:n_samples(0.05)] *= I.raised(n_samples(0.05))[:, None]
    return (y / np.abs(y).max()).astype(np.float32)


def F(f):
    """Frame → timeline seconds (24 fps). Scene times below are written as frames where the screenplay
    gives frames, so every cue lands on sample frame × 2000."""
    return f / 24.0


def scene_bigbang():
    """M3 (v2 S02-a/b, long take A): the Big Bang note at f608 (8 frames after the f600 flash) + air;
    no pitched music. The R_void tail now runs out naturally (v1 truncated it at 40.0 s)."""
    sc = Scene('bigbang', F(608), 37.0, tail=8.0)
    timp, air = bigbang_parts()
    sc.add('low', timp, fs(F(608)), gain=db(TIMP_BB_DB), rev={'void': 0.18})
    sc.add('fx', air, fs(F(608)), gain=db(AIR_BB_DB), rev={'void': 0.6})
    sc.window(None, [(42.0, 1.0), (45.0, 0.0)], linear=True)
    return sc


# ---------------------------------------------------------------- long take A: ONE continuous line
# v2 (screenplay §6.1, §6.5; brief §10): the D2 string pedal enters with the first star (f888) and
# never stops until the f2924 landing — through the druid chord, the f1332 drop (骤降, NOT a digital
# zero: v1's 52.5–53.333 s zero is gone), the supernova, the Earth, the atmosphere, the fire, the
# lamps and the stretto. It lives in its own stem ('pedal') so a cut of the upper voices can never
# take it with them, and so the drop is measurable.
PEDAL_PTS = [   # dB relative to PEDAL_DB: ppp → mf with the druid → drop → ppp → stretto.
    # The D2 section (9 players + ensemble, low register) measures ≈ 6.5 dB above the nominal K_STR
    # calibration, so the ppp points sit at −8.5 (measured ≈ −42 dBFS RMS after the f1332 drop).
    (F(888), 0.0), (F(1152), 0.0), (F(1248), 10.0), (F(1331), 10.5),
    (F(1332), -8.5),                                    # f1332 骤降: ≈ −42 dBFS measured, the line goes on
    (F(1352), -8.5), (F(1392), 0.0), (62.0, -5.0), (66.0, -8.5),     # breathes with the surge
    (F(1872), -8.5), (F(2280), -5.0), (F(2568), -2.0), (F(2664), -1.0), (F(2784), 2.0), (121.5, 7.0)]
PEDAL_DB = -40.0


def scene_pedal():
    sc = Scene('pedal', F(888), 122.0, tail=0.3)
    strings_note(sc, J['D2'], F(888), F(2924), PEDAL_DB, attack=3.0, release=0.12, seed=SEED + 40,
                 pts=PEDAL_PTS, rev={'void': 0.035, 'hall': 0.025}, stem='pedal', cut_hi=2200)
    # nearly dry: a hot R_void send kept the mf D2 ringing ≈ −38 dB after the f1332 drop (spec −42)
    sc.cut(122.0)
    return sc


def scene_druid():
    """M4 first half (S02-b/c/d): f888 A2 (with the D2 pedal: the cosmos' first pitch, ppp, 3 s),
    f1152 E3–B3–A4–E5 together + the one FM horn D3 (mp), 4 s to mf at f1248, held through the star's
    tightening; f1332 the score is cut — every voice but the D2 pedal (骤降, no digital zero)."""
    sc = Scene('druid', F(888), F(1332), tail=0.5)
    rv = {'void': 0.45, 'hall': 0.1}
    base = [(F(888), 0), (F(1152), 0), (F(1248), 10.0), (F(1296), 10.0), (F(1331), 11.0)]
    strings_note(sc, J['A2'], F(888), F(1332), -41.0, attack=3.0, release=1, seed=SEED + 41, pts=base, rev=rv)
    up = [(F(1152), -12), (F(1248), 0), (F(1296), 0), (F(1331), 1.5)]   # a breath of strain as the star tightens
    for k, (nm, lv) in enumerate((('E3', -32.0), ('B3', -33.0), ('A4', -34.0), ('E5', -35.0))):
        strings_note(sc, J[nm], F(1152), F(1332), lv, attack=3.6, release=1, seed=SEED + 42 + k, pts=up, rev=rv,
                     shape=1.4)
    # FM horn D3, mp, buried in the chord (the film's only brass colour)
    i_on = fs(F(1152))
    n = fs(F(1332)) - i_on + n_samples(1)
    dyn = note_env(n, 0.8, fs(F(1332)) - i_on, 1.0) * dbenv([(F(1152), -6), (F(1248), 0)], i_on, n)
    sc.add('brass', I.fm_horn(n, J['D3'], dyn, seed=SEED + 48), i_on, gain=db(-35.0) * K_HRN,
           rev={'void': 0.5, 'hall': 0.2})
    log_note('brass', i_on, fs(F(1332)), [J['D3']])
    sc.cut(F(1332))
    return sc


def scene_supernova():
    """S02-d/e: f1352 (8 frames after the f1344 flash) A1 → A0 score timpani −9 dBFS + string surge
    (D–A–E–B stacked over a D1, p → f at f1392, then decays) → f1392 A6 sine ("light on the road" ①)
    out by f1524; the strings settle back into the D2 pedal."""
    t_sn = F(1352)
    sc = Scene('supernova', t_sn, 66.0, tail=6.0)
    timp = I.score_timpani(55.0, 27.5, 3.0, 10.0, decay_db_per_s=6.5, h2_db=-10.0, drive=1.25)
    sc.add('low', timp, fs(t_sn), gain=db(-9.0), rev={'void': 0.15})
    log_note('low', fs(t_sn), fs(t_sn + 3.0), [55.0, 27.5])
    sub(sc, J['D1'], t_sn, 60.0, -24.0, attack=0.3, release=5.0, pts=[(t_sn, -8), (F(1392), 0), (60.0, -6)],
        seed=SEED + 50)
    rv = {'void': 0.5, 'hall': 0.12}
    surge = [(t_sn, -12), (F(1392), 0), (60.0, -6), (64.0, -18)]
    for k, (nm, lv) in enumerate((('A2', -33.0), ('E3', -33.5), ('B3', -34.0), ('A4', -35.0), ('E5', -36.5),
                                  ('B4', -37.0))):
        strings_note(sc, J[nm], t_sn, 62.0, lv, attack=0.35, release=6.0, seed=SEED + 52 + k, pts=surge, rev=rv,
                     cut_hi=3200)
    # f1392 A6 "light on the road" ①: a single sine with slight vibrato, −28 dB, out by f1524 (63.5)
    i_on = fs(F(1392))
    n = fs(F(1524)) - i_on
    t = np.arange(n) / SR
    vib = 2 ** (4.0 / 1200 * np.sin(2 * np.pi * 4.6 * t) * np.clip(t / 1.5, 0, 1))
    a6 = np.sin(2 * np.pi * np.cumsum(1760.0 * vib / SR)) * note_env(n, 1.2, n - n_samples(2.5), 2.5)
    sc.add('bells', a6, i_on, gain=db(-28.0), rev={'void': 0.5})
    log_note('bells', i_on, i_on + n, [1760.0])
    sc.window(None, [(70.0, 1.0), (72.0, 0.0)], linear=True)
    return sc


# ---------------------------------------------------------------- fire → lamps → stretto (M5, M6)
def _q_frames(f0, f1):
    """Stretto Q inside one montage cut [f0, f1): D on the cut, A at 1/3, E at 2/3 (screenplay S05)."""
    return [f0, int(round(f0 + (f1 - f0) / 3.0)), int(round(f0 + 2 * (f1 - f0) / 3.0))]


T_LAND = F(2924)     # 121.833: everyone lands on E with the amber flash — the loudest moment
CANON_CRES = ([F(2280), F(2424), F(2568), F(2664), F(2784), 120.5, T_LAND], [0, 3, 6, 8, 10, 12.5, 15])


def scene_lamps():
    """f1848 KS D3 (the first human asks; A3 f1872, E4 f1896) → f1920 warm D3–A3 bed (human vibrato)
    → f2136 A6 glass bell (the guest star) → S04 canon: one new voice each time a new light-carrier
    is lit (f2280 / 2352 / 2424 / 2496 / 2568) and a second round a voice a beat from f2664 → S05
    stretto, a Q on every cut (D on the cut, A at 1/3, E at 2/3) → f2924 tutti E (scene_landing) →
    f2928 cut."""
    sc = Scene('lamps', F(1848), 122.0, tail=0.2)
    fire_pan = -0.05
    # --- f1848 / 1872 / 1896 KS: the first human asks — D3, A3, E4 (E4 rings ~5 s), mp
    for k, (nm, f) in enumerate((('D3', 1848), ('A3', 1872), ('E4', 1896))):
        pluck(sc, N(nm), F(f), -21.0, sec=5.5, seed=SEED + 74 + k, pan=fire_pan, rev={'room': 0.3, 'hall': 0.18})
    # --- f1920 → warm bed D3–A3 (p), human vibrato fading in after 1 s, under the whole canon
    bed = [(F(1920), -4), (F(1992), -1), (F(2280), -1), (F(2568), 1.0), (F(2664), 2.0), (F(2784), 3.0), (121.5, 4.0)]
    strings_note(sc, N('D3'), F(1920), T_LAND, -35.0, attack=3.5, release=0.12, seed=SEED + 79, vib=True, pts=bed)
    strings_note(sc, N('A3'), F(1920), T_LAND, -36.0, attack=3.5, release=0.12, seed=SEED + 80, vib=True, pts=bed)
    # --- f2136 A6 glass bell (the guest star: another late letter), −30 dB
    bell(sc, 1760.0, F(2136), -30.0, sec=6.0, seed=SEED + 88, pan=0.25, rev={'void': 0.45, 'hall': 0.1})

    cres = lambda t: float(np.interp(t, *CANON_CRES))
    cres_s = lambda t: 0.5 * cres(t)

    def q_pluck(root, frames, lv, seed, pan=0.0, sec=None, decay=0.996, bright=0.6):
        for j, (iv, f) in enumerate(zip((0, 7, 14), frames)):
            if f >= 2924:          # cut g: its E is the f2924 landing (scene_landing), not doubled here
                continue
            tj = F(f)
            pluck(sc, N(root) * 2 ** (iv / 12), tj, lv + 2.0 + cres(tj), sec=sec, seed=seed + j, pan=pan,
                  decay=decay, bright=bright)

    def q_arco(root, frames, lv, seed, pan=None, attack=0.35):
        f0 = N(root)
        ev = [(fs(F(frames[0])), f0, 0), (fs(F(frames[1])), f0 * 2 ** (7 / 12), 0.08),
              (fs(F(frames[2])), f0 * 2 ** (14 / 12), 0.08)]
        if frames[2] >= 2924:      # cut g: the arco holds its A into the landing
            ev = ev[:2]
        t0 = F(frames[0])
        pts = [(t0, cres_s(t0)), (121.5, cres_s(121.5))]
        strings_note(sc, f0, t0, T_LAND, lv, attack=attack, release=0.12, seed=seed, vib=True, pts=pts, pitch=ev,
                     artic=[e[0] for e in ev[1:]], pan=pan)

    def q_glass(root, frames, lv, seed, sustain=True, pan=0.0):
        for j, (iv, f) in enumerate(zip((0, 7, 14), frames)):
            if f >= 2924:
                continue
            tj = F(f)
            bell(sc, N(root) * 2 ** (iv / 12), tj, lv - 3.0 + cres(tj), sec=4.0, seed=seed + j, pan=pan,
                 rev={'hall': 0.35, 'void': 0.15})
        if sustain and frames[2] < 2924:
            te = F(frames[2])
            glass_note(sc, N(root) * 2 ** (14 / 12), te, T_LAND, lv - 6 + cres(te), attack=0.8, release=0.12,
                       seed=seed + 9, pan=pan, pts=[(te, 0), (121.5, cres(121.5) - cres(te))])

    beat = lambda f0: [f0, f0 + 24, f0 + 48]
    # ======== S04 canon: a new voice each time a new carrier lights (screenplay S04-a…e) ========
    q_pluck('D3', beat(2280), -26.0, SEED + 950, pan=-0.1)                              # v1 KS — the campfire
    q_pluck('D4', beat(2352), -27.0, SEED + 970, pan=0.25)                              # v2 KS — the candle
    q_pluck('D4', beat(2352), -31.0, SEED + 975, pan=-0.3, decay=0.985, bright=0.35)    #    + pizzicato
    q_arco('D2', beat(2424), -33.0, SEED + 990)                                         # v3 arco — the lantern
    q_glass('D5', beat(2496), -31.0, SEED + 1010, pan=0.2)                              # v4 glass — the filament
    q_pluck('D3', beat(2568), -27.0, SEED + 1030, pan=0.1)                              # v5 tutti (mp) — the window
    q_arco('D3', beat(2568), -37.0, SEED + 1035)
    q_glass('D4', beat(2568), -33.0, SEED + 1037, sustain=False, pan=-0.2)
    # ======== second round from f2664: a new voice every beat (f2664 … f2760), p → f ========
    q_arco('D4', beat(2664), -37.0, SEED + 1050)
    q_pluck('D4', beat(2688), -28.0, SEED + 1052, pan=-0.25)
    q_glass('D5', beat(2712), -33.0, SEED + 1060, pan=0.3)
    q_pluck('D5', beat(2736), -29.0, SEED + 1062, pan=0.2)
    q_pluck('D3', beat(2760), -28.0, SEED + 1064, pan=-0.15)
    # ======== S05 stretto: a Q on every cut, register rising, orchestration thickening ========
    plan = [  # (register roots, instruments)  a … g  (screenplay S05 table)
        (('D3',), 'ks'), (('D3',), 'ks+pizz'), (('D4',), 'ks+pizz'), (('D3', 'D4'), 'ks+arco'),
        (('D4', 'D5'), 'ks+arco+glass'), (('D3', 'D4', 'D5', 'D6'), 'all'), (('D3', 'D4', 'D5', 'D6'), 'all')]
    for i, (roots, inst) in enumerate(plan):
        frames = _q_frames(STRETTO_CUTS[i], STRETTO_CUTS[i + 1])
        for k, root in enumerate(roots):
            sd = SEED + 2000 + 37 * i + 5 * k
            pn = float(np.clip(-0.4 + 0.13 * i + 0.25 * k, -0.6, 0.6))
            if 'ks' in inst or inst == 'all':
                q_pluck(root, frames, -28.0, sd, pan=pn, sec=3.0)
            if 'pizz' in inst:
                q_pluck(root, frames, -31.0, sd + 3, pan=-pn, sec=1.5, decay=0.985, bright=0.35)
            if ('arco' in inst or inst == 'all') and root != 'D6':
                q_arco(root, frames, -38.0, sd + 1, pan=pn * 0.5, attack=0.12)
            if 'glass' in inst or inst == 'all':
                if N(root) >= N('D4'):
                    q_glass(root, frames, -32.0, sd + 2, sustain=(i % 2 == 0), pan=-pn)
    sub(sc, J['D1'], F(2784), T_LAND, -27.0, attack=2.0, release=0.05, pts=[(F(2784), -6), (121.5, 0)],
        seed=SEED + 3031)
    # the stretto bed gives way 3–4 dB over its last seconds, so the E landing (scene_landing, not
    # windowed) is an accent of its own instead of a wall the limiter flattens (v1.2, shifted +9 s)
    sc.window(None, STRETTO_TRIM)
    sc.cut(122.0)
    return sc


STRETTO_CUTS = [2784, 2820, 2850, 2874, 2892, 2906, 2916, 2928]   # cut g is [2916, 2928): D 2916 / A 2920 / E 2924
# v2.1 (2026-10-27): the bed over 120–121.4 s another −1 dB, so the f2924 landing clearly tops f2892
STRETTO_TRIM = [(F(2784), 0.0), (118.0, -0.5), (120.0, -2.5), (121.4, -3.5), (121.75, -7.0)]
LAND = dict(pluck=-21.0, strum=0.015, strings=-18.0, bells=-20.0, sub=-21.0, soft=-10.0)


def scene_landing():
    """f2924 (121.833): everyone lands on E (E3…E6) with the amber flash, the loudest moment, no brass;
    f2928 (122.000) cut — from the fullest frame to the emptiest."""
    sc = Scene('landing', T_LAND, 122.0, tail=0.2)
    t_e = T_LAND
    for k, nm in enumerate(('E3', 'E4', 'E5', 'E6')):
        for j in range(2):
            clip = I.ks_pluck(N(nm), 1.0, bright=0.85, seed=SEED + 3000 + 2 * k + j)
            sc.add('plucks', clip, fs(t_e) + n_samples(LAND['strum'] * (2 * k + j) / 7), gain=db(LAND['pluck']),
                   pan=(-0.35 + 0.7 * j) * (0.4 + 0.2 * k), rev={'room': 0.25, 'hall': 0.22})
        log_note('plucks', fs(t_e), fs(122.0), [N(nm)])
        strings_note(sc, N(nm), t_e, 122.0, LAND['strings'], attack=0.025, release=0.12, seed=SEED + 3010 + k,
                     vib=True, cut_hi=4200, cut_lo=2600)
        if k >= 2:
            bell(sc, N(nm), t_e, LAND['bells'], sec=1.5, seed=SEED + 3020 + k, pan=0.3 - 0.6 * (k - 2))
    sub(sc, N('E2'), t_e, 122.0, LAND['sub'], attack=0.02, release=0.1, seed=SEED + 3030)
    if LAND.get('soft') is not None:
        sc.soft(('strings', 'plucks'), LAND['soft'])
    sc.cut(122.0)
    return sc


MORSE = {'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....',
         'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.',
         'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
         'Y': '-.--', 'Z': '--..', '?': '..--..'}


def morse_elements(text, t0, unit=0.06):
    """[(start, end)] key-down intervals: dit 1, dah 3, intra 1, inter-char 3, word gap 7 units."""
    out = []
    u = 0
    for wi, word in enumerate(text.split(' ')):
        if wi:
            u += 4          # 3 already added after the last char → 7
        for ci, ch in enumerate(word):
            if ci:
                u += 2      # 1 after the last element → 3
            for ei, el in enumerate(MORSE[ch]):
                if ei:
                    u += 1
                d = 1 if el == '.' else 3
                out.append((t0 + u * unit, t0 + (u + d) * unit))
                u += d
            u += 1
        u -= 1
        u += 3
    return out


def dist_km(t):
    return 6000.0 * np.exp(0.49 * (t - 123.0))


def scene_solo():
    """M7 (v2 S06): f2928 (122.000) hard cut to a single E5 (Asker + solo violin, mp) → f2952 (123.0)
    radio-isation (violin out ∝ 1/distance, gone by f3012; harmonics fade → bare carrier) → f3000
    (125.000) Morse "IS ANYONE THERE?" (ends 132.740 ≈ f3186) → carrier at ≈ −60 dB → f3240 (135.0) zero."""
    T0 = F(2928)
    sc = Scene('solo', T0, 135.0, tail=0.2)
    i_on = fs(T0)
    i_end = fs(135.0)
    n = i_end - i_on
    t = (i_on + np.arange(n)) / SR
    E5 = N('E5')
    # level: mp (−24 dBFS peak) to 127, then ∝ 1/d (≈ −40 at 131, ≈ −58 at 135)
    lev = np.where(t < 127.0, 0.0, -20 * np.log10(dist_km(t) / dist_km(127.0)))
    amp = 10 ** (lev / 20)
    amp[:n_samples(0.004)] *= I.raised(n_samples(0.004))
    harm = np.clip(1 - (t - 123.0) / 2.5, 0, 1)
    harm = 0.5 - 0.5 * np.cos(np.pi * harm)
    # Morse keying (exact samples) from 125.000; continuous carrier before (gap from 124.82) and after
    els = morse_elements('IS ANYONE THERE?', 125.0)
    assert abs(els[-1][1] - 132.74) < 1e-6, els[-1]
    key = np.zeros(n)
    ramp = n_samples(0.004)
    up = I.raised(ramp)
    for a, b in [(T0, 124.82)] + els:
        ia, ib = max(0, xs(a) - i_on), min(n, xs(b) - i_on)
        key[ia:ib] = 1.0
        if a > T0:
            key[ia:ia + ramp] = up
        if ib < n:
            key[ib - ramp:ib] = up[::-1]
    # after the last '?' (132.74) the unkeyed carrier comes back one Morse unit later as a slow swell
    # (0.30 s, no click), already far away: held ≈ −61 dBFS in the web master (≈ −64 pre-normalisation,
    # 13 dB under the last element), then the whole scene fades out (cosine, 134.3 → 135.000) under the
    # receiver hiss, which now fades in from 132.7 (sfx #18) so the junction has no dead air.
    T_RE, SWELL, TAIL_DB = 132.80, 0.30, -39.0
    tail = np.zeros(n)
    ia = xs(T_RE) - i_on
    tail[ia:] = 10 ** (TAIL_DB / 20)
    tail[ia:ia + n_samples(SWELL)] *= I.raised(n_samples(SWELL))
    f = np.full(n, E5)
    y = asker_h(n, f, amp * key + tail, harm, None, SEED + 113)
    clean_w = harm
    radio_w = 1 - harm
    yr = radio(y.astype(np.float64))
    sc.add('asker', y * clean_w, i_on, gain=db(-24.0), rev={'hall': 0.22})
    sc.add('asker', (yr * radio_w).astype(np.float32), i_on, gain=db(-24.0), rev={'void': 0.05})
    log_note('asker', i_on, fs(135.0), [E5])
    # the solo violin: one player, bow noise −24 dB, vibrato; exits ∝ min(1, 10 000 km / d), gone by 125.5
    vd = np.minimum(1.0, 1e4 / dist_km(t)) * np.clip((125.5 - t) / 1.0, 0, 1) ** 1.5
    vd[:n_samples(0.004)] *= I.raised(n_samples(0.004))
    # In true unison with the Asker: the violin plays the Asker's exact pitch curve (same E5, same slow
    # drift, no player offset) and only adds its own vibrato (5 Hz, ±8 c), phase-aligned so the two
    # reinforce. Before, the violin sat ~2.5 c flat and drifted on its own → a 0.95 Hz beat that swung
    # the mix by 11 dB, a pseudo-heartbeat under card ③ (S27 must have none).
    f_v = E5 * 2 ** (1.2 / 1200 * I.smooth_noise(n, 0.15, SEED + 113 + 1))     # = asker_h's drift
    vio = I.solo_violin(n, f_v, vd, seed=SEED + 114, drift_cents=0.0, offset=False, phase0=VIO_PHASE,
                        vib_rate=5.0, vib_depth=8.0)
    sc.add('strings', vio, i_on, gain=db(-32.0) * K_STR, rev={'hall': 0.3})
    log_note('strings', i_on, xs(125.5), [E5])
    # in phase the unison is ~2.4 dB louder than the old beating pair averaged; give that back until the
    # violin leaves (123–125), so S27 keeps its mp and the Morse (125+) keeps its written level
    sc.window(('asker', 'strings'), [(T0, -2.4), (123.0, -2.4), (125.0, 0.0)])
    sc.window(None, [(134.3, 1.0), (135.0, 0.0)], linear=True)      # carrier and tails out by 135.000
    return sc


VIO_PHASE = 0.8125   # saw start phase (cycles) of the S27 violin; chosen so its E5 sits in phase with the Asker


def scene_void():
    """S07 (Z3 near-silence, [3240, 3702)): the pulsar and everything that answered it are gone (v2).
    f3456 (144.0) glass bell A6 −38 dB, 1.5 s, on the golden record's glint — the light on the road ③;
    f3528 (147.0) the strings' D2–A2 open fifth (just, no third, ppp −46 dB) enters very quietly and
    follows no picture event; f3624 → f3696 it fades out (linear amplitude, true zero by 154.0), so
    the f3702 digital zero is entered from silence."""
    sc = Scene('void', F(3456), 154.2, tail=0.0)
    clip = I.glass_bell(1760.0, 1.5, seed=SEED + 152)
    clip[-n_samples(0.5):] *= I.raised(n_samples(0.5))[::-1]
    sc.add('bells', clip, fs(F(3456)), gain=db(-38.0), pan=0.1, rev={'void': 0.25})
    log_note('bells', fs(F(3456)), fs(F(3456) + 1.5), [1760.0])
    rv = {'void': 0.4, 'hall': 0.1}
    for k, (nm, lv) in enumerate((('D2', -46.0), ('A2', -47.0))):
        strings_note(sc, J[nm], F(3528), F(3696), lv, attack=2.5, release=0.05, seed=SEED + 1470 + k, rev=rv,
                     pan=0.1 - 0.2 * k, cut_hi=1800)
    sc.window(None, [(F(3624), 1.0), (F(3696), 0.0)], linear=True)
    return sc


def scene_words():
    """M8: 163 (f3912) 𒀭 D6; 165 Dm(add9) (the first third: F); 166–168 celesta Q; 171–180 the many askers;
    180 everything out but a bowed-glass A4; 184 all voices slide to E5 unison, fading; 189 silence.
    v1.2: S36 now dissolves in (180.0–180.5), so the texture no longer stops on 180.000: the notes hold
    to 180.5 and the whole scene (dry + hall) fades on the dissolve curve (inOutSine 180.0 → 180.5)."""
    sc = Scene('words', 161.0, 189.0, tail=0.3)
    bell(sc, N('D6'), F(3912), -36.0, sec=5.0, seed=SEED + 164, pan=-0.1, rev={'hall3': 0.4})   # v2: 164 → 163.0
    # Dm(add9): D2–A2–F3–C4–E4, pp → mp (≈174) → pp, out on the 180.0 cut
    dm = [(165.0, -6), (168.0, -3), (174.0, 4), (178.0, 0), (179.9, -2)]
    for k, (nm, lv) in enumerate((('D2', -38.0), ('A2', -39.0), ('F3', -39.0), ('C4', -40.0), ('E4', -41.0))):
        strings_note(sc, N(nm), 165.0, WORDS_OUT, lv, attack=3.0, release=0.03, seed=SEED + 165 + k, vib=True, pts=dm,
                     rev={'hall3': 0.35})
    # celesta Q 166/167/168 and the four legible lines
    for k, (nm, t) in enumerate((('D6', 166.0), ('A6', 167.0), ('E7', 168.0), ('E6', 174.75), ('A6', 176.75),
                                 ('D7', 177.75), ('E7', 178.75))):
        bell(sc, N(nm), t, -33.0 if k < 3 else -34.0, sec=4.0, seed=SEED + 1660 + k, kind='celesta',
             pan=-0.25 + 0.08 * k, rev={'hall3': 0.4})
    # the many askers: 8 bowed-glass voices, Q at their own pitch and pace, never aligned
    voices = [('D4', 1.30, 171.0), ('A3', 1.10, 171.7), ('F4', 1.50, 172.4), ('D5', 0.90, 173.1),
              ('C4', 1.70, 173.9), ('G4', 1.20, 174.6), ('A4', 1.00, 175.5), ('D3', 1.40, 176.2)]
    for v, (root, step, t0) in enumerate(voices):
        r = dsp.rng(SEED + 1700 + v)
        f0 = N(root)
        evs = []
        t = t0
        while t < 179.2:
            for j, iv in enumerate((0, 7, 14)):
                tj = t + j * step
                if tj < 179.6:
                    evs.append((fs(tj), f0 * 2 ** (iv / 12), 0.09))
            t += 3 * step + r.uniform(0.6, 1.6) * step
        i_on = fs(t0)
        n = fs(WORDS_OUT) - i_on
        fc = pitch_curve(evs, i_on, n, 0.09)
        dyn = note_env(n, 0.6, n - n_samples(0.03), 0.03) * rearticulate(n, i_on, [e[0] for e in evs[1:]], 0.5, 0.25)
        dyn *= dbenv([(t0, -4), (175.0, 0), (179.0, -2)], i_on, n)
        lv = -40.0 + 2.0 * (v % 3 == 0)
        sc.add('glass', I.glass_bowed(n, fc, dyn, seed=SEED + 1710 + v, pan=-0.6 + 1.2 * v / 7), i_on,
               gain=db(lv) * K_GLS, rev={'hall3': 0.45})
        log_note('glass', i_on, i_on + n, sorted({round(e[1], 3) for e in evs}))
    sc.window(None, [(180.0, 1.0), (WORDS_OUT, 0.0)], linear=True)      # = the S35→S36 dissolve
    return sc


WORDS_OUT = 180.5


def scene_converge():
    """S36/S37: the bowed-glass A4 that is left after 180.0, then every voice slides to E5, fading."""
    sc = Scene('converge', 178.5, 189.0, tail=0.3)
    # the A4 that is left (already sounding under the texture from 178.5), then the slide to E5 (184 → 188)
    i_on = fs(178.5)
    n = fs(189.0) - i_on
    ev = [(i_on, N('A4'), 0), (fs(184.0), N('E5'), 3.6)]
    dyn = note_env(n, 1.2, n - n_samples(1.2), 1.2) * dbenv([(178.5, -2), (180.2, 0), (184.0, 0), (188.6, -14)], i_on, n)
    # v1.2: hall3 send 0.4 → A4_SEND. A held sine sent hot into a 6 s hall cancels against its own wet
    # field whenever the slow pitch walk crosses a null of the hall's fine phase response: R dipped
    # 20 dB at 183.95, right on the S36→S37 dissolve. With the wet ~16 dB under the dry the worst
    # case is ±2–3 dB (the 3 Hz tremolo itself is ±1.5 dB); overall RMS is unchanged (the dry dominates).
    sc.add('glass', I.glass_bowed(n, pitch_curve(ev, i_on, n), dyn, seed=SEED + 1800, pan=0.05), i_on,
           gain=db(-39.0) * K_GLS, rev={'hall3': A4_SEND})
    log_note('glass', i_on, i_on + n, [e[1] for e in ev])
    # 184: the others come back from where they were and converge on E5, fading
    for v, (st, dl) in enumerate((('D4', 0.0), ('B4', 0.3), ('E4', 0.5), ('A5', 0.8), ('D5', 1.0), ('G4', 1.3), ('E5', 1.5))):
        t0 = 184.0 + dl
        i_on = fs(t0)
        n = fs(189.0) - i_on
        ev = [(i_on, N(st), 0), (i_on + n_samples(0.4), N('E5') * 2 ** (dsp.rng(v).uniform(-3, 3) / 1200), 3.0 - dl * 0.5)]
        dyn = note_env(n, 1.5, n - n_samples(1.0), 1.0) * dbenv([(t0, -4), (186.0, 0), (188.6, -16)], i_on, n)
        sc.add('glass', I.glass_bowed(n, pitch_curve(ev, i_on, n), dyn, seed=SEED + 1810 + v, pan=-0.5 + v / 6),
               i_on, gain=db(-43.0) * K_GLS, rev={'hall3': 0.45})
        log_note('glass', i_on, i_on + n, [N(st), N('E5')])
    # v1.2: the old dB-cosine window (187.0 → 188.9) had the cue below −80 dBFS by 187.75: ~0.85 s of
    # dead air before the word-breath (188.5). Now the unison holds and fades linearly in amplitude
    # 188.4 → 189.0, overlapping the breath's entry; near-silence (breath only) from 189.0.
    sc.window(None, [(188.4, 1.0), (189.0, 0.0)], linear=True)
    return sc


A4_SEND = 0.12

# verify (S38, 199–202, f4776–4847): "chord below −24 dB; only the heartbeat remains (−32 dB)". The chord
# used to sit at −7 → −10 dB with its D2/A2/D3 strings and the organ bed right in the lub's 80–300 Hz band,
# so the three hesitation beats were 30–40 dB under the music there and the mix stayed ≈ −22 dBFS (web).
# Now the answer drains away from the floor up over 197.5 → 199.0: the bass voices and the warm bed go
# first (ANSWER_DRAIN_PTS), the upper voices sink to −15 dB, the Asker's D5 steps back 5–7 dB — so the
# heartbeat is what is left; the −8 cent sag is untouched, and 202.0 still cuts what remains of the chord
# cleanly, leaving the D5, which swells back for the 203.0 slide up to E5.
ANSWER_ASKER_AMP = [(194.0, 0), (195.0, 0), (197.5, -4), (199.0, -10), (200.0, -12.5), (202.0, -12.5), (203.0, -6),
                    (204.0, -5)]
ANSWER_CHORD_PTS = [(194.667, 0), (195.2, 0), (197.5, -6), (199.0, -13), (201.9, -15)]
ANSWER_DRAINED = ('D2', 'A2', 'D3')
ANSWER_DRAIN_PTS = [(194.667, 0), (197.5, 0), (199.0, -20)]
ANSWER_FLOOR_PTS = [(194.667, 0), (197.5, 0), (199.0, -30)]   # below 160 Hz, dry + hall tail (Scene.low_drain)


def scene_answer():
    """M9: 194.000 ♯C5 – 194.333 E5↘D5 – 194.667 D major (the only one) → decays 8 cents flat →
    202 cut → 203 D5 → E5 → 204.000 reversed ♯C5 ends, E5 out in 18 frames → 205–208 nothing."""
    sc = Scene('answer', 191.0, 208.0, tail=0.0)
    H3 = {'hall3': 0.32}
    # ---------------- the answer
    i_on = fs(194.0)
    n = fs(204.75) - i_on
    ev = [(fs(194.0), N('C#5'), 0), (fs(194.333), N('E5'), 0.03), (xs(194.458), N('D5'), 0.06),
          (fs(203.0), N('E5'), 0.333)]
    asker_line(sc, i_on, n, ev, ANSWER_ASKER_AMP, -24.0, seed=SEED + 194, attack=0.04, release_at=fs(204.0),
               release=0.75, rev=H3)
    # the D-major chord: strings D2–A2–D3–F♯3–A3–D4–F♯4 + warm organ bed, mf, 0.8 s attack; sinks 8 c
    t_c = 194.667
    i_c = fs(t_c)
    flat = lambda n: 2 ** (-8.0 / 1200 * np.clip(((i_c + np.arange(n)) / SR - 195.0) / 4.0, 0, 1))
    chord_pts = ANSWER_CHORD_PTS
    for k, (nm, lv) in enumerate((('D2', -31.0), ('A2', -32.0), ('D3', -32.0), ('F#3', -33.0), ('A3', -33.0),
                                  ('D4', -34.0), ('F#4', -35.0))):
        hold = fs(202.0) - i_c
        nn = hold + n_samples(0.1)
        dyn = note_env(nn, 0.8, hold, 0.1) * dbenv(chord_pts, i_c, nn)
        if nm in ANSWER_DRAINED:
            dyn = dyn * dbenv(ANSWER_DRAIN_PTS, i_c, nn)
        clip = I.string_section(nn, N(nm) * flat(nn), dyn, seed=SEED + 1950 + k, vib=True, cut_hi=2800)
        sc.add('strings', clip, i_c, gain=db(lv) * K_STR, rev=H3)
        log_note('strings', i_c, fs(202.0), [N(nm)])
    for k, nm in enumerate(('D3', 'F#3', 'A3', 'D4')):
        nn = fs(202.0) - i_c + n_samples(0.1)
        o = I.organ(N(nm), nn / SR, stops=(1.0, 0.35, 0.12, 0.06, 0.0, 0.0), chiff=0.0, seed=SEED + 1960 + k)
        o = o * dbenv(chord_pts, i_c, len(o)).astype(np.float32) * note_env(len(o), 0.8, len(o) - n_samples(0.1), 0.1)
        o = o * dbenv(ANSWER_DRAIN_PTS, i_c, len(o)).astype(np.float32)     # the warm bed drains first
        sc.add('strings', I.sos_lp(o, 1800), i_c, gain=db(-38.0) * 3.0, pan=-0.3 + 0.2 * k, rev=H3)
        log_note('strings', i_c, fs(202.0), [N(nm)])
    sc.low_drain(('strings',), ANSWER_FLOOR_PTS)
    sc.cut(202.0, stems=('strings',), fade=480)
    # #32 the reversed ♯C5: the 194.000 ♯C5 + 0.4 s of R_hall, time-reversed, 0.625 s, ends on 204.000
    nn = n_samples(0.333 + 0.6)
    a = note_env(nn, 0.12, n_samples(0.333), 0.2)
    dry = I.asker(nn, np.full(nn, N('C#5')), a, seed=SEED + 194)
    st = mono2st(dry)
    full = st + 0.35 * conv(np.pad(st, ((0, n_samples(0.5)), (0, 0))), ir('hall3'))[:len(st)]
    seg = full[n_samples(0.09):n_samples(0.09) + fs(204.0) - fs(203.375)][::-1].copy()
    seg = seg * I.raised(len(seg))[:, None] ** 0.25
    seg[-CUT:] *= I.raised(CUT)[::-1, None]                           # it stops on the deletion frame
    assert fs(203.375) + len(seg) == fs(204.0)
    sc.add('asker', seg, fs(203.375), gain=db(-24.0) / (np.abs(seg).max() + 1e-12), rev={})
    log_note('asker', fs(203.375), fs(204.0), [N('C#5')])
    sc.window(('asker',), [(204.7, 0), (205.0, -100)])          # 205–208: the score is silent
    return sc


def choir_gains(n, i0, delays, seed, entry_attack=1.5):
    """Per-singer gains for the v2 choir: each singer enters on its own frame offset (0–9 frames after
    f5088, raised-cosine attack) and takes its own breaths (two short dips at singer-specific times),
    so the common question still contains many voices (brief §10, screenplay S09-g)."""
    out = []
    t = (i0 + np.arange(n)) / SR
    for k, d in enumerate(delays):
        r = dsp.rng(seed + 11 * k)
        g = np.zeros(n)
        a = d * 2000
        na = n_samples(entry_attack * r.uniform(0.85, 1.15))
        g[a:a + na] = I.raised(na)[:max(0, min(na, n - a))]
        g[a + na:] = 1.0
        for tb in (r.uniform(214.4, 217.5), r.uniform(219.0, 224.5), r.uniform(226.0, 230.0)):
            w = r.uniform(0.28, 0.42)
            u = np.clip((t - tb) / w, 0, 1)
            g *= 1.0 - 0.8 * np.sin(np.pi * u) ** 2
        out.append(g)
    return out


# the 16 singers: (pitch, → pitch at the D → A change or None, women?, near?, entry delay in frames)
CHOIR = [('E5', None, True, True, 0), ('E5', None, True, True, 4), ('E5', None, True, True, 7),
         ('A4', None, True, True, 2), ('A4', 'B4', True, True, 5), ('A4', None, True, True, 9),
         ('D4', 'E4', False, True, 1), ('D4', 'E4', False, True, 3), ('D4', 'E4', False, True, 6),
         ('D4', 'E4', False, True, 8), ('D4', 'E4', False, True, 0), ('D4', 'E4', False, True, 5),
         ('E5', None, True, False, 3), ('A4', 'B4', True, False, 6), ('D4', 'E4', False, False, 2),
         ('D4', 'E4', False, False, 9)]
CHOIR_FAR_DB = -6.0


def scene_question():
    """v2 (producer decision 7-2: the question moves +2 s, the f5160 enter does not):
    f5040 / 5064 / 5088 D4 A4 E5 (+ choir from f5088, the film's first human voice) → f5112 Dsus2,
    the Asker's vibrato grows over 3 s → f5160 (215.0) D1 → f5184 (216.0) bass D → A, Asus2 →
    f5352 (223.0) warmest → f5460 cut to black, the chord goes on → from f5472 (228.0) −6 dB every
    2 s → f5496 (229.0) A6 bell → gone ≈ 236."""
    sc = Scene('question', F(5040), 236.5, tail=0.5)
    H3 = {'hall3': 0.32}
    T_D, T_A, T_E, T_Q = F(5040), F(5064), F(5088), F(5112)        # 210 / 211 / 212 / 213
    T_WARM, T_FADE = F(5352), F(5472)                               # 223.0 / 228.0
    # ---------------- the question: D4 / A4 / E5, then E5 to the end (vibrato from the "？")
    i_q = fs(T_D)
    n = fs(236.0) - i_q
    tq = (i_q + np.arange(n)) / SR
    vib = 12.0 * np.clip((tq - T_Q) / 3.0, 0, 1) ** 1.5
    ev = [(fs(T_D), N('D4'), 0), (fs(T_A), N('A4'), 0.06), (fs(T_E), N('E5'), 0.06)]
    amp = [(T_D, -4), (T_A, -3), (T_E, -2), (T_Q, 0), (215.0, -2), (216.0, -3), (T_WARM, 0), (T_FADE, -1, 'lin'),
           (236.0, -24)]
    asker_line(sc, i_q, n, ev, amp, -25.0, seed=SEED + 208, vib=vib, release_at=fs(234.0), release=2.0, rev=H3)
    # ---------------- strings: Dsus2 at f5112 (D2–A2–E3–A3–D4–E4), revoiced to Asus2 at f5184
    fin = [(T_Q, -2), (214.5, -4), (216.0, -6), (T_WARM, -3), (T_FADE, -3.5, 'lin'), (236.0, -26)]
    i216 = fs(216.0)
    for k, (nm, to, lv) in enumerate((('D2', None, -28.0), ('A2', 'A2', -29.0), ('E3', 'E3', -30.0), ('A3', 'B3', -31.0),
                                      ('D4', None, -32.0), ('E4', 'E4', -32.0))):
        t_off = 216.0 if to is None else 236.0
        rel = 0.25 if to is None else 0.5           # the D (D2, D4) is released over 6 frames at f5184
        pitch = None
        if to is not None and to != nm:
            pitch = [(fs(T_Q), N(nm), 0), (i216, N(to), 0.25)]
        strings_note(sc, N(nm), T_Q, t_off, lv, attack=0.7, release=rel, seed=SEED + 2110 + k, vib=True, pts=fin,
                     pitch=pitch, rev=H3, cut_hi=2600 + 400 * (k > 3))
    for k, (nm, lv) in enumerate((('A1', -28.0), ('E2', -29.5))):      # the new ground: A1, E2 swell in 0.5 s
        strings_note(sc, N(nm), 216.0, 236.0, lv, attack=0.5, release=0.5, seed=SEED + 2160 + k, vib=True,
                     pts=fin, rev=H3)
    # sub: D1 from f5160 (gently, with the enter), released over 6 frames at f5184; A1 0.5 s in, a little
    # above the D1 so the ground shifts under the melody but does not drop out (v1.2)
    sub(sc, N('D1'), 215.0, 216.0, -27.0, attack=0.8, release=0.25, seed=SEED + 215)
    sub(sc, N('A1'), 216.0, 236.0, -27.0, attack=0.5, release=0.5, pts=A1_PTS, seed=SEED + 216, shape=0.3)
    # overtones E6, B6 (ppp) above the Asus2
    for k, nm in enumerate(('E6', 'B6')):
        glass_note(sc, N(nm), 217.0 + k, 236.0, -46.0 - 2 * k, attack=3.0, release=0.5, seed=SEED + 2170 + k,
                   pts=fin, rev={'hall3': 0.5}, pan=-0.3 + 0.6 * k)
    # ---------------- choir: 16 singers "aah", the first human voice of the film, from f5088 only.
    # D4–A4–E5 (pp, 1.5 s attack), entries staggered 0–9 frames, own breaths; 4 singers further away
    # (wetter, −6 dB). At f5184: D4 → E4, two altos A4 → B4 (Asus2: E4–A4–B4–E5).
    i_ch = fs(T_E)
    n = fs(236.0) - i_ch
    cpts = [(T_E, -12), (T_Q, -2), (214.5, -4), (216.0, -5), (T_WARM, -2), (T_FADE, -2.5, 'lin'), (236.0, -25)]
    dyn = note_env(n, 1.5, n - n_samples(0.5), 0.5) * dbenv(cpts, i_ch, n)
    gains = choir_gains(n, i_ch, [c[4] for c in CHOIR], SEED + 2100)
    groups = {}
    for k, (nm, to, women, near, _) in enumerate(CHOIR):
        dt = dsp.rng(SEED + 7 * k + 3).uniform(-4, 4) / 1200
        if to is None:
            fc = np.full(n, N(nm) * 2 ** dt)
        else:
            fc = pitch_curve([(i_ch, N(nm) * 2 ** dt, 0), (i216 + n_samples(0.04 * (k % 4)), N(to) * 2 ** dt, 0.35)],
                             i_ch, n)
        g = groups.setdefault((women, near), ([], []))
        g[0].append(fc)
        g[1].append(gains[k])
        log_note('choir', i_ch + 2000 * CHOIR[k][4], fs(236.0), [N(nm)] + ([N(to)] if to else []))
    for (women, near), (fcs, gs) in sorted(groups.items()):
        y = I.choir_section(n, fcs, dyn, women, SEED + 2101 + 2 * women + near, pan=(-0.2 if women else 0.15)
                            * (1.0 if near else 2.2), voice_gain=gs)
        lv = (-27.5 if women else -29.0) + (0.0 if near else CHOIR_FAR_DB)   # = v1's sop+alto / ten+bass sums
        rev = H3 if near else {'hall3': 0.75, 'void': 0.15}
        sc.add('choir', y, i_ch, gain=db(lv) * K_CH, rev=rev, dry=1.0 if near else 0.45)
    # ---------------- f5496 (229.0) glass bell A6: the light on the road, the last time. v1.2: −36 → BELL229_DB;
    # at −36 it sat ~20 dB under the still-loud Asus2 and was masked on the title flash
    bell(sc, 1760.0, F(5496), BELL229_DB, sec=6.0, seed=SEED + 229, pan=0.1, rev={'hall3': 0.3, 'void': 0.3})
    sc.window(None, [(T_D, 1.0), (233.5, 1.0), (236.2, 0.0)], linear=True)
    return sc


A1_PTS = [(216.0, 1.5), (216.6, 1.5), (219.0, -5.0), (F(5352), -3.0), (F(5472), -3.5, 'lin'), (236.0, -26.0)]
BELL229_DB = -28.0


SCENES = (scene_prologue, scene_bigbang, scene_pedal, scene_druid, scene_supernova, scene_lamps, scene_landing,
          scene_solo, scene_void, scene_words, scene_converge, scene_answer, scene_question)

# The digital silences this score is written against (screenplay v2 §6.4: Z0, Z1, Z4, Z7), in frames.
# build.py warns when timeline.json disagrees (e.g. the v1 52.5–53.333 s zero still present).
EXPECTED_DIGITAL_SILENCES = [(0, 6), (576, 608), (3702, 3864), (5988, 6000)]


# ===================================================================== render
def render(tl, only=None):
    n = int(round(tl['duration'] * SR))
    stems = {k: np.zeros((n, 2), np.float32) for k in STEMS}
    NOTES.clear()
    for make in SCENES:
        if only and make.__name__ not in only:
            continue
        i0, parts = make().render()
        for k, y in parts.items():
            e = min(n, i0 + len(y))
            stems[k][i0:e] += y[:e - i0]
    for k in stems:
        y = stems[k]
        if np.abs(y).max() > 10 ** (-1.5 / 20):
            y = dsp.limiter(y, ceiling_db=-1.0, lookahead=0.004, release=0.15)
        y[np.abs(y) < 3e-8] = 0.0                 # flush sub-LSB dust (< −150 dBFS) to true zero
        for z in tl.get('silences', []):
            if z.get('type', 'digital') == 'digital':
                y[fs(z['start']):fs(z['end'])] = 0.0
        stems[k] = y.astype(np.float32)
    return stems


if __name__ == '__main__':
    import json
    import os
    import time
    here = os.path.dirname(os.path.abspath(__file__))
    tl = json.load(open(os.path.join(os.path.dirname(here), 'timeline.json'), encoding='utf-8'))
    t0 = time.time()
    st = render(tl)
    print(f'{time.time() - t0:.1f}s', {k: round(dsp.peak_db(v), 1) for k, v in st.items()})
