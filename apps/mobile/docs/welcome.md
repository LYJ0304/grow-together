# Welcome screen

`app/welcome.tsx` groups the existing logo and brand name with a short explanation
of the app, followed by one primary login action and a quieter sign-up action.
It keeps `/login` and `/signup` navigation and does not introduce a new onboarding
step, preview bypass, API call, or authentication state.

The four weighted spacer views were replaced with a centered, scrollable stack
with a bounded inter-group gap. Its content is capped at 420px, the logo is 104px,
and the normal-size login button reuses the 52px shared ActionButton. Sign-up is
a text action with a minimum 44px target, the existing onTint foreground, a tint
pressed background, and explicit disabled semantics. Existing SafeAreaView handles
native and browser insets; no browser-toolbar height is hardcoded.

Jua is reserved for the brand name. The exact 35px / 44px / -0.7 tracking matches
the shared launch title, and its ref/onLayout/hidden state remain intact. The
existing launch transition and Reduce Motion behavior are unchanged. Description,
value copy, and action labels use the shared typography and color tokens. No logo,
font, palette, or global button style was changed.

## Verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:colors
MOBILE_URL=http://localhost:8291 BROWSER_EXECUTABLE_PATH=/usr/bin/chromium npm run test:welcome:ui
```

The welcome UI check covers 320/375/390/430px phones, wide web, short landscape,
text enlargement, logo/title/action bounds, login and sign-up navigation, and
keyboard activation. Browser screenshots are written to `/tmp/welcome-polish`.
Existing auth and brand-role checks cover the unchanged connected flows. The
launch-transition and launch-logo tests should run against an exported build as
documented in their test entry points.

Browser tests and platform exports do not establish real iOS/Android keyboard,
font-scaling, Safari browser toolbar, or standalone PWA behavior. Verify those on
actual devices before treating platform-specific behavior as complete.
