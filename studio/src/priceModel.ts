import type { Project } from "./project";
import { MARKUP_DEFAULT } from "./pricing";
/** «Модель цены» проекта (менеджер, вкладка «Стоимость»): по коэффициенту, за лист, по большей из двух (calculation.maxModel,
 *  решение Макса 26.10.2026). Интеграция 26.10: одно поле maxModel; priceMax ветки o-7427796 читается при загрузке как maxModel (project.ts). */
export function withPriceModel(p: Project, v: string, sheetPrice: number): Project {
  const c = { ...(p.calculation ?? { markup: MARKUP_DEFAULT, overrides: {} }) };
  if (v !== "markup" && c.sheetPrice === undefined && sheetPrice > 0) c.sheetPrice = sheetPrice;
  if (v === "max") c.maxModel = true;
  else { delete c.maxModel; if (v === "sheet") c.model = "sheet"; else delete c.model; }
  return { ...p, calculation: c };
}
/** Название модели цены для сообщений менеджеру. */
export function priceModelLabel(c: Project["calculation"] | undefined): string {
  if (!c) return "по коэффициенту " + String(MARKUP_DEFAULT).replace(".", ",") + " (по умолчанию)";
  const base = c.maxModel ? "по большей модели" : c.model === "sheet" ? "за лист ЛДСП" : "по коэффициенту " + String(c.markup).replace(".", ",");
  return base + (c.sheetPrice && (c.maxModel || c.model === "sheet") ? " (" + c.sheetPrice.toLocaleString("ru-RU") + " ₽/лист)" : "");
}
/** Модель цены — свойство ЗАКАЗА (документа комнат), а не комнаты (критик 29.10, блокер 1). Проект, который открывают в комнате заказа
 *  («Новый проект», «Создать проект без мебели», импорт файла), получает настройки расчёта заказа: без поля — молча; со своими, отличными
 *  от заказа, — модель заказа приоритетна, а в `replaced` — модель из файла (для предупреждения менеджеру). */
export function withOrderCalculation(next: Project, order: Project["calculation"] | undefined): { project: Project; replaced?: Project["calculation"] } {
  if (!order) return { project: next };
  const own = next.calculation;
  const project = { ...next, calculation: structuredClone(order) };
  return own && JSON.stringify(own) !== JSON.stringify(order) ? { project, replaced: own } : { project };
}
