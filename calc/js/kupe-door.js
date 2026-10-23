// js/kupe-door.js
// Ширина полотна двери-купе с нахлёстом — общий расчёт калькулятора купе и Ё Конструктора
// (студия: studio/src/kupe.ts kupeLeafWidth; сверка обоих — studio/tests/kupe.test.ts).
// Полотна стоят в два ряда и перекрываются на ширину профиля-ручки (заводское сечение Aristo),
// поэтому полотно = (ширина проёма + (N − 1) × ширина ручки) / N. Одна дверь — во всю ширину проёма.
// Цена считается по-прежнему от проёма (W / N) — эта функция только для размеров полотна.

/** Ширина профиля-ручки на фасаде, мм — по сечениям «Схемы сборки систем ARISTO» и каталогу ARISTO 2026 (как в студии). */
var KUPE_HANDLE_W = {
  c: 26.51, flat: 44.97, i: 26, fusion: 39.5, smart: 26, avers: 20, twelve: 12,
  c_eco: 26, h_eco: 35.17, flat_eco: 26.01, o: 25.99,
  slim: 15.43, slim_max: 15.44, nova: 22, grace: 10.68
};

/** Ручка системы по названию профиля в прайсе (как kupeProfileStyle студии). */
function kupeHandleStyle(profile) {
  var p = String(profile || '').toLowerCase(), eco = /эко/.test(p);
  if (/slim max/.test(p)) return 'slim_max';
  if (/slim/.test(p)) return 'slim';
  if (/grace/.test(p)) return 'grace';
  if (/nova/.test(p)) return 'nova';
  if (/fusion/.test(p)) return 'fusion';
  if (/smart/.test(p)) return 'smart';
  if (/avers/.test(p)) return 'avers';
  if (/twelve/.test(p)) return 'twelve';
  if (/flat/.test(p)) return eco ? 'flat_eco' : 'flat';
  if (/^h(\s|$)/.test(p)) return 'h_eco';
  if (/^o(\s|$)/.test(p)) return 'o';
  if (/^i(\s|$)/.test(p)) return 'i';
  return eco ? 'c_eco' : 'c';
}

/** Профиль-ручка систем прайса калькулятора без поля profile (data/profiles.js 2026.04.29) — как в прайсе студии. */
var KUPE_SYSTEM_PROFILE = {
  'Стандарт (Аристо)': 'C (классика)', 'Стандарт Декор (Аристо)': 'FLAT (декор / ПВХ)', 'Slim line (Аристо)': 'SLIM',
  'Slim Fine (Аристо)': 'SLIM Fine', 'Эконом (Аристо)': 'C ЭКО', 'GRACE (Аристо)': 'GRACE (подвесная)'
};
function kupeSystemProfile(sys) { return (sys && (sys.profile || KUPE_SYSTEM_PROFILE[sys.system] || sys.system)) || ''; }

/** { width, overlap } — ширина полотна и нахлёст, мм (без округления). */
function kupeDoorWidth(W, N, profile) {
  var ov = N > 1 ? KUPE_HANDLE_W[kupeHandleStyle(profile)] : 0;
  return { width: (W + (N - 1) * ov) / N, overlap: ov };
}
