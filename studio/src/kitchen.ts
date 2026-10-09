// Кухня в ГардерЁбе (основа 08.10.2026; конструктив по проектам Базиса цеха — разбор базы «Пистос» 09.10.2026).
// Кухонный корпус — обычный модуль студии с пометкой kitchen (нижний, навесной, пенал, антресоль): наполнение, фасады, петли,
// смета и раскрой работают как у шкафов. Здесь — только кухонное: регламенты, опоры с клипсами и цоколем, навесы, ниши техники,
// столешница как отдельный объект и шаблоны для палитры.
// Источник чисел: 30 кухонь, 372 модуля Базиса (Кухни\etalon\archetypes.md, отчёты разведки 09.10.2026). Оси Базиса = оси студии
// (X вправо, Y вверх, фасады на +Z), проверено снимком на кухне 2777.
import type { Module, Part } from "./model";
import { setEdges } from "./edges";
import { axisLayout } from "./kitchenDrawers";

export type KitchenRole = "base" | "wall" | "tall" | "antresol";
export type ApplianceKind = "sink" | "oven" | "microwave" | "dishwasher" | "hob" | "hood" | "fridge";
export type KitchenSpec = { role: KitchenRole; appliance?: ApplianceKind;
  /** Цоколь модуля: высота (Базис 95, на 5 мм ниже дна) и есть ли он у этого модуля (сплошной цоколь ряда — у крайнего). */
  plinth?: { height: number; off?: boolean; clips?: boolean };
  /** Низ навесного без опор (Базис): дно поднято на plinthHeight, стандартного цоколя нет. front — фронтальная панель ЛДСП под дном
   *  (в Базисе «Фронтальная», «ФП» — закрывает низ, как цоколь) с утопанием от лица боковин; без front панели нет.
   *  doorsToFloor — фасады опущены до низа модуля (корпус поднят, фасад закрывает подсветку: k23, k28, k30). */
  raise?: { front?: number; doorsToFloor?: boolean };
  /** Дно короче спереди на столько мм (Базис k06, k10, k15: 24,5 — ниша под подсветку у лица навесного); по умолчанию 0. */
  bottomFront?: number;
  /** Дно короче сзади (Базис: навесной под вытяжку, дно перед ХДФ — k08 m10, k04, k13, k14: 20). */
  bottomBack?: number;
  /** Крыша короче сзади (Базис k33, k34: 20 — крыша перед ХДФ, ХДФ проходит за ней); backTopGap — ХДФ в паз до верха модуля минус столько мм (k33/k34: 1). */
  topBack?: number;
  backTopGap?: number;
  /** Модуль без дна (сушка k34 m04): ХДФ от низа модуля плюс столько мм (k34: 1). */
  backBottomGap?: number;
  /** Вырезы в обоих верхних углах ХДФ (Базис k33, k34: 25×45 — ХДФ проходит за крышей): ширина по X, высота от верха ХДФ. */
  backNotch?: { width: number; height: number };
  /** Стыки дна/крыши без крепежа в проекте Базиса («bottom:left» и т. п., k08 m10, k14 m06) — студия крепёж не ставит. */
  jointNone?: string[];
  /** Крепёж стыков дна/крыши с боковинами по Базису: ключ «bottom:left» и т. п. → [от задней кромки, от передней кромки детали], мм. */
  jointZ?: Record<string, [number, number]>;
  /** В проекте Базиса у модуля нет крепежа корпуса (конфирматов, эксцентриков, шкантов) — студия его не добавляет. */
  noFasteners?: boolean;
  /** Сушка навесного — элементы с сеткой Базиса (набор SU01/03: держатели, решётки, поддоны): x — от боковины side, y — от низа, z — от задней кромки. */
  dryer?: { name: string; mesh: string; side: "left" | "right"; x: number; y: number; z: number; quat: [number, number, number, number] }[];
  /** Имя крепежа корпуса по проекту Базиса, если это не «Конфирмат 7х50» (k33, k34: «Евровинт 6х50») — в деталях и смете. */
  confirmatName?: string;
  /** В проекте Базиса у нижнего модуля нет опор (k33, k34: стоит на дне) — студия опоры не требует и не добавляет. */
  noLegs?: boolean;
  /** Глубина присадки по проекту Базиса, если она не типовая: confirmat — D5 в торец (обычно 35; k33/k34 «Евровинт 6х50» — 36), pin — D5 под полкодержатель (обычно 12; k33/k34 — 9). */
  drill?: { confirmat?: number; pin?: number };
  /** Вырез в заднем верхнем углу боковины навесного/антресоли (Базис k32: 100×20 — контур боковины из 6 точек): height — от верха, depth — от задней кромки. */
  sideNotch?: Partial<Record<"left" | "right", { height: number; depth: number }>>;
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
  railWidth: 100,       // царги низа 100 лёжа (у части кухонь базы — 80)
  hangerDown: 15,       // навес: 15 мм ниже верха боковины
  hangerBack: 20,       // и 20 мм от задней кромки (лицевая плоскость ХДФ в пазу)
  faceGap: 1.5,         // фасад W−3 × H−3: отступ 1,5 от кромок (75 из 92 низов, 118 из 144 верхов)
  faceGapBetween: 3,    // зазор между фасадами 3
  backGap: 1.5,         // накладной ХДФ низа (W−3)×(H−3)
  groove: { inset: 16, width: 4, depth: 8, clear: 1 }, // П16-4×8, ХДФ (W−18)×(H−18), заходит на 7
  minWidth: 150, maxWidth: 1200,
  maxHeight: 2900,      // пеналы в Базисе до 2869 (k30 m15), 2850 (k31 m05), 2820 (k27); у шкафов студии лимит RULES.maxH 2500 не меняется
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
/** Единичный кватернион: в эталоне Базиса компоненты округлены до 0,01 (0,71 вместо √½, |q|² = 1,0082) — без нормировки сетка растянута на ~0,8 %. */
export function unitQuat(q: [number, number, number, number]): [number, number, number, number] {
  const n = Math.hypot(...q);
  return n > 1e-9 ? (q.map((v) => v / n) as [number, number, number, number]) : [1, 0, 0, 0];
}

/** Детали, которые кухонный корпус добавляет к обычному: опоры с клипсами и цоколь (нижний, пенал), навесы (навесной, антресоль). */
export function kitchenExtraParts(m: Module, out: Part[]) {
  const k = m.kitchen; if (!k) return;
  // Базис без крепежа корпуса (k32 целиком, отдельные модули k33, k34): студия его не добавляет — ни деталей, ни строк сметы
  if (k.noFasteners) for (let i = out.length - 1; i >= 0; i--) if (/^(fast|ecc|dowel):/.test(out[i].id)) out.splice(i, 1);
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
  // сушка (Базис): элементы по сетке библиотеки фурнитуры, в точке и с поворотом проекта; в раскрой не идут
  for (const [n, d] of (k.dryer ?? []).entries()) {
    const o: [number, number, number] = [d.side === "left" ? d.x : m.width - d.x, d.y, d.z];
    out.push(metal(`kitchen-dryer:${n}`, d.name, [0.01, 0.01, 0.01], o, // габарит сетки неизвестен — точка привязки, геометрия из GLB
       { file: `hardware/bazis/${d.mesh}.glb`, length: "y", native: true, origin: o, quat: unitQuat(d.quat) }));
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
  const t = m.edgeScheme?.t; if (!t || !m.kitchen) { golaSides(m, out); rearNotches(m, out); return; } // вырезы Gola — и без схемы кромки
  const wall = m.kitchen.role === "wall" || m.kitchen.role === "antresol", tall = m.kitchen.role === "tall";
  // фиксированная полка на эксцентриках (пенал k12 m04, k30 m05): торцы у боковин закрыты — кромка только перед и зад;
  // фикс. полка на другом крепеже (k16 m01, P8–P14) — по кругу, как съёмная
  const ecc = (id: string) => m.jointFastening?.[`${id}:left`] === "eccentric" || m.jointFastening?.[`${id}:right`] === "eccentric";
  const fixedIds = new Set(m.sections.flatMap((s) => (s.fixed ?? []).map((j) => `${s.id}:shelf:${j}`)).filter(ecc));
  const fixedAll = new Set(m.sections.flatMap((s) => (s.fixed ?? []).map((j) => `${s.id}:shelf:${j}`)));
  for (const p of out) {
    if (p.material !== "board" || p.role === "door" || p.id.endsWith(":facade")) continue;
    // задние торцы кромятся, только если задник в пазу (у набивного ХДФ они закрыты)
    const rear = m.backType === "groove" || m.backType === "none" ? ["-z"] : [];
    // у навесных задние торцы кромятся при пазе; у нижних без задника (мойка) — тоже открыты и кромятся
    const rearBase = m.backType === "none" ? ["-z"] : [];
    const ends = (p.id === "bottom" || p.id === "top") ? m.edgeScheme?.ends?.[p.id] : undefined;
    if (ends) setEdges(p, ends, t); // торцы дна/крыши — как в проекте Базиса (k32 — по кругу)
    else if (p.id === "left" || p.id === "right") setEdges(p, wall ? ["+y", "-y", "+z", ...rear] : ["+y", "+z", ...rearBase], t);
    else if (p.id === "bottom") setEdges(p, m.bottomUnder ? ["+z", "+x", "-x", ...(wall ? rear : rearBase)] : ["+z", ...rear], t);
    else if (p.id === "top") setEdges(p, tall ? ["+z", "-z"] : ["+z", ...rear], t); // пенал: крыша видна сверху — кромка перед и зад (Базис k12 m04, k30 m05)
    else if (p.role === "shelf" && fixedIds.has(p.id)) setEdges(p, ["+z", "-z"], t);
    else if (p.role === "shelf" && m.edgeScheme?.fixedSides && fixedAll.has(p.id)) setEdges(p, m.edgeScheme.fixedSides, t); // жёсткая полка навесного — торцы как в Базисе (k05: перед и зад)
    else if (p.id.startsWith("rail:")) setEdges(p, p.size[1] <= 16.01 ? (m.edgeScheme?.railBack === false && p.position[2] - p.size[2] / 2 < 0.5 ? ["+z"] : ["+z", "-z"]) : ["+y", "-y"], t);
    else if (p.role === "shelf") setEdges(p, m.edgeScheme?.shelfSides ?? ["+x", "-x", "+z", "-z"], m.edgeScheme?.shelfT ?? t); // полки: по кругу, толщина корпуса — если Базис не задал иначе
    else if (p.id === "kitchen-plinth") setEdges(p, ["+y", "-y"], t); // цоколь: кромка по верхнему и нижнему торцу (у пола в Базисе ±y)
    else if (p.id.startsWith("kd:") && p.id.includes(":fx:")) setEdges(p, p.id.includes(":fx:side:") ? ["+y", "-y", "-z"] : p.id.endsWith(":bottom") ? ["-z"] : ["+y"], t); // короб Firmax (Базис): боковины ±y и задний торец, задняя/фальшпанель — верх, дно — задний торец
    else if (p.id.startsWith("kd:") && p.id.endsWith(":back")) setEdges(p, ["+x", "-x", "+y", "-y"], t); // задняя стенка ящика Axis PRO — по кругу; дно — без кромки
    else if (p.id.startsWith("kd:")) continue;
    else if (p.role === "body") setEdges(p, ["+z"], t);
  }
  golaSides(m, out);
  rearNotches(m, out);
}

/** Вырез в заднем верхнем углу боковин навесного/антресоли (Базис k32: 100×20). Раскрой — по габариту; кромка по контуру
 *  (отрезки выреза кромятся, сумма по сторонам равна стороне — как у Базиса 310 + 20 = 330); пересечения — по телу без выреза. */
export function rearNotches(m: Module, out: Part[]) {
  const wallish = !!m.kitchen && (m.kitchen.role === "wall" || m.kitchen.role === "antresol");
  // ХДФ с вырезами в верхних углах (k33, k34): раскрой — по габариту, пересечения — по телу без углов
  const bn = wallish ? m.kitchen!.backNotch : undefined, bp = bn ? out.find((p) => p.id === "back" && p.material === "hdf") : undefined;
  if (bn && bp && bn.width > 0 && bn.height > 0 && 2 * bn.width < bp.size[0] && bn.height < bp.size[1]) {
    bp.topNotches = { width: bn.width, height: bn.height };
    const [w, h] = bp.size, [x, y, z] = bp.position;
    bp.collide = [{ size: [w, h - bn.height, bp.size[2]], position: [x, y - bn.height / 2, z] }, { size: [w - 2 * bn.width, bn.height, bp.size[2]], position: [x, y + h / 2 - bn.height / 2, z] }];
  }
  const sn = wallish ? m.kitchen!.sideNotch : undefined;
  if (!sn) return;
  for (const p of out) {
    if (p.id !== "left" && p.id !== "right") continue;
    const n = sn[p.id], H = p.size[1], D = p.size[2];
    if (!n || !(n.height > 0 && n.height < H && n.depth > 0 && n.depth < D)) continue;
    p.rearNotch = { height: n.height, depth: n.depth };
    const x = p.position[0], y0 = p.position[1] - H / 2, z0 = p.position[2] - D / 2;
    p.collide = [{ size: [p.size[0], H - n.height, D], position: [x, y0 + (H - n.height) / 2, z0 + D / 2] },
      { size: [p.size[0], n.height, D - n.depth], position: [x, y0 + H - n.height / 2, z0 + n.depth + (D - n.depth) / 2] }];
  }
}

/** Gola по Базису (k06/m03 и др.): вырезы в переднем торце боковин нижнего модуля. Кромка идёт отрезками контура:
 *  перед = высота боковины − длины вырезов, верх = глубина − глубина верхнего (открытого) выреза; торцы самих вырезов не кромятся. */
export function golaSides(m: Module, out: Part[]) {
  const cuts = m.kitchen && (m.kitchen.role === "base" || m.kitchen.role === "tall") ? m.gola?.cuts : undefined; // навесные — без Gola
  if (!cuts?.length) return;
  for (const p of out) {
    if (p.id !== "left" && p.id !== "right") continue;
    const H = p.size[1], D = p.size[2];
    const ok = cuts.filter((c) => c.top1 > c.top0 && c.top1 <= H && c.depth > 0 && c.depth < D);
    if (!ok.length) continue;
    p.golaCuts = ok.map((c) => ({ ...c }));
    let front = H - ok.reduce((s, c) => s + (c.top1 - c.top0), 0), top = D - Math.max(0, ...ok.filter((c) => c.top0 <= 0.01).map((c) => c.depth));
    // кромка по самому вырезу (k15, k17 и др.): стенка выреза и дуга скругления — к переднему торцу, дно выреза — к верхнему
    for (const c of ok) if (c.edged) {
      const open = c.top0 <= 0.01, L = c.top1 - c.top0;
      front += (open ? L - c.r + Math.PI * c.r / 2 : L - 2 * c.r + Math.PI * c.r);
      top += c.depth - c.r;
    }
    p.edgeLen = { "+z": Math.round(front * 10) / 10, "+y": Math.round(top * 10) / 10 };
    // проверка пересечений — по телу боковины без вырезов: задняя часть во всю высоту + передняя полоса между вырезами
    const y0 = p.position[1] - H / 2, z0 = p.position[2] - D / 2, zf = z0 + D, dz = Math.max(...ok.map((c) => c.depth)), x = p.position[0];
    const col: NonNullable<Part["collide"]> = [{ size: [p.size[0], H, D - dz], position: [x, y0 + H / 2, z0 + (D - dz) / 2] }];
    const spans = ok.map((c) => [y0 + H - c.top1, y0 + H - c.top0]).sort((a, b) => a[0] - b[0]);
    let ya = y0;
    for (const [s0, s1] of [...spans, [y0 + H, y0 + H]]) { if (s0 - ya > 0.01) col.push({ size: [p.size[0], s0 - ya, dz], position: [x, (ya + s0) / 2, zf - dz / 2] }); ya = Math.max(ya, s1); }
    p.collide = col;
  }
  // профили Gola (алюминий, вне раскроя): верхний вырез — профиль L, средний — C; по всей ширине модуля в вырезах боковин
  const sideL = out.find((p) => p.id === "left" && p.golaCuts);
  if (!sideL) return;
  const H = sideL.size[1], y0 = sideL.position[1] - H / 2, zf = sideL.position[2] + sideL.size[2] / 2;
  for (const [k, c] of sideL.golaCuts!.entries()) {
    const L = c.top0 <= 0.01, h = c.top1 - c.top0, yc = y0 + H - (c.top0 + c.top1) / 2;
    out.push({ id: `gola:${L ? "L" : "C"}:${k}`, name: `Профиль Gola ${L ? "L (верхний)" : "C (средний)"}, алюминий`, size: [m.width, h, c.depth], position: [m.width / 2, yc, zf - c.depth / 2],
      length: m.width, width: h, thickness: c.depth, material: "alu", decor: "", role: "fastener", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0], external: true,
      look: { color: 0xc4c8cc, metalness: 0.85, roughness: 0.35 } });
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
    if ((k.role === "base") && !m.feet && !k.noLegs) e.push("Нижний кухонный корпус ставится на опоры."); // noLegs — в проекте Базиса опор нет (k33, k34): не требуем и не добавляем
    if (k.jointZ && Object.values(k.jointZ).some((v) => !Array.isArray(v) || v.length !== 2 || v.some((x) => !Number.isFinite(x) || x < 5 || x > m.depth / 2 + 50))) e.push("Крепёж стыка: отступы от кромок 5 мм — до середины глубины.");
    if (k.bottomFront !== undefined && (!Number.isFinite(k.bottomFront) || k.bottomFront < 0 || k.bottomFront > 100)) e.push("Дно короче спереди: 0–100 мм.");
    if (k.bottomBack !== undefined && (!Number.isFinite(k.bottomBack) || k.bottomBack < 0 || k.bottomBack > 120)) e.push("Дно короче сзади: 0–120 мм.");
    if (k.topBack !== undefined && (!Number.isFinite(k.topBack) || k.topBack < 0 || k.topBack > 120)) e.push("Крыша короче сзади: 0–120 мм.");
    if (k.backTopGap !== undefined && (!Number.isFinite(k.backTopGap) || k.backTopGap < 0 || k.backTopGap > 20)) e.push("Зазор ХДФ до верха: 0–20 мм.");
    if (k.raise && (m.feet || (k.raise.front !== undefined && (!Number.isFinite(k.raise.front) || k.raise.front < 0 || k.raise.front > m.depth - 16)))) e.push("Подъём дна навесного: без опор, панель под дном в пределах глубины корпуса.");
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
  m.sections = [{ ...m.sections[0], shelves: kind === "doors" ? [0.5] : [], drawers: 0, rod: false, shelfDepth: m.depth - 2.5 }];
  // ящики — Axis PRO по Базису (дно и задняя стенка ЛДСП, металлические царги), три фасада: нижний крупнее
  if (kind === "drawers") { m.doors = false; m.kdrawers = axisLayout(m, 3); }
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
