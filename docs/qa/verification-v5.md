# Verification v5: independent check of the V4 fixes on deployed

- Date: 2026-11-12, 06:20–06:30 KST. Repo `main` @ `ef336f1` (#114).
- Deployed state:
  - At 06:20 KST both deployed apps reported `age` about 300 s, so they were deployed after #114 merged at 06:06.
  - The widget HTML already contains the new `대화 내용` region label.
  - The cloud worker (the process with the cloud `NEXT_PUBLIC_SUPABASE_URL`) started at 06:14, after #114. I did not restart any process.
- Scope:
  - V4-01..07 (PRs #104 #106 #108 #110 #112 #114).
  - One more full customer/admin loop on DEPLOYED at 1440×900, through close and reopen.
  - This is a report only. I changed no source code.
- Not repeated, because the lead already ran them: deployed `e2e/qa` (67/0/5) and the deployed narration worker spec.
- Tools:
  - The repo's Playwright: Chromium with the fake-media flags, and `fixtures/demo-recording/narration.wav` as the microphone.
  - axe-core, full set: wcag2a, wcag2aa, wcag21a, wcag21aa and best-practice.
  - I did not use Claude-in-Chrome or Aside, because neither can feed a fake microphone.
- My specs are in `.screens/qa-v2/verify5/specs/` (git-ignored), run with `--config .screens/qa-v2/verify5/specs/pw.config.ts`:
  - `loop`
  - `stale`
  - `check`
- Evidence:
  - Screenshots: `.screens/qa-v2/verify5/*.png`, prefixed `dep-`.
  - Step logs and axe JSON: `.screens/qa-v2/verify5/logs/`. The cloud host and signed-URL tokens are redacted.
- Cleanup: after all runs the cloud has **0** `qa-*` end users and **0** recordings in `uploading`, `uploaded` or `analyzing`. I did not touch the 김데모 data.

## 1. Fresh checks

| Run | Result |
|---|---|
| `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` | 0 type errors, lint exit 0, **241/241** tests (36 files) |
| Deployed `stale` (V4-05) | **1 passed** (1.4 min) |
| Deployed `loop` at 1440 (V4-01/02/03/06/07 + regression) | **1 passed** (3.4 min) |
| Deployed V4-04 tests: `QA_TARGET=deployed … -g "만료된 대화 토큰\|replace_recording_issues는"` | **2 passed** (3.9 s), with no skip |

## 2. V4 items

| ID | v4 severity | v5 status | Evidence (deployed) |
|---|---|---|---|
| V4-01: keyboard cannot scroll the long history | minor | **VERIFIED** | The final widget had 13 messages: scrollHeight 931, clientHeight 508. The scroll container has `role=region` "대화 내용" and `tabindex=0`. axe `widget-final` reported **0 violations** over the full rule set, which includes `scrollable-region-focusable`. The region is reached with Shift+Tab from the message box. With it focused: Home → scrollTop 0, End → 423, Home then 3×ArrowDown → 120. An inset blue focus ring is visible (`dep-loop-1440-17-widget-region-keyboard.png`) |
| V4-02: the customer never hears how the reverify ends | minor | **VERIFIED** | Widget cards read "‘계약서 등록 버튼 무반응’ 다시 확인 녹화 · 0:30" and "‘표 머리글 '계약 금액' 오타’ 다시 확인 녹화 · 0:12", each with "받았어요. 확인하고 알려 드릴게요". Neither shows "문제 N건". The live widget got "‘…’ 확인해 주셔서 고마워요. 해결로 정리했어요." after the close, and "‘…’ 아직 남아 있는 걸 확인했어요. 다시 고칠게요." after both reopens (closed→open and reverify→open). DB system messages, in order: resolve A, close A, reopen A, resolve B, reopen B. That is exactly 5, with no duplicates. Choosing "다음에" sent nothing: the system-message count stayed at 1 (`dep-loop-1440-09`, `-11`, `-15`) |
| V4-03: close is one click and irreversible | minor | **VERIFIED** | "해결됨으로 닫기" opens the group "해결됨으로 닫기 확인": "해결됨으로 닫을까요? · 닫기 · 다음에", captioned "…닫은 뒤에도 다시 열 수 있어요". Focus lands on "닫기" (`dep-loop-1440-07`). "다음에" leaves the issue `reverify`. "닫기" makes it `closed`. The closed issue offers "다시 열기", which gives `{status: open, resolved_at: null}`, and "반영 완료로 바꾸기" comes back (`-08`, `-10`) |
| V4-04: security tests skipped on deployed | polish | **VERIFIED** | Both tests ran on deployed and passed (above). `qa-matrix.md:179` now reads PASS/PASS with the `.env.cloud` reason |
| V4-05: an abandoned upload leaves the customer with nothing | polish | **VERIFIED** | I inserted an `uploading` row with `upload_requested_at` = now−31 min for a fresh `qa-v5s-stale` conversation. The cloud worker set it to `failed` after **58 s**. The open widget showed "보내던 화면 녹화가 끝까지 올라가지 않았어요. 번거로우시겠지만 한 번 더 녹화해 주세요." in realtime, with no reload. One worker cycle (+20 s) later the message still existed **once**. Admin panel text: "녹화를 끝까지 받지 못했어요 \| 고객이 업로드 중에 페이지를 떠났을 수 있어요. 받은 영상이 없어서 다시 정리할 수 없고, 고객에게는 다시 녹화해 달라고 알렸어요." "다시 녹화해 달라고" appears **once**, and the reason box is gone (`dep-stale-widget-live.png`, `dep-stale-admin.png`). 0 console errors and 0 HTTP ≥ 400 |
| V4-06: reverify recording treated as a fresh report | polish | **VERIFIED**, with a residual (V5-01) | Reverify recording `edf2d2b0` for A had `reverify_issue_id` = A and was analyzed by the cloud worker in 18 s. It produced 1 issue, "계약서 등록 버튼 무반응", reusing the original title as the new prompt asks. That issue has `confidence=clear` and **0** `clarification_cards`. The panel shows **0** "확인 필요" and **0** "고객에게 물어보기". The panel heading reads "다시 확인에서 찾은 내용 1건", with the caption "남은 문제에는 세지 않아요…". "남은 문제" stayed at **3** with A in `reverify` plus the derived issue (v4 showed 4). It went to 2 after the close, back to 3 after reopening A, and stayed at 3 after B's reverify and reopen. All counts match the open, answered and reverify issues of the original recording |
| V4-07: action labels mix a noun with a sentence | polish | **VERIFIED** | The reverify group reads "고객이 다시 녹화해 보냈어요. 고쳐졌으면 닫고, 아직 남아 있으면 다시 열어 주세요. 어느 쪽이든 고객에게 알려요 \| 해결됨으로 닫기 \| 다시 열기" (`dep-loop-1440-06`) |

## 3. Deployed loop at 1440 (cloud worker)

| Step | Result |
|---|---|
| Open widget | axe 0 |
| Narration recording 68 s → sent | ok |
| Cloud worker | 3 issues in 29 s (2 clear, 1 ambiguous). Admin axe 0. List shows "남은 문제 3건" |
| Clarification approved → customer answers | "답변 고마워요". The admin shows "고객 답변" |
| Resolve A → reverify recording 30 s (clicks 계약서 등록) | `reverify_issue_id`=A, A becomes `reverify`, the widget card is labelled. Analyzed in 18 s |
| Admin sees it linked | Label "‘계약서 등록 버튼 무반응’ 다시 확인 녹화" and "원래 이슈 보기". axe 0 |
| Close A (confirm: cancel, then close) → reopen A from closed | `closed`, then `open`/`resolved_at` null. The customer is told both times |
| Resolve B → reverify recording 12 s → "다시 열기" from reverify | `open`/null. The customer is told. Admin axe 0. Analyzed in 12 s |
| Final widget | axe 0. Keyboard scroll works (V4-01) |
| Console errors | **0** customer, **0** admin |
| HTTP ≥ 400 | **0** |
| Aborted requests | Admin only, all navigation aborts: `/api/admin/session` on the login redirect, one conversation RSC/API fetch during `reload()`, and one signed `video.webm` URL during reload. This is the same class v4 accepted |

There were no dead ends. Every state the admin can reach offers a next action or a final note, and every action the admin takes now reaches the customer.

## 4. New findings

| ID | Severity | Summary | Repro / evidence | Location |
|---|---|---|---|---|
| V5-01 | **minor** (UX) | An issue found **in a reverify recording** still renders the normal open-issue action "반영 완료로 바꾸기". Clicking it is allowed (`open → resolved`). It would send the customer a second "‘계약서 등록 버튼 무반응’ 수정을 반영했어요. 같은 화면에서 한 번 더 확인해 주세요." for a duplicate of an issue that is still waiting in `reverify`. It would also open a new reverify request tied to the derived issue rather than the original. The panel caption says to decide on the original issue, but the button invites acting on the derived one. These issues stay `open` in the DB indefinitely after the original is closed. They are not counted, so this is housekeeping only | Deployed loop: expand the derived issue under "다시 확인에서 찾은 내용 1건" → "반영 완료로 바꾸기" count = 1 (`dep-loop-1440-05-admin-reverify-derived-issue-expanded.png`, step log 21:25:00). I did not click it, to avoid side effects. The behavior follows from the code path | `src/components/admin/RecordingAnalysisPanel.tsx:187-199` (reverify issues use the full `IssueItem`), `src/components/admin/IssueItem.tsx:153-154` (`default → ResolveButton`), `src/lib/feedback/issue-status.ts:23` (`resolved` accepts `open` regardless of the recording) |
| V5-02 | polish (copy consistency) | The admin thread chip for a reverify recording still reads "다시 확인 녹화 0:29 · **문제 1건**". The panel calls the same thing "다시 확인에서 찾은 내용 1건" and says it does not count as a remaining problem. The chip makes the reverify look like a new problem, which is what V4-06 set out to remove | `dep-loop-1440-05` (thread, 2nd chip) | `src/components/admin/ThreadMessage.tsx:82-84` (`getAdminRecordingStateLabel` is used without `isReverify`) |

## 5. Verdict

**CLEAN.**
- V4-01..07 are all **VERIFIED** on deployed with fresh evidence.
- The deployed 1440 loop passed through close, cancel, reopen from closed, and reopen from reverify, with 0 console errors, 0 HTTP ≥ 400, and axe 0 on every checkpoint.
- Types, lint and unit tests (241/241) are green.
- New findings: 1 minor (V5-01) and 1 polish (V5-02). There are no blocker or major findings.
