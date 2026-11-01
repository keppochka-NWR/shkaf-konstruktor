import { appendModule, type Project } from "./project";
import { newModuleName } from "./clientLabels";
import type { Module } from "./model";
import { settleAdded } from "./placement";

/** Корпус из палитры в комнату — с именем по виду («Для одежды», «Пустой шкаф · мансарда»), без «Модуль N».
 *  Пустая комната (первый корпус) называла его «Модуль 1», редактор следующие — по виду (руководство 30.10, п. 2). */
export function appendFromPalette(project: Project, source: Module): Project {
  const raw = appendModule(project, source);
  raw.modules.at(-1)!.module.name = newModuleName(source.name);
  // физика расстановки (Макс 31.10): навесной (подвесной ящик и т. п.) встаёт спиной к стене, а не в 30 мм от неё
  return settleAdded(raw, raw.modules.at(-1)!.id);
}
