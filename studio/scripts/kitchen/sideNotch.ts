// Вырез в заднем верхнем углу боковины по контуру Базиса (k32: навесные и антресоли, вырез 100×20).
// Контур боковины — в плоскости yz, точки [y, z] от угла детали; z растёт к фасаду, поэтому задняя кромка — минимальный z.
const r1 = (v: number) => Math.round(v * 10) / 10;

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
