// Заказ 7427796 мышью (26.10.2026): в шкафу «Для одежды» штанга висит под полкой (rodAt не задан). Менеджер переносит полку вниз
// (полка 450 от пола, штанга под крышей) — штанга уезжала вслед за полкой под неё, и правка отказывала «под штангой нужно 900 мм».
// Теперь, если иначе правка не проходит, штанга остаётся на своей текущей высоте (rodAt), полка переезжает; дальше штангу можно поставить
// полем «Высота штанги от дна». Если правка проходит и так — поведение прежнее (штанга по-прежнему под полкой).
// 29.10 (правка Макса: штанга ставится независимо от места под ней — нехватка места не ошибка, а предупреждение): штанга закрепляется
// и тогда, когда вслед за полкой у неё пропало бы место под одеждой (новое предупреждение) — как было при ошибке.
import { boxes, parts, validate, rodClearanceWarnings, type Module } from "./model";

/** Полка j секции sid — центр на centerFromBottom мм от дна проёма; штанга «под полкой» закрепляется, только если без этого отказ
 *  или у штанги пропадает место под одеждой. */
export function moveShelfKeepRod(m: Module, sid: string, j: number, centerFromBottom: number): Module {
  const n = structuredClone(m), s = n.sections.find((x) => x.id === sid), b = boxes(n).find((x) => x.id === sid);
  if (!s || !b || j < 0 || j >= s.shelves.length) return n;
  const h = b.top - b.bottom;
  s.shelves[j] = centerFromBottom / h;
  if (s.rod && s.rodAt === undefined && (validate(n).length || rodClearanceWarnings(n).length > rodClearanceWarnings(m).length)) {
    const rod = parts(m).find((p) => p.id === sid + ":rod");
    if (rod) {
      const pinned = structuredClone(n);
      pinned.sections.find((x) => x.id === sid)!.rodAt = (rod.position[1] - b.bottom) / h;
      if (!validate(pinned).length) return pinned;
    }
  }
  return n;
}
