import type { Project } from "./project";
import { collisionWarnings } from "./roomWarnings";

/** Итог проверки выбранного корпуса внизу правой панели («Построение»): та же проверка пересечений, что в панели
 *  «Пересечения деталей» (collisionWarnings) — раньше подпись «Габариты проверены» стояла всегда, даже при пересечениях (аудит Б5). */
export type BuildCheck = { ok: boolean; title: string; detail: string };
export function buildCheck(project: Project, moduleId: string): BuildCheck {
  const one = project.modules.filter((a) => a.id === moduleId);
  const hits = one.length ? collisionWarnings({ ...project, modules: one }) : [];
  if (!hits.length) return { ok: true, title: "Габариты проверены", detail: "Детали помещаются в лист, пересечений нет" };
  // сообщение панели справа без префикса «Имя модуля»: — он и так выбран
  const detail = hits[0].message.replace(/^«[^»]*»:\s*/, "");
  // торцевые ручки в зазоре между створками (B2) — своя понятная подпись, не «пересечения деталей»
  return { ok: false, title: /^торцев/.test(detail) ? "Торцевые ручки: мал зазор между створками" : "Есть пересечения деталей", detail };
}
