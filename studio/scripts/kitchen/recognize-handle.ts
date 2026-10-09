// Ручка распашного фасада по проекту Базиса (n4-wall).
// В базе ручки есть только у k07 и k09 («Мебельная ручка рейлинг 128/160», 36 шт.): у навесных — горизонтально по центру
// ширины в 30/40 мм от низа фасада, у нижних — в 31,5 от верха, у части навесных и пеналов — вертикально у свободного края
// в 120 от низа. Правило студии (вертикально посередине высоты) с Базисом не совпадает — место берётся из проекта.
// Сама ручка — тоже Базиса: имя (строка сметы вместо строки Базиса, не сверху неё), сетка библиотеки, поворот и габарит сетки.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { KitchenSpec } from "../../src/kitchen";
import type { RefModule } from "./compare";

type Box = number[];
type Quat = [number, number, number, number];
const r1 = (v: number) => Math.round(v * 10) / 10;
const DIRS = [fileURLToPath(new URL("../../public/models/hardware/bazis/", import.meta.url)), "C:/Users/My PC/Desktop/Claude Project/Кухни/hardware-lib/glb/"];

/** Габарит сетки фурнитуры Базиса (GLB, мм, локальные оси): [вдоль x, y, z] по min/max вершин; нет файла — undefined. */
export function meshSize(mesh: string): [number, number, number] | undefined {
  const f = DIRS.map((d) => `${d}${mesh}.glb`).find((x) => existsSync(x)); if (!f) return undefined;
  const b = readFileSync(f), len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString("utf8")) as { accessors?: { type?: string; min?: number[]; max?: number[] }[] };
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const a of j.accessors ?? []) if (a.type === "VEC3" && a.min && a.max) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], a.min[i]); hi[i] = Math.max(hi[i], a.max[i]); }
  return lo.every(Number.isFinite) ? (lo.map((v, i) => r1(hi[i] - v)) as [number, number, number]) : undefined;
}

const sameQuat = (a: Quat, b: Quat) => Math.abs(a.reduce((s, v, i) => s + v * b[i], 0)) / (Math.hypot(...a) * Math.hypot(...b)) > 0.999;

/** Ручки распашных фасадов модуля: одно место на все фасады, по ручке на каждый фасад (иначе undefined — правило студии).
 *  doors — боксы фасадов-дверей модуля в осях Базиса. */
export function handlePlace(ref: RefModule, doors: Box[]): KitchenSpec["handle"] {
  const hs = ref.hardware.filter((h) => h.category === "ручка");
  if (!hs.length || !doors.length) return undefined;
  const out: { dy: number; from: "bottom" | "top"; horizontal: boolean }[] = [], used = new Set<Box>();
  for (const h of hs) {
    const [x, y, z] = h.pos;
    const b = doors.find((d) => x >= d[0] - 0.5 && x <= d[3] + 0.5 && y >= d[1] - 0.5 && y <= d[4] + 0.5 && Math.abs(z - d[5]) < 1);
    if (!b) continue; // ручка не на двери (ящик, угловой под 45°) — не наш случай
    used.add(b);
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
  // студия ставит ручку на каждую дверь: у Базиса — тоже по одной на каждой (иначе студия добавила бы ручку, которой в Базисе нет)
  if (out.length !== hs.length || used.size !== hs.length || hs.length !== doors.length) return undefined;
  const f = out[0];
  if (!out.every((o) => o.from === f.from && o.horizontal === f.horizontal && Math.abs(o.dy - f.dy) < 0.6)) return undefined;
  // ручка Базиса: имя одно на модуль; сетка и поворот — если у всех ручек одинаковые (иначе только имя: строка сметы как в Базисе)
  const names = new Set(hs.map((h) => h.name.trim()));
  if (names.size !== 1) return undefined;
  const h0 = hs[0], q0 = (h0.quat ?? [1, 0, 0, 0]) as Quat;
  const look = h0.mesh && hs.every((h) => h.mesh === h0.mesh && sameQuat((h.quat ?? [1, 0, 0, 0]) as Quat, q0)) ? { mesh: h0.mesh, quat: q0.map((v) => Math.round(v * 1e4) / 1e4) as Quat, ...(meshSize(h0.mesh) ? { size: meshSize(h0.mesh)! } : {}) } : {};
  const base = { ...f, name: h0.name.trim(), ...look };
  // отверстия под ручку: у каждой ручки 2 одинаковых отверстия с лица фасада симметрично точке ручки (k07); нет — без отверстий (k09)
  const ids = new Set(hs.map((h) => h.i));
  const hl = (ref.holes ?? []).filter((x) => ids.has(x.src as number));
  if (!hl.length) return base;
  if (hl.length !== 2 * hs.length || !hl.every((x) => x.face === "+z" && x.d === hl[0].d && x.depth === hl[0].depth)) return undefined;
  const pair = hl.filter((x) => x.src === h0.i);
  const gap = r1(f.horizontal ? Math.abs(pair[0].at[0] - pair[1].at[0]) : Math.abs(pair[0].at[1] - pair[1].at[1]));
  return { ...base, holes: { d: hl[0].d, depth: hl[0].depth, gap } };
}
