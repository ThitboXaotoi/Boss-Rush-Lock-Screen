"""Ground import: the owner's Gemini background (art/src/backdrop.jpg) -> game data.

    bun run --filter @boss-rush/tools ground:import

Keeps only the ground and the foothills (from the first non-flat row down); the sky is drawn by
code for each time of day (owner, Nov 22). Writes:
  packages/render/src/art/ground.ts     rows of colour indices, plus the integrator's small clouds
  packages/core/src/palette.ground.ts   the ground colours for dawn, day, dusk and night
Shrinks with the most common colour per block (no blending) after reducing to GROUND_COLORS.
Runs with the machine's Python + Pillow:
    uv run --no-project --python /usr/bin/python3 python ground/convert.py
"""
from collections import Counter
from pathlib import Path
from subprocess import check_output
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "art/src/backdrop.jpg"
OUT_ART = ROOT / "packages/render/src/art/ground.ts"
OUT_PAL = ROOT / "packages/core/src/palette.ground.ts"
# Read the profile directly: the core barrel also imports the palette we generate here.
WIDTH = int(check_output(
    ["bun", "--print", "require('./packages/core/src/profiles.ts').compact.logical.width"],
    cwd=ROOT, text=True,
))
GROUND_COLORS = 10
CLOUD_ROWS = 22      # transparent rows above the foothills, where the clouds sit
SKY_DISTANCE = 60    # allow JPEG variation in the last flat band of the owner's sky

# Integrator-drawn clouds (owner chose "code sky + low clouds"). c = cloud, C = cloud shade.
CLOUDS = [
    (118, 4, [
        "......cccc............",
        "...ccccccccc..cccc....",
        ".cccccccccccccccccccc.",
        "cccccccccccccccccccccc",
        ".CCCCCCCCCCCCCCCCCCCC.",
    ]),
    (86, 13, [
        "....cccc......",
        "..cccccccccc..",
        "cccccccccccccc",
        ".CCCCCCCCCCCC.",
    ]),
    (152, 15, [
        "..ccc....",
        "ccccccc..",
        ".CCCCCC..",
    ]),
]

src = Image.open(SRC).convert("RGB")
W, H = src.size
px = src.load()
def row_colour(y):
    row = [px[x, y] for x in range(0, W, 2)]
    return row, sorted(row, key=sum)[len(row) // 2]

def differs(a, b):
    return sum(abs(u - v) for u, v in zip(a, b)) > SKY_DISTANCE

def busy(y):
    """A sky row is one flat colour across; the foothills' outline makes a row vary."""
    row, median = row_colour(y)
    return sum(differs(p, median) for p in row) > len(row) * 0.05

top = next((y for y in range(H) if busy(y)), None)
if top is None or top == 0:
    raise ValueError("Expected a flat sky above the foothills in art/src/backdrop.jpg.")
_, horizon_sky = row_colour(top - 1)
# A narrow peak can start before 5% of a row changes. Back up to include its tip.
while top > 0 and any(differs(px[x, top - 1], horizon_sky) for x in range(W)):
    top -= 1
# Stop on the first hill in each column; similarly coloured fields below stay solid.
ridge = [next((y for y in range(top, H) if differs(px[x, y], horizon_sky)), H) - top
         for x in range(W)]
crop = src.crop((0, top, W, H))
scale = W / WIDTH
rows_out = max(1, round((H - top) / scale))

q = crop.quantize(GROUND_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
pal = q.getpalette()[: GROUND_COLORS * 3]
colors = [tuple(pal[i * 3 : i * 3 + 3]) for i in range(GROUND_COLORS)]
order = sorted(range(GROUND_COLORS), key=lambda i: (sum(colors[i]), i))  # darkest first
rank = {old: new for new, old in enumerate(order)}
qpx = q.load()
cw, ch = q.size

ground = []
for j in range(rows_out):
    y0, y1 = int(j * ch / rows_out), max(int((j + 1) * ch / rows_out), int(j * ch / rows_out) + 1)
    row = ""
    for i in range(WIDTH):
        x0, x1 = int(i * cw / WIDTH), max(int((i + 1) * cw / WIDTH), int(i * cw / WIDTH) + 1)
        c = Counter(qpx[x, y] for x in range(x0, x1) for y in range(max(y0, ridge[x]), y1))
        if 2 * sum(c.values()) < (x1 - x0) * (y1 - y0):
            row += "."  # Mostly original sky: show the scene's sky band here.
            continue
        best = min(c.items(), key=lambda kv: (-kv[1], rank[kv[0]]))[0]
        row += str(rank[best])
    ground.append(row)

sky_rows = [["."] * WIDTH for _ in range(CLOUD_ROWS)]
for x0, y0, shape in CLOUDS:
    for dy, line in enumerate(shape):
        for dx, ch_ in enumerate(line):
            if ch_ != "." and x0 + dx < WIDTH:
                sky_rows[y0 + dy][x0 + dx] = ch_
rows = ["".join(r) for r in sky_rows] + ground

day = [colors[i] for i in order]
def shade(c, k, tint, t):
    return tuple(max(0, min(255, round(v * k * (1 - t) + tv * t))) for v, tv in zip(c, tint))
ramps = {
    "dawn": [shade(c, 0.9, (120, 60, 90), 0.12) for c in day],
    "day": day,
    "dusk": [shade(c, 0.72, (90, 40, 90), 0.2) for c in day],
    "night": [shade(c, 0.38, (20, 24, 60), 0.25) for c in day],
}

OUT_ART.write_text(
    "// OWNER ART + integrator clouds, generated from art/src/backdrop.jpg by\n"
    "//   bun run --filter @boss-rush/tools ground:import\n"
    "// Do not edit by hand. Width = logical canvas width; drawn against the bottom edge.\n"
    "// '.' = sky shows through; '0'-'9' = groundRamps[sky][n] (darkest first);\n"
    "// 'c' / 'C' = cloud / cloud shade from cloudRamps[sky].\n\n"
    "export const ground: readonly string[] = [\n"
    + "".join(f"  '{r}',\n" for r in rows)
    + "];\n"
)
fmt = lambda c: "[0x%02x, 0x%02x, 0x%02x]" % c
OUT_PAL.write_text(
    "// Ground colours per sky. GENERATED by `bun run --filter @boss-rush/tools ground:import`\n"
    "// from the owner's background; day is the picture's own colours, the others are shaded.\n"
    "// Do not edit by hand.\n"
    "import type { Rgb } from './palette';\n\n"
    "export const groundRamps = {\n"
    + "".join(f"  {k}: [{', '.join(fmt(c) for c in v)}],\n" for k, v in ramps.items())
    + "} as const satisfies Record<string, readonly Rgb[]>;\n"
)
print(f"ground: {len(rows)} rows ({CLOUD_ROWS} cloud rows + {len(ground)} ground rows), foothills at source row {top}")
