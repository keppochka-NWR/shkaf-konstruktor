# -*- coding: utf-8 -*-
# Shared helpers for reading vector paths from PyMuPDF (used by extract_catalog_sections.py).


def bezier(p0, p1, p2, p3, n=10):
    return [((1 - t) ** 3 * p0.x + 3 * (1 - t) ** 2 * t * p1.x + 3 * (1 - t) * t * t * p2.x + t ** 3 * p3.x,
             (1 - t) ** 3 * p0.y + 3 * (1 - t) ** 2 * t * p1.y + 3 * (1 - t) * t * t * p2.y + t ** 3 * p3.y) for t in (i / n for i in range(1, n + 1))]


def loops_of(path):
    """Path items ('l', 'c', 're', 'qu') -> closed loops of points; a new loop starts where the path jumps."""
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
        elif kind == "qu":
            q = it[1]
            if len(cur) > 2: loops.append(cur)
            loops.append([(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]); cur, last = [], None
    if len(cur) > 2: loops.append(cur)
    return [l[:-1] if abs(l[0][0] - l[-1][0]) < 1e-3 and abs(l[0][1] - l[-1][1]) < 1e-3 else l for l in loops]
