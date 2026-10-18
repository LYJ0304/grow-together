# GrowTogether

A mobile app with an independent API and AI worker.

Start with the [local development guide](infra/docs/local-development.md).

| Module | Responsibility | Documentation |
| --- | --- | --- |
| `apps/mobile` | Expo mobile and web app | [Development](apps/mobile/docs/development.md) |
| `apps/api` | Application API and persistence | [Development](apps/api/docs/development.md) · [Staging deployment](apps/api/docs/staging/Development.md) |
| `apps/ai-worker` | Independent AI job execution | [Development](apps/ai-worker/docs/development.md) |
| `infra` | Local Compose services and PostgreSQL | [Local development](infra/docs/local-development.md) |

The API contract is [contracts/openapi.yaml](contracts/openapi.yaml).
