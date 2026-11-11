#!/usr/bin/env bash
# 검수용: 지정한 초 4개를 2x2로 묶어 한 장으로 만든다.
# 사용: bash scripts/qa-grid.sh 입력.mp4 출력.png 초1 초2 초3 초4
set -euo pipefail
IN=$1; OUT=$2; shift 2
args=()
for s in "$@"; do args+=(-ss "$s" -i "$IN"); done
ffmpeg -hide_banner -loglevel error -y "${args[@]}" \
  -filter_complex "[0:v][1:v][2:v][3:v]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0" -frames:v 1 "$OUT"
echo "$OUT"
