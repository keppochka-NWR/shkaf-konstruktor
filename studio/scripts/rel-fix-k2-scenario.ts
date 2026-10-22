// Релиз 22.10, раунд 2 критика: K2 (модуль/объект замера при нехватке места у стены), K9 (плашка «Свойства выбранного объекта»),
// K10 (404 в консоли). npx tsx scripts/rel-fix-k2-scenario.ts <url /studio/> <outDir>
// Комната 2400 × 3000, три нижних по 600 у задней стены (ряд занят: справа 579 < 600 + фальш). Мышью: «Кухонные» → «Пенал:
// духовка + СВЧ 600» → предупреждение «Нет места у стены»; этап «Помещение» → «Стиральная машина» → не внутри нижних, плашки нет.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initialModule } from "../src/model";
import { newProject, applyAutoFillers, bounds, overlap, type Project } from "../src/project";
import { kitchenTemplate, placeKitchenModule } from "../src/kitchenProject";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
function project(): Project {
  let p: Project = { ...newProject(), room: { ...newProject().room, width: 2400, depth: 3000, height: 2700 }, modules: [] };
  for (let i = 0; i < 3; i++) p = applyAutoFillers(placeKitchenModule(p, kitchenTemplate("base-doors", 600, initialModule())).project);
  return p;
}
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [], bad: string[] = [], consoleErr: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url()); });
page.on("console", (m) => { if (m.type() === "error") consoleErr.push(m.text()); });
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(600);
};
const shot = async (n: string) => { await settle(); await page.screenshot({ path: join(out, `k2-${n}.png`) }); };
const stored = async (ok: (p: Project) => boolean = () => true) => { let p: Project | null = null; for (let i = 0; i < 30; i++) { const all = await page.evaluate(() => Object.keys(localStorage).map((k) => { try { const x = JSON.parse(localStorage.getItem(k) || "null"); return x && Array.isArray(x.modules) ? x : x && x.project && Array.isArray(x.project.modules) ? x.project : null; } catch { return null; } }).filter(Boolean) as Project[]); p = all.find(ok) ?? all[0] ?? null; if (p && ok(p)) break; await page.waitForTimeout(200); } return p!; };
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(project()));
  await page.goto(url); await page.waitForSelector("canvas"); await settle();
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.locator(".view-tabs button", { hasText: "Сверху" }).first().click(); await settle();
  // K2: пенал при занятом ряде
  await page.locator("button:visible", { hasText: "Кухонные" }).first().click({ timeout: 4000 }).catch(() => {}); await settle();
  const presets = page.locator("summary:visible", { hasText: "Готовые кухонные модули" }).first();
  if ((await presets.count()) && !(await page.getByRole("button", { name: /духовка.*600/i }).first().isVisible().catch(() => false))) { await presets.click(); await settle(); }
  const pen = page.getByRole("button", { name: /духовка.*600/i }).first();
  await pen.scrollIntoViewIfNeeded(); await shot("01-before-penal");
  await pen.click(); await settle();
  await shot("02-penal-added");
  const note = page.getByTestId("place-note");
  const noteText = (await note.count()) ? await note.innerText() : "";
  check("K2: пенал при занятом ряде — предупреждение «Нет места у стены…»", /Нет места у стены/.test(noteText) && /передвиньте/.test(noteText), noteText.replace(/\s+/g, " ").slice(0, 160));
  const listed = await page.getByText(/Пенал: духовка/).count();
  check("K2: пенал добавлен (проверка проекта не нашла пересечений — иначе изменение не применилось бы)", listed > 0, "в списке: " + listed);
  // K2/K9: стиральная машина на этапе «Помещение»
  await page.getByRole("button", { name: /Помещение/ }).first().click(); await settle();
  const washerBtn = page.getByRole("button", { name: "Стиральная машина", exact: true }).first();
  await washerBtn.scrollIntoViewIfNeeded(); await washerBtn.click(); await settle();
  await shot("03-washer-added");
  const val = async (l: string) => Number(await page.getByLabel(l, { exact: true }).last().inputValue().catch(() => "NaN"));
  const n = await page.locator(".opening-card").count();
  const w = { x: await val("Слева объекта " + n), z: await val("Сзади объекта " + n), width: await val("Ширина объекта " + n), depth: await val("Глубина объекта " + n), y: 0, height: await val("Высота объекта " + n) };
  const seed = project(), box = { x: w.x, y: 0, z: w.z, w: w.width, d: w.depth, h: w.height };
  const inside = seed.modules.filter((a) => overlap(box, bounds(a))).map((a) => a.module.name);
  check("K2: стиральная машина не внутри мебели", Number.isFinite(w.x) && !inside.length, `x=${w.x} z=${w.z}${inside.length ? " внутри: " + inside.join(", ") : ""}`);
  check("K2: стиральная машина у стены", w.z === 0 || w.x === 0 || w.x + w.width === seed.room.width || w.z + w.depth === seed.room.depth, `x=${w.x} z=${w.z}`);
  const trigger = page.locator(".environment-properties-trigger");
  check("K9: на этапе «Помещение» плашки «Свойства выбранного объекта» нет (свойства — в правой панели)", (await trigger.count()) === 0 || !(await trigger.isVisible()));
  // K9: на этапе мебели плашка (если есть) не перекрывает правую панель
  await page.getByRole("button", { name: /Построение мебели/ }).first().click(); await settle();
  await shot("04-bodies-after-washer");
  if ((await trigger.count()) && (await trigger.isVisible())) {
    const tb = (await trigger.boundingBox())!, panel = await page.locator(".properties").first().boundingBox();
    check("K9: плашка над сценой, не поверх правой панели", !panel || tb.x + tb.width <= panel.x + 1, `плашка ${Math.round(tb.x)}–${Math.round(tb.x + tb.width)}, панель от ${panel ? Math.round(panel.x) : "—"}`);
  } else check("K9: плашка не висит поверх правой панели", true, "не показана");
  // K10: обход как у критика — кухня по длине стены, пеналы, навесные, техника из «Объектов в комнате»
  await page.locator("button:visible", { hasText: "Кухонные" }).first().click({ timeout: 4000 }).catch(() => {}); await settle();
  if (await presets.count()) { const open = await page.getByRole("button", { name: "Заменить кухню" }).first().isVisible().catch(() => false); if (!open) { await presets.click(); await settle(); } }
  await page.getByRole("button", { name: "Заменить кухню" }).first().click().catch(() => {}); await settle();
  for (const name of [/холодильник 600/i, /Навесной.* 600$/i, /духовка.*600/i]) { const b = page.getByRole("button", { name }).first(); if (await b.count()) { await b.scrollIntoViewIfNeeded().catch(() => {}); await b.click().catch(() => {}); await settle(); } }
  await page.getByRole("button", { name: /Помещение/ }).first().click(); await settle();
  for (const t of ["Холодильник", "Плита", "Посудомойка", "Вытяжка", "Варочная панель", "Стиральная машина"]) { const b = page.getByRole("button", { name: t, exact: true }).first(); if (await b.count()) { await b.scrollIntoViewIfNeeded().catch(() => {}); await b.click().catch(() => {}); await settle(); } }
  await page.locator(".view-tabs button", { hasText: "3D" }).first().click().catch(() => {}); await settle();
  await shot("05-k10-sweep");
  // K10: ни одного ответа ≥ 400 и ошибок консоли «404»
  check("K10: нет ответов 404/≥400 и ошибок страницы", !bad.length && !errors.length, [...bad, ...errors].join("; ").slice(0, 400));
  check("K10: в консоли нет «404 File not found»", !consoleErr.some((t) => /404|not found/i.test(t)), consoleErr.filter((t) => /404|not found/i.test(t)).join("; ").slice(0, 300));
  const failed = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - failed.length}/${results.length}`);
  writeFileSync(join(out, "k2-scenario.json"), JSON.stringify({ results, bad, consoleErr }, null, 1));
  if (failed.length) process.exitCode = 1;
} finally { await browser.close(); }
