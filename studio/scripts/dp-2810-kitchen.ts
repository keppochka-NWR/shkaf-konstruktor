// ДП 28.10 (обезличено: dp-2810), зона 3 — кухня Г, барная стойка и витрина: сборка ФУНКЦИЯМИ студии, ровно теми, что вызывает интерфейс
// рабочего места комнат (/studio/?rooms=1): первый шкаф комнаты, кухонная палитра, панель модуля, поля «Положение», кольцевое меню
// («Копия», «Подсветка»), общая палитра «Пустой шкаф», отдельные панели комнаты, «Модель цены». Сценарий мышью
// (scripts/dp-2810-kitchen-manager.ts) повторяет те же шаги кликами по тем же данным (STEPS, PANELS, …) — детали и цена сверяются.
// Запуск: npx tsx scripts/dp-2810-kitchen.ts [--json] [--lines] [--parts] → public/local-projects/dp-2810-kitchen.json (личный, не в git).
// Данных клиента здесь нет: только размеры с развёрток (масштаб снят по размерным цепочкам). Допущения помечены «ДОПУЩЕНИЕ».
//
// Развёртка, стена 12–13 = 3 850 (задняя): ниша для штор 200 | пенал под холодильник 600 | пенал духовка+СВЧ 600 | низ 600 ящики |
//   600 под варочную (3 ящика) | 600 распашной | фальш 50 | угол 600 (глухой); верх 600 | 600 вытяжка | 600 | 350 | угол 300.
// Стена 13–14 = 2 380 (правая): угол 590 + фальш 50 | 530 распашной | 600 мойка | 600 ПММ | 10; верх: угол 300 | 300 | 580 | 600 | 600.
// Высоты: цоколь 100, столешница — верх 900 (акрил 40 → низ 860), фартук 600 (900…1500), верх 1 120 (1500…2620), над мебелью 94 до потолка 2714.
import { mkdirSync, writeFileSync } from "node:fs";
import { parts, validate, fitDrawersAfterResize, shelfMaxDepth, type Module } from "../src/model";
import { applyAutoFillers, projectErrors, parseProject, appendModule, copyModuleGroup, bounds, newProject, type Project } from "../src/project";
import { kitchenTemplate, placeKitchenModule, placeWorktop, type KitchenItem } from "../src/kitchenProject";
import { configureColumn } from "../src/kitchenTall";
import { refitKDrawers } from "../src/kitchenDrawers";
import { layoutKitchenDrawers } from "../src/kitchenEditing";
import { changeFacadeKind } from "../src/facadeAppearance";
import { applyFacadeStyle } from "../src/applyFacadeStyle";
import { placeInRow } from "../src/rowResize";
import { placeModuleAt, type PlaceTarget } from "../src/wallPlacement";
import { setWorktopMaterial } from "../src/kitchen";
import { installSink } from "../src/installSink";
import { toggleWaterfall } from "../src/worktopWaterfall";
import { setRowUnderLight } from "../src/kitchenUnderLightRow";
import { placeFreePanel, type FreePanelInput } from "../src/freePanels";
import { parseRoomProject } from "../src/roomDocument";
import { createModule } from "../src/ModulePalette";
import { newModuleName } from "../src/clientLabels";
import { partCollisions } from "../src/collisions";
import { estimate } from "../src/pricing";
import { withPriceModel } from "../src/priceModel";
import { setShelfCount } from "../src/shelfCount";
import { setSectionShelves } from "../src/lights";
import { defaultDoorSplit } from "../src/quickMenu";
import { rotateModule, setWallDistance } from "../src/operations";
import { DEFAULT_ALU } from "../src/alu";
import { DEFAULT_VERNISSAGE, VERNISSAGE_MILLINGS, normalizeVernissage, seriesOf, type VernissageFacade } from "../src/facadesVernissage";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

// ---------- Материалы (из спецификации ДП и предложения конкурента; подбор фрезеровок Вернисажа — ДОПУЩЕНИЕ, см. ответ)
/** Корпус — ЛДСП Ламарти, светлый однотон (базовый «Белый»: в себестоимости Макса — базовые однотонные 2 900 ₽/лист). */
export const DECOR = arg("decor", "Белый");
const ENAMEL = "RAL 1013"; // светлый тёплый беж по визуализации — ДОПУЩЕНИЕ (цвет в ДП не указан)
/** Фасады нижних модулей и пеналов — МДФ эмаль, утопленная филёнка: №67 Престиж (рамка 50, скос 45°, филёнка ниже). */
export const V_FRAME: VernissageFacade = { milling: "67", cover: "enamel-matte", enamelColor: ENAMEL, thickness: 19 };
/** Фасады верхних модулей (и верх пеналов) — МДФ эмаль рифлёная: №89 Оптима (V-пазы шагом ~50 во всю высоту). */
export const V_FLUTE: VernissageFacade = { milling: "89", cover: "enamel-matte", enamelColor: ENAMEL, thickness: 19 };
/** Видимые бока пеналов, фальши у угла — МДФ эмаль гладкая: №15 Стандарт («мыло»). */
export const V_SMOOTH: VernissageFacade = { milling: "15", cover: "enamel-matte", enamelColor: ENAMEL, thickness: 19 };
/** МДФ в плёнке ПВХ рифлёный (щит у стойки — обшивка торца перегородки, бок и задняя стенка витрины): №78 рейки 18/пазы 18, плёнка под дерево. */
export const V_PVC: VernissageFacade = { milling: "78", cover: "film", film: "Дуб Галиано", thickness: 19 };

// ---------- Габариты (ДП)
export const ROOM = { width: 3850, depth: 4800, height: 2714 };
const BASE_H = 860;         // нижний с опорами: верх столешницы 900 − акрил 40
const TALL_H = 2620;        // пеналы до верха навесных (над ними 94 до потолка — закладная, в ДП не мебель)
const WALL_Y = 1500, WALL_H = 1120;
const WALL_D = 281;         // глубина навесного с фасадом 19 = 300 по развёртке 14–15
const WING_X_BASE = ROOM.width - 579, WING_X_WALL = ROOM.width - 300; // крыло у правой стены: монтажный габарит нижних 579, навесных 300

/** Кухонный модуль — как действие менеджера: кнопка палитры «<kind> <palette>» → «Название кухонного модуля» → правки панели → поля
 *  «Положение» (по порядку placeOrder). wallY — поле палитры «Низ навесных от пола» перед кнопкой (0 — новый навесной встаёт на пол в
 *  свободный угол, потом «Положение»). Ширины, которых в палитре нет (530, 580, 350), — «Ширина» в панели (edit width). */
export type KitchenStep = { kind: KitchenItem; palette: number; name: string; at: PlaceTarget; edit?: Edit[]; wallY?: number };
export type Edit =
  | { width: number } | { height: number } | { depth: number } | { support: number } | { facade: VernissageFacade };

export const STEPS: KitchenStep[] = [
  // --- задняя стена: пеналы (видимый левый бок — накладная панель МДФ эмаль гладкая, ниша для штор 200 свободна)
  { kind: "tall-fridge", palette: 600, name: "Пенал под холодильник 600", at: { x: 200, z: 0, y: 0 }, edit: [{ height: TALL_H }, { facade: V_FRAME }] },
  { kind: "tall-oven", palette: 600, name: "Пенал: духовка + СВЧ 600", at: { x: 800, z: 0, y: 0 }, edit: [{ height: TALL_H }, { support: 515 }] },
  { kind: "base-drawers", palette: 600, name: "Нижний с ящиками 600", at: { x: 1400, z: 0, y: 0 }, edit: [{ height: BASE_H }] },
  { kind: "base-drawers", palette: 600, name: "Нижний под варочную 600", at: { x: 2000, z: 0, y: 0 }, edit: [{ height: BASE_H }] },
  { kind: "base-doors", palette: 600, name: "Нижний распашной 600", at: { x: 2600, z: 0, y: 0 }, edit: [{ height: BASE_H }] },
  // --- правая стена (крыло, поворот 270): угол 590 + фальш 50 свободны, далее 530 · мойка 600 · ПММ 600 (ПММ — без корпуса, см. ответ)
  { kind: "base-doors", palette: 600, name: "Нижний распашной 530", at: { x: WING_X_BASE, z: 640, y: 0, rotation: 270 }, edit: [{ width: 530 }, { height: BASE_H }] },
  { kind: "sink", palette: 600, name: "Под мойку 600", at: { x: WING_X_BASE, z: 1170, y: 0, rotation: 270 }, edit: [{ height: BASE_H }] },
  // --- навесные 1120 × 300 (с фасадом), низ 1500
  { kind: "wall", palette: 600, name: "Навесной 600", at: { x: 1400, z: 0, y: WALL_Y }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { kind: "wall", palette: 600, name: "Навесной над вытяжкой 600", at: { x: 2000, z: 0, y: WALL_Y }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { kind: "wall", palette: 600, name: "Навесной 600 · 2", at: { x: 2600, z: 0, y: WALL_Y }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { kind: "wall", palette: 300, name: "Навесной 300", wallY: 0, at: { x: WING_X_WALL, z: 300, y: WALL_Y, rotation: 270 }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { kind: "wall", palette: 600, name: "Навесной 580", wallY: 0, at: { x: WING_X_WALL, z: 600, y: WALL_Y, rotation: 270 }, edit: [{ width: 580 }, { height: WALL_H }, { depth: WALL_D }] },
  { kind: "wall", palette: 600, name: "Навесной 600 · 3", wallY: 0, at: { x: WING_X_WALL, z: 1180, y: WALL_Y, rotation: 270 }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { kind: "wall", palette: 600, name: "Навесной 600 · 4", wallY: 0, at: { x: WING_X_WALL, z: 1780, y: WALL_Y, rotation: 270 }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  // последним — навесной 350 у угла задней стены (пока ряд не занят до стены, палитра ставит новые навесные в него, потом их переносят)
  { kind: "wall", palette: 400, name: "Навесной 350", wallY: 0, at: { x: 3200, z: 0, y: WALL_Y }, edit: [{ width: 350 }, { height: WALL_H }, { depth: WALL_D }] },
];

/** Столешницы: «Столешница над нижними» у модуля BASE_FOR_WORKTOP → «Акрил 40» → «Длина» → «+ под варочную» и «От левого торца». */
export const BASE_FOR_WORKTOP = "Нижний с ящиками 600";
export const BACK_TOP = { length: 2450, hob: 600 + (600 - 560) / 2 }; // варочная над нижним 2000…2600: от левого торца 620
/** «Копия» задней столешницы (кольцевое меню) → «Убрать» вырез → «Длина» → «Название модуля» → «Положение». Крыло — от глубины задней
 *  столешницы до колонны 2380, к правой стене; стойка ~1600 × 600 — ДОПУЩЕНИЕ (в ДП нет плана и размеров стойки), водопады с обеих сторон. */
export const WING_TOP = { name: "Столешница крыла", end: 2380 };
export const BAR = { name: "Барная стойка", length: 1600, at: { x: 1600, z: 2420, y: BASE_H, rotation: 0 } as PlaceTarget };
/** Витрина 1035 × 2520 × 330: «Пустой шкаф» общей палитры (до 2500 — выше после «Без задней стенки»), у правой стены за колонной
 *  (ДОПУЩЕНИЕ: плана в ДП нет). Положение — поля общей панели по одному: «Поворот корпуса», «От левой стены», «От задней стены». */
export const VITRINE = { name: "Витрина", width: 1035, height: 2500, depth: 291, fullHeight: 2520, plinth: 100, shelves: 4, doorSplit: 1240,
  alu: { profile: "F1-09", color: "champagne", insert: "glass-clear" },
  /** поля общей панели по порядку: отвести от стойки («От задней стены» 3500), «Поворот корпуса» 270 (вокруг центра), к правой стене, на место */
  place: [["z", 3500], ["r", 270], ["x", ROOM.width - 19 - 291 - 20], ["z", 2800]] as ["x" | "y" | "z" | "r", number][] };

/** Фальш 50 у угла — МДФ Вернисаж уже 246 не делает (паспорт): ЛДСП 16 в цвет корпуса, кромка 2 — ДОПУЩЕНИЕ. */
const ldsp = (name: string, width: number, height: number, plane: FreePanelInput["plane"]): FreePanelInput => ({ name, width, height, thickness: 16, plane, edge: 2, decor: DECOR });
const panel = (name: string, width: number, height: number, plane: FreePanelInput["plane"], v: VernissageFacade): FreePanelInput => ({ name, width, height, thickness: v.thickness, plane, edge: 0, decor: DECOR, vernissage: v });
/** Отдельные панели (окно «Общий план · замер · панели…» → «Добавить отдельную панель»): встают в свободное место, затем «Положение». */
export const PANELS: [FreePanelInput, PlaceTarget][] = [
  [panel("Боковина пенала видимая", 579, TALL_H, "yz", V_SMOOTH), { x: 200 - 19, z: 0, y: 0 }],
  [ldsp("Фальш угловой низа · задняя стена", 50, BASE_H - 100, "xy"), { x: 3200, z: 579 - 16, y: 100 }],
  [ldsp("Фальш угловой низа · правая стена", 50, BASE_H - 100, "yz"), { x: WING_X_BASE, z: 590, y: 100 }],
  [panel("Щит у барной стойки · торец перегородки", 410, 2620, "yz", V_PVC), { x: 3250 - 19, z: 2380, y: 0 }],
  [panel("Задняя стенка витрины · левая", 517, 2520, "yz", V_PVC), { x: ROOM.width - 19, z: 2800, y: 0 }], // шире 1000 Вернисаж не делает — две панели по 517/518
  [panel("Задняя стенка витрины · правая", 518, 2520, "yz", V_PVC), { x: ROOM.width - 19, z: 2800 + 517, y: 0 }],
  [panel("Боковина витрины", 330, 2520, "xy", V_PVC), { x: ROOM.width - 330, z: 2800 + 1035, y: 0 }],
];

// ---------- Функции интерфейса (как в App.tsx: commitProject, modify → commit → placeInRow; панели вызывают те же функции модели)
function commitProject(raw: Project): Project {
  const next = applyAutoFillers(raw);
  const e = projectErrors(next, true);
  if (e.length) throw Error(e[0]);
  return next;
}
/** App.modify: правка модуля, имя «… N» за шириной, глубина полок, ящики после смены высоты; затем ряд (placeInRow) и проверка. */
function modify(p: Project, id: string, update: (n: Module) => void): Project {
  const a = p.modules.find((x) => x.id === id)!, m = a.module, next = structuredClone(m);
  update(next);
  if (next.kitchen && next.width !== m.width && /^(Нижний кухонный|Нижний с ящиками|Под мойку|Под духовку|Бутылочница|Навесной кухонный|Навесной открытый|Антресоль|Пенал) \d+$/.test(m.name)) next.name = m.name.replace(/ \d+$/, ` ${next.width}`);
  if (next.kitchen && next.depth !== m.depth) for (const s of next.sections) { if (s.shelfDepth !== undefined) { const old = m.sections.find((v) => v.id === s.id)?.shelfDepth; if (!s.shelves.length) delete s.shelfDepth; else s.shelfDepth = Math.max(60, Math.min(shelfMaxDepth(next), next.depth - (m.depth - (old ?? s.shelfDepth)))); } }
  if (next.height !== m.height && !next.corner) { fitDrawersAfterResize(next, m); if (next.gola && next.kdrawers?.length) next.kdrawers = layoutKitchenDrawers(next, next.kdrawers.length, undefined, next.kdrawers[0].system); }
  let q = placeInRow(p, id, next);
  const top = (a.y ?? 0) + m.height;
  if (next.height > m.height && (a.y ?? 0) > 0 && Math.abs(top - p.room.height) <= 2) { const y = Math.max(0, Math.round((top - next.height) * 10) / 10); q = { ...q, modules: q.modules.map((b) => (b.id === id ? { ...b, y } : b)) }; }
  return commitProject(q);
}
/** App.modifySection (общая панель шкафа): правка выбранной секции, лишние настройки ящиков обрезаются. */
const modifySection = (p: Project, id: string, update: (s: Module["sections"][number], n: Module) => void) => modify(p, id, (n) => { update(n.sections[0], n); const a = n.sections[0]; if (a.drawerConfigs) a.drawerConfigs = a.drawerConfigs.slice(0, Math.max(0, a.drawers)); });
const mod = (p: Project, id: string) => p.modules.find((a) => a.id === id)!;

const fmt = (v: number) => String(Math.round(v * 10) / 10);
export type PlaceKey = "y" | "x" | "z" | "r";
/** Порядок ввода полей «Положение» кухонной панели: сначала «Поворот» (поворот без отступов — вокруг центра, отступы после него
 *  ставят модуль точно), затем «От пола», «От левой стены», «От задней стены». */
export function placeOrder(t: PlaceTarget): [PlaceKey, number][] {
  const out: [PlaceKey, number][] = [];
  if (t.rotation !== undefined) out.push(["r", t.rotation]);
  if (t.y !== undefined) out.push(["y", t.y]);
  if (t.x !== undefined) out.push(["x", t.x]);
  if (t.z !== undefined) out.push(["z", t.z]);
  return out;
}
/** Поля «Положение» кухонной панели (KitchenPanel PositionFields + App.placePlaced): каждое поле — ввод и Enter, это «мягкое» применение
 *  всех изменённых полей (проходит итог — сохраняется сразу, поля показывают новое положение; не проходит — ждёт остальных); выбор
 *  поворота — то же; в конце «Применить». Поле со значением, равным показанному, изменением не считается. */
function uiPlace(p: Project, id: string, t: PlaceTarget): Project {
  const shownOf = (q: Project) => { const a = mod(q, id), b = bounds(a); return { y: fmt(b.y), x: fmt(b.x), z: fmt(b.z), r: String(a.rotation ?? 0) }; };
  let shown = shownOf(p), draft = { ...shown };
  const apply = (soft: boolean) => {
    const keys = (["y", "x", "z", "r"] as const).filter((k) => draft[k].trim() !== shown[k]);
    if (!keys.length) return;
    const tt: PlaceTarget = {};
    for (const k of keys) { const v = Number(draft[k]); if (k === "r") tt.rotation = v as PlaceTarget["rotation"]; else tt[k] = v; }
    let next: Project;
    try { next = placeModuleAt(p, id, tt); if (soft && projectErrors(applyAutoFillers(next), true).length) return; }
    catch (e) { if (soft) return; throw e; }
    p = commitProject(next); shown = shownOf(p); draft = { ...shown };
  };
  for (const [k, v] of placeOrder(t)) { draft = { ...draft, [k]: String(v) }; apply(true); }
  apply(false);
  return p;
}

/** Выбор МДФ Вернисаж (VernissagePicker, «Все настройки»): по порядку полей — «Серия», «Фрезеровка», «Покрытие», «Плёнка» или «Цвет
 *  эмали», «Толщина МДФ»; каждое изменение — set(normalizeVernissage). Поле, которое уже показывает нужное, не трогается. */
export type VField = "series" | "milling" | "cover" | "film" | "enamel" | "thickness";
export function vernissageSteps(from: VernissageFacade, to: VernissageFacade): { field: VField; value: string | number; result: VernissageFacade }[] {
  let v = from;
  const out: { field: VField; value: string | number; result: VernissageFacade }[] = [];
  const set = (field: VField, value: string | number, patch: Partial<VernissageFacade>) => { v = normalizeVernissage({ ...v, ...patch }); out.push({ field, value, result: v }); };
  const series = seriesOf(to.milling).id;
  if (seriesOf(v.milling).id !== series) set("series", series, { milling: VERNISSAGE_MILLINGS.find((x) => x.series === series)!.id, open: undefined });
  if (v.milling !== to.milling) set("milling", to.milling, { milling: to.milling });
  if (v.cover !== to.cover) set("cover", to.cover, { cover: to.cover });
  if (to.cover === "film" && to.film && v.film !== to.film) set("film", to.film, { film: to.film });
  if (to.cover.startsWith("enamel") && to.enamelColor !== undefined && v.enamelColor !== to.enamelColor) set("enamel", to.enamelColor, { enamelColor: to.enamelColor });
  if (v.thickness !== to.thickness) set("thickness", to.thickness, { thickness: to.thickness });
  return out;
}

/** Правка панели кухонного модуля (KitchenPanel) — тем же кодом, что обработчик поля. */
function edit(p: Project, id: string, e: Edit): Project {
  // «Менять ширину только этого корпуса» → «Ширина» → снять галочку: соседи по ряду не меняются, флаг не остаётся
  if ("width" in e) { p = modify(p, id, (n) => { n.ownWidthOnly = true; }); p = modify(p, id, (n) => { n.width = e.width; }); return modify(p, id, (n) => { delete n.ownWidthOnly; }); }
  if ("height" in e) return modify(p, id, (n) => { n.height = e.height; if (n.kitchen?.column) configureColumn(n); else if (n.kdrawers) n.kdrawers = refitKDrawers(n, "height"); });
  if ("depth" in e) return modify(p, id, (n) => { n.depth = e.depth; if (n.kdrawers) n.kdrawers = refitKDrawers(n, "depth"); });
  if ("support" in e) return modify(p, id, (n) => configureColumn(n, { support: e.support }));
  // «Материал кухонных фасадов» → МДФ Вернисаж, затем поля выбора Вернисажа по одному
  p = modify(p, id, (n) => { const k = changeFacadeKind(n, "vernissage", { keepThickness: true }); for (const key of Object.keys(n) as (keyof Module)[]) delete n[key]; Object.assign(n, k); });
  return setVernissage(p, id, e.facade);
}
function setVernissage(p: Project, id: string, to: VernissageFacade): Project {
  for (const s of vernissageSteps(mod(p, id).module.vernissage!, to)) p = modify(p, id, (n) => { n.vernissage = s.result; n.facadeT = s.result.thickness; });
  return p;
}

/** Состояние окна «Добавить отдельную панель» (RoomTools): поля держат прошлые значения между панелями. */
type PanelForm = FreePanelInput;
const PANEL_FORM: PanelForm = { name: "Панель", width: 600, height: 2000, thickness: 16, plane: "xy", edge: 0.4, decor: "Белый" };
function fillPanelForm(form: PanelForm, want: FreePanelInput): PanelForm {
  let f: PanelForm = { ...form, name: want.name };
  if (want.vernissage && !f.vernissage) f = { ...f, vernissage: DEFAULT_VERNISSAGE, thickness: DEFAULT_VERNISSAGE.thickness, edge: 0 };
  if (!want.vernissage && f.vernissage) { const { vernissage: _v, ...rest } = f; void _v; f = { ...rest, thickness: 16, edge: 0.4 }; }
  f = { ...f, width: want.width, height: want.height };
  if (!want.vernissage) f = { ...f, thickness: want.thickness, edge: want.edge };
  f = { ...f, plane: want.plane };
  if (want.vernissage) for (const s of vernissageSteps(f.vernissage!, want.vernissage)) f = { ...f, vernissage: s.result, thickness: s.result.thickness };
  else f = { ...f, decor: want.decor };
  return f;
}

/** Ids модулей по именам эталона (для отчёта и сверки). */
export function build(): { project: Project; ids: Record<string, string> } {
  // ?rooms=1: пустая комната → «Ширина/Глубина/Высота пустой комнаты» → «Добавить первый шкаф» (шкаф по умолчанию, потом удаляется)
  let p = parseRoomProject({ ...newProject(), modules: [] });
  p = parseRoomProject({ ...p, room: { ...p.room, ...ROOM } });
  p = parseRoomProject({ ...p, modules: newProject().modules });
  const starter = p.modules[0].id;
  const ids: Record<string, string> = {};
  let sel = starter; // выбранный корпус: палитра берёт декоры у него
  for (const s of STEPS) {
    // вкладка «Кухонные модули» → «Готовые кухонные модули» → кнопка ширины; модуль встаёт в свой ряд и становится выбранным
    const r = placeKitchenModule(p, kitchenTemplate(s.kind, s.palette, mod(p, sel).module), s.wallY !== undefined || s.kind === "wall" ? { wallY: s.wallY } : {});
    p = commitProject(r.project);
    const id = r.id; ids[s.name] = id; sel = id;
    if (s === STEPS[0]) {
      // первый шкаф комнаты больше не нужен: выбрать его в списке → «Удалить модуль»; корпус пенала — «Корпус: … — выбрать декор» → «Белый»
      p = commitProject({ ...p, modules: p.modules.filter((a) => a.id !== starter) });
      p = modify(p, id, (n) => { n.decor = DECOR; });
    }
    p = modify(p, id, (n) => { n.name = s.name; });
    for (const e of s.edit ?? []) p = edit(p, id, e);
    p = uiPlace(p, id, s.at);
  }
  // фасады: утопленная филёнка у пенала → «Применить ко всем модулям», затем каждому навесному — рифлёная фрезеровка (серия и №)
  sel = ids[STEPS[0].name];
  p = commitProject(applyFacadeStyle(p, sel));
  for (const s of STEPS) if (s.kind === "wall") { sel = ids[s.name]; const v = mod(p, sel).module.vernissage!; p = setVernissage(p, sel, { ...v, milling: V_FLUTE.milling }); }
  // столешница над нижними задней стены → «Акрил 40» → «Длина» → «+ под варочную» → «От левого торца»
  sel = ids[BASE_FOR_WORKTOP];
  const wt = placeWorktop(p, mod(p, sel).module);
  p = commitProject(wt.project); const top = wt.ids[0]; ids["Столешница задняя"] = top; sel = top;
  p = modify(p, top, (n) => setWorktopMaterial(n, "acrylic", 40));
  p = modify(p, top, (n) => { n.width = BACK_TOP.length; });
  p = modify(p, top, (n) => { const cw = 560, cd = 490, x = (n.width - cw) / 2; n.worktop = { ...n.worktop!, cutouts: [...n.worktop!.cutouts, { kind: "hob", x: Math.max(50, Math.min(n.width - 50 - cw, Math.round(x))), width: cw, depth: cd }] }; });
  p = modify(p, top, (n) => { const c = [...n.worktop!.cutouts]; c[0] = { ...c[0], x: BACK_TOP.hob }; n.worktop = { ...n.worktop!, cutouts: c }; });
  // столешница крыла: «Копия» задней (правая кнопка → «Копия») → «Убрать» вырез → «Длина» → «Название модуля» → «Положение» (поворот 270)
  const copyTop = (name: string, length: number, at: () => PlaceTarget) => {
    const c = copyModuleGroup(p, [top]); p = commitProject(c.project); const id = c.ids[0]; ids[name] = id;
    p = modify(p, id, (n) => { n.worktop = { ...n.worktop!, cutouts: n.worktop!.cutouts.filter((_, j) => j !== 0) }; });
    p = modify(p, id, (n) => { n.width = length; });
    p = modify(p, id, (n) => { n.name = name; });
    p = uiPlace(p, id, at());
    return id;
  };
  const wz = wingZ(p, top);
  const wing = copyTop(WING_TOP.name, WING_TOP.end - wz, () => ({ y: BASE_H, x: ROOM.width - mod(p, ids[WING_TOP.name]).module.depth, z: wz, rotation: 270 }));
  void wing;
  // мойка: «Установить мойку и сифон» у модуля под мойку — вырез на столешнице крыла
  p = commitProject(installSink(p, ids["Под мойку 600"]));
  // подсветка рабочей зоны под навесными — «всем навесным ряда» (задняя стена и крыло)
  p = commitProject(setRowUnderLight(p, ids["Навесной 600"], true, true));
  p = commitProject(setRowUnderLight(p, ids["Навесной 300"], true, true));
  // барная стойка: «Копия» задней → длина 1600, акрил 40 с водопадами с обеих сторон до пола («Водопад слева», «Водопад справа»)
  const bar = copyTop(BAR.name, BAR.length, () => BAR.at);
  p = commitProject(toggleWaterfall(p, bar, "left", true));
  p = commitProject(toggleWaterfall(p, bar, "right", true));
  sel = bar;
  // витрина: вкладка «Шкафы распашные» → «Пустой шкаф» 1035 × 2500 × 291 → «Добавить в комнату» (декоры — от выбранного корпуса, стойки)
  const vm = createModule("empty", VITRINE.width, VITRINE.height, VITRINE.depth, mod(p, sel).module);
  const q = appendModule(p, vm); q.modules.at(-1)!.module.name = newModuleName(vm.name); p = commitProject(q);
  const vit = p.modules.at(-1)!.id; ids[VITRINE.name] = vit;
  p = modify(p, vit, (n) => { n.name = VITRINE.name; });                      // «Название модуля»
  p = modify(p, vit, (n) => { n.backType = "none"; });                        // «Тип задней стенки» → «Без задней стенки»
  p = modify(p, vit, (n) => { n.height = VITRINE.fullHeight; });             // «Высота»
  p = modify(p, vit, (n) => { n.plinthHeight = VITRINE.plinth; });           // «Высота цоколя»
  p = modifySection(p, vit, (s, n) => setShelfCount(n, s, VITRINE.shelves)); // «Полок в секции»
  p = modify(p, vit, (n) => setSectionShelves(n, n.sections[0].id, true));   // правая кнопка → «Подсветка» → «Все полки секции»
  p = modifySection(p, vit, (s, n) => { s.doorSplit = defaultDoorSplit(mod(p, vit).module, mod(p, vit).module.sections[0]); delete s.removedDoors; void n; }); // «Разделить фасады по высоте»
  p = modifySection(p, vit, (s) => { s.doorSplit = VITRINE.doorSplit; });   // «Высота нижнего ряда фасадов»
  p = modify(p, vit, (n) => { n.alu = { ...DEFAULT_ALU }; if (n.vernissage) { delete n.vernissage; delete n.facadeT; } }); // «Тип распашных фасадов» → рамка ALU
  p = modify(p, vit, (n) => { n.alu = { ...n.alu!, color: VITRINE.alu.color }; });   // «Цвет профиля»
  p = modify(p, vit, (n) => { n.alu = { ...n.alu!, insert: VITRINE.alu.insert }; }); // «Вставка рамки»
  // общая панель «Положение»: «Поворот корпуса», «От левой стены», «От задней стены» — каждое поле применяется сразу (NumberField:
  // то же число, что показано, не применяется; «От левой/задней стены» показывают габарит bounds, «Поворот корпуса» — rotation)
  for (const [k, v] of VITRINE.place) {
    const a = mod(p, vit), cur = k === "r" ? a.rotation ?? 0 : bounds(a)[k];
    if (v === cur) continue;
    p = commitProject(k === "r" ? rotateModule(p, vit, v) : setWallDistance(p, vit, k, v, false, []));
  }
  // отдельные панели: окно комнат «Добавить отдельную панель» (без автофальшей и проверки — updateRoom), затем выбрать в списке → «Положение»
  let form = PANEL_FORM;
  for (const [input, at] of PANELS) {
    form = fillPanelForm(form, input);
    const a = placeFreePanel(p, { ...form, contour: undefined });
    p = parseRoomProject({ ...p, modules: [...p.modules, a] });
    ids[input.name] = a.id;
    p = uiPlace(p, a.id, at);
  }
  // решение Макса 26.10: цена по большей модели — нижняя панель «Стоимость» → «Модель цены»
  p = commitProject(withPriceModel(p, "max", estimate(p).sheetPrice));
  return { project: parseProject(JSON.parse(JSON.stringify(p)), true), ids };
}
/** Крыло: от глубины задней столешницы (её z + d) до колонны. */
export function wingZ(p: Project, topId: string) { const bt = bounds(p.modules.find((a) => a.id === topId)!); return Math.round(bt.z + bt.d); }

if (process.argv[1]?.endsWith("dp-2810-kitchen.ts")) {
  const { project, ids } = build();
  mkdirSync("public/local-projects", { recursive: true });
  writeFileSync("public/local-projects/dp-2810-kitchen.json", JSON.stringify(project, null, 1));
  const errors = projectErrors(project, true);
  const validation = project.modules.flatMap((a) => validate(a.module).map((e) => a.module.name + ": " + e));
  const collisions = project.modules.flatMap((a) => partCollisions(parts(a.module), a.module).map((c) => a.module.name + ": " + c.names.join(" × ")));
  const sub = (names: string[]): Project => ({ ...project, modules: project.modules.filter((a) => names.some((n) => ids[n] === a.id)) });
  const kitchenNames = Object.keys(ids).filter((n) => !/Барная|Витрин|витрин|стойк/.test(n));
  const sum = (pp: Project) => { const e = estimate(pp); return { byMarkup: e.byMarkup, bySheet: e.bySheet, client: Math.max(e.byMarkup ?? 0, e.bySheet ?? 0), cost: e.knownCost, sheets: e.ldspSheets, vernissageCost: e.vernissageCost, vernissageClient: e.vernissageOnTop, retail: e.retailExtras, split: e.split, pending: e.lines.filter((l) => l.pending || l.unitPrice === null).map((l) => `${l.label} × ${l.quantity}`), }; };
  const out = { errors, validation, collisions, modules: project.modules.length, kitchen: sum(sub(kitchenNames)), bar: sum(sub(["Барная стойка", "Щит у барной стойки · торец перегородки"])), vitrine: sum(sub(["Витрина", "Задняя стенка витрины · левая", "Задняя стенка витрины · правая", "Боковина витрины"])), total: sum(project),
    placed: project.modules.map((a) => { const b = bounds(a); return `${a.module.name}: x ${Math.round(b.x)} z ${Math.round(b.z)} y ${Math.round(b.y)} · ${Math.round(b.w)}×${Math.round(b.h)}×${Math.round(b.d)} r${a.rotation ?? 0}`; }) };
  if (process.argv.includes("--json")) console.log(JSON.stringify(out));
  else console.log(JSON.stringify(out, null, 1));
  if (process.argv.includes("--lines")) for (const l of estimate(project).lines) console.log(`  ${l.id} | ${l.label} · ${l.quantity} ${l.unit} × ${l.unitPrice ?? "?"}${l.retail ? " (розница)" : ""}`);
  if (process.argv.includes("--parts")) for (const a of project.modules) for (const pt of parts(a.module)) if (pt.role !== "fastener") console.log(a.module.name, "|", pt.id.replace(/^[0-9a-f-]{36}/, "s"), pt.name, pt.size.map(Math.round).join("x"), pt.position.map(Math.round).join(","));
}
