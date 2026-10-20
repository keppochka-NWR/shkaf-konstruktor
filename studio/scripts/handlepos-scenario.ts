// Расположение ручки мышью (запрос Макса 20.10.2026): npx tsx scripts/handlepos-scenario.ts <url> <outDir>
// «Навесной кухонный» → ПКМ по фасаду → «Ручка › Снизу по центру» → «В углу напротив нижней петли» → «Петли справа» (ручка в другом углу) → Ctrl+Z.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule } from "../src/model";
import { kitchenWall } from "../src/kitchen";
import { newProject } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/handlepos-${n}.png` });
const ring = async () => (await page.locator(".radial-item").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
const item = (re: RegExp) => page.locator(".radial-item").filter({ hasText: re }).first();
/** Ручка на экране (по пикселям снимка, вид «Спереди»): фасад — светлая заливка у центра холста, ручка — тёмные пиксели внутри него.
 *  Грубая проверка (в рамку попадают метки петель): точные места — в tests/handle-pos.test.ts. rx, ry — смещение центра ручки от центра фасада в долях ширины/высоты (ry > 0 — ниже центра). */
async function look() {
  const b64 = (await page.screenshot()).toString("base64"), c = (await page.locator("canvas").first().boundingBox())!;
  return page.evaluate(`(async () => {
    const img = new Image(); img.src = "data:image/png;base64,${b64}"; await img.decode();
    const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; const g = cv.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data, at = function (x, y) { const i = (y * img.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const box = function (test, x0, y0, x1, y1) { let a = 1e9, b = 1e9, e = -1, f = -1; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = at(x, y); if (test(p)) { if (x < a) a = x; if (y < b) b = y; if (x > e) e = x; if (y > f) f = y; } } return e < 0 ? null : { x0: a, y0: b, x1: e, y1: f }; };
    const door = box(function (p) { return p[0] > 245 && p[1] > 245 && p[2] > 200 && p[2] < 242; }, ${Math.round(c.x + c.width * 0.25)}, ${Math.round(c.y + c.height * 0.1)}, ${Math.round(c.x + c.width * 0.75)}, ${Math.round(c.y + c.height * 0.95)});
    if (!door) return null;
    const h = box(function (p) { return p[0] < 70 && p[1] < 70 && p[2] < 70; }, door.x0 + 3, door.y0 + 3, door.x1 - 2, door.y1 - 2);
    if (!h) return { door: door, h: null };
    const dw = door.x1 - door.x0, dh = door.y1 - door.y0;
    return { door: door, h: h, horizontal: h.x1 - h.x0 > h.y1 - h.y0, rx: ((h.x0 + h.x1) / 2 - (door.x0 + door.x1) / 2) / dw, ry: ((h.y0 + h.y1) / 2 - (door.y0 + door.y1) / 2) / dh };
  })()`) as Promise<{ door: object; h: object | null; horizontal?: boolean; rx?: number; ry?: number } | null>;
}
const fmt = (h: Awaited<ReturnType<typeof look>>) => h?.h ? `${h.horizontal ? "горизонтально" : "вертикально"}, центр ручки от центра фасада ${(h.rx! * 100).toFixed(0)}% ширины / ${(h.ry! * 100).toFixed(0)}% высоты (+ ниже)` : "ручка не найдена";
async function openDoorMenu() {
  const c = (await page.locator("canvas").first().boundingBox())!;
  await page.mouse.click(c.x + c.width / 2, c.y + c.height * 0.55, { button: "right" }); await page.waitForTimeout(350);
  if (await item(/^Фасад/).count()) { await item(/^Фасад/).click(); await page.waitForTimeout(250); }
}
async function pick(path: RegExp[]) {
  await openDoorMenu();
  for (const re of path) { const it = item(re); if (!(await it.count())) return (await ring()).join(" | "); await it.click(); await page.waitForTimeout(300); }
  await page.waitForTimeout(400);
  return "";
}
const undo = async () => { await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); await page.keyboard.press("Control+z"); await page.waitForTimeout(600); };
try {
  const p = newProject();
  const m = kitchenWall(initialModule(), 600); m.sections[0].hingeSide = "left";
  p.modules = [{ id: "w", x: 1000, y: 1400, z: 3, rotation: 0, module: m }];
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "facades"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(p));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await page.waitForTimeout(1200);
  const h0 = await look();
  check("старт: «Навесной кухонный», умолчание — угол напротив нижней петли", !!h0?.h && !h0.horizontal && h0.rx! > 0.15 && h0.ry! > 0.15, fmt(h0));
  await shot("01-start");
  await openDoorMenu();
  if (await item(/^Ручка/).count()) { await item(/^Ручка/).click(); await page.waitForTimeout(300); }
  const items = await ring();
  check("«Ручка ›»: у навесного «Снизу по центру» и «В углу напротив нижней петли» первыми, «Для всех фасадов модуля»", /Снизу по центру/.test(items[0] ?? "") && /В углу напротив нижней петли/.test(items[1] ?? "") && items.some((t) => /Для всех фасадов модуля/.test(t)), items.join(" | "));
  await shot("02-menu");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(200);

  const e1 = await pick([/^Ручка/, /Снизу по центру/]);
  const h1 = await look();
  check("«Снизу по центру»: горизонтально, по центру ширины, у нижнего края", !!h1?.h && h1.horizontal && Math.abs(h1.rx!) < 0.03 && h1.ry! > 0.4, fmt(h1) + (e1 ? " · меню: " + e1 : ""));
  await shot("03-bottom-center");

  const e2 = await pick([/^Ручка/, /В углу напротив нижней петли/]);
  const h2 = await look();
  check("«В углу напротив нижней петли»: вертикально, у кромки открывания (петли слева → справа), внизу", !!h2?.h && !h2.horizontal && h2.rx! > 0.15 && h2.ry! > 0.3, fmt(h2) + (e2 ? " · меню: " + e2 : ""));
  await shot("04-corner");

  const e3 = await pick([/^Открывание/, /Петли справа/]);
  const h3 = await look();
  check("«Петли справа» (перевес): ручка переехала в левый нижний угол", !!h3?.h && !h3.horizontal && h3.rx! < -0.15 && Math.abs(h3.ry! - h2!.ry!) < 0.02, fmt(h3) + (e3 ? " · меню: " + e3 : ""));
  await shot("05-rehung");

  await undo();
  const h4 = await look();
  check("Ctrl+Z: петли слева, ручка снова в правом нижнем углу", !!h4?.h && !h4.horizontal && h4.rx! > 0.15 && Math.abs(h4.rx! - h2!.rx!) < 0.02 && Math.abs(h4.ry! - h2!.ry!) < 0.02, fmt(h4));
  await shot("06-undo");

  // панель кухонного модуля: «Ручки › Расположение ручек» (всем фасадам модуля) — текущее и порядок вариантов у навесного
  const sel = page.locator('[data-testid="handle-pos-module"] select');
  await page.evaluate(() => { for (let c: HTMLElement | null = document.querySelector('[data-testid="handle-pos-module"]'); c; c = c.parentElement) if (c instanceof HTMLDetailsElement) c.open = true; });
  await sel.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(300);
  const val = (await sel.count()) ? await sel.inputValue() : "", opts = (await sel.count()) ? (await sel.locator("option").allInnerTexts()).map((t) => t.trim()) : [];
  check("панель модуля: «Расположение ручек» = угол напротив нижней петли, «Снизу по центру» первым", val === "bottomCorner" && /Снизу по центру/.test(opts[0] ?? ""), `${val} · ${opts.join(" | ")}`);
  if (await sel.count()) { await sel.selectOption("bottomCenter"); await page.waitForTimeout(700); const hp = await look(); check("панель: «Снизу по центру» — ручка горизонтально снизу", !!hp?.h && hp.horizontal! && hp.ry! > 0.4, fmt(hp)); await shot("07-panel"); }
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
  const bad = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
  if (bad.length) process.exitCode = 1;
} finally { await browser.close(); }