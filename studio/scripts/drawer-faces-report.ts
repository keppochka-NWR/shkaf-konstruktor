// Отчёт «высоты фасадов и коробов ящиков сразу после добавления модуля» (fix-drawers, 29.10.2026, правка 1 Макса
// «в комоде неравномерные ящики со старта»): все модули палитры с ящиками, шаблоны секции, кухонный низ с ящиками.
// npx tsx scripts/drawer-faces-report.ts [--json out.json]
import { writeFileSync } from "node:fs";
import { parts, initialModule, type Module } from "../src/model";
import { assembleModule } from "../src/paletteBuild";
import { applySectionTemplate } from "../src/quickMenu";
import { kitchenBase } from "../src/kitchen";

const rows: { name: string; faces: number[]; boxes: number[] }[] = [];
function report(name: string, m: Module) {
  const ps = parts(m);
  for (const s of m.sections) {
    const faces = ps.filter((p) => p.sectionId === s.id && /:drawer:\d+:facade$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]).map((p) => Math.round(p.size[1] * 10) / 10);
    const boxes = ps.filter((p) => p.sectionId === s.id && /:drawer:\d+:left$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]).map((p) => Math.round(p.size[1] * 10) / 10);
    const kfaces = ps.filter((p) => p.id.startsWith("kd:") && p.id.endsWith(":facade")).sort((a, b) => a.position[1] - b.position[1]).map((p) => Math.round(p.size[1] * 10) / 10);
    if (!faces.length && !kfaces.length) continue;
    const f = faces.length ? faces : kfaces;
    rows.push({ name, faces: f, boxes });
    const spread = Math.max(...f) - Math.min(...f);
    console.log(`${name.padEnd(46)} фасады ${f.join(" / ").padEnd(28)} короба ${boxes.join(" / ").padEnd(22)} ${spread > 1 ? "НЕРАВНЫЕ (разброс " + Math.round(spread) + ")" : "равные"}`);
  }
}
const src = initialModule();
for (const [w, h, d] of [[600, 850, 550], [800, 700, 450], [1000, 1000, 500], [600, 1200, 550], [800, 400, 450], [600, 300, 400]] as const)
  report(`Комод ${w}×${h}×${d}`, assembleModule("drawers", w, h, d, src));
report("Подвесной ящик 800×200×400", assembleModule("hanging-drawer", 800, 200, 400, src));
report("Шкаф в прихожую (исходный модуль, 2 ящика)", initialModule());
for (const tpl of ["drawers-rod", "drawers-shelves"] as const) {
  const m = assembleModule("wardrobe", 800, 2200, 600, src); applySectionTemplate(m, m.sections[0].id, tpl);
  report(`Шкаф 2200, шаблон ${tpl}`, m);
  const o = assembleModule("wardrobe", 800, 2200, 600, src); o.doors = false; applySectionTemplate(o, o.sections[0].id, tpl); report(`Шкаф без дверей, шаблон ${tpl}`, o);
}
report("Кухня: нижний с ящиками 600", kitchenBase(initialModule(), 600, "drawers"));
const i = process.argv.indexOf("--json"); if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(rows, null, 1));
