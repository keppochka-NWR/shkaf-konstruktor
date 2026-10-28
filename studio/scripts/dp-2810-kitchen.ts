// ДП 28.10 (обезличено: dp-2810), зона 3 — кухня Г, барная стойка и витрина: сборка ФУНКЦИЯМИ студии, теми же, что вызывает интерфейс
// (кухонная палитра, панель модуля, поля «Положение», «Копия», отдельные панели комнаты). Сценарий мышью
// (scripts/dp-2810-kitchen-manager.ts) повторяет те же шаги кликами — детали и цена сверяются.
// Запуск: npx tsx scripts/dp-2810-kitchen.ts [--json] [--lines] [--parts] → public/local-projects/dp-2810-kitchen.json (личный, не в git).
// Данных клиента здесь нет: только размеры с развёрток (масштаб снят по размерным цепочкам). Допущения помечены «ДОПУЩЕНИЕ».
//
// Развёртка, стена 12–13 = 3 850 (задняя): ниша для штор 200 | пенал под холодильник 600 | пенал духовка+СВЧ 600 | низ 600 ящики |
//   600 под варочную (3 ящика) | 600 распашной | фальш 50 | угол 600 (глухой); верх 600 | 600 вытяжка | 600 | 350 | угол 300.
// Стена 13–14 = 2 380 (правая): угол 590 + фальш 50 | 530 распашной | 600 мойка | 600 ПММ | 10; верх: угол 300 | 300 | 580 | 600 | 600.
// Высоты: цоколь 100, столешница — верх 900 (акрил 40 → низ 860), фартук 600 (900…1500), верх 1 120 (1500…2620), над мебелью 94 до потолка 2714.
import { mkdirSync, writeFileSync } from "node:fs";
import { initialModule, parts, validate, distribute, fitDrawersAfterResize, shelfMaxDepth, type Module } from "../src/model";
import { applyAutoFillers, projectErrors, parseProject, appendModule, copyModuleGroup, bounds, type Project, type PlacedModule } from "../src/project";
import { kitchenProject, kitchenTemplate, placeKitchenModule, placeWorktop, type KitchenItem } from "../src/kitchenProject";
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
import { createModule, newModuleName } from "../src/ModulePalette";
import { partCollisions } from "../src/collisions";
import { estimate } from "../src/pricing";
import type { VernissageFacade } from "../src/facadesVernissage";

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

/** Шаг сборки — как действие менеджера: палитра → правки панели → поля «Положение». Сценарий мышью читает эти же шаги. */
export type Step =
  | { do: "kitchen"; kind: KitchenItem; width: number; name: string; at: PlaceTarget; edit?: Edit[]; /** палитра «Низ навесных от пола» (0 — новый навесной встаёт на пол в свободный угол, потом «Положение») */ wallY?: number }
  | { do: "worktop"; name: string; length: number; at: PlaceTarget }
  | { do: "copyWorktop"; from: string; name: string; length: number; at: PlaceTarget; waterfall?: boolean }
  | { do: "wardrobe"; name: string; width: number; height: number; depth: number; at: PlaceTarget; edit: Edit[] }
  | { do: "panel"; input: FreePanelInput; at: PlaceTarget };
export type Edit =
  | { height: number } | { depth: number } | { support: number } | { facade: VernissageFacade } | { applyAll: true }
  | { milling: string } | { sink: true } | { hob: number } | { underLight: true } | { worktopMaterial: "acrylic-40" }
  | { plinth: number } | { shelves: number } | { back: "none" } | { alu: true } | { doorSplit: number } | { shelfLights: true };

/** Фальш 50 у угла — МДФ Вернисаж уже 246 не делает (паспорт): ЛДСП 16 в цвет корпуса, кромка 2 — ДОПУЩЕНИЕ. */
const ldsp = (name: string, width: number, height: number, plane: FreePanelInput["plane"]): FreePanelInput => ({ name, width, height, thickness: 16, plane, edge: 2, decor: DECOR });
const panel = (name: string, width: number, height: number, plane: FreePanelInput["plane"], v: VernissageFacade): FreePanelInput => ({ name, width, height, thickness: v.thickness, plane, edge: 0, decor: DECOR, vernissage: v });

export const STEPS: Step[] = [
  // --- задняя стена: пеналы (видимый левый бок — накладная панель МДФ эмаль гладкая, ниша для штор 200 свободна)
  { do: "kitchen", kind: "tall-fridge", width: 600, name: "Пенал под холодильник 600", at: { x: 200, z: 0, y: 0 }, edit: [{ height: TALL_H }, { facade: V_FRAME }] },
  { do: "kitchen", kind: "tall-oven", width: 600, name: "Пенал: духовка + СВЧ 600", at: { x: 800, z: 0, y: 0 }, edit: [{ height: TALL_H }, { support: 515 }] },
  { do: "kitchen", kind: "base-drawers", width: 600, name: "Нижний с ящиками 600", at: { x: 1400, z: 0, y: 0 }, edit: [{ height: BASE_H }] },
  { do: "kitchen", kind: "base-drawers", width: 600, name: "Нижний под варочную 600", at: { x: 2000, z: 0, y: 0 }, edit: [{ height: BASE_H }] },
  { do: "kitchen", kind: "base-doors", width: 600, name: "Нижний распашной 600", at: { x: 2600, z: 0, y: 0 }, edit: [{ height: BASE_H }] },
  // --- правая стена (крыло, поворот 270): угол 590 + фальш 50 свободны, далее 530 · мойка 600 · ПММ 600 (ПММ — без корпуса, см. ответ)
  { do: "kitchen", kind: "base-doors", width: 530, name: "Нижний распашной 530", at: { x: WING_X_BASE, z: 640, y: 0, rotation: 270 }, edit: [{ height: BASE_H }] },
  { do: "kitchen", kind: "sink", width: 600, name: "Под мойку 600", at: { x: WING_X_BASE, z: 1170, y: 0, rotation: 270 }, edit: [{ height: BASE_H }] },
  // --- навесные 1120 × 300 (с фасадом), низ 1500
  { do: "kitchen", kind: "wall", width: 600, name: "Навесной 600", at: { x: 1400, z: 0, y: WALL_Y }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { do: "kitchen", kind: "wall", width: 600, name: "Навесной над вытяжкой 600", at: { x: 2000, z: 0, y: WALL_Y }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { do: "kitchen", kind: "wall", width: 600, name: "Навесной 600 · 2", at: { x: 2600, z: 0, y: WALL_Y }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { do: "kitchen", kind: "wall", width: 300, name: "Навесной 300", wallY: 0, at: { x: WING_X_WALL, z: 300, y: WALL_Y, rotation: 270 }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { do: "kitchen", kind: "wall", width: 580, name: "Навесной 580", wallY: 0, at: { x: WING_X_WALL, z: 600, y: WALL_Y, rotation: 270 }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { do: "kitchen", kind: "wall", width: 600, name: "Навесной 600 · 3", wallY: 0, at: { x: WING_X_WALL, z: 1180, y: WALL_Y, rotation: 270 }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  { do: "kitchen", kind: "wall", width: 600, name: "Навесной 600 · 4", wallY: 0, at: { x: WING_X_WALL, z: 1780, y: WALL_Y, rotation: 270 }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
  // последним — навесной 350 у угла задней стены (пока ряд не занят до стены, палитра ставит новые навесные в него, потом их переносят)
  { do: "kitchen", kind: "wall", width: 350, name: "Навесной 350", wallY: 0, at: { x: 3200, z: 0, y: WALL_Y }, edit: [{ height: WALL_H }, { depth: WALL_D }] },
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
const place = (p: Project, id: string, t: PlaceTarget) => commitProject(placeModuleAt(p, id, t));

/** Правка панели (KitchenPanel / панель шкафа) — тем же кодом, что обработчик поля. */
function edit(p: Project, id: string, e: Edit): Project {
  if ("height" in e) return modify(p, id, (n) => { n.height = e.height; if (n.kitchen?.column) configureColumn(n); else if (n.kdrawers) n.kdrawers = refitKDrawers(n, "height"); });
  if ("depth" in e) return modify(p, id, (n) => { n.depth = e.depth; if (n.kdrawers) n.kdrawers = refitKDrawers(n, "depth"); });
  if ("support" in e) return modify(p, id, (n) => configureColumn(n, { support: e.support }));
  if ("facade" in e) { let q = modify(p, id, (n) => { const k = changeFacadeKind(n, "vernissage", { keepThickness: true }); for (const key of Object.keys(n) as (keyof Module)[]) delete n[key]; Object.assign(n, k); });
    return modify(q, id, (n) => { n.vernissage = { ...e.facade }; n.facadeT = e.facade.thickness; }); }
  if ("milling" in e) return modify(p, id, (n) => { n.vernissage = { ...n.vernissage!, milling: e.milling }; n.facadeT = n.vernissage.thickness; });
  if ("applyAll" in e) return commitProject(applyFacadeStyle(p, id));
  if ("sink" in e) return commitProject(installSink(p, id));
  if ("underLight" in e) return commitProject(setRowUnderLight(p, id, true, true));
  if ("worktopMaterial" in e) return modify(p, id, (n) => setWorktopMaterial(n, "acrylic", 40));
  if ("hob" in e) return modify(p, id, (n) => { const cw = 560, cd = 490; n.worktop = { ...n.worktop!, cutouts: [...n.worktop!.cutouts, { kind: "hob", x: e.hob, width: cw, depth: cd }] }; });
  if ("plinth" in e) return modify(p, id, (n) => { n.plinthHeight = e.plinth; });
  if ("shelves" in e) return modify(p, id, (n) => { const s = n.sections[0]; s.shelves = distribute(n, s, e.shelves); });
  if ("back" in e) return modify(p, id, (n) => { n.backType = "none"; });
  if ("alu" in e) return modify(p, id, (n) => { n.alu = { profile: "F1-09", color: "champagne", insert: "glass-clear" }; delete n.facadeT; });
  if ("doorSplit" in e) return modify(p, id, (n) => { n.sections[0].doorSplit = e.doorSplit; });
  if ("shelfLights" in e) return modify(p, id, (n) => { const s = n.sections[0]; s.shelfLights = s.shelves.map((_, j) => j); });
  throw Error("неизвестная правка " + JSON.stringify(e));
}

export function build(): { project: Project; ids: Record<string, string> } {
  // вкладка «Кухня» (?order=kitchen): стартовая кухня 3000 в комнате 3600 × 3000 × 2700 → размеры помещения по ДП → удалить стартовый ряд
  let p = kitchenProject();
  p = commitProject({ ...p, room: { ...p.room, ...ROOM } });
  const start = p.modules.map((a) => a.id);
  const ids: Record<string, string> = {};
  let first = true;
  for (const s of STEPS) {
    if (s.do !== "kitchen") continue;
    // палитра: шаблон от выбранного корпуса (декоры), модуль встаёт в свой ряд; затем панель и «Положение»
    const source = p.modules.find((a) => a.id === (Object.values(ids).at(-1) ?? start[start.length - 1]))!.module;
    const r = placeKitchenModule(p, kitchenTemplate(s.kind, s.width, source), s.wallY !== undefined ? { wallY: s.wallY } : {});
    p = commitProject(r.project);
    const id = r.id; ids[s.name] = id;
    if (first) {
      // стартовый ряд больше не нужен: «Удалить модуль» у каждого; корпус пенала — ЛДСП «Белый» (материал выбранного корпуса)
      for (const sid of start) p = commitProject({ ...p, modules: p.modules.filter((a) => a.id !== sid) });
      p = commitProject({ ...p, modules: p.modules.map((a) => (a.id === id ? { ...a, module: { ...a.module, decor: DECOR } } : a)) });
      first = false;
    }
    p = modify(p, id, (n) => { n.name = s.name; });
    for (const e of s.edit ?? []) p = edit(p, id, e);
    p = place(p, id, s.at);
  }
  // фасады: утопленная филёнка → «Применить ко всем модулям», затем навесным — рифлёная фрезеровка
  p = edit(p, ids["Пенал под холодильник 600"], { applyAll: true });
  for (const [name, id] of Object.entries(ids)) if (p.modules.find((a) => a.id === id)!.module.kitchen?.role === "wall") p = edit(p, id, { milling: V_FLUTE.milling });
  // столешница над нижними задней стены → акрил 40, длина до правой стены 2450 (угол под ней)
  const wt = placeWorktop(p, p.modules.find((a) => a.id === ids["Нижний с ящиками 600"])!.module);
  p = commitProject(wt.project); const top = wt.ids[0]; ids["Столешница задняя"] = top;
  p = edit(p, top, { worktopMaterial: "acrylic-40" });
  p = modify(p, top, (n) => { n.width = 2450; });
  p = edit(p, top, { hob: 600 + (600 - 560) / 2 }); // варочная над нижним 2000…2600: от левого торца 620
  // столешница крыла: «Копия» задней → поворот 270, к правой стене, длина 1780 (от угла 600 до колонны 2380)
  const c1 = copyModuleGroup(p, [top]); p = commitProject(c1.project); const wing = c1.ids[0]; ids["Столешница крыла"] = wing;
  const bt = bounds(p.modules.find((a) => a.id === top)!), wz = Math.round(bt.z + bt.d); // крыло — от глубины задней столешницы до колонны 2380
  p = modify(p, wing, (n) => { n.width = 2380 - wz; n.worktop = { ...n.worktop!, cutouts: [] }; n.name = "Столешница крыла"; });
  p = place(p, wing, { rotation: 270, x: ROOM.width - p.modules.find((a) => a.id === wing)!.module.depth, z: wz, y: BASE_H });
  // мойка: «Установить мойку и сифон» у модуля под мойку — вырез на столешнице крыла
  p = edit(p, ids["Под мойку 600"], { sink: true });
  // подсветка рабочей зоны под навесными — «всем навесным ряда» (задняя стена и крыло)
  p = edit(p, ids["Навесной 600"], { underLight: true });
  p = edit(p, ids["Навесной 300"], { underLight: true });
  // барная стойка ~1600 × 600 (ДОПУЩЕНИЕ: в ДП нет плана и размеров стойки), акрил 40 с водопадом с обеих сторон до пола, верх 900
  const c2 = copyModuleGroup(p, [top]); p = commitProject(c2.project); const bar = c2.ids[0]; ids["Барная стойка"] = bar;
  p = modify(p, bar, (n) => { n.width = 1600; n.worktop = { ...n.worktop!, cutouts: [] }; n.name = "Барная стойка"; });
  p = place(p, bar, { rotation: 0, x: 1600, z: 2420, y: BASE_H });
  p = commitProject(toggleWaterfall(p, bar, "left", true));
  p = commitProject(toggleWaterfall(p, bar, "right", true));
  // витрина 1035 × 2520 × 330: шкаф из общей палитры («Пустой шкаф»), у правой стены за колонной (ДОПУЩЕНИЕ: плана в ДП нет)
  const vsrc = { ...initialModule(), decor: DECOR, facadeDecor: DECOR };
  const vm = createModule("empty", 1035, 2500, 291, vsrc) /* палитра — до 2500; выше — после «без задника» */;
  let q = appendModule(p, vm); q.modules.at(-1)!.module.name = "Витрина"; p = commitProject(q);
  const vit = p.modules.at(-1)!.id; ids["Витрина"] = vit;
  for (const e of [{ back: "none" }, { height: 2520 }, { plinth: 100 }, { shelves: 4 }, { shelfLights: true }, { doorSplit: 1240 }, { alu: true }] as Edit[]) p = edit(p, vit, e);
  p = place(p, vit, { rotation: 270, x: ROOM.width - 19 - 291 - 20, z: 2800, y: 0 });
  // отдельные панели (вкладка комнат «Добавить отдельную панель», материал «МДФ Вернисаж»): ставятся в свободное место, затем «Положение»
  const panels: [FreePanelInput, PlaceTarget][] = [
    [panel("Боковина пенала видимая", 579, TALL_H, "yz", V_SMOOTH), { x: 200 - 19, z: 0, y: 0 }],
    [ldsp("Фальш угловой низа · задняя стена", 50, BASE_H - 100, "xy"), { x: 3200, z: 579 - 16, y: 100 }],
    [ldsp("Фальш угловой низа · правая стена", 50, BASE_H - 100, "yz"), { x: WING_X_BASE, z: 590, y: 100 }],
    [panel("Щит у барной стойки · торец перегородки", 410, 2620, "yz", V_PVC), { x: 3250 - 19, z: 2380, y: 0 }],
    [panel("Задняя стенка витрины · левая", 517, 2520, "yz", V_PVC), { x: ROOM.width - 19, z: 2800, y: 0 }], // шире 1000 Вернисаж не делает — две панели по 517/518
    [panel("Задняя стенка витрины · правая", 518, 2520, "yz", V_PVC), { x: ROOM.width - 19, z: 2800 + 517, y: 0 }],
    [panel("Боковина витрины", 330, 2520, "xy", V_PVC), { x: ROOM.width - 330, z: 2800 + 1035, y: 0 }],
  ];
  for (const [input, at] of panels) {
    const a = placeFreePanel(p, input); p = commitProject(parseRoomProject({ ...p, modules: [...p.modules, a] }));
    ids[input.name] = a.id; try { p = place(p, a.id, at); } catch (e) { const b = p.modules.find((x) => x.id === a.id)!; for (const t of [{ ...at, x: 3800 }, { ...at, z: 3300 }, { y: 0 }, { x: 3831 }, { z: 2800 }]) { try { placeModuleAt(p, a.id, t); console.error("DBG ok", JSON.stringify(t)); } catch (e2) { console.error("DBG fail", JSON.stringify(t), (e2 as Error).message.slice(0, 120)); } } { const n = structuredClone(p); const x = n.modules.find((m) => m.id === a.id)!; x.x = 3831; x.z = 2800; const n2 = applyAutoFillers(n); const y = n2.modules.find((m) => m.id === a.id)!; console.error("DBG2", JSON.stringify(bounds(y)), y.x, y.z, y.module.width, y.module.depth, JSON.stringify(y.module.wallFiller), projectErrors(n2).slice(0, 2).join(" | ")); } console.error("DBG", input.name, JSON.stringify(p.room), JSON.stringify(bounds(b)), b.rotation, JSON.stringify(at)); throw e; }
  }
  p = { ...p, calculation: { markup: 2.2, overrides: {}, maxModel: true, sheetPrice: 23000 } }; // решение Макса 26.10: цена по большей модели
  return { project: parseProject(JSON.parse(JSON.stringify(p)), true), ids };
}

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
