// Образцы декоров для КП, собранного скриптом (scripts/*-docs.ts): то же, что decorSwatches.ts делает в браузере — уменьшенная
// текстура каталога (data URL 56×56) и её средний цвет, — но в Chrome через playwright (в node нет canvas). Без этого КП из скриптов
// печатался с пустыми серыми квадратами вместо образцов (снимок Макса 26.10.2026).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { catalog } from "../src/catalog";
import type { Project } from "../src/project";
import type { QuoteSwatches } from "../src/exports";

/** Декоры проекта: корпус, фасады, фасады ящиков, щит над сиденьем. */
export function projectDecors(p: Project): string[] {
  return [...new Set(p.modules.flatMap((a) => [a.module.decor, a.module.facadeDecor, a.module.drawerFacadeDecor ?? a.module.facadeDecor, a.module.seatPanel?.decor ?? a.module.decor]))];
}
/** Образцы для КП: { декор: { img, color } } по текстурам public/tex. publicDir — studio/public. */
export async function nodeSwatches(p: Project, publicDir = "public"): Promise<QuoteSwatches> {
  const src: Record<string, string> = {};
  for (const d of projectDecors(p)) {
    const tex = catalog.find((c) => c.n === d)?.tex;
    const file = tex ? join(publicDir, tex) : "";
    if (file && existsSync(file)) src[d] = "data:image/jpeg;base64," + readFileSync(file).toString("base64");
  }
  if (!Object.keys(src).length) return {};
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    // код страницы — строкой: tsx/esbuild добавляет в функции служебный __name, которого в странице нет
    return (await page.evaluate(`(async (all) => {
      const out = {};
      for (const [decor, url] of Object.entries(all)) {
        const im = new Image(); im.src = url;
        try { await im.decode(); } catch { continue; }
        const c = document.createElement("canvas"); c.width = 56; c.height = 56;
        const g = c.getContext("2d"); g.drawImage(im, 0, 0, 56, 56);
        const px = g.getImageData(0, 0, 56, 56).data; let r = 0, gg = 0, b = 0;
        for (let i = 0; i < px.length; i += 4) { r += px[i]; gg += px[i + 1]; b += px[i + 2]; }
        const n = px.length / 4, h = (v) => Math.round(v / n).toString(16).padStart(2, "0");
        out[decor] = { img: c.toDataURL("image/jpeg", 0.8), color: "#" + h(r) + h(gg) + h(b) };
      }
      return out;
    })(${JSON.stringify(src)})`)) as QuoteSwatches;
  } finally { await browser.close(); }
}
