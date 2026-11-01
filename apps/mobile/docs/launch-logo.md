# Brand emblem and launch

## Artwork and assets

`assets/images/brand/logo-reference.png` is the supplied reference (originally
provided at `assets/images/logo-reference.png`). `brand/emblem.svg` is the single
authoritative symbol: six explicit Bézier/line paths, no background or lettering.
The asymmetrical enclosing gesture crosses the heart and continues to the sprout.
The coral is `#D26A5C`, the small reference-inspired gold accents are `#D5A064`,
and the launch background is `#FAF9F9`. This is a manual reconstruction, not an
original artist vector: the reference's textured color and taper are simplified
to solid rounded strokes (8.5-unit enclosing curve, 12-unit heart).

`brand/emblem.json` is generated from the SVG for inline web rendering; do not edit
it independently. The same generator produces transparent `grow-together-logo.png`
(shared by welcome and auth) and `splash-icon.png`, opaque 1024px
`icon.png` (also iOS), transparent Android foreground and black-only monochrome
assets, and `favicon.png`. Android ink stays inside the central 66/108 safe square.
The reference PNG is never displayed by the application.

## Drawing and lifecycle

Web renders the generated paths directly in an inline SVG. Each path has normalized
`pathLength=1`. The browser Web Animations API reveals `stroke-dashoffset` linearly,
in order: enclosing curve → heart → sprout → three gold strokes. Main paths share
one distance/time ratio. Total duration is 2400ms: 2145ms shared by the main gesture
and 85ms per accent. Change `main_ms` / `accent_ms` in the generator and regenerate;
update timeline expectations in tests when deliberately changing total duration.
There are no canvas textures, masks, frame loops or per-frame React updates.

The SVG remains mounted throughout drawing and completion; removing dash effects
exposes exactly the same paths. Completion starts the existing 400ms hold and
`/app-name` title transition. The real Jua title fades in late in the drawing.
Tap skip marks the intro played, cancels drawing and retains the completed emblem
while navigating. The provider remembers completion across history return.
Effects dispose animations, media listeners and the bounded safety timer on unmount.

The initial reduced-motion CSS shows static art before hydration. A live preference
change completes immediately. Missing/failed animation APIs, an animation rejection,
or a 3500ms safety timeout also complete to static art, so navigation cannot wait
indefinitely. The app shell still requires JavaScript.

Native iOS/Android use the authoritative SVG statically with the existing Expo Image component
and 1000ms automatic navigation. No native animated SVG renderer is installed; the deliberate
static fallback avoids adding a native dependency just for the intro. It inherently
respects reduced motion. The existing native transition checks AccessibilityInfo.
Native icon/splash changes require a new native build; JS/web launch changes appear
in the next app bundle/web export. Expo Go does not validate production splash.

## Regenerate

From `apps/mobile`:

```sh
python3 -m venv /tmp/grow-brand-tools
/tmp/grow-brand-tools/bin/pip install -r scripts/logo-assets-requirements.txt
/tmp/grow-brand-tools/bin/python scripts/generate-brand-assets.py
```

Review SVG and generated icons together. The script asserts alpha/monochrome
properties. Python dependencies are offline asset tools, never app dependencies.

## Verify

```sh
npm run test:brand
npm run typecheck
npm run lint
npm run format:check
EXPO_PUBLIC_API_URL=http://localhost:8080 EXPO_PUBLIC_ENABLE_AUTH_BYPASS=true npx expo export --platform web --clear --output-dir /tmp/grow-brand-web
npm run test:logo -- http://localhost:8156
npm run test:motion -- http://localhost:8156 http://localhost:9223
```

Serve the export with extensionless routes resolving to `.html`. Logo tests use
`playwright-core` and `/usr/bin/google-chrome` (`CHROME_EXECUTABLE` overrides it).
`LOGO_BROWSER=webkit` and `WEBKIT_EXECUTABLE` select an installed Playwright WebKit.
Tests print a temporary screenshot directory with initial, intermediate, completed
and reduced-motion viewport captures. They verify the linear timeline, final SVG
pixels, completion stability, layout, history return, rapid skip, live reduced motion
and missing-API fallback. Motion tests require Chrome remote debugging at the given
URL. Desktop browser results do not prove iOS Safari or native device behavior;
manually check cold/warm starts, background/resume, rotation, VoiceOver/TalkBack,
production icon masks and native splash on physical devices before release.

Implementation references: [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate), [Expo Image formats](https://docs.expo.dev/versions/v55.0.0/sdk/image/), [Expo icons and splash](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).
