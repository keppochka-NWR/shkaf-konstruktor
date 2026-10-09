// Пакетная сверка: все модули заданных архетипов из всех эталонов → таблица PASS/FAIL с главной причиной.
// npx tsx scripts/kitchen/batch.ts base-doors,wall [out.md]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { validate } from "../../src/model";
import { compareModule, type RefModule } from "./compare";
import { moduleFromEtalon } from "./fromEtalon";

const [archArg, out] = process.argv.slice(2);
const archs = new Set(archArg.split(","));
const dir = "C:/Users/My PC/Desktop/Claude Project/Кухни/etalon";
const rows: string[] = [];
let pass = 0, total = 0;
const reasons = new Map<string, number>();
for (const f of readdirSync(dir).filter((f) => /^k\d\d\.json$/.test(f)).sort()) {
  const e = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  for (const ref of e.modules as RefModule[]) {
    if (!archs.has(ref.archetype)) continue;
    total++;
    let line = `| ${f.slice(0, 3)} | ${ref.key} | ${ref.name} | ${ref.archetype} | ${ref.size.map(Math.round).join("×")} | `;
    try {
      const { module: m, unsupported } = moduleFromEtalon(ref);
      const err = validate(m), c = compareModule(ref, m);
      const why: string[] = [];
      if (err.length) why.push("студия: " + err[0]);
      if (unsupported.length) why.push(unsupported[0]);
      if (c.missing.length) why.push(`нет ${c.missing.length}: ${c.missing.slice(0, 2).map((x) => x.name + "[" + x.cls + "]").join(", ")}`);
      if (c.extra.length) why.push(`лишних ${c.extra.length}: ${c.extra.slice(0, 2).map((x) => x.name).join(", ")}`);
      const bad = c.pairs.filter((p) => p.delta > 0.5);
      if (bad.length) why.push(`Δ>0.5: ${bad.slice(0, 2).map((p) => p.ref.name + " " + p.delta).join(", ")}`);
      for (const h of c.hardware) if (h.ref !== h.studio || (h.maxPosDelta ?? 0) > 2 || h.note) why.push(`${h.category} ${h.ref}/${h.studio}${h.maxPosDelta ? " Δ" + h.maxPosDelta : ""}${h.note ? " " + h.note : ""}`);
      for (const h of c.hardware) if (h.info) why.push(`${h.category}: ${h.info} (сведения)`);
      if (c.holes && (c.holes.missing.length || c.holes.extra.length)) why.push(`отв. ${c.holes.matched}/${c.holes.ref} (+${c.holes.extra.length})`);
      if (c.pass && !err.length) pass++;
      for (const w of why) { const k = w.replace(/[\d.]+/g, "#").slice(0, 60); reasons.set(k, (reasons.get(k) ?? 0) + 1); }
      line += `${c.pass && !err.length ? "PASS" : "FAIL"} | ${why.join("; ").replace(/\|/g, "/")} |`;
    } catch (x) { line += `ОШИБКА | ${(x as Error).message} |`; reasons.set("ошибка распознавания", (reasons.get("ошибка распознавания") ?? 0) + 1); }
    rows.push(line);
  }
}
const md = `# Сверка модулей ${archArg}: PASS ${pass} из ${total}\n\n| к | модуль | имя | архетип | габарит | итог | причины |\n|---|---|---|---|---|---|---|\n${rows.join("\n")}\n\n## Частые причины\n${[...reasons].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => `- ${n} × ${k}`).join("\n")}\n`;
if (out) writeFileSync(out, md);
console.log(`PASS ${pass} из ${total}`);
console.log([...reasons].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, n]) => `${n} × ${k}`).join("\n"));
