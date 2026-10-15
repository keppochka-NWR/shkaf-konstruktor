// Газлифт подъёмного фасада кухни — как в проектах Базиса цеха (разбор k10/m03 «А 2», k15/m12 «А 1», 09.10.2026).
// Комплект PD-G-N02 на каждую боковину: шток и газблок (сетки Базиса), фиксатор на фасад (2 самореза 3×4),
// фиксатор на боковину (3 самореза 3×3). Привязка — от верхней кромки фасада, тыльной плоскости фасада и внутренней грани боковины:
//   фиксатор на фасад — 12 мм от грани боковины внутрь, 90,5 мм ниже верха фасада, на тыльной плоскости фасада;
//   фиксатор на боковину — на грани боковины, 254,5 мм ниже верха фасада, 25 мм вглубь от тыльной плоскости фасада;
//   шток — 4 мм в боковину от её грани, 0,36 мм ниже фиксатора; газблок — на высоте фиксатора фасада, 16 мм вглубь от фасада.
// Кватернионы [w, x, y, z] и сетки — из узлов Базиса без пересчёта. Только для кухонь (m.kitchen) и фасада с петлями по верху.
import type { Module, Part } from "./model";
import { qrot, type Quat } from "./quat";

export type KitchenLift = { system: "pd-g-n02" | "gl104" };
export const LIFT_SYSTEMS: Record<KitchenLift["system"], { label: string }> = { "pd-g-n02": { label: "Газлифт PD-G-N02" }, "gl104": { label: "Газлифт GL104" } };
// Газлифт GL104 с фиксацией положения (комплект Базиса «Газовые лифты с фиксацией положения GL104, 50Н») — по всей базе
// (corpus 447 файлов, 34 кухни) только k01 m11–m13: антресоли 800/600×350×467, накладной фасад, комплект на каждую боковину:
// шток «Шток для GL 104», «Газ патрон», «Кронштейн на боковину» (3 самореза D3×3 в боковину), «Кронштейн на фасад» (2 D3×3 в фасад).
// Во всех трёх точки одинаковы в осях модуля: x — от внутренней грани боковины внутрь, y — от низа боковины, z — от тыльной
// плоскости фасада. Высота у всех трёх одна (350), поэтому выбор опоры «от низа» статистикой не проверен: комплект жёсткий
// (кронштейн на боковину внизу, шток и патрон на нём), верх фасада у k01 m13 на 0,5 выше — точки те же, значит не «от верха фасада».
// Паспорта GL104 в hardware-lib нет — размеры только из узлов Базиса (сетки и точки), без допущений сверх них.
export const GL104 = { rod: [10, 21.65, -35.55], block: [10, 97, -30], side: [0, 99, -25], face: [14, 268.5, 0],
  sideScrews: [[1, 9.81], [9, -5.2], [-9, -5.2]], faceScrewDy: 16 } as const;
export const LIFT = { faceDown: 90.5, sideDown: 254.5, sideBack: 25, blockBack: 16, rodInto: 4, rodDown: 0.36, rodBack: 0.02, faceIn: 12, faceScrewDy: 14, faceScrewZ: 1.5 } as const;

type V3 = [number, number, number];
const n4 = (q: Quat): Quat => { const l = Math.hypot(...q); return q.map((v) => v / l) as Quat; };
// Сетки Базиса (studio/public/models/hardware/bazis) и их габариты в локальных осях (по GLB).
const MESH = {
  rod: { right: "ee29a9ca1bcc", left: "7fec98cf9820", lo: [-8.3, -12, 9.9] as V3, hi: [8.3, 117.5, 26.2] as V3, name: "Шток" },
  block: { right: "0f84fad7cdd0", left: "fb6defba5e8e", lo: [-8.3, -139.5, 9.9] as V3, hi: [8.3, 12, 26.2] as V3, name: "Газблок" },
  face: { right: "6d1bb0395602", left: "f248f3ccf279", lo: [-7.5, -25.5, 0] as V3, hi: [7.5, 25.5, 21] as V3, name: "Фиксатор на фасад" },
  // левый фиксатор на боковину: в эталонах cd44e1c91574 — 18 из 28 (k15/m12 и др.), 36e6ccc7f223 — 10 (k10); геометрия одна (manifest sameGeometry)
  side: { right: "554528e96219", left: "cd44e1c91574", lo: [-14.5, -14.5, 0] as V3, hi: [14.5, 14.5, 9.9] as V3, name: "Фиксатор на боковину" },
} as const;
const Q: Record<"left" | "right", Record<keyof typeof MESH, Quat>> = {
  right: { rod: n4([0.71, 0.02, -0.71, -0.02]), block: n4([0.71, 0.02, -0.71, -0.02]), face: [0, 0, -1, 0], side: [Math.SQRT1_2, 0, -Math.SQRT1_2, 0] },
  left: { rod: n4([0.71, 0.02, 0.71, 0.02]), block: n4([0.71, 0.02, 0.71, 0.02]), face: [0, 0, 1, 0], side: [Math.SQRT1_2, 0, Math.SQRT1_2, 0] },
};
// GL104: сетки левая/правая — зеркальные (свои габариты по GLB), кватернионы — из узлов Базиса k01 m11.
const GL_MESH = {
  rod: { name: "Шток для GL 104", left: { id: "5472ded6ddb1", lo: [-257.5, -9.75, 0], hi: [-130.5, 9.75, 20] }, right: { id: "31f183827b28", lo: [130.5, -9.75, 0], hi: [257.5, 9.75, 20] } },
  block: { name: "Газ патрон", left: { id: "27755269a0ac", lo: [-130.5, -9.85, 0], hi: [18.5, 9.85, 20] }, right: { id: "85e782489f97", lo: [-18.5, -9.85, 0], hi: [130.5, 9.85, 20] } },
  side: { name: "Кронштейн на боковину", left: { id: "0e5165c76171", lo: [-15.5, -15.42, 0], hi: [15.5, 15.42, 20.5] }, right: { id: "2e1055a4b381", lo: [-15.5, -15.42, 0], hi: [15.5, 15.42, 20.5] } },
  face: { name: "Кронштейн на фасад", left: { id: "51e40f387d5b", lo: [-11.75, -25.5, 0], hi: [6.75, 25.5, 21.5] }, right: { id: "a60c89f79136", lo: [-6.75, -25.5, 0], hi: [11.75, 25.5, 21.5] } },
} as const;
const GL_Q: Record<"left" | "right", Record<keyof typeof GL_MESH, Quat>> = {
  left: { rod: n4([0.52, -0.48, 0.52, -0.48]), block: n4([0.52, -0.48, 0.52, -0.48]), side: n4([0.68, 0.18, 0.68, 0.18]), face: [0, 0, 1, 0] },
  right: { rod: n4([0.52, -0.48, -0.52, 0.48]), block: n4([0.52, -0.48, -0.52, 0.48]), side: n4([0.68, 0.18, -0.68, -0.18]), face: [0, 0, 1, 0] },
};
/** Верх кронштейна GL104 на фасаде от низа боковины: фасад должен его перекрывать. */
export const GL_FACE_TOP = GL104.face[1] + GL_MESH.face.left.hi[1];
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
  if (m.kitchenLift.system === "gl104") {
    for (const side of ["left", "right"] as const) {
      const sp = side === "left" ? L : R, dir = side === "left" ? 1 : -1, inner = sp.position[0] + dir * sp.size[0] / 2, bot = sp.position[1] - sp.size[1] / 2;
      for (const k of Object.keys(GL_MESH) as (keyof typeof GL_MESH)[]) {
        const [dx, dy, dz] = GL104[k], at: V3 = [inner + dir * dx, bot + dy, back + dz], mm = GL_MESH[k][side], q = GL_Q[side][k];
        out.push(part(`lift:${side}:gl-${k}`, `${label} · ${GL_MESH[k].name}`, meshBox(at, q, mm.lo as unknown as V3, mm.hi as unknown as V3), { file: `hardware/bazis/${mm.id}.glb`, length: "y", native: true, origin: at, quat: q }));
      }
    }
    return;
  }
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
/** Низ комплекта от верха фасада: фиксатор на боковину (254,5 ниже верха + половина сетки 14,5) — самая низкая деталь (шток ниже верха на 266,86). */
export const LIFT_DROP = LIFT.sideDown + Math.max(-MESH.side.lo[1], LIFT.rodDown - MESH.rod.lo[1], 5 + 1.5);
/** Геометрия корпуса для проверки газлифта (из model.ts, чтобы не тянуть цикл импорта). */
export type LiftGeometry = { facadeTop: number; innerBottom: number; leaves: (s: Module["sections"][number]) => number; carcassBottom?: number; innerTop?: number };
/** Ошибки поля kitchenLift (validate): только кухня, один накладной подъёмный фасад в одну створку, и газлифт не входит в дно. */
export function kitchenLiftErrors(m: Module, g?: LiftGeometry): string[] {
  if (!m.kitchenLift) return [];
  const e: string[] = [];
  if (!m.kitchen) e.push("Газлифт задаётся только кухонному модулю.");
  if (!(m.kitchenLift.system in LIFT_SYSTEMS)) e.push("Неизвестная система газлифта.");
  const tops = m.doors ? m.sections.reduce((n, s) => n + (s.doorHinges ?? []).slice(0, g ? g.leaves(s) : 4).filter((h) => h === "top").length, 0) : 0;
  if (!tops) e.push("Газлифт нужен фасаду с петлями по верху (подъёмному).");
  const label = LIFT_SYSTEMS[m.kitchenLift.system]?.label ?? "Газлифт";
  if (tops > 1) e.push(`${label} по Базису ставится на один подъёмный фасад в одну створку (комплект на каждую боковину).`);
  if (m.doorMount === "inset") e.push(`${label} по Базису — только для накладного подъёмного фасада (у вкладного петли на крыше не ставятся).`);
  if (m.kitchenLift.system === "gl104") {
    // кронштейн на фасад стоит от низа боковины (k01 m11–m13) — фасад должен его перекрывать
    // и не входит в крышу: верх кронштейна (294 от низа боковины) не выше нижней пласти крыши (прогон высот 280–420: при 300–305 кронштейн входил в крышу тихо)
    if (g && Math.min(g.facadeTop, g.innerTop ?? Infinity) < (g.carcassBottom ?? 0) + GL_FACE_TOP - 1e-6) e.push(`Газлифт GL104: кронштейн на фасад стоит на ${GL104.face[1]} мм от низа боковины — фасад и низ крыши — не ниже ${Math.ceil(GL_FACE_TOP)} мм от низа корпуса.`);
  } else if (g && g.facadeTop - LIFT_DROP < g.innerBottom - 1e-6) {
    const minH = Math.ceil(m.height + g.innerBottom - (g.facadeTop - LIFT_DROP));
    e.push(`Газлифт PD-G-N02: фиксатор на боковину стоит на ${LIFT.sideDown} мм ниже верха фасада и входит в дно — высота корпуса от ${minH} мм.`);
  }
  return e;
}
/** После смены открывания: газлифт без подъёмного фасада снимается (иначе правку нельзя сохранить). */
export function syncKitchenLift(m: Module) {
  if (m.kitchenLift && !m.sections.some((s) => s.doorHinges?.includes("top"))) delete m.kitchenLift;
}
export function parseKitchenLift(x: unknown): KitchenLift | undefined {
  if (!x || typeof x !== "object") return undefined;
  const s = (x as { system?: unknown }).system;
  return s === "pd-g-n02" || s === "gl104" ? { system: s } : undefined;
}
