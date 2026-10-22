// Почему итог прыгнул целым листом (критик релиза 22.10, m3): перенос шкафа к стене / от стены без смены размеров меняет итог на
// ~14 000 ₽ — у стены сама ставится фальшпанель (или убирается), раскрой ЛДСП выходит на лист больше (меньше), а материал и работа
// цеха считаются целыми листами. Это не ошибка — окно «Стоимость» показывает число листов и подсказку.
import type { Project } from "./project";

export type SheetCalc = { ldsp: number; total: number | null; fillers: number };

/** Число фальшей проекта (у стен и угловых): по ним видно, что перенос модуля добавил или убрал деталь. */
export function fillerCount(p: Project): number {
  return p.modules.reduce((s, a) => s + Object.keys(a.module.wallFiller ?? {}).length + (a.module.cornerFiller ? 1 : 0), 0);
}
/** Тот же проект после правки (а не другая комната/файл): та же комната и хотя бы один общий модуль. */
export function sameDesign(a: Project, b: Project): boolean {
  if (a.room.width !== b.room.width || a.room.depth !== b.room.depth || a.room.height !== b.room.height) return false;
  const ids = new Set(a.modules.map((x) => x.id));
  return b.modules.some((x) => ids.has(x.id));
}
const rub = (n: number) => Math.abs(n).toLocaleString("ru-RU") + " ₽";
/** Подсказка, когда число листов ЛДСП изменилось: «Цена выросла на 13 900 ₽: листов ЛДСП 4 → 5 — у стены добавилась фальшпанель…». */
export function sheetChangeNote(prev: SheetCalc | null, next: SheetCalc): string | null {
  if (!prev || prev.ldsp === next.ldsp || prev.total === null || next.total === null) return null;
  const d = next.total - prev.total;
  const why = next.fillers > prev.fillers ? "у стены или в углу сама добавилась фальшпанель" : next.fillers < prev.fillers ? "фальшпанель у стены или в углу убрана" : "детали легли в раскрой иначе";
  return `${d === 0 ? "Цена та же" : `Цена ${d > 0 ? "выросла" : "снизилась"} на ${rub(d)}`}: листов ЛДСП ${prev.ldsp} → ${next.ldsp} — ${why}. Плита и работа цеха считаются целыми листами раскроя.`;
}
