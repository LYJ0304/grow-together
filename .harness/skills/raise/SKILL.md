---
name: raise
description: Register a repository work plan as a GitHub issue when the user requests raise or /raise. Reuse the selected plan and avoid duplicate issues; do not implement the task.
---

# Raise

Read root AGENTS.md and [conventions](../../conventions.md).
Use the plan path provided by the user or selected in this conversation. If no
selection exists, inspect `.harness/plans/`; use a single applicable plan or ask
which plan when multiple candidates remain. Do not invent a plan or silently
choose the newest file. If no plan exists, explain that planning is needed first.

1. Read the full plan and inspect GitHub issue templates and available labels.
   Resolve the current repository and verify `gh` authentication.
2. Use the plan's title/scope and issue backlink to search existing issues.
   Reuse an open issue that clearly belongs to this task. If a similar issue
   has different scope or ownership, clarify rather than overwriting it.
   A closed backlink needs an explicit continuation decision before reopening
   or creating a replacement.
3. Prepare a title and body that retain the plan's scope, steps, completion
   criteria, verification, and unresolved decisions. Apply conventions and
   existing labels. A blocking unresolved decision remains visible in the issue.
4. Write the exact body to a temporary file. Create with `gh issue create
   --repo <owner/repo> --title <title> --label <existing-label> --body-file <file>`,
   or update the associated issue with `gh issue edit`.
5. Verify the returned issue via `gh issue view`. Replace `Issue: not registered`
   in the selected plan with its number and URL, or refresh its existing backlink.

A request to `raise` authorizes publishing the selected plan; do not ask for
the same authorization again. If the API response is uncertain, inspect GitHub
before retrying creation. Preserve the plan on failure and report the operation.

Return the issue number/link, whether it was created or updated, and remaining
decisions. Do not change product code, commit, or start implementation.
