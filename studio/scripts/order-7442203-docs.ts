// Заказ 7442203: снимки (3D, спереди, без фасадов, сверху), КП (PDF через quoteHTML студии) и смета Excel (estimateXLSX).
// npx tsx scripts/order-7442203-docs.ts <url своей сборки /studio/> <project.json> <папка вывода>
// Снимки — своя сборка в Chrome (headless, swiftshader), проект открыт из файла. В КП покупатель пустой: клиентских данных в документах нет.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseProject, type Project } from "../src/project";
import { estimate } from "../src/pricing";
import { estimateXLSX } from "../src/estimateXlsx";
import { moduleQuote } from "../src/itemPrices";
import { quoteHTML } from "../src/exports";

const [url, file, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const raw = readFileSync(file, "utf8"), project: Project = parseProject(JSON.parse(raw));
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name: string) => { await page.waitForTimeout(1500); const b = await page.locator("canvas").first().boundingBox(); await page.screenshot({ path: join(out, name + ".png"), clip: b ?? undefined }); console.log("снимок", name); };
const view = async (name: string) => { await page.getByRole("button", { name, exact: true }).click(); await page.waitForTimeout(1200); };
const toggle = async (name: RegExp) => { const b = page.getByRole("button", { name }); if (await b.count()) await b.first().click(); };
const zoom = async (ticks: number) => { const c = (await page.locator("canvas").first().boundingBox())!; await page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.45); for (let k = 0; k < ticks; k++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60); } };
// Изделие отдельно: тот же проект (комната, замер) только с модулями изделия — чтобы пенал на плане не загораживал угол
async function shots(label: string, names: (n: string) => boolean, obstacles = true) {
  const sub = { ...project, room: { ...project.room, obstacles: obstacles ? project.room.obstacles : [] }, modules: project.modules.filter((a) => names(a.module.name)) };
  await page.goto(url);
  await page.evaluate((r) => { localStorage.clear(); localStorage.setItem("module-studio-v3", r); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "1"); }, JSON.stringify(sub));
  await page.goto(url);
  await page.waitForSelector("canvas");
  await page.waitForTimeout(3000);
  await page.keyboard.press("Escape");
  const dims = page.getByRole("button", { name: "Показать размеры" });
  if (await dims.count() && (await dims.first().getAttribute("aria-pressed")) === "true") await dims.first().click();
  await view("3D"); await zoom(Number(process.env.ZOOM ?? 2)); await shot(`${label} — 3D`);
  await view("Спереди"); await shot(`${label} — спереди`);
  await view("Сверху"); await shot(`${label} — сверху`);
  await view("3D"); await toggle(/Скрыть фасады/); await zoom(Number(process.env.ZOOM ?? 2)); await shot(`${label} — 3D без фасадов`);
  await view("Спереди"); await shot(`${label} — спереди без фасадов`);
}
await shots("Снимок шкаф", (n) => !n.startsWith("Пенал"), false);
await shots("Снимок пенал", (n) => n.startsWith("Пенал"));
await shots("Снимок проект", () => true);
// КП: цена — расчёт студии (модель «по коэффициенту»), цены изделий — доли итога (как переключатель «Цены по изделиям»)
// решение Макса 26.10: цена клиенту — от большей из двух моделей (коэффициент 2,2 или «цена за лист 23 000» + вне листа)
const e = estimate(project), total = e.retail === null ? null : Math.max(e.retail, e.bySheet ?? 0);
if (total === null) throw Error("Нет цены проекта — КП не собирается.");
const q = moduleQuote(project, total);
const img = "data:image/png;base64," + readFileSync(join(out, "Снимок шкаф — 3D.png")).toString("base64");
const html = quoteHTML(project, "", String(total), "Заказ 7442203. Согласованный конструктив: угловой шкаф 2620 и пенал 2620. Позиции «после финального расчёта конструктором» в итог не входят.", img, { cost: e, items: q?.prices ?? null, pending: q?.pending ?? null });
writeFileSync(join(out, "КП 7442203.html"), html);
const doc = await browser.newPage();
await doc.setContent(html, { waitUntil: "load" });
await doc.pdf({ path: join(out, "КП 7442203.pdf"), format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" } });
writeFileSync(join(out, "Смета 7442203.xlsx"), await estimateXLSX(project, e));
console.log("КП и смета готовы; итог", total, "; ошибок страницы:", errors.length, errors.slice(0, 3).join(" | "));
await browser.close();
