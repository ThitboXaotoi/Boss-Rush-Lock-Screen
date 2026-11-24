"""Box-mannequin pose reference for MATH's Final (owner request, Nov 23).

A huge horned demon, body and head turned toward the picture's bottom-left (the hero),
both arms raised holding two greatswords angled inward with a small gap between the tips
(they never touch or cross). Horns on the head, a tail sweeping to the picture's right.
Built as 3D boxes, rotated, then projected orthographically, so the three-quarter angle is
geometrically consistent. Not game art: a reference picture for an image model.

Units: feet at y=0. Axes: x to the picture's right, y up, z toward the viewer.
Angles in degrees.

Run:  uv run --no-project --python /usr/bin/python3 python art/ref/math_final_pose.py
Out:  art/ref/math_final_pose.svg and .png (PNG via rsvg-convert)
"""

import math
import subprocess
from pathlib import Path

import numpy as np

# ---- parameters (all in one place) -------------------------------------------------------
BODY_YAW = 46.0  # body turned toward the picture's LEFT (facing the bottom-left corner)
HEAD_YAW_EXTRA = 6.0  # head turns a little further than the body
HEAD_PITCH = 18.0  # head tipped down: eyes look at the bottom-left corner
CAMERA_PITCH = 9.0  # camera slightly above eye level, so tops of boxes show
CANVAS = 1024
SCALE = 78.0  # pixels per unit (rough; the fit recomputes it)
GROUND_Y_PX = 980  # where y=0 lands on the canvas (before fitting)
MARGIN = 46  # empty border around the fitted group, in pixels
LIGHT = np.array([-0.55, 0.65, 0.55])  # from the upper left, in front

COL_BODY = (196, 198, 204)
COL_HEAD = (214, 206, 198)
COL_HORN = (158, 154, 162)
COL_DARK = (40, 40, 48)
COL_BLADE = (198, 202, 212)
COL_STEEL = (112, 116, 126)
COL_TAIL = (170, 168, 176)
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


def _frame(p0, p1):
    p0, p1 = np.array(p0, float), np.array(p1, float)
    a = p1 - p0
    a /= np.linalg.norm(a)
    side = np.cross(a, [0, 0, 1.0])
    if np.linalg.norm(side) < 1e-6:
        side = np.array([1.0, 0, 0])
    side /= np.linalg.norm(side)
    fwd = np.cross(side, a)
    return p0, p1, side, fwd


def limb(p0, p1, w, d):
    """Box along the segment p0 -> p1 with cross-section w (sideways) x d (front-back)."""
    p0, p1, side, fwd = _frame(p0, p1)
    pts = []
    for sx in (-0.5, 0.5):
        for p in (p0, p1):
            for sz in (-0.5, 0.5):
                pts.append(p + side * w * sx + fwd * d * sz)
    return np.array(pts)


def taper(p0, p1, w0, d0, w1, d1):
    """Box along p0 -> p1, cross-section (w0, d0) at p0 tapering to (w1, d1) at p1."""
    p0, p1, side, fwd = _frame(p0, p1)
    pts = []
    for sx in (-0.5, 0.5):
        for p, w, d in ((p0, w0, d0), (p1, w1, d1)):
            for sz in (-0.5, 0.5):
                pts.append(p + side * w * sx + fwd * d * sz)
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


# legs: hip joints -> knees -> ankles; wide, planted, slightly bowed stance
for sx, ankle_z in ((-1, -0.10), (1, 0.16)):
    hip = (0.50 * sx, 3.90, 0.0)
    knee = (0.84 * sx, 1.98, 0.08 + ankle_z * 0.4)
    ankle = (0.98 * sx, 0.34, ankle_z)
    badd(taper(hip, knee, 0.86, 0.90, 0.66, 0.72), COL_BODY)  # thigh
    badd(taper(knee, ankle, 0.66, 0.70, 0.48, 0.54), COL_BODY)  # shin
    badd(
        aabb(0.98 * sx - 0.34, 0.98 * sx + 0.34, 0.0, 0.30,
             ankle_z - 0.35, ankle_z + 1.04),
        COL_BODY,
    )  # foot, toes forward

badd(aabb(-0.84, 0.84, 3.72, 4.52, -0.48, 0.48), COL_BODY)  # pelvis
badd(taper((0, 4.46, 0), (0, 5.26, 0), 1.38, 0.82, 1.60, 0.96), COL_BODY)  # abdomen
badd(taper((0, 5.26, 0), (0, 6.74, 0), 1.80, 0.98, 2.60, 1.12), COL_BODY)  # broad chest
badd(aabb(-0.18, 0.18, 6.74, 7.02, -0.18, 0.18), COL_BODY)  # neck

# arms: shoulders -> elbows (out and forward) -> fists raised
FAR_GRIP = np.array([-4.85, 7.40, 0.10])
NEAR_GRIP = np.array([4.85, 7.40, 0.46])
for sx, grip in ((-1, FAR_GRIP), (1, NEAR_GRIP)):
    sh = np.array([1.30 * sx, 6.55, -0.02 + 0.14 * (sx + 1) / 2])
    el = np.array([3.55 * sx, 6.02, 0.04 + 0.38 * (sx + 1) / 2])
    badd(taper(sh, el, 0.56, 0.60, 0.42, 0.46), COL_BODY)  # upper arm
    badd(taper(el, grip, 0.42, 0.46, 0.32, 0.36), COL_BODY)  # forearm
    badd(
        aabb(grip[0] - 0.27, grip[0] + 0.27, grip[1] - 0.27, grip[1] + 0.27,
             grip[2] - 0.21, grip[2] + 0.21),
        COL_BODY,
    )  # fist around the hilt

# the two greatswords: one long flat box each, larger than before, raised and angled
# inward with a small gap between the tips (they never touch or cross)
BLADE_Z = 0.18
GRIPS = ((-1, FAR_GRIP, np.array([0.640, 0.768, 0.0])),
         (1, NEAR_GRIP, np.array([-0.640, 0.768, 0.0])))
BLADE_LEN = 7.05
for _sx, grip, direction in GRIPS:
    d = direction / np.linalg.norm(direction)
    perp = np.array([d[1], -d[0], 0.0])  # crossguard, perpendicular in the picture plane
    grip = np.array([grip[0], grip[1], BLADE_Z])
    tip = grip + d * BLADE_LEN
    pommel = grip - d * 0.95
    # hilt below the fist and the pommel knob
    badd(limb(pommel, grip, 0.19, 0.19), COL_STEEL)
    badd(aabb(pommel[0] - 0.13, pommel[0] + 0.13, pommel[1] - 0.13,
              pommel[1] + 0.13, pommel[2] - 0.13, pommel[2] + 0.13), COL_STEEL)
    # crossguard, then the long wide blade with a tapered point
    badd(limb(grip - perp * 0.76, grip + perp * 0.76, 0.16, 0.16), COL_STEEL)
    blade_start = grip + d * 0.16
    blade_stop = tip - d * 0.72
    badd(limb(blade_start, blade_stop, 0.56, 0.16), COL_BLADE)
    badd(taper(blade_stop, tip, 0.56, 0.16, 0.04, 0.04), COL_BLADE)

# head, in head space (origin at the top of the neck), pitched down, then turned
head = [
    (aabb(-0.38, 0.38, 0.0, 0.94, -0.40, 0.40), COL_HEAD),  # skull
    (aabb(-0.35, 0.35, 0.62, 0.73, 0.40, 0.50), COL_HEAD),  # brow ridge
    (aabb(-0.30, 0.30, 0.52, 0.61, 0.39, 0.44), COL_DARK),  # eye band
    (aabb(-0.08, 0.08, 0.24, 0.48, 0.40, 0.62), COL_HEAD),  # long nose
    (aabb(-0.24, 0.24, -0.05, 0.12, 0.31, 0.48), COL_HEAD),  # jaw
]
for sx in (-1, 1):  # three-segment horns, thick, sweeping out then curling up
    horn0 = np.array([0.26 * sx, 0.74, -0.02])
    horn1 = np.array([0.64 * sx, 1.04, -0.20])
    horn2 = np.array([0.96 * sx, 1.40, -0.32])
    horn3 = np.array([1.00 * sx, 1.72, -0.14])
    head.append((taper(horn0, horn1, 0.32, 0.32, 0.23, 0.23), COL_HORN))
    head.append((taper(horn1, horn2, 0.23, 0.23, 0.14, 0.14), COL_HORN))
    head.append((taper(horn2, horn3, 0.14, 0.14, 0.04, 0.04), COL_HORN))

head_rot = rot_y(-HEAD_YAW_EXTRA) @ rot_x(HEAD_PITCH)
for c, col in head:
    badd(c @ head_rot.T + np.array([0, 7.02, 0]), col)

# tail: from behind the hips, sweeping out to the picture's right, tip curling up
TAIL = [
    ((0.00, 3.74, -0.55), (0.85, 3.25, -1.20), 0.54, 0.46, 0.44, 0.38),
    ((0.85, 3.25, -1.20), (1.85, 2.80, -1.65), 0.44, 0.38, 0.34, 0.30),
    ((1.85, 2.80, -1.65), (2.80, 2.15, -1.55), 0.34, 0.30, 0.24, 0.22),
    ((2.80, 2.15, -1.55), (3.45, 1.50, -1.20), 0.24, 0.22, 0.16, 0.15),
    ((3.45, 1.50, -1.20), (3.55, 2.25, -1.00), 0.16, 0.15, 0.03, 0.03),
]
for p0, p1, w0, d0, w1, d1 in TAIL:
    badd(taper(p0, p1, w0, d0, w1, d1), COL_TAIL)

yaw = rot_y(-BODY_YAW)  # negative: the front turns toward the picture's left
for c, col in body:
    add(c, col, local=yaw)

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

# ground shadow under the feet, the tail and the swords
gx, gy = to_px(np.array([0.9, 0, 0.10]) @ cam.T)
grx, gry = 3.8 * SCALE, 0.58 * SCALE

# fit the whole group (figure and shadow) into the square: centred, feet near the bottom
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
