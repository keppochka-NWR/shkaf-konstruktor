# -*- coding: utf-8 -*-
"""Генератор src/vernissageData.ts из разбора прайса и каталога Вернисажа.
Источник: Desktop/Claude Project/Вернисаж/vernissage-price.json и vernissage-millings.json (разбор прайса 10.08.2026 и сайта).
В студию идут только наши параметры: номера фрезеровок, серии, тип рисунка (оценка по фото каталога, без размеров), цены, названия плёнок.
Запуск: py scripts/vernissage_data.py <папка Вернисаж> <выходной .ts>"""
import json, sys, os

src, out = sys.argv[1], sys.argv[2]
price = json.load(open(os.path.join(src, 'vernissage-price.json'), encoding='utf-8'))
mill = json.load(open(os.path.join(src, 'vernissage-millings.json'), encoding='utf-8'))

SERIES_ID = {'Стандарт': 'standart', 'Оптима': 'optima', 'Престиж': 'prestige', 'Престиж (Графика)': 'prestige', 'Премиум': 'premium'}

series = []
for s in price['series']:
    series.append({
        'id': s['id'], 'name': s['name'],
        'columns': s['columns'],
        'prices': {t: {k: v for k, v in row.items() if not k.startswith('_')} for t, row in s['prices'].items()},
        'srcRows': {t: row.get('_srcRow') for t, row in s['prices'].items()},
    })

pe = next(s for s in price['series'] if s['id'] == 'prestige')['enamel']
gloss = set(pe['complex_matte_and_gloss']) | set(pe['simple'])
matte_only = set(pe['complex_matte_only'])
no_grille_enamel = set(pe['without_grilles'])
no_decor_enamel = set(pe['without_decor'])
optima_enamel = set(next(s for s in price['series'] if s['id'] == 'optima').get('enamelAllowed', []))
premium_enamel = set(next(s for s in price['series'] if s['id'] == 'premium').get('enamelAllowed', []))
mdf19 = set(next(s for s in price['series'] if s['id'] == 'prestige')['mdf19Only'])
line_siena = set(next(s for s in price['series'] if s['id'] == 'prestige')['notRecommendedInLineSiena'])


def enamel_of(mid, series_id):
    if mid in matte_only:
        return 'matte'
    if mid in gloss:
        return 'matte-gloss'
    if series_id == 'premium' and mid in premium_enamel:
        return 'matte'  # Премиум R39: «только мат»
    if series_id == 'optima' and mid in optima_enamel:
        return 'matte-gloss'
    if series_id == 'standart':
        return 'matte-gloss'
    return 'none'


millings = []
for it in mill['items']:
    g = it.get('geometry') or {}
    v = it.get('variants') or {}
    sid = SERIES_ID.get(it['priceSeries'], 'prestige')
    millings.append({
        'id': it['id'],
        'series': sid,
        'grafika': it['priceSeries'] == 'Престиж (Графика)',
        'type': g.get('type'),
        'panel': (g.get('panel') or {}).get('kind'),
        'inner': g.get('innerElements'),
        'note': g.get('photoNote'),
        'variants': {'solid': bool(v.get('solid', True)) if v else True, 'glass': bool(v.get('frameForGlass')), 'grille': bool(v.get('grille')), 'drawer': bool(v.get('drawerFront'))} if v else None,
        'mdf19Only': it['id'] in mdf19,
        'lineSienaNo': it['id'] in line_siena,
        'enamel': enamel_of(it['id'], sid),
        'enamelNoGrille': it['id'] in no_grille_enamel,
        'enamelNoDecor': it['id'] in no_decor_enamel,
    })

films = []
for cat, c in price['filmCategories']['categories'].items():
    for i in c['items']:
        films.append({'name': i['name'], 'cat': cat, 'patina': i.get('patina'), 'v5': i.get('v5IntegratedHandle')})

AD_SERIES = {'Стандарт': 'standart', 'Оптима': 'optima', 'Престиж': 'prestige', 'Премиум': 'premium'}
adilet_prices = {AD_SERIES[s['name']]: {t: {k: v for k, v in row.items() if not k.startswith('_')} for t, row in s['prices'].items()} for s in price['adilet']['series']}
adilet_films = []
for cat, items in price['adiletFilms']['categories'].items():
    for i in items:
        adilet_films.append({'name': i['name'], 'cat': cat, 'collection': i.get('collection'), 'finish': i.get('finish'), 'out': bool(i.get('withdrawing'))})

np = price['notesParsed']
notes = {
    'priceDate': price['source']['priceDate'],
    'patinaPerM2': np['patinaPerM2'],
    'hingeBoringPerPc': np['hingeBoringPerPc'],
    'minAreaM2Pvc': np['minAreaM2_pvc'],
    'framesAndGrillesMarkupPct': np['framesAndGrillesMarkupPct'],
    'mdf25MarkupPctVs16': np['mdf25mmMarkupPctVs16'],
    'enamelTwoSidedMarkupPct': np['enamelTwoSidedMarkupPct'],
    'enamelMatteLacquerPerM2': np['enamelMatteLacquerPerM2'],
    'leadTimeWorkDays': {k: v for k, v in np['leadTimeWorkDays'].items() if not k.startswith('_')},
    'texts': [n['text'] for n in price['notes']],
}

def js(x):
    return json.dumps(x, ensure_ascii=False, separators=(',', ':'))

with open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// Сгенерировано scripts/vernissage_data.py из разбора прайса «Вернисаж фасады 10.08.2026 с эмалью глянец» и каталога vernisag-fasad.ru.\n')
    f.write('// Не править руками. Тип рисунка фрезеровки — оценка по фото каталога (без размеров); размеры профилей — в facadesVernissage.ts (условные).\n')
    f.write('export type VSeriesId="standart"|"optima"|"prestige"|"premium";\n')
    f.write('export type VSeriesRow={id:VSeriesId;name:string;columns:Record<string,string>;prices:Record<"16"|"19",Record<string,number>>;srcRows:Record<string,number>};\n')
    f.write('export type VMillingRow={id:string;series:VSeriesId;grafika:boolean;type:string|null;panel:string|null;inner:string|null;note:string|null;variants:{solid:boolean;glass:boolean;grille:boolean;drawer:boolean}|null;mdf19Only:boolean;lineSienaNo:boolean;enamel:"none"|"matte"|"matte-gloss";enamelNoGrille:boolean;enamelNoDecor:boolean};\n')
    f.write('export type VFilmRow={name:string;cat:string;patina:boolean|null;v5:boolean|null};\n')
    f.write('export const V_SERIES:VSeriesRow[]=' + js(series) + ';\n')
    f.write('export const V_MILLINGS:VMillingRow[]=' + js(millings) + ';\n')
    f.write('export const V_FILMS:VFilmRow[]=' + js(films) + ';\n')
    f.write('export const V_NOTES=' + js(notes) + ' as const;\n')
    f.write('/** Плёнки Адилет (лист «Плёнка Адилет»): категория 3–6, коллекция; out — «[Выводим]» из ассортимента. */\n')
    f.write('export type VAdiletFilm={name:string;cat:string;collection:string|null;finish:string|null;out:boolean};\n')
    f.write('export const V_ADILET_FILMS:VAdiletFilm[]=' + js(adilet_films) + ';\n')
    f.write('/** Прайс Адилет: серия → толщина → cat3..cat6, ₽/м². Срок +5 раб. дней к стандартному. */\n')
    f.write('export const V_ADILET_PRICES:Record<VSeriesId,Record<"16"|"19",Record<string,number>>>=' + js(adilet_prices) + ';\n')
print(len(series), len(millings), len(films))
