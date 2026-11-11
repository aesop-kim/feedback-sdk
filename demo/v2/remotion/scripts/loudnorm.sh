#!/usr/bin/env bash
# 렌더 뒤 오디오만 -16 LUFS(스토리보드 0장 오디오 목표)로 맞춘다. 영상 스트림은 그대로 복사한다.
set -euo pipefail
cd "$(dirname "$0")/.."
IN=${1:-out/lattice-demo-v2.mp4}
TMP="${IN%.mp4}.tmp.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$IN" -c:v copy \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -c:a aac -b:a 192k -movflags +faststart "$TMP"
mv "$TMP" "$IN"
echo "loudnorm -> $IN"
