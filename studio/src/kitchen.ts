// Кухня в ГардерЁбе (основа 08.10.2026; конструктив по проектам Базиса цеха — разбор базы «Пистос» 09.10.2026).
// Кухонный корпус — обычный модуль студии с пометкой kitchen (нижний, навесной, пенал, антресоль): наполнение, фасады, петли,
// смета и раскрой работают как у шкафов. Здесь — только кухонное: регламенты, опоры с клипсами и цоколем, навесы, ниши техники,
// столешница как отдельный объект и шаблоны для палитры.
// Источник чисел: 30 кухонь, 372 модуля Базиса (Кухни\etalon\archetypes.md, отчёты разведки 09.10.2026). Оси Базиса = оси студии
// (X вправо, Y вверх, фасады на +Z), проверено снимком на кухне 2777.
import type { Module, Part } from "./model";
import { setEdges } from "./edges";

export type KitchenRole = "base" | "wall" | "tall" | "antresol";
export type ApplianceKind = "sink" | "oven" | "microwave" | "dishwasher" | "hob" | "hood" | "fridge";
export type KitchenSpec = { role: KitchenRole; appliance?: ApplianceKind;
  /** Цоколь модуля: высота (Базис 95, на 5 мм ниже дна) и есть ли он у этого модуля (сплошной цоколь ряда — у крайнего). */
  plinth?: { height: number; off?: boolean; clips?: boolean };
  /** Навесы ABS L/R: по умолчанию есть у навесных и антресолей; false — навешивание иначе (планка, шина, ранние проекты без навесов). */
  hangers?: boolean;
  /** Опоры: отступы рядов от задней и передней кромки боковин и позиции по ширине (по умолчанию 70/70 от краёв дна, как в Базисе). */
  legs?: { back: number; front: number; side?: number; xs?: number[] } };
export type WorktopCutout = { kind: "sink" | "hob"; x: number; width: number; depth: number };
export type WorktopSpec = { material: "postforming" | "ldsp" | "stone"; thickness: number; overhang: number; cutouts: WorktopCutout[] };

/** Регламенты кухни по проектам Базиса цеха, мм. */
export const KITCHEN = {
  legs: 100,            // «Опора кухонная регулируемая H100-120, чёрная» — 1 197 шт. в базе; дно на высоте 100
  legInset: 70,         // опоры в 70 мм от краёв дна по ширине и глубине (340 из 1 196 — самый частый вариант)
  clipReach: 29,        // клипса цоколя выступает от оси опоры к цоколю на 29 (сетка «Клипса для ПВХ цоколя»: X −10,9..+29 к цоколю)
  plinthHeight: 95,     // цоколь ЛДСП 16, на 5 мм ниже дна
  baseBody: 720,        // нижний корпус без опор (15 модулей; 740–840 — под клиента)
  baseHeight: 820,      // нижний модуль вместе с опорами, без столешницы
  baseDepth: 557,       // боковина нижнего; с накладным ХДФ 3 — 560
  worktopThickness: 38, // СКИФ 38
  worktopDepth: 600,    // от стены
  worktopOverhang: 24,  // свес над фасадом 21–24
  wallHeight: 920,      // навесной: 600–1110, чаще 920–1040
  wallDepth: 330,       // 34 модуля из ~120; 300–400
  wallGap: 600,         // от столешницы до низа навесных — 600 у 13 из 27 кухонь (462–737)
  wallGapMin: 450,
  hoodGapMin: 650,
  railWidth: 100,       // царги низа 100 лёжа (у семьи 2448 и Марии — 80)
  hangerDown: 15,       // навес: 15 мм ниже верха боковины
  hangerBack: 20,       // и 20 мм от задней кромки (лицевая плоскость ХДФ в пазу)
  faceGap: 1.5,         // фасад W−3 × H−3: отступ 1,5 от кромок (75 из 92 низов, 118 из 144 верхов)
  faceGapBetween: 3,    // зазор между фасадами 3
  backGap: 1.5,         // накладной ХДФ низа (W−3)×(H−3)
  groove: { inset: 16, width: 4, depth: 8, clear: 1 }, // П16-4×8, ХДФ (W−18)×(H−18), заходит на 7
  minWidth: 150, maxWidth: 1200,
} as const;

/** Техника: размеры ниши/корпуса по паспортам типовых встраиваемых моделей (ширина × высота × глубина, мм). */
export const APPLIANCES: Record<ApplianceKind, { label: string; niche: [number, number, number]; widths: number[] }> = {
  sink: { label: "Мойка", niche: [0, 0, 0], widths: [450, 500, 600, 800] },
  oven: { label: "Духовой шкаф", niche: [560, 595, 550], widths: [600] },
  microwave: { label: "Встраиваемая СВЧ", niche: [560, 380, 550], widths: [600] },
  dishwasher: { label: "Посудомоечная машина", niche: [450, 820, 560], widths: [450, 600] },
  hob: { label: "Варочная панель", niche: [560, 50, 490], widths: [450, 600, 800] },
  hood: { label: "Вытяжка встраиваемая", niche: [560, 180, 280], widths: [600] },
  fridge: { label: "Встраиваемый холодильник", niche: [560, 1780, 550], widths: [600] },
};

/** Модели фурнитуры Базиса (TriData → GLB, studio/public/models/hardware/bazis). Заполняется по manifest.json библиотеки.
 *  quat — поворот локальных осей фурнитуры Базиса в оси модуля (w, x, y, z). */
export const KITCHEN_MODELS: Partial<Record<"leg" | "clip" | "hanger-left" | "hanger-right" | "hanger-cap-left" | "hanger-cap-right", { file: string; mirror?: boolean }>> = {
  leg: { file: "hardware/bazis/ac675db9fc57.glb" },                // Опора кухонная регулируемая H100-120, чёрная (1 197 шт. в базе)
  clip: { file: "hardware/bazis/0d12888fb9df.glb" },               // Клипса для ПВХ цоколя, чёрная (611)
  "hanger-left": { file: "hardware/bazis/95a815598b07.glb" },      // Навес мебельный регулируемый ABS левый
  "hanger-right": { file: "hardware/bazis/b8339a249124.glb" },     // … правый (своя сетка Базиса, Z −23..0 — без зеркала)
  "hanger-cap-left": { file: "hardware/bazis/ca74b45576fa.glb" },  // Заглушка для мебельного навеса ABS левая
  "hanger-cap-right": { file: "hardware/bazis/19a5dd31bc40.glb" }, // … правая
};

export const isKitchen = (m: Module) => !!m.kitchen;
export const kitchenRole = (m: Module) => m.kitchen?.role;

/** Опоры нижнего модуля: в 70 мм от краёв дна; узкие (< 250) — по центру ширины, широкие (> 1300) — третий ряд посередине. */
export function kitchenLegs(m: Module): { x: number; z: number; front: boolean }[] {
  const w = m.width, d = m.depth, a = KITCHEN.legInset, L = m.kitchen?.legs;
  // отступ от торцов (side) — относительный, переживает изменение ширины; xs — абсолютные позиции нестандартной раскладки
  const s = L?.side ?? a, xs = L?.xs ?? (w < 250 ? [w / 2] : w > 1300 ? [s, w / 2, w - s] : [s, w - s]);
  return xs.flatMap((x) => [{ x, z: L?.back ?? a, front: false }, { x, z: d - (L?.front ?? a), front: true }]);
}

// Повороты осей фурнитуры Базиса в оси модуля (проверено по корпусу: опора — Z вниз, клипса — X к цоколю; навес — X к стене, Y вверх,
// Z внутрь корпуса). Кватернион [w, x, y, z].
const Q_LEG: [number, number, number, number] = [0.5, 0.5, -0.5, 0.5];      // X→+Z, Y→−X, Z→−Y
const Q_HANGER: [number, number, number, number] = [Math.SQRT1_2, 0, Math.SQRT1_2, 0]; // X→−Z, Y→+Y, Z→+X (оба навеса)

/** Детали, которые кухонный корпус добавляет к обычному: опоры с клипсами и цоколь (нижний, пенал), навесы (навесной, антресоль). */
export function kitchenExtraParts(m: Module, out: Part[]) {
  const k = m.kitchen; if (!k) return;
  const t = 16;
  const metal = (id: string, name: string, size: Part["size"], position: Part["position"], model?: Part["model"]): Part =>
    ({ id, name, size, position, length: Math.max(...size), width: [...size].sort((a, b) => b - a)[1], thickness: Math.min(...size), role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0], ...(model ? { model } : {}) });
  if ((k.role === "base" || k.role === "tall") && m.feet) {
    const H = m.feet.height;
    for (const [n, l] of kitchenLegs(m).entries()) {
      // Опора: ось вниз от нижней грани дна, площадка 4×D4 по квадрату 31×31; модель Базиса ±29 × 0..100 по оси.
      const lm = KITCHEN_MODELS.leg;
      out.push(metal(`leg:${n}`, "Опора кухонная регулируемая H100-120, чёрная", [58, H, 58], [l.x, H / 2, l.z], lm ? { file: lm.file, length: "y", native: true, origin: [l.x, H, l.z], quat: Q_LEG } : undefined));
      // клипсы на передних опорах — и когда цоколь у ряда, а не у модуля; нет только при clips: false
      if (l.front && k.plinth?.clips !== false) {
        const cm = KITCHEN_MODELS.clip;
        // Клипса для ПВХ цоколя: на передней опоре, 45–52 мм ниже дна, от −10,9 до +29 к цоколю.
        out.push(metal(`kitchen-clip:${n}`, "Клипса для ПВХ цоколя, чёрная", [32.3, 7, 39.9], [l.x, H - 49, l.z + 9.07], cm ? { file: cm.file, length: "y", native: true, origin: [l.x, H, l.z], quat: Q_LEG } : undefined));
      }
    }
    if (!k.plinth?.off) {
      const ph = k.plinth?.height ?? KITCHEN.plinthHeight, zb = m.depth - (k.legs?.front ?? KITCHEN.legInset) + KITCHEN.clipReach;
      // Цоколь ЛДСП 16 на клипсах передних опор: задняя грань — по выступу клипсы, на 5 мм ниже дна.
      out.push({ id: "kitchen-plinth", name: `Цоколь ${ph} ЛДСП 16 (на клипсах)`, size: [m.width, ph, t], position: [m.width / 2, ph / 2, zb + t / 2], length: m.width, width: ph, thickness: t, role: "body", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [2, 0, 0, 0] });
    }
  }
  if ((k.role === "wall" || k.role === "antresol") && k.hangers !== false) {
    for (const side of ["left", "right"] as const) {
      // Навес ABS регулируемый: начало координат — 15 мм ниже верха боковины, 20 мм от её задней кромки, на внутренней грани;
      // сетка Базиса: −64..+20 к стене, −42..−1 по высоте, 0..23 внутрь корпуса.
      const fx = side === "left" ? t : m.width - t, dir = side === "left" ? 1 : -1, oy = m.height - KITCHEN.hangerDown, oz = KITCHEN.hangerBack;
      // Оси навеса в модуле: X→−Z (−64..+20 → z 84..0, задний крюк заподлицо с задней кромкой), Y→+Y, Z→+X (правый навес Базиса — Z −23..0, внутрь).
      const hm = KITCHEN_MODELS[side === "left" ? "hanger-left" : "hanger-right"], cm = KITCHEN_MODELS[side === "left" ? "hanger-cap-left" : "hanger-cap-right"];
      out.push(metal(`kitchen-hanger:${side}`, `Навес мебельный регулируемый ABS ${side === "left" ? "левый" : "правый"}`, [23, 41, 84], [fx + dir * 11.5, oy - 21.5, oz + 22],
        hm ? { file: hm.file, length: "y", native: true, origin: [fx, oy, oz], quat: Q_HANGER } : undefined));
      // Заглушка навеса (комплект с навесом): −65..0 по X, −44..−1 по высоте, 0..26 внутрь.
      out.push(metal(`kitchen-hanger-cap:${side}`, `Заглушка навеса ABS ${side === "left" ? "левая" : "правая"}`, [26, 43, 65], [fx + dir * 13, oy - 22.5, oz + 32.5],
        cm ? { file: cm.file, length: "y", native: true, origin: [fx, oy, oz], quat: Q_HANGER } : undefined));
    }
  }
}

/** Кромка кухни по проектам Базиса цеха (k25, k16, k14): кромятся только открытые торцы, скрытые — без кромки; толщина — своя у кухни
 *  (1 или 0,5 мм ПВХ в цвет). Боковины низа — верх и перед; навесных — все четыре; дно под боковинами — перед и концы; дно и крыша между
 *  боковинами — перед и зад; царги — обе длинные; полки — все четыре; ХДФ и фасады — без кромки (фасады — фасадный материал). */
export function kitchenEdges(m: Module, out: Part[]) {
  const t = m.edgeScheme?.t; if (!t || !m.kitchen) return;
  const wall = m.kitchen.role === "wall" || m.kitchen.role === "antresol";
  for (const p of out) {
    if (p.material !== "board" || p.role === "door" || p.id.endsWith(":facade")) continue;
    // задние торцы кромятся, только если задник в пазу (у набивного ХДФ они закрыты)
    const rear = m.backType === "groove" || m.backType === "none" ? ["-z"] : [];
    // у навесных задние торцы кромятся при пазе; у нижних без задника (мойка) — тоже открыты и кромятся
    const rearBase = m.backType === "none" ? ["-z"] : [];
    if (p.id === "left" || p.id === "right") setEdges(p, wall ? ["+y", "-y", "+z", ...rear] : ["+y", "+z", ...rearBase], t);
    else if (p.id === "bottom") setEdges(p, m.bottomUnder ? ["+z", "+x", "-x", ...(wall ? rear : rearBase)] : ["+z", ...rear], t);
    else if (p.id === "top") setEdges(p, ["+z", ...rear], t);
    else if (p.id.startsWith("rail:")) setEdges(p, p.size[1] <= 16.01 ? ["+z", "-z"] : ["+y", "-y"], t);
    else if (p.role === "shelf") setEdges(p, ["+x", "-x", "+z", "-z"], t);
    else if (p.id === "kitchen-plinth") setEdges(p, ["+y", "-y"], t); // цоколь: кромка по верхнему и нижнему торцу (у пола в Базисе ±y)
    else if (p.role === "body") setEdges(p, ["+z"], t);
  }
}

/** Столешница — отдельный объект над нижними корпусами: в раскрой ЛДСП не идёт (кроме ЛДСП 32), цена за погонный метр. */
export function worktopParts(m: Module): Part[] {
  const w = m.worktop!, T = w.thickness, out: Part[] = [];
  out.push({ id: "worktop", name: `Столешница ${worktopLabel(w)} ${T} мм`, size: [m.width, T, m.depth], position: [m.width / 2, T / 2, m.depth / 2], length: m.width, width: m.depth, thickness: T, role: "body", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [0, 0, 2, 0], external: w.material !== "ldsp" });
  for (const [i, c] of w.cutouts.entries())
    out.push({ id: `worktop-cut:${i}`, name: c.kind === "sink" ? "Вырез под мойку" : "Вырез под варочную панель", size: [c.width, T + 2, c.depth], position: [c.x + c.width / 2, T / 2, m.depth / 2], length: c.width, width: c.depth, thickness: T, role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0], external: true });
  return out;
}
export function worktopLabel(w: WorktopSpec) { return { postforming: "постформинг", ldsp: "ЛДСП 16+16", stone: "искусственный камень" }[w.material]; }

export function kitchenErrors(m: Module): string[] {
  const e: string[] = [];
  if (m.worktop) {
    const w = m.worktop;
    if (!["postforming", "ldsp", "stone"].includes(w.material)) e.push("Столешница: материал из списка.");
    if (!Number.isFinite(w.thickness) || w.thickness < 12 || w.thickness > 60) e.push("Столешница: толщина 12–60 мм.");
    if (m.width < 200 || m.width > 4100) e.push("Столешница: длина 200–4100 мм (длиннее — со стыком).");
    for (const c of w.cutouts) if (c.x < 50 || c.x + c.width > m.width - 50 || c.depth > m.depth - 80) e.push("Столешница: вырез не ближе 50 мм к торцам и 40 мм к кромкам.");
  }
  if (m.kitchen) {
    const k = m.kitchen;
    if (!["base", "wall", "tall", "antresol"].includes(k.role)) e.push("Кухня: тип корпуса — нижний, навесной, пенал или антресоль.");
    if (k.appliance && !(k.appliance in APPLIANCES)) e.push("Кухня: неизвестная техника.");
    if ((k.role === "base") && !m.feet) e.push("Нижний кухонный корпус ставится на опоры.");
    if (k.plinth && (!Number.isFinite(k.plinth.height) || k.plinth.height < 50 || k.plinth.height > (m.feet?.height ?? 200))) e.push("Цоколь кухни: высота 50 мм — до высоты опор.");
  }
  return e;
}

/** Общий кухонный вид корпуса по Базису: фасады 1,5 / 3, ХДФ накладной (W−3)×(H−3) или в паз П16-4×8. */
const look = (m: Module): Module => ({ ...m, faceGap: KITCHEN.faceGap, faceGapBetween: KITCHEN.faceGapBetween, backGap: KITCHEN.backGap,
  // Базис цеха: фасад вплотную к корпусу (воздух 0), конфирматы в 64 мм от концов стыка, полка в 1 мм от задника, полкодержатели в 60 от кромок полки
  faceAir: 0, confirmatInset: 64, shelfRear: 1, shelfPinInset: 60, edgeScheme: { t: 1 } });

/** Нижний модуль (Базис «Нижний модуль (Пустой)»): дно под боковинами на опорах 100, крыши нет, две царги 100 лёжа заподлицо с верхом,
 *  ХДФ накладной; мойка — без задника, царги на ребре (передняя 60, задняя 100 — как 2777); духовка — без задника и царг. */
export function kitchenBase(base: Module, width: number, kind: "doors" | "drawers" | "sink" | "oven" | "dishwasher" = "doors"): Module {
  const m: Module = look({ ...structuredClone(base), name: { doors: "Нижний кухонный", drawers: "Нижний с ящиками", sink: "Под мойку", oven: "Под духовой шкаф", dishwasher: "Посудомойка" }[kind], width, height: KITCHEN.baseHeight, depth: KITCHEN.baseDepth, feet: { height: KITCHEN.legs }, plinthHeight: undefined, topType: "none", bottomUnder: true, backType: kind === "sink" || kind === "oven" ? "none" : "nailed", doors: kind === "doors" || kind === "sink", kitchen: { role: "base", ...(kind === "sink" || kind === "oven" || kind === "dishwasher" ? { appliance: kind } : {}) } });
  m.rails = kind === "oven" ? [] : kind === "sink"
    ? [{ place: "front-top", height: 60 }, { place: "rear-top", height: 100 }]
    : [{ place: "front-top", height: KITCHEN.railWidth, lay: "flat" }, { place: "rear-top", height: KITCHEN.railWidth, lay: "flat" }];
  // полка: в 1 мм от задника и в 1,5 от лица корпуса (k25 «НМ600»)
  m.sections = [{ ...m.sections[0], shelves: kind === "doors" ? [0.5] : [], drawers: kind === "drawers" ? 3 : 0, rod: false, shelfDepth: m.depth - 2.5 }];
  return m;
}
/** Навесной (Базис «ВМ (Стенка в паз)»): дно и крыша между боковинами, ХДФ в паз П16-4×8, навесы ABS L/R. */
export function kitchenWall(base: Module, width: number): Module {
  const g = KITCHEN.groove;
  const m: Module = look({ ...structuredClone(base), name: "Навесной кухонный", width, height: KITCHEN.wallHeight, depth: KITCHEN.wallDepth, feet: undefined, plinthHeight: 0, topType: "panel", backType: "groove", grooveInset: g.inset, grooveWidth: g.width, grooveDepth: g.depth, grooveClear: g.clear, doors: true, kitchen: { role: "wall" } });
  // полка: W−34, в 21 мм от задней кромки (за ХДФ в пазу) и в 1 мм от лица корпуса
  m.sections = [{ ...m.sections[0], shelves: [0.5], drawers: 0, rod: false, shelfDepth: m.depth - 22 }];
  return m;
}
export function kitchenWorktop(base: Module, width: number): Module {
  return { ...structuredClone(base), name: "Столешница", width, height: KITCHEN.worktopThickness, depth: KITCHEN.worktopDepth, doors: false, feet: undefined, plinthHeight: 0, backType: "none", worktop: { material: "postforming", thickness: KITCHEN.worktopThickness, overhang: KITCHEN.worktopOverhang, cutouts: [] } };
}

/** Ширины нижних корпусов прямой кухни по длине стены: ящики 600 у начала, мойка 800, дальше распашные 600; остаток — в последний корпус. */
export function kitchenRowWidths(length: number): { width: number; kind: "doors" | "drawers" | "sink" }[] {
  const out: { width: number; kind: "doors" | "drawers" | "sink" }[] = [];
  let rest = Math.round(length);
  if (rest >= 1400) { out.push({ width: 600, kind: "drawers" }); rest -= 600; }
  if (rest >= 1100) { out.push({ width: 800, kind: "sink" }); rest -= 800; }
  while (rest > 0) {
    if (rest <= KITCHEN.maxWidth && (rest < 900 || out.length === 0)) { out.push({ width: rest, kind: "doors" }); rest = 0; break; }
    out.push({ width: 600, kind: "doors" }); rest -= 600;
  }
  // остаток уже 300 мм — прибавить к предыдущему корпусу (до 1200), иначе оставить узким
  const last = out[out.length - 1], prev = out[out.length - 2];
  if (last && prev && last.width < 300 && prev.width + last.width <= KITCHEN.maxWidth) { prev.width += last.width; out.pop(); }
  return out;
}
