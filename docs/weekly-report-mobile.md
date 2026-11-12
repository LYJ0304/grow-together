# Weekly report mobile draft (#183)

This draft deliberately precedes API #184 and worker #185. It is a reviewable
mobile foundation, **not a completed report MVP**. The user selected a draft PR
first and deferred real API integration until #184. Keep #183 open.

## Implemented

- Five existing-navigator tabs: 오늘 / 일정 / 기록 / 리포트 / 질문. Existing nested
  records navigation, TabIcon, TabButton, Safe Area and keyboard guards remain.
- Report header and ISO Monday–Sunday browsing based on Asia/Seoul, independently
  of the device timezone. Future weeks are disabled. Week selection uses the
  existing session store and resets with the existing authentication boundary.
- The authenticated app displays an honest preparation state, with links to the
  existing schedule and records screens. It does not fetch guessed endpoints,
  classify unavailable data as empty, generate AI text, or load sample reports.
- Preview displays a login requirement and leaves preview via the existing auth
  session method. It never pretends local preview data is a server report.
- `ReportContent` renders presentation resources: unavailable, loading, error,
  loginRequired and ready. The ready view separates actual counts/excerpts from AI
  content, handles no reflection data / missing diaries / null rates, keeps source
  records visible when AI fails, and exposes explicit memory/suggestion/generation
  callbacks. Rendering alone triggers no generation or schedule write.

## Integration seam

`src/lib/features/report/view-model.ts` is a **presentation model, not an API DTO**.
Its field and state names do not establish #184's JSON contract. The app currently
supplies only unavailable/loginRequired. Ready data exists only in isolated unit
fixtures; there is no mock-data route or environment bypass for report contents.

After #184 establishes the canonical contract, add the API DTO/parser/client and
map validated server data into this model. Preserve authoritative server metrics;
do not calculate aggregate counts, completion rate or eligibility in the UI. Bar
height normalization is visual only. Keep unavailable distinct from a genuinely
successful empty report. Original memory excerpts must remain original text.

The remaining #183 work depends on #184/#185:

1. Bind actual authenticated GET and explicit POST using existing TanStack Query,
   accountKey/epoch/week keys and cancellation/session guards. No Worker secrets
   or direct Worker calls belong in mobile.
2. Map agreed time/asOf/future-week policy, sourceHash, promptVersion, evidence,
   truncation and insight states. Retain verified evidence references; do not infer
   facts or diagnoses from existing IDs. Reject malformed or stale responses.
3. Separate query failure from generation failure/loading. Profile absence must
   leave valid base statistics usable and use the existing registration guidance
   for personalized generation. Respect the final server eligibility contract.
4. Connect `onMemory` to the existing diary route using a validated date, and
   `onSuggestion` to the existing schedule preview/initial instructions with an
   explicit input-conflict policy. The current callback boundary performs no
   schedule routing, generation or save. User confirmation must remain mandatory.
5. Invalidate/refetch reports and insight versions after todo/diary/profile changes,
   including edits/deletes and eligibility time boundaries. Ignore late results
   after account/week/source changes; never reuse another account's insight.
6. Validate against the actual API/Worker and document real provider vs fixture
   results. Canonical contract changes belong to #184; synchronize all three issues.

No API, worker, database, authentication, diary or schedule generation contract is
changed in this draft. No new runtime or test dependency was added. No development
observation questionnaire, diagnosis, growth score or parent ranking is introduced.

## Validation

- `npm run test:report`: Seoul midnight/week/year/leap boundaries and strict date
  validation; isolated presentation tests for real excerpts, AI failure isolation,
  null rate, empty/unavailable distinction and explicit callbacks.
- `npm run test:report:ui`: actual app five-tab navigation, Seoul week browsing on a
  non-Seoul browser, retained week, preparation/login states, no report network calls,
  and 320/390/landscape/wide layouts with accessible touch sizes.
- Existing main/calendar/chat/diary navigation/header, auth/registration/onboarding,
  schedule and motion checks verify shared navigation regressions. Update former
  four-tab assertions to five; retain their existing behavior checks.
- Run typecheck, lint, format, colors/brand checks and web/iOS/Android exports.
  Browser fixtures and bundle compilation are distinct from native device QA.

The week and five-tab behavior had observed RED failures before implementation.
Presentation fixtures verify the draft component boundary; they do not establish
real report aggregation, insight generation, cache correctness or end-to-end API
integration. Those remain incomplete until the dependent work lands.
