// Физика расстановки (запросы Макса 31.10.2026): «подвесные ящики крепятся к стене, не летают в воздухе; шкафы стоят на полу»,
// «если повернуть нельзя — повернуть и примагнитить в ближайшее возможное положение к изначальному», «при быстром перетягивании
// модули слетают». Только чистая логика (без three и React) — tests/placement-physics.test.ts. Тяга в сцене и на «Плане», поворот,
// добавление и проверка расстановки зовут отсюда. Старый проект с висящим шкафом открывается: здесь — предупреждение и исправление
// одним щелчком (fixSupport), не ошибка загрузки (projectErrors правило опоры не проверяет).
import { applyAutoFillers, bounds, isBazisModule, moduleCenter, moduleFootprint, modulesOverlap, overlap, projectErrors, type PlacedModule, type Project } from "./project";
import { isUpperModule, RULES, type Module } from "./model";
import { edgeArc, edgeLength, edgePoint, edgeTangent, flatten, polygonInOutline, projectToEdges, roomOutline, type FlatPolygon, type P2 } from "./roomOutline";

/** Правило опоры по типу (Claude 31.10, ждёт подтверждения Макса):
 *  wall — навесной: только явно навесной — Module.hanging (шкаф, поднятый «От пола», подвесной ящик), кухонный навесной и кухонная
 *    антресоль: спина у стены (прямой, косой, дуге; допуск WALL_TOL) или вровень со спиной ряда у стены, или стоит на модуле;
 *  floor — всё остальное (шкафы, комоды, кухонные низы и пеналы, купе, столы, угловые, антресоль на шкафу): низ на полу или на верху модуля.
 *    Шкаф/стеллаж студии, поднятый без флага навесного (старые файлы, «полка на стене»), — floor: у стены (как навесной) — без замечаний,
 *    не у стены — предупреждение; к стене сам не тянется (критик 31.10).
 *  null — не проверяем: модули из проекта Базиса (расстановка как в Базисе: у кухонь k03/k14 навесные в 8 мм от стены) и столешница. */
export type SupportRole = "floor" | "wall";
/** Числа правил (мм): rest — низ на полу/на верху соседа; magnet — зона у стены, где шкаф при тяге встаёт к ней вплотную (только сдвиг,
 *  если спина уже смотрит на стену ±45°; навесной у стены — разворот к ней лицом в комнату); turnRadius/dragRadius — поиск ближайшего
 *  свободного места при повороте и тяге; step — шаг поиска вдоль стены. */
export const SUPPORT = { rest: 2, magnet: 150, turnRadius: 1000, dragRadius: 300, step: 10 } as const;
/** Допуск «спина навесного у стены», мм (критик 31.10: композиции в 30 мм от стены — заказы 7441182, 7437584-b; навес ABS и шина
 *  выбирают такой зазор). ПРЕДЛОЖЕНИЕ — ждёт подтверждения Макса; было 5. Вровень со спиной ряда у стены (±ROW_TOL) — тоже норма. */
export const WALL_TOL = 50;
const ROW_TOL = 5;
const WALL_FILLER = RULES.panel + RULES.wallFillerEdgeGap;
const r1 = (v: number) => Math.round(v * 10) / 10;
const norm360 = (d: number) => ((d % 360) + 360) % 360;
type Box = ReturnType<typeof bounds>;
type Pos = { x: number; y: number; z: number; rotation?: number };

/** Шкаф/стеллаж студии, который «От пола» > 0 делает навесным (то же правило, что operations.setWallDistance, решение 23.10). */
export const canHang = (m: Module) => !(m.feet || m.kitchen || m.raw || m.kupe || m.desk || m.worktop || m.corner || m.casework);
const footOverlap = (a: Box, b: Box) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.z < b.z + b.d - 1 && b.z < a.z + a.d - 1;
/** Модули под корпусом: их верх у его низа (±rest) и следы на плане перекрываются. at — где корпус сейчас (тяга). */
export function restsOn(p: Project, a: PlacedModule, at: Partial<Pos> = {}): boolean {
  const b = { ...a, ...at }, y = b.y ?? 0, bb = bounds(b);
  return p.modules.some((o) => o.id !== a.id && Math.abs((o.y ?? 0) + o.module.height - y) < SUPPORT.rest && footOverlap(bb, bounds(o)));
}
/** Уровни, на которые корпус может встать в этом месте: пол и верх модулей под его следом (не выше потолка с корпусом). */
export function supportLevels(p: Project, a: PlacedModule, at: Partial<Pos> = {}): number[] {
  const b = { ...a, ...at }, bb = bounds(b), H = p.room.height - a.module.height;
  return [...new Set([0, ...p.modules.filter((o) => o.id !== a.id && footOverlap(bb, bounds(o))).map((o) => r1((o.y ?? 0) + o.module.height)).filter((v) => v <= H + 0.1)])].sort((u, v) => u - v);
}
export function supportRole(p: Project, a: PlacedModule): SupportRole | null {
  const m = a.module;
  if (m.raw || m.worktop || isBazisModule(p, a)) return null;
  return m.hanging || isUpperModule(m) ? "wall" : "floor";
}
/** Спина корпуса у стены: стена (номер ребра контура; прямоугольник — 0 задняя, 1 правая, 2 передняя, 3 левая), зазор спины и место
 *  середины спины вдоль стены. Спина — задние углы следа (с задником 3 мм); у дуги — с поправкой на стрелу хорды спины. */
export function backContact(p: Project, a: PlacedModule): { edge: number; gap: number; s: number } | null {
  const o = roomOutline(p.room), f = moduleFootprint(a), A = f[0], B = f[1], M = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
  let best: { edge: number; gap: number; s: number } | null = null;
  o.forEach((v, i) => {
    const only = (j: number) => j === i, pa = projectToEdges(o, A, only), pb = projectToEdges(o, B, only), pm = projectToEdges(o, M, only);
    let gap = Math.max(pa.dist, pb.dist);
    const w2 = o[(i + 1) % o.length], arc = edgeArc(v, w2, v.bulge ?? 0);
    if (arc) { const ch = Math.hypot(B.x - A.x, B.z - A.z), sag = arc.R - Math.sqrt(Math.max(0, arc.R * arc.R - (ch * ch) / 4)); gap = Math.min(gap, Math.max(pm.dist, gap - sag)); }
    else {
      // прямая стена — по её линии (спина может выходить за конец стены: скос угла короче корпуса, ниша), если середина спины у стены
      const L = Math.hypot(w2.x - v.x, w2.z - v.z) || 1, t = { x: (w2.x - v.x) / L, z: (w2.z - v.z) / L }, line = (q: P2) => Math.abs((q.x - v.x) * t.z - (q.z - v.z) * t.x);
      const along = (M.x - v.x) * t.x + (M.z - v.z) * t.z;
      if (along >= -1 && along <= L + 1) gap = Math.min(gap, Math.max(line(A), line(B)));
    }
    if (!best || gap < best.gap) best = { edge: i, gap: r1(gap), s: pm.s };
  });
  return best;
}
const faceOf = (rot: number | undefined) => ({ x: Math.sin(((rot ?? 0) * Math.PI) / 180), z: Math.cos(((rot ?? 0) * Math.PI) / 180) });
/** Спина вровень (±ROW_TOL) со спиной соседа того же поворота, который сам стоит у стены (ряд шкафов в 30 мм от стены и антресоль над
 *  ними) и рядом по длине ряда (зазор до 50 мм или над/под ним). */
export function rowAligned(p: Project, a: PlacedModule): boolean {
  const rot = norm360(a.rotation ?? 0), fc = faceOf(rot), t = { x: fc.z, z: -fc.x };
  const line = (q: P2) => q.x * fc.x + q.z * fc.z, along = (q: P2) => q.x * t.x + q.z * t.z;
  const spine = (x: PlacedModule) => { const f = moduleFootprint(x), M = { x: (f[0].x + f[1].x) / 2, z: (f[0].z + f[1].z) / 2 }; return { back: line(M), u0: Math.min(along(f[0]), along(f[1])), u1: Math.max(along(f[0]), along(f[1])) }; };
  const me = spine(a);
  return p.modules.some((o) => {
    if (o.id === a.id || o.module.raw || Math.abs(norm360(o.rotation ?? 0) - rot) > 0.5) return false;
    const s = spine(o);
    if (Math.abs(s.back - me.back) > ROW_TOL || s.u0 > me.u1 + 50 || s.u1 < me.u0 - 50) return false;
    const c = backContact(p, o);
    return !!c && c.gap <= SUPPORT.magnet;
  });
}
/** Спина у стены (до WALL_TOL) или вровень с рядом у стены. */
export const wallOk = (p: Project, a: PlacedModule) => { const c = backContact(p, a); return (!!c && c.gap <= WALL_TOL) || rowAligned(p, a); };
/** Что не так с опорой корпуса (предупреждение «Проверьте расстановку»); null — стоит/висит правильно. */
export function supportProblem(p: Project, a: PlacedModule): string | null {
  const role = supportRole(p, a);
  if (!role) return null;
  const y = a.y ?? 0, n = a.module.name;
  if (y <= SUPPORT.rest || restsOn(p, a)) return null;
  if (role === "floor") {
    if (canHang(a.module) && wallOk(p, a)) return null; // старый файл: шкаф студии поднят без флага навесного, но у стены — «полка на стене»
    return `«${n}» висит в воздухе: низ на ${Math.round(y)} мм от пола, под ним нет модуля. Шкаф стоит на полу или на другом модуле.`;
  }
  if (wallOk(p, a)) return null;
  const c = backContact(p, a);
  return `Навесной «${n}» не у стены: спина в ${c ? Math.round(c.gap) : "?"} мм от стены. Навесной крепится к стене (допуск ${WALL_TOL} мм).`;
}
export function supportWarnings(p: Project): { moduleId: string; kind: "support"; message: string }[] {
  return p.modules.flatMap((a) => { const m = supportProblem(p, a); return m ? [{ moduleId: a.id, kind: "support" as const, message: m }] : []; });
}
/** Корпус спиной к стене edge: середина спины — в точке s стены, лицом в комнату (поворот по нормали стены); inset — зазор спины от стены
 *  (тяга сохраняет прежний, композиция в 30 мм не прижимается). Дуга-эркер — углы спины на дуге (корпус сдвигается внутрь). */
export function attachToWall(p: Project, a: PlacedModule, edge: number, s: number, inset = 0): PlacedModule {
  const o = roomOutline(p.room), { n } = edgeTangent(o, edge, s), P = edgePoint(o, edge, s);
  const b: PlacedModule = { ...a, rotation: norm360(Math.round((Math.atan2(n.x, n.z) * 1800) / Math.PI) / 10) };
  const f = moduleFootprint(b);
  b.x += P.x - (f[0].x + f[1].x) / 2 + n.x * inset; b.z += P.z - (f[0].z + f[1].z) / 2 + n.z * inset;
  const v = o[edge];
  if (edgeArc(v, o[(edge + 1) % o.length], v.bulge ?? 0)) { const poly = flatten(o); for (let k = 0; k < 120 && !polygonInOutline(moduleFootprint(b), poly); k++) { b.x += n.x * 2.5; b.z += n.z * 2.5; } }
  return { ...b, x: r1(b.x), z: r1(b.z) };
}

// ─── дешёвая проверка места (как projectErrors по габариту и пересечениям, без автофальшей) ───
type Fit = { W: number; D: number; H: number; poly: FlatPolygon | null; others: { a: PlacedModule; b: Box }[] };
function fitCtx(p: Project, ids: ReadonlySet<string>): Fit {
  return { W: p.room.width, D: p.room.depth, H: p.room.height, poly: p.room.outline ? flatten(p.room.outline) : null, others: p.modules.filter((o) => !ids.has(o.id)).map((a) => ({ a, b: bounds(a) })) };
}
type Moving = { a: PlacedModule; b: Box; f: P2[] };
const moving = (list: PlacedModule[]): Moving[] => list.map((a) => ({ a, b: bounds(a), f: moduleFootprint(a) }));
function fitsShift(c: Fit, list: Moving[], dx: number, dz: number, margin = 0): boolean {
  for (const m of list) {
    const bb = { ...m.b, x: m.b.x + dx, z: m.b.z + dz };
    if (bb.x < -0.1 || bb.z < -0.1 || bb.y < -0.1 || bb.x + bb.w > c.W + 0.1 || bb.z + bb.d > c.D + 0.1 || bb.y + bb.h > c.H + 0.1) return false;
    if (c.poly && !polygonInOutline(m.f.map((q) => ({ x: q.x + dx, z: q.z + dz })), c.poly)) return false;
    if (margin > 0) { const g = { ...bb, x: bb.x - margin, z: bb.z - margin, w: bb.w + 2 * margin, d: bb.d + 2 * margin }; if (c.others.some((o) => overlap(g, o.b))) return false; }
    if (c.others.some((o) => overlap(bb, o.b) && modulesOverlap({ ...m.a, x: m.a.x + dx, z: m.a.z + dz }, o.a))) return false;
  }
  return true;
}
/** Место свободно (в комнате, без пересечений с остальными корпусами), ids — что едет вместе. */
export function placeFits(p: Project, list: PlacedModule[]): boolean { return fitsShift(fitCtx(p, new Set(list.map((a) => a.id))), moving(list), 0, 0); }
/** Сдвиги группы, по удалению: на месте, вплотную к стенам (и с фальшем 20 у стены), к соседям, сетка step в радиусе. */
function shifts(c: Fit, list: Moving[], radius: number, step: number, extra?: { dx: number; dz: number }): { dx: number; dz: number; d: number }[] {
  const x0 = Math.min(...list.map((m) => m.b.x)), z0 = Math.min(...list.map((m) => m.b.z)), w = Math.max(...list.map((m) => m.b.x + m.b.w)) - x0, d = Math.max(...list.map((m) => m.b.z + m.b.d)) - z0;
  const xs = new Set([0, -x0, -x0 + WALL_FILLER, c.W - x0 - w, c.W - x0 - w - WALL_FILLER, ...c.others.flatMap((o) => [o.b.x + o.b.w - x0, o.b.x - w - x0])].map(r1));
  const zs = new Set([0, -z0, c.D - z0 - d, ...c.others.flatMap((o) => [o.b.z + o.b.d - z0, o.b.z - d - z0])].map(r1));
  for (let k = -radius; k <= radius; k += step) { xs.add(k); zs.add(k); }
  if (extra) { xs.add(r1(extra.dx)); zs.add(r1(extra.dz)); }
  const out: { dx: number; dz: number; d: number }[] = [];
  for (const dx of xs) for (const dz of zs) { const dd = Math.hypot(dx, dz); if (dd <= radius + 0.01) out.push({ dx, dz, d: dd }); }
  return out.sort((a, b) => a.d - b.d || Math.abs(a.dx) + Math.abs(a.dz) - Math.abs(b.dx) - Math.abs(b.dz));
}
/** Ближайший свободный сдвиг группы (дёшево, без автофальшей); null — в радиусе места нет. */
export function nearestShift(p: Project, list: PlacedModule[], radius: number, step = 25, extra?: { dx: number; dz: number }): { dx: number; dz: number } | null {
  const c = fitCtx(p, new Set(list.map((a) => a.id))), mv = moving(list);
  for (const s of shifts(c, mv, radius, step, extra)) if (fitsShift(c, mv, s.dx, s.dz)) return { dx: s.dx, dz: s.dz };
  return null;
}
/** Места навесного у стен с удалением центра d от want (вдоль стены шагом step, у каждой стены — лицом в комнату). Только стены,
 *  у которых нормаль не дальше maxTurn° от нынешнего «лица» корпуса (поворот: та же сторона; исправление: любая). */
function wallSpots(p: Project, want: PlacedModule, radius: number, maxTurn = 180, inset = 0): { t: PlacedModule; d: number }[] {
  const o = roomOutline(p.room), C = moduleCenter(want), out: { t: PlacedModule; d: number }[] = [], face = faceOf(want.rotation), reach = radius + Math.max(want.module.width, want.module.depth);
  o.forEach((_, i) => {
    const L = edgeLength(o, i);
    if (projectToEdges(o, C, (j) => j === i).dist > reach) return;
    for (let s = 0; s <= L + 0.01; s += SUPPORT.step) {
      const { n } = edgeTangent(o, i, s);
      if ((Math.acos(Math.max(-1, Math.min(1, n.x * face.x + n.z * face.z))) * 180) / Math.PI > maxTurn + 0.5) continue;
      const P = edgePoint(o, i, s);
      if (Math.hypot(P.x - C.x, P.z - C.z) > reach) continue;
      const b = attachToWall(p, want, i, s, inset), q = moduleCenter(b), dd = Math.hypot(q.x - C.x, q.z - C.z);
      if (dd <= radius) out.push({ t: b, d: dd });
    }
  });
  return out.sort((u, v) => u.d - v.d);
}
/** Проверка итога как у правки (автофальши + projectErrors): ошибки, которых не было до правки. */
function cleanAfter(before: Project): (n: Project) => boolean {
  const old = new Set(projectErrors(applyAutoFillers(before), true));
  return (n) => projectErrors(applyAutoFillers(n), true).every((e) => old.has(e));
}
const withModule = (p: Project, a: PlacedModule): Project => ({ ...p, modules: p.modules.map((x) => (x.id === a.id ? a : x)) });
/** Запас от соседей (MARGIN): место, где автофальш у стыка под 90° (угловая планка, до 40 мм) не упрётся в соседа. Один проход по удалению
 *  (критик 31.10: «сначала с запасом» уводил антресоль на 580 мм при годном месте рядом): ближайшие места проверяются полностью все,
 *  но вплотную к соседу — не больше PLAIN раз (дальше у стыка обычно та же угловая планка), места с запасом — до cap. */
const MARGIN = 45, PLAIN = 8;
function firstOk<T>(cands: { t: T; d: number }[], cheap: (t: T, margin: number) => boolean, build: (t: T) => Project, ok: (n: Project) => boolean, cap = 40): { t: T; n: Project } | null {
  let tried = 0, plain = 0;
  for (const c of [...cands].sort((a, b) => a.d - b.d)) {
    if (!cheap(c.t, 0)) continue;
    const roomy = cheap(c.t, MARGIN);
    if (!roomy && plain >= PLAIN) continue;
    if (!roomy) plain++;
    const n = build(c.t);
    if (ok(n)) return { t: c.t, n };
    if (++tried >= cap) break;
  }
  return null;
}
/** «Поставить на пол / к стене» одним щелчком: шкаф — на верх модуля под ним или на пол; навесной — к ближайшей стене лицом в комнату
 *  (ближайшее свободное место). Места нет — понятная ошибка. */
export function fixSupport(p: Project, mid: string): Project {
  const a = p.modules.find((x) => x.id === mid);
  if (!a) throw Error("Корпус не найден.");
  if (!supportProblem(p, a)) return p;
  const ok = cleanAfter(p), role = supportRole(p, a);
  if (role === "floor") {
    const y = Math.max(...supportLevels(p, a).filter((v) => v <= (a.y ?? 0) + SUPPORT.rest)), n = withModule(p, { ...a, y });
    if (ok(n)) return n;
    throw Error(`«${a.module.name}» не встаёт ${y ? "на модуль под ним" : "на пол"}: место занято. Сдвиньте корпус или освободите место.`);
  }
  const n = hangOnWall(p, a, ok);
  if (n) return n;
  throw Error(`Навесной «${a.module.name}» некуда повесить: у стен нет свободного места. Освободите место у стены или поставьте его на пол («От пола» 0).`);
}
/** Ближайшее свободное место навесного у стены (любой стороны, лицом в комнату); null — нет. */
function hangOnWall(p: Project, a: PlacedModule, ok: (n: Project) => boolean): Project | null {
  const c = fitCtx(p, new Set([a.id])), hit = firstOk(wallSpots(p, a, 20000), (b, m) => fitsShift(c, moving([b]), 0, 0, m), (b) => withModule(p, b), ok);
  return hit ? hit.n : null;
}
/** Тяга корпуса (сцена и «План»): что делает физика с местом под курсором.
 *  Шкаф (floor): поворот при тяге НЕ меняется (критик 31.10: столы и торцевые шкафы, поставленные боком, разворачивались); на виде
 *  спереди/сбоку высота — ближайший уровень опоры, сверху — падает на опору, если ушёл с модуля; у стены (ближе magnet) встаёт вплотную
 *  только сдвигом и только если спина смотрит на стену (±45°) и тяга началась вне этой зоны. Шкаф, висевший в воздухе до тяги (старый
 *  файл), высоту не меняет — предупреждение остаётся.
 *  Навесной (wall): спиной к стене, едет вдоль неё; на другую стену (с разворотом лицом в комнату) — только когда курсор явно ближе к ней
 *  (на magnet); зазор спины от своей стены сохраняется (ряд в 30 мм от стены не прижимается).
 *  Пересёкся с соседом — ближайшее свободное место в dragRadius. free — без привязок; point — Alt/Ctrl или линия Q поймали место: ни
 *  прижима к стене, ни упора в соседа (иначе корпус сдёргивается с линии) — пересечение покажет красный след. */
export type DragView = "iso" | "front" | "side" | "left" | "top" | "plan";
export function settleDrag(p: Project, mid: string, next: Pos, ctx: { view: DragView; free?: boolean; point?: boolean }): Pos {
  const a = p.modules.find((x) => x.id === mid);
  if (!a) return next;
  const role = supportRole(p, a);
  if (!role) return next;
  const vertical = ctx.view === "front" || ctx.view === "side" || ctx.view === "left";
  let b: PlacedModule = { ...a, x: next.x, y: next.y, z: next.z };
  const c = fitCtx(p, new Set([mid])), loose = !ctx.free && !ctx.point;
  if (role === "wall") {
    if ((b.y ?? 0) > SUPPORT.rest && !restsOn(p, a, b)) {
      const o = roomOutline(p.room), C = moduleCenter(b), C0 = moduleCenter(a), near = projectToEdges(o, C), cur = backContact(p, a), held = !!cur && (cur.gap <= WALL_TOL || rowAligned(p, a));
      // своя стена держит: и пока курсор не ближе к другой на magnet, и пока корпус не сдвинут на magnet (малая тяга у угла не разворачивает)
      const own = !!cur && (held || cur.gap <= SUPPORT.magnet) && (projectToEdges(o, C, (j) => j === cur.edge).dist <= near.dist + SUPPORT.magnet || Math.hypot(C.x - C0.x, C.z - C0.z) <= SUPPORT.magnet);
      const edge = own ? cur!.edge : near.edge, t = attachToWall(p, b, edge, projectToEdges(o, C, (j) => j === edge).s, held && edge === cur!.edge ? cur!.gap : 0);
      // навесной не у стены (старый файл): малая тяга (до magnet) его не перебрасывает к стене — едет как есть, предупреждение остаётся
      if (!held && Math.hypot(C.x - C0.x, C.z - C0.z) <= SUPPORT.magnet) return { x: b.x, y: b.y ?? 0, z: b.z, rotation: a.rotation ?? 0 };
      // тяга началась у стены, а спина на неё не смотрит (навесной стоит боком): поворот не меняем — только сдвиг (критик 31.10)
      if (!held && moduleFootprint(a).some((q) => projectToEdges(o, q).dist <= SUPPORT.magnet) && Math.abs(norm360(t.rotation ?? 0) - norm360(a.rotation ?? 0)) > 0.5) return { x: b.x, y: b.y ?? 0, z: b.z, rotation: a.rotation ?? 0 };
      b = t;
      // упёрся в соседа: ближайшее место с тем же зазором от стены (ряд в 30 мм не прижимается) или то, откуда тянем
      if (loose && !fitsShift(c, moving([b]), 0, 0)) { const C1 = moduleCenter(b), back = held ? [{ t: a, d: Math.hypot(C0.x - C1.x, C0.z - C1.z) }] : [], q = [...back, ...wallSpots(p, b, SUPPORT.dragRadius, 1, held && edge === cur!.edge ? cur!.gap : 0)].sort((u, v) => u.d - v.d).find((x) => placeFits(p, [x.t])); if (q) b = q.t; }
    }
    return { x: b.x, y: b.y ?? 0, z: b.z, rotation: b.rotation ?? 0 };
  }
  const y0 = a.y ?? 0, floating = y0 > SUPPORT.rest && !restsOn(p, a);
  if (!floating) {
    const levels = supportLevels(p, a, b), y = b.y ?? 0;
    if (vertical) b.y = levels.reduce((best, v) => (Math.abs(v - y) < Math.abs(best - y) ? v : best), 0);
    else if (y > SUPPORT.rest && !restsOn(p, a, b)) b.y = Math.max(...levels.filter((v) => v <= y + SUPPORT.rest));
  }
  if (loose && !vertical && (b.y ?? 0) <= SUPPORT.rest && !a.module.kupe && !a.module.corner) { const m = wallFlush(p, a, b); if (m) b = m; }
  if (loose && !fitsShift(c, moving([b]), 0, 0)) { /* и место, откуда тянем: дверь купе в проёме на 1 мм в сторону возвращается на место, а не уезжает на шаг сетки */ const s = nearestShift(p, [b], SUPPORT.dragRadius, 20, { dx: a.x - b.x, dz: a.z - b.z }); if (s) b = { ...b, x: r1(b.x + s.dx), z: r1(b.z + s.dz) }; }
  return { x: b.x, y: b.y ?? 0, z: b.z, rotation: b.rotation ?? 0 };
}
/** Прижим шкафа к стене при тяге (The Sims, ресёрч 31.10 п. 3, урезано по критику 31.10): только сдвиг, без поворота. Стена — та, на которую
 *  смотрит спина (±45°) и до которой ближний задний угол ближе magnet; тяга началась вне этой зоны (иначе — как стоял). null — не трогаем. */
export function wallFlush(p: Project, start: PlacedModule, b: PlacedModule): PlacedModule | null {
  const s0 = backContact(p, start);
  if (s0 && s0.gap <= SUPPORT.magnet) return null;
  const o = roomOutline(p.room), f = moduleFootprint(b), fc = faceOf(b.rotation), back = [f[0], f[1]];
  let best: { n: P2; dist: number } | null = null;
  o.forEach((_, i) => {
    const pr = back.map((q) => projectToEdges(o, q, (j) => j === i)), dist = Math.min(...pr.map((q) => q.dist));
    if (dist > SUPPORT.magnet || dist < 0.5) return;
    const { n } = edgeTangent(o, i, pr[0].s);
    if (n.x * fc.x + n.z * fc.z < Math.SQRT1_2 - 1e-6) return; // спина смотрит на стену: «лицо» корпуса ±45° от нормали стены внутрь
    if (!best || dist < best.dist) best = { n, dist };
  });
  if (!best) return null;
  const { n, dist } = best as { n: P2; dist: number };
  return { ...b, x: r1(b.x - n.x * dist), z: r1(b.z - n.z * dist) };
}
/** Поворот без места (запрос Макса 31.10): корпус повёрнут на rotation вокруг центра, место занято или за стеной — ближайшее свободное
 *  положение к исходному в turnRadius (навесной — у стены той же стороны, лицом в комнату). Итог проверяется как правка; нет — ошибка. */
export function nearestTurn(p: Project, mid: string, rotation: number): { project: Project; moved: number } {
  const a = p.modules.find((x) => x.id === mid);
  if (!a) throw Error("Корпус не найден.");
  const c0 = moduleCenter(a), turned: PlacedModule = { ...a, rotation }, c1 = moduleCenter(turned);
  turned.x = r1(turned.x + c0.x - c1.x); turned.z = r1(turned.z + c0.z - c1.z);
  const ok = cleanAfter(p), hang = supportRole(p, a) === "wall" && (a.y ?? 0) > SUPPORT.rest && !restsOn(p, a);
  const dist = (b: PlacedModule) => { const q = moduleCenter(b); return Math.round(Math.hypot(q.x - c0.x, q.z - c0.z)); };
  const c = fitCtx(p, new Set([mid]));
  if (hang) { const hit = firstOk(wallSpots(p, turned, SUPPORT.turnRadius, 45), (b, m) => fitsShift(c, moving([b]), 0, 0, m), (b) => withModule(p, b), ok); if (hit) return { project: hit.n, moved: dist(hit.t) }; }
  else {
    const mv = moving([turned]), at = (s: { dx: number; dz: number }) => ({ ...turned, x: r1(turned.x + s.dx), z: r1(turned.z + s.dz) });
    const hit = firstOk(shifts(c, mv, SUPPORT.turnRadius, 25).map((s) => ({ t: s, d: s.d })), (s, m) => fitsShift(c, mv, s.dx, s.dz, m), (s) => withModule(p, at(s)), ok);
    if (hit) return { project: hit.n, moved: dist(at(hit.t)) };
  }
  throw Error(`Повернуть «${a.module.name}» некуда: в пределах ${SUPPORT.turnRadius} мм от места нет свободного положения${hang ? " у стены" : ""}. Освободите место рядом или сначала передвиньте корпус.`);
}
/** Поворот группы без места: группа уже повёрнута (rotated) — ближайший свободный сдвиг всей группы в turnRadius. */
export function nearestGroupPlace(p: Project, rotated: Project, ids: readonly string[]): { project: Project; moved: number } {
  const list = rotated.modules.filter((a) => ids.includes(a.id)), c = fitCtx(rotated, new Set(ids)), mv = moving(list), ok = cleanAfter(p);
  const hit = firstOk(shifts(c, mv, SUPPORT.turnRadius, 25).map((s) => ({ t: s, d: s.d })), (s, m) => fitsShift(c, mv, s.dx, s.dz, m), (s) => ({ ...rotated, modules: rotated.modules.map((a) => (ids.includes(a.id) ? { ...a, x: r1(a.x + s.dx), z: r1(a.z + s.dz) } : a)) }), ok);
  if (hit) return { project: hit.n, moved: Math.round(hit.t.d) };
  throw Error(`Повернуть группу некуда: в пределах ${SUPPORT.turnRadius} мм от места нет свободного положения. Освободите место рядом или измените состав группы.`);
}
/** Навесные из ids, которые после правки (поворот группы) не у стены — для сообщения «Повесить к стене». */
export function looseHanging(p: Project, ids: readonly string[]): string[] {
  return p.modules.filter((a) => ids.includes(a.id) && supportRole(p, a) === "wall" && supportProblem(p, a)).map((a) => a.module.name);
}
/** Только что добавленный корпус (палитра, копия): навесной встал не вплотную к стене (и не в ряд у стены) — к ближайшей стене; не вышло — как есть. */
export function settleAdded(p: Project, mid: string): Project {
  const a = p.modules.find((x) => x.id === mid);
  if (!a || supportRole(p, a) !== "wall" || (a.y ?? 0) <= SUPPORT.rest || restsOn(p, a) || rowAligned(p, a)) return p;
  // новый навесной — вплотную к стене (допуск WALL_TOL — для уже стоящих: палитра ставит на 30 мм от стены)
  const c = backContact(p, a);
  if (c && c.gap <= SUPPORT.rest) return p;
  return hangOnWall(p, a, cleanAfter(p)) ?? p;
}
