// Детали «Ряда» и сырых модулей из эталона Базиса: фигурная панель (столешница с контуром в плоскости xz) → прямоугольники
// по контуру вместо сплошного габарита (k25: Г/П-образная столешница 4470×1250 выступала на 650 мм перед нижними модулями
// и заходила в пенал), фасадный материал и кромка Базиса.
export type EtPanel = { name: string; kind?: string; mat?: string; box: number[]; edges?: { thick?: number; len?: number }[]; figure?: boolean; contour?: number[][]; contourPlane?: string; role?: string; thick?: number; lw?: number[] };
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

/** Цоколь (деталь, закрывающая опоры) у Базиса называется как угодно — «Фронтальная», «Вертикальная», «Цоколь Видимый»; роль
 *  определяет эталон (etalon.py: имя «цокол» или геометрия — вертикальная плита у пола, высотой с опору, 14–22 мм). Чтобы в раскрое
 *  и смете деталь читалась как цоколь, имя — «Цоколь · <имя Базиса>»; уже названную «Цоколь…» не трогаем. Размеры — как в Базисе. */
export function plinthName(name: string): string {
  const n = (name ?? "").trim();
  return /цокол/i.test(n) ? n : n ? `Цоколь · ${n}` : "Цоколь";
}

/** Деталь из группы «столешницы» эталона. etalon.py относит к столешнице и всё горизонтальное из контейнера «…столеш…» —
 *  поэтому столешница здесь только та, что так и названа в Базисе (имя или материал «Столешница…»: все 31 столешница 34 кухонь),
 *  либо толстая (≥ 20) деталь не из плиты. Остальное:
 *  - ЛДСП/плита — обычная деталь под своим именем Базиса, в раскрой (k07: полки, крыша и дно «Пенала на столешку», ЛДСП 16 —
 *    раньше «Столешница 16 мм», 3,2 пог.м, и вне раскроя);
 *  - прочий материал (k09: «Хром» 6 мм 410×330 со скруглёнными углами на столешнице — макет мойки) — обстановка модели, не
 *    изделие: не берём (как стены «Бетон» и макеты «Пластик»), иначе в смете «Столешница 6 мм». */
export function worktopGroupRole(p: EtPanel): "worktop" | "panel" | "mock" {
  if (/столешн/i.test(`${p.name ?? ""} ${p.mat ?? ""}`)) return "worktop";
  if (["ldsp", "mdf", "hdf", "glass", "mirror"].includes(p.kind ?? "") || /фасадн|лдсп|мдф|хдф|плита/i.test(p.mat ?? "")) return "panel";
  const b = p.box, t = Number(p.thick) > 0 ? Number(p.thick) : Array.isArray(b) && b.length === 6 ? Math.min(b[3] - b[0], b[4] - b[1], b[5] - b[2]) : 0;
  return t >= 20 ? "worktop" : "mock";
}

export type RowPanel = EtPanel & { front: boolean };
/** Детали «Ряда» кухни (столешница, цоколь, стеновые панели, профили, прочее вне модулей) в мировых координатах Базиса.
 *  - фигурная столешница — прямоугольники по контуру Базиса (не сплошной габарит);
 *  - фасад посудомойки (ПМ) и прочие фронтальные детали фасадного материала в «прочем» — фасад (кнопка «Скрыть фасады»);
 *  - цоколь (row.plinths) — «Цоколь · <имя Базиса>»: в раскрое ЛДСП и в смете — цоколем;
 *  - стены помещения («Бетон», замер) и макеты техники («Пластик», роль appliance) — обстановка модели Базиса, не изделие: не берём;
 *  - группа «столешницы» — по worktopGroupRole: «Столешница» только настоящая столешница Базиса. */
export function rowPanelsOf(row: Record<string, unknown> | undefined): RowPanel[] {
  const grp = (g: string) => ((row?.[g] ?? []) as EtPanel[]).filter((p) => p && Array.isArray(p.box) && p.box.length === 6);
  return (["worktops", "plinths", "wallPanels", "profiles", "other"] as const).flatMap((g) => grp(g).flatMap((p): RowPanel[] => {
    if (p.role === "appliance") return [];
    const wt = g === "worktops" ? worktopGroupRole(p) : null;
    if (wt === "mock") return [];
    const name = g === "plinths" ? plinthName(p.name) : wt === "worktop" && !/столешн/i.test(p.name) ? "Столешница" : p.name;
    const rs = rowRects(p);
    return rs.map((box, i) => ({ ...p, name: rs.length > 1 ? `${name} (часть ${i + 1}/${rs.length})` : name, box, kind: p.kind ?? "ldsp", front: g === "other" && rowFront(p) }));
  }));
}

/** Панель не по осям: габарит по толщине больше толщины Базиса больше чем на ROT_TOL — берём собственные толщину и длину×ширину
 *  Базиса. Порог 0,3: k09 — боковой цоколь ЛДСП 16 стоит чуть повёрнутым (габарит 16,64), при пороге 1 мм он уходил на отдельный
 *  лист «16.7» (лишний лист в смете). Дробные хвосты бокса (16.0999999, Δ 0,1) порог не задевают — их округляет rawThickness. */
export const ROT_TOL = 0.3;

/** Фасадный материал Базиса («Фасадный мат-л N») и кромка [толщина, длина] — для сметы сырого модуля. */
export function panelExtras(p: EtPanel): { fm?: true; edges?: [number, number][]; t?: number; lw?: [number, number] } {
  const edges = (p.edges ?? []).filter((e) => Number(e.len) > 0).map((e) => [Number(e.thick ?? 0), Math.round(Number(e.len) * 10) / 10] as [number, number]);
  // панель не по осям (угловая дверь под 45°, чуть повёрнутый цоколь): габарит не равен толщине — собственные толщина и длина×ширина Базиса
  const b = p.box, minBox = Array.isArray(b) && b.length === 6 ? Math.min(b[3] - b[0], b[4] - b[1], b[5] - b[2]) : NaN;
  const rot = Number(p.thick) > 0 && Array.isArray(p.lw) && p.lw.length === 2 && Math.abs(minBox - Number(p.thick)) > ROT_TOL;
  return { ...(/фасадн/i.test(p.mat ?? "") ? { fm: true as const } : {}), ...(edges.length ? { edges } : {}),
    ...(rot ? { t: Math.round(Number(p.thick) * 10) / 10, lw: [Math.round(p.lw![0] * 10) / 10, Math.round(p.lw![1] * 10) / 10] as [number, number] } : {}) };
}
