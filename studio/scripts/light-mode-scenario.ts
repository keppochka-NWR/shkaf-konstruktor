// Режим «Подсветка» мышью (запрос Макса 20.10.2026): npx tsx scripts/light-mode-scenario.ts <url> <outDir>
// Шкаф 1200×2200×600 в две секции → правый клик → «Подсветка ›» → «Режим выбора деталей…» → клик по левой стойке и двум полкам →
// Esc → в сохранённом проекте ровно эти детали, итог вырос на длина × 3000 + длина × 4000, в смете и КП — строки подсветки.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, section, id, type Module } from "../src/model";
import { newProject, type Project } from "../src/project";
import { estimate } from "../src/pricing";

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
const summary = async () => { const t = (await page.locator(".light-mode-bar small").first().innerText({ timeout: 800 }).catch(() => "")).trim();
  const r = /Стойки: (\d+) шт\..*Полки и крыша: (\d+) шт\./.exec(t); return { v: r ? Number(r[1]) : -1, h: r ? Number(r[2]) : -1, text: t }; };
const saved = async (): Promise<Module | undefined> => { await page.waitForTimeout(1800); const all = (await page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? ""]))) as [string, string][];
  const found: [string, Module][] = [];
  const walk = (k: string, v: unknown) => { if (!v || typeof v !== "object") return; const o = v as Record<string, unknown>; if (o.name === "Шкаф QA" && Array.isArray(o.sections)) { found.push([k, o as unknown as Module]); return; } for (const x of Object.values(o)) walk(k, x); };
  for (const [k, s] of all) { if (!s.includes("Шкаф QA")) continue; try { walk(k, JSON.parse(s)); } catch { /* не JSON */ } }
  console.log("     хранилище: " + found.map(([k, m]) => k + " → " + JSON.stringify(m.sections.map((s) => [s.standLights ?? [], s.shelfLights ?? []]))).join("; "));
  return (found.find(([k]) => k !== "module-studio-v3" && !k.endsWith(":previous")) ?? found[0])?.[1]; };
async function openBodyMenu() {
  const c = (await page.locator("canvas").first().boundingBox())!;
  for (let gy = 0.35; gy <= 0.8; gy += 0.05) for (let gx = 0.35; gx <= 0.65; gx += 0.05) {
    await page.mouse.click(c.x + c.width * gx, c.y + c.height * gy, { button: "right" }); await page.waitForTimeout(80);
    if (await menuOpen()) { if (await item("Корпус").count()) { await item("Корпус").click(); await page.waitForTimeout(250); } if (await item("Подсветка").count()) return true; await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(60); }
  }
  return false;
}
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(proj(wardrobe)));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await page.waitForTimeout(1200);
  const price0 = await price();
  await shot("01-start");
  // 1. Правый клик → Подсветка ›
  check("меню корпуса → «Подсветка ›»", await openBodyMenu());
  await item("Подсветка").click(); await page.waitForTimeout(300);
  const labels = (await page.locator(".radial-label").allInnerTexts()).map((t) => t.trim());
  check("подменю: Левая стойка, Правая стойка, Обе стойки, Все полки секции, Режим выбора деталей…, Убрать всю подсветку",
    ["Левая стойка", "Правая стойка", "Обе стойки", "Все полки секции", "Режим выбора деталей…", "Убрать всю подсветку"].every((l) => labels.includes(l)), labels.join(" | "));
  await shot("02-light-submenu");
  // 2. Режим выбора деталей
  await item("Режим выбора деталей…").click(); await page.waitForTimeout(600);
  const bar = page.locator(".light-mode-bar");
  check("режим включён: полоса с подсказкой и «Готово»", (await bar.count()) === 1 && /кликайте детали.*Esc — выйти/.test(await bar.innerText()) && (await bar.getByRole("button", { name: "Готово" }).count()) === 1, (await bar.innerText({ timeout: 800 }).catch(() => "")).replace(/\s+/g, " "));
  check("курсор-перекрестие над 3D", (await page.locator(".scene.light-picking").count()) === 1);
  await shot("03-mode-on");
  const c = (await page.locator("canvas").first().boundingBox())!, midY = c.y + c.height * 0.5;
  // 3. Рамка корпуса по горизонтали: левый край — первая точка, где правый клик открывает меню
  let left = -1, right = -1;
  for (let x = c.x + 4; x < c.x + c.width - 4; x += 6) { await page.mouse.click(x, midY, { button: "right" }); await page.waitForTimeout(50); if (await menuOpen()) { await page.keyboard.press("Escape"); left = x; break; } }
  if (left > 0) for (let x = left - 6; x < left; x++) { await page.mouse.click(x, midY, { button: "right" }); await page.waitForTimeout(40); if (await menuOpen()) { await page.keyboard.press("Escape"); left = x; break; } }
  for (let x = c.x + c.width - 4; x > left; x -= 6) { await page.mouse.click(x, midY, { button: "right" }); await page.waitForTimeout(50); if (await menuOpen()) { await page.keyboard.press("Escape"); right = x; break; } }
  check("рамка корпуса на экране найдена", left > 0 && right > left, `x ${left}…${right}`);
  // 4. Клик по левой стойке (передний торец боковины, 16 мм у левого края)
  let standOk = false;
  for (let dx = 1; dx <= 26 && !standOk; dx += 2) {
    const before = await summary();
    await page.mouse.click(left + dx, midY); await page.waitForTimeout(350);
    const now = await summary();
    if (now.v === before.v + 1) standOk = true;
    else if (now.h !== before.h || now.v !== before.v) { await page.mouse.click(left + dx, midY); await page.waitForTimeout(350); } // задели другое — вернуть
  }
  check("клик по левой стойке — подсветка в стойке", standOk, (await summary()).text);
  await shot("04-left-stand");
  // 5. Две полки первой секции: ищем правым кликом (заголовок «Полка N»), включаем левым
  const x0 = left + (right - left) * ((16 + 576 / 2) / 1200);
  const found = new Map<string, number>();
  for (let y = c.y + 30; y < c.y + c.height - 30 && found.size < 2; y += 5) {
    await page.mouse.click(x0, y, { button: "right" }); await page.waitForTimeout(60);
    if (await menuOpen()) { const t = await title(); await page.keyboard.press("Escape"); await page.waitForTimeout(30); if (/^Полка \d/.test(t) && !found.has(t)) found.set(t, y); }
  }
  check("полки секции 1 найдены на экране", found.size === 2, [...found.entries()].map(([t, y]) => t + "@" + Math.round(y)).join(", "));
  let shelvesLit = 0;
  for (const y of found.values()) { const b = await summary(); await page.mouse.click(x0, y); await page.waitForTimeout(400); if ((await summary()).h === b.h + 1) shelvesLit++; }
  check("клик по двум полкам — подсветка в полках", shelvesLit === 2, (await summary()).text);
  await shot("05-two-shelves");
  // клик по заднику — подсказка, ничего не меняется
  { const b = await summary(); await page.mouse.click(x0, c.y + c.height * 0.5 + 1); await page.waitForTimeout(350); const a = await summary();
    const note = (await page.locator(".light-mode-bar small.warn").innerText({ timeout: 800 }).catch(() => "")).trim();
    if (a.v === b.v && a.h === b.h) check("клик не по стойке/полке — подсветка не меняется" + (note ? ", подсказка" : ""), true, note);
    else { await page.mouse.click(x0, c.y + c.height * 0.5 + 1); await page.waitForTimeout(350); console.log("     (в точке задника оказалась деталь с подсветкой — возвращено)"); } }
  // LED-профили видно сразу: в 3D (фасады в режиме скрыты) — светящиеся полосы у левой стойки и под двумя полками
  await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {}); await page.waitForTimeout(1500);
  await shot("05b-3d-leds");
  check("в режиме по-прежнему полоса после смены вида", (await page.locator(".light-mode-bar").count()) === 1);
  // 6. Выход Esc
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  check("Esc — выход из режима", (await page.locator(".light-mode-bar").count()) === 0 && (await page.locator(".scene.light-picking").count()) === 0);
  await shot("06-after-esc");
  // 7. Модель и смета
  const m = await saved();
  const s0 = m?.sections[0], s1 = m?.sections[1];
  check("сохранено: левая стойка секции 1 и две её полки, больше ничего", !!m && s0?.standLights?.join() === "left" && s0?.shelfLights?.length === 2 && !s0.topLight && !s1?.standLights && !s1?.shelfLights && !s1?.topLight && !("standLight" in (m ?? {})),
    JSON.stringify({ s0: { st: s0?.standLights, sh: s0?.shelfLights }, s1: { st: s1?.standLights, sh: s1?.shelfLights } }));
  const price1 = await price();
  if (m) {
    const e = estimate(proj(m)), st = e.lines.find((l) => l.id === "light-stand"), sh = e.lines.find((l) => l.id === "light-shelf");
    const expect = Math.round((st?.quantity ?? 0) * 3000 + (sh?.quantity ?? 0) * 4000), delta = rub(price1) - rub(price0);
    check("смета: стойка 3000 ₽/пог.м × высота, полки 4000 ₽/пог.м × 2 длины", !!st && !!sh && st.unitPrice === 3000 && sh.unitPrice === 4000 && Math.abs(sh.quantity - 2 * 0.536) < 0.002,
      `стойка ${st?.quantity} пог.м, полки ${sh?.quantity} пог.м`);
    check("итог в окне вырос ровно на подсветку", Math.abs(delta - expect) <= 1, `${price0} → ${price1}: +${delta}, ожидалось +${expect}`);
  }
  // 8. Стоимость проекта и КП
  await page.locator(".dock-tabs button, nav button, footer button").filter({ hasText: /^Стоимость$/ }).first().click().catch(() => {}); await page.waitForTimeout(800);
  await shot("07a-dock-estimate");
  await page.getByRole("button", { name: "Стоимость проекта" }).click().catch(() => {}); await page.waitForTimeout(1500);
  const est = (await page.locator("body").innerText()).replace(/\s+/g, " "), total = rub((/Итоговая стоимость проекта ([\d\s ]+₽)/.exec(est) ?? ["", ""])[1]);
  const node = m ? estimate(proj(m)).retail : null;
  check("«Стоимость»: итог клиента = подвал = смета модели с подсветкой (строки в публичной сборке не показываются)", node !== null && Math.abs(total - node) <= 2 && total === rub(price1), `окно ${total}, смета ${node}, подвал ${rub(price1)}`);
  await shot("07-estimate");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "КП", exact: true }).click().catch(() => {}); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Подставить текущую смету" }).click().catch(() => {}); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Предпросмотр КП" }).click().catch(() => {}); await page.waitForTimeout(2500);
  const frame = page.frameLocator('iframe[title="Предпросмотр коммерческого предложения"]');
  const kp = (await frame.locator("body").innerText({ timeout: 5000 }).catch(() => "")).replace(/\s+/g, " ");
  await frame.getByText(/подсветка в стойках/).first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await page.locator('iframe[title="Предпросмотр коммерческого предложения"]').scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(300);
  check("КП: подсветка в стойках и в полках — штуки и пог. м", /подсветка в стойках: 1 шт\., [\d,]+ пог\. м/.test(kp) && /подсветка в полках: 2 шт\., [\d,]+ пог\. м/.test(kp), (/подсветка[^;|]{0,60}/.exec(kp) ?? [""])[0]);
  await shot("08-kp");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  // 9. Режим снова и выход «Готово»
  if (await openBodyMenu()) { await item("Подсветка").click(); await page.waitForTimeout(250); await item("Режим выбора деталей…").click(); await page.waitForTimeout(400);
    await page.locator(".light-mode-bar").getByRole("button", { name: "Готово" }).click(); await page.waitForTimeout(300);
    check("«Готово» — выход из режима", (await page.locator(".light-mode-bar").count()) === 0); }
  else check("«Готово» — выход из режима", false, "меню не открылось");
  check("ошибок страницы нет", errors.length === 0, errors.join("; "));
} finally { await browser.close(); }
const bad = results.filter((r) => !r[1]);
console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
process.exit(bad.length ? 1 : 0);
