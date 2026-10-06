"""程序化合成背景音乐：缓慢的氛围和弦铺底 + 稀疏的钟琴音 + 合成混响。

音乐情绪随章节变化：寒冬章节更暗、更稀疏；深度学习之后更明亮、更密集。
全部确定性生成（固定随机种子），每次构建结果一致。
"""
import math

import numpy as np
from scipy.signal import lfilter, oaconvolve

SR = 48000

# 四个和弦循环：Am9 – Fmaj7 – Cadd9 – G6（低音, 铺底音）
PROG = [(45, [57, 60, 64, 71]), (41, [53, 57, 60, 64]), (48, [55, 60, 62, 64]), (43, [55, 59, 62, 64])]
PENTA = [57, 60, 62, 64, 67]  # A 小调五声音阶


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def _env(n, attack, release):
    e = np.ones(n, dtype=np.float32)
    a = min(n, int(attack * SR))
    r = min(n - a, int(release * SR))
    if a:
        e[:a] = np.linspace(0, 1, a, dtype=np.float32) ** 2
    if r:
        e[n - r:] *= np.linspace(1, 0, r, dtype=np.float32) ** 2
    return e


def _pad_note(freq, dur, bright, rng):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    x = np.zeros(n, dtype=np.float32)
    for det in (-0.08, 0.0, 0.08):
        f = freq * 2 ** (det / 12)
        ph = rng.uniform(0, 2 * math.pi)
        saw = 2 * ((f * t + ph / (2 * math.pi)) % 1.0) - 1
        x += saw.astype(np.float32) * 0.33
    # 一阶低通，亮度控制截止频率
    fc = 300 + 1400 * bright
    a = math.exp(-2 * math.pi * fc / SR)
    x = lfilter([1 - a], [1, -a], x).astype(np.float32)
    x = lfilter([1 - a], [1, -a], x).astype(np.float32)
    x += 0.35 * np.sin(2 * math.pi * freq * t).astype(np.float32)
    lfo = 1 + 0.15 * np.sin(2 * math.pi * 0.11 * t + rng.uniform(0, 6))
    return x * lfo.astype(np.float32) * _env(n, 2.5, 3.5)


def _bell(freq, dur=3.5):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    mod = np.sin(2 * math.pi * freq * 3.5 * t) * 1.6 * np.exp(-t * 3)
    x = np.sin(2 * math.pi * freq * t + mod) * np.exp(-t * 1.6)
    x += 0.3 * np.sin(2 * math.pi * freq * 2 * t) * np.exp(-t * 3)
    return (x * _env(n, 0.005, 0.3)).astype(np.float32)


def _reverb_ir(seconds=3.2, seed=1):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.normal(0, 1, (2, n)) * np.exp(-t * 2.2)
    ir[:, : int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    return (ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))).astype(np.float32)


def mood_for_chapter(ch):
    """(亮度, 钟琴密度, 和弦时长) —— 随历史进程变化的情绪。"""
    table = {0: (0.35, 0.10, 9), 1: (0.30, 0.12, 9), 2: (0.40, 0.15, 8), 3: (0.50, 0.20, 8), 4: (0.60, 0.25, 8),
             5: (0.12, 0.04, 10), 6: (0.45, 0.18, 8), 7: (0.50, 0.22, 8), 8: (0.55, 0.25, 8), 9: (0.70, 0.32, 7),
             10: (0.80, 0.36, 7), 11: (0.85, 0.40, 7), 12: (0.50, 0.18, 8), 13: (0.40, 0.12, 9)}
    return table.get(ch, (0.5, 0.2, 8))


def compose(total, sections, seed=2024):
    """sections: [(start, end, chapter, snow)]，返回 (2, N) 的立体声 float32。"""
    rng = np.random.default_rng(seed)
    n = int((total + 6) * SR)
    dry = np.zeros((2, n), dtype=np.float32)

    def section_at(t):
        for s in sections:
            if s[0] <= t < s[1]:
                return s
        return sections[-1]

    t = 0.0
    k = 0
    while t < total + 2:
        _, _, ch, snow = section_at(t)
        bright, dens, cd = mood_for_chapter(ch)
        if snow:
            bright, dens = min(bright, 0.15), min(dens, 0.05)
        root, pad = PROG[k % 4]
        if ch == 5 or snow:
            root, pad = [(45, [57, 60, 64, 69]), (38, [50, 57, 60, 65]), (41, [53, 57, 60, 64]), (40, [52, 55, 59, 64])][k % 4]
        dur = cd + 3.5
        i0 = int(t * SR)
        for j, m in enumerate(pad):
            x = _pad_note(midi_hz(m), dur, bright, rng) * 0.11
            pan = 0.5 + 0.35 * math.sin(j * 1.9 + k)
            seg = dry[:, i0:i0 + len(x)]
            seg[0] += x[: seg.shape[1]] * (1 - pan)
            seg[1] += x[: seg.shape[1]] * pan
        b = _pad_note(midi_hz(root), dur, 0.1, rng) * 0.16
        seg = dry[:, i0:i0 + len(b)]
        seg[0] += b[: seg.shape[1]]
        seg[1] += b[: seg.shape[1]]
        # 钟琴：每半拍按密度随机触发
        beat = 0.5
        for q in range(int(cd / beat)):
            if rng.uniform() < dens:
                m = PENTA[int(rng.integers(0, len(PENTA)))] + 12 * int(rng.integers(1, 3))
                x = _bell(midi_hz(m)) * (0.05 + 0.04 * rng.uniform())
                ii = i0 + int(q * beat * SR)
                pan = rng.uniform(0.2, 0.8)
                seg = dry[:, ii:ii + len(x)]
                seg[0] += x[: seg.shape[1]] * (1 - pan)
                seg[1] += x[: seg.shape[1]] * pan
        t += cd
        k += 1
    ir = _reverb_ir()
    wet = np.stack([oaconvolve(dry[ch], ir[ch])[:n] for ch in range(2)]).astype(np.float32)
    out = 0.55 * dry + 0.6 * wet
    out /= np.max(np.abs(out)) + 1e-9
    return out[:, : int(total * SR)] * 0.9
