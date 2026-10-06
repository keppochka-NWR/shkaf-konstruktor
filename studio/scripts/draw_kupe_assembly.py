# -*- coding: utf-8 -*-
# Vertical section of the studio's sliding doors (from kupeParts) next to the factory vertical section: checks how profiles are placed.
# npx tsx scripts/dump-kupe-parts.ts parts.json; py -3 scripts/draw_kupe_assembly.py parts.json <ARISTO-Systems-Drawing.pdf> <out.png>
import io, json, os, sys
import fitz
from PIL import Image, ImageChops, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kupe_profile_shapes import FACTORY_NAMES, loops

PARTS, PDF, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(PARTS, encoding="utf-8"))
H, D = data["height"], data["depth"]
FONT, FONTB = "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"
f = lambda s, b=False: ImageFont.truetype(FONTB if b else FONT, s)


def side_loops(p):
    """Loops of a part running along X, seen from the side: (z, y) in mm, the same way Scene.fitProfile places the model."""
    name = os.path.basename(p["model"]["file"]).replace(".glb", "")
    if name not in FACTORY_NAMES: return None
    ls = loops(name)
    a = [q[0] for l in ls for q in l]; b = [q[1] for l in ls for q in l]
    a0, a1, b0, b1 = min(a), max(a), min(b), max(b)
    (sx, sy, sz), (px, py, pz) = p["size"], p["position"]
    mirror = p["model"].get("mirror")
    out = []
    for l in ls:
        pts = []
        for aa, bb in l:
            t = (aa - a0) / (a1 - a0)
            y = (py - sy / 2 + t * sy) if mirror else (py + sy / 2 - t * sy)
            z = pz - sz / 2 + (bb - b0) / (b1 - b0) * sz
            pts.append((z, y))
        out.append(pts)
    return out


def render(y_lo, y_hi, title):
    k = 9.0
    W, Hh = int(D * k) + 120, int((y_hi - y_lo) * k) + 90
    img = Image.new("RGB", (W, Hh), "white"); d = ImageDraw.Draw(img)
    X = lambda z: 60 + z * k
    Y = lambda y: 60 + (y_hi - y) * k
    d.text((10, 10), title, font=f(20, True), fill="#1d2b3a")
    d.rectangle((X(0), Y(y_hi), X(D), Y(y_lo)), outline="#d5dde8")
    mask = Image.new("1", img.size, 0)
    for p in data["parts"]:
        (sx, sy, sz), (px, py, pz) = p["size"], p["position"]
        if py + sy / 2 < y_lo or py - sy / 2 > y_hi: continue
        if ":fill:" in p["id"] and p["id"].startswith("kupe:"):
            d.rectangle((X(pz - sz / 2), Y(min(py + sy / 2, y_hi)), X(pz + sz / 2), Y(max(py - sy / 2, y_lo))), fill="#7cc242")
            continue
        if ":side:" in p["id"]:  # handle: only its outline in this view
            d.rectangle((X(pz - sz / 2), Y(min(py + sy / 2, y_hi)), X(pz + sz / 2), Y(max(py - sy / 2, y_lo))), outline="#c0392b")
            continue
        if not p.get("model") or p["model"]["length"] != "x": continue
        sl = side_loops(p)
        if not sl: continue
        for l in sl:
            m = Image.new("1", img.size, 0); ImageDraw.Draw(m).polygon([(X(z), Y(y)) for z, y in l], fill=1); mask = ImageChops.logical_xor(mask, m)
    img.paste(Image.new("RGB", img.size, "#9aa5ae"), mask=mask)
    d.text((10, Hh - 26), "зелёное — вставка, красная рамка — габарит ручки C; слева — задняя сторона, справа — комната", font=f(13), fill="#7a8b94")
    return img


top = render(H - 80, H, "Студия: верх (разрез сбоку)")
bot = render(0, 90, "Студия: низ (разрез сбоку)")
doc = fitz.open(PDF); page = doc[3]
pdf_top = Image.open(io.BytesIO(page.get_pixmap(clip=fitz.Rect(270, 85, 410, 190), dpi=500).tobytes("png"))).convert("RGB")
pdf_bot = Image.open(io.BytesIO(page.get_pixmap(clip=fitz.Rect(270, 255, 410, 370), dpi=500).tobytes("png"))).convert("RGB")
for im in (pdf_top, pdf_bot): im.thumbnail((top.width, 900))
Wt = top.width + max(pdf_top.width, pdf_bot.width) + 60
Ht = 70 + max(top.height, pdf_top.height) + 30 + max(bot.height, pdf_bot.height) + 20
sheet = Image.new("RGB", (Wt, Ht), "white"); d = ImageDraw.Draw(sheet)
d.text((20, 18), f"Купе в студии против чертежа Aristo, стр. 4 (вертикальное сечение) · {data['system']}", font=f(24, True), fill="#1d2b3a")
y = 70
sheet.paste(top, (20, y)); sheet.paste(pdf_top, (top.width + 40, y)); y += max(top.height, pdf_top.height) + 30
sheet.paste(bot, (20, y)); sheet.paste(pdf_bot, (top.width + 40, y))
sheet.save(OUT); print("saved", OUT)
