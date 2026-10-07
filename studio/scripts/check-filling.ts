// Высоты наполнения проекта от пола: полки (центр, * — обязательная над ящиками), фасады ящиков, тремпели. npx tsx scripts/check-filling.ts <project.json>
import { readFileSync } from "node:fs";
import { parts } from "../src/model";
const p = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const a of p.modules) {
  if (a.module.kupe) continue;
  const ps = parts(a.module), y0 = a.y ?? 0;
  const sh = ps.filter((q: any) => q.role === "shelf").map((q: any) => Math.round(q.position[1] + y0) + (q.id.includes("cap") ? "*" : ""));
  const fr = ps.filter((q: any) => /:drawer:\d+:facade$/.test(q.id)).map((q: any) => `${Math.round(q.position[1] - q.size[1] / 2 + y0)}..${Math.round(q.position[1] + q.size[1] / 2 + y0)}`);
  const pu = ps.filter((q: any) => q.id.includes(":pullout:")).map((q: any) => `y${Math.round(q.position[1] + y0)} z${Math.round(q.position[2] - q.size[2] / 2)}..${Math.round(q.position[2] + q.size[2] / 2)}`);
  console.log(`${a.module.name.padEnd(20)} x ${a.x}..${a.x + a.module.width}  полки(центр) ${sh.join(", ")}  ящики ${fr.join(", ")}  тремпель ${pu.join(", ")}`);
}
