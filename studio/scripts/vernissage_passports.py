# -*- coding: utf-8 -*-
"""Паспорта фрезеровок Вернисажа (PDF «Техническая информация» с vernisag-fasad.ru, скачаны с разрешения Макса 10.10.2026)
-> поля geometry/passport в vernissage-millings.json. Дальше генератор scripts/vernissage_data.py -> src/vernissageData.ts.

Каждая запись - то, что прочитано в PDF (страница одна; у 43/44/47/53/66 - страница общего каталога, номер в поле catPage).
Числа:
  limits      - таблица «Размеры с фрезеровкой» / «min/max размеры с фрезеровкой»: [высота min, высота max, ширина min, ширина max]
                по строкам глухой / витрина / решётка / ящик; None - «-» (не делается) или max не указан в паспорте.
  sectionDims - размеры, проставленные на «сечении фасада» (мм, по порядку от кромки фасада).
  profile     - сечение лица от кромки внутрь: точки [x - мм от кромки, f - доля глубины 0..1]. x - по проставленным размерам;
                где размера нет (widthsEstimated) - по чертежу в масштабе, восстановленном по «ширине рамочного профиля» (оценка).
  depthMm     - глубина фрезеровки: depthStated=True - из примечаний паспорта («глубина фрезы 3 мм»), иначе условная
                (на чертежах глубина не проставлена и масштаб по высоте не выдержан - у №45 чертёж даёт 15 мм из 19).
  glass       - «ширина рамочного профиля» (рамка витрины/решётки) и радиус угла проёма R16/R18 с картинки витрины.
Формы рисунка (арка, вогнутые углы, пазы) - по картинкам паспорта; где размера нет - условно (помечено в note).
Запуск: py -I scripts/vernissage_passports.py <папка Вернисаж>   (перед этим копия vernissage-millings.before-n6.json)"""
import json, sys, os, csv

SRC = sys.argv[1]
LIST = {r[1]: r[2] for r in csv.reader(open(os.path.join(SRC, 'pdf', '_list.tsv'), encoding='utf-8'), delimiter='\t') if len(r) >= 3}

STD = {'solid': [246, 2750, 246, 1000], 'glass': [296, 2750, 296, 1000], 'grille': [296, 2750, 296, 1000], 'drawer': [116, 246, 246, 1000]}
def lim(solid=STD['solid'], glass=STD['glass'], grille=STD['grille'], drawer=STD['drawer']):
    return {'solid': solid, 'glass': glass, 'grille': grille, 'drawer': drawer}
# паспорта со страниц каталога: только min (дверь/витрина/решётка/ящик) и max «дверь/фасады» 2400x1100
def lim_cat(glass=True, grille=True, drawer_h=116, hmax=2400, wmax=1100):
    return {'solid': [246, hmax, 246, wmax], 'glass': [296, hmax, 296, wmax] if glass else None,
            'grille': [296, hmax, 296, wmax] if grille else None, 'drawer': [drawer_h, 246, 246, wmax]}

DRAWER = 'Ящик < Min размера изготавливается без фрезеровки'
H2750 = 'h=2750 мм - рисунок будет разделен на несколько частей'
KOSA = 'Во фрезеровках 50, 51, 52, 53, 54, 55, 56, 57, 60, 68, 69, 70 используется декоративная коса (сноска страницы каталога)'

P = {}
def add(mid, pdf, **kw):
    kw.setdefault('notes', [])
    kw['pdf'] = pdf
    kw['url'] = LIST.get(pdf.replace('.pdf', '').replace('_', '/'))
    kw['drawerSmooth'] = any(n.lower().startswith('ящик < min') for n in kw['notes'])
    P[mid] = kw

# ---------- Стандарт ----------
add('15', '15.pdf', series='Стандарт', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(drawer=[100, 246, 246, 1000]),
    notes=['ширина рамочного профиля 60 мм'], glass={'frame': 60, 'r': 16},
    geom={'kind': 'smooth', 'edgeR': 5, 'note': '«мыло»: гладкое полотно, скруглённая кромка (радиус кромки на чертеже не проставлен - условно 5)'})
add('3', '3.pdf', series='Стандарт', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(), sectionDims=[49, 32],
    notes=[DRAWER, 'ширина рамочного профиля 59 мм'], glass={'frame': 59, 'r': 16},
    geom={'kind': 'profile', 'top': 'shoulders', 'depthMm': 6, 'depthStated': False,
          'profile': [[49, 0], [52, .12], [60, 1], [72, 1], [78, .12], [81, 0]],
          'note': 'рамка 49, паз-трапеция 32 с уступами, филёнка заподлицо; по верху арка с плечиками'})
add('6', '6.pdf', series='Стандарт', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(grille=None), sectionDims=[80],
    notes=['ширина рамочного профиля 75 мм'], glass={'frame': 75, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 2.5, 'depthStated': False,
          'lines': {'w': 6, 'v': [{'from': 'left', 'at': [80]}, {'from': 'right', 'at': [80]}], 'h': [{'from': 'bottom', 'at': [80], 'between': True}, {'from': 'top', 'at': [80], 'between': True}]},
          'note': 'круглый паз в 80 мм от кромки: вертикальные пазы во всю высоту, горизонтальные между ними («шейкер»)'})
add('18', '18.pdf', series='Стандарт', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(grille=None), sectionDims=[35, 35, 60],
    notes=[DRAWER, 'ширина рамочного профиля 55 мм'], glass={'frame': 55, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 2.5, 'depthStated': False,
          'lines': {'w': 6, 'v': [{'from': 'left', 'at': [60, 95, 130]}], 'h': [{'from': 'bottom', 'at': [60, 95, 130]}]},
          'note': 'три паза в 60, 95, 130 мм от кромки: вертикальные слева во всю высоту, горизонтальные внизу во всю ширину'})
add('20', '20.pdf', series='Стандарт', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(grille=None), sectionDims=[65],
    notes=[DRAWER, 'Ширина рамочного профиля: 60 мм'], glass={'frame': 60, 'r': 0},
    geom={'kind': 'profile', 'top': 'arch', 'bottom': 'arch', 'depthMm': 2.5, 'depthStated': False,
          'profile': [[62, 0], [63, .55], [65, 1], [67, .55], [68, 0]],
          'note': 'круглый паз в 65 мм от кромки, дуги сверху и снизу (подъём дуги условный); дуги в углах к кромке не построены'})
# ---------- Оптима ----------
add('25', '25.pdf', series='Оптима', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(), sectionDims=[49, 32, 9],
    notes=[DRAWER, 'ширина рамочного профиля 59 мм'], glass={'frame': 59, 'r': 16},
    geom={'kind': 'profile', 'top': 'shoulders', 'bottom': 'shoulders', 'depthMm': 6, 'depthStated': False,
          'profile': [[49, 0], [52, .12], [60, 1], [72, 1], [78, .12], [81, 0], [84, 0], [85.3, .25], [88.5, .35], [91.7, .25], [93, 0]],
          'note': 'рамка 49, паз-трапеция 32, круглый паз 9; арки с плечиками сверху и снизу'})
add('41', '41.pdf', series='Оптима', mdf=[16, 19], covers='ПВХ', edge='см. стр. №75', limits=lim(grille=None), sectionDims=[58, 25],
    notes=[DRAWER, 'ширина рамочного профиля 55 мм'], glass={'frame': 55, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 5, 'depthStated': False,
          'profile': [[30, 0], [40, .15], [50, .45], [56, .85], [58, 1], [60, .85], [66, .45], [76, .12], [81, 0], [82, .3], [83.5, .4], [85, 0]],
          'note': 'выпуклая рамка 58 до V-паза, выпуклый скос филёнки 25 и тонкий паз; скат рамки к кромке упрощён'})
add('45', '45-BIG.pdf', series='Престиж', mdf=[16, 19], covers=None, edge='см. стр. №71', sectionDims=[62, 49],
    limits={'solid': [246, 2750, 246, 1100], 'glass': [296, 2750, 296, 1100], 'grille': None, 'drawer': [116, 246, 246, 1100]},
    maxAlt=[[2450, 1100], [2750, 1000]],
    notes=[DRAWER, 'выборка под стекло не делается', 'ширина рамочного профиля 61 мм', 'max размеры с фрезеровкой: 2450×1100 или 2750×1000'],
    glass={'frame': 61, 'r': 18},
    geom={'kind': 'profile', 'top': 'arch', 'depthMm': 6, 'depthStated': False,
          'profile': [[49, 0], [50, .1], [53, .3], [55, .25], [58, .6], [61, 1], [75, 1], [90, .7], [105, .25], [111, 0]],
          'note': 'рамка 49, профиль 62: выкружка с валиком, дно, пологий скос к выпуклой филёнке; по верху арка'})
add('46', '46.pdf', series='Оптима', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(grille=None), sectionDims=[65],
    notes=[DRAWER, 'шаг пальчиковой фрезы 40 мм', 'ширина рамочного профиля 65 мм'], glass={'frame': 65, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 5, 'depthStated': False, 'widthsEstimated': True,
          'profile': [[54.4, 0], [65, 1], [76.4, 0]], 'slots': {'dir': 'v', 'pitch': 40, 'w': 8, 'd': 2.5, 'shape': 'round'},
          'note': 'V-паз с низом в 65 мм от кромки, в филёнке пазы пальчиковой фрезы шаг 40; диагонали «на ус» в углах не построены'})
add('89', '89.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', sectionDims=[50, 50],
    limits=lim(glass=None, grille=None, drawer=[100, 246, 246, 1000]), notes=[DRAWER],
    geom={'kind': 'relief', 'dir': 'v', 'pitch': 50, 'w': 6, 'depthMm': 2, 'depthStated': False, 'shape': 'v',
          'note': 'V-пазы шагом ~50 мм во всю высоту'})
add('W2', 'W2.pdf', series='Оптима', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', sectionDims=[20],
    limits=lim(glass=[246, 2750, 246, 1000], grille=[246, 2750, 246, 1000]), notes=['ширина рамочного профиля 61 мм'], glass={'frame': 61, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 2, 'depthStated': False, 'profile': [[17.5, 0], [18.5, .55], [20, 1], [21.5, .55], [22.5, 0]],
          'note': 'тонкий круглый паз в 20 мм от кромки'})
add('94', '94.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ, Эмаль', edge='T1', sectionDims=[68, 15], limits=lim(), notes=[DRAWER],
    geom={'kind': 'profile', 'depthMm': 4, 'depthStated': False, 'widthsEstimated': True, 'glassProvisional': 65,
          'profile': [[13.5, 0], [15, .4], [16.5, 0], [61, 0], [65, 1], [79, 1], [83, 0]],
          'note': 'V-паз в 15 мм от кромки, паз-трапеция до 83 мм (15 + 68)'})
add('95', '95.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ, Эмаль', edge='T1', sectionDims=[68, 15],
    limits=lim(solid=[246, 2750, 246, 1100], glass=[296, 2750, 296, 1100], grille=[296, 2750, 296, 1100]), notes=[DRAWER],
    geom={'kind': 'profile', 'depthMm': 4, 'depthStated': False, 'widthsEstimated': True, 'glassProvisional': 68,
          'profile': [[13.5, 0], [15, .4], [16.5, 0], [24, 0], [25.5, .4], [27, 0], [34.5, 0], [36, .4], [37.5, 0], [64, 0], [68, 1], [79, 1], [83, 0]],
          'note': 'три V-паза от 15 мм, паз-трапеция до 83 мм (15 + 68)'})
add('96', '96.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль мат.', edge='T1', sectionDims=[10, 17, 5, 12], limits=lim(),
    notes=[DRAWER, 'с нашей присадкой под петли МДФ 19, 22 мм', 'для самостоятельной присадки под петли используется только МДФ 22 мм', 'глубина фрезеровки 5 мм', 'без петель МДФ 16 мм'],
    glass={'frame': None, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 5, 'depthStated': True, 'glassProvisional': 27, 'profile': [[10, 0], [10.5, 1], [22, 1], [27, 0]],
          'note': 'кант 10 мм у кромки, паз 17 мм глубиной 5 (дно 12, скос к филёнке)'})
add('113', '113.pdf', series='Оптима', mdf=[22], covers='ПВХ, Эмаль мат.', edge='см. стр. №71', sectionDims=[25, 16, 22],
    limits={'solid': [100, 2750, 100, 1050], 'glass': [296, 2750, 296, 1050], 'grille': [296, 2750, 296, 1050], 'drawer': [100, 246, 246, 1050]},
    notes=['глубина фрезеровки 6 мм', 'без присадки МДФ 16/19 мм', 'фреза v-образная угол 150 градусов'],
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': True, 'edge': True, 'glassProvisional': 25, 'profile': [[0, 1], [25, 0]],
          'note': 'скос по периметру 25 мм: от 22 мм в поле до 16 мм у кромки (фреза V150)'})
# ---------- Престиж ----------
add('43', '43.pdf', catPage=29, series='Престиж', mdf=[16, 19], covers=None, edge='см. стр. №90', limits=lim_cat(grille=False),
    notes=[DRAWER, 'Шаг пальчиковой фрезы - 40мм', 'Ширина рамочного профиля: 61 мм'], glass={'frame': 61, 'r': 0},
    geom={'kind': 'profile', 'top': 'arch', 'depthMm': 6, 'depthStated': False, 'widthsEstimated': True,
          'profile': [[43, 0], [44, .1], [49, .1], [61, 1], [73, 1], [74, .5], [78, .15], [79, 0], [99, 0], [100, .3], [101.5, .4], [103, .3], [104, 0]],
          'slots': {'dir': 'v', 'pitch': 40, 'w': 8, 'd': 2.5, 'shape': 'round'},
          'note': 'профиль рамки и филёнки по чертежу (размеры не проставлены), пазы пальчиковой фрезы шаг 40; по верху арка'})
add('44', '44.pdf', catPage=30, series='Престиж', mdf=[16, 19], covers=None, edge='см. стр. №90', limits=lim_cat(),
    notes=[DRAWER, 'Ширина рамочного профиля: 61 мм'], glass={'frame': 61, 'r': 0},
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': False, 'widthsEstimated': True,
          'profile': [[46.5, 0], [61, 1], [71.7, 1], [75, .55], [77.4, .35], [78, .2], [79.2, .2], [81.1, 0]],
          'note': 'рамка, скос, дно, уступ к филёнке (по чертежу); декор в углах филёнки не построен'})
add('47', '47.pdf', catPage=31, series='Престиж', mdf=[16, 19], covers=None, edge='см. стр. №90', limits=lim_cat(grille=False),
    notes=[DRAWER, 'Ширина рамочного профиля: 61 мм'], glass={'frame': 61, 'r': 0},
    geom={'kind': 'profile', 'top': 'shoulders', 'depthMm': 6, 'depthStated': False, 'widthsEstimated': True,
          'profile': [[39, 0], [52, 1], [52.5, .9], [53, 1], [63, 1], [64, .85], [66, .75], [74, .4], [83, 0]],
          'note': 'рамка, скос 45°, дно, выкружка и пологий скос к филёнке (по чертежу); по верху арка с плечиками'})
add('48', '48.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(), sectionDims=[51, 50],
    notes=[DRAWER, 'ширина рамочного профиля 61 мм'], glass={'frame': 61, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': False,
          'profile': [[50, 0], [66, 1], [75, 1], [77, .85], [80, .55], [83, .2], [85, 0], [91, 0], [92.5, .5], [95.5, .7], [98.5, .5], [100, 0]],
          'note': 'рамка 50, профиль 51: скос, дно, выкружка к филёнке и круглый паз (двойной контур)'})
add('53', '53.pdf', catPage=11, series='Престиж', mdf=[16, 19], covers=None, edge='см. стр. №90', limits=lim_cat(grille=False, drawer_h=140),
    notes=[DRAWER, 'Выборка под стекло не делается', 'Ширина рамочного профиля: 80 мм', KOSA], glass={'frame': 80, 'r': 0},
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': False, 'widthsEstimated': True,
          'profile': [[44, 0], [45.5, .25], [48.5, .3], [50, .1], [52, .35], [56, .55], [59, .4], [62, .6], [66, .45], [70, .65], [75, .8], [80, 1], [86, .75], [95, .4], [105, .1], [109, 0]],
          'note': 'ступенчатый профиль с декоративной косой (по чертежу, коса упрощена до зубцов)'})
add('59', '59.pdf', series=None, mdf=None, covers=None, edge='T2, см. стр. №50',
    limits={'solid': [246, None, 246, None], 'glass': [296, None, 296, None], 'grille': [296, None, 296, None], 'drawer': [116, 246, 246, None]},
    notes=[DRAWER, 'Ширина рамочного профиля: 60 мм', 'max размеры в паспорте не указаны'], glass={'frame': 60, 'r': 0},
    geom={'kind': 'profile', 'corner': 'concave', 'cornerR': 14, 'depthMm': 6, 'depthStated': False, 'widthsEstimated': True,
          'profile': [[36.5, 0], [38, .25], [39.5, 0], [44, 0], [60, 1], [71.5, 1], [80, .75], [90, .35], [101.5, 0]],
          'note': 'тонкий паз, скос, дно, пологий скос к выпуклой филёнке (по чертежу); вогнутые углы (радиус условный)'})
add('62', '62.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль', edge='см. стр. №75', sectionDims=[61, 73],
    limits=lim(grille=None, drawer=[140, 246, 246, 1000]),
    notes=[DRAWER, 'толщина фасада: только 19 мм', 'выборка под стекло не делается', 'ширина рамочного профиля 92 мм'], glass={'frame': 92, 'r': 16},
    geom={'kind': 'profile', 'top': 'arch', 'bottom': 'arch', 'depthMm': 6, 'depthStated': False,
          'profile': [[73, 0], [75, .1], [77, .25], [80, .7], [83, .95], [86, 1], [97, 1], [100, .85], [110, .55], [122, .2], [134, 0]],
          'note': 'рамка 73, профиль 61: выкружка, дно, выпуклый скос к филёнке; дуги сверху и снизу; тонкая линия на филёнке не построена'})
add('66', '66.pdf', catPage=15, series='Престиж', mdf=[16, 19], covers=None, edge='см. стр. №90', limits=lim_cat(grille=False, drawer_h=140),
    notes=[DRAWER, 'Выборка под стекло не делается', 'Ширина рамочного профиля: 70 мм'], glass={'frame': 70, 'r': 0},
    geom={'kind': 'profile', 'top': 'arch', 'bottom': 'arch', 'depthMm': 6, 'depthStated': False, 'widthsEstimated': True,
          'profile': [[52, 0], [56, .1], [62, .4], [67, .9], [70, 1], [87, 1], [88, .8], [92, .75], [96, .65], [110, .35], [121, .15], [122, 0]],
          'note': 'рамка, выкружка, дно, пологий скос к филёнке (по чертежу); дуги сверху и снизу'})
add('67', '67.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(), sectionDims=[50],
    notes=[DRAWER, 'ширина рамочного профиля 61 мм'], glass={'frame': 61, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': False, 'widthsEstimated': True,
          'profile': [[50, 0], [63, .95], [65, 1], [73, 1], [75, .85], [78, .6], [85, .45], [93, .15], [99.5, 0]],
          'note': 'рамка 50, скос 45°, дно, выкружка и скос к филёнке'})
add('73', '73.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(), sectionDims=[33, 50],
    notes=[DRAWER, 'решетка от фрезеровки №74', 'ширина рамочного профиля 61 мм'], glass={'frame': 61, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': False, 'profile': [[50, 0], [53, .12], [60, 1], [76, 1], [80, .12], [83, 0]],
          'note': 'рамка 50, паз-трапеция 33'})
add('74', '74.pdf', series='Оптима', mdf=[16, 19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(), sectionDims=[21, 50],
    notes=[DRAWER, 'ширина рамочного профиля 61 мм'], glass={'frame': 61, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 4, 'depthStated': False, 'profile': [[50, 0], [60.5, 1], [71, 0]], 'note': 'рамка 50, V-паз 21'})
add('76', '76.pdf', series='Престиж', mdf=[19], covers='ПВХ', edge='см. стр. №75', limits=lim(), sectionDims=[37, 15, 1.5],
    notes=[DRAWER, 'толщина фасада: только 19 мм', 'без петель МДФ 16 мм', 'глубина фрезы 1,5 мм', 'ширина рамочного профиля 71 мм'], glass={'frame': 71, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 1.5, 'depthStated': True, 'profile': [[15, 0], [16.5, 1], [50.5, 1], [52, 0]],
          'note': 'кант 15 мм, широкий паз 37 мм глубиной 1,5'})
add('77', '77.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль', edge='см. стр. №75', limits=lim(), sectionDims=[56, 5],
    notes=[DRAWER, 'толщина фасада: только 19 мм', 'без петель МДФ 16 мм', 'глубина шага 2 мм', 'ширина рамочного профиля 65 мм'], glass={'frame': 65, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 2, 'depthStated': True,
          'profile': [[5 + 3.5 * i, 0 if i % 2 == 0 else 1] for i in range(17)],
          'note': 'от 5 мм у кромки полоса 56 мм из 8 V-ступеней (число ступеней по чертежу)'})
for mid, d in (('78', 'v'), ('78/1', 'h')):
    add(mid, '78.pdf' if mid == '78' else '78_1.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль мат.', edge='см. стр. №75', sectionDims=[18, 18],
        limits=lim(glass=None, grille=None),
        notes=[DRAWER, 'толщина фасада: только 19 мм', 'ВОЗМОЖНО ГОРИЗОНТАЛЬНОЕ ИСПОЛНЕНИЕ', 'без петель МДФ 16 мм', 'глубина шага 3 мм', 'расчетный шаг 18/18 мм'],
        samePdfAs='78' if mid == '78/1' else None,
        geom={'kind': 'relief', 'dir': d, 'pitch': 36, 'w': 18, 'depthMm': 3, 'depthStated': True, 'shape': 'trap',
              'note': 'рейки 18 / пазы 18 мм, глубина 3' + (' (горизонтальное исполнение №78)' if d == 'h' else '')})
for mid, d in (('79', 'v'), ('79/1', 'h')):
    add(mid, '79.pdf' if mid == '79' else '79_1.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль мат.', edge='см. стр. №75', sectionDims=[10.5, 10.5],
        limits=lim(glass=None, grille=None),
        notes=[DRAWER, 'толщина фасада: только 19 мм', 'ВОЗМОЖНО ГОРИЗОНТАЛЬНОЕ ИСПОЛНЕНИЕ', 'без петель МДФ 16 мм', 'глубина шага 3 мм', 'расчетный шаг 10/10 мм'],
        samePdfAs='79' if mid == '79/1' else None,
        geom={'kind': 'relief', 'dir': d, 'pitch': 20, 'w': 10, 'depthMm': 3, 'depthStated': True, 'shape': 'round',
              'note': 'круглые пазы 10 / рейки 10 мм, глубина 3' + (' (горизонтальное исполнение №79)' if d == 'h' else '')})
add('80', '80.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль мат.', edge='см. стр. №75', sectionDims=[31, 28], limits=lim(glass=None, grille=None),
    notes=[DRAWER, 'толщина фасада: только 19 мм', 'без петель МДФ 16 мм', 'глубина шага 4,5 мм', 'расчетный шаг 30 мм', 'расчетный шаг 22 мм'],
    geom={'kind': 'relief', 'dir': 'v', 'pitch': 30, 'w': 30, 'depthMm': 4.5, 'depthStated': True, 'shape': 'convex',
          'note': 'выпуклые волны шагом 30 мм, глубина 4,5 (второй расчётный шаг 22 мм - не используется)'})
add('83', '83.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль мат.', edge='см. стр. №75', sectionDims=[14, 14], limits=lim(glass=None, grille=None),
    notes=[DRAWER, 'толщина фасада: только 19мм', 'без петель МДФ 16 мм', 'глубина шага 2 мм'],
    geom={'kind': 'relief', 'dir': 'h', 'pitch': 14, 'w': 5, 'depthMm': 2, 'depthStated': True, 'shape': 'round',
          'note': 'пазы шагом 14 мм, глубина 2; «ёлочка» на фото - в 3D горизонтальные пазы того же шага (упрощение)'})
add('84', '84.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль мат.', edge='см. стр. №75', sectionDims=[70], limits=lim(glass=None, grille=None),
    notes=[DRAWER, 'толщина фасада: только 19 мм', 'без петель МДФ 16 мм', 'глубина шага 2 мм и 1 мм'],
    geom={'kind': 'relief', 'dir': 'v', 'module': 70, 'depthMm': 2, 'depthStated': True, 'widthsEstimated': True,
          'grooves': [[0, 15, .5, 'trap'], [21, 35, .5, 'trap'], [38, 41, 1, 'v'], [41.5, 44.5, 1, 'v'], [45, 48, 1, 'v'], [55, 69, .5, 'trap']],
          'note': 'модуль ~70 мм: широкие пазы 1 мм и узкие V 2 мм (раскладка внутри модуля по чертежу)'})
add('85', '85.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль мат.', edge='см. стр. №75', sectionDims=[5.5, 5.5, 5.5], limits=lim(glass=None, grille=None),
    notes=[DRAWER, 'без петель МДФ 16 мм', 'глубина шага 2 мм', 'расчетный шаг: 5/5 мм'],
    geom={'kind': 'relief', 'dir': 'v', 'pitch': 10, 'w': 5, 'depthMm': 2, 'depthStated': True, 'shape': 'round', 'note': 'круглые пазы 5 / рейки 5 мм, глубина 2'})
add('88', '88.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ, Эмаль мат.', edge='см. стр. №75', sectionDims=[20, 20, 20],
    limits=lim(glass=None, grille=None, drawer=[140, 246, 246, 1000]), notes=[DRAWER],
    geom={'kind': 'profile', 'depthMm': 1.5, 'depthStated': False, 'lines': {'w': 4, 'diag': {'pitch': 20, 'angle': 45}},
          'note': 'диагональные пазы шагом 20 мм; вторая система диагоналей в верхнем углу не построена'})
add('98', '98.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль мат.', edge='T1', sectionDims=[15, 3],
    limits=lim(solid=[246, 2450, 246, 1100], glass=None, grille=None, drawer=[177, 246, 246, 1000]),
    notes=[DRAWER, 'толщина фасада: только 19 мм', 'глубина фрезеровки 3 мм', H2750],
    geom={'kind': 'profile', 'depthMm': 3, 'depthStated': True, 'profile': [[15, 0], [18, 1]],
          'archBand': {'outer': 35, 'width': 4, 'd': 1.5, 'provisional': True},
          'note': 'кант 15 мм, поле ниже на 3 мм; «Арка» - тонкий паз полукругом, открытый книзу (отступ арки условный)'})
for mid in ('99', '100'):
    add(mid, mid + '.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ, Эмаль мат.', edge='T1', sectionDims=[50, 50, 1.5],
        limits=lim(glass=None, grille=None, drawer=[140, 246, 246, 1000]), notes=[DRAWER, 'глубина фрезеровки 1,5 мм'],
        geom={'kind': 'profile', 'depthMm': 1.5, 'depthStated': True, 'archBand': {'outer': 50, 'width': 50, 'd': 1.5},
              **({'slots': {'dir': 'v', 'pitch': 30, 'w': 3, 'd': 1, 'shape': 'v', 'inArch': True, 'provisional': True}} if mid == '100' else {}),
              'note': 'полоса-арка 50 мм в 50 мм от кромки, глубина 1,5, открыта книзу' + ('; в арке вертикальные пазы (шаг условный)' if mid == '100' else '')})
for mid, v, d, mn in (('109', 90, 2, 100), ('110', 120, 3, 116)):
    add(mid, mid + '.pdf', series='Престиж', mdf=[16, 19] if mid == '109' else [19], covers='ПВХ, Эмаль мат.', edge='T1',
        limits=lim(solid=[mn, 2750, mn, 1000], glass=None, grille=None, drawer=[100, 246, 246, 1000]),
        notes=['Шаг рисунка - размер ромба 63х34', 'Глубина фрезеровки %d мм' % d, 'Профиль фрезеровки V%d' % v],
        geom={'kind': 'lattice', 'cellW': 34, 'cellH': 63, 'depthMm': d, 'depthStated': True, 'vAngle': v,
              'note': 'сетка V-пазов, ромб 63×34, V%d глубиной %d мм' % (v, d)})
add('111', '111.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль мат.', edge='см. стр. №71', sectionDims=[31, 28], limits=lim(glass=None, grille=None),
    notes=[DRAWER, 'толщина фасада: только 19 мм', 'без петель МДФ 16  мм', 'глубина шага 4,5 мм', 'расчетный шаг 30 мм', 'расчетный шаг 22 мм'],
    geom={'kind': 'relief', 'dir': 'v', 'pitch': 30, 'w': 30, 'depthMm': 4.5, 'depthStated': True, 'shape': 'convex', 'band': {'from': 'left', 'count': 6},
          'note': 'полоса из 6 выпуклых волн шагом 30 мм у левой кромки (число волн по фото), остальное гладкое'})
add('112', '112.pdf', series='Престиж', mdf=[19], covers='ПВХ, Эмаль мат.', edge='см. стр. №71', sectionDims=[10.5, 10.5],
    limits=lim(solid=[116, 2450, 196, 1000], glass=None, grille=None, drawer=[100, 246, 246, 1000]),
    notes=[DRAWER, 'толщина фасада: только 19 мм', 'без петель МДФ 16 мм', 'глубина шага 3 мм', 'расчетный шаг 10/10 мм'],
    geom={'kind': 'profile', 'depthMm': 2.5, 'depthStated': False, 'profile': [[27.5, 0], [28.5, .55], [30, 1], [31.5, .55], [32.5, 0]],
          'bottomBand': 100, 'slots': {'dir': 'v', 'pitch': 20, 'w': 10, 'd': 3, 'shape': 'round', 'zone': 'band'},
          'note': 'тонкий контурный паз (отступ 30 условный), внизу полоса круглых пазов 10/10 глубиной 3 (высота полосы 100 условно)'})
add('114', '114.pdf', series='Престиж', mdf=[22], covers='ПВХ, Эмаль мат.', edge='T1 по 3-м сторонам', sectionDims=[50, 16, 22],
    limits={'solid': [246, 2750, 246, 1000], 'glass': None, 'grille': None, 'drawer': None},
    notes=['глубина фрезеровки 16 + 6 мм', 'Ящик < min размера изготавливается без фрезеровки'],
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': True, 'edge': True, 'profile': [[0, 1], [50, 1], [50.5, 0]],
          'note': 'полоса 50 мм у кромки на 6 мм ниже (22 -> 16); по паспорту с трёх сторон - в 3D по периметру (упрощение)'})
# ---------- Премиум ----------
add('75', '75.pdf', series='Премиум', mdf=[19], covers='ПВХ, Эмаль мат.', edge='T1', sectionDims=[15, 3],
    limits={'solid': [246, 2450, 246, 1100], 'glass': [296, 2450, 296, 1100], 'grille': [296, 2450, 296, 1100], 'drawer': [116, 246, 246, 1100]},
    notes=[DRAWER, 'толщина фасада: только 19 мм', 'глубина фрезы 3 мм', 'ширина профиля 15 мм', 'ширина рамочного профиля 71 мм', H2750],
    glass={'frame': 71, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 3, 'depthStated': True, 'profile': [[15, 0], [18, 1]], 'note': 'кант 15 мм, поле ниже на 3 мм'})
add('90', '90.pdf', series='Премиум', mdf=[16, 19], covers='ПВХ', edge='T1', sectionDims=[9, 46],
    limits={'solid': [246, 2450, 246, 1100], 'glass': [296, 2450, 296, 1100], 'grille': [296, 2450, 296, 1100], 'drawer': [116, 246, 246, 1100]},
    notes=[DRAWER, 'без петель МДФ 16 мм', 'глубина фрезы 3 мм', 'ширина рамочного профиля 66 мм', H2750], glass={'frame': 66, 'r': 0},
    geom={'kind': 'profile', 'depthMm': 3, 'depthStated': True, 'profile': [[44, 0], [46, .5], [48, 0], [55, 0], [58, 1]],
          'slots': {'dir': 'v', 'pitch': 56, 'w': 4, 'd': 1.5, 'shape': 'v', 'provisional': True},
          'note': 'рамка 46 + паз + 9, уступ 3 мм к филёнке; в филёнке V-пазы (шаг по фото, условно 56)'})
add('91', '91.pdf', series='Премиум', mdf=[16, 19], covers='ПВХ', edge='T1', sectionDims=[13, 50],
    limits={'solid': [246, 2450, 246, 1100], 'glass': [296, 2450, 296, 1100], 'grille': [296, 2450, 296, 1100], 'drawer': [116, 246, 246, 1100]},
    notes=[DRAWER, 'рамки и решетки используются от 74 фрезеровки', H2750], glass={'frame': 61, 'r': 16, 'from': '74'},
    geom={'kind': 'profile', 'depthMm': 5, 'depthStated': False, 'profile': [[50, 0], [52, .5], [63, .5], [65, 1]], 'note': 'рамка 50, две ступени (13 мм между ними) к филёнке'})
add('92', '92.pdf', series='Премиум', mdf=[16, 19], covers='ПВХ', edge='T1', sectionDims=[10, 10, 40],
    limits={'solid': [246, 2450, 246, 1100], 'glass': [296, 2450, 296, 1100], 'grille': [296, 2450, 296, 1100], 'drawer': [116, 246, 246, 1100]},
    notes=[DRAWER, 'без петель МДФ 16 мм', 'рамки и решетки используются от 74 фрезеровки', H2750], glass={'frame': 61, 'r': 16, 'from': '74'},
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': False, 'profile': [[40, 0], [41.5, .33], [50, .33], [51.5, .67], [60, .67], [61.5, 1]],
          'note': 'рамка 40, три ступени по 10 мм к филёнке'})
# ---------- W (Престиж) ----------
W_LIM = {'solid': [246, 1750, 246, 896], 'glass': [296, 1750, 296, 896], 'grille': [296, 1750, 296, 896]}
add('W1', 'W1.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ', edge='см. стр. №75', sectionDims=[30, 50], limits={**W_LIM, 'drawer': [200, 246, 246, 896]},
    notes=[DRAWER, 'ширина рамочного профиля 61 мм', H2750], glass={'frame': 61, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': False, 'profile': [[50, 0], [51.5, .05], [53, .12], [60, .45], [70, .7], [78, .8], [80, 1]],
          'note': 'рамка 50, валик и скос 30 мм к филёнке («шейкер»); валик выше рамки упрощён'})
add('W3', 'W3.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ', edge='см. стр. №75', sectionDims=[60, 20], limits={**W_LIM, 'drawer': [116, 246, 246, 896]},
    notes=[DRAWER, 'ширина рамочного профиля 61 мм', H2750], glass={'frame': 61, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': False,
          'profile': [[17.5, 0], [18.5, .12], [20, .25], [21.5, .12], [22.5, 0], [60, 0], [62, .05], [66, .15], [75, .45], [86, .65], [88, .7], [88.5, 1]],
          'note': 'паз в 20 мм, рамка 60 с валиком, скос к филёнке'})
add('W4', 'W4.pdf', series=None, mdf=None, covers=None, edge='T1 (обработка торца - см. примечание)',
    limits={'solid': [246, None, 246, None], 'glass': [296, None, 296, None], 'grille': [296, None, 296, None], 'drawer': [200, 246, 200, None]},
    notes=[DRAWER, 'Ширина рамочного профиля: 71 мм', 'max размеры в паспорте не указаны'], glass={'frame': 71, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': False, 'widthsEstimated': True,
          'profile': [[39, 0], [41, .15], [43, 0], [52, 0], [54, .05], [57, .05], [60, .25], [66, .6], [70, .7], [71, 1]],
          'note': 'паз, валик и скос к филёнке (по чертежу)'})
add('W5', 'W5.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ', edge='см. стр. №75', sectionDims=[50], limits={**W_LIM, 'drawer': [200, 246, 246, 896]},
    notes=[DRAWER, 'ширина рамочного профиля 61 мм', H2750], glass={'frame': 61, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 4, 'depthStated': False, 'edge': True,
          'profile': [[0, 1], [50, 1], [50.5, .6], [51.5, .3], [53, .1], [55, 0], [56, .05], [57, 0]],
          'note': 'рамка 50 мм ниже поля, уступ с валиком к филёнке (филёнка на уровне лица)'})
add('W6', 'W6.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ', edge='см. стр. №75', sectionDims=[38, 50],
    limits={'solid': [246, 2750, 246, 1100], 'glass': [296, 2750, 296, 1100], 'grille': [296, 2750, 296, 1100], 'drawer': [140, 246, 246, 1100]},
    notes=[DRAWER, 'шаг пальчиковой фрезы - 40 мм', 'ширина рамочного профиля 61 мм'], glass={'frame': 61, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 6, 'depthStated': False,
          'profile': [[50, 0], [65, 1], [77, 1], [80, .4], [82, .35], [86.5, 0], [102, 0], [103, .35], [104.5, .45], [106, .35], [107, 0]],
          'slots': {'dir': 'v', 'pitch': 40, 'w': 8, 'd': 2.5, 'shape': 'round'},
          'note': 'рамка 50, паз 38 (скос, дно), тонкий паз на филёнке, пазы пальчиковой фрезы шаг 40'})
add('W7', 'W7.pdf', series='Престиж', mdf=[16, 19], covers='ПВХ', edge='см. стр. №75', sectionDims=[50, 9],
    limits={'solid': [246, 2450, 246, 1100], 'glass': [296, 2450, 296, 1100], 'grille': [296, 2450, 296, 1100], 'drawer': [140, 246, 246, 1100]},
    notes=[DRAWER, 'решетка от фрезеровки №74', 'ширина рамочного профиля 61 мм', H2750], glass={'frame': 61, 'r': 16},
    geom={'kind': 'profile', 'depthMm': 9, 'depthStated': True, 'profile': [[50, 0], [51, .12], [53, .15], [62, 1]],
          'note': 'рамка 50, уступ и скос 45° к филёнке ниже на 9 мм («шейкер»)'})

# PDF, совпавшие с чужим паспортом: на карточке №86 сайт отдаёт PDF №76 (тот же файл, заголовок «Фрезеровка № 76») -> своих данных у №86 нет.
FOREIGN = {'86': 'PDF на карточке №86 - копия паспорта №76 (тот же файл, заголовок «Фрезеровка № 76»): своих размеров нет'}

mill_path = os.path.join(SRC, 'vernissage-millings.json')
mill = json.load(open(mill_path, encoding='utf-8'))
ids = {it['id'] for it in mill['items']}
missing = [k for k in P if k not in ids]
assert not missing, missing
for it in mill['items']:
    pp = P.get(it['id'])
    it.pop('passport', None)
    g = it.setdefault('geometry', {})
    if it['id'] in FOREIGN:
        it['techPdfNote'] = FOREIGN[it['id']]
    if not pp:
        continue
    page = 'стр. 1' + (' (стр. %d каталога)' % pp['catPage'] if pp.get('catPage') else '')
    src = 'PDF «Техническая информация» Вернисаж: pdf/%s, %s%s' % (pp['pdf'], page, (' - ' + pp['url']) if pp.get('url') else '')
    pp['source'] = src
    it['passport'] = pp
    gm = pp['geom']
    prof = gm.get('profile')
    g['frameWidthMm'] = prof[0][0] if prof and prof[0][0] > 0 else None
    g['profile'] = {'shape': gm.get('note'), 'depthMm': gm.get('depthMm'), 'depthStated': gm.get('depthStated', False)}
    g['cornerRadiusMm'] = (pp.get('glass') or {}).get('r')
    g['limits'] = pp['limits']
    g['source'] = src
it_sorted = sorted(P)
mill['meta']['passports'] = {'date': '2026-10-10', 'count': len(P), 'ids': it_sorted, 'foreign': FOREIGN,
                             'note': 'PDF «Техническая информация» скачаны с разрешения Макса 10.10.2026; 45-BIG.pdf - паспорт одной фрезеровки №45 (растр 48 МБ), не общий каталог'}
json.dump(mill, open(mill_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
no = [it['id'] for it in mill['items'] if 'passport' not in it]
print('passports', len(P), 'without', len(no))
print(' '.join(no))
