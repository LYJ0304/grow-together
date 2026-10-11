"""Generate spatial reveal masks from the unchanged PNG, never replacement artwork.

The medial axis supplies the pen route; original RGBA remains the displayed logo.
Regenerate with the pinned offline requirements in this directory.
"""

from pathlib import Path
import hashlib
import json
import math
import numpy as np
from PIL import Image
from scipy.ndimage import (
    label,
    distance_transform_edt,
    gaussian_filter1d,
    map_coordinates,
    maximum_filter1d,
)
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/images/grow-together-logo.png"
OUTPUT = ROOT / "assets/images/launch-drawing-masks"
OUTPUT.mkdir(exist_ok=True)
SIZE = 145
DURATION = 2300
LIFT = 50
FPS = 60
assert (
    hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    == "161f4b607f2fabc0895a18d67bf98e9215dd68b1f223189453d2873afc937322"
), "Review stroke topology before regenerating a different logo"
rgba = np.array(Image.open(SOURCE).convert("RGBA"))
alpha = rgba[:, :, 3]
solid = alpha > 128
labels, count = label(solid, structure=np.ones((3, 3)))
assert count == 2
field = distance_transform_edt(solid)
nearest_solid = distance_transform_edt(
    ~solid, return_distances=False, return_indices=True
)
owners = labels[nearest_solid[0], nearest_solid[1]]


def graph_for(mask):
    pixels = set(map(tuple, np.argwhere(skeletonize(mask))))
    graph = {}
    for y, x in pixels:
        neighbors = set()
        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                other = (y + dy, x + dx)
                if not (dx or dy) or other not in pixels:
                    continue
                if dx and dy and ((y + dy, x) in pixels or (y, x + dx) in pixels):
                    continue
                neighbors.add(other)
        graph[(y, x)] = neighbors
    return graph


# shortcut: PNG-derived centerline; use original stroke geometry if a brand vector becomes available.
def trace(component):
    graph = graph_for(labels == component)
    radius = float(np.median([field[p] for p in graph]))
    corners = {}
    for endpoint in [p for p, n in graph.items() if len(n) == 1]:
        twig = [endpoint]
        previous = None
        current = endpoint
        while len(graph[current]) <= 2:
            options = graph[current] - ({previous} if previous else set())
            if not options:
                break
            nxt = next(iter(options))
            previous, current = current, nxt
            twig.append(current)
        if len(graph[current]) == 3 and len(twig) < radius * 2.5:
            turn = min(twig, key=lambda p: abs(field[p] - radius))
            corners[current] = turn
            graph[current].remove(twig[-2])
            for p in twig[:-1]:
                del graph[p]
    odd = [p for p, n in graph.items() if len(n) % 2]
    if component == 1:
        assert len(odd) == 2
        start = min(odd, key=lambda p: p[1])
    else:
        assert len(odd) == 2
        start = next(p for p in odd if len(graph[p]) == 3)
    remaining = {p: set(n) for p, n in graph.items()}
    stack = [start]
    route = []
    while stack:
        p = stack[-1]
        if remaining[p]:
            nxt = min(remaining[p], key=lambda n: (n[1], n[0]))
            remaining[p].remove(nxt)
            remaining[nxt].remove(p)
            stack.append(nxt)
        else:
            route.append(stack.pop())
    route.reverse()
    assert all(not n for n in remaining.values())
    # Resolve medial-axis twigs at sharp filled joins into an optical turn, not a retraced stroke.
    for root, turn in corners.items():
        index = route.index(root)
        span = round(radius * 1.5)
        route = route[: index - span] + [turn] + route[index + span + 1 :]
    xy = np.array([(x, y) for y, x in route], dtype=float)
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(xy, axis=0), axis=1))]
    uniform = np.arange(0, s[-1], 1.0)
    xy = np.column_stack([np.interp(uniform, s, xy[:, i]) for i in [0, 1]])
    xy = gaussian_filter1d(xy, 2, axis=0, mode="nearest")
    # Recenter raster thinning bias along the local normal, using the source distance field.
    tangent = np.gradient(xy, axis=0)
    tangent /= np.maximum(np.linalg.norm(tangent, axis=1, keepdims=True), 1e-8)
    normal = np.column_stack([-tangent[:, 1], tangent[:, 0]])
    offsets = np.linspace(-5, 5, 41)
    candidates = xy[:, None, :] + normal[:, None, :] * offsets[None, :, None]
    distances = map_coordinates(
        field, [candidates[:, :, 1].ravel(), candidates[:, :, 0].ravel()], order=1
    ).reshape(len(xy), -1)
    shifts = offsets[np.argmax(distances, axis=1)]
    for turn in corners.values():
        shifts[np.linalg.norm(xy - np.array(turn[::-1]), axis=1) < radius * 2] = 0
    xy += normal * gaussian_filter1d(shifts, 3)[:, None]
    # Flat raster caps are beyond thinning endpoints; extend along the measured tangent.
    for endpoint, other, direction in [(0, 10, -1), (-1, -11, 1)]:
        if component == 2 and endpoint == 0:
            continue
        v = (xy[other] - xy[endpoint]) if endpoint == 0 else (xy[endpoint] - xy[other])
        v = v / np.linalg.norm(v) * direction
        p = xy[endpoint].copy()
        last = p.copy()
        for step in np.arange(0.5, 35, 0.5):
            candidate = p + v * step
            a = map_coordinates(
                alpha, [np.array([candidate[1]]), np.array([candidate[0]])], order=1
            )[0]
            if a < 32:
                break
            last = candidate
        if endpoint == 0:
            xy = np.vstack([last, xy])
        else:
            xy = np.vstack([xy, last])
    endpoints = xy[[0, -1]].copy()
    xy = gaussian_filter1d(xy, 1.5, axis=0, mode="nearest")
    xy[0], xy[-1] = endpoints
    arc = np.r_[0, np.cumsum(np.linalg.norm(np.diff(xy, axis=0), axis=1))]
    samples = np.linspace(0, arc[-1], round(arc[-1]) + 1)
    xy = np.column_stack([np.interp(samples, arc, xy[:, i]) for i in [0, 1]])
    return xy, samples


paths = [trace(i) for i in [1, 2]]
lengths = [float(s[-1]) for xy, s in paths]
total = sum(lengths)
metadata = {
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "size": SIZE,
    "durationMs": DURATION,
    "penLiftMs": LIFT,
    "fps": FPS,
    "strokes": [],
}
start = 0
for stroke, (xy, arc) in enumerate(paths):
    duration = (DURATION - LIFT) * lengths[stroke] / total
    indices = np.argwhere(owners == stroke + 1)
    pixels = indices[:, ::-1].astype(float)
    tree = cKDTree(xy)
    dist, projection = tree.query(pixels)
    projected = arc[projection]
    radii = np.zeros(len(xy))
    visible = alpha[indices[:, 0], indices[:, 1]] >= 32
    np.maximum.at(radii, projection[visible], dist[visible])
    radii = maximum_filter1d(radii, 17) + 0.75
    times = np.r_[np.arange(0, duration, 1000 / FPS), duration]
    component = rgba.copy()
    component[:, :, 3] = np.where(owners == stroke + 1, alpha, 0)
    component[component[:, :, 3] == 0, :3] = 0
    box = Image.fromarray(component[:, :, 3]).getbbox()
    crop = {
        "x": max(0, math.floor(box[0] * SIZE / 1024) - 1),
        "y": max(0, math.floor(box[1] * SIZE / 1024) - 1),
    }
    crop["width"] = min(SIZE, math.ceil(box[2] * SIZE / 1024) + 1) - crop["x"]
    crop["height"] = min(SIZE, math.ceil(box[3] * SIZE / 1024) + 1) - crop["y"]
    cols = math.ceil(math.sqrt(len(times)))
    rows = math.ceil(len(times) / cols)
    frame_data = []
    masks = []
    current = np.zeros((1024, 1024), dtype=np.uint8)
    for index, time in enumerate(times):
        progress = min(time / duration, 1) * arc[-1]
        head = np.array([np.interp(progress, arc, xy[:, i]) for i in [0, 1]])
        radius = float(np.interp(progress, arc, radii))
        if index:
            support = np.maximum(radius, dist + 0.75)
            circle = np.clip(
                support - np.linalg.norm(pixels - head, axis=1) + 0.5, 0, 1
            )
            reveal = np.where(projected <= progress, 1, circle)
            values = np.rint(reveal * 255).astype(np.uint8)
            current[indices[:, 0], indices[:, 1]] = np.maximum(
                current[indices[:, 0], indices[:, 1]], values
            )
        masks.append(Image.fromarray(current.copy()))
        frame_data.append(
            {
                "timeMs": round(float(time), 6),
                "arc": round(float(progress), 3),
                "head": [round(float(v) * SIZE / 1024, 3) for v in head],
                "radius": round(radius * SIZE / 1024, 3),
            }
        )
    assert np.all(current[indices[:, 0], indices[:, 1]] == 255)
    for scale in [1, 2]:
        atlas = Image.new(
            "RGBA", (crop["width"] * scale * cols, crop["height"] * scale * rows)
        )
        previous = np.zeros((SIZE * scale, SIZE * scale), dtype=np.uint8)
        for index, mask in enumerate(masks):
            coverage = np.array(
                mask.resize((SIZE * scale, SIZE * scale), Image.Resampling.LANCZOS)
            )
            coverage = np.maximum(coverage, previous)
            previous = coverage
            frame = np.full((SIZE * scale, SIZE * scale, 4), 255, dtype=np.uint8)
            frame[:, :, 3] = coverage
            tile = Image.fromarray(frame).crop(
                (
                    crop["x"] * scale,
                    crop["y"] * scale,
                    (crop["x"] + crop["width"]) * scale,
                    (crop["y"] + crop["height"]) * scale,
                )
            )
            atlas.paste(
                tile,
                (
                    (index % cols) * crop["width"] * scale,
                    (index // cols) * crop["height"] * scale,
                ),
            )
        assert max(atlas.size) <= 4096
        name = f"stroke-{stroke+1}-{scale}x.png"
        atlas.save(OUTPUT / name, optimize=True)
        print(name, atlas.size, (OUTPUT / name).stat().st_size)
    metadata["strokes"].append(
        {
            "length": round(lengths[stroke], 3),
            "startMs": round(start, 6),
            "durationMs": round(duration, 6),
            "crop": crop,
            "columns": cols,
            "rows": rows,
            "frames": frame_data,
        }
    )
    start += duration + LIFT
(OUTPUT / "drawing.json").write_text(json.dumps(metadata, separators=(",", ":")) + "\n")
print(
    "Geometry:",
    lengths,
    "durations:",
    [
        (x["startMs"], x["durationMs"], len(x["frames"]), x["crop"])
        for x in metadata["strokes"]
    ],
)
