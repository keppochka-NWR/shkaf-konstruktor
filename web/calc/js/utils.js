// js/utils.js
// Общие утилиты, используемые всеми модулями.
// Public: $, num, fmt, pluralDoors, debounce
// Depends on: ничего (только DOM API)

const $ = id => document.getElementById(id);

const num = (id, fallback = 0) => +$(id).value || fallback;

const fmt = n => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:0}).format(Math.round(n));

const pluralDoors = n => n === 1 ? 'дверь' : n < 5 ? 'двери' : 'дверей';

// Округление слагаемых так, чтобы их сумма в рублях совпала с итогом (без «копеечных» расхождений
// строка+строка≠итог). Каждое значение отклоняется от честного округления не более чем на 1 ₽.
function roundParts(values, total) {
  const r = values.map(v => Math.round(v));
  let diff = Math.round(total) - r.reduce((a, b) => a + b, 0);
  const idx = values.map((v, i) => i);
  if (diff > 0) {
    idx.sort((a, b) => (values[b] - r[b]) - (values[a] - r[a]));      // сильнее всего округлённые вниз
    for (let k = 0; diff > 0 && idx.length; k = (k + 1) % idx.length, diff--) r[idx[k]]++;
  } else if (diff < 0) {
    idx.sort((a, b) => (values[a] - r[a]) - (values[b] - r[b]));      // сильнее всего округлённые вверх
    for (let k = 0; diff < 0 && idx.length; k = (k + 1) % idx.length, diff++) r[idx[k]]--;
  }
  return r;
}

// Debounce — задержка для инпутов (ширина/высота и т.п.)
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
