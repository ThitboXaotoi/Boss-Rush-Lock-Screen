"""Font import: the owner's Gemini sheet (art/src/font.png) -> packages/render/src/art/font.ts.

    bun run --filter @boss-rush/tools font:import

The sheet has three rows of orange glyphs on a dark background: A-M, N-Z, 0-9 (any size, JPEG or
PNG). Each glyph's own bounding box is fitted onto the 5 x 7 grid by sampling the middle of each
cell. OVERRIDES fixes glyphs the fit gets wrong (thin diagonals). Lowercase reuses the capitals
(all-caps display). PUNCTUATION is a simple stand-in set drawn by the integrator, to be replaced
if the owner makes a symbols sheet. Runs with the machine's Python + Pillow:
    uv run --no-project --python /usr/bin/python3 python font/convert.py
"""
from pathlib import Path
from statistics import median
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "art/src/font.png"
OUT = ROOT / "packages/render/src/art/font.ts"

ROW_CHARS = ("ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "0123456789")


def runs(flags, merge_gap=0):
    """Half-open runs of ink, including a run touching the edge of the sheet."""
    result = []
    start = None
    for i, on in enumerate([*flags, 0]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if result and start - result[-1][1] < merge_gap:
                result[-1] = (result[-1][0], i)
            else:
                result.append((start, i))
            start = None
    return result


def fit_glyph(mask, ncol):
    def middle(i, cell):
        lo = int((i + 0.2) * cell)
        return lo, max(lo + 1, int((i + 0.8) * cell))

    # Preserve the centre-cell sampling density of the owner's original sheet.
    stride = max(1, round(mask.height / 90))
    pixels = mask.load()
    rows = []
    for r in range(7):
        top, bottom = middle(r, mask.height / 7)
        row = "." * ((5 - ncol) // 2)
        for c in range(ncol):
            left, right = middle(c, mask.width / ncol)
            xs, ys = range(left, right, stride), range(top, bottom, stride)
            ink = sum(bool(pixels[x, y]) for y in ys for x in xs)
            row += "#" if 2 * ink > len(xs) * len(ys) else "."
        rows.append(row.ljust(5, "."))
    return rows


def read_sheet(image):
    red, _, blue = image.convert("RGB").split()
    mask = ImageChops.multiply(
        red.point(lambda r: 255 if r > 150 else 0),
        ImageChops.subtract(red, blue).point(lambda diff: 255 if diff > 80 else 0),
    )
    # The delivered sheet also has a small orange heading. Keep the three tall glyph bands.
    bands = sorted(runs(mask.getprojection()[1]), key=lambda span: span[1] - span[0], reverse=True)
    if len(bands) < len(ROW_CHARS):
        raise ValueError("Expected three orange glyph rows: A–M, N–Z and 0–9.")
    glyphs = {}
    for (top, bottom), chars in zip(sorted(bands[:len(ROW_CHARS)]), ROW_CHARS):
        band = mask.crop((0, top, mask.width, bottom))
        columns = runs(band.getprojection()[0], merge_gap=band.height / 20)
        columns = [(a, b) for a, b in columns if b - a > band.height / 32]
        if len(columns) != len(chars):
            raise ValueError(f"Expected {len(chars)} glyphs in {chars}, found {len(columns)}.")
        typical_width = median(b - a for a, b in columns)
        for (a, b), ch in zip(columns, chars):
            glyph = band.crop((a, 0, b, band.height))
            ncol = 3 if glyph.width < 0.85 * typical_width else 5
            glyphs[ch] = fit_glyph(glyph.crop(glyph.getbbox()), ncol)
    return glyphs

OVERRIDES = {
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", "#####"],
    "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
}

PUNCTUATION = {
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
    "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
    '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
    "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
    "$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
    "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", ".#.##", "#..##"],
    "&": [".##..", "#..#.", ".##..", ".#...", "#.#.#", "#..#.", ".##.#"],
    "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
    "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
    ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
    "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
    "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
    ",": [".....", ".....", ".....", ".....", "..#..", "..#..", ".#..."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
    ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
    "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
    ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
    ";": [".....", ".##..", ".##..", ".....", ".##..", "..#..", ".#..."],
    "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
    "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
    ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
    "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
    "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
    "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
    "\\": ["#....", "#....", ".#...", "..#..", "...#.", "....#", "....#"],
    "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
    "^": ["..#..", ".#.#.", "#...#", ".....", ".....", ".....", "....."],
    "_": [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
    "`": [".#...", "..#..", ".....", ".....", ".....", ".....", "....."],
    "{": ["...##", "..#..", "..#..", ".#...", "..#..", "..#..", "...##"],
    "|": ["..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "}": ["##...", "..#..", "..#..", "...#.", "..#..", "..#..", "##..."],
    "~": [".....", ".....", ".#...", "#.#.#", "...#.", ".....", "....."],
}

def key(ch):
    """A double-quoted TypeScript string literal for one character."""
    return '"' + ch.replace("\\", "\\\\").replace('"', '\\"') + '"'

if __name__ == "__main__":
    with Image.open(SRC) as image:
        res = read_sheet(image)
    res.update(OVERRIDES)
    for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        res[c.lower()] = res[c]
    res.update(PUNCTUATION)
    lines = [
        "// OWNER ART, generated from art/src/font.png by",
        "//   bun run --filter @boss-rush/tools font:import",
        "// Do not edit by hand; replace the sheet (or OVERRIDES / PUNCTUATION in packages/tools/font/convert.py)",
        "// and re-run. No agent edits this file. Format: each glyph is 7 rows of 5 characters, '#' = ink.",
        "",
        "export const glyphs: Record<string, readonly string[]> = {",
    ]
    for code in range(0x20, 0x7F):
        ch = chr(code)
        lines.append("  " + key(ch) + ": [" + ", ".join('"' + r + '"' for r in res[ch]) + "],")
    lines.append("};")
    OUT.write_text("\n".join(lines) + "\n")
    print(f"font: wrote {OUT.relative_to(ROOT)} (95 glyphs; A-Z and 0-9 from the sheet)")
