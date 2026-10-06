"""Skia 绘图小工具：颜色、缓动、文字排版、常用形状。"""
import math
from functools import lru_cache

import skia

W, H = 1920, 1080

# ------------------------------------------------------------------ 数学与缓动

def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def prog(t, start, dur):
    """t 在 [start, start+dur] 内从 0 线性走到 1。"""
    if dur <= 0:
        return 1.0 if t >= start else 0.0
    return clamp((t - start) / dur)


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = clamp(t)
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def ease_out_back(t, s=1.4):
    t = clamp(t)
    return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2


def appear(t, start, dur=0.6):
    return ease_out(prog(t, start, dur))


def rand(seed):
    """确定性的伪随机数（0~1），保证每次渲染结果一致。"""
    x = math.sin(seed * 12.9898 + 78.233) * 43758.5453
    return x - math.floor(x)


# ------------------------------------------------------------------ 颜色

def hex_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(c1, c2, t):
    a, b = hex_rgb(c1) if isinstance(c1, str) else c1, hex_rgb(c2) if isinstance(c2, str) else c2
    return tuple(int(round(lerp(x, y, t))) for x, y in zip(a, b))


def col(c, alpha=1.0):
    r, g, b = hex_rgb(c) if isinstance(c, str) else c
    return skia.ColorSetARGB(int(clamp(alpha) * 255), r, g, b)


WHITE = "#ffffff"
TEXT = "#eef2ff"
MUTED = "#9aa8c7"
DIM = "#5b6785"
BG = "#050816"


def paint(c=WHITE, alpha=1.0, stroke=None, cap_round=True, blur=None, shader=None):
    p = skia.Paint(AntiAlias=True)
    p.setColor(col(c, alpha))
    if stroke is not None:
        p.setStyle(skia.Paint.kStroke_Style)
        p.setStrokeWidth(stroke)
        if cap_round:
            p.setStrokeCap(skia.Paint.kRound_Cap)
            p.setStrokeJoin(skia.Paint.kRound_Join)
    if blur:
        p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
    if shader is not None:
        p.setShader(shader)
        p.setAlphaf(clamp(alpha))
    return p


# ------------------------------------------------------------------ 字体与文字

FAMILIES = {
    "sans": "Noto Sans CJK SC",
    "serif": "Noto Serif CJK SC",
    "mono": "Noto Sans Mono CJK SC",
    "symbol": "DejaVu Sans",
    "lserif": "DejaVu Serif",
}


@lru_cache(maxsize=None)
def typeface(family="sans", weight=400):
    return skia.Typeface(FAMILIES[family], skia.FontStyle(weight, 5, skia.FontStyle.kUpright_Slant))


@lru_cache(maxsize=None)
def font(size, weight=400, family="sans"):
    f = skia.Font(typeface(family, weight), size)
    f.setEdging(skia.Font.Edging.kAntiAlias)
    f.setSubpixel(True)
    f.setHinting(skia.FontHinting.kNone)
    return f


_HAS = {}


def _has_glyph(family, weight, ch):
    key = (family, weight, ch)
    if key not in _HAS:
        _HAS[key] = font(20, weight, family).textToGlyphs(ch)[0] != 0
    return _HAS[key]


def _runs(s, family, weight):
    """按字形覆盖拆分文字：主字体缺字的字符改用 DejaVu Sans 绘制。"""
    runs = []
    for ch in s:
        fam = family if (family == "symbol" or _has_glyph(family, weight, ch)) else "symbol"
        if runs and runs[-1][0] == fam:
            runs[-1][1] += ch
        else:
            runs.append([fam, ch])
    return runs


def text_width(s, size, weight=400, family="sans", spacing=0.0):
    w = sum(font(size, weight, fam).measureText(r) for fam, r in _runs(s, family, weight))
    return w + spacing * max(0, len(s) - 1)


def text(c, s, x, y, size, color=TEXT, alpha=1.0, weight=400, family="sans", align="left",
         spacing=0.0, glow=None, glow_color=None):
    """在基线 y 处绘制单行文字。align: left / center / right。返回文字宽度。"""
    if alpha <= 0.003 or not s:
        return 0
    w = text_width(s, size, weight, family, spacing)
    if align == "center":
        x -= w / 2
    elif align == "right":
        x -= w
    p = paint(color, alpha)
    gp = paint(glow_color or color, alpha * 0.6, blur=glow) if glow else None
    cx = x
    for fam, run in _runs(s, family, weight):
        f = font(size, weight, fam)
        pieces = list(run) if spacing else [run]
        for piece in pieces:
            if gp is not None:
                c.drawString(piece, cx, y, f, gp)
            c.drawString(piece, cx, y, f, p)
            cx += f.measureText(piece) + spacing
    return w


_NO_LINE_START = set("，。、：；！？）》」』”’…—%·")
_NO_LINE_END = set("（《「『“‘")


def wrap(s, size, max_w, weight=400, family="sans"):
    """中英文混排的自动换行：英文单词不拆开，标点不出现在行首。"""
    f = font(size, weight, family)
    tokens = []
    buf = ""
    for ch in s:
        if ch.isascii() and (ch.isalnum() or ch in "-.'%+:/"):
            buf += ch
        else:
            if buf:
                tokens.append(buf)
                buf = ""
            tokens.append(ch)
    if buf:
        tokens.append(buf)
    lines, cur = [], ""
    for tok in tokens:
        if cur and f.measureText(cur + tok) > max_w and tok not in _NO_LINE_START and cur[-1] not in _NO_LINE_END:
            lines.append(cur.rstrip())
            cur = tok.lstrip()
        else:
            cur += tok
    if cur.strip():
        lines.append(cur.rstrip())
    return lines


def text_block(c, s, x, y, size, max_w, line_h=None, align="left", **kw):
    """多行文字，返回总高度。"""
    lines = [ln for para in s.split("\n") for ln in wrap(para, size, max_w, kw.get("weight", 400), kw.get("family", "sans"))]
    lh = line_h or size * 1.5
    for i, ln in enumerate(lines):
        text(c, ln, x, y + i * lh, size, align=align, **kw)
    return len(lines) * lh


# ------------------------------------------------------------------ 形状

def rrect(c, x, y, w, h, r, fill=None, stroke=None, alpha=1.0, width=2.0, fill_alpha=None):
    rect = skia.Rect.MakeXYWH(x, y, w, h)
    if fill:
        c.drawRoundRect(rect, r, r, paint(fill, alpha if fill_alpha is None else fill_alpha * alpha))
    if stroke:
        c.drawRoundRect(rect, r, r, paint(stroke, alpha, stroke=width))


def line(c, x1, y1, x2, y2, color=WHITE, alpha=1.0, width=2.0, blur=None):
    c.drawLine(x1, y1, x2, y2, paint(color, alpha, stroke=width, blur=blur))


def circle(c, x, y, r, color=WHITE, alpha=1.0, stroke=None, blur=None):
    c.drawCircle(x, y, r, paint(color, alpha, stroke=stroke, blur=blur))


def glow_dot(c, x, y, r, color, alpha=1.0, glow=3.0):
    c.drawCircle(x, y, r * glow, paint(color, alpha * 0.25, blur=r * glow * 0.6))
    c.drawCircle(x, y, r, paint(color, alpha))


def arrow(c, x1, y1, x2, y2, color=WHITE, alpha=1.0, width=3.0, head=14):
    line(c, x1, y1, x2, y2, color, alpha, width)
    ang = math.atan2(y2 - y1, x2 - x1)
    p = skia.Path()
    p.moveTo(x2, y2)
    p.lineTo(x2 - head * math.cos(ang - 0.45), y2 - head * math.sin(ang - 0.45))
    p.lineTo(x2 - head * math.cos(ang + 0.45), y2 - head * math.sin(ang + 0.45))
    p.close()
    c.drawPath(p, paint(color, alpha))


def partial_line(c, x1, y1, x2, y2, t, **kw):
    """从起点画到 t 比例处，用于“描线”动画。"""
    if t <= 0:
        return
    line(c, x1, y1, lerp(x1, x2, t), lerp(y1, y2, t), **kw)


def poly(c, pts, color=WHITE, alpha=1.0, stroke=None, closed=True):
    p = skia.Path()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    if closed:
        p.close()
    c.drawPath(p, paint(color, alpha, stroke=stroke))


def linear_gradient(x1, y1, x2, y2, colors, alphas=None, pos=None):
    alphas = alphas or [1.0] * len(colors)
    cs = [col(cc, a) for cc, a in zip(colors, alphas)]
    return skia.GradientShader.MakeLinear([skia.Point(x1, y1), skia.Point(x2, y2)], cs, pos)


def radial_gradient(x, y, r, colors, alphas=None, pos=None):
    alphas = alphas or [1.0] * len(colors)
    cs = [col(cc, a) for cc, a in zip(colors, alphas)]
    return skia.GradientShader.MakeRadial(skia.Point(x, y), r, cs, pos)


class layer:
    """with layer(c, alpha): ... —— 整组元素统一透明度（用于场景淡入淡出）。"""

    def __init__(self, c, alpha):
        self.c, self.alpha = c, alpha

    def __enter__(self):
        self.c.saveLayerAlpha(None, int(clamp(self.alpha) * 255))
        return self.c

    def __exit__(self, *a):
        self.c.restore()
