// data/profiles.js
// Каталог систем профилей Аристо для дверей-купе + конфиги модуля купе.
// Public: PROFILE_SYSTEMS, SECTION_OPTS, SOFT_CLOSE_PRICE, COMPLEX_*, FILM_*
//
// При обновлении прайса:
// 1. Обновить значения цен в PROFILE_SYSTEMS (₽/пог.м.) — пересобрать bake-calc.py
// 2. Поднять PROFILES_VERSION
// 3. Обновить ?v=YYYYMMDD у тега script

const PROFILES_VERSION = '2026.04.29';

/**
 * PROFILES — системы профилей Аристо
 * Все цены — ₽ за погонный метр
 * napravl_top — верхняя направляющая (двухполосная)
 * napravl_bot — нижняя направляющая (двухполосная)
 * ruchka      — вертикальный профиль (считается 2×H на дверь)
 * verh        — рамка верхняя
 * niz         — рамка нижняя
 * razd        — рамка средняя / разделитель
 *
 * PROFILE_SYSTEMS — системы профилей с цветами
 * Цены от 29.04.2026
 * Все цены — ₽/пог.м.
 */
const PROFILE_SYSTEMS = [
  {
    system: 'Стандарт (Аристо)',
    // C731 — вертикальный 30мм
    dims: { frameSide:30, frameTop:40, frameBot:40, divider:20, trackTop:40, trackBot:12 },
    colors: [
      { name:'Серебро матовое',    frameGrad:'#d8d8d8,#f4f4f4,#b0b0b0', ruchka:1743, verh:843, niz:1683, razd:1161, napravl_top:2553, napravl_bot:1203 },
      { name:'Чёрный матовый',     frameGrad:'#1a1a1a,#383838,#0e0e0e', ruchka:1953, verh:951, niz:1902, razd:1311, napravl_top:2886, napravl_bot:1356 },
      { name:'Шампань матовая',    frameGrad:'#d4c8a0,#ece0bc,#b8ac88', ruchka:1812, verh:876, niz:1752, razd:1206, napravl_top:2658, napravl_bot:1251 },
      { name:'Золото матовое',     frameGrad:'#c8a838,#e8c850,#a88820', ruchka:1836, verh:885, niz:1773, razd:1221, napravl_top:2691, napravl_bot:1266 },
      { name:'Бронза глянец',      frameGrad:'#8c6030,#c49050,#6a4020', ruchka:1908, verh:921, niz:1722, razd:1269, napravl_top:2796, napravl_bot:1317 },
    ],
  },
  {
    system: 'Стандарт Декор (Аристо)',
    // Flat — вертикальный 40мм
    dims: { frameSide:40, frameTop:40, frameBot:40, divider:20, trackTop:40, trackBot:12 },
    colors: [
      { name:'Антрацит',           frameGrad:'#3a3a3a,#555555,#252525', ruchka:2115, verh:936, niz:1902, razd:1179, napravl_top:3168, napravl_bot:1512 },
      { name:'Белый матовый (ПВХ)',frameGrad:'#e8e8e8,#f8f8f8,#d0d0d0', ruchka:2115, verh:936, niz:1902, razd:1179, napravl_top:3168, napravl_bot:1512 },
      { name:'Венге тёмный',       frameGrad:'#2e1e10,#4a3020,#1e1008', ruchka:2115, verh:936, niz:1902, razd:1179, napravl_top:3168, napravl_bot:1512 },
      { name:'Дуб белый',          frameGrad:'#e0d8c8,#f0e8d8,#c8c0b0', ruchka:2115, verh:936, niz:1902, razd:1179, napravl_top:3168, napravl_bot:1512 },
      { name:'Дуб дымчатый',       frameGrad:'#8a7a60,#a89878,#6a5a40', ruchka:2115, verh:936, niz:1902, razd:1179, napravl_top:3168, napravl_bot:1512 },
      { name:'Дуб кантри',         frameGrad:'#a07840,#c09858,#806030', ruchka:1794, verh:870, niz:1758, razd:1203, napravl_top:3009, napravl_bot:1434 },
      { name:'Ванильный кашемир',  frameGrad:'#ddd0b0,#ede0c0,#c8b898', ruchka:2115, verh:936, niz:1902, razd:1179, napravl_top:3168, napravl_bot:1512 },
      { name:'Вельвет Дарк',       frameGrad:'#2a2430,#3e3848,#181420', ruchka:2115, verh:936, niz:1902, razd:1179, napravl_top:3168, napravl_bot:1512 },
    ],
  },
  {
    system: 'Slim line (Аристо)',
    // Slim — вертикальный 12мм
    dims: { frameSide:12, frameTop:40, frameBot:40, divider:20, trackTop:40, trackBot:12 },
    colors: [
      { name:'Серебро матовое',    frameGrad:'#d0d0d0,#ebebeb,#a8a8a8', ruchka:1167, verh:1110, niz:2199, razd:1227, napravl_top:2553, napravl_bot:1203 },
      { name:'Чёрный матовый',     frameGrad:'#1a1a1a,#303030,#0e0e0e', ruchka:1332, verh:1263, niz:2502, razd:1386, napravl_top:2886, napravl_bot:1356 },
      { name:'Белый глянец',       frameGrad:'#f0f0f0,#ffffff,#d8d8d8', ruchka:1332, verh:1386, niz:2502, razd:1386, napravl_top:2886, napravl_bot:1356 },
      { name:'Шампань матовая',    frameGrad:'#d0c49c,#e4d8b0,#b4a880', ruchka:1179, verh:1239, niz:2220, razd:1239, napravl_top:2658, napravl_bot:1251 },
      { name:'Золото кракелюр',    frameGrad:'#c0a030,#dcc048,#9a8020', ruchka:1458, verh:1386, niz:2739, razd:1518, napravl_top:3153, napravl_bot:1473 },
    ],
  },
  {
    system: 'Slim Fine (Аристо)',
    // Slim Fine — вертикальный 12мм
    dims: { frameSide:12, frameTop:40, frameBot:40, divider:20, trackTop:40, trackBot:12 },
    colors: [
      { name:'Серебро матовое',    frameGrad:'#d0d0d0,#ebebeb,#a8a8a8', ruchka:1128, verh:1071, niz:2124, razd:1185, napravl_top:2553, napravl_bot:1203 },
      { name:'Чёрный матовый',     frameGrad:'#1a1a1a,#303030,#0e0e0e', ruchka:1287, verh:1221, niz:2418, razd:1338, napravl_top:2886, napravl_bot:1356 },
      { name:'Белый глянец',       frameGrad:'#f0f0f0,#ffffff,#d8d8d8', ruchka:1287, verh:1341, niz:2418, razd:1338, napravl_top:2886, napravl_bot:1356 },
    ],
  },
  {
    system: 'Эконом (Аристо)',
    // ЭКО — вертикальный 30мм
    dims: { frameSide:30, frameTop:40, frameBot:40, divider:20, trackTop:40, trackBot:12 },
    colors: [
      { name:'Серебро матовое',    frameGrad:'#c8c8c8,#e0e0e0,#a0a0a0', ruchka:1017, verh:690, niz:1293, razd:657, napravl_top:1653, napravl_bot:762 },
      { name:'Белый глянец',       frameGrad:'#eeeeee,#ffffff,#d4d4d4', ruchka:1071, verh:729, niz:1356, razd:693, napravl_top:1740, napravl_bot:801 },
      { name:'Шампань матовая',    frameGrad:'#ccc0a0,#ddd4b4,#aaa088', ruchka:1068, verh:732, niz:1365, razd:687, napravl_top:1737, napravl_bot:795 },
      { name:'Золото матовое',     frameGrad:'#c0a030,#d8b848,#9a8020', ruchka:1110, verh:756, niz:1407, razd:711, napravl_top:1803, napravl_bot:831 },
      { name:'Бронза матовая',     frameGrad:'#906040,#b08058,#704830', ruchka:1068, verh:732, niz:1365, razd:687, napravl_top:1737, napravl_bot:795 },
    ],
  },
  {
    system: 'GRACE (Аристо)',
    // GRACE — вертикальный 12мм
    dims: { frameSide:12, frameTop:40, frameBot:40, divider:20, trackTop:40, trackBot:12 },
    colors: [
      { name:'Чёрный матовый',     frameGrad:'#111111,#2a2a2a,#080808', ruchka:2328, verh:4083, niz:3267, razd:2424, napravl_top:6390, napravl_bot:1473 },
    ],
  },
  {
    system: 'Свои цены',
    dims: { frameSide:30, frameTop:40, frameBot:40, divider:20, trackTop:40, trackBot:12 },
    colors: [
      { name:'Ручная настройка',   frameGrad:'#c0c0c0,#e0e0e0,#a0a0a0', ruchka:1800, verh:900, niz:1800, razd:1200, napravl_top:2400, napravl_bot:1200 },
    ],
  },
];

// sectH = горизонтальных делителей, sectV = вертикальных делителей
// 6 секций = 1 вертикальный + 2 горизонтальных (1 колонка, 3 ряда слева + 3 справа)
// 8 секций = 1 вертикальный + 3 горизонтальных
const SECTION_OPTS = [
  { h:0, v:0, label:'1 секция',          rowRatios:[1],                       colRatios:[1]        },
  { h:1, v:0, label:'2 равные',          rowRatios:[0.5, 0.5],                colRatios:[1]        },
  { h:1, v:0, label:'Верх ⅔ · Низ ⅓',   rowRatios:[2/3, 1/3],                colRatios:[1]        },
  { h:1, v:0, label:'Верх ⅓ · Низ ⅔',   rowRatios:[1/3, 2/3],                colRatios:[1]        },
  { h:2, v:0, label:'3 гориз.',          rowRatios:[1/3, 1/3, 1/3],           colRatios:[1]        },
  { h:2, v:0, label:'Вставка по центру', rowRatios:[0.45, 0.10, 0.45],        colRatios:[1]        },
  { h:3, v:0, label:'4 гориз.',          rowRatios:[0.25, 0.25, 0.25, 0.25],  colRatios:[1]        },
  { h:1, v:1, label:'4 секции',          rowRatios:[0.5, 0.5],                colRatios:[0.5, 0.5] },
  { h:2, v:1, label:'6 секций',          rowRatios:[1/3, 1/3, 1/3],           colRatios:[0.5, 0.5] },
  { h:3, v:1, label:'8 секций',          rowRatios:[0.25, 0.25, 0.25, 0.25],  colRatios:[0.5, 0.5] },
];

const SOFT_CLOSE_PRICE = 7000; // ₽ за дверь
const COMPLEX_WORK_PRICE = 6000; // ₽ за дверь
const COMPLEX_SECTIONS_THRESHOLD = 4; // >= порога → сложная работа

// Противоосколочные / армировочные плёнки (цена — ₽/м²)
const FILM_ARMOR  = { name:'Армировочная плёнка',                p:240  }; // зеркала, лакобель, ЛДСП
const FILM_SAFETY = { name:'Противоосколочная плёнка (SF 2 mil)', p:3475 }; // прозрачное/тонированное стекло
