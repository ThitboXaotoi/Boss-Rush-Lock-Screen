"""Tiny 3D box-mannequin renderer for pose references (integrator, Nov 23).

A pose script builds boxes in 3D, then calls render(). Orthographic camera, slightly above
eye level; painter's order by box depth; flat shading with light from the upper left.
Units: figure height about 8 (feet at y=0). Axes: x to the picture's right, y up, z toward
the viewer. Same method as qsb_final_pose.py, which stays as it was.
"""

import math
import subprocess
from pathlib import Path

import numpy as np

CANVAS = 1024
MARGIN = 48  # empty border around the fitted group, in pixels
CAMERA_PITCH = 9.0  # degrees; camera slightly above eye level so tops of boxes show
LIGHT = np.array([-0.55, 0.65, 0.55])
OUTLINE = '#1c1c22'

# corner index = 4*xbit + 2*ybit + zbit
FACES = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]


def rot_y(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_x(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def box(x0, x1, y0, y1, z0, z1):
    return np.array(
        [[x, y, z] for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)], dtype=float
    )


def limb(p0, p1, w, d):
    """Box along p0 -> p1 with cross-section w (sideways) x d (front-back)."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    a = (p1 - p0) / np.linalg.norm(p1 - p0)
    side = np.cross(a, [0, 0, 1.0])
    if np.linalg.norm(side) < 1e-6:
        side = np.array([1.0, 0, 0])
    side /= np.linalg.norm(side)
    fwd = np.cross(side, a)
    return np.array(
        [p + side * w * sx + fwd * d * sz for sx in (-0.5, 0.5) for p in (p0, p1) for sz in (-0.5, 0.5)]
    )


def transform(parts, m=np.eye(3), offset=(0, 0, 0)):
    return [(c @ m.T + np.array(offset, float), col) for c, col in parts]


def _shade(colour, n, light):
    k = 0.5 + 0.5 * max(0.0, float(n @ light))
    return '#%02x%02x%02x' % tuple(min(255, int(c * k)) for c in colour)


def render(parts, out: Path, flat=()):
    """Write out.svg and out.png. Colours listed in `flat` are drawn unshaded (e.g. black)."""
    cam = rot_x(CAMERA_PITCH)
    light = LIGHT / np.linalg.norm(LIGHT)
    polys = []
    for corners, colour in parts:
        cc = corners @ cam.T
        centre = cc.mean(axis=0)
        bp = []
        for f in FACES:
            p = cc[list(f)]
            n = np.cross(p[1] - p[0], p[3] - p[0])
            nn = np.linalg.norm(n)
            if nn < 1e-9:
                continue
            n /= nn
            if float(n @ (p.mean(axis=0) - centre)) < 0:
                n = -n
            if n[2] <= 1e-6:
                continue
            fill = '#%02x%02x%02x' % colour if colour in flat else _shade(colour, n, light)
            bp.append(([(q[0], -q[1]) for q in p], fill))
        polys.append((centre[2], bp))
    polys.sort(key=lambda t: t[0])

    g = np.array([0, 0, 0.1]) @ cam.T
    gx, gy, grx, gry = g[0], -g[1], 1.9, 0.42
    xs = [x for _, bp in polys for pts, _ in bp for x, _ in pts] + [gx - grx, gx + grx]
    ys = [y for _, bp in polys for pts, _ in bp for _, y in pts] + [gy + gry]
    k = min((CANVAS - 2 * MARGIN) / (max(xs) - min(xs)), (CANVAS - 2 * MARGIN) / (max(ys) - min(ys)))
    dx = CANVAS / 2 - k * (min(xs) + max(xs)) / 2
    dy = CANVAS - MARGIN - k * max(ys)

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}">',
        f'<rect width="{CANVAS}" height="{CANVAS}" fill="#ffffff"/>',
        f'<ellipse cx="{k * gx + dx:.1f}" cy="{k * gy + dy:.1f}" rx="{k * grx:.1f}" '
        f'ry="{k * gry:.1f}" fill="#e4e4e8"/>',
    ]
    for _, bp in polys:
        for pts, fill in bp:
            d = ' '.join(f'{k * x + dx:.1f},{k * y + dy:.1f}' for x, y in pts)
            svg.append(
                f'<polygon points="{d}" fill="{fill}" stroke="{OUTLINE}" '
                'stroke-width="2.5" stroke-linejoin="round"/>'
            )
    svg.append('</svg>')
    out.with_suffix('.svg').write_text('\n'.join(svg) + '\n')
    subprocess.run(
        ['rsvg-convert', '-o', str(out.with_suffix('.png')), str(out.with_suffix('.svg'))],
        check=True,
    )
    print('wrote', out.with_suffix('.svg'), 'and', out.with_suffix('.png'))
