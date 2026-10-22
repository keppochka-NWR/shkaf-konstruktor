// Релиз 22.10, m9: публичная сборка не запрашивает локальные проекты (local-projects/kitchens.json, wardrobes.json) — без 404.
// npx tsx scripts/m9-public-check.ts <url /studio/ публичной сборки> <outDir>
// Мышью: палитра «Кухонные модули» → модуль кухни в комнату; затем «Шкафы распашные». Все запросы к local-projects и ответы ≥ 400 — в отчёт.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { newProject } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const local: string[] = [], bad: string[] = [], errors: string[] = [];
page.on("request", (r) => { if (/local-projects/.test(r.url())) local.push(r.url()); });
page.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url()); });
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
try {
  // шкаф уже в комнате, этап «Построение мебели» — как у критика (B01–B04)
  await page.goto(url); await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(newProject()));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.getByRole("button", { name: /Дальше: Построение мебели/ }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(800);
  await page.locator("button:visible", { hasText: "Кухонные" }).first().click(); await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, "m9-01-kitchen-palette.png") });
  const add = page.locator("button", { hasText: /Нижн|Тумба|С дверями/ }).first();
  if (await add.count()) { await add.click(); await page.waitForTimeout(1500); }
  await page.locator("button:visible", { hasText: "распашные" }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1000);
  await page.locator("button:visible", { hasText: "Кухонные" }).first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1000);
  await page.screenshot({ path: join(out, "m9-02-after.png") });
  check("публичная сборка: запросов к local-projects нет", !local.length, local.join("; "));
  check("нет ответов 4xx/5xx", !bad.length, bad.join("; "));
  check("нет ошибок страницы", !errors.length, errors.join("; "));
  const failed = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - failed.length}/${results.length}`);
  if (failed.length) process.exitCode = 1;
} finally { await browser.close(); }
