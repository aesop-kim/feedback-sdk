"""배경음악 합성: 100 BPM(한 박 = 18프레임), 밝은 4화음 진행. 저작권 없는 자체 합성.

구간(프레임, 30fps)
  0~180   인트로: 패드만 서서히
  180~465 문제 구간(S03~S05): 낮게 깔린 패드 + 심장 박동 같은 킥
  465~    S06 '해법'부터 전체 그루브(마디 첫 박을 465에 맞춤)
  ROLL~   요약 구간: 드럼 빠지고 화음만, 엔드 카드에서 사라짐
사용: python3 scripts/make-bgm.py <총 프레임> <요약 시작 프레임> <출력 wav>
"""
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
FPS = 30
BEAT_F = 18  # 100 BPM
TOTAL_F = int(sys.argv[1]) if len(sys.argv) > 1 else 3510
ROLL_F = int(sys.argv[2]) if len(sys.argv) > 2 else 2985
OUT = sys.argv[3] if len(sys.argv) > 3 else "public/sfx/bgm.wav"
GRID0 = 465 - BEAT_F * 4 * 6  # 465에 마디 첫 박이 오도록

n = int(TOTAL_F / FPS * SR) + SR
mix = {k: np.zeros(n) for k in ["pad", "keys", "bass", "kick", "hat", "pluck"]}


def fr2s(f):
    return int(f / FPS * SR)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(length, a=0.01, d=0.3, s=0.6, r=0.2):
    t = np.arange(length) / SR
    e = np.ones(length) * s
    ai = t < a
    e[ai] = t[ai] / a
    di = (t >= a) & (t < a + d)
    e[di] = 1 - (1 - s) * (t[di] - a) / d
    rel = int(r * SR)
    if rel < length:
        e[-rel:] *= np.linspace(1, 0, rel)
    return e


def add(track, start, sig):
    end = min(n, start + len(sig))
    if start >= n or end <= start:
        return
    mix[track][start:end] += sig[: end - start]


def tone(freq, dur, harm=(1, 0.5, 0.25), detune=0.0):
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(t)
    for i, a in enumerate(harm):
        s += a * np.sin(2 * np.pi * freq * (i + 1) * t * (1 + detune))
    return s


# 화음 진행: Fmaj7 - G6 - Em7 - Am7 (C장조, 밝고 담백하게)
CHORDS = [
    [53, 57, 60, 64],  # F A C E
    [55, 59, 62, 64],  # G B D E
    [52, 55, 59, 62],  # E G B D
    [57, 60, 64, 67],  # A C E G
]
BASS = [41, 43, 40, 45]

bar_f = BEAT_F * 4
bar = 0
f = GRID0
while f < TOTAL_F:
    ch = CHORDS[bar % 4]
    bdur = bar_f / FPS
    st = fr2s(f)
    # 패드: 부드러운 사인 + 살짝 어긋난 음정으로 넓게
    for m in ch:
        sig = tone(midi(m), bdur + 0.6, (1, 0.15), 0) + tone(midi(m), bdur + 0.6, (1,), 0.003)
        add("pad", st, sig * env(len(sig), a=0.5, d=0.5, s=0.8, r=0.6) * 0.05)
    # 건반: 2·4박 뒤에 짧은 화음
    for beat in (1, 3):
        bt = fr2s(f + beat * BEAT_F + BEAT_F // 2)
        for m in ch:
            sig = tone(midi(m + 12), 0.5, (1, 0.35, 0.12))
            add("keys", bt, sig * env(len(sig), a=0.005, d=0.25, s=0.0, r=0.1) * 0.05)
    # 베이스: 1박, 3박 반
    for beat, l in ((0, 1.2), (2.5, 0.5)):
        bt = fr2s(f + beat * BEAT_F)
        sig = tone(midi(BASS[bar % 4]), l, (1, 0.3))
        add("bass", bt, sig * env(len(sig), a=0.01, d=0.3, s=0.5, r=0.15) * 0.22)
    # 플럭: 8분음표 아르페지오(화음음 순환, 한 옥타브 위)
    for k in range(8):
        bt = fr2s(f + k * BEAT_F / 2)
        m = ch[[0, 2, 1, 3, 2, 1, 3, 2][k]] + 24
        sig = tone(midi(m), 0.3, (1, 0.2))
        add("pluck", bt, sig * env(len(sig), a=0.002, d=0.18, s=0.0, r=0.05) * 0.035)
    # 킥: 1, 3박 / 하이햇: 8분 뒤박
    for beat in (0, 2):
        bt = fr2s(f + beat * BEAT_F)
        t = np.arange(int(0.35 * SR)) / SR
        sweep = 50 + 90 * np.exp(-t * 30)
        sig = np.sin(2 * np.pi * np.cumsum(sweep) / SR) * np.exp(-t * 9)
        add("kick", bt, sig * 0.5)
    for k in range(4):
        bt = fr2s(f + k * BEAT_F + BEAT_F / 2)
        noise = np.random.default_rng(bar * 8 + k).standard_normal(int(0.06 * SR))
        sig = noise * np.exp(-np.arange(len(noise)) / SR * 70)
        add("hat", bt, sig * 0.025)
    f += bar_f
    bar += 1

# 하이햇 고역 통과, 패드 저역 통과(따뜻하게)
mix["hat"] = sosfilt(butter(2, 7000, "hp", fs=SR, output="sos"), mix["hat"])
mix["pad"] = sosfilt(butter(2, 2500, "lp", fs=SR, output="sos"), mix["pad"])


def curve(points):
    """[(프레임, 값)] → 샘플 단위 볼륨 곡선"""
    xs = [fr2s(p[0]) for p in points]
    ys = [p[1] for p in points]
    return np.interp(np.arange(n), xs, ys)


END = TOTAL_F
R = ROLL_F
G = {
    "pad": curve([(0, 0), (90, 0.8), (180, 0.6), (465, 0.7), (480, 1), (R, 1), (END - 60, 1), (END, 0)]),
    "keys": curve([(0, 0), (440, 0), (465, 1), (R, 1), (R + 30, 0.7), (END - 60, 0.6), (END, 0)]),
    "bass": curve([(0, 0), (180, 0), (200, 0.5), (465, 0.5), (470, 1), (R, 1), (R + 20, 0.3), (END - 90, 0.3), (END, 0)]),
    "pluck": curve([(0, 0), (60, 0.5), (180, 0.5), (200, 0), (465, 0), (480, 1), (R, 1), (R + 30, 1), (END - 60, 0.8), (END, 0)]),
    "kick": curve([(0, 0), (180, 0), (190, 0.6), (460, 0.6), (465, 1), (R - 2, 1), (R, 0), (END, 0)]),
    "hat": curve([(0, 0), (465, 0), (470, 1), (R - 2, 1), (R, 0), (END, 0)]),
}
out = sum(mix[k] * G[k] for k in mix)
# 간단한 리버브(짧은 지연 몇 개)
rev = np.zeros_like(out)
for d, a in ((0.031, 0.25), (0.047, 0.2), (0.071, 0.15), (0.113, 0.1)):
    s = int(d * SR)
    rev[s:] += out[:-s] * a
out = out + rev * 0.6
out = out[: fr2s(TOTAL_F)]
out = out / (np.max(np.abs(out)) + 1e-9) * 0.89
stereo = np.stack([out, np.roll(out, 200) * 0.97 + out * 0.03], axis=1)
wavfile.write(OUT, SR, (stereo * 32767).astype(np.int16))
print("bgm ->", OUT, f"{TOTAL_F / FPS:.1f}s")
