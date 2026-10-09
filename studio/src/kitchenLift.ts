// Газлифт подъёмного фасада кухни — как в проектах Базиса цеха (разбор k10/m03 «А 2», k15/m12 «А 1», 09.10.2026).
// Комплект PD-G-N02 на каждую боковину: шток и газблок (сетки Базиса), фиксатор на фасад (2 самореза 3×4),
// фиксатор на боковину (3 самореза 3×3). Привязка — от верхней кромки фасада, тыльной плоскости фасада и внутренней грани боковины:
//   фиксатор на фасад — 12 мм от грани боковины внутрь, 90,5 мм ниже верха фасада, на тыльной плоскости фасада;
//   фиксатор на боковину — на грани боковины, 254,5 мм ниже верха фасада, 25 мм вглубь от тыльной плоскости фасада;
//   шток — 4 мм в боковину от её грани, 0,36 мм ниже фиксатора; газблок — на высоте фиксатора фасада, 16 мм вглубь от фасада.
// Кватернионы [w, x, y, z] и сетки — из узлов Базиса без пересчёта. Только для кухонь (m.kitchen) и фасада с петлями по верху.
import type { Module, Part } from "./model";
import { qrot, type Quat } from "./quat";

export type KitchenLift = { system: "pd-g-n02" };
export const LIFT_SYSTEMS: Record<KitchenLift["system"], { label: string }> = { "pd-g-n02": { label: "Газлифт PD-G-N02" } };
export const LIFT = { faceDown: 90.5, sideDown: 254.5, sideBack: 25, blockBack: 16, rodInto: 4, rodDown: 0.36, rodBack: 0.02, faceIn: 12, faceScrewDy: 14, faceScrewZ: 1.5 } as const;

type V3 = [number, number, number];
const n4 = (q: Quat): Quat => { const l = Math.hypot(...q); return q.map((v) => v / l) as Quat; };
// Сетки Базиса (studio/public/models/hardware/bazis) и их габариты в локальных осях (по GLB).
const MESH = {
  rod: { right: "ee29a9ca1bcc", left: "7fec98cf9820", lo: [-8.3, -12, 9.9] as V3, hi: [8.3, 117.5, 26.2] as V3, name: "Шток" },
  block: { right: "0f84fad7cdd0", left: "fb6defba5e8e", lo: [-8.3, -139.5, 9.9] as V3, hi: [8.3, 12, 26.2] as V3, name: "Газблок" },
  face: { right: "6d1bb0395602", left: "f248f3ccf279", lo: [-7.5, -25.5, 0] as V3, hi: [7.5, 25.5, 21] as V3, name: "Фиксатор на фасад" },
  side: { right: "554528e96219", left: "36e6ccc7f223", lo: [-14.5, -14.5, 0] as V3, hi: [14.5, 14.5, 9.9] as V3, name: "Фиксатор на боковину" },
} as const;
const Q: Record<"left" | "right", Record<keyof typeof MESH, Quat>> = {
  right: { rod: n4([0.71, 0.02, -0.71, -0.02]), block: n4([0.71, 0.02, -0.71, -0.02]), face: [0, 0, -1, 0], side: [Math.SQRT1_2, 0, -Math.SQRT1_2, 0] },
  left: { rod: n4([0.71, 0.02, 0.71, 0.02]), block: n4([0.71, 0.02, 0.71, 0.02]), face: [0, 0, 1, 0], side: [Math.SQRT1_2, 0, Math.SQRT1_2, 0] },
};
/** Габаритный короб сетки в осях модуля (по 8 углам, повёрнутым кватернионом). */
export function meshBox(o: V3, q: Quat, lo: V3, hi: V3): { size: V3; position: V3 } {
  const a: V3 = [Infinity, Infinity, Infinity], b: V3 = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 8; k++) {
    const v = qrot(q, [k & 1 ? hi[0] : lo[0], k & 2 ? hi[1] : lo[1], k & 4 ? hi[2] : lo[2]]);
    for (let i = 0; i < 3; i++) { a[i] = Math.min(a[i], o[i] + v[i]); b[i] = Math.max(b[i], o[i] + v[i]); }
  }
  return { size: [b[0] - a[0], b[1] - a[1], b[2] - a[2]], position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] };
}
export const isLiftPart = (p: Part) => p.id.startsWith("lift:");

/** Детали газлифта: по комплекту на каждую боковину у фасада с петлями по верху. */
export function kitchenLiftParts(m: Module, out: Part[]) {
  if (!m.kitchen || !m.kitchenLift) return;
  const door = out.find((p) => p.role === "door" && p.id.includes(":door:") && p.hinge === "top" && !p.rotY);
  if (!door) return;
  const L = out.find((p) => p.id === "left"), R = out.find((p) => p.id === "right");
  if (!L || !R) return;
  const top = door.position[1] + door.size[1] / 2, back = door.position[2] - door.size[2] / 2;
  const label = LIFT_SYSTEMS[m.kitchenLift.system].label;
  const part = (id: string, name: string, box: { size: V3; position: V3 }, model?: Part["model"], anchor?: V3): Part => ({
    id, name, size: box.size, position: box.position, length: Math.max(...box.size), width: [...box.size].sort((a, c) => c - a)[1], thickness: Math.min(...box.size),
    role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0], sectionId: door.sectionId, ...(model ? { model } : {}), ...(anchor ? { anchor } : {}) });
  for (const side of ["left", "right"] as const) {
    const sp = side === "left" ? L : R, dir = side === "left" ? 1 : -1, inner = sp.position[0] + dir * sp.size[0] / 2;
    const yF = top - LIFT.faceDown, yS = top - LIFT.sideDown, zS = back - LIFT.sideBack;
    const at: Record<keyof typeof MESH, V3> = {
      rod: [inner - dir * LIFT.rodInto, yS - LIFT.rodDown, zS - LIFT.rodBack],
      block: [inner - dir * LIFT.rodInto, yF, back - LIFT.blockBack],
      face: [inner + dir * LIFT.faceIn, yF, back],
      side: [inner, yS, zS],
    };
    for (const k of Object.keys(MESH) as (keyof typeof MESH)[]) {
      const mm = MESH[k], q = Q[side][k];
      out.push(part(`lift:${side}:${k}`, `${label} · ${mm.name}`, meshBox(at[k], q, mm.lo, mm.hi), { file: `hardware/bazis/${mm[side]}.glb`, length: "y", native: true, origin: at[k], quat: q }));
    }
    // саморезы фиксаторов (в Базисе — «3x4» в фасаде и «3x3» в боковине, без сеток)
    for (const dy of [14, -14]) { const o: V3 = [at.face[0], yF + dy, back - LIFT.faceScrewZ]; out.push(part(`lift:${side}:screw:f${dy > 0 ? 0 : 1}`, "Саморез 3×4 (фиксатор газлифта на фасад)", { size: [3, 3, 4], position: [o[0], o[1], back + 0.5] }, undefined, o)); }
    ([[-5, -8.66], [10, 0], [-5, 8.66]] as const).forEach(([dy, dz], n) => { const o: V3 = [inner, yS + dy, zS + dz]; out.push(part(`lift:${side}:screw:s${n}`, "Саморез 3×3 (фиксатор газлифта на боковину)", { size: [3, 3, 3], position: [inner + dir * 0.75, o[1], o[2]] }, undefined, o)); });
  }
}
/** Ошибки поля kitchenLift (validate): только кухня и только при фасаде с петлями по верху. */
export function kitchenLiftErrors(m: Module): string[] {
  if (!m.kitchenLift) return [];
  const e: string[] = [];
  if (!m.kitchen) e.push("Газлифт задаётся только кухонному модулю.");
  if (!(m.kitchenLift.system in LIFT_SYSTEMS)) e.push("Неизвестная система газлифта.");
  if (!m.sections.some((s) => s.doorHinges?.includes("top"))) e.push("Газлифт нужен фасаду с петлями по верху (подъёмному).");
  return e;
}
export function parseKitchenLift(x: unknown): KitchenLift | undefined {
  if (!x || typeof x !== "object") return undefined;
  const s = (x as { system?: unknown }).system;
  return s === "pd-g-n02" ? { system: s } : undefined;
}
