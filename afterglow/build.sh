#!/usr/bin/env bash
# Build 《余光 AFTERGLOW》 end to end: render every frame, synthesise the soundtrack, mux.
#   ./build.sh                 # full build → output/afterglow.mp4 (+ output/afterglow-master.mp4)
#   WORKERS=3 ./build.sh       # more render processes
#   RESUME=1 ./build.sh        # keep already-rendered 240-frame chunks in build/segments
set -euo pipefail
cd "$(dirname "$0")"
WORKERS=${WORKERS:-2}
[ -d node_modules/three ] || npm install --no-audit --no-fund
mkdir -p build output

echo "== soundtrack"
python3 audio/build.py

echo "== picture ($WORKERS workers)"
AG_NOLOCK=1 node render/render.mjs --workers "$WORKERS" --crf 12 --out build/video.mp4 ${RESUME:+--resume}

echo "== master (high quality)"
ffmpeg -y -loglevel error -i build/video.mp4 -i build/audio/mix.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 320k -ar 48000 -movflags +faststart \
  -metadata title="余光 AFTERGLOW" -metadata comment="Written, directed, rendered and scored in code by Claude Opus 5.5" \
  output/afterglow-master.mp4

echo "== distribution copy (< 95 MB, for the repository)"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 build/video.mp4)
VBR=$(python3 -c "print(int((92*8*1024*1024/$DUR - 192000)/1000))")
ffmpeg -y -loglevel error -i build/video.mp4 -c:v libx264 -preset slow -b:v ${VBR}k -pass 1 -an -f mp4 -passlogfile build/x264 /dev/null
ffmpeg -y -loglevel error -i build/video.mp4 -i build/audio/mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -b:v ${VBR}k -pass 2 -passlogfile build/x264 -tune film \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart \
  -metadata title="余光 AFTERGLOW" -metadata comment="Written, directed, rendered and scored in code by Claude Opus 5.5" \
  output/afterglow.mp4
ls -lh output/
