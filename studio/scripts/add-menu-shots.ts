// Проверка меню «Добавить» корпуса в браузере: npx tsx scripts/add-menu-shots.ts <url> <outDir>
// Шкаф 1200×2200×600 в две секции → правый клик → «Добавить» → «Наполнение ›» / «Улучшения ›»: снимки колец, наложения,
// подсветка вкл/выкл (поле standLight в сохранённом проекте и цена), стеклянная полка, корзина Лемана. Затем кухонный низ — без подменю.
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, section, id, type Module } from "../src/model";
import { kitchenBase } from "../src/kitchen";
import { newProject, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const proj = (m: Module): Project => { const p = newProject({ ...initialModule(), sections: [section()] }); p.modules = [{ id: id(), x: 1000, y: 0, z: 3, rotation: 0, module: m }]; return p; };
const wardrobe: Module = { ...initialModule(), name: "Шкаф QA", width: 1200, height: 2200, depth: 600, doors: true, sections: [section(), section()] };
const kitchen: Module = { ...kitchenBase(initialModule(), 600), name: "Кухня QA" };
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let problems = 0;
const fail = (msg: string) => { problems++; console.log("  ✗ " + msg); };
const ok = (msg: string) => console.log("  ✓ " + msg);
const OVERLAP = `(() => { const els = [...document.querySelectorAll(".radial-label, .radial-item")].map(e => [e, e.getBoundingClientRect()]); const bad = [];
  for (let i = 0; i < els.length; i++) { const [e, r] = els[i]; if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) bad.push("за окном: " + e.textContent);
    for (let j = i + 1; j < els.length; j++) { const [f, q] = els[j]; if (e.contains(f) || f.contains(e)) continue;
      const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left), iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (ix > 2 && iy > 2) bad.push("налезают: «" + e.textContent.trim() + "» и «" + f.textContent.trim() + "»"); } }
  return bad; })()`;
async function load(p: Project) {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); }, JSON.stringify(p));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
}
// Проект клиента лежит под module-studio-v3 или module-studio-v3:<ключ> — берём тот, где наш шкаф, после записи (с запасом по времени).
let keysShown = false;
// Комната в рабочем месте пишется своим хранилищем (не module-studio-v3): ищем модуль «Шкаф QA» во всех записях, кроме исходной.
const saved = async (): Promise<Project> => { await page.waitForTimeout(1800); const all = (await page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? ""]))) as [string, string][];
  if (!keysShown) { keysShown = true; console.log("  ключи хранилища:", all.map(([k]) => k).join(", ")); }
  const found: [string, Module][] = [];
  const walk = (k: string, v: unknown) => { if (!v || typeof v !== "object") return; const o = v as Record<string, unknown>; if (o.name === "Шкаф QA" && Array.isArray(o.sections)) { found.push([k, o as unknown as Module]); return; } for (const x of Object.values(o)) walk(k, x); };
  for (const [k, s] of all) { if (!s.includes("Шкаф QA")) continue; try { walk(k, JSON.parse(s)); } catch { /* не JSON */ } }
  const m = (found.find(([k]) => k !== "module-studio-v3") ?? found[0])?.[1];
  return m ? ({ modules: [{ module: m }] } as unknown as Project) : ({} as Project); };
const price = async () => (await page.locator(".dock-price").innerText().catch(() => "")).replace(/\s+/g, " ");
async function openOn(title: string) {
  const c = (await page.locator("canvas").first().boundingBox())!;
  for (let gy = 0.3; gy <= 0.8; gy += 0.05) for (let gx = 0.3; gx <= 0.7; gx += 0.05) {
    await page.mouse.click(c.x + c.width * gx, c.y + c.height * gy, { button: "right" }); await page.waitForTimeout(80);
    if (await page.locator(".radial-menu").count()) {
      const t = (await page.locator(".radial-center b").first().innerText().catch(() => "")).trim();
      if (t.startsWith(title)) return true;
      await page.keyboard.press("Escape"); await page.waitForTimeout(80);
    }
  }
  return false;
}
const item = (label: string) => page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: new RegExp("^" + label + "( ›)?$") }) }).first();
async function ring(name: string, shot?: string) {
  await page.waitForTimeout(400);
  const bad = (await page.evaluate(OVERLAP)) as string[];
  const labels = (await page.locator(".radial-label").allInnerTexts()).map((t) => t.trim());
  console.log("кольцо " + name + ": " + labels.join(", "));
  if (bad.length) fail(name + ": " + bad.join("; ")); else ok(name + " — без наложений и в окне");
  if (shot) await page.screenshot({ path: `${out}/${shot}.png` });
}
async function path(...labels: string[]) {
  if (!(await openOn("Шкаф QA"))) { fail("меню корпуса не открылось"); return false; }
  for (const l of labels) { const b = item(l); if (!(await b.count())) { fail("нет пункта «" + l + "»"); await page.keyboard.press("Escape"); return false; } await b.click(); await page.waitForTimeout(250); }
  return true;
}

const proj0 = proj(wardrobe);
await load(proj0);
console.log("шкаф, цена до:", await price());
if (await path("Добавить")) await ring("Добавить", "01-dobavit");
await item("В секцию").click(); await ring("В секцию", "02-napolnenie");
await item("Вешалки").click(); await ring("Вешалки", "02b-veshalki"); await page.keyboard.press("Escape"); await page.waitForTimeout(200);
await item("Сетку").hover(); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/03-hint-setka.png` });
await item("Сетку").click(); await ring("Сетку");
await item("Корзина").click(); await ring("Корзина", "04-korzina");
await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
if (await path("Добавить", "Улучшения")) { await ring("Улучшения"); await item("Подсветку").hover(); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/05-uluchsheniya-hint.png` }); await item("Подсветку").click(); await page.waitForTimeout(900); }
let p = await saved(), before = await price();
if (p.modules?.[0]?.module.standLight === true) ok("подсветка включилась (standLight), цена: " + before); else fail("подсветка не включилась");
if (await path("Добавить", "Улучшения")) { await ring("Улучшения после включения", "06-ubrat-podsvetku"); await item("Убрать подсветку").click(); await page.waitForTimeout(900); }
await page.waitForTimeout(600); const after = await price();
if (await path("Добавить", "Улучшения")) { const back = await item("Подсветку").count(); await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  if (back && after !== before) ok("подсветка снята: пункт снова «Подсветку», цена " + before + " → " + after); else fail("подсветка не снялась: пункт " + back + ", цена " + before + " → " + after); }
if (await path("Добавить", "В секцию", "Стекло")) await page.waitForTimeout(900);
const glassPrice = await price();
if (/уточняется/i.test(glassPrice)) ok("стеклянная полка встала: в итоге «" + glassPrice + "» — у стекла в смете цена не задана (как у галочки панели)"); else fail("стеклянная полка: итог " + glassPrice);
await page.screenshot({ path: `${out}/07-glass-shelf.png` });
if (await path("Добавить", "В секцию", "Сетку", "Корзина", "Корзина Титан-GS 430 · h185")) await page.waitForTimeout(900);
p = await saved();
const mesh = p.modules?.[0]?.module.sections.some((s) => s.drawerConfigs?.some((d) => d.mesh));
const alert = (await page.locator('[role="alert"]').allInnerTexts()).join(" ").trim();
if (mesh) ok("корзина Лемана в секции"); else if (alert) ok("корзина не встала, понятное сообщение: " + alert.slice(0, 160)); else fail("корзина: ни детали, ни сообщения");
await page.screenshot({ path: `${out}/08-korzina.png` });

await load(proj(kitchen));
if (await openOn("Кухня QA")) {
  const b = item("Добавить"), pop = await b.getAttribute("aria-haspopup"), label = await b.getAttribute("aria-label");
  if (!pop && /панели справа/.test(label ?? "")) ok("кухня: «Добавить» без подменю — ведёт в панель"); else fail("кухня: у «Добавить» подменю " + pop + " / " + label);
  await page.screenshot({ path: `${out}/09-kitchen.png` });
} else fail("меню кухни не открылось");
await browser.close();
console.log(problems ? "ПРОБЛЕМ: " + problems : "ВСЁ В ПОРЯДКЕ");
process.exit(problems ? 1 : 0);
