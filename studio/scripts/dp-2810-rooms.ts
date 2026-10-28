// Дизайн-проект dp-2810 (обезличено): все зоны, кроме кухни, — прихожая, ТВ-зона, спальня, лоджия, детская, ванная, душевая.
// Каждое изделие собрано функциями студии (палитра createModule → поля модуля, freePanel, kitchenWorktop/setWorktopMaterial), без импорта.
// Размеры — по развёрткам дизайн-проекта (решение Макса 26.10: эскиз главнее правил студии, отклонения — флагами и в комментариях);
// где размер на развёртке не читается — допущение, помечено «ДОПУЩЕНИЕ».
// Запуск: npx tsx scripts/dp-2810-rooms.ts [--zone=hall] [--json] [--out=файл.json] [--lines]
// → public/local-projects/dp-2810-<зона>.json (личные проекты, в публикацию не идут) + смета по изделиям и зонам.
// Клиентских данных здесь нет и быть не должно: только обезличенное имя проекта и размеры.
import { writeFileSync, mkdirSync } from "node:fs";
import { initialModule, section, parts, validate, drawersToRoof, innerBottom, innerTop, type Module, type Section } from "../src/model";
import { createModule, assembleModule } from "../src/paletteBuild";
import { setWorktopMaterial } from "../src/kitchen";
import { freePanel } from "../src/freePanels";
import { setModuleHandleFloor } from "../src/handleFloorGroup";
import { parseProject, projectErrors, applyAutoFillers, bounds, type Project, type PlacedModule } from "../src/project";
import { estimate, MARKUP_DEFAULT } from "../src/pricing";
import { partCollisions } from "../src/collisions";
import { roomWarnings, collisionWarnings } from "../src/roomWarnings";
import type { VernissageFacade } from "../src/facadesVernissage";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
// Материалы по спецификации ДП: ЛДСП Ламарти Премиум двух цветов — однотон (кремовый) и древесный
export const CREAM = "Кремовый", WOOD = "Дуб Галиано";
/** Эмаль Вернисаж: молдинги — №63 «Двойной контур 2» (рамка в два контура, ближе всего к накладному молдингу DD35 в два ряда);
 *  утопленная филёнка — №94 «Шейкер узкий»; рифлёная — №86 «Каннелюры» (без ограничения ширины по паспорту — фасады 1225);
 *  гладкая — №15. Двери и ящики красятся с двух сторон (+50 %), как в разборе Макса; видимые бока — с одной (sideFacadeSpec). */
export const MILL = { molding: "63", shaker: "94", fluted: "86", smooth: "15" } as const;
const ENAMEL = "RAL 9001 кремово-белый", MOCHA = "NCS S 4010-Y30R мокко";
const V = (milling: string, enamelColor = ENAMEL): VernissageFacade => ({ milling, cover: "enamel-matte", enamelColor, thickness: 19, twoSided: true });
const HANDLE_LONG = "lm92155846"; // Brante 1200 · матовое золото — длинные ручки под латунь (визуализации)

const src = (decor: string, facadeDecor = decor): Module => ({ ...initialModule(), decor, facadeDecor });
type Kind = Parameters<typeof createModule>[0];
/** Модуль из палитры (как «Добавить мебель»): вид, ширина, высота, глубина корпуса, число дверей; затем поля панели. */
function pal(kind: Kind, w: number, h: number, d: number, decor: string, facadeDecor: string, patch: Partial<Module> = {}, doors?: number): Module {
  // выше 2500 палитра не собирает с задником ХДФ — как менеджер: собрать 2500, задник ЛДСП 16 («Тип задней стенки»), затем высота
  const m = assembleModule(kind, w, Math.min(h, 2500), d, src(decor, facadeDecor), doors); // проверка — после полей (validate в отчёте)
  if (h > 2500) { m.backType = "board"; m.height = h; }
  // решение Макса 26.10: видимого крепежа нет — эксцентрики («Крепёж корпуса» → «Эксцентрики D15»)
  if (kind !== "worktop") m.fastening = "eccentric";
  Object.assign(m, patch);
  return m;
}
/** Доля проёма для центра полки, заданного от пола. */
const at = (m: Module, center: number) => Math.round((center - innerBottom(m)) / (innerTop(m) - innerBottom(m)) * 10000) / 10000;
const shelvesAt = (m: Module, s: Section, centers: number[], fixed: number[] = []) => { s.shelves = centers.map((c) => at(m, c)); s.fixed = fixed; };
const lights = (s: Section, o: { shelves?: boolean; stands?: ("left" | "right")[] }) => { if (o.shelves) s.shelfLights = s.shelves.map((_, i) => i); if (o.stands) s.standLights = o.stands; };
/** Ящики до крыши (как «Добавить: Ящики» + «до крыши»): n ящиков, push DTC или доводчик Unihopper. */
function drawers(m: Module, s: Section, n: number, push: boolean) {
  s.drawers = n; s.drawerCap = false;
  s.drawerConfigs = drawersToRoof(m, s).map((c) => ({ ...c, slide: "gtv0fpo" as const, operation: push ? "push" as const : "soft-close" as const, brand: push ? "dtc" as const : "unihopper" as const }));
  // подвесной корпус: верхний ящик упирается в навесы ABS в задних верхних углах — короче направляющая (поле «Длина направляющих»)
  const hit = (j: number) => partCollisions(parts(m), m).some((x) => x.names.some((n) => /^Навес|^Заглушка навеса/.test(n)) && x.names.some((n) => n.startsWith(`Ящик ${j + 1} `)));
  if (m.hanging) s.drawerConfigs.forEach((c, j) => { for (const l of [500, 450, 400, 350, 300, 270, 250]) { if (!hit(j)) break; if (l < c.length) c.length = l; } });
}

let seq = 0;
type Item = { key: string; title: string; dims: string; mods: PlacedModule[] };
const put = (zone: string, item: string, module: Module, x: number, z: number, y = 0, rotation: PlacedModule["rotation"] = 0): PlacedModule => ({ id: `${zone}-${item}-${++seq}`, x, z, y, rotation, module });
const panel = (zone: string, item: string, name: string, w: number, h: number, decor: string, x: number, y: number, z: number, plane: "xy" | "yz" = "xy"): PlacedModule => {
  const a = freePanel({ name, width: w, height: h, thickness: 16, plane, edge: 2, decor });
  return Object.assign(a, { id: `${zone}-${item}-${++seq}`, x, y, z });
};

// ───────────────────────── 1. Прихожая (развёртка лист 13, стены 1-2 и 2-3; потолок 2620) ─────────────────────────
// План: x — вдоль стены 2-3 (1875 = 775 + 1020 + 80), z — вдоль стены 1-2 (2400) от угла 2.
function hall(): { room: Project["room"]; items: Item[] } {
  const Z = "hall", H = 2620;
  // 1.1 Стеллаж открытый 325 × 2620 × 400 (древесный декор), полки в зоне 1720 над 900 с подсветкой; ниже 900 — свободно (пуф).
  const sh = pal("shelves", 325, H, 400, WOOD, WOOD, { plinthHeight: 100, lightPsu: true, autoFillersOff: true });
  shelvesAt(sh, sh.sections[0], [908, 1252, 1596, 1940, 2284], [0]); lights(sh.sections[0], { shelves: true });
  // 1.2 Шкаф 1470 × 2620 × 600: двери 450 + 510 + 510 по эскизу (2 корпуса: 450 и 1020), внизу открытая ниша для обуви 250 + полка,
  // фасады над нишей до потолка 2340 (facadeFrom — ручное отклонение по эскизу); корпус древесный, фасады — кремовый (ЛДСП двух цветов).
  const D = 582; // 600 с фасадом: 582 + 2 + 16
  const low: Partial<Module> = { plinthHeight: 0, facadeFrom: 268, handleId: HANDLE_LONG, autoFillersOff: true }; // по эскизу без угловой фальши у стеллажа; 80 до стены справа — зазор (ФП 80 вручную)
  const wL = pal("empty", 450, H, D, WOOD, CREAM, low, 1), wR = pal("wardrobe", 1020, H, D, WOOD, CREAM, low, 2);
  shelvesAt(wL, wL.sections[0], [258, 700, 1100, 1500, 1900, 2250], [0]); // ДОПУЩЕНИЕ: наполнение «обсудить» — полки 6 (нижняя — дно ниши, жёсткая)
  for (const s of wR.sections) { shelvesAt(wR, s, [258, 2250], [0]); s.rod = true; s.rodAt = at(wR, 2180); }
  for (const m of [wL, wR]) setModuleHandleFloor(m, 700);
  // 1.3 Консоль подвесная 900 × 150 × 400 с ящиком на левой стене (стена 1-2), низ 750 — «Подвесной ящик» палитры
  const con = pal("hanging-drawer", 900, 150, 300, WOOD, WOOD, { autoFillersOff: true }); // ДОПУЩЕНИЕ: глубина 300 (при 400 консоль упирается в бок шкафа 600)
  return {
    room: { width: 1875, depth: 2400, height: 2714, openings: [] },
    items: [
      { key: "shelving", title: "Стеллаж открытый с подсветкой полок", dims: "325×2620×400", mods: [put(Z, "shelving", sh, 0, 0)] },
      { key: "wardrobe", title: "Шкаф 1470 (450 + 1020), фасады ЛДСП, ниша для обуви 250", dims: "1470×2620×600", mods: [put(Z, "wardrobe", wL, 325, 0), put(Z, "wardrobe", wR, 775, 0)] },
      { key: "console", title: "Консоль подвесная с ящиком", dims: "900×150×300, низ 750", mods: [put(Z, "console", con, 0, 400, 750, 90)] },
    ],
  };
}

// ───────────────────────── 2. ТВ-зона (развёртка лист 13, стена 10-11 = 3950; потолок 2620) ─────────────────────────
function tv(): { room: Project["room"]; items: Item[] } {
  const Z = "tv", BODY = 378, D = 431; // тумба 410 = корпус 378 + столешница 32; глубина 450 = 431 + 19 фасад
  // 2.1 Тумба 3950 × 410 × 450: фронты по развёртке 1500 + 1225 + 1225 (1500 — под паровой камин); предел корпуса 1300 →
  // 1500 = 750 + 750 (отклонение: на эскизе один фронт 1500). Ящики push (DTC), фасады эмаль рифлёная №86.
  const body = (w: number) => { const m = pal("drawers", w, BODY, D, CREAM, CREAM, { plinthHeight: 60, vernissage: V(MILL.fluted), autoFillersOff: true }); drawers(m, m.sections[0], 1, true); return m; };
  const xs = [0, 750, 1500, 2725], ws = [750, 750, 1225, 1225];
  const tumba = ws.map((w, i) => put(Z, "tumba", body(w), xs[i], 0));
  // столешница ЛДСП 32 древесная (как ставит палитра «Столешница» над тумбами), 2 части по листу 2750: 1500 + 2450; вырез под камин 1200
  const top = (w: number) => { const m = createModule("worktop", w, 32, 450, src(WOOD)); setWorktopMaterial(m, "ldsp", 32); return m; };
  const t1 = top(1500), t2 = top(2450);
  t1.worktop!.cutouts.push({ kind: "hob", x: 200, z: 100, width: 1200, depth: 250 }); // ДОПУЩЕНИЕ: камин-кассета 1200 × 250 (по паспорту камина)
  // 2.2 Пенал открытый 300 × 2210 × 300 на тумбе, подсветка в стойках (на развёртке — светящиеся боковины)
  const pen = pal("shelves", 300, 2210, 300, WOOD, WOOD, { plinthHeight: 0, lightPsu: true, autoFillersOff: true });
  pen.sections[0].shelves = [1, 2, 3, 4, 5].map((k) => Math.round(k / 6 * 10000) / 10000); lights(pen.sections[0], { stands: ["left", "right"] });
  // 2.3 Панели за ТВ 400 + 400 + 800 × 2210, зазоры 20 под латунные вставки (вставки не рисуются и не считаются)
  const P = (w: number, x: number) => panel(Z, "panels", "МДФ-панель за ТВ (ЛДСП дерево)", w, 2210, WOOD, x, 410, 0);
  return {
    room: { width: 3950, depth: 3000, height: 2714, openings: [] },
    items: [
      { key: "tumba", title: "Тумба под паровой камин, эмаль рифлёная, столешница ЛДСП 32", dims: "3950×410×450", mods: [...tumba, put(Z, "tumba", t1, 0, 0, BODY), put(Z, "tumba", t2, 1500, 0, BODY)] },
      { key: "pencil", title: "Пенал открытый с подсветкой", dims: "300×2210×300", mods: [put(Z, "pencil", pen, 3250, 0, 410)] },
      { key: "panels", title: "Панели за ТВ (дерево) с зазорами под латунь", dims: "400+400+800 × 2210", mods: [P(400, 1440), P(400, 1860), P(800, 2280)] },
    ],
  };
}

// ───────────────────────── 3. Спальня (лист 16, стена 4-6 = 2705; под опуском 2630) ─────────────────────────
function bedroom(): { room: Project["room"]; items: Item[] } {
  const Z = "bedroom", H = 2630, D = 479; // глубина 500 = 479 + 2 + 19
  // 3.1 Шкаф 2000 × 2630 × 500, 4 двери 500, цоколь 100, эмаль с молдингами (Вернисаж №63), ручки 1200 под латунь; 2 корпуса 1000
  const w = () => { const m = pal("wardrobe", 1000, H, D, CREAM, CREAM, { plinthHeight: 100, vernissage: V(MILL.molding), handleId: HANDLE_LONG }, 2); setModuleHandleFloor(m, 700); return m; };
  // 3.2 Декоративные полки 195 в нише: 150 (дерево) + 205 (полки) + 150 (дерево) → один открытый стеллаж 505 × 2530 × 200 на высоте плинтуса (глубина 195 < 200 — минимум студии, +5)
  const nic = pal("shelves", 505, 2530, 200, WOOD, WOOD, { plinthHeight: 0, lightPsu: true, autoFillersOff: true });
  shelvesAt(nic, nic.sections[0], [820, 1260, 1360]); lights(nic.sections[0], { stands: ["left", "right"] });
  return {
    room: { width: 2705, depth: 3000, height: 2714, openings: [] },
    items: [
      { key: "wardrobe", title: "Шкаф 2 м, 4 двери, эмаль с молдингами", dims: "2000×2630×500", mods: [put(Z, "wardrobe", w(), 200, 0), put(Z, "wardrobe", w(), 1200, 0)] },
      { key: "niche", title: "Декоративные полки в нише с подсветкой", dims: "505×2530×200 (эскиз 195)", mods: [put(Z, "niche", nic, 2200, 0, 100)] },
    ],
  };
}

// ───────────────────────── 4. Лоджия (лист 20, стены 2-3 и 4-1 = 1070; потолок 2620) ─────────────────────────
function loggia(): { room: Project["room"]; items: Item[] } {
  const Z = "loggia", H = 2620, RD = 3670;
  // 4.1 Шкаф 900 × 2620 × 450, 2 двери, эмаль с молдингами; справа 170 до стены — видимый бок эмаль гладкая (sidePanels.facade)
  const wr = pal("empty", 900, H, 429, CREAM, CREAM, { plinthHeight: 100, vernissage: V(MILL.molding), handleId: HANDLE_LONG, autoFillersOff: true }, 2);
  shelvesAt(wr, wr.sections[0], [500, 900, 1300, 1700, 2100]);
  wr.sidePanels = { right: { height: H, depth: 429 + 18, facade: true } }; // глубина бока = корпус + фасад (как ставит панель)
  setModuleHandleFloor(wr, 700);
  // 4.2 Консоль подвесная 1070 × 200 × 400 на стене 4-1, низ 550: фасад и бока — эмаль гладкая; радиусные бока — НЕ умеем (прямые бока)
  // корпус 1032 + бока 2 × 19 = 1070 от стены до стены; фасад 1070 шире паспорта №15 (ящик до 1000) → 2 ящика по 516 (отклонение)
  const con = pal("hanging-drawer", 1032, 200, 400, CREAM, CREAM, { vernissage: V(MILL.smooth), autoFillersOff: true });
  con.sections = [{ ...section() }, { ...section() }]; for (const s of con.sections) { s.drawers = 1; s.drawerCap = false; s.drawerConfigs = drawersToRoof(con, s).map((c) => ({ ...c, slide: "gtv0fpo" as const, operation: "push" as const, brand: "dtc" as const, length: 300, height: 104, facadeH: 165 })); }
  con.sidePanels = { left: { height: 200, depth: 418, facade: true }, right: { height: 200, depth: 418, facade: true } };
  return {
    room: { width: 1070, depth: RD, height: 2714, openings: [] },
    items: [
      { key: "wardrobe", title: "Шкаф, 2 двери, эмаль с молдингами, видимый бок гладкий", dims: "900×2620×450", mods: [put(Z, "wardrobe", wr, 0, 0)] },
      { key: "console", title: "Консоль подвесная, эмаль гладкая (бока прямые вместо радиусных)", dims: "1070×200×400, низ 550", mods: [put(Z, "console", con, 0, RD - 440, 550, 180)] },
    ],
  };
}

// ───────────────────────── 5. Детская (лист 17; под опуском 2330) ─────────────────────────
// План: x — вдоль стены 3-4 (окно, 3055) от угла 3, z — вдоль стены 2-3 (4215) от угла 3; шкаф — на стене 1-2 у угла 2.
function kids(): { room: Project["room"]; items: Item[] } {
  const Z = "kids", H = 2330, RD = 4215, D = 479;
  // 5.1 Шкаф 1800 × 2330 × 500: двери 500 × 3 + секция 300 с дверью от 400 (ниже — открыто, к ней примыкает подвесная тумба);
  // эмаль утопленная филёнка (№94), ручки 1200 под латунь; корпуса 1000 + 500 + 300 (предел 1300; у 300 дверь от 400 — facadeFrom,
  // ниже открытая ниша: нижний ряд 300 короче минимума распашного фасада 360, поэтому отдельный корпус)
  const p: Partial<Module> = { plinthHeight: 100, vernissage: V(MILL.shaker), handleId: HANDLE_LONG, autoFillersOff: true };
  const a = pal("wardrobe", 1000, H, D, CREAM, CREAM, p, 2);
  const b = pal("wardrobe", 500, H, D, CREAM, CREAM, p, 1);
  const c = pal("empty", 300, H, D, CREAM, CREAM, { ...p, facadeFrom: 402 }, 1);
  shelvesAt(c, c.sections[0], [408, 900, 1400, 1900], [0]);
  for (const m of [a, b, c]) setModuleHandleFloor(m, 700);
  // 5.2 Подвесная прикроватная тумба 600 × 250 × 400 с ящиком, низ 250 (ДОПУЩЕНИЕ по развёртке 2-3: 150 + 100 плинтус)
  const bed = pal("hanging-drawer", 600, 250, 400, CREAM, CREAM, { autoFillersOff: true });
  // 5.3 Угловой стеллаж 400 × 2330 × 450 с подсветкой полок (виден с двух сторон — ДОПУЩЕНИЕ: открытый спереди)
  const st = pal("shelves", 400, H, 450, WOOD, WOOD, { plinthHeight: 100, lightPsu: true, autoFillersOff: true });
  shelvesAt(st, st.sections[0], [400, 742, 1060, 1380, 1700, 2020], [1]); st.sections[0].shelfLights = [2, 3, 4, 5];
  // 5.4 Стол 1700 × 750 × 600 у окна: опора справа, слева — на стеллаж; 2 ящика под столешницей — подвесные ящики 550 × 150 (приблизительно)
  const desk = pal("desk", 1700, 750, 600, WOOD, WOOD, { autoFillersOff: true }); desk.desk = { ...desk.desk!, sides: "right" };
  // 5.5 Туалетный стол вдоль стены 2-3 (на развёртке столешница 1687 до угла, в разборе Макса его нет): от стола у окна (600) — 1080 × 750 × 450
  const vt = pal("desk", 1080, 750, 450, WOOD, WOOD, { autoFillersOff: true });
  return {
    room: { width: 3055, depth: RD, height: 2714, openings: [] },
    items: [
      { key: "wardrobe", title: "Шкаф 1,8 м, эмаль утопленная филёнка", dims: "1800×2330×500", mods: [put(Z, "wardrobe", c, 0, RD - 500, 0, 180), put(Z, "wardrobe", b, 300, RD - 500, 0, 180), put(Z, "wardrobe", a, 800, RD - 500, 0, 180)] },
      { key: "bedside", title: "Тумбочка подвесная с ящиком", dims: "600×250×400, низ 250", mods: [put(Z, "bedside", bed, 0, RD - 500 - 600, 250, 90)] },
      { key: "shelving", title: "Стеллаж угловой с подсветкой полок", dims: "400×2330×450", mods: [put(Z, "shelving", st, 0, 0)] },
      { key: "desk", title: "Стол у окна (2 ящика под столешницей — НЕ умеем)", dims: "1700×750×600", mods: [put(Z, "desk", desk, 400, 0)] },
      { key: "vanity", title: "Туалетный стол (ящик — НЕ умеем; нет в разборе)", dims: "1080×750×450", mods: [put(Z, "vanity", vt, 0, 620, 0, 90)] },
    ],
  };
}

// ───────────────────────── 6. Ванная (лист 18; потолок 2714, закладная 50) ─────────────────────────
// План: задняя стена — 3-4 (2700: колонна 300 в сечении + тумба 1650 + ванна 750), левая — 2-3 (1775: колонна 550 + шкаф 1225).
function bath(): { room: Project["room"]; items: Item[] } {
  const Z = "bath", TOP = 2664;
  // 6.1 Колонна 550 × 2664 × 300 у угла 3: низ 770 — 2 ящика (эмаль с молдингами), выше — открытые полки 330 с подсветкой стоек + дверь 220
  const low = pal("drawers", 550, 770, 279, CREAM, CREAM, { plinthHeight: 60, vernissage: V(MILL.molding), autoFillersOff: true });
  drawers(low, low.sections[0], 2, true);
  const up = pal("empty", 550, TOP - 770, 279, CREAM, CREAM, { plinthHeight: 0, vernissage: V(MILL.molding), doorOpen: "push", lightPsu: true, autoFillersOff: true });
  up.sections = [{ ...section(), doorLeaves: 1, removedDoors: [0] }, { ...section(), doorLeaves: 1 }];
  up.sections[0].shelves = [0.2, 0.4, 0.6, 0.8]; lights(up.sections[0], { stands: ["left", "right"] }); up.sections[1].shelves = [0.25, 0.5, 0.75];
  // ДОПУЩЕНИЕ: перегородка 330 | 220 — ширины секций по эскизу
  up.sectionLayout = undefined;
  // 6.2 Шкаф над инсталляцией 1225 × 1464 × 250, низ 1200, 3 двери 408, push (ручек на эскизе нет), эмаль с молдингами; навесной
  const cab = pal("empty", 1225, TOP - 1200, 229, CREAM, CREAM, { plinthHeight: 0, hanging: true, vernissage: V(MILL.molding), doorOpen: "push", autoFillersOff: true }, 3);
  // 6.3 Экран инсталляции 1225 × 1150 (с молдингом, под клавишу) — съёмная фасадная панель без петель: НЕ умеем, ЛДСП-панель-заглушка
  const screen = panel(Z, "cabinet", "Экран инсталляции (заглушка ЛДСП вместо МДФ эмаль)", 1225, 1150, CREAM, 213, 50, 550, "yz");
  // 6.4 Тумба подвесная 1650 × 400 × 450, низ 470: 2 корпуса 825 (предел 1300) по 2 ящика push, эмаль рифлёная (мокко), видимый бок у ванны — гладкий
  const vb = () => { const m = pal("hanging-drawer", 825, 400, 431, CREAM, CREAM, { vernissage: V(MILL.fluted, MOCHA), autoFillersOff: true }); drawers(m, m.sections[0], 2, true); return m; };
  const v1 = vb(), v2 = vb(); v2.sidePanels = { right: { height: 400, depth: 431 + 18, facade: true } };
  // столешница белый акриловый камень 40 (на эскизе 30 — у студии акрил 12 или 40) 1650 × 460 над тумбой; раковина накладная — без выреза
  const top = createModule("worktop", 1650, 40, 460, src(CREAM)); setWorktopMaterial(top, "acrylic", 40);
  return {
    room: { width: 2700, depth: 1775, height: 2714, openings: [] },
    items: [
      { key: "column", title: "Колонна: 2 ящика + открытые полки с подсветкой и дверь 220", dims: "550×2664×300", mods: [put(Z, "column", low, 0, 0, 0, 90), put(Z, "column", up, 0, 0, 770, 90)] },
      { key: "cabinet", title: "Шкаф над инсталляцией + экран", dims: "1225×1464×250, низ 1200", mods: [put(Z, "cabinet", cab, 0, 550, 1200, 90), screen] },
      { key: "vanity", title: "Тумба подвесная, эмаль рифлёная, столешница акрил", dims: "1650×430×450, низ 470", mods: [put(Z, "vanity", v1, 300, 0, 470), put(Z, "vanity", v2, 1125, 0, 470), put(Z, "vanity", top, 300, 0, 870)] },
    ],
  };
}

// ───────────────────────── 7. Душевая / санузел (лист 19; потолок 2650) ─────────────────────────
// План: задняя стена — 2-3 (1910 = 250 + 600 + 1060), напротив — 12-1 с тумбой; глубина 1760.
function shower(): { room: Project["room"]; items: Item[] } {
  const Z = "shower", H = 2650, RD = 1760, D = 629; // глубина пеналов 650 = 629 + 2 + 19 (ДОПУЩЕНИЕ: по стиральной машине 600)
  // 7.1 Узкий пенал 250 × 2650 × 650: полки с подсветкой стоек, дверь — стекло в узком алюминиевом профиле (F1-09, золото)
  const nar = pal("empty", 250, H, D, CREAM, CREAM, { plinthHeight: 60, alu: { profile: "F1-09", color: "gold", insert: "glass-clear" }, lightPsu: true, autoFillersOff: true }, 1);
  nar.sections[0].shelves = [1, 2, 3, 4, 5, 6].map((k) => Math.round(k / 7 * 10000) / 10000); lights(nar.sections[0], { stands: ["left", "right"] });
  nar.sections[0].doorSplit = 1300; // алюм. фасад по СТП не выше 2000 → 2 стеклянных фасада 1300 + 1316 (на эскизе одно полотно)
  // 7.2 Пенал под стиральную и сушильную машины 600 × 2650 × 650 (корпус 581 + видимый бок 19): без дна (машины на полу), ниша колонны 1750, жёсткая полка над ней,
  // выше 2 полки; двери в 2 ряда (1750 + верх), эмаль с молдингами; правый бок виден (рядом шкаф 250) — эмаль гладкая
  const wa = pal("empty", 581, H, D, CREAM, CREAM, { plinthHeight: 0, bottomType: "none", vernissage: V(MILL.molding), handleId: HANDLE_LONG, autoFillersOff: true }, 1);
  shelvesAt(wa, wa.sections[0], [1758, 2050, 2350], [0]); wa.sections[0].doorSplit = 1730;
  wa.sections[0].doorHandles = [null, null, "lm86899588"]; // верхняя дверь ~880 короче ручки 1200 — Ritiro 128 матовое золото
  wa.sidePanels = { right: { height: H, depth: D + 18, facade: true } };
  // 7.3 Шкаф над инсталляцией 1060 × 1450 × 250, низ 1200, 2 двери push, эмаль с молдингами; экран 1060 × 1150 — заглушка ЛДСП
  const cab = pal("empty", 1060, H - 1200, 229, CREAM, CREAM, { plinthHeight: 0, hanging: true, vernissage: V(MILL.molding), doorOpen: "push", autoFillersOff: true }, 2);
  const screen = panel(Z, "cabinet", "Экран инсталляции (заглушка ЛДСП вместо МДФ эмаль)", 1060, 1150, CREAM, 850, 50, 213);
  return {
    room: { width: 1910, depth: RD, height: 2714, openings: [] },
    items: [
      { key: "narrow", title: "Узкий пенал, стекло в узком алюм. профиле, подсветка", dims: "250×2650×650", mods: [put(Z, "narrow", nar, 0, 0)] },
      { key: "washer", title: "Пенал под стиральную и сушильную машины", dims: "600×2650×650", mods: [put(Z, "washer", wa, 250, 0)] },
      { key: "cabinet", title: "Шкаф над инсталляцией + экран", dims: "1060×1450×250, низ 1200", mods: [put(Z, "cabinet", cab, 850, 0, 1200), screen] },
      ...showerVanity(Z, RD),
    ],
  };
}
// 8. Тумба в душевой 1000 × 430 × 450 (стена 12-1), низ 470: корпус и фасады «МДФ под дерево» → корпус ЛДСП древесный (ДОПУЩЕНИЕ),
// фасады Вернисаж №15 в плёнке «Дуб Галиано»; 2 ящика push; столешница белый акрил 40.
function showerVanity(Z: string, RD: number): Item[] {
  const v = pal("hanging-drawer", 1000, 400, 431, WOOD, WOOD, { vernissage: { milling: MILL.smooth, cover: "film", film: "Дуб Галиано", thickness: 19 }, autoFillersOff: true });
  drawers(v, v.sections[0], 2, true);
  const top = createModule("worktop", 1000, 40, 460, src(CREAM)); setWorktopMaterial(top, "acrylic", 40);
  return [{ key: "vanity", title: "Тумба под раковину: МДФ под дерево, столешница акрил", dims: "1000×430×450, низ 470", mods: [put(Z, "vanity", v, 455, RD - 450, 470, 180), put(Z, "vanity", top, 455, RD - 460, 870, 180)] }];
}

export const ZONES = { hall: { title: "Прихожая", build: hall }, tv: { title: "ТВ-зона", build: tv }, bedroom: { title: "Спальня (шкаф 2 м)", build: bedroom },
  loggia: { title: "Лоджия", build: loggia }, kids: { title: "Детская (шкаф 1,8 м, рабочая зона)", build: kids }, bath: { title: "Ванная", build: bath },
  shower: { title: "Душевая (санузел)", build: shower } } as const;
export type ZoneId = keyof typeof ZONES;

/** Проект зоны: модули всех изделий, цена по большей модели (решение Макса 26.10). itemOf — ключ изделия по id модуля. */
export function buildZone(z: ZoneId): { project: Project; items: Item[] } {
  seq = 0;
  const { room, items } = ZONES[z].build();
  // «к стене»: набивной задник 3 мм и видимые бока выходят за габарит корпуса — модуль у стены сдвигается внутрь (как поля «От стены» = 0)
  // модуль, поставленный в пределах 30 мм от стены, прижимается к ней габаритом (с задником и фасадами)
  for (const i of items) for (const a of i.mods) {
    if (a.module.raw) continue; // свободные панели — как заданы
    const b = bounds(a);
    if (b.x < 30) a.x -= b.x; else if (b.x + b.w > room.width - 30) a.x -= b.x + b.w - room.width;
    if (b.z < 30) a.z -= b.z; else if (b.z + b.d > room.depth - 30) a.z -= b.z + b.d - room.depth;
    a.x = Math.round(a.x * 10) / 10; a.z = Math.round(a.z * 10) / 10;
  }
  if (process.argv.includes("--bounds")) { const fill = applyAutoFillers({ version: 3, room, modules: items.flatMap((i) => i.mods) } as Project); for (const a of fill.modules) { const b = bounds(a); console.error(`  F ${a.id} x ${b.x}…${b.x + b.w} z ${b.z}…${b.z + b.d} filler ${JSON.stringify(a.module.wallFiller ?? null)} ${a.module.cornerFiller ?? ""} x=${a.x}`); } }
  if (process.argv.includes("--bounds")) for (const i of items) for (const a of i.mods) { const b = bounds(a); console.error(`  ${a.id} x ${b.x}…${b.x + b.w} z ${b.z}…${b.z + b.d} y ${b.y}…${b.y + b.h}`); }
  for (const i of items) for (const a of i.mods) { const e = validate(a.module); if (e.length) console.error(`[${z}] ${a.id} ${a.module.name}: ${e.join(" | ")}`);
    const b = bounds(a); if (b.x < -0.5 || b.z < -0.5 || b.x + b.w > room.width + 0.5 || b.z + b.d > room.depth + 0.5 || b.y + b.h > room.height + 0.5) console.error(`[${z}] ${a.id} вне комнаты: x ${b.x}…${b.x + b.w} z ${b.z}…${b.z + b.d} y ${b.y}…${b.y + b.h}`); }
  const raw: Project = { version: 3, measurement: { number: "dp-2810-" + z, date: "2026-10-28", notes: `Дизайн-проект dp-2810, ${ZONES[z].title}: размеры по развёрткам, допущения — в scripts/dp-2810-rooms.ts.` },
    room, modules: items.flatMap((i) => i.mods), calculation: { markup: MARKUP_DEFAULT, overrides: {}, maxModel: true, sheetPrice: 23000 } };
  return { project: applyAutoFillers(parseProject(JSON.parse(JSON.stringify(raw)))), items };
}
export const itemOf = (id: string) => id.split("-")[1];

if (/dp-2810-rooms\.ts$/.test(process.argv[1] ?? "")) {
  const only = arg("zone", "");
  const report: Record<string, unknown> = {};
  for (const z of Object.keys(ZONES) as ZoneId[]) {
    if (only && only !== z) continue;
    const { project, items } = buildZone(z);
    if (!process.argv.includes("--no-write")) { mkdirSync("public/local-projects", { recursive: true }); writeFileSync(`public/local-projects/dp-2810-${z}.json`, JSON.stringify(project, null, 1)); }
    const sum = (p: Project) => { const e = estimate(p); return { client: e.retail, byMarkup: e.byMarkup, bySheet: e.bySheet, model: e.model, sheets: e.ldspSheets, cost: e.knownCost, vernissageCost: e.vernissageCost, retail: e.retailExtras,
      material: e.split.material, hardware: e.split.hardware, pending: e.lines.filter((l) => l.pending).map((l) => `${l.label} × ${l.quantity}`), missing: e.missing.map((l) => l.label),
      lines: process.argv.includes("--lines") ? e.lines.map((l) => `${l.id} | ${l.label} · ${l.quantity} ${l.unit} × ${l.unitPrice ?? "?"}${l.retail ? " (розница)" : ""}${l.pending ? " (после финального расчёта)" : ""}`) : undefined }; };
    const errors = projectErrors(project);
    const validation = project.modules.flatMap((a) => validate(a.module).map((e) => a.id + " " + a.module.name + ": " + e));
    const collisions = project.modules.flatMap((a) => { try { return partCollisions(parts(a.module), a.module).map((c) => a.id + ": " + c.names.join(" × ")); } catch (e) { return [a.id + ": " + (e as Error).message]; } });
    const warnings = [...roomWarnings(project), ...collisionWarnings(project)].map((w) => (w as { text?: string; message?: string }).text ?? (w as { message?: string }).message ?? JSON.stringify(w));
    const byItem = Object.fromEntries(items.map((i) => [i.key, { title: i.title, dims: i.dims, ...sum({ ...project, modules: project.modules.filter((a) => itemOf(a.id) === i.key) }) }]));
    report[z] = { title: ZONES[z].title, errors, validation, collisions, warnings, zone: sum(project), items: byItem };
    void bounds;
  }
  const outFile = arg("out", "");
  if (outFile) writeFileSync(outFile, JSON.stringify(report, null, 1));
  if (process.argv.includes("--json")) console.log(JSON.stringify(report));
  else for (const [z, r] of Object.entries(report) as [string, { title: string; errors: string[]; validation: string[]; collisions: string[]; warnings: string[]; zone: { client: number | null; sheets: number }; items: Record<string, { title: string; client: number | null; byMarkup: number | null; bySheet: number; sheets: number; cost: number; missing: string[]; pending: string[]; lines?: string[] }> }][]) {
    console.log(`\n=== ${z} · ${r.title}: клиенту ${r.zone.client} · листов ${r.zone.sheets} · ошибки ${r.errors.length} · валидация ${r.validation.length} · пересечения ${r.collisions.length} · замечания ${r.warnings.length}`);
    for (const e of [...r.errors, ...r.validation, ...r.collisions, ...r.warnings].slice(0, 30)) console.log("   ! " + e);
    for (const [k, i] of Object.entries(r.items)) { console.log(`  ${k}: ${i.title} — клиенту ${i.client} (коэф ${i.byMarkup} / лист ${i.bySheet}), листов ${i.sheets}, себест. ${i.cost}${i.missing.length ? " · без цены: " + i.missing.join("; ") : ""}${i.pending.length ? " · после расчёта: " + i.pending.join("; ") : ""}`); if (i.lines) for (const l of i.lines) console.log("      " + l); }
  }
}
