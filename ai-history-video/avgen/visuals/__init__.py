"""右侧插图库。每个插图是一个函数 f(c, x)，在 (0,0)-(x.w,x.h) 的面板坐标内作画。

x 是 Ctx：提供场景内时间 t、各句解说的起点 cues、强调色 accent 等，
方便让画面变化与解说同步。
"""
import math

import skia

from ..gfx import (MUTED, TEXT, appear, ease_in_out, paint, prog, rrect, text)

REGISTRY = {}


def visual(name):
    def deco(fn):
        REGISTRY[name] = fn
        return fn
    return deco


class Ctx:
    def __init__(self, t, dur, cues, line_durs, accent, w, h):
        self.t, self.dur, self.cues, self.line_durs = t, dur, cues, line_durs
        self.accent, self.w, self.h = accent, w, h

    def cue(self, i):
        """第 i 句解说开始的时间；越界时返回场景末尾。"""
        if i < 0:
            return 0.0
        return self.cues[i] if i < len(self.cues) else self.dur

    def cue_end(self, i):
        if i < len(self.cues):
            return self.cues[i] + self.line_durs[i]
        return self.dur

    def phase(self, i, j=None, fade=0.6):
        """从第 i 句开始淡入、到第 j 句开始时淡出的透明度。"""
        a = appear(self.t, self.cue(i) - (0.3 if i > 0 else 0), fade) if i > 0 else appear(self.t, 0.0, fade)
        if j is not None and j < len(self.cues):
            a *= 1 - ease_in_out(prog(self.t, self.cue(j) - 0.45, 0.45))
        return a

    def since(self, i):
        return self.t - self.cue(i)


def draw(name, c, x):
    REGISTRY[name](c, x)


# ------------------------------------------------------------------ 常用图形

def gear_path(cx, cy, r, teeth, angle, depth=0.16):
    p = skia.Path()
    n = teeth * 4
    for k in range(n + 1):
        a = angle + 2 * math.pi * k / n
        rr = r if (k % 4) in (1, 2) else r * (1 - depth)
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        if k == 0:
            p.moveTo(x, y)
        else:
            p.lineTo(x, y)
    p.close()
    return p


def gear(c, cx, cy, r, teeth, angle, color, alpha=1.0, fill_alpha=0.18):
    p = gear_path(cx, cy, r, teeth, angle)
    c.drawPath(p, paint(color, alpha * fill_alpha))
    c.drawPath(p, paint(color, alpha, stroke=2.5))
    c.drawCircle(cx, cy, r * 0.28, paint(color, alpha, stroke=2.5))
    for k in range(4):
        a = angle + k * math.pi / 2
        c.drawLine(cx + r * 0.28 * math.cos(a), cy + r * 0.28 * math.sin(a),
                   cx + r * 0.7 * math.cos(a), cy + r * 0.7 * math.sin(a), paint(color, alpha * 0.8, stroke=2))


def person(c, x, y, s, color, alpha=1.0, fill=True):
    """简笔人像：头 + 肩。(x,y) 为头部中心，s 为尺寸。"""
    if fill:
        c.drawCircle(x, y, s * 0.32, paint(color, alpha))
        path = skia.Path()
        path.addRoundRect(skia.Rect.MakeXYWH(x - s * 0.55, y + s * 0.42, s * 1.1, s * 0.8), s * 0.45, s * 0.45)
        c.save()
        c.clipRect(skia.Rect(x - s, y + s * 0.4, x + s, y + s * 1.05))
        c.drawPath(path, paint(color, alpha))
        c.restore()
    else:
        c.drawCircle(x, y, s * 0.32, paint(color, alpha, stroke=3))
        c.drawArc(skia.Rect.MakeXYWH(x - s * 0.55, y + s * 0.42, s * 1.1, s * 1.0), 180, 180, False, paint(color, alpha, stroke=3))


def computer(c, x, y, s, color, alpha=1.0, screen_glow=0.0):
    """简笔电脑：(x,y) 为屏幕中心。"""
    rrect(c, x - s * 0.6, y - s * 0.42, s * 1.2, s * 0.8, s * 0.08, fill=color, alpha=alpha * 0.15)
    rrect(c, x - s * 0.6, y - s * 0.42, s * 1.2, s * 0.8, s * 0.08, stroke=color, alpha=alpha, width=3)
    if screen_glow:
        rrect(c, x - s * 0.5, y - s * 0.32, s * 1.0, s * 0.6, s * 0.04, fill=color, alpha=alpha * screen_glow * 0.35)
    c.drawLine(x, y + s * 0.38, x, y + s * 0.55, paint(color, alpha, stroke=3))
    c.drawLine(x - s * 0.28, y + s * 0.58, x + s * 0.28, y + s * 0.58, paint(color, alpha, stroke=3))


def card(c, x, y, w, h, accent, alpha=1.0, title=None, body=None, title_size=30, body_size=22, r=18):
    rrect(c, x, y, w, h, r, fill="#0e1630", alpha=alpha, fill_alpha=0.85)
    rrect(c, x, y, w, h, r, stroke=accent, alpha=alpha * 0.55, width=2)
    if title:
        text(c, title, x + 24, y + 24 + title_size, title_size, accent, alpha, weight=700)
    if body:
        from ..gfx import text_block
        text_block(c, body, x + 24, y + 40 + title_size + body_size * 1.2, body_size, w - 48, color=TEXT, alpha=alpha * 0.9)


def label(c, s, x, y, size=24, color=MUTED, alpha=1.0, align="center", weight=400):
    text(c, s, x, y, size, color, alpha, weight=weight, align=align)


def caption_tag(c, s, x, y, accent, alpha=1.0, size=22):
    """带底色的小标签。"""
    from ..gfx import text_width
    w = text_width(s, size) + 28
    rrect(c, x - w / 2, y - size - 6, w, size + 18, (size + 18) / 2, fill=accent, alpha=alpha * 0.18)
    rrect(c, x - w / 2, y - size - 6, w, size + 18, (size + 18) / 2, stroke=accent, alpha=alpha * 0.6, width=1.5)
    text(c, s, x, y, size, TEXT, alpha, align="center")


def typed(s, t, start, cps=14.0):
    """打字机效果：返回到时间 t 为止已“打出”的前缀。"""
    n = int(max(0.0, t - start) * cps)
    return s[:n]


from . import va, vb, vc  # noqa: E402,F401  注册所有插图
