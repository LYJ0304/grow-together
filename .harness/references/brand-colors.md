# Mobile brand colors

Read this reference before changing mobile colors or adding a screen. The approved
visual baseline is `mobile/v0.1.0` (`4013293`), not later neutral-palette changes.
That release used inline colors; `apps/mobile/src/theme/colors.ts` is now the
runtime source of truth. Import its semantic roles instead of copying hex values.

| Token | Value | Use |
| --- | --- | --- |
| brand | `#D26A5C` | Logo, decorative progress, large brand titles; never small white CTA text |
| primary | `#B25447` | Primary CTA, focus, selection, text on white/background |
| onTint | `#914C41` | Small text on tint, from the reference diary emphasis color |
| tint | `#FDEDE6` | Secondary action and selected backgrounds |
| background | `#FAF9F9` | Screen, loading, web document and native launch background |
| surface / field | `#FFFFFF` | Cards, inputs, text on primary |
| text | `#4F4F4F` | Body text |
| heading | `#292929` | Existing strong heading/value emphasis |
| muted | `#706C69` | Secondary text and placeholders |
| border | `#EEE8E5` | Decorative separators/card edges, not sole control boundaries |
| controlBorder | `#88889D` | Meaningful input/choice boundaries; reference neutral |
| logoAccent | `#D5A064` | Existing logo gold only |
| danger | `#A03C30` | Existing semantic error/destructive state; independent of brand |
| disabled | `#D5CBC6` | Existing disabled state; preserve its interaction semantics |

Existing modal scrims and welcome shadow are named tokens too; their opacity and
shadow geometry are preserved. Transparent layout surfaces are not palette colors.
Do not change spacing, fonts, routes, animation timing or logo paths to apply colors.

## Contrast and asset boundaries

Normal text needs 4.5:1, large text 3:1, and meaningful control/state indicators 3:1.
Coral on white is about 3.53:1; white on primary is about 4.94:1. Primary on tint is
below 4.5:1, so use `onTint` for small secondary-button/chip text. Decorative borders
may be subtle; use `controlBorder` where an edge identifies an interactive field.
Keep errors readable and separate from primary actions. Disabled controls retain
their existing state styling and are exempt from minimum contrast requirements.

Static `apps/mobile/app.json` backgrounds cannot import TypeScript: keep them equal
to `background`, checked by `npm run test:colors`. Logo SVG and generated geometry
must match `brand`/`logoAccent`; keep their paths, timing and existing compliant PNGs.
Do not regenerate raster assets merely to eliminate anti-alias colors. Review new
semantic roles explicitly; do not introduce another palette or a theme engine.

## Verification

Run mobile `typecheck`, `lint`, `format:check`, `test:colors`, `test:brand`,
`test:logo`, `test:motion`, `test:visual-polish` and impacted screen UI checks.
Compare before/after screenshots at 320 and 390 pixels, landscape and a wide web
viewport; include launch/auth, main, records, chat, settings and onboarding, with
loading, errors, disabled and selected controls where applicable. Export web/iOS/
Android bundles. Browser previews and exports do not substitute for native device
verification; report that limitation. Run `.harness/tests` for harness edits.
Color-only/document changes use the conventions' TDD exception; new consistency or
contrast checks should expose a real failure before the correction.
