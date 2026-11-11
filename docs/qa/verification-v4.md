# Verification v4: independent check after the V3 fixes and architect follow-ups

- Date: 2026-11-12, 05:20–05:45 KST. Repo `main` @ `6c7a9d8` (#102). The deployed SDK app was about 12 minutes old at 05:36 KST (`age: 717` on `/admin/login`), so it is newer than #102. The region header is `icn1`.
- Scope:
  - The V3 fixes #80/#82/#84/#86 (V3-01..05).
  - The architect follow-ups #88/#90/#93/#96/#98/#101/#102.
  - The full customer/admin loop on DEPLOYED, with the customer at 1440×900 and at 360×740.
  - A first-time customer/admin usability pass.
  - This is a report only. I changed no source code.
- Tools:
  - The repo's Playwright (Chromium with the fake-media flags from `playwright.config.ts`).
  - axe-core 4.14. The loop runs used the tags wcag2a, wcag2aa, wcag21a, wcag21aa and best-practice.
  - I did not use Claude-in-Chrome or Aside, because neither can feed a fake microphone.
- My own check specs are in `.screens/qa-v2/verify4/specs/` (git-ignored), run with `--config .screens/qa-v2/verify4/specs/pw.config.ts`:
  - `probe-api`
  - `loop`
  - `answer-fault`
  - `stale`
  - `skew`
  - `cleanup`
- Every user I created had the prefix `qa-v4*`.
- Screenshots: `.screens/qa-v2/verify4/` (79 PNG). The prefixes are `loc-` (local) and `dep-` (deployed). Raw logs, step logs and axe JSON are in `.screens/qa-v2/verify4/logs/`, with cloud hosts and tokens redacted.
- Environment: two workers were running, both started before I began. PID 20800 reads `.env.local` (local). PID 36932 has the cloud `NEXT_PUBLIC_SUPABASE_URL`. I did not restart either.
- Cleanup, checked at the end: local and cloud each have **0** `qa-*` end users and **0** recordings in `uploading`, `uploaded` or `analyzing`. I did not touch the 김데모 data in the cloud.

## 1. Suite results (fresh runs)

| Run | Command | Result |
|---|---|---|
| Lint / types / unit | `npm run lint && npm run typecheck && npm test` | 0 lint errors, 0 type errors, **221/221** unit tests (33 files) |
| Local full Playwright (documented command) | `npm run db:reset && E2E_FAKE_AUDIO=$(pwd)/fixtures/demo-recording/narration.wav npx playwright test` | **69 passed, 0 failed, 2 skipped** (3.4 min). `full-flow` ran first, straight after the reset, and passed (1.6 min). Realtime: customer→admin 125 ms, admin→customer 89 ms. The 2 skips are the worker specs, which need `QA_AUDIO` |
| Deployed e2e/qa | `QA_TARGET=deployed E2E_FAKE_AUDIO=… npx playwright test e2e/qa` | **63 passed, 0 failed, 7 skipped** (2.6 min). Skips: the RPC guard (`admin-flow:247`), the expired token (`security-api:46`), the login rate limit, max duration, the stale upload, and the 2 worker specs. All 7 are intentional. I covered the first two myself on deployed (§3, V4-04) |
| Worker spec, local, narration | `QA_AUDIO=narration …worker-analysis.spec.ts` | 1 passed, 1 skipped. "문제 3건"; reanalyze after the approved card → 409 |
| Worker spec, local, silent | `QA_AUDIO=silent E2E_FAKE_AUDIO=<30 s silent wav>` | 1 passed, 1 skipped. `failed` with the silent reason; silent toast = 1 |
| Worker spec, deployed, narration | `QA_TARGET=deployed QA_AUDIO=narration …` | 1 passed, 1 skipped. "문제 3건"; reanalyze → 409 |
| Worker spec, deployed, silent | `QA_TARGET=deployed QA_AUDIO=silent …` | 1 passed, 1 skipped. The cloud worker set `failed` with the silent reason; silent toast = 1 |
| My probes (local / deployed) | `probe-api` (8 checks) | local **8/8**. Deployed: 7/8 at first. The 1 failure was my own over-strict assertion: a token that expired 1 ms ago. The laptop clock runs about 1–2 s ahead of Vercel's (`skew` probe: tokens 1000 ms past expiry → 200, 3000 ms → 401). The real check (60 s past expiry → 401) passed. This is not a product defect |
| Deployed full loop, custom | `loop` with `LOOP_VP=1440` and `LOOP_VP=360` | **passed at both sizes** (2.8 min and 2.9 min). The same spec also passed locally at 1440 (2.5 min) |

All suites are green.

## 2. V3-01..05 re-verification

| ID | v3 | v4 | Evidence |
|---|---|---|---|
| V3-01: the widget said "받았어요" for an upload that never arrived | minor | **VERIFIED** | The widget card now reads "녹화가 끝까지 올라가지 않았어요" in red, with a weak "다시 녹화하기" button (`.screens/qa-v2/functional/local-rec-09-widget-upload-incomplete.png`, freshly written by my suite run, and `deployed-rec-09-…` from the deployed run). The suite test `widget-recording.spec.ts:310` passed on local and on deployed. Silent failures still say "받았어요. 담당자가 직접 볼게요", which is correct because the video exists (worker spec). Residual: see V4-05 |
| V3-02: the reverify loop had no ending for the admin | minor | **VERIFIED** | Deployed loop at 1440 and 360: the thread chip reads "다시 확인 녹화 0:14 · 문제 1건 / 찾은 문제 없음", and the panel label reads "‘계약서 등록 버튼 무반응’ 다시 확인 녹화" with "원래 이슈 보기". The original issue shows "다시 확인 중", "고객이 보낸 다시 확인 녹화 보기", and the group "다시 확인 결과" with only "확인 끝 · 해결됨" and "아직 안 고쳐졌어요 · 다시 열기" ("반영 완료로 바꾸기" is not offered). Closing gives `closed`; the list goes from "남은 문제 3건" to "2건" (360) and from "4건" to "3건" (1440). Reopening a second issue gives `{status: open, resolved_at: null}`, and "반영 완료로 바꾸기" comes back. Screens: `dep-loop-1440-14..17`, `-22`, and `dep-loop-360-14..17`, `-22`. API: open→closed 409, closed→open 409, closed→resolved 409, closed twice → `changed:false`, 5 concurrent closes → exactly 1 `changed:true`, 0 system messages to the customer, no cookie → 401 (local and deployed) |
| V3-03: pending bubble contrast 2.58:1 | polish | **VERIFIED** | Suite `widget-layout.spec.ts:63` (axe color-contrast while the send is held) passed on local and deployed. CSS: blue-50 fill with blue-700 text, no opacity |
| V3-04: admin had no main/h1, and the placeholder sat outside a landmark | polish | **VERIFIED** | Suite `widget-layout.spec.ts:87`: `admin home landmarks: []`, `admin conversation landmarks: []` (deployed). My loop ran the full WCAG + best-practice axe set on admin home, analyzed, reverify-recording and after-reopen, and got **0 violations** in every case (local 1440, deployed 1440 and 360; `logs/*-loop-*-axe.json`) |
| V3-05: the thread chip said "정리하지 못했어요" next to "녹화를 끝까지 받지 못했어요" | polish | **VERIFIED** | The chip now reads "화면 녹화 0:12 · 녹화를 끝까지 받지 못했어요", the same as the panel title (`local-rec-09-admin-upload-incomplete-chip.png`) |

## 3. Architect follow-ups

| Item | Result | Evidence |
|---|---|---|
| #88: reanalyze is refused when an issue is resolved/reverify/closed | **VERIFIED** (local and deployed) | For each of the 3 issue states × recording `failed` and `analyzed`, `POST …/reanalyze` returned **409** "반영 완료했거나 해결된 이슈가 있어서 다시 정리할 수 없어요…". The recording and issue status did not change. The UI showed **0** "다시 정리하기" buttons, and on failed recordings it showed the reason caption (`loc-/dep-reanalyze-guard-{resolved,reverify,closed}.png`). Analyzed recordings never offer the button |
| #88: RPC guard (`replace_recording_issues`) | **VERIFIED, including on the cloud DB** | Calling the RPC directly with the service role on a recording whose issue is resolved, reverify or closed returned the error `recording … has progressed issues`, and the issue survived. Control: with only open issues, the RPC succeeds (0 issues left). On the cloud this also proves that migrations `20261112030000` (`closed` accepted by the check constraint) and `20261112040000` are applied. The repo test skips this check on deployed (V4-04) |
| #90: upload-retry race | **VERIFIED** | 20 rounds per environment. A retry `POST /api/recordings` ran against a simulated worker claim (`uploading → analyzing, attempt 1`) whose start was delayed by 0..152 ms (local) and 0..475 ms (deployed), so both orderings occurred. Local: 2×409 and 18×200. Deployed: 2×409 and 18×200. Every round ended as `analyzing/1`, so a reset to `uploading` never happened. The repo's own race test only ever hit 409 on deployed (DB first in all 5 rounds), so the jittered probe gives the stronger evidence |
| #93: DB errors → 500 | **VERIFIED (unit)** | Route unit tests (`issues/[issueId]/route.test.ts` and `reanalyze/route.test.ts`, 9 cases) pass in the 221/221 run. I did not inject DB faults at runtime for this route |
| #96: answer succeeds once the claim is won | **VERIFIED at runtime (local, fault injection)** | Temporary Postgres triggers made the later writes fail: (a) the answer's text-message insert, and (b) the issue `answered` update. In both cases `POST /answer` returned **200**, `clarification_answers` = 1, `answered_at` was set, and the widget showed "답변 고마워요" with no error. A second answer returned **409**. Both triggers were dropped afterwards (`pg_trigger` has no `v4_%`). Screens `loc-answer-fault-{message,issue}.png`. On deployed, concurrent answers gave `[200,409,409,409]`, answers=1 and textMessages=1 (suite) |
| #98: expired token → 401 | **VERIFIED (local and deployed)** | Local suite test passed. On deployed I signed tokens with the cloud secrets from `.env.cloud`. I did not print them. Control: a fresh token → 200. A token 60 s past expiry → **401** on `GET/POST /api/messages`, `POST /api/recordings` and `POST /api/clarifications/…/answer`, with the body "인증 정보가 없거나 만료됐어요.". Admin cookie: fresh → 200, expired → **401** |
| #101/#102: docs | Checked | `review-log.md` has 29 UX rows. `qa-matrix.md` has the re-test table. One inaccuracy: it says the deployed expired-token test is skipped because the secrets are "not in the runner" (V4-04) |

## 4. Deployed end-to-end loop (cloud worker)

Customer on https://lattice-feedback-demo.vercel.app with a pinned `qa-v4e2e-*` user. Admin at 1440. Step logs: `logs/dep-loop-{1440,360}-steps.log`.

| Step | Customer 1440×900 | Customer 360×740 |
|---|---|---|
| Open widget | axe 0 | axe 0 |
| Narration recording (68 s) → sent | ok | ok |
| Cloud worker | **3 issues** in 26 s (2 clear, 1 ambiguous) | **3 issues** in 32 s |
| Approve the clarification → widget card | 969 ms; axe 0 | 907 ms; axe 0 (`dep-loop-360-07`) |
| Customer answers | "답변 고마워요"; admin shows "고객 답변", issue `answered` | same |
| Resolve issue A ("부탁하기") → reverify card | card shown; axe 0 | card shown; axe 0 (`dep-loop-360-12`) |
| Reverify recording 15 s | `reverify_issue_id` = A, A becomes `reverify`, 20 s round trip | same |
| Admin sees it linked | chip "다시 확인 녹화", label, "원래 이슈 보기"; axe 0 | same |
| Close A as 해결됨 | `closed`, and "남은 문제" drops by 1 | same |
| Reopen issue B (resolve → reverify recording → "다시 열기") | `open`, `resolved_at` null, "반영 완료로 바꾸기" offered again; axe 0 | same |
| Console errors | **0** customer, **0** admin | **0** / **0** |
| HTTP ≥ 400 | **0** | **0** |
| Aborted requests | only navigation aborts: `/api/admin/session` on login redirect, RSC prefetches, one frame/video signed URL during reload | same |
| axe, final widget state | **scrollable-region-focusable (serious)**, see V4-01 | same |

Harness note: the reverify recordings replay the looping narration audio, so on deployed 1440 the worker found "계약서 등록 버튼 불편" in a reverify recording (see V4-06).

## 5. Usability pass (first-time customer and admin, vs. `tds-reference.md`)

What works well:
- The customer flow reads as one calm thread. There is one blue primary CTA per state ("다시 녹화해서 확인하기"), the question card keeps scene, quote, question and options in one scroll at 360, and the copy is in plain 해요체.
- The admin's new reverify UX closes the V3-02 gap. The link goes both ways and focus moves to the original issue.
- Both sides now tell the same story about an upload that never arrived.

The weak spots are again at the very end of the loop and are listed below. None of them blocks the flow.

## 6. New findings

| ID | Severity | Summary | Repro | Location |
|---|---|---|---|---|
| V4-01 | **minor** (a11y) | Once the history overflows and has no focusable control left in it, the widget message area cannot be scrolled with the keyboard. For example, after the reverify card is used up, only bubbles and recording chips remain. axe reports `scrollable-region-focusable` (serious, WCAG 2.1.1) on `.WidgetApp-module__body`. This happened locally and on deployed, at 1440 and 360. Earlier axe passes ran on short histories, so they missed it | Run the loop until about 8 messages, then run axe on the widget frame (`logs/dep-loop-360-axe.json` → `widget-final`; screen `dep-loop-360-23-widget-after-reopen.png`) | `src/components/widget/WidgetApp.tsx:210` (scroll container with no `tabIndex`/label), `src/components/widget/WidgetApp.module.css:9-14` |
| V4-02 | **minor** (UX) | The customer never hears how the reverify ends. After they send the reverify recording, the widget shows only a generic "화면 녹화 · 0:15 · 정리를 마쳤어요". When the worker finds something, it shows "문제 1건을 정리했어요", which reads like "your fix failed". Closing ("해결됨") and reopening send nothing to the customer, by design (`route.ts:31`). So the customer's last action in the loop gets no answer. A reopen in particular means "still broken", and the customer is not told someone is on it | Deployed loop: `dep-loop-1440-18-widget-after-close.png`, `dep-loop-360-23-widget-after-reopen.png`. The widget text after close and after reopen is in the step logs | `src/app/api/admin/issues/[issueId]/route.ts:31, 79` (only `resolved` messages the customer), `src/lib/feedback/recording-status-label.ts:23` (the same copy for reverify recordings), `src/components/widget/RecordingMessage.tsx:35` (a reverify recording is not labelled with its issue, unlike the admin chip) |
| V4-03 | **minor** (UX) | "확인 끝 · 해결됨" closes the issue in one click with no confirmation, and `closed` is terminal. The API rejects closed→open (409 "고객이 다시 확인한 이슈만 다시 열 수 있어요."), and the UI offers no reopen. A misclick cannot be undone. "반영 완료로 바꾸기", by contrast, has an inline confirmation | Admin, reverify issue → click "확인 끝 · 해결됨" → no way back. API: `PATCH {status:"open"}` on a closed issue → 409 (probe log) | `src/lib/feedback/issue-status.ts:22-23`, `src/components/admin/IssueItem.tsx:183` |
| V4-04 | polish (test coverage / docs) | Two security-relevant repo tests skip on deployed for reasons that do not hold. (a) The expired-token test says the production secrets are not available to the runner, but `.env.cloud` holds `CLOUD_WIDGET_TOKEN_SECRET` and `CLOUD_ADMIN_SESSION_SECRET`. (b) The RPC-guard test assumes the migration was applied, but the cloud service-role client can call the RPC directly. I ran both against deployed and both pass, so the regression gate does not cover a deploy with a missing migration. `qa-matrix.md:114` repeats claim (a) | `QA_TARGET=deployed npx playwright test e2e/qa` → 7 skipped; my `probe-api` covers both on deployed | `e2e/qa/security-api.spec.ts:47`, `e2e/qa/admin-flow.spec.ts:248`, `docs/qa/qa-matrix.md:114` |
| V4-05 | polish | An upload abandoned mid-way (the tab closed during upload, then the worker's 30-min expiry) still leaves the customer with **nothing**. The widget shows only their earlier text, because the recording message is created only on completion. The admin is told to "다시 녹화해 달라고 답장해 주세요". This does not contradict the customer side any more, but the customer is not told, and the admin panel says the same instruction twice (the "이유" box and the guide line). #80 acknowledges this path | Local: seed an `uploading` row with `upload_requested_at` = now−31 min. The worker expired it in 19 s. Screens `loc-stale-upload-widget.png`, `loc-stale-upload-admin.png` | `src/app/api/recordings/[recordingId]/route.ts:43` (message only on completion), `src/components/admin/RecordingAnalysisPanel.tsx:251-256` together with `src/lib/feedback/recording-failure.ts:57` (duplicated instruction) |
| V4-06 | polish | The worker treats a reverify recording like a fresh report. Its issues are not related to the original issue. On deployed, a reverify recording produced "계약서 등록 버튼 불편" with a "확인 필요" draft question. That pushed "남은 문제" from 3 to 4 while the admin was about to close the original. The audio was a test artefact, but a real "still broken" reverify would do the same | Deployed loop at 1440: `dep-loop-1440-15-admin-reverify-recording-analyzed.png`, step log "남은 문제 4건" | `scripts/analysis-worker.ts` (no `reverify_issue_id` handling) |
| V4-07 | polish (TDS writing) | The reverify action labels "확인 끝 · 해결됨" and "아직 안 고쳐졌어요 · 다시 열기" mix a status noun with a sentence. TDS §6.2 asks for the "~하기" action form, for example "해결됨으로 닫기" / "다시 열기", with the explanation in the existing caption | `.screens/qa-v2/functional/deployed-admin-12-reverify-choices.png` | `src/components/admin/IssueItem.tsx:187, 196` |

## 7. Verdict

**CLEAN.** There are zero blocker and zero major findings, and every suite is green:
- Documented local suite: 69/0/2.
- Deployed e2e/qa: 63/0/7, with all skips intentional.
- Worker specs: narration and silent, local and deployed, 4/4 passed.
- Unit tests: 221/221, with lint and typecheck clean.
- Deployed end-to-end loop: passed at 1440 and at 360.

V3-01..05 are VERIFIED, and every architect follow-up is VERIFIED. #93 is verified by unit tests only. The RPC guard and the expired-token check are now verified against the cloud as well.

The open work is 3 minor findings and 4 polish findings:
- V4-01: the keyboard cannot scroll the widget history.
- V4-02: the customer gets no closure on reverify.
- V4-03: closing an issue is irreversible and has no confirmation.
- Polish: V4-04 to V4-07.
