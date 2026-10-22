// Критик релиза 22.10, повтор (ветка claude/rel-fix2): npx tsx scripts/relfix2-scenario.ts <url> <outDir>
// (m2) «Дотянуть» с фальшем у стены: шкаф 1158 в нише 2440, справа 61 мм — «+40, 21 мм — фальш» дотягивается до 1198 без отказа;
// (m4) «+» у «Ящики» на пятом ящике неактивен — с подсказкой (title) и подписью с причиной, как в ПКМ «Добавить»;
// (h)  окно «Фурнитура» закрывается по Esc.
// Только мышь и клавиатура; проект подкладывается в localStorage до открытия (как в stretch-scenario.ts).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, MAX_DRAWERS_REASON } from "../src/model";
import { appendModule, applyAutoFillers, type Project } from "../src/project";
import { createModule, createKupeModule } from "../src/ModulePalette";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const src = initialModule();
/** Ниша 2440: первый 1200 у левой стены (фальш 21), второй 1158 вплотную, справа 61 мм до стены. Второй — первым в списке (выбран). */
function niche(): Project {
  const p = applyAutoFillers(appendModule({ version: 3, room: { width: 2440, depth: 3000, height: 2700, openings: [] }, modules: [] }, createModule("empty", 1200, 2400, 550, src, 2)));
  const q = applyAutoFillers({ ...p, modules: [...p.modules, { id: "m2", x: 1221, y: 0, z: 30, module: createModule("empty", 1158, 2400, 550, src, 2) }] });
  return { ...q, modules: [q.modules[1], q.modules[0]] };
}
/** Шкаф 1200 с пятью ящиками в первой секции. */
function drawers(): Project {
  const m = initialModule();
  m.sections[0] = { ...m.sections[0], drawers: 5 };
  return { version: 3, room: { width: 3600, depth: 3000, height: 2700, openings: [] }, modules: [{ id: "a", x: 500, y: 0, z: 3, rotation: 0, module: m }] };
}
/** (купе) Двери купе 1500×2600, 2 двери, Стандарт, зеркало серебро — случай сверки критика (Q05: 33 547 без доводчиков). */
function kupe(): Project {
  const m = createKupeModule(1500, 2600, initialModule());
  return { version: 3, room: { width: 3600, depth: 3000, height: 2700, openings: [] }, modules: [{ id: "k", x: 500, y: 0, z: 3, rotation: 0, module: m }] };
}

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/${n}.png` });
async function load(p: Project) {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(p));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
}
const width = async (id: string) => page.evaluate((mid) => (window as unknown as { __arrangement?: () => { id: string; w: number }[] }).__arrangement?.().find((a) => a.id === mid)?.w, id);
const alertText = async () => (await page.locator('[role="alert"]').allInnerTexts().catch(() => [] as string[])).join(" | ").replace(/\s+/g, " ").trim();

try {
  // (m2) «Дотянуть» до стены с фальшем
  await load(niche());
  await page.getByRole("button", { name: "Двигать корпуса", exact: true }).click();
  await page.waitForTimeout(500);
  check("(m2) старт: второй шкаф 1158, справа плашка зазора", (await width("m2")) === 1158 && (await page.locator(".row-gap[data-side=right]").count()) > 0, `ширина ${await width("m2")}`);
  await page.locator(".row-gap[data-side=right]").first().click();
  await page.waitForTimeout(300);
  const menu = (await page.locator(".gap-menu").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  check("(m2) меню зазора: «Дотянуть (+40 мм) — 21 мм — фальш у стены»", /Дотянуть \(\+40 мм\).*21 мм — фальш у стены/.test(menu), menu);
  await shot("m2-01-gap-menu");
  await page.getByRole("menuitem", { name: /Дотянуть/ }).click();
  await page.waitForTimeout(800);
  const w = await width("m2"), err = await alertText();
  check("(m2) «Дотянуть»: ширина 1198, без отказа «фасад шире 600»", w === 1198 && !/шире 600|при ширине 1219/.test(err), `ширина ${w}; сообщения: «${err}»`);
  check("(m2) плашки зазора справа больше нет", (await page.locator(".row-gap[data-side=right]").count()) === 0);
  await shot("m2-02-after-fill");

  // (m4) «+» у «Ящики» на пятом ящике
  await load(drawers());
  await page.getByRole("button", { name: "Наполнение", exact: true }).first().click();
  await page.waitForTimeout(600);
  const plus = page.getByRole("button", { name: "Добавить: Ящики", exact: true });
  // раскрыть категорию и раздел «Ящики» кликами по заголовкам (как менеджер)
  if (!(await plus.isVisible().catch(() => false))) {
    const cat = page.locator('details[data-settings-category="Наполнение"] > summary').first();
    if (await cat.count()) await cat.click();
    await page.waitForTimeout(300);
    const sec = page.locator("summary", { hasText: /^\s*Ящики\s*$/ }).first();
    if ((await sec.count()) && !(await plus.isVisible().catch(() => false))) await sec.click();
    await page.waitForTimeout(300);
  }
  await plus.scrollIntoViewIfNeeded();
  const disabled = await plus.isDisabled(), title = await plus.getAttribute("title");
  await plus.hover({ force: true });
  await page.waitForTimeout(400);
  const note = (await page.getByTestId("counter-max").first().innerText().catch(() => "")).trim();
  check("(m4) «+» неактивен на 5 ящиках", disabled);
  check("(m4) подсказка у «+» — причина, как в ПКМ «Добавить»", title === MAX_DRAWERS_REASON, title ?? "нет title");
  check("(m4) подпись под счётчиком с причиной", note === MAX_DRAWERS_REASON, note);
  await page.getByTestId("counter-max").first().scrollIntoViewIfNeeded().catch(() => {});
  await shot("m4-01-drawers-max");

  // (h) окно «Фурнитура» — Esc закрывает
  await page.getByRole("button", { name: "Фурнитура", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Выбрать фурнитуру…" }).click();
  await page.waitForTimeout(600);
  const dlg = page.getByRole("dialog", { name: "Фурнитура" });
  check("(h) окно «Фурнитура» открыто", await dlg.isVisible());
  await shot("h-01-hardware-open");
  // фокус на карточке варианта (как после клика мышью по окну) — Esc
  await page.getByRole("button", { name: "Открывание", exact: true }).click();
  await page.waitForTimeout(300);
  // в наполнении выбран модуль — Esc у App снимает выделение; раньше из-за этого окно не закрывалось с первого раза
  const nothing = () => page.getByText("Ничего не выбрано", { exact: true }).first().isVisible().catch(() => false);
  const selBefore = await nothing();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("(h) Esc закрывает окно (фокус в окне, модуль выбран)", !(await dlg.isVisible().catch(() => false)));
  const selAfter = await nothing();
  check("(h) Esc закрыл только окно — выделение модуля осталось", !selBefore && !selAfter, `«Ничего не выбрано»: до ${selBefore}, после ${selAfter}`);
  await shot("h-02-after-esc");
  // второй раз: фокус в списке «Применить» (select)
  await page.getByRole("button", { name: "Выбрать фурнитуру…" }).click();
  await page.waitForTimeout(500);
  await page.getByLabel("Применить фурнитуру к").focus();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("(h) Esc закрывает окно (фокус в «Применить»)", !(await dlg.isVisible().catch(() => false)));

  // (купе) цена у флажка «Доводчики» и итог «под ключ» с доводчиками
  await load(kupe());
  const total = async () => (await page.locator(".kupe-total b").first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const t0 = await total();
  check("(купе) без доводчиков — 33 547 ₽ (как Q05)", /33 547/.test(t0), t0);
  await page.locator("summary", { hasText: "Комплектация и открывание" }).first().click();
  await page.waitForTimeout(300);
  const hint = (await page.getByTestId("kupe-soft-price").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  check("(купе) у «Доводчики» видна цена за дверь", /\+5 600 ₽ за дверь/.test(hint) && (await page.getByTestId("kupe-soft-price").isVisible()), hint);
  await shot("k-01-soft-hint");
  await page.getByLabel("Доводчики купе").click();
  await page.waitForTimeout(500);
  const t1 = await total();
  check("(купе) с доводчиками — 44 747 ₽ (33 547 + 2 × 5 600)", /44 747/.test(t1), t1);
  await shot("k-02-soft-on");
} catch (e) {
  check("сценарий без исключений", false, (e as Error).message);
  await shot("zz-error").catch(() => {});
} finally {
  check("без ошибок страницы", !errors.length, errors.join(" | "));
  await browser.close();
  const bad = results.filter((r) => !r[1]);
  console.log(`\nИТОГ: ${results.length - bad.length}/${results.length}`);
  process.exitCode = bad.length ? 1 : 0;
}
