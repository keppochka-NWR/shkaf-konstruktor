// Нижние угловые эталонов Базиса, построенные генератором студии kitchenBaseCorner (shop-kcorner, 21.10.2026): общий код для
// tests/kitchen-corner.test.ts и scripts/kitchen/corner-trio.ts. Эталоны — tests/fixtures/kitchen-ref/kNN-mNN.json (только числа).
import { readFileSync } from "node:fs";
import { initialModule, type Module } from "../../src/model";
import { kitchenBaseCorner, kitchenWallCorner } from "../../src/kitchenCorner";
import type { RefModule } from "./compare";

export const cornerRef = (name: string) => JSON.parse(readFileSync(new URL(`../../tests/fixtures/kitchen-ref/${name}.json`, import.meta.url), "utf8")) as RefModule;

/** k02 m01 («НКПМ» 800×762×460): материалы кухни k02 (фасад — плита 18 стороннего материала, кромка фасада 1, корпус 0,5, конфирматы
 *  в 54 от кромок), опоры шаблона «НКПМ» и цоколь ряда (в модуле цоколя нет) — так стоят в проекте Базиса. */
export function k02Corner(): Module {
  const m = kitchenBaseCorner(initialModule(), { width: 800, height: 762, depth: 460, side: "right", door: 400, hingeY: [100, 548] });
  Object.assign(m, { facadeMaterial: "external", facadeT: 18, facadeEdge: 1, edgeScheme: { t: 0.5 }, confirmatInset: 54, noHandles: true });
  m.kitchen!.legs = { back: 70, front: 89, pts: [[65, 371], [70, 70]], ptsR: [[75, 371], [70, 70]] };
  m.kitchen!.plinth = { height: 95, off: true };
  return m;
}

/** k27 m09 («НМУ» 1090×870×537): тем же генератором — дверь 578, фальш до края, зазор фасадов 2, верх фасадов на 30 ниже корпуса, две
 *  царги лёжа 80 (передняя утоплена на 24,5), стойка-упор. Шаблон Базиса «НМУ» сверх k02: правая боковина короче сзади на 160, дно во всю
 *  глубину с вырезом за ней, фальш от низа дна с вырезом 467×88 сверху у края, вырез 48×24,5 R2 в левой боковине спереди сверху (контуры —
 *  числа эталона), крепёж фальша по своей сетке (головка утоплена: D8×16 при фальше 18, D5×42), 6 опор не сеткой, конфирматы корпуса
 *  в 60,5 от кромок. */
export function k27Corner(): Module {
  const r = cornerRef("k27-m09"), m = kitchenBaseCorner(initialModule(), { width: 1090, height: 870, depth: 537, side: "right", door: 578, inset: 0, join: false });
  Object.assign(m, { facadeMaterial: "external", facadeT: 18, facadeEdge: 1, edgeScheme: { t: 0.5 }, faceGap: 2, faceGapBetween: 4, noHandles: true, confirmatInset: 60.5,
    rails: [{ place: "front-top", height: 80, lay: "flat", setback: 24.5 }, { place: "rear-top", height: 80, lay: "flat" }] });
  m.sections[0].hingeY = [100, 588]; m.sections[0].hingeYFor = 738;
  Object.assign(m.kitchen!, { faceTop: 30, plinth: { height: 95, off: true }, sideRecess: { side: "right", back: 160, bottomFull: true },
    planContours: { bottom: [[0, 537], [1090, 537], [1090, 160], [750, 160], [750, 0], [0, 0]] },
    legs: { back: 70, front: 70, same: true, pts: [[49, -108], [49, 288], [370, -40]], ptsR: [[455, 185], [45, 90], [49, 288]] },
    cornerStop: { x: 71.5, depth: 101.5, confDepth: 42 },
    faceContours: { left: r.panels[6].contour!.map((q) => [q[0] - 116, q[1]]), "face-filler:fp:facade": r.panels[0].contour!.map((q) => [q[0] - 578, q[1] - 100]) },
    faceContourEdges: { left: [0, 0.5, ...Array(18).fill(0), 0.5, 0.5] } });
  m.kitchen!.faceFiller = { ...m.kitchen!.faceFiller!, conf: { bottom: [64, 448], side: [78, 334, -180] }, confDepth: 42, confHead: 16, down: true };
  return m;
}

/** k25 m18 («ВМУгловой» 1071×930×336, навесной угловой прямой): генератор kitchenWallCorner — фальш ЛДСП 320 справа, планка 59,
 *  две двери; материалы кухни k25 (фасад 19, зазоры фасадов 1,5 / 3). */
export function k25WallCorner(): Module {
  const m = kitchenWallCorner(initialModule(), { width: 1071, height: 930, depth: 320, side: "right", filler: 320, strip: 59 });
  Object.assign(m, { facadeT: 19, faceAir: 0, noHandles: true, facadeMaterial: "external", facadeEdge: 0, edgeScheme: { t: 1 }, confirmatInset: 64 });
  // две полки на высотах проекта (середина 300 и 611 при корпусе 16…914), глубина 297, полкодержатели в 52,5 от кромок полки
  const box = 914 - 16;
  m.sections[0] = { ...m.sections[0], shelves: [(300 - 16) / box, (611 - 16) / box], shelfDepth: 297 };
  m.shelfPinInset = 52.5;
  return m;
}
