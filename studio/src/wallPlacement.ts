// Постановка модуля у стены (задача Макса 23.10.2026 «Как упростить постановку второго крыла?», замер тестера кухонь 22.10):
// 1) placeModuleAt — положение X/Y/Z и поворот одним изменением: промежуточные состояния (повёрнут, но ещё не сдвинут) не проверяются,
//    пересечения и границы комнаты — только у итога (тем же projectErrors, что у commitProject);
// 2) placeToWall — «Поставить к стене»: фасадом в комнату, спиной вплотную к стене (габарит монтажа с фальшами), по длине стены —
//    ближайшее свободное место (или от угла — «Продолжить ряд за угол»);
// 3) cornerTurns / continueAroundCorner — крайний модуль ряда: следующий модуль на соседнюю стену сразу за глубиной первого крыла.
// Только логика, без React: панель «Положение» (KitchenPanel) и круговое меню (App) коммитят результат обычным commitProject.
import { applyAutoFillers, bounds, overlap, projectErrors, obstacleBounds, type PlacedModule, type Project } from "./project";
import { id, RULES, type Module } from "./model";
import { rekeySections } from "./sectionLayout";

export type Wall = "back" | "left" | "right" | "front";
/** Поворот модуля фасадом в комнату у стены (roomGeometry.transform: 0 — спиной к задней, 90 — к левой, 270 — к правой, 180 — к передней). */
export const WALL_ROTATION: Record<Wall, 0 | 90 | 180 | 270> = { back: 0, left: 90, right: 270, front: 180 };
export const WALL_LABEL: Record<Wall, string> = { back: "задней", left: "левой", right: "правой", front: "передней" };

export function wallOfRotation(rotation: number | undefined): Wall | null {
  const r = ((Math.round(rotation ?? 0) % 360) + 360) % 360;
  return r === 0 ? "back" : r === 90 ? "left" : r === 270 ? "right" : r === 180 ? "front" : null;
}

/** Цель постановки: отступы габарита монтажа от стен (x — от левой, z — от задней, right/front — от правой/передней), низ от пола, поворот. */
export type PlaceTarget = { x?: number; z?: number; right?: number; front?: number; y?: number; rotation?: number };

const round = (v: number) => Math.round(v * 10) / 10;

/** Поставить модуль по цели одним изменением. Без цели по оси положение по ней сохраняется (при повороте — вокруг центра,
 *  в пределах комнаты). Автофальши пересчитываются, введённое число — итоговый отступ габарита. Ошибка — только по итогу. */
export function placeModuleAt(p: Project, mid: string, t: PlaceTarget): Project {
  let n = structuredClone(p);
  const a = n.modules.find((x) => x.id === mid);
  if (!a) throw Error("Корпус не найден.");
  for (const v of [t.x, t.z, t.right, t.front, t.y, t.rotation]) if (v !== undefined && (!Number.isFinite(v) || (v !== t.rotation && v < 0))) throw Error("Укажите неотрицательные отступы от стен и пола.");
  const room = n.room;
  if (t.rotation !== undefined && t.rotation !== (a.rotation ?? 0)) {
    const before = bounds(a);
    a.rotation = t.rotation;
    const after = bounds(a);
    if (after.w > room.width + 0.1 || after.d > room.depth + 0.1) throw Error("В этом направлении корпус не помещается в комнате.");
    // поворот вокруг центра; ось без цели — в пределах комнаты (как rotateModule)
    const cx = before.x + (before.w - after.w) / 2, cz = before.z + (before.d - after.d) / 2;
    a.x += (t.x === undefined && t.right === undefined ? Math.max(0, Math.min(room.width - after.w, cx)) : cx) - after.x;
    a.z += (t.z === undefined && t.front === undefined ? Math.max(0, Math.min(room.depth - after.d, cz)) : cz) - after.z;
  }
  const wantX = (b: ReturnType<typeof bounds>) => (t.x !== undefined ? t.x : t.right !== undefined ? room.width - t.right - b.w : undefined);
  const wantZ = (b: ReturnType<typeof bounds>) => (t.z !== undefined ? t.z : t.front !== undefined ? room.depth - t.front - b.d : undefined);
  if (t.y !== undefined) a.y = t.y;
  // сначала — сразу на итоговое место (без автофальшей): промежуточное положение (повёрнут на месте, ещё у соседей) не должно
  // ставить соседям угловые планки и сдвигать их — сдвиг потом не возвращается
  { const b = bounds(a), tx = wantX(b), tz = wantZ(b); if (tx !== undefined) a.x += tx - b.x; if (tz !== undefined) a.z += tz - b.z; }
  // автофальши меняют габарит у стен и в углах — несколько поправок до итогового отступа (как setWallDistance)
  let ok = false;
  for (let i = 0; i < 8; i++) {
    n = applyAutoFillers(n);
    const cur = n.modules.find((x) => x.id === mid)!, b = bounds(cur), tx = wantX(b), tz = wantZ(b);
    const dx = tx === undefined ? 0 : tx - b.x, dz = tz === undefined ? 0 : tz - b.z;
    if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) { ok = true; break; }
    cur.x += dx; cur.z += dz;
  }
  if (!ok) throw Error("Это положение меняет состав угловых фальшей. Задайте другой отступ или отключите автофальши у выбранного корпуса и настройте стык отдельно.");
  const error = projectErrors(n)[0];
  if (error) throw Error(error);
  return n;
}

/** Отступ габарита модуля от каждой стены (для панели и подсказок). */
export function wallDistances(p: Project, a: PlacedModule) {
  const b = bounds(a);
  return { x: round(b.x), z: round(b.z), right: round(p.room.width - b.x - b.w), front: round(p.room.depth - b.z - b.d), y: round(a.y ?? 0) };
}

/** order: 'nearest' — ближе к текущему положению; 'from-start' / 'from-end' — от начала / конца стены (угол). */
export type AlongOrder = "nearest" | "from-start" | "from-end";

/** «Поставить к стене»: фасадом в комнату, спиной вплотную к стене, по длине — первое свободное место в порядке order.
 *  Проверка — та же, что у любой правки (автофальши + projectErrors); места нет — понятная ошибка. */
export function placeToWall(p: Project, mid: string, wall: Wall, order: AlongOrder = "nearest"): Project {
  const a = p.modules.find((x) => x.id === mid);
  if (!a) throw Error("Корпус не найден.");
  const rotation = WALL_ROTATION[wall], along: "x" | "z" = wall === "back" || wall === "front" ? "x" : "z";
  const size = (b: ReturnType<typeof bounds>) => (along === "x" ? b.w : b.d);
  const L = along === "x" ? p.room.width : p.room.depth;
  const turned = { ...a, rotation }, tb = bounds({ ...turned, x: 0, z: 0 }), w = size(tb);
  if (w > L + 0.1) throw Error(`«${a.module.name}» (${Math.round(w)} мм) длиннее ${WALL_LABEL[wall]} стены (${L} мм).`);
  const across: PlaceTarget = wall === "back" ? { z: 0 } : wall === "front" ? { front: 0 } : wall === "left" ? { x: 0 } : { right: 0 };
  const cur = bounds(a)[along];
  // занятые места — как их поставит сохранение (автофальши), без самого модуля; сырые модули Базиса пересечения не проверяют
  const others = applyAutoFillers({ ...p, modules: p.modules.filter((x) => x.id !== mid) }).modules;
  const occupied = [...others.filter((x) => !x.module.raw).map(bounds), ...(p.room.obstacles ?? []).map(obstacleBounds)];
  // у конца стены — и с фальшем к стене (16 + 4 = 20, решение 29.10): габарит с ним длиннее, иначе «от конца стены» уходил на первое свободное место у начала (волна 29.10)
  const wf = RULES.panel + RULES.wallFillerEdgeGap;
  const raw = [cur, 0, L - w, L - w - wf, ...occupied.flatMap((b) => { const s = b[along], e = s + size(b); return [e, s - w, e + 16, s - w - 16, e + wf, s - w - wf]; })];
  const xs = [...new Set(raw.map((v) => Math.round(Math.max(0, Math.min(L - w, v)) * 10) / 10))];
  xs.sort(order === "from-start" ? (u, v) => u - v : order === "from-end" ? (u, v) => v - u : (u, v) => Math.abs(u - cur) - Math.abs(v - cur) || u - v);
  // дешёвая проверка габарита по стене (поворот и спина к стене), затем полная — placeModuleAt
  const y = a.y ?? 0, h = a.module.height;
  let last = "", tried = 0;
  for (const s of xs) {
    const box = { ...tb, y, h, x: along === "x" ? s : wall === "left" ? 0 : p.room.width - tb.w, z: along === "z" ? s : wall === "back" ? 0 : p.room.depth - tb.d };
    if (occupied.some((o) => overlap(box, o))) continue;
    try { return placeModuleAt(p, mid, { ...across, [along]: s, rotation }); } catch (e) { last = (e as Error).message; }
    if (++tried >= 12) break;
  }
  throw Error(`У ${WALL_LABEL[wall]} стены нет свободного места для «${a.module.name}» (${Math.round(w)} мм)${last ? `: ${last}` : ""}. Освободите место у стены или уменьшите модуль.`);
}

/** Ряд модуля: модули того же поворота у той же стены (спина в пределах 150 мм от линии ряда) и того же уровня (пересечение по высоте). */
export function rowOf(p: Project, mid: string): PlacedModule[] {
  const a = p.modules.find((x) => x.id === mid);
  const wall = a ? wallOfRotation(a.rotation) : null;
  if (!a || !wall || a.module.worktop) return [];
  const back = (x: PlacedModule) => { const b = bounds(x); return wall === "back" ? b.z : wall === "front" ? p.room.depth - b.z - b.d : wall === "left" ? b.x : p.room.width - b.x - b.w; };
  const y0 = a.y ?? 0, y1 = y0 + a.module.height, line = back(a);
  return p.modules.filter((x) => !x.module.worktop && wallOfRotation(x.rotation) === wall && Math.abs(back(x) - line) <= 150 && (x.y ?? 0) < y1 - 1 && (x.y ?? 0) + x.module.height > y0 + 1);
}

export type CornerTurn = { wall: Wall; order: AlongOrder; label: string };
/** Куда продолжается ряд за угол от модуля mid, если он крайний в своём ряду: ряд у задней стены — на левую/правую стену от угла,
 *  ряд у боковой — на заднюю (или переднюю). Пусто — модуль не крайний или ряд не у стены. */
export function cornerTurns(p: Project, mid: string): CornerTurn[] {
  const a = p.modules.find((x) => x.id === mid), row = rowOf(p, mid);
  const wall = a ? wallOfRotation(a.rotation) : null;
  if (!a || !wall || !row.length) return [];
  const along: "x" | "z" = wall === "back" || wall === "front" ? "x" : "z";
  const s = (x: PlacedModule) => bounds(x)[along], e = (x: PlacedModule) => { const b = bounds(x); return b[along] + (along === "x" ? b.w : b.d); };
  const first = Math.min(...row.map(s)) >= s(a) - 0.5, last = Math.max(...row.map(e)) <= e(a) + 0.5;
  const out: CornerTurn[] = [];
  const turn = (next: Wall, order: AlongOrder) => out.push({ wall: next, order, label: `на ${WALL_LABEL[next]} стене от угла` });
  if (wall === "back") { if (first) turn("left", "from-start"); if (last) turn("right", "from-start"); }
  else if (wall === "front") { if (first) turn("left", "from-end"); if (last) turn("right", "from-end"); }
  else { const near = wall === "right" ? "from-end" : "from-start"; if (first) turn("back", near); if (last) turn("front", near); }
  return out;
}

/** Продолжить ряд за угол: модуль source (новый — копия, или уже стоящий — по id) ставится на соседнюю стену от угла:
 *  сразу за глубиной первого крыла (его габарит с фасадами — занятое место), фасадом в комнату. */
export function continueAroundCorner(p: Project, turn: CornerTurn, source: { id: string } | { module: Module; y?: number }): { project: Project; id: string } {
  let base = p, mid: string;
  if ("id" in source) mid = source.id;
  else {
    const module = structuredClone(source.module);
    rekeySections(module, id);
    const a: PlacedModule = { id: id(), x: 0, y: source.y ?? 0, z: 0, rotation: WALL_ROTATION[turn.wall], module };
    // вне комнаты не ставим: временно в начало стены, placeToWall найдёт место (проверка итога — там же)
    base = { ...p, modules: [...p.modules, a] };
    mid = a.id;
  }
  return { project: placeToWall(base, mid, turn.wall, turn.order), id: mid };
}
