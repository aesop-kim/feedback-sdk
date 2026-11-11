# 데모 녹화 픽스처와 분석 확인

데모 고객사 페이지(계약서 관리 화면)의 문제 세 가지를 말로 설명하는 녹화를 만들고, 로컬 분석 워커의 결과가 기대와 맞는지 확인합니다.

| 파일 | 내용 |
| --- | --- |
| `narration.txt` | 녹화 중 읽는 대본 |
| `narration.wav` | 대본을 TTS로 읽은 음성. 가짜 마이크 입력으로 씁니다 |
| `expected.json` | 분석 결과로 기대하는 이슈 목록 |

## 준비

- 로컬 Supabase 실행 중, `.env.local` 있음, 마이그레이션 적용(`npx -y supabase@latest migration up`)
- `whisper-cli`(whisper.cpp)와 모델 `~/.cache/whisper-cpp/ggml-large-v3-turbo.bin`
- `ffmpeg`
- `claude` CLI 로그인(구독). API 키는 필요 없습니다.

## 1. 음성 만들기

```bash
bash scripts/make-narration-audio.sh   # narration.txt → narration.wav (macOS say -v Yuna)
```

## 2. 녹화하기

`npm run dev`, `npm run demo:host`를 띄운 뒤 둘 중 하나로 녹화합니다.

- 직접: http://localhost:3001 에서 위젯의 녹화 버튼을 누르고 대본을 읽으며 해당 요소를 가리킵니다.
  1. 오른쪽 위 파란 "계약서 등록" 버튼을 두 번 클릭
  2. 표 머리글 "계약 긍액"에 마우스를 잠시 올림
  3. 맨 위 "전체 계약서" 제목에 마우스를 잠시 올림
- 자동: Playwright로 돌릴 때는 Chrome 실행 인자 `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=fixtures/demo-recording/narration.wav`로 이 음성을 마이크 입력으로 넣고 같은 순서로 클릭·머무름을 재생합니다.

업로드가 끝나면 녹화 상태가 `uploaded`가 됩니다.

## 3. 분석하기

```bash
npm run worker -- --once                    # 대기 중인 녹화 한 건을 분석하고 종료
npm run worker -- --recording <recordingId> # 특정 녹화를 상태와 무관하게 다시 분석(디버그)
npm run worker -- --once --keep             # .worker-tmp/<id>/ 에 내려받은 파일·받아쓰기를 남김
npm run worker                              # 3초마다 확인하며 계속 실행
```

로그 예: `[worker] <id> 내려받기 0.0s · 받아쓰기 6.8s · 분석 15.5s · 이슈 3건 (세그먼트 14, 컨텍스트 3, 장면 3/3)`

실패하면 녹화가 `failed`가 되고 `error`에 단계별 한국어 메시지와 원인이 남습니다. 관리자 화면의 재분석은 상태를 `uploaded`로 되돌리며, 워커가 다시 집어 갑니다.

## 4. 기대 결과와 비교

```bash
npm run check:analysis                 # 가장 최근 analyzed 녹화
npm run check:analysis -- <recordingId>
```

`expected.json`의 기대 이슈마다, 실제 이슈의 제목·요약·인용에 `textContains` 단어가 하나라도 있거나 `element.selector`에 `selectorContains`가 하나라도 들어 있고, `confidence`가 같으면 일치로 봅니다. 실제 이슈 개수가 기대 개수와 같고 모든 기대 이슈가 일치하면 `PASS`(종료 코드 0), 아니면 `FAIL`(종료 코드 1)입니다.
