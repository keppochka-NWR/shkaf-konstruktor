// Проверка нижней навигации: npx tsx scripts/dock-shots.ts <url> <project.json> <outDir>
// Снимает вкладки «Смета» и «Фурнитура», меняет направляющие и ручки во всём проекте, печатает цены до/после, снимает телефонную ширину.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [url, file, out] = process.argv.slice(2);
const project = readFileSync(file, "utf8");
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [w, h, tag] of [[1440, 900, "desk"], [400, 860, "phone"]] as const) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); }, project);
  await page.goto(url);
  await page.waitForSelector("canvas");
  await page.waitForTimeout(2500);
  const price = async () => (await page.locator(".dock-price").innerText()).replace(/\s+/g, " ");
  console.log(tag, "start:", await price());
  await page.screenshot({ path: `${out}/dock-${tag}-0-project.png` });
  await page.locator(".dock-tabs button", { hasText: "Смета" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/dock-${tag}-1-estimate.png` });
  await page.locator(".dock-tabs button", { hasText: "Фурнитура" }).click();
  await page.waitForTimeout(800);
  const slides = page.getByLabel("Направляющие во всём проекте");
  if (await slides.count()) { await slides.selectOption("gtv0fpo"); await page.waitForTimeout(1200); console.log(tag, "slides→hidden:", await price(), "|", await page.locator(".dock-note").innerText().catch(() => "")); }
  const handles = page.getByLabel("Ручки во всём проекте");
  if (await handles.count()) { await handles.selectOption("hexa256a"); await page.waitForTimeout(1200); console.log(tag, "handles→HEXA 256:", await price(), "|", await page.locator(".dock-note").innerText().catch(() => "")); }
  else console.log(tag, "ручек в проекте нет — выбор ручек скрыт");
  const opening = page.getByLabel("Открывание дверей во всём проекте");
  if (await opening.count()) { await opening.selectOption("handle"); await page.waitForTimeout(1200); console.log(tag, "opening→handles:", await price(), "|", await page.locator(".dock-note").innerText().catch(() => "")); }
  const alert = await page.locator("[role=alert]").allInnerTexts();
  if (alert.some((t) => t.trim())) console.log(tag, "alert:", alert.join(" | "));
  await page.screenshot({ path: `${out}/dock-${tag}-2-hardware.png` });
  await page.close();
}
await browser.close();
