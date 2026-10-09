// Импорт шкафов и прочей корпусной мебели (не кухни) из корпуса моделей Базиса цеха в проекты студии — «сырыми» модулями,
// как кухни (правила шкафов студии не трогаются). Источник: Кухни/corpus/index.json + corpus/json/<sha12>.json.
// Модуль — крупная сборка верхнего уровня; если таких меньше двух — вся модель одним модулем. Панели — боксы в осях модуля
// (оси Базиса = оси студии, минимальный угол модуля — начало координат). Помещение — по габариту модели.
// npx tsx scripts/wardrobe/import.ts [N]  → public/local-projects/wardrobe-NNN.json + wardrobes.json (только локально, не публикуется)
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { initialModule, id, section, type Module } from "../../src/model";
import { newProject, parseProject, projectErrors, type PlacedModule } from "../../src/project";
import type { RawSpec, RawPanel } from "../../src/rawModule";

const CORPUS = "C:/Users/My PC/Desktop/Claude Project/Кухни/corpus";
const OUTDIR = "public/local-projects";
const LIMIT = Number(process.argv[2] ?? 0) || Infinity;
const r1 = (v: number) => Math.round(v * 10) / 10;
const look = { decor: "Белый", facadeDecor: "Белый" };

import { xf, compose, chainXf, panelBox, type Trans, type CPanel, type M3, type Xf } from "./xform";
import { packRows } from "./pack";
type CAsm = { name: string; trans?: Trans; panels?: CPanel[]; subs?: CAsm[]; drills?: { name: string; chain?: Trans[] }[] };
type IndexRow = { path: string; sha: string; json: string; panels: number; kitchen_hits: unknown[]; kitchen_name: boolean };

const MAT_KIND: [string, RegExp][] = [["mirror", /зеркал/], ["glass", /стекл|glass/], ["hdf", /хдф|двп|hdf|оргалит/], ["mdf", /мдф|mdf|evogloss|eterno|idm/], ["ldsp", /лдсп|дсп|egger|kronospan|lamarty|увадрев|gtv board/]];
const matKind = (mat: string) => { const m = (mat || "").toLowerCase(); for (const [k, rx] of MAT_KIND) if (rx.test(m)) return k; return "other"; };
const FACADE_RX = /фасад|двер|дверк|ящик.*лицев|лицев/i;

// panelBox (сборки ∘ chain панели ∘ trans) — в ./xform, там же тест
type WPanel = { name: string; kind: string; box: number[]; facade: boolean };
type WHw = { name: string; category: string; mesh: string; pos: number[]; quat: [number, number, number, number] };
// фурнитура: имя Базиса -> сетка библиотеки (hardware-lib/manifest.json), показываем только видимую (без крепежа)
const LIB = "C:/Users/My PC/Desktop/Claude Project/Кухни/hardware-lib", PUB = "public/models/hardware/bazis";
const SHOW = new Set(["опора", "клипса", "навес", "заглушка", "петля", "подъёмник", "газлифт", "направляющая", "ящик-система", "ручка", "сушка", "карго", "профиль", "штанга", "штангодержатель"]);
const manifest = JSON.parse(readFileSync(`${LIB}/manifest.json`, "utf8")) as Record<string, { names?: string[]; category?: string; glb?: string }>;
const byName = new Map<string, { mesh: string; category: string }>();
for (const [k, v] of Object.entries(manifest)) if (k !== "_about" && v.glb) for (const nm of v.names ?? []) if (!byName.has(nm)) byName.set(nm, { mesh: k, category: v.category ?? "" });
const meshes = new Set<string>();
const mat2q = (R: M3): [number, number, number, number] => {
  const [a, b, c, d, e, f, g, h, i] = R, tr = a + e + i;
  let w, x, y, z;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (h - f) / s; y = (c - g) / s; z = (d - b) / s; }
  else if (a > e && a > i) { const s = Math.sqrt(1 + a - e - i) * 2; w = (h - f) / s; x = s / 4; y = (b + d) / s; z = (c + g) / s; }
  else if (e > i) { const s = Math.sqrt(1 + e - a - i) * 2; w = (c - g) / s; x = (b + d) / s; y = s / 4; z = (f + h) / s; }
  else { const s = Math.sqrt(1 + i - a - e) * 2; w = (d - b) / s; x = (c + g) / s; y = (f + h) / s; z = s / 4; }
  return [w, x, y, z].map((v) => Math.round(v * 1e6) / 1e6) as [number, number, number, number];
};
function collect(a: CAsm, parent: Xf, out: WPanel[], facadeCtx: boolean, hw: WHw[]) {
  const me = compose(parent, xf(a.trans));
  const fc = facadeCtx || FACADE_RX.test(a.name || "");
  for (const p of a.panels ?? []) {
    const box = panelBox(p, me); if (!box) continue;
    if (box[3] - box[0] < 0.5 && box[4] - box[1] < 0.5) continue;
    const kind = matKind(p.mat);
    out.push({ name: (p.name || "деталь").slice(0, 60), kind, box, facade: kind !== "hdf" && (fc || FACADE_RX.test(p.name || "")) });
  }
  // цепочка сверления: сборка -> chain[0] -> chain[1] ... (проверено по евровинтам: попадают в стык панелей)
  for (const dr of a.drills ?? []) {
    const lib = byName.get(dr.name); if (!lib || !SHOW.has(lib.category)) continue;
    const w = chainXf(me, dr.chain);
    if (!w.t.every(Number.isFinite)) continue;
    hw.push({ name: dr.name.slice(0, 80), category: lib.category, mesh: lib.mesh, pos: w.t, quat: mat2q(w.R) });
  }
  for (const s of a.subs ?? []) collect(s, me, out, fc, hw);
}

const all: IndexRow[] = JSON.parse(readFileSync(`${CORPUS}/index.json`, "utf8"));
const seen = new Set<string>();
const picked = all.filter((r) => !(r.kitchen_hits?.length) && !r.kitchen_name && r.panels > 0 && !seen.has(r.sha) && seen.add(r.sha)).slice(0, LIMIT);
console.log(`отобрано моделей: ${picked.length} (из ${all.length})`);
if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
const index: { id: string; title: string; modules: number; panels: number; hardware?: number; size: string; packed?: boolean; error?: string }[] = [];

picked.forEach((row, n) => {
  const wid = String(n + 1).padStart(3, "0");
  const parts = row.path.split(/[\\/]/), file = parts[parts.length - 1].replace(/\.b3d$/i, ""), folder = parts[parts.length - 2] ?? "";
  const title = `${folder} · ${file}`.slice(0, 80);
  try {
    const doc = JSON.parse(readFileSync(row.json, "utf8")) as { assemblies?: CAsm[] };
    const top = doc.assemblies ?? [];
    const hwAll: WHw[] = [];
    const groups: { name: string; panels: WPanel[] }[] = top.map((a) => { const out: WPanel[] = []; collect(a, xf(), out, false, hwAll); return { name: a.name || "Сборка", panels: out }; });
    const big = groups.filter((g) => g.panels.length >= 8);
    let mods: { name: string; panels: WPanel[] }[];
    if (big.length >= 2) {
      const rest = groups.filter((g) => g.panels.length < 8).flatMap((g) => g.panels);
      mods = [...big, ...(rest.length ? [{ name: "Прочие детали", panels: rest }] : [])];
    } else mods = [{ name: file.slice(0, 60), panels: groups.flatMap((g) => g.panels) }];
    // больше 600 деталей в одном сыром модуле нельзя — делим по порядку
    mods = mods.flatMap((m) => m.panels.length <= 600 ? [m] : Array.from({ length: Math.ceil(m.panels.length / 600) }, (_, i) => ({ name: `${m.name} (${i + 1})`, panels: m.panels.slice(i * 600, i * 600 + 600) })));
    mods = mods.filter((m) => m.panels.length);
    if (!mods.length) throw Error("нет панелей");
    const allP = mods.flatMap((m) => m.panels);
    const g0 = [0, 1, 2].map((i) => Math.min(...allP.map((p) => p.box[i]))), g1 = [3, 4, 5].map((i) => Math.max(...allP.map((p) => p.box[i])));
    const M = 300; // отступ от стен помещения
    const ext6 = mods.map((g) => [0, 1, 2].map((i) => Math.min(...g.panels.map((p) => p.box[i]))).concat([3, 4, 5].map((i) => Math.max(...g.panels.map((p) => p.box[i])))));
    // фурнитура -> модуль, в чей габарит попадает (иначе ближайший); за пределами габарита модели на 300+ — отбрасываем
    const gap = (b: number[], q: number[]) => Math.hypot(...[0, 1, 2].map((i) => Math.max(0, b[i] - q[i], q[i] - b[i + 3])));
    const hwOf = mods.map(() => [] as WHw[]);
    for (const h of hwAll) { const ds = ext6.map((b) => gap(b, h.pos)); const k = ds.indexOf(Math.min(...ds)); if (ds[k] <= 300) hwOf[k].push(h); }
    let hwCount = 0;
    const placed: PlacedModule[] = mods.map((g, gi) => {
      const o = ext6[gi].slice(0, 3), e = ext6[gi].slice(3);
      const panels: RawPanel[] = g.panels.map((p) => ({ name: p.name, kind: p.kind, box: p.box.map((v, i) => Math.max(0, r1(v - o[i % 3]))) as RawPanel["box"], ...(p.facade ? { facade: true } : {}) }));
      const hardware = hwOf[gi].slice(0, 400).map((h) => { meshes.add(h.mesh); return { name: h.name, category: h.category, mesh: h.mesh, pos: h.pos.map((v, i) => r1(v - o[i])) as [number, number, number], quat: h.quat }; });
      hwCount += hardware.length;
      const raw: RawSpec = { panels, hardware, source: "bazis-corpus" };
      const m: Module = { ...initialModule(), name: g.name.slice(0, 60), width: Math.max(1, r1(e[0] - o[0])), height: Math.max(1, r1(e[1] - o[1])), depth: Math.max(1, r1(e[2] - o[2])), ...look, sections: [section()], doors: false, backType: "none", plinthHeight: 0, raw };
      return { id: id(), x: r1(o[0] - g0[0] + M), y: r1(o[1] - g0[1]), z: r1(o[2] - g0[2] + M), rotation: 0, module: m };
    });
    const p = newProject({ ...initialModule(), sections: [section()] });
    const ext = [g1[0] - g0[0], g1[1] - g0[1], g1[2] - g0[2]];
    p.room = { ...p.room, width: Math.ceil(ext[0] + 2 * M), depth: Math.ceil(ext[2] + 2 * M), height: Math.max(2700, Math.ceil(ext[1] + 100)), openings: [] };
    // сцена из нескольких изделий больше 20 м — раскладываем модули рядами (модули целиком, геометрия внутри не меняется)
    let packed = false;
    if (placed.length > 1 && (p.room.width > 20000 || p.room.depth > 20000 || p.room.height > 20000)) {
      const pk = packRows(placed.map((pm) => ({ w: pm.module.width, h: pm.module.height, d: pm.module.depth, y: pm.y })));
      if (pk) { placed.forEach((pm, i) => { pm.x = pk.pos[i].x; pm.y = pk.pos[i].y; pm.z = pk.pos[i].z; }); p.room = { ...p.room, ...pk.room }; packed = true; }
    }
    p.modules = placed;
    const errs = projectErrors(p);
    let error: string | undefined = errs.length ? errs.slice(0, 2).join(" | ") : undefined;
    try { parseProject(JSON.parse(JSON.stringify(p))); } catch (x) { error = "не читается: " + (x as Error).message; }
    const txt = JSON.stringify(p);
    if (txt.length > 2000000) error = "файл больше 2 МБ";
    writeFileSync(`${OUTDIR}/wardrobe-${wid}.json`, txt);
    index.push({ id: wid, title, modules: placed.length, panels: allP.length, hardware: hwCount, size: ext.map((v) => Math.round(v)).join("×"), ...(packed ? { packed: true } : {}), ...(error ? { error } : {}) });
    if (error) console.log(`${wid} ${title}: ${error}`);
  } catch (x) {
    index.push({ id: wid, title, modules: 0, panels: 0, size: "", error: (x as Error).message });
    console.log(`${wid} ${title}: ОШИБКА ${(x as Error).message}`);
  }
});
writeFileSync(`${OUTDIR}/wardrobes.json`, JSON.stringify(index, null, 1));
const bad = index.filter((x) => x.error).length;
let copied = 0, bytes = 0;
for (const mid of meshes) { const src = `${LIB}/glb/${mid}.glb`, dst = `${PUB}/${mid}.glb`; if (existsSync(src) && !existsSync(dst)) { copyFileSync(src, dst); copied++; bytes += statSync(src).size; } }
console.log(`сетки фурнитуры: нужно ${meshes.size}, скопировано новых ${copied} (${Math.round(bytes / 1024)} КБ); фурнитуры всего ${index.reduce((s, x) => s + (x.hardware ?? 0), 0)}`);
console.log(`готово: ${index.length} проектов, с ошибками ${bad}; модулей ${index.reduce((s, x) => s + x.modules, 0)}, панелей ${index.reduce((s, x) => s + x.panels, 0)}`);
