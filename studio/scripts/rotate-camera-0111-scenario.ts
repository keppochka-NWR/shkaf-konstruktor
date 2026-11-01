// Камера после поворота модуля стоит на месте (Макс 01.11.2026: «после поворота модуля дёргается камера»; из колеса кадр вписывался заново):
// npx tsx scripts/rotate-camera-0111-scenario.ts <url>. Экранные точки углов комнаты по кадрам — до и после R и «Повернуть ↻», в 3D и спереди.
import { chromium } from "playwright";
import { initialModule, section, id, type Module } from "../src/model";
import { newProject } from "../src/project";
const [url] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(20000);
// проект собирается здесь же: на чистой копии репозитория local-projects нет (критик 01.11)
const cabinet: Module = { ...initialModule(), name: "Шкаф 800", width: 800, height: 2200, depth: 600, doors: true, sections: [section()] };
const seeded = newProject(cabinet); seeded.room = { ...seeded.room, width: 3200, depth: 2500, height: 2700 }; seeded.modules = [{ id: id(), x: 400, y: 0, z: 3, rotation: 0, module: cabinet }];
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 }); await page.waitForSelector("canvas", { timeout: 60000 }); await page.waitForTimeout(500);
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(seeded));
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 }); await page.waitForSelector("canvas", { timeout: 60000 }); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Построение мебели/ }).first().click();
await page.waitForTimeout(1500);
let fails = 0;
const sample = (ms: number) => page.evaluate(`new Promise((res) => {
  var out = [], t0 = performance.now();
  function tick() { var a = window.__toScreen(0, 0, 0), b = window.__toScreen(1600, 2700, 1500); out.push([a.x, a.y, b.x, b.y]); if (performance.now() - t0 < ${ms}) requestAnimationFrame(tick); else res(out); }
  tick();
})`) as Promise<number[][]>;
const check = (name: string, s: number[][]) => { const moved = Math.max(...s.map((r) => Math.max(...r.map((v, i) => Math.abs(v - s[0][i]))))); const ok = moved < 0.5; if (!ok) fails++; console.log((ok ? "OK   " : "FAIL ") + name + ` — сдвиг камеры ${moved.toFixed(1)} px`); };
for (const view of ["3D", "спереди"]) {
  if (view === "спереди") { await page.keyboard.press("s"); await page.waitForTimeout(1200); }
  const sr = sample(2000); await page.waitForTimeout(400); await page.keyboard.press("r");
  check(view + " · R", await sr);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(1500);
  const p = (await page.evaluate("window.__toScreen(800, 700, 300)")) as { x: number; y: number };
  await page.mouse.click(p.x, p.y, { button: "right" }); await page.waitForTimeout(700);
  const item = '.radial-menu [role=menuitem][aria-label^="Повернуть ↻"]';
  if (!(await page.locator(item).count())) { await page.locator('.radial-menu [role=menuitem][aria-label^="Корпус"]').first().click(); await page.waitForTimeout(500); }
  const st = sample(2000); await page.waitForTimeout(400); await page.locator(item).first().click();
  check(view + " · колесо «Повернуть ↻»", await st);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(1500);
}
await browser.close();
console.log(fails ? `ПРОВАЛОВ: ${fails}` : "ИТОГ: всё прошло");
process.exit(fails ? 1 : 0);
