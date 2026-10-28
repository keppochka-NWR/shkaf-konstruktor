// Фигурные детали (задача Макса 29.10.2026, ветка claude/fix-shapes) мышью и клавиатурой, как менеджер:
//  A. «Добавить мебель» → «Для одежды» 800×2400×600 + «Мансарда (скос назад)», высота сзади 1800 → в комнату; панель: угол 40° →
//     высота сзади пересчиталась; ПКМ › Корпус › Антресоль — отказ «антресоль не ставится»; снимки 3D, спереди, сверху, сбоку.
//  B. Тот же шкаф: «Вырезы деталей…» → «Под плинтус» в боковине → высота 100 → «Сохранить»; ПКМ по фасаду › Фасад › «Вырез…» →
//     «Круглый» Ø60 → «Сохранить»; ошибка: вырез на всю ширину детали — «Сохранить» недоступно.
//  C. «Стеллаж радиусный» 400×2000×400 → в комнату; снимки 3D/сверху/спереди.
// Смета, раскрой и деталировка сохранённого проекта проверяются функциями студии (те же, что у вкладки «Документы»).
// npx tsx scripts/fix-shapes-scenario.ts <url studio/?fresh=1> <outDir>
import { chromium, type Locator, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parts, type Module } from "../src/model";
import { estimate } from "../src/pricing";
import { nest, detailCSV } from "../src/exports";
import type { Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results: [string, boolean, string][] = [], pageErrors: string[] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
page.on("pageerror", (e) => pageErrors.push(e.message)); page.on("dialog", (d) => void d.accept());
const shot = (n: string) => page.screenshot({ path: `${out}/${n}.png` });
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); await page.waitForTimeout(350); };
async function field(aria: string, value: string, exact = true) {
  const l = page.getByLabel(aria, { exact }).first();
  await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); await page.keyboard.type(value); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
}
/** Текущий проект комнаты (только для проверки — действия делаются мышью). */
const project = (): Promise<Project | null> => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("garderyob-rooms-v1") || "null"); if (!s) { const p = localStorage.getItem("module-studio-v3"); return p ? JSON.parse(p) : null; } return s.rooms.find((x: { id: string }) => x.id === s.activeRoomId)?.project ?? null; });
const moduleWith = async (f: (m: Module) => boolean): Promise<Module | undefined> => (await project())?.modules.find((a) => f(a.module))?.module;
const view = async (name: string) => { await page.getByRole("button", { name, exact: true }).first().click().catch(() => {}); await page.waitForTimeout(900); };
/** «Приблизить выбранный корпус» — переключатель: включаем, только если выключен; затем отводим мышь (подсказка не закрывает вид). */
const zoom = async () => { const b = page.getByRole("button", { name: "Приблизить выбранный корпус" }).first(); if ((await b.getAttribute("aria-pressed").catch(() => "true")) !== "true") await b.click().catch(() => {}); await page.mouse.move(5, 300); await page.waitForTimeout(900); };
const item = (label: string | RegExp) => page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: typeof label === "string" ? new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( ›)?$") : label }) }).first();
const menuOpen = async () => (await page.locator(".radial-menu").count()) > 0;
const esc = async () => { for (let k = 0; k < 3 && (await menuOpen()); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(80); } };
const title = async () => (await page.locator(".radial-center b").first().innerText({ timeout: 800 }).catch(() => "")).trim();
/** Точка на экране, где ПКМ открывает меню с заголовком re (поиск по средней линии холста, как в сценарии w-partition). */
async function findMenuPoint(re: RegExp): Promise<[number, number] | null> {
  const c = (await page.locator("canvas").first().boundingBox())!;
  for (const fy of [0.5, 0.4, 0.6]) for (let x = c.x + 40; x < c.x + c.width - 40; x += 14) {
    const y = c.y + c.height * fy;
    await page.mouse.click(x, y, { button: "right" }); await page.waitForTimeout(70);
    const ok = (await menuOpen()) && re.test(await title()); await esc();
    if (ok) return [x, y];
  }
  return null;
}
async function views(prefix: string) {
  for (const [v, n] of [["3D", "3d"], ["Спереди", "front"], ["Сверху", "top"], ["Сбоку", "side"]] as const) { await view(v); await zoom(); await shot(`${prefix}-${n}`); }
  await view("3D"); await zoom();
}

try {
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2500);
  await shot("00-start");

  // ── A. Мансарда из палитры ──
  await click(page.getByRole("tab", { name: "Шкафы распашные" }));
  await click(page.getByRole("button", { name: "Для одежды" }));
  await field("Ширина новой мебели", "800"); await field("Высота новой мебели", "2400"); await field("Глубина новой мебели", "600");
  check("палитра: переключатель «Мансарда (скос назад)»", (await page.getByLabel("Мансарда (скос назад) у новой мебели").count()) === 1);
  await click(page.getByLabel("Мансарда (скос назад) у новой мебели"));
  await field("Высота сзади новой мебели", "1800");
  await shot("A1-palette-mansard");
  await click(page.getByRole("button", { name: "Добавить в комнату", exact: true })); await page.waitForTimeout(2000);
  await click(page.getByRole("button", { name: /Построение мебели/ }).first());
  let man = await moduleWith((m) => !!m.mansard);
  check("мансарда в проекте: спереди 2400, сзади 1800", man?.height === 2400 && man?.mansard?.rear === 1800, JSON.stringify(man?.mansard));
  const ps = man ? parts(man) : [];
  check("крыша наклонная, боковины трапецией", !!ps.find((p) => p.id === "top")?.shape && !!ps.find((p) => p.id === "left")?.shape);
  await views("A2-mansard");
  // панель модуля: угол 40° → высота сзади пересчитана («Конструкция и фурнитура»)
  const extra = page.locator('details[data-settings-category="Дополнительно"]').first();
  if (await extra.count() && !(await extra.getAttribute("open").catch(() => null))) { await extra.locator("summary").first().click(); await page.waitForTimeout(400); }
  const cons = page.locator("details.construction-options").first();
  if (!(await cons.getAttribute("open").catch(() => null))) { await cons.locator("summary").first().scrollIntoViewIfNeeded(); await cons.locator("summary").first().click(); await page.waitForTimeout(400); }
  const box = page.getByLabel("Мансарда (скос назад)", { exact: true });
  check("панель модуля: «Мансарда (скос назад)» включена", (await box.count()) === 1 && (await box.isChecked()));
  await field("Угол скоса, ° (до 60)", "40");
  man = await moduleWith((m) => !!m.mansard);
  check("угол 40° → высота сзади 2400 − 600·tg40° = 1897", man?.mansard?.rear === 1897, String(man?.mansard?.rear));
  await page.getByTestId("shape-panel").scrollIntoViewIfNeeded().catch(() => {});
  await shot("A3-panel-angle40");
  // антресоль над мансардой — отказ (ПКМ › Корпус › Антресоль)
  await view("Спереди"); await zoom();
  const door = await findMenuPoint(/^Фасад/);
  check("фасад мансардного шкафа найден на экране (ПКМ)", !!door, JSON.stringify(door));
  await page.mouse.click(door![0], door![1], { button: "right" }); await page.waitForTimeout(500);
  if (await item("Корпус").count()) { await item("Корпус").click(); await page.waitForTimeout(300); }
  const upper = item(/^Антресоль/);
  if (await upper.count()) { await upper.click(); await page.waitForTimeout(400); const sub = item(/^Добавить|^Антресоль/); if (await menuOpen() && await sub.count()) { await sub.click(); await page.waitForTimeout(400); } }
  await esc();
  const alertText = (await page.locator('[role="alert"]').allInnerTexts()).join(" ");
  const nMods = (await project())?.modules.length ?? 0;
  check("антресоль над мансардой не ставится (сообщение, модулей не прибавилось)", /антресоль не ставится/.test(alertText) && nMods === 1, alertText.slice(0, 160));
  await shot("A4-no-antresol");

  // ── B. Вырезы ──
  await click(page.getByRole("button", { name: "Вырезы деталей…" }));
  check("окно «Вырезы детали» открыто на боковине", (await page.getByRole("dialog", { name: "Вырезы детали" }).count()) === 1 && /Боковина левая/.test(await page.getByLabel("Деталь для выреза").locator("option:checked").innerText()));
  await click(page.getByRole("button", { name: "Под плинтус" }));
  await field("Высота выреза 1 (по высоте)", "100");
  await shot("B1-cut-plinth-editor");
  await click(page.getByRole("button", { name: "Сохранить вырезы" })); await page.waitForTimeout(1200);
  man = await moduleWith((m) => !!m.mansard);
  check("вырез под плинтус сохранён в боковине", man?.cutouts?.length === 1 && man.cutouts[0].host === "left" && man.cutouts[0].h === 100, JSON.stringify(man?.cutouts));
  // ПКМ по фасаду › Фасад › Вырез… → круглый Ø60
  await view("Спереди"); await zoom();
  const door2 = (await findMenuPoint(/^Фасад/)) ?? door!;
  await page.mouse.click(door2[0], door2[1], { button: "right" }); await page.waitForTimeout(500);
  const t = await title();
  if (await item("Фасад").count()) { await item("Фасад").click(); await page.waitForTimeout(300); }
  const cutMenu = item("Вырез…");
  check("ПКМ по фасаду: «Вырез…» в меню фасада", (await cutMenu.count()) === 1, t);
  if (await cutMenu.count()) await cutMenu.click();
  await page.waitForTimeout(600);
  await click(page.getByRole("button", { name: "Круглый" }));
  await field("Диаметр выреза 1", "60");
  // ошибка: прямоугольный на всю ширину — «Сохранить» недоступно, потом убираем
  await click(page.getByRole("button", { name: "Прямоугольный" }));
  await field("Ширина выреза 2 (по ширине)", "5000");
  check("вырез шире детали: ошибка, «Сохранить вырезы» недоступно", (await page.getByRole("button", { name: "Сохранить вырезы" }).isDisabled()) && (await page.getByRole("alert", { name: "Ошибки вырезов" }).count()) === 1);
  await shot("B2-cut-error");
  await click(page.getByRole("button", { name: "Удалить вырез 2" }));
  await shot("B3-cut-round-door");
  await click(page.getByRole("button", { name: "Сохранить вырезы" })); await page.waitForTimeout(1200);
  man = await moduleWith((m) => !!m.mansard);
  check("круглый вырез Ø60 в фасаде сохранён", man?.cutouts?.length === 2 && man.cutouts.some((x) => x.shape === "round" && x.w === 60 && x.host.includes(":door:")), JSON.stringify(man?.cutouts?.map((x) => [x.host, x.shape, x.w])));
  await view("Спереди"); await zoom(); await shot("B4-cuts-front");
  await page.mouse.move(door2[0], door2[1]); for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(120); }
  await page.waitForTimeout(700); await shot("B4b-door-hole-closeup");
  await page.getByRole("button", { name: /Показать фасады|Скрыть фасады/ }).first().click().catch(() => {});
  await view("3D"); await zoom(); await shot("B5-cuts-3d-nofacades");
  await page.getByRole("button", { name: /Показать фасады|Скрыть фасады/ }).first().click().catch(() => {});

  // ── C. Радиусный стеллаж ──
  await click(page.getByRole("tab", { name: "Шкафы распашные" }));
  await click(page.getByRole("button", { name: "Стеллаж радиусный" }));
  await field("Ширина новой мебели", "400"); await field("Высота новой мебели", "2000"); await field("Глубина новой мебели", "400");
  check("палитра: радиус по умолчанию — четверть круга 384", (await page.getByLabel("Радиус скругления новой мебели").inputValue()) === "384");
  await shot("C1-palette-radius");
  await click(page.getByRole("button", { name: "Добавить в комнату", exact: true })); await page.waitForTimeout(2000);
  const rad = await moduleWith((m) => !!m.radius);
  check("радиусный стеллаж в проекте", rad?.radius?.r === 384 && rad.radius.side === "right", JSON.stringify(rad?.radius));
  await views("C2-radius");

  // ── Смета, раскрой, деталировка сохранённого проекта ──
  const p = (await project())!;
  const e = estimate(p), work = e.lines.find((l) => l.id === "cut-work"), curve = e.lines.find((l) => l.id === "edge-curve");
  check("смета: «Вырез / сложный выпил» — 1 (плинтус) + 1 (фасад) + 6 (радиусные) = 8 шт, после финального расчёта", work?.quantity === 8 && !!work.pending, JSON.stringify(work));
  check("смета: «Кромка по криволинейному контуру» (дуги + отверстие Ø60), пог. м", !!curve && Math.abs(curve.quantity - (6 * Math.PI * 0.384 / 2 + Math.PI * 0.06)) < 0.01, JSON.stringify(curve?.quantity));
  check("смета: итог есть (работы без цены не обнуляют)", e.retail !== null, String(e.retail));
  const csv = detailCSV(p);
  check("деталировка: пометки «фигурная» с размерами", /под плинтус: вырез 20×100/.test(csv) && /фигурная: отверстие Ø60/.test(csv) && /скругление R384/.test(csv) && /трапеция: спереди/.test(csv));
  const items = nest(p).flatMap((s) => s.items).filter((a) => /фигурная|трапеция|мансарда/.test(a.detail.name));
  check("раскрой: фигурные детали в картах по габариту", items.length >= 8, String(items.length));
  writeFileSync(`${out}/estimate-lines.txt`, e.lines.map((l) => `${l.id}\t${l.label}\t${l.quantity}\t${l.unit}\t${l.unitPrice ?? (l.pending ? "после расчёта" : "нет")}`).join("\n"));
  writeFileSync(`${out}/details.csv`, csv);
} catch (err) {
  check("сценарий без исключений", false, String(err)); await shot("99-error");
}
check("нет ошибок страницы", !pageErrors.length, pageErrors.slice(0, 3).join(" | "));
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
await browser.close();
const bad = results.filter((r) => !r[1]).length;
console.log(`итог: ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
