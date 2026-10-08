// Раскрой модели Базиса движками ГардерЁба: npx tsx scripts/b3d-cutting.ts <model.json из b3d-tools> <outDir> [зазор=10]
// Детали из .b3d (b3d-tools/run_extract.py) → группы по толщине и декору. Считается тремя способами:
//   1) как nest() студии сейчас: шесть стратегий packRectangles (MaxRects, НЕ гильотина), обрезка 10, промежуток (по умолчанию 10);
//   2) старая гильотина (как nestGuillotine);
//   3) новый движок guillotine.ts — гильотина как в Базисе: пропил 4,4, обрезка 12 (до 10, если деталь длиннее), ≤ 5 стадий,
//      первая стадия — продольные полосы во всю длину листа.
// Лист 2750 × 1830, текстура вдоль 2750 (поворот только у декоров без текстуры, как grainFree; texdir=0 — без направления).
// Деталь шире листа поперёк текстуры (цоколь 2068 при текстуре по высоте 80): в 1–2 её кладут вдоль (текстура нарушается, как было),
// в 3 — два прогона: «текстура соблюдена» (деталь в списке «сращивать») и «длинные повёрнуты» (как в 1–2).
// Зеркало и стекло в раскрой ЛДСП не идут. Пишет «Карты раскроя.html» (карты нового движка + сводка).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { packRectangles } from "../src/packing";
import { RULES } from "../src/model";
import { catalog } from "../src/catalog";
import { guillotinePack, GUILLOTINE_DEFAULTS, type GuillotineResult } from "../src/guillotine";

const [file, out, gapArg] = process.argv.slice(2);
const gap = Number(gapArg ?? 10);
type Panel = { name: string; mat: string; thick: number; texdir?: number; bbox: [number, number, number, number] };
type Asm = { name: string; panels: Panel[]; subs?: Asm[] };
const model = JSON.parse(readFileSync(file, "utf8")) as { assemblies: Asm[] };
type Item = { code: string; name: string; decor: string; thick: number; along: number; across: number; rot: boolean; forced: boolean };
const items: Item[] = [];
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
    items.push({ code: String(n), name: p.name.replace(/^\[[^\]]+\]\s*/, ""), decor, thick: p.thick, along, across, forced, rot: td === 0 || !catalog.find((c) => c.n === decor)?.tex });
  }
  for (const s of a.subs ?? []) walk(s);
};
model.assemblies.forEach(walk);

const W = RULES.sheetH, H = RULES.sheetW; // ширина листа 1830 поперёк текстуры, длина 2750 вдоль
const groups = new Map<string, Item[]>();
for (const it of items) { const k = `${it.thick}|${it.decor}`; groups.set(k, [...(groups.get(k) ?? []), it]); }
mkdirSync(out, { recursive: true });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
let maps = "";
const summary: string[] = [], table: string[] = [];
/** Обрезка нового движка: 12, но до 10, если иначе деталь не помещается (как nestPlan студии). */
function trimFor(ds: { w: number; h: number; rot: boolean }[]) {
  const need = Math.min(...ds.map((a) => Math.max(Math.min((W - a.w) / 2, (H - a.h) / 2), a.rot ? Math.min((W - a.h) / 2, (H - a.w) / 2) : -Infinity)));
  return Math.max(10, Math.min(GUILLOTINE_DEFAULTS.trim, Math.floor(need * 2) / 2));
}
for (const [k, ds] of groups) {
  const [thick, decor] = k.split("|");
  // 1) как nest() студии сейчас (детали «forced» повёрнуты, как раньше)
  let best: ReturnType<typeof packRectangles> | undefined;
  for (const order of ["area", "height", "width"] as const) for (const fit of ["short", "area"] as const) {
    const packed = packRectangles(ds.map((d) => ({ id: d.code, w: d.across, h: d.along, rot: d.rot || d.forced })), W - 20, H - 20, gap, order, fit);
    const used = (s: typeof packed) => Math.max(...s.at(-1)!.map((p) => p.y + p.h));
    if (!best || packed.length < best.length || (packed.length === best.length && used(packed) < used(best))) best = packed;
  }
  // 2) старая гильотина (как nestGuillotine студии, без поворотов кроме вынужденных)
  type Free = { x: number; y: number; w: number; h: number };
  const gs: Free[][] = [];
  for (const d of [...ds].sort((a, b) => b.along * b.across - a.along * a.across)) {
    let pick: { s: number; i: number; w: number; h: number; score: number } | undefined;
    gs.forEach((free, s) => free.forEach((f, i) => {
      for (const [w, h] of d.rot || d.forced ? [[d.across, d.along], [d.along, d.across]] : [[d.across, d.along]])
        if (f.w >= w && f.h >= h && (!pick || f.w * f.h - w * h < pick.score)) pick = { s, i, w, h, score: f.w * f.h - w * h };
    }));
    if (!pick) { gs.push([{ x: 0, y: 0, w: W - 20, h: H - 20 }]); const [w, h] = d.across <= W - 20 ? [d.across, d.along] : [d.along, d.across]; pick = { s: gs.length - 1, i: 0, w, h, score: 0 }; }
    const free = gs[pick.s], f = free.splice(pick.i, 1)[0];
    if (f.w - pick.w - gap > 0) free.push({ x: f.x + pick.w + gap, y: f.y, w: f.w - pick.w - gap, h: pick.h });
    if (f.h - pick.h - gap > 0) free.push({ x: f.x, y: f.y + pick.h + gap, w: f.w, h: f.h - pick.h - gap });
  }
  // 3) новый движок: текстура соблюдена / длинные повёрнуты
  const strictParts = ds.map((d) => ({ id: d.code, w: d.across, h: d.along, rot: d.rot }));
  const looseParts = ds.map((d) => ({ id: d.code, w: d.across, h: d.along, rot: d.rot || d.forced }));
  const strict = guillotinePack(strictParts, W, H, { trim: trimFor(strictParts), iterations: 24 });
  const loose = ds.some((d) => d.forced) ? guillotinePack(looseParts, W, H, { trim: trimFor(looseParts), iterations: 24 }) : strict;
  const area = ds.reduce((s, d) => s + d.along * d.across, 0) / 1e6, lb = Math.ceil(area / (((W - 24) * (H - 24)) / 1e6) - 1e-9);
  const byCode = new Map(ds.map((d) => [d.code, d]));
  const kim = (r: GuillotineResult) => r.sheets.length ? Math.round(r.sheets.slice(0, -1).reduce((s, x) => s + x.kim, 0) / Math.max(1, r.sheets.length - 1) * 1000) / 10 : 0;
  summary.push(`${thick} мм «${decor}»: деталей ${ds.length}, ${area.toFixed(2)} м²; нижняя граница по площади ${lb}; как nest() сейчас (MaxRects, не гильотина) ${best!.length}; старая гильотина ${gs.length}; новая гильотина ${loose.sheets.length}${loose !== strict ? ` (с поворотом длинных; при соблюдении текстуры ${strict.sheets.length} листов + ${strict.unplaced.length} дет. сращивать)` : ""}`);
  table.push(`<tr><td>${thick} мм «${esc(decor)}»</td><td>${ds.length}</td><td>${area.toFixed(2)}</td><td>${lb}</td><td>${best!.length}</td><td>${gs.length}</td><td><b>${loose.sheets.length}</b>${loose !== strict ? ` (текстура соблюдена: ${strict.sheets.length} + ${strict.unplaced.length} сращивать)` : ""}</td><td>${kim(loose)} %</td></tr>`);
  maps += `<h2>${thick} мм «${esc(decor)}» — новая гильотина: ${loose.sheets.length} лист(ов), деталей ${ds.length}, ${area.toFixed(2)} м²</h2>`;
  if (strict.unplaced.length) maps += `<p class="warn">Текстура не позволяет положить поперёк листа: ${strict.unplaced.map((u) => `${esc(byCode.get(u.id)!.name)} ${Math.round(u.h)}×${Math.round(u.w)} — ${esc(u.reason)}`).join("; ")}${loose !== strict ? " На картах ниже такие детали положены вдоль листа (текстура по длине детали) — решает технолог." : ""}</p>`;
  loose.sheets.forEach((sheet, i) => {
    const s = 0.22;
    maps += `<figure><svg width="${W * s}" height="${H * s}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#f1ede3" stroke="#999" stroke-width="4"/>`;
    for (const o of sheet.offcuts.filter((o) => o.business)) maps += `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="#e4dccb" stroke="#b9a986" stroke-width="2" stroke-dasharray="14 10"/>`;
    for (const p of sheet.items) { const d = byCode.get(p.id)!; maps += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.rotated ? "#f0c9a0" : "#e8d6b8"}" stroke="#6b4d24" stroke-width="3"/><text x="${p.x + p.w / 2}" y="${p.y + p.h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${Math.max(18, Math.min(38, Math.min(p.w, p.h) / 3))}" fill="#333"${p.h > p.w * 1.5 ? ` transform="rotate(-90 ${p.x + p.w / 2} ${p.y + p.h / 2})"` : ""}>${esc(d.name)} ${Math.round(d.along)}×${Math.round(d.across)}</text>`; }
    maps += `</svg><figcaption>Лист ${i + 1}: КИМ ${Math.round(sheet.kim * 1000) / 10} %, стадий ${sheet.stages}, резов ${sheet.cuts.length}</figcaption></figure>`;
  });
}
const html = `<!doctype html><meta charset="utf-8"><title>Раскрой</title><style>body{font:14px Arial;margin:20px;color:#23404c}table{border-collapse:collapse}td,th{border:1px solid #ccd;padding:4px 8px;text-align:left}figure{display:inline-block;margin:6px;vertical-align:top}svg{border:1px solid #999}h2{margin:22px 0 6px}.warn{color:#8a4b00}</style>
<h1>Раскрой движками ГардерЁба</h1><p>Лист ${H} × ${W}, текстура вдоль ${H}. Новая гильотина: пропил ${GUILLOTINE_DEFAULTS.kerf} мм, обрезка ${GUILLOTINE_DEFAULTS.trim} мм (до 10, если деталь длиннее), ≤ 5 стадий, первая — продольные полосы во всю длину. Сейчас в студии (nest): обрезка 10, промежуток ${gap}, раскладка MaxRects — карты не всегда пилятся сквозными резами.</p>
<table><tr><th>Плита</th><th>Деталей</th><th>м²</th><th>Нижняя граница</th><th>nest() сейчас</th><th>Старая гильотина</th><th>Новая гильотина</th><th>КИМ (кроме последнего)</th></tr>${table.join("")}</table>
${maps}<h2>Повёрнуты поперёк текстуры (поперёк лист их не вмещает)</h2><ul>${rotated.map((s) => `<li>${esc(s)}</li>`).join("")}</ul><h2>Не в раскрое ЛДСП</h2><ul>${skipped.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
writeFileSync(`${out}/Карты раскроя.html`, html);
console.log(summary.join("\n"));
console.log("Не в раскрое ЛДСП:", skipped.length, "шт");
if (rotated.length) console.log("Шире листа поперёк текстуры:", rotated.join("; "));
