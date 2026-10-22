// Волна 22.10 (ветка claude/w-kitchen), сценарий мышью: npx tsx scripts/wkitchen-scenario.ts <url> <outDir>
// Кухня (ряд 1200 «Заменить кухню») → навесной 600 → «Низ от пола» 1450 → «Пенал: духовка + СВЧ» 600 → «Открыть створки»
// (фасады открылись, духовка и СВЧ закрыты) → «Спереди» → «Скрыть фасады»; «Пенал под холодильник» 600 → то же;
// «Помещение» → объект замера «Стиральная машина» → снимок.
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
const shot = async (n: string) => { await settle(); await page.screenshot({ path: `${out}/wk-${n}.png` }); };
/** «Приблизить выбранный корпус» — кнопка-переключатель: включить (или переподогнать, если уже включена). */
const focus = async () => { const b = page.getByRole("button", { name: "Приблизить выбранный корпус" }).first(); if ((await b.getAttribute("aria-pressed")) === "true") await b.click(); await b.click(); await settle(); };
const item = (re: RegExp) => page.locator(".radial-item").filter({ hasText: re }).first();
type Saved = { id: string; y?: number; x: number; module: { name: string; height: number; kitchen?: { role?: string; column?: { kind: string } } } };
/** Кухня из localStorage вкладки «Кухня» (только чтение). */
const saved = () => page.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!; if (!k.includes("kitchen-workspace")) continue;
    try { const p = JSON.parse(localStorage.getItem(k)!); if (Array.isArray(p.modules)) return p as { modules: Saved[]; room: { obstacles?: { type: string; width: number; height: number; depth: number }[] } }; } catch { /* нет */ }
  }
  return null;
});
/** Отрисованная техника и петли модуля (window.__hardwareBoxes, только чтение): коробки в мм модуля. */
const boxes = (id: string) => page.evaluate((mid) => {
  const all = (window as unknown as { __hardwareBoxes?: () => { id: string; items: { pid: string; lo: number[]; hi: number[] }[] }[] }).__hardwareBoxes?.() ?? [];
  return all.find((a) => a.id === mid)?.items ?? [];
}, id);
/** «Открыть створки» мышью: ПКМ по модулю → (Корпус ›) → «Открыть створки»; нет в меню — кнопка «Открыть фасады» панели вида. */
async function openDoors() {
  const cv = (await page.locator("canvas").first().boundingBox())!;
  await page.mouse.click(cv.x + cv.width * 0.5, cv.y + cv.height * 0.45, { button: "right" }); await page.waitForTimeout(400);
  if (!(await item(/Открыть створки/).count()) && (await item(/^Корпус/).count())) { await item(/^Корпус/).click(); await page.waitForTimeout(300); }
  if (await item(/Открыть створки/).count()) { await item(/Открыть створки/).click(); return "меню"; }
  await page.keyboard.press("Escape").catch(() => {});
  await page.getByRole("button", { name: "Открыть фасады" }).first().click(); return "кнопка";
}
async function column(label: string, kind: "oven" | "fridge", tag: string) {
  await page.getByRole("button", { name: `${label} 600`, exact: true }).click(); await settle();
  const p = await saved(), a = p?.modules.find((x) => x.module.kitchen?.column?.kind === kind);
  check(`палитра «${label}» → в комнату: пенал под технику, высота ${a?.module.height}`, !!a, a ? `x ${a.x}` : "нет модуля");
  if (!a) return;
  await focus();
  await shot(`${tag}-1-3d`);
  const before = await boxes(a.id);
  const how = await openDoors(); await settle();
  const after = await boxes(a.id);
  const tech = kind === "oven" ? ["layout-oven", "layout-microwave"] : ["layout-fridge"];
  for (const t of tech) {
    const b0 = before.find((x) => x.pid === t), b1 = after.find((x) => x.pid === t);
    check(`«Открыть створки» (${how}): ${t} не открылся`, !!b0 && !!b1 && Math.abs(b1.hi[2] - b0.hi[2]) < 1 && Math.abs(b1.lo[1] - b0.lo[1]) < 1, b1 ? `z до ${Math.round(b1.hi[2])}` : "нет модели");
  }
  const cups = (l: typeof before) => l.filter((x) => x.pid.includes(":hingecup:")).map((x) => Math.round(x.hi[2]));
  check(`«Открыть створки»: фасады мебели открылись (чашки петель повернулись с фасадом)`, JSON.stringify(cups(before)) !== JSON.stringify(cups(after)), `${cups(before)} → ${cups(after)}`);
  await shot(`${tag}-2-open-3d`);
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {}); await focus();
  await shot(`${tag}-3-open-front`);
  await page.getByRole("button", { name: "Открыть фасады" }).first().click().catch(() => {}); // закрыть
  const hide = page.getByRole("button", { name: /Скрыть фасады/ });
  if (await hide.count()) { await hide.first().click(); await settle(); }
  await shot(`${tag}-4-no-facades-front`);
  await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {}); await focus();
  await shot(`${tag}-5-no-facades-3d`);
  const show = page.getByRole("button", { name: /Показать фасады|Скрыть фасады/ });
  if (await show.count()) { await show.first().click(); await settle(); }
}
try {
  await page.goto(url + "?order=kitchen");
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "0"); });
  await page.goto(url + "?order=kitchen"); await page.waitForSelector("canvas"); await settle();
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.getByRole("tab", { name: /Кухонные модули/ }).first().click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator("summary", { hasText: "Готовые кухонные модули" }).first().click().catch(() => {}); await page.waitForTimeout(300);
  await page.getByLabel("Длина стены кухни").fill("1200"); await page.getByRole("button", { name: "Заменить кухню" }).click(); await settle();
  await shot("0-start");
  // п. 6: навесной — поле «Низ навесных от пола» в палитре и «Низ от пола» у модуля
  const pal = page.getByLabel("Низ навесных от пола");
  check("палитра: «Низ навесных от пола» показывает высоту ряда (1458 по умолчанию)", (await pal.count()) > 0 && (await pal.inputValue()) === "1458", await pal.inputValue().catch(() => "нет поля"));
  await page.getByRole("button", { name: "Навесной 600", exact: true }).click(); await settle();
  const w0 = (await saved())?.modules.filter((x) => x.module.kitchen?.role === "wall").sort((a, b) => b.x - a.x)[0];
  check("навесной из палитры — на высоте ряда от пола, не на 0", !!w0 && w0.y === 1458, `y ${w0?.y}`);
  // раздел «Корпус» в панели справа свёрнут — раскрыть, как менеджер
  await page.locator("details.settings-category > summary", { hasText: "Корпус и размещение" }).first().click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator("details.kitchen-group summary span", { hasText: /^Корпус$/ }).first().click().catch(() => {}); await page.waitForTimeout(300);
  const low = page.getByLabel("Низ от пола", { exact: true });
  check("у навесного есть поле «Низ от пола»", (await low.count()) > 0);
  if (await low.count()) { await low.first().scrollIntoViewIfNeeded(); await low.first().fill("1450"); await low.first().press("Enter"); await settle(); }
  const w1 = (await saved())?.modules.find((x) => x.id === w0?.id);
  check("«Низ от пола» 1450 → навесной на 1450 от пола", w1?.y === 1450, `y ${w1?.y}`);
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await shot("6-wall-1450-front");
  await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {});
  // K1, K3: пенал духовка + СВЧ
  await column("Пенал: духовка + СВЧ", "oven", "k1-oven");
  // K2: пенал под холодильник
  await column("Пенал под холодильник", "fridge", "k2-fridge");
  // п. 10: стиральная машина — объект замера на этапе «Помещение»
  await page.getByRole("button", { name: "Помещение", exact: true }).first().click(); await settle();
  await page.getByRole("button", { name: "Стиральная машина", exact: true }).first().click(); await settle();
  const z = page.getByLabel("Сзади объекта 1");
  if (await z.count()) { await z.fill("1600"); await z.press("Enter"); await settle(); }
  const o = (await saved())?.room.obstacles?.find((x) => x.type === "washer");
  check("«Стиральная машина» добавлена как объект замера 600×850", !!o && o.width === 600 && o.height === 850, JSON.stringify(o));
  await shot("10-washer-room");
  await page.getByRole("button", { name: "Построение мебели", exact: true }).first().click(); await settle();
  await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {});
  await shot("10-washer-3d");
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
  const bad = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
  if (bad.length) process.exitCode = 1;
} finally { await browser.close(); }
