// Демо-кухня для проверки основы: прямая 3000 у задней стены комнаты 3200 × 2800 × 2700.
// npx tsx scripts/kitchen-demo.ts → public/local-projects/kitchen-demo.json (?project=kitchen-demo)
import { writeFileSync } from "node:fs";
import { initialModule } from "../src/model";
import { createKitchenRow } from "../src/ModulePalette";
import { projectErrors, type Project } from "../src/project";
import { estimate } from "../src/pricing";

const empty: Project = { version: 3, room: { width: 3200, depth: 2800, height: 2700, openings: [] }, modules: [], calculation: { markup: 2.2, overrides: {}, model: "sheet", sheetPrice: 23000 } };
const source = { ...initialModule(), decor: "Белый", facadeDecor: "Слэйт" };
const group = createKitchenRow(Number(process.argv[2] ?? 3000), source).map((a) => ({ ...a, x: a.x + 100 }));
const r = { project: { ...empty, modules: group } as Project };
const errors = projectErrors(r.project);
writeFileSync("public/local-projects/kitchen-demo.json", JSON.stringify(r.project, null, 1));
const e = estimate(r.project);
console.log("ошибки:", errors.join(" | ") || "нет", "| модулей", r.project.modules.length, "| листов", e.ldspSheets, "| по листу", e.bySheet, "| без цены:", e.missing.map((l) => l.label).join("; "));
