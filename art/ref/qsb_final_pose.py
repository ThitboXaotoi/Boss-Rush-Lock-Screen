"""Box-mannequin pose reference for QSB's Final (owner request, Nov 23).

Standing, body and head turned toward the picture's bottom-left (the hero), both hands
stacked on the glass X at the top of a vertical cane, the armchair behind him turned the
same way as his body. Built as 3D boxes, rotated, then projected orthographically, so the three-quarter
angle is geometrically consistent. Not game art: a reference picture for an image model.

Units: figure height 8 (feet at y=0). Axes: x to the picture's right, y up, z toward the
viewer. Angles in degrees.

Run:  uv run --no-project --python /usr/bin/python3 python art/ref/qsb_final_pose.py
Out:  art/ref/qsb_final_pose.svg and .png (PNG via rsvg-convert)
"""

import math
import subprocess
from pathlib import Path

import numpy as np

# ---- parameters (all in one place) -------------------------------------------------------
BODY_YAW = 38.0  # body turned toward the picture's LEFT (facing the bottom-left corner)
HEAD_YAW_EXTRA = 6.0  # head turns a little further than the body
HEAD_PITCH = 14.0  # head tipped down: eyes look at the bottom-left corner
CAMERA_PITCH = 9.0  # camera slightly above eye level, so tops of boxes show
CANVAS = 1024
SCALE = 104.0  # pixels per unit
GROUND_Y_PX = 968  # where y=0 lands on the canvas (before fitting)
MARGIN = 48  # empty border around the fitted group, in pixels
LIGHT = np.array([-0.55, 0.65, 0.55])  # from the upper left, in front

COL_BODY = (196, 198, 204)
COL_HEAD = (214, 206, 198)
COL_DARK = (40, 40, 48)
COL_CANE = (150, 154, 162)
COL_X = (210, 30, 120)
COL_CHAIR = (92, 66, 52)
OUTLINE = '#1c1c22'
OUT = Path(__file__).with_suffix('')


def rot_y(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_x(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def aabb(x0, x1, y0, y1, z0, z1):
    return np.array(
        [[x, y, z] for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)], dtype=float
    )


def limb(p0, p1, w, d):
    """Box along the segment p0 -> p1 with cross-section w (sideways) x d (front-back)."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    a = p1 - p0
    a /= np.linalg.norm(a)
    side = np.cross(a, [0, 0, 1.0])
    if np.linalg.norm(side) < 1e-6:
        side = np.array([1.0, 0, 0])
    side /= np.linalg.norm(side)
    fwd = np.cross(side, a)
    pts = []
    for sx in (-0.5, 0.5):
        for p in (p0, p1):
            for sz in (-0.5, 0.5):
                pts.append(p + side * w * sx + fwd * d * sz)
    # reorder to the aabb corner order: x-bit, y-bit, z-bit -> side, along, front
    return np.array(pts)


# corner index = 4*xbit + 2*ybit + zbit ; faces as corner loops with outward order
FACES = [
    (0, 1, 3, 2),  # x-
    (4, 6, 7, 5),  # x+
    (0, 4, 5, 1),  # y-
    (2, 3, 7, 6),  # y+
    (0, 2, 6, 4),  # z-
    (1, 5, 7, 3),  # z+
]

parts = []  # (corners in world space, colour)


def add(corners, colour, local=np.eye(3), offset=(0, 0, 0)):
    parts.append((corners @ local.T + np.array(offset, float), colour))


# ---- the figure, in body space (facing +z), then turned by BODY_YAW ----------------------
body = []


def badd(corners, colour):
    body.append((corners, colour))


# legs: hip joints -> knees -> ankles; stance a little wider than the hips
for sx in (-1, 1):
    hip = (0.36 * sx, 4.35, 0.0)
    knee = (0.47 * sx, 2.3, 0.06)
    ankle = (0.58 * sx, 0.32, 0.0)
    badd(limb(hip, knee, 0.52, 0.58), COL_BODY)
    badd(limb(knee, ankle, 0.42, 0.46), COL_BODY)
    badd(aabb(ankle[0] - 0.2, ankle[0] + 0.2, 0.0, 0.3, -0.24, 0.86), COL_BODY)  # foot, toes forward

badd(aabb(-0.68, 0.68, 4.2, 4.95, -0.4, 0.4), COL_BODY)  # pelvis
badd(aabb(-0.56, 0.56, 4.95, 5.55, -0.34, 0.34), COL_BODY)  # waist
badd(aabb(-0.8, 0.8, 5.55, 6.95, -0.42, 0.42), COL_BODY)  # chest
badd(aabb(-0.14, 0.14, 6.95, 7.2, -0.14, 0.14), COL_BODY)  # neck

# cane: vertical, in front of him; glass X at the top, hands stacked on it
CANE_Z = 0.98
badd(aabb(-0.045, 0.045, 0.0, 4.42, CANE_Z - 0.045, CANE_Z + 0.045), COL_CANE)
for sgn in (-1, 1):  # the X: two crossed slim bars
    badd(limb((-0.2 * sgn, 4.38, CANE_Z), (0.2 * sgn, 4.82, CANE_Z), 0.1, 0.1), COL_X)
badd(aabb(-0.22, 0.22, 4.82, 4.99, CANE_Z - 0.18, CANE_Z + 0.16), COL_BODY)  # lower hand
badd(aabb(-0.22, 0.22, 4.99, 5.16, CANE_Z - 0.16, CANE_Z + 0.18), COL_BODY)  # upper hand

# arms: shoulders -> elbows (out and slightly back) -> wrists at the hands
for sx, wrist_y in ((-1, 4.92), (1, 5.08)):
    sh = (0.92 * sx, 6.72, 0.0)
    el = (1.02 * sx, 5.62, 0.18)
    wr = (0.2 * sx, wrist_y, CANE_Z - 0.08)
    badd(limb(sh, el, 0.36, 0.38), COL_BODY)
    badd(limb(el, wr, 0.3, 0.32), COL_BODY)

# head, in head space (origin at the top of the neck), pitched down, then turned
head = [
    (aabb(-0.31, 0.31, 0.0, 0.86, -0.34, 0.34), COL_HEAD),
    (aabb(-0.055, 0.055, 0.3, 0.52, 0.34, 0.47), COL_HEAD),  # nose
    (aabb(-0.25, 0.25, 0.5, 0.58, 0.34, 0.36), COL_DARK),  # eye band
]
head_rot = rot_y(-HEAD_YAW_EXTRA) @ rot_x(HEAD_PITCH)
for c, col in head:
    badd(c @ head_rot.T + np.array([0, 7.12, 0]), col)

yaw = rot_y(-BODY_YAW)  # negative: the front turns toward the picture's left
for c, col in body:
    add(c, col, local=yaw)

# ---- the armchair: behind him, turned the same way as his body (owner, Nov 23) ----------
CZ0, CZ1 = -2.05, -0.62  # back to front
for x0, x1 in ((-1.45, -1.25), (1.25, 1.45)):
    for z0, z1 in ((CZ0, CZ0 + 0.2), (CZ1 - 0.2, CZ1)):
        add(aabb(x0, x1, 0.0, 1.6, z0, z1), COL_CHAIR, local=yaw)  # legs
add(aabb(-1.45, 1.45, 1.6, 2.1, CZ0, CZ1), COL_CHAIR, local=yaw)  # seat
add(aabb(-1.45, 1.45, 2.1, 6.75, CZ0, CZ0 + 0.38), COL_CHAIR, local=yaw)  # tall back
add(aabb(-1.45, -1.12, 2.1, 3.1, CZ0, CZ1), COL_CHAIR, local=yaw)  # armrests
add(aabb(1.12, 1.45, 2.1, 3.1, CZ0, CZ1), COL_CHAIR, local=yaw)

# ---- project and draw (painter's order by box depth) ------------------------------------
cam = rot_x(CAMERA_PITCH)
light = LIGHT / np.linalg.norm(LIGHT)


def to_px(p):
    return (CANVAS / 2 + p[0] * SCALE, GROUND_Y_PX - p[1] * SCALE)


def shade(colour, n):
    k = 0.5 + 0.5 * max(0.0, float(n @ light))
    return '#%02x%02x%02x' % tuple(min(255, int(c * k)) for c in colour)


polys = []
for corners, colour in parts:
    cc = corners @ cam.T
    centre = cc.mean(axis=0)
    box_polys = []
    for f in FACES:
        p = cc[list(f)]
        n = np.cross(p[1] - p[0], p[3] - p[0])
        nn = np.linalg.norm(n)
        if nn < 1e-9:
            continue
        n /= nn
        if float(n @ (p.mean(axis=0) - centre)) < 0:  # make the normal point outward
            n = -n
        if n[2] <= 1e-6:  # facing away from the camera
            continue
        box_polys.append(([to_px(q) for q in p], shade(colour, n)))
    polys.append((centre[2], box_polys))
polys.sort(key=lambda t: t[0])

# ground shadow under the feet and the cane
gx, gy = to_px(np.array([0, 0, 0.15]) @ cam.T)
grx, gry = 1.9 * SCALE, 0.42 * SCALE

# fit the whole group (figure, chair, shadow) into the square: centred, feet near the bottom
xs = [x for _, bp in polys for pts, _ in bp for x, _ in pts] + [gx - grx, gx + grx]
ys = [y for _, bp in polys for pts, _ in bp for _, y in pts] + [gy + gry]
k = min((CANVAS - 2 * MARGIN) / (max(xs) - min(xs)), (CANVAS - 2 * MARGIN) / (max(ys) - min(ys)))
dx = CANVAS / 2 - k * (min(xs) + max(xs)) / 2
dy = CANVAS - MARGIN - k * max(ys)


def fit(x, y):
    return (k * x + dx, k * y + dy)


polys = [(z, [([fit(x, y) for x, y in pts], fill) for pts, fill in bp]) for z, bp in polys]
gx, gy = fit(gx, gy)
grx, gry = k * grx, k * gry

svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
    f'viewBox="0 0 {CANVAS} {CANVAS}">',
    f'<rect width="{CANVAS}" height="{CANVAS}" fill="#ffffff"/>',
    f'<ellipse cx="{gx:.1f}" cy="{gy:.1f}" rx="{grx:.1f}" ry="{gry:.1f}" fill="#e4e4e8"/>',
]
for _, box_polys in polys:
    for pts, fill in box_polys:
        d = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
        svg.append(
            f'<polygon points="{d}" fill="{fill}" stroke="{OUTLINE}" '
            'stroke-width="2.5" stroke-linejoin="round"/>'
        )
svg.append('</svg>')

OUT.with_suffix('.svg').write_text('\n'.join(svg) + '\n')
subprocess.run(
    ['rsvg-convert', '-o', str(OUT.with_suffix('.png')), str(OUT.with_suffix('.svg'))],
    check=True,
)
print('wrote', OUT.with_suffix('.svg'), 'and', OUT.with_suffix('.png'))
