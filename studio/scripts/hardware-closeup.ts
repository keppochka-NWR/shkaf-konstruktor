// Крупный план фурнитуры в студии: отдельный корпус с дверью (петли) и тремпелем, двери открыты.
// npx tsx scripts/hardware-closeup.ts <url> <outDir>
import { chromium } from "playwright";
import { initialModule, section } from "../src/model";
import { newProject } from "../src/project";

const [url, out] = process.argv.slice(2);
const m = initialModule();
Object.assign(m, { name: "Проверка фурнитуры", width: Number(process.env.W ?? 556), height: Number(process.env.H ?? 2200), depth: 400, plinthHeight: 60, doors: true, decor: "Слэйт", facadeDecor: "Слэйт" });
m.sections = [{ ...section(), doorLeaves: 1, shelves: process.env.H ? [] : [0.19, 0.32], fixed: process.env.H ? [] : [0, 1], pullouts: process.env.H ? undefined : 1 }];
const p = newProject(m); p.room = { ...p.room, width: 1600, depth: 1400, height: 2700 };
p.modules[0].x = 500; p.modules[0].z = 30;
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(url);
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "1"); }, JSON.stringify(p));
await page.goto(url);
await page.waitForSelector("canvas");
await page.waitForTimeout(2500);
for (const name of ["Показать помещение", "Показать размеры"]) { const b = page.getByRole("button", { name }); if (await b.count() && (await b.first().getAttribute("aria-pressed")) === "true") await b.first().click(); }
const open = page.getByRole("button", { name: "Открыть фасады" }); if (await open.count()) await open.first().click();
const fit = page.getByRole("button", { name: "Приблизить выбранный корпус" }); if (await fit.count()) await fit.first().click();
await page.waitForTimeout(2500);
const c = (await page.locator("canvas").first().boundingBox())!;
await page.screenshot({ path: `${out}/hw-0.png`, clip: c });
const zoomAt = async (fx: number, fy: number, ticks: number, name: string) => { await page.mouse.move(c.x + c.width * fx, c.y + c.height * fy); for (let k = 0; k < ticks; k++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60); } await page.waitForTimeout(1800); await page.screenshot({ path: `${out}/${name}.png`, clip: c }); };
await zoomAt(0.5, 0.5, Number(process.env.TICKS ?? 6), "hw-1");
await browser.close();
