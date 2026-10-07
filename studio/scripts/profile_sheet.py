# -*- coding: utf-8 -*-
# Check sheet for one factory profile: the factory drawing with our contour on top (red), the model end view and a 3/4 render.
# py -3 scripts/profile_sheet.py <ARISTO-Systems-Drawing.pdf> <renders_dir> <out_dir> [name ...]
# Renders come from blender_profile_views.py (<name>_end.png, <name>_iso.png).
import io, json, os, sys
import fitz
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps

PDF, REN, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
SEC = json.load(open(os.path.join(HERE, "aristo_sections.json"), encoding="utf-8"))
doc = fitz.open(PDF)
C_SCALE, H_SCALE = 26.0 / (464.15 - 438.45), 35.2 / (471.43 - 436.34)
VX, VY = 39.0 / 54.1, 56.0 / 78.8
# name: title, page, path index, mode (as in extract_aristo_sections.py), scales, crop margins (pt: left, top, right, bottom), dimension note
P = {
    "handle_c": ("Профиль-ручка C", 4, 495, "handle", C_SCALE, C_SCALE, (14, 22, 14, 8), "горизонтальное сечение, размер 26"),
    "handle_h": ("Профиль-ручка H", 5, 21, "handle", H_SCALE, H_SCALE, (14, 22, 14, 8), "горизонтальное сечение, размер 35,2"),
    "frame_top": ("Рамка верхняя", 4, 408, "frame_top", VX, VY, (10, 10, 10, 14), "вертикальное сечение, размеры 39 и 56"),
    "frame_bottom": ("Рамка нижняя", 4, 412, "up", VX, VY, (10, 8, 10, 8), "вертикальное сечение, размер 56"),
    "track_top": ("Направляющая верхняя", 4, 470, "up", VX, VY, (8, 8, 8, 8), "вертикальное сечение, размеры 40 и 39"),
    "track_bottom": ("Направляющая нижняя", 4, 431, "up", VX, VY, (8, 14, 8, 8), "вертикальное сечение, размер 8"),
}
F = lambda s, b=False: ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf" if b else "C:/Windows/Fonts/arial.ttf", s)


def to_pdf(mode, r, sx, sy, a, b):
    if mode == "handle": return r.x0 + a / sx, r.y1 - b / sy
    if mode == "frame_top": return r.x0 + b / sx, r.y0 + a / sy
    return r.x0 + b / sx, r.y1 - a / sy


def end_view(name, mode):
    """Render is x = a, y up = -b. Turn it into the drawing orientation."""
    im = ImageOps.flip(Image.open(os.path.join(REN, f"{name}_end.png")).convert("RGB"))  # now x = a, up = b
    if mode == "handle": return im
    im = im.transpose(Image.TRANSPOSE)  # x = -b... fix below: x = b after mirror, up = a
    im = ImageOps.mirror(im)  # x = b, down = a  (frame_top: a goes down from the top edge)
    return im if mode == "frame_top" else ImageOps.flip(im)  # 'up': a goes up


def trim(im, pad=40):
    """Crop the empty background around the end face."""
    bg = Image.new("RGB", im.size, im.getpixel((2, 2)))
    box = ImageChops.difference(im, bg).convert("L").point(lambda v: 255 if v > 18 else 0).getbbox()
    if not box: return im
    return im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)))


def sheet(name):
    title, page_no, idx, mode, sx, sy, mg, dim = P[name]
    page = doc[page_no - 1]
    r = fitz.Rect(page.get_drawings()[idx]["rect"])
    clip = fitz.Rect(r.x0 - mg[0], r.y0 - mg[1], r.x1 + mg[2], r.y1 + mg[3])
    dpi = int(min(1400, 900 * 46 / max(r.width, r.height)))
    z = dpi / 72
    im = Image.open(io.BytesIO(page.get_pixmap(clip=clip, dpi=dpi).tobytes("png"))).convert("RGB")
    d = ImageDraw.Draw(im)
    for l in SEC[name]["loops"]:
        pts = [((x - clip.x0) * z, (y - clip.y0) * z) for x, y in (to_pdf(mode, r, sx, sy, a, b) for a, b in l)]
        d.line(pts + [pts[0]], fill=(220, 30, 30), width=3)
    im.thumbnail((820, 820))
    end = trim(end_view(name, mode)); end.thumbnail((820, 820))
    iso = trim(Image.open(os.path.join(REN, f"{name}_iso.png")).convert("RGB")); iso.thumbnail((700, 820))
    pts = [p for l in SEC[name]["loops"] for p in l]
    w, h = max(p[0] for p in pts) - min(p[0] for p in pts), max(p[1] for p in pts) - min(p[1] for p in pts)
    if mode != "handle": w, h = h, w
    cols = ((im, f"Чертёж Aristo, стр. {page_no} + наш контур (красный)"), (end, "Наша 3D-модель: торец"), (iso, "Наша 3D-модель: отрезок"))
    note = f"Источник: «Схемы сборки систем ARISTO», grouppartner.ru · контур снят с векторного PDF · {dim}"
    cw = [max(img.width, int(F(22, True).getlength(cap)) + 10) for img, cap in cols]
    W = max(sum(cw) + 80, int(F(18).getlength(note)) + 40)
    H = max(im.height, end.height, iso.height) + 170
    sh = Image.new("RGB", (W, H), "white"); dd = ImageDraw.Draw(sh)
    dd.text((20, 16), f"{title} · {w:.1f} × {h:.1f} мм".replace(".", ","), font=F(34, True), fill="#1d2b3a")
    x = 20
    for (img, cap), c in zip(cols, cw):
        sh.paste(img, (x + (c - img.width) // 2, 120)); dd.text((x, 76), cap, font=F(22, True), fill="#2449d6"); x += c + 20
    dd.text((20, H - 40), note, font=F(18), fill="#4d6370")
    path = os.path.join(OUT, f"{name}_model.png"); sh.save(path); return path


for n in (sys.argv[4:] or P.keys()):
    print(sheet(n))
