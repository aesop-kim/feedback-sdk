#!/usr/bin/env bash
# 렌더 결과 검수용 콘택트 시트: 1초에 1프레임(각 초의 0.5초 지점), 10x11 타일, 왼쪽 위에 초 표시.
# 사용: npm run sheet -- [입력 mp4] [출력 png]
set -euo pipefail
cd "$(dirname "$0")/.."
IN=${1:-out/lattice-demo-v2.mp4}
OUT=${2:-out/contact-sheet.png}
FONT=public/fonts/PretendardVariable.woff2
LABEL="drawtext=fontfile=$FONT:text='%{eif\:floor(t)\:d}s':x=8:y=6:fontsize=22:fontcolor=white:box=1:boxcolor=0x191F28@0.8:boxborderw=4"
if ! ffmpeg -hide_banner -filters 2>/dev/null | grep -q drawtext; then LABEL=null; fi
ffmpeg -hide_banner -loglevel error -y -ss 0.5 -i "$IN" \
  -vf "fps=1,scale=384:216,$LABEL,tile=10x11:padding=4:margin=4:color=0xE5E8EB" \
  -frames:v 1 "$OUT"
echo "sheet -> $OUT"
