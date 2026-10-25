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

## Proposed target (documentation only)

`develop → staging` (QA/staging) → `main` (stable baseline) → approved app tag →
GitHub Actions → provider production deployment. Merging main is not the official
release event. Preserve existing staging behavior. Keep release publication and
actual deployment state distinct.

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
never main HEAD. Deploy the artifact built from that SHA. Scope GitHub permissions
and provider credentials to the app/environment; use existing environment approval
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
