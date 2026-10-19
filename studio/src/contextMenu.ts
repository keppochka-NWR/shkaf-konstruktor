// Сборка кругового меню правой кнопки (ручной тест 19.10.2026, находка №5): основное — то, по чему кликнули.
// Клик по детали (полка, ящик, фасад, штанга): первое кольцо — действия ДЕТАЛИ (удалить полку — на первом кольце)
// + «Корпус ›» со всеми действиями модуля; «Удалить корпус» там — только через подтверждение.
// Клик по корпусу (не по детали) — меню модуля, как раньше. Предложение «ждёт подтверждения Макса» (docs/РЕШЕНИЯ.md ветки).
import { Box, Check, Trash, X } from "lucide-react";
import type { RadialItem } from "./RadialMenu";
import type { Module } from "./model";

export type RadialMenuSpec = { title: string; subtitle: string; items: RadialItem[] };

/** Подпись пункта кольца — наружу от центра: сверху/снизу только у пунктов почти на вертикали, остальные — сбоку
 *  (ручной тест 19.10: «Повернуть»/«Копия»/«Антресоль» налезали друг на друга, когда соседние подписи стояли над кнопками). */
export function labelSide(px: number, py: number, r: number) {
  if (Math.abs(px) < r * 0.2) return py > 0 ? " below" : " above";
  return px < 0 ? " left" : " right";
}

/** Подзаголовок с размерами корпуса: «1500 × 2500 × 704». */
export function moduleDims(m: Pick<Module, "width" | "height" | "depth">) {
  return `${m.width} × ${m.height} × ${m.depth}`;
}

/** «Удалить корпус» через подтверждение: следующее кольцо «Да, удалить» / «Отмена» — только мышью, без системных окон. */
export function confirmDelete(item: RadialItem, what = "корпус"): RadialItem {
  if (item.disabled || !item.run) return { ...item, label: "Удалить " + what };
  return { ...item, label: "Удалить " + what, run: undefined, hint: "Спросим подтверждение. Вернуть — Ctrl+Z", children: [
    { id: item.id + "-yes", label: "Да, удалить", icon: Check, danger: true, hint: "Удалить " + what + " целиком", run: item.run },
    { id: item.id + "-no", label: "Отмена", icon: X, hint: "Ничего не удалять", run: () => {} },
  ] };
}

/**
 * part — меню детали из partRadial (title — имя детали; пункт id 'body' — урезанный «Корпус»);
 * ring — полное кольцо модуля; null — у объекта своё кольцо (двери купе), отдаём как есть.
 */
export function composeContextMenu(m: Module, part: RadialMenuSpec, ring: RadialItem[] | null, clickedPart: boolean): RadialMenuSpec {
  const dims = moduleDims(m);
  if (!ring) return { ...part, subtitle: part.subtitle.includes("×") ? part.subtitle : dims + (part.subtitle ? " · " + part.subtitle : "") };
  if (!clickedPart || part.title === m.name) return { title: m.name, subtitle: dims, items: ring };
  const body: RadialItem = { id: "body", label: "Корпус", icon: Box, hint: "Все действия с корпусом: размеры, наполнение, удалить корпус",
    children: ring.map((i) => (i.id === "delete" ? confirmDelete({ ...i, icon: Trash }) : i)) };
  const what = /^Полка/.test(part.title) ? "полку" : /^Ящик/.test(part.title) ? "ящик" : /^Штанга/.test(part.title) ? "штангу" : /^Фасад/.test(part.title) ? "фасад" : "";
  // Фасад: его действия сразу на первом кольце (а не «Фасад ›» + «Корпус ›» — лишний клик на каждое действие).
  const flat = part.items.flatMap((i) => (i.id === "facade" && i.children?.length ? i.children : [i]));
  const items = flat.map((i) => (i.id === "body" ? body : i.id === "remove" && what ? { ...i, label: "Удалить " + what } : i));
  if (!items.some((i) => i.id === "body")) items.push(body);
  return { title: part.title, subtitle: m.name + " · " + dims, items };
}
