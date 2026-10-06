# -*- coding: utf-8 -*-
# Cross-sections of the sliding door profiles (mm). Shared by blender_kupe_profiles.py (3D models) and draw_kupe_sections.py (drawings).
# a: across (0 = outer edge of the leaf / frame), b: depth (0 = back, max = front facing the room). Tracks: a = height, b = depth.
# These are simplified shapes drawn from the catalogue illustrations, NOT factory drawings (Aristo catalogues have no dimensioned sections).
import math

def rect(a0, b0, a1, b1):
    return [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]


def arc_band(ca, cb, r_out, r_in, d0, d1, n=28):
    """Curved wall: outer arc from d0 to d1 degrees, then inner arc back."""
    outer = [(ca + r_out * math.cos(math.radians(d0 + (d1 - d0) * i / n)), cb + r_out * math.sin(math.radians(d0 + (d1 - d0) * i / n))) for i in range(n + 1)]
    inner = [(ca + r_in * math.cos(math.radians(d1 - (d1 - d0) * i / n)), cb + r_in * math.sin(math.radians(d1 - (d1 - d0) * i / n))) for i in range(n + 1)]
    return outer + inner


def slot(a0, a1, mid, panel=10.0, wall=1.4):
    """Two flanges that hold a panel of given thickness, centred on depth mid."""
    return [rect(a0, mid + panel / 2, a1, mid + panel / 2 + wall), rect(a0, mid - panel / 2 - wall, a1, mid - panel / 2)]


# a: across (0 = outer edge of the leaf / outer edge of the frame), b: depth (0 = back, max = front facing the room)
SHAPES = {
    # Standard C, v2 (06.10.2026, traced from the end face of assets/sections/standart-c.jpg):
    # outer wall with a rounded front corner; front shell (visible face 30) with a down-turned lip;
    # concave C finger groove open toward the panel; upper chamber behind the groove closed by a wall with a lug;
    # rectangular lower chamber; ONE wide panel slot between the groove's lower lip and the bottom flange with an end lip.
    "handle_c": lambda w=30.0, d=40.0: [
        rect(0, 0, 1.5, d - 7),                      # outer wall
        arc_band(7, d - 7, 7, 5.5, 90, 180, 16),     # rounded front-outer corner
        rect(7, d - 1.5, 28.5, d),                   # front shell = visible face; its end is the lip of the grip
        arc_band(21, 26.5, 12, 10.5, 50, 250, 40),   # concave C groove: starts under the shell (lip), round the outer side, down to the lower lip
        rect(0, 21.2, 10.8, 22.7), rect(9.2, 19.6, 11.0, 21.2),  # upper chamber floor with the lug
        rect(17.6, 1.5, 19.1, 16.2),                 # lower chamber inner wall = slot bottom
        rect(13.5, 14.6, w, 17.4),                   # lower lip of the groove = upper wall of the panel slot
        rect(0, 0, w, 1.6), rect(w - 1.6, 1.6, w, 3.6),  # bottom flange with the end lip
        rect(5, 1.6, 6.2, 3.2), rect(11, 1.6, 12.2, 3.2),  # small lugs inside the lower chamber
    ],
    # Standard I / Flat: flat face, I-section, panel slot toward the insert.
    "handle_i": lambda w=30.0, d=26.0: [
        rect(0, d - 1.8, w, d), rect(0, 0, 14, 1.6), rect(2.4, 0, 4.0, d), rect(12.4, 0, 14, d),
        *slot(14, w, d / 2), rect(14, d / 2 - 6.4, 15.6, d / 2 + 6.4),
    ],
    # Slim / GRACE / NOVA: narrow 12 mm face, small rectangular tube with a slot.
    "handle_slim": lambda w=12.0, d=22.0: [
        rect(0, d - 1.4, w, d), rect(0, 0, 1.4, d), rect(0, 0, 5.5, 1.4), rect(4.2, 1.4, 5.5, d - 1.4),
        *slot(5.5, w, d / 2, wall=1.2), rect(5.5, d / 2 - 6.2, 6.8, d / 2 + 6.2),
    ],
    # Horizontal frame (top and bottom): a = along door height from the outer edge, b = depth.
    "frame": lambda h=40.0, d=16.0: [
        rect(0, 0, h - 12, 1.4), rect(0, d - 1.4, h - 12, d), rect(0, 0, 1.4, d), rect(h - 13.4, 0, h - 12, d),
        *slot(h - 12, h, d / 2), rect(10, 1.4, 11.2, d - 1.4),
    ],
    # Divider between inserts: H-section with a slot on each side.
    "divider": lambda h=20.0, d=14.0: [
        rect(0, d / 2 + 5, h, d / 2 + 6.4), rect(0, d / 2 - 6.4, h, d / 2 - 5), rect(h / 2 - 0.8, d / 2 - 6.4, h / 2 + 0.8, d / 2 + 6.4),
    ],
    # Top track: a = height (0 = lower edge, 35 = ceiling), b = depth across the opening (81.6). Two channels for two rows of doors.
    "track_top": lambda t=35.0, s=81.6: [
        rect(t - 1.8, 0, t, s), rect(0, 0, t, 1.6), rect(0, s - 1.6, t, s),
        rect(6, s / 2 - 0.8, t, s / 2 + 0.8), rect(10, s * 0.25 - 0.7, t, s * 0.25 + 0.7), rect(10, s * 0.75 - 0.7, t, s * 0.75 + 0.7),
    ],
    # Bottom track: a = height (0 = floor), b = depth. Base plate with two rounded rails.
    "track_bottom": lambda t=10.0, s=81.6: [
        rect(0, 0, 1.8, s), rect(0, 0, 4, 1.6), rect(0, s - 1.6, 4, s),
        rect(0, s * 0.3 - 1.3, t - 1.3, s * 0.3 + 1.3), arc_band(t - 1.3, s * 0.3, 1.3, 0.01, -90, 90, 12),
        rect(0, s * 0.7 - 1.3, t - 1.3, s * 0.7 + 1.3), arc_band(t - 1.3, s * 0.7, 1.3, 0.01, -90, 90, 12),
    ],
}


