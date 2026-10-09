// Цоколь по кухням: эталон Базиса (цоколь ряда и в модулях, клипсы) против проекта студии (цоколь в раскрое ЛДСП, в смете,
// клипсы в смете). «До» — проекты из общей папки (прежний импорт), «после» — новый импорт.
// npx tsx scripts/kitchen/plinth-report.ts --et=<эталоны> --before=<папка проектов до> --after=<папка проектов после> [--md=<out.md>]
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { parseProject, type Project } from "../../src/project";
import { parts } from "../../src/model";
import { estimate } from "../../src/pricing";

const argv = process.argv.slice(2), opt = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ET = opt("et") ?? "C:/Users/My PC/Desktop/Claude Project/Кухни/etalon";
const BEFORE = opt("before") ?? "public/local-projects", AFTER = opt("after") ?? "public/local-projects", MD = opt("md");
type P = { name: string; mat?: string; box: number[]; role?: string };
const len = (b: number[]) => Math.max(b[3] - b[0], b[5] - b[2]);
const r0 = (v: number) => Math.round(v);

function studio(dir: string, k: string) {
  const f = `${dir}/kitchen-${k}.json`;
  if (!existsSync(f)) return null;
  const p: Project = parseProject(JSON.parse(readFileSync(f, "utf8")));
  let cut = 0, cutLen = 0, ext = 0;
  for (const a of p.modules) for (const d of parts(a.module)) {
    if (d.material !== "board" || !/цокол/i.test(d.name)) continue;
    if (d.external) ext++; else { cut++; cutLen += Math.max(d.size[0], d.size[2]); } // длина вдоль ряда, как у эталона
  }
  const e = estimate(p), q = (id: string) => e.lines.find((l) => l.id === id)?.quantity ?? 0;
  return { cut, cutLen: r0(cutLen), ext, clips: q("kitchen-clip"), plinthFm: q("plinth-external") };
}

const rows: string[] = [];
rows.push("| кухня | клипс Базиса | цоколь Базиса: ряд / в модулях | длина ряда, мм | материал | студия до: деталей «Цоколь» в раскрое / внешн. | студия после: «Цоколь» в раскрое (длина, мм) / строка «Цоколь — фасадн. мат-л», м² | клипс в смете до → после | вывод |");
rows.push("|---|---|---|---|---|---|---|---|---|");
for (const f of readdirSync(ET).filter((x) => /^k\d\d\.json$/.test(x)).sort()) {
  const k = f.slice(0, 3), e = JSON.parse(readFileSync(`${ET}/${f}`, "utf8"));
  const clips = (e.modules as { hardware: { category: string }[] }[]).reduce((s, m) => s + m.hardware.filter((h) => h.category === "клипса").length, 0);
  const rowP = (e.row?.plinths ?? []) as P[];
  const inMod = (e.modules as { panels: P[] }[]).flatMap((m) => m.panels.filter((p) => p.role === "plinth"));
  const mats = [...new Set([...rowP, ...inMod].map((p) => (p.mat ?? "").replace(/\s*\(\d+мм\)/, "")))].join("; ");
  const b = studio(BEFORE, k), a = studio(AFTER, k);
  const has = rowP.length + inMod.length > 0;
  const verdict = !has && clips ? "в Базисе цоколь не заложен (только клипсы ПВХ-цоколя) — студия не добавляет"
    : !has ? "нет цоколя и клипс" : clips ? "цоколь Базиса + клипсы" : "цоколь Базиса без клипс";
  rows.push(`| ${k} | ${clips} | ${rowP.length} / ${inMod.length} | ${rowP.length ? r0(rowP.reduce((s, p) => s + len(p.box), 0)) : "—"} | ${mats || "—"} | ${b ? `${b.cut} / ${b.ext}` : "—"} | ${a ? `${a.cut} (${a.cutLen}) / ${a.plinthFm}` : "—"} | ${b ? b.clips : "—"} → ${a ? a.clips : "—"} | ${verdict} |`);
}
const out = rows.join("\n");
console.log(out);
if (MD) writeFileSync(MD, `# Цоколь по кухням\n\nЭталоны: ${ET}\n\n${out}\n`);
