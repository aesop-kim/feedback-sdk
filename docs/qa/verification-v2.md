# Verification v2: independent check of the QA v2 fixes

- Date: 2026-11-12, 02:45–03:20 KST. Repo `main` @ `63f0fb5` (all fix PRs #39–#65 merged). Production Vercel deployment was rebuilt from that commit (`vercel ls`: about 2 minutes before the run started). Region is `x-vercel-id: icn1::icn1`.
- Scope: `docs/qa/qa-matrix.md` (BUG-01..18) and `docs/design/ux-audit-v2.md` (UX-01..29). Report only. No source code was changed.
- Tools: Playwright (repo `@playwright/test` and `playwright` Chromium, with the fake-media flags from `playwright.config.ts`), plus axe-core 4 (WCAG 2.x A/AA + best-practice). I did not use Claude-in-Chrome.
- Targeted check scripts lived outside the repo, in the session scratchpad. Each one created its own `qa-v-*` users and deleted them afterwards.
- Screenshots are in `.screens/qa-v2/verify/` (80 files; prefix `local-` or `deployed-`).
- Cleanup, checked at the end: local and cloud DBs each have **0** `qa-*` end users and **0** recordings stuck in `uploading`. The 김데모 data in the cloud was not touched.

## 1. Suite results

| Run | Command | Result |
|---|---|---|
| Lint / types / unit | `npm run lint && npm run typecheck && npm test` | 0 lint errors, 0 type errors, **179/179** unit tests (28 files) |
| Local full Playwright (documented command) | `npm run db:reset && E2E_FAKE_AUDIO=…/narration.wav npx playwright test` | **53 passed, 1 failed, 2 skipped** (1.7 min). The failure is `full-flow.spec.ts` (see NEW-02). The 2 skips are `worker-analysis`, which needs `QA_AUDIO` |
| Local full-flow rerun (no reset) | `npx playwright test e2e/full-flow.spec.ts` | 1/1 passed (1.6 min). Realtime 140 ms / 160 ms |
| Local full-flow straight after `db:reset` (2nd try) | same | **failed again**, same step. Reproduced 2/2 |
| Local worker spec, narration | `QA_AUDIO=narration … worker-analysis.spec.ts` | 1 passed: "문제 3건", reanalyze after approval → 409 |
| Local worker spec, silent | `QA_AUDIO=silent E2E_FAKE_AUDIO=<silent.wav> …` | 1 passed: silent toast shown while recording = 1, worker `failed` with the silent reason |
| Deployed e2e/qa | `QA_TARGET=deployed E2E_FAKE_AUDIO=… npx playwright test e2e/qa` | **50 passed, 1 failed, 4 skipped** (2.2 min). The failure is `widget-recording.spec.ts:149` (see NEW-03). Skips: login rate limit and stale-upload (both skipped on purpose for deployed), and the 2 worker specs (no `QA_AUDIO`) |
| Deployed worker spec, silent | `QA_TARGET=deployed QA_AUDIO=silent …` | 1 passed (cloud worker set `failed` with the silent reason) |
| Deployed end-to-end, custom script | narration recording → cloud worker → clarification → answer → resolve → reverify | **Passed.** Details in §4 |

## 2. Per-item status

Legend: VERIFIED / PARTIAL / NOT FIXED / REGRESSED. "Spec L/D" means the regression spec passed locally and on deployed.

### Bugs

| ID | Status | Evidence |
|---|---|---|
| BUG-01 retry creates orphan recording | VERIFIED | After forcing a signed-upload abort and pressing "다시 보내기", DB recordings = `["analyzing"]` (one row) at both 1440 and 360. Spec L/D `["uploaded"]`. Code: `use-widget-recording.ts:139-141` keeps `recordingId`; `api/recordings/route.ts:42-64` reuses it. Screens `local-rec-*-03/04` |
| BUG-02 stale `uploading` forever | **PARTIAL** | The worker expired a seeded 31-minute-old upload within about 60 s (`failed`, reason text present), and `beforeunload` fires during upload. However, the admin panel then says "영상은 안전하게 받아 두었어요. 다시 정리하면…" and offers "다시 정리하기". Pressing it replaces the reason with a raw "Object not found" error. See **NEW-01**. Screens `local-adm-1440-04-rec0`, `local-stale-01-after-reanalyze` |
| BUG-03 concurrent answers | VERIFIED | Deployed spec `statuses=[200,409,409,409] answers=1 textMessages=1`. Unique constraint `clarification_answers_card_id_key` plus the conditional claim at `answer/route.ts:46-54` |
| BUG-04 late answer un-resolves | VERIFIED | Spec L/D (late answer → 200, status stays `resolved`). `issue-status.ts:5-12` |
| BUG-05 reverify not wired | VERIFIED | Local (360 and 1440) and deployed: ReverifyCard appears, "다시 녹화해서 확인하기" produces a recording with `reverify_issue_id` = the issue, and the issue becomes `reverify`. Screens `*-flow-*-04/05`, `deployed-e2e-10/11` |
| BUG-06 failure reason hidden | VERIFIED | The silent reason and the "고객에게 … 다시 녹화해 달라고" guidance render. A real silent recording also shows the video. Screen `local-adm2-02-failed-with-video` (see NEW-10 for polish) |
| BUG-07 silent warning not drawn | VERIFIED | With silent.wav, the pill shows "목소리가 들리지 않아요…" after about 4 s and the iframe grows to 132 px (`data-warning=true`). Screen `local-rec-08-silent-warning`. L/D worker spec `silent toast=1` |
| BUG-08 deployed realtime > 2 s | VERIFIED | Deployed spec: customer→admin 465 ms, admin→customer 412 ms. `vercel.json` `regions:["icn1"]`. Header `icn1::icn1` |
| BUG-09 409 shows "연결 불안정" | VERIFIED | Deployed spec toast `["이미 답한 질문이에요"]` and the card flips to answered (`use-widget-conversation.ts:259-265`) |
| BUG-10 failed send loses text | VERIFIED | Bubble kept, with "보내지 못했어요 / 다시 보내기". Retry saved exactly 1 row (1440 and 360). Screen `local-wchat-360-03-send-failed` |
| BUG-11 upload-failure copy | VERIFIED | Card shows "보내지 못했어요" in red, `rgb(210,32,48)`. Toast reads "녹화를 보내지 못했어요. ‘다시 보내기’를 눌러 주세요" |
| BUG-12 no cancel | VERIFIED | Pill buttons are `["취소","끝내고 보내기"]`. After cancel, recordings = 0 and the toast reads "녹화를 취소했어요. 아무것도 보내지 않았어요" |
| BUG-13 badge lost on reload | VERIFIED | `aria-label` before reload "피드백 보내기, 새 답장 1개", the same after reload, and it clears after open+close. Spec L/D |
| BUG-14 admin reply > 2000 | VERIFIED | Textarea capped at 2000 with a "2000/2000" counter. The API returns `400 {"error":"2000자까지 보낼 수 있어요."}` for both the admin and widget routes |
| BUG-15 long word overflow | VERIFIED | 0 overflowing bubbles at 1280 and 1440. Spec L/D. Screen `local-adm-1440-04-rec0` |
| BUG-16 localhost in prod CSP | VERIFIED | `curl -I` on prod `/widget` → `frame-ancestors https://lattice-feedback-demo.vercel.app` |
| BUG-17 login rate limit | VERIFIED (local) | Local spec `[401×5, 429]`, and the blocked IP is refused even with the correct password. Not exercised on deployed (that would lock the runner's IP). The limiter is in memory per instance, as the code comment documents |
| BUG-18 refresh mid-recording | VERIFIED | A `beforeunload` dialog fires during recording. Dismissing it keeps the recording. Spec L/D |

### UX

| ID | Status | Evidence |
|---|---|---|
| UX-01 | VERIFIED | Same as BUG-10. The failed bubble turns grey with an inline retry. |
| UX-02 | VERIFIED | Same as BUG-11. The retry button wraps to its own 44 px row at 360 (`local-rec-360-03-upload-failed`). |
| UX-03 | VERIFIED | A seeded analysis-failed recording shows "받았어요. 담당자가 직접 볼게요" in grey `rgb(86,97,109)`, not red. |
| UX-04 | VERIFIED | ReverifyCard with a 48 px primary action (screen `local-flow-360-04-reverify-card`). The audit's secondary "잘 고쳐졌어요" was deliberately left out (PR #60: no close API). |
| UX-05 | VERIFIED | Opening with keyboard Enter puts focus in the composer textarea. Escape closes and returns focus to the launcher; so does the X button. Launcher has `aria-controls`. |
| UX-06 | VERIFIED | Fixed at token level (`tokens.css`, documented in `tds-reference.md` §1.7, tested in `token-contrast.test.ts`). axe `color-contrast`: 0 violations on the login page, admin list, admin conversation, and widget (empty state and with a card). See NEW-12 for a side effect. |
| UX-07 | VERIFIED | The video renders for `analyzing` and `failed` (`local-adm2-01/02`). |
| UX-08 | VERIFIED | At 1280×800 the player is not sticky (`position` sticky only at `min-height:901px`). Seeking scrolls the video into view (108..357 of 800). Draft title fully visible (`local-adm-1280-05-draft`, `local-adm2-03`). |
| UX-09 | VERIFIED | Caption "누르면 고객에게 다시 확인해 달라고 알려요", then an inline confirm "고객에게 확인을 부탁할까요? 부탁하기/닫기" with focus on "부탁하기", then a note after resolving. Undo was not built (allowed fallback). |
| UX-10 | VERIFIED | `/api/conversations` aborted → "지금은 위젯을 열 수 없어요 / 다시 불러오기". After unrouting, the button recovers the widget (`local-init-01/02`). |
| UX-11 | VERIFIED | Close 44×44. Send 36 px plus a `::before inset:-4px` (44 px hit area). Retry 44 high. Cancel 46×44. Stop 103×44. Answer 268×48. |
| UX-12 | VERIFIED | Composer `:focus-within` → `inset 0 0 0 1.5px rgb(27,100,218)`. Admin login `box-shadow 0 0 0 1px`. |
| UX-13 | VERIFIED | Roving tabindex `0,-1,-1,-1`. ArrowDown×2 focuses and checks option 3. Tab leaves the group to "답변 보내기". |
| UX-14 | VERIFIED | While sending, the button shows LoadingDots `aria-label="답변을 보내고 있어요"` at opacity 1 (`local-flow-*-02-sending`). |
| UX-15 | **PARTIAL** | Widget list has `role="log" aria-live="polite"`. The admin thread (`ConversationThread.tsx`) still has no live region (only the pager label is `aria-live`). The widget fix also causes NEW-05. |
| UX-16 | VERIFIED | Draft shows a dashed "직접 입력할게요 · 항상 붙어요" row. After approval: "고객에게 질문을 보냈어요". |
| UX-17 | VERIFIED | After resolve, "고객 답변 · 취소 버튼" is still shown (`local-adm3-03`). |
| UX-18 | VERIFIED | Empty list → "아직 받은 의견이 없어요" with the snippet and a copy button. The list column shows the title only (`local-adm3-01`). See NEW-11. |
| UX-19 | VERIFIED | Duplicate names render as "검증동명 · qa+vadmb…" and "검증동명 · qa+vadma…". |
| UX-20 | VERIFIED | Screen-denied and mic-denied copy match the audit, and the toast is still visible at 3.5 s (5 s duration for long messages). |
| UX-21 | VERIFIED | Cancel button, 3 level bars, "끝내고 보내기" label. |
| UX-22 | VERIFIED (code) | `globals.css` reduced-motion block adds `animation-iteration-count: 1 !important`. |
| UX-23 | VERIFIED | With messages, the header collapses to one line "래티스 주식회사" (1440 and 360). |
| UX-24 | VERIFIED | "{이름}님, 불편한 점을 보여 주세요" / "말로 설명하면 저희가 정리할게요". |
| UX-25 | **PARTIAL** | Badges were normalised ("확인 필요 / 질문 보냄 / 답변 받음 / 다시 확인 중 / 반영 완료") and the placeholder reads "의견을 골라 주세요". However, the nav `aria-label` is still "받은 대화" (`AdminShell.tsx:53`), and the skeleton label "대화 목록을…" (`ConversationList.tsx:37`) still mixes terms. |
| UX-26 | **PARTIAL** | The toast radius uses tokens. The 11 px text is still there: `ThreadMessage.module.css:49`, `ConversationList.module.css:125`. |
| UX-27 | VERIFIED | Chip text is now "답변 고마워요 + {질문}". |
| UX-28 | **NOT FIXED** | `FrameThumbnail.tsx:53-55` still sets `aria-pressed={!isZoomed}` together with a label that toggles between "전체 보기" and "크게 보기". At runtime on the 김데모 issue: `전체 보기:false`. The file was last touched in #28. |
| UX-29 | **PARTIAL** | List rows and issue rows got `:active` with `--dur-press`, and the pager got `--dur-press`. The transcript toggle (`TranscriptSection.module.css`) has no `:active` rule (0 matching rules at runtime). |

## 3. NEW findings

| ID | Severity | Summary | Repro | Suspected location |
|---|---|---|---|---|
| NEW-01 | **major** | An abandoned upload (`upload_incomplete`) tells the admin "영상은 안전하게 받아 두었어요. 다시 정리하면 보통 1분 안에 끝나요" and offers "다시 정리하기". No video exists, and the reason line itself says "다시 녹화해 달라고 요청해 주세요". Pressing the button queues the recording; the worker then fails with "녹화 파일을 내려받지 못했어요: <uuid>/audio.webm 다운로드 실패: Object not found". The meaningful reason is overwritten by a raw technical error, and the failure kind becomes `analysis`, so the misleading guidance stays permanently. The API already returns `failureKind: "upload_incomplete"`, but the UI ignores it. | Seed a recording with `status=uploading` and `upload_requested_at` 31 minutes old. Wait about 60 s for the worker. Open it in admin. Press "다시 정리하기". Screens `local-adm-1440-04-rec0`, `local-stale-01-after-reanalyze` | `src/components/admin/RecordingAnalysisPanel.tsx:110-111, 166-174` (guide branches only on the silent text, not on `failureKind`). `src/app/api/admin/recordings/[recordingId]/reanalyze/route.ts:27-33` (does not refuse `failed` + `analysis_attempt=0`) |
| NEW-02 | minor | The documented full-suite command fails its first test deterministically (2/2): `full-flow` sees a blank widget iframe for 15 s when it starts right after `npm run db:reset`. Starting a few minutes later, or rerunning, passes. The suite therefore never goes green with the command given in the brief and README. | `npm run db:reset && E2E_FAKE_AUDIO=… npx playwright test e2e/full-flow.spec.ts` | `e2e/full-flow.spec.ts:48` (no readiness wait or retry after reset). Most likely local stack readiness right after `supabase db reset`; README §테스트 |
| NEW-03 | minor | The deployed QA run is not green: the max-duration test has no `IS_DEPLOYED` skip, but production intentionally ignores `?maxRecordingMs`, so the test waits for "/ 0:05", which never appears. | `QA_TARGET=deployed npx playwright test e2e/qa/widget-recording.spec.ts -g 최대` | `e2e/qa/widget-recording.spec.ts:149` |
| NEW-04 | minor | `npm run demo:record` is stale after #42/#60. It clicks "반영 완료로 바꾸기" but never "부탁하기", then waits for the text "수정을 반영했어요", which is now rendered as a ReverifyCard ("고쳤어요. 한 번 확인해 주세요"). The demo video pipeline will time out. Found by static reading only; not executed. | Read the spec or run `npm run demo:record` | `e2e/demo-recording.spec.ts:282-289` |
| NEW-05 | minor (a11y) | `<ol role="log">` removes list semantics from its `<li>` children. axe reports `listitem` (serious, 3 nodes) and `aria-allowed-role` on the widget once there are messages. This was introduced by the UX-15 fix. | axe on the widget with a conversation (1440 and 360) | `src/components/widget/MessageList.tsx:106` (put `role="log"` on a wrapper div, or drop `ol/li`) |
| NEW-06 | minor | At 360 px the recording pill runs off the left edge (`right:24px` + `width:340px` → left = -4 px). The `max-width` doesn't help, and the mobile media query covers only open/closed. | 360×740, start recording. Screen `local-rec-360-01-pill` | `src/sdk/launcher-styles.ts:85-93, 99-104` |
| NEW-07 | minor | Admin at 360×740 is unusable. The three-column layout is clipped with no horizontal scroll, so the conversation and analysis columns and the logout link cannot be reached. README scopes the product to desktop, but nothing tells the user that. | Open `/admin` and a conversation at 360×740. Screens `local-adm360-02/03` | `src/components/admin/AdminShell.module.css` (fixed grid, no small-screen rule) |
| NEW-08 | minor (pre-existing) | The widget creates an end user and a conversation on page load, before the customer opens it. Every visitor therefore appears in the admin inbox as an empty "대화를 시작했어요" row, which is noise for a first-time admin. Observed: a session that only pressed Tab on the demo page (never opened the widget) appeared in the admin list. | Load the demo page as a new user without clicking the launcher, then open `/admin` | `src/hooks/use-widget-conversation.ts:183-213` (session not gated on `isOpen`/first action). `ConversationList.tsx:127` |
| NEW-09 | polish | A console error "Permissions policy violation: camera is not allowed in this document." appears on every recording start, local and deployed. It was noted in the v2 matrix §8 but is still present. | Start any recording with console capture | `src/sdk/index.ts:63` (iframe `allow`) / `getDisplayMedia` constraints in `use-widget-recording.ts:47-52` |
| NEW-10 | polish | For a silent-audio failure the only action is still "다시 정리하기", while the copy says re-analysis will give the same result. The primary action contradicts the guidance. | Silent recording → admin. Screen `local-adm2-02-failed-with-video` | `src/components/admin/RecordingAnalysisPanel.tsx:209-212` |
| NEW-11 | polish | The install snippet shows `projectKey: "<프로젝트 키>"`, and the admin UI shows the project key nowhere, so a first-time admin cannot fill it in. The second line also overflows the box horizontally (it scrolls, but with no cue). | Empty list state. Screen `local-adm3-01-empty-list` | `src/components/admin/AdminHomePlaceholder.tsx:9-12` |
| NEW-12 | polish | The contrast fix moved `--grey-500` (placeholder) to #646f7c, which sits right next to `--grey-600` #56616d used for real secondary text. Placeholders now read almost like entered text. This is a deviation from TDS hierarchy that `tds-reference.md` §1.7 does not discuss. | Compare the composer placeholder with the time/caption text. Screen `local-wchat-1440-01-empty-focus` | `src/styles/tokens.css:7` |

## 4. End-to-end on DEPLOYED (cloud worker)

User `qa-v-e2e-*` on https://lattice-feedback-demo.vercel.app with admin at https://lattice-feedback-sdk.vercel.app/admin. Fake media flags plus narration.wav. Times are UTC.

| Step | Result |
|---|---|
| Record 68 s (pointing and clicking per the script) → "끝내고 보내기" | uploaded at 18:05:53 |
| Cloud worker analysis | **3 issues** after 21 s: "계약서 등록 버튼 무반응" (clear), "표 머리글 '금액' 오타" (clear), "전체 계약서 제목 글씨 어색" (ambiguous). The widget showed "문제 3건을 정리했어요" (`deployed-e2e-05/06`) |
| Approve question → widget card | Card appeared in the widget about 4 ms after the admin saw it approved (`deployed-e2e-07`) |
| Customer answers | Widget "답변 고마워요". Admin shows "고객 답변" (`deployed-e2e-08*`) |
| Resolve (confirm "부탁하기") | ReverifyCard "‘전체 계약서 제목 글씨 어색’" appeared (`deployed-e2e-10`) |
| Reverify recording | The new recording's `reverify_issue_id` = the issue, and the issue is `reverify`. The cloud worker analysed the reverify recording too (`deployed-e2e-11..13`) |
| Diagnostics | 0 HTTP ≥400 responses. Only the camera permissions-policy console error (NEW-09) and harmless `ERR_ABORTED` navigation/frame cancels |
| Cleanup | The user and its recordings/files were deleted. Cloud DB has 0 `qa-*` users and 0 stuck uploads |

## 5. Verdict

**NOT CLEAN.** There is 1 major (NEW-01).

The non-verified items are:

- BUG-02: PARTIAL, tied to NEW-01.
- UX-15, UX-25, UX-26 and UX-29: PARTIAL.
- UX-28: NOT FIXED.

The local suite and the deployed QA suite each have one red test (NEW-02, NEW-03). All other BUG and UX items are verified with fresh evidence, and the core deployed flow works end to end.
