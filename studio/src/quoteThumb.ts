// Миниатюра изделия для КП (менеджеры 22.10.2026, п. 9; переделано 26.10.2026 по снимку Макса — была «пустым серым прямоугольником»:
// дверь закрывала всё наполнение, ручка — едва заметная черта). Теперь — фронтальный чертёж по деталям модели: корпус и наполнение
// (полки, перегородки, ящики, штанги, тремпели, подсветка) в цвете декора, двери — прозрачные, с контуром и линиями открывания
// (вершина — к петлям), ручки — тёмные, не тоньше заметной толщины. Без размеров и служебных пометок: клиент узнаёт изделие.
import { parts, type Module, type Part } from "./model";
import { vernissageColor } from "./facadesVernissage";

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
/** Цвет декора без текстуры: однотонные по названию, древесные — тёплый тон; точный цвет даёт образец текстуры (decorSwatches). */
export function decorFallbackColor(decor: string): string {
  const d = decor.toLowerCase();
  if (/графит|антрацит/.test(d)) return "#565956";
  if (/черн/.test(d)) return "#2f3133";
  if (/бетон|серый|серая|камень|сланец|мрамор|клауд/.test(d)) return "#b9b7b1";
  if (/орех|венге|тёмн|темн/.test(d)) return "#8a6545";
  if (/дуб|ясень|сосна|клён|клен|бук|вотан|дерев|пайн|сонома/.test(d)) return "#cfae84";
  if (/кашемир|капучино|бежев|айвори|ваниль/.test(d)) return "#ddd2bf";
  return "#ece9e1";
}
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (v: number) => Math.round(v * 10) / 10;

/** Распашная или откидная дверь (не фасад ящика). */
const isDoor = (d: Part) => d.role === "door" && d.id !== "slope-filler";
/** Фасад ящика или накладной фасад (лицевая деталь, не дверь). */
const isFront = (d: Part) => !isDoor(d) && (d.id.endsWith(":facade") || !!d.facadeSide);

/** SVG вида спереди. color(decor) — цвет декора (образец текстуры или запасной). */
export function moduleThumbSVG(m: Module, color: (decor: string) => string = decorFallbackColor, label = m.name): string {
  let all: Part[];
  try { all = parts(m); } catch { return ""; }
  const shown = all.filter((d) => d.material !== "hdf" && d.role !== "hinge" && d.role !== "fastener" && d.role !== "flange" && !d.id.startsWith("groove:") && !(d.role === "light" && d.size[0] < 2 && d.size[1] < 2));
  if (!shown.length) return "";
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const d of shown) { x0 = Math.min(x0, d.position[0] - d.size[0] / 2); x1 = Math.max(x1, d.position[0] + d.size[0] / 2); y0 = Math.min(y0, d.position[1] - d.size[1] / 2); y1 = Math.max(y1, d.position[1] + d.size[1] / 2); }
  const W = Math.max(1, x1 - x0), H = Math.max(1, y1 - y0), big = Math.max(W, H), pad = big * 0.04, sw = big / 260;
  const X = (d: Part) => d.position[0] - d.size[0] / 2 - x0 + pad, Y = (d: Part) => y1 - (d.position[1] + d.size[1] / 2) + pad;
  const fill = (d: Part) => {
    if (d.look) return hex(d.look.color);
    if (d.material === "glass") return "#cfe3e8";
    if (d.material === "alu") return "#b9c1c5";
    if (d.material === "metal") return "#8d979c";
    if (d.vernissage && m.vernissage) return hex(vernissageColor(m.vernissage));
    return color(d.decor);
  };
  const rect = (d: Part, attrs: string, minT = sw) => `<rect x="${num(X(d))}" y="${num(Y(d))}" width="${num(Math.max(d.size[0], minT))}" height="${num(Math.max(d.size[1], minT))}" ${attrs}/>`;
  const out: string[] = [];
  // 1) внутренность корпуса (задник не рисуем — светлый фон проёма)
  out.push(`<rect x="${num(pad)}" y="${num(pad)}" width="${num(W)}" height="${num(H)}" fill="#f7f5f0"/>`);
  // 2) корпус и наполнение: стенки, полки, перегородки, стяжки, цоколь, короба ящиков — по глубине (передние поверх)
  const body = shown.filter((d) => !isDoor(d) && !isFront(d) && d.role !== "handle" && d.role !== "light" && d.role !== "rod" && d.material !== "metal");
  for (const d of body.slice().sort((a, b) => a.position[2] + a.size[2] / 2 - (b.position[2] + b.size[2] / 2)))
    out.push(rect(d, `fill="${fill(d)}" stroke="#6f7b82" stroke-width="${num(sw * 0.7)}"${d.role === "drawer" ? ' opacity="0.85"' : ""}`));
  // 3) штанги, тремпели, пантографы и прочий металл — линией заметной толщины
  for (const d of shown.filter((p) => p.role === "rod" || (p.material === "metal" && p.role !== "handle")))
    out.push(rect(d, `fill="#7e888d" stroke="#4d565b" stroke-width="${num(sw * 0.5)}"`, sw * 3));
  // 4) подсветка
  for (const d of shown.filter((p) => p.role === "light")) out.push(rect(d, `fill="#ffd77e" stroke="#d9a73a" stroke-width="${num(sw * 0.4)}"`, sw * 2.5));
  // 5) фасады ящиков и накладные фасады — сплошные
  for (const d of shown.filter(isFront)) out.push(rect(d, `fill="${fill(d)}" stroke="#4f5c63" stroke-width="${num(sw * 1.2)}"`));
  // 6) двери — прозрачные: видно наполнение; контур и линии открывания (от углов со стороны ручки к середине стороны петель)
  for (const d of shown.filter(isDoor)) {
    const x = X(d), y = Y(d), w = d.size[0], h = d.size[1];
    if (d.material === "alu") { const f = Math.min(w, h) * 0.06; out.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="none" stroke="#55606a" stroke-width="${num(f)}" opacity="0.8"/>`); }
    out.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${d.mirror ? "#cfdde3" : fill(d)}" fill-opacity="${d.mirror ? 0.45 : 0.22}" stroke="#3f4b52" stroke-width="${num(sw * 1.4)}"/>`);
    const hg = d.hinge ?? "left", dash = `stroke="#3f4b52" stroke-width="${num(sw * 0.8)}" stroke-dasharray="${num(sw * 6)} ${num(sw * 4)}" fill="none"`;
    const pts = hg === "left" ? [[x + w, y], [x, y + h / 2], [x + w, y + h]] : hg === "right" ? [[x, y], [x + w, y + h / 2], [x, y + h]]
      : hg === "top" ? [[x, y + h], [x + w / 2, y], [x + w, y + h]] : [[x, y], [x + w / 2, y + h], [x + w, y]];
    out.push(`<polyline points="${pts.map(([a, b]) => num(a) + "," + num(b)).join(" ")}" ${dash}/>`);
  }
  // 7) ручки — тёмные, не тоньше ~1,2 % габарита (иначе в печати пропадают)
  const ht = big * 0.012;
  for (const d of shown.filter((p) => p.role === "handle")) {
    const w = Math.max(d.size[0], ht), h = Math.max(d.size[1], ht), cx = d.position[0] - x0 + pad, cy = y1 - d.position[1] + pad;
    out.push(`<rect x="${num(cx - w / 2)}" y="${num(cy - h / 2)}" width="${num(w)}" height="${num(h)}" rx="${num(Math.min(w, h) / 3)}" fill="#26292b"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(W + 2 * pad)} ${num(H + 2 * pad)}" role="img" aria-label="${esc("Вид спереди: " + label)}" preserveAspectRatio="xMidYMid meet">${out.join("")}</svg>`;
}
