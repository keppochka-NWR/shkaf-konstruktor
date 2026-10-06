// Вид сверху на угол полотна купе крупно: проверка, что вставка входит в паз профиля. npx tsx scripts/kupe-closeup.ts <url> <project.json> <out.png>
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [url, file, out] = process.argv.slice(2);
const project = readFileSync(file, "utf8");
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(url);
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "1"); }, project);
await page.goto(url);
await page.waitForSelector("canvas");
await page.waitForTimeout(2000);
const room = page.getByRole("button", { name: "Показать помещение" });
if (await room.count() && (await room.first().getAttribute("aria-pressed")) === "true") await room.first().click();
const dims = page.getByRole("button", { name: "Показать размеры" });
if (await dims.count() && (await dims.first().getAttribute("aria-pressed")) === "true") await dims.first().click();
await page.getByRole("button", { name: "Сверху", exact: true }).click();
await page.waitForTimeout(1200);
// приблизить к середине переднего края, где стыкуются полотна
const c = (await page.locator("canvas").first().boundingBox())!;
const cx = c.x + c.width / 2, cy = c.y + c.height * 0.5;
await page.mouse.move(cx, cy);
for (let k = 0; k < 14; k++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(80); }
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
console.log("saved", out);
await browser.close();
