#!/usr/bin/env bash
# 下载离线语音模型到 models/（约 400 MB；ASR 校验模型可选，约 230 MB）
set -euo pipefail
DIR="${1:-$(dirname "$0")/../models}"
mkdir -p "$DIR"
cd "$DIR"
BASE=https://github.com/k2-fsa/sherpa-onnx/releases/download
fetch() {
  local url="$1" name="$2"
  if [ -d "$name" ]; then echo "已存在：$name"; return; fi
  echo "下载 $name …"
  curl -fL --retry 3 -o "$name.tar.bz2" "$url"
  tar xjf "$name.tar.bz2" && rm "$name.tar.bz2"
}
fetch "$BASE/tts-models/kokoro-multi-lang-v1_1.tar.bz2" kokoro-multi-lang-v1_1
if [ "${WITH_ASR:-0}" = "1" ]; then
  fetch "$BASE/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2" \
        sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17
fi
echo "完成：$DIR"
