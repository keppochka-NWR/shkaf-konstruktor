# -*- coding: utf-8 -*-
# Exact profile sections from the ARISTO catalogue 2026 (aristo.expert «Katalog_ARISTO_Rus_02.10.2026_web.pdf»).
# py -3 scripts/extract_catalog_sections.py <catalogue.pdf> <out.json>
# Each section is one green-filled vector path (plus white «hole» paths for a few profiles). Curves are flattened, loops kept with holes.
# Scale: the catalogue dimension numbers give the overall size of the section; the arrow lines are drawn loosely, so
#   scale = number / extent of the contour along the axis named in the table (both axes are reported as a check).
# Orientation in the output (same as aristo_sections.json):
#   handles  — a across the door face (0 = outer edge of the leaf), b depth (larger = front, facing the room);
#   frames — a height measured from the edge on the roller / track side (top frame: down from its upper edge, bottom frame: up from its lower edge), b depth;
#   tracks — a height up from the open (lower) edge, b depth; middle frames (dividers) — a height, b depth.
# The table's «orient» turns the drawing into that convention: mx = mirror left-right, my = mirror up-down, swap = exchange axes.
import json, sys
import fitz
sys.path.insert(0, __file__.rsplit("\\", 1)[0] if "\\" in __file__ else ".")
from extract_aristo_sections_lib import loops_of  # noqa: E402

PDF, OUT = sys.argv[1], sys.argv[2]
doc = fitz.open(PDF)
CAT = "Каталог ARISTO 02.10.2026 (aristo.expert)"

# name: page, green path, extra white paths (holes), (axis 'w'|'h', number), orient, kind, title, article
T = {
    # Стандарт, стр. 6 каталога (PDF 7)
    "handle_flat": (7, 18, (), ("h", 34), "mx", "handle", "Профиль вертикальный FLAT (Плоскость)", "AS0533"),
    "handle_i": (7, 2, (), ("h", 34), "mx", "handle", "Профиль вертикальный I", "AS0639"),
    "handle_avers": (7, 163, (), ("w", 20), "mx", "handle", "Профиль вертикальный AVERS", "AS0791"),
    "handle_smart": (7, 176, (), ("w", 26), "mx", "handle", "Профиль вертикальный SMART (Элегант)", "AS0750"),
    "handle_twelve": (7, 185, (), ("w", 12), "", "handle", "Профиль вертикальный TWELVE", "AS0819"),
    "handle_fusion": (7, 118, (119,), ("w", 39.5), "mx", "handle", "Профиль вертикальный FUSION (Синтез)", "FA0413"),
    "handle_c_cat": (7, 184, (), ("w", 26), "mx", "handle", "Профиль вертикальный C (каталог, для сверки)", "AS0731"),
    "divider": (7, 91, (), ("h", 25), "swap", "frame", "Рамка средняя", "AS0640"),
    "divider_twelve": (7, 197, (), ("h", 12), "swap", "frame", "Рамка средняя TWELVE", "AS0820"),
    # Эконом, стр. 44 (PDF 45)
    "handle_c_eco": (45, 27, (), ("h", 34), "mx", "handle", "Профиль вертикальный C ЭКО", "AE0704"),
    "handle_h_eco": (45, 82, (83, 84, 85), ("w", 35.2), "", "handle", "Профиль вертикальный H ЭКО", "AE0503"),
    "handle_flat_eco": (45, 128, (), ("h", 34), "mx", "handle", "Профиль вертикальный FLAT ЭКО", "AE0732"),
    "handle_o": (45, 0, (), ("h", 34), "mx", "handle", "Профиль вертикальный O", "AS0482"),
    "frame_top_eco": (45, 116, (), ("h", 21.5), "my swap", "frame", "Рамка верхняя ЭКО", "AE0688"),
    "frame_bottom_eco": (45, 92, (), ("h", 56.5), "swap", "frame", "Рамка нижняя ЭКО", "AE0689"),
    "divider_eco": (45, 43, (), ("h", 25.1), "swap", "frame", "Рамка средняя ЭКО", "AE0452"),
    "track_top_eco": (45, 44, (), ("w", 82), "swap", "track", "Направляющая двухполозная верхняя ЭКО", "AE0492"),
    "track_bottom_eco": (45, 81, (), ("w", 60), "swap", "track", "Направляющая двухполозная нижняя ЭКО", "AE0488"),
    # Slim line, стр. 52 (PDF 53)
    "handle_slim": (53, 12, (), ("h", 34), "", "handle", "Профиль вертикальный SLIM LINE", "AV0991"),
    "handle_slim_max": (53, 33, (), ("h", 34), "", "handle", "Профиль вертикальный SLIM MAX", "AV0793"),
    "frame_slim_wide": (53, 163, (), ("h", 46.1), "my swap", "frame", "Рамка широкая SLIM", "AV0589"),
    "frame_slim_narrow": (53, 91, (), ("w", 32.2), "my swap", "frame", "Рамка узкая SLIM", "AV0588"),
    "divider_slim": (53, 132, (), ("w", 32.2), "swap", "frame", "Рамка средняя SLIM", "AV0590"),
    # NOVA, стр. 62 (PDF 63)
    "handle_nova": (63, 0, (), ("h", 34), "mx", "handle", "Профиль вертикальный NOVA", "NB0487"),
    "frame_nova": (63, 21, (), ("w", 17), "my swap", "frame", "Рамка горизонтальная NOVA", "NB0442"),
    "divider_nova": (63, 38, (), ("w", 34), "swap", "frame", "Рамка средняя закрытая NOVA", "NB0486"),
    # GRACE, стр. 212 (PDF 213)
    "handle_grace": (213, 69, (), ("h", 42), "", "handle", "Вертикальный профиль GRACE", "OP0738"),
    "track_top_grace": (213, 27, (), ("w", 51), "swap", "track", "Направляющая верхняя GRACE", "OP0847"),
    "frame_grace": (213, 4, (), ("w", 43), "my swap", "frame", "Горизонтальный профиль GRACE (верх/низ)", "OP0788"),
    "divider_grace": (213, 105, (), ("w", 43), "swap", "frame", "Горизонтальный разделительный профиль GRACE", "OP0789"),
}


def section(name):
    page_no, idx, holes, (axis, num), orient, kind, title, art = T[name]
    dr = doc[page_no - 1].get_drawings()
    g = dr[idx]
    r = fitz.Rect(g["rect"])
    raw = loops_of(g)
    # holes: white-filled paths drawn over the green one inside its box (chambers of FUSION, Slim frames...), plus the listed ones
    auto = [j for j in range(idx + 1, min(idx + 40, len(dr))) if dr[j].get("fill") and min(dr[j]["fill"][:3]) > 0.97
            and fitz.Rect(dr[j]["rect"]).width > 0.3 and r.contains(fitz.Rect(dr[j]["rect"]))]
    holes = sorted(set(holes) | set(auto))
    for h in holes:
        raw += loops_of(dr[h])
    ext = r.width if axis == "w" else r.height
    s = num / ext
    other = r.height * s if axis == "w" else r.width * s
    loops = []
    for l in raw:
        pts = [((x - r.x0) * s, (r.y1 - y) * s) for x, y in l]  # x right, y up, mm
        if "mx" in orient: pts = [(r.width * s - x, y) for x, y in pts]
        if "my" in orient: pts = [(x, r.height * s - y) for x, y in pts]
        if "swap" in orient: pts = [(y, x) for x, y in pts]
        loops.append([[round(a, 3), round(b, 3)] for a, b in pts])
    return {"page": page_no, "path": idx, "holes": list(holes), "orient": orient, "scale_by": f"{axis}={num}", "mm_per_pt": round(s, 5),
            "size": [round(r.width * s, 2), round(r.height * s, 2)], "kind": kind, "title": title, "article": art,
            "source": f"{CAT}, стр. {page_no - 1} (PDF {page_no})", "loops": loops}


# Slot for the insert where profile_slot.py cannot find it on the inner edge (the face overhangs the insert, or the profile is thin):
# read from the drawing on a 1 mm grid — centre of the channel between the two serrated lips, minus the section centre (mm).
SLOT_MANUAL = {"handle_flat": -8.5, "handle_h_eco": 0.0, "handle_nova": 8.0, "handle_grace": 0.0}
from profile_slot import slot_offset  # noqa: E402

out = {"source": CAT + " — https://aristo.expert/upload/iblock/b76/0hyqjjsvx318midk215x4uyz4otux0nv/Katalog_ARISTO_Rus_02.10.2026_web.pdf"}
for n in T:
    out[n] = section(n)
    if out[n]["kind"] == "handle":
        auto, _ = slot_offset(out[n]["loops"])
        if auto is None: auto, _ = slot_offset(out[n]["loops"], min_w=6, max_w=14, min_pen=3.0)
        out[n]["slot"] = SLOT_MANUAL.get(n, auto)
        out[n]["slot_how"] = "по сетке 1 мм" if n in SLOT_MANUAL else "автоматически по контуру"
    print(f"{n:18s} {out[n]['size'][0]:6.2f} x {out[n]['size'][1]:6.2f} mm  scale {out[n]['mm_per_pt']}  loops {len(out[n]['loops'])}  slot {out[n].get('slot')}")
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
