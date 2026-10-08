// Раскрой модели Базиса движком ГардерЁба: npx tsx scripts/b3d-cutting.ts <model.json из b3d-tools> <outDir> [зазор=10]
// Детали из .b3d (b3d-tools/run_extract.py) → группы по толщине и декору → те же шесть стратегий packRectangles, что nest() студии:
// лист 2750 × 1830, обрезка 10 мм по краю, промежуток между деталями (по умолчанию 10, как в студии), текстура вдоль 2750
// (поворот только у декоров без текстуры, как grainFree). Зеркало и стекло в раскрой ЛДСП не идут. Пишет карты раскроя (HTML со SVG).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { packRectangles } from "../src/packing";
import { RULES } from "../src/model";
import { catalog } from "../src/catalog";

const [file, out, gapArg] = process.argv.slice(2);
const gap = Number(gapArg ?? 10);
type Panel = { name: string; mat: string; thick: number; texdir?: number; bbox: [number, number, number, number] };
type Asm = { name: string; panels: Panel[]; subs?: Asm[] };
const model = JSON.parse(readFileSync(file, "utf8")) as { assemblies: Asm[] };
const items: { code: string; name: string; decor: string; thick: number; along: number; across: number; rot: boolean }[] = [];
const skipped: string[] = [], rotated: string[] = [];
let n = 0;
const walk = (a: Asm) => {
  for (const p of a.panels ?? []) {
    n++;
    if (/зеркал|стекл|бетон/i.test(p.mat)) { skipped.push(`${p.name} — ${p.mat}`); continue; }
    const [x0, y0, x1, y1] = p.bbox, xe = Math.round((x1 - x0) * 10) / 10, ye = Math.round((y1 - y0) * 10) / 10;
    const td = p.texdir ?? 0, decor = /«(.+)»/.exec(p.mat)?.[1] ?? p.mat;
    const [along, across] = td === 1 ? [xe, ye] : td === 2 ? [ye, xe] : [Math.max(xe, ye), Math.min(xe, ye)];
    // деталь шире листа поперёк текстуры (цоколь 1930 при текстуре по высоте) режется вдоль листа — текстура по длине детали
    const forced = across > RULES.sheetH - 20 && across <= RULES.sheetW - 20 && along <= RULES.sheetH - 20;
    if (forced) rotated.push(`${p.name.replace(/^\[[^\]]+\]\s*/, "")} ${Math.round(along)}×${Math.round(across)} (${p.thick} мм)`);
    items.push({ code: String(n), name: p.name.replace(/^\[[^\]]+\]\s*/, ""), decor, thick: p.thick, along, across, rot: forced || td === 0 || !catalog.find((c) => c.n === decor)?.tex });
  }
  for (const s of a.subs ?? []) walk(s);
};
model.assemblies.forEach(walk);

const W = RULES.sheetH, H = RULES.sheetW; // ширина листа 1830 поперёк текстуры, длина 2750 вдоль
const groups = new Map<string, typeof items>();
for (const it of items) { const k = `${it.thick}|${it.decor}`; groups.set(k, [...(groups.get(k) ?? []), it]); }
mkdirSync(out, { recursive: true });
let html = `<!doctype html><meta charset="utf-8"><title>Раскрой</title><style>body{font:14px Arial;margin:20px}svg{border:1px solid #999;margin:6px;background:#fafafa}h2{margin:18px 0 4px}</style><h1>Раскрой движком ГардерЁба</h1><p>Лист ${H}×${W}, обрезка 10 мм, промежуток ${gap} мм, текстура вдоль ${H}.</p>`;
const summary: string[] = [];
for (const [k, ds] of groups) {
  const [thick, decor] = k.split("|");
  let best: ReturnType<typeof packRectangles> | undefined, how = "";
  for (const order of ["area", "height", "width"] as const) for (const fit of ["short", "area"] as const) {
    const packed = packRectangles(ds.map((d) => ({ id: d.code, w: d.across, h: d.along, rot: d.rot })), W - 20, H - 20, gap, order, fit);
    const used = (s: typeof packed) => Math.max(...s.at(-1)!.map((p) => p.y + p.h));
    if (!best || packed.length < best.length || (packed.length === best.length && used(packed) < used(best))) { best = packed; how = `${order}/${fit}`; }
  }
  // гильотина (как пилит форматник: каждый рез сквозной), тот же консервативный алгоритм, что nestGuillotine студии
  type Free = { x: number; y: number; w: number; h: number };
  const gs: Free[][] = [];
  for (const d of [...ds].sort((a, b) => b.along * b.across - a.along * a.across)) {
    let pick: { s: number; i: number; w: number; h: number; score: number } | undefined;
    gs.forEach((free, s) => free.forEach((f, i) => {
      for (const [w, h] of d.rot ? [[d.across, d.along], [d.along, d.across]] : [[d.across, d.along]])
        if (f.w >= w && f.h >= h && (!pick || f.w * f.h - w * h < pick.score)) pick = { s, i, w, h, score: f.w * f.h - w * h };
    }));
    if (!pick) { gs.push([{ x: 0, y: 0, w: W - 20, h: H - 20 }]); const [w, h] = d.across <= W - 20 ? [d.across, d.along] : [d.along, d.across]; pick = { s: gs.length - 1, i: 0, w, h, score: 0 }; }
    const free = gs[pick.s], f = free.splice(pick.i, 1)[0];
    if (f.w - pick.w - gap > 0) free.push({ x: f.x + pick.w + gap, y: f.y, w: f.w - pick.w - gap, h: pick.h });
    if (f.h - pick.h - gap > 0) free.push({ x: f.x, y: f.y + pick.h + gap, w: f.w, h: f.h - pick.h - gap });
  }
  const area = ds.reduce((s, d) => s + d.along * d.across, 0) / 1e6, sheets = best!.length;

  const lastUsed = Math.max(...best!.at(-1)!.map((p) => p.y + p.h));
  summary.push(`${thick} мм «${decor}»: деталей ${ds.length}, ${area.toFixed(2)} м² → листов ${sheets} (последний занят на ${Math.round(lastUsed / (H - 20) * 100)}% длины; стратегия ${how}); гильотиной (форматник, сквозные резы): ${gs.length}`);
  html += `<h2>${thick} мм «${decor}» — ${sheets} лист(ов), деталей ${ds.length}, ${area.toFixed(2)} м²; гильотиной ${gs.length}</h2>`;
  const byCode = new Map(ds.map((d) => [d.code, d]));
  best!.forEach((sheet, i) => {
    const s = 0.22;
    html += `<svg width="${W * s}" height="${H * s}" viewBox="0 0 ${W} ${H}"><rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="#ccc" stroke-dasharray="20 10"/><text x="20" y="60" font-size="44" fill="#555">Лист ${i + 1}</text>`;
    for (const p of sheet) { const d = byCode.get(p.id)!; html += `<rect x="${p.x + 10}" y="${p.y + 10}" width="${p.w}" height="${p.h}" fill="#e8d6b8" stroke="#6b4d24" stroke-width="3"/><text x="${p.x + 18}" y="${p.y + 50}" font-size="${Math.min(38, p.w / 6)}" fill="#333">${d.name} ${Math.round(d.along)}×${Math.round(d.across)}</text>`; }
    html += `</svg>`;
  });
}
html += `<h2>Повёрнуты: текстура по длине детали (поперёк лист 1830 не вмещает)</h2><ul>${rotated.map((s) => `<li>${s}</li>`).join("")}</ul><h2>Не в раскрое ЛДСП</h2><ul>${skipped.map((s) => `<li>${s}</li>`).join("")}</ul>`;
writeFileSync(`${out}/Карты раскроя.html`, html);
console.log(summary.join("\n"));
console.log("Не в раскрое ЛДСП:", skipped.length, "шт");
if (rotated.length) console.log("Повёрнуты (текстура по длине — иначе не помещаются):", rotated.join("; "));
