// Проверка крепежа на уровне ОТРИСОВКИ (а не parts()): «что-то выпирает над крышей» (Макс, демо 20.10.2026).
// npx tsx scripts/fastener-render-check.ts <url студии> [report.json]
// Обходит проекты public/local-projects и шаблоны палитры/кухни, ждёт загрузки сеток (window.__pending() === 0) и берёт
// window.__hardwareBoxes() — коробки мешей фурнитуры в мм модуля (GLB, запасные и процедурные модели, видимые заглушки) и коробку корпуса.
// Печатает выступы > 0,5 мм за корпус по типу фурнитуры (имя GLB / вид детали), без имён проектов и клиентов.
// Снаружи по конструкции (не считаем): опоры и их саморезы, клипсы цоколя, навесы, ножки, крепёж на фасаде, стяжка с соседом; петли — на фасаде.
// ENV: NOGLB=1 — без сеток GLB (как при сбое загрузки); FILTER — регэксп по имени файла проекта (шаблоны тогда — только с TEMPLATES=1); LIMIT — число проектов; TEMPLATES=0 — без шаблонов.
import { chromium } from "playwright";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { initialModule, type Module } from "../src/model";
import { newProject } from "../src/project";
import { createModule, type ModuleKind } from "../src/ModulePalette";
import { kitchenBase, kitchenWall } from "../src/kitchen";
import { kitchenProject, kitchenTall } from "../src/kitchenProject";

type Item = { pid: string; role?: string; name?: string; file?: string; native: boolean; src: string[]; lo: number[]; hi: number[] };
type Mod = { id: string; kind: string; carcass: { lo: number[]; hi: number[] } | null; items: Item[] };
const [url, reportPath] = process.argv.slice(2);
if (!url) throw Error("нужен адрес студии");
const LP = "public/local-projects";
// имя проекта — только числовые признаки (буквенные части, кроме служебных, — «x»)
const ALLOWED = new Set(["wardrobe", "kitchen", "k", "test", "shkaf", "tumba", "param", "sravnenie", "garderob", "demo", "academic", "json"]);
const anon = (f: string) => f.replace(/\.json$/, "").split(/(-)/).map((s) => (/^[a-z]+$/i.test(s) && !ALLOWED.has(s.replace(/\d+$/, "")) ? "x" : s.replace(/^k\d+$/, (v) => v))).join("");
const outside = (pid: string, name = "") => /^(leg|kitchen-leg|kitchen-clip|kitchen-hanger|nail|fast:out:)/.test(pid) || /:screw:f\d/.test(pid) || /Опора|Ножка|Клипса|Навес|Заглушка навеса|Подпятник|Ручка|на фасад/i.test(name);

const jobs: { label: string; raw: string }[] = [];
const filter = process.env.FILTER ? new RegExp(process.env.FILTER) : undefined;
if (existsSync(LP)) for (const f of readdirSync(LP).filter((f) => f.endsWith(".json") && !/^(kitchens|wardrobes)\.json$/.test(f) && (!filter || filter.test(f))).sort())
  jobs.push({ label: anon(f), raw: readFileSync(join(LP, f), "utf8") });
if (process.env.TEMPLATES !== "0" && (!filter || process.env.TEMPLATES === "1")) {
  const tpl = new Map<string, Module>();
  const kinds: [ModuleKind, number, number, number][] = [["empty", 800, 2200, 600], ["shelves", 800, 2000, 400], ["wardrobe", 1000, 2200, 600], ["drawers", 600, 850, 550], ["corner", 1050, 2000, 450], ["desk", 1200, 750, 600], ["kupe-wardrobe", 1200, 2400, 600], ["kitchen-base", 600, 720, 560], ["kitchen-wall", 600, 720, 300]];
  for (const [k, w, h, d] of kinds) try { tpl.set("палитра:" + k, createModule(k, w, h, d, initialModule())); } catch (e) { console.log("шаблон", k, String(e)); }
  for (const kind of ["doors", "drawers", "sink", "oven", "dishwasher"] as const) tpl.set("кухня:" + kind, kitchenBase(initialModule(), 600, kind));
  tpl.set("кухня:wall", kitchenWall(initialModule(), 600)); tpl.set("кухня:tall", kitchenTall(initialModule(), 600));
  for (const [k, m] of tpl) jobs.push({ label: k, raw: JSON.stringify(newProject(m)) });
  jobs.push({ label: "кухня:проект", raw: JSON.stringify(kitchenProject()) });
}
const limit = Number(process.env.LIMIT ?? jobs.length);

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const failed: string[] = [];
// NOGLB=1 — сетки фурнитуры не грузятся (сеть/сервер демо): видно, что рисуют заглушки и запасные модели
if (process.env.NOGLB === "1") await page.route("**/*.glb", (r) => r.abort());
page.on("console", (m) => { if (m.type() === "warning" && /Модель не загрузилась/.test(m.text())) failed.push(m.text().replace(/^.*models\//, "").split(" ")[0]); });
await page.goto(url);
type Hit = { n: number; max: number; projects: Set<string>; sample: string };
const hits = new Map<string, Hit>(), stubs = new Map<string, number>();
let modules = 0, items = 0, done = 0;
for (const job of jobs.slice(0, limit)) {
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "1"); }, job.raw);
  await page.goto(url);
  try { await page.waitForSelector("canvas", { timeout: 15000 }); } catch { console.log("нет сцены:", job.label); continue; }
  // __pending считает текстуры и сетки текущей сборки сцены; ждём ноль дважды подряд (пересборка сцены после загрузки проекта)
  let zero = 0;
  for (let i = 0; i < 200 && zero < 3; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? -1); zero = n === 0 ? zero + 1 : 0; await page.waitForTimeout(150); }
  const mods = (await page.evaluate(() => (window as unknown as { __hardwareBoxes?: () => unknown[] }).__hardwareBoxes?.() ?? [])) as Mod[];
  done++;
  for (const m of mods) {
    modules++;
    for (const it of m.items) {
      if (it.role !== "fastener") continue;
      items++;
      if (it.native && it.src.includes("stub")) stubs.set(it.file ?? "?", (stubs.get(it.file ?? "?") ?? 0) + 1);
      if (!m.carcass || outside(it.pid, it.name)) continue;
      for (let i = 0; i < 3; i++) {
        const over = it.hi[i] - m.carcass.hi[i], under = m.carcass.lo[i] - it.lo[i], d = Math.max(over, under);
        if (d <= 0.5) continue;
        const type = it.file ? it.file.split("/").pop() : it.pid.replace(/^raw:h\d+$/, "raw").replace(/[0-9a-f-]{36}/g, "U").replace(/\d+/g, "#");
        const key = `${m.kind} · ${type} · «${(it.name ?? "").replace(/\d+(?:[.,]\d+)?/g, "#")}» · ${it.src.join("+")} · ${"xyz"[i]}${over >= under ? "+" : "−"}`;
        const h = hits.get(key) ?? { n: 0, max: 0, projects: new Set(), sample: "" };
        h.n++; if (d > h.max) { h.max = d; h.sample = `${job.label} ${it.pid}`; } h.projects.add(job.label); hits.set(key, h);
      }
    }
  }
  if (done % 25 === 0) console.log(`… ${done}/${Math.min(limit, jobs.length)}`);
}
await browser.close();
const rows = [...hits].sort((a, b) => b[1].n - a[1].n);
console.log(`проектов ${done}, модулей ${modules}, крепежа на сцене ${items}; выступов за корпус > 0,5 мм: ${rows.reduce((s, [, h]) => s + h.n, 0)}`);
for (const [k, h] of rows) console.log(`${String(h.n).padStart(5)}  до ${h.max.toFixed(1)} мм  проектов ${h.projects.size}  ${k}  (пример: ${h.sample})`);
if (stubs.size) { console.log("крепёж с сеткой Базиса нарисован заглушкой (сетка не загрузилась):"); for (const [f, n] of stubs) console.log(`  ${n}  ${f}`); }
if (failed.length) console.log("сетки не загрузились:", [...new Set(failed)].join(", "));
if (reportPath) writeFileSync(reportPath, JSON.stringify({ projects: done, modules, items, rows: rows.map(([k, h]) => ({ key: k, n: h.n, max: +h.max.toFixed(1), projects: h.projects.size, sample: h.sample })), stubs: [...stubs] }, null, 1));
