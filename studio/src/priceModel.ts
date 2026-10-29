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
export type OrderCalculation = { project: Project; replaced?: Project["calculation"]; adopted?: Project["calculation"] };
export function withOrderCalculation(next: Project, order: Project["calculation"] | undefined): OrderCalculation {
  // модель заказа не выбрана (по умолчанию): своя модель проекта становится моделью заказа — в `adopted`, чтобы сказать какая (круг 2)
  if (!order) return next.calculation ? { project: next, adopted: next.calculation } : { project: next };
  const own = next.calculation;
  const project = { ...next, calculation: structuredClone(order) };
  return own && JSON.stringify(own) !== JSON.stringify(order) ? { project, replaced: own } : { project };
}
/** Сообщение менеджеру о модели цены проекта, открытого в комнате заказа (импорт файла, «Восстановить предыдущий проект»):
 *  модель заказа сохранена, а в источнике была другая — или модель заказа не была выбрана и применена модель источника. */
export function orderCalculationNotice(r: OrderCalculation, order: Project["calculation"] | undefined, source: "файле" | "резервной копии"): { title: string; text: string } | undefined {
  if (r.replaced) return { title: "Модель цены заказа сохранена", text: "В " + source + " своя модель цены — " + priceModelLabel(r.replaced) + ". Заказ считается по модели заказа — " + priceModelLabel(order) + ". Сменить её для всего заказа можно в «Модель цены»." };
  if (r.adopted) return { title: "Модель цены заказа", text: "В заказе модель цены не была выбрана — применена модель из " + (source === "файле" ? "файла" : "резервной копии") + ": " + priceModelLabel(r.adopted) + ". Она действует на весь заказ; сменить — в «Модель цены»." };
  return undefined;
}
