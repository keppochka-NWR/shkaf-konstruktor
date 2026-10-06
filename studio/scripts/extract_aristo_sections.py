# -*- coding: utf-8 -*-
# Exact profile sections from the vector PDF "СХЕМЫ СБОРКИ СИСТЕМ ARISTO" (grouppartner.ru/upload/catalogs/ARISTO-Systems-Drawing.pdf).
# py -3 scripts/extract_aristo_sections.py <pdf> <out.json> [preview_dir]
# Each profile is a white-filled vector path; Bezier curves are flattened; loops are split where the path jumps.
# Scale comes from the dimension in the same drawing (e.g. "26" over profile C), so coordinates are in mm.
import fitz, json, math, os, sys

PDF, OUT = sys.argv[1], sys.argv[2]
PREVIEW = sys.argv[3] if len(sys.argv) > 3 else None
doc = fitz.open(PDF)


def bezier(p0, p1, p2, p3, n=10):
    return [((1 - t) ** 3 * p0.x + 3 * (1 - t) ** 2 * t * p1.x + 3 * (1 - t) * t * t * p2.x + t ** 3 * p3.x,
             (1 - t) ** 3 * p0.y + 3 * (1 - t) ** 2 * t * p1.y + 3 * (1 - t) * t * t * p2.y + t ** 3 * p3.y) for t in (i / n for i in range(1, n + 1))]


def loops_of(path):
    loops, cur, last = [], [], None
    for it in path["items"]:
        kind = it[0]
        if kind == "l":
            a, b = it[1], it[2]
            if last is None or abs(a.x - last[0]) > 1e-3 or abs(a.y - last[1]) > 1e-3:
                if len(cur) > 2: loops.append(cur)
                cur = [(a.x, a.y)]
            cur.append((b.x, b.y)); last = (b.x, b.y)
        elif kind == "c":
            p0, p1, p2, p3 = it[1], it[2], it[3], it[4]
            if last is None or abs(p0.x - last[0]) > 1e-3 or abs(p0.y - last[1]) > 1e-3:
                if len(cur) > 2: loops.append(cur)
                cur = [(p0.x, p0.y)]
            cur += bezier(p0, p1, p2, p3); last = (p3.x, p3.y)
        elif kind == "re":
            r = it[1]
            if len(cur) > 2: loops.append(cur)
            loops.append([(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]); cur, last = [], None
    if len(cur) > 2: loops.append(cur)
    # drop closing duplicates
    return [l[:-1] if abs(l[0][0] - l[-1][0]) < 1e-3 and abs(l[0][1] - l[-1][1]) < 1e-3 else l for l in loops]


def area(loop):
    return 0.5 * sum(loop[i][0] * loop[(i + 1) % len(loop)][1] - loop[(i + 1) % len(loop)][0] * loop[i][1] for i in range(len(loop)))


def white_paths(page, clip):
    return [g for g in page.get_drawings() if g.get("fill") and all(abs(c - 1) < 1e-3 for c in g["fill"][:3]) and fitz.Rect(g["rect"]).intersects(clip) and fitz.Rect(g["rect"]).width < clip.width]


def section(page_no, clip_pt, mm_per_unit, flip_y=True, pick=None):
    """All white-filled paths inside clip (PDF points) → loops in mm, origin at the bbox min, y up."""
    page = doc[page_no - 1]
    clip = fitz.Rect(*clip_pt)
    paths = white_paths(page, clip)
    if pick: paths = [p for p in paths if pick(fitz.Rect(p["rect"]))]
    loops = [l for p in paths for l in loops_of(p)]
    xs = [x for l in loops for x, _ in l]; ys = [y for l in loops for _, y in l]
    x0, y0, y1 = min(xs), min(ys), max(ys)
    out = []
    for l in loops:
        pts = [((x - x0) * mm_per_unit, ((y1 - y) if flip_y else (y - y0)) * mm_per_unit) for x, y in l]
        out.append([[round(a, 3), round(b, 3)] for a, b in pts])
    return out


def path_loops(page_no, index, sx, sy, mode):
    """One white path by index → loops in mm. mode: 'handle' (a = x from outer edge, b = depth with top = front),
    'frame_top' (a = down from the top edge, b = x), 'up' (a = up from the lower edge, b = x)."""
    g = doc[page_no - 1].get_drawings()[index]
    r = fitz.Rect(g["rect"])
    out = []
    for l in loops_of(g):
        if mode == "handle": pts = [((x - r.x0) * sx, (r.y1 - y) * sy) for x, y in l]
        elif mode == "frame_top": pts = [((y - r.y0) * sy, (x - r.x0) * sx) for x, y in l]
        else: pts = [((r.y1 - y) * sy, (x - r.x0) * sx) for x, y in l]
        out.append([[round(a, 3), round(b, 3)] for a, b in pts])
    return out, r


# Horizontal sections (true scale): C — dimension 26 spans 438.45..464.15; H — dimension 35.2 spans 436.34..471.43.
C_SCALE = 26.0 / (464.15 - 438.45)
H_SCALE = 35.2 / (471.43 - 436.34)
# Vertical section page 4: «39» between rows = 54.1 pt across, «56» bottom frame = 78.8 pt high.
VX, VY = 39.0 / 54.1, 56.0 / 78.8
c_loops, c_rect = path_loops(4, 495, C_SCALE, C_SCALE, "handle")
h_loops, h_rect = path_loops(5, 21, H_SCALE, H_SCALE, "handle")
ft, _ = path_loops(4, 408, VX, VY, "frame_top")
fb, _ = path_loops(4, 412, VX, VY, "up")
tt, _ = path_loops(4, 470, VX, VY, "up")
tb, _ = path_loops(4, 431, VX, VY, "up")
result = {
    "source": "СХЕМЫ СБОРКИ СИСТЕМ ARISTO — grouppartner.ru/upload/catalogs/ARISTO-Systems-Drawing.pdf (векторные контуры, масштаб по размерам чертежа)",
    "handle_c": {"page": 4, "note": "Сечение по горизонтали, профиль С. Масштаб по размеру 26.", "panel_offset": round((c_rect.y1 - (105.02 + 110.93) / 2) * C_SCALE - c_rect.height * C_SCALE / 2, 2), "loops": c_loops},
    "handle_h": {"page": 5, "note": "Сечение по горизонтали, профиль Н. Масштаб по размеру 35,2.", "panel_offset": round((h_rect.y1 - (102.79 + 108.75) / 2) * H_SCALE - h_rect.height * H_SCALE / 2, 2), "loops": h_loops},
    "frame_top": {"page": 4, "note": "Сечение по вертикали: верхняя рамка двери. Масштаб по размерам 39 и 56.", "loops": ft},
    "frame_bottom": {"page": 4, "note": "Сечение по вертикали: нижняя рамка двери с местом под ролик (размер 56).", "loops": fb},
    "track_top": {"page": 4, "note": "Сечение по вертикали: верхняя направляющая на два ряда (размер 40 от потолка).", "loops": tt},
    "track_bottom": {"page": 4, "note": "Сечение по вертикали: нижняя направляющая на два ряда (размер 8).", "loops": tb},
}
json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
for k, v in result.items():
    if isinstance(v, dict):
        pts = [p for l in v["loops"] for p in l]
        print(k, "loops", len(v["loops"]), "size %.1f x %.1f mm" % (max(p[0] for p in pts) - min(p[0] for p in pts), max(p[1] for p in pts) - min(p[1] for p in pts)), "areas", [round(area(l), 1) for l in v["loops"]])

if PREVIEW:
    from PIL import Image, ImageDraw
    for k, v in result.items():
        if not isinstance(v, dict): continue
        pts = [p for l in v["loops"] for p in l]
        w, h = max(p[0] for p in pts), max(p[1] for p in pts)
        s = 18
        img = Image.new("RGB", (int(w * s) + 40, int(h * s) + 40), "white"); d = ImageDraw.Draw(img)
        for l in v["loops"]:
            d.polygon([(20 + x * s, 20 + (h - y) * s) for x, y in l], outline="#c0392b")
        img.save(os.path.join(PREVIEW, k + "_extract.png"))
