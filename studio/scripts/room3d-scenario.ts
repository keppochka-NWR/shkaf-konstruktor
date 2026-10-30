// Контур помещения в 3D (задача Макса 30.10.2026, этап 1): npx tsx scripts/room3d-scenario.ts <url> <outDir>
// Комнаты-заготовки (пятиугольник, скос, скруглённый угол, эркер) с окном на косой/дуговой стене, дверью и батареей → снимки
// 3D, «Спереди», «Сверху» и 3D с другой стороны («Ближние стены»); печатает ошибки страницы.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { newProject, type Project } from "../src/project";
import { outlinePreset, withOutline, edgeLength, type OutlinePreset } from "../src/roomOutline";
import { newFixture } from "../src/fixtures";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
/** Комната kind 4000 × 3000: окно на стене winEdge (по середине), дверь на левой стене, батарея под окном; шкаф у задней стены. */
function project(kind: OutlinePreset, winEdge: number, moduleZ = 30): Project {
  const p = newProject();
  p.room = withOutline(p.room, outlinePreset(kind, 4000, 3000));
  const o = p.room.outline!, L = edgeLength(o, winEdge), left = o.length - 1, w = Math.min(900, Math.floor(L - 200));
  p.room.openings = [
    { id: "win", type: "window", wall: "back", edge: winEdge, offset: Math.round((L - w) / 2), width: w, height: 1400, sill: 850, windowSill: { width: w + 100, thick: 40, overhang: 60, offset: Math.round((L - w) / 2) - 50 }, reveal: 40 },
    { id: "door", type: "door", wall: "left", edge: left, offset: 300, width: 800, height: 2050, sill: 0, casing: 70 },
  ];
  p.room.fixtures = [{ ...newFixture(p.room, "radiator", "back", "rad"), edge: winEdge, offset: Math.round((L - Math.min(700, L - 100)) / 2), width: Math.min(700, Math.round(L - 100)) }];
  p.modules[0].x = 1300; p.modules[0].z = moduleZ;
  return p;
}
const cases: [string, Project][] = [["pentagon", project("pentagon", 2)], ["chamfer", project("chamfer", 1)], ["rounded", project("rounded", 1)], ["bay", project("bay", 0, 1100)]];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const view = async (name: string) => { await page.getByRole("button", { name, exact: true }).first().click().catch(() => {}); await page.waitForTimeout(1200); };
try {
  for (const [name, p] of cases) {
    await page.goto(url);
    await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "room"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(p));
    await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
    const notice = (await page.locator("body").innerText()).match(/(Контур помещения[^\n]*|выходит за границы[^\n]*)/)?.[0];
    if (notice) console.log(name + ": " + notice);
    await view("3D"); await page.screenshot({ path: `${out}/${name}-3d.png` });
    // камера с другой стороны: ближние (задние) стены должны скрыться
    const c = (await page.locator("canvas").first().boundingBox())!;
    await page.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.5); await page.mouse.down({ button: "middle" }); await page.mouse.move(c.x + c.width * 0.5 + 1000, c.y + c.height * 0.56, { steps: 20 }); await page.mouse.up({ button: "middle" });
    await page.waitForTimeout(800); await page.screenshot({ path: `${out}/${name}-3d-turned.png` });
    await view("Спереди"); await page.screenshot({ path: `${out}/${name}-front.png` });
    await view("Сверху"); await page.screenshot({ path: `${out}/${name}-top.png` });
  }
  console.log("ошибки страницы: " + (errors.length ? [...new Set(errors)].join("; ").slice(0, 1500) : "нет"));
} finally { await browser.close(); }
