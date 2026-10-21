// Снимки студии: нижние угловые эталонов, построенные генератором (k02 m01, k27 m09) — 3D, спереди, без фасадов.
// npx tsx scripts/kcorner-shots.ts <url> <outDir>
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { newProject } from "../src/project";
import { k02Corner, k27Corner } from "./kitchen/cornerEtalons";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(800);
};
try {
  for (const [name, m] of [["k02-m01", k02Corner()], ["k27-m09", k27Corner()]] as const) {
    const p = newProject();
    p.modules = [{ id: "c", x: 1200, y: 0, z: 3, rotation: 0, module: m }];
    await page.goto(url);
    await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "facades"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(p));
    await page.goto(url); await page.waitForSelector("canvas"); await settle();
    await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
    await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {}); await settle();
    await page.screenshot({ path: `${out}/studio-${name}-3d.png` });
    await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
    await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {}); await settle();
    await page.screenshot({ path: `${out}/studio-${name}-front.png` });
    await page.getByRole("button", { name: /Скрыть фасады/ }).first().click().catch(() => {}); await settle();
    await page.screenshot({ path: `${out}/studio-${name}-front-no-facades.png` });
    await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {});
    await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {}); await settle();
    await page.screenshot({ path: `${out}/studio-${name}-3d-no-facades.png` });
    console.log("снимки", name);
  }
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
} finally { await browser.close(); }
