# Child onboarding

Authenticated accounts enter `/onboarding` only after `GET /api/v1/children/me`
returns 404. Loading and failed requests block interaction with protected screens;
existing profiles keep their destination, including deep links. An existing profile
with empty optional fields does not require onboarding again. `/children` retains
basic editing and offers **개인화 설정 수정** for the five-step editor. Preview mode
keeps its local basic profile flow and never submits onboarding to the API.

The steps collect name/birthday, up to two concerns (`none` is exclusive), optional
observations, and optional daily activity time, then review the actual inputs.
Names are trimmed and dates use the local calendar. Prematurity is optional; a due
date is optional for `yes` and must follow the birthday, including future due dates.
Changing away from `yes` clears it. Completed months use the birthday day within
the current month; 0–48 months are eligible for reviewed content, while older
profiles may still register. No corrected age is calculated.

There are currently no approved observation questions. The typed question catalog
records version, source, domain, applicable months, age basis and review status,
but is empty. The observation step explains this and allows skipping. It never
invents milestones, scores, diagnoses or routine results. The final title is
“우리 아이의 첫 루틴을 준비했어요”, with an explicit explanation that registration
only saves inputs and has not generated an AI routine.

## Persistence and API compatibility

The existing POST/GET/PUT `/api/v1/children/me` contract from #170 / #173 is used.
The complete optional object contains `prematurityStatus`, `expectedDueDate`,
`concerns`, `availableActivityTime` and empty `developmentObservations`. Current
API responses normalize all five fields. The basic profile editor omits the object
so the API preserves it; the personalization editor submits its complete value.
No API implementation or OpenAPI change is part of #171. Worker use remains #172.

The client verifies name, birthday and optional fields against the response before
claiming full success. A legacy response without personalization offers an explicit
basic-only completion and retains inputs until that choice. Existing legacy
profiles have optional controls disabled. A lost response, 409 or server failure
blocks repeated registration until the user checks the existing server profile.
It never converts a failed POST into an automatic PUT. A differing existing profile
requires an explicit choice to continue with that profile.

Drafts are scoped to the authenticated account and expire after 24 hours. Web uses
sessionStorage (reload within the tab); native uses a separate SecureStore key.
Re-entry offers resume/discard, and success/discard/logout/expiry remove the draft.
Queued writes use account revisions so logout cannot be followed by a stale write.
Storage failures are visible. Session epochs also prevent old request results from
being applied to another account. Drafts contain no credentials.

## Platform validation

All platforms use the same React Native DateField modal. Year/month/day lists
and direct numeric year entry support older birth years without month-by-month
navigation. Only Done commits the local date; Cancel, Escape and Android Back
preserve the field. Changing year/month clamps leap days and month ends; birthday
choices stop at today, while optional due dates retain their unrestricted range.
The field shows a Korean date and calendar icon; modal actions reuse primary and
tertiary ActionButton variants. There is no native-picker or HTML-date override.
The UI uses Safe Area, keyboard avoidance, scrolling, 44px minimum targets, selected
accessibility states, step announcements/focus and Reduce Motion-aware transitions.

Validation commands in `apps/mobile`:

- `npm run typecheck`, `npm run lint`, `npm run format:check`
- `node tests/date-field.mjs`, `node tests/date-modal-ui.mjs` — shared date model,
  commit/cancel, keyboard and responsive modal flows.
- `npm run test:children:onboarding` — calendar boundaries, selection rules,
  response verification, account-scoped drafts, expiry and logout/write races.
- `npm run test:children:onboarding:ui` — new/existing/error gates, five steps,
  resume, legacy API, uncertain saves, duplicate registration and editing.
- Existing `test:children:api`, `test:children:storage`, `test:children:ui`,
  `test:auth`, `test:auth:ui`, `test:main:ui` regression checks.
- `test:children:live` with `CHILDREN_URL` and `CHILDREN_API_URL` pointing at an
  isolated local API/PostgreSQL verifies actual GET/POST/PUT persistence and login
  restoration. It creates disposable accounts; do not use a production API.
- `npx expo export --platform all` checks web, Android and iOS bundling.

Browser tests include small screens and failure paths. Native bundle success does
not establish real-device modal, keyboard or screen-reader behavior; these
still need device QA. No production deployment or AI generation is performed.
