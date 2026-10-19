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

export type MenuArea = { left: number; top: number; right: number; bottom: number };

/**
 * Центр кольца (замечание критика 20.10, п.5 / находка 6): меню целиком в области сцены и не налезает на правую панель
 * инструментов — area.right уже без панели. Сдвиг вбок от клика: вправо, если помещается, иначе влево; иначе — прижать в области.
 * r — радиус кольца, size — кнопка; по горизонтали запас под боковые подписи (~110 px).
 */
export function placeMenu(x: number, y: number, r: number, size: number, area: MenuArea) {
  const margin = r + size / 2 + 30, mx = r + size / 2 + 110, shift = r + size / 2 + 18;
  const lo = area.left + mx, hi = area.right - mx, top = area.top + margin, bottom = area.bottom - margin;
  const clamp = (v: number, a: number, b: number) => (a > b ? (a + b) / 2 : Math.min(Math.max(v, a), b));
  const cx = x + shift <= hi ? Math.max(x + shift, lo) : clamp(x - shift, lo, hi);
  return { cx, cy: clamp(y, top, bottom) };
}

/** Область для меню: canvas сцены минус правая вертикальная панель инструментов (если она справа), в пределах окна. */
export function menuArea(win: { width: number; height: number }, canvas?: MenuArea | null, tools?: MenuArea | null): MenuArea {
  const a = canvas ? { left: Math.max(0, canvas.left), top: Math.max(0, canvas.top), right: Math.min(win.width, canvas.right), bottom: Math.min(win.height, canvas.bottom) } : { left: 0, top: 0, right: win.width, bottom: win.height };
  if (tools && tools.right > tools.left && tools.left > (a.left + a.right) / 2 && tools.left < a.right) a.right = tools.left - 6;
  return a;
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
  // Замечание критика 20.10 (п.1): в ЛЮБОМ меню корпуса (клик по корпусу, промах мимо детали, «Корпус ›», двери купе)
  // красная кнопка — «Удалить корпус» и только через «Да, удалить / Отмена».
  const guard = (items: RadialItem[], what: string) => items.map((i) => (i.id === "delete" ? confirmDelete({ ...i, icon: Trash }, what) : i));
  if (!ring) {
    const items = guard(part.items, m.kupe ? "двери купе" : "корпус");
    return { ...part, items, subtitle: part.subtitle.includes("×") ? part.subtitle : dims + (part.subtitle ? " · " + part.subtitle : "") };
  }
  const guarded = guard(ring, "корпус");
  if (!clickedPart || part.title === m.name) return { title: m.name, subtitle: dims, items: guarded };
  const body: RadialItem = { id: "body", label: "Корпус", icon: Box, hint: "Все действия с корпусом: размеры, наполнение, удалить корпус",
    children: guarded };
  const what = /^Полка/.test(part.title) ? "полку" : /^Ящик/.test(part.title) ? "ящик" : /^Штанга/.test(part.title) ? "штангу" : /^Фасад/.test(part.title) ? "фасад" : "";
  // Фасад: его действия сразу на первом кольце (а не «Фасад ›» + «Корпус ›» — лишний клик на каждое действие).
  const flat = part.items.flatMap((i) => (i.id === "facade" && i.children?.length ? i.children : [i]));
  const items = flat.map((i) => (i.id === "body" ? body : i.id === "remove" && what ? { ...i, label: "Удалить " + what } : i));
  if (!items.some((i) => i.id === "body")) items.push(body);
  return { title: part.title, subtitle: m.name + " · " + dims, items };
}
