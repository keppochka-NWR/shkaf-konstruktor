// Папка клиента: npx tsx scripts/client-shots.ts <url> <outDir>
// Имя клиента → «Ещё проект» → шкаф-купе во втором проекте → переключение, итог по клиенту → копия → перезагрузка → файл папки.
import { chromium } from "playwright";
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(url);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); });
await page.goto(url);
await page.waitForSelector(".client-bar");
await page.waitForTimeout(1500);
const tabs = async () => (await page.locator(".project-tab").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()).join(" | ");
const total = async () => (await page.locator(".client-total").innerText()).replace(/\s+/g, " ").trim();
await page.locator(".client-name").click();
await page.getByLabel("Имя клиента или номер заказа").fill("7212718 Цецегов");
await page.getByLabel("Имя клиента или номер заказа").press("Enter");
await page.locator(".client-name").click(); await page.waitForTimeout(300);
console.log("клиент:", (await page.locator(".client-name").innerText()).trim(), "| вкладки:", await tabs());
await page.getByRole("button", { name: "Ещё проект" }).click();
await page.getByRole("menuitem", { name: /Новый проект/ }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Шкаф-купе" }).click();
await page.getByRole("button", { name: "Добавить в комнату" }).click();
await page.waitForTimeout(2000);
console.log("после шкафа-купе во 2-м проекте:", await tabs(), "|", await total());
await page.screenshot({ path: `${out}/client-1-two-projects.png` });
await page.locator(".project-tab button[role=tab]").first().click(); await page.waitForTimeout(1500);
console.log("переключились на 1-й:", (await page.locator(".dock-price").innerText()).replace(/\s+/g, " "));
await page.getByRole("button", { name: "Ещё проект" }).click();
await page.getByRole("menuitem", { name: /Копия этого проекта/ }).click(); await page.waitForTimeout(1500);
await page.locator(".project-tab.active").dblclick().catch(() => {});
console.log("после копии:", await tabs(), "|", await total());
await page.reload(); await page.waitForSelector(".client-bar"); await page.waitForTimeout(2000);
console.log("после перезагрузки:", await tabs(), "|", await total());
await page.screenshot({ path: `${out}/client-2-after-reload.png` });
await page.locator(".client-name").click(); await page.waitForTimeout(300);
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), page.getByRole("button", { name: /Скачать папку клиента/ }).click()]);
if (dl) { const path = `${out}/client-bundle.json`; await dl.saveAs(path); console.log("файл папки:", dl.suggestedFilename()); }
else console.log("файл папки: скачивание не перехвачено");
await page.screenshot({ path: `${out}/client-3-menu.png` });
const alerts = (await page.locator("[role=alert]").allInnerTexts()).join(" | ").trim(); if (alerts) console.log("сообщения:", alerts);
// «Другой компьютер»: чистое хранилище, открываем файл папки кнопкой «Открыть».
if (dl) {
  const fresh = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await fresh.goto(url); await fresh.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }); await fresh.goto(url);
  await fresh.waitForSelector(".client-bar"); await fresh.waitForTimeout(1200);
  await fresh.locator('input[type=file][accept=".json"]').first().setInputFiles(`${out}/client-bundle.json`);
  await fresh.waitForTimeout(2500);
  console.log("открыт на чистом браузере:", (await fresh.locator(".client-name").innerText()).trim(), "|", (await fresh.locator(".project-tab").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()).join(" | "), "|", (await fresh.locator(".client-total").innerText()).replace(/\s+/g, " ").trim());
  await fresh.screenshot({ path: `${out}/client-4-imported.png` });
}
await browser.close();
