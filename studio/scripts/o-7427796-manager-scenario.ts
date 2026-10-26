// Заказ 7427796 мышью, как менеджер (требование Макса 26.10.2026: «всё отрисовать в расчётке, чтобы менеджер мог собрать руками»).
// npx tsx scripts/o-7427796-manager-scenario.ts <url /studio/?fresh=1> <outDir>
// От пустой комнаты (?fresh=1, без инъекций проекта) только мышью и клавиатурой: помещение → палитра «Добавить мебель» → панели свойств,
// модалки материалов и ручек → смета (кромку PUR не делаем — решение 26.10) → вариант 2 (зеркало на двери). В конце проект читается из localStorage и сравнивается
// со сборкой функциями (scripts/order-7427796.ts build): детали (имя, размеры, положение) и смета (цена, листы, строки).
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parts } from "../src/model";
import { parseProject, type Project } from "../src/project";
import { estimate } from "../src/pricing";
import { build } from "./order-7427796";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
let clicks = 0, inputs = 0, shotN = 0;
const steps: string[] = [];
const log = (s: string) => { steps.push(s); console.log("· " + s); };
const shot = async (name: string) => { await page.waitForTimeout(700); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png` }); };
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); clicks++; await page.waitForTimeout(250); };
/** Ввод в поле: клик, выделить всё, набрать, Enter (NumberField применяет по Enter/blur). */
const refused: string[] = [];
const type = async (l: Locator, v: string | number) => { await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); clicks++; await page.keyboard.press("Control+A"); await page.keyboard.type(String(v)); await page.keyboard.press("Enter"); inputs++; await page.waitForTimeout(450);
  const got = await l.inputValue().catch(() => "?"); if (got !== String(v)) { const label = await l.getAttribute("aria-label"); const alert = (await page.locator("[role=alert]").allInnerTexts().catch(() => [])).join(" / ").slice(0, 300); refused.push(`${label}=${v} → ${got}: ${alert}`); console.log("  ! НЕ ПРИНЯТО «" + label + "» " + v + " → " + got + " · " + alert); } };
const pick = async (l: Locator, label: string | RegExp) => { await l.scrollIntoViewIfNeeded(); const opts = await l.locator("option").allInnerTexts(); const want = opts.find((o) => typeof label === "string" ? o.trim() === label || o.includes(label) : label.test(o)); if (!want) throw Error("нет пункта " + label + " в " + opts.join(" | ")); await l.selectOption({ label: want }); clicks++; await page.waitForTimeout(350); };
const check = async (l: Locator, on = true) => { await l.scrollIntoViewIfNeeded(); if ((await l.isChecked()) !== on) { await l.click(); clicks++; await page.waitForTimeout(300); } };
const num = (label: string) => page.locator(`.properties input[aria-label="${label}"], aside input[aria-label="${label}"]`).first();
const field = (label: string) => page.locator(`input[aria-label="${label}"]`).first();
const sel = (label: string) => page.locator(`select[aria-label="${label}"]`).first();
const box = (label: string) => page.locator(`input[type=checkbox][aria-label="${label}"]`).first();
const btn = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" }).first();
async function openCat(cat: string) { const d = page.locator(`details[data-settings-category="${cat}"]`).first(); if (!(await d.count())) throw Error("нет категории " + cat); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
async function openSet(cat: string, title: string) { await openCat(cat); const d = page.locator(`details[data-setting="${title}"]`).first(); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
async function openConstruction() { await openCat("Дополнительно"); const d = page.locator("details.construction-options").first(); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
async function openFacades() { await openSet("Фасады и открывание", "Фасад"); const d = page.locator("details.section-facades").first(); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
async function stage(n: string) { await click(page.getByRole("button", { name: new RegExp(n) }).first()); }
// проект — из localStorage (только чтение для сравнения): ищем сохранённый проект с корпусами (ключ зависит от клиента/вкладки)
const saved = async (): Promise<Project> => { await page.waitForTimeout(1500); const all = (await page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? ""]))) as [string, string][];
  const found: [string, Project][] = []; const walk = (k: string, v: unknown, depth = 0) => { if (!v || typeof v !== "object" || depth > 6) return; const o = v as Record<string, unknown>; if (Array.isArray(o.modules) && o.room) { found.push([k, o as unknown as Project]); return; } for (const x of Object.values(o)) walk(k, x, depth + 1); };
  for (const [k, s] of all) { try { walk(k, JSON.parse(s)); } catch { /* не JSON */ } }
  const best = found.filter(([k]) => !k.endsWith(":previous") && !/undo|history/i.test(k)).sort((a, b) => b[1].modules.length - a[1].modules.length)[0];
  if (!best) throw Error("проект не сохранён: ключи " + all.map(([k]) => k).join(","));
  console.log("  (проект: ключ " + best[0] + ", корпусов " + best[1].modules.length + ")"); return parseProject(JSON.parse(JSON.stringify(best[1]))); };
async function selectModule(name: RegExp, index = 0) { // выбор корпуса в списке проекта слева
  const items = page.locator(".project-list button, .module-list button, .dock-modules button").filter({ hasText: name });
  if (await items.count()) { await click(items.nth(index)); return; }
  await click(page.getByText(name).nth(index));
}
async function addFromPalette(kind: string, w: number, h: number, d: number, doors?: string) {
  const pal = page.locator("details.module-palette").first();
  if ((await pal.getAttribute("open")) === null) await click(pal.locator("summary").first());
  await click(pal.getByRole("tab", { name: "Шкафы распашные" }));
  await click(pal.locator(".module-kinds button", { hasText: kind }).first());
  await type(pal.locator('input[aria-label="Ширина новой мебели"]'), w);
  await type(pal.locator('input[aria-label="Высота новой мебели"]'), h);
  await type(pal.locator('input[aria-label="Глубина новой мебели"]'), d);
  if (doors) await pick(pal.locator('select[aria-label="Дверей у новой мебели"]'), doors);
  await click(pal.getByRole("button", { name: "Добавить в комнату" }));
  await page.waitForTimeout(800);
}
const t0 = Date.now();
const variant: Record<string, { clicks: number; inputs: number; min: number }> = {};
try {
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(3000);
  await shot("empty-room");
  // 1. Помещение
  log("Помещение: ширина 2000, глубина 1800");
  await type(field("Ширина пустой комнаты"), 2000);
  await type(field("Глубина пустой комнаты"), 1800); await page.keyboard.press("Tab");
  // 2. Левый модуль — стеллаж 702×2000×600
  log("Палитра: «Стеллаж» 716×2000×600 → «Добавить в комнату»");
  await addFromPalette("Стеллаж", 716, 2000, 600);
  await shot("left-added");
  await stage("Построение мебели");
  // основание без цоколя
  log("Опоры: «Без цоколя (дно на полу)»");
  await openSet("Корпус и размещение", "Опоры");
  await pick(sel("Основание корпуса"), "Без цоколя (дно на полу)");
  // задник ЛДСП от 450
  log("Конструкция: задняя стенка «ЛДСП 16 · вкладная», «Задник ЛДСП от высоты» 450");
  await openConstruction();
  await pick(sel("Тип задней стенки"), "ЛДСП 16 · вкладная");
  await type(field("Задник ЛДСП от высоты от пола, мм (0 — от дна)"), 450);
  // положение: от левой стены 666, от задней 3
  log("Положение: от левой стены 666, от задней стены 3");
  await openSet("Корпус и размещение", "Положение");
  await type(num("От левой стены"), 666);
  await type(num("От задней стены"), 3);
  // одна полка: центр 426 от дна проёма (442 от пола), жёсткая
  log("Полки: «Полок в секции» 1, «Полка 1» 426 от дна проёма, жёсткая");
  await openSet("Наполнение", "Полки");
  await type(field("Полок в секции"), 1);
  await type(field("Полка 1"), 426);
  await check(box("Полка 1 жёсткая"));
  log("Полки: «Глубина полок» 568 (сиденье по эскизу)");
  await type(field("Глубина полок"), 568);
  // ящик: добавить, без полки над ящиками, Blum TANDEM, 550, без ручки, вкладной, от дна 202, боковина 140, фасад 196
  log("Ящики: «+» ящик; «Полка над ящиками» — нет; Blum TANDEM с доводчиком 550; без ручки; вкладной; от дна 202; боковина 140; фасад 196");
  await openSet("Наполнение", "Ящики");
  await click(page.locator('button[aria-label="Добавить: Ящики"]').first());
  await pick(sel("Полка над ящиками"), "Нет");
  await pick(sel("Направляющие ящика"), "Скрытые Blum TANDEM · с доводчиком");
  await pick(sel("Длина направляющих"), /^550 мм/);
  await pick(sel("Ручка ящика"), /Без ручки|Нет/);
  await openSet("Наполнение", "Дополнительные параметры секции");
  await check(box("Вкладные фасады ящиков"));
  await openSet("Наполнение", "Ящики");
  await type(field("Высота боковины ящика"), 140);
  await type(field("Ящик от дна проёма"), 202);
  await type(field("Высота фасада ящика"), 196);
  // посадочное место 32: выбрать полку и отметить
  log("Полка 1 → «Посадочное место 32 мм»");
  await openSet("Наполнение", "Полки");
  await click(page.getByRole("button", { name: "Выбрать: Полка 1" }));
  await openSet("Наполнение", "Дополнительные параметры секции");
  await check(box("Посадочное место 32 мм"));
  await shot("left-done");
  let p = await saved();
  console.log("модулей", p.modules.length);
  // 3. Правый модуль — «Для одежды» 600×2000×582
  log("Палитра: «Для одежды» 586×2000×582, одна дверь → «Добавить в комнату»");
  await addFromPalette("Для одежды", 586, 2000, 582, "1");
  await openSet("Корпус и размещение", "Положение");
  await type(num("От левой стены"), 1382);
  await type(num("От задней стены"), 0);
  log("Полка 1 — 346 от дна проёма; штанга 1818 от дна");
  await openSet("Наполнение", "Полки");
  await type(field("Полка 1"), 346);
  await openSet("Наполнение", "Штанги");
  await type(field("Высота штанги от дна"), 1818);
  log("Фасад: петли одной створки справа; дверь → угол петель 90°");
  await openFacades();
  await pick(sel("Петли выбранной секции"), "Справа");
  await click(page.locator('.facade-pick-list button').first());
  await pick(sel("Угол открывания петель"), "открывание на 90°");
  log("Конструкция: боковая фальшпанель справа 2450 × 600, 32 мм (добор)");
  await openConstruction();
  await check(box("Боковая фальшпанель справа"));
  { const h = page.locator('input[aria-label="Высота боковой панели right"]'); await type(h, 2450); }
  await check(box("Добор 32 мм справа"));
  log("Конструкция: «Фасады по эскизу» — низ 78, верх 1998 (дверь 1920)");
  await check(box("Фасады по эскизу"));
  await type(field("Низ фасадов от низа корпуса, мм"), 78);
  await type(field("Верх фасадов от низа корпуса, мм"), 1998);
  await shot("right-done");
  // 4. Антресоли
  log("Левый корпус → «Антресоль сверху на этот корпус»; высота 450, глубина 582; фасады включить, 2 створки; ХДФ; карниз 78; фасады по эскизу 0…370");
  await selectModule(/Модуль 1/);
  await openSet("Корпус и размещение", "Габариты");
  await click(btn(/Антресоль сверху на этот корпус/));
  await openSet("Корпус и размещение", "Габариты");
  await type(num("Высота"), 450);
  await type(num("Глубина"), 582);
  await openConstruction();
  await pick(sel("Тип задней стенки"), "ЛХДФ · набивная");
  await openSet("Корпус и размещение", "Положение");
  await type(num("От задней стены"), 0);
  await openSet("Фасады и открывание", "Фасад");
  { const sw = page.locator('button[role=switch][aria-label="Распашные фасады"]').first(); if ((await sw.getAttribute("aria-checked")) !== "true") await click(sw); }
  await openFacades();
  await pick(sel("Створки выбранной секции"), "Две створки");
  await click(page.locator('.facade-pick-list button').nth(1));
  await pick(sel("Угол открывания петель"), "155–165°");
  await openConstruction();
  await pick(sel("Планка под крышей"), /^80 мм/);
  await type(field("Планка под крышей (карниз), мм"), 78);
  await check(box("Фасады по эскизу"));
  await type(field("Низ фасадов от низа корпуса, мм"), 0);
  await type(field("Верх фасадов от низа корпуса, мм"), 370);
  log("Правый корпус → «Антресоль сверху»; высота 450; петли справа; карниз 78; фасады по эскизу 0…370");
  await selectModule(/Для одежды/);
  await openSet("Корпус и размещение", "Габариты");
  await click(btn(/Антресоль сверху на этот корпус/));
  await openSet("Корпус и размещение", "Габариты");
  await type(num("Высота"), 450);
  await openFacades();
  await pick(sel("Петли выбранной секции"), "Справа");
  await openConstruction();
  await pick(sel("Планка под крышей"), /^80 мм/);
  await type(field("Планка под крышей (карниз), мм"), 78);
  await check(box("Фасады по эскизу"));
  await type(field("Низ фасадов от низа корпуса, мм"), 0);
  await type(field("Верх фасадов от низа корпуса, мм"), 370);
  // 5. Материалы, ручки, петли Blum — всем корпусам
  log("Материал корпуса → «Все корпуса» → Дуб Сонома; материал фасадов → все → Белый Кристалл");
  await openSet("Корпус и размещение", "Материал корпуса");
  await click(page.locator('details[data-setting="Материал корпуса"] button.material-choice').first());
  await pick(sel("К каким корпусам применить материал"), /Все/);
  await type(field("Найти декор"), "Сонома");
  await click(page.locator(".decor-grid button", { hasText: /^Дуб Сонома/ }).first());
  await openSet("Фасады и открывание", "Фасад");
  await click(page.locator('details[data-setting="Фасад"] button', { hasText: /Материал фасадов/ }).first());
  await pick(sel("К каким корпусам применить материал"), /Все/);
  await type(field("Найти декор"), "Кристалл");
  await click(page.locator(".decor-grid button", { hasText: /^Белый Кристалл/ }).first());
  log("Ручки фасадов → «Все корпуса» → «кнопка Ø30 · чёрный мат»");
  await click(page.locator('details[data-setting="Фасад"] button', { hasText: /Ручки фасадов/ }).first());
  await pick(sel("К каким корпусам применить ручку"), /Все/);
  await type(field("Найти ручку"), "кнопка");
  await click(page.locator(".handle-list button.handle-item").first());
  log("Шкаф с дверью → «Ручки фасадов» → «Выбранный корпус» → «HEXA L-1200 · чёрный мат» (торцевая)");
  await click(page.locator(".dock-tabs button", { hasText: "Проект" }).first());
  await selectModule(/Для одежды/);
  await openSet("Фасады и открывание", "Фасад");
  await click(page.locator('details[data-setting="Фасад"] button', { hasText: /Ручки фасадов/ }).first());
  await pick(sel("К каким корпусам применить ручку"), /Выбранный корпус/);
  await type(field("Найти ручку"), "HEXA L-1200");
  await click(page.locator(".handle-list button.handle-item", { hasText: /чёрный/ }).first());
  log("Нижняя панель «Фурнитура» → «Выбрать фурнитуру…» (ко всему проекту): «Петли Blum» (кромку PUR не делаем — решение Макса 26.10)");
  await click(page.locator(".dock-tabs button", { hasText: "Фурнитура" }).first());
  await click(btn("Выбрать фурнитуру…"));
  const hw = page.locator('section.hw-window');
  await click(hw.locator(".hw-groups button", { hasText: "Петли" }).first());
  await click(hw.locator('button.hw-card[aria-label="Петли Blum"]'));
  await shot("hardware-window");
  await click(page.locator('button[aria-label="Закрыть окно фурнитуры"]'));
  await click(page.locator(".dock-tabs button", { hasText: "Стоимость" }).first());
  log("Стоимость: «Модель цены» → «Цена по большей модели» (интеграция 26.10: одно поле maxModel)");
  await pick(sel("Модель цены"), /по большей модели/);
  await shot("estimate-ldsp");
  const a = await saved();
  writeFileSync(`${out}/project-ldsp-mouse.json`, JSON.stringify(a, null, 1));
  variant.ldsp = { clicks, inputs, min: Math.round((Date.now() - t0) / 600) / 100 };
  // 7. Вариант 2 — зеркало на двери правого модуля
  const c0 = clicks, i0 = inputs, t1 = Date.now();
  log("Вариант 2: правый корпус → «Зеркало на фасадах» = серебро");
  await click(page.locator(".dock-tabs button", { hasText: "Проект" }).first());
  await selectModule(/Для одежды/);
  await openConstruction();
  await pick(sel("Зеркало на фасадах"), /серебро/);
  await shot("mirror");
  const b = await saved();
  writeFileSync(`${out}/project-mirror-mouse.json`, JSON.stringify(b, null, 1));
  variant.mirror = { clicks: clicks - c0, inputs: inputs - i0, min: Math.round((Date.now() - t1) / 600) / 100 };
} catch (e) {
  console.log("СБОЙ:", (e as Error).message);
  await shot("fail");
}
// сравнение с функциями
const sig = (p: Project) => p.modules.flatMap((x) => parts(x.module).map((q) => [q.name.replace(/[0-9a-f-]{36}/g, ""), q.decor, q.material, q.mirror ?? "", q.hingeAngle ?? "", q.size.map((v) => Math.round(v)).join("x"), [x.x + q.position[0], (x.y ?? 0) + q.position[1], x.z + q.position[2]].map((v) => Math.round(v)).join(",")].join(" | "))).sort();
const cmp = (name: string, file: string, ref: Project) => {
  let got: Project; try { got = parseProject(JSON.parse(require("node:fs").readFileSync(file, "utf8"))); } catch { console.log(name, ": проекта нет"); return; }
  const A = sig(got), B = sig(ref), onlyA = A.filter((x) => !B.includes(x)), onlyB = B.filter((x) => !A.includes(x));
  const ea = estimate(got), eb = estimate(ref);
  const la = ea.lines.map((l) => l.id + "=" + l.quantity).sort(), lb = eb.lines.map((l) => l.id + "=" + l.quantity).sort();
  console.log(`== ${name}: деталей мышью ${A.length}, функциями ${B.length}; только мышью ${onlyA.length}, только функциями ${onlyB.length}`);
  for (const x of onlyA.slice(0, 15)) console.log("  + " + x); for (const x of onlyB.slice(0, 15)) console.log("  - " + x);
  console.log("   расчёт мышью: " + JSON.stringify(got.calculation) + " · функциями: " + JSON.stringify(ref.calculation));
  console.log(`   цена мышью ${ea.retail} / функциями ${eb.retail}; листов ${ea.ldspSheets} / ${eb.ldspSheets}; строк сметы различаются: ${la.filter((x) => !lb.includes(x)).join(", ") || "нет"} / ${lb.filter((x) => !la.includes(x)).join(", ") || "нет"}`);
};
import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
cmp("ЛДСП", `${out}/project-ldsp-mouse.json`, build(false));
cmp("Зеркало", `${out}/project-mirror-mouse.json`, build(true));
console.log("Не принято полей:", refused.length, refused.join(" | "));
console.log("Шаги:", steps.length, "· варианты:", JSON.stringify(variant), "· ошибки страницы:", errors.length ? errors.join(" | ") : "нет");
writeFileSync(`${out}/steps.txt`, steps.map((s, i) => `${i + 1}. ${s}`).join("\n") + "\n" + JSON.stringify(variant), "utf8");
await browser.close();
