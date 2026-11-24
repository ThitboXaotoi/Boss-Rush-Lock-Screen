"""Pose reference for the final boss's Final form, the mirror (owner, Nov 23).

Hood down: the hero himself, the mirror image of the hero's own "ready" pose, facing the
hero at the picture's bottom-left. Wide stance, knees bent, leaning forward; sword low in
his LEFT hand (the picture's right), blade angled down-right like the hero's; other fist
up as a guard; ponytail and scarf tail blowing back to the upper right; red eyes. Not game art: picture 2 for an image model.

Run:  uv run --no-project --python /usr/bin/python3 python art/ref/mirror_pose.py
"""

from pathlib import Path

import numpy as np

from mannequin import box, limb, render, rot_x, rot_y, transform

BODY_YAW = 38.0  # turned toward the picture's LEFT
LEAN = 15.0  # upper body leaning forward into the stance
WAIST_Y = 3.6  # waist height in the crouch (standing: 4.5)
HEAD_PITCH = -4.0  # head up: he looks at the hero

HOODIE = (140, 143, 150)
INNER = (70, 72, 80)  # shirt showing through the open hoodie
TROUSERS = (86, 88, 95)
SHOES = (60, 60, 66)
SKIN = (222, 196, 170)
HAIR = (226, 228, 236)  # silver
RED = (200, 30, 40)
STEEL = (200, 206, 214)

# legs: wide stance, his right foot (picture's left) forward, knees bent
legs = [
    ((-0.4, 2.9, 0.0), (-1.15, 1.6, 0.85), (-1.3, 0.3, 0.75)),  # front leg
    ((0.4, 2.9, 0.0), (1.2, 1.55, -0.3), (1.55, 0.3, -0.75)),  # back leg
]
parts = []
for hip, knee, ankle in legs:
    parts.append((limb(hip, knee, 0.52, 0.56), TROUSERS))
    parts.append((limb(knee, ankle, 0.44, 0.48), TROUSERS))
    parts.append((box(ankle[0] - 0.2, ankle[0] + 0.2, 0, 0.3, ankle[2] - 0.24, ankle[2] + 0.8), SHOES))

upper = [  # built around the waist (y = 4.5), then leaned forward
    (box(-0.7, 0.7, 3.65, 4.5, -0.42, 0.42), HOODIE),  # hoodie hem over the hips
    (box(-0.62, 0.62, 4.5, 5.1, -0.38, 0.38), HOODIE),  # waist
    (box(-0.82, 0.82, 5.1, 6.45, -0.44, 0.44), HOODIE),  # chest
    (box(-0.2, 0.2, 4.0, 6.4, 0.42, 0.46), INNER),  # hoodie open at the front
    (box(-0.42, 0.42, 6.25, 6.6, -0.32, 0.36), RED),  # scarf around the neck
    (limb((0.3, 6.45, -0.3), (1.9, 6.9, -1.4), 0.3, 0.06), RED),  # scarf tail blowing back
    (box(-0.62, 0.62, 5.9, 6.5, -0.7, -0.42), HOODIE),  # hood fallen down on his back
]
# A true mirror of the hero's ready pose (owner, Nov 23): the hero holds his sword low in his
# right hand, blade angled down to the picture's right; his reflection holds it low in his
# LEFT hand (the picture's right), blade also angled down-right, so on the lock screen the
# two blades are parallel.
l_sh, l_el, l_hand = (0.95, 6.2, 0.0), (1.3, 5.1, 0.2), (1.3, 4.15, 0.55)
upper += [(limb(l_sh, l_el, 0.38, 0.4), HOODIE), (limb(l_el, l_hand, 0.32, 0.34), HOODIE)]
upper.append((box(1.15, 1.45, 3.95, 4.3, 0.42, 0.72), SKIN))  # sword hand
# his right arm (picture's left): guard up, fist forward at chest height
r_sh, r_el, r_hand = (-0.95, 6.2, 0.0), (-1.1, 5.35, 0.55), (-0.6, 5.7, 0.95)
upper += [(limb(r_sh, r_el, 0.38, 0.4), HOODIE), (limb(r_el, r_hand, 0.32, 0.34), HOODIE)]
upper.append((box(-0.75, -0.45, 5.55, 5.85, 0.85, 1.15), SKIN))  # fist

head = [  # origin at the top of the neck
    (box(-0.31, 0.31, 0.0, 0.86, -0.34, 0.34), SKIN),  # face and head
    (box(-0.36, 0.36, 0.62, 1.0, -0.4, 0.3), HAIR),  # silver hair on top
    (box(-0.36, 0.36, 0.2, 0.86, -0.42, -0.3), HAIR),  # hair at the back
    (box(-0.22, -0.08, 0.5, 0.58, 0.34, 0.37), RED),  # red eyes
    (box(0.08, 0.22, 0.5, 0.58, 0.34, 0.37), RED),
    (box(-0.1, 0.1, 0.85, 1.05, -0.3, -0.1), RED),  # hair tie
    (limb((0.0, 0.95, -0.25), (1.6, 1.4, -1.6), 0.26, 0.2), HAIR),  # ponytail blowing back
]
upper += transform(head, rot_x(HEAD_PITCH), (0, 6.55, 0.0))
upper = transform(transform(upper, offset=(0, -4.5, 0)), rot_x(LEAN), (0, WAIST_Y, 0))  # deep crouch
parts = transform(parts + upper, rot_y(-BODY_YAW))

# the sword, in picture space: from the sword hand, down and to the picture's right
hand = np.array([1.3, 4.12, 0.57]) - np.array([0, 4.5, 0])
hand = rot_y(-BODY_YAW) @ (rot_x(LEAN) @ hand + np.array([0, WAIST_Y, 0]))
blade_dir = np.array([0.62, -0.74, 0.25])
blade_dir /= np.linalg.norm(blade_dir)
parts.append((limb(hand - blade_dir * 0.05, hand + blade_dir * 0.05, 0.62, 0.1), STEEL))  # guard
parts.append((limb(hand + blade_dir * 0.05, hand + blade_dir * 3.3, 0.2, 0.06), STEEL))  # blade

render(parts, Path(__file__).with_suffix(''), flat=(RED,))
