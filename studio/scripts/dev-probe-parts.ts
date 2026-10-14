// Зонд: детали модуля проекта по фильтру id — габариты каждой детали (x/y/z от..до).
// npx tsx scripts/dev-probe-parts.ts <project.json> <index> <regex>
import { readFileSync } from "node:fs";
import { parts } from "../src/model";
import { parseProject } from "../src/project";
const [file, idx, rx] = process.argv.slice(2);
if (!file || idx === undefined) { console.log("использование: npx tsx scripts/dev-probe-parts.ts <project.json> <index> [regex]"); process.exit(2); }
const m = parseProject(JSON.parse(readFileSync(file, "utf8"))).modules[Number(idx)].module;
console.log(m.name, m.width, m.height, m.depth, "doorMount", m.doorMount, "sections", m.sections.length);
for (const p of parts(m)) if (new RegExp(rx || ".").test(p.id)) {
  const lo = p.position.map((v, i) => Math.round((v - p.size[i] / 2) * 10) / 10), hi = p.position.map((v, i) => Math.round((v + p.size[i] / 2) * 10) / 10);
  console.log(p.id.replace(/^[0-9a-f-]{36}/, "S"), p.name, "x", lo[0], "..", hi[0], "y", lo[1], "..", hi[1], "z", lo[2], "..", hi[2]);
}
