// Угловая кухня (Г) и П-образная кухня из палитры (задача Макса 23.10.2026 «Как упростить постановку второго крыла?»; решения Макса
// 23.10: угол — с планкой, «наша версия»; навесной угловой прямой нужен — Г- и П-образные кухни популярны).
// Ряд у задней стены и ряды у левой и/или правой стены. В каждом углу — «Нижний угловой» (прямой, с фальшпанелью, глухая часть в угол)
// и над ним «Навесной угловой» (прямой: фальш ЛДСП + планка из фасада, kitchenCorner.ts). Ряды раскладываются как «Кухня прямая»
// (kitchenRowWidths), мойка одна, столешница — кусок на каждый ряд, навесные — по всем рядам.
// Угол (эталон Базиса k27: m09 «НМУ» 1090 у задней стены, крыло m10/m15 у правой; правило угла студии): второе крыло начинается от линии
// фасадов первого (корпус 557 + накладной ХДФ 3 + фасад 18 = 578), у первого модуля крыла — угловая планка 16 глубиной корпус + 40
// (applyAutoFillers, наша версия), модули крыла — за ней. Дверь нижнего углового кончается на CORNER_CLEARANCE = 27 мм раньше лица
// планки крыла (k27: 27 мм до фасадов крыла), остаток до стены — глухая часть (фальш углового) и зазор у стены. Навесной угловой — от
// углового нижнего до боковой стены, его глухая часть (фальш ЛДСП на глубину корпуса крыла + планка 59) — напротив навесных крыла;
// навесные крыла — за его линией фасадов, первый — с угловой планкой. Угловым модулям автофальши не ставятся: их глухая часть и есть фальш.
import { initialModule, section, validate, id, RULES, type Module } from "./model";
import { KITCHEN, kitchenBase, kitchenWall, kitchenWorktop, kitchenRowWidths } from "./kitchen";
import { kitchenBaseCorner, kitchenWallCorner, cornerDoorDefault } from "./kitchenCorner";
import { refitKDrawers } from "./kitchenDrawers";
import { bounds, localToRoom, applyAutoFillers, projectErrors, type PlacedModule, type Project, type Room } from "./project";

/** Дверь нижнего углового кончается за 27 мм до лица крыла (эталон k27 m09/m15: до фасадов крыла; у студии — до лица угловой планки). */
export const CORNER_CLEARANCE = 27;
/** Ширина нижнего углового по умолчанию: 1000 (дверь 488, глухая часть 512 — как у «НМУ» k27 с фальшем 512). */
export const KITCHEN_CORNER_WIDTH = 1000;
const WALL_OFFSET = 21; // фальш-планка у стены 16 + 5 (KITCHEN_WALL_OFFSET)
const PLANK = RULES.panel; // угловая планка крыла (applyAutoFillers, правило угла)

export type Wing = "left" | "right";
export type KitchenCornerRowOptions = {
  /** длина ряда по задней стене от угла, мм (с угловым) */ back: number;
  /** длина ряда по боковой стене от задней стены, мм */ side: number;
  /** у какой стены второе крыло */ wing: Wing;
  room: Pick<Room, "width" | "depth" | "height">;
  height?: number; depth?: number; cornerWidth?: number;
};
export type KitchenURowOptions = { left: number; back: number; right: number; room: Pick<Room, "width" | "depth" | "height">; height?: number; depth?: number; cornerWidth?: number };

type Edge = { x?: number; right?: number; z?: number; front?: number };
/** Поставить модуль так, чтобы его габарит монтажа без угловой планки встал на заданные края. */
function at(m: Module, rotation: 0 | 90 | 270, y: number, e: Edge, room: Pick<Room, "width" | "depth">): PlacedModule {
  const a: PlacedModule = { id: id(), x: 0, y, z: 0, rotation, module: m }, b = bounds(a);
  const x = e.x ?? (e.right !== undefined ? room.width - e.right - b.w : b.x), z = e.z ?? (e.front !== undefined ? room.depth - e.front - b.d : b.z);
  a.x += x - b.x; a.z += z - b.z;
  return a;
}
/** Корпус вдоль стены: s — начало корпуса по длине стены (x у задней, z у боковых), back — зазор от стены до задней кромки корпуса
 *  (нижние — 3, как «Кухня прямая»: линия фасадов одна у модулей с любым задником и у ящиков Axis, чьи фасады габарит не учитывает). */
function put(m: Module, rot: 0 | 90 | 270, y: number, s: number, back: number, R: number): PlacedModule {
  const d = m.depth;
  return rot === 0 ? { id: id(), x: s, y, z: back, rotation: 0, module: m } : { id: id(), x: rot === 270 ? R - back - d : back, y, z: s, rotation: rot, module: m };
}
/** Угловая планка у первого модуля крыла — с той стороны, что смотрит на заднюю стену (как поставит applyAutoFillers, без сдвига). */
function plankToBack(a: PlacedModule) {
  const s = localToRoom(a, 0, 0).z < localToRoom(a, a.module.width, 0).z ? "left" : "right";
  a.module.cornerFiller = s; a.module.cornerKind = "plank";
}

function layout(source: Pick<Module, "decor" | "facadeDecor">, o: { back: number; wings: Partial<Record<Wing, number>>; room: Pick<Room, "width" | "depth" | "height">; height?: number; depth?: number; cornerWidth?: number }): PlacedModule[] {
  const height = o.height ?? KITCHEN.baseHeight, depth = o.depth ?? KITCHEN.baseDepth, R = o.room.width, room = o.room;
  const wings = (["left", "right"] as Wing[]).filter((w) => o.wings[w] !== undefined);
  if (![o.back, height, depth, ...wings.map((w) => o.wings[w]!)].every(Number.isFinite)) throw Error("Угловая кухня: введите длины рядов, высоту и глубину в миллиметрах.");
  if (o.back > R + 0.1) throw Error(`Угловая кухня: ряд по задней стене ${o.back} мм длиннее стены (${R} мм).`);
  for (const w of wings) if (o.wings[w]! > room.depth + 0.1) throw Error(`Угловая кухня: ряд по ${w === "right" ? "правой" : "левой"} стене ${o.wings[w]} мм длиннее стены (${room.depth} мм).`);
  const look = (m: Module): Module => ({ ...m, decor: source.decor, facadeDecor: source.facadeDecor });
  const check = (m: Module) => { const e = validate(m)[0]; if (e) throw Error(m.name + ": " + e); return m; };
  const base = (width: number, kind: "doors" | "drawers" | "sink") => { const b = look(kitchenBase(initialModule(), width, kind)); b.height = height; b.depth = depth; b.sections.forEach((s) => (s.shelfDepth = depth - 2.5)); if (b.kdrawers) b.kdrawers = refitKDrawers(b); return check(b); };
  const wall = (w: number) => check(look(kitchenWall(initialModule(), w)));
  const probe = (m: Module) => bounds({ id: "", x: 0, z: 0, rotation: 0, module: m });
  // линия фасадов нижних и навесных (габарит монтажа от стены); лицо угловой планки крыла — корпус + ХДФ + 40
  const rear = 3, Zf = rear + depth + 18;
  const plankFace = rear + depth + RULES.cornerFillerExtra;
  const wallY = height + KITCHEN.worktopThickness + KITCHEN.wallGap, Dw = probe(wall(600)).d;
  const Wc = o.cornerWidth ?? KITCHEN_CORNER_WIDTH, blind = Wc - cornerDoorDefault(Wc);
  // зазор от глухой части до боковой стены: дверь углового кончается за CORNER_CLEARANCE до лица планки крыла
  const g = Math.max(0, Math.round((plankFace + CORNER_CLEARANCE - blind) * 10) / 10);
  const has = (w: Wing) => wings.includes(w);
  // ряд у задней стены: от угла(ов) до конца ряда; у свободного конца у стены — место под фальш-планку 21
  const start = has("left") ? g + Wc : Math.max(has("right") ? R - o.back : 0, WALL_OFFSET);
  const end = has("right") ? R - g - Wc : Math.min(has("left") ? o.back : R, R - WALL_OFFSET);
  const Lb = Math.round(end - start);
  if (Lb !== 0 && Lb < KITCHEN.minWidth) throw Error(`Угловая кухня: по задней стене между угловыми и до конца ряда остаётся ${Math.max(0, Lb)} мм — нужно 0 или от ${KITCHEN.minWidth} (угловой ${Wc} + зазор ${g} у стены).`);
  if (Lb > 6000) throw Error("Угловая кухня: ряд длиннее 6000 мм — разбейте кухню.");
  const out: PlacedModule[] = [];
  // нижние угловые: глухая часть — в угол
  for (const w of wings) {
    const c = look(kitchenBaseCorner(initialModule(), { width: Wc, side: w, height, depth }));
    c.name = `Нижний угловой ${Wc}`; c.autoFillersOff = true; check(c);
    out.push(put(c, 0, 0, w === "right" ? R - g - Wc : g, rear, R));
  }
  const backW = Lb > 0 ? kitchenRowWidths(Lb) : [];
  let sink = backW.some((w) => w.kind === "sink"), cursor = start;
  const backBases: PlacedModule[] = [];
  for (const w of backW) { const m = base(w.width, w.kind); backBases.push(put(m, 0, 0, cursor, rear, R)); cursor += w.width; }
  out.push(...backBases);
  // навесные задней стены — над нижними; над угловыми — навесной угловой от углового нижнего до боковой стены
  for (const b of backBases) out.push(put(wall(b.module.width), 0, wallY, b.x, 0, R));
  for (const w of wings) {
    const cw = check(look(kitchenWallCorner(initialModule(), { width: Math.round(g + Wc), side: w })));
    cw.name = `Навесной угловой ${Math.round(g + Wc)}`; cw.autoFillersOff = true;
    out.push(at(cw, 0, wallY, { x: w === "right" ? R - g - Wc : 0, z: 0 }, room));
  }
  // крылья: нижние от линии фасадов задней стены + планка, навесные — от линии навесных + планка; первый модуль — с планкой
  for (const w of wings) {
    const rot = w === "right" ? 270 : 90, len = o.wings[w]!, Ls = Math.round(len - Zf - PLANK);
    if (Ls < KITCHEN.minWidth) throw Error(`Угловая кухня: по ${w === "right" ? "правой" : "левой"} стене нужно не меньше ${Math.round(Zf + PLANK + KITCHEN.minWidth)} мм (глубина ряда ${Zf} + планка ${PLANK} + модуль от ${KITCHEN.minWidth}).`);
    if (Ls > 6000) throw Error("Угловая кухня: ряд длиннее 6000 мм — разбейте кухню.");
    const wingW = kitchenRowWidths(Ls).map((x) => (sink && x.kind === "sink" ? { ...x, kind: "doors" as const } : x));
    if (wingW.some((x) => x.kind === "sink")) sink = true;
    let z = Zf + PLANK;
    wingW.forEach((x, i) => { const a = put(base(x.width, x.kind), rot, 0, z, rear, R); if (i === 0) plankToBack(a); out.push(a); z += x.width; });
    const extra = Math.round(Zf - Dw), wingWall = wingW.map((x) => x.width);
    if (wingWall.length && wingWall[0] + extra <= 1000) wingWall[0] += extra; else if (extra >= KITCHEN.minWidth) wingWall.unshift(extra);
    let wz = Dw + PLANK;
    wingWall.forEach((x, i) => { const a = put(wall(x), rot, wallY, wz, 0, R); if (i === 0) plankToBack(a); out.push(a); wz += x; });
  }
  // столешница: кусок по задней стене (над угловыми — до боковых стен), кусок на каждое крыло от глубины заднего куска
  const wtDepth = depth + KITCHEN.worktopDepth - KITCHEN.baseDepth;
  const top = (w: number) => check(look({ ...kitchenWorktop(initialModule(), w), depth: wtDepth, name: `Столешница ${w}`, sections: [{ ...section(), shelves: [], drawers: 0, rod: false }] }));
  const backStart = has("left") ? 0 : start, backEnd = has("right") ? R : end, backLen = Math.round(backEnd - backStart);
  const pieces = backLen > 4100 ? [Math.round(backLen / 2), backLen - Math.round(backLen / 2)] : [backLen];
  let wx = backStart;
  for (const p of pieces) { out.push(at(top(p), 0, height, { x: wx, z: 0 }, room)); wx += p; }
  for (const w of wings) {
    const wingLen = Math.round(o.wings[w]! - wtDepth);
    if (wingLen >= 100) out.push(at(top(wingLen), w === "right" ? 270 : 90, height, { z: wtDepth, ...(w === "right" ? { right: 0 } : { x: 0 }) }, room));
  }
  return out;
}

export function createKitchenCornerRow(source: Pick<Module, "decor" | "facadeDecor">, o: KitchenCornerRowOptions): PlacedModule[] {
  return layout(source, { back: o.back, wings: { [o.wing]: o.side }, room: o.room, height: o.height, depth: o.depth, cornerWidth: o.cornerWidth });
}
/** П-образная кухня: левая + задняя + правая стены, два нижних и два навесных угловых, столешница тремя кусками. Задняя — во всю ширину комнаты. */
export function createKitchenURow(source: Pick<Module, "decor" | "facadeDecor">, o: KitchenURowOptions): PlacedModule[] {
  if (Math.abs(o.back - o.room.width) > 0.5) throw Error(`П-образная кухня встаёт между боковыми стенами: длина по задней стене — ширина комнаты (${o.room.width} мм). Измените длину или ширину комнаты.`);
  return layout(source, { back: o.back, wings: { left: o.left, right: o.right }, room: o.room, height: o.height, depth: o.depth, cornerWidth: o.cornerWidth });
}

/** Угловая (или П-образная) кухня в комнату: replace — вместо кухонных модулей (шкафы остаются), иначе — в дополнение (угол должен быть
 *  свободен). Проверка — как у любой правки (автофальши + projectErrors); не встаёт — понятная ошибка. */
export function placeKitchenCorner(p: Project, source: Pick<Module, "decor" | "facadeDecor">, o: Omit<KitchenCornerRowOptions, "room"> | (Omit<KitchenURowOptions, "room"> & { u: true }), replace = false): { project: Project; ids: string[] } {
  const group = "u" in o ? createKitchenURow(source, { ...o, room: p.room }) : createKitchenCornerRow(source, { ...o, room: p.room });
  const rest = replace ? p.modules.filter((a) => !a.module.kitchen && !a.module.worktop && !a.module.raw) : p.modules;
  const project = { ...p, modules: [...rest, ...group] };
  const e = projectErrors(applyAutoFillers(project))[0];
  if (e) throw Error(`${"u" in o ? "П-образная" : "Угловая"} кухня не встаёт в угол комнаты: ${e}`);
  return { project, ids: group.map((a) => a.id) };
}
