# OpenAPI synchronization

`contracts/openapi.yaml` is the canonical external Spring API contract. API resource
processing copies it to `/openapi.yaml` for Swagger UI; generated `/v3/api-docs`
is disabled. Keep this arrangement unless the task explicitly changes it.

## Scope and timing

Update the contract with implementation, including direct requests outside `start`.
`ship` is the final check for omissions on its publish path. Its merged-PR
cleanup-only path never starts contract edits, checks, commits, or publication.

Assess the complete task against its established PR base, including existing task
commits, staged/unstaged changes, and untracked task files. For example, use
`git diff <remote>/<base>...HEAD --name-status`,
`git diff --cached --name-status`, `git diff --name-status`, and
`git ls-files --others --exclude-standard` to identify candidates. These
commands locate changes; inspect their contents to decide impact.

Start with changed files and related schemas, then follow relevant dependencies.
Check routes/methods, request and response fields, required/nullability/format/length
constraints, authentication/authorization, status codes, headers, and error bodies.
DTOs, service validation, security configuration, exception handlers, and changes
in other modules can affect the external contract even without Controller edits.
UI-only or worker-internal changes with no external Spring API effect need no
contract edit; report that reason without loading unrelated code or rewriting YAML.

## Update and verify

- Reflect implemented behavior only. Preserve unrelated local contract edits;
  resolve overlap before editing or staging. Do not invent endpoints or product
  policy to reconcile an ambiguous requirement.
- Reuse shared schemas/responses where appropriate. Match constraints to DTOs,
  service rules, and persistence guarantees; do not infer response guarantees
  solely from request validation.
- Reuse available parsers/validators to parse YAML and resolve all `$ref` targets.
  Compare affected operations and schemas with the actual implementation, including
  security and exception paths. Lint checks the declared spec; spec diff compares
  two specs. Neither establishes agreement with changed Java code by itself.
- Run relevant existing API tests from `apps/api`, including
  `./gradlew test --tests '*SwaggerUiIntegrationTest'` when changing the served spec,
  plus tests for affected validation/auth/error behavior. That Swagger test proves
  canonical-file delivery and UI wiring, not full implementation conformance.
- Resolve known mismatches and failed required checks before publication. Disclose
  missing prerequisites and skipped/unverified coverage; do not report success for
  an unexecuted or failed check. Apply the usual TDD rules to runtime/script changes;
  specification-only edits use contract validation rather than a forced RED cycle.

## Handoff and publication

Record OpenAPI changes and validation, or no impact with a concrete reason, in the
implementation handoff and PR. Ship stages explicit task paths including contract
fixes and reconciles the final domain labels (including `contracts` when affected).
The normal authorization, unrelated-work preservation, and cleanup boundaries apply.
