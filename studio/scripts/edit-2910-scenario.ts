// Правки редактирования по списку Макса 29.10.2026 — мышью, как менеджер (ветка claude/fix-edit-2910). Проект для проверки читается из
// хранилища браузера (только чтение). npx tsx scripts/edit-2910-scenario.ts <url ?fresh=1> <outDir>
//  A. Delete: корпус выбран (список слева и щелчок по сцене после поля ввода справа) → Delete → «Удалить корпус «…»?»; Esc — отмена;
//     Enter — удалён; Ctrl+Z — вернулся. Ctrl+щелчок по двум корпусам → Delete → «Удалить 2 корпуса?» → «Да, удалить» → одна отмена.
//     Ctrl+щелчок в сцене — группа, Delete — тот же вопрос.
//  B. Правой кнопкой по секции → «Удалить секцию 2» → секций 1; Ctrl+Z — 2.
//  C. «Материал корпуса» → «Заменить у всех» → декор → у всех корпусов, одна отмена.
//  D. Стеллаж: «Добавить штангу» — штанга встаёт (раньше отказ «под штангой нужно 900 мм»), в панели предупреждение, ошибки нет.
//  E. Вырез на полке стеллажа → «Перенести / скопировать на схожие» → все → вырезы на всех таких полках обоих стеллажей, одна правка;
//     правой кнопкой по полке с вырезом — «Вырез на схожие…».
//  F. Средняя кнопка по створке — открывается/закрывается плавно (доля открытия в середине пути), протяжка средней — поворот камеры
//     (створки не трогает), колесо — масштаб; «Закрыть фасады» — тоже плавно; средняя по фасаду ящика комода — ящик выезжает.
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parts, type Module } from "../src/model";
import { parseProject, type Project } from "../src/project";
import { cutHost } from "../src/partIds";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => void d.accept());
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let shotN = 0;
const shot = async (name: string) => { await page.waitForTimeout(600); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png` }); };
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); await page.waitForTimeout(350); };
const type = async (l: Locator, v: string | number) => { await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); await page.keyboard.press("Control+A"); await page.keyboard.type(String(v)); await page.keyboard.press("Enter"); await page.waitForTimeout(600); };
const btn = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" }).first();
const banner = async () => (await page.locator(".error-banner").allInnerTexts().catch(() => [] as string[])).join(" ").replace(/\s+/g, " ").trim();
const noteText = async () => (await page.locator('[data-testid="studio-note"]').allInnerTexts().catch(() => [] as string[])).join(" ").replace(/\s+/g, " ");
const closeNote = async () => { await page.locator('[data-testid="studio-note"] button[aria-label="Закрыть сообщение"]').click({ timeout: 1000 }).catch(() => {}); };
const undo = async () => { await page.keyboard.press("Control+z"); await page.waitForTimeout(900); };
async function doc(): Promise<Project> {
  await page.waitForTimeout(900);
  const raw = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("garderyob-rooms-v1") && !x.includes(":previous") && !x.includes(":damaged")); return k ? localStorage.getItem(k) : null; });
  if (!raw) throw Error("документ комнат не сохранён");
  const d = JSON.parse(raw), rooms = d.rooms.map((r: { project: Project }) => parseProject({ ...r.project, ...(d.calculation ? { calculation: d.calculation } : {}) }, true));
  return rooms[d.rooms.findIndex((r: { id: string }) => r.id === d.activeRoomId)];
}
const mods = async () => (await doc()).modules;
async function openCat(cat: string) { let d = page.locator(`details[data-settings-category="${cat}"]`).first(); if (!(await d.count())) { await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {}); await page.waitForTimeout(500); d = page.locator(`details[data-settings-category="${cat}"]`).first(); } if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
async function openSet(cat: string, title: string) { await openCat(cat); const d = page.locator(`details[data-setting="${title}"]`).first(); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
async function reveal(l: Locator) {
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {});
  for (let round = 0; round < 5 && !(await l.isVisible().catch(() => false)); round++) {
    const closed = page.locator(".settings-tree details:not([open]) > summary");
    for (let i = 0, n = await closed.count(); i < n; i++) { const s = closed.nth(i); if (await s.isVisible().catch(() => false)) { await s.click().catch(() => {}); await page.waitForTimeout(80); if (await l.isVisible().catch(() => false)) return; } }
  }
}
async function addFromPalette(kind: string, w: number, h: number, d: number, tab = "Шкафы распашные") {
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {});
  const pal = page.locator("details.module-palette").first();
  if ((await pal.getAttribute("open")) === null) await click(pal.locator("summary").first());
  await click(pal.getByRole("tab", { name: tab }));
  await click(pal.locator(".module-kinds button", { hasText: kind }).first());
  await type(pal.locator('input[aria-label^="Ширина"][aria-label$="новой мебели"]'), w);
  await type(pal.locator('input[aria-label^="Высота"][aria-label$="новой мебели"]').first(), h);
  const dep = pal.locator('input[aria-label="Глубина новой мебели"]'); if (await dep.isVisible().catch(() => false)) await type(dep, d);
  await click(pal.getByRole("button", { name: "Добавить в комнату" }));
  await page.waitForTimeout(1200);
}
const listItem = (i: number) => page.locator(".module-list .module-item").nth(i);
async function front(zoom = true) { await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {}); const z = page.getByRole("button", { name: "Приблизить выбранный корпус" }); const on = (await z.getAttribute("aria-pressed").catch(() => "false")) === "true"; if (on !== zoom) await z.click().catch(() => {}); await page.mouse.move(5, 300); await page.waitForTimeout(1200); }
const ask = page.locator('[data-testid="delete-ask"]');
const askText = async () => ((await ask.count()) ? (await ask.locator("h2").innerText()).trim() : "");
const menuOpen = async () => (await page.locator(".radial-menu").count()) > 0;
const esc = async () => { for (let k = 0; k < 3 && (await menuOpen()); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(80); } };
const title = async () => (await page.locator(".radial-center b").first().innerText({ timeout: 800 }).catch(() => "")).trim();
const item = (label: string | RegExp) => page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: typeof label === "string" ? new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( ›)?$") : label }) }).first();
const canvas = async () => (await page.locator("canvas").first().boundingBox())!;
const openState = async () => (await page.evaluate(() => (window as unknown as { __openState?: () => Record<string, { t: number; target: number }> }).__openState?.() ?? {})) as Record<string, { t: number; target: number }>;
const camera = async () => page.evaluate(() => { const k = Object.keys(sessionStorage).find((x) => x.startsWith("garderyob-camera:")); return k ? sessionStorage.getItem(k) : null; });

try {
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2500);
  await addFromPalette("Для одежды", 1000, 2200, 600);
  await addFromPalette("Стеллаж", 800, 2000, 400);
  await addFromPalette("Стеллаж", 800, 2000, 400);
  await addFromPalette("Комод", 800, 850, 550);
  let ms = await mods();
  const n0 = ms.length;
  check("0 проект: шкаф, 2 стеллажа, комод", n0 >= 4, ms.map((a) => a.module.name).join(", "));

  // ── A. Delete ──
  await click(listItem(n0 - 2));
  const name2 = ms[n0 - 2].module.name;
  await page.keyboard.press("Delete"); await page.waitForTimeout(400);
  check("A1 корпус выбран в списке, Delete → вопрос «Удалить корпус «…»?»", (await askText()) === `Удалить корпус «${name2}»?`, await askText());
  await shot("A1-delete-ask");
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  check("A2 Esc — отмена: вопрос закрыт, корпусов столько же", (await ask.count()) === 0 && (await mods()).length === n0);
  // поле ввода справа в фокусе, затем щелчок по корпусу в сцене (как менеджер) — Delete не уходит в поле
  await front(true);
  const field = page.locator(".properties input[type=number], aside input[type=number]").first();
  if (await field.count()) { await field.scrollIntoViewIfNeeded().catch(() => {}); await field.click().catch(() => {}); }
  const c = await canvas();
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2); await page.waitForTimeout(500);
  const focusTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
  await page.keyboard.press("Delete"); await page.waitForTimeout(400);
  const q2 = await askText();
  check("A3 поле справа, затем щелчок по корпусу в сцене, Delete → вопрос (фокус не в поле)", /^Удалить корпус «/.test(q2), `${q2}; фокус ${focusTag}`);
  await page.keyboard.press("Enter"); await page.waitForTimeout(900);
  ms = await mods();
  check("A4 Enter — «Да, удалить»: корпус удалён", ms.length === n0 - 1 && (await ask.count()) === 0, `${ms.length} из ${n0}`);
  await shot("A4-deleted");
  await undo(); ms = await mods();
  check("A5 Ctrl+Z — корпус вернулся", ms.length === n0, `${ms.length}`);
  await click(listItem(0));
  await listItem(1).click({ modifiers: ["Control"] }); await page.waitForTimeout(300);
  await listItem(2).click({ modifiers: ["Control"] }); await page.waitForTimeout(300);
  await page.keyboard.press("Delete"); await page.waitForTimeout(400);
  const names = (await page.locator('[data-testid="delete-ask-names"]').innerText().catch(() => "")).trim();
  check("A6 Ctrl+щелчок по двум корпусам в списке, Delete → «Удалить 2 корпуса?» с именами", (await askText()) === "Удалить 2 корпуса?" && names.includes(`«${ms[1].module.name}»`) && names.includes(`«${ms[2].module.name}»`), `${await askText()} ${names}`);
  await click(ask.getByRole("button", { name: "Да, удалить" }));
  ms = await mods();
  check("A7 «Да, удалить» — оба удалены одной правкой", ms.length === n0 - 2, `${ms.length}`);
  await undo(); ms = await mods();
  check("A8 одна отмена Ctrl+Z — оба вернулись", ms.length === n0, `${ms.length}`);
  await page.getByRole("button", { name: "Снять выделение" }).click().catch(() => {}); await page.waitForTimeout(300);
  // критик 29.10 (1): Ctrl+щелчок по «Стеллаж» и «Комод», затем обычный щелчок по «Модуль 1» — Delete удаляет «Модуль 1», а не группу
  await listItem(1).click({ modifiers: ["Control"] }); await page.waitForTimeout(300);
  await listItem(3).click({ modifiers: ["Control"] }); await page.waitForTimeout(300);
  await click(listItem(0));
  const marks = await page.locator(".module-list .module-group-selected").count();
  await page.keyboard.press("Delete"); await page.waitForTimeout(400);
  check("A11 Ctrl+щелчок по двум, обычный по «Модуль 1» — отметки сняты, Delete → «Удалить корпус «Модуль 1»?»", marks === 0 && (await askText()) === `Удалить корпус «${ms[0].module.name}»?`, `отмечено ${marks}; «${await askText()}»`);
  // критик 29.10 (4): под вопросом Q не начинает вспомогательную линию
  const guides0 = await page.evaluate(() => JSON.stringify((window as unknown as { __guides?: () => unknown }).__guides?.() ?? []));
  await page.keyboard.press("q"); await page.mouse.move(700, 400); await page.waitForTimeout(300);
  const toolOn = await page.locator(".guide-tool, .guide-hint").count();
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  check("A12 под вопросом «Удалить?» клавиша Q не действует; Esc — вопрос закрыт, ничего не удалено", (await ask.count()) === 0 && (await mods()).length === n0 && guides0 === (await page.evaluate(() => JSON.stringify((window as unknown as { __guides?: () => unknown }).__guides?.() ?? []))) && toolOn === 0, `инструмент ${toolOn}`);
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  // критик 29.10 (3): окно «Фурнитура» открыто или фокус в выпадающем списке — Delete не спрашивает про корпус
  await click(listItem(0));
  const dockHw = page.getByRole("button", { name: "Фурнитура", exact: true }).first();
  await dockHw.click(); await page.waitForTimeout(500); await page.getByRole("button", { name: "Выбрать фурнитуру…" }).first().click(); await page.waitForTimeout(800);
  const hw = await page.locator(".hw-window").count();
  await page.keyboard.press("Delete"); await page.waitForTimeout(400);
  check("A13 открыто окно «Фурнитура», Delete — вопроса нет, корпуса на месте", hw === 1 && (await ask.count()) === 0 && (await mods()).length === n0, `окно ${hw}`);
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  await dockHw.click(); await page.waitForTimeout(500);
  const sel = page.locator("aside select:visible, .properties select:visible").first();
  if (await sel.count()) await sel.focus();
  await page.keyboard.press("Delete"); await page.waitForTimeout(400);
  check("A14 фокус в выпадающем списке, Delete — вопроса нет", (await sel.count()) > 0 && (await ask.count()) === 0 && (await mods()).length === n0);
  await page.mouse.click(5, 300);
  // Ctrl+щелчок в сцене: вид спереди — корпуса в ряд
  await click(listItem(0)); await front(false);
  const cv = await canvas(); let marked = 0;
  await page.keyboard.down("Control");
  for (let x = cv.x + 30; x < cv.x + cv.width - 30 && marked < 2; x += 25) {
    await page.mouse.click(x, cv.y + cv.height * 0.6); await page.waitForTimeout(150);
    const now = await page.locator(".module-list .module-group-selected").count();
    if (now > marked) { marked = now; x += 150; }
  }
  await page.keyboard.up("Control");
  await page.keyboard.press("Delete"); await page.waitForTimeout(400);
  const q3 = await askText();
  check("A9 Ctrl+щелчок по двум корпусам в сцене, Delete → «Удалить 2 корпуса?»", marked === 2 && q3 === "Удалить 2 корпуса?", `отмечено ${marked}; «${q3}»`);
  await shot("A9-scene-group-ask");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  check("A10 Esc — ничего не удалено", (await mods()).length === n0);
  await page.getByRole("button", { name: "Снять выделение" }).click().catch(() => {}); await page.waitForTimeout(300);

  // ── B. «Удалить секцию» правой кнопкой ──
  await click(listItem(0)); await front(true);
  const hideF = page.getByRole("button", { name: /^(Скрыть|Показать) фасады$/ }).first();
  if (/Скрыть/.test(await hideF.innerText())) await click(hideF);
  /** Правой кнопкой по сцене (строки fy, слева направо от fx0 до fx1), пока меню не покажет нужный пункт. */
  async function rmbUntil(has: string | RegExp, fx0 = 0.2, fx1 = 0.8, rows = [0.5, 0.4, 0.6, 0.3], want = /./): Promise<string> {
    const z = await canvas();
    for (const fy of rows) for (let x = z.x + z.width * fx0; x < z.x + z.width * fx1; x += 14) { await page.mouse.click(x, z.y + z.height * fy, { button: "right" }); await page.waitForTimeout(90); if ((await menuOpen()) && want.test(await title()) && (await item(has).count())) return await title(); await esc(); }
    return "";
  }
  let rmbTitle = await rmbUntil("Добавить");
  if (rmbTitle) { await click(item("Добавить")); await click(item("В секцию")); await click(item("Перегородку")); }
  ms = await mods(); const w0 = ms[0].module, s0 = w0.sections.length;
  check("B0 правой кнопкой по шкафу → «Добавить» › «Перегородку» — 2 секции", s0 === 2, `меню «${rmbTitle}», секций ${s0}`);
  await front(true);
  rmbTitle = await rmbUntil(/^Удалить секцию 2$/, 0.5, 0.85);
  check("B1 правой кнопкой по секции 2 — «Удалить секцию 2» в меню корпуса", !!rmbTitle, `меню «${rmbTitle}»`);
  await shot("B1-rmb-section");
  if (rmbTitle) await click(item(/^Удалить секцию 2$/));
  ms = await mods();
  check("B2 «Удалить секцию 2» — секций 1, ширина корпуса та же", ms[0].module.sections.length === 1 && ms[0].module.width === w0.width, `${ms[0].module.sections.length}`);
  await undo(); ms = await mods();
  check("B3 Ctrl+Z — снова 2 секции", ms[0].module.sections.length === 2 && ms.length === n0, `${ms[0].module.sections.length}`);
  if (/Показать/.test(await hideF.innerText())) await click(hideF);
  // ── C. «Заменить у всех» ──
  await reveal(page.locator(".material-choice").first());
  await click(page.locator(".material-choice").first());
  const all = page.getByRole("checkbox", { name: "Заменить у всех" });
  check("C1 окно «Материалы»: галочка «Заменить у всех»", (await all.count()) === 1);
  await all.check(); await page.waitForTimeout(200);
  await shot("C1-replace-all");
  const decorBtn = page.locator(".decor-grid button").filter({ hasText: /Графит/ }).first();
  await click(decorBtn);
  ms = await mods();
  const decors = [...new Set(ms.map((a) => a.module.decor))];
  check("C2 декор каркаса — у всех корпусов", decors.length === 1 && /Графит/.test(decors[0]), decors.join(", "));
  check("C3 сообщение «заменён у N из N»", /заменён у \d+ из \d+/.test(await noteText()), (await noteText()).slice(0, 160));
  await closeNote(); await undo(); ms = await mods();
  check("C4 одна отмена Ctrl+Z — декоры как были", !ms.some((a) => /Графит/.test(a.module.decor)), [...new Set(ms.map((a) => a.module.decor))].join(", "));

  // ── D. Штанга без 900 мм под ней: «Добавить» › «Вешалки» › «Штангу» правой кнопкой между полками стеллажа ──
  await click(listItem(1)); await front(true);
  ms = await mods(); const st0 = ms[1].module;
  const hideD = page.getByRole("button", { name: /^(Скрыть|Показать) фасады$/ }).first();
  const rmb = await rmbUntil("Добавить", 0.05, 0.95, [0.45, 0.35, 0.55], /^Стеллаж$/);
  if (rmb) { await click(item("Добавить")); await click(item("В секцию")); await click(item("Вешалки")); await click(item("Штангу")); }
  ms = await mods(); const st1 = ms[1].module, bn = await banner();
  check("D1 стеллаж с полками через каждые ~365 мм: «Добавить › Вешалки › Штангу» — штанга встала (раньше «недостаточно места»)", !!rmb && st1.sections[0].rod && !/под штангой нужно|недостаточно свободного места/.test(bn), `полок ${st0.sections[0].shelves.length}, штанга ${st1.sections[0].rod}; ${bn.slice(0, 120)}`);
  const warn = page.locator('[data-testid="rod-clearance-warning"]').first();
  await reveal(warn);
  check("D2 в панели «Штанги» — предупреждение про норму места под одеждой", /меньше нормы 900 мм/.test(await warn.innerText().catch(() => "")), (await warn.innerText().catch(() => "")).slice(0, 160));
  await warn.scrollIntoViewIfNeeded().catch(() => {}); await shot("D-rod-warning");
  void hideD;
  if (st1.sections[0].rod) { await undo(); ms = await mods(); check("D3 Ctrl+Z — штанги нет", !ms[1].module.sections[0].rod); }
  // ── E. Вырез на схожие детали ──
  await click(listItem(1));
  ms = await mods(); const stA = ms[1].module;
  const shelfIds = parts(stA).filter((p) => /:shelf:\d+$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]).map((p) => p.id);
  await reveal(btn("Вырезы деталей…")); await click(btn("Вырезы деталей…"));
  await page.locator('select[aria-label="Деталь для выреза"]').selectOption(shelfIds[0]);
  await click(page.getByRole("group", { name: "Добавить вырез" }).getByRole("button", { name: /Круглый/ }));
  const copy = page.locator('[data-testid="cut-copy"]');
  if ((await copy.getAttribute("open")) === null) await click(copy.locator("summary"));
  const sumText = (await copy.locator("summary").innerText()).trim();
  await page.getByRole("checkbox", { name: "Отметить все схожие детали" }).check(); await page.waitForTimeout(200);
  await shot("E1-copy-list");
  await click(copy.getByRole("button", { name: /^Скопировать на отмеченные/ }));
  ms = await mods();
  const withCut = (m: Module) => new Set((m.cutouts ?? []).map((c) => cutHost(m, c)));
  const a1 = withCut(ms[1].module), a2 = withCut(ms[2].module), shelvesB = parts(ms[2].module).filter((p) => /:shelf:\d+$/.test(p.id)).map((p) => p.id);
  check("E1 «Скопировать на отмеченные»: вырез на всех полках этого стеллажа", shelfIds.every((id) => a1.has(id)), `${a1.size}/${shelfIds.length}; ${sumText}`);
  check("E2 и на всех полках второго такого же стеллажа", shelvesB.length > 0 && shelvesB.every((id) => a2.has(id)), `${a2.size}/${shelvesB.length}`);
  check("E3 сообщение «Вырезы скопированы на N деталей»", /Вырезы скопированы на \d+/.test(await noteText()), (await noteText()).slice(0, 140));
  await closeNote();
  await front(true); await shot("E3-copied");
  await undo(); ms = await mods();
  check("E4 одна отмена Ctrl+Z — вырезов нет нигде (правка была одна)", !ms[1].module.cutouts?.length && !ms[2].module.cutouts?.length);
  await page.keyboard.press("Control+y"); await page.waitForTimeout(900);
  // правой кнопкой по полке с вырезом — «Вырез на схожие…»
  await front(true);
  const zz = await canvas(); let found = false;
  for (let y = zz.y + 10; y < zz.y + zz.height - 10 && !found; y += 3) { await page.mouse.click(zz.x + zz.width / 2 + 7, y, { button: "right" }); await page.waitForTimeout(70); if ((await menuOpen()) && /^Полка/.test(await title()) && (await item("Вырез на схожие…").count())) found = true; else await esc(); }
  if (found) await click(item("Вырез на схожие…"));
  const openCopy = (await page.locator('[data-testid="cut-copy"][open]').count()) === 1;
  check("E5 правой кнопкой по полке с вырезом — «Вырез на схожие…»: окно вырезов с открытым переносом", found && openCopy);
  await shot("E5-rmb-copy");
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  check("E6 Esc закрывает окно вырезов (открытое правой кнопкой)", (await page.locator(".cut-editor").count()) === 0);
  await page.getByRole("button", { name: "Закрыть окно вырезов" }).click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(300);

  // ── F. Плавное открывание, средняя кнопка ──
  await click(listItem(0)); await front(true);
  const toggle = page.getByRole("button", { name: /^(Закрыть|Открыть) фасады$/ }).first();
  if (/Закрыть/.test(await toggle.innerText().catch(() => ""))) { await click(toggle); await page.waitForTimeout(800); }
  let st = await openState();
  const doorKeys = Object.keys(st).filter((k) => k.startsWith(ms[0].id + "|") && /:door:\d+$/.test(k));
  check("F0 «Открыть фасады» выключено — створки шкафа закрыты (t=0)", doorKeys.length > 0 && doorKeys.every((k) => st[k].t === 0 && st[k].target === 0), JSON.stringify(doorKeys.map((k) => st[k])));
  const f = await canvas();
  let doorHit = "";
  for (const fx of [0.5, 0.42, 0.58, 0.35, 0.65]) { await page.mouse.click(f.x + f.width * fx, f.y + f.height * 0.5, { button: "middle" }); await page.waitForTimeout(120); st = await openState(); doorHit = doorKeys.find((k) => st[k].target === 1) ?? ""; if (doorHit) break; }
  const mid = st[doorHit]?.t ?? -1;
  check("F1 средняя кнопка (щелчок колёсиком) по створке — она открывается, плавно (в середине пути)", !!doorHit && mid > 0 && mid < 1, `${doorHit.split("|")[1] ?? ""} t=${mid}`);
  await page.waitForTimeout(150); await shot("F1-door-opening");
  await page.waitForTimeout(500); st = await openState();
  check("F2 через ~0,4 с створка открыта полностью; остальные закрыты", !!doorHit && st[doorHit].t === 1 && doorKeys.filter((k) => k !== doorHit).every((k) => st[k].t === 0), JSON.stringify(doorKeys.map((k) => st[k].t)));
  await shot("F2-door-open");
  // протяжка средней кнопкой — поворот камеры, створки не трогает
  const cam0 = await camera();
  await page.mouse.move(f.x + f.width * 0.5, f.y + f.height * 0.4); await page.mouse.down({ button: "middle" });
  for (let i = 1; i <= 8; i++) { await page.mouse.move(f.x + f.width * 0.5 + i * 15, f.y + f.height * 0.4 + i * 4); await page.waitForTimeout(30); }
  await page.mouse.up({ button: "middle" }); await page.waitForTimeout(900);
  const cam1 = await camera(); const st2 = await openState();
  check("F3 протяжка средней кнопкой — поворот камеры, створки как были", cam0 !== cam1 && doorKeys.every((k) => st2[k].target === st[k].target), `камера ${cam0 === cam1 ? "не изменилась" : "повернулась"}`);
  await page.mouse.move(f.x + f.width * 0.5, f.y + f.height * 0.5); await page.mouse.wheel(0, -300); await page.waitForTimeout(900);
  const cam2 = await camera(); const st3 = await openState();
  check("F4 колесо — масштаб, створки как были", cam2 !== cam1 && doorKeys.every((k) => st3[k].target === st[k].target), `камера ${cam2 === cam1 ? "не изменилась" : "изменилась"}`);
  await front(true);
  for (const fx of [0.5, 0.42, 0.58, 0.35, 0.65]) { const before = (await openState())[doorHit]?.target; await page.mouse.click(f.x + f.width * fx, f.y + f.height * 0.5, { button: "middle" }); await page.waitForTimeout(700); if ((await openState())[doorHit]?.target !== before) break; }
  st = await openState();
  check("F5 средняя ещё раз по открытой створке — закрылась", st[doorHit]?.target === 0 && st[doorHit]?.t === 0, JSON.stringify(st[doorHit]));
  await toggle.click(); await page.waitForTimeout(60); st = await openState(); /* без паузы click(): анимация 350 мс */
  const during = doorKeys.map((k) => st[k]?.t ?? -1);
  check("F6 «Открыть фасады» — все створки открываются плавно (в середине пути)", during.every((t) => t > 0 && t < 1), during.join(","));
  await page.waitForTimeout(700); st = await openState();
  check("F7 и доходят до конца", doorKeys.every((k) => st[k].t === 1));
  await click(toggle); await page.waitForTimeout(700);
  // комод: средняя по фасаду ящика — ящик выезжает
  await click(listItem(3)); await front(true);
  const kom = (await mods())[3]; const g = await canvas(); let drawerKey = "";
  for (const fy of [0.5, 0.4, 0.6, 0.3, 0.7]) { await page.mouse.click(g.x + g.width * 0.5, g.y + g.height * fy, { button: "middle" }); await page.waitForTimeout(700); st = await openState(); drawerKey = Object.keys(st).find((k) => k.startsWith(kom.id + "|") && /:drawer:\d+$/.test(k) && st[k].target === 1) ?? ""; if (drawerKey) break; }
  check("F8 комод: средняя по фасаду ящика — ящик выдвинут", !!drawerKey && st[drawerKey].t === 1, drawerKey.split("|")[1] ?? "");
  await page.getByRole("button", { name: "Сверху", exact: true }).click().catch(() => {}); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Изометрия|^3D/ }).first().click().catch(() => {}); await page.waitForTimeout(1000);
  await shot("F8-drawer-open");
  // критик 29.10 (2): двери купе — средняя кнопка сдвигает полотно, состояние держится после перестройки сцены (выбор другого модуля)
  await addFromPalette("Двери купе", 1600, 2400, 100, "Шкафы-купе");
  ms = await mods(); const kupe = ms[ms.length - 1];
  await front(true);
  const kc = await canvas(); let leaf = "";
  for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7]) { await page.mouse.click(kc.x + kc.width * fx, kc.y + kc.height * 0.5, { button: "middle" }); await page.waitForTimeout(700); st = await openState(); leaf = Object.keys(st).find((k) => k.startsWith(kupe.id + "|") && st[k].target === 1 && st[k].t === 1) ?? ""; if (leaf) break; }
  check("F9 двери купе: средняя кнопка — полотна сдвинуты", !!leaf, leaf.split("|")[1] ?? "");
  await click(listItem(0)); await page.waitForTimeout(800); st = await openState();
  check("F10 выбрали другой модуль (сцена перестроена) — полотна купе по-прежнему сдвинуты", !!leaf && st[leaf]?.t === 1, JSON.stringify(st[leaf]));
} catch (e) { check("сценарий без сбоя", false, (e as Error).message.split("\n")[0]); await shot("fail"); }
check("ошибок страницы нет", errors.length === 0, errors.slice(0, 2).join(" | "));
writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 1));
await browser.close();
const failed = results.filter((r) => !r[1]).length;
console.log(`\nИТОГ: ${results.length - failed}/${results.length}`);
