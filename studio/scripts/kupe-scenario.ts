// Задания менеджеров 22.10 (ветка claude/w-kupe) мышью, как менеджер: npx tsx scripts/kupe-scenario.ts <origin> <outDir>
// <origin> — сервер своей сборки с папкой web (http://127.0.0.1:8437): студия /studio/?fresh=1, калькулятор купе /calc/.
// Студия: палитра «Шкафы-купе» → «Шкаф-купе», установка «внутри шкафа», 2400×2600×600 → в комнату → 3 двери (ширина полотна
// с нахлёстом) → раскладка «2 равные» → секция двери 2 → полотно «Стекло сатин» → клик по вставке в 3D → «Сдвинуть двери».
// Калькулятор: проём 2400×2600, 3 двери → ширина каждой двери в расчёте → КП (печать) с шириной дверей; проём 2368×2584 = студия.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [origin, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(800);
};
const shot = async (n: string) => { await settle(); await page.screenshot({ path: `${out}/${n}.png` }); };
/** Проект студии из localStorage: корпус с зоной дверей и двери купе. */
type Snap = { body: { x: number; z: number; w: number; h: number; d: number; zone?: number } | null; doors: { x: number; z: number; w: number; h: number; n: number; mount?: string; sections?: number; sectionFills?: unknown } } | null;
// проект лежит в хранилище комнат/клиентов — ищем в любом ключе объект с modules, где есть двери купе (строкой: tsx не вносит __name в страницу)
const PROJECT_JS = `(() => {
  function find(x, depth) {
    if (!x || typeof x !== "object" || depth > 8) return null;
    if (Array.isArray(x.modules) && x.modules.some(function (a) { return a && a.module && a.module.kupe; })) return x.modules;
    for (const v of Object.values(x)) { let y = v; if (typeof v === "string" && v.startsWith("{")) { try { y = JSON.parse(v); } catch (e) { y = null; } } const r = find(y, depth + 1); if (r) return r; }
    return null;
  }
  // сначала автосохранение редактора (module-studio-v3*), потом копии комнат/клиентов
  const keys = Object.keys(localStorage).sort(function (a, b) { return (b.startsWith("module-studio-v3") ? 1 : 0) - (a.startsWith("module-studio-v3") ? 1 : 0); });
  for (const key of keys) {
    if (key.endsWith(":previous")) continue; // резервная копия предыдущей правки
    let mods = null; try { mods = find(JSON.parse(localStorage.getItem(key)), 0); } catch (e) {}
    if (!mods) continue;
    const body = mods.find(function (a) { return a.module.kupeZone; }), doors = mods.find(function (a) { return a.module.kupe; });
    return { body: body ? { x: body.x, z: body.z, w: body.module.width, h: body.module.height, d: body.module.depth, zone: body.module.kupeZone } : null,
      doors: { x: doors.x, z: doors.z, w: doors.module.width, h: doors.module.height, n: doors.module.kupe.doors, mount: doors.module.kupe.mount, sections: doors.module.kupe.sections, sectionFills: doors.module.kupe.sectionFills } };
  }
  return null;
})()`;
/** Разделы панели купе свёрнуты (и сворачиваются заново при выборе детали в 3D) — раскрыть кликом по заголовку. */
const openKupe = async () => { for (const title of ["Габариты и количество дверей", "Наполнение дверей", "Комплектация и открывание"]) { const s = page.locator(".kupe-panel summary", { hasText: title }).first(); if (await s.count() && !(await s.evaluate((el) => (el.parentElement as HTMLDetailsElement).open))) { await s.click(); await page.waitForTimeout(200); } } };
const project = async () => (await page.evaluate(PROJECT_JS)) as Snap;
try {
  // ── Студия ─────────────────────────────────────────────────────────────
  const url = origin + "/studio/?fresh=1";
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "0"); });
  await page.goto(url); await page.waitForSelector("canvas"); await settle();
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.getByRole("tab", { name: "Шкафы-купе" }).click();
  await page.getByRole("button", { name: "Шкаф-купе", exact: true }).click();
  const mount = page.getByLabel("Установка дверей купе");
  check("палитра: «Установка дверей: внутри шкафа / отдельно»", (await mount.count()) === 1 && (await mount.locator("option").allInnerTexts()).join("|") === "внутри шкафа|отдельно (ниша или перед корпусами)");
  await mount.selectOption("inside");
  for (const [label, v] of [["Ширина новой мебели", "2400"], ["Высота новой мебели", "2600"], ["Глубина новой мебели", "600"]] as const) {
    const f = page.getByLabel(label); await f.click({ clickCount: 3 }); await page.keyboard.type(v);
  }
  await shot("studio-01-palette-inside");
  await page.getByRole("button", { name: "Добавить в комнату" }).click(); await settle(); await page.waitForTimeout(1500);
  const alert = (await page.locator("[role=alert]").allInnerTexts()).join(" | ").trim();
  const p1 = await project();
  check("в комнату: корпус 2400×2600×500 + зона 100, двери 2368×2584 между боковинами (x+16) от пола", !!p1?.body && p1.body.w === 2400 && p1.body.h === 2600 && p1.body.d === 500 && p1.body.zone === 100 && p1.doors.w === 2368 && p1.doors.h === 2584 && p1.doors.x === p1.body.x + 16 && p1.doors.z === p1.body.z + 500 && p1.doors.mount === "inside", JSON.stringify(p1) + (alert ? " | " + alert : ""));
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await shot("studio-02-added-3d");
  // выбрать двери купе в списке модулей слева (после добавления группы выбран корпус)
  if (!(await page.locator(".kupe-panel").count())) { const it = page.locator(".module-item", { hasText: "Двери купе" }).first(); await it.scrollIntoViewIfNeeded(); await it.click(); await settle(); }
  // разделы панели купе свёрнуты — раскрыть «Габариты…» и «Наполнение дверей» кликом по заголовку
  await openKupe();
  check("панель купе: «Установка дверей: внутри шкафа»", (await page.locator(".kupe-mount").innerText().catch(() => "")).includes("внутри шкафа"));
  await page.getByRole("group", { name: "Количество дверей купе" }).getByRole("button", { name: "3", exact: true }).click(); await settle();
  const leafText = (await page.locator("[data-kupe-leaf]").innerText().catch(() => "")).trim();
  check("3 двери: полотно 807 мм с нахлёстом (проём 2368, не 2368/3 = 789)", leafText === "полотно 807 мм", leafText);
  await page.getByRole("button", { name: "Спереди", exact: true }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await shot("studio-03-3doors-front");
  await page.getByRole("button", { name: "3D", exact: true }).click(); await settle();
  await shot("studio-04-3doors-3d");
  // раскладка «2 равные», секция 1 двери 2 → «Стекло сатин матовый 4мм»
  await page.locator(".kupe-sections button", { hasText: "2 равные" }).click(); await settle();
  const sect = page.locator(".kupe-leaf rect.kupe-sect").filter({ has: page.locator("title", { hasText: "Дверь 2 · секция 1" }) }).first();
  await sect.scrollIntoViewIfNeeded(); await sect.click(); await settle();
  check("клик по секции схемы: редактор «Дверь 2 · секция 1»", (await page.locator(".kupe-sect-editor").innerText().catch(() => "")).includes("Дверь 2 · секция 1"));
  await page.locator(".kupe-leaves").scrollIntoViewIfNeeded(); await shot("studio-05-panel-section-picked");
  await page.getByLabel("Полотно секции").selectOption("Стекло сатин матовый 4мм"); await settle(); await page.waitForTimeout(800);
  const p2 = await project();
  check("полотно секции сохранено: sectionFills[1][0] = сатин, раскладка «2 равные»", JSON.stringify(p2?.doors.sectionFills) === JSON.stringify([[], ["Стекло сатин матовый 4мм", null], []]) && p2?.doors.sections === 1, JSON.stringify(p2?.doors) + " | ключи: " + (await page.evaluate("Object.keys(localStorage).join(\",\")")));
  await page.getByRole("button", { name: "Спереди", exact: true }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await shot("studio-06-section-fill-front");
  await page.locator(".kupe-leaves").scrollIntoViewIfNeeded(); await shot("studio-07-panel-section-fill");
  // клик по вставке в 3D (верхняя секция третьей двери) — редактор переключается на неё
  await page.getByRole("button", { name: "Выбрать", exact: true }).click(); await page.waitForTimeout(300);
  const cv = (await page.locator("canvas").first().boundingBox())!;
  let picked = "";
  for (const [fx, fy] of [[0.72, 0.35], [0.7, 0.3], [0.75, 0.4], [0.68, 0.33]]) {
    await page.mouse.click(cv.x + cv.width * fx, cv.y + cv.height * fy); await settle(); await openKupe();
    picked = (await page.locator(".kupe-sect-editor label").first().innerText().catch(() => "")).split("\n")[0].trim();
    if (/Дверь 3/.test(picked)) break;
  }
  check("клик по вставке в 3D выбирает секцию двери в панели", /Дверь 3 · секция/.test(picked), picked);
  await shot("studio-08-3d-section-click");
  await openKupe(); await page.getByRole("button", { name: /Сдвинуть двери/ }).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "3D", exact: true }).click(); await settle();
  await shot("studio-09-doors-open-inside");

  // ── Калькулятор купе web/calc ───────────────────────────────────────────
  // внешние шрифты/CDN калькулятора без сети подвешивают снимок — внешние запросы отклоняем (страница работает на своих файлах)
  await page.route((u) => !u.href.startsWith(origin), (r) => r.abort());
  const calc = async (w: string, h: string, n: string, tag: string) => {
    await page.goto(origin + "/calc/", { waitUntil: "domcontentloaded" }); await page.waitForSelector("#width"); await page.waitForTimeout(800);
    for (const [id, v] of [["#width", w], ["#height", h]] as const) { await page.locator(id).click({ clickCount: 3 }); await page.keyboard.type(v); }
    await page.locator("#doorCountChips button", { hasText: n }).click();
    await page.getByRole("button", { name: "Рассчитать стоимость" }).click(); await page.waitForTimeout(900);
    const sizes = (await page.locator("#kupeDoorSizes").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    await page.screenshot({ path: `${out}/calc-${tag}.png` });
    return sizes;
  };
  const s1 = await calc("2400", "2600", "3", "01-2400x2600-3doors");
  check("калькулятор 2400×2600, 3 двери: ширина каждой двери 818 мм", /Дверь 1 818 мм Дверь 2 818 мм Дверь 3 818 мм/.test(s1) && /нахлёст 27 мм/i.test(s1), s1);
  await page.locator("#kupeDoorSizes").screenshot({ path: `${out}/calc-02-door-widths.png` }).catch(() => {});
  // калькулятор v2.10/2.11 (с 23.10): КП формируется после полей клиента, телефона и менеджера
  for (const [id, v] of [["#kpClient", "Тестовый клиент"], ["#kpPhone", "+7 900 000-00-00"], ["#kpManager", "Тест Менеджер"]] as const) if (await page.locator(id).count()) { await page.locator(id).click(); await page.keyboard.type(v); }
  await page.getByRole("button", { name: "Сформировать КП" }).click(); await page.waitForTimeout(1200);
  const kp = (await page.locator("#kpPageContent").innerText().catch(() => "")).replace(/\s+/g, " ");
  check("КП (печать): «Ширина двери 1…3 — 818 мм»", /Ширина двери 1 818 мм/.test(kp) && /Ширина двери 3 818 мм/.test(kp), kp.match(/Ширина двери[^Н]*/)?.[0]?.slice(0, 160) ?? "");
  await page.screenshot({ path: `${out}/calc-03-kp-print.png` });
  const s2 = await calc("2368", "2584", "3", "04-2368x2584-as-studio");
  check("сверка: проём шкафа-купе 2368×2584, 3 двери — 807 мм, как в студии", /Дверь 1 807 мм/.test(s2), s2);
  check("без ошибок страницы", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  check("сценарий выполнен до конца", false, (e as Error).message.split("\n")[0]);
  await page.screenshot({ path: `${out}/zz-error.png` }).catch(() => {});
}
writeFileSync(`${out}/kupe-scenario.json`, JSON.stringify({ results, errors }, null, 1), "utf8");
console.log(`итог: ${results.filter((r) => r[1]).length}/${results.length}`);
await browser.close();
