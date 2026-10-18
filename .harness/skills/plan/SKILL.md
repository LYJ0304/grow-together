---
name: plan
description: Plan a GrowTogether repository task on plan, /plan, or a work-plan request. Present the plan in the conversation without creating files, implementing code, or publishing unless separately requested.
---

# Plan

## Workflow and handoff

`plan → raise → start <issue-number> → ship`

- **plan (this stage):** task request → plan shown in the conversation.
- **raise:** selected conversation plan plus user corrections → GitHub issue number/URL.
- **start:** issue number → implementation, actual branch/checkout, verification results.
- **ship:** task handoff → commit/push/PR, retain the work environment until merge;
  a later invocation verifies merge and safely cleans up.

Stop after this stage unless the user explicitly requested additional stages.
For a combined request, read each requested skill and pass its result forward;
do not require a new confirmation for actions already requested.

## Planning

Read root AGENTS.md and [conventions](../../conventions.md). Inspect the relevant
code, callers, tests, and API contracts before proposing changes.

Present the plan directly to the user: purpose, current state, included/excluded
scope, implementation steps, completion criteria, verification, and unresolved
decisions. Identify affected modules/contracts and actual commands or observable
outcomes. Scale the detail to the task and separate assumptions from facts.

Do not create a plan file or directory by default. Save a plan only when the user
explicitly asks for file output; that file is never required for the next stage.

Ask only for missing information that changes scope or blocks a decision.
Otherwise record a reasonable assumption and continue planning. Preserve the
user's constraints and avoid prebuilding unrelated features.

When revising a plan, incorporate the latest user corrections into the selected
conversation plan and show the updated result. Keep relevant issue links in the
conversation. Do not silently replace another task's plan.

Return the plan, main decisions, and unresolved blockers. A standalone `plan`
does not implement, register an issue, commit, or push. The user can request
`raise` next; it consumes this conversation result, not a file path.
