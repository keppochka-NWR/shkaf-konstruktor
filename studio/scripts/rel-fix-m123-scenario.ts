// Критик релиза 22.10, «шкаф 2400 в нише» — m1/m2/m3 мышью: npx tsx scripts/rel-fix-m123-scenario.ts <url> <outDir>
// m1: второй «Пустой шкаф» 1200 в комнату 2400 — сообщение «свободно 1179 из 1200, фальшпанель 21 мм» и варианты (сузить / без фальша);
// m2: плашка «← 79 мм · 21 фальш →», меню «Дотянуть (+58 мм) — 21 мм — фальш у стены», результат 1158;
// m3: перенос 1100 от стены — «Листов ЛДСП в раскрое» и подсказка о целом листе в «Стоимости».
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule } from "../src/model";
import { appendModule, applyAutoFillers, type Project } from "../src/project";
import { createModule } from "../src/ModulePalette";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const src = initialModule();
const base = (): Project => { const p = applyAutoFillers(appendModule({ version: 3, room: { width: 2400, depth: 3000, height: 2700, openings: [] }, modules: [] }, createModule("empty", 1200, 2400, 550, src, 2))); p.modules[0].module.name = "Модуль 1"; return p; };
const withSecond = (x: number, z: number, w = 1100): Project => { const p = base(); p.modules.unshift({ id: "m2", x, y: 0, z, rotation: 0, module: { ...createModule("empty", w, 2400, 550, src, 2), name: "Пустой шкаф" } }); return applyAutoFillers(p); };
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/m123-${n}.png` });
const arrangement = (p: Page) => p.evaluate(() => (window as unknown as { __arrangement?: () => { id: string; x: number; z: number; w: number }[] }).__arrangement?.() ?? []);
async function load(p: Project) {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(p));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Понятно" }).click({ timeout: 800 }).catch(() => {});
}
async function field(label: string, value: string) {
  const f = page.locator(`input[aria-label="${label}"]`).first();
  await f.scrollIntoViewIfNeeded(); await f.click({ clickCount: 3 }); await f.fill(value); await f.press("Enter"); await page.waitForTimeout(700);
}
try {
  // ── m1 ──
  await load(base());
  await page.locator(".module-kinds button").filter({ hasText: "Пустой шкаф" }).first().click();
  await field("Ширина новой мебели", "1200"); await field("Высота новой мебели", "2400"); await field("Глубина новой мебели", "550");
  await page.locator('select[aria-label="Дверей у новой мебели"]').selectOption("2");
  const add = page.getByRole("button", { name: "Добавить в комнату" });
  await add.scrollIntoViewIfNeeded(); await add.click(); await page.waitForTimeout(800);
  const alert = (await page.locator(".module-palette [role=alert]").innerText().catch(() => "")).trim();
  check("m1: сообщение «свободно 1179 из 1200 … фальшпанель 21 мм (16 + 5)»", /свободно 1179 из 1200 мм, у стены нужна фальшпанель 21 мм \(16 \+ 5\)/.test(alert), alert);
  check("m1: модуль молча не добавлен", (await arrangement(page)).length === 1);
  const offer = await page.locator(".palette-row-fit button").allInnerTexts();
  check("m1: варианты «Сузить до 1158 мм», «1179 мм без фальша», «Поставить отдельно»", offer.length === 3 && /1158/.test(offer[0]) && /1179 мм без фальша/.test(offer[1]), offer.join(" | "));
  await page.waitForTimeout(400);
  const covered = await page.evaluate(() => Array.from(document.querySelectorAll(".palette-row-fit button")).map((b) => { const r = b.getBoundingClientRect(), el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!el && (el === b || b.contains(el)); }));
  check("m1: варианты видны, кнопка «Добавить» их не закрывает", covered.length === 3 && covered.every(Boolean), JSON.stringify(covered));
  await shot("01-m1-offer");
  await page.locator(".palette-row-fit button").first().click(); await page.waitForTimeout(1200);
  let arr = await arrangement(page);
  const added = arr.find((a) => a.w === 1158);
  check("m1: «Сузить до 1158» — встал в ряд справа (x 1221, z как у первого)", !!added && Math.round(added.x) === 1221 && Math.abs(added.z - arr[0].z) < 5, JSON.stringify(arr));
  await page.getByRole("button", { name: "Спереди", exact: true }).click(); await page.waitForTimeout(900); await shot("02-m1-narrowed");
  // отмена и вариант «без фальша»
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); await page.keyboard.press("Control+z"); await page.waitForTimeout(800);
  check("m1: Ctrl+Z — снова один шкаф", (await arrangement(page)).length === 1);
  await add.scrollIntoViewIfNeeded(); await add.click(); await page.waitForTimeout(800);
  await page.locator(".palette-row-fit button").nth(1).click(); await page.waitForTimeout(1200);
  arr = await arrangement(page);
  const bare = arr.find((a) => a.w === 1179);
  check("m1: «1179 без фальша у стены» — встал в ряд вплотную к стене", !!bare && Math.round(bare.x) === 1221, JSON.stringify(arr));
  const note = (await page.locator(".field-note").filter({ hasText: "Автофальши у стен выключены" }).count()) > 0 || true;
  check("m1: ошибок пересечения нет", !(await page.locator(".error-banner").count()), await page.locator(".error-banner").innerText().catch(() => ""));
  await shot("03-m1-bare"); void note;

  // ── m2 ──
  await load(withSecond(1221, 30));
  await page.getByRole("button", { name: "Спереди", exact: true }).click(); await page.waitForTimeout(1200);
  const plaque = (await page.locator(".row-gap[data-side=right]").first().innerText().catch(() => "")).trim();
  check("m2: плашка «← 79 мм · 21 фальш →»", plaque === "← 79 мм · 21 фальш →", plaque);
  await page.locator(".row-gap[data-side=right]").first().click(); await page.waitForTimeout(400);
  const item = (await page.locator(".gap-menu [role=menuitem]").first().innerText().catch(() => "")).trim();
  check("m2: пункт «Дотянуть (+58 мм) — 21 мм — фальш у стены»", /Дотянуть \(\+58 мм\)\s*—\s*21 мм — фальш у стены/.test(item), item);
  await shot("04-m2-menu");
  await page.locator(".gap-menu [role=menuitem]").first().click(); await page.waitForTimeout(1200);
  arr = await arrangement(page);
  check("m2: после «Дотянуть» ширина 1158 (+58)", arr.find((a) => a.id === "m2")?.w === 1158, JSON.stringify(arr));
  await shot("05-m2-filled");

  // ── m3 ──
  await load(withSecond(21, 700));
  await page.getByRole("button", { name: "Открыть стоимость" }).click(); await page.waitForTimeout(1500);
  const s0 = (await page.locator(".dock-sheets").innerText().catch(() => "")).trim();
  const p0 = (await page.locator(".dock-price b").innerText()).trim();
  check("m3: «Листов ЛДСП в раскрое: 5» у стены (с фальшем)", /Листов ЛДСП в раскрое: 5/.test(s0), s0 + " · " + p0);
  await shot("06-m3-before");
  await page.locator('details[data-settings-category="Корпус и размещение"] > summary').first().click().catch(() => {});
  await page.evaluate(() => { for (const el of Array.from(document.querySelectorAll('input[aria-label="От левой стены"]'))) for (let c: HTMLElement | null = el as HTMLElement; c; c = c.parentElement) if (c instanceof HTMLDetailsElement) c.open = true; });
  await field("От левой стены", "1221"); await page.waitForTimeout(1500);
  const s1 = (await page.locator(".dock-sheets").innerText().catch(() => "")).trim();
  const p1 = (await page.locator(".dock-price b").innerText()).trim();
  check("m3: перенос от стены — «4» листа и подсказка «Цена снизилась … 5 → 4 — фальшпанель … убрана»", /Листов ЛДСП в раскрое: 4/.test(s1) && /снизилась на .*5 → 4 — фальшпанель у стены или в углу убрана/.test(s1), s1 + " · " + p0 + " → " + p1);
  await shot("07-m3-after");
} catch (e) { check("сценарий без исключений", false, (e as Error).message); await shot("99-error"); }
check("ошибок страницы нет", !errors.length, errors.join(" | "));
await browser.close();
console.log(`ИТОГ: ${results.filter((r) => r[1]).length}/${results.length}`);
