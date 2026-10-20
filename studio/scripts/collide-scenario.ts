// Ложное «Фасад × чашка петли» (баг демо 20.10.2026) мышью: npx tsx scripts/collide-scenario.ts <url> <outDir>
// Шкаф QA 1200×2200×600, двери, 2 секции (полки 0.3/0.6 и 0.5), без подсветки → вид спереди, правый клик по корпусу →
// снимки; в подвале «Проверить расстановку · N» и панель «Есть пересечения деталей» — печатаем, что видно.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, section, id, type Module } from "../src/model";
import { newProject, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const proj = (m: Module): Project => { const p = newProject({ ...initialModule(), sections: [section()] }); p.modules = [{ id: id(), x: 1000, y: 0, z: 3, rotation: 0, module: m }]; return p; };
const wardrobe: Module = { ...initialModule(), name: "Шкаф QA", width: 1200, height: 2200, depth: 600, doors: true, sections: [section(), section()] };
wardrobe.sections[0].shelves = [0.3, 0.6]; wardrobe.sections[1].shelves = [0.5];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = (n: string) => page.screenshot({ path: `${out}/${n}.png` });
const menuOpen = async () => (await page.locator(".radial-menu").count()) > 0;
const text = async (sel: string) => (await page.locator(sel).allInnerTexts().catch(() => [])).join(" | ").replace(/\s+/g, " ").trim();
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(proj(wardrobe)));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await page.waitForTimeout(1500);
  const dock = await text(".room-warning-link:not([hidden])");
  const body = await page.locator("body").innerText();
  const coll = /Есть пересечения деталей[^\n]*\n?[^\n]*/.exec(body)?.[0]?.replace(/\s+/g, " ") ?? "";
  console.log("подвал: " + (dock || "(кнопки «Проверить расстановку» нет)"));
  console.log("панель: " + (coll || "(«Есть пересечения деталей» нет)"));
  await shot("01-front");
  // правый клик по корпусу мышью — как на снимке демо
  const c = (await page.locator("canvas").first().boundingBox())!;
  let opened = false;
  for (let gy = 0.4; gy <= 0.8 && !opened; gy += 0.05) for (let gx = 0.4; gx <= 0.6 && !opened; gx += 0.05) {
    await page.mouse.click(c.x + c.width * gx, c.y + c.height * gy, { button: "right" }); await page.waitForTimeout(100);
    if (await menuOpen()) opened = true;
  }
  console.log("меню правой кнопкой: " + (opened ? (await text(".radial-center b")) : "не открылось"));
  await shot("02-rclick");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  // клик мышью по «Проверить расстановку», если кнопка есть
  const link = page.locator(".room-warning-link:not([hidden])");
  if (await link.count()) { await link.first().click(); await page.waitForTimeout(800); console.log("после клика «Проверить расстановку»: " + (await text(".room-warning-panel, .room-warnings, [class*=warning]")).slice(0, 400)); }
  await shot("03-check");
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
} finally { await browser.close(); }
