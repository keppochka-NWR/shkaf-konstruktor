// Снимки крыши шкафа при сбое загрузки сеток и текстур (как у вкладки, открытой во время пересборки демо — снимок Макса 20.10).
// npx tsx scripts/fastener-outage-shots.ts <url студии> <project.json> <outDir> <имя> [мс сбоя, по умолчанию 3000; 0 — сбой всё время]
// Первые N мс сервер «пуст» (models/ и tex/ — отказ), потом отвечает; сцена пересобирается («Скрыть фасады»), камера — на угол крыши.
// Печатает выступы крепежа над крышей по window.__hardwareBoxes (если хук есть в сборке).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [url, file, out, name, msArg] = process.argv.slice(2);
const outage = Number(msArg ?? 3000), project = readFileSync(file, "utf8");
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
let down = true;
await page.route(/\/(models|tex)\//, (r) => (down ? r.abort() : r.continue()));
await page.goto(url);
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "1"); }, project);
await page.goto(url);
await page.waitForSelector("canvas");
if (outage > 0) { await page.waitForTimeout(outage); down = false; }
const settle = async () => { let z = 0; for (let i = 0; i < 200 && z < 3; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); z = n === 0 ? z + 1 : 0; await page.waitForTimeout(150); } await page.waitForTimeout(500); };
await settle();
const room = page.getByRole("button", { name: /Скрыть помещение|Показать помещение/ }); if (await room.count()) await room.first().click();
const fac = page.getByRole("button", { name: /Скрыть фасады/ }); if (await fac.count()) await fac.first().click();
await settle();
const p = JSON.parse(project), a = p.modules[0], m = a.module;
// угол крыши спереди-справа, взгляд сверху-слева-спереди (координаты комнаты, мм)
const cx = a.x + m.width / 2, top = (a.y ?? 0) + m.height;
await page.evaluate(([pos, look]) => (window as unknown as { __camera?: (p: number[], l: number[]) => void }).__camera?.(pos, look), [[cx - m.width * 0.9, top + 650, a.z + m.depth + 700], [cx + m.width * 0.15, top - 60, a.z + m.depth * 0.45]]);
await settle();
await page.screenshot({ path: `${out}/${name}.png`, clip: (await page.locator("canvas").first().boundingBox())! });
const boxes = await page.evaluate(() => (window as unknown as { __hardwareBoxes?: () => { carcass: { hi: number[] } | null; items: { role?: string; hi: number[]; src: string[] }[] }[] }).__hardwareBoxes?.());
if (boxes) { const over = boxes.flatMap((b) => b.items.filter((i) => i.role === "fastener" && b.carcass && i.hi[1] - b.carcass.hi[1] > 0.5)); console.log(name, "крепёж над крышей:", over.length, "заглушек:", boxes.flatMap((b) => b.items.filter((i) => i.src.includes("stub"))).length); }
else console.log(name, "снимок (хука __hardwareBoxes в этой сборке нет)");
await browser.close();
