// Пеналы под технику эталонов Базиса, построенные генератором студии kitchenTallColumn (w-kitchen, 22.10.2026): общий код для
// tests/kitchen-tall-column.test.ts и сверки. Эталоны — tests/fixtures/kitchen-ref/kNN-mNN.json (только числа).
// Конструкция (дно, крыша, вентканал 50, ХДФ в пазу 46 над техникой и за ящиком, жёсткие полки ниш, фасады) — генератором;
// из проекта берутся только материалы и крепёж кухни (фасадный материал и толщина, кромка, отступ конфирматов, опоры, эксцентрики
// по сторонам) — как в cornerEtalons.ts.
import { readFileSync } from "node:fs";
import { initialModule, type Module } from "../../src/model";
import { kitchenTallColumn, configureColumn } from "../../src/kitchenTall";
import { moduleFromEtalon } from "./fromEtalon";
import type { RefModule } from "./compare";

export const tallRef = (name: string) => JSON.parse(readFileSync(new URL(`../../tests/fixtures/kitchen-ref/${name}.json`, import.meta.url), "utf8")) as RefModule;

function withProjectMaterials(m: Module, imp: Module) {
  Object.assign(m, { facadeMaterial: imp.facadeMaterial, facadeT: imp.facadeT, faceAir: imp.faceAir, faceGap: imp.faceGap, faceGapBetween: imp.faceGapBetween, edgeScheme: imp.edgeScheme, confirmatInset: imp.confirmatInset, noHandles: imp.noHandles, decor: imp.decor, facadeDecor: imp.facadeDecor });
  if (imp.jointFastening) m.jointFastening = Object.fromEntries(Object.entries(imp.jointFastening).map(([k, v]) => [k.replace(imp.sections[0].id, m.sections[0].id), v]));
  if (imp.dowels) m.dowels = imp.dowels;
  m.kitchen!.legs = imp.kitchen!.legs; m.kitchen!.plinth = imp.kitchen!.plinth;
}

/** k25 m10 «Пенал 600 (Холодильник)» 600×2430×579: генератор с нишей 1790 (у шаблона 1780) и высотой проекта. */
export function k25Fridge(): Module {
  const r = tallRef("k25-m10"), imp = moduleFromEtalon(r).module, m = kitchenTallColumn(initialModule(), 600, "fridge");
  m.height = imp.height; withProjectMaterials(m, imp);
  configureColumn(m, { niche: 1790 });
  return m;
}

/** k14 m08 «Пенал под духовку» 600×2400×576: генератор с опорной полкой 479,5, нишами 584 и 372 и высотой проекта.
 *  Ящик под духовкой в проекте — короб ЛДСП Firmax (у шаблона Versalite), петли справа — берутся из проекта (asProject). */
export function k14Oven(asProject = true): Module {
  const r = tallRef("k14-m08"), imp = moduleFromEtalon(r).module, m = kitchenTallColumn(initialModule(), 600, "oven");
  m.height = imp.height; withProjectMaterials(m, imp);
  configureColumn(m, { support: 479.5, ovenNiche: 584, mwNiche: 372 });
  if (asProject) {
    m.kdrawers = imp.kdrawers; m.sections[0].hingeSide = imp.sections[0].hingeSide;
    if (imp.sections[0].shelfAt) m.sections[0].shelfAt = imp.sections[0].shelfAt;
    if (imp.kitchen!.joints) m.kitchen!.joints = imp.kitchen!.joints;
  }
  return m;
}
