// Снимки прорисованной фурнитуры: npx tsx scripts/hardware-shots.ts <url> <project.json> <out.png> [zoomTicks]
// Открывает фасады, вписывает активный корпус, приближает колесом и снимает.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [url, file, out, zoomArg = "4"] = process.argv.slice(2);
const project = readFileSync(file, "utf8");
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(url);
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "filling"); localStorage.setItem("studio-stage-advanced", "1"); localStorage.setItem("studio-dock", "project"); }, project);
await page.goto(url);
await page.waitForSelector("canvas");
await page.waitForTimeout(2000);
const doors = page.getByRole("button", { name: "Открыть фасады" });
if (await doors.count() && (await doors.first().getAttribute("aria-pressed")) !== "true") await doors.first().click();
const room = page.getByRole("button", { name: "Показать помещение" });
if (await room.count() && (await room.first().getAttribute("aria-pressed")) === "true") await room.first().click();
const fit = page.getByRole("button", { name: "Вписать модель" });
if (await fit.count()) await fit.first().click();
await page.waitForTimeout(800);
const box = (await page.locator("canvas").first().boundingBox())!;
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
for (let k = 0; k < Number(zoomArg); k++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(120); }
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
console.log("saved", out);
await browser.close();
