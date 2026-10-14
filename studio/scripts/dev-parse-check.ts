// Проверка: читается ли файл проекта так же, как в браузере (parseProject + projectErrors).
// npx tsx scripts/dev-parse-check.ts <project.json>
import { readFileSync } from "node:fs";
import { parseProject, projectErrors } from "../src/project";
const file = process.argv[2];
if (!file) { console.log("использование: npx tsx scripts/dev-parse-check.ts <project.json>"); process.exit(2); }
try {
  const p = parseProject(JSON.parse(readFileSync(file, "utf8")));
  console.log("ok, модулей", p.modules.length, "ошибки проекта:", projectErrors(p).join(" | ") || "нет");
} catch (e) { console.log("ОШИБКА:", (e as Error).message); process.exit(1); }
