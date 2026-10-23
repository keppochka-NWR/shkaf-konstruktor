// Смета и раскрой по всем проектам-шкафам (примеры, заказы, локальные проекты): npx tsx scripts/estimate-all.ts [out.json]
// Для сравнения «до/после» правки правил: стоимость, листы ЛДСП, площадь деталей ЛДСП, полкодержатели. Имена клиентов маскируются.
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseProject } from "../src/project";
import { estimate } from "../src/pricing";
import { nest } from "../src/exports";
import { isWardrobeImportFile, maskPersonal } from "./wardrobe/files";

const res: Record<string, { cost: number; retail: number | null; sheets: number; area: number; holders: number }> = {};
for (const dir of ["examples", "examples/orders", "public/local-projects"]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) if (f.endsWith(".json") && !f.startsWith("kitchen") && !isWardrobeImportFile(f)) {
    try {
      const p = parseProject(JSON.parse(readFileSync(join(dir, f), "utf8"))), plan = nest(p), e = estimate(p, plan);
      const board = plan.filter((s) => s.material !== "hdf");
      res[maskPersonal(`${dir}/${f}`)] = { cost: Math.round(e.knownCost), retail: e.retail, sheets: e.ldspSheets, area: Math.round(board.flatMap((s) => s.items).reduce((v, i) => v + i.w * i.h, 0) / 1e4) / 100,
        holders: e.lines.filter((l) => /shelf-holder/.test(l.id)).reduce((v, l) => v + l.quantity, 0) };
    } catch (x) { res[maskPersonal(`${dir}/${f}`)] = { cost: NaN, retail: null, sheets: NaN, area: NaN, holders: NaN }; void x; }
  }
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(res));
console.log(Object.keys(res).length, "проектов");
