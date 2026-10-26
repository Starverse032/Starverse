#!/usr/bin/env python3
""""Listen" with your eyes: render a waveform-loudness + log-spectrogram picture of a WAV with
the timeline overlaid (cuts, sync points, cards), so sync and dynamics can be checked
without speakers.

  python3 audio/analyze.py build/audio/mix.wav                      # whole film → build/audio/mix.png
  python3 audio/analyze.py build/audio/stems/score.pedal.wav --from 0 --to 40 --out build/audio/a.png
  python3 audio/analyze.py build/audio/mix.wav --segments build/review/v2/sound/   # one picture per v2
        segment (S01…S11) + the whole film, and segments.json with loudness / peak per segment

Overlays: --timeline PATH (default timeline.json) for shots / sync / cards; --v2 (default when the
docs exist) also draws the v2 cut points and sync frames from docs/v2/timeline-v2.md's JSON appendix.
Loudness: momentary (400 ms) and short-term (3 s) K-weighted loudness per ITU-R BS.1770 (ungated),
integrated per dsp.lufs (gated), true peak 4× oversampled.
"""
from __future__ import annotations

import argparse
import json
import os
import re
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

V2_DOC = os.path.join(ROOT, 'docs', 'v2', 'timeline-v2.md')


def v2_marks():
    """(segments, cuts, sync) from the machine-readable appendix of docs/v2/timeline-v2.md (frames)."""
    if not os.path.exists(V2_DOC):
        return [], [], []
    s = open(V2_DOC, encoding='utf-8').read()
    d = json.loads(re.findall(r'```json\n(.*?)\n```', s, re.S)[-1])
    cuts = [(e['frame'], e.get('kind', 'cut')) for e in d['events'] if e['type'] == 'cut']
    sync = [(e['frame'], e['label']) for e in d['events'] if e['type'] == 'sync']
    return d['segments'], cuts, sync


def kweight(x):
    xs = dsp.stereo(x).astype(np.float64)
    y = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], xs, axis=0)
    return signal.lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], y, axis=0)


def sliding_loudness(x, win, hop=0.1):
    """Ungated K-weighted loudness of sliding windows (LUFS); returns (window END times in s, values)."""
    y = kweight(x)
    sq = np.sum(y ** 2, axis=1)
    c = np.concatenate([[0.0], np.cumsum(sq)])
    w, h = dsp.n_samples(win), dsp.n_samples(hop)
    if len(sq) < w:
        return np.array([len(sq) / dsp.SR]), np.array([-0.691 + 10 * np.log10(np.mean(sq) + 1e-20)])
    ends = np.arange(w, len(sq) + 1, h)
    ms = (c[ends] - c[ends - w]) / w
    return ends / dsp.SR, -0.691 + 10 * np.log10(ms + 1e-20)


def true_peak_db(x, os_=4):
    from scipy.signal import resample_poly
    u = np.abs(resample_poly(x.astype(np.float64), os_, 1, axis=0)).max()
    return float(20 * np.log10(max(u, np.abs(x).max()) + 1e-12))


def stats(x):
    tm, m = sliding_loudness(x, 0.4)
    ts, s = sliding_loudness(x, 3.0) if len(x) > dsp.n_samples(3.0) else (tm, m)
    return {'integrated_LUFS': round(dsp.lufs(x), 2), 'max_momentary_LUFS': round(float(m.max()), 2),
            'max_momentary_at_s': round(float(tm[m.argmax()]), 3), 'max_shortterm_LUFS': round(float(s.max()), 2),
            'sample_peak_dBFS': round(dsp.peak_db(x), 2), 'true_peak_dBTP': round(true_peak_db(x), 2)}


def plot(x, t0, t1, out, tl, use_v2=True, title=''):
    seg = x.mean(axis=1)
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(22, 9), sharex=True, gridspec_kw={'height_ratios': [1, 2]})
    fig.patch.set_facecolor('#111'); [ax.set_facecolor('#111') for ax in (ax1, ax2)]
    # momentary loudness (K-weighted, 400 ms) and 50 ms peak
    tm, m = sliding_loudness(x, 0.4, 0.05)
    ax1.plot(t0 + tm - 0.2, m, color='#e8c37a', lw=1)
    hop = dsp.n_samples(0.05)
    idx = np.arange(0, max(1, len(seg) - hop), hop)
    pk = np.array([np.abs(x[i:i + hop]).max() if len(x[i:i + hop]) else 0 for i in idx])
    ax1.plot(t0 + (idx + hop / 2) / dsp.SR, 20 * np.log10(pk + 1e-9), color='#6a87b5', lw=0.6, alpha=0.7)
    ax1.set_ylim(-80, 0); ax1.set_ylabel('LUFS-M gold / dBFS peak blue', color='#ccc')
    ax1.tick_params(colors='#aaa'); ax1.grid(color='#333')
    if title:
        ax1.set_title(title, color='#ddd', fontsize=10)
    f, ts, S = signal.spectrogram(seg, fs=dsp.SR, nperseg=4096, noverlap=4096 - 1200, scaling='spectrum')
    S = 10 * np.log10(S + 1e-14)
    ax2.pcolormesh(t0 + ts, f, S, shading='auto', cmap='magma', vmin=S.max() - 90, vmax=S.max())
    ax2.set_yscale('symlog', linthresh=200); ax2.set_ylim(25, 20000); ax2.set_ylabel('Hz', color='#ccc')
    ax2.tick_params(colors='#aaa')
    if use_v2:
        _, cuts, sync = v2_marks()
        for fr, kind in cuts:
            t = fr / 24.0
            if t0 <= t <= t1:
                for ax in (ax1, ax2):
                    ax.axvline(t, color='#4fc3f7', lw=0.8, alpha=0.6, ls='-' if kind != 'continuous' else ':')
                ax1.text(t, -2, f'f{fr}', color='#4fc3f7', fontsize=7, va='top')
        for fr, label in sync:
            t = fr / 24.0
            if t0 <= t <= t1:
                ax2.axvline(t, color='#ff5252', lw=0.7, ls='--', alpha=0.7)
                snd = label.split('｜')[-1].strip().replace('*', '')
                ax2.text(t, 16000, f'f{fr} {snd[:18]}', color='#ff8a80', fontsize=6, rotation=90, va='top')
    else:
        for s in tl.get('shots', []):
            if t0 <= s['start'] <= t1:
                for ax in (ax1, ax2):
                    ax.axvline(s['start'], color='#4fc3f7', lw=0.8, alpha=0.6)
                ax1.text(s['start'], -2, s['id'], color='#4fc3f7', fontsize=7, va='top')
        for k in tl.get('sync', []):
            if t0 <= k['t'] <= t1:
                ax2.axvline(k['t'], color='#ff5252', lw=0.8, ls='--', alpha=0.8)
                ax2.text(k['t'], 16000, k.get('id', ''), color='#ff8a80', fontsize=7, rotation=90, va='top')
    for cd in tl.get('cards', []):
        if cd['end'] >= t0 and cd['start'] <= t1:
            ax1.axvspan(cd['start'], cd['end'], color='#ffffff', alpha=0.06)
    ax2.set_xlim(t0, t1)
    ax2.set_xlabel('timeline seconds', color='#ccc')
    plt.tight_layout(); plt.savefig(out, dpi=80, facecolor=fig.get_facecolor())
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('wav')
    ap.add_argument('--from', dest='t0', type=float, default=0.0)
    ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--out', default=None)
    ap.add_argument('--offset', type=float, default=0.0, help='timeline time of the first sample in the wav (for excerpts)')
    ap.add_argument('--timeline', default=None, help='timeline file for shots / sync / cards (default timeline.json)')
    ap.add_argument('--no-v2', action='store_true', help='draw the timeline shots / sync instead of the v2 docs marks')
    ap.add_argument('--segments', default=None, metavar='DIR', help='one picture per v2 segment + segments.json into DIR')
    a = ap.parse_args()
    x = dsp.read_wav(a.wav)
    tlp = a.timeline or os.path.join(ROOT, 'timeline.json')
    tl = json.load(open(tlp, encoding='utf-8')) if os.path.exists(tlp) else {'shots': [], 'sync': [], 'cards': []}
    use_v2 = (not a.no_v2) and os.path.exists(V2_DOC)
    name = os.path.splitext(os.path.basename(a.wav))[0]
    if a.segments:
        os.makedirs(a.segments, exist_ok=True)
        segs, _, _ = v2_marks()
        rows = {'film': stats(x)}
        plot(x, 0.0, len(x) / dsp.SR, os.path.join(a.segments, f'{name}_film.png'), tl, use_v2, f'{name} · whole film')
        for s in segs:
            t0, t1 = s['start'] / 24.0, s['end'] / 24.0
            y = x[dsp.n_samples(t0):dsp.n_samples(t1)]
            rows[s['id']] = dict(frames=[s['start'], s['end']], **stats(y))
            pad0, pad1 = max(0.0, t0 - 1.0), min(len(x) / dsp.SR, t1 + 1.0)
            plot(x[dsp.n_samples(pad0):dsp.n_samples(pad1)], pad0, pad1,
                 os.path.join(a.segments, f'{name}_{s["id"]}.png'), tl, use_v2,
                 f'{name} · {s["id"]} [{s["start"]}, {s["end"]}) · I {rows[s["id"]]["integrated_LUFS"]} LUFS · '
                 f'TP {rows[s["id"]]["true_peak_dBTP"]} dBTP')
            print(f'{s["id"]:4s} [{s["start"]:4d},{s["end"]:4d})', json.dumps(rows[s['id']]))
        with open(os.path.join(a.segments, f'{name}_segments.json'), 'w', encoding='utf-8') as f:
            json.dump(rows, f, indent=1)
        print('film', json.dumps(rows['film']))
        return
    t1 = a.t1 if a.t1 is not None else a.offset + len(x) / dsp.SR
    s0, s1 = dsp.n_samples(max(0, a.t0 - a.offset)), dsp.n_samples(max(0, t1 - a.offset))
    out = a.out or os.path.splitext(a.wav)[0] + '.png'
    plot(x[s0:s1], a.t0, t1, out, tl, use_v2)
    print('→', out, f'| integrated {dsp.lufs(x[s0:s1]):.1f} LUFS, peak {dsp.peak_db(x[s0:s1]):.1f} dBFS')


if __name__ == '__main__':
    main()
