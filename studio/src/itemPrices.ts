// Цена по каждому изделию для клиента (КП, «Кратко для клиента» в Excel). Листы ЛДСП общие на весь проект (раскрой), поэтому
// цена изделия — доля итога: смета каждого изделия отдельно (розница, те же цены и коэффициент проекта) задаёт пропорцию,
// итог делится по ней и округляется так, чтобы сумма цен изделий была ровно итогом. Закупочных цен здесь нет — только розница.
// K4 (критик 22.10, раунд 2): в отдельной смете изделия листы шли ЦЕЛЫМИ — навесной 400 и 600 занимали по листу и получали
// одинаковую долю, угловой 900 выходил дешевле нижнего 400. Для пропорции листы плиты/ЛХДФ и работа цеха за лист считаются по
// занятой площади (доля листа), а не целыми листами: больше материала — больше доля.
// K3: изделие, у которого все позиции «после финального расчёта конструктором» (столешница и т. п.), — без доли («0 ₽» в КП был
// неверен); признак pending — у изделия есть такие позиции.
import { estimate, type PriceLine } from "./pricing";
import { nest, type Sheet } from "./exports";
import { clientLine, SHEETS_LINE_ID } from "./clientPrices";
import type { Project } from "./project";

/** Доля листа по занятой деталями площади (для пропорции цен изделий). */
const used = (s: Sheet) => s.width > 0 && s.height > 0 ? Math.min(1, s.items.reduce((a, it) => a + it.w * it.h, 0) / (s.width * s.height)) : 1;
/** Строка сметы, которая считается целыми листами раскроя: id → доля листов по площади. */
function fractionalSheets(plan: Sheet[]): Map<string, number> {
  const out = new Map<string, number>(), put = (id: string, v: number) => out.set(id, (out.get(id) ?? 0) + v);
  for (const s of plan) {
    const f = used(s);
    if (s.material === "hdf") { put("sheet:hdf", f); put("work-hdf", f); continue; }
    const t = s.thickness ?? 16;
    put("sheet:" + s.decor + (Math.abs(t - 16) < 0.01 ? "" : ":" + t), f); put("work", f); put(SHEETS_LINE_ID, f);
  }
  return out;
}
/** Собственная «цена» изделия для пропорции: розница строк (как у клиента), листы — по занятой площади. null — смета не считается. */
export function ownValue(q: Project): { value: number; pending: boolean } | null {
  let plan: Sheet[], e: ReturnType<typeof estimate>;
  try { plan = nest(q); e = estimate(q, plan); } catch { return null; }
  if (e.retail === null && !e.pending.length) return null;
  const frac = fractionalSheets(plan);
  const value = e.lines.reduce((s, l: PriceLine) => {
    if (l.pending || l.unitPrice === null) return s;
    const c = clientLine(l, e.markup, e.vernissageMarkup, "markup");
    if (c.unitPrice === null) return s;
    const qty = frac.has(l.id) ? frac.get(l.id)! : l.quantity;
    return s + qty * c.unitPrice;
  }, 0);
  return { value: Number.isFinite(value) && value > 0 ? value : 0, pending: e.pending.length > 0 };
}

/** Цены изделий и признак «есть позиции после финального расчёта» в порядке p.modules; сумма цен = total. */
export function moduleQuote(p: Project, total: number | null): { prices: number[]; pending: boolean[] } | null {
  if (total === null || !Number.isFinite(total) || total <= 0 || !p.modules.length) return null;
  const own: number[] = [], pending: boolean[] = [];
  for (const a of p.modules) {
    const v = ownValue({ ...p, modules: [a] });
    if (!v) return null;
    own.push(v.value); pending.push(v.pending);
  }
  if (p.modules.length === 1) return own[0] > 0 || !pending[0] ? { prices: [total], pending } : null;
  const sum = own.reduce((s, v) => s + v, 0);
  if (!(sum > 0)) return null;
  // итог кратен сотне — цены изделий тоже сотнями; иначе — рублями
  const step = Math.round(total) % 100 === 0 ? 100 : 1, units = Math.round(total / step);
  const raw = own.map((v) => (v / sum) * units), out = raw.map(Math.floor);
  let rest = units - out.reduce((s, v) => s + v, 0);
  // метод наибольших остатков: недостающие единицы — изделиям с самой большой дробной частью (изделие без доли не получает)
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).filter(([, i]) => own[i] > 0).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0 && order.length; k++, rest--) out[order[k % order.length][1]]++;
  return { prices: out.map((v) => v * step), pending };
}
/** Цены изделий в порядке p.modules, сумма = total. null — разделить нельзя (нет итога, у изделия нет цены, смета не считается). */
export function modulePrices(p: Project, total: number | null): number[] | null {
  return moduleQuote(p, total)?.prices ?? null;
}
/** Изделие только из позиций «после финального расчёта конструктором» (доля 0): карточка КП пишет это вместо «0 ₽». */
export const PENDING_ITEM_PRICE = "цена после финального расчёта конструктором";
