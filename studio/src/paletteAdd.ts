import { appendModule, type Project } from "./project";
import { newModuleName } from "./clientLabels";
import type { Module } from "./model";

/** Корпус из палитры в комнату — с именем по виду («Для одежды», «Пустой шкаф · мансарда»), без «Модуль N».
 *  Пустая комната (первый корпус) называла его «Модуль 1», редактор следующие — по виду (руководство 30.10, п. 2). */
export function appendFromPalette(project: Project, source: Module): Project {
  const next = appendModule(project, source);
  next.modules.at(-1)!.module.name = newModuleName(source.name);
  return next;
}
