"""Generate runtime paths and platform PNGs from brand/emblem.svg. Offline only."""
import copy
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET

import cairosvg
from PIL import Image
from svgpathtools import parse_path

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets/images"
BRAND = IMAGES / "brand"
SVG = BRAND / "emblem.svg"
root = ET.parse(SVG).getroot()
paths = list(root)
assert len(paths) == 6
lengths = [parse_path(path.attrib["d"]).length() for path in paths]
# Keep the connected main gesture at one speed; give the tiny accents time to read.
main_ms = 2145
accent_ms = 85
delay = 0
strokes = []
for index, (path, length) in enumerate(zip(paths, lengths)):
    duration = length / sum(lengths[:3]) * main_ms if index < 3 else accent_ms
    strokes.append(dict(id=path.attrib["id"], d=path.attrib["d"],
                        stroke=path.attrib["stroke"],
                        strokeWidth=float(path.attrib["stroke-width"]),
                        length=length, delayMs=delay, durationMs=duration))
    delay += duration
assert abs(delay - 2400) < 1e-6
(BRAND / "emblem.json").write_text(json.dumps(dict(
    viewBox=root.attrib["viewBox"], durationMs=2400, strokes=strokes
), indent=2) + "\n")


def raster(filename, size, width, background=None, monochrome=False):
    artwork = copy.deepcopy(root)
    if monochrome:
        for path in artwork:
            path.set("stroke", "#000000")
    # Render at 4x for clean downsampling; the source's aspect ratio never changes.
    height = round(width * 416 / 560)
    ink = Image.open(io.BytesIO(cairosvg.svg2png(
        bytestring=ET.tostring(artwork), output_width=width * 4,
        output_height=height * 4,
    ))).convert("RGBA")
    canvas = Image.new("RGBA", (size * 4, size * 4), background or (0, 0, 0, 0))
    canvas.alpha_composite(ink, ((size * 4 - ink.width) // 2, (size * 4 - ink.height) // 2))
    canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)
    if background:
        canvas = canvas.convert("RGB")
    canvas.save(IMAGES / filename)


raster("grow-together-logo.png", 1024, 944)
raster("icon.png", 1024, 700, "#FAF9F9")
# All ink fits inside Android's central 66/108 safe square, including round caps.
raster("android-icon-foreground.png", 1080, 648)
raster("android-icon-monochrome.png", 1080, 648, monochrome=True)
raster("favicon.png", 64, 58, "#FAF9F9")
raster("splash-icon.png", 1024, 944)
# Guard platform properties, rather than relying only on file names.
assert Image.open(IMAGES / "icon.png").mode == "RGB"
for filename in ("android-icon-foreground.png", "android-icon-monochrome.png"):
    bounds = Image.open(IMAGES / filename).getchannel("A").getbbox()
    assert bounds and min(bounds[:2]) >= 210 and max(bounds[2:]) <= 870
mono = Image.open(IMAGES / "android-icon-monochrome.png")
assert all(r == g == b == 0 for r, g, b, a in mono.getdata() if a)
print("Generated emblem.json and six platform PNGs from emblem.svg")
