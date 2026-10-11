---
name: raise
description: Register the selected conversation plan as a GitHub issue on raise or /raise. Include the latest user corrections, avoid duplicates, and return the issue number/URL without requiring a plan file.
---

# Raise

## Workflow and handoff

`plan → raise → start <issue-number> → ship`

- **plan:** task request → plan shown in the conversation.
- **raise (this stage):** selected conversation plan plus user corrections → GitHub issue number/URL.
- **start:** issue number → implementation, actual branch/checkout, verification results.
- **ship:** task handoff → commit/push/PR and safe task-worktree cleanup result.

Stop after this stage unless the user explicitly requested additional stages.
For a combined request, read each requested skill and pass its result forward;
do not require a new confirmation for actions already requested.

## Issue registration

Read root AGENTS.md and [conventions](../../conventions.md).
Use the plan the user refers to in this conversation, incorporating all later
corrections to its scope and decisions. If exactly one plan clearly applies, use
it without asking for a path or repeated approval. If multiple plans could apply,
ask which one. If a new session lacks the plan, ask the user to provide its text
or request planning; do not invent a plan or search a plan directory as a fallback.
Do not create or modify a plan file or require one for registration.

1. Read the full plan and inspect GitHub issue templates and available labels.
   Resolve the current repository and verify `gh` authentication.
2. Use the plan's title/scope and any issue link in the conversation to search existing issues.
   Reuse an open issue that clearly belongs to this task. If a similar issue
   has different scope or ownership, clarify rather than overwriting it.
   A linked closed issue needs an explicit continuation decision before reopening
   or creating a replacement.
3. Prepare a title and body that retain the plan's scope, steps, completion
   criteria, verification, and unresolved decisions. Apply conventions and
   existing labels. A blocking unresolved decision remains visible in the issue.
4. Write the exact body to a temporary transport file outside the repository
   (for example a `.txt` file). This is not a plan artifact. Create with `gh issue create
   --repo <owner/repo> --title <title> --label <existing-label> --body-file <file>`,
   or update the associated issue with `gh issue edit`.
5. Verify the returned issue via `gh issue view`. Return its number and URL in
   the conversation; no plan file or backlink update is needed.

A request to `raise` authorizes publishing the selected plan; do not ask for
the same authorization again. If the API response is uncertain, inspect GitHub
before retrying creation. Preserve the conversation plan on failure and report the operation.

Return the issue number/link, whether it was created or updated, and remaining
decisions. The issue becomes the persisted requirements that `start <number>`
reads, so a later session does not need the original planning conversation.
Standalone `raise` does not change product code, commit, or start implementation.
