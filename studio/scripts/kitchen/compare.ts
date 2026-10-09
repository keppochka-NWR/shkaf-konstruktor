// Сверка модуля студии с эталоном Базиса (Кухни\etalon\kNN.json, формат — Кухни\Статус ночи.md).
// Панели: сопоставление внутри класса (материал, толщина, ось толщины, фасад/корпус) венгерским алгоритмом по сумме отклонений граней;
// фурнитура: по категориям — число и точки привязки. PASS — все панели в допуске, лишних/недостающих нет, фурнитура совпала.
// CLI: npx tsx scripts/kitchen/compare.ts <kNN.json> <mKey> <project.json> <moduleIndex> [out.md]
import { readFileSync, writeFileSync } from "node:fs";
import { parts, type Module, type Part } from "../../src/model";
import { parseProject } from "../../src/project";
import { holes as studioHoles } from "../../src/drilling";
import { edgeByDir } from "../../src/edges";
import { refGrooves as refGroovesOf } from "./fromEtalon";

export type RefPanel = { i: number; name: string; mat: string; decor?: string; thick: number; kind: string; box: number[]; axis: string; texdir?: number; figure?: boolean };
export type RefHardware = { i: number; name: string; article?: string; category: string; mesh?: string | null; pos: number[]; quat?: number[]; host?: number | null };
export type RefHole = { panel: number; face: string; at: number[]; dir: number[]; d: number; depth: number; src?: number | null };
export type RefModule = { key: string; name: string; archetype: string; size: number[]; panels: RefPanel[]; hardware: RefHardware[]; holes?: RefHole[] };

type Box = [number, number, number, number, number, number];
type Item = { id: string; name: string; cls: string; box: Box };
export type PanelPair = { ref: Item; studio: Item; delta: number; faces: number[] };
export type HardwareRow = { category: string; ref: number; studio: number; maxPosDelta: number | null; note?: string };
export type HoleCheck = { ref: number; studio: number; matched: number; maxDelta: number; missing: string[]; extra: string[] };
export type EdgeCheck = { checked: number; bad: string[] };
export type Comparison = { edges?: EdgeCheck; pass: boolean; tol: number; pairs: PanelPair[]; missing: Item[]; extra: Item[]; hardware: HardwareRow[]; holes?: HoleCheck; deviations?: string[]; size: { ref: number[]; studio: number[] } };

const AX = ["x", "y", "z"];
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Класс панели: вид материала, толщина (округлённо), ось толщины, фасад или корпус. */
function cls(kind: string, thick: number, axis: string, facade: boolean) { return facade ? `фасад|${Math.round(thick)}|${axis}` : `${kind}|${Math.round(thick)}|${axis}|корпус`; }

function refItems(m: RefModule): Item[] {
  // Фасад Базиса — панель перед боковинами (её задняя грань не глубже передней кромки корпуса минус 1 мм)
  const bodyFront = Math.max(...m.panels.filter((p) => p.axis === "x" && p.kind !== "hdf").map((p) => p.box[5]), 0);
  return m.panels.filter((p) => ["ldsp", "hdf", "mdf", "glass", "other"].includes(p.kind)).map((p) => {
    const facade = p.axis === "z" && p.box[2] >= bodyFront - 1 && p.kind !== "hdf";
    const kind = p.kind === "mdf" || p.kind === "other" ? "ldsp" : p.kind;
    return { id: `b${p.i}`, name: p.name, cls: cls(kind, p.thick, p.axis, facade), box: p.box.map(r1) as Box };
  });
}
function studioItems(ps: Part[]): Item[] {
  // фасады из фасадного материала — вне раскроя (external), но геометрию сверяем; столешница и прочее стороннее — нет
  return ps.filter((p) => (p.material === "board" || p.material === "hdf" || p.material === "glass") && (!p.external || p.role === "door" || p.id.endsWith(":facade"))).map((p) => {
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
  if (id.startsWith("kitchen-leg-screw:")) return "прочее";
  if (id.startsWith("kitchen-hanger-cap:")) return "заглушка";
  if (id.startsWith("kitchen-hanger:")) return "навес";
  if (id.includes(":hingeplate:")) return "петля";
  if (id.startsWith("lift:")) return id.includes(":screw:") ? "прочее" : "газлифт";
  if (id.startsWith("fast:")) return "конфирмат";
  if (id.startsWith("ecc:") && !id.endsWith(":pin")) return "эксцентрик";
  if (id.startsWith("dowel:")) return "шкант";
  if (id.startsWith("shp:")) return "полкодержатель";
  if (id.includes(":slide:")) return "направляющая";
  if (id.startsWith("kd:") && id.includes(":sys:")) return "ящик-система";
  if (id.startsWith("kd:") && id.includes(":cap:")) return "заглушка";
  if (id.startsWith("kd:") && id.includes(":screw:")) return "прочее";
  if (p.role === "handle") return "ручка";
  return null;
}
/** Точка привязки фурнитуры студии в осях Базиса: опора/клипса/навес — origin модели; петля — центр чашки на тыльной плоскости фасада. */
function studioAnchor(p: Part): number[] {
  // петля Базиса — точка «внутренняя плоскость стойки × тыльная плоскость фасада» на оси петли = origin плеча в студии
  if (p.model?.native && p.model.origin) return p.model.origin;
  if (p.anchor) return p.anchor;
  if (p.id.startsWith("dowel:")) { const inward = p.id.includes(":left:") ? 1 : -1; return [p.position[0] - inward * 3 - inward * 16, p.position[1], p.position[2]]; } // шкант у Базиса — на наружной грани стойки
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

/** Отступления (реестр): профили-экструзии Базиса («Профиль», «Профиль1») — без сетки, контур в эталон не извлекается; не воспроизводятся, в отчёте — отдельной строкой. */
export const isDeviation = (h: RefHardware) => /^Профиль/.test(h.name) && !h.mesh;

export function compareModule(ref0: RefModule, m: Module, tol = 0.5): Comparison {
  const deviations = ref0.hardware.filter(isDeviation).map((h) => h.name), ref: RefModule = { ...ref0, hardware: ref0.hardware.filter((h) => !isDeviation(h)) };
  const ps = parts(m), A0 = refItems(ref), B0 = studioItems(ps), pairs: PanelPair[] = [], missing: Item[] = [], extra: Item[] = [];
  // Общая точка отсчёта: минимальный угол габарита панелей (у Базиса ХДФ на z 0..3 и боковины с 3, у студии боковины с 0 и ХДФ на −3..0).
  const corner = (xs: Item[]) => [0, 1, 2].map((i) => Math.min(...xs.map((x) => x.box[i])));
  const oa = corner(A0), ob = corner(B0);
  const shift = (x: Item, o: number[]): Item => ({ ...x, box: x.box.map((v, i) => r1(v - o[i % 3])) as Box });
  const A = A0.map((x) => shift(x, oa)), B = B0.map((x) => shift(x, ob));
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
    const rp = ref.hardware.filter((h) => h.category === category).map((h) => h.pos.map((v, i) => v - oa[i])), sp = ps.filter((p) => studioCategory(p) === category).map(studioAnchor).map((q) => q.map((v, i) => v - ob[i]));
    const row: HardwareRow = { category, ref: rp.length, studio: sp.length, maxPosDelta: matchPoints(rp, sp) };
    // Газлифт: кроме точки — поворот узла (кватернион Базиса [w,x,y,z], q и −q — один поворот) у ближайшей детали студии.
    const sq = category === "газлифт" ? ps.filter((p) => studioCategory(p) === category) : [];
    if (sq.length) {
      const bad = ref.hardware.filter((h) => h.category === category && h.quat).filter((h) => {
        const pt = h.pos.map((v, i) => v - oa[i]); let best: Part | undefined, bd = Infinity;
        sq.forEach((p) => { const q = studioAnchor(p).map((v, i) => v - ob[i]), d = Math.hypot(pt[0] - q[0], pt[1] - q[1], pt[2] - q[2]); if (d < bd) { bd = d; best = p; } });
        const q = best?.model?.quat; if (!q) return true;
        const n = Math.hypot(...h.quat!) * Math.hypot(...q);
        return Math.abs(h.quat!.reduce((s, v, i) => s + v * q[i], 0)) / n < 0.999;
      }).length;
      if (bad) row.note = `поворот ≠ ×${bad}`;
    }
    return row;
  });
  const tolOf = (p: PanelPair) => (p.ref.cls.startsWith("hdf") ? Math.max(1, tol) : tol);
  const hwOk = hardware.every((h) => h.ref === h.studio && !h.note && (h.maxPosDelta === null || h.maxPosDelta <= (["конфирмат", "полкодержатель", "эксцентрик", "шкант"].includes(h.category) ? 2 : 1)));
  // Отверстия: на каждой сопоставленной паре панелей — тот же диаметр, глубина, направление; точка входа ±0,5 мм.
  let holeCheck: HoleCheck | undefined;
  if (ref.holes) {
    const sh = studioHoles(m, ps), used = new Set<number>(), pairOf = new Map(pairs.map((p) => [p.ref.id, p.studio.id]));
    const hc: HoleCheck = { ref: ref.holes.length, studio: sh.length, matched: 0, maxDelta: 0, missing: [], extra: [] };
    const seenH = new Set<string>();
    for (const h of ref.holes) {
      if (h.panel === null || h.panel === undefined) { hc.ref--; continue; }
      const hk = `${h.panel}|${h.at.map(r1).join(",")}|${h.d}|${h.depth}|${h.dir.join(",")}`;
      if (seenH.has(hk)) { hc.ref--; continue; } // дубль Базиса: одно и то же отверстие от двух деталей фурнитуры
      seenH.add(hk); // отверстие в корпусе фурнитуры (навес), не в панели
      const sid = pairOf.get("b" + h.panel), at = h.at.map((v, i) => v - oa[i]);
      let best = -1, bd = Infinity;
      sh.forEach((s, j) => {
        if (used.has(j) || s.part !== sid || s.d !== h.d || Math.abs(s.depth - h.depth) > 0.5 || s.dir[0] * h.dir[0] + s.dir[1] * h.dir[1] + s.dir[2] * h.dir[2] < 0.99) return;
        const dd = Math.hypot(...s.at.map((v, i) => v - ob[i] - at[i])); if (dd < bd) { bd = dd; best = j; }
      });
      if (best >= 0 && bd <= 5) { used.add(best); hc.matched++; hc.maxDelta = Math.max(hc.maxDelta, r1(bd)); }
      else hc.missing.push(`D${h.d}×${h.depth} ${h.face} панель ${h.panel} (${at.map(r1).join(",")})`);
    }
    sh.forEach((s, j) => { if (!used.has(j)) hc.extra.push(`D${s.d}×${s.depth} ${s.part.replace(/^[0-9a-f-]{36}/, "S")} (${s.at.map((v, i) => r1(v - ob[i])).join(",")})`); });
    holeCheck = hc;
  }
  // кромка: у каждой пары панелей — те же кромленые торцы и толщина (фасады из фасадного материала и ХДФ — без кромки)
  const edgeCheck: EdgeCheck = { checked: 0, bad: [] }, byId = new Map(ps.map((p) => [p.id, p]));
  for (const pr of pairs) {
    const rp = ref.panels.find((p) => "b" + p.i === pr.ref.id) as (RefPanel & { edges?: { side: string; thick: number }[] }) | undefined, sp = byId.get(pr.studio.id);
    if (!rp || !sp || !rp.edges) continue;
    edgeCheck.checked++;
    const want: Record<string, number> = {}; for (const e of rp.edges) if (e.thick > 0) want[e.side] = e.thick;
    const have = edgeByDir(sp), keys = new Set([...Object.keys(want), ...Object.keys(have)]);
    const diff = [...keys].filter((k) => Math.abs((want[k] ?? 0) - (have[k] ?? 0)) > 0.01);
    // длина кромки по стороне: у Базиса кромка — отрезками контура; сумма меньше стороны — вырез (Gola и т. п.), которого нет у прямоугольника студии
    const AXI: Record<string, number> = { x: 0, y: 1, z: 2 }, t = sp.size.indexOf(Math.min(...sp.size));
    for (const k of Object.keys(want)) {
      const lens = (rp.edges as { side: string; thick: number; len?: number }[]).filter((e) => e.side === k && e.thick > 0 && e.len !== undefined).map((e) => e.len!);
      if (!lens.length) continue;
      const along = [0, 1, 2].find((i) => i !== t && i !== AXI[k[1]])!, sum = lens.reduce((s, v) => s + v, 0);
      const sl = sp.edgeLen?.[k] ?? sp.size[along];
      if (Math.abs(sum - sl) > 1) edgeCheck.bad.push(`${pr.ref.name}: кромка ${k} у Базиса ${r1(sum)} мм (${lens.map(r1).join(" + ")}), у студии ${r1(sl)}${sp.edgeLen?.[k] !== undefined ? " (контур с вырезами)" : " — фигурный контур (вырез), в студии прямоугольник"}`);
    }
    if (diff.length) edgeCheck.bad.push(`${pr.ref.name}: ${diff.map((k) => `${k} Базис ${want[k] ?? 0} / студия ${have[k] ?? 0}`).join(", ")}`);
  }
  // пазы (кроме паза под задник): у Базиса — по панелям эталона (проходы слиты), у студии — детали groove:*
  const backPanel = ref.panels.filter((p) => p.kind === "hdf").sort((a, b) => (b.box[3] - b.box[0]) * (b.box[4] - b.box[1]) - (a.box[3] - a.box[0]) * (a.box[4] - a.box[1]))[0];
  const rg = refGroovesOf(ref, backPanel ? r1(backPanel.box[2]) : null).map((g) => g.box.map((v, i) => v - oa[i % 3]));
  const sg = ps.filter((p) => p.id.startsWith("groove:")).map((p) => [0, 1, 2].map((i) => p.position[i] - p.size[i] / 2 - ob[i]).concat([0, 1, 2].map((i) => p.position[i] + p.size[i] / 2 - ob[i])));
  const grooveBad: string[] = [];
  const usedG = new Set<number>();
  for (const g of rg) {
    const j = sg.findIndex((s, k) => !usedG.has(k) && s.every((v, i) => Math.abs(v - g[i]) <= 0.6));
    if (j >= 0) usedG.add(j); else grooveBad.push(`нет паза ${g.map(r1).join(",")}`);
  }
  sg.forEach((s, k) => { if (!usedG.has(k)) grooveBad.push(`лишний паз ${s.map(r1).join(",")}`); });
  edgeCheck.bad.push(...grooveBad.map((x) => "пазы: " + x));
  const holesOk = !holeCheck || (!holeCheck.missing.length && !holeCheck.extra.length && holeCheck.maxDelta <= 0.5);
  const pass = !missing.length && !extra.length && pairs.every((p) => p.delta <= tolOf(p)) && hwOk && holesOk && !edgeCheck.bad.length;
  return { edges: edgeCheck, pass, tol, pairs, missing, extra, hardware, holes: holeCheck, deviations, size: { ref: ref.size, studio: [m.width, m.height, m.depth] } };
}

/** Эталон из модуля студии (для самопроверки сверщика мутациями). */
export function refFromStudio(m: Module, key = "self"): RefModule {
  const ps = parts(m);
  const panels: RefPanel[] = ps.filter((p) => (p.material === "board" || p.material === "hdf" || p.material === "glass") && !p.external).map((p, i) => {
    const ax = p.size.indexOf(Math.min(...p.size));
    return { i, name: p.name, mat: p.material, thick: Math.min(...p.size), kind: p.material === "board" ? "ldsp" : p.material, axis: AX[ax], box: [0, 1, 2].map((k) => p.position[k] - p.size[k] / 2).concat([0, 1, 2].map((k) => p.position[k] + p.size[k] / 2)) };
  });
  // фасад студии — тоже «перед боковинами», как у Базиса
  const hardware: RefHardware[] = ps.map((p) => ({ p, c: studioCategory(p) })).filter((x) => x.c).map((x, i) => ({ i, name: x.p.name, category: x.c!, pos: studioAnchor(x.p), ...(x.p.model?.quat ? { quat: [...x.p.model.quat] } : {}) }));
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
  if (c.edges) md += `\n**Кромка:** проверено пар ${c.edges.checked}${c.edges.bad.length ? "; расхождения: " + c.edges.bad.join("; ") : " — совпала"}\n`;
  if (c.holes) md += `\n**Отверстия:** Базис ${c.holes.ref}, студия ${c.holes.studio}, совпало ${c.holes.matched}, max Δ ${c.holes.maxDelta} мм${c.holes.missing.length ? "; нет в студии: " + c.holes.missing.join("; ") : ""}${c.holes.extra.length ? "; лишние: " + c.holes.extra.join("; ") : ""}\n`;
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
