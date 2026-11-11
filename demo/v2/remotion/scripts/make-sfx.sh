#!/usr/bin/env bash
# UI 효과음을 ffmpeg로 합성해 public/sfx/*.wav로 만든다. 외부 소스 없이 사인파·노이즈에 엔벌로프만 씌운다.
# 다시 만들기: npm run sfx
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/sfx
mkdir -p "$OUT"
SR=48000
minus() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.3f", a-b}'; }

synth() { # name duration expr [extra-filter]
  local name=$1 dur=$2 expr=$3 filt=${4:-anull} st
  st=$(minus "$dur" 0.004)
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "aevalsrc=exprs='$expr':s=$SR:d=$dur" \
    -af "$filt,afade=t=out:st=$st:d=0.004" \
    -ac 1 -c:a pcm_s16le "$OUT/$name.wav"
}

noise() { # name duration envelope-expr filter
  local name=$1 dur=$2 env=$3 filt=$4 st
  st=$(minus "$dur" 0.005)
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "anoisesrc=c=white:r=$SR:a=0.9:d=$dur:s=7" \
    -af "volume='$env':eval=frame,$filt,afade=t=out:st=$st:d=0.005" \
    -ac 1 -c:a pcm_s16le "$OUT/$name.wav"
}

# 틱: 단어 팝·포커스 이동. 짧은 고음 사인
synth tick 0.05 '0.5*sin(2*PI*2400*t)*exp(-t*90)'
synth tick-soft 0.04 '0.28*sin(2*PI*1900*t)*exp(-t*110)'
# 키 클릭: 음절 타이핑. 아주 옅게
synth key 0.03 '0.18*(sin(2*PI*3200*t)+0.5*sin(2*PI*5100*t))*exp(-t*180)'
# 팝: 위로 올라가는 짧은 사인 스윕
synth pop 0.11 '0.6*sin(2*PI*(380*t+2600*t*t))*exp(-t*32)'
# 굵은 팝: 큰 단어 등장
synth pop-big 0.16 '0.75*sin(2*PI*(170*t+1700*t*t))*exp(-t*22)+0.2*sin(2*PI*90*t)*exp(-t*30)'
# 런처 "뽁": 둥글고 밝게
synth bloop 0.18 '0.7*sin(2*PI*(300*t+2200*t*t))*exp(-t*18)'
# 마우스 클릭: 두 겹 클릭
synth click 0.045 '0.55*(sin(2*PI*2900*t)*exp(-t*260)+0.6*sin(2*PI*1200*t)*exp(-t*200))'
synth click-hard 0.05 '0.8*(sin(2*PI*2600*t)*exp(-t*220)+0.8*sin(2*PI*1000*t)*exp(-t*160))'
# 메신저 "똑": 피치를 조금씩 올린 6개
i=0
for f in 820 880 940 1000 1060 1120; do
  synth "drop-$i" 0.09 "0.55*sin(2*PI*$f*t)*exp(-t*45)+0.15*sin(2*PI*$((f*2))*t)*exp(-t*80)"
  i=$((i+1))
done
# 토스트 벨 1음
synth bell 0.6 '0.4*(sin(2*PI*1318*t)+0.35*sin(2*PI*2636*t)+0.12*sin(2*PI*3954*t))*exp(-t*7)'
# 2음 차임(성공, 위로)
synth chime 0.7 '0.38*(sin(2*PI*988*t)*exp(-t*9)*lt(t,0.12)+sin(2*PI*1318*t)*exp(-(t-0.12)*7)*gte(t,0.12))'
# 녹화 시작(낮음→높음), 종료(높음→낮음)
synth rec-start 0.36 '0.4*(sin(2*PI*660*t)*lt(t,0.14)+sin(2*PI*990*t)*gte(t,0.14))*exp(-mod(t,0.14)*14)'
synth rec-stop 0.36 '0.4*(sin(2*PI*990*t)*lt(t,0.14)+sin(2*PI*660*t)*gte(t,0.14))*exp(-mod(t,0.14)*14)'
# 이중 블립(배지 99+)
synth blip2 0.16 '0.4*sin(2*PI*1560*t)*(lt(t,0.05)*exp(-t*60)+gte(t,0.08)*exp(-(t-0.08)*60))'
synth blip 0.07 '0.4*sin(2*PI*1560*t)*exp(-t*60)'
# 낮은 "툭" 히트
synth hit 0.3 '0.9*sin(2*PI*(110*t-60*t*t))*exp(-t*14)+0.15*sin(2*PI*55*t)*exp(-t*10)'
# 부드러운 "툭"(카드)
synth thud 0.14 '0.5*sin(2*PI*(240*t-200*t*t))*exp(-t*30)'

# 노이즈 계열: 스우시(스케일 인), 휩, 슥, 슉
noise whoosh 0.32 'if(lt(t,0.12),t/0.12,exp(-(t-0.12)*14))*0.45' 'highpass=f=500,lowpass=f=5000'
noise whip 0.2 'if(lt(t,0.05),t/0.05,exp(-(t-0.05)*24))*0.5' 'highpass=f=1200,lowpass=f=7000'
noise whoosh-long 0.62 'sin(PI*t/0.62)*sin(PI*t/0.62)*0.42' 'bandpass=f=1800:width_type=o:w=2.4'
noise swish 0.2 'sin(PI*t/0.2)*0.35' 'bandpass=f=3200:width_type=o:w=1.4'
noise send 0.24 'if(lt(t,0.03),t/0.03,exp(-(t-0.03)*16))*0.45' 'highpass=f=1800,lowpass=f=9000'

# 아주 옅은 패드(음악 대신). A장조 화음 사인에 8초 주기 숨쉬기만 준다. 104s.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "aevalsrc=exprs='(0.30*sin(2*PI*110*t)+0.22*sin(2*PI*164.81*t)+0.16*sin(2*PI*277.18*t+0.4*sin(2*PI*0.11*t))+0.10*sin(2*PI*329.63*t)+0.08*sin(2*PI*220.6*t))*(0.75+0.25*sin(2*PI*t/8))':s=$SR:d=104" \
  -af "lowpass=f=900,afade=t=in:d=2,afade=t=out:st=100:d=4,volume=0.5" \
  -ac 1 -c:a pcm_s16le "$OUT/pad.wav"

echo "sfx -> $OUT"; ls "$OUT"
