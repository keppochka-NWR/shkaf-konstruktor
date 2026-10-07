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
/** Профили купе в 3D — заводские сечения ARISTO (модели: scripts/blender_kupe_profiles.py, листы проверки: docs/kupe-sections/*_model.png).
 *  C и рамки/направляющие «Стандарт» — «Схемы сборки систем ARISTO» (scripts/aristo_sections.json); остальные ручки, рамки ЭКО, Slim, NOVA,
 *  GRACE, средние рамки — каталог ARISTO 02.10.2026 (scripts/aristo_catalog_sections.json).
 *  Сечение ручки: w — ширина на фасаде, d — глубина, slot — центр паза под вставку от середины глубины (минус — к задней стороне). */
type KupeHandle = { file: string; w: number; d: number; slot: number; exact: boolean; note?: string };
const HANDLES = {
  c: { file: "handle_c", w: 26.51, d: 34.51, slot: -8.59, exact: true },
  flat: { file: "handle_flat", w: 44.97, d: 34, slot: -8.5, exact: true },
  i: { file: "handle_i", w: 26, d: 34, slot: -8.9, exact: true },
  fusion: { file: "handle_fusion", w: 39.5, d: 34.28, slot: 0, exact: true },
  smart: { file: "handle_smart", w: 26, d: 34.03, slot: 0, exact: true },
  avers: { file: "handle_avers", w: 20, d: 34.06, slot: 0, exact: true },
  twelve: { file: "handle_twelve", w: 12, d: 34.2, slot: 0, exact: true },
  c_eco: { file: "handle_c_eco", w: 26, d: 34, slot: -8.9, exact: true },
  h_eco: { file: "handle_h_eco", w: 35.17, d: 32.46, slot: 0, exact: true },
  flat_eco: { file: "handle_flat_eco", w: 26.01, d: 34, slot: -8.9, exact: true },
  o: { file: "handle_o", w: 25.99, d: 34, slot: -9, exact: true },
  slim: { file: "handle_slim", w: 15.43, d: 33.94, slot: 3.68, exact: true },
  slim_max: { file: "handle_slim_max", w: 15.44, d: 34, slot: 3.65, exact: true },
  nova: { file: "handle_nova", w: 22, d: 34, slot: 8, exact: true },
  grace: { file: "handle_grace", w: 10.68, d: 42, slot: 0, exact: true },
} satisfies Record<string, KupeHandle>;
export type KupeProfileStyle = keyof typeof HANDLES;
/** Ручка системы по названию профиля в прайсе. Slim Fine и Slim Декор сняты с производства и в каталоге 2026 не нарисованы — показаны моделью SLIM LINE. */
export function kupeProfileStyle(s: KupeSystem): KupeProfileStyle {
  const p = s.profile.toLowerCase(), eco = /эко/.test(p);
  if (/slim max/.test(p)) return "slim_max";
  if (/slim/.test(p)) return "slim";
  if (/grace/.test(p)) return "grace";
  if (/nova/.test(p)) return "nova";
  if (/fusion/.test(p)) return "fusion";
  if (/smart/.test(p)) return "smart";
  if (/avers/.test(p)) return "avers";
  if (/twelve/.test(p)) return "twelve";
  if (/flat/.test(p)) return eco ? "flat_eco" : "flat";
  if (/^h(\s|$)/.test(p)) return "h_eco";
  if (/^o(\s|$)/.test(p)) return "o";
  if (/^i(\s|$)/.test(p)) return "i";
  return eco ? "c_eco" : "c";
}
export function kupeHandle(s: KupeSystem): KupeHandle { return HANDLES[kupeProfileStyle(s)]; }
/** Ручка этой системы нарисована по её собственному заводскому сечению. */
export function kupeProfileExact(s: KupeSystem): boolean { return !/fine|декор/i.test(s.profile); }
export const KUPE_PROFILE_WIDTH = Object.fromEntries(Object.entries(HANDLES).map(([k, v]) => [k, v.w])) as Record<KupeProfileStyle, number>;
export const KUPE_PROFILE_PREVIEW = Object.fromEntries(Object.keys(HANDLES).map((k) => [k, `models/kupe/preview_handle_${k}.png`])) as Record<KupeProfileStyle, string>;

/** Семейства: рамки, средняя рамка, направляющие. h — высота сечения, d — глубина. */
type Sec = { file: string; h: number; d: number };
type KupeFamily = { trackTop: Sec; trackBot?: Sec; frameTop: Sec; frameBot: Sec; divider: Sec; insert: number; panel?: number; layout: string;
  /** Своя направляющая у каждого ряда, свои центры вставок и зазоры (GRACE: техкаталог ARISTO 19.01.2026, стр. 13). */
  trackPerRow?: boolean; panels?: readonly [number, number]; gapTop?: number; gapBottom?: number };
const STD_TRACKS = { trackTop: { file: "track_top", h: 40.32, d: 83.34 }, trackBot: { file: "track_bottom", h: 7.9, d: 63.8 } };
const FAMILIES: Record<"std" | "eco" | "slim" | "nova" | "grace", KupeFamily> = {
  std: { ...STD_TRACKS, frameTop: { file: "frame_top", h: 21.03, d: 15.04 }, frameBot: { file: "frame_bottom", h: 56.09, d: 15.04 }, divider: { file: "divider", h: 25, d: 14.5 }, insert: 9, layout: "по чертежу сборки" },
  eco: { trackTop: { file: "track_top_eco", h: 40.31, d: 82 }, trackBot: { file: "track_bottom_eco", h: 7.48, d: 59.86 }, frameTop: { file: "frame_top_eco", h: 21.5, d: 14.2 }, frameBot: { file: "frame_bottom_eco", h: 56.5, d: 12.94 }, divider: { file: "divider_eco", h: 25.1, d: 12 }, insert: 9, layout: "как Стандарт" },
  slim: { ...STD_TRACKS, frameTop: { file: "frame_slim_wide", h: 46.06, d: 32.2 }, frameBot: { file: "frame_slim_wide", h: 46.06, d: 32.2 }, divider: { file: "divider_slim", h: 11.68, d: 32.2 }, insert: 0, layout: "по схеме Стандарт" },
  nova: { ...STD_TRACKS, frameTop: { file: "frame_nova", h: 4.99, d: 17 }, frameBot: { file: "frame_nova", h: 4.99, d: 17 }, divider: { file: "divider_nova", h: 17, d: 34 }, insert: 0, panel: 16, layout: "по схеме Стандарт" },
  grace: { trackTop: { file: "track_top_grace", h: 45.98, d: 51 }, frameTop: { file: "frame_grace", h: 26.09, d: 43 }, frameBot: { file: "frame_grace", h: 26.09, d: 43 }, divider: { file: "divider_grace", h: 12.17, d: 43 }, insert: 0, layout: "по техкаталогу: 73 мм от потолка, 9 мм от пола",
    trackPerRow: true, panels: [-25, 25], gapTop: 73, gapBottom: 9 },
};
export function kupeFamily(s: KupeSystem): KupeFamily {
  const n = s.system.toLowerCase();
  if (/grace/.test(n)) return FAMILIES.grace;
  if (/nova/.test(n)) return FAMILIES.nova;
  if (/slim/.test(n)) return FAMILIES.slim;
  if (/эконом/.test(n)) return FAMILIES.eco;
  return FAMILIES.std;
}
/** Вертикальный разрез по чертежу Aristo (стр. 4): зазоры полотна до пола и до потолка. */
const GAP = { bottom: 11.6, top: 19.6 } as const;
/** Центры вставок заднего и переднего ряда от середины верхней направляющей и смещение нижней направляющей, мм.
 *  Асимметричные ролики (ручки с пазом у задней стороны: C, FLAT, I, O, стр. 4): вставки в каналах смещены назад.
 *  Симметричные ролики (H, стр. 5, и остальные ручки с пазом по центру или спереди): вставки через 40,06 мм по центру. */
const ROWS = { asym: { panels: [-28.1, 11.96], trackBotShift: -8.07 }, sym: { panels: [-20.03, 20.03], trackBotShift: 0 } } as const;
const hex = (grad: string) => parseInt((grad.split(",")[1] ?? grad.split(",")[0] ?? "#c0c0c0").replace("#", ""), 16);

/** Детали для 3D: направляющие, рамки полотен и вставки. Внешнее изделие: в раскрой ЛДСП не идёт (external). */
export function kupeParts(m: Module): Part[] {
  const k = m.kupe!, s = kupeSystem(k), d = s.dims, col = hex(kupeColor(k).grad), sec = kupeSections(k);
  const out: Part[] = [], W = m.width, H = m.height, D = m.depth, h = kupeHandle(s), fam = kupeFamily(s), rows = h.slot < -4 ? ROWS.asym : ROWS.sym;
  const part = (id: string, name: string, size: Part["size"], position: Part["position"], extra: Partial<Part> = {}): Part => ({ id, name, size, position, length: size[1], width: size[0], thickness: size[2], material: "alu", decor: kupeColor(k).name, role: "door", grain: "length", grainAxis: 1, edge: [0, 0, 0, 0], external: true, look: { color: col, metalness: 0.4, roughness: 0.35 }, ...extra });
  const model = (f: string, length: "x" | "y", mirror?: boolean) => ({ file: `kupe/${f}.glb`, length, ...(mirror ? { mirror } : {}) });
  const tt = fam.trackTop, tb = fam.trackBot;
  const panels = fam.panels ?? rows.panels;
  if (fam.trackPerRow) for (const r of k.doors > 1 ? [0, 1] : [0]) out.push(part(`kupe:track:top${r ? ":front" : ""}`, "Направляющая верхняя", [W, tt.h, tt.d], [W / 2, H - tt.h / 2, D / 2 + panels[r]], { role: "body", model: model(tt.file, "x", true) }));
  else out.push(part("kupe:track:top", "Направляющая верхняя", [W, tt.h, tt.d], [W / 2, H - tt.h / 2, D / 2], { role: "body", model: model(tt.file, "x", true) }));
  if (s.kind !== "hang" && d.trackBot > 0 && tb) out.push(part("kupe:track:bottom", "Направляющая нижняя", [W, tb.h, tb.d], [W / 2, tb.h / 2, D / 2 + rows.trackBotShift], { role: "body", model: model(tb.file, "x", true) }));
  // Полотна в 3D — по чертежу: нахлёст равен ширине ручки, чтобы ручки соседних дверей совпадали. Цена считается отдельно (kupeLeaf).
  const hw = h.w, n = k.doors, overlap = hw, lw = (W + (n - 1) * overlap) / n;
  const bottom = fam.gapBottom ?? (s.kind === "hang" ? 10 : GAP.bottom), top = H - (fam.gapTop ?? GAP.top), lh = top - bottom;
  const ft = fam.frameTop.h, fb = fam.frameBot.h, dv = /twelve/i.test(s.profile) ? { file: "divider_twelve", h: 12, d: 12.8 } : fam.divider;
  const sumR = sec.rowRatios.reduce((a, b) => a + b, 0), sumC = sec.colRatios.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    const row = i % 2, zs = D / 2 + panels[row], z = zs - h.slot, x0 = i * (lw - overlap), shift = row ? -(lw - overlap) : 0, f = kupeDoorFill(k, i);
    const leaf = { openShift: shift, sectionId: undefined };
    out.push(part(`kupe:${i}:side:l`, "Профиль-ручка", [hw, lh, h.d], [x0 + hw / 2, bottom + lh / 2, z], { ...leaf, model: model(h.file, "y") }));
    out.push(part(`kupe:${i}:side:r`, "Профиль-ручка", [hw, lh, h.d], [x0 + lw - hw / 2, bottom + lh / 2, z], { ...leaf, model: model(h.file, "y", true) }));
    const iw = lw - 2 * hw;
    out.push(part(`kupe:${i}:frame:top`, "Рамка верхняя", [iw, ft, fam.frameTop.d], [x0 + lw / 2, top - ft / 2, zs], { ...leaf, model: model(fam.frameTop.file, "x") }));
    out.push(part(`kupe:${i}:frame:bottom`, "Рамка нижняя", [iw, fb, fam.frameBot.d], [x0 + lw / 2, bottom + fb / 2, zs], { ...leaf, model: model(fam.frameBot.file, "x", true) }));
    const ih = lh - ft - fb, cw = iw - (sec.colRatios.length - 1) * dv.h, ch = ih - (sec.rowRatios.length - 1) * dv.h;
    let y = top - ft;
    // по чертежу вставка заходит в паз верхней и нижней рамки на 9 мм
    const ins = fam.insert, last = sec.rowRatios.length - 1;
    sec.rowRatios.forEach((r, ri) => {
      const rh = r / sumR * ch; let x = x0 + hw;
      const fTop = ri === 0 ? ins : 0, fBot = ri === last ? ins : 0, fh = rh + fTop + fBot, fy = y - rh / 2 + (fTop - fBot) / 2;
      sec.colRatios.forEach((c, ci) => {
        const cwi = c / sumC * cw, ldsp = isLdspFill(f);
        out.push(part(`kupe:${i}:fill:${ri}:${ci}`, "Наполнение · " + f.n, [cwi, fh, ldsp ? fam.panel ?? 8 : 5], [x + cwi / 2, fy, zs], { material: ldsp ? "board" : "glass", decor: f.n, look: ldsp ? undefined : kupeFillLook(f) }));
        x += cwi;
        if (ci < sec.colRatios.length - 1) { out.push(part(`kupe:${i}:div-v:${ri}:${ci}`, "Разделитель", [dv.h, rh, dv.d], [x + dv.h / 2, y - rh / 2, zs], { ...leaf, model: model(dv.file, "y") })); x += dv.h; }
      });
      y -= rh;
      if (ri < sec.rowRatios.length - 1) { out.push(part(`kupe:${i}:div-h:${ri}`, "Разделитель", [iw, dv.h, dv.d], [x0 + lw / 2, y - dv.h / 2, zs], { ...leaf, model: model(dv.file, "x") })); y -= dv.h; }
    });
    for (const p of out) if (p.id.startsWith(`kupe:${i}:fill:`)) p.openShift = shift;
  }
  return out;
}
