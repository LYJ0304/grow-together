# Launch drawing assets and verification

The repository has a 1024×1024 PNG, not an original vector logo. The PNG remains
unchanged and is always the displayed artwork. Generated assets only describe
where a background-colored cover becomes transparent; they do not replace the
logo or claim to recover the artist's original vector.

[`generate-launch-logo.py`](../scripts/generate-launch-logo.py) labels the two ink components, extracts their medial
axes, recenters thinning against the ink distance field, resolves the small filled
corner at the heart notch, and traces each stroke. A common linear arc-length
timeline allocates 2250 ms to drawing plus a 50 ms intentional pen lift. Round
reveal heads follow those routes. Source-pixel ownership and accumulated coverage
prevent erasure and include the original faint fringes. The generator asserts the
input hash, topology, complete coverage, and atlas size.

Masks are prepared offline at 60 Hz in 1×/2× variants. A small WebGL canvas
interpolates adjacent spatial masks, including on higher refresh rate displays.
Resources are decoded, alpha-only textures uploaded, and an empty frame prepared
before the drawing clock starts. No per-frame geometry measurement, image
processing, CSS mask, or React update is needed. Completion keeps the same canvas
frame over the same original image. WebGL failure, context loss, skip, and reduced
motion expose the static original.

The cover is capped at 2× even on 3× devices; the original PNG remains at native
density. Selected 2× masks total about 118 KB compressed, uploaded 8-bit alpha data
is about 3.6 MB, and browser RGBA decoding can use about 14.3 MB. Actual GPU
allocation depends on the driver and has not been measured. This trades preparation and
memory for a small per-frame render. Original color is never sampled through
WebGL, avoiding the edge/color changes observed with pre-resized colored frames.

## Architecture decision

No original stroke vector was found in the repository or available history.
The former approximate guides and completion rectangle were removed. CSS bitmap
masking retained masking costs. Colored logo frames and rendering the original
through WebGL changed edge/color pixels. Native transform cover sheets avoided
per-frame JavaScript, but visual tests detected filtering artifacts, early pixels,
and changes to completed ink, so that candidate was rejected without relaxing the
checks. The selected GPU cover keeps the original HTML image and interpolates only
spatial reveal coverage. Linux WebKit timing still varies; actual iPhone smoothness
is not proven by the desktop diagnostics.

## Regenerate (offline tools only)

From `apps/mobile`:

```sh
python3 -m venv /tmp/grow-logo-assets
/tmp/grow-logo-assets/bin/pip install -r scripts/logo-assets-requirements.txt
/tmp/grow-logo-assets/bin/python scripts/generate-launch-logo.py
```

If the PNG changes, review its stroke topology before updating the pinned source
hash. The extracted centerline comes from raster pixels; an original brand vector
remains preferable if one becomes available.

## Browser checks

From `apps/mobile`, export and serve with extensionless routes resolving to exported `.html` files:

```sh
npx expo export --platform web --output-dir /tmp/grow-logo-web
npm run test:logo -- http://localhost:8156
```

`LOGO_BROWSER=chrome` or `LOGO_BROWSER=webkit` selects a browser family.
`CHROME_EXECUTABLE` selects Chrome (default `/usr/bin/google-chrome`). Test-only
`playwright-core` does not download browsers. Set `WEBKIT_EXECUTABLE` to a compatible
Playwright WebKit launcher for mobile 2×/3× checks. `LOGO_BASELINE_URL` optionally
compares frame pacing with a separately served previous export. The existing
`test:motion` still accepts Chrome's remote-debugging URL as its second argument.

Timing diagnostics run without screenshot overhead. A separate controlled-rAF pass
captures actual browser-composited frames during the first 500 ms, both strokes,
the pen lift, and completion. Changed pixels must stay near the measured pen route,
never erase drawing, never stop outside the deliberate lift, and never jump at
completion. Final screenshots are compared with native rendering of the unchanged
PNG using a strict edge-rasterization tolerance. Images and JSON go to a printed
temp path. Tests also exercise reduced motion, live preference changes, tap skip,
history return, WebGL unavailability, and context loss.

rAF intervals are diagnostics, not proof of GPU presentation or guaranteed 60 fps.
Linux WebKit is not iOS Safari. Verify cold/warm load, first 500 ms, pen lift,
completion/400 ms hold, rapid skip, background/resume, rotation, reduced motion,
and history return on real iPhones against the deployed Vercel build.
