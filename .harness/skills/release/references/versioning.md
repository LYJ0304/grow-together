# Version selection

Reinspect paths/manifests/dependencies each time. This is the observed layout,
not permission to create absent applications or change package managers:

| ID / tag prefix | Sources | Version definitions and consistency |
| --- | --- | --- |
| `mobile` / `mobile/v` | `apps/mobile` | `package.json.version`, `app.json.expo.version`, `package-lock.json.version` and `packages[""].version` must match |
| `api` / `api/v` | `apps/api` | Only the app `version` assignment in `build.gradle`; not plugin/dependency versions |
| `worker` / `worker/v` | `apps/ai-worker` | `pyproject.toml` `[project].version` and the local project entry in `uv.lock` |

Mobile uses Expo/React Native/TypeScript and npm; API uses Java 21/Gradle;
worker uses Python >=3.12/uv. Do not rename the worker to `apps/worker`.
`contracts/openapi.yaml.info.version` describes the API document, not a common
application version. Revisit it on contract changes; do not synchronize it
mechanically with every API patch or other applications.

## Evidence and policy

Select the highest stable SemVer application tag reachable from the approved
base, and check history agrees with version precedence. The helper reports tags outside the historical base and rejects malformed app
tags, non-monotonic reachable ancestry, lightweight tags, and competing tags at
the same commit. A missing target tag cannot be newly published if that app
already has an equal/newer stable tag; an existing exact older tag may still
recover a missing GitHub Release. Later releases of unrelated apps do not block
that recovery. Refresh all remote
app tags first; do not hide conflicts with forced fetches. Prerelease tags are
reported but are not stable release baselines. Remote-only/newer tags must also
be considered; do not release an older version because a tag was not fetched.

For each app inspect `git log <previous-tag>..<base>`, `git diff` (including
renames), merged PRs and actual caller changes. Show the actual relevant file
list and explain shared dependencies. Helper `candidates` are hints, not an
automatic release selection. Read affected code before recommending a bump.

- MAJOR: incompatible public, API, wire, persistence, or operational contract.
- MINOR: backward-compatible capabilities/features.
- PATCH: backward-compatible fixes.
- Before 1.0: both incompatible changes and compatible features increment MINOR
  (`0.y.z → 0.(y+1).0`); fixes increment PATCH. Explicitly identify breaking
  behavior and migration/rollout order even when the major remains zero.
  Stable `1.0.0` readiness is a separate human decision.

Commit prefixes are clues, not the policy. Explain what changed in observable
behavior and why that warrants the proposed increment. Docs, test-only changes,
and refactors need no release unless they affect the delivered artifact or an
operational contract. Explain unchanged/excluded apps in the proposal.

API packages the root OpenAPI file. Mobile consumes API wire behavior; inspect
actual mobile consumers to decide whether a coordinated release is necessary.
Do not release mobile solely because an unused API endpoint was added. The
current worker only executes independent example jobs and does not consume the
root OpenAPI contract; do not release it solely for an OpenAPI edit. Follow any
new concrete dependencies discovered later. Inspect Dockerfiles, config and
migrations for operational effects; mixed-version compatibility can require a
coordinated rollout even with independent tags.

## First release and updates

No existing tag means **no known official previous release**, not "no changes".
Show manifest values, relevant history, and an explicit bootstrap proposal.
Observed starting values: mobile `1.0.0`, API `0.0.1-SNAPSHOT`, worker `0.1.0`.
Do not downgrade mobile to match illustrative `0.x` examples. Normalize the API
SNAPSHOT to an approved stable SemVer rather than publishing a SNAPSHOT tag.
The helper accepts stable `X.Y.Z` targets only; prerelease publication is outside
this workflow. It supports all valid SemVer baselines, including prereleases,
while selecting stable baselines for official releases.

The user may override app selection/versions before preparation; explain any
incompatible policy choice and ask for a revised plan rather than silently
releasing a regression or an already-used version. A version must exceed its
previous official tag and must not go below the current manifest precedence.
An initial stable version may equal its untagged manifest. If all apps have
previous tags and no relevant changes, stop without branch/PR/tag creation.

After approval update the existing fields, keeping dependency versions intact.
For mobile update only root npm lock metadata or run the existing npm lock-only
workflow and inspect churn. For worker run `uv lock` if needed and inspect its
local package version; do not upgrade dependencies incidentally. Confirm with
`uv sync --locked`. Avoid introducing a new version registry, generating native
build numbers, or adding EAS/store configuration before an actual requirement.
