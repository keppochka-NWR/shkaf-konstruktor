// Водопад столешницы (барная стойка, остров): галочки «Водопад слева / справа» панели столешницы — на уровне проекта, потому что
// боковина может не поместиться над низами. Боковина стоит ВНУТРИ длины столешницы (kitchen.ts waterfallParts):
// — если под краем столешницы свободно (длину уже задали с запасом под боковины) — длина не меняется;
// — если там нижний корпус — столешница удлиняется на толщину в эту сторону (боковина встаёт снаружи корпуса, торец сдвигается).
// Снятие галочки длину не меняет (свес на толщину камня менеджер правит полем «Длина»).
import { localToRoom, projectErrors, type PlacedModule, type Project } from "./project";
import { setWaterfall, worktopSolid } from "./kitchen";
import { transform } from "./roomGeometry";

export type WaterfallSide = "left" | "right";

/** Высота водопада «до пола»: низ столешницы над полом. */
export const waterfallFloorDrop = (a: Pick<PlacedModule, "y">) => Math.round(a.y ?? 0);

/** Включить/снять водопад стороны столешницы id. Бросает понятную ошибку, если поставить нельзя. */
export function toggleWaterfall(p: Project, id: string, side: WaterfallSide, on: boolean): Project {
  const a = p.modules.find((x) => x.id === id);
  const w = a?.module.worktop;
  if (!a || !w) throw Error("Столешница не найдена.");
  if (!!w.waterfall?.[side] === on) return p;
  if (on && !worktopSolid(w)) throw Error("Водопад — только у цельной столешницы (компакт, акрил, кварц). Сначала смените материал.");
  const floor = waterfallFloorDrop(a);
  if (on && floor < 50 && !w.waterfall) throw Error("Столешница почти на полу: водопаду некуда опускаться.");
  const before = new Set(projectErrors(p, true));
  const build = (grow: boolean): Project => {
    const m = structuredClone(a.module);
    setWaterfall(m, side, on, floor);
    const n: PlacedModule = { ...a, module: m };
    if (grow) {
      // левый торец уходит влево на толщину, правый — вправо; положение остального не меняется (и при повороте модуля)
      const anchor = localToRoom(a, side === "left" ? -w.thickness : 0, 0);
      m.width += w.thickness;
      const o = transform(0, 0, m.width, m.depth, a.rotation ?? 0, 0, 0);
      n.x = anchor.x - o.x; n.z = anchor.z - o.z;
    }
    return { ...p, modules: p.modules.map((x) => (x.id === id ? n : x)) };
  };
  const fresh = (q: Project) => projectErrors(q, true).filter((e) => !before.has(e));
  const inPlace = build(false);
  if (!on || !fresh(inPlace).length) return inPlace;
  const grown = build(true);
  const errs = fresh(grown);
  if (!errs.length) return grown;
  throw Error(errs[0]);
}
