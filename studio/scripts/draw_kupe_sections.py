# -*- coding: utf-8 -*-
# Sheets of the sliding door profile sections used for the 3D models: py -3 scripts/draw_kupe_sections.py <ARISTO-Systems-Drawing.pdf> <out_dir>
# Factory sections: our contour (from aristo_sections.json) next to the same place of the factory drawing, with the source page and scale.
# Approximate sections (no drawing yet): clearly marked as such.
import io, os, sys
import fitz
from PIL import Image, ImageChops, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kupe_profile_shapes import FACTORY, SHAPES, loops

PDF, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
doc = fitz.open(PDF)
FONT, FONTB = "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"
f = lambda s, b=False: ImageFont.truetype(FONTB if b else FONT, s)
DOC = "«СХЕМЫ СБОРКИ СИСТЕМ ARISTO» (grouppartner.ru/upload/catalogs/ARISTO-Systems-Drawing.pdf)"

# name: title, page, path index in page.get_drawings() (same as extract_aristo_sections.py), crop margin (pt), scale note, axes, systems
INFO = {
    "handle_c": dict(title="Профиль-ручка C", page=4, path=495, margin=(30, 30, 30, 30),
        scale="Масштаб по размеру «26» над профилем на горизонтальном сечении.",
        axes=("ширина на фасаде, слева внешний край двери", "глубина, сверху лицевая сторона"),
        systems="Стандарт C, Эконом C. FUSION, SMART, AVERS, TWELVE, Эконом O пока показаны этой же моделью."),
    "handle_h": dict(title="Профиль-ручка H", page=5, path=21, margin=(30, 30, 30, 30),
        scale="Масштаб по размеру «35,2» над профилем на горизонтальном сечении.",
        axes=("ширина на фасаде, слева внешний край двери", "глубина, сверху лицевая сторона"),
        systems="Эконом H."),
    "frame_top": dict(title="Рамка верхняя", page=4, path=408, margin=(40, 30, 40, 30),
        scale="Масштаб по размерам «39» (между рядами) и «56» на вертикальном сечении.",
        axes=("глубина", "высота рамки"), systems="Модели C и H."),
    "frame_bottom": dict(title="Рамка нижняя", page=4, path=412, margin=(40, 30, 40, 30),
        scale="Масштаб по размерам «39» и «56» на вертикальном сечении (56 — высота нижней рамки).",
        axes=("глубина", "высота рамки"), systems="Модели C и H."),
    "track_top": dict(title="Направляющая верхняя", page=4, path=470, margin=(30, 30, 30, 30),
        scale="Масштаб по размерам «39» и «56»; высота сходится с размером «40» на чертеже.",
        axes=("глубина (поперёк проёма)", "высота"), systems="Все раздвижные и подвесные системы."),
    "track_bottom": dict(title="Направляющая нижняя", page=4, path=431, margin=(30, 30, 30, 30),
        scale="Масштаб по размерам «39» и «56»; высота сходится с размером «8» на чертеже.",
        axes=("глубина (поперёк проёма)", "высота, внизу пол"), systems="Все раздвижные системы (у GRACE нижней нет)."),
}
APPROX = {
    "handle_i": ("Профиль-ручка I / FLAT", "Стандарт I, Эконом FLAT, Стандарт Декор"),
    "handle_slim": ("Профиль-ручка SLIM", "Slim line, Slim Fine, Slim MAX, Slim Декор, GRACE, NOVA"),
    "divider": ("Разделитель вставок", "Все системы с секциями"),
}


def view(name):
    """Loops as they look on the drawing: handles as is (horizontal section); frames and tracks with depth across and height up."""
    ls = loops(name)
    if name.startswith("handle"): return ls
    if name == "frame_top": return [[(b, -a) for a, b in l] for l in ls]
    return [[(b, a) for a, b in l] for l in ls]


def bounds(ls):
    pts = [p for l in ls for p in l]
    return min(p[0] for p in pts), max(p[0] for p in pts), min(p[1] for p in pts), max(p[1] for p in pts)


def draw_loops(img, ls, X, Y):
    """Even-odd fill: every loop toggles the mask, so chambers stay white."""
    mask = Image.new("1", img.size, 0)
    for l in ls:
        m = Image.new("1", img.size, 0)
        ImageDraw.Draw(m).polygon([(X(a), Y(b)) for a, b in l], fill=1)
        mask = ImageChops.logical_xor(mask, m)
    img.paste(Image.new("RGB", img.size, "#9aa5ae"), mask=mask)
    d = ImageDraw.Draw(img)
    for l in ls:
        d.line([(X(a), Y(b)) for a, b in l] + [(X(l[0][0]), Y(l[0][1]))], fill="#3d4851", width=2)


def section_box(img, ls, box, label_axes=None):
    d = ImageDraw.Draw(img)
    a0, a1, b0, b1 = bounds(ls)
    k = min((box[2] - box[0] - 200) / (a1 - a0), (box[3] - box[1] - 170) / (b1 - b0))
    ox = box[0] + 120 + ((box[2] - box[0] - 200) - (a1 - a0) * k) / 2
    oy = box[1] + 30 + ((box[3] - box[1] - 170) - (b1 - b0) * k) / 2
    X = lambda a: ox + (a - a0) * k
    Y = lambda b: oy + (b1 - b) * k
    d.rectangle(box, outline="#d5dde8", width=2)
    draw_loops(img, ls, X, Y)
    y_dim = Y(b0) + 45
    d.line([(X(a0), y_dim), (X(a1), y_dim)], fill="#2449d6", width=2)
    for x in (X(a0), X(a1)): d.line([(x, Y(b0) + 6), (x, y_dim + 8)], fill="#2449d6", width=1)
    d.text(((X(a0) + X(a1)) / 2 - 45, y_dim + 8), f"{a1 - a0:.1f} мм".replace(".", ","), font=f(24, True), fill="#2449d6")
    x_dim = X(a0) - 45
    d.line([(x_dim, Y(b1)), (x_dim, Y(b0))], fill="#2449d6", width=2)
    for y in (Y(b1), Y(b0)): d.line([(x_dim - 8, y), (X(a0) - 6, y)], fill="#2449d6", width=1)
    d.text((x_dim - 105, (Y(b0) + Y(b1)) / 2 - 14), f"{b1 - b0:.1f} мм".replace(".", ","), font=f(24, True), fill="#2449d6")
    if label_axes:
        d.text((box[0] + 10, box[3] - 30), f"→ {label_axes[0]};  ↑ {label_axes[1]}", font=f(15), fill="#7a8b94")


def pdf_crop(page_no, path_index, margin, size):
    page = doc[page_no - 1]
    r = fitz.Rect(page.get_drawings()[path_index]["rect"])
    clip = fitz.Rect(r.x0 - margin[0], r.y0 - margin[1], r.x1 + margin[2], r.y1 + margin[3])
    pix = page.get_pixmap(clip=clip, dpi=600)
    im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    im.thumbnail(size)
    return im


def factory_sheet(name, info):
    W, H = 1500, 900
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    d.text((40, 26), info["title"], font=f(34, True), fill="#1d2b3a")
    d.text((40, 72), "Сечение по заводскому чертежу Aristo: векторный контур из PDF, масштаб по размерам чертежа.", font=f(20), fill="#1a7f37")
    section_box(img, view(name), (40, 130, 760, 700), info["axes"])
    rbox = (790, 130, 1460, 700)
    d.rectangle(rbox, outline="#d5dde8", width=2)
    d.text((rbox[0] + 12, rbox[1] + 10), f"Чертёж: стр. {info['page']} (фрагмент)", font=f(20, True), fill="#1d2b3a")
    ref = pdf_crop(info["page"], info["path"], info["margin"], (rbox[2] - rbox[0] - 40, rbox[3] - rbox[1] - 70))
    img.paste(ref, (rbox[0] + (rbox[2] - rbox[0] - ref.width) // 2, rbox[1] + 50))
    y = 722
    for line in ["Источник: " + DOC + f", стр. {info['page']}.", info["scale"], FACTORY[name]["note"]]:
        d.text((40, y), "• " + line, font=f(18), fill="#1d2b3a"); y += 30
    d.text((40, y + 4), "Системы: " + info["systems"], font=f(19, True), fill="#2449d6")
    path = os.path.join(OUT, f"{name}.png"); img.save(path); return path


def approx_sheet(name, title, systems):
    W, H = 1500, 820
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    d.text((40, 26), title, font=f(34, True), fill="#1d2b3a")
    d.text((40, 72), "УПРОЩЁННАЯ форма: заводского чертежа этого профиля пока нет. Нужна техкарта поставщика.", font=f(20), fill="#b3261e")
    polys = SHAPES[name]()
    # approx shapes are overlapping solids: fill each, no holes
    a0, a1, b0, b1 = bounds(polys)
    box = (40, 130, 900, 700); k = min((box[2] - box[0] - 200) / (a1 - a0), (box[3] - box[1] - 170) / (b1 - b0))
    ox, oy = box[0] + 120, box[1] + 30
    d.rectangle(box, outline="#d5dde8", width=2)
    for p in polys: d.polygon([(ox + (a - a0) * k, oy + (b1 - b) * k) for a, b in p], fill="#c9cfd4", outline="#7a8b94")
    d.text((ox, oy + (b1 - b0) * k + 20), f"{a1 - a0:.1f} × {b1 - b0:.1f} мм".replace(".", ","), font=f(24, True), fill="#2449d6")
    d.text((40, 730), "Системы: " + systems, font=f(19, True), fill="#2449d6")
    path = os.path.join(OUT, f"{name}.png"); img.save(path); return path


def overview():
    """All factory sections on one sheet, same scale."""
    W, H = 1800, 1220
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    d.text((40, 24), "Сечения купе Aristo в 3D-студии — все по заводскому чертежу, один масштаб", font=f(32, True), fill="#1d2b3a")
    d.text((40, 70), "Источник: " + DOC, font=f(18), fill="#4d6370")
    k = 9.0  # px per mm
    cells = [("handle_c", 40, 130), ("handle_h", 420, 130), ("frame_top", 900, 130), ("frame_bottom", 1200, 130),
             ("track_top", 40, 760), ("track_bottom", 1000, 760)]
    for name, x, y in cells:
        ls = view(name); a0, a1, b0, b1 = bounds(ls)
        d.text((x, y), INFO[name]["title"] + f" · стр. {INFO[name]['page']}", font=f(20, True), fill="#1d2b3a")
        X = lambda a, x=x, a0=a0: x + 10 + (a - a0) * k
        Y = lambda b, y=y, b1=b1: y + 40 + (b1 - b) * k
        draw_loops(img, ls, X, Y)
        d.text((x, Y(b0) + 10), f"{a1 - a0:.1f} × {b1 - b0:.1f} мм".replace(".", ","), font=f(18), fill="#2449d6")
    path = os.path.join(OUT, "overview.png"); img.save(path); return path


paths = [factory_sheet(n, i) for n, i in INFO.items()]
paths += [approx_sheet(n, t, s) for n, (t, s) in APPROX.items()]
paths.append(overview())
print("\n".join(paths))
