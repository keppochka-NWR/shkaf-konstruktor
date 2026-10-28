// dp-2810: сверка сметы студии по зонам с укрупнённой себестоимостью Макса (cost.py → cost.json).
// npx tsx scripts/dp-2810-compare.ts <cost.json> [out.json]
// Студия: листы ЛДСП по раскрою зоны, закупка по группам строк сметы (ЛДСП+кромка+работа, ХДФ, фасады Вернисаж, фурнитура, подсветка), цена клиенту
// по обеим моделям и по большей. Макс: те же группы из cost.py. Соответствие зон: развёртки ДП → номера зон разбора.
import { readFileSync, writeFileSync } from "node:fs";
import { estimate } from "../src/pricing";
import { buildZone, type ZoneId } from "./dp-2810-rooms";

const [costFile, outFile] = process.argv.slice(2);
type MaxItem = { name: string; sheets: number; ldsp: number; hdf: number; fac: number; hw: number; ex: number; total: number };
const max = JSON.parse(readFileSync(costFile, "utf8")) as { zones: [string, MaxItem[], number][] };
const byNo = (n: string) => max.zones.find(([z]) => z.startsWith(n + "."));
// зона студии → зоны разбора Макса (номер[:индексы изделий]); ванная = зона 8, душевая = 9 (тумба) + 10
const MAP: Record<ZoneId, { n: string; items?: number[] }[]> = {
  hall: [{ n: "1" }], tv: [{ n: "2" }], bedroom: [{ n: "4" }], loggia: [{ n: "5" }], kids: [{ n: "6" }, { n: "7" }], bath: [{ n: "8" }], shower: [{ n: "9" }, { n: "10" }],
};
const group = (id: string): string => /^(sheet:|work$|edge|small$|mat:)/.test(id) ? "ldsp" : /^(hdf|work-hdf|sheet-hdf)/.test(id) || /hdf/i.test(id) ? "hdf" : /^vernissage/.test(id) ? "facades" : /^(light|led)/.test(id) ? "light" : /^(worktop|alu-|glass|mirror)/.test(id) ? "stone_glass" : "hardware";
const rows: Record<string, unknown>[] = [];
for (const z of Object.keys(MAP) as ZoneId[]) {
  const { project } = buildZone(z), e = estimate(project);
  const g: Record<string, number> = {};
  for (const l of e.lines) { const k = group(l.id), v = l.quantity * (l.unitPrice ?? 0); g[k] = Math.round((g[k] ?? 0) + (l.retail ? 0 : v)); if (l.retail) g["retail:" + k] = Math.round((g["retail:" + k] ?? 0) + v); }
  const m = MAP[z].flatMap(({ n, items }) => { const zz = byNo(n); return zz ? zz[1].filter((_, i) => !items || items.includes(i)) : []; });
  const ms = (k: keyof MaxItem) => Math.round(m.reduce((s, i) => s + (i[k] as number), 0) * 10) / 10;
  rows.push({ zone: z, studio: { sheets: e.ldspSheets, cost: e.knownCost, groups: g, pendingOrMissing: [...e.pending, ...e.missing].map((l) => l.label), byMarkup: e.byMarkup, bySheet: e.bySheet, client: e.retail, model: e.model },
    max: { sheets: ms("sheets"), ldspWork: ms("ldsp"), hdf: ms("hdf"), facades: ms("fac"), hardware: ms("hw"), stoneGlass: ms("ex"), total: ms("total"), items: m.map((i) => i.name) } });
}
if (outFile) writeFileSync(outFile, JSON.stringify(rows, null, 1));
for (const r of rows as { zone: string; studio: { sheets: number; cost: number; groups: Record<string, number>; byMarkup: number | null; bySheet: number; client: number | null; model: string }; max: Record<string, number> }[])
  console.log(`${r.zone}: листы студия ${r.studio.sheets} / Макс ${r.max.sheets} · себестоимость студия ${r.studio.cost} / Макс ${r.max.total} · группы студии ${JSON.stringify(r.studio.groups)} · Макс ЛДСП+работа ${r.max.ldspWork}, ХДФ ${r.max.hdf}, фасады ${r.max.facades}, фурнитура ${r.max.hardware}, камень/стекло ${r.max.stoneGlass} · клиенту: коэф ${r.studio.byMarkup} / лист ${r.studio.bySheet} → ${r.studio.client} (${r.studio.model})`);
