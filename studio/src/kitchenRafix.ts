// Рафикс — «Полкодержатель стяжка РАФИКС» Базиса: крепёж жёсткой полки кухни к стойкам (282 шт. в 30 кухнях, 24 модуля;
// у пеналов — единственный крепёж жёстких полок без полкодержателей, кроме полок на эксцентриках).
// Только для кухонь (m.kitchen.rafix): у шкафов студии жёсткие полки по-прежнему на конфирматах/эксцентриках.
// Шаблон Базиса (сверено на k05, k10, k15, k16, k20, k28, k31 — одинаковый у всех):
//   точка Базиса — торец полки у стойки × нижняя пласть полки, z — по сетке;
//   присадка: корпус D20×13 в нижнюю пласть полки, центр в 9,5 мм от торца; шток D5×13 в стойку на 8 мм выше низа полки.
// Сетка по глубине — от торцов самой полки: крайние в rear/front мм от заднего/переднего торца, n штук на сторону с равным шагом
// (2 шт. — 23 полки из 24 пеналов; k16 — 3 шт. по 57,5 мм от торцов и посередине).
import type { Module, Part } from "./model";

export type RafixGrid = { rear: number; front: number; n: number };
/** Рафиксы кухни: сетка по умолчанию для жёстких полок без своего крепежа и сетки отдельных полок (ключ — номер полки секции, как s.fixed). */
export type KitchenRafix = RafixGrid & { per?: Record<string, RafixGrid>; /** крыша на рафиксах (k20 m09), а не на конфирматах */ top?: RafixGrid };

export const RAFIX = { bodyD: 20, bodyDepth: 13, bodyInset: 9.5, pinD: 5, pinDepth: 13, pinUp: 8 } as const;
/** Модели рафикса (GLB в мм, локальные оси = оси экземпляра Базиса: x — от стойки в полку, y — вниз, 0 — нижняя пласть полки у торца). */
export const RAFIX_MODEL = { housing: "hardware/n5/rafix_housing.glb", pin: "hardware/n5/rafix_pin.glb" } as const;

/** Сетка рафиксов полки: своя (per) или общая модуля; undefined — у модуля рафиксов нет. */
export function rafixGrid(m: Module, shelfIndex: number): RafixGrid | undefined {
  const r = m.kitchen?.rafix;
  if (!r) return undefined;
  const g = r.per?.[String(shelfIndex)];
  return g ?? { rear: r.rear, front: r.front, n: r.n };
}

/** Точки по глубине полки z0..z1 (z1 — передний торец): крайние с отступами rear/front, n штук с равным шагом. */
export function rafixZs(g: RafixGrid, z0: number, z1: number): number[] {
  const a = z0 + g.rear, b = z1 - g.front, n = Math.max(1, Math.round(g.n));
  if (n === 1 || b <= a) return [a];
  return Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));
}

type Add = (id: string, name: string, size: [number, number, number], pos: [number, number, number], length: number, width: number, thickness: number, role: Part["role"], sectionId: string | undefined, material: Part["material"]) => void;

/** Рафиксы одной стороны жёсткой полки hp: корпус в полке (D20×13 от нижней пласти) и шток в стойке (D5×13).
 *  anchor корпуса — точка Базиса (торец полки × нижняя пласть). */
export function rafixSide(add: Add, out: Part[], hp: Part, side: "left" | "right", edgeX: number, dir: 1 | -1, g: RafixGrid) {
  const yb = hp.position[1] - hp.size[1] / 2, z0 = hp.position[2] - hp.size[2] / 2, z1 = hp.position[2] + hp.size[2] / 2;
  rafixZs(g, z0, z1).forEach((z, k) => {
    const id = `rafix:${hp.id}:${side}:${k}`;
    add(id, "Рафикс · полкодержатель-стяжка", [RAFIX.bodyD, RAFIX.bodyDepth, RAFIX.bodyD], [edgeX + dir * RAFIX.bodyInset, yb + RAFIX.bodyDepth / 2, z], RAFIX.bodyD, RAFIX.bodyD, RAFIX.bodyDepth, "fastener", hp.sectionId, "metal");
    out.at(-1)!.anchor = [edgeX, yb, z];
    // поворот как в Базисе (по базе у полок: у левой стойки [0,1,0,0] — 103 из 105, у правой [0,0,0,1] — 101 из 103; n4-tall)
    const quat: [number, number, number, number] = side === "left" ? [0, 1, 0, 0] : [0, 0, 0, 1];
    out.at(-1)!.quat = quat;
    // 3D (n5-hardware3d): у Базиса сетки нет — своя модель (scripts/blender_n5_hardware.py, мм) в точке и повороте Базиса
    out.at(-1)!.model = { file: RAFIX_MODEL.housing, length: "x", native: true, origin: [edgeX, yb, z], quat };
    // шток: от корпуса в стойку на глубину отверстия
    const x0 = edgeX - dir * RAFIX.pinDepth, x1 = edgeX + dir * RAFIX.bodyInset, L = Math.abs(x1 - x0);
    add(`${id}:pin`, "Рафикс · шток", [L, RAFIX.pinD, RAFIX.pinD], [(x0 + x1) / 2, yb + RAFIX.pinUp, z], L, RAFIX.pinD, RAFIX.pinD, "fastener", hp.sectionId, "metal");
    out.at(-1)!.model = { file: RAFIX_MODEL.pin, length: "x", native: true, origin: [edgeX, yb, z], quat };
  });
}

/** Присадка рафикса по точке Базиса (anchor корпуса): D20×13 в нижнюю пласть полки, D5×13 в стойку. */
export function rafixHoles(p: Part, push: (src: string, at: [number, number, number], dir: [number, number, number], d: number, depth: number) => void) {
  if (!p.id.startsWith("rafix:") || p.id.endsWith(":pin") || !p.anchor) return;
  const [ex, ey, ez] = p.anchor, inward = p.position[0] > ex ? 1 : -1;
  push(p.id, [ex + inward * RAFIX.bodyInset, ey, ez], [0, 1, 0], RAFIX.bodyD, RAFIX.bodyDepth);
  push(p.id + ":side", [ex, ey + RAFIX.pinUp, ez], [-inward, 0, 0], RAFIX.pinD, RAFIX.pinDepth);
}

/** Число рафиксов модуля (смета): корпуса без штоков. */
export const rafixCount = (ps: Part[]) => ps.filter((p) => p.id.startsWith("rafix:") && !p.id.endsWith(":pin")).length;

const grid = (x: unknown): RafixGrid | undefined => {
  const g = x as RafixGrid;
  if (!g || typeof g !== "object") return undefined;
  const rear = Number(g.rear), front = Number(g.front), n = Math.round(Number(g.n));
  return Number.isFinite(rear) && Number.isFinite(front) && n >= 1 && n <= 6 ? { rear, front, n } : undefined;
};
/** Разбор сетки по ключам (крепёж стыков кухни kitchen.joints): неверные записи отбрасываются. */
export function parseGridRecord(x: unknown): Record<string, RafixGrid> | undefined {
  if (!x || typeof x !== "object") return undefined;
  const e = Object.entries(x as Record<string, unknown>).flatMap(([k, v]) => { const q = grid(v); return q && /^(bottom|top|shelf:\d+)$/.test(k) ? [[k, q] as const] : []; });
  return e.length ? Object.fromEntries(e) : undefined;
}

/** Разбор сохранённого проекта. */
export function parseKitchenRafix(x: unknown): KitchenRafix | undefined {
  const g = grid(x);
  if (!g) return undefined;
  const per = (x as KitchenRafix).per, out: KitchenRafix = { ...g };
  if (per && typeof per === "object") {
    const e = Object.entries(per).flatMap(([k, v]) => { const q = grid(v); return q && /^\d+$/.test(k) ? [[k, q] as const] : []; });
    if (e.length) out.per = Object.fromEntries(e);
  }
  const top = grid((x as KitchenRafix).top);
  if (top) out.top = top;
  return out;
}

/** Ошибки рафиксов: отступы в пределах полки (не меньше половины корпуса D20). */
export function rafixErrors(m: Module): string[] {
  const r = m.kitchen?.rafix;
  if (!r) return [];
  const all = [r, ...Object.values(r.per ?? {}), ...(r.top ? [r.top] : [])];
  return all.some((g) => g.rear < RAFIX.bodyD / 2 || g.front < RAFIX.bodyD / 2 || g.rear + g.front > m.depth - RAFIX.bodyD) ? ["Рафиксы: отступ от торца полки — от 10 мм и в пределах глубины."] : [];
}
