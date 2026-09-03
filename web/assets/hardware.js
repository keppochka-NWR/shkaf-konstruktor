/* Каталог фурнитуры: направляющие, петли, штанги, ручки, сетчатые системы.
   sideDeduct - вычет от внутренней ширины секции на КАЖДУЮ сторону для корпуса ящика.
   lengths - доступные глубины направляющих в закупке цеха.
   Ручки и сетка Лемана Про дополняются парсером (handles-lemana.js / mesh-lemana.js). */

const SLIDES = {
  ball: {
    label: "шариковые",
    note: "GTV Versalite PLUS+ H45 с доводчиком",
    sideDeduct: 13,          // 12.7 мм на сторону, округлено
    lengths: [250, 300, 350, 400, 450, 500],
    minInnerW: 250, maxInnerW: 1000,
    price: { 250: 445, 350: 550, 450: 650, 500: 695 },
  },
  hidden: {
    label: "скрытого монтажа",
    note: "push-to-open - DTC, с доводчиком - Unihopper (правило закупки цеха)",
    sideDeduct: 21,          // типовой вычет скрытиков; TODO сверить с техничкой DTC
    bottomDeduct: 13,        // дно ящика ниже: направляющая под дном
    lengths: [300, 350, 400, 450, 500],
    minInnerW: 275, maxInnerW: 900,
    price: { 300: 1040, 350: 1100, 400: 1150, 450: 1200, 500: 1250 },
  },
  metabox: {
    label: "металлбоксы",
    note: "метабокс: металлические боковины в комплекте",
    sideDeduct: 17,          // на сторону по техничке метабоксов
    lengths: [270, 350, 400, 450, 500],
    boxHeights: [86, 118, 150, 167],
    minInnerW: 300, maxInnerW: 1200,
    price: { 350: 1419, 450: 1840, 500: 2046 },
  },
};

/* кромка 0,4: цвета, которые цех реально закупает (Победа) */
const EDGE_COLORS = [
  "Белый", "Белоснежный", "Чёрный", "Графит", "Кашемир серый", "Кремовый K",
  "Луно", "Клауд", "Тэффи", "Медея", "Небула", "Слэйт", "Орегано", "Терра",
  "Дуб Вотан", "Дуб Сонома светлый", "Дуб Солсбери", "Дуб Дарго",
  "Орех Бруно", "Блэквуд",
];

const HINGES = {
  gtv_soft: { label: "GTV с доводчиком", note: "стандарт цеха при ручках", price: 157 },
  gtv_free: { label: "GTV без пружины", note: "стандарт цеха при push-to-open", price: 80 },
};
const PUSH_LATCH = { label: "толкатель push-to-open", price: 90 };

const RODS = {
  round: { label: "штанга D25 хром", pricePerM: 300, holder: 40 },  // стандарт по заказам цеха
  square: { label: "труба 25×25", pricePerM: 350, holder: 45 },
};

/* Ручки: базовый набор цеха (HEXA - реальная закупка).
   Парсер Лемана Про дописывает сюда каталог через window.LEMANA_HANDLES. */
const HANDLES_BASE = [
  { id: "hexa160b", label: "HEXA 160 чёрный мат", len: 160, price: 245 },
  { id: "hexa256a", label: "HEXA 256 алюминий", len: 256, price: 350 },
  { id: "hexa1200b", label: "HEXA L-1200 чёрный мат", len: 1200, price: 1283 },
  { id: "torc160", label: "торцевая FP527 160", len: 160, price: 95 },
];

/* Сетчатые элементы гардеробной (типоразмеры; парсер Лемана уточняет артикулы).
   reqW - требуемая внутренняя ширина секции, reqD - минимальная глубина. */
const MESH_BASE = [
  { id: "basket450", label: "корзина сетчатая 450", reqW: 450, reqD: 440, h: 180, price: null },
  { id: "basket600", label: "корзина сетчатая 600", reqW: 600, reqD: 440, h: 180, price: null },
  { id: "shoes600", label: "обувница сетчатая 600", reqW: 600, reqD: 300, h: 140, price: null },
  { id: "pants450", label: "брючница выкатная 450", reqW: 450, reqD: 470, h: 120, price: null },
];

function handlesCatalog() {
  return (window.LEMANA_HANDLES || []).concat(HANDLES_BASE);
}
function meshCatalog() {
  return (window.LEMANA_MESH || []).concat(MESH_BASE);
}
