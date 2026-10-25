# Publish a merged Release PR

Read [deployment boundaries](deployment.md). `publish` never merges a PR or
updates versions. Require a positive PR number and authenticated GitHub access.

## Preflight

Refresh `main`, PR head and tags without force. Run:

```bash
python3 .harness/skills/release/scripts/release-plan.py verify --repo OWNER/REPO --pr 123 --phase publish
```

The helper retrieves the PR record and checks MERGED into main, final head,
commit ancestry, exact merged tree and parent against approved base/head,
version-only delta, unchanged excluded versions, stable SemVer targets,
previous tags, live remote main/tag identity, CI and protected main. A release
merged on top of an advanced unapproved base is stale even if conflict-free.
It never targets current main in place of the PR's merge SHA. Missing refs or
lookup errors are blockers, not evidence of absence. Fetch specific old PR head
refs without changing a task checkout when the original branch was deleted.

Also inspect effective rules/required reviews, QA and actual validation logs,
compare the PR record/digest with the approved conversation or review provenance,
and inspect any provider deployment side effects. The helper cannot authenticate
human approval from editable PR text. Recover missing provenance through a new
explicit maintainer reapproval of the concrete plan, then separately approve
publication. Do not reconstruct approval from commit prefixes, labels, or bots.

For first publication **no target tag may exist locally or remotely**. An existing
annotated tag is only reusable in the recovery path below after exact PR/plan/SHA
and annotation checks. Conflicts, lightweight tags and unexpected existing Releases
block publication. Never replace or delete tags to make verification pass.

## New publication approval

Present PR URL/number, plan digest, exact merge SHA, all application/version/tag
pairs, per-app release notes, actual checks and compatibility/rollout concerns,
plus precisely which remote operations remain. Explain that approved tags may
trigger provider deployments; no deployment success is promised. Ask for explicit
publication approval using the current runtime or conversation. End the turn if
no human answer is available. Prepare approval, merge approval, a command argument,
CI success or an existing tag is not publication approval.

Immediately after approval re-run preflight and compare the full output with the
approved digest/merge SHA/mapping/pending operations. A moved main during the wait
requires revalidation/reapproval, even though tags would target the old merge.
An already-approved release may be recovered later on advanced main only when
its exact parent/tree still matches its original base and head; never rebase it.

## Publish tags, then GitHub Releases

1. Create only the approved missing **annotated** tags at the literal merge SHA.
   Use a temporary annotation file and explicit arguments, without a shell loop
   interpolating untrusted PR strings. Each tag's annotation is exactly:

   ```text
   Grow Together release PR #123
   Plan: <helper plan_digest>
   ```

   Example command, substituting validated values:
   `git -c tag.gpgSign=false tag -a api/v0.2.1 <MERGE_SHA> -F <annotation-file>`.
   This format uses unsigned annotated tags; disable implicit signing so recovery
   can compare the exact annotation without an added signature block.
   The helper returns `annotation` and `push_refspecs`; they are data, not code.
2. Recheck remote main/tags and push the missing tags together:
   `git push --atomic <remote> refs/tags/mobile/v1.1.0:refs/tags/mobile/v1.1.0 refs/tags/api/v0.2.1:refs/tags/api/v0.2.1`.
   Use only the selected app refspecs, never `--tags` or `--force`. Use atomic
   even for a single tag. If unsupported, stop and report; do not silently switch
   to sequential pushes. Race rejection preserves state; inspect before retrying.
3. Verify every remote tag object matches the local annotated tag object and its
   peeled commit equals the approved merge SHA. Run helper `verify` with
   `--recovery` to perform this comparison. If not all tags are verified remotely,
   do not create any GitHub Release.
4. For each verified tag missing a Release, write the exact approved app `notes`
   to a temporary file. Use `gh release create <TAG> --repo <repo> --verify-tag
   --title <TAG> --notes-file <file> --latest=false`. Do not use `--target` or
   auto-generated notes that cross app boundaries. Target versions are stable,
   so do not mark them prerelease. `--verify-tag` prevents implicit tag creation.
5. Re-query each Release (not just command exit status), verify tag, body/title,
   non-draft/non-prerelease state and remote SHA, then report URLs and evidence.
   Do not mark an independent app tag repository-wide latest automatically.
   Report Tagged/Published per app and any unverified deployment separately.

## Interrupted work and recovery

Use the same PR number, fetch explicit refs, then:

```bash
python3 .harness/skills/release/scripts/release-plan.py verify --repo OWNER/REPO --pr 123 --phase publish --recovery
```

Recovery is not permission to mutate. Present the actual partial state and seek
new approval for remaining remote mutations. Preserve annotations/commit identity:

| Observed state | Recovery |
| --- | --- |
| No local/remote tags | First-publication flow |
| Local annotated tags only | Check annotation/digest/SHA; create only other missing local tags; atomically push all missing remote tags |
| Push response lost | Query remote object and peeled refs before retrying; never assume failure means no tags |
| Some/all remote tags exist | Require exact local object identity (fetch absent local tags without force), correct annotation and same merge SHA; atomically push only verified missing tags |
| Tags published, some Release creates failed | Reverify every tag; skip existing exact matching Releases; create only missing Releases |
| Release response lost | Query Releases before retrying creation; paginate all results |
| All Releases match | Successful no-op; report existing URLs, no remote mutation |
| Tag at wrong SHA, wrong annotation, wrong Release notes or draft | Stop with conflict details; never overwrite, force push, move, delete or silently edit |

The digest covers the whole PR record, including final head, notes and validation.
Editing the record after tags exist changes the digest and blocks recovery; restore
its original approved content from trusted provenance, never retag. An unavailable
GitHub API/authentication check is not a missing Release. Stop rather than creating
again. If one mutation fails, report exact completed/remaining operations and
preserve the release worktree. Do not infer successful rollout or auto-rollback.
