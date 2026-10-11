# GrowTogether development rules

1. Prefer readable, maintainable code over cleverness.
2. Do not add abstractions or infrastructure before a concrete requirement needs them.
3. Keep mobile, API, and AI worker responsibilities independent.
4. Keep the AI worker provider- and feature-neutral; it is not a RAG-only component.
5. Do not prebuild unrequested features, directories, or placeholder classes.
6. Keep secrets out of source control; document required environment variables in `.env.example`.
7. Add focused tests for non-trivial behavior.
8. Prefer official documentation and stable releases.
9. Minimize service-to-service coupling; use `contracts/openapi.yaml` for API contracts.
10. Preserve module boundaries when extending the system.

## Harness workflow

The repository skills live in `.harness/skills/`. `.agents/skills/` links to
those directories for Codex discovery; keep one copy of each skill.
Read the selected SKILL.md before using it. If a global skill has the same name,
use the repository skill linked below for this workflow.

| Request | Skill | Result |
| --- | --- | --- |
| `plan <task>` or `$plan <task>` | [plan](.harness/skills/plan/SKILL.md) | Plan shown in the conversation; no files or implementation by default |
| `raise` or `$raise` | [raise](.harness/skills/raise/SKILL.md) | GitHub issue from the selected conversation plan and latest corrections |
| `start 1321` or `$start 1321` | [start](.harness/skills/start/SKILL.md) | Implement issue #1321 in a separate worktree |
| `ship` or `$ship` | [ship](.harness/skills/ship/SKILL.md) | Validate, commit, push, create/update PR, remove the clean task worktree |

These are agent requests, not shell commands. `/plan`, `/raise`, `/start 1321`,
and `/ship` in user messages route to the same skills; they do not register
new native slash commands. Select a conversation plan when multiple plans exist.

Use [harness conventions](.harness/conventions.md) for issue/PR formatting,
branch names, checks, and failure handling. `plan → raise → start <number> → ship`
is the usual sequence; an existing issue can go directly to `start`.
Each SKILL.md describes the complete workflow and its own input/output boundary.
The handoff is conversation plan → issue number/URL → actual task checkout and
verification results → PR/cleanup results. No local plan file is required.
Invoke only the requested stages; explicitly combined requests can proceed
through those stages without asking again. Standalone `plan` does not write
files or publish. `start` implements and verifies; `ship` commits/pushes/publishes.

- `start` uses the latest remote `develop` for new tasks unless another base
  was requested. Resume existing issue branches/worktrees with their established
  base and PR target, preserving unrelated local work.
  Honor an explicitly requested task checkout and return its actual branch/path
  and primary/linked status in the handoff. Do not mistake an old detached
  worktree for the active task after the user moves work to another checkout.
- General task PRs target `develop` and use squash merge. Promotions
  `develop → staging → main` use merge commits, never squash or rebase merge.
  See harness conventions for explicit base exceptions and merge authorization.
- `ship` stages only task files and reports validation evidence. Failed required
  checks must be fixed before publishing; missing prerequisites must be disclosed.
- After a successful push and PR creation/update, `ship` removes only the linked
  task worktree, from a retained worktree, with `git worktree remove`.
  Verify the remote commit and inspect tracked, untracked, and ignored files first.
  Preserve a dirty/locked worktree or one with local settings; never force-remove it.
- A task branch in the primary checkout can be shipped there when explicitly
  requested. Retain the primary worktree and report cleanup as not applicable;
  never publish develop/main/staging as the task branch.
- Keep task branches for PR follow-up. Never remove the primary, `develop`,
  `main`, or `staging` worktree. Merge, deployment, maintained-branch updates, and branch deletion
  require a separate request.
