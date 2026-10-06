"""根据每句语音的实际时长，排出整部视频的时间线：场景起止、句子起点、字幕。"""
import re

import soundfile as sf

# 每类场景：(开头留白, 句间停顿, 结尾留白, 最短时长)
PACING = {
    "title": (1.6, 0.7, 1.4, 0),
    "chapter": (1.1, 0.5, 1.6, 5.0),
    "event": (0.9, 0.5, 1.1, 0),
    "quote": (1.0, 0.7, 2.0, 0),
    "reflection": (1.0, 0.7, 1.4, 0),
    "outro": (1.2, 0.9, 7.0, 0),
}

SUB_MAX_W = 1150  # 每条字幕最大宽度（像素，40 号字）


def _weight(s):
    """估算朗读时长的权重：汉字 1，英文字母 0.4，数字 0.6，标点按停顿算。"""
    w = 0.0
    for ch in s:
        if "一" <= ch <= "鿿":
            w += 1
        elif ch.isascii() and ch.isalpha():
            w += 0.4
        elif ch.isdigit():
            w += 0.6
        elif ch in "，、：；":
            w += 0.6
        elif ch in "。！？":
            w += 0.4
    return max(w, 0.5)


def _sub_width(s):
    from .gfx import text_width
    return text_width(s, 40, 500)


def split_subtitle(line):
    """把一句长解说按标点切成若干条字幕（按实际渲染宽度计算，不拆开英文单词）。"""
    parts = re.findall(r"[^，。！？；：、]+[，。！？；：、]?", line)
    chunks, cur = [], ""
    for p in parts:
        if cur and _sub_width(cur + p) > SUB_MAX_W:
            chunks.append(cur)
            cur = p
        else:
            cur += p
    if cur:
        chunks.append(cur)
    out = []
    for ch in chunks:
        while _sub_width(ch) > SUB_MAX_W * 1.15:
            cut = len(ch) // 2
            while 0 < cut < len(ch) and ch[cut - 1].isascii() and ch[cut - 1].isalnum() and ch[cut].isascii() and ch[cut].isalnum():
                cut += 1
            out.append(ch[:cut])
            ch = ch[cut:]
        out.append(ch)
    return [c.rstrip("，、；") for c in out]


def build(scenes, wav_paths):
    """scenes: 脚本场景列表；wav_paths: 与所有句子一一对应的 wav 路径。

    返回 (timed_scenes, audio_clips, subtitles, total_duration)
    """
    timed, clips, subs = [], [], []
    t = 0.0
    k = 0
    for sc in scenes:
        pre, gap, tail, min_dur = PACING[sc["kind"]]
        cues, durs = [], []
        cur = pre
        for i, ln in enumerate(sc["lines"]):
            info = sf.info(wav_paths[k])
            d = info.frames / info.samplerate
            cues.append(cur)
            durs.append(d)
            clips.append((t + cur, wav_paths[k]))
            # 字幕：按权重分配时长
            pieces = split_subtitle(ln)
            ws = [_weight(p) for p in pieces]
            st = t + cur
            for p, w in zip(pieces, ws):
                pd = d * w / sum(ws)
                subs.append((st, st + pd, p.rstrip("。")))
                st += pd
            k += 1
            cur += d + (0.3 if ln.endswith("：") else gap)
        dur = max(cur - gap + tail, min_dur)
        timed.append(dict(sc, start=t, dur=dur, cues=cues, line_durs=durs))
        t += dur
    return timed, clips, subs, t
