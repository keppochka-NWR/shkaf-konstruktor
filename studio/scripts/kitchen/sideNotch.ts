// Вырез в заднем верхнем углу боковины по контуру Базиса (k32: навесные и антресоли, вырез 100×20).
// Контур боковины — в плоскости yz, точки [y, z] от угла детали; z растёт к фасаду, поэтому задняя кромка — минимальный z.
const r1 = (v: number) => Math.round(v * 10) / 10;

/** ХДФ с вырезами в обоих верхних углах (k33, k34: 25×45 — ХДФ проходит за крышей, углы обходят пазы/крепёж у боковин):
 *  контур в плоскости xy из 8 точек — прямоугольник без двух одинаковых верхних углов. Ширина и высота выреза или null. */
export function topCornerNotchFromContour(p: { figure?: boolean; contour?: number[][]; contourPlane?: string }): { width: number; height: number } | null {
  const c = p.contour;
  if (!p.figure || p.contourPlane !== "xy" || !Array.isArray(c)) return null;
  const pts = c.map((q) => [Number(q[0]), Number(q[1])]).filter((q, i, a) => i === 0 || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 0.01);
  if (pts.length !== 8 || pts.some((q) => !q.every(Number.isFinite))) return null;
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.01, has = (x: number, y: number) => pts.some((q) => eq(q[0], x) && eq(q[1], y));
  if (has(x0, y1) || has(x1, y1)) return null;
  const yn = pts.find((q) => eq(q[0], x0) && !eq(q[1], y0))?.[1], xn = pts.find((q) => eq(q[1], y1))?.[0];
  if (yn === undefined || xn === undefined) return null;
  const w = Math.min(Math.abs(xn - x0), Math.abs(x1 - xn)), h = y1 - yn;
  if (!(w > 0 && h > 0 && 2 * w < x1 - x0 && h < y1 - y0)) return null;
  if (![[x0, y0], [x1, y0], [x1, yn], [x1 - w, yn], [x1 - w, y1], [x0 + w, y1], [x0 + w, yn], [x0, yn]].every(([x, y]) => has(x, y))) return null;
  return { width: r1(w), height: r1(h) };
}

/** Высота (от верха) и глубина (от задней кромки) выреза, если контур — ровно прямоугольник без заднего верхнего угла; иначе null. */
export function rearNotchFromContour(p: { figure?: boolean; contour?: number[][]; contourPlane?: string }): { height: number; depth: number } | null {
  const c = p.contour;
  if (!p.figure || p.contourPlane !== "yz" || !Array.isArray(c)) return null;
  const pts = c.map((q) => [Number(q[0]), Number(q[1])]).filter((q, i, a) => i === 0 || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 0.01);
  if (pts.length !== 6 || pts.some((q) => !q.every(Number.isFinite))) return null;
  const ys = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.01, has = (y: number, z: number) => pts.some((q) => eq(q[0], y) && eq(q[1], z));
  if (has(y1, z0)) return null; // задний верхний угол на месте — выреза там нет
  const yn = pts.find((q) => eq(q[1], z0) && !eq(q[0], y0))?.[0], zn = pts.find((q) => eq(q[0], y1) && !eq(q[1], z1))?.[1];
  if (yn === undefined || zn === undefined || !(yn > y0 && yn < y1 && zn > z0 && zn < z1)) return null;
  if (![[y0, z0], [y0, z1], [y1, z1], [y1, zn], [yn, zn], [yn, z0]].every(([y, z]) => has(y, z))) return null;
  return { height: r1(y1 - yn), depth: r1(zn - z0) };
}
