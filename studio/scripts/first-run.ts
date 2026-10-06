// Проход «как новичок»: npx tsx scripts/first-run.ts <url> <outDir> [width]
// Чистый браузер, без подсказок от разработчика: что видит человек на каждом шаге. Снимки 01..N и список видимых кнопок.
import { chromium, type Page } from "playwright";
const [url, out, wArg = "1440"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: Number(wArg), height: 900 } });
let n = 0;
async function shot(name: string, page: Page) {
  n++; await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${String(n).padStart(2, "0")}-${name}.png` });
  const modal = await page.locator(".modal h2").allInnerTexts();
  const err = (await page.locator("[role=alert]").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  console.log(`${n}. ${name}${modal.length ? " | окно: " + modal.join(", ") : ""}${err.length ? " | ошибка: " + err.join(" / ") : ""}`);
}
async function click(page: Page, name: string | RegExp) {
  const b = page.getByRole("button", { name }).filter({ visible: true }).first();
  if (!(await b.count())) { console.log("   нет кнопки:", String(name)); return false; }
  await b.click(); return true;
}
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.goto(url);
await page.waitForSelector(".app");
await shot("первый-запуск", page);
await click(page, /^Дальше/);
await shot("коммуникации", page);
await click(page, /^Дальше/);
await shot("корпуса", page);
await click(page, /Для одежды/);
await click(page, "Добавить в комнату");
await shot("добавлен-шкаф", page);
await click(page, /^Дальше/);
await shot("наполнение", page);
await click(page, /^Дальше/);
await shot("фасады", page);
await page.locator(".dock-tabs button", { hasText: "Смета" }).click();
await shot("смета", page);
await page.locator(".dock-tabs button", { hasText: "Фурнитура" }).click();
await shot("фурнитура", page);
await browser.close();
