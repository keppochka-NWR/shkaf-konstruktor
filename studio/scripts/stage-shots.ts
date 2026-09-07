// Скрины пошагового режима: npx tsx scripts/stage-shots.ts <url> <project.json> <outDir>
// Чистое хранилище → стартовое окно помещения, затем «Дальше» по этапам.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [url, file, out] = process.argv.slice(2);
const project = readFileSync(file, "utf8");
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(url);
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); }, project);
await page.goto(url);
await page.waitForSelector("canvas");
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/stage-0-welcome.png` });
await page.getByRole("button", { name: "Дальше: окна, двери, коммуникации" }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/stage-2-fixtures.png` });
for (const [name, fileName] of [["Дальше: Каркасы", "stage-3-bodies"], ["Дальше: Наполнение", "stage-4-filling"], ["Дальше: Фасады", "stage-5-facades"]] as const) {
  await page.getByRole("button", { name }).first().click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/${fileName}.png` });
}
await page.getByRole("button", { name: "Помещение" }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/stage-1-room.png` });
console.log("saved 6 stage screenshots to", out);
await browser.close();
