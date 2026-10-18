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
  unresolved decisions, and relevant links. Use existing labels: `enhancement` for
  features, `bug` for fixes, `documentation` for docs. Do not create labels silently.
- PRs: concrete problem and resulting behavior, verification, remaining limits,
  and `Closes #<number>` only when the PR completes the issue.
- Branch: `<type>/issue-<number>-<slug>`; use a short lowercase hyphenated slug.
  Worktree: a sibling of the primary worktree named `<repo>-issue-<number>`.
  Find the primary worktree with `git worktree list --porcelain`.
- Default base and PR target for new general tasks: remote `develop`. Fetch
  before creating a task branch. Never reset or switch the user's current branch merely to prepare a separate task worktree.
  If the user explicitly requests a task branch in the current checkout instead,
  honor it after inspecting local work. Refresh the start handoff when work moves.
  Publishing and deletion are separate decisions: ship can publish that task
  branch from the primary checkout, but never delete the primary worktree.
- Write GitHub bodies to temporary files and use `--body-file`. Stage named task
  files rather than `git add .`. Never stage `.env`, secrets, or editor settings.

## Branches and merge policy

`develop` integrates development, `staging` validates releases, and `main` is
the production baseline. Deployment requires its own configuration and request.

| PR flow | Merge method |
| --- | --- |
| Feature, fix, chore, docs, and other task branches → `develop` | Squash merge |
| `develop` → `staging` | Merge commit |
| `staging` → `main` | Merge commit |

- Start new general tasks from the latest remote `develop` and create their PRs
  against `develop`. An explicitly requested base/PR target takes precedence.
  Resume existing tasks with their established base and PR target; do not rebase
  or retarget them solely because the default changed. If Git state, an existing
  PR, and the handoff conflict, resolve the intended target before publishing.
- `develop`, `staging`, and `main` are maintained branches, never task branches.
  Do not edit or publish them through start/ship or remove their worktrees.
  Keep the primary worktree and task branches under the existing cleanup rules.
- Ship creates/updates a PR; it does not merge it. Merge, promotion, deployment,
  and branch deletion require separate user requests. When a merge is requested,
  inspect the PR's actual head/base and apply the table using
  `gh pr merge <number> --repo <owner/repo>` with `--squash` for task integration
  or `--merge` for promotions.
  Verify the result; do not silently fall back to a different method if blocked.
  After an explicitly requested merge completes, follow the ship skill's merge
  verification and cleanup procedure. Queueing a merge is not completion.
- Task PRs with an explicitly requested exceptional target (for example a hotfix
  to `main`) still use squash unless the user specifies otherwise. Synchronizing
  maintained branches, including hotfix back-merges to `staging` and `develop`,
  uses merge commits to preserve ancestry. Never squash/rebase maintained-branch
  synchronization, and do not perform back-merges without a separate request.
- Record the PR target and intended merge method in the start handoff and PR
  body. A policy in a PR body documents intent; it does not enforce GitHub rules.

## Verification

Run checks relevant to the actual change, from the task worktree:

| Changed area | Checks |
| --- | --- |
| Mobile | `npm run typecheck`, `npm run lint`; relevant tests and UI checks |
| API | `./gradlew test` or focused tests; PostgreSQL/Flyway tests for migrations |
| AI worker | `uv sync --locked`, `uv run ruff check .`, `uv run pytest` |
| Contracts | Parse OpenAPI, resolve references, compare operations with Controllers |
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
Use `$plan`, `$raise`, `$start 1321`, and `$ship`, or select them with `/skills`.
If the current session has not refreshed its skills, start a new session from
this checkout. AGENTS.md also routes plain-text requests to the canonical files.
On platforms that do not restore Git symlinks, enable symlink support or read
the canonical SKILL.md through AGENTS.md; do not maintain duplicate copies.

Source: [OpenAI skill discovery documentation](https://learn.chatgpt.com/docs/build-skills).
