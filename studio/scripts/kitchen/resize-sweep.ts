// Редактируемость PASS-модулей кухонь Базиса (пакет 0): каждый модуль, сверенный с эталоном (honestPass), правится как в панели —
// ширина ±100 (только поле, как KitchenPanel «Ширина») и высота ±100 (поле + refitKDrawers, как «Высота») — и считается:
// ошибки validate, «тихие» пересечения (partCollisions без пометки «как в Базисе»), фурнитура в воздухе (bazisAirHardware),
// крепёж/опоры за габаритом модуля и потерянные пометки «как в Базисе» у пересечений в пазу подсветки (grooveHoles).
// Причина поломок — поля kitchen.*, хранящие координаты Базиса вместо правила «от кромки детали + сторона».
// npx tsx scripts/kitchen/resize-sweep.ts [out.md] [архетипы через запятую]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { parts, validate, type Module, type Part } from "../../src/model";
import { bazisAirHardware, partCollisions } from "../../src/collisions";
import { refitKDrawers } from "../../src/kitchenDrawers";
import { compareModule, grooveTwins, honestPass, type RefModule } from "./compare";
import { moduleFromEtalon } from "./fromEtalon";

export const ETALON_DIR = "C:/Users/My PC/Desktop/Claude Project/Кухни/etalon";
export type ResizeChange = "width-100" | "width+100" | "height-100" | "height+100";
export const RESIZE_CHANGES: ResizeChange[] = ["width-100", "width+100", "height-100", "height+100"];
export type ResizeHit = { kitchen: string; key: string; name: string; archetype: string; change: ResizeChange; errors: string[]; collisions: string[]; air: string[]; outside: string[]; lostMark: number };
export type ResizeResult = { modules: number; runs: number; hits: ResizeHit[]; skipped: { kitchen: string; key: string; why: string }[] };

/** Правка размера теми же действиями, что поля панели кухни (KitchenPanel «Ширина»/«Высота»). */
export function applyResize(m: Module, change: ResizeChange): Module {
  const n: Module = structuredClone(m);
  const d = change.endsWith("-100") ? -100 : 100;
  if (change.startsWith("width")) n.width += d;
  else { n.height += d; if (n.kdrawers) n.kdrawers = refitKDrawers(n, "height"); }
  return n;
}
/** Точка детали для проверки «за габаритом»: точка крепления (anchor/origin) или центр. */
const pt = (p: Part): [number, number, number] => (p.anchor ?? p.model?.origin ?? p.position) as [number, number, number];
/** Металл и опоры за габаритом модуля (x вне 0…W, y вне −опоры…H, z вне 0…D+50) — крепёж по координатам Базиса остался без детали. */
export function outsideParts(m: Module, ps: Part[]): string[] {
  const W = m.width, H = m.height, D = m.depth, y0 = -(m.feet?.height ?? 0) - 1;
  return ps.filter((p) => p.material === "metal" && !p.id.startsWith("kitchen-hanger")).filter((p) => { const [x, y, z] = pt(p); return x < -1 || x > W + 1 || y < y0 || y > H + 1 || z < -30 || z > D + 50; }).map((p) => `${p.id} (${pt(p).map(Math.round).join(",")})`);
}
export function checkModule(m: Module): { errors: string[]; collisions: string[]; marked: number; grooveUnmarked: number; air: string[]; outside: string[] } {
  const errors = validate(m);
  const ps = parts(m);
  const cs = partCollisions(ps, m);
  const groove = (c: { a: string; b: string }) => c.a.startsWith("groove:") || c.b.startsWith("groove:");
  return { errors, collisions: cs.filter((c) => !c.bazis).map((c) => `${c.names[0]} × ${c.names[1]} (${c.depth})`), marked: cs.filter((c) => c.bazis).length, grooveUnmarked: cs.filter((c) => !c.bazis && groove(c)).length, air: bazisAirHardware(ps, m).map((a) => `${a.name} (${a.gap})`), outside: outsideParts(m, ps) };
}

/** PASS-модули всех эталонов (или заданных архетипов) с модулем студии, как его строит импорт (grooveTwins — как buildKitchen). */
export function passModules(archs?: Set<string>, dir = ETALON_DIR): { kitchen: string; ref: RefModule; module: Module }[] {
  const out: { kitchen: string; ref: RefModule; module: Module }[] = [];
  for (const f of readdirSync(dir).filter((x) => /^k\d\d\.json$/.test(x)).sort()) {
    const e = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
    for (const ref of e.modules as RefModule[]) {
      if (archs && !archs.has(ref.archetype)) continue;
      try {
        const { module: m, unsupported } = moduleFromEtalon(ref);
        const c = compareModule(ref, m);
        if (!honestPass(c, validate(m), unsupported)) continue;
        out.push({ kitchen: f.slice(0, 3), ref, module: grooveTwins(ref, m, c) });
      } catch { /* модуль не распознан — не PASS */ }
    }
  }
  return out;
}

export function resizeSweep(changes: ResizeChange[] = RESIZE_CHANGES, archs?: Set<string>, dir = ETALON_DIR): ResizeResult {
  const hits: ResizeHit[] = [], skipped: ResizeResult["skipped"] = [];
  let runs = 0;
  const mods = passModules(archs, dir);
  for (const { kitchen, ref, module: m } of mods) {
    const base = checkModule(m);
    if (base.errors.length || base.collisions.length) { skipped.push({ kitchen, key: ref.key, why: base.errors[0] ?? base.collisions[0] }); continue; }
    for (const change of changes) {
      const n = applyResize(m, change);
      runs++;
      const r = checkModule(n);
      const lostMark = Math.max(0, r.grooveUnmarked - base.grooveUnmarked); // пересечение в пазу есть, а пометки «как в Базисе» больше нет
      const air = r.air.filter((a) => !base.air.includes(a)), outside = r.outside.filter((o) => !base.outside.includes(o));
      if (r.errors.length || r.collisions.length || air.length || outside.length || lostMark) hits.push({ kitchen, key: ref.key, name: ref.name, archetype: ref.archetype, change, errors: r.errors, collisions: r.collisions, air, outside, lostMark });
    }
  }
  return { modules: mods.length, runs, hits, skipped };
}

const short = (s: string) => s.replace(/[\d.,−-]+/g, "#").slice(0, 70);
export function resizeReport(r: ResizeResult, changes: ResizeChange[] = RESIZE_CHANGES): string {
  const L = [`# Редактируемость PASS-модулей: модулей ${r.modules}, прогонов ${r.runs}, прогонов с замечаниями ${r.hits.length}`, ""];
  L.push("| правка | ошибки validate | тихие пересечения | в воздухе | за габаритом | потеря «как в Базисе» | всего прогонов с замечанием |", "|---|---|---|---|---|---|---|");
  for (const c of changes) {
    const hs = r.hits.filter((h) => h.change === c);
    L.push(`| ${c} | ${hs.filter((h) => h.errors.length).length} | ${hs.filter((h) => h.collisions.length).length} | ${hs.filter((h) => h.air.length).length} | ${hs.filter((h) => h.outside.length).length} | ${hs.filter((h) => h.lostMark).length} | ${hs.length} |`);
  }
  L.push("", "## Частые причины");
  const reasons = new Map<string, number>();
  for (const h of r.hits) for (const s of [...h.errors.map((e) => "ошибка: " + e), ...h.collisions.map((e) => "пересечение: " + e), ...h.air.map((e) => "в воздухе: " + e), ...h.outside.map((e) => "за габаритом: " + e.split(" ")[0]), ...(h.lostMark ? ["потеря пометки «как в Базисе»"] : [])]) { const k = short(s); reasons.set(k, (reasons.get(k) ?? 0) + 1); }
  for (const [k, n] of [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 40)) L.push(`- ${n} × ${k}`);
  L.push("", "## Прогоны с замечаниями", "", "| к | модуль | имя | архетип | правка | ошибки | пересечения | в воздухе | за габаритом | потеря пометки |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const h of r.hits) L.push(`| ${h.kitchen} | ${h.key} | ${h.name} | ${h.archetype} | ${h.change} | ${h.errors.slice(0, 2).join("; ")} | ${h.collisions.slice(0, 2).join("; ")} | ${h.air.slice(0, 2).join("; ")} | ${h.outside.slice(0, 2).join("; ")} | ${h.lostMark || ""} |`.replace(/\|(?=[^|]*$)/, "|"));
  if (r.skipped.length) { L.push("", "## PASS-модули с замечанием уже на исходном размере (не прогонялись)"); for (const s of r.skipped) L.push(`- ${s.kitchen} ${s.key}: ${s.why}`); }
  return L.join("\n");
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("kitchen/resize-sweep.ts")) {
  const [out, archArg] = process.argv.slice(2);
  const r = resizeSweep(RESIZE_CHANGES, archArg ? new Set(archArg.split(",")) : undefined);
  const md = resizeReport(r);
  if (out) writeFileSync(out, md);
  console.log(md.split("\n## Прогоны")[0]);
}
