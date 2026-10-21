// Нижний угловой мышью (запрос Макса 21.10.2026): npx tsx scripts/kcorner-scenario.ts <url> <outDir>
// Вкладка «Кухня» (ряд 600 по «Заменить кухню») → палитра «Нижний угловой», глухая часть слева, 1000 → в комнату → ПКМ «Угловой › Глухая часть справа»
// → снимки 3D и «Спереди» → «Скрыть фасады».
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(700);
};
const shot = async (n: string) => { await settle(); await page.screenshot({ path: `${out}/kcorner-${n}.png` }); };
const item = (re: RegExp) => page.locator(".radial-item").filter({ hasText: re }).first();
const ring = async () => (await page.locator(".radial-item").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
/** Угловой модуль в сохранённой кухне (localStorage вкладки «Кухня»). */
const corner = () => page.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!; if (!k.includes("kitchen-workspace")) continue;
    try { const p = JSON.parse(localStorage.getItem(k)!); const a = (p.modules ?? []).find((x: { module: { kitchen?: { faceFiller?: unknown } } }) => x.module?.kitchen?.faceFiller); if (a) return { side: a.module.kitchen.faceFiller.side, width: a.module.kitchen.faceFiller.width, w: a.module.width, hinge: a.module.sections[0].hingeSide }; } catch { /* нет */ }
  }
  return null;
});
try {
  const empty = { version: 3, kind: "kitchen", room: { width: 3600, depth: 3000, height: 2700, openings: [] }, modules: [] };
  await page.goto(url + "?order=kitchen");
  await page.evaluate((raw) => { localStorage.clear(); void raw; localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "0"); }, JSON.stringify(empty));
  await page.goto(url + "?order=kitchen"); await page.waitForSelector("canvas"); await settle();
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await shot("00-start"); console.log("палитра кухни:", await page.locator(".kitchen-palette").count(), "этап:", await page.evaluate(() => localStorage.getItem("studio-stage")));
  await page.getByRole("tab", { name: /Кухонные модули/ }).first().click(); await page.waitForTimeout(300);
  await page.locator("summary", { hasText: "Готовые кухонные модули" }).first().click(); await page.waitForTimeout(300);
  // ряд покороче (600), чтобы угловому 1000 хватило места у стены 3600
  await page.getByLabel("Длина стены кухни").fill("600"); await page.getByRole("button", { name: "Заменить кухню" }).click(); await settle();
  const sideSel = page.getByLabel("Глухая часть углового");
  check("палитра: карточка «Нижний угловой» с выбором варианта и стороны", (await page.getByText("Нижний угловой", { exact: true }).count()) > 0 && (await sideSel.count()) > 0 && (await page.getByLabel("Вариант углового").count()) > 0);
  await sideSel.scrollIntoViewIfNeeded(); await sideSel.selectOption("left");
  await page.getByRole("button", { name: "Нижний угловой 1000", exact: true }).click(); await settle();
  const c0 = await corner();
  check("в комнату: модуль 1000, глухая часть слева, петли у кромки двери со стороны фальша", !!c0 && c0.side === "left" && c0.w === 1000 && c0.hinge === "left", JSON.stringify(c0));
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {}); await settle();
  await shot("01-added-left");
  const cv = (await page.locator("canvas").first().boundingBox())!;
  await page.mouse.click(cv.x + cv.width * 0.5, cv.y + cv.height * 0.5, { button: "right" }); await page.waitForTimeout(400);
  if (!(await item(/^Угловой/).count()) && (await item(/^Корпус/).count())) { await item(/^Корпус/).click(); await page.waitForTimeout(300); }
  const r0 = await ring();
  check("ПКМ по модулю: пункт «Угловой»", r0.some((t) => /^Угловой/.test(t)), r0.join(" | "));
  if (await item(/^Угловой/).count()) { await item(/^Угловой/).click(); await page.waitForTimeout(300); }
  const r1 = await ring();
  check("«Угловой ›»: глухая часть слева/справа, ширина двери…, ширина фальша…", ["Глухая часть слева", "Глухая часть справа", "Ширина двери", "Ширина фальша"].every((s) => r1.some((t) => t.includes(s))), r1.join(" | "));
  await shot("02-menu");
  if (await item(/Глухая часть справа/).count()) { await item(/Глухая часть справа/).click(); await settle(); }
  const c1 = await corner();
  check("«Глухая часть справа»: фальш справа, петли справа (у кромки двери), ширина фальша та же", !!c1 && c1.side === "right" && c1.hinge === "right" && c1.width === c0?.width, JSON.stringify(c1));
  await page.keyboard.press("Escape").catch(() => {});
  await shot("03-right-3d");
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await shot("04-right-front");
  const hide = page.getByRole("button", { name: /Скрыть фасады/ });
  check("кнопка «Скрыть фасады» есть", (await hide.count()) > 0);
  if (await hide.count()) { await hide.first().click(); await settle(); }
  await shot("05-no-facades-front");
  await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {});
  await shot("06-no-facades-3d");
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
  const bad = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
  if (bad.length) process.exitCode = 1;
} finally { await browser.close(); }
