# Mobile brand colors

Read this reference before changing mobile colors or adding a screen. The approved
visual baseline is `mobile/v0.1.0` (`4013293`), not later neutral-palette changes.
That release used inline colors; `apps/mobile/src/theme/colors.ts` is now the
runtime source of truth. Import its semantic roles instead of copying hex values.
The current button default follows the user-approved activity recommendation
button on main: peach `tint` + `onTint`, superseding the earlier coral CTA default.

| Token | Value | Use |
| --- | --- | --- |
| brand | `#D26A5C` | Active icons/checks, logo, large titles and explicit legacy coral actions; not the button default |
| onBrand | `#241C1A` | Text on explicit coral actions; not default button or body text |
| primary | `#B25447` | Small emphasis text, focus and contrast-sensitive narrow indicators |
| onTint | `#914C41` | Default/pink button text and small text on tint |
| tint | `#FDEDE6` | Default button fill (activity recommendation baseline), selected backgrounds |
| buttonRose | `#F8E1EA` | Paired alternate action fill |
| buttonBlush | `#FBE9EF` | Third action, e.g. photo attachment/regeneration/skip |
| buttonPetal | `#F5D6E0` | Additional action, e.g. photo removal/result inspection |
| buttonMist | `#FFF3F7` | Return/back action alongside several filled buttons |
| background | `#FAF9F9` | Screen, loading, web document and native launch background |
| surface / field | `#FFFFFF` | Cards, inputs, text on dark primary; semantic icons on brand |
| navigationSurface | `rgba(255, 255, 255, 0.94)` | Shared translucent tab capsule; alpha variant of surface, not a new brand hue |
| navigationEdge | `rgba(255, 255, 255, 0.8)` | Decorative thin rim of the shared tab capsule |
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

- Default buttons use `tint` + `onTint` (about 5.56:1). `ActionButton` defaults
  to `tone="default"`; custom welcome/auth/calendar buttons share the same tokens
  in `apps/mobile/src/theme/buttons.ts`. Do not use the old `secondary` flag to
  mean the peach default, or independently copy a fill/label pair.
- Distinct enabled actions shown together use fixed named pink tones: `rose`,
  `blush`, `petal`, `mist`. These four extra fills are scoped to buttons, not a new
  brand palette. All use `onTint` and meet 4.5:1. Use only the tones a view needs;
  never alternate by list index or randomly recolor repeated identical actions.
- Welcome login/signup and auth login/preview use default/rose. Unavailable report
  schedule/records use default/rose. Onboarding next/previous/skip use
  default/rose/blush. Diary materials can show five actions: generate/default,
  direct/rose, photo/blush, remove photo/petal, return/mist. Preserve conditional
  states rather than assigning separate colors to mutually exclusive actions.
- Review caller groups whenever changing a shared button. Existing custom coral
  actions outside this task (child/spouse edit and add-plan submit) are explicit
  legacy exceptions using `brand` + `onBrand`, not a rule for future buttons.
- Active tab/header icons, send icons and completed checks use `brand`. White
  semantic glyphs on coral meet 3:1; this does not permit ordinary white text.
- Keep `primary` for small links, focus, selected calendar/date cells with small
  white digits, and narrow progress/step tracks where coral against the existing
  track would fall below 3:1. Large report values and bars on the screen background
  can use coral. Do not replace every occurrence of primary mechanically.
- Preserve bright screen backgrounds and peach emphasis. Do not compensate with
  a new palette, changed logo geometry, layout, typography or animation timing.
- Press feedback on pastel/default buttons uses the shared tone presets rather than
  fading the whole control and its label. Scale-only motion buttons keep their
  existing transform feedback. Preserve existing handlers, disabled
  semantics and transform motion.

## Shared soft-glass navigation

The floating tab bar uses the same React Native layout, SVG icons and tint selection
on iOS, Android and Web. Use `navigationSurface`/`navigationEdge` for the translucent
surface and decorative rim, `tint` for the contained selection, `brand` for active
icons, `onTint` for active labels and `muted` for other items. The alpha-only surface
roles do not replace existing cards, inputs or buttons. Do not apply opacity to the
whole bar: labels/icons must stay opaque and readable.

This stage uses a common translucent fill and soft shadow, not native Liquid Glass,
backdrop blur, refraction or a green palette. No platform-only glass fallback is
needed. The bar keeps reserved bottom space rather than covering content; adding a
real backdrop/blur later needs a separate content-overlap and platform support review.
At 94% white opacity, inactive text remains at least 4.5:1 and active icons at least
3:1 even over a black backdrop; tests composite the surface over light/dark extremes.
The thin white rim is decorative and is not the sole selected-state indicator.

## Contrast and asset boundaries

Normal text needs 4.5:1, large text 3:1, and meaningful control/state indicators 3:1.
Coral on white is about 3.53:1; white on primary is about 4.94:1.
`onBrand` on coral is about 4.74:1 for explicit coral exceptions. Existing heading
text on coral is only about 4.13:1, so use the explicit `onBrand` role for normal
coral text. Default/pink button text uses `onTint`; white text is not suitable on
these light fills. Never darken all coral surfaces just to retain white labels. Primary on
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
