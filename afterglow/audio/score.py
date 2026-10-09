"""AFTERGLOW — score part (screenplay §6, plus the musical items of §7.1: #15 reverse reverb,
#16 Shepard rise, #17 Big Bang 定音 + air, #21 supernova 定音 + string surge, #27 E5 carrier keyed
in Morse, #32 the reversed ♯C5). Everything synthesised; fixed seeds (global seed 55).

render(tl) -> {stem: full-length stereo float32 @ 48 kHz}. Stems:
  strings — druid fifths (just intonation in the cosmos), pedals, canon/stretto arco, Dm(add9),
            the one D-major chord (+ warm organ bed), Dsus2 → Asus2, S27 solo violin
  asker   — the Asker (AI's voice), the E5 radio carrier + Morse, the reversed ♯C5
  plucks  — Karplus–Strong: the first human Q, canon, stretto, pizzicato
  bells   — A6 "light on the road" (sine at 57, glass bells 88 / 152 / 229), 𒀭 D6, celesta Q
  glass   — bowed glass: canon/stretto glass, "many askers", the A4 that is left, the E5 unison,
            the Asus2 overtones
  brass   — the one FM horn D3 (mp, 48–52.5)
  choir   — 16-voice "aah" — only from 210.0 (03:30.00)
  low     — score timpani (Big Bang 73.4 → 18.4 Hz, supernova 55 → 27.5 Hz), sustained D1 / A1
  fx      — #15 reverse reverb, #16 Shepard rise, #17 Big Bang air

Sync: every frame-aligned event sits on sample frame × 2000 (`fs`); the Morse is placed on exact
sample times (`xs`), ending at 132.740 s. Hard cuts (24.0, 52.5, 113.0, 202.0, 204.0) end with a
2 ms raised-cosine so the cut is sample-tight without a click; digital silences are exact zeros.
Levels follow the screenplay (dBFS, pre-normalisation mix): sustained parts as RMS, hits as peak.

Departures from the computed task text (the locked screenplay final-1.1 + timeline.json win):
no pitched ident (#1 is sfx.ident, no Deep-Note glide), no star bells / iron bell / grains (§7.1
#20/#21 deleted), choir from 210.0, bass change at f5184 (216.0), pulsar is not music.
"""
from __future__ import annotations

import numpy as np
from scipy import signal

import dsp
import instruments as I
from dsp import SR, n_samples

SEED = 55
STEMS = ('strings', 'asker', 'plucks', 'bells', 'glass', 'brass', 'choir', 'low', 'fx')
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


def pluck(sc, f, t, level, sec=None, seed=0, pan=0.0, rev=None, decay=0.996, bright=0.6, stem='plucks'):
    sec = sec or float(np.clip(1100.0 / f, 1.6, 6.0))
    clip = I.ks_pluck(f, sec, decay=decay, bright=bright, seed=seed)
    sc.add(stem, clip, fs(t), gain=db(level), pan=pan, rev=rev if rev is not None else {'room': 0.25, 'hall': 0.22})


def bell(sc, f, t, level, sec=6.0, seed=0, pan=0.0, rev=None, stem='bells', kind='glass'):
    clip = I.glass_bell(f, sec, seed=seed) if kind == 'glass' else I.celesta(f, sec, seed=seed)
    sc.add(stem, clip, fs(t), gain=db(level), pan=pan, rev=rev if rev is not None else {'hall': 0.35})


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


def scene_bigbang():
    """M3: the Big Bang note at f608 (25.333, 8 frames after the flash) + air; no pitched music."""
    sc = Scene('bigbang', 25.333, 37.0, tail=3.0)
    timp, air = bigbang_parts()
    sc.add('low', timp, fs(25.333), gain=db(TIMP_BB_DB), rev={'void': 0.18})
    sc.add('fx', air, fs(25.333), gain=db(AIR_BB_DB), rev={'void': 0.6})
    return sc


def scene_druid():
    """M4 first half: 37.0 D2–A2 (just), 48.0 E3–B3–A4–E5 together, 4 s crescendo to mf (52.0), FM
    horn D3 buried (mp), 52.5 the score is cut."""
    sc = Scene('druid', 37.0, 52.5, tail=0.5)
    rv = {'void': 0.45, 'hall': 0.1}
    base = [(37.0, 0), (48.0, 0), (52.0, 10.0)]
    strings_note(sc, J['D2'], 37.0, 52.5, -40.0, attack=3.0, release=1, seed=SEED + 40, pts=base, rev=rv)
    strings_note(sc, J['A2'], 37.0, 52.5, -41.0, attack=3.0, release=1, seed=SEED + 41, pts=base, rev=rv)
    up = [(48.0, -12), (52.0, 0)]
    for k, (nm, lv) in enumerate((('E3', -32.0), ('B3', -33.0), ('A4', -34.0), ('E5', -35.0))):
        strings_note(sc, J[nm], 48.0, 52.5, lv, attack=3.6, release=1, seed=SEED + 42 + k, pts=up, rev=rv,
                     shape=1.4)
    # FM horn D3, mp, buried in the chord (the film's only brass colour)
    i_on = fs(48.0)
    n = fs(52.5) - i_on + n_samples(1)
    dyn = note_env(n, 0.8, fs(52.5) - i_on, 1.0) * dbenv([(48.0, -6), (52.0, 0)], i_on, n)
    sc.add('brass', I.fm_horn(n, J['D3'], dyn, seed=SEED + 48), i_on, gain=db(-35.0) * K_HRN, rev={'void': 0.5, 'hall': 0.2})
    sc.cut(52.5)
    return sc


def scene_supernova_to_lamps():
    """53.333 supernova note (A1 → A0) + string surge p → f (D–A–E–B over D1) → 57 A6 sine →
    D2 pedal (M5) → 74 KS Q → 79 D3–A3 bed → 88 A6 glass bell → 95 canon → 107 stretto →
    112.833 tutti E (loudest) → 113.000 cut."""
    sc = Scene('lamps', 53.333, 113.0, tail=0.2)
    t_sn = 53.333
    # --- #21 supernova score timpani: 55 → 27.5 Hz, 3 s, −9 dBFS peak
    timp = I.score_timpani(55.0, 27.5, 3.0, 10.0, decay_db_per_s=6.5, h2_db=-10.0, drive=1.25)
    sc.add('low', timp, fs(t_sn), gain=db(-9.0), rev={'void': 0.15})
    sub(sc, J['D1'], t_sn, 58.0, -24.0, attack=0.3, release=5.0, pts=[(t_sn, -8), (55.0, 0), (58, -6)], seed=SEED + 50)
    # --- surge: D–A–E–B stacked over the D1, p → f (53.333 → 55.0), then decays
    rv = {'void': 0.5, 'hall': 0.12}
    surge = [(t_sn, -12), (55.0, 0), (57.0, -6), (61.0, -18)]
    for k, (nm, lv) in enumerate((('A2', -33.0), ('E3', -33.5), ('B3', -34.0), ('A4', -35.0), ('E5', -36.5),
                                  ('B4', -37.0))):
        strings_note(sc, J[nm], t_sn, 59.0, lv, attack=0.35, release=6.0, seed=SEED + 52 + k, pts=surge, rev=rv,
                     cut_hi=3200)
    # --- the D2 pedal: part of the surge, then ppp through M5, swelling with the canon and stretto
    ped = [(t_sn, -12), (55.0, -3), (58.0, -11), (62.0, -14), (70.0, -15), (95.0, -12), (107.0, -8),
           (112.5, -3)]
    strings_note(sc, J['D2'], t_sn, 112.833, -26.0, attack=0.35, release=0.12, seed=SEED + 60, pts=ped,
                 rev={'void': 0.3, 'hall': 0.15}, cut_hi=2200)
    # --- 57.0 A6 "light on the road": a single sine with slight vibrato, −28 dB, out by 63.5 (f1524)
    i_on = fs(57.0)
    n = fs(63.5) - i_on
    t = np.arange(n) / SR
    vib = 2 ** (4.0 / 1200 * np.sin(2 * np.pi * 4.6 * t) * np.clip(t / 1.5, 0, 1))
    a6 = np.sin(2 * np.pi * np.cumsum(1760.0 * vib / SR)) * note_env(n, 1.2, n - n_samples(2.5), 2.5)
    sc.add('bells', a6, i_on, gain=db(-28.0) * SQ2 / SQ2, rev={'void': 0.5})
    # ======== M5 (human section: ET, vibrato) ========
    # --- 74/75/76 KS: the first human asks — D3, A3, E4 (E4 rings ~5 s), mp
    for k, (nm, t) in enumerate((('D3', 74.0), ('A3', 75.0), ('E4', 76.0))):
        pluck(sc, N(nm), t, -21.0, sec=5.5, seed=SEED + 74 + k, pan=-0.05, rev={'room': 0.3, 'hall': 0.18})
    # --- 79 → warm bed D3–A3 (p), continuing into the canon
    bed = [(79.0, -4), (82.0, -1), (95.0, -1), (107.0, 2.0), (112.5, 4.0)]
    strings_note(sc, N('D3'), 79.0, 112.833, -35.0, attack=3.5, release=0.12, seed=SEED + 79, vib=True, pts=bed)
    strings_note(sc, N('A3'), 79.0, 112.833, -36.0, attack=3.5, release=0.12, seed=SEED + 80, vib=True, pts=bed)
    # --- 88.0 A6 glass bell (another late letter), −30 dB
    bell(sc, 1760.0, 88.0, -30.0, sec=6.0, seed=SEED + 88, pan=0.15, rev={'void': 0.45, 'hall': 0.1})
    # ======== M6 canon (95 → 107): Q every 2 beats, registers rising, p → f ========
    cres = lambda t: float(np.interp(t, [95, 101, 105, 107, 109, 111.5, 112.833], [0, 3, 6, 8, 10, 12.5, 15]))
    cres_s = lambda t: 0.5 * cres(t)

    def q_pluck(root, t0, step, lv, seed, pan=0.0, sec=None, decay=0.996, bright=0.6):
        for j, iv in enumerate((0, 7, 14)):
            tj = t0 + j * step
            f = N(root) * 2 ** (iv / 12)
            pluck(sc, f, tj, lv + 2.0 + cres(tj), sec=sec, seed=seed + j, pan=pan, decay=decay, bright=bright)

    def q_arco(root, t0, step, lv, seed, t_end=112.833, vib=True, pan=None, attack=0.35):
        f0 = N(root)
        ev = [(fs(t0), f0, 0), (fs(t0 + step), f0 * 2 ** (7 / 12), 0.08), (fs(t0 + 2 * step), f0 * 2 ** (14 / 12), 0.08)]
        pts = [(t0, cres_s(t0)), (112.5, cres_s(112.5))]
        strings_note(sc, f0, t0, t_end, lv, attack=attack, release=0.12, seed=seed, vib=True, pts=pts, pitch=ev,
                     artic=[ev[1][0], ev[2][0]], pan=pan)

    def q_glass(root, t0, step, lv, seed, sustain=True, pan=0.0):
        for j, iv in enumerate((0, 7, 14)):
            tj = t0 + j * step
            bell(sc, N(root) * 2 ** (iv / 12), tj, lv - 3.0 + cres(tj), sec=4.0, seed=seed + j, pan=pan,
                 rev={'hall': 0.35, 'void': 0.15})
        if sustain:
            te = t0 + 2 * step
            glass_note(sc, N(root) * 2 ** (14 / 12), te, 112.833, lv - 6 + cres(te), attack=0.8, release=0.12,
                       seed=seed + 9, pan=pan, pts=[(te, 0), (112.5, cres(112.5) - cres(te))])

    q_pluck('D3', 95.0, 1.0, -26.0, SEED + 950, pan=-0.1)                              # v1 KS
    q_pluck('D4', 97.0, 1.0, -27.0, SEED + 970, pan=0.25)                              # v2 KS
    q_pluck('D4', 97.0, 1.0, -31.0, SEED + 975, pan=-0.3, decay=0.985, bright=0.35)    # + pizzicato
    q_arco('D2', 99.0, 1.0, -33.0, SEED + 990)                                         # v3 strings arco
    q_glass('D5', 101.0, 1.0, -31.0, SEED + 1010, pan=0.2)                             # v4 glass
    q_pluck('D3', 103.0, 1.0, -27.0, SEED + 1030, pan=0.1)                             # v5 tutti
    q_arco('D3', 103.0, 1.0, -37.0, SEED + 1035)
    q_glass('D4', 103.0, 1.0, -33.0, SEED + 1037, sustain=False, pan=-0.2)
    q_arco('D4', 105.0, 1.0, -37.0, SEED + 1050)                                       # v6 second round, a voice a beat
    q_pluck('D4', 105.0, 1.0, -28.0, SEED + 1052, pan=-0.25)
    q_glass('D5', 106.0, 1.0, -33.0, SEED + 1060, pan=0.3)
    q_pluck('D5', 106.0, 1.0, -29.0, SEED + 1062, pan=0.2)
    # ======== stretto (107 → 112.833): a Q on every cut, D on the cut, E on the next cut ========
    cuts = [2568, 2604, 2634, 2658, 2676, 2690, 2700, 2708]
    plan = [  # (register roots, instruments)
        (('D3',), 'ks+arco'), (('D4',), 'ks+arco'), (('D2', 'D5'), 'arco+glass'), (('D3', 'D4'), 'ks+arco'),
        (('D4', 'D5'), 'ks+arco+glass'), (('D5', 'D6'), 'ks+glass+arco'), (('D3', 'D4', 'D5', 'D6'), 'all')]
    for i, (roots, inst) in enumerate(plan):
        f0, f1 = cuts[i], cuts[i + 1]
        t0 = f0 / 24.0
        step = (f1 - f0) / 48.0
        for k, root in enumerate(roots):
            sd = SEED + 2000 + 37 * i + 5 * k
            pn = float(np.clip(-0.4 + 0.13 * i + 0.25 * k, -0.6, 0.6))
            if 'ks' in inst or inst == 'all':
                q_pluck(root, t0, step, -28.0, sd, pan=pn, sec=3.0)
            if ('arco' in inst or inst == 'all') and root != 'D6':
                q_arco(root, t0, step, -38.0, sd + 1, pan=pn * 0.5, attack=0.12)
            if 'glass' in inst or inst == 'all':
                if N(root) >= N('D4'):
                    q_glass(root, t0, step, -32.0, sd + 2, sustain=(i % 2 == 0), pan=-pn)
    sub(sc, J['D1'], 107.0, 112.833, -27.0, attack=2.0, release=0.05, pts=[(107, -6), (112.5, 0)], seed=SEED + 3031)
    # the stretto bed (everything in this scene) gives way 3–4 dB over its last seconds, so the E landing
    # (scene_landing, not windowed) is an accent of its own instead of a wall the limiter flattens
    sc.window(None, STRETTO_TRIM)
    sc.cut(113.0)
    return sc


# v1.2 (review: the f2708 landing had no accent; the web limiter held −1 dBFS from 110.5 and took
# ~4 dB at the landing): the bed gives way 1.5 → 2.5 dB over 111–112.4 and dips to −7 dB in the last
# 80 ms (the breath before the shout); the landing is re-voiced denser and less peaky — plucks −3 dB
# and strummed over 15 ms after the beat (never before it), strings +6 dB, sub +3 dB, tanh-shaved
# at −10 dBFS — so it lands ≥ 3 dB above the preceding 0.5 s in both masters with the limiter at
# ≲ 2 dB, and the climax still peaks ≈ +9 LU (short-term) over the film's integrated loudness.
STRETTO_TRIM = [(107.0, 0.0), (109.0, -0.5), (111.0, -1.5), (112.4, -2.5), (112.75, -7.0)]
LAND = dict(pluck=-21.0, strum=0.015, strings=-18.0, bells=-20.0, sub=-21.0, soft=-10.0)


def scene_landing():
    """112.833 (f2708): everyone lands on E (E3…E6), the loudest moment, no brass; cut at 113.000."""
    sc = Scene('landing', 112.833, 113.0, tail=0.2)
    t_e = 112.833
    for k, nm in enumerate(('E3', 'E4', 'E5', 'E6')):
        for j in range(2):
            clip = I.ks_pluck(N(nm), 1.0, bright=0.85, seed=SEED + 3000 + 2 * k + j)
            sc.add('plucks', clip, fs(t_e) + n_samples(LAND['strum'] * (2 * k + j) / 7), gain=db(LAND['pluck']),
                   pan=(-0.35 + 0.7 * j) * (0.4 + 0.2 * k), rev={'room': 0.25, 'hall': 0.22})
        strings_note(sc, N(nm), t_e, 113.0, LAND['strings'], attack=0.025, release=0.12, seed=SEED + 3010 + k,
                     vib=True, cut_hi=4200, cut_lo=2600)
        if k >= 2:
            bell(sc, N(nm), t_e, LAND['bells'], sec=1.5, seed=SEED + 3020 + k, pan=0.3 - 0.6 * (k - 2))
    sub(sc, N('E2'), t_e, 113.0, LAND['sub'], attack=0.02, release=0.1, seed=SEED + 3030)
    if LAND.get('soft') is not None:
        sc.soft(('strings', 'plucks'), LAND['soft'])
    sc.cut(113.0)
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
    """M7: 113.000 hard cut to a single E5 (Asker + solo violin, mp) → 123 radio-isation (violin out
    ∝ 1/distance, harmonics fade → bare carrier) → 125.000 Morse "IS ANYONE THERE?" (ends 132.740)
    → carrier at ≈ −60 dB → 135.000 zero."""
    sc = Scene('solo', 113.0, 135.0, tail=0.2)
    i_on = fs(113.0)
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
    for a, b in [(113.0, 124.82)] + els:
        ia, ib = max(0, xs(a) - i_on), min(n, xs(b) - i_on)
        key[ia:ib] = 1.0
        if a > 113.0:
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
    # in phase the unison is ~2.4 dB louder than the old beating pair averaged; give that back until the
    # violin leaves (123–125), so S27 keeps its mp and the Morse (125+) keeps its written level
    sc.window(('asker', 'strings'), [(113.0, -2.4), (123.0, -2.4), (125.0, 0.0)])
    sc.window(None, [(134.3, 1.0), (135.0, 0.0)], linear=True)      # carrier and tails out by 135.000
    return sc


VIO_PHASE = 0.8125   # saw start phase (cycles) of the S27 violin; chosen so its E5 sits in phase with the Asker


def scene_golden():
    """152.0: glass bell A6 (−38 dB, 1.5 s) — the light on the road once more; out before 154.25."""
    sc = Scene('golden', 152.0, 154.2, tail=0.0)
    clip = I.glass_bell(1760.0, 1.5, seed=SEED + 152)
    clip[-n_samples(0.5):] *= I.raised(n_samples(0.5))[::-1]
    sc.add('bells', clip, fs(152.0), gain=db(-38.0), pan=0.1, rev={'void': 0.25})
    sc.window(None, [(153.4, 0), (154.2, -100)])
    return sc


def scene_words():
    """M8: 164 𒀭 D6; 165 Dm(add9) (the first third: F); 166–168 celesta Q; 171–180 the many askers;
    180 everything out but a bowed-glass A4; 184 all voices slide to E5 unison, fading; 189 silence.
    v1.2: S36 now dissolves in (180.0–180.5), so the texture no longer stops on 180.000: the notes hold
    to 180.5 and the whole scene (dry + hall) fades on the dissolve curve (inOutSine 180.0 → 180.5)."""
    sc = Scene('words', 161.0, 189.0, tail=0.3)
    bell(sc, N('D6'), 164.0, -40.0, sec=5.0, seed=SEED + 164, pan=-0.1, rev={'hall3': 0.4})
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
    # 184: the others come back from where they were and converge on E5, fading
    for v, (st, dl) in enumerate((('D4', 0.0), ('B4', 0.3), ('E4', 0.5), ('A5', 0.8), ('D5', 1.0), ('G4', 1.3), ('E5', 1.5))):
        t0 = 184.0 + dl
        i_on = fs(t0)
        n = fs(189.0) - i_on
        ev = [(i_on, N(st), 0), (i_on + n_samples(0.4), N('E5') * 2 ** (dsp.rng(v).uniform(-3, 3) / 1200), 3.0 - dl * 0.5)]
        dyn = note_env(n, 1.5, n - n_samples(1.0), 1.0) * dbenv([(t0, -4), (186.0, 0), (188.6, -16)], i_on, n)
        sc.add('glass', I.glass_bowed(n, pitch_curve(ev, i_on, n), dyn, seed=SEED + 1810 + v, pan=-0.5 + v / 6),
               i_on, gain=db(-43.0) * K_GLS, rev={'hall3': 0.45})
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
    for k, nm in enumerate(('D3', 'F#3', 'A3', 'D4')):
        nn = fs(202.0) - i_c + n_samples(0.1)
        o = I.organ(N(nm), nn / SR, stops=(1.0, 0.35, 0.12, 0.06, 0.0, 0.0), chiff=0.0, seed=SEED + 1960 + k)
        o = o * dbenv(chord_pts, i_c, len(o)).astype(np.float32) * note_env(len(o), 0.8, len(o) - n_samples(0.1), 0.1)
        o = o * dbenv(ANSWER_DRAIN_PTS, i_c, len(o)).astype(np.float32)     # the warm bed drains first
        sc.add('strings', I.sos_lp(o, 1800), i_c, gain=db(-38.0) * 3.0, pan=-0.3 + 0.2 * k, rev=H3)
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
    sc.window(('asker',), [(204.7, 0), (205.0, -100)])          # 205–208: the score is silent
    return sc


def scene_question():
    """208/209/210 D4 A4 E5 (+ choir 210) → 211 Dsus2, vibrato grows → 215 D1 → 216.000 bass D → A,
    Asus2 → 224 warmest → 228.5 black, chord goes on, −6 dB every 2 s → 229 A6 bell → gone ≈ 236."""
    sc = Scene('question', 208.0, 236.5, tail=0.5)
    H3 = {'hall3': 0.32}
    # ---------------- the question: 208 D4 / 209 A4 / 210 E5, then E5 to the end (vibrato from 211)
    i_q = fs(208.0)
    n = fs(236.0) - i_q
    tq = (i_q + np.arange(n)) / SR
    vib = 12.0 * np.clip((tq - 211.0) / 3.0, 0, 1) ** 1.5
    ev = [(fs(208.0), N('D4'), 0), (fs(209.0), N('A4'), 0.06), (fs(210.0), N('E5'), 0.06)]
    amp = [(208.0, -4), (209.0, -3), (210.0, -2), (211.0, 0), (215.0, -2), (216.0, -3), (224.0, 0), (228.5, -1, 'lin'),
           (236.0, -24)]
    asker_line(sc, i_q, n, ev, amp, -25.0, seed=SEED + 208, vib=vib, release_at=fs(234.0), release=2.0, rev=H3)
    # ---------------- strings: Dsus2 at 211 (D2–A2–E3–A3–D4–E4), revoiced to Asus2 at 216
    fin = [(211.0, -2), (214.5, -4), (216.0, -6), (224.0, -3), (228.5, -3.5, 'lin'), (236.0, -26)]
    i216 = fs(216.0)
    for k, (nm, to, lv) in enumerate((('D2', None, -28.0), ('A2', 'A2', -29.0), ('E3', 'E3', -30.0), ('A3', 'B3', -31.0),
                                      ('D4', None, -32.0), ('E4', 'E4', -32.0))):
        t_off = 216.0 if to is None else 236.0
        rel = 0.25 if to is None else 0.5
        pitch = None
        if to is not None and to != nm:
            pitch = [(fs(211.0), N(nm), 0), (i216, N(to), 0.25)]
        strings_note(sc, N(nm), 211.0, t_off, lv, attack=0.7, release=rel, seed=SEED + 2110 + k, vib=True, pts=fin,
                     pitch=pitch, rev=H3, cut_hi=2600 + 400 * (k > 3))
    for k, (nm, lv) in enumerate((('A1', -28.0), ('E2', -29.5))):      # the new ground: A1, E2 swell in 0.5 s
        strings_note(sc, N(nm), 216.0, 236.0, lv, attack=0.5, release=0.5, seed=SEED + 2160 + k, vib=True,
                     pts=fin, rev=H3)
    # sub: D1 from 215.0 (gently), released over 6 frames at 216.0; A1 0.5 s in.
    # v1.2: the A1 used `fin` (−6 dB at 216) and a plain raised-cosine attack, so the summed sub-bass fell
    # ~12 dB at the D → A change and only recovered ~2 s later as the strings' hall built up. Now the A1
    # comes in on a front-loaded 0.5 s attack (raised cosine ^0.3: crosses the D1's 6-frame release within
    # −3 dB) a little above the D1's level, and eases back to `fin` while the strings' hall builds up,
    # so the ground shifts under the melody but does not drop out.
    sub(sc, N('D1'), 215.0, 216.0, -27.0, attack=0.8, release=0.25, seed=SEED + 215)
    sub(sc, N('A1'), 216.0, 236.0, -27.0, attack=0.5, release=0.5, pts=A1_PTS, seed=SEED + 216, shape=0.3)
    # overtones E6, B6 (ppp) above the Asus2
    for k, nm in enumerate(('E6', 'B6')):
        glass_note(sc, N(nm), 217.0 + k, 236.0, -46.0 - 2 * k, attack=3.0, release=0.5, seed=SEED + 2170 + k,
                   pts=fin, rev={'hall3': 0.5}, pan=-0.3 + 0.6 * k)
    # ---------------- choir: 16 voices, only from 210.0 — S×4 E5, A×4 A4 (→ 2 to B4), T×4 D4 → E4, B×4 A3 (211)
    i_ch = fs(210.0)
    n = fs(236.0) - i_ch
    cpts = [(210.0, -12), (211.0, -2), (214.5, -4), (216.0, -5), (224.0, -2), (228.5, -2.5, 'lin'), (236.0, -25)]
    dyn = note_env(n, 1.5, n - n_samples(0.5), 0.5) * dbenv(cpts, i_ch, n)

    def cv(name, to=None):
        out = []
        for j in range(4):
            dt = dsp.rng(SEED + 7 * j + len(name)).uniform(-4, 4) / 1200
            if to is None:
                out.append(np.full(n, N(name) * 2 ** dt))
            else:
                out.append(pitch_curve([(i_ch, N(name) * 2 ** dt, 0), (i216 + n_samples(0.04 * j), N(to) * 2 ** dt, 0.35)],
                                       i_ch, n))
        return out
    sop = cv('E5')
    alt = cv('A4')
    alt = alt[:2] + [pitch_curve([(i_ch, N('A4'), 0), (i216 + n_samples(0.1), N('B4') * 2 ** (j * 3 / 1200), 0.4)], i_ch, n)
                     for j in range(2)]
    ten = cv('D4', 'E4')
    sc.add('choir', I.choir_section(n, sop, dyn, True, SEED + 2101, pan=-0.3), i_ch, gain=db(-30.0) * K_CH, rev=H3)
    sc.add('choir', I.choir_section(n, alt, dyn, True, SEED + 2102, pan=-0.1), i_ch, gain=db(-31.0) * K_CH, rev=H3)
    sc.add('choir', I.choir_section(n, ten, dyn, False, SEED + 2103, pan=0.15), i_ch, gain=db(-31.0) * K_CH, rev=H3)
    i_b = fs(211.0)
    nb = fs(236.0) - i_b
    dynb = note_env(nb, 1.5, nb - n_samples(0.5), 0.5) * dbenv(cpts, i_b, nb)
    bas = [np.full(nb, N('A3') * 2 ** (dsp.rng(j).uniform(-4, 4) / 1200)) for j in range(4)]
    sc.add('choir', I.choir_section(nb, bas, dynb, False, SEED + 2104, pan=0.35), i_b, gain=db(-33.0) * K_CH, rev=H3)
    # ---------------- 229.0 glass bell A6: the light on the road, the last time. v1.2: −36 → BELL229_DB;
    # at −36 it sat ~20 dB under the still-loud Asus2 and was masked on the title flash
    bell(sc, 1760.0, 229.0, BELL229_DB, sec=6.0, seed=SEED + 229, pan=0.1, rev={'hall3': 0.3, 'void': 0.3})
    sc.window(None, [(208.0, 1.0), (233.5, 1.0), (236.2, 0.0)], linear=True)
    return sc


A1_PTS = [(216.0, 1.5), (216.6, 1.5), (219.0, -5.0), (224.0, -3.0), (228.5, -3.5, 'lin'), (236.0, -26.0)]
BELL229_DB = -28.0


SCENES = (scene_prologue, scene_bigbang, scene_druid, scene_supernova_to_lamps, scene_landing, scene_solo, scene_golden,
          scene_words, scene_converge, scene_answer, scene_question)


# ===================================================================== render
def render(tl, only=None):
    n = int(round(tl['duration'] * SR))
    stems = {k: np.zeros((n, 2), np.float32) for k in STEMS}
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
