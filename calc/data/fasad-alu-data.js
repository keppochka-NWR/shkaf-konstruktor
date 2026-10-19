// data/fasad-alu-data.js
// Константы модуля «Фасады ALU» (рамочные алюминиевые фасады).
// Public: FASAD_PROFILES, FASAD_HINGES, FASAD_LIFT, FASAD_GASKET, FASAD_FILL_GROUPS

const FASAD_ALU_VERSION = '2026.03.25';

// Профили рамки (₽/м, цены от 25.03.2026)
const FASAD_PROFILES = [
  { id:'F1-09', name:'F1-09 (Стандарт)',  pricePerM:1794  },
  { id:'F1-17', name:'F1-17 (Слим)',       pricePerM:1569  },
  { id:'F1-19', name:'F1-19 (Премиум)',    pricePerM:3342 },
];

// Петли (₽/шт)
// types: на каких типах монтажа применима — nakl/polunakl/vkladnoy
const FASAD_HINGES = [
  { id:'gtv-std', name:'GTV стандарт',           price:440,  types:['nakl','polunakl'] },
  { id:'hettich', name:'Hettich',                 price:2000, types:['nakl','polunakl'] },
  { id:'gtv-air', name:'GTV Air Soft (скрытая)', price:14000, types:['vkladnoy'] },
];

// Подъёмник (комплект из 2 шт) — для откидных фасадов с открыванием вверх
const FASAD_LIFT = { name:'Подъёмник (комплект)', price:2000 }; // ₽/компл


// Уплотнитель (по периметру фасада)
const FASAD_GASKET = 150;        // ₽/м

// Допустимые категории FILLINGS для использования в фасадах
const FASAD_FILL_GROUPS = ['Стекло','Зеркала','Лакобель','Узорчатые (склад)','Узорчатые (заказные)'];

