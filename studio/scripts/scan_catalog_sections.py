# -*- coding: utf-8 -*-
# Profile sections in the ARISTO catalogue 2026 (Katalog_ARISTO_Rus_02.10.2026_web.pdf): every section is one green-filled vector path.
# Dimension numbers are drawn as glyph curves (not text), so the scale comes from the dimension line: the distance between the tips
# of its two arrowheads (small black filled triangles), divided into the number read from the drawing.
# py -3 scripts/scan_catalog_sections.py <pdf> <page> [page ...]  — lists green paths and the arrow pairs around them.
import sys
import fitz

GREEN = (0.46, 0.72, 0.16)


def is_green(c):
    return bool(c) and all(abs(a - b) < 0.08 for a, b in zip(c[:3], GREEN))


def arrows(page):
    """Arrowheads: filled dark paths of 3 straight segments, under 3 pt. Returns (rect, tip point, direction 'h'/'v')."""
    out = []
    for g in page.get_drawings():
        f = g.get("fill")
        if not f or max(f[:3]) > 0.3 or len(g["items"]) > 4 or any(it[0] != "l" for it in g["items"]): continue
        r = fitz.Rect(g["rect"])
        if max(r.width, r.height) > 3: continue
        pts = [it[1] for it in g["items"]] + [it[2] for it in g["items"]]
        if r.width > r.height:  # horizontal arrow: tip is the point at the narrow end (x extreme with y in the middle)
            ym = (r.y0 + r.y1) / 2
            tip = min(pts, key=lambda p: abs(p.y - ym) + (0 if p.x in (r.x0, r.x1) else 9))
            out.append((r, tip, "h"))
        else:
            xm = (r.x0 + r.x1) / 2
            tip = min(pts, key=lambda p: abs(p.x - xm) + (0 if p.y in (r.y0, r.y1) else 9))
            out.append((r, tip, "v"))
    return out


def dim_pairs(page, r, reach=30):
    """Arrow pairs around bbox r: horizontal pairs above/below it, vertical pairs left/right. Returns list of (dir, span_pt, offset_pt)."""
    A = arrows(page)
    res = []
    hs = [a for a in A if a[2] == "h" and (r.y0 - reach < a[1].y < r.y0 or r.y1 < a[1].y < r.y1 + reach) and r.x0 - reach < a[1].x < r.x1 + reach]
    for i, a in enumerate(hs):
        for b in hs[i + 1:]:
            if abs(a[1].y - b[1].y) < 0.6 and abs(a[1].x - b[1].x) > 2:
                res.append(("h", abs(a[1].x - b[1].x), min(abs(a[1].y - r.y0), abs(a[1].y - r.y1)), min(a[1].x, b[1].x), max(a[1].x, b[1].x)))
    vs = [a for a in A if a[2] == "v" and (r.x0 - reach < a[1].x < r.x0 or r.x1 < a[1].x < r.x1 + reach) and r.y0 - reach < a[1].y < r.y1 + reach]
    for i, a in enumerate(vs):
        for b in vs[i + 1:]:
            if abs(a[1].x - b[1].x) < 0.6 and abs(a[1].y - b[1].y) > 2:
                res.append(("v", abs(a[1].y - b[1].y), min(abs(a[1].x - r.x0), abs(a[1].x - r.x1)), min(a[1].y, b[1].y), max(a[1].y, b[1].y)))
    return res


def green_paths(page):
    for i, g in enumerate(page.get_drawings()):
        if is_green(g.get("fill")):
            r = fitz.Rect(g["rect"])
            if r.width > 4 and r.height > 4: yield i, g, r


if __name__ == "__main__":
    doc = fitz.open(sys.argv[1])
    for p in map(int, sys.argv[2:]):
        print("page", p)
        for i, g, r in green_paths(doc[p - 1]):
            ds = "; ".join(f"{d} {s:.2f}pt" for d, s, *_ in dim_pairs(doc[p - 1], r))
            print(f"  #{i} items {len(g['items'])} bbox {r.x0:.1f},{r.y0:.1f} {r.width:.2f}x{r.height:.2f} | {ds}")
