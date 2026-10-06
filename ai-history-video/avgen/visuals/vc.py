"""插图（下）：第九章至第十二章。"""
import math

import numpy as np
import skia

from ..gfx import (MUTED, TEXT, WHITE, appear, arrow, circle, clamp, ease_in_out, ease_out, glow_dot, lerp,
                   line, linear_gradient, paint, poly, prog, radial_gradient, rand, rrect, text,
                   text_block, text_width, wrap)
from . import caption_tag, card, person, typed, visual

ORANGE = "#ffb454"
BLUE = "#5ad1f0"
RED = "#ff6b6b"
GREEN = "#7ee787"
GOLD = "#ffd166"


def _box3d(c, x0, y0, bw, bh, depth, color, a):
    """伪 3D 方块（卷积层）。"""
    dx, dy = depth * 0.6, -depth * 0.45
    poly(c, [(x0, y0), (x0 + dx, y0 + dy), (x0 + dx + bw, y0 + dy), (x0 + bw, y0)], color, a * 0.35)
    poly(c, [(x0 + bw, y0), (x0 + bw + dx, y0 + dy), (x0 + bw + dx, y0 + dy + bh), (x0 + bw, y0 + bh)], color, a * 0.22)
    rrect(c, x0, y0, bw, bh, 2, fill=color, alpha=a * 0.5)
    rrect(c, x0, y0, bw, bh, 2, stroke=color, alpha=a, width=2)


def _img_from_array(arr):
    arr = np.ascontiguousarray(arr)
    return skia.Image.fromarray(arr, colorType=skia.kRGBA_8888_ColorType)


def _draw_img(c, img, X, Y, W_, H_, a=1.0):
    p = skia.Paint()
    p.setAlphaf(clamp(a))
    c.drawImageRect(img, skia.Rect.MakeXYWH(X, Y, W_, H_), skia.SamplingOptions(skia.FilterMode.kLinear), p)


# ---------------------------------------------------------------- 第九章

_ILSVRC = [(2010, 28.2, ""), (2011, 25.8, ""), (2012, 15.3, "AlexNet"), (2013, 11.7, ""), (2014, 6.7, "GoogLeNet"), (2015, 3.57, "ResNet")]


@visual("alexnet")
def alexnet(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 2)
    if pa > 0.01:
        big = appear(t, 0.2, 0.8) * (1 - x.phase(1))
        text(c, "2012", w / 2, h / 2 + 50, 200, A, pa * big, weight=900, align="center", glow=30)
        pb = x.phase(1, 2)
        if pb > 0.01:
            dims = [(30, 220, 40), (26, 150, 34), (22, 100, 28), (18, 80, 24), (18, 80, 24), (14, 64, 20)]
            for g, gy in enumerate([170, 390]):
                X = 120
                for k, (bw, bh, dp) in enumerate(dims):
                    ak = pb * appear(t, x.cue(1) + 0.3 + k * 0.2, 0.4)
                    _box3d(c, X, gy - bh / 2, bw, bh, dp, A if g == 0 else BLUE, ak)
                    X += bw + 70
                text(c, f"GPU {g + 1}", 40, gy + 8, 22, A if g == 0 else BLUE, pb, weight=700)
            rrect(c, 40, 230, 60, 60, 4, fill="#ffffff", alpha=pb * 0.15)
            for k in range(3):
                X = 720 + k * 34
                c.drawRect(skia.Rect.MakeXYWH(X, 200, 14, 200), paint(TEXT, pb * appear(t, x.cue(1) + 1.6 + k * 0.2, 0.4) * 0.8))
            text(c, "1000 类", 754, 450, 22, TEXT, pb, align="center")
            text(c, "8 层网络 · 6000 万参数 · 两块 GTX 580 显卡", w / 2, 560, 24, MUTED, pb, align="center")
    pc = x.phase(2)
    if pc > 0.01:
        ox, oy, cw, ch = 90, 70, 720, 440
        mx = 30.0
        Y = lambda v: oy + ch - v / mx * ch
        line(c, ox, oy + ch, ox + cw, oy + ch, MUTED, pc, 2)
        for v in (0, 10, 20, 30):
            text(c, f"{v}%", ox - 14, Y(v) + 7, 18, MUTED, pc, align="right")
            line(c, ox, Y(v), ox + cw, Y(v), MUTED, pc * 0.15, 1)
        bw = cw / len(_ILSVRC)
        for i, (yr, v, nm) in enumerate(_ILSVRC):
            ai = appear(t, x.cue(2) + i * 0.45, 0.6)
            hl = yr == 2012
            hb = (v / mx * ch) * ai
            X = ox + i * bw + bw * 0.18
            bww = bw * (0.36 if hl else 0.64)
            rrect(c, X, oy + ch - hb, bww, hb, 6, fill=A if hl else "#3d5a99", alpha=pc)
            text(c, f"{v}%", X + bww / 2, oy + ch - hb - 12, 22 if not hl else 20, TEXT, pc * ai, weight=700, align="center")
            if hl:
                ad = appear(t, x.cue(2) + 1.6, 0.6)
                h2 = (26.2 / mx * ch) * ad
                X2 = X + bw * 0.4
                rrect(c, X2, oy + ch - h2, bw * 0.3, h2, 6, stroke=MUTED, alpha=pc * ad, width=2)
                text(c, "26.2%", X2 + bw * 0.15, oy + ch - h2 - 12, 18, MUTED, pc * ad, align="center")
                text(c, "第二名", X2 + bw * 0.15, oy + ch - h2 - 36, 16, MUTED, pc * ad, align="center")
            text(c, str(yr), ox + i * bw + bw * 0.5, oy + ch + 30, 20, MUTED, pc, align="center")
            if nm:
                text(c, nm, ox + i * bw + bw * 0.5, oy + ch + 56, 18, A if hl else MUTED, pc * ai, align="center")
        hv = 5.1
        ah = appear(t, x.cue(2) + 3.2, 0.6)
        c.drawLine(ox, Y(hv), ox + cw * ah, Y(hv), paint(GREEN, pc, stroke=2))
        text(c, "人类 ≈ 5.1%", ox + cw - 6, Y(hv) - 10, 20, GREEN, pc * ah, align="right")
        text(c, "ImageNet 前五错误率（冠军）", ox, oy - 26, 22, MUTED, pc)


_WV = {"男人": (150, 450), "女人": (300, 500), "国王": (210, 200), "女王": (360, 250),
       "法国": (560, 470), "巴黎": (610, 300), "日本": (700, 500), "东京": (750, 330)}


@visual("word_vectors")
def word_vectors(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    for gx in range(0, w + 1, 60):
        line(c, gx, 40, gx, h - 60, MUTED, a * 0.06, 1)
    for gy in range(40, h - 59, 60):
        line(c, 0, gy, w, gy, MUTED, a * 0.06, 1)
    for i, (nm, (px_, py_)) in enumerate(_WV.items()):
        ai = appear(t, 0.4 + i * 0.25, 0.5)
        glow_dot(c, px_, py_, 9, A if i < 4 else BLUE, a * ai)
        text(c, nm, px_ + 16, py_ - 12, 26, TEXT, a * ai, weight=700)
    pv = x.phase(0, 1)
    if pv > 0.01:
        rrect(c, 40, 30, 560, 60, 12, fill="#0e1630", alpha=pv * 0.9)
        text(c, "国王 = [0.21, −0.57, 0.88, 0.03, …]", 60, 70, 26, A, pv, family="mono")
    pb = x.phase(1)
    if pb > 0.01:
        d1 = ease_out(prog(t, x.cue(1) + 0.5, 1.0))
        d2 = ease_out(prog(t, x.cue(1) + 1.6, 1.0))
        (mx, my), (wx, wy), (kx, ky), (qx, qy) = _WV["男人"], _WV["女人"], _WV["国王"], _WV["女王"]
        if d1 > 0:
            arrow(c, mx, my, lerp(mx, wx, d1), lerp(my, wy, d1), GOLD, pb, 4, 14)
        if d2 > 0:
            arrow(c, kx, ky, lerp(kx, qx, d2), lerp(ky, qy, d2), GOLD, pb, 4, 14)
        for (a_, b_) in [("法国", "巴黎"), ("日本", "东京")]:
            (x1, y1), (x2, y2) = _WV[a_], _WV[b_]
            d3 = ease_out(prog(t, x.cue(1) + 2.6, 1.0))
            if d3 > 0:
                arrow(c, x1, y1, lerp(x1, x2, d3), lerp(y1, y2, d3), BLUE, pb, 3, 12)
        rrect(c, 40, 30, 790, 66, 14, fill="#0e1630", alpha=pb * 0.92)
        text(c, "国王 − 男人 + 女人 ≈ 女王", w / 2 - 10, 76, 36, TEXT, pb, weight=700, align="center")


def _target_face(n=64):
    s = skia.Surface(n, n)
    cc = s.getCanvas()
    cc.drawRect(skia.Rect(0, 0, n, n), skia.Paint(Shader=linear_gradient(0, 0, 0, n, ["#7c4dff", "#ff8a65"])))
    cc.drawCircle(n / 2, n * 0.52, n * 0.3, paint("#ffe0b2"))
    cc.drawCircle(n * 0.4, n * 0.46, n * 0.04, paint("#1a1a2e"))
    cc.drawCircle(n * 0.6, n * 0.46, n * 0.04, paint("#1a1a2e"))
    cc.drawArc(skia.Rect.MakeXYWH(n * 0.38, n * 0.5, n * 0.24, n * 0.16), 20, 140, False, paint("#1a1a2e", stroke=n * 0.03))
    cc.drawArc(skia.Rect.MakeXYWH(n * 0.18, n * 0.16, n * 0.64, n * 0.5), 180, 180, False, paint("#4e342e", stroke=n * 0.1))
    return s.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType).astype(np.float32)


_FACE = None
_NOISE = None


@visual("gan")
def gan(c, x):
    global _FACE, _NOISE
    if _FACE is None:
        _FACE = _target_face()
        _NOISE = np.random.default_rng(7).uniform(0, 255, _FACE.shape).astype(np.float32)
        _NOISE[:, :, 3] = 255
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    q = ease_in_out(prog(t, 1.5, max(4.0, x.dur - 3)))
    blk = 64 // max(1, int(lerp(16, 1, q)))
    img = (1 - q) * _NOISE + q * _FACE
    if q < 0.95:
        f = max(1, int(lerp(16, 1, q)))
        small = img[::f, ::f]
        img = np.repeat(np.repeat(small, f, axis=0), f, axis=1)[:64, :64]
    img[:, :, 3] = 255
    im = _img_from_array(np.clip(img, 0, 255).astype(np.uint8))
    nz = _img_from_array(np.clip(_NOISE, 0, 255).astype(np.uint8))
    _draw_img(c, nz, 30, 250, 100, 100, a)
    text(c, "随机噪声", 80, 390, 20, MUTED, a, align="center")
    arrow(c, 140, 300, 190, 300, A, a, 3, 12)
    rrect(c, 200, 230, 150, 140, 20, fill=A, alpha=a * 0.18)
    rrect(c, 200, 230, 150, 140, 20, stroke=A, alpha=a, width=3)
    text(c, "生成器", 275, 290, 28, TEXT, a, weight=700, align="center")
    text(c, "G", 275, 335, 30, A, a, weight=700, align="center")
    arrow(c, 360, 300, 410, 300, A, a, 3, 12)
    _draw_img(c, im, 420, 220, 160, 160, a)
    text(c, "生成的图像", 500, 410, 20, MUTED, a, align="center")
    arrow(c, 590, 300, 640, 300, ORANGE, a, 3, 12)
    rrect(c, 650, 230, 170, 140, 20, fill=ORANGE, alpha=a * 0.18)
    rrect(c, 650, 230, 170, 140, 20, stroke=ORANGE, alpha=a, width=3)
    text(c, "判别器", 735, 290, 28, TEXT, a, weight=700, align="center")
    text(c, "D", 735, 335, 30, ORANGE, a, weight=700, align="center")
    face = _img_from_array(np.clip(_FACE, 0, 255).astype(np.uint8))
    _draw_img(c, face, 690, 60, 90, 90, a)
    text(c, "真实图像", 735, 180, 20, MUTED, a, align="center")
    arrow(c, 735, 190, 735, 222, ORANGE, a, 3, 12)
    pr = clamp(0.05 + 0.45 * q + 0.03 * math.sin(t * 3))
    text(c, f"“是真的”概率：{pr:.2f}", 735, 420, 22, ORANGE, a, align="center")
    poly(c, [(735, 440), (735, 520), (275, 520), (275, 380)], ORANGE, a * 0.5, stroke=2, closed=False)
    text(c, "反馈：哪里露出了破绽", 505, 552, 22, ORANGE, a * 0.9, align="center")
    epoch = int(lerp(0, 20000, q))
    text(c, f"训练轮次 {epoch:,}", w / 2, 620, 24, TEXT, a, align="center")


@visual("resnet")
def resnet(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 2)
    if pa > 0.01:
        n = 12
        bw, gap = 44, 22
        ox = (w - (n * bw + (n - 1) * gap)) / 2
        y0 = 260
        for i in range(n):
            X = ox + i * (bw + gap)
            ai = appear(t, 0.3 + i * 0.08, 0.4)
            rrect(c, X, y0 - 70, bw, 140, 8, fill=A, alpha=pa * ai * 0.3)
            rrect(c, X, y0 - 70, bw, 140, 8, stroke=A, alpha=pa * ai, width=2)
            if i < n - 1:
                arrow(c, X + bw + 2, y0, X + bw + gap - 2, y0, MUTED, pa * ai, 2, 7)
        for i in range(0, n - 2, 2):
            x1 = ox + i * (bw + gap) + bw / 2
            x2 = ox + (i + 2) * (bw + gap) + bw / 2
            p = skia.Path()
            p.moveTo(x1, y0 - 74)
            p.cubicTo(x1, y0 - 170, x2, y0 - 170, x2, y0 - 74)
            c.drawPath(p, paint(GOLD, pa * appear(t, 1.2 + i * 0.1, 0.5), stroke=3))
        u = (t * 0.25) % 1
        glow_dot(c, ox + u * (n * (bw + gap)), y0, 7, WHITE, pa)
        text(c, "跳跃连接：让信号“抄近路”", w / 2, y0 - 190, 26, GOLD, pa, align="center")
        text(c, "152 层", w / 2, y0 + 130, 48, TEXT, pa, weight=700, align="center")
        pb = x.phase(1, 2)
        if pb > 0.01:
            for k, (nm, v, colr) in enumerate([("ResNet", 3.57, A), ("人类", 5.1, GREEN)]):
                Y = 500 + k * 60
                text(c, nm, 220, Y + 8, 24, TEXT, pb, align="right")
                ww = 70 * v * ease_out(prog(t, x.cue(1) + 0.3 + k * 0.3, 0.8))
                rrect(c, 240, Y - 18, ww, 34, 6, fill=colr, alpha=pb)
                text(c, f"{v}%", 250 + ww, Y + 8, 22, colr, pb)
    pc = x.phase(2)
    if pc > 0.01:
        gx, gy, gw, gh = 180, 50, 510, 480
        rrect(c, gx - 6, gy - 6, gw + 12, gh + 12, 8, fill="#000000", alpha=pc)
        rrect(c, gx - 6, gy - 6, gw + 12, gh + 12, 8, stroke=MUTED, alpha=pc, width=2)
        T = t - x.cue(2)
        cols_ = ["#ff5252", "#ff9800", "#ffeb3b", "#4caf50", "#2196f3"]
        bx_, by_ = (gx + 40 + (T * 260) % (2 * (gw - 80))), 0
        bx_ = gx + 40 + abs(((T * 260) % (2 * (gw - 80))) - (gw - 80))
        by_ = gy + 200 + abs(((T * 330) % (2 * 240)) - 240)
        for r in range(5):
            for q in range(10):
                gone = rand(r * 10 + q) < clamp(T / 14) and r > 1
                if not gone:
                    c.drawRect(skia.Rect.MakeXYWH(gx + 5 + q * 50.5, gy + 30 + r * 22, 46, 18), paint(cols_[r], pc))
        circle(c, bx_, by_, 8, WHITE, pc)
        px_ = clamp(bx_ - 50, gx, gx + gw - 100)
        rrect(c, px_, gy + gh - 20, 100, 12, 4, fill="#90caf9", alpha=pc)
        text(c, f"SCORE {int(T * 37):04d}", gx + gw - 10, gy + 20, 18, WHITE, pc, family="mono", align="right")
        text(c, "DQN：只看像素和得分，自己学会打游戏", w / 2, 600, 24, TEXT, pc, align="center")


def _go_stones():
    rng = np.random.default_rng(37)
    stones = []
    occ = set()
    starts = [(3, 3), (15, 15), (3, 15), (15, 3), (9, 9), (2, 9), (16, 9)]
    k = 0
    while len(stones) < 120:
        if k < len(starts):
            p = starts[k]
        else:
            base = stones[int(rng.integers(max(1, len(stones) - 12), len(stones)))][0]
            p = (int(np.clip(base[0] + rng.integers(-2, 3), 0, 18)), int(np.clip(base[1] + rng.integers(-2, 3), 0, 18)))
        k += 1
        if p in occ:
            continue
        occ.add(p)
        stones.append((p, len(stones) % 2))
    return stones


_GO = _go_stones()


@visual("go")
def go(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    cs, ox, oy = 30, 40, 45
    rrect(c, ox - 22, oy - 22, cs * 18 + 44, cs * 18 + 44, 8, fill="#d8b46a", alpha=a)
    for i in range(19):
        line(c, ox, oy + i * cs, ox + 18 * cs, oy + i * cs, "#3a2a10", a, 1.4)
        line(c, ox + i * cs, oy, ox + i * cs, oy + 18 * cs, "#3a2a10", a, 1.4)
    for (q, r) in [(3, 3), (3, 9), (3, 15), (9, 3), (9, 9), (9, 15), (15, 3), (15, 9), (15, 15)]:
        circle(c, ox + q * cs, oy + r * cs, 4, "#3a2a10", a)
    n = int(len(_GO) * prog(t, 0.6, max(6.0, x.cue(4) - 0.6)))
    for i, ((q, r), clr) in enumerate(_GO[:n]):
        X, Y = ox + q * cs, oy + r * cs
        circle(c, X + 2, Y + 3, 13.5, "#000000", a * 0.35)
        if clr == 0:
            c.drawCircle(X, Y, 13.5, skia.Paint(AntiAlias=True, Shader=radial_gradient(X - 4, Y - 4, 16, ["#555555", "#0a0a0a"], [a, a])))
        else:
            c.drawCircle(X, Y, 13.5, skia.Paint(AntiAlias=True, Shader=radial_gradient(X - 4, Y - 4, 16, ["#ffffff", "#c8c8c8"], [a, a])))
    for ci, idx, nm in [(2, 36, "第 37 手"), (3, 77, "第 78 手")]:
        pm = x.phase(ci, ci + 1)
        if pm > 0.01 and idx < n:
            (q, r), _ = _GO[idx]
            X, Y = ox + q * cs, oy + r * cs
            pulse = 1 + 0.15 * math.sin(t * 5)
            circle(c, X, Y, 22 * pulse, RED, pm, stroke=4)
            tw = text_width(nm, 26, 700) + 24
            lx = min(X + 28, ox + 18 * cs - tw)
            rrect(c, lx, Y - 62, tw, 40, 10, fill="#1a0f0f", alpha=pm * 0.9)
            rrect(c, lx, Y - 62, tw, 40, 10, stroke=RED, alpha=pm, width=2)
            text(c, nm, lx + 12, Y - 32, 26, "#ff8a80", pm, weight=700)
    text(c, "示意图", ox + 18 * cs, oy + 18 * cs + 44, 16, MUTED, a * 0.8, align="right")
    rx = ox + 18 * cs + 50
    pa = x.phase(0, 1)
    if pa > 0.01:
        text(c, "围棋合法局面数", rx, 150, 22, MUTED, pa)
        text(c, "≈ 10", rx, 210, 46, A, pa, weight=700)
        text(c, "170", rx + 98, 182, 24, A, pa, weight=700)
        text(c, "宇宙原子数", rx, 290, 22, MUTED, pa)
        text(c, "≈ 10", rx, 350, 46, TEXT, pa, weight=700)
        text(c, "80", rx + 98, 322, 24, TEXT, pa, weight=700)
    pb = x.phase(1)
    if pb > 0.01:
        sc = "4 : 1" if t < x.cue(4) else "3 : 0"
        who = "李世石 · 2016" if t < x.cue(4) else "柯洁 · 2017"
        text(c, "AlphaGo", rx, 430, 32, A, pb, weight=700)
        text(c, sc, rx, 500, 60, GOLD, pb, weight=900)
        text(c, who, rx, 545, 22, TEXT, pb)
    pz = x.phase(4)
    if pz > 0.01:
        text(c, "AlphaGo Zero", rx, 130, 28, A, pz, weight=700)
        text(c, "不看人类棋谱", rx, 175, 22, TEXT, pz)
        text(c, "只靠自我对弈", rx, 210, 22, TEXT, pz)
        circle(c, rx + 70, 300, 46, A, pz, stroke=3)
        ang = t * 2
        for k in range(2):
            aa = ang + k * math.pi
            glow_dot(c, rx + 70 + 46 * math.cos(aa), 300 + 46 * math.sin(aa), 8, "#ffffff" if k else "#222222", pz)


@visual("trio")
def trio(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    ppl = [("GH", "杰弗里·辛顿", "Geoffrey Hinton", "反向传播\n深度信念网络"),
           ("YL", "杨立昆", "Yann LeCun", "卷积神经网络\nLeNet"),
           ("YB", "约书亚·本吉奥", "Yoshua Bengio", "神经语言模型\n注意力机制")]
    text(c, "2018 年度 ACM 图灵奖", w / 2, 60, 32, GOLD, a, weight=700, align="center")
    for k, (ini, zh, en, desc) in enumerate(ppl):
        ak = appear(t, 0.5 + k * 0.4, 0.7)
        cx0 = 150 + k * 285
        dy = 30 * (1 - ak)
        rrect(c, cx0 - 125, 110 + dy, 250, 440, 20, fill="#0e1630", alpha=a * ak * 0.95)
        rrect(c, cx0 - 125, 110 + dy, 250, 440, 20, stroke=A, alpha=a * ak * 0.6)
        c.drawCircle(cx0, 225 + dy, 74, skia.Paint(AntiAlias=True, Shader=radial_gradient(cx0 - 20, 205 + dy, 110, [A, "#1a2340"], [a * ak, a * ak])))
        text(c, ini, cx0, 245 + dy, 54, WHITE, a * ak, weight=700, align="center")
        text(c, zh, cx0, 350 + dy, 28, TEXT, a * ak, weight=700, align="center")
        text(c, en, cx0, 386 + dy, 20, MUTED, a * ak, align="center")
        text_block(c, desc, cx0, 445 + dy, 22, 220, color=A, alpha=a * ak, align="center", line_h=34)
    pb = x.phase(1)
    if pb > 0.01:
        text(c, "在神经网络的“寒冬”中坚持了几十年", w / 2, 610, 26, TEXT, pb, align="center")


# ---------------------------------------------------------------- 第十章

_TOK = ["小猫", "没有", "过", "马路", "，", "因为", "它", "太", "累", "了"]


def _attn(qi):
    rng = np.random.default_rng(qi + 3)
    v = rng.uniform(0.02, 0.15, len(_TOK))
    v[qi] += 0.35
    if _TOK[qi] == "它":
        v[:] = 0.03
        v[0] = 1.2
        v[8] = 0.3
        v[3] = 0.15
    return v / v.sum()


@visual("attention")
def attention(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        rrect(c, w / 2 - 260, 60, 520, 500, 6, fill="#f4f1ea", alpha=pa)
        text(c, "Attention Is All You Need", w / 2, 150, 36, "#151515", pa, family="serif", weight=700, align="center")
        authors = ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit",
                   "Llion Jones", "Aidan N. Gomez", "Łukasz Kaiser", "Illia Polosukhin"]
        for i, nm in enumerate(authors):
            text(c, nm, w / 2 - 120 + (i % 2) * 240, 210 + (i // 2) * 34, 17, "#333333", pa, family="lserif", align="center")
        for k in range(6):
            line(c, w / 2 - 210, 380 + k * 24, w / 2 + 210 - (80 if k == 5 else 0), 380 + k * 24, "#c9c2b2", pa, 7)
        text(c, "NeurIPS 2017", w / 2, 530, 18, "#555555", pa, family="serif", align="center")
    pb = x.phase(1, 2)
    if pb > 0.01:
        n = len(_TOK)
        xs = [70 + i * (w - 140) / (n - 1) for i in range(n)]
        y1, y2 = 140, 470
        qi = [6, 0, 3, 8, 6][int(max(0, t - x.cue(1)) / 2.4) % 5]
        att = _attn(qi)
        for j in range(n):
            wv = att[j]
            p = skia.Path()
            p.moveTo(xs[qi], y1 + 26)
            p.cubicTo(xs[qi], (y1 + y2) / 2, xs[j], (y1 + y2) / 2, xs[j], y2 - 40)
            c.drawPath(p, paint(A, pb * clamp(0.1 + wv * 2.2), stroke=1 + 16 * wv))
        for i, tk in enumerate(_TOK):
            hl = i == qi
            rrect(c, xs[i] - 34, y1 - 30, 68, 52, 10, fill=A if hl else "#101a36", alpha=pb * (0.9 if hl else 1))
            text(c, tk, xs[i], y1 + 6, 26, "#0b1020" if hl else TEXT, pb, weight=700, align="center")
            rrect(c, xs[i] - 34, y2 - 30, 68, 52, 10, fill="#101a36", alpha=pb)
            rrect(c, xs[i] - 34, y2 - 30, 68, 52, 10, stroke=A, alpha=pb * clamp(att[i] * 3), width=3)
            text(c, tk, xs[i], y2 + 6, 26, TEXT, pb, align="center")
        text(c, f"“{_TOK[qi]}”在关注谁？", w / 2, 600, 28, TEXT, pb, align="center")
    pc = x.phase(2, 3)
    if pc > 0.01:
        n = len(_TOK)
        cs = 44
        ox, oy = (w - n * cs) / 2 + 30, 90
        sweep = prog(t, x.cue(2) + 0.3, 1.2)
        for i in range(n):
            att = _attn(i)
            text(c, _TOK[i], ox - 14, oy + i * cs + 30, 20, TEXT, pc, align="right")
            text(c, _TOK[i], ox + i * cs + cs / 2, oy - 12, 20, TEXT, pc, align="center")
            for j in range(n):
                v = clamp(att[j] * 2.5) * clamp(sweep * 1.0)
                c.drawRect(skia.Rect.MakeXYWH(ox + j * cs + 1, oy + i * cs + 1, cs - 2, cs - 2), paint(A, pc * (0.06 + 0.94 * v)))
        text(c, "所有词同时计算，高度并行", w / 2, oy + n * cs + 50, 26, TEXT, pc, align="center")
    pd = x.phase(3)
    if pd > 0.01:
        bx, by = w / 2 - 170, 70
        rrect(c, bx, by, 340, 420, 24, fill="#0e1630", alpha=pd * 0.95)
        rrect(c, bx, by, 340, 420, 24, stroke=A, alpha=pd * 0.7, width=3)
        for k, s in enumerate(["多头自注意力", "相加 & 归一化", "前馈网络", "相加 & 归一化"]):
            Y = by + 50 + k * 92
            rrect(c, bx + 30, Y, 280, 62, 12, fill=A if k % 2 == 0 else "#26324f", alpha=pd * (0.3 if k % 2 == 0 else 0.9))
            text(c, s, bx + 170, Y + 40, 24, TEXT, pd, align="center")
        text(c, "× N", bx + 380, by + 220, 40, A, pd, weight=700)
        for k, nm in enumerate(["GPT", "BERT", "T5", "LLaMA", "Claude", "Gemini"]):
            ak = appear(t, x.cue(3) + 0.6 + k * 0.2, 0.5) * pd
            X = 90 + k * 138
            caption_tag(c, nm, X, 580, A, ak, size=20)


_PARAMS = [("GPT", 2018, 1.17e8, "1.17亿"), ("BERT-Large", 2018, 3.4e8, "3.4亿"), ("GPT-2", 2019, 1.5e9, "15亿"), ("GPT-3", 2020, 1.75e11, "1750亿")]


@visual("params")
def params(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        for k in range(5):
            rrect(c, 60 + k * 6, 220 - k * 22, 190, 150, 8, fill="#f4f1ea", alpha=pa * (0.4 + 0.12 * k))
        text(c, "海量文本", 160, 420, 26, TEXT, pa, align="center")
        arrow(c, 280, 270, 360, 270, A, pa, 4, 16)
        text(c, "预训练", 320, 240, 20, A, pa, align="center")
        circle(c, 440, 270, 70, A, pa * 0.25, blur=10)
        circle(c, 440, 270, 64, A, pa, stroke=4)
        text(c, "模型", 440, 280, 30, TEXT, pa, weight=700, align="center")
        for k, s in enumerate(["情感分析", "阅读理解", "文本分类"]):
            Y = 150 + k * 120
            arrow(c, 510, 270, 610, Y + 10, MUTED, pa * 0.8, 2, 10)
            caption_tag(c, s, 700, Y + 20, A, pa)
        text(c, "微调", 560, 180, 20, A, pa, align="center")
    pb = x.phase(1, 2)
    if pb > 0.01:
        ox, oy, cw, ch = 110, 70, 650, 440
        line(c, ox, oy + ch, ox + cw, oy + ch, MUTED, pb, 2)
        line(c, ox, oy, ox, oy + ch, MUTED, pb, 2)
        text(c, "计算量（对数）→", ox + cw, oy + ch + 40, 22, MUTED, pb, align="right")
        text(c, "损失（对数）", ox + 10, oy - 16, 22, MUTED, pb)
        d = ease_out(prog(t, x.cue(1) + 0.5, 2.0))
        line(c, ox + 20, oy + 40, lerp(ox + 20, ox + cw - 20, d), lerp(oy + 40, oy + ch - 60, d), A, pb, 4)
        for i in range(8):
            u = (i + 0.5) / 8
            if u < d:
                X = lerp(ox + 20, ox + cw - 20, u)
                Y = lerp(oy + 40, oy + ch - 60, u) + 14 * (rand(i) - 0.5)
                glow_dot(c, X, Y, 7, GOLD, pb)
        text(c, "规模定律：越大越强，而且可以预测", w / 2, 600, 26, TEXT, pb, align="center")
    pc = x.phase(2, 3)
    if pc > 0.01:
        ox, oy, cw, ch = 90, 70, 700, 440
        lo, hi = 7.5, 11.6
        Y = lambda v: oy + ch - (math.log10(v) - lo) / (hi - lo) * ch
        for e in range(8, 12):
            line(c, ox, Y(10 ** e), ox + cw, Y(10 ** e), MUTED, pc * 0.15, 1)
            text(c, ["1亿", "10亿", "100亿", "1000亿"][e - 8], ox - 10, Y(10 ** e) + 7, 18, MUTED, pc, align="right")
        bw = cw / len(_PARAMS)
        for i, (nm, yr, v, lab) in enumerate(_PARAMS):
            ai = ease_out(prog(t, x.cue(2) + i * 0.6, 0.8))
            top = lerp(oy + ch, Y(v), ai)
            X = ox + i * bw + bw * 0.2
            hl = nm == "GPT-3"
            rrect(c, X, top, bw * 0.6, oy + ch - top, 6, fill=A if hl else "#3d5a99", alpha=pc)
            text(c, lab, X + bw * 0.3, top - 12, 24, TEXT, pc * ai, weight=700, align="center")
            text(c, nm, X + bw * 0.3, oy + ch + 32, 20, TEXT, pc, align="center")
            text(c, str(yr), X + bw * 0.3, oy + ch + 58, 18, MUTED, pc, align="center")
        text(c, "参数量（对数坐标）", ox, oy - 20, 22, MUTED, pc)
    pd = x.phase(3)
    if pd > 0.01:
        rrect(c, 90, 80, w - 180, 420, 18, fill="#0a1022", alpha=pd)
        rrect(c, 90, 80, w - 180, 420, 18, stroke=A, alpha=pd * 0.6, width=2)
        text(c, "提示（Prompt）", 120, 125, 22, MUTED, pd)
        lines_ = [("英译中：", TEXT), ("cheese → 奶酪", TEXT), ("apple → 苹果", TEXT), ("sea otter →", TEXT)]
        for i, (s, colr) in enumerate(lines_):
            text(c, s, 130, 190 + i * 58, 30, colr, pd, family="mono")
        ans = typed(" 海獭", t, x.cue(3) + 1.8, 4)
        text(c, ans, 130 + text_width("sea otter →", 30, family="mono"), 190 + 3 * 58, 30, GREEN, pd, family="mono", weight=700)
        text(c, "只给几个例子，无需专门训练", w / 2, 580, 26, TEXT, pd, align="center")


def _catmull(pts, sub=4):
    out = []
    n = len(pts)
    for i in range(n - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, n - 1)]
        for k in range(sub):
            u = k / sub
            out.append(tuple(0.5 * ((2 * b) + (-a + c_) * u + (2 * a - 5 * b + 4 * c_ - d) * u * u + (-a + 3 * b - 3 * c_ + d) * u ** 3)
                             for a, b, c_, d in zip(p0, p1, p2, p3)))
    out.append(pts[-1])
    return out


def _protein_coords():
    """四螺旋束：4 段 α 螺旋（每段 18 个残基）由短环连接。"""
    hl, loop = 18, 6
    centers = [(-4.5, -4.5), (4.5, -4.5), (4.5, 4.5), (-4.5, 4.5)]
    folded = []
    for k, (cx, cz) in enumerate(centers):
        dirn = 1 if k % 2 == 0 else -1
        helix = []
        for j in range(hl):
            th = j * 2 * math.pi / 3.6 + k
            y = dirn * (j - hl / 2) * 0.95
            helix.append((cx + 2.3 * math.cos(th), y, cz + 2.3 * math.sin(th)))
        if folded:
            a_, b_ = folded[-1], helix[0]
            for q in range(1, loop + 1):
                u = q / (loop + 1)
                bulge = math.sin(u * math.pi) * 3.0
                folded.append((lerp(a_[0], b_[0], u) * (1 + 0.15 * bulge), lerp(a_[1], b_[1], u) + bulge * dirn * -1, lerp(a_[2], b_[2], u) * (1 + 0.15 * bulge)))
        folded += helix
    n = len(folded)
    flat = [((i - n / 2) * 0.33, 1.0 * math.sin(i * 0.8), 0.8 * math.cos(i * 0.6)) for i in range(n)]
    return _catmull(folded), _catmull(flat)


_PF, _PU = _protein_coords()


@visual("protein")
def protein(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    f = ease_in_out(prog(t, x.cue(1) * 0.6 + 0.5, max(4.0, x.cue(2) + 2 - x.cue(1) * 0.6)))
    rot = t * 0.45
    cx, cy, sc = lerp(w / 2, w / 2 - 70, f), h / 2 - 30, 21
    pts = []
    for i, (p1, p2) in enumerate(zip(_PF, _PU)):
        X = lerp(p2[0], p1[0], f)
        Y = lerp(p2[1], p1[1], f)
        Z = lerp(p2[2], p1[2], f)
        tilt = 0.35 * f
        Y, Z = Y * math.cos(tilt) - Z * math.sin(tilt), Y * math.sin(tilt) + Z * math.cos(tilt)
        xr = X * math.cos(rot) + Z * math.sin(rot)
        zr = -X * math.sin(rot) + Z * math.cos(rot)
        persp = 1 / (1 + zr * 0.025)
        pts.append((cx + xr * sc * persp, cy + Y * sc * persp, zr))
    n = len(pts)
    segs = sorted(range(n - 1), key=lambda i: -(pts[i][2] + pts[i + 1][2]))
    for i in segs:
        u = i / (n - 1)
        colr = (int(lerp(60, 255, u)), int(90 + 120 * (1 - abs(u - 0.5) * 2)), int(lerp(255, 80, u)))
        shade = clamp(0.65 - pts[i][2] * 0.05, 0.3, 1)
        dark = tuple(int(v * shade) for v in colr)
        line(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], dark, a, 11)
        line(c, pts[i][0], pts[i][1] - 2, pts[i + 1][0], pts[i + 1][1] - 2, colr, a * shade, 4)
    text(c, "氨基酸链  →  三维结构", w / 2 - 70, h - 12, 24, MUTED, a, align="center")
    pb = x.phase(2)
    if pb > 0.01:
        card(c, w - 260, 60, 230, 170, A, pb, title="CASP14")
        text(c, "92.4", w - 145, 175, 56, GOLD, pb, weight=900, align="center")
        text(c, "GDT 中位数（满分100）", w - 145, 212, 16, MUTED, pb, align="center")
    pc = x.phase(3)
    if pc > 0.01:
        n_ = int(200_000_000 * ease_out(prog(t, x.cue(3), 2.0)))
        card(c, w - 260, 260, 230, 150, A, pc)
        text(c, f"{n_ / 1e8:.2f} 亿+", w - 145, 335, 40, TEXT, pc, weight=700, align="center")
        text(c, "个结构预测，免费开放", w - 145, 375, 18, MUTED, pc, align="center")


def _planet(n=192):
    s = skia.Surface(n, n)
    cc = s.getCanvas()
    cc.drawRect(skia.Rect(0, 0, n, n), skia.Paint(Shader=linear_gradient(0, 0, 0, n, ["#120a3a", "#3b1d6e", "#0a1a40"])))
    for i in range(60):
        cc.drawCircle(rand(i * 3) * n, rand(i * 7) * n, 0.6 + 1.2 * rand(i), paint("#ffffff", 0.8))
    cx, cy, r = n * 0.52, n * 0.55, n * 0.24
    ring = skia.Rect.MakeXYWH(cx - r * 1.9, cy - r * 0.45, r * 3.8, r * 0.9)
    cc.drawArc(ring, 180, 180, False, paint("#ffd59e", 0.9, stroke=n * 0.03))
    cc.drawCircle(cx, cy, r, skia.Paint(AntiAlias=True, Shader=radial_gradient(cx - r * 0.4, cy - r * 0.4, r * 1.6, ["#ffcc80", "#ff7043", "#6a1b4d"])))
    cc.drawArc(ring, 0, 180, False, paint("#ffd59e", 0.95, stroke=n * 0.03))
    return s.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType).astype(np.float32)


_PLANET = None
_PNOISE = None


@visual("diffusion")
def diffusion(c, x):
    global _PLANET, _PNOISE
    if _PLANET is None:
        _PLANET = _planet()
        _PNOISE = np.random.default_rng(3).normal(0, 1, _PLANET.shape).astype(np.float32)
    t, w, h = x.t, x.w, x.h
    A = x.accent

    def noisy(level):
        ab = 1 - level
        img = math.sqrt(ab) * (_PLANET / 127.5 - 1) + math.sqrt(1 - ab) * _PNOISE
        arr = np.clip((img + 1) * 127.5, 0, 255)
        arr[:, :, 3] = 255
        return _img_from_array(arr.astype(np.uint8))

    pa = x.phase(0, 3)
    if pa > 0.01:
        rrect(c, 40, 30, w - 80, 64, 14, fill="#0e1630", alpha=pa * 0.95)
        rrect(c, 40, 30, w - 80, 64, 14, stroke=A, alpha=pa * 0.6)
        prompt = "一颗带光环的行星，漂浮在星空中"
        text(c, typed(prompt, t, 0.5, 8), 64, 72, 28, TEXT, pa)
        if x.t < x.cue(2) - 0.2 or x.t > x.cue(2) + 6.5:
            st = x.cue(2) + 6.5 if x.t > x.cue(2) else 2.5
            lvl = 1 - ease_in_out(prog(t, st, 5.0))
            _draw_img(c, noisy(min(0.999, lvl)), w / 2 - 210, 120, 420, 420, pa)
            steps = int(1000 * lvl)
            text(c, f"去噪步骤：{steps:4d} / 1000", w / 2, 590, 24, MUTED, pa, align="center")
        else:
            for k in range(5):
                lvl = k / 4 * 0.98
                X = 50 + k * 160
                ak = appear(t, x.cue(2) + k * 0.5, 0.4)
                _draw_img(c, noisy(lvl), X, 230, 140, 140, pa * ak)
                if k < 4:
                    arrow(c, X + 142, 300, X + 158, 300, MUTED, pa * ak, 2, 7)
            rp = appear(t, x.cue(2) + 3.0, 0.5)
            arrow(c, 750, 420, 120, 420, GOLD, pa * rp, 4, 16)
            text(c, "加噪声 →", w / 2, 200, 24, MUTED, pa, align="center")
            text(c, "← 学会反过来“去噪”", w / 2, 470, 26, GOLD, pa * rp, align="center")
    pb = x.phase(3)
    if pb > 0.01:
        rrect(c, 40, 40, w - 80, 520, 16, fill="#0a1022", alpha=pb)
        rrect(c, 40, 40, w - 80, 520, 16, stroke="#2c3a60", alpha=pb)
        code = ["def fibonacci(n):", '    """返回第 n 个斐波那契数"""']
        ghost = ["    a, b = 0, 1", "    for _ in range(n):", "        a, b = b, a + b", "    return a"]
        for i, s in enumerate(code):
            text(c, s, 80, 120 + i * 50, 26, TEXT, pb, family="mono")
        gp = prog(t, x.cue(3) + 1.0, 1.0)
        for i, s in enumerate(ghost):
            text(c, s, 80, 220 + i * 50, 26, "#7f8bb0", pb * gp * 0.8, family="mono")
        caption_tag(c, "Tab 接受补全", w - 190, 500, A, pb * gp, size=20)


@visual("chat")
def chat(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 2)
    if pa > 0.01:
        rrect(c, 60, 30, w - 120, 580, 22, fill="#0d1224", alpha=pa)
        rrect(c, 60, 30, w - 120, 580, 22, stroke="#2c3a60", alpha=pa)
        text(c, "ChatGPT", w / 2, 75, 24, TEXT, pa, weight=700, align="center")
        line(c, 60, 98, w - 60, 98, "#2c3a60", pa, 1.5)
        convo = [("u", "用一句话解释什么是人工智能。"),
                 ("a", "人工智能是让计算机像人一样感知、学习、推理和解决问题的技术。"),
                 ("u", "再用它写一首四行小诗。"),
                 ("a", "从图灵的提问，到今天的对话；机器学会了倾听，也学会了回答。")]
        y = 140
        clock = 0.8
        for who, s in convo:
            if who == "u":
                if t < clock:
                    break
                tw = min(text_width(s, 24) + 40, 560)
                ap = appear(t, clock, 0.4)
                rrect(c, w - 100 - tw, y - 4, tw, 54, 22, fill=A, alpha=pa * ap * 0.9)
                text(c, s, w - 100 - tw / 2, y + 31, 24, "#0b1020", pa * ap, align="center")
                y += 80
                clock += 1.4
            else:
                shown = typed(s, t, clock, 9)
                if not shown:
                    break
                lines_ = wrap(shown, 24, 520)
                bh = 30 + len(lines_) * 38
                circle(c, 120, y + 22, 20, "#10a37f", pa)
                rrect(c, 155, y - 4, 560, bh, 20, fill="#1b2340", alpha=pa)
                for i, ln in enumerate(lines_):
                    text(c, ln, 180, y + 34 + i * 38, 24, TEXT, pa)
                y += bh + 26
                clock += len(s) / 9 + 1.0
    pb = x.phase(2)
    if pb > 0.01:
        text(c, "用户数达到 1 亿所用的时间", w / 2, 70, 28, TEXT, pb, weight=700, align="center")
        data = [("ChatGPT", 2, A), ("TikTok", 9, "#3d5a99"), ("Instagram", 30, "#3d5a99")]
        for i, (nm, mo, colr) in enumerate(data):
            Y = 160 + i * 110
            text(c, nm, 210, Y + 10, 26, TEXT, pb, align="right")
            ww = 18 * mo * ease_out(prog(t, x.cue(2) + 0.3 + i * 0.3, 1.0))
            rrect(c, 230, Y - 22, max(ww, 4), 50, 8, fill=colr, alpha=pb)
            text(c, f"{mo} 个月", 244 + ww, Y + 12, 26, colr if i == 0 else MUTED, pb, weight=700)
        pc = x.phase(3)
        if pc > 0.01:
            for i in range(60):
                q, r = i % 15, i // 15
                ap = appear(t, x.cue(3) + i * 0.03, 0.3)
                person(c, 110 + q * 46, 500 + r * 40, 24, A if rand(i) > 0.3 else MUTED, pb * pc * ap)


# ---------------------------------------------------------------- 第十一章

_STARS = [(0, "ChatGPT", 435, 330, 1.3), (1, "GPT-4", 260, 200, 1.1), (2, "Claude", 610, 170, 1.1),
          (2, "Gemini", 700, 350, 1.0), (2, "LLaMA", 560, 500, 1.0), (3, "文心一言", 200, 430, 1.0),
          (3, "通义千问", 330, 560, 1.0), (3, "DeepSeek", 120, 290, 0.85), (3, "Mistral", 760, 520, 0.8),
          (3, "Kimi", 800, 220, 0.8), (3, "GLM", 430, 110, 0.8)]


@visual("constellation")
def constellation(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    vis = []
    for k, (ci, nm, sx, sy, s) in enumerate(_STARS):
        st = (x.cue(ci) + (k % 4) * 0.35) if ci else 0.2
        a = appear(t, st, 0.8)
        vis.append(a)
    for k in range(1, len(_STARS)):
        a = min(vis[0], vis[k])
        if a > 0.01:
            line(c, _STARS[0][2], _STARS[0][3], _STARS[k][2], _STARS[k][3], A, a * 0.25, 1.5)
    for k, (ci, nm, sx, sy, s) in enumerate(_STARS):
        a = vis[k]
        if a <= 0.01:
            continue
        tw = 0.8 + 0.2 * math.sin(t * 2 + k)
        glow_dot(c, sx, sy, 10 * s * tw, "#ffffff" if k == 0 else A, a, glow=3.5)
        text(c, nm, sx, sy + 44 * s, int(26 * s), TEXT, a, weight=700, align="center")
    pb = x.phase(1)
    if pb > 0.01:
        caption_tag(c, "2023 · 全球大模型竞赛", w / 2, 40, A, pb)


def _icon(c, kind, cx, cy, s, colr, a):
    if kind == 0:
        for k in range(4):
            line(c, cx - s * 0.5, cy - s * 0.35 + k * s * 0.24, cx + s * (0.5 if k < 3 else 0.1), cy - s * 0.35 + k * s * 0.24, colr, a, 4)
    elif kind == 1:
        rrect(c, cx - s * 0.55, cy - s * 0.42, s * 1.1, s * 0.84, 6, stroke=colr, alpha=a, width=3)
        poly(c, [(cx - s * 0.45, cy + s * 0.32), (cx - s * 0.1, cy - s * 0.1), (cx + s * 0.15, cy + s * 0.15), (cx + s * 0.28, cy), (cx + s * 0.45, cy + s * 0.32)], colr, a)
        circle(c, cx + s * 0.25, cy - s * 0.2, s * 0.09, colr, a)
    elif kind == 2:
        for k in range(9):
            hh = s * (0.2 + 0.6 * abs(math.sin(k * 1.3 + 0.5)))
            line(c, cx - s * 0.48 + k * s * 0.12, cy - hh / 2, cx - s * 0.48 + k * s * 0.12, cy + hh / 2, colr, a, 4)
    else:
        rrect(c, cx - s * 0.55, cy - s * 0.4, s * 1.1, s * 0.8, 8, stroke=colr, alpha=a, width=3)
        poly(c, [(cx - s * 0.15, cy - s * 0.22), (cx + s * 0.25, cy), (cx - s * 0.15, cy + s * 0.22)], colr, a)


@visual("multimodal")
def multimodal(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    cx, cy = w / 2, h / 2 - 20
    merge = x.phase(3)
    R = 230 - 80 * merge
    c.drawCircle(cx, cy, 90, skia.Paint(AntiAlias=True, Shader=radial_gradient(cx, cy, 120, ["#ffffff", A, A], [a, a * 0.6, 0], [0, 0.4, 1])))
    circle(c, cx, cy, 70 + 6 * math.sin(t * 2), A, a, stroke=3)
    text(c, "模型", cx, cy + 12, 32, "#0b1020", a, weight=900, align="center")
    names = ["文本", "图像", "音频", "视频"]
    for k in range(4):
        ak = a * (appear(t, 0.3, 0.6) if k == 0 else x.phase(1) * appear(t, x.cue(1) + k * 0.3, 0.6))
        if ak <= 0.01:
            continue
        ang = -math.pi / 2 + k * math.pi / 2 + t * 0.15
        px_, py_ = cx + R * math.cos(ang), cy + R * math.sin(ang) * 0.85
        for j in range(5):
            u = ((t * 0.5 + j / 5) % 1)
            glow_dot(c, lerp(px_, cx, u), lerp(py_, cy, u), 4, A, ak * math.sin(u * math.pi), glow=2.5)
        circle(c, px_, py_, 62, "#101a36", ak)
        circle(c, px_, py_, 62, A, ak, stroke=3)
        _icon(c, k, px_, py_ - 8, 52, TEXT, ak)
        text(c, names[k], px_, py_ + 92, 24, TEXT, ak, align="center")
    pb = x.phase(2, 3)
    if pb > 0.01:
        caption_tag(c, "2024.2 Sora · 文字生成视频    2024.5 GPT-4o · 实时语音", w / 2, h - 16, A, pb, size=22)


@visual("reasoning")
def reasoning(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        rrect(c, 40, 30, w - 80, 100, 16, fill="#0e1630", alpha=pa * 0.95)
        rrect(c, 40, 30, w - 80, 100, 16, stroke=A, alpha=pa * 0.6)
        text(c, "球拍和球一共 1.10 元，球拍比球贵 1 元。", 70, 74, 26, TEXT, pa)
        text(c, "球多少钱？", 70, 112, 26, TEXT, pa)
        steps = ["设球的价格为 x 元", "那么球拍为 x + 1 元", "x + (x + 1) = 1.10", "2x = 0.10，所以 x = 0.05"]
        step_t = max(0.6, (x.cue(1) - 3.0) / (len(steps) + 1))
        text(c, "思考中 …" if t < 1.0 + len(steps) * step_t else "思考完成", 70, 180, 22, MUTED, pa)
        for i, s in enumerate(steps):
            ai = appear(t, 1.0 + i * step_t, 0.5)
            Y = 230 + i * 70
            glow_dot(c, 90, Y - 8, 7, A, pa * ai)
            if i < len(steps) - 1:
                line(c, 90, Y + 4, 90, Y + 56, A, pa * ai * 0.4, 2)
            text(c, s, 120, Y, 26, TEXT, pa * ai, family="mono" if "=" in s else "sans")
        af = appear(t, 1.0 + len(steps) * step_t, 0.6)
        rrect(c, 520, 470, 290, 80, 16, fill=GREEN, alpha=pa * af * 0.2)
        rrect(c, 520, 470, 290, 80, 16, stroke=GREEN, alpha=pa * af, width=3)
        text(c, "答案：0.05 元", 665, 522, 32, GREEN, pa * af, weight=700, align="center")
    pb = x.phase(1, 2)
    if pb > 0.01:
        card(c, 60, 60, 340, 220, A, pb, title="DeepSeek-R1", body="开源权重 · MIT 许可\n用强化学习激发推理能力", title_size=32)
        ox, oy, cw, ch = 460, 80, 360, 260
        line(c, ox, oy + ch, ox + cw, oy + ch, MUTED, pb, 2)
        line(c, ox, oy, ox, oy + ch, MUTED, pb, 2)
        d = ease_out(prog(t, x.cue(1) + 0.5, 3.0))
        p = skia.Path()
        for i in range(int(80 * d) + 1):
            u = i / 80
            v = 0.1 + 0.8 * u ** 1.3 + 0.04 * math.sin(i * 1.9)
            (p.moveTo if i == 0 else p.lineTo)(ox + u * cw, oy + ch - v * ch)
        c.drawPath(p, paint(A, pb, stroke=3))
        text(c, "思考长度", ox + 8, oy - 12, 20, MUTED, pb)
        text(c, "强化学习训练步数 →", ox + cw, oy + ch + 32, 20, MUTED, pb, align="right")
        text(c, "模型自己学会了“想得更久”", w / 2, 520, 28, TEXT, pb, align="center")
    pc = x.phase(2)
    if pc > 0.01:
        cx, cy = w / 2, 270
        rot = math.sin(t * 1.2) * 4
        c.save()
        c.translate(cx, cy)
        c.rotate(rot)
        poly(c, [(-60, -260), (-20, -120), (20, -120), (60, -260)], "#c62828", pc)
        c.drawCircle(0, 0, 130, skia.Paint(AntiAlias=True, Shader=radial_gradient(-40, -40, 200, ["#fff3b0", GOLD, "#b8860b"], [pc, pc, pc])))
        circle(c, 0, 0, 108, "#8a6508", pc, stroke=3)
        text(c, "IMO", 0, -10, 52, "#5a3d00", pc, weight=900, align="center")
        text(c, "2025", 0, 44, 34, "#5a3d00", pc, weight=700, align="center")
        c.restore()
        text(c, "金牌水平 · 6 题解出 5 题", w / 2, 480, 32, TEXT, pc, weight=700, align="center")
        text(c, "谷歌 DeepMind · OpenAI", w / 2, 528, 24, MUTED, pc, align="center")


def _medal(c, cx, cy, r, title, a):
    c.drawCircle(cx, cy, r, skia.Paint(AntiAlias=True, Shader=radial_gradient(cx - r * 0.3, cy - r * 0.3, r * 1.6, ["#fff3b0", GOLD, "#a87508"], [a, a, a])))
    circle(c, cx, cy, r * 0.84, "#8a6508", a, stroke=3)
    for k in range(14):
        ang = math.pi * 0.62 + k * 0.13
        for s in (-1, 1):
            X = cx + s * r * 0.7 * math.cos(ang)
            Y = cy + r * 0.7 * math.sin(ang)
            c.save()
            c.translate(X, Y)
            c.rotate(math.degrees(ang) * s + 90)
            c.drawOval(skia.Rect.MakeXYWH(-4, -9, 8, 18), paint("#8a6508", a))
            c.restore()
    text(c, "2024", cx, cy - 6, r * 0.32, "#5a3d00", a, weight=900, align="center")
    text(c, title, cx, cy + r * 0.34, r * 0.2, "#5a3d00", a, weight=700, align="center")


@visual("nobel")
def nobel(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    text(c, "诺贝尔奖 · 2024", w / 2, 60, 34, GOLD, a, weight=700, align="center")
    pa = x.phase(1)
    if pa > 0.01:
        _medal(c, 220, 250, 120, "物理学奖", pa)
        text(c, "约翰·霍普菲尔德", 220, 430, 28, TEXT, pa, weight=700, align="center")
        text(c, "杰弗里·辛顿", 220, 474, 28, TEXT, pa, weight=700, align="center")
        text_block(c, "为利用人工神经网络进行机器学习奠定基础", 100, 525, 20, 240, color=MUTED, alpha=pa, line_h=28)
    pb = x.phase(2)
    if pb > 0.01:
        _medal(c, 650, 250, 120, "化学奖", pb)
        text(c, "德米斯·哈萨比斯", 650, 430, 28, TEXT, pb, weight=700, align="center")
        text(c, "约翰·江珀", 650, 474, 28, TEXT, pb, weight=700, align="center")
        text(c, "大卫·贝克", 650, 518, 28, TEXT, pb, weight=700, align="center")
        text(c, "蛋白质结构预测 · 计算蛋白质设计", 650, 560, 20, MUTED, pb, align="center")
    pc = x.phase(3)
    if pc > 0.01:
        line(c, 120, 620, 750, 620, A, pc, 3)
        for X, s in [(120, "1982"), (300, "1986"), (750, "2024")]:
            glow_dot(c, X, 620, 7, A, pc)
            text(c, s, X, 652, 20, TEXT, pc, align="center")


@visual("agent")
def agent(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    cx, cy, R = 230, 300, 160
    nodes = ["规划", "行动", "观察", "反思"]
    circle(c, cx, cy, R, A, a * 0.35, stroke=2)
    for k, nm in enumerate(nodes):
        ang = -math.pi / 2 + k * math.pi / 2
        X, Y = cx + R * math.cos(ang), cy + R * math.sin(ang)
        circle(c, X, Y, 48, "#101a36", a)
        circle(c, X, Y, 48, A, a, stroke=3)
        text(c, nm, X, Y + 10, 26, TEXT, a, weight=700, align="center")
    ang = -math.pi / 2 + t * 1.1
    glow_dot(c, cx + R * math.cos(ang), cy + R * math.sin(ang), 9, GOLD, a)
    text(c, "AI", cx, cy - 4, 46, A, a, weight=900, align="center")
    text(c, "智能体", cx, cy + 34, 22, MUTED, a, align="center")
    tools = [">_", "</>", "www", "{ }"]
    for k, s in enumerate(tools):
        ang2 = -math.pi / 4 + k * math.pi / 2
        X, Y = cx + (R + 95) * math.cos(ang2), cy + (R + 95) * math.sin(ang2)
        ak = x.phase(1) * appear(t, x.cue(1) + k * 0.3, 0.5)
        rrect(c, X - 32, Y - 26, 64, 52, 10, fill="#0e1630", alpha=ak)
        rrect(c, X - 32, Y - 26, 64, 52, 10, stroke=MUTED, alpha=ak)
        text(c, s, X, Y + 9, 22, TEXT, ak, family="mono", align="center")
    lx, ly = 520, 70
    rrect(c, lx - 20, ly - 40, 360, 560, 16, fill="#0a1022", alpha=a)
    rrect(c, lx - 20, ly - 40, 360, 560, 16, stroke="#2c3a60", alpha=a)
    log = ["› 理解任务：修复登录错误", "› 搜索相关代码", "› 阅读 auth.py", "› 定位问题：令牌过期判断", "› 修改代码",
           "› 运行测试 …", "✓ 42 项测试通过", "› 提交更改并总结"]
    for i, s in enumerate(log):
        ai = appear(t, 0.8 + i * max(0.8, (x.dur - 3) / len(log)), 0.4)
        colr = GREEN if s.startswith("✓") else TEXT
        text(c, s, lx, ly + 20 + i * 62, 22, colr, a * ai, family="sans")


def _lock(c, cx, cy, s, colr, a):
    rrect(c, cx - s * 0.4, cy - s * 0.05, s * 0.8, s * 0.6, 6, fill=colr, alpha=a)
    c.drawArc(skia.Rect.MakeXYWH(cx - s * 0.26, cy - s * 0.45, s * 0.52, s * 0.8), 180, 180, False, paint(colr, a, stroke=s * 0.09))


@visual("risks")
def risks(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    items = [(1, "幻觉", "一本正经地编造"), (2, "偏见", "放大数据中的偏见"), (2, "隐私", "个人信息泄露"),
             (2, "版权", "训练数据与创作"), (2, "虚假信息", "深度伪造"), (2, "就业", "工作方式的冲击")]
    for k, (ci, nm, desc) in enumerate(items):
        ak = x.phase(ci) * appear(t, x.cue(ci) + (k - 1) * 0.5 if ci == 2 else x.cue(ci), 0.5) if ci else 1
        if ak <= 0.01:
            continue
        q, r = k % 3, k // 3
        X, Y = 30 + q * 280, 30 + r * 250
        rrect(c, X, Y, 260, 225, 18, fill="#0e1630", alpha=ak * 0.95)
        rrect(c, X, Y, 260, 225, 18, stroke=A, alpha=ak * 0.5, width=2)
        ix, iy = X + 130, Y + 75
        if nm == "幻觉":
            rrect(c, ix - 45, iy - 35, 90, 60, 14, stroke=TEXT, alpha=ak, width=3)
            text(c, "?!", ix, iy + 10, 32, ORANGE, ak, weight=900, align="center")
        elif nm == "偏见":
            line(c, ix, iy - 40, ix, iy + 35, TEXT, ak, 3)
            line(c, ix - 50, iy - 15, ix + 50, iy - 35, TEXT, ak, 3)
            circle(c, ix - 50, iy + 5, 16, TEXT, ak, stroke=3)
            circle(c, ix + 50, iy - 15, 16, TEXT, ak, stroke=3)
        elif nm == "隐私":
            _lock(c, ix, iy, 70, TEXT, ak)
        elif nm == "版权":
            circle(c, ix, iy, 36, TEXT, ak, stroke=4)
            text(c, "C", ix, iy + 14, 40, TEXT, ak, weight=900, align="center")
        elif nm == "虚假信息":
            person(c, ix - 25, iy - 15, 50, TEXT, ak)
            person(c, ix + 25, iy - 15, 50, ORANGE, ak * 0.7)
        else:
            rrect(c, ix - 42, iy - 22, 84, 58, 8, stroke=TEXT, alpha=ak, width=3)
            rrect(c, ix - 16, iy - 38, 32, 18, 5, stroke=TEXT, alpha=ak, width=3)
        text(c, nm, X + 130, Y + 165, 30, TEXT, ak, weight=700, align="center")
        text(c, desc, X + 130, Y + 200, 20, MUTED, ak, align="center")
    pd = x.phase(3)
    if pd > 0.01:
        rrect(c, 30, 545, w - 60, 90, 18, fill=A, alpha=pd * 0.2)
        rrect(c, 30, 545, w - 60, 90, 18, stroke=A, alpha=pd, width=3)
        text(c, "安全与对齐：让 AI 始终可控、与人类价值观一致", w / 2, 602, 28, TEXT, pd, weight=700, align="center")


@visual("governance")
def governance(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    cx, cy, R = 200, 300, 170
    circle(c, cx, cy, R + 20, A, a * 0.2, blur=20)
    circle(c, cx, cy, R, "#0e1630", a)
    for k in range(6):
        ph = (t * 0.25 + k * math.pi / 6) % math.pi
        ww = R * abs(math.cos(ph))
        c.drawOval(skia.Rect.MakeXYWH(cx - ww, cy - R, 2 * ww + 0.1, 2 * R), paint(A, a * 0.5, stroke=1.5))
    for k in range(1, 6):
        yy = cy - R + k * 2 * R / 6
        hw = math.sqrt(max(0, R * R - (yy - cy) ** 2))
        line(c, cx - hw, yy, cx + hw, yy, A, a * 0.4, 1.5)
    circle(c, cx, cy, R, A, a, stroke=3)
    for k in range(3):
        ang = t * 0.25 + k * 2.1
        if math.cos(ang) > 0:
            glow_dot(c, cx + R * 0.8 * math.sin(ang), cy - 60 + k * 60, 7, GOLD, a)
    items = [(1, "2023.8", "中国", "《生成式人工智能服务\n管理暂行办法》施行"),
             (2, "2023.11", "英国 · 布莱切利园", "首届人工智能安全峰会\n《布莱切利宣言》"),
             (3, "2024.8", "欧盟", "《人工智能法案》生效")]
    for k, (ci, date, place, body) in enumerate(items):
        ak = x.phase(ci)
        if ak <= 0.01:
            continue
        Y = 40 + k * 190
        rrect(c, 420, Y, 430, 170, 16, fill="#0e1630", alpha=ak * 0.95)
        rrect(c, 420, Y, 430, 170, 16, stroke=A, alpha=ak * 0.6, width=2)
        text(c, date, 445, Y + 44, 28, A, ak, weight=700)
        text(c, place, 445 + text_width(date, 28, 700) + 18, Y + 42, 22, MUTED, ak)
        for i, ln in enumerate(body.split("\n")):
            text(c, ln, 445, Y + 92 + i * 36, 24, TEXT, ak)
    pd = x.phase(4)
    if pd > 0.01:
        caption_tag(c, "鼓励创新  ⚖  防范风险", cx, h - 30, A, pd, size=24)
