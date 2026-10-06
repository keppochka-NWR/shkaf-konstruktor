// Пример проекта «Шкаф-купе 1800» для демонстрации и аудита: npx tsx scripts/make-kupe-example.ts
import { writeFileSync } from "node:fs";
import { createKupeWardrobe } from "../src/ModulePalette";
import { initialModule } from "../src/model";
import { newProject, appendModuleGroup, projectErrors } from "../src/project";
const base = newProject();
base.room = { ...base.room, width: 2400, depth: 2000, height: 2600 };
const group = createKupeWardrobe(1800, 2400, 600, { ...initialModule(), decor: "Дуб Вотан", facadeDecor: "Дуб Вотан" });
const r = appendModuleGroup(base, group);
r.project.modules = r.project.modules.filter((a) => group.some((g) => g.module.name === a.module.name && a.id !== base.modules[0].id));
r.project.modules.sort((a, b) => Number(!!b.module.kupe) - Number(!!a.module.kupe));
const kupe = r.project.modules.find((a) => a.module.kupe)!.module.kupe!;
kupe.fills = ["Зеркало Серебро 4мм", "Дуб Вотан"]; kupe.sections = 2; kupe.softClose = true;
const errors = projectErrors(r.project);
if (errors.length) throw Error(errors.join("; "));
writeFileSync("examples/kupe-wardrobe.project.json", JSON.stringify(r.project, null, 1), "utf8");
console.log("examples/kupe-wardrobe.project.json:", r.project.modules.length, "объекта");
