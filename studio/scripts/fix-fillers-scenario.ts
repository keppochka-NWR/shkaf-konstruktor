// Волна 29.10 (ветка claude/fix-fillers-limits): сценарий мышью и клавиатурой как менеджер — своя сборка, системный Chrome headless.
// 1) Стык угловых фальшей: «Для одежды» 1000 × 2200 × 600 → ПКМ «Поставить к стене › К задней» → ПКМ «Продолжить ряд за угол ›
//    Такой же на левой стене от угла» → снимки сверху и в 3D (фасады закрыты и открыты); проект из localStorage — для сверки.
// 2) Малый корпус: палитра «Для одежды» 100 × 100 → «Добавить в комнату»; поле «Ширина» выбранного шкафа 1000 → 100 и «Высота» → 100.
// npx tsx scripts/fix-fillers-scenario.ts <url /studio/?fresh=1> <папка>
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parts } from "../src/model";
import { parseProject } from "../src/project";
import { cornerReport } from "./corner-fillers-audit";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const log: Record<string, unknown> = {};
const stats = { clicks: 0, right: 0, keys: 0 };
let n = 0;

async function fresh(): Promise<Page> {
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  p.setDefaultTimeout(6000);
  p.on("pageerror", (e) => ((log.pageErrors ??= []) as string[]).push(e.message));
  await p.goto(url); await p.waitForTimeout(4000);
  return p;
}
const shot = (p: Page, name: string) => p.screenshot({ path: join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
const click = async (p: Page, name: string) => { await p.getByRole("button", { name, exact: true }).filter({ visible: true }).first().click(); stats.clicks++; await p.waitForTimeout(300); };
async function field(p: Page, label: string, v: number) { const f = p.getByLabel(label, { exact: true }).filter({ visible: true }).first(); await f.click({ clickCount: 3 }); stats.clicks++; await p.keyboard.type(String(v)); await p.keyboard.press("Enter"); stats.keys += 2; await p.waitForTimeout(500); }
async function project(p: Page) {
  return p.evaluate(() => { const s = JSON.parse(localStorage.getItem("garderyob-rooms-v1") || "null"); if (!s) return null; const r = s.rooms.find((r: { id: string }) => r.id === s.activeRoomId); return r?.project ? (s.calculation && !r.project.calculation ? { ...r.project, calculation: s.calculation } : r.project) : null; /* расчёт — в документе (29.10) */ });
}
const banner = (p: Page) => p.evaluate(() => [...document.querySelectorAll("div,section,p")].filter((e) => (e as HTMLElement).offsetParent && /Изменение не применено|Малый корпус|Ширина: допустимо|Сделано/.test((e as HTMLElement).innerText ?? "") && e.getBoundingClientRect().width < 700).map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 400)).slice(-2));
/** ПКМ по фасаду модуля (над подписью ширины модуля в 3D) и путь по круговому меню. */
async function radial(p: Page, path: string[], where?: { x: number; y: number }) {
  await p.getByRole("button", { name: "3D", exact: true }).filter({ visible: true }).first().click(); await p.waitForTimeout(800);
  let pt = where;
  if (!pt) {
    const badge = p.locator("text=/^1000 мм$/").filter({ visible: true }).first(), b = await badge.boundingBox();
    pt = b ? { x: b.x + b.width / 2, y: b.y - 140 } : { x: 600, y: 420 };
  }
  await p.mouse.click(pt.x, pt.y, { button: "right" }); stats.right++; await p.waitForTimeout(700);
  for (const label of path) {
    const item = p.locator(".radial-menu .radial-item", { hasText: label }).first();
    if (!(await item.isVisible().catch(() => false))) { const k = p.locator(".radial-menu .radial-item", { hasText: "Корпус" }).first(); if (await k.isVisible().catch(() => false)) { await k.click(); stats.clicks++; await p.waitForTimeout(500); } }
    await item.click(); stats.clicks++; await p.waitForTimeout(700);
  }
}
async function views(p: Page, prefix: string) {
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  for (const [nm, b] of [["sverhu", "Сверху"], ["3d", "3D"]] as const) {
    await p.getByRole("button", { name: b, exact: true }).filter({ visible: true }).first().click(); stats.clicks++; await p.waitForTimeout(1500);
    await shot(p, `${prefix}-${nm}`);
  }
}

// 1) Угол двух шкафов
try {
  const p = await fresh();
  await click(p, "Для одежды");
  await field(p, "Ширина новой мебели", 1000); await field(p, "Высота новой мебели", 2200); await field(p, "Глубина новой мебели", 600);
  await click(p, "Добавить в комнату"); await p.waitForTimeout(1200);
  await p.locator('button:has-text("Понятно") >> visible=true').first().click({ timeout: 1200 }).catch(() => undefined);
  await radial(p, ["Поставить к стене", "К задней"]);
  await radial(p, ["Продолжить ряд за угол", "Такой же на левой"]);
  log.cornerBanner = await banner(p);
  await views(p, "ugol");
  // фасады открыты: видно, открываются ли створки у угла
  const open = p.getByRole("button", { name: "Открыть фасады" }).filter({ visible: true }).first();
  if (await open.isVisible().catch(() => false)) { await open.click(); stats.clicks++; await p.waitForTimeout(1200); await shot(p, "ugol-3d-fasady-otkryty"); }
  // крупно угол: колесо над углом шкафов (как менеджер приближает вид)
  const box = await p.locator("canvas").first().boundingBox();
  if (box) {
    const cx = 600, cy = 405; // внутренний угол шкафов в 3D-виде 1366 × 768 (вписанная комната)
    await p.mouse.move(cx, cy);
    for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -240); await p.waitForTimeout(150); }
    await p.waitForTimeout(900); await shot(p, "ugol-3d-krupno-fasady-otkryty");
    await p.getByRole("button", { name: "Сверху", exact: true }).filter({ visible: true }).first().click(); stats.clicks++; await p.waitForTimeout(1200);
    await p.mouse.move(492, 332); // внутренний угол в виде «Сверху» (комната 4000 × 3000 вписана)
    for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -240); await p.waitForTimeout(150); }
    await p.waitForTimeout(900); await shot(p, "ugol-sverhu-krupno-fasady-otkryty");
  }
  // «Проверить расстановку» — что студия сама говорит об угле
  const check = p.getByRole("button", { name: /Проверить расстановку/ }).filter({ visible: true }).first();
  if (await check.isVisible().catch(() => false)) { await check.click(); stats.clicks++; await p.waitForTimeout(800); log.cornerWarnings = await p.evaluate(() => [...document.querySelectorAll("li,p")].filter((e) => (e as HTMLElement).offsetParent && e.getBoundingClientRect().x > 1000).map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 200)).slice(0, 8)); await shot(p, "ugol-proverka"); }
  const pr = await project(p);
  if (pr) {
    const proj = parseProject(pr), r = cornerReport(proj);
    log.corner = {
      modules: proj.modules.map((a) => ({ name: a.module.name, x: Math.round(a.x), z: Math.round(a.z), rot: a.rotation ?? 0, corner: a.module.cornerFiller ?? null, kind: a.module.cornerKind ?? null, stripWidth: a.module.cornerFillerWidth ?? null, doors: parts(a.module).filter((q) => q.role === "door").length })),
      fillers: r.fillers.map((f) => `${f.id}: x ${f.x0.toFixed(0)}–${f.x1.toFixed(0)}, z ${f.z0.toFixed(0)}–${f.z1.toFixed(0)}`),
      overlaps: r.overlaps, doorsBlocked: r.doorsBlocked.length,
    };
  }
  await p.context().close();
} catch (e) { log.cornerError = (e as Error).message.split("\n")[0]; }

// 2) Малый корпус 100 × 100
try {
  const p = await fresh();
  await click(p, "Для одежды");
  await field(p, "Ширина новой мебели", 100); await field(p, "Высота новой мебели", 100); await field(p, "Глубина новой мебели", 600);
  await click(p, "Добавить в комнату"); await p.waitForTimeout(1500);
  log.paletteBanner = await banner(p);
  await shot(p, "malyi-palitra");
  const pr = await project(p);
  log.palette = pr ? parseProject(pr).modules.map((a) => ({ w: a.module.width, h: a.module.height, doors: a.module.doors, parts: parts(a.module).length })) : null;
  await p.context().close();
  // поле «Ширина» / «Высота» у шкафа 1000 × 2200
  const q = await fresh();
  await click(q, "Для одежды");
  await field(q, "Ширина новой мебели", 1000); await field(q, "Высота новой мебели", 2200); await field(q, "Глубина новой мебели", 600);
  await click(q, "Добавить в комнату"); await q.waitForTimeout(1200);
  await q.locator('button:has-text("Понятно") >> visible=true').first().click({ timeout: 1200 }).catch(() => undefined);
  for (const t of ["Корпус и размещение", "Габариты"]) { await q.getByText(t, { exact: true }).filter({ visible: true }).first().click(); stats.clicks++; await q.waitForTimeout(400); }
  await field(q, "Ширина", 100);
  log.widthBanner = await banner(q);
  await field(q, "Высота", 100);
  log.heightBanner = await banner(q);
  await shot(q, "malyi-pole-razmera");
  const pr2 = await project(q);
  log.field = pr2 ? parseProject(pr2).modules.map((a) => ({ w: a.module.width, h: a.module.height, doors: a.module.doors, plinth: a.module.plinthHeight ?? null, shelves: a.module.sections[0].shelves.length, rod: a.module.sections[0].rod })) : null;
  await views(q, "malyi");
  await q.context().close();
} catch (e) { log.smallError = (e as Error).message.split("\n")[0]; }

log.stats = stats;
writeFileSync(join(out, "scenario.json"), JSON.stringify(log, null, 1));
console.log(JSON.stringify(log, null, 1));
await browser.close();
