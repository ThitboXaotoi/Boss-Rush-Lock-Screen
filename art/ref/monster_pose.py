"""Pose reference for the final boss's monster form (last 24 hours; owner, Nov 23).

He EXPLODES into the monster (owner): his body still hangs, limp, in the tentacles that
burst out of his arms and legs and wrap around him; he is lifted clear of the ground.
Where his head was, a black mass bursts out and towers over him. Three heads on long necks
lunge toward the picture's bottom-left (the hero) at different heights; two long, thin,
too-many-jointed pale arms reach out of the mass toward the hero; his split face at the
root of the mass; pale spines along its back.
Not game art: a layout picture for an image model.

Run:  uv run --no-project --python /usr/bin/python3 python -B art/ref/monster_pose.py
"""

from pathlib import Path

import numpy as np

from mannequin import box, limb, render, rot_x, rot_y, transform

BODY_YAW = 38.0  # turned toward the picture's LEFT
MASS = (64, 60, 74)  # black mass, drawn dark grey so the shapes read
TENT = (44, 41, 52)  # the tentacles: darker, so they read against the body and the mass
PALE = (226, 222, 214)  # the long arms, teeth
SPINE = (225, 226, 232)
RED = (220, 30, 40)
SKIN = (222, 196, 170)
COAT = (160, 166, 186)  # his coat: light, so the black tentacles binding him read clearly
STEEL = (200, 206, 214)

BODY_SCALE = 0.47  # he is small; the monster is about 3x his height
MONSTER_SCALE = 1.35  # bigger relative to him than the last sketch (owner, Nov 23)
LIFT = 1.80  # his feet hang this far above the ground
NECK = np.array([0.0, 6.85, 0.0])


def coil(p0, p1, radius, turns, w, phase=0.0, start=0.0, stop=1.0):
    """A helix of boxes around the segment p0 -> p1 (a tentacle wrapped around a limb)."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    axis = p1 - p0
    length = np.linalg.norm(axis)
    a = axis / length
    side = np.cross(a, [0, 0, 1.0])
    if np.linalg.norm(side) < 1e-6:
        side = np.array([1.0, 0, 0])
    side /= np.linalg.norm(side)
    fwd = np.cross(side, a)
    n = max(5, int(turns * 8))
    pts = []
    for i in range(n + 1):
        u = i / n
        t = start + (stop - start) * u
        ang = phase + 2 * np.pi * turns * u
        pts.append(p0 + axis * t + side * radius * np.cos(ang) + fwd * radius * np.sin(ang))
    return [(limb(a, b, w, w), TENT) for a, b in zip(pts, pts[1:])]


def burst(p, dirs, length=0.58, w=0.14):
    """Short tentacles exploding outward from a joint."""
    p = np.array(p, float)
    out = []
    for d in dirs:
        d = np.array(d, float)
        d /= np.linalg.norm(d)
        out.append((limb(p, p + d * length, w, w), TENT))
    return out


# ---- his body: limp, hanging, the head gone -----------------------------------------------
parts = []
for sx in (-1, 1):
    hip, knee, ankle = (0.36 * sx, 4.3, 0), (0.45 * sx, 2.3, 0.30), (0.55 * sx, 0.3, -0.10)
    parts.append((limb(hip, knee, 0.52, 0.56), COAT))
    parts.append((limb(knee, ankle, 0.44, 0.48), COAT))
    # the foot hangs toes-down, so the whole body reads as suspended
    parts.append((limb((0.55 * sx, 0.32, -0.15), (0.55 * sx, -0.02, 0.45), 0.40, 0.22), COAT))
parts += [
    (box(-0.7, 0.7, 4.2, 4.95, -0.4, 0.4), COAT),  # hips
    (box(-0.6, 0.6, 4.95, 5.55, -0.36, 0.36), COAT),  # waist
    (box(-0.82, 0.82, 5.55, 6.9, -0.42, 0.42), COAT),  # chest
]
for sx in (-1, 1):  # arms hanging limp, held a little away from the body
    parts.append((limb((0.92 * sx, 6.7, 0), (1.22 * sx, 5.5, 0.08), 0.36, 0.38), COAT))
    parts.append((limb((1.22 * sx, 5.5, 0.08), (1.30 * sx, 4.4, 0.18), 0.3, 0.32), COAT))
    parts.append((box(1.30 * sx - 0.15, 1.30 * sx + 0.15, 4.1, 4.4, 0.0, 0.3), SKIN))
parts.append((limb((1.3, 4.2, 0.2), (2.1, 0.05, 1.3), 0.2, 0.06), STEEL))  # sword hanging

# tentacles bursting out of his arms and legs, and coils binding him
for sx in (-1, 1):
    sh = (0.92 * sx, 6.7, 0)
    el = (1.22 * sx, 5.5, 0.08)
    wr = (1.30 * sx, 4.4, 0.18)
    hp = (0.36 * sx, 4.3, 0)
    kn = (0.45 * sx, 2.3, 0.30)
    an = (0.55 * sx, 0.3, -0.10)
    parts += coil(sh, el, 0.28, 0.6, 0.15, phase=0.35 * sx, start=0.22, stop=0.86)
    parts += coil(el, wr, 0.23, 0.6, 0.12, phase=1.2 * sx, start=0.18, stop=0.86)
    parts += coil(hp, kn, 0.34, 0.9, 0.16, phase=0.5 * sx, start=0.14, stop=0.88)
    parts += coil(kn, an, 0.30, 0.9, 0.14, phase=1.0 * sx, start=0.14, stop=0.88)
    parts += burst(sh, ((sx, 0.3, 0.5), (sx * 0.5, -0.3, -0.5)), 0.45, 0.13)
    parts += burst(wr, ((sx, 0.2, 0.5), (sx * 0.4, -0.3, -0.4)), 0.4, 0.11)
    parts += burst(hp, ((sx, 0.0, 0.5), (sx * 0.5, -0.3, -0.5)), 0.42, 0.12)
# a single band around his waist: bound, but his chest and arms stay readable
parts += coil((0, 4.6, 0), (0, 5.6, 0), 0.72, 1.0, 0.18, phase=0.4, start=0.0, stop=0.95)
body, parts = parts, []

# ---- the mass bursting out of where his head was ------------------------------------------
parts += [
    (box(-0.28, 0.28, 6.85, 7.6, -0.35, 0.4), SKIN),  # his split face at the root
    (box(-0.16, -0.05, 7.14, 7.22, 0.40, 0.44), RED),  # red eyes
    (box(0.05, 0.16, 7.14, 7.22, 0.40, 0.44), RED),
    (box(-0.6, 0.6, 7.3, 7.9, -0.5, 0.45), MASS),  # the burst through his face
    (box(-1.2, 1.2, 7.8, 8.8, -0.9, 0.6), MASS),  # widening above his shoulders
    (box(-2.4, 2.4, 8.6, 11.8, -1.7, 0.8), MASS),  # the towering mass, right above him
    (box(-1.8, 1.8, 11.6, 12.6, -1.4, 0.4), MASS),  # its hump
]
for i in range(8):  # pale spines along its back (his silver hair)
    z = 0.2 - i * 0.22
    y = 12.6 - abs(i - 2) * 0.15
    parts.append((limb((0.0, y - 0.2, z), (0.0, y + 1.0 - 0.07 * i, z - 0.5), 0.16, 0.16), SPINE))


def head(scale=1.0):
    """A heavy head with a too-wide human grin full of teeth and clusters of red eyes."""
    h = [
        (box(-0.8, 0.8, -0.1, 1.0, 0.0, 2.2), MASS),  # skull
        (box(-0.75, 0.75, -1.0, -0.7, 0.1, 2.0), MASS),  # lower jaw
        (box(-0.78, 0.78, -0.7, -0.1, 0.3, 2.2), RED),  # the grin
    ]
    for i in range(6):  # rows of human teeth, upper and lower
        x = -0.65 + i * 0.26
        h.append((box(x, x + 0.18, -0.3, -0.1, 2.15, 2.25), PALE))
        h.append((box(x, x + 0.18, -0.7, -0.5, 1.95, 2.05), PALE))
    for x, y in ((-0.55, 0.7), (-0.32, 0.52), (0.32, 0.52), (0.55, 0.7), (-0.45, 0.3), (0.45, 0.3)):
        h.append((box(x - 0.07, x + 0.07, y - 0.05, y + 0.05, 2.2, 2.25), RED))
    return [(c * scale, col) for c, col in h]


NECKS = [  # (neck start, head base, head pitch, head turn, head scale)
    ((0.0, 9.0, 0.3), (-0.45, 7.6, 2.8), 20.0, 0.0, 1.0),  # centre: low, straight at the hero
    ((-1.4, 11.2, 0.0), (-3.0, 12.4, 1.4), -4.0, 18.0, 0.95),  # picture's left: high
    ((1.4, 10.8, -0.2), (3.6, 10.4, 0.4), 6.0, 12.0, 0.9),  # picture's right: swung out
]
for start, end, pitch, turn, sc in NECKS:
    parts.append((limb(start, end, 0.95 * sc, 0.9 * sc), MASS))
    parts += transform(head(sc), rot_y(turn) @ rot_x(pitch), end)

# thick tendrils from the mass down to the ground. Only the two front ones: the body hangs
# between them, clear of them (old coordinates: y = 3.15 is the ground)
for top, foot in (((-2.0, 8.8, 0.5), (-2.7, 3.15, 1.7)), ((2.0, 8.8, 0.5), (2.9, 3.15, 1.3))):
    parts.append((limb(top, foot, 0.62, 0.62), MASS))

# two long, thin, too-many-jointed pale arms reaching toward the hero
ARMS = [
    [(-2.2, 9.6, 0.3), (-3.9, 9.0, 1.4), (-4.6, 7.4, 2.4), (-4.2, 5.9, 3.4)],
    [(2.2, 9.2, 0.3), (4.0, 8.4, 0.9), (4.7, 6.8, 1.7), (4.3, 5.5, 2.6)],
]
for joints in ARMS:
    for a, b in zip(joints, joints[1:]):
        parts.append((limb(a, b, 0.2, 0.2), PALE))
    hx, hy, hz = joints[-1]
    for f in (-0.18, -0.06, 0.06, 0.18):  # long fingers
        parts.append((limb((hx + f, hy, hz), (hx + f * 2.2, hy - 0.9, hz + 0.5), 0.06, 0.06), PALE))

# ---- scale, lift, and the tentacles that hold him up and hang below his feet --------------
body = [(c * BODY_SCALE + np.array([0, LIFT, 0]), col) for c, col in body]
monster = [((c - NECK) * MONSTER_SCALE + NECK * BODY_SCALE + np.array([0, LIFT, 0]), col)
           for c, col in parts]


def bw(p):
    """A point in his body space -> the layout's world space."""
    return np.array(p, float) * BODY_SCALE + np.array([0, LIFT, 0])


parts_out = body + monster


def chain(points, w):
    for a, b in zip(points, points[1:]):
        parts_out.append((limb(a, b, w, w), TENT))


for sx in (-1, 1):
    sh = bw((0.92 * sx, 6.7, 0))
    hip = bw((0.36 * sx, 4.3, 0))
    # lifted by the mass: taut tentacles from the shoulders and hips up into the black mass
    chain([sh, (0.55 * sx, 5.10, -0.30), (0.25 * sx, 6.20, -0.20), (0.05 * sx, 7.30, 0.0)], 0.17)
    # one holding tentacle on each side, in front of the body so the suspension reads
    chain([hip, (0.70 * sx, 4.00, 0.30), (0.45 * sx, 5.10, 0.35), (0.15 * sx, 6.00, 0.10)], 0.15)

# Sizes (owner, Nov 23): the monster is bigger relative to him than the last sketch; he hangs
# off the ground, bound by tentacles bursting from his limbs.
parts = transform(parts_out, rot_y(-BODY_YAW))
render(parts, Path(__file__).with_suffix(''), flat=(RED,))
