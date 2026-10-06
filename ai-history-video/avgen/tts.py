"""用 sherpa-onnx + Kokoro 多语种模型离线合成中文解说。

每一句解说单独合成并缓存为 wav（以读法文本、音色、语速的哈希命名），
这样修改脚本后只需重新合成改动过的句子，同时也能得到每句话的精确时长，
用于字幕和画面同步。
"""
import hashlib
import os

import numpy as np
import soundfile as sf

from .pronounce import to_speech

SAMPLE_RATE = 24000


def _model_dir(models_root):
    return os.path.join(models_root, "kokoro-multi-lang-v1_1")


def load_tts(models_root, threads=4):
    import sherpa_onnx

    d = _model_dir(models_root)
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=f"{d}/model.onnx",
                voices=f"{d}/voices.bin",
                tokens=f"{d}/tokens.txt",
                data_dir=f"{d}/espeak-ng-data",
                dict_dir=f"{d}/dict",
                lexicon=f"{d}/lexicon-us-en.txt,{d}/lexicon-zh.txt",
            ),
            num_threads=threads,
        ),
        rule_fsts=f"{d}/phone-zh.fst,{d}/date-zh.fst,{d}/number-zh.fst",
        max_num_sentences=1,
    )
    return sherpa_onnx.OfflineTts(cfg)


def cache_key(speech, voice, speed):
    return hashlib.sha1(f"{voice}|{speed}|{speech}".encode()).hexdigest()[:16]


def trim_silence(x, thresh=0.01, pad=0.04):
    """去掉首尾静音，保留 pad 秒的余量，让句间停顿由时间线统一控制。"""
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    p = int(pad * SAMPLE_RATE)
    return x[max(0, idx[0] - p): min(len(x), idx[-1] + p)]


def synthesize_all(texts, cache_dir, models_root, voice, speed, log=print):
    """返回与 texts 一一对应的 wav 路径列表；已缓存的句子直接复用。"""
    os.makedirs(cache_dir, exist_ok=True)
    tts = None
    paths = []
    for i, text in enumerate(texts):
        speech = to_speech(text)
        path = os.path.join(cache_dir, cache_key(speech, voice, speed) + ".wav")
        if not os.path.exists(path):
            if tts is None:
                tts = load_tts(models_root)
            audio = tts.generate(speech, sid=voice, speed=speed)
            x = trim_silence(np.asarray(audio.samples, dtype=np.float32))
            sf.write(path + ".tmp.wav", x, SAMPLE_RATE)
            os.replace(path + ".tmp.wav", path)
            log(f"  [{i + 1}/{len(texts)}] {len(x) / SAMPLE_RATE:5.1f}s  {text[:30]}")
        paths.append(path)
    return paths
