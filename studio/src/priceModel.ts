import type { Project } from "./project";
import { SHEET_PRICE_DEFAULT } from "./pricing";
/** Настройки расчёта заказа. Цена — ТОЛЬКО по листам (решение Макса 30.10.2026): выбора «Модель цены» больше нет, поля model/maxModel
 *  старых файлов отбрасываются при загрузке (project.ts). Здесь — подпись настроек для сообщений менеджеру. */
export function calculationLabel(c: Project["calculation"] | undefined): string {
  const sheet = c?.sheetPrice ?? SHEET_PRICE_DEFAULT, manual = c ? Object.keys(c.overrides ?? {}).length : 0;
  return "цена листа " + sheet.toLocaleString("ru-RU") + " ₽" + (c?.sheetPrice === undefined ? " (по умолчанию)" : "") + (manual ? ", ручных цен: " + manual : "");
}
/** Настройки расчёта — свойство ЗАКАЗА (документа комнат), а не комнаты (критик 29.10, блокер 1). Проект, который открывают в комнате заказа
 *  («Новый проект», «Создать проект без мебели», импорт файла), получает настройки расчёта заказа: без поля — молча; со своими, отличными
 *  от заказа, — настройки заказа приоритетны, а в `replaced` — настройки из файла (для предупреждения менеджеру). */
export type OrderCalculation = { project: Project; replaced?: Project["calculation"]; adopted?: Project["calculation"] };
export function withOrderCalculation(next: Project, order: Project["calculation"] | undefined): OrderCalculation {
  // настройки заказа не заданы: свои настройки проекта становятся настройками заказа — в `adopted`, чтобы сказать какие (круг 2)
  if (!order) return next.calculation ? { project: next, adopted: next.calculation } : { project: next };
  const own = next.calculation;
  const project = { ...next, calculation: structuredClone(order) };
  return own && JSON.stringify(own) !== JSON.stringify(order) ? { project, replaced: own } : { project };
}
/** Сообщение менеджеру о настройках расчёта проекта, открытого в комнате заказа (импорт файла, «Восстановить предыдущий проект»):
 *  настройки заказа сохранены, а в источнике были другие — или у заказа их не было и применены настройки источника. */
export function orderCalculationNotice(r: OrderCalculation, order: Project["calculation"] | undefined, source: "файле" | "резервной копии"): { title: string; text: string } | undefined {
  if (r.replaced) return { title: "Расчёт заказа сохранён", text: "В " + source + " свои настройки расчёта — " + calculationLabel(r.replaced) + ". Заказ считается по настройкам заказа — " + calculationLabel(order) + "." };
  if (r.adopted) return { title: "Расчёт заказа", text: "В заказе настройки расчёта не были заданы — применены настройки из " + (source === "файле" ? "файла" : "резервной копии") + ": " + calculationLabel(r.adopted) + ". Они действуют на весь заказ." };
  return undefined;
}
