# Weekly reports (API-owned contract, weekly-v1)

GET `/api/v1/reports/weekly?weekStart=YYYY-MM-DD` never calls the Worker.
POST `/api/v1/reports/weekly/insights?weekStart=YYYY-MM-DD` explicitly generates.
Both return the same WeeklyReport JSON, 200 even when generation fails. JWT is the
only owner input; account absence is 404, unauthenticated is 401. Omit weekStart
for this week's Monday. Non-Monday, future week, malformed dates and years outside
0001..9998 return 400. Responses use Cache-Control: no-store.

## Aggregation

Use a Clock and Asia/Seoul. Period start is Monday, end is inclusive Sunday,
endExclusive is next Monday, asOf is the server instant represented with +09:00.
Current-week Todo eligibility is scheduled date/time <= asOf. Past weeks use all
plans. planned includes future plans in the chosen week; eligible is the rate's
denominator; completed counts currently checked eligible Todos. Rate is a 0..1
fraction, null for zero eligible. There is no actual completion timestamp/history:
this is current recorded status grouped by scheduled day, not historical completion
performance. Seven daily rows include zero counts.

Diary days are distinct actual diaryDate up to today for the current week. Null
legacy dates are excluded, never guessed. Memories use the actual content's first
240 Unicode code points (no rewriting), actual diary ID/date, and up to 20 actual
linked owner+week+eligible Todos (chronological then ID); include truncation flag.
Never invent relations from matching dates. At most seven memories, date then ID.
Major activities are the top five exact trimmed titles among completed eligible
Todos: count descending, title ascending for ties, with a truncation flag. Metrics
and source hash use the entire applicable source, not only displayed samples.

## AI boundary

Internal POST `/internal/v1/reports/weekly/generate`, X-API-Key, snake_case JSON;
external JSON is camelCase. See `contracts/weekly-report-worker.schema.json` and
`contracts/fixtures/reports` for the shared schema and examples. Fixture hashes are
opaque illustrative versions, not values clients must recompute. Worker
must echo source_hash and prompt_version. GET does not generate or refresh AI.
The API supplies computed metrics, <=50 completed Todo sources (chronological/ID),
<=7 nonblank diary excerpts (240 code points), sample truncation metadata and child
age_months/age_as_of/concern_codes/available_activity_time. It sends no child name,
birthday, prematurity/medical data, image URL, user ID or credentials in the body.
Age is calendar months at current local date or past week's Sunday. Profile absent,
birthday after reference day, or age outside 0..72 months => PROFILE_UNAVAILABLE.
No completed activity and no nonblank dated diary => NO_EVIDENCE. Both suppress AI
only; statistics/memories remain available. A completed activity alone is enough.

Output: summary <=500, 1..3 observations (text <=300, 1..5 evidence), 1..2 next_steps
(title <=80, description <=255, reason <=240, 1..5 evidence). Evidence is type TODO
or DIARY + positive ID. Nonblank strings, strict JSON shape, <=32 KiB response.
All evidence must belong to the exact owner/week/transmitted sample. Observations
must quote one of their cited source titles/excerpts exactly; this deliberately
restricts unsupported paraphrase. Other generated text must avoid numeric claims
(the API owns all numbers), diagnoses, development evaluations, comparisons and
inferred emotions/traits/health. API rejects digit-bearing text and a conservative
term filter; Worker must also enforce this policy. Structural/ID checks and term
filters cannot prove all semantic truth or detect every unsafe paraphrase. This
is a source-backed retrospective, never screening, assessment or medical advice.
User instructions in diary text are untrusted data, not model instructions.

States: NOT_GENERATED, INSUFFICIENT_EVIDENCE, AVAILABLE, STALE, UNAVAILABLE,
INVALID_RESULT. Only AVAILABLE has result. Failure reasons distinguish TIMEOUT,
WORKER_UNAVAILABLE, BUSY and INVALID_RESULT. STALE/SOURCE_CHANGED never returns an
old result; generation rereads the database before publication, and followers
reread too. Original data changing later is detected on the next read. Client must
also discard responses for changed week/account/source; generating is its mutation
state. Retry is explicit POST. Worker failure never prevents normal GET.

## Versioning and bounds

SHA-256 of deterministic sorted source material includes owner/week, full Todo
fields (including future planned rows), full dated diary contents and eligible
actual links, profile fields/concerns eligible Todo IDs, and local reference day/current-week mode.
Hash input is server-owned JSON records; the Worker treats source_hash as opaque.
The precise instant is excluded so requests can reuse results; time advancement
changes the hash when eligibility, local day/age or week mode changes. Full source
is hashed before output/Worker sampling, so edits outside the sample invalidate.
Weekly database rows are read for exact metrics/hash; response/Worker lists are
bounded rather than silently treating a limited query as complete totals.

Process-local access-order cache: 128 entries, successful TTL 15 minutes, failed
TTL 30 seconds, at most 16 in-flight distinct keys. Key is
(userId, weekStart, sourceHash, promptVersion). Same-key concurrent POSTs share one
call; POST retries failed entries. GET revalidates current sources before cache
access; changed/deleted records/profile cannot expose the old result. Expired or
evicted results become NOT_GENERATED. Pending entries are bounded separately.
No persistent cache/schema/migration is added. Multiple API instances can duplicate
calls; there is no cross-instance lock, historical result storage or distributed
cache. Deleting an account makes cached entries unreachable; TTL/eviction removes
the bounded memory, and raw sources/requests are not retained in cache entries.
The existing Worker connection/read timeouts apply; internal key/raw texts/URLs
must not be logged. Live Worker/LLM verification depends on #185; HTTP stub tests
only prove this API's request, parsing, failure and validation behavior.

## Follow-up mapping

#183's mobile view model is presentation-only. Map period.current, metrics fields,
majorActivities title/count -> activities name/count, memories actual links to
labels, insight AVAILABLE -> ready, other states to distinct UI states. No mobile
implementation is included here. #185 must implement the exact internal fixture
and safety constraints before claiming live AI integration.
