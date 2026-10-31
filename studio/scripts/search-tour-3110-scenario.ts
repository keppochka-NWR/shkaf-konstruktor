// Поиск по параметрам и микро-обучение (Макс 31.10.2026) клавиатурой и мышью, как менеджер:
//   npx tsx scripts/search-tour-3110-scenario.ts "<url ?project=sketch-3010-shkaf-600&fresh=1>" <outDir вне studio/>
//  1. Сценарий (navigator.webdriver) — обучение само не предлагается.
//  2. Ctrl+K → «петли» → Enter: этап «Мебель», поле «Петли корпуса» видно, в фокусе и подсвечено.
//  3. Ctrl+K → «форма комнаты» → Enter: этап «Помещение», панель «Форма комнаты» подсвечена.
//  4. «/» → «стоимость» → Enter: открыта панель стоимости внизу, итог подсвечен.
//  5. «полку» — первым «Полки»; Esc закрывает поиск без перехода. Без выбранного шкафа — подсказка «Выберите шкаф».
//  6. «обучение» → тур: все шаги «Далее» до «Готово», тур закрыт; повтор из «Как пользоваться», Esc закрывает.
//  7. ?tour=1 — предложение обучения видно; «Не сейчас» — больше не предлагается.
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: boolean[] = [];
const check = (name: string, ok: boolean, info = "") => { results.push(ok); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let shot = 0;
const snap = (name: string, p: Page = page) => p.screenshot({ path: `${out}/${String(++shot).padStart(2, "0")}-${name}.png` });
const palette = page.locator("[data-testid=param-search]");
const stage = () => page.locator(".app").first().getAttribute("data-stage");
/** Цель подсвечена: у неё data-search-hit, рамка подсветки на экране поверх неё, цель видна в окне. */
const highlighted = (sel: string) => page.evaluate((sel) => {
  const el = document.querySelector<HTMLElement>(sel), ring = document.querySelector<HTMLElement>(".search-pulse");
  if (!el || !ring) return { ok: false, why: !el ? "нет цели" : "нет подсветки" };
  const a = el.getBoundingClientRect(), b = ring.getBoundingClientRect();
  const inView = a.top >= 0 && a.bottom <= innerHeight && a.width > 0;
  const covers = b.left <= a.left && b.top <= a.top && b.right >= a.right && b.bottom >= a.bottom;
  return { ok: el.hasAttribute("data-search-hit") && inView && covers, why: `hit=${el.hasAttribute("data-search-hit")} inView=${inView} covers=${covers}` };
}, sel);
async function find(q: string, open: "ctrl" | "slash" = "ctrl") {
  if (open === "ctrl") await page.keyboard.press("Control+KeyK"); else { await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); await page.keyboard.press("/"); }
  await palette.waitFor();
  await page.keyboard.type(q, { delay: 15 });
  await page.waitForTimeout(150);
}
const firstItem = () => palette.locator("[role=option]").first().getAttribute("data-item");

await page.goto(url);
await page.locator("[data-testid=scene] canvas").first().waitFor({ timeout: 20000 });
await page.waitForTimeout(2600);
check("сценарий: обучение само не предлагается", (await page.locator("[data-testid=tour-offer], [data-testid=studio-tour]").count()) === 0);
check("кнопка поиска в шапке", await page.getByRole("button", { name: "Поиск по параметрам" }).isVisible());
await snap("start");

// 2. петли
await find("петли");
check("«петли» — первым «Петли»", (await firstItem()) === "hinges", String(await firstItem()));
await snap("search-petli");
await page.keyboard.press("Enter");
await page.waitForTimeout(350);
check("поиск закрылся", (await palette.count()) === 0);
check("этап «Построение мебели»", (await stage()) === "bodies", String(await stage()));
const hinge = page.locator('select[aria-label="Петли корпуса"]');
check("поле «Петли корпуса» видно", await hinge.isVisible());
check("поле «Петли корпуса» в фокусе", await hinge.evaluate((el) => el === document.activeElement));
const h1 = await highlighted('select[aria-label="Петли корпуса"]');
check("поле «Петли корпуса» подсвечено", h1.ok, h1.why);
await snap("hinges-highlight");
await page.waitForTimeout(1800);
check("подсветка гаснет ~1,5 с", (await page.locator(".search-pulse").count()) === 0 && !(await hinge.evaluate((el) => el.hasAttribute("data-search-hit"))));

// 3. форма комнаты
await find("форма комнаты");
check("«форма комнаты» — первой «Форма комнаты»", (await firstItem()) === "room-shape", String(await firstItem()));
await page.keyboard.press("Enter");
await page.waitForTimeout(350);
check("этап «Помещение»", (await stage()) === "room", String(await stage()));
check("панель «Форма комнаты» видна", await page.locator("[data-testid=room-shape-panel]").isVisible());
const h2 = await highlighted("[data-testid=room-shape-panel]");
check("панель «Форма комнаты» подсвечена", h2.ok, h2.why);
await snap("room-shape");

// 4. стоимость через «/»
await page.waitForTimeout(1700);
await find("стоимость", "slash");
check("«/» открывает поиск, «стоимость» — первой «Стоимость проекта»", (await firstItem()) === "price", String(await firstItem()));
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
check("панель стоимости открыта", await page.locator(".dock-estimate").isVisible());
const h3 = await highlighted(".dock-estimate .dock-sum.total");
check("итоговая стоимость подсвечена", h3.ok, h3.why);
await snap("price");

// 5. формы слов, Esc, нет выбранного шкафа
await page.waitForTimeout(1700);
await find("полку");
check("«полку» — первыми «Полки»", (await firstItem()) === "shelves", String(await firstItem()));
const before = await stage();
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
check("Esc закрывает поиск, этап тот же", (await palette.count()) === 0 && (await stage()) === before);
// снять выделение: этап мебели, Esc по шагам до «Ничего не выбрано»
await page.locator('[data-tour="stages"] button[aria-label="Построение мебели"]').click();
await page.waitForTimeout(300);
for (let i = 0; i < 4 && !(await page.locator("[data-testid=nothing-selected]").count()); i++) { await page.locator("[data-testid=scene] canvas").first().hover({ position: { x: 20, y: 20 } }); await page.keyboard.press("Escape"); await page.waitForTimeout(120); }
const nothing = (await page.locator("[data-testid=nothing-selected]").count()) > 0;
await find("петли");
const hint = await palette.locator('[data-item="hinges"] small').textContent();
check("без выбранного шкафа — «Выберите шкаф»", !nothing || /Выберите шкаф/.test(hint ?? ""), `nothing=${nothing} · ${hint}`);
await page.keyboard.press("Enter");
await page.waitForTimeout(350);
check("Enter — выбран шкаф, петли видны", await hinge.isVisible());
await page.waitForTimeout(1700);

// 5б. функция только правой кнопкой (ревизия структуры 31.10): «поставить к стене» — открыто круговое меню, пункт подсвечен
await find("поставить к стене");
check("«поставить к стене» — первым пункт меню ПКМ", (await firstItem()) === "radial-wall", String(await firstItem()));
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
const hitText = await page.locator(".radial-menu [data-search-hit]").textContent().catch(() => "");
const h4 = await highlighted(".radial-menu [data-search-hit]");
check("круговое меню открыто, «Поставить к стене» подсвечен", /Поставить к стене/.test(hitText ?? "") && h4.ok, `${hitText} · ${h4.why}`);
await snap("radial-wall");
await page.keyboard.press("Escape");
await page.waitForTimeout(1700);
check("Esc закрывает меню", (await page.locator(".radial-menu").count()) === 0);

// 6. обучение
await find("обучение");
check("«обучение» — первым тур", (await firstItem()) === "tour", String(await firstItem()));
await page.keyboard.press("Enter");
const tour = page.locator("[data-testid=studio-tour]");
await tour.waitFor();
const seen: string[] = [];
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(450);
  const id = await tour.getAttribute("data-step");
  if (id && seen.at(-1) !== id) seen.push(id);
  if (seen.length === 2 || id === "radial" || id === "search") await snap("tour-" + id);
  const spot = await page.locator(".tour-spot").count();
  if (!spot) console.log("     шаг без окна:", id);
  const next = tour.getByRole("button", { name: /^(Далее|Готово)$/ });
  const last = (await next.textContent()) === "Готово";
  await next.click();
  if (last) break;
}
await page.waitForTimeout(300);
check("тур прошёл все шаги", seen.length >= 6 && seen[0] === "stages" && seen.at(-1) === "search", seen.join(" → "));
check("тур закрыт после «Готово»", (await tour.count()) === 0);
// панель стоимости из шага 4 закрывает левый низ — свернуть её вкладкой «Проект»
await page.locator('[aria-label="Навигация по проекту"] button', { hasText: "Проект" }).first().click();
await page.getByRole("button", { name: "Как пользоваться" }).click();
await page.getByRole("button", { name: /Пройти обучение/ }).click();
await tour.waitFor();
check("повтор из «Как пользоваться»", (await tour.getAttribute("data-step")) === "stages");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
check("Esc закрывает тур", (await tour.count()) === 0);

// 7. предложение обучения (?tour=1 — принудительно, в сценарии иначе не показывается)
const p2 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
p2.on("pageerror", (e) => errors.push(e.message));
await p2.goto(url.replace(/fresh=1/, "tour=1"));
await p2.locator("[data-testid=tour-offer]").waitFor({ timeout: 20000 });
await snap("tour-offer", p2);
await p2.getByRole("button", { name: "Не сейчас" }).click();
check("«Не сейчас» — флаг сохранён", (await p2.evaluate(() => localStorage.getItem("studio-tour-v1"))) === "1");
await p2.close();

check("ошибок страницы нет", !errors.length, errors.join(" | "));
await browser.close();
const fails = results.filter((r) => !r).length;
console.log(fails ? `ИТОГ: провалов ${fails}` : "ИТОГ: всё прошло");
process.exit(fails ? 1 : 0);
