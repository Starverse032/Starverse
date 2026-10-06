"""把时间线上的场景画成一帧帧画面：背景、版式、插图、时间轴和字幕。"""
import bisect
import math

import skia

from .background import Background
from .gfx import (MUTED, TEXT, WHITE, H, W, appear, circle, clamp, ease_in_out, ease_out, glow_dot, layer, lerp,
                  line, mix, paint, prog, rrect, text, text_width, wrap)
from .script import CHAPTERS
from .visuals import REGISTRY, Ctx
from .visuals.vb import hype_chart

ACCENTS = {0: "#8ab4f8", 1: "#e8b04b", 2: "#4fc3f7", 3: "#ffd54f", 4: "#81c784", 5: "#a7c4dc", 6: "#ff8a65",
           7: "#ce93d8", 8: "#4db6ac", 9: "#64b5f6", 10: "#f06292", 11: "#b388ff", 12: "#4dd0e1", 13: "#8ab4f8"}
SECOND = {0: "#3949ab", 1: "#6d4c41", 2: "#1565c0", 3: "#8d6e63", 4: "#2e7d32", 5: "#37474f", 6: "#bf360c",
          7: "#4a148c", 8: "#00695c", 9: "#0d47a1", 10: "#880e4f", 11: "#311b92", 12: "#006064", 13: "#3949ab"}

PANEL = (950, 150, 870, 660)
TL_Y = 884
TL_X0, TL_X1 = 110, 1810
SUB_Y = 1012


def tl_x(year):
    if year < 1940:
        return lerp(TL_X0, TL_X0 + 200, clamp((year - 1700) / 240))
    return lerp(TL_X0 + 200, TL_X1, clamp((year - 1940) / (2026 - 1940)))


def _snow_target(sc):
    if sc["ch"] == 5 or sc.get("visual") == "winter":
        return 1.0
    if sc["kind"] == "quote" and sc.get("chill") is not None:
        return 0.0
    return 0.0


class Renderer:
    def __init__(self, scenes, subs, total):
        self.scenes = scenes
        self.starts = [s["start"] for s in scenes]
        self.subs = subs
        self.sub_starts = [s[0] for s in subs]
        self.total = total
        self.bg = Background()
        self.milestones = [(s["tl"], s["start"]) for s in scenes if s.get("tl")]
        prev = None
        for s in scenes:
            s["_prev_year"] = prev
            if s["kind"] == "event" and s["year"].isdigit():
                prev = int(s["year"])
            if s.get("tl"):
                pass

    # ------------------------------------------------------------ 帧
    def frame(self, c, t):
        i = max(0, bisect.bisect_right(self.starts, t) - 1)
        sc = self.scenes[i]
        lt = t - sc["start"]
        prev = self.scenes[i - 1] if i > 0 else sc
        blend = ease_in_out(prog(lt, 0, 1.6))
        acc = mix(ACCENTS[prev["ch"]], ACCENTS[sc["ch"]], blend)
        acc2 = mix(SECOND[prev["ch"]], SECOND[sc["ch"]], blend)
        snow = lerp(self._snow(prev, prev["dur"]), self._snow(sc, lt), ease_in_out(prog(lt, 0, 2.0)))
        self.bg.draw(c, t, acc, acc2, snow=snow, network=0.55 if sc["kind"] == "event" else 1.0)

        fade = appear(lt, 0.0, 0.7) * (1 - ease_in_out(prog(lt, sc["dur"] - 0.55, 0.55)))
        with layer(c, fade):
            getattr(self, "draw_" + sc["kind"])(c, sc, lt, acc)
        self.draw_timeline(c, i, sc, lt, acc)
        self.draw_subtitle(c, t)
        # 片头淡入、片尾淡出
        k = min(appear(t, 0, 1.2), 1 - ease_in_out(prog(t, self.total - 2.5, 2.5)))
        if k < 1:
            c.drawRect(skia.Rect(0, 0, W, H), paint("#000000", 1 - k))

    def _snow(self, sc, lt):
        base = _snow_target(sc)
        if sc["kind"] == "quote" and sc.get("chill") is not None:
            base = appear(lt, sc["cues"][sc["chill"]], 2.0) * 0.8
        return base

    # ------------------------------------------------------------ 片头
    def draw_title(self, c, sc, t, acc):
        cues = sc["cues"]
        cue = lambda k: cues[k] if k < len(cues) else sc["dur"]
        pa = appear(t, 0.3, 1.0) * (1 - ease_in_out(prog(t, cue(2) - 0.5, 0.5)))
        if pa > 0.01:
            from .visuals import typed
            q = "一台机器，能思考吗？"
            shown = typed(q, t, cue(0), len(q) / max(0.5, sc["line_durs"][0] * 0.9))
            text(c, shown, W / 2, H / 2 - 30, 92, TEXT, pa, family="serif", weight=700, align="center", glow=20, glow_color=acc)
            text(c, "人类已经追问了几千年", W / 2, H / 2 + 60, 36, MUTED, pa * appear(t, cue(1), 0.8), align="center")
        pb = appear(t, cue(2) - 0.2, 0.8) * (1 - ease_in_out(prog(t, cue(4) - 0.6, 0.6)))
        if pb > 0.01:
            upto = lerp(1950, 2025, ease_in_out(prog(t, cue(2), cue(4) - cue(2) - 0.8)))
            hype_chart(c, 210, 260, 1500, 470, upto, acc, pb)
            items = [(1950, "图灵测试"), (1956, "达特茅斯会议"), (1966, "ELIZA"), (1980, "专家系统"), (1986, "反向传播"),
                     (1997, "深蓝"), (2012, "AlexNet"), (2016, "AlphaGo"), (2017, "Transformer"), (2022, "ChatGPT")]
            from .visuals.vb import _hype_at
            for k, (yr, nm) in enumerate(items):
                if yr <= upto:
                    X = 210 + (yr - 1950) / 75 * 1500
                    Y = 260 + 470 - _hype_at(yr) * 470
                    ak = pb * appear(t, cue(2) + (yr - 1950) / 75 * (cue(4) - cue(2) - 0.8), 0.5)
                    glow_dot(c, X, Y, 6, WHITE, ak)
                    text(c, nm, X, Y - 22 - (k % 2) * 30, 22, TEXT, ak, align="center")
        pc = appear(t, cue(4) - 0.2, 1.2)
        if pc > 0.01:
            s = 0.94 + 0.06 * ease_out(prog(t, cue(4), 2.5))
            c.save()
            c.translate(W / 2, H / 2)
            c.scale(s, s)
            text(c, "人工智能简史", 0, -10, 150, TEXT, pc, weight=900, align="center", glow=26, glow_color=acc)
            text(c, "A BRIEF HISTORY OF ARTIFICIAL INTELLIGENCE", 0, 75, 30, acc, pc, align="center", spacing=6)
            w = 520 * ease_out(prog(t, cue(4) + 0.4, 1.4))
            line(c, -w, 120, w, 120, acc, pc * 0.7, 2)
            text(c, "从古老的梦想，到智能时代", 0, 180, 34, MUTED, pc * appear(t, cue(4) + 1.0, 1.0), align="center")
            c.restore()

    # ------------------------------------------------------------ 章节卡
    def draw_chapter(self, c, sc, t, acc):
        a = appear(t, 0.1, 0.9)
        s = 0.96 + 0.04 * ease_out(prog(t, 0, 3.0))
        c.save()
        c.translate(W / 2, H / 2)
        c.scale(s, s)
        num = sc["num"]
        nw = text_width(num, 40, 700, spacing=14)
        text(c, num, -nw / 2, -150, 40, acc, a, weight=700, spacing=14)
        lw = 260 * ease_out(prog(t, 0.3, 1.2))
        line(c, -nw / 2 - 30 - lw, -163, -nw / 2 - 30, -163, acc, a * 0.7, 2)
        line(c, nw / 2 + 30, -163, nw / 2 + 30 + lw, -163, acc, a * 0.7, 2)
        text(c, sc["title"], 0, 10, 124, TEXT, a, weight=900, align="center", glow=22, glow_color=acc)
        text(c, sc["en"].upper(), 0, 90, 30, MUTED, appear(t, 0.5, 0.9), align="center", spacing=5)
        text(c, sc["years"], 0, 160, 36, acc, appear(t, 0.8, 0.9), align="center", weight=700)
        c.restore()

    # ------------------------------------------------------------ 事件
    def draw_event(self, c, sc, t, acc):
        num, title = CHAPTERS[sc["ch"]][0], CHAPTERS[sc["ch"]][1]
        text(c, f"{num} · {title}", 110, 112, 26, acc, appear(t, 0.1), weight=700, spacing=2)
        text(c, "人工智能简史", W - 110, 112, 22, MUTED, 0.6 * appear(t, 0.1), align="right", spacing=3)
        # 年份：数字年份从上一个事件“滚动”过来
        yr = sc["year"]
        ya = appear(t, 0.0, 0.6)
        if yr.isdigit() and sc.get("_prev_year"):
            y0, y1 = sc["_prev_year"], int(yr)
            shown = str(int(round(lerp(y0, y1, ease_out(prog(t, 0.1, 1.1))))))
        else:
            shown = yr
        text(c, shown, 104, 330, 150, acc, ya, weight=900, glow=24)
        tt = appear(t, 0.35, 0.7)
        dx = 30 * (1 - tt)
        text(c, sc["title"], 110 + dx, 432, 62, TEXT, tt, weight=700)
        text(c, sc["en"], 112 + dx, 484, 26, MUTED, appear(t, 0.55, 0.7), spacing=1)
        line(c, 112, 522, 112 + 140 * ease_out(prog(t, 0.6, 0.9)), 522, acc, 0.9, 3)
        # 要点
        n = len(sc["bullets"])
        at = sc.get("bullet_at")
        cues = sc["cues"]
        y = 592
        for k, b in enumerate(sc["bullets"]):
            li = at[k] if at else min(len(cues) - 1, round(k * len(cues) / max(n, 1)))
            st = cues[min(li, len(cues) - 1)] + (0.25 if li == 0 else 0.0) + k * 0.12 * (li == 0)
            ba = appear(t, st, 0.6)
            size = 32 if text_width(b, 32) <= 740 else 27
            bx = 112 + 24 * (1 - ba)
            glow_dot(c, bx + 8, y - size * 0.36, 6, acc, ba, glow=2.2)
            lines = wrap(b, size, 730)
            for j, ln in enumerate(lines):
                text(c, ln, bx + 32, y + j * size * 1.35, size, TEXT, ba)
            y += size * 1.35 * len(lines) + 24
        # 插图面板
        px, py, pw, ph = PANEL
        rrect(c, px - 16, py - 16, pw + 32, ph + 32, 26, fill="#0b1226", alpha=0.55 * appear(t, 0.2, 0.8))
        rrect(c, px - 16, py - 16, pw + 32, ph + 32, 26, stroke=acc, alpha=0.18 * appear(t, 0.2, 0.8), width=1.5)
        c.save()
        c.translate(px, py)
        c.clipRect(skia.Rect(-14, -14, pw + 14, ph + 14))
        REGISTRY[sc["visual"]](c, Ctx(t, sc["dur"], cues, sc["line_durs"], acc, pw, ph))
        c.restore()

    # ------------------------------------------------------------ 引文
    @staticmethod
    def _balanced_lines(q, size, max_w):
        """引文分行：优先在标点处断开，并让各行长度尽量均衡。"""
        import re
        tw = lambda s: text_width(s, size, 700, "serif")
        segs = re.findall(r"[^，。；：！？]+[，。；：！？]?", q)
        if tw(q) <= max_w:
            return [q]
        if any(tw(sg) > max_w for sg in segs):
            return wrap(q, size, max_w, 700, "serif")
        n = math.ceil(tw(q) / max_w)
        target = tw(q) / n
        lines, cur = [], ""
        for sg in segs:
            if cur and (tw(cur + sg) > max_w or tw(cur) >= target * 0.8):
                lines.append(cur)
                cur = sg
            else:
                cur += sg
        if cur:
            lines.append(cur)
        return lines

    def _quote_block(self, c, q, cx, cy, size, reveal, alpha, color=TEXT, max_w=1300):
        lines = self._balanced_lines(q, size, max_w)
        lh = size * 1.55
        y0 = cy - (len(lines) - 1) * lh / 2
        total = sum(len(l) for l in lines)
        shown = reveal * total
        k = 0
        for i, ln in enumerate(lines):
            wl = text_width(ln, size, 700, "serif")
            x = cx - wl / 2
            for ch in ln:
                ca = clamp(shown - k) * alpha
                if ca > 0.01:
                    text(c, ch, x, y0 + i * lh, size, color, ca, family="serif", weight=700)
                x += text_width(ch, size, 700, "serif")
                k += 1
        return y0 + (len(lines) - 1) * lh

    def _quote_line(self, sc):
        for i, ln in enumerate(sc["lines"]):
            if sc["text"][:8] in ln:
                return i
        return 0

    def draw_quote(self, c, sc, t, acc):
        qi = self._quote_line(sc)
        cues, durs = sc["cues"], sc["line_durs"]
        st = cues[qi]
        if sc["text"] not in sc["lines"][qi]:
            st = cues[qi]
        reveal = prog(t, st, durs[qi] * 0.95)
        chill = sc.get("chill")
        cool = appear(t, cues[chill], 2.0) if chill is not None else 0
        colr = mix(TEXT, "#9fb3cf", cool)
        has_extra = bool(sc.get("extra"))
        cy = H / 2 - (90 if has_extra else 40)
        a0 = appear(t, 0.2, 0.8)
        text(c, "“", W / 2 - 700, cy - 90, 240, acc, a0 * 0.35, family="serif", weight=900)
        yb = self._quote_block(c, sc["text"], W / 2, cy, 58 if len(sc["text"]) > 30 else 70, reveal, 1.0 - 0.35 * cool, colr)
        aa = appear(t, st + durs[qi] * 0.9, 0.8)
        text(c, "—— " + sc["author"], W / 2 + 600, yb + 90, 32, acc, aa * (1 - 0.35 * cool), align="right")
        for (li, q2, au2) in sc.get("extra", []):
            ea = appear(t, cues[li], 0.8)
            r2 = prog(t, cues[li], durs[li] * 0.9)
            yb2 = self._quote_block(c, q2, W / 2, yb + 230, 40, r2, ea * (1 - 0.35 * cool), MUTED, 1300)
            text(c, "—— " + au2, W / 2 + 600, yb2 + 70, 26, acc, appear(t, cues[li] + durs[li] * 0.8, 0.8) * (1 - 0.35 * cool), align="right")

    # ------------------------------------------------------------ 回望
    def draw_reflection(self, c, sc, t, acc):
        cues = sc["cues"]
        cue = lambda k: cues[k] if k < len(cues) else sc["dur"]
        ev = []
        seen = set()
        for s in self.scenes:
            if s["kind"] == "event" and s.get("tl") and (s["tl"], s["title"]) not in seen:
                seen.add((s["tl"], s["title"]))
                ev.append(s)
        ev.sort(key=lambda s: s["tl"])
        step = 250
        xs = [300 + k * step for k in range(len(ev))]
        yrs = [s["tl"] + k * 1e-3 for k, s in enumerate(ev)]
        import numpy as np
        X = lambda yr: float(np.interp(yr, yrs, xs))
        span_w = xs[-1] + 300
        pan = ease_in_out(prog(t, 0.5, cue(3) - 0.5))
        cam = lerp(0, span_w - W, pan)
        dim = 1 - 0.75 * appear(t, cue(3) - 0.3, 1.0)
        y = 560
        c.save()
        c.translate(-cam, 0)
        for (s_, e_, lab) in [(1974, 1980, "第一次寒冬"), (1987, 1993, "第二次寒冬")]:
            c.drawRect(skia.Rect(X(s_), 250, X(e_), 870), paint("#8fb8ff", 0.08 * dim))
            text(c, lab, (X(s_) + X(e_)) / 2, 290, 26, "#b9d4ff", dim, align="center")
        line(c, xs[0] - 200, y, xs[-1] + 200, y, acc, dim * 0.8, 3)
        for k, s in enumerate(ev):
            xx = xs[k]
            up = k % 2 == 0
            yy = y - 110 if up else y + 150
            a = dim * clamp(1.4 - abs(xx - cam - W / 2) / (W * 0.62))
            if a > 0.01:
                line(c, xx, y, xx, yy + (14 if up else -50), acc, a * 0.4, 1.5)
                glow_dot(c, xx, y, 7, acc, a)
                text(c, f"{s['tl']}", xx, yy - 34 if up else yy - 14, 24, acc, a, align="center", weight=700)
                text(c, s["title"], xx, yy if up else yy + 22, 30, TEXT, a, align="center")
        c.restore()
        qs = ["加速科学发现的伙伴？", "难以预料的风险？", "通用人工智能还有多远？"]
        for k, s in enumerate(qs):
            qa = appear(t, cue(3) + k * 1.6, 0.8) * (1 - ease_in_out(prog(t, cue(4) - 0.4, 0.6)))
            text(c, s, W / 2, H / 2 - 150 + k * 110, 52, TEXT, qa, weight=700, align="center", glow=12, glow_color=acc)
        fa = appear(t, cue(4), 1.2)
        text(c, "答案，仍在书写之中", W / 2, H / 2, 88, TEXT, fa, family="serif", weight=700, align="center", glow=22, glow_color=acc)

    # ------------------------------------------------------------ 结尾
    def draw_outro(self, c, sc, t, acc):
        cues = sc["cues"]
        cue = lambda k: cues[k] if k < len(cues) else sc["dur"]
        qa = appear(t, 0.2, 0.8) * (1 - ease_in_out(prog(t, cue(3) - 0.6, 0.8)))
        if qa > 0.01:
            text(c, "艾伦·图灵 · 1950", W / 2, 300, 34, acc, qa, align="center", spacing=4)
            reveal = prog(t, cue(1), sc["line_durs"][1] * 0.95)
            yb = self._quote_block(c, sc["text"], W / 2, H / 2 - 10, 62, reveal, qa)
            text(c, "人工智能的故事，还远未结束。", W / 2, yb + 140, 38, MUTED, qa * appear(t, cue(2), 1.0), align="center")
        ea = appear(t, cue(3) - 0.2, 1.2)
        if ea > 0.01:
            text(c, "人工智能简史", W / 2, H / 2 - 60, 120, TEXT, ea, weight=900, align="center", glow=24, glow_color=acc)
            text(c, "感谢观看", W / 2, H / 2 + 30, 44, acc, ea, align="center", spacing=10)
            ca = appear(t, cue(3) + 1.5, 1.2)
            credits = ["解说：Kokoro 语音合成", "画面：Skia 程序化生成", "音乐：程序化合成"]
            for k, s in enumerate(credits):
                text(c, s, W / 2, H / 2 + 150 + k * 46, 26, MUTED, ca, align="center")

    # ------------------------------------------------------------ 时间轴
    def draw_timeline(self, c, i, sc, lt, acc):
        def on(s):
            return s["kind"] in ("event", "quote")
        prev = self.scenes[i - 1] if i > 0 else None
        nxt = self.scenes[i + 1] if i + 1 < len(self.scenes) else None
        a = 1.0 if on(sc) else 0.0
        if on(sc) and (prev is None or not on(prev)):
            a *= appear(lt, 0.2, 0.8)
        if on(sc) and (nxt is None or not on(nxt)):
            a *= 1 - ease_in_out(prog(lt, sc["dur"] - 0.6, 0.6))
        if a <= 0.01:
            return
        y = TL_Y
        for (s, e) in [(1974, 1980), (1987, 1993)]:
            c.drawRect(skia.Rect(tl_x(s), y - 9, tl_x(e), y + 9), paint("#8fb8ff", a * 0.18))
        line(c, TL_X0, y, TL_X1, y, MUTED, a * 0.35, 2)
        for yr in [1700, 1850] + list(range(1950, 2030, 10)):
            xx = tl_x(yr)
            line(c, xx, y - 6, xx, y + 6, MUTED, a * 0.5, 1.5)
            text(c, str(yr), xx, y + 30, 16, MUTED, a * 0.7, align="center")
        cur_tl = sc.get("tl")
        prev_tl = None
        for s in self.scenes[:i][::-1]:
            if s.get("tl"):
                prev_tl = s["tl"]
                break
        for (yr, st) in self.milestones:
            past = st <= sc["start"]
            circle(c, tl_x(yr), y, 4, acc if past else MUTED, a * (0.85 if past else 0.3))
        if cur_tl:
            mv = ease_in_out(prog(lt, 0.2, 1.2))
            xx = tl_x(lerp(prev_tl or cur_tl, cur_tl, mv))
            line(c, TL_X0, y, xx, y, acc, a * 0.8, 3)
            glow_dot(c, xx, y, 8, WHITE, a, glow=3)
        elif sc["kind"] == "event" and sc["year"] == "今天":
            line(c, TL_X0, y, TL_X1, y, acc, a * 0.8, 3)
            glow_dot(c, TL_X1, y, 8, WHITE, a, glow=3)
        elif sc["kind"] == "event":
            glow_dot(c, TL_X0, y, 8, WHITE, a, glow=3)

    # ------------------------------------------------------------ 字幕
    def draw_subtitle(self, c, t):
        k = bisect.bisect_right(self.sub_starts, t) - 1
        if k < 0:
            return
        st, en, s = self.subs[k]
        if t > en + 0.12:
            return
        a = appear(t, st - 0.05, 0.15) * (1 - prog(t, en, 0.12))
        size = 40
        w = text_width(s, size, 500) + 56
        rrect(c, W / 2 - w / 2, SUB_Y - 52, w, 70, 14, fill="#000000", alpha=a * 0.42)
        text(c, s, W / 2, SUB_Y - 3, size, "#ffffff", a, weight=500, align="center")
