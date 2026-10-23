// Панели эталона шкафа Базиса и шкафа студии, построенного распознавателем (fromEtalon), — коробками для независимого рендера
// (scripts/wardrobe/render_boxes.py): npx tsx scripts/wardrobe/boxes.ts w218 m01 outDir → <outDir>/w218-bazis.json, w218-studio.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parts } from "../../src/model";
import { wardrobeFromEtalon, type WRefModule } from "./fromEtalon";
import { ETALON_W } from "./batch";

const [file, key = "m01", out = "."] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const ref = (JSON.parse(readFileSync(`${ETALON_W}/${file}.json`, "utf8")) as { modules: WRefModule[] }).modules.find((m) => m.key === key)!;
const z0 = Math.min(...ref.panels.filter((p) => p.role === "side").map((p) => p.box[2]));
writeFileSync(`${out}/${file}-bazis.json`, JSON.stringify({ title: `Базис ${file}/${key} ${ref.size.join("×")}`, panels: ref.panels.map((p) => ({ name: p.name, role: p.role ?? "other", kind: p.kind, box: p.box })) }));
const { module: m, unsupported } = wardrobeFromEtalon(ref);
const role = (id: string, r: string) => r === "door" ? "facade" : r === "shelf" ? "shelf" : /^(left|right)$/.test(id) ? "side" : id === "top" ? "top" : id === "bottom" ? "bottom" : id === "plinth" ? "plinth" : id === "back" ? "back"
  : /:divider$/.test(id) ? "partition" : /:divider:(under|over)$/.test(id) ? "support" : /^rail/.test(id) ? "rail" : r;
const panels = parts(m).filter((p) => p.material === "board" || p.material === "hdf").map((p) => ({ name: p.name, role: role(p.id, p.role), kind: p.material === "hdf" ? "hdf" : "ldsp",
  box: [0, 1, 2].map((k) => p.position[k] - p.size[k] / 2 + (k === 2 ? z0 : 0)).concat([0, 1, 2].map((k) => p.position[k] + p.size[k] / 2 + (k === 2 ? z0 : 0))) }));
writeFileSync(`${out}/${file}-studio.json`, JSON.stringify({ title: `Студия (распознаватель) ${m.width}×${m.height}×${m.depth}`, unsupported, panels }));
console.log("панелей: Базис", ref.panels.length, "студия", panels.length, "| unsupported:", unsupported.join("; "));
