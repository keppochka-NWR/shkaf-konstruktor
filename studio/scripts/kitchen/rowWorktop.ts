// Детали «Ряда» и сырых модулей из эталона Базиса: фигурная панель (столешница с контуром в плоскости xz) → прямоугольники
// по контуру вместо сплошного габарита (k25: Г/П-образная столешница 4470×1250 выступала на 650 мм перед нижними модулями
// и заходила в пенал), фасадный материал и кромка Базиса.
export type EtPanel = { name: string; kind?: string; mat?: string; thick?: number; box: number[]; edges?: { thick?: number; len?: number }[]; figure?: boolean; contour?: number[][]; contourPlane?: string };
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

/** Столешница Базиса — по материалу проекта («Столешница», «Столешница 600», «Столешница ПФ 600») или по имени детали.
 *  Не по группе эталона: в «worktops» ряда попадают и полки ЛДСП 16 (k07: 7 «Горизонтальных» на высоте 1190–2340), и «Хром» 6 мм (k09). */
export function isWorktop(p: EtPanel): boolean { return /столешн/i.test(p.mat ?? "") || /столешн/i.test(p.name); }

/** Имя детали ряда: столешница Базиса с безликим именем («Горизонтальная») — «Столешница»; остальное — имя Базиса как есть. */
export function rowPanelName(p: EtPanel): string { return isWorktop(p) && !/столешн/i.test(p.name) ? "Столешница" : p.name; }

/** Название объекта «Ряд» — только то, что в нём есть по Базису (кухня без столешницы в проекте — без «столешницы» в названии). */
export function rowTitle(ps: (EtPanel & { group: string })[]): string {
  const has = (g: string) => ps.some((p) => p.group === g);
  const parts = [ps.some(isWorktop) ? "столешница" : "", has("plinths") ? "цоколь" : "", ps.some((p) => !isWorktop(p) && p.group !== "plinths") ? "панели" : ""].filter(Boolean);
  return "Ряд: " + (parts.join(", ") || "детали вне модулей");
}

/** Фасадный материал Базиса («Фасадный мат-л N») и кромка [толщина, длина] — для сметы сырого модуля; толщина Базиса, если габарит
 *  её не показывает (деталь под углом), и «помещение» — материал «Бетон» (стены и колонны в проекте: k08, k19 — не мебель). */
export function panelExtras(p: EtPanel): { fm?: true; edges?: [number, number][]; thick?: number; room?: true } {
  const edges = (p.edges ?? []).filter((e) => Number(e.len) > 0).map((e) => [Number(e.thick ?? 0), Math.round(Number(e.len) * 10) / 10] as [number, number]);
  const b = p.box, bmin = Array.isArray(b) && b.length === 6 ? Math.min(b[3] - b[0], b[4] - b[1], b[5] - b[2]) : NaN, t = Number(p.thick);
  return { ...(/фасадн/i.test(p.mat ?? "") ? { fm: true as const } : {}), ...(edges.length ? { edges } : {}),
    ...(Number.isFinite(t) && t > 0 && bmin > t + 0.5 ? { thick: Math.round(t * 10) / 10 } : {}), ...(/бетон/i.test(p.mat ?? "") ? { room: true as const } : {}) };
}
