// Проверка пересечений деталей (замечание Макса 09.10.2026: «петли не должны пересекать ничего»).
// Детали — ориентированные коробы (size + position, повороты rotY/rotZ как в сцене: Euler XYZ → R = Ry·Rz, вокруг центра).
// Пересечение — перекрытие больше tol по всем осям разделения (SAT, 15 осей). Касание пересечением не считается.
// Разрешённые контакты — только по реестру allowedContact: крепёж сидит в своих досках, чашка петли — в отверстии своего фасада,
// планка петли — на своей стойке, ХДФ — в пазу на глубину паза, ручка — на своём фасаде, направляющая — между ящиком и стойкой и т. п.
import type { Module, Part } from "./model";

export type Collision = { a: string; b: string; names: [string, string]; depth: number };

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
    if (min <= 0) return min;
  }
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
    if (p.id.includes(":hingeplate:") && isBoard(q) && q.role === "body" && depth <= 3) return true;
    // Ручка — на своём фасаде (винты через фасад); ручка ящика — на фасаде своего ящика.
    if (p.role === "handle" && q.role === "door" && p.id.replace(":handle:", ":door:") === q.id) return true;
    if (p.role === "handle" && q.id.endsWith(":facade") && p.id.replace(/:handle$/, "") === q.id.replace(/:facade$/, "")) return true;
    // Направляющая ящика — между своим коробом и стойкой корпуса.
    if (p.id.includes(":slide:") && (q.role === "body" || q.role === "drawer") && (q.role === "body" || q.id.split(":slide:")[0] === q.id.replace(/:[a-z]+$/, ""))) return true;
    // Детали одного ящика стыкуются между собой (короб, дно в пазу, фасад на передней стенке).
    if (p.role === "drawer" && q.role === "drawer" && p.id.replace(/:[a-z0-9]+(:\d+)?$/, "") === q.id.replace(/:[a-z0-9]+(:\d+)?$/, "")) return true;
    // ХДФ задника в пазу стоек/дна/крыши: проникновение не глубже паза.
    if (p.material === "hdf" && p.role === "body" && isBoard(q) && q.role === "body" && m?.backType === "groove" && depth <= (m.grooveDepth ?? 8) + 0.5) return true;
    // Штанга — в своих фланцах; фланец — на стойке.
    if ((p.role === "rod" && q.role === "flange") || (p.role === "flange" && isBoard(q) && depth <= 2)) return true;
    // Кухонная фурнитура: опора — под дном, клипса — на опоре и цоколе, навес — в углу боковины, проходит через полосу ХДФ.
    if (p.id.startsWith("leg:") && isBoard(q) && depth <= 3) return true;
    if (p.id.startsWith("kitchen-clip:") && (q.id.startsWith("leg:") || q.id.startsWith("kitchen-plinth"))) return true;
    if (p.id.startsWith("kitchen-hanger") && isBoard(q) && q.role === "body") return true;
    if (p.id.startsWith("kitchen-hanger-cap:") && q.id === p.id.replace("-cap", "")) return true;
    // Подсветка врезается в полку/крышу.
    if (p.role === "light" && isBoard(q)) return true;
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
    out.push({ a: ps[i].id, b: ps[j].id, names: [ps[i].name, ps[j].name], depth: Math.round(depth * 10) / 10 });
  }
  return out;
}

/** Пересечения с участием фурнитуры петель — то, что Макс требует свести к нулю везде. */
export const hingeCollisions = (c: Collision[]) => c.filter((x) => /:(hingecup|hingeplate|hingearm|latch):/.test(x.a + " " + x.b));
