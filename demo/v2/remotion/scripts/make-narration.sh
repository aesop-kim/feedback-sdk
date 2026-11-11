#!/usr/bin/env bash
# fixtures/demo-recording/narration.wav(고객 대사)에서 스토리보드 S10~S12 구간만 잘라 public/audio/에 둔다.
# narration.wav는 저장소에 없으므로(gitignore) 경로를 인자나 NARRATION 환경변수로 넘긴다.
# 파형(RMS) 데이터는 src/data/narration-rms.ts로 쓴다.
# 사용: npm run narration -- /abs/path/to/narration.wav
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:-${NARRATION:-../../../fixtures/demo-recording/narration.wav}}
if [[ ! -f "$SRC" ]]; then
  echo "narration.wav를 찾을 수 없어요: $SRC" >&2
  exit 1
fi
mkdir -p public/audio
# id start end (storyboard.md S10~S12)
SEGS=(
  "n1 14.28 18.24"
  "n2 29.32 32.22"
  "n3 32.47 34.85"
  "n4 42.74 45.36"
  "n5 45.64 48.53"
)
for s in "${SEGS[@]}"; do
  read -r id a b <<<"$s"
  st=$(awk -v a="$a" -v b="$b" 'BEGIN{printf "%.3f", b-a-0.04}')
  ffmpeg -hide_banner -loglevel error -y -ss "$a" -to "$b" -i "$SRC" \
    -af "afade=t=in:d=0.02,afade=t=out:st=$st:d=0.04" \
    -ac 1 -ar 48000 -c:a pcm_s16le "public/audio/$id.wav"
done
python3 -I scripts/rms.py public/audio src/data/narration-rms.ts n1 n2 n3 n4 n5
echo "narration -> public/audio"
