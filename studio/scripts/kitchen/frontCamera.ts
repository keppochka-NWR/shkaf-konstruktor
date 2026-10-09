// Камера «спереди главного ряда» для снимков целой кухни (scripts/kitchen-shots.ts, команда front; n4-kitchens3).
// Вид студии «Спереди» смотрит на фасад ВЫБРАННОГО модуля: у k01/k06 (выбран модуль с поворотом 90) это вид сбоку, у k30 (выбран
// «Остров», поворот 180) — основной ряд сзади и зеркально. Здесь направление — по ряду с наибольшей суммарной шириной модулей.
import { localToRoom, type Project } from "../../src/project";

/** Нормаль фасада для поворота модуля (как localToRoom: поворот 0 — фасад к +z, 90 — к +x, 180 — к −z, 270 — к −x), [x, z]. */
export const FRONT_NORMAL: Record<number, [number, number]> = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0] };

/** Поворот главного ряда: у какого поворота больше всего ширины модулей (при равенстве — меньший поворот). Объекты «Ряда» (raw.row:
 *  цоколи, столешницы, стеновые панели — с 1a7d673 каждый отдельно, все с поворотом 0) — не модули ряда, их ширина не в счёт. */
export function mainRowRotation(p: Project): number {
  const byRot = new Map<number, number>();
  for (const a of p.modules) if (!a.module.raw?.row) byRot.set(a.rotation ?? 0, (byRot.get(a.rotation ?? 0) ?? 0) + a.module.width);
  return [...byRot].sort((u, v) => v[1] - u[1] || u[0] - v[0])[0]?.[0] ?? 0;
}

/** [камера x,y,z, цель x,y,z] в координатах комнаты, мм: центр габарита всей кухни (от пола), отступ по нормали главного ряда —
 *  чтобы кухня целиком вошла в кадр перспективы студии (вертикальный угол fov, по умолчанию 34°), с запасом margin. */
export function frontCamera(p: Project, aspect: number, margin = 1.08, fov = 34): number[] {
  const n = FRONT_NORMAL[mainRowRotation(p)] ?? FRONT_NORMAL[0];
  const lo = [Infinity, 0, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const a of p.modules) for (const [u, v] of [[0, 0], [a.module.width, 0], [0, a.module.depth], [a.module.width, a.module.depth]]) {
    const r = localToRoom(a, u, v), y0 = a.y ?? 0;
    for (const q of [[r.x, y0, r.z], [r.x, y0 + a.module.height, r.z]]) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); }
  }
  if (!p.modules.length) return [0, 1000, 5000, 0, 1000, 0];
  const c = [0, 1, 2].map((i) => (lo[i] + hi[i]) / 2), wide = n[0] ? hi[2] - lo[2] : hi[0] - lo[0], deep = n[0] ? hi[0] - lo[0] : hi[2] - lo[2];
  const t = Math.tan((fov / 2) * Math.PI / 180), dist = Math.max((hi[1] - lo[1]) / 2 / t, wide / 2 / (t * aspect)) * margin + deep / 2;
  return [c[0] + n[0] * dist, c[1], c[2] + n[1] * dist, c[0], c[1], c[2]];
}
