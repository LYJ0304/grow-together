# Harness conventions

AGENTS.md remains the source of development rules. Read only the skill needed
for the current request. Requirements in the user's request take precedence.

## Stage handoffs

`plan → raise → start <issue-number> → ship`

The plan is shown in the conversation, including subsequent user corrections.
`raise` consumes that selected plan and returns an issue number/URL. The GitHub
issue persists the requirements; `start` reads it without a local plan file and
returns repository, issue, base, PR target, intended merge method, task branch,
actual checkout path (primary or linked), change scope, executed checks/results, and remaining limitations.
`ship` verifies the latest handoff against Git/GitHub and returns commits, PR URL,
verification and `awaiting merge; environment retained` with the actual branch/path.
A later ship invocation or separately requested merge verifies the completed merge
before safe cleanup; it reports removal or the reason for retaining the environment.

`review <PR-number>` is an independent stage after publication: open PR →
correctness, safety, and code quality review → Korean GitHub `COMMENT` summary
and inline findings, with the reviewed SHA and verification limits. Use
`ship → review <PR-number> → fixes → ship` for follow-up; ship does not invoke
review automatically. Invoking review authorizes comment publication, not code
edits, approval, REQUEST_CHANGES, merge, or environment cleanup. The
[review skill](skills/review/SKILL.md) owns snapshot checks, finding quality,
deduplication, and failure handling. Its handoff reports PR/review links, reviewed
SHA, findings, actual checks and limits, and publication status.

Only perform requested stages. Explicitly combined requests authorize that
sequence without another confirmation; standalone stages stop at their own
boundary. Existing issues can go directly to start. If a new session lacks a
selected plan, ask for its text or a planning request rather than inventing it.
Do not generate/search a plan directory to bridge missing conversation context.
Save a plan only on an explicit file-output request and preserve existing user
plan files. GitHub body-file transport uses a temporary file outside the repo.

## Names and GitHub formatting

- Resolve the GitHub repository from the current Git remote, then pass
  `--repo <owner/repo>` to `gh` commands. Do not hardcode this repository in skills.
- Read any existing issue/PR templates first. Use `feat`, `fix`, `docs`, or
  `chore` according to the final change and the actual module identifier as scope.
- Issue titles must use `<type>(<scope>): <한글 설명>`, for example
  `docs(harness): 병합 후 작업 환경 정리 규칙 개선`. Issue bodies must be in Korean.
- PR titles must use `<type>(<scope>): <English description>`, for example
  `feat(auth): persist mobile sessions`. PR bodies must be in Korean, including
  the problem, behavior, verification, and remaining limitations.
- Commit titles must use `<type>(<scope>): <English description>`; any commit body
  must also be in English. Example: `feat(auth): persist mobile sessions`.
- Korean prose requirements leave code, commands, paths, product names, URLs,
  `type(scope)` identifiers, and `Closes #<number>` unchanged. Apply these language
  rules to creation and updates, and verify the published title/body.
- Issues: purpose, current state, scope, implementation steps, completion criteria,
  unresolved decisions, and relevant links. Apply the type and domain labels below.
- PRs: concrete problem and resulting behavior, verification, remaining limits,
  and `Closes #<number>` only when the PR completes the issue.
- Branch: `<type>/issue-<number>-<slug>`; use a short lowercase hyphenated slug.
  Worktree: a sibling of the primary worktree named `<repo>-issue-<number>`.
  Find the primary worktree with `git worktree list --porcelain`.
- Default base and PR target for new general tasks: remote `main`. Fetch
  before creating a task branch. Never reset or switch the user's current branch merely to prepare a separate task worktree.
  If the user explicitly requests a task branch in the current checkout instead,
  honor it after inspecting local work. Refresh the start handoff when work moves.
  Publishing and deletion are separate decisions: ship can publish that task
  branch from the primary checkout, but never delete the primary worktree.
- Write GitHub bodies to temporary files and use `--body-file`. Stage named task
  files rather than `git add .`. Never stage `.env`, secrets, or editor settings.

## Issue and PR labels

`raise` and the publishing path of `ship` apply one type label and all relevant
domain labels. Keep type separate from domain; a mobile feature gets
`enhancement` and `mobile`. Determine domains from the plan/requirements and final
change scope, not only the title scope (`auth` can affect both API and mobile).

| Title type | Type label |
| --- | --- |
| `feat` | `enhancement` |
| `fix` | `bug` |
| `docs` | `documentation` |
| `chore` | `chore` |

| Domain label | Relevant scope |
| --- | --- |
| `mobile` | `apps/mobile/` and mobile behavior |
| `api` | `apps/api/` and API behavior |
| `worker` | `apps/ai-worker/` and AI worker behavior |
| `harness` | `.harness/`, `.agents/skills/`, and workflow rules in `AGENTS.md` |
| `contracts` | `contracts/` and shared API contracts |

Apply every relevant domain for cross-module work. Do not invent a domain for
work outside this table or label all domains for a generic root file change.
PRs start with the linked issue's type/domain classification, then reconcile it
with the final change scope and title type. Do not copy unrelated issue labels.

Before creation/update, list repository labels with
`gh label list --repo <owner/repo> --limit 1000 --json name,color,description`.
Create only missing labels needed by this task from the tables above, using
`gh label create <name> --repo <owner/repo> --description <description> --color <hex>`.
Use `a2eeef` for type labels and `c5def5` for domains when creating them; describe
their type or domain meaning. This workflow authorizes these missing-label
creations without another confirmation. Report created labels in the handoff.
Never use `--force` or change an existing label's color/description. Do not create
the whole catalog preemptively. If concurrent creation reports an existing label,
re-list to confirm it exists before continuing; do not blindly retry.
If label lookup/creation fails, report the operation and cause before proceeding
with dependent issue/PR creation or update.

On create, pass repeated `--label <name>` flags to `gh issue create` or
`gh pr create`. On update, read current labels first and use `--add-label` only
for missing desired labels and `--remove-label` only for obsolete type/domain
labels from these tables. Preserve all labels outside the tables. Re-running
with the same scope must make no label changes. Verify the resulting label set
with `gh issue view <number> --repo <owner/repo> --json labels` or the equivalent
`gh pr view` command and report failures rather than
claiming metadata is complete. An uncertain response requires a fresh lookup
before retrying. Never bulk-relabel other issues/PRs; merged-PR cleanup does not
create or change labels.

## Start assignees

After validating the open issue and resolving the task branch/checkout and any
existing PR state, assign the issue before implementation, including on resume.
Read existing assignees with
`gh issue view <number> --repo <owner/repo> --json assignees`.
Use explicitly requested GitHub login(s), or resolve the authenticated user with
`gh api user --jq .login` when none were specified. Add only missing users with
`gh issue edit <number> --repo <owner/repo> --add-assignee <login>`; never remove
existing assignees. Re-read assignees to verify every requested login is present,
and return the verified assignees in the start handoff. Repeated start must not
reassign existing users. A lookup, permission, or assignment failure stops before
implementation: preserve local work and report the operation and cause. After an
uncertain edit response, re-read before retrying. Do not substitute another user
or change credentials. This issue assignment is part of `start` authorization;
it does not authorize comments or messages to the assignees.

## Branches and merge policy

`main` is the only long-lived development integration branch. `staging` and
`production` are deployment environments, not branches. Use temporary task and
release branches; a single long-lived branch does not prohibit separate worktrees.

| PR flow | Merge method |
| --- | --- |
| Feature, fix, chore, docs, and other task branches → `main` | Squash merge |
| Version-only Release PR → `main` | Squash when repository protection permits |

- Start new general tasks from the latest remote `main` and explicitly target
  `main`. Honor an explicitly requested base/target. Resume existing tasks with
  their established base and target; a changed default does not authorize rebase
  or retargeting. If an old base was deleted, inspect current GitHub evidence and
  user instructions to resolve the target; do not recreate it or silently switch.
- `main` is never a task branch. Do not edit/push it through start/ship or remove
  its worktree. Preserve the primary checkout and existing local work under the
  cleanup rules; this policy does not authorize bulk deletion.
- Ship publishes a PR, not a merge. Merge, deployment, maintained-branch updates
  and branch deletion require separate requests. When merging is authorized,
  inspect the actual head/base and use
  `gh pr merge <number> --repo <owner/repo> --squash` for task integration. Do not change methods silently if blocked.
  Verify the result, then follow ship's merge-evidence and safe-cleanup procedure.
  Queueing is not completion. Explicit exceptional targets keep their agreed
  method; do not invent promotion/back-merge steps for deleted branches.
- Record the target/method in the task handoff and PR body. These describe intent,
  not enforcement by GitHub protection.
- Staging validates a selected commit from `main`. Production targets an approved
  independent app tag (`mobile/vX.Y.Z`, `api/vX.Y.Z`, `worker/vX.Y.Z`) at the exact
  tested release SHA, not current main HEAD. Main merges are not official releases.
  Version-only release changes create a new candidate: verify the final merge SHA
  in staging before tag publication. Follow the release skill's approval gates.
- API/worker production should reuse the image digest verified in staging; mobile
  records the exact build/artifact and environment configuration. Provider
  connections, CI/CD and promotion of artifacts need separately authorized setup.
  Never infer deployed state from tags, an environment name, or this document.

## TDD

Apply this procedure to behavior changes in all implementation work, including
requests outside `start` and fixes made during review or `ship`. Keep each cycle
focused on one small observable behavior and use the existing test tools.

1. **RED:** Before changing implementation, write a focused test for the expected
   behavior or a regression test that reproduces the bug. Run it and confirm it
   fails because the behavior is missing or incorrect. Check the failure reason;
   missing dependencies, unavailable services, or test setup errors do not count
   as RED. If the test already passes, investigate the behavior and test before
   changing implementation.
2. **GREEN:** Make the smallest maintainable implementation that passes the test.
   Run it and the relevant existing tests. Do not weaken assertions or remove
   coverage to make an implementation defect pass.
3. **REFACTOR:** With tests passing, improve structure only where needed while
   preserving behavior and module boundaries, then rerun the relevant tests.
   If no improvement is needed, state that briefly. A new behavior starts a new
   RED cycle; do not add speculative features during refactoring.

Repeat for the next behavior, then run the required checks for the changed area
under Verification. Cycle checks complement those final checks. Continue through
cycles without asking for approval at each phase; existing stage boundaries and
explicit approval requirements still apply.

### Applicability and exceptions

- Features and bug fixes follow the full cycle above.
- For refactoring that preserves behavior, first run the relevant existing tests.
  If coverage is insufficient, add and run tests that capture current behavior
  before refactoring. These may pass immediately; do not manufacture a failure
  for unchanged behavior. Rerun them after refactoring.
- Documentation, formatting, and version-value-only changes use relevant
  validation instead of a forced RED cycle. State the reason TDD does not apply.
  A mixed task still uses TDD for its behavior changes.
- If an environment problem prevents execution, report the failed command,
  prerequisite, and unverified scope. It is neither RED evidence nor completed
  verification; resolve it before claiming the affected work complete.

### Evidence and handoff

Keep a concise summary in the implementation handoff and PR verification:
representative tests and commands, the observed RED failure reason, GREEN results,
and refactoring plus rerun results (or why no refactoring was needed). For
behavior-preserving refactoring, report before/after results; for excluded work,
report the reason and actual validation. Preserve failed or unrun checks as such.

On resumed work, distinguish observed results from missing historical evidence.
Do not infer RED from a passing final suite or alter completed implementation to
recreate a failure. Report unavailable evidence honestly and apply TDD to new
behavior changes. No separate log file, status database, per-phase commit, or new
skill is required; existing conversation handoffs and PR bodies carry the summary.

## Verification

Run checks relevant to the actual change, from the task worktree:

| Changed area | Checks |
| --- | --- |
| Mobile | `npm run typecheck`, `npm run lint`; relevant tests and UI checks |
| API | `./gradlew test` or focused tests; PostgreSQL/Flyway tests for migrations |
| AI worker | `uv sync --locked`, `uv run ruff check .`, `uv run pytest` |
| Contracts | Follow the [contract sync procedure](references/openapi.md) when API impact exists or is uncertain; parse OpenAPI, resolve references, compare with implementation |
| Harness | Validate SKILL.md frontmatter/links; verify Codex skill discovery; run `python3 -m unittest discover -s .harness/tests -v` for isolated Git/GitHub-response checks |

Always run `git diff --check` and inspect the intended staged diff before a commit.
Report what ran, what passed, and what could not run. Do not claim an unexecuted
check passed. Use existing service `.env.example` files for setup; do not print
secret values or silently copy them between worktrees.

## Failures and retries

- GitHub authentication/permission failure: keep local work and report the failed
  operation. Do not change credentials or repeatedly retry without a new cause.
- Missing/closed issue, ambiguous plan, repository, or worktree: resolve the
  ambiguity before the dependent mutation; continue independent read-only work.
- Before retrying an issue/PR creation after an uncertain response, query GitHub
  to determine whether it succeeded. Update the task's existing open issue/PR
  rather than creating a duplicate. Do not replace another author's issue silently.
- A failed required check is not successful shipping. Fix task-related failures;
  preserve the worktree if an external prerequisite prevents completion.
- Push/PR failure: preserve the branch and worktree. Successful publication still
  retains the work environment while the PR is OPEN or awaiting merge.
- Post-merge cleanup requires verified `MERGED` state and target-branch evidence;
  CLOSED without merge, pending auto-merge/queue, lookup failures, or mismatched
  evidence preserve the environment. Use the ship skill's cleanup-only path for
  a merged PR; do not create another PR. No background polling is required.
- Local changes, secrets, personal settings, unknown ignored data, or a worktree
  lock: preserve the worktree and report the reason. The ship skill's explicit
  regenerable-directory allowlist is the only ignored-data cleanup exception;
  those directories alone do not block worktree removal. Cleanup never uses
  `--force`, `reset --hard`, or `git clean`.

## Skill discovery

`.agents/skills/<name>` is a relative symlink to `.harness/skills/<name>`.
Use `$plan`, `$raise`, `$start 1321`, `$ship`, `$review 1321`, and `$release`, or select them with `/skills`.
If the current session has not refreshed its skills, start a new session from
this checkout. AGENTS.md also routes plain-text requests to the canonical files.
On platforms that do not restore Git symlinks, enable symlink support or read
the canonical SKILL.md through AGENTS.md; do not maintain duplicate copies.

Source: [OpenAI skill discovery documentation](https://learn.chatgpt.com/docs/build-skills).

## App release lifecycle

The [release skill](skills/release/SKILL.md) prepares version-only branches from
a staging-verified, pinned `main` commit and creates Release PRs targeting `main`.
Use squash when compatible with protection; ordinary task PRs also target `main`. Staging
QA is environment/commit evidence, not maintained-branch promotion. The final
release merge needs its own staging verification before publication.

Plan approval precedes manifest changes. Merge and publication need separate
explicit approval of the exact PR/head or merge SHA and version mapping. Require
protected main and passing required CI; absence is a configuration prerequisite,
not successful CI. Release PR records bind base/head, manifests, notes, validation
and approval provenance. Do not use general ship cleanup to imply release
publication, deployment, branch synchronization or branch deletion authorization.

Production should eventually deploy only approved per-app tags; activating or
changing deployment workflows/provider integrations requires a separate concrete
proposal and explicit approval. Installation adds no active deployment workflow.
