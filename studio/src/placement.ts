// Физика расстановки (запросы Макса 31.10.2026): «подвесные ящики крепятся к стене, не летают в воздухе; шкафы стоят на полу»,
// «если повернуть нельзя — повернуть и примагнитить в ближайшее возможное положение к изначальному», «при быстром перетягивании
// модули слетают». Только чистая логика (без three и React) — tests/placement-physics.test.ts. Тяга в сцене и на «Плане», поворот,
// добавление и проверка расстановки зовут отсюда. Старый проект с висящим шкафом открывается: здесь — предупреждение и исправление
// одним щелчком (fixSupport), не ошибка загрузки (projectErrors правило опоры не проверяет).
import { applyAutoFillers, bounds, isBazisModule, moduleCenter, moduleFootprint, modulesOverlap, overlap, projectErrors, type PlacedModule, type Project } from "./project";
import { isUpperModule, RULES, type Module } from "./model";
import { edgeArc, edgeLength, edgePoint, edgeTangent, flatten, polygonInOutline, projectToEdges, roomOutline, type FlatPolygon, type P2 } from "./roomOutline";

/** Правило опоры по типу (Claude 31.10, ждёт подтверждения Макса):
 *  wall — навесной: Module.hanging (шкаф, поднятый «От пола», подвесной ящик), кухонный навесной и кухонная антресоль, а также шкаф/стеллаж
 *    студии, поднятый от пола без флага (старые проекты, «полка на стене»): спина вплотную к стене (прямой, косой, дуге) или стоит на модуле;
 *  floor — всё остальное (шкафы, комоды, кухонные низы и пеналы, купе, столы, угловые, антресоль на шкафу): низ на полу или на верху модуля.
 *  null — не проверяем: модули из проекта Базиса (расстановка как в Базисе: у кухонь k03/k14 навесные в 8 мм от стены) и столешница (лежит на низах по своим правилам).
 *  Свободно висящих типов нет: полка на стене — навесная (к стене), «парящей» мебели в студии не бывает. */
export type SupportRole = "floor" | "wall";
/** Числа правил (мм): rest — низ на полу/на верху соседа; flush — спина навесного у стены; magnet — зона у стены, где корпус при тяге
 *  разворачивается к ней спиной и встаёт вплотную (как в The Sims); turnRadius/dragRadius — поиск ближайшего свободного места при
 *  повороте и тяге; step — шаг поиска вдоль стены. */
export const SUPPORT = { rest: 2, flush: 5, magnet: 150, turnRadius: 1000, dragRadius: 300, step: 10 } as const;
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
  if (m.hanging || isUpperModule(m)) return "wall";
  if ((a.y ?? 0) > SUPPORT.rest && canHang(m) && !restsOn(p, a)) return "wall";
  return "floor";
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
/** Что не так с опорой корпуса (предупреждение «Проверьте расстановку»); null — стоит/висит правильно. */
export function supportProblem(p: Project, a: PlacedModule): string | null {
  const role = supportRole(p, a);
  if (!role) return null;
  const y = a.y ?? 0, n = a.module.name;
  if (y <= SUPPORT.rest || restsOn(p, a)) return null;
  if (role === "floor") return `«${n}» висит в воздухе: низ на ${Math.round(y)} мм от пола, под ним нет модуля. Шкаф стоит на полу или на другом модуле.`;
  const c = backContact(p, a);
  if (c && c.gap <= SUPPORT.flush) return null;
  return `Навесной «${n}» не у стены: спина в ${c ? Math.round(c.gap) : "?"} мм от стены. Навесной крепится к стене вплотную.`;
}
export function supportWarnings(p: Project): { moduleId: string; kind: "support"; message: string }[] {
  return p.modules.flatMap((a) => { const m = supportProblem(p, a); return m ? [{ moduleId: a.id, kind: "support" as const, message: m }] : []; });
}
/** Корпус спиной к стене edge: середина спины — в точке s стены, лицом в комнату (поворот по нормали стены). Дуга-эркер — углы спины
 *  на дуге (корпус сдвигается внутрь, пока след в комнате). */
export function attachToWall(p: Project, a: PlacedModule, edge: number, s: number): PlacedModule {
  const o = roomOutline(p.room), { n } = edgeTangent(o, edge, s), P = edgePoint(o, edge, s);
  const b: PlacedModule = { ...a, rotation: norm360(Math.round((Math.atan2(n.x, n.z) * 1800) / Math.PI) / 10) };
  const f = moduleFootprint(b);
  b.x += P.x - (f[0].x + f[1].x) / 2; b.z += P.z - (f[0].z + f[1].z) / 2;
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
function shifts(c: Fit, list: Moving[], radius: number, step: number): { dx: number; dz: number; d: number }[] {
  const x0 = Math.min(...list.map((m) => m.b.x)), z0 = Math.min(...list.map((m) => m.b.z)), w = Math.max(...list.map((m) => m.b.x + m.b.w)) - x0, d = Math.max(...list.map((m) => m.b.z + m.b.d)) - z0;
  const xs = new Set([0, -x0, -x0 + WALL_FILLER, c.W - x0 - w, c.W - x0 - w - WALL_FILLER, ...c.others.flatMap((o) => [o.b.x + o.b.w - x0, o.b.x - w - x0])].map(r1));
  const zs = new Set([0, -z0, c.D - z0 - d, ...c.others.flatMap((o) => [o.b.z + o.b.d - z0, o.b.z - d - z0])].map(r1));
  for (let k = -radius; k <= radius; k += step) { xs.add(k); zs.add(k); }
  const out: { dx: number; dz: number; d: number }[] = [];
  for (const dx of xs) for (const dz of zs) { const dd = Math.hypot(dx, dz); if (dd <= radius + 0.01) out.push({ dx, dz, d: dd }); }
  return out.sort((a, b) => a.d - b.d || Math.abs(a.dx) + Math.abs(a.dz) - Math.abs(b.dx) - Math.abs(b.dz));
}
/** Ближайший свободный сдвиг группы (дёшево, без автофальшей); null — в радиусе места нет. */
export function nearestShift(p: Project, list: PlacedModule[], radius: number, step = 25): { dx: number; dz: number } | null {
  const c = fitCtx(p, new Set(list.map((a) => a.id))), mv = moving(list);
  for (const s of shifts(c, mv, radius, step)) if (fitsShift(c, mv, s.dx, s.dz)) return { dx: s.dx, dz: s.dz };
  return null;
}
/** Места навесного у стен по удалению центра от want (вдоль стены шагом step, у каждой стены — лицом в комнату). Только стены,
 *  у которых нормаль не дальше maxTurn° от нынешнего «лица» корпуса (поворот: та же сторона; исправление: любая). */
function wallSpots(p: Project, want: PlacedModule, radius: number, maxTurn = 180): PlacedModule[] {
  const o = roomOutline(p.room), C = moduleCenter(want), rot = want.rotation ?? 0, out: { a: PlacedModule; d: number }[] = [];
  const face = { x: Math.sin((rot * Math.PI) / 180), z: Math.cos((rot * Math.PI) / 180) };
  o.forEach((_, i) => {
    const L = edgeLength(o, i), near = projectToEdges(o, C, (j) => j === i);
    if (near.dist > radius + Math.max(want.module.width, want.module.depth)) return;
    for (let s = 0; s <= L + 0.01; s += SUPPORT.step) {
      const { n } = edgeTangent(o, i, s);
      if (Math.acos(Math.max(-1, Math.min(1, n.x * face.x + n.z * face.z))) * 180 / Math.PI > maxTurn + 0.5) continue;
      const P = edgePoint(o, i, s);
      if (Math.hypot(P.x - C.x, P.z - C.z) > radius + Math.max(want.module.width, want.module.depth)) continue;
      const b = attachToWall(p, want, i, s), q = moduleCenter(b), dd = Math.hypot(q.x - C.x, q.z - C.z);
      if (dd <= radius) out.push({ a: b, d: dd });
    }
  });
  return out.sort((u, v) => u.d - v.d).map((x) => x.a);
}
/** Проверка итога как у правки (автофальши + projectErrors): ошибки, которых не было до правки. */
function cleanAfter(before: Project): (n: Project) => boolean {
  const old = new Set(projectErrors(applyAutoFillers(before), true));
  return (n) => projectErrors(applyAutoFillers(n), true).every((e) => old.has(e));
}
const withModule = (p: Project, a: PlacedModule): Project => ({ ...p, modules: p.modules.map((x) => (x.id === a.id ? a : x)) });
/** Запас от соседей в первом проходе поиска: автофальш у стыка под 90° (угловая планка, до 40 мм) и у стены не упрётся в соседа. */
const MARGIN = 45;
/** Первое место, которое проходит проверку правки (ok): сначала с запасом MARGIN от соседей, затем вплотную; в каждом проходе — не больше
 *  cap полных проверок (дешёвая — по габаритам, полная — автофальши + projectErrors). */
function firstOk<T>(cands: T[], cheap: (t: T, margin: number) => boolean, build: (t: T) => Project, ok: (n: Project) => boolean, cap = 25): { t: T; n: Project } | null {
  for (const margin of [MARGIN, 0]) { let tried = 0; for (const t of cands) { if (!cheap(t, margin)) continue; const n = build(t); if (ok(n)) return { t, n }; if (++tried >= cap) break; } }
  return null;
}

/** «Поставить на пол / к стене» одним щелчком: шкаф — на верх модуля под ним или на пол; навесной — к ближайшей стене лицом в комнату
 *  (свободное место вдоль стены). Места нет — понятная ошибка. */
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
  const c = fitCtx(p, new Set([mid])), hit = firstOk(wallSpots(p, a, 20000), (b, m) => fitsShift(c, moving([b]), 0, 0, m), (b) => withModule(p, b), ok);
  if (hit) return hit.n;
  throw Error(`Навесной «${a.module.name}» некуда повесить: у стен нет свободного места. Освободите место у стены или поставьте его на пол («От пола» 0).`);
}
/** Тяга корпуса (сцена и «План»): что делает физика с местом под курсором. Шкаф: на виде спереди/сбоку высота — ближайший уровень опоры
 *  (пол или верх модуля под ним), сверху — падает на опору, если ушёл с модуля; у стены (ближе magnet) разворачивается к ней спиной и
 *  встаёт вплотную (не у стопки и не при Alt/Ctrl). Навесной: всегда спиной к ближайшей стене (едет вдоль неё, переходит на другую, если
 *  курсор ближе к ней). Пересёкся с соседом — ближайшее свободное место в dragRadius (упирается, а не проходит насквозь). free — без привязок. */
export type DragView = "iso" | "front" | "side" | "left" | "top" | "plan";
export function settleDrag(p: Project, mid: string, next: Pos, ctx: { view: DragView; free?: boolean; point?: boolean }): Pos {
  const a = p.modules.find((x) => x.id === mid);
  if (!a) return next;
  const role = supportRole(p, a);
  if (!role) return next;
  const vertical = ctx.view === "front" || ctx.view === "side" || ctx.view === "left";
  let b: PlacedModule = { ...a, x: next.x, y: next.y, z: next.z, rotation: next.rotation ?? a.rotation };
  const c = fitCtx(p, new Set([mid]));
  if (role === "wall") {
    if ((b.y ?? 0) > SUPPORT.rest && !restsOn(p, a, b)) {
      const o = roomOutline(p.room), C = moduleCenter(b), near = projectToEdges(o, C), cur = backContact(p, a);
      // своя стена держит, пока курсор не ближе к другой больше чем на magnet (у угла не прыгает туда-сюда)
      const edge = cur && cur.gap <= SUPPORT.flush && projectToEdges(o, C, (j) => j === cur.edge).dist <= near.dist + SUPPORT.magnet ? cur.edge : near.edge;
      b = attachToWall(p, b, edge, projectToEdges(o, C, (j) => j === edge).s);
      if (!fitsShift(c, moving([b]), 0, 0)) { const q = wallSpots(p, b, SUPPORT.dragRadius, 1).find((x) => placeFits(p, [x])); if (q) b = q; }
    }
    return { x: b.x, y: b.y ?? 0, z: b.z, rotation: b.rotation ?? 0 };
  }
  const levels = supportLevels(p, a, b), y = b.y ?? 0;
  if (vertical) b.y = levels.reduce((best, v) => (Math.abs(v - y) < Math.abs(best - y) ? v : best), 0);
  else if (y > SUPPORT.rest && !restsOn(p, a, b)) b.y = Math.max(...levels.filter((v) => v <= y + SUPPORT.rest));
  if (!ctx.free && !ctx.point && !vertical && (b.y ?? 0) <= SUPPORT.rest && !a.module.kupe && !a.module.corner) { const m = wallMagnet(p, b); if (m) b = m; }
  if (!ctx.free && !fitsShift(c, moving([b]), 0, 0)) { const s = nearestShift(p, [b], SUPPORT.dragRadius, 20); if (s) b = { ...b, x: r1(b.x + s.dx), z: r1(b.z + s.dz) }; }
  return { x: b.x, y: b.y ?? 0, z: b.z, rotation: b.rotation ?? 0 };
}
/** Магнит к стене (The Sims, ресёрч 31.10 п. 3): корпус, который ещё не стоит спиной к стене (дальше magnet), подведён к стене боком или
 *  фасадом ближе magnet — разворачивается спиной к ней, вплотную. null — не трогаем. */
export function wallMagnet(p: Project, b: PlacedModule): PlacedModule | null {
  const back = backContact(p, b);
  if (back && back.gap <= SUPPORT.magnet) return null;
  const o = roomOutline(p.room);
  let best: { edge: number; dist: number } | null = null;
  for (const q of moduleFootprint(b)) { const e = projectToEdges(o, q); if (e.dist <= SUPPORT.magnet && (!best || e.dist < best.dist)) best = e; }
  if (!best) return null;
  const e = best.edge;
  return attachToWall(p, b, e, projectToEdges(o, moduleCenter(b), (j) => j === e).s);
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
    const hit = firstOk(shifts(c, mv, SUPPORT.turnRadius, 25), (s, m) => fitsShift(c, mv, s.dx, s.dz, m), (s) => withModule(p, at(s)), ok);
    if (hit) return { project: hit.n, moved: dist(at(hit.t)) };
  }
  throw Error(`Повернуть «${a.module.name}» некуда: в пределах ${SUPPORT.turnRadius} мм от места нет свободного положения${hang ? " у стены" : ""}. Освободите место рядом или сначала передвиньте корпус.`);
}
/** Поворот группы без места: группа уже повёрнута (rotated) — ближайший свободный сдвиг всей группы в turnRadius. */
export function nearestGroupPlace(p: Project, rotated: Project, ids: readonly string[]): { project: Project; moved: number } {
  const list = rotated.modules.filter((a) => ids.includes(a.id)), c = fitCtx(rotated, new Set(ids)), mv = moving(list), ok = cleanAfter(p);
  const hit = firstOk(shifts(c, mv, SUPPORT.turnRadius, 25), (s, m) => fitsShift(c, mv, s.dx, s.dz, m), (s) => ({ ...rotated, modules: rotated.modules.map((a) => (ids.includes(a.id) ? { ...a, x: r1(a.x + s.dx), z: r1(a.z + s.dz) } : a)) }), ok);
  if (hit) return { project: hit.n, moved: Math.round(hit.t.d) };
  throw Error(`Повернуть группу некуда: в пределах ${SUPPORT.turnRadius} мм от места нет свободного положения. Освободите место рядом или измените состав группы.`);
}
/** Только что добавленный корпус (палитра, копия): навесной встал не у стены — к ближайшей стене; не вышло — как есть (покажет проверка). */
export function settleAdded(p: Project, mid: string): Project {
  const a = p.modules.find((x) => x.id === mid);
  if (!a || !supportProblem(p, a)) return p;
  try { return fixSupport(p, mid); } catch { return p; }
}
