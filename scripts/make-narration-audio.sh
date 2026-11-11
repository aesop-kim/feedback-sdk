#!/bin/bash
# 데모 대본(fixtures/demo-recording/narration.txt)을 한국어 TTS로 읽어 가짜 마이크 입력용 wav를 만든다.
# 앞에 2초 무음(녹화 시작 대기), 문장 사이 0.5초 무음.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT_DIR=fixtures/demo-recording
TEXT="[[slnc 2000]] $(sed 's/$/ [[slnc 500]]/' "$OUT_DIR/narration.txt" | tr '\n' ' ')"
say -v Yuna -o "$OUT_DIR/narration.aiff" "$TEXT"
ffmpeg -y -loglevel error -i "$OUT_DIR/narration.aiff" -ar 48000 -ac 1 "$OUT_DIR/narration.wav"
rm "$OUT_DIR/narration.aiff"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT_DIR/narration.wav"
