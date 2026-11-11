# QA 매트릭스 — 피드백 SDK (기능 QA v2)

- 실행일: 2026-11-12 (KST 00:50–01:50)
- 대상: **로컬**(`npm run dev` :3000, 데모 :3001, 로컬 Supabase, 로컬 워커) / **배포**(https://lattice-feedback-sdk.vercel.app, https://lattice-feedback-demo.vercel.app, 클라우드 DB, 클라우드 워커)
- 도구: Playwright(Chromium, `playwright.config.ts`의 가짜 미디어·탭 캡처 자동 수락 플래그). Claude-in-Chrome 미사용.
- `npm run db:reset`은 **실행하지 않았다**(디자이너 캡처와 같은 로컬 DB를 쓰므로). 대신 모든 시험은 `external_id`가 `qa-`로 시작하는 별도 사용자로 돌렸다(데모 페이지의 `window.DEMO_USER`를 init script로 고정).
- 테스트 데이터 정리: 각 스펙의 `afterAll`이 `qa-*` 사용자·대화·녹화·Storage 파일을 지운다. 마지막에 로컬·클라우드 모두 `qa-` 사용자 0건을 확인했다(아래 "정리 기록").

## 회귀 스펙 (`e2e/qa/`)

| 파일 | 내용 | 실행 |
|---|---|---|
| `qa-helpers.ts` | 대상 전환(`QA_TARGET=deployed`), QA 사용자 주입, 콘솔/네트워크 수집, DB 시드·정리 | — |
| `widget-chat.spec.ts` | 열기/닫기, 이름, 빈 상태, 실시간 2초, 중복 전송, 공백·2000자·이모지, Enter/Shift+Enter, 360×740, 전송 실패, 배지 | `npx playwright test e2e/qa/widget-chat.spec.ts` |
| `widget-recording.spec.ts` | 시작/끝내기, 취소, 화면 공유·마이크 거부, 공유 중지 자동 종료, 3분 자동 종료, 업로드 실패→다시 보내기, 녹화/업로드 중 새로고침 | `npx playwright test e2e/qa/widget-recording.spec.ts` |
| `worker-analysis.spec.ts` | 실제 워커: 무음 녹화(실패+이유), 대본 녹화(이슈→되묻기→답변→재분석 409) | `QA_AUDIO=silent E2E_FAKE_AUDIO=<무음.wav>` / `QA_AUDIO=narration E2E_FAKE_AUDIO=$(pwd)/fixtures/demo-recording/narration.wav` |
| `admin-flow.spec.ts` | 로그인/로그아웃, 빈 상태, 대화 선택, 긴 답장, 분석 상태, 승인→카드→답변, 409, 반영 완료→재확인, 늦은 답변, 1280/1440 레이아웃, 부하 중 상세 열기 | `npx playwright test e2e/qa/admin-flow.spec.ts` |
| `security-api.spec.ts` | 401(토큰 없음/위조/만료), 타 대화 카드 404, 재확인 이슈 404, 동시 답변, hostOrigin 403, CSP, 관리자 API 401, 로그인 시도 제한 | `npx playwright test e2e/qa/security-api.spec.ts` |

배포 대상으로 돌리려면 앞에 `QA_TARGET=deployed`를 붙인다. 실패로 남아 있는 테스트는 **아래 버그를 재현하는 회귀 테스트**다(버그를 고치면 초록이 된다).

스크린샷: `.screens/qa-v2/functional/{local|deployed}-*.png`, 페이지별 콘솔·네트워크 로그: `.screens/qa-v2/functional/logs/{local|deployed}-*.json`.

## 결과 표

표기: ✅ 통과 · ❌ 실패(버그) · ⚠️ 통과했지만 주의 · — 배포에서는 돌리지 않음

### 1. 위젯 열기/닫기·이름·첫 빈 상태

| 흐름 | 로컬 | 배포 | 근거 | 메모 |
|---|---|---|---|---|
| 런처로 열기, 닫기 버튼·런처로 닫기 | ✅ | ✅ | `widget-chat` "위젯을 열면…" / `*-chat-01-empty-state.png` | `iframe[data-mode]`, `aria-expanded` 확인 |
| 사용자 이름 표시("QA…님, 무엇이든 알려주세요") | ✅ | ✅ | 같은 테스트 | |
| 첫 방문 빈 상태(녹화 안내 3단계 + CTA) | ✅ | ✅ | `*-chat-01-empty-state.png` | |
| 세션 준비 전 입력 | ⚠️ | ⚠️ | 코드 확인 | 텍스트 상자는 로딩 중에도 입력 가능하지만 Enter/보내기는 조용히 무시된다(내용은 남음). 로딩 표시가 없어 "안 보내진다"로 느껴질 수 있음 |

### 2. 채팅 송수신·실시간

| 흐름 | 로컬 | 배포 | 근거 | 메모 |
|---|---|---|---|---|
| 고객→관리자 실시간(<2초) | ✅ 137ms | ❌ 1.4–2.4초 | `widget-chat` "2초 안에" (배포 4/4 실패), 측정 로그 | **BUG-08** |
| 관리자→고객 실시간(<2초) | ✅ 149ms | ⚠️ 1.95–1.97초 | 같은 측정 | 경계값. **BUG-08** |
| 보내기 더블클릭 → 1건 | ✅ | ✅ | "보내기 버튼을 빠르게 두 번" (DB count=1) | |
| Enter 연타 → 1건 | ✅ | ✅ | "Enter를 빠르게 두 번" | |
| 빈/공백 메시지 차단(UI) | ✅ | ✅ | "빈 메시지와 공백만" | 보내기 비활성, Enter 무시 |
| 빈/공백 메시지 차단(API) | ✅ 400 | ✅ 400 | "서버 API도 공백만" | |
| 2000자 초과 붙여넣기 | ✅ | ✅ | "2000자를 넘게" / `*-chat-03-long-message.png` | `maxLength`로 2000자에서 잘림, 2000자 저장 |
| 이모지만 / 긴 URL 줄바꿈(위젯) | ✅ | ✅ | `*-chat-04-emoji-long-word.png` | 위젯 말풍선은 잘 감싼다 |
| Enter 보냄 / Shift+Enter 줄바꿈 | ✅ | ✅ | "Shift+Enter는 줄을 바꾸고" | |
| 전송 실패 시 입력 보존 | ❌ | ❌ | "메시지 전송이 실패하면" / `*-chat-06-send-failed.png` | **BUG-10** |
| 닫혀 있을 때 답장 → 런처 배지 | ✅ | ✅ | `*-chat-07-badge.png` | "새 답장 1개" |
| 새로고침 후 배지 유지 | ❌ | ❌ | `*-chat-07-badge-after-reload.png` | **BUG-13** |

### 3. 녹화

| 흐름 | 로컬 | 배포 | 근거 | 메모 |
|---|---|---|---|---|
| 시작 → 알약(타이머·끝내기), 런처 숨김 | ✅ | ✅ | `*-rec-01-recording-pill.png` | |
| 끝내기 → 업로드 → "정리하고 있어요" | ✅ | ✅ | `*-rec-01-uploaded.png`, DB status=uploaded | |
| 녹화 취소(버리기) | ❌ | ❌ | "녹화 중에는 취소" — 알약 버튼 `["끝내기"]`뿐 | **BUG-12** |
| 화면 공유 거부 → 토스트·복구·재시도 | ✅ | ✅ | `*-rec-02-screen-denied.png` | `getDisplayMedia` reject 스텁(init script) |
| 마이크 거부 → 토스트·복구, 화면 트랙 정지 | ✅ | ✅ | `*-rec-03-mic-denied.png`, track `["ended"]` | `getUserMedia` reject 스텁 |
| 크롬 "공유 중지"(트랙 ended) → 자동 종료·업로드 | ✅ | ✅ | `*-rec-04-share-stopped.png` | |
| 최대 3분 자동 종료 | ✅ 180.2초 | — | `local-rec-05-max-duration.png`, status=uploaded | 실제 3분 대기(상수는 빌드 시 고정이라 스텁 불가). 배포는 같은 코드 경로라 생략 |
| 업로드 실패 → "다시 보내기" 표시 | ✅ | ✅ | `*-rec-06-upload-failed.png` (signed upload URL `route.abort`) | 문구는 **BUG-11** |
| 다시 보내기 → 성공 | ⚠️ | ⚠️ | `*-rec-06-upload-retried.png` | 업로드는 되지만 녹화가 2개 생김 **BUG-01** |
| 다시 보내기 후 녹화 1건 | ❌ | ❌ | DB `["uploading","uploaded"]`, `*-rec-06-admin-after-retry.png`(관리자 "녹화 2개", 2/2) | **BUG-01** |
| 녹화 중 새로고침 | ⚠️ | ⚠️ | `*-rec-07-refresh-mid-recording.png` | 위젯은 정상 복구, 녹화는 경고 없이 사라짐(DB 0건). **BUG-18** |
| 업로드 중 새로고침 | ❌ | ❌ | `*-rec-08-uploading.png`, `*-rec-08-after-refresh-widget.png`, `*-rec-08-admin-orphan.png` | 위젯엔 아무 흔적 없음, 관리자엔 "고객이 영상을 올리고 있어요"가 영원히. **BUG-02** |
| 무음 마이크 경고(녹화 중) | ❌ | ❌ | `worker-analysis` 무음 / `*-wrk-01-silent-during-recording.png` | 토스트가 그려지지 않음 **BUG-07** |

### 4. 분석 상태(관리자)

| 흐름 | 로컬 | 배포 | 근거 | 메모 |
|---|---|---|---|---|
| 분석 중(analyzing/uploaded) | ✅ | ✅ | `*-admin-05-analyzing.png`, `local-wrk-01-admin-analyzing.png` | |
| 분석 완료(문제 N건·확인 필요) — 시드 | ✅ | ⚠️ | `*-admin-06-analyzed.png` | 배포 1회 15초 넘게 스켈레톤(재시도 3/3 통과). 상세 API 평균 3초 — **BUG-08** |
| 분석 완료 — 실제 워커(대본 녹화) | ✅ 문제 3건 | ✅ 문제 3건 | `*-wrk-02-admin-analyzed.png` | 로컬 1.6분 / 배포 1.9분 |
| 실패(무음) — 실제 워커 | ✅ status=failed | ✅ status=failed | DB error="음성을 받아쓰지 못했어요: 목소리가 녹음되지 않았어요…" | 워커는 정상 |
| 실패 화면에 이유(무음 안내) 표시 | ❌ | ❌ | `*-admin-05-failed-silent.png`, `*-wrk-01-admin-failed.png` | **BUG-06** |
| 다시 정리하기 버튼 → 대기열 복귀 | ✅ | ✅ | `admin-flow` "분석 중·실패…" | 시드 녹화라 워커가 즉시 다시 실패(정상) |
| 질문 보낸 녹화 재분석 → 409 | ✅ 409 | ✅ 409 | `worker-analysis` 대본 녹화 | |

### 5. 관리자

| 흐름 | 로컬 | 배포 | 근거 | 메모 |
|---|---|---|---|---|
| 틀린 비밀번호 안내 → 맞는 비밀번호 로그인 → 로그아웃 → 재진입 차단 → 뒤로 가기 | ✅ | ✅ | `*-admin-01-wrong-password.png` | |
| 쿠키 없이 `/admin`, `/admin/<id>` 직접 접근 → 로그인으로 | ✅ | ✅ | `security-api` "쿠키 없이" | |
| 위조 쿠키로 접근 → 결국 로그인으로 | ✅ | ✅ | "위조된 관리자 쿠키로" | proxy는 쿠키 존재만 보고, API 401 후 클라이언트가 이동 |
| 대화 목록 빈 상태 | ✅ | ✅ | `*-admin-02-empty-list.png` (목록 API를 route로 비움) | DB를 비우지 않으려고 응답 스텁 |
| 메시지·녹화 없는 대화 빈 상태 | ✅ | ✅ | `*-admin-03-empty-conversation.png` | |
| 대화 선택·전환 | ✅ | ✅ | "메시지가 없는 대화를 고르면…" | |
| 없는/잘못된 대화 주소 | ✅ | ✅ | "없는 대화 주소로" | "대화를 찾을 수 없어요." |
| 답장(Enter) | ✅ | ✅ | `widget-chat` 실시간 테스트 | |
| 2000자 초과 답장 | ❌ | ❌ | `*-admin-04-long-reply.png` | **BUG-14** |
| 질문 고쳐 승인(질문·보기 3개) → 위젯 카드 | ✅ | ✅ | `*-admin-07-widget-card.png` | 고친 질문·보기 그대로 표시 |
| 한 번 답변 → 관리자 "고객 답변" 반영 | ✅ | ✅ | `*-admin-07-answer-reflected.png` | |
| 두 번째 답변(다른 탭) → 409 UI 처리 | ❌ | ❌ | `*-admin-08-widget-409.png` | 응답은 409지만 "연결 불안정" 토스트, 카드 그대로 **BUG-09** |
| 동시 답변 4건 → 1건만 저장 | ❌ (4건) | ❌ (2건) | `security-api` "동시에 두 번" | **BUG-03** |
| 이슈 "반영 완료로 바꾸기" | ✅ | ✅ | `*-admin-09-admin-resolved.png` | 상태 변경은 resolved 한 가지만 지원 |
| 반영 완료 → 위젯 재확인 안내 | ✅ | ✅ | `*-admin-09-widget-reverify-prompt.png` | 회색 시스템 문구만 |
| 재확인 녹화가 이슈에 연결 | ❌ | ❌ | 안내 옆 동작 0개, 클라이언트가 `reverifyIssueId`를 보내는 코드 없음 | **BUG-05** |
| 질문 보낸 뒤 반영 완료 → 고객 늦은 답변 | ❌ | ❌ | "늦게 답해도" — status가 resolved→answered | **BUG-04** |
| 1280 / 1440 레이아웃, 긴 이름 | ✅ | ✅ | `*-admin-10-layout-1280.png`, `*-1440.png` | 페이지 가로 스크롤 없음, 긴 이름은 줄바꿈 |
| 1280 / 1440 긴 단어 말풍선 | ❌ | ❌ | 같은 스크린샷(가운데 말풍선 오른쪽이 잘림) | **BUG-15** |
| 다른 대화 신호가 계속 올 때 상세 열림 | ✅ 0.3초 | ✅ 5.2초 | `*-admin-11-detail-under-load.png` | 회귀용 |

### 6. 보안·API

| 흐름 | 로컬 | 배포 | 근거 | 메모 |
|---|---|---|---|---|
| 위젯 API 5종, 토큰 없음/`Token`/쓰레기/위조 서명 → 401 | ✅ | ✅ | `security-api` "…토큰을 401로" (20/20 응답 401) | |
| 서명은 맞지만 만료된 대화 토큰(위젯 API 4종)·관리자 쿠키 → 401 | ✅ | ✅ | `security-api` "서명은 맞지만 만료된…" (#98에서 추가) | 배포는 `.env.cloud`의 `CLOUD_WIDGET_TOKEN_SECRET`·`CLOUD_ADMIN_SESSION_SECRET`로 서명한다(#109). 처음에는 "운영 비밀값이 러너에 없다"며 건너뛰었는데, 사실이 아니었다 |
| 다른 대화 토큰으로 cardId 답변 → 404 | ✅ | ✅ | "다른 대화의 토큰으로" | |
| 승인 전 카드 답변 → 404 | ✅ | ✅ | "승인 전 질문 카드" | |
| 다른 대화 이슈를 reverifyIssueId로 → 404 | ✅ | ✅ | "재확인 녹화로 연결하면 404" | |
| 다른 대화 녹화 PATCH | ✅ 변경 없음 | ✅ | 200 `{changed:false}` | 404가 더 일관적(정보 노출은 없음) |
| 같은 카드 두 번 답변 → 409 | ✅ | ✅ | "두 번째는 409" | 순차일 때만. 동시면 **BUG-03** |
| 허용 안 된 hostOrigin → 403 | ✅ | ✅ | "허용되지 않은 hostOrigin" | 단, hostOrigin은 클라이언트 값이라 curl로 우회 가능(README의 범위 밖 항목) |
| 위젯 CSP frame-ancestors(허용/모름/없음) | ✅ | ⚠️ | 헤더: 로컬 `frame-ancestors http://localhost:3001 http://127.0.0.1:3001`, 배포 `… https://lattice-feedback-demo.vercel.app http://localhost:3001 http://127.0.0.1:3001` | 배포에 localhost 허용 **BUG-16** |
| 허용 안 된 사이트에 iframe → 브라우저 차단 | ✅ | ✅ | 로컬 `http://127.0.0.1:3005`, 배포 `https://example.com`(route) — 콘솔 "Refused to frame", 본문 0 | |
| 관리자 API 6종, 쿠키 없음/위조 → 401 | ✅ | ✅ | "관리자 API는 쿠키가 없거나 위조되면 401" (18/18) | |
| 로그인 시도 제한 | ❌ | ❌ | 15회 연속 오답 모두 401 | **BUG-17** |

### 7. 반응형

| 흐름 | 로컬 | 배포 | 근거 | 메모 |
|---|---|---|---|---|
| 위젯 360×740 | ✅ | ✅ | `*-chat-05-mobile-360.png` (frame 8,16 344×628) | 100자 이름은 헤더 4줄을 차지(말줄임 없음) — 미관상 메모 |
| 관리자 1280 / 1440 | ✅ / ❌ | ✅ / ❌ | 위 5번 표 | 긴 단어만 **BUG-15** |

### 8. 콘솔 에러·실패 요청

전 페이지에서 `console`(error), `pageerror`, `requestfailed`, 4xx/5xx 응답을 수집했다(`logs/*.json`).

| 관찰 | 로컬 | 배포 | 판단 |
|---|---|---|---|
| 5xx 응답 | 0 | 0 | ✅ |
| `pageerror`(잡히지 않은 예외) | 0 | 0 | ✅ |
| `POST /api/admin/session 401` | 있음 | 있음 | 틀린 비밀번호 시험의 의도된 응답 |
| `net::ERR_ABORTED` (`/api/admin/session`, `/api/admin/conversations`, 폰트, `video.webm`) | 있음 | 있음 | `router.replace` 이동·영상 range 요청 취소로 생기는 무해한 중단 |
| `Permissions policy violation: camera is not allowed in this document` | 녹화마다 1회 | 녹화마다 1회 | 녹화 시작(화면 캡처) 경로에서만 나온다. `getUserMedia({audio})`·`enumerateDevices`로는 재현되지 않음(확인함). iframe `allow`에 camera가 없어서 생기는 경고로 보이며 기능 영향 없음 — 메모 |
| `PUT …/upload/sign/… ERR_FAILED` | 업로드 실패 시험에서만 | 같음 | 의도적 `route.abort` |

### 배포 대본 녹화(클라우드 워커, Claude 분석)

| 흐름 | 로컬 | 배포 | 근거 | 메모 |
|---|---|---|---|---|
| 대본 녹화(68초) → 업로드 → 워커 분석 → "문제 3건" | ✅ 1.6분 | ✅ 1.9분 | `worker-analysis` 대본 녹화 / `*-wrk-02-admin-analyzed.png` | QA 사용자로 녹화(김데모 대화 미사용, db:reset 없음) |
| 위젯 녹화 메시지 "문제 n건을 정리했어요" | ✅ | ✅ | 같은 테스트 | |
| 확인 필요 이슈 승인 → 장면 위 질문 카드 → 답변 → 관리자 "고객 답변" | ✅ | ✅ | `*-wrk-02-widget-card.png`, `*-wrk-02-admin-answered.png` | |
| 질문 보낸 녹화 재분석 API → 409 | ✅ | ✅ | 같은 테스트 | |

## Re-test (local / deployed)

BUG-01..18을 고친 뒤 다시 돌린 결과다. 근거는 [verification-v2.md](verification-v2.md)(2026-11-12 02:45 KST, `main` @ `63f0fb5`)와 [verification-v3.md](verification-v3.md)(03:55 KST, `main` @ `b9d8675`)다. 위 결과 표의 ❌는 고치기 전 기록으로 그대로 둔다.

| ID | 고친 PR | 로컬 | 배포 | 근거 |
|---|---|---|---|---|
| BUG-01 | #39, #58 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status) (녹화 1건만 남음, 스펙 L/D) |
| BUG-02 | #39, #65, #68 | PASS | PASS (업로드 중 이탈 경고) · 오래된 업로드 만료 시험은 배포에서 건너뜀 | [v3 §2](verification-v3.md#2-re-verified-items-all-non-verified-items-from-v2) (NEW-01과 함께 VERIFIED), [v3 §1](verification-v3.md#1-suite-results-fresh-runs) |
| BUG-03 | #43 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status), [v3 §3](verification-v3.md) (`[200,409,409,409]`, 답변 1건) |
| BUG-04 | #43 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status) (스펙 L/D) |
| BUG-05 | #48, #60 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status), [v3 §3](verification-v3.md) (배포 1440·360) |
| BUG-06 | #39, #40, #48 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status), [v3 §1](verification-v3.md#1-suite-results-fresh-runs) (배포 무음 워커 스펙) |
| BUG-07 | #58 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status) (워커 무음 스펙 L/D, 토스트 1회) |
| BUG-08 | #54 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status), [v3 §3](verification-v3.md) (배포 426 ms / 503 ms) |
| BUG-09 | #43, #50 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status) ("이미 답한 질문이에요" 토스트) |
| BUG-10 | #50, #65 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status), [v2 §1](verification-v2.md#1-suite-results) |
| BUG-11 | #58 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status), [v2 §1](verification-v2.md#1-suite-results) |
| BUG-12 | #58 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status), [v2 §1](verification-v2.md#1-suite-results) |
| BUG-13 | #50, #78 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status), [v3 §3](verification-v3.md) (다시 찾아온 고객의 배지) |
| BUG-14 | #47, #52 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status) (관리자·위젯 API 400 한국어 오류) |
| BUG-15 | #47 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status) (스펙 L/D) |
| BUG-16 | #54 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status), [v3 §3](verification-v3.md) (운영 `frame-ancestors`에 localhost 없음) |
| BUG-17 | #52 | PASS | skipped by design | [v2 §2](verification-v2.md#2-per-item-status) (로컬 `[401×5, 429]`). 배포에서 돌리면 QA 러너 IP가 5분 동안 막혀서 스펙이 건너뜀 |
| BUG-18 | #58, #65 | PASS | PASS | [v2 §2](verification-v2.md#2-per-item-status) (스펙 L/D) |
| 만료 토큰 → 401 | #98, #109 | PASS | PASS | `security-api.spec.ts` "서명은 맞지만 만료된 대화 토큰과 관리자 쿠키는 401". 배포는 `.env.cloud`의 CLOUD_* 비밀값으로 돈다 |
| `replace_recording_issues` 가드 | #88, #109 | PASS | PASS | `admin-flow.spec.ts` "replace_recording_issues는 반영 완료한 이슈가 있으면…". 배포는 클라우드 service role로 RPC를 직접 불러 마이그레이션 적용을 확인한다 |

## Bugs

심각도: **blocker** = 핵심 흐름을 막음 · **major** = 데이터가 틀리거나 핵심 기능이 약속대로 동작하지 않음 · **minor** = 불편·문구·보조 기능

### BUG-01 — 업로드 "다시 보내기"가 녹화를 새로 만들어 고아 녹화가 남는다 (major)
- 재현: 위젯에서 녹화 → signed upload URL(`/storage/v1/object/upload/sign/`) 요청을 실패시킴 → "다시 보내기" 표시 → 네트워크 복구 후 "다시 보내기".
- 기대: 같은 녹화(recordingId)에 이어서 올리고 대화에 녹화 1건.
- 실제: DB에 녹화 2건(`uploading` 1 + `uploaded` 1). 관리자 목록 "녹화 2개", 분석 패널 1/2는 영원히 "고객이 영상을 올리고 있어요". (로컬·배포 모두)
- 근거: `widget-recording.spec.ts` "다시 보내면 녹화가 하나만 남는다", `*-rec-06-admin-after-retry.png`
- 의심 위치: `src/hooks/use-widget-recording.ts:99-120`(`runUpload`가 매번 `uploadRecording` 전체를 다시 호출, `RecordingUploadError.recordingId`를 116행에서 버림), `src/lib/recording/upload-recording.ts:105`(항상 `POST /api/recordings`).

### BUG-02 — 업로드 중 새로고침/이탈하면 'uploading' 녹화가 영원히 남는다 (major)
- 재현: 녹화 → 끝내기 → "보내는 중 n%" 동안 새로고침.
- 기대: 버려진 업로드는 정리되거나(시간 초과 → failed), 관리자에 "업로드 중단"으로 보임. 고객에게도 흔적/재시도 제공.
- 실제: 위젯에는 아무 흔적이 없고, 관리자 분석 패널은 "고객이 영상을 올리고 있어요. 잠시만 기다려 주세요"에 영구히 머문다. 목록의 녹화 수에도 포함.
- 근거: `widget-recording.spec.ts` "업로드 중 새로고침하면", `*-rec-08-admin-orphan.png`
- 의심 위치: `src/app/api/recordings/route.ts:34-48`(녹화 행을 업로드 전에 만듦, 만료 처리 없음), `src/lib/feedback/feedback-repository.ts:180-184`(상태 무관하게 모든 녹화 노출), `src/components/admin/RecordingAnalysisPanel.tsx:84-86`.

### BUG-03 — 같은 질문에 동시에 답하면 답변·메시지가 여러 개 저장된다 (major)
- 재현: 승인된 카드에 같은 토큰으로 `POST /api/clarifications/{cardId}/answer` 4개를 동시에 보냄.
- 기대: 1건만 200, 나머지 409. 답변 1건, 고객 메시지 1건.
- 실제: 로컬 4건 모두 200 → 답변 4건·메시지 4건. 배포 `[409,200,409,200]` → 답변 2건·메시지 2건.
- 근거: `security-api.spec.ts` "동시에 두 번 답해도"
- 의심 위치: `src/app/api/clarifications/[cardId]/answer/route.ts:30-47` — `answered_at` 확인 후 insert/update가 원자적이지 않음(승인 라우트처럼 `.is("answered_at", null)` 조건부 update를 먼저 해야 함, cf. `approve/route.ts:40-52`).

### BUG-04 — 반영 완료한 이슈가 고객의 늦은 답변으로 '답변 받음'으로 되돌아간다 (major)
- 재현: 애매한 이슈 질문 승인(status=asked) → 관리자가 "반영 완료로 바꾸기"(resolved) → 고객이 그 질문 카드에 답변.
- 기대: 이슈는 resolved 유지(답변은 기록만).
- 실제: issues.status가 `answered`로 바뀌어 "반영 완료" 표시가 사라지고 목록의 "남은 문제"로 다시 셈. 로컬·배포 모두.
- 근거: `admin-flow.spec.ts` "늦게 답해도 '반영 완료'로 남는다"
- 의심 위치: `src/app/api/clarifications/[cardId]/answer/route.ts:47`(조건 없이 `status: "answered"`).

### BUG-05 — 재확인 흐름이 연결돼 있지 않다: 안내만 있고 이슈에 연결된 재확인 녹화를 시작할 수 없다 (major)
- 재현: 관리자 "반영 완료로 바꾸기" → 위젯에 "‘…’ 수정을 반영했어요. 같은 화면에서 한 번 더 확인해 주세요." → 위젯에서 녹화.
- 기대: 안내에 "다시 확인하기(녹화)" 동작이 있고, 그 녹화가 `recordings.reverify_issue_id`로 이슈에 연결되며 이슈는 `reverify` 상태.
- 실제: 안내는 회색 시스템 문구뿐(버튼 0개). 일반 녹화로만 올라가며 `reverify_issue_id`는 항상 null. `reverify` 상태를 설정하는 코드가 없음.
- 근거: `admin-flow.spec.ts` "재확인 녹화를 시작할 수 있다", `*-admin-09-widget-reverify-prompt.png`
- 의심 위치: `src/lib/recording/upload-recording.ts:105-116`(`reverifyIssueId`를 보내지 않음), `src/components/widget/MessageBubble.tsx:7-9`(system 메시지는 문구만), `src/app/api/admin/issues/[issueId]/route.ts:32-40`(`resolved`만 설정, 이슈 id를 메시지에 남기지 않음).

### BUG-06 — 관리자 분석 실패 화면에 실패 이유(무음 안내 포함)가 보이지 않는다 (major)
- 재현: 무음 마이크로 녹화(또는 `status=failed, error=…` 녹화) → 관리자에서 그 대화 열기.
- 기대: "목소리가 녹음되지 않았어요. 크롬에서 고른 마이크를 확인해 주세요"가 보이고, 이 경우 "다시 정리하기"보다 고객에게 다시 녹화를 요청하라는 안내.
- 실제: "말한 내용을 정리하지 못했어요 / 영상은 안전하게 받아 두었어요. 다시 정리하면 보통 1분 안에 끝나요"만 표시. 이유는 API 응답(`recordings[].error`)에 있지만 렌더되지 않음. 무음은 재분석해도 다시 실패하므로 안내가 오히려 잘못된 행동을 권함.
- 근거: `worker-analysis.spec.ts` 무음(로컬·배포 워커 모두 error 저장 확인), `admin-flow.spec.ts` "분석 중·실패", `*-wrk-01-admin-failed.png`
- 의심 위치: `src/components/admin/RecordingAnalysisPanel.tsx:90-91`(`<AnalysisFailed recordingId>`만 넘김), `:145-181`.

### BUG-07 — 녹화 중 무음 경고 토스트가 화면에 그려지지 않는다 (major)
- 재현: 무음 오디오(`--use-file-for-fake-audio-capture=<무음.wav>`)로 녹화 시작 → 4초 이상 대기.
- 기대: "목소리가 들리지 않아요. 주소창의 마이크 아이콘에서 마이크를 바꿔 주세요" 토스트가 녹화 중에 보임.
- 실제: 녹화 중 위젯은 알약(`RecordingPill`)만 렌더해 토스트 영역이 없음. 3초 타이머가 끝나 끝낸 뒤에도 보이지 않는다. 결국 무음 녹화가 그대로 업로드되고 분석이 실패(BUG-06).
- 근거: `worker-analysis.spec.ts` 무음 — `silent toast while recording=0`(로컬·배포), `*-wrk-01-silent-during-recording.png`
- 의심 위치: `src/components/widget/WidgetApp.tsx:119-128`(phase≠idle이면 `WidgetToast` 없이 반환), `src/hooks/use-widget-recording.ts:185-189`.

### BUG-08 — 배포에서 실시간 왕복이 2초 기준을 넘는다(함수 리전이 DB와 대륙이 다름) (major)
- 재현: 배포 위젯에서 메시지 전송 → 관리자 화면에 나타날 때까지 측정.
- 기대: 2초 안(AC2, 로컬은 0.14초).
- 실제: 고객→관리자 1.37–2.36초, 관리자→고객 1.95–1.97초. `widget-chat` "2초 안에" 배포 4/4 실패. 관리자 대화 상세 API도 평균 3.0초(5회), 1회는 15초 넘게 스켈레톤.
- 원인 근거: 응답 헤더 `x-vercel-id: icn1::iad1::…` → 함수가 미국 동부(iad1)에서 실행되고 Supabase는 서울. 메시지 1건에 토큰 확인 select → insert → select → update → 신호 2건 → 클라이언트 재조회까지 직렬 왕복이 많다.
- 의심 위치: `vercel.json:1-4`(`regions` 미지정 → `icn1` 고정 필요), `src/lib/feedback/feedback-repository.ts:261-300`(`insertMessage`가 select-then-update 3회 직렬), `src/hooks/use-widget-conversation.ts:190-191`(전송 후 전체 재조회).

### BUG-09 — 이미 답한 질문(409)에 다시 답하면 '연결 불안정' 토스트가 뜨고 카드가 그대로 남는다 (minor)
- 재현: 같은 사용자로 위젯 탭 2개 → 탭 A에서 답변 → 탭 B(아직 갱신 전)에서 다른 보기로 답변.
- 기대: "이미 답한 질문이에요" 안내 + 카드가 "답변을 보냈어요"로 바뀜.
- 실제: 서버는 409 "이미 답한 질문이에요."를 주지만 위젯은 "연결이 잠깐 불안정해요. 잠시 후 다시 해볼까요?"를 띄우고 카드는 계속 답변 가능 상태(다시 눌러도 같은 토스트). 다음 신호/15초 재조회 전까지 유지.
- 근거: `admin-flow.spec.ts` "409를 알아듣게 안내", `*-admin-08-widget-409.png`
- 의심 위치: `src/components/widget/WidgetApp.tsx:107-113`(모든 오류를 NETWORK_ERROR_MESSAGE로), `src/hooks/use-widget-conversation.ts:200-206`(실패 시 refetch 안 함).

### BUG-10 — 메시지 전송이 실패하면 고객이 쓴 글이 사라진다 (major)
- 재현: `POST /api/messages`가 실패하는 상태에서 글을 쓰고 Enter.
- 기대: 실패한 말풍선을 "다시 보내기"와 함께 남기거나, 입력창에 글을 되돌림.
- 실제: 입력창은 즉시 비워지고, 회색 대기 말풍선도 실패 후 제거됨 → 토스트만 남고 글은 사라짐(로컬·배포).
- 근거: `widget-chat.spec.ts` "전송이 실패하면 쓴 내용이 사라지지 않는다", `*-chat-06-send-failed.png`
- 의심 위치: `src/components/widget/WidgetComposer.tsx:34-35`(전송 전에 `setText("")`), `src/components/widget/WidgetApp.tsx:99-105`(`finally`에서 대기 말풍선 제거).

### BUG-11 — 업로드 실패 카드가 분석 실패 문구("정리하지 못했어요")를 쓴다 (minor)
- 재현: 업로드 실패(BUG-01 재현 1단계).
- 기대: "보내지 못했어요" 류의 전송 실패 문구 + 다시 보내기.
- 실제: "화면 녹화 · 0:02 / 정리하지 못했어요 / 다시 보내기". 분석 실패와 같은 문구라 원인을 오해하게 한다.
- 근거: `widget-recording.spec.ts` "업로드 실패 카드는…", `*-rec-06-upload-failed.png`
- 의심 위치: `src/components/widget/MessageList.tsx:117`(`isFailed` → status `"failed"`), `src/components/widget/RecordingMessage.tsx:23-24`.

### BUG-12 — 녹화를 취소(올리지 않고 버리기)할 방법이 없다 (minor)
- 재현: 녹화 시작 → 알약 확인.
- 기대: "취소" 등으로 업로드 없이 끝낼 수 있음(잘못 시작한 녹화, 민감 화면 노출 시).
- 실제: 버튼은 "끝내기" 하나이며 항상 업로드한다.
- 근거: `widget-recording.spec.ts` "취소 버튼이 있다" — `["끝내기"]`
- 의심 위치: `src/components/widget/RecordingPill.tsx:14-16`, `src/hooks/use-widget-recording.ts:122-155`(stop = 항상 업로드).

### BUG-13 — 새로고침하면 안 읽은 답장 배지가 사라진다 (minor)
- 재현: 위젯을 닫은 채 관리자가 답장 → 런처 "새 답장 1개" → 페이지 새로고침.
- 기대: 배지 1 유지.
- 실제: 배지 0("피드백 보내기"). 위젯이 닫혀 있어도 15초 재조회 `GET /api/messages`가 서버의 `user_unread_count`를 0으로 만들고, 위젯은 그 값을 쓰지도 않는다.
- 근거: `widget-chat.spec.ts` "새로고침해도 배지가 유지된다", `*-chat-07-badge-after-reload.png`
- 의심 위치: `src/hooks/use-widget-conversation.ts:123-134`(첫 적용 때 `seenIds`가 null이라 안 읽음 계산 생략), `src/app/api/messages/route.ts:14`(조회만으로 안 읽음 0).

### BUG-14 — 관리자 답장 2000자 초과 시 입력 제한이 없고 영어 zod 오류가 그대로 보인다 (minor)
- 재현: 관리자 답장 칸에 2050자 입력 → 보내기.
- 기대: 위젯처럼 2000자에서 막히거나 "2000자까지 보낼 수 있어요" 같은 안내.
- 실제: 2050자 입력됨, 오류 문구 "body: Too big: expected string to have <=2000 characters".
- 근거: `admin-flow.spec.ts` "2000자를 넘으면", `*-admin-04-long-reply.png`
- 의심 위치: `src/components/admin/ReplyComposer.tsx:65-77`(`maxLength` 없음), `src/lib/http/api-response.ts:16-19`(zod 원문 노출).

### BUG-15 — 관리자 대화의 말풍선이 띄어쓰기 없는 긴 글/URL을 줄바꿈하지 않아 잘린다 (minor)
- 재현: 고객이 공백 없는 긴 글(또는 긴 URL)을 보냄 → 관리자 1280/1440에서 대화 열기.
- 기대: 말풍선 안에서 줄바꿈(위젯은 정상).
- 실제: 말풍선이 열 너비를 넘어 오른쪽이 잘림(`ThreadMessage row` scrollWidth > clientWidth).
- 근거: `admin-flow.spec.ts` "1280px/1440px", `*-admin-10-layout-1280.png`
- 의심 위치: `src/components/admin/ThreadMessage.module.css:22-29`(`.bubble`에 `overflow-wrap: anywhere` 없음).

### BUG-16 — 운영 허용 목록에 localhost가 남아 있다 (minor, 보안)
- 재현: `curl -I 'https://lattice-feedback-sdk.vercel.app/widget?projectKey=lattice-demo'`.
- 기대: `frame-ancestors https://lattice-feedback-demo.vercel.app`만.
- 실제: `frame-ancestors https://lattice-feedback-demo.vercel.app http://localhost:3001 http://127.0.0.1:3001`. 누구든 자기 PC의 3001 포트 페이지에서 운영 위젯을 띄우고 `POST /api/conversations`로 운영 DB에 대화를 만들 수 있다.
- 근거: `security-api.spec.ts` CSP(배포 실패)
- 의심 위치: 클라우드 `projects.allowed_origins` 데이터(운영 설정), 노출 지점 `src/proxy.ts:34`.

### BUG-17 — 관리자 로그인에 시도 제한이 없다 (minor, 보안)
- 재현: `POST /api/admin/session`에 틀린 비밀번호 15회 연속.
- 기대: 일정 횟수 후 429/지연.
- 실제: 15회 모두 401, 제한 없음. 공유 비밀번호 하나로 운영 관리자 전체가 열린다.
- 근거: `security-api.spec.ts` "시도 제한(429)"
- 의심 위치: `src/app/api/admin/session/route.ts:8-15`.

### BUG-18 — 녹화 중 새로고침/탭 닫기에 경고가 없어 녹화가 조용히 사라진다 (minor)
- 재현: 녹화 시작 → 2초 뒤 새로고침.
- 기대: `beforeunload` 확인 또는 다시 열었을 때 "녹화가 중단됐어요" 안내.
- 실제: 확인 창 없음, 위젯은 빈 상태로 돌아오고 DB에도 흔적 없음(복구는 정상).
- 근거: `widget-recording.spec.ts` "녹화 중 새로고침하면" — `beforeunload dialog=false, recordings=[]`, `*-rec-07-refresh-mid-recording.png`
- 의심 위치: `src/hooks/use-widget-recording.ts:158-198`(`beforeunload`/`pagehide` 처리 없음 — `grep beforeunload src` 0건).

## 정리 기록

- 모든 스펙의 `afterAll`이 `qa-*` 사용자(→ 대화·메시지·녹화·이슈·질문 카드 cascade)와 녹화 Storage 파일(`recordings/<id>/…`, `frames/…`)을 지운다.
- 마지막 확인(2026-11-12 01:45 KST): **로컬** `qa-` 사용자 0건·녹화 0건, **클라우드** `qa-` 사용자 0건·녹화 0건.
- 클라우드 DB에서는 김데모(`u_1024`) 등 기존 데이터를 건드리지 않았다. 기존 데이터를 바꾸는 시험은 모두 QA 사용자로만 돌렸다.
- 로컬 `npm run db:reset`: 실행 안 함.
- 비허용 origin 시험용 호스트(127.0.0.1:3005)는 이제 스펙 안에서 띄우고 닫는다. 임시로 띄운 python 서버는 종료했다.
