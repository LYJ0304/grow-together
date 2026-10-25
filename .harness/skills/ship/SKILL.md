---
name: ship
description: Publish a repository issue task on ship or /ship while retaining its work environment for review. On a later invocation for a merged PR, verify merge evidence and safely clean up its linked task worktree.
---

# Ship

## Workflow and handoff

`plan → raise → start <issue-number> → ship`

- **plan:** task request → plan shown in the conversation.
- **raise:** selected conversation plan plus user corrections → GitHub issue number/URL.
- **start:** issue number → implementation, actual branch/checkout, verification results.
- **ship (this stage):** task handoff → commit/push/PR, retain the work environment until merge;
  a later invocation verifies merge and safely cleans up.

Consume the latest handoff and user corrections, then verify them against Git/GitHub.
Standalone ship does not authorize merging, auto-merge, deployment, or branch deletion.
Perform only explicitly requested stages; no new plan file or confirmation is needed
for already authorized actions. Do not wait or poll indefinitely for a merge.

## Resolve the task and PR state first

Read root AGENTS.md and [conventions](../../conventions.md). Resolve the repository
from its remote, issue, task branch, actual checkout (primary or linked), established
base/PR target, and intended merge method. New general PRs target `develop` with
squash; preserve explicit exceptions and existing targets. Never publish a maintained
branch or infer the active task solely from an old detached worktree's directory name.

Use the actual task checkout even when invoked from the primary checkout. Preserve
unrelated local changes. If it is absent, inspect the retained worktree's branch and
GitHub association before recreating anything. Clarify only genuinely ambiguous tasks.

Before staging, committing, or pushing, search PRs by repository and complete head
branch, including all states, and read the associated PR with `gh pr view`:

| Associated PR | Action |
| --- | --- |
| None, or OPEN (including draft, auto-merge, or merge queue) | Publish/update the task below; retain its environment. |
| MERGED | Take the cleanup-only path below; never republish, create another PR, or treat new local work as merged. |
| CLOSED without merge | Preserve the environment and report the state; reopening/replacement requires an explicit continuation decision. |
| Lookup failure, conflicting PR associations, or uncertain state | Preserve the environment and resolve the uncertainty before mutations. |

## Publish and retain the environment

1. Read the issue and inspect tracked, staged, and untracked task changes and commits
   against the established base. Do not include another task's staged files.
2. Review the handoff's [TDD evidence](../../conventions.md#tdd) and run relevant
   required checks. Apply that procedure to any new behavior fixes during ship.
   Fix task failures before publishing; disclose missing prerequisites without
   claiming a successful ship. Record the observed TDD summary, or the applicable
   exception and actual validation, alongside final check results in the PR body.
   Report missing historical evidence explicitly; a passing final suite alone
   does not establish that RED occurred. Do not recreate failures retroactively.
3. Stage explicit task paths. Run `git diff --cached --check` and inspect the staged
   diff. Commit in English using `<type>(<scope>): <English description>`, for example
   `docs(harness): defer worktree cleanup until merge`; any commit body is also English.
   If unrelated files are staged, use `git commit --only -m <message> -- <task-paths>`
   to preserve their staging. Reuse existing task commits when no new changes exist.
4. Push explicitly with `git push -u <remote> <task-branch>`. Never force-push, use a
   bare push, or target a maintained branch. Resolve rejections without rewriting
   another contributor's commits; preserve the worktree on unresolved failure.
5. Create/update the associated open PR with explicit repository, base, head, and
   `--body-file` (temporary file outside the repository). The title must use
   `<type>(<scope>): <English description>`; write the body in Korean. Keep code,
   commands, paths, URLs, identifiers, and `Closes #<number>` as written. Record the
   intended merge method and use `Closes` only for completed scope. Verify the
   published title/body language and that the PR head equals the pushed task commit.
   Apply conventions' type/domain labels on both creation and updates: use the
   linked issue's classification as a starting point, then reconcile with the
   final change scope and title type. Create only missing required labels without
   changing existing label settings. Use repeated `--label` flags on create;
   on edit, add missing desired labels and remove only obsolete managed labels,
   preserving unrelated labels. Read back `gh pr view --json labels` to verify
   the expected set. Report metadata failures rather than claiming ship complete.
   After an uncertain creation response, inspect GitHub before retrying.
6. Retain the worktree and review/development environment: dependencies, caches,
   local configuration, and task-owned review servers. Report PR URL, applied
   labels, any labels created, commit/checks,
   actual branch/path, and `awaiting merge; environment retained`. Publication alone
   must not stop review servers, delete dependencies, or remove a worktree. A short
   test process may end normally; report any intentionally ended test-only services.

## Verify merge before cleanup

Enter this path only on a later ship invocation for an already merged PR, or after
a separately requested merge has completed. Use the existing PR; no replacement PR,
new implementation commit, push, or additional publishing checks are required here.
The merge request uses the actual base and conventions' merge method. Queuing or
requesting a merge does not authorize cleanup until it is confirmed complete.

Query `gh pr view <number> --repo <owner/repo> --json
state,mergedAt,headRefName,headRefOid,baseRefName,mergeCommit` and fetch the remote.
Require all of the following before any cleanup:

- `state=MERGED`, a nonempty `mergedAt`, and a merge commit OID. CLOSED alone, OPEN,
  queue/auto-merge pending, query failure, or missing evidence preserves the environment.
- The PR matches this repository, task branch, and established target. The local
  checkout is on the task branch and HEAD equals the final PR head; check any existing
  remote task ref too. Unpublished or post-merge commits must be preserved.
- The merge commit is an ancestor of the fetched remote target branch, checked with
  `git merge-base --is-ancestor <merge-commit> <remote>/<base>`.
  Do not require the PR head itself to be an ancestor: squash creates another commit.
  If evidence differs, preserve the worktree instead of guessing or resetting it.

The read-only [merge check](scripts/check_merge.py) verifies these Git/GitHub facts:

```bash
python3 .harness/skills/ship/scripts/check_merge.py \
  --repo <owner/repo> --pr <number> --worktree <actual-task-path> \
  --branch <task-branch> --base <established-pr-target> --remote <remote>
```

It returns 0 for verified merge evidence, 1 for mismatched/unmerged evidence, and 2
for lookup/command failure. A successful check is not permission to delete data;
all preservation checks below still apply. It never commits, publishes, merges,
stops processes, or removes files/worktrees. Fetch does not switch or update local maintained branches.

## Safely clean up after verified merge

- If the task used the primary checkout, retain it and report cleanup not applicable.
  Never remove primary/develop/main/staging worktrees or delete any task branch.
- If the exact linked task worktree was already removed, confirm its absence in
  `git worktree list --porcelain` and report already cleaned. Do not recreate it just
  to clean it again, substitute another worktree, or create another PR. Verify the
  PR's merged state and target-branch evidence from a retained checkout first.
- Verify the actual linked worktree identity, final HEAD, and absence of locks.
  Inspect `git status --porcelain --untracked-files=all --ignored`, summarizing
  dependency directories. Preserve it if there are tracked changes, non-ignored
  untracked files, secrets such as `.env`, personal settings, protected data, or
  ignored data outside the allowlist. Never print secret contents or delete data to pass cleanup.
- The only allowed regenerable directories are `node_modules/`, `.expo/`,
  `apps/mobile/node_modules/`, and `apps/mobile/.expo/`, relative to this task worktree.
  Do not infer permission to delete other ignored paths. Each candidate must be
  ignored and untracked, contain no tracked files or non-regenerable local data,
  and resolve inside the worktree. Reject symlinked candidates/ancestors, mounts
  at any depth, and shared directories. Never follow links into external data.
- Only after merge verification and every preservation check passes, stop task-owned
  processes using this environment and remove the verified allowlisted directories
  by explicit path without following symlinks. Recheck status before each deletion;
  if a protection condition appears, stop and preserve the remaining environment.
- Re-query the PR and recheck HEAD/status immediately before worktree removal.
  From a retained worktree, run `git worktree remove <actual-task-path>` and verify
  its absence. Never use `--force`, `git clean`, or `reset --hard`.

Return the PR URL, published/final commit, checks or merge evidence, and cleanup
outcome: awaiting merge/environment retained, removed, already cleaned, not applicable,
or preserved with the concrete reason. Report cleanup success only after removal is
verified. No bulk cleanup of other tasks, maintained-branch updates, deployment,
manual issue closure, or branch deletion is part of ship.
