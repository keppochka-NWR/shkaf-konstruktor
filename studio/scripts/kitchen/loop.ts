// Один шаг цикла сверки модуля: эталон Базиса → модуль студии → сверка → проект для снимков и отчёт.
// npx tsx scripts/kitchen/loop.ts <kNN> <mXX> [outDir]
// Пишет <outDir>/<kNN>-<mXX>.json (проект с одним модулем), <kNN>-<mXX>-compare.md и печатает итог.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { id, validate } from "../../src/model";
import { newProject, projectErrors } from "../../src/project";
import { partCollisions } from "../../src/collisions";
import { parts } from "../../src/model";
import { compareModule, comparisonMarkdown, type RefModule } from "./compare";
import { moduleFromEtalon } from "./fromEtalon";

const [k, key, outDir = "C:/Users/My PC/Desktop/Claude Project/Кухни/ГардерЁб/loop"] = process.argv.slice(2);
const etalon = JSON.parse(readFileSync(`C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/${k}.json`, "utf8"));
const ref = (etalon.modules as RefModule[]).find((m) => m.key === key);
if (!ref) throw Error("нет модуля " + key);
const { module: m, notes, unsupported } = moduleFromEtalon(ref);
const errors = validate(m);
const c = compareModule(ref, m);
const coll = partCollisions(parts(m), m);
mkdirSync(outDir, { recursive: true });
const p = newProject(m);
p.room = { ...p.room, width: Math.max(1600, m.width + 800), depth: 1600, height: 2700 };
p.modules = [{ id: id(), x: 400, y: m.kitchen?.role === "wall" || m.kitchen?.role === "antresol" ? 1458 : 0, z: m.backType === "nailed" ? 3 : 0, rotation: 0, module: m }];
const pe = projectErrors(p); if (pe.length) console.log("ОШИБКИ ПРОЕКТА:", pe.join(" | "));
writeFileSync(`${outDir}/${k}-${key}.json`, JSON.stringify(p));
let md = comparisonMarkdown(ref, c);
md += `\n**Распознано:** ${JSON.stringify({ width: m.width, height: m.height, depth: m.depth, feet: m.feet, bottomUnder: m.bottomUnder, topType: m.topType, rails: m.rails, backType: m.backType, backGap: m.backGap, groove: [m.grooveInset, m.grooveWidth, m.grooveDepth, m.grooveClear], facade: [m.facadeT, m.faceAir, m.faceGap, m.faceGapBetween], shelves: m.sections[0].shelves, shelfDepth: m.sections[0].shelfDepth, shelfRear: m.shelfRear, shelfPinInset: m.shelfPinInset, confirmatInset: m.confirmatInset, kitchen: m.kitchen })}\n`;
md += `\nОшибки студии: ${errors.join("; ") || "нет"}. Пересечения: ${coll.map((x) => x.names.join(" × ") + " " + x.depth).join("; ") || "нет"}.\n`;
if (notes.length) md += `\nЗаметки: ${notes.join("; ")}\n`;
if (unsupported.length) md += `\nНе поддержано: ${unsupported.join("; ")}\n`;
writeFileSync(`${outDir}/${k}-${key}-compare.md`, md);
const worst = [...c.pairs].sort((a, b) => b.delta - a.delta).slice(0, 6).map((p) => `${p.ref.name}→${p.studio.name} ${p.delta}`);
console.log(`${k}/${key} ${ref.name} [${ref.archetype}] ${c.pass ? "PASS" : "FAIL"} · пар ${c.pairs.length}, нет в студии ${c.missing.length}, лишних ${c.extra.length} · хуже всего: ${worst.join("; ")}`);
if (c.edges) console.log(`кромка: пар ${c.edges.checked}` + (c.edges.bad.length ? " · " + c.edges.bad.slice(0, 4).join(" | ") : " — совпала"));
if (c.holes) console.log(`отверстия: Базис ${c.holes.ref}, студия ${c.holes.studio}, совпало ${c.holes.matched}, max Δ ${c.holes.maxDelta}` + (c.holes.missing.length ? " · нет: " + c.holes.missing.slice(0, 6).join(" | ") : "") + (c.holes.extra.length ? " · лишние: " + c.holes.extra.slice(0, 6).join(" | ") : ""));
console.log("фурнитура:", c.hardware.map((h) => `${h.category} ${h.ref}/${h.studio}${h.maxPosDelta !== null ? " Δ" + h.maxPosDelta : ""}`).join(", "));
if (c.missing.length) console.log("нет в студии:", c.missing.map((x) => `${x.name}[${x.cls}] ${x.box.join(",")}`).join(" | "));
if (c.extra.length) console.log("лишнее:", c.extra.map((x) => `${x.name}[${x.cls}] ${x.box.join(",")}`).join(" | "));
if (errors.length) console.log("ошибки студии:", errors.join("; "));
if (coll.length) console.log("пересечения:", coll.map((x) => x.names.join(" × ") + " " + x.depth).join("; "));
if (unsupported.length) console.log("не поддержано:", unsupported.join("; "));
