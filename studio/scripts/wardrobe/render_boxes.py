# -*- coding: utf-8 -*-
"""Независимый рендер коробок панелей (эталон Базиса и шкаф студии из scripts/wardrobe/boxes.ts): спереди, 3D, крупно узел.
py scripts/wardrobe/render_boxes.py <bazis.json> <studio.json> <outDir> <prefix> [x0 y0 x1 y1 — рамка узла, мм]
Рисует: <prefix>-front.png, <prefix>-3d.png (пары «Базис | студия»), <prefix>-node-front.png, <prefix>-node-3d.png (крупно узел).
Фасады — прозрачные голубые (спереди) / скрыты (3D). Перегородка — зелёная, полки — жёлтые, опора-горизонталь студии — оранжевая."""
import json, sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

COL = {'side': (196, 210, 170), 'partition': (110, 170, 90), 'shelf': (225, 190, 110), 'support': (240, 140, 50), 'top': (190, 205, 165),
       'bottom': (190, 205, 165), 'plinth': (120, 90, 90), 'rail': (150, 120, 110), 'back': (170, 150, 130), 'facade': (150, 200, 235), 'other': (200, 200, 200)}
try:
    FONT = ImageFont.truetype('C:\\Windows\\Fonts\\arial.ttf', 16); SMALL = ImageFont.truetype('C:\\Windows\\Fonts\\arial.ttf', 13)
except Exception:
    FONT = SMALL = ImageFont.load_default()

def faces(b):
    x0, y0, z0, x1, y1, z1 = b
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    idx = [((0, 1, 2, 3), (0, 0, -1)), ((4, 5, 6, 7), (0, 0, 1)), ((0, 1, 5, 4), (0, -1, 0)), ((3, 2, 6, 7), (0, 1, 0)), ((0, 3, 7, 4), (-1, 0, 0)), ((1, 2, 6, 5), (1, 0, 0))]
    return [([v[i] for i in f], n) for f, n in idx]

def views():
    ay, ax = math.radians(-35), math.radians(22)
    def iso(q):
        x, y, z = q
        x1 = x * math.cos(ay) + z * math.sin(ay); z1 = -x * math.sin(ay) + z * math.cos(ay)
        y1 = y * math.cos(ax) - z1 * math.sin(ax); z2 = y * math.sin(ax) + z1 * math.cos(ax)
        return (x1, -y1, z2)
    return {'front': (lambda q: (q[0], -q[1], q[2])), '3d': iso}

def render(data, view, clip=None, scale=0.3, hide_facades=False, title=''):
    proj = views()[view]
    polys = []
    for p in data['panels']:
        b = list(p['box'])
        if clip:
            if b[3] <= clip[0] or b[0] >= clip[2] or b[4] <= clip[1] or b[1] >= clip[3]:
                continue
            b = [max(b[0], clip[0]), max(b[1], clip[1]), b[2], min(b[3], clip[2]), min(b[4], clip[3]), b[5]]  # вырез узла
        role = p.get('role') or 'other'
        if role == 'facade' and hide_facades:
            continue
        c = COL.get(role, COL['other'])
        for pts, n in faces(b):
            pp = [proj(q) for q in pts]
            # грань к камере: нормаль после поворота смотрит на зрителя (+z экрана)
            if proj(n)[2] <= 1e-9:
                continue
            depth = sum(q[2] for q in pp) / 4
            light = 0.62 + 0.38 * abs(n[0] * 0.3 + n[1] * 0.8 + n[2] * 0.5)
            polys.append((depth, pp, tuple(int(ch * light) for ch in c), role))
    polys.sort(key=lambda t: t[0])
    xs = [q[0] for _, pts, _, _ in polys for q in pts]; ys = [q[1] for _, pts, _, _ in polys for q in pts]
    mx, my, Mx, My = min(xs), min(ys), max(xs), max(ys)
    pad = 50
    Wd, Hd = int((Mx - mx) * scale) + 2 * pad, int((My - my) * scale) + 2 * pad + 30
    T = lambda pt: (pad + (pt[0] - mx) * scale, pad + 30 + (pt[1] - my) * scale)
    # z-буфер (без «просвечивания» граней у художника): треугольники граней, ближе — больше z; рёбра — по смене грани
    zb = np.full((Hd, Wd), -1e18); col = np.full((Hd, Wd, 3), 255, np.uint8); fid = np.full((Hd, Wd), -1, np.int32)
    for k, (_, pts, cl, role) in enumerate(polys):
        if role == 'facade':
            continue
        sp = [(*T(q), q[2]) for q in pts]
        for tri in ((sp[0], sp[1], sp[2]), (sp[0], sp[2], sp[3])):
            (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = tri
            den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
            if abs(den) < 1e-9:
                continue
            bx0, bx1 = max(0, int(min(x0, x1, x2))), min(Wd - 1, int(max(x0, x1, x2)) + 1)
            by0, by1 = max(0, int(min(y0, y1, y2))), min(Hd - 1, int(max(y0, y1, y2)) + 1)
            if bx1 < bx0 or by1 < by0:
                continue
            X, Y = np.meshgrid(np.arange(bx0, bx1 + 1) + 0.5, np.arange(by0, by1 + 1) + 0.5)
            a = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / den
            b = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / den
            g = 1 - a - b
            inside = (a >= -1e-6) & (b >= -1e-6) & (g >= -1e-6)
            z = a * z0 + b * z1 + g * z2 + (0.5 if view == 'front' else 0)
            sub = zb[by0:by1 + 1, bx0:bx1 + 1]
            win = inside & (z > sub)
            sub[win] = z[win]
            col[by0:by1 + 1, bx0:bx1 + 1][win] = cl
            fid[by0:by1 + 1, bx0:bx1 + 1][win] = k
    edge = np.zeros((Hd, Wd), bool)
    edge[:, 1:] |= fid[:, 1:] != fid[:, :-1]; edge[1:, :] |= fid[1:, :] != fid[:-1, :]
    col[edge] = (60, 60, 60)
    img = Image.fromarray(col, 'RGB').convert('RGBA')
    over = Image.new('RGBA', img.size, (0, 0, 0, 0))
    do = ImageDraw.Draw(over)
    for _, pts, cl, role in polys:
        if role == 'facade':
            do.polygon([T(q) for q in pts], fill=cl + (70,), outline=(80, 120, 160, 200))
    img = Image.alpha_composite(img, over)
    d2 = ImageDraw.Draw(img)
    d2.text((10, 8), title, fill=(0, 0, 0), font=FONT)
    # мм-сетка по высоте у кадра спереди (подписи)
    if view == 'front':
        step = 100 if clip else 500
        lo = int(math.ceil((clip[1] if clip else 0) / step) * step); hi = int((clip[3] if clip else -my) // step * step)
        for y in range(lo, hi + 1, step):
            X, Y = T((mx, -y))
            d2.text((2, Y - 7), str(y), fill=(90, 90, 90), font=SMALL)
    return img.convert('RGB')

def pair(a, b, path):
    h = max(a.height, b.height)
    img = Image.new('RGB', (a.width + b.width + 20, h), 'white')
    img.paste(a, (0, 0)); img.paste(b, (a.width + 20, 0))
    ImageDraw.Draw(img).line([(a.width + 10, 0), (a.width + 10, h)], fill=(160, 160, 160), width=2)
    img.save(path)

def main():
    bz, st, out, prefix = sys.argv[1:5]
    clip = [float(v) for v in sys.argv[5:9]] if len(sys.argv) >= 9 else None
    os.makedirs(out, exist_ok=True)
    B, S = json.load(open(bz, encoding='utf-8')), json.load(open(st, encoding='utf-8'))
    pair(render(B, 'front', title=B['title'] + ' · спереди, фасады прозрачные'), render(S, 'front', title=S['title'] + ' · спереди'), os.path.join(out, prefix + '-front.png'))
    pair(render(B, '3d', hide_facades=True, title=B['title'] + ' · 3D без фасадов'), render(S, '3d', hide_facades=True, title=S['title'] + ' · 3D без фасадов'), os.path.join(out, prefix + '-3d.png'))
    if clip:
        pair(render(B, 'front', clip, 1.2, True, 'Базис · узел перегородки, спереди'), render(S, 'front', clip, 1.2, True, 'Студия · узел перегородки, спереди'), os.path.join(out, prefix + '-node-front.png'))
        pair(render(B, '3d', clip, 1.0, True, 'Базис · узел перегородки, 3D'), render(S, '3d', clip, 1.0, True, 'Студия · узел перегородки, 3D'), os.path.join(out, prefix + '-node-3d.png'))
    print('ok', out)

main()
