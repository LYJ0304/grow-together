# Prepare a Release PR

Read [versioning](versioning.md) and [deployment boundaries](deployment.md).
Preparation does not promote branches or create tags.

## Inspect and propose

1. Resolve repository/remote and verify `gh auth status`. Inspect `git status
   --short --branch`, `git worktree list --porcelain`, existing release branches
   and PRs, application manifests, tags, workflows, protections and provider
   integration evidence. Inspect tracked, untracked and ignored worktree data
   without printing secrets. Never copy `.env` between worktrees.
2. Query `git ls-remote --heads --tags <remote>`. Fetch `main`, `staging` and tags
   without force/pruning, then confirm local remote-tracking `main` equals the
   live remote SHA. A conflicting local tag blocks preparation; preserve it.
   Fetch PR head refs explicitly if needed. Do not trust stale tracking refs.
3. Require a maintainer's QA evidence identifying the promoted staging SHA and
   `staging → main` merge/promotion evidence. Record it in the proposal. If QA or
   promotion is missing, stop with the prerequisite; do not import unpromoted
   develop changes. Version-only commits after QA still need validation.
4. Pin `BASE` to fetched remote `main`. Run helper `inspect --ref <BASE>`; review
   actual diffs/merged PRs for each previous app tag, including shared consumers.
   Inspect available checks/protection and existing auto deployment effects.
   Do not assume that no Actions workflows means no external CI/deployment.
5. Present exactly one recommended plan (all excluded apps included):

```text
Grow Together Release Proposal
Target branch: main
Base commit: <full SHA>
QA: <staging SHA, promotion PR, authoritative QA evidence>
mobile: previous tag / manifest → proposed stable version; behavior-based reason
api: previous tag / manifest → proposed stable version; behavior-based reason
worker: no release required; reason
Changes and relevant merged PRs: ...
Compatibility / rollout / migration considerations: ...
Release Notes (per selected app): ...
Validation commands and missing prerequisites: ...
Known deployment side effects and configuration gaps: ...
```

Ask for approval, overrides, or cancellation. With no reply, end the turn here.
After overrides, show the revised final plan and obtain approval before changing
manifests. Record who approved and the conversation/review reference. If base,
QA evidence, tags or scope changed during the wait, replan and reapprove.

## Prepare after plan approval

Create a separate sibling worktree and collision-free `release/YYYY-MM-DD`
branch (`-2`, `-3`, … if necessary) from exact `BASE`. Inspect remote branches and
open/merged Release PRs before reusing anything; resume only the same approved
plan. Unset inherited upstream to `main`. Never reset another checkout.

Update only selected existing version definitions and required lock metadata.
Initial bootstrap with unchanged manifests may use an explicitly documented
empty release commit; this is not a no-change incremental release. Run relevant
checks, inspect the whole diff and `git diff --check` before a named-file commit:

| Area | Commands / evidence |
| --- | --- |
| Skill/manifests | helper consistency; inspect lockfile/dependency diff; `git diff --check` |
| Mobile | `npm ci`, `npm run typecheck`, `npm run lint`, relevant `npm run test:*`, `npm run format:check`; web artifact when applicable: `npx expo export --platform web` |
| API | `./gradlew test` and `./gradlew bootJar` in `apps/api`; Java 21 and Docker/Postgres integration tests as required; optional root `docker build -f apps/api/Dockerfile -t growtogether-api:release-check .` |
| Worker | `uv sync --locked`, `uv run ruff check .`, `uv run pytest` in `apps/ai-worker` |
| Contract | parse OpenAPI, resolve refs, compare changed operations with controllers and actual consumers |

Record exact commands, tested tree/head, results/log references, skipped tests
and prerequisites. Never substitute a build for skipped tests. Failed required
checks block PR publication until fixed; missing tooling is a blocker to that
required validation. Inspect optional checks and explain omissions. Do not
change product code to fix unrelated failures inside a version-only Release PR.

## Durable PR record

Use an English conventional title, e.g. `chore(release): prepare mobile 1.1.0`,
and Korean PR prose following harness conventions. Include app mapping, rationale,
notes, compatibility, QA, validation, target base, head and approval provenance.
Do not create an issue/Project item. Use a temporary body file outside the repo.
Include exactly one block with these delimiters (no other text inside):

````text
<!-- grow-together-release:v1
{
  "schema": 1,
  "base": "<full approved main SHA>",
  "head": "<full final release branch SHA>",
  "apps": {
    "mobile": {
      "previous_tag": null,
      "current": "1.0.0",
      "version": "1.1.0",
      "reason": "승인된 실제 변경 근거",
      "notes": "승인된 앱별 Release Notes"
    }
  },
  "qa": "승격 PR/검증한 staging SHA/QA 증거 링크",
  "compatibility": "호환성 및 배포 순서/마이그레이션 검토",
  "validation": [
    {"command": "npm run typecheck", "result": "passed", "evidence": "실제 실행 로그/대화 참조"}
  ],
  "approval": "최종 계획의 명시적 승인자 및 대화/리뷰 참조"
}
-->
````

All selected apps need every shown app field; `previous_tag` is null only for a
bootstrap. `current` is the app manifest at `base`. Validation lists only
required executed checks, all `passed`; put skipped/optional details in prose.
`head` cannot be included in its own commit; write this PR block after committing.
Hashing the canonical JSON gives a plan digest; helper `verify` prints it. Use
that digest and exact head in the final approval/merge/publication proposals.
A digest detects changes against an approval, not authenticity by itself.

Push only the release branch and create/update the `main` PR. Preserve approval
provenance in a PR comment when resuming/updating the body (commenting as part of
this explicitly invoked skill is authorized); do not impersonate the human.
Reconfirm the actual final PR head/record and CI. Run helper `verify --phase
prepare`. It checks the PR remains OPEN, live main still equals base, version-only
diff, head, tag collision and checks. Its conservative path excludes source
changes, dependency updates and incidental formatting; recreate the plan if those
are needed. It does not inspect QA log truth or effective required-review rules.

## Merge gate

Wait for CI/required reviews and inspect effective classic protection and
rulesets (including required status contexts, review/queue restrictions). Main
must be protected with meaningful required checks before merging a Release PR.
If absent or inaccessible, report the configuration prerequisite; do not configure
it or treat local checks as successful CI. Verify head check runs/status contexts
and required contexts are actually present and passing. `verify` also rejects
missing/failing/pending/skipped CI and an unprotected main, but the agent must
check effective requirements and the mergeability result separately.

Present PR, digest, base/head, mapping, notes and checks; request **separate merge
approval**. On approval rerun verification and recheck the live base and effective
rules. Use `gh pr merge <N> --repo <repo> --squash --match-head-commit <HEAD>` if
compatible. Do not use admin bypass or auto-merge. Do not change strategy if
blocked. A concurrently moved base invalidates approval; verify actual merge
parent/tree afterward and do not publish a stale merge. Queueing is not a merge.
Confirm MERGED and exact merge SHA on fetched main, then hand off to `publish`.
No tag creation, deployment, cleanup, back-merge or branch deletion here.

Example: `$release prepare` → approve/override the proposal → review PR/CI →
explicitly approve merging that PR → `$release publish 123` with new approval.
