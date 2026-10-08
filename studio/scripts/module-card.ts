// Карточка модуля студии для сверки и критика: панели (габариты в координатах модуля), фурнитура, крепёж, пересечения.
// npx tsx scripts/module-card.ts <project.json> <index|all> [out.md]
import { readFileSync, writeFileSync } from "node:fs";
import { parts, type Part } from "../src/model";
import { parseProject } from "../src/project";
import { partCollisions } from "../src/collisions";

const [file, which, out] = process.argv.slice(2);
const p = parseProject(JSON.parse(readFileSync(file, "utf8")));
const r1 = (v: number) => Math.round(v * 10) / 10;
const lo = (q: Part, i: number) => r1(q.position[i] - q.size[i] / 2), hi = (q: Part, i: number) => r1(q.position[i] + q.size[i] / 2);
const box = (q: Part) => `x ${lo(q, 0)}..${hi(q, 0)} · y ${lo(q, 1)}..${hi(q, 1)} · z ${lo(q, 2)}..${hi(q, 2)}`;
let md = "";
p.modules.forEach((a, i) => {
  if (which !== "all" && Number(which) !== i) return;
  const m = a.module, ps = parts(m);
  md += `\n## ${i}. ${m.name} — ${m.width}×${m.height}×${m.depth} (в комнате x ${a.x}, y ${a.y ?? 0}, z ${a.z})\n`;
  md += `Поля: ${JSON.stringify({ kitchen: m.kitchen, feet: m.feet, bottomUnder: m.bottomUnder, topType: m.topType, backType: m.backType, groove: m.backType === "groove" ? [m.grooveInset, m.grooveWidth, m.grooveDepth, m.grooveClear] : undefined, backGap: m.backGap, faceGap: [m.faceGap, m.faceGapBetween], rails: m.rails })}\n\n`;
  md += "| id | деталь | материал | размер (L×W×T) | габарит в модуле |\n|---|---|---|---|---|\n";
  for (const q of ps.filter((q) => q.material === "board" || q.material === "hdf" || q.material === "glass"))
    md += `| ${q.id.replace(/^[0-9a-f-]{36}/, "S")} | ${q.name} | ${q.material} ${q.thickness} | ${r1(q.length)}×${r1(q.width)}×${r1(q.thickness)} | ${box(q)} |\n`;
  md += "\n**Фурнитура и крепёж:**\n\n| id | наименование | модель | габарит |\n|---|---|---|---|\n";
  for (const q of ps.filter((q) => q.material === "metal"))
    md += `| ${q.id.replace(/^[0-9a-f-]{36}/, "S")} | ${q.name} | ${q.model?.file ?? "—"}${q.model?.native ? ` origin ${q.model.origin?.map(r1).join(",")}` : ""} | ${box(q)} |\n`;
  const c = partCollisions(ps, m);
  md += `\n**Пересечения:** ${c.length ? c.map((x) => `${x.names[0]} × ${x.names[1]} ${x.depth} мм`).join("; ") : "нет"}\n`;
});
if (out) writeFileSync(out, md); else console.log(md);
