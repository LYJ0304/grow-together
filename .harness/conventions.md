# Harness conventions

AGENTS.md remains the source of development rules. Read only the skill needed
for the current request. Requirements in the user's request take precedence.

## Names and GitHub formatting

- Resolve the GitHub repository from the current Git remote, then pass
  `--repo <owner/repo>` to `gh` commands. Do not hardcode this repository in skills.
- Read any existing issue/PR templates first. Use `<type>(<scope>): <description>`
  titles, for example `feat(todo): AI 일정 생성 연결`. Use `feat`, `fix`, `docs`,
  or `chore` according to the final change. Body text may follow the user's language.
- Issues: purpose, current state, scope, implementation steps, completion criteria,
  unresolved decisions, and relevant links. Use existing labels: `enhancement` for
  features, `bug` for fixes, `documentation` for docs. Do not create labels silently.
- PRs: concrete problem and resulting behavior, verification, remaining limits,
  and `Closes #<number>` only when the PR completes the issue.
- Branch: `<type>/issue-<number>-<slug>`; use a short lowercase hyphenated slug.
  Worktree: a sibling of the primary worktree named `<repo>-issue-<number>`.
  Find the primary worktree with `git worktree list --porcelain`.
- Default base: remote `main`. Fetch before creating a task branch. Never reset
  or switch the user's current branch to prepare a task worktree.
- Write GitHub bodies to temporary files and use `--body-file`. Stage named task
  files rather than `git add .`. Never stage `.env`, secrets, or editor settings.

## Verification

Run checks relevant to the actual change, from the task worktree:

| Changed area | Checks |
| --- | --- |
| Mobile | `npm run typecheck`, `npm run lint`; relevant tests and UI checks |
| API | `./gradlew test` or focused tests; PostgreSQL/Flyway tests for migrations |
| AI worker | `uv sync --locked`, `uv run ruff check .`, `uv run pytest` |
| Contracts | Parse OpenAPI, resolve references, compare operations with Controllers |
| Harness | Validate SKILL.md frontmatter/links; verify Codex skill discovery and Git lifecycle in an isolated repository |

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
- Push/PR failure: preserve the branch and worktree. No cleanup until both succeed.
- Local changes, ignored settings, or a worktree lock: preserve the worktree and
  report the reason. Cleanup never uses `--force`, `reset --hard`, or `git clean`.

## Skill discovery

`.agents/skills/<name>` is a relative symlink to `.harness/skills/<name>`.
Use `$plan`, `$raise`, `$start 1321`, and `$ship`, or select them with `/skills`.
If the current session has not refreshed its skills, start a new session from
this checkout. AGENTS.md also routes plain-text requests to the canonical files.
On platforms that do not restore Git symlinks, enable symlink support or read
the canonical SKILL.md through AGENTS.md; do not maintain duplicate copies.

Source: [OpenAI skill discovery documentation](https://learn.chatgpt.com/docs/build-skills).
