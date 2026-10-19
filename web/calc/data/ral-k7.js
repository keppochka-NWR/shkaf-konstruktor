// data/ral-k7.js
// Палитра RAL Classic K7 — наиболее популярные цвета для МДФ-фасадов.
// Полный каталог содержит ~220 цветов; на MVP включено ~40 самых ходовых.
// Public: RAL_K7, RAL_K7_VERSION

const RAL_K7_VERSION = '2026.05.05';

/**
 * RAL Classic K7 — структура: { code, name, hex, group }
 * group: 'whites' | 'greys' | 'blacks' | 'beiges' | 'browns' | 'reds' | 'blues' | 'greens'
 */
const RAL_K7 = [
  // Белые
  { code:'9001', name:'Кремово-белый',         hex:'#FDF4E3', group:'whites' },
  { code:'9002', name:'Серо-белый',            hex:'#E7EBDA', group:'whites' },
  { code:'9003', name:'Сигнальный белый',      hex:'#F4F4F4', group:'whites' },
  { code:'9010', name:'Белый',                 hex:'#FFFFFF', group:'whites' },
  { code:'9016', name:'Транспортный белый',    hex:'#F1F0EA', group:'whites' },

  // Серые
  { code:'7035', name:'Светло-серый',          hex:'#CBCFC4', group:'greys' },
  { code:'7044', name:'Шёлково-серый',         hex:'#CAC4B0', group:'greys' },
  { code:'7038', name:'Агатовый серый',        hex:'#B5B8B1', group:'greys' },
  { code:'7037', name:'Пыльно-серый',          hex:'#7D7F7D', group:'greys' },
  { code:'7016', name:'Антрацитово-серый',     hex:'#293133', group:'greys' },
  { code:'7022', name:'Серый умбра',           hex:'#332F2C', group:'greys' },
  { code:'7045', name:'Телегрей 1',            hex:'#90969C', group:'greys' },
  { code:'7042', name:'Серый дорожный А',      hex:'#8F9695', group:'greys' },

  // Чёрные
  { code:'9005', name:'Чёрный янтарный',       hex:'#0A0A0A', group:'blacks' },
  { code:'9011', name:'Графитово-чёрный',      hex:'#1C1C1C', group:'blacks' },
  { code:'9017', name:'Транспортный чёрный',   hex:'#1E1E1E', group:'blacks' },

  // Бежевые / песочные
  { code:'1013', name:'Жемчужно-белый',        hex:'#EAE6CA', group:'beiges' },
  { code:'1014', name:'Слоновая кость',        hex:'#DFCEA1', group:'beiges' },
  { code:'1015', name:'Светлая слоновая кость',hex:'#EADEBD', group:'beiges' },
  { code:'1019', name:'Серо-бежевый',          hex:'#A48F7A', group:'beiges' },
  { code:'1024', name:'Жёлтая охра',           hex:'#BAA04B', group:'beiges' },
  { code:'1019', name:'Кашемир',               hex:'#A48F7A', group:'beiges' },

  // Коричневые
  { code:'8001', name:'Охра коричневая',       hex:'#9D622B', group:'browns' },
  { code:'8002', name:'Сигнальный коричневый', hex:'#8E402A', group:'browns' },
  { code:'8003', name:'Глиняный коричневый',   hex:'#7B5141', group:'browns' },
  { code:'8011', name:'Коричневый орех',       hex:'#5A3A29', group:'browns' },
  { code:'8014', name:'Сепия коричневый',      hex:'#4A3526', group:'browns' },
  { code:'8017', name:'Шоколадный',            hex:'#45322E', group:'browns' },
  { code:'8019', name:'Серо-коричневый',       hex:'#3F3A3A', group:'browns' },
  { code:'8022', name:'Чёрно-коричневый',      hex:'#1A1A1A', group:'browns' },

  // Красные / винные
  { code:'3003', name:'Рубиново-красный',      hex:'#9B111E', group:'reds' },
  { code:'3004', name:'Пурпурно-красный',      hex:'#75151E', group:'reds' },
  { code:'3005', name:'Винно-красный',         hex:'#5E2129', group:'reds' },
  { code:'3007', name:'Чёрно-красный',         hex:'#412227', group:'reds' },

  // Синие
  { code:'5002', name:'Ультрамарин',           hex:'#1E2160', group:'blues' },
  { code:'5003', name:'Сапфирово-синий',       hex:'#1D334A', group:'blues' },
  { code:'5008', name:'Серо-синий',            hex:'#26323A', group:'blues' },
  { code:'5011', name:'Стальной синий',        hex:'#1A2C3E', group:'blues' },
  { code:'5014', name:'Голубино-синий',        hex:'#637D96', group:'blues' },

  // Зелёные
  { code:'6005', name:'Зелёный мох',           hex:'#114232', group:'greens' },
  { code:'6009', name:'Пихтовый зелёный',      hex:'#27352A', group:'greens' },
  { code:'6011', name:'Резедово-зелёный',      hex:'#587246', group:'greens' },
  { code:'6021', name:'Бледно-зелёный',        hex:'#89AC76', group:'greens' },
];

const RAL_GROUPS = {
  whites: 'Белые',
  greys:  'Серые',
  blacks: 'Чёрные',
  beiges: 'Бежевые',
  browns: 'Коричневые',
  reds:   'Красные',
  blues:  'Синие',
  greens: 'Зелёные',
};
