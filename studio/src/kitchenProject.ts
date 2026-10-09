// Вкладка «Кухня» (трек И, 09.10.2026): кухонный проект, шаблоны кухонной палитры и расстановка модулей по рядам кухни.
// Только логика, без React: KitchenPalette.tsx и KitchenPanel.tsx вызывают эти функции, App коммитит результат обычным commitProject
// (автофальши + projectErrors), так что проверки и ошибки — те же, что во всей студии.
import { initialModule, section, distribute, validate, id, RULES, type Module } from "./model";
import { KITCHEN, kitchenBase, kitchenWall, kitchenWorktop } from "./kitchen";
import { createKitchenRow } from "./ModulePalette";
import { applyAutoFillers, projectErrors, bounds, overlap, type Project, type PlacedModule } from "./project";

/** Ключ хранилища вкладки ?order=kitchen (module-studio-v3:kitchen-workspace). */
export const KITCHEN_WORKSPACE = "kitchen-workspace";
/** Комната кухни по умолчанию: 3600 × 3000 × 2700, прямой ряд 3000 у задней стены. */
export const KITCHEN_ROOM = { width: 3600, depth: 3000, height: 2700 } as const;
export const KITCHEN_DEFAULT_ROW = 3000;
/** Отступ ряда от боковой стены: фальш-планка торцом 16 + 5 мм к стене (регламент цеха, applyAutoFillers). */
export const KITCHEN_WALL_OFFSET = RULES.panel + RULES.wallFillerEdgeGap;
/** Высота антресоли по умолчанию: распашной фасад не ниже 360 (RULES.doorMinH) + отступы 1,5. */
export const KITCHEN_ANTRESOL_HEIGHT = 400;

/** Кухонный режим студии — только по явной пометке проекта: кухонный модуль, добавленный в проект шкафа, палитру не подменяет. */
export function isKitchenProject(p: Project) { return p.kind === "kitchen"; }

export type KitchenItem = "base-doors" | "base-drawers" | "sink" | "oven" | "bottle" | "wall" | "wall-open" | "antresol" | "tall";
/** Подписи и ширины кухонной палитры (ширины — частые модули в проектах Базиса цеха). */
export const KITCHEN_ITEMS: Record<KitchenItem, { label: string; widths: number[]; group: "base" | "wall" | "tall" }> = {
  "base-doors": { label: "Нижний распашной", widths: [300, 400, 450, 600, 800], group: "base" },
  "base-drawers": { label: "Нижний с ящиками", widths: [400, 450, 600, 800], group: "base" },
  sink: { label: "Под мойку", widths: [600, 800], group: "base" },
  oven: { label: "Под духовку", widths: [600], group: "base" },
  bottle: { label: "Бутылочница", widths: [150], group: "base" },
  wall: { label: "Навесной", widths: [300, 400, 450, 600, 800], group: "wall" },
  "wall-open": { label: "Навесной с полками", widths: [300, 400, 600, 800], group: "wall" },
  antresol: { label: "Антресоль", widths: [400, 600, 800], group: "wall" },
  tall: { label: "Пенал", widths: [450, 600], group: "tall" },
};

/** Столешница без наполнения: у шаблона initialModule в секции ящики — из-за них к столешнице липла фальш к стене. */
function cleanWorktop(m: Module): Module { return m.worktop ? { ...m, doors: false, sections: [{ ...section(), shelves: [], drawers: 0, rod: false }] } : m; }

/** Пенал (Базис «Пенал»): как нижний — на опорах, дно под боковинами, накладной ХДФ; крыша есть, царг нет; верх вровень с навесными.
 *  Нижний фасад — вровень с фасадами нижних модулей (до 818,5), верхний — до крыши; четыре полки. */
export function kitchenTall(base: Module, width: number): Module {
  const m = kitchenBase(base, width, "doors"), height = KITCHEN.baseHeight + KITCHEN.worktopThickness + KITCHEN.wallGap + KITCHEN.wallHeight;
  const n: Module = { ...m, name: "Пенал", height, kitchen: { role: "tall" } };
  delete n.topType; delete n.rails;
  n.sections = [{ ...n.sections[0], shelves: [], doorSplit: KITCHEN.baseBody - 1.5 }];
  n.sections[0].shelves = distribute(n, n.sections[0], 4);
  return n;
}

/** Модуль кухонной палитры: регламенты Базиса из kitchen.ts, декоры — от выбранного корпуса. */
export function kitchenTemplate(kind: KitchenItem, width: number, source: Pick<Module, "decor" | "facadeDecor">): Module {
  const base = initialModule();
  let m: Module;
  if (kind === "base-doors") m = kitchenBase(base, width, "doors");
  else if (kind === "base-drawers") m = kitchenBase(base, width, "drawers");
  else if (kind === "sink") m = kitchenBase(base, width, "sink");
  else if (kind === "oven") m = kitchenBase(base, width, "oven");
  else if (kind === "bottle") { m = kitchenBase(base, width, "doors"); m.name = "Бутылочница"; m.sections = [{ ...m.sections[0], shelves: [] }]; }
  else if (kind === "wall") m = kitchenWall(base, width);
  else if (kind === "wall-open") { m = kitchenWall(base, width); m.name = "Навесной открытый"; m.doors = false; m.sections = [{ ...m.sections[0], shelves: [] }]; m.sections[0].shelves = distribute(m, m.sections[0], 2); }
  else if (kind === "antresol") { m = kitchenWall(base, width); m.name = "Антресоль"; m.height = KITCHEN_ANTRESOL_HEIGHT; m.kitchen = { role: "antresol" }; m.sections = [{ ...m.sections[0], shelves: [] }]; }
  else m = kitchenTall(base, width);
  m = { ...m, name: `${m.name} ${width}`, decor: source.decor, facadeDecor: source.facadeDecor };
  const e = validate(m)[0];
  if (e) throw Error(`${m.name}: ${e}`);
  return m;
}

/** Новый кухонный проект: комната 3600 × 3000 × 2700 и прямой ряд 3000 (ящики, мойка, распашные, навесные, столешница). */
export function kitchenProject(length: number = KITCHEN_DEFAULT_ROW): Project {
  const modules = createKitchenRow(length, initialModule()).map((a) => ({ ...a, x: a.x + KITCHEN_WALL_OFFSET, module: cleanWorktop(a.module) }));
  // сразу с автофальшами — как после любой правки (иначе смета до первой правки без фальши к стене)
  const p = applyAutoFillers({ version: 3, kind: "kitchen", room: { ...KITCHEN_ROOM, openings: [] }, modules });
  const e = projectErrors(p);
  if (e.length) throw Error(e[0]);
  return p;
}

const role = (a: PlacedModule) => a.module.worktop ? "worktop" : a.module.kitchen?.role;
const right = (list: PlacedModule[]) => list.length ? Math.max(...list.map((a) => { const b = bounds(a); return b.x + b.w; })) : undefined;
const left = (list: PlacedModule[]) => list.length ? Math.min(...list.map((a) => bounds(a).x)) : undefined;
const top = (list: PlacedModule[]) => list.length ? Math.max(...list.map((a) => (a.y ?? 0) + a.module.height)) : undefined;

/** Ставит модули (один или ряд) на первое свободное место из списка сдвигов по X: сначала дешёвая проверка габаритов, затем полная
 *  (тем же путём, что commitProject). Возвращает проект с добавленными модулями (автофальши поставит commitProject) и id добавленных.
 *  Места нет — понятная ошибка: что не встало и что сделать (палитра покажет её у кнопок). */
function placeAt(p: Project, group: PlacedModule[], xs: number[], what: string): { project: Project; ids: string[] } {
  if (p.modules.length + group.length > 40) throw Error("В проекте не больше 40 модулей. Удалите лишние или начните новую кухню.");
  const gx = Math.min(...group.map((a) => bounds(a).x)), gw = Math.max(...group.map((a) => { const b = bounds(a); return b.x + b.w; })) - gx;
  // сырые модули Базиса студия не проверяет на пересечение (modulesOverlap) — и здесь их не считаем занятым местом
  const occupied = p.modules.filter((a) => !a.module.raw).map(bounds), room = p.room;
  const candidates = [...new Set(xs.filter((x) => Number.isFinite(x)).map((x) => Math.round(x)))];
  let checked = 0, lastError = "";
  for (const x of candidates) {
    if (x < 0 || x + gw > room.width + 0.1) continue;
    const moved = group.map((a) => ({ ...a, x: a.x + x - gx })), bb = moved.map(bounds);
    if (bb.some((b) => b.y + b.h > room.height + 0.1 || b.z < -0.1 || b.z + b.d > room.depth + 0.1 || occupied.some((o) => overlap(b, o)))) continue;
    const project = { ...p, modules: [...p.modules, ...moved] }, errors = projectErrors(applyAutoFillers(project));
    if (!errors.length) return { project, ids: moved.map((a) => a.id) };
    lastError = errors[0];
    if (++checked >= 8) break;
  }
  throw Error(lastError || `Нет места для ${what}: ряд занят до стены. Сдвиньте или уменьшите модули, либо увеличьте комнату на этапе «Помещение».`);
}

/** Куда ставить новый модуль кухни: нижние и пеналы — в ряд на пол справа от нижних, навесные — в ряд навесных на высоте ряда,
 *  антресоли — над навесными. Сначала — продолжение ряда, затем начало стены (с местом под фальш), затем любые края занятых мест. */
export function placeKitchenModule(p: Project, m: Module): { project: Project; id: string } {
  const r = m.kitchen?.role ?? "base";
  const bases = p.modules.filter((a) => role(a) === "base" || role(a) === "tall"), walls = p.modules.filter((a) => role(a) === "wall");
  const antresols = p.modules.filter((a) => role(a) === "antresol"), floor = p.modules.filter((a) => (a.y ?? 0) < 1 && !a.module.worktop);
  const baseTop = top(p.modules.filter((a) => role(a) === "base")) ?? KITCHEN.baseHeight;
  const wallY = walls[0]?.y ?? baseTop + KITCHEN.worktopThickness + KITCHEN.wallGap;
  let y = 0, row: PlacedModule[] = floor;
  if (r === "wall") { y = wallY; row = walls; }
  if (r === "antresol") {
    y = top(walls) ?? p.room.height - 30 - m.height; row = antresols;
    if (y + m.height > p.room.height) throw Error(`Антресоль ${m.height} мм не помещается: верх навесных на ${y} мм, потолок ${p.room.height}. Уменьшите высоту навесных (например, до 720) или поставьте антресоль вместо навесного.`);
  }
  const a: PlacedModule = { id: id(), x: 0, y, z: 0, rotation: 0, module: m };
  a.z = -bounds(a).z; // задняя грань (с выступом накладного ХДФ) — к стене
  const all = p.modules.map(bounds);
  const xs = [right(row), r === "wall" || r === "antresol" ? left(r === "wall" ? bases : walls) : undefined, KITCHEN_WALL_OFFSET, (left(row) ?? NaN) - m.width,
    ...all.flatMap((b) => [b.x + b.w, b.x - m.width]), p.room.width - m.width - KITCHEN_WALL_OFFSET, 0].filter((x): x is number => x !== undefined);
  const out = placeAt(p, [a], xs, `«${m.name}» (${m.width} мм)`);
  return { project: out.project, id: out.ids[0] };
}

/** Столешница над нижними, ещё не закрытыми столешницей: от левого до правого края ряда нижних (длиннее 4100 — двумя частями). */
export function placeWorktop(p: Project, source: Pick<Module, "decor">): { project: Project; ids: string[] } {
  const bases = p.modules.filter((a) => role(a) === "base" && (a.rotation ?? 0) === 0).sort((a, b) => a.x - b.x);
  if (!bases.length) throw Error("Столешница ставится на нижние модули. Сначала добавьте нижние.");
  const worktops = p.modules.filter((a) => a.module.worktop);
  const covered = (a: PlacedModule) => worktops.some((w) => w.x < a.x + a.module.width - 1 && w.x + w.module.width > a.x + 1);
  // первый непрерывный участок нижних без столешницы (стык соседей — до 2 мм)
  let run: PlacedModule[] = [];
  for (const a of bases) {
    if (covered(a)) { if (run.length) break; continue; }
    const last = run[run.length - 1];
    if (last && Math.abs(last.x + last.module.width - a.x) > 2) break;
    run.push(a);
  }
  if (!run.length) throw Error("Все нижние уже под столешницей. Длина столешницы меняется в панели справа.");
  const x0 = run[0].x, x1 = run[run.length - 1].x + run[run.length - 1].module.width, length = Math.round(x1 - x0);
  const y = Math.max(...run.map((a) => (a.y ?? 0) + a.module.height));
  const pieces = length > 4100 ? [Math.round(length / 2), length - Math.round(length / 2)] : [length];
  let x = x0;
  const group = pieces.map((w) => { const m = cleanWorktop({ ...kitchenWorktop(initialModule(), w), decor: source.decor, name: `Столешница ${w}` }); const e = validate(m)[0]; if (e) throw Error(e); const a: PlacedModule = { id: id(), x, y, z: 0, rotation: 0, module: m }; x += w; return a; });
  return { project: { ...p, modules: [...p.modules, ...group] }, ids: group.map((a) => a.id) };
}

/** Прямая кухня по длине стены: продолжением справа или в начало стены; replace — вместо всех кухонных модулей (обычные шкафы остаются). */
export function placeKitchenRow(p: Project, length: number, source: Pick<Module, "decor" | "facadeDecor">, replace = false): { project: Project; ids: string[] } {
  const group = createKitchenRow(length, { ...initialModule(), decor: source.decor, facadeDecor: source.facadeDecor }).map((a) => ({ ...a, module: cleanWorktop(a.module) }));
  if (replace) {
    const rest = p.modules.filter((a) => !a.module.kitchen && !a.module.worktop && !a.module.raw);
    const base = { ...p, modules: rest };
    const moved = group.map((a) => ({ ...a, x: a.x + KITCHEN_WALL_OFFSET }));
    if (!rest.length) return { project: { ...p, modules: moved }, ids: moved.map((a) => a.id) };
    return placeAt(base, group, [KITCHEN_WALL_OFFSET, ...rest.map(bounds).map((b) => b.x + b.w)], `кухни ${length} мм`);
  }
  const floor = p.modules.filter((a) => (a.y ?? 0) < 1);
  return placeAt(p, group, [right(floor) ?? KITCHEN_WALL_OFFSET, KITCHEN_WALL_OFFSET, ...p.modules.map(bounds).map((b) => b.x + b.w), 0], `ряда ${length} мм`);
}

/** Опоры и цоколь кухни: высота опор меняет высоту модуля (корпус остаётся прежним), цоколь по умолчанию — на 5 мм ниже дна.
 *  ids — какие модули (нижние и пеналы); столешницы, лежавшие на них, поднимаются вместе с ними. */
export function setLegHeight(p: Project, ids: string[], height: number): Project {
  const n = structuredClone(p), changed = new Map<string, { oldTop: number; newTop: number }>();
  for (const a of n.modules) {
    const k = a.module.kitchen;
    if (!ids.includes(a.id) || !k || (k.role !== "base" && k.role !== "tall") || !a.module.feet) continue;
    const old = a.module.feet.height, y = a.y ?? 0;
    if (old === height) continue;
    a.module.feet = { height };
    a.module.height += height - old;
    // ящики Axis PRO поднимаются вместе с корпусом
    if (a.module.kdrawers) a.module.kdrawers = a.module.kdrawers.map((d) => { const dy = height - old, k = { ...d, y0: d.y0 + dy, y1: d.y1 + dy, runnerY: d.runnerY + dy };
      return k.system === "firmax-ldsp" || k.system === "versalite-h45" ? { ...k, box: { ...k.box, y: k.box.y + dy, ...(k.box.runs ? { runs: k.box.runs.map(([x, y, z]) => [x, y + dy, z] as [number, number, number]) } : {}) } } : k; });
    // цоколь «по регламенту» (на 5 ниже дна) следует за опорами; свой — только не выше опор
    const ph = k.plinth?.height ?? KITCHEN.plinthHeight, auto = ph === old - (KITCHEN.legs - KITCHEN.plinthHeight);
    const nextPh = auto ? height - (KITCHEN.legs - KITCHEN.plinthHeight) : Math.min(ph, height);
    a.module.kitchen = { ...k, plinth: { ...(k.plinth ?? {}), height: nextPh } };
    changed.set(a.id, { oldTop: y + a.module.height - (height - old), newTop: y + a.module.height });
  }
  // столешница: стояла на изменённых нижних — встаёт на самый высокий из них
  for (const w of n.modules.filter((a) => a.module.worktop)) {
    const under = n.modules.filter((a) => changed.has(a.id) && a.x < w.x + w.module.width - 1 && a.x + a.module.width > w.x + 1 && Math.abs(changed.get(a.id)!.oldTop - (w.y ?? 0)) < 1);
    if (under.length) w.y = Math.max(...under.map((a) => changed.get(a.id)!.newTop));
  }
  return n;
}

/** Кухонные модули проекта, к которым относятся общие настройки опор (нижние и пеналы на опорах). */
export function legModules(p: Project) { return p.modules.filter((a) => (a.module.kitchen?.role === "base" || a.module.kitchen?.role === "tall") && !!a.module.feet).map((a) => a.id); }

/** Пересобрать нижний по регламенту под другое назначение: ширина, декоры, петли и ручки сохраняются, остальное — как у шаблона Базиса. */
export function rebuildKitchen(m: Module, kind: KitchenItem): Module {
  const n = kitchenTemplate(kind, m.width, m);
  return { ...n, ...(m.drawerFacadeDecor ? { drawerFacadeDecor: m.drawerFacadeDecor } : {}), ...(m.hingeBrand ? { hingeBrand: m.hingeBrand } : {}), ...(m.handleId ? { handleId: m.handleId } : {}), ...(m.noHandles ? { noHandles: true } : {}) };
}
/** Ручные высоты петель: ещё петля — посередине самого большого промежутка; убрать — среднюю (крайние остаются у краёв фасада). */
export function addHinge(hy: number[]): number[] {
  const h = [...hy].sort((a, b) => a - b);
  if (h.length < 2) return h;
  let gi = 0, gap = -1;
  for (let i = 0; i < h.length - 1; i++) if (h[i + 1] - h[i] > gap) { gap = h[i + 1] - h[i]; gi = i; }
  h.splice(gi + 1, 0, Math.round((h[gi] + h[gi + 1]) / 2));
  return h;
}
export function removeHinge(hy: number[], doorHeight: number): number[] {
  const h = [...hy].sort((a, b) => a - b);
  if (h.length <= 2) return h;
  let best = 1;
  for (let i = 1; i < h.length - 1; i++) if (Math.abs(h[i] - doorHeight / 2) < Math.abs(h[best] - doorHeight / 2)) best = i;
  h.splice(best, 1);
  return h;
}

/** Назначение кухонного модуля для селекта «Назначение». */
export function kitchenItemOf(m: Module): KitchenItem | undefined {
  const k = m.kitchen;
  if (!k) return undefined;
  if (k.role === "tall") return "tall";
  if (k.role === "antresol") return "antresol";
  if (k.role === "wall") return m.doors ? "wall" : "wall-open";
  if (k.appliance === "sink") return "sink";
  if (k.appliance === "oven") return "oven";
  if (m.kdrawers?.length || m.sections.some((s) => s.drawers > 0)) return "base-drawers";
  return m.width < 250 ? "bottle" : "base-doors";
}
