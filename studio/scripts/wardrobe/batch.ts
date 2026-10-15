// Пакетная сверка шкафов: все модули эталонов Кухни/etalon-w/wNNN.json по архетипам → PASS/FAIL с причинами (как scripts/kitchen/batch.ts).
// npx tsx scripts/wardrobe/batch.ts [архетипы через запятую | all] [out.md] [out.json]
// Сверка — общая с кухнями (compareModule: панели ±0,5, фурнитура, отверстия, кромка), PASS — honestPass.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { validate } from "../../src/model";
import { compareModule, honestPass } from "../kitchen/compare";
import { wardrobeFromEtalon, type WRefModule } from "./fromEtalon";

export const ETALON_W = "C:/Users/My PC/Desktop/Claude Project/Кухни/etalon-w";
export const ARCHETYPES = ["kupe", "swing", "hallway", "antresol", "tumba", "desk", "open", "other", "part"] as const;

/** pass — честный PASS (honestPass: панели, фурнитура, отверстия, кромка); geom — совпали панели (±0,5, без лишних/недостающих) и модуль проходит validate. */
export type WardrobeVerdict = { file: string; key: string; archetype: string; pass: boolean; geom: boolean; /** всё сошлось, кроме кромки (схема кромки шкафов студии ≠ Базису — вопрос Максу, S_EDGE) */ noEdge?: boolean; why: string[] };

/** Сверка одного модуля эталона: распознать → validate → compareModule → honestPass. Причины — короткими строками. */
export function verdict(file: string, ref: WRefModule): WardrobeVerdict {
  const why: string[] = [];
  try {
    const { module: m, unsupported } = wardrobeFromEtalon(ref);
    const err = validate(m), c = compareModule(ref, m);
    if (err.length) why.push("студия: " + err[0]);
    for (const u of unsupported) why.push(u);
    if (c.missing.length) why.push(`нет ${c.missing.length}: ${c.missing.slice(0, 2).map((x) => x.cls).join(", ")}`);
    if (c.extra.length) why.push(`лишних ${c.extra.length}: ${c.extra.slice(0, 2).map((x) => x.name).join(", ")}`);
    const bad = c.pairs.filter((p) => p.delta > 0.5);
    if (bad.length) why.push(`Δ>0.5: ${bad.slice(0, 2).map((p) => p.studio.name + " " + p.delta).join(", ")}`);
    for (const h of c.hardware) if (h.ref !== h.studio || (h.maxPosDelta ?? 0) > 2 || h.note) why.push(`${h.category} ${h.ref}/${h.studio}${h.maxPosDelta ? " Δ" + h.maxPosDelta : ""}`);
    if (c.contours?.length) why.push(`контур: ${c.contours[0]}`);
    if (c.edges?.bad.length) why.push(`кромка: ${c.edges.bad[0]}`);
    if (c.holes && (c.holes.missing.length || c.holes.extra.length)) why.push(`отв. ${c.holes.matched}/${c.holes.ref} (+${c.holes.extra.length})`);
    return { file, key: ref.key, archetype: ref.archetype, pass: honestPass(c, err, unsupported), geom: !err.length && !c.missing.length && !c.extra.length && !bad.length,
      noEdge: why.length > 0 && why.every((w) => w.startsWith("кромка:")), why };
  } catch (x) {
    return { file, key: ref.key, archetype: ref.archetype, pass: false, geom: false, why: ["ошибка распознавания: " + (x as Error).message] };
  }
}

/** Ключ причины для свода (категории backlog-wardrobes.md): W_* распознавателя, правила студии, которые расходятся с Базисом
 *  (S_* — пределы validate, кромка, присадка конфирмата), геометрия панелей (G_*) и фурнитура по категориям (H_*). */
export function reasonKey(w: string): string {
  const code = /^(W_[A-Z_]+)/.exec(w)?.[1];
  if (code) return code;
  if (w.startsWith("студия: Высота")) return "S_LIMIT_HEIGHT";
  if (w.startsWith("студия: Ширина")) return "S_LIMIT_WIDTH";
  if (w.startsWith("студия: Глубина")) return "S_LIMIT_DEPTH";
  if (w.startsWith("студия:")) return "S_VALIDATE";
  if (w.startsWith("кромка:")) return /Базис 0 \/ студия 0\.4/.test(w) ? "S_EDGE_HIDDEN" : "S_EDGE";
  if (w.startsWith("отв.")) return "S_DRILL";
  if (w.startsWith("нет ")) return "G_MISSING";
  if (w.startsWith("лишних ")) return "G_EXTRA";
  if (w.startsWith("Δ>")) return "G_DELTA";
  if (w.startsWith("контур:")) return "G_CONTOUR";
  if (w.startsWith("ошибка")) return "ERROR";
  const hw = /^(\S+) \d+\/\d+/.exec(w);
  if (hw) return "H_" + hw[1];
  return w.replace(/[\d.]+/g, "#").replace(/:.*$/, "").slice(0, 40);
}

export function runBatch(archs: Set<string> | null) {
  const out: WardrobeVerdict[] = [];
  for (const f of readdirSync(ETALON_W).filter((f) => /^w\d{3}\.json$/.test(f)).sort()) {
    const e = JSON.parse(readFileSync(`${ETALON_W}/${f}`, "utf8")) as { modules: WRefModule[] };
    for (const ref of e.modules) if (!archs || archs.has(ref.archetype)) out.push(verdict(f.slice(0, 4), ref));
  }
  return out;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/wardrobe/batch.ts")) {
  const [archArg = "all", outMd, outJson] = process.argv.slice(2);
  const res = runBatch(archArg === "all" ? null : new Set(archArg.split(",")));
  const lines: string[] = [];
  const byArch = new Map<string, { n: number; pass: number; geom: number; noEdge: number; reasons: Map<string, number> }>();
  for (const v of res) {
    const a = byArch.get(v.archetype) ?? { n: 0, pass: 0, geom: 0, noEdge: 0, reasons: new Map() };
    a.n++; if (v.pass) a.pass++; if (v.geom) a.geom++; if (v.noEdge) a.noEdge++;
    for (const k of new Set(v.why.map(reasonKey))) a.reasons.set(k, (a.reasons.get(k) ?? 0) + 1);
    byArch.set(v.archetype, a);
  }
  const all = new Map<string, number>();
  for (const v of res) if (!v.pass) for (const k of new Set(v.why.map(reasonKey))) all.set(k, (all.get(k) ?? 0) + 1);
  lines.push(`# Сверка шкафов: PASS ${res.filter((v) => v.pass).length} из ${res.length}, панели совпали у ${res.filter((v) => v.geom).length}, всё кроме кромки — у ${res.filter((v) => v.noEdge).length}`, "", "| архетип | модулей | PASS | панели совпали | всё кроме кромки | главные причины FAIL |", "|---|---|---|---|---|---|");
  for (const a of ARCHETYPES) {
    const x = byArch.get(a); if (!x) continue;
    lines.push(`| ${a} | ${x.n} | ${x.pass} | ${x.geom} | ${x.noEdge} | ${[...x.reasons].sort((p, q) => q[1] - p[1]).slice(0, 4).map(([k, n]) => `${k} ×${n}`).join("; ")} |`);
  }
  lines.push("", "## Топ причин FAIL (модулей)", ...[...all].sort((p, q) => q[1] - p[1]).slice(0, 30).map(([k, n]) => `- ${n} × ${k}`));
  lines.push("", "## Модули", "| файл | модуль | архетип | итог | причины |", "|---|---|---|---|---|",
    ...res.map((v) => `| ${v.file} | ${v.key} | ${v.archetype} | ${v.pass ? "PASS" : "FAIL"} | ${v.why.join("; ").replace(/\|/g, "/").slice(0, 300)} |`));
  if (outMd) writeFileSync(outMd, lines.join("\n") + "\n");
  if (outJson) writeFileSync(outJson, JSON.stringify(res.map((v) => ({ file: v.file, key: v.key, archetype: v.archetype, pass: v.pass, geom: v.geom, noEdge: !!v.noEdge })), null, 1));
  console.log(lines.slice(0, 16 + byArch.size).join("\n"));
  console.log([...all].sort((p, q) => q[1] - p[1]).slice(0, 25).map(([k, n]) => `${n} × ${k}`).join("\n"));
}
