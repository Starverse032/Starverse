"""AFTERGLOW — sound design part (screenplay §7.1, everything that is not music).

render(tl) -> {stem: full-length stereo float32}. Stems:
  heart  — cursor heartbeat lub/dub (#2)
  keys   — script keys, mono keys, enters, heavy enter (one sample, twice), AI keys, backspaces, print ticks (#3–#9)
  room   — room tone, hairline swish, infrasound, curtain swell (#10–#13)
  cosmos — star-light key granules, CMB / receiver hiss, decoupling glide (#14, #18, #19)
  fire   — flint, ignition, campfire, night wind (#22–#25)
  city   — city hum, distant city through the window (#26, #33)
  radio  — scattered E6 morse, void hiss, pulsar beeps (one sample), tail hiss (#27 part, #28)
  probe  — Voyager servo / stop click / shutter (#29)
  words  — word granules, breathing of the human line and of the AI line (#30, #31)

Timing: every event is placed on an integer sample index (frame × 2000 or round(t × 48000)).
Levels: transients are written as dBFS peak per channel, beds as dBFS RMS (screenplay targets for the
pre-normalisation mix). Digital silences (timeline.silences[type=digital]) are exact zeros in every stem.
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


R_X = 734
CELL = 64  # one full-width CJK cell (64 px) in S38


# =================================================================== heart
def heartbeat_schedule(tl):
    """(time_s, lub_dB, cursor_x or None). Cross-checked against the timeline's rule strings."""
    ev = []
    pro = [48, 72, 96, 120, 264, 288, 312, 336, 360, 384, 408, 432, 480]
    ev += [(f / 24, -30.0, None) for f in pro]
    for s in range(161, 170):  # 161–169, −3 dB per beat from 166
        ev.append((float(s), -30.0 - 3.0 * max(0, s - 165), R_X))
    ev += [(t, -32.0, R_X) for t in (191, 192, 193)]
    x_ans = R_X + 3 * CELL  # cursor after 「我在。」
    ev += [(t, -36.0, x_ans) for t in (195, 196, 197, 198)]
    ev += [(t, -32.0, x_ans) for t in (199, 200, 201)]
    x_q = R_X + 4 * CELL  # cursor after 「有人吗？」
    ev += [(t, -38.0, x_q) for t in (212, 213, 214)]
    ev += [(float(t), -30.0, None) for t in (235, 236, 244, 246, 247, 248, 249)]
    # cross-check with timeline rules
    want = set()
    for s in tl.get('sfx', []):
        if s['id'].startswith('heartbeat_'):
            m = re.search(r'lub 于(帧)?\s*([0-9,，\s（）()−\-dB压在和弦下埋合唱.]+)', s['desc'])
            if not m:
                continue
            nums = re.findall(r'(?<![−\-\d])(\d+(?:\.\d+)?)(?!\s*dB)', re.sub(r'[（(][^）)]*[）)]', '', m.group(2)))
            for v in nums:
                v = float(v)
                want.add(round(v / 24 if m.group(1) else v, 4))
    have = {round(t, 4) for t, _, _ in ev}
    if want and want != have:
        print('[sfx] WARNING heartbeat schedule differs from timeline:', sorted(want ^ have))
    return ev


def render_heart(tl, n):
    buf = np.zeros((n, 2), np.float32)
    lub = L.peak_to(L.heart_lub(), 0.0)
    dub = L.peak_to(L.heart_dub(), 0.0)
    r = dsp.rng(SEED + 2)
    dub_off = tl['anchors']['heartbeat'].get('dubOffsetFrames', 7) * 2000
    for t, lvl, x in heartbeat_schedule(tl):
        g = db(lvl + r.uniform(-0.5, 0.5))
        p = None if x is None else cursor_pan(x)
        i = t_idx(t)
        place(buf, lub, i, g, p)
        place(buf, dub, i + dub_off, g * db(-8), p)
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
    # --- Latin line: 29 lighter, shorter keys, −29 dB
    line = 'In the dark, a cursor blinks.'
    comma = line.index(',')
    for i, ch in enumerate(line):
        f = 198 + math.floor(1.5 * i) + (4 if i > comma else 0)
        x, _ = soft_key(500 + i, latin=True, space=(ch == ' '), r=r)
        place(buf, L.with_room(L.peak_to(x, -29 + r.uniform(-2, 2) - (1.0 if ch == ' ' else 0))), frame_idx(f))
    # --- #4 mono keys "t = 0" (heavier: 120 Hz body 30 ms), −24 dB
    for k, (f, ch) in enumerate(zip((456, 460, 464, 468, 472), 't = 0')):
        x = L.keystroke(seed=600 + k, body_hz=120 * (0.85 if ch == ' ' else 1.0), body_ms=30, press_ms=5,
                        press_bp=(1100, 3500), lift_ms=48, lift_db=-12, felt=0.5,
                        extra_clicks=((3.0, 0.3, 1500, 4500),) if ch == ' ' else ())
        place(buf, L.with_room(L.peak_to(x, -24 + (-0.8 if ch == ' ' else 0))), frame_idx(f))
    # --- #9 heavy enter: ONE sample, used at 21.000 and 215.000, −16 dBFS
    heavy = heavy_enter()
    for t in (21.0, 215.0):
        place(buf, heavy, t_idx(t))
    # --- #5 AI answer keys: light, fast, every one identical, −26 dB
    ans = L.with_room(L.peak_to(L.keystroke(seed=700, body_hz=200, body_ms=12, press_ms=3.5, press_bp=(1800, 4500),
                                            lift_ms=26, lift_db=-14, felt=0.25), -26))
    for k, f in enumerate((4656, 4664, 4672)):
        place(buf, ans, frame_idx(f), pan=cursor_pan(R_X + k * CELL))
    # --- #7 backspaces: the AI key pitched −15 %, lift held to 70 ms (the finger stayed), −27 dB
    bsp = L.with_room(L.peak_to(L.keystroke(seed=700, body_hz=200, body_ms=12, press_ms=3.5, press_bp=(1800, 4500),
                                            lift_ms=70, lift_db=-12, felt=0.25, pitch=0.85), -27))
    for k, f in enumerate((4848, 4872, 4896)):
        place(buf, bsp, frame_idx(f), pan=cursor_pan(R_X + (3 - k) * CELL))
    # --- #6 AI question keys: #3 with a human hand (vel ±3 dB, BP ±15 %, lift 50–90 ms, finger noise)
    rq = dsp.rng(SEED + 6)
    for k, f in enumerate((4992, 5016, 5040, 5064)):
        c = rq.uniform(-0.15, 0.15)
        x = L.keystroke(seed=800 + k, body_hz=rq.uniform(140, 180), body_ms=20, press_ms=5,
                        press_bp=(1500 * (1 + c), 4000 * (1 + c)), lift_ms=rq.uniform(50, 90), lift_db=-12,
                        pitch=1 + rq.uniform(-0.05, 0.05), felt=0.4)
        x = L.with_room(L.peak_to(x, -26 + rq.uniform(-3, 3)))
        i = frame_idx(f)
        fn = L.peak_to(L.finger_noise(900 + k), -50)
        place(buf, fn, i - len(fn), pan=cursor_pan(R_X + k * CELL))  # ends exactly on the press
        place(buf, x, i, pan=cursor_pan(R_X + k * CELL))
    # --- print ticks (4 kHz 1 ms, −48 dB)
    tick = L.peak_to(L.tick_4k(), -48)
    for t in (237, 238, 239, 240, 241, 242, 243, 245):
        place(buf, tick, t_idx(t))
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
    # --- #14 star-light key granules 21.0–24.0: key transients pitched +24..36 st, 200 grains/s,
    #     5–20 ms Hann, random pan that spirals into R during the collapse; −34 dB; hard cut 24.000
    r = dsp.rng(SEED + 14)
    src = [soft_key(1400 + k, r=r)[0] for k in range(16)]
    t = 21.0
    a, end = 21.0, 24.0
    grains = np.zeros((int((end - a) * SR) + SR, 2), np.float32)
    while True:
        t += r.exponential(1 / 200)
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
        place(grains, g * amp, int((t - a) * SR), 1.0, p)
    grains = grains[:int((end - a) * SR)]
    tt = a + np.arange(len(grains)) / SR
    lvl = np.interp(tt, [21.0, 21.5, 22.0, 23.0, 23.95, 24.0], [-60, -40, -34, -33, -31, -31])
    # normalise by a long-term RMS (grains are sparse; set the 22–23 s region to −34 dB RMS)
    seg = grains[int(1.0 * SR):int(2.0 * SR)]
    gn = grains / (np.sqrt(np.mean(seg.astype(np.float64) ** 2)) + 1e-12)
    place(buf, (gn * db(lvl)[:, None]).astype(np.float32), t_idx(a))
    # --- #18 CMB hiss 25.333 → 37: decorrelated pink, LP 18k → 12k(27) → 3k(30), 30.0 dives to
    #     1.2 kHz then slides to 300 Hz (35); −26 → −34(31) → −52(35) → −62(37), gone
    a, b = 25.333, 37.6
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
    place(buf, (hiss * db(lvl)[:, None]).astype(np.float32), t_idx(a))
    # --- #19 decoupling glide 30.0: sine 60 → 40 Hz, −30 dB, 1.5 s
    m = int(1.5 * SR)
    tt = np.arange(m) / SR
    f = 40 + 20 * np.exp(-tt / 0.45)
    env = np.minimum(1, (np.arange(m) + 1) / (0.03 * SR)) * (0.5 + 0.5 * np.cos(np.pi * tt / 1.5)) ** 1.2
    gl = np.sin(2 * np.pi * np.cumsum(f) / SR) * env
    place(buf, L.peak_to(gl.astype(np.float32), -30), t_idx(30.0))
    # --- #18 CMB hiss return 233.0–235.5: LP 600 Hz, −54 dB, out before 235.5
    a = 233.0
    h = L.follow_unit(dsp.lowpass(L.pink_st(2.5, SEED + 19), 600, order=2), 0.3)
    tt = a + np.arange(len(h)) / SR
    lvl = np.interp(tt, [233.0, 233.8, 234.4, 235.4, 235.5], [-90, -54, -54, -95, -120])
    place(buf, (h * db(lvl)[:, None]).astype(np.float32), t_idx(a))
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
    rp = cursor_pan(R_X)
    # --- #22 flint ×3 on the off-beats, −24 dB (2nd a little stronger, 3rd + tinder hiss)
    for k, (t, g) in enumerate(((71.5, -24), (72.5, -22.5), (73.5, -23.5))):
        x = flint(2200 + k, g, tinder=(k == 2))
        place(buf, L.trim_tail(L.verb(x, 'outdoor', 0.12)), t_idx(t), 1.0)
    # --- #23 ignition "whoomph" 74.0: noise LP 200 → 1200 Hz over 0.4 s, −20 dB
    m = int(0.9 * SR)
    tt = np.arange(m) / SR
    fc = 200 * (1200 / 200) ** np.clip(tt / 0.4, 0, 1)
    wh = L.swept(L.pink_st(0.9, SEED + 23, corr=0.6), fc, 'lp', order=2)
    env = np.minimum(1, (np.arange(m) + 1) / (0.09 * SR)) ** 1.5 * np.exp(-np.clip(tt - 0.12, 0, None) / 0.22)
    wh = wh * env[:, None]
    place(buf, L.peak_to(L.fade_out_tail(wh, 0.05), -20), t_idx(74.0))
    # --- #24 campfire 74.0 → 95.0 (match dissolve out 94.75–95.25)
    a, b = 74.0, 95.25
    fire, pk = campfire(b - a, SEED + 24)
    fire = fire / pk * db(-22)  # crackle peaks ≈ −22 dBFS
    fire = L.verb(fire, 'room', 0.18)[:len(fire)]
    m = len(fire)
    tt = a + np.arange(m) / SR
    # 79–86: LP 8k → 1.5k, −10 dB (crane up), then 86 (cut) → distant −40 dB, LP 1.2 kHz
    u = L.ease_in_out_sine((tt - 79.0) / 7.0)
    fc = np.where(tt < 79.0, 18000, 8000 * (1500 / 8000) ** u)
    near = L.swept(fire, fc, 'lp', order=2)
    gain = db(-10 * u)
    near = near * gain[:, None]
    far = dsp.lowpass(fire, 1200, order=2)
    far = L.verb(far, 'outdoor', 0.45)[:m]
    far_m = far.mean(axis=1)
    far = L.pan_c(far_m, rp) * db(-18)
    ci = int((86.0 - a) * SR)
    xf = 96  # 2 ms crossfade on the picture cut
    w = np.zeros(m, np.float32)
    w[ci:] = 1
    w[ci:ci + xf] = np.linspace(0, 1, xf)
    out = near * (1 - w)[:, None] + far * w[:, None]
    # match dissolve out
    out *= np.clip((95.25 - tt) / 0.5, 0, 1)[:, None] ** 1.2
    place(buf, out.astype(np.float32), t_idx(a))
    # --- #25 night wind 79–95: pink BP 200–800 Hz, slowly drifting centre, decorrelated L/R, −38 dB
    a, b = 79.0, 95.25
    sec = b - a
    m = int(sec * SR)
    tt = a + np.arange(m) / SR
    ctr = 400 * 2 ** (0.9 * L.smooth_noise(m, 0.12, SEED + 25, -1, 1))
    ctr = np.clip(ctr, 280, 600)
    wl = L.swept(dsp.pink(sec, SEED + 26), ctr, 'bp', order=2, bw_oct=1.2)
    ctr2 = np.clip(400 * 2 ** (0.9 * L.smooth_noise(m, 0.12, SEED + 27, -1, 1)), 280, 600)
    wr = L.swept(dsp.pink(sec, SEED + 28), ctr2, 'bp', order=2, bw_oct=1.2)
    wind = L.follow_unit(np.stack([wl, wr], axis=1), 0.5)
    gust = 0.7 + 0.3 * L.smooth_noise(m, 0.08, SEED + 29, -1, 1)
    lvl = np.interp(tt, [79.0, 80.5, 94.75, 95.25], [-80, -38, -38, -90])
    wind = wind * (db(lvl) * gust / np.sqrt(np.mean(gust ** 2)))[:, None]
    place(buf, wind.astype(np.float32), t_idx(a))
    return buf


# =================================================================== city
def render_city(tl, n):
    buf = np.zeros((n, 2), np.float32)
    # --- #26 city hum 94.75 → ~131: pink BP 200–2000 Hz, 0.1–0.5 Hz undulation, 50/100/150 Hz mains,
    #     sparse distant short tones; −44 → −30 (112.8); 113.0 drops to −42; ×min(1, 1e4 km / d) from 123
    a, b = 94.75, 131.0
    sec = b - a
    m = int(sec * SR)
    tt = a + np.arange(m) / SR
    bed = L.bp(L.pink_st(sec, SEED + 26, corr=0.2), 200, 2000, 2)
    bed = L.follow_unit(bed, 0.6)
    und = 1 + 0.18 * L.smooth_noise(m, 0.3, SEED + 31, -1, 1) + 0.12 * L.smooth_noise(m, 0.1, SEED + 32, -1, 1)
    bed = bed * und[:, None]
    u = np.clip((tt - 95.0) / (112.8 - 95.0), 0, 1)
    lvl = -44 + 14 * u ** 1.6
    lvl = np.where(tt >= 113.0, -42 - 4 * np.clip((tt - 113.0) / 10.0, 0, 1), lvl)
    # the "cut" to −42 dB at 113.000: 4 ms ramp so it reads as a cut without clicking
    ramp = np.clip((tt - 113.0) / 0.004, 0, 1)
    lvl = np.where((tt >= 112.8) & (tt < 113.004), -30 + (-42 + 30) * ramp, lvl)
    d = 6000 * np.exp(0.49 * np.clip(tt - 123.0, 0, None))
    dist = np.minimum(1.0, 1e4 / d)
    amp = db(lvl) * dist
    amp *= np.clip((tt - 94.75) / 0.5, 0, 1)
    amp *= np.clip((131.0 - tt) / 1.0, 0, 1)
    hum = bed * amp[:, None]
    # mains 50/100/150 Hz: −50 dB at the city's loudest
    ts = np.arange(m) / SR
    jit = 1 + 0.0004 * L.smooth_noise(m, 0.2, SEED + 33, -1, 1)
    ph = np.cumsum(50 * jit) / SR
    mains = (np.sin(2 * np.pi * ph) + 0.55 * np.sin(4 * np.pi * ph + 0.4) + 0.3 * np.sin(6 * np.pi * ph + 1.1))
    mains = mains / np.sqrt(np.mean(mains ** 2)) * db(-50 - (-30)) * amp
    hum = hum + mains[:, None]
    # distant short tones (600–1500 Hz, 30 ms), pitched to the score's open fifths (E A B D E)
    r = dsp.rng(SEED + 34)
    tones = np.zeros((m, 2), np.float32)
    pitches = [659.26, 880.0, 987.77, 1174.66, 1318.51]
    t = a + 1.0
    while t < 123.0:
        t += r.exponential(1.3)
        k = int(0.03 * SR)
        s = L.sine_grain(r.choice(pitches) * (1 + r.uniform(-0.002, 0.002)), 30)
        i = int((t - a) * SR)
        if i < m:
            place(tones, s * math.exp(r.normal(0, 0.4)) * amp[min(i, m - 1)] * db(-14), i, 1.0, r.uniform(-0.7, 0.7))
    tones = L.verb(tones, 'void', 0.5, dry=0.35)[:m]
    place(buf, (hum + tones).astype(np.float32), t_idx(a))
    # --- #33 distant city through the window 216.0 → 219.0 (hard cut): traffic + one short FM tone
    a, b = 216.0, 219.0
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
    # FM short tone (a distant signal), −52 dB peak, through the void
    k = int(0.35 * SR)
    tk = np.arange(k) / SR
    idx = 1.4 * np.exp(-tk / 0.12)
    fm = np.sin(2 * np.pi * 440 * tk + idx * np.sin(2 * np.pi * 440 * tk)) * np.minimum(1, (np.arange(k) + 1) / 240) * np.exp(-tk / 0.11)
    fm = L.verb(L.peak_to(fm.astype(np.float32), -52), 'void', 0.6, dry=0.7)
    city = traffic.copy()
    place(city, fm, int(1.9 * SR), 1.0)
    city = L.fade_edges(city, fin=0.03)
    city[-48:] *= np.linspace(1, 0, 48)[:, None]  # 1 ms: a cut, not a click
    place(buf, city.astype(np.float32), t_idx(a))
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
    # --- #27 scattered E6 morse 110.75 → 113.000 (cut): "CQ" (calling anyone) and stray elements
    a, b = 110.75, 113.0
    m = int((b - a) * SR)
    seg = np.zeros((m, 2), np.float32)
    E6 = 1318.51
    for (s, d) in morse_keying('CQ'):
        place(seg, beep(E6, d), int((0.06 + s) * SR), db(-36), 0.3)
    for (s, d) in [(0.45, 0.06), (0.57, 0.06), (1.12, 0.18), (1.62, 0.06), (1.74, 0.18), (2.12, 0.18)]:
        place(seg, beep(E6, d), int(s * SR), db(-42), -0.45)
    # radio filtering: BP 800–3000 + tanh + hiss
    y = np.stack([L.radio(seg[:, ch], 800, 3000, 1.8, -200, seed=1950 + ch) for ch in range(2)], axis=1)
    hz = L.bp(L.pink_st((b - a), SEED + 50), 800, 3000, 2)
    hz = L.rms_to(hz, -54)
    y = L.fade_edges(y + hz, fin=0.02)
    y[-72:] *= np.linspace(1, 0, 72)[:, None]  # cut at 113.000 (1.5 ms)
    place(buf, y.astype(np.float32), t_idx(a))
    # --- #18 receiver hiss (void): 133.0 fade in, −62 dB LP 2 kHz; continues under the pulsar;
    #     143.75 → −80 dB over 3 s (exponential), gone before 148.0
    a, b = 133.0, 148.0
    sec = b - a
    h = L.follow_unit(dsp.lowpass(L.pink_st(sec, SEED + 51), 2000, order=2), 0.3)
    tt = a + np.arange(len(h)) / SR
    lvl = np.interp(tt, [133.0, 134.2, 143.75, 146.75, 147.9, 148.0], [-95, -62, -62, -80, -110, -140])
    place(buf, (h * db(lvl)[:, None]).astype(np.float32), t_idx(a))
    # --- #28 pulsar: ONE sample, t_k = 137.000 + 1.337 k (k = 0…5 audible), −24 dB peak;
    #     k = 4 the same sample at −3 dB; k = 5 the same sample −6 dB, LP 1.5 kHz
    ps = L.peak_to(L.pulsar_sample(), -24)
    ps5 = dsp.lowpass(ps, 1500, order=4)
    ps5 = ps5 * (np.abs(ps).max() / (np.abs(ps5).max() + 1e-12))
    period = 64176  # 1.337 s × 48000, exact
    for k in range(6):
        i = 137 * SR + k * period
        clip, g = (ps, 1.0) if k < 4 else ((ps, db(-3)) if k == 4 else (ps5, db(-6)))
        x_px = 1800 if k == 0 else (734 if k < 4 else 1700)  # where the flash is on screen
        if 1 <= k <= 3:
            x_px = 1800 + (734 - 1800) * min(1, k / 2)
        place(buf, clip, i, g, cursor_pan(x_px) * 0.5)
    return buf


def pulsar_indices():
    return [137 * SR + k * 64176 for k in range(6)]


# =================================================================== probe
def render_probe(tl, n):
    buf = np.zeros((n, 2), np.float32)
    # --- #29 servo 149.0–152.5: filtered saw 80 → 95 Hz, BP 300–900 Hz, −44 dB (structure-borne)
    a, b = 149.0, 152.5
    sec = b - a
    m = int(sec * SR)
    tt = np.arange(m) / SR
    u = np.clip(tt / 3.0, 0, 1)
    prog = L.ease_in_out_sine(u)
    f = 80 + 15 * prog
    f = np.where(tt >= 3.0, 108.0, f)  # scan platform: a lighter motor, 152.0–152.5
    jit = 1 + 0.003 * L.smooth_noise(m, 7, SEED + 60, -1, 1)
    s = dsp.saw(f * jit) * 1.0 + 0.25 * dsp.saw(f * jit * 3.03)
    s = L.bp(s, 300, 900, 2)
    s = s + L.peak_res(s, 410, 9, 0.6) + L.peak_res(s, 640, 12, 0.4)
    speed = np.sin(np.pi * u)
    env = np.where(tt < 3.0, 0.45 + 0.55 * speed, 0.5)
    env *= np.clip(tt / 0.04, 0, 1)
    env *= np.where((tt > 2.92) & (tt < 3.04), 0.6, 1.0)
    s = s * env
    s = L.rms_to(s, -44)
    s[-48:] *= np.linspace(1, 0, 48)  # stops dead on the stop click (152.5)
    s = L.verb(s, 'probe', 0.25)[:m]
    place(buf, s.astype(np.float32), t_idx(a))
    # stop click 152.5: 1 ms click + 15 ms 220 Hz body, −36 dB
    k = int(0.04 * SR)
    tk = np.arange(k) / SR
    r = dsp.rng(SEED + 61)
    c = np.zeros(k, np.float32)
    kc = int(0.001 * SR)
    c[:kc] = r.standard_normal(kc) * L.onset_env(kc, 2, kc / 3)
    c = dsp.highpass(c, 1000, order=2)
    c /= np.abs(c).max()
    body = np.sin(2 * np.pi * 220 * tk) * L.onset_env(k, 24, 0.015 * SR / 4)
    stop = L.peak_to(L.verb(c + 0.6 * body, 'probe', 0.3), -36)
    place(buf, L.trim_tail(stop), t_idx(152.5))
    # shutter 153.5: two 2 ms clicks 40 ms apart (BP 1.5 kHz, 3 kHz) + very short metallic ring, −30 dB
    k = int(0.15 * SR)
    tk = np.arange(k) / SR
    sh = np.zeros(k, np.float32)
    for off, (lo, hi) in ((0, (1200, 1900)), (int(0.040 * SR), (2500, 3600))):
        kc = int(0.002 * SR)
        z = np.zeros(k, np.float32)
        z[off:off + kc] = r.standard_normal(kc) * L.onset_env(kc, 2, kc / 3)
        z = L.bp(z, lo, hi, 2)
        sh += z / (np.abs(z).max() + 1e-12)
        tt2 = np.clip(tk - off / SR, 0, None)
        ring = sum(a_ * np.sin(2 * np.pi * f_ * tt2) for f_, a_ in ((4130, 1), (6290, 0.6), (7910, 0.35)))
        sh += 0.22 * ring * np.exp(-tt2 / 0.008) * (tk >= off / SR)
    shut = L.peak_to(L.trim_tail(L.verb(sh, 'probe', 0.2)), -30)
    place(buf, shut, t_idx(153.5))
    return buf


# =================================================================== words
def render_words(tl, n):
    buf = np.zeros((n, 2), np.float32)
    r = dsp.rng(SEED + 70)
    # --- #30 word granules 165.0 → 180.0 (cut): 5–20 ms sine grains on D/E/F/A/C (octaves 6–7),
    #     200 → 400 grains/s, stereo spread, −40 → −34 dB
    pitch = [dsp.note(x) for x in ('D6', 'E6', 'F6', 'A6', 'C7', 'D7', 'E7', 'F7', 'A7')]
    a, b = 165.0, 180.0
    m = int((b - a) * SR)
    seg = np.zeros((m + SR, 2), np.float32)
    t = a
    while True:
        rate = 200 + 200 * float(np.clip((t - 165.0) / 10.0, 0, 1))
        t += r.exponential(1 / rate)
        if t >= b:
            break
        ms = r.uniform(5, 20)
        g = L.sine_grain(r.choice(pitch) * 2 ** (r.uniform(-4, 4) / 1200), ms, r.uniform(0, 6.28))
        place(seg, g * math.exp(r.normal(0, 0.5)), int((t - a) * SR), 1.0, r.uniform(-0.85, 0.85))
    seg = seg[:m]
    seg = L.verb(seg, 'mid', 0.35, dry=1.0)[:m]
    ref = seg[int(7 * SR):int(14 * SR)]
    seg = seg / (np.sqrt(np.mean(ref.astype(np.float64) ** 2)) + 1e-12)
    tt = a + np.arange(m) / SR
    lvl = np.interp(tt, [165.0, 166.5, 171.0, 172.5, 179.98, 180.0], [-70, -40, -40, -34, -34, -34])
    seg = seg * db(lvl)[:, None]
    seg[-int(0.012 * SR):] *= L.raised_ramp(int(0.012 * SR))[::-1, None]  # out on the 180.0 cut
    place(buf, seg.astype(np.float32), t_idx(a))
    # --- #31 breathing of the words 188.5 → 216.0
    place(buf, breathing(), t_idx(188.5))
    return buf


def breath_env(tt):
    """0.25 Hz breath (inhale swell, longer exhale), with a little irregularity."""
    ph = 2 * np.pi * 0.25 * (tt - 188.5) - np.pi / 2
    b = 0.5 + 0.5 * np.sin(ph + 0.35 * np.sin(ph))
    return (0.22 + 0.78 * b ** 1.4).astype(np.float32)


def breathing():
    """#31: one grain stream per legible glyph (3–8 ms filtered noise + 2–4 kHz D/E/A/B sine
    micro-grains), all modulated by the same 0.25 Hz breath, pan −0.1, −44 dB.
    Streams go out one by one as their glyph is flipped to 「我在」 (t = 195 + 4·hash_i) and come back
    at 202 (hash < 0.3) / 203 (< 0.7) / 204 (rest) — the same pure-function switch as the picture.
    From 211 the AI line breathes too: same recipe, an octave higher and brighter, pan +0.1."""
    a, b = 188.5, 216.0
    m = int((b - a) * SR)
    r = dsp.rng(SEED + 31)
    hum = np.zeros((m + SR, 2), np.float32)
    ai = np.zeros((m + SR, 2), np.float32)
    bank_h = L.NoiseBank([(1500, 3000), (2000, 4000), (2500, 5000), (3000, 6000)], 2.0, 3100)
    bank_a = L.NoiseBank([(3500, 7000), (4500, 9000), (5500, 11000), (6500, 13000)], 2.0, 3200)
    sines_h = [dsp.note(x) for x in ('D7', 'E7', 'A7', 'B7')]
    sines_a = [2 * f for f in sines_h]

    def stream_grains(out, nstreams, t0, t1, bank, sines, pan0, active, rate_per=1.9, seed=0):
        rs = dsp.rng(seed)
        for i in range(nstreams):
            h = rs.random()
            band = int(rs.integers(len(bank.bands)))
            sf = sines[int(rs.integers(len(sines)))]
            p = pan0 + 0.08 * (rs.random() - 0.5)
            amp_i = math.exp(rs.normal(0, 0.35))
            t = t0 + rs.exponential(1 / rate_per)
            while t < t1:
                if active(h, t):
                    br = float(breath_env(np.array([t]))[0])
                    if rs.random() < 0.35 + 0.65 * br:  # density breathes too
                        if rs.random() < 0.62:
                            k = int(rs.uniform(0.003, 0.008) * SR)
                            g = bank.grain(band, k, rs) * L.hann(k) * 0.55
                        else:
                            g = L.sine_grain(sf * 2 ** (rs.uniform(-6, 6) / 1200), rs.uniform(5, 12), rs.uniform(0, 6.28)) * 0.4
                        place(out, g * amp_i * br, int((t - a) * SR), 1.0, p)
                t += rs.exponential(1 / rate_per)

    def human_active(h, t):
        back = 202.0 if h < 0.3 else (203.0 if h < 0.7 else 204.0)
        return not (195.0 + 4.0 * h < t < back)

    stream_grains(hum, 320, a, b, bank_h, sines_h, -0.1, human_active, seed=3300)
    stream_grains(ai, 200, 211.0, b, bank_a, sines_a, 0.1, lambda h, t: True, seed=3400)
    hum, ai = hum[:m], ai[:m]
    tt = a + np.arange(m) / SR
    # calibrate: human line −44 dB RMS while fully alive (189–195)
    ref = hum[int((189.0 - a) * SR):int((195.0 - a) * SR)]
    hum = hum * (db(-44) / (np.sqrt(np.mean(ref.astype(np.float64) ** 2)) + 1e-12))
    ai = ai * (db(-44) / (np.sqrt(np.mean(ref.astype(np.float64) ** 2)) + 1e-12)) * db(-1.5)
    # 204.0: all voices back — brightness overshoot 1.15, settling by 206
    over = 1 + 0.15 * np.exp(-np.clip(tt - 204.0, 0, None) / 0.7) * (tt >= 204.0)
    hum = hum * over[:, None]
    fin = np.clip((tt - a) / 0.8, 0, 1) ** 1.5
    ai_in = np.clip((tt - 211.0) / 1.5, 0, 1) ** 1.5
    fout = np.clip((216.0 - tt) / 1.0, 0, 1) ** 1.5  # drowned by the choir after 215, gone by the 216 cut
    out = hum * (fin * fout)[:, None] + ai * (ai_in * fout)[:, None]
    out = L.verb(out, 'room', 0.12)[:m]
    out[-48:] *= np.linspace(1, 0, 48)[:, None]
    return out.astype(np.float32)


# =================================================================== render
def zero_digital(stems, tl):
    for z in tl.get('silences', []):
        if z.get('type', 'digital') == 'digital':
            a, b = t_idx(z['start']), t_idx(z['end'])
            for v in stems.values():
                v[a:b] = 0.0


def render(tl):
    n = int(round(tl['duration'] * SR))
    stems = {
        'heart': render_heart(tl, n),
        'keys': render_keys(tl, n),
        'room': render_room(tl, n),
        'cosmos': render_cosmos(tl, n),
        'fire': render_fire(tl, n),
        'city': render_city(tl, n),
        'radio': render_radio(tl, n),
        'probe': render_probe(tl, n),
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
