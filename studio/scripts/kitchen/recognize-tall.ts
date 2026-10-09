// Распознавание пеналов (и общее для кухонь Базиса), поток n4-tall: дубли фурнитуры Базиса, своя глубина отдельных полок.
import { parts, type Module, type Part } from "../../src/model";
import type { RefModule } from "./compare";

type B = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Фурнитура, дубли которой повторяем как в Базисе: категория эталона → признак детали студии. */
const DUP_CATS: Record<string, (id: string) => boolean> = {
  опора: (id) => id.startsWith("leg:"),
  конфирмат: (id) => id.startsWith("fast:"),
};
/** Точка привязки детали студии (как в compare.ts): native-модель — origin, иначе anchor, иначе центр. */
const anchorOf = (p: Part) => (p.model?.native && p.model.origin ? p.model.origin : p.anchor ?? p.position);

/** Дубли Базиса: опора или конфирмат, которые в проекте стоят дважды в одной точке (поворот может отличаться: k23 m14 — второй
 *  конфирмат полки смотрит наружу). По всей базе: опоры — k16 m01 (2), k16 m13 (1); конфирматы — k18 m11, k18 m12, k23 m14, k23 m17,
 *  k27 m04. Возвращает id деталей студии, у которых в Базисе есть второй экземпляр (kitchen.dupParts): деталь студии — ближайшая
 *  той же категории не дальше 2 мм; не нашлась — дубль не ставим (студия не добавляет того, чего не может привязать). */
export function dupPartsFromEtalon(ref: Pick<RefModule, "panels" | "hardware">, m: Module): string[] {
  const groups = new Map<string, { category: string; pos: number[] }[]>();
  for (const h of ref.hardware) {
    if (!DUP_CATS[h.category]) continue;
    const k = `${h.category}|${h.pos.map(r1).join(",")}`;
    groups.set(k, [...(groups.get(k) ?? []), h]);
  }
  const dups = [...groups.values()].filter((l) => l.length > 1);
  if (!dups.length) return [];
  const ps = parts(m);
  // общая точка отсчёта — минимальный угол панелей (как в compare.ts)
  const refP = ref.panels.filter((p) => ["ldsp", "hdf", "mdf", "glass", "other"].includes(p.kind));
  const items = ps.filter((p) => (p.material === "board" || p.material === "hdf" || p.material === "glass") && (!p.external || p.role === "door" || p.id.endsWith(":facade")));
  if (!refP.length || !items.length) return [];
  const oa = [0, 1, 2].map((i) => Math.min(...refP.map((p) => p.box[i])));
  const ob = [0, 1, 2].map((i) => Math.min(...items.map((p) => p.position[i] - p.size[i] / 2)));
  const out: string[] = [];
  for (const l of dups) {
    const test = DUP_CATS[l[0].category], pt = l[0].pos.map((v, i) => v - oa[i]);
    let best: Part | undefined, bd = Infinity;
    for (const p of ps) {
      if (!test(p.id) || p.id.endsWith(":dup") || out.includes(p.id)) continue;
      const a = anchorOf(p), d = Math.hypot(a[0] - ob[0] - pt[0], a[1] - ob[1] - pt[1], a[2] - ob[2] - pt[2]);
      if (d < bd) { bd = d; best = p; }
    }
    if (best && bd <= 2) out.push(best.id);
  }
  return out;
}

/** Пенал с набивным ХДФ: крыша короче сзади на 0,5–120 мм (вентзазор над техникой: k23 m15/m16 — 40 мм) — kitchen.topBack,
 *  то же поле, что у навесных с крышей перед ХДФ (k33, k34). Только пенал: у остальных набивных крыша на всю глубину. */
export function topBackTall(role: string, topPanel: { b: B } | undefined, bottom: { b: B } | undefined, sideZ0: number): number | undefined {
  if (role !== "tall" || !topPanel || topPanel === bottom) return undefined;
  const gap = r1(topPanel.b.z0 - sideZ0);
  return gap > 0.5 && gap <= 120 ? gap : undefined;
}

/** Фигурный контур Базиса у горизонтальной детали корпуса (дно, крыша, полка) с настоящим вырезом (> 200 мм², как в compare.ts):
 *  вырез под вентиляцию в дне пенала k23 m15/m16 (70 точек, 28 800 мм²). Деталь студии — с тем же габаритом (±0,6) — получает
 *  контур в плане от своего угла (kitchen.planContours: id → точки [x, z]). Ключ — id детали студии. */
export function planContoursFromEtalon(P: { p: { axis: string; kind: string; figure?: boolean; contour?: number[][]; contourPlane?: string }; b: B }[], ps: Part[], sideZ0: number): Record<string, [number, number][]> | undefined {
  const out: Record<string, [number, number][]> = {};
  for (const { p, b } of P) {
    if (p.axis !== "y" || p.kind !== "ldsp" || !p.figure || p.contourPlane !== "xz" || !Array.isArray(p.contour) || p.contour.length < 4) continue;
    const c = p.contour as number[][];
    if (c.some((q) => !Array.isArray(q) || q.length < 2 || !Number.isFinite(q[0]) || !Number.isFinite(q[1]))) continue;
    let a = 0; for (let i = 0; i < c.length; i++) { const [x0, z0] = c[i], [x1, z1] = c[(i + 1) % c.length]; a += x0 * z1 - x1 * z0; }
    if ((b.x1 - b.x0) * (b.z1 - b.z0) - Math.abs(a) / 2 <= 200) continue; // скругления — не вырез
    const sb = [b.x0, b.y0, b.z0 - sideZ0, b.x1, b.y1, b.z1 - sideZ0];
    const sp = ps.find((q) => q.material === "board" && q.size[1] < q.size[0] && q.size[1] < q.size[2] && [0, 1, 2].every((i) => Math.abs(q.position[i] - q.size[i] / 2 - sb[i]) <= 0.6 && Math.abs(q.position[i] + q.size[i] / 2 - sb[i + 3]) <= 0.6));
    if (!sp) continue;
    out[sp.id] = c.map(([x, z]) => [r1(x - b.x0), r1(z - b.z0)] as [number, number]);
  }
  return Object.keys(out).length ? out : undefined;
}

/** ХДФ в пазу только над жёсткой полкой (пенал под холодильник k25 m10: ХДФ 1907…2429 за полкой 1906…1922 и крышей, ниже — ниша без задника):
 *  номер жёсткой полки, от низа которой (плюс зазор паза gc ±1) начинается ХДФ. Нет такой полки — undefined. */
export function backFromShelfOf(back: B, shelves: B[], fixed: number[], gc: number): number | undefined {
  return fixed.find((j) => shelves[j] && Math.abs(back.y0 - (shelves[j].y0 + gc)) <= 1 && back.z1 <= shelves[j].z0 + 0.5);
}

/** Полки, у которых в Базисе своя глубина или отступ от задника (не как у первой полки секции): номер → { rear, depth }.
 *  rear — от зоны задника студии (rear0 — z начала полок в координатах Базиса). k23 m14/m17: жёсткая полка 577 на всю глубину корпуса
 *  при съёмных 575 с отступом 1. */
export function shelfAtFromEtalon(shelves: B[], depth: number, rear: number, rear0: number): Record<number, { rear: number; depth: number }> | undefined {
  const own: Record<number, { rear: number; depth: number }> = {};
  shelves.forEach((b, j) => {
    const d = r1(b.z1 - b.z0), r = r1(b.z0 - rear0);
    if (Math.abs(d - depth) > 0.5 || Math.abs(r - rear) > 0.5) own[j] = { rear: r, depth: d };
  });
  return Object.keys(own).length ? own : undefined;
}
