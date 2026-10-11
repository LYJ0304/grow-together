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
| `plan <task>` or `$plan <task>` | [plan](.harness/skills/plan/SKILL.md) | Plan in `.harness/plans/<slug>.md`; no implementation |
| `raise <plan path>` or `$raise <plan path>` | [raise](.harness/skills/raise/SKILL.md) | GitHub issue and plan backlink |
| `start 1321` or `$start 1321` | [start](.harness/skills/start/SKILL.md) | Implement issue #1321 in a separate worktree |
| `ship` or `$ship` | [ship](.harness/skills/ship/SKILL.md) | Validate, commit, push, create/update PR, remove the clean task worktree |

These are agent requests, not shell commands. `/plan`, `/raise`, `/start 1321`,
and `/ship` in user messages route to the same skills; they do not register
new native slash commands. Select an explicit plan when multiple plans exist.

Use [harness conventions](.harness/conventions.md) for issue/PR formatting,
branch names, checks, and failure handling. `plan → raise → start <number> → ship`
is the usual sequence; an existing issue can go directly to `start`.
Invoke only the requested stage. `start` implements and verifies; `ship` performs
the commit/push/PR/cleanup actions. Do not automatically publish after `plan`.

- `start` uses the latest remote `main` unless another base was requested,
  resumes an existing issue branch/worktree, and preserves unrelated local work.
- `ship` stages only task files and reports validation evidence. Failed required
  checks must be fixed before publishing; missing prerequisites must be disclosed.
- After a successful push and PR creation/update, `ship` removes only the linked
  task worktree, from a retained worktree, with `git worktree remove`.
  Verify the remote commit and inspect tracked, untracked, and ignored files first.
  Preserve a dirty/locked worktree or one with local settings; never force-remove it.
- Keep task branches for PR follow-up. Never remove the primary, `main`, or
  `staging` worktree. Merge, deployment, staging updates, and branch deletion
  require a separate request.
