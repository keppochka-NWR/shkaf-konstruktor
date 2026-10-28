// ДП 28.10 (dp-2810), кухня Г + барная стойка + витрина: сборка МЫШЬЮ И КЛАВИАТУРОЙ как менеджер в рабочем месте комнат
// (/studio/?rooms=1) — от пустой комнаты до готового проекта, затем сверка с проектом, собранным функциями (scripts/dp-2810-kitchen.ts):
// детали каждого корпуса (число, размер и положение, допуск 0,6 мм), строки сметы (id, количество, цена) и итог.
// npx tsx scripts/dp-2810-kitchen-manager.ts <origin, напр. http://127.0.0.1:8147, или полный url /studio/?rooms=1> [папка вывода]
// Только палитры, панели, окна, кольцевое меню и клавиатура (никаких инъекций проекта); localStorage — только чтение для сверки.
// Данные шагов — те же, что у эталона (STEPS, PANELS, VITRINE …): сценарий и функции не расходятся по замыслу.
import { chromium, type Locator, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parts } from "../src/model";
import { parseProject, bounds, type Project, type PlacedModule } from "../src/project";
import { estimate } from "../src/pricing";
import { KITCHEN_ITEMS } from "../src/kitchenProject";
import { seriesOf, type VernissageFacade } from "../src/facadesVernissage";
import type { PlaceTarget } from "../src/wallPlacement";
import { build, STEPS, PANELS, VITRINE, BAR, WING_TOP, BACK_TOP, BASE_FOR_WORKTOP, ROOM, DECOR, V_FLUTE, placeOrder, wingZ, type KitchenStep, type Edit } from "./dp-2810-kitchen";

const DEFAULT_OUT = "C:\\Users\\My PC\\Desktop\\Claude Project\\Кухни\\ГардерЁб\\Заказы\\ДП 28.10 себестоимость\\студия\\кухня\\мышью";
const [target = "http://127.0.0.1:8147", out = DEFAULT_OUT] = process.argv.slice(2);
const url = target.includes("/studio/") ? target : target.replace(/\/$/, "") + "/studio/?rooms=1";
mkdirSync(out, { recursive: true });

// эталон: те же данные; длины/положения, которые менеджер снимает с проекта (крыло от глубины задней столешницы), — из него же
const ref = build();
const refMod = (name: string) => ref.project.modules.find((a) => a.id === ref.ids[name])!;
const BACK_TOP_NAME = refMod("Столешница задняя").module.name;
const WZ = wingZ(ref.project, ref.ids["Столешница задняя"]);
const WING_AT: PlaceTarget = { y: 860, x: ROOM.width - refMod(WING_TOP.name).module.depth, z: WZ, rotation: 270 };

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page: Page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(8000);
const pageErrors: string[] = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("dialog", (d) => { void d.dismiss(); });
const stats = { clicks: 0, keys: 0, typed: 0 };
const log: { step: string; ok: boolean; ms: number; err?: string }[] = [];
let shotN = 0;
const shot = async (n: string) => { await page.waitForTimeout(500); await page.screenshot({ path: join(out, `${String(++shotN).padStart(2, "0")}-${n}.png`) }); };
const t0 = Date.now();
const banner = async () => (await page.locator(".error-banner, [role=alert]").filter({ visible: true }).allInnerTexts().catch(() => [])).join(" | ").replace(/\s+/g, " ").slice(0, 300);
async function step(name: string, fn: () => Promise<unknown>) {
  const t = Date.now();
  try { await fn(); log.push({ step: name, ok: true, ms: Date.now() - t }); console.log("ok  ", name, Date.now() - t, "мс"); }
  catch (e) {
    const msg = (e as Error).message.split("\n")[0].slice(0, 220) + " · " + (await banner());
    log.push({ step: name, ok: false, ms: Date.now() - t, err: msg }); console.log("FAIL", name, msg);
    await shot("fail-" + name.replace(/[^\wа-яё]+/gi, "_").slice(0, 40));
    await page.keyboard.press("Escape").catch(() => undefined);
  }
}
const props = () => page.locator("aside.properties");
const library = () => page.locator("aside.library");
async function click(l: Locator) { await l.scrollIntoViewIfNeeded(); await l.click(); stats.clicks++; await page.waitForTimeout(200); }
/** Раскрыть свёрнутые разделы панели справа (или другой области) щелчком по заголовкам, как менеджер. */
async function openPanels(scope: Locator = props()) {
  for (let round = 0; round < 5; round++) {
    const all = scope.locator("details:not([open]) > summary");
    let opened = 0;
    for (let i = 0, n = await all.count(); i < n && i < 80; i++) {
      const s = all.nth(i);
      if (!(await s.isVisible().catch(() => false))) continue;
      const txt = (await s.innerText().catch(() => "")).trim();
      if (/^Точки замера|^Двигать группу|^Кухни из базы/.test(txt)) continue;
      await s.scrollIntoViewIfNeeded().catch(() => undefined); await s.click().catch(() => undefined); stats.clicks++; opened++; await page.waitForTimeout(60);
    }
    if (!opened) break;
  }
}
const isPage = (s: Locator | Page): s is Page => typeof (s as Page).goto === "function";
async function label(aria: string, scope: Locator | Page = props()): Promise<Locator> {
  const find = () => scope.getByLabel(aria, { exact: true }).filter({ visible: true }).first();
  if (await find().count()) return find();
  await openPanels(isPage(scope) ? props() : scope);
  if (!(await find().count())) throw Error(`нет поля «${aria}»`);
  return find();
}
async function button(name: string | RegExp, scope: Locator | Page = props()) {
  const find = () => scope.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true }).first();
  if (!(await find().count())) await openPanels(isPage(scope) ? props() : scope);
  if (!(await find().count())) throw Error(`нет кнопки «${name}»`);
  await click(find());
}
/** Числовое (или текстовое) поле: тройной щелчок, ввод, Enter. verify — поле показывает введённое (иначе отказ — ошибка шага). */
async function field(aria: string, value: number | string, verify = true, scope: Locator | Page = props()) {
  const l = await label(aria, scope);
  // подсказка под полем в фокусе («До правой стены …») появляется и исчезает — поля ниже прыгают на её высоту, и щелчок может попасть
  // в соседнее поле; поэтому щелчок, проверка, что фокус в нужном поле (иначе ещё щелчок), затем Ctrl+A и ввод
  for (let i = 0; i < 3; i++) {
    await l.scrollIntoViewIfNeeded(); await l.click(); stats.clicks++; await page.waitForTimeout(120);
    if (await l.evaluate((e) => e === document.activeElement)) break;
    if (i === 2) throw Error(`поле «${aria}» не получает фокус`);
  }
  await page.keyboard.press("Control+A"); stats.keys++;
  await page.keyboard.type(String(value)); stats.typed++;
  await page.keyboard.press("Enter"); stats.keys++;
  await page.waitForTimeout(350);
  if (!verify) return;
  const v = await l.inputValue().catch(() => "");
  if (typeof value === "number" ? Number(v) !== value : v !== value) throw Error(`поле «${aria}»: ${v} вместо ${value}`);
}
/** Список: щелчок (открывается), стрелки до нужного пункта, Enter — одно изменение, как выбор мышью. */
async function pick(aria: string, want: string | RegExp, scope: Locator | Page = props()) {
  const sel = await label(aria, scope);
  await sel.scrollIntoViewIfNeeded();
  const opts = await sel.evaluate((s) => [...(s as HTMLSelectElement).options].map((o) => ({ v: o.value, t: o.text, d: o.disabled })));
  const cur = await sel.evaluate((s) => (s as HTMLSelectElement).selectedIndex);
  const wi = opts.findIndex((o) => (typeof want === "string" ? o.v === want : want.test(o.t)));
  if (wi < 0) throw Error(`нет пункта ${want} в «${aria}»: ${opts.map((o) => o.t).join(" | ").slice(0, 200)}`);
  if (wi === cur) return;
  const en = (i: number) => opts.slice(0, i).filter((o) => !o.d).length;
  const n = en(wi) - en(cur);
  await sel.click(); stats.clicks++; await page.waitForTimeout(120);
  for (let i = 0; i < Math.abs(n); i++) { await page.keyboard.press(n > 0 ? "ArrowDown" : "ArrowUp"); stats.keys++; }
  await page.keyboard.press("Enter"); stats.keys++;
  await page.waitForTimeout(400);
  if ((await sel.evaluate((s) => (s as HTMLSelectElement).selectedIndex).catch(() => -1)) !== wi) {
    const now = await label(aria, scope); // список мог перерисоваться
    if ((await now.evaluate((s) => (s as HTMLSelectElement).value)) !== opts[wi].v) throw Error(`«${aria}»: пункт «${opts[wi].t}» не выбран`);
  }
}
async function check(aria: string, on: boolean, scope: Locator | Page = props()) {
  const l = await label(aria, scope); await l.scrollIntoViewIfNeeded();
  if ((await l.isChecked()) !== on) { await l.click(); stats.clicks++; await page.waitForTimeout(350); }
  if ((await (await label(aria, scope)).isChecked()) !== on) throw Error(`флажок «${aria}» не переключился`);
}
/** Выбрать корпус в списке модулей слева. */
async function selectModule(name: string) {
  const l = library().locator(`.module-item[title="${name.replace(/"/g, '\\"')}"]`).first();
  if (!(await l.count())) throw Error(`нет корпуса «${name}» в списке`);
  await click(l); await page.waitForTimeout(250);
}
/** «Приблизить выбранный корпус» (переключатель): включить или переподогнать. */
async function focusSelected() {
  const b = page.getByRole("button", { name: "Приблизить выбранный корпус" }).first();
  if ((await b.getAttribute("aria-pressed")) === "true") { await click(b); }
  await click(b); await page.waitForTimeout(1200);
}
const ringItem = (label: string) => page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: new RegExp("^" + label + "( ›)?$") }) }).first();
/** Кольцевое меню правой кнопкой по выбранному корпусу (после «Приблизить»): заголовок меню должен назвать этот корпус; затем пункты по порядку. */
async function ring(moduleName: string, path: string[], view = "3D") {
  // столешница под навесными: в 3D её закрывают навесные крыла — вид «Сверху», щелчок по передней (свободной) части
  await page.getByRole("button", { name: view, exact: true }).first().click(); stats.clicks++; await page.waitForTimeout(600);
  await focusSelected();
  const cv = (await page.locator("canvas").first().boundingBox())!;
  let ok = false, seen = "";
  for (const [gx, gy] of [[0.5, 0.5], [0.5, 0.58], [0.5, 0.66], [0.42, 0.62], [0.58, 0.62], [0.5, 0.42], [0.5, 0.74]]) {
    await page.mouse.click(cv.x + cv.width * gx, cv.y + cv.height * gy, { button: "right" }); stats.clicks++; await page.waitForTimeout(450);
    if (await page.locator(".radial-menu").count()) {
      seen = (await page.locator(".radial-center").first().innerText().catch(() => "")).replace(/\s+/g, " ");
      if (seen.includes(moduleName)) { ok = true; break; }
      await page.keyboard.press("Escape"); stats.keys++; await page.waitForTimeout(200);
    }
  }
  if (!ok) throw Error(`меню не по корпусу «${moduleName}» (видно: ${seen})`);
  for (const p of path) {
    if (!(await ringItem(p).count()) && (await ringItem("Корпус").count())) { await click(ringItem("Корпус")); await page.waitForTimeout(300); }
    if (!(await ringItem(p).count())) throw Error(`в меню нет «${p}»: ${(await page.locator(".radial-label").allInnerTexts()).join(" | ")}`);
    await click(ringItem(p)); await page.waitForTimeout(400);
  }
}
/** Выбор МДФ Вернисаж («Все настройки»): серия, фрезеровка, покрытие, плёнка или цвет эмали, толщина — только то, что отличается. */
async function vernissage(to: VernissageFacade, scope: Locator) {
  await pick("Серия Вернисаж", seriesOf(to.milling).id, scope);
  await pick("Фрезеровка Вернисаж", to.milling, scope);
  if (await scope.getByLabel("Покрытие Вернисаж", { exact: true }).count()) await pick("Покрытие Вернисаж", to.cover, scope);
  if (to.cover === "film" && to.film) await pick("Плёнка Вернисаж", to.film, scope);
  if (to.cover.startsWith("enamel") && to.enamelColor !== undefined) {
    const l = await label("Цвет эмали Вернисаж", scope);
    if ((await l.inputValue()) !== to.enamelColor) await field("Цвет эмали Вернисаж", to.enamelColor, true, scope);
  }
  const chip = scope.getByRole("group", { name: "Толщина МДФ Вернисаж" }).getByRole("button", { name: new RegExp("^" + to.thickness + "( |$)") }).first();
  if ((await chip.getAttribute("aria-pressed")) !== "true") await click(chip);
}
/** Поля «Положение» кухонной панели в порядке placeOrder: поворот — выбором, отступы — ввод и Enter; в конце «Применить», если осталось. */
async function position(at: PlaceTarget) {
  for (const [k, v] of placeOrder(at)) {
    if (k === "r") await pick("Поворот кухонного модуля", String(v));
    else await field({ y: "От пола", x: "От левой стены", z: "От задней стены" }[k], v, false);
    if (process.env.DP_DEBUG) console.log("   pos", k, v, "→", await props().locator(".position-fields input, .position-fields select").evaluateAll((l) => l.map((e) => (e as HTMLInputElement).value).join(" / ")), (await props().locator(".position-fields .kitchen-warn").innerText().catch(() => "")).slice(0, 200));
  }
  const apply = props().getByRole("button", { name: "Применить положение" }).filter({ visible: true });
  if (await apply.count()) await click(apply.first());
  await page.waitForTimeout(300);
  for (const [k, v] of placeOrder(at)) if (k !== "r") { const now = Number(await (await label({ y: "От пола", x: "От левой стены", z: "От задней стены" }[k])).inputValue()); if (Math.abs(now - v) > 0.06) throw Error(`«Положение»: ${k} ${now} вместо ${v}`); }
}
async function kitchenEdit(e: Edit) {
  if ("width" in e) { await check("Менять ширину только этого корпуса", true); await field("Ширина", e.width); await check("Менять ширину только этого корпуса", false); return; }
  if ("height" in e) { await openPanels(); const legged = await props().getByLabel("Высота с опорами", { exact: true }).filter({ visible: true }).count(); await field(legged ? "Высота с опорами" : "Высота", e.height); return; }
  if ("depth" in e) return field("Глубина", e.depth);
  if ("support" in e) return field("Опорная полка духовки от пола", e.support);
  await pick("Материал кухонных фасадов", "vernissage");
  await vernissage(e.facade, props());
}
/** Кухонная палитра: вкладка «Кухонные модули» → «Готовые кухонные модули» (раскрыть) → кнопка ширины. */
async function kitchenPalette() {
  const tab = library().getByRole("tab", { name: "Кухонные модули" });
  if ((await tab.getAttribute("aria-selected")) !== "true") await click(tab);
  const sum = library().locator("details.catalog-presets:not([open]) > summary");
  if (await sum.count()) await click(sum.first());
}
async function kitchenModule(s: KitchenStep, first: boolean) {
  await kitchenPalette();
  if (s.wallY !== undefined) { const l = await label("Низ навесных от пола", library()); if (Number(await l.inputValue()) !== s.wallY) await field("Низ навесных от пола", s.wallY, true, library()); }
  await button(`${KITCHEN_ITEMS[s.kind].label} ${s.palette}`, library());
  await page.waitForTimeout(500);
  if (first) {
    // первый шкаф комнаты больше не нужен; корпус пенала — «Белый»
    await selectModule("Шкаф в прихожую"); await openPanels(); await button("Удалить модуль"); await page.waitForTimeout(500);
    await openPanels(); await button(/^Корпус: .* — выбрать декор$/);
    await (await label("Найти декор", page)).click(); stats.clicks++; await page.keyboard.type(DECOR); stats.typed++; await page.waitForTimeout(300);
    const all = page.locator(".decor-grid button");
    let hit = -1;
    for (let i = 0, n = await all.count(); i < n && hit < 0; i++) if ((await all.nth(i).evaluate((el) => [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join("").trim())) === DECOR) hit = i;
    if (hit < 0) throw Error(`в каталоге нет декора «${DECOR}»`);
    await click(all.nth(hit));
  }
  await field("Название кухонного модуля", s.name);
  for (const e of s.edit ?? []) await kitchenEdit(e);
  await position(s.at);
}
/** Имя модуля — поле «Название модуля» в шапке; при свёрнутой верхней панели шапка его прячет — «Заказ и инструменты», затем свернуть. */
async function headerName(name: string) {
  const open = page.getByRole("button", { name: "Заказ и инструменты" }).filter({ visible: true });
  const was = await open.count();
  if (was) await click(open.first());
  await field("Название модуля", name, true, page);
  if (was) { const close = page.getByRole("button", { name: "Свернуть верхнюю панель" }).filter({ visible: true }); if (await close.count()) await click(close.first()); }
}

// ===================================================================================================================================
await page.goto(url);
await page.waitForSelector("text=Добавить первый шкаф", { timeout: 90000 });
await page.waitForTimeout(1500);
await shot("empty-room");
await step(`комната ${ROOM.width} × ${ROOM.depth} × ${ROOM.height}`, async () => {
  await field("Ширина пустой комнаты", ROOM.width, true, page); await field("Глубина пустой комнаты", ROOM.depth, true, page); await field("Высота пустой комнаты", ROOM.height, true, page);
});
await step("«Добавить первый шкаф» (рабочее место открывается)", async () => {
  await button("Добавить первый шкаф", page); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2500);
  for (const b of await page.getByRole("button", { name: "Понятно" }).filter({ visible: true }).all()) await click(b);
});
await step("«Все настройки»", () => check("Все настройки", true, page));
await shot("room-first-cabinet");
for (const [i, s] of STEPS.entries()) {
  if (process.env.DP_STOP && i >= Number(process.env.DP_STOP)) { await browser.close(); process.exit(0); }
  await step(`кухня: «${s.name}» (палитра ${KITCHEN_ITEMS[s.kind].label} ${s.palette}${s.wallY !== undefined ? `, низ навесных ${s.wallY}` : ""})`, () => kitchenModule(s, i === 0));
  if (i === 0 || i === 4 || i === 6 || i === 9 || i === STEPS.length - 1) await shot("k-" + (i + 1) + "-" + s.name.replace(/[^\wа-яё]+/gi, "_"));
}
await step("фасады: пенал → «Применить ко всем модулям»", async () => { await selectModule(STEPS[0].name); await button("Применить ко всем модулям"); });
for (const s of STEPS.filter((x) => x.kind === "wall"))
  await step(`фасады: «${s.name}» — фрезеровка №${V_FLUTE.milling}`, async () => { await selectModule(s.name); await vernissage({ ...V_FLUTE }, props()); });
await shot("kitchen-facades");
await step(`столешница над нижними → акрил 40, длина ${BACK_TOP.length}, варочная от левого торца ${BACK_TOP.hob}`, async () => {
  await selectModule(BASE_FOR_WORKTOP); await kitchenPalette(); await button("Столешница над нижними", library()); await page.waitForTimeout(500);
  await pick("Материал столешницы", "acrylic-40"); await field("Длина", BACK_TOP.length);
  await button("+ под варочную"); await field("От левого торца", BACK_TOP.hob);
});
async function copyTop(name: string, length: number, at: PlaceTarget) {
  await selectModule(BACK_TOP_NAME);
  await ring(BACK_TOP_NAME, ["Копия"], "Сверху"); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "3D", exact: true }).first().click(); stats.clicks++; await page.waitForTimeout(400);
  await openPanels(); await click(props().getByRole("group", { name: "Вырез 1" }).getByRole("button", { name: "Убрать", exact: true }));
  await field("Длина", length); await headerName(name); await position(at);
}
await step(`столешница крыла: «Копия» → длина ${WING_TOP.end - WZ}, поворот 270, к правой стене`, () => copyTop(WING_TOP.name, WING_TOP.end - WZ, WING_AT));
await step("мойка: «Установить мойку и сифон»", async () => { await selectModule("Под мойку 600"); await button("Установить мойку и сифон"); });
await step("подсветка рабочей зоны: всем навесным ряда (задняя стена и крыло)", async () => {
  for (const n of ["Навесной 600", "Навесной 300"]) { await selectModule(n); await openPanels(); await button("Подсветка рабочей зоны всем навесным ряда"); }
});
await shot("kitchen-worktops");
await step(`барная стойка: «Копия» → ${BAR.length}, водопады слева и справа`, async () => {
  await copyTop(BAR.name, BAR.length, BAR.at); await check("Водопад слева", true); await check("Водопад справа", true);
});
await shot("bar");
await step(`витрина: «Пустой шкаф» ${VITRINE.width} × ${VITRINE.height} × ${VITRINE.depth}`, async () => {
  const tab = library().getByRole("tab", { name: "Шкафы распашные" }); await click(tab);
  const kind = library().getByRole("button", { name: "Пустой шкаф" }).first(); if ((await kind.getAttribute("aria-pressed")) !== "true") await click(kind);
  await field("Ширина новой мебели", VITRINE.width, true, library()); await field("Высота новой мебели", VITRINE.height, true, library()); await field("Глубина новой мебели", VITRINE.depth, true, library());
  await button("Добавить в комнату", library()); await page.waitForTimeout(800);
  const apart = library().getByRole("button", { name: /^Поставить отдельно/ });
  if (await apart.count()) await click(apart.first());
  await page.waitForTimeout(600);
  await headerName(VITRINE.name);
});
await step("витрина: без задника, высота 2520, цоколь 100, 4 полки", async () => {
  await pick("Тип задней стенки", "none"); await field("Высота", VITRINE.fullHeight); await pick("Высота цоколя", String(VITRINE.plinth)); await field("Полок в секции", VITRINE.shelves);
});
await step("витрина: правая кнопка → «Подсветка» → «Все полки секции»", () => ring(VITRINE.name, ["Подсветка", "Все полки секции"]));
await step(`витрина: фасады разделены по высоте (нижний ряд ${VITRINE.doorSplit}), рамка ALU ${VITRINE.alu.profile} шампань со стеклом`, async () => {
  await check("Разделить фасады по высоте", true); await field("Высота нижнего ряда фасадов", VITRINE.doorSplit);
  await pick("Тип распашных фасадов", "alu"); await pick("Профиль рамки", VITRINE.alu.profile); await pick("Цвет профиля", VITRINE.alu.color); await pick("Вставка рамки", VITRINE.alu.insert);
});
await step("витрина: «Положение» — от стойки, поворот 270, к правой стене, на место", async () => {
  for (const [k, v] of VITRINE.place) await field({ r: "Поворот корпуса", x: "От левой стены", y: "От пола", z: "От задней стены" }[k], v);
});
await shot("vitrine");
// ---------- отдельные панели: верхняя панель «Заказ и инструменты» → «Общий план · замер · панели · варианты · передача»
await step("окно комнат: «Общий план · замер · панели …»", async () => {
  const top = page.getByRole("button", { name: "Заказ и инструменты" });
  if (await top.count()) await click(top.first());
  const sum = page.locator("details.room-tools:not([open]) > summary");
  if (await sum.count()) await click(sum.first());
});
const tools = () => page.locator("details.room-tools");
for (const [input, at] of PANELS) {
  await step(`панель «${input.name}» ${input.width} × ${input.height}${input.vernissage ? ` МДФ №${input.vernissage.milling}` : " ЛДСП"}`, async () => {
    await field("Название", input.name, true, tools());
    await pick("Тип материала отдельной панели", input.vernissage ? "vernissage" : "ldsp", tools());
    await field("Длина панели", input.width, true, tools()); await field("Ширина панели", input.height, true, tools());
    if (!input.vernissage) { await field("Толщина панели", input.thickness, true, tools()); await field("Кромка по контуру", input.edge, true, tools()); }
    await pick("Плоскость отдельной панели", input.plane, tools());
    if (input.vernissage) await vernissage(input.vernissage, tools().getByRole("group", { name: "МДФ Вернисаж отдельной панели" }));
    else await pick("Материал отдельной панели", input.decor, tools());
    await button("Добавить панель в комнату", tools()); await page.waitForTimeout(900);
    await selectModule(input.name); await position(at);
  });
}
await shot("panels");
await step("стоимость: «Модель цены» → «Цена по большей модели»", async () => {
  await page.keyboard.press("Escape");
  const tab = page.locator(".dock-tabs button, .dock-bar button", { hasText: "Стоимость" }).first();
  if (await tab.count()) await click(tab);
  await pick("Модель цены", "max", page);
});
const seconds = Math.round((Date.now() - t0) / 1000);
await page.waitForTimeout(3000);
await shot("final-price");
// итоговые виды: верхняя панель свёрнута, нижняя — «Проект», без приближения выбранного корпуса
{ const fold = page.getByRole("button", { name: "Свернуть верхнюю панель" }).filter({ visible: true }); if (await fold.count()) await fold.first().click().catch(() => undefined); }
await page.locator(".dock-bar button", { hasText: "Проект" }).first().click().catch(() => undefined);
{ const f = page.getByRole("button", { name: "Приблизить выбранный корпус" }).first(); if ((await f.getAttribute("aria-pressed").catch(() => null)) === "true") await f.click().catch(() => undefined); }
for (const v of ["3D", "Спереди", "Сверху"]) { await page.getByRole("button", { name: v, exact: true }).first().click().catch(() => undefined); await page.waitForTimeout(1800); await shot("final-" + v); }

// ---------- Сверка: проект из хранилища (только чтение) против сборки функциями
const storageKeys = await page.evaluate(`Object.keys(localStorage)`) as string[];
const saved = await page.evaluate(`(() => { let best = null; const walk = (x, d) => { if (!x || typeof x !== "object" || d > 8) return; if (Array.isArray(x.modules) && x.room && (!best || x.modules.length > best.modules.length)) best = x; for (const v of Object.values(x)) walk(v, d + 1); }; for (const k of Object.keys(localStorage)) { if (k.includes(":previous")) continue; try { const doc = JSON.parse(localStorage.getItem(k) || "null"), before = best; walk(doc, 0); if (best && best !== before && doc && doc.calculation && !best.calculation) best = Object.assign({}, best, { calculation: doc.calculation }); /* расчёт — в документе комнат (29.10) */ } catch {} } return best; })()`) as Project | null;
await browser.close();
writeFileSync(join(out, "manager-project.json"), JSON.stringify(saved, null, 1));
const key = (a: PlacedModule) => { const b = bounds(a); return [Math.round(b.x), Math.round(b.y), Math.round(b.z), a.rotation ?? 0].join(","); };
const norm = (id: string, m: PlacedModule["module"]) => { let r = id; m.sections.forEach((s, i) => { r = r.split(s.id).join("s" + i); }); return r; };
const report: string[] = [];
let partDiffs = 0, modulesMatched = 0;
const propDiffs: string[] = [];
const mp = saved ? parseProject(saved, true) : null;
if (mp) {
  for (const a of ref.project.modules) {
    const b = mp.modules.find((x) => key(x) === key(a));
    if (!b) { report.push(`${a.module.name}: в сборке мышью нет корпуса в ${key(a)}`); partDiffs++; continue; }
    modulesMatched++;
    const pa = new Map(parts(a.module).filter((p) => p.role !== "fastener").map((p) => [norm(p.id, a.module), p])), pb = new Map(parts(b.module).filter((p) => p.role !== "fastener").map((p) => [norm(p.id, b.module), p]));
    const diffs: string[] = [];
    for (const [id, p] of pa) { const q = pb.get(id); if (!q) { diffs.push("нет " + id); continue; } const d = Math.max(...p.size.map((v, i) => Math.abs(v - q.size[i])), ...p.position.map((v, i) => Math.abs(v - q.position[i]))); if (d > 0.6) diffs.push(`${id} ±${d.toFixed(1)}`); }
    for (const id of pb.keys()) if (!pa.has(id)) diffs.push("лишняя " + id);
    partDiffs += diffs.length;
    // сверх деталей: все свойства модуля (материалы, Вернисаж, подсветка, рамки, вырезы …) — JSON без случайных id секций
    const js = (m: PlacedModule["module"]) => { let s = JSON.stringify(m); m.sections.forEach((x, i) => { s = s.split(x.id).join("s" + i); }); return s; };
    if (js(a.module) !== js(b.module)) { const ka = JSON.parse(js(a.module)), kb = JSON.parse(js(b.module)); propDiffs.push(`${a.module.name}: ${[...new Set([...Object.keys(ka), ...Object.keys(kb)])].filter((k) => JSON.stringify(ka[k]) !== JSON.stringify(kb[k])).join(", ")}`); }
    report.push(`${a.module.name} ↔ ${b.module.name}: деталей ${pa.size}/${pb.size}, отличий ${diffs.length}${diffs.length ? ": " + diffs.slice(0, 8).join("; ") : ""}`);
  }
  for (const b of mp.modules) if (!ref.project.modules.some((a) => key(a) === key(b))) { report.push(`лишний корпус у менеджера: ${b.module.name} в ${key(b)}`); partDiffs++; }
}
const er = estimate(ref.project), em = mp ? estimate(mp) : null;
const lineDiff = em ? [...new Set([...er.lines, ...em.lines].map((l) => l.id))].map((id) => { const x = er.lines.find((l) => l.id === id), y = em.lines.find((l) => l.id === id); return x && y && Math.abs(x.quantity - y.quantity) < 0.01 && x.unitPrice === y.unitPrice ? null : `${id}: ${x?.quantity ?? "—"} × ${x?.unitPrice ?? "?"} / ${y?.quantity ?? "—"} × ${y?.unitPrice ?? "?"}`; }).filter(Boolean) : ["нет проекта менеджера"];
const total = (e: ReturnType<typeof estimate> | null) => e ? { retail: e.retail, byMarkup: e.byMarkup, bySheet: e.bySheet, cost: e.knownCost } : null;
const result = { url, storageKeys, seconds, ...stats, steps: log.length, failed: log.filter((l) => !l.ok).map((l) => `${l.step}: ${l.err}`), modulesRef: ref.project.modules.length, modulesManager: mp?.modules.length ?? 0, modulesMatched, partDiffs, lineDiffs: lineDiff.length, propDiffs, calculationSame: JSON.stringify(ref.project.calculation) === JSON.stringify(mp?.calculation), priceRef: total(er), priceManager: total(em), lineDiff, report, pageErrors };
writeFileSync(join(out, "manager-result.json"), JSON.stringify({ ...result, log }, null, 1));
console.log(JSON.stringify(result, null, 1));
