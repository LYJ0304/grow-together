---
name: ship
description: Finish a repository issue task on ship or /ship. Validate, commit task files, push, create or update its PR, then safely remove its clean task worktree.
---

# Ship

Read root AGENTS.md and [conventions](../../conventions.md).
Resolve the issue, repository, task branch, base, and task worktree from the
current conversation and Git state. If invoked from the primary checkout,
locate the requested issue's worktree first; do not ship primary/main/staging.
Clarify ambiguous task selection before committing or publishing.

1. Read the issue and inspect all task changes, including already-staged and
   untracked files. Preserve unrelated changes and do not accidentally commit
   another task's staged files. Inspect commits against the requested base.
2. Run the relevant required checks. Fix task-related failures before proceeding.
   If a prerequisite blocks verification, leave work reviewable and report it;
   do not present this as successful shipping. Record executed evidence and
   remaining limitations in the PR body.
3. Stage explicit task paths, run `git diff --cached --check`, inspect the staged
   task diff, and commit with the repository's title convention. If unrelated
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
   `--body-file`. A merged PR is not an open task: confirm the follow-up scope
   before creating another PR. Add `Closes #<number>` only for completed scope.
   Verify the published PR's head SHA equals the pushed task commit. After an
   uncertain GitHub response, query existing PRs before retrying creation.
6. Remove the task worktree only after successful push AND PR publication:
   - Fetch and verify `git rev-parse <branch>` equals
     `git rev-parse <remote>/<branch>`; inspect the worktree's current HEAD too.
   - Inspect `git status --porcelain --untracked-files=all --ignored`. An ignored
     `.env` or dependency directory counts as local data: preserve it and explain
     why cleanup was skipped. Do not erase it to make cleanup pass.
   - Verify the target is a linked task worktree, is not primary/main/staging,
     and is not locked. Keep all branches.
   - Recheck the HEAD and status immediately before removal. Run
     `git worktree remove <task-path>` with the retained primary worktree as
     the command working directory, then verify it is absent from the list.
     Never use `--force`, `git clean`, or `reset --hard`.

Return PR URL, commit(s), verification results, and whether cleanup succeeded or
was safely skipped. Push/PR failure preserves both branch and worktree. PR review
changes can resume via `start <number>` after cleanup. Do not merge, deploy, update
staging, close issues manually, or delete branches without a separate request.
