"""AFTERGLOW — sound design part (screenplay v2 §3 【声音】 and §6; everything that is not music).

render(tl) -> {stem: full-length stereo float32}. Stems:
  ident  — sound logo "节律收拢" 0.25–2.000, tick granules converging on the first heartbeat (#1)
  heart  — cursor heartbeat lub/dub: lub on the bright frame 24k only, dub = lub + 7 frames, −8 dB
  keys   — script keys, the 16 `universe.init();` keys, enters, heavy enter (ONE sample: f504 and
           f5160), AI answer keys, backspaces, AI question keys
  print  — the program's echo `0` tick (f508) and the S11 terminal prints (the same sample)
  room   — room tone, hairline swish, infrasound, curtain swell (#10–#13)
  cosmos — star-light key granules (from f528), CMB / receiver hiss, decoupling glide (#14, #18, #19)
  air    — long take A: wind from the atmosphere (f1632) through S03, the acacia twig (f1740), dry grass
  fire   — flint ×3 (f1788 / 1812 / 1836), tinder fibres, ignition f1848, the campfire to f2340
  lamps  — S04: one restrained material sound per extinguishing / lighting of each light carrier
  city   — city hum (S04-f → S05, gone before f3000), distant city through the window (S10-a)
  radio  — scattered E6 morse in S05, the receiver hiss of S07 (pulsar deleted in v2)
  words  — word granules (S08, from f3864), the three questions' breathing + the cover "嗒" (S09)

Timing: every event is placed on an integer sample index (frame × 2000 or round(t × 48000)).
Levels: transients are written as dBFS peak per channel, beds as dBFS RMS (screenplay targets for the
pre-normalisation mix). Digital silences (timeline.silences[type=digital]) are exact zeros in every stem.
v2 deletions: the pulsar stem (t_k = 137 + 1.337 k), its tail hiss, the Voyager servo / stop click /
shutter, the 161–169 s heartbeats, the old 237–245 s print ticks.
"""
from __future__ import annotations

import math
import re

import numpy as np

import dsp
import sfx_lib as L
from dsp import SR
from sfx_lib import db, frame_idx, t_idx, place

SEED = 55


def cursor_pan(x):
    """Screenplay §7.1 #2: cursor x mapped to [-1, 1] × 0.4."""
    return (x / 1920.0 * 2 - 1) * 0.4


def F(f):
    return f / 24.0


R_X = 734            # R = (734, 540): the cursor's home
P_ANS_X = 1520       # P_ans = (1520, 540): the answer position (cursor block x 1508–1532)
CELL = 64            # one full-width CJK cell in S09 (64 px)


# =================================================================== ident (#1)
def render_ident(tl, n):
    """#1 sound logo "节律收拢" 0.25 → 2.000 (hard cut on the first heartbeat sample, no tail).
    Key / data-tick transients (press noise of #3/#4, no key body → no pitch), random BP inside
    1–8 kHz; Poisson density 200 → 20 /s, spectrum wide → narrow, interval variance → 0, level and
    timbre variance → 0; the last 0.5 s: remaining ticks at halving intervals (0.25, 0.125, …)
    converging on 2.000 — by then every tick is the identical sample (the machine locks in).
    Under it a machine-room bed (fan-like broadband noise, BP centre random walk, LP 8 k → 800 Hz,
    no mains hum) narrowing and fading. Mono, peak ≤ −30 dBFS."""
    buf = np.zeros((n, 2), np.float32)
    a, z = 0.25, 2.0
    i0, i1 = t_idx(a), t_idx(z)          # 12000, 96000
    m = i1 - i0
    seg = np.zeros((m + SR // 10, 2), np.float32)
    r = dsp.rng(SEED + 1)

    def tick(seed, lo, hi, ms):
        rr = dsp.rng(seed)
        k = max(24, int(ms / 1000 * SR))
        x = np.zeros(k + 480, np.float32)
        x[:k] = rr.standard_normal(k) * L.onset_env(k, 5, k / 3.2)
        y = L.bp(x, lo, hi, 2)
        y = dsp.lowpass(y, min(hi * 1.6, 15000), order=2)
        y = L.fade_out_tail(y, 0.004)
        return (y / (np.abs(y).max() + 1e-12)).astype(np.float32)

    locked = tick(5150, 2400, 4200, 2.2)  # the one tick everything converges to
    t, j = a + 0.004, 0
    u_end = 1.5
    while t < u_end:
        u = (t - a) / (u_end - a)          # 0 → 1
        rate = 200 * (20 / 200) ** u
        v = u ** 1.3                         # variance → 0
        # spectrum wide → narrow: band from 1–8 kHz (3 oct) down to ~0.8 oct around 3.2 kHz
        bw = 3.0 * (1 - v) + 0.8 * v
        ctr = 2 ** (r.uniform(np.log2(1000) + bw / 2, np.log2(8000) - bw / 2)) if bw < 2.99 else 2830
        ctr = ctr ** (1 - v) * 3200 ** v
        lo, hi = ctr / 2 ** (bw / 2), ctr * 2 ** (bw / 2)
        g = tick(6000 + j, lo, hi, r.uniform(1.0, 4.0) * (1 - v) + 2.2 * v)
        L_ = max(len(g), len(locked))
        g = np.pad(g, (0, L_ - len(g))) * (1 - v ** 2) + np.pad(locked, (0, L_ - len(locked))) * (v ** 2)
        amp = math.exp(r.normal(0, 0.55 * (1 - v))) * (0.55 + 0.45 * v)
        place(seg, g * amp, int((t - a) * SR))
        t += (1 - v) * r.exponential(1 / rate) + v * (1 / rate)
        j += 1
    # Zeno pull-in: 1.5, 1.75, 1.875, … → 2.000 (stop when the gap would be < 3 ms)
    gap = 0.5
    tz = z - gap
    while gap >= 0.003:
        place(seg, locked * (0.9 + 0.1 * (gap / 0.5)), t_idx(tz) - i0)
        gap /= 2
        tz = z - gap
    seg = seg[:m, 0]
    seg = L.verb(seg, 'room', 0.12)[:m].mean(axis=1)
    # machine-room bed: broadband pink, BP centre random walk, LP 8 k → 800 Hz, fading & narrowing
    sec = m / SR
    tt = a + np.arange(m) / SR
    u = np.clip((tt - a) / (z - a), 0, 1)
    nz = dsp.pink(sec + 0.2, SEED + 101)[-m:]
    ctr = 1400 * 2 ** (1.2 * L.smooth_noise(m, 2.5, SEED + 102, -1, 1))
    fan = L.swept(nz, ctr, 'bp', order=1, bw_oct=2.5) * 0.6 + nz * 0.4
    fan = L.swept(fan, 8000 * (800 / 8000) ** L.ease_in_out_sine(u), 'lp', order=2)
    fan = dsp.highpass(fan, 70, order=2)
    fan = L.follow_unit(fan, 0.15)
    fan *= 1 + 0.12 * L.smooth_noise(m, 9.0, SEED + 103, -1, 1)  # airflow turbulence, unpitched
    fan_lvl = np.interp(tt, [a, a + 0.12, 0.9, 1.6, 2.0], [-90, -50, -53, -60, -66])
    out = seg * db(-30) + fan * db(fan_lvl)
    out[:int(0.004 * SR)] *= L.raised_ramp(int(0.004 * SR))
    pk = np.abs(out).max()
    if pk > db(-30):
        out *= db(-30) / pk
    buf[i0:i1] = np.stack([out, out], axis=1)  # mono; ends on sample 95999: the heartbeat owns 96000
    return buf


# =================================================================== heart
def _move_x(f):
    """S09-f: the cursor glides from P_ans to R over [4992, 5040), easeInOutSine."""
    u = float(np.clip((f - 4992) / 48.0, 0, 1))
    return P_ANS_X + (R_X - P_ANS_X) * (0.5 - 0.5 * math.cos(math.pi * u))


# (lub frame, lub dBFS, cursor x or None for the mono interface). Screenplay v2 §0 / §5.1 rule 4 /
# timeline-v2 §3.2.2: 34 lubs, only on bright frames 24k; f432 cancelled (typing); S08 has none;
# f4680 new (−36, under the D-major chord); f4920/4944/4968 muted (Z6); f4992, f5016 while the
# cursor moves (the one exception: steady cursor with a heartbeat); S11 nine beats at −30.
HEARTBEATS = (
    [(f, -30.0, None) for f in (48, 72, 96, 120, 264, 288, 312, 336, 360, 384, 408, 480)]
    + [(f, -32.0, P_ANS_X) for f in (4584, 4608, 4632)]
    + [(f, -36.0, P_ANS_X + 3 * CELL) for f in (4680, 4704, 4728, 4752)]
    + [(f, -32.0, P_ANS_X + 3 * CELL) for f in (4776, 4800, 4824)]
    + [(f, -38.0, _move_x(f)) for f in (4992, 5016)]
    + [(5136, -38.0, R_X + 4 * CELL)]
    + [(f, -30.0, None) for f in (5640, 5664, 5688, 5832, 5880, 5904, 5928, 5952, 5976)])
DUB_DB = -8.0


def heartbeat_schedule(tl):
    """[(lub frame, lub dB, cursor x)], cross-checked against timeline.sfx heartbeat_* entries
    (a `frames` list, or the v1 rule string "lub 于帧 …" / "lub 于 <seconds>")."""
    ev = list(HEARTBEATS)
    for f, _, _ in ev:
        assert f % 24 == 0, f'heartbeat off the beat: f{f}'
    want = set()
    for s in tl.get('sfx', []):
        if not s.get('id', '').startswith('heartbeat_'):
            continue
        if 'frames' in s:
            want.update(int(f) for f in s['frames'])
            continue
        m = re.search(r'lub 于(帧)?\s*([0-9,，\s（）()−\-dB压在和弦下埋合唱.]+)', s.get('desc', ''))
        if not m:
            continue
        nums = re.findall(r'(?<![−\-\d])(\d+(?:\.\d+)?)(?!\s*dB)', re.sub(r'[（(][^）)]*[）)]', '', m.group(2)))
        for v in nums:
            want.add(int(round(float(v))) if m.group(1) else int(round(float(v) * 24)))
    have = {f for f, _, _ in ev}
    if want and want != have:
        print('[sfx] WARNING heartbeat schedule differs from timeline (frames):', sorted(want ^ have))
    return ev


def render_heart(tl, n):
    buf = np.zeros((n, 2), np.float32)
    lub = L.peak_to(L.heart_lub(), 0.0)
    dub = L.peak_to(L.heart_dub(), 0.0)
    r = dsp.rng(SEED + 2)
    dub_off = (tl.get('anchors', {}).get('heartbeat', {}).get('dubOffsetFrames', 7)) * 2000
    assert dub_off == 7 * 2000, 'dub must be lub + 7 frames'
    for f, lvl, x in heartbeat_schedule(tl):
        g = db(lvl + r.uniform(-0.5, 0.5))          # the timbre may vary ±0.5 dB, never more
        p = None if x is None else cursor_pan(x)
        i = frame_idx(f)
        place(buf, lub, i, g, p)
        place(buf, dub, i + dub_off, g * db(DUB_DB), p)
    return buf


# =================================================================== keys
def soft_key(seed, var=True, latin=False, space=False, r=None):
    """#3 script key: 5 ms noise BP 1.5–4 kHz + 140–180 Hz body 20 ms + lift 40 ms (−12 dB)."""
    r = r or dsp.rng(seed)
    pitch = 1 + (r.uniform(-0.05, 0.05) if var else 0)
    body = r.uniform(140, 180) if var else 160
    kw = dict(seed=seed, body_hz=body, body_ms=20, press_ms=5, press_bp=(1500, 4000), lift_ms=40, lift_db=-12, pitch=pitch)
    if latin:
        kw.update(body_ms=13, press_ms=3.5, lift_ms=30, lift_db=-14)
    if space:
        kw.update(body_hz=body * 0.78, body_ms=26, press_bp=(900, 3200), extra_clicks=((3.0, 0.35, 1500, 5000),), felt=0.5)
    return L.keystroke(**kw), pitch


# `universe.init();` (screenplay S01-d): "universe." nine light keys (−27 dB), "init();" seven heavy
# keys (−24 dB), `;` the heaviest. Mono-spaced keys: 120 Hz body 30 ms.
CMD_KEYS = [(430, 'u'), (432, 'n'), (435, 'i'), (437, 'v'), (440, 'e'), (442, 'r'), (445, 's'), (447, 'e'), (450, '.'),
            (454, 'i'), (458, 'n'), (462, 'i'), (466, 't'), (469, '('), (471, ')'), (474, ';')]
ANSWER_KEYS = [(4656, P_ANS_X), (4664, P_ANS_X + CELL), (4672, P_ANS_X + 2 * CELL)]          # 我 在 。
BACKSPACES = [(4848, P_ANS_X + 2 * CELL), (4872, P_ANS_X + CELL), (4896, P_ANS_X)]           # 。 在 我
QUESTION_KEYS = [(5040, R_X), (5064, R_X + CELL), (5088, R_X + 2 * CELL), (5112, R_X + 3 * CELL)]   # 有 人 吗 ？
HEAVY_ENTERS = (504, 5160)
ECHO_FRAME = 508
PRINT_FRAMES = (5712, 5736, 5760, 5784, 5808, 5856)


def cmd_key(seed, ch, heavy):
    x = L.keystroke(seed=seed, body_hz=120 * (1.04 if not heavy else 0.97), body_ms=30 if heavy else 26,
                    press_ms=5, press_bp=(1100, 3500), lift_ms=48 if heavy else 40, lift_db=-12,
                    felt=0.55 if heavy else 0.45)
    lvl = -24.0 if heavy else -27.0
    if ch == ';':
        lvl = -22.5
    elif ch == '.':
        lvl = -27.5
    return L.with_room(L.peak_to(x, lvl))


def render_keys(tl, n):
    buf = np.zeros((n, 2), np.float32)
    r = dsp.rng(SEED + 3)
    # --- #3 Chinese script line (12 soft "da"), −26 dB ±2 dB
    zh = [132, 136, 140, 144, 152, 156, 160, 164, 168, 172, 176, 182]
    for k, f in enumerate(zh):
        x, _ = soft_key(300 + k, r=r)
        place(buf, L.with_room(L.peak_to(x, -26 + r.uniform(-2, 2))), frame_idx(f))

    # --- #8 soft enters (f190, f252), −22 dB
    def enter_soft(seed):
        return L.keystroke(seed=seed, body_hz=90, body_ms=50, press_ms=4, press_bp=(1000, 3000), lift_ms=95,
                           lift_db=-11, felt=0.5, extra_clicks=((1.5, 0.6, 1000, 3000), (6.0, 0.35, 1000, 3000), (10.0, 0.2, 1200, 3200)))
    for k, f in enumerate((190, 252)):
        place(buf, L.with_room(L.peak_to(enter_soft(400 + k), -22)), frame_idx(f))
    # --- Latin line: 29 lighter, shorter keys, −29 dB (i-th char at 198 + ⌊1.5 i⌋, +4 after the comma)
    line = 'In the dark, a cursor blinks.'
    comma = line.index(',')
    for i, ch in enumerate(line):
        f = 198 + math.floor(1.5 * i) + (4 if i > comma else 0)
        x, _ = soft_key(500 + i, latin=True, space=(ch == ' '), r=r)
        place(buf, L.with_room(L.peak_to(x, -29 + r.uniform(-2, 2) - (1.0 if ch == ' ' else 0))), frame_idx(f))
    # --- #4 the command `universe.init();` — 16 keys, variable speed (v2 S01-d)
    for k, (f, ch) in enumerate(CMD_KEYS):
        place(buf, cmd_key(600 + k, ch, heavy=(k >= 9)), frame_idx(f))
    # --- #9 heavy enter: ONE sample, used at f504 and f5160, −16 dBFS
    heavy = heavy_enter()
    for f in HEAVY_ENTERS:
        place(buf, heavy, frame_idx(f))
    # --- #5 AI answer keys at P_ans: light, fast, every one identical, −26 dB
    ans = L.with_room(L.peak_to(L.keystroke(seed=700, body_hz=200, body_ms=12, press_ms=3.5, press_bp=(1800, 4500),
                                            lift_ms=26, lift_db=-14, felt=0.25), -26))
    for f, x in ANSWER_KEYS:
        place(buf, ans, frame_idx(f), pan=cursor_pan(x))
    # --- #7 backspaces: the AI key pitched −15 %, lift held to 70 ms (the finger stayed), −27 dB
    bsp = L.with_room(L.peak_to(L.keystroke(seed=700, body_hz=200, body_ms=12, press_ms=3.5, press_bp=(1800, 4500),
                                            lift_ms=70, lift_db=-12, felt=0.25, pitch=0.85), -27))
    for f, x in BACKSPACES:
        place(buf, bsp, frame_idx(f), pan=cursor_pan(x))
    # --- #6 AI question keys at R (v2: f5040 / 5064 / 5088 / 5112): #3 with a human hand (vel ±3 dB,
    #     BP ±15 %, lift 50–90 ms, finger noise ending exactly on the press), strictly on the beat
    rq = dsp.rng(SEED + 6)
    for k, (f, x_) in enumerate(QUESTION_KEYS):
        c = rq.uniform(-0.15, 0.15)
        x = L.keystroke(seed=800 + k, body_hz=rq.uniform(140, 180), body_ms=20, press_ms=5,
                        press_bp=(1500 * (1 + c), 4000 * (1 + c)), lift_ms=rq.uniform(50, 90), lift_db=-12,
                        pitch=1 + rq.uniform(-0.05, 0.05), felt=0.4)
        x = L.with_room(L.peak_to(x, -26 + rq.uniform(-3, 3)))
        i = frame_idx(f)
        fn = L.peak_to(L.finger_noise(900 + k), -50)
        place(buf, fn, i - len(fn), pan=cursor_pan(x_))  # ends exactly on the press
        place(buf, x, i, pan=cursor_pan(x_))
    return buf


def heavy_enter():
    """70 Hz body 120 ms + 110 Hz 2nd-order resonance (Q6) "dong" + long click; −16 dBFS peak."""
    x = L.keystroke(seed=1001, body_hz=70, body_ms=120, press_ms=6, press_bp=(900, 3800), lift_ms=185,
                    lift_db=-10, felt=0.7, soft_lp=5500, body2=(110, 6, 0.8),
                    extra_clicks=((2.0, 0.7, 1000, 4000), (5.5, 0.5, 1200, 4200), (9.5, 0.38, 1000, 3800),
                                  (14.0, 0.26, 1300, 4000), (20.0, 0.16, 1100, 3600), (27.0, 0.1, 1200, 3400)),
                    tail=0.16)
    x = L.with_room(x, wet=0.2)
    return L.peak_to(x, -16)


# =================================================================== print (echo `0` + terminal prints)
def render_print(tl, n):
    """f508 the program's echo `0`; S11-e every printed paragraph — the same tick, −48 dB peak."""
    buf = np.zeros((n, 2), np.float32)
    tick = L.peak_to(L.echo_tick(), -48)
    for f in (ECHO_FRAME,) + PRINT_FRAMES:
        place(buf, tick, frame_idx(f))
    return buf


# =================================================================== room
def render_room(tl, n):
    buf = np.zeros((n, 2), np.float32)
    # --- #10 room tone (prologue): brown LP 200 Hz, −58 dBFS; 13.0 +6 dB & brighter; 21.0–22.0 fade out
    a, b = 2.0, 22.0
    sec = b - a
    base = dsp.lowpass(dsp.brown(sec, SEED + 10), 200, order=4)
    bright = dsp.lowpass(dsp.brown(sec, SEED + 11), 520, order=2)
    base = L.rms_to(base, 0); bright = L.rms_to(bright, 0)
    m = len(base)
    tt = a + np.arange(m) / SR
    u = np.clip((tt - 13.0) / 0.5, 0, 1)
    u = L.ease_in_out_sine(u)
    room = base * (1 - u) + (0.6 * base + 0.8 * bright) * u
    gain = db(-58 + 6 * u) * np.clip((22.0 - tt) / 1.0, 0, 1) ** 1.5
    room = room * gain
    room[:96] *= np.linspace(0.05, 1, 96)  # 2 ms entry right under the ident's hard cut
    place(buf, room.astype(np.float32), t_idx(a))
    # --- #10 room tone (coda): 235.0 (fade in with the letterbox) → 249.5 hard cut
    a2, b2 = 235.0, 249.5
    rt = L.rms_to(dsp.lowpass(dsp.brown(b2 - a2, SEED + 12), 200, order=4), -58)
    rt = L.fade_edges(rt, fin=1.0)
    place(buf, rt, t_idx(a2))  # ends exactly at the 249.5 sample (hard cut)
    # --- #11 hairline swish (f36, 11 frames): HP 6 kHz white, easeOutCubic "draw" profile, −50 dB
    k = 11 * 2000
    u = np.arange(k) / k
    env = (np.minimum(1, (np.arange(k) + 1) / 240) * (1 - u) ** 2).astype(np.float32)
    sw = dsp.highpass(dsp.white(k / SR + 0.01, SEED + 13), 6000, order=4)[-k:] * env
    place(buf, L.rms_to(sw, -54), frame_idx(36))
    # --- #12 infrasound "motion" 11.0 → 21.0: 30 Hz sine, −48 dB, fades in; #13 curtain 21–23 continues it
    a3, b3 = 11.0, 24.0
    m = int((b3 - a3) * SR)
    tt = a3 + np.arange(m) / SR
    ucur = L.ease_in_out_cubic((tt - 21.0) / 2.0)
    f = 30 + 15 * ucur
    ph = np.cumsum(f) / SR
    lvl = np.interp(tt, [11.0, 14.0, 21.0, 22.5, 23.0, 24.0], [-90, -48, -48, -40, -40, -44])
    sub = np.sin(2 * np.pi * ph) * db(lvl) * np.sqrt(2)
    sub[tt < 11.0] = 0
    place(buf, sub.astype(np.float32), t_idx(a3))
    # curtain noise swell: LP 300 Hz → 4 kHz (same inOutCubic as the letterbox), up to ~−34 dB RMS
    a4 = 21.0
    m = int(3.0 * SR)
    tt = a4 + np.arange(m) / SR
    uc = L.ease_in_out_cubic((tt - 21.0) / 2.0)
    nz = L.pink_st(3.0, SEED + 14, corr=0.3)
    nz = L.swept(nz, 300 * (4000 / 300) ** uc, 'lp', order=2)
    nz = L.follow_unit(nz, 0.2)
    lvl = np.interp(tt, [21.0, 21.15, 22.0, 23.0, 23.6, 24.0], [-75, -52, -42, -34, -36, -38])
    place(buf, (nz * db(lvl)[:, None]).astype(np.float32), t_idx(a4))  # hard cut at 24.000
    # reverse curtain 235.0–236.0 (letterbox opens): LP 4 kHz → 300 Hz settle, 45 → 30 Hz, quiet
    m = int(1.6 * SR)
    tt = np.arange(m) / SR
    uc = L.ease_in_out_cubic(tt / 1.0)
    nz = L.swept(L.pink_st(1.6, SEED + 15, corr=0.3), 4000 * (300 / 4000) ** uc, 'lp', order=2)
    nz = L.follow_unit(nz, 0.2)
    lvl = np.interp(tt, [0, 0.12, 0.6, 1.0, 1.6], [-80, -46, -48, -56, -90])
    sub = np.sin(2 * np.pi * np.cumsum(45 - 15 * uc) / SR) * db(np.interp(tt, [0, 0.2, 1.0, 1.6], [-90, -50, -56, -95])) * np.sqrt(2)
    cur = nz * db(lvl)[:, None] + sub[:, None]
    place(buf, L.fade_edges(cur.astype(np.float32), 0.01, 0.2), t_idx(235.0))
    return buf


# =================================================================== cosmos
def render_cosmos(tl, n):
    buf = np.zeros((n, 2), np.float32)
    # --- #14 star-light key granules f528 (22.0) → f576 (24.0): key transients pitched +24..36 st,
    #     200 grains/s, 5–20 ms Hann, random pan that spirals into R during the collapse; −34 dB;
    #     hard cut 24.000 (v2: starts with the words turning into stars, after the echo `0`)
    r = dsp.rng(SEED + 14)
    src = [soft_key(1400 + k, r=r)[0] for k in range(16)]
    a, end = F(528), F(576)
    t = a
    grains = np.zeros((int((end - a) * SR) + SR, 2), np.float32)
    first = True
    while True:
        t = a if first else t + r.exponential(1 / 200)
        first = False
        if t >= end:
            break
        ratio = 2 ** (r.uniform(24, 36) / 12)
        g = L.pitch_up(src[r.integers(len(src))], ratio)
        ms = r.uniform(5, 20)
        k = min(len(g), int(ms / 1000 * SR))
        g = g[:k] * L.hann(k)
        collapse = float(np.clip((t - 22.5) / 1.5, 0, 1)) ** 2
        spread = 0.85 * (1 - collapse) + 0.05
        p = (1 - collapse) * r.uniform(-spread, spread) + collapse * cursor_pan(R_X)
        amp = math.exp(r.normal(0, 0.45))
        place(grains, g * amp, int(round((t - a) * SR)), 1.0, p)
    grains = grains[:int((end - a) * SR)]
    tt = a + np.arange(len(grains)) / SR
    lvl = np.interp(tt, [22.0, 22.25, 22.5, 23.0, 23.95, 24.0], [-46, -38, -34, -33, -31, -31])
    gn = L.peak_pct_to(grains, 0.0, 99.9, slice(int(0.5 * SR), int(1.5 * SR)))
    gn = L.smooth_limit(gn * db(lvl + 6.0)[:, None], -24.0)  # +6: the spec level as the grains' typical peak
    place(buf, gn.astype(np.float32), frame_idx(528))
    # --- #18 CMB hiss f608 → 37: decorrelated pink, LP 18k → 12k(27) → 3k(30), 30.0 dives to
    #     1.2 kHz then slides to 300 Hz (35); −26 → −34(31) → −52(35) → −62(37), gone
    a, b = F(608), 37.6
    m = int((b - a) * SR)
    tt = a + np.arange(m) / SR
    lf = np.log(18000) + (np.log(12000) - np.log(18000)) * np.clip((tt - a) / (27 - a), 0, 1)
    lf = np.where(tt >= 27, np.log(12000) + (np.log(3000) - np.log(12000)) * np.clip((tt - 27) / 3, 0, 1), lf)
    dive = np.log(3000) + (np.log(1200) - np.log(3000)) * (1 - np.exp(-np.clip(tt - 30, 0, None) / 0.06))
    slide = np.log(1200) + (np.log(300) - np.log(1200)) * L.ease_in_out_sine((tt - 30.25) / (35 - 30.25))
    lf = np.where(tt >= 30, np.where(tt < 30.25, dive, slide), lf)
    hiss = L.swept(L.pink_st(b - a, SEED + 18), np.exp(lf), 'lp', order=2)
    hiss = dsp.highpass(hiss, 40, order=2)
    hiss = L.follow_unit(hiss, 0.3)
    lvl = np.interp(tt, [a, a + 0.25, 27.0, 31.0, 35.0, 37.0, 37.6], [-70, -26, -28, -34, -52, -62, -95])
    place(buf, (hiss * db(lvl)[:, None]).astype(np.float32), frame_idx(608))
    # --- #19 decoupling glide f720 (30.0): sine 60 → 40 Hz, −30 dB, 1.5 s
    m = int(1.5 * SR)
    tt = np.arange(m) / SR
    f = 40 + 20 * np.exp(-tt / 0.45)
    env = np.minimum(1, (np.arange(m) + 1) / (0.03 * SR)) * (0.5 + 0.5 * np.cos(np.pi * tt / 1.5)) ** 1.2
    gl = np.sin(2 * np.pi * np.cumsum(f) / SR + 0.3) * env
    place(buf, L.peak_to(gl.astype(np.float32), -30), frame_idx(720))
    # --- #18 CMB hiss return f5592 (233.0) → out before f5652 (235.5): LP 600 Hz, −54 dB
    a = F(5592)
    h = L.follow_unit(dsp.lowpass(L.pink_st(2.5, SEED + 19), 600, order=2), 0.3)
    tt = a + np.arange(len(h)) / SR
    lvl = np.interp(tt, [233.0, 233.8, 234.4, 235.4, 235.5], [-90, -54, -54, -95, -120])
    place(buf, (h * db(lvl)[:, None]).astype(np.float32), frame_idx(5592))
    return buf


# =================================================================== air (long take A → S03)
def render_air(tl, n):
    """S02-f: wind only once we are inside the atmosphere (f1632 → cloud f1680–1704 → below), then the
    near sounds: the acacia twig f1740 (−46), dry grass from f1746 (−48); S03: night wind (−42 at the
    fire, −38 when we look up and in the wide shot) until the f2280 match cut. No "passing through"
    whoosh anywhere (screenplay S02 rule: the universe makes no sound; S02-f)."""
    buf = np.zeros((n, 2), np.float32)
    # --- wind: pink BP 200–800 Hz, slowly drifting centre, decorrelated L/R
    a, b = F(1632), F(2280) + 0.25
    sec = b - a
    m = int(sec * SR)
    tt = a + np.arange(m) / SR
    ctr = np.clip(400 * 2 ** (0.9 * L.smooth_noise(m, 0.12, SEED + 25, -1, 1)), 280, 600)
    wl = L.swept(dsp.pink(sec, SEED + 26), ctr, 'bp', order=2, bw_oct=1.2)
    ctr2 = np.clip(400 * 2 ** (0.9 * L.smooth_noise(m, 0.12, SEED + 27, -1, 1)), 280, 600)
    wr = L.swept(dsp.pink(sec, SEED + 28), ctr2, 'bp', order=2, bw_oct=1.2)
    wind = L.follow_unit(np.stack([wl, wr], axis=1), 0.5)
    gust = 0.7 + 0.3 * L.smooth_noise(m, 0.08, SEED + 29, -1, 1)
    pts_t = [F(1632), F(1646), F(1680), F(1690), F(1704), F(1716), F(1968), F(2016), F(2280), F(2284)]
    pts_v = [-90, -60, -40, -38, -38, -42, -42, -38, -38, -110]
    lvl = np.interp(tt, pts_t, pts_v)
    wind = wind * (db(lvl) * gust / np.sqrt(np.mean(gust ** 2)))[:, None]
    wind[tt >= F(2284)] = 0.0
    place(buf, wind.astype(np.float32), frame_idx(1632))
    # --- f1740 the acacia twig sweeps the frame left → right: a dry brush, −46 dB peak
    tw = L.leaf_sweep(0.30, SEED + 1740)
    place(buf, L.peak_to(L.verb(tw, 'outdoor', 0.1)[:len(tw) + SR // 4], -46), frame_idx(1740))
    # --- dry grass rustle from f1746 (−48 dB RMS), slightly stronger as the grass blade crosses R
    #     (f1756–1762), then it sinks under the fire after f1848
    a, b = F(1746), F(1920)
    gr = L.grass_rustle(b - a, SEED + 1746)
    tt = a + np.arange(len(gr)) / SR
    lvl = np.interp(tt, [a, a + 0.25, F(1756), F(1759), F(1766), F(1848), F(1900), b], [-90, -48, -48, -45, -48, -48, -58, -100])
    gr = L.smooth_limit(L.rms_to(gr, 0) * db(lvl)[:, None], -40.0)   # crisp, never a crackle
    place(buf, gr.astype(np.float32), frame_idx(1746))
    return buf


# =================================================================== fire
def flint(seed, gain_db, tinder=False):
    """Two 3 ms noise bursts BP 2–8 kHz 6 ms apart + 3.1/4.7/6.2 kHz inharmonic ring (40 ms)."""
    r = dsp.rng(seed)
    n = int(0.6 * SR if tinder else 0.25 * SR)
    t = np.arange(n) / SR
    x = np.zeros(n, np.float32)
    k = int(0.003 * SR)
    for j, off in enumerate((0, int(0.006 * SR))):
        nz = np.zeros(n, np.float32)
        nz[off:off + k] = r.standard_normal(k) * L.onset_env(k, 3, k / 3)
        x += L.bp(nz, 2000, 8000, 2) * (1.0 if j == 0 else 0.7)
    x /= np.abs(x).max()
    ring = np.zeros(n)
    for f, a in ((3100, 1.0), (4700, 0.7), (6200, 0.5)):
        ring += a * np.sin(2 * np.pi * f * (1 + r.uniform(-0.01, 0.01)) * t + r.uniform(0, 6.28))
    ring *= L.onset_env(n, 30, 0.040 * SR / 4)
    x = x + 0.35 * ring.astype(np.float32)
    # sparks: tiny ticks scattered over 150 ms
    for _ in range(r.integers(6, 12)):
        i = int(r.uniform(0.01, 0.16) * SR)
        kk = int(0.0006 * SR)
        s = np.zeros(n, np.float32)
        s[i:i + kk] = r.standard_normal(kk)
        x += L.bp(s, 4000, 12000, 2) * r.uniform(0.02, 0.06)
    if tinder:  # the tinder starts to hiss and glow
        hz = L.bp(dsp.white(n / SR, seed + 1), 2500, 9000, 2)
        env = np.clip((t - 0.05) / 0.25, 0, 1) * np.exp(-np.clip(t - 0.3, 0, None) / 0.25)
        x += hz * env * 0.012
    return L.peak_to(L.fade_out_tail(x, 0.02), gain_db)


def campfire(sec, seed):
    """#24: Poisson crackle 8–20 /s in clusters (1–4 ms BP 1–6 kHz), ~1/s big pop with a 20 ms
    300–600 Hz resonance, brown LP 300 Hz flame bed with slow breathing, HP 5 kHz hiss. Stereo, narrow.
    Returns (stereo, ref_peak) — not yet levelled."""
    r = dsp.rng(seed)
    n = int(sec * SR)
    out = np.zeros((n + SR, 2), np.float32)
    bands = [(1000, 1800), (1400, 2600), (2000, 3600), (2800, 4800), (3600, 6000)]
    bank = L.NoiseBank(bands, 2.0, seed + 10)
    rate_mod = (L.smooth_noise(n, 0.35, seed + 1, 0, 1) + 1) / 2  # 0..1
    grow = np.clip(np.arange(n) / (2.5 * SR), 0, 1) ** 1.5  # tinder → flame over 2.5 s
    t = 0.0
    while t < sec:
        i = int(t * SR)
        rate = (8 + 12 * float(np.clip(rate_mod[min(i, n - 1)], 0, 1))) * (0.25 + 0.75 * grow[min(i, n - 1)])
        t += r.exponential(1 / rate)
        if t >= sec:
            break
        burst = 1 + (r.integers(1, 5) if r.random() < 0.35 else 0)
        tt = t
        for _ in range(burst):
            k = int(r.uniform(0.001, 0.004) * SR)
            g = bank.grain(int(r.integers(len(bands))), k, r) * L.onset_env(k, 2, k / 3.5)
            amp = math.exp(r.normal(0, 0.6)) * 0.35
            place(out, g * amp, int(tt * SR), 1.0, r.uniform(-0.25, 0.25))
            tt += r.uniform(0.004, 0.035)
    # big pops (~1 /s)
    t = r.uniform(0.6, 1.2)
    while t < sec:
        k = int(0.03 * SR)
        f = r.uniform(300, 600)
        tk = np.arange(k) / SR
        res = np.sin(2 * np.pi * f * tk) * L.onset_env(k, 3, 0.020 * SR / 4)
        cl = np.zeros(k, np.float32)
        kc = int(0.002 * SR)
        cl[:kc] = r.standard_normal(kc) * L.onset_env(kc, 2, kc / 3)
        cl = L.bp(cl, 900, 7000, 2)
        pop = cl / (np.abs(cl).max() + 1e-9) + 0.55 * res
        a = (0.9 + 0.4 * r.random()) * (0.3 + 0.7 * grow[min(int(t * SR), n - 1)])
        place(out, pop.astype(np.float32) * a, int(t * SR), 1.0, r.uniform(-0.2, 0.2))
        for _ in range(r.integers(2, 6)):  # embers spit after the pop
            k2 = int(r.uniform(0.001, 0.003) * SR)
            g = bank.grain(int(r.integers(2, len(bands))), k2, r) * L.onset_env(k2, 2, k2 / 3)
            place(out, g * 0.2 * math.exp(r.normal(0, 0.5)), int((t + r.uniform(0.01, 0.12)) * SR), 1.0, r.uniform(-0.25, 0.25))
        t += r.exponential(1.0) * 0.7 + 0.35
    out = out[:n]
    pk = float(np.percentile(np.abs(out[out != 0]), 99.5)) if np.any(out) else 1.0
    # flame bed: brown LP 300 Hz with slow breathing (0.3–0.7 Hz, like the embers' glow)
    bed = dsp.lowpass(L.brown_st(sec, seed + 20), 300, order=2)
    bed = L.follow_unit(bed, 0.5)
    breath = 0.65 + 0.35 * L.smooth_noise(n, 0.5, seed + 21, -1, 1)
    bed = bed * (breath * grow)[:, None]
    bed = bed * pk * db(-13)
    hiss = dsp.highpass(L.pink_st(sec, seed + 22), 5000, order=2)
    hiss = L.rms_to(hiss, 0) * pk * db(-28) * grow[:, None]
    mix = out + bed + hiss
    m = mix.mean(axis=1, keepdims=True)
    mix = m + (mix - m) * 0.6  # narrow
    return mix.astype(np.float32), pk


def render_fire(tl, n):
    buf = np.zeros((n, 2), np.float32)
    stones = cursor_pan(250)            # the two stone tips at the left frame edge (x 120–380)
    # --- #22 flint ×3 on the off-beats f1788 / 1812 / 1836, −24 dB (the 2nd a little stronger)
    for k, (f, g) in enumerate(((1788, -24.0), (1812, -22.5), (1836, -23.5))):
        x = flint(2200 + k, 0.0, tinder=False)
        x = L.peak_to(L.trim_tail(L.verb(L.pan_c(x, stones), 'outdoor', 0.12)), g)
        place(buf, x, frame_idx(f))
    # --- f1836–1847 the tinder fibres: a faint hiss and fine ticks (HP 4 kHz, −46 dB), into the flame
    a = F(1836)
    m = int(0.75 * SR)
    tt = np.arange(m) / SR
    r = dsp.rng(SEED + 1836)
    hz = dsp.highpass(r.standard_normal(m).astype(np.float32), 4000, order=4)
    for _ in range(14):
        i = int(r.uniform(0.02, 0.5) * SR)
        k = int(0.0006 * SR)
        hz[i:i + k] += r.standard_normal(k) * 6.0
    hz = dsp.highpass(hz, 4000, order=2)
    env = L.ease_in_out_sine(tt / 0.12) * (1 - L.ease_in_out_sine((tt - 0.5) / 0.25))
    hz = hz / (np.sqrt(np.mean(hz[:int(0.5 * SR)] ** 2)) + 1e-12) * env * db(-46)
    place(buf, L.pan_c(hz.astype(np.float32), cursor_pan(R_X)), frame_idx(1836))
    # --- #23 ignition f1848 (77.0): "whoomph", noise LP 200 → 1200 Hz over 0.4 s, −20 dB
    m = int(0.9 * SR)
    tt = np.arange(m) / SR
    fc = 200 * (1200 / 200) ** np.clip(tt / 0.4, 0, 1)
    wh = L.swept(L.pink_st(0.9, SEED + 23, corr=0.6), fc, 'lp', order=2)
    env = np.minimum(1, (np.arange(m) + 1) / (0.09 * SR)) ** 1.5 * np.exp(-np.clip(tt - 0.12, 0, None) / 0.22)
    wh = wh * env[:, None]
    place(buf, L.peak_to(L.fade_out_tail(wh, 0.05), -20), frame_idx(1848))
    # --- #24 the campfire f1848 → f2340: near −22 (S03-a, at R) → f1968 crane up: LP 8 k → 1.5 k,
    #     −10 dB → f2112 cut to the wide shot: distant −40 (C) → f2280 match cut to the close-up:
    #     near −24 → f2340 the flames slump: crackle stops over 5 frames
    a, b = F(1848), F(2346)
    fire, pk = campfire(b - a, SEED + 24)
    fire = fire / pk * db(-22)
    fire = L.verb(fire, 'room', 0.18)[:len(fire)]
    m = len(fire)
    tt = a + np.arange(m) / SR
    u = L.ease_in_out_sine((tt - F(1968)) / 6.0)
    fc = np.where(tt < F(1968), 18000, 8000 * (1500 / 8000) ** u)
    near = L.swept(fire, fc, 'lp', order=2) * db(-10 * u)[:, None]
    far = L.verb(dsp.lowpass(fire, 1200, order=2), 'outdoor', 0.45)[:m]
    far = L.pan_c(far.mean(axis=1), 0.0) * db(-18)
    close = fire * db(-2.0)
    xf = 96   # 2 ms crossfades on the picture cuts
    w_far = np.clip((tt - F(2112)) * SR / xf, 0, 1) * (tt < F(2280))
    w_close = np.clip((tt - F(2280)) * SR / xf, 0, 1)
    w_near = 1 - np.clip((tt - F(2112)) * SR / xf, 0, 1)
    out = near * w_near[:, None] + far * w_far[:, None] + close * w_close[:, None]
    out *= (1 - L.ease_in_out_sine((tt - F(2340)) / F(5)))[:, None]
    out[tt >= F(2345)] = 0.0
    place(buf, L.smooth_limit(out.astype(np.float32), -19.0), frame_idx(1848))
    return buf


# =================================================================== lamps (S04 light carriers)
def render_lamps(tl, n):
    """Screenplay S04-a…e: each extinguishing and each lighting has its own restrained material sound —
    never one shared transition effect. All at the fixed light centre C (centre pan), R_room."""
    buf = np.zeros((n, 2), np.float32)

    def put(x, f, lvl, rms=False, wet=0.12):
        y = L.verb(x, 'room', wet)
        y = L.trim_tail(y)
        y = L.rms_to(y, lvl) if rms else (y * (db(lvl) / (np.abs(y).max() + 1e-12))).astype(np.float32)
        place(buf, y, frame_idx(f))

    # S04-a campfire → candle: f2340 the fire slumps — "沙" (LP 800 Hz, −34)
    put(L.ember_collapse(SEED + 2340), 2340, -34)
    # S04-b candle: f2352 the wick catches — "噗" (−38) + a small low bump (−40)
    puff, bump = L.wick_puff(SEED + 2352)
    put(puff, 2352, -38)
    put(bump, 2352, -40, wet=0.05)
    # f2412 the flame gutters: two very fine wax pops (−42) and a thread of smoke (−50)
    put(L.wax_pop(SEED + 2412), 2412, -42)
    put(L.wax_pop(SEED + 2415), 2415, -43)
    put(L.smoke_hiss(0.29, SEED + 2413), 2416, -50, rms=True, wet=0.05)   # after the 2nd pop, gone inside the dark gap (before f2424)
    # S04-c lantern: f2424 the chimney seats (−34), then the oil wick takes (−36) as it lights left → right
    put(L.glass_seat(SEED + 2424), 2424, -34)
    put(L.oil_pom(SEED + 2427), 2427, -36, wet=0.08)
    # f2484 the wick is wound down: three dry ratchet clicks 30 ms apart (−38)
    put(L.ratchet(SEED + 2484), 2484, -38)
    # S04-d incandescent: f2496 switch (−30) + filament current hum rising over 10 frames (−52) +
    # a glass "叮" when it is fully bright (f2506, −46); f2556 the SAME switch; f2562 cooling tick (−48)
    sw = L.switch_click(SEED + 2496)
    put(sw, 2496, -30)
    put(sw, 2556, -30)
    hum = L.filament_hum(F(2566 - 2496), F(10), F(2556 - 2496), F(5), SEED + 2497)
    place(buf, L.pan_c(hum * db(-52), 0.0), frame_idx(2496))
    put(L.glass_ting(SEED + 2506), 2506, -46, wet=0.2)
    put(L.cool_tick(SEED + 2562), 2562, -48)
    # S04-e modern lamp: f2568 one clean electronic "嗒" (4 kHz, 5 ms, −40), no hum at all
    put(L.elec_tick(), 2568, -40, wet=0.06)
    return buf


# =================================================================== city
def render_city(tl, n):
    buf = np.zeros((n, 2), np.float32)
    # --- #26 city hum f2664 (111.0, S04-f) → S05: pink BP 200–2000 Hz, 0.1–0.5 Hz undulation,
    #     50/100/150 Hz mains, sparse distant short tones; −44 → −30 (f2924); f2928 drops to −42 with
    #     the cut, then recedes with the beam's distance and is gone before f3000
    a, b = F(2664), F(3000)
    sec = b - a
    m = int(sec * SR)
    tt = a + np.arange(m) / SR
    bed = L.bp(L.pink_st(sec, SEED + 26, corr=0.2), 200, 2000, 2)
    bed = L.follow_unit(bed, 0.6)
    und = 1 + 0.18 * L.smooth_noise(m, 0.3, SEED + 31, -1, 1) + 0.12 * L.smooth_noise(m, 0.1, SEED + 32, -1, 1)
    bed = bed * und[:, None]
    t_cut = F(2928)
    u = np.clip((tt - a) / (F(2924) - a), 0, 1)
    lvl = -44 + 14 * u ** 1.6
    ramp = np.clip((tt - t_cut) / 0.004, 0, 1)                     # the cut: 4 ms, no click
    lvl = np.where(tt >= t_cut, -30 + (-42 + 30) * ramp, lvl)
    away = np.clip((b - 0.05 - tt) / (b - 0.05 - t_cut), 0, 1) ** 2  # gone before f3000
    amp = db(lvl) * np.where(tt >= t_cut, away, 1.0)
    amp *= np.clip((tt - a) / 0.5, 0, 1)
    hum = bed * amp[:, None]
    jit = 1 + 0.0004 * L.smooth_noise(m, 0.2, SEED + 33, -1, 1)
    ph = np.cumsum(50 * jit) / SR
    mains = (np.sin(2 * np.pi * ph) + 0.55 * np.sin(4 * np.pi * ph + 0.4) + 0.3 * np.sin(6 * np.pi * ph + 1.1))
    mains = mains / np.sqrt(np.mean(mains ** 2)) * db(-50 - (-30)) * amp
    hum = hum + mains[:, None]
    r = dsp.rng(SEED + 34)
    tones = np.zeros((m, 2), np.float32)
    pitches = [659.26, 880.0, 987.77, 1174.66, 1318.51]
    t = a + 0.6
    while t < t_cut - 0.1:
        t += r.exponential(1.1)
        s = L.sine_grain(r.choice(pitches) * (1 + r.uniform(-0.002, 0.002)), 30)
        i = int((t - a) * SR)
        if i < m and t < t_cut - 0.05:
            place(tones, s * math.exp(r.normal(0, 0.4)) * amp[min(i, m - 1)] * db(-14), i, 1.0, r.uniform(-0.7, 0.7))
    tones = L.verb(tones, 'void', 0.5, dry=0.35)[:m]
    tones *= np.where(tt >= t_cut, away, 1.0)[:, None]
    city = hum + tones
    city[-1] = 0
    place(buf, city.astype(np.float32), frame_idx(2664))
    # --- #33 distant city through the window f5184 (216.0) → f5256 (219.0, hard cut): traffic + one FM tone
    a, b = F(5184), F(5256)
    sec = b - a
    m = int(sec * SR)
    tt = np.arange(m) / SR
    rumble = dsp.lowpass(L.brown_st(sec, SEED + 40), 250, order=2)
    rumble = L.follow_unit(rumble, 0.5)
    car = L.bp(L.pink_st(sec, SEED + 41, corr=0.4), 120, 900, 2)
    car = L.follow_unit(car, 0.3)
    pass_env = 0.25 + 0.75 * np.exp(-((tt - 1.4) / 0.7) ** 2)
    pan_mv = np.clip((tt - 1.4) / 1.2, -1, 1) * 0.5
    car_m = car.mean(axis=1) * pass_env
    traffic = rumble * 0.8 + L.pan_c(car_m, pan_mv) * 0.6
    traffic = L.rms_to(traffic, -45)
    k = int(0.35 * SR)
    tk = np.arange(k) / SR
    idx = 1.4 * np.exp(-tk / 0.12)
    fm = np.sin(2 * np.pi * 440 * tk + idx * np.sin(2 * np.pi * 440 * tk)) * np.minimum(1, (np.arange(k) + 1) / 240) * np.exp(-tk / 0.11)
    fm = L.verb(L.peak_to(fm.astype(np.float32), -52), 'void', 0.6, dry=0.7)
    city = traffic.copy()
    place(city, fm, int(1.9 * SR), 1.0)
    city = L.fade_edges(city, fin=0.03)
    city[-48:] *= np.linspace(1, 0, 48)[:, None]  # 1 ms: a cut, not a click
    place(buf, city.astype(np.float32), frame_idx(5184))
    return buf


# =================================================================== radio
MORSE = {'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....', 'I': '..',
         'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
         'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..', '?': '..--..'}


def morse_keying(text, dit=0.06):
    """[(start_s, dur_s)] for a text (dit 60 ms, dah 3, intra 1, letter gap 3, word gap 7 units)."""
    out, t = [], 0.0
    for w, word in enumerate(text.split(' ')):
        if w:
            t += 4 * dit  # 3 already added after the last letter → 7
        for li, ch in enumerate(word):
            for si, sym in enumerate(MORSE[ch]):
                d = dit if sym == '.' else 3 * dit
                out.append((t, d))
                t += d + dit
            t += 2 * dit  # letter gap = 3
    return out


def beep(freq, dur, ramp=0.004):
    k = int(dur * SR)
    rr = int(ramp * SR)
    t = np.arange(k) / SR
    e = np.ones(k, np.float32)
    e[:rr] = L.raised_ramp(rr); e[-rr:] = L.raised_ramp(rr)[::-1]
    return (np.sin(2 * np.pi * freq * t) * e).astype(np.float32)


def render_radio(tl, n):
    buf = np.zeros((n, 2), np.float32)
    # --- #27 scattered E6 morse from S05-b (f2820) to the f2928 cut: "CQ" (calling anyone) twice and
    #     stray elements, radio-filtered; never a voice
    a, b = F(2820), F(2928)
    m = int((b - a) * SR)
    seg = np.zeros((m, 2), np.float32)
    E6 = 1318.51
    for (s, d) in morse_keying('CQ'):
        place(seg, beep(E6, d), int((0.06 + s) * SR), db(-36), 0.3)
    for (s, d) in morse_keying('CQ'):
        place(seg, beep(E6, d), int((2.30 + s) * SR), db(-39), -0.25)
    for (s, d) in [(1.12, 0.06), (1.24, 0.18), (1.62, 0.06), (1.74, 0.06), (3.70, 0.18), (3.95, 0.06), (4.12, 0.18)]:
        place(seg, beep(E6, d), int(s * SR), db(-42), -0.45)
    y = np.stack([L.radio(seg[:, ch], 800, 3000, 1.8, -200, seed=1950 + ch) for ch in range(2)], axis=1)
    hz = L.bp(L.pink_st((b - a), SEED + 50), 800, 3000, 2)
    hz = L.rms_to(hz, -54)
    y = L.fade_edges(y + hz, fin=0.02)
    y[-72:] *= np.linspace(1, 0, 72)[:, None]  # cut at f2928 (1.5 ms)
    place(buf, y.astype(np.float32), frame_idx(2820))
    # --- #18 receiver hiss (S07 near-silence): fades in under the last Morse '?' (132.7 → 133.4),
    #     −62 dB LP 2 kHz, holds through the probe reveal and the turn (A6 at f3456, D2–A2 from f3528);
    #     from f3552 (148.0) −62 → −80 dB (exponential), gone before f3700. No pulsar, no reply.
    a, b = 132.7, F(3700)
    sec = b - a
    h = L.follow_unit(dsp.lowpass(L.pink_st(sec, SEED + 51), 2000, order=2), 0.3)
    tt = a + np.arange(len(h)) / SR
    dec = -62 - 18 * (1 - np.exp(-np.clip(tt - F(3552), 0, None) / 1.6)) / (1 - np.exp(-4.5 / 1.6))
    lvl = np.where(tt < F(3552), -62.0, dec)
    lvl = np.where(tt > 152.5, lvl - 30 * L.ease_in_out_sine((tt - 152.5) / (b - 0.05 - 152.5)), lvl)
    g = db(lvl) * np.where(tt < 133.4, L.ease_in_out_sine((tt - a) / 0.7), 1.0)
    g[tt >= b - 0.05] = 0.0
    place(buf, (h * g[:, None]).astype(np.float32), t_idx(a))
    return buf


# =================================================================== words
def render_words(tl, n):
    buf = np.zeros((n, 2), np.float32)
    r = dsp.rng(SEED + 70)
    # --- #30 word granules f3864 (161.0) → 180.5: 5–20 ms sine grains on D/E/F/A/C (octaves 6–7).
    #     v2: they — not a heartbeat — break the 6.75 s digital zero, on its very first sample: 2 grains/s
    #     → 40/s by f3960 (−50 → −40 dB), the dark fills with words (→ 200/s), 400/s and −34 dB from
    #     S08-c; out with the f4320 dissolve (inOutSine, 180.0 → 180.5)
    pitch = [dsp.note(x) for x in ('D6', 'E6', 'F6', 'A6', 'C7', 'D7', 'E7', 'F7', 'A7')]
    a, b = F(3864), 180.5
    m = int((b - a) * SR)
    seg = np.zeros((m + SR, 2), np.float32)

    def rate(t):
        if t < 165.0:
            return 2.0 * 20.0 ** ((t - a) / (165.0 - a))
        if t < 167.0:
            return 40.0 * 5.0 ** ((t - 165.0) / 2.0)
        return 200.0 + 200.0 * float(np.clip((t - 167.0) / 8.0, 0, 1))
    t = a
    first = True
    while True:
        if not first:
            t += r.exponential(1 / rate(t))
        if t >= b:
            break
        ms = r.uniform(5, 20)
        g = L.sine_grain(r.choice(pitch) * 2 ** (r.uniform(-4, 4) / 1200), ms, 0.6 if first else r.uniform(0, 6.28))
        if first:   # the grain that breaks the digital zero starts ON the f3864 sample (no near-zero Hann toe)
            k = len(g)
            env = np.concatenate([np.linspace(0.15, 1.0, k // 3), np.cos(np.linspace(0, np.pi / 2, k - k // 3)) ** 2])
            g = (np.sin(2 * np.pi * pitch[0] * np.arange(k) / SR + 0.6) * env).astype(np.float32)
        pn = r.uniform(-0.85, 0.85)
        wave = 0.62 + 0.38 * math.sin(2 * math.pi * 0.13 * (t - a) + 2.6 * pn) * math.sin(2 * math.pi * 0.047 * (t - a) + 1.0)
        place(seg, g * math.exp(r.normal(0, 0.35) * (0 if first else 1)) * wave, int(round((t - a) * SR)), 1.0, pn)
        first = False
    seg = seg[:m]
    seg = L.verb(seg, 'mid', 0.35, dry=1.0)[:m]
    ref = seg[int((172.0 - a) * SR):int((179.0 - a) * SR)]
    seg = seg / (np.sqrt(np.mean(ref.astype(np.float64) ** 2)) + 1e-12)
    tt = a + np.arange(m) / SR
    lvl = np.interp(tt, [a, 165.0, 171.0, 172.5, 179.98, 180.0], [-50, -40, -40, -34, -34, -34])
    seg = L.smooth_limit(seg * db(lvl)[:, None], -24.0)
    seg *= (1.0 - L.ease_in_out_sine((tt - 180.0) / 0.5))[:, None]
    place(buf, seg.astype(np.float32), frame_idx(3864))
    # --- #31 the three questions breathing f4524 (188.5) → f5184, the cover "嗒", the AI line
    place(buf, breathing(), frame_idx(4524))
    return buf


# Three human rows (screenplay S08-e / S09): QA high (A/E grains, 0.25 Hz), QB mid (E/B, 0.20 Hz),
# QC low (D/A, 0.31 Hz); the cloud of 2000 small lines; each stream is a glyph (or a line of the cloud).
ROWS = {
    'QA': dict(rate=0.25, ph=0.0, bands=[(2500, 5000), (3000, 6000)], sines=('A7', 'E7'), pan=-0.04, rel=0.0, ns=120),
    'QB': dict(rate=0.20, ph=1.3, bands=[(1800, 3600), (2200, 4400)], sines=('E7', 'B6'), pan=0.05, rel=-1.0, ns=110),
    'QC': dict(rate=0.31, ph=2.1, bands=[(1000, 2200), (1300, 2800)], sines=('D7', 'A6'), pan=0.0, rel=-1.5, ns=100),
    'cloud': dict(rate=None, ph=0.0, bands=[(1200, 3000), (2000, 5000), (3000, 7000)],
                  sines=('D7', 'E7', 'A7', 'B6'), pan=-0.12, rel=-7.0, ns=220),
}
COVER_TICKS = [(4704, -50.0), (4728, -47.0), (4752, -45.5), (4776, -44.0), (4800, -44.0), (4824, -44.0)]


def breath_env(tt, rate, ph=0.0):
    """A breath (inhale swell, longer exhale) with a little irregularity, anchored at 188.5 s."""
    p = 2 * np.pi * rate * (tt - 188.5) - np.pi / 2 + ph
    b = 0.5 + 0.5 * np.sin(p + 0.35 * np.sin(p))
    return (0.22 + 0.78 * b ** 1.4).astype(np.float32)


def row_active(row, h, h2, t):
    """Pure function of time, the same switch as the picture (screenplay S09-c / S09-d): QA is replaced
    glyph by glyph f4704–4727 and returns f4896–4905; QB is squeezed f4728–4751 and re-expands from
    f4872; QC is covered f4752–4775 and uncovered from f4848; the cloud is assimilated f4776–4823 and
    comes back 30 % / 70 % / 100 % at f4848 / f4872 / f4896."""
    if row == 'QA':
        j = int(h * 4)
        out, back = F(4704 + 6 * j), F(4896 + 3 * j)
    elif row == 'QB':
        out, back = F(4728) + h * F(23), F(4872) + h * F(12)
    elif row == 'QC':
        out, back = F(4752) + h * F(23), F(4848) + (1 - h) * F(12)
    else:
        out = F(4776) + h * F(47)
        back = F(4848) if h2 < 0.3 else (F(4872) if h2 < 0.7 else F(4896))
    return not (out <= t < back)


def breathing():
    """#31: one grain stream per glyph (3–8 ms filtered noise + sine micro-grains in the row's own
    pitches), modulated by the row's own breath; calibrated −44 dB RMS while all are alive.
    v2: covering silences each group's own colour and puts in its place the ONE short "嗒" (2 kHz,
    8 ms), only on the cursor's bright frames (f4704 … f4824, with the heartbeat); deleting brings the
    colours back group by group. From f5112 the AI line breathes too: the QA recipe an octave higher
    and brighter, in QA's rhythm."""
    a, b = F(4524), F(5184)
    m = int((b - a) * SR)
    hum = np.zeros((m + SR, 2), np.float32)
    ai = np.zeros((m + SR, 2), np.float32)

    def streams(out, row, cfg, t0, t1, active, seed, oct_up=False):
        rs = dsp.rng(seed)
        bands = [(lo * (2 if oct_up else 1), min(hi * (2 if oct_up else 1), 15000)) for lo, hi in cfg['bands']]
        bank = L.NoiseBank(bands, 2.0, seed + 1)
        sines = [dsp.note(s) * (2 if oct_up else 1) for s in cfg['sines']]
        for i in range(cfg['ns']):
            h, h2 = rs.random(), rs.random()
            band = int(rs.integers(len(bands)))
            sf = sines[int(rs.integers(len(sines)))]
            if row == 'cloud':
                rate_i, ph_i = rs.uniform(0.18, 0.33), rs.uniform(0, 6.28)
                p = cfg['pan'] + rs.uniform(-0.25, 0.25)
            else:
                rate_i, ph_i = cfg['rate'], cfg['ph']
                p = cfg['pan'] + 0.08 * (rs.random() - 0.5)
            amp_i = math.exp(rs.normal(0, 0.35))
            t = t0 + rs.exponential(1 / 1.9)
            while t < t1:
                if active(h, h2, t):
                    br = float(breath_env(np.array([t]), rate_i, ph_i)[0])
                    if rs.random() < 0.35 + 0.65 * br:
                        if rs.random() < 0.62:
                            k = int(rs.uniform(0.003, 0.008) * SR)
                            g = bank.grain(band, k, rs) * L.hann(k) * 0.55
                        else:
                            g = L.sine_grain(sf * 2 ** (rs.uniform(-6, 6) / 1200), rs.uniform(5, 12), rs.uniform(0, 6.28)) * 0.4
                        place(out, g * amp_i * br * db(cfg['rel']), int((t - a) * SR), 1.0, p)
                t += rs.exponential(1 / 1.9)

    for k, (row, cfg) in enumerate(ROWS.items()):
        streams(hum, row, cfg, a, b, lambda h, h2, t, row=row: row_active(row, h, h2, t), 3300 + 50 * k)
    ai_cfg = dict(ROWS['QA'], pan=cursor_pan(R_X + 2 * CELL) * 0.5, rel=0.0, ns=140)
    streams(ai, 'AI', ai_cfg, F(5112), b, lambda h, h2, t: True, 3400, oct_up=True)
    hum, ai = hum[:m], ai[:m]
    tt = a + np.arange(m) / SR
    # calibrate: the human rows −44 dB RMS while fully alive (f4536–4656: 189–194 s)
    ref = hum[int((189.0 - a) * SR):int((194.0 - a) * SR)]
    k_ref = db(-44) / (np.sqrt(np.mean(ref.astype(np.float64) ** 2)) + 1e-12)
    hum = hum * k_ref
    ai = ai * k_ref * db(-1.5)
    # f4896: all voices back — brightness overshoot 1.15, settling by f4944
    over = 1 + 0.15 * np.exp(-np.clip(tt - F(4896), 0, None) / 0.7) * (tt >= F(4896))
    hum = hum * over[:, None]
    fin = np.clip((tt - a) / 0.8, 0, 1) ** 1.5
    ai_in = np.clip((tt - F(5112)) / 1.5, 0, 1) ** 1.5
    fout = np.clip((216.0 - tt) / 1.0, 0, 1) ** 1.5  # drowned by the choir after 215, gone by the f5184 cut
    out = hum * (fin * fout)[:, None] + ai * (ai_in * fout)[:, None]
    out = L.verb(out, 'room', 0.12)[:m]
    out = L.smooth_limit(out, -31.0)  # a breath, not a click: knee off the rare grain pile-ups
    # the cover "嗒": one identical sample on each bright frame while the rows are covered
    tick = L.peak_to(L.cover_tick(), 0.0)
    for f, lv in COVER_TICKS:
        place(out, tick, frame_idx(f) - frame_idx(4524), db(lv), 0.0)
    out[-48:] *= np.linspace(1, 0, 48)[:, None]
    return out.astype(np.float32)


# =================================================================== render
def zero_digital(stems, tl):
    for z in tl.get('silences', []):
        if z.get('type', 'digital') == 'digital':
            a, b = frame_idx(round(z['start'] * 24)), frame_idx(round(z['end'] * 24))
            for v in stems.values():
                v[a:b] = 0.0


def render(tl):
    n = int(round(tl['duration'] * SR))
    stems = {
        'ident': render_ident(tl, n),
        'heart': render_heart(tl, n),
        'keys': render_keys(tl, n),
        'print': render_print(tl, n),
        'room': render_room(tl, n),
        'cosmos': render_cosmos(tl, n),
        'air': render_air(tl, n),
        'fire': render_fire(tl, n),
        'lamps': render_lamps(tl, n),
        'city': render_city(tl, n),
        'radio': render_radio(tl, n),
        'words': render_words(tl, n),
    }
    zero_digital(stems, tl)
    for k, v in stems.items():
        v[np.abs(v) < L.TINY] = 0.0  # flush denormal-scale residue to true zero
        if not np.all(np.isfinite(v)):
            raise ValueError(f'non-finite samples in sfx.{k}')
        stems[k] = v.astype(np.float32)
    return stems


if __name__ == '__main__':
    import json, os, time
    tl = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'timeline.json'), encoding='utf-8'))
    t0 = time.time()
    s = render(tl)
    print({k: round(dsp.peak_db(v), 1) for k, v in s.items()}, f'{time.time() - t0:.1f}s')
