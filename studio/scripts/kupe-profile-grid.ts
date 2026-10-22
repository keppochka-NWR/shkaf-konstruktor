// Задание 22 (менеджеры 22.10): снимки всех профилей купе в 3D студии для сетки «все профили».
// npx tsx scripts/kupe-profile-grid.ts <url студии> <outDir>  →  <outDir>/grid/NN-<система>-{door,joint}.png и grid.json
// Двери купе 1600×2400, 2 полотна, раскладка «2 равные»: для каждой системы прайса — выбор в панели мышью, снимок полотна целиком
// (цвет, рамки, разделитель) и крупно — стык полотен вверху (ручки, рамки, верхняя направляющая: щели и выступы).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [url, out] = process.argv.slice(2);
const dir = out + "/grid"; mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(900);
};
const open = async (title: string) => { const s = page.locator(".kupe-panel summary", { hasText: title }).first(); if (await s.count() && !(await s.evaluate((el) => (el.parentElement as HTMLDetailsElement).open))) { await s.click(); await page.waitForTimeout(200); } };
await page.goto(url);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); });
await page.goto(url); await page.waitForSelector("canvas"); await settle();
await page.getByRole("tab", { name: "Шкафы-купе" }).click();
await page.getByRole("button", { name: "Двери купе", exact: true }).click();
await page.getByRole("button", { name: "Добавить в комнату" }).click(); await settle();
for (const name of ["Показать помещение", "Показать размеры"]) { const b = page.getByRole("button", { name }); if (await b.count() && (await b.first().getAttribute("aria-pressed")) === "true") await b.first().click(); }
await open("Наполнение дверей");
await page.locator(".kupe-sections button", { hasText: "2 равные" }).click(); await settle();
await open("Профиль и цвет");
const sel = page.getByLabel("Система профиля купе");
const systems = await sel.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
const fit = async () => { await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {}); await settle(); };
const rows: { n: number; system: string; color: string; door: string; joint: string }[] = [];
let n = 0;
for (const system of systems) {
  n++;
  await open("Профиль и цвет");
  await sel.selectOption(system); await settle();
  const color = (await page.locator(".kupe-swatches button[aria-pressed=true]").getAttribute("aria-label").catch(() => "")) ?? "";
  const tag = String(n).padStart(2, "0") + "-" + system.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/_+$/, "");
  await page.getByRole("button", { name: "Спереди", exact: true }).click(); await fit();
  const cv = (await page.locator("canvas").first().boundingBox())!;
  await page.mouse.move(cv.x + 5, cv.y + cv.height - 5); await page.waitForTimeout(300); // убрать подсказку кнопки
  await page.screenshot({ path: `${dir}/${tag}-door.png`, clip: { x: cv.x + cv.width * 0.29, y: cv.y + cv.height * 0.19, width: cv.width * 0.42, height: cv.height * 0.79 } });
  // крупно: стык полотен вверху в 3D (камера после «Приблизить» — колесом к точке стыка)
  await page.getByRole("button", { name: "3D", exact: true }).click(); await fit();
  await page.mouse.move(cv.x + cv.width * 0.5, cv.y + cv.height * 0.24);
  for (let k = 0; k < 9; k++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(60); }
  await settle();
  await page.screenshot({ path: `${dir}/${tag}-joint.png`, clip: { x: cv.x + cv.width * 0.2, y: cv.y + cv.height * 0.18, width: cv.width * 0.6, height: cv.height * 0.8 } });
  rows.push({ n, system, color, door: `${tag}-door.png`, joint: `${tag}-joint.png` });
  console.log(n, system, "·", color);
}
writeFileSync(`${dir}/grid.json`, JSON.stringify({ rows, errors }, null, 1), "utf8");
console.log("систем:", rows.length, "ошибок страницы:", errors.length);
await browser.close();
