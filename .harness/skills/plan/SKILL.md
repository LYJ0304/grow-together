---
name: plan
description: Plan a GrowTogether repository task when the user requests plan, /plan, or a work plan. Write a reusable plan without implementing code or publishing to GitHub.
---

# Plan

Read root AGENTS.md and [conventions](../../conventions.md). Inspect the relevant
code, callers, tests, and API contracts before proposing changes.

Create or update `.harness/plans/<slug>.md` at the current repository root.
Create the plans directory only when writing a real plan. Use this structure:

```markdown
# <type>(<scope>): <task title>

Issue: not registered
Base: main

## Purpose
## Current state
## Scope
## Implementation steps
## Completion criteria
## Verification
## Unresolved decisions
```

Populate each section with concrete findings. Scope states what is included and
excluded; steps identify the modules and contracts affected; verification names
commands or observable outcomes. Do not leave empty scaffold sections: use
`None` when there are no unresolved decisions. Separate assumptions from facts.

Ask only for missing information that changes scope or blocks a decision.
Otherwise record a reasonable assumption and continue planning. Preserve the
user's constraints and avoid prebuilding unrelated features.

If a plan path was supplied, update that plan. Otherwise use a descriptive slug
and do not overwrite an unrelated plan. Keep its existing issue backlink.
Return the plan path, main decisions, and unresolved blockers.

Stop after planning. Do not implement, register an issue, commit, or push.
`raise <plan path>` is the next stage when requested.
