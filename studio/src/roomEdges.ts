// Стены контура помещения для 3D, правил и привязок (задача Макса 30.10.2026: «не все помещения ровные — 5-угольные, со скосом,
// со скруглениями»). Только чистая геометрия без three и React — проверяется tests/room-outline-3d.test.ts. Контур и его помощники —
// roomOutline.ts; здесь — как на стену контура садятся проёмы и объекты, из чего строятся стены и зоны у стен.
// Комната без контура в эти функции по смыслу не заходит: её стены и проёмы — по-старому (wall + offset), чтобы прямоугольник
// считался и рисовался байт в байт как раньше.
import type { Opening, Room } from "./project";
import { edgeArc, edgeLength, edgePoint, edgeTangent, flatten, inwardNormal, legacyToEdge, pointInOutline, projectToEdges, rectOutline, type P2, type RectWall, type RoomOutline } from "./roomOutline";

const r1 = (v: number) => { const r = Math.round(v * 10) / 10; return r === 0 ? 0 : r; };
/** Что стоит на стене: проём или объект замера (у обоих старая стена wall, номер стены контура edge, отступ и ширина вдоль стены). */
export type OnWall = { wall: Opening["wall"]; edge?: number; offset: number; width: number };
/** Стена контура и место на ней: offset — от начала стены по её длине; dir — как старый отсчёт (слева направо / от задней стены)
 *  идёт вдоль этой стены (1) или навстречу (−1) — нужен для старых отступов подоконника и т. п. у проёма без edge. */
export type EdgeSpot = { edge: number; offset: number; dir: 1 | -1 };

/** Центр старого проёма на габаритном прямоугольнике (стена wall, отступ по старым правилам). */
function legacyCenter(room: Pick<Room, "width" | "depth">, o: OnWall): P2 {
  const c = o.offset + o.width / 2;
  return o.wall === "back" ? { x: c, z: 0 } : o.wall === "front" ? { x: c, z: room.depth } : o.wall === "left" ? { x: 0, z: c } : { x: room.width, z: c };
}
/** Стена контура проёма/объекта. С контуром: своя edge, а без неё — ближайшая к старому положению на габарите (проёмы, заведённые
 *  до контура, не теряются). Без контура — прямоугольник: legacyToEdge (передняя и левая идут по обходу навстречу старому отсчёту). */
export function openingEdge(room: Pick<Room, "width" | "depth" | "outline">, o: OnWall): EdgeSpot {
  if (!room.outline) { const e = legacyToEdge(room.width, room.depth, o.wall, o.offset, o.width); return { ...e, dir: o.wall === "front" || o.wall === "left" ? -1 : 1 }; }
  const ol = room.outline;
  if (o.edge !== undefined) return { edge: o.edge, offset: o.offset, dir: 1 };
  // критик 30.10: стена той же стороны (окно передней стены Г-комнаты — на переднюю, не на правую стенку выреза); из них — та, что
  // проходит над тем же местом вдоль старой стены (меньше сдвиг вдоль), затем ближайшая; стен этой стороны нет — просто ближайшая
  const c = legacyCenter(room, o), alongX = o.wall === "back" || o.wall === "front", sides = ol.map((_, i) => i).filter((i) => edgeLegacyWall(ol, i) === o.wall);
  let p = projectToEdges(ol, c);
  if (sides.length) {
    let best = Infinity;
    for (const i of sides) { const q = projectToEdges(ol, c, (j) => j === i), at = edgePoint(ol, i, q.s), slide = Math.round(Math.abs(alongX ? at.x - c.x : at.z - c.z)), key = slide * 1e6 + q.dist; if (key < best) { best = key; p = q; } }
  }
  const L = edgeLength(ol, p.edge), t = edgeTangent(ol, p.edge, p.s).t;
  const axis = o.wall === "back" || o.wall === "front" ? t.x : t.z;
  return { edge: p.edge, offset: r1(Math.max(0, Math.min(L - o.width, p.s - o.width / 2))), dir: axis < 0 ? -1 : 1 };
}
/** «Вправо» проёма в комнате (критик 30.10): куда растёт его отступ — на этом конце правая петля, туда отсчитан подоконник.
 *  Прямоугольник — старые оси (+x у задней/передней, +z у боковых); проём со своей стеной контура — по обходу этой стены (её начало
 *  слева, если смотреть из комнаты на стену); старый проём в комнате с контуром — старая ось, уложенная на его стену (dir). */
export function itemAlong(room: Pick<Room, "width" | "depth" | "outline">, o: OnWall): P2 {
  if (!room.outline) return o.wall === "back" || o.wall === "front" ? { x: 1, z: 0 } : { x: 0, z: 1 };
  const e = openingEdge(room, o), t = edgeTangent(room.outline, e.edge, e.offset + o.width / 2).t;
  return { x: t.x * e.dir, z: t.z * e.dir };
}
type Handed = OnWall & { hinge?: "left" | "right"; windowSill?: { width: number; offset: number } };
/** Проём переехал (правка контура, выгрузка в Базис): петля и подоконник — на том же месте комнаты (критик 30.10). Ось «вправо»
 *  развернулась — петля меняет сторону, сдвиг подоконника от середины проёма — знак (project: умножить на проекцию осей — когда
 *  стену кладём на сторону габарита). */
export function keepHanded<T extends OnWall>(before: T, roomBefore: Pick<Room, "width" | "depth" | "outline">, after: T, roomAfter: Pick<Room, "width" | "depth" | "outline">, project = false): T {
  const b = before as T & Handed;
  if (b.hinge === undefined && !b.windowSill) return after;
  const a0 = itemAlong(roomBefore, before), a1 = itemAlong(roomAfter, after), k = a0.x * a1.x + a0.z * a1.z, flip = k < 0, out = { ...after } as T & Handed;
  if (b.hinge !== undefined) out.hinge = flip ? (b.hinge === "right" ? "left" : "right") : b.hinge;
  if (b.windowSill) {
    const s = b.windowSill, shift = (s.offset + s.width / 2 - (b.offset + b.width / 2)) * (project ? k : flip ? -1 : 1);
    out.windowSill = { ...s, offset: r1(Math.max(0, after.offset + after.width / 2 + shift - s.width / 2)) };
  }
  return out;
}
/** Середина подоконника на плане (стена контура или прямоугольника): как рисует сцена. */
export function sillCenter(room: Pick<Room, "width" | "depth" | "outline">, o: OnWall & { windowSill: { width: number; offset: number } }): P2 {
  const e = openingEdge(room, o), w = o.windowSill, ol = room.outline ?? rectOutline(room.width, room.depth);
  return edgePoint(ol, e.edge, e.offset + o.width / 2 + e.dir * (w.offset + w.width / 2 - o.offset - o.width / 2));
}
/** Сторона габарита, к которой обращена стена контура (по внешней нормали хорды): для отделки стен по старым именам и для
 *  выгрузки в Базис. Скос 45° — к задней/передней. */
export function edgeLegacyWall(o: RoomOutline, i: number): RectWall {
  const a = o[i], b = o[(i + 1) % o.length], n = inwardNormal(a, b);
  return Math.abs(n.z) >= Math.abs(n.x) ? (n.z > 0 ? "back" : "front") : n.x < 0 ? "right" : "left";
}
/** Точка стены i в s мм от её начала, касательная по обходу и нормаль внутрь комнаты. */
export function wallSpot(o: RoomOutline, i: number, s: number): { p: P2; t: P2; n: P2 } {
  const p = edgePoint(o, i, s), { t, n } = edgeTangent(o, i, s);
  return { p, t, n };
}
/** Отметки s вдоль стены от s0 до s1: прямая — два конца, дуга — шагом не больше step мм. */
export function edgeStations(o: RoomOutline, i: number, s0: number, s1: number, step = 150): number[] {
  const a = o[i], b = o[(i + 1) % o.length];
  if (!edgeArc(a, b, a.bulge ?? 0) || s1 - s0 < 1e-6) return [s0, s1];
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  return Array.from({ length: n + 1 }, (_, k) => s0 + ((s1 - s0) * k) / n);
}

/** Куски стены между проёмами (как roomGeometry.wallPanels, но по стенам контура): s0..s1 вдоль стены, y0..y1 по высоте. */
export type EdgePanel = { edge: number; s0: number; s1: number; y0: number; y1: number };
export function edgePanels(room: Room & { outline: RoomOutline }): EdgePanel[] {
  const o = room.outline, out: EdgePanel[] = [], spots = (room.openings ?? []).map((q) => ({ q, e: openingEdge(room, q) }));
  o.forEach((_, edge) => {
    const L = edgeLength(o, edge), os = spots.filter((x) => x.e.edge === edge).map((x) => ({ s0: x.e.offset, s1: x.e.offset + x.q.width, y0: x.q.sill, y1: x.q.sill + x.q.height }));
    const xs = [...new Set([0, L, ...os.flatMap((q) => [q.s0, q.s1]).filter((v) => v > 0 && v < L)])].sort((a, b) => a - b);
    const ys = [...new Set([0, room.height, ...os.flatMap((q) => [q.y0, q.y1])])].sort((a, b) => a - b);
    for (let x = 1; x < xs.length; x++) for (let y = 1; y < ys.length; y++) {
      const u = (xs[x - 1] + xs[x]) / 2, v = (ys[y - 1] + ys[y]) / 2;
      if (!os.some((q) => u > q.s0 && u < q.s1 && v > q.y0 && v < q.y1)) out.push({ edge, s0: xs[x - 1], s1: xs[x], y0: ys[y - 1], y1: ys[y] });
    }
  });
  return out;
}
/** Тело куска стены толщиной depth наружу от внутренней поверхности: треугольники (x, y, z подряд) — внутренняя и наружная грани,
 *  верх, низ и торцы; обход каждого треугольника — лицом наружу из тела (односторонний материал, как у BoxGeometry). Дуга — ломаной. */
export function wallPrism(o: RoomOutline, p: EdgePanel, depth: number): number[] {
  const st = edgeStations(o, p.edge, p.s0, p.s1).map((s) => wallSpot(o, p.edge, s));
  const inner = st.map((q) => q.p), outer = st.map((q) => ({ x: q.p.x - q.n.x * depth, z: q.p.z - q.n.z * depth })), pos: number[] = [];
  const quad = (a: P2, b: P2, ya: number, yb: number, c: P2, d: P2, yc: number, yd: number) => { for (const [q, y] of [[a, ya], [b, yb], [c, yc], [a, ya], [c, yc], [d, yd]] as [P2, number][]) pos.push(q.x, y, q.z); };
  for (let k = 0; k < st.length - 1; k++) {
    quad(inner[k], inner[k + 1], p.y0, p.y0, inner[k + 1], inner[k], p.y1, p.y1);
    quad(outer[k + 1], outer[k], p.y0, p.y0, outer[k], outer[k + 1], p.y1, p.y1);
    quad(inner[k], inner[k + 1], p.y1, p.y1, outer[k + 1], outer[k], p.y1, p.y1);
    quad(inner[k + 1], inner[k], p.y0, p.y0, outer[k], outer[k + 1], p.y0, p.y0);
  }
  const l = st.length - 1;
  quad(outer[0], inner[0], p.y0, p.y0, inner[0], outer[0], p.y1, p.y1);
  quad(inner[l], outer[l], p.y0, p.y0, outer[l], inner[l], p.y1, p.y1);
  return pos;
}
/** Внутренняя грань куска стены (отделка: обои, плитка, покраска) чуть в комнату (inset мм): позиции и (s, y) каждой вершины —
 *  раскладка рисунка по длине стены, как wallUv у прямоугольной комнаты. */
export function wallFace(o: RoomOutline, p: EdgePanel, inset = 0.5): { pos: number[]; su: number[] } {
  const st = edgeStations(o, p.edge, p.s0, p.s1).map((s) => ({ s, ...wallSpot(o, p.edge, s) })), pos: number[] = [], su: number[] = [];
  for (let k = 0; k < st.length - 1; k++) {
    const a = st[k], b = st[k + 1];
    for (const [q, y] of [[a, p.y0], [b, p.y0], [b, p.y1], [a, p.y0], [b, p.y1], [a, p.y1]] as [typeof a, number][]) { pos.push(q.p.x + q.n.x * inset, y, q.p.z + q.n.z * inset); su.push(q.s, y); }
  }
  return { pos, su };
}
/** Пол произвольной формы: многоугольник сплющенного контура (дуги — ломаной). */
export const floorPolygon = (o: RoomOutline): P2[] => flatten(o).pts;

/** Зона у стены перед проёмом/объектом — повёрнутый четырёхугольник на плане: вдоль стены s0..s1 (по хорде), от стены from..to мм внутрь. */
export function edgeZone(o: RoomOutline, edge: number, s0: number, s1: number, from: number, to: number): P2[] {
  const a = edgePoint(o, edge, s0), b = edgePoint(o, edge, s1), l = Math.hypot(b.x - a.x, b.z - a.z);
  const n = l > 1e-6 ? inwardNormal(a, b) : edgeTangent(o, edge, s0).n;
  return [{ x: a.x + n.x * from, z: a.z + n.z * from }, { x: b.x + n.x * from, z: b.z + n.z * from }, { x: b.x + n.x * to, z: b.z + n.z * to }, { x: a.x + n.x * to, z: a.z + n.z * to }];
}
/** Габарит точек плана — {x, z, w, d}. */
export function pointsBox(pts: P2[]) { const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z), x = Math.min(...xs), z = Math.min(...zs); return { x, z, w: Math.max(...xs) - x, d: Math.max(...zs) - z }; }
/** Насколько точки (углы мебели) вышли за стены контура: стена → наибольший выход, мм (только вышедшие). */
export function outsideOutline(o: RoomOutline, pts: P2[]): Map<number, number> {
  const f = flatten(o), out = new Map<number, number>();
  for (const p of pts) { if (pointInOutline(p, f)) continue; const e = projectToEdges(o, p); out.set(e.edge, Math.max(out.get(e.edge) ?? 0, e.dist)); }
  return out;
}
/** Место проёма/объекта на стене контура → старая стена габарита и отступ по старым правилам (выгрузка в Базис: скрипт знает только
 *  4 стены). Центр проецируется на сторону габарита, к которой обращена стена. */
export function edgeToLegacy(room: Pick<Room, "width" | "depth"> & { outline: RoomOutline }, edge: number, offset: number, width: number): { wall: RectWall; offset: number } {
  const wall = edgeLegacyWall(room.outline, edge), c = edgePoint(room.outline, edge, offset + width / 2), len = wall === "back" || wall === "front" ? room.width : room.depth;
  return { wall, offset: r1(Math.max(0, Math.min(len - width, (wall === "back" || wall === "front" ? c.x : c.z) - width / 2))) };
}
