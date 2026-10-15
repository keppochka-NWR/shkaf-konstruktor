// Сушка навесного по Базису: элементы сушилки с сеткой из библиотеки фурнитуры Базиса (TriData → GLB, studio/public/models/hardware/bazis).
// Статистика по 13 навесным с сушкой (09.10.2026): сетка есть только у набора SU01/03 (держатели, решётки, поддоны — k09 m01, k21 m05/m06);
// «Сушка двухуровневая L-600» (k01, k06), «Сушка тарелки/чашки» (k02), «Тело по траектории» (k08) — без сетки. Их геометрию студия
// не выдумывает: как и в Базисе, это элемент фурнитуры в точке проекта без тела — он есть в спецификации и в сверке (n4-wall).
import { unitQuat, type KitchenSpec } from "../../src/kitchen";
import type { RefHardware, RefHole } from "./compare";

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Элементы сушки Базиса: точка привязки — от ближней боковины по X, от низа по Y, от задней кромки боковин по Z; поворот — кватернион Базиса. */
// Элементы комплекта сушки в «прочем» (F_DRYER, статистика 34 кухонь): у «Сушка двухуровневая с регуляцией» — «Вращение» на внутренней грани
// боковины (k06 m07, k25 m14) и «10x13» с отверстием D10×13 в боковину (k25 m14); у NORWIG — «Отверстие 3х2» без отверстия в проекте (k08 m08).
// Точки — из проекта (от ближней боковины, от низа, от задней кромки), как у самой сушки: шаг и высоты уровней у k06 и k25 разные
// (69/329 и 56,4/316,4 от низа, z 35/255 и 69,5/289,5) — правила по сетке нет, паспортов сушек в hardware-lib нет.
const kitOf = (h: RefHardware) => (h as RefHardware & { kit?: string | null }).kit ?? "";
export function wallDryer(hardware: RefHardware[], W: number, sideZ0: number, holes: RefHole[] = []): { dryer?: NonNullable<KitchenSpec["dryer"]>; notes: string[] } {
  const items = hardware.filter((h) => h.category === "сушка" || (h.category === "прочее" && /^Сушка/.test(kitOf(h))));
  const notes = items.filter((h) => !h.mesh && h.category === "сушка").map((h) => `сушка «${h.name}» в Базисе без сетки — в студии точка без геометрии, как в Базисе`);
  if (!items.length) return { notes };
  return {
    notes,
    dryer: items.map((h) => {
      const left = h.pos[0] <= W / 2;
      // кватернион Базиса округлён до 0,01 — нормируем (иначе сетка растянута и скошена на ~0,8 %)
      return { name: h.name, ...(h.mesh ? { mesh: h.mesh } : {}), side: left ? "left" : "right", x: r1(left ? h.pos[0] : W - h.pos[0]), y: r1(h.pos[1]), z: r1(h.pos[2] - sideZ0), quat: unitQuat((h.quat ?? [1, 0, 0, 0]) as [number, number, number, number]), ...fixOf(h) };
    }),
  };
  function fixOf(h: RefHardware): { fix?: true; hole?: [number, number] } {
    if (h.category !== "прочее") return {};
    const hs = holes.filter((x) => x.src === h.i);
    return { fix: true, ...(hs.length === 1 ? { hole: [hs[0].d, hs[0].depth] as [number, number] } : {}) };
  }
}
