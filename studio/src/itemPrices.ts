// Цена по каждому изделию для клиента (КП, «Кратко для клиента» в Excel). Листы ЛДСП общие на весь проект (раскрой), поэтому
// цена изделия — доля итога: смета каждого изделия отдельно (розница, те же цены и коэффициент проекта) задаёт пропорцию,
// итог делится по ней и округляется так, чтобы сумма цен изделий была ровно итогом. Закупочных цен здесь нет — только розница.
import { estimate } from "./pricing";
import type { Project } from "./project";

/** Цены изделий в порядке p.modules, сумма = total. null — разделить нельзя (нет итога, у изделия нет цены, смета не считается). */
export function modulePrices(p: Project, total: number | null): number[] | null {
  if (total === null || !Number.isFinite(total) || total <= 0 || !p.modules.length) return null;
  if (p.modules.length === 1) return [total];
  const own: number[] = [];
  for (const a of p.modules) {
    let v: number | null = null;
    try { v = estimate({ ...p, modules: [a] }).retail; } catch { v = null; }
    if (v === null || !Number.isFinite(v) || v < 0) return null;
    own.push(v);
  }
  const sum = own.reduce((s, v) => s + v, 0);
  if (!(sum > 0)) return null;
  // итог кратен сотне — цены изделий тоже сотнями; иначе — рублями
  const step = Math.round(total) % 100 === 0 ? 100 : 1, units = Math.round(total / step);
  const raw = own.map((v) => (v / sum) * units), out = raw.map(Math.floor);
  let rest = units - out.reduce((s, v) => s + v, 0);
  // метод наибольших остатков: недостающие единицы — изделиям с самой большой дробной частью
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0; k++, rest--) out[order[k % order.length][1]]++;
  return out.map((v) => v * step);
}
