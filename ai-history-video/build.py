"""构建《人工智能简史》长视频。

用法：
  python build.py --models MODELS_DIR              # 完整构建 → output/ai-history.mp4
  python build.py --models MODELS_DIR --stills     # 只渲染每个场景的静帧，用于检查画面
  python build.py --models MODELS_DIR --preview 60 # 只渲染前 60 秒

MODELS_DIR 下需要有 kokoro-multi-lang-v1_1（见 README）。
"""
import argparse
import json
import multiprocessing as mp
import os
import subprocess
import sys
import time

import numpy as np
import soundfile as sf

from avgen import music, timeline, tts
from avgen.script import SCENES

ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "output")


def log(*a):
    print(time.strftime("[%H:%M:%S]"), *a, flush=True)


def fmt_srt(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(subs, path):
    with open(path, "w", encoding="utf-8") as f:
        for i, (st, en, s) in enumerate(subs, 1):
            f.write(f"{i}\n{fmt_srt(st)} --> {fmt_srt(en)}\n{s}\n\n")


def write_chapters(scenes, path):
    with open(path, "w", encoding="utf-8") as f:
        f.write(";FFMETADATA1\n")
        marks = [(s["start"], f"{s['num']} {s['title']}") for s in scenes if s["kind"] == "chapter"]
        marks.insert(0, (0.0, "序章"))
        ends = [m[0] for m in marks[1:]] + [scenes[-1]["start"] + scenes[-1]["dur"]]
        for (st, title), en in zip(marks, ends):
            f.write(f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={int(st * 1000)}\nEND={int(en * 1000)}\ntitle={title}\n")


def mix_audio(clips, scenes, total, path):
    sr = music.SR
    n = int(total * sr)
    voice = np.zeros(n, dtype=np.float32)
    for st, p in clips:
        x, r = sf.read(p, dtype="float32")
        if r != sr:
            from scipy.signal import resample_poly
            x = resample_poly(x, sr, r).astype(np.float32)
        i = int(st * sr)
        voice[i:i + len(x)] += x[: max(0, n - i)]
    voice *= 0.89 / (np.max(np.abs(voice)) + 1e-9)
    log("  合成背景音乐 …")
    sections = [(s["start"], s["start"] + s["dur"], s["ch"], s["ch"] == 5 or s.get("visual") == "winter") for s in scenes]
    bgm = music.compose(total, sections)
    # 人声出现时自动压低音乐（ducking）
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    env = uniform_filter1d(np.abs(voice), int(0.05 * sr))
    env = np.clip(env / (np.percentile(env[env > 1e-4], 90) + 1e-9) * 2.5, 0, 1)
    env = maximum_filter1d(env, int(0.8 * sr))          # 句中短停顿不回弹，句前提前压低
    env = uniform_filter1d(env, int(0.3 * sr))          # 平滑过渡
    gain = 0.30 - 0.18 * env
    out = bgm * gain[None, :] + voice[None, :]
    out = np.tanh(out * 1.05) / np.tanh(1.05)
    sf.write(path, out.T, sr, subtype="PCM_16")


def _render_worker(args):
    f0, f1, fps, seg_path, crf, preset = args
    from avgen.render import render_segment
    renderer = _make_renderer()
    render_segment(renderer, f0, f1, fps, seg_path, crf=crf, preset=preset, log=log)
    return seg_path


_STATE = {}


def _make_renderer():
    from avgen.scenes import Renderer
    st = _STATE
    return Renderer(st["scenes"], st["subs"], st["total"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True, help="模型目录（包含 kokoro-multi-lang-v1_1）")
    ap.add_argument("--voice", type=int, default=60, help="Kokoro 音色编号（默认 60，男声）")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--jobs", type=int, default=max(1, os.cpu_count() or 1))
    ap.add_argument("--crf", type=int, default=21)
    ap.add_argument("--preset", default="medium")
    ap.add_argument("--stills", action="store_true", help="只输出每个场景的静帧")
    ap.add_argument("--at", type=float, nargs="*", help="只输出指定时间点的静帧")
    ap.add_argument("--preview", type=float, default=0, help="只渲染前 N 秒")
    ap.add_argument("--out", default=os.path.join(OUT, "ai-history.mp4"))
    a = ap.parse_args()
    os.makedirs(BUILD, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    lines = [ln for s in SCENES for ln in s["lines"]]
    log(f"1/5 语音合成：{len(lines)} 句")
    wavs = tts.synthesize_all(lines, os.path.join(BUILD, "tts"), a.models, a.voice, a.speed, log=log)

    log("2/5 排时间线")
    scenes, clips, subs, total = timeline.build(SCENES, wavs)
    log(f"    总时长 {total / 60:.1f} 分钟，{len(scenes)} 个场景，{len(subs)} 条字幕")
    srt = os.path.splitext(a.out)[0] + ".srt"
    write_srt(subs, srt)
    with open(os.path.join(BUILD, "timeline.json"), "w", encoding="utf-8") as f:
        json.dump([{k: v for k, v in s.items() if k in ("kind", "ch", "year", "title", "start", "dur")} for s in scenes],
                  f, ensure_ascii=False, indent=1)
    _STATE.update(scenes=scenes, subs=subs, total=total)

    if a.stills or a.at:
        from avgen.render import still
        d = os.path.join(BUILD, "stills")
        os.makedirs(d, exist_ok=True)
        r = _make_renderer()
        if a.at:
            ts = a.at
        else:
            ts = []
            for s in scenes:
                cues = s["cues"]
                pts = [s["start"] + s["dur"] * 0.5] if len(cues) < 2 else [s["start"] + c + 1.5 for c in cues]
                ts += pts
        import traceback
        for i, t in enumerate(ts):
            try:
                still(r, t, os.path.join(d, f"{i:03d}_{t:07.1f}.png"))
            except Exception:
                log(f"    静帧 t={t:.1f} 出错：")
                traceback.print_exc(limit=-2)
        log(f"    静帧已输出到 {d}（{len(ts)} 张）")
        return

    if a.preview:
        total = min(total, a.preview)
    audio = os.path.join(BUILD, "audio.wav")
    log("3/5 混音（解说 + 背景音乐）")
    mix_audio(clips, scenes, _STATE["total"], audio)

    log(f"4/5 渲染画面：{int(total * a.fps)} 帧，{a.jobs} 个进程")
    nf = int(total * a.fps)
    jobs = max(1, a.jobs)
    bounds = [round(nf * k / jobs) for k in range(jobs + 1)]
    segs = [(bounds[k], bounds[k + 1], a.fps, os.path.join(BUILD, f"seg{k:02d}.mp4"), a.crf, a.preset) for k in range(jobs)]
    t0 = time.time()
    with mp.get_context("fork").Pool(jobs) as pool:
        pool.map(_render_worker, segs)
    log(f"    渲染耗时 {(time.time() - t0) / 60:.1f} 分钟")

    log("5/5 合成成片")
    lst = os.path.join(BUILD, "segments.txt")
    with open(lst, "w") as f:
        for s in segs:
            f.write(f"file '{s[3]}'\n")
    meta = os.path.join(BUILD, "chapters.txt")
    write_chapters(scenes, meta)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-i", audio,
           "-i", meta, "-map", "0:v", "-map", "1:a", "-map_metadata", "2", "-map_chapters", "2",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-t", f"{total:.3f}",
           "-metadata", "title=人工智能简史", "-metadata", "language=zho",
           "-movflags", "+faststart", a.out]
    subprocess.run(cmd, check=True)
    log(f"完成：{a.out}（{os.path.getsize(a.out) / 1e6:.0f} MB），字幕：{srt}")


if __name__ == "__main__":
    sys.exit(main())
