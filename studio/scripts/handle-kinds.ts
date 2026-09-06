// Список форм и межосевых ручек каталога → JSON для Blender-скрипта (scripts/blender_handles.py).
// Запуск: npx tsx scripts/handle-kinds.ts <out.json>
import { writeFileSync } from "node:fs";
import { HANDLES, handleKind } from "../src/handles";
const set = new Map<string, { kind: string; len: number }>();
for (const h of HANDLES) { const k = handleKind(h); const key = k === "knob" ? "knob" : k + "_" + h.len; set.set(key, { kind: k, len: k === "knob" ? 0 : h.len }); }
writeFileSync(process.argv[2], JSON.stringify([...set.values()], null, 1), "utf8");
console.log("kinds:", set.size);
