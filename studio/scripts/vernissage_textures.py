# -*- coding: utf-8 -*-
"""Текстуры плёнок Вернисажа для 3D (разрешение Макса 10.10.2026: брать с vernisag-fasad.ru).

Источники (все — сайт vernisag-fasad.ru):
  1) карточки фрезеровок (URL из vernissage-millings.json): у каждой карточки фото фасада в каждом декоре, title картинки = название
     декора. Фото 830×1500 — фасад 396×716 мм (масштаб 0,49 мм/px: край фасада x≈13, паз №3 в 81 мм — x≈175). Берём квадрат с поля
     фасада без фрезеровки, выше логотипа-водяного знака (полоса y 1080–1290) и ниже ленты «Хит продаж» (правый верхний угол):
     №15 «мыло» (гладкий) и W2 (паз в 20 мм) — 700 px; №1, 3, 20, 18 — 510 px внутри контура паза.
  2) новости о плёнках с подписанными образцами (2026: «Древесные» — Дуб узелковый, Тамо, Этимое, Императорское дерево тёмное, Тик;
     «Кобра» — бронза/золото) — квадрат внутри образца без подписи.
  3) однотонные (софт, глянец, моно, Сиена, Твил, ПЭТ «Монблан») — текстуры не делаем: цвет 3D = средний цвет образца
     (карточка, плакат «Сиена», «Твил», «Монблан»).
Подготовка: квадрат → выравнивание освещения (деление на сильное размытие) → бесшовность (сдвиг на полкадра и смешивание к краям) →
512–1024 px, JPEG 80 %. Скачанное (по картинке на декор) — в <Вернисаж>/textures (новая папка), готовое — studio/public/textures/vernissage.
Манифест — src/vernissageTextures.ts.
Запуск: py -I scripts/vernissage_textures.py <папка Вернисаж> <папка studio> [папка-кэш html]"""
import json, sys, os, re, time, html, shutil, urllib.request
import numpy as np
from PIL import Image, ImageFilter

VERN, STUDIO = sys.argv[1], sys.argv[2]
CACHE = sys.argv[3] if len(sys.argv) > 3 else os.path.join(VERN, 'textures', '_cache')
RAW = os.path.join(VERN, 'textures')
OUT = os.path.join(STUDIO, 'public', 'textures', 'vernissage')
os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
for _f in os.listdir(OUT):  # готовые текстуры пересобираются целиком
    if _f.endswith('.jpg'):
        os.remove(os.path.join(OUT, _f))
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
MM_PER_PX_CARD = 716 / 1460  # фасад 396×716 мм на фото 830×1500


def get(url, path):
    if not os.path.exists(path) or os.path.getsize(path) < 200:
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        open(path, 'wb').write(data); time.sleep(0.25)
    return path


def norm(s):
    return re.sub(r'\s+', ' ', s.lower().replace('ё', 'е')).strip()


TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя', ['a', 'b', 'v', 'g', 'd', 'e', 'e', 'zh', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f', 'h', 'c', 'ch', 'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya']))
def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', ''.join(TR.get(c, c) for c in s.lower()))).strip('-')


# ---------- названия плёнок студии ----------
data_ts = open(os.path.join(STUDIO, 'src', 'vernissageData.ts'), encoding='utf-8').read()
V_FILMS = json.loads(re.search(r'export const V_FILMS:VFilmRow\[\]=(\[.*?\]);\n', data_ts).group(1))
PET = json.loads(re.search(r'export const V_PET_DECORS:string\[\]=(\[.*?\]);\n', data_ts).group(1))
films = {norm(f['name']): f['name'] for f in V_FILMS}

# ---------- 1) карточки фрезеровок ----------
mill = json.load(open(os.path.join(VERN, 'vernissage-millings.json'), encoding='utf-8'))
cards = [(it['id'], it['url']) for it in mill['items'] if it.get('url')]
site = {}  # норм. название -> [(фрезеровка, url картинки)]
for mid, url in cards:
    p = get(url, os.path.join(CACHE, 'card-' + mid.replace('/', '_') + '.html'))
    t = open(p, encoding='utf-8', errors='replace').read()
    for tag in re.findall(r'<img[^>]*data-src="[^"]+"[^>]*>', t):
        u = re.search(r'data-src="([^"]+)"', tag).group(1)
        ti = re.search(r'title="([^"]*)"', tag)
        w = re.search(r'width="(\d+)"', tag)
        if not ti or not w or w.group(1) != '830' or '/styles/' in u:
            continue
        site.setdefault(norm(html.unescape(ti.group(1))), []).append((mid, u))
# окно поля фасада: x0, y0, сторона (px фото 830×1500)
WIN = {'15': (65, 300, 700), 'W2': (60, 300, 700), '1': (200, 390, 480), '3': (200, 390, 480), '20': (190, 390, 480), '18': (290, 300, 510)}
ORDER = ['15', 'W2', '1', '3', '20', '18']

# ---------- 2) образцы в новостях (подписанные квадраты) ----------
NEWS = 'https://vernisag-fasad.ru/sites/default/files/tmp/'
POSTER = {
    'Дуб узелковый тёмный': ('dub_uz_0.png', (460, 80, 360), '/trendovye-novinki-plyonka-pvh-drevesnye'),
    'Дуб узелковый натуральный': ('dub_uz_0.png', (940, 80, 360), '/trendovye-novinki-plyonka-pvh-drevesnye'),
    'Дуб узелковый светлый': ('dub_uz_0.png', (1430, 80, 360), '/trendovye-novinki-plyonka-pvh-drevesnye'),
    'Тамо': ('dub_uz_0.png', (70, 718, 420), '/trendovye-novinki-plyonka-pvh-drevesnye'),
    'Тамо беж': ('dub_uz_0.png', (543, 718, 400), '/trendovye-novinki-plyonka-pvh-drevesnye'),
    'Императорское дерево тёмное': ('etim_0.png', (720, 75, 360), '/trendovye-novinki-plyonka-pvh-drevesnye'),
    'Этимое светлый': ('etim_0.png', (90, 710, 400), '/trendovye-novinki-plyonka-pvh-drevesnye'),
    'Этимое натуральный': ('etim_0.png', (580, 710, 400), '/trendovye-novinki-plyonka-pvh-drevesnye'),
    'Тик медовый': ('tik.png', (940, 160, 400), '/trendovye-novinki-plyonka-pvh-drevesnye'),
    'Тик': ('tik.png', (1420, 160, 400), '/trendovye-novinki-plyonka-pvh-drevesnye'),
    'Кобра золото': ('kobra_rassylka_5.png', (120, 100, 470), '/kobra-pvh-novinka'),
    'Кобра бронза': ('kobra_rassylka_5.png', (120, 690, 470), '/kobra-pvh-novinka'),
}
POSTER_TILE_MM = 350  # масштаб образца в новости не указан — условно, как поле фасада на карточке

# ---------- 3) однотонные: цвет образца ----------
SWATCH = {
    'Сиена верде': ('dizayn_bez_nazvaniya_29_0.png', (170, 130, 360, 450)), 'Сиена гриджио': ('dizayn_bez_nazvaniya_29_0.png', (420, 130, 610, 450)),
    'Сиена скай': ('dizayn_bez_nazvaniya_29_0.png', (670, 130, 860, 450)), 'Сиена тауп': ('dizayn_bez_nazvaniya_29_0.png', (920, 130, 1110, 450)),
    'Сиена лен': ('dizayn_bez_nazvaniya_29_0.png', (1166, 130, 1350, 450)), 'Сиена бьянка': ('dizayn_bez_nazvaniya_29_0.png', (1420, 130, 1780, 450)),
    'Твил изумруд': ('tvil.png', (20, 320, 180, 660)), 'Твил деним': ('tvil.png', (220, 320, 380, 660)), 'Твил лён': ('tvil.png', (420, 320, 580, 660)),
    'Твил беж': ('tvil.png', (620, 320, 780, 660)), 'Твил флай': ('tvil.png', (820, 320, 980, 660)),
    # ПЭТ «Монблан» — плакат коллекции
    # на плакате «Лаура», в прайсе «Луара» — один декор
    'Луара': ('stranica_1_1.png', (300, 400, 540, 470)), 'Лата': ('stranica_1_1.png', (300, 580, 540, 650)), 'Римо': ('stranica_1_1.png', (300, 760, 540, 830)),
    'Этна': ('stranica_1_1.png', (300, 940, 540, 1010)), 'Перье': ('stranica_1_1.png', (300, 1120, 540, 1190)), 'Бенталь': ('stranica_1_1.png', (600, 450, 840, 1150)),
    'Бланик': ('stranica_1_1.png', (900, 450, 1160, 1150)), 'Нике': ('stranica_1_1.png', (1220, 450, 1480, 1150)),
}
SWATCH_PAGE = {'dizayn_bez_nazvaniya_29_0.png': '/novinka-pvh-siena', 'tvil.png': '/new_tvil_novost', 'stranica_1_1.png': '/preimushestva-premium-pet'}


def mean_hex(im):
    a = np.asarray(im.convert('RGB'), dtype=float).reshape(-1, 3).mean(axis=0)
    return '#%02x%02x%02x' % tuple(int(round(v)) for v in a)


def texture_score(sq):
    """Сила рисунка: СКО яркости после вычитания размытия (мелкие детали), на 512 px; без градиента освещения."""
    g = sq.convert('L').resize((512, 512), Image.LANCZOS)
    a = np.asarray(g, dtype=float); b = np.asarray(g.filter(ImageFilter.GaussianBlur(6)), dtype=float)
    return float((a - b).std())


def prepare(sq):
    """Выровнять освещение и сделать бесшовной; 512–1024 px."""
    n = sq.width
    a = np.asarray(sq.convert('RGB'), dtype=float)
    blur = np.asarray(sq.convert('RGB').filter(ImageFilter.GaussianBlur(n / 6)), dtype=float)
    flat = np.clip(a / np.maximum(blur, 1) * a.reshape(-1, 3).mean(axis=0), 0, 255)
    # бесшовность: смешать со сдвигом на полкадра, вес сдвинутого — к краям (по каждой оси)
    t = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n / 2)  # 0 у края, 1 в центре
    wv = np.clip(t / 0.35, 0, 1)
    w2 = np.minimum.outer(wv, wv)[..., None]
    rolled = np.roll(np.roll(flat, n // 2, axis=0), n // 2, axis=1)
    out = flat * w2 + rolled * (1 - w2)
    im = Image.fromarray(out.astype(np.uint8))
    size = min(1024, max(512, n))
    return im.resize((size, size), Image.LANCZOS) if size != n else im


index, manifest, colors, report = [], {}, {}, []
for f in V_FILMS:
    name, key = f['name'], norm(f['name'])
    sl = slug(name)
    if name in POSTER or key in {norm(k) for k in POSTER}:
        pk = next(k for k in POSTER if norm(k) == key)
        fn, (x0, y0, s), page = POSTER[pk]
        src = get(NEWS + fn, os.path.join(CACHE, 'news_' + fn))
        raw = os.path.join(RAW, sl + os.path.splitext(fn)[1])
        shutil.copyfile(src, raw)
        sq = Image.open(src).convert('RGB').crop((x0, y0, x0 + s, y0 + s))
        score = texture_score(sq)
        prepare(sq).save(os.path.join(OUT, sl + '.jpg'), quality=80)
        manifest[name] = {'file': sl + '.jpg', 'tileMm': POSTER_TILE_MM, 'src': NEWS + fn, 'page': 'https://vernisag-fasad.ru' + page, 'crop': [x0, y0, s], 'score': round(score, 2), 'scale': 'условно'}
        index.append((name, 'poster', NEWS + fn, f'{x0},{y0},{s}', round(score, 2), 'texture'))
        continue
    cand = sorted((x for x in site.get(key, []) if x[0] in WIN), key=lambda x: ORDER.index(x[0]))
    if not cand:
        if name in SWATCH or key in {norm(k) for k in SWATCH}:
            continue  # ниже, цвет
        report.append((name, f['cat'], 'нет образца на сайте'))
        continue
    mid, u = cand[0]
    ext = os.path.splitext(u.split('?')[0])[1].lower() or '.jpg'
    raw = os.path.join(RAW, sl + ext)
    get(u, raw)
    im = Image.open(raw).convert('RGB')
    if im.size != (830, 1500):
        im = im.resize((830, 1500), Image.LANCZOS)
    x0, y0, s = WIN[mid]
    if mid in ('1', '3', '20'):
        # контур паза на фото чуть гуляет — ищем его: самые резкие перепады яркости столбцов слева (100–300) и справа (560–790)
        g = np.asarray(im.convert('L'), dtype=float)[400:900]
        prof = g.mean(axis=0); hp = np.abs(prof - np.convolve(prof, np.ones(9) / 9, mode='same'))
        left = 100 + int(np.argmax(hp[100:300])); right = 560 + int(np.argmax(hp[560:790]))
        s = min(510, right - left - 80); x0 = (left + right) // 2 - s // 2
    sq = im.crop((x0, y0, x0 + s, y0 + s))
    score = texture_score(sq)
    col = mean_hex(sq)
    index.append((name, 'card №' + mid, u, f'{x0},{y0},{s}', round(score, 2), ''))
    manifest[name] = {'file': sl + '.jpg', 'tileMm': round(s * MM_PER_PX_CARD), 'src': u, 'page': dict(cards)[mid], 'crop': [x0, y0, s], 'score': round(score, 2), 'color': col, '_sq': sq}

for name, (fn, box) in SWATCH.items():
    src = get(NEWS + fn, os.path.join(CACHE, 'news_' + fn))
    real = next((f['name'] for f in V_FILMS if norm(f['name']) == norm(name)), None) or (name if name in PET else None)
    if not real:
        continue
    sl = slug(real)
    shutil.copyfile(src, os.path.join(RAW, sl + os.path.splitext(fn)[1]))
    colors[real] = {'color': mean_hex(Image.open(src).crop(box)), 'src': NEWS + fn, 'page': 'https://vernisag-fasad.ru' + SWATCH_PAGE[fn]}
    index.append((real, 'swatch', NEWS + fn, ','.join(map(str, box)), '', 'color'))

json.dump({k: {kk: vv for kk, vv in v.items() if kk != '_sq'} for k, v in manifest.items()}, open(os.path.join(RAW, '_manifest_pre.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# порог «рисунок / однотонная» — по скору (см. _index.tsv); решение по карточкам
THRESH = float(os.environ.get('VTEX_THRESH', '2.0'))  # тёмные древесные дают 3, глянец/софт — до 0,7
FORCE_TEX = set(filter(None, os.environ.get('VTEX_FORCE', '').split('|')))
FORCE_COLOR = set(filter(None, os.environ.get('VTEX_COLOR', '').split('|')))
final = {}
for name, m in manifest.items():
    sq = m.pop('_sq', None)
    if sq is None:
        final[name] = m; continue
    # глянец, металлик, софт, моно — однотонные по смыслу (на фото блики и искры, не рисунок плёнки)
    plain = re.search(r'глянец|металлик|софт|моно', name, re.I) is not None
    tex = (m['score'] >= THRESH or name in FORCE_TEX) and name not in FORCE_COLOR and not plain
    if tex:
        prepare(sq).save(os.path.join(OUT, m['file']), quality=80)
        final[name] = m
    else:
        colors[name] = {'color': m['color'], 'src': m['src'], 'page': m['page']}
        p = os.path.join(OUT, m['file'])
        if os.path.exists(p):
            os.remove(p)
for i, row in enumerate(index):
    if row[1].startswith('card'):
        index[i] = row[:5] + ('texture' if row[0] in final else 'color',)

with open(os.path.join(RAW, '_index.tsv'), 'w', encoding='utf-8') as fo:
    fo.write('декор\tисточник\tURL\tквадрат x,y,сторона\tрисунок (СКО)\tв студии\n')
    for r in index:
        fo.write('\t'.join(str(x) for x in r) + '\n')
    for n, c, why in report:
        fo.write(f'{n}\tкат. {c}\t—\t—\t—\t{why}\n')

def js(x):
    return json.dumps(x, ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(STUDIO, 'src', 'vernissageTextures.ts'), 'w', encoding='utf-8', newline='\n') as fo:
    fo.write('// Сгенерировано scripts/vernissage_textures.py: образцы плёнок с vernisag-fasad.ru (разрешение Макса 10.10.2026). Не править руками.\n')
    fo.write('/** Текстура плёнки: файл в public/textures/vernissage, сторона квадрата tileMm (мм на фасаде), источник — картинка и страница сайта. */\n')
    fo.write('export type VTexture={file:string;tileMm:number;src:string;page:string;crop:number[];score:number;scale?:string;color?:string};\n')
    fo.write('export const V_TEXTURES:Record<string,VTexture>=' + js(final) + ';\n')
    fo.write('/** Однотонные плёнки и ПЭТ: средний цвет образца с сайта (карточка или плакат) — цвет в 3D вместо оценки по названию. */\n')
    fo.write('export const V_FILM_COLORS:Record<string,{color:string;src:string;page:string}>=' + js(colors) + ';\n')
print('textures', len(final), 'colors', len(colors), 'no sample', len(report))
