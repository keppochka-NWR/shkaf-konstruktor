// Замена фурнитуры сразу во всём проекте (нижняя панель «Фурнитура»). Решение Макса 06.10.2026:
// клиент меняет фурнитуру и сразу видит, как меняется цена. Возвращает новый проект; проверку делает commitProject.
import { drawerConfig, drawersBehindDoors, facadeHandleId, parts, rearClear, type Module } from "./model";
import { compatibleSlideLength, type DrawerConfig } from "./hardware";
import { DEFAULT_HANDLE } from "./handles";
import type { Project } from "./project";

const clone = (p: Project): Project => structuredClone(p);
/** Корпуса, где замену делаем: угловые пятиугольники имеют свою конструкцию ящиков и не трогаются. */
const plain = (m: Module) => !m.corner;

export type HardwareChoice = {
  handles: string[];
  slides: DrawerConfig["slide"][];
  opening: ("handle" | "push")[];
  fastening: ("confirmat" | "eccentric")[];
  hasDoors: boolean;
  hasDrawers: boolean;
};

/** Что сейчас стоит в проекте: по каждому виду список различных вариантов (пусто = такого нет). */
export function hardwareChoice(p: Project): HardwareChoice {
  const handles = new Set<string>(), slides = new Set<DrawerConfig["slide"]>(), opening = new Set<"handle" | "push">(), fastening = new Set<"confirmat" | "eccentric">();
  let hasDoors = false, hasDrawers = false;
  for (const a of p.modules) {
    const m = a.module;
    fastening.add(m.fastening ?? "confirmat");
    for (const d of parts(m)) {
      if (d.role === "handle") handles.add(facadeHandleId(m, d.id) ?? DEFAULT_HANDLE);
      if (d.role === "door" && d.id !== "slope-filler") { hasDoors = true; opening.add(m.doorOpen ?? "handle"); }
    }
    if (!plain(m)) continue;
    for (const s of m.sections) for (let j = 0; j < s.drawers; j++) { const c = drawerConfig(m, s, j); if (c.mesh) continue; hasDrawers = true; slides.add(c.slide); }
  }
  return { handles: [...handles], slides: [...slides], opening: [...opening], fastening: [...fastening], hasDoors, hasDrawers };
}

/** Одна ручка на все фасады и ящики проекта: снимаются индивидуальные ручки отдельных фасадов. */
export function setAllHandles(p: Project, handleId: string): Project {
  const next = clone(p);
  for (const a of next.modules) {
    const m = a.module;
    m.handleId = handleId;
    m.drawerHandleId = undefined;
    for (const s of m.sections) {
      if (s.doorHandles) s.doorHandles = undefined;
      if (s.drawerConfigs) s.drawerConfigs = s.drawerConfigs.map((c) => { const { handleId: _, ...rest } = c; return rest; });
    }
  }
  return next;
}

/** Тип направляющих у всех ящиков; длина подбирается под глубину корпуса. Ошибка, если для какого-то корпуса нет длины. */
export function setAllSlides(p: Project, slide: DrawerConfig["slide"]): Project {
  const next = clone(p);
  for (const a of next.modules) {
    const m = a.module;
    if (!plain(m)) continue;
    for (const s of m.sections) {
      if (!s.drawers) continue;
      const available = m.depth - rearClear(m) - (drawersBehindDoors(m, s) ? 44 : 25);
      s.drawerConfigs = Array.from({ length: s.drawers }, (_, j) => {
        const c = { ...drawerConfig(m, s, j) };
        if (c.mesh || c.slide === slide) return c;
        const length = compatibleSlideLength(slide, c.length, available);
        if (length === undefined) throw Error(`В корпусе «${m.name}» нет подходящей длины направляющих для глубины ${m.depth} мм.`);
        return { ...c, slide, length, handle: undefined };
      });
    }
  }
  return next;
}

/** Открывание всех распашных фасадов: с ручками или push-to-open. */
export function setAllOpening(p: Project, open: "handle" | "push"): Project {
  const next = clone(p);
  for (const a of next.modules) a.module.doorOpen = open === "push" ? "push" : undefined;
  return next;
}

/** Крепёж корпусов: конфирматы или эксцентрики. */
export function setAllFastening(p: Project, fastening: "confirmat" | "eccentric"): Project {
  const next = clone(p);
  for (const a of next.modules) a.module.fastening = fastening === "eccentric" ? "eccentric" : undefined;
  return next;
}
