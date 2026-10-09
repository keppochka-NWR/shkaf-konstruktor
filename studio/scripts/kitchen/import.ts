// Импорт кухонь из эталонов Базиса в проекты студии: модуль, прошедший сверку (PASS), — параметрический; остальные — «сырые»
// (детали Базиса как есть). Расстановка и повороты — из эталона (p_world = origin + Ry(yaw)·p_mod). Объекты ряда (столешница,
// цоколь, стеновые панели, профили) — отдельный сырой объект «Ряд».
// npx tsx scripts/kitchen/import.ts [k14,k25|all] [outDir]  → public/local-projects/kitchen-kNN.json + kitchens.json (только локально, не публикуется);
// outDir — проверочный импорт в свою папку (общую local-projects не трогает, сетки фурнитуры не копирует)
import { readFileSync, readdirSync, writeFileSync, existsSync, copyFileSync, statSync } from "node:fs";
import { initialModule, id, validate, section, type Module } from "../../src/model";
import { newProject, parseProject, projectErrors, type PlacedModule } from "../../src/project";
import { compareModule, type RefModule } from "./compare";
import { moduleFromEtalon } from "./fromEtalon";
import { rawCounts, type RawSpec } from "../../src/rawModule";
import { rowRects, panelExtras, rowFront, rowPanelName, rowTitle, type EtPanel } from "./rowWorktop";

const ET = "C:/Users/My PC/Desktop/Claude Project/Кухни/etalon", LIB = "C:/Users/My PC/Desktop/Claude Project/Кухни/hardware-lib/glb", PUB = "public/models/hardware/bazis";
const OUTDIR = process.argv[3] ?? "public/local-projects";
const arg = process.argv[2] ?? "all";
const files = readdirSync(ET).filter((f) => /^k\d\d\.json$/.test(f)).sort().filter((f) => arg === "all" || arg.split(",").includes(f.slice(0, 3)));
const SHOW = new Set(["опора", "клипса", "навес", "заглушка", "петля", "подъёмник", "газлифт", "направляющая", "ящик-система", "ручка", "сушка", "карго", "профиль"]);
const r1 = (v: number) => Math.round(v * 10) / 10;
const look = { decor: "Белый", facadeDecor: "Слэйт" };
const index: { id: string; title: string; modules: number; parametric: number; raw: number }[] = existsSync(`${OUTDIR}/kitchens.json`) ? JSON.parse(readFileSync(`${OUTDIR}/kitchens.json`, "utf8")) : [];
const meshes = new Set<string>();

function rawFromRef(ref: RefModule): RawSpec {
  const D = ref.size[2];
  return {
    panels: ref.panels.map((p) => ({ name: p.name, kind: p.kind, box: p.box.map(r1) as RawSpec["panels"][number]["box"], ...(p.axis === "z" && p.kind !== "hdf" && p.box[2] >= D - 40 ? { facade: true } : {}), ...panelExtras(p as unknown as EtPanel) })),
    hardware: ref.hardware.filter((h) => SHOW.has(h.category)).map((h) => { if (h.mesh) meshes.add(h.mesh); return { name: h.name, category: h.category, mesh: h.mesh ?? null, pos: h.pos.map(r1) as [number, number, number], quat: (h.quat ?? [1, 0, 0, 0]) as [number, number, number, number] }; }),
    counts: rawCounts(ref.hardware),
  };
}
function place(ref: RefModule, m: Module): PlacedModule {
  const o0 = (ref as unknown as { world: { origin: number[] } }).world.origin, yaw = (ref as unknown as { world: { yaw: number } }).world.yaw;
  // параметрический модуль с накладным ХДФ: у студии боковины с z = 0 (ХДФ на −3), у Базиса начало — по ХДФ: сдвиг на 3 вдоль оси модуля
  const s = !m.raw && m.backType === "nailed" ? 3 : 0, a = ((yaw || 0) * Math.PI) / 180;
  const [ox, oy, oz] = [o0[0] + s * Math.sin(a), o0[1], o0[2] + s * Math.cos(a)];
  const w = m.width, d = m.depth;
  const [x, z] = yaw === 90 ? [ox, oz - w] : yaw === 180 ? [ox - w, oz - d] : yaw === 270 ? [ox - d, oz] : [ox, oz];
  return { id: id(), x: r1(x), y: r1(oy), z: r1(z), rotation: (yaw || 0) as PlacedModule["rotation"], module: m };
}

for (const f of files) {
  const k = f.slice(0, 3), e = JSON.parse(readFileSync(`${ET}/${f}`, "utf8"));
  const placed: PlacedModule[] = [], notes: string[] = [];
  let parametric = 0, raw = 0;
  for (const ref of e.modules as RefModule[]) {
    let m: Module | undefined;
    try {
      const r = moduleFromEtalon(ref, look);
      if (!validate(r.module).length && compareModule(ref, r.module).pass) { m = r.module; parametric++; }
    } catch { /* нераспознанный — сырой */ }
    if (!m) {
      m = { ...initialModule(), name: ref.name, width: r1(ref.size[0]), height: r1(ref.size[1]), depth: r1(ref.size[2]), ...look, sections: [section()], doors: false, backType: "none", plinthHeight: 0, raw: rawFromRef(ref) };
      raw++;
    }
    placed.push(place(ref, m));
  }
  // ряд: столешница, цоколь, стеновые панели, профили и прочее вне модулей — один сырой объект в мировых координатах
  // фигурная столешница — прямоугольники по контуру Базиса (не сплошной габарит)
  // фасад посудомойки (ПМ) и прочие фронтальные детали фасадного материала в «прочем» — фасад (кнопка «Скрыть фасады»)
  // «Столешница» — только деталь из материала столешницы Базиса (не вся группа worktops эталона: там бывают полки ЛДСП и «Хром», k07, k09)
  const rowSrc = (["worktops", "plinths", "wallPanels", "profiles", "other"] as const).flatMap((g) => ((e.row?.[g] ?? []) as EtPanel[]).map((p) => ({ ...p, group: g as string, front: g === "other" && rowFront(p) })))
    .filter((p) => Array.isArray(p.box));
  const rowPanels = rowSrc.flatMap((p) => { const rs = rowRects(p), nm = rowPanelName(p); return rs.map((box, i) => ({ ...p, name: rs.length > 1 ? `${nm} (часть ${i + 1}/${rs.length})` : nm, box, kind: p.kind ?? "ldsp" })); });
  if (rowPanels.length) {
    const o = [0, 1, 2].map((i) => Math.min(...rowPanels.map((p) => p.box[i]))), M = [3, 4, 5].map((i) => Math.max(...rowPanels.map((p) => p.box[i])));
    const m: Module = { ...initialModule(), name: rowTitle(rowSrc), width: r1(M[0] - o[0]), height: r1(M[1] - o[1]), depth: r1(M[2] - o[2]), ...look, sections: [section()], doors: false, backType: "none", plinthHeight: 0,
      raw: { panels: rowPanels.map((p) => ({ name: p.name, kind: p.kind ?? "ldsp", box: p.box.map((v, i) => r1(v - o[i % 3])) as RawSpec["panels"][number]["box"], ...panelExtras(p), ...(p.front ? { facade: true } : {}) })), hardware: [], counts: rawCounts((e.row?.hardware ?? []) as { name: string; category: string }[]), row: true } };
    placed.push({ id: id(), x: r1(o[0]), y: r1(o[1]), z: r1(o[2]), rotation: 0, module: m });
  }
  // помещение по габариту кухни
  const ext = placed.map((a) => { const rot = a.rotation === 90 || a.rotation === 270; return { x1: a.x + (rot ? a.module.depth : a.module.width), z1: a.z + (rot ? a.module.width : a.module.depth), y1: (a.y ?? 0) + a.module.height }; });
  const dy = -Math.min(0, Math.min(...placed.map((a) => a.y ?? 0)));
  const minX = Math.min(...placed.map((a) => a.x)), minZ = Math.min(...placed.map((a) => a.z));
  const minY = Math.min(...placed.map((a) => a.y ?? 0));
  for (const a of placed) { a.x = r1(a.x - Math.min(0, minX) + (minX < 0 ? 5 : 0)); a.z = r1(a.z - Math.min(0, minZ) + (minZ < 0 ? 5 : 0)); a.y = r1((a.y ?? 0) - Math.min(0, minY)); }
  if (minY < 0) notes.push(`низ кухни в Базисе на ${r1(minY)} — поднято до пола`);
  const p = newProject({ ...initialModule(), sections: [section()] });
  p.room = { ...p.room, width: Math.ceil(Math.max(...ext.map((x) => x.x1)) - Math.min(0, minX) + 400), depth: Math.ceil(Math.max(...ext.map((x) => x.z1)) - Math.min(0, minZ) + 400), height: Math.max(2700, Math.ceil(Math.max(...ext.map((x) => x.y1)) + dy + 60)), openings: [] };
  p.modules = placed;
  const errs = projectErrors(p);
  let ok = true;
  try { parseProject(JSON.parse(JSON.stringify(p))); } catch (x) { ok = false; notes.push("не читается: " + (x as Error).message); }
  writeFileSync(`${OUTDIR}/kitchen-${k}.json`, JSON.stringify(p));
  const title = `Кухня ${k.toUpperCase()} · ${placed.length} объектов`;
  const at = index.findIndex((x) => x.id === k); const row = { id: k, title, modules: placed.length, parametric, raw };
  if (at >= 0) index[at] = row; else index.push(row);
  console.log(`${k}: модулей ${e.modules.length} · параметрических ${parametric} · сырых ${raw} · ряд ${rowPanels.length} дет. · ошибки проекта: ${errs.slice(0, 2).join(" | ") || "нет"} ${ok ? "" : "· " + notes.join("; ")}`);
}
writeFileSync(`${OUTDIR}/kitchens.json`, JSON.stringify(index.sort((a, b) => a.id.localeCompare(b.id)), null, 1));
// сетки фурнитуры для сырых модулей
let copied = 0, bytes = 0;
for (const mid of process.argv[3] ? [] : meshes) {
  const src = `${LIB}/${mid}.glb`, dst = `${PUB}/${mid}.glb`;
  if (existsSync(src) && !existsSync(dst)) { copyFileSync(src, dst); copied++; bytes += statSync(src).size; }
}
console.log(`сетки фурнитуры: нужно ${meshes.size}, скопировано новых ${copied} (${Math.round(bytes / 1024)} КБ)`);
