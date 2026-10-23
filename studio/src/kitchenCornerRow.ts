// Угловая кухня (Г) из палитры (задача Макса 23.10.2026 «Как упростить постановку второго крыла?»): ряд у задней стены и ряд
// у левой или правой стены, в углу — «Нижний угловой» (прямой, с фальшпанелью, глухая часть в угол, kitchenCorner.ts).
// Крылья раскладываются как «Кухня прямая» (kitchenRowWidths), столешница — по куску на крыло, навесные — по обоим крыльям.
// Угол — как в эталоне Базиса k27 (m09 «НМУ» 1090 у задней стены, крыло m10/m15 у правой): второе крыло начинается от линии фасадов
// первого (z = 578 — корпус 557 + накладной ХДФ 3 + фасад 18), фасады крыла стоят в плоскости x = стена − 578, дверь углового
// кончается на CORNER_CLEARANCE = 27 мм раньше этой плоскости (k27: дверь до 3178, фасады крыла 3205), остаток до стены — глухая часть
// (фальш углового) и свободный зазор у стены (k27: 110 мм). Угловому и первому модулю крыла автофальши не ставятся — в Базисе
// в этом углу планок нет (студия ничего не добавляет сверх Базиса). Навесного углового в студии нет: угол над нижним угловым на
// глубину навесных свободен (навесные задней стены — до плоскости фасадов навесных крыла, навесные крыла — от линии фасадов
// навесных задней стены), иначе дверь навесного упиралась бы в боковину соседнего крыла.
import { initialModule, section, validate, id, type Module } from "./model";
import { KITCHEN, kitchenBase, kitchenWall, kitchenWorktop, kitchenRowWidths } from "./kitchen";
import { kitchenBaseCorner, cornerDoorDefault } from "./kitchenCorner";
import { refitKDrawers } from "./kitchenDrawers";
import { bounds, applyAutoFillers, projectErrors, type PlacedModule, type Project, type Room } from "./project";

/** Дверь углового кончается за 27 мм до плоскости фасадов второго крыла (эталон k27 m09/m15). */
export const CORNER_CLEARANCE = 27;
/** Ширина нижнего углового по умолчанию: 1000 (дверь 488, глухая часть 512 — как у «НМУ» k27 с фальшем 512). */
export const KITCHEN_CORNER_WIDTH = 1000;
const WALL_OFFSET = 21; // фальш-планка у стены 16 + 5 (KITCHEN_WALL_OFFSET)

export type KitchenCornerRowOptions = {
  /** длина ряда по задней стене от угла, мм (с угловым) */ back: number;
  /** длина ряда по боковой стене от задней стены, мм */ side: number;
  /** у какой стены второе крыло */ wing: "left" | "right";
  room: Pick<Room, "width" | "depth" | "height">;
  height?: number; depth?: number; cornerWidth?: number;
};

type Edge = { x?: number; right?: number; z?: number; front?: number };
/** Поставить модуль так, чтобы его габарит монтажа (bounds) встал на заданные края. */
function at(m: Module, rotation: 0 | 90 | 270, y: number, e: Edge, room: Pick<Room, "width" | "depth">): PlacedModule {
  const a: PlacedModule = { id: id(), x: 0, y, z: 0, rotation, module: m }, b = bounds(a);
  const x = e.x ?? (e.right !== undefined ? room.width - e.right - b.w : b.x), z = e.z ?? (e.front !== undefined ? room.depth - e.front - b.d : b.z);
  a.x += x - b.x; a.z += z - b.z;
  return a;
}

export function createKitchenCornerRow(source: Pick<Module, "decor" | "facadeDecor">, o: KitchenCornerRowOptions): PlacedModule[] {
  const height = o.height ?? KITCHEN.baseHeight, depth = o.depth ?? KITCHEN.baseDepth, R = o.room.width, wing = o.wing;
  if (![o.back, o.side, height, depth].every(Number.isFinite)) throw Error("Угловая кухня: введите длины рядов, высоту и глубину в миллиметрах.");
  const look = (m: Module): Module => ({ ...m, decor: source.decor, facadeDecor: source.facadeDecor });
  const base = (width: number, kind: "doors" | "drawers" | "sink") => { const b = look(kitchenBase(initialModule(), width, kind)); b.height = height; b.depth = depth; b.sections.forEach((s) => (s.shelfDepth = depth - 2.5)); if (b.kdrawers) b.kdrawers = refitKDrawers(b); const e = validate(b)[0]; if (e) throw Error(b.name + ": " + e); return b; };
  // линия фасадов нижних (габарит монтажа от стены): корпус + ХДФ 3 + фасад 18; навесные — по их габариту
  const probe = (m: Module) => bounds({ id: "", x: 0, z: 0, rotation: 0, module: m });
  const Zf = Math.round(probe(base(600, "doors")).d * 10) / 10, wallY = height + KITCHEN.worktopThickness + KITCHEN.wallGap, Dw = probe(look(kitchenWall(initialModule(), 600))).d;
  const Wc = o.cornerWidth ?? KITCHEN_CORNER_WIDTH, door = cornerDoorDefault(Wc), blind = Wc - door;
  // зазор от глухой части до боковой стены: дверь углового кончается за CORNER_CLEARANCE до плоскости фасадов крыла
  const g = Math.max(0, Math.round((Zf + CORNER_CLEARANCE - blind) * 10) / 10);
  const backMax = Math.min(o.back, R - (o.back >= R - WALL_OFFSET + 0.5 ? WALL_OFFSET : 0));
  const Lb = Math.round(backMax - g - Wc), Ls = Math.round(o.side - Zf);
  if (o.back > R) throw Error(`Угловая кухня: ряд по задней стене ${o.back} мм длиннее стены (${R} мм).`);
  if (o.side > o.room.depth) throw Error(`Угловая кухня: ряд по ${wing === "right" ? "правой" : "левой"} стене ${o.side} мм длиннее стены (${o.room.depth} мм).`);
  if (Lb !== 0 && Lb < KITCHEN.minWidth) throw Error(`Угловая кухня: по задней стене нужно не меньше ${Math.round(g + Wc + KITCHEN.minWidth)} мм (угловой ${Wc} + зазор ${g} у стены + модуль от ${KITCHEN.minWidth}).`);
  if (Ls < KITCHEN.minWidth) throw Error(`Угловая кухня: по боковой стене нужно не меньше ${Math.round(Zf + KITCHEN.minWidth)} мм (глубина первого крыла ${Zf} + модуль от ${KITCHEN.minWidth}).`);
  if (Math.max(Lb, Ls) > 6000) throw Error("Угловая кухня: ряд длиннее 6000 мм — разбейте кухню.");
  const room = o.room, out: PlacedModule[] = [];
  // по задней стене координата s — от угла; x диапазона [s0, s1]
  const xOf = (s0: number, s1: number) => (wing === "right" ? R - s1 : s0);
  // нижний угловой: глухая часть — в угол
  const corner = look(kitchenBaseCorner(initialModule(), { width: Wc, side: wing, height, depth }));
  corner.name = `Нижний угловой ${Wc}`; corner.autoFillersOff = true;
  { const e = validate(corner)[0]; if (e) throw Error(corner.name + ": " + e); }
  out.push(at(corner, 0, 0, { x: xOf(g, g + Wc), z: Zf - probe(corner).d }, room));
  // ряд у задней стены (от угла наружу; в порядке слева направо, как «Кухня прямая»)
  const backW = Lb > 0 ? kitchenRowWidths(Lb) : [];
  const hasSink = backW.some((w) => w.kind === "sink");
  let cursor = wing === "right" ? R - g - Wc - Lb : g + Wc; // x левого края ряда
  const backBases: PlacedModule[] = [];
  for (const w of backW) { const m = base(w.width, w.kind); backBases.push(at(m, 0, 0, { x: cursor, z: Zf - probe(m).d }, room)); cursor += w.width; }
  out.push(...backBases);
  // второе крыло: от линии фасадов первого (Zf) до side, фасады — в плоскости стена − Zf
  const rot = wing === "right" ? 270 : 90;
  const wingW = kitchenRowWidths(Ls).map((w) => (hasSink && w.kind === "sink" ? { ...w, kind: "doors" as const } : w));
  let z = Zf;
  const wingBases: PlacedModule[] = [];
  for (const w of wingW) { const m = base(w.width, w.kind); const a = at(m, rot, 0, { z, ...(wing === "right" ? { x: R - Zf } : { x: Zf - bounds({ id: "", x: 0, z: 0, rotation: rot, module: m }).w }) }, room); wingBases.push(a); z += w.width; }
  // первый модуль крыла встаёт торцом к фальшу углового — без планки (как в Базисе)
  if (wingBases[0]) wingBases[0].module.autoFillersOff = true;
  out.push(...wingBases);
  // навесные: над нижними задней стены, над угловым — до плоскости фасадов навесных крыла; на крыле — от линии фасадов навесных задней стены
  const wall = (w: number) => look(kitchenWall(initialModule(), w));
  for (const b of backBases) out.push(at(wall(b.module.width), 0, wallY, { x: bounds(b).x, z: 0 }, room));
  const cornerSpan = Math.round(g + Wc - Dw);
  if (cornerSpan >= KITCHEN.minWidth) out.push(at(wall(cornerSpan), 0, wallY, { x: xOf(Dw, Dw + cornerSpan), z: 0 }, room));
  const extra = Math.round(Zf - Dw), wingWall = wingW.map((w) => w.width);
  if (wingWall.length && wingWall[0] + extra <= 1000) wingWall[0] += extra; else if (extra >= KITCHEN.minWidth) wingWall.unshift(extra);
  let wz = Dw;
  for (const w of wingWall) { out.push(at(wall(w), rot as 90 | 270, wallY, { z: wz, ...(wing === "right" ? { right: 0 } : { x: 0 }) }, room)); wz += w; }
  // столешница: кусок по задней стене до боковой стены (над угловым), кусок по крылу от глубины первого куска
  const wtDepth = depth + KITCHEN.worktopDepth - KITCHEN.baseDepth;
  const top = (w: number) => look({ ...kitchenWorktop(initialModule(), w), depth: wtDepth, name: `Столешница ${w}`, sections: [{ ...section(), shelves: [], drawers: 0, rod: false }] });
  const backStart = wing === "right" ? R - g - Wc - Lb : 0, backEnd = wing === "right" ? R : g + Wc + Lb, backLen = Math.round(backEnd - backStart);
  const pieces = backLen > 4100 ? [Math.round(backLen / 2), backLen - Math.round(backLen / 2)] : [backLen];
  let wx = backStart;
  for (const p of pieces) { out.push(at(top(p), 0, height, { x: wx, z: 0 }, room)); wx += p; }
  const wingLen = Math.round(o.side - wtDepth);
  if (wingLen >= 100) out.push(at(top(wingLen), rot as 90 | 270, height, { z: wtDepth, ...(wing === "right" ? { right: 0 } : { x: 0 }) }, room));
  return out;
}

/** Угловая кухня в комнату: replace — вместо кухонных модулей (шкафы остаются), иначе — в дополнение (угол должен быть свободен).
 *  Проверка — как у любой правки (автофальши + projectErrors); не встаёт — понятная ошибка. */
export function placeKitchenCorner(p: Project, source: Pick<Module, "decor" | "facadeDecor">, o: Omit<KitchenCornerRowOptions, "room">, replace = false): { project: Project; ids: string[] } {
  const group = createKitchenCornerRow(source, { ...o, room: p.room });
  const rest = replace ? p.modules.filter((a) => !a.module.kitchen && !a.module.worktop && !a.module.raw) : p.modules;
  const project = { ...p, modules: [...rest, ...group] };
  const e = projectErrors(applyAutoFillers(project))[0];
  if (e) throw Error(`Угловая кухня не встаёт в угол комнаты: ${e}`);
  return { project, ids: group.map((a) => a.id) };
}
