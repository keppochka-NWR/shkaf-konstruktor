// Место ручки распашного фасада по проекту Базиса (n4-wall).
// В базе ручки есть только у k07 и k09 («Мебельная ручка рейлинг 128/160», 36 шт.): у навесных — горизонтально по центру
// ширины в 30/40 мм от низа фасада, у нижних — в 31,5 от верха, у части навесных и пеналов — вертикально у свободного края
// в 120 от низа. Правило студии (вертикально посередине высоты) с Базисом не совпадает — место берётся из проекта.
import type { KitchenSpec } from "../../src/kitchen";
import type { RefModule } from "./compare";

type Box = number[];
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Место ручек распашных фасадов модуля: одно на все фасады (иначе undefined — правило студии).
 *  doors — боксы фасадов-дверей модуля в осях Базиса. */
export function handlePlace(ref: RefModule, doors: Box[]): KitchenSpec["handle"] {
  const hs = ref.hardware.filter((h) => h.category === "ручка");
  if (!hs.length || !doors.length) return undefined;
  const out: { dy: number; from: "bottom" | "top"; horizontal: boolean }[] = [];
  for (const h of hs) {
    const [x, y, z] = h.pos;
    const b = doors.find((d) => x >= d[0] - 0.5 && x <= d[3] + 0.5 && y >= d[1] - 0.5 && y <= d[4] + 0.5 && Math.abs(z - d[5]) < 1);
    if (!b) continue; // ручка не на двери (ящик, угловой под 45°) — не наш случай
    const q = h.quat ?? [1, 0, 0, 0];
    // ось ручки Базиса — x; поворот на 90° вокруг z (|w|≈|z|≈0,71) — вертикальная, без поворота или на 180° — горизонтальная
    const vertical = Math.abs(Math.abs(q[0]) - Math.SQRT1_2) < 0.05 && Math.abs(Math.abs(q[3]) - Math.SQRT1_2) < 0.05;
    const horizontal = !vertical && Math.abs(q[1]) < 0.05 && Math.abs(q[2]) < 0.05;
    if (!vertical && !horizontal) return undefined;
    const cx = (b[0] + b[3]) / 2;
    if (horizontal && Math.abs(x - cx) > 0.6) return undefined; // горизонтальная не по центру — правила нет
    if (vertical && Math.abs(Math.abs(x - cx) - ((b[3] - b[0]) / 2 - 40)) > 0.6) return undefined; // вертикальная — в 40 от края, как у студии
    const dB = y - b[1], dT = b[4] - y;
    out.push(dB <= dT ? { dy: r1(dB), from: "bottom", horizontal } : { dy: r1(dT), from: "top", horizontal });
  }
  if (out.length !== hs.length) return undefined;
  const f = out[0];
  if (!out.every((o) => o.from === f.from && o.horizontal === f.horizontal && Math.abs(o.dy - f.dy) < 0.6)) return undefined;
  // отверстия под ручку: у каждой ручки 2 одинаковых отверстия с лица фасада симметрично точке ручки (k07); нет — без отверстий (k09)
  const ids = new Set(hs.map((h) => h.i));
  const hl = (ref.holes ?? []).filter((x) => ids.has(x.src as number));
  if (!hl.length) return f;
  if (hl.length !== 2 * hs.length || !hl.every((x) => x.face === "+z" && x.d === hl[0].d && x.depth === hl[0].depth)) return undefined;
  const h0 = hs[0], pair = hl.filter((x) => x.src === h0.i);
  const gap = r1(f.horizontal ? Math.abs(pair[0].at[0] - pair[1].at[0]) : Math.abs(pair[0].at[1] - pair[1].at[1]));
  return { ...f, holes: { d: hl[0].d, depth: hl[0].depth, gap } };
}
