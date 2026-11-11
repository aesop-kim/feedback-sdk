# Verification v3: independent check of the v2 fix round (#68–#78)

- Date: 2026-11-12, 03:55–04:35 KST. Repo `main` @ `b9d8675` (#78). The Vercel production deployment of the SDK app is 9 minutes newer than that commit (`vercel ls --prod`). Region header `icn1::icn1`.
- Scope: everything verification-v2.md left not VERIFIED (NEW-01..12, BUG-02, UX-15, UX-25, UX-26, UX-28, UX-29), a 10-item regression sample, and an exploratory first-time customer/admin pass on DEPLOYED at 1440×900 and 360×740. Report only. No source code was changed.
- Tools: repo Playwright (`@playwright/test`, Chromium, the fake-media flags from `playwright.config.ts`) and axe-core 4.14 (tags wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice). I did not use Claude-in-Chrome or Aside. Aside drives the user's real browser and cannot feed a fake microphone.
- Check scripts lived in the session scratchpad and imported `e2e/qa/qa-helpers.ts`. Every user they made had the prefix `qa-v3*` and was deleted afterwards.
- Screenshots: `.screens/qa-v2/verify3/` (50 PNG). Prefixes: `loc-` is local, `dep-` is deployed. Raw logs (suite output, axe JSON, step logs) are in `.screens/qa-v2/verify3/logs/`.
- Environment notes:
  - When I started, only the **cloud** worker was running (`ps eww` showed the cloud `NEXT_PUBLIC_SUPABASE_URL`). No local worker was running, although the brief said one was. I started one with `npm run worker` (it reads `.env.local`) and left it running.
  - `npm run demo:record` overwrites `demo/raw/*`, which git ignores. I backed those files up first and restored them afterwards. The SHA-1 of each restored file matches the backup.
- Cleanup, checked at the end: local and cloud DBs each have **0** `qa-*` end users, **0** `uploading` recordings and **0** queued or analyzing recordings. I did not touch the 김데모 data in the cloud.

## 1. Suite results (fresh runs)

| Run | Command | Result |
|---|---|---|
| Lint / types / unit | `npm run lint && npm run typecheck && npm test` | 0 lint errors, 0 type errors, **187/187** unit tests (28 files) |
| Local full Playwright (documented command) | `npm run db:reset && E2E_FAKE_AUDIO=$(pwd)/fixtures/demo-recording/narration.wav npx playwright test` | **60 passed, 0 failed, 2 skipped** (3.2 min). Test #1 was `full-flow.spec.ts`, which passed straight after the reset (1.6 min). `global-setup` reported the stack ready after 1.1 s. Realtime: customer→admin 142 ms, admin→customer 141 ms. The 2 skips are the worker specs, which need `QA_AUDIO` |
| Local worker spec, narration | `QA_AUDIO=narration E2E_FAKE_AUDIO=…/narration.wav npx playwright test e2e/qa/worker-analysis.spec.ts` | 1 passed, 1 skipped |
| Local worker spec, silent | `QA_AUDIO=silent E2E_FAKE_AUDIO=<30 s silent wav> …` | 1 passed, 1 skipped. Worker `failed` with the silent reason; silent toast shown while recording = 1 |
| Deployed e2e/qa | `QA_TARGET=deployed E2E_FAKE_AUDIO=…/narration.wav npx playwright test e2e/qa` | **56 passed, 0 failed, 5 skipped** (2.2 min). All 5 skips are intentional: login rate limit, max duration, and stale upload (each skipped on deployed), plus the 2 worker specs (no `QA_AUDIO`) |
| Deployed worker spec, narration | `QA_TARGET=deployed QA_AUDIO=narration …` | 1 passed, 1 skipped. Result "문제 3건"; reanalyze after an approved card → 409 |
| Deployed worker spec, silent | `QA_TARGET=deployed QA_AUDIO=silent …` | 1 passed, 1 skipped. The cloud worker set `failed` with the silent reason; silent toast = 1 |
| `npm run demo:record` (NEW-04) | after `npm run db:reset` | **1 passed** (2.2 min) |
| Deployed end-to-end, custom script, 1440 and 360 | record → 3 issues → approve → answer → resolve → reverify | **Passed at both sizes.** Details in §4 |

All suites are green. NEW-02 and NEW-03 from v2 are gone.

## 2. Re-verified items (all non-VERIFIED items from v2)

| ID | v2 | v3 | Evidence |
|---|---|---|---|
| NEW-01 abandoned upload offered "다시 정리하기" | major | **VERIFIED** | The real local worker expired a seeded 31-minute-old `uploading` row 51 s later (`analysis_attempt=0`, upload-incomplete reason). Admin panel: title "녹화를 끝까지 받지 못했어요", guide "받은 영상이 없어서 다시 정리할 수 없어요…", **0** reanalyze buttons. A direct `POST …/reanalyze` returns **409** "업로드가 끝나지 않은 녹화라 다시 정리할 수 없어요…", and the DB error text is unchanged. Second path: a row set to `uploaded` with no `audio.webm`. The worker fails within 3 s with the readable `MISSING_RECORDING_FILE_ERROR` and no raw "Object not found"; the admin shows the same upload-incomplete guidance. Screens `loc-new01-stale-admin`, `loc-new01b-missing-file-admin`. See V3-01 for the customer side |
| BUG-02 stale `uploading` forever | PARTIAL | **VERIFIED** | Same evidence as NEW-01: the worker expires the row and the admin sees a correct, non-misleading reason. The suite test `widget-recording.spec.ts:259` passes locally |
| NEW-02 documented suite red right after reset | minor | **VERIFIED** | The documented command passed 60/60 (non-skipped) on the first try, with `full-flow` running first after `db:reset`. Fix: `e2e/global-setup.ts` |
| NEW-03 deployed max-duration test red | minor | **VERIFIED** | Skipped on deployed (`widget-recording.spec.ts:150`). Deployed run is 56/0/5 |
| NEW-04 `demo:record` stale | minor | **VERIFIED** | Executed (it was only read statically in v2): **1 passed**, 2.2 min. It now confirms "부탁하기" and waits for the ReverifyCard |
| NEW-05 `role="log"` removed list semantics | minor | **VERIFIED** | Widget with messages: axe `list`, `listitem` and `aria-allowed-role` = 0, locally and on deployed (`[qa] axe list rules: []`). The log role sits on a wrapper div (`MessageList.tsx:106-107`). A different axe hit on the same screen is V3-03 |
| NEW-06 360 px pill off-screen | minor | **VERIFIED** | Pill box `{x:12, width:340}`, so it spans 12..352 inside 360, locally and on deployed (spec plus my e2e). Screen `loc-new06-pill-360` |
| NEW-07 admin unusable at 360 | minor | **VERIFIED** | At 360×740 the admin shows "관리자 화면은 PC에서 써 주세요" with the reason, there is no horizontal scroll (`scrollWidth = clientWidth = 360`), and "로그아웃" is visible at x 283..340. Screen `loc-new07-admin-360` |
| NEW-08 every page view created a user/conversation | minor | **VERIFIED** | Deployed, at both sizes: `end_users` for the new visitor = **0** after loading the page, pressing Tab and waiting 5 s, and = **1** after opening the launcher. A visitor who opens and closes without sending does **not** appear in the admin list (local check). Returning user: the badge "새 답장 1개" shows on reload and in a new tab without opening the widget (L/D). Screen `loc-badge-returning-user` |
| NEW-09 camera permissions-policy console error | polish | **VERIFIED** | 0 console errors through recording start and stop: the 360 spec (L/D), and both of my deployed e2e runs (customer and admin pages) |
| NEW-10 silent failure's main action was "다시 정리하기" | polish | **VERIFIED** | The guide comes first ("다시 정리해도 결과가 같아요. 고객에게 마이크를…"), and the only action is the text button "그래도 다시 정리하기". Screen `loc-new10-silent-admin` |
| NEW-11 install snippet without project key | polish | **VERIFIED** | Empty list: the "프로젝트 키 lattice-demo" line appears, the snippet contains `projectKey: "lattice-demo"`, and the box does not overflow (`scrollWidth = clientWidth = 406`). Screen `loc-new11-empty-install` |
| NEW-12 placeholder almost as dark as secondary text | polish | **VERIFIED** | Computed placeholder colour is `rgb(123,133,145)` (#7b8591) in the widget and the admin reply box. Secondary/time text is `rgb(86,97,109)`. The rule is documented in `tds-reference.md` §1.7 and enforced in `token-contrast.test.ts`. Visually lighter than the time stamp (`loc-new12-widget-placeholder`) |
| UX-15 admin thread not announced | PARTIAL | **VERIFIED** | Admin message area: `role="log" aria-live="polite" aria-label="주고받은 메시지"` (`ConversationThread.tsx:46`) |
| UX-25 mixed names | PARTIAL | **VERIFIED** | Nav `aria-label="받은 의견"`. The skeleton label is "받은 의견을 불러오고 있어요" (`ConversationList.tsx:37`), and the placeholder reads "의견을 골라 주세요" |
| UX-26 11 px text | PARTIAL | **VERIFIED** | At runtime, 0 text leaves under 12 px on the admin conversation page. Toast uses `--r-toast-single`, with `--r-toast-multi` when `data-multiline` |
| UX-28 `aria-pressed` with a toggling label | NOT FIXED | **VERIFIED** | On a real deployed issue with a frame: `전체 보기 \| aria-pressed=null` (both runs) |
| UX-29 transcript toggle has no press state | PARTIAL | **VERIFIED** | During a real mousedown on deployed, the transcript toggle background is `rgb(242,244,246)` (grey-100). The rule includes `transition-duration: var(--dur-press)` |

## 3. Regression spot-check (previously VERIFIED, emphasis on #68–#78)

| Item | Result | Evidence |
|---|---|---|
| #78 lazy creation + **BUG-13** unread badge for returning users | OK | See NEW-08. Badge live "피드백 보내기, 새 답장 1개", the same after reload (deployed 1440 and 360, plus the suite). A new device without a stored token shows no badge, but the pre-#78 code also marked everything read on a first-seen device (`use-widget-conversation.ts:206-208`), so this is not a regression |
| #76 placeholder colour / **UX-12** | OK | See NEW-12. The focus ring on the composer is visible in screenshots `dep-e2e-1440-11/13` |
| #68 reanalyze rules | OK | Admin API, fresh seeds: analyzed without a card → 200 `queued:true`, then again within 60 s → 200 `queued:false`; approved card → 409; analysis failure with audio → 200 queued; failure without audio → 409; silent failure → 200 (secondary action); `analyzing` → 200 `queued:false` (not requeued); unknown id → 404; no cookie → 401 |
| **BUG-03** concurrent answers | OK | Deployed `statuses=[200,409,409,409] answers=1 textMessages=1` |
| **BUG-05** reverify wiring | OK | Deployed 1440 and 360: the reverify recording has `reverify_issue_id` = the asked issue, the issue becomes `reverify`, and the cloud worker analyses it (`analyzed`). See V3-02 for the admin side |
| **BUG-08** realtime | OK | Deployed spec: customer→admin 426 ms, admin→customer 503 ms. My e2e: question card visible in the widget 1.36 s after the admin clicked "고객에게 물어보기" (this includes the API write) |
| **BUG-16** prod CSP | OK | `curl -I …/widget?projectKey=lattice-demo…` → `frame-ancestors https://lattice-feedback-demo.vercel.app` |
| **UX-06** contrast | OK, one exception | axe `color-contrast` = 0 on widget empty, card and reverify states (deployed), and on the admin list, analysis and login pages. The exception is the transient pending bubble (V3-03) |
| **UX-16** draft shows "직접 입력할게요 · 항상 붙어요" | OK | `loc-ux-admin-conversation` |
| **UX-23** header collapses with messages | OK | "래티스 주식회사" on one line at 1440 and 360 (`dep-e2e-*-11-widget-reverify-card`) |
| **UX-18 / NEW-11** empty list → install guide | OK | `loc-new11-empty-install` |

## 4. Exploratory, DEPLOYED (cloud worker), first-time customer and admin

The new users were `qa-v3e2e-*`, with the demo user pinned on https://lattice-feedback-demo.vercel.app, admin at 1440, and the customer at 1440×900 and 360×740. Step logs: `logs/dep-e2e-{1440,360}-steps.log`.

| Step | 1440 | 360 |
|---|---|---|
| Page load, no open | 0 end users | 0 end users |
| Open widget | 1 end user; axe 0 | 1 end user; axe 0 (`dep-e2e-360-02`) |
| Record about 68 s per script → "끝내고 보내기" | uploaded | uploaded |
| Cloud worker | **3 issues** in 27 s ("계약서 등록 버튼 무반응" clear, "표 머리글 오타" clear, "상단 제목 글씨 어색함" ambiguous) | **3 issues** in 30 s (same three; the ambiguous one is "전체 계약서 제목 글씨 어색") |
| Approve the question → widget card | 1.36 s; axe 0 | 1.37 s; axe 0 (`dep-e2e-360-08`) |
| Answer | "답변 고마워요"; admin shows "고객 답변" | same |
| Admin reply with the widget closed → badge → reload | "새 답장 1개" live and after reload | same (`dep-e2e-360-10`) |
| Resolve → confirm "부탁하기" | ReverifyCard; axe 0 | ReverifyCard; axe 0 (`dep-e2e-360-11`) |
| Reverify recording, 20 s | linked (`reverify_issue_id`), issue `reverify`, cloud worker `analyzed` | same |
| Console / network | 0 console errors, 0 HTTP ≥400. 1 aborted Pretendard font subset request (harmless) | 0 / 0 / 0 |
| axe, admin | only best-practice `landmark-one-main`, plus `page-has-heading-one` and `region` on the list page (V3-04) | same |

Two harness notes (not product defects):

- At 360, the demo host page hides the "계약 긍액" column, so `locator.boundingBox()` on it waited without limit. My first two 360 attempts hung there; adding a 3 s timeout fixed it.
- The reverify recording reuses the looping narration audio. That is why the worker found "문제 1건" (a duplicate of the register-button issue) in it.

### UX judgement against `tds-reference.md`

The widget follows TDS closely:
- t5/t6/t7 type, one blue primary CTA per state, and a 100 px pill toast.
- Weak grey surfaces for system chips, ListRow-style presses, and plain 해요체 copy ("고쳤어요. 한 번 확인해 주세요", "답변 고마워요").
- At 360 the panel, the question card and the pill all fit. The card keeps the scene, the quote, the question and the options in one scroll.

The admin is calm and consistent:
- Noun-form status badges, grey captions under actions, and inline confirmation instead of modals.

The weak spots are where the loop ends:
- The reverify state is a dead end for the admin (V3-02).
- The customer and the admin are told different stories about an abandoned upload (V3-01).

## 5. New findings

| ID | Severity | Summary | Repro | Location |
|---|---|---|---|---|
| V3-01 | **minor** | For an abandoned upload (`upload_incomplete`), the **customer's** recording card says "받았어요. 담당자가 직접 볼게요". Nothing was received, though. The admin panel says "받은 영상이 없어서 다시 정리할 수 없어요. 고객에게 다시 녹화해 달라고 답장해 주세요", so the two sides contradict each other. The customer believes the report arrived and has no reason to re-record unless the admin writes. The widget ignores `failureKind`, which the API already returns to the admin. | Open the widget as a user. Seed or produce a `failed` recording with `analysis_attempt=0` and the upload-incomplete error (or let the worker expire a stale upload). Reload the widget. Screen `loc-v3-widget-upload-incomplete-copy` | `src/components/widget/RecordingMessage.tsx:26-28` (single `failed` copy; the comment assumes "영상은 받았고") |
| V3-02 | **minor** | The reverify loop has no ending on the admin side. (a) The reverify recording is not marked or linked in the admin: `reverifyIssueId` is returned (`feedback-repository.ts:225`) but no admin component reads it. The new recording looks like an ordinary one ("화면 녹화 0:19 · 문제 1건"), and the worker analyses it as fresh issues. (b) The original issue stays "다시 확인 중" forever and still counts in "남은 문제 N건". (c) Its only action is "반영 완료로 바꾸기 / 누르면 고객에게 다시 확인해 달라고 알려요" again, so closing it re-sends a reverify request to the customer. The closing action was deliberately left out in #60 (v2 UX-04), but showing the resolve button again on `reverify` is new behaviour worth deciding on. | Deployed e2e through the reverify step, then open the admin (`dep-e2e-1440-13-admin-after-reverify`). Local: set an issue to `reverify` and expand it (`loc-v3-reverify-issue-admin`, panel text shows "반영 완료로 바꾸기") | `src/components/admin/IssueItem.tsx:108-112` (only `resolved` hides `ResolveButton`), `src/components/admin/RecordingAnalysisPanel.tsx` (no use of `reverifyIssueId`) |
| V3-03 | polish (a11y) | While a message is sending, the user bubble is at `opacity: 0.6`, which gives white on #76a2e9 = **2.58:1**. axe flags `color-contrast` (serious) if it runs during the send. The state is transient, but on deployed latency it is visible for a few hundred ms. This predates #68–#78 (#8/#45). | Widget: send a message and run axe immediately (`logs/loc-targeted.json` → `widget.axe.withMessages`) | `src/components/widget/MessageBubble.module.css:39-41` |
| V3-04 | polish (a11y) | The admin pages have no `<main>` landmark (axe best-practice `landmark-one-main`, moderate, on every admin page). The list/home page also has no `h1` (`page-has-heading-one`), and its centre placeholder sits outside any landmark (`region`). The login page is clean. | axe on `/admin` and `/admin/<id>` (`logs/dep-e2e-1440-axe.json`) | `src/components/admin/AdminShell.tsx:58` (`div.body` wraps the columns), `src/components/admin/AdminHomePlaceholder.tsx:31, 53` (`<section>` placeholders outside a landmark) |
| V3-05 | polish | The admin thread chip says "정리하지 못했어요" for an abandoned upload, while the analysis panel next to it says "녹화를 끝까지 받지 못했어요". The same object gets two different explanations side by side. | Same seed as NEW-01. Screen `loc-new01-stale-admin` | `src/components/admin/ThreadMessage.tsx:52-53` |

## 6. Verdict

**CLEAN.** There are zero blocker or major findings, and every suite is green:
- Documented local suite: 60/0/2.
- Deployed e2e/qa: 56/0/5.
- Worker specs: narration and silent, local and deployed, all passed.
- Unit tests: 187/187, with lint and typecheck clean.
- `demo:record`: passed.

All 18 items that v2 left open (NEW-01..12, BUG-02, UX-15, UX-25, UX-26, UX-28, UX-29) are now VERIFIED with fresh evidence. The 10-item regression sample shows no regressions. The deployed first-time flow works end to end at 1440 and 360, with 0 console errors and 0 failed API calls.

The open work is 2 minor findings (V3-01: the customer is told an abandoned upload was received; V3-02: the reverify loop has no end for the admin) and 3 polish findings.
