// Скриншоты проекта студии: npx tsx scripts/shot.ts <url> <project.json> <out.png> [view]
// Загружает проект в localStorage как текущий, открывает студию и снимает холст.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [url, file, out, view = "iso", doorsArg = "closed"] = process.argv.slice(2);
const project = readFileSync(file, "utf8");
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(url);
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-stage-advanced", "1"); }, project);
await page.goto(url);
await page.waitForSelector("canvas");
await page.waitForTimeout(2500);
if (view === "front") await page.getByRole("button", { name: "Спереди", exact: true }).click();
if (view === "top") await page.getByRole("button", { name: "Сверху", exact: true }).click();
if (view === "plan") await page.getByRole("button", { name: "План", exact: true }).click();
// фасады закрыть, чтобы сравнивать с чертежом Базиса
const doors = page.getByRole("button", { name: "Открыть фасады" });
if (doorsArg === "closed" && await doors.count() && (await doors.first().getAttribute("aria-pressed")) === "true") await doors.first().click();
// показать помещение и вписать модель
const room = page.getByRole("button", { name: "Показать помещение" });
if (await room.count()) await room.first().click();
const fit = page.getByRole("button", { name: "Вписать модель" });
if (await fit.count()) await fit.first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: out, fullPage: false });
const price = await page.locator("footer").innerText().catch(() => "");
console.log("saved", out, "|", price.replace(/\s+/g, " ").slice(0, 120));
await browser.close();
