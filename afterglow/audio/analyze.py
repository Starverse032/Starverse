#!/usr/bin/env python3
""""Listen" with your eyes: render a waveform-loudness + log-spectrogram picture of a WAV with
the timeline overlaid (shot cuts, sync points, cards), so sync and dynamics can be checked
without speakers.

  python3 audio/analyze.py build/audio/mix.wav                      # whole film → build/audio/mix.png
  python3 audio/analyze.py build/audio/stems/score.pad.wav --from 0 --to 40 --out build/audio/a.png
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import dsp  # noqa: E402

import matplotlib  # noqa: E402
matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402
from scipy import signal  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('wav')
    ap.add_argument('--from', dest='t0', type=float, default=0.0)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--out', default=None)
    ap.add_argument('--offset', type=float, default=0.0, help='timeline time of the first sample in the wav (for excerpts)')
    a = ap.parse_args()
    x = dsp.read_wav(a.wav)
    tl = json.load(open(os.path.join(ROOT, 'timeline.json'), encoding='utf-8'))
    t1 = a.t1 if a.t1 is not None else a.offset + len(x) / dsp.SR
    s0, s1 = dsp.n_samples(max(0, a.t0 - a.offset)), dsp.n_samples(max(0, t1 - a.offset))
    seg = x[s0:s1].mean(axis=1)
    tt0 = a.t0
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(22, 9), sharex=True, gridspec_kw={'height_ratios': [1, 2]})
    fig.patch.set_facecolor('#111'); [ax.set_facecolor('#111') for ax in (ax1, ax2)]
    # short-term loudness (400 ms RMS in dBFS) and peak
    hop = dsp.n_samples(0.05)
    win = dsp.n_samples(0.4)
    c = np.concatenate([[0], np.cumsum(seg.astype(np.float64) ** 2)])
    idx = np.arange(0, max(1, len(seg) - win), hop)
    rms = np.sqrt((c[idx + win] - c[idx]) / win) if len(seg) > win else np.array([np.sqrt(np.mean(seg ** 2))])
    tr = tt0 + (idx + win / 2) / dsp.SR
    ax1.plot(tr, 20 * np.log10(rms + 1e-9), color='#e8c37a', lw=1)
    pk = np.array([np.abs(seg[i:i + hop]).max() if len(seg[i:i + hop]) else 0 for i in idx])
    ax1.plot(tr, 20 * np.log10(pk + 1e-9), color='#6a87b5', lw=0.6, alpha=0.7)
    ax1.set_ylim(-80, 0); ax1.set_ylabel('dBFS (rms gold / peak blue)', color='#ccc')
    ax1.tick_params(colors='#aaa'); ax1.grid(color='#333')
    f, ts, S = signal.spectrogram(seg, fs=dsp.SR, nperseg=4096, noverlap=4096 - 1200, scaling='spectrum')
    S = 10 * np.log10(S + 1e-14)
    ax2.pcolormesh(tt0 + ts, f, S, shading='auto', cmap='magma', vmin=S.max() - 90, vmax=S.max())
    ax2.set_yscale('symlog', linthresh=200); ax2.set_ylim(25, 20000); ax2.set_ylabel('Hz', color='#ccc')
    ax2.tick_params(colors='#aaa')
    for s in tl['shots']:
        if tt0 <= s['start'] <= t1:
            for ax in (ax1, ax2):
                ax.axvline(s['start'], color='#4fc3f7', lw=0.8, alpha=0.6)
            ax1.text(s['start'], -2, s['id'], color='#4fc3f7', fontsize=7, va='top')
    for k in tl.get('sync', []):
        if tt0 <= k['t'] <= t1:
            ax2.axvline(k['t'], color='#ff5252', lw=0.8, ls='--', alpha=0.8)
            ax2.text(k['t'], 16000, k.get('id', ''), color='#ff8a80', fontsize=7, rotation=90, va='top')
    for cd in tl.get('cards', []):
        if cd['end'] >= tt0 and cd['start'] <= t1:
            ax1.axvspan(cd['start'], cd['end'], color='#ffffff', alpha=0.06)
    ax2.set_xlim(tt0, t1)
    ax2.set_xlabel('timeline seconds', color='#ccc')
    out = a.out or os.path.splitext(a.wav)[0] + '.png'
    plt.tight_layout(); plt.savefig(out, dpi=80, facecolor=fig.get_facecolor())
    print('→', out, f'| integrated {dsp.lufs(x[s0:s1]):.1f} LUFS, peak {dsp.peak_db(x[s0:s1]):.1f} dBFS')


if __name__ == '__main__':
    main()
