---
name: ship
description: Finish a repository issue task on ship or /ship. Validate, commit task files, push, create or update its PR, then safely remove its clean task worktree.
---

# Ship

## Workflow and handoff

`plan → raise → start <issue-number> → ship`

- **plan:** task request → plan shown in the conversation.
- **raise:** selected conversation plan plus user corrections → GitHub issue number/URL.
- **start:** issue number → implementation, actual branch/checkout, verification results.
- **ship (this stage):** task handoff → commit/push/PR and safe task-worktree cleanup result.

Consume the latest start handoff and user corrections, then verify them against
Git/GitHub. A plan file or new planning run is not required. Return the publication
and cleanup results; merging/deploying is not the next automatic stage.
For a combined request, read each requested skill and pass its result forward;
do not require a new confirmation for actions already requested.

## Publication and cleanup

Read root AGENTS.md and [conventions](../../conventions.md).
Resolve the issue, repository, task branch, base, PR target, intended merge method,
and actual task checkout from the latest handoff, user directions, and Git state. If no handoff survives a new
session, use the issue's branch/worktree/PR association; ask only when the task
cannot be identified unambiguously. Never select a stale detached worktree by
directory name alone or publish develop/main/staging as the task branch.
If the actual task is in the primary checkout on its task branch at the user's
request, publish there and retain the primary worktree. Otherwise use the linked
task worktree even when ship was invoked from the primary checkout.
Clarify ambiguous task selection before committing or publishing.
For new general tasks, default the PR target to `develop` and the intended merge
method to squash. Honor explicit target instructions and preserve established
base/target for resumed work. If an existing PR, handoff, and user directions
conflict, resolve the intended target before publishing; do not silently retarget
an old main PR just because the default changed. Apply conventions for exceptions.
Do not fall back to main when develop is missing.

1. Read the issue and inspect all task changes, including already-staged and
   untracked files. Preserve unrelated changes and do not accidentally commit
   another task's staged files. Inspect commits against the requested base.
2. Run the relevant required checks. Fix task-related failures before proceeding.
   If a prerequisite blocks verification, leave work reviewable and report it;
   do not present this as successful shipping. Record executed evidence and
   remaining limitations in the PR body.
3. Stage explicit task paths, run `git diff --cached --check`, inspect the staged
   task diff, and write the commit subject and any body in English. Use
   `<type>(<scope>): <English description>`, for example
   `docs(harness): clarify ship cleanup rules`, following conventions. If unrelated
   files are already staged, use `git commit --only -m <message> -- <task-paths>`
   to preserve their staging while excluding them from this commit. Never unstage
   another task to make the index appear clean. If no new task changes exist,
   reuse task commits instead of creating an empty commit.
4. Push explicitly to the task branch with
   `git push -u <remote> <branch>`. Never use a bare `git push`, force-push, or
   target the base branch. If rejected, fetch and resolve without rewriting
   another contributor's commits; preserve the worktree on unresolved failure.
5. Search PRs by repository and head branch, including their states. Update its
   existing open PR or create one with explicit `--base`, `--head`, and
   `--body-file`, setting `--base` to the resolved PR target (normally `develop`).
   Record the intended merge method in the PR body; do not merge or enable
   auto-merge as part of ship. A merged PR is not an open task: confirm the
   follow-up scope before creating another PR. Add `Closes #<number>` only for completed scope.
   Verify the published PR's head SHA equals the pushed task commit. After an
   uncertain GitHub response, query existing PRs before retrying creation.
6. Remove a linked task worktree only after successful push AND PR publication.
   If the task used the primary checkout, report cleanup as not applicable and
   keep it. Do not remove a stale detached worktree as a substitute.
   - Fetch and verify `git rev-parse <branch>` equals
     `git rev-parse <remote>/<branch>`, the worktree's HEAD, and the published PR's
     head SHA. If they differ, preserve the worktree.
   - Verify the target is a linked task worktree, is not primary/develop/main/staging,
     and is not locked. Keep all branches.
   - Inspect tracked, untracked, and ignored data before deleting anything. Use
     `git status --porcelain --untracked-files=all --ignored`, summarizing dependency
     directories rather than printing every file. Stop cleanup if there are
     tracked changes, non-ignored untracked files, secrets such as `.env`, personal settings,
     or ignored data outside the allowlist below. Check inside allowed directories
     for local credentials/settings or other non-regenerable data too; preserve
     the whole worktree if present or uncertain. Never print secret contents.
   - The only allowed regenerable directories are `node_modules/`, `.expo/`,
     `apps/mobile/node_modules/`, and `apps/mobile/.expo/`, relative to this task
     worktree. They alone do not block cleanup. Do not infer permission to delete
     other ignored paths. Each candidate must be an ignored, untracked directory
     with no tracked files, and its resolved path must stay inside this worktree.
     Reject symlinked candidates or ancestors, mounts at any depth, and shared directories;
     never follow links into external data.
   - After publication and all preservation checks pass, stop task-owned processes
     using these directories and remove only the verified allowlisted directories
     with explicit paths, without following symlinks. Recheck status before each
     deletion; if any protection condition has appeared, stop and preserve the
     worktree. Do not delete local data to make cleanup pass.
   - Recheck the HEAD and status immediately before removal. Run
     `git worktree remove <task-path>` with the retained primary worktree as
     the command working directory, then verify it is absent from the list.
     Never use `--force`, `git clean`, or `reset --hard`.

Return PR URL, commit(s), verification results, and whether cleanup succeeded or
was safely skipped. For normal cleanup, report worktree removal without a separate
dependency/cache preservation notice. Explain a skip only for an actual protection
condition or failure. Push/PR failure preserves both branch and worktree. PR review
changes can resume via `start <number>` after cleanup. Do not merge, deploy, update
maintained branches, close issues manually, or delete branches without a separate request.
