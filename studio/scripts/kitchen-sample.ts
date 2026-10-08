// Пробный проект для снимков фурнитуры кухни: нижний 600 (распашной), под мойку 800, навесной 600 над нижним.
// npx tsx scripts/kitchen-sample.ts <out.json>
import { writeFileSync } from "node:fs";
import { initialModule, id } from "../src/model";
import { newProject, projectErrors } from "../src/project";
import { kitchenBase, kitchenWall, KITCHEN } from "../src/kitchen";

const p = newProject(kitchenBase(initialModule(), 600));
p.room = { ...p.room, width: 2400, depth: 2000, height: 2700 };
const look = { decor: "Белый", facadeDecor: "Слэйт" };
p.modules = [
  { id: id(), x: 300, y: 0, z: 3, rotation: 0, module: { ...kitchenBase(initialModule(), 600), ...look } },
  { id: id(), x: 900, y: 0, z: 3, rotation: 0, module: { ...kitchenBase(initialModule(), 800, "sink"), ...look } },
  { id: id(), x: 300, y: KITCHEN.baseHeight + KITCHEN.worktopThickness + KITCHEN.wallGap, z: 0, rotation: 0, module: { ...kitchenWall(initialModule(), 600), ...look } },
];
const e = projectErrors(p);
if (e.length) console.log("ошибки:", e.join(" | "));
writeFileSync(process.argv[2], JSON.stringify(p));
console.log("ok", p.modules.length);
