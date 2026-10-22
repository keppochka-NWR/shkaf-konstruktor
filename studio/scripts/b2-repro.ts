// B2 (релиз 22.10): торцевые ручки HEXA L-1200 на паре створок — пересечения деталей и сообщение проверки.
// npx tsx scripts/b2-repro.ts [id ручки] [зазор створок]
import { initialModule, section, parts, type Module } from "../src/model";
import { withDoorCount } from "../src/paletteDoors";
import { partCollisions } from "../src/collisions";
import { collisionWarnings } from "../src/roomWarnings";
import { newProject } from "../src/project";

let m: Module = { ...initialModule(), name: "Пустой шкаф", width: 1158, height: 2400, depth: 550, sections: [section()] };
m = withDoorCount(m, 2);
m.handleId = process.argv[2] ?? "hexa1200a";
if (process.argv[3]) m.sections[0].doorGap = Number(process.argv[3]);
const ps = parts(m);
for (const p of ps.filter((p) => p.role === "door" || p.role === "handle")) console.log(p.id.slice(-8), p.name, "size", p.size.map((v) => +v.toFixed(1)), "pos", p.position.map((v) => +v.toFixed(1)), p.hinge ?? "", p.collide ? JSON.stringify(p.collide) : "");
console.log("collisions:", partCollisions(ps, m).map((c) => `${c.names[0]} × ${c.names[1]} ${c.depth}`));
const p = newProject(); p.modules[0].module = m;
console.log(collisionWarnings({ ...p, modules: [p.modules[0]] }).map((w) => w.message));
