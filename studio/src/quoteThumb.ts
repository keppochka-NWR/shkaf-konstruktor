// Миниатюра изделия для КП (менеджеры 22.10.2026, п. 9): вид спереди по деталям модели в цветах декоров — фасады, ящики, ручки,
// полки за стеклом. Не чертёж: без размеров и служебных пометок, только чтобы клиент узнал изделие в списке.
import { parts, type Module, type Part } from "./model";
import { vernissageColor } from "./facadesVernissage";

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
/** Цвет декора без текстуры: однотонные по названию, древесные — тёплый тон; точный цвет даёт образец текстуры (decorSwatches). */
export function decorFallbackColor(decor: string): string {
  const d = decor.toLowerCase();
  if (/графит|антрацит/.test(d)) return "#565956";
  if (/черн/.test(d)) return "#2f3133";
  if (/бетон|серый|серая|камень|сланец|мрамор/.test(d)) return "#b9b7b1";
  if (/орех|венге|тёмн|темн/.test(d)) return "#8a6545";
  if (/дуб|ясень|сосна|клён|клен|бук|вотан|дерев|пайн|сонома/.test(d)) return "#cfae84";
  if (/кашемир|капучино|бежев|айвори|ваниль/.test(d)) return "#ddd2bf";
  return "#ece9e1";
}
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** SVG вида спереди. color(decor) — цвет декора (образец текстуры или запасной). */
export function moduleThumbSVG(m: Module, color: (decor: string) => string = decorFallbackColor, label = m.name): string {
  let all: Part[];
  try { all = parts(m); } catch { return ""; }
  const shown = all.filter((d) => d.material !== "hdf" && d.role !== "hinge" && d.role !== "fastener" && d.role !== "flange" && !d.id.startsWith("groove:") && !(d.role === "light" && d.size[0] < 2 && d.size[1] < 2));
  if (!shown.length) return "";
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const d of shown) { x0 = Math.min(x0, d.position[0] - d.size[0] / 2); x1 = Math.max(x1, d.position[0] + d.size[0] / 2); y0 = Math.min(y0, d.position[1] - d.size[1] / 2); y1 = Math.max(y1, d.position[1] + d.size[1] / 2); }
  const W = Math.max(1, x1 - x0), H = Math.max(1, y1 - y0), pad = Math.max(W, H) * 0.04, sw = Math.max(W, H) / 260;
  const fill = (d: Part) => {
    if (d.role === "handle") return "#3b4044";
    if (d.role === "light") return "#ffd77e";
    if (d.look) return hex(d.look.color);
    if (d.material === "glass") return "#cfe3e8";
    if (d.material === "alu" && d.role !== "door" && !d.id.endsWith(":facade")) return "#b9c1c5";
    if (d.material === "metal") return "#a3acb0";
    if (d.vernissage && m.vernissage) return hex(vernissageColor(m.vernissage));
    return color(d.decor);
  };
  const front = (d: Part) => d.role === "door" || d.id.endsWith(":facade") || d.facadeSide;
  const rects = shown.slice().sort((a, b) => (a.position[2] + a.size[2] / 2) - (b.position[2] + b.size[2] / 2) || Number(a.role === "handle") - Number(b.role === "handle")).map((d) => {
    const x = d.position[0] - d.size[0] / 2 - x0 + pad, y = y1 - (d.position[1] + d.size[1] / 2) + pad;
    const alu = d.material === "alu" && front(d);
    // фасад в алюминиевой рамке: рамка профиля + вставка (стекло/зеркало — светлее)
    if (alu) { const f = Math.min(d.size[0], d.size[1]) * 0.06; return `<rect x="${x}" y="${y}" width="${d.size[0]}" height="${d.size[1]}" fill="#9aa3a8" stroke="#55606a" stroke-width="${sw}"/><rect x="${x + f}" y="${y + f}" width="${Math.max(0, d.size[0] - 2 * f)}" height="${Math.max(0, d.size[1] - 2 * f)}" fill="${d.look ? hex(d.look.color) : "#d9e6ea"}" opacity="0.92"/>`; }
    const op = d.look?.opacity !== undefined ? ` opacity="${Math.max(0.35, d.look.opacity)}"` : "";
    return `<rect x="${x}" y="${y}" width="${Math.max(d.size[0], sw)}" height="${Math.max(d.size[1], sw)}" fill="${fill(d)}" stroke="${front(d) ? "#5b6870" : "#8a979e"}" stroke-width="${front(d) ? sw * 1.2 : sw * 0.7}"${op}/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 2 * pad} ${H + 2 * pad}" role="img" aria-label="${esc("Вид спереди: " + label)}" preserveAspectRatio="xMidYMid meet">${rects}</svg>`;
}
