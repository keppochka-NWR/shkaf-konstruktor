// Сверка одного модуля эталона шкафа: npx tsx scripts/wardrobe/one.ts w172 [m01] — распознавание, ошибки студии, расхождения деталей.
import { readFileSync } from "node:fs";
import { validate } from "../../src/model";
import { compareModule } from "../kitchen/compare";
import { wardrobeFromEtalon, type WRefModule } from "./fromEtalon";
import { verdict, ETALON_W } from "./batch";

const [file = "w172", key] = process.argv.slice(2);
const mods = (JSON.parse(readFileSync(`${ETALON_W}/${file}.json`, "utf8")) as { modules: WRefModule[] }).modules;
for (const ref of mods.filter((m) => !key || m.key === key)) {
  const { module: m, unsupported, notes } = wardrobeFromEtalon(ref);
  const c = compareModule(ref, m);
  console.log(`== ${file} ${ref.key} ${ref.archetype} ${ref.size.join("×")}`);
  console.log("unsupported:", unsupported, "notes:", notes, "errors:", validate(m));
  console.log("missing:", c.missing.map((x) => `${x.name} ${x.cls}`));
  console.log("extra:", c.extra.map((x) => `${x.name} ${x.cls}`));
  for (const p of c.pairs.filter((p) => p.delta > 0.5)) console.log("Δ", p.delta, p.ref.name, "↔", p.studio.name, p.faces.map((v) => Math.round(v * 10) / 10).join(" "));
  for (const h of c.hardware) if (h.ref !== h.studio || (h.maxPosDelta ?? 0) > 2 || h.note) console.log("hw", h.category, h.ref, "/", h.studio, h.maxPosDelta ?? "", h.note ?? "");
  console.log("verdict:", JSON.stringify(verdict(file, ref)));
}
