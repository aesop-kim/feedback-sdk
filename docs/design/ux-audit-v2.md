# UX 감사 v2 (위젯 + 관리자)

- 작성일: 2026-11-12
- 기준: `docs/design/tds-reference.md`(TDS), `docs/design/review-log.md`(Round 1·2 반영 뒤 상태), WCAG 2.2 AA
- 화면 근거: `.screens/qa-v2/ux/*.png` (68장). Playwright(저장소의 `@playwright/test` chromium, 가짜 미디어 플래그)로 직접 찍었다.
  - 위젯: 1440×900, 360×740(DPR 2, 터치)
  - 관리자: 1440×900, 1280×800
  - 데이터: `npx tsx scripts/seed-admin-preview.ts`로 김데모(분석 끝남 + 질문 초안) / 박지훈(정리 중) / 최유나(정리 실패) / 이수진(채팅만)을 넣었다. 위젯 쪽 고객은 `window.DEMO_USER`를 init script로 바꿔 `demo-user-0142`(김데모)와 새 사용자(`ux_audit_*`, 빈 상태용)로 열었다.
  - 업로드 중/실패는 `/api/recordings` POST를 지연·중단시켜 만들었다. 메시지 전송 실패 토스트는 `/api/messages` POST를 중단시켜 만들었다. 관리자 빈 목록은 `/api/admin/conversations` 응답에서 `conversations`만 비워서 만들었다(DB를 비우지 않으려고).
- 직접 찍지 못한 상태(코드로 판단): 마이크·화면 공유 거부 토스트(가짜 UI 플래그가 자동 허용), 위젯 초기화 실패 화면, 관리자 대화 로딩 스켈레톤.
- 찍는 동안 다른 QA 작업이 같은 DB에 `QAchat-*` 대화를 넣고 있어서, 일부 목록 캡처에 그 행이 섞여 있다.
- 범위 밖: `src/` 아래는 고치지 않았다. 아래 수정안은 모두 제안이다.

## 요약

| ID | 심각도 | 한 줄 요약 |
|---|---|---|
| UX-01 | major | 메시지 전송이 실패하면 쓴 글이 사라진다 |
| UX-02 | major | 업로드 실패가 "정리하지 못했어요"로 보이고, 토스트와 말이 다르다 |
| UX-03 | major | 분석 실패가 고객에게 빨간 오류로 보이고 할 수 있는 일이 없다 |
| UX-04 | major | 재확인 요청이 회색 안내문뿐이고 행동할 버튼이 없다(`reverifyIssueId`를 쓰는 곳이 없음) |
| UX-05 | major | 위젯 키보드: 열어도 포커스가 안 들어가고, Escape로 안 닫히고, 닫으면 포커스를 잃는다 |
| UX-06 | major | 글자 대비가 4.5:1에 못 미치는 토큰 조합이 많다(말풍선, 주 버튼, 시각, 오류, 배지) |
| UX-07 | major | 관리자: 정리 중이거나 실패한 녹화는 영상을 볼 수 없다 |
| UX-08 | major | 관리자: 고정(sticky) 플레이어가 분석 칸의 절반을 차지해 질문 초안 제목이 가려진다(1280×800) |
| UX-09 | major | 관리자: "반영 완료"가 되돌릴 수 없고, 고객에게 메시지가 간다는 말도 없다 |
| UX-10 | major | 위젯 초기화 오류 화면에 다시 시도할 방법이 없다 |
| UX-11 | minor | 위젯 터치 영역 44px 미만: 닫기 40, 보내기 36, 다시 보내기 32, 끝내기 36, 답변 보내기 38 |
| UX-12 | minor | 위젯 입력창에 포커스 표시가 없다. 관리자 입력창도 1px 테두리뿐이다 |
| UX-13 | minor | 질문 카드 보기(radio)가 방향키로 움직이지 않는다 |
| UX-14 | minor | "답변 보내기"를 누른 뒤 로딩 표시가 없다 |
| UX-15 | minor | 새 답장이 스크린리더에 읽히지 않는다(live region 없음) |
| UX-16 | minor | 관리자 질문 초안 미리보기에 고객이 실제로 보는 "직접 입력할게요"가 없고, 승인 결과 피드백이 약하다 |
| UX-17 | minor | 반영 완료로 바꾸면 고객 답변이 이슈에서 사라진다 |
| UX-18 | minor | 관리자 빈 목록 화면이 "왼쪽에서 고르세요"라고 말하고, 설치 안내가 없다 |
| UX-19 | minor | 이름이 같은 고객 대화가 목록에서 구분되지 않는다 |
| UX-20 | minor | 마이크·화면 공유 거부 토스트에 해결 방법이 없다 |
| UX-21 | minor | 녹화 알약에 "취소" 방법과 마이크 상태 표시가 없다 |
| UX-22 | minor | `prefers-reduced-motion` 전역 규칙이 무한 스켈레톤을 1ms 깜빡임으로 만든다 |
| UX-23 | minor | 위젯 헤더 인사말이 대화 중에도 큰 글씨로 두 줄 높이를 차지한다(360 폭) |
| UX-24 | polish | 문구 겹침("알려주세요" 두 번)과 띄어쓰기 불일치 |
| UX-25 | polish | 상태 배지 말투가 섞여 있고, "의견/대화" 이름이 섞여 있다 |
| UX-26 | polish | 토큰 밖 값: 11px 글자, 한 줄 토스트 반경 |
| UX-27 | polish | 답한 뒤 칩이 "래티스" 쪽 말풍선에서 "답변을 보냈어요"라고 말한다 |
| UX-28 | polish | 장면 확대 토글이 `aria-pressed`와 바뀌는 라벨을 함께 써서 뜻이 꼬인다 |
| UX-29 | polish | 관리자 목록/이슈 줄에 눌림 반응이 없고, 페이저 눌림 시간이 빠져 있다 |

---

## Major

### UX-01 메시지 전송이 실패하면 쓴 글이 사라진다 (major)
- 화면: `.screens/qa-v2/ux/widget-360-11-toast-send-failed.png`, `widget-1440-11-toast-send-failed.png`
- 문제: 보내기를 누르면 입력창을 비우고 임시 말풍선을 띄운다. 실패하면 임시 말풍선을 지우고 토스트만 3초 띄운다(`src/components/widget/WidgetApp.tsx:99-105`). 결과적으로 고객이 쓴 문장이 어디에도 남지 않는다. 토스트는 "잠시 후 다시 해볼까요?"라고 말하지만 다시 보낼 글이 없다. 버그를 설명하려고 길게 쓴 사람일수록 손해가 크다.
- 수정:
  - `PendingText`에 `isFailed: boolean`을 넣고, 실패하면 지우지 말고 `isFailed: true`로 남긴다(`WidgetApp.tsx:103-104`의 `.finally`를 `.then(remove)` / `.catch(markFailed)`로 나눈다).
  - `MessageBubble`의 실패 말풍선 아래에 오른쪽 정렬 줄을 단다: 빨간 글자 "보내지 못했어요" + 텍스트 버튼 "다시 보내기"(44px 높이). 다시 보내기는 같은 `localId`로 `sendText`를 다시 부른다.
  - 토스트 문구: "메시지를 보내지 못했어요. 말풍선 아래 ‘다시 보내기’를 눌러 주세요"
  - `MessageBubble.module.css:39-41`의 `[data-pending]` 옆에 `[data-failed="true"] { opacity: 1; background: var(--grey-100); color: var(--text-primary); }` 같은 실패 모양을 둔다(파란 면은 "보냄"으로 읽힌다).

### UX-02 업로드 실패가 "정리하지 못했어요"로 보이고, 토스트와 말이 다르다 (major)
- 화면: `widget-360-05c-upload-failed.png`, `widget-1440-05b-upload-failed-toast.png`
- 문제: 업로드가 실패하면 `MessageList.tsx:117`이 `status="failed"`를 넘기고, `RecordingMessage.tsx:23-24`는 이것을 분석 실패 문구 "정리하지 못했어요"로 보여 준다. 실제로는 영상이 서버에 가지도 않았다. 같은 순간 토스트는 "연결이 잠깐 불안정해요…"(`use-widget-recording.ts:18`)라고 해서 원인을 두 가지로 말한다. 360 폭에서는 "다시 보내기" 버튼이 글을 밀어서 제목이 "화면 녹화 ·" / "0:02", 상태가 "정리하지" / "못했어요"로 끊긴다.
- 수정:
  - `RecordingMessage`에 업로드 실패를 따로 넘긴다: `status: RecordingStatus | "upload_failed"`, 문구는 **"보내지 못했어요"**. `MessageList.tsx:117`은 `pendingUpload.isFailed ? "upload_failed" : "uploading"`.
  - 업로드 실패 토스트(`use-widget-recording.ts:18`): **"녹화를 보내지 못했어요. ‘다시 보내기’를 눌러 주세요"**
  - 배치: 다시 보내기 버튼을 카드 오른쪽이 아니라 글 아래 줄로 내린다. `RecordingMessage.module.css:6-15`의 `.card`를 `flex-wrap: wrap`으로 두고 버튼에 `flex-basis: 100%`를 준다. 버튼 높이는 UX-11대로 44px.

### UX-03 분석 실패가 고객에게 빨간 오류로 보이고 할 수 있는 일이 없다 (major)
- 화면: 코드 판단(관리자 쪽은 `admin-1440-08-failed.png`). 같은 데이터가 위젯에서는 `RecordingMessage.tsx:23-24` 문구 + `RecordingMessage.module.css:54-56` 빨간 글자로 나간다.
- 문제: 분석은 우리 쪽 내부 작업이다. 영상은 이미 받았고 관리자가 다시 정리할 수 있다(`RecordingAnalysisPanel.tsx:145-181`). 그런데 고객은 빨간 "정리하지 못했어요"를 보고, 다시 녹화해야 하는지 알 수 없다. 버튼도 없다.
- 수정: 위젯에서는 분석 실패를 고객 일로 보이지 않게 한다. `getStatusText`의 `"failed"`를 **"받았어요. 담당자가 직접 볼게요"**로 바꾸고, 빨간 색 규칙(`RecordingMessage.module.css:54-56`)은 업로드 실패(UX-02)에만 남긴다.

### UX-04 재확인 요청이 회색 안내문뿐이고 행동할 버튼이 없다 (major)
- 화면: `widget-360-10-reverify-prompt.png`, `widget-1440-10-reverify-prompt.png`, `admin-1440-12-resolved.png`
- 문제: 관리자가 반영 완료를 누르면 서버가 시스템 메시지 "‘{제목}’ 수정을 반영했어요. 같은 화면에서 한 번 더 확인해 주세요."를 넣는다(`src/app/api/admin/issues/[issueId]/route.ts:34-40`). 위젯은 모든 시스템 메시지를 가운데 13px 회색 캡션으로 그린다(`MessageBubble.tsx:7-9`, `MessageBubble.module.css:49-55`). 그래서 이 흐름의 마지막 단계가 가장 약하게 보이고, 누를 것이 없다. 서버는 `reverifyIssueId`를 받을 준비가 되어 있는데(`src/app/api/recordings/route.ts:22-45`, `api-schemas.ts:31`) 위젯 어디에서도 보내지 않는다. 그래서 관리자의 "다시 확인 중" 배지(`IssueItem.tsx:31-32`)로 갈 길이 없다.
- 수정:
  - 메시지에 `type: "reverify"`와 `issueId`를 싣는다(route.ts:34-40에서 `type: "system"` 대신).
  - 위젯에 `ReverifyCard`를 둔다: 제목 **"고쳤어요. 한 번 확인해 주세요"**, 본문 **"‘{제목}’"**, 버튼 두 개: 주 버튼(large, 48px) **"화면 녹화로 확인하기"**는 `startRecording({ reverifyIssueId })`를 부르고, 보조 텍스트 버튼은 **"잘 고쳐졌어요"**(TDS 규칙대로 "취소" 대신 행동형). 모양은 질문 카드와 같은 카드(`ClarificationCard.module.css:2-7`)를 쓴다.
  - 이 메시지가 오면 런처 배지(안 읽음 수)도 올린다.

### UX-05 위젯 키보드: 열어도 포커스가 안 들어가고, Escape로 안 닫히고, 닫으면 포커스를 잃는다 (major)
- 화면: `widget-1440-02d-after-escape.png`(Escape를 눌러도 그대로 열려 있음), `widget-1440-02c-recording-button-focus.png`
- 문제: 런처 클릭은 iframe을 보이게만 하고 포커스는 런처에 그대로 둔다(`src/sdk/index.ts:92-96`). 키보드 사용자는 Tab으로 고객사 페이지 전체를 지나야 위젯에 닿는다. iframe 안이나 호스트 어디에도 Escape 처리가 없다. 위젯 안 닫기(`WidgetApp.tsx:93-96`)를 누르면 iframe이 `visibility: hidden`이 되면서 포커스가 사라지고 `body`로 돌아간다.
- 수정:
  - `WidgetApp.tsx`: `host:visibility` open을 받으면 `requestAnimationFrame(() => textareaRef.focus())`(빈 상태면 "화면 녹화로 설명하기" 버튼). Composer에 `ref`를 전달한다.
  - `WidgetApp.tsx`: `useEffect`로 `keydown`에서 `Escape`이면 `handleClose()`. 녹화 중에는 무시한다.
  - `src/sdk/index.ts`: `applyMode("closed")`가 `widget:mode`로 왔을 때 `launcher.focus()`. 런처에 `aria-controls`로 iframe id를 연결한다.
  - 호스트 페이지에서 iframe 바깥에 포커스가 있을 때의 Escape도 `index.ts`에서 받아 닫는다.

### UX-06 글자 대비가 4.5:1에 못 미치는 토큰 조합이 많다 (major)
- 화면: `widget-1440-02-empty.png`(힌트), `widget-360-03-chatting.png`(시각), `admin-1440-04-list.png`(시각·메타), `admin-1440-07-analyzed.png`(배지), `admin-1440-02-login-error.png`(오류)
- 실제 토큰으로 계산한 값(WCAG 상대 휘도):

| 조합 | 대비 | 쓰는 곳 |
|---|---|---|
| grey-400 `#b0b8c1` / 흰색 | **2.01** | 단계 번호 `WidgetEmptyState.module.css:51`, 이슈 번호 `IssueItem.module.css:33` |
| grey-500 `#8b95a1` / 흰색 | **3.04** | 위젯 시각 `MessageList.module.css:27`, 빈 화면 힌트 `WidgetEmptyState.module.css:95`, 관리자 시각 `ConversationList.module.css:86`·`ThreadMessage.module.css:48`, 메타 줄 `ConversationList.module.css:124`, 개수 `ConversationList.module.css:30`, 외부 ID·활동 `ConversationThread.module.css:41,50`, 답장 힌트 `ReplyComposer.module.css:49`, URL `RecordingPlayer.module.css:97` |
| grey-500 / grey-50 | **2.91** | 질문 초안 캡션 `ClarificationDraft.module.css:27` |
| grey-500 / grey-100 | **2.76** | 입력창 placeholder(위젯·관리자) |
| grey-600 / grey-100 | **4.19** | 녹화 카드 상태 `RecordingMessage.module.css:50`(카드 면이 grey-100), 회색 배지 `IssueItem.module.css:78` |
| 흰색 / blue-500 | **3.71** | 고객 말풍선 `MessageBubble.module.css:34-35`, 관리자 말풍선 `ThreadMessage.module.css:38-39` |
| white 90% / blue-500 | **3.29** | 주 버튼 `WidgetEmptyState.module.css:69-70`, `ClarificationCard.module.css:182-183`, `AdminButton.module.css:49-52` |
| red-500 / 흰색 | **3.71** | 모든 오류 글자: `AdminLoginForm.module.css:70`, `RecordingAnalysisPanel.module.css:132`, `ReplyComposer.module.css:53`, `ClarificationDraft.module.css:151`, `IssueItem.module.css:237`, `RecordingMessage.module.css:55`, `ThreadMessage.module.css:126` |
| orange-700 / orange-50 | **2.53** | "확인 필요" 배지 `IssueItem.module.css:81-84` |
| green-700 / green-50 | **3.70** | "답변 받음" 배지 `IssueItem.module.css:91-94` |
| green-700 / 흰색 | **3.95** | "고객 답변" 라벨 `IssueItem.module.css:201`, `ThreadMessage.module.css:174` |
| blue-600 / blue-50 | **4.00** | "물어봤어요" 배지 `IssueItem.module.css:86-89` |
| blue-600 / weak 면 | **3.97**(흰 바탕), **3.65**(grey-100 위) | weak 버튼 `AdminButton.module.css:62-65`, 다시 보내기 `RecordingMessage.module.css:80-81` |

- 왜 중요한가: 시각·힌트·오류·상태 배지는 모두 "지금 무슨 일이 있는지" 알려 주는 글이다. 12~13px라서 큰 글자 예외(18.66px 굵게)도 받지 못한다. 특히 고객이 자기가 쓴 글을 읽는 말풍선 본문(15px 보통)이 3.71이다.
- 수정(`src/styles/tokens.css`):
  - `--text-placeholder`는 진짜 placeholder에만 쓴다. 정보 글자(시각, 힌트, 메타, 개수, URL, 캡션)는 `--text-tertiary`(grey-600, 4.62)로 바꾼다. grey-100 면 위 글자는 `--grey-700`(6.45).
  - 단계 번호·이슈 번호: `--grey-400` → `--grey-600`(장식이 아니라 순서 정보다).
  - 새 토큰 `--text-danger: var(--red-700);`(5.26) 를 만들고 위 오류 글자 7곳에 쓴다. 테두리·점 같은 비글자 표시는 red-500 그대로.
  - 배지: `.pillGreen{color:var(--green-900)}`(5.35), `.pillBlue{color:var(--blue-700)}`(4.82), `.pillGrey{color:var(--grey-700)}`. 주황은 TDS 단계로 4.5를 못 넘으므로(orange-900도 3.40) `.pillOrange{background:var(--orange-50);color:var(--grey-800)}` + 앞에 6px `--orange-500` 점(요약 줄과 같은 방식).
  - "고객 답변" 라벨: `--green-800`(4.75).
  - weak 버튼 글자: `--blue-700`(4.71).
  - 파란 면 위 흰 글자: 흰색 알파(`--white-alpha-900`)를 쓰지 말고 `#fff`로. 말풍선과 주 버튼 면은 `--blue-600`(4.49, 경계값) 또는 엄격히 맞추려면 `--blue-700`(5.41). 브랜드 색 결정이 필요하다. blue-500을 유지한다면 이 예외를 `tds-reference.md`에 근거와 함께 적어 둔다.

### UX-07 관리자: 정리 중이거나 실패한 녹화는 영상을 볼 수 없다 (major)
- 화면: `admin-1440-08-failed.png`, `admin-1280-06-analyzing.png`
- 문제: 실패 화면은 "영상은 안전하게 받아 두었어요"라고 말하지만 영상을 보여 주지 않는다. 정리 중에도 스켈레톤만 있다(`RecordingAnalysisPanel.tsx:84-92`). 분석이 막혔을 때 관리자가 할 수 있는 일이 "다시 정리하기" 하나뿐이고, 고객이 기다리는 동안 직접 보고 답장할 수 없다.
- 수정: `RecordingAnalysis`에서 `uploaded | analyzing | failed`일 때도 `recording.videoUrl`이 있으면 `<RecordingPlayer>`를 먼저 그리고, 그 아래에 `AnalysisPending`(스켈레톤 영상 칸은 빼고 문구 줄만) 또는 `AnalysisFailed`를 둔다. 실패 문구: **"말한 내용을 정리하지 못했어요. 영상은 위에서 바로 볼 수 있어요."**

### UX-08 관리자: 고정 플레이어가 분석 칸의 절반을 차지한다 (major)
- 화면: `admin-1280-09-clarification-draft.png`(질문 초안 제목 "고객에게 물어볼 질문"이 플레이어 밑에 잘림), `admin-1440-10-asked.png`(이슈 장면 썸네일이 플레이어 밑으로 들어감)
- 문제: `RecordingPlayer.module.css:1-8`이 플레이어 전체(16:10 영상 + 캡션, 1280에서 약 370px)를 `top: 52px`에 고정한다. 1280×800에서는 이슈 목록·초안에 쓸 높이가 약 375px밖에 없다. 질문을 고치고 승인하는 이 화면의 핵심 작업이 가장 좁은 곳에서 일어나고, 스크롤해 온 내용의 윗부분이 늘 가려진다.
- 수정: 고정을 풀고(`position: static`), 대신 이슈 장면·말한 내용 시각을 누르면 플레이어가 화면 안에 보이도록 분석 칸만 스크롤한다(`seekTo`에서 `panel.scrollTo({ top: 0, behavior })`). 고정을 유지해야 한다면 `@media (max-height: 900px) { .frame { aspect-ratio: auto; height: 180px; } }`로 줄이고, 플레이어 아래 요소에 `scroll-margin-top: <플레이어 높이>`를 준다.

### UX-09 관리자: "반영 완료"가 되돌릴 수 없고, 고객에게 메시지가 간다는 말도 없다 (major)
- 화면: `admin-1440-11-answered.png`(버튼), `admin-1440-12-resolved.png`(누른 뒤)
- 문제: "반영 완료로 바꾸기"(`IssueItem.tsx:195-197`)는 한 번 누르면 바로 고객 위젯에 메시지를 보낸다(route.ts:34-41). 버튼 주변에 그 사실이 안 적혀 있고, 확인도 되돌리기도 없다(API도 `resolved`만 받는다, `api-schemas.ts:56`). 누른 뒤 피드백은 버튼이 사라지는 것뿐이다. 실수로 누르면 고객에게 "고쳤어요"가 이미 간다.
- 수정:
  - 버튼 옆 캡션(`IssueItem.module.css` `.actions` 안, t8 grey-600): **"누르면 고객에게 다시 확인해 달라고 알려요"**
  - 성공하면 버튼 자리에 **"고객에게 확인을 부탁했어요"** + 텍스트 버튼 **"되돌리기"**를 5초 동안 둔다. 되돌리기는 메시지를 지우고 상태를 `open`으로 돌리는 API가 필요하다(`updateIssueSchema`에 `"open"` 추가). 되돌리기를 만들지 못하면, 최소한 누르기 전 확인 대화상자(TDS Dialog: 제목 "고객에게 확인을 부탁할까요?", 버튼 "부탁하기"/"닫기")를 둔다.

### UX-10 위젯 초기화 오류 화면에 다시 시도할 방법이 없다 (major)
- 화면: 코드 판단(`WidgetApp.tsx:142-147`)
- 문제: "지금은 위젯을 열 수 없어요" + 오류 문구만 있다. 입력창은 비활성(`isDisabled={!isReady}`)이라 고객이 할 수 있는 일이 닫기뿐이다. 일시적인 네트워크 문제여도 페이지를 새로 고쳐야 한다는 것을 고객은 모른다.
- 수정: 오류 화면 아래에 주 버튼(large) **"다시 불러오기"**를 두고 `conversation.refetch()`(세션까지 실패했다면 세션 생성부터 다시)를 부른다. 설명 문구: **"연결이 잠깐 끊겼어요. 다시 불러와 볼게요"**.

---

## Minor

### UX-11 위젯 터치 영역 44px 미만 (minor)
- 화면: `widget-360-05c-upload-failed.png`, `widget-360-04-recording.png`, `widget-360-08b-card-selected.png`. 360 폭에서 잰 크기: 닫기 40×40, 보내기 36×36, 다시 보내기 79×32, 끝내기 약 36 높이, 답변 보내기 268×38.
- 수정:
  - 닫기 `WidgetHeader.module.css:34-35` → `width/height: 44px; margin: -6px -4px 0 0;`
  - 보내기 `WidgetComposer.module.css:69-70`는 36px 원을 유지하되 `::before { content:""; position:absolute; inset:-4px; }`로 히트 영역을 44px로 넓힌다(`position: relative` 추가).
  - 다시 보내기 `RecordingMessage.module.css:77` → `min-height: 44px; padding: 2px var(--sp-4); border-radius: var(--r-btn-m);`
  - 끝내기 `RecordingPill.module.css:37` → `min-height: 44px; border-radius: 22px;`(알약 높이 52px 안에 들어간다)
  - 답변 보내기 `ClarificationCard.module.css:178` → `min-height: var(--h-btn-l)`(48, TDS 위젯 기준 large), `border-radius: var(--r-btn-l)`

### UX-12 입력창 포커스 표시 (minor)
- 화면: `widget-360-02b-composer-focus.png`(포커스가 있는데 아무 변화가 없음), `admin-1440-02b-login-focus-tab.png`
- 문제: 위젯 입력창은 `outline: none`(`WidgetComposer.module.css:57`)인데 감싼 `.field`(36-45행)에 `:focus-within` 스타일이 없다. 키보드 사용자는 어디에 글이 들어가는지 알 수 없다. 관리자 로그인·초안 입력은 1px 테두리 색만 바뀐다.
- 수정: `WidgetComposer.module.css`에 `.field:focus-within { box-shadow: inset 0 0 0 1.5px var(--blue-500); background: var(--bg); }`(관리자 `ReplyComposer.module.css:18-21`과 같은 규칙). `AdminLoginForm.module.css:56-59`는 `box-shadow: 0 0 0 1px var(--blue-500)`을 더해 2px로 보이게(초안 입력 `ClarificationDraft.module.css:49-53`과 맞춤).

### UX-13 질문 카드 보기가 방향키로 움직이지 않는다 (minor)
- 화면: `widget-1440-08c-card-arrowdown.png`(두 번째 보기에서 ↓를 눌러도 포커스가 그대로)
- 문제: `role="radio"` 버튼 네 개가 모두 Tab 정지점이다(`ClarificationCard.tsx:77-97`). radiogroup이라고 알려 놓고 radio 키보드 규칙(↑↓로 이동·선택, 그룹은 Tab 한 번)을 따르지 않는다.
- 수정: roving tabindex. 선택된 보기(없으면 첫 보기)만 `tabIndex={0}`, 나머지 `-1`. `onKeyDown`에서 ArrowDown/ArrowRight → 다음 보기 focus + 선택, ArrowUp/ArrowLeft → 이전, Home/End 처리.

### UX-14 "답변 보내기" 로딩 표시가 없다 (minor)
- 화면: 코드 판단(`ClarificationCard.tsx:111-113`)
- 문제: 보내는 동안 `disabled` + `aria-busy`만 걸려서 버튼이 30% 흐려지기만 한다. 고객에게는 "못 누르는 버튼"으로 보인다. 관리자 `AdminButton`에는 점 3개 로더가 있다.
- 수정: 위젯에 같은 점 로더를 쓴다. `AdminButton.tsx:26-33`의 dots 마크업·`AdminButton.module.css:91-125`를 공용 `src/components/shared/LoadingDots`로 빼고, 보내는 동안에는 `opacity` 0.3을 적용하지 않는다(`.submitButton[aria-busy="true"] { opacity: 1; }`).

### UX-15 새 답장이 스크린리더에 읽히지 않는다 (minor)
- 화면: 코드 판단(`MessageList.tsx:91`)
- 수정: `<ol ref={listRef} className={styles.list} role="log" aria-live="polite" aria-label="대화">`. 관리자 쪽 `ConversationThread.tsx:45` 스크롤 영역에도 같은 속성.

### UX-16 질문 초안 미리보기와 승인 피드백 (minor)
- 화면: `admin-1440-09-clarification-draft.png`, `admin-1440-10-asked.png`, `widget-360-08-clarification-card.png`
- 문제: 고객 카드에는 항상 "직접 입력할게요"가 붙는데(`ClarificationCard.tsx:69`) 관리자 초안에는 없다. 관리자는 보기 4개가 최대라고 보고(`ClarificationDraft.tsx:11`) 고객 화면은 5줄이 된다. 승인 뒤에는 편집기가 "고객 답변을 기다리고 있어요" 상자로 바뀌는 것 말고 성공 표시가 없다.
- 수정: 보기 목록 맨 아래에 편집할 수 없는 줄 **"직접 입력할게요 (항상 붙어요)"**를 grey-500 점선 테두리로 보여 준다. 승인 성공 뒤 대기 상자(`IssueItem.tsx:129-135`) 첫 줄에 **"고객에게 질문을 보냈어요"**를 넣는다.

### UX-17 반영 완료로 바꾸면 고객 답변이 사라진다 (minor)
- 화면: `admin-1440-12b-resolved-expanded.png`
- 문제: `IssueClarification`이 `status === "resolved"`면 아무것도 그리지 않는다(`IssueItem.tsx:116-118`). 나중에 "왜 이렇게 고쳤지?"를 볼 근거가 지워진다.
- 수정: 116행 조건에서 `|| issue.status === "resolved"`를 빼고, 답변이 있으면 resolved에서도 `.answer` 상자를 그린다(초안 편집기만 숨긴다).

### UX-18 관리자 빈 목록 화면 (minor)
- 화면: `admin-1440-03-empty-list.png`, `admin-1280-03-empty-list.png`
- 문제: 목록이 비었는데 가운데는 "왼쪽 목록에서 대화를 고르면…"이라고 말한다(`src/app/admin/(dashboard)/page.tsx:7-8`). 처음 쓰는 관리자에게 필요한 "위젯을 어떻게 붙이나"가 없다. 오른쪽 칸은 아무 내용 없는 흰 면이다.
- 수정: 대화가 0개면 가운데를 **"아직 받은 의견이 없어요"** / **"고객사 페이지에 아래 두 줄을 넣으면 위젯이 떠요"** + `sdk.js` 스니펫(복사 버튼)으로 바꾼다. 목록 칸(`ConversationList.tsx:52-56`)은 제목만 남기고 설명은 지운다(같은 말을 두 번 하지 않게).

### UX-19 이름이 같은 고객 대화가 구분되지 않는다 (minor)
- 화면: `admin-1440-04-list.png`(김데모 두 줄)
- 수정: 같은 목록에 같은 이름이 둘 이상이면 이름 옆에 이메일 앞부분이나 외부 ID를 grey-600 t7로 붙인다(`ConversationList.tsx:92`). 예: "김데모 · demo-user-0142".

### UX-20 마이크·화면 공유 거부 토스트에 해결 방법이 없다 (minor)
- 화면: 코드 판단(가짜 UI 플래그가 자동 허용해서 찍지 못함). `use-widget-recording.ts:15-16`
- 수정:
  - `SCREEN_DENIED_MESSAGE`: **"화면 공유를 시작하지 않았어요. 다시 누르고 ‘이 탭’을 골라 주세요"**
  - `MICROPHONE_DENIED_MESSAGE`: **"마이크를 쓸 수 없어요. 주소창 왼쪽 자물쇠에서 마이크를 허용해 주세요"**
  - 두 문구는 한 줄을 넘으므로 토스트 대신(3초면 다 못 읽는다) 위젯 본문 위 인라인 안내 줄로 두거나, 토스트 시간을 5초로 늘린다.

### UX-21 녹화 알약에 취소와 마이크 상태가 없다 (minor)
- 화면: `widget-360-04-recording.png`
- 문제: 녹화를 잘못 시작해도 "끝내기"뿐이라 원하지 않는 영상이 그대로 올라간다. 말로 설명하는 기능인데 소리가 들어가는지 보이지 않는다.
- 수정: `RecordingPill.tsx` 왼쪽에 아이콘 버튼(44px, `aria-label="녹화 취소하기"`)을 두고, 누르면 업로드 없이 버린다. 빨간 점 옆에 입력 음량으로 높이가 바뀌는 막대 3개(런처 파형과 같은 모양)를 둔다. 끝내기 라벨은 **"끝내고 보내기"**로 결과를 밝힌다.

### UX-22 reduced-motion 규칙이 스켈레톤을 깜빡이게 만든다 (minor)
- 화면: 코드 판단(`src/app/globals.css:45-52`)
- 문제: `animation-duration: 1ms !important`만 주면 `infinite alternate` 애니메이션(스켈레톤 `pulse`/`breathe`, 녹화 점 `pulse`, 로딩 점)이 1ms 주기로 계속 돈다. 움직임을 줄이려던 설정이 화면 깜빡임이 된다.
- 수정: 같은 블록에 `animation-iteration-count: 1 !important;`를 더한다.

### UX-23 위젯 헤더가 대화 중에도 큰 인사말을 유지한다 (minor)
- 화면: `widget-360-08-clarification-card.png`, `widget-360-10-reverify-prompt.png`
- 문제: 20px 굵은 인사말 + 회사명 캡션이 늘 약 110px를 쓴다(`WidgetHeader.module.css:5,23-25`). 360 폭 패널(약 628px)에서 질문 카드의 "답변 보내기"가 아래로 밀려난다.
- 수정: 메시지가 하나라도 있으면 헤더를 한 줄로 줄인다: 제목은 회사명(t5 bold), 인사말은 숨김, 패딩 `var(--sp-3) var(--sp-3) var(--sp-3) var(--page-x)`. `WidgetHeader`에 `isCompact` prop.

---

## Polish

### UX-24 문구 겹침과 띄어쓰기 (polish)
- 화면: `widget-1440-02-empty.png`
- 문제: 헤더 "무엇이든 알려주세요"(`WidgetHeader.tsx:11`) 바로 아래 제목이 "화면을 보여주며 말로 알려주세요"(`WidgetEmptyState.tsx:16`)라서 같은 말끝이 두 번 나온다. 보조용언 띄어쓰기가 섞여 있다("알려주세요", "보여주며" / "적어 주세요", "입력해 주세요"). "무엇이든 알려주세요"는 어느 채팅 위젯에나 있는 인사라 이 제품의 쓰임(화면을 보여 주며 말하기)이 드러나지 않는다.
- 수정: 헤더 **"{이름}님, 불편한 점을 보여 주세요"**, 빈 화면 제목 **"말로 설명하면 저희가 정리할게요"**. 프로젝트 전체에서 "-어 주세요"로 띄어 쓴다.

### UX-25 상태 배지 말투와 이름 (polish)
- 화면: `admin-1440-07-analyzed.png`, `admin-1440-10-asked.png`
- 문제: 배지가 명사형("확인 필요", "답변 받음", "반영 완료")과 해요체("물어봤어요")와 진행형("다시 확인 중")으로 섞여 있다(`IssueItem.tsx:23-36`). 같은 대상을 목록 제목은 "받은 의견"(`ConversationList.tsx:21`), 내비게이션 라벨은 "받은 대화"(`AdminShell.tsx:50`), 빈 화면은 "대화를 골라 주세요"라고 부른다.
- 수정: 배지는 짧은 명사형으로: "확인 필요 / 질문 보냄 / 답변 받음 / 다시 확인 중 / 반영 완료". 목록 이름은 "받은 의견"으로 통일(`AdminShell.tsx:50` aria-label, `page.tsx:7` "의견을 골라 주세요").

### UX-26 토큰 밖 값 (polish)
- 문제: 11px 글자가 토큰 없이 들어가 있다(`ThreadMessage.module.css:46-47`, `ConversationList.module.css:113`). TDS 최소는 t8 12px다. 한 줄 토스트가 20px 반경이라 알약이 아니다(`WidgetToast.module.css:15`, TDS 한 줄 = 100px).
- 수정: `font-size: var(--fs-t8); line-height: var(--lh-t8);`. 토스트는 `border-radius: var(--r-toast-single)`로 두고 두 줄 이상일 때만 `--r-toast-multi`(JS로 줄 수를 재거나, 문구를 한 줄 길이로 줄인다).

### UX-27 답한 뒤 칩의 말하는 사람 (polish)
- 화면: `widget-360-09-answered.png`
- 문제: "래티스" 이름 아래 왼쪽 말풍선에 "✓ 답변을 보냈어요"가 있다(`ClarificationCard.tsx:40-51`, `MessageList.tsx:50`). 회사 쪽 말풍선이 고객 행동을 1인칭처럼 말해서 누가 보냈는지 헷갈린다.
- 수정: 문구를 회사 쪽 말로 **"답변 고마워요"** + 질문 한 줄로 바꾸거나, 칩을 질문 기록으로만 둔다: **"물어본 것: {질문}"**.

### UX-28 장면 확대 토글의 접근성 이름 (polish)
- 문제: `FrameThumbnail.tsx:53-55`가 `aria-pressed={!isZoomed}`를 주면서 라벨도 "전체 보기"↔"크게 보기"로 바꾼다. 스크린리더는 "크게 보기, 눌림" 같은 모순된 조합을 읽는다.
- 수정: `aria-pressed`를 빼고 라벨만 바꾼다(위젯 `ClarificationCard.tsx:129`와 같은 방식).

### UX-29 관리자 눌림 반응 (polish)
- 문제: 대화 목록 줄(`ConversationList.module.css:40-47`), 이슈 요약 줄(`IssueItem.module.css:9-17`), 말한 내용 토글(`TranscriptSection.module.css:6-14`)에 `:active` 반응이 없다. 페이저 버튼은 `:active`에 scale만 있고 `transition-duration: var(--dur-press)`가 빠져 있다(`RecordingAnalysisPanel.module.css:46-48`).
- 수정: 줄 단위 요소는 scale 대신 `:active { background: var(--grey-100); }`(TDS ListRow 눌림), 페이저에 `transition-duration: var(--dur-press);` 추가.

---

## 잘 된 점 (유지)
- 질문 카드: 장면 확대 + 고객이 한 말 인용 + 질문 + 보기 순서가 한 화면에 들어오고, 보기를 고르면 답변 버튼이 보이도록 위젯 안에서만 스크롤한다(`widget-360-08b-card-selected.png`).
- 관리자 목록·이슈 줄의 포커스 링이 잘 보인다(`admin-1440-04b-list-focus-tab.png`).
- 한글 조합 중 Enter를 보내기로 처리하지 않는다(위젯·관리자 모두).
- 실패 시 관리자 버튼마다 인라인 `role="alert"` 문구가 있다(대비만 UX-06대로 고치면 된다).
