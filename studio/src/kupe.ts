// Двери-купе в ГардерЁбе (06.10.2026, задание Макса «добавь двери купе и шкафы купе в расчёт»).
// Объект «Двери купе» — проём W×H глубиной 100 мм: верхняя и нижняя направляющие, полотна в два ряда.
// Ставится перед корпусами (шкаф-купе) или в нишу. Цена — строго по формуле калькулятора купе (Calc\kupe, calculate()):
// наполнение по площади двери W/N×H, профиль по пог. м × 3, направляющие по ширине проёма, доводчики и сложная сборка поштучно.
// Цены калькулятора купе — розничные, поэтому в смете это розничные позиции (не умножаются на коэффициент).
import type { Module, Part } from "./model";
import { KUPE_SYSTEMS, KUPE_FILLS, KUPE_SECTIONS, KUPE_SOFT_CLOSE, KUPE_COMPLEX_WORK, KUPE_COMPLEX_THRESHOLD, KUPE_FILM_ARMOR, KUPE_FILM_SAFETY, KUPE_PROFILE_MULT, KUPE_VERSION, type KupeFill, type KupeSystem } from "./kupeData";

export type KupeSpec = {
  /** Число полотен 1–7. */
  doors: number;
  /** Система профиля по названию из калькулятора купе (например «Стандарт (Аристо)»). */
  system: string;
  /** Цвет профиля по названию. */
  color: string;
  /** Наполнение каждого полотна (название из каталога наполнений купе). Короче doors — повторяется первое. */
  fills: string[];
  /** Раскладка секций полотна — индекс KUPE_SECTIONS. */
  sections?: number;
  softClose?: boolean;
  film?: boolean;
};
export const KUPE_DEPTH = 100;
export const LDSP_SHEET = { long: 2750, short: 1830 };
export const DEFAULT_KUPE: KupeSpec = { doors: 2, system: KUPE_SYSTEMS[0].system, color: KUPE_SYSTEMS[0].colors[0].name, fills: ["Зеркало Серебро 4мм"] };

export function kupeSystem(k: KupeSpec): KupeSystem { return KUPE_SYSTEMS.find((s) => s.system === k.system) ?? KUPE_SYSTEMS[0]; }
export function kupeColor(k: KupeSpec) { const s = kupeSystem(k); return s.colors.find((c) => c.name === k.color) ?? s.colors[0]; }
export function kupeFill(name: string | undefined): KupeFill { return KUPE_FILLS.find((f) => f.n === name) ?? KUPE_FILLS[0]; }
export function kupeDoorFill(k: KupeSpec, i: number) { return kupeFill(k.fills[i] ?? k.fills[0]); }
export function kupeSections(k: KupeSpec) { return KUPE_SECTIONS[k.sections ?? 0] ?? KUPE_SECTIONS[0]; }
export function isLdspFill(f: KupeFill) { return f.g.startsWith("ЛДСП"); }
/** Плёнка по типу наполнения — как getAutoFilm() калькулятора купе. */
export function kupeFilm(f: KupeFill) {
  if (f.g === "Плёнки") return null;
  if (f.mat.includes("mirror") || f.g === "Зеркала" || f.g === "Лакобель" || f.g.startsWith("ЛДСП")) return KUPE_FILM_ARMOR;
  if (f.g === "Стекло" || f.g.startsWith("Узорчатые")) return KUPE_FILM_SAFETY;
  return KUPE_FILM_ARMOR;
}
/** Видимая ширина полотна: полотна перекрываются на ширину вертикального профиля. */
export function kupeLeaf(m: Module) {
  const k = m.kupe!, s = kupeSystem(k), ov = Math.max(20, s.dims.frameSide), n = k.doors;
  return { width: (m.width + (n - 1) * ov) / n, overlap: ov };
}

export function kupeErrors(m: Module): string[] {
  const k = m.kupe!, e: string[] = [], s = kupeSystem(k);
  if (!Number.isInteger(k.doors) || k.doors < 1 || k.doors > 7) e.push("Двери купе: от 1 до 7 полотен.");
  if (!KUPE_SYSTEMS.some((x) => x.system === k.system)) e.push("Двери купе: выберите систему профиля из списка.");
  if (!s.colors.some((c) => c.name === k.color)) e.push("Двери купе: выберите цвет профиля из списка.");
  if (!Array.isArray(k.fills) || !k.fills.length || k.fills.some((f) => !KUPE_FILLS.some((x) => x.n === f))) e.push("Двери купе: выберите наполнение из каталога.");
  if (k.sections !== undefined && !KUPE_SECTIONS[k.sections]) e.push("Двери купе: неизвестная раскладка секций.");
  if (!(m.width >= 400 && m.width <= 6000)) e.push("Двери купе: ширина проёма 400–6000 мм.");
  if (!(m.height >= 600 && m.height <= 3000)) e.push("Двери купе: высота проёма 600–3000 мм.");
  const dw = Math.round(m.width / k.doors);
  if (m.height < s.limits.Hmin || m.height > s.limits.Hmax) e.push(`Двери купе: высота ${m.height} мм вне пределов системы «${s.system}» (${s.limits.Hmin}–${s.limits.Hmax}).`);
  if (dw < s.limits.doorL_min || dw > s.limits.doorL_max) e.push(`Двери купе: ширина полотна ${dw} мм вне пределов системы «${s.system}» (${s.limits.doorL_min}–${s.limits.doorL_max}). Измените число дверей.`);
  // Вставка ЛДСП должна выкраиваться из листа 2750×1830 (вертикальная укладка, как по умолчанию в калькуляторе купе).
  const sec = kupeSections(k), d = s.dims, innerW = m.width / k.doors - 2 * d.frameSide, innerH = m.height - d.frameTop - d.frameBot;
  const cw = innerW - (sec.colRatios.length - 1) * d.divider, ch = innerH - (sec.rowRatios.length - 1) * d.divider;
  const sumR = sec.rowRatios.reduce((a, b) => a + b, 0), sumC = sec.colRatios.reduce((a, b) => a + b, 0);
  for (let i = 0; i < k.doors; i++) if (isLdspFill(kupeDoorFill(k, i))) for (const r of sec.rowRatios) for (const c of sec.colRatios) {
    const w = Math.round(c / sumC * cw), h = Math.round(r / sumR * ch);
    if (w > LDSP_SHEET.short || h > LDSP_SHEET.long) { e.push(`Двери купе: вставка ЛДСП ${w}×${h} мм больше листа 1830×2750. Разделите полотно на секции.`); return e; }
  }
  if (m.depth !== KUPE_DEPTH) e.push(`Двери купе: глубина зоны направляющих ${KUPE_DEPTH} мм.`);
  return e;
}

export type KupeLine = { id: string; label: string; quantity: number; unit: string; unitPrice: number; source: string };
/** Строки сметы по формуле калькулятора купе. Все — розничные. */
export function kupeLines(m: Module): KupeLine[] {
  const k = m.kupe!, s = kupeSystem(k), c = kupeColor(k), W = m.width, H = m.height, N = k.doors, dw = W / N, sec = kupeSections(k);
  const src = "Калькулятор купе: профили " + KUPE_VERSION.profiles + ", наполнения " + KUPE_VERSION.fillings;
  const P = (v: number) => v * KUPE_PROFILE_MULT, out: KupeLine[] = [], area = dw / 1000 * (H / 1000);
  const fillArea = new Map<string, number>();
  for (let i = 0; i < N; i++) { const f = kupeDoorFill(k, i); fillArea.set(f.n, (fillArea.get(f.n) ?? 0) + area); }
  for (const [n, a] of fillArea) { const f = kupeFill(n); out.push({ id: "kupe-fill:" + n, label: "Купе · наполнение " + n, quantity: a, unit: "м²", unitPrice: f.p, source: src }); }
  const prof = (id: string, label: string, len: number, price: number) => { if (len > 0) out.push({ id: "kupe-profile:" + id + ":" + s.system + ":" + c.name, label: "Купе · " + label + " · " + s.system + " · " + c.name, quantity: len / 1000, unit: "м", unitPrice: P(price), source: src + " (закупка × 3)" }); };
  prof("ruchka", "профиль-ручка", 2 * H * N, c.ruchka);
  prof("verh", "рамка верхняя", dw * N, c.verh);
  prof("niz", "рамка нижняя", dw * N, c.niz);
  prof("razd-h", "разделитель горизонтальный", dw * sec.h * N, c.razd);
  prof("razd-v", "разделитель вертикальный", H * sec.v * N, c.razd);
  out.push({ id: "kupe-track:top:" + s.system + ":" + c.name, label: "Купе · направляющая верхняя" + (s.kind === "hang" ? " (подвесная)" : ""), quantity: W / 1000, unit: "м", unitPrice: P(c.top), source: src + " (закупка × 3)" });
  if (s.kind !== "hang") out.push({ id: "kupe-track:bottom:" + s.system + ":" + c.name, label: "Купе · направляющая нижняя", quantity: W / 1000, unit: "м", unitPrice: P(c.bot), source: src + " (закупка × 3)" });
  if (s.hardwarePerDoor) out.push({ id: "kupe-hardware:" + s.family, label: "Купе · " + (s.hardwareLabel ?? "комплект фурнитуры"), quantity: N, unit: "дв.", unitPrice: s.hardwarePerDoor, source: src });
  if (k.softClose) out.push({ id: "kupe-soft", label: "Купе · доводчики", quantity: N, unit: "дв.", unitPrice: KUPE_SOFT_CLOSE, source: src });
  if (sec.rowRatios.length * sec.colRatios.length >= KUPE_COMPLEX_THRESHOLD) out.push({ id: "kupe-work:complex", label: "Купе · сложная сборка (от 4 секций)", quantity: N, unit: "дв.", unitPrice: KUPE_COMPLEX_WORK, source: src });
  if (k.film) for (const [n, a] of fillArea) { const f = kupeFilm(kupeFill(n)); if (f) out.push({ id: "kupe-film:" + f.name, label: "Купе · " + f.name, quantity: a, unit: "м²", unitPrice: f.p, source: src }); }
  return out;
}

/** Внешний вид наполнения в 3D по классу материала калькулятора купе. */
export function kupeFillLook(f: KupeFill): NonNullable<Part["look"]> {
  const m = f.mat;
  if (m.includes("bronze-mirror")) return { color: 0xcdb593, metalness: 0.3, roughness: 0.08 };
  if (m.includes("graphite")) return { color: 0x80878d, metalness: 0.3, roughness: 0.1 };
  if (m.includes("mirror")) return { color: 0xe6edf1, metalness: 0.3, roughness: 0.05 };
  if (m.includes("tinted")) return { color: 0x8a6a45, opacity: 0.55, roughness: 0.08 };
  if (m.includes("satin")) return { color: 0xf1f3f4, opacity: 0.8, roughness: 0.85 };
  if (m.includes("glass")) return { color: 0xdfe8ec, opacity: 0.4, roughness: 0.05 };
  if (m.includes("lacobel")) return { color: /black|чёр|черн/i.test(f.n) ? 0x1b1b1b : 0xf4f4f2, roughness: 0.15, metalness: 0.15 };
  return { color: 0xe9e4da, roughness: 0.6 };
}
const hex = (grad: string) => parseInt((grad.split(",")[1] ?? grad.split(",")[0] ?? "#c0c0c0").replace("#", ""), 16);

/** Детали для 3D: направляющие, рамки полотен и вставки. Внешнее изделие: в раскрой ЛДСП не идёт (external). */
export function kupeParts(m: Module): Part[] {
  const k = m.kupe!, s = kupeSystem(k), d = s.dims, col = hex(kupeColor(k).grad), sec = kupeSections(k);
  const out: Part[] = [], W = m.width, H = m.height, D = m.depth;
  const part = (id: string, name: string, size: Part["size"], position: Part["position"], extra: Partial<Part> = {}): Part => ({ id, name, size, position, length: size[1], width: size[0], thickness: size[2], material: "alu", decor: kupeColor(k).name, role: "door", grain: "length", grainAxis: 1, edge: [0, 0, 0, 0], external: true, look: { color: col, metalness: 0.4, roughness: 0.35 }, ...extra });
  out.push(part("kupe:track:top", "Направляющая верхняя", [W, d.trackTop, D], [W / 2, H - d.trackTop / 2, D / 2], { role: "body" }));
  if (s.kind !== "hang" && d.trackBot > 0) out.push(part("kupe:track:bottom", "Направляющая нижняя", [W, d.trackBot, D], [W / 2, d.trackBot / 2, D / 2], { role: "body" }));
  const { width: lw, overlap } = kupeLeaf(m), bottom = s.kind === "hang" ? 10 : d.trackBot + 3, top = H - d.trackTop * 0.45, lh = top - bottom;
  const sumR = sec.rowRatios.reduce((a, b) => a + b, 0), sumC = sec.colRatios.reduce((a, b) => a + b, 0);
  for (let i = 0; i < k.doors; i++) {
    const row = i % 2, z = row ? D * 0.72 : D * 0.3, x0 = i * (lw - overlap), shift = row ? -(lw - overlap) : 0, f = kupeDoorFill(k, i);
    const leaf = { openShift: shift, sectionId: undefined };
    out.push(part(`kupe:${i}:side:l`, "Профиль-ручка", [d.frameSide, lh, 24], [x0 + d.frameSide / 2, bottom + lh / 2, z], leaf));
    out.push(part(`kupe:${i}:side:r`, "Профиль-ручка", [d.frameSide, lh, 24], [x0 + lw - d.frameSide / 2, bottom + lh / 2, z], leaf));
    const iw = lw - 2 * d.frameSide;
    out.push(part(`kupe:${i}:frame:top`, "Рамка верхняя", [iw, d.frameTop, 18], [x0 + lw / 2, top - d.frameTop / 2, z], leaf));
    out.push(part(`kupe:${i}:frame:bottom`, "Рамка нижняя", [iw, d.frameBot, 18], [x0 + lw / 2, bottom + d.frameBot / 2, z], leaf));
    const ih = lh - d.frameTop - d.frameBot, cw = iw - (sec.colRatios.length - 1) * d.divider, ch = ih - (sec.rowRatios.length - 1) * d.divider;
    let y = top - d.frameTop;
    sec.rowRatios.forEach((r, ri) => {
      const rh = r / sumR * ch; let x = x0 + d.frameSide;
      sec.colRatios.forEach((c, ci) => {
        const cwi = c / sumC * cw, ldsp = isLdspFill(f);
        out.push(part(`kupe:${i}:fill:${ri}:${ci}`, "Наполнение · " + f.n, [cwi, rh, ldsp ? 8 : 5], [x + cwi / 2, y - rh / 2, z], { material: ldsp ? "board" : "glass", decor: ldsp ? f.n : f.n, look: ldsp ? undefined : kupeFillLook(f) }));
        x += cwi;
        if (ci < sec.colRatios.length - 1) { out.push(part(`kupe:${i}:div-v:${ri}:${ci}`, "Разделитель", [d.divider, rh, 14], [x + d.divider / 2, y - rh / 2, z], leaf)); x += d.divider; }
      });
      y -= rh;
      if (ri < sec.rowRatios.length - 1) { out.push(part(`kupe:${i}:div-h:${ri}`, "Разделитель", [iw, d.divider, 14], [x0 + lw / 2, y - d.divider / 2, z], leaf)); y -= d.divider; }
    });
    for (const p of out) if (p.id.startsWith(`kupe:${i}:fill:`)) p.openShift = shift;
  }
  return out;
}
