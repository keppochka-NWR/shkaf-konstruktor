# -*- coding: utf-8 -*-
# Cross-sections of the sliding door profiles (mm). Shared by blender_kupe_profiles.py (3D models) and draw_kupe_sections.py (drawings).
# a: across (0 = outer edge of the leaf / frame), b: depth (0 = back, max = front facing the room). Tracks and frames: a = height, b = depth.
#
# FACTORY (exact): contours extracted from the vector PDF «СХЕМЫ СБОРКИ СИСТЕМ ARISTO»
#   (grouppartner.ru/upload/catalogs/ARISTO-Systems-Drawing.pdf) by extract_aristo_sections.py, scaled by the drawing dimensions.
#   handle_c (профиль С, 26), handle_h (профиль Н, 35,2), frame_top, frame_bottom (56), track_top (40), track_bottom (8).
# APPROX (no drawing found yet): handle_i, handle_slim, divider — simplified shapes, marked as such in the drawings and the studio.
import json, math, os

FACTORY = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "aristo_sections.json"), encoding="utf-8"))
FACTORY_NAMES = ("handle_c", "handle_h", "frame_top", "frame_bottom", "track_top", "track_bottom")


def rect(a0, b0, a1, b1):
    return [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]


def slot(a0, a1, mid, panel=10.0, wall=1.4):
    """Two flanges that hold a panel of given thickness, centred on depth mid."""
    return [rect(a0, mid + panel / 2, a1, mid + panel / 2 + wall), rect(a0, mid - panel / 2 - wall, a1, mid - panel / 2)]


# Approximate shapes: list of polygons to be united (overlapping solids).
SHAPES = {
    # Standard I / Flat: flat face, I-section, panel slot toward the insert. APPROX.
    "handle_i": lambda w=30.0, d=26.0: [
        rect(0, d - 1.8, w, d), rect(0, 0, 14, 1.6), rect(2.4, 0, 4.0, d), rect(12.4, 0, 14, d),
        *slot(14, w, d / 2), rect(14, d / 2 - 6.4, 15.6, d / 2 + 6.4),
    ],
    # Slim / GRACE / NOVA: narrow 12 mm face, small rectangular tube with a slot. APPROX.
    "handle_slim": lambda w=12.0, d=22.0: [
        rect(0, d - 1.4, w, d), rect(0, 0, 1.4, d), rect(0, 0, 5.5, 1.4), rect(4.2, 1.4, 5.5, d - 1.4),
        *slot(5.5, w, d / 2, wall=1.2), rect(5.5, d / 2 - 6.2, 6.8, d / 2 + 6.2),
    ],
    # Divider between inserts: H-section with a slot on each side. APPROX (middle frame is not drawn in the PDF).
    "divider": lambda h=20.0, d=14.0: [
        rect(0, d / 2 + 5, h, d / 2 + 6.4), rect(0, d / 2 - 6.4, h, d / 2 - 5), rect(h / 2 - 0.8, d / 2 - 6.4, h / 2 + 0.8, d / 2 + 6.4),
    ],
}


def loops(name):
    """Factory shapes: closed loops (outer + holes). Approx shapes: None (use SHAPES polygons)."""
    return FACTORY[name]["loops"] if name in FACTORY_NAMES else None
