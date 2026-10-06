"""贯穿全片的背景：深空渐变、星云、视差星空、神经网络“星座”和寒冬雪花。"""
import math

import skia

from .gfx import H, W, BG, col, paint, radial_gradient, rand, mix

N_STARS = 420
N_NODES = 46
N_SNOW = 170


class Background:
    # 星空漂移速度与闪烁幅度（细小像素的逐帧变化对视频码率影响很大）
    drift = 0.5
    twinkle = 0.5
    nebula = 0.6

    def __init__(self):
        self.stars = []
        for i in range(N_STARS):
            z = 0.25 + 0.75 * rand(i * 3.1) ** 2
            self.stars.append((rand(i * 1.7), rand(i * 2.3), z, 0.5 + 1.4 * z * rand(i * 5.9), rand(i * 7.3) * 6.28))
        self.nodes = [(rand(i * 11.1 + 3), rand(i * 13.7 + 5), rand(i * 17.3)) for i in range(N_NODES)]
        self.edges = []
        for i in range(N_NODES):
            for j in range(i + 1, N_NODES):
                dx = (self.nodes[i][0] - self.nodes[j][0]) * W
                dy = (self.nodes[i][1] - self.nodes[j][1]) * H
                if dx * dx + dy * dy < 230 ** 2:
                    self.edges.append((i, j))
        self.snow = [(rand(i * 19.1), rand(i * 23.3), 0.4 + 0.6 * rand(i * 29.7), rand(i * 31.1) * 6.28) for i in range(N_SNOW)]
        # 静态底图：竖向渐变 + 暗角，预先画好一次
        s = skia.Surface(W, H)
        c = s.getCanvas()
        p = skia.Paint(Shader=skia.GradientShader.MakeLinear(
            [skia.Point(0, 0), skia.Point(0, H)], [col("#070b1d"), col(BG), col("#03040c")], [0, 0.6, 1]))
        c.drawRect(skia.Rect(0, 0, W, H), p)
        self.base = s.makeImageSnapshot()
        s2 = skia.Surface(W, H)
        c2 = s2.getCanvas()
        c2.clear(skia.ColorTRANSPARENT)
        vp = skia.Paint(Shader=skia.GradientShader.MakeRadial(
            skia.Point(W / 2, H / 2), W * 0.75, [col("#000000", 0), col("#000000", 0.0), col("#000000", 0.65)], [0, 0.55, 1]))
        c2.drawRect(skia.Rect(0, 0, W, H), vp)
        self.vignette = s2.makeImageSnapshot()

    def draw(self, c, t, accent, accent2, snow=0.0, network=1.0):
        c.drawImage(self.base, 0, 0)
        # 星云：三团缓慢漂移的彩色光晕
        tn = t * self.nebula
        for k, (cx, cy, r, a, colr) in enumerate([
            (0.78 + 0.05 * math.sin(tn * 0.05), 0.28 + 0.04 * math.cos(tn * 0.04), 760, 0.20, accent),
            (0.18 + 0.04 * math.cos(tn * 0.03), 0.78 + 0.03 * math.sin(tn * 0.05), 820, 0.15, accent2),
            (0.50 + 0.06 * math.sin(tn * 0.02 + 1), 0.55, 1000, 0.07, mix(accent, "#ffffff", 0.2)),
        ]):
            sh = radial_gradient(cx * W, cy * H, r, [colr, colr, colr], [a, a * 0.35, 0], [0, 0.45, 1])
            c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=sh))
        # 视差星空
        p = skia.Paint(AntiAlias=True)
        for (x, y, z, sz, ph) in self.stars:
            px = ((x - t * 0.004 * z * self.drift) % 1.0) * W
            py = ((y + t * 0.0012 * z * self.drift) % 1.0) * H
            tw = 1 - self.twinkle * (0.45 - 0.45 * math.sin(t * (0.6 + z) + ph))
            p.setColor(col("#dfe8ff", (0.25 + 0.65 * z) * tw))
            c.drawCircle(px, py, sz, p)
        # 神经网络星座：缓慢漂移的节点与连线，信号沿连线闪烁
        if network > 0.01:
            pts = []
            for (x, y, ph) in self.nodes:
                px = ((x - t * 0.0025 * self.drift) % 1.0) * W
                py = y * H + 14 * math.sin(t * 0.2 + ph * 6.28)
                pts.append((px, py))
            lp = paint(accent, 1, stroke=1.0)
            for (i, j) in self.edges:
                (x1, y1), (x2, y2) = pts[i], pts[j]
                if abs(x1 - x2) > W / 2:
                    continue
                pulse = 0.5 + 0.5 * math.sin(t * 0.8 + (i * 7 + j * 3) * 0.37)
                lp.setColor(col(accent, network * (0.035 + 0.06 * pulse ** 4)))
                c.drawLine(x1, y1, x2, y2, lp)
            for k, (px, py) in enumerate(pts):
                c.drawCircle(px, py, 2.2, paint(accent, network * 0.35))
        # 雪花（寒冬章节）
        if snow > 0.01:
            sp = skia.Paint(AntiAlias=True)
            for (x, y, z, ph) in self.snow:
                py = ((y + t * 0.05 * (0.5 + z)) % 1.0) * H
                px = (x * W + 30 * math.sin(t * 0.7 * z + ph)) % W
                sp.setColor(col("#e8f1ff", snow * (0.25 + 0.55 * z)))
                c.drawCircle(px, py, 1.2 + 2.6 * z, sp)
        c.drawImage(self.vignette, 0, 0)
