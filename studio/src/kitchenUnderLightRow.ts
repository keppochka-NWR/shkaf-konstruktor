// Подсветка рабочей зоны под навесными — на уровне проекта (панель кухонного модуля: галочка у модуля и кнопка «всем навесным ряда»).
// Блок питания 12 В (m.lightPsu, отдельной строкой сметы — решение Макса 27.10.2026): при включении, если в ряду навесных блока
// ещё нет, он ставится один на ряд — у крайнего левого подсвеченного модуля (менеджер может снять/перенести галочкой).
import { wallRow } from "./kitchenProject";
import { setUnderLight } from "./kitchenUnderLight";
import { anyLight } from "./lights";
import type { Module } from "./model";
import type { PlacedModule, Project } from "./project";

const hasPsu = (m: Module) => !!(m.lightPsu || m.lightSensor || m.lightDimmer || m.lightSwitch);

/** Навесные ряда выбранного модуля (та же стена и поворот, kitchenProject.wallRow) слева направо. */
export function wallRowIds(p: Project, id: string): string[] {
  const rot = wallRow(p, id)[0]?.rotation ?? 0, along = (a: PlacedModule) => (rot % 180 === 0 ? a.x : a.z);
  return wallRow(p, id).sort((a, b) => along(a) - along(b)).map((a) => a.id);
}

/** Включить/снять подсветку рабочей зоны: row — всем навесным ряда, иначе только модулю id. */
export function setRowUnderLight(p: Project, id: string, on: boolean, row = true): Project {
  const ids = row ? wallRowIds(p, id) : [id];
  if (!ids.length || !p.modules.some((a) => a.id === id && a.module.kitchen?.role === "wall")) throw Error("Подсветка рабочей зоны — только у навесного кухонного модуля.");
  const next = p.modules.map((a) => {
    if (!ids.includes(a.id)) return a;
    const m = structuredClone(a.module);
    setUnderLight(m, on);
    // снятие: флаг блока питания без единой подсветки в модуле не нужен (в смете он и так не считается)
    if (!on && m.lightPsu && !anyLight(m)) delete m.lightPsu;
    return { ...a, module: m };
  });
  if (on) {
    const rowIds = wallRowIds(p, id), rowMods = next.filter((a) => rowIds.includes(a.id));
    if (!rowMods.some((a) => hasPsu(a.module))) {
      const first = rowIds.map((x) => rowMods.find((a) => a.id === x)!).find((a) => a.module.kitchen?.underLight);
      if (first) return { ...p, modules: next.map((a) => (a.id === first.id ? { ...a, module: { ...a.module, lightPsu: true as const } } : a)) };
    }
  }
  return { ...p, modules: next };
}
