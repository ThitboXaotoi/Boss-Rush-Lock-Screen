"""Pose reference for the final boss, hooded forms (Light and Dark). Owner, Nov 23.

Standing still, a little hunched, body and head turned toward the picture's bottom-left
(the hero); both hands hidden in the hoodie's front pocket; the hood's opening is pure
black; a few pixels of red scarf at the collar. Not game art: picture 2 for an image model.

Run:  uv run --no-project --python /usr/bin/python3 python art/ref/hood_pose.py
"""

from pathlib import Path

from mannequin import box, limb, render, rot_x, rot_y, transform

BODY_YAW = 38.0  # turned toward the picture's LEFT
HUNCH = 6.0  # upper body tipped forward
HEAD_PITCH = 10.0  # head a little down

HOODIE = (140, 143, 150)
TROUSERS = (86, 88, 95)
SHOES = (60, 60, 66)
VOID = (8, 8, 10)
RED = (200, 30, 40)

body = []
for sx in (-1, 1):  # legs, a little apart, straight
    hip, knee, ankle = (0.34 * sx, 4.3, 0), (0.4 * sx, 2.3, 0.04), (0.46 * sx, 0.3, 0)
    body.append((limb(hip, knee, 0.52, 0.56), TROUSERS))
    body.append((limb(knee, ankle, 0.44, 0.48), TROUSERS))
    body.append((box(ankle[0] - 0.2, ankle[0] + 0.2, 0, 0.3, -0.24, 0.8), SHOES))

upper = [  # built around the waist, then hunched forward
    (box(-0.7, 0.7, 4.15, 5.0, -0.42, 0.42), HOODIE),  # hoodie hem over the hips
    (box(-0.62, 0.62, 5.0, 5.6, -0.38, 0.38), HOODIE),  # waist
    (box(-0.82, 0.82, 5.6, 6.95, -0.44, 0.44), HOODIE),  # chest
    (box(-0.5, 0.5, 4.55, 5.25, 0.38, 0.5), HOODIE),  # front pocket (hands hidden inside)
    (box(-0.12, 0.12, 6.86, 6.96, 0.36, 0.46), RED),  # a few red pixels: scarf at the collar
]
for sx in (-1, 1):  # arms: down, then forward into the front pocket
    sh, el, wr = (0.95 * sx, 6.7, 0), (1.0 * sx, 5.55, 0.12), (0.38 * sx, 4.95, 0.46)
    upper.append((limb(sh, el, 0.38, 0.4), HOODIE))
    upper.append((limb(el, wr, 0.32, 0.34), HOODIE))

head = [  # hood around the head, the opening pure black; origin at the top of the neck
    (box(-0.44, 0.44, -0.05, 1.0, -0.5, 0.4), HOODIE),
    (box(-0.3, 0.3, 0.12, 0.8, 0.4, 0.43), VOID),  # the hood's opening: no face at all
    (box(-0.3, 0.3, -0.2, 0.2, -0.7, -0.35), HOODIE),  # hood drape at the back of the neck
]
upper += transform(head, rot_x(HEAD_PITCH), (0, 6.98, 0.05))
upper = transform(transform(upper, offset=(0, -5.0, 0)), rot_x(HUNCH), (0, 5.0, 0))
parts = transform(body + upper, rot_y(-BODY_YAW))

render(parts, Path(__file__).with_suffix(''), flat=(VOID, RED))
