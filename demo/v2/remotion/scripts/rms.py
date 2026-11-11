"""대사 구간 wav마다 30fps 프레임 단위 RMS(0~1)를 계산해 TS 모듈로 쓴다. 파형 막대 높이에 쓴다."""
import math
import struct
import sys
import wave

src_dir, out_path, *ids = sys.argv[1:]
FPS = 30
lines = ["// scripts/rms.py가 만든 파일. 직접 고치지 않는다.", "export const NARRATION_RMS: Record<string, number[]> = {"]
for seg in ids:
    with wave.open(f"{src_dir}/{seg}.wav", "rb") as w:
        sr = w.getframerate()
        raw = w.readframes(w.getnframes())
    samples = struct.unpack(f"<{len(raw)//2}h", raw)
    hop = sr // FPS
    vals = []
    for i in range(0, len(samples), hop):
        chunk = samples[i : i + hop]
        if not chunk:
            break
        vals.append(math.sqrt(sum(s * s for s in chunk) / len(chunk)) / 32768)
    peak = max(vals) or 1
    lines.append(f"  {seg}: [{', '.join(f'{v / peak:.2f}' for v in vals)}],")
lines.append("};")
with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
print(f"rms -> {out_path}")
