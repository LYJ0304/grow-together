# Mobile brand colors

Read this reference before changing mobile colors or adding a screen. Preserve the
bright coral/peach palette from `mobile/v0.1.0` (`4013293`). Runtime colors live in
`apps/mobile/src/theme/colors.ts`; import semantic tokens, never copy hex values.

The approved UI Color Harmony & Button Hierarchy refinement supersedes the former
peach-for-every-button and five distinct pastel-tone policies. Preserve the palette
and warm visual balance while assigning color by action meaning.

| Token | Value | Role |
| --- | --- | --- |
| brand | `#D26A5C` | Logo, active icons, completed checks, decorative emphasis |
| onBrand | `#241C1A` | Accessible text if an explicit legacy coral surface is required |
| primary | `#B25447` | Main submission/save/next action; focus, selected date and narrow indicators |
| surface / field | `#FFFFFF` | Content/input surfaces; text on primary and solid danger |
| tint | `#FDEDE6` | Secondary actions, selected backgrounds and warm emphasis |
| onTint | `#914C41` | Text on peach; darker primary pressed fill |
| secondaryPressed | `#F8E1EA` | Existing soft pink reused only for secondary pressed feedback |
| background | `#FAF9F9` | Screen, loading, web document and native launch background |
| heading | `#292929` | Headings and neutral action text |
| text | `#4F4F4F` | Body text |
| muted | `#706C69` | Secondary text/placeholders and explicit disabled text |
| border | `#EEE8E5` | Decorative separators; neutral pressed background |
| controlBorder | `#88889D` | Existing neutral meaningful control/outline boundary |
| danger | `#A03C30` | Actual destructive actions and errors |
| disabled | `#D5CBC6` | Explicit disabled fill/border; never fade the whole button |
| logoAccent | `#D5A064` | Existing logo gold only |
| navigationSurface | `rgba(255, 255, 255, 0.94)` | Shared translucent white tab capsule |
| navigationEdge | `rgba(255, 255, 255, 0.8)` | Decorative rim, not the sole selected indicator |

Existing scrim/welcome shadow tokens, logo geometry and launch backgrounds remain.
No new green/blue/purple palette, layout, typography or animation timing changes.

## Button hierarchy

Use `buttonVariants`, `buttonSurface` and `buttonLabel` from
`apps/mobile/src/theme/buttons.ts`. `ActionButton` takes `variant` and defaults to
`secondary` so an unspecified supporting action does not become a dark CTA.
Explicitly mark main actions. The old `tone` API and rose/blush/petal/mist fills
have been removed; different actions do not each need a different hue.

| Action role / variant | Normal fill / text | Pressed fill | Examples |
| --- | --- | --- | --- |
| `primary` | primary / surface | onTint | Login submit, diary generate/save, schedule final save, onboarding next/save |
| `secondary` | tint / onTint | secondaryPressed | Activity recommendation, direct writing, regenerate, navigation supporting the main next action |
| `tertiary` | surface / heading, controlBorder outline | border | Back, cancel, close, skip, photo change/removal |
| `destructive` | surface / danger, danger outline | tint | Open real diary deletion confirmation |
| `destructive-confirm` | danger / surface | onTint | Final irreversible deletion confirmation; solid treatment of destructive role |

- Normally emphasize one primary action in a visible group. Schedule generation is
  primary before candidates exist, then becomes secondary while final save is primary.
- Diary material generation and result saving occur in different states. Keep direct
  writing secondary, photo actions/back/material review tertiary, regeneration secondary.
  Removing an unsaved photo attachment is tertiary, not permanent deletion.
- Report recording is primary while schedule navigation is secondary. Login-required
  and error states remain honest; never fabricate connected AI behavior.
- Custom welcome/auth/calendar/profile/add-plan buttons share these roles while
  retaining their existing geometry, labels and handlers. Profile edit/retry is
  secondary; actual save is primary. Settings links/logout stay quiet neutral actions.
- Disabled controls keep their actual accessibility/interaction state and use disabled
  fill/border + muted text at full opacity. Pressed colors must preserve text contrast;
  keep existing scale/spring timing and Reduce Motion behavior.
- Do not turn all accents dark: keep peach cards/secondary CTA, white surfaces,
  coral icons/checks, and warm, light backgrounds. Selection also uses existing
  checkmarks, borders, text or accessible selected states, not color alone.

## Navigation, contrast and assets

The floating tab bar retains its shared iOS/Android/Web structure and translucent
white surface. Keep `tint` selection, `brand` icons, `onTint` active labels and
`muted` inactive labels. No Native Tabs or Liquid Glass migration.

Normal text requires 4.5:1, large text 3:1 and meaningful control/state indicators
3:1. White on primary is about 4.94:1; onTint on tint about 5.56:1. Brand coral on
white is about 3.53:1, suitable for icons, not ordinary white button text on coral.
Primary on tint is below 4.5:1: use onTint for small peach text. Keep danger separate
from ordinary CTA and do not use danger to mean logout or photo attachment removal.
Disabled controls are exempt from minimum contrast but retain readable state labels.

`test:colors` calculates normal/pressed text contrast for every variant and outline
contrast for neutral/destructive roles, checks runtime/native background consistency,
logo palette and centralized colors. Navigation tests composite translucent white
over light/dark extremes. Decorative borders/rims are not sole control boundaries.
Static `app.json` backgrounds must equal the runtime background. Do not regenerate
logo/raster assets or alter paths/timing merely to apply action colors.

## Verification

Run mobile `typecheck`, `lint`, `format:check`, `test:colors`, `test:brand`,
`test:brand:ui`, `test:logo`, `test:motion`, `test:visual-polish` and impacted UI tests.
Run `.harness/tests` for harness edits. Compare before/after at 320/390/430px and
wide Web, including welcome/login, main, schedule/confirmation, calendar, diary
materials/result/delete, chat, report, onboarding and profile/settings. Capture
normal/pressed/disabled/selected states where applicable. Export Web/iOS/Android.
Color-only changes use the TDD exception; new consistency checks should demonstrate
an actual pre-fix failure. Browser tests/exports do not replace native device checks.
