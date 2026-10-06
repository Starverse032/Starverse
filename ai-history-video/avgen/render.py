"""逐帧渲染并直接通过管道交给 ffmpeg 编码。支持多进程分段并行。"""
import os
import subprocess

import skia

from .gfx import H, W


def render_segment(renderer, f0, f1, fps, out_path, crf=20, preset="medium", log=None):
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
           "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p",
           "-tune", "animation", "-threads", "2", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    surface = skia.Surface(W, H)
    for f in range(f0, f1):
        c = surface.getCanvas()
        c.clear(skia.ColorBLACK)
        renderer.frame(c, f / fps)
        arr = surface.makeImageSnapshot().toarray(colorType=skia.kBGRA_8888_ColorType)
        proc.stdin.write(arr.tobytes())
        if log and (f - f0) % (fps * 30) == 0:
            log(f"    段 {os.path.basename(out_path)}: {f - f0}/{f1 - f0} 帧")
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg 编码失败：{out_path}")


def still(renderer, t, path):
    surface = skia.Surface(W, H)
    c = surface.getCanvas()
    c.clear(skia.ColorBLACK)
    renderer.frame(c, t)
    surface.makeImageSnapshot().save(path, skia.kPNG)
