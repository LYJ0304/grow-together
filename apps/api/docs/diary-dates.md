# Diary dates and calendar lookup

New `POST /api/v1/diary` requests require `diaryDate` (`YYYY-MM-DD`), the local
record date chosen by the user. It is not a timestamp and is not inferred from
Todo dates. Past and future record dates are allowed. `PUT /api/v1/diary/{id}`
continues to replace content and associations without changing the date.

V8 adds a nullable `diary_date` and the `(user_id, diary_date)` unique constraint.
Concurrent same-user/same-date creates return one 201 and one 409. Different
users can use the same date. Deletion frees that date for another create.

Existing rows retain `NULL` because their actual dates cannot be recovered
reliably. Their ID-based read/update/delete remain available; they are excluded
from date/month queries. No data is guessed, deleted or backfilled. Assigning
dates to legacy rows and local-device diary migration are separate work.

- `GET /api/v1/diary?month=YYYY-MM`: date-ascending `{id, diaryDate}` array,
  empty array for an empty month. No content or attachments in this response.
- `GET /api/v1/diary/by-date?date=YYYY-MM-DD`: full diary response or 404.
- All queries use the authenticated owner; another user's data is never returned.

The mobile calendar now loads each month from the server and opens the selected
date. The editor checks for an existing date before starting a new diary. Failed
lookups block creation rather than appearing as an empty date. Save/delete
invalidates the calendar, detail and date lookup caches. Duplicate/conflicting
writes preserve the draft and offer explicit existing-diary lookup.

This is the date/calendar subset of #71 and #72. Photo upload, extended diary
content, local-record migration, AI generation and deployment are not included.

## Rollout compatibility

Apply V8 with the API and release the mobile caller sending `diaryDate` together.
Older clients that omit it receive 400 on create; no server-time fallback is used.
ID-based reads and existing update/delete requests remain compatible. API and
mobile versions/tags are not changed by this implementation. Deployments and
legacy date repair require separate operator work.
