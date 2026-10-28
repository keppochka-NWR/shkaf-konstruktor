// Тип фасадов модуля (панель «Фасады»: ЛДСП / алюминиевая рамка / МДФ Вернисаж).
// Интеграция 29.10.2026 (сбой из сборки dp-2810 мышью): в закрытом списке стрелка вниз сразу применяет следующий пункт; у дверей выше
// 2000 «Алюминиевая рамка» не проходит проверку (СТП), правка откатывалась на ЛДСП и до «МДФ Вернисаж» стрелками было не дойти.
// Недопустимый для модуля пункт теперь недоступен (disabled — стрелки и мышь его пропускают), причина — в подсказке пункта.
import { DEFAULT_ALU } from "./alu";
import { DEFAULT_VERNISSAGE } from "./facadesVernissage";
import { validate, type Module } from "./model";

export type FacadeKind = "ldsp" | "alu" | "vernissage";
export const FACADE_KINDS: FacadeKind[] = ["ldsp", "alu", "vernissage"];
export const facadeKindOf = (m: Module): FacadeKind => (m.vernissage ? "vernissage" : m.alu ? "alu" : "ldsp");

/** Сменить тип фасадов модуля (как прежний обработчик списка «Тип фасадов»). */
export function setFacadeKind(n: Module, v: FacadeKind) {
  if (v === "alu") {
    n.alu = { ...DEFAULT_ALU };
    if (n.vernissage) { delete n.vernissage; delete n.facadeT; }
  } else if (v === "vernissage") {
    delete n.alu; delete n.aluDrawers;
    n.vernissage = { ...DEFAULT_VERNISSAGE };
    n.facadeT = DEFAULT_VERNISSAGE.thickness;
  } else {
    delete n.alu; delete n.aluDrawers;
    if (n.vernissage) { delete n.vernissage; delete n.facadeT; }
  }
}

/** Почему этот тип фасадов модулю не подходит — первая ошибка проверки модуля с ним; '' — подходит (или уже выбран). */
export function facadeKindBlock(m: Module, v: FacadeKind): string {
  if (facadeKindOf(m) === v) return "";
  const n = structuredClone(m);
  try { setFacadeKind(n, v); return validate(n)[0] ?? ""; } catch (e) { return (e as Error).message; }
}
