// Просьбы Макса 31.10.2026 мышью, как менеджер (проект для проверки читается из хранилища браузера):
// npx tsx scripts/estimate-wheel-3110-scenario.ts <url ?fresh=1> <outDir>
//  E. «Стоимость» подробно: панель «Стоимость» → «Стоимость проекта» → вкладка «Стоимость»: группы свёрнуты с суммами, «Развернуть всё»,
//     листы по декорам × цена листа, сумма групп (+ округление) = итог; «Свернуть всё».
//  W. Колесо → «Параметры»: правой кнопкой по полке стеллажа → «Параметры» — поля выбранной полки справа видны и подсвечены (~1,3 с),
//     потом подсветка гаснет; «Все настройки…» группы — раздел «Фасады выделенных» подсвечен.
//  G. «Наполнение как у этого»: у шкафа A наполнение «Ящики 3 + полки» (колесо), Shift+щелчок по B и стеллажу C → в «Наполнении»
//     подсказка про отмеченные; кнопка «Наполнение как у этого» → у B наполнение как у A, стеллаж пропущен с причиной; Ctrl+Z — B как был.
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseProject, type Project } from "../src/project";
import { FILL_KEYS } from "../src/groupFilling";
import type { Module } from "../src/model";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => void d.accept());
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let shotN = 0;
const shot = async (name: string, wait = 700) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png` }); };
const click = async (l: Locator, opts: { modifiers?: ("Control" | "Shift")[] } = {}) => { await l.scrollIntoViewIfNeeded(); await l.click(opts); await page.waitForTimeout(400); };
const type = async (l: Locator, v: string | number) => { await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); await page.keyboard.press("Control+A"); await page.keyboard.type(String(v)); await page.keyboard.press("Enter"); await page.waitForTimeout(600); };
async function current(): Promise<Project> {
  await page.waitForTimeout(900);
  const raw = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("garderyob-rooms-v1") && !x.includes(":previous") && !x.includes(":damaged")); return k ? localStorage.getItem(k) : null; });
  if (!raw) throw Error("документ комнат не сохранён");
  const d = JSON.parse(raw);
  const room = d.rooms.find((r: { id: string }) => r.id === d.activeRoomId) ?? d.rooms[0];
  return parseProject({ ...room.project, ...(d.calculation ? { calculation: d.calculation } : {}) }, true);
}
async function addFromPalette(kind: string, w: number, h: number, d: number) {
  const pal = page.locator("details.module-palette").first();
  if ((await pal.getAttribute("open")) === null) await click(pal.locator("summary").first());
  await click(pal.getByRole("tab", { name: "Шкафы распашные" }));
  await click(pal.locator(".module-kinds button", { hasText: kind }).first());
  await type(pal.locator('input[aria-label="Ширина новой мебели"]'), w);
  await type(pal.locator('input[aria-label="Высота новой мебели"]'), h);
  await type(pal.locator('input[aria-label="Глубина новой мебели"]'), d);
  await click(pal.getByRole("button", { name: "Добавить в комнату" }));
  await page.waitForTimeout(1200);
  const apart = page.getByRole("button", { name: /^Поставить отдельно/ });
  if (await apart.count() && await apart.first().isVisible()) { await click(apart.first()); await page.waitForTimeout(800); }
}
const listItem = (i: number) => page.locator(".module-list .module-item").nth(i);
const menuOpen = async () => (await page.locator(".radial-menu").count()) > 0;
const esc = async () => { for (let k = 0; k < 3 && (await menuOpen()); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(80); } };
const title = async () => (await page.locator(".radial-center b").first().innerText({ timeout: 800 }).catch(() => "")).trim();
const radial = (label: string) => page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( ›)?$") }) }).first();
async function front() { await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {}); const z = page.getByRole("button", { name: "Приблизить выбранный корпус" }); if ((await z.getAttribute("aria-pressed").catch(() => "true")) !== "true") await z.click().catch(() => {}); await page.mouse.move(5, 300); await page.waitForTimeout(1200); }
/** Полка тонкая: правой кнопкой сверху вниз по середине холста (стеллаж выбран и приближен спереди), пока меню не откроется на полке. */
async function rightClickShelf(): Promise<boolean> {
  const z = (await page.locator("canvas").first().boundingBox())!;
  for (const dx of [7, -60, 60]) { const col = z.x + z.width / 2 + dx;
    for (let y = z.y + 10; y < z.y + z.height - 10; y += 3) { await page.mouse.click(col, y, { button: "right" }); await page.waitForTimeout(60); if ((await menuOpen()) && /^Полка/.test(await title())) return true; await esc(); } }
  return false;
}
const inView = (l: Locator) => l.evaluate((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.bottom > 0 && r.top < innerHeight; }).catch(() => false);
const lit = (l: Locator) => l.evaluate((el) => el.classList.contains("ui-highlight")).catch(() => false);
const rub = (s: string) => Number(s.replace(/[^\d−-]/g, "").replace("−", "-"));
const fillOf = (m: Module) => JSON.stringify(m.sections.map((s) => Object.fromEntries(FILL_KEYS.filter((k) => s[k] !== undefined && k !== "drawerConfigs").map((k) => [k, s[k]]))));

try {
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2500);
  for (const [k, w, h, d] of [["Для одежды", 1000, 2100, 600], ["Для одежды", 1000, 2100, 600], ["Стеллаж", 800, 2000, 400]] as const) await addFromPalette(k, w, h, d);
  let p = await current();
  console.log("модули:", p.modules.map((a) => `${a.module.name} ${a.module.width}`).join(" | "));
  const n0 = p.modules.length, [A, B, C] = p.modules.slice(n0 - 3);
  const idx = (id: string) => p.modules.findIndex((a) => a.id === id);
  await shot("00-start");

  // ── E. Стоимость подробно ──
  // у шкафа A петли Blum (колесо «Фасады › Петли › Blum») — в «Фурнитуре» появится строка с ценой сверх листов
  await listItem(idx(A.id)).click({ button: "right" }); await page.waitForTimeout(500);
  await click(radial("Фасады")); await click(radial("Петли")); await click(page.locator(".radial-item").filter({ hasText: /Blum/i }).first());
  await click(page.getByRole("button", { name: "Открыть стоимость" }).first());
  await click(page.getByRole("button", { name: "Стоимость проекта", exact: true }).first());
  const bd = page.getByTestId("estimate-breakdown");
  await bd.waitFor({ state: "visible", timeout: 15000 });
  const groups = bd.locator("details.eb-group[data-group]");
  const gCount = await groups.count(), openBefore = await bd.locator("details.eb-group[data-group][open]").count();
  check("E1 вкладка «Стоимость»: группы с суммами, свёрнуты", gCount >= 2 && openBefore === 0, `групп ${gCount}, открыто ${openBefore}`);
  await shot("E1-estimate-collapsed");
  await click(bd.getByRole("button", { name: "Развернуть всё" }));
  const openAfter = await bd.locator("details.eb-group[data-group][open]").count();
  check("E2 «Развернуть всё» — все группы раскрыты", openAfter === gCount, `${openAfter}/${gCount}`);
  const sheetRows = await bd.locator('details[data-group="sheets"] tr.eb-row.priced').allInnerTexts();
  check("E3 листы ЛДСП по декорам × цена листа", sheetRows.length >= 1 && sheetRows.every((t) => /Лист ЛДСП .* × 23 000 ₽/.test(t.replace(/\s+/g, " "))), sheetRows.map((t) => t.replace(/\s+/g, " ")).join(" | "));
  const sums = (await bd.locator("details.eb-group[data-group] > summary .eb-sum").allInnerTexts()).map(rub);
  const rounding = rub((await bd.locator(".eb-line:not(.eb-total) b").allInnerTexts().catch(() => [] as string[]))[0] ?? "0") || 0;
  const total = rub(await page.locator(".sales-total").innerText());
  check("E4 сумма групп + округление = итог", sums.reduce((s, v) => s + v, 0) + rounding === total, `${sums.join(" + ")} ${rounding ? "+ " + rounding : ""} = ${total}`);
  const hw = await bd.locator('details[data-group="hardware"] tr.eb-sub').allInnerTexts();
  check("E5 фурнитура по видам (петли, направляющие, ручки, опоры…)", hw.length >= 2, hw.join(" | "));
  const blum = (await bd.locator('details[data-group="hardware"] tr.eb-row.priced').allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
  check("E5b петли Blum — строка с ценой клиенту в «Фурнитуре»", blum.some((t) => /Blum/i.test(t) && /× 800 ₽/.test(t)), blum.join(" | "));
  const badge = await bd.locator(".eb-badge").first().innerText().catch(() => "");
  check("E6 позиции внутри листа помечены «в цене листов»", /в цене листов/.test(badge), badge);
  await bd.locator('details[data-group="hardware"]').scrollIntoViewIfNeeded();
  await shot("E2-estimate-expanded");
  await click(bd.getByRole("button", { name: "Свернуть всё" }));
  check("E7 «Свернуть всё»", (await bd.locator("details.eb-group[data-group][open]").count()) === 0);
  await page.keyboard.press("Escape"); await page.waitForTimeout(600);
  if (await bd.isVisible().catch(() => false)) { await page.getByRole("button", { name: /^Закрыть/ }).first().click().catch(() => {}); await page.waitForTimeout(600); }

  // ── W. Колесо → «Параметры» подсвечивает поля ──
  await click(listItem(idx(C.id)));
  await front();
  const found = await rightClickShelf();
  check("W1 правой кнопкой по полке стеллажа — меню «Полка …»", found, await title());
  if (found) {
    await shot("W1-wheel-shelf", 200);
    await radial("Параметры").click(); await page.waitForTimeout(700);
    const sel = page.locator('.properties [data-part-params="shelf"], .properties details[data-setting="Полки"]').first(); /* Макс 01.11: «Параметры» ведут к своему блоку детали */
    const on = await lit(sel), seen = await inView(sel);
    await shot("W2-params-highlighted", 50);
    check("W2 «Параметры» — поля выбранной полки справа видны и подсвечены", on && seen, `подсветка ${on}, видно ${seen}`);
    await page.waitForTimeout(1600);
    check("W3 подсветка гаснет через ~1,3 с", !(await lit(sel)));
  }

  // ── G. «Наполнение как у этого» ──
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  const z = page.getByRole("button", { name: "Приблизить выбранный корпус" }); if ((await z.getAttribute("aria-pressed").catch(() => "false")) === "true") await z.click().catch(() => {});
  await listItem(idx(A.id)).click({ button: "right" }); await page.waitForTimeout(500);
  await click(radial("Наполнение")); await click(radial("Ящики 3 + полки"));
  p = await current();
  const a1 = p.modules.find((x) => x.id === A.id)!.module, b0 = p.modules.find((x) => x.id === B.id)!.module, c0 = p.modules.find((x) => x.id === C.id)!.module;
  check("G0 у шкафа A наполнение «Ящики 3 + полки» (колесо)", a1.sections[0].drawers === 3, `ящиков ${a1.sections[0].drawers}`);
  await click(listItem(idx(A.id)));
  await click(listItem(idx(B.id)), { modifiers: ["Shift"] });
  await click(listItem(idx(A.id)), { modifiers: ["Shift"] });
  await click(listItem(idx(C.id)), { modifiers: ["Shift"] });
  // выбранный (образец) — A: щелчок без Shift снял бы отметки, поэтому образец выбираем до отметок и проверяем по подписи блока
  const blk = page.getByTestId("group-filling");
  await blk.waitFor({ state: "visible" });
  const blkText = (await blk.innerText()).replace(/\s+/g, " ");
  check("G1 раздел «Наполнение выделенных модулей · 3» с кнопкой", /Наполнение выделенных модулей · 3/.test(blkText) && await blk.getByRole("button", { name: "Наполнение как у этого" }).isEnabled(), blkText.slice(0, 160));
  const hint = page.getByTestId("group-fill-hint").filter({ visible: true }).first();
  // как менеджер: «Построение мебели» → раздел «Наполнение» → «Полки»
  if (!(await page.locator('details[data-settings-category="Наполнение"]').count())) { await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {}); await page.waitForTimeout(600); }
  for (const sel of ['details[data-settings-category="Наполнение"]', 'details[data-setting="Полки"]']) { const d = page.locator(".properties " + sel).first(); if ((await d.count()) && (await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
  const hintText = (await hint.innerText().catch(() => "")).replace(/\s+/g, " ");
  check("G2 в «Наполнении» подсказка: правится у выбранного, к отмеченным — кнопка", /Наполнение правится у выбранного/.test(hintText) && /Наполнение как у этого/.test(hintText), hintText);
  await hint.scrollIntoViewIfNeeded().catch(() => {}); await shot("G2-fill-hint");
  // ссылка в подсказке — к кнопке (подсветка блока)
  await click(hint.getByRole("button", { name: /Наполнение как у этого/ }));
  check("G2b ссылка подсказки — раздел с кнопкой подсвечен", await lit(blk), "");
  await page.waitForTimeout(1500); // плавная прокрутка и свечение закончились
  const before = await current();
  // в headless swiftshader перерисовка группы (3D + «Фасады выделенных») идёт секунды — клик с запасом по времени
  const t0 = Date.now(); await blk.getByRole("button", { name: "Наполнение как у этого" }).click({ timeout: 90000 }); console.log("клик, мс:", Date.now() - t0);
  p = await current();
  const a2 = p.modules.find((x) => x.id === A.id)!.module, b2 = p.modules.find((x) => x.id === B.id)!.module, c2 = p.modules.find((x) => x.id === C.id)!.module;
  const note = (await page.getByTestId("group-filling-note").innerText().catch(() => "")).replace(/\s+/g, " ");
  check("G3 у B наполнение как у A, двери и декор свои", fillOf(b2) === fillOf(a2) && b2.facadeDecor === b0.facadeDecor && b2.doors === b0.doors, `B ящиков ${b2.sections[0].drawers}, полок ${b2.sections[0].shelves.length}`);
  check("G4 стеллаж C пропущен с причиной, не изменён", /К 1 модулю не применено: секция 1 уже/.test(note) && JSON.stringify(c2) === JSON.stringify(c0), note);
  check("G5 образец A не изменён", JSON.stringify(a2) === JSON.stringify(before.modules.find((x) => x.id === A.id)!.module));
  await blk.scrollIntoViewIfNeeded(); await shot("G3-applied");
  await page.locator('[data-testid="studio-note"] button[aria-label="Закрыть сообщение"]').click({ timeout: 1000 }).catch(() => {});
  await page.getByRole("button", { name: "Скрыть фасады", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {}); await page.mouse.move(5, 300); await shot("G3-applied-scene", 1200);
  await page.getByRole("button", { name: /Показать фасады|Скрыть фасады/ }).first().click().catch(() => {});
  await page.keyboard.press("Control+z"); p = await current();
  const b3 = p.modules.find((x) => x.id === B.id)!.module;
  check("G6 Ctrl+Z — B снова со своим наполнением одним шагом", fillOf(b3) === fillOf(b0) && fillOf(b3) !== fillOf(a2));
  await shot("G6-undo", 1000);
} catch (e) {
  check("сценарий прошёл без исключений", false, String((e as Error).stack ?? e).slice(0, 2500));
  await page.screenshot({ path: `${out}/zz-error.png` }).catch(() => {});
} finally {
  check("ошибок страницы нет", errors.length === 0, errors.slice(0, 3).join(" | "));
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 1));
  const failed = results.filter((r) => !r[1]).length;
  console.log(`\nИтого: ${results.length - failed}/${results.length} OK`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
