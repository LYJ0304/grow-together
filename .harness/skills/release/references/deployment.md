# Deployment boundary and future Actions integration

## Observed baseline (2026-10-25; reinspect before acting)

- No tracked `.github/workflows` on maintained branches and no GitHub Actions
  workflows registered. No release tags or GitHub Releases at inspection time.
- `develop`, `staging`, `main` had no branch protection; no repository rulesets.
  Installing this skill does not configure them. A release merge/publication is
  blocked until meaningful protection/required checks are in place and verified.
- Mobile is Expo static web plus native Android/iOS development. No tracked
  `vercel.json` or `eas.json`. GitHub deployment `7298299392` by `vercel[bot]`
  successfully deployed staging commit `f6ecdd8e034ed455e2097c0a02680bbf9d69d17a`
  to an environment named `Production`. This proves a provider deployment for
  that SHA, not an approved tag release or the actual Vercel production policy.
- API staging uses documented Render Docker/Postgres setup; initial Auto Deploy
  should be disabled for manual validation. Actual dashboard settings are not
  verified. See [staging guide](../../../../apps/api/docs/staging/Development.md).
  Worker production host and native mobile publication are not established.

## Current branch policy (2026-11-01)

The repository default and only long-lived branch is `main`; `develop` and
`staging` branches were deleted. Temporary task/release branches remain valid.
Staging and production are deployment environments. Historical observations above
do not establish current provider settings; the user manages the Vercel branch
connection separately. No workflow, protection or provider integration is enabled
by documenting this policy.

## Target deployment flow (separate setup required)

Task PR → main → staging environment QA → version-only Release PR into main →
final merge SHA staging QA → approved app tag → approved production deployment.
Merging main is not an official release or permission to deploy production.
Do not create a staging/production branch or require a branch-promotion PR.
Keep release publication and actual deployment state distinct.

Staging should deploy a pinned main SHA after required CI succeeds; initially use
manual selection as described in the staging guide. Record the exact SHA and
app-specific results, even when main advances during QA. Version changes need
fresh final-merge QA. Later automation must preserve that identity.
For API/worker, build an image for that candidate once and promote its verified
immutable digest to production. For mobile, identify the exact web/native build
and environment configuration; testing a staging build does not prove a separate
production-configured build is identical. Document the provider-specific checks
before activation. This is a target, not an installed pipeline.

After a separate explicit approval, add one real workflow per established target.
Each subscribes **only** to its own tag prefix, for example the API workflow:

```yaml
on:
  push:
    tags:
      - 'api/v*'
```

The worker workflow uses only `worker/v*`; mobile only `mobile/v*`. Prefix matching
is not SemVer validation. Each workflow must validate the stable version, annotated
tag, merged Release PR record, main ancestry, manifest and exact tagged SHA before
build/deploy. Fetch full relevant history/tags and checkout the event's commit,
never main HEAD. Verify final staging QA for that SHA and every selected app.
Reuse the verified artifact/digest for API/worker rather than rebuilding it for
production; identify mobile artifacts and configuration explicitly. Scope GitHub
permissions and provider credentials to the app/environment; use existing environment approval
rules and serialize production deployments per app without cancelling a deployment
mid-flight. Prevent older queued tags from rolling production back silently.
Record app, tag, immutable SHA/artifact, provider deployment identifier and outcome.
A rollback is a separate operator action, never tag movement.

Before enabling this transition, inventory Vercel/Render Git integrations and main
push automatic deployment; otherwise a Release PR merge may deploy before tags
and duplicate a later Actions rollout. Show concrete impact, proposed trigger
changes, staging preservation, verification and rollback to the maintainer. Obtain
explicit approval before changing any workflow/dashboard trigger or protection.
No active workflow is installed by this skill and it does not call deployment hooks.

Mobile web: confirm actual Vercel project, root, web export/build command and
production environment/branch. Native: confirm whether EAS/store publication is
required, then agree artifact/versionCode/buildNumber/store approval policy.
Do not treat native mobile as a server or introduce a native publishing pipeline
because web deployments exist. API: confirm real Render production service and
safe migration/health evidence. Worker: establish the actual job deployment
architecture before suggesting a provider action. Do not invent endpoints/secrets.
Document only required environment variable names in an appropriate `.env.example`
when a later approved integration actually needs them; never commit secret values.

## Deployment evidence for status

For GitHub deployments query the exact release SHA, then each deployment's statuses.
Require a latest successful status, known app/provider project, intended environment
and SHA match; check timestamps so a later failure/in-progress status is not hidden.
A provider's authenticated deployment record may supply equivalent evidence. Link
that record and report its scope: web deployment is not native store publication.
A workflow run counts only if its successful deployment job/artifact/provider
record unambiguously identifies that app/environment/SHA. Tags, Releases, a generic
check run, an environment name, and a health endpoint alone are insufficient.
When mapping or access is missing, report `deployment unverified` and the evidence
needed. The skill never mutates deployment environments to establish status.

Manual configuration remaining: production provider mapping and triggers,
branch protection/required CI/review rules, environment approvals and scoped
credentials, tag-specific workflows, native release scope if any. These require
separate approval; do not claim release automation is enabled by installation.
