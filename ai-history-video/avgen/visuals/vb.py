"""插图（中）：第五章至第八章。"""
import math

import numpy as np
import skia

from ..gfx import (DIM, MUTED, TEXT, WHITE, appear, arrow, circle, clamp, ease_in_out, ease_out, glow_dot,
                   lerp, line, paint, poly, prog, rand, rrect, text, text_block, text_width)
from . import caption_tag, card, gear, visual

ORANGE = "#ffb454"
BLUE = "#5ad1f0"
RED = "#ff6b6b"
GREEN = "#7ee787"


def _plot_frame(c, ox, oy, s, a):
    rrect(c, ox, oy, s, s, 12, fill="#0c1430", alpha=a * 0.9)
    rrect(c, ox, oy, s, s, 12, stroke="#2c3a60", alpha=a)


def _pt(c, X, Y, cls, a, r=14):
    if cls:
        circle(c, X, Y, r, BLUE, a)
    else:
        line(c, X - r * 0.8, Y - r * 0.8, X + r * 0.8, Y + r * 0.8, ORANGE, a, 5)
        line(c, X - r * 0.8, Y + r * 0.8, X + r * 0.8, Y - r * 0.8, ORANGE, a, 5)


# ---------------------------------------------------------------- 第五章

@visual("xor")
def xor(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    ox, oy, s = 70, 70, 420

    def grid_pts(lab, a):
        for (px_, py_), cls in lab:
            _pt(c, ox + 70 + px_ * (s - 140), oy + s - 70 - py_ * (s - 140), cls, a)
        text(c, "0", ox + 70, oy + s + 32, 22, MUTED, a, align="center")
        text(c, "1", ox + s - 70, oy + s + 32, 22, MUTED, a, align="center")

    pa = x.phase(0, 1)
    if pa > 0.01:
        _plot_frame(c, ox, oy, s, pa)
        grid_pts([((0, 0), 0), ((0, 1), 0), ((1, 0), 0), ((1, 1), 1)], pa)
        c.save()
        c.clipRect(skia.Rect(ox, oy, ox + s, oy + s))
        line(c, ox + s * 0.45, oy, ox + s, oy + s * 0.55, A, pa, 4)
        c.restore()
        text(c, "与 AND", 560, 200, 40, TEXT, pa, weight=700)
        text(c, "一条直线就能分开", 560, 260, 28, MUTED, pa)
        text(c, "✓", 560, 360, 80, GREEN, pa, family="symbol")
    pb = x.phase(1, 2)
    if pb > 0.01:
        _plot_frame(c, ox, oy, s, pb)
        grid_pts([((0, 0), 0), ((1, 1), 0), ((0, 1), 1), ((1, 0), 1)], pb)
        ang = (t - x.cue(1)) * 0.9
        cx, cy = ox + s / 2 + 40 * math.sin(t * 0.7), oy + s / 2
        c.save()
        c.clipRect(skia.Rect(ox, oy, ox + s, oy + s))
        line(c, cx - 400 * math.cos(ang), cy - 400 * math.sin(ang), cx + 400 * math.cos(ang), cy + 400 * math.sin(ang), RED, pb * 0.8, 4)
        c.restore()
        text(c, "异或 XOR", 560, 200, 40, TEXT, pb, weight=700)
        text(c, "找不到这样一条直线", 560, 260, 28, MUTED, pb)
        text(c, "✗", 560, 360, 80, RED, pb * (0.6 + 0.4 * math.sin(t * 4)), family="symbol")
    pc = x.phase(2, 3)
    if pc > 0.01:
        layers = [2, 3, 1]
        pos = [[(160 + li * 270, h / 2 - (n - 1) * 70 + k * 140) for k in range(n)] for li, n in enumerate(layers)]
        for li in range(2):
            for p1 in pos[li]:
                for p2 in pos[li + 1]:
                    line(c, p1[0], p1[1], p2[0], p2[1], MUTED, pc * 0.5, 2)
        for li, ps in enumerate(pos):
            for (X, Y) in ps:
                circle(c, X, Y, 30, "#101a36", pc)
                circle(c, X, Y, 30, A, pc, stroke=3)
        text(c, "?", 430, h / 2 - 150, 80, ORANGE, pc * (0.6 + 0.4 * math.sin(t * 3)), weight=700, align="center")
        text(c, "多层网络可以解决异或，但该怎么训练？", w / 2, h - 60, 28, TEXT, pc, align="center")
    pd = x.phase(3)
    if pd > 0.01:
        rrect(c, 100, 60, 300, 420, 8, fill="#1b2a52", alpha=pd)
        rrect(c, 100, 60, 300, 420, 8, stroke=A, alpha=pd * 0.6)
        text(c, "Perceptrons", 250, 180, 40, TEXT, pd, family="serif", weight=700, align="center")
        text(c, "An Introduction to", 250, 230, 20, MUTED, pd, family="serif", align="center")
        text(c, "Computational Geometry", 250, 258, 20, MUTED, pd, family="serif", align="center")
        text(c, "Minsky · Papert", 250, 400, 24, TEXT, pd, family="serif", align="center")
        text(c, "1969", 250, 440, 22, A, pd, align="center")
        text(c, "神经网络研究", 640, 200, 32, TEXT, pd, align="center")
        text(c, "进入低谷", 640, 250, 32, TEXT, pd, align="center")
        arrow(c, 640, 290, 640, 400, RED, pd, 5, 20)
        text(c, "弗兰克·罗森布拉特", w / 2, h - 90, 26, MUTED, pd, align="center")
        text(c, "1928 — 1971", w / 2, h - 52, 24, MUTED, pd, align="center")


# 人工智能“热度”示意曲线（非精确数据）
_HYPE = [(1950, 0.12), (1956, 0.32), (1962, 0.55), (1968, 0.72), (1972, 0.62), (1975, 0.28), (1979, 0.22),
         (1981, 0.38), (1984, 0.72), (1987, 0.82), (1989, 0.40), (1993, 0.18), (1998, 0.26), (2004, 0.30),
         (2009, 0.36), (2012, 0.48), (2016, 0.66), (2020, 0.74), (2023, 0.96), (2025, 1.0)]


def _hype_at(yr):
    for (y1, v1), (y2, v2) in zip(_HYPE, _HYPE[1:]):
        if y1 <= yr <= y2:
            u = (yr - y1) / (y2 - y1)
            return lerp(v1, v2, (1 - math.cos(u * math.pi)) / 2)
    return _HYPE[-1][1] if yr > _HYPE[-1][0] else _HYPE[0][1]


def hype_chart(c, ox, oy, cw, ch, upto, accent, a, y0=1950, y1=2025, winters=True):
    X = lambda yr: ox + (yr - y0) / (y1 - y0) * cw
    Y = lambda v: oy + ch - v * ch
    if winters:
        for (s, e, lab) in [(1974, 1980, "第一次寒冬"), (1987, 1993, "第二次寒冬")]:
            if upto > s:
                wa = a * clamp((upto - s) / 3)
                c.drawRect(skia.Rect(X(s), oy, X(e), oy + ch), paint("#8fb8ff", wa * 0.12))
                text(c, lab, (X(s) + X(e)) / 2, oy + 30, 20, "#b9d4ff", wa, align="center")
                text(c, "❄", (X(s) + X(e)) / 2, oy + 64, 22, "#b9d4ff", wa, family="symbol", align="center")
    line(c, ox, oy + ch, ox + cw, oy + ch, MUTED, a, 2)
    for yr in range(1960, 2030, 10):
        if y0 <= yr <= y1:
            line(c, X(yr), oy + ch, X(yr), oy + ch + 8, MUTED, a, 2)
            text(c, str(yr), X(yr), oy + ch + 34, 18, MUTED, a, align="center")
    p = skia.Path()
    yr = y0
    first = True
    while yr <= min(upto, y1):
        (p.moveTo if first else p.lineTo)(X(yr), Y(_hype_at(yr)))
        first = False
        yr += 0.25
    c.drawPath(p, paint(accent, a * 0.4, stroke=10, blur=6))
    c.drawPath(p, paint(accent, a, stroke=4))
    if upto >= y0:
        u = min(upto, y1)
        glow_dot(c, X(u), Y(_hype_at(u)), 8, WHITE, a)
    text(c, "热度与投入（示意）", ox, oy - 14, 20, MUTED, a)
    return X, Y


def _sup(c, base, exp, x0, y0, size, color, a):
    w1 = text(c, base, x0, y0, size, color, a, weight=700)
    text(c, exp, x0 + w1 + 4, y0 - size * 0.45, size * 0.5, color, a, weight=700)


@visual("explosion")
def explosion(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 3)
    if pa > 0.01:
        depth_t = (t - 0.3) / 1.2
        for d in range(8):
            n = 3 ** d
            a_d = clamp(depth_t - d) * pa
            if a_d <= 0:
                continue
            yy = 70 + d * 62
            if n <= 243:
                for i in range(n):
                    xx = 40 + (w - 80) * (i + 0.5) / n
                    circle(c, xx, yy, max(1.6, 10 - d * 1.6), A, a_d * 0.9)
            else:
                c.drawRect(skia.Rect(40, yy - 4, w - 40, yy + 4), paint(A, a_d * 0.7, blur=3))
            text(c, f"{n:,}", w - 30, yy - 14, 18, MUTED, a_d, align="right")
        pb = x.phase(1, 3) * pa
        if pb > 0.01:
            rrect(c, 120, h - 160, w - 240, 120, 18, fill="#0e1630", alpha=pb * 0.95)
            rrect(c, 120, h - 160, w - 240, 120, 18, stroke=A, alpha=pb * 0.5)
            text(c, "国际象棋可能的对局数 ≈", 160, h - 88, 28, TEXT, pb)
            _sup(c, "10", "120", 500, h - 82, 56, A, pb)
            text(c, "（香农估算）", 660, h - 88, 22, MUTED, pb)
    pc = x.phase(3, 4)
    if pc > 0.01:
        rrect(c, w / 2 - 230, 50, 460, 540, 6, fill="#efe8d8", alpha=pc)
        text(c, "ARTIFICIAL INTELLIGENCE:", w / 2, 170, 30, "#1d1a14", pc, family="serif", weight=700, align="center")
        text(c, "A GENERAL SURVEY", w / 2, 212, 30, "#1d1a14", pc, family="serif", weight=700, align="center")
        text(c, "Sir James Lighthill", w / 2, 270, 24, "#4a4438", pc, family="serif", align="center")
        text(c, "1973", w / 2, 306, 22, "#4a4438", pc, family="serif", align="center")
        for k in range(6):
            line(c, w / 2 - 180, 360 + k * 26, w / 2 + 180 - (90 if k == 5 else 0), 360 + k * 26, "#bdb4a0", pc, 7)
        st = appear(t, x.cue(3) + 1.2, 0.4)
        c.save()
        c.translate(w / 2 + 110, 470)
        c.rotate(-14)
        rrect(c, -120, -40, 240, 80, 8, stroke=RED, alpha=pc * st, width=5)
        text(c, "未达预期", 0, 16, 40, RED, pc * st, weight=900, align="center")
        c.restore()
    pd = x.phase(4)
    if pd > 0.01:
        upto = lerp(1966, 1980, ease_in_out(prog(t, x.cue(4), 4.0)))
        hype_chart(c, 60, 90, w - 120, 420, upto, A, pd, y1=1990)
        text(c, "研究经费大幅削减", w / 2, h - 50, 30, TEXT, pd, align="center")


# ---------------------------------------------------------------- 第六章

def _benzene(c, cx, cy, r, color, a):
    pts = [(cx + r * math.cos(math.pi / 6 + k * math.pi / 3), cy + r * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
    poly(c, pts, color, a, stroke=3)
    circle(c, cx, cy, r * 0.55, color, a, stroke=2.5)


def _rack(c, cx, cy, s, color, a):
    rrect(c, cx - s * 0.4, cy - s * 0.6, s * 0.8, s * 1.2, 6, stroke=color, alpha=a, width=3)
    for k in range(5):
        line(c, cx - s * 0.3, cy - s * 0.45 + k * s * 0.22, cx + s * 0.3, cy - s * 0.45 + k * s * 0.22, color, a, 3)
        glow_dot(c, cx + s * 0.22, cy - s * 0.45 + k * s * 0.22, 3, GREEN, a, glow=2)


def _cross(c, cx, cy, s, color, a):
    rrect(c, cx - s * 0.15, cy - s * 0.5, s * 0.3, s, 4, fill=color, alpha=a)
    rrect(c, cx - s * 0.5, cy - s * 0.15, s, s * 0.3, 4, fill=color, alpha=a)


@visual("expert")
def expert(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    # 知识库 → 推理机 → 结论
    rules = [("IF", "发热 且 白细胞升高"), ("THEN", "细菌感染\n（可信度 0.7）")]
    for k in range(3):
        rrect(c, 40 + k * 8, 70 - k * 8, 330, 170, 14, fill="#101a36", alpha=a)
        rrect(c, 40 + k * 8, 70 - k * 8, 330, 170, 14, stroke=A, alpha=a * (0.3 + 0.2 * k))
    for i, (kw, s) in enumerate(rules):
        text(c, kw, 72, 108 + i * 56, 24, A, a, weight=700, family="mono")
        text_block(c, s, 150, 108 + i * 56, 22, 220, color=TEXT, alpha=a, line_h=28)
    text(c, "知识库：专家的规则", 210, 270, 22, MUTED, a, align="center")
    arrow(c, 395, 150, 470, 150, A, a, 4)
    gear(c, 545, 150, 64, 12, t * 0.8, A, a)
    text(c, "推理机", 545, 270, 22, MUTED, a, align="center")
    arrow(c, 620, 150, 690, 150, A, a, 4)
    rrect(c, 700, 105, 140, 90, 14, fill=A, alpha=a * 0.2)
    rrect(c, 700, 105, 140, 90, 14, stroke=A, alpha=a)
    text(c, "结论", 770, 162, 30, TEXT, a, weight=700, align="center")
    items = [(1, "DENDRAL", "1965 · 化学结构分析", _benzene),
             (2, "MYCIN", "1970s · 血液感染诊断", _cross),
             (3, "XCON", "1980 · 计算机订单配置", _rack)]
    for k, (ci, name, desc, icon) in enumerate(items):
        pa = x.phase(ci)
        if pa < 0.01:
            continue
        cx0 = 40 + k * 280
        dy = 20 * (1 - pa)
        rrect(c, cx0, 330 + dy, 260, 280, 18, fill="#0e1630", alpha=pa * 0.95)
        rrect(c, cx0, 330 + dy, 260, 280, 18, stroke=A, alpha=pa * 0.6, width=2)
        icon(c, cx0 + 130, 420 + dy, 46 if icon is _benzene else 80, A, pa)
        text(c, name, cx0 + 130, 530 + dy, 32, TEXT, pa, weight=700, align="center")
        text(c, desc, cx0 + 130, 575 + dy, 20, MUTED, pa, align="center")


@visual("boom")
def boom(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    upto = lerp(1979, 1987, ease_in_out(prog(t, 0.5, x.dur * 0.7)))
    hype_chart(c, 60, 70, w - 120, 330, upto, A, a, y1=1995)
    for k, (ci, title, body) in enumerate([(0, "LISP 机", "专为运行 LISP 设计的计算机"),
                                          (1, "第五代计算机", "日本 · 1982 · 推理与自然语言"),
                                          (2, "各国跟进", "英国 Alvey 计划 · 美国战略计算计划")]):
        pa = x.phase(ci) if ci else appear(t, 1.2, 0.8)
        cx0 = 40 + k * 280
        card(c, cx0, 460, 260, 160, A, pa, title=title, body=body, title_size=28, body_size=20)


@visual("winter")
def winter(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    upto = lerp(1984, 1995, ease_in_out(prog(t, 0.5, x.cue(3) + 2 - 0.5)))
    X, Y = hype_chart(c, 60, 70, w - 120, 380, upto, A, a, y1=1995)
    ann = [(1, 1987.3, "规则难以维护"), (2, 1988.5, "1987 · LISP 机市场崩溃"), (3, 1991.5, "第五代计划未达目标")]
    for k, (ci, yr, s) in enumerate(ann):
        pa = x.phase(ci)
        if pa < 0.01:
            continue
        px_, py_ = X(yr), Y(_hype_at(yr))
        ty = 510 + k * 44
        line(c, px_, py_, px_, ty - 30, "#b9d4ff", pa * 0.6, 1.5)
        glow_dot(c, px_, py_, 6, "#b9d4ff", pa)
        tx = min(px_ + 12, w - 20 - text_width(s, 24))
        text(c, s, tx, ty, 24, TEXT, pa)
    pe = x.phase(4)
    if pe > 0.01:
        caption_tag(c, "“人工智能”成了一个不受欢迎的词", w / 2, 40, A, pe)


# ---------------------------------------------------------------- 第七章

_PATTERN = ["..#####..", ".#.....#.", "#..#.#..#", "#.......#", "#.#...#.#", "#..###..#", ".#.....#.", "..#####.."]


@visual("energy")
def energy(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    # 全连接的霍普菲尔德网络
    n = 8
    cx, cy, R = 200, 200, 140
    pts = [(cx + R * math.cos(k * 2 * math.pi / n - math.pi / 2), cy + R * math.sin(k * 2 * math.pi / n - math.pi / 2)) for k in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            pulse = 0.5 + 0.5 * math.sin(t * 1.5 + i * 0.7 + j * 1.3)
            line(c, *pts[i], *pts[j], A, a * (0.12 + 0.25 * pulse), 1.5)
    for k, (px_, py_) in enumerate(pts):
        on = math.sin(t * 0.9 + k * 2.1) > 0
        if on:
            glow_dot(c, px_, py_, 14, A, a)
        else:
            circle(c, px_, py_, 14, "#101a36", a)
            circle(c, px_, py_, 14, A, a, stroke=2.5)
    text(c, "每个神经元都与其他所有神经元相连", cx, 395, 20, MUTED, a, align="center")
    # 记忆回忆：带噪声的图案逐渐恢复
    pb = x.phase(1)
    gx, gy, cs = 470, 60, 38
    if pb > 0.01:
        rec = prog(t, x.cue(1) + 0.8, max(2.0, x.cue(2) + 3 - x.cue(1)))
        for r, row in enumerate(_PATTERN):
            for q, ch in enumerate(row):
                target = ch == "#"
                noisy = target if rand(r * 13 + q * 7) > 0.35 else not target
                v = target if rand(r * 3 + q * 17 + 1) < rec else noisy
                X, Y = gx + q * cs, gy + r * cs
                rrect(c, X + 2, Y + 2, cs - 4, cs - 4, 5, fill=A if v else "#141e3a", alpha=pb)
        text(c, "带噪声的输入  →  回忆出完整记忆", gx + 4.5 * cs, gy + 8 * cs + 40, 20, MUTED, pb, align="center")
    # 能量地形
    pc = x.phase(2)
    if pc > 0.01:
        ox, oy, ew, eh = 60, 450, w - 120, 180

        def E(u):
            return 0.9 - 0.75 * math.exp(-((u - 0.25) / 0.09) ** 2) - 0.55 * math.exp(-((u - 0.68) / 0.11) ** 2) - 0.1 * math.sin(u * 9)

        p = skia.Path()
        for i in range(201):
            u = i / 200
            (p.moveTo if i == 0 else p.lineTo)(ox + u * ew, oy + (1 - E(u)) * eh)
        c.drawPath(p, paint(A, pc, stroke=4))
        period = 4.5
        k = int((t - x.cue(2)) / period)
        f = ((t - x.cue(2)) % period) / period
        u0 = 0.05 + 0.9 * rand(k * 3.3 + 2)
        u = u0
        for _ in range(int(f * 120)):
            du = (E(u + 0.002) - E(u - 0.002)) / 0.004
            u -= du * 0.0016
        bx, by = ox + u * ew, oy + (1 - E(u)) * eh
        glow_dot(c, bx, by - 14, 13, "#ffd166", pc)
        text(c, "能量", ox - 10, oy - 10, 20, MUTED, pc)
        text(c, "网络状态像小球一样滚向能量最低的“山谷”", w / 2, h - 6, 22, TEXT, pc, align="center")


@visual("backprop")
def backprop(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    layers = [3, 5, 5, 2]
    ox, gap = 80, 170
    pos = [[(ox + li * gap, 90 + (k + 0.5) * 400 / n) for k in range(n)] for li, n in enumerate(layers)]
    period = 4.0
    cyc = int(t / period)
    f = (t % period) / period
    for li in range(3):
        for i, p1 in enumerate(pos[li]):
            for j, p2 in enumerate(pos[li + 1]):
                wgt = rand(li * 100 + i * 10 + j + cyc * 0.37)
                line(c, p1[0], p1[1], p2[0], p2[1], A if wgt > 0.5 else "#8aa0d0", a * (0.15 + 0.35 * wgt), 1 + 3 * wgt)
    # 前向（蓝）与反向（橙）脉冲
    if f < 0.45:
        q = f / 0.45 * 3
        li = int(q)
        u = q - li
        if li < 3:
            for p1 in pos[li]:
                for p2 in pos[li + 1]:
                    glow_dot(c, lerp(p1[0], p2[0], u), lerp(p1[1], p2[1], u), 4, BLUE, a, glow=2.5)
    elif f > 0.55:
        q = (f - 0.55) / 0.45 * 3
        li = 3 - int(q)
        u = q - int(q)
        if li > 0:
            for p1 in pos[li]:
                for p2 in pos[li - 1]:
                    glow_dot(c, lerp(p1[0], p2[0], u), lerp(p1[1], p2[1], u), 4, ORANGE, a, glow=2.5)
    for li, ps in enumerate(pos):
        for (X, Y) in ps:
            circle(c, X, Y, 20, "#101a36", a)
            circle(c, X, Y, 20, A, a, stroke=3)
    err = 0.45 <= f <= 0.6
    text(c, "误差！" if err else "", pos[3][0][0] + 50, 300, 30, ORANGE, a * (1 if err else 0), weight=700)
    text(c, "前向传播 →", 180, 560, 26, BLUE, a, weight=700, align="center")
    text(c, "← 误差反向传播", 470, 560, 26, ORANGE, a, weight=700, align="center")
    # 损失曲线
    lx, ly, lw, lh = 700, 450, 140, 110
    rrect(c, lx - 14, ly - 40, lw + 28, lh + 70, 12, fill="#0e1630", alpha=a * 0.9)
    text(c, "损失", lx, ly - 12, 18, MUTED, a)
    p = skia.Path()
    tot = max(1.0, x.dur)
    m = int(80 * clamp(t / tot)) + 1
    for i in range(m):
        u = i / 80
        v = math.exp(-4 * u) * (0.9 + 0.1 * math.sin(i * 1.7))
        (p.moveTo if i == 0 else p.lineTo)(lx + u * lw, ly + lh - v * lh)
    c.drawPath(p, paint(GREEN, a, stroke=3))
    pb = x.phase(2)
    if pb > 0.01:
        caption_tag(c, "异或问题  ✓  迎刃而解", w / 2, h - 30, A, pb)


def _digit_grid(ch="7", n=16):
    s = skia.Surface(n, n)
    cc = s.getCanvas()
    cc.clear(skia.ColorBLACK)
    from ..gfx import font
    f = font(n * 1.05, 700)
    cc.drawString(ch, n * 0.2, n * 0.92, f, skia.Paint(AntiAlias=True, Color=skia.ColorWHITE))
    arr = s.makeImageSnapshot().toarray()[:, :, 0].astype(np.float32) / 255
    return arr


_DIG = None


@visual("cnn")
def cnn(c, x):
    global _DIG
    if _DIG is None:
        _DIG = _digit_grid()
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 2)
    n = 16
    if pa > 0.01:
        cs = 20
        ox, oy = 40, 120
        for r in range(n):
            for q in range(n):
                v = _DIG[r, q]
                c.drawRect(skia.Rect.MakeXYWH(ox + q * cs, oy + r * cs, cs - 1, cs - 1), paint((int(40 + 215 * v),) * 3, pa))
        steps = (n - 2) * (n - 2)
        k = int(steps * prog(t, 0.8, max(3.0, x.cue(2) - 1.5)))
        kr, kq = divmod(min(k, steps - 1), n - 2)
        rrect(c, ox + kq * cs - 2, oy + kr * cs - 2, cs * 3 + 4, cs * 3 + 4, 4, stroke=A, alpha=pa, width=3)
        text(c, "输入图像", ox + n * cs / 2, oy - 24, 22, MUTED, pa, align="center")
        text(c, "3×3 卷积核", ox + n * cs / 2, oy + n * cs + 36, 22, A, pa, align="center")
        # 特征图
        fx, fy, fs = 420, 140, 16
        for i in range(min(k + 1, steps)):
            r, q = divmod(i, n - 2)
            patch = _DIG[r:r + 3, q:q + 3]
            v = clamp(float(patch[:, 2].sum() - patch[:, 0].sum()) * 0.7 + 0.5)
            c.drawRect(skia.Rect.MakeXYWH(fx + q * fs, fy + r * fs, fs - 1, fs - 1), paint(A, pa * (0.15 + 0.85 * v)))
        if k < steps:
            line(c, ox + kq * cs + cs * 1.5, oy + kr * cs + cs * 1.5, fx + kq * fs + fs / 2, fy + kr * fs + fs / 2, A, pa * 0.6, 1.5)
        text(c, "特征图：边缘与笔画", fx + (n - 2) * fs / 2, fy - 24, 22, MUTED, pa, align="center")
        # 输出
        pr = prog(t, x.cue(1) + 1, 2.0)
        if pr > 0:
            for d in range(10):
                v = 0.95 if d == 7 else 0.05 + 0.15 * rand(d * 3)
                bx = 670
                by = 90 + d * 46
                text(c, str(d), bx, by + 22, 24, TEXT, pa * pr, align="center")
                c.drawRect(skia.Rect.MakeXYWH(bx + 20, by + 4, 150 * v * ease_out(pr), 24), paint(A if d == 7 else DIM, pa * pr))
            text(c, "识别结果：7", 760, 580, 26, A, pa * pr, weight=700, align="center")
    pb = x.phase(2)
    if pb > 0.01:
        rrect(c, 60, 140, w - 120, 320, 10, fill="#e8f0e6", alpha=pb)
        rrect(c, 60, 140, w - 120, 320, 10, stroke="#7c9a86", alpha=pb, width=3)
        text(c, "FIRST NATIONAL BANK", 90, 190, 24, "#2b4a36", pb, family="serif", weight=700)
        text(c, "PAY TO THE ORDER OF", 90, 260, 18, "#2b4a36", pb, family="serif")
        line(c, 300, 262, 560, 262, "#2b4a36", pb, 1.5)
        rrect(c, 600, 225, 170, 50, 6, stroke="#2b4a36", alpha=pb, width=2)
        amount = "$ 1,280.00"
        text(c, amount, 685, 260, 28, "#1a2a20", pb, family="serif", weight=700, align="center")
        line(c, 90, 350, 560, 350, "#2b4a36", pb, 1.5)
        text(c, "|: 021000021 |: 1234567 ||", 90, 430, 26, "#2b4a36", pb, family="mono")
        scan = prog(t, x.cue(2) + 0.5, 2.5)
        sx = lerp(600, 770, scan)
        line(c, sx, 220, sx, 280, RED, pb * (1 if scan < 1 else 0), 3)
        if scan >= 1:
            rrect(c, 596, 221, 178, 58, 8, stroke=GREEN, alpha=pb, width=3)
            text(c, "✓ 自动识别", 685, 315, 22, "#1f7a3a", pb, align="center")
        text(c, "九十年代：自动读取银行支票", w / 2, 530, 28, TEXT, pb, align="center")


@visual("lstm")
def lstm(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    bx, by, bw, bh = 110, 120, 650, 360
    rrect(c, bx, by, bw, bh, 30, fill="#0e1630", alpha=a * 0.9)
    rrect(c, bx, by, bw, bh, 30, stroke=A, alpha=a * 0.5, width=2)
    cy = by + 70
    line(c, 30, cy, w - 30, cy, "#ffd166", a, 5)
    text(c, "细胞状态（长期记忆）", w / 2, cy - 26, 22, "#ffd166", a, align="center")
    gates = [("遗忘门", bx + 150, 0.5 + 0.5 * math.sin(t * 0.9)),
             ("输入门", bx + 330, 0.5 + 0.5 * math.sin(t * 0.9 + 2.1)),
             ("输出门", bx + 510, 0.5 + 0.5 * math.sin(t * 0.9 + 4.2))]
    for name, gx, v in gates:
        gy = by + 250
        circle(c, gx, gy, 40, "#101a36", a)
        circle(c, gx, gy, 40, A, a, stroke=3)
        text(c, "σ", gx, gy + 12, 34, TEXT, a, family="symbol", align="center")
        c.drawRect(skia.Rect.MakeXYWH(gx - 50, gy + 54, 100, 10), paint(DIM, a))
        c.drawRect(skia.Rect.MakeXYWH(gx - 50, gy + 54, 100 * v, 10), paint(A, a))
        text(c, name, gx, gy + 100, 24, TEXT, a, align="center")
        line(c, gx, gy - 40, gx, cy + 26, A, a * (0.3 + 0.7 * v), 3)
        sym = "×" if name != "输入门" else "+"
        circle(c, gx, cy, 22, "#101a36", a)
        circle(c, gx, cy, 22, "#ffd166", a, stroke=3)
        text(c, sym, gx, cy + 10, 30, "#ffd166", a, family="symbol", align="center")
    # 记忆“包裹”在传送带上流动
    for k in range(12):
        u = ((t * 0.08) + k / 12) % 1
        px_ = 30 + u * (w - 60)
        keep = 1.0
        if px_ > gates[0][1]:
            keep = 1.0 if rand(k * 5 + int(t * 0.08 + k / 12) * 7) < gates[0][2] + 0.25 else 0.15
        colr = ["#ff8a65", "#64b5f6", "#81c784", "#ba68c8"][k % 4]
        rrect(c, px_ - 10, cy - 10, 20, 20, 5, fill=colr, alpha=a * keep)
    text(c, "x  （当前输入）", bx + bw / 2, by + bh + 50, 22, MUTED, a, align="center")
    pb = x.phase(2)
    if pb > 0.01:
        caption_tag(c, "语音识别 · 机器翻译", w / 2, 50, A, pb)


# ---------------------------------------------------------------- 第八章

@visual("bayes")
def bayes(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        card(c, 60, 180, 300, 200, MUTED, pa, title="手写规则", body="IF … THEN …\n专家一条条编写", title_size=30)
        arrow(c, 380, 280, 490, 280, A, pa, 5, 20)
        card(c, 510, 180, 300, 200, A, pa, title="统计学习", body="从大量数据中\n自动总结规律", title_size=30)
    pb = x.phase(1, 2)
    if pb > 0.01:
        nodes = {"多云": (435, 90), "洒水器": (210, 290), "下雨": (660, 290), "草地湿": (435, 490)}
        edges = [("多云", "洒水器"), ("多云", "下雨"), ("洒水器", "草地湿"), ("下雨", "草地湿")]
        for a_, b_ in edges:
            (x1, y1), (x2, y2) = nodes[a_], nodes[b_]
            ang = math.atan2(y2 - y1, x2 - x1)
            arrow(c, x1 + 70 * math.cos(ang), y1 + 52 * math.sin(ang), x2 - 75 * math.cos(ang), y2 - 56 * math.sin(ang), A, pb, 3, 14)
        obs = ease_in_out(prog(t, x.cue(1) + 3.0, 1.5))
        probs = {"多云": lerp(0.5, 0.576, obs), "洒水器": lerp(0.3, 0.430, obs), "下雨": lerp(0.5, 0.708, obs), "草地湿": lerp(0.647, 1.0, obs)}
        for name, (nx, ny) in nodes.items():
            hl = name == "草地湿" and obs > 0.5
            rrect(c, nx - 85, ny - 48, 170, 96, 18, fill="#101a36", alpha=pb)
            rrect(c, nx - 85, ny - 48, 170, 96, 18, stroke=GREEN if hl else A, alpha=pb, width=3 if hl else 2)
            text(c, name, nx, ny - 8, 26, TEXT, pb, weight=700, align="center")
            p = probs[name]
            c.drawRect(skia.Rect.MakeXYWH(nx - 60, ny + 14, 120, 12), paint(DIM, pb))
            c.drawRect(skia.Rect.MakeXYWH(nx - 60, ny + 14, 120 * p, 12), paint(GREEN if hl else A, pb))
            text(c, f"{p:.2f}", nx + 70, ny + 26, 18, MUTED, pb)
        if obs > 0:
            text(c, "观察到：草地是湿的  →  “下雨”的概率上升", w / 2, h - 30, 24, GREEN, pb * obs, align="center")
    pc = x.phase(2, 3)
    if pc > 0.01:
        ox, oy, s = 120, 60, 520
        _plot_frame(c, ox, oy, s, pc)
        c.save()
        c.clipRect(skia.Rect(ox, oy, ox + s, oy + s))
        for off, alp, wd in [(-60, 0.4, 2), (0, 1.0, 4), (60, 0.4, 2)]:
            line(c, ox - 50, oy + s + 50 + off, ox + s + 50, oy - 50 + off, A, pc * alp, wd)
        c.restore()
        for i in range(26):
            cls = i % 2
            u = rand(i * 4.1)
            v = rand(i * 6.7)
            d = 0.16 + 0.32 * v
            px_, py_ = u, (1 - u) + (d if cls else -d)
            if not (0.05 < py_ < 0.95):
                continue
            _pt(c, ox + px_ * s, oy + (1 - py_) * s, cls, pc, 11)
        for (u, cls) in [(0.3, 1), (0.62, 0), (0.75, 1)]:
            py_ = (1 - u) + (0.115 if cls else -0.115)
            X, Y = ox + u * s, oy + (1 - py_) * s
            _pt(c, X, Y, cls, pc, 11)
            circle(c, X, Y, 22, GREEN, pc, stroke=3)
        text(c, "支持向量机", ox + s + 30, 200, 32, TEXT, pc, weight=700)
        text(c, "寻找间隔最大的", ox + s + 30, 260, 24, MUTED, pc)
        text(c, "分界线", ox + s + 30, 295, 24, MUTED, pc)
    pd = x.phase(3)
    if pd > 0.01:
        icons = ["垃圾邮件过滤", "搜索引擎", "推荐系统"]
        for k, s in enumerate(icons):
            cx0 = 150 + k * 285
            cy0 = 260
            circle(c, cx0, cy0, 95, A, pd * 0.15)
            circle(c, cx0, cy0, 95, A, pd, stroke=3)
            if k == 0:
                rrect(c, cx0 - 50, cy0 - 32, 100, 66, 6, stroke=TEXT, alpha=pd, width=3)
                poly(c, [(cx0 - 50, cy0 - 30), (cx0, cy0 + 6), (cx0 + 50, cy0 - 30)], TEXT, pd, stroke=3, closed=False)
                line(c, cx0 + 20, cy0 + 20, cx0 + 56, cy0 + 56, RED, pd, 6)
                line(c, cx0 + 56, cy0 + 20, cx0 + 20, cy0 + 56, RED, pd, 6)
            elif k == 1:
                circle(c, cx0 - 10, cy0 - 10, 36, TEXT, pd, stroke=6)
                line(c, cx0 + 16, cy0 + 16, cx0 + 50, cy0 + 50, TEXT, pd, 10)
            else:
                for q in range(5):
                    text(c, "★", cx0 - 64 + q * 32, cy0 + 12, 34, "#ffd166" if q < 4 else DIM, pd, family="symbol", align="center")
            text(c, s, cx0, cy0 + 150, 26, TEXT, pd, align="center")


# 1997 年深蓝对卡斯帕罗夫第六局（Caro-Kann，19 回合白胜）
_G6 = ["e2e4", "c7c6", "d2d4", "d7d5", "b1c3", "d5e4", "c3e4", "b8d7", "e4g5", "g8f6", "f1d3", "e7e6",
       "g1f3", "h7h6", "g5e6", "d8e7", "O-O", "f7e6", "d3g6", "e8d8", "c1f4", "b7b5", "a2a4", "c8b7",
       "f1e1", "f6d5", "f4g3", "d8c8", "a4b5", "c6b5", "d1d3", "b7c6", "g6f5", "e6f5", "e1e7", "f8e7", "c2c4"]
_GLYPH = {"K": "♚", "Q": "♛", "R": "♜", "B": "♝", "N": "♞", "P": "♟"}
_OUTLINE = {"K": "♔", "Q": "♕", "R": "♖", "B": "♗", "N": "♘", "P": "♙"}


def _chess_positions():
    b = {}
    back = "RNBQKBNR"
    for i, p in enumerate(back):
        b[(i, 0)] = ("w", p)
        b[(i, 7)] = ("b", p)
        b[(i, 1)] = ("w", "P")
        b[(i, 6)] = ("b", "P")
    out = [(dict(b), None)]
    for mv in _G6:
        b = dict(b)
        if mv == "O-O":
            b[(6, 0)] = b.pop((4, 0))
            b[(5, 0)] = b.pop((7, 0))
            last = ((4, 0), (6, 0))
        else:
            f = (ord(mv[0]) - 97, int(mv[1]) - 1)
            to = (ord(mv[2]) - 97, int(mv[3]) - 1)
            b[to] = b.pop(f)
            last = (f, to)
        out.append((b, last))
    return out


_CHESS = _chess_positions()


@visual("chess")
def chess(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    cs, ox, oy = 66, 30, 50
    end = max(x.cue(3), 8.0)
    k = int((len(_CHESS) - 1) * prog(t, 0.8, end - 0.8))
    board, last = _CHESS[k]
    for r in range(8):
        for q in range(8):
            light = (r + q) % 2 == 1
            c.drawRect(skia.Rect.MakeXYWH(ox + q * cs, oy + (7 - r) * cs, cs, cs), paint("#d9c9a3" if light else "#7a5b3a", a))
    if last:
        for (q, r) in last:
            c.drawRect(skia.Rect.MakeXYWH(ox + q * cs, oy + (7 - r) * cs, cs, cs), paint("#ffe066", a * 0.45))
    for (q, r), (side, p) in board.items():
        X, Y = ox + q * cs + cs / 2, oy + (7 - r) * cs + cs * 0.78
        g = _GLYPH[p]
        from ..gfx import font
        f = font(54, 400, "symbol")
        gw = f.measureText(g)
        body = "#fbfbf6" if side == "w" else "#151515"
        c.drawString(g, X - gw / 2, Y, f, paint(body, a, stroke=4))   # 描粗边，填满字形内部的镂空
        c.drawString(g, X - gw / 2, Y, f, paint(body, a))
        if side == "w":
            c.drawString(_OUTLINE[p], X - gw / 2, Y, f, paint("#1a1a1a", a))
        else:
            c.drawString(_OUTLINE[p], X - gw / 2, Y, f, paint("#9a9a9a", a * 0.9))
    for i in range(8):
        text(c, "abcdefgh"[i], ox + i * cs + cs / 2, oy + 8 * cs + 26, 18, MUTED, a, align="center")
    rx = ox + 8 * cs + 40
    text(c, "深蓝", rx, 110, 40, A, a, weight=700)
    text(c, "vs", rx + 92, 110, 26, MUTED, a)
    text(c, "卡斯帕罗夫", rx, 160, 32, TEXT, a, weight=700)
    text(c, "1997 · 第六局", rx, 205, 22, MUTED, a)
    mvn = (k + 1) // 2
    text(c, f"第 {max(1, mvn)} 回合", rx, 250, 22, MUTED, a)
    pf = appear(t, end, 0.8)
    text(c, "3.5 : 2.5", rx, 330, 52, "#ffd166", a * pf, weight=900)
    text(c, "深蓝获胜", rx, 372, 22, TEXT, a * pf)
    pb = x.phase(2)
    if pb > 0.01:
        n = int(200_000_000 * ease_out(prog(t, x.cue(2), 2.0)))
        text(c, f"{n:,}", rx, 470, 36, TEXT, pb, weight=700)
        text(c, "个局面 / 秒", rx, 506, 22, MUTED, pb)


def _tile(c, X, Y, s, seed, a):
    hue = [("#ff8a65", "#ffd54f"), ("#4fc3f7", "#1a237e"), ("#81c784", "#1b5e20"), ("#ce93d8", "#4a148c"),
           ("#ffcc80", "#bf360c"), ("#80deea", "#006064"), ("#f48fb1", "#880e4f"), ("#e6ee9c", "#33691e")][int(rand(seed) * 8)]
    from ..gfx import linear_gradient
    c.save()
    c.clipRRect(skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(X, Y, s, s), 8, 8), doAntiAlias=True)
    c.drawRect(skia.Rect.MakeXYWH(X, Y, s, s), skia.Paint(Shader=linear_gradient(X, Y, X, Y + s, [hue[0], hue[1]], [a, a])))
    kind = int(rand(seed * 3.1) * 3)
    cx, cy = X + s * (0.35 + 0.3 * rand(seed * 5)), Y + s * (0.4 + 0.25 * rand(seed * 7))
    if kind == 0:
        circle(c, cx, cy, s * 0.22, "#ffffff", a * 0.8)
    elif kind == 1:
        poly(c, [(X, Y + s), (cx, cy - s * 0.2), (X + s, Y + s)], "#0b1020", a * 0.6)
    else:
        rrect(c, cx - s * 0.2, cy - s * 0.12, s * 0.4, s * 0.24, 6, fill="#0b1020", alpha=a * 0.6)
    c.restore()


_LABELS = ["猫", "狗", "汽车", "飞机", "花", "鸟", "船", "苹果", "吉他", "山", "桥", "马", "椅子", "蘑菇", "灯塔", "企鹅", "钟表", "火车"]


@visual("imagenet")
def imagenet(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        # CPU vs GPU
        rrect(c, 70, 140, 300, 300, 20, stroke=MUTED, alpha=pa, width=3)
        for k in range(4):
            q, r = k % 2, k // 2
            on = math.sin(t * 2 + k) > 0
            rrect(c, 100 + q * 130, 170 + r * 130, 110, 110, 12, fill=A if on else "#1a2645", alpha=pa * (0.9 if on else 1))
        text(c, "CPU：少数强大的核心", 220, 500, 24, TEXT, pa, align="center")
        rrect(c, 480, 140, 300, 300, 20, stroke=A, alpha=pa, width=3)
        for r in range(16):
            for q in range(16):
                wave = math.sin(t * 4 - (q + r) * 0.45)
                c.drawRect(skia.Rect.MakeXYWH(496 + q * 17.2, 156 + r * 17.2, 14, 14), paint(A if wave > 0.2 else "#1a2645", pa))
        text(c, "GPU：成千上万个并行核心", 630, 500, 24, TEXT, pa, align="center")
    pb = x.phase(1, 2)
    if pb > 0.01:
        n = 1 + int(9 * prog(t, x.cue(1), 3.0))
        for li in range(n):
            X = 120 + li * 70
            for k in range(6):
                Y = 140 + k * 60
                if li + 1 < n:
                    for k2 in range(6):
                        line(c, X, Y, X + 70, 140 + k2 * 60, A, pb * 0.08, 1)
                circle(c, X, Y, 9, A, pb)
        text(c, "“深度学习” · 2006", w / 2, 540, 40, TEXT, pb, weight=700, align="center")
        text(c, f"{n} 层", w / 2, 590, 24, MUTED, pb, align="center")
    pc = x.phase(2)
    if pc > 0.01:
        cols, rows, s = 6, 3, 108
        ox, oy = (w - cols * (s + 26)) / 2 + 13, 74
        for i in range(cols * rows):
            seed = i + int(max(0, t - x.cue(2)) * 1.2) * 18 + 1
            ai = appear(t, x.cue(2) + i * 0.08, 0.4)
            q, r = i % cols, i // cols
            X, Y = ox + q * (s + 26), oy + r * (s + 46)
            _tile(c, X, Y, s, seed, pc * ai)
            text(c, _LABELS[int(rand(seed * 1.3) * len(_LABELS))], X + s / 2, Y + s + 30, 20, TEXT, pc * ai, align="center")
        n = int(14_197_122 * ease_out(prog(t, x.cue(2) + 0.5, 3.0)))
        text(c, f"{n:,}", w / 2, h - 58, 46, A, pc, weight=700, align="center")
        text(c, "张标注图片  ·  21,841 个类别", w / 2, h - 18, 22, MUTED, pc, align="center")
    pd = x.phase(3)
    if pd > 0.01:
        caption_tag(c, "ILSVRC 挑战赛：1000 类 · 约 120 万张训练图片", w / 2, 36, A, pd)


@visual("watson")
def watson(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        cw, ch = 128, 66
        ox, oy = (w - 6 * cw) / 2, 40
        for q in range(6):
            rrect(c, ox + q * cw + 3, oy, cw - 6, 46, 4, fill="#0a1a8c", alpha=pa)
            text(c, ["历史", "科学", "文学", "地理", "体育", "词语"][q], ox + q * cw + cw / 2, oy + 32, 20, WHITE, pa, align="center")
            for r in range(5):
                Y = oy + 56 + r * ch
                used = rand(q * 11 + r * 3) < prog(t, 0.5, x.cue(1) + 2)
                rrect(c, ox + q * cw + 3, Y, cw - 6, ch - 6, 4, fill="#0d1fb5" if not used else "#0a1450", alpha=pa)
                if not used:
                    text(c, f"${(r + 1) * 200}", ox + q * cw + cw / 2, Y + 42, 26, "#ffcc33", pa, weight=700, align="center")
        cx, cy = w / 2, 520
        circle(c, cx, cy, 62, "#0d1fb5", pa * 0.8)
        for k in range(6):
            ang = t * 0.8 + k * math.pi / 3
            c.drawOval(skia.Rect.MakeXYWH(cx - 60 * abs(math.cos(ang)), cy - 60, 120 * abs(math.cos(ang)) + 1, 120), paint("#7fb2ff", pa * 0.7, stroke=2))
        circle(c, cx, cy, 62, "#7fb2ff", pa, stroke=3)
        text(c, "WATSON", cx, cy + 105, 26, TEXT, pa, weight=700, align="center")
        for k, (nm, sc) in enumerate([("沃森", "$77,147"), ("詹宁斯", "$24,000"), ("鲁特", "$21,600")]):
            X = 130 if k == 1 else (w - 130 if k == 2 else None)
            if X is None:
                continue
            text(c, nm, X, 500, 24, MUTED, pa * appear(t, 3, 1), align="center")
            text(c, sc, X, 540, 30, TEXT, pa * appear(t, 3, 1), weight=700, align="center")
        text(c, "$77,147", cx, cy - 86, 30, "#ffcc33", pa * appear(t, 3, 1), weight=700, align="center")
    pb = x.phase(1)
    if pb > 0.01:
        px0, py0 = w / 2 - 140, 40
        rrect(c, px0, py0, 280, 560, 40, fill="#0b0f1d", alpha=pb)
        rrect(c, px0, py0, 280, 560, 40, stroke="#5b6785", alpha=pb, width=4)
        text(c, "有什么可以帮你的？", w / 2, 200, 26, TEXT, pb, align="center")
        for k, colr in enumerate(["#ff5fa2", "#5ad1f0", "#7c4dff", "#7ee787"]):
            p = skia.Path()
            for i in range(121):
                u = i / 120
                amp = 40 * math.sin(u * math.pi) * (0.5 + 0.5 * math.sin(t * 2.5 + k))
                yy = 420 + amp * math.sin(u * 10 + t * (3 + k) + k)
                (p.moveTo if i == 0 else p.lineTo)(px0 + 30 + u * 220, yy)
            c.drawPath(p, paint(colr, pb * 0.8, stroke=3))
        text(c, "Siri · 2011", w / 2, 640, 26, MUTED, pb, align="center")
