# -*- coding: utf-8 -*-
# Drawings of the sliding door profile sections used for the 3D models: py -3 scripts/draw_kupe_sections.py <kupe_assets_dir> <catalog_page_png> <out_dir>
# Each sheet: our section to scale with overall sizes, the catalogue picture it was drawn from, and where every number comes from.
import os, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kupe_profile_shapes import SHAPES

ASSETS, PAGE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
FONT = "C:/Windows/Fonts/arial.ttf"
FONTB = "C:/Windows/Fonts/arialbd.ttf"
f = lambda s, b=False: ImageFont.truetype(FONTB if b else FONT, s)

INFO = {
    "handle_c": dict(title="Профиль-ручка C", ref="standart-c.jpg", axes=("ширина на фасаде", "глубина, сверху лицевая сторона"),
        source=["Форма: по картинке «Стандарт C» из калькулятора купе (assets/sections/standart-c.jpg).",
                "Ширина 30 мм — из прайса калькулятора купе (frameSide системы «Стандарт»).",
                "Глубина 32 мм, толщины стенок 1,4–1,6 мм, паз под вставку 10 мм — подобраны на глаз, не из каталога."],
        systems="Стандарт C, Эконом C, а также FUSION, SMART, AVERS, Эконом H и O — у них в каталоге своя форма, здесь упрощённо как C."),
    "handle_i": dict(title="Профиль-ручка I / FLAT", ref="standart-i.jpg", axes=("ширина на фасаде", "глубина, сверху лицевая сторона"),
        source=["Форма: по картинке «Стандарт I» (assets/sections/standart-i.jpg).",
                "Ширина 30 мм — из прайса (у «Стандарт Декор» в прайсе 40, модель растягивается до 40).",
                "Глубина 26 мм и стенки — на глаз."],
        systems="Стандарт I, Эконом FLAT, Стандарт Декор (FLAT)."),
    "handle_slim": dict(title="Профиль-ручка SLIM", ref="slim-fine.jpg", axes=("ширина на фасаде", "глубина, сверху лицевая сторона"),
        source=["Форма: по картинке «Slim Fine» (assets/sections/slim-fine.jpg); на ней подписаны 5 мм и 9,5 мм.",
                "Ширина 12 мм — из прайса (frameSide систем Slim, GRACE).",
                "Глубина 22 мм — на глаз. Размеры 5 и 9,5 мм с картинки в модель НЕ перенесены."],
        systems="Slim line, Slim Fine, Slim MAX, Slim Декор, GRACE, NOVA (в прайсе 16 мм) и TWELVE (в прайсе 30 мм — попал сюда ошибочно)."),
    "frame": dict(title="Рамка верхняя и нижняя", ref=None, axes=("высота рамки", "глубина, сверху лицевая сторона"),
        source=["Картинки сечения нет. Высота 40 мм — из прайса (frameTop/frameBot).",
                "Глубина 16 мм, коробчатая форма и паз 10 мм — условные."],
        systems="Все системы."),
    "divider": dict(title="Разделитель вставок", ref=None, axes=("высота", "глубина, сверху лицевая сторона"),
        source=["Картинки сечения нет. Высота 20 мм — из прайса (divider).",
                "H-форма с двумя пазами под вставки 10 мм, глубина 14 мм — условные."],
        systems="Все системы с секциями."),
    "track_top": dict(title="Направляющая верхняя", ref="page", swap=True, axes=("ширина поперёк проёма", "высота, сверху потолок"),
        source=["Габарит 81,6 × 35 мм — техкаталог Аристо, стр. 3, «открытая установка верхней направляющей».",
                "Внутренние перегородки (два канала под два ряда дверей) — условные, в каталоге не прорисованы."],
        systems="Все раздвижные и подвесные системы."),
    "track_bottom": dict(title="Направляющая нижняя", ref=None, swap=True, axes=("ширина поперёк проёма", "высота, внизу пол"),
        source=["Ширина 81,6 мм — принята как у верхней. Высота 10 мм — по зазору «10 мм от пола» на стр. 3 техкаталога.",
                "Два рельса со скруглением под ролики — условные."],
        systems="Все раздвижные системы (у GRACE нижней направляющей нет)."),
}


def draw_section(name, info):
    polys = SHAPES[name]()
    if info.get("swap"):
        polys = [[(b, a) for a, b in poly] for poly in polys]
    pts = [p for poly in polys for p in poly]
    a0, a1 = min(p[0] for p in pts), max(p[0] for p in pts)
    b0, b1 = min(p[1] for p in pts), max(p[1] for p in pts)
    W, H = 1500, 900
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    d.text((40, 28), info["title"], font=f(34, True), fill="#1d2b3a")
    d.text((40, 74), "Сечение модели для 3D (мм). Упрощённая форма, НЕ заводской чертёж Аристо.", font=f(20), fill="#b3261e")
    # our section, to scale, inside the left box
    box = (60, 140, 760, 700)
    span = max(a1 - a0, b1 - b0)
    k = min((box[2] - box[0] - 160) / (a1 - a0), (box[3] - box[1] - 160) / (b1 - b0))
    ox = box[0] + 90 + ((box[2] - box[0] - 160) - (a1 - a0) * k) / 2
    oy = box[1] + 40 + ((box[3] - box[1] - 160) - (b1 - b0) * k) / 2
    X = lambda a: ox + (a - a0) * k
    Y = lambda b: oy + (b1 - b) * k  # front (large b) at the top
    d.rectangle(box, outline="#d5dde8", width=2)
    for poly in polys:
        d.polygon([(X(a), Y(b)) for a, b in poly], fill="#9aa5ae", outline="#4d5963")
    # overall dimensions
    y_dim = Y(b0) + 50
    d.line([(X(a0), y_dim), (X(a1), y_dim)], fill="#2449d6", width=2)
    for x in (X(a0), X(a1)):
        d.line([(x, Y(b0) + 8), (x, y_dim + 8)], fill="#2449d6", width=1)
    d.text(((X(a0) + X(a1)) / 2 - 40, y_dim + 8), f"{round(a1 - a0, 1):g} мм", font=f(24, True), fill="#2449d6")
    x_dim = X(a0) - 50
    d.line([(x_dim, Y(b1)), (x_dim, Y(b0))], fill="#2449d6", width=2)
    for y in (Y(b1), Y(b0)):
        d.line([(x_dim - 8, y), (X(a0) - 8, y)], fill="#2449d6", width=1)
    d.text((x_dim - 90, (Y(b0) + Y(b1)) / 2 - 14), f"{round(b1 - b0, 1):g} мм", font=f(24, True), fill="#2449d6")
    d.text((box[0] + 10, box[3] - 32), f"по горизонтали — {info['axes'][0]}, по вертикали — {info['axes'][1]}", font=f(16), fill="#7a8b94")
    # reference picture
    rbox = (800, 140, 1440, 700)
    d.rectangle(rbox, outline="#d5dde8", width=2)
    d.text((rbox[0] + 10, rbox[1] + 8), "Откуда форма:", font=f(20, True), fill="#1d2b3a")
    ref = None
    if info["ref"] == "page":
        page = Image.open(PAGE).convert("RGB")
        ref = page.crop((70, 270, 240, 380)).resize((510, 330))
        caption = "Техкаталог Аристо, стр. 3 (фрагмент)"
    elif info["ref"]:
        ref = Image.open(os.path.join(ASSETS, info["ref"])).convert("RGB")
        ref.thumbnail((600, 480))
        caption = "Калькулятор купе: assets/sections/" + info["ref"]
    if ref:
        img.paste(ref, (rbox[0] + (rbox[2] - rbox[0] - ref.width) // 2, rbox[1] + 45))
        d.text((rbox[0] + 10, rbox[3] - 32), caption, font=f(16), fill="#7a8b94")
    else:
        d.text((rbox[0] + 30, rbox[1] + 250), "Картинки сечения в каталоге нет —\nформа условная", font=f(26), fill="#b3261e")
    # sources
    y = 720
    for line in info["source"]:
        d.text((60, y), "• " + line, font=f(19), fill="#1d2b3a"); y += 30
    d.text((60, y + 6), "Системы: " + info["systems"], font=f(19, True), fill="#2449d6")
    path = os.path.join(OUT, f"{name}.png")
    img.save(path)
    return path


paths = [draw_section(n, i) for n, i in INFO.items()]
print("\n".join(paths))
