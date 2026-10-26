// Заказ 7442203: сборка обоих изделий МЫШЬЮ И КЛАВИАТУРОЙ как менеджер — от пустой комнаты до готовых изделий, затем сверка
// с проектом, собранным функциями (scripts/order-7442203.ts): детали каждого корпуса (размер и положение, допуск 0,6 мм) и смета.
// npx tsx scripts/o-7442203-manager-scenario.ts <url своей сборки /studio/?fresh=1> <папка вывода>
// Только палитра, панели, окна и клавиатура (никаких инъекций проекта); localStorage читается только для сверки после сборки.
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parts } from "../src/model";
import { parseProject, type Project, type PlacedModule } from "../src/project";
import { estimate } from "../src/pricing";
import { build } from "./order-7442203";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(6000);
const pageErrors: string[] = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
const stats = { clicks: 0, keys: 0, typed: 0 };
const log: { step: string; ok: boolean; ms: number; err?: string }[] = [];
let shotN = 0;
const shot = (n: string) => page.screenshot({ path: join(out, `${String(++shotN).padStart(2, "0")}-${n}.png`) });
const t0 = Date.now();
async function step(name: string, fn: () => Promise<unknown>) {
  const t = Date.now();
  try { await fn(); log.push({ step: name, ok: true, ms: Date.now() - t }); }
  catch (e) { log.push({ step: name, ok: false, ms: Date.now() - t, err: (e as Error).message.split("\n")[0].slice(0, 200) }); console.log("FAIL", name, (e as Error).message.split("\n")[0].slice(0, 160)); await shot("fail-" + name.replace(/[^\wа-яё]+/gi, "_").slice(0, 40)); }
}
const click = async (l: Locator) => { if (!(await l.isVisible().catch(() => false))) await openPanels(); await l.scrollIntoViewIfNeeded(); await l.click(); stats.clicks++; await page.waitForTimeout(150); };
const btn = async (name: string) => { await openPanels(); const l = page.getByRole("button", { name, exact: true }).filter({ visible: true }).first(); if (!(await l.isVisible().catch(() => false))) await openPanels(); await click(l); };
/** Раскрыть свёрнутые разделы панели модуля щелчком по их заголовкам (как менеджер: «Корпус и размещение +» и т. д.). */
async function openPanels() {
  for (let round = 0; round < 4; round++) {
    const all = page.locator("details:not([open]) > summary");
    let opened = 0;
    for (let i = 0, n = await all.count(); i < n && i < 80; i++) {
      const s = all.nth(i);
      if (!(await s.isVisible().catch(() => false))) continue;
      const txt = (await s.innerText().catch(() => "")).trim();
      if (/^Добавить мебель|^Точки замера|стена$|^Пол$|^Потолок$|^Двери и окна|^Трубы|^Колонны/.test(txt)) continue; // палитра и замер помещения — не трогаем
      await s.scrollIntoViewIfNeeded().catch(() => undefined); await s.click().catch(() => undefined); stats.clicks++; opened++; await page.waitForTimeout(80);
    }
    if (!opened) break;
  }
}
const label = async (aria: string) => { const l = page.getByLabel(aria, { exact: true }).first(); if (!(await l.isVisible().catch(() => false))) await openPanels(); return l; };
/** Числовое поле: тройной щелчок, ввод, Enter (NumberField применяет по Enter). Отказ поля — ошибка шага. */
async function field(aria: string, value: number | string, verify = true) {
  const l = await label(aria);
  await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); stats.clicks++;
  await page.keyboard.type(String(value)); stats.typed++;
  await page.keyboard.press("Enter"); stats.keys++;
  await page.waitForTimeout(300);
  const v = await l.inputValue().catch(() => "");
  if (verify && v !== "" && Number(v) !== Number(value)) throw Error(`поле «${aria}»: ${v} вместо ${value}; ${(await page.locator(".error-banner").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 160)}`);
}
/** Список: щелчок, стрелки до нужного пункта, Enter. */
async function pick(aria: string, option: RegExp) {
  const sel = await label(aria);
  await sel.scrollIntoViewIfNeeded();
  const opts = await sel.locator("option").allInnerTexts(), cur = await sel.evaluate((s) => (s as HTMLSelectElement).selectedIndex);
  const want = opts.findIndex((o) => option.test(o)); if (want < 0) throw Error(`нет пункта ${option} в «${aria}»: ${opts.join(" | ").slice(0, 200)}`);
  if (want === cur) return;
  await sel.focus(); stats.clicks++;
  const key = want > cur ? "ArrowDown" : "ArrowUp";
  for (let i = 0; i < Math.abs(want - cur); i++) { await page.keyboard.press(key); stats.keys++; }
  await page.waitForTimeout(300);
  if ((await sel.evaluate((s) => (s as HTMLSelectElement).selectedIndex)) !== want) throw Error(`«${aria}»: пункт не выбран`);
}
async function check(aria: string, on: boolean) {
  const l = await label(aria); await l.scrollIntoViewIfNeeded();
  if ((await l.isChecked()) !== on) { await l.click(); stats.clicks++; await page.waitForTimeout(250); }
  if ((await l.isChecked()) !== on) throw Error(`флажок «${aria}» не переключился`);
}
async function modalPick(search: string, item: RegExp, opts: { scope?: RegExp; target?: RegExp; face?: RegExp } = {}) {
  if (opts.face) await pick("Конкретный фасад для ручки", opts.face);
  if (opts.target) await pick("Назначение ручек", opts.target);
  if (opts.scope) await pick(opts.scope.source.includes("ручк") ? "К каким корпусам применить ручку" : "К каким корпусам применить материал", opts.scope);
  const s = page.getByLabel(search.startsWith("руч") ? "Найти ручку" : "Найти декор", { exact: true });
  await s.click(); stats.clicks++; await page.keyboard.type(search.replace(/^руч:/, "")); stats.typed++; await page.waitForTimeout(300);
  await click(page.getByRole("button", { name: item }).first());
}
async function palette(kind: string, w: number, h: number, d: number) {
  await click(page.getByRole("button", { name: kind, exact: true }).first());
  await field("Ширина новой мебели", w); await field("Высота новой мебели", h); await field("Глубина новой мебели", d);
  await btn("Добавить в комнату"); await page.waitForTimeout(800);
  // палитра предлагает варианты, если корпус не встаёт в ряд, — «Поставить отдельно», затем положение задаём полями
  const apart = page.getByRole("button", { name: /^Поставить отдельно/ });
  if (await apart.count() && await apart.first().isVisible()) { await click(apart.first()); await page.waitForTimeout(800); }
}
async function lowerCase(o: { rails: ("Стяжка сзади сверху" | "Стяжка сзади снизу")[] }) {
  await pick("Тип задней стенки", /Без задней стенки/);
  await pick("Дно корпуса", /Без дна/);
  await pick("Высота цоколя", /^60 мм/);
  for (const r of ["Стяжка сзади сверху", "Стяжка сзади снизу"] as const) await check(r, o.rails.includes(r));
  if (o.rails.includes("Стяжка сзади снизу")) await field("Высота стяжки сзади снизу", 100);
}
async function shelvesAt(centers: number[], fixed: number[]) {
  await field("Полок в секции", centers.length);
  // сверху вниз, чтобы полки не «перепрыгивали» друг через друга
  for (let j = 0; j < centers.length; j++) await field(`Полка ${j + 1}`, centers[j]); // снизу вверх: целевые высоты ниже равномерных
  for (let j = 0; j < centers.length; j++) await check(`Полка ${j + 1} жёсткая`, fixed.includes(j));
}
async function rodOn() { await openPanels(); const sw = page.getByRole("switch", { name: "Штанга" }).filter({ visible: true }); if (await sw.count()) { if ((await sw.first().getAttribute("aria-checked")) !== "true") await click(sw.first()); return; } const cb = page.getByLabel("Штанга", { exact: true }).filter({ visible: true }); if (await cb.count()) { if (!(await cb.first().isChecked())) await click(cb.first()); return; } await click(page.getByText("Штанга", { exact: true }).filter({ visible: true }).first()); }
async function drawerTab(j: number) { await click(page.locator(".drawer-tabs button").nth(j)); }
async function handles(item: RegExp, search: string, target?: RegExp, face?: RegExp) {
  await click(page.getByRole("button", { name: target && /Ящик/.test(target.source) ? /^Ручки ящиков/ : /^Ручки фасадов/ }).first());
  await modalPick("руч:" + search, item, { target, face });
}
async function lightLeftOnly(sensor: boolean) {
  await check("Подсветка в стойках", true);
  await btn("Настроить подсветку…");
  const right = page.getByRole("button", { name: /^Убрать: секция 1, .*прав/i });
  if (await right.count()) await click(right.first());
  if (sensor) await check("Включение по датчику движения", true);
  await click(page.getByRole("button", { name: "Закрыть окно" }).first());
}
async function antresol(o: { height: number; right?: boolean }) {
  await btn("Антресоль сверху на этот корпус"); await page.waitForTimeout(600);
  await field("Высота", o.height);
  if (o.right) await pick("Петли выбранной секции", /Справа/);
  await pick("Дно корпуса", /ЛДСП 16/);
  await check("Стяжка сзади снизу", false);
  await check("Стяжка сзади сверху", true);
  await pick("Открывание фасадов", /Push-to-open/);
  await shelvesAt([266 - 16], [0]);
}

await page.goto(url);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2000);
await shot("empty-room");
// ---------- Помещение по замеру
await step("комната 1386 × 2400 × 2638", async () => { await field("Ширина пустой комнаты", 1386); await field("Глубина пустой комнаты", 2400); await field("Высота пустой комнаты", 2638); });
// ---------- Угловой шкаф: левый модуль 500 × 2000 × 582 по эскизу (решение 26.10), ФП к стене отключена флагом
await step("левый: палитра «Пустой шкаф» 500 × 2000 × 582", () => palette("Пустой шкаф", 500, 2000, 582));
// все разделы панели модуля раскрыты (переключатель «Все настройки» справа сверху) — поля видны без поиска по разделам
await step("панель: «Все настройки»", () => check("Все настройки", true));
await step("левый: без задника, без дна, цоколь 60, стяжка сзади сверху", () => lowerCase({ rails: ["Стяжка сзади сверху"] }));
await step("левый: «Без фальша у стены · по эскизу», к левой стене с зазором 3", async () => { await click(await label("Без фальша у стены")); await page.waitForTimeout(400); /* интеграция 26.10: один флажок autoFillersOff (o-7441182 = o-7442203) */ await field("От задней стены", 0); await field("От левой стены", 3); });
await step("левый: ящики — обувница-полка + 2 ящика, скрытые DTC с доводчиком 500", async () => {
  await btn("Добавить: Ящики"); await field("Ящиков в секции", 3);
  for (const [j, y, h] of [[2, 620, 160], [1, 420, 160], [0, 190, 50]] as const) {
    await drawerTab(j);
    await pick("Направляющие ящика", /Скрытые DTC · с доводчиком/);
    await pick("Длина направляющих", /^500 мм/);
    if (j === 0) await pick("Тип ящика", /Выкатная полка/);
    await field("Высота боковины ящика", h);
    await field("Ящик от дна проёма", y);
  }
  await drawerTab(1); await pick("Ручка ящика", /Зазор/);
});
await step("левый: штанга", async () => { await rodOn(); await field("Высота штанги от дна", 1854); });
await step("левый: ручка торцевая 600, высота 850", async () => { await handles(/HEXA L-1200 · чёрный мат/, "HEXA L-1200 · чёрный"); await field("Высота ручек от пола · все двери", 250); });
await step("левый: подсветка левой стойки по датчику", () => lightLeftOnly(true));
await step("левый: антресоль 620 push, полка (отсек 330)", () => antresol({ height: 620 }));
await shot("left-done");
// ---------- Центральный модуль 500
await step("центр: палитра 500 × 2000 × 582", () => palette("Пустой шкаф", 500, 2000, 582));
await step("центр: без задника, без дна, цоколь 60, стяжки сзади", () => lowerCase({ rails: ["Стяжка сзади сверху", "Стяжка сзади снизу"] }));
await step("центр: вплотную к левому", async () => { await field("От задней стены", 0); await field("От левой стены", 503); });
await step("центр: штанга 70 под крышей, полка 480 жёсткая", async () => { await rodOn(); await field("Высота штанги от дна", 1853); await field("Высота штанги от дна", 1854); /* то же значение поле не применяет — сначала 1853 */ await btn("Добавить: Полки"); await field("Полка 1", 472 - 60); await check("Полка 1 жёсткая", true); });
await step("центр: петли 155–165°", () => check("Петли 155–165°", true));
await step("центр: ручка торцевая 600, высота 850", async () => { await handles(/HEXA L-1200 · чёрный мат/, "HEXA L-1200 · чёрный"); await field("Высота ручек от пола · все двери", 250); });
await step("центр: подсветка левой стойки по датчику", () => lightLeftOnly(true));
await step("центр: антресоль 620 push", () => antresol({ height: 620 }));
await shot("center-done");
// ---------- Правое крыло 486 × 2000 × 362, вдоль правой стены (поворот 270), от линии корпусов 584
await step("крыло: палитра 470 × 2000 × 362", () => palette("Пустой шкаф", 470, 2000, 362));
await step("крыло: без задника, без дна, цоколь 60, стяжки сзади", () => lowerCase({ rails: ["Стяжка сзади сверху", "Стяжка сзади снизу"] }));
await step("крыло: поворот 270, к правой стене, от задней 584", async () => { await field("От задней стены", 1300); await field("Поворот корпуса", 270); await field("От правой стены", 0); await field("От задней стены", 600); });
await step("крыло: полки 300·260·260·220·220·280 (от низа проёма), 3-я и 5-я жёсткие", () => shelvesAt([368, 644, 920, 1156, 1392, 1688].map((c) => c - 60), [2, 4]));
await step("крыло: петли справа, ручка торцевая 600, высота 850", async () => { await pick("Петли выбранной секции", /Справа/); await handles(/HEXA L-1200 · чёрный мат/, "HEXA L-1200 · чёрный"); await field("Высота ручек от пола · все двери", 250); });
await step("крыло: антресоль 620 push, петли справа", () => antresol({ height: 620, right: true }));
await shot("wing-done");
// ---------- Пенал 430 × 2620 × 322 в нишу на левой стене
await step("пенал: палитра 430 × 2500 × 322 (выше 2500 — после смены задника)", () => palette("Пустой шкаф", 430, 2500, 322));
await step("пенал: задник ЛДСП, высота 2620, без дна, цоколь 60", async () => { await pick("Тип задней стенки", /ЛДСП 16/); await field("Высота", 2620); await pick("Дно корпуса", /Без дна/); await pick("Высота цоколя", /^60 мм/); });
await step("пенал: поворот 90, к левой стене, от задней 1501", async () => { await field("От задней стены", 1300); await field("Поворот корпуса", 90); await field("От левой стены", 0); await field("От задней стены", 1501); });
await step("пенал: фасады в 2 ряда, нижний 619, проём 624", async () => { await check("Разделить фасады по высоте", true).catch(async () => { await click(page.getByText("Разделить фасады по высоте", { exact: true })); }); await field("Высота нижнего ряда фасадов", 619); await field("Открытый проём между рядами фасадов, мм (ящики и ниша; 0 — без проёма)", 624); });
// ящики — после проёма: первый «+» ставит ящик к низу проёма между рядами (дописано 26.10)
await step("пенал: 2 ящика в проёме, скрытые DTC с доводчиком 270, фасад 198", async () => {
  await btn("Добавить: Ящики"); await btn("Добавить: Ящики");
  for (const [j, y] of [[1, 791], [0, 589]] as const) {
    await drawerTab(j);
    await pick("Направляющие ящика", /Скрытые DTC · с доводчиком/);
    await pick("Длина направляющих", /^270 мм/);
    await field("Высота боковины ящика", 140);
    await field("Высота фасада ящика", 198);
    await field("Ящик от дна проёма", y);
  }
});
await step("пенал: полки 7 (2 под ящиками, над нишей и выше), жёсткие 3, 5, 7", () => shelvesAt([258, 458, 1264, 1514, 1765, 2016, 2266].map((c) => c - 60), [2, 4, 6]));
await step("пенал: ручки — двери торцевая 500, верхняя дверь 600, ящики 350; высота 1590", async () => {
  await handles(/Торцевая · 500/, "Торцевая · 500");
  await handles(/HEXA L-1200 · чёрный мат/, "HEXA L-1200 · чёрный", undefined, /створка 3/);
  await handles(/Торцевая · 350/, "Торцевая · 350", /Ящик/);
  await field("Высота ручек от пола · все двери", 1322, false); // поле показывает первую (нижнюю) дверь

});
await shot("pencil-done");
// ---------- Материалы на все корпуса: корпус Бамбук, фасады Тэффи
await step("материалы: корпус Бамбук, фасады Тэффи (все корпуса)", async () => {
  await openPanels(); await click(page.getByRole("button", { name: "Все", exact: true }).filter({ visible: true }).first());
  await modalPick("Бамбук", /Бамбук/, { scope: /Все корпуса проекта/ });
  await openPanels(); await click(page.getByRole("button", { name: /^Материал фасадов/ }).filter({ visible: true }).first());
  await modalPick("Тэффи", /Тэффи/, { scope: /Все корпуса проекта/ });
});
const seconds = Math.round((Date.now() - t0) / 1000);
await page.keyboard.press("Escape"); await click(page.locator("button", { hasText: "Модуль 1" }).first()).catch(() => undefined); await page.waitForTimeout(6000); // сохранение проекта в хранилище — с задержкой
await shot("final");
// ---------- Сверка: проект из хранилища (только чтение) против сборки функциями
const storageKeys = await page.evaluate(`Object.keys(localStorage)`) as string[];
const saved = await page.evaluate(`(() => { let best = null; const walk = (x, d) => { if (!x || typeof x !== "object" || d > 8) return; if (Array.isArray(x.modules) && x.room && (!best || x.modules.length > best.modules.length)) best = x; for (const v of Object.values(x)) walk(v, d + 1); }; for (const k of Object.keys(localStorage)) { try { walk(JSON.parse(localStorage.getItem(k) || "null"), 0); } catch {} } return best; })()`) as Project | null;
await browser.close();
writeFileSync(join(out, "manager-project.json"), JSON.stringify(saved, null, 1));
const ref = build();
const key = (a: PlacedModule) => [Math.round(a.x), Math.round(a.y ?? 0), Math.round(a.z), a.rotation ?? 0].join(",");
const norm = (id: string, m: PlacedModule["module"]) => { let r = id; m.sections.forEach((s, i) => { r = r.split(s.id).join("s" + i); }); return r; };
const report: string[] = [];
let partDiffs = 0;
const mp = saved ? parseProject(saved) : null;
if (mp) for (const a of ref.modules) {
  const b = mp.modules.find((x) => key(x) === key(a));
  if (!b) { report.push(`${a.module.name}: в сборке мышью нет корпуса в ${key(a)}`); partDiffs++; continue; }
  const pa = new Map(parts(a.module).filter((p) => p.role !== "fastener").map((p) => [norm(p.id, a.module), p])), pb = new Map(parts(b.module).filter((p) => p.role !== "fastener").map((p) => [norm(p.id, b.module), p]));
  const diffs: string[] = [];
  for (const [id, p] of pa) { const q = pb.get(id); if (!q) { diffs.push("нет " + id); continue; } const d = Math.max(...p.size.map((v, i) => Math.abs(v - q.size[i])), ...p.position.map((v, i) => Math.abs(v - q.position[i]))); if (d > 0.6) diffs.push(`${id} ±${d.toFixed(1)}`); }
  for (const id of pb.keys()) if (!pa.has(id)) diffs.push("лишняя " + id);
  partDiffs += diffs.length;
  report.push(`${a.module.name} ↔ ${b.module.name}: деталей ${pa.size}/${pb.size}, отличий ${diffs.length}${diffs.length ? ": " + diffs.slice(0, 8).join("; ") : ""}`);
}
const er = estimate(ref), em = mp ? estimate(mp) : null;
const lineDiff = em ? [...new Set([...er.lines, ...em.lines].map((l) => l.id))].map((id) => { const x = er.lines.find((l) => l.id === id), y = em.lines.find((l) => l.id === id); return x && y && Math.abs(x.quantity - y.quantity) < 0.01 && x.unitPrice === y.unitPrice ? null : `${id}: ${x?.quantity ?? "—"} / ${y?.quantity ?? "—"}`; }).filter(Boolean) : [];
const result = { storageKeys, seconds, ...stats, steps: log.length, failed: log.filter((l) => !l.ok).map((l) => `${l.step}: ${l.err}`), modulesManager: mp?.modules.length ?? 0, modulesRef: ref.modules.length, partDiffs, priceRef: er.retail, priceManager: em?.retail ?? null, lineDiff, report, pageErrors };
writeFileSync(join(out, "manager-result.json"), JSON.stringify({ ...result, log }, null, 1));
console.log(JSON.stringify(result, null, 1));
