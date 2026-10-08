// Кухня в ГардерЁбе — основа (08.10.2026, задача Макса «заложить основу под построение кухни»).
// Кухонный корпус — обычный модуль студии с пометкой kitchen (нижний, навесной, пенал): наполнение, фасады, фурнитура, смета
// и раскрой работают как у шкафов. Здесь — только кухонное: регламенты, ножки с цокольной планкой, навесы, ниши техники,
// столешница как отдельный объект (по образцу дверей-купе) и шаблоны для палитры.
// Регламенты: соглашения цеха (Vault «Мебельные соглашения — царги цоколь ящики») и разбор кухонных проектов Базиса цеха
// (Claude Project\Кухни\Регламенты кухни по b3d.md). Числа с пометкой «уточнить» — до подтверждения разбором.
import type { Module, Part } from "./model";

export type KitchenRole = "base" | "wall" | "tall";
export type ApplianceKind = "sink" | "oven" | "microwave" | "dishwasher" | "hob" | "hood" | "fridge";
export type KitchenSpec = { role: KitchenRole; appliance?: ApplianceKind };
export type WorktopCutout = { kind: "sink" | "hob"; x: number; width: number; depth: number };
export type WorktopSpec = { material: "postforming" | "ldsp" | "stone"; thickness: number; overhang: number; cutouts: WorktopCutout[] };

/** Регламенты кухни, мм. */
export const KITCHEN = {
  legs: 100,            // регулируемые ножки нижних корпусов и пеналов
  plinthSetback: 50,    // цокольная планка утоплена от линии фасадов (соглашение цеха)
  plinthFloorGap: 3,    // зазор планки до пола
  baseHeight: 820,      // нижний корпус вместе с ножками, без столешницы (уточнить по b3d)
  baseDepth: 560,       // глубина нижнего корпуса (уточнить по b3d)
  worktopThickness: 38, // постформинг (уточнить по b3d)
  worktopDepth: 600,    // глубина столешницы (уточнить по b3d)
  worktopOverhang: 24,  // свес столешницы за фасады — стандарт (уточнить по b3d)
  wallHeight: 720,      // навесной корпус (уточнить по b3d)
  wallDepth: 300,       // глубина навесного (уточнить по b3d)
  wallGap: 600,         // от столешницы до низа навесных (уточнить по b3d)
  wallGapMin: 450,      // ниже — неудобно работать и опасно над варкой
  hoodGapMin: 650,      // от варочной до вытяжки
  topRail: 100,         // ширина царг под столешницу вместо крыши (уточнить по b3d)
  minWidth: 150, maxWidth: 1200,
} as const;

/** Техника: размеры ниши/корпуса по паспортам типовых встраиваемых моделей (ширина × высота × глубина, мм). */
export const APPLIANCES: Record<ApplianceKind, { label: string; niche: [number, number, number]; widths: number[] }> = {
  sink: { label: "Мойка", niche: [0, 0, 0], widths: [450, 500, 600, 800] },
  oven: { label: "Духовой шкаф", niche: [560, 595, 550], widths: [600] },
  microwave: { label: "Встраиваемая СВЧ", niche: [560, 380, 550], widths: [600] },
  dishwasher: { label: "Посудомоечная машина", niche: [450, 820, 560], widths: [450, 600] },
  hob: { label: "Варочная панель", niche: [560, 50, 490], widths: [450, 600, 800] },
  hood: { label: "Вытяжка встраиваемая", niche: [560, 180, 280], widths: [600] },
  fridge: { label: "Встраиваемый холодильник", niche: [560, 1780, 550], widths: [600] },
};

export const isKitchen = (m: Module) => !!m.kitchen;
export const kitchenRole = (m: Module) => m.kitchen?.role;

/** Детали, которые кухонный корпус добавляет к обычному: цокольная планка на ножках (нижний и пенал), навесы (навесной). */
export function kitchenExtraParts(m: Module, out: Part[]) {
  const k = m.kitchen; if (!k) return;
  const t = 16;
  const part = (id: string, name: string, size: Part["size"], position: Part["position"], extra: Partial<Part> = {}): Part =>
    ({ id, name, size, position, length: Math.max(...size), width: [...size].sort((a, b) => b - a)[1], thickness: Math.min(...size), role: "body", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [2, 0, 0, 0], ...extra });
  if ((k.role === "base" || k.role === "tall") && m.feet) {
    const h = m.feet.height - KITCHEN.plinthFloorGap;
    out.push(part("kitchen-plinth", "Цокольная планка кухни (съёмная, на клипсах)", [m.width, h, t], [m.width / 2, KITCHEN.plinthFloorGap + h / 2, m.depth - KITCHEN.plinthSetback - t / 2], { decor: m.facadeDecor }));
  }
  if (k.role === "wall") {
    for (const [side, x] of [["left", t + 10], ["right", m.width - t - 10]] as const)
      out.push({ id: `kitchen-hanger:${side}`, name: "Навес мебельный регулируемый", size: [20, 50, 30], position: [x, m.height - 40, 15], length: 50, width: 30, thickness: 20, role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
  }
}

/** Столешница — отдельный объект над нижними корпусами: в раскрой ЛДСП не идёт (кроме ЛДСП 32), цена за погонный метр. */
export function worktopParts(m: Module): Part[] {
  const w = m.worktop!, T = w.thickness, out: Part[] = [];
  out.push({ id: "worktop", name: `Столешница ${worktopLabel(w)} ${T} мм`, size: [m.width, T, m.depth], position: [m.width / 2, T / 2, m.depth / 2], length: m.width, width: m.depth, thickness: T, role: "body", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [0, 0, 2, 0], external: w.material !== "ldsp" });
  for (const [i, c] of w.cutouts.entries())
    out.push({ id: `worktop-cut:${i}`, name: c.kind === "sink" ? "Вырез под мойку" : "Вырез под варочную панель", size: [c.width, T + 2, c.depth], position: [c.x + c.width / 2, T / 2, m.depth / 2], length: c.width, width: c.depth, thickness: T, role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0], external: true });
  return out;
}
export function worktopLabel(w: WorktopSpec) { return { postforming: "постформинг", ldsp: "ЛДСП 16+16", stone: "искусственный камень" }[w.material]; }

export function kitchenErrors(m: Module): string[] {
  const e: string[] = [];
  if (m.worktop) {
    const w = m.worktop;
    if (!["postforming", "ldsp", "stone"].includes(w.material)) e.push("Столешница: материал из списка.");
    if (!Number.isFinite(w.thickness) || w.thickness < 12 || w.thickness > 60) e.push("Столешница: толщина 12–60 мм.");
    if (m.width < 200 || m.width > 4100) e.push("Столешница: длина 200–4100 мм (длиннее — со стыком).");
    for (const c of w.cutouts) if (c.x < 50 || c.x + c.width > m.width - 50 || c.depth > m.depth - 80) e.push("Столешница: вырез не ближе 50 мм к торцам и 40 мм к кромкам.");
  }
  if (m.kitchen) {
    const k = m.kitchen;
    if (!["base", "wall", "tall"].includes(k.role)) e.push("Кухня: тип корпуса — нижний, навесной или пенал.");
    if (k.appliance && !(k.appliance in APPLIANCES)) e.push("Кухня: неизвестная техника.");
    if (k.role !== "wall" && !m.feet) e.push("Кухонный корпус ставится на ножки.");
  }
  return e;
}

/** Шаблоны палитры. */
export function kitchenBase(base: Module, width: number, kind: "doors" | "drawers" | "sink" | "oven" | "dishwasher" = "doors"): Module {
  const m: Module = { ...structuredClone(base), name: { doors: "Нижний кухонный", drawers: "Нижний с ящиками", sink: "Под мойку", oven: "Под духовой шкаф", dishwasher: "Посудомойка" }[kind], width, height: KITCHEN.baseHeight, depth: KITCHEN.baseDepth, feet: { height: KITCHEN.legs }, plinthHeight: undefined, topType: "none", backType: kind === "sink" ? "none" : "nailed", doors: kind === "doors" || kind === "sink", kitchen: { role: "base", ...(kind === "sink" || kind === "oven" || kind === "dishwasher" ? { appliance: kind } : {}) } };
  m.rails = [{ place: "front-top", height: KITCHEN.topRail }, { place: "rear-top", height: KITCHEN.topRail }, { place: "rear-bottom", height: KITCHEN.topRail }];
  m.sections = [{ ...m.sections[0], shelves: kind === "doors" ? [0.5] : [], drawers: kind === "drawers" ? 3 : 0, rod: false }];
  return m;
}
export function kitchenWall(base: Module, width: number): Module {
  const m: Module = { ...structuredClone(base), name: "Навесной кухонный", width, height: KITCHEN.wallHeight, depth: KITCHEN.wallDepth, feet: undefined, plinthHeight: 0, topType: "panel", backType: "nailed", doors: true, kitchen: { role: "wall" } };
  m.sections = [{ ...m.sections[0], shelves: [0.5], drawers: 0, rod: false }];
  return m;
}
export function kitchenWorktop(base: Module, width: number): Module {
  return { ...structuredClone(base), name: "Столешница", width, height: KITCHEN.worktopThickness, depth: KITCHEN.worktopDepth, doors: false, feet: undefined, plinthHeight: 0, backType: "none", worktop: { material: "postforming", thickness: KITCHEN.worktopThickness, overhang: KITCHEN.worktopOverhang, cutouts: [] } };
}

/** Ширины нижних корпусов прямой кухни по длине стены: ящики 600 у начала, мойка 800, дальше распашные 600; остаток — в последний корпус. */
export function kitchenRowWidths(length: number): { width: number; kind: "doors" | "drawers" | "sink" }[] {
  const out: { width: number; kind: "doors" | "drawers" | "sink" }[] = [];
  let rest = Math.round(length);
  if (rest >= 1400) { out.push({ width: 600, kind: "drawers" }); rest -= 600; }
  if (rest >= 1100) { out.push({ width: 800, kind: "sink" }); rest -= 800; }
  while (rest > 0) {
    if (rest <= KITCHEN.maxWidth && (rest < 900 || out.length === 0)) { out.push({ width: rest, kind: "doors" }); rest = 0; break; }
    out.push({ width: 600, kind: "doors" }); rest -= 600;
  }
  // остаток уже 300 мм — прибавить к предыдущему корпусу (до 1200), иначе оставить узким
  const last = out[out.length - 1], prev = out[out.length - 2];
  if (last && prev && last.width < 300 && prev.width + last.width <= KITCHEN.maxWidth) { prev.width += last.width; out.pop(); }
  return out;
}
