#!/usr/bin/env python3
"""Build the whole soundtrack from timeline.json.

  python3 audio/build.py                 # → build/audio/mix.wav (+ stems/)
  python3 audio/build.py --only score    # re-render one part (others are read from cache)
  python3 audio/build.py --from 60 --to 90 --out build/audio/clip.wav   # excerpt of the mix

Parts (each a module exposing `render(tl) -> dict[str, np.ndarray]` of full-length stereo stems):
  score.py  — music (leitmotif, pads, choir, piano, low end, hits)
  sfx.py    — sound design (UI, cosmos, fire, city, radio, typing, impacts, room tone)
The mix stage applies stem gains, ducks music under key sfx moments, glues, limits to -1 dBTP
and normalises to the target loudness.
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


def load_timeline():
    with open(os.path.join(ROOT, 'timeline.json'), encoding='utf-8') as f:
        return json.load(f)


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


TARGET_LUFS = -16.0  # distribution normalisation (screenplay §6.6: written at ~-20 LUFS integrated, released at -16)


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


def mix(stems, tl, n):
    gains = (tl.get('mix') or {}).get('gains', {})
    music = np.zeros((n, 2), np.float32)
    fx = np.zeros((n, 2), np.float32)
    for k, v in stems.items():
        g = 10 ** (gains.get(k, 0.0) / 20)
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
    # gentle glue on the master (the score is written to absolute levels — no loudness normalisation)
    m = dsp.compress(m, threshold_db=-12, ratio=1.5, attack=0.03, release=0.4)
    loud = dsp.lufs(m)
    if TARGET_LUFS is not None and loud > -60:
        m *= 10 ** ((TARGET_LUFS - loud) / 20)
    m = dsp.limiter(m, ceiling_db=-1.0, lookahead=0.004, release=0.12)
    print(f'[mix] score-level loudness {loud:.1f} LUFS → distribution target {TARGET_LUFS}')
    # digital silences are exact zeros, sample-accurate (they are part of the storytelling)
    for z in tl.get('silences', []):
        if z.get('type', 'digital') == 'digital':
            m[dsp.n_samples(z['start']):dsp.n_samples(z['end'])] = 0.0
    print(f'[mix] integrated {dsp.lufs(m):.1f} LUFS, peak {dsp.peak_db(m):.1f} dBFS')
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', choices=['score', 'sfx'], help='re-render only this part; use cached stems for the rest')
    ap.add_argument('--skip', choices=['score', 'sfx'], help='do not include this part at all')
    ap.add_argument('--from', dest='t0', type=float, default=None)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--out', default=os.path.join(OUT, 'mix.wav'))
    a = ap.parse_args()
    tl = load_timeline()
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
    if a.t0 is not None or a.t1 is not None:
        m = m[dsp.n_samples(a.t0 or 0):dsp.n_samples(a.t1 or tl['duration'])]
    dsp.write_wav(a.out, m)
    print('→', os.path.relpath(a.out, ROOT))


if __name__ == '__main__':
    main()
