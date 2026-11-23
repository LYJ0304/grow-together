# README badge assets

These four SVGs were generated with **badge-maker 6.0.0**, the official
[Shields.io badge library](https://github.com/badges/shields/tree/master/badge-maker).
They are local, static documentation assets, not CI results or release badges.
Keeping them here avoids an external image request each time the README renders.
The application logo is reused directly from the mobile assets and is unchanged.

| File          | Label / message         | Source of truth                                         |
| ------------- | ----------------------- | ------------------------------------------------------- |
| `status.svg`  | status / in development | Root README roadmap and explicit integration boundaries |
| `expo.svg`    | Expo / 55               | [Mobile package](../../apps/mobile/package.json)        |
| `spring.svg`  | Spring Boot / 4         | [API build](../../apps/api/build.gradle)                |
| `fastapi.svg` | AI Worker / FastAPI     | [Worker project](../../apps/worker/pyproject.toml)      |

To refresh a badge, use the library's `makeBadge({ label, message, color, style: 'flat' })`
API and write the returned SVG. Preserve the existing values unless their source
changes. No badge-generation package is added to the application's dependencies.

Product screenshots are intentionally not fabricated or substituted with UI stress-test
captures. A future gallery should capture Home, Diary, Schedule, and Chat at a
consistent viewport with non-sensitive sample data and accurate feature-state labels.
