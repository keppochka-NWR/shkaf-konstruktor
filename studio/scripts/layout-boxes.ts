// Размеры основных блоков редактора на заданной ширине: npx tsx scripts/layout-boxes.ts <url> <project.json> <width> [stage]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [url, file, wArg, stage = "bodies"] = process.argv.slice(2);
const project = readFileSync(file, "utf8");
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await b.newPage({ viewport: { width: Number(wArg), height: 860 } });
await page.goto(url);
await page.evaluate(([raw, st]) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", st); }, [project, stage]);
await page.goto(url);
await page.waitForTimeout(2000);
console.log(await page.evaluate(`(() => {
  const q = (s) => { const e = document.querySelector(s); if (!e) return s + ': none'; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return s + ': x ' + Math.round(r.left) + ' y ' + Math.round(r.top) + ' w ' + Math.round(r.width) + ' h ' + Math.round(r.height) + ' | pos ' + cs.position + ' cols ' + cs.gridTemplateColumns + ' rows ' + cs.gridTemplateRows + ' ovY ' + cs.overflowY; };
  return ['.app', '.header', '.stage-bar', '.stage-steps', '.stage-actions', '.workspace', '.library', '.viewport', '.properties', '.project-dock', '.interaction-bar', '.scene-tools'].map(q).join('\\n') + '\\nscrollY ' + scrollY + ' docH ' + document.documentElement.scrollHeight;
})()`));
await b.close();
