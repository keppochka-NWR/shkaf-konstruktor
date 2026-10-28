// SVG → PNG (системный Chrome, headless): npx tsx scripts/svg-to-png.ts <папка> — каждый *.svg рядом сохраняется как *.png.
import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
for (const f of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
  await page.setContent(`<html><body style="margin:0">${readFileSync(join(dir, f), "utf8")}</body></html>`);
  await page.locator("svg").first().screenshot({ path: join(dir, f.replace(/\.svg$/, ".png")) });
}
await browser.close();
