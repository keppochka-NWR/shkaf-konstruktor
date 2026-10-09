// Аудит «что студия добавляет к кухне из Базиса»: детали parts() без пары в эталоне, автофальши проекта и строки сметы
// estimate() без соответствия фурнитуре/панелям Базиса. По всем кухням public/local-projects/kitchen-kNN.json.
// npx tsx scripts/kitchen/audit-additions.ts [k25,k04|all] [out.md] [папка проектов, по умолчанию public/local-projects]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { parts, type Module } from "../../src/model";
import { parseProject, applyAutoFillers, type Project } from "../../src/project";
import { estimate } from "../../src/pricing";
import { compareModule, type RefModule } from "./compare";

const ET = "C:/Users/My PC/Desktop/Claude Project/Кухни/etalon", LP = process.argv[4] ?? "public/local-projects";
const arg = process.argv[2] ?? "all", out = process.argv[3] || undefined;
const files = readdirSync(ET).filter((f) => /^k\d\d\.json$/.test(f)).sort().filter((f) => arg === "all" || arg.split(",").includes(f.slice(0, 3)));
// строки сметы, которым соответствует фурнитура/панели Базиса (категория эталона или деталь раскроя)
const BAZIS_LINE = /^(sheet:|edge|confirmat-7x50$|confirmat-euro-6x50$|wallpanel:raw:|plinth-external$|eccentric$|shelf-holder(:|$)|dowel$|kitchen-leg(:|$)|kitchen-clip$|kitchen-hanger$|hinge|lift-mechanism$|kitchen-lift:|axis-pro|firmax-ldsp|firmax:|indigo:|start-sc:|modern-slide:|versalite-h45:|gola-|facade-external$|mat:|bazis:|kitchen-hanger-cap$|glass-shelf$|worktop(?!-cut)|handle:)/;
const LABOUR = /^(work$|small$|unplaced:)/;
const agg = new Map<string, { label: string; kitchens: Set<string>; qty: number; sum: number }>();
const partAgg = new Map<string, { kitchens: Set<string>; n: number }>();
const fillers: string[] = [];
let md = "# Аудит: что студия добавляет к кухням из Базиса\n\n";
const totals: string[] = [];
for (const f of files) {
  const k = f.slice(0, 3), e = JSON.parse(readFileSync(`${ET}/${f}`, "utf8"));
  let p: Project;
  try { p = parseProject(JSON.parse(readFileSync(`${LP}/kitchen-${k}.json`, "utf8"))); } catch { md += `- ${k}: проекта нет\n`; continue; }
  // 1) автофальши при любой правке проекта (App.commitProject → applyAutoFillers)
  const q = applyAutoFillers(p);
  q.modules.forEach((a, i) => { const b = p.modules[i]; const wf = a.module.wallFiller ? Object.keys(a.module.wallFiller).join("+") : "", cf = a.module.cornerFiller ?? "", moved = Math.hypot(a.x - b.x, a.z - b.z);
    if (wf || cf || moved > 0.1) fillers.push(`${k} ${a.module.name}: ${wf ? "фальш у стены " + wf : ""}${cf ? " угловая фальш " + cf : ""}${moved > 0.1 ? ` · сдвиг ${Math.round(moved)} мм` : ""}`); });
  // 2) детали параметрических модулей без пары в эталоне
  (e.modules as RefModule[]).forEach((ref, i) => {
    const m = p.modules[i]?.module as Module | undefined; if (!m || m.raw) return;
    const c = compareModule(ref, m);
    for (const x of c.extra) { const key = "панель: " + x.name; const r = partAgg.get(key) ?? { kitchens: new Set(), n: 0 }; r.kitchens.add(k); r.n++; partAgg.set(key, r); }
    for (const h of c.hardware) if (h.studio > h.ref) { const key = `фурнитура «${h.category}» сверх Базиса`; const r = partAgg.get(key) ?? { kitchens: new Set(), n: 0 }; r.kitchens.add(k); r.n += h.studio - h.ref; partAgg.set(key, r); }
    for (const d of parts(m)) if (d.role === "light") { const key = "паз Базиса groove:* — деталь 3D role 'light' (справочно: не в раскрое; в смете — см. light-stand выше)"; const r = partAgg.get(key) ?? { kitchens: new Set(), n: 0 }; r.kitchens.add(k); r.n++; partAgg.set(key, r); }
    // количество в смете одного модуля против счётчиков Базиса (сверх Базиса — добавка студии)
    const one = estimate({ ...p, modules: [p.modules[i]] }), qty = (re: RegExp) => one.lines.filter((l) => re.test(l.id)).reduce((s, l) => s + l.quantity, 0);
    const refN = (pred: (h: { name: string; category: string }) => boolean) => ref.hardware.filter(pred).length;
    const checks: [string, number, number][] = [
      ["петли", qty(/^hinge/), refN((h) => h.category === "петля" && /^Петля/i.test(h.name))],
      ["полкодержатели", qty(/^shelf-holder$/), refN((h) => h.category === "полкодержатель")],
      ["эксцентрики", qty(/^eccentric$/), refN((h) => h.category === "эксцентрик")],
      ["конфирматы", qty(/^confirmat/) - qty(/^confirmat-cap$/), refN((h) => h.category === "конфирмат")],
      ["шканты", qty(/^dowel$/), refN((h) => h.category === "шкант")],
      ["опоры", qty(/^kitchen-leg$/), refN((h) => h.category === "опора")],
      ["клипсы", qty(/^kitchen-clip$/), refN((h) => h.category === "клипса")],
      ["навесы", qty(/^kitchen-hanger$/), refN((h) => h.category === "навес")],
      ["заглушки навесов", qty(/^kitchen-hanger-cap$/), refN((h) => h.category === "заглушка" && /навес/i.test(h.name))],
      ["газлифты (комплект на боковину)", qty(/^kitchen-lift:/), Math.ceil(refN((h) => h.category === "газлифт") / 2)],
      ["ручки", qty(/^handle:/), refN((h) => h.category === "ручка")],
      ["толкатели", qty(/^push-latch$/), 0],
      ["подъёмный механизм (без газлифта Базиса)", qty(/^lift-mechanism$/), 0],
    ];
    for (const [what, s, b] of checks) if (s > b) { const key = `смета: ${what} сверх Базиса`; const r = partAgg.get(key) ?? { kitchens: new Set(), n: 0 }; r.kitchens.add(k); r.n += s - b; partAgg.set(key, r); }
  });
  // 3) смета проекта
  const est = estimate(p);
  for (const l of est.lines) {
    if (BAZIS_LINE.test(l.id) || LABOUR.test(l.id)) continue;
    const r = agg.get(l.id) ?? { label: l.label, kitchens: new Set(), qty: 0, sum: 0 }; r.kitchens.add(k); r.qty += l.quantity; r.sum += l.quantity * (l.unitPrice ?? 0); agg.set(l.id, r);
  }
  const work = est.lines.find((l) => l.id === "work"), hdf = est.lines.find((l) => l.id === "sheet:hdf");
  if (work && hdf && work.quantity > est.ldspSheets) { const key = "Работа цеха на листах ХДФ"; const r = agg.get("work:hdf") ?? { label: key, kitchens: new Set(), qty: 0, sum: 0 }; r.kitchens.add(k); r.qty += hdf.quantity; r.sum += hdf.quantity * (work.unitPrice ?? 0); agg.set("work:hdf", r); }
  totals.push(`| ${k} | ${est.knownCost} | ${est.retailExtras} | ${est.byMarkup ?? "—"} | ${est.bySheet} | ${est.ldspSheets} |`);
}
md += "## Строки сметы без соответствия в Базисе (сумма по всем кухням, себестоимость/розница)\n\n| id | строка | кухонь | кол-во | сумма, ₽ |\n|---|---|---|---|---|\n";
for (const [id, r] of [...agg].sort((a, b) => b[1].sum - a[1].sum)) md += `| ${id} | ${r.label} | ${r.kitchens.size} | ${Math.round(r.qty * 100) / 100} | ${Math.round(r.sum)} |\n`;
md += "\n## Детали параметрических модулей без пары в эталоне\n\n| что | кухонь | шт |\n|---|---|---|\n";
for (const [key, r] of partAgg) md += `| ${key} | ${r.kitchens.size} (${[...r.kitchens].join(",")}) | ${r.n} |\n`;
md += `\n## Автофальши при первой правке проекта (applyAutoFillers): ${fillers.length}\n\n` + fillers.map((x) => "- " + x).join("\n") + "\n";
md += "\n## Итоги смет\n\n| кухня | себестоимость | розница сверху | по коэффициенту | по листам | листов ЛДСП |\n|---|---|---|---|---|---|\n" + totals.join("\n") + "\n";
if (out) writeFileSync(out, md); else console.log(md);
