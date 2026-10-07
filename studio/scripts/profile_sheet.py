# -*- coding: utf-8 -*-
# Check sheet for each factory profile: the factory drawing with our contour on top (red), the model end view and a 3/4 render.
# py -3 scripts/profile_sheet.py <ARISTO-Systems-Drawing.pdf> <Katalog_ARISTO_2026.pdf> <renders_dir> <out_dir> [name ...]
# Renders come from blender_profile_views.py (<name>_end.png, <name>_iso.png).
import io, json, os, sys
import fitz
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps

PDF_SYS, PDF_CAT, REN, OUT = sys.argv[1:5]
HERE = os.path.dirname(os.path.abspath(__file__))
SYS = json.load(open(os.path.join(HERE, "aristo_sections.json"), encoding="utf-8"))
CAT = json.load(open(os.path.join(HERE, "aristo_catalog_sections.json"), encoding="utf-8"))
docs = {"sys": fitz.open(PDF_SYS), "cat": fitz.open(PDF_CAT)}
C_SCALE, H_SCALE = 26.0 / (464.15 - 438.45), 35.2 / (471.43 - 436.34)
VX, VY = 39.0 / 54.1, 56.0 / 78.8
SYS_SRC = "«Схемы сборки систем ARISTO», grouppartner.ru"
CAT_SRC = "Каталог ARISTO 02.10.2026, aristo.expert"
# name -> (doc, page, path, sx, sy, orient, title, note)
P = {
    "handle_c": ("sys", 4, 495, C_SCALE, C_SCALE, "", "Профиль-ручка C", "горизонтальное сечение, масштаб по размеру 26"),
    "handle_h": ("sys", 5, 21, H_SCALE, H_SCALE, "", "Профиль-ручка H", "горизонтальное сечение, масштаб по размеру 35,2"),
    "frame_top": ("sys", 4, 408, VX, VY, "my swap", "Рамка верхняя", "вертикальное сечение, масштаб по размерам 39 и 56"),
    "frame_bottom": ("sys", 4, 412, VX, VY, "swap", "Рамка нижняя", "вертикальное сечение, масштаб по размеру 56"),
    "track_top": ("sys", 4, 470, VX, VY, "swap", "Направляющая верхняя", "вертикальное сечение, размеры 40 и 39"),
    "track_bottom": ("sys", 4, 431, VX, VY, "swap", "Направляющая нижняя", "вертикальное сечение, размер 8"),
}
for k, v in CAT.items():
    if isinstance(v, dict):
        art = v.get("article", "")
        P[k] = ("cat", v["page"], v["path"], v["mm_per_pt"], v["mm_per_pt"], v["orient"], v["title"] + (f" · {art}" if art else ""),
                f"масштаб по размеру каталога {v['scale_by'].split('=')[1].replace('.', ',')} мм")
F = lambda s, b=False: ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf" if b else "C:/Windows/Fonts/arial.ttf", s)


def loops_of(name):
    return (SYS if name in SYS else CAT)[name]["loops"]


def to_pdf(r, sx, sy, orient, a, b):
    """Undo the extraction transform: (a, b) in mm -> PDF point."""
    W, H = r.width * sx, r.height * sy
    x, y = (b, a) if "swap" in orient else (a, b)
    if "my" in orient: y = H - y
    if "mx" in orient: x = W - x
    return r.x0 + x / sx, r.y1 - y / sy


def end_view(name, orient):
    """Render: x = a, up = b after a vertical flip. Bring it back to the drawing orientation."""
    j = Image.open(os.path.join(REN, f"{name}_end.png")).convert("RGB")  # rows from the bottom: x = a, row = b
    if "swap" in orient: j = j.transpose(Image.TRANSPOSE)
    if "my" in orient: j = ImageOps.flip(j)
    if "mx" in orient: j = ImageOps.mirror(j)
    return ImageOps.flip(j)


def trim(im, pad=40):
    bg = Image.new("RGB", im.size, im.getpixel((2, 2)))
    box = ImageChops.difference(im, bg).convert("L").point(lambda v: 255 if v > 18 else 0).getbbox()
    if not box: return im
    return im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)))


def sheet(name):
    src, page_no, idx, sx, sy, orient, title, note = P[name]
    page = docs[src][page_no - 1]
    r = fitz.Rect(page.get_drawings()[idx]["rect"])
    m = max(r.width, r.height) * 0.35 + 6
    clip = fitz.Rect(r.x0 - m, r.y0 - m, r.x1 + m, r.y1 + m) & page.rect
    dpi = int(min(1600, 900 * 46 / max(r.width, r.height)))
    z = dpi / 72
    im = Image.open(io.BytesIO(page.get_pixmap(clip=clip, dpi=dpi).tobytes("png"))).convert("RGB")
    d = ImageDraw.Draw(im)
    for l in loops_of(name):
        pts = [((x - clip.x0) * z, (y - clip.y0) * z) for x, y in (to_pdf(r, sx, sy, orient, a, b) for a, b in l)]
        d.line(pts + [pts[0]], fill=(220, 30, 30), width=3)
    im.thumbnail((820, 820))
    end = trim(end_view(name, orient)); end.thumbnail((820, 820))
    iso = trim(Image.open(os.path.join(REN, f"{name}_iso.png")).convert("RGB")); iso.thumbnail((700, 820))
    w, h = r.width * sx, r.height * sy  # as drawn
    shown = f"стр. {page_no}" if src == "sys" else f"стр. {page_no - 1} (PDF {page_no})"
    cols = ((im, f"Чертёж Aristo, {shown} + наш контур (красный)"), (end, "Наша 3D-модель: торец"), (iso, "Наша 3D-модель: отрезок"))
    foot = f"Источник: {SYS_SRC if src == 'sys' else CAT_SRC} · контур снят с векторного PDF · {note}"
    cw = [max(img.width, int(F(22, True).getlength(cap)) + 10) for img, cap in cols]
    W = max(sum(cw) + 80, int(F(18).getlength(foot)) + 40, int(F(34, True).getlength(title)) + 260)
    H = max(im.height, end.height, iso.height) + 170
    sh = Image.new("RGB", (W, H), "white"); dd = ImageDraw.Draw(sh)
    dd.text((20, 16), f"{title} · {w:.1f} × {h:.1f} мм".replace(".", ","), font=F(34, True), fill="#1d2b3a")
    x = 20
    for (img, cap), c in zip(cols, cw):
        sh.paste(img, (x + (c - img.width) // 2, 120)); dd.text((x, 76), cap, font=F(22, True), fill="#2449d6"); x += c + 20
    dd.text((20, H - 40), foot, font=F(18), fill="#4d6370")
    path = os.path.join(OUT, f"{name}_model.png"); sh.save(path); return path


def overview():
    """All sections on one sheet, one scale (6 px per mm), grouped by family, with the source page."""
    groups = [
        ("Ручки Стандарт", ["handle_c", "handle_flat", "handle_i", "handle_fusion", "handle_smart", "handle_avers", "handle_twelve"]),
        ("Ручки ЭКО", ["handle_c_eco", "handle_h_eco", "handle_flat_eco", "handle_o", "handle_h"]),
        ("Ручки Slim, NOVA, GRACE", ["handle_slim", "handle_slim_max", "handle_nova", "handle_grace"]),
        ("Рамки и средние рамки", ["frame_top", "frame_bottom", "divider", "divider_twelve", "frame_top_eco", "frame_bottom_eco", "divider_eco",
                                   "frame_slim_wide", "divider_slim", "frame_nova", "divider_nova", "frame_grace", "divider_grace"]),
        ("Направляющие", ["track_top", "track_bottom", "track_top_eco", "track_bottom_eco", "track_top_grace"]),
    ]
    k, W = 6.0, 2400
    rows, y = [], 110
    for title, names in groups:
        x, row_h, cells = 30, 0, []
        for n in names:
            ls = loops_of(n); orient = P[n][5]
            # draw in the drawing orientation: undo swap / my / mx
            pts_all = []
            for l in ls:
                q = []
                for a, b in l:
                    xx, yy = (b, a) if "swap" in orient else (a, b)
                    q.append((xx, yy))
                pts_all.append(q)
            xs = [p[0] for l in pts_all for p in l]; ys = [p[1] for l in pts_all for p in l]
            w, h = (max(xs) - min(xs)) * k, (max(ys) - min(ys)) * k
            cw = max(w, 150) + 30
            if x + cw > W - 30: break
            cells.append((n, pts_all, x, w, h, min(xs), max(ys)))
            x += cw; row_h = max(row_h, h)
        rows.append((title, y, cells, row_h)); y += row_h + 120
    img = Image.new("RGB", (W, y + 40), "white"); d = ImageDraw.Draw(img)
    d.text((30, 24), "Сечения профилей купе в 3D-студии — все по заводским чертежам ARISTO, один масштаб", font=F(34, True), fill="#1d2b3a")
    d.text((30, 70), f"Источники: {SYS_SRC} (C, H, рамки и направляющие Стандарт); {CAT_SRC} (остальные)", font=F(19), fill="#4d6370")
    for title, y0, cells, row_h in rows:
        d.text((30, y0), title, font=F(24, True), fill="#2449d6")
        for n, ls, x, w, h, x0, y1 in cells:
            top = y0 + 40 + (row_h - h)
            mask = Image.new("1", img.size, 0)
            for l in ls:
                m = Image.new("1", img.size, 0); ImageDraw.Draw(m).polygon([(x + (a - x0) * k, top + (y1 - b) * k) for a, b in l], fill=1); mask = ImageChops.logical_xor(mask, m)
            img.paste(Image.new("RGB", img.size, "#7d8a94"), mask=mask)
            src, page_no = P[n][0], P[n][1]
            pg = f"стр. {page_no}" if src == "sys" else f"кат. стр. {page_no - 1}"
            d.text((x, top + h + 8), P[n][6].split(" · ")[0].replace("Профиль вертикальный ", "").replace("Профиль-ручка ", "")[:24], font=F(15, True), fill="#1d2b3a")
            d.text((x, top + h + 28), f"{w / k:.1f} × {h / k:.1f} мм · {pg}".replace(".", ","), font=F(14), fill="#4d6370")
    path = os.path.join(OUT, "overview.png"); img.save(path); return path


if sys.argv[5:] == ["overview"]:
    print(overview())
else:
    for n in (sys.argv[5:] or [k for k in P if k != "handle_c_cat"]):
        print(sheet(n))
    print(overview())
