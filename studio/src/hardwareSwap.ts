// Замена фурнитуры сразу во всём проекте (нижняя панель «Фурнитура»). Решение Макса 06.10.2026:
// клиент меняет фурнитуру и сразу видит, как меняется цена. Возвращает новый проект; проверку делает commitProject.
import { drawerConfig, drawersBehindDoors, facadeHandleId, parts, rearClear, type EdgeThickness, type Module } from "./model";
import { compatibleSlideLength, HINGE_BRANDS, SLIDE_SYSTEMS, slideSystem, type DrawerConfig, type HingeBrand } from "./hardware";
import { DEFAULT_HANDLE } from "./handles";
import type { Project } from "./project";

const clone = (p: Project): Project => structuredClone(p);
/** Корпуса, где замену делаем: угловые пятиугольники имеют свою конструкцию ящиков и не трогаются. */
const plain = (m: Module) => !m.corner;

export type HardwareChoice = {
  handles: string[];
  /** id систем из SLIDE_SYSTEMS */
  slides: string[];
  hinges: HingeBrand[];
  edgeBody: EdgeThickness[];
  edgeFacade: EdgeThickness[];
  opening: ("handle" | "push")[];
  fastening: ("confirmat" | "eccentric")[];
  hasDoors: boolean;
  hasDrawers: boolean;
};

/** Что сейчас стоит в проекте: по каждому виду список различных вариантов (пусто = такого нет). */
export function hardwareChoice(p: Project): HardwareChoice {
  const handles = new Set<string>(), slides = new Set<string>(), opening = new Set<"handle" | "push">(), fastening = new Set<"confirmat" | "eccentric">();
  const hinges = new Set<HingeBrand>(), edgeBody = new Set<EdgeThickness>(), edgeFacade = new Set<EdgeThickness>();
  let hasDoors = false, hasDrawers = false;
  for (const a of p.modules) {
    const m = a.module;
    fastening.add(m.fastening ?? "confirmat");
    edgeBody.add(m.edgeBody ?? 2); edgeFacade.add(m.edgeFacade ?? 2);
    if (m.doors) hinges.add(m.hingeBrand ?? "gtv");
    for (const d of parts(m)) {
      if (d.role === "handle") handles.add(facadeHandleId(m, d.id) ?? DEFAULT_HANDLE);
      if (d.role === "door" && d.id !== "slope-filler") { hasDoors = true; opening.add(m.doorOpen ?? "handle"); }
    }
    if (!plain(m)) continue;
    for (const s of m.sections) for (let j = 0; j < s.drawers; j++) { const c = drawerConfig(m, s, j); if (c.mesh) continue; hasDrawers = true; slides.add(slideSystem(c).id); }
  }
  return { handles: [...handles], slides: [...slides], hinges: [...hinges], edgeBody: [...edgeBody], edgeFacade: [...edgeFacade], opening: [...opening], fastening: [...fastening], hasDoors, hasDrawers };
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

/** Одна система направляющих (тип + бренд + ход) у ящика: длина подбирается под глубину корпуса, ручка — по ходу (push без ручки). */
export function withSlideSystem(m: Module, s: Module["sections"][number], c: DrawerConfig, systemId: string): DrawerConfig {
  const sys = SLIDE_SYSTEMS.find((x) => x.id === systemId);
  if (!sys) throw Error("Неизвестная система направляющих.");
  if (c.mesh) return c;
  const available = m.depth - rearClear(m) - (drawersBehindDoors(m, s) ? 44 : 25);
  const length = compatibleSlideLength(sys.slide, c.length, available);
  if (length === undefined) throw Error(`В корпусе «${m.name}» нет подходящей длины направляющих для глубины ${m.depth} мм.`);
  const { handle: _h, brand: _b, operation: _o, ...rest } = c;
  return { ...rest, slide: sys.slide, length, operation: sys.motion, ...(sys.slide === "gtv0fpo" ? { brand: sys.brand } : {}) };
}

/** Система направляющих у всех ящиков проекта. Ошибка, если для какого-то корпуса нет длины. */
export function setAllSlides(p: Project, systemOrSlide: string): Project {
  const systemId = systemOrSlide === "ball" ? "ball-soft" : systemOrSlide === "gtv0fpo" ? "hidden-dtc-push" : systemOrSlide;
  const next = clone(p);
  for (const a of next.modules) {
    const m = a.module;
    if (!plain(m)) continue;
    for (const s of m.sections) {
      if (!s.drawers) continue;
      s.drawerConfigs = Array.from({ length: s.drawers }, (_, j) => withSlideSystem(m, s, { ...drawerConfig(m, s, j) }, systemId));
    }
  }
  return next;
}

/** Бренд петель у всех корпусов. */
export function setAllHinges(p: Project, brand: HingeBrand): Project {
  if (!(brand in HINGE_BRANDS)) throw Error("Неизвестный бренд петель.");
  const next = clone(p);
  for (const a of next.modules) a.module.hingeBrand = brand === "gtv" ? undefined : brand;
  return next;
}

/** Кромка видимых торцов корпуса или фасадов у всех корпусов. */
export function setAllEdges(p: Project, target: "body" | "facade", value: EdgeThickness): Project {
  const next = clone(p);
  for (const a of next.modules) { if (target === "body") a.module.edgeBody = value === 2 ? undefined : value; else a.module.edgeFacade = value === 2 ? undefined : value; }
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
