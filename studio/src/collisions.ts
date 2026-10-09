// Проверка пересечений деталей (замечание Макса 09.10.2026: «петли не должны пересекать ничего»).
// Детали — ориентированные коробы (size + position, повороты rotY/rotZ как в сцене: Euler XYZ → R = Ry·Rz, вокруг центра).
// Пересечение — перекрытие больше tol по всем осям разделения (SAT, 15 осей). Касание пересечением не считается.
// Разрешённые контакты — только по реестру allowedContact: крепёж сидит в своих досках, чашка петли — в отверстии своего фасада,
// планка петли — на своей стойке, ХДФ — в пазу на глубину паза, ручка — на своём фасаде, направляющая — между ящиком и стойкой и т. п.
import type { Module, Part } from "./model";

/** bazis — пересечение есть в самом проекте Базиса (модуль из Базиса повторён как есть): показывается с пометкой, не прячется. */
export type Collision = { a: string; b: string; names: [string, string]; depth: number; bazis?: true };

type Box = { c: [number, number, number]; h: [number, number, number]; ax: [number, number, number][] };

function box(p: Part): Box {
  const ry = ((p.rotY ?? 0) * Math.PI) / 180, rz = ((p.rotZ ?? 0) * Math.PI) / 180;
  const cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // столбцы R = Ry·Rz — локальные оси детали в координатах модуля
  const R = [[cy * cz, -cy * sz, sy], [sz, cz, 0], [-sy * cz, sy * sz, cy]];
  const col = (j: number): [number, number, number] => [R[0][j], R[1][j], R[2][j]];
  return { c: p.position, h: [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2], ax: [col(0), col(1), col(2)] };
}
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Глубина взаимного проникновения коробов (минимум по осям разделения); ≤ 0 — не пересекаются. */
export function penetration(A: Box, B: Box): number {
  const d = [B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]];
  const axes: number[][] = [...A.ax, ...B.ax];
  for (const a of A.ax) for (const b of B.ax) { const x = cross(a, b), n = Math.hypot(...x); if (n > 1e-6) axes.push(x.map((v) => v / n)); }
  let min = Infinity;
  for (const L of axes) {
    const rA = A.h[0] * Math.abs(dot(A.ax[0], L)) + A.h[1] * Math.abs(dot(A.ax[1], L)) + A.h[2] * Math.abs(dot(A.ax[2], L));
    const rB = B.h[0] * Math.abs(dot(B.ax[0], L)) + B.h[1] * Math.abs(dot(B.ax[1], L)) + B.h[2] * Math.abs(dot(B.ax[2], L));
    const o = rA + rB - Math.abs(dot(d, L));
    if (o < min) min = o;
  }
  // Минимум по ВСЕМ осям: > 0 — пересекаются на эту глубину; ≤ 0 — разнесены не меньше чем на |min| по лучшей оси
  // (нужно для зазора: «ближе 5 мм» — это min > −5, а не первое отрицательное перекрытие).
  return min;
}

const isBoard = (p: Part) => p.material === "board" || p.material === "hdf";
const isFastener = (p: Part) => p.role === "fastener" && /^(fast|ecc|shp|dowel|rafix):/.test(p.id);
/** Номер фасада/ящика, к которому относится деталь фурнитуры. */
const doorOf = (id: string) => id.replace(/:(hingecup|hingeplate|hingearm|handle|latch):(\d+)(:\d+)?$/, ":door:$2");

/** Разрешён ли контакт пары (порядок не важен). depth — глубина проникновения, мм. */
export function allowedContact(a: Part, b: Part, depth: number, m?: Module): boolean {
  for (const [p, q] of [[a, b], [b, a]] as const) {
    // Крепёж корпуса (конфирмат, эксцентрик, полкодержатель, шкант) сидит в отверстиях досок корпуса и полок.
    if (isFastener(p) && isBoard(q) && q.role !== "door" && !q.id.endsWith(":facade")) return true;
    // Шток эксцентрика проходит через свой бочонок.
    if (isFastener(p) && isFastener(q) && p.id.replace(/:pin$/, "") === q.id.replace(/:pin$/, "")) return true;
    // Чашка петли — в отверстии Ø35 своего фасада; чашка и планка одной петли соединены.
    if (p.role === "hinge" && q.role === "door" && doorOf(p.id) === q.id) return true;
    if (p.role === "hinge" && q.role === "hinge") {
      const k = (s: string) => s.replace(/:(hingecup|hingeplate|hingearm):/, ":hinge:");
      if (k(p.id) === k(q.id)) return true;
    }
    // Планка петли привинчена к стойке: допускаем касание-вдавливание до 3 мм (саморезы и выступ планки в модели).
    if (p.id.includes(":hingeplate:") && isBoard(q) && q.role === "body" && q.size[0] <= 40 && q.size[1] > 60 && depth <= 3) return true;
    // Газлифт кухни: детали одного комплекта собраны друг с другом (шток в газблоке), фиксатор и саморезы — на своём фасаде
    // и на своей боковине (касание-вдавливание до 4 мм — длина самореза).
    if (p.id.startsWith("lift:") && q.id.startsWith("lift:") && p.id.split(":")[1] === q.id.split(":")[1]) return true;
    if (p.id.startsWith("lift:") && ((q.role === "door" && q.hinge === "top" && q.sectionId === p.sectionId) || q.id === p.id.split(":")[1]) && depth <= 4) return true;
    // Подъёмный фасад кухни: планка петли привинчена к нижней плоскости крыши — то же касание до 3 мм.
    if (p.id.includes(":hingeplate:") && p.size[0] > p.size[1] && isBoard(q) && q.role === "body" && q.size[1] <= 40 && q.size[0] > 60 && depth <= 3) return true;
    // Ручка — на своём фасаде (винты через фасад); ручка ящика — на фасаде своего ящика.
    if (p.role === "handle" && q.role === "door" && p.id.replace(":handle:", ":door:") === q.id) return true;
    if (p.role === "handle" && q.id.endsWith(":facade") && p.id.replace(/:handle$/, "") === q.id.replace(/:facade$/, "")) return true;
    // Направляющая Axis PRO — только касание своей боковины корпуса (сетка начинается от её пласти).
    if (p.id.startsWith("kd:") && p.id.includes(":slide:") && (q.id === "left" || q.id === "right") && depth <= 0.5) return true;
    // Ящик Axis PRO — сборочная единица (царги, держатели, дно в канале царги, задняя стенка); фасад со своими деталями — только касание.
    if (p.id.startsWith("kd:") && q.id.startsWith("kd:") && p.id.split(":")[1] === q.id.split(":")[1] && (!p.id.endsWith(":facade") && !q.id.endsWith(":facade") || depth <= 1)) return true;
    // Направляющая ящика — между своим коробом и стойкой корпуса.
    if (!p.id.startsWith("kd:") && p.id.includes(":slide:") && (q.role === "body" || q.role === "drawer") && (q.role === "body" || q.id.split(":slide:")[0] === q.id.replace(/:[a-z]+$/, ""))) return true;
    // Детали одного ящика стыкуются между собой (короб, дно в пазу, фасад на передней стенке).
    if (p.role === "drawer" && q.role === "drawer" && !p.id.startsWith("kd:") && !q.id.startsWith("kd:") && p.id.replace(/:[a-z0-9]+(:\d+)?$/, "") === q.id.replace(/:[a-z0-9]+(:\d+)?$/, "")) return true;
    // ХДФ задника в пазу стоек/дна/крыши: проникновение не глубже паза.
    if (p.material === "hdf" && p.role === "body" && isBoard(q) && q.role === "body" && m?.backType === "groove" && depth <= (m.grooveDepth ?? 8) + 0.5) return true;
    // Штанга — в своих фланцах; фланец — на стойке.
    if ((p.role === "rod" && q.role === "flange") || (p.role === "flange" && isBoard(q) && depth <= 2)) return true;
    // Кухонная фурнитура: опора — под дном, клипса — на опоре и цоколе, навес — в углу боковины, проходит через полосу ХДФ.
    if (p.id.startsWith("leg:") && isBoard(q) && depth <= 3) return true;
    // саморез площадки опоры — в своём отверстии D3×3 в нижней пласти дна
    if (p.id.startsWith("kitchen-leg-screw:") && isBoard(q) && q.role === "body" && depth <= 3.5) return true;
    if (p.id.startsWith("kitchen-clip:") && (q.id.startsWith("leg:") || q.id.startsWith("kitchen-plinth"))) return true;
    if (p.id.startsWith("kitchen-hanger") && isBoard(q) && q.role === "body" && (q.material === "hdf" || (q.size[0] <= 40 && q.size[1] > 60))) return true;
    if (p.id.startsWith("kitchen-hanger-cap:") && q.id === p.id.replace("-cap", "")) return true;
    // навес верхней гранью упирается в нижнюю плоскость крыши: в проектах Базиса он стоит на 0,6–2 мм выше (k14 m04 — 1,2, k14 m06 — 0,6,
    // k18 m09 — 2); глубже — ошибка (k17 m07: крыша Базиса над боковинами, у студии — между ними, 16 мм)
    if (p.id.startsWith("kitchen-hanger") && q.id === "top" && depth <= 2.05) return true;
    // Ящик Axis PRO — сборочная единица (царги, держатели, дно, задняя стенка, фасад, направляющие); саморезы — в своих досках.
    if (p.id.startsWith("kd:") && p.id.includes(":screw:") && isBoard(q) && depth <= 3.5) return true;
    // Подсветка врезается в полку/крышу.
    // подсветка в пазу — только в корпусной доске и не глубже паза (8,5)
    if (p.role === "light" && isBoard(q) && q.role !== "door" && depth <= 8.5) return true;
  // два паза одной доски пересекаются (торцевой паз Gola и паз под подсветку у переднего торца дна, k06 m06) — это вырезы, не детали
  if (p.role === "light" && q.role === "light" && p.id.startsWith("groove:") && q.id.startsWith("groove:")) return true;
  // паз в торце доски (Базис «Паз торцевой», паз Gola в переднем торце дна): целиком внутри своей доски, по её толщине — не больше 8,5
  if (p.role === "light" && p.id.startsWith("groove:") && isBoard(q) && q.role !== "door" && !p.rotY && !p.rotZ && !q.rotY && !q.rotZ) {
    const ti = q.size.indexOf(Math.min(...q.size));
    if ([0, 1, 2].every((i) => Math.abs(p.position[i] - q.position[i]) + p.size[i] / 2 <= q.size[i] / 2 + 0.01) && p.size[ti] <= 8.5) return true;
  }
  }
  return false;
}

/** Коробки детали для проверки: точные коробки фурнитуры (collide) или габарит детали. */
function boxesOf(p: Part): Box[] {
  return p.collide?.length ? p.collide.map((c) => ({ c: c.position, h: [c.size[0] / 2, c.size[1] / 2, c.size[2] / 2], ax: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] })) : [box(p)];
}
/** Глубина пересечения двух деталей (с учётом точных коробок); ≤ 0 — не пересекаются. */
export function partPenetration(a: Part, b: Part): number {
  let best = -Infinity;
  for (const A of boxesOf(a)) for (const B of boxesOf(b)) best = Math.max(best, penetration(A, B));
  return best;
}

/** Модуль из Базиса: отверстие крепежа вскрывает паз под подсветку (k31 m03/m04 — шкант под боковиной на 3 мм в паз 17×8 дна,
 *  m12 — на 1 мм; отверстие D8×12 сверху и паз 8 снизу в доске 16). Так в самом проекте Базиса — студия повторяет как есть
 *  и помечает пересечение «как в проекте Базиса» (не разрешённый контакт: дефект виден и правится в Базисе; n4-antresol). */
const bazisHoleInGroove = (p: Part, q: Part, m?: Module) => !!m?.kitchen?.bazis && [[p, q], [q, p]].some(([a, b]) => isFastener(a) && b.role === "light" && b.id.startsWith("groove:"));

/** Все неразрешённые пересечения деталей модуля. */
export function partCollisions(ps: Part[], m?: Module, tol = 0.1): Collision[] {
  const out: Collision[] = [];
  const boxes = ps.map(box);
  // грубый отбор по сферам габаритов, затем SAT по точным коробкам
  const rad = boxes.map((b) => Math.hypot(...b.h));
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const A = boxes[i], B = boxes[j];
    if (Math.hypot(B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]) > rad[i] + rad[j]) continue;
    const depth = ps[i].collide || ps[j].collide ? partPenetration(ps[i], ps[j]) : penetration(A, B);
    if (depth <= tol) continue;
    if (allowedContact(ps[i], ps[j], depth, m)) continue;
    out.push({ a: ps[i].id, b: ps[j].id, names: [ps[i].name, ps[j].name], depth: Math.round(depth * 10) / 10, ...(bazisHoleInGroove(ps[i], ps[j], m) ? { bazis: true as const } : {}) });
  }
  return out;
}

/** Сырой модуль (детали и фурнитура Базиса как есть). Реестр контактов студии к нему неприменим: сетки фурнитуры Базиса сложной формы,
 *  и их габарит (петля с плечом, направляющая под ящиком, ящик-система) всегда «заходит» в соседние детали — это ложные тревоги.
 *  Политика проверки:
 *  - фурнитура «в воздухе»: точка крепления Базиса (начало координат сетки) дальше RAW_SEAT_GAP мм от ближайшей панели/трубы —
 *    сведения (держатель на профиле без сечения, хозяин в соседнем модуле); дальше RAW_FAR мм — тревога: так не крепят
 *    (194: петли в 0,1–1,5 м от деталей — дверей, на которых они должны висеть, в модели нет).
 *  - фурнитура «внутри детали» (класс ошибки «направляющая в стойке»): центр тела фурнитуры (габарит сетки Базиса по позиции
 *    и повороту, без него — точка крепления) лежит внутри корпусной панели глубже RAW_SEAT_DEPTH мм от её граней — тело сидит
 *    в материале, тревога. Порог меряется от ближайшей грани, поэтому достижим на панели 16 мм (до 8 мм): по 271 шкафу законные
 *    максимумы — 4,8 мм (врезной кронштейн подвеса), 4,3 (Quadro под стенкой ящика). Крепёж, который по назначению сидит в
 *    материале (конфирмат, шкант, эксцентрик, полкодержатель, винты, заглушки), и фасады (чашка петли, винты ручки) не проверяются.
 *    Винты профиля купе и прочее, что крепится к профилям (их сечений нет), не проверяются.
 *  - панели: перекрытие глубже RAW_JOINT мм (паз ХДФ, накладка фасада, стык — мельче) — «как в проекте Базиса», сведения, не тревога:
 *    студия геометрию сырого модуля не меняет, правится она в Базисе. */
export const RAW_SEAT_GAP = 30, RAW_FAR = 100, RAW_SEAT_DEPTH = 5, RAW_JOINT = 10, RAW_SHEET_MAX = 40;
/** outside — точка крепления дальше RAW_SEAT_GAP, но не дальше RAW_FAR (сведения «сверьте с Базисом»); far — дальше RAW_FAR (тревога);
 *  deep — тело фурнитуры внутри панели глубже RAW_SEAT_DEPTH (тревога, gap < 0 — глубина). */
export type RawCheck = { checked: number; outside: { id: string; name: string; gap: number }[]; far: { id: string; name: string; gap: number }[]; deep: { id: string; name: string; gap: number }[]; overlaps: Collision[] };
const RAW_NO_SEAT = /профил|винт для профиля/i;
const RAW_IN_PANEL = /конфирмат|эксцентрик|стяжк|шкант|полкодерж|саморез|винт|заглушк/i;
/** Расстояние точки до короба снаружи (0 — внутри) и глубина внутри (до ближайшей грани; 0 — снаружи). */
function pointBox(pt: number[], B: Box): { out: number; depth: number } {
  const d = [pt[0] - B.c[0], pt[1] - B.c[1], pt[2] - B.c[2]], l = B.ax.map((a) => dot(a, d));
  const out = Math.hypot(...l.map((v, i) => Math.max(0, Math.abs(v) - B.h[i])));
  return { out, depth: out > 0 ? 0 : Math.min(...l.map((v, i) => B.h[i] - Math.abs(v))) };
}
/** Зазор от точки крепления фурнитуры (начало сетки Базиса, без сетки — центр) до ближайшего короба-хозяина, мм; 0 — на нём или внутри. */
const seatGap = (h: Part, bx: Box[]) => Math.min(...bx.map((B) => pointBox(h.model?.origin ?? h.position, B).out));
/** Модуль из Базиса, повторённый параметрически (m.kitchen.bazis): фурнитура дальше RAW_FAR мм от всех досок модуля — висит в воздухе,
 *  как в самом проекте Базиса (навесы на «верх боковины + 985» у k26–k28, k31: сдвиг записан в файле Базиса, сверловок нет).
 *  Студия положение не меняет (всё как в Базисе), а показывает ту же тревогу, что у сырого модуля (rawCheck far). Шкафы студии
 *  и модули без пометки Базиса не проверяются. */
export function bazisAirHardware(ps: Part[], m?: Module): RawCheck["far"] {
  if (!m?.kitchen?.bazis || m.raw) return [];
  const bx = ps.filter(isBoard).map(box), far: RawCheck["far"] = [];
  if (!bx.length) return far;
  for (const h of ps) {
    if (h.material !== "metal" || !h.model) continue; // фурнитура с сеткой Базиса — у неё есть точка крепления
    const gap = seatGap(h, bx);
    if (gap > RAW_FAR) far.push({ id: h.id, name: h.name, gap: Math.round(gap) });
  }
  return far;
}
export function rawCheck(ps: Part[], m?: Module, withOverlaps = true): RawCheck {
  const boards = ps.filter((p) => p.id.startsWith("raw:p") && p.material !== "metal"), hw = ps.filter((p) => p.id.startsWith("raw:h"));
  // хозяева крепления: панели и нарисованные трубы (держатели и соединители штанг сидят на трубах)
  const bx = [...boards, ...ps.filter((p) => p.id.startsWith("raw:r"))].map(box);
  // где тело фурнитуры не должно сидеть: корпусные листовые панели (не фасады — в них чашка петли и винты ручки; не толще 40 мм —
  // объёмный габарит повёрнутой двери углового модуля кухни (k07, k09: 262×917×261), бетонного короба и т. п. — не материал)
  const body = boards.filter((p) => p.role !== "door" && Math.min(...p.size) <= RAW_SHEET_MAX).map(box);
  const outside: RawCheck["outside"] = [], far: RawCheck["far"] = [], deep: RawCheck["deep"] = [];
  let checked = 0;
  for (const h of hw) {
    const cat = m?.raw?.hardware[Number(h.id.slice(5))]?.category ?? "";
    if (RAW_NO_SEAT.test(cat) || RAW_NO_SEAT.test(h.name) || !bx.length) continue;
    checked++;
    const pt = h.model?.origin ?? h.position;
    const gap = seatGap(h, bx);
    if (gap > RAW_FAR) { far.push({ id: h.id, name: h.name, gap: Math.round(gap) }); continue; }
    if (gap > RAW_SEAT_GAP) { outside.push({ id: h.id, name: h.name, gap: Math.round(gap) }); continue; }
    if (RAW_IN_PANEL.test(cat) || RAW_IN_PANEL.test(h.name)) continue;
    const c = h.collide?.[0]?.position ?? pt, depth = Math.max(0, ...body.map((B) => pointBox(c, B).depth));
    if (depth > RAW_SEAT_DEPTH) deep.push({ id: h.id, name: h.name, gap: -Math.round(depth * 10) / 10 });
  }
  const overlaps = withOverlaps ? partCollisions(boards, m, RAW_JOINT) : [];
  return { checked, outside, far, deep, overlaps };
}

/** Пересечения с участием фурнитуры петель — то, что Макс требует свести к нулю везде. */
export const hingeCollisions = (c: Collision[]) => c.filter((x) => /:(hingecup|hingeplate|hingearm|latch):/.test(x.a + " " + x.b));
