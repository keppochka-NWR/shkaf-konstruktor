// Проверка: дёргается ли камера от правого клика. npx tsx scripts/rmb-jitter.ts <url> <outDir>
// Снимает холст до и после правого клика (меню закрывается Escape); сравнение — scripts/img_diff.py.
import { chromium } from "playwright";
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(url);
await page.waitForSelector("canvas");
await page.waitForTimeout(3000);
const canvas = page.locator("canvas").first();
const box = (await canvas.boundingBox())!;

const button = (process.env.BUTTON ?? "right") as "left" | "right";
for (const [label, fx] of [["центр", 0.5], ["левее", 0.4], ["правее", 0.6]] as const) {
  await canvas.screenshot({ path: `${out}/rmb-${label}-before.png` });
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * 0.55, { button });
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  await canvas.screenshot({ path: `${out}/rmb-${label}-after.png` });
}
await browser.close();
