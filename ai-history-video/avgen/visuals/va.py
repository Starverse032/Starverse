"""插图（上）：第一章至第四章。"""
import math

import skia

from ..gfx import (DIM, MUTED, TEXT, WHITE, appear, arrow, circle, clamp, ease_in_out, ease_out, glow_dot,
                   lerp, line, paint, poly, prog, rand, rrect, text, text_block, text_width)
from . import caption_tag, card, computer, gear, label, person, typed, visual

BRONZE = "#d9a441"
GREEN = "#7ee787"
RED = "#ff6b6b"


def _phase_tag(c, x, items, y=46):
    """按解说进度切换顶部的小标签。items: [(cue_index, text), ...]"""
    for k, (i, s) in enumerate(items):
        j = items[k + 1][0] if k + 1 < len(items) else None
        a = x.phase(i, j)
        if a > 0.01:
            caption_tag(c, s, x.w / 2, y, x.accent, a)


# ---------------------------------------------------------------- 第一章

def _ik(sx, sy, hx, hy, l1, l2, bend=1):
    dx, dy = hx - sx, hy - sy
    d = min(math.hypot(dx, dy), l1 + l2 - 0.01)
    a = math.atan2(dy, dx)
    cos_b = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)
    b = math.acos(cos_b)
    ea = a - bend * b
    return sx + l1 * math.cos(ea), sy + l1 * math.sin(ea)


def _script_path(s):
    """“写字”的笔迹：连续的花体曲线。"""
    return (s * 230 + 6 * math.sin(s * 37), 13 * math.sin(s * 44) + 5 * math.sin(s * 19) - (s * 230 % 46 > 40) * 4)


@visual("automaton")
def automaton(c, x):
    t = x.t
    cx, cy = x.w * 0.36, x.h * 0.52
    a = appear(t, 0.1, 1.2)
    eye = "#7fdcff"
    c.drawOval(skia.Rect.MakeXYWH(cx - 170, cy + 222, 340, 36), paint(BRONZE, 0.22 * a, blur=14))
    for s in (-1, 1):
        line(c, cx + s * 36, cy + 92, cx + s * 46, cy + 225, BRONZE, a, 16)
        line(c, cx + s * 46, cy + 225, cx + s * 70, cy + 228, BRONZE, a, 12)
    torso = skia.Path()
    torso.moveTo(cx - 88, cy - 92)
    torso.lineTo(cx + 88, cy - 92)
    torso.lineTo(cx + 58, cy + 98)
    torso.lineTo(cx - 58, cy + 98)
    torso.close()
    c.drawPath(torso, paint(BRONZE, 0.16 * a))
    c.drawPath(torso, paint(BRONZE, a, stroke=4))
    gear(c, cx - 8, cy - 8, 42, 10, t * 0.9, BRONZE, a)
    gear(c, cx + 37, cy + 48, 22, 6, -t * 0.9 * 42 / 22 + 0.3, BRONZE, a * 0.85)
    # 头部与眼睛
    c.drawLine(cx, cy - 92, cx, cy - 104, paint(BRONZE, a, stroke=10))
    rrect(c, cx - 46, cy - 190, 92, 88, 30, fill=BRONZE, alpha=a, fill_alpha=0.18)
    rrect(c, cx - 46, cy - 190, 92, 88, 30, stroke=BRONZE, alpha=a, width=4)
    blink = 0.15 if (t % 4.2) < 0.12 else 1.0
    for s in (-1, 1):
        glow_dot(c, cx + s * 19, cy - 150, 7 * blink, eye, a * (0.75 + 0.25 * math.sin(t * 2)))
    # 左臂：缓慢摆动
    sx, sy = cx - 92, cy - 82
    ang = math.radians(105 + 14 * math.sin(t * 1.3))
    ex, ey = sx + 80 * math.cos(ang), sy + 80 * math.sin(ang)
    ang2 = ang - math.radians(25 + 10 * math.sin(t * 1.3 + 1))
    hx, hy = ex + 76 * math.cos(ang2), ey + 76 * math.sin(ang2)
    line(c, sx, sy, ex, ey, BRONZE, a, 13)
    line(c, ex, ey, hx, hy, BRONZE, a, 11)
    circle(c, ex, ey, 9, BRONZE, a)
    # 右臂：第三句起，在纸上写字
    px, py = cx + 165, cy + 40
    wa = x.phase(3)
    paper = skia.Rect.MakeXYWH(px - 20, py - 60, 290, 150)
    c.drawRect(paper, paint("#f3e6c8", 0.9 * wa))
    s_prog = ease_in_out(prog(t, x.cue(3), max(1.0, x.dur - x.cue(3) - 1.2)))
    ink = skia.Path()
    n = int(160 * s_prog)
    for k in range(n + 1):
        qx, qy = _script_path(k / 160)
        (ink.moveTo if k == 0 else ink.lineTo)(px + qx, py + qy)
    if n > 0:
        c.drawPath(ink, paint("#3a2a12", wa, stroke=2.4))
    if wa > 0.01:
        qx, qy = _script_path(s_prog)
        tx, ty = lerp(cx + 150, px + qx, wa), lerp(cy + 10, py + qy, wa)
    else:
        tx, ty = cx + 120 + 10 * math.sin(t), cy + 40
    sx2, sy2 = cx + 92, cy - 82
    ex2, ey2 = _ik(sx2, sy2, tx, ty, 95, 95, bend=-1)
    line(c, sx2, sy2, ex2, ey2, BRONZE, a, 13)
    line(c, ex2, ey2, tx, ty, BRONZE, a, 11)
    circle(c, ex2, ey2, 9, BRONZE, a)
    c.drawLine(tx, ty, tx + 10, ty - 28, paint("#f4f4f4", a * 0.9, stroke=3))
    _phase_tag(c, x, [(1, "古希腊 · 青铜巨人塔罗斯"), (2, "《列子·汤问》· 偃师造人"), (3, "18世纪 · 会写字的自动人偶"), (4, "一个跨越文明的梦想")])


SYM = ["∀", "∃", "∧", "∨", "¬", "→", "≡", "∴", "+", "×", "=", "⊢"]


@visual("binary")
def binary(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        for i, s in enumerate(SYM):
            ang = t * 0.25 + i * 2 * math.pi / len(SYM)
            r = 220 + 20 * math.sin(t * 0.8 + i)
            text(c, s, w / 2 + r * math.cos(ang), h / 2 + r * math.sin(ang) * 0.75 + 16, 46, A, pa * (0.5 + 0.5 * rand(i)), family="symbol", align="center")
        text(c, "思想", w / 2 - 110, h / 2 + 4, 56, TEXT, pa, weight=700, align="center")
        text(c, "=", w / 2, h / 2 + 4, 56, A, pa, align="center", family="symbol")
        text(c, "计算？", w / 2 + 125, h / 2 + 4, 56, TEXT, pa, weight=700, align="center")
    pb = x.phase(1, 2)
    if pb > 0.01:
        sc = 0.9 + 0.1 * ease_out(prog(t, x.cue(1), 1.0))
        c.save()
        c.translate(w / 2, h / 2)
        c.scale(sc, sc)
        text(c, "Calculemus!", 0, -10, 104, A, pb, family="serif", weight=700, align="center", glow=18)
        text(c, "让我们算一算！", 0, 80, 44, TEXT, pb, align="center")
        text(c, "—— 莱布尼茨", 0, 150, 28, MUTED, pb, align="center")
        c.restore()
    pc = x.phase(2)
    if pc > 0.01:
        n = int(max(0, t - x.cue(2)) / 0.8) % 16
        text(c, str(n), 190, h / 2 + 40, 170, TEXT, pc, weight=700, align="center")
        text(c, "十进制", 190, h / 2 + 110, 26, MUTED, pc, align="center")
        for b in range(4):
            bit = (n >> (3 - b)) & 1
            bx, by = 420 + b * 100, h / 2 - 30
            if bit:
                glow_dot(c, bx, by, 34, A, pc)
            else:
                circle(c, bx, by, 34, A, pc * 0.6, stroke=3)
            text(c, str(bit), bx, by + 15, 42, "#0b1020" if bit else A, pc, weight=700, align="center")
            text(c, str(2 ** (3 - b)), bx, by + 82, 24, MUTED, pc, align="center")
        text(c, "二进制：只用 0 和 1", 570, h / 2 + 150, 30, TEXT, pc, align="center")


@visual("gears")
def gears(c, x):
    t, w, h = x.t, x.w, x.h
    a = appear(t, 0, 1)
    # 一串互相咬合的齿轮：圆心距 ≈ 两半径之和减去齿高，转速与半径成反比
    radii = [100, 66, 52, 64]
    dirs = [-0.5, 1.2, 0.2]
    centers = [(160.0, 260.0)]
    for k, ang in enumerate(dirs):
        d = 0.92 * (radii[k] + radii[k + 1])
        px_, py_ = centers[-1]
        centers.append((px_ + d * math.cos(ang), py_ + d * math.sin(ang)))
    om = 0.6
    for k, ((gx, gy), r) in enumerate(zip(centers, radii)):
        spin = om * radii[0] / r * (-1) ** k
        gear(c, gx, gy, r, max(8, round(r / 6)), t * spin + k * 0.21, BRONZE, a)
    # 穿孔卡片带
    y0 = h - 150
    c.save()
    c.clipRect(skia.Rect(30, y0 - 10, w - 30, y0 + 100))
    off = (t * 60) % 60
    for k in range(-1, 16):
        cx0 = 30 + k * 60 - off
        rrect(c, cx0, y0, 56, 88, 4, fill="#e9dcc0", alpha=a * 0.85)
        for r_ in range(5):
            if rand(k * 7 + r_ + int((t * 60) // 60) * 13) > 0.5:
                circle(c, cx0 + 28, y0 + 12 + r_ * 16, 4.5, "#1b1408", a)
    c.restore()
    label(c, "穿孔卡片：给机器的“程序”", w / 2, y0 + 128, 22, MUTED, a)
    pb = x.phase(1, 2)
    if pb > 0.01:
        card(c, w - 300, 40, 270, 250, x.accent, pb, title="Note G · 伯努利数")
        for i, (k, v) in enumerate([(2, "1/6"), (4, "−1/30"), (6, "1/42"), (8, "−1/30")]):
            yy = 135 + i * 38
            text(c, "B", w - 270, yy, 28, TEXT, pb, family="serif")
            text(c, str(k), w - 250, yy + 8, 18, TEXT, pb)
            text(c, "= " + v, w - 225, yy, 28, TEXT, pb, family="serif")
    pc = x.phase(2, 3)
    if pc > 0.01:
        for i in range(9):
            st = x.cue(2) + i * 0.5
            p = prog(t, st, 3.2)
            if 0 < p < 1:
                nx = 260 + 260 * rand(i * 3) + 30 * math.sin(p * 6 + i)
                ny = 300 - p * 260
                text(c, "♪♫♩♬"[i % 4], nx, ny, 44, x.accent, pc * math.sin(p * math.pi), family="symbol", align="center")
        caption_tag(c, "不只是数字：音乐与符号", w / 2, 46, x.accent, pc)
    pd = x.phase(3)
    if pd > 0.01:
        card(c, w - 390, 30, 360, 215, x.accent, pd, title="洛夫莱斯质疑",
             body="“分析机并不能创造任何东西，它只能执行我们知道如何命令它去做的事情。”")


def _and_gate(c, gx, gy, gw, gh, color, a):
    p = skia.Path()
    p.moveTo(gx, gy - gh / 2)
    p.lineTo(gx + gw * 0.5, gy - gh / 2)
    p.arcTo(skia.Rect.MakeXYWH(gx + gw * 0.5 - gh / 2, gy - gh / 2, gh, gh), -90, 180, False)
    p.lineTo(gx, gy + gh / 2)
    p.close()
    c.drawPath(p, paint(color, a * 0.15))
    c.drawPath(p, paint(color, a, stroke=3))


def _or_gate(c, gx, gy, gw, gh, color, a):
    p = skia.Path()
    p.moveTo(gx, gy - gh / 2)
    p.quadTo(gx + gw * 0.65, gy - gh / 2, gx + gw, gy)
    p.quadTo(gx + gw * 0.65, gy + gh / 2, gx, gy + gh / 2)
    p.quadTo(gx + gw * 0.28, gy, gx, gy - gh / 2)
    p.close()
    c.drawPath(p, paint(color, a * 0.15))
    c.drawPath(p, paint(color, a, stroke=3))


def _not_gate(c, gx, gy, gw, gh, color, a):
    poly(c, [(gx, gy - gh / 2), (gx + gw - 16, gy), (gx, gy + gh / 2)], color, a * 0.15)
    poly(c, [(gx, gy - gh / 2), (gx + gw - 16, gy), (gx, gy + gh / 2)], color, a, stroke=3)
    circle(c, gx + gw - 8, gy, 8, color, a, stroke=3)


@visual("logic")
def logic(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    step = int(t / 1.4)
    combos = [(0, 0), (0, 1), (1, 0), (1, 1)]
    ia, ib = combos[step % 4]
    gates = [("与 AND", 140, _and_gate, lambda p, q: p & q),
             ("或 OR", 330, _or_gate, lambda p, q: p | q),
             ("非 NOT", 520, _not_gate, None)]
    for name, gy, fn, op in gates:
        gx, gw, gh = 190, 120, 96
        if op is None:
            inp = [(step % 2)]
            out = 1 - inp[0]
            ys = [gy]
        else:
            inp = [ia, ib]
            out = op(ia, ib)
            ys = [gy - 26, gy + 26]
        for v, yy in zip(inp, ys):
            colr = A if v else DIM
            line(c, 60, yy, gx + (10 if fn is _or_gate else 0), yy, colr, a, 4)
            text(c, str(v), 40, yy + 11, 30, colr, a, weight=700, align="center")
        fn(c, gx, gy, gw, gh, A, a)
        colr = A if out else DIM
        line(c, gx + gw + (6 if fn is _not_gate else 0), gy, 430, gy, colr, a, 4)
        if out:
            glow_dot(c, 446, gy, 16, A, a)
        else:
            circle(c, 446, gy, 16, DIM, a, stroke=3)
        text(c, name, gx + gw / 2 - 6, gy + gh / 2 + 34, 24, MUTED, a, align="center")
    # 真值表
    tx, ty = 540, 120
    hdr = ["A", "B", "A∧B", "A∨B"]
    for j, s in enumerate(hdr):
        text(c, s, tx + 20 + j * 75, ty, 26, A, a, weight=700, align="center", family="symbol" if "∧" in s or "∨" in s else "sans")
    line(c, tx - 15, ty + 16, tx + 300, ty + 16, MUTED, a * 0.6, 1.5)
    for r, (p, q) in enumerate(combos):
        yy = ty + 60 + r * 52
        hl = (r == step % 4)
        if hl:
            rrect(c, tx - 15, yy - 36, 315, 48, 10, fill=A, alpha=a * 0.18)
        for j, v in enumerate([p, q, p & q, p | q]):
            text(c, str(v), tx + 20 + j * 75, yy, 28, TEXT if hl else MUTED, a, align="center")
    pb = x.phase(2)
    if pb > 0.01:
        card(c, 530, 400, 320, 180, A, pb, title="1937 · 香农", body="开关的“通”与“断”，就是布尔代数里的 1 和 0。", body_size=22)


# ---------------------------------------------------------------- 第二章

_TM_RULES = {
    ("右移", "0"): ("0", 1, "右移"), ("右移", "1"): ("1", 1, "右移"), ("右移", "_"): ("_", -1, "进位"),
    ("进位", "1"): ("0", -1, "进位"), ("进位", "0"): ("1", -1, "回位"), ("进位", "_"): ("1", -1, "回位"),
    ("回位", "0"): ("0", -1, "回位"), ("回位", "1"): ("1", -1, "回位"), ("回位", "_"): ("_", 1, "右移"),
}


def _tm_trace(n=600):
    tape = {i: ch for i, ch in enumerate("1011")}
    pos, st = 0, "右移"
    out = []
    for _ in range(n):
        sym = tape.get(pos, "_")
        wr, mv, nst = _TM_RULES[(st, sym)]
        out.append((dict(tape), pos, st, sym))
        tape[pos] = wr
        pos += mv
        st = nst
    return out


_TM = _tm_trace()


@visual("turing_machine")
def turing_machine(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    a = appear(t, 0, 0.8)
    run_t = max(0.0, t - 0.8)
    sd = 0.55
    k = min(int(run_t / sd), len(_TM) - 2)
    f = clamp((run_t - k * sd) / (sd * 0.45))
    tape, pos, st, sym = _TM[k]
    tape2, pos2, _, _ = _TM[k + 1]
    head = lerp(pos, pos2, ease_in_out(f))
    cell = 72
    ty = 300
    cam = head
    c.save()
    c.clipRect(skia.Rect(20, 0, w - 20, h))
    for i in range(int(cam) - 8, int(cam) + 9):
        cx0 = w / 2 + (i - cam) * cell
        cur_tape = tape2 if f > 0.05 else tape
        s = cur_tape.get(i, "_")
        rrect(c, cx0 - cell / 2 + 3, ty - cell / 2, cell - 6, cell, 10, fill="#101a36", alpha=a)
        rrect(c, cx0 - cell / 2 + 3, ty - cell / 2, cell - 6, cell, 10, stroke=A, alpha=a * 0.35, width=2)
        if s != "_":
            text(c, s, cx0, ty + 16, 44, TEXT, a, weight=700, align="center")
    c.restore()
    # 读写头
    hx = w / 2 + (head - cam) * cell
    poly(c, [(hx - 26, ty - 92), (hx + 26, ty - 92), (hx, ty - 52)], A, a)
    rrect(c, hx - 44, ty - 52, 88, 104 + 8, 14, stroke=A, alpha=a, width=3)
    text(c, "读写头", hx, ty - 104, 22, A, a, align="center")
    text(c, "…", 50, ty + 14, 40, MUTED, a, align="center")
    text(c, "…", w - 50, ty + 14, 40, MUTED, a, align="center")
    text(c, "无限长的纸带", w / 2, ty + 90, 24, MUTED, a, align="center")
    # 状态与规则
    rrect(c, 40, 40, 230, 92, 16, fill="#0e1630", alpha=a * 0.9)
    rrect(c, 40, 40, 230, 92, 16, stroke=A, alpha=a * 0.5)
    text(c, "状态", 64, 78, 22, MUTED, a)
    text(c, st, 64, 116, 34, A, a, weight=700)
    num = int("".join(tape.get(i, "_") for i in range(-3, 8)).strip("_").replace("_", "0") or "0", 2)
    text(c, "纸带上的二进制数", w - 60, 78, 22, MUTED, a, align="right")
    text(c, f"= {num}", w - 60, 120, 38, TEXT, a, weight=700, align="right")
    keys = list(_TM_RULES.keys())
    for i, key in enumerate(keys):
        wr, mv, nst = _TM_RULES[key]
        col_, row = i % 3, i // 3
        rx, ry = 40 + col_ * 270, 450 + row * 56
        hl = key == (st, sym)
        rrect(c, rx, ry, 255, 46, 10, fill=A if hl else "#101a36", alpha=a * (0.28 if hl else 0.8))
        s = f"{key[0]},{key[1]} → {wr},{'R' if mv > 0 else 'L'},{nst}"
        text(c, s, rx + 127, ry + 31, 20, TEXT if hl else MUTED, a, align="center")
    pb = x.phase(2)
    if pb > 0.01:
        caption_tag(c, "通用图灵机：读入另一台机器的规则，并模拟它", w / 2, 648, A, pb, size=22)


@visual("neuron")
def neuron(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 3)
    if pa > 0.01:
        period = 2.0
        k = int(t / period)
        f = (t % period) / period
        pats = [(1, 0, 0), (1, 1, 0), (0, 1, 1), (0, 0, 1), (1, 1, 1), (1, 0, 1), (0, 1, 0)]
        inp = pats[k % len(pats)]
        fire = sum(inp) >= 2
        nx, ny, nr = 470, h / 2 - 20, 86
        ys = [130, h / 2 - 20, h - 170]
        for i, (v, yy) in enumerate(zip(inp, ys)):
            colr = A if v else DIM
            line(c, 110, yy, nx - nr * 0.9, ny + (yy - ny) * 0.25, colr, pa, 4 if v else 2)
            glow_dot(c, 80, yy, 24, colr, pa * (1 if v else 0.6)) if v else circle(c, 80, yy, 24, DIM, pa, stroke=3)
            text(c, f"x{i + 1}", 80, yy + 9, 26, "#0b1020" if v else MUTED, pa, weight=700, align="center")
            if v and f < 0.4:
                q = f / 0.4
                glow_dot(c, lerp(110, nx - nr * 0.9, q), lerp(yy, ny + (yy - ny) * 0.25, q), 7, WHITE, pa)
        glow = fire and f > 0.4
        if glow:
            circle(c, nx, ny, nr + 26, A, pa * 0.35, blur=24)
        circle(c, nx, ny, nr, "#101a36", pa)
        circle(c, nx, ny, nr, A, pa, stroke=4)
        text(c, "Σ", nx, ny - 2, 60, TEXT, pa, family="symbol", align="center")
        text(c, f"{sum(inp)} ≥ 2 ?", nx, ny + 44, 24, A if fire else MUTED, pa, align="center")
        out_c = A if glow else DIM
        arrow(c, nx + nr, ny, w - 120, ny, out_c, pa, 4 if glow else 2)
        if glow and f > 0.55:
            q = (f - 0.55) / 0.45
            glow_dot(c, lerp(nx + nr, w - 120, q), ny, 8, WHITE, pa)
        text(c, "1" if glow else "0", w - 80, ny + 16, 48, out_c, pa, weight=700, align="center")
        text(c, "输出", w - 80, ny + 60, 22, MUTED, pa, align="center")
        text(c, "输入", 80, h - 90, 22, MUTED, pa, align="center")
        text(c, "阈值 θ = 2", nx, ny + nr + 50, 26, MUTED, pa, align="center")
    pb = x.phase(3)
    if pb > 0.01:
        st = x.cue(3)
        n = max(0, int((t - st) / 1.6))
        f = ((t - st) % 1.6) / 1.6
        ax, bx, yy = 220, 650, h / 2 - 10
        width = 2 + min(n, 7) * 2.2
        flash = 1 - clamp(f / 0.35)
        line(c, ax, yy, bx, yy, A, pb * (0.5 + 0.5 * flash), width)
        for px_ in (ax, bx):
            circle(c, px_, yy, 70 + 16 * flash, A, pb * 0.35 * flash, blur=18)
            circle(c, px_, yy, 64, "#101a36", pb)
            circle(c, px_, yy, 64, A, pb, stroke=4)
        text(c, "A", ax, yy + 16, 44, TEXT, pb, weight=700, align="center")
        text(c, "B", bx, yy + 16, 44, TEXT, pb, weight=700, align="center")
        text(c, f"连接强度  ×{1 + min(n, 7)}", w / 2, yy - 60, 28, A, pb, align="center")
        text(c, "一起激发的神经元，连接会越来越强", w / 2, yy + 150, 30, TEXT, pb, align="center")
        text(c, "—— 赫布学习规则，1949", w / 2, yy + 195, 24, MUTED, pb, align="center")


@visual("eniac")
def eniac(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        for p in range(4):
            px0 = 40 + p * 200
            rrect(c, px0, 70, 180, 430, 8, fill="#121b33", alpha=pa)
            rrect(c, px0, 70, 180, 430, 8, stroke="#3a4a72", alpha=pa)
            for r in range(14):
                for q in range(5):
                    on = rand(p * 131 + r * 17 + q * 7 + int(t * 6) * 3) > 0.62
                    cx0, cy0 = px0 + 30 + q * 30, 100 + r * 28
                    if on:
                        glow_dot(c, cx0, cy0, 6, "#ffb347", pa, glow=2.2)
                    else:
                        circle(c, cx0, cy0, 6, "#4a3a22", pa)
        text(c, "ENIAC · 1946", w / 2, 560, 40, TEXT, pa, weight=700, align="center")
        text(c, "约 30 吨  ·  17,468 根真空管", w / 2, 610, 28, MUTED, pa, align="center")
    pb = x.phase(1)
    if pb > 0.01:
        names = ["信源", "编码", "信道", "解码", "信宿"]
        y0 = 150
        for i, s in enumerate(names):
            bx = 30 + i * 168
            rrect(c, bx, y0 - 36, 128, 72, 14, fill="#101a36", alpha=pb)
            rrect(c, bx, y0 - 36, 128, 72, 14, stroke=A, alpha=pb * 0.7, width=2)
            text(c, s, bx + 64, y0 + 10, 28, TEXT, pb, align="center")
            if i < 4:
                arrow(c, bx + 132, y0, bx + 164, y0, A, pb, 3, 10)
        arrow(c, 30 + 2 * 168 + 64, y0 + 110, 30 + 2 * 168 + 64, y0 + 42, "#ff8a65", pb, 3, 12)
        text(c, "噪声", 30 + 2 * 168 + 64, y0 + 140, 24, "#ff8a65", pb, align="center")
        for k in range(10):
            q = ((t - x.cue(1)) * 0.25 + k / 10) % 1
            bit = "01"[int(rand(k * 3.3) * 2)]
            text(c, bit, 30 + 64 + q * 672, y0 - 48, 22, A, pb * math.sin(q * math.pi), align="center")
        text(c, "香农 · 信息论（1948）", w / 2, y0 + 190, 26, MUTED, pb, align="center")
        # 控制论反馈环
        y1 = 470
        boxes = [("目标", 70), ("控制器", 330), ("系统", 590)]
        for s, bx in boxes:
            rrect(c, bx, y1 - 34, 150, 68, 14, fill="#101a36", alpha=pb)
            rrect(c, bx, y1 - 34, 150, 68, 14, stroke=A, alpha=pb * 0.7, width=2)
            text(c, s, bx + 75, y1 + 10, 28, TEXT, pb, align="center")
        arrow(c, 222, y1, 326, y1, A, pb, 3, 10)
        arrow(c, 482, y1, 586, y1, A, pb, 3, 10)
        pth = skia.Path()
        pth.moveTo(665, y1 + 36)
        pth.lineTo(665, y1 + 100)
        pth.lineTo(405, y1 + 100)
        pth.lineTo(405, y1 + 40)
        c.drawPath(pth, paint("#ffd166", pb, stroke=3))
        poly(c, [(405, y1 + 36), (396, y1 + 52), (414, y1 + 52)], "#ffd166", pb)
        q = ((t - x.cue(1)) * 0.4) % 1
        L = 64 + 260 + 60
        d = q * L
        if d < 64:
            px_, py_ = 665, y1 + 36 + d
        elif d < 324:
            px_, py_ = 665 - (d - 64), y1 + 100
        else:
            px_, py_ = 405, y1 + 100 - (d - 324)
        glow_dot(c, px_, py_, 6, "#ffd166", pb)
        text(c, "反馈", 535, y1 + 135, 24, "#ffd166", pb, align="center")
        text(c, "维纳 · 控制论（1948）", w / 2, y1 + 175, 26, MUTED, pb, align="center")


@visual("turing_test")
def turing_test(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        rrect(c, w / 2 - 250, 90, 500, 470, 6, fill="#efe8d8", alpha=pa * 0.95)
        text(c, "MIND", w / 2, 170, 48, "#1d1a14", pa, family="serif", weight=700, align="center")
        text(c, "VOL. LIX. NO. 236.]          [OCTOBER, 1950", w / 2, 210, 16, "#4a4438", pa, family="serif", align="center")
        line(c, w / 2 - 200, 232, w / 2 + 200, 232, "#4a4438", pa, 1.5)
        text(c, "I.—COMPUTING MACHINERY", w / 2, 300, 28, "#1d1a14", pa, family="serif", weight=700, align="center")
        text(c, "AND INTELLIGENCE", w / 2, 340, 28, "#1d1a14", pa, family="serif", weight=700, align="center")
        text(c, "BY A. M. TURING", w / 2, 392, 20, "#4a4438", pa, family="serif", align="center")
        for k in range(5):
            line(c, w / 2 - 200, 440 + k * 22, w / 2 + 200 - (60 if k == 4 else 0), 440 + k * 22, "#b9b09c", pa, 6)
    pb = x.phase(1, 2)
    if pb > 0.01:
        text(c, "机器能思考吗？", w / 2, h / 2, 84, TEXT, pb, family="serif", weight=700, align="center", glow=16, glow_color=A)
        text(c, "“Can machines think?”", w / 2, h / 2 + 80, 34, A, pb, family="serif", align="center")
    pc = x.phase(2)
    if pc > 0.01:
        line(c, w / 2 - 70, 80, w / 2 - 70, h - 110, MUTED, pc * 0.7, 4)
        person(c, 150, h / 2 - 60, 110, A, pc)
        text(c, "提问者 C", 150, h / 2 + 120, 26, TEXT, pc, align="center")
        for i, (lab, yy) in enumerate([("A", 190), ("B", 430)]):
            rrect(c, w - 300, yy - 110, 230, 200, 18, fill="#101a36", alpha=pc)
            rrect(c, w - 300, yy - 110, 230, 200, 18, stroke=A, alpha=pc * 0.6)
            reveal = x.phase(4) if lab == "B" else 0
            if reveal > 0.01:
                computer(c, w - 185, yy - 20, 120, A, pc * reveal, screen_glow=0.6)
            text(c, "?", w - 185, yy + 10, 96, TEXT, pc * (1 - reveal), weight=700, align="center")
            text(c, f"{'人' if lab == 'A' else '机器'} · {lab}" if reveal > 0.5 or (lab == 'A' and x.phase(4) > 0.5) else lab, w - 185, yy + 125, 26, MUTED, pc, align="center")
        msgs = [(1, "你会下棋吗？"), (0, "会。"), (1, "写一首关于福斯桥的十四行诗。"), (0, "这个我不行，我从来不会写诗。")]
        st = x.cue(2) + 0.6
        for i, (to_right, s) in enumerate(msgs):
            p = prog(t, st + i * 1.8, 1.4)
            if p <= 0 or p >= 1:
                continue
            ty = 120 + (i % 2) * 240 + 60
            bx = lerp(240, w - 330, p) if to_right else lerp(w - 330, 240, p)
            fade = math.sin(p * math.pi)
            tw = text_width(s, 22) + 30
            rrect(c, bx - tw / 2, ty - 30, tw, 46, 20, fill=A if to_right else "#26324f", alpha=pc * fade * 0.9)
            text(c, s, bx, ty + 1, 22, "#0b1020" if to_right else TEXT, pc * fade, align="center")
        text(c, "模仿游戏", w / 2 - 70, h - 60, 30, A, pc, weight=700, align="center")


# ---------------------------------------------------------------- 第三章

_DART = [("约翰·麦卡锡", "John McCarthy"), ("马文·明斯基", "Marvin Minsky"),
         ("纳撒尼尔·罗切斯特", "Nathaniel Rochester"), ("克劳德·香农", "Claude Shannon")]
_DART2 = [("艾伦·纽厄尔", "Allen Newell"), ("赫伯特·西蒙", "Herbert Simon"), ("亚瑟·塞缪尔", "Arthur Samuel"),
          ("奥利弗·塞弗里奇", "Oliver Selfridge"), ("雷·所罗门诺夫", "Ray Solomonoff"), ("特伦查德·摩尔", "Trenchard More")]


@visual("dartmouth")
def dartmouth(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    cx, cy = w / 2, h / 2 + 30
    a = appear(t, 0, 0.8)
    pq = x.phase(3)
    shrink = 1 - 0.35 * pq
    c.save()
    c.translate(cx, cy - 70 * pq)
    c.scale(shrink, shrink)
    circle(c, 0, 0, 92, A, a * 0.25, blur=20)
    circle(c, 0, 0, 86, "#101a36", a)
    circle(c, 0, 0, 86, A, a, stroke=3)
    text(c, "1956", 0, -4, 40, A, a, weight=700, align="center")
    text(c, "达特茅斯", 0, 34, 24, TEXT, a, align="center")
    for i, (zh, en) in enumerate(_DART):
        ang = -math.pi / 2 + i * math.pi / 2 + math.pi / 4
        ai = appear(t, 0.4 + i * 0.35, 0.6)
        px_, py_ = 205 * math.cos(ang), 160 * math.sin(ang)
        line(c, 86 * math.cos(ang), 86 * math.sin(ang), px_ * 0.82, py_ * 0.82, A, ai * 0.5, 2)
        glow_dot(c, px_ * 0.82, py_ * 0.82, 6, A, ai)
        text(c, zh, px_, py_ + (34 if py_ > 0 else -30), 26, TEXT, ai, weight=700, align="center")
        text(c, en, px_, py_ + (64 if py_ > 0 else 0), 18, MUTED, ai, align="center")
    for i, (zh, en) in enumerate(_DART2):
        ai = x.phase(2) * appear(t, x.cue(2) + i * 0.25, 0.6)
        side = -1 if i % 2 == 0 else 1
        px_, py_ = side * 345, -235 + (i // 2) * 235
        glow_dot(c, px_ - side * 92, py_ - 8, 4, A, ai * 0.8)
        text(c, zh, px_, py_, 22, TEXT, ai * 0.85, align="center")
        text(c, en, px_, py_ + 28, 16, MUTED, ai * 0.85, align="center")
    c.restore()
    pb = x.phase(1)
    if pb > 0.01:
        s = typed("Artificial Intelligence", t, x.cue(1), 12)
        text(c, s, w / 2, 58, 44, A, pb, family="serif", weight=700, align="center", glow=12)
    if pq > 0.01:
        rrect(c, 40, h - 170, w - 80, 150, 16, fill="#0e1630", alpha=pq * 0.92)
        rrect(c, 40, h - 170, w - 80, 150, 16, stroke=A, alpha=pq * 0.5)
        text_block(c, "“…every aspect of learning or any other feature of intelligence can in principle be so precisely described that a machine can be made to simulate it.”",
                   70, h - 125, 24, w - 140, family="serif", color=TEXT, alpha=pq, line_h=34)


@visual("logic_tree")
def logic_tree(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    levels = [1, 3, 9, 18, 36]
    ys = [110, 215, 320, 425, 530]
    nodes = []
    for d, n in enumerate(levels):
        span = w - 80
        nodes.append([(40 + span * (i + 0.5) / n, ys[d]) for i in range(n)])
    path = [0, 1, 4, 9, 19]
    grow = (t - 0.3) / 1.4
    for d in range(1, len(levels)):
        a = clamp(grow - d + 1)
        if a <= 0:
            continue
        per = levels[d] // levels[d - 1]
        for i, (px_, py_) in enumerate(nodes[d]):
            par = nodes[d - 1][i // per]
            on = path[d] == i and path[d - 1] == i // per
            line(c, par[0], par[1], lerp(par[0], px_, a), lerp(par[1], py_, a), A if on and x.t > x.cue(2) else MUTED,
                 a * (1 if on and x.t > x.cue(2) else 0.35), 3 if on else 1.5)
    for d in range(len(levels)):
        a = clamp(grow - d + 1)
        for i, (px_, py_) in enumerate(nodes[d]):
            on = path[d] == i
            r = 18 if d == 0 else (10 if d < 3 else 6)
            if on and t > x.cue(2):
                glow_dot(c, px_, py_, r, A, a)
            else:
                circle(c, px_, py_, r, "#1a2645", a)
                circle(c, px_, py_, r, MUTED, a * 0.7, stroke=1.5)
    if t > x.cue(2):
        gx, gy = nodes[4][path[4]]
        p = appear(t, x.cue(2) + 0.5)
        text(c, "∎ 证毕", gx, gy + 46, 26, A, p, weight=700, align="center")
    pb = x.phase(1)
    if pb > 0.01:
        rrect(c, w - 250, 120, 210, 120, 16, fill="#0e1630", alpha=pb * 0.96)
        rrect(c, w - 250, 120, 210, 120, 16, stroke=A, alpha=pb * 0.5)
        n = int(lerp(0, 38, ease_out(prog(t, x.cue(1), 2.5))))
        text(c, f"{n} / 52", w - 145, 185, 46, A, pb, weight=700, align="center")
        text(c, "条定理被证明", w - 145, 222, 20, MUTED, pb, align="center")
    caption_tag(c, "问题求解 = 在可能性之树中搜索", w / 2, 50, A, x.phase(2))


# ---------------------------------------------------------------- 第四章

def _perceptron_trace():
    pts = []
    for i in range(34):
        cls = 1 if i % 2 == 0 else -1
        px_ = rand(i * 3.7) * 0.8 + 0.1
        py_ = rand(i * 5.1) * 0.8 + 0.1
        if (py_ - (0.25 + 0.5 * px_)) * cls < 0.06:
            py_ = clamp(0.25 + 0.5 * px_ + cls * (0.08 + 0.3 * rand(i * 9.3)), 0.04, 0.96)
        pts.append((px_, py_, cls))
    wv = [0.2, -1.0, 0.6]
    states = [(list(wv), -1)]
    for epoch in range(30):
        changed = False
        for i, (px_, py_, cls) in enumerate(pts):
            s = wv[0] * px_ + wv[1] * py_ + wv[2]
            if s * cls <= 0:
                wv = [wv[0] + 0.5 * cls * px_, wv[1] + 0.5 * cls * py_, wv[2] + 0.5 * cls]
                states.append((list(wv), i))
                changed = True
        if not changed:
            break
    return pts, states


_PTS, _PSTATES = _perceptron_trace()


def _scatter_frame(c, ox, oy, s, alpha):
    rrect(c, ox, oy, s, s, 12, fill="#0c1430", alpha=alpha * 0.9)
    rrect(c, ox, oy, s, s, 12, stroke="#2c3a60", alpha=alpha)


def _sep_line(c, wv, ox, oy, s, color, alpha):
    w0, w1, b = wv
    c.save()
    c.clipRect(skia.Rect(ox, oy, ox + s, oy + s))
    if abs(w1) > 1e-6:
        y_at = lambda xx: -(w0 * xx + b) / w1
        c.drawLine(ox, oy + s * (1 - y_at(0)), ox + s, oy + s * (1 - y_at(1)), paint(color, alpha, stroke=4))
    c.restore()


@visual("perceptron")
def perceptron(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 2)
    if pa > 0.01:
        ox, oy, s = 60, 60, 520
        _scatter_frame(c, ox, oy, s, pa)
        k = min(int(max(0, t - 0.8) / 0.75), len(_PSTATES) - 1)
        wv, bad = _PSTATES[k]
        for i, (px_, py_, cls) in enumerate(_PTS):
            X, Y = ox + px_ * s, oy + (1 - py_) * s
            if cls > 0:
                circle(c, X, Y, 10, "#5ad1f0", pa)
            else:
                line(c, X - 9, Y - 9, X + 9, Y + 9, "#ffb454", pa, 4)
                line(c, X - 9, Y + 9, X + 9, Y - 9, "#ffb454", pa, 4)
            if i == bad:
                circle(c, X, Y, 22, RED, pa * (1 - ((t - 0.8) % 0.75) / 0.75), stroke=3)
        _sep_line(c, wv, ox, oy, s, A, pa)
        done = k == len(_PSTATES) - 1
        text(c, "权重调整次数", 620, 140, 24, MUTED, pa)
        text(c, str(k), 620, 210, 64, A, pa, weight=700)
        text(c, "✓ 全部分对" if done else "犯错 → 调整权重", 620, 280, 28, GREEN if done else TEXT, pa)
        text(c, f"w1 = {wv[0]:+.2f}", 620, 360, 24, MUTED, pa, family="mono")
        text(c, f"w2 = {wv[1]:+.2f}", 620, 395, 24, MUTED, pa, family="mono")
        text(c, f"b  = {wv[2]:+.2f}", 620, 430, 24, MUTED, pa, family="mono")
    pb = x.phase(2, 3)
    if pb > 0.01:
        n = 20
        cs = 22
        ox, oy = w / 2 - n * cs / 2, 70
        letter = ["....................", "........##..........", ".......####.........", "......##..##........",
                  ".....##....##.......", ".....##....##.......", "....##......##......", "....##......##......",
                  "...############.....", "...############.....", "..##..........##....", "..##..........##....",
                  ".##............##...", ".##............##...", "##..............##..", "....................",
                  "....................", "....................", "....................", "...................."]
        rev = prog(t, x.cue(2), 2.0)
        for r in range(n):
            for q in range(n):
                on = letter[r][q] == "#" and rand(r * 31 + q) < rev * 1.2
                cx0, cy0 = ox + q * cs + cs / 2, oy + r * cs + cs / 2
                if on:
                    circle(c, cx0, cy0, 8, A, pb)
                else:
                    circle(c, cx0, cy0, 6, "#1f2b4a", pb)
        text(c, "马克一号感知机：20×20 光电管“视网膜”", w / 2, oy + n * cs + 50, 28, TEXT, pb, align="center")
    pc = x.phase(3)
    if pc > 0.01:
        px0, py0, pw, ph = 90, 70, w - 180, 470
        rrect(c, px0, py0, pw, ph, 4, fill="#efe8d8", alpha=pc)
        text(c, "The New York Times", px0 + pw / 2, py0 + 70, 46, "#151515", pc, family="serif", weight=700, align="center")
        line(c, px0 + 30, py0 + 96, px0 + pw - 30, py0 + 96, "#151515", pc, 2)
        text(c, "JULY 8, 1958", px0 + pw / 2, py0 + 122, 18, "#333", pc, family="serif", align="center")
        line(c, px0 + 30, py0 + 136, px0 + pw - 30, py0 + 136, "#151515", pc, 1)
        text(c, "NEW NAVY DEVICE", px0 + pw / 2, py0 + 215, 54, "#111", pc, family="serif", weight=900, align="center")
        text(c, "LEARNS BY DOING", px0 + pw / 2, py0 + 280, 54, "#111", pc, family="serif", weight=900, align="center")
        text(c, "Psychologist Shows Embryo of Computer", px0 + pw / 2, py0 + 340, 24, "#333", pc, family="serif", align="center")
        text(c, "Designed to Read and Grow Wiser", px0 + pw / 2, py0 + 374, 24, "#333", pc, family="serif", align="center")
        for k in range(3):
            line(c, px0 + 40, py0 + 412 + k * 18, px0 + pw - 40 - k * 80, py0 + 412 + k * 18, "#bdb4a0", pc, 6)


_LISP = ["(defun factorial (n)", "  (if (<= n 1)", "      1", "      (* n (factorial (- n 1)))))", "",
         "(factorial 10)", "=> 3628800"]


def _checkers_moves():
    board = {}
    for r in range(8):
        for q in range(8):
            if (r + q) % 2 == 1 and (r < 3 or r > 4):
                board[(r, q)] = 1 if r < 3 else 2
    seq = [dict(board)]
    turn = 2
    for k in range(60):
        opts = []
        for (r, q), v in board.items():
            if v != turn:
                continue
            dr = -1 if v == 2 else 1
            for dq in (-1, 1):
                nr, nq = r + dr, q + dq
                if 0 <= nr < 8 and 0 <= nq < 8 and (nr, nq) not in board:
                    opts.append(((r, q), (nr, nq)))
        if not opts:
            break
        a, b = opts[int(rand(k * 7.7 + 1) * len(opts))]
        board = dict(board)
        board[b] = board.pop(a)
        seq.append(dict(board))
        turn = 3 - turn
    return seq


_CHECKERS = _checkers_moves()


@visual("lisp")
def lisp(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        rrect(c, 40, 50, w - 80, 500, 16, fill="#0a1022", alpha=pa)
        rrect(c, 40, 50, w - 80, 500, 16, stroke="#2c3a60", alpha=pa)
        for k, cc in enumerate(["#ff5f56", "#ffbd2e", "#27c93f"]):
            circle(c, 72 + k * 26, 80, 8, cc, pa)
        text(c, "LISP · 1958", w / 2, 88, 22, MUTED, pa, align="center")
        full = "\n".join(_LISP)
        shown = typed(full, t, 0.5, 34)
        for i, ln in enumerate(shown.split("\n")):
            colr = GREEN if ln.startswith("=>") else (A if ln.startswith("(f") else TEXT)
            text(c, ln, 80, 160 + i * 52, 30, colr, pa, family="mono")
    pb = x.phase(1)
    if pb > 0.01:
        k = min(int(max(0, t - x.cue(1) - 0.5) / 0.7), len(_CHECKERS) - 1)
        board = _CHECKERS[k]
        cs, ox, oy = 62, 50, 60
        for r in range(8):
            for q in range(8):
                dark = (r + q) % 2 == 1
                c.drawRect(skia.Rect.MakeXYWH(ox + q * cs, oy + r * cs, cs, cs), paint("#6b4a2b" if dark else "#e8d5b0", pb))
        for (r, q), v in board.items():
            X, Y = ox + q * cs + cs / 2, oy + r * cs + cs / 2
            circle(c, X, Y + 3, 24, "#000000", pb * 0.4)
            circle(c, X, Y, 24, "#c0392b" if v == 1 else "#1d1d1d", pb)
            circle(c, X, Y, 17, "#ffffff", pb * 0.25, stroke=2)
        gx = ox + 8 * cs + 50
        text(c, "自我对弈", gx, 100, 28, TEXT, pb, weight=700)
        games = int(lerp(1, 10000, ease_in_out(prog(t, x.cue(1), x.dur - x.cue(1)))))
        text(c, f"第 {games:,} 局", gx, 150, 26, MUTED, pb)
        # 棋力曲线
        bx, by, bw, bh = gx, 200, 260, 240
        line(c, bx, by + bh, bx + bw, by + bh, MUTED, pb, 2)
        line(c, bx, by, bx, by + bh, MUTED, pb, 2)
        pp = prog(t, x.cue(1), x.dur - x.cue(1))
        cur = skia.Path()
        for i in range(int(60 * pp) + 1):
            u = i / 60
            yy = by + bh - bh * (1 - math.exp(-3.2 * u)) * 0.9
            (cur.moveTo if i == 0 else cur.lineTo)(bx + u * bw, yy)
        c.drawPath(cur, paint(A, pb, stroke=4))
        text(c, "棋力", bx - 6, by - 14, 22, MUTED, pb)
        text(c, "经验 →", bx + bw, by + bh + 34, 22, MUTED, pb, align="right")


_ELIZA = [
    ("E", "HOW DO YOU DO. PLEASE TELL ME YOUR PROBLEM."),
    ("U", "Men are all alike."),
    ("E", "IN WHAT WAY?"),
    ("U", "They're always bugging us about something or other."),
    ("E", "CAN YOU THINK OF A SPECIFIC EXAMPLE?"),
    ("U", "Well, my boyfriend made me come here."),
    ("E", "YOUR BOYFRIEND MADE YOU COME HERE?"),
    ("U", "He says I'm depressed much of the time."),
    ("E", "I AM SORRY TO HEAR YOU ARE DEPRESSED."),
]


@visual("eliza")
def eliza(c, x):
    t, w, h = x.t, x.w, x.h
    a = appear(t, 0, 0.8)
    rrect(c, 30, 30, w - 60, h - 60, 18, fill="#03140a", alpha=a)
    rrect(c, 30, 30, w - 60, h - 60, 18, stroke="#1f6b3a", alpha=a, width=3)
    G = "#39ff88"
    text(c, "ELIZA — MIT, 1966", 60, 72, 20, "#1f9d55", a, family="mono")
    y = 120
    clock = 0.8
    for who, s in _ELIZA:
        s2 = ("> " if who == "U" else "") + s
        cps = 30 if who == "E" else 16
        shown = typed(s2, t, clock, cps)
        clock += len(s2) / cps + 0.7
        if not shown:
            break
        from ..gfx import wrap
        for ln in wrap(shown, 23, w - 140, family="mono"):
            text(c, ln, 60, y, 23, G if who == "E" else "#d7ffe6", a, family="mono", glow=6 if who == "E" else None, glow_color=G)
            y += 34
        y += 10
    if int(t * 2) % 2 == 0:
        c.drawRect(skia.Rect.MakeXYWH(60, y - 26, 14, 28), paint(G, a))
    pb = x.phase(3)
    if pb > 0.01:
        caption_tag(c, "ELIZA 效应：把模式匹配误认为“理解”", w / 2, h - 50, x.accent, pb)


def _astar(cols, rows, walls, start, goal):
    import heapq
    openh = [(0, start)]
    g = {start: 0}
    came = {}
    order = []
    seen = set()
    while openh:
        _, cur = heapq.heappop(openh)
        if cur in seen:
            continue
        seen.add(cur)
        order.append(cur)
        if cur == goal:
            break
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nb = (cur[0] + d[0], cur[1] + d[1])
            if not (0 <= nb[0] < cols and 0 <= nb[1] < rows) or nb in walls:
                continue
            ng = g[cur] + 1
            if ng < g.get(nb, 1e9):
                g[nb] = ng
                came[nb] = cur
                hh = abs(nb[0] - goal[0]) + abs(nb[1] - goal[1])
                heapq.heappush(openh, (ng + hh, nb))
    path = [goal]
    while path[-1] != start:
        path.append(came[path[-1]])
    return order, path[::-1]


_COLS, _ROWS = 17, 11
_WALLS = set()
for _r in range(0, 8):
    _WALLS.add((5, _r))
for _r in range(3, 11):
    _WALLS.add((11, _r))
for _q in range(7, 11):
    _WALLS.add((_q, 3))
_WALLS |= {(8, 6), (8, 7), (9, 7), (14, 2), (14, 3), (2, 8), (3, 8)}
_START, _GOAL = (1, 2), (15, 8)
_ORDER, _PATH = _astar(_COLS, _ROWS, _WALLS, _START, _GOAL)


def _shakey_side(c, cx, cy, s, color, a, t):
    wob = math.sin(t * 7) * 2.5
    rrect(c, cx - 70 * s, cy + 40 * s, 140 * s, 50 * s, 10, fill=color, alpha=a * 0.2)
    rrect(c, cx - 70 * s, cy + 40 * s, 140 * s, 50 * s, 10, stroke=color, alpha=a, width=3)
    for q in (-40, 40):
        circle(c, cx + q * s, cy + 98 * s, 18 * s, color, a, stroke=3)
    rrect(c, cx - 55 * s + wob, cy - 110 * s, 110 * s, 150 * s, 8, fill=color, alpha=a * 0.15)
    rrect(c, cx - 55 * s + wob, cy - 110 * s, 110 * s, 150 * s, 8, stroke=color, alpha=a, width=3)
    for k in range(4):
        line(c, cx - 35 * s + wob, cy - 80 * s + k * 28 * s, cx + 35 * s + wob, cy - 80 * s + k * 28 * s, color, a * 0.5, 2)
    rrect(c, cx - 38 * s + wob * 1.6, cy - 175 * s, 76 * s, 56 * s, 8, stroke=color, alpha=a, width=3)
    circle(c, cx + 16 * s + wob * 1.6, cy - 147 * s, 15 * s, color, a, stroke=3)
    glow_dot(c, cx + 16 * s + wob * 1.6, cy - 147 * s, 5 * s, "#7fdcff", a)
    line(c, cx - 20 * s + wob * 2, cy - 175 * s, cx - 30 * s + wob * 3, cy - 235 * s, color, a, 3)
    glow_dot(c, cx - 30 * s + wob * 3, cy - 238 * s, 5, "#ff6b6b", a * (0.5 + 0.5 * math.sin(t * 5)))


@visual("shakey")
def shakey(c, x):
    t, w, h = x.t, x.w, x.h
    A = x.accent
    pa = x.phase(0, 1)
    if pa > 0.01:
        _shakey_side(c, w / 2, h / 2 + 40, 1.4, A, pa, t)
        text(c, "Shakey · 1966 — 1972", w / 2, h - 50, 30, TEXT, pa, align="center")
    pb = x.phase(1)
    if pb > 0.01:
        cs = 46
        ox, oy = (w - _COLS * cs) / 2, 60
        for q in range(_COLS):
            for r in range(_ROWS):
                X, Y = ox + q * cs, oy + r * cs
                if (q, r) in _WALLS:
                    c.drawRect(skia.Rect.MakeXYWH(X + 1, Y + 1, cs - 2, cs - 2), paint("#5b6785", pb))
                else:
                    c.drawRect(skia.Rect.MakeXYWH(X + 1, Y + 1, cs - 2, cs - 2), paint("#0f1834", pb))
        s0, s1 = x.cue(1) + 1.0, x.cue(2) + 1.5
        n = int(len(_ORDER) * prog(t, s0, max(1.0, s1 - s0)))
        for i, (q, r) in enumerate(_ORDER[:n]):
            age = clamp((n - i) / 25)
            c.drawRect(skia.Rect.MakeXYWH(ox + q * cs + 3, oy + r * cs + 3, cs - 6, cs - 6),
                       paint(A, pb * (0.55 - 0.35 * age)))
        if n >= len(_ORDER):
            pp = prog(t, s1, 1.2)
            m = int(len(_PATH) * pp)
            pts = [(ox + q * cs + cs / 2, oy + r * cs + cs / 2) for q, r in _PATH[:max(m, 1)]]
            for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
                line(c, x1, y1, x2, y2, "#ffd166", pb, 6)
        gx, gy = ox + _GOAL[0] * cs + cs / 2, oy + _GOAL[1] * cs + cs / 2
        glow_dot(c, gx, gy, 12, "#ff6b6b", pb)
        text(c, "目标", gx, gy + 44, 20, TEXT, pb, align="center")
        # 机器人沿路径移动
        mv = ease_in_out(prog(t, s1 + 1.5, max(2.0, x.dur - s1 - 2.5)))
        fpos = mv * (len(_PATH) - 1)
        i0 = int(fpos)
        i1 = min(i0 + 1, len(_PATH) - 1)
        fr = fpos - i0
        rx = ox + lerp(_PATH[i0][0], _PATH[i1][0], fr) * cs + cs / 2
        ry = oy + lerp(_PATH[i0][1], _PATH[i1][1], fr) * cs + cs / 2
        circle(c, rx, ry, 17, "#ffffff", pb)
        circle(c, rx, ry, 17, A, pb, stroke=4)
        text(c, "A* 搜索：已探索的格子", w / 2, oy + _ROWS * cs + 50, 24, MUTED, pb, align="center")
