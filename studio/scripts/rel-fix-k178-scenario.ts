// Релиз 22.10, раунд 2 критика: K1 (подсветка у кухни), K7 (низ ряда навесных), K8 (Esc в «Наполнении»).
// npx tsx scripts/rel-fix-k178-scenario.ts <url /studio/> <outDir>
// Комната 3600: кухня прямая 3000 (один навесной на 8 мм ниже ряда — как 1450/1458 у критика) и шкаф справа.
// Действия — мышью и клавиатурой: выбор модулей в списке, поле «Низ ряда навесных», кнопка «Наполнение», Esc.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initialModule } from "../src/model";
import { createKitchenRow } from "../src/ModulePalette";
import { newProject, projectErrors, applyAutoFillers, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const project = (): Project => {
  const p = newProject();
  p.room = { ...p.room, width: 4600, depth: 3000, height: 2700 };
  // ряд от левой стены с местом под автофальшь 16 + 5 (как ставит палитра «Кухня прямая»)
  const row = createKitchenRow(3000, initialModule()).map((a) => ({ ...a, x: a.x + 21 }));
  const walls = row.filter((a) => a.module.kitchen?.role === "wall");
  walls[0].y = (walls[0].y ?? 0) - 8; walls[0].module.name = "Навесной низкий";
  const w = { ...p.modules[0], id: "wardrobe", x: 3400 };
  p.modules = [...row, w];
  const bad = projectErrors(applyAutoFillers(p)); if (bad.length) throw Error("исходный проект с ошибками: " + bad.join("; "));
  return p;
};
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(500);
};
const shot = async (n: string) => { await settle(); await page.screenshot({ path: join(out, `k178-${n}.png`) }); };
/** сохранённый проект: ключ module-studio-v3 или module-studio-v3:<вкладка> (кухня хранится под своим ключом) — самый свежий с модулями */
const stored = () => page.evaluate(() => { const keys = Object.keys(localStorage).filter((k) => k === "module-studio-v3" || k.startsWith("module-studio-v3:")); const all = keys.map((k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } }).filter((x) => Array.isArray(x.modules)); return (all.find((x, i) => keys[i] !== "module-studio-v3") ?? all[0] ?? {}) as Project; });
const keysNow = () => page.evaluate(() => Object.keys(localStorage).join(", "));
const openCategory = async (title: string) => {
  const d = page.locator(`details.settings-category[data-settings-category="${title}"]`).first();
  if ((await d.count()) && !(await d.evaluate((e) => (e as HTMLDetailsElement).open))) { await d.locator("summary").first().click(); await page.waitForTimeout(200); }
  return d;
};
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(project()));
  await page.goto(url); await page.waitForSelector("canvas"); await settle();
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.locator(".view-tabs button", { hasText: "Спереди" }).first().click(); await settle();
  // K7: навесной ряда (не тот, что ниже) — поле показывает ряд, а не выбранный модуль
  const p0 = await stored(), wallsIn = p0.modules.filter((a) => a.module.kitchen?.role === "wall");
  const other = wallsIn.find((a) => a.module.name !== "Навесной низкий")!, wName = p0.modules.find((a) => a.id === "wardrobe")!.module.name;
  const listItem = (name: string) => page.locator(".module-list .module-item", { hasText: name }).first();
  await listItem(other.module.name).click(); await settle();
  await openCategory("Корпус и размещение");
  const corpus = page.locator("details.kitchen-group", { hasText: "Корпус" }).first();
  if (!(await corpus.evaluate((e) => (e as HTMLDetailsElement).open))) { await corpus.locator("summary").first().click(); await page.waitForTimeout(200); }
  const rowField = page.getByLabel("Низ ряда навесных от пола");
  await rowField.scrollIntoViewIfNeeded();
  const ph = await rowField.getAttribute("placeholder"), val = await rowField.inputValue();
  const note = ((await rowField.locator("xpath=ancestor::label[1]").textContent()) ?? "").replace(/\s+/g, " ");
  await shot("01-k7-mixed");
  const ys = [...new Set(wallsIn.map((a) => Math.round(a.y ?? 0)))].sort((a, b) => a - b);
  check("K7: у ряда разная высота — поле «разные», в подсказке «разные: " + ys.join("/") + "»", ph === "разные" && val === "" && note.includes("разные: " + ys.join("/")), `placeholder=${ph} value=${val} · ${note.slice(0, 140)}`);
  const own = page.getByLabel("Низ от пола", { exact: true });
  check("K7: «Низ от пола» модуля — своё значение", (await own.inputValue()) === String(Math.round(other.y ?? 0)), await own.inputValue());
  // выровнять весь ряд: ввести высоту выше-стоящего
  await rowField.click(); await page.keyboard.type(String(ys[ys.length - 1])); await page.keyboard.press("Enter"); await settle();
  const alerts = await page.locator("[role=alert]").allTextContents(); if (alerts.length) console.log("alerts:", alerts.join(" | ").slice(0, 400));
  const rowAfter = await rowField.inputValue();
  await shot("02-k7-aligned");
  // проверка мышью: у «Навесного низкого» теперь тот же низ
  await listItem("Навесной низкий").click(); await settle();
  const lowAfter = await page.getByLabel("Низ от пола", { exact: true }).inputValue();
  const rowLow = await page.getByLabel("Низ ряда навесных от пола").inputValue();
  check("K7: ввод выравнивает весь ряд", rowAfter === String(ys[ys.length - 1]) && lowAfter === rowAfter && rowLow === rowAfter, `поле ряда ${rowAfter}; у «Навесного низкого» низ ${lowAfter}, ряд ${rowLow}`);
  await shot("02b-k7-low-selected");
  // K1: подзаголовок «Наполнения» у кухонного модуля без подсветки, у шкафа — с подсветкой
  const kHint = (await page.locator('details.settings-category[data-settings-category="Наполнение"] summary small').first().innerText().catch(() => "")).trim();
  check("K1: у кухонного модуля «Наполнение» без «подсветки»", !!kHint && !/подсветк/i.test(kHint), kHint);
  await listItem(wName).click(); await settle();
  const wHint = (await page.locator('details.settings-category[data-settings-category="Наполнение"] summary small').first().innerText().catch(() => "")).trim();
  check("K1: у шкафа «Наполнение» обещает подсветку (раздел есть)", /подсветк/i.test(wHint), wHint);
  // K8: Esc в режиме «Наполнение» — первое нажатие снимает выделение, справа «Ничего не выбрано»
  for (const name of [other.module.name, wName]) {
    const tag = name === wName ? "wardrobe" : "kitchen";
    await listItem(name).click(); await settle();
    await page.locator(".interaction-bar button", { hasText: "Наполнение" }).first().click(); await settle();
    await page.mouse.move(683, 660);
    await shot(`03-k8-fill-${tag}`);
    await page.keyboard.press("Escape"); await settle();
    await shot(`04-k8-esc1-${tag}`);
    const none = await page.getByTestId("nothing-selected").isVisible().catch(() => false);
    const pressed = await page.locator('.module-list .module-item[aria-pressed="true"]').filter({ hasText: name }).count();
    check(`K8: «${name}» в «Наполнении» — первое Esc снимает выделение, справа «Ничего не выбрано»`, none && pressed === 0, `ничего не выбрано: ${none}, выделен в списке: ${pressed}`);
  }
  // K8 (как у критика E05): клик по секции в «Наполнении» выбирает задник — у него нет плашки; первое Esc сразу «Ничего не выбрано».
  // Деталь с плашкой (полка) — Esc по шагам: первое убирает деталь (плашка исчезает), второе — модуль.
  await listItem(wName).click(); await settle();
  await page.locator(".interaction-bar button", { hasText: "Наполнение" }).first().click(); await settle();
  await page.mouse.click(842, 480); await settle();
  const bar = page.getByRole("button", { name: "Параметры", exact: true });
  const barBefore = await bar.isVisible().catch(() => false);
  await shot("05-k8-part-selected");
  await page.keyboard.press("Escape"); await settle();
  const barAfter = await bar.isVisible().catch(() => false), none1 = await page.getByTestId("nothing-selected").isVisible().catch(() => false);
  await shot("06-k8-part-esc1");
  await page.keyboard.press("Escape"); await settle();
  const none2 = await page.getByTestId("nothing-selected").isVisible().catch(() => false);
  await shot("07-k8-part-esc2");
  check("K8: клик по секции в «Наполнении» — первое Esc сразу «Ничего не выбрано»", !barBefore && none1 && none2, `плашка детали до ${barBefore} / после ${barAfter}; после 1-го Esc «ничего не выбрано» ${none1}, после 2-го ${none2}`);  // полка навесного: плашка детали есть — Esc по шагам
  await listItem(other.module.name).click(); await settle();
  await page.locator(".interaction-bar button", { hasText: "Наполнение" }).first().click(); await settle();
  await page.mouse.click(491, 362); await settle();
  const sb = await bar.isVisible().catch(() => false);
  await shot("08-k8-shelf-selected");
  await page.keyboard.press("Escape"); await settle();
  const sa = await bar.isVisible().catch(() => false), sn1 = await page.getByTestId("nothing-selected").isVisible().catch(() => false);
  await page.keyboard.press("Escape"); await settle();
  const sn2 = await page.getByTestId("nothing-selected").isVisible().catch(() => false);
  await shot("09-k8-shelf-esc2");
  check("K8: выбрана полка (плашка) — первое Esc снимает полку, второе — модуль", sb && !sa && !sn1 && sn2, `плашка до ${sb} / после ${sa}; «ничего не выбрано» после 1-го ${sn1}, после 2-го ${sn2}`);
  // K1: режим выбора деталей подсветки (шкаф) → клик по навесному кухни — понятное «в следующей версии»
  await listItem(wName).click(); await settle();
  await openCategory("Наполнение");
  const lightSec = page.locator('details[data-setting="Подсветка"]').first();
  if ((await lightSec.count()) && !(await lightSec.evaluate((e) => (e as HTMLDetailsElement).open))) { await lightSec.locator("summary").first().click(); await page.waitForTimeout(200); }
  await page.getByRole("button", { name: "Настроить подсветку…" }).click(); await settle();
  await page.getByRole("button", { name: "Режим выбора деталей" }).click(); await settle();
  await page.mouse.click(491, 362); await settle();
  const lightBar = (await page.locator(".light-mode-bar, [class*=light-mode]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  await shot("10-k1-light-kitchen");
  check("K1: клик по кухонному корпусу в режиме подсветки — «Подсветка кухни — в следующей версии»", lightBar.includes("Подсветка кухни — в следующей версии") && !lightBar.includes("не ставится"), lightBar.slice(0, 220));
  await page.keyboard.press("Escape"); await settle();
  check("нет ошибок страницы", !errors.length, errors.join("; "));
  const failed = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - failed.length}/${results.length}`);
  writeFileSync(join(out, "k178-scenario.json"), JSON.stringify(results, null, 1));
  if (failed.length) process.exitCode = 1;
} finally { await browser.close(); }
