"""用 SenseVoice 语音识别回听合成的解说，找出可能读错的句子。

用法：python tools/asr_check.py --models MODELS_DIR [--voice 60] [--sample N] [--show 20]
比较方式：只比较汉字部分的字符错误率（CER），英文和数字单独打印出来人工检查。
"""
import argparse, os, re, sys
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from avgen.script import SCENES
from avgen.tts import synthesize_all

def han(s):
    return "".join(re.findall(r"[一-鿿]", s))

def cer(ref, hyp):
    r, h = han(ref), han(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return d[len(h)] / max(1, len(r))

ap = argparse.ArgumentParser()
ap.add_argument("--models", required=True)
ap.add_argument("--cache", default="build/tts")
ap.add_argument("--voice", type=int, default=60)
ap.add_argument("--speed", type=float, default=1.0)
ap.add_argument("--sample", type=int, default=0, help="只检查每隔 N 句的一句（0=全部）")
ap.add_argument("--show", type=int, default=25)
a = ap.parse_args()

lines = [l for s in SCENES for l in s["lines"]]
if a.sample:
    lines = lines[::a.sample]
paths = synthesize_all(lines, a.cache, a.models, a.voice, a.speed, log=lambda *x: None)
import sherpa_onnx
d = os.path.join(a.models, "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17")
rec = sherpa_onnx.OfflineRecognizer.from_sense_voice(model=f"{d}/model.int8.onnx", tokens=f"{d}/tokens.txt",
                                                     num_threads=4, use_itn=True, language="zh")
rows = []
for text, p in zip(lines, paths):
    x, sr = sf.read(p, dtype="float32")
    s = rec.create_stream(); s.accept_waveform(sr, x); rec.decode_stream(s)
    rows.append((cer(text, s.result.text), text, s.result.text, len(x) / sr))
tot = sum(r[3] for r in rows)
print(f"voice={a.voice} lines={len(rows)} audio={tot/60:.1f}min meanCER={np.mean([r[0] for r in rows]):.3f}")
for c, t, h, _ in sorted(rows, key=lambda r: -r[0])[:a.show]:
    print(f"{c:.2f} | {t}\n     | {h}")
print("---- 含英文/数字的句子 ----")
for c, t, h, _ in rows:
    if re.search(r"[A-Za-z0-9]", t) and a.show:
        print(f"  {t}\n  > {h}")
