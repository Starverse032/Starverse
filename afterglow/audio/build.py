#!/usr/bin/env python3
"""Build the whole soundtrack from timeline.json.

  python3 audio/build.py                 # → build/audio/mix.wav (+ stems/)
  python3 audio/build.py --only score    # re-render one part (others are read from cache)
  python3 audio/build.py --from 60 --to 90 --out build/audio/clip.wav   # excerpt of the mix
  python3 audio/build.py --timeline build/review/v2/sound/timeline.test.json   # build against a local copy

Masters: build/audio/mix.wav (web, −18 LUFS) and build/audio/mix_festival.wav (EBU R128, −23 LUFS).
Parts (each a module exposing `render(tl) -> dict[str, np.ndarray]` of full-length stereo stems):
  score.py  — music (leitmotif, pads, choir, piano, low end, hits)
  sfx.py    — sound design (UI, cosmos, fire, city, radio, typing, impacts, room tone)
The mix stage applies stem gains, ducks music under key sfx moments, glues, limits to -1 dBTP (true peak,
4× oversampled) and normalises to the target loudness.

v2: --timeline PATH builds against any timeline file (default timeline.json); the web master's ≤2:1
compressor window is read from timeline.mix.masters.web.compWindow (default 120.0–122.0 s, the f2924
landing); build.py warns when timeline.silences (type = digital) differ from the four zeros the score
is written for (Z0, Z1, Z4, Z7), since the mix would otherwise hard-clear music at the wrong place.
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import dsp  # noqa: E402

OUT = os.path.join(ROOT, 'build', 'audio')


def load_timeline(path=None):
    with open(path or os.path.join(ROOT, 'timeline.json'), encoding='utf-8') as f:
        return json.load(f)


def check_silences(tl):
    """Warn when the timeline's digital silences are not the ones the score/sfx are written against."""
    try:
        import score
        want = sorted(score.EXPECTED_DIGITAL_SILENCES)
    except Exception:          # pragma: no cover
        return
    have = sorted((int(round(z['start'] * 24)), int(round(z['end'] * 24)))
                  for z in tl.get('silences', []) if z.get('type', 'digital') == 'digital')
    if have != want:
        print(f'[build] WARNING timeline digital silences (frames) {have} != score v2 {want}: '
              f'the mix will hard-clear exactly what the timeline says')


def fit(x, n):
    x = dsp.stereo(np.asarray(x, dtype=np.float32))
    if len(x) >= n:
        return x[:n]
    return np.pad(x, ((0, n - len(x)), (0, 0)))


def render_part(name, tl, n):
    t0 = time.time()
    mod = importlib.import_module(name)
    stems = mod.render(tl)
    os.makedirs(os.path.join(OUT, 'stems'), exist_ok=True)
    for f in os.listdir(os.path.join(OUT, 'stems')):          # drop stems this part no longer makes (v2: pulsar, probe)
        if f.startswith(name + '.') and f.endswith('.wav') and f[len(name) + 1:-4] not in stems:
            os.remove(os.path.join(OUT, 'stems', f))
    if hasattr(mod, 'NOTES'):
        with open(os.path.join(OUT, f'{name}_notes.json'), 'w', encoding='utf-8') as fh:
            json.dump({'sr': dsp.SR, 'notes': mod.NOTES}, fh)
    for k, v in stems.items():
        dsp.write_wav(os.path.join(OUT, 'stems', f'{name}.{k}.wav'), fit(v, n))
    print(f'[{name}] {len(stems)} stems in {time.time() - t0:.1f}s: {", ".join(stems)}')
    return {f'{name}.{k}': fit(v, n) for k, v in stems.items()}


def load_cached(name, n):
    d = os.path.join(OUT, 'stems')
    out = {}
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.startswith(name + '.') and f.endswith('.wav'):
                out[f[:-4]] = fit(dsp.read_wav(os.path.join(d, f)), n)
    return out




def apply_width(m, tl, n):
    """Mid/side width automation from the letterbox keys: aspect 16:9 → mono (width 0), 2.39 → stereo (1)."""
    keys = tl.get('letterbox') or []
    if not keys:
        return m
    t = np.arange(n) / dsp.SR
    w = np.zeros(n, np.float32)
    cur = 1.0 if keys[0]['aspect'] > 2 else 0.0
    w[:] = cur
    for k in keys:
        target = 1.0 if k['aspect'] > 2 else 0.0
        a = dsp.n_samples(k['t']); d = max(1, dsp.n_samples(k.get('dur', 0)))
        u = np.clip((t[a:] - k['t']) / max(1e-9, k.get('dur', 0)), 0, 1) if k.get('dur', 0) > 0 else np.ones(n - a)
        e = np.where(u < 0.5, 4 * u ** 3, 1 - (-2 * u + 2) ** 3 / 2)  # easeInOutCubic
        w[a:] = cur + (target - cur) * e
        cur = target
    mid = (m[:, 0] + m[:, 1]) * 0.5
    side = (m[:, 0] - m[:, 1]) * 0.5 * w
    return np.stack([mid + side, mid - side], axis=1).astype(np.float32)


def automation_env(points, n):
    """Gain (linear) from [[t, dB], ...] (linear in dB between points); 0 dB outside [t_first, t_last]."""
    ts = np.array([p[0] for p in points], dtype=np.float64)
    vs = np.array([p[1] for p in points], dtype=np.float64)
    a, b = dsp.n_samples(ts[0]), min(n, dsp.n_samples(ts[-1]))
    env = np.ones(n, np.float32)
    t = np.arange(a, b) / dsp.SR
    env[a:b] = 10 ** (np.interp(t, ts, vs) / 20)
    return env


def mix(stems, tl, n):
    """Stems → music + fx buses. timeline.mix: `gains` {stem: dB}; `automation` [{match: glob, except:
    [stems], points: [[t, dB], ...]}] time-varying stem gains (v2: the f2924 landing shape); `duck`
    music windows."""
    import fnmatch
    gains = (tl.get('mix') or {}).get('gains', {})
    autos = (tl.get('mix') or {}).get('automation', [])
    music = np.zeros((n, 2), np.float32)
    fx = np.zeros((n, 2), np.float32)
    for k, v in stems.items():
        g = 10 ** (gains.get(k, 0.0) / 20)
        for au in autos:
            if fnmatch.fnmatch(k, au['match']) and k not in au.get('except', []):
                v = v * automation_env(au['points'], n)[:, None]
        (music if k.startswith('score.') else fx).__iadd__(v * g)
    # duck music a little under dense sound design moments listed in timeline.mix.duck
    for d in (tl.get('mix') or {}).get('duck', []):
        a, b, db = dsp.n_samples(d['start']), dsp.n_samples(d['end']), d.get('db', -4)
        ramp = dsp.n_samples(d.get('ramp', 0.5))
        env = np.ones(n, np.float32)
        g = 10 ** (db / 20)
        env[a:b] = g
        if ramp:
            env[max(0, a - ramp):a] = np.linspace(1, g, a - max(0, a - ramp))
            env[b:min(n, b + ramp)] = np.linspace(g, 1, min(n, b + ramp) - b)
        music *= env[:, None]
    m = music + fx
    m = dsp.highpass(m, 18, order=2)
    # stereo width follows the letterbox (screenplay §7.3): interface = mono, film = stereo
    m = apply_width(m, tl, n)
    return m


WEB_COMP = dict(threshold_db=-11, ratio=2.0, attack=0.01, release=0.25)   # v1.2: −14 → −11, only the landing is touched


TP_OS = 4   # true-peak oversampling (ITU-R BS.1770-4 Annex 2: ≥ 4× at 48 kHz)


def true_peak_env(x, os_=TP_OS):
    """Per-sample true-peak magnitude (max over channels and over the os_ interpolated points around
    each sample), from a polyphase-FIR os_× upsampling."""
    from scipy.signal import resample_poly
    u = np.abs(resample_poly(x.astype(np.float64), os_, 1, axis=0)).max(axis=1)
    u = u[:len(x) * os_].reshape(len(x), os_).max(axis=1)
    return np.maximum(u, np.abs(x).max(axis=1))


def true_peak_db(x):
    return float(20 * np.log10(true_peak_env(x).max() + 1e-12))


def tp_limiter(x, ceiling_db=-1.0, lookahead=0.004, release=0.12):
    """dsp.limiter's look-ahead / release law, but the gain is computed from the 4× oversampled (true)
    peak, so the −1 dBTP spec holds between samples too (the plain limiter only bounds sample peaks).
    One refinement pass catches the residue of the gain ripple itself. Unity everywhere the true peak
    is below the ceiling."""
    from scipy.ndimage import minimum_filter1d
    from scipy import signal as ss
    ceiling = 10 ** (ceiling_db / 20)
    y = x.astype(np.float64)
    a = np.exp(-1 / (release * dsp.SR))
    la = dsp.n_samples(lookahead)
    for margin in (1.0, 0.998):
        tp = true_peak_env(y)
        req = np.minimum(1.0, ceiling * margin / (tp + 1e-12))
        if req.min() >= 1.0:
            break
        req = minimum_filter1d(req, size=2 * la + 1)
        smooth = ss.lfilter([1 - a], [1, -a], req, zi=[req[0] * a])[0]
        g = np.minimum(req, smooth)
        y = y * g[:, None]
    return np.clip(y, -ceiling, ceiling).astype(np.float32)


def frame_sample(t, fps=24):
    """Frame-exact sample index (silences and cuts are defined on frames: sample = frame × 2000)."""
    return int(round(t * fps)) * (dsp.SR // fps)


WEB_COMP_WINDOW = (120.0, 122.0)    # v2: the f2924 landing (v1: 111.0–113.0)


def master(m, tl, kind='web'):
    """Delivery masters per timeline.mix.masters: festival = EBU R128 −23 LUFS with no extra processing;
    web = −18 LUFS with a smooth ≤2:1 compressor only over the climax (compWindow, default 120–122 s).
    Both get a −1 dBTP safety limiter, and digital silences are forced to exact zero on frame-exact samples."""
    spec = ((tl.get('mix') or {}).get('masters') or {}).get(kind, {})
    target = spec.get('integratedLUFS', -23 if kind == 'festival' else -18)
    loud = dsp.lufs(m)
    gain_db = (target - loud) if loud > -70 else 0.0

    def chain(g_db):
        out = m * np.float32(10 ** (g_db / 20))
        if kind == 'web':
            w0, w1 = spec.get('compWindow', WEB_COMP_WINDOW)
            a, b = frame_sample(w0), frame_sample(w1)
            pad = dsp.n_samples(0.25)
            lo, hi = max(0, a - pad), min(len(out), b + pad)
            seg = out[lo:hi]
            comp = dsp.compress(seg, **WEB_COMP)
            w = np.ones(hi - lo, np.float32)
            r = np.linspace(0, 1, pad, dtype=np.float32)
            w[:pad] = r; w[-pad:] = r[::-1]
            out[lo:hi] = seg * (1 - w[:, None]) + comp * w[:, None]
        # verify: the old dsp.limiter bounded the sample peak only (web: −0.88 dBTP at 25.643); now true peak
        out = tp_limiter(out, ceiling_db=spec.get('truePeak_dBTP', -1.0), lookahead=0.004, release=0.12)
        for z in tl.get('silences', []):
            if z.get('type', 'digital') == 'digital':
                out[frame_sample(z['start']):frame_sample(z['end'])] = 0.0
        return out
    # v2.1: the compressor and the true-peak limiter take loudness off the climax, so the integrated
    # loudness is re-measured AFTER them and the input gain corrected (≤ 3 passes, to ±0.05 LU)
    for _ in range(3):
        out = chain(gain_db)
        got = dsp.lufs(out)
        if abs(got - target) <= 0.05:
            break
        gain_db += target - got
    print(f'[master:{kind}] mix {loud:.1f} LUFS → {dsp.lufs(out):.1f} LUFS (target {target}, input gain {gain_db:+.2f} dB), '
          f'peak {dsp.peak_db(out):.2f} dBFS, true peak {true_peak_db(out):.2f} dBTP')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', choices=['score', 'sfx'], help='re-render only this part; use cached stems for the rest')
    ap.add_argument('--skip', choices=['score', 'sfx'], help='do not include this part at all')
    ap.add_argument('--from', dest='t0', type=float, default=None)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--out', default=os.path.join(OUT, 'mix.wav'))
    ap.add_argument('--timeline', default=None, help='timeline file (default: timeline.json at the project root)')
    a = ap.parse_args()
    tl = load_timeline(a.timeline)
    print('[build] timeline:', os.path.relpath(a.timeline, ROOT) if a.timeline else 'timeline.json')
    check_silences(tl)
    n = dsp.n_samples(tl['duration'])
    stems = {}
    for part in ('score', 'sfx'):
        if a.skip == part:
            continue
        if a.only and a.only != part:
            stems.update(load_cached(part, n))
        else:
            stems.update(render_part(part, tl, n))
    m = mix(stems, tl, n)
    for kind, path in (('web', a.out), ('festival', os.path.join(OUT, 'mix_festival.wav'))):
        x = master(m, tl, kind)
        if a.t0 is not None or a.t1 is not None:
            x = x[dsp.n_samples(a.t0 or 0):dsp.n_samples(a.t1 or tl['duration'])]
        dsp.write_wav(path, x)
        print('→', os.path.relpath(path, ROOT))
        if a.t0 is not None or a.t1 is not None:
            break


if __name__ == '__main__':
    main()
