// Правило Макса «в кухню из Базиса студия не добавляет того, чего нет в Базисе» — проверка по всем кухням сразу:
//  - детали: число панелей студии (плита, ХДФ, стекло) = число панелей Базиса (модули + «Ряд» как его собирает импорт);
//  - листы: толщины листов раскроя — только толщины плитных деталей Базиса (не «16.7» от повёрнутой детали);
//  - столешница: толщины строк worktop:raw — только толщины столешниц Базиса (не «16 мм» из полок пенала, не «6 мм» из макета);
//  - фурнитура: опоры, клипсы, навесы, конфирматы, шканты, петли — ровно счётчики Базиса;
//  - направляющие: комплекты по 2 шт. (левая + правая) = ящики Базиса по коробам (guideKits), не записи Базиса (правило Макса 10.10.2026);
//  - строки сметы, которых в Базисе нет вовсе (заглушки конфирмата, вырезы, подсветка, ножки шкафов) — должно быть 0;
//    строки-нормативы цеха («Мелочёвка корпуса», «Обработка деталей уже 70 мм», «Работа») показаны отдельно — это цена работ
//    и мелкого крепежа (шурупы, гвозди Базиса), а не детали.
// npx tsx scripts/kitchen/bazis-only.ts [--et=<эталоны>] [--dir=<папка проектов>] [--md=<out.md>]
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { parseProject } from "../../src/project";
import { parts } from "../../src/model";
import { estimate } from "../../src/pricing";
import { nest } from "../../src/exports";
import { rawThickness } from "../../src/rawModule";
import { rowPanelsOf, worktopGroupRole, type EtPanel } from "./rowWorktop";
import { guideKits, GUIDE_KIT_LINE } from "../../src/guideKits";

const argv = process.argv.slice(2), opt = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ET = opt("et") ?? "C:/Users/My PC/Desktop/Claude Project/Кухни/etalon", DIR = opt("dir") ?? "public/local-projects", MD = opt("md");
type H = { name: string; category: string };
type M = { panels: (EtPanel & { kind?: string })[]; hardware: H[] };
// строки, которых в Базисе нет вовсе (для кухни из Базиса должны отсутствовать)
const FORBIDDEN = /^(confirmat-cap|confirmat$|worktop-cut:|light-stand|legs|legs-m6|rod|flange|screw35x16|handle:|push-latch|pullout:|slide:|mesh:|pantograph|unplaced:)/;
// нормативы цеха — работа и мелкий крепёж (в Базисе шурупы/гвозди есть, но в смете — нормативом)
const SHOP = /^(kit|small|work)$/;
const isBoard = (k?: string) => k === "ldsp" || k === "mdf";
const r1 = (v: number) => Math.round(v * 10) / 10;

const rows: string[] = [], bad: string[] = [];
const tot = { kit: 0, small: 0, work: 0 }, kitTot = { s: 0, b: 0 };
for (const f of readdirSync(ET).filter((x) => /^k\d\d\.json$/.test(x)).sort()) {
  const k = f.slice(0, 3), file = `${DIR}/kitchen-${k}.json`;
  if (!existsSync(file)) { rows.push(`| ${k} | нет проекта | | | | | |`); continue; }
  const e = JSON.parse(readFileSync(`${ET}/${f}`, "utf8")), mods = e.modules as M[];
  const p = parseProject(JSON.parse(readFileSync(file, "utf8")));
  const rowP = rowPanelsOf(e.row);
  // Базис
  const bPanels = mods.reduce((s, m) => s + m.panels.length, 0) + rowP.length;
  const bThick = new Set([...mods.flatMap((m) => m.panels), ...rowP].filter((q) => isBoard(q.kind) && !/фасадн/i.test(q.mat ?? "")).map((q) => rawThickness(Number(q.thick) > 0 ? Number(q.thick) : Math.min(q.box[3] - q.box[0], q.box[4] - q.box[1], q.box[5] - q.box[2]))));
  const bWt = new Set(((e.row?.worktops ?? []) as EtPanel[]).filter((q) => worktopGroupRole(q) === "worktop").map((q) => Math.round(Number(q.thick))));
  // фурнитура ряда — и объекты «прочего»/профилей без габарита с категорией (k07 «Пенал на столешку»: навесы, петли, конфирматы)
  const rowLoose = (["other", "profiles"] as const).flatMap((g) => ((e.row?.[g] ?? []) as (H & { box?: number[] })[]).filter((x) => !Array.isArray(x.box) && x.category));
  const hw = [...mods.flatMap((m) => m.hardware), ...((e.row?.hardware ?? []) as H[]), ...rowLoose];
  const cnt = (c: string, rx?: RegExp) => hw.filter((h) => h.category === c && (!rx || rx.test(h.name.trim()))).length;
  const bHw: Record<string, number> = { "kitchen-leg": cnt("опора"), "kitchen-clip": cnt("клипса"), "kitchen-hanger": cnt("навес"), "confirmat-7x50": cnt("конфирмат"), dowel: cnt("шкант"), eccentric: cnt("эксцентрик"), "shelf-holder": cnt("полкодержатель"),
    hinge: cnt("петля", /^петля/i) + cnt("подъёмник", /^петля/i) + cnt("газлифт", /^петля/i) };
  // студия
  const sParts = p.modules.flatMap((a) => parts(a.module)).filter((d) => d.material === "board" || d.material === "hdf" || d.material === "glass");
  // петли — все строки петель (тип по Базису: hinge-inset, hinge-bazis:<тип>)
  const est = estimate(p), q = (id: string) => est.lines.filter((l) => l.id === id || l.id.startsWith(id + ":") || (id === "hinge" && /^hinge-(inset|bazis)/.test(l.id))).reduce((s, l) => s + l.quantity, 0);
  const sThick = [...new Set(nest(p).filter((s) => s.material !== "hdf").map((s) => s.thickness ?? 16))];
  const sWt = est.lines.filter((l) => l.id.startsWith("worktop:raw:")).map((l) => Number(l.id.slice(12)));
  const forb = est.lines.filter((l) => FORBIDDEN.test(l.id)).map((l) => `${l.id} ${r1(l.quantity)}`);
  for (const id of ["kit", "small", "work"] as const) tot[id] += q(id);
  // направляющие — комплектами по 2 шт. (левая + правая), N — ящики (правило Макса 10.10.2026): комплекты сметы = ящики Базиса по коробам
  // (guideKits по эталону модуля), не записи Базиса; направляющих штуками или парами в смете быть не должно
  const bKits = mods.reduce((s, m) => s + guideKits(m.panels, m.hardware).reduce((t, g) => t + g.n, 0), 0);
  const sKits = est.lines.filter((l) => GUIDE_KIT_LINE.test(l.id)).reduce((s, l) => s + l.quantity, 0);
  const notKit = est.lines.filter((l) => /направляющ/i.test(l.label) && l.unit !== "компл").map((l) => `${l.id} ${r1(l.quantity)} ${l.unit}`);
  kitTot.s += sKits; kitTot.b += bKits;
  const issues: string[] = [];
  if (sKits !== bKits) issues.push(`комплектов направляющих ${sKits} ≠ ящиков Базиса ${bKits}`);
  if (notKit.length) issues.push(`направляющие не комплектами: ${notKit.join("; ")}`);
  if (sParts.length !== bPanels) issues.push(`панелей ${sParts.length} ≠ ${bPanels}`);
  const oddT = sThick.filter((t) => !bThick.has(t)); if (oddT.length) issues.push(`лист толщиной ${oddT.join(", ")} — у Базиса таких плит нет`);
  const oddW = sWt.filter((t) => !bWt.has(t)); if (oddW.length) issues.push(`столешница ${oddW.join(", ")} мм — в Базисе нет`);
  for (const [id, n] of Object.entries(bHw)) if (Math.round(q(id)) !== n) issues.push(`${id} ${r1(q(id))} ≠ ${n}`);
  if (forb.length) issues.push(`строки не из Базиса: ${forb.join("; ")}`);
  if (issues.length) bad.push(k);
  rows.push(`| ${k} | ${sParts.length} / ${bPanels} | ${sThick.sort((a, b) => a - b).join(", ")} / ${[...bThick].sort((a, b) => a - b).join(", ")} | ${sWt.join(", ") || "—"} / ${[...bWt].join(", ") || "—"} | ${Object.entries(bHw).map(([id, n]) => `${Math.round(q(id))}=${n}`).join(" ")} | ${sKits}=${bKits} | ${q("kit")} · ${q("small")} · ${q("work")} | ${issues.join("; ") || "OK"} |`);
}
const head = ["| кухня | панелей студия / Базис | толщины листов студия / плит Базиса | столешница студия / Базис, мм | опоры клипсы навесы конфирматы шканты эксц. полкод. (студия=Базис) | направляющие: компл. = ящики | нормативы цеха: мелочёвка корп. · обраб. <70 · работа | вывод |", "|---|---|---|---|---|---|---|---|"];
const out = [...head, ...rows, "", `Кухонь с расхождениями: ${bad.length}${bad.length ? " (" + bad.join(", ") + ")" : ""}. Направляющие: комплектов ${kitTot.s}, ящиков Базиса ${kitTot.b}. Нормативы цеха всего: мелочёвка корпуса ${tot.kit}, обработка деталей уже 70 мм ${tot.small}, работа ${tot.work}.`].join("\n");
console.log(out);
if (MD) writeFileSync(MD, `# Кухни из Базиса: студия не добавляет того, чего нет в Базисе\n\nЭталоны: ${ET}\nПроекты: ${DIR}\n\n${out}\n`);
