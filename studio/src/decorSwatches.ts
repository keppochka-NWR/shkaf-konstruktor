// Образцы декоров для КП (менеджеры 22.10.2026, п. 9): уменьшенная текстура каталога (data URL — КП открывается и офлайн, в скачанном
// HTML) и её средний цвет (для миниатюры изделия). Только в браузере; без текстуры — запасной цвет (quoteThumb.decorFallbackColor).
import { catalog } from "./catalog";

export type Swatch = { img: string; color: string };
const cache = new Map<string, Promise<Swatch | null>>();

function load(url: string): Promise<Swatch | null> {
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement("canvas"); c.width = 56; c.height = 56;
        const g = c.getContext("2d"); if (!g) return ok(null);
        g.drawImage(im, 0, 0, 56, 56);
        const px = g.getImageData(0, 0, 56, 56).data; let r = 0, gg = 0, b = 0;
        for (let i = 0; i < px.length; i += 4) { r += px[i]; gg += px[i + 1]; b += px[i + 2]; }
        const n = px.length / 4, h = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
        ok({ img: c.toDataURL("image/jpeg", 0.8), color: "#" + h(r) + h(gg) + h(b) });
      } catch { ok(null); }
    };
    im.onerror = () => ok(null);
    im.src = url;
  });
}
/** Образцы для списка декоров (у кого есть текстура в каталоге). */
export async function loadSwatches(decors: string[]): Promise<Record<string, Swatch>> {
  const out: Record<string, Swatch> = {};
  await Promise.all([...new Set(decors)].map(async (d) => {
    const tex = catalog.find((c) => c.n === d)?.tex; if (!tex) return;
    let q = cache.get(tex); if (!q) { q = load(tex); cache.set(tex, q); }
    const s = await q; if (s) out[d] = s;
  }));
  return out;
}
