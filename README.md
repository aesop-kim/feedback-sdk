# 래티스 피드백 SDK — 말로 하는 QA

래티스 × NEXT 15기 기업 과제. 운영 중인 서비스에 스크립트 한 줄로 붙는 **피드백 채팅 SDK**예요.
고객은 채팅하거나, **화면을 녹화하며 말로** 문제를 설명해요. 로컬 분석 워커가 말한 내용·가리킨 요소·그 순간의 장면을 묶어 **이슈 카드**로 정리하고, 애매한 건 관리자가 승인하면 고객 위젯에 **그 장면 위 객관식 질문**으로 되물어요.

| 래티스가 겪던 문제 | 이 SDK의 답 |
|---|---|
| 요청하기 번거로움(캡처 → PPT → 글) | 쓰던 화면에서 녹화 버튼 하나 |
| 맥락이 빠짐(어느 화면? 어떤 조작? 어떤 계정?) | 영상 + DOM 이벤트 + 페이지 URL + 사용자 정보가 함께 저장 |
| 되묻는 비용 | 애매한 이슈만 골라 장면 위에서 객관식으로 한 번에 |
| 티켓화 수작업 | 발화·요소·장면이 붙은 이슈 카드가 자동으로 |

## 구조

```
고객사 페이지 (origin B)               feedback-sdk (origin A, Next.js 16)
 sdk.js ── postMessage ──────────────▶ /widget (iframe)
  · 런처·배지                            · 채팅, 녹화(화면+마이크), 장면 캡처
  · rrweb DOM 기록·요소 컨텍스트          · signed URL로 Storage 직접 업로드
                                      /admin — 목록·대화·녹화 분석·되묻기
                                      /api/*  — 대화 토큰(HMAC) 인증, service role만 DB 접근
                 Supabase: Postgres(RLS ON, anon 정책 0) · Storage(private) · Realtime(신호만)
                                            ▲
                 로컬 분석 워커(npm run worker): whisper.cpp 받아쓰기 → 시간축 정렬 →
                 요소·장면 매칭 → claude -p(구독) 구조화 출력 → 이슈 카드 저장
```

- **신뢰 모델**: 위젯 API는 같은 origin이라 `Origin` 헤더로는 고객사를 증명할 수 없어요. `frame-ancestors`(프로젝트별 허용 사이트), `postMessage`의 `event.origin` 검증, 서버가 발급한 **대화 토큰**만 믿어요. 실시간 채널은 `{type, id}` 신호만 보내고 내용은 항상 API로 다시 가져와요(위조 신호를 보내도 위조 내용은 렌더되지 않음).
- **분석은 멱등**: `claim_next_recording()`이 한 건씩 잠그고 가져가며, 결과 저장은 `replace_recording_issues()` 한 트랜잭션. 같은 녹화를 두 번 분석해도 이슈 수는 그대로예요. 고객에게 이미 보낸 질문이 있으면 결과를 바꾸지 않아요.
- **API 키 없이**: 받아쓰기는 로컬 whisper.cpp, 분석은 로컬 Claude Code 구독(`claude -p --json-schema`)을 써요. 서버는 AI를 호출하지 않아요.
- 결정 기록: `docs/adr/0001-recording-architecture.md`, 디자인 근거: `docs/design/tds-reference.md`.

## 로컬에서 실행하기

필요한 것: Node 24, Docker, `whisper-cli` + `~/.cache/whisper-cpp/ggml-large-v3-turbo.bin`, ffmpeg, 로그인된 Claude Code CLI.

```bash
npm install --legacy-peer-deps
npx -y supabase@latest start          # 로컬 Supabase(Docker)
npm run db:reset                      # 스키마 + 데모 프로젝트(lattice-demo)
cp .env.example .env.local            # 값 채우기(아래)
npm run dev                           # SDK 앱 http://localhost:3000 (sdk.js 빌드 포함)
npm run demo:host                     # 데모 고객사 페이지 http://localhost:3001
npm run worker                        # 로컬 분석 워커
```

- 관리자: http://localhost:3000/admin (비밀번호 `ADMIN_PASSWORD`)
- 고객사 페이지에 붙이는 코드는 이것뿐이에요.

```html
<script src="https://<SDK 주소>/sdk.js"></script>
<script>Feedback.init({ projectKey: 'lattice-demo', user: window.DEMO_USER });</script>
```

### 환경 변수 (`.env.local`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SDK_ORIGIN`, `WIDGET_TOKEN_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD`

## 테스트

```bash
npm run lint && npm run typecheck && npm test      # 단위 테스트(토큰, 시간축 정렬, 컨텍스트, 장면 확대 등)
scripts/make-narration-audio.sh                    # 데모 대본 TTS → 가짜 마이크 입력
E2E_FAKE_AUDIO=$(pwd)/fixtures/demo-recording/narration.wav npm run e2e   # 전체 흐름
npm run check:analysis                             # 분석 결과 vs fixtures/demo-recording/expected.json
```

E2E는 데모 페이지에서 실제로 녹화(대본대로 버튼 클릭·오타·제목을 가리키며 말함) → 업로드 → 워커 분석 → 관리자 확인·답장·되묻기 → 고객이 한 번에 답변 → 관리자 반영까지 확인해요.

## 배포 주소

- SDK 앱·관리자: https://lattice-feedback-sdk.vercel.app (관리자: `/admin`)
- 데모 페이지: https://lattice-feedback-demo.vercel.app
- 데이터베이스: Supabase 클라우드 `lattice-feedback-sdk` (서울)
- 분석 워커는 로컬에서 클라우드 DB를 바라보게 실행해요: `NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run worker`

## 배포

- SDK 앱: Vercel 새 프로젝트 → 환경 변수 등록(`NEXT_PUBLIC_SDK_ORIGIN`은 배포 주소) → Supabase 클라우드 프로젝트에 `supabase db push`, `projects.allowed_origins`에 데모 페이지 주소 추가.
- 데모 페이지: `aesop-kim/feedback-sdk-demo-page`를 별도 Vercel 프로젝트로 배포하고 `sdk.js` 주소만 바꿔요.
- 분석 워커는 Claude Code 구독을 쓰는 로컬 프로세스라 배포 대상이 아니에요. 같은 Supabase를 바라보게 `.env.local`만 맞추면 배포된 위젯의 녹화도 처리해요.

## 범위에서 뺀 것
- 사용자 신원 위장 방지: `user.id`·`hostOrigin`은 고객사 페이지가 넘겨준 값이에요. 운영에선 고객사 서버가 서명한 사용자 토큰이 필요해요.
- 데스크톱 Chrome 최신 버전 기준(화면 공유 API). Safari·Firefox·모바일은 검증하지 않았어요.
- AI 자동 코드 수정, 실제 이메일 발송.

## 협업 기록
티켓(Issue) 1개 = 브랜치 1개 = PR 1개, squash merge. PR 본문은 배경 / 변경 내용 / 확인 방법. 컨벤션(kebab-case 파일, 중첩 삼항 금지, `@/` 절대 경로)은 ESLint로 강제하고 CI에서 lint·typecheck·test를 돌려요.
