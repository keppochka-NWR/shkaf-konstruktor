// Клавиши поиска по параметрам (Макс 31.10.2026): Ctrl+K — везде, «/» — не в полях ввода. Физическая клавиша: работает и в русской раскладке.
// Отдельный модуль: им пользуется и сцена — во время тяги и инструмента Q поиск не открывается (критик 31.10).
import { editsText } from "./historyShortcuts";

export function searchShortcut(e: KeyboardEvent): "ctrl" | "slash" | null {
  if (e.repeat) return null;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === "KeyK") return "ctrl";
  const slash = !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "/" || (e.code === "Slash" && !e.shiftKey));
  if (!slash) return null;
  if (typeof Element === "undefined" || !(e.target instanceof Element)) return "slash"; // вне DOM (тесты) и с window — поиск
  return editsText(e.target) || e.target.closest("select") ? null : "slash";
}
