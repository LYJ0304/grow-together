# Mobile brand colors

Read this reference before changing mobile colors or adding a screen. The approved
visual baseline is `mobile/v0.1.0` (`4013293`), not later neutral-palette changes.
That release used inline colors; `apps/mobile/src/theme/colors.ts` is now the
runtime source of truth. Import its semantic roles instead of copying hex values.

| Token | Value | Use |
| --- | --- | --- |
| brand | `#D26A5C` | Default filled CTA, active icons/checks, logo and large brand titles |
| onBrand | `#241C1A` | Normal text on coral filled CTAs; not a replacement for body text |
| primary | `#B25447` | Small emphasis text, focus and contrast-sensitive narrow indicators |
| onTint | `#914C41` | Small text on tint, from the reference diary emphasis color |
| tint | `#FDEDE6` | Secondary action and selected backgrounds |
| background | `#FAF9F9` | Screen, loading, web document and native launch background |
| surface / field | `#FFFFFF` | Cards, inputs, text on dark primary; semantic icons on brand |
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

## Preserve the bright visual balance

Preserve roles and visible area as well as palette values. The reference welcome
CTA used bright coral; some functional CTAs already used dark primary. A blanket
primary assignment later made the app feel red and heavy despite unchanged hex
values. The intended balance is warm, airy coral/peach with dark accents used
selectively, rather than a claim that every reference control was bright coral.

- Filled actions (welcome/auth, shared buttons, child/spouse forms, schedule and
  diary actions) use `brand` + `onBrand`; secondary actions use `tint` + `onTint`.
- Active tab/header icons, send icons and completed checks use `brand`. White
  semantic glyphs on coral meet 3:1; this does not permit ordinary white text.
- Keep `primary` for small links, focus, selected calendar/date cells with small
  white digits, and narrow progress/step tracks where coral against the existing
  track would fall below 3:1. Large report values and bars on the screen background
  can use coral. Do not replace every occurrence of primary mechanically.
- Preserve bright screen backgrounds and peach emphasis. Do not compensate with
  a new palette, changed logo geometry, layout, typography or animation timing.
- Press feedback on coral text buttons changes the surface color rather than
  fading the whole control and its label. Preserve existing handlers, disabled
  semantics and transform motion.

## Contrast and asset boundaries

Normal text needs 4.5:1, large text 3:1, and meaningful control/state indicators 3:1.
Coral on white is about 3.53:1; white on primary is about 4.94:1.
`onBrand` on coral is about 4.74:1; on peach it is above 4.5:1. Existing heading
text on coral is only about 4.13:1, so use the explicit `onBrand` role for normal
CTA text. Never darken all coral surfaces just to retain white labels. Primary on
tint is below 4.5:1, so use `onTint` for small secondary-button/chip text. Decorative borders
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
`test:brand:ui`, `test:logo`, `test:motion`, `test:visual-polish` and impacted screen
UI checks.
Compare before/after screenshots at 320 and 390 pixels, landscape and a wide web
viewport; include launch/auth, main, records, chat, settings and onboarding, with
loading, errors, disabled and selected controls where applicable. Export web/iOS/
Android bundles. Browser previews and exports do not substitute for native device
verification; report that limitation. Run `.harness/tests` for harness edits.
Color-only/document changes use the conventions' TDD exception; new consistency or
contrast checks should expose a real failure before the correction.
