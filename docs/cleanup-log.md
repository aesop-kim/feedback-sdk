# Cleanup log (AI-slop pass, standard mode)

Scope: `src/**`, `scripts/**`, `e2e/**`, `demo/scripts/**`. Out of scope: `supabase/migrations/**`, `demo/scenes/**`.
Rule: behavior stays the same. API contracts, DB shape, UI copy and visual design are not touched.

## Baseline (before any edit)

- `npx vitest run`: 13 files, 86 tests passed
- `npx tsc --noEmit`: 0 errors
- `npx eslint`: 0 problems

## Smells found, safest first

### Pass 1: dead code and unused exports

1. `src/lib/analysis/issue-schema.ts:35`: `AnalysisResult` type is exported and never used anywhere. Delete it.
2. Exports used only inside their own file. Drop the `export` keyword:
   - `src/hooks/use-widget-recording.ts:14-15`: `SCREEN_DENIED_MESSAGE`, `MICROPHONE_DENIED_MESSAGE`
   - `src/sdk/bridge-protocol.ts:4`: `BRIDGE_NAMESPACE`
   - `src/lib/analysis/align-timeline.ts:21`: `CLICK_MATCH_WINDOW_MS`
   - `src/lib/analysis/issue-schema.ts:8,10,15`: `MAX_TITLE_LENGTH`, `clarificationDraftSchema`, `analysisIssueSchema`
   - `src/lib/analysis/build-analysis-context.ts:19`: `CONTEXT_WINDOW_MS`
   - `src/lib/recording/upload-recording.ts:8`: `UPLOAD_CONCURRENCY`
   - `src/lib/recording/frame-capturer.ts:8,10`: `FRAME_LONG_SIDE`, `MIN_CLICK_FRAME_GAP_MS`
   - `src/lib/feedback/feedback-repository.ts:66`: `createSignedUrlMap`
   - Exported *types* that are only used in their own file stay exported. They describe the module surface and cost nothing at runtime.
3. Debug leftovers: none found. The `console.log` calls in `scripts/**`, `demo/scripts/**` and `e2e/full-flow.spec.ts` are deliberate CLI or latency output.

### Pass 2: duplicate logic

4. Supabase relation unwrapping (`Array.isArray(x) ? x[0] : x` plus an `as` cast) is repeated in 4 places:
   - `src/app/api/admin/clarifications/[cardId]/approve/route.ts:32,37`
   - `src/app/api/admin/issues/[issueId]/route.ts:32`
   - `src/app/api/clarifications/[cardId]/answer/route.ts:25-26`
   - `src/lib/feedback/feedback-repository.ts:245`
   Fix: add `src/lib/supabase/first-relation.ts` with `findFirstRelation` (the row may be missing) and `getFirstRelation` (the row must exist, as with `!inner` joins). Each call site keeps the same point of failure it has today.
5. Realtime signal sending (`channel()` → `httpSend` → warn → `removeChannel`) is duplicated in `src/lib/realtime/send-signal.ts:10-20` and `scripts/analysis-worker.ts:292-301`.
   Fix: add `src/lib/realtime/send-channel-signal.ts`, which takes the Supabase client as a parameter and does not import `server-only`, so the worker can use it. `send-signal.ts` and the worker both call it.
6. Highlight/zoom frame state (zoom toggle, measured image aspect, transform, canvas style, `onLoad` aspect capture) is duplicated in `src/components/admin/FrameThumbnail.tsx:22-63` and `src/components/widget/ClarificationCard.tsx:122-152`. The math is already shared in `src/lib/geometry/focus-transform.ts`.
   Fix: add `src/hooks/use-scene-zoom.ts`. Markup, copy, class names and aria stay in each component.
7. Not merged, on purpose: `formatRecordingDuration` (`src/lib/recording/format-recording-time.ts:3`) and `formatDuration` (`src/lib/format/duration-format.ts:2`). They behave differently: one rounds and the other floors (`41_600ms` gives `0:42` and `0:41`), and only `formatDuration` has an hour form. Merging them would change the numbers on screen. The same goes for `formatMessageTime`, which uses the browser's local time zone (widget, end user), and `date-format.ts`, which is pinned to Asia/Seoul (admin).
8. Not merged, on purpose: Supabase client setup in the 4 scripts. Each script loads env differently and validates differently, so sharing the setup would mean changing how each one starts.

### Pass 3: naming and error handling

9. get/find rule violations (a function that always returns a value but is named `find`):
   - `demo/scripts/assemble.mjs:147`: `findCue` throws instead of returning nothing. Rename to `getCue`.
   - `src/lib/feedback/feedback-repository.ts:81`: `findCardsWithAnswers` always returns `{ cards, answers }`. Rename to `getCardsWithAnswers`.
   - `src/lib/format/date-format.ts:25`: the local `findPart` always returns a number. Rename to `getPart`.
10. Abbreviations: identifiers are clean. `frameRef` (`src/lib/analysis/issue-schema.ts:22`) is a field in the LLM JSON schema contract and checked by `check:analysis`, so it is left alone. The `btn` in CSS token names is visual-system surface and also left alone.
11. Error handling: consistent enough. Routes return `respondError`, hooks map failures to UI copy, and scripts print `error.message`. No change.

### Pass 4: behavior locks

12. Add a unit test for `first-relation.ts` (object, array, empty array, null) because it replaces 4 inline branches.
