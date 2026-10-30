// Плавный переход между видами (Макс 30.10.2026) мышью и клавишами: npx tsx scripts/view-tween-3010-scenario.ts <url> <outDir>
//  1. 3D → «Спереди»: в середине перехода кадр не равен ни исходному, ни конечному (камера летит), к концу — вид спереди.
//  2. W A S D E подряд без пауз — без ошибок, в конце 3D; касание колесом посреди перехода — сразу конечный кадр.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: boolean[] = [];
const check = (name: string, ok: boolean, info = "") => { results.push(ok); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const canvas = page.locator("[data-testid=scene] canvas").first();
const frame = async (name: string) => canvas.screenshot({ path: `${out}/${name}.png` });

await page.goto(url);
await canvas.waitFor();
await page.waitForTimeout(3000);
// медленный кадр swiftshader: замедляем время страницы нельзя — берём снимок сразу после щелчка
const start = await frame("01-3d");
await page.getByRole("button", { name: "Спереди", exact: true }).first().click();
const mid = await frame("02-mid");
await page.waitForTimeout(1200);
const end = await frame("03-front");
check("в середине перехода — промежуточный кадр", !mid.equals(start) && !mid.equals(end));
check("переход закончился видом спереди", !end.equals(start));
// повтор того же вида — без полёта (кадр тот же)
await page.getByRole("button", { name: "Спереди", exact: true }).first().click();
await page.waitForTimeout(600);
const again = await frame("04-front-again");
check("тот же вид — без перехода", again.equals(end));

// виды подряд без пауз (новый переход стартует из текущего промежуточного кадра)
for (const v of ["Сверху", "Сбоку", "Спереди", "3D"]) await page.getByRole("button", { name: v, exact: true }).first().click();
await page.waitForTimeout(1200);
const back3d = await frame("05-quick-3d");
check("подряд — без ошибок, в конце 3D", !back3d.equals(end));
// колесо посреди перехода
await page.getByRole("button", { name: "Сверху", exact: true }).first().click();
await page.mouse.move(700, 450);
await page.mouse.wheel(0, -200);
await page.waitForTimeout(800);
await frame("06-wheel");
check("ошибок страницы нет", !errors.length, errors.join(" | "));
await browser.close();
const fails = results.filter((r) => !r).length;
console.log(fails ? `ИТОГ: провалов ${fails}` : "ИТОГ: всё прошло");
process.exit(fails ? 1 : 0);
