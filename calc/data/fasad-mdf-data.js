// data/fasad-mdf-data.js
// Константы модуля «Крашеные МДФ-фасады».
// Public: MDF_VERSION, MDF_BASE_PRICE, MDF_FINISHES, MDF_MILLINGS,
//         MDF_THICKNESS, MDF_LIMITS, MDF_HINGES

const MDF_VERSION = '2026.05.05';

/**
 * Базовая стоимость покраски за м²
 * (включает: МДФ-плита + грунт + покраска матовая + сушка + контроль).
 * Цвет (RAL) на цену не влияет.
 * Итоговая цена = (площадь × MDF_BASE_PRICE × finish.priceMultiplier)
 *                + milling.price
 *                + hingeCount × hinge.price
 */
const MDF_BASE_PRICE = 10000; // ₽/м²

/**
 * Покрытия — коэффициент к BASE_PRICE × площадь.
 */
const MDF_FINISHES = [
  { id:'matte',      name:'Матовое',     priceMultiplier:1.0,  desc:'Стандартное матовое покрытие' },
  { id:'glossy',     name:'Глянцевое',   priceMultiplier:1.15, desc:'Глянец, +15% к базовой' },
  { id:'soft-touch', name:'Soft-touch',  priceMultiplier:1.30, desc:'Бархатистое тактильное, +30%' },
];

/**
 * Фрезеровки — фиксированная цена за фасад + детальные техн. параметры.
 *
 * specs:
 *   thickness        — обязательная толщина МДФ (мм). Авто-фиксируется при выборе.
 *   step             — шаг фрезеровки (мм)
 *   depth            — глубина фрезеровки (мм)
 *   facadeProfile    — сечение поверхности (R28, V90, D12)
 *   edgeProfile      — сечение кромки (№011, Ф3)
 *   frameWidth       — ширина рамки для варианта «витрина» (мм)
 *   limits           — допустимые габариты фасада (Глухой/Витрина)
 *   stdWidths        — стандартный ряд ширин { from, to, step }
 *
 * iconSvg — компактное превью 60×40 для отображения в селекторе и КП.
 * Все паттерны вертикальные (от верха до низа фасада).
 */
const MDF_MILLINGS = [
  {
    id:'none',
    code:'—',
    name:'Без фрезеровки',
    price:0,
    desc:'Гладкий фасад',
    iconSvg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="60" height="40"><rect x="2" y="2" width="56" height="36" fill="#f6f1e7" stroke="#999" stroke-width=".6"/></svg>',
    specs:null
  },
  {
    id:'volna',
    code:'№1',
    name:'Волна',
    price:1500,
    desc:'Округлые вертикальные волны, шаг 32 мм, глубина 4 мм',
    iconSvg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="60" height="40"><rect x="2" y="2" width="56" height="36" fill="#dcd2bf" stroke="#999" stroke-width=".5"/><g><rect x="2" y="2" width="8" height="36" fill="#f0e7d0"/><rect x="18" y="2" width="8" height="36" fill="#f0e7d0"/><rect x="34" y="2" width="8" height="36" fill="#f0e7d0"/><rect x="50" y="2" width="8" height="36" fill="#f0e7d0"/></g><rect x="2" y="2" width="56" height="36" fill="none" stroke="#999" stroke-width=".5"/></svg>',
    specs:{
      thickness:19,
      step:32,
      depth:4,
      facadeProfile:'R28',
      edgeProfile:'№011',
      frameWidth:64,
      limits:{
        solid:   { minW:100, maxW:1170, minH:100, maxH:2750 },
        vitrine: { minW:196, maxW:1170, minH:196, maxH:2750 }
      },
      stdWidths:{ from:100, to:1156, step:32 }
    }
  },
  {
    id:'pryamaya',
    code:'№4-12',
    name:'Прямая',
    price:800,
    desc:'Узкие V-канавки (вельвет), шаг 12.5 мм, V90',
    iconSvg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="60" height="40"><rect x="2" y="2" width="56" height="36" fill="#f0e7d0" stroke="#999" stroke-width=".5"/><g stroke="#888" stroke-width=".4" opacity=".75"><line x1="6" y1="3" x2="6" y2="37"/><line x1="9.5" y1="3" x2="9.5" y2="37"/><line x1="13" y1="3" x2="13" y2="37"/><line x1="16.5" y1="3" x2="16.5" y2="37"/><line x1="20" y1="3" x2="20" y2="37"/><line x1="23.5" y1="3" x2="23.5" y2="37"/><line x1="27" y1="3" x2="27" y2="37"/><line x1="30.5" y1="3" x2="30.5" y2="37"/><line x1="34" y1="3" x2="34" y2="37"/><line x1="37.5" y1="3" x2="37.5" y2="37"/><line x1="41" y1="3" x2="41" y2="37"/><line x1="44.5" y1="3" x2="44.5" y2="37"/><line x1="48" y1="3" x2="48" y2="37"/><line x1="51.5" y1="3" x2="51.5" y2="37"/><line x1="55" y1="3" x2="55" y2="37"/></g></svg>',
    specs:{
      thickness:16,
      step:12.5,
      depth:3,
      facadeProfile:'V90',
      edgeProfile:'Ф3',
      frameWidth:73,
      limits:{
        solid:   { minW:96,  maxW:1170, minH:100, maxH:2750 },
        vitrine: { minW:196, maxW:1170, minH:196, maxH:2750 }
      },
      stdWidths:{ from:96, to:1146, step:50 }
    }
  },
  {
    id:'type3',
    code:'№7',
    name:'Тип 3 (рейка)',
    price:1200,
    desc:'Прямоугольные рейки, шаг 25 мм, глубина 3 мм',
    iconSvg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="60" height="40"><rect x="2" y="2" width="56" height="36" fill="#f0e7d0" stroke="#999" stroke-width=".5"/><g fill="#888" opacity=".55"><rect x="6" y="2" width="2" height="36"/><rect x="13" y="2" width="2" height="36"/><rect x="20" y="2" width="2" height="36"/><rect x="27" y="2" width="2" height="36"/><rect x="34" y="2" width="2" height="36"/><rect x="41" y="2" width="2" height="36"/><rect x="48" y="2" width="2" height="36"/><rect x="55" y="2" width="2" height="36"/></g></svg>',
    specs:{
      thickness:16,
      step:25,
      depth:3,
      facadeProfile:'D12',
      edgeProfile:'№011',
      frameWidth:64,
      limits:{
        solid:   { minW:96,  maxW:1170, minH:100, maxH:2750 },
        vitrine: { minW:196, maxW:1170, minH:196, maxH:2750 }
      },
      stdWidths:{ from:96, to:1146, step:50 }
    }
  },
];

/**
 * Доступные толщины МДФ-плиты (мм).
 * Используются как fallback. При выбранной фрезеровке толщина авто-фиксируется по specs.thickness.
 */
const MDF_THICKNESS = [16, 19];

/**
 * Минимальные/максимальные размеры фасада (мм) — общие для всех фрезеровок.
 * Конкретные ограничения для каждой фрезеровки см. specs.limits.
 */
const MDF_LIMITS = {
  minW: 96,  maxW: 1170,
  minH: 100, maxH: 2750,
};

/**
 * Каталог петель для МДФ-фасадов.
 * Все — стандартные 35мм чашечные с разной фурнитурой.
 * Цена за 1 шт.
 *
 * Применение:
 *   количество петель = h <= 1200 ? 2 : 3
 *   стоимость = count × price
 *
 * Положение петель: по умолчанию 100 мм от верха и низа.
 *   При 3 петлях — третья посередине между крайними.
 *   Возможна ручная корректировка (per-row hingeTopOffset/hingeBottomOffset).
 */
const MDF_HINGES = [
  { id:'blum',    name:'Blum Clip Top',     price:1200, desc:'Чашка 35мм, нажимная' },
  { id:'hettich', name:'Hettich Sensys',    price:1000, desc:'Чашка 35мм с доводчиком' },
  { id:'gtv',     name:'GTV',                price:300, desc:'Чашка 35мм базовая' },
];


/**
 * Стандартный отступ петли от края фасада (мм).
 * Применяется по умолчанию для верхней и нижней петель.
 */
const MDF_HINGE_DEFAULT_OFFSET = 100;
