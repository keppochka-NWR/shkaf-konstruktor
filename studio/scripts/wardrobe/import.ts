// Импорт шкафов и прочей корпусной мебели (не кухни) из корпуса моделей Базиса цеха в проекты студии — «сырыми» модулями,
// как кухни (правила шкафов студии не трогаются). Источник: Кухни/corpus/index.json + corpus/json/<sha12>.json.
// Модуль — крупная сборка верхнего уровня; если таких меньше двух — вся модель одним модулем. Панели — боксы в осях модуля
// (оси Базиса = оси студии, минимальный угол модуля — начало координат). Помещение — по габариту модели.
// npx tsx scripts/wardrobe/import.ts [N]  → public/local-projects/wardrobe-NNN.json + wardrobes.json (только локально, не публикуется)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { initialModule, id, section, type Module } from "../../src/model";
import { newProject, parseProject, projectErrors, type PlacedModule } from "../../src/project";
import type { RawSpec, RawPanel } from "../../src/rawModule";

const CORPUS = "C:/Users/My PC/Desktop/Claude Project/Кухни/corpus";
const OUTDIR = "public/local-projects";
const LIMIT = Number(process.argv[2] ?? 0) || Infinity;
const r1 = (v: number) => Math.round(v * 10) / 10;
const look = { decor: "Белый", facadeDecor: "Белый" };

type Trans = { x: number; y: number; z: number; q: [number, number, number, number] };
type CPanel = { name: string; mat: string; thick: number; bbox?: number[]; trans: Trans };
type CAsm = { name: string; trans?: Trans; panels?: CPanel[]; subs?: CAsm[] };
type IndexRow = { path: string; sha: string; json: string; panels: number; kitchen_hits: unknown[]; kitchen_name: boolean };
type M3 = number[]; // 3×3 по строкам
type Xf = { R: M3; t: [number, number, number] };

const qmat = ([w, x, y, z]: number[]): M3 => [
  1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
  2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
  2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
];
const mul = (a: M3, b: M3): M3 => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]));
const app = (R: M3, p: number[]): [number, number, number] => [0, 1, 2].map((i) => R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2]) as [number, number, number];
const xf = (t?: Trans): Xf => (t ? { R: qmat(t.q ?? [1, 0, 0, 0]), t: [t.x ?? 0, t.y ?? 0, t.z ?? 0] } : { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] });
const compose = (a: Xf, b: Xf): Xf => { const tb = app(a.R, b.t); return { R: mul(a.R, b.R), t: [tb[0] + a.t[0], tb[1] + a.t[1], tb[2] + a.t[2]] }; };

const MAT_KIND: [string, RegExp][] = [["mirror", /зеркал/], ["glass", /стекл|glass/], ["hdf", /хдф|двп|hdf|оргалит/], ["mdf", /мдф|mdf|evogloss|eterno|idm/], ["ldsp", /лдсп|дсп|egger|kronospan|lamarty|увадрев|gtv board/]];
const matKind = (mat: string) => { const m = (mat || "").toLowerCase(); for (const [k, rx] of MAT_KIND) if (rx.test(m)) return k; return "other"; };
const FACADE_RX = /фасад|двер|дверк|ящик.*лицев|лицев/i;

/** мировой бокс панели: локальный прямоугольник контура (bbox) × толщина 0..thick, через цепочку сборок */
function panelBox(p: CPanel, parent: Xf): [number, number, number, number, number, number] | null {
  const b = p.bbox; if (!b || b.length !== 4 || !b.every(Number.isFinite)) return null;
  const w = compose(parent, xf(p.trans));
  const lo = Math.min(0, p.thick || 0), hi = Math.max(0, p.thick || 0);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const x of [b[0], b[2]]) for (const y of [b[1], b[3]]) for (const z of [lo, hi]) {
    const q = app(w.R, [x, y, z]);
    for (let i = 0; i < 3; i++) { const v = q[i] + w.t[i]; mn[i] = Math.min(mn[i], v); mx[i] = Math.max(mx[i], v); }
  }
  return [mn[0], mn[1], mn[2], mx[0], mx[1], mx[2]];
}
type WPanel = { name: string; kind: string; box: number[]; facade: boolean };
function collect(a: CAsm, parent: Xf, out: WPanel[], facadeCtx: boolean) {
  const me = compose(parent, xf(a.trans));
  const fc = facadeCtx || FACADE_RX.test(a.name || "");
  for (const p of a.panels ?? []) {
    const box = panelBox(p, me); if (!box) continue;
    if (box[3] - box[0] < 0.5 && box[4] - box[1] < 0.5) continue;
    const kind = matKind(p.mat);
    out.push({ name: (p.name || "деталь").slice(0, 60), kind, box, facade: kind !== "hdf" && (fc || FACADE_RX.test(p.name || "")) });
  }
  for (const s of a.subs ?? []) collect(s, me, out, fc);
}

const all: IndexRow[] = JSON.parse(readFileSync(`${CORPUS}/index.json`, "utf8"));
const seen = new Set<string>();
const picked = all.filter((r) => !(r.kitchen_hits?.length) && !r.kitchen_name && r.panels > 0 && !seen.has(r.sha) && seen.add(r.sha)).slice(0, LIMIT);
console.log(`отобрано моделей: ${picked.length} (из ${all.length})`);
if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
const index: { id: string; title: string; modules: number; panels: number; size: string; error?: string }[] = [];

picked.forEach((row, n) => {
  const wid = String(n + 1).padStart(3, "0");
  const parts = row.path.split(/[\\/]/), file = parts[parts.length - 1].replace(/\.b3d$/i, ""), folder = parts[parts.length - 2] ?? "";
  const title = `${folder} · ${file}`.slice(0, 80);
  try {
    const doc = JSON.parse(readFileSync(row.json, "utf8")) as { assemblies?: CAsm[] };
    const top = doc.assemblies ?? [];
    const groups: { name: string; panels: WPanel[] }[] = top.map((a) => { const out: WPanel[] = []; collect(a, xf(), out, false); return { name: a.name || "Сборка", panels: out }; });
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
    const placed: PlacedModule[] = mods.map((g) => {
      const o = [0, 1, 2].map((i) => Math.min(...g.panels.map((p) => p.box[i]))), e = [3, 4, 5].map((i) => Math.max(...g.panels.map((p) => p.box[i])));
      const panels: RawPanel[] = g.panels.map((p) => ({ name: p.name, kind: p.kind, box: p.box.map((v, i) => Math.max(0, r1(v - o[i % 3]))) as RawPanel["box"], ...(p.facade ? { facade: true } : {}) }));
      const raw: RawSpec = { panels, hardware: [], source: "bazis-corpus" };
      const m: Module = { ...initialModule(), name: g.name.slice(0, 60), width: Math.max(1, r1(e[0] - o[0])), height: Math.max(1, r1(e[1] - o[1])), depth: Math.max(1, r1(e[2] - o[2])), ...look, sections: [section()], doors: false, backType: "none", plinthHeight: 0, raw };
      return { id: id(), x: r1(o[0] - g0[0] + M), y: r1(o[1] - g0[1]), z: r1(o[2] - g0[2] + M), rotation: 0, module: m };
    });
    const p = newProject({ ...initialModule(), sections: [section()] });
    const ext = [g1[0] - g0[0], g1[1] - g0[1], g1[2] - g0[2]];
    p.room = { ...p.room, width: Math.ceil(ext[0] + 2 * M), depth: Math.ceil(ext[2] + 2 * M), height: Math.max(2700, Math.ceil(ext[1] + 100)), openings: [] };
    p.modules = placed;
    const errs = projectErrors(p);
    let error: string | undefined = errs.length ? errs.slice(0, 2).join(" | ") : undefined;
    try { parseProject(JSON.parse(JSON.stringify(p))); } catch (x) { error = "не читается: " + (x as Error).message; }
    const txt = JSON.stringify(p);
    if (txt.length > 2000000) error = "файл больше 2 МБ";
    writeFileSync(`${OUTDIR}/wardrobe-${wid}.json`, txt);
    index.push({ id: wid, title, modules: placed.length, panels: allP.length, size: ext.map((v) => Math.round(v)).join("×"), ...(error ? { error } : {}) });
    if (error) console.log(`${wid} ${title}: ${error}`);
  } catch (x) {
    index.push({ id: wid, title, modules: 0, panels: 0, size: "", error: (x as Error).message });
    console.log(`${wid} ${title}: ОШИБКА ${(x as Error).message}`);
  }
});
writeFileSync(`${OUTDIR}/wardrobes.json`, JSON.stringify(index, null, 1));
const bad = index.filter((x) => x.error).length;
console.log(`готово: ${index.length} проектов, с ошибками ${bad}; модулей ${index.reduce((s, x) => s + x.modules, 0)}, панелей ${index.reduce((s, x) => s + x.panels, 0)}`);
