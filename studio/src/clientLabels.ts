import { createContext } from "react";
import type { VernissageMilling } from "./facadesVernissage";

/** Подписи для экрана клиента (аудит магазина 15.10, «Лишние цифры и техмусор»).
 *  Клиент видит короткие названия без кодов, артикулов и пометок источника; менеджер (режим «Все настройки») — полные подписи.
 *  Данные (названия декоров, артикулы, паспорта) не меняются — меняется только то, что выводится на экран. */

/** Режим менеджера = «Все настройки». App даёт значение, панели читают без пропсов. */
export const ManagerMode = createContext(false);

export type FacadeKindLabel = "ldsp" | "external" | "vernissage" | "alu";
/** Материал фасадов — клиентские названия без «в раскрое цеха», «сторонний участок», «(прайс)». */
export const FACADE_KIND_LABEL: Record<FacadeKindLabel, string> = {
  ldsp: "ЛДСП",
  vernissage: "МДФ Вернисаж",
  alu: "Алюминиевая рамка",
  external: "Другой материал — МДФ, эмаль, плёнка",
};

/** Подпись декора: без кода тиснения «D*» и без номера декора («Серый 7810» → «Серый»). */
export function decorLabel(name: string): string {
  const s = name.replace(/\s*D\*\s*$/, "").replace(/\s+\d{3,}\s*$/, "").trim();
  return s || name;
}
/** Подсказка к декору: полное название с кодом — для менеджера и заказа. Пусто, если кода нет. */
export function decorTitle(name: string): string | undefined {
  return decorLabel(name) === name ? undefined : `Код в каталоге: ${name}`;
}

/** Итог без цены у части позиций — нейтрально, без «Нет цены». */
export function missingPriceLabel(count: number): string {
  return `Цена уточняется (${count} поз.)`;
}

/** Имя нового модуля из палитры: без порядкового номера («Для одежды», не «Для одежды 4») — номер виден в списке модулей. */
export function newModuleName(label: string): string {
  return label.replace(/\s+\d+$/, "");
}

/** Петли в списке бренда: без цены (цена — в смете). */
export function hingeBrandLabel(b: { label: string; note: string }): string {
  return `${b.label} · ${b.note}`;
}

/** Профиль-ручка купе: клиенту — только название; менеджеру — ширина профиля, целые мм. */
export function kupeProfileCaption(profile: string, width: number | undefined, manager: boolean): string {
  return manager && width ? `Профиль-ручка · ${profile} · ${Math.round(width)} мм` : `Профиль-ручка · ${profile}`;
}

/** Бутылочница АЛЛЕГРО: клиенту — без артикула; менеджеру — с артикулом и «не подходит». */
export function allegroLabel(item: { base: number; side: "left" | "right"; article: string }, unfit: boolean, manager: boolean): string {
  const base = `АЛЛЕГРО ${item.base} · ${item.side === "left" ? "левая" : "правая"}`;
  return manager ? `${base} · ${item.article}${unfit ? " — не подходит" : ""}` : base;
}
/** Неподходящие варианты бутылочницы клиенту не показываем (кроме уже выбранного). */
export function allegroVisible(unfit: boolean, selected: boolean, manager: boolean): boolean {
  return manager || !unfit || selected;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Короткое имя рисунка фрезеровки Вернисаж по данным каталога; null — рисунок не определён (клиенту не показываем). */
export function millingName(m: Pick<VernissageMilling, "id" | "type" | "panel" | "inner" | "note" | "shapeNote" | "pp">): string | null {
  const t = (m.type ?? "").toLowerCase(), inner = (m.inner ?? "").toLowerCase(), panel = (m.panel ?? "").toLowerCase();
  const text = `${m.note ?? ""} ${m.shapeNote ?? ""}`.toLowerCase();
  // без типа рисунка: с паспортом PDF — только номер; без паспорта рисунок не определён → null
  if (!t) return m.pp ? "" : null;
  if (t.includes("ручка")) return `Ручка ${m.id}`;
  if (text.includes("«мыло»")) return "Мыло";
  if (t === "гладкий") return "Гладкий";
  if (inner.includes("ромб")) return "Ромбы";
  if (inner.includes("волн")) return "Волна";
  if (inner.includes("арка")) return t.includes("рамочная") ? "Рамка с аркой" : "Арка";
  if (/горизонт/.test(inner)) return t.includes("рамочная") ? "Рамка с горизонтальными пазами" : "Горизонтальные рейки";
  if (/вертикал|каннелюр/.test(inner)) return t.includes("рамочная") ? "Рамка с вертикальными пазами" : "Вертикальные рейки";
  if (inner.includes("линейн")) return "Линии";
  if (text.includes("шейкер")) return "Шейкер";
  if (t.includes("рамочная")) {
    if (inner.includes("второй контур")) return "Двойная рамка";
    if (panel.includes("выпукл")) return "Рамка с выпуклой филёнкой";
    if (inner.includes("декор") || inner.includes("фигурн")) return "Рамка с декором";
    return "Рамка";
  }
  if (t.includes("рельеф")) return "Рельеф";
  if (t.includes("фрезеровка по полотну")) return "Контур";
  return cap(t);
}
/** Фрезеровка в списке: клиенту «№15 Мыло», менеджеру — с паспортом/условностью и описанием рисунка. */
export function millingOptionLabel(m: VernissageMilling, o: { handle: boolean; misfit: boolean; manager: boolean }): string {
  const no = o.handle ? m.id : `№${m.id}`;
  if (o.manager) return `${no}${m.grafika ? " (Графика)" : ""}${m.pp ? " · паспорт" : " · условно"}${o.misfit ? " · не по размеру фасадов" : ""} — ${m.shapeNote}${m.mdf19Only ? " · МДФ 19 с петлями" : ""}`;
  const name = millingName(m);
  return `${no}${name && !o.handle ? " " + name : ""}${o.misfit ? " · не по размеру фасадов" : ""}`;
}
/** Неопознанный рисунок (тип не определён по каталогу) клиенту не показываем, кроме уже выбранного. */
export function millingVisible(m: VernissageMilling, selected: boolean, manager: boolean): boolean {
  return manager || selected || millingName(m) !== null;
}

/** X подписей проёмов секции (от центра корпуса): у крайней секции — снаружи корпуса на 60 мм (не поверх полок и подписей
 *  соседей), у средней — по центру секции. Слева снаружи стоит подпись высоты (−W/2−180), поэтому слева — ближе к корпусу. */
export function gapLabelX(b: { x: number; width: number }, moduleWidth: number, panel: number): number {
  const right = b.x + b.width >= moduleWidth - panel - 1, left = b.x <= panel + 1;
  if (right) return moduleWidth / 2 + 60;
  if (left) return -moduleWidth / 2 - 60;
  return b.x + b.width / 2 - moduleWidth / 2;
}
/** Подпись размера проёма в сцене: целые мм с единицей. */
export function openingSizeLabel(mm: number): string {
  return `${Math.round(mm)} мм`;
}
