// Сверка модуля студии с эталоном Базиса (Кухни\etalon\kNN.json, формат — Кухни\Статус ночи.md).
// Панели: сопоставление внутри класса (материал, толщина, ось толщины, фасад/корпус) венгерским алгоритмом по сумме отклонений граней;
// фурнитура: по категориям — число и точки привязки. PASS — все панели в допуске, лишних/недостающих нет, фурнитура совпала.
// CLI: npx tsx scripts/kitchen/compare.ts <kNN.json> <mKey> <project.json> <moduleIndex> [out.md]
import { readFileSync, writeFileSync } from "node:fs";
import { parts, type Module, type Part } from "../../src/model";
import { parseProject } from "../../src/project";

export type RefPanel = { i: number; name: string; mat: string; decor?: string; thick: number; kind: string; box: number[]; axis: string; texdir?: number; figure?: boolean };
export type RefHardware = { i: number; name: string; article?: string; category: string; mesh?: string | null; pos: number[]; quat?: number[]; host?: number | null };
export type RefModule = { key: string; name: string; archetype: string; size: number[]; panels: RefPanel[]; hardware: RefHardware[]; holes?: unknown[] };

type Box = [number, number, number, number, number, number];
type Item = { id: string; name: string; cls: string; box: Box };
export type PanelPair = { ref: Item; studio: Item; delta: number; faces: number[] };
export type HardwareRow = { category: string; ref: number; studio: number; maxPosDelta: number | null; note?: string };
export type Comparison = { pass: boolean; tol: number; pairs: PanelPair[]; missing: Item[]; extra: Item[]; hardware: HardwareRow[]; size: { ref: number[]; studio: number[] } };

const AX = ["x", "y", "z"];
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Класс панели: вид материала, толщина (округлённо), ось толщины, фасад или корпус. */
function cls(kind: string, thick: number, axis: string, facade: boolean) { return `${kind}|${Math.round(thick)}|${axis}|${facade ? "фасад" : "корпус"}`; }

function refItems(m: RefModule): Item[] {
  // Фасад Базиса — панель перед боковинами (её задняя грань не глубже передней кромки корпуса минус 1 мм)
  const bodyFront = Math.max(...m.panels.filter((p) => p.axis === "x" && p.kind !== "hdf").map((p) => p.box[5]), 0);
  return m.panels.filter((p) => ["ldsp", "hdf", "mdf", "glass"].includes(p.kind)).map((p) => {
    const facade = p.axis === "z" && p.box[2] >= bodyFront - 1 && p.kind !== "hdf";
    const kind = p.kind === "mdf" ? "ldsp" : p.kind;
    return { id: `b${p.i}`, name: p.name, cls: cls(kind, p.thick, p.axis, facade), box: p.box.map(r1) as Box };
  });
}
function studioItems(ps: Part[]): Item[] {
  return ps.filter((p) => (p.material === "board" || p.material === "hdf" || p.material === "glass") && !p.external).map((p) => {
    const ax = p.size.indexOf(Math.min(...p.size)), facade = p.role === "door" || p.id.endsWith(":facade");
    const kind = p.material === "board" ? "ldsp" : p.material;
    return { id: p.id, name: p.name, cls: cls(kind, Math.min(...p.size), AX[ax], facade), box: [0, 1, 2].flatMap((i) => [p.position[i] - p.size[i] / 2]).concat([0, 1, 2].map((i) => p.position[i] + p.size[i] / 2)).map(r1) as Box };
  }).map((it) => ({ ...it, box: [it.box[0], it.box[1], it.box[2], it.box[3], it.box[4], it.box[5]] as Box }));
}
const faceDelta = (a: Box, b: Box) => a.map((v, i) => Math.abs(v - b[i]));

/** Венгерский алгоритм (минимизация), матрица n×m, n ≤ m. */
function hungarian(c: number[][]): number[] {
  const n = c.length, m = c[0]?.length ?? 0, INF = 1e18, u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0; const minv = Array(m + 1).fill(INF), used = Array(m + 1).fill(false);
    do {
      used[j0] = true; const i0 = p[j0]; let delta = INF, j1 = 0;
      for (let j = 1; j <= m; j++) if (!used[j]) { const cur = c[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < delta) { delta = minv[j]; j1 = j; } }
      for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
  return res;
}

/** Категория фурнитуры студии по id детали. */
function studioCategory(p: Part): string | null {
  const id = p.id;
  if (id.startsWith("leg:")) return "опора";
  if (id.startsWith("kitchen-clip:")) return "клипса";
  if (id.startsWith("kitchen-hanger-cap:")) return "заглушка";
  if (id.startsWith("kitchen-hanger:")) return "навес";
  if (id.includes(":hingecup:")) return "петля";
  if (id.startsWith("fast:")) return "конфирмат";
  if (id.startsWith("ecc:") && !id.endsWith(":pin")) return "эксцентрик";
  if (id.startsWith("shp:")) return "полкодержатель";
  if (id.includes(":slide:")) return "направляющая";
  if (p.role === "handle") return "ручка";
  return null;
}
/** Точка привязки фурнитуры студии в осях Базиса: опора/клипса/навес — origin модели; петля — центр чашки на тыльной плоскости фасада. */
function studioAnchor(p: Part): number[] {
  if (p.model?.native && p.model.origin) return p.model.origin;
  if (p.id.includes(":hingecup:") && p.collide?.[0]) { const c = p.collide[0]; return [c.position[0], c.position[1], c.position[2] - c.size[2] / 2]; }
  return p.position;
}
/** Сопоставление точек одной категории (жадно по расстоянию), максимум отклонения. */
function matchPoints(a: number[][], b: number[][]): number | null {
  if (!a.length || !b.length) return null;
  const used = new Set<number>(); let worst = 0;
  for (const p of a) {
    let best = -1, bd = Infinity;
    b.forEach((q, j) => { if (used.has(j)) return; const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (d < bd) { bd = d; best = j; } });
    if (best >= 0) { used.add(best); worst = Math.max(worst, bd); }
  }
  return r1(worst);
}

export function compareModule(ref: RefModule, m: Module, tol = 0.5): Comparison {
  const ps = parts(m), A = refItems(ref), B = studioItems(ps), pairs: PanelPair[] = [], missing: Item[] = [], extra: Item[] = [];
  for (const c of new Set([...A, ...B].map((x) => x.cls))) {
    const a = A.filter((x) => x.cls === c), b = B.filter((x) => x.cls === c);
    if (!a.length) { extra.push(...b); continue; }
    if (!b.length) { missing.push(...a); continue; }
    const swap = a.length > b.length, rows = swap ? b : a, cols = swap ? a : b;
    const cost = rows.map((r) => cols.map((q) => faceDelta(r.box, q.box).reduce((s, v) => s + v, 0)));
    const asg = hungarian(cost), usedCols = new Set<number>();
    rows.forEach((r, i) => {
      const j = asg[i]; if (j < 0) return; usedCols.add(j);
      const q = cols[j], [ra, sb] = swap ? [q, r] : [r, q], faces = faceDelta(ra.box, sb.box);
      pairs.push({ ref: ra, studio: sb, delta: r1(Math.max(...faces)), faces: faces.map(r1) });
    });
    cols.forEach((q, j) => { if (!usedCols.has(j)) (swap ? missing : extra).push(q); });
  }
  // Пары с отклонением больше 50 мм — это не одна и та же деталь: считаем недостающей + лишней
  for (const pr of [...pairs]) if (pr.delta > 50) { pairs.splice(pairs.indexOf(pr), 1); missing.push(pr.ref); extra.push(pr.studio); }
  const cats = new Set<string>([...ref.hardware.map((h) => h.category), ...ps.map(studioCategory).filter((x): x is string => !!x)]);
  const hardware: HardwareRow[] = [...cats].map((category) => {
    const rp = ref.hardware.filter((h) => h.category === category).map((h) => h.pos), sp = ps.filter((p) => studioCategory(p) === category).map(studioAnchor);
    return { category, ref: rp.length, studio: sp.length, maxPosDelta: matchPoints(rp, sp) };
  });
  const tolOf = (p: PanelPair) => (p.ref.cls.startsWith("hdf") ? Math.max(1, tol) : tol);
  const hwOk = hardware.every((h) => h.ref === h.studio && (h.maxPosDelta === null || h.maxPosDelta <= (["конфирмат", "полкодержатель", "эксцентрик", "шкант"].includes(h.category) ? 2 : 1)));
  const pass = !missing.length && !extra.length && pairs.every((p) => p.delta <= tolOf(p)) && hwOk;
  return { pass, tol, pairs, missing, extra, hardware, size: { ref: ref.size, studio: [m.width, m.height, m.depth] } };
}

/** Эталон из модуля студии (для самопроверки сверщика мутациями). */
export function refFromStudio(m: Module, key = "self"): RefModule {
  const ps = parts(m);
  const panels: RefPanel[] = ps.filter((p) => (p.material === "board" || p.material === "hdf" || p.material === "glass") && !p.external).map((p, i) => {
    const ax = p.size.indexOf(Math.min(...p.size));
    return { i, name: p.name, mat: p.material, thick: Math.min(...p.size), kind: p.material === "board" ? "ldsp" : p.material, axis: AX[ax], box: [0, 1, 2].map((k) => p.position[k] - p.size[k] / 2).concat([0, 1, 2].map((k) => p.position[k] + p.size[k] / 2)) };
  });
  // фасад студии — тоже «перед боковинами», как у Базиса
  const hardware: RefHardware[] = ps.map((p) => ({ p, c: studioCategory(p) })).filter((x) => x.c).map((x, i) => ({ i, name: x.p.name, category: x.c!, pos: studioAnchor(x.p) }));
  return { key, name: m.name, archetype: "self", size: [m.width, m.height, m.depth], panels, hardware };
}

export function comparisonMarkdown(ref: RefModule, c: Comparison): string {
  let md = `## Сверка ${ref.key} «${ref.name}» (${ref.archetype}) — ${c.pass ? "PASS" : "FAIL"}\n\nГабарит Базиса ${c.size.ref.join("×")}, студии ${c.size.studio.join("×")}. Допуск панелей ±${c.tol} мм (ХДФ ±1).\n\n`;
  md += "| Базис | студия | max Δ | Δ граней x0 y0 z0 x1 y1 z1 |\n|---|---|---|---|\n";
  for (const p of [...c.pairs].sort((a, b) => b.delta - a.delta)) md += `| ${p.ref.name} (${p.ref.cls}) | ${p.studio.name} | ${p.delta > c.tol ? "**" + p.delta + "**" : p.delta} | ${p.faces.join(" ")} |\n`;
  if (c.missing.length) md += `\n**Нет в студии:** ${c.missing.map((x) => `${x.name} [${x.cls}] ${x.box.join(",")}`).join("; ")}\n`;
  if (c.extra.length) md += `\n**Лишнее в студии:** ${c.extra.map((x) => `${x.name} [${x.cls}] ${x.box.join(",")}`).join("; ")}\n`;
  md += "\n| фурнитура | Базис | студия | max Δ точки, мм |\n|---|---|---|---|\n";
  for (const h of c.hardware) md += `| ${h.category} | ${h.ref} | ${h.studio}${h.ref !== h.studio ? " ≠" : ""} | ${h.maxPosDelta ?? "—"} |\n`;
  return md;
}

if (process.argv[1]?.endsWith("compare.ts")) {
  const [etalon, key, project, index, out] = process.argv.slice(2);
  const ref = (JSON.parse(readFileSync(etalon, "utf8")).modules as RefModule[]).find((m) => m.key === key);
  if (!ref) throw Error("нет модуля " + key);
  const m = parseProject(JSON.parse(readFileSync(project, "utf8"))).modules[Number(index)].module;
  const md = comparisonMarkdown(ref, compareModule(ref, m));
  if (out) writeFileSync(out, md); else console.log(md);
}
