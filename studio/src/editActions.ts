// Правки редактирования по списку Макса 29.10.2026 (ветка claude/fix-edit-2910): общая логика без интерфейса, чтобы её проверяли тесты.
//  • Delete: что удаляет клавиша — выбранную деталь (полка, ящик целиком, фасад, штанга) или корпус / отмеченные Ctrl+щелчком корпуса
//    (корпус — только через «Да, удалить / Отмена», как «Удалить корпус» в меню правой кнопки, решение 19.10).
//  • «Заменить у всех»: декор корпуса — всем корпусам проекта одной правкой (одна отмена), неподходящие — с причиной.
//  • Средняя кнопка (колёсико) по фасаду: что открывается — створка, ящик или весь корпус.
import type { Project } from "./project";
import type { Module } from "./model";
import { applyEach, skippedNote, type GroupResult } from "./groupFacades";
import { decorLabel } from "./clientLabels";

export type DeleteTarget = { kind: "part" } | { kind: "modules"; ids: string[] } | null;

/** Что удаляет Delete. part — выбрана удаляемая деталь; иначе отмеченные корпуса (Ctrl+щелчок), иначе выбранный корпус. null — ничего
 *  (ничего не выбрано, выбран объект помещения). */
export function deleteKeyTarget(o: { removablePart: boolean; groupIds: readonly string[]; activeId: string | undefined; deselected: boolean; environment: boolean }): DeleteTarget {
  if (o.removablePart) return { kind: "part" };
  if (o.environment) return null;
  if (o.groupIds.length) return { kind: "modules", ids: [...o.groupIds] };
  if (o.deselected || !o.activeId) return null;
  return { kind: "modules", ids: [o.activeId] };
}

/** Вопрос подтверждения: «Удалить корпус «Шкаф 1»?» / «Удалить 3 корпуса?». */
export function deleteQuestion(p: Project, ids: readonly string[]): string {
  const list = p.modules.filter((a) => ids.includes(a.id));
  if (list.length === 1) return `Удалить ${list[0].module.kupe ? "двери купе" : "корпус"} «${list[0].module.name}»?`;
  const n = list.length, word = n % 10 === 1 && n % 100 !== 11 ? "корпус" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "корпуса" : "корпусов";
  return `Удалить ${n} ${word}?`;
}

/** Что именно удаляется — имена корпусов в вопросе (критик 29.10: видно, какие корпуса отмечены): «Стеллаж», «Комод». */
export function deleteNames(p: Project, ids: readonly string[]): string {
  return p.modules.filter((a) => ids.includes(a.id)).map((a) => `«${a.module.name}» (${a.module.width} × ${a.module.height})`).join(", ");
}
/** Обычный щелчок по корпусу вне отмеченной группы снимает отметки (как в Проводнике): Delete потом удаляет этот корпус, а не группу. */
export function groupAfterPlainClick(groupIds: readonly string[], mid: string): string[] {
  return groupIds.includes(mid) ? [...groupIds] : [];
}

/** Корпуса ids — из проекта одной правкой. Последний корпус удаляется только там, где проект может быть пустым (комната заказа). */
export function removeModules(p: Project, ids: readonly string[], allowEmpty: boolean): Project {
  const keep = p.modules.filter((a) => !ids.includes(a.id));
  if (keep.length === p.modules.length) throw Error("Корпус для удаления не найден.");
  if (!keep.length && !allowEmpty) throw Error("Последний корпус проекта не удаляется: добавьте другой корпус или начните новый проект.");
  return { ...p, modules: keep };
}

/** «Удалить секцию» в меню правой кнопки: у шкафа студии из 2+ секций (кухня, импорт Базиса, столешница, купе — нет), как в панели. */
export function sectionRemoveApplies(m: Module): boolean {
  return m.sections.length > 1 && !m.kitchen && !m.raw && !m.worktop && !m.kupe;
}

/** Почему декор корпуса к модулю не относится (null — относится). */
export function decorSkip(m: Module): string | null {
  if (m.kupe) return "двери купе — профиль и наполнение в их панели";
  if (m.worktop) return "столешница — свой материал";
  if (m.raw) return "импорт Базиса как есть";
  return null;
}

/** «Заменить у всех» (правка Макса 29.10): декор корпуса decor — всем корпусам проекта, к которым он относится, той же правкой, что
 *  у одного корпуса (поле decor, placeInRow по очереди — цена как при правке по одному). Пропущенные — с причиной. */
export function applyDecorAll(p: Project, decor: string): GroupResult & { note: string } {
  let r: GroupResult;
  try { r = applyEach(p, p.modules.map((a) => a.id), (n) => { const why = decorSkip(n); if (why) return why; n.decor = decor; }); }
  catch (e) { throw Error(String((e as Error).message).replace("из отмеченных модулей", "из корпусов проекта")); }
  const s = skippedNote(r.skipped);
  return { ...r, note: `Декор корпуса «${decorLabel(decor)}» — ${r.changed.length ? "заменён у " + r.changed.length + " из " + p.modules.length : "уже у всех подходящих"}.` + (s ? " " + s : "") };
}

/** Длительность открывания/закрывания створки или ящика, мс (правка Макса 29.10: «плавная анимация открытия»). */
export const OPEN_MS = 350;
/** Сглаживание доли открытия: плавный разгон и остановка (smoothstep). */
export const openEase = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
/** Доля открытия через dt мс по пути к цели target (0 или 1); dt ограничен кадром 64 мс — после паузы вкладки не прыгает. */
export function stepOpen(t: number, target: number, dt: number): number {
  const step = Math.min(Math.max(dt, 0), 64) / OPEN_MS;
  return t < target ? Math.min(target, t + step) : Math.max(target, t - step);
}

/** Средняя кнопка по детали: ключ того, что открыть/закрыть. Створка — сама дверь, ящик — весь ящик секции (`<секция>:drawer:<j>`),
 *  кухонный ящик — `kd:<N>`, купе — полотно; остальное — весь корпус («*»). */
export function openToggleKey(pid: string | undefined): string {
  if (!pid) return "*";
  const door = /^(.+:door:\d+)(?::\d+)?$/.exec(pid.replace(/:(hingecup|hingearm|handle):/, ":door:"));
  if (door && !pid.includes(":hingeplate:")) return door[1];
  const drawer = /^(.+?:drawer:\d+)(?::|$)/.exec(pid);
  if (drawer && !pid.includes(":slide:")) return drawer[1];
  const kd = /^(kd:\d+)(?::|$)/.exec(pid);
  if (kd && !pid.includes(":slide:")) return kd[1];
  return "*";
}
