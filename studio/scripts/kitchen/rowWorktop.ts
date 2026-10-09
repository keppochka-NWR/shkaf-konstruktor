// Детали «Ряда» и сырых модулей из эталона Базиса: фигурная панель (столешница с контуром в плоскости xz) → прямоугольники
// по контуру вместо сплошного габарита (k25: Г/П-образная столешница 4470×1250 выступала на 650 мм перед нижними модулями
// и заходила в пенал), фасадный материал и кромка Базиса.
export type EtPanel = { name: string; kind?: string; mat?: string; box: number[]; edges?: { thick?: number; len?: number }[]; figure?: boolean; contour?: number[][]; contourPlane?: string };
type Box = [number, number, number, number, number, number];

/** Прямолинейный контур в плоскости xz → прямоугольники (полосы по x, соседние с одинаковыми интервалами по z склеены).
 *  Не прямоугольный (наклонные рёбра) или не совпадающий с габаритом контур — габарит как есть. */
export function rowRects(p: EtPanel): Box[] {
  const b = p.box as Box, c = p.contour;
  if (!p.figure || p.contourPlane !== "xz" || !Array.isArray(c) || c.length < 4) return [b];
  const pts = c.map((q) => [Number(q[0]), Number(q[1])]);
  if (pts.some((q) => !q.every(Number.isFinite))) return [b];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], d = pts[(i + 1) % pts.length]; if (Math.abs(a[0] - d[0]) > 0.01 && Math.abs(a[1] - d[1]) > 0.01) return [b]; }
  const cx0 = Math.min(...pts.map((q) => q[0])), cx1 = Math.max(...pts.map((q) => q[0])), cz0 = Math.min(...pts.map((q) => q[1])), cz1 = Math.max(...pts.map((q) => q[1]));
  if (Math.abs(cx1 - cx0 - (b[3] - b[0])) > 1 || Math.abs(cz1 - cz0 - (b[5] - b[2])) > 1) return [b];
  const P = pts.map(([x, z]) => [x - cx0 + b[0], z - cz0 + b[2]]);
  const xs = [...new Set(P.map((q) => Math.round(q[0] * 100) / 100))].sort((u, v) => u - v);
  const strips: { x0: number; x1: number; iv: number[] }[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const xm = (xs[i] + xs[i + 1]) / 2, zs: number[] = [];
    for (let j = 0; j < P.length; j++) { const a = P[j], d = P[(j + 1) % P.length]; if (Math.abs(a[1] - d[1]) <= 0.01 && Math.min(a[0], d[0]) < xm && Math.max(a[0], d[0]) > xm) zs.push(a[1]); }
    zs.sort((u, v) => u - v);
    if (zs.length % 2) return [b];
    const last = strips[strips.length - 1];
    if (last && last.x1 === xs[i] && last.iv.join() === zs.join()) last.x1 = xs[i + 1];
    else strips.push({ x0: xs[i], x1: xs[i + 1], iv: zs });
  }
  const out: Box[] = [];
  for (const s of strips) for (let k = 0; k < s.iv.length; k += 2) out.push([s.x0, b[1], s.iv[k], s.x1, b[4], s.iv[k + 1]]);
  return out.length ? out : [b];
}

/** Фронтальная деталь фасадного материала ряда (фасад посудомойки ПМ): плоскость xy (тонкая по z), высота ≥ 300. */
export function rowFront(p: EtPanel): boolean {
  const b = p.box;
  if (!Array.isArray(b) || b.length !== 6 || !/фасадн/i.test(p.mat ?? "")) return false;
  const sx = b[3] - b[0], sy = b[4] - b[1], sz = b[5] - b[2];
  return sz < Math.min(sx, sy) && sz <= 25 && sy >= 300;
}

/** Фасадный материал Базиса («Фасадный мат-л N»), кромка [толщина, длина] и материал плиты МДФ — для сметы сырого модуля. */
export function panelExtras(p: EtPanel): { fm?: true; edges?: [number, number][]; mat?: string } {
  const edges = (p.edges ?? []).filter((e) => Number(e.len) > 0).map((e) => [Number(e.thick ?? 0), Math.round(Number(e.len) * 10) / 10] as [number, number]);
  return { ...(/фасадн/i.test(p.mat ?? "") ? { fm: true as const } : {}), ...(edges.length ? { edges } : {}), ...((p.kind === "mdf" || p.kind === "other") && p.mat && !/фасадн/i.test(p.mat) ? { mat: p.mat } : {}) };
}
