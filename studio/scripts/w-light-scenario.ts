// Задачи 14 и 20 мышью (менеджеры 22.10.2026): npx tsx scripts/w-light-scenario.ts <url> <outDir>
// Шкаф 1200 в две секции → ПКМ «Подсветка › Режим выбора деталей…» → «Ставить: Вертикаль» → клик по левой стойке; «Горизонталь» → две
// полки (и проверка: в «горизонтали» клик по стойке ничего не ставит); «Тон: Тёплый» → снимок 3D (свечение видно); «Список…» — окно
// «Подсветка»: детали с ориентацией и длинами, «Убрать»; ПКМ «Подсветка › Настроить…»; пересечений нет («Габариты проверены»);
// смета — строки с описанием «тёплый 3000K», цена 3000/4000 за пог. м.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, section, id, type Module } from "../src/model";
import { newProject, type Project } from "../src/project";
import { estimate } from "../src/pricing";
import { partCollisions } from "../src/collisions";
import { parts } from "../src/model";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const proj = (m: Module): Project => { const p = newProject({ ...initialModule(), sections: [section()] }); p.modules = [{ id: id(), x: 1000, y: 0, z: 3, rotation: 0, module: m }]; return p; };
const wardrobe: Module = { ...initialModule(), name: "Шкаф QA", width: 1200, height: 2200, depth: 600, doors: true, sections: [section(), section()] };
wardrobe.sections[0].shelves = [0.3, 0.6]; wardrobe.sections[1].shelves = [0.5];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/${n}.png` });
const item = (label: string) => page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( ›)?$") }) }).first();
const title = async () => (await page.locator(".radial-center b").first().innerText({ timeout: 800 }).catch(() => "")).trim();
const menuOpen = async () => (await page.locator(".radial-menu").count()) > 0;
const price = async () => (await page.locator(".dock-price").innerText({ timeout: 800 }).catch(() => "")).replace(/\s+/g, " ");
const rub = (s: string) => Number((/(\d[\d\s ]*)\s*₽/.exec(s)?.[1] ?? "").replace(/\D/g, "")) || NaN;
const bar = () => page.locator(".light-mode-bar");
const summary = async () => { const t = (await bar().locator("small").first().innerText({ timeout: 800 }).catch(() => "")).trim();
  const r = /Стойки: (\d+) шт\..*Полки и крыша: (\d+) шт\./.exec(t); return { v: r ? Number(r[1]) : -1, h: r ? Number(r[2]) : -1, text: t }; };
const saved = async (): Promise<Module | undefined> => { await page.waitForTimeout(1800); const all = (await page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? ""]))) as [string, string][];
  const found: [string, Module][] = [];
  const walk = (k: string, v: unknown) => { if (!v || typeof v !== "object") return; const o = v as Record<string, unknown>; if (o.name === "Шкаф QA" && Array.isArray(o.sections)) { found.push([k, o as unknown as Module]); return; } for (const x of Object.values(o)) walk(k, x); };
  for (const [k, s] of all) { if (!s.includes("Шкаф QA")) continue; try { walk(k, JSON.parse(s)); } catch { /* не JSON */ } }
  return (found.find(([k]) => k !== "module-studio-v3" && !k.endsWith(":previous")) ?? found[0])?.[1]; };
async function openBodyMenu() {
  const c = (await page.locator("canvas").first().boundingBox())!;
  for (let gy = 0.35; gy <= 0.8; gy += 0.05) for (let gx = 0.35; gx <= 0.65; gx += 0.05) {
    await page.mouse.click(c.x + c.width * gx, c.y + c.height * gy, { button: "right" }); await page.waitForTimeout(80);
    if (await menuOpen()) { if (await item("Корпус").count()) { await item("Корпус").click(); await page.waitForTimeout(250); } if (await item("Подсветка").count()) return true; await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(60); }
  }
  return false;
}
const chip = (group: string, label: string) => bar().getByRole("group", { name: group }).getByRole("button", { name: new RegExp(label) });
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(proj(wardrobe)));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await page.waitForTimeout(1200);
  const price0 = await price();
  await shot("01-start");
  // 1. ПКМ → Подсветка › → Режим выбора деталей…
  check("ПКМ по корпусу → «Подсветка ›»", await openBodyMenu());
  await item("Подсветка").click(); await page.waitForTimeout(300);
  const labels = (await page.locator(".radial-label").allInnerTexts()).map((t) => t.trim());
  check("подменю: «Режим выбора деталей…» и «Настроить…»", labels.includes("Режим выбора деталей…") && labels.includes("Настроить…"), labels.join(" | "));
  await shot("02-light-submenu");
  await item("Режим выбора деталей…").click(); await page.waitForTimeout(600);
  check("режим включён: полоса «Ставить: Вертикаль / Горизонталь / Обе» и «Тон»", (await bar().count()) === 1 && (await bar().getByRole("group", { name: "Ставить подсветку" }).getByRole("button").count()) === 3 && (await bar().getByRole("group", { name: "Тон подсветки модуля" }).getByRole("button").count()) === 3);
  // 2. «Вертикаль» → левая стойка
  await chip("Ставить подсветку", "^Вертикаль$").click(); await page.waitForTimeout(200);
  check("«Вертикаль» нажата", (await chip("Ставить подсветку", "^Вертикаль$").getAttribute("aria-pressed")) === "true");
  await shot("03-mode-vertical");
  const c = (await page.locator("canvas").first().boundingBox())!, midY = c.y + c.height * 0.5;
  let left = -1, right = -1;
  for (let x = c.x + 4; x < c.x + c.width - 4; x += 6) { await page.mouse.click(x, midY, { button: "right" }); await page.waitForTimeout(50); if (await menuOpen()) { await page.keyboard.press("Escape"); left = x; break; } }
  if (left > 0) for (let x = left - 6; x < left; x++) { await page.mouse.click(x, midY, { button: "right" }); await page.waitForTimeout(40); if (await menuOpen()) { await page.keyboard.press("Escape"); left = x; break; } }
  for (let x = c.x + c.width - 4; x > left; x -= 6) { await page.mouse.click(x, midY, { button: "right" }); await page.waitForTimeout(50); if (await menuOpen()) { await page.keyboard.press("Escape"); right = x; break; } }
  check("рамка корпуса на экране найдена", left > 0 && right > left, `x ${left}…${right}`);
  let standX = -1;
  for (let dx = 1; dx <= 26 && standX < 0; dx += 2) {
    const before = await summary();
    await page.mouse.click(left + dx, midY); await page.waitForTimeout(350);
    const now = await summary();
    if (now.v === before.v + 1 && now.h === before.h) standX = left + dx;
    else if (now.h !== before.h || now.v !== before.v) { await page.mouse.click(left + dx, midY); await page.waitForTimeout(350); }
  }
  check("«Вертикаль»: клик по левой стойке — LED в стойке", standX > 0, (await summary()).text);
  await shot("04-left-stand");
  // полки секции 1 — ищем правым кликом (заголовок «Полка N»)
  const x0 = left + (right - left) * ((16 + 576 / 2) / 1200);
  const found = new Map<string, number>();
  for (let y = c.y + 30; y < c.y + c.height - 30 && found.size < 2; y += 5) {
    await page.mouse.click(x0, y, { button: "right" }); await page.waitForTimeout(60);
    if (await menuOpen()) { const t = await title(); await page.keyboard.press("Escape"); await page.waitForTimeout(30); if (/^Полка \d/.test(t) && !found.has(t)) found.set(t, y); }
  }
  check("полки секции 1 найдены на экране", found.size === 2, [...found.entries()].map(([t, y]) => t + "@" + Math.round(y)).join(", "));
  // в «вертикали» клик по полке ничего не ставит — подсказка
  { const b = await summary(); await page.mouse.click(x0, [...found.values()][0]); await page.waitForTimeout(350); const a = await summary();
    const note = (await bar().locator("small.warn").innerText({ timeout: 800 }).catch(() => "")).trim();
    check("«Вертикаль»: клик по полке не ставит горизонталь, подсказка", a.h === b.h && /горизонталь/i.test(note), note); }
  // 3. «Горизонталь» → две полки; клик по стойке не меняет
  await chip("Ставить подсветку", "^Горизонталь$").click(); await page.waitForTimeout(200);
  let shelvesLit = 0;
  for (const y of found.values()) { const b = await summary(); await page.mouse.click(x0, y); await page.waitForTimeout(400); const a = await summary(); if (a.h === b.h + 1 && a.v === b.v) shelvesLit++; }
  check("«Горизонталь»: клик по двум полкам — LED в полках", shelvesLit === 2, (await summary()).text);
  { const b = await summary(); await page.mouse.click(standX, midY); await page.waitForTimeout(350); const a = await summary();
    check("«Горизонталь»: клик по стойке не снимает и не ставит вертикаль", a.v === b.v && a.h === b.h, a.text); }
  await shot("05-two-shelves");
  // 4. Тон «Тёплый» → снимок 3D
  await chip("Тон подсветки модуля", "Тёплый").click(); await page.waitForTimeout(500);
  check("тон «Тёплый» нажат", (await chip("Тон подсветки модуля", "Тёплый").getAttribute("aria-pressed")) === "true");
  await shot("06-warm-front");
  await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {}); await page.waitForTimeout(1800);
  await shot("06b-warm-3d");
  // свет видно: в кадре есть тёплые светлые пиксели (свечение LED и засветка полок), на снимке до подсветки их нет
  const warm = await page.evaluate(() => { const cv = document.querySelector("canvas") as HTMLCanvasElement; const t = document.createElement("canvas"); t.width = cv.width; t.height = cv.height; const g = t.getContext("2d")!; g.drawImage(cv, 0, 0); const d = g.getImageData(0, 0, t.width, t.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) { const r = d[i], gg = d[i + 1], b = d[i + 2]; if (r > 200 && gg > 120 && b < gg - 45 && r - b > 80) n++; } return n; });
  check("3D: тёплое свечение видно (тёплые пиксели в кадре)", warm > 150, `${warm} тёплых пикселей (каждый 4-й)`);
  // 5. «Список…» — окно «Подсветка»
  await bar().getByRole("button", { name: "Список…" }).click(); await page.waitForTimeout(500);
  const dlg = page.getByRole("dialog", { name: "Подсветка" });
  const rows = async () => (await dlg.locator("tbody tr").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  const r1 = await rows();
  check("окно «Подсветка»: 3 детали — стойка (вертикаль) и 2 полки (горизонталь) с длинами", r1.length === 3 && /Левая стойка вертикаль \d{3,4}/.test(r1[0]) && r1.slice(1).every((r) => /Полка \d горизонталь \d{3}/.test(r)), r1.join(" | "));
  check("окно: тон модуля «Тёплый 3000K» выбран", (await dlg.getByRole("group", { name: "Тон подсветки модуля" }).getByRole("button", { name: /Тёплый 3000K/ }).getAttribute("aria-pressed")) === "true");
  await dlg.getByRole("group", { name: "Тип подсветки модуля" }).getByRole("button", { name: "Накладной профиль" }).click(); await page.waitForTimeout(300);
  await shot("07-light-panel");
  await dlg.getByRole("button", { name: /^Убрать: секция 1, Полка/ }).last().click(); await page.waitForTimeout(400);
  const r2 = await rows();
  check("«Убрать» у полки — в списке 2 детали", r2.length === 2, r2.join(" | "));
  await shot("08-light-panel-removed");
  await dlg.getByRole("button", { name: "Закрыть окно" }).click(); await page.waitForTimeout(300);
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  check("выход из режима", (await bar().count()) === 0);
  // 6. ПКМ «Подсветка › Настроить…»
  if (await openBodyMenu()) { await item("Подсветка").click(); await page.waitForTimeout(250); await item("Настроить…").click(); await page.waitForTimeout(500);
    check("ПКМ «Подсветка › Настроить…» открывает окно", (await page.getByRole("dialog", { name: "Подсветка" }).count()) === 1);
    await shot("09-setup-from-rmb");
    await page.getByRole("dialog", { name: "Подсветка" }).getByRole("button", { name: "Закрыть окно" }).click(); await page.waitForTimeout(300); }
  else check("ПКМ «Подсветка › Настроить…» открывает окно", false, "меню не открылось");
  // 7. Пересечений нет — панель «Габариты проверены»; модель и смета
  const foot = (await page.locator(".property-footer strong").first().innerText({ timeout: 1500 }).catch(() => "")).trim();
  check("панель: «Габариты проверены»", foot === "Габариты проверены", foot);
  await shot("10-checked");
  const m = await saved();
  const s0 = m?.sections[0];
  check("сохранено: левая стойка и 1 полка секции 1, тон 3000, тип накладной", !!m && s0?.standLights?.join() === "left" && s0?.shelfLights?.length === 1 && m.lightTone === 3000 && m.lightType === "surface", JSON.stringify({ tone: m?.lightTone, type: m?.lightType, st: s0?.standLights, sh: s0?.shelfLights }));
  if (m) {
    const coll = partCollisions(parts(m), m).filter((x) => /light/.test(x.a + x.b));
    check("пересечений LED с деталями нет (collisions.ts)", coll.length === 0, coll.map((x) => x.a + "×" + x.b).join("; "));
    const e = estimate(proj(m)), st = e.lines.find((l) => l.id.startsWith("light-stand")), sh = e.lines.find((l) => l.id.startsWith("light-shelf"));
    check("смета: «Подсветка в стойках · накладной профиль, тёплый 3000K» 3000 ₽, полка 4000 ₽", !!st && !!sh && st.unitPrice === 3000 && sh.unitPrice === 4000 && /накладной профиль, тёплый 3000K/.test(st.label) && /тёплый 3000K/.test(sh.label), `${st?.label} | ${sh?.label}`);
    const expect = Math.round((st?.quantity ?? 0) * 3000 + (sh?.quantity ?? 0) * 4000), delta = rub(await price()) - rub(price0);
    check("итог в окне вырос ровно на подсветку", Math.abs(delta - expect) <= 1, `+${delta}, ожидалось +${expect}`);
  }
  check("ошибок страницы нет", errors.length === 0, errors.join("; "));
} finally { await browser.close(); }
const bad = results.filter((r) => !r[1]);
console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
process.exit(bad.length ? 1 : 0);
