// ДП 28.10 (dp-2810), кухня/стойка/витрина: снимки проекта, собранного функциями (scripts/dp-2810-kitchen.ts).
// npx tsx scripts/dp-2810-kitchen-shots.ts <origin своей сборки, напр. http://127.0.0.1:8141> <папка снимков> [проект=dp-2810-kitchen]
// 3D общий вид, фронт задней стены, фронт правой стены (камера мышью), без фасадов (3D и спереди), план.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const [origin, out, slug = "dp-2810-kitchen"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${origin}/studio/?project=${slug}&fresh=1`);
await page.evaluate(() => { localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "1"); });
await page.goto(`${origin}/studio/?project=${slug}&fresh=1`);
await page.waitForSelector("canvas", { timeout: 90000, state: "attached" }).catch(async () => { console.log("нет сцены:", (await page.locator("body").innerText()).slice(0, 600), errors.join(" | ").slice(0, 400)); process.exit(1); });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {}); await page.waitForTimeout(1500);
{ const open = page.getByRole("button", { name: /Закрыть фасады|Закрыть створки/ }); if (await open.count()) await open.first().click(); }
const shot = async (name: string) => { await page.waitForTimeout(1800); await page.screenshot({ path: `${out}/${name}.png` }); console.log("saved", name); };
const view = async (name: string) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(1200); };
const toggle = async (name: RegExp) => { const b = page.getByRole("button", { name }); if (await b.count()) { await b.first().click(); await page.waitForTimeout(600); return true; } return false; };
const canvas = async () => (await page.locator("canvas").first().boundingBox())!;
const orbit = async (dx: number, dy = 0) => { const c = await canvas(), x = c.x + c.width / 2, y = c.y + c.height / 2; await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 25; i++) await page.mouse.move(x + dx * i / 25, y + dy * i / 25); await page.mouse.up(); };
const zoom = async (ticks: number) => { const c = await canvas(); await page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.5); for (let k = 0; k < Math.abs(ticks); k++) { await page.mouse.wheel(0, ticks > 0 ? -200 : 200); await page.waitForTimeout(60); } };
if (process.argv.includes("--buttons")) { console.log((await page.getByRole("button").allInnerTexts()).filter((t) => t.trim()).join(" | ").slice(0, 3000)); await browser.close(); process.exit(0); }
const dims = page.getByRole("button", { name: "Показать размеры" });
if (await dims.count() && (await dims.first().getAttribute("aria-pressed")) === "true") await dims.first().click();
await page.keyboard.press("Escape").catch(() => {});
await view("3D"); await zoom(Number(process.env.ZOOM ?? 2)); await shot("1-3d");
await view("Спереди"); await shot("2-front-back-wall-12-13");
// правая стена 13–14: свободная камера, поворот мышью на 90° от фронта
await view("3D"); if (!(await page.getByRole("button", { name: /Свободная камера/, pressed: true }).count())) await toggle(/Свободная камера/); await view("3D"); await orbit(Number(process.env.ORBIT ?? -380), 40); await zoom(1); await shot("3-front-right-wall-13-14");
await view("Спереди"); await toggle(/Скрыть фасады/); await shot("4-no-facades-front");
await view("3D"); await shot("5-no-facades-3d");
await toggle(/Показать фасады|Скрыть фасады/);
await view("План"); await shot("6-plan");
console.log("ошибки страницы:", errors.length ? errors.join(" | ").slice(0, 400) : "нет");
await browser.close();
