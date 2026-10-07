# -*- coding: utf-8 -*-
# Cross-sections of the sliding door profiles (mm). Shared by blender_kupe_profiles.py (3D models) and the check sheets.
# All shapes are factory contours taken from vector PDFs of ARISTO:
#   aristo_sections.json  — «СХЕМЫ СБОРКИ СИСТЕМ ARISTO» (grouppartner.ru): handle C, handle H, standard frames and tracks
#                           (extract_aristo_sections.py, scale by the drawing dimensions);
#   aristo_catalog_sections.json — catalogue ARISTO 02.10.2026 (aristo.expert): all other handles, ECO / Slim / NOVA / GRACE
#                           frames, middle frames, ECO and GRACE tracks (extract_catalog_sections.py, scale by the catalogue sizes).
# Handles: a across (0 = outer edge of the leaf), b depth (larger = front). Frames: a height from the roller / track edge, b depth.
# Tracks: a height up from the open edge, b depth. Middle frames: a height, b depth.
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
FACTORY = json.load(open(os.path.join(HERE, "aristo_sections.json"), encoding="utf-8"))
CATALOG = json.load(open(os.path.join(HERE, "aristo_catalog_sections.json"), encoding="utf-8"))
SECTIONS = {k: v for k, v in FACTORY.items() if isinstance(v, dict)}
SECTIONS.update({k: v for k, v in CATALOG.items() if isinstance(v, dict) and k != "handle_c_cat"})  # C from the catalogue is only a cross-check
FACTORY_NAMES = tuple(SECTIONS)
SHAPES = {}  # no approximate shapes left


def loops(name):
    return SECTIONS[name]["loops"]
