# -*- coding: utf-8 -*-
# Where the insert goes into a handle profile: the slot on the inner side (a = max) — a gap 8–13 mm wide whose bottom is flat.
# The C-shaped grip is also an opening on that side, but its bottom is round, so the flatness test tells them apart.
# slot_offset(loops) -> slot centre minus section centre along b (mm, minus = toward the back), or None.
import json, sys


def inside(loops, a, b):
    """Even-odd test over all loops (outer contour and chambers)."""
    c = False
    for l in loops:
        n = len(l)
        for i in range(n):
            (x1, y1), (x2, y2) = l[i], l[(i + 1) % n]
            if (y1 > b) != (y2 > b) and a < x1 + (b - y1) * (x2 - x1) / (y2 - y1): c = not c
    return c


def penetration(loops, a_max, b, depth, step=0.1):
    """How far from the inner edge a ray along -a stays out of the metal (stops at `depth`)."""
    d = 0.3
    while d < depth and not inside(loops, a_max - d, b): d += step
    return d


def slot_offset(loops, min_w=7.5, max_w=13.5, min_pen=4.0):
    pts = [p for l in loops for p in l]
    a_max = max(p[0] for p in pts); b0, b1 = min(p[1] for p in pts), max(p[1] for p in pts)
    width = a_max - min(p[0] for p in pts)
    bs = [b0 + i * 0.1 for i in range(int((b1 - b0) / 0.1) + 1)]
    pen = [penetration(loops, a_max, b, width * 0.8) for b in bs]
    cands, start = [], None
    for i, p in enumerate(pen + [0]):
        if p >= min_pen and start is None: start = i
        if p < min_pen and start is not None:
            lo, hi = bs[start], bs[i - 1]
            if min_w <= hi - lo <= max_w:
                mid = pen[start + (i - start) // 5: i - (i - start) // 5]
                m = sum(mid) / len(mid)
                cands.append((sum((x - m) ** 2 for x in mid) / len(mid), (lo + hi) / 2, hi - lo, m))
            start = None
    if not cands: return None, []
    best = min(cands)
    return round(best[1] - (b0 + b1) / 2, 2), cands


if __name__ == "__main__":
    for f in sys.argv[1:]:
        data = json.load(open(f, encoding="utf-8"))
        for k, v in data.items():
            if isinstance(v, dict) and k.startswith("handle"):
                off, c = slot_offset(v["loops"])
                print(f"{k:18s} slot offset {off}  candidates {[(round(x[1],1), round(x[2],1), round(x[0],2)) for x in c]}")
