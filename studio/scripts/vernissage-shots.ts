// Снимки фасадов «Вернисаж» в студии: на каждую фрезеровку — проект из трёх шкафов с одной дверью (узкий, обычный, высокий),
// общий вид спереди и крупно каждая дверь под углом к свету (видно профиль). Через scripts/kitchen-shots.ts (Chrome, Playwright).
// npx tsx scripts/vernissage-shots.ts <url> <outDir> [фрезеровка:исполнение,...]
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { initialModule, section, type Module } from "../src/model";
import { newProject, type PlacedModule } from "../src/project";
import type { VernissageFacade } from "../src/facadesVernissage";

const [url, out, list] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const items = (list ?? "15:solid,1:solid,3:solid,54:solid,52:solid,79:solid,109:solid,25:glass,54:grille,W1:solid").split(",").map((s) => s.split(":"));
const SIZES = [{ key: "narrow", w: 300, h: 760 }, { key: "normal", w: 450, h: 760 }, { key: "tall", w: 600, h: 2100 }];
for (const [id, open] of items) {
  const v: VernissageFacade = { milling: id, cover: "film", film: "Моно серый", thickness: 19, ...(open && open !== "solid" ? { open: open as VernissageFacade["open"] } : {}) };
  const p = newProject();
  let x = 100;
  p.modules = SIZES.map((s, i): PlacedModule => {
    const base = initialModule(), sec = { ...section(), doorLeaves: 1 as const };
    const m: Module = { ...base, name: s.key, width: s.w, height: s.h, depth: 400, sections: [sec], doors: true, vernissage: v, facadeT: 19, doorOpen: "push" };
    const a: PlacedModule = { id: "v" + i, x, z: 30, y: 0, module: m }; x += s.w + 250; return a;
  });
  const file = join(out, `_project-${id.replace("/", "-")}-${open}.json`);
  writeFileSync(file, JSON.stringify(p));
  const tag = `${id.replace("/", "-")}${open && open !== "solid" ? "-" + open : ""}`;
  const cmds: string[] = ["clean"];
  // общий вид: все три двери спереди, чуть сверху-слева
  const cx = (100 + x - 250) / 2;
  cmds.push(`cam:${cx - 500},1500,${30 + 400 + 3600},${cx},950,${430}`, `shot:${tag}-all`);
  let xx = 100;
  for (const s of SIZES) {
    const dx = xx + s.w / 2, dy = 60 + s.h / 2, D = Math.max(s.w, s.h) * 0.85 + 120;
    cmds.push(`cam:${dx - D * 0.3},${dy + D * 0.18},${430 + D},${dx},${dy},${430}`, `shot:${tag}-${s.key}`);
    xx += s.w + 250;
  }
  execSync(`npx tsx scripts/kitchen-shots.ts "${url}" "${file}" "${out}" "${cmds.join(";")}"`, { stdio: "inherit" });
}
