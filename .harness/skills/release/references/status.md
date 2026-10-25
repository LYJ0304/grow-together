# Read-only release status

Resolve repository/remote and inspect working tree/branch without switching it.
Do not require approval for read-only inspection. Do not require working tree
cleanliness or install dependencies merely to report status.

1. Query live `main` and tags (`git ls-remote --heads --tags <remote>`). Inspect
   local tracking refs; report stale/missing refs and optionally fetch main/tags
   without force. If tag conflicts prevent refresh, report them; never hide them.
   Run helper `inspect --ref origin/main` and optionally `inspect --ref HEAD` to
   distinguish the official baseline from committed development checkout versions.
   `inspect` reads Git objects, not dirty files: if version manifests are modified,
   read their actual version fields separately and label them uncommitted. Never
   present HEAD values as the current working-file values when those differ.
2. `gh release list --repo <repo>` and paginated repository Releases API: enumerate
   each app's newest Releases, URLs and draft/prerelease state. Do not assume
   GitHub's single latest Release represents all independent applications.
3. Enumerate both open and merged PRs targeting main, with pagination, looking
   for the structured record in [prepare](prepare.md). Do not search only a
   title/label or the first page. Query full PR details and inspect malformed
   release records as inconsistencies. Check merged records with helper `verify
   --phase publish --recovery`; a blocker is diagnostic evidence, not permission
   to repair tags or edit versions.
4. Report one row per app/release and explicit blockers/partial completion:

| State | Evidence |
| --- | --- |
| Prepared | OPEN Release PR with consistent version record/head; CI may still be pending |
| Merged | MERGED into main with verified merge parent/tree and manifests |
| Tagged | Exact annotated remote tag and peeled merge commit verified |
| Published | Matching non-draft GitHub Release exists for that verified tag |
| Deployed | App/environment/exact SHA matched to authoritative successful deployment record |

These are separate facts; e.g. Tagged with GitHub Release missing is partial
publication, and Published with deployment unknown is not a failed publication.
A mismatched tag/manifest/PR is an inconsistency, not a later lifecycle state.
Show the baseline/tag SHA, current main versions and current checkout versions
separately. Version changes on develop are not inherently production drift.

5. Follow [deployment evidence](deployment.md) before showing Deployed. A GitHub
   environment named `Production` is insufficient. Missing auth/API access means
   unknown, not no releases/deployments. Show the failed lookup and a retry action.

Example output fields: app, manifest at main, manifest at checkout, latest
reachable stable tag and SHA, latest GitHub Release URL, Release PR, preparation/
merge/tag/publication state, deployment app/environment/SHA/evidence, inconsistencies.
`$release status` never repairs anything or resumes an interrupted publication.
